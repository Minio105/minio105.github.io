/* ==========================================================================
   ai.js — silnik przeszukiwania: alpha-beta, quiescence, iterative deepening
   oraz poziomy trudności.
   ========================================================================== */
(function (root) {
  'use strict';

  var R = root.ChessRules;
  var MATE = 100000;
  var INF = 1000000000;

  function now() {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
  }

  var LEVELS = [
    { name: 'Nowicjusz', rating: '~450', depth: 1, time: 250, blunder: 0.65, noise: 70, q: false, desc: 'Uczy się grać' },
    { name: 'Łatwy', rating: '~800', depth: 2, time: 450, blunder: 0.32, noise: 40, q: false, desc: 'Spokojna partia' },
    { name: 'Średni', rating: '~1200', depth: 3, time: 900, blunder: 0.10, noise: 15, q: true, desc: 'Równy przeciwnik' },
    { name: 'Trudny', rating: '~1600', depth: 4, time: 1700, blunder: 0, noise: 0, q: true, desc: 'Wymagający' },
    { name: 'Ekspert', rating: '~1950', depth: 5, time: 2800, blunder: 0, noise: 0, q: true, desc: 'Mocna gra' },
    { name: 'Mistrz', rating: '~2200', depth: 6, time: 4500, blunder: 0, noise: 0, q: true, desc: 'Bez litości' }
  ];

  function orderMoves(pos, moves, ctx, ply) {
    var b = pos.board;
    var killer = ctx.killers[ply];
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i], s = 0;
      if (m.captured) s += 1000 + R.VAL[m.captured.toUpperCase()] * 8 - R.VAL[b[m.from].toUpperCase()];
      if (m.promo) s += 900 + R.VAL[m.promo.toUpperCase()];
      if (killer && m.from === killer.from && m.to === killer.to) s += 600;
      m.score = s;
    }
    moves.sort(function (a, b2) { return b2.score - a.score; });
  }

  function evalFor(pos, ctx) {
    return R.evaluate(pos) + (ctx.noise ? (Math.random() * 2 - 1) * ctx.noise : 0);
  }

  function quiesce(pos, alpha, beta, ctx, ply) {
    if (ctx.abort) return 0;
    if ((++ctx.nodes & 255) === 0 && now() >= ctx.deadline) { ctx.abort = true; return 0; }

    var inChk = R.inCheck(pos, pos.turn === R.WHITE);
    var best;

    if (!inChk) {
      best = evalFor(pos, ctx);
      if (best >= beta) return best;
      if (best > alpha) alpha = best;
    } else {
      best = -INF;
    }

    if (ply >= 22) return inChk ? evalFor(pos, ctx) : best;

    var all = R.legalMoves(pos);
    if (!all.length) return inChk ? -MATE + ply : 0;

    var moves = inChk ? all : all.filter(function (m) { return m.captured || m.promo; });
    if (!moves.length) return best;

    orderMoves(pos, moves, ctx, ply);
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var u = R.makeMove(pos, m);
      var sc = -quiesce(pos, -beta, -alpha, ctx, ply + 1);
      R.unmakeMove(pos, m, u);
      if (ctx.abort) return 0;
      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    return best;
  }

  function negamax(pos, depth, alpha, beta, ctx, ply) {
    if (ctx.abort) return 0;
    if ((++ctx.nodes & 255) === 0 && now() >= ctx.deadline) { ctx.abort = true; return 0; }
    if (pos.half >= 100) return 0;
    if (depth <= 0) return ctx.quiesce ? quiesce(pos, alpha, beta, ctx, ply) : evalFor(pos, ctx);

    var moves = R.legalMoves(pos);
    if (!moves.length) return R.inCheck(pos, pos.turn === R.WHITE) ? -MATE + ply : 0;

    orderMoves(pos, moves, ctx, ply);
    var best = -INF;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var u = R.makeMove(pos, m);
      var sc = -negamax(pos, depth - 1, -beta, -alpha, ctx, ply + 1);
      R.unmakeMove(pos, m, u);
      if (ctx.abort) return 0;
      if (sc > best) best = sc;
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) {
        if (!m.captured) ctx.killers[ply] = m;
        break;
      }
    }
    return best;
  }

  /* Wybór ruchu. cfg = wpis z LEVELS (depth, time, blunder, noise, q). */
  function search(pos, cfg) {
    cfg = cfg || {};
    var legal = R.legalMoves(pos);
    if (!legal.length) return null;
    if (legal.length === 1) return { move: legal[0], score: 0, depth: 1, nodes: 1 };

    var ctx = {
      deadline: now() + (cfg.time || 1000),
      nodes: 0,
      abort: false,
      noise: cfg.noise || 0,
      quiesce: cfg.q !== false,
      killers: []
    };

    var ordered = legal.slice();
    var best = legal[0], bestScore = 0, done = 0;

    for (var d = 1; d <= (cfg.depth || 3); d++) {
      var alpha = -INF, localBest = null, localScore = -INF, scored = [];
      for (var i = 0; i < ordered.length; i++) {
        var m = ordered[i];
        var u = R.makeMove(pos, m);
        var sc = -negamax(pos, d - 1, -INF, -alpha, ctx, 1);
        R.unmakeMove(pos, m, u);
        if (ctx.abort) break;
        scored.push({ m: m, sc: sc });
        if (sc > localScore) { localScore = sc; localBest = m; }
        if (sc > alpha) alpha = sc;
      }
      if (ctx.abort || !localBest) break;
      best = localBest;
      bestScore = localScore;
      done = d;
      scored.sort(function (a, b2) { return b2.sc - a.sc; });
      ordered = scored.map(function (x) { return x.m; });
      if (bestScore > MATE - 200 || -bestScore > MATE - 200) break;
      if (now() >= ctx.deadline) break;
    }

    if (cfg.blunder && legal.length > 1 && Math.random() < cfg.blunder) {
      var pool = legal.filter(function (x) { return x.from !== best.from || x.to !== best.to || x.promo !== best.promo; });
      if (pool.length) best = pool[Math.floor(Math.random() * pool.length)];
    }

    return { move: best, score: bestScore, depth: done, nodes: ctx.nodes };
  }

  /* Szybka podpowiedź dla gracza (bez losowości i bez błędów). */
  function hint(pos) {
    return search(pos, { depth: 3, time: 900, blunder: 0, noise: 0, q: true });
  }

  root.ChessAI = {
    LEVELS: LEVELS,
    search: search,
    hint: hint,
    MATE: MATE
  };
})(typeof self !== 'undefined' ? self : this);
