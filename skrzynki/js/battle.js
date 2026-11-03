"use strict";

/* =======================================================================
   11b. BITWY NA SKRZYNKI — 1 vs 1 z AI, zwycięzca bierze oba dropy
   ======================================================================= */
let battleBusy = false, battleStage = 0, battleCtx = null, battleTimers = [];
let autoBattle = false, autoTimer = null;    // 🔁 auto-walka (patrz sekcja 11c)
const BATTLE_SIZES = [1,2,3,5];              // ile skrzynek na stronę
const battleSize = () => BATTLE_SIZES.includes(state.battleSize) ? state.battleSize : 1;
const sumVal = arr => arr.reduce((s,i)=>s+i.value, 0);
const bestOf = arr => arr.slice().sort((a,b)=>b.value-a.value)[0];
/* odmiana: 1 skrzynka / 2 skrzynki / 5 skrzynek */
function plural(n, one, few, many){
  const d = n % 10, dd = n % 100;
  if(n === 1) return one;
  if(d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
}

/* AI losuje na bazowych szansach (bez ulepszeń) — dzięki temu 🎯 Szczęście
   daje graczowi realną przewagę, zamiast działać dla obu stron. */
function aiPickTier(caseDef){
  const o = baseOdds(caseDef);
  const r = Math.random(); let acc = 0;
  for (const t of TIERS){ acc += o[t]||0; if(r<acc) return t; }
  return "mil";
}
/* Porównanie dwóch ZESTAWÓW dropów: najpierw suma wartości, przy remisie
   najlepszy tier, na końcu suma tierów. 1 = wygrywa a, -1 = b, 0 = remis. */
function battleCompare(a, b){
  const sa = sumVal(a), sb = sumVal(b);
  if(sa !== sb) return sa > sb ? 1 : -1;
  const ta = Math.max(...a.map(i=>TIERS.indexOf(i.tier)));
  const tb = Math.max(...b.map(i=>TIERS.indexOf(i.tier)));
  if(ta !== tb) return ta > tb ? 1 : -1;
  const ra = a.reduce((s,i)=>s+TIERS.indexOf(i.tier), 0);
  const rb = b.reduce((s,i)=>s+TIERS.indexOf(i.tier), 0);
  if(ra !== rb) return ra > rb ? 1 : -1;
  return 0;
}

/* Koszt wejścia do bitwy. Perk 📦 Hurt daje rabat przy 5 skrzynkach. */
function battleCost(c){
  const n = battleSize();
  const disc = n >= 5 ? bulkRate() : 0;
  const unit = Math.round(c.price * (1 - disc));
  return { n, unit, disc, total: unit * n };
}

let lastBattlePickSig = "";
function renderBattle(){
  const pick = $("#battlePick");
  if(!pick) return;
  const st = state.stats, nb = st.battles|0, nw = st.battleWins|0;
  const bl = upLvl("battle");
  $("#battleHint").innerHTML = (nb
    ? `wygrane: <b>${nw} / ${nb}</b> (${Math.round(nw/nb*100)}%)`
    : "kto lepszy zestaw dropów, ten bierze wszystko") +
    (bl ? ` &nbsp;·&nbsp; ⚔️ Wojownik: +${Math.round(BATTLE_STEP*bl*100)}% wartości wygranych` : "");
  const badge = $("#battleCount");
  if(badge){ badge.textContent = nb ? String(nb) : ""; badge.style.display = nb ? "" : "none"; }

  const battleCases = CASES.filter(c=>!c.botOnly && !c.noBattle);
  const sel = battleCases.find(x=>x.id===state.battleCase) || battleCases[0];
  const n = battleSize();
  const pickSig = battleCases.map(c=>c.id).join("|") + "|" + sel.id + "|" + n;
  if(pickSig !== lastBattlePickSig){
    lastBattlePickSig = pickSig;
    pick.innerHTML = battleCases.map(c=>`
      <button class="bch ${c.id===sel.id?"active":""} tier-${caseTier(c)}" data-skin="${c.id}" data-bcase="${c.id}" style="--cc:${c.color}">
        <span class="pat"></span>
        <span class="bch-ico">${c.icon}</span>
        <span class="bch-nm">${esc(c.name)}</span>
        <span class="bch-pr">🪙 ${fmtShort(c.price)}</span>
      </button>`).join("");

    $("#battleSize").innerHTML = BATTLE_SIZES.map(k=>
      `<button class="bs-opt ${k===n?"active":""}" data-bsize="${k}" title="Bitwa ${k} na ${k} — po ${k} skrzynek na stronę">${k}×</button>`).join("");
  }

  const { unit, disc, total } = battleCost(sel);
  $("#battleSizeNote").innerHTML = n > 1
    ? `<b>${n} ${plural(n,"skrzynka","skrzynki","skrzynek")}</b> na stronę po 🪙 ${fmtShort(unit)} → razem <b title="🪙 ${fmt(total)}">🪙 ${fmtShort(total)}</b>` +
      (disc ? ` &nbsp;·&nbsp; 📦 rabat −${Math.round(disc*100)}%` : "")
    : "";

  const can = state.coins >= total;
  $("#fightBtn").disabled = !can;
  $("#battleCost").innerHTML = can
    ? `Wchodzisz: <b>${n}× ${esc(sel.name)}</b> za 🪙 <b title="🪙 ${fmt(total)}">${fmtShort(total)}</b>` +
      (n>1 ? ` <span class="muted">(🪙 ${fmtShort(unit)} / szt.)</span>` : "") +
      `<br><span class="muted">Wygrywasz → bierzesz wszystkie ${2*n} ${plural(2*n,"drop","dropy","dropów")}. Przegrywasz lub remisujesz → tracisz wkład.</span>`
    : `<span style="color:#ff6b6b">Brakuje 🪙 ${fmtShort(total - state.coins)}, żeby wejść do bitwy o ${esc(sel.name)} ×${n}.</span>`;

  // 🔁 auto-walka nie może działać, jeśli nie stać Cię na kolejne wejście
  if(autoBattle && !can){
    setAuto(false, true);
    toast("🔁 <b>Auto-walka zatrzymana</b> — brakuje 🪙 "+fmt(total - state.coins)+" na kolejną bitwę.","bad");
  }
  autoBtnLabel();

  renderBattleLog();
}

function renderBattleLog(){
  const el = $("#battleLog");
  if(!el) return;
  if(!state.battles.length){
    el.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="big">⚔️</span>Jeszcze nie stoczyłeś żadnej bitwy.</div>`;
    return;
  }
  const side = (tier, name, val, n) =>
    `<i style="color:${TIER[tier].color}">${tier==="special"?"★":"◆"}</i>${esc(name)}` +
    (n>1 ? `<em class="b-sum">Σ 🪙 ${fmtShort(val||0)}</em>` : "");
  el.innerHTML = state.battles.map((b,i)=>{
    const n = b.n||1;
    const net = b.win ? "+🪙 "+fmtShort(b.gain) : "−🪙 "+fmtShort(b.cost);
    return `<div class="blog ${b.draw?"draw":b.win?"win":"lose"}" style="animation-delay:${i*40}ms">
      <span class="blog-res">${b.draw?"🤝":b.win?"🏆":"💀"}</span>
      <span class="blog-case">${esc(b.cn)}${n>1?`<b class="xtimes">×${n}</b>`:""}</span>
      <span class="blog-side">${side(b.mt, b.mn, b.mval, n)}</span>
      <span class="blog-vs">VS</span>
      <span class="blog-side ai">${side(b.at, b.an, b.aval, n)}</span>
      <span class="blog-net ${b.draw?"":b.win?"pos":"neg"}">${net}</span>
    </div>`;
  }).join("");
}

function clearBattleTimers(){ battleTimers.forEach(clearTimeout); battleTimers = []; }

function fight(caseId){
  if(battleBusy || battleStage) return;
  const c = CASES.find(x=>x.id===caseId);
  if(!c) return;
  const { n, total } = battleCost(c);
  if(state.coins < total){
    sfxErr();
    toast(`Za mało monet — na bitwę ×${n} potrzebujesz 🪙 ${fmt(total)}.`,"bad");
    return;
  }
  battleBusy = true;

  const my = [], ai = [];                      // po n dropów na stronę
  for(let i=0;i<n;i++){
    my.push(makeItem(c, pickTier(c)));         // gracz — z ulepszeniami
    ai.push(makeItem(c, aiPickTier(c)));       // AI — na bazowych szansach
  }
  const bl = upLvl("battle");                  // ⚔️ Wojownik — cenniejsze WYGRANE, nie łatwiejsza wygrana
  const res = battleCompare(my, ai);            // porównanie na bazowych wartościach

  state.coins -= total;
  state.stats.spent += total;
  state.stats.battles = (state.stats.battles|0) + 1;
  missionTrack("battle",1);
  missionTrack("spend", total);

  let gain = 0;
  if(res > 0){                                 // wygrana: wszystkie dropy do ekwipunku
    state.stats.battleWins = (state.stats.battleWins|0) + 1;
    missionTrack("win",1);
    if(n === 5) missionTrack("winbig",1);
    if(autoBattle) missionTrack("autowin",1);
    if(bl) my.forEach(it=>{ it.value = Math.round(it.value * (1 + BATTLE_STEP*bl)); });
    my.forEach(addToInv); ai.forEach(addToInv);
    gain = sumVal(my) + sumVal(ai);
    missionTrack("battleearn", gain);
  }
  // Remis i przegrana nie oddają stawki — inaczej bitwa byłaby opłacalniejsza
  // niż zwykłe otwieranie (darmowa pula przy identycznym zestawie dropów).

  const bm = bestOf(my), ba = bestOf(ai);
  state.battles.unshift({
    win: res>0, draw: res===0, cn: c.name, n, cost: total, gain, ts: Date.now(),
    mt: bm.tier, mn: bm.w + " · " + bm.n, mval: sumVal(my),
    at: ba.tier, an: ba.w + " · " + ba.n, aval: sumVal(ai)
  });
  state.battles = state.battles.slice(0,8);

  markDirty(); renderBalance(); save();
  renderShop(); renderInv(); renderStats();
  showBattle(my, ai, res, c);
}

function showBattle(my, ai, res, c){
  clearBattleTimers();
  const n = my.length;
  battleStage = 0; battleCtx = { my, ai, res, c, n };

  const multi = n > 1;
  $("#battleOverlay").querySelector(".arena").classList.toggle("multi", multi);
  $("#battleOverlay").querySelector(".panel").classList.toggle("wide", multi);

  $("#battleTag").textContent = multi ? `${c.name} ×${n}` : c.name;
  ["#fighterMe","#fighterAi"].forEach(s=>{ $(s).className = "fighter"; });
  ["#slotMe","#slotAi","#valMe","#valAi"].forEach(s=>{ $(s).innerHTML = ""; });
  $("#battleBanner").className = "battle-banner"; $("#battleBanner").innerHTML = "";
  $("#battleActions").innerHTML = "";
  $("#battleOverlay").classList.add("show");

  battleTimers.push(setTimeout(()=>battleStep(1), 560));
  battleTimers.push(setTimeout(()=>battleStep(2), multi ? 1700 : 1320));
  battleTimers.push(setTimeout(()=>battleStep(3), multi ? 2750 : 2100));
}

/* Etapy pokazywane po kolei — dzięki temu "Pomiń" może je odtworzyć od razu. */
function battleStep(k){
  if(!battleCtx || battleStage >= k) return;
  battleStage = k;
  const { my, ai, res, c, n } = battleCtx;
  const multi = n > 1;
  const bl = upLvl("battle");

  const paint = (slotSel, valSel, arr, who) => {
    const host = $(slotSel);
    if(multi){
      host.innerHTML = `<div class="cards">${arr.map(it=>itemCardHTML(it)).join("")}</div>`;
      $$(slotSel+" .item-card").forEach((el,i)=>{ el.style.animationDelay = (i*120)+"ms"; });
      const bs = bestOf(arr);
      $(valSel).innerHTML =
        `<b style="color:var(--acc)" title="🪙 ${fmt(sumVal(arr))}">🪙 ${fmtShort(sumVal(arr))}</b><span>${n} ${plural(n,"skrzynka","skrzynki","skrzynek")} · najlepsze:
          <b style="color:${TIER[bs.tier].color};display:inline">${bs.tier==="special"?"★ ":""}${esc(bs.w)} · ${esc(bs.n)}</b></span>`;
    } else {
      const it = arr[0];
      host.innerHTML = itemCardHTML(it);
      $(valSel).innerHTML =
        `<span style="color:${TIER[it.tier].color}">${it.tier==="special"?"★ ":""}${esc(it.w)} · ${esc(it.n)}</span><b style="color:var(--acc)" title="🪙 ${fmt(it.value)}">🪙 ${fmtShort(it.value)}</b>`;
    }
    $("#fighter"+who).classList.add("revealed");
    sfxWin(bestOf(arr).tier);
  };

  if(k === 1){ paint("#slotMe", "#valMe", my, "Me"); return; }
  if(k === 2){ paint("#slotAi", "#valAi", ai, "Ai"); return; }

  // etap 3 — rozstrzygnięcie
  const ban = $("#battleBanner");
  if(res > 0){
    $("#fighterMe").classList.add("win");
    $("#fighterAi").classList.add("lose");
    ban.className = "battle-banner win";
    ban.innerHTML = `🏆 WYGRYWASZ! Bierzesz wszystko (${2*n} ${plural(2*n,"przedmiot","przedmioty","przedmiotów")})` +
      (bl ? `<span style="display:block;font-size:11px;font-weight:800;opacity:.85;margin-top:5px">⚔️ Wojownik: +${Math.round(BATTLE_STEP*bl*100)}% wartości Twoich wygranych</span>` : "");
    confetti(); sfxCoin();
  } else if(res < 0){
    $("#fighterAi").classList.add("win");
    $("#fighterMe").classList.add("lose");
    ban.className = "battle-banner lose";
    ban.innerHTML = `💀 PRZEGRYWASZ — wszystkie dropy przechodzą do AI`;
    sfxErr();
  } else {
    ban.className = "battle-banner draw";
    ban.innerHTML = `🤝 REMIS — pula przepada`;
    sfxErr();
  }
  $("#battleActions").innerHTML =
    `<button class="btn primary" id="fightAgain">⚔️ Walcz ponownie (🪙 ${fmtShort(c.price*(n>=5?(1-bulkRate()):1)*n)})</button>
     <button class="btn" id="battleKeep">Zamknij</button>`;
  $("#fightAgain").addEventListener("click", ()=>{
    $("#battleOverlay").classList.remove("show");
    battleStage = 0; battleCtx = null; battleBusy = false;
    fight(c.id);
  });
  $("#battleKeep").addEventListener("click", ()=>closeBattle());

  // 🔁 auto-walka: po pokazaniu wyniku sama rusza następna bitwa
  autoSchedule(n);
}

function battleSkip(){
  clearBattleTimers();
  battleStep(1); battleStep(2); battleStep(3);
}
function closeBattle(){
  if(autoTimer){ clearTimeout(autoTimer); autoTimer = null; }
  clearBattleTimers();
  $("#battleOverlay").classList.remove("show");
  battleStage = 0; battleCtx = null; battleBusy = false;
  if(autoBattle){ setAuto(false, true); toast("🔁 Auto-walka zatrzymana."); }
  renderBattle();
}
$("#battleClose").addEventListener("click", ()=>{ if(battleStage < 3) battleSkip(); else closeBattle(); });
$("#battlePick").addEventListener("click", e=>{
  const b = e.target.closest("[data-bcase]");
  if(!b) return;
  state.battleCase = b.dataset.bcase;
  markDirty(); renderBattle(); save();
});
$("#battleSize").addEventListener("click", e=>{
  const b = e.target.closest("[data-bsize]");
  if(!b) return;
  state.battleSize = parseInt(b.dataset.bsize,10) || 1;
  markDirty(); renderBattle(); save();
});
$("#fightBtn").addEventListener("click", ()=>fight(state.battleCase));

/* =======================================================================
   11c. 🔁 AUTO-WALKA — walczysz non stop wybraną skrzynką i rozmiarem
   Włączasz raz, bitwy lecą jedna po drugiej, dopóki starcza monet.
   Tryb działa tylko w tej sesji (celowo nie zapisujemy go w savie, żeby
   gra nie zaczęła sama walczyć po odświeżeniu strony).
   ======================================================================= */
const AUTO_WAIT = {1:1700, 2:2200, 3:2500, 5:3000};   // pauza na przeczytanie wyniku (ms)

function autoBtnLabel(){
  const b = $("#autoBtn");
  if(!b) return;
  b.classList.toggle("on", autoBattle);
  b.textContent = autoBattle ? "🔁 Auto-walka: WŁ" : "🔁 Auto-walka";
  b.title = autoBattle
    ? "Auto-walka działa — kliknij, żeby zatrzymać"
    : "Walcz automatycznie non stop: wybierz skrzynkę i rozmiar, a bitwy pójdą same";
}

function setAuto(on, silent){
  autoBattle = !!on;
  if(!autoBattle && autoTimer){ clearTimeout(autoTimer); autoTimer = null; }
  autoBtnLabel();
  renderBattle();
  if(!silent && !autoBattle) toast("🔁 Auto-walka wyłączona.");
}

/* jedna bitwa kończy się → po chwili ruszamy następną */
function autoNext(){
  if(!autoBattle) return;
  const battleCases = CASES.filter(x=>!x.botOnly && !x.noBattle);
  const c = battleCases.find(x=>x.id===state.battleCase) || battleCases[0];
  const { total, n } = battleCost(c);
  if(state.coins < total){
    setAuto(false, true);
    sfxErr();
    toast("🔁 <b>Auto-walka zatrzymana</b> — brakuje 🪙 "+fmt(total)+" na "+esc(c.name)+" ×"+n+".","bad");
    return;
  }
  clearBattleTimers();
  battleStage = 0; battleCtx = null; battleBusy = false;
  fight(c.id);                 // nakładka zostaje otwarta — bez migotania
}

/* zaplanuj kolejną bitwę (wołane po pokazaniu wyniku) */
function autoSchedule(n){
  if(!autoBattle) return;
  if(autoTimer) clearTimeout(autoTimer);
  autoTimer = setTimeout(()=>{ autoTimer = null; autoNext(); }, AUTO_WAIT[n] || 1900);
}

$("#bossBtn").addEventListener("click", ()=>{ const b=BOSSES[Math.floor(Math.random()*BOSSES.length)]; fightBoss(b.id); });
  $("#kohBtn").addEventListener("click", playKoh);
  $("#cosGrid").addEventListener("click", e=>{ const b=e.target.closest("[data-cos]"); if(b) buyCosmetic(b.dataset.cos); });
  $("#autoBtn").addEventListener("click", ()=>{
  if(autoBattle){ setAuto(false); return; }
  const battleCases = CASES.filter(x=>!x.botOnly && !x.noBattle);
  const c = battleCases.find(x=>x.id===state.battleCase) || battleCases[0];
  const { total, n } = battleCost(c);
  if(state.coins < total){
    sfxErr();
    toast("Za mało monet — na bitwę ×"+n+" o "+esc(c.name)+" potrzebujesz 🪙 "+fmt(total)+".","bad");
    return;
  }
  setAuto(true, true);
  toast("🔁 <b>Auto-walka włączona</b> — walczysz non stop: "+esc(c.name)+" ×"+n+
        ". Monet wystarczy na ~"+Math.floor(state.coins/total)+" "+plural(Math.floor(state.coins/total),"bitwę","bitwy","bitew")+".","good");
  if(!battleBusy && !battleStage) fight(c.id);        // ruszamy od razu
  else if(battleStage === 3) autoSchedule(n);         // wynik już wisi — lecimy dalej
});

/* =======================================================================
   12. STATYSTYKI
   ======================================================================= */
function renderStats(){
  /* Statystyki są ciężkie (album, osiągnięcia, ostatnie dropy) — rysujemy
     je tylko wtedy, gdy zakładka jest naprawdę otwarta. */
  if(currentView !== "stats") return;
  const s = state.stats;
  const net = s.earned - s.spent;
  const invVal = state.inv.reduce((a,i)=>a+i.value,0);
  const best = s.best;
  const boxes = [
    ["Otwarte skrzynki", fmt(s.opened), "", true],
    ["Wydane monety", "🪙 "+fmtShort(s.spent), "", true],
    ["Zysk ze sprzedaży", "🪙 "+fmtShort(s.earned), "", true],
    ["Bilans netto", (net>=0?"+":"")+"🪙 "+fmtShort(net), net>=0?"pos":"neg", false],
    ["Zdobyte noże ★", fmt(s.knives), s.knives>0?"pos":"", false],
    ["✦ Zdobyte relikty", fmt(numFrom(s.relics)), "najrzadsze przedmioty w grze", numFrom(s.relics)>0?"pos":"", false],
    ["Ekwipunek", fmt(state.inv.length)+" szt.", "wartość 🪙 "+fmtShort(invVal), false],
    ["Najlepszy drop", best?esc(best.n):"—",
      best?("🪙 "+fmtShort(best.value)+" · "+TIER[best.tier].name+
        (best.fx&&FX_BY_ID[best.fx]?" · "+FX_BY_ID[best.fx].icon+" "+FX_BY_ID[best.fx].name:"") ):"" , false],
    ["Średnio na skrzynkę", s.opened?"🪙 "+fmtShort(s.spent/s.opened):"—", "", false]
  ];
  if((s.rescues|0) > 0)
    boxes.push(["🆘 Ratunki", fmt(s.rescues)+"×", "dostałeś 🪙 "+fmtShort(s.rescues*RESCUE_AMOUNT), false]);
  if((s.battles|0) > 0)
    boxes.push(["⚔️ Bitwy — wygrane", fmt(s.battleWins|0)+" / "+fmt(s.battles|0),
      "skuteczność "+Math.round((s.battleWins|0)/s.battles*100)+"%", (s.battleWins|0)>0?"pos":"neg"]);
  if((s.clovers|0) > 0)
    boxes.push(["🍀 Czterolistne koniczyny", fmt(s.clovers)+"×", "lepsze szanse · "+(cloverActive()?"aktywna teraz":"nieaktywna"), cloverActive()?"pos":""]);
  const fxTot = numFrom(s.fxTotal);
  boxes.push(["✨ Efekty na broniach", fxTot ? fmt(fxTot)+"×" : "—",
    fxTot ? FX.filter(f=>fxCount(f.id)).map(f=>f.icon+" "+fmt(fxCount(f.id))).join(" · ")
          : "rzadkie wykończenia mnożące wartość dropu",
    fxTot ? "pos" : ""]);
  boxes.push(["📖 Album — postęp", fmt(albumHave())+" / "+fmt(ALBUM_TOTAL)+" skinów",
    (s.albums|0)+" "+plural(s.albums|0,"skompletowana skrzynka","skompletowane skrzynki","skompletowanych skrzynek")]);
  boxes.push(["🎯 Misje dzienne", fmt(((state.missions&&state.missions.list)||[]).filter(m=>m.claimed).length)+" / "+
    fmt(((state.missions&&state.missions.list)||[]).length), "nowe misje o północy", false]);
  if((s.botBuys|0) > 0)
    boxes.push(["🤖 Bazar botów", fmt(numFrom(s.botBuys))+" zakupów",
      "wydano 🪙 "+fmtShort(numFrom(s.botSpent))+" · najlepsza okazja −"+fmt(numFrom(s.bestDeal))+"%", false]);
  if((s.shopBuys|0) > 0)
    boxes.push(["🛒 Sklep", fmt(numFrom(s.shopBuys))+" zakupów",
      "wydano 🪙 "+fmtShort(numFrom(s.shopSpent))+" · skrzynek: "+fmt(numFrom(s.shopCases)), false]);
  const fxEvStat = fxEventPool().filter(f=>fxEventActive(f.id));
  boxes.push(["🎰 Eventy efektów", fxEvStat.length ? fxEvStat.length+" aktywne" : "brak",
    fxEvStat.length
      ? fxEvStat.map(f=>f.icon+" "+mmss(Math.max(0,numFrom(state.fxEvents[f.id])-Date.now()))).join(" · ")+" · +"+Math.round(FX_EVENT_LUCK*fxEvStat.length*100)+"% luck"
      : "kup w Sklepie · każdy aktywny daje +"+Math.round(FX_EVENT_LUCK*100)+"% luck",
    fxEvStat.length ? "pos" : ""]);
  if((s.codeDrops|0) > 0 || (s.codeRedeems|0) > 0 || codeOwnedTotal() > 0)
    boxes.push(["🔑 Kody", fmt(numFrom(s.codeDrops))+" znalezionych · "+fmt(numFrom(s.codeRedeems))+" odebranych",
      "w kolekcji: "+codeUniqueRedeemed()+" / "+CODES.length+" · do odebrania: "+codeOwnedTotal(), (s.codeDrops|0)>0?"pos":""]);
  const wkl = (state.weekly && state.weekly.list) || [];
  boxes.push(["📅 Misje tygodniowe", fmt(wkl.filter(m=>m.claimed).length)+" / "+fmt(wkl.length),
    wkl.length ? "nowe misje za "+wUntilNew() : "brak", false]);
  $("#statGrid").innerHTML = boxes.map((b,i)=>
    `<div class="stat-box" style="animation-delay:${i*45}ms"><label>${b[0]}</label>
      <b class="${b[2]==="pos"?"pos":b[2]==="neg"?"neg":""}">${b[1]}</b>
      ${b[2]&&b[2]!=="pos"&&b[2]!=="neg"?`<div class="sub">${b[2]}</div>`:""}</div>`).join("");

  const perCase = CASES.map(c=>{
    const n = s.cases[c.id]||0;
    return n ? `<div class="stat-box"><label>${esc(c.name)}</label><b>${fmt(n)}×</b>
      <div class="sub">wydano 🪙 ${fmtShort(n*c.price)}</div></div>` : "";
  }).join("");

  $("#recentList").innerHTML = perCase + (state.recent.length
    ? state.recent.map((r,i)=>{
        const t = TIER[r.tier];
        const rf = r.fx ? FX_BY_ID[r.fx] : null;
        return `<div class="item-card tier-${r.tier}${rf?" fx fx-"+rf.id:""}" style="--c:${t.color}${rf?";--fx:"+rf.color:""};animation-delay:${i*35}ms">
          ${rf?'<div class="fx-shine"></div>':""}
          ${rf?`<span class="fx-badge" title="${rf.name} · ${fxBoostTxt(rf)}">${rf.icon} ${rf.name} ×${fxM(rf)}</span>`:""}
          <div class="item-art">${weaponSVG({w:r.w,n:r.n,art:guessArt(r.w),tier:r.tier}, hash(r.uid).toString(36))}</div>
          <div class="item-body">
            <div class="item-weapon">${esc(r.w)}</div>
            <div class="item-skin">${esc(r.n)}</div>
            <div class="item-foot">
              <span class="item-tier">${r.tier==="special"?"★ Special":r.tier==="relic"?"✦ Relikt":t.name}</span>
              <span class="item-price">🪙 ${fmtShort(r.value)}</span>
            </div>
          </div></div>`;
      }).join("")
    : (perCase ? "" : `<div class="empty" style="grid-column:1/-1"><span class="big">📊</span>Brak danych — otwórz pierwszą skrzynkę.</div>`));
  renderAchievements();
  renderCosmetics();
}

/* =======================================================================
   13. CZĄSTECZKI
   ======================================================================= */
function confetti(colors){
  const wrap = $("#particles");
  colors = colors || ["#ffd700","#4b69ff","#8847ff","#d32ce6","#eb4b4b","#38e08a","#ffffff"];
  for(let i=0;i<95;i++){
    const p = document.createElement("i");
    p.className = "pt";
    const size = 5+Math.random()*9;
    p.style.cssText = `left:${Math.random()*100}vw;top:${-8-Math.random()*18}vh;width:${size}px;height:${size*(1+Math.random())}px;
      background:${pick(colors)};border-radius:${Math.random()<0.35?"50%":"2px"};box-shadow:0 0 10px ${"#fff2"}`;
    wrap.appendChild(p);
    const drift = (Math.random()-0.5)*300, rot = (Math.random()*900-450)|0;
    p.animate([
      {transform:"translate(0,0) rotate(0deg)",opacity:1},
      {transform:`translate(${drift}px,${window.innerHeight+130}px) rotate(${rot}deg)`,opacity:.9}
    ], {duration:2200+Math.random()*1900, easing:"cubic-bezier(.32,.55,.5,1)"}).onfinish = ()=>p.remove();
  }
}
function burst(x,y,color){
  const wrap = $("#particles");
  for(let i=0;i<34;i++){
    const p = document.createElement("i");
    p.className = "pt";
    const size = 3+Math.random()*5;
    p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${color};
      border-radius:50%;box-shadow:0 0 12px ${color}`;
    wrap.appendChild(p);
    const a = Math.random()*Math.PI*2, d = 90+Math.random()*230;
    p.animate([
      {transform:"translate(-50%,-50%) scale(1)",opacity:1},
      {transform:`translate(calc(-50% + ${Math.cos(a)*d}px), calc(-50% + ${Math.sin(a)*d}px)) scale(0)`,opacity:0}
    ], {duration:700+Math.random()*600, easing:"cubic-bezier(.2,.7,.4,1)"}).onfinish = ()=>p.remove();
  }
}

/* =======================================================================
   14. BONUS / USTAWIENIA
   ======================================================================= */
const bonusReward = ()=> Math.round(Math.min(Math.max((150 + state.coins*0.08), 150), 25000) * (1 + BONUS_STEP*upLvl("bonus"))/10)*10;
function updateBonus(){
  const cd = bonusCd();
  const left = Math.max(0, (state.bonusAt||0)+cd - Date.now());
  const btn = $("#bonusBtn");
  if(left<=0){
    btn.disabled = false;
    btn.classList.add("ready");
    if(btn.dataset.state !== "ready"){
      btn.dataset.state = "ready";
      btn.innerHTML = '🎁 Bonus <span class="cd" style="width:0%"></span>';
    }
    return;
  }
  btn.disabled = true; btn.classList.remove("ready");
  if(btn.dataset.state !== "cd") btn.dataset.state = "cd";
  btn.innerHTML = `🎁 Bonus ${Math.ceil(left/1000)}s <span class="cd" style="width:${100*(1-left/cd)}%"></span>`;
}
$("#bonusBtn").addEventListener("click", ()=>{
  if(Date.now() < (state.bonusAt||0)+bonusCd()){ sfxErr(); return; }
  const r = bonusReward();
  state.coins += r; state.bonusAt = Date.now();
  missionTrack("bonus",1);
  sfxCoin(); renderBalance(); renderShop(); save();
  toast("Bonus: <b>+🪙 "+fmt(r)+"</b>","good");
});
setInterval(updateBonus, 250);

/* =======================================================================
   14b. RATUNEK — gdy nie masz nic i nie stać Cię na żadną skrzynkę
   ======================================================================= */
const RESCUE_AMOUNT = 5000;    // tyle monet dostajesz w ratunku
const RESCUE_CD     = 10000;   // zabezpieczenie przed zapętleniem (10 s)
let rescueLock = false;
let brokeSince = 0;

/* sytuacja bez wyjścia: puste ręce i za mało monet na najtańszą skrzynkę */
function brokeAndEmpty(){
  const cheapest = Math.min(...CASES.map(c=>c.price));
  return state.inv.length === 0 && state.coins < cheapest;
}

function rescueBanner(amount){
  const el = document.createElement("div");
  el.className = "rescue-banner";
  el.innerHTML = '<div class="rb-icon">🆘</div><div class="rb-text">' +
    '<b>RATUNEK!</b>' +
    '<span class="rb-sub">Nie miałeś nic i nie było Cię stać na żadną skrzynkę.</span>' +
    '<span class="rb-amt">Dostajesz 🪙 ' + fmt(amount) + ' monet</span></div>';
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add("show"));
  setTimeout(()=>{ el.classList.remove("show"); setTimeout(()=>el.remove(), 450); }, 5200);
}

function grantRescue(){
  // ratunek musi być trwały — nie łapiemy ułamka sekundy w trakcie otwierania
  if(rescueLock || spinning || !brokeAndEmpty()){ brokeSince = 0; return false; }
  if(!brokeSince) { brokeSince = Date.now(); return false; }
  if(Date.now() - brokeSince < 1500) return false;
  if(Date.now() - (state.rescueAt||0) < RESCUE_CD) return false;
  rescueLock = true;

  const before = state.coins;
  state.coins    = RESCUE_AMOUNT;
  state.rescueAt = Date.now();
  state.stats.rescues = (state.stats.rescues||0)+1;

  lastBalance = before;
  renderBalance(); renderShop(); renderInv(); renderStats();
  rescueBanner(RESCUE_AMOUNT);
  confetti(["#ffd700","#ffb02e","#7dd3fc","#ffffff"]);
  sfxCoin();
  save();

  rescueLock = false; brokeSince = 0;
  return true;
}
setInterval(grantRescue, 500);

/* =======================================================================
   14c. 🍀 CZTEROLISTNA KONICZYNA — bonus losowany przy otwieraniu skrzynek
   Wypada niezależnie od zdobytego przedmiotu (także przy ×10). Na 80 s
   przesuwa szanse w stronę noży i dobrych skinów. Kolejne koniczyny
   wydłużają działanie, zamiast je nadpisywać.
   ======================================================================= */
const CLOVER_CHANCE = 0.004;   // 0,4% szansy na koniczynę przy każdym zdobytym przedmiocie (rzadki bonus)
const CLOVER_DUR    = 80000;   // czas działania: 80 sekund
const CLOVER_BOOST  = {mil:0, restricted:0.12, classified:0.28, covert:0.35, special:0.40, relic:0.05};

/* 🍀 ulepszenie "Długi kwiat" wydłuża działanie koniczyny */
const cloverDur = () => CLOVER_DUR + CLOVER_STEP*upLvl("clover");

function cloverActive(){ return Date.now() < (state.cloverUntil||0); }
function cloverLeft(){ return Math.max(0, (state.cloverUntil||0) - Date.now()); }
function cloverOdds(){ return cloverActive() ? CLOVER_BOOST : null; }

/* opis efektu do UI — mnożniki względne, zanim szanse zostaną znormalizowane */
function cloverDesc(){
  return "★ "   + Math.round(CLOVER_BOOST.special   *100) + "%  "
       + "✦ "   + Math.round(CLOVER_BOOST.relic     *100) + "%  "
       + "Covert "  + Math.round(CLOVER_BOOST.covert     *100) + "%  "
       + "Classified " + Math.round(CLOVER_BOOST.classified *100) + "%  "
       + "Restricted " + Math.round(CLOVER_BOOST.restricted *100) + "%";
}

/* losowanie koniczyny — wołane po każdym zdobytym przedmiocie */
function rollClover(){
  if(Math.random() >= CLOVER_CHANCE) return false;
  const now = Date.now();
  state.cloverUntil = Math.max(now, state.cloverUntil||0) + cloverDur();
  state.stats.clovers = (state.stats.clovers||0)+1;
  markDirty();
  return true;
}

/* efekt znalezienia koniczyny — dźwięk, konfetti, komunikat, plakietka */
function cloverHit(){
  missionTrack("clover",1);
  sfxClover();
  confetti(["#4ade80","#a8f0c0","#22c55e","#ffd700"]);
  toast("🍀 <b>Czterolistna koniczyna!</b> Przez "+Math.round(cloverDur()/1000)+
        " s masz większe szanse na noże i dobre bronie — " + cloverDesc(), "good");
  updateClover();
}


/* plakietka z licznikiem — pozycja fixed, więc nie rozpycha nagłówka */
function updateClover(){
  const pill = $("#cloverPill");
  if(!pill) return;
  const on = cloverActive();
  const wasOn = pill.dataset.on === "1";
  if(on !== wasOn){
    pill.dataset.on = on ? "1" : "0";
    pill.classList.toggle("show", on);
    if(on){
      pill.title = "🍀 Czterolistna koniczyna — " + cloverDesc() + " · wypada ze skrzynek (szansa " + (CLOVER_CHANCE*100).toFixed(1) + "%), działa " + Math.round(cloverDur()/1000) + " s";
      save();                 // utrwalone od razu, żeby bonus nie zginął przy odświeżeniu
    }
    renderShop();             // paski szans w sklepie pokazują realny stan
  }
  if(!on) return;
  const left = cloverLeft();
  const t = $("#cloverTime"), b = $("#cloverBar");
  if(t) t.textContent = Math.ceil(left/1000)+"s";
  if(b) b.style.width = Math.min(100, 100*left/cloverDur())+"%";
}
setInterval(updateClover, 250);

$("#fastBtn").addEventListener("click", ()=>{
  state.fast = !state.fast;
  $("#fastBtn").classList.toggle("on", state.fast);
  toast(state.fast ? "⚡ Szybkie otwieranie: WŁĄCZONE" : "Animacja otwierania: WŁĄCZONA");
  save();
});
$("#backupBtn").addEventListener("click", ()=>{
  const choice = prompt("KOPIA ZAPISU — wybierz:\n\n1 = skopiuj kod zapisu (kopia bezpieczeństwa)\n2 = wczytaj kod zapisu\n\nWpisz 1 lub 2:","1");
  if(choice === "1") exportSave();
  else if(choice === "2") importSave();
});
$("#soundBtn").addEventListener("click", ()=>{
  state.sound = !state.sound;
  $("#soundBtn").textContent = state.sound ? "🔊" : "🔇";
  if(state.sound) sfxCoin();
  save();
});
$("#resetBtn").addEventListener("click", ()=>{
  if(!confirm("Zresetować całą grę? Stracisz monety, ekwipunek i statystyki.")) return;
  if(!confirm("Na pewno? Zrobienie kopii zapisu (przycisk 💾 Kopia) jest jedynym sposobem, by to potem odzyskać.")) return;
  localStorage.removeItem(SAVE_KEY); localStorage.removeItem(SAVE_BAK);
  LEGACY_KEYS.forEach(k=>localStorage.removeItem(k));
  state.coins = START_COINS; state.inv = []; state.recent = [];
  state.stats = {opened:0,spent:0,earned:0,sold:0,knives:0,rescues:0,battles:0,battleWins:0,clovers:0,albums:0,fx:{},fxTotal:0,best:null,cases:{},
    codeDrops:0,codeRedeems:0,codeBuys:0, trollOpened:0, trollWins:0, shopBuys:0, shopSpent:0, shopCases:0};
  state.up = UP_ZERO();
  state.bonusAt = 0; state.rescueAt = 0; state.cloverUntil = 0;
  state.battles = []; state.battleCase = "start"; state.battleSize = 1;
  state.album = {}; state.albumClaimed = {}; albumCase = null;
  state.codes = {}; state.codeRedeemed = {}; state.codeBought = {};
  state.botUnlocked = {};
  state.shopSalt = 0; state.shopBought = {}; state.shopRefreshAt = 0;
  state.fxEvents = {}; FX_EVENT_SIG = "";
  SHOP_CACHE.tag = ""; SHOP_CACHE.list = [];
  state.idleKnifeClaimed = false; state.idleSec = 0; idleTimer = 0;
  rollMissions();
  rollWeekly();                           // 📅 świeży zestaw misji tygodniowych
  autoBattle = false; if(autoTimer){ clearTimeout(autoTimer); autoTimer = null; }
  autoStop("", false, true);              // 🤖 auto-otwieranie też przerywamy
  lastBalance = null;
  save();
  renderBalance(true); renderShop(); renderInv(); renderStats(); renderUp(); renderBattle(); updateBonus(); updateClover();
  renderAlbum(); renderDaily(); renderMarket();
  toast("Gra zresetowana","bad");
});

$$(".tab").forEach(t=>t.addEventListener("click", ()=>switchView(t.dataset.view)));
document.addEventListener("keydown", e=>{
  if(e.key==="Escape"){
    if($("#lootOverlay").classList.contains("show")) closeLoot();
    else if($("#battleOverlay").classList.contains("show")) $("#battleClose").click();
    else if($("#resultOverlay").classList.contains("show")) $("#resClose").click();
    else if($("#spinOverlay").classList.contains("show")) $("#spinClose").click();
    else if(autoOpen) autoStop("zatrzymane");       // 🤖 Esc zatrzymuje auto-otwieranie
  }
});