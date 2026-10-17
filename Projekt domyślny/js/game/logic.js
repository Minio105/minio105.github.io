/* ==========================================================================
   logic.js — zasady gry: gospodarka, rekrutacja, bitwy, dyplomacja, tury.
   ========================================================================== */
window.Logic = (function () {
  'use strict';

  const REL = GameState.REL;

  const ECONOMY_SCALE = 1.6;      // przelicznik dochodu prowincji
  const UPKEEP_PER_TROOP = 0.32;  // utrzymanie armii na turę
  const RECRUIT_COST = 10;        // koszt jednego żołnierza
  const NAVAL_RANGE_KM = 1800;    // zasięg desantu morskiego
  const NAVAL_COST = 25;          // koszt transportu
  const NAVAL_ATTACK_MOD = 0.62;  // kara dla atakującego z morza
  const TRUCE_TURNS = 12;

  /* ------------------------------------------------------------- podstawy -- */
  function prov(state, pid) { return state.provinces[pid]; }
  function country(state, cid) { return state.countries[cid]; }

  function provinceIncome(state, pv) {
    return Math.max(1, Math.round(ECONOMY_SCALE * (pv.pop / 2e6) * (1 + pv.econ / 50)));
  }

  function recomputeAggregates(state) {
    const cs = state.countries;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      c.income = 0; c.upkeep = 0; c.troops = 0; c.pop = 0;
      c.econSum = 0; c.provinceCount = 0; c.maxTroops = 0;
    }
    for (let i = 0; i < state.provinces.length; i++) {
      const pv = state.provinces[i];
      const c = cs[pv.country];
      if (!c) continue;
      pv.income = provinceIncome(state, pv);
      c.income += pv.income;
      c.troops += pv.troops;
      c.pop += pv.pop;
      c.econSum += pv.econ * pv.pop;
      c.provinceCount++;
      c.maxTroops += GameState.maxTroops(state, pv.id);
    }
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      c.alive = c.provinceCount > 0;
      c.econ = c.pop > 0 ? c.econSum / c.pop : 0;
      c.tech = 1 + c.econ / 110;
      c.upkeep = Math.round(c.troops * UPKEEP_PER_TROOP);
      c.net = c.income - c.upkeep;
    }
    return cs;
  }

  function score(state, cid) {
    const c = state.countries[cid];
    if (!c) return 0;
    return Math.round(c.provinceCount * 12 + c.troops * 0.6 + c.pop / 1e6 * 1.5 + c.econ * 0.8);
  }

  function ranking(state) {
    const arr = state.countries.map(function (c) {
      return { id: c.id, name: c.name, color: c.color, score: score(state, c.id), alive: c.alive, isPlayer: c.isPlayer };
    });
    arr.sort(function (a, b) { return b.score - a.score; });
    return arr;
  }

  function rankOf(state, cid) {
    const r = ranking(state);
    for (let i = 0; i < r.length; i++) if (r[i].id === cid) return i + 1;
    return r.length;
  }

  function log(state, text, type) {
    state.log.push({ year: state.year, turn: state.turn, text: text, type: type || 'info' });
    if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  }

  function atWar(state, a, b) {
    if (a === b || a < 0 || b < 0) return false;
    return GameState.relation(state, a, b) === REL.WAR;
  }
  function isAlly(state, a, b) {
    if (a === b) return false;
    return GameState.relation(state, a, b) === REL.ALLY;
  }
  function truceActive(state, a, b) {
    return state.truceUntil[GameState.relIndex(state, a, b)] > state.turn;
  }

  /* Zapamiętuje turę, w której zaczęła się wojna (do oceny \"zmęczenia wojną\"). */
  function markWarStart(state, a, b) {
    if (!state.warStart) state.warStart = new Int32Array(state.countries.length * state.countries.length);
    const i = GameState.relIndex(state, a, b);
    if (state.warStart[i] <= 0) state.warStart[i] = state.turn;
  }

  /* Ile tur trwa wojna między dwoma państwami. */
  function warAge(state, a, b) {
    if (!state.warStart) return 99;
    const s = state.warStart[GameState.relIndex(state, a, b)];
    return s > 0 ? state.turn - s : 99;
  }

  /* ----------------------------------------------------------- dyplomacja -- */
  function declareWar(state, world, a, b, silent) {
    if (a === b) return { ok: false, reason: 'Nie można wypowiedzieć wojny samemu sobie.' };
    if (!country(state, a).alive || !country(state, b).alive) return { ok: false, reason: 'Państwo nie istnieje.' };
    if (GameState.relation(state, a, b) === REL.WAR) return { ok: false, reason: 'Już jesteście w stanie wojny.' };
    if (truceActive(state, a, b)) return { ok: false, reason: 'Obowiązuje rozejm.' };
    GameState.setRelation(state, a, b, REL.WAR);
    markWarStart(state, a, b);
    if (!silent) {
      log(state, country(state, a).name + ' wypowiada wojnę: ' + country(state, b).name, 'war');
    }
    // sojusznicy obu stron przystępują do wojny
    const N = state.countries.length;
    for (let c = 0; c < N; c++) {
      if (c === a || c === b) continue;
      if (!country(state, c).alive) continue;
      if (GameState.relation(state, c, b) === REL.ALLY) {
        GameState.setRelation(state, c, a, REL.WAR);
        markWarStart(state, c, a);
        if (!silent) log(state, country(state, c).name + ' przystępuje do wojny po stronie ' + country(state, b).name, 'war');
      }
      if (GameState.relation(state, c, a) === REL.ALLY) {
        GameState.setRelation(state, c, b, REL.WAR);
        markWarStart(state, c, b);
        if (!silent) log(state, country(state, c).name + ' przystępuje do wojny po stronie ' + country(state, a).name, 'war');
      }
    }
    // zerwanie sojuszu nie jest potrzebne — sojusznik automatycznie wchodzi w wojnę
    return { ok: true };
  }

  function makePeace(state, a, b, silent) {
    if (GameState.relation(state, a, b) !== REL.WAR) return { ok: false, reason: 'Nie jesteście w stanie wojny.' };
    GameState.setRelation(state, a, b, REL.PEACE);
    if (state.warStart) {
      state.warStart[GameState.relIndex(state, a, b)] = 0;
      state.warStart[GameState.relIndex(state, b, a)] = 0;
    }
    state.truceUntil[GameState.relIndex(state, a, b)] = state.turn + TRUCE_TURNS;
    state.truceUntil[GameState.relIndex(state, b, a)] = state.turn + TRUCE_TURNS;
    if (!silent) log(state, 'Pokój: ' + country(state, a).name + ' i ' + country(state, b).name, 'peace');
    return { ok: true };
  }

  function proposeAlliance(state, a, b, silent) {
    if (GameState.relation(state, a, b) === REL.ALLY) return { ok: false, reason: 'Już jesteście sojusznikami.' };
    if (atWar(state, a, b)) return { ok: false, reason: 'Sojusz nie może powstać w trakcie wojny.' };
    GameState.setRelation(state, a, b, REL.ALLY);
    if (!silent) log(state, 'Sojusz: ' + country(state, a).name + ' i ' + country(state, b).name, 'peace');
    return { ok: true };
  }

  /* Ile "chce" kraj przyjąć pokój (0..1) — używane przez AI i gracza. */
  function peaceWillingness(state, cid, withCid) {
    const c = country(state, cid), o = country(state, withCid);
    if (!c.alive) return 1;
    const ratio = (c.troops + 1) / (o.troops + 1);
    let w = Util.clamp(0.5 + (1 - ratio) * 0.5, 0, 1);
    if (ratio < 0.5) w += 0.25;
    if (ratio > 1.6) w -= 0.35;
    return Util.clamp(w, 0, 1);
  }

  /* ------------------------------------------------------------- działania */
  function recruit(state, pid, amount) {
    const pv = prov(state, pid);
    const c = country(state, pv.country);
    const cap = GameState.maxTroops(state, pid);
    amount = Math.max(0, Math.floor(amount));
    const room = cap - pv.troops;
    if (room <= 0) return { ok: false, reason: 'Prowincja jest przepełniona (' + cap + ' żołnierzy).' };
    amount = Math.min(amount, room);
    const cost = amount * RECRUIT_COST;
    if (c.treasury < cost) return { ok: false, reason: 'Brak środków (potrzeba ' + Util.fmt(cost) + ').' };
    c.treasury -= cost;
    pv.troops += amount;
    recomputeAggregates(state);
    return { ok: true, amount: amount, cost: cost };
  }

  function invest(state, pid) {
    const pv = prov(state, pid);
    const c = country(state, pv.country);
    const cost = Math.round(90 + pv.econ * 3);
    if (pv.econ >= 100) return { ok: false, reason: 'Gospodarka prowincji jest na maksimum.' };
    if (c.treasury < cost) return { ok: false, reason: 'Brak środków (potrzeba ' + Util.fmt(cost) + ').' };
    c.treasury -= cost;
    pv.econ = Math.min(100, pv.econ + 4);
    pv.pop = Math.round(pv.pop * 1.01);
    recomputeAggregates(state);
    return { ok: true, cost: cost, econ: pv.econ };
  }

  function fortify(state, pid) {
    const pv = prov(state, pid);
    const c = country(state, pv.country);
    if (pv.fort >= 5) return { ok: false, reason: 'Fortyfikacje są na maksymalnym poziomie.' };
    const cost = 110 * (pv.fort + 1);
    if (c.treasury < cost) return { ok: false, reason: 'Brak środków (potrzeba ' + Util.fmt(cost) + ').' };
    c.treasury -= cost;
    pv.fort++;
    return { ok: true, cost: cost, fort: pv.fort };
  }

  function move(state, world, fromPid, toPid, amount) {
    const from = prov(state, fromPid), to = prov(state, toPid);
    if (from.country !== to.country) return { ok: false, reason: 'To nie jest twoja prowincja.' };
    if (from.moved) return { ok: false, reason: 'Ta armia już działała w tej turze.' };
    if (!world.provinces[fromPid].neighbors) return { ok: false, reason: 'Brak połączenia.' };
    const adjacent = world.provinces[fromPid].neighbors.indexOf(toPid) >= 0;
    const sea = !adjacent && world.provinces[fromPid].coastal && world.provinces[toPid].coastal &&
      Util.haversineKm(world.provinces[fromPid].centroidLonLat[0], world.provinces[fromPid].centroidLonLat[1],
        world.provinces[toPid].centroidLonLat[0], world.provinces[toPid].centroidLonLat[1]) <= NAVAL_RANGE_KM;
    if (!adjacent && !sea) return { ok: false, reason: 'Prowincje nie sąsiadują ze sobą.' };
    const c = country(state, from.country);
    if (sea) {
      if (c.treasury < NAVAL_COST) return { ok: false, reason: 'Brak środków na transport morski (' + NAVAL_COST + ').' };
      c.treasury -= NAVAL_COST;
    }
    if (amount === undefined || amount === null || amount === 'all') amount = from.troops;
    amount = Util.clamp(Math.floor(amount), 0, from.troops);
    if (amount <= 0) return { ok: false, reason: 'Brak żołnierzy do przeniesienia.' };
    const room = GameState.maxTroops(state, toPid) - to.troops;
    if (room <= 0) return { ok: false, reason: 'Prowincja docelowa jest przepełniona.' };
    amount = Math.min(amount, room);
    from.troops -= amount;
    to.troops += amount;
    from.moved = true;
    recomputeAggregates(state);
    return { ok: true, amount: amount, sea: sea };
  }

  /* ------------------------------------------------------------- bitwy ----- */
  function attackRules(state, world, fromPid, toPid) {
    const from = prov(state, fromPid), to = prov(state, toPid);
    if (from.country === to.country) return { ok: false, reason: 'To twoja prowincja — użyj ruchu.' };
    if (from.moved) return { ok: false, reason: 'Ta armia już działała w tej turze.' };
    if (from.troops <= 0) return { ok: false, reason: 'Brak żołnierzy w prowincji.' };
    const adjacent = world.provinces[fromPid].neighbors.indexOf(toPid) >= 0;
    const dist = Util.haversineKm(world.provinces[fromPid].centroidLonLat[0], world.provinces[fromPid].centroidLonLat[1],
      world.provinces[toPid].centroidLonLat[0], world.provinces[toPid].centroidLonLat[1]);
    const sea = !adjacent && world.provinces[fromPid].coastal && world.provinces[toPid].coastal && dist <= NAVAL_RANGE_KM;
    if (!adjacent && !sea) return { ok: false, reason: 'Brak drogi lądowej ani morskiej do tej prowincji.' };
    if (isAlly(state, from.country, to.country)) return { ok: false, reason: 'To sojusznik — najpierw zerwij sojusz.' };
    if (!atWar(state, from.country, to.country)) {
      return { ok: false, reason: 'Nie jesteś w stanie wojny z ' + country(state, to.country).name + '.', needWar: true };
    }
    const c = country(state, from.country);
    if (sea && c.treasury < NAVAL_COST) return { ok: false, reason: 'Brak środków na desant (' + NAVAL_COST + ').' };
    return { ok: true, sea: sea, dist: dist };
  }

  /* Podgląd siły bitwy (do wyświetlenia graczowi przed atakiem). */
  function battlePreview(state, world, fromPid, toPid, sea) {
    const from = prov(state, fromPid), to = prov(state, toPid);
    const a = country(state, from.country), d = country(state, to.country);
    const aBonus = attackerBonus(state, world, fromPid, toPid) * (sea ? NAVAL_ATTACK_MOD : 1);
    const dBonus = defenderBonus(state, toPid) * (sea ? 1.12 : 1);
    const aPower = from.troops * (a.tech || 1) * (1 + aBonus);
    const dPower = to.troops * (d.tech || 1) * (1 + dBonus);
    return { attacker: Math.round(aPower), defender: Math.round(dPower), aBonus: aBonus, dBonus: dBonus };
  }

  function attackerBonus(state, world, fromPid, toPid) {
    // wsparcie z sąsiednich, obsadzonych prowincji
    const nb = world.provinces[fromPid].neighbors;
    const owner = prov(state, fromPid).country;
    let support = 0;
    for (let i = 0; i < nb.length; i++) {
      const n = prov(state, nb[i]);
      if (n.country === owner && n.troops >= 5 && nb[i] !== toPid) support++;
    }
    return Math.min(0.3, support * 0.07);
  }

  function defenderBonus(state, pid) {
    const pv = prov(state, pid);
    let b = pv.fort * 0.18;
    if (pv.isCapital) b += 0.22;
    return b;
  }

  function attack(state, world, fromPid, toPid) {
    const rules = attackRules(state, world, fromPid, toPid);
    if (!rules.ok) return rules;
    const from = prov(state, fromPid), to = prov(state, toPid);
    const attackerCountry = from.country, defenderCountry = to.country;
    const cA = country(state, attackerCountry), cD = country(state, defenderCountry);
    if (rules.sea) cA.treasury -= NAVAL_COST;

    const aMul = (cA.tech || 1) * (1 + attackerBonus(state, world, fromPid, toPid) * (rules.sea ? NAVAL_ATTACK_MOD : 1));
    const dMul = (cD.tech || 1) * (1 + defenderBonus(state, toPid) * (rules.sea ? 1.12 : 1));

    const rnd = Util.mulberry32((state.rngState = (state.rngState * 1664525 + 1013904223) >>> 0));
    let a = from.troops, d = to.troops;
    const startA = a, startD = d;
    for (let round = 0; round < 4 && a > 0 && d > 0; round++) {
      const aPow = a * aMul, dPow = d * dMul;
      const jitter = 0.9 + rnd() * 0.2;
      const dmgToA = Math.max(1, Math.round(dPow * 0.28 / aMul * jitter));
      const dmgToD = Math.max(1, Math.round(aPow * 0.28 / dMul * jitter));
      a = Math.max(0, a - Math.min(a, dmgToA));
      d = Math.max(0, d - Math.min(d, dmgToD));
    }
    const captured = d <= 0;
    const result = {
      ok: true, captured: captured, sea: rules.sea,
      attackerLosses: startA - a, defenderLosses: startD - d,
      attackerCountry: attackerCountry, defenderCountry: defenderCountry,
      fromPid: fromPid, toPid: toPid
    };
    if (captured) {
      from.troops = 0;
      to.country = attackerCountry;
      to.troops = a;
      to.fort = Math.max(0, Math.floor(to.fort / 2));
      if (to.isCapital) {
        to.isCapital = false;
        if (cD.capitalProvince === toPid) reassignCapital(state, world, defenderCountry);
      }
      const name = world.provinces[toPid].name;
      result.name = name;
      if (attackerCountry === state.playerId) {
        log(state, 'Zajęto ' + name + ' (straty: ' + result.attackerLosses + ')', 'good');
      } else if (defenderCountry === state.playerId) {
        log(state, 'Utracono ' + name + ' na rzecz ' + cA.name + ' (straty: ' + result.defenderLosses + ')', 'bad');
      } else {
        log(state, cA.name + ' zajmuje ' + name + ' (' + cD.name + ')', 'info');
      }
      if (country(state, defenderCountry).alive === false || countProvinces(state, defenderCountry) === 0) {
        log(state, cD.name + ' zostało całkowicie podbite!', 'bad');
      }
    } else {
      to.troops = d;
      from.troops = a;
      // nieudany szturm — armia traci zdolność działania w tej turze
      if (attackerCountry === state.playerId) {
        log(state, 'Szturm na ' + world.provinces[toPid].name + ' odparty (straty: ' + result.attackerLosses + ')', 'bad');
      }
    }
    from.moved = true;
    recomputeAggregates(state);
    return result;
  }

  function countProvinces(state, cid) {
    let n = 0;
    for (let i = 0; i < state.provinces.length; i++) if (state.provinces[i].country === cid) n++;
    return n;
  }

  function reassignCapital(state, world, cid) {
    let best = -1, bestPop = -1;
    for (let i = 0; i < state.provinces.length; i++) {
      if (state.provinces[i].country !== cid) continue;
      if (state.provinces[i].pop > bestPop) { bestPop = state.provinces[i].pop; best = i; }
    }
    country(state, cid).capitalProvince = best;
    if (best >= 0) state.provinces[best].isCapital = true;
  }

  /* ------------------------------------------------------------- tura ------ */
  function beginPlayerTurn(state, world) {
    recomputeAggregates(state);
    for (let i = 0; i < state.provinces.length; i++) state.provinces[i].moved = false;
  }

  function endTurn(state, world) {
    state.turn++;
    state.year++;
    const dif = state.difficultyInfo || GameState.DIFFICULTY.normal;

    // 1. AI
    if (window.AI && state.countries[state.playerId].alive) {
      AI.playAll(state, world, dif);
    }

    recomputeAggregates(state);

    // 2. gospodarka
    for (let i = 0; i < state.countries.length; i++) {
      const c = state.countries[i];
      if (!c.alive) continue;
      let income = c.income;
      if (c.isPlayer) income = Math.round(income * dif.playerIncome);
      const upkeep = Math.round(c.upkeep * (c.isPlayer ? dif.playerUpkeep : 1));
      c.treasury += income - upkeep;
      if (c.treasury < 0) {
        c.treasury = 0;
        for (let p = 0; p < state.provinces.length; p++) {
          const pv = state.provinces[p];
          if (pv.country !== c.id) continue;
          pv.troops = Math.floor(pv.troops * 0.93);
          pv.econ = Math.max(3, pv.econ - 1.5);
        }
        if (c.isPlayer) log(state, 'Skarbiec pusty! Dezercje i spadek gospodarki.', 'bad');
      }
    }

    // 3. wzrost ludności i gospodarki
    for (let i = 0; i < state.provinces.length; i++) {
      const pv = state.provinces[i];
      pv.pop = Math.round(pv.pop * (1.004 + pv.econ * 0.00004));
      pv.econ = Math.min(100, pv.econ + (pv.econ < 40 ? 0.14 : 0.07));
    }

    // 4. oferty dyplomatyczne wygasają po turze
    state.offers = (state.offers || []).filter(function (o) { return o.turn >= state.turn - 1; });

    // 5. nowa tura
    for (let i = 0; i < state.provinces.length; i++) state.provinces[i].moved = false;
    recomputeAggregates(state);

    // 6. koniec gry?
    const pl = state.countries[state.playerId];
    if (!pl.alive || pl.provinceCount === 0) {
      state.gameOver = 'defeat';
    } else {
      const share = pl.provinceCount / state.provinces.length;
      state.worldShare = share;
      const start = state.playerStartProvinces || pl.provinceCount;
      if (!state.gameOver) {
        if (share >= 0.5) state.gameOver = 'victory';
        else if (pl.provinceCount >= start * 3 && share >= 0.05 && rankOf(state, state.playerId) <= 3) {
          state.gameOver = 'victory-power';
        }
      }
      // kamienie milowe
      const ms = state.milestones || (state.milestones = {});
      const marks = [[0.05, 'Mocarstwo regionalne — 5% świata!'], [0.1, 'Wielkie mocarstwo — 10% świata!'], [0.25, 'Superpotęga — 25% świata!']];
      for (let i = 0; i < marks.length; i++) {
        const key = 'm' + Math.round(marks[i][0] * 100);
        if (!ms[key] && share >= marks[i][0]) {
          ms[key] = 1;
          if (pl.isPlayer || true) log(state, marks[i][1], 'good');
        }
      }
    }
    return true;
  }

  return {
    REL: REL,
    ECONOMY_SCALE: ECONOMY_SCALE, RECRUIT_COST: RECRUIT_COST,
    NAVAL_RANGE_KM: NAVAL_RANGE_KM, NAVAL_COST: NAVAL_COST, TRUCE_TURNS: TRUCE_TURNS,
    provinceIncome: provinceIncome,
    recomputeAggregates: recomputeAggregates,
    score: score, ranking: ranking, rankOf: rankOf, log: log,
    atWar: atWar, isAlly: isAlly, truceActive: truceActive, warAge: warAge, markWarStart: markWarStart,
    declareWar: declareWar, makePeace: makePeace, proposeAlliance: proposeAlliance,
    peaceWillingness: peaceWillingness,
    recruit: recruit, invest: invest, fortify: fortify, move: move,
    attackRules: attackRules, attack: attack, battlePreview: battlePreview,
    defenderBonus: defenderBonus, attackerBonus: attackerBonus,
    countProvinces: countProvinces, reassignCapital: reassignCapital,
    beginPlayerTurn: beginPlayerTurn, endTurn: endTurn
  };
})();
