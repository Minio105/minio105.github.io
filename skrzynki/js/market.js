"use strict";

/* =======================================================================
   8. SKLEP
   ======================================================================= */
function oddsBar(c){
  if(c.troll){
    const p = Math.max(0.8, (c.trollChance||TROLL_CHANCE)*100);
    return `<i style="width:${100-p}%;background:#64748b"></i><i style="width:${p}%;background:#fbbf24"></i>`;
  }
  const o = oddsFor(c);
  return TIERS.map(t=>{
    const p = (o[t]||0)*100;
    return p > 0 ? `<i style="width:${Math.max(p,0.8)}%;background:${TIER[t].color}"></i>` : "";
  }).join("");
}
function oddsLegend(c){
  if(c.troll){
    const p = (c.trollChance||TROLL_CHANCE)*100;
    return `<span style="color:#fbbf24"><i class="dot" style="background:#fbbf24"></i>
        <span style="color:var(--dim)">🪙 ${fmtShort(c.trollJackpot||TROLL_JACKPOT)} ${p.toFixed(2)}%</span></span>
      <span style="color:#94a3b8"><i class="dot" style="background:#94a3b8"></i>
        <span style="color:var(--dim)">🪙 ${fmt(c.trollConsolation||TROLL_CONSOLATION)} ${(100-p).toFixed(2)}%</span></span>`;
  }
  const o = oddsFor(c);
  return TIERS.map(t=>{
    const p = (o[t]||0)*100;
    if(p<=0) return "";
    const nm = t==="special" ? "★ Noże" : t==="relic" ? "✦ Relikty" : TIER[t].name;
    return `<span style="color:${TIER[t].color}"><i class="dot" style="background:${TIER[t].color}"></i>
      <span style="color:var(--dim)">${nm} ${p<0.1?p.toFixed(2):p.toFixed(1)}%</span></span>`;
  }).join("");
}
/* Ranga skrzynki liczona z ceny — nowe skrzynki od razu dostają właściwą oprawę.
   Każda skrzynka ma też własną skórkę: data-skin="<id>" (CSS niżej w <style>). */
const TIER_NAME = {common:"Zwykła", rare:"Rzadka", epic:"Epicka", legendary:"Legendarna"};
function caseTier(c){
  if(c.price >= 700000) return "legendary";
  if(c.price >=   50000) return "epic";
  if(c.price >=    3000) return "rare";
  return "common";
}
/* kratka ozdób: 5 miejsc w warstwie za skrzynką i 5 przed nią */
const DEKO = n => `<i></i>`.repeat(n);

let lastShopSig = "";
function shopHintHTML(){
  const cheapest = Math.min(...CASES.filter(c=>!c.botOnly).map(c=>c.price));
  const lk = upLvl("luck");
  const active = [];
  if(lk) active.push("🎯 Szczęście "+lk+"/"+UP_BY_ID.luck.max);
  const kn = upLvl("knives");
  if(kn) active.push("🔪 Łowca Noży "+kn+"/"+UP_BY_ID.knives.max);
  if(cloverActive()) active.push("🍀 Koniczyna "+Math.ceil(cloverLeft()/1000)+" s — "+cloverDesc());
  const fxEv = fxEventPool().filter(f=>fxEventActive(f.id));
  if(fxEv.length) active.push("🎰 Eventy efektów: "+fxEv.map(f=>f.icon+" "+mmss(Math.max(0,numFrom(state.fxEvents[f.id])-Date.now()))).join(" · ")+" — +"+Math.round(FX_EVENT_LUCK*fxEv.length*100)+"% luck");
  if(autoOpen) active.push("🤖 Auto: "+esc(autoOpen.name)+" — "+autoOpen.n+" "+plural(autoOpen.n,"otwarcie","otwarcia","otwarć"));
  const stockN = CASES.reduce((a,c)=>a+caseStock(c.id),0);
  return [
    state.coins < cheapest ? "Brakuje monet — użyj przycisku 🎁 Bonus" : "★ Noże są rzadsze, ale warte więcej",
    stockN ? "📦 W zapasie: <b>"+fmt(stockN)+"</b> "+plural(stockN,"skrzynka","skrzynki","skrzynek")+" z bazaru botów" : "🤖 "+BOT_CASES.length+" "+plural(BOT_CASES.length,"skrzynka","skrzynki","skrzynek")+" tylko u botów — zakładka Bazar botów",
    "🕶️ Skrzynki botów są jednorazowe — po otwarciu nie wracają za monety.",
    "✨ Efekty na broniach mnożą wartość: "+FX.map(f=>f.icon+"×"+fxM(f)).join(" · "),
    eventFxList().length ? "🎉 EVENT: "+eventFxList().map(f=>f.icon+" "+f.name+" ×"+fxM(f)).join(" · ") : "",
    active.join(" · ") + (active.length ? " — szanse już z ulepszeniami" : "")
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");
}
function syncShopButtons(){
  const grid = $("#caseGrid");
  if(!grid) return;
  grid.querySelectorAll(".case-card[data-case]").forEach(card=>{
    const c = CASES.find(x=>x.id===card.dataset.case);
    if(!c) return;
    const st = caseStock(c.id);
    const tag = card.querySelector(".stock-tag");
    if(tag){
      if(st) tag.innerHTML = "📦 W zapasie: <b>"+st+"</b> "+plural(st,"skrzynka","skrzynki","skrzynek")+" — otwarcie bez opłat";
      else tag.remove();
    }
    const sb = card.querySelector("[data-stockopen]");
    if(sb){
      if(st) sb.textContent = "📦 Otwórz z zapasu ("+st+")";
      else sb.remove();
    }
    const o1 = card.querySelector("[data-open]");
    if(o1) o1.disabled = state.coins < c.price;
    const o10 = card.querySelector("[data-open10]");
    if(o10) o10.disabled = state.coins < Math.round(c.price * (1 - bulkRate())) * 10;
  });
}
function shopSignature(shopCases){
  return shopCases.map(c=>c.id+":"+(caseStock(c.id)>0?1:0)).join("|")
    + "|" + UPGRADES.map(u=>upLvl(u.id)).join(",")
    + "|" + (cloverActive() ? 1 : 0)
    + "|" + (autoOpen ? autoOpen.id : "");
}
function renderShop(force){
  /* skrzynki tylko z bazaru botów pokazujemy dopiero, gdy masz je w zapasie —
     inaczej nie byłoby jak ich otworzyć (nie ma ich w zwykłej sprzedaży) */
  const grid = $("#caseGrid");
  if(!grid) return;
  const shopCases = CASES.filter(c=>!c.botOnly || caseStock(c.id)>0);
  const sig = shopSignature(shopCases);
  $("#shopHint").innerHTML = shopHintHTML();

  /* Najważniejsza optymalizacja: zmiana samych monet nie przerysowuje 44 kart.
     Dzięki temu po otwarciu skrzynki nie odtwarza się animacja wejścia. */
  if(!force && lastShopSig === sig && grid.children.length){
    syncShopButtons();
    if(currentView === "battle") renderBattle();
    return;
  }
  lastShopSig = sig;

  grid.innerHTML = shopCases.map((c,i)=>{
    const ten = Math.round(c.price * (1 - bulkRate())) * 10;
    const can = state.coins>=c.price, can10 = state.coins>=ten;
    const tier = caseTier(c);
    const st = caseStock(c.id);
    const aOn = !!autoOpen && autoOpen.id===c.id, aUnl = autoUnlocked();
    return `<div class="case-card tier-${tier}${c.mega?" mega":""}${c.elite?" elite":""}${c.ultra?" ultra":""}" data-skin="${c.id}" style="--cc:${c.color};animation-delay:${i*70}ms" data-case="${c.id}">
      <span class="case-tag">${c.troll ? "TROLL · JACKPOT" : c.ultra ? "ULTRA · "+TIER_NAME[tier] : c.mega ? "MEGA · "+TIER_NAME[tier] : c.elite ? "ELITA · "+TIER_NAME[tier] : c.botOnly ? "Tylko u botów" : TIER_NAME[tier]}</span>
      <div class="crate">
        <div class="deko back">${DEKO(5)}</div>
        <div class="halo"></div>
        <div class="shine"></div>
        <div class="box3d">
          <div class="body"><span class="pat"></span><span class="emblem">${c.icon}</span></div>
          <div class="lid"></div>
          <div class="lock"></div>
          <div class="bracket b1"></div><div class="bracket b2"></div>
          <div class="bracket b3"></div><div class="bracket b4"></div>
        </div>
        <div class="glowfloor"></div>
        <div class="deko front">${DEKO(5)}</div>
      </div>
      <div class="case-name">${esc(c.name)}</div>
      <div class="case-sub">${esc(c.sub)}</div>
      <div class="odds">${oddsBar(c)}</div>
      <div class="odds-legend">${oddsLegend(c)}</div>
      ${st?`<div class="stock-tag">📦 W zapasie: <b>${st}</b> ${plural(st,"skrzynka","skrzynki","skrzynek")} — otwarcie bez opłat</div>`:""}
      <div class="price-row">
        <span class="price" title="🪙 ${fmt(c.price)}">🪙 ${fmtShort(c.price)}</span>
        <span class="price-target">${c.troll ? "🤡 jackpot 🪙 "+fmtShort(c.trollJackpot||TROLL_JACKPOT) : "★ nóż ~ "+fmtShort(itemValue(c,"special","Karambit|Fala"))}</span>
      </div>
      <div class="btn-row">
        ${st?`<button class="btn gold open-btn" style="flex:1 1 100%" data-stockopen="${c.id}">📦 Otwórz z zapasu (${st})</button>`:""}
        ${c.botOnly ? "" : `<button class="btn primary open-btn" data-open="${c.id}" ${can?"":"disabled"}>${c.troll?"🤡 Zaryzykuj":"Otwórz"}</button>
        <button class="btn ghost" data-open10="${c.id}" title="Otwórz 10 skrzynek (🪙 ${fmt(ten)} łącznie)" ${can10?"":"disabled"}>×10</button>`}
        <button class="btn ghost loot-btn" data-loot="${c.id}" title="Zobacz wszystkie bronie w tej skrzynce">📋 Zawartość</button>
        ${c.botOnly ? "" : `<button class="btn ghost auto-btn${aOn?" on":""}${aUnl?"":" locked"}" data-auto="${c.id}"
          title="${aUnl
            ? (aOn ? "Zatrzymaj auto-otwieranie"
                   : "Otwieraj tę skrzynkę automatycznie — "+(autoTurboOn() ? "⚡ ok. 4 otwarcia / s" : "1 otwarcie / "+autoStepTxt()+" s")
                     +(autoLimit() ? " · limit "+autoLimit()+" otwarć" : " · bez limitu"))
            : "Ulepszenie 🤖 Auto-otwieranie (🪙 12 500) — zakładka 🚀 Ulepszenia"}">${aOn?"⏹ Stop":"🤖 Auto"}${aUnl?"":' <span class="lock">🔒</span>'}</button>`}
      </div>
    </div>`;
  }).join("");
  grid.classList.add("ready");
  syncShopButtons();
  if(currentView === "battle") renderBattle();
}
$("#caseGrid").addEventListener("click", e=>{
  const lo  = e.target.closest("[data-loot]");
  if(lo){ showLoot(lo.dataset.loot); return; }
  const so = e.target.closest("[data-stockopen]");
  const o1 = e.target.closest("[data-open]");
  const o10 = e.target.closest("[data-open10]");
  const au = e.target.closest("[data-auto]");
  if(so) openCase(so.dataset.stockopen, so.closest(".case-card"), true);
  if(o1) openCase(o1.dataset.open, o1.closest(".case-card"));
  if(o10) openMany(o10.dataset.open10, 10);
  if(au) switchAuto(au.dataset.auto);
});

/* =======================================================================
   8c. PODGLĄD ZAWARTOŚCI SKRZYNKI — wszystkie bronie z danej skrzynki
   ======================================================================= */
function showLoot(caseId){
  const c = CASES.find(x=>x.id===caseId);
  if(!c) return;
  if(c.troll){
    const p = (c.trollChance||TROLL_CHANCE)*100;
    $("#lootTitle").textContent = c.name;
    $("#lootTag").innerHTML = "🪙 "+fmtShort(c.price)+" &nbsp;·&nbsp; skrzynka troll";
    $("#lootBody").innerHTML = `
      <div class="loot-bonus lb-fx"><i class="lb-ico">🤡</i><span class="lb-txt">
        <b>Tu nie ma broni. Tu jest ryzyko.</b>
        W środku są tylko dwie rzeczy: <b>🪙 ${fmt(c.trollJackpot||TROLL_JACKPOT)}</b> z szansą
        <b>${p.toFixed(2)}%</b> albo <b>🪙 ${fmt(c.trollConsolation||TROLL_CONSOLATION)}</b>
        z szansą <b>${(100-p).toFixed(2)}%</b>. Monety trafiają od razu na konto.
      </span></div>`;
    $("#lootOverlay").classList.add("show");
    return;
  }
  const o = oddsFor(c);
  const total = TIERS.reduce((s,t)=>s+(c.items[t]||[]).length,0);
  $("#lootTitle").textContent = c.name;
  $("#lootTag").innerHTML = "🪙 "+fmtShort(c.price)+" &nbsp;·&nbsp; "+total+" "+plural(total,"broń","broni","broni");
  $("#lootBody").innerHTML =
    `<div class="loot-bonus"><i class="lb-ico">🍀</i><span class="lb-txt">
      <b>Czterolistna koniczyna — szansa ${(CLOVER_CHANCE*100).toFixed(1)}%</b>
      Wypada <em>dodatkowo</em> przy otwarciu skrzynki (także przy ×10) i na ${Math.round(cloverDur()/1000)} s
      daje większe szanse na noże i dobre bronie: ${cloverDesc()}.
    </span></div>` +
    `<div class="loot-bonus lb-fx"><i class="lb-ico">✨</i><span class="lb-txt">
      <b>Rzadkie efekty na broniach — razem ok. ${(FX_CHANCE*100).toFixed(1)}% na drop</b>
      Zdobycz może dostać efekt, który mnoży jej wartość i widać go na karcie:
      ${FX.map(f=>f.icon+" <em>"+f.name+"</em> ×"+fxM(f)+" ("+(f.chance*100).toFixed(2)+"%)").join(" · ")}.
      Droższe tiery mają trochę większą szansę na błysk, a mnożnik działa od razu przy sprzedaży.
    </span></div>` + TIERS.map(t=>{
    const pool = c.items[t]||[];
    if(!pool.length) return "";
    const pct = (o[t]*100).toFixed(2)+"%";
    const cards = pool.map(([w,n,art])=>{
      const it = { uid:"lp"+hash(w+"|"+n).toString(36), w, n, art:art||guessArt(w), tier:t, caseId:c.id,
                   value:itemValue(c,t,w+"|"+n), ts:0 };
      return itemCardHTML(it);
    }).join("");
    return `<div class="loot-sec" style="--c:${TIER[t].color}">
      <div class="loot-sec-h"><i></i>${t==="special"?"★ Noże":t==="relic"?"✦ Relikty":TIER[t].name}
        <span>${pool.length} ${plural(pool.length,"pozycja","pozycje","pozycji")} · szansa ${pct}</span></div>
      <div class="loot-grid">${cards}</div>
    </div>`;
  }).join("");
  $("#lootOverlay").classList.add("show");
}
function closeLoot(){ $("#lootOverlay").classList.remove("show"); }
$("#lootClose").addEventListener("click", closeLoot);
$("#lootOverlay").addEventListener("click", e=>{ if(e.target.id==="lootOverlay") closeLoot(); });

/* =======================================================================
   8a. 🤖 BAZAR BOTÓW — limitowane oferty broni i skrzynek
   -----------------------------------------------------------------------
   Każdy bot ma własny zapas (1–3 szt.). Oferty rotują co BOT_TTL, można je
   też odświeżyć ręcznie (co BOT_REFRESH_CD). Ceny wahają się od ~55% do
   ~155% normalnej wartości, więc część to okazje, a część przepłacone.
   Skrzynki kupione tutaj trafiają do state.caseStock i otwiera się je
   bez opłat w zakładce Skrzynki.
   ======================================================================= */
const BOT_TTL        = 8*60*1000;   // rotacja ofert
const BOT_REFRESH_CD = 60*1000;     // przerwa między ręcznymi odświeżeniami
const BOT_SLOTS      = 4;           // 3 bronie + 1 skrzynka na bota
const BOT_SELLERS = [
  {id:"gizmo", icon:"🤖", name:"Gizmo_2200", tag:"złom i okazje",  line:"„Wszystko legalne. Prawie.”"},
  {id:"vince", icon:"🕶️", name:"Vince",       tag:"przemytnik",     line:"„Nie pytaj, skąd to mam.”"},
  {id:"mech",  icon:"🦾", name:"M3CH-9",      tag:"hurt i detal",   line:"„Cena się zmienia. Jak wszystko.”"},
  {id:"lena",  icon:"🎲", name:"LuckyLena",   tag:"hazardzistka",   line:"„Raz na jakiś czas trafia się perełka.”"}
];
const BOT_TIER_W = {
  gizmo:{mil:56, restricted:30, classified:10, covert:3.4, special:0.6},
  vince:{mil:20, restricted:40, classified:26, covert:11,   special:3},
  mech: {mil:40, restricted:34, classified:18, covert:6,    special:2},
  lena: {mil:24, restricted:30, classified:25, covert:15,   special:6}
};
const BOT_FACTOR = {   // [min, max] mnożnik ceny względem normalnej wartości
  gizmo:[0.52, 0.88],
  vince:[0.72, 1.32],
  mech: [0.87, 1.12],
  lena: [0.58, 1.58]
};
const BOT_CACHE = {tag:"", list:[]};

/* =======================================================================
   🔑 KODY — bardzo rzadkie bonusy ze skrzynek i jednorazowe oferty botów
   ======================================================================= */
const CODE_DROP_CHANCE = 0.0006;   // 0,06% na otwarcie skrzynki (1 na ~1667)
const CODES = [
  {id:"neon",     icon:"💡", name:"Kod Neonowy",    code:"KOD-NEON-25",      rarity:"rare",     reward:25000,   price:20000,  desc:"Neonowe światło i szybki zysk."},
  {id:"sand",     icon:"🏜️", name:"Kod Pustyni",   code:"KOD-SAND-50",      rarity:"rare",     reward:50000,   price:40000,  desc:"Suchy jak pustynny wiatr."},
  {id:"storm",    icon:"⛈️", name:"Kod Burzy",     code:"KOD-STORM-100",    rarity:"rare",     reward:100000,  price:80000,  desc:"Ładunek, który zawsze trafia."},
  {id:"midnight", icon:"🌙", name:"Kod Północy",   code:"KOD-MIDNIGHT-250", rarity:"rare",     reward:250000,  price:200000, desc:"Cichy kod na nocne otwarcia."},
  {id:"dragon",   icon:"🐉", name:"Kod Smoka",     code:"KOD-DRAGON-500",   rarity:"rare",     reward:500000,  price:400000, desc:"Syczący skarb ze smoczej jaskini."},
  {id:"void",     icon:"🕳️", name:"Kod Pustki",    code:"KOD-VOID-1M",      rarity:"rare",     reward:1000000, price:800000, desc:"Coś, czego nie powinno się znaleźć."},
  {id:"royal",    icon:"👑", name:"Kod Królewski", code:"KOD-ROYAL-2M5",    rarity:"rare",     reward:2500000, price:2000000,desc:"Królewska pieczęć i pełna sakiewka."},
  {id:"otchlan",  icon:"🌌", name:"Kod Otchłani",  code:"KOD-OTCHLAN-10M",  rarity:"veryRare", reward:10000000,price:8000000,desc:"Jeden na całą kolekcję. Bardzo rzadki."}
];
const CODE_BY_ID = {};
CODES.forEach(c=>CODE_BY_ID[c.id] = c);
const CODE_RARITY = {
  rare:     {name:"Rzadki",       color:"#60a5fa"},
  veryRare: {name:"Bardzo rzadki",color:"#a855f7"}
};

function codeCount(id){ return numFrom(state.codes && state.codes[id]); }
function codeUniqueRedeemed(){
  const m = state.codeRedeemed || {};
  return CODES.filter(c=>numFrom(m[c.id]) > 0).length;
}
function codeOwnedTotal(){
  return CODES.reduce((a,c)=>a + codeCount(c.id), 0);
}
function addCode(id, n){
  if(!CODE_BY_ID[id]) return;
  state.codes = (state.codes && typeof state.codes === "object" && !Array.isArray(state.codes)) ? state.codes : {};
  state.codes[id] = codeCount(id) + Math.max(1, n|0);
}
function grantCode(id, source){
  const def = CODE_BY_ID[id];
  if(!def) return null;
  addCode(id, 1);
  if(source === "drop"){
    state.stats.codeDrops = numFrom(state.stats.codeDrops) + 1;
    sfxCode();
    toast("🔑 <b>KOD!</b> " + def.icon + " <b>" + esc(def.name) + "</b> — " + esc(def.code) +
      " · +🪙 " + fmt(def.reward) + ". Odbierzesz go w zakładce <b>Kody</b>.","good");
  }
  markDirty(); save({kind: source === "drop" ? "code" : undefined});
  renderCodeBadge();
  return def;
}
function rollCodeDrop(){
  if(Math.random() >= CODE_DROP_CHANCE) return null;
  // Ze skrzynek wypadają kody rzadkie. Kod Otchłani jest dodatkową, bardzo rzadką
  // ofertą wyłącznie u botów — dlatego nie ma go w tej puli.
  const pool = CODES.filter(c => c.rarity === "rare");
  return grantCode(pool[(Math.random()*pool.length)|0].id, "drop");
}
function codeCardHTML(def, mode){
  const r = CODE_RARITY[def.rarity] || CODE_RARITY.rare;
  const owned = codeCount(def.id);
  const redeemed = numFrom((state.codeRedeemed||{})[def.id]);
  const bought = !!(state.codeBought && state.codeBought[def.id]);
  const sold = mode === "shop" && bought;
  let action = "";
  if(mode === "owned"){
    action = `<button class="btn primary" data-coderedeem="${def.id}">Odbierz +🪙 ${fmtShort(def.reward)}</button>`;
  } else {
    action = sold
      ? `<button class="btn" disabled>Kupione</button>`
      : `<button class="btn gold" data-codebuy="${def.id}" ${state.coins < def.price ? "disabled" : ""}>Kup za 🪙 ${fmtShort(def.price)}</button>`;
  }
  const qty = mode === "owned"
    ? `<span class="cc-qty">masz ×${owned}</span>`
    : redeemed
      ? `<span class="cc-qty">odebrano ${redeemed}×</span>`
      : `<span class="cc-qty">jednorazowa oferta</span>`;
  return `<div class="code-card ${def.rarity}${sold?" bought":""}" style="--cc:${r.color}">
    <div class="cc-top">
      <div class="code-ico">${def.icon}</div>
      <div style="min-width:0">
        <div class="code-name">${esc(def.name)}</div>
        <span class="code-rarity" style="color:${r.color};border-color:color-mix(in srgb,${r.color} 45%,transparent);background:color-mix(in srgb,${r.color} 13%,transparent)">${r.name}</span>
      </div>
    </div>
    <div class="code-string">${esc(def.code)}</div>
    <div class="code-reward"><span>Nagroda: <b>🪙 ${fmt(def.reward)}</b></span>${qty}</div>
    <div class="code-actions">${action}</div>
  </div>`;
}
function renderCodeShop(){
  const g = $("#codeShop");
  if(g){
    g.innerHTML = CODES.map(c=>codeCardHTML(c, "shop")).join("");
    g.classList.add("ready");
    const h = $("#codeShopHint");
    if(h){
      const n = CODES.filter(c=>state.codeBought && state.codeBought[c.id]).length;
      h.innerHTML = `kupione <b>${n}</b> / ${CODES.length} · jeden bardzo rzadki`;
    }
  }
  renderCodeBadge();
}
function renderCodes(){
  const g = $("#codeOwned");
  if(g){
    const owned = CODES.filter(c=>codeCount(c.id) > 0);
    g.innerHTML = owned.length
      ? owned.map(c=>codeCardHTML(c, "owned")).join("")
      : `<div class="code-empty">Nie masz jeszcze żadnego kodu. Wypadają <b>bardzo rzadko</b> ze skrzynek, w <b>ofertach eventowych Sklepu</b> albo u botów w <b>Bazarze botów</b>.</div>`;
    g.classList.add("ready");
    const h = $("#codeOwnedHint");
    if(h) h.innerHTML = `do odebrania: <b>${codeOwnedTotal()}</b>`;
  }
  const hint = $("#codeHint");
  if(hint){
    hint.innerHTML = `w kolekcji: <b>${codeUniqueRedeemed()}</b> / ${CODES.length} · odebrane kody: <b>${numFrom(state.stats.codeRedeems)}</b>`;
  }
  const rh = $("#codeRedeemHint");
  if(rh) rh.innerHTML = "Kod musi być w Twojej kolekcji — zdobądź go ze skrzynki, z oferty eventowej Sklepu albo kup u bota.";
  renderCodeBadge();
}
function renderCodeBadge(){
  const badge = $("#codeCount");
  if(!badge) return;
  const n = codeOwnedTotal();
  badge.textContent = n ? String(n) : "";
  badge.style.display = n ? "" : "none";
}
function buyCodeOffer(id){
  const def = CODE_BY_ID[id];
  if(!def) return;
  if(state.codeBought && state.codeBought[id]){ sfxErr(); toast("Ten kod już kupiłeś — oferta jest jednorazowa","bad"); return; }
  if(state.coins < def.price){ sfxErr(); toast("Za mało monet na ten kod","bad"); return; }
  state.coins -= def.price;
  state.stats.spent += def.price;
  state.stats.codeBuys = numFrom(state.stats.codeBuys) + 1;
  state.codeBought = (state.codeBought && typeof state.codeBought === "object") ? state.codeBought : {};
  state.codeBought[id] = true;
  addCode(id, 1);
  sfxCoin();
  toast("🔑 Kupiono <b>"+esc(def.name)+"</b> — kod czeka w zakładce Kody","good");
  markDirty(); save(); renderBalance(); renderCodeShop(); renderCodes(); checkAchievements();
}
function redeemCodeById(id){
  const def = CODE_BY_ID[id];
  if(!def) return;
  if(codeCount(id) <= 0){ sfxErr(); toast("Nie masz tego kodu","bad"); return; }
  state.codes[id] = codeCount(id) - 1;
  if(!state.codes[id]) delete state.codes[id];
  state.codeRedeemed = (state.codeRedeemed && typeof state.codeRedeemed === "object") ? state.codeRedeemed : {};
  state.codeRedeemed[id] = numFrom(state.codeRedeemed[id]) + 1;
  state.stats.codeRedeems = numFrom(state.stats.codeRedeems) + 1;
  state.coins += def.reward;
  sfxCoin(); confetti(["#a855f7","#ffd76a","#ffffff"]);
  toast("🔑 Odebrano <b>"+esc(def.name)+"</b>: +🪙 "+fmt(def.reward),"good");
  markDirty(); save(); renderBalance(); renderCodes(); checkAchievements();
}
function redeemCodeString(raw){
  const code = String(raw||"").trim().toUpperCase();
  if(!code){ sfxErr(); toast("Wpisz kod","bad"); return; }
  const def = CODES.find(c=>c.code === code);
  if(!def){ sfxErr(); toast("❌ Nieprawidłowy kod. Sprawdź go dokładnie.","bad"); return; }
  if(codeCount(def.id) <= 0){
    sfxErr();
    toast("Nie masz tego kodu. Znajdź go w skrzynce albo kup u bota.","bad");
    return;
  }
  redeemCodeById(def.id);
  const inp = $("#codeInput"); if(inp) inp.value = "";
}

function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const botCycle = () => Math.floor(Date.now()/BOT_TTL);
function botStockMap(){
  if(!state.botBought || typeof state.botBought !== "object" || Array.isArray(state.botBought)) state.botBought = {};
  return state.botBought;
}
function caseStock(id){
  const m = state.caseStock;
  return (m && typeof m === "object" && !Array.isArray(m)) ? numFrom(m[id]) : 0;
}
function botLeft(o){ return Math.max(0, o.max - numFrom(botStockMap()[o.id])); }
function botTag(){ return botCycle()+"_"+numFrom(state.botSalt)+"_"+upLvl("trade"); }
function pickWeighted(w, rndF){
  const keys = Object.keys(w);
  let total = 0; keys.forEach(k=>total+=w[k]);
  let r = rndF()*total;
  for(const k of keys){ r -= w[k]; if(r <= 0) return k; }
  return keys[0];
}
function botOffers(){
  const tag = botTag();
  if(BOT_CACHE.tag === tag) return BOT_CACHE.list;
  const rndF = mulberry32(hash("botmarket|"+tag));
  const bought = botStockMap();
  Object.keys(bought).forEach(k=>{ if(k.indexOf("b"+tag+"_") !== 0) delete bought[k]; });
  const pool = CASES.filter(c=>!c.secret && !c.mega && !c.elite && !c.ultra && !c.noItems);
  const trade = 1 - TRADE_STEP*upLvl("trade");   // 🏷️ Targowanie
  const list = [];
  BOT_SELLERS.forEach((s, si)=>{
    for(let k=0;k<BOT_SLOTS;k++){
      const id = "b"+tag+"_"+si+"_"+k;
      if(k === BOT_SLOTS-1){                       // skrzynka
        let c;
        if(si === 0) c = BOT_CASES[botCycle() % BOT_CASES.length];
        else if(rndF() < 0.34) c = BOT_CASES[(rndF()*BOT_CASES.length)|0];
        else c = pool[(rndF()*pool.length)|0];
        const base = c.price;
        const f = c.botOnly ? 0.94 + rndF()*0.22 : 0.72 + rndF()*0.56;
        list.push({ id, seller:s.id, kind:"case", caseId:c.id, base,
                    price:Math.max(1, Math.round(roundNice(base*f) * trade)), max: c.botOnly ? 1 : 1 + ((rndF()*2)|0) });
      } else {                                     // broń
        const c = pool[(rndF()*pool.length)|0];
        const tier = pickWeighted(BOT_TIER_W[s.id], rndF);
        const it = c.items[tier][(rndF()*c.items[tier].length)|0];
        const base = itemValue(c, tier, it[0]+"|"+it[1]);
        const f = BOT_FACTOR[s.id][0] + rndF()*(BOT_FACTOR[s.id][1]-BOT_FACTOR[s.id][0]);
        list.push({ id, seller:s.id, kind:"weapon", caseId:c.id, tier, w:it[0], n:it[1], art:it[2], base,
                    price:Math.max(1, Math.round(roundNice(base*f) * trade)), max: 1 + ((rndF()*3)|0) });
      }
    }
  });
  BOT_CACHE.tag = tag; BOT_CACHE.list = list;
  return list;
}
function botOfferHTML(o){
  const left = botLeft(o);
  const sold = left <= 0;
  const diff = Math.round((o.price/o.base - 1)*100);
  const deal = diff <= 0 ? `<span class="bo-deal">${diff}%</span>` : `<span class="bo-deal bad">+${diff}%</span>`;
  const stockTxt = sold ? "wykupione" : "zostało "+left+" z "+o.max;
  const stockCls = "bo-stock"+(left>0 && left<=1 ? " low" : "");
  if(o.kind === "case"){
    const c = CASES.find(x=>x.id===o.caseId);
    if(!c) return "";
    return `<div class="bot-offer${sold?" sold":""}" style="--c:${c.color}${sold?";--c:#44506b":""}">
      <div class="bo-art bo-case" style="--cc:${c.color}">${c.icon}</div>
      <div class="bo-main">
        <div class="bo-w">${c.botOnly ? "tylko u botów" : "skrzynka"}</div>
        <div class="bo-n">${esc(c.name)}</div>
        <div class="bo-meta"><span class="bo-price" title="🪙 ${fmt(o.price)}">🪙 ${fmtShort(o.price)}</span>
          <span class="bo-base">🪙 ${fmtShort(o.base)}</span>${deal}
          <span class="${stockCls}">${stockTxt}</span></div>
      </div>
      <button class="bo-buy" data-botbuy="${o.id}" ${sold?"disabled":""}>${sold?"—":"Kup"}</button>
    </div>`;
  }
  const t = TIER[o.tier];
  return `<div class="bot-offer${sold?" sold":""}" style="--c:${t.color}">
    <div class="bo-art">${weaponSVG({w:o.w,n:o.n,tier:o.tier,art:o.art}, hash(o.id).toString(36))}</div>
    <div class="bo-main">
      <div class="bo-w">${esc(o.w)}</div>
      <div class="bo-n">${esc(o.n)}</div>
      <div class="bo-meta"><span class="bo-price" title="🪙 ${fmt(o.price)}">🪙 ${fmtShort(o.price)}</span>
        <span class="bo-base">🪙 ${fmtShort(o.base)}</span>${deal}
        <span class="${stockCls}">${stockTxt}</span></div>
    </div>
    <button class="bo-buy" data-botbuy="${o.id}" ${sold?"disabled":""}>${sold?"—":"Kup"}</button>
  </div>`;
}
function mmss(ms){
  const s = Math.max(0, Math.ceil(ms/1000));
  return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
}
function botTick(){
  const h = $("#botHint");
  if(h){
    const offers = botOffers();
    const sold = offers.filter(o=>botLeft(o)<=0).length;
    h.innerHTML = "rotacja za <b>"+mmss(BOT_TTL - (Date.now()%BOT_TTL))+"</b> · dostępne: <b>"+
      (offers.length-sold)+"</b> / "+offers.length;
  }
  const btn = $("#botRefresh");
  if(btn){
    const cd = Math.max(0, numFrom(state.botRefreshAt) - Date.now());
    btn.disabled = cd > 0;
    btn.textContent = cd > 0 ? "⏳ "+mmss(cd) : "🔄 Nowe oferty";
  }
  const badge = $("#botCount");
  if(badge){
    const n = CASES.reduce((a,c)=>a+caseStock(c.id),0);
    badge.textContent = n ? String(n) : "";
    badge.style.display = n ? "" : "none";
  }
}
function renderBots(force){
  const g = $("#botGrid"); if(!g) return;
  /* Bazar przerysowujemy tylko wtedy, gdy jest widoczny (albo po wymuszonym
     odświeżeniu). Otwarcie skrzynki nie mieli w tle czterech kart bazaru. */
  if(currentView !== "bots" && !force){ botTick(); return; }
  const offers = botOffers();
  g.innerHTML = BOT_SELLERS.map((s,i)=>{
    const mine = offers.filter(o=>o.seller===s.id);
    const any = mine.some(o=>botLeft(o)>0);
    return `<div class="bot-card" style="animation-delay:${i*70}ms">
      <div class="bot-head">
        <div class="bot-ava">${s.icon}</div>
        <div><div class="bot-name">${esc(s.name)}</div><div class="bot-tag">${esc(s.tag)}</div></div>
        <div class="bot-live${any?"":" off"}">● ${any?"ONLINE":"WYKUPIONY"}</div>
      </div>
      <div class="bot-line">${s.line}</div>
      <div class="bot-offers">${mine.map(botOfferHTML).join("")}</div>
    </div>`;
  }).join("");
  g.classList.add("ready");
  botTick();
  renderCodeShop();
}
function buyBotOffer(id){
  const off = botOffers().find(o=>o.id===id);
  if(!off) return;
  if(botLeft(off) <= 0){ sfxErr(); toast("Ten bot już wszystko sprzedał","bad"); return; }
  if(state.coins < off.price){ sfxErr(); toast("Za mało monet!","bad"); return; }

  state.coins -= off.price;
  state.stats.spent += off.price;
  state.stats.botBuys  = numFrom(state.stats.botBuys) + 1;
  state.stats.botSpent = numFrom(state.stats.botSpent) + off.price;
  botStockMap()[off.id] = numFrom(botStockMap()[off.id]) + 1;

  if(off.kind === "case"){
    state.caseStock = (state.caseStock && typeof state.caseStock === "object" && !Array.isArray(state.caseStock)) ? state.caseStock : {};
    state.caseStock[off.caseId] = caseStock(off.caseId) + 1;
    state.stats.botCases = numFrom(state.stats.botCases) + 1;
    const c = CASES.find(x=>x.id===off.caseId);
    sfxCoin();
    toast("📦 Kupiono <b>"+esc(c ? c.name : "skrzynkę")+"</b> — czeka w zapasie w zakładce Skrzynki. To skrzynka jednorazowa: po otwarciu zniknie, a kolejną kupisz tylko u bota.","good");
  } else {
    const item = { uid:"b"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
      w:off.w, n:off.n, art:off.art, tier:off.tier, caseId:off.caseId, fx:null,
      value:Math.round(off.base), ts:Date.now() };
    addToInv(item);
    const diff = Math.round((off.price/off.base - 1)*100);
    if(diff < 0) state.stats.bestDeal = Math.min(100, Math.max(numFrom(state.stats.bestDeal), -diff));
    sfxCoin();
    toast((diff<=0 ? "🏷️ <b>Okazja!</b> " : "🛒 Kupiono ")+"<b>"+esc(item.n)+"</b> ("+esc(item.w)+") za 🪙 "+
      fmt(off.price)+(diff<0 ? " · "+(-diff)+"% taniej" : diff>0 ? " · +"+diff+"% drożej" : " · cena rynkowa"),"good");
  }
  markDirty(); save();
  renderBalance(); renderBots(); renderShop(); renderInv(); renderStats();
  checkAchievements();
}
function refreshBotOffers(){
  const cd = numFrom(state.botRefreshAt) - Date.now();
  if(cd > 0){ sfxErr(); toast("Boty potrzebują jeszcze "+mmss(cd)+" na nowy towar","bad"); return; }
  state.botSalt = numFrom(state.botSalt) + 1;
  state.botRefreshAt = Date.now() + BOT_REFRESH_CD;
  BOT_CACHE.tag = ""; BOT_CACHE.list = [];
  markDirty(); save(); renderBots();
  toast("🔄 Boty wystawiły nowy towar","good");
}
$("#botRefresh").addEventListener("click", refreshBotOffers);
$("#botGrid").addEventListener("click", e=>{
  const b = e.target.closest("[data-botbuy]");
  if(b) buyBotOffer(b.dataset.botbuy);
});
$("#codeShop").addEventListener("click", e=>{
  const b = e.target.closest("[data-codebuy]");
  if(b) buyCodeOffer(b.dataset.codebuy);
});
$("#codeOwned").addEventListener("click", e=>{
  const b = e.target.closest("[data-coderedeem]");
  if(b) redeemCodeById(b.dataset.coderedeem);
});
$("#codeInput").addEventListener("keydown", e=>{
  if(e.key === "Enter") redeemCodeString($("#codeInput").value);
});
$("#codeRedeem").addEventListener("click", ()=>redeemCodeString($("#codeInput").value));
$("#codeInput").addEventListener("keydown", e=>{ if(e.key === "Enter") redeemCodeString(e.target.value); });
setInterval(()=>{
  if(currentView !== "bots") return;
  if(BOT_CACHE.tag !== botTag()) renderBots();
  else botTick();
}, 1000);

/* =======================================================================
   8a. 🛒 SKLEP + 🎉 EVENTY
   -----------------------------------------------------------------------
   Większy, spokojniejszy kuzyn bazaru: pięciu sprzedawców, po pięć
   ofert każdy, własny zapas i rzadsza rotacja. Eventowe oferty dodają
   broń, skrzynię i — tylko w niektórych rotacjach — kod.
   ======================================================================= */
const SHOP_TTL          = 6*60*1000;  // rotacja sklepu
const SHOP_REFRESH_CD   = 45*1000;    // przerwa między ręcznymi odświeżeniami
const SHOP_SLOTS        = 5;          // 4 bronie + 1 skrzynka
const SHOP_EVENT_CODE_CHANCE = 0.05;  // kod tylko w ~5% rotacji eventowych
const SHOP_SELLERS = [
  {id:"bruno", icon:"🧔", name:"Bruno",  tag:"sklep ogólny",   line:"„U mnie nie ma kolejek.”"},
  {id:"mira",  icon:"👩‍🔧", name:"Mira",   tag:"zbrojmistrzyni", line:"„Broń? Tylko sprawdzona.”"},
  {id:"kruk",  icon:"🦅", name:"Kruk",   tag:"kolekcjoner",     line:"„Każda skrzynka ma swoją historię.”"},
  {id:"neo",   icon:"🛰️", name:"NEO-7",  tag:"technologie",     line:"„System poleca: kupuj więcej.”"},
  {id:"vega",  icon:"💫", name:"Vega",   tag:"eventy i okazje", line:"„Okazje nie czekają.”"}
];
const SHOP_TIER_W = {
  bruno:{mil:48, restricted:34, classified:12, covert:4.5, special:1},
  mira: {mil:18, restricted:36, classified:28, covert:14,   special:4},
  kruk: {mil:32, restricted:32, classified:22, covert:10,   special:4},
  neo:  {mil:40, restricted:32, classified:18, covert:7,    special:3},
  vega: {mil:22, restricted:30, classified:26, covert:15,   special:7}
};
const SHOP_FACTOR = {
  bruno:[0.60, 0.95],
  mira: [0.72, 1.08],
  kruk: [0.58, 1.35],
  neo:  [0.82, 1.02],
  vega: [0.55, 1.20]
};
const SHOP_CACHE = {tag:"", list:[]};
let FX_EVENT_SIG = "";

const shopCycle = () => Math.floor(Date.now()/SHOP_TTL);
function shopStockMap(){
  if(!state.shopBought || typeof state.shopBought !== "object" || Array.isArray(state.shopBought)) state.shopBought = {};
  return state.shopBought;
}
function shopLeft(o){ return Math.max(0, o.max - numFrom(shopStockMap()[o.id])); }
function shopTag(){ return shopCycle()+"_"+numFrom(state.shopSalt)+"_"+upLvl("trade"); }
/* Eventy rotują tylko z czasem — ręczne odświeżenie sklepu nie pozwala
   przelosowywać szansy na kod. Dzięki temu kody naprawdę pozostają rzadkie. */
function eventTag(){ return "ev"+shopCycle()+"_"+upLvl("trade"); }
function shopCacheKey(){ return shopTag()+"|"+eventTag(); }

/* Wybiera przedmiot z tieru, a gdy skrzynka nie ma danego tieru — awaryjnie
   losuje inny dostępny tier. Dzięki temu nowe/nietypowe skrzynki nie wywalą
   generowania ofert. */
function shopPickItem(c, tier, rndF){
  let t = tier;
  let arr = (c.items && Array.isArray(c.items[t])) ? c.items[t] : [];
  if(!arr.length){
    const tiers = Object.keys(TIER).filter(k=>c.items && Array.isArray(c.items[k]) && c.items[k].length);
    if(!tiers.length) return null;
    t = tiers[(rndF()*tiers.length)|0];
    arr = c.items[t];
  }
  return {tier:t, it:arr[(rndF()*arr.length)|0]};
}

function shopOffers(){
  const tag = shopTag();
  const evTag = eventTag();
  const cacheKey = tag+"|"+evTag;
  if(SHOP_CACHE.tag === cacheKey) return SHOP_CACHE.list;
  const rndF = mulberry32(hash("playershop|"+tag));
  const evRnd = mulberry32(hash("playerevent|"+evTag));
  const bought = shopStockMap();
  Object.keys(bought).forEach(k=>{
    if(k.indexOf("s"+tag+"_") !== 0 && k.indexOf("e"+evTag+"_") !== 0) delete bought[k];
  });
  const pool = CASES.filter(c=>!c.botOnly && !c.secret && !c.mega && !c.elite && !c.ultra && !c.noItems);
  const trade = 1 - TRADE_STEP*upLvl("trade");
  const list = [];

  SHOP_SELLERS.forEach((s, si)=>{
    for(let k=0;k<SHOP_SLOTS;k++){
      const id = "s"+tag+"_"+si+"_"+k;
      if(k === SHOP_SLOTS-1){                      // skrzynka
        const c = pool[(rndF()*pool.length)|0];
        const base = c.price;
        const f = 0.76 + rndF()*0.34;
        list.push({ id, seller:s.id, kind:"case", caseId:c.id, base,
                    price:Math.max(1, Math.round(roundNice(base*f) * trade)),
                    max: 1 + ((rndF()*4)|0) });
      } else {                                    // broń
        const c = pool[(rndF()*pool.length)|0];
        const tier = pickWeighted(SHOP_TIER_W[s.id], rndF);
        const pick = shopPickItem(c, tier, rndF);
        if(!pick) continue;
        const it = pick.it;
        const base = itemValue(c, pick.tier, it[0]+"|"+it[1]);
        const f = SHOP_FACTOR[s.id][0] + rndF()*(SHOP_FACTOR[s.id][1]-SHOP_FACTOR[s.id][0]);
        list.push({ id, seller:s.id, kind:"weapon", caseId:c.id, tier:pick.tier, w:it[0], n:it[1], art:it[2], base,
                    price:Math.max(1, Math.round(roundNice(base*f) * trade)),
                    max: 1 + ((rndF()*4)|0) });
      }
    }
  });

  /* 🎉 Eventy — zawsze broń + skrzynia, kod tylko czasami.
     Losowanie eventów ma własny seed powiązany wyłącznie z czasem (evTag),
     więc ręczne odświeżenie sklepu nie zmienia eventów ani szansy na kod. */
  const evId = "e"+evTag;
  const evCase = pool[(evRnd()*pool.length)|0];
  const evCaseBase = evCase.price;
  list.push({ id:evId+"_case", seller:"event", kind:"case", event:true, caseId:evCase.id, base:evCaseBase,
              price:Math.max(1, Math.round(roundNice(evCaseBase*(0.76+evRnd()*0.22)) * trade)),
              max: 1 + ((evRnd()*3)|0) });

  const evWeaponCase = pool[(evRnd()*pool.length)|0];
  const evTier = pickWeighted({mil:24, restricted:32, classified:26, covert:13, special:5}, evRnd);
  const evPick = shopPickItem(evWeaponCase, evTier, evRnd);
  if(evPick){
    const it = evPick.it;
    const evBase = itemValue(evWeaponCase, evPick.tier, it[0]+"|"+it[1]);
    list.push({ id:evId+"_weapon", seller:"event", kind:"weapon", event:true,
                caseId:evWeaponCase.id, tier:evPick.tier, w:it[0], n:it[1], art:it[2], base:evBase,
                price:Math.max(1, Math.round(roundNice(evBase*(0.72+evRnd()*0.26)) * trade)),
                max: 1 + ((evRnd()*3)|0) });
  }

  if(evRnd() < SHOP_EVENT_CODE_CHANCE){
    const codePool = CODES.filter(c=>c.rarity === "rare");
    const def = codePool[(evRnd()*codePool.length)|0];
    const base = def.price;
    list.push({ id:evId+"_code", seller:"event", kind:"code", event:true, codeId:def.id, base,
                price:Math.max(1, Math.round(roundNice(base*(0.82+evRnd()*0.12)) * trade)),
                max:1 });
  }

  SHOP_CACHE.tag = cacheKey; SHOP_CACHE.list = list;
  return list;
}

function shopOfferHTML(o){
  const left = shopLeft(o);
  const sold = left <= 0;
  const diff = Math.round((o.price/Math.max(1,o.base) - 1)*100);
  const deal = diff <= 0 ? `<span class="bo-deal">${diff}%</span>` : `<span class="bo-deal bad">+${diff}%</span>`;
  const stockTxt = sold ? "wykupione" : "zostało "+left+" z "+o.max;
  const stockCls = "bo-stock"+(left>0 && left<=1 ? " low" : "");
  const eventTag = o.event ? "🎉 event · " : "";
  if(o.kind === "case"){
    const c = CASES.find(x=>x.id===o.caseId);
    if(!c) return "";
    return `<div class="bot-offer${sold?" sold":""}" style="--c:${c.color}${sold?";--c:#44506b":""}">
      <div class="bo-art bo-case" style="--cc:${c.color}">${c.icon}</div>
      <div class="bo-main">
        <div class="bo-w">${eventTag}skrzynka</div>
        <div class="bo-n">${esc(c.name)}</div>
        <div class="bo-meta"><span class="bo-price" title="🪙 ${fmt(o.price)}">🪙 ${fmtShort(o.price)}</span>
          <span class="bo-base">🪙 ${fmtShort(o.base)}</span>${deal}
          <span class="${stockCls}">${stockTxt}</span></div>
      </div>
      <button class="bo-buy" data-shopbuy="${o.id}" ${sold?"disabled":""}>${sold?"—":"Kup"}</button>
    </div>`;
  }
  const t = TIER[o.tier];
  return `<div class="bot-offer${sold?" sold":""}" style="--c:${t.color}">
    <div class="bo-art">${weaponSVG({w:o.w,n:o.n,tier:o.tier,art:o.art}, hash(o.id).toString(36))}</div>
    <div class="bo-main">
      <div class="bo-w">${eventTag}${esc(o.w)}</div>
      <div class="bo-n">${esc(o.n)}</div>
      <div class="bo-meta"><span class="bo-price" title="🪙 ${fmt(o.price)}">🪙 ${fmtShort(o.price)}</span>
        <span class="bo-base">🪙 ${fmtShort(o.base)}</span>${deal}
        <span class="${stockCls}">${stockTxt}</span></div>
    </div>
    <button class="bo-buy" data-shopbuy="${o.id}" ${sold?"disabled":""}>${sold?"—":"Kup"}</button>
  </div>`;
}

function eventOfferHTML(o){
  const left = shopLeft(o);
  const sold = left <= 0;
  const diff = Math.round((o.price/Math.max(1,o.base) - 1)*100);
  const deal = diff <= 0 ? `<span class="bo-deal">${diff}%</span>` : `<span class="bo-deal bad">+${diff}%</span>`;
  const stockTxt = sold ? "wykupione" : "zostało "+left+" z "+o.max;
  const stockCls = "event-stock"+(left>0 && left<=1 ? " low" : "");

  if(o.kind === "code"){
    const def = CODE_BY_ID[o.codeId];
    if(!def) return "";
    const r = CODE_RARITY[def.rarity] || CODE_RARITY.rare;
    return `<div class="event-card event-code${sold?" sold":""}" style="--c:${r.color}">
      <div class="event-badge">🎉 EVENT · KOD</div>
      <div class="event-head">
        <div class="event-ico">${def.icon}</div>
        <div style="min-width:0"><div class="event-name">${esc(def.name)}</div>
          <div class="event-sub">${r.name} · bardzo rzadka oferta</div></div>
      </div>
      <div class="event-code-string">${esc(def.code)}</div>
      <div class="event-meta"><span class="event-price" title="🪙 ${fmt(o.price)}">🪙 ${fmtShort(o.price)}</span>
        <span class="event-base">🪙 ${fmtShort(o.base)}</span>${deal}
        <span class="${stockCls}">${stockTxt}</span></div>
      <button class="event-buy" data-shopbuy="${o.id}" ${sold?"disabled":""}>${sold?"Sprzedane":"Kup kod"}</button>
    </div>`;
  }

  if(o.kind === "case"){
    const c = CASES.find(x=>x.id===o.caseId);
    if(!c) return "";
    return `<div class="event-card${sold?" sold":""}" style="--c:${c.color}">
      <div class="event-badge">🎉 EVENT · SKRZYNKA</div>
      <div class="event-art event-case" style="--c:${c.color}">${c.icon}</div>
      <div class="event-name">${esc(c.name)}</div>
      <div class="event-sub">skrzynka eventowa</div>
      <div class="event-meta"><span class="event-price" title="🪙 ${fmt(o.price)}">🪙 ${fmtShort(o.price)}</span>
        <span class="event-base">🪙 ${fmtShort(o.base)}</span>${deal}
        <span class="${stockCls}">${stockTxt}</span></div>
      <button class="event-buy" data-shopbuy="${o.id}" ${sold?"disabled":""}>${sold?"Sprzedane":"Kup skrzynkę"}</button>
    </div>`;
  }

  const t = TIER[o.tier];
  return `<div class="event-card${sold?" sold":""}" style="--c:${t.color}">
    <div class="event-badge">🎉 EVENT · BROŃ</div>
    <div class="event-art">${weaponSVG({w:o.w,n:o.n,tier:o.tier,art:o.art}, hash(o.id).toString(36))}</div>
    <div class="event-name">${esc(o.n)}</div>
    <div class="event-sub">${esc(o.w)}</div>
    <div class="event-meta"><span class="event-price" title="🪙 ${fmt(o.price)}">🪙 ${fmtShort(o.price)}</span>
      <span class="event-base">🪙 ${fmtShort(o.base)}</span>${deal}
      <span class="${stockCls}">${stockTxt}</span></div>
    <button class="event-buy" data-shopbuy="${o.id}" ${sold?"disabled":""}>${sold?"Sprzedane":"Kup broń"}</button>
  </div>`;
}

function fxEventSignature(){
  return fxEventPool().map(f=>f.id+":"+(fxEventActive(f.id)?"1":"0")).join("|");
}
function updateFxEventHint(){
  const h = $("#fxEventHint");
  if(!h) return;
  const active = fxEventPool().filter(f=>fxEventActive(f.id));
  if(!active.length){
    h.innerHTML = "nieaktywne · każdy event daje +"+Math.round(FX_EVENT_LUCK*100)+"% luck";
    return;
  }
  const next = Math.min(...active.map(f=>numFrom(state.fxEvents[f.id]) - Date.now()));
  h.innerHTML = "aktywne: <b>"+active.length+"</b> · +<b>"+Math.round(FX_EVENT_LUCK*active.length*100)+
    "%</b> luck · najbliższy koniec za <b>"+mmss(Math.max(0,next))+"</b>";
}
function fxEventCardHTML(f){
  const left = Math.max(0, numFrom(state.fxEvents && state.fxEvents[f.id]) - Date.now());
  const active = left > 0;
  const price = fxEventPrice(f);
  const ch = f.chance*100;
  const chTxt = ch < 0.1 ? ch.toFixed(2) : ch.toFixed(1);
  return `<div class="event-card fx-event-card${active?" active":""}" style="--c:${f.color}">
    <div class="event-badge">🎰 EVENT EFEKTU${active?" · AKTYWNY":""}</div>
    <div class="event-head">
      <div class="event-ico">${f.icon}</div>
      <div style="min-width:0"><div class="event-name">${esc(f.name)}</div>
        <div class="event-sub">×${FX_EVENT_BOOST} waga · +${Math.round(FX_EVENT_LUCK*100)}% luck</div></div>
    </div>
    <div class="fx-event-chance">Szansa bazowa: <b>${chTxt}%</b> na drop · mnożnik wartości <b>×${fxM(f)}</b></div>
    <div class="fx-event-time${active?" on":""}" data-fx-left="${f.id}">${active?"aktywny jeszcze "+mmss(left):"nieaktywny"}</div>
    <div class="event-meta"><span class="event-price">🪙 ${fmtShort(price)}</span><span class="event-stock">${Math.round(FX_EVENT_DUR/60000)} min</span></div>
    <button class="event-buy" data-fxevent="${f.id}">${active?"Przedłuż +"+Math.round(FX_EVENT_DUR/60000)+" min":"Kup event"}</button>
  </div>`;
}
function renderFxEvents(){
  const g = $("#fxEventGrid");
  if(!g) return;
  g.innerHTML = fxEventPool().map(fxEventCardHTML).join("");
  g.classList.add("ready");
  FX_EVENT_SIG = fxEventSignature();
  updateFxEventHint();
}
function fxEventTick(){
  if(currentView !== "market") return;
  const g = $("#fxEventGrid");
  if(!g || !g.children.length) return;
  if(FX_EVENT_SIG !== fxEventSignature()){ renderFxEvents(); return; }
  updateFxEventHint();
  $$("[data-fx-left]").forEach(el=>{
    const id = el.dataset.fxLeft;
    const f = FX_BY_ID[id] || EVENT_FX_BY_ID[id];
    if(!f) return;
    const left = Math.max(0, numFrom(state.fxEvents && state.fxEvents[id]) - Date.now());
    el.textContent = left > 0 ? "aktywny jeszcze "+mmss(left) : "nieaktywny";
    el.classList.toggle("on", left > 0);
  });
}
function buyFxEvent(id){
  const f = fxEventPool().find(x=>x.id===id);
  if(!f) return;
  const price = fxEventPrice(f);
  if(state.coins < price){ sfxErr(); toast("Za mało monet na event efektu","bad"); return; }
  state.coins -= price;
  state.stats.spent += price;
  state.stats.shopBuys = numFrom(state.stats.shopBuys) + 1;
  state.stats.shopSpent = numFrom(state.stats.shopSpent) + price;
  state.fxEvents = (state.fxEvents && typeof state.fxEvents === "object" && !Array.isArray(state.fxEvents)) ? state.fxEvents : {};
  const before = numFrom(state.fxEvents[id]);
  const now = Date.now();
  state.fxEvents[id] = Math.max(now, before) + FX_EVENT_DUR;
  markDirty(); save();
  sfxCoin();
  toast((before>now ? "🎰 Przedłużono event: " : "🎰 Kupiono event: ")+"<b>"+f.icon+" "+esc(f.name)+
    "</b> — ×"+FX_EVENT_BOOST+" wagi przez "+Math.round(FX_EVENT_DUR/60000)+" min.","good");
  renderBalance(); renderMarket(true); renderShop(); renderStats(); checkAchievements();
}

function shopTick(){
  const offers = shopOffers();
  const sold = offers.filter(o=>shopLeft(o)<=0).length;
  const left = offers.length - sold;
  const h = $("#marketHint");
  if(h) h.innerHTML = "rotacja za <b>"+mmss(SHOP_TTL - (Date.now()%SHOP_TTL))+"</b> · dostępne: <b>"+
    left+"</b> / "+offers.length;
  const btn = $("#shopRefresh");
  if(btn){
    const cd = Math.max(0, numFrom(state.shopRefreshAt) - Date.now());
    btn.disabled = cd > 0;
    btn.textContent = cd > 0 ? "⏳ "+mmss(cd) : "🔄 Nowe oferty";
  }
  const badge = $("#shopCount");
  if(badge){
    badge.textContent = left ? String(left) : "";
    badge.style.display = left ? "" : "none";
  }
  const eh = $("#eventHint");
  if(eh){
    const code = offers.find(o=>o.seller==="event" && o.kind==="code");
    eh.innerHTML = "rotacja za <b>"+mmss(SHOP_TTL - (Date.now()%SHOP_TTL))+"</b> · " +
      (code ? (shopLeft(code)>0 ? "🔑 <b>kod dostępny!</b>" : "🔑 kod wykupiony") : "🔑 kod: brak w tej rotacji");
  }
  fxEventTick();
}

function renderMarket(force){
  const g = $("#shopGrid"); if(!g) return;
  if(currentView !== "market" && !force){ shopTick(); return; }
  const offers = shopOffers();
  g.innerHTML = SHOP_SELLERS.map((s,i)=>{
    const mine = offers.filter(o=>o.seller===s.id);
    const any = mine.some(o=>shopLeft(o)>0);
    return `<div class="bot-card" style="animation-delay:${i*60}ms">
      <div class="bot-head">
        <div class="bot-ava">${s.icon}</div>
        <div><div class="bot-name">${esc(s.name)}</div><div class="bot-tag">${esc(s.tag)}</div></div>
        <div class="bot-live${any?"":" off"}">● ${any?"ONLINE":"WYKUPIONY"}</div>
      </div>
      <div class="bot-line">${s.line}</div>
      <div class="bot-offers">${mine.map(shopOfferHTML).join("")}</div>
    </div>`;
  }).join("");
  g.classList.add("ready");
  const ev = $("#eventGrid");
  if(ev){
    ev.innerHTML = offers.filter(o=>o.seller==="event").map(eventOfferHTML).join("");
    ev.classList.add("ready");
  }
  renderFxEvents();
  shopTick();
}

function buyShopOffer(id){
  const off = shopOffers().find(o=>o.id===id);
  if(!off) return;
  if(off.kind === "code" && !CODE_BY_ID[off.codeId]) return;
  if(shopLeft(off) <= 0){ sfxErr(); toast("Ta oferta została już wykupiona","bad"); return; }
  if(state.coins < off.price){ sfxErr(); toast("Za mało monet!","bad"); return; }

  state.coins -= off.price;
  state.stats.spent += off.price;
  state.stats.shopBuys = numFrom(state.stats.shopBuys) + 1;
  state.stats.shopSpent = numFrom(state.stats.shopSpent) + off.price;
  shopStockMap()[off.id] = numFrom(shopStockMap()[off.id]) + 1;

  if(off.kind === "case"){
    state.caseStock = (state.caseStock && typeof state.caseStock === "object" && !Array.isArray(state.caseStock)) ? state.caseStock : {};
    state.caseStock[off.caseId] = caseStock(off.caseId) + 1;
    state.stats.shopCases = numFrom(state.stats.shopCases) + 1;
    const c = CASES.find(x=>x.id===off.caseId);
    sfxCoin();
    toast((off.event ? "🎉 Event: " : "📦 ") + "kupiono <b>"+esc(c ? c.name : "skrzynkę")+"</b> — czeka w zapasie w zakładce Skrzynki.","good");
  } else if(off.kind === "code"){
    const def = CODE_BY_ID[off.codeId];
    addCode(off.codeId, 1);
    state.stats.codeBuys = numFrom(state.stats.codeBuys) + 1;
    sfxCode();
    toast("🎉 Event: kupiono <b>"+esc(def.name)+"</b> — kod czeka w zakładce Kody.","good");
    renderCodes();
  } else {
    const item = { uid:"s"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
      w:off.w, n:off.n, art:off.art, tier:off.tier, caseId:off.caseId, fx:null,
      value:Math.round(off.base), ts:Date.now() };
    addToInv(item);
    const diff = Math.round((off.price/Math.max(1,off.base) - 1)*100);
    if(diff < 0) state.stats.bestDeal = Math.min(100, Math.max(numFrom(state.stats.bestDeal), -diff));
    sfxCoin();
    toast((diff<=0 ? "🏷️ <b>Okazja!</b> " : "🛒 Kupiono ")+"<b>"+esc(item.n)+"</b> ("+esc(item.w)+") za 🪙 "+
      fmt(off.price)+(diff<0 ? " · "+(-diff)+"% taniej" : diff>0 ? " · +"+diff+"% drożej" : " · cena rynkowa"),"good");
  }
  markDirty(); save();
  renderBalance(); renderMarket(true); renderShop(); renderInv(); renderStats();
  checkAchievements();
}

function refreshShopOffers(){
  const cd = numFrom(state.shopRefreshAt) - Date.now();
  if(cd > 0){ sfxErr(); toast("Sklep potrzebuje jeszcze "+mmss(cd)+" na nowy towar","bad"); return; }
  state.shopSalt = numFrom(state.shopSalt) + 1;
  state.shopRefreshAt = Date.now() + SHOP_REFRESH_CD;
  SHOP_CACHE.tag = ""; SHOP_CACHE.list = [];
  markDirty(); save(); renderMarket(true);
  toast("🔄 Sklep wystawił nowy towar","good");
}

$("#shopRefresh").addEventListener("click", refreshShopOffers);
$("#view-market").addEventListener("click", e=>{
  const fx = e.target.closest("[data-fxevent]");
  if(fx){ buyFxEvent(fx.dataset.fxevent); return; }
  const b = e.target.closest("[data-shopbuy]");
  if(b) buyShopOffer(b.dataset.shopbuy);
});
setInterval(()=>{
  if(currentView !== "market") return;
  if(SHOP_CACHE.tag !== shopCacheKey()) renderMarket();
  else shopTick();
}, 1000);

/* =======================================================================
   8b. SKLEP ULEPSZEŃ
   ======================================================================= */
function renderUp(){
  const grid = $("#upGrid");
  if(!grid) return;
  const done = upTotal(), all = upMaxTotal();
  const lk = upLvl("luck");
  $("#upHint").innerHTML = "Kupione poziomy: <b>"+done+" / "+all+"</b> &nbsp;·&nbsp; 🔪 Łowca Noży podnosi szansę na ★ &nbsp;·&nbsp; 🎯 Szczęście działa tylko na Ciebie";
  const badge = $("#upCount");
  if(badge){ badge.textContent = done ? String(done) : ""; badge.style.display = done ? "" : "none"; }
  $("#bonusBtn").title = "Darmowe monety co " + Math.round(bonusCd()/1000) + " s";
  $("#sellRateHint").textContent = Math.round(sellRate()*100) + "% wartości";

  grid.innerHTML = UPGRADES.map((u,i)=>{
    const lvl = upLvl(u.id), maxed = lvl >= u.max;
    const price = maxed ? 0 : upCost(u.id, lvl);
    const can = !maxed && state.coins >= price;
    const pips = Array.from({length:u.max},(_,k)=>'<i class="'+(k<lvl?"on":"")+'"></i>').join("");
    const eff = maxed
      ? '<span class="cur">'+u.fmt(lvl)+'</span>'
      : '<span class="cur">'+u.fmt(lvl)+'</span><span class="arrow">→</span><span class="nx">'+u.fmt(lvl+1)+'</span>';
    return '<div class="up-card'+(maxed?" maxed":"")+'" style="animation-delay:'+(i*60)+'ms">'
      + '<div class="up-head"><div class="up-icon">'+u.icon+'</div><div>'
      +   '<div class="up-name">'+u.name+'</div>'
      +   '<div class="up-sub">Poziom '+lvl+' / '+u.max+'</div></div></div>'
      + '<div class="up-desc">'+u.desc+'</div>'
      + '<div class="up-lvl'+(u.max>12?" many":"")+'">'+pips+'</div>'
      + '<div class="up-effect">'+eff+'</div>'
      + (maxed
        ? '<div class="up-buy"><span class="up-price" style="color:var(--ok)">✔ maksymalny poziom</span></div>'
        : '<div class="up-buy"><span class="up-price" title="🪙 '+fmt(price)+'">🪙 '+fmtShort(price)+'</span>'
          + '<button class="btn primary" data-up="'+u.id+'" '+(can?"":"disabled")+'>Ulepsz</button></div>')
      + '</div>';
  }).join("");
}

function buyUpgrade(id){
  const u = UP_BY_ID[id];
  if(!u) return;
  const lvl = upLvl(id);
  if(lvl >= u.max){ sfxErr(); return; }
  const price = upCost(id, lvl);
  if(state.coins < price){ sfxErr(); toast("Za mało monet!","bad"); return; }
  state.coins -= price;
  state.up[id] = lvl+1;
  missionTrack("upgrade",1);
  if(id === "luck" || id === "knives") ODDS_CACHE.clear();   // szanse zależą od tych perków
  sfxCoin(); burst(rnd(120, innerWidth-120), rnd(140, 360), TIER.special.color);
  renderBalance(); renderUp(); renderShop(); renderInv(); renderStats();
  toast(u.icon+" <b>"+u.name+"</b> → poziom "+(lvl+1)+" &nbsp;·&nbsp; "+u.fmt(lvl+1),"good");
  save();
}

$("#upGrid").addEventListener("click", e=>{
  const b = e.target.closest("[data-up]");
  if(b) buyUpgrade(b.dataset.up);
});

/* =======================================================================
   9. OTWIERANIE
   ======================================================================= */
const STRIP_LEN = 48, WIN_INDEX = 40, ITEM_W = 140, GAP = 8, STEP = ITEM_W+GAP;
let spinning=false, currentWin=null, spinTimer=null, spinRAF=null;

/* Wspólny rdzeń otwarcia: opłata, statystyki, misje i sam drop.
   Korzysta z niego zwykłe otwarcie (openCase) oraz 🤖 auto-otwieranie. */
function doOpen(c, free){
  const paid = free ? 0 : c.price;
  state.coins -= paid;
  state.stats.spent += paid;
  state.stats.opened++;
  state.stats.cases[c.id] = (state.stats.cases[c.id]||0)+1;
  missionTrack("open",1,{caseId:c.id});
  missionTrack("opencase:"+c.id, 1);
  missionTrack("spend", paid);
  if(cloverActive()) missionTrack("cloveropen",1);
  return c.troll ? trollDrop(c) : obtainDrop(c, pickTier(c));   // drop zapisuje się od razu
}

function openCase(caseId, cardEl, fromStock){
  if(spinning) return;
  const c = CASES.find(x=>x.id===caseId);
  if(!c) return;
  const stock = caseStock(c.id);
  const useStock = !!fromStock && stock > 0;
  if(c.botOnly && !useStock){
    sfxErr();
    toast("Tę skrzynkę otworzysz tylko z zapasu kupionego u bota — bez wznawiania za monety.","bad");
    return;
  }
  const free = useStock || Math.random() < couponChance();
  if(!free && state.coins < c.price){ sfxErr(); toast("Za mało monet!","bad"); return; }
  if(useStock){
    state.caseStock[c.id] = stock - 1;
    if(!state.caseStock[c.id]) delete state.caseStock[c.id];
    state.stats.stockOpened = numFrom(state.stats.stockOpened) + 1;
  }

  spinning = true;                        // blokada na czas animacji skrzynki
  if(useStock) toast("📦 <b>Otwierasz z zapasu</b> — bez opłat. Zostało: "+caseStock(c.id),"good");
  else if(free) toast("🎟️ <b>Kupon!</b> Otwarcie nic Cię nie kosztowało","good");
  const win = doOpen(c, free);   // addToInv/saveDrop już utrwalił drop i statystyki
  renderBalance(); renderShop(); renderBots();

  /* Troll nie ma puli broni, więc nie budujemy roulette’a z przedmiotów —
     wynik (monety) pokazujemy od razu. */
  if (c.troll || state.fast){ spinning = false; showResult([win], true); return; }

  // animacja "wstrząsu" skrzynki przed losowaniem
  if(cardEl){
    cardEl.classList.add("opening");
    sfxWhoosh();
    setTimeout(()=>cardEl.classList.remove("opening"), 420);
  }
  setTimeout(()=>spin(c, win, free, useStock), cardEl ? 330 : 0);
}

function spin(c, win, free, fromStock){
  const strip = $("#strip");
  let html = "";
  for(let i=0;i<STRIP_LEN;i++){
    const it = (i===WIN_INDEX) ? win : makeItem(c, pickTier(c));
    html += itemCardHTML(it, "strip-item").replace(/ data-uid="[^"]*"/,'');
  }
  strip.innerHTML = html;
  strip.classList.remove("fast");
  strip.style.transition = "none";
  strip.style.transform = "translateX(0px)";
  currentWin = win;
  spinning = true;

  $("#spinTitle").textContent = "Otwieranie: " + c.name;
  $("#spinTag").textContent = fromStock ? "📦 ZAPAS" : free ? "🎟️ DARMOWE" : "🪙 " + fmtShort(c.price);
  $("#spinStatus").textContent = "Losowanie…";
  $("#skipBtn").disabled = false;
  $("#spinOverlay").classList.add("show");

  const W = document.querySelector(".roulette").clientWidth || 900;
  const jitter = rnd(-ITEM_W*0.32, ITEM_W*0.32);
  const target = W/2 - (WIN_INDEX*STEP + ITEM_W/2) + jitter;
  const DUR = 6600;

  let kicked = false;
  const kick = ()=>{
    if(kicked || !spinning) return;
    kicked = true;
    strip.style.transition = "transform "+DUR+"ms cubic-bezier(.06,.72,.05,1)";
    strip.style.transform = "translateX("+target+"px)";
    runTicks(strip, DUR, target);
    spinTimer = setTimeout(finishSpin, DUR+50);
  };
  requestAnimationFrame(()=>requestAnimationFrame(kick));
  setTimeout(kick, 90);
}

function runTicks(strip, dur, target){
  const t0 = performance.now();
  let lastIdx = -1, blurred = false, lastSfx = 0;
  const loop = ()=>{
    if(!spinning) return;
    const now = performance.now();
    const t = Math.min(1,(now-t0)/dur);
    /* Nie czytamy getComputedStyle w każdej klatce — to wymuszało
       przeliczanie stylów 60 razy na sekundę i powodowało przycinki.
       Przybliżamy tę samą krzywą (szybki start, długie wyhamowanie). */
    const x = target * (1 - Math.pow(1-t, 4));
    const idx = Math.floor(-x/STEP);
    if(idx!==lastIdx){
      lastIdx = idx;
      if(t<0.99 && now-lastSfx>45){ lastSfx = now; sfxTick(); }
    }
    if(t<0.55 && !blurred){ blurred = true; strip.classList.add("fast"); }
    if(t>0.72 && blurred){ blurred = false; strip.classList.remove("fast"); }
    spinRAF = requestAnimationFrame(loop);
  };
  spinRAF = requestAnimationFrame(loop);
}

function endSpin(showRes){
  if(spinTimer) clearTimeout(spinTimer);
  if(spinRAF) cancelAnimationFrame(spinRAF);
  $("#strip").classList.remove("fast");
  spinning = false;
  const win = currentWin; currentWin = null;
  $("#spinOverlay").classList.remove("show");
  if(win && showRes) showResult([win], true);
  else if(win) toast("Zachowano <b>"+esc(win.n)+"</b> w ekwipunku","good");
}
function finishSpin(){ endSpin(true); }
$("#skipBtn").addEventListener("click", ()=>endSpin(true));
$("#spinClose").addEventListener("click", ()=>endSpin(false));

function openMany(caseId, count){
  if(spinning) return;
  const c = CASES.find(x=>x.id===caseId);
  if(!c) return;
  const stock = caseStock(c.id);
  if(c.botOnly){
    if(stock <= 0){
      sfxErr();
      toast("Tę skrzynkę otworzysz tylko z zapasu kupionego u bota.","bad");
      return;
    }
    count = Math.min(count, stock);
  }
  const useStock = Math.min(stock, count);
  const rest = count - useStock;
  // kupony mogą pokryć część płatnych otwarć
  let freeN = 0;
  for(let i=0;i<rest;i++) if(Math.random() < couponChance()) freeN++;
  const unit = Math.round(c.price * (1 - bulkRate()));     // rabat z ulepszenia "Hurt"
  const cost = unit*(rest-freeN);
  if(state.coins < cost){ sfxErr(); toast("Za mało monet na "+count+"× otwarcie!","bad"); return; }
  if(useStock){
    state.caseStock[c.id] = stock - useStock;
    if(!state.caseStock[c.id]) delete state.caseStock[c.id];
    state.stats.stockOpened = numFrom(state.stats.stockOpened) + useStock;
  }
  state.coins -= cost;
  state.stats.spent += cost;
  state.stats.opened += count;
  state.stats.cases[c.id] = (state.stats.cases[c.id]||0)+count;
  missionTrack("open", count, {caseId:c.id});
  missionTrack("opencase:"+c.id, count);
  missionTrack("open10", 1);
  missionTrack("spend", cost);
  if(cloverActive()) missionTrack("cloveropen", count);
  const wins = [];
  for(let i=0;i<count;i++) wins.push(c.troll ? trollDrop(c) : obtainDrop(c, pickTier(c)));
  if(useStock) toast("📦 <b>"+useStock+"×</b> z zapasu — bez opłat","good");
  if(freeN) toast("🎟️ <b>Kupony!</b> " + freeN + " z " + rest + " płatnych otwarć darmowych","good");
  renderBalance(); renderShop(); renderBots();
  showResult(wins, false);
}

/* =======================================================================
   9c. 🤖 AUTO-OTWIERANIE (odblokowywane ulepszeniem „Auto-otwieranie”)
   -----------------------------------------------------------------------
   Stan trzymamy tylko w sesji (jak 🔁 auto-walka) — nie trafia do zapisu.
   Każde otwarcie idzie przez doOpen(), więc misje, 🍀 koniczyna, album,
   kupony i ekwipunek działają dokładnie tak, jak przy ręcznym otwieraniu.
   ======================================================================= */
const AUTO_STEP = 700;         // ms między kolejnymi otwarciami
const AUTO_TURBO_STEP = 250;   // ⚡ turbo: ok. 4 otwarcia na sekundę
const AUTO_FEED = 6;           // ile ostatnich dropów pokazujemy na panelu
let autoOpen = null;           // {id,name,color,timer,n,spent,free,best,feed}

const autoUnlocked = () => upLvl("auto") > 0;

/* ⚡⏹ ustawienia auto-otwierania — zapisywane razem z grą (jak dźwięk albo szybkie otwieranie).
   autoLimitSan jest funkcją (nie const), żeby load() mógł jej użyć niezależnie od kolejności. */
function autoLimitSan(v){                               // 0 = bez limitu, inaczej dowolna sensowna liczba
  v = (typeof v === "number" && isFinite(v)) ? Math.round(v) : 0;
  return (v >= 1 && v <= 100000) ? v : 0;               // panel oferuje ∞ / 25 / 100 / 500
}
const autoTurboOn = () => state.autoTurbo === true;
const autoLimit   = () => autoLimitSan(state.autoLimit);
const autoStepMs  = () => autoTurboOn() ? AUTO_TURBO_STEP : AUTO_STEP;
const autoStepTxt = () => String(autoStepMs()/1000).replace(".", ",");   // "0,7" albo "0,25"

function switchAuto(caseId){
  if(!autoUnlocked()){
    sfxErr();
    toast("🤖 <b>Auto-otwieranie</b> — kup ulepszenie w zakładce 🚀","bad");
    switchView("up");
    return;
  }
  if(autoOpen && autoOpen.id === caseId){ autoStop("zatrzymane"); return; }   // ten sam przycisk = stop
  if(spinning){ sfxErr(); toast("Najpierw poczekaj na zakończenie otwarcia","bad"); return; }
  autoStop();                                                                // zmiana skrzynki
  const c = CASES.find(x=>x.id===caseId);
  if(!c) return;
  if(state.coins < c.price){ sfxErr(); toast("Za mało monet na auto-otwieranie","bad"); return; }
  autoOpen = {id:c.id, name:c.name, color:c.color, timer:null, n:0, spent:0, earned:0, free:0, best:null, feed:[]};
  const fe = $("#autoFeed"); if(fe) fe.innerHTML = "";      // nowy bieg = czysta lista dropów
  sfxWhoosh();
  renderAutoPanel(); renderShop();
  autoStep();
}

function autoStep(){
  if(!autoOpen) return;
  const c = CASES.find(x=>x.id===autoOpen.id);
  if(!c){ autoStop(); return; }
  const free = Math.random() < couponChance();
  if(!free && state.coins < c.price){ autoStop("skończyły się monety", true); return; }
  const win = doOpen(c, free);          // pełne otwarcie + natychmiastowy zapis dropu
  autoOpen.n++;
  if(free) autoOpen.free++;
  autoOpen.spent += free ? 0 : c.price;
  autoOpen.earned += win.value || 0;
  if(!autoOpen.best || win.value > autoOpen.best.value) autoOpen.best = win;
  autoOpen.feed.unshift(win);
  if(autoOpen.feed.length > AUTO_FEED) autoOpen.feed.length = AUTO_FEED;
  sfxTick();
  renderBalance();
  if(currentView === "inv") renderInv();      // odświeżamy tylko widoczne rzeczy
  if(currentView === "up") renderUp();
  renderAutoPanel();
  const lim = autoLimit();
  if(lim && autoOpen.n >= lim){ autoStop("osiągnięty limit "+lim+" otwarć"); return; }
  autoOpen.timer = setTimeout(autoStep, autoStepMs());
}

/* reason = dlaczego zatrzymano (puste = bez komunikatu), bad = pokaż na czerwono,
   quiet = nie pokazuj nic (np. przy resecie gry) */
function autoStop(reason, bad, quiet){
  if(!autoOpen) return;
  if(autoOpen.timer) clearTimeout(autoOpen.timer);
  const o = autoOpen;
  autoOpen = null;
  renderAutoPanel();
  renderShop();
  if(quiet) return;
  if(o.n){
    const best = o.best ? " · najlepszy: <b>"+esc(o.best.n)+"</b> 🪙 "+fmt(o.best.value) : "";
    const net = (o.earned||0) - o.spent;
    const netTxt = (net >= 0 ? "+🪙 " : "-🪙 ") + fmt(Math.abs(net));
    toast("🤖 Auto-otwieranie"+(reason?" ("+reason+")":"")+" — <b>"+o.n+"</b> "
      +plural(o.n,"otwarcie","otwarcia","otwarć")+" · wydane 🪙 "+fmt(o.spent)+" · bilans <b>"+netTxt+"</b>"
      +(o.free?" · 🎟️ "+o.free:"")+best+(autoTurboOn()?" · ⚡ turbo":""), bad?"bad":"good");
  } else if(reason){
    toast("🤖 Auto-otwieranie — "+reason, bad?"bad":"good");
  }
}

/* pojedynczy wpis na liście ostatnich dropów */
function afItemHTML(it){
  const f = fxOf(it);
  return '<span class="af-item'+(f?' fx':'')+'" data-uid="'+it.uid+'" style="--c:'+TIER[it.tier].color+(f?';--fx:'+f.color:'')+'">'+
    (f?'<span class="af-fx" title="'+f.name+' '+fxBoostTxt(f)+'">'+f.icon+'</span>':'')+
    '<span class="af-name">'+esc(it.w)+' · '+esc(it.n)+'</span>'+
    '<b>🪙 '+fmt(it.value)+'</b></span>';
}

/* Lista dropów dokładana od góry — istniejące wpisy nie animują się od nowa.
   Przy ⚡ turbo (4 otwarcia na sekundę) pełne przerysowanie migałoby. */
function renderAutoFeed(){
  const el = $("#autoFeed");
  if(!el || !autoOpen) return;
  const feed = autoOpen.feed;
  if(!el.children.length){ el.innerHTML = feed.map(afItemHTML).join(""); return; }
  const top = feed[0];
  if(top && el.firstElementChild && el.firstElementChild.dataset.uid !== top.uid){
    el.insertAdjacentHTML("afterbegin", afItemHTML(top));
    while(el.children.length > AUTO_FEED) el.lastElementChild.remove();
  }
}

function renderAutoPanel(){
  const p = $("#autoPanel");
  if(!p) return;
  /* ustawienia ⚡⏹ trzymamy w zgodzie z zapisem nawet wtedy, gdy panel jest schowany */
  const turbo = autoTurboOn(), lim = autoLimit();
  const tb = $("#autoTurbo");
  if(tb){
    tb.classList.toggle("on", turbo);
    tb.title = turbo ? "Tryb turbo WŁĄCZONY — ok. 4 otwarcia na sekundę (kliknij, żeby wyłączyć)"
                     : "Tryb turbo — ok. 4 otwarcia na sekundę zamiast 1 / "+autoStepTxt()+" s";
  }
  const lims = $("#autoLims");
  if(lims) Array.from(lims.children).forEach(b=>b.classList.toggle("on", (+b.dataset.lim|0) === lim));
  if(!autoOpen){ p.classList.remove("show"); return; }
  p.classList.add("show");
  p.style.setProperty("--ac", autoOpen.color || "#ffb02e");
  $("#autoTitle").innerHTML = '🤖 Auto: <b>'+esc(autoOpen.name)+'</b>'+(turbo ? ' <span class="ap-tb">⚡ turbo</span>' : '');
  const net = (autoOpen.earned||0) - autoOpen.spent;
  const netTxt = (net >= 0 ? "+🪙 " : "-🪙 ") + fmt(Math.abs(net));
  const netColor = net >= 0 ? "var(--ok)" : "var(--cov)";
  $("#autoRun").innerHTML =
    "<span>otwarć <b>"+autoOpen.n+(lim ? " / "+lim : "")+"</b></span>"+
    (lim ? "" : "<span>limit <b>∞</b></span>")+
    "<span>wydane <b>🪙 "+fmt(autoOpen.spent)+"</b></span>"+
    "<span>bilans <b style=\"color:"+netColor+"\">"+netTxt+"</b></span>"+
    (autoOpen.free ? "<span>🎟️ darmowe <b>"+autoOpen.free+"</b></span>" : "");
  const bar = $("#autoLimBar"), fill = $("#autoLimFill");
  if(bar){
    bar.classList.toggle("hide", !lim);
    if(lim && fill) fill.style.width = Math.min(100, 100*autoOpen.n/lim)+"%";
  }
  renderAutoFeed();
  $("#autoBest").innerHTML = autoOpen.best
    ? 'najlepszy drop: <b>'+esc(autoOpen.best.n)+'</b> — 🪙 '+fmt(autoOpen.best.value)
    : 'pierwsze otwarcie za chwilę…';
}
$("#autoStop").addEventListener("click", ()=>autoStop("zatrzymane"));

/* ⚡ tryb turbo — przyspiesza auto-otwieranie w trakcie biegu (zmiana działa od następnego otwarcia) */
$("#autoTurbo").addEventListener("click", ()=>{
  state.autoTurbo = !autoTurboOn();
  markDirty(); save();
  renderAutoPanel(); renderShop();
  sfxTick();
  toast(state.autoTurbo
    ? "⚡ <b>Tryb turbo</b> — ok. <b>4</b> otwarcia na sekundę"
    : "⚡ Tryb turbo wyłączony — 1 otwarcie / "+autoStepTxt()+" s", "good");
});

/* ⏹ limit otwarć — auto zatrzyma się samo po wybranej liczbie otwarć */
$("#autoLims").addEventListener("click", e=>{
  const b = e.target.closest("[data-lim]");
  if(!b) return;
  state.autoLimit = autoLimitSan(+b.dataset.lim);
  markDirty(); save();
  renderAutoPanel(); renderShop();
  if(!state.autoLimit){ toast("♾️ Auto-otwieranie <b>bez limitu</b> otwarć","good"); return; }
  toast("⏹ Auto-otwieranie zatrzyma się po <b>"+state.autoLimit+"</b> otwarciach","good");
  if(autoOpen && autoOpen.n >= state.autoLimit) autoStop("osiągnięty limit "+state.autoLimit+" otwarć");
});

/* =======================================================================
   10. KARTY / EKWIPUNEK
   ======================================================================= */
function noteDrop(item){
  item.ts = item.ts || Date.now();
  state.recent.unshift({w:item.w,n:item.n,tier:item.tier,value:item.value,uid:item.uid,ts:item.ts,fx:item.fx||null});
  state.recent = state.recent.slice(0,24);
  if(item.tier==="special"){ state.stats.knives++; missionTrack("knife",1); }
  if(item.tier==="relic"){ state.stats.relics = numFrom(state.stats.relics) + 1; }
  if(item.tier==="covert" || item.tier==="special") missionTrack("covert",1);
  if(item.fx){                                  // ✨ rzadki efekt — liczymy do statystyk
    const st = state.stats;
    st.fx = (st.fx && typeof st.fx === "object" && !Array.isArray(st.fx)) ? st.fx : {};
    st.fx[item.fx] = numFrom(st.fx[item.fx]) + 1;
    st.fxTotal = numFrom(st.fxTotal) + 1;
    missionTrack("fx", 1);                      // 📅 misje tygodniowe na efekty
    const fxDef = FX_BY_ID[item.fx] || EVENT_FX_BY_ID[item.fx];
    if(fxDef && fxDef.mult >= FX_BIG) missionTrack("fxbig", 1);
  }
  if(!state.stats.best || item.value>state.stats.best.value)
    state.stats.best = {w:item.w,n:item.n,tier:item.tier,value:item.value,fx:item.fx||null};
}

/* 🤡 Skrzynka Troll — monety zamiast przedmiotu. Jackpot trafia od razu na konto. */
function trollDrop(c){
  const chance  = typeof c.trollChance === "number" ? c.trollChance : TROLL_CHANCE;
  const jackpot = Math.random() < chance;
  const reward  = jackpot
    ? (typeof c.trollJackpot === "number" ? c.trollJackpot : TROLL_JACKPOT)
    : (typeof c.trollConsolation === "number" ? c.trollConsolation : TROLL_CONSOLATION);

  state.coins += reward;
  state.stats.earned = numFrom(state.stats.earned) + reward;
  state.stats.trollOpened = numFrom(state.stats.trollOpened) + 1;
  if(jackpot) state.stats.trollWins = numFrom(state.stats.trollWins) + 1;
  if(jackpot && (!state.stats.best || reward > state.stats.best.value))
    state.stats.best = {w:"🪙 "+fmt(reward), n:"Troll Jackpot", tier:"special", value:reward, fx:null};

  const win = {
    uid:"tr"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    w: jackpot ? "🪙 "+fmt(reward) : "🪙 1",
    n: jackpot ? "Troll Jackpot" : "Troll — 1 moneta",
    tier: jackpot ? "special" : "mil",
    caseId:c.id, value:reward, ts:Date.now(),
    trollCoins:reward, trollJackpot:jackpot
  };
  markDirty();
  save({kind:"drop"});       // jackpot / 1 moneta zapisane od razu
  checkAchievements();
  return win;
}

/* obsługa zdobytego przedmiotu: trafia do ekwipunku i jest od razu zapisany */
function obtainDrop(c, tier){
  const win = makeItem(c, tier);
  const clover = rollClover();     // 🍀 koniczyna losuje się niezależnie od przedmiotu
  addToInv(win);                   // zapis obejmie już też stan koniczyny
  if(clover) cloverHit();
  const code = rollCodeDrop();     // 🔑 bardzo rzadki bonus niezależny od dropu
  if(code) win.codeDrop = code;
  return win;
}

function addToInv(item){
  item.ts = item.ts || Date.now();
  state.inv.unshift(item);
  noteDrop(item);
  albumRegister(item);     // 📖 album kolekcji — zapisuje znalezisko na stałe
  markDirty();
  saveDrop(item);          // natychmiastowy, weryfikowany zapis dropu
  checkAchievements();     // 🏆 od razu odblokowuje osiągnięcia za rzadkie znaleziska
}

function itemCardHTML(item, extra){
  const t = TIER[item.tier];
  const h = hash(item.w+item.n+item.uid);
  const f = fxOf(item);
  const foil = (item.tier==="special"||item.tier==="covert"||item.tier==="relic") ? '<div class="art-foil"></div>' : "";
  return `<div class="item-card tier-${item.tier}${fxClass(item)} ${extra||""}" style="--c:${t.color}${f?";--fx:"+f.color:""}" data-uid="${item.uid}">
    ${foil}
    ${f?'<div class="fx-shine"></div>':""}
    ${item.tier==="special" ? '<span class="star">★</span>' : item.tier==="relic" ? '<span class="star relic-star">✦</span>' : ""}
    ${fxBadge(item)}
    <div class="item-art">${weaponSVG(item, h.toString(36))}</div>
    <div class="item-body">
      <div class="item-weapon">${esc(item.w)}</div>
      <div class="item-skin">${esc(item.n)}</div>
      <div class="item-foot">
        <span class="item-tier">${item.tier==="special"?"★ Special":item.tier==="relic"?"✦ Relikt":t.name}</span>
        <span class="item-price">🪙 ${fmtShort(item.value)}</span>
      </div>
    </div>
  </div>`;
}
function invCardHTML(item, i){
  const f = fxOf(item);
  return `<div class="item-card tier-${item.tier}${fxClass(item)}" style="--c:${TIER[item.tier].color}${f?";--fx:"+f.color:""};animation-delay:${Math.min(i*22,420)}ms" data-uid="${item.uid}">
    ${(item.tier==="special"||item.tier==="covert"||item.tier==="relic") ? '<div class="art-foil"></div>' : ""}
    ${f?'<div class="fx-shine"></div>':""}
    ${item.tier==="special" ? '<span class="star">★</span>' : item.tier==="relic" ? '<span class="star relic-star">✦</span>' : ""}
    ${fxBadge(item)}
    <div class="item-art">${weaponSVG(item, hash(item.uid).toString(36))}</div>
    <div class="item-body">
      <div class="item-weapon">${esc(item.w)}</div>
      <div class="item-skin">${esc(item.n)}</div>
      <div class="item-foot">
        <span class="item-tier">${item.tier==="special"?"★ Special":item.tier==="relic"?"✦ Relikt":TIER[item.tier].name}</span>
        <span class="item-price">🪙 ${fmtShort(item.value)}</span>
      </div>
    </div>
    <div class="sell-hint">SPRZEDAJ<b title="🪙 ${fmt(itemSell(item))}">🪙 ${fmtShort(itemSell(item))}</b></div>
  </div>`;
}

function renderInv(){
  const inv = state.inv;
  $("#invCount").textContent = inv.length;
  $("#invTotal").textContent = inv.length;
  /* Gdy ekwipunek jest schowany, nie budujemy setek kart w tle. */
  if(currentView !== "inv") return;
  $("#invValue").textContent = "🪙 " + fmtShort(inv.reduce((s,i)=>s+i.value,0));

  let list = inv.slice();
  const f = $("#invFilter").value;
  if(f!=="all") list = list.filter(i=>i.tier===f);
  const s = $("#invSort").value;
  if(s==="value") list.sort((a,b)=>b.value-a.value);
  else if(s==="rarity") list.sort((a,b)=>TIERS.indexOf(b.tier)-TIERS.indexOf(a.tier)||b.value-a.value);
  else list.sort((a,b)=>b.ts-a.ts);

  if(!list.length){
    $("#invGrid").innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="big">📦</span>
      ${inv.length ? "Brak przedmiotów w tym filtrze." : "Ekwipunek jest pusty.<br>Otwórz skrzynkę, żeby coś zdobyć!"}</div>`;
    return;
  }
  $("#invGrid").innerHTML = list.map(invCardHTML).join("");
}

function sellItem(uid){
  const idx = state.inv.findIndex(i=>i.uid===uid);
  if(idx<0) return;
  const it = state.inv[idx], price = itemSell(it);
  state.inv.splice(idx,1);
  state.coins += price; state.stats.earned += price; state.stats.sold++;
  missionTrack("sell",1);
  missionTrack("sellvalue", price);
  sfxCoin(); renderBalance(); renderInv(); renderShop(); save();
  toast("Sprzedano <b>"+esc(it.n)+"</b> za 🪙 "+fmt(price),"good");
}
$("#invGrid").addEventListener("click", e=>{
  const card = e.target.closest("[data-uid]");
  if(!card) return;
  const it = state.inv.find(i=>i.uid===card.dataset.uid);
  if(!it) return;
  if(it.value >= 50000){
    const prefix = it.tier==="special" ? "★ " : it.tier==="relic" ? "❖ " : "";
    if(!confirm("Sprzedać "+prefix+it.n+" ("+it.w+") za "+fmt(itemSell(it))+" monet?")) return;
  }
  sellItem(card.dataset.uid);
});
$("#invFilter").addEventListener("change", renderInv);
$("#invSort").addEventListener("change", renderInv);
$("#sellAll").addEventListener("click", ()=>{
  if(!state.inv.length){ toast("Ekwipunek jest pusty","bad"); return; }
  const gain = state.inv.reduce((s,i)=>s+itemSell(i),0);
  if(!confirm("Sprzedać WSZYSTKIE przedmioty ("+state.inv.length+") za 🪙 "+fmt(gain)+"?")) return;
  state.coins += gain; state.stats.earned += gain; state.stats.sold += state.inv.length;
  missionTrack("sell", state.inv.length);
  missionTrack("sellvalue", gain);
  state.inv = [];
  sfxCoin(); renderBalance(); renderInv(); renderShop(); save();
  toast("Sprzedano wszystko za 🪙 "+fmt(gain),"good");
});
$("#sellCheap").addEventListener("click", ()=>{
  const v = prompt("Sprzedaj wszystkie przedmioty o wartości poniżej (🪙):","500");
  if(v===null) return;
  const th = Number(String(v).replace(/[^\d.]/g,""));
  if(!th || th<=0) return;
  const toSell = state.inv.filter(i=>i.value<th);
  if(!toSell.length){ toast("Brak przedmiotów poniżej 🪙 "+fmt(th),"bad"); return; }
  const gain = toSell.reduce((s,i)=>s+itemSell(i),0);
  const ids = new Set(toSell.map(i=>i.uid));
  state.inv = state.inv.filter(i=>!ids.has(i.uid));
  state.coins += gain; state.stats.earned += gain; state.stats.sold += toSell.length;
  missionTrack("sell", toSell.length);
  missionTrack("sellvalue", gain);
  sfxCoin(); renderBalance(); renderInv(); renderShop(); save(); checkAchievements();
  toast("Sprzedano "+toSell.length+" szt. za 🪙 "+fmt(gain),"good");
});

/* =======================================================================
   11. WYNIK
   ======================================================================= */
function showResult(items, single){
  /* 🤡 Troll nie ma przedmiotów — monety są już na koncie, więc wynik
     pokazujemy jako karty z kwotą, bez przycisków sprzedaży. */
  if(items.length && items.every(i=>i.trollCoins)){
    const total = items.reduce((s,i)=>s+i.trollCoins,0);
    const jackpots = items.filter(i=>i.trollJackpot).length;
    const caseId = items[0].caseId;
    $("#resTitle").textContent = single ? "Skrzynka Troll" : "Skrzynka Troll ×"+items.length;
    $("#resBody").innerHTML = `
      <div class="${single?"":"troll-grid"}">${items.map(i=>`
        <div class="troll-result ${i.trollJackpot?"jackpot":""}">
          <div class="troll-coin">🪙</div>
          <div class="troll-amount">+${fmt(i.trollCoins)}</div>
          <div class="troll-label">${i.trollJackpot?"TROLL JACKPOT!":"TROLL — 1 MONETA"}</div>
        </div>`).join("")}</div>
      ${items.length>1?`<div class="result-meta muted">Łącznie: <b style="color:var(--acc)">🪙 ${fmt(total)}</b> · jackpoty: <b>${jackpots}</b></div>`:""}
      <div class="result-actions">
        <button class="btn gold" data-keep="1">Odbierz</button>
        <button class="btn primary" data-again="${caseId}" title="🪙 ${fmt(casePrice(caseId))}">Otwórz ponownie (🪙 ${fmtShort(casePrice(caseId))})</button>
      </div>`;
    $("#resultOverlay").classList.add("show");
    if(jackpots){
      sfxWin("special", null);
      confetti(["#fbbf24","#fff7d6","#a855f7","#ffffff"]);
      setTimeout(confetti, 280);
      setTimeout(confetti, 520);
      shakeScreen();
    } else {
      sfxWin("mil", null);
    }
    return;
  }
  const best = items.slice().sort((a,b)=>TIERS.indexOf(b.tier)-TIERS.indexOf(a.tier)||b.value-a.value)[0];
  const hasKnife = items.some(i=>i.tier==="special");
  const hasRelic = items.some(i=>i.tier==="relic");
  const ids = items.map(i=>i.uid);
  $("#resTitle").textContent = single ? "Zdobyty przedmiot" : "Wynik otwarcia ×"+items.length;

  if(single){
    const it = items[0];
    const big = it.tier==="special"||it.tier==="covert"||it.tier==="classified"||it.tier==="relic";
    const f = fxOf(it);
    const cdef = CASES.find(c=>c.id===it.caseId);
    const codeDrop = it.codeDrop || null;
    $("#resBody").innerHTML = `
      <div class="rare-banner ${(hasKnife||hasRelic)?"show":""}">${hasRelic?"✦ RELIKT ZNALEZIONY ✦":"★ RZADKI SPECJALNY DROP ★"}</div>
      <div class="result-stage" style="--c:${TIER[it.tier].color}">
        ${(big||f)?'<div class="rays"></div><div class="glowdisc"></div><div class="shockwave"></div>':''}
        <div class="result-glow">${itemCardHTML(it)}</div>
      </div>
      ${f?`<div class="result-fx${f.mult>=FX_BIG?" big":""}" style="--fx:${f.color}">${f.icon} ${f.name} efekt — ${fxBoostTxt(f)}</div>`:""}
      <div class="result-meta muted">Wartość: <b style="color:var(--acc);font-size:15px" title="🪙 ${fmt(it.value)}">🪙 ${fmtShort(it.value)}</b></div>
      ${codeDrop?`<div class="result-code">🔑 <b>DODATKOWY KOD!</b> ${codeDrop.icon} ${esc(codeDrop.name)} — nagroda 🪙 ${fmt(codeDrop.reward)}
        <span class="rc-code">${esc(codeDrop.code)}</span>
        <button class="btn" data-go-codes="1">Przejdź do kodów</button></div>`:""}
      <div class="result-actions">
        <button class="btn gold" data-sell-one="${it.uid}" title="🪙 ${fmt(itemSell(it))}">Sprzedaj za 🪙 ${fmtShort(itemSell(it))}</button>
        <button class="btn" data-keep="1">Zatrzymaj</button>
        ${cdef && cdef.botOnly
          ? `<span class="muted" style="font-size:12px;align-self:center">Tylko z bazaru botów — bez ponownego otwarcia za monety</span>`
          : `<button class="btn primary" data-again="${it.caseId}" title="🪙 ${fmt(casePrice(it.caseId))}">Otwórz ponownie (🪙 ${fmtShort(casePrice(it.caseId))})</button>`}
      </div>`;
  } else {
    const totalVal = items.reduce((s,i)=>s+i.value,0);
    const totalSell = items.reduce((s,i)=>s+itemSell(i),0);
    const fxs = items.filter(i=>i.fx);
    const codeDrops = items.map(i=>i.codeDrop).filter(Boolean);
    $("#resBody").innerHTML = `
      <div class="multi-grid">${items.map(i=>itemCardHTML(i)).join("")}</div>
      <div class="result-meta muted">Suma wartości: <b style="color:var(--acc)" title="🪙 ${fmt(totalVal)}">🪙 ${fmtShort(totalVal)}</b>
        &nbsp;·&nbsp; sprzedaż: <b style="color:var(--ok)" title="🪙 ${fmt(totalSell)}">🪙 ${fmtShort(totalSell)}</b>${fxs.length?" &nbsp;·&nbsp; ✨ "+fxs.map(i=>{const f=FX_BY_ID[i.fx]||EVENT_FX_BY_ID[i.fx];return f?f.icon:"";}).join(" "):""}</div>
      ${codeDrops.length?`<div class="result-code">🔑 <b>DODATKOWE KODY!</b> ${codeDrops.map(c=>c.icon+" "+esc(c.name)+" ("+esc(c.code)+")").join(" · ")}
        <button class="btn" data-go-codes="1">Przejdź do kodów</button></div>`:""}
      <div class="result-actions">
        <button class="btn gold" data-sell-many="${ids.join(",")}" title="🪙 ${fmt(totalSell)}">Sprzedaj wszystko (🪙 ${fmtShort(totalSell)})</button>
        <button class="btn" data-keep="1">Zatrzymaj</button>
      </div>`;
  }
  $("#resultOverlay").classList.add("show");
  const bf = fxOf(best);
  sfxWin(best.tier, bf ? bf.id : null);

  if(best.tier==="relic"){ confetti(["#fff7d6","#ffe9a8","#ffb02e","#ffffff"]); setTimeout(confetti,260); setTimeout(confetti,520); shakeScreen(); }
  else if(best.tier==="special"){ confetti(["#ffd700","#fff3b0","#ffb02e","#ffffff"]); setTimeout(confetti,320); shakeScreen(); }
  else if(best.tier==="covert"){ confetti(["#eb4b4b","#ff9a9a","#ffd700","#ffffff"]); shakeScreen(); }
  else if(best.tier==="classified"){ confetti([TIER.classified.color,"#ffffff","#c77dff"]); }
  else if(best.tier==="restricted" && single){ burst(window.innerWidth/2, window.innerHeight*0.42, TIER.restricted.color); }

  if(bf){                                    // ✨ rzadki efekt — własna feta
    setTimeout(()=>confetti([bf.color,"#ffffff",bf.color]), 120);
    if(bf.mult >= FX_BIG){ setTimeout(confetti, 380); setTimeout(confetti, 640); shakeScreen(); }
  }
  if(items.some(i=>i.codeDrop)){             // 🔑 kod to dodatkowa, bardzo rzadka feta
    setTimeout(()=>confetti(["#a855f7","#ffd76a","#ffffff"]), 180);
    setTimeout(()=>confetti(["#22d3ee","#a855f7","#f43f5e"]), 430);
  }
}

function shakeScreen(){
  const p = $("#resultPanel");
  p.classList.remove("shake"); void p.offsetWidth; p.classList.add("shake");
}

$("#resBody").addEventListener("click", e=>{
  const one = e.target.closest("[data-sell-one]");
  const many = e.target.closest("[data-sell-many]");
  const keep = e.target.closest("[data-keep]");
  const again = e.target.closest("[data-again]");
  const goCodes = e.target.closest("[data-go-codes]");
  if(goCodes){ $("#resultOverlay").classList.remove("show"); switchView("codes"); return; }
  if(one){ sellItem(one.dataset.sellOne); $("#resultOverlay").classList.remove("show"); renderShop(); renderInv(); }
  if(many){
    const ids = many.dataset.sellMany.split(",");
    let gain = 0, n = 0;
    ids.forEach(uid=>{ const i = state.inv.findIndex(x=>x.uid===uid);
      if(i>=0){ gain += itemSell(state.inv[i]); state.inv.splice(i,1); n++; } });
    state.coins += gain; state.stats.earned += gain; state.stats.sold += n;
    missionTrack("sell", n);
    missionTrack("sellvalue", gain);
    sfxCoin(); renderBalance(); renderShop(); renderInv(); save();
    $("#resultOverlay").classList.remove("show");
    toast("Sprzedano "+n+" przedmiotów za 🪙 "+fmt(gain),"good");
  }
  if(keep){ $("#resultOverlay").classList.remove("show"); renderShop(); renderInv(); }
  if(again){ $("#resultOverlay").classList.remove("show"); openCase(again.dataset.again); }
});
$("#resClose").addEventListener("click", ()=>{ $("#resultOverlay").classList.remove("show"); renderShop(); renderInv(); });