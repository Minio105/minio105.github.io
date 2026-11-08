"use strict";

/* =======================================================================
   🌍 EVENTY ŚWIATA + ✨ MINI EVENTY + 👑 ADMIN ABUSE W ŚWIĘTA
   -----------------------------------------------------------------------
   Losowe eventy włączają się same co 18–42 min i dają bonusy do dropów,
   sprzedaży albo wartości przedmiotów. Mini eventy wpadają co 3–8 min
   i dają drobiazgi: koniczynę, kilka monet, EXP albo uszkodzoną skrzynkę.
   W polskie święta (16:00–19:00) uruchamia się ADMIN ABUSE: dodatkowe
   monety, darmowe skrzynki i wszystkie efekty eventowe.
   ======================================================================= */

const WORLD_EVENT_KEY = "caseOpenerWorldEvents_v1";
const WE_MIN = 60 * 1000;
const WE_TICK_MS = 5000;
const WE_FIRST_DELAY = 45 * 1000;
const WE_GAP_MIN = 18 * WE_MIN;
const WE_GAP_MAX = 42 * WE_MIN;

const FIXED_HOLIDAYS = {
  "01-01": "Nowy Rok",
  "01-06": "Trzech Króli",
  "02-14": "Walentynki",
  "04-01": "Prima Aprilis",
  "05-01": "Majówka",
  "05-03": "Święto Konstytucji 3 Maja",
  "06-01": "Dzień Dziecka",
  "08-15": "Wniebowzięcie NMP",
  "10-31": "Halloween",
  "11-01": "Wszystkich Świętych",
  "11-11": "Święto Niepodległości",
  "12-06": "Mikołajki",
  "12-24": "Wigilia",
  "12-25": "Boże Narodzenie",
  "12-26": "Drugi dzień świąt",
  "12-31": "Sylwester"
};

const WORLD_EVENTS = [
  {
    id: "gold_rush", name: "Złota Gorączka", icon: "🪙", color: "#ffd700",
    desc: "Rynek płaci premium — każdy sprzedany skin jest wart więcej.",
    short: "+25% wartości sprzedaży",
    sell: 0.25, weight: 3, dur: 30 * WE_MIN
  },
  {
    id: "fx_storm", name: "Burza Efektów", icon: "✨", color: "#38e08a",
    desc: "Efekty na broniach sypią się jak confetti, a eventowe wykończenia wracają do puli.",
    short: "+10% szansy na efekt · eventowe efekty",
    luck: 0.10, fx: ["neon", "gold", "diamond", "xmas", "hallow", "ny", "easter"],
    weight: 3, dur: 25 * WE_MIN
  },
  {
    id: "lucky_hour", name: "Godzina Szczęścia", icon: "🍀", color: "#45e6ff",
    desc: "Wszystko układa się po Twojej myśli — więcej efektów i cenniejsze dropy.",
    short: "+6% luck · +10% wartości",
    luck: 0.06, value: 0.10, weight: 2, dur: 30 * WE_MIN
  },
  {
    id: "value_boom", name: "Boom Cenowy", icon: "📈", color: "#ff8a1e",
    desc: "Ceny skinów wystrzeliły. Każdy przedmiot ma wyższą wartość bazową.",
    short: "+20% wartości przedmiotów",
    value: 0.20, weight: 2, dur: 25 * WE_MIN
  },
  {
    id: "event_night", name: "Noc Eventowych Efektów", icon: "🎆", color: "#a855f7",
    desc: "Limitowane efekty eventowe pojawiają się na broniach.",
    short: "eventowe efekty · +5% luck",
    luck: 0.05, fx: ["xmas", "hallow", "ny", "easter"],
    weight: 2, dur: 35 * WE_MIN
  },
  {
    id: "chaos", name: "Chaos Losu", icon: "🌀", color: "#f472b6",
    desc: "Los postanowił kręcić gałkami. Krótki, ale bardzo mocny event.",
    short: "+35% sprzedaży · +15% wartości · +10% luck",
    sell: 0.35, value: 0.15, luck: 0.10,
    fx: ["xmas", "hallow", "ny", "easter"],
    weight: 1, dur: 20 * WE_MIN
  }
];

const ADMIN_ABUSE = {
  id: "admin_abuse", name: "ADMIN ABUSE", icon: "👑", color: "#ff4fd8",
  admin: true,
  desc: "To święta! Admin rozdaje monety, dorzuca skrzynki i włącza wszystkie eventowe efekty.",
  short: "+50% sprzedaży · +25% wartości · +20% luck · monety i skrzynki",
  sell: 0.50, value: 0.25, luck: 0.20,
  fx: "all",
  freeCoins: 25000,
  freeCaseEvery: 10 * WE_MIN,
  dur: 3 * 60 * WE_MIN
};

const WORLD_EVENT_BY_ID = {};
WORLD_EVENTS.forEach(e => { WORLD_EVENT_BY_ID[e.id] = e; });
WORLD_EVENT_BY_ID[ADMIN_ABUSE.id] = ADMIN_ABUSE;

/* =======================================================================
   ✨ MINI EVENTY
   -----------------------------------------------------------------------
   Małe, losowe bonusy wpadające co 3–8 minut. Dają prawie nic — odrobinę
   koniczyny, kilka monet, 2 EXP albo uszkodzoną skrzynkę — ale coś.
   ======================================================================= */
const MINI_EVENT_KEY = "caseOpenerMiniEvents_v1";
const MINI_FIRST_DELAY = 75 * 1000;
const MINI_GAP_MIN = 3 * WE_MIN;
const MINI_GAP_MAX = 8 * WE_MIN;

const MINI_EVENTS = [
  {
    id: "clover_patch", name: "Koniczyna na chodniku", icon: "🍀", color: "#38e08a",
    desc: "Znalazłeś czterolistną koniczynę. Na chwilę poprawia szanse.",
    short: "+1–3 min koniczyny", weight: 4, kind: "clover", minMs: 60000, maxMs: 180000
  },
  {
    id: "lost_coin", name: "Zgubiona moneta", icon: "🪙", color: "#ffd166",
    desc: "Ktoś zgubił drobniaki. Twoje szczęście.",
    short: "+drobne monety", weight: 4, kind: "coins", pct: 0.002, min: 100, max: 5000
  },
  {
    id: "xp_spark", name: "Iskra doświadczenia", icon: "✨", color: "#8ee7ff",
    desc: "Mały błysk na koncie — coś tam wpadło.",
    short: "+2 EXP", weight: 2, kind: "exp", amount: 2
  },
  {
    id: "scrap_case", name: "Uszkodzona skrzynka", icon: "📦", color: "#f59e0b",
    desc: "Ktoś wyrzucił lekko uszkodzoną skrzynkę. Nadaje się do otwarcia.",
    short: "+1 tania skrzynka", weight: 1, kind: "case", maxPrice: 1000
  },
  {
    id: "bot_tip", name: "Napiwek od bota", icon: "🤖", color: "#4b9bff",
    desc: "Bot dorzucił kilka monet „na kawę”.",
    short: "+drobne monety", weight: 2, kind: "coins", pct: 0.0015, min: 50, max: 3000
  }
];

let miniEventState = {
  nextAt: 0,
  history: []
};

let worldEventState = {
  active: null,
  nextAt: 0,
  history: [],
  adminRewardAt: 0,
  adminCaseAt: 0,
  adminRewardCount: 0
};
let worldEventTimer = null;

/* --------------------------- pomocnicze --------------------------- */
function wePad(n){ return String(n).padStart(2, "0"); }
function weDateKey(d){ return wePad(d.getMonth() + 1) + "-" + wePad(d.getDate()); }
function weSameDay(a, b){
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function weAt(d, h, m){
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
}
function weMmss(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? h + ":" + wePad(m) + ":" + wePad(sec) : wePad(m) + ":" + wePad(sec);
}
function weClock(ts){
  const d = new Date(ts);
  return wePad(d.getHours()) + ":" + wePad(d.getMinutes());
}
function weDay(ts){
  return new Date(ts).toLocaleDateString("pl-PL", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}
function weEventDef(id){ return WORLD_EVENT_BY_ID[id] || null; }
function weRandomGap(){ return WE_GAP_MIN + Math.floor(Math.random() * (WE_GAP_MAX - WE_GAP_MIN + 1)); }

/* --------------------------- święta --------------------------- */
function weEaster(year){
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}
function weHolidayFor(date){
  const key = weDateKey(date);
  if(FIXED_HOLIDAYS[key]) return { id: "h_" + key, name: FIXED_HOLIDAYS[key] };
  const e = weEaster(date.getFullYear());
  const easter = new Date(date.getFullYear(), e.month - 1, e.day);
  if(weSameDay(date, easter)) return { id: "easter", name: "Wielkanoc" };
  const monday = new Date(easter); monday.setDate(monday.getDate() + 1);
  if(weSameDay(date, monday)) return { id: "easter_monday", name: "Poniedziałek Wielkanocny" };
  const corpus = new Date(easter); corpus.setDate(corpus.getDate() + 60);
  if(weSameDay(date, corpus)) return { id: "corpus", name: "Boże Ciało" };
  return null;
}
function weAdminWindowFor(date){
  const holiday = weHolidayFor(date);
  if(!holiday) return null;
  return {
    holiday,
    start: weAt(date, 16, 0).getTime(),
    end: weAt(date, 19, 0).getTime()
  };
}
function weCurrentAdminWindow(now){
  const w = weAdminWindowFor(new Date(now));
  return (w && now >= w.start && now < w.end) ? w : null;
}
function weNextAdminWindow(now){
  const base = new Date(now);
  for(let i = 0; i < 370; i++){
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const w = weAdminWindowFor(day);
    if(w && w.end > now) return w;
  }
  return null;
}
function weNextHolidays(now, count){
  const out = [];
  const base = new Date(now);
  for(let i = 0; i < 370 && out.length < count; i++){
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const h = weHolidayFor(day);
    const w = weAdminWindowFor(day);
    if(h && w && w.end > now) out.push({ name: h.name, date: day, window: w });
  }
  return out;
}

/* --------------------------- stan / zapis --------------------------- */
function worldEventLoad(){
  try{
    const raw = localStorage.getItem(WORLD_EVENT_KEY);
    if(raw){
      const o = JSON.parse(raw);
      if(o && typeof o === "object"){
        if(o.active && typeof o.active === "object") worldEventState.active = o.active;
        if(Number.isFinite(o.nextAt)) worldEventState.nextAt = o.nextAt;
        if(Array.isArray(o.history)) worldEventState.history = o.history.slice(0, 8);
        if(Number.isFinite(o.adminRewardAt)) worldEventState.adminRewardAt = o.adminRewardAt;
        if(Number.isFinite(o.adminCaseAt)) worldEventState.adminCaseAt = o.adminCaseAt;
        if(Number.isFinite(o.adminRewardCount)) worldEventState.adminRewardCount = o.adminRewardCount;
      }
    }
  }catch(e){}
  const now = Date.now();
  if(worldEventState.active){
    const a = worldEventState.active;
    const def = weEventDef(a.id);
    if(!def || !(a.end > now)){
      if(def && a.end <= now) weHistoryAdd(a);
      worldEventState.active = null;
    }
  }
  if(!worldEventState.nextAt || worldEventState.nextAt < now - 5 * WE_MIN) worldEventState.nextAt = now + WE_FIRST_DELAY;
  if(!worldEventState.active && worldEventState.nextAt < now) worldEventState.nextAt = now + 15 * 1000;
  worldEventSyncGlobal();
}
function worldEventSave(){
  try{
    localStorage.setItem(WORLD_EVENT_KEY, JSON.stringify({
      active: worldEventState.active,
      nextAt: worldEventState.nextAt,
      history: worldEventState.history.slice(0, 8),
      adminRewardAt: worldEventState.adminRewardAt,
      adminCaseAt: worldEventState.adminCaseAt,
      adminRewardCount: worldEventState.adminRewardCount
    }));
  }catch(e){}
}
function worldEventSyncGlobal(){
  window.WORLD_EVENT = worldEventActive();
}
function weHistoryAdd(active){
  const def = weEventDef(active.id);
  if(!def) return;
  worldEventState.history = [{
    id: active.id,
    name: def.name,
    icon: def.icon,
    start: active.start,
    end: active.end,
    admin: !!def.admin
  }].concat(worldEventState.history.filter(h => h && h.start !== active.start)).slice(0, 8);
}

/* --------------------------- API dla reszty gry --------------------------- */
function worldEventActive(){
  if(!worldEventState.active) return null;
  const def = weEventDef(worldEventState.active.id);
  if(!def) return null;
  return Object.assign({}, def, {
    start: worldEventState.active.start,
    end: worldEventState.active.end,
    admin: !!def.admin
  });
}
function worldEventFxIds(){
  const ev = worldEventActive();
  if(!ev || !ev.fx) return [];
  if(ev.fx === "all") return EVENT_FX.map(f => f.id);
  return Array.isArray(ev.fx) ? ev.fx.slice() : [];
}
function worldEventLuck(){ const ev = worldEventActive(); return ev && ev.luck ? ev.luck : 0; }
function worldEventSellBonus(){ const ev = worldEventActive(); return ev && ev.sell ? ev.sell : 0; }
function worldEventValueBonus(){ const ev = worldEventActive(); return ev && ev.value ? ev.value : 0; }

/* --------------------------- start / koniec --------------------------- */
function weStartEvent(id, opts){
  opts = opts || {};
  const def = weEventDef(id);
  if(!def) return;
  const now = Date.now();
  const start = opts.start || now;
  const end = opts.end || (start + (def.dur || 30 * WE_MIN));
  worldEventState.active = { id: def.id, start, end };
  worldEventState.nextAt = 0;
  worldEventState.adminRewardAt = def.admin ? now + 5000 : 0;
  worldEventState.adminCaseAt = def.admin ? now + 30 * 1000 : 0;
  worldEventState.adminRewardCount = 0;
  worldEventSave();
  worldEventSyncGlobal();
  renderWorldEventUI();
  if(typeof currentView !== "undefined" && currentView === "events") renderEvents();
  if(def.admin){
    toast("👑 <b>ADMIN ABUSE!</b> To święta — admin rozdaje monety, skrzynki i włącza wszystkie efekty eventowe!", "good");
    confetti(["#ff4fd8", "#ffd700", "#45e6ff", "#38e08a", "#ffffff"]);
    sfxWin("special");
  } else {
    toast("🎉 <b>EVENT: " + def.icon + " " + def.name + "</b><br>" + def.short, "good");
    confetti([def.color, "#ffffff"]);
    sfxWin("covert");
  }
}
function weEndEvent(opts){
  opts = opts || {};
  const active = worldEventState.active;
  if(!active) return;
  const def = weEventDef(active.id);
  weHistoryAdd(active);
  worldEventState.active = null;
  worldEventState.adminRewardAt = 0;
  worldEventState.adminCaseAt = 0;
  if(!opts.noSchedule) worldEventState.nextAt = Date.now() + weRandomGap();
  worldEventSave();
  worldEventSyncGlobal();
  renderWorldEventUI();
  if(typeof currentView !== "undefined" && currentView === "events") renderEvents();
  if(!opts.silent && def){
    toast("⏹️ Event <b>" + def.icon + " " + def.name + "</b> zakończony.", "bad");
  }
}

/* --------------------------- losowanie --------------------------- */
function wePickRandomEvent(){
  let total = 0;
  WORLD_EVENTS.forEach(e => { total += e.weight || 1; });
  let r = Math.random() * total;
  let picked = WORLD_EVENTS[0];
  for(const e of WORLD_EVENTS){
    r -= (e.weight || 1);
    if(r <= 0){ picked = e; break; }
  }
  return picked;
}
function weStartRandomEvent(now){
  let def = wePickRandomEvent();
  const last = worldEventState.history[0];
  for(let i = 0; i < 4 && last && last.id === def.id; i++) def = wePickRandomEvent();
  weStartEvent(def.id, { start: now, end: now + def.dur });
}

/* --------------------------- nagrody admina --------------------------- */
function weGrantAdminCoins(now){
  const gain = Math.max(1000, Math.round(ADMIN_ABUSE.freeCoins || 25000));
  state.coins += gain;
  state.stats.earned = numFrom(state.stats.earned) + gain;
  save({ kind: "event" });
  renderBalance();
  worldEventState.adminRewardAt = now + 60 * 1000;
  worldEventState.adminRewardCount = (worldEventState.adminRewardCount || 0) + 1;
  worldEventSave();
  if(!document.hidden && (worldEventState.adminRewardCount === 1 || worldEventState.adminRewardCount % 5 === 0)){
    toast("👑 <b>ADMIN ABUSE:</b> admin dorzucił 🪙 " + fmt(gain) + "!", "good");
    sfxCoin();
  }
}
function weGrantAdminCase(now){
  /* darmowe skrzynki z admin abuse: maks. 120 tys., żeby event nie rozdawał
     milionowych skrzynek co 10 minut */
  const pool = CASES.filter(c => c && c.price > 0 && c.price <= 120000 && !c.botOnly && !c.noBattle && !c.troll);
  if(!pool.length) return;
  const c = pool[Math.floor(Math.random() * pool.length)];
  state.caseStock = state.caseStock || {};
  state.caseStock[c.id] = (state.caseStock[c.id] || 0) + 1;
  save({ kind: "event" });
  if(typeof renderShop === "function") renderShop();
  worldEventState.adminCaseAt = now + (ADMIN_ABUSE.freeCaseEvery || 10 * WE_MIN);
  worldEventSave();
  if(!document.hidden){
    toast("👑 <b>ADMIN ABUSE:</b> darmowa skrzynka <b>" + esc(c.name) + "</b> trafiła do zapasu!", "good");
    sfxWin("covert");
  }
}

/* --------------------------- mini eventy --------------------------- */
function miniEventSave(){
  try{
    localStorage.setItem(MINI_EVENT_KEY, JSON.stringify({
      nextAt: miniEventState.nextAt,
      history: miniEventState.history.slice(0, 8)
    }));
  }catch(e){}
}
function miniEventLoad(){
  try{
    const raw = localStorage.getItem(MINI_EVENT_KEY);
    if(raw){
      const o = JSON.parse(raw);
      if(o && typeof o === "object"){
        if(Number.isFinite(o.nextAt)) miniEventState.nextAt = o.nextAt;
        if(Array.isArray(o.history)) miniEventState.history = o.history.filter(h => h && h.at).slice(0, 8);
      }
    }
  }catch(e){}
  const now = Date.now();
  if(!miniEventState.nextAt || miniEventState.nextAt < now - 5 * WE_MIN){
    miniEventState.nextAt = now + MINI_FIRST_DELAY;
  }
  miniEventSave();
}
function miniEventReset(){
  try{ localStorage.removeItem(MINI_EVENT_KEY); }catch(e){}
  miniEventState = { nextAt: Date.now() + MINI_FIRST_DELAY, history: [] };
  miniEventSave();
  renderMiniEventPanel();
}
function miniEventRandomGap(){
  return MINI_GAP_MIN + Math.floor(Math.random() * (MINI_GAP_MAX - MINI_GAP_MIN + 1));
}
function miniEventPick(){
  let total = 0;
  MINI_EVENTS.forEach(e => { total += (e.weight || 1); });
  let r = Math.random() * total;
  for(const e of MINI_EVENTS){
    r -= (e.weight || 1);
    if(r <= 0) return e;
  }
  return MINI_EVENTS[0];
}
function miniEventCoins(def){
  const v = Math.max(def.min || 0, Math.min(def.max || Infinity, Math.round(numFrom(state.coins) * (def.pct || 0) / 10) * 10));
  return Math.max(1, v);
}
function miniEventReward(def){
  if(def.kind === "clover"){
    const ms = Math.round((def.minMs + Math.random() * (def.maxMs - def.minMs)) / 1000) * 1000;
    state.cloverUntil = Math.max(Date.now(), state.cloverUntil || 0) + ms;
    state.stats.clovers = numFrom(state.stats.clovers) + 1;
    if(typeof updateClover === "function") updateClover();
    sfxClover();
    return "+" + Math.round(ms / 60000) + " min koniczyny";
  }
  if(def.kind === "coins"){
    const gain = miniEventCoins(def);
    state.coins += gain;
    state.stats.earned = numFrom(state.stats.earned) + gain;
    renderBalance();
    sfxCoin();
    return "+🪙 " + fmt(gain);
  }
  if(def.kind === "exp"){
    const amount = Math.max(1, def.amount | 0);
    if(typeof addExp === "function") addExp(amount, "mini_event");
    return "+" + amount + " EXP";
  }
  if(def.kind === "case"){
    const pool = CASES.filter(c => c && c.price > 0 && c.price <= (def.maxPrice || 1000) && !c.botOnly && !c.noItems && !c.troll && !c.secret && !c.mega && !c.elite && !c.ultra);
    const c = pool.length ? pool[Math.floor(Math.random() * pool.length)] : CASES.find(x => x.id === "start");
    if(c){
      state.caseStock = (state.caseStock && typeof state.caseStock === "object" && !Array.isArray(state.caseStock)) ? state.caseStock : {};
      state.caseStock[c.id] = numFrom(state.caseStock[c.id]) + 1;
      if(typeof renderShop === "function") renderShop();
      if(typeof renderBots === "function") renderBots();
      sfxCoin();
      return "🎁 " + esc(c.name) + " (zapas)";
    }
  }
  return "coś małego";
}
function miniEventTrigger(now){
  const def = miniEventPick();
  const rewardText = miniEventReward(def);
  if(typeof renderDailyHub === "function") renderDailyHub();
  miniEventState.history = [{
    id: def.id, name: def.name, icon: def.icon, at: now, text: rewardText
  }].concat(miniEventState.history.filter(h => h && !(h.id === def.id && h.at === now))).slice(0, 8);
  miniEventState.nextAt = now + miniEventRandomGap();
  miniEventSave();
  markDirty();
  if(typeof checkAchievements === "function") checkAchievements();
  if(typeof save === "function") save({ kind: "event" });
  if(typeof currentView !== "undefined" && currentView === "events") renderEvents(false);
  toast("✨ <b>Mini event: " + def.icon + " " + esc(def.name) + "</b><br>" + rewardText, "good");
}
function miniEventTick(now){
  if(document.hidden) return;
  if(now < (miniEventState.nextAt || 0)) return;
  miniEventTrigger(now);
}
function miniEventPanelHTML(now){
  const next = miniEventState.nextAt || 0;
  const left = Math.max(0, next - now);
  const hist = miniEventState.history || [];
  const chips = MINI_EVENTS.map(e =>
    '<span class="mini-chip" title="' + esc(e.desc) + '"><span class="mc-ico">' + e.icon + '</span><b>' + esc(e.name) + '</b><small>' + esc(e.short) + '</small></span>'
  ).join("");
  const histHTML = hist.length
    ? hist.slice(0, 4).map(h =>
        '<div class="mini-hist-row"><span class="mh-ico">' + (h.icon || "✨") + '</span><b>' + esc(h.name || h.id) + '</b><small>' + esc(h.text || "") + ' · ' + weClock(h.at) + '</small></div>'
      ).join("")
    : '<div class="mini-empty">Jeszcze nic nie wpadło. Mini eventy startują same.</div>';
  return '<div class="world-card mini-card">' +
    '<div class="mini-head"><div><div class="wa-kicker">✨ MINI EVENTY</div><h3>Drobne bonusy co 3–8 min</h3></div>' +
    '<span class="mini-badge">' + (left > 0 ? "za " + weMmss(left) : "lada chwila") + '</span></div>' +
    '<p class="muted">Nic wielkiego — koniczyna, kilka monet, 2 EXP albo uszkodzona skrzynka. Ale zawsze coś.</p>' +
    '<div class="mini-list">' + chips + '</div>' +
    '<div class="mini-hist">' + histHTML + '</div>' +
    '</div>';
}
function renderMiniEventPanel(){
  const el = document.getElementById("miniEventPanel");
  if(el) el.innerHTML = miniEventPanelHTML(Date.now());
}

/* --------------------------- pętla --------------------------- */
function worldEventTick(){
  const now = Date.now();
  const adminWindow = weCurrentAdminWindow(now);
  if(adminWindow){
    if(!worldEventState.active || worldEventState.active.id !== ADMIN_ABUSE.id){
      if(worldEventState.active) weEndEvent({ silent: true, noSchedule: true });
      weStartEvent(ADMIN_ABUSE.id, { start: adminWindow.start, end: adminWindow.end });
    }
    if(now >= (worldEventState.adminRewardAt || 0)) weGrantAdminCoins(now);
    if(now >= (worldEventState.adminCaseAt || 0)) weGrantAdminCase(now);
  } else {
    if(worldEventState.active && worldEventState.active.id === ADMIN_ABUSE.id){
      weEndEvent({ silent: false });
    }
    if(!worldEventState.active && now >= (worldEventState.nextAt || 0)) weStartRandomEvent(now);
    if(worldEventState.active && now >= worldEventState.active.end) weEndEvent();
  }
  renderWorldEventUI();
  miniEventTick(now);
  if(typeof currentView !== "undefined" && currentView === "events") renderEvents(false);
}

/* --------------------------- UI --------------------------- */
function weBonusChips(ev){
  const chips = [];
  if(ev.sell) chips.push("+" + Math.round(ev.sell * 100) + "% sprzedaży");
  if(ev.value) chips.push("+" + Math.round(ev.value * 100) + "% wartości");
  if(ev.luck) chips.push("+" + Math.round(ev.luck * 100) + "% luck");
  if(ev.fx) chips.push(ev.fx === "all" ? "wszystkie efekty eventowe" : "eventowe efekty");
  if(ev.admin){
    chips.push("+" + fmt(ADMIN_ABUSE.freeCoins || 25000) + " monet/min");
    chips.push("skrzynka co " + Math.round((ADMIN_ABUSE.freeCaseEvery || 10 * WE_MIN) / WE_MIN) + " min");
  }
  return chips;
}
function weChipsHTML(ev){
  return weBonusChips(ev).map(c => '<span class="ev-chip">' + esc(c) + '</span>').join("");
}
function renderWorldEventUI(){
  const ev = worldEventActive();
  const btn = document.getElementById("eventBtn");
  const bar = document.getElementById("eventBar");
  if(btn){
    if(ev){
      btn.classList.add("on");
      btn.classList.toggle("admin", !!ev.admin);
      btn.innerHTML = ev.icon + " " + (ev.admin ? "ADMIN" : "Event") + ' <span class="ev-cd">' + weMmss(ev.end - Date.now()) + "</span>";
      btn.title = ev.name + " — " + ev.short;
    } else {
      btn.classList.remove("on", "admin");
      btn.innerHTML = "🎉 Eventy";
      btn.title = "Losowe eventy, mini eventy i admin abuse w święta";
    }
  }
  if(bar){
    if(!ev){
      bar.hidden = true;
      bar.innerHTML = "";
      bar.className = "event-bar";
      document.body.classList.remove("world-event-on", "world-event-admin");
    } else {
      bar.hidden = false;
      bar.className = "event-bar" + (ev.admin ? " admin" : "");
      bar.style.setProperty("--ev", ev.color || "#ffb02e");
      bar.innerHTML =
        '<div class="eb-ico">' + ev.icon + '</div>' +
        '<div class="eb-main">' +
          '<div class="eb-kicker">' + (ev.admin ? "ŚWIĘTA · ADMIN ABUSE · 16:00–19:00" : "EVENT ŚWIATA · LOSOWY BONUS") + '</div>' +
          '<div class="eb-name">' + esc(ev.name) + '</div>' +
          '<div class="eb-desc">' + esc(ev.desc) + '</div>' +
          '<div class="eb-bonuses">' + weChipsHTML(ev) + '</div>' +
        '</div>' +
        '<div class="eb-time"><b>' + weMmss(ev.end - Date.now()) + '</b><small>do końca</small></div>';
      document.body.classList.add("world-event-on");
      document.body.classList.toggle("world-event-admin", !!ev.admin);
    }
  }
}
function weActivePanelHTML(ev, now){
  if(!ev){
    const next = worldEventState.nextAt || 0;
    const left = Math.max(0, next - now);
    return '<div class="world-card world-active empty">' +
      '<div class="wa-ico">🌙</div>' +
      '<div class="wa-main"><div class="wa-kicker">TERAZ SPOKÓJ</div>' +
      '<h3>Następny event za <b>' + weMmss(left) + '</b></h3>' +
      '<p class="muted">Eventy włączają się same co 18–42 min. Możesz też poczekać na święta i ADMIN ABUSE.</p></div>' +
      '</div>';
  }
  const total = Math.max(1, ev.end - ev.start);
  const pct = Math.max(0, Math.min(100, Math.round(((now - ev.start) / total) * 100)));
  const admin = !!ev.admin;
  return '<div class="world-card world-active' + (admin ? " admin" : "") + '" style="--ev:' + (ev.color || "#ffb02e") + '">' +
    '<div class="wa-ico">' + ev.icon + '</div>' +
    '<div class="wa-main">' +
      '<div class="wa-kicker">' + (admin ? "ŚWIĘTA · ADMIN ABUSE" : "AKTYWNY EVENT") + '</div>' +
      '<h3>' + esc(ev.name) + '</h3>' +
      '<p>' + esc(ev.desc) + '</p>' +
      '<div class="ev-chips">' + weChipsHTML(ev) + '</div>' +
      '<div class="wa-progress"><i style="width:' + pct + '%"></i></div>' +
      '<div class="wa-foot"><span>Start: <b>' + weClock(ev.start) + '</b></span><span>Koniec: <b>' + weClock(ev.end) + '</b></span><span>Pozostało: <b>' + weMmss(ev.end - now) + '</b></span></div>' +
    '</div>' +
    '<div class="wa-time"><b>' + weMmss(ev.end - now) + '</b><small>do końca</small></div>' +
    '</div>';
}
function weEventCardHTML(def, ev){
  const active = ev && ev.id === def.id;
  return '<div class="world-card event-def' + (active ? " active" : "") + '" style="--ev:' + def.color + '">' +
    '<div class="ed-top"><span class="ed-ico">' + def.icon + '</span><span class="ed-badge">' + (active ? "AKTYWNY" : "LOSOWY") + '</span></div>' +
    '<h4>' + esc(def.name) + '</h4>' +
    '<p>' + esc(def.desc) + '</p>' +
    '<div class="ev-chips">' + weChipsHTML(def) + '</div>' +
    '<div class="ed-meta">Czas: <b>' + Math.round(def.dur / WE_MIN) + ' min</b> · szansa: <b>' + (def.weight >= 3 ? "wysoka" : def.weight === 2 ? "średnia" : "niska") + '</b></div>' +
    '</div>';
}
function weHolidayHTML(now){
  const active = worldEventActive();
  const adminActive = active && active.admin;
  const next = weNextAdminWindow(now);
  const nextHolidays = weNextHolidays(now, 5);
  const nextStart = next ? next.start : 0;
  const left = next ? Math.max(0, nextStart - now) : 0;
  const nextTxt = next ? (weDay(next.start) + " · " + weClock(next.start) + "–" + weClock(next.end)) : "brak w najbliższym roku";
  const list = nextHolidays.map(h => '<div class="holiday-row"><span>' + esc(h.name) + '</span><b>' + weDay(h.window.start) + '</b><small>16:00–19:00</small></div>').join("");
  return '<div class="world-card holiday-card' + (adminActive ? " admin" : "") + '">' +
    '<div class="hc-head"><div><div class="wa-kicker">👑 ADMIN ABUSE</div><h3>Święta = prezenty od admina</h3></div><span class="hc-badge">' + (adminActive ? "TRWA" : "16:00–19:00") + '</span></div>' +
    '<p class="muted">W każde polskie święto między <b>16:00 a 19:00</b> admin włącza wszystkie efekty eventowe, dodaje monety i dorzuca darmowe skrzynki.</p>' +
    '<div class="holiday-next"><span>Najbliższe okno:</span><b>' + esc(nextTxt) + '</b>' + (next ? '<small>za ' + weMmss(left) + '</small>' : '') + '</div>' +
    '<div class="holiday-list">' + list + '</div>' +
    '</div>';
}
function weHistoryHTML(){
  const h = worldEventState.history || [];
  if(!h.length) return '<div class="world-card history-card"><div class="wa-kicker">HISTORIA</div><p class="muted">Tu pojawią się zakończone eventy.</p></div>';
  return '<div class="world-card history-card"><div class="wa-kicker">HISTORIA EVENTÓW</div><div class="hist-list">' +
    h.slice(0, 6).map(x => '<div class="hist-row"><span class="hist-ico">' + (x.icon || "🎉") + '</span><b>' + esc(x.name || x.id) + '</b><small>' + weDay(x.start) + " · " + weClock(x.start) + "–" + weClock(x.end) + '</small></div>').join("") +
    '</div></div>';
}
function renderEvents(withBar){
  if(withBar !== false) renderWorldEventUI();
  const now = Date.now();
  const ev = worldEventActive();
  const activeEl = document.getElementById("eventActivePanel");
  if(activeEl) activeEl.innerHTML = weActivePanelHTML(ev, now);
  const miniEl = document.getElementById("miniEventPanel");
  if(miniEl) miniEl.innerHTML = miniEventPanelHTML(now);
  const listEl = document.getElementById("eventList");
  if(listEl) listEl.innerHTML = WORLD_EVENTS.map(def => weEventCardHTML(def, ev)).join("");
  const holEl = document.getElementById("eventHolidayPanel");
  if(holEl) holEl.innerHTML = weHolidayHTML(now);
  const histEl = document.getElementById("eventHistoryPanel");
  if(histEl) histEl.innerHTML = weHistoryHTML();
}

/* --------------------------- reset / start --------------------------- */
function worldEventReset(){
  try{ localStorage.removeItem(WORLD_EVENT_KEY); }catch(e){}
  worldEventState = {
    active: null,
    nextAt: Date.now() + WE_FIRST_DELAY,
    history: [],
    adminRewardAt: 0,
    adminCaseAt: 0,
    adminRewardCount: 0
  };
  worldEventSyncGlobal();
  if(typeof miniEventReset === "function") miniEventReset();
  renderWorldEventUI();
  if(typeof currentView !== "undefined" && currentView === "events") renderEvents();
}

/* start modułu */
worldEventLoad();
miniEventLoad();
if(document.getElementById("eventBtn")){
  document.getElementById("eventBtn").addEventListener("click", () => switchView("events"));
}
worldEventTimer = setInterval(worldEventTick, WE_TICK_MS);
document.addEventListener("visibilitychange", () => { if(!document.hidden) worldEventTick(); });
renderWorldEventUI();
renderMiniEventPanel();
setTimeout(worldEventTick, 1200);
