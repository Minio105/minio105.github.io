/* ==========================================================================
   app.js — interfejs gry: plansza, sterowanie, przebieg partii, AI
   ========================================================================== */
(function () {
  'use strict';

  var R = window.ChessRules;
  var AI = window.ChessAI;

  var GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
  var INITIAL_COUNT = { P: 8, N: 2, B: 2, R: 2, Q: 1, K: 1 };
  var VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

  var boardEl = document.getElementById('board');
  var movesEl = document.getElementById('moves');
  var statusTitleEl = document.getElementById('statusTitle');
  var statusSubEl = document.getElementById('statusSub');
  var statusDotEl = document.getElementById('statusDot');
  var capturedTopEl = document.getElementById('capturedTop');
  var capturedBottomEl = document.getElementById('capturedBottom');
  var materialTopEl = document.getElementById('materialTop');
  var materialBottomEl = document.getElementById('materialBottom');
  var nameTopEl = document.getElementById('nameTop');
  var levelBadgeTopEl = document.getElementById('levelBadgeTop');
  var sideBadgeEl = document.getElementById('sideBadge');
  var levelRatingEl = document.getElementById('levelRating');
  var levelListEl = document.getElementById('levelList');
  var startLevelsEl = document.getElementById('startLevels');
  var startOverlayEl = document.getElementById('startOverlay');
  var resultOverlayEl = document.getElementById('resultOverlay');
  var resultIconEl = document.getElementById('resultIcon');
  var resultTitleEl = document.getElementById('resultTitle');
  var resultSubEl = document.getElementById('resultSub');
  var promoOverlayEl = document.getElementById('promoOverlay');
  var promoOptionsEl = document.getElementById('promoOptions');
  var colorChoicesEl = document.getElementById('colorChoices');
  var undoBtn = document.getElementById('undoBtn');
  var hintBtn = document.getElementById('hintBtn');
  var soundBtn = document.getElementById('soundBtn');
  var toastEl = document.getElementById('toast');

  var S = {
    pos: new R.Position(),
    human: 'w',
    orientation: 'w',
    level: 2,
    history: [],
    selected: -1,
    targets: [],
    lastMove: null,
    over: false,
    thinking: false,
    hintBusy: false,
    gameId: 0,
    sound: true,
    hintCells: null,
    promoMoves: null,
    resultTitle: '',
    resultSub: ''
  };

  var squareEls = [];
  var newColorChoice = 'w';
  var toastTimer = null;
  var hintTimer = null;

  /* -------------------------------- dźwięk -------------------------------- */
  var actx = null;

  function audioCtx() {
    if (actx) return actx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try { actx = new Ctx(); } catch (e) { actx = null; }
    return actx;
  }

  function beep(freq, dur, type, vol, delay) {
    var ctx = audioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
    var t = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  function playSound(kind) {
    if (!S.sound) return;
    if (kind === 'move') beep(320, 0.07, 'triangle', 0.045);
    else if (kind === 'capture') { beep(190, 0.08, 'square', 0.035); beep(120, 0.11, 'triangle', 0.05, 0.035); }
    else if (kind === 'check') { beep(700, 0.08, 'sine', 0.05); beep(920, 0.1, 'sine', 0.045, 0.09); }
    else if (kind === 'win') { beep(523, 0.12, 'sine', 0.06); beep(659, 0.12, 'sine', 0.06, 0.11); beep(784, 0.2, 'sine', 0.06, 0.22); }
    else if (kind === 'lose') { beep(320, 0.14, 'sine', 0.05); beep(240, 0.2, 'sine', 0.05, 0.13); }
    else if (kind === 'select') beep(460, 0.025, 'sine', 0.022);
  }

  function toast(message, ms) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2400);
  }

  /* ------------------------------ szachownica ------------------------------ */
  function buildBoard() {
    boardEl.innerHTML = '';
    squareEls = [];
    for (var dr = 0; dr < 8; dr++) {
      for (var dc = 0; dc < 8; dc++) {
        var idx = S.orientation === 'w' ? dr * 8 + dc : 63 - (dr * 8 + dc);
        var el = document.createElement('div');
        var light = (R.fileOf(idx) + R.rankOf(idx)) % 2 === 0;
        el.className = 'square ' + (light ? 'light' : 'dark');
        el.dataset.idx = String(idx);

        if (dr === 7) {
          var f = document.createElement('span');
          f.className = 'coord file';
          f.textContent = R.FILES[R.fileOf(idx)];
          el.appendChild(f);
        }
        if (dc === 0) {
          var rk = document.createElement('span');
          rk.className = 'coord rank';
          rk.textContent = String(8 - R.rankOf(idx));
          el.appendChild(rk);
        }

        boardEl.appendChild(el);
        squareEls.push(el);
      }
    }
    resizePieces();
  }

  function squareFor(idx) {
    for (var i = 0; i < squareEls.length; i++) {
      if (Number(squareEls[i].dataset.idx) === idx) return squareEls[i];
    }
    return null;
  }

  function resizePieces() {
    var width = boardEl.clientWidth;
    if (width) boardEl.style.setProperty('--sq', (width / 8) + 'px');
  }

  function paint() {
    var pos = S.pos;
    var last = S.lastMove;
    var checkIdx = -1;
    if (R.inCheck(pos, pos.turn === 'w')) checkIdx = R.kingIndex(pos.board, pos.turn === 'w');

    var targetMap = {};
    for (var t = 0; t < S.targets.length; t++) {
      var mv = S.targets[t];
      var isCap = !!mv.captured;
      targetMap[mv.to] = targetMap[mv.to] || isCap;
      if (isCap) targetMap[mv.to] = true;
    }

    for (var i = 0; i < squareEls.length; i++) {
      var el = squareEls[i];
      var idx = Number(el.dataset.idx);
      var light = (R.fileOf(idx) + R.rankOf(idx)) % 2 === 0;
      var cls = 'square ' + (light ? 'light' : 'dark');

      if (last && (idx === last.from || idx === last.to)) cls += ' last';
      if (idx === S.selected) cls += ' selected';
      if (targetMap[idx] !== undefined) cls += targetMap[idx] ? ' target capture' : ' target';
      if (idx === checkIdx) cls += ' check';
      if (S.hintCells && (idx === S.hintCells.from || idx === S.hintCells.to)) cls += ' hint';
      el.className = cls;

      var old = el.querySelectorAll('.piece');
      for (var k = 0; k < old.length; k++) old[k].parentNode.removeChild(old[k]);

      var p = pos.board[idx];
      if (!p) continue;
      var span = document.createElement('span');
      span.className = 'piece ' + (R.isWhitePiece(p) ? 'w' : 'b');
      span.textContent = GLYPH[p.toUpperCase()];
      el.appendChild(span);
    }
  }

  function animateMove(m) {
    var el = squareFor(m.to);
    if (!el) return;
    var piece = el.querySelector('.piece');
    if (!piece || !piece.animate) return;
    var dr = R.rankOf(m.from) - R.rankOf(m.to);
    var dc = R.fileOf(m.from) - R.fileOf(m.to);
    var dir = S.orientation === 'w' ? 1 : -1;
    var from = 'translate(' + (dc * 100 * dir) + '%, ' + (dr * 100 * dir) + '%)';
    piece.animate(
      [{ transform: from, zIndex: 3 }, { transform: 'translate(0, 0)', zIndex: 3 }],
      { duration: 180, easing: 'cubic-bezier(0.2, 0.75, 0.3, 1)' }
    );
  }

  /* --------------------------------- widok --------------------------------- */
  function countPieces(board) {
    var res = { w: {}, b: {} };
    ['P', 'N', 'B', 'R', 'Q', 'K'].forEach(function (t) { res.w[t] = 0; res.b[t] = 0; });
    for (var i = 0; i < 64; i++) {
      var p = board[i];
      if (!p) continue;
      var side = R.isWhitePiece(p) ? 'w' : 'b';
      res[side][p.toUpperCase()]++;
    }
    return res;
  }

  function fillCaptured(el, capturedColor) {
    var counts = countPieces(S.pos.board);
    el.innerHTML = '';
    ['Q', 'R', 'B', 'N', 'P'].forEach(function (t) {
      var missing = INITIAL_COUNT[t] - counts[capturedColor][t];
      for (var i = 0; i < missing; i++) {
        var sp = document.createElement('span');
        sp.className = capturedColor === 'w' ? 'cap-w' : 'cap-b';
        sp.textContent = GLYPH[t];
        el.appendChild(sp);
      }
    });
  }

  function materialScore() {
    var counts = countPieces(S.pos.board);
    var w = 0, b = 0, t;
    for (t in VALUE) {
      if (!VALUE.hasOwnProperty(t)) continue;
      w += counts.w[t] * VALUE[t];
      b += counts.b[t] * VALUE[t];
    }
    return { w: w, b: b };
  }

  function renderCaptured() {
    var aiColor = R.other(S.human);
    fillCaptured(capturedTopEl, S.human);
    fillCaptured(capturedBottomEl, aiColor);

    var mat = materialScore();
    var aiMat = aiColor === 'w' ? mat.w : mat.b;
    var myMat = S.human === 'w' ? mat.w : mat.b;
    var diff = aiMat - myMat;
    materialTopEl.textContent = diff > 0 ? '+' + diff : '';
    materialBottomEl.textContent = diff < 0 ? '+' + (-diff) : '';
  }

  function renderMoves() {
    movesEl.innerHTML = '';
    if (!S.history.length) {
      var empty = document.createElement('div');
      empty.className = 'moves-empty';
      empty.textContent = 'Ruchy pojawią się tutaj.';
      movesEl.appendChild(empty);
      return;
    }
    var lastIdx = S.history.length - 1;
    for (var i = 0; i < S.history.length; i += 2) {
      var row = document.createElement('div');
      row.className = 'move-row';

      var no = document.createElement('span');
      no.className = 'move-no';
      no.textContent = (i / 2 + 1) + '.';

      var w = document.createElement('span');
      w.className = 'move-san';
      w.textContent = S.history[i] ? S.history[i].san : '';
      if (i === lastIdx) w.classList.add('last');

      var b = document.createElement('span');
      b.className = 'move-san';
      b.textContent = S.history[i + 1] ? S.history[i + 1].san : '';
      if (i + 1 === lastIdx) b.classList.add('last');

      row.appendChild(no);
      row.appendChild(w);
      row.appendChild(b);
      movesEl.appendChild(row);
    }
    movesEl.scrollTop = movesEl.scrollHeight;
  }

  function renderStatus() {
    var dot = '', title = '', sub = '';
    if (S.over) {
      dot = 'over';
      title = S.resultTitle;
      sub = S.resultSub;
    } else if (S.thinking) {
      dot = 'thinking';
      title = 'AI myśli…';
      sub = 'Silnik analizuje pozycję';
    } else if (S.hintBusy) {
      dot = 'thinking';
      title = 'Analizuję…';
      sub = 'Szukam najlepszego ruchu';
    } else {
      var inChk = R.inCheck(S.pos, S.pos.turn === 'w');
      if (S.pos.turn === S.human) {
        dot = inChk ? 'check' : '';
        title = inChk ? 'Szach!' : 'Twój ruch';
        sub = inChk ? 'Musisz obronić króla' : 'Wybierz figurę i wskaż pole';
      } else {
        dot = 'thinking';
        title = 'Ruch AI';
        sub = 'Przeciwnik wykonuje posunięcie';
      }
    }
    statusDotEl.className = 'status-dot' + (dot ? ' ' + dot : '');
    statusTitleEl.textContent = title;
    statusSubEl.textContent = sub;
  }

  function renderButtons() {
    var hasHumanMove = S.history.some(function (r) { return r.byHuman; });
    undoBtn.disabled = S.thinking || S.hintBusy || S.over || !hasHumanMove;
    hintBtn.disabled = S.thinking || S.hintBusy || S.over || S.pos.turn !== S.human;
  }

  function render() {
    updateLevelUI();
    paint();
    renderCaptured();
    renderMoves();
    renderStatus();
    renderButtons();
    refreshLevels();
  }

  /* -------------------------------- poziomy -------------------------------- */
  function updateLevelUI() {
    var cfg = AI.LEVELS[S.level];
    levelBadgeTopEl.textContent = cfg.name;
    levelRatingEl.textContent = cfg.rating;
    nameTopEl.textContent = 'Silnik AI';
    sideBadgeEl.textContent = S.human === 'w' ? 'białe' : 'czarne';
  }

  function buildLevelButtons(container, onPick) {
    container.innerHTML = '';
    AI.LEVELS.forEach(function (cfg, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'level-btn';
      b.dataset.level = String(i);
      b.title = cfg.desc;

      var n = document.createElement('span');
      n.className = 'lvl-name';
      n.textContent = cfg.name;

      var r = document.createElement('span');
      r.className = 'lvl-rating';
      r.textContent = cfg.rating;

      b.appendChild(n);
      b.appendChild(r);
      b.addEventListener('click', function () { onPick(i); });
      container.appendChild(b);
    });
  }

  function refreshLevels() {
    [levelListEl, startLevelsEl].forEach(function (box) {
      var buttons = box.querySelectorAll('.level-btn');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle('active', Number(buttons[i].dataset.level) === S.level);
      }
    });
  }

  function pickLevel(i) {
    S.level = i;
    try { localStorage.setItem('szachy.level', String(i)); } catch (e) { }
    updateLevelUI();
    refreshLevels();
    toast('Poziom: ' + AI.LEVELS[i].name + ' (' + AI.LEVELS[i].rating + ')');
    renderStatus();
  }

  /* ------------------------------- koniec gry ------------------------------ */
  function repetitions() {
    var key = S.pos.key();
    var n = 1;
    for (var i = 0; i < S.history.length; i++) {
      if (S.history[i].snapshot.key() === key) n++;
    }
    return n;
  }

  function detectEnd() {
    var pos = S.pos;
    var moves = R.legalMoves(pos);
    if (!moves.length) {
      if (R.inCheck(pos, pos.turn === 'w')) {
        return { winner: R.other(pos.turn), reason: 'Szach mat' };
      }
      return { winner: null, reason: 'Pat — brak legalnych ruchów' };
    }
    if (pos.half >= 100) return { winner: null, reason: 'Remis — reguła 50 posunięć' };
    if (R.insufficientMaterial(pos)) return { winner: null, reason: 'Remis — niewystarczający materiał' };
    if (repetitions() >= 3) return { winner: null, reason: 'Remis — trzykrotne powtórzenie pozycji' };
    return null;
  }

  function finish(end) {
    S.over = true;
    S.thinking = false;
    S.selected = -1;
    S.targets = [];
    S.hintCells = null;
    clearTimeout(hintTimer);

    if (end.winner === null) {
      S.resultTitle = 'Remis';
      S.resultSub = end.reason;
      resultIconEl.textContent = '🤝';
      resultIconEl.className = 'result-icon draw';
      playSound('check');
    } else if (end.winner === S.human) {
      S.resultTitle = 'Zwycięstwo!';
      S.resultSub = end.reason;
      resultIconEl.textContent = '🏆';
      resultIconEl.className = 'result-icon';
      playSound('win');
    } else {
      S.resultTitle = 'Porażka';
      S.resultSub = end.reason;
      resultIconEl.textContent = '😔';
      resultIconEl.className = 'result-icon lose';
      playSound('lose');
    }

    render();

    setTimeout(function () {
      if (!S.over) return;
      resultTitleEl.textContent = S.resultTitle;
      resultSubEl.textContent = S.resultSub;
      resultOverlayEl.classList.remove('hidden');
    }, 600);
  }

  /* -------------------------------- rozgrywka ------------------------------ */
  function applyMove(move, byHuman) {
    var pos = S.pos;
    var sanText = R.san(pos, move);
    var snapshot = pos.clone();
    var wasCapture = !!move.captured;

    R.makeMove(pos, move);
    S.history.push({ move: move, san: sanText, snapshot: snapshot, byHuman: !!byHuman });
    S.lastMove = move;
    S.selected = -1;
    S.targets = [];
    S.hintCells = null;
    clearTimeout(hintTimer);

    paint();
    animateMove(move);
    renderCaptured();
    renderMoves();
    refreshLevels();
    updateLevelUI();

    var end = detectEnd();
    if (end) { finish(end); return; }

    if (R.inCheck(pos, pos.turn === 'w')) playSound('check');
    else playSound(wasCapture ? 'capture' : 'move');

    renderStatus();
    renderButtons();

    if (pos.turn !== S.human) aiTurn();
  }

  function aiTurn() {
    if (S.over || S.thinking || S.pos.turn === S.human) return;
    var myGame = S.gameId;
    var cfg = AI.LEVELS[S.level];

    S.thinking = true;
    renderStatus();
    renderButtons();

    setTimeout(function () {
      if (myGame !== S.gameId || S.over) { S.thinking = false; return; }
      var started = Date.now();
      var res = null;
      try { res = AI.search(S.pos, cfg); } catch (err) { res = null; }
      var wait = Math.max(0, 420 - (Date.now() - started));

      setTimeout(function () {
        if (myGame !== S.gameId) return;
        S.thinking = false;
        if (!res || S.over) { render(); return; }
        applyMove(res.move, false);
      }, wait);
    }, 40);
  }

  function isPromoOpen() { return !promoOverlayEl.classList.contains('hidden'); }

  function onSquareClick(idx) {
    if (S.over || S.thinking || S.hintBusy || isPromoOpen()) return;

    var piece = S.pos.board[idx];
    var own = !!piece && R.isWhitePiece(piece) === (S.pos.turn === 'w');

    var candidates = S.targets.filter(function (m) { return m.to === idx; });
    if (candidates.length) {
      if (candidates.length > 1) { openPromotion(candidates); return; }
      applyMove(candidates[0], true);
      return;
    }

    if (own && S.pos.turn === S.human) {
      if (S.selected === idx) {
        S.selected = -1;
        S.targets = [];
      } else {
        S.selected = idx;
        S.targets = R.legalMovesFrom(S.pos, idx);
        playSound('select');
      }
      paint();
      renderButtons();
      return;
    }

    if (S.selected >= 0) {
      S.selected = -1;
      S.targets = [];
      paint();
    }
  }

  function openPromotion(moves) {
    S.promoMoves = moves;
    var color = S.pos.turn === 'w' ? 'w' : 'b';
    promoOptionsEl.innerHTML = '';

    ['q', 'r', 'b', 'n'].forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'promo-btn ' + color;
      btn.textContent = GLYPH[t.toUpperCase()];
      btn.title = { q: 'Hetman', r: 'Wieża', b: 'Goniec', n: 'Skoczek' }[t];
      btn.addEventListener('click', function () {
        var chosen = null;
        for (var i = 0; i < S.promoMoves.length; i++) {
          if (S.promoMoves[i].promo === t) chosen = S.promoMoves[i];
        }
        S.promoMoves = null;
        promoOverlayEl.classList.add('hidden');
        if (chosen) applyMove(chosen, true);
      });
      promoOptionsEl.appendChild(btn);
    });

    promoOverlayEl.classList.remove('hidden');
  }

  function undoMove() {
    if (S.thinking || S.hintBusy || !S.history.length) return;

    var removedHuman = false;
    while (S.history.length) {
      var rec = S.history.pop();
      if (rec.byHuman) removedHuman = true;
      S.pos = rec.snapshot;
      if (removedHuman && S.pos.turn === S.human) break;
    }

    S.gameId++;
    S.over = false;
    S.thinking = false;
    S.selected = -1;
    S.targets = [];
    S.hintCells = null;
    clearTimeout(hintTimer);
    S.lastMove = S.history.length ? S.history[S.history.length - 1].move : null;
    resultOverlayEl.classList.add('hidden');

    render();
    if (S.pos.turn !== S.human) aiTurn();
  }

  function showHint() {
    if (S.thinking || S.hintBusy || S.over || S.pos.turn !== S.human) return;
    var myGame = S.gameId;
    S.hintBusy = true;
    renderStatus();
    renderButtons();

    setTimeout(function () {
      var res = null;
      try { res = AI.hint(S.pos); } catch (e) { res = null; }
      if (myGame !== S.gameId) return;
      S.hintBusy = false;
      if (!res) { render(); return; }
      S.hintCells = { from: res.move.from, to: res.move.to };
      paint();
      renderStatus();
      renderButtons();
      toast('Podpowiedź: ' + R.san(S.pos, res.move), 3000);
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function () {
        S.hintCells = null;
        paint();
      }, 3200);
    }, 40);
  }

  function flipBoard() {
    S.orientation = R.other(S.orientation);
    buildBoard();
    paint();
  }

  function newGame(color) {
    S.gameId++;
    S.pos = new R.Position();
    S.human = color;
    S.orientation = color;
    S.history = [];
    S.selected = -1;
    S.targets = [];
    S.lastMove = null;
    S.over = false;
    S.thinking = false;
    S.hintBusy = false;
    S.hintCells = null;
    S.promoMoves = null;
    clearTimeout(hintTimer);

    resultOverlayEl.classList.add('hidden');
    promoOverlayEl.classList.add('hidden');

    buildBoard();
    updateColorUI();
    render();

    toast(color === 'w' ? 'Grasz białymi — powodzenia!' : 'Grasz czarnymi — AI zaczyna', 2600);
    if (S.pos.turn !== S.human) aiTurn();
  }

  /* -------------------------------- nakładki ------------------------------- */
  var gameStarted = false;

  function updateColorUI() {
    var buttons = colorChoicesEl.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', buttons[i].dataset.color === newColorChoice);
    }
  }

  function openStart() {
    if (gameStarted) {
      S.gameId++;
      S.thinking = false;
      S.hintBusy = false;
      renderStatus();
      renderButtons();
    }
    newColorChoice = S.human;
    updateColorUI();
    refreshLevels();
    resultOverlayEl.classList.add('hidden');
    startOverlayEl.classList.remove('hidden');
  }

  function closeStart() {
    startOverlayEl.classList.add('hidden');
    if (gameStarted && !S.over && !S.thinking && S.pos.turn !== S.human) aiTurn();
  }

  function startGame() {
    var color = newColorChoice === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : newColorChoice;
    gameStarted = true;
    startOverlayEl.classList.add('hidden');
    newGame(color);
  }

  /* --------------------------------- zdarzenia ---------------------------- */
  function bindEvents() {
    boardEl.addEventListener('click', function (e) {
      var target = e.target;
      var cell = target && target.closest ? target.closest('.square') : null;
      if (!cell) return;
      onSquareClick(Number(cell.dataset.idx));
    });

    document.getElementById('newBtn').addEventListener('click', openStart);
    document.getElementById('againBtn').addEventListener('click', openStart);
    document.getElementById('reviewBtn').addEventListener('click', function () {
      resultOverlayEl.classList.add('hidden');
    });
    document.getElementById('startBtn').addEventListener('click', startGame);
    undoBtn.addEventListener('click', undoMove);
    hintBtn.addEventListener('click', showHint);
    document.getElementById('flipBtn').addEventListener('click', flipBoard);
    soundBtn.addEventListener('click', toggleSound);

    var colorButtons = colorChoicesEl.querySelectorAll('button');
    for (var i = 0; i < colorButtons.length; i++) {
      colorButtons[i].addEventListener('click', function () {
        newColorChoice = this.dataset.color;
        updateColorUI();
      });
    }

    startOverlayEl.addEventListener('click', function (e) {
      if (e.target === startOverlayEl && gameStarted) closeStart();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (isPromoOpen()) return;
        if (!startOverlayEl.classList.contains('hidden')) {
          if (gameStarted) closeStart();
          return;
        }
        if (!resultOverlayEl.classList.contains('hidden')) {
          resultOverlayEl.classList.add('hidden');
          return;
        }
        if (S.selected >= 0) {
          S.selected = -1;
          S.targets = [];
          paint();
        }
      }
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'z') {
        e.preventDefault();
        undoMove();
      }
    });
  }

  function toggleSound() {
    S.sound = !S.sound;
    soundBtn.textContent = S.sound ? '🔊' : '🔇';
    soundBtn.classList.toggle('off', !S.sound);
    soundBtn.title = 'Dźwięk: ' + (S.sound ? 'włączony' : 'wyłączony');
    try { localStorage.setItem('szachy.sound', S.sound ? '1' : '0'); } catch (e) { }
    if (S.sound) playSound('select');
  }

  /* ---------------------------------- start -------------------------------- */
  function init() {
    try {
      var storedLevel = localStorage.getItem('szachy.level');
      if (storedLevel !== null) {
        var lv = Number(storedLevel);
        if (lv >= 0 && lv < AI.LEVELS.length) S.level = lv;
      }
      if (localStorage.getItem('szachy.sound') === '0') S.sound = false;
    } catch (e) { }

    soundBtn.textContent = S.sound ? '🔊' : '🔇';
    soundBtn.classList.toggle('off', !S.sound);
    soundBtn.title = 'Dźwięk: ' + (S.sound ? 'włączony' : 'wyłączony');

    buildLevelButtons(levelListEl, pickLevel);
    buildLevelButtons(startLevelsEl, pickLevel);

    S.pos = new R.Position();
    buildBoard();
    updateLevelUI();
    refreshLevels();
    updateColorUI();
    render();

    bindEvents();

    if (window.ResizeObserver) {
      new ResizeObserver(function () { resizePieces(); }).observe(boardEl);
    } else {
      window.addEventListener('resize', resizePieces);
    }

    startOverlayEl.classList.remove('hidden');

    /* dostęp do wnętrza dla konsoli / testów */
    window.ChessApp = {
      state: S,
      newGame: newGame,
      apply: applyMove,
      render: render,
      rules: R
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
