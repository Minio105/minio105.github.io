/* ==========================================================================
   engine.js — zasady szachów: pozycja, generowanie ruchów, ocena pozycji.
   Bez modułów ES: zwykły skrypt, działa też po otwarciu pliku z dysku.
   ========================================================================== */
(function (root) {
  'use strict';

  var WHITE = 'w', BLACK = 'b';
  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var FILES = 'abcdefgh';

  var KNIGHT_D = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  var BISHOP_D = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  var ROOK_D = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var KING_D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

  var VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };

  /* Tablice pozycyjne (indeks 0 = a8, tak jak na diagramie). */
  var PST = {
    P: [
      0, 0, 0, 0, 0, 0, 0, 0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0,
      5, -5, -10, 0, 0, -10, -5, 5,
      5, 10, 10, -20, -20, 10, 10, 5,
      0, 0, 0, 0, 0, 0, 0, 0
    ],
    N: [
      -50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 5, 5, 0, -20, -40,
      -30, 5, 10, 15, 15, 10, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 10, 15, 15, 10, 0, -30,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50
    ],
    B: [
      -20, -10, -10, -10, -10, -10, -10, -20,
      -10, 5, 0, 0, 0, 0, 5, -10,
      -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -20, -10, -10, -10, -10, -10, -10, -20
    ],
    R: [
      0, 0, 0, 5, 5, 0, 0, 0,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      5, 10, 10, 10, 10, 10, 10, 5,
      0, 0, 0, 0, 0, 0, 0, 0
    ],
    Q: [
      -20, -10, -10, -5, -5, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10,
      -20, -10, -10, -5, -5, -10, -10, -20
    ],
    K: [
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20,
      -10, -20, -20, -20, -20, -20, -20, -10,
      20, 20, 0, 0, 0, 0, 20, 20,
      20, 30, 10, 0, 0, 10, 30, 20
    ]
  };

  var PST_K_END = [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50
  ];

  /* ------------------------------- pomocnicze ------------------------------ */
  function fileOf(i) { return i & 7; }
  function rankOf(i) { return i >> 3; }
  function indexOf(r, c) { return (r << 3) | c; }
  function inBoard(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function isWhitePiece(p) { return !!p && p === p.toUpperCase(); }
  function colorOf(p) { return p === p.toUpperCase() ? WHITE : BLACK; }
  function other(c) { return c === WHITE ? BLACK : WHITE; }
  function squareName(i) { return FILES[fileOf(i)] + (8 - rankOf(i)); }
  function squareFromName(name) { return indexOf(8 - Number(name[1]), FILES.indexOf(name[0])); }

  /* --------------------------------- pozycja ------------------------------- */
  function Position(fen) { this.load(fen || START_FEN); }

  Position.prototype.load = function (fen) {
    var parts = String(fen).trim().split(/\s+/);
    var board = new Array(64).fill(null);
    var r = 0, c = 0;
    for (var k = 0; k < parts[0].length; k++) {
      var ch = parts[0][k];
      if (ch === '/') { r++; c = 0; }
      else if (ch >= '1' && ch <= '8') { c += Number(ch); }
      else { board[indexOf(r, c)] = ch; c++; }
    }
    this.board = board;
    this.turn = parts[1] === 'b' ? BLACK : WHITE;
    var rights = parts[2] || '-';
    this.castling = {
      K: rights.indexOf('K') >= 0, Q: rights.indexOf('Q') >= 0,
      k: rights.indexOf('k') >= 0, q: rights.indexOf('q') >= 0
    };
    this.ep = parts[3] && parts[3] !== '-' ? squareFromName(parts[3]) : -1;
    this.half = parts[4] ? Number(parts[4]) : 0;
    this.full = parts[5] ? Number(parts[5]) : 1;
    return this;
  };

  Position.prototype.clone = function () {
    var p = Object.create(Position.prototype);
    p.board = this.board.slice();
    p.turn = this.turn;
    p.castling = { K: this.castling.K, Q: this.castling.Q, k: this.castling.k, q: this.castling.q };
    p.ep = this.ep;
    p.half = this.half;
    p.full = this.full;
    return p;
  };

  /* Klucz pozycji — do wykrywania trzykrotnego powtórzenia. */
  Position.prototype.key = function () {
    var out = '';
    for (var i = 0; i < 64; i++) out += this.board[i] || '.';
    var c = this.castling;
    return out + this.turn + (c.K ? 'K' : '') + (c.Q ? 'Q' : '') +
      (c.k ? 'k' : '') + (c.q ? 'q' : '') + (this.ep >= 0 ? squareName(this.ep) : '-');
  };

  /* ---------------------------- ataki i szach ------------------------------ */
  function isAttacked(board, idx, byWhite) {
    var r = rankOf(idx), c = fileOf(idx), i, p;

    var pawnRow = r + (byWhite ? 1 : -1);
    for (var dc = -1; dc <= 1; dc += 2) {
      if (inBoard(pawnRow, c + dc)) {
        p = board[indexOf(pawnRow, c + dc)];
        if (p === (byWhite ? 'P' : 'p')) return true;
      }
    }
    for (i = 0; i < 8; i++) {
      var rr = r + KNIGHT_D[i][0], cc = c + KNIGHT_D[i][1];
      if (!inBoard(rr, cc)) continue;
      p = board[indexOf(rr, cc)];
      if (p === (byWhite ? 'N' : 'n')) return true;
    }
    for (i = 0; i < 8; i++) {
      rr = r + KING_D[i][0]; cc = c + KING_D[i][1];
      if (!inBoard(rr, cc)) continue;
      p = board[indexOf(rr, cc)];
      if (p === (byWhite ? 'K' : 'k')) return true;
    }
    var bishop = byWhite ? ['B', 'Q'] : ['b', 'q'];
    for (i = 0; i < 4; i++) {
      rr = r + BISHOP_D[i][0]; cc = c + BISHOP_D[i][1];
      while (inBoard(rr, cc)) {
        p = board[indexOf(rr, cc)];
        if (p) { if (bishop.indexOf(p) >= 0) return true; break; }
        rr += BISHOP_D[i][0]; cc += BISHOP_D[i][1];
      }
    }
    var rook = byWhite ? ['R', 'Q'] : ['r', 'q'];
    for (i = 0; i < 4; i++) {
      rr = r + ROOK_D[i][0]; cc = c + ROOK_D[i][1];
      while (inBoard(rr, cc)) {
        p = board[indexOf(rr, cc)];
        if (p) { if (rook.indexOf(p) >= 0) return true; break; }
        rr += ROOK_D[i][0]; cc += ROOK_D[i][1];
      }
    }
    return false;
  }

  function kingIndex(board, white) {
    var target = white ? 'K' : 'k';
    for (var i = 0; i < 64; i++) if (board[i] === target) return i;
    return -1;
  }

  function inCheck(pos, white) {
    var k = kingIndex(pos.board, white);
    return k >= 0 && isAttacked(pos.board, k, !white);
  }

  /* --------------------------- generowanie ruchów -------------------------- */
  function pushPawn(moves, from, to, captured, promoRank, row) {
    if (row !== promoRank) {
      moves.push({ from: from, to: to, captured: captured || null, promo: null, flags: captured ? 'capture' : null });
      return;
    }
    var list = ['q', 'r', 'b', 'n'];
    for (var i = 0; i < list.length; i++) {
      moves.push({ from: from, to: to, captured: captured || null, promo: list[i], flags: 'promo' });
    }
  }

  function pseudoMoves(pos) {
    var moves = [];
    var b = pos.board, white = pos.turn === WHITE;

    for (var i = 0; i < 64; i++) {
      var p = b[i];
      if (!p || isWhitePiece(p) !== white) continue;
      var t = p.toUpperCase();
      var r = rankOf(i), c = fileOf(i), k, rr, cc, to, target;

      if (t === 'P') {
        var dir = white ? -1 : 1;
        var promoRank = white ? 0 : 7;
        var oneRow = r + dir;
        if (inBoard(oneRow, c) && !b[indexOf(oneRow, c)]) {
          pushPawn(moves, i, indexOf(oneRow, c), null, promoRank, oneRow);
          var twoRow = r + 2 * dir;
          if (r === (white ? 6 : 1) && !b[indexOf(twoRow, c)]) {
            moves.push({ from: i, to: indexOf(twoRow, c), captured: null, promo: null, flags: 'double' });
          }
        }
        for (k = -1; k <= 1; k += 2) {
          rr = r + dir; cc = c + k;
          if (!inBoard(rr, cc)) continue;
          to = indexOf(rr, cc);
          target = b[to];
          if (target && isWhitePiece(target) !== white) {
            pushPawn(moves, i, to, target, promoRank, rr);
          } else if (!target && to === pos.ep) {
            moves.push({ from: i, to: to, captured: white ? 'p' : 'P', promo: null, flags: 'ep' });
          }
        }
      } else if (t === 'N') {
        for (k = 0; k < 8; k++) {
          rr = r + KNIGHT_D[k][0]; cc = c + KNIGHT_D[k][1];
          if (!inBoard(rr, cc)) continue;
          to = indexOf(rr, cc); target = b[to];
          if (target && isWhitePiece(target) === white) continue;
          moves.push({ from: i, to: to, captured: target || null, promo: null, flags: target ? 'capture' : null });
        }
      } else if (t === 'K') {
        for (k = 0; k < 8; k++) {
          rr = r + KING_D[k][0]; cc = c + KING_D[k][1];
          if (!inBoard(rr, cc)) continue;
          to = indexOf(rr, cc); target = b[to];
          if (target && isWhitePiece(target) === white) continue;
          moves.push({ from: i, to: to, captured: target || null, promo: null, flags: target ? 'capture' : null });
        }
        if (white) {
          if (pos.castling.K && b[60] === 'K' && b[63] === 'R' && !b[61] && !b[62] &&
            !isAttacked(b, 60, false) && !isAttacked(b, 61, false) && !isAttacked(b, 62, false)) {
            moves.push({ from: 60, to: 62, captured: null, promo: null, flags: 'castleK' });
          }
          if (pos.castling.Q && b[60] === 'K' && b[56] === 'R' && !b[59] && !b[58] && !b[57] &&
            !isAttacked(b, 60, false) && !isAttacked(b, 59, false) && !isAttacked(b, 58, false)) {
            moves.push({ from: 60, to: 58, captured: null, promo: null, flags: 'castleQ' });
          }
        } else {
          if (pos.castling.k && b[4] === 'k' && b[7] === 'r' && !b[5] && !b[6] &&
            !isAttacked(b, 4, true) && !isAttacked(b, 5, true) && !isAttacked(b, 6, true)) {
            moves.push({ from: 4, to: 6, captured: null, promo: null, flags: 'castleK' });
          }
          if (pos.castling.q && b[4] === 'k' && b[0] === 'r' && !b[3] && !b[2] && !b[1] &&
            !isAttacked(b, 4, true) && !isAttacked(b, 3, true) && !isAttacked(b, 2, true)) {
            moves.push({ from: 4, to: 2, captured: null, promo: null, flags: 'castleQ' });
          }
        }
      } else {
        var dirs = t === 'B' ? BISHOP_D : t === 'R' ? ROOK_D : KING_D;
        for (k = 0; k < dirs.length; k++) {
          rr = r + dirs[k][0]; cc = c + dirs[k][1];
          while (inBoard(rr, cc)) {
            to = indexOf(rr, cc); target = b[to];
            if (target) {
              if (isWhitePiece(target) !== white) {
                moves.push({ from: i, to: to, captured: target, promo: null, flags: 'capture' });
              }
              break;
            }
            moves.push({ from: i, to: to, captured: null, promo: null, flags: null });
            rr += dirs[k][0]; cc += dirs[k][1];
          }
        }
      }
    }
    return moves;
  }

  /* ------------------------------ wykonanie ruchu -------------------------- */
  function makeMove(pos, m) {
    var b = pos.board;
    var piece = b[m.from];
    var white = isWhitePiece(piece);
    var undo = {
      moved: piece, captured: null, capturedSq: -1,
      ep: pos.ep, half: pos.half, full: pos.full,
      castling: { K: pos.castling.K, Q: pos.castling.Q, k: pos.castling.k, q: pos.castling.q }
    };

    var capSq = m.flags === 'ep' ? m.to + (white ? 8 : -8) : m.to;
    undo.captured = b[capSq] || null;
    undo.capturedSq = capSq;

    b[m.from] = null;
    if (undo.captured) b[capSq] = null;

    if (m.flags === 'castleK') {
      if (white) { b[63] = null; b[61] = 'R'; } else { b[7] = null; b[5] = 'r'; }
    } else if (m.flags === 'castleQ') {
      if (white) { b[56] = null; b[59] = 'R'; } else { b[0] = null; b[3] = 'r'; }
    }

    b[m.to] = m.promo ? (white ? m.promo.toUpperCase() : m.promo) : piece;

    if (piece === 'K') { pos.castling.K = false; pos.castling.Q = false; }
    if (piece === 'k') { pos.castling.k = false; pos.castling.q = false; }
    if (m.from === 63 || m.to === 63) pos.castling.K = false;
    if (m.from === 56 || m.to === 56) pos.castling.Q = false;
    if (m.from === 7 || m.to === 7) pos.castling.k = false;
    if (m.from === 0 || m.to === 0) pos.castling.q = false;

    pos.ep = m.flags === 'double' ? (m.from + m.to) / 2 : -1;
    if (piece.toUpperCase() === 'P' || undo.captured) pos.half = 0; else pos.half++;
    if (!white) pos.full++;
    pos.turn = other(pos.turn);
    return undo;
  }

  function unmakeMove(pos, m, undo) {
    var b = pos.board;
    pos.turn = other(pos.turn);
    var white = pos.turn === WHITE;
    pos.ep = undo.ep;
    pos.half = undo.half;
    pos.full = undo.full;
    pos.castling = undo.castling;

    b[m.to] = null;
    b[m.from] = undo.moved;
    if (undo.captured) b[undo.capturedSq] = undo.captured;

    if (m.flags === 'castleK') {
      if (white) { b[61] = null; b[63] = 'R'; } else { b[5] = null; b[7] = 'r'; }
    } else if (m.flags === 'castleQ') {
      if (white) { b[59] = null; b[56] = 'R'; } else { b[3] = null; b[0] = 'r'; }
    }
  }

  function legalMoves(pos) {
    var white = pos.turn === WHITE;
    var pseudo = pseudoMoves(pos);
    var legal = [];
    for (var i = 0; i < pseudo.length; i++) {
      var m = pseudo[i];
      var undo = makeMove(pos, m);
      if (!inCheck(pos, white)) legal.push(m);
      unmakeMove(pos, m, undo);
    }
    return legal;
  }

  function legalMovesFrom(pos, from) {
    return legalMoves(pos).filter(function (m) { return m.from === from; });
  }

  /* --------------------------------- ocena --------------------------------- */
  function evaluate(pos) {
    var b = pos.board;
    var white = 0, black = 0, nonPawn = 0, wb = 0, bb = 0;
    var i, p, t;

    for (i = 0; i < 64; i++) {
      p = b[i];
      if (!p) continue;
      t = p.toUpperCase();
      if (t !== 'P' && t !== 'K') nonPawn += VAL[t];
      if (t === 'B') { if (isWhitePiece(p)) wb++; else bb++; }
    }

    var endgame = nonPawn < 1400;
    for (i = 0; i < 64; i++) {
      p = b[i];
      if (!p) continue;
      var isWhite = isWhitePiece(p);
      t = p.toUpperCase();
      var table = t === 'K' ? (endgame ? PST_K_END : PST.K) : PST[t];
      var value = VAL[t] + table[isWhite ? i : (i ^ 56)];
      if (isWhite) white += value; else black += value;
    }

    if (wb >= 2) white += 30;
    if (bb >= 2) black -= 30;

    var score = white - black + (pos.turn === WHITE ? 12 : -12);
    return pos.turn === WHITE ? score : -score;
  }

  /* --------------------------- remisy materialowe -------------------------- */
  function insufficientMaterial(pos) {
    var pieces = [];
    var i, p;
    for (i = 0; i < 64; i++) {
      p = pos.board[i];
      if (p) pieces.push({ p: p, i: i });
    }
    if (pieces.length > 4) return false;
    var minor = pieces.filter(function (x) { return x.p.toUpperCase() !== 'K'; });
    if (minor.length === 0) return true;
    if (minor.length === 1) return minor[0].p.toUpperCase() === 'N' || minor[0].p.toUpperCase() === 'B';
    if (minor.length === 2) {
      var bothBishops = minor.every(function (x) { return x.p.toUpperCase() === 'B'; });
      if (!bothBishops) return false;
      var c0 = (fileOf(minor[0].i) + rankOf(minor[0].i)) & 1;
      var c1 = (fileOf(minor[1].i) + rankOf(minor[1].i)) & 1;
      return c0 === c1;
    }
    return false;
  }

  /* ------------------------------- notacja SAN ----------------------------- */
  function san(pos, m) {
    var piece = pos.board[m.from];
    var white = isWhitePiece(piece);
    var t = piece.toUpperCase();
    var base;

    if (m.flags === 'castleK') base = 'O-O';
    else if (m.flags === 'castleQ') base = 'O-O-O';
    else {
      base = '';
      if (t !== 'P') {
        base += t;
        var all = legalMoves(pos);
        var rivals = all.filter(function (x) {
          if (x.to !== m.to || x.from === m.from) return false;
          var q = pos.board[x.from];
          return q && q.toUpperCase() === t && isWhitePiece(q) === white;
        });
        if (rivals.length) {
          var sameFile = rivals.some(function (x) { return fileOf(x.from) === fileOf(m.from); });
          var sameRank = rivals.some(function (x) { return rankOf(x.from) === rankOf(m.from); });
          if (!sameFile) base += FILES[fileOf(m.from)];
          else if (!sameRank) base += String(8 - rankOf(m.from));
          else base += squareName(m.from);
        }
      } else if (m.captured) {
        base += FILES[fileOf(m.from)];
      }
      if (m.captured) base += 'x';
      base += squareName(m.to);
      if (m.promo) base += '=' + m.promo.toUpperCase();
    }

    var undo = makeMove(pos, m);
    var givesCheck = inCheck(pos, pos.turn === WHITE);
    var hasReply = givesCheck ? legalMoves(pos).length > 0 : true;
    unmakeMove(pos, m, undo);

    if (givesCheck) base += hasReply ? '+' : '#';
    return base;
  }

  var R = {
    WHITE: WHITE, BLACK: BLACK, START_FEN: START_FEN, FILES: FILES,
    VAL: VAL, PST: PST, PST_K_END: PST_K_END,
    fileOf: fileOf, rankOf: rankOf, indexOf: indexOf, inBoard: inBoard,
    isWhitePiece: isWhitePiece, colorOf: colorOf, other: other,
    squareName: squareName, squareFromName: squareFromName,
    Position: Position, isAttacked: isAttacked, inCheck: inCheck,
    kingIndex: kingIndex, pseudoMoves: pseudoMoves,
    makeMove: makeMove, unmakeMove: unmakeMove,
    legalMoves: legalMoves, legalMovesFrom: legalMovesFrom,
    evaluate: evaluate, insufficientMaterial: insufficientMaterial, san: san
  };

  root.ChessRules = R;
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof self !== 'undefined' ? self : this);
