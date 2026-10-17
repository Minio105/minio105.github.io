/* ==========================================================================
   state.js — stan rozgrywki: kraje, prowincje, relacje, zapis/wczytanie.
   Stan jest "płaski" (tablica prowincji + tablica krajów), dzięki czemu
   zapis do localStorage jest szybki i kompaktowy.
   ========================================================================== */
window.GameState = (function () {
  'use strict';

  const VERSION = 1;
  const SAVE_PREFIX = 'epoka.save.';
  const AUTOSAVE_KEY = 'epoka.autosave';

  const REL = { PEACE: 0, WAR: 1, ALLY: 2 };
  const REL_NAME = { 0: 'pokój', 1: 'wojna', 2: 'sojusz' };

  const DIFFICULTY = {
    easy: { name: 'Łatwy', playerIncome: 1.35, playerUpkeep: 0.8, aiIncome: 0.85, aiAggression: 0.7 },
    normal: { name: 'Normalny', playerIncome: 1.0, playerUpkeep: 1.0, aiIncome: 1.0, aiAggression: 1.0 },
    hard: { name: 'Trudny', playerIncome: 0.85, playerUpkeep: 1.1, aiIncome: 1.2, aiAggression: 1.35 }
  };

  /* --------------------------------------------------------------- kolory -- */
  function colorFor(country) {
    const mc = country.mc || [3, 3, 3];
    const h = Util.hashStr(country.name + country.iso);
    const hue = ((mc[0] || 3) * 41 + (mc[1] || 2) * 17 + (mc[2] || 5) * 7 + (h % 23) - 11 + 360) % 360;
    const sat = 0.33 + 0.06 * ((mc[1] || 2) % 4) + (h % 7) * 0.004;
    const light = 0.42 + 0.055 * ((mc[2] || 1) % 3);
    return Util.hslToHex(hue, sat, light);
  }

  /* ------------------------------------------------------- nowa rozgrywka -- */
  function create(world, opts) {
    opts = opts || {};
    const N = world.countries.length;
    const P = world.provinces.length;
    const dif = DIFFICULTY[opts.difficulty] || DIFFICULTY.normal;

    const state = {
      version: VERSION,
      seed: opts.seed || 20261016,
      difficulty: opts.difficulty || 'normal',
      year: 2026,
      turn: 1,
      playerId: opts.playerId || 0,
      relations: new Int8Array(N * N),
      truceUntil: new Int32Array(N * N),
      warStart: new Int32Array(N * N),
      countries: [],
      provinces: [],
      log: [],
      offers: [],
      rngState: (opts.seed || 20261016) >>> 0,
      mapMode: 'political',
      gameOver: null,
      difficultyInfo: dif
    };
    const rnd = Util.mulberry32(state.seed ^ 0x9e3779b9);

    /* kraje */
    for (let i = 0; i < N; i++) {
      const wc = world.countries[i];
      const color = colorFor(wc);
      state.countries.push({
        id: i,
        name: wc.name,
        iso: wc.iso,
        continent: wc.continent,
        color: color,
        treasury: Math.round(40 + wc.pop / 1e6 * 0.8),
        aggression: Util.clamp(0.2 + rnd() * 0.55, 0, 1),
        isPlayer: i === state.playerId,
        alive: true,
        capitalProvince: wc.capitalProvince,
        centroid: wc.centroid,
        // pola wyliczane (patrz Logic.recomputeAggregates)
        income: 0, upkeep: 0, troops: 0, pop: 0, econ: 50, provinceCount: wc.provinceCount,
        maxTroops: 0
      });
    }
    if (state.playerId < 0 || state.playerId >= N || state.countries[state.playerId].provinceCount <= 0) {
      // gdyby wybrano kraj bez prowincji — wybierz największy
      let best = 0, bestCount = -1;
      for (let i = 0; i < N; i++) if (state.countries[i].provinceCount > bestCount) { bestCount = state.countries[i].provinceCount; best = i; }
      state.playerId = best;
      state.countries[best].isPlayer = true;
    }
    state.playerStartProvinces = state.countries[state.playerId].provinceCount;
    state.milestones = {};

    /* prowincje */
    for (let i = 0; i < P; i++) {
      const wp = world.provinces[i];
      state.provinces.push({
        id: i,
        name: wp.name,
        country: wp.country,
        pop: wp.pop,
        econ: wp.econ,
        fort: wp.isCapital ? 2 : 0,
        troops: 0,
        moved: false,
        revolt: 0,
        isCapital: !!wp.isCapital,
        coastal: !!wp.coastal
      });
    }

    /* armie na start: proporcjonalnie do liczby ludności kraju */
    const weights = new Float64Array(P);
    for (let i = 0; i < P; i++) weights[i] = state.provinces[i].pop;
    const countryWeight = new Float64Array(N);
    for (let i = 0; i < P; i++) countryWeight[state.provinces[i].country] += weights[i];
    for (let cid = 0; cid < N; cid++) {
      const wc = world.countries[cid];
      if (wc.provinceCount <= 0) continue;
      let total = Util.clamp(Math.round(wc.pop / 1e6 * 1.6), 3, 420);
      if (cid === state.playerId) total = Math.round(total * 1.1);
      // rozdziel na prowincje
      let left = total;
      const own = world.countries[cid].provinces;
      const sorted = own.slice().sort(function (a, b) { return state.provinces[b].pop - state.provinces[a].pop; });
      for (let k = 0; k < sorted.length; k++) {
        const share = countryWeight[cid] > 0 ? state.provinces[sorted[k]].pop / countryWeight[cid] : 0;
        let take = Math.floor(share * total);
        if (k === 0) take += Math.min(5, Math.round(total * 0.05));
        take = Math.min(take, maxTroops(state, sorted[k]));
        state.provinces[sorted[k]].troops += take;
        left -= take;
      }
      // resztę dorzuć do stolicy
      const cap = wc.capitalProvince;
      if (cap >= 0 && left > 0) {
        const add = Math.min(left, maxTroops(state, cap) - state.provinces[cap].troops);
        state.provinces[cap].troops += Math.max(0, add);
      }
    }

    /* kilka konfliktów na start (tylko AI), żeby świat żył */
    if (opts.startWars !== false) {
      const pool = [];
      for (let i = 0; i < N; i++) {
        if (state.countries[i].provinceCount <= 0) continue;
        const nb = neighborCountries(world, i);
        for (let j = 0; j < nb.length; j++) if (nb[j] > i && state.countries[nb[j]].provinceCount > 0) pool.push([i, nb[j]]);
      }
      const wars = Math.min(6, Math.max(2, Math.round(pool.length * 0.01)));
      for (let w = 0; w < wars && pool.length; w++) {
        const pair = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
        if (pair[0] === state.playerId || pair[1] === state.playerId) continue;
        setRelation(state, pair[0], pair[1], REL.WAR);
      }
    }

    return state;
  }

  /* Sąsiedzi danego kraju (na podstawie prowincji) — statyczne. */
  function neighborCountries(world, cid) {
    const wc = world.countries[cid];
    if (!wc || !wc.provinces) return [];
    const set = new Set();
    for (let i = 0; i < wc.provinces.length; i++) {
      const pid = wc.provinces[i];
      const nb = world.provinces[pid].neighbors;
      for (let j = 0; j < nb.length; j++) {
        const oc = world.provinces[nb[j]].country;
        if (oc !== cid) set.add(oc);
      }
    }
    return Array.from(set);
  }

  function maxTroops(state, pid) {
    const pv = state.provinces[pid];
    return Math.max(12, Math.round(pv.pop / 100000) + 10);
  }

  /* ------------------------------------------------------------ relacje ---- */
  function relIndex(state, a, b) { return a * state.countries.length + b; }
  function relation(state, a, b) { return state.relations[relIndex(state, a, b)]; }
  function setRelation(state, a, b, v) {
    state.relations[relIndex(state, a, b)] = v;
    state.relations[relIndex(state, b, a)] = v;
  }

  /* ------------------------------------------------- zapis / wczytanie ----- */
  function encodeRuns(arr) {
    const out = [];
    let cur = arr[0], count = 1;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === cur) count++;
      else { out.push(cur, count); cur = arr[i]; count = 1; }
    }
    out.push(cur, count);
    return out;
  }
  function decodeRuns(runs, Type) {
    const arr = new Type(runs.length ? runs.reduce(function (s, v, i) { return i % 2 ? s + v : s; }, 0) : 0);
    let k = 0;
    for (let i = 0; i < runs.length; i += 2) {
      const v = runs[i], n = runs[i + 1];
      for (let j = 0; j < n; j++) arr[k++] = v;
    }
    return arr;
  }

  function serialize(state) {
    const P = state.provinces.length;
    const prov = new Array(P);
    for (let i = 0; i < P; i++) {
      const pv = state.provinces[i];
      prov[i] = [pv.country, pv.pop, pv.econ, pv.fort, pv.troops, pv.moved ? 1 : 0];
    }
    const countries = state.countries.map(function (c) {
      return [Math.round(c.treasury), c.aggression, c.alive ? 1 : 0, c.capitalProvince];
    });
    return {
      v: VERSION,
      seed: state.seed,
      difficulty: state.difficulty,
      year: state.year,
      turn: state.turn,
      playerId: state.playerId,
      mapMode: state.mapMode,
      rngState: state.rngState,
      gameOver: state.gameOver,
      playerStartProvinces: state.playerStartProvinces || 0,
      milestones: state.milestones || {},
      countries: countries,
      provinces: prov,
      relations: encodeRuns(state.relations),
      truce: encodeRuns(state.truceUntil),
      warStart: encodeRuns(state.warStart || new Int32Array(state.relations.length)),
      offers: state.offers || [],
      log: state.log.slice(-120),
      savedAt: new Date().toISOString()
    };
  }

  function deserialize(world, data) {
    const N = world.countries.length;
    if (!data || data.v !== VERSION) return null;
    if (!data.provinces || data.provinces.length !== world.provinces.length) return null;
    const state = {
      version: VERSION,
      seed: data.seed,
      difficulty: data.difficulty,
      year: data.year,
      turn: data.turn,
      playerId: data.playerId,
      mapMode: data.mapMode || 'political',
      rngState: data.rngState,
      gameOver: data.gameOver || null,
      playerStartProvinces: data.playerStartProvinces || 0,
      milestones: data.milestones || {},
      difficultyInfo: DIFFICULTY[data.difficulty] || DIFFICULTY.normal,
      log: data.log || [],
      relations: decodeRuns(data.relations, Int8Array),
      truceUntil: decodeRuns(data.truce, Int32Array),
      warStart: data.warStart ? decodeRuns(data.warStart, Int32Array) : new Int32Array(N * N),
      offers: data.offers || [],
      countries: [],
      provinces: []
    };
    for (let i = 0; i < N; i++) {
      const wc = world.countries[i];
      const d = data.countries[i] || [0, 0.4, 1, wc.capitalProvince];
      state.countries.push({
        id: i, name: wc.name, iso: wc.iso, continent: wc.continent,
        color: colorFor(wc),
        treasury: d[0], aggression: d[1], alive: !!d[2],
        isPlayer: i === state.playerId,
        capitalProvince: d[3],
        centroid: wc.centroid,
        income: 0, upkeep: 0, troops: 0, pop: 0, econ: 50,
        provinceCount: 0, maxTroops: 0
      });
    }
    for (let i = 0; i < world.provinces.length; i++) {
      const wp = world.provinces[i];
      const d = data.provinces[i];
      state.provinces.push({
        id: i, name: wp.name, country: d[0], pop: d[1], econ: d[2],
        fort: d[3], troops: d[4], moved: !!d[5], revolt: 0,
        isCapital: !!wp.isCapital, coastal: !!wp.coastal
      });
    }
    return state;
  }

  function save(state, slot) {
    const key = slot === 'auto' ? AUTOSAVE_KEY : SAVE_PREFIX + slot;
    try {
      localStorage.setItem(key, JSON.stringify(serialize(state)));
      return true;
    } catch (e) {
      return false;
    }
  }

  function load(world, slot) {
    const key = slot === 'auto' ? AUTOSAVE_KEY : SAVE_PREFIX + slot;
    let raw = null;
    try { raw = localStorage.getItem(key); } catch (e) { return null; }
    if (!raw) return null;
    let data = null;
    try { data = JSON.parse(raw); } catch (e) { return null; }
    return deserialize(world, data);
  }

  function saveInfo(slot) {
    const key = slot === 'auto' ? AUTOSAVE_KEY : SAVE_PREFIX + slot;
    let raw = null;
    try { raw = localStorage.getItem(key); } catch (e) { return null; }
    if (!raw) return null;
    try {
      const d = JSON.parse(raw);
      return {
        year: d.year, turn: d.turn, playerId: d.playerId,
        difficulty: d.difficulty, savedAt: d.savedAt,
        provinces: d.provinces ? d.provinces.length : 0
      };
    } catch (e) { return null; }
  }

  function remove(slot) {
    try { localStorage.removeItem(slot === 'auto' ? AUTOSAVE_KEY : SAVE_PREFIX + slot); } catch (e) { }
  }

  return {
    VERSION: VERSION, REL: REL, REL_NAME: REL_NAME, DIFFICULTY: DIFFICULTY,
    create: create, save: save, load: load, saveInfo: saveInfo, remove: remove,
    serialize: serialize, deserialize: deserialize,
    relation: relation, setRelation: setRelation, relIndex: relIndex,
    maxTroops: maxTroops, neighborCountries: neighborCountries,
    colorFor: colorFor
  };
})();
