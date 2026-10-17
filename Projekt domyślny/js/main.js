/* ==========================================================================
   main.js — spina wszystko: start gry, obsługa myszy/klawiatury, tury, modale.
   ========================================================================== */
window.App = (function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };

  const App = {
    world: null,
    state: null,
    renderer: null,
    camera: null,
    selection: { pid: -1, mode: null },
    dragging: false,
    dragMoved: false,
    lastMouse: { x: 0, y: 0 },
    hoverPid: -1,
    busy: false,
    pendingOffers: [],
    newGame: { countryId: -1, difficulty: 'normal', filter: '' }
  };

  /* ---------------------------------------------------------------- start -- */
  async function boot() {
    try {
      UI.init(api);
      UI.setProgress('Ładowanie danych mapy…', 0.01);
      const world = await WorldGen.build(function (stage, frac, info) {
        UI.setProgress(stage, frac, info);
      });
      App.world = world;
      App.camera = new Camera(world.GEO.cols, world.GEO.rows);
      const canvas = $('map');
      App.renderer = new Renderer(canvas, world, previewState(world), App.camera);
      App.renderer.prepare();
      window.addEventListener('resize', onResize);
      // Ustala rozmiar bufora canvasu (inaczej zostaje domyślne 300x150)
      // i dopasowuje do niego viewport kamery.
      App.renderer.resize();
      App.camera.fit();
      bindInput(canvas);
      UI.hideLoader();
      UI.refreshTop();
      renderLoop();
      openMainMenu();
    } catch (err) {
      UI.setProgress('Błąd podczas przygotowywania świata', 1, String(err && err.message ? err.message : err));
      console.error(err);
      const box = $('loader');
      const pre = document.createElement('pre');
      pre.style.cssText = 'text-align:left;color:#f88;font-size:12px;white-space:pre-wrap';
      pre.textContent = (err && err.stack) || String(err);
      box.querySelector('.loader-box').appendChild(pre);
    }
  }

  /* Stan "podglądu" — świat bez rozgrywki, używany przed wyborem kraju. */
  function previewState(world) {
    return {
      countries: world.countries.map(function (c) {
        return { id: c.id, name: c.name, color: GameState.colorFor(c), alive: true, isPlayer: false };
      }),
      provinces: world.provinces.map(function (p) {
        return { id: p.id, country: p.country, troops: 0, pop: p.pop, econ: p.econ, moved: false };
      }),
      playerId: -1,
      difficulty: 'normal',
      difficultyInfo: GameState.DIFFICULTY.normal,
      relations: new Int8Array(1),
      truceUntil: new Int32Array(1),
      log: [],
      offers: [],
      turn: 0,
      year: 2026,
      mapMode: 'political'
    };
  }

  function renderLoop() {
    if (App.renderer && App.renderer.dirty) App.renderer.render();
    requestAnimationFrame(renderLoop);
  }

  function onResize() {
    if (!App.renderer) return;
    App.renderer.resize();
    App.renderer.dirty = true;
  }

  /* ------------------------------------------------------------- rozgrywka */
  function startNewGame(countryId, difficulty) {
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    App.state = GameState.create(App.world, { playerId: countryId, difficulty: difficulty, seed: seed });
    Logic.recomputeAggregates(App.state);
    App.renderer.state = App.state;
    App.renderer.mode = App.state.mapMode || 'political';
    App.selection = { pid: -1, mode: null };
    clearTargets();
    const c = App.state.countries[App.state.playerId];
    Logic.log(App.state, 'Przejmujesz władzę w ' + c.name + '. Rok ' + App.state.year + '.', 'good');
    Logic.log(App.state, 'Cel: przetrwać i zdominować świat. Powodzenia!', 'info');
    if (c.centroid) App.camera.centerOn(c.centroid[0], c.centroid[1], 16);
    else App.camera.fit();
    UI.refreshTop(); UI.renderLog(); UI.showSelected(-1);
    App.renderer.dirty = true;
    UI.banner('Nowa gra: ' + c.name);
  }

  function loadFromSlot(slot) {
    const st = GameState.load(App.world, slot);
    if (!st) { UI.banner('Nie udało się wczytać zapisu'); return false; }
    App.state = st;
    Logic.recomputeAggregates(st);
    App.renderer.state = st;
    App.renderer.mode = st.mapMode || 'political';
    App.selection = { pid: -1, mode: null };
    clearTargets();
    const me = st.countries[st.playerId];
    if (me && me.centroid) App.camera.centerOn(me.centroid[0], me.centroid[1], 14);
    UI.refreshTop(); UI.renderLog(); UI.showSelected(-1);
    App.renderer.dirty = true;
    return true;
  }

  function saveToSlot(slot) {
    if (!App.state) return;
    const ok = GameState.save(App.state, slot);
    UI.banner(ok ? 'Zapisano grę' : 'Błąd zapisu (brak miejsca?)');
  }

  /* ---------------------------------------------------- zaznaczenie i ruch */
  function clearTargets() {
    App.renderer.moveTargets = null;
    App.renderer.attackTargets = null;
    App.renderer.dirty = true;
  }

  function select(pid) {
    App.selection.pid = pid;
    App.selection.mode = null;
    clearTargets();
    UI.showSelected(pid);
    App.renderer.selectedPid = pid;
    App.renderer.dirty = true;
  }

  function cancelMode() {
    if (UI.isModalOpen()) { UI.closeModal(); return; }
    if (App.selection.mode) {
      App.selection.mode = null;
      clearTargets();
      UI.showSelected(App.selection.pid);
    } else if (App.selection.pid >= 0) {
      select(-1);
    }
  }

  function ownAdjacentTargets(pid) {
    const st = App.state, world = App.world;
    const out = new Set();
    const src = st.provinces[pid];
    if (!src || src.country !== st.playerId) return out;
    const wp = world.provinces[pid];
    for (let i = 0; i < wp.neighbors.length; i++) {
      const t = wp.neighbors[i];
      if (st.provinces[t].country === st.playerId && st.provinces[t].troops < GameState.maxTroops(st, t)) out.add(t);
    }
    if (wp.coastal) {
      for (let i = 0; i < st.provinces.length; i++) {
        const t = st.provinces[i];
        if (t.country !== st.playerId || i === pid) continue;
        if (!world.provinces[i].coastal) continue;
        if (t.troops >= GameState.maxTroops(st, i)) continue;
        const a = wp.centroidLonLat, b = world.provinces[i].centroidLonLat;
        if (Util.haversineKm(a[0], a[1], b[0], b[1]) <= Logic.NAVAL_RANGE_KM) out.add(i);
      }
    }
    return out;
  }

  function attackTargets(pid) {
    const st = App.state, world = App.world;
    const out = new Map(); // pid -> {sea}
    const src = st.provinces[pid];
    if (!src || src.country !== st.playerId || src.troops <= 0) return out;
    const wp = world.provinces[pid];
    for (let i = 0; i < wp.neighbors.length; i++) {
      const t = wp.neighbors[i];
      const tp = st.provinces[t];
      if (tp.country === st.playerId) continue;
      if (!Logic.atWar(st, st.playerId, tp.country)) continue;
      out.set(t, { sea: false });
    }
    if (wp.coastal) {
      for (let i = 0; i < st.provinces.length; i++) {
        const tp = st.provinces[i];
        if (tp.country === st.playerId || tp.country < 0) continue;
        if (!Logic.atWar(st, st.playerId, tp.country)) continue;
        if (!world.provinces[i].coastal) continue;
        const a = wp.centroidLonLat, b = world.provinces[i].centroidLonLat;
        if (Util.haversineKm(a[0], a[1], b[0], b[1]) <= Logic.NAVAL_RANGE_KM) out.set(i, { sea: true });
      }
    }
    return out;
  }

  function setMode(mode) {
    const sel = App.selection;
    if (sel.pid < 0) return;
    sel.mode = sel.mode === mode ? null : mode;
    if (sel.mode === 'move') {
      App.renderer.moveTargets = ownAdjacentTargets(sel.pid);
      App.renderer.attackTargets = null;
    } else if (sel.mode === 'attack') {
      const set = new Set();
      attackTargets(sel.pid).forEach(function (v, k) { set.add(k); });
      App.renderer.attackTargets = set;
      App.renderer.moveTargets = null;
    } else {
      clearTargets();
    }
    App.renderer.dirty = true;
    UI.showSelected(sel.pid);
  }

  function doMove(from, to) {
    const res = Logic.move(App.state, App.world, from, to);
    if (!res.ok) UI.banner(res.reason);
    else UI.banner('Przeniesiono ' + res.amount + ' żołnierzy' + (res.sea ? ' (transport morski)' : ''));
    afterAction();
  }

  function doAttack(from, to) {
    const res = Logic.attack(App.state, App.world, from, to);
    if (!res.ok) {
      UI.banner(res.reason);
      if (res.needWar) {
        const cid = App.state.provinces[to].country;
        UI.showSelected(to);
      }
      return;
    }
    if (res.captured) {
      UI.banner('Zwycięstwo! Zajęto ' + res.name + ' (straty ' + res.attackerLosses + ')', 2600);
    } else {
      UI.banner('Szturm odparty — straty ' + res.attackerLosses + ', wróg stracił ' + res.defenderLosses, 2600);
    }
    afterAction();
  }

  function afterAction() {
    Logic.recomputeAggregates(App.state);
    refreshTargets();
    UI.refreshTop(); UI.renderLog(); UI.showSelected(App.selection.pid);
    App.renderer.dirty = true;
    if (App.state.gameOver) showGameOver();
  }

  /* Przelicza podświetlone cele dla aktywnego trybu (po każdej akcji). */
  function refreshTargets() {
    const sel = App.selection;
    if (!sel.mode || sel.pid < 0) return;
    if (sel.mode === 'move') {
      App.renderer.moveTargets = ownAdjacentTargets(sel.pid);
      App.renderer.attackTargets = null;
    } else {
      const set = new Set();
      attackTargets(sel.pid).forEach(function (v, k) { set.add(k); });
      App.renderer.attackTargets = set;
      App.renderer.moveTargets = null;
    }
  }

  /* ------------------------------------------------------------ koniec tury */
  function endTurn() {
    if (!App.state || App.busy) return;
    if (!App.state.countries[App.state.playerId].alive) { showGameOver(); return; }
    App.busy = true;
    App.selection.mode = null;
    clearTargets();
    UI.setThinking(true);
    setTimeout(function () {
      try {
        Logic.endTurn(App.state, App.world);
      } catch (err) {
        console.error(err);
        UI.banner('Błąd tury: ' + err.message);
      }
      App.busy = false;
      UI.setThinking(false);
      Logic.recomputeAggregates(App.state);
      UI.refreshTop(); UI.renderLog(); UI.showSelected(App.selection.pid);
      App.renderer.dirty = true;
      GameState.save(App.state, 'auto');
      UI.banner('Rok ' + App.state.year);
      if (App.state.gameOver) {
        showGameOver();
      } else {
        queueOffers();
      }
    }, 40);
  }

  /* ------------------------------------------------------------- oferty AI */
  function queueOffers() {
    const st = App.state;
    st.offers = (st.offers || []).filter(function (o) {
      const from = st.countries[o.from];
      if (!from || !from.alive) return false;
      const rel = GameState.relation(st, st.playerId, o.from);
      if (o.type === 'peace') return rel === GameState.REL.WAR;
      if (o.type === 'alliance') return rel === GameState.REL.PEACE;
      return false;
    });
    App.pendingOffers = st.offers.slice();
    st.offers = [];
    showNextOffer();
  }

  function showNextOffer() {
    if (!App.pendingOffers.length) return;
    const o = App.pendingOffers.shift();
    const from = App.state.countries[o.from];
    const isPeace = o.type === 'peace';
    const html =
      '<h2>' + (isPeace ? 'Propozycja pokoju' : 'Propozycja sojuszu') + '</h2>' +
      '<p><span class="chip" style="display:inline-block;background:' + from.color + '"></span> <b>' + Util.escapeHtml(from.name) + '</b> ' +
      (isPeace ? 'proponuje zakończenie wojny.' : 'proponuje zawarcie sojuszu.') + '</p>' +
      '<p class="muted">' + (isPeace
        ? 'Pokój oznacza 12 tur rozejmu. Twoje zdobycze zostają przy Tobie.'
        : 'Sojusznik dołączy do Twoich wojen i może udzielić wsparcia w walkach.') + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn" data-act="offer-reject">Odrzuć</button>' +
      '<button class="btn btn-primary" data-act="offer-accept" data-arg="' + o.type + '" data-from="' + o.from + '">Akceptuj</button>' +
      '</div>';
    UI.openModal(html, { offer: o });
  }

  function resolveOffer(accept, type, from) {
    const st = App.state;
    if (accept) {
      if (type === 'peace') Logic.makePeace(st, st.playerId, from);
      else Logic.proposeAlliance(st, st.playerId, from);
    }
    UI.closeModal();
    UI.refreshTop(); UI.renderLog(); UI.showSelected(App.selection.pid);
    App.renderer.dirty = true;
    if (App.pendingOffers.length) setTimeout(showNextOffer, 150);
  }

  /* ---------------------------------------------------------- koniec gry --- */
  function showGameOver() {
    const st = App.state;
    const win = st.gameOver === 'victory';
    const power = st.gameOver === 'victory-power';
    const me = st.countries[st.playerId];
    const shareN = me.provinceCount / st.provinces.length * 100;
    const share = shareN >= 10 ? String(Math.round(shareN)) : String(Math.round(shareN * 10) / 10);
    const html =
      '<h2>' + (win ? '🏆 Dominacja światowa!' : power ? '👑 Zwycięstwo — nowa potęga!' : '💀 Koniec gry') + '</h2>' +
      '<p>' + (win
        ? 'Twoje państwo <b>' + Util.escapeHtml(me.name) + '</b> kontroluje ponad połowę świata w roku ' + st.year + '.'
        : power
          ? 'Państwo <b>' + Util.escapeHtml(me.name) + '</b> rozrosło się trzykrotnie i należy do największych mocarstw świata (rok ' + st.year + ').'
          : 'Państwo <b>' + Util.escapeHtml(me.name) + '</b> przestało istnieć w roku ' + st.year + '.') + '</p>' +
      '<p class="muted">Prowincje: ' + Util.fmt(me.provinceCount) + ' (' + share + '% świata) · Armia: ' + Util.fmt(me.troops) +
      ' · Ludność: ' + Util.fmtShort(me.pop) + ' · Miejsce: ' + Logic.rankOf(st, st.playerId) + '</p>' +
      '<div class="modal-actions">' +
      (win || power ? '<button class="btn" data-act="continue-game">Kontynuuj podbój</button>' : '') +
      '<button class="btn" data-act="ranking">Ranking</button>' +
      '<button class="btn btn-primary" data-act="newgame">Nowa gra</button>' +
      '</div>';
    UI.openModal(html);
  }

  /* ---------------------------------------------------------------- modale */
  function openMainMenu() {
    let autoInfo = null;
    try { autoInfo = GameState.saveInfo('auto'); } catch (e) { }

    const html =
      '<h2>Epoka Konfliktów</h2>' +
      '<p class="muted">Turowa strategia na prawdziwej mapie świata — ' + Util.fmt(App.world.countries.length) + ' państw, ' +
      Util.fmt(App.world.provinces.length) + ' prowincji.</p>' +
      '<div class="modal-actions" style="justify-content:flex-start;margin-top:14px">' +
      (autoInfo ? '<button class="btn btn-primary" data-act="load-auto">Wznów grę (rok ' + autoInfo.year + ')</button>' : '') +
      '<button class="btn ' + (autoInfo ? '' : 'btn-primary') + '" data-act="newgame">Nowa gra</button>' +
      '<button class="btn" data-act="help">Zasady i sterowanie</button>' +
      '</div>' +
      '<h3>Wczytaj zapis</h3>' +
      saveSlotsHtml('load') +
      '<p class="muted" style="margin-top:10px">Wskazówka: gra działa w całości offline, zapisy trzyma w przeglądarce (localStorage).</p>';
    UI.openModal(html);
  }

  function saveSlotsHtml(mode) {
    let html = '';
    for (let s = 1; s <= 3; s++) {
      const info = GameState.saveInfo(s);
      html += '<div class="slot"><div>' +
        '<b>Slot ' + s + '</b> ' +
        (info ? '<span class="muted">rok ' + info.year + ' · ' + Util.fmt(info.provinces) + ' prowincji</span>' : '<span class="muted">pusty</span>') +
        '</div><div style="display:flex;gap:6px">' +
        (mode === 'load' || mode === 'both' ?
          '<button class="btn" data-act="load-slot" data-arg="' + s + '" ' + (info ? '' : 'disabled') + '>Wczytaj</button>' : '') +
        (mode === 'save' || mode === 'both' ?
          '<button class="btn" data-act="save-slot" data-arg="' + s + '">Zapisz</button>' : '') +
        (info ? '<button class="btn btn-ghost" data-act="del-slot" data-arg="' + s + '">Usuń</button>' : '') +
        '</div></div>';
    }
    return html;
  }

  function openMenu() {
    const html =
      '<h2>Menu</h2>' +
      '<div class="modal-actions" style="justify-content:flex-start">' +
      '<button class="btn" data-act="close">Kontynuuj grę</button>' +
      '<button class="btn" data-act="newgame">Nowa gra</button>' +
      '<button class="btn" data-act="ranking">Ranking</button>' +
      '<button class="btn" data-act="help">Pomoc</button>' +
      '</div>' +
      '<h3>Zapis gry</h3>' + saveSlotsHtml('both');
    UI.openModal(html);
  }

  function openNewGame() {
    const world = App.world;
    const list = world.countries.map(function (c, i) { return c; })
      .filter(function (c) { return c.provinceCount > 0; })
      .sort(function (a, b) { return b.pop - a.pop; });
    App.newGame.countryId = list.length ? list[0].id : 0;
    App.newGame.filter = '';
    renderNewGameModal(list);
  }

  function renderNewGameModal(list) {
    const dif = App.newGame.difficulty;
    let rows = '';
    const filter = App.newGame.filter.toLowerCase();
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (filter && c.name.toLowerCase().indexOf(filter) < 0 && String(c.iso).toLowerCase().indexOf(filter) < 0) continue;
      const sel = c.id === App.newGame.countryId ? ' sel' : '';
      rows += '<div class="country-row' + sel + '" data-act="pick-country" data-arg="' + c.id + '">' +
        '<span class="chip" style="background:' + GameState.colorFor(c) + '"></span>' +
        '<span>' + Util.escapeHtml(c.name) + '</span>' +
        '<span class="num">' + Util.fmt(c.provinceCount) + ' prow.</span>' +
        '<span class="num">' + Util.fmtShort(c.pop) + '</span>' +
        '<span class="num">' + (c.continent || '') + '</span>' +
        '</div>';
    }
    const html =
      '<h2>Nowa gra</h2>' +
      '<h3>Poziom trudności</h3>' +
      '<div class="grid2">' +
      optionHtml('easy', 'Łatwy', 'Więcej pieniędzy, łagodniejsze AI', dif) +
      optionHtml('normal', 'Normalny', 'Zbalansowana rozgrywka', dif) +
      optionHtml('hard', 'Trudny', 'Agresywne AI, mniejsze dochody', dif) +
      '</div>' +
      '<h3>Wybierz państwo</h3>' +
      '<input class="search" id="ng-search" placeholder="Szukaj kraju…" value="' + Util.escapeHtml(App.newGame.filter) + '">' +
      '<div class="country-list" id="ng-list">' + rows + '</div>' +
      '<div class="modal-actions">' +
      '<button class="btn" data-act="close">Anuluj</button>' +
      '<button class="btn btn-primary" data-act="start-new">Rozpocznij grę</button>' +
      '</div>';
    UI.openModal(html, {
      onOpen: function (box) {
        const search = box.querySelector('#ng-search');
        if (search) {
          search.addEventListener('input', function () {
            App.newGame.filter = this.value;
            renderNewGameModal(list);
            const s2 = document.querySelector('#ng-search');
            if (s2) { s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); }
          });
        }
      }
    });
  }

  function optionHtml(id, title, desc, current) {
    return '<div class="opt' + (current === id ? ' sel' : '') + '" data-act="pick-diff" data-arg="' + id + '">' +
      '<div class="t">' + title + '</div><div class="d">' + desc + '</div></div>';
  }

  function openRanking() {
    const st = App.state;
    if (!st) {
      const rows0 = App.world.countries.slice().sort(function (a, b) { return b.pop - a.pop; }).slice(0, 40)
        .map(function (c, i) {
          return '<div class="ranking-row"><span class="num">' + (i + 1) + '</span>' +
            '<span class="chip" style="background:' + GameState.colorFor(c) + '"></span>' +
            '<span>' + Util.escapeHtml(c.name) + '</span>' +
            '<span class="num">' + Util.fmtShort(c.pop) + ' mieszkańców</span></div>';
        }).join('');
      UI.openModal('<h2>Najludniejsze państwa świata</h2>' + rows0 +
        '<div class="modal-actions"><button class="btn" data-act="close">Zamknij</button></div>');
      return;
    }
    const rank = Logic.ranking(st);
    let rows = '';
    for (let i = 0; i < rank.length; i++) {
      const r = rank[i];
      if (!r.alive) continue;
      const c = st.countries[r.id];
      rows += '<div class="ranking-row' + (r.isPlayer ? ' me' : '') + '" data-act="goto-country" data-arg="' + r.id + '">' +
        '<span class="num">' + (i + 1) + '</span>' +
        '<span class="chip" style="background:' + r.color + '"></span>' +
        '<span>' + Util.escapeHtml(r.name) + (r.isPlayer ? ' <b>(Ty)</b>' : '') + '</span>' +
        '<span class="num">' + Util.fmt(c.provinceCount) + ' prow. · ' + Util.fmt(c.troops) + ' armii</span>' +
        '</div>';
    }
    UI.openModal('<h2>Ranking państw — rok ' + st.year + '</h2>' +
      '<p class="muted">Punkty: prowincje, armia, ludność i gospodarka.</p>' + rows +
      '<div class="modal-actions"><button class="btn" data-act="close">Zamknij</button></div>');
  }

  function openHelp() {
    const html =
      '<h2>Zasady i sterowanie</h2>' +
      '<h3>Cel gry</h3>' +
      '<p>Przejmij kontrolę nad co najmniej <b>50% prowincji świata</b>. Każda tura to jeden rok.</p>' +
      '<h3>Ekonomia</h3>' +
      '<ul>' +
      '<li><b>Dochód</b> z prowincji zależy od liczby ludności i poziomu gospodarki — wpływa do skarbca co turę.</li>' +
      '<li><b>Utrzymanie armii</b> kosztuje 0,32 szt. zł za żołnierza na turę. Pusty skarbiec oznacza dezercje.</li>' +
      '<li><b>Rekrutacja</b> (10 zł za żołnierza), <b>Inwestycje</b> (+4 gospodarki), <b>Fortyfikacje</b> (obrona do +90%).</li>' +
      '</ul>' +
      '<h3>Wojna</h3>' +
      '<ul>' +
      '<li>Najpierw <b>wypowiedz wojnę</b> (panel prowincji wroga lub karta państwa), potem atakuj.</li>' +
      '<li>Bitwa rozgrywa się automatycznie: liczą się liczebność, technologia (poziom gospodarki), fortyfikacje, wsparcie sąsiadów i stołeczny bonus.</li>' +
      '<li>Ta sama armia działa raz na turę. Zajęta prowincja przechodzi w Twoje ręce z ocalałymi żołnierzami.</li>' +
      '<li><b>Desant morski</b>: z prowincji nadmorskiej możesz zaatakować wrogie wybrzeże w promieniu ' + Logic.NAVAL_RANGE_KM + ' km (koszt ' + Logic.NAVAL_COST + ' zł, kara do siły ataku). Przytrzymaj <kbd>Shift</kbd> i kliknij cel.</li>' +
      '<li>Sojusznicy automatycznie przystępują do wojny po Twojej stronie (i Ty po ich stronie).</li>' +
      '</ul>' +
      '<h3>Sterowanie</h3>' +
      '<ul>' +
      '<li><b>LPM</b> — zaznacz prowincję; kliknięcie sąsiedniej własnej przenosi armię, wrogiej (w stanie wojny) atakuje.</li>' +
      '<li><b>PPM</b> — anuluj wybór/tryb rozkazu.</li>' +
      '<li><b>Przeciągnij myszą</b> — przesuwanie mapy, <b>kółko</b> — zbliżenie.</li>' +
      '<li><b>Spacja</b> — zakończ turę, <b>M</b> — zmień tryb mapy, <b>R</b> — ranking, <b>H</b> — pomoc, <b>Esc</b> — anuluj.</li>' +
      '</ul>' +
      '<h3>Tryby mapy</h3>' +
      '<p>Polityczna (kolor państwa), Dyplomatyczna (sojusznicy/wojny), Armia, Gospodarka, Ludność.</p>' +
      '<div class="modal-actions"><button class="btn btn-primary" data-act="close">Rozumiem</button></div>';
    UI.openModal(html);
  }

  /* ------------------------------------------------------------- działania */
  function toastFor(res, okMsg) {
    if (!res.ok) UI.banner(res.reason);
    else if (okMsg) UI.banner(okMsg);
  }

  function action(name, arg) {
    const st = App.state;
    if (!st) return;
    const sel = App.selection;
    const pid = sel.pid;
    if (name === 'mode-move') { setMode('move'); return; }
    if (name === 'mode-attack') { setMode('attack'); return; }
    if (name === 'goto') { gotoProvince(parseInt(arg, 10)); return; }
    if (name === 'help') { openHelp(); return; }
    if (name === 'armynav') {
      // wybierz prowincję z największą armią
      let best = -1, bestT = -1;
      for (let i = 0; i < st.provinces.length; i++) {
        const p = st.provinces[i];
        if (p.country !== st.playerId) continue;
        if (p.troops > bestT) { bestT = p.troops; best = i; }
      }
      if (best >= 0) { gotoProvince(best); select(best); }
      else UI.banner('Nie masz żołnierzy');
      return;
    }
    if (name === 'war') {
      const cid = parseInt(arg, 10);
      const res = Logic.declareWar(st, App.world, st.playerId, cid);
      toastFor(res, 'Wypowiedziałeś wojnę: ' + st.countries[cid].name);
      afterAction();
      return;
    }
    if (name === 'peace') {
      const cid = parseInt(arg, 10);
      const w = Logic.peaceWillingness(st, cid, st.playerId);
      const rnd = Math.random();
      if (w > 0.42 || rnd < w) {
        Logic.makePeace(st, st.playerId, cid);
        UI.banner(st.countries[cid].name + ' przyjmuje pokój');
      } else {
        UI.banner(st.countries[cid].name + ' odrzuca propozycję pokoju');
      }
      afterAction();
      return;
    }
    if (name === 'alliance') {
      const cid = parseInt(arg, 10);
      const mine = Logic.score(st, st.playerId), theirs = Logic.score(st, cid);
      if (theirs < mine * 1.3 || Math.random() < 0.3) {
        Logic.proposeAlliance(st, st.playerId, cid);
        UI.banner(st.countries[cid].name + ' przyjmuje sojusz');
      } else {
        UI.banner(st.countries[cid].name + ' odrzuca proponowany sojusz');
      }
      afterAction();
      return;
    }
    if (name === 'breakally') {
      const cid = parseInt(arg, 10);
      GameState.setRelation(st, st.playerId, cid, GameState.REL.PEACE);
      UI.banner('Sojusz zerwany');
      afterAction();
      return;
    }
    if (pid < 0) return;
    if (st.provinces[pid].country !== st.playerId) return;
    if (name === 'recruit') {
      const maxT = GameState.maxTroops(st, pid);
      let amount = arg === 'max' ? 1 : parseInt(arg, 10);
      if (arg === 'max') {
        // tyle, na ile wystarczy miejsca i pieniędzy
        amount = Math.min(maxT - st.provinces[pid].troops, Math.floor(st.countries[st.playerId].treasury / Logic.RECRUIT_COST));
      }
      const res = Logic.recruit(st, pid, amount);
      toastFor(res, 'Zrekrutowano ' + (res.amount || 0) + ' żołnierzy');
      afterAction();
      return;
    }
    if (name === 'invest') {
      const res = Logic.invest(st, pid);
      toastFor(res, 'Zainwestowano — gospodarka ' + Math.round(st.provinces[pid].econ));
      afterAction();
      return;
    }
    if (name === 'fortify') {
      const res = Logic.fortify(st, pid);
      toastFor(res, 'Fortyfikacje na poziomie ' + st.provinces[pid].fort);
      afterAction();
      return;
    }
  }

  function gotoProvince(pid) {
    if (pid < 0 || !App.world.provinces[pid]) return;
    const g = App.world.provinces[pid].centroid;
    App.camera.centerOn(g[0], g[1], Math.max(App.camera.scale, 16));
    App.renderer.dirty = true;
    App.renderer.hoverPid = pid;
  }

  function gotoCountry(cid) {
    const c = App.state ? App.state.countries[cid] : App.world.countries[cid];
    const cap = c && c.capitalProvince >= 0 ? c.capitalProvince : -1;
    if (cap >= 0) gotoProvince(cap);
    else if (c && c.centroid) { App.camera.centerOn(c.centroid[0], c.centroid[1], 8); App.renderer.dirty = true; }
  }

  /* --------------------------------------------------------------- modale  */
  function modalAction(name, arg, btn) {
    switch (name) {
      case 'close': UI.closeModal(); break;
      case 'help': case 'rules': openHelp(); break;
      case 'ranking': openRanking(); break;
      case 'menu': openMenu(); break;
      case 'newgame': openNewGame(); break;
      case 'pick-country':
        App.newGame.countryId = parseInt(arg, 10);
        // odśwież listę (zachowując filtr)
        openNewGameKeepFilter();
        break;
      case 'pick-diff':
        App.newGame.difficulty = arg;
        openNewGameKeepFilter();
        break;
      case 'start-new':
        UI.closeModal();
        startNewGame(App.newGame.countryId, App.newGame.difficulty);
        break;
      case 'load-auto':
        UI.closeModal();
        if (!loadFromSlot('auto')) openMainMenu();
        break;
      case 'load-slot':
        if (loadFromSlot(parseInt(arg, 10))) UI.closeModal();
        break;
      case 'save-slot':
        saveToSlot(parseInt(arg, 10));
        openMenu();
        break;
      case 'del-slot':
        GameState.remove(parseInt(arg, 10));
        openMenu();
        break;
      case 'goto-country':
        UI.closeModal();
        gotoCountry(parseInt(arg, 10));
        break;
      case 'offer-accept':
        resolveOffer(true, arg, parseInt((btn && btn.dataset.from) || '-1', 10));
        break;
      case 'offer-reject':
        resolveOffer(false);
        break;
      case 'continue-game':
        App.state.gameOver = null;
        UI.closeModal();
        UI.banner('Kontynuujesz podbój');
        break;
      default: break;
    }
  }

  function openNewGameKeepFilter() {
    const list = App.world.countries.filter(function (c) { return c.provinceCount > 0; })
      .sort(function (a, b) { return b.pop - a.pop; });
    renderNewGameModal(list);
  }

  /* ------------------------------------------------------------- wejście -- */
  function bindInput(canvas) {
    canvas.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      App.dragging = true;
      App.dragMoved = false;
      App.lastMouse = { x: e.clientX, y: e.clientY };
      canvas.classList.add('grabbing');
    });

    canvas.addEventListener('mousemove', function (e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (App.dragging) {
        const dx = e.clientX - App.lastMouse.x, dy = e.clientY - App.lastMouse.y;
        if (!App.dragMoved && Math.abs(dx) + Math.abs(dy) > 3) {
          App.dragMoved = true;
          App.renderer.fast = true;
        }
        if (App.dragMoved) {
          App.camera.panBy(dx, dy);
          App.renderer.dirty = true;
        }
        App.lastMouse = { x: e.clientX, y: e.clientY };
        return;
      }
      hoverAt(x, y, e.shiftKey);
    });

    window.addEventListener('mouseup', function (e) {
      if (!App.dragging) return;
      const wasDrag = App.dragMoved;
      App.dragging = false;
      App.dragMoved = false;
      canvas.classList.remove('grabbing');
      App.renderer.fast = false;
      App.renderer.dirty = true;
      if (!wasDrag && e.button === 0) {
        const rect = canvas.getBoundingClientRect();
        clickAt(e.clientX - rect.left, e.clientY - rect.top, e.shiftKey);
      }
    });

    canvas.addEventListener('mouseleave', function () {
      App.hoverPid = -1;
      App.renderer.hoverPid = -1;
      App.renderer.dirty = true;
      UI.hideTooltip();
    });

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      App.camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
      App.renderer.dirty = true;
    }, { passive: false });

    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      cancelMode();
    });

    window.addEventListener('keydown', function (e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); if (!UI.isModalOpen()) endTurn(); return; }
      if (e.key === 'Escape') { cancelMode(); return; }
      if (e.key === 'm' || e.key === 'M') { cycleMapMode(); return; }
      if (e.key === 'r' || e.key === 'R') { openRanking(); return; }
      if (e.key === 'h' || e.key === 'H' || e.key === '?') { openHelp(); return; }
      const step = 60;
      if (e.key === 'ArrowLeft') { App.camera.panBy(step, 0); App.renderer.dirty = true; }
      if (e.key === 'ArrowRight') { App.camera.panBy(-step, 0); App.renderer.dirty = true; }
      if (e.key === 'ArrowUp') { App.camera.panBy(0, step); App.renderer.dirty = true; }
      if (e.key === 'ArrowDown') { App.camera.panBy(0, -step); App.renderer.dirty = true; }
      if (e.key === '+' || e.key === '=') { App.camera.zoomAt(App.camera.viewW / 2, App.camera.viewH / 2, 1.25); App.renderer.dirty = true; }
      if (e.key === '-') { App.camera.zoomAt(App.camera.viewW / 2, App.camera.viewH / 2, 0.8); App.renderer.dirty = true; }
    });
  }

  function hoverAt(x, y, shift) {
    const pid = App.renderer.provinceAt(x, y);
    if (pid !== App.hoverPid) {
      App.hoverPid = pid;
      App.renderer.hoverPid = pid;
      App.renderer.dirty = true;
    }
    if (pid < 0 || !App.state) { UI.hideTooltip(); return; }
    const st = App.state;
    const pv = st.provinces[pid];
    const wp = App.world.provinces[pid];
    const owner = pv.country >= 0 ? st.countries[pv.country] : null;
    let html = '<div class="tt-name">' + Util.escapeHtml(pv.name) + '</div>';
    html += '<div class="tt-row">' + (owner ? Util.escapeHtml(owner.name) : 'bez właściciela') + '</div>';
    html += '<div class="tt-row">Ludność: <b>' + Util.fmtShort(pv.pop) + '</b> · Gosp.: <b>' + Math.round(pv.econ) + '</b></div>';
    if (st.provinces[pid].troops) html += '<div class="tt-row">Garnizon: <b>' + Util.fmt(pv.troops) + '</b></div>';
    if (pv.fort) html += '<div class="tt-row">Fortyfikacje: <b>' + pv.fort + '</b></div>';
    const sel = App.selection;
    if (sel.pid >= 0 && sel.pid !== pid) {
      const from = st.provinces[sel.pid];
      if (from.country === st.playerId && from.troops > 0) {
        const rules = Logic.attackRules(st, App.world, sel.pid, pid);
        if (rules.ok) {
          const prev = Logic.battlePreview(st, App.world, sel.pid, pid, rules.sea);
          html += '<div class="tt-row" style="margin-top:4px">Twój atak: <b>' + Util.fmt(prev.attacker) + '</b> vs <b>' + Util.fmt(prev.defender) + '</b>' +
            (rules.sea ? ' (desant)' : '') + '</div>';
        } else if (rules.needWar) {
          html += '<div class="tt-row" style="margin-top:4px;color:#f0b0a8">Wymagane wypowiedzenie wojny</div>';
        }
      }
    }
    UI.showTooltip(html, x, y);
  }

  function clickAt(x, y, shift) {
    const pid = App.renderer.provinceAt(x, y);
    if (!App.state) return;
    if (pid < 0) { select(-1); return; }
    const st = App.state;
    const sel = App.selection;
    const pv = st.provinces[pid];
    const player = st.playerId;

    if (sel.mode === 'move') {
      if (pid === sel.pid) { setMode('move'); return; }
      doMove(sel.pid, pid);
      return;
    }
    if (sel.mode === 'attack') {
      if (pid === sel.pid) { setMode('attack'); return; }
      doAttack(sel.pid, pid);
      return;
    }
    if (pid === sel.pid) { select(-1); return; }

    if (sel.pid >= 0) {
      const from = st.provinces[sel.pid];
      if (from.country === player && from.troops > 0) {
        const wp = App.world.provinces[sel.pid];
        const adjacent = wp.neighbors.indexOf(pid) >= 0;
        const same = pv.country === player;
        if (adjacent && same) { doMove(sel.pid, pid); return; }
        if (adjacent && !same && Logic.atWar(st, player, pv.country)) { doAttack(sel.pid, pid); return; }
        if (!adjacent) {
          const dist = Util.haversineKm(wp.centroidLonLat[0], wp.centroidLonLat[1],
            App.world.provinces[pid].centroidLonLat[0], App.world.provinces[pid].centroidLonLat[1]);
          const reachable = wp.coastal && App.world.provinces[pid].coastal && dist <= Logic.NAVAL_RANGE_KM;
          if (reachable && shift) {
            if (same) doMove(sel.pid, pid); else doAttack(sel.pid, pid);
            return;
          }
          if (reachable && !same) {
            UI.banner('Przytrzymaj Shift, aby przeprowadzić desant morski');
          }
          if (reachable && same) {
            UI.banner('Przytrzymaj Shift, aby przetransportować armię drogą morską');
          }
        }
        if (adjacent && !same && !Logic.atWar(st, player, pv.country)) {
          UI.banner('Najpierw wypowiedz wojnę: ' + st.countries[pv.country].name);
        }
      }
    }
    select(pid);
  }

  function cycleMapMode() {
    const modes = Renderer.MODES;
    const cur = App.renderer.mode;
    let idx = 0;
    for (let i = 0; i < modes.length; i++) if (modes[i].id === cur) idx = i;
    setMapMode(modes[(idx + 1) % modes.length].id);
  }

  function setMapMode(mode) {
    App.renderer.mode = mode;
    if (App.state) App.state.mapMode = mode;
    const sel = UI.refs().mapMode;
    if (sel) sel.value = mode;
    App.renderer.dirty = true;
  }

  function currentMoveTargets() { return App.renderer.moveTargets; }
  function currentAttackTargets() { return App.renderer.attackTargets; }

  /* ------------------------------------------------------------------ API -- */
  const api = {
    boot: boot,
    action: action,
    modalAction: modalAction,
    endTurn: endTurn,
    setMapMode: setMapMode,
    currentMoveTargets: currentMoveTargets,
    currentAttackTargets: currentAttackTargets,
    gotoProvince: gotoProvince,
    onModalClosed: function () { },
    get world() { return App.world; },
    get state() { return App.state; },
    get renderer() { return App.renderer; },
    get camera() { return App.camera; },
    get selection() { return App.selection; }
  };
  return api;
})();

window.addEventListener('DOMContentLoaded', function () { App.boot(); });
