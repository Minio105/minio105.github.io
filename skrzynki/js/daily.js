"use strict";

/* =======================================================================
   14c. 📖 ALBUM KOLEKCJI + 🎯 MISJE DZIENNE
   ======================================================================= */
/* --- katalog wszystkich skinów: klucz "broń|skin" jest unikalny w grze --- */
const ALBUM = (()=>{
  const m = new Map();
  CASES.forEach(c=>TIERS.forEach(t=>(c.items[t]||[]).forEach(it=>{
    const w = it[0], n = it[1], k = w+"|"+n;
    if(!m.has(k)) m.set(k, {key:k, w, n, art:it[2], tier:t, caseId:c.id});
  })));
  return m;
})();
const ALBUM_TOTAL = ALBUM.size;
const CASE_KEYS = (()=>{
  const o = {};
  CASES.forEach(c=>{ o[c.id] = TIERS.reduce((a,t)=>a.concat((c.items[t]||[]).map(it=>it[0]+"|"+it[1])), []); });
  return o;
})();
/* Skrzynki bez własnych skinów (np. Troll) nie zaśmiecają albumu. */
const ALBUM_CASES = CASES.filter(c=>!c.noAlbum);
const ALBUM_CLOVER = 5*60000;                 // nagroda za komplet: 5 min koniczyny

let currentView = "shop";                     // widoczna zakładka (do renderowania na żywo)
let albumCase = null;                         // wybrana skrzynka w albumie (tylko ta sesja)
const albumCaseKeys = id => CASE_KEYS[id] || [];
const albumDone = id => { const k = albumCaseKeys(id); return k.length>0 && k.every(x=>state.album[x]); };
const albumReward = c => Math.round(c.price*15) + 2000;
function albumHave(){
  let n = 0;
  for(const k in state.album){ if(state.album[k] && ALBUM.has(k)) n++; }
  return n;
}

/* każdy zdobyty przedmiot trafia do albumu — na stałe, nawet gdy go sprzedasz */
function albumRegister(item){
  if(!item || !item.w || !item.n) return;
  const e = ALBUM.get(item.w+"|"+item.n);
  if(!e) return;
  const had = state.album[e.key]|0;
  state.album[e.key] = had + 1;
  if(had) return;
  missionTrack("discover", 1);
  albumCheck(e.caseId);
}

/* nagroda za skompletowanie skrzynki — jednorazowa, przyznawana od razu */
function albumCheck(caseId){
  if(!caseId || state.albumClaimed[caseId]) return;
  const c = CASES.find(x=>x.id===caseId);
  if(!c || !albumDone(caseId)) return;
  state.albumClaimed[caseId] = true;
  const coins = albumReward(c);
  state.coins += coins;
  state.cloverUntil = Math.max(Date.now(), state.cloverUntil||0) + ALBUM_CLOVER;
  state.stats.albums = (state.stats.albums|0) + 1;
  markDirty();
  sfxClover();
  confetti(["#ffd700","#8ee7ff","#4ade80","#ffffff"]);
  toast("📖 <b>Album skompletowany!</b> Skrzynka <b>"+esc(c.name)+"</b> — nagroda 🪙 "+fmt(coins)+" + 🍀 5 min koniczyny","good");
  renderBalance(); renderShop(); updateClover(); renderAlbum(); renderAlbumBadge();
  save();
}

function albumLoad(d){
  const a = (d && d.album && typeof d.album === "object" && !Array.isArray(d.album)) ? d.album : null;
  state.albumClaimed = (d && d.albumClaimed && typeof d.albumClaimed === "object") ? d.albumClaimed : {};
  state.album = {};
  if(a){
    Object.keys(a).forEach(k=>{ if(ALBUM.has(k)) state.album[k] = Math.max(1, a[k]|0); });
    return;
  }
  // migracja starego zapisu: album startuje z tego, co już masz w ekwipunku i historii
  let n = 0;
  state.inv.concat(state.recent).forEach(it=>{
    if(!it || !it.w || !it.n) return;
    const k = it.w+"|"+it.n;
    if(ALBUM.has(k) && !state.album[k]){ state.album[k] = 1; n++; }
  });
  markDirty();
  if(n) setTimeout(()=>toast("📖 <b>Album kolekcji</b>: rozpoznano "+n+" posiadanych "+plural(n,"skin","skiny","skinów"),"good"), 1500);
}

function renderAlbumBadge(){
  const b = $("#albumCount");
  if(b) b.textContent = String(ALBUM_CASES.filter(c=>albumDone(c.id)).length);
}

function albumCardHTML(p, c, t){
  const cnt = state.album[p.key]|0;
  const seed = (hash(p.key)>>>0).toString(36);
  const head = `<div class="item-art">${weaponSVG({w:p.w,n:p.n,tier:p.tier,art:p.art}, seed)}</div>`;
  const body = `<div class="item-body">
      <div class="item-weapon">${esc(p.w)}</div>
      <div class="item-skin">${esc(p.n)}</div>
      <div class="item-foot">
        <span class="item-tier">${t==="special"?"★ Special":t==="relic"?"✦ Relikt":TIER[t].name}</span>
        <span class="item-price">${cnt ? "🪙 "+fmtShort(itemValue(c, t, p.key)) : "— nieznane —"}</span>
      </div></div>`;
  if(!cnt) return `<div class="item-card tier-${p.tier} locked" style="--c:${TIER[p.tier].color}">
    ${head}<div class="lockmark">?</div>${body}</div>`;
  return `<div class="item-card tier-${p.tier}" style="--c:${TIER[p.tier].color}">
    ${cnt>1?`<span class="alb-count">×${fmt(cnt)}</span>`:""}
    ${t==="special"?'<span class="star">★</span>':t==="relic"?'<span class="star relic-star">✦</span>':""}
    ${head}${body}</div>`;
}

function renderAlbum(){
  const sum = $("#albSum"), pick = $("#albPick"), body = $("#albBody");
  if(!sum || !pick || !body) return;
  const have = albumHave(), total = ALBUM_TOTAL, pct = total ? 100*have/total : 0;
  const knifeAll = ALBUM_CASES.reduce((a,c)=>a+(c.items.special||[]).length, 0);
  const knifeGot = ALBUM_CASES.reduce((a,c)=>a+(c.items.special||[]).filter(it=>state.album[it[0]+"|"+it[1]]).length, 0);
  const doneN = ALBUM_CASES.filter(c=>albumDone(c.id)).length;
  sum.innerHTML = `
    <div class="alb-card"><label>Odkryte skiny</label><b>${fmt(have)} / ${fmt(total)}</b>
      <div class="sub">${pct.toFixed(1)}% całej kolekcji</div>
      <div class="alb-bar"><i style="width:${pct.toFixed(2)}%"></i></div></div>
    <div class="alb-card"><label>★ Zdobyte noże</label><b>${fmt(knifeGot)} / ${fmt(knifeAll)}</b>
      <div class="sub">najrzadsze ostrza w grze</div>
      <div class="alb-bar"><i style="width:${knifeAll?100*knifeGot/knifeAll:0}%"></i></div></div>
    <div class="alb-card"><label>Skompletowane skrzynki</label><b>${fmt(doneN)} / ${ALBUM_CASES.length}</b>
      <div class="sub">za komplet: 🪙 + 🍀 5 min</div>
      <div class="alb-bar"><i style="width:${ALBUM_CASES.length?100*doneN/ALBUM_CASES.length:0}%"></i></div></div>`;
  const hint = $("#albumHint");
  if(hint) hint.textContent = have
    ? "znaleziska zapisują się na stałe — nawet po sprzedaży przedmiotu"
    : "otwieraj skrzynki, żeby zapełnić album";

  if(!albumCase || !ALBUM_CASES.some(c=>c.id===albumCase))
    albumCase = (ALBUM_CASES.find(c=>!albumDone(c.id)) || ALBUM_CASES[ALBUM_CASES.length-1]).id;

  pick.innerHTML = ALBUM_CASES.map(c=>{
    const keys = albumCaseKeys(c.id), f = keys.filter(k=>state.album[k]).length;
    const d = keys.length>0 && f===keys.length;
    return `<button class="alb-pill tier-${caseTier(c)} ${c.id===albumCase?"active":""} ${d?"done":""}"
      data-albcase="${c.id}" data-skin="${c.id}" style="--cc:${c.color};--patop:.2">
      <span class="pat"></span>
      <span class="ap-top"><span class="ap-ico">${c.icon}</span><span class="ap-nm">${esc(c.name)}</span>
      <span class="ap-cnt">${d?"✔ ":""}${f}/${keys.length}</span></span>
      <div class="alb-bar"><i style="width:${keys.length?100*f/keys.length:0}%"></i></div></button>`;
  }).join("");

  const sel = ALBUM_CASES.find(c=>c.id===albumCase) || ALBUM_CASES[0];
  const keys = albumCaseKeys(sel.id), f = keys.filter(k=>state.album[k]).length;
  const rew = albumReward(sel), got = !!state.albumClaimed[sel.id];
  body.innerHTML = `
    <div class="alb-reward ${got?"done":""}">
      <span class="ar-ico">${got?"✔":"🏁"}</span>
      <div>${got
        ? `<b>Skompletowana!</b> Nagroda odebrana: 🪙 ${fmt(rew)} + 🍀 5 min koniczyny.`
        : `Zbierz wszystkie <b>${keys.length}</b> pozycji z tej skrzynki — nagroda: <b>🪙 ${fmt(rew)}</b> + <b>🍀 5 min</b> koniczyny.
           &nbsp;<span class="muted">masz ${f} / ${keys.length}</span>`}</div></div>` +
    TIERS.map(t=>{
      const pool = (sel.items[t]||[]).map(it=>({w:it[0], n:it[1], art:it[2], tier:t, key:it[0]+"|"+it[1]}));
      if(!pool.length) return "";
      const gf = pool.filter(p=>state.album[p.key]).length;
      return `<div class="loot-sec" style="--c:${TIER[t].color}">
        <div class="loot-sec-h"><i></i>${t==="special"?"★ Noże":t==="relic"?"✦ Relikty":TIER[t].name}<span>${gf} / ${pool.length} odkryte</span></div>
        <div class="loot-grid">${pool.map(p=>albumCardHTML(p, sel, t)).join("")}</div></div>`;
    }).join("");
  renderAlbumBadge();
}
$("#albPick").addEventListener("click", e=>{
  const b = e.target.closest("[data-albcase]");
  if(!b) return;
  albumCase = b.dataset.albcase;
  renderAlbum();
});

/* ------------------------- 🎯 misje dzienne -------------------------
   Każda misja ma:
     g      - grupa: "easy" (3 losowane co dzień) albo "hard" (1 wyzwanie)
     on     - nazwa zdarzenia(i) z gry, które ją zaliczają (może być funkcją misji)
     min/max- cel (liczba) albo funkcja licząca cel od stanu gracza
     mk     - dla misji z parametrami: zwraca {goal, p:{...}}
     filter - dodatkowy warunek zaliczenia (np. próg wartości dropu)
     mult   - mnożnik nagrody
   Zdarzenia wysyłane z gry: missionTrack("nazwa", ile, dane)
   ------------------------------------------------------------------ */
/* Koniczyna jest rzadka (0,4% na przedmiot), więc misje z nią związaną dostają tylko
   gracze, którzy otwierają naprawdę dużo — dla nich znalezienie koniczyny jest realne. */
const CLOVER_MISSION_MIN = 400;
const MISSION_KINDS = {
  /* ---------------- grupa „easy” ---------------- */
  open:     {g:"easy", icon:"📦", min:12, max:26, mult:1,   on:"open",
             txt:n=>`Otwórz <b>${n}</b> ${plural(n,"skrzynkę","skrzynki","skrzynek")}`},
  open10:   {g:"easy", icon:"🔟", min:1,  max:3,  mult:1.3, on:"open10",
             txt:n=>`Otwórz <b>${n}</b> ${plural(n,"raz","razy","razy")} hurtem ×10`},
  battle:   {g:"easy", icon:"⚔️", min:3,  max:7,  mult:1,   on:"battle",
             txt:n=>`Stocz <b>${n}</b> ${plural(n,"bitwę","bitwy","bitew")}`},
  win:      {g:"easy", icon:"🏆", min:2,  max:4,  mult:1.5, on:"win",
             txt:n=>`Wygraj <b>${n}</b> ${plural(n,"bitwę","bitwy","bitew")}`},
  sell:     {g:"easy", icon:"💰", min:12, max:25, mult:1,   on:"sell",
             txt:n=>`Sprzedaj <b>${n}</b> ${plural(n,"przedmiot","przedmioty","przedmiotów")}`},
  bonus:    {g:"easy", icon:"🎁", min:3,  max:6,  mult:1,   on:"bonus",
             txt:n=>`Odbierz <b>${n}</b> ${plural(n,"raz","razy","razy")} darmowy bonus`},
  upgrade:  {g:"easy", icon:"🚀", min:1,  max:2,  mult:1.3, on:"upgrade",
             avail:()=>UPGRADES.some(u=>upLvl(u.id) < u.max),
             txt:n=>`Kup <b>${n}</b> ${plural(n,"ulepszenie","ulepszenia","ulepszeń")} w zakładce 🚀`},
  discover: {g:"easy", icon:"📖", min:4,  max:9,  mult:1.5, on:"discover",
             avail:()=>albumHave() < ALBUM_TOTAL,
             txt:n=>`Odkryj <b>${n}</b> ${plural(n,"nowy skin","nowe skiny","nowych skinów")} w albumie`},
  spend:    {g:"easy", icon:"🧾", min:()=>mMoney(.03,5000,20000000), max:()=>mMoney(.05,9000,30000000), mult:1.2, on:"spend",
             txt:n=>`Wydaj <b>🪙 ${fmt(n)}</b> na skrzynki i bitwy`},
  sellvalue:{g:"easy", icon:"💵", min:()=>mMoney(.02,3000,15000000), max:()=>mMoney(.04,5000,22000000), mult:1.2, on:"sellvalue",
             txt:n=>`Sprzedaj przedmioty za <b>🪙 ${fmt(n)}</b>`},
  opencase: {g:"easy", icon:"🗃️", mult:1.3, on:m=>["opencase:"+(m.p && m.p.case)],
             /* cel dobierany do ceny skrzynki, żeby misja nie była „przepłacona” */
             mk:()=>{
               const aff = CASES.filter(c=>c.price <= Math.max(1000, state.coins*0.06));
               const c = pick(aff.length ? aff : [CASES[0]]);
               const target = Math.min(30000000, Math.max(2000, state.coins*0.06));
               return {goal:Math.max(3, Math.min(25, Math.round(target/Math.max(1,c.price)))), p:{case:c.id}};
             },
             validate:p=>!!(p && CASES.some(c=>c.id===p.case)),
             txt:(n,p)=>{ const c = CASES.find(x=>x.id===(p && p.case));
               return `Otwórz <b>${n}</b> ${plural(n,"skrzynkę","skrzynki","skrzynek")} — <b>${c?esc(c.name):"?"}</b>`; }},
  cloveropen:{g:"easy", icon:"🍀", min:5, max:12, mult:1.4, on:"cloveropen",
             avail:()=>(state.stats.opened||0) >= CLOVER_MISSION_MIN,
             txt:n=>`Otwórz <b>${n}</b> ${plural(n,"skrzynkę","skrzynki","skrzynek")}, gdy działa <b>🍀 koniczyna</b>`},

  /* ---------------- grupa „hard” (jedno wyzwanie dziennie) ---------------- */
  knife:    {g:"hard", icon:"★",  min:1, max:1, mult:2.5, on:"knife",
             txt:()=>`Wylosuj <b>★ nóż</b> z dowolnej skrzynki`},
  clover:   {g:"hard", icon:"🍀", min:1, max:1, mult:2,   on:"clover",
             avail:()=>(state.stats.opened||0) >= CLOVER_MISSION_MIN,
             txt:()=>`Znajdź <b>🍀 czterolistną koniczynę</b>`},
  covert:   {g:"hard", icon:"🔥", min:1, max:2, mult:2.2, on:"covert",
             txt:n=>`Wylosuj <b>${n}</b> ${plural(n,"przedmiot","przedmioty","przedmiotów")} z tieru <b>Covert lub lepszego</b>`},
  winbig:   {g:"hard", icon:"💥", min:1, max:1, mult:1.8, on:"winbig",
             txt:()=>`Wygraj bitwę w trybie <b>hurtowym ×5</b>`},
  autowin:  {g:"hard", icon:"🔁", min:1, max:2, mult:1.6, on:"autowin",
             txt:n=>`Wygraj <b>${n}</b> ${plural(n,"bitwę","bitwy","bitew")} w <b>auto-walce</b>`},
  battleearn:{g:"hard", icon:"🏦", min:()=>mMoney(.02,4000,12000000), max:()=>mMoney(.035,6000,18000000), mult:2, on:"battleearn",
             txt:n=>`Zgarnij <b>🪙 ${fmt(n)}</b> z wygranych bitew`},

  /* ---------------- grupa „week" (📅 misje tygodniowe) ----------------
     min/max to wartości dla poziomu ⭐ ŁATWA — poziom trudności mnoży cel
     (goalK) i nagrodę (rewK) w mkWeekMission(). Zwykła pula dzienna ich nie
     używa (inna grupa), więc nie zmieniają codziennych losowań.           */
  wopen:      {g:"week", icon:"📦", min:60, max:110, mult:1,  on:"open",
               txt:n=>`Otwórz <b>${n}</b> ${plural(n,"skrzynkę","skrzynki","skrzynek")}`},
  wopen10:    {g:"week", icon:"🔟", min:4,  max:9,   mult:1.4, on:"open10",
               txt:n=>`Otwórz <b>${n}</b> ${plural(n,"raz","razy","razy")} hurtem ×10`},
  wspend:     {g:"week", icon:"🧾", min:()=>mMoney(.02,20000,8000000), max:()=>mMoney(.035,35000,14000000), mult:1.2, on:"spend",
               txt:n=>`Wydaj <b>🪙 ${fmt(n)}</b> na skrzynki i bitwy`},
  wsell:      {g:"week", icon:"💰", min:50, max:90, mult:1, on:"sell",
               txt:n=>`Sprzedaj <b>${n}</b> ${plural(n,"przedmiot","przedmioty","przedmiotów")}`},
  wsellvalue: {g:"week", icon:"💵", min:()=>mMoney(.015,12000,6000000), max:()=>mMoney(.03,24000,11000000), mult:1.2, on:"sellvalue",
               txt:n=>`Sprzedaj przedmioty za <b>🪙 ${fmt(n)}</b>`},
  wbattle:    {g:"week", icon:"⚔️", min:12, max:22, mult:1, on:"battle",
               txt:n=>`Stocz <b>${n}</b> ${plural(n,"bitwę","bitwy","bitew")}`},
  wwin:       {g:"week", icon:"🏆", min:8, max:15, mult:1.4, on:"win",
               txt:n=>`Wygraj <b>${n}</b> ${plural(n,"bitwę","bitwy","bitew")}`},
  wwinbig:    {g:"week", icon:"💥", min:2, max:4, mult:1.5, on:"winbig",
               txt:n=>`Wygraj <b>${n}</b> ${plural(n,"bitwę","bitwy","bitew")} w trybie <b>hurtowym ×5</b>`},
  wbattleearn:{g:"week", icon:"🏦", min:()=>mMoney(.012,10000,5000000), max:()=>mMoney(.025,20000,10000000), mult:1.4, on:"battleearn",
               txt:n=>`Zgarnij <b>🪙 ${fmt(n)}</b> z wygranych bitew`},
  wknife:     {g:"week", icon:"★",  min:1, max:2, mult:2, on:"knife",
               txt:n=>`Wylosuj <b>${n}</b> ${plural(n,"nóż","noże","noży")} z dowolnej skrzynki`},
  wcovert:    {g:"week", icon:"🔥", min:3, max:6, mult:1.5, on:"covert",
               txt:n=>`Wylosuj <b>${n}</b> ${plural(n,"przedmiot","przedmioty","przedmiotów")} z tieru <b>Covert lub lepszego</b>`},
  wdiscover:  {g:"week", icon:"📖", min:12, max:22, mult:1.4, on:"discover",
               avail:()=>albumHave() < ALBUM_TOTAL,
               txt:n=>`Odkryj <b>${n}</b> ${plural(n,"nowy skin","nowe skiny","nowych skinów")} w albumie`},
  wbonus:     {g:"week", icon:"🎁", min:8, max:15, mult:1, on:"bonus",
               txt:n=>`Odbierz <b>${n}</b> ${plural(n,"raz","razy","razy")} darmowy bonus`},
  wfx:        {g:"week", icon:"✨", min:1, max:2, mult:1.8, on:"fx",
               txt:n=>`Wykręć <b>${n}</b> ${plural(n,"efekt","efekty","efektów")} na broni (✨ 💡🥇💎🌈🌌)`},
  wfxbig:     {g:"week", icon:"💎", min:1, max:1, mult:2, on:"fxbig",
               txt:()=>`Upoluj efekt <b>💎 Diamentowy</b> lub lepszy (💎 / 🌈 / 🌌)`},
  wcloveropen:{g:"week", icon:"🍀", min:20, max:40, mult:1.3, on:"cloveropen",
               avail:()=>(state.stats.opened||0) >= CLOVER_MISSION_MIN,
               txt:n=>`Otwórz <b>${n}</b> ${plural(n,"skrzynkę","skrzynki","skrzynek")}, gdy działa <b>🍀 koniczyna</b>`},
  wupgrade:   {g:"week", icon:"🚀", min:1, max:3, mult:1.3, on:"upgrade",
               avail:()=>UPGRADES.some(u=>upLvl(u.id) < u.max),
               txt:n=>`Kup <b>${n}</b> ${plural(n,"ulepszenie","ulepszenia","ulepszeń")} w zakładce 🚀`}
};
const MISSION_EASY_N = 3;      // ile spokojnych misji dziennie
const REROLL_MAX = 2;          // ile razy dziennie można wymienić misję


/* =======================================================================
   14c. 💤 NAGRODA ZA CZAS GRY (IDLE)
   -----------------------------------------------------------------------
   Grając (zakładka otwarta) co IDLE_TICK sekund dostajesz trochę monet
   i chwilowe szczęście. Po IDLE_KNIFE_HOURS godzinach łącznego czasu gry
   dostajesz specjalny niezły nóż, który sprzedasz za 150 000 monet.
   ======================================================================= */
const IDLE_TICK = 30;                    // sekundy między nagrodami
const IDLE_COINS = 500;                  // monety za tick
const IDLE_LUCK = 5;                     // chwilowe szczęście za tick (sekundy)
const IDLE_KNIFE_HOURS = 1.5;            // godziny do noża
const IDLE_KNIFE_VALUE = 150000;         // wartość noża
let idleTimer = 0;
let idleLast = Date.now();
function idleSecs(){ return state.idleKnifeClaimed ? 0 : Math.max(idleTimer, numFrom(state.idleSec)) + Math.max(0, (Date.now() - (idleLast||Date.now()))/1000); }
function clockTxt(sec){
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), q = s%60;
  return h ? h+":"+String(m).padStart(2,"0")+":"+String(q).padStart(2,"0")
           : m+":"+String(q).padStart(2,"0");
}
function updateIdle(){
  const pill = $("#idlePill"), t = $("#idleTime"), b = $("#idleBar");
  if(!pill) return;
  const need = IDLE_KNIFE_HOURS * 3600;
  const done = Math.min(need, idleSecs());
  const left = Math.max(0, need - done);
  if(t) t.textContent = state.idleKnifeClaimed ? "✔ nóż odebrany" : clockTxt(left)+" do noża";
  if(b) b.style.width = Math.min(100, 100*done/need)+"%";
  pill.classList.add("show");
}
function idleTick(){
  if(!idleTimer) idleTimer = numFrom(state.idleSec||0);
  const now = Date.now();
  const dt = Math.floor((now - (idleLast||now)) / 1000);
  if(dt <= 0) return;
  idleLast = now;
  idleTimer += dt;
  state.idleSec = state.idleKnifeClaimed ? 0 : idleTimer;
  // monety za czas gry
  state.coins += Math.round(IDLE_COINS * (dt / IDLE_TICK) * (1 + IDLE_STEP*upLvl("idle")));
  // chwilowe szczęście (maleje z czasem)
  const luckGain = Math.max(0, IDLE_LUCK - Math.floor(idleTimer / 300));
  if(luckGain > 0) state.cloverUntil = Math.max(Date.now(), state.cloverUntil||0) + luckGain * 1000;
  // nóż po 1.5h
  const knifeMs = IDLE_KNIFE_HOURS * 3600 * 1000;
  if(idleTimer * 1000 >= knifeMs && !state.idleKnifeClaimed){
    state.idleKnifeClaimed = true;
    state.idleSec = 0;
    const item = {
      uid: "idle" + Date.now().toString(36),
      w: "Karambit", n: "Cień Czekania", art: "knife",
      tier: "classified", caseId: "idle", fixedSell: IDLE_KNIFE_VALUE,
      fx: null, value: IDLE_KNIFE_VALUE, ts: Date.now()
    };
    addToInv(item);
    toast("💤 <b>Nagroda za cierpliwość!</b> Karambit „Cień Czekania” — sprzedasz za 🪙 "+fmt(IDLE_KNIFE_VALUE),"good");
    confetti(["#38bdf8","#a855f7","#ffd700"]);
  }
  markDirty(); save(); renderBalance(); updateIdle();
}
setInterval(idleTick, IDLE_TICK * 1000);
setInterval(updateIdle, 1000);
setTimeout(updateIdle, 300);
/* =======================================================================
   14d. 📅 MISJE TYGODNIOWE + POZIOMY TRUDNOŚCI
   -----------------------------------------------------------------------
   Tydzień startuje w momencie, gdy gracz pierwszy raz dostaje dany zestaw
   i trwa 7 dni (potem losuje się nowy). Zestaw to 10 misji: 3 ⭐ łatwe,
   3 ⭐⭐ średnie, 2 ⭐⭐⭐ trudne i 2 ⭐⭐⭐⭐ ekstremalne. Poziom trudności
   mnoży CEL (goalK) i NAGRODĘ (rewK) — trudniejsze = dużo więcej monet
   albo dłuższa 🍀 koniczyna. Postęp liczy się z tych samych zdarzeń co
   misje dzienne, więc wszystko działa też przy 🤖 auto-otwieraniu.
   ======================================================================= */
const WEEK_MS = 7*24*60*60*1000;        // długość tygodnia misji
const WEEKLY_N = 10;                    // ile misji w zestawie
const WEEKLY_COMP = [1,1,1,2,2,2,3,3,4,4];   // skład zestawu (poziomy trudności)
const REROLL_WEEK_MAX = 2;              // ile wymian 🔄 w ciągu tygodnia
const DIFF = [
  {id:1, name:"Łatwa",       stars:"⭐",      color:"#38e08a", goalK:1,   rewK:1,   cloverMin:20},
  {id:2, name:"Średnia",     stars:"⭐⭐",    color:"#4b9bff", goalK:2.2, rewK:1.5, cloverMin:35},
  {id:3, name:"Trudna",      stars:"⭐⭐⭐",  color:"#ff8a3d", goalK:4.5, rewK:2.2, cloverMin:50},
  {id:4, name:"Ekstremalna", stars:"⭐⭐⭐⭐", color:"#ff4b6e", goalK:9,   rewK:3.2, cloverMin:75}
];
const DIFF_BY_ID = {};
DIFF.forEach(d=>DIFF_BY_ID[d.id]=d);
const wDiff = id => DIFF_BY_ID[id] || DIFF[0];

/* nagroda w monetach za misję tygodniową (skalowana do stanu gracza) */
function wCoinReward(mult, diff){
  const base = mMoney(0.012, 40000, 20000000);
  const v = base * (mult||1) * diff.rewK;
  return Math.max(8000, Math.round(v/1000)*1000);
}
function mkWeekMission(kind, diffId){
  const def = MISSION_KINDS[kind] || MISSION_KINDS.wopen;
  const diff = wDiff(diffId);
  let goal = 1, p = null;
  if(def.mk){
    const spec = def.mk() || {};
    if(spec.goal) goal = spec.goal;
    if(spec.p) p = spec.p;
  } else {
    const lo = typeof def.min === "function" ? def.min() : def.min;
    const hi = typeof def.max === "function" ? def.max() : def.max;
    goal = lo + Math.floor(Math.random()*((hi-lo)+1));
  }
  goal = Math.max(1, Math.round(goal * diff.goalK));
  const mult = def.mult || 1;
  const reward = Math.random() < 0.5
    ? {t:"coins", amount:wCoinReward(mult, diff)}
    : {t:"clover", ms:diff.cloverMin*60000};
  const m = {kind, diff:diff.id, goal, prog:0, reward, claimed:false};
  if(p) m.p = p;
  return m;
}
function rollWeekly(){
  const pool = missionGroup("week");
  const kinds = pool.length ? pool : ["wopen"];
  const diffs = shuffle(WEEKLY_COMP.slice());
  const n = Math.min(WEEKLY_N, kinds.length);
  const list = [];
  for(let i=0;i<n;i++) list.push(mkWeekMission(kinds[i], diffs[i % diffs.length]));
  state.weekly = {start:Date.now(), list:shuffle(list), rerolls:0};
  markDirty();
  return state.weekly;
}
function weeklyLoad(d){
  const w = (d && d.weekly && typeof d.weekly === "object" && Array.isArray(d.weekly.list) && d.weekly.list.length) ? d.weekly : null;
  if(!w || (Date.now() - numFrom(w.start)) >= WEEK_MS){ rollWeekly(); return; }
  const list = [];
  w.list.forEach(x=>{
    if(!x) return;
    const def = MISSION_KINDS[x.kind];
    if(!def) return;                                      // wycofany typ misji
    const diff = wDiff(x.diff);
    const p = missionParams(x.p);
    if(def.validate && !def.validate(p)){ list.push(mkWeekMission(x.kind, diff.id)); return; }
    const goal = Math.max(1, x.goal|0);
    const out = {kind:x.kind, diff:diff.id, goal, prog:Math.max(0, Math.min(goal, x.prog|0)), claimed:!!x.claimed,
      reward:(x.reward && x.reward.t==="clover")
        ? {t:"clover", ms:Math.max(60000, x.reward.ms|0)}
        : {t:"coins", amount:Math.max(0, (x.reward && x.reward.amount)|0)}};
    if(p) out.p = p;
    list.push(out);
  });
  if(!list.length){ rollWeekly(); return; }
  state.weekly = {start:numFrom(w.start), list, rerolls:Math.min(REROLL_WEEK_MAX, numFrom(w.rerolls))};
  state.achievements = (d.achievements && typeof d.achievements === "object" && !Array.isArray(d.achievements)) ? d.achievements : {};
  state.cosmetics = (d.cosmetics && typeof d.cosmetics === "object" && !Array.isArray(d.cosmetics)) ? d.cosmetics : {};
  state.bossKills = (d.bossKills && typeof d.bossKills === "object" && !Array.isArray(d.bossKills)) ? d.bossKills : {};
  // dobicie brakujących misji (gdy zestaw powstał przy mniejszej liczbie typów)
  if(list.length < WEEKLY_N){
    const used = list.map(x=>x.kind);
    const extra = shuffle(missionGroup("week").filter(k=>used.indexOf(k)<0));
    const diffs = shuffle(WEEKLY_COMP.slice());
    const had = list.length;
    for(let i=0; i<extra.length && list.length<WEEKLY_N; i++)
      list.push(mkWeekMission(extra[i], diffs[list.length % diffs.length]));
    if(list.length > had) markDirty();
  }
}
function wUntilNew(){
  const st = numFrom(state.weekly && state.weekly.start);
  const ms = Math.max(0, st + WEEK_MS - Date.now());
  const dd = Math.floor(ms/86400000), h = Math.floor(ms%86400000/3600000), m = Math.floor(ms%3600000/60000);
  return dd > 0 ? dd+" dni "+h+" godz." : (h > 0 ? h+" godz. "+m+" min" : m+" min");
}
function renderWeekly(){
  const g = $("#weeklyGrid");
  if(!g) return;
  const list = (state.weekly && state.weekly.list) || [];
  updateWeeklyHint();
  const left = Math.max(0, REROLL_WEEK_MAX - numFrom(state.weekly && state.weekly.rerolls));
  g.innerHTML = list.map((m,i)=>{
    const d = MISSION_KINDS[m.kind] || MISSION_KINDS.wopen;
    const diff = wDiff(m.diff);
    const done = m.prog >= m.goal;
    const rew = m.reward.t==="coins" ? "🪙 "+fmt(m.reward.amount) : "🍀 "+Math.round(m.reward.ms/60000)+" min";
    return `<div class="mission week d-${diff.id} ${done&&!m.claimed?"done":""} ${m.claimed?"claimed":""}" style="--dc:${diff.color};animation-delay:${i*55}ms">
      <div class="mission-top"><span class="mission-ico">${d.icon}</span><span class="mission-txt">${d.txt(m.goal, m.p)}
        <span class="m-diff" title="Poziom ${diff.name} — cele ×${diff.goalK}, nagrody ×${diff.rewK}">${diff.stars} ${diff.name}</span></span></div>
      <div class="mission-bar"><i style="width:${Math.min(100, 100*m.prog/Math.max(1,m.goal))}%"></i></div>
      <div class="mission-foot">
        <span class="mission-rew">Nagroda: <b>${rew}</b></span>
        <span class="mission-prog">${Math.min(m.prog,m.goal)} / ${m.goal}</span>
      </div>
      <div class="mission-foot">${m.claimed
        ? `<span class="mission-rew">✔ odebrano</span>`
        : `<button class="btn ${done?"primary":""}" data-wclaim="${i}" ${done?"":"disabled"}>${done?"🎁 Odbierz":"W toku"}</button>
           <button class="tb-btn" data-wreroll="${i}" ${left?"":"disabled"} title="Wymień misję (zostało ${left} z ${REROLL_WEEK_MAX} w tym tygodniu)">🔄${left?` <small>${left}</small>`:""}</button>`}
      </div></div>`;
  }).join("");
  renderDailyBadge();
}
function updateWeeklyHint(){
  const hint = $("#weeklyHint");
  if(!hint) return;
  const list = (state.weekly && state.weekly.list) || [];
  const left = Math.max(0, REROLL_WEEK_MAX - numFrom(state.weekly && state.weekly.rerolls));
  const ready = list.filter(m=>m.claimed).length;
  const coins = list.reduce((a,m)=>a+(m.reward.t==="coins"?m.reward.amount:0),0);
  hint.innerHTML = `nowe misje za <b>${wUntilNew()}</b> · odebrane <b>${ready}</b> / ${list.length} · wymiany <b>${left}/${REROLL_WEEK_MAX}</b> · w puli nagród <b>🪙 ${fmtShort(coins)}</b>`;
}
function claimWeekly(i){
  const list = (state.weekly && state.weekly.list) || [];
  const m = list[i];
  if(!m || m.claimed || m.prog < m.goal){ sfxErr(); return; }
  m.claimed = true;
  let msg;
  if(m.reward.t === "coins"){
    state.coins += m.reward.amount;
    msg = "🪙 "+fmt(m.reward.amount);
    sfxCoin(); renderBalance(); renderShop();
  } else {
    state.cloverUntil = Math.max(Date.now(), state.cloverUntil||0) + m.reward.ms;
    msg = "🍀 koniczyna +"+Math.round(m.reward.ms/60000)+" min";
    sfxClover(); updateClover();
  }
  save();
  confetti(["#45d06a","#ffd166","#8ee7ff","#ffd700"]);
  toast("📅 <b>Misja tygodniowa zaliczona!</b> Nagroda: "+msg,"good");
  renderWeekly();
}
function rerollWeekly(i){
  const list = (state.weekly && state.weekly.list) || [];
  const m = list[i];
  if(!m || m.claimed) return;
  const left = REROLL_WEEK_MAX - numFrom(state.weekly.rerolls);
  if(left <= 0){ sfxErr(); toast("🔄 Wymiana misji tygodniowej — limit <b>"+REROLL_WEEK_MAX+"</b> na tydzień","bad"); return; }
  const used = list.map(x=>x.kind);
  const pool = missionGroup("week");
  let kind = pick(pool), guard = 0;
  while(used.indexOf(kind) >= 0 && guard++ < 80) kind = pick(pool);
  state.weekly.rerolls = numFrom(state.weekly.rerolls) + 1;
  state.weekly.list[i] = mkWeekMission(kind, m.diff);      // ten sam poziom trudności
  save(); renderWeekly();
  toast("🔄 Misja tygodniowa wymieniona <b>"+state.weekly.rerolls+"/"+REROLL_WEEK_MAX+"</b>","good");
}
/* tydzień minął w trakcie gry — nowy zestaw */
function checkWeeklyRoll(){
  if(state.weekly && Array.isArray(state.weekly.list) && state.weekly.list.length
     && (Date.now() - numFrom(state.weekly.start)) < WEEK_MS) return;
  rollWeekly();
  renderDailyBadge();
  if(currentView === "daily") renderDaily();
  toast("📅 <b>Nowe misje tygodniowe!</b> Sprawdź zakładkę 🎯 Misje","good");
}

function mDayKey(){
  const d = new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function mUntilMidnight(){
  const now = new Date();
  const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0, 0, 0, 0);
  const ms = mid - now, h = Math.floor(ms/3600000), m = Math.floor(ms%3600000/60000);
  return h>0 ? h+" godz. "+m+" min" : m+" min";
}
/* kwota „skalowana” do stanu gracza (z podłogą i sufitem), zaokrąglona do 1000 */
function mMoney(pct, lo, hi){
  const v = Math.min(hi, Math.max(lo, state.coins * pct));
  return Math.max(lo, Math.round(v/1000)*1000);
}
function mCoinReward(mult){
  const base = mMoney(0.03, 25000, 30000000);
  return Math.max(1000, Math.round(base*mult/1000)*1000);
}
function mkMission(kind){
  const d = MISSION_KINDS[kind] || MISSION_KINDS.open;
  let goal = 1, p = null;
  if(d.mk){
    const spec = d.mk() || {};
    if(spec.goal) goal = spec.goal;
    if(spec.p) p = spec.p;
  } else {
    const lo = typeof d.min === "function" ? d.min() : d.min;
    const hi = typeof d.max === "function" ? d.max() : d.max;
    goal = lo + Math.floor(Math.random()*((hi-lo)+1));
  }
  goal = Math.max(1, goal|0);
  const mult = d.mult || 1;
  const reward = Math.random() < 0.55
    ? {t:"coins", amount:mCoinReward(mult)}
    : {t:"clover", ms:(mult >= 1.8 ? 15 : mult >= 1.4 ? 10 : 5)*60000};
  const m = {kind, goal, prog:0, reward, claimed:false};
  if(p) m.p = p;
  return m;
}
/* pula misji danej grupy — odsiewa te, których nie da się już wykonać */
function missionGroup(g){
  return Object.keys(MISSION_KINDS).filter(k=>{
    const d = MISSION_KINDS[k];
    if((d.g || "easy") !== g) return false;
    return !d.avail || d.avail();
  });
}
function shuffle(a){
  for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}
function rollMissions(){
  const easy = shuffle(missionGroup("easy"));
  const hard = missionGroup("hard");
  const list = easy.slice(0, MISSION_EASY_N).map(mkMission);
  if(hard.length) list.push(mkMission(pick(hard)));
  state.missions = {date:mDayKey(), list:shuffle(list), rerolls:0};
  markDirty();
  return state.missions;
}
/* parametry misji (np. wybrana skrzynka, próg wartości) — tylko proste typy */
function missionParams(p){
  if(!p || typeof p !== "object" || Array.isArray(p)) return null;
  const o = {};
  Object.keys(p).forEach(k=>{
    const v = p[k];
    if(typeof v === "number" || typeof v === "string" || typeof v === "boolean") o[k] = v;
  });
  return Object.keys(o).length ? o : null;
}
function missionsLoad(d){
  const m = (d && d.missions && typeof d.missions === "object" && Array.isArray(d.missions.list)) ? d.missions : null;
  if(m && m.date === mDayKey() && m.list.length){
    const list = [];
    m.list.forEach(x=>{
      if(!x) return;
      const def = MISSION_KINDS[x.kind];
      if(!def) return;                                  // wycofany typ misji
      const p = missionParams(x.p);
      if(def.validate && !def.validate(p)){ list.push(mkMission(x.kind)); return; }   // np. skrzynka już nie istnieje
      const goal = Math.max(1, x.goal|0);
      const out = {kind:x.kind, goal, prog:Math.max(0, Math.min(goal, x.prog|0)), claimed:!!x.claimed,
        reward:(x.reward && x.reward.t==="clover")
          ? {t:"clover", ms:Math.max(60000, x.reward.ms|0)}
          : {t:"coins", amount:Math.max(0, (x.reward && x.reward.amount)|0)}};
      if(p) out.p = p;
      list.push(out);
    });
    // dobicie brakujących misji (gdy w zapisie jest ich mniej niż dzisiejsza norma,
    // np. po aktualizacji gry w środku dnia) — bez ruszania postępu już zrobionego
    const want = MISSION_EASY_N + 1;
    if(list.length && list.length < want){
      const used = list.map(x=>x.kind);
      const extra = shuffle(missionGroup("easy").filter(k=>used.indexOf(k)<0))
        .concat(shuffle(missionGroup("hard").filter(k=>used.indexOf(k)<0)));
      const had = list.length;
      for(let i=0; i<extra.length && list.length<want; i++) list.push(mkMission(extra[i]));
      if(list.length > had) markDirty();          // dobite misje zapiszemy
    }
    state.missions = {date:m.date, rerolls:Math.min(REROLL_MAX, m.rerolls|0), list};
    if(!list.length) rollMissions();
  } else {
    rollMissions();
  }
}
/* zdarzenie z gry -> postęp misji.  ev = nazwa, n = ile, data = dodatkowe dane
   UWAGA: dopasowanie jest DOKŁADNE — nazwy zdarzeń mogą być swoimi podciągami
   (np. "open" jest podciągiem "open10" i "cloveropen"), więc zawsze porównujemy
   elementy tablicy, nigdy nie używamy indexOf na łańcuchu. */
function missionEvents(m, def){
  const e = typeof def.on === "function" ? def.on(m) : def.on;
  if(e == null) return null;
  return Array.isArray(e) ? e : [e];
}
/* postęp w JEDNEJ liście misji (dziennej albo tygodniowej) */
function trackMissionList(list, ev, n, data){
  const res = {changed:false, done:0};
  if(!list || !list.length) return res;
  list.forEach(m=>{
    if(m.claimed || m.prog >= m.goal) return;
    const def = MISSION_KINDS[m.kind];
    if(!def || !def.on) return;
    const evs = missionEvents(m, def);
    if(!evs || evs.indexOf(ev) < 0) return;
    if(def.filter && !def.filter(m, data || {})) return;
    m.prog = Math.min(m.goal, (m.prog|0) + n);
    res.changed = true;
    if(m.prog >= m.goal) res.done++;
  });
  return res;
}
function missionTrack(ev, n, data){
  if(!n || n <= 0) return;
  const d = trackMissionList(state.missions && state.missions.list, ev, n, data);
  const w = trackMissionList(state.weekly && state.weekly.list, ev, n, data);
  if(!d.changed && !w.changed) return;
  markDirty();
  renderDailyBadge();
  if(currentView === "daily") renderDaily();
  else if(d.done || w.done){
    if(w.done) toast("📅 <b>Misja tygodniowa gotowa!</b> Odbierz nagrodę w zakładce 🎯 Misje","good");
    if(d.done) toast("🎯 <b>Misja dzienna gotowa!</b> Odbierz nagrodę w zakładce 🎯 Misje","good");
  }
}
function renderDailyBadge(){
  const b = $("#dailyCount");
  if(!b) return;
  const d = ((state.missions && state.missions.list) || []).filter(m=>!m.claimed && m.prog>=m.goal).length;
  const w = ((state.weekly && state.weekly.list) || []).filter(m=>!m.claimed && m.prog>=m.goal).length;
  const n = d + w;
  b.textContent = String(n);
  b.classList.toggle("ready", n>0);
}
function renderDaily(){
  const g = $("#missionGrid");
  if(!g) return;
  const list = (state.missions && state.missions.list) || [];
  updateDailyHint();
  const left = Math.max(0, REROLL_MAX - (state.missions.rerolls|0));
  g.innerHTML = list.map((m,i)=>{
    const d = MISSION_KINDS[m.kind] || MISSION_KINDS.open;
    const done = m.prog >= m.goal;
    const rew = m.reward.t==="coins" ? "🪙 "+fmt(m.reward.amount) : "🍀 "+Math.round(m.reward.ms/60000)+" min";
    const hard = (d.g || "easy") === "hard";
    return `<div class="mission ${hard?"hard":""} ${done&&!m.claimed?"done":""} ${m.claimed?"claimed":""}" style="animation-delay:${i*70}ms">
      <div class="mission-top"><span class="mission-ico">${d.icon}</span><span class="mission-txt">${d.txt(m.goal, m.p)}${hard?' <span class="m-hard">WYZWANIE</span>':""}</span></div>
      <div class="mission-bar"><i style="width:${Math.min(100, 100*m.prog/Math.max(1,m.goal))}%"></i></div>
      <div class="mission-foot">
        <span class="mission-rew">Nagroda: <b>${rew}</b></span>
        <span class="mission-prog">${Math.min(m.prog,m.goal)} / ${m.goal}</span>
      </div>
      <div class="mission-foot">${m.claimed
        ? `<span class="mission-rew">✔ odebrano</span>`
        : `<button class="btn ${done?"primary":""}" data-claim="${i}" ${done?"":"disabled"}>${done?"🎁 Odbierz":"W toku"}</button>
           <button class="tb-btn" data-reroll="${i}" ${left?"":"disabled"} title="Wymień misję (zostało ${left} z ${REROLL_MAX} dziś)">🔄${left?` <small>${left}</small>`:""}</button>`}
      </div></div>`;
  }).join("");
  renderDailyBadge();
  renderWeekly();          // 📅 tygodniowe siedzą w tej samej zakładce
}
function updateDailyHint(){
  const hint = $("#dailyHint");
  if(!hint) return;
  const list = (state.missions && state.missions.list) || [];
  const left = Math.max(0, REROLL_MAX - (state.missions.rerolls|0));
  hint.innerHTML = `reset za <b>${mUntilMidnight()}</b> · odebrane <b>${list.filter(m=>m.claimed).length}</b> / ${list.length} · wymiany <b>${left}/${REROLL_MAX}</b>`;
}
function claimMission(i){
  const list = (state.missions && state.missions.list) || [];
  const m = list[i];
  if(!m || m.claimed || m.prog < m.goal){ sfxErr(); return; }
  m.claimed = true;
  let msg;
  if(m.reward.t === "coins"){
    state.coins += m.reward.amount;
    msg = "🪙 "+fmt(m.reward.amount);
    sfxCoin(); renderBalance(); renderShop();
  } else {
    state.cloverUntil = Math.max(Date.now(), state.cloverUntil||0) + m.reward.ms;
    msg = "🍀 koniczyna +"+Math.round(m.reward.ms/60000)+" min";
    sfxClover(); updateClover();
  }
  save();
  confetti(["#45d06a","#ffd166","#8ee7ff"]);
  toast("🎯 <b>Misja zaliczona!</b> Nagroda: "+msg,"good");
  renderDaily();
}
function rerollMission(i){
  const list = (state.missions && state.missions.list) || [];
  const m = list[i];
  if(!m || m.claimed) return;
  const left = REROLL_MAX - (state.missions.rerolls|0);
  if(left <= 0){ sfxErr(); toast("🔄 Wymiana misji — limit <b>"+REROLL_MAX+"</b> na dziś","bad"); return; }
  const used = list.map(x=>x.kind);
  const pool = missionGroup("easy").concat(missionGroup("hard"));
  let kind = pick(pool), guard = 0;
  while(used.indexOf(kind) >= 0 && guard++ < 60) kind = pick(pool);
  state.missions.rerolls = (state.missions.rerolls|0) + 1;
  state.missions.list[i] = mkMission(kind);
  save(); renderDaily();
  toast("🔄 Misja wymieniona <b>"+state.missions.rerolls+"/"+REROLL_MAX+"</b>","good");
}
/* nowy dzień w trakcie gry — nowe misje */
function checkDailyRoll(){
  if(state.missions && state.missions.date === mDayKey()) return;
  rollMissions();
  renderDailyBadge();
  if(currentView === "daily") renderDaily();
  toast("🎯 <b>Nowe misje dzienne!</b> Sprawdź zakładkę 🎯 Misje","good");
}
$("#missionGrid").addEventListener("click", e=>{
  const c = e.target.closest("[data-claim]");
  const r = e.target.closest("[data-reroll]");
  if(c) claimMission(+c.dataset.claim);
  else if(r) rerollMission(+r.dataset.reroll);
});
$("#weeklyGrid").addEventListener("click", e=>{
  const c = e.target.closest("[data-wclaim]");
  const r = e.target.closest("[data-wreroll]");
  if(c) claimWeekly(+c.dataset.wclaim);
  else if(r) rerollWeekly(+r.dataset.wreroll);
});


/* =======================================================================
   14d. ACHIEVEMENTS + COSMETICS + BOSS + KING OF THE HILL
   ======================================================================= */
/* ✦ relikty — bardzo rzadkie przedmioty; album pamięta je na stałe, także po sprzedaży */
const RELIC_KEYS = [
  ["Kosa Żniwiarza","Ostrze Otchłani"],
  ["Nóż Widmo","Ostatni Cień"],
  ["Naklejka: Ostatni Znak","Żniwiarz"],
  ["Ozdoba: Klepsydra","Ostatnia Godzina"],
  ["Naklejka: Oko Burzy","Kolekcja Legend"],
  ["Naklejka: Czaszka Króla","Złota Seria"],
  ["Ozdoba: Kryształ Otchłani","Bursztyn"],
  ["Nóż Kolekcjonera","Ostatni Egzemplarz"]
];
const relicFound = (w,n) => !!(state.album && state.album[w+"|"+n]);
const relicCount = () => RELIC_KEYS.filter(([w,n])=>relicFound(w,n)).length;

const ACHIEVEMENTS = [
  /* ✦ RELIKTY — bardzo rzadkie przedmioty z bazaru botów */
  {id:"relic_scythe", icon:"🌾", name:"Kosa Żniwiarza", desc:"Zdobądź Kosę Żniwiarza (✦ Relikt) ze Skrzynki Żniwiarza.", target:1, prog:()=>relicFound("Kosa Żniwiarza","Ostrze Otchłani")?1:0, done:()=>relicFound("Kosa Żniwiarza","Ostrze Otchłani"), reward:{coins:75000000}},
  {id:"relic_ghost",  icon:"🔪", name:"Nóż Widmo",      desc:"Zdobądź Nóż Widmo (✦ Relikt) ze Skrzynki Żniwiarza.", target:1, prog:()=>relicFound("Nóż Widmo","Ostatni Cień")?1:0, done:()=>relicFound("Nóż Widmo","Ostatni Cień"), reward:{coins:75000000}},
  {id:"relic_mark",   icon:"🏷️", name:"Ostatni Znak",  desc:"Zdobądź Naklejkę: Ostatni Znak (✦ Relikt) ze Skrzynki Żniwiarza.", target:1, prog:()=>relicFound("Naklejka: Ostatni Znak","Żniwiarz")?1:0, done:()=>relicFound("Naklejka: Ostatni Znak","Żniwiarz"), reward:{coins:25000000}},
  {id:"relic_hour",   icon:"⏳", name:"Klepsydra",      desc:"Zdobądź Ozdobę: Klepsydra (✦ Relikt) ze Skrzynki Żniwiarza.", target:1, prog:()=>relicFound("Ozdoba: Klepsydra","Ostatnia Godzina")?1:0, done:()=>relicFound("Ozdoba: Klepsydra","Ostatnia Godzina"), reward:{coins:25000000}},
  {id:"relic_storm",  icon:"🌀", name:"Oko Burzy",      desc:"Zdobądź Naklejkę: Oko Burzy (✦ Relikt) ze Skrzynki Naklejek.", target:1, prog:()=>relicFound("Naklejka: Oko Burzy","Kolekcja Legend")?1:0, done:()=>relicFound("Naklejka: Oko Burzy","Kolekcja Legend"), reward:{coins:25000000}},
  {id:"relic_skull",  icon:"💀", name:"Czaszka Króla",  desc:"Zdobądź Naklejkę: Czaszka Króla (✦ Relikt) ze Skrzynki Naklejek.", target:1, prog:()=>relicFound("Naklejka: Czaszka Króla","Złota Seria")?1:0, done:()=>relicFound("Naklejka: Czaszka Króla","Złota Seria"), reward:{coins:25000000}},
  {id:"relic_crystal",icon:"🔮", name:"Kryształ Otchłani", desc:"Zdobądź Ozdobę: Kryształ Otchłani (✦ Relikt) ze Skrzynki Naklejek.", target:1, prog:()=>relicFound("Ozdoba: Kryształ Otchłani","Bursztyn")?1:0, done:()=>relicFound("Ozdoba: Kryształ Otchłani","Bursztyn"), reward:{coins:25000000}},
  {id:"relic_blade",  icon:"🗡️", name:"Ostrze Kolekcjonera", desc:"Zdobądź Nóż Kolekcjonera (✦ Relikt) ze Skrzynki Naklejek.", target:1, prog:()=>relicFound("Nóż Kolekcjonera","Ostatni Egzemplarz")?1:0, done:()=>relicFound("Nóż Kolekcjonera","Ostatni Egzemplarz"), reward:{coins:75000000}},
  {id:"relic_all",    icon:"✦",  name:"Kustosz relikwii", desc:"Zdobądź wszystkie 8 reliktów z bazaru botów.", target:8, prog:()=>relicCount(), done:()=>relicCount()>=8, reward:{coins:500000000}},
  /* 🔑 KODY — bardzo rzadkie bonusy ze skrzynek i bazaru */
  {id:"code_1",     icon:"🔑", name:"Pierwszy kod",      desc:"Odbierz pierwszy kod.",                    target:1,           prog:()=>codeUniqueRedeemed(), done:()=>codeUniqueRedeemed()>=1, reward:{coins:100000}},
  {id:"code_5",     icon:"🗝️", name:"Kolekcjoner kodów", desc:"Odbierz 5 różnych kodów.",                 target:5,           prog:()=>codeUniqueRedeemed(), done:()=>codeUniqueRedeemed()>=5, reward:{coins:2000000}},
  {id:"code_all",   icon:"🔐", name:"Władca kodów",      desc:"Odbierz wszystkie "+CODES.length+" kodów.", target:CODES.length, prog:()=>codeUniqueRedeemed(), done:()=>codeUniqueRedeemed()>=CODES.length, reward:{coins:25000000}},
  {id:"code_very",  icon:"🌌", name:"Kod Otchłani",      desc:"Odbierz bardzo rzadki Kod Otchłani.",       target:1,           prog:()=>numFrom((state.codeRedeemed||{})["otchlan"]), done:()=>numFrom((state.codeRedeemed||{})["otchlan"])>=1, reward:{coins:10000000}},
  /* 🌱 Dla początkujących (łatwe) */
  {id:"open_1",    icon:"📦", name:"Pierwszy krok",      desc:"Otwórz pierwszą skrzynkę.",           target:1,     prog:()=>state.stats.opened,    done:()=>state.stats.opened>=1,     reward:{coins:500}},
  {id:"open_10",   icon:"📦", name:"Początek drogi",     desc:"Otwórz 10 skrzynek.",                 target:10,    prog:()=>state.stats.opened,    done:()=>state.stats.opened>=10,    reward:{coins:2000}},
  {id:"sell_5",    icon:"💰", name:"Pierwszy zarobek",  desc:"Sprzedaj 5 przedmiotów.",              target:5,     prog:()=>state.stats.sold,      done:()=>state.stats.sold>=5,      reward:{coins:1000}},
  {id:"battle_3",  icon:"⚔️", name:"Pierwsza walka",    desc:"Stocz 3 bitwy.",                       target:3,     prog:()=>state.stats.battles,   done:()=>state.stats.battles>=3,   reward:{coins:3000}},
  {id:"win_1",     icon:"🏆", name:"Pierwsze zwycięstwo",desc:"Wygraj pierwszą bitwę.",               target:1,     prog:()=>state.stats.battleWins, done:()=>state.stats.battleWins>=1, reward:{coins:5000}},
  {id:"album_5",   icon:"📖", name:"Pierwsza kolekcja", desc:"Odkryj 5 skinów w albumie.",            target:5,     prog:()=>albumHave(),            done:()=>albumHave()>=5,          reward:{coins:2000}},
  {id:"fx_1",      icon:"✨", name:"Pierwszy błysk",    desc:"Wykręć pierwszy efekt na broni.",       target:1,     prog:()=>state.stats.fxTotal,    done:()=>state.stats.fxTotal>=1,    reward:{coins:10000}},
  {id:"coins_100k",icon:"🪙", name:"Pierwsza fortuna",  desc:"Zgromadź 100 000 monet.",              target:100000, prog:()=>state.coins,           done:()=>state.coins>=100000,     reward:{coins:1000}},
  {id:"cos_1",     icon:"🎨", name:"Pierwsza kosmetyka",desc:"Kup pierwszy patch na broń.",          target:1,     prog:()=>Object.keys(state.cosmetics||{}).length, done:()=>Object.keys(state.cosmetics||{}).length>=1, reward:{coins:50000}},
  /* 🎯 Dla średniozaawansowanych */
  {id:"open_100",  icon:"📦", name:"Sto otwarć",        desc:"Otwórz 100 skrzynek.",                 target:100,   prog:()=>state.stats.opened,    done:()=>state.stats.opened>=100,   reward:{coins:50000}},
  {id:"knife_1",   icon:"★",  name:"Pierwszy nóż",      desc:"Wylosuj pierwszy nóż.",                target:1,     prog:()=>state.stats.knives,     done:()=>state.stats.knives>=1,    reward:{coins:25000}},
  {id:"win_10",    icon:"🏆", name:"Zwycięzca",         desc:"Wygraj 10 bitew.",                     target:10,    prog:()=>state.stats.battleWins, done:()=>state.stats.battleWins>=10,  reward:{coins:50000}},
  {id:"album_50",  icon:"📖", name:"Kolekcjoner",       desc:"Odkryj 50 skinów w albumie.",          target:50,    prog:()=>albumHave(),            done:()=>albumHave()>=50,         reward:{coins:75000}},
  {id:"fx_5",      icon:"✨", name:"Kolekcjoner błysków",desc:"Wykręć 5 efektów na broniach.",        target:5,     prog:()=>state.stats.fxTotal,    done:()=>state.stats.fxTotal>=5,    reward:{coins:100000}},
  {id:"coins_1m",  icon:"🪙", name:"Milioner",          desc:"Zgromadź 1 000 000 monet.",            target:1000000,prog:()=>state.coins,           done:()=>state.coins>=1000000,   reward:{coins:20000}},
  /* 💎 Dla weteranów (trudne) */
  {id:"open_1000", icon:"📦", name:"Tysiąc otwarć",     desc:"Otwórz 1000 skrzynek.",                target:1000,  prog:()=>state.stats.opened,    done:()=>state.stats.opened>=1000,  reward:{coins:500000}},
  {id:"open_10000",icon:"📦", name:"Dziesięć tysięcy",  desc:"Otwórz 10 000 skrzynek.",              target:10000, prog:()=>state.stats.opened,    done:()=>state.stats.opened>=10000, reward:{coins:5000000}},
  {id:"knife_10",  icon:"★",  name:"Zbrojownia",        desc:"Wylosuj 10 noży.",                     target:10,    prog:()=>state.stats.knives,     done:()=>state.stats.knives>=10,   reward:{coins:250000}},
  {id:"knife_25",  icon:"★",  name:"Kolekcja noży",     desc:"Wylosuj 25 noży.",                     target:25,    prog:()=>state.stats.knives,     done:()=>state.stats.knives>=25,   reward:{coins:1000000}},
  {id:"win_50",    icon:"🏆", name:"Niepokonany",       desc:"Wygraj 50 bitew.",                     target:50,    prog:()=>state.stats.battleWins, done:()=>state.stats.battleWins>=50,  reward:{coins:500000}},
  {id:"win_100",   icon:"🏆", name:"Legenda aren",      desc:"Wygraj 100 bitew.",                    target:100,   prog:()=>state.stats.battleWins, done:()=>state.stats.battleWins>=100, reward:{coins:2000000}},
  {id:"album_200", icon:"📖", name:"Muzealnik",         desc:"Odkryj 200 skinów w albumie.",         target:200,   prog:()=>albumHave(),            done:()=>albumHave()>=200,        reward:{coins:500000}},
  {id:"album_500", icon:"📖", name:"Archiwista",        desc:"Odkryj 500 skinów w albumie.",         target:500,   prog:()=>albumHave(),            done:()=>albumHave()>=500,        reward:{coins:2000000}},
  {id:"fx_diamond",icon:"💎", name:"Rzadkość",          desc:"Wykręć efekt 💎 Diamentowy lub lepszy.", target:1,    prog:()=>state.stats.fxTotal,    done:()=>Object.keys(state.stats.fx||{}).some(k=>["diamond","rainbow","cosmic"].includes(k)), reward:{coins:500000}},
  {id:"fx_cosmic", icon:"🌌", name:"Kosmiczny",        desc:"Wykręć efekt 🌌 Kosmiczny.",         target:1,    prog:()=>state.stats.fxTotal,    done:()=>Object.keys(state.stats.fx||{}).some(k=>k==="cosmic"), reward:{coins:3000000}},
  {id:"clover_1",  icon:"🍀", name:"Szczęśliarz",       desc:"Znajdź czterolistną koniczynę.",         target:1,     prog:()=>state.stats.clovers,   done:()=>state.stats.clovers>=1,   reward:{coins:50000}},
  {id:"clover_10", icon:"🍀", name:"Ogród koniczyny",   desc:"Znajdź 10 koniczyn.",                  target:10,    prog:()=>state.stats.clovers,   done:()=>state.stats.clovers>=10,  reward:{coins:500000}},
  {id:"boss_1",    icon:"👹", name:"Pogromca",          desc:"Pokonaj bossa.",                        target:1,     prog:()=>state.stats.bossWins||0, done:()=>(state.stats.bossWins||0)>=1, reward:{coins:1000000}},
  {id:"boss_3",    icon:"👹", name:"Bossów łowca",      desc:"Pokonaj 3 bossów.",                     target:3,     prog:()=>state.stats.bossWins||0, done:()=>(state.stats.bossWins||0)>=3, reward:{coins:3000000}},
  {id:"boss_all",  icon:"👹", name:"Pogromca wszystkich",desc:"Pokonaj każdego bossa (po 1×).",      target:3,     prog:()=>Object.keys(state.bossKills||{}).length, done:()=>Object.keys(state.bossKills||{}).length>=3, reward:{coins:10000000}},
  {id:"koh_1",     icon:"🎰", name:"Królowa góry",      desc:"Wygraj w trybie Królowa góry.",         target:1,     prog:()=>state.stats.kohWins||0, done:()=>(state.stats.kohWins||0)>=1, reward:{coins:500000}},
  {id:"koh_10",    icon:"🎰", name:"Władca gry",        desc:"Wygraj 10 razy w Królowej góry.",       target:10,    prog:()=>state.stats.kohWins||0, done:()=>(state.stats.kohWins||0)>=10, reward:{coins:5000000}},
  {id:"rich_1b",   icon:"🪙", name:"Milionard",         desc:"Zgromadź 1 000 000 000 monet.",        target:1000000000, prog:()=>state.coins, done:()=>state.coins>=1000000000, reward:{coins:5000000}},
  {id:"rich_10b",  icon:"🪙", name:"Milionard",          desc:"Zgromadź 10 000 000 000 monet.",       target:10000000000,prog:()=>state.coins, done:()=>state.coins>=10000000000,reward:{coins:50000000}},
  {id:"rich_1t",   icon:"💰", name:"Bilioner",           desc:"Zgromadź 1 000 000 000 000 monet.",     target:1000000000000, prog:()=>state.coins, done:()=>state.coins>=1000000000000, reward:{coins:100000000}},
  {id:"rich_10t",  icon:"💰", name:"Władca bilionów",    desc:"Zgromadź 10 000 000 000 000 monet.",    target:10000000000000,prog:()=>state.coins, done:()=>state.coins>=10000000000000,reward:{coins:1000000000}},
  {id:"mega_1",    icon:"💎", name:"Za horyzontem",      desc:"Otwórz skrzynkę mega (Kwantową, Wieczności lub Osobliwości).", target:1, prog:()=>CASES.filter(c=>c.mega).reduce((a,c)=>a+numFrom((state.stats.cases||{})[c.id]||0),0), done:()=>CASES.filter(c=>c.mega).some(c=>numFrom((state.stats.cases||{})[c.id]||0)>0), reward:{coins:10000000}},
  {id:"rich_100b", icon:"💵", name:"Władca miliardów",   desc:"Zgromadź 100 000 000 000 monet.",      target:100000000000, prog:()=>state.coins, done:()=>state.coins>=100000000000, reward:{coins:100000000}},
  {id:"rich_900b", icon:"💵", name:"Dziewięćset miliardów", desc:"Zgromadź 900 000 000 000 monet.",   target:900000000000, prog:()=>state.coins, done:()=>state.coins>=900000000000, reward:{coins:400000000}},
  {id:"elite_1",   icon:"🌠", name:"Elitarny łowca",     desc:"Otwórz skrzynkę elity (Aurory, Mgławicy, Wiru, Tytana lub Zaćmienia).", target:1, prog:()=>CASES.filter(c=>c.elite).reduce((a,c)=>a+numFrom((state.stats.cases||{})[c.id]||0),0), done:()=>CASES.filter(c=>c.elite).some(c=>numFrom((state.stats.cases||{})[c.id]||0)>0), reward:{coins:25000000}},
  {id:"ultra_1",   icon:"💠", name:"Poza skalą",         desc:"Otwórz dowolną skrzynkę ULTRA (Kwadra, Kwinta, Seksta, Septa, Okta lub Nona).", target:1, prog:()=>CASES.filter(c=>c.ultra).reduce((a,c)=>a+numFrom((state.stats.cases||{})[c.id]||0),0), done:()=>CASES.filter(c=>c.ultra).some(c=>numFrom((state.stats.cases||{})[c.id]||0)>0), reward:{coins:1000000000}},
  {id:"cos_all",   icon:"👑", name:"Pełna kolekcja",    desc:"Kup wszystkie 6 kosmetyków.",           target:6,     prog:()=>Object.keys(state.cosmetics||{}).length, done:()=>Object.keys(state.cosmetics||{}).length>=6, reward:{coins:20000000}},
  /* 🤖 BAZAR BOTÓW — nowe wyzwania */
  {id:"bot_1",      icon:"🤖", name:"Pierwszy interes", desc:"Kup cokolwiek od bota na bazarze.",       target:1,  prog:()=>numFrom(state.stats.botBuys||0), done:()=>numFrom(state.stats.botBuys||0)>=1,  reward:{coins:15000}},
  {id:"bot_10",     icon:"🤝", name:"Stały klient",     desc:"Kup 10 rzeczy od botów.",                 target:10, prog:()=>numFrom(state.stats.botBuys||0), done:()=>numFrom(state.stats.botBuys||0)>=10, reward:{coins:250000}},
  {id:"bot_50",     icon:"🛒", name:"Król bazaru",      desc:"Kup 50 rzeczy od botów.",                 target:50, prog:()=>numFrom(state.stats.botBuys||0), done:()=>numFrom(state.stats.botBuys||0)>=50, reward:{coins:5000000}},
  {id:"bot_case_1", icon:"📦", name:"Zapas na później", desc:"Kup pierwszą skrzynkę od bota.",          target:1,  prog:()=>numFrom(state.stats.botCases||0), done:()=>numFrom(state.stats.botCases||0)>=1, reward:{coins:30000}},
  {id:"bot_case_10",icon:"🗃️", name:"Hurtownik",        desc:"Kup 10 skrzynek od botów.",               target:10, prog:()=>numFrom(state.stats.botCases||0), done:()=>numFrom(state.stats.botCases||0)>=10,reward:{coins:1000000}},
  {id:"bot_cheap",  icon:"🏷️", name:"Rodzynek",         desc:"Kup broń co najmniej 35% taniej niż normalnie.", target:35, prog:()=>Math.min(35,numFrom(state.stats.bestDeal||0)), done:()=>numFrom(state.stats.bestDeal||0)>=35, reward:{coins:250000}},
  {id:"stock_1",    icon:"🗄️", name:"Prosto z magazynu",desc:"Otwórz skrzynkę z zapasu kupionego u bota.", target:1, prog:()=>numFrom(state.stats.stockOpened||0), done:()=>numFrom(state.stats.stockOpened||0)>=1, reward:{coins:50000}},
  {id:"stock_25",   icon:"🏗️", name:"Logistyka",        desc:"Otwórz 25 skrzynek z zapasu.",            target:25, prog:()=>numFrom(state.stats.stockOpened||0), done:()=>numFrom(state.stats.stockOpened||0)>=25, reward:{coins:1500000}},
  /* 💎 DODATKOWE KAMIENIE MILOWE */
  {id:"open_50",    icon:"📦", name:"Pół setki",        desc:"Otwórz 50 skrzynek.",                    target:50,   prog:()=>state.stats.opened, done:()=>state.stats.opened>=50,   reward:{coins:15000}},
  {id:"open_500",   icon:"📦", name:"Pięćsetka",        desc:"Otwórz 500 skrzynek.",                   target:500,  prog:()=>state.stats.opened, done:()=>state.stats.opened>=500,  reward:{coins:100000}},
  {id:"sell_100",   icon:"💰", name:"Handlarz",         desc:"Sprzedaj 100 przedmiotów.",              target:100,  prog:()=>state.stats.sold,   done:()=>state.stats.sold>=100,     reward:{coins:100000}},
  {id:"sell_1000",  icon:"💸", name:"Giełda",           desc:"Sprzedaj 1000 przedmiotów.",             target:1000, prog:()=>state.stats.sold,   done:()=>state.stats.sold>=1000,    reward:{coins:2000000}},
  {id:"battle_25",  icon:"⚔️", name:"Weteran aren",      desc:"Stocz 25 bitew.",                        target:25,   prog:()=>state.stats.battles,done:()=>state.stats.battles>=25,   reward:{coins:150000}},
  {id:"fx_25",      icon:"✨", name:"Fabryka błysku",   desc:"Wykręć 25 efektów na broniach.",         target:25,   prog:()=>state.stats.fxTotal,done:()=>state.stats.fxTotal>=25,   reward:{coins:750000}},
  {id:"knife_50",   icon:"★",  name:"Ostrza na ścianie",desc:"Wylosuj 50 noży.",                       target:50,   prog:()=>state.stats.knives, done:()=>state.stats.knives>=50,    reward:{coins:5000000}},
  {id:"album_100",  icon:"📖", name:"Setka w albumie",  desc:"Odkryj 100 skinów w albumie.",           target:100,  prog:()=>albumHave(),       done:()=>albumHave()>=100,          reward:{coins:200000}},
  {id:"cos_3",      icon:"🎨", name:"Trzy pieczęcie",   desc:"Kup 3 kosmetyki.",                       target:3,    prog:()=>Object.keys(state.cosmetics||{}).length, done:()=>Object.keys(state.cosmetics||{}).length>=3, reward:{coins:5000000}},
  {id:"coins_10m",  icon:"🪙", name:"Dziesięć milionów",desc:"Zgromadź 10 000 000 monet.",             target:10000000, prog:()=>state.coins,   done:()=>state.coins>=10000000,     reward:{coins:250000}},
  /* 🧩 ULEPSZENIA — nowe wyzwania */
  {id:"idle_knife", icon:"💤", name:"Cierpliwy",         desc:"Odbierz nóż za 1,5 godziny czasu gry.",   target:1,    prog:()=>state.idleKnifeClaimed?1:0, done:()=>state.idleKnifeClaimed===true, reward:{coins:250000}},
  {id:"up_10",      icon:"🧩", name:"Ulepszony",         desc:"Kup 10 poziomów ulepszeń.",              target:10,   prog:()=>upTotal(),         done:()=>upTotal()>=10,             reward:{coins:100000}},
  {id:"up_25",      icon:"🧬", name:"Inżynier",          desc:"Kup 25 poziomów ulepszeń.",              target:25,   prog:()=>upTotal(),         done:()=>upTotal()>=25,             reward:{coins:1000000}},
  {id:"up_max",     icon:"🏅", name:"Perfekcjonista",    desc:"Wymaksuj dowolne ulepszenie.",           target:1,    prog:()=>UPGRADES.filter(u=>upLvl(u.id)>=u.max).length, done:()=>UPGRADES.some(u=>upLvl(u.id)>=u.max), reward:{coins:2000000}},
  {id:"perk_all",   icon:"🏆", name:"Kolekcjoner mocy",  desc:"Kup po jednym poziomie każdego ulepszenia.", target:UPGRADES.length, prog:()=>UPGRADES.filter(u=>upLvl(u.id)>0).length, done:()=>UPGRADES.every(u=>upLvl(u.id)>0), reward:{coins:10000000}}
];

function checkAchievements(){
  if(!state.achievements || typeof state.achievements !== "object" || Array.isArray(state.achievements)) state.achievements = {};
  let unlocked = 0;
  ACHIEVEMENTS.forEach(a=>{
    if(state.achievements[a.id]) return;
    let met = false;
    try { met = !!a.done(); } catch(e){ met = false; }
    if(!met) return;
    state.achievements[a.id] = Date.now();
    if(a.reward && a.reward.coins) state.coins += a.reward.coins;
    unlocked++;
    toast("🏆 <b>Osiągnięcie!</b> "+a.icon+" "+a.name+" — nagroda: 🪙 "+fmt(a.reward.coins),"good");
    confetti();
  });
  if(unlocked){ markDirty(); save(); renderStats(); renderBalance(); }
}
function renderAchievements(){
  const g = $("#achGrid"); if(!g) return;
  const h = $("#achHint"); if(h) h.innerHTML = `odblokowane <b>${ACHIEVEMENTS.filter(a=>state.achievements[a.id]).length}</b> / ${ACHIEVEMENTS.length}`;
  g.innerHTML = ACHIEVEMENTS.map((a,i)=>{
    const un = !!state.achievements[a.id];
    let p = 0;
    try { p = Math.min(1, (a.prog()||0) / Math.max(1, a.target||1)); } catch(e){ p = 0; }
    const pct = Math.round(p*100);
    const prog = (a.prog()||0) >= (a.target||1) ? "✔" : (fmt(a.prog()||0)+" / "+fmt(a.target||1));
    return `<div class="ach-card ${un?"unlocked":"locked"}" style="animation-delay:${i*25}ms">
      <span class="ach-badge">${un?"ODBLOKOWANE":"W TOKU"}</span>
      <span class="ach-ico">${a.icon}</span>
      <div class="ach-body">
        <div class="ach-name">${esc(a.name)}</div>
        <div class="ach-desc">${esc(a.desc)}</div>
        ${un?"":`<div class="ach-prog"><i style="width:${pct}%"></i></div>`}
        <div class="ach-rew">${un?"✔ odebrane":"Nagroda:"} 🪙 ${fmt((a.reward&&a.reward.coins)||0)}</div>
        ${un?"":`<div class="ach-desc" style="font-size:10px">${prog}</div>`}
      </div></div>`;
  }).join("");
}/* 🎨 KOSMETYKI — patche na bron, kupowane za monety, daja bonus do wartosci */
const COSMETICS = [
  {id:"pat_star",  icon:"⭐", name:"Gwiazda",      desc:"Kawalek kosmicznego pylu.",        cost:5000000,   mult:1.10, color:"#fde047"},
  {id:"pat_flame", icon:"🔥", name:"Plomien",      desc:"Wiecy z daleka.",                  cost:15000000,  mult:1.15, color:"#f97316"},
  {id:"pat_ice",   icon:"❄️", name:"Lod",          desc:"Wieczna zima na broni.",           cost:30000000,  mult:1.20, color:"#38bdf8"},
  {id:"pat_volt",  icon:"⚡", name:"Błyskawica",   desc:"Elektryczne wyładowanie.",         cost:75000000,  mult:1.25, color:"#a855f7"},
  {id:"pat_skull", icon:"💀", name:"Czaszka",      desc:"Ostatnie spojrzenie.",              cost:200000000, mult:1.35, color:"#eb4b4b"},
  {id:"pat_crown", icon:"👑", name:"Korona",       desc:"Królewski znak.",                 cost:500000000, mult:1.50, color:"#ffd700"}
];
const COSMETIC_BY_ID = {};
COSMETICS.forEach(c=>COSMETIC_BY_ID[c.id]=c);
/* 🎨 ulepszenie "Zniżka na patche" */
const cosmeticCost = c => Math.max(1, Math.round(c.cost * (1 - PATCH_STEP*upLvl("patch"))));
function buyCosmetic(id){
  const c = COSMETIC_BY_ID[id];
  if(!c) return;
  if(state.cosmetics && state.cosmetics[id]){ sfxErr(); return; }
  const price = cosmeticCost(c);
  if(state.coins < price){ sfxErr(); toast("Za mało monet na "+c.icon+" "+c.name+" (🪙 "+fmt(price)+")","bad"); return; }
  state.coins -= price;
  state.cosmetics = state.cosmetics || {};
  state.cosmetics[id] = true;
  sfxCoin(); burst(rnd(120,innerWidth-120), rnd(140,360), c.color);
  save(); renderStats();
  toast(c.icon+" <b>"+c.name+"</b> zakupiony! Twoje bronie dostaną +" + Math.round((c.mult-1)*100) + "% wartości.","good");
}
function cosmeticMult(){
  let m = 1;
  COSMETICS.forEach(c=>{ if(state.cosmetics && state.cosmetics[c.id]) m *= c.mult; });
  return m;
}
function renderCosmetics(){
  const g = $("#cosGrid"); if(!g) return;
  const h = $("#cosHint"); if(h) h.innerHTML = `kupione <b>${COSMETICS.filter(c=>state.cosmetics&&state.cosmetics[c.id]).length}</b> / ${COSMETICS.length}`;
  g.innerHTML = COSMETICS.map((c,i)=>{
    const owned = !!(state.cosmetics && state.cosmetics[c.id]);
    return `<div class="cos-card ${owned?"owned":"locked"}" style="animation-delay:${i*40}ms">
      <span class="cos-ico">${c.icon}</span>
      <div class="cos-body">
        <div class="cos-name">${esc(c.name)}</div>
        <div class="cos-desc">${esc(c.desc)}</div>
        <div class="cos-rew">Bonus: +${Math.round((c.mult-1)*100)}% wartości</div>
        ${owned
          ? `<button class="btn tb-btn cos-btn" disabled>✔ Posiadasz</button>`
          : `<button class="btn primary cos-btn" data-cos="${c.id}" title="🪙 ${fmt(cosmeticCost(c))}">Kup za 🪙 ${fmtShort(cosmeticCost(c))}</button>`}
      </div></div>`;
  }).join("");
}