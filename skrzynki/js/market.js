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
    return `<span data-tier="troll" data-mark="T" style="--tc:#fbbf24;color:#fbbf24"><i class="dot dot-troll" style="background:#fbbf24"></i>
        <span style="color:var(--dim)">🪙 ${fmtShort(c.trollJackpot||TROLL_JACKPOT)} ${p.toFixed(2)}%</span></span>
      <span data-tier="troll" data-mark="T" style="--tc:#94a3b8;color:#94a3b8"><i class="dot dot-troll" style="background:#94a3b8"></i>
        <span style="color:var(--dim)">🪙 ${fmt(c.trollConsolation||TROLL_CONSOLATION)} ${(100-p).toFixed(2)}%</span></span>`;
  }
  const o = oddsFor(c);
  return TIERS.map(t=>{
    const p = (o[t]||0)*100;
    if(p<=0) return "";
    const nm = t==="special" ? "★ Noże" : t==="gloves" ? "🧤 Rękawice" : t==="relic" ? "✦ Relikty" : TIER[t].name;
    return `<span data-tier="${t}" data-mark="${TIER_MARK[t]||t[0].toUpperCase()}" style="--tc:${TIER[t].color};color:${TIER[t].color}"><i class="dot dot-${t}" style="background:${TIER[t].color}"></i>
      <span style="color:var(--dim)">${nm} ${p<0.01 && p>0 ? "1 na "+fmt(Math.round(100/p)) : p<0.1 ? p.toFixed(2)+"%" : p.toFixed(1)+"%"}</span></span>`;
  }).join("");
}
/* Ranga skrzynki liczona z ceny — nowe skrzynki od razu dostają właściwą oprawę.
   Każda skrzynka ma też własną skórkę: data-skin="<id>" (CSS niżej w <style>). */
const TIER_NAME = {common:"Zwykła", rare:"Rzadka", epic:"Epicka", legendary:"Legendarna"};
const TIER_MARK = {mil:"M", restricted:"R", classified:"C", covert:"V", special:"★", gloves:"G", relic:"✦"};
function caseTier(c){
  if(c.price >= 700000) return "legendary";
  if(c.price >=   50000) return "epic";
  if(c.price >=    3000) return "rare";
  return "common";
}
/* Skrzynki z własnym, ręcznie napisanym wyglądem w CSS — nie ruszamy ich.
   Pozostałe dostają jeden z 16 wzorów „dodatków” na tej samej, kwadratowej
   bryle: nity, obwody, runy, paski, gwiazdy, iskry, skanery itd. Bryła
   zostaje klasyczna — zmienia się tylko detail i faktura. */
const CUSTOM_CASE_SKINS = new Set([
  "start","sand","urban","midnight","prism","spectral","toxic","chroma","frost","dragon","void","volcano","royal","celestial","abyss",
  "smuggler","gambler","quad","quint","sext","sept","oct","non","quantum","eternity","singularity","aurora","nebula","vortex","titan","eclipse"
]);
function caseVisualClass(c){
  /* Trolle (i inne skrzynki bez puli broni) mają własny, czysty wygląd —
     nakładanie na nie „dodatków” zasłaniało emotkę i wyglądało kiepsko. */
  if(c.troll || c.noItems || c.suitcase || c.eventOnly) return "";
  if(CUSTOM_CASE_SKINS.has(c.id)) return "";
  return "deco-"+(1 + (hash("caseDeco|"+c.id) % 16));
}
/* kratka ozdób: 5 miejsc w warstwie za skrzynką i 5 przed nią */
const DEKO = n => `<i></i>`.repeat(n);

let lastShopSig = "";
const SHOP_FILTERS = [
  {id:"all",     label:"Wszystkie", icon:"🗃️"},
  {id:"normal",  label:"Zwykłe",    icon:"📦"},
  {id:"troll",   label:"Troll",     icon:"🤡"},
  {id:"special", label:"Specjalne", icon:"✨"},
  {id:"event",   label:"Eventowe",  icon:"🎟️"},
  {id:"bot",     label:"Boty",      icon:"🤖"}
];
let shopFilter = "all";

/* ⚡ Hurtowe otwieranie: ×10 / ×100 / ×1000 / ×10000 / MAX.
   Przycisk ×10000 ma twardy limit zapisu. MAX wydaje CAŁĄ kasę (i zapas) —
   gdy przekracza bezpieczny limit, nadwyżka dropów jest automatycznie
   sprzedawana, a w ekwipunku zostaje tylko BULK_KEEP najlepszych sztuk. */
const BULK_HARD_CAP = 10000;
const BULK_KEEP = 10000;         // ile najlepszych skinów zostaje przy MAX > 10k
const BULK_MAX_SAFE = 1000000;   // twardy sufit dla ekstremalnych kont (stabilność)
const BULK_STREAM_CHUNK = 5000;
const BULK_COUNTS = [10, 100, 1000, 10000, "max"];
const BULK_RESULT_CARDS = 24;
function bulkUnit(c){ return Math.max(1, Math.round(c.price * (1 - bulkRate()))); }
function bulkCost(c, n){
  if(c.botOnly) return 0;
  const useStock = Math.min(caseStock(c.id), Math.max(0, n|0));
  return bulkUnit(c) * Math.max(0, (n|0) - useStock);
}
function bulkMaxFor(c){
  const stock = caseStock(c.id);
  if(c.botOnly) return stock;
  return stock + Math.min(BULK_MAX_SAFE, Math.floor(numFrom(state.coins) / bulkUnit(c)));
}
function bulkLabel(n){ return n === "max" ? "MAX" : "×"+n; }
function bulkTitle(c, n){
  const stock = caseStock(c.id);
  if(n === "max"){
    const maxN = bulkMaxFor(c);
    if(maxN <= 0) return "Brak monet lub zapasu";
    const cost = bulkCost(c, maxN);
    return "MAX — cała kasa: "+fmt(maxN)+" skrzynek"+(cost ? " · 🪙 "+fmt(cost)+" łącznie" : " · z zapasu, bez opłat")
      + (maxN > BULK_HARD_CAP ? " · najlepsze "+fmt(BULK_KEEP)+" zostają, reszta auto-sprzedaż" : " · wszystkie dropy trafiają do ekwipunku");
  }
  const actual = c.botOnly ? Math.min(n, stock) : n;
  if(actual <= 0) return "Brak zapasu";
  if(c.botOnly){
    if(n > stock) return "Masz tylko "+stock+" w zapasie — użyj MAX";
    return "Otwórz "+actual+" z zapasu — bez opłat";
  }
  if(stock >= n) return "Otwórz "+n+" z zapasu — bez opłat";
  const cost = bulkCost(c, n);
  return "Otwórz "+n+" skrzynek"+(cost ? " (🪙 "+fmt(cost)+" łącznie)" : " — bez opłat");
}
function bulkButtonsHTML(c){
  if(c.eventOnly) return "";      // limitowaną skrzynkę otwieramy pojedynczo
  const stock = caseStock(c.id);
  return BULK_COUNTS.map(n=>{
    const maxN = n === "max" ? bulkMaxFor(c) : n;
    const actual = c.botOnly && n !== "max" ? Math.min(n, stock) : maxN;
    const can = c.botOnly
      ? actual > 0 && (n === "max" || n <= stock)
      : actual > 0 && state.coins >= bulkCost(c, n === "max" ? maxN : n);
    return `<button class="btn ghost bulk-btn${n==="max"?" max":""}" data-open-bulk="${c.id}" data-bulk="${n}" title="${esc(bulkTitle(c,n))}" ${can?"":"disabled"}>${bulkLabel(n)}</button>`;
  }).join("");
}

function shopCategory(c){
  if(c.troll) return "troll";
  if(c.eventOnly) return "event";
  if(c.botOnly) return "bot";
  if(c.mega || c.elite || c.ultra || c.secret) return "special";
  return "normal";
}
function shopFilterCounts(shopCases){
  const counts = {all:shopCases.length, normal:0, troll:0, special:0, event:0, bot:0};
  shopCases.forEach(c=>{ counts[shopCategory(c)]++; });
  return counts;
}
function renderShopFilters(shopCases){
  const wrap = $("#caseFilters");
  if(!wrap) return;
  const counts = shopFilterCounts(shopCases);
  wrap.innerHTML = SHOP_FILTERS.map(f=>{
    const n = counts[f.id] || 0;
    return `<button type="button" class="shop-filter${shopFilter===f.id?" active":""}${f.id==="troll"?" troll":""}" data-shop-filter="${f.id}" aria-pressed="${shopFilter===f.id}">
      <span class="sf-ico">${f.icon}</span><span>${f.label}</span><span class="sf-count">${n}</span>
    </button>`;
  }).join("");
}
function shopHintHTML(){
  const cheapest = Math.min(...CASES.filter(c=>!c.botOnly && !c.eventOnly).map(c=>c.price));
  const lk = upLvl("luck");
  const active = [];
  if(lk) active.push("🎯 Szczęście "+lk+"/"+UP_BY_ID.luck.max);
  const kn = upLvl("knives");
  if(kn) active.push("🔪 Łowca Noży "+kn+"/"+UP_BY_ID.knives.max);
  if(cloverActive()) active.push("🍀 Koniczyna "+hms(cloverLeft())+" — "+cloverDesc());
  const fxEv = fxEventPool().filter(f=>fxEventActive(f.id));
  if(fxEv.length) active.push("🎰 Eventy efektów: "+fxEv.map(f=>f.icon+" "+mmss(Math.max(0,numFrom(state.fxEvents[f.id])-Date.now()))).join(" · ")+" — +"+Math.round(FX_EVENT_LUCK*fxEv.length*100)+"% luck");
  if(autoOpen) active.push("🤖 Auto: "+esc(autoOpen.name)+" — "+autoOpen.n+" "+plural(autoOpen.n,"otwarcie","otwarcia","otwarć"));
  const stockN = CASES.reduce((a,c)=>a+caseStock(c.id),0);
  const evStockN = EVENT_CASES.reduce((a,c)=>a+caseStock(c.id),0);
  return [
    state.coins < cheapest ? "Brakuje monet — użyj przycisku 🎁 Bonus" : "★ Noże są rzadsze, ale warte więcej",
    stockN ? "📦 W zapasie: <b>"+fmt(stockN)+"</b> "+plural(stockN,"skrzynka","skrzynki","skrzynek")+" (bazar botów / eventy)" : "🤖 "+BOT_CASES.length+" "+plural(BOT_CASES.length,"skrzynka","skrzynki","skrzynek")+" tylko u botów — zakładka Bazar botów",
    evStockN ? "🎟️ Limitowane skrzynki eventowe: <b>"+fmt(evStockN)+"</b> — pierwsze otwarcie gwarantuje nową broń" : "",
    "🕶️ Skrzynki botów są jednorazowe — po otwarciu nie wracają za monety.",
    "🧳 Walizki z rękawicami i ostrzami tylko u botów — im wyższa reputacja, tym większa szansa na ofertę.",
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
    card.querySelectorAll("[data-open-bulk]").forEach(b=>{
      const raw = b.dataset.bulk;
      const stockNow = caseStock(c.id);
      const n = raw === "max" ? bulkMaxFor(c) : +raw;
      const actual = c.botOnly && raw !== "max" ? Math.min(n, stockNow) : n;
      b.disabled = c.botOnly
        ? !(actual > 0 && (raw === "max" || +raw <= stockNow))
        : !(actual > 0 && state.coins >= bulkCost(c, raw === "max" ? n : +raw));
      b.title = bulkTitle(c, raw);
    });
  });
}
function shopSignature(shopCases){
  return shopCases.map(c=>c.id+":"+(caseStock(c.id)>0?1:0)).join("|")
    + "|" + UPGRADES.map(u=>upLvl(u.id)).join(",")
    + "|" + (cloverActive() ? 1 : 0)
    + "|" + (autoOpen ? autoOpen.id : "")
    + "|" + shopFilter;
}
function renderShop(force){
  renderCaseBadge();
  /* skrzynki tylko z bazaru botów pokazujemy dopiero, gdy masz je w zapasie —
     inaczej nie byłoby jak ich otworzyć (nie ma ich w zwykłej sprzedaży) */
  const grid = $("#caseGrid");
  if(!grid) return;
  /* Walizki z bazaru trzymamy w Ekwipunku — nie dublujemy ich w Skrzynkach. */
  const allShopCases = CASES.filter(c=>(!c.botOnly && !c.eventOnly) || (!c.suitcase && caseStock(c.id)>0));
  const sig = shopSignature(allShopCases);
  $("#shopHint").innerHTML = shopHintHTML();

  /* Najważniejsza optymalizacja: zmiana samych monet nie przerysowuje wszystkich kart.
     Dzięki temu po otwarciu skrzynki nie odtwarza się animacja wejścia. */
  if(!force && lastShopSig === sig && grid.children.length){
    syncShopButtons();
    if(currentView === "battle") renderBattle();
    return;
  }
  lastShopSig = sig;
  renderShopFilters(allShopCases);

  const shopCases = shopFilter === "all"
    ? allShopCases
    : allShopCases.filter(c=>shopCategory(c) === shopFilter);

  if(!shopCases.length){
    grid.innerHTML = `<div class="shop-empty">
      <b>Brak skrzynek w tej kategorii.</b>
      <span>${shopFilter === "bot"
        ? "Skrzynki botów pojawiają się tutaj tylko wtedy, gdy masz je w zapasie — kup je w Bazarze botów."
        : shopFilter === "event"
        ? "Limitowane skrzynki eventowe pojawiają się tutaj, gdy odbierzesz je z aktywnego eventu w zakładce Eventy."
        : "Zmień kategorię, żeby zobaczyć inne skrzynki."}</span>
    </div>`;
    grid.classList.add("ready");
    syncShopButtons();
    if(currentView === "battle") renderBattle();
    return;
  }

  grid.innerHTML = shopCases.map((c,i)=>{
    const can = state.coins>=c.price;
    const tier = caseTier(c);
    const st = caseStock(c.id);
    const aOn = !!autoOpen && autoOpen.id===c.id, aUnl = autoUnlocked();
    return `<div class="case-card tier-${tier}${c.mega?" mega":""}${c.elite?" elite":""}${c.ultra?" ultra":""}${c.eventOnly?" event":""} ${caseVisualClass(c)}" data-skin="${c.id}" style="--cc:${c.color};animation-delay:${i*70}ms" data-case="${c.id}" tabindex="0" role="group" aria-label="${esc(c.name)} — Enter otwiera">
      <span class="case-tag">${c.troll ? "TROLL · JACKPOT" : c.eventOnly ? "EVENT · LIMITOWANA" : c.suitcase ? "🧳 WALIZKA · RZADKA" : c.cosmic ? "COSMIC · "+TIER_NAME[tier] : c.ultra ? "ULTRA · "+TIER_NAME[tier] : c.mega ? "MEGA · "+TIER_NAME[tier] : c.elite ? "ELITA · "+TIER_NAME[tier] : c.botOnly ? "Tylko u botów" : TIER_NAME[tier]}</span>
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
        <span class="price" title="${c.eventOnly ? "Limitowana skrzynka eventowa" : "🪙 "+fmt(c.price)}">${c.eventOnly ? "🎟️ event" : "🪙 "+fmtShort(c.price)}</span>
        <span class="price-target">${c.eventOnly ? "pierwsze otwarcie: nowa broń" : c.troll ? "🤡 jackpot 🪙 "+fmtShort(c.trollJackpot||TROLL_JACKPOT) : "★ nóż ~ "+fmtShort(itemValue(c,"special","Karambit|Fala"))}</span>
      </div>
      <div class="btn-row">
        ${st?`<button class="btn gold open-btn" style="flex:1 1 100%" data-stockopen="${c.id}">📦 Otwórz z zapasu (${st})</button>`:""}
        ${(c.botOnly || c.eventOnly) ? "" : `<button class="btn primary open-btn" data-open="${c.id}" ${can?"":"disabled"}>${c.troll?"🤡 Zaryzykuj":"Otwórz"}</button>`}
        ${c.eventOnly ? "" : `<div class="bulk-row">${bulkButtonsHTML(c)}</div>`}
        <button class="btn ghost loot-btn" data-loot="${c.id}" title="Zobacz wszystkie bronie w tej skrzynce">📋 Zawartość</button>
        ${(c.botOnly || c.eventOnly) ? "" : `<button class="btn ghost auto-btn${aOn?" on":""}${aUnl?"":" locked"}" data-auto="${c.id}"
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
  const ob = e.target.closest("[data-open-bulk]");
  const au = e.target.closest("[data-auto]");
  if(so) openCase(so.dataset.stockopen, so.closest(".case-card"), true);
  if(o1) openCase(o1.dataset.open, o1.closest(".case-card"));
  if(ob) openMany(ob.dataset.openBulk, ob.dataset.bulk === "max" ? "max" : +ob.dataset.bulk);
  if(au) switchAuto(au.dataset.auto);
});
const caseFiltersEl = $("#caseFilters");
if(caseFiltersEl){
  caseFiltersEl.addEventListener("click", e=>{
    const btn = e.target.closest("[data-shop-filter]");
    if(!btn) return;
    const next = btn.dataset.shopFilter;
    if(next === shopFilter || !SHOP_FILTERS.some(f=>f.id===next)) return;
    shopFilter = next;
    renderShop(true);
    if(typeof writeUiPrefs === "function") writeUiPrefs();
  });
}

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
  $("#lootTag").innerHTML = c.eventOnly
    ? "🎟️ limitowana &nbsp;·&nbsp; "+total+" "+plural(total,"broń","broni","broni")
    : c.suitcase
    ? "🧳 rzadka walizka &nbsp;·&nbsp; "+total+" "+plural(total,"pozycja","pozycje","pozycji")
    : "🪙 "+fmtShort(c.price)+" &nbsp;·&nbsp; "+total+" "+plural(total,"broń","broni","broni");
  $("#lootBody").innerHTML =
    (c.eventOnly ? `<div class="loot-bonus lb-fx"><i class="lb-ico">🎟️</i><span class="lb-txt">
      <b>Limitowana skrzynka eventowa</b>
      Pierwsze otwarcie gwarantuje <b>nową broń</b> z puli eventowej, której nie masz w ekwipunku.
      Kolejne otwarcia działają na zwykłych szansach. Skrzynka zostaje w zapasie po evencie.
    </span></div>` : "") +
    `<div class="loot-bonus"><i class="lb-ico">🍀</i><span class="lb-txt">
      <b>Czterolistna koniczyna — szansa ${(CLOVER_CHANCE*100).toFixed(1)}%</b>
      Wypada <em>dodatkowo</em> przy otwarciu skrzynki (także hurtowo) i na ${hms(cloverDur())}
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
    return `<div class="loot-sec" style="--c:${TIER[t].color}" data-tier="${t}" data-mark="${TIER_MARK[t]||t[0].toUpperCase()}">
      <div class="loot-sec-h"><i></i>${t==="special"?"★ Noże":t==="gloves"?"🧤 Rękawice":t==="relic"?"✦ Relikty":TIER[t].name}
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
  {id:"gizmo", icon:"🤖", name:"Gizmo_2200", tag:"złom i okazje",  line:"„Wszystko legalne. Prawie.”",
   story:"Zbudowany z części, które miały trafić na złom. Zna każdy magazyn w mieście i wie, co zginęło z każdego z nich."},
  {id:"vince", icon:"🕶️", name:"Vince",       tag:"przemytnik",     line:"„Nie pytaj, skąd to mam.”",
   story:"Przemytnik z północnego portu. Nie pyta, skąd masz monety — liczy się tylko, czy starczy."},
  {id:"mech",  icon:"🦾", name:"M3CH-9",      tag:"hurt i detal",   line:"„Cena się zmienia. Jak wszystko.”",
   story:"Stary robot hurtowy, który przelicza wszystko w ułamkach sekundy. Lubi porządek i duże zamówienia."},
  {id:"lena",  icon:"🎲", name:"LuckyLena",   tag:"hazardzistka",   line:"„Raz na jakiś czas trafia się perełka.”",
   story:"Hazardzistka, która zawsze twierdzi, że ma system. Jej kontrakty są szybkie, ryzykowne i dziwnie opłacalne."}
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
/* 🧳 Walizki są rzadkie — szansa rośnie z poziomem reputacji u danego bota. */
const BOT_SUITCASE_CHANCE = [0.025, 0.04, 0.06, 0.09, 0.13, 0.18];
const BOT_SUITCASE_WEIGHT = { suit_gloves:26, suit_blades:28, suit_relics:16, suit_kos:14, suit_collector:9, suit_neon:7 };
/* 💎 Diamantowa oferta — gwarantowana rzadka walizka za diamenty + monety.
   Pojawia się rzadko i nie zależy od reputacji (diamenty są walutą sezonową). */
const BOT_DIAMOND_CHANCE = [0.02, 0.025, 0.03, 0.035, 0.04, 0.05];
const BOT_DIAMOND_SUITCASES = { suit_relics:8, suit_kos:10, suit_collector:12 };
const BOT_DIAMOND_COIN_MULT = 0.5;
const BOT_DIAMOND_LIMIT = 2;   // max 2 zakupy na sezon
const BOT_CACHE = {tag:"", list:[]};
/* Reputacja u każdego bota rośnie za zakupy. Kolejne poziomy dają rabat. */
const BOT_REP_TIERS = [
  {need:0,  name:"Nowy",         pct:0},
  {need:2,  name:"Znajomy",      pct:2},
  {need:5,  name:"Stały klient", pct:4},
  {need:9,  name:"Zaufany",      pct:6},
  {need:14, name:"Partner",      pct:8},
  {need:20, name:"Legenda",      pct:10}
];

/* 🤝 KONTRAKTY BOTÓW — krótkie historie i zlecenia odblokowywane reputacją.
   Nagrody to monety, punkty reputacji i unikalne skrzynki botów. */
const BOT_CONTRACTS = {
  gizmo: [
    {id:"gizmo_1", rep:0, icon:"📦", name:"Porządek w magazynie", desc:"Otwórz 10 skrzynek — Gizmo sprawdza, czy magazyn się zgadza.", on:"open", target:10, reward:{coins:25000, rep:1, caseId:"smuggler"}},
    {id:"gizmo_2", rep:2, icon:"💰", name:"Czysty interes", desc:"Sprzedaj 30 przedmiotów. Gizmo nie znosi zalegającego złomu.", on:"sell", target:30, reward:{coins:150000, rep:1, caseId:"sticker"}},
    {id:"gizmo_3", rep:4, icon:"★", name:"Ostrze dla Handlarza", desc:"Zdobądź nóż. Gizmo ma na niego klienta.", on:"knife", target:1, reward:{coins:500000, rep:2, caseId:"reaper"}}
  ],
  vince: [
    {id:"vince_1", rep:0, icon:"🤝", name:"Pierwsza dostawa", desc:"Kup 3 oferty u Vince'a. Zaufanie buduje się transakcjami.", on:"bot_buy", target:3, filter:d=>d && d.seller==="vince", reward:{coins:50000, rep:1, caseId:"smuggler"}},
    {id:"vince_2", rep:2, icon:"💸", name:"Duży obrót", desc:"Wydaj 500 000 monet. Vince lubi, gdy pieniądze krążą.", on:"spend", target:500000, reward:{coins:300000, rep:1, caseId:"gambler"}},
    {id:"vince_3", rep:4, icon:"★", name:"Dwa ostrza", desc:"Zdobądź 2 noże. Vince znajdzie na nie kupca.", on:"knife", target:2, reward:{coins:1000000, rep:2, caseId:"reaper"}}
  ],
  mech: [
    {id:"mech_1", rep:0, icon:"🧩", name:"Kalibracja", desc:"Kup 2 poziomy ulepszeń. M3CH-9 mierzy każdy parametr.", on:"upgrade", target:2, reward:{coins:40000, rep:1, caseId:"sticker"}},
    {id:"mech_2", rep:2, icon:"📦", name:"Hurtowa partia", desc:"Otwórz 25 skrzynek. Robot liczy każdą sztukę.", on:"open", target:25, reward:{coins:200000, rep:1, caseId:"smuggler"}},
    {id:"mech_3", rep:4, icon:"🦾", name:"Stalowy kontrakt", desc:"Kup 10 ofert u M3CH-9. Tylko duże zamówienia.", on:"bot_buy", target:10, filter:d=>d && d.seller==="mech", reward:{coins:750000, rep:2, caseId:"gambler"}}
  ],
  lena: [
    {id:"lena_1", rep:0, icon:"🪙", name:"Szczęśliwy rzut", desc:"Wygraj coinflipa. Lena chce zobaczyć, czy masz szczęście.", on:"coinflip_win", target:1, reward:{coins:30000, rep:1, caseId:"gambler"}},
    {id:"lena_2", rep:2, icon:"🎰", name:"Wysoka stawka", desc:"Wygraj 100 000 monet w kasynie. Lena kocha wysokie stawki.", on:"casino_win", target:100000, reward:{coins:250000, rep:1, caseId:"sticker"}},
    {id:"lena_3", rep:4, icon:"🎲", name:"Trzy trafienia", desc:"Wygraj 3 razy w kościach. Lena twierdzi, że to jej system.", on:"dice_win", target:3, reward:{coins:500000, rep:2, caseId:"reaper"}}
  ]
};
function botContractState(seller){
  if(!state.botContracts || typeof state.botContracts !== "object" || Array.isArray(state.botContracts)) state.botContracts = {};
  if(!state.botContracts[seller] || typeof state.botContracts[seller] !== "object"){
    state.botContracts[seller] = { idx:0, prog:0 };
  }
  const st = state.botContracts[seller];
  st.idx = Math.max(0, numFrom(st.idx));
  st.prog = Math.max(0, numFrom(st.prog));
  return st;
}
function botContractInfo(seller){
  const list = BOT_CONTRACTS[seller] || [];
  const st = botContractState(seller);
  const idx = Math.min(st.idx, list.length);
  const c = list[idx] || null;
  const rep = botRepInfo(seller);
  if(!c) return { list, idx, c:null, prog:0, target:0, done:true, locked:false, rep, allDone:true };
  const target = Math.max(1, numFrom(c.target));
  const prog = Math.min(target, st.prog);
  const locked = rep.level < (c.rep || 0);
  return { list, idx, c, prog, target, done:prog >= target, locked, rep, allDone:false };
}
function botContractRewardText(c){
  if(!c || !c.reward) return "";
  const parts = [];
  if(c.reward.coins) parts.push("🪙 "+fmtShort(c.reward.coins));
  if(c.reward.rep) parts.push("🤝 +"+c.reward.rep);
  if(c.reward.caseId){
    const box = CASES.find(x=>x.id===c.reward.caseId);
    if(box) parts.push("📦 "+box.name);
  }
  return parts.join(" · ");
}
function botContractHTML(seller){
  const info = botContractInfo(seller);
  if(!info.c){
    return `<div class="bot-contract all-done"><div class="bc-head"><span class="bc-ico">🤝</span><b>Kontrakty</b><span class="bc-rep">✔ ukończone</span></div>
      <div class="bc-desc">Wszystkie kontrakty tego bota są ukończone. Została tylko reputacja i oferty.</div></div>`;
  }
  const c = info.c;
  const repNeed = BOT_REP_TIERS[c.rep || 0] || BOT_REP_TIERS[0];
  const pct = Math.round(100 * info.prog / info.target);
  return `<div class="bot-contract ${info.locked?"locked":""} ${info.done?"done":""}">
    <div class="bc-head"><span class="bc-ico">${c.icon || "🤝"}</span><b>Kontrakt</b><span class="bc-rep">${info.locked ? "🔒 "+repNeed.name : "🤝 "+info.rep.name}</span></div>
    <div class="bc-name">${esc(c.name)}</div>
    <div class="bc-desc">${esc(c.desc)}</div>
    <div class="bc-bar"><i style="width:${info.locked?0:pct}%"></i></div>
    <div class="bc-foot"><span>${info.locked ? "wymaga reputacji: "+repNeed.name : info.prog+" / "+info.target}</span><span>${botContractRewardText(c)}</span></div>
    ${info.done ? `<button class="btn primary bc-claim" data-botcontract="${seller}">Odbierz nagrodę</button>` : ""}
  </div>`;
}
function botContractTrack(ev, n, data){
  if(!n || n <= 0) return;
  let changed = false;
  BOT_SELLERS.forEach(s=>{
    const info = botContractInfo(s.id);
    if(!info.c || info.locked || info.done) return;
    const c = info.c;
    if(c.on !== ev) return;
    if(typeof c.filter === "function" && !c.filter(data || {})) return;
    const st = botContractState(s.id);
    const before = st.prog;
    st.prog = Math.min(info.target, st.prog + n);
    if(st.prog !== before){
      changed = true;
      if(before < info.target && st.prog >= info.target && typeof toast === "function"){
        setTimeout(()=>toast("🤝 <b>"+esc(s.name)+"</b> — kontrakt gotowy: <b>"+esc(c.name)+"</b>. Odbierz nagrodę w Bazarze botów.","good"), 300);
      }
    }
  });
  if(changed){
    markDirty();
    if(typeof currentView !== "undefined" && currentView === "bots" && typeof renderBots === "function") renderBots();
    if(typeof save === "function") save({ kind:"bot_contract" });
  }
}
function botContractClaim(seller){
  const info = botContractInfo(seller);
  if(!info.c || info.locked || !info.done){ sfxErr(); return; }
  const c = info.c, r = c.reward || {};
  if(r.coins){ state.coins += numFrom(r.coins); state.stats.earned = numFrom(state.stats.earned) + numFrom(r.coins); }
  if(r.rep && typeof botAddRep === "function") botAddRep(seller, numFrom(r.rep));
  if(r.caseId){
    state.caseStock = (state.caseStock && typeof state.caseStock === "object" && !Array.isArray(state.caseStock)) ? state.caseStock : {};
    state.caseStock[r.caseId] = numFrom(state.caseStock[r.caseId]) + 1;
  }
  const st = botContractState(seller);
  st.idx = info.idx + 1;
  st.prog = 0;
  markDirty(); save();
  renderBalance(); renderBots(); renderShop(); renderInv(); renderStats();
  sfxWin("special");
  confetti(["#38e08a", "#ffd700", "#4b9bff"]);
  const sellerName = (BOT_SELLERS.find(s=>s.id===seller)||{}).name || "Bot";
  const box = r.caseId ? CASES.find(x=>x.id===r.caseId) : null;
  toast("🤝 <b>Kontrakt ukończony!</b> "+esc(sellerName)+" wypłaca: "+botContractRewardText(c)+(box?" — skrzynka czeka w zapasie":""),"good");
}
function botRepPoints(seller){
  return numFrom(state.botRep && state.botRep[seller]);
}
function botRepInfo(seller){
  const points = botRepPoints(seller);
  let level = 0;
  BOT_REP_TIERS.forEach((t,i)=>{ if(points >= t.need) level = i; });
  const tier = BOT_REP_TIERS[level];
  const next = BOT_REP_TIERS[level+1] || null;
  const progress = next
    ? Math.max(0, Math.min(1, (points - tier.need) / Math.max(1, next.need - tier.need)))
    : 1;
  return {points, level, name:tier.name, pct:tier.pct, next, progress, max:!next};
}
function botRepPrice(o){
  const pct = botRepInfo(o && o.seller).pct;
  return Math.max(1, Math.round(o.price * (100 - pct) / 100));
}
function botAddRep(seller, n){
  if(!seller) return null;
  const before = botRepInfo(seller);
  state.botRep = (state.botRep && typeof state.botRep === "object" && !Array.isArray(state.botRep)) ? state.botRep : {};
  state.botRep[seller] = Math.max(0, numFrom(state.botRep[seller]) + Math.max(0, n|0));
  return {before, after:botRepInfo(seller)};
}

/* =======================================================================
   🔑 KODY — bardzo rzadkie bonusy ze skrzynek i jednorazowe oferty botów
   ======================================================================= */
const CODE_DROP_CHANCE = 0.0006;   // 0,06% na otwarcie skrzynki (1 na ~1667)
const CODES = [
  {id:"neon",     icon:"💡", name:"Kod Neonowy",    code:"KOD-NEON-25",      rarity:"rare",     reward:25000,   price:20000,  desc:"Neonowe światło i szybki zysk."},
  {id:"sand",     icon:"🏜️", name:"Kod Pustyni",   code:"KOD-SAND-50",      rarity:"rare",     reward:50000,   price:40000,  desc:"Suchy jak pustynny wiatr."},
  {id:"frost",    icon:"❄️", name:"Kod Mrozu",      code:"KOD-FROST-75",     rarity:"rare",     reward:75000,   price:60000,  desc:"Mroźny bonus na chłodne otwarcia."},
  {id:"storm",    icon:"⛈️", name:"Kod Burzy",     code:"KOD-STORM-100",    rarity:"rare",     reward:100000,  price:80000,  desc:"Ładunek, który zawsze trafia."},
  {id:"ember",    icon:"🔥", name:"Kod Żaru",       code:"KOD-EMBER-150",    rarity:"rare",     reward:150000,  price:120000, desc:"Iskra, która rozpala sakiewkę."},
  {id:"midnight", icon:"🌙", name:"Kod Północy",   code:"KOD-MIDNIGHT-250", rarity:"rare",     reward:250000,  price:200000, desc:"Cichy kod na nocne otwarcia."},
  {id:"cyber",    icon:"🤖", name:"Kod Cyber",      code:"KOD-CYBER-300",    rarity:"rare",     reward:300000,  price:240000, desc:"Cyfrowy pakiet z przyszłości."},
  {id:"dragon",   icon:"🐉", name:"Kod Smoka",     code:"KOD-DRAGON-500",   rarity:"rare",     reward:500000,  price:400000, desc:"Syczący skarb ze smoczej jaskini."},
  {id:"phantom",  icon:"👻", name:"Kod Widma",      code:"KOD-PHANTOM-600",  rarity:"rare",     reward:600000,  price:480000, desc:"Znika, zanim zdążysz mrugnąć."},
  {id:"void",     icon:"🕳️", name:"Kod Pustki",    code:"KOD-VOID-1M",      rarity:"rare",     reward:1000000, price:800000, desc:"Coś, czego nie powinno się znaleźć."},
  {id:"solar",    icon:"☀️", name:"Kod Słońca",    code:"KOD-SOLAR-1M2",    rarity:"rare",     reward:1200000, price:960000, desc:"Dawka energii na cały dzień."},
  {id:"royal",    icon:"👑", name:"Kod Królewski", code:"KOD-ROYAL-2M5",    rarity:"rare",     reward:2500000, price:2000000,desc:"Królewska pieczęć i pełna sakiewka."},
  {id:"eclipse",  icon:"🌑", name:"Kod Zaćmienia", code:"KOD-ECLIPSE-3M",   rarity:"rare",     reward:3000000, price:2400000,desc:"Ciemność, która płaci."},
  {id:"aurora",   icon:"🌈", name:"Kod Aurory",    code:"KOD-AURORA-5M",    rarity:"rare",     reward:5000000, price:4000000,desc:"Kolorowa nagroda zorzy."},
  {id:"titan",    icon:"🗿", name:"Kod Tytana",    code:"KOD-TITAN-7M5",    rarity:"rare",     reward:7500000, price:6000000,desc:"Kamienna pieczęć ogromnej nagrody."},
  {id:"otchlan",  icon:"🌌", name:"Kod Otchłani",  code:"KOD-OTCHLAN-10M",  rarity:"veryRare", reward:10000000,price:8000000,desc:"Jeden na całą kolekcję. Bardzo rzadki."}
];
const CODE_BY_ID = {};
CODES.forEach(c=>CODE_BY_ID[c.id] = c);
const CODE_RARITY = {
  rare:     {name:"Rzadki",       color:"#60a5fa"},
  veryRare: {name:"Bardzo rzadki",color:"#a855f7"}
};
let codeBuyFx = "";
let codeBuyFxTimer = 0;
function markCodeBuyFx(id){
  codeBuyFx = id;
  clearTimeout(codeBuyFxTimer);
  codeBuyFxTimer = setTimeout(()=>{
    codeBuyFx = "";
    const card = document.querySelector('#codeShop .code-card[data-code-id="'+id+'"]');
    if(card){
      card.classList.remove("buying");
      const flash = card.querySelector(".code-buy-flash");
      if(flash) flash.remove();
    }
  }, 1100);
}

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
function rollCodeDrop(defer){
  if(Math.random() >= CODE_DROP_CHANCE) return null;
  // Ze skrzynek wypadają kody rzadkie. Kod Otchłani jest dodatkową, bardzo rzadką
  // ofertą wyłącznie u botów — dlatego nie ma go w tej puli.
  const pool = CODES.filter(c => c.rarity === "rare");
  const def = pool[(Math.random()*pool.length)|0];
  // Przy hurtowym otwieraniu zbieramy kody i dodajemy je jednym zapisem.
  return defer ? def : grantCode(def.id, "drop");
}
function codeCardHTML(def, mode){
  const r = CODE_RARITY[def.rarity] || CODE_RARITY.rare;
  const owned = codeCount(def.id);
  const redeemed = numFrom((state.codeRedeemed||{})[def.id]);
  const bought = !!(state.codeBought && state.codeBought[def.id]);
  const sold = mode === "shop" && bought;
  const buying = mode === "shop" && codeBuyFx === def.id;
  const hiddenCode = mode === "shop" && !bought;
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
      : sold
        ? `<span class="cc-qty">kod odblokowany</span>`
        : `<span class="cc-qty">jednorazowa oferta</span>`;
  return `<div class="code-card ${def.rarity}${sold?" bought":""}${buying?" buying":""}" data-code-id="${def.id}" style="--cc:${r.color}">
    <div class="cc-top">
      <div class="code-ico">${def.icon}</div>
      <div style="min-width:0">
        <div class="code-name">${esc(def.name)}</div>
        <span class="code-rarity" style="color:${r.color};border-color:color-mix(in srgb,${r.color} 45%,transparent);background:color-mix(in srgb,${r.color} 13%,transparent)">${r.name}</span>
      </div>
    </div>
    <div class="code-string${hiddenCode?" locked":""}"${hiddenCode?' title="Kod odblokujesz po zakupie"':''}>${hiddenCode?"🔒 KOD UKRYTY":esc(def.code)}</div>
    <div class="code-reward"><span>Nagroda: <b>🪙 ${fmt(def.reward)}</b></span>${qty}</div>
    <div class="code-actions">${action}</div>
    ${buying?`<span class="code-buy-flash" aria-hidden="true">✓ KUPIONO</span>`:""}
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
  markCodeBuyFx(id);
  sfxCode();
  toast("🔑 Kupiono <b>"+esc(def.name)+"</b> — kod <b>"+esc(def.code)+"</b> odblokowany i czeka w zakładce Kody","good");
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
/* 🎟️ Licznik nieotwartych limitowanych skrzynek eventowych na zakładce Skrzynki. */
function eventCaseStockTotal(){
  return (typeof EVENT_CASES !== "undefined" ? EVENT_CASES : []).reduce((a,c)=>a + caseStock(c.id), 0);
}
function renderCaseBadge(){
  const b = $("#eventCaseCount");
  if(!b) return;
  const n = eventCaseStockTotal();
  b.textContent = n ? String(n) : "";
  b.style.display = n ? "" : "none";
  b.title = n ? ("Nieotwarte skrzynki eventowe: " + n) : "";
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
  const pool = CASES.filter(c=>!c.secret && !c.mega && !c.elite && !c.ultra && !c.noItems && !c.eventOnly && !c.suitcase);
  const trade = 1 - TRADE_STEP*upLvl("trade");   // 🏷️ Targowanie
  const list = [];
  BOT_SELLERS.forEach((s, si)=>{
    for(let k=0;k<BOT_SLOTS;k++){
      const id = "b"+tag+"_"+si+"_"+k;
      if(k === BOT_SLOTS-1){                       // skrzynka
        let c;
        if(si === 0) c = BOT_REGULAR_CASES[botCycle() % BOT_REGULAR_CASES.length];
        else if(rndF() < 0.34) c = BOT_REGULAR_CASES[(rndF()*BOT_REGULAR_CASES.length)|0];
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
    /* 🧳 rzadka walizka — osobna, dodatkowa oferta; szansa zależy od reputacji */
    const rep = botRepInfo(s.id);
    const suitChance = BOT_SUITCASE_CHANCE[rep.level] || 0;
    if(BOT_SUITCASES.length && rndF() < suitChance){
      const cid = pickWeighted(BOT_SUITCASE_WEIGHT, rndF);
      const c = BOT_SUITCASES.find(x=>x.id===cid) || BOT_SUITCASES[0];
      const base = c.price;
      const f = 0.94 + rndF()*0.22;
      list.push({ id:"b"+tag+"_"+si+"_s", seller:s.id, kind:"case", caseId:c.id, base,
                  price:Math.max(1, Math.round(roundNice(base*f) * trade)), max:1, suitcase:true });
    }
    /* 💎 diamantowa oferta — rzadka walizka, cena w monetach + diamenty */
    const dChance = BOT_DIAMOND_CHANCE[rep.level] || 0;
    if(rndF() < dChance){
      const ids = Object.keys(BOT_DIAMOND_SUITCASES);
      const cid = ids[(rndF()*ids.length)|0];
      const c = BOT_SUITCASES.find(x=>x.id===cid);
      if(c){
        const coinPrice = Math.max(1, Math.round(roundNice(c.price*BOT_DIAMOND_COIN_MULT) * trade));
        list.push({ id:"b"+tag+"_"+si+"_d", seller:s.id, kind:"case", caseId:c.id,
                    base:c.price, price:coinPrice, max:1, suitcase:true,
                    diamond:BOT_DIAMOND_SUITCASES[cid], diamondOffer:true });
      }
    }
  });
  BOT_CACHE.tag = tag; BOT_CACHE.list = list;
  return list;
}

/* =======================================================================
   8a-3. 🕶️ CZARNY RYNEK — jedna wyjątkowa oferta na tydzień
   -----------------------------------------------------------------------
   Deterministiczna oferta: walizka, nóż albo rzadki kod. Limit 1 szt.
   Cena jest wysoka, ale to towar poza zwykłą rotacją bazaru. Zakup jest
   zapisywany w state.blackBought jako tag tygodnia.
   ======================================================================= */
const BLACK_TTL = 7*24*60*60*1000;
const BLACK_CACHE = {tag:"", offer:null};
const blackCycle = () => Math.floor(Date.now()/BLACK_TTL);
function blackTag(){ return "bm"+blackCycle(); }
function blackBoughtMap(){
  if(!state.blackBought || typeof state.blackBought !== "object" || Array.isArray(state.blackBought)) state.blackBought = {};
  return state.blackBought;
}
function blackSold(o){ return !!(o && blackBoughtMap()[o.tag]); }
function blackCodeTaken(o){
  if(!o || o.kind !== "code") return false;
  return !!((state.codeBought && state.codeBought[o.codeId])
    || (state.codes && numFrom(state.codes[o.codeId]) > 0));
}
function blackCodePool(){
  return CODES.filter(c=>c.rarity === "rare"
    && !(state.codeBought && state.codeBought[c.id])
    && !(state.codes && numFrom(state.codes[c.id]) > 0));
}
function blackSuitcaseOffer(tag, rnd){
  const pool = (typeof BOT_SUITCASES !== "undefined" && Array.isArray(BOT_SUITCASES)) ? BOT_SUITCASES : [];
  if(!pool.length) return null;
  const cid = pickWeighted(BOT_SUITCASE_WEIGHT, rnd);
  const c = pool.find(x=>x.id===cid) || pool[0];
  const base = c.price;
  const price = Math.max(1, Math.round(roundNice(base * (1.02 + rnd()*0.20))));
  return { tag, kind:"case", caseId:c.id, base, price, max:1, black:true, suitcase:true, seller:"black" };
}
function blackOffer(){
  const tag = blackTag();
  if(BLACK_CACHE.tag === tag && BLACK_CACHE.offer) return BLACK_CACHE.offer;
  const bought = blackBoughtMap();
  Object.keys(bought).forEach(k=>{ if(k !== tag) delete bought[k]; });
  const rnd = mulberry32(hash("blackmarket|"+tag));
  let type = ["suitcase","knife","code"][(rnd()*3)|0];
  const codes = blackCodePool();
  if(type === "code" && !codes.length) type = rnd() < 0.5 ? "suitcase" : "knife";
  let offer = null;

  if(type === "suitcase"){
    offer = blackSuitcaseOffer(tag, rnd);
  } else if(type === "knife"){
    const knifeCases = CASES.filter(c=>c && c.items && Array.isArray(c.items.special) && c.items.special.length && !c.suitcase && !c.eventOnly);
    if(knifeCases.length){
      const c = knifeCases[(rnd()*knifeCases.length)|0];
      const it = c.items.special[(rnd()*c.items.special.length)|0];
      const base = itemValue(c, "special", it[0]+"|"+it[1]);
      const price = Math.max(1, Math.round(roundNice(base * (1.04 + rnd()*0.22))));
      offer = { tag, kind:"weapon", caseId:c.id, tier:"special", w:it[0], n:it[1], art:it[2],
                base, price, max:1, black:true, seller:"black" };
    }
  } else {
    const def = codes[(rnd()*codes.length)|0];
    if(def){
      const base = def.price;
      const price = Math.max(1, Math.round(roundNice(base * (0.94 + rnd()*0.18))));
      offer = { tag, kind:"code", codeId:def.id, base, price, max:1, black:true, seller:"black" };
    }
  }
  /* Awaryjnie: gdy pula noży lub kodów jest pusta, zostaje walizka. */
  if(!offer) offer = blackSuitcaseOffer(tag, rnd);
  BLACK_CACHE.tag = tag; BLACK_CACHE.offer = offer;
  return offer;
}
function blackOfferHTML(o){
  if(!o) return "";
  const codeTaken = blackCodeTaken(o);
  const sold = blackSold(o) || codeTaken;
  const diff = Math.round((o.price/Math.max(1,o.base) - 1)*100);
  const deal = diff <= 0 ? `<span class="bm-deal">${diff}%</span>` : `<span class="bm-deal bad">+${diff}%</span>`;
  const priceTitle = `Cena bazowa: 🪙 ${fmt(o.base)}`;
  let art = "🕶️", name = "Oferta", sub = "", kindLabel = "oferta", color = "#a855f7", foot = "Nowa oferta co 7 dni.";
  if(o.kind === "case"){
    const c = CASES.find(x=>x.id===o.caseId);
    if(!c) return "";
    art = c.icon; name = c.name; color = c.color; kindLabel = "walizka";
    sub = "🧳 rzadka walizka · po zakupie trafia do Ekwipunku";
    foot = "Limit 1 szt. · otwierasz ją w Ekwipunku, kiedy chcesz.";
  } else if(o.kind === "weapon"){
    const c = CASES.find(x=>x.id===o.caseId);
    const t = TIER[o.tier] || TIER.special;
    art = weaponSVG({w:o.w,n:o.n,tier:o.tier,art:o.art}, hash(o.tag).toString(36));
    name = o.n; color = t.color; kindLabel = "nóż";
    sub = `${esc(o.w)} · ★ nóż${c ? " z "+esc(c.name) : ""} · trafia do ekwipunku`;
    foot = "Limit 1 szt. · broń od razu trafia do ekwipunku.";
  } else {
    const def = CODE_BY_ID[o.codeId];
    if(!def) return "";
    const r = CODE_RARITY[def.rarity] || CODE_RARITY.rare;
    art = def.icon; name = def.name; color = r.color; kindLabel = "rzadki kod";
    sub = `${r.name} · ${codeTaken ? "kod już posiadany" : "kod odsłania się po zakupie"}`;
    foot = "Limit 1 szt. · kod czeka w zakładce Kody.";
  }
  return `<div class="black-offer${sold?" sold":""}" style="--c:${color}">
    <div class="bm-ribbon">🕶️ TYGODNIOWA OFERTA · ${kindLabel.toUpperCase()}</div>
    <div class="bm-head">
      <div class="bm-art">${art}</div>
      <div class="bm-main">
        <div class="bm-kicker">Czarny rynek</div>
        <div class="bm-name">${esc(name)}</div>
        <div class="bm-sub">${sub}</div>
        <div class="bm-meta">
          <span class="bm-price" title="🪙 ${fmt(o.price)}">🪙 ${fmtShort(o.price)}</span>
          <span class="bm-base" title="${priceTitle}">🪙 ${fmtShort(o.base)}</span>${deal}
          <span class="bm-stock${sold?" sold":""}">${sold ? (codeTaken ? "kod już posiadany" : "wykupione") : "1 szt."}</span>
        </div>
      </div>
      <button class="bm-buy" data-blackbuy="1" ${sold || state.coins < o.price ? "disabled" : ""}>${sold ? "—" : "Kup"}</button>
    </div>
    <div class="bm-foot"><span>${foot}</span><span>Nowa oferta za <b>${timeLeftLong(BLACK_TTL - (Date.now()%BLACK_TTL))}</b></span></div>
  </div>`;
}
function blackTick(){
  const h = $("#blackHint");
  if(h){
    const o = blackOffer();
    const sold = !o || blackSold(o) || blackCodeTaken(o);
    h.innerHTML = (sold ? "wykupione" : "1 wyjątkowa oferta") + " · nowa za <b>"+timeLeftLong(BLACK_TTL - (Date.now()%BLACK_TTL))+"</b>";
  }
}
function renderBlackMarket(force){
  const g = $("#blackMarket");
  if(!g) return;
  if(currentView !== "bots" && !force){ blackTick(); return; }
  const o = blackOffer();
  g.innerHTML = o ? blackOfferHTML(o) : `<div class="black-offer"><div class="bm-main"><div class="bm-name">Brak oferty w tym tygodniu</div><div class="bm-sub">Wróć po kolejnej rotacji.</div></div></div>`;
  g.classList.add("ready");
  blackTick();
}
function buyBlackOffer(){
  const o = blackOffer();
  if(!o) return;
  if(blackSold(o)){ sfxErr(); toast("Ta oferta z czarnego rynku jest już wykupiona","bad"); return; }
  if(blackCodeTaken(o)){ sfxErr(); toast("Ten kod już masz — oferta jest jednorazowa","bad"); return; }
  if(state.coins < o.price){ sfxErr(); toast("Za mało monet na czarny rynek","bad"); return; }
  if(o.kind === "code" && !CODE_BY_ID[o.codeId]){ sfxErr(); return; }

  state.coins -= o.price;
  state.stats.spent += o.price;
  state.stats.botBuys = numFrom(state.stats.botBuys) + 1;
  state.stats.botSpent = numFrom(state.stats.botSpent) + o.price;
  state.stats.blackBuys = numFrom(state.stats.blackBuys) + 1;
  state.stats.blackSpent = numFrom(state.stats.blackSpent) + o.price;
  const blackDiff = Math.round((o.price / Math.max(1, o.base) - 1) * 100);
  if(blackDiff < 0) state.stats.blackBestDeal = Math.max(numFrom(state.stats.blackBestDeal), -blackDiff);
  blackBoughtMap()[o.tag] = true;

  if(o.kind === "case"){
    state.caseStock = (state.caseStock && typeof state.caseStock === "object" && !Array.isArray(state.caseStock)) ? state.caseStock : {};
    state.caseStock[o.caseId] = caseStock(o.caseId) + 1;
    state.stats.botCases = numFrom(state.stats.botCases) + 1;
    const c = CASES.find(x=>x.id===o.caseId);
    sfxCoin();
    toast("🕶️ <b>Czarny rynek:</b> kupiono "+(c && c.suitcase ? "🧳 " : "")+"<b>"+esc(c ? c.name : "walizkę")+"</b> — czeka w <b>Ekwipunku</b>.","good");
  } else if(o.kind === "code"){
    const def = CODE_BY_ID[o.codeId];
    state.codeBought = (state.codeBought && typeof state.codeBought === "object" && !Array.isArray(state.codeBought)) ? state.codeBought : {};
    state.codeBought[o.codeId] = true;
    state.stats.codeBuys = numFrom(state.stats.codeBuys) + 1;
    addCode(o.codeId, 1);
    sfxCode();
    toast("🕶️ <b>Czarny rynek:</b> kupiono <b>"+esc(def.name)+"</b> — kod czeka w zakładce Kody.","good");
    renderCodeShop(); renderCodes();
  } else {
    const item = { uid:"bm"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
      w:o.w, n:o.n, art:o.art, tier:o.tier, caseId:o.caseId, fx:null,
      value:Math.round(o.base), ts:Date.now() };
    addToInv(item);
    sfxCoin();
    toast("🕶️ <b>Czarny rynek:</b> kupiono <b>"+esc(item.n)+"</b> ("+esc(item.w)+") — trafia do ekwipunku.","good");
  }
  if(typeof missionTrack === "function") missionTrack("bot_buy", 1, { seller:"black", kind:o.kind, caseId:o.caseId });
  markDirty(); save();
  renderBalance(); renderBots(); renderShop(); renderInv(); renderStats(); renderCodes();
  checkAchievements();
}

/* =======================================================================
   8a-4. 📅 KONTRAKTY TYGODNIOWE BAZARU
   -----------------------------------------------------------------------
   Trzy zadania na 7 dni, niezależne od dziennych/tygodniowych Misji.
   Postęp jest zasilany tym samym missionTrack(), więc obejmuje też
   auto-otwieranie i zakupy w Bazarze. Nagrody odbiera się tutaj.
   ======================================================================= */
const BAZAR_WEEK_MS = 7*24*60*60*1000;
const BAZAR_CONTRACTS = [
  {id:"buy",  icon:"🛒", ev:"bot_buy", goal:5,  mult:0.95, title:"Kup 5 ofert w Bazarze",     desc:"Bazar żyje transakcjami."},
  {id:"open", icon:"📦", ev:"open",    goal:10, mult:1.10, title:"Otwórz 10 skrzynek",        desc:"Towar musi krążyć."},
  {id:"sell", icon:"💰", ev:"sell",    goal:20, mult:1.00, title:"Sprzedaj 20 przedmiotów",   desc:"Oczyść ekwipunek."},
  {id:"win",  icon:"⚔️", ev:"win",     goal:3,  mult:1.25, title:"Wygraj 3 bitwy",             desc:"Pokaż, że warto z tobą handlować."}
];
const BAZAR_CONTRACT_BY_ID = Object.fromEntries(BAZAR_CONTRACTS.map(c=>[c.id,c]));
const BAZAR_WEEKLY_CACHE = {tag:""};
function bazarWeekReward(def){
  const base = typeof mMoney === "function" ? mMoney(0.018, 50000, 20000000) : 50000;
  return Math.max(10000, Math.round(base * (def.mult || 1) / 1000) * 1000);
}
function bazarWeekLeftTxt(start){
  const ms = Math.max(0, numFrom(start) + BAZAR_WEEK_MS - Date.now());
  const d = Math.floor(ms/86400000), h = Math.floor(ms%86400000/3600000), m = Math.floor(ms%3600000/60000);
  return d > 0 ? d+" dni "+h+" godz." : (h > 0 ? h+" godz. "+m+" min" : m+" min");
}
function rollBazarWeekly(){
  const tag = Math.floor(Date.now()/BAZAR_WEEK_MS);
  const rnd = mulberry32(hash("bazarweekly|"+tag));
  const pool = BAZAR_CONTRACTS.slice();
  for(let i=pool.length-1; i>0; i--){
    const j = (rnd()*(i+1))|0;
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  const list = pool.slice(0, 3).map(def=>({id:def.id, prog:0, claimed:false, reward:bazarWeekReward(def)}));
  state.bazarWeekly = {start:Date.now(), list, full:false};
  BAZAR_WEEKLY_CACHE.tag = "w"+tag;
  markDirty();
  return state.bazarWeekly;
}
function bazarWeeklyState(){
  const w = state.bazarWeekly;
  const age = w ? Date.now() - numFrom(w.start) : BAZAR_WEEK_MS;
  /* Tolerancja dla zegara cofniętego o kilka minut; start z przyszłości
     (np. po zmianie czasu w systemie) traktujemy jako nowy tydzień. */
  if(w && typeof w === "object" && Array.isArray(w.list) && w.list.length === 3
     && age >= -5*60*1000 && age < BAZAR_WEEK_MS){
    const valid = w.list.every(m=>m && BAZAR_CONTRACT_BY_ID[m.id]);
    if(valid){
      w.list.forEach(m=>{
        const def = BAZAR_CONTRACT_BY_ID[m.id];
        m.prog = Math.max(0, Math.min(def.goal, numFrom(m.prog)));
        m.claimed = !!m.claimed;
        w.full = !!w.full;
        const reward = numFrom(m.reward);
        m.reward = reward > 0 ? reward : bazarWeekReward(def);
      });
      return w;
    }
  }
  return rollBazarWeekly();
}
function bazarContractTrack(ev, n, data){
  if(!n || n <= 0) return;
  const w = bazarWeeklyState();
  let changed = false;
  w.list.forEach(m=>{
    const def = BAZAR_CONTRACT_BY_ID[m.id];
    if(!def || m.claimed || m.prog >= def.goal || def.ev !== ev) return;
    const before = m.prog;
    m.prog = Math.min(def.goal, m.prog + n);
    if(m.prog !== before){
      changed = true;
      if(m.prog >= def.goal && typeof toast === "function")
        setTimeout(()=>toast("📅 <b>Kontrakt tygodniowy gotowy:</b> "+esc(def.title)+". Odbierz nagrodę w Bazarze botów.","good"), 320);
    }
  });
  if(changed){
    markDirty();
    if(typeof currentView !== "undefined" && currentView === "bots" && typeof renderBazarWeekly === "function") renderBazarWeekly();
    if(typeof save === "function") save({kind:"bazar_contract"});
  }
}
function renderBazarWeekly(){
  const g = $("#bazarWeekly");
  if(!g) return;
  const w = bazarWeeklyState();
  g.innerHTML = w.list.map((m,i)=>{
    const def = BAZAR_CONTRACT_BY_ID[m.id];
    if(!def) return "";
    const done = m.prog >= def.goal;
    return `<div class="mission week d-1 ${done && !m.claimed ? "done" : ""} ${m.claimed ? "claimed" : ""}" style="--dc:#a855f7;animation-delay:${i*55}ms">
      <div class="mission-top"><span class="mission-ico">${def.icon}</span><span class="mission-txt">${esc(def.title)}
        <span class="m-diff">📅 kontrakt</span></span></div>
      <div class="mission-bar"><i style="width:${Math.min(100, 100*m.prog/Math.max(1,def.goal))}%"></i></div>
      <div class="mission-foot">
        <span class="mission-rew">Nagroda: <b>🪙 ${fmt(m.reward)}</b></span>
        <span class="mission-prog">${Math.min(m.prog,def.goal)} / ${def.goal}</span>
      </div>
      <div class="mission-foot">${m.claimed
        ? `<span class="mission-rew">✔ odebrano</span>`
        : `<button class="btn ${done?"primary":""}" data-bazarclaim="${i}" ${done?"":"disabled"}>${done?"🎁 Odbierz":"W toku"}</button>`}</div>
    </div>`;
  }).join("");
  g.classList.add("ready");
  updateBazarWeeklyHint();
}
function updateBazarWeeklyHint(){
  const h = $("#bazarWeeklyHint");
  if(!h) return;
  const w = bazarWeeklyState();
  const claimed = w.list.filter(m=>m.claimed).length;
  h.innerHTML = `nowe kontrakty za <b>${bazarWeekLeftTxt(w.start)}</b> · odebrane <b>${claimed}</b> / ${w.list.length}`;
}
function claimBazarContract(i){
  const w = bazarWeeklyState();
  const m = w.list[i];
  if(!m) return;
  const def = BAZAR_CONTRACT_BY_ID[m.id];
  if(!def || m.claimed || m.prog < def.goal){ sfxErr(); return; }
  m.claimed = true;
  state.stats.bazarContracts = numFrom(state.stats.bazarContracts) + 1;
  if(state.season){
    state.season.contracts = numFrom(state.season.contracts) + 1;
    if(typeof seasonCheckMaster === "function") seasonCheckMaster();
  }
  if(!w.full && w.list.every(x=>x.claimed)){
    w.full = true;
    state.stats.bazarWeeks = numFrom(state.stats.bazarWeeks) + 1;
  }
  state.coins += m.reward;
  state.stats.earned = numFrom(state.stats.earned) + m.reward;
  markDirty(); save();
  sfxCoin();
  confetti(["#a855f7","#ffd166","#8ee7ff"]);
  toast("📅 <b>Kontrakt tygodniowy zaliczony!</b> Nagroda: 🪙 "+fmt(m.reward),"good");
  renderBalance(); renderBots(); renderShop(); renderStats();
  if(typeof checkAchievements === "function") checkAchievements();
}
function botOfferHTML(o){
  const left = botLeft(o);
  const sold = left <= 0;
  const rep = botRepInfo(o.seller);
  const price = botRepPrice(o);
  const diff = Math.round((price/o.base - 1)*100);
  const deal = diff <= 0 ? `<span class="bo-deal">${diff}%</span>` : `<span class="bo-deal bad">+${diff}%</span>`;
  const repTag = rep.pct ? `<span class="bo-rep" title="Rabat za reputację u tego bota">🤝 -${rep.pct}%</span>` : "";
  const priceTitle = `Cena bazowa: 🪙 ${fmt(o.price)}${rep.pct ? " · reputacja -"+rep.pct+"%" : ""}`;
  const stockTxt = sold ? "wykupione" : "zostało "+left+" z "+o.max;
  const stockCls = "bo-stock"+(left>0 && left<=1 ? " low" : "");
  if(o.kind === "case"){
    const c = CASES.find(x=>x.id===o.caseId);
    if(!c) return "";
    const suit = !!c.suitcase;
    const dm = !!o.diamondOffer;
    const noDm = dm && numFrom(state.diamonds) < numFrom(o.diamond);
    const full = dm && state.season && numFrom(state.season.dmSuits) >= BOT_DIAMOND_LIMIT;
    const noGate = dm && typeof bossGatePassed === "function" && !bossGatePassed();
    const blocked = sold || noDm || full || noGate;
    const btn = blocked ? "—" : (dm ? "Kup · "+o.diamond+" 💎" : "Kup");
    const btnTxt = noGate ? "🔒 R5" : full ? "LIMIT" : noDm ? "MAŁO 💎" : btn;
    return `<div class="bot-offer${sold?" sold":""}${suit?" suitcase":""}${dm?" diamond":""}" style="--c:${dm?"#22d3ee":c.color}${sold?";--c:#44506b":""}">
      <div class="bo-art bo-case" style="--cc:${dm?"#22d3ee":c.color}">${dm?"💎":c.icon}</div>
      <div class="bo-main">
        <div class="bo-w">${dm ? "💎 DIAMENTOWA OFERTA · gwarantowana walizka"+(noGate?" · 🔒 rozdział 5":"") : suit ? "🧳 walizka · rzadka oferta" : c.botOnly ? "tylko u botów" : "skrzynka"}</div>
        <div class="bo-n">${esc(c.name)}</div>
        <div class="bo-meta"><span class="bo-price" title="${priceTitle}">🪙 ${fmtShort(price)}</span>
          <span class="bo-base">🪙 ${fmtShort(o.base)}</span>${deal}${repTag}
          ${dm ? `<span class="bo-diamond">${o.diamond} 💎</span>` : ""}
          ${suit ? '<span class="bo-suit">RZADKA</span>' : ""}
          <span class="${stockCls}">${dm && state.season ? (numFrom(state.season.dmSuits)+"/"+BOT_DIAMOND_LIMIT+" sezon") : stockTxt}</span></div>
      </div>
      <button class="bo-buy" data-botbuy="${o.id}" ${blocked?"disabled":""}>${btnTxt}</button>
    </div>`;
  }
  const t = TIER[o.tier];
  return `<div class="bot-offer${sold?" sold":""}" style="--c:${t.color}">
    <div class="bo-art">${weaponSVG({w:o.w,n:o.n,tier:o.tier,art:o.art}, hash(o.id).toString(36))}</div>
    <div class="bo-main">
      <div class="bo-w">${esc(o.w)}</div>
      <div class="bo-n">${esc(o.n)}</div>
      <div class="bo-meta"><span class="bo-price" title="${priceTitle}">🪙 ${fmtShort(price)}</span>
        <span class="bo-base">🪙 ${fmtShort(o.base)}</span>${deal}${repTag}
        <span class="${stockCls}">${stockTxt}</span></div>
    </div>
    <button class="bo-buy" data-botbuy="${o.id}" ${sold?"disabled":""}>${sold?"—":"Kup"}</button>
  </div>`;
}
/* Krótki licznik dla długich okresów: 2:02:20, 6d 23h 12m. */
function timeLeftLong(ms){
  const total = Math.max(0, Math.ceil(ms/1000));
  const d = Math.floor(total/86400), h = Math.floor(total%86400/3600);
  const m = Math.floor(total%3600/60), s = total%60;
  if(d > 0) return d+"d "+h+"h "+m+"m";
  if(h > 0) return h+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
  return m+":"+String(s).padStart(2,"0");
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
    /* Walizki są liczone na plakietce Ekwipunku, nie Bazaru. */
    const n = CASES.reduce((a,c)=>a+(c.suitcase ? 0 : caseStock(c.id)),0);
    badge.textContent = n ? String(n) : "";
    badge.style.display = n ? "" : "none";
  }
  blackTick();
  updateBazarWeeklyHint();
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
    const rep = botRepInfo(s.id);
    const repTitle = `Reputacja: ${rep.points} pkt · ${rep.name}${rep.pct ? " · rabat -"+rep.pct+"%" : ""}`;
    return `<div class="bot-card" style="animation-delay:${i*70}ms">
      <div class="bot-head">
        <div class="bot-ava">${s.icon}</div>
        <div><div class="bot-name">${esc(s.name)}</div><div class="bot-tag">${esc(s.tag)}</div></div>
        <div class="bot-live${any?"":" off"}">● ${any?"ONLINE":"WYKUPIONY"}</div>
      </div>
      <div class="bot-line">${s.line}</div>
      <div class="bot-story">${esc(s.story || "")}</div>
      <div class="bot-rep${rep.max?" max":""}" title="${repTitle}">
        <span class="br-name">🤝 ${rep.name}</span>
        <span class="br-bar"><i style="width:${Math.round(rep.progress*100)}%"></i></span>
        <span class="br-pct">${rep.pct?"-"+rep.pct+"%":"0%"}</span>
      </div>
      ${botContractHTML(s.id)}
      <div class="bot-offers">${mine.map(botOfferHTML).join("")}</div>
    </div>`;
  }).join("");
  g.classList.add("ready");
  botTick();
  renderBlackMarket();
  renderBazarWeekly();
  renderCodeShop();
}
function buyBotOffer(id){
  const off = botOffers().find(o=>o.id===id);
  if(!off) return;
  if(botLeft(off) <= 0){ sfxErr(); toast("Ten bot już wszystko sprzedał","bad"); return; }
  const price = botRepPrice(off);
  if(state.coins < price){ sfxErr(); toast("Za mało monet!","bad"); return; }
  if(off.diamondOffer){
    if(numFrom(state.diamonds) < numFrom(off.diamond)){ sfxErr(); toast("Za mało diamentów 💎","bad"); return; }
    if(state.season && numFrom(state.season.dmSuits) >= BOT_DIAMOND_LIMIT){ sfxErr(); toast("Wykorzystałeś limit diamentowych walizek w tym sezonie","bad"); return; }
    if(typeof bossGatePassed === "function" && !bossGatePassed()){ sfxErr(); toast("Diamantowa oferta wymaga ukończenia rozdziału 5 kampanii bossów","bad"); return; }
  }

  const repChange = botAddRep(off.seller, 1);
  state.coins -= price;
  if(off.diamondOffer){
    state.diamonds = Math.max(0, numFrom(state.diamonds) - numFrom(off.diamond));
    if(state.season) state.season.dmSuits = numFrom(state.season.dmSuits) + 1;
    state.stats.botDiamonds = numFrom(state.stats.botDiamonds) + numFrom(off.diamond);
  }
  state.stats.spent += price;
  state.stats.botBuys  = numFrom(state.stats.botBuys) + 1;
  state.stats.botSpent = numFrom(state.stats.botSpent) + price;
  botStockMap()[off.id] = numFrom(botStockMap()[off.id]) + 1;
  missionTrack("bot_buy", 1, { seller:off.seller, kind:off.kind, caseId:off.caseId });

  if(off.kind === "case"){
    state.caseStock = (state.caseStock && typeof state.caseStock === "object" && !Array.isArray(state.caseStock)) ? state.caseStock : {};
    state.caseStock[off.caseId] = caseStock(off.caseId) + 1;
    state.stats.botCases = numFrom(state.stats.botCases) + 1;
    const c = CASES.find(x=>x.id===off.caseId);
    sfxCoin();
    toast((off.diamondOffer ? "💎 Kupiono diamentową walizkę <b>" : c && c.suitcase ? "🧳 Kupiono <b>" : "📦 Kupiono <b>")+esc(c ? c.name : "skrzynkę")+"</b> — "+
      (c && c.suitcase ? "czeka w <b>Ekwipunku</b>" : "czeka w zapasie w zakładce Skrzynki")+". "+
      (off.diamondOffer ? "Gwarantowana rzadka walizka · wydano "+off.diamond+" 💎." : c && c.suitcase ? "To rzadka walizka: otwórz ją, kiedy chcesz — po otwarciu zniknie, a kolejną upolujesz tylko u bota." : "To skrzynka jednorazowa: po otwarciu zniknie, a kolejną kupisz tylko u bota.")+
      " · 🤝 reputacja +1","good");
  } else {
    const item = { uid:"b"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
      w:off.w, n:off.n, art:off.art, tier:off.tier, caseId:off.caseId, fx:null,
      value:Math.round(off.base), ts:Date.now() };
    addToInv(item);
    const diff = Math.round((price/off.base - 1)*100);
    if(diff < 0) state.stats.bestDeal = Math.min(100, Math.max(numFrom(state.stats.bestDeal), -diff));
    sfxCoin();
    toast((diff<=0 ? "🏷️ <b>Okazja!</b> " : "🛒 Kupiono ")+"<b>"+esc(item.n)+"</b> ("+esc(item.w)+") za 🪙 "+
      fmt(price)+(diff<0 ? " · "+(-diff)+"% taniej" : diff>0 ? " · +"+diff+"% drożej" : " · cena rynkowa")+" · 🤝 reputacja +1","good");
  }
  markDirty(); save();
  renderBalance(); renderBots(); renderShop(); renderInv(); renderStats();
  if(repChange && repChange.after.level > repChange.before.level){
    const seller = BOT_SELLERS.find(s=>s.id===off.seller);
    setTimeout(()=>toast("🤝 <b>"+esc(seller ? seller.name : "Bot")+"</b> — nowy poziom reputacji: <b>"+repChange.after.name+"</b> (rabat -"+repChange.after.pct+"%)","good"), 350);
  }
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
  const c = e.target.closest("[data-botcontract]");
  if(c){ botContractClaim(c.dataset.botcontract); return; }
  const b = e.target.closest("[data-botbuy]");
  if(b) buyBotOffer(b.dataset.botbuy);
});
$("#blackMarket").addEventListener("click", e=>{
  if(e.target.closest("[data-blackbuy]")) buyBlackOffer();
});
$("#bazarWeekly").addEventListener("click", e=>{
  const b = e.target.closest("[data-bazarclaim]");
  if(b) claimBazarContract(+b.dataset.bazarclaim);
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
  const bw = state.bazarWeekly;
  const age = bw ? Date.now() - numFrom(bw.start) : BAZAR_WEEK_MS;
  if(BOT_CACHE.tag !== botTag() || BLACK_CACHE.tag !== blackTag()
     || !bw || age >= BAZAR_WEEK_MS || age < -5*60*1000) renderBots();
  else botTick();
}, 1000);

/* =======================================================================
   8a. 🛒 SKLEP + 🎉 EVENTY
   -----------------------------------------------------------------------
   Stały katalog broni: 16 pozycji, stałe ceny regularne i praktycznie
   nieograniczony zapas. Co 30 minut 3 pozycje trafiają do limitowanej
   promocji. Bez sprzedawców i targowania. Eventowe oferty dodają broń,
   skrzynię i — tylko w niektórych rotacjach — kod.
   ======================================================================= */
const SHOP_TTL          = 6*60*1000;  // rotacja ofert eventowych
const SHOP_EVENT_CODE_CHANCE = 0.05;  // kod tylko w ~5% rotacji eventowych
const SHOP_PROMO_TTL    = 30*60*1000; // rotacja promocji katalogu
const SHOP_PROMO_COUNT  = 3;          // ile pozycji jest w promocji
const SHOP_PROMO_MIN_OFF = 23;        // minimalny rabat promocji (%)
const SHOP_PROMO_MAX_OFF = 30;        // maksymalny rabat promocji (%)
/* ⏰ Happy hour: co 3 godziny przez 30 minut. Co drugie okno daje
   dodatkowe +5% rabatu do promocji, a co drugie +10% do sprzedaży. */
const SHOP_HAPPY_EVERY = 3*60*60*1000;
const SHOP_HAPPY_DUR   = 30*60*1000;
const SHOP_HAPPY_PROMO_BONUS = 5;
const SHOP_HAPPY_SELL_BONUS  = 0.10;
const SHOP_CACHE = {tag:"", rendered:"", list:[]};
let FX_EVENT_SIG = "";

/* =======================================================================
   8a-2. 🎁 PAKIETY — darmowy starter i losowe pakiety za monety
   -----------------------------------------------------------------------
   Pakiety nie są gwarantowanym zyskiem. Zawartość losuje się przy zakupie:
   czasem trafi się coś droższego, czasem strata. Starter jest jednorazowy.
   ======================================================================= */
const PACK_CODE_CHANCE = 0.01;
const PACK_CODE_CHANCE_HIGH = 0.03;
const PACK_ROTATE_MS = 3*60*60*1000;     // pakiety rotują co 3 godziny
const STARTER_REFRESH_MS = 60*60*1000;   // starter odnawia się co 1 godzinę
const PACK_ROTATE_SIZE = 4;              // starter + 4 losowe pakiety w rotacji
const PACKS = [
  { id:"starter", icon:"🎁", name:"Pakiet startowy", badge:"FREE · CO 1H",
    color:"#38e08a", price:0, once:true, refreshMs:STARTER_REFRESH_MS,
    desc:"2 500 monet, Skrzynka Startowa i losowa broń z Pryzmatu. Odnawia się co godzinę." },
  { id:"bronie", icon:"🔫", name:"Pakiet broni", badge:"3 LOSOWE BRONIE",
    color:"#60a5fa", price:9000,
    desc:"Trzy bronie z Widma. Bez gwarancji zysku — czasem trafi się rzadszy model." },
  { id:"skrzynki", icon:"📦", name:"Pakiet skrzynek", badge:"2 LOSOWE SKRZYNKI",
    color:"#34d399", price:6000,
    desc:"Dwie skrzynki z puli Pryzmat / Widmo / Chroma. Wszystkie trafiają do zapasu." },
  { id:"kolekcjoner", icon:"💼", name:"Pakiet kolekcjonera", badge:"CHROMA + SZANSA NA KOD",
    color:"#f472b6", price:32000,
    desc:"Broń z Chromy, skrzynka Chroma i mała (1%) szansa na rzadki kod. Dla lubiących ryzyko." },
  { id:"hazard", icon:"🎲", name:"Pakiet hazardzisty", badge:"WYSOKIE RYZYKO",
    color:"#f59e0b", price:15000,
    desc:"Cztery bronie z Widma, głównie tanie — ale może wypaść nóż. Czasem wielka strata, czasem jackpot." },
  { id:"snajper", icon:"🎯", name:"Pakiet snajpera", badge:"2 BRONIE Z CHROMY",
    color:"#fb7185", price:12000,
    desc:"Dwa losowe dropy z Chromy. Precyzyjnie, ale bez gwarancji zysku." },
  { id:"ostrze", icon:"🗡️", name:"Pakiet ostrza", badge:"SZANSA NA NÓŻ",
    color:"#f43f5e", price:45000,
    desc:"Jeden drop z Widma z mocno przesuniętymi szansami na Covert i nóż." },
  { id:"mieszany", icon:"🧩", name:"Pakiet mieszany", badge:"3 RÓŻNE DROPY",
    color:"#38bdf8", price:25000,
    desc:"Broń z Pryzmatu, broń z Widma i losowa skrzynka do zapasu." },
  { id:"kody", icon:"🔑", name:"Pakiet kodów", badge:"KOD + BROŃ",
    color:"#a78bfa", price:18000,
    desc:"Broń z Miejskiej i 3% szansy na rzadki kod zamiast części zysku." },
  { id:"szczescie", icon:"🍀", name:"Pakiet szczęścia", badge:"LEPSZE SZANSE",
    color:"#facc15", price:50000,
    desc:"Trzy dropy ze Smoka z wyraźnie lepszymi wagami — wciąż jednak bez gwarancji." },
  { id:"figlarz", icon:"🤡", name:"Pakiet figlarza", badge:"MONETY + SKRZYNKA",
    color:"#34d399", price:7000,
    desc:"Losowa garść monet i Skrzynka Troll. Może zwrócić więcej, niż kosztował." }
];
const PACK_BY_ID = Object.fromEntries(PACKS.map(p=>[p.id,p]));

let PACK_ROT_CACHE = {cycle:-1, list:[]};
function packCycle(){ return Math.floor(Date.now()/PACK_ROTATE_MS); }
function activePacks(){
  const cyc = packCycle();
  if(PACK_ROT_CACHE.cycle !== cyc){
    const pool = PACKS.filter(p=>p.id!=="starter");
    const rnd = mulberry32(hash("packrot|"+cyc));
    for(let i=pool.length-1;i>0;i--){
      const j = Math.floor(rnd()*(i+1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    PACK_ROT_CACHE = {cycle:cyc, list:[PACK_BY_ID.starter, ...pool.slice(0,PACK_ROTATE_SIZE)]};
  }
  return PACK_ROT_CACHE.list;
}
function packRefreshLeft(p){
  if(!p || !p.refreshMs) return 0;
  const t = numFrom(state.packClaims && state.packClaims[p.id]);
  return t ? Math.max(0, t + p.refreshMs - Date.now()) : 0;
}

const shopCycle = () => Math.floor(Date.now()/SHOP_TTL);
function shopStockMap(){
  if(!state.shopBought || typeof state.shopBought !== "object" || Array.isArray(state.shopBought)) state.shopBought = {};
  return state.shopBought;
}
function shopLeft(o){ return Math.max(0, o.max - numFrom(shopStockMap()[o.id])); }
function shopPromoCycle(){ return Math.floor(Date.now()/SHOP_PROMO_TTL); }
function shopPromoTag(){ return "pr"+shopPromoCycle(); }
function promoLeft(p){ return Math.max(0, p.max - numFrom(shopStockMap()[p.key])); }
/* Sklep to stały katalog — bez rotacji, bez saltu i bez wpływu Targowania. */
function shopTag(){ return "catalog_v1"; }
/* Eventy w Sklepie nadal rotują z czasem, ale nie są już uzależnione od
   Targowania — to bonus Bazaru, nie Sklepu. */
function eventTag(){ return "ev"+shopCycle(); }
function shopHappyCycle(){ return Math.floor(Date.now()/SHOP_HAPPY_EVERY); }
function shopHappyActive(){ return (Date.now() % SHOP_HAPPY_EVERY) < SHOP_HAPPY_DUR; }
function shopHappyType(){ return shopHappyCycle() % 2 ? "sell" : "promo"; }
function shopHappyLeft(){
  const rem = Date.now() % SHOP_HAPPY_EVERY;
  return shopHappyActive() ? SHOP_HAPPY_DUR - rem : SHOP_HAPPY_EVERY - rem;
}
function shopHappyTag(){
  return "hh"+shopHappyCycle()+"_"+(shopHappyActive() ? shopHappyType() : "off");
}
function shopHappyPromoBonus(){
  return shopHappyActive() && shopHappyType()==="promo" ? SHOP_HAPPY_PROMO_BONUS : 0;
}
function shopHappySellMult(){
  return shopHappyActive() && shopHappyType()==="sell" ? 1 + SHOP_HAPPY_SELL_BONUS : 1;
}
/* Liczniki osiągnięć nowych systemów. Trzymamy je w state.stats, więc stare
   zapisy dostają zera przy wczytaniu, a nowe od razu zapisują postęp. */
function trackHappyPurchase(off, promoOn, price){
  if(typeof shopHappyActive !== "function" || !shopHappyActive()) return;
  state.stats.happyBuys = numFrom(state.stats.happyBuys) + 1;
  if(promoOn && off && off.promo && numFrom(off.promo.happy) > 0){
    const baseDiscount = numFrom(off.promo.baseDiscount);
    if(baseDiscount > 0){
      const normal = Math.max(1, Math.round(roundNice(off.price * (1 - baseDiscount/100))));
      state.stats.happySaved = numFrom(state.stats.happySaved) + Math.max(0, normal - price);
    }
  }
}
function trackHappySale(items){
  if(typeof shopHappyActive !== "function" || !shopHappyActive()) return;
  const list = (items || []).filter(Boolean);
  if(!list.length) return;
  state.stats.happySells = numFrom(state.stats.happySells) + list.length;
  const mult = typeof shopHappySellMult === "function" ? shopHappySellMult() : 1;
  if(mult <= 1) return;
  const baseRate = sellRate() / mult;
  let extra = 0;
  list.forEach(it=>{
    const actual = itemSell(it);
    const normal = it.fixedSell ? numFrom(it.fixedSell) : Math.round(numFrom(it.value) * baseRate);
    if(actual > normal) extra += actual - normal;
  });
  state.stats.happyEarned = numFrom(state.stats.happyEarned) + extra;
}
function shopCacheKey(){ return shopTag()+"|"+eventTag()+"|"+shopPromoTag()+"|"+shopHappyTag(); }

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
  const prTag = shopPromoTag();
  const hapTag = shopHappyTag();
  const cacheKey = tag+"|"+evTag+"|"+prTag+"|"+hapTag;
  if(SHOP_CACHE.tag === cacheKey) return SHOP_CACHE.list;
  const rndF = mulberry32(hash("playercatalog|"+tag));
  const evRnd = mulberry32(hash("playerevent|"+evTag));
  const promoRnd = mulberry32(hash("shoppromo|"+prTag));
  const bought = shopStockMap();
  Object.keys(bought).forEach(k=>{
    if(k.indexOf("s"+tag+"_") !== 0 && k.indexOf("e"+evTag+"_") !== 0 && k.indexOf("p"+prTag+"_") !== 0) delete bought[k];
  });
  const pool = CASES.filter(c=>!c.botOnly && !c.eventOnly && !c.secret && !c.mega && !c.elite && !c.ultra && !c.noItems);
  const list = [];

  /* Stały katalog: 16 broni, po 4 z każdego standardowego tieru.
     Bez noży i rękawic — te zostają wyłącznie w Bazarze i skrzynkach.
     Ceny są stałe (marża sklepu), a zapas praktycznie nieograniczony. */
  const CATALOG_TIERS = [
    "mil","mil","mil","mil",
    "restricted","restricted","restricted","restricted",
    "classified","classified","classified","classified",
    "covert","covert","covert","covert"
  ];
  const CATALOG_MARKUP = { mil:1.10, restricted:1.10, classified:1.12, covert:1.15 };
  const seenCatalog = new Set();
  CATALOG_TIERS.forEach((tier, idx)=>{
    let chosen = null;
    for(let tries=0; tries<60 && !chosen; tries++){
      const c = pool[(rndF()*pool.length)|0];
      const pick = shopPickItem(c, tier, rndF);
      if(!pick || pick.tier !== tier) continue;
      const it = pick.it;
      const key = c.id+"|"+pick.tier+"|"+it[0]+"|"+it[1];
      if(seenCatalog.has(key)) continue;
      seenCatalog.add(key);
      chosen = { c, tier: pick.tier, it, key };
    }
    if(!chosen) return;
    const base = itemValue(chosen.c, chosen.tier, chosen.it[0]+"|"+chosen.it[1]);
    const markup = CATALOG_MARKUP[chosen.tier] || 1.12;
    list.push({
      id: "s"+tag+"_"+idx,
      seller: "catalog",
      kind: "weapon",
      catalog: true,
      caseId: chosen.c.id,
      tier: chosen.tier,
      w: chosen.it[0],
      n: chosen.it[1],
      art: chosen.it[2],
      base,
      price: Math.max(1, Math.round(roundNice(base*markup))),
      max: 999999999
    });
  });

  /* 🏷️ Promocje katalogu: 3 z 4 tierów, inna pula co 30 minut.
     Rabat liczymy od ceny katalogowej, więc promocja zawsze jest tańsza
     od ceny regularnej. Limit sztuk (1-3) chroni ekonomię przed
     niekończonym arbitrażem, a aktywne pozycje promocyjne idą na początek listy. */
  const promoTiers = ["mil","restricted","classified","covert"];
  for(let i=promoTiers.length-1; i>0; i--){
    const j = (promoRnd()*(i+1))|0;
    const tmp = promoTiers[i]; promoTiers[i] = promoTiers[j]; promoTiers[j] = tmp;
  }
  promoTiers.slice(0, SHOP_PROMO_COUNT).forEach(tier=>{
    const candidates = list.filter(o=>o.tier===tier);
    if(!candidates.length) return;
    const item = candidates[(promoRnd()*candidates.length)|0];
    const baseDiscount = SHOP_PROMO_MIN_OFF + Math.floor(promoRnd()*(SHOP_PROMO_MAX_OFF - SHOP_PROMO_MIN_OFF + 1));
    const happyOff = shopHappyPromoBonus();
    const discount = Math.min(40, baseDiscount + happyOff);
    const price = Math.max(1, Math.round(roundNice(item.price * (1 - discount/100))));
    /* Limit sztuk zależy od bazowego rabatu — happy hour nie zmienia zapasu. */
    const max = baseDiscount >= 27 ? 1 : baseDiscount >= 24 ? 2 : 3;
    item.promo = { tag:prTag, discount, baseDiscount, happy:happyOff, price, max, key:"p"+prTag+"_"+item.id };
  });
  /* Aktywne promocje zawsze na początek. Wyprzedane pozycje wracają do
     swojego miejsca w katalogu i pokazują tylko znacznik „po promocji”. */
  list.sort((a,b)=>{
    const ap = a.promo && promoLeft(a.promo) > 0 ? 1 : 0;
    const bp = b.promo && promoLeft(b.promo) > 0 ? 1 : 0;
    return bp - ap;
  });

  /* 🎉 Eventy — zawsze broń + skrzynia, kod tylko czasami.
     Losowanie eventów ma własny seed powiązany wyłącznie z czasem (evTag).
     Sklep nie ma ręcznego odświeżania, więc eventy zmieniają się tylko z czasem. */
  const evId = "e"+evTag;
  const evCase = pool[(evRnd()*pool.length)|0];
  const evCaseBase = evCase.price;
  list.push({ id:evId+"_case", seller:"event", kind:"case", event:true, caseId:evCase.id, base:evCaseBase,
              price:Math.max(1, Math.round(roundNice(evCaseBase*(0.76+evRnd()*0.22)))),
              max: 1 + ((evRnd()*3)|0) });

  const evWeaponCase = pool[(evRnd()*pool.length)|0];
  const evTier = pickWeighted({mil:24, restricted:32, classified:26, covert:13, special:5}, evRnd);
  const evPick = shopPickItem(evWeaponCase, evTier, evRnd);
  if(evPick){
    const it = evPick.it;
    const evBase = itemValue(evWeaponCase, evPick.tier, it[0]+"|"+it[1]);
    list.push({ id:evId+"_weapon", seller:"event", kind:"weapon", event:true,
                caseId:evWeaponCase.id, tier:evPick.tier, w:it[0], n:it[1], art:it[2], base:evBase,
                price:Math.max(1, Math.round(roundNice(evBase*(0.72+evRnd()*0.26)))),
                max: 1 + ((evRnd()*3)|0) });
  }

  if(evRnd() < SHOP_EVENT_CODE_CHANCE){
    const codePool = CODES.filter(c=>c.rarity === "rare");
    const def = codePool[(evRnd()*codePool.length)|0];
    const base = def.price;
    list.push({ id:evId+"_code", seller:"event", kind:"code", event:true, codeId:def.id, base,
                price:Math.max(1, Math.round(roundNice(base*(0.82+evRnd()*0.12)))),
                max:1 });
  }

  SHOP_CACHE.tag = cacheKey; SHOP_CACHE.list = list;
  return list;
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

function caseById(id){ return CASES.find(c=>c.id===id); }
function packClaimed(p){
  if(!p) return false;
  if(p.refreshMs) return packRefreshLeft(p) > 0;
  return !!(p.once && state.packClaims && state.packClaims[p.id]);
}
function packRandomCode(){
  const pool = CODES.filter(c=>c.rarity === "rare" && c.id !== "otchlan");
  return pool.length ? pool[(Math.random()*pool.length)|0] : null;
}
function packContents(p){
  const out = {items:[], cases:{}, coins:0, codes:[]};
  if(!p) return out;
  if(p.id === "starter"){
    const starterCase = caseById("start"), prism = caseById("prism");
    out.coins = 2500;
    if(starterCase) out.cases.start = 1;
    if(prism) out.items.push(makeItem(prism, pickTier(prism)));
  } else if(p.id === "bronie"){
    const c = caseById("spectral");
    if(c) for(let i=0;i<3;i++) out.items.push(makeItem(c, pickTier(c)));
  } else if(p.id === "skrzynki"){
    for(let i=0;i<2;i++){
      const id = pickWeighted({prism:55, spectral:35, chroma:10}, Math.random);
      if(caseById(id)) out.cases[id] = (out.cases[id]||0) + 1;
    }
  } else if(p.id === "kolekcjoner"){
    const c = caseById("chroma");
    if(c){ out.items.push(makeItem(c, pickTier(c))); out.cases.chroma = 1; }
    if(Math.random() < PACK_CODE_CHANCE){
      const code = packRandomCode();
      if(code) out.codes.push(code);
    }
  } else if(p.id === "hazard"){
    const c = caseById("spectral");
    const w = {mil:70, restricted:22, classified:6, covert:1.5, special:.5};
    if(c) for(let i=0;i<4;i++) out.items.push(makeItem(c, pickWeighted(w, Math.random)));
  } else if(p.id === "snajper"){
    const c = caseById("chroma");
    if(c) for(let i=0;i<2;i++) out.items.push(makeItem(c, pickTier(c)));
  } else if(p.id === "ostrze"){
    const c = caseById("spectral");
    if(c) out.items.push(makeItem(c, pickWeighted({covert:80, special:20}, Math.random)));
  } else if(p.id === "mieszany"){
    const a = caseById("prism"), b = caseById("spectral");
    if(a) out.items.push(makeItem(a, pickTier(a)));
    if(b) out.items.push(makeItem(b, pickTier(b)));
    const id = pickWeighted({prism:40, spectral:40, chroma:20}, Math.random);
    if(caseById(id)) out.cases[id] = (out.cases[id]||0) + 1;
  } else if(p.id === "kody"){
    const c = caseById("urban");
    if(c) out.items.push(makeItem(c, pickTier(c)));
    if(Math.random() < PACK_CODE_CHANCE_HIGH){
      const code = packRandomCode();
      if(code) out.codes.push(code);
    }
  } else if(p.id === "szczescie"){
    const c = caseById("dragon");
    const w = {mil:20, restricted:30, classified:30, covert:18, special:2};
    if(c) for(let i=0;i<3;i++) out.items.push(makeItem(c, pickWeighted(w, Math.random)));
  } else if(p.id === "figlarz"){
    out.coins = 300 + Math.floor(Math.random()*4700);
    if(caseById("troll")) out.cases.troll = 1;
  }
  return out;
}
function addPackItems(items){
  for(const item of items){
    item.ts = item.ts || Date.now();
    state.inv.unshift(item);
    noteDrop(item);
    albumRegister(item);
  }
}
function packTotals(out){
  const itemVal = out.items.reduce((a,i)=>a + i.value, 0);
  const caseVal = Object.entries(out.cases).reduce((a,[id,n])=>a + casePrice(id)*n, 0);
  return {itemVal, caseVal, total:itemVal + caseVal + out.coins};
}
function packLootHTML(out){
  const rows = [];
  if(out.coins)
    rows.push(`<div class="pack-loot-item coins"><span class="pl-ico">🪙</span><div><b>+${fmt(out.coins)}</b><small>monet od razu</small></div></div>`);
  for(const item of out.items){
    const t = TIER[item.tier] || TIER.mil;
    const f = fxOf(item);
    rows.push(`<div class="pack-loot-item" style="--c:${t.color}">
      <span class="pl-ico">${f ? f.icon : "🔫"}</span>
      <div><b>${esc(item.w)}</b><small>${esc(item.n)} · ${t.name}${f ? " · "+f.name : ""}</small></div>
      <span class="pl-val">🪙 ${fmtShort(item.value)}</span></div>`);
  }
  Object.entries(out.cases).forEach(([id,n])=>{
    const c = caseById(id);
    if(!c) return;
    rows.push(`<div class="pack-loot-item" style="--c:${c.color}">
      <span class="pl-ico">${c.icon}</span>
      <div><b>${esc(c.name)}</b><small>×${n} · trafia do zapasu</small></div>
      <span class="pl-val">🪙 ${fmtShort(casePrice(id)*n)}</span></div>`);
  });
  out.codes.forEach(def=>{
    rows.push(`<div class="pack-loot-item code"><span class="pl-ico">${def.icon}</span>
      <div><b>${esc(def.name)}</b><small>kod · odbierz w zakładce Kody</small></div></div>`);
  });
  return rows.join("");
}
function showPackResult(p,out){
  const el = $("#packResult");
  if(!el) return;
  const v = packTotals(out);
  const net = v.total - p.price;
  const verdict = net > 0 ? "+🪙 "+fmtShort(net)+" · opłaca się"
                : net < 0 ? "−🪙 "+fmtShort(-net)+" · strata"
                : "🪙 0 · na zero";
  const codeNote = out.codes.length
    ? `<div class="pack-code-note">🔑 Bonus: ${out.codes.map(c=>esc(c.name)).join(", ")} — kod nie jest doliczony do wartości, odbierzesz go w Kody.</div>`
    : "";
  el.innerHTML = `<div class="pack-result-box ${net>=0?"pos":"neg"}">
    <div class="pack-result-head">
      <div><span class="pack-result-kicker">🎁 Otworzono pakiet</span><b>${p.icon} ${esc(p.name)}</b></div>
      <span class="pack-verdict ${net>=0?"pos":"neg"}">${verdict}</span>
    </div>
    <div class="pack-loot">${packLootHTML(out)}</div>
    <div class="pack-result-foot">Szacowana wartość: 🪙 ${fmtShort(v.total)}${p.price ? " · cena: 🪙 "+fmtShort(p.price) : " · pakiet darmowy"}</div>
    ${codeNote}
  </div>`;
}
function packHintHTML(){
  const rotLeft = PACK_ROTATE_MS - (Date.now()%PACK_ROTATE_MS);
  const stLeft = packRefreshLeft(PACK_BY_ID.starter);
  return activePacks().length+" pakietów w rotacji · nowe za <b>"+mmss(rotLeft)+"</b> · starter "+
    (stLeft ? "za <b>"+mmss(stLeft)+"</b>" : "<b>gotowy</b>")+" · losowa zawartość";
}
function packCardHTML(p){
  const claimed = packClaimed(p), free = p.price === 0, left = packRefreshLeft(p);
  const tag = free
    ? (p.refreshMs ? (claimed ? "odnowi za "+mmss(left) : "darmowy co 1h") : (claimed ? "odebrany" : "raz na konto"))
    : "bez limitu";
  const btn = claimed
    ? (p.refreshMs ? "⏳ "+mmss(left) : "✔ Odebrany")
    : free ? "Odbierz za darmo" : "Kup i otwórz";
  return `<div class="pack-card${free?" free":""}${claimed?" claimed":""}" data-pack-card="${p.id}" style="--c:${p.color}">
    <div class="pack-badge">${p.badge}${claimed && !p.refreshMs ? " · ODEBRANY" : ""}</div>
    <div class="pack-head">
      <div class="pack-ico">${p.icon}</div>
      <div style="min-width:0"><div class="pack-name">${esc(p.name)}</div>
        <div class="pack-sub">${free ? "prezent odnawialny" : "losowy zestaw"}</div></div>
    </div>
    <div class="pack-desc">${p.desc}</div>
    <div class="pack-meta"><span class="pack-price">${free ? "DARMOWY" : "🪙 "+fmtShort(p.price)}</span>
      <span class="pack-tag" data-pack-tag="${p.id}">${tag}</span></div>
    <button class="pack-buy" data-pack="${p.id}" data-pack-btn="${p.id}" ${claimed?"disabled":""}>${btn}</button>
  </div>`;
}
function renderPacks(){
  const g = $("#packGrid");
  if(!g) return;
  g.innerHTML = activePacks().map(packCardHTML).join("");
  g.classList.add("ready");
  const h = $("#packHint");
  if(h) h.innerHTML = packHintHTML();
}
function updatePackTimers(){
  const st = PACK_BY_ID.starter, left = packRefreshLeft(st);
  const tag = document.querySelector('[data-pack-tag="starter"]');
  if(tag) tag.textContent = left ? "odnowi za "+mmss(left) : "darmowy co 1h";
  const btn = document.querySelector('[data-pack-btn="starter"]');
  if(btn){
    btn.textContent = left ? "⏳ "+mmss(left) : "Odbierz za darmo";
    btn.disabled = left > 0;
  }
  const card = document.querySelector('[data-pack-card="starter"]');
  if(card) card.classList.toggle("claimed", left > 0);
  const h = $("#packHint");
  if(h) h.innerHTML = packHintHTML();
}
function buyPack(id){
  const p = PACK_BY_ID[id];
  if(!p) return;
  if(!activePacks().some(x=>x.id===id)){ sfxErr(); toast("Ten pakiet nie jest dostępny w tej rotacji","bad"); return; }
  state.packClaims = (state.packClaims && typeof state.packClaims === "object" && !Array.isArray(state.packClaims)) ? state.packClaims : {};
  if(p.once && packClaimed(p)){ sfxErr(); toast(p.refreshMs ? "Starter odnowi się za "+mmss(packRefreshLeft(p)) : "Ten pakiet został już odebrany","bad"); return; }
  if(state.coins < p.price){ sfxErr(); toast("Za mało monet na ten pakiet","bad"); return; }

  if(p.price){
    state.coins -= p.price;
    state.stats.spent = numFrom(state.stats.spent) + p.price;
  }
  const out = packContents(p);
  if(out.coins){
    state.coins += out.coins;
    state.stats.earned = numFrom(state.stats.earned) + out.coins;
  }
  addPackItems(out.items);
  Object.entries(out.cases).forEach(([id,n])=>{
    state.caseStock = (state.caseStock && typeof state.caseStock === "object" && !Array.isArray(state.caseStock)) ? state.caseStock : {};
    state.caseStock[id] = caseStock(id) + n;
  });
  out.codes.forEach(def=>{ addCode(def.id, 1); state.stats.codeDrops = numFrom(state.stats.codeDrops) + 1; });
  state.stats.packBuys = numFrom(state.stats.packBuys) + 1;
  state.stats.packSpent = numFrom(state.stats.packSpent) + p.price;
  if(p.once) state.packClaims[p.id] = p.refreshMs ? Date.now() : true;

  markDirty(); save({kind:"pack"});
  sfxCoin();
  toast("🎁 Otwarto <b>"+esc(p.name)+"</b> — wynik zobaczysz pod pakietami.", "good");
  renderBalance(); renderInv(); renderShop(); renderStats(); renderCodes(); renderMarket(true);
  showPackResult(p, out);
  checkAchievements();
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

function updateShopHappy(){
  const el = $("#shopHappy");
  if(!el) return;
  const active = shopHappyActive();
  const type = active ? shopHappyType() : ((shopHappyCycle()+1) % 2 ? "sell" : "promo");
  const isSell = type === "sell";
  const left = shopHappyLeft();
  el.className = "shop-happy show"+(active ? " on" : "")+(isSell ? " sell" : " promo");
  const copy = active
    ? (isSell
        ? "<b>+10% do sprzedaży</b> — każdy sprzedany przedmiot płaci więcej."
        : "<b>+5% do promocji</b> — dodatkowy rabat na 3 oferty katalogu.")
    : "następna okazja: "+(isSell ? "sprzedaż +10%" : "promocje +5%")+".";
  el.innerHTML = `<span class="hh-badge">⏰ HAPPY HOUR</span><span class="hh-copy">${copy}</span>
    <span class="hh-time">${active ? "kończy się za" : "start za"} <b>${timeLeftLong(left)}</b></span>`;
}
function shopTick(){
  renderCaseBadge();
  updateShopHappy();
  const offers = shopOffers();
  const catalog = offers.filter(o=>o.seller!=="event");
  const available = catalog.filter(o=>shopLeft(o)>0).length;
  const promos = catalog.filter(o=>o.promo);
  const activePromos = promos.filter(o=>promoLeft(o.promo)>0).length;
  const h = $("#marketHint");
  if(h) h.innerHTML = "stały katalog · <b>"+available+"</b> "+
    plural(available,"produkt","produkty","produktów")+" · <b>"+activePromos+"</b> "+
    plural(activePromos,"promocja","promocje","promocji")+" · odświeżenie za <b>"+
    mmss(SHOP_PROMO_TTL - (Date.now()%SHOP_PROMO_TTL))+"</b>";
  const badge = $("#shopCount");
  if(badge){
    badge.textContent = activePromos ? String(activePromos) : "";
    badge.style.display = activePromos ? "" : "none";
  }
  const eh = $("#eventHint");
  if(eh){
    const code = offers.find(o=>o.seller==="event" && o.kind==="code");
    eh.innerHTML = "rotacja za <b>"+mmss(SHOP_TTL - (Date.now()%SHOP_TTL))+"</b> · " +
      (code ? (shopLeft(code)>0 ? "🔑 <b>kod dostępny!</b>" : "🔑 kod wykupiony") : "🔑 kod: brak w tej rotacji");
  }
  fxEventTick();
}

function shopCatalogHTML(o, i){
  const t = TIER[o.tier] || TIER.mil;
  const c = CASES.find(x=>x.id===o.caseId);
  const promo = o.promo;
  const pLeft = promo ? promoLeft(promo) : 0;
  const promoOn = !!(promo && pLeft > 0);
  const priceNow = promoOn ? promo.price : o.price;
  const sellNow = itemSell({value:o.base});
  const profitNow = sellNow - priceNow;
  const profitPct = Math.round((sellNow/Math.max(1,priceNow) - 1)*100);
  const profitPctTxt = (profitPct > 0 ? "+" : "") + profitPct + "%";
  const profitCls = profitNow > 0 ? "good" : profitNow < 0 ? "bad" : "even";
  const priceHTML = promoOn
    ? `<span class="sp-price promo" title="🪙 ${fmt(promo.price)}">🪙 ${fmtShort(promo.price)}</span>
       <span class="sp-old" title="🪙 ${fmt(o.price)}">🪙 ${fmtShort(o.price)}</span>
       <span class="sp-promo" title="Rabat ${promo.discount}%${promo.happy ? " (w tym +"+promo.happy+"% happy hour)" : ""}">-${promo.discount}%${promo.happy ? " ⏰" : ""}</span>`
    : `<span class="sp-price" title="🪙 ${fmt(o.price)}">🪙 ${fmtShort(o.price)}</span> ` +
      (promo ? `<span class="sp-promo over" title="Promocja wyprzedana — obowiązuje cena regularna">po promocji</span>` : `<span class="sp-fixed">cena stała</span>`);
  return `<div class="shop-product${promoOn?" promo":""}" style="--c:${t.color};animation-delay:${i*35}ms">
    <div class="sp-art">${weaponSVG({w:o.w,n:o.n,tier:o.tier,art:o.art}, hash(o.id).toString(36))}</div>
    <div class="sp-main">
      <div class="sp-tier">${esc(t.name)}</div>
      <div class="sp-name">${esc(o.n)}</div>
      <div class="sp-weapon">${esc(o.w)}${c ? " · "+esc(c.name) : ""}</div>
      <div class="sp-meta">${priceHTML}</div>
      ${promoOn ? `<div class="sp-stock">zostało ${pLeft} z ${promo.max}</div>` : ""}
    </div>
    <button class="btn primary sp-buy" data-shopbuy="${o.id}"${promoOn?' data-promo="1"':''} title="Kup ${esc(o.n)} za 🪙 ${fmt(priceNow)}${promoOn?" (promocja)":""}">Kup</button>
    <div class="sp-profit" title="Po sprzedaży z obecnymi ulepszeniami: 🪙 ${fmt(sellNow)} · wynik: ${profitPctTxt}">
      <span>po sprzedaży: 🪙 ${fmtShort(sellNow)}</span>
      <b class="${profitCls}">${profitPctTxt}</b>
    </div>
  </div>`;
}

function renderMarket(force){
  const g = $("#shopGrid"); if(!g) return;
  if(currentView !== "market" && !force){ shopTick(); return; }
  const offers = shopOffers();
  const renderedTag = SHOP_CACHE.tag;
  g.innerHTML = offers.filter(o=>o.seller!=="event").map(shopCatalogHTML).join("");
  g.classList.add("ready");
  const ev = $("#eventGrid");
  if(ev){
    ev.innerHTML = offers.filter(o=>o.seller==="event").map(eventOfferHTML).join("");
    ev.classList.add("ready");
  }
  renderPacks();
  renderFxEvents();
  shopTick();
  SHOP_CACHE.rendered = renderedTag;
}

function buyShopOffer(id, promo){
  const off = shopOffers().find(o=>o.id===id);
  if(!off) return;
  if(off.kind === "code" && !CODE_BY_ID[off.codeId]) return;
  if(shopLeft(off) <= 0){ sfxErr(); toast("Ta oferta została już wykupiona","bad"); return; }
  const promoOn = !!(promo && off.promo && promoLeft(off.promo) > 0);
  const price = promoOn ? off.promo.price : off.price;
  const stockKey = promoOn ? off.promo.key : off.id;
  if(state.coins < price){ sfxErr(); toast("Za mało monet!","bad"); return; }

  state.coins -= price;
  state.stats.spent += price;
  state.stats.shopBuys = numFrom(state.stats.shopBuys) + 1;
  state.stats.shopSpent = numFrom(state.stats.shopSpent) + price;
  trackHappyPurchase(off, promoOn, price);
  shopStockMap()[stockKey] = numFrom(shopStockMap()[stockKey]) + 1;

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
    if(promoOn){
      const diff = Math.round((price/Math.max(1,off.base) - 1)*100);
      if(diff < 0) state.stats.bestDeal = Math.min(100, Math.max(numFrom(state.stats.bestDeal), -diff));
      sfxCoin();
      toast("🏷️ <b>Promocja -"+off.promo.discount+"%!</b> Kupiono <b>"+esc(item.n)+"</b> ("+esc(item.w)+") za 🪙 "+
        fmt(price)+" — normalnie 🪙 "+fmt(off.price)+".","good");
    } else if(off.catalog){
      sfxCoin();
      toast("🛒 Kupiono <b>"+esc(item.n)+"</b> ("+esc(item.w)+") za 🪙 "+fmt(price)+
        " — cena stała, przedmiot czeka w ekwipunku.","good");
    } else {
      const diff = Math.round((price/Math.max(1,off.base) - 1)*100);
      if(diff < 0) state.stats.bestDeal = Math.min(100, Math.max(numFrom(state.stats.bestDeal), -diff));
      sfxCoin();
      toast((diff<=0 ? "🏷️ <b>Okazja!</b> " : "🛒 Kupiono ")+"<b>"+esc(item.n)+"</b> ("+esc(item.w)+") za 🪙 "+
        fmt(price)+(diff<0 ? " · "+(-diff)+"% taniej" : diff>0 ? " · +"+diff+"% drożej" : " · cena rynkowa"),"good");
    }
  }
  markDirty(); save();
  /* Po zakupie odśwież listę, żeby wyprzedana promocja wróciła na swoje
     miejsce w katalogu, a aktywne okazje zostały na początku. */
  SHOP_CACHE.tag = "";
  renderBalance(); renderMarket(true); renderShop(); renderInv(); renderStats();
  checkAchievements();
}

$("#view-market").addEventListener("click", e=>{
  const pk = e.target.closest("[data-pack]");
  if(pk){ buyPack(pk.dataset.pack); return; }
  const fx = e.target.closest("[data-fxevent]");
  if(fx){ buyFxEvent(fx.dataset.fxevent); return; }
  const b = e.target.closest("[data-shopbuy]");
  if(b) buyShopOffer(b.dataset.shopbuy, b.dataset.promo === "1");
});
let SHOP_HAPPY_UI_TAG = shopHappyTag();
let PACK_UI_CYCLE = packCycle();
setInterval(()=>{
  const happyTag = shopHappyTag();
  if(happyTag !== SHOP_HAPPY_UI_TAG){
    SHOP_HAPPY_UI_TAG = happyTag;
    /* Sprzedaż +10% działa od razu; odświeżamy widoczne ceny w ekwipunku. */
    if(currentView === "market") renderMarket();
    else if(currentView === "inv" && typeof renderInv === "function") renderInv();
  }
  if(currentView !== "market") return;
  const pc = packCycle();
  if(pc !== PACK_UI_CYCLE){
    PACK_UI_CYCLE = pc;
    renderPacks();
  } else {
    updatePackTimers();
  }
  if(SHOP_CACHE.rendered !== shopCacheKey()) renderMarket();
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
  const upDisc = typeof upDiscountText === "function" ? upDiscountText() : "";
  const sbText = typeof sellBoostText === "function" ? sellBoostText() : "";
  $("#upHint").innerHTML = "Kupione poziomy: <b>"+done+" / "+all+"</b> &nbsp;·&nbsp; 🔪 Łowca Noży podnosi szansę na ★ &nbsp;·&nbsp; 🎯 Szczęście działa tylko na Ciebie" +
    (upDisc ? " &nbsp;·&nbsp; <b style='color:#fbbf24'>"+upDisc+"</b>" : "") +
    (sbText ? " &nbsp;·&nbsp; <b style='color:#34d399'>"+sbText+"</b>" : "");
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
function doOpen(c, free, opts){
  opts = opts || {};
  const paid = free ? 0 : c.price;
  state.coins -= paid;
  state.stats.spent += paid;
  state.stats.opened++;
  state.stats.cases[c.id] = (state.stats.cases[c.id]||0)+1;
  missionTrack("open",1,{caseId:c.id});
  missionTrack("opencase:"+c.id, 1);
  missionTrack("spend", paid);
  if(cloverActive()) missionTrack("cloveropen",1);
  if(c.troll) return trollDrop(c);
  if(c.eventOnly){
    const pick = eventCasePick(c, opts.eventFirst);
    return obtainDrop(c, pick.tier, pick.item);   // drop zapisuje się od razu
  }
  return obtainDrop(c, pickTier(c));   // drop zapisuje się od razu
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
  if(c.eventOnly && !useStock){
    sfxErr();
    toast("Limitowaną skrzynkę eventową otworzysz tylko z zapasu odebranego z aktywnego eventu.","bad");
    return;
  }
  const eventFirst = c.eventOnly && !numFrom(state.stats.cases && state.stats.cases[c.id]);
  const free = useStock || Math.random() < couponChance();
  if(!free && state.coins < c.price){ sfxErr(); toast("Za mało monet!","bad"); return; }
  if(useStock){
    state.caseStock[c.id] = stock - 1;
    if(!state.caseStock[c.id]) delete state.caseStock[c.id];
    state.stats.stockOpened = numFrom(state.stats.stockOpened) + 1;
    if(c.suitcase) state.stats.suitcaseOpens = numFrom(state.stats.suitcaseOpens) + 1;
  }

  spinning = true;                        // blokada na czas animacji skrzynki
  if(useStock) toast((c.suitcase ? "🧳 <b>Otwierasz walizkę</b> — bez opłat. Zostało: " : "📦 <b>Otwierasz z zapasu</b> — bez opłat. Zostało: ")+caseStock(c.id),"good");
  else if(free) toast("🎟️ <b>Kupon!</b> Otwarcie nic Cię nie kosztowało","good");
  const win = doOpen(c, free, {eventFirst});   // addToInv/saveDrop już utrwalił drop i statystyki
  renderBalance(); renderShop(); renderBots();

  /* Troll nie ma puli broni, więc nie budujemy roulette’a z przedmiotów —
     wynik (monety) pokazujemy od razu. Walizki zawsze dostają animację,
     nawet gdy włączony jest tryb szybki. */
  if (c.troll || (!c.suitcase && (state.fast || state.perfMode))){ spinning = false; showResult([win], true); return; }

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
  $("#spinTag").textContent = fromStock ? (c.suitcase ? "🧳 WALIZKA" : "📦 ZAPAS") : free ? "🎟️ DARMOWE" : "🪙 " + fmtShort(c.price);
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
  else {
    if(win) toast("Zachowano <b>"+esc(win.n)+"</b> w ekwipunku","good");
    renderInv();
  }
}
function finishSpin(){ endSpin(true); }
$("#skipBtn").addEventListener("click", ()=>endSpin(true));
$("#spinClose").addEventListener("click", ()=>endSpin(false));

/* Hurtowe otwarcie zwykłej skrzynki — jedno zbiorcze dodanie do ekwipunku,
   jeden zapis i jedna feta za koniczyny/kody. Dzięki temu ×10 000 nie robi
   dziesięciu tysięcy pełnych zapisów localStorage. */
function bulkItemDrops(c, count){
  const wins = [];
  let cloverHits = 0;
  const codeDrops = [];
  for(let i=0;i<count;i++){
    const win = makeItem(c, pickTier(c));
    if(rollClover()) cloverHits++;
    const code = rollCodeDrop(true);
    if(code){ win.codeDrop = code; codeDrops.push(code); }
    wins.push(win);
  }
  // Najnowsze na początku, jak przy pojedynczym addToInv().
  state.inv = wins.slice().reverse().concat(state.inv);
  wins.forEach(win=>{ noteDrop(win); albumRegister(win); });
  if(cloverHits){
    missionTrack("clover", cloverHits);
    sfxClover();
    confetti(["#4ade80","#a8f0c0","#22c55e","#ffd700"]);
    toast("🍀 <b>Koniczyna ×"+cloverHits+"!</b> Wypadła przy hurtowym otwieraniu — sprawdź czas działania pod licznikiem.","good");
    updateClover();
  }
  if(codeDrops.length){
    codeDrops.forEach(d=>addCode(d.id, 1));
    state.stats.codeDrops = numFrom(state.stats.codeDrops) + codeDrops.length;
    renderCodeBadge();
    sfxCode();
    const uniq = [...new Set(codeDrops.map(d=>d.id))].map(id=>CODE_BY_ID[id]).filter(Boolean);
    toast("🔑 <b>KODY ×"+codeDrops.length+"!</b> "+uniq.map(d=>d.icon+" "+esc(d.name)).join(" · ")+" — odbierzesz je w zakładce <b>Kody</b>.","good");
  }
  markDirty();
  save({kind: codeDrops.length ? "code" : "drop"});
  checkAchievements();
  return {wins, cloverHits, codeDrops};
}

/* MAX powyżej bezpiecznego limitu: otwiera WSZYSTKO, ale zamiast dokładać
   setki tysięcy przedmiotów do zapisu, po każdej paczce zostawia BULK_KEEP
   najcenniejszych, a resztę natychmiast sprzedaje. Dzięki temu cała kasa
   zostaje wydana, a ekwipunek i localStorage pozostają bezpieczne. */
function bulkMaxStream(c, count, done){
  const keep = [];
  let idx = 0, cloverHits = 0, soldN = 0, soldCoins = 0;
  const codeDrops = [];
  const troll = !!c.troll;
  /* Pasek postępu — bez tego długie MAX-otwieranie wygląda jak zawieszenie gry. */
  const overlay = document.createElement("div");
  overlay.className = "bulk-progress";
  overlay.innerHTML = `<div class="bp-box"><b class="bp-title">⚡ MAX · otwieranie skrzynek</b>
    <div class="bp-bar"><i></i></div><span class="bp-txt">0 / ${fmt(count)}</span></div>`;
  document.body.appendChild(overlay);
  const bar = overlay.querySelector("i"), txt = overlay.querySelector(".bp-txt");

  function step(){
    const end = Math.min(count, idx + BULK_STREAM_CHUNK);
    const batch = [];
    for(; idx < end; idx++){
      if(troll){ trollDrop(c, true); continue; }
      const win = makeItem(c, pickTier(c));
      if(rollClover()) cloverHits++;
      const code = rollCodeDrop(true);
      if(code){ win.codeDrop = code; codeDrops.push(code); }
      noteDrop(win); albumRegister(win);
      batch.push(win);
    }
    if(!troll){
      const pool = batch.concat(keep).sort((a,b)=>numFrom(b.value)-numFrom(a.value));
      keep.length = 0;
      for(let i=0;i<Math.min(BULK_KEEP,pool.length);i++) keep.push(pool[i]);
      const sold = pool.slice(BULK_KEEP);
      let chunkSold = 0;
      for(const it of sold){ const price=itemSell(it); state.coins+=price; soldCoins+=price; chunkSold+=price; soldN++; }
      if(sold.length){
        state.stats.earned += chunkSold;
        state.stats.sold += sold.length;
        trackHappySale(sold);
        missionTrack("sell", sold.length);
        missionTrack("sellvalue", chunkSold);
      }
    }
    const pct = Math.round(idx/count*100);
    if(bar) bar.style.width = pct+"%";
    if(txt) txt.textContent = fmt(idx)+" / "+fmt(count)+" · "+pct+"%";
    if(idx < count){ setTimeout(step, 0); return; }

    overlay.remove();
    if(cloverHits){
      missionTrack("clover", cloverHits);
      if(typeof updateClover === "function") updateClover();
      sfxClover();
      toast("🍀 <b>Koniczyna ×"+cloverHits+"!</b> Wypadła przy MAX-otwieraniu.","good");
    }
    if(codeDrops.length){
      codeDrops.forEach(d=>addCode(d.id, 1));
      state.stats.codeDrops = numFrom(state.stats.codeDrops) + codeDrops.length;
      if(typeof renderCodeBadge === "function") renderCodeBadge();
    }
    if(!troll && keep.length) state.inv = keep.slice().reverse().concat(state.inv);
    markDirty(); save({kind:"drop"}); checkAchievements();
    spinning = false;
    done({wins:keep.slice(0,BULK_RESULT_CARDS), kept:keep.length, soldN, soldCoins});
  }
  setTimeout(step, 0);
}

function openMany(caseId, requested){
  if(spinning) return;
  const c = CASES.find(x=>x.id===caseId);
  if(!c) return;
  if(c.eventOnly){
    sfxErr();
    toast("Limitowaną skrzynkę eventową otwierasz pojedynczo — jedna sztuka na otwarcie.","bad");
    return;
  }
  const stock = caseStock(c.id);
  let count;
  if(requested === "max"){
    count = bulkMaxFor(c);
    if(count <= 0){
      sfxErr();
      toast("Brak monet lub zapasu na hurtowe otwarcie.","bad");
      return;
    }
  } else {
    count = Math.max(0, Math.floor(Number(requested) || 0));
    if(count <= 0) return;
    count = Math.min(count, BULK_HARD_CAP);
  }
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
  const unit = bulkUnit(c);                                // rabat z ulepszenia "Hurt"
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

  /* MAX powyżej limitu licuje się w tle z paskiem postępu — bez zawieszania gry. */
  if(count > BULK_HARD_CAP){
    spinning = true;
    if(useStock) toast("📦 <b>"+useStock+"×</b> z zapasu — bez opłat","good");
    if(freeN) toast("🎟️ <b>Kupony!</b> " + freeN + " z " + rest + " płatnych otwarć darmowych","good");
    bulkMaxStream(c, count, stream=>{
      toast("⚡ <b>MAX:</b> otwarto "+fmt(count)+" skrzynek · w ekwipunku "+fmt(stream.kept)
        +" najlepszych · sprzedano "+fmt(stream.soldN)+" za 🪙 "+fmtShort(stream.soldCoins),"good");
      renderBalance(); renderShop(); renderBots(); renderInv(); renderStats();
      showResult(stream.wins, false);
    });
    return;
  }

  let wins;
  if(c.troll){
    wins = [];
    for(let i=0;i<count;i++) wins.push(trollDrop(c, true));
    markDirty();
    save({kind:"drop"});
    checkAchievements();
  } else {
    wins = bulkItemDrops(c, count).wins;
  }
  if(useStock) toast("📦 <b>"+useStock+"×</b> z zapasu — bez opłat","good");
  if(freeN) toast("🎟️ <b>Kupony!</b> " + freeN + " z " + rest + " płatnych otwarć darmowych","good");
  renderBalance(); renderShop(); renderBots(); renderInv(); renderStats();
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
  if(c.eventOnly){ sfxErr(); toast("Limitowanej skrzynki eventowej nie da się otwierać automatycznie.","bad"); return; }
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
  if(!c || c.eventOnly){ autoStop(c && c.eventOnly ? "skrzynka eventowa tylko ręcznie" : ""); return; }
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
/* 🏆 Drop, który pobił poprzedni rekord wartości. Trzymamy go tylko do
   wyświetlenia wyniku — nie zapisujemy dodatkowych pól w ekwipunku. */
const RECORD_DROPS = new Map();
function noteDrop(item){
  item.ts = item.ts || Date.now();
  state.recent.unshift({w:item.w,n:item.n,tier:item.tier,value:item.value,uid:item.uid,ts:item.ts,fx:item.fx||null});
  state.recent = state.recent.slice(0,24);
  if(item.tier==="special"){ state.stats.knives++; missionTrack("knife",1); }
  if(item.tier==="gloves"){ state.stats.gloves = numFrom(state.stats.gloves) + 1; missionTrack("gloves",1); }
  if(item.tier==="relic"){ state.stats.relics = numFrom(state.stats.relics) + 1; missionTrack("relic",1); }
  if(item.tier==="covert" || item.tier==="special" || item.tier==="gloves") missionTrack("covert",1);
  if(item.fx){                                  // ✨ rzadki efekt — liczymy do statystyk
    const st = state.stats;
    st.fx = (st.fx && typeof st.fx === "object" && !Array.isArray(st.fx)) ? st.fx : {};
    st.fx[item.fx] = numFrom(st.fx[item.fx]) + 1;
    st.fxTotal = numFrom(st.fxTotal) + 1;
    missionTrack("fx", 1);                      // 📅 misje tygodniowe na efekty
    const fxDef = FX_BY_ID[item.fx] || EVENT_FX_BY_ID[item.fx];
    if(fxDef && fxDef.mult >= FX_BIG) missionTrack("fxbig", 1);
  }
  const prevBest = state.stats.best;
  const value = numFrom(item.value);
  if(prevBest && value > numFrom(prevBest.value)){
    RECORD_DROPS.set(item.uid, {prev:{...prevBest}, item});
    if(RECORD_DROPS.size > 60){
      const oldest = RECORD_DROPS.keys().next().value;
      RECORD_DROPS.delete(oldest);
    }
  }
  if(!prevBest || value > numFrom(prevBest.value))
    state.stats.best = {w:item.w,n:item.n,tier:item.tier,value,fx:item.fx||null};
}

/* 🤡 Skrzynka Troll — monety zamiast przedmiotu. Jackpot trafia od razu na konto. */
function trollDrop(c, defer){
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
  if(!defer){
    markDirty();
    save({kind:"drop"});     // jackpot / 1 moneta zapisane od razu
    checkAchievements();
  }
  return win;
}

/* 🎟️ limitowana skrzynka eventowa: pierwsze otwarcie wybiera nową broń
   z puli (z zachowaniem wag tierów), kolejne — zwykłe szanse. */
function eventCasePick(c, first){
  if(first){
    const owned = new Set(state.inv.map(i=>i.w+"|"+i.n));
    const avail = TIERS.filter(t=>(c.items[t]||[]).some(it=>!owned.has(it[0]+"|"+it[1])));
    if(avail.length){
      const o = oddsFor(c);
      let total = avail.reduce((a,t)=>a+(o[t]||0),0);
      let r = Math.random()*total, tier = avail[0];
      for(const t of avail){
        r -= (o[t]||0);
        if(r <= 0){ tier = t; break; }
      }
      const pool = c.items[tier].filter(it=>!owned.has(it[0]+"|"+it[1]));
      if(pool.length) return {tier, item:pool[Math.floor(Math.random()*pool.length)], guaranteed:true};
    }
  }
  const tier = pickTier(c);
  const pool = c.items[tier] || c.items.mil;
  return {tier, item:pool[Math.floor(Math.random()*pool.length)]};
}

/* obsługa zdobytego przedmiotu: trafia do ekwipunku i jest od razu zapisany */
function obtainDrop(c, tier, forced){
  const win = makeItem(c, tier, forced);
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
  const foil = (item.tier==="special"||item.tier==="gloves"||item.tier==="covert"||item.tier==="relic") ? '<div class="art-foil"></div>' : "";
  return `<div class="item-card tier-${item.tier}${fxClass(item)} ${extra||""}" style="--c:${t.color}${f?";--fx:"+f.color:""}" data-uid="${item.uid}">
    ${foil}
    ${f?'<div class="fx-shine"></div>':""}
    ${item.tier==="special" ? '<span class="star">★</span>' : item.tier==="gloves" ? '<span class="star glove-star">🧤</span>' : item.tier==="relic" ? '<span class="star relic-star">✦</span>' : ""}
    ${fxBadge(item)}
    <div class="item-art">${weaponSVG(item, h.toString(36))}</div>
    <div class="item-body">
      <div class="item-weapon">${esc(item.w)}</div>
      <div class="item-skin">${esc(item.n)}</div>
      <div class="item-foot">
        <span class="item-tier">${item.tier==="special"?"★ Special":item.tier==="gloves"?"🧤 Rękawice":item.tier==="relic"?"✦ Relikt":t.name}</span>
        <span class="item-price">🪙 ${fmtShort(item.value)}</span>
      </div>
    </div>
  </div>`;
}
const HIGH_VALUE_SELL = 50000;   // od tej wartości sprzedaż wymaga potwierdzenia
function isInvFav(uid){ return !!(state.fav && state.fav[uid]); }
function invDupKey(item){ return [item.tier, item.w, item.n].join("|"); }
function invDupCounts(inv){
  const counts = {};
  (inv || []).forEach(i=>{ const k = invDupKey(i); counts[k] = (counts[k] || 0) + 1; });
  return counts;
}
function invCardHTML(item, i){
  const f = fxOf(item);
  const fav = isInvFav(item.uid);
  return `<div class="item-card tier-${item.tier}${fxClass(item)}${fav?" fav":""}" style="--c:${TIER[item.tier].color}${f?";--fx:"+f.color:""};animation-delay:${Math.min(i*22,420)}ms" data-uid="${item.uid}">
    ${(item.tier==="special"||item.tier==="gloves"||item.tier==="covert"||item.tier==="relic") ? '<div class="art-foil"></div>' : ""}
    ${f?'<div class="fx-shine"></div>':""}
    ${item.tier==="special" ? '<span class="star">★</span>' : item.tier==="gloves" ? '<span class="star glove-star">🧤</span>' : item.tier==="relic" ? '<span class="star relic-star">✦</span>' : ""}
    ${fxBadge(item)}
    <button class="item-fav${fav?" on":""}" data-fav="${item.uid}" title="${fav?"Usuń z ulubionych":"Dodaj do ulubionych — ochrona przed sprzedażą"}" aria-label="${fav?"Usuń z ulubionych":"Dodaj do ulubionych"}">${fav?"♥":"♡"}</button>
    <div class="item-art">${weaponSVG(item, hash(item.uid).toString(36))}</div>
    <div class="item-body">
      <div class="item-weapon">${esc(item.w)}</div>
      <div class="item-skin">${esc(item.n)}</div>
      <div class="item-foot">
        <span class="item-tier">${item.tier==="special"?"★ Special":item.tier==="gloves"?"🧤 Rękawice":item.tier==="relic"?"✦ Relikt":TIER[item.tier].name}</span>
        <span class="item-price">🪙 ${fmtShort(item.value)}</span>
      </div>
    </div>
    <div class="sell-hint">${fav?"ULUBIONY":"SPRZEDAJ"}<b title="🪙 ${fmt(itemSell(item))}">🪙 ${fmtShort(itemSell(item))}</b></div>
  </div>`;
}

const INV_RENDER_STEP = 300;
let invRenderLimit = INV_RENDER_STEP;

function renderInvSuitcases(){
  const wrap = $("#invSuitWrap"), host = $("#invSuitcases");
  if(!wrap || !host) return;
  const list = CASES.filter(c=>c.suitcase && caseStock(c.id)>0);
  wrap.hidden = !list.length;
  if(!list.length){ host.innerHTML = ""; return; }
  host.innerHTML = list.map(c=>{
    const n = caseStock(c.id);
    return `<div class="suit-card" data-suitcase="${c.id}" style="--c:${c.color}">
      <div class="suit-ico">${c.icon}</div>
      <div class="suit-main">
        <div class="suit-name">${esc(c.name)}</div>
        <div class="suit-sub">${esc(c.sub || "Rzadka walizka z bazaru botów")}</div>
      </div>
      <div class="suit-count">×${fmt(n)}</div>
      <button class="btn gold suit-open" data-open-suit="${c.id}">Otwórz</button>
    </div>`;
  }).join("");
}

function renderInv(){
  const inv = state.inv;
  const suitN = CASES.reduce((a,c)=>a+(c.suitcase ? caseStock(c.id) : 0), 0);
  const invBadge = $("#invCount");
  if(invBadge){
    const n = inv.length + suitN;
    invBadge.textContent = n ? String(n) : "";
    invBadge.style.display = n ? "" : "none";
  }
  $("#invTotal").textContent = inv.length;
  const suitPill = $("#invSuitPill"), suitTotal = $("#invSuitTotal");
  if(suitPill && suitTotal){
    suitTotal.textContent = String(suitN);
    suitPill.hidden = !suitN;
  }
  /* Gdy ekwipunek jest schowany, nie budujemy setek kart w tle. */
  if(currentView !== "inv") return;
  renderInvSuitcases();
  $("#invValue").textContent = "🪙 " + fmtShort(inv.reduce((s,i)=>s+i.value,0));

  let list = inv.slice();
  const f = $("#invFilter").value;
  const dupCounts = invDupCounts(inv);
  if(f==="fav") list = list.filter(i=>isInvFav(i.uid));
  else if(f==="dupes") list = list.filter(i=>dupCounts[invDupKey(i)] > 1);
  else if(f!=="all") list = list.filter(i=>i.tier===f);
  const q = String(($("#invSearch") && $("#invSearch").value) || "").trim().toLowerCase();
  if(q){
    list = list.filter(i=>{
      const hay = [i.w, i.n, i.caseId].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  const s = $("#invSort").value;
  if(s==="value") list.sort((a,b)=>b.value-a.value);
  else if(s==="rarity") list.sort((a,b)=>TIERS.indexOf(b.tier)-TIERS.indexOf(a.tier)||b.value-a.value);
  else if(s==="name") list.sort((a,b)=>String(a.n||"").localeCompare(String(b.n||""),"pl") || String(a.w||"").localeCompare(String(b.w||""),"pl"));
  else list.sort((a,b)=>b.ts-a.ts);

  if(!list.length){
    const empty = q ? "Brak przedmiotów pasujących do <b>„"+esc(q)+"”</b>."
      : f==="fav" ? "Nie masz jeszcze ulubionych przedmiotów. Kliknij ♡ na karcie, aby dodać ochronę."
      : f==="dupes" ? "Brak duplikatów w ekwipunku."
      : inv.length ? "Brak przedmiotów w tym filtrze."
      : suitN ? "Masz tylko walizki — otwórz je powyżej, żeby zdobyć przedmioty."
      : "Ekwipunek jest pusty.<br>Otwórz skrzynkę, żeby coś zdobyć!";
    $("#invGrid").innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="big">📦</span>${empty}</div>`;
    return;
  }
  const shown = list.slice(0, invRenderLimit);
  $("#invGrid").innerHTML = shown.map(invCardHTML).join("") +
    (list.length > shown.length
      ? `<div class="inv-more"><button class="btn primary" data-inv-more="1">Pokaż więcej (${fmt(shown.length)} / ${fmt(list.length)})</button></div>`
      : "");
}

function sellItem(uid, force){
  const idx = state.inv.findIndex(i=>i.uid===uid);
  if(idx<0) return false;
  if(isInvFav(uid) && !force){
    sfxErr();
    toast("♥ Ten przedmiot jest ulubiony — odznacz serce, aby go sprzedać.","bad");
    return false;
  }
  const it = state.inv[idx], price = itemSell(it);
  /* Dodatkowe zabezpieczenie dla sprzedaży z okna wyniku i innych miejsc:
     drogi przedmiot zawsze wymaga potwierdzenia. */
  if(!force && it.value >= HIGH_VALUE_SELL){
    const prefix = it.tier==="special" ? "★ " : it.tier==="gloves" ? "🧤 " : it.tier==="relic" ? "❖ " : "";
    if(!confirm("Sprzedać "+prefix+it.n+" ("+it.w+") za "+fmt(price)+" monet?")) return false;
  }
  state.inv.splice(idx,1);
  if(state.fav) delete state.fav[uid];
  state.coins += price; state.stats.earned += price; state.stats.sold++;
  trackHappySale([it]);
  missionTrack("sell",1);
  missionTrack("sellvalue", price);
  sfxCoin(); renderBalance(); renderInv(); renderShop(); save();
  if(typeof checkAchievements === "function") checkAchievements();
  toast("Sprzedano <b>"+esc(it.n)+"</b> za 🪙 "+fmt(price),"good");
  return true;
}
function toggleInvFav(uid){
  if(!state.fav || typeof state.fav !== "object") state.fav = {};
  if(state.fav[uid]) delete state.fav[uid];
  else state.fav[uid] = true;
  markDirty(); save(); renderInv();
  toast(state.fav[uid] ? "♥ Dodano do ulubionych — ochrona przed sprzedażą." : "♡ Usunięto z ulubionych.", "good");
}
$("#invSuitcases").addEventListener("click", e=>{
  const b = e.target.closest("[data-open-suit]");
  if(!b) return;
  e.preventDefault();
  openCase(b.dataset.openSuit, b.closest(".suit-card"), true);
});
$("#invGrid").addEventListener("click", e=>{
  const fav = e.target.closest("[data-fav]");
  if(fav){ e.preventDefault(); e.stopPropagation(); toggleInvFav(fav.dataset.fav); return; }
  const more = e.target.closest("[data-inv-more]");
  if(more){ invRenderLimit += INV_RENDER_STEP; renderInv(); return; }
  const card = e.target.closest("[data-uid]");
  if(!card) return;
  const it = state.inv.find(i=>i.uid===card.dataset.uid);
  if(!it) return;
  if(isInvFav(it.uid)){
    const prefix = it.tier==="special" ? "★ " : it.tier==="gloves" ? "🧤 " : it.tier==="relic" ? "❖ " : "";
    if(!confirm("♥ Ulubiony przedmiot!\n\nSprzedać "+prefix+it.n+" ("+it.w+") za "+fmt(itemSell(it))+" monet?")) return;
  } else if(it.value >= HIGH_VALUE_SELL){
    const prefix = it.tier==="special" ? "★ " : it.tier==="gloves" ? "🧤 " : it.tier==="relic" ? "❖ " : "";
    if(!confirm("Sprzedać "+prefix+it.n+" ("+it.w+") za "+fmt(itemSell(it))+" monet?")) return;
  }
  sellItem(card.dataset.uid, true);
});
$("#invFilter").addEventListener("change", ()=>{ invRenderLimit = INV_RENDER_STEP; renderInv(); if(typeof writeUiPrefs === "function") writeUiPrefs(); });
$("#invSort").addEventListener("change", ()=>{ invRenderLimit = INV_RENDER_STEP; renderInv(); if(typeof writeUiPrefs === "function") writeUiPrefs(); });
let invSearchTimer = null;
$("#invSearch").addEventListener("input", e=>{
  if(typeof writeUiPrefs === "function") writeUiPrefs();
  clearTimeout(invSearchTimer);
  invSearchTimer = setTimeout(()=>{
    invRenderLimit = INV_RENDER_STEP;
    renderInv();
  }, 120);
});
$("#sellAll").addEventListener("click", ()=>{
  if(!state.inv.length){ toast("Ekwipunek jest pusty","bad"); return; }
  const toSell = state.inv.filter(i=>!isInvFav(i.uid));
  if(!toSell.length){ toast("Wszystkie przedmioty są ulubione — nic nie sprzedano.","bad"); return; }
  const gain = toSell.reduce((s,i)=>s+itemSell(i),0);
  const skipped = state.inv.length - toSell.length;
  if(!confirm("Sprzedać WSZYSTKIE przedmioty ("+toSell.length+") za 🪙 "+fmt(gain)+"?"+
      (skipped ? "\n\n♥ Pominięto ulubione: "+skipped+" szt." : ""))) return;
  const ids = new Set(toSell.map(i=>i.uid));
  state.inv = state.inv.filter(i=>!ids.has(i.uid));
  if(state.fav) toSell.forEach(i=>{ delete state.fav[i.uid]; });
  state.coins += gain; state.stats.earned += gain; state.stats.sold += toSell.length;
  trackHappySale(toSell);
  missionTrack("sell", toSell.length);
  missionTrack("sellvalue", gain);
  sfxCoin(); renderBalance(); renderInv(); renderShop(); save();
  if(typeof checkAchievements === "function") checkAchievements();
  toast("Sprzedano "+toSell.length+" szt. za 🪙 "+fmt(gain)+(skipped?" · ♥ pominięto "+skipped:""),"good");
});
$("#sellCheap").addEventListener("click", ()=>{
  const v = prompt("Sprzedaj wszystkie przedmioty o wartości poniżej (🪙):","500");
  if(v===null) return;
  const th = Number(String(v).replace(/[^\d.]/g,""));
  if(!th || th<=0) return;
  const toSell = state.inv.filter(i=>i.value<th && !isInvFav(i.uid));
  if(!toSell.length){ toast("Brak przedmiotów poniżej 🪙 "+fmt(th)+" (ulubione są chronione).","bad"); return; }
  const gain = toSell.reduce((s,i)=>s+itemSell(i),0);
  const ids = new Set(toSell.map(i=>i.uid));
  state.inv = state.inv.filter(i=>!ids.has(i.uid));
  if(state.fav) toSell.forEach(i=>{ delete state.fav[i.uid]; });
  state.coins += gain; state.stats.earned += gain; state.stats.sold += toSell.length;
  trackHappySale(toSell);
  missionTrack("sell", toSell.length);
  missionTrack("sellvalue", gain);
  sfxCoin(); renderBalance(); renderInv(); renderShop(); save(); checkAchievements();
  toast("Sprzedano "+toSell.length+" szt. za 🪙 "+fmt(gain),"good");
});
$("#sellDupes").addEventListener("click", ()=>{
  const groups = {};
  state.inv.forEach(i=>{ const k = invDupKey(i); (groups[k] = groups[k] || []).push(i); });
  const toSell = [];
  Object.keys(groups).forEach(k=>{
    const list = groups[k];
    if(list.length < 2) return;
    const favs = list.filter(i=>isInvFav(i.uid));
    if(favs.length){
      list.forEach(i=>{ if(!isInvFav(i.uid)) toSell.push(i); });
    } else {
      const keep = list.slice().sort((a,b)=>b.value-a.value || b.ts-a.ts)[0];
      list.forEach(i=>{ if(i.uid !== keep.uid) toSell.push(i); });
    }
  });
  if(!toSell.length){ toast("Brak duplikatów do sprzedaży (ulubione zostają).","bad"); return; }
  const gain = toSell.reduce((s,i)=>s+itemSell(i),0);
  if(!confirm("Sprzedać duplikaty ("+toSell.length+" szt.) za 🪙 "+fmt(gain)+"?\n\nZ każdej pary/kompletu zostaje po jednym egzemplarzu, a ulubione są chronione.")) return;
  const ids = new Set(toSell.map(i=>i.uid));
  state.inv = state.inv.filter(i=>!ids.has(i.uid));
  if(state.fav) toSell.forEach(i=>{ delete state.fav[i.uid]; });
  state.coins += gain; state.stats.earned += gain; state.stats.sold += toSell.length;
  trackHappySale(toSell);
  missionTrack("sell", toSell.length);
  missionTrack("sellvalue", gain);
  sfxCoin(); renderBalance(); renderInv(); renderShop(); save(); checkAchievements();
  toast("Sprzedano "+toSell.length+" duplikatów za 🪙 "+fmt(gain),"good");
});

/* =======================================================================
   11. WYNIK
   ======================================================================= */
let bulkSellBatch = null;

function bulkSummaryChips(items){
  const counts = {};
  items.forEach(i=>{ counts[i.tier] = (counts[i.tier]||0)+1; });
  return TIERS.filter(t=>counts[t]).map(t=>{
    const name = t==="special" ? "★ Noże" : t==="gloves" ? "🧤 Rękawice" : t==="relic" ? "✦ Relikty" : TIER[t].name;
    return `<span class="bulk-tier" style="--c:${TIER[t].color}">${name} <b>${fmt(counts[t])}</b></span>`;
  }).join("");
}

function bulkResultCelebrate(best, codeDrops){
  if(!best) return;
  const bf = fxOf(best);
  sfxWin(best.tier, bf ? bf.id : null);
  if(best.tier==="relic"){ confetti(["#fff7d6","#ffe9a8","#ffb02e","#ffffff"]); setTimeout(confetti,260); setTimeout(confetti,520); shakeScreen(); }
  else if(best.tier==="gloves"){ confetti(["#ff9f1c","#ffd6a0","#ff7ab6","#ffffff"]); setTimeout(confetti,300); shakeScreen(); }
  else if(best.tier==="special"){ confetti(["#ffd700","#fff3b0","#ffb02e","#ffffff"]); setTimeout(confetti,320); shakeScreen(); }
  else if(best.tier==="covert"){ confetti(["#eb4b4b","#ff9a9a","#ffd700","#ffffff"]); shakeScreen(); }
  else if(best.tier==="classified"){ confetti([TIER.classified.color,"#ffffff","#c77dff"]); }
  if(bf){
    setTimeout(()=>confetti([bf.color,"#ffffff",bf.color]), 120);
    if(bf.mult >= FX_BIG){ setTimeout(confetti, 380); setTimeout(confetti, 640); shakeScreen(); }
  }
  if(codeDrops && codeDrops.length){
    setTimeout(()=>confetti(["#a855f7","#ffd76a","#ffffff"]), 180);
    setTimeout(()=>confetti(["#22d3ee","#a855f7","#f43f5e"]), 430);
  }
}

/* 🏆 Efekt nowego rekordu — pełnoekranowa feta z porównaniem dropów. */
let recordFxTimer = null;
function hideRecordFx(){
  const ov = $("#recordOverlay");
  if(!ov) return;
  ov.classList.remove("show");
  ov.setAttribute("aria-hidden","true");
  if(recordFxTimer){ clearTimeout(recordFxTimer); recordFxTimer = null; }
  const sparks = $("#recordSparks");
  if(sparks) sparks.innerHTML = "";
}
function recordDropFor(items){
  return (items || []).map(i=>RECORD_DROPS.get(i.uid)).filter(Boolean)
    .sort((a,b)=>numFrom(b.item.value)-numFrom(a.item.value))[0] || null;
}
function showRecordFx(rec){
  const ov = $("#recordOverlay");
  if(!ov || !rec || !rec.item || !rec.prev) return;
  const item = rec.item, prev = rec.prev;
  const cmp = $("#recordCompare");
  if(cmp){
    const prevName = [prev.w, prev.n].filter(Boolean).join(" | ") || "Poprzedni drop";
    const newName = [item.w, item.n].filter(Boolean).join(" | ") || "Nowy drop";
    cmp.innerHTML = `
      <span class="rc-prev"><small>POPRZEDNI REKORD</small><b>${esc(prevName)}</b><em>🪙 ${fmtShort(prev.value)}</em></span>
      <span class="rc-arrow">→</span>
      <span class="rc-now"><small>NOWY REKORD</small><b>${esc(newName)}</b><em>🪙 ${fmtShort(item.value)}</em></span>`;
  }
  const sparks = $("#recordSparks");
  if(sparks){
    sparks.innerHTML = "";
    if(!state.perfMode && state.fxParticles !== false && state.reduceMotion !== true){
      for(let i=0;i<28;i++){
        const s = document.createElement("i");
        const a = Math.random()*Math.PI*2;
        const d = 120 + Math.random()*420;
        s.style.cssText = `--a:${a}rad;--d:${d}px;--delay:${(Math.random()*0.35).toFixed(2)}s;--size:${(3+Math.random()*7).toFixed(1)}px;--c:${pick(["#ffd166","#fff3b0","#ffb02e","#ffffff","#a855f7"])}`;
        sparks.appendChild(s);
      }
    }
  }
  ov.classList.remove("show");
  void ov.offsetWidth;
  ov.classList.add("show");
  ov.setAttribute("aria-hidden","false");
  if(recordFxTimer) clearTimeout(recordFxTimer);
  recordFxTimer = setTimeout(()=>{
    ov.classList.remove("show");
    ov.setAttribute("aria-hidden","true");
    if(sparks) sparks.innerHTML = "";
    recordFxTimer = null;
  }, 3600);
  setTimeout(()=>{ if(typeof sfxRecord === "function") sfxRecord(); }, 260);
  if(typeof burst === "function"){
    burst(window.innerWidth/2, window.innerHeight*0.42, "#ffd166");
    setTimeout(()=>burst(window.innerWidth/2, window.innerHeight*0.42, "#ffffff"), 120);
  }
  confetti(["#ffd166","#fff3b0","#ffb02e","#ffffff","#a855f7"]);
  setTimeout(()=>confetti(["#ffd166","#ffffff"]), 260);
  shakeScreen();
  RECORD_DROPS.delete(item.uid);
}

/* Podsumowanie dużego otwarcia — nie wrzucamy tysięcy kart do DOM. */
function showBulkResult(items){
  hideRecordFx();
  const trollMode = items.length && items.every(i=>i.trollCoins);
  const sorted = items.slice().sort((a,b)=>TIERS.indexOf(b.tier)-TIERS.indexOf(a.tier)||b.value-a.value);
  const best = sorted[0];

  if(trollMode){
    bulkSellBatch = null;
    const total = items.reduce((s,i)=>s+(i.trollCoins||0),0);
    const jackpots = items.filter(i=>i.trollJackpot).length;
    const caseId = items[0].caseId;
    $("#resTitle").textContent = "Skrzynka Troll ×"+items.length;
    $("#resBody").innerHTML = `
      <div class="bulk-summary troll">
        <div class="bulk-hero">🪙 ${fmt(total)}</div>
        <div class="bulk-sub">Łączny łup z <b>${fmt(items.length)}</b> otwarć · jackpoty: <b>${fmt(jackpots)}</b></div>
        <div class="bulk-chips">
          <span class="bulk-tier" style="--c:#fbbf24">JACKPOT <b>${fmt(jackpots)}</b></span>
          <span class="bulk-tier" style="--c:#94a3b8">1 MONETA <b>${fmt(items.length-jackpots)}</b></span>
        </div>
      </div>
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

  bulkSellBatch = items.map(i=>i.uid);
  const totalVal = items.reduce((s,i)=>s+i.value,0);
  const totalSell = items.reduce((s,i)=>s+itemSell(i),0);
  const fxs = items.filter(i=>i.fx).length;
  const codeDrops = items.map(i=>i.codeDrop).filter(Boolean);
  const codeUnique = [...new Map(codeDrops.map(d=>[d.id,d])).values()];
  const top = sorted.slice(0,12);
  $("#resTitle").textContent = "Wynik hurtowy ×"+items.length;
  $("#resBody").innerHTML = `
    <div class="bulk-summary">
      <div class="bulk-hero">🪙 ${fmtShort(totalVal)}</div>
      <div class="bulk-sub">Łączna wartość <b>${fmt(items.length)}</b> przedmiotów · sprzedaż: <b style="color:var(--ok)">🪙 ${fmtShort(totalSell)}</b>${fxs?` · ✨ ${fmt(fxs)} efektów`:""}</div>
      <div class="bulk-chips">${bulkSummaryChips(items)}</div>
    </div>
    <div class="bulk-note">Pokazano <b>${top.length}</b> najlepszych z <b>${fmt(items.length)}</b> dropów. Wszystkie są już w ekwipunku.</div>
    <div class="multi-grid bulk-top">${top.map(i=>itemCardHTML(i)).join("")}</div>
    ${codeDrops.length?`<div class="result-code">🔑 <b>DODATKOWE KODY ×${codeDrops.length}!</b> ${codeUnique.map(c=>c.icon+" "+esc(c.name)+" ("+esc(c.code)+")").join(" · ")}
      <button class="btn" data-go-codes="1">Przejdź do kodów</button></div>`:""}
    <div class="result-actions">
      <button class="btn gold" data-sell-bulk="1" title="🪙 ${fmt(totalSell)}">Sprzedaj wszystko (🪙 ${fmtShort(totalSell)})</button>
      <button class="btn" data-keep="1">Zatrzymaj</button>
    </div>`;
  $("#resultOverlay").classList.add("show");
  bulkResultCelebrate(best, codeDrops);
  const rec = recordDropFor(items);
  if(rec) setTimeout(()=>{ if($("#resultOverlay").classList.contains("show")) showRecordFx(rec); }, 520);
}

function showResult(items, single){
  hideRecordFx();
  renderInv();
  if(items.length > BULK_RESULT_CARDS){ showBulkResult(items); return; }
  bulkSellBatch = null;
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
  const hasGloves = items.some(i=>i.tier==="gloves");
  const hasRelic = items.some(i=>i.tier==="relic");
  const ids = items.map(i=>i.uid);
  $("#resTitle").textContent = single ? "Zdobyty przedmiot" : "Wynik otwarcia ×"+items.length;

  if(single){
    const it = items[0];
    const big = it.tier==="special"||it.tier==="gloves"||it.tier==="covert"||it.tier==="classified"||it.tier==="relic";
    const f = fxOf(it);
    const cdef = CASES.find(c=>c.id===it.caseId);
    const codeDrop = it.codeDrop || null;
    $("#resBody").innerHTML = `
      <div class="rare-banner ${(hasKnife||hasGloves||hasRelic)?"show":""}">${hasRelic?"✦ RELIKT ZNALEZIONY ✦":hasGloves?"🧤 RĘKAWICE ZNALEZIONE 🧤":"★ RZADKI SPECJALNY DROP ★"}</div>
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
  else if(best.tier==="gloves"){ confetti(["#ff9f1c","#ffd6a0","#ff7ab6","#ffffff"]); setTimeout(confetti,300); shakeScreen(); }
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
  const rec = recordDropFor(items);
  if(rec) setTimeout(()=>{ if($("#resultOverlay").classList.contains("show")) showRecordFx(rec); }, 520);
}

function shakeScreen(){
  if(state.perfMode || state.screenShake === false) return;
  const p = $("#resultPanel");
  p.classList.remove("shake"); void p.offsetWidth; p.classList.add("shake");
}

$("#resBody").addEventListener("click", e=>{
  const one = e.target.closest("[data-sell-one]");
  const many = e.target.closest("[data-sell-many]");
  const bulk = e.target.closest("[data-sell-bulk]");
  const keep = e.target.closest("[data-keep]");
  const again = e.target.closest("[data-again]");
  const goCodes = e.target.closest("[data-go-codes]");
  if(one || many || bulk || keep || again || goCodes) hideRecordFx();
  if(goCodes){ bulkSellBatch = null; $("#resultOverlay").classList.remove("show"); switchView("codes"); return; }
  if(bulk){
    const ids = new Set(bulkSellBatch || []);
    const sold = state.inv.filter(i=>ids.has(i.uid));
    const gain = sold.reduce((s,i)=>s+itemSell(i),0);
    state.inv = state.inv.filter(i=>!ids.has(i.uid));
    state.coins += gain; state.stats.earned += gain; state.stats.sold += sold.length;
    trackHappySale(sold);
    missionTrack("sell", sold.length);
    missionTrack("sellvalue", gain);
    bulkSellBatch = null;
    sfxCoin(); renderBalance(); renderShop(); renderInv(); save();
    if(typeof checkAchievements === "function") checkAchievements();
    $("#resultOverlay").classList.remove("show");
    toast("Sprzedano "+sold.length+" przedmiotów za 🪙 "+fmt(gain),"good");
    return;
  }
  if(one){ bulkSellBatch = null; sellItem(one.dataset.sellOne); $("#resultOverlay").classList.remove("show"); renderShop(); renderInv(); }
  if(many){
    const ids = many.dataset.sellMany.split(",");
    let gain = 0, n = 0;
    const sold = [];
    ids.forEach(uid=>{ const i = state.inv.findIndex(x=>x.uid===uid);
      if(i>=0){ const it = state.inv[i]; gain += itemSell(it); sold.push(it); state.inv.splice(i,1); n++; } });
    state.coins += gain; state.stats.earned += gain; state.stats.sold += n;
    trackHappySale(sold);
    missionTrack("sell", n);
    missionTrack("sellvalue", gain);
    bulkSellBatch = null;
    sfxCoin(); renderBalance(); renderShop(); renderInv(); save();
    if(typeof checkAchievements === "function") checkAchievements();
    $("#resultOverlay").classList.remove("show");
    toast("Sprzedano "+n+" przedmiotów za 🪙 "+fmt(gain),"good");
  }
  if(keep){ bulkSellBatch = null; $("#resultOverlay").classList.remove("show"); renderShop(); renderInv(); }
  if(again){ bulkSellBatch = null; $("#resultOverlay").classList.remove("show"); openCase(again.dataset.again); }
});
$("#resClose").addEventListener("click", ()=>{ bulkSellBatch = null; hideRecordFx(); $("#resultOverlay").classList.remove("show"); renderShop(); renderInv(); });