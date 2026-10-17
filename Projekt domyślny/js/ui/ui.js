/* ==========================================================================
   ui.js — interfejs: pasek górny, panel prowincji/państwa, kronika, modale.
   ========================================================================== */
window.UI = (function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  let App = null;
  let refs = {};
  let logFilterMine = false;
  let modalStack = [];

  /* ------------------------------------------------------------- start ---- */
  function init(app) {
    App = app;
    refs = {
      loader: $('loader'), loaderBar: $('loader-bar'), loaderStage: $('loader-stage'), loaderInfo: $('loader-info'),
      year: $('tb-year'), turn: $('tb-turn'), treasury: $('tb-treasury'), income: $('tb-income'),
      army: $('tb-army'), rank: $('tb-rank'), country: $('tb-country'),
      mapMode: $('map-mode'), panel: $('panel-selected'),
      logList: $('log-list'), tooltip: $('tooltip'), banner: $('turn-banner'),
      modal: $('modal'), modalBox: $('modal-box'), thinking: $('thinking'),
      hintProvinces: $('hint-provinces')
    };
    // tryby mapy
    refs.mapMode.innerHTML = Renderer.MODES.map(function (m) {
      return '<option value="' + m.id + '">' + m.name + '</option>';
    }).join('');
    refs.mapMode.addEventListener('change', function () {
      App.setMapMode(this.value);
    });
    $('btn-end-turn').addEventListener('click', function () { App.endTurn(); });
    $('btn-menu').addEventListener('click', function () { App.modalAction('menu'); });
    $('btn-ranking').addEventListener('click', function () { App.modalAction('ranking'); });
    $('btn-log-filter').addEventListener('click', function () {
      logFilterMine = !logFilterMine;
      this.textContent = logFilterMine ? 'Moje sprawy' : 'Wszystko';
      renderLog();
    });
    // delegacja kliknięć w panelu
    refs.panel.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      App.action(btn.dataset.act, btn.dataset.arg, btn);
    });
    refs.modal.addEventListener('click', function (e) {
      if (e.target === refs.modal) closeModal();
    });
    refs.modalBox.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      App.modalAction(btn.dataset.act, btn.dataset.arg, btn);
    });
  }

  /* ------------------------------------------------------------ loader ---- */
  function setProgress(stage, frac, info) {
    refs.loaderStage.textContent = stage;
    refs.loaderBar.style.width = Math.round(Util.clamp(frac, 0, 1) * 100) + '%';
    refs.loaderInfo.textContent = info || '';
  }
  function hideLoader() { refs.loader.classList.add('hidden'); }

  /* --------------------------------------------------------- pasek górny -- */
  function refreshTop() {
    const st = App.state, world = App.world;
    if (!st) return;
    const me = st.countries[st.playerId];
    refs.year.textContent = st.year;
    refs.turn.textContent = st.turn;
    refs.treasury.textContent = Util.fmt(me.treasury);
    refs.treasury.parentElement.classList.toggle('bad', me.treasury <= 0);
    const net = Math.round(me.income - me.upkeep);
    refs.income.textContent = (net >= 0 ? '+' : '') + Util.fmt(net);
    refs.income.parentElement.classList.toggle('bad', net < 0);
    refs.army.textContent = Util.fmt(me.troops);
    const rank = Logic.rankOf(st, st.playerId);
    refs.rank.textContent = rank + ' / ' + st.countries.length;
    refs.country.textContent = me.name + ' · ' + Util.fmt(me.provinceCount) + ' prow.';
    refs.country.style.borderColor = me.color;
    const shareN = st.provinces.length ? me.provinceCount / st.provinces.length * 100 : 0;
    const share = shareN >= 10 ? String(Math.round(shareN)) : String(Math.round(shareN * 10) / 10);
    const goal = Math.max(3, Math.round((st.playerStartProvinces || me.provinceCount) * 3));
    refs.hintProvinces.textContent = 'Kontrolujesz ' + share + '% świata (' + Util.fmt(me.provinceCount) + ' prowincji) · cel: ' + goal + ' prowincji lub 50% świata';
    if (st.mapMode && refs.mapMode.value !== st.mapMode) refs.mapMode.value = st.mapMode;
  }

  /* -------------------------------------------------- panel wybranej prow. */
  function relTag(state, a, b) {
    const rel = GameState.relation(state, a, b);
    if (rel === GameState.REL.WAR) return '<span class="tag war">WOJNA</span>';
    if (rel === GameState.REL.ALLY) return '<span class="tag ally">SOJUSZ</span>';
    if (Logic.truceActive(state, a, b)) return '<span class="tag truce">ROZEJM</span>';
    return '<span class="tag">pokój</span>';
  }

  function showSelected(pid, extra) {
    const st = App.state, world = App.world;
    if (!st) return;
    const me = st.countries[st.playerId];
    const sel = App.selection;
    extra = extra || {};

    if (pid < 0 || !st.provinces[pid]) {
      // brak wyboru — karta kraju gracza
      let html = '';
      html += '<div class="pv-title"><span class="chip" style="background:' + me.color + '"></span>' +
        '<span class="pv-name">' + Util.escapeHtml(me.name) + '</span></div>';
      html += '<div class="pv-sub">Twoje państwo · ' + Util.escapeHtml(GameState.DIFFICULTY[st.difficulty].name) + '</div>';
      html += '<table class="kv">';
      html += '<tr><td>Skarbiec</td><td>' + Util.fmt(me.treasury) + '</td></tr>';
      html += '<tr><td>Dochód / utrzymanie</td><td>' + Util.fmt(me.income) + ' / ' + Util.fmt(me.upkeep) + '</td></tr>';
      html += '<tr><td>Armia</td><td>' + Util.fmt(me.troops) + '</td></tr>';
      html += '<tr><td>Prowincje</td><td>' + Util.fmt(me.provinceCount) + '</td></tr>';
      html += '<tr><td>Ludność</td><td>' + Util.fmtShort(me.pop) + '</td></tr>';
      html += '<tr><td>Gospodarka</td><td>' + Math.round(me.econ) + ' / 100</td></tr>';
      html += '<tr><td>Miejsce w rankingu</td><td>' + Logic.rankOf(st, st.playerId) + '</td></tr>';
      html += '</table>';
      const cap = me.capitalProvince;
      html += '<div class="actions">';
      if (cap >= 0) html += '<button class="btn" data-act="goto" data-arg="' + cap + '">Pokaż stolicę</button>';
      html += '<button class="btn" data-act="armynav" data-arg="">Największa armia</button>';
      html += '<button class="btn full" data-act="help" data-arg="">Zasady i sterowanie</button>';
      html += '</div>';
      html += '<div class="tip">Kliknij prowincję na mapie, aby wydać rozkazy. Kliknij spację, aby zakończyć turę.</div>';
      refs.panel.innerHTML = html;
      return;
    }

    const pv = st.provinces[pid];
    const owner = st.countries[pv.country];
    const mine = pv.country === st.playerId;
    const maxT = GameState.maxTroops(st, pid);
    const wp = world.provinces[pid];
    let html = '';
    html += '<div class="pv-title"><span class="chip" style="background:' + owner.color + '"></span>' +
      '<span class="pv-name">' + Util.escapeHtml(pv.name) + '</span></div>';
    html += '<div class="pv-sub">' + Util.escapeHtml(owner.name) + (mine ? ' <b>(Ty)</b>' : '') +
      (pv.isCapital ? ' · gród stołeczny' : '') +
      (wp.coastal ? ' · wybrzeże' : '') + '</div>';
    if (!mine) html += '<div style="margin-bottom:6px">' + relTag(st, st.playerId, pv.country) + '</div>';
    html += '<table class="kv">';
    html += '<tr><td>Ludność</td><td>' + Util.fmt(pv.pop) + '</td></tr>';
    html += '<tr><td>Gospodarka</td><td>' + Math.round(pv.econ) + ' / 100</td></tr>';
    html += '<tr><td>Fortyfikacje</td><td>' + pv.fort + ' / 5</td></tr>';
    html += '<tr><td>Garnizon</td><td>' + Util.fmt(pv.troops) + ' / ' + Util.fmt(maxT) + '</td></tr>';
    html += '<tr><td>Dochód / turę</td><td>' + Util.fmt(pv.income || Logic.provinceIncome(st, pv)) + '</td></tr>';
    if (mine) {
      html += '<tr><td>Gotowość armii</td><td>' + (pv.moved ? '<span style="color:var(--red)">działała</span>' : 'gotowa') + '</td></tr>';
      if (pv.revolt) html += '<tr><td>Bunt</td><td>' + Math.round(pv.revolt * 100) + '%</td></tr>';
    }
    html += '</table>';

    if (mine) {
      const cRecruit = Logic.RECRUIT_COST;
      const investCost = Math.round(90 + pv.econ * 3);
      const fortCost = 110 * (pv.fort + 1);
      const room = maxT - pv.troops;
      html += '<div class="actions">';
      html += '<button class="btn" data-act="recruit" data-arg="1" ' + (room < 1 || me.treasury < cRecruit ? 'disabled' : '') + '>Rekrutuj +1<br><span class="muted" style="font-size:11px">' + cRecruit + ' szt. zł</span></button>';
      html += '<button class="btn" data-act="recruit" data-arg="5" ' + (room < 1 || me.treasury < cRecruit * 5 ? 'disabled' : '') + '>Rekrutuj +5<br><span class="muted" style="font-size:11px">' + (cRecruit * 5) + ' szt. zł</span></button>';
      html += '<button class="btn" data-act="recruit" data-arg="max" ' + (room < 1 || me.treasury < cRecruit ? 'disabled' : '') + '>Rekrutuj maks.<br><span class="muted" style="font-size:11px">' + cRecruit + ' / żołnierz</span></button>';
      html += '<button class="btn" data-act="invest" data-arg="" ' + (me.treasury < investCost || pv.econ >= 100 ? 'disabled' : '') + '>Inwestycje<br><span class="muted" style="font-size:11px">' + Util.fmt(investCost) + '</span></button>';
      html += '<button class="btn" data-act="fortify" data-arg="" ' + (me.treasury < fortCost || pv.fort >= 5 ? 'disabled' : '') + '>Fortyfikuj<br><span class="muted" style="font-size:11px">' + Util.fmt(fortCost) + '</span></button>';
      if (pv.troops > 0) {
        html += '<button class="btn ' + (sel.mode === 'move' ? 'btn-primary' : '') + '" data-act="mode-move" data-arg="">' +
          (sel.mode === 'move' ? 'Ruch: wybierz cel' : 'Rusz armię') + '</button>';
        html += '<button class="btn wide ' + (sel.mode === 'attack' ? 'btn-danger' : '') + '" data-act="mode-attack" data-arg="">' +
          (sel.mode === 'attack' ? 'Atak: wybierz cel' : 'Atakuj') + '</button>';
      } else {
        html += '<button class="btn wide" data-act="recruit" data-arg="5">Brak żołnierzy — rekrutuj</button>';
      }
      html += '</div>';
      if (sel.mode) {
        const targets = sel.mode === 'move' ? App.currentMoveTargets() : App.currentAttackTargets();
        const cnt = targets ? targets.size : 0;
        html += '<div class="tip">Tryb <b>' + (sel.mode === 'move' ? 'ruchu' : 'ataku') + '</b>: na mapie podświetlono ' +
          cnt + ' ' + Util.plural(cnt, 'cel', 'cele', 'celów') + '. Kliknij prowincję docelową lub PPM, aby anulować.</div>';
      }
      if (sel.mode === 'attack' && extra.odds) {
        html += '<div class="battle"><div class="odds">Szacunek szturmu na <b>' + Util.escapeHtml(extra.odds.name) + '</b>: ' +
          'twoja siła <b>' + Util.fmt(extra.odds.attacker) + '</b> vs <b>' + Util.fmt(extra.odds.defender) + '</b> obrońcy' +
          (extra.odds.sea ? ' <span class="tag">desant morski</span>' : '') + '</div></div>';
      }
    } else {
      // karta obcego państwa
      html += '<div class="actions">';
      const rel = GameState.relation(st, st.playerId, pv.country);
      if (rel !== GameState.REL.WAR && !Logic.truceActive(st, st.playerId, pv.country)) {
        html += '<button class="btn btn-danger" data-act="war" data-arg="' + pv.country + '">Wypowiedz wojnę</button>';
      } else if (rel === GameState.REL.WAR) {
        html += '<button class="btn" data-act="peace" data-arg="' + pv.country + '">Zaproponuj pokój</button>';
      } else {
        html += '<button class="btn" disabled>Rozejm obowiązuje</button>';
      }
      if (rel !== GameState.REL.ALLY) {
        html += '<button class="btn" data-act="alliance" data-arg="' + pv.country + '">Zaproponuj sojusz</button>';
      } else {
        html += '<button class="btn" data-act="breakally" data-arg="' + pv.country + '">Zerwij sojusz</button>';
      }
      html += '<button class="btn full" data-act="goto" data-arg="' + pv.country + '" data-kind="country">Pokaż państwo</button>';
      html += '</div>';
      // skrót informacji o państwie
      html += '<div class="sep"></div>';
      html += '<table class="kv">';
      html += '<tr><td>Prowincje</td><td>' + Util.fmt(owner.provinceCount) + '</td></tr>';
      html += '<tr><td>Armia</td><td>' + Util.fmt(owner.troops) + '</td></tr>';
      html += '<tr><td>Ludność</td><td>' + Util.fmtShort(owner.pop) + '</td></tr>';
      html += '<tr><td>Gospodarka</td><td>' + Math.round(owner.econ) + ' / 100</td></tr>';
      html += '<tr><td>Siła (ranking)</td><td>' + Logic.rankOf(st, owner.id) + '</td></tr>';
      html += '</table>';
    }
    refs.panel.innerHTML = html;
  }

  /* -------------------------------------------------------------- kronika */
  function renderLog() {
    const st = App.state;
    if (!st) return;
    const items = st.log.filter(function (e) {
      if (!logFilterMine) return true;
      const me = st.countries[st.playerId];
      return e.text.indexOf(me.name) >= 0 || e.type === 'good' || e.type === 'bad';
    }).slice(-140).reverse();
    let html = '';
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      html += '<div class="log-item ' + (e.type || 'info') + '"><span class="ly">' + e.year + '</span>' +
        Util.escapeHtml(e.text) + '</div>';
    }
    refs.logList.innerHTML = html || '<div class="muted">Brak wydarzeń.</div>';
  }

  function banner(text, ms) {
    refs.banner.textContent = text;
    refs.banner.classList.remove('hidden');
    clearTimeout(banner._t);
    banner._t = setTimeout(function () { refs.banner.classList.add('hidden'); }, ms || 2200);
  }

  /* ------------------------------------------------------------- tooltip -- */
  function showTooltip(html, x, y) {
    refs.tooltip.innerHTML = html;
    refs.tooltip.classList.remove('hidden');
    const rect = refs.tooltip.getBoundingClientRect();
    const stage = $('stage').getBoundingClientRect();
    let left = x + 16, top = y + 16;
    if (left + rect.width > stage.width - 8) left = x - rect.width - 14;
    if (top + rect.height > stage.height - 8) top = Math.max(4, y - rect.height - 12);
    refs.tooltip.style.left = left + 'px';
    refs.tooltip.style.top = top + 'px';
  }
  function hideTooltip() { refs.tooltip.classList.add('hidden'); }

  /* --------------------------------------------------------------- modal -- */
  function openModal(html, opts) {
    opts = opts || {};
    refs.modalBox.innerHTML = html;
    refs.modal.classList.remove('hidden');
    if (opts.onOpen) opts.onOpen(refs.modalBox);
  }
  function closeModal() {
    refs.modal.classList.add('hidden');
    refs.modalBox.innerHTML = '';
    if (App && App.onModalClosed) App.onModalClosed();
  }
  function isModalOpen() { return !refs.modal.classList.contains('hidden'); }

  function setThinking(on) {
    refs.thinking.classList.toggle('hidden', !on);
  }

  return {
    init: init, refs: function () { return refs; },
    setProgress: setProgress, hideLoader: hideLoader,
    refreshTop: refreshTop, showSelected: showSelected, renderLog: renderLog,
    banner: banner, showTooltip: showTooltip, hideTooltip: hideTooltip,
    openModal: openModal, closeModal: closeModal, isModalOpen: isModalOpen,
    setThinking: setThinking, relTag: relTag
  };
})();
