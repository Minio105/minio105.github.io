/* ==========================================================================
   ai.js — proste, ale sensowne AI: rekrutuje, atakuje najsłabsze prowincje,
   wypowiada wojny słabszym sąsiadom, zawiera pokoje i sojusze.
   ========================================================================== */
window.AI = (function () {
  'use strict';

  const REL = GameState.REL;

  function warEnemies(state, cid) {
    const out = [];
    for (let i = 0; i < state.countries.length; i++) {
      if (i === cid) continue;
      if (!state.countries[i].alive) continue;
      if (GameState.relation(state, cid, i) === REL.WAR) out.push(i);
    }
    return out;
  }

  /* Prowincje sąsiadujące z terytorium wroga (albo z żadnym — do obrony). */
  function frontProvinces(state, world, cid, enemies) {
    const enemySet = new Set(enemies);
    const out = [];
    const own = world.countries[cid].provinces;
    for (let i = 0; i < own.length; i++) {
      const pid = own[i];
      if (state.provinces[pid].country !== cid) continue;
      const nb = world.provinces[pid].neighbors;
      for (let j = 0; j < nb.length; j++) {
        const nc = state.provinces[nb[j]].country;
        if (nc !== cid && enemySet.has(nc)) { out.push(pid); break; }
      }
    }
    return out;
  }

  function ownProvinces(state, world, cid) {
    const out = [];
    const list = world.countries[cid].provinces;
    for (let i = 0; i < list.length; i++) {
      if (state.provinces[list[i]].country === cid) out.push(list[i]);
    }
    return out;
  }

  /* Rekrutacja: pakujemy pieniądze w prowincje na froncie, potem w najludniejsze. */
  function recruitPhase(state, world, c, enemies, dif) {
    const front = enemies.length ? frontProvinces(state, world, c.id, enemies) : [];
    let pool = front.length ? front.slice() : ownProvinces(state, world, c.id);
    if (!pool.length) return;
    pool.sort(function (a, b) {
      const pa = state.provinces[a], pb = state.provinces[b];
      const fa = front.indexOf(a) >= 0 ? 1 : 0, fb = front.indexOf(b) >= 0 ? 1 : 0;
      if (fa !== fb) return fb - fa;
      const ra = (GameState.maxTroops(state, a) - pa.troops) * pa.pop;
      const rb = (GameState.maxTroops(state, b) - pb.troops) * pb.pop;
      return rb - ra;
    });
    let budget = c.treasury * (enemies.length ? 0.8 : 0.28);
    budget *= (c.isPlayer ? 1 : 1);
    for (let i = 0; i < pool.length && budget >= Logic.RECRUIT_COST; i++) {
      const pid = pool[i];
      const pv = state.provinces[pid];
      const room = GameState.maxTroops(state, pid) - pv.troops;
      if (room <= 0) continue;
      const maxBuy = Math.floor(budget / Logic.RECRUIT_COST);
      if (maxBuy <= 0) break;
      // duże armie tylko na froncie, w głębi kraju mniejsze uzupełnienia
      const want = front.length
        ? Math.min(room, maxBuy, Math.max(3, Math.round(c.income / 6)))
        : Math.min(room, maxBuy, Math.max(2, Math.round(c.income / 14)));
      const amount = Math.min(want, maxBuy);
      const res = Logic.recruit(state, pid, amount);
      if (res.ok) budget -= res.cost;
      else break;
    }
  }

  function investPhase(state, world, c, rnd) {
    if (c.treasury < 400) return;
    const own = ownProvinces(state, world, c.id);
    if (!own.length) return;
    if (rnd() < 0.6) {
      // inwestycja w najludniejszą prowincję
      own.sort(function (a, b) { return state.provinces[b].pop - state.provinces[a].pop; });
      Logic.invest(state, own[0]);
    } else {
      // fortyfikacja prowincji granicznej (stolica albo losowa)
      const cap = c.capitalProvince;
      const target = (cap >= 0 && state.provinces[cap].country === c.id) ? cap : own[Math.floor(rnd() * own.length)];
      Logic.fortify(state, target);
    }
  }

  /* Główna faza ofensywna. */
  function attackPhase(state, world, c, enemies, rnd, dif) {
    if (!enemies.length) return 0;
    const enemySet = new Set(enemies);
    let attacks = Util.clamp(1 + Math.floor(c.provinceCount / 20), 1, 8);
    if (c.isPlayer) attacks = 0;
    let done = 0;
    const own = ownProvinces(state, world, c.id);
    // najpierw najsilniejsze armie
    own.sort(function (a, b) { return state.provinces[b].troops - state.provinces[a].troops; });

    for (let i = 0; i < own.length && done < attacks; i++) {
      const pid = own[i];
      const pv = state.provinces[pid];
      if (pv.moved || pv.troops < 5) continue;
      const nb = world.provinces[pid].neighbors;
      let bestTarget = -1, bestScore = -1;
      for (let j = 0; j < nb.length; j++) {
        const npid = nb[j];
        const npv = state.provinces[npid];
        if (npv.country === c.id) continue;
        if (!enemySet.has(npv.country)) continue;
        const prev = Logic.battlePreview(state, world, pid, npid, false);
        if (npv.troops === 0) { bestTarget = npid; bestScore = 1e9; break; }
        if (prev.attacker < prev.defender * (1.15 + rnd() * 0.2)) continue;
        const sc = prev.attacker - prev.defender;
        if (sc > bestScore) { bestScore = sc; bestTarget = npid; }
      }
      if (bestTarget >= 0) {
        Logic.attack(state, world, pid, bestTarget);
        done++;
      }
    }
    // desanty morskie — głównie dla państw wyspiarskich i odległych wojen
    if (rnd() < 0.3) {
      done += navalPhase(state, world, c, enemies, rnd, attacks - done);
    }
    return done;
  }

  function navalPhase(state, world, c, enemies, rnd, budget) {
    if (budget <= 0 || c.treasury < Logic.NAVAL_COST * 2) return 0;
    const own = ownProvinces(state, world, c.id);
    const sources = own.filter(function (pid) { return world.provinces[pid].coastal && state.provinces[pid].troops >= 15; });
    if (!sources.length) return 0;
    sources.sort(function (a, b) { return state.provinces[b].troops - state.provinces[a].troops; });
    let done = 0;
    for (let s = 0; s < Math.min(4, sources.length) && done < budget; s++) {
      const src = sources[s];
      const srcGeom = world.provinces[src].centroidLonLat;
      const from = state.provinces[src];
      if (from.moved) continue;
      const enemyCid = enemies[Math.floor(rnd() * enemies.length)];
      const targetList = world.countries[enemyCid].provinces;
      let best = -1, bestTroops = Infinity;
      for (let t = 0; t < targetList.length; t++) {
        const tpid = targetList[t];
        if (!world.provinces[tpid].coastal) continue;
        const tp = state.provinces[tpid];
        if (tp.country !== enemyCid) continue;
        if (tp.troops >= from.troops * 0.75) continue;
        const g = world.provinces[tpid].centroidLonLat;
        if (Util.haversineKm(srcGeom[0], srcGeom[1], g[0], g[1]) > Logic.NAVAL_RANGE_KM) continue;
        if (tp.troops < bestTroops) { bestTroops = tp.troops; best = tpid; }
      }
      if (best >= 0) {
        const res = Logic.attack(state, world, src, best);
        if (res.ok) done++;
      }
    }
    return done;
  }

  /* Dyplomacja AI: wojny, pokoje, sojusze. */
  function diplomacyPhase(state, world, c, enemies, rnd, dif) {
    const N = state.countries.length;

    // 1. pokój, gdy wojna się nie układa
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const age = Logic.warAge(state, c.id, e);
      if (age < 4) continue; // świeża wojna — najpierw walka
      const w = Logic.peaceWillingness(state, c.id, e);
      const wE = Logic.peaceWillingness(state, e, c.id);
      if (w > 0.55 || (w > 0.4 && wE > 0.4) || age > 14) {
        if (state.countries[e].isPlayer) {
          state.offers = state.offers || [];
          if (!state.offers.some(function (o) { return o.from === c.id && o.type === 'peace'; })) {
            state.offers.push({ from: c.id, type: 'peace', turn: state.turn });
            Logic.log(state, c.name + ' proponuje pokój.', 'diplo');
          }
        } else {
          Logic.makePeace(state, c.id, e);
        }
      }
    }

    // 2. nowa wojna
    const activeWars = enemies.length;
    if (activeWars < 4 && rnd() < c.aggression * 0.09 * dif.aiAggression) {
      const nb = GameState.neighborCountries(world, c.id);
      const candidates = [];
      for (let i = 0; i < nb.length; i++) {
        const o = nb[i];
        if (o === c.id) continue;
        if (!state.countries[o].alive) continue;
        const rel = GameState.relation(state, c.id, o);
        if (rel === REL.WAR) continue;
        if (Logic.truceActive(state, c.id, o)) continue;
        const their = Logic.score(state, o);
        const mine = Logic.score(state, c.id);
        if (their > mine * 1.35) continue; // nie atakujemy znacznie silniejszych
        if (their < mine * 0.35 && rnd() < 0.6) continue; // nie ma sensu bić słabeuszy ciągle
        candidates.push({ id: o, score: their, ally: rel === REL.ALLY });
      }
      if (candidates.length) {
        candidates.sort(function (a, b) { return a.score - b.score; });
        const target = candidates[0];
        // sojusznika atakujemy tylko wyjątkowo i najpierw zrywamy sojusz
        if (target.ally && rnd() > 0.22) {
          // nic nie robimy w tej turze
        } else {
          if (state.countries[target.id].isPlayer && rnd() > 0.55) {
            // gracz nie zawsze jest celem
          } else {
            if (target.ally) GameState.setRelation(state, c.id, target.id, REL.PEACE);
            Logic.declareWar(state, world, c.id, target.id);
          }
        }
      }
    }

    // 3. sojusze z silniejszymi sąsiadami (rzadko, maks. 3 sojuszników)
    if (rnd() < 0.006 && countAllies(state, c.id) < 3) {
      const nb = GameState.neighborCountries(world, c.id);
      for (let i = 0; i < nb.length; i++) {
        const o = nb[i];
        if (!state.countries[o].alive || o === c.id) continue;
        if (GameState.relation(state, c.id, o) !== REL.PEACE) continue;
        if (countAllies(state, o) >= 3) continue;
        if (Logic.score(state, o) < Logic.score(state, c.id) * 1.2) continue;
        if (state.countries[o].isPlayer) {
          state.offers = state.offers || [];
          if (!state.offers.some(function (x) { return x.from === c.id && x.type === 'alliance'; })) {
            state.offers.push({ from: c.id, type: 'alliance', turn: state.turn });
            Logic.log(state, c.name + ' proponuje sojusz.', 'diplo');
          }
        } else {
          Logic.proposeAlliance(state, c.id, o);
        }
        break;
      }
    }
  }

  function countAllies(state, cid) {
    let n = 0;
    for (let i = 0; i < state.countries.length; i++) {
      if (i === cid || !state.countries[i].alive) continue;
      if (GameState.relation(state, cid, i) === REL.ALLY) n++;
    }
    return n;
  }

  function playCountry(state, world, cid, dif, rnd) {
    const c = state.countries[cid];
    if (!c || !c.alive || c.isPlayer) return;
    Logic.recomputeAggregates(state);
    const enemies = warEnemies(state, cid);
    recruitPhase(state, world, c, enemies, dif);
    Logic.recomputeAggregates(state);
    if (!enemies.length) {
      if (rnd() < 0.35) investPhase(state, world, c, rnd);
    } else if (c.treasury > 900 && rnd() < 0.3) {
      investPhase(state, world, c, rnd);
    }
    attackPhase(state, world, c, enemies, rnd, dif);
    Logic.recomputeAggregates(state);
    diplomacyPhase(state, world, c, enemies, rnd, dif);
  }

  function playAll(state, world, dif) {
    const rnd = Util.mulberry32(state.rngState = (state.rngState * 22695477 + 1) >>> 0);
    const order = [];
    for (let i = 0; i < state.countries.length; i++) {
      if (i === state.playerId) continue;
      if (state.countries[i].alive) order.push(i);
    }
    // kolejność losowa, ale deterministyczna
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }
    for (let i = 0; i < order.length; i++) playCountry(state, world, order[i], dif, rnd);
    // wygaszanie długich wojen między AI
    const N = state.countries.length;
    for (let a = 0; a < N; a++) {
      if (!state.countries[a].alive) continue;
      for (let b = a + 1; b < N; b++) {
        if (!state.countries[b].alive) continue;
        if (GameState.relation(state, a, b) !== REL.WAR) continue;
        if (state.countries[a].isPlayer || state.countries[b].isPlayer) continue;
        if (Logic.warAge(state, a, b) < 8) continue;
        if (rnd() < 0.06) Logic.makePeace(state, a, b);
      }
    }
  }

  return {
    playAll: playAll,
    playCountry: playCountry,
    warEnemies: warEnemies,
    ownProvinces: ownProvinces,
    frontProvinces: frontProvinces
  };
})();
