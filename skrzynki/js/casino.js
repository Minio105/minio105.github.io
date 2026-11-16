"use strict";

/* =======================================================================
   RANKS (RANGI CS2) & EXP SYSTEM
   ======================================================================= */
const RANKS = [
  { id: 1,  name: "Silver I",               icon: "🥈", minExp: 0,       rewardBox: "start" },
  { id: 2,  name: "Silver II",              icon: "🥈", minExp: 100,     rewardBox: "sand" },
  { id: 3,  name: "Silver III",             icon: "🥈", minExp: 300,     rewardBox: "sand" },
  { id: 4,  name: "Silver IV",              icon: "🥈", minExp: 650,     rewardBox: "urban" },
  { id: 5,  name: "Silver Elite",           icon: "🥈", minExp: 1150,    rewardBox: "urban" },
  { id: 6,  name: "Silver Elite Master",    icon: "🥈", minExp: 1800,    rewardBox: "prism" },
  { id: 7,  name: "Gold Nova I",            icon: "🥇", minExp: 2700,    rewardBox: "prism" },
  { id: 8,  name: "Gold Nova II",           icon: "🥇", minExp: 3800,    rewardBox: "spectral" },
  { id: 9,  name: "Gold Nova III",          icon: "🥇", minExp: 5200,    rewardBox: "spectral" },
  { id: 10, name: "Gold Nova Master",       icon: "🥇", minExp: 7000,    rewardBox: "chroma" },
  { id: 11, name: "Master Guardian I",      icon: "🎖️", minExp: 9500,    rewardBox: "chroma" },
  { id: 12, name: "Master Guardian II",     icon: "🎖️", minExp: 13000,   rewardBox: "frost" },
  { id: 13, name: "Master Guardian Elite",  icon: "🎖️", minExp: 18000,   rewardBox: "frost" },
  { id: 14, name: "Distinguished Master Guardian", icon: "⭐", minExp: 25000, rewardBox: "dragon" },
  { id: 15, name: "Legendary Eagle",        icon: "🦅", minExp: 35000,   rewardBox: "dragon" },
  { id: 16, name: "Legendary Eagle Master", icon: "🦅", minExp: 50000,   rewardBox: "void" },
  { id: 17, name: "Supreme Master First Class", icon: "🔱", minExp: 75000, rewardBox: "royal" },
  { id: 18, name: "The Global Elite",       icon: "🌐", minExp: 110000,  rewardBox: "royal" }
];

function getPlayerRank(exp){
  exp = Math.max(0, exp || 0);
  let rank = RANKS[0];
  for(let i = 0; i < RANKS.length; i++){
    if(exp >= RANKS[i].minExp) rank = RANKS[i];
    else break;
  }
  return rank;
}

function getNextRank(currentRank){
  const idx = RANKS.findIndex(r => r.id === currentRank.id);
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
}

function addExp(amount, sourceLabel){
  if(!amount || amount <= 0) return;
  const mult = typeof expBuffMult === "function" ? expBuffMult() : 1;
  const gain = Math.max(1, Math.round(amount * mult));
  state.exp = (state.exp || 0) + gain;
  state.rank = state.rank || 1;
  const oldRank = RANKS.find(r => r.id === state.rank) || RANKS[0];
  const newRank = getPlayerRank(state.exp);

  renderRankBadge();
  markDirty();

  if(newRank.id > oldRank.id){
    state.rank = newRank.id;
    // Nagroda za awans: darmowa skrzynka do zapasu!
    const boxId = newRank.rewardBox || "start";
    state.caseStock = state.caseStock || {};
    state.caseStock[boxId] = (state.caseStock[boxId] || 0) + 1;
    const boxDef = CASES.find(c => c.id === boxId);

    sfxWin("special");
    confetti(["#ffd700", "#45e6ff", "#ffffff", "#38e08a"]);
    toast("🎖️ <b>AWANS NA RANGĘ: " + newRank.icon + " " + newRank.name + "!</b><br>Otrzymujesz skrzynię awansu: <b>" + (boxDef ? boxDef.name : boxId) + "</b> (czeka w zapasie)!", "good");
    if(currentView === "casino") renderCasinoProfile();
    renderShop();
  }
}

function renderRankBadge(){
  const exp = state.exp || 0;
  const curRank = getPlayerRank(exp);
  const nxt = getNextRank(curRank);

  const el = $("#rankPill");
  if(el){
    const pct = nxt ? Math.min(100, Math.floor(((exp - curRank.minExp) / (nxt.minExp - curRank.minExp)) * 100)) : 100;
    el.innerHTML = `<span class="rp-ico">${curRank.icon}</span><span class="rp-info"><b>${curRank.name}</b><small>${fmt(exp)} EXP ${nxt ? "· " + pct + "%" : "· MAX"}</small></span><span class="rp-bar"><i style="width:${pct}%"></i></span>`;
    el.title = `Ranga CS2: ${curRank.name}\nAktualne EXP: ${fmt(exp)}${nxt ? "\nDo kolejnej rangi (" + nxt.name + "): " + fmt(nxt.minExp - exp) + " EXP" : "\nMaksymalna ranga!"}`;
  }
}

/* =======================================================================
   KASYNO — WSPÓLNE
   ======================================================================= */
function casinoSave(){
  markDirty();
  save({ kind:"casino" });
}
function casinoClamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
function casinoInputNum(v){
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}
function casinoDec(v, digits = 2){ return (+v).toFixed(digits).replace(".", ","); }
function casinoMult(v){ return casinoDec(v, 2) + "×"; }
function casinoSetResult(id, html, cls){
  const el = $(id);
  if(!el) return;
  el.className = "casino-result " + (cls || "");
  el.innerHTML = html;
}
function casinoHistoryHTML(list, empty){
  if(!list || !list.length) return `<span class="ch-empty">${empty}</span>`;
  return list.slice(0, 6).map(h=>{
    const cls = h.win ? "win" : "loss";
    const title = h.title || (h.win ? "Wygrana" : "Przegrana");
    return `<span class="ch-chip ${cls}" title="${esc(title)}">${h.win ? "✓" : "✕"} ${h.label || ""}</span>`;
  }).join("");
}

let casinoSubtab = "cf";
function setCasinoTab(tab){
  const valid = ["cf", "crash", "dice", "mines", "league"];
  if(!valid.includes(tab)) tab = "cf";
  casinoSubtab = tab;
  $$("#casinoSubTabs [data-casino-tab]").forEach(btn=>{
    const on = btn.dataset.casinoTab === tab;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  $$("#view-casino [data-casino-panel]").forEach(panel=>{
    panel.classList.toggle("active", panel.dataset.casinoPanel === tab);
  });
  if(tab === "cf") renderCoinflip();
  if(tab === "crash"){ renderCrashHistory(); renderCrashUpgrades(); }
  if(tab === "dice"){ renderDiceMeta(); renderDiceHistory(); }
  if(tab === "mines") renderMines();
  if(tab === "league") renderCasinoLeague();
}

/* =======================================================================
   COINFLIP — RZUT MONETĄ SKINAMI
   ======================================================================= */
let cfSelectedUids = new Set();
let cfBusy = false;
let cfHistory = [];
let cfStreak = 0;
let cfBestStreak = 0;
const CF_FLIP_MS = 2800; // musi być zsynchronizowane z animacją coinFlipCT/coinFlipT
let cfResultTimer = 0;
const cfSideName = side => side === "ct" ? "Orzeł" : "Reszka";

function renderCoinflip(){
  const wrap = $("#cfItems");
  if(!wrap) return;
  const inv = (state.inv || []).slice(0, 80); // pierwsze 80 dla płynności
  const valid = new Set(inv.map(i => i.uid));
  [...cfSelectedUids].forEach(uid => { if(!valid.has(uid)) cfSelectedUids.delete(uid); });

  if(!inv.length){
    wrap.innerHTML = `<div class="empty-mini cf-empty">Brak przedmiotów w ekwipunku do obstawienia!<br>
      <button class="btn primary" data-go-shop>🎁 Przejdź do skrzynek</button></div>`;
  } else {
    wrap.innerHTML = inv.map(it => {
      const isSel = cfSelectedUids.has(it.uid);
      const t = TIER[it.tier] || TIER.mil;
      const f = fxOf(it);
      const tierName = it.tier === "special" ? "★ Special" : it.tier === "gloves" ? "🧤 Rękawice" : it.tier === "relic" ? "✦ Relikt" : t.name;
      return `<div class="cf-item ${isSel ? "selected" : ""}" data-uid="${it.uid}" style="--c:${t.color}">
        <span class="cf-check">${isSel ? "✓" : ""}</span>
        <span class="cf-tier">${tierName}</span>
        <div class="cf-name">${esc(it.w || it.n)}<small>${esc(it.n || "")}${f ? " · " + f.icon : ""}</small></div>
        <div class="cf-val">🪙 ${fmtShort(it.value)}</div>
      </div>`;
    }).join("");
  }
  updateCoinflipSummary();
  renderCoinflipHistory();
}

function updateCoinflipSummary(){
  const selList = state.inv.filter(i => cfSelectedUids.has(i.uid));
  const sumVal = selList.reduce((s, i) => s + i.value, 0);
  const sumEl = $("#cfSumVal");
  if(sumEl) sumEl.textContent = "🪙 " + fmtShort(sumVal);
  const count = $("#cfCount");
  if(count) count.textContent = selList.length + " / 10";
  const streak = $("#cfStreak");
  if(streak) streak.textContent = cfStreak ? `🔥 passa ${cfStreak} · best ${cfBestStreak}` : "passa: —";
  const btn = $("#cfStartBtn");
  if(btn) btn.disabled = selList.length === 0 || cfBusy;
  $("#cfPickCT")?.toggleAttribute("disabled", cfBusy || selList.length === 0);
  $("#cfPickT")?.toggleAttribute("disabled", cfBusy || selList.length === 0);
  $("#cfSelectBest")?.toggleAttribute("disabled", cfBusy || !state.inv.length);
  $("#cfClear")?.toggleAttribute("disabled", cfBusy || !cfSelectedUids.size);
  const freeBtn = $("#cfFreeSpin");
  const freeCount = $("#cfFreeCount");
  if(freeCount) freeCount.textContent = String(numFrom(state.freeSpins));
  if(freeBtn) freeBtn.disabled = cfBusy || numFrom(state.freeSpins) <= 0;
}

function renderCoinflipHistory(){
  const h = $("#cfHistory");
  if(h) h.innerHTML = casinoHistoryHTML(cfHistory, "Ostatnie rzuty monetą pojawią się tutaj.");
}

function runCoinflip(playerChoice){
  if(cfBusy) return;
  const selItems = state.inv.filter(i => cfSelectedUids.has(i.uid));
  if(!selItems.length){
    sfxErr();
    toast("Wybierz przynajmniej 1 przedmiot z listy!", "bad");
    return;
  }
  cfBusy = true;
  const totalValue = selItems.reduce((s, i) => s + i.value, 0);
  const winSide = Math.random() < 0.5 ? "ct" : "t";
  const playerWon = playerChoice === winSide;

  casinoSetResult("#cfResult", "<span>🪙 <b>Rzucam monetą…</b> Trzymaj kciuki!</span>", "rolling");
  updateCoinflipSummary();

  const stage = $("#cfStage");
  if(stage){
    clearTimeout(cfResultTimer);
    stage.classList.remove("win", "loss", "flipping");
    void stage.offsetWidth;
    stage.classList.add("flipping");
  }

  const coin = $("#cfCoin");
  if(coin){
    coin.classList.remove("flip-t", "flip-ct");
    void coin.offsetWidth;
    coin.classList.add(winSide === "ct" ? "flip-ct" : "flip-t");
  }
  sfxWhoosh();

  setTimeout(()=>{
    if(stage){
      stage.classList.remove("flipping");
      stage.classList.add(playerWon ? "win" : "loss");
      clearTimeout(cfResultTimer);
      cfResultTimer = setTimeout(()=>stage.classList.remove("win", "loss"), 1600);
    }
    if(playerWon){
      // Wygrana: przedmioty zostają w ekwipunku + bonus w monetach.
      state.coins += totalValue;
      state.stats.earned = numFrom(state.stats.earned) + totalValue;
      cfStreak++;
      cfBestStreak = Math.max(cfBestStreak, cfStreak);
      missionTrack("coinflip_win", 1, { streak: cfStreak, value: totalValue });
      if(typeof casinoLeagueAdd === "function") casinoLeagueAdd("coinflip", totalValue);
      addExp(Math.max(25, Math.floor(totalValue / 1000)), "coinflip_win");
      sfxWin("covert");
      confetti(["#38bdf8", "#ffd700", "#ffffff"]);
      casinoSetResult("#cfResult",
        `<span>✅ <b>WYGRANA!</b> Wypadło: <b>${cfSideName(winSide)}</b>. Zostajesz ze skinami i dostajesz bonus <b>🪙 ${fmt(totalValue)}</b>.</span>`, "win");
      toast(`🪙 <b>WYGRANA W COINFLIP!</b> Bonus: <b>🪙 ${fmt(totalValue)}</b> · passa ${cfStreak}`, "good");
    } else {
      // Przegrana: dopiero teraz usuwamy obstawione skiny (bezpiecznie przy zamknięciu karty).
      state.inv = state.inv.filter(i => !cfSelectedUids.has(i.uid));
      state.stats.spent = numFrom(state.stats.spent) + totalValue;
      cfStreak = 0;
      addExp(Math.max(10, Math.floor(totalValue / 3000)), "coinflip_loss");
      sfxErr();
      casinoSetResult("#cfResult",
        `<span>💀 <b>PRZEGRANA.</b> Wypadło: <b>${cfSideName(winSide)}</b>. Straciłeś obstawione skiny o wartości <b>🪙 ${fmtShort(totalValue)}</b>.</span>`, "loss");
      toast(`💀 <b>PRZEGRANA W COINFLIP!</b> Straciłeś obstawione przedmioty (${fmtShort(totalValue)}).`, "bad");
    }
    cfHistory.unshift({
      win: playerWon,
      label: `🪙 ${fmtShort(totalValue)}`,
      title: (playerWon ? "Wygrana" : "Przegrana") + " · " + cfSideName(playerChoice)
    });
    cfHistory = cfHistory.slice(0, 8);
    cfSelectedUids.clear();
    cfBusy = false;
    renderInv();
    renderBalance();
    renderCoinflip();
    renderCasinoProfile();
    casinoSave();
  }, CF_FLIP_MS);
}

function runFreeCoinflip(){
  if(cfBusy) return;
  if(numFrom(state.freeSpins) <= 0){
    sfxErr();
    toast("Brak darmowych spinów. Wypatruj mini eventu 🎁 Darmowy spin.","bad");
    return;
  }
  cfBusy = true;
  state.freeSpins = Math.max(0, numFrom(state.freeSpins) - 1);
  const playerChoice = Math.random() < 0.5 ? "ct" : "t";
  const winSide = Math.random() < 0.5 ? "ct" : "t";
  const playerWon = playerChoice === winSide;
  const prize = Math.max(5000, Math.round(numFrom(state.coins) * 0.005));

  casinoSetResult("#cfResult", `<span>🎁 <b>Darmowy spin…</b> Bez ryzyka. Trzymaj kciuki!</span>`, "rolling");
  updateCoinflipSummary();
  const stage = $("#cfStage");
  if(stage){
    clearTimeout(cfResultTimer);
    stage.classList.remove("win", "loss", "flipping");
    void stage.offsetWidth;
    stage.classList.add("flipping");
  }
  const coin = $("#cfCoin");
  if(coin){
    coin.classList.remove("flip-t", "flip-ct");
    void coin.offsetWidth;
    coin.classList.add(winSide === "ct" ? "flip-ct" : "flip-t");
  }
  sfxWhoosh();

  setTimeout(()=>{
    if(stage){
      stage.classList.remove("flipping");
      stage.classList.add(playerWon ? "win" : "loss");
      clearTimeout(cfResultTimer);
      cfResultTimer = setTimeout(()=>stage.classList.remove("win", "loss"), 1600);
    }
    if(playerWon){
      state.coins += prize;
      state.stats.earned = numFrom(state.stats.earned) + prize;
      missionTrack("coinflip_win", 1, { free:true, value:prize });
      if(typeof casinoLeagueAdd === "function") casinoLeagueAdd("coinflip", prize);
      addExp(Math.max(15, Math.floor(prize / 2000)), "free_coinflip");
      sfxWin("covert");
      confetti(["#38bdf8", "#ffd700", "#ffffff"]);
      casinoSetResult("#cfResult",
        `<span>🎁 <b>DARMOWY SPIN — WYGRANA!</b> Wypadło: <b>${cfSideName(winSide)}</b>. Bonus <b>🪙 ${fmt(prize)}</b> bez ryzyka.</span>`, "win");
      toast(`🎁 <b>DARMOWY SPIN!</b> +🪙 ${fmt(prize)} — nic nie traciłeś.`, "good");
    } else {
      sfxErr();
      casinoSetResult("#cfResult",
        `<span>🎁 <b>Darmowy spin zakończony.</b> Wypadło: <b>${cfSideName(winSide)}</b>. Tym razem bez bonusu — ale bez strat.</span>`, "loss");
      toast(`🎁 Darmowy spin bez wygranej. Następny raz!`, "bad");
    }
    cfHistory.unshift({ win:playerWon, label:"🎁 " + fmtShort(prize), title:"Darmowy spin · " + cfSideName(playerChoice) });
    cfHistory = cfHistory.slice(0, 8);
    cfBusy = false;
    renderBalance();
    renderCoinflip();
    renderCasinoProfile();
    casinoSave();
  }, CF_FLIP_MS);
}

/* =======================================================================
   CRASH — ULEPSZENIA (tylko Crash)
   ======================================================================= */
const CRASH_UPGRADES = [
  { id:"engine", icon:"🔥", name:"Silnik", max:5,
    costs:[1200, 5000, 20000, 80000, 300000],
    desc:"Każdy poziom dodaje 2% do wypłaty z udanego lotu. Działa tylko w Crashu.",
    fmt:l => l ? "+"+l*2+"% wypłaty" : "standardowa wypłata" },
  { id:"stability", icon:"🛡️", name:"Stabilizator", max:5,
    costs:[2000, 8000, 32000, 120000, 450000],
    desc:"Zmniejsza szansę na natychmiastowy wybuch i lekko poprawia krzywą lotu.",
    fmt:l => "instant crash: "+(4-l*0.4).toFixed(1).replace(".",",")+"%" },
  { id:"shield", icon:"🧯", name:"Ubezpieczenie", max:5,
    costs:[1500, 6500, 26000, 100000, 380000],
    desc:"Po wybuchu rakiety odzyskujesz część postawionych monet.",
    fmt:l => l ? l*5+"% stawki po crashu" : "brak zwrotu po crashu" }
];
const CRASH_UP_BY_ID = Object.fromEntries(CRASH_UPGRADES.map(u=>[u.id,u]));
function crashUpLvl(id){
  return Math.max(0, Math.min(5, (state.crashUp && state.crashUp[id]|0) || 0));
}
function crashUpCost(id, lvl){ return CRASH_UP_BY_ID[id].costs[lvl]; }
function crashPayoutMult(mult){ return mult * (1 + 0.02*crashUpLvl("engine")); }
function crashPayoutValue(bet, mult){ return Math.round(bet * crashPayoutMult(mult)); }

/* =======================================================================
   CRASH — RAKIETA MNOŻNIKA
   ======================================================================= */
let crashState = "idle"; // "idle" | "running" | "crashed"
let crashMult = 1.00;
let crashCrashPoint = 1.00;
let crashBet = 500;
let crashTimer = null;
let crashStartTime = 0;
let crashHistory = [];

function generateCrashPoint(){
  // Klasyczny crash; Stabilizator zmniejsza szansę na instant crash i lekko poprawia krzywą.
  const stab = crashUpLvl("stability");
  const bustChance = Math.max(0.02, 0.04 - 0.004*stab);
  const houseEdge = Math.max(0.025, 0.04 - 0.003*stab);
  const r = Math.random();
  if(r < bustChance) return 1.00;
  return Math.max(1.01, +((1 - houseEdge) / (1 - r)).toFixed(2));
}

function resetCrashChart(){
  const line = $("#crashLine"), dot = $("#crashDot");
  if(line){
    line.setAttribute("points", "2,98 2,98");
    line.classList.remove("crashed", "cashed");
  }
  if(dot){ dot.setAttribute("cx", 2); dot.setAttribute("cy", 98); dot.style.opacity = "0"; }
}

function updateCrashChart(mult){
  const line = $("#crashLine"), dot = $("#crashDot");
  const l = Math.log(Math.max(1, mult));
  const x = 2 + Math.min(94, l * 24);
  const y = 98 - Math.min(88, l * 32);
  if(line) line.setAttribute("points", `2,98 ${x.toFixed(1)},${y.toFixed(1)}`);
  if(dot){
    dot.setAttribute("cx", x.toFixed(1));
    dot.setAttribute("cy", y.toFixed(1));
    dot.style.opacity = "1";
  }
  const rocket = $("#crashRocket");
  if(rocket){
    rocket.style.transform = `translate(${Math.min(165, l * 48)}px, -${Math.min(78, l * 26)}px) rotate(${Math.min(38, l * 14)}deg)`;
  }
}

function renderCrashHistory(){
  const h = $("#crashHistory");
  if(h) h.innerHTML = casinoHistoryHTML(crashHistory, "Historia lotów pojawi się tutaj.");
}

function crashStatus(text){
  const el = $("#crashStatus");
  if(el) el.textContent = text;
}

function startCrash(){
  if(crashState === "running") return;
  const input = $("#crashBetInput");
  crashBet = Math.max(100, casinoInputNum(input ? input.value : 500));
  if(state.coins < crashBet){
    sfxErr();
    toast("Za mało monet na ten zakład!", "bad");
    return;
  }

  state.coins -= crashBet;
  state.stats.spent = numFrom(state.stats.spent) + crashBet;
  addExp(Math.max(5, Math.floor(crashBet / 2000)), "crash_bet");
  // Stawka od razu zapisana: zamknięcie karty w trakcie lotu nie cofa zakładu.
  casinoSave();
  renderBalance();
  renderCrashUpgrades();

  crashState = "running";
  crashMult = 1.00;
  crashCrashPoint = generateCrashPoint();
  crashStartTime = performance.now();
  resetCrashChart();

  const multEl = $("#crashMultVal");
  const cashBtn = $("#crashCashoutBtn");
  const startBtn = $("#crashStartBtn");
  if(startBtn) startBtn.disabled = true;
  if(cashBtn){ cashBtn.disabled = false; cashBtn.classList.add("pulse"); cashBtn.textContent = "Wypłać"; }
  crashStatus("Rakieta leci…");
  if(multEl){ multEl.textContent = "1,00×"; multEl.classList.remove("crashed"); multEl.style.color = "var(--ok)"; }
  sfxWhoosh();

  function tick(now){
    if(crashState !== "running") return;
    const elapsedSec = (now - crashStartTime) / 1000;
    // Wolniejsza, czytelniejsza krzywa niż wcześniej: ~2× po 2 s, ~5× po 5 s.
    crashMult = +(Math.pow(1.07, elapsedSec * 5)).toFixed(2);
    if(multEl) multEl.textContent = casinoMult(crashMult);
    if(cashBtn) cashBtn.textContent = `Wypłać 🪙 ${fmtShort(crashPayoutValue(crashBet, crashMult))}`;
    updateCrashChart(crashMult);

    // Auto-wypłata — nie pozwala przegapić dobrego momentu.
    const autoOn = !!$("#crashAutoOn")?.checked;
    const autoVal = parseFloat($("#crashAutoInput")?.value) || 0;
    if(autoOn && autoVal > 1.01 && crashMult >= autoVal && crashMult < crashCrashPoint){
      cashoutCrash();
      return;
    }

    if(crashMult >= crashCrashPoint){
      crashState = "crashed";
      if(multEl){
        multEl.textContent = casinoMult(crashCrashPoint) + " CRASH!";
        multEl.classList.add("crashed");
        multEl.style.color = "var(--cov)";
      }
      const line = $("#crashLine");
      if(line) line.classList.add("crashed");
      const shieldLvl = crashUpLvl("shield");
      const refund = shieldLvl ? Math.round(crashBet * 0.05 * shieldLvl) : 0;
      if(refund){
        state.coins += refund;
        renderBalance();
      }
      crashStatus(`💥 Rakieta wybuchła przy ${casinoMult(crashCrashPoint)}!${refund ? ` · ubezpieczenie +🪙 ${fmt(refund)}` : ""}`);
      if(cashBtn){ cashBtn.disabled = true; cashBtn.classList.remove("pulse"); }
      if(startBtn) startBtn.disabled = false;
      crashHistory.unshift({ win:false, label: casinoMult(crashCrashPoint) + (refund ? " · +"+fmtShort(refund) : ""), title: refund ? "Crash · ubezpieczenie" : "Crash" });
      crashHistory = crashHistory.slice(0, 8);
      renderCrashHistory();
      sfxErr();
      toast(`💥 <b>CRASH przy ${casinoMult(crashCrashPoint)}!</b> Straciłeś 🪙 ${fmt(crashBet)}.${refund ? `<br>🧯 Ubezpieczenie zwróciło <b>🪙 ${fmt(refund)}</b>.` : ""}`, "bad");
      casinoSave();
      renderCrashUpgrades();
      return;
    }

    crashTimer = requestAnimationFrame(tick);
  }

  crashTimer = requestAnimationFrame(tick);
}

function cashoutCrash(){
  if(crashState !== "running") return;
  if(crashMult >= crashCrashPoint){ return; } // ostatnia klatka mogła już wybuchnąć
  cancelAnimationFrame(crashTimer);
  crashState = "idle";

  const winAmount = crashPayoutValue(crashBet, crashMult);
  state.coins += winAmount;
  state.stats.earned = numFrom(state.stats.earned) + winAmount;
  missionTrack("crash_cashout", 1, { mult: crashMult, win: winAmount });
  missionTrack("casino_win", winAmount);
  if(typeof casinoLeagueAdd === "function") casinoLeagueAdd("crash", winAmount);
  addExp(Math.max(15, Math.floor(winAmount / 1500)), "crash_win");
  renderBalance();

  const cashBtn = $("#crashCashoutBtn");
  const startBtn = $("#crashStartBtn");
  const multEl = $("#crashMultVal");
  const line = $("#crashLine");

  if(cashBtn){ cashBtn.disabled = true; cashBtn.classList.remove("pulse"); }
  if(startBtn) startBtn.disabled = false;
  if(multEl) multEl.style.color = "var(--acc)";
  if(line) line.classList.add("cashed");
  crashStatus(`Wypłacono przy ${casinoMult(crashMult)}! (+🪙 ${fmt(winAmount)})`);
  crashHistory.unshift({ win:true, label: casinoMult(crashMult), title:"Wypłata" });
  crashHistory = crashHistory.slice(0, 8);
  renderCrashHistory();

  sfxWin("covert");
  confetti(["#38e08a", "#ffd700", "#ffffff"]);
  toast(`🚀 <b>WYPŁACONO!</b> Zgarnąłeś 🪙 ${fmt(winAmount)} (${casinoMult(crashMult)})!`, "good");
  casinoSave();
  renderCasinoProfile();
}

function renderCrashUpgrades(){
  const grid = $("#crashUps");
  if(!grid) return;
  grid.innerHTML = CRASH_UPGRADES.map(u=>{
    const lvl = crashUpLvl(u.id);
    const maxed = lvl >= u.max;
    const price = maxed ? 0 : crashUpCost(u.id, lvl);
    const can = !maxed && state.coins >= price;
    const pips = Array.from({length:u.max},(_,k)=>`<i class="${k<lvl?"on":""}"></i>`).join("");
    const eff = maxed
      ? `<span class="cu-cur">${u.fmt(lvl)}</span>`
      : `<span class="cu-cur">${u.fmt(lvl)}</span><span class="cu-arrow">→</span><span class="cu-next">${u.fmt(lvl+1)}</span>`;
    return `<div class="crash-up${maxed?" maxed":""}">
      <div class="cu-head"><span class="cu-ico">${u.icon}</span><span class="cu-name">${u.name}</span></div>
      <div class="cu-lvl">Poziom ${lvl} / ${u.max}</div>
      <div class="cu-desc">${u.desc}</div>
      <div class="cu-pips">${pips}</div>
      <div class="cu-effect">${eff}</div>
      <div class="cu-buy">${maxed
        ? '<span class="cu-max">✔ MAX</span>'
        : `<span class="cu-price${can?" ok":""}" title="🪙 ${fmt(price)}">🪙 ${fmtShort(price)}</span><button class="mini-btn cu-btn${can?" can":""}" data-crash-up="${u.id}">Ulepsz</button>`}</div>
    </div>`;
  }).join("");
}

function buyCrashUpgrade(id){
  const u = CRASH_UP_BY_ID[id];
  if(!u) return;
  if(crashState === "running"){
    sfxErr();
    toast("Najpierw zakończ lot — ulepszenia zadziałają od następnej gry.","bad");
    return;
  }
  const lvl = crashUpLvl(id);
  if(lvl >= u.max){ sfxErr(); return; }
  const price = crashUpCost(id, lvl);
  if(state.coins < price){
    sfxErr();
    toast("Za mało monet na to ulepszenie!","bad");
    return;
  }
  state.coins -= price;
  state.crashUp = state.crashUp || {engine:0, stability:0, shield:0};
  state.crashUp[id] = lvl + 1;
  if(typeof missionTrack === "function") missionTrack("upgrade", 1);
  sfxCoin();
  renderBalance();
  renderCrashUpgrades();
  toast(`⚙️ <b>${u.name}</b> → poziom ${lvl+1} &nbsp;·&nbsp; ${u.fmt(lvl+1)}`,"good");
  casinoSave();
}

/* =======================================================================
   DICE — KOŚCI (0–100)
   ======================================================================= */
let diceMode = "over";
let diceTarget = 50;
let diceBusy = false;
let diceHistory = [];
const DICE_REACH = 50;          // maksymalny dystans od celu, który jeszcze płaci
const DICE_MULT_MAX = 2.60;     // mnożnik za trafienie obok celu (dystans 1)
const DICE_MULT_MIN = 1.05;     // mnożnik na skraju zasięgu (dystans 50)
const DICE_MULT_STEP = 0.031;

function diceWinCount(){
  if(diceMode === "over")
    return Math.max(0, Math.min(100, diceTarget + DICE_REACH) - diceTarget);
  return Math.max(0, diceTarget - Math.max(1, diceTarget - DICE_REACH));
}
function diceChance(){ return diceWinCount() / 100; }
function diceDistanceMult(distance){
  return Math.max(DICE_MULT_MIN, +(DICE_MULT_MAX - distance*DICE_MULT_STEP).toFixed(2));
}
function renderDiceMeta(){
  const targetEl = $("#diceTargetVal");
  if(targetEl) targetEl.textContent = diceTarget;
  const chanceEl = $("#diceChance");
  if(chanceEl) chanceEl.textContent = casinoDec(diceChance() * 100, 1) + "%";
  const multEl = $("#diceMult");
  if(multEl) multEl.textContent = casinoDec(DICE_MULT_MIN, 2) + "× – " + casinoMult(DICE_MULT_MAX);
  const exactEl = $("#diceExact");
  if(exactEl) exactEl.innerHTML = `🎯 Dokładnie <b>${diceTarget}</b> (1%) = <b>4×</b>`;
  const modeOver = $("#diceModeOver"), modeUnder = $("#diceModeUnder");
  modeOver?.classList.toggle("active", diceMode === "over");
  modeUnder?.classList.toggle("active", diceMode === "under");
}
function renderDiceHistory(){
  const h = $("#diceHistory");
  if(h) h.innerHTML = casinoHistoryHTML(diceHistory, "Historia rzutów pojawi się tutaj.");
}
function runDice(){
  if(diceBusy) return;
  const betInput = $("#diceBet");
  const bet = Math.max(100, casinoInputNum(betInput ? betInput.value : 500));
  if(state.coins < bet){
    sfxErr();
    toast("Za mało monet na ten rzut!", "bad");
    return;
  }
  diceBusy = true;
  const modeAtRoll = diceMode;
  const targetAtRoll = diceTarget;
  const roll = Math.floor(Math.random() * 100) + 1;   // 1–100, więc trafienie w cel jest możliwe
  const exact = roll === targetAtRoll;
  const distance = Math.abs(roll - targetAtRoll);
  const onSide = modeAtRoll === "over" ? roll > targetAtRoll : roll < targetAtRoll;
  const won = exact || (onSide && distance <= DICE_REACH);
  const mult = exact ? 4 : (won ? diceDistanceMult(distance) : 0);
  const payout = won ? Math.round(bet * mult) : 0;

  state.coins -= bet;
  state.stats.spent = numFrom(state.stats.spent) + bet;
  casinoSave();
  renderBalance();

  const cube = $("#diceCube"), rollEl = $("#diceRoll");
  const result = $("#diceResult");
  const rollBtn = $("#diceRollBtn");
  if(rollBtn) rollBtn.disabled = true;
  if(cube) cube.classList.add("rolling");
  if(result){ result.className = "casino-result rolling"; result.innerHTML = "🎲 Rzucam…"; }
  if(rollEl) rollEl.textContent = "…";
  sfxWhoosh();

  let ticks = 0;
  const anim = setInterval(()=>{
    ticks++;
    if(rollEl) rollEl.textContent = String(Math.floor(Math.random() * 100) + 1);
    if(ticks < 8) return;
    clearInterval(anim);
    if(cube) cube.classList.remove("rolling");
    if(rollEl) rollEl.textContent = String(roll);

    if(won){
      state.coins += payout;
      state.stats.earned = numFrom(state.stats.earned) + payout;
      addExp(Math.max(10, Math.floor(bet / 3000)), "dice_win");
      sfxWin(exact ? "special" : "covert");
      confetti(exact ? ["#ffd700", "#fff3b0", "#38e08a", "#ffffff"] : ["#38e08a", "#ffd700", "#ffffff"]);
      if(result){
        result.className = "casino-result win" + (exact ? " exact" : "");
        result.innerHTML = exact
          ? `🎯 <b>${roll}</b> — dokładne trafienie w <b>${targetAtRoll}</b>! Mnożnik <b>4×</b> → wygrywasz <b>🪙 ${fmt(payout)}</b>.`
          : `✅ <b>${roll}</b> — ${modeAtRoll === "over" ? "powyżej" : "poniżej"} ${targetAtRoll}, dystans <b>${distance}</b>. Wygrywasz <b>🪙 ${fmt(payout)}</b> (${casinoMult(mult)}).`;
      }
      toast(exact
        ? `🎯 <b>DOKŁADNE TRAFIENIE!</b> ${roll} · +🪙 ${fmt(payout)} (4×)`
        : `🎲 <b>WYGRANA!</b> ${roll} · +🪙 ${fmt(payout)} · ${casinoMult(mult)}`, "good");
    } else {
      addExp(Math.max(5, Math.floor(bet / 5000)), "dice_loss");
      sfxErr();
      if(result){
        result.className = "casino-result loss";
        result.innerHTML = `💀 <b>${roll}</b> — ${onSide ? "za daleko od" : "po złej stronie"} <b>${targetAtRoll}</b>${onSide ? ` (dystans ${distance})` : ""}. Tracisz <b>🪙 ${fmt(bet)}</b>.`;
      }
      toast(`🎲 <b>PRZEGRANA.</b> ${roll} · −🪙 ${fmt(bet)}`, "bad");
    }
    const histTitle = exact ? "Dokładnie! 4×" : won ? "Dystans "+distance+" · "+casinoMult(mult) : "Przegrana · "+(onSide ? "za daleko" : "zła strona");
    if(won){ missionTrack("dice_win", 1, { payout, mult }); missionTrack("casino_win", payout); if(typeof casinoLeagueAdd === "function") casinoLeagueAdd("dice", payout); }
    diceHistory.unshift({ win:won, label: String(roll), title: histTitle });
    diceHistory = diceHistory.slice(0, 8);
    renderDiceHistory();
    diceBusy = false;
    if(rollBtn) rollBtn.disabled = false;
    renderBalance();
    renderCasinoProfile();
    casinoSave();
  }, 80);
}

/* =======================================================================
   MINES — PLANSZA 5 × 5
   ======================================================================= */
const MINES_SIZE = 5;
const MINES_TILES = MINES_SIZE * MINES_SIZE;
const MINES_HOUSE_EDGE = 0.97;
const MINES_MAX_MULT = 5000;
const MINES_COUNTS = [3, 5, 8, 12];

let minesCount = 5;
let minesBet = 500;
let minesActive = false;
let minesGameOver = false;
let minesMines = new Set();
let minesRevealed = new Set();
let minesHistory = [];

function minesMultFor(picks, mines = minesCount){
  const mineTotal = Math.max(1, Math.min(MINES_TILES - 1, mines|0));
  const safeTotal = MINES_TILES - mineTotal;
  const n = Math.max(0, Math.min(safeTotal, picks|0));
  if(!n) return 1;
  let fair = 1;
  for(let i = 0; i < n; i++){
    fair *= (MINES_TILES - i) / (safeTotal - i);
  }
  return Math.max(1.01, Math.min(MINES_MAX_MULT, +(fair * MINES_HOUSE_EDGE).toFixed(2)));
}
function minesMaxPicks(){ return MINES_TILES - minesCount; }
function minesActivePicks(){ return minesActive ? minesRevealed.size : 0; }
function minesCurrentMult(){ return minesActivePicks() ? minesMultFor(minesActivePicks()) : 1; }
function minesPayout(){ return minesActivePicks() ? Math.round(minesBet * minesCurrentMult()) : 0; }
function minesNextMult(){
  const picks = minesActivePicks();
  if(picks >= minesMaxPicks()) return null;
  return minesMultFor(picks + 1);
}

function renderMinesMeta(){
  const multEl = $("#minesMult");
  const nextEl = $("#minesNext");
  const payoutEl = $("#minesPayout");
  if(multEl) multEl.textContent = casinoMult(minesCurrentMult());
  const next = minesNextMult();
  if(nextEl) nextEl.textContent = next ? casinoMult(next) : "MAX";
  if(payoutEl) payoutEl.textContent = "🪙 " + fmtShort(minesPayout());

  $$("#minesCounts [data-mines-count]").forEach(btn=>{
    const on = +btn.dataset.minesCount === minesCount;
    btn.classList.toggle("active", on);
    btn.disabled = minesActive;
  });
  const startBtn = $("#minesStartBtn");
  const cashBtn = $("#minesCashoutBtn");
  if(startBtn){
    startBtn.disabled = minesActive;
    startBtn.textContent = minesActive ? "💣 Gra w toku…" : "💣 Rozpocznij grę";
  }
  if(cashBtn){
    cashBtn.disabled = !minesActive || minesRevealed.size === 0;
    cashBtn.textContent = minesActive && minesRevealed.size
      ? `Wypłać 🪙 ${fmtShort(minesPayout())}`
      : "Wypłać";
  }
  const betInput = $("#minesBet");
  if(betInput) betInput.disabled = minesActive;
  ["#minesHalf", "#mines2x", "#minesMax"].forEach(sel=>{
    const b = $(sel);
    if(b) b.disabled = minesActive;
  });
}

function renderMinesBoard(){
  const board = $("#minesBoard");
  if(!board) return;
  let html = "";
  for(let i = 0; i < MINES_TILES; i++){
    const isMine = minesMines.has(i);
    const picked = minesRevealed.has(i);
    let cls = "mines-tile";
    let txt = "?";
    if(minesActive){
      if(picked){ cls += " safe"; txt = "💎"; }
    } else if(minesGameOver){
      if(isMine){ cls += " mine"; txt = "💣"; }
      else { cls += " safe ghost"; txt = "💎"; }
    }
    const disabled = !minesActive || picked;
    html += `<button type="button" class="${cls}" data-mines-index="${i}" ${disabled ? "disabled" : ""} aria-label="Pole ${i + 1}">${txt}</button>`;
  }
  board.innerHTML = html;
  const lock = $("#minesLock");
  if(lock) lock.classList.toggle("show", !minesActive && !minesGameOver);
}

function renderMinesHistory(){
  const h = $("#minesHistory");
  if(h) h.innerHTML = casinoHistoryHTML(minesHistory, "Ostatnie gry w Mines pojawią się tutaj.");
}

function renderMines(){
  renderMinesMeta();
  renderMinesBoard();
  renderMinesHistory();
}

function setMinesCount(count){
  if(minesActive) return;
  minesCount = MINES_COUNTS.includes(count) ? count : 5;
  minesMines = new Set();
  minesRevealed = new Set();
  minesGameOver = false;
  casinoSetResult("#minesResult", "Wybierz liczbę min i rozpocznij grę.", "");
  renderMines();
}

function minesPushHistory(win, label, title){
  minesHistory.unshift({ win, label, title });
  minesHistory = minesHistory.slice(0, 8);
  renderMinesHistory();
}

function startMines(){
  if(minesActive) return;
  const input = $("#minesBet");
  minesBet = Math.max(100, casinoInputNum(input ? input.value : 500));
  if(state.coins < minesBet){
    sfxErr();
    toast("Za mało monet na ten zakład!", "bad");
    return;
  }

  state.coins -= minesBet;
  state.stats.spent = numFrom(state.stats.spent) + minesBet;
  minesActive = true;
  minesGameOver = false;
  minesRevealed = new Set();
  minesMines = new Set();

  const pool = Array.from({ length: MINES_TILES }, (_, i) => i);
  for(let i = pool.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for(let i = 0; i < minesCount; i++) minesMines.add(pool[i]);

  casinoSetResult("#minesResult", `💣 <b>Gra rozpoczęta.</b> Odkryj pierwsze pole — wypłata rośnie z każdym bezpiecznym trafieniem.`, "");
  addExp(Math.max(5, Math.floor(minesBet / 2000)), "mines_bet");
  renderBalance();
  renderMines();
  casinoSave();
}

function revealMinesTile(index){
  if(!minesActive || minesRevealed.has(index)) return;
  if(index < 0 || index >= MINES_TILES) return;

  if(minesMines.has(index)){
    minesActive = false;
    minesGameOver = true;
    addExp(Math.max(5, Math.floor(minesBet / 3000)), "mines_loss");
    sfxErr();
    casinoSetResult("#minesResult",
      `💥 <b>MINA!</b> Trafiłeś bombę po <b>${minesRevealed.size}</b> ${plural(minesRevealed.size, "bezpiecznym polu", "bezpiecznych polach", "bezpiecznych polach")}. Tracisz <b>🪙 ${fmt(minesBet)}</b>.`, "loss");
    toast(`💥 <b>MINA W MINES!</b> Straciłeś 🪙 ${fmt(minesBet)}.`, "bad");
    minesPushHistory(false, `${minesCount} min · ${minesRevealed.size} ${plural(minesRevealed.size, "pole", "pola", "pól")}`, "Mines · mina");
    renderBalance();
    renderMines();
    renderCasinoProfile();
    casinoSave();
    return;
  }

  minesRevealed.add(index);

  if(minesRevealed.size >= minesMaxPicks()){
    const picks = minesRevealed.size;
    const mult = minesMultFor(picks);
    const payout = Math.round(minesBet * mult);
    minesActive = false;
    minesGameOver = true;
    state.coins += payout;
    state.stats.earned = numFrom(state.stats.earned) + payout;
    missionTrack("casino_win", payout);
    if(typeof casinoLeagueAdd === "function") casinoLeagueAdd("mines", payout);
    addExp(Math.max(25, Math.floor(payout / 1500)), "mines_win");
    sfxWin("special");
    confetti(["#ffd700", "#38e08a", "#45e6ff", "#ffffff"]);
    casinoSetResult("#minesResult",
      `💎 <b>PEŁNE WYCZYSZCZENIE!</b> Odkryłeś wszystkie ${picks} ${plural(picks, "bezpieczne pole", "bezpieczne pola", "bezpiecznych pól")} przy mnożniku <b>${casinoMult(mult)}</b> → <b>🪙 ${fmt(payout)}</b>.`, "exact");
    toast(`💎 <b>FULL CLEAR W MINES!</b> ${casinoMult(mult)} · +🪙 ${fmt(payout)}`, "good");
    minesPushHistory(true, `${minesCount} min · ${picks} ${plural(picks, "pole", "pola", "pól")}`, "Mines · full clear");
    renderBalance();
    renderMines();
    renderCasinoProfile();
    casinoSave();
    return;
  }

  sfxCoin();
  casinoSetResult("#minesResult",
    `💎 <b>Bezpieczne pole!</b> Mnożnik <b>${casinoMult(minesCurrentMult())}</b>. Możesz odkrywać dalej albo wypłacić <b>🪙 ${fmt(minesPayout())}</b>.`, "win");
  renderMines();
}

function cashoutMines(){
  if(!minesActive || minesRevealed.size === 0) return;
  const picks = minesRevealed.size;
  const mult = minesMultFor(picks);
  const payout = Math.round(minesBet * mult);
  minesActive = false;
  minesGameOver = true;
  state.coins += payout;
  state.stats.earned = numFrom(state.stats.earned) + payout;
  missionTrack("casino_win", payout);
  if(typeof casinoLeagueAdd === "function") casinoLeagueAdd("mines", payout);
  addExp(Math.max(15, Math.floor(payout / 1500)), "mines_win");
  sfxWin("covert");
  confetti(["#38e08a", "#ffd700", "#ffffff"]);
  casinoSetResult("#minesResult",
    `✅ <b>WYPŁACONO!</b> ${picks} ${plural(picks, "bezpieczne pole", "bezpieczne pola", "bezpiecznych pól")} · mnożnik <b>${casinoMult(mult)}</b> → <b>🪙 ${fmt(payout)}</b>.`, "win");
  toast(`💣 <b>WYPŁATA Z MINES!</b> ${casinoMult(mult)} · +🪙 ${fmt(payout)}`, "good");
  minesPushHistory(true, `${minesCount} min · ${picks} ${plural(picks, "pole", "pola", "pól")}`, "Mines · wypłata");
  renderBalance();
  renderMines();
  renderCasinoProfile();
  casinoSave();
}

function minesAdjustBet(kind){
  if(minesActive) return;
  const input = $("#minesBet");
  if(!input) return;
  let v = casinoInputNum(input.value);
  if(kind === "half") v = Math.max(100, Math.floor(v / 2));
  if(kind === "2x") v = Math.max(100, Math.floor(v * 2));
  if(kind === "max") v = Math.max(100, Math.floor(state.coins));
  input.value = v;
  minesBet = v;
}

/* =======================================================================
   🏆 LIGA KASYNA — tygodniowy ranking wygranych
   ======================================================================= */
const CASINO_LEAGUE_BOTS = [
  {name:"NeonWolf", icon:"🐺"}, {name:"AWP_King", icon:"🎯"}, {name:"MinesQueen", icon:"💣"},
  {name:"CrashKid", icon:"🚀"}, {name:"DiceGoblin", icon:"🎲"}, {name:"SkinBaron", icon:"👑"},
  {name:"ZeroCool", icon:"🧊"}, {name:"FragMachine", icon:"⚙️"}, {name:"BetonowyBog", icon:"🗿"},
  {name:"LuckyLena_Fan", icon:"🍀"}
];
function casinoWeekKey(date){
  const d = date ? new Date(date) : new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (t.getDay() + 6) % 7; // poniedziałek = 0
  t.setDate(t.getDate() - day);
  return t.getFullYear() + "-" + String(t.getMonth()+1).padStart(2,"0") + "-" + String(t.getDate()).padStart(2,"0");
}
function casinoWeekEnd(){
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - day + 7);
  return t.getTime();
}
function casinoLeagueBots(week){
  return CASINO_LEAGUE_BOTS.map((b,i)=>{
    const h = hash(String(week) + "|" + b.name + "|" + i) >>> 0;
    const score = Math.round((0.05 + (h % 1000) / 1000 * 0.95) * (200000 + ((h >>> 10) % 800000)));
    return { name:b.name, icon:b.icon, score, bot:true };
  });
}
function casinoLeagueReward(rank, score){
  let coins = 0, caseId = null;
  if(rank === 1){ coins = 1000000; caseId = "gambler"; }
  else if(rank <= 3){ coins = 500000; caseId = "sticker"; }
  else if(rank <= 10){ coins = 150000; }
  else if(rank <= 50){ coins = 50000; }
  else if(score > 0){ coins = 10000; }
  return { coins, caseId };
}
function casinoLeagueEnsure(){
  const week = casinoWeekKey();
  let lg = state.casinoLeague;
  if(!lg || typeof lg !== "object" || lg.week !== week){
    const prev = (lg && typeof lg === "object" && lg.week) ? lg : null;
    let last = prev && prev.last ? prev.last : null;
    if(prev && (numFrom(prev.score) > 0 || numFrom(prev.plays) > 0)){
      const bots = Array.isArray(prev.bots) && prev.bots.length ? prev.bots : casinoLeagueBots(prev.week);
      const score = numFrom(prev.score);
      const rank = 1 + bots.filter(b=>numFrom(b.score) > score).length;
      /* Nie nadpisujemy nieodebranej nagrody starszym wynikiem — gracz
         może ją odebrać nawet po rozpoczęciu kolejnego tygodnia. */
      if(!last || last.claimed) last = { week:prev.week, rank, score, reward:casinoLeagueReward(rank, score), claimed:false };
    }
    state.casinoLeague = { week, score:0, plays:0, bots:casinoLeagueBots(week), last };
    markDirty(); save({ kind:"casino_league" });
    return true;
  }
  lg.score = numFrom(lg.score);
  lg.plays = numFrom(lg.plays);
  if(!Array.isArray(lg.bots) || !lg.bots.length) lg.bots = casinoLeagueBots(week);
  return false;
}
function casinoLeagueRank(){
  casinoLeagueEnsure();
  const lg = state.casinoLeague;
  return 1 + lg.bots.filter(b=>numFrom(b.score) > numFrom(lg.score)).length;
}
function casinoLeagueAdd(game, amount){
  const add = Math.max(0, Math.round(numFrom(amount)));
  if(!add) return;
  casinoLeagueEnsure();
  const lg = state.casinoLeague;
  lg.score = numFrom(lg.score) + add;
  lg.plays = numFrom(lg.plays) + 1;
  lg.byGame = (lg.byGame && typeof lg.byGame === "object") ? lg.byGame : {};
  lg.byGame[game] = numFrom(lg.byGame[game]) + add;
  markDirty();
  if(typeof currentView !== "undefined" && currentView === "casino" && casinoSubtab === "league") renderCasinoLeague();
  save({ kind:"casino_league" });
}
function casinoLeagueClaim(){
  casinoLeagueEnsure();
  const lg = state.casinoLeague;
  const last = lg && lg.last;
  if(!last || last.claimed){ sfxErr(); return; }
  const r = last.reward || {};
  if(r.coins){ state.coins += numFrom(r.coins); state.stats.earned = numFrom(state.stats.earned) + numFrom(r.coins); }
  if(r.caseId){
    state.caseStock = (state.caseStock && typeof state.caseStock === "object" && !Array.isArray(state.caseStock)) ? state.caseStock : {};
    state.caseStock[r.caseId] = numFrom(state.caseStock[r.caseId]) + 1;
  }
  last.claimed = true;
  markDirty(); save();
  renderBalance(); renderShop(); renderCasinoLeague();
  sfxWin("special");
  confetti(["#ffd700", "#38e08a", "#8ee7ff"]);
  const box = r.caseId ? CASES.find(c=>c.id===r.caseId) : null;
  toast("🏆 <b>Nagroda z ligi odebrana!</b> Miejsce #"+last.rank+" · 🪙 "+fmt(r.coins||0)+(box?" + "+box.name:""),"good");
}
function renderCasinoLeague(){
  const el = $("#casinoLeaguePanel");
  if(!el) return;
  casinoLeagueEnsure();
  const lg = state.casinoLeague;
  const meScore = numFrom(lg.score);
  const rank = 1 + lg.bots.filter(b=>numFrom(b.score) > meScore).length;
  const all = lg.bots.concat([{ name:"Ty", icon:"🫵", score:meScore, me:true }]).sort((a,b)=>numFrom(b.score)-numFrom(a.score));
  const myRow = all.findIndex(x=>x.me) + 1;
  const rows = all.slice(0, 12).map((x,i)=>{
    const r = i + 1;
    const medal = r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : "#" + r;
    return `<div class="league-row${x.me?" me":""}">
      <span class="lr-pos">${medal}</span>
      <span class="lr-ico">${x.icon || "🎮"}</span>
      <span class="lr-name">${esc(x.name)}${x.me?" <b>· Ty</b>":""}</span>
      <span class="lr-score">🪙 ${fmtShort(x.score)}</span>
    </div>`;
  }).join("");
  const myRowHTML = myRow > 12
    ? `<div class="league-row me"><span class="lr-pos">#${myRow}</span><span class="lr-ico">🫵</span><span class="lr-name">Ty <b>· Twoja pozycja</b></span><span class="lr-score">🪙 ${fmtShort(meScore)}</span></div>`
    : "";
  const last = lg.last;
  const lastHTML = last
    ? `<div class="league-last ${last.claimed?"claimed":""}">
        <div class="ll-head"><span>📜 Poprzedni tydzień</span><b>#${last.rank}</b></div>
        <div class="ll-desc">Wynik: <b>🪙 ${fmt(last.score)}</b> · nagroda: <b>🪙 ${fmt(last.reward && last.reward.coins || 0)}</b>${last.reward && last.reward.caseId ? " + 📦 "+(CASES.find(c=>c.id===last.reward.caseId)||{}).name : ""}</div>
        ${last.claimed
          ? `<span class="ll-done">✔ odebrano</span>`
          : `<button class="btn primary" data-league-claim="1">🎁 Odbierz nagrodę</button>`}
      </div>`
    : `<div class="league-last empty">Brak rozliczonego tygodnia. Zagraj w kasynie — po zakończeniu tygodnia pojawi się tu nagroda.</div>`;
  const left = Math.max(0, casinoWeekEnd() - Date.now());
  const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000);
  const timeTxt = h > 0 ? h + " godz. " + m + " min" : m + " min";
  el.innerHTML = `
    <div class="league-top">
      <div class="league-stat"><span>Twoje miejsce</span><b>#${rank}</b></div>
      <div class="league-stat"><span>Wygrane w tym tygodniu</span><b>🪙 ${fmt(meScore)}</b></div>
      <div class="league-stat"><span>Do końca tygodnia</span><b>${timeTxt}</b></div>
    </div>
    <div class="league-list">${rows}${myRowHTML}</div>
    ${lastHTML}
    <div class="league-rewards">
      <b>🏅 Nagrody za miejsce:</b> #1 — 🪙 1 000 000 + Skrzynka Hazardzisty · #2–3 — 🪙 500 000 + Skrzynka Naklejek · #4–10 — 🪙 150 000 · #11–50 — 🪙 50 000 · pozostali z wynikiem — 🪙 10 000.
    </div>`;
}
/* =======================================================================
   PROFIL RANGI W KASYnie
   ======================================================================= */
function renderCasinoProfile(){
  renderRankBadge();
  const curRank = getPlayerRank(state.exp || 0);
  const nxt = getNextRank(curRank);
  const exp = state.exp || 0;
  const pct = nxt ? Math.min(100, Math.floor(((exp - curRank.minExp) / (nxt.minExp - curRank.minExp)) * 100)) : 100;

  const prof = $("#casinoRankBox");
  if(prof){
    prof.innerHTML = `
      <div class="cr-badge">${curRank.icon}</div>
      <div class="cr-details">
        <div class="cr-name">${curRank.name} <span class="cr-lvl">Poziom ${curRank.id}</span></div>
        <div class="cr-exp-txt">EXP: <b>${fmt(exp)}</b> ${nxt ? `/ ${fmt(nxt.minExp)}` : "(Maksymalny stopień)"}</div>
        <div class="cr-bar"><i style="width:${pct}%"></i></div>
        <small class="muted">${nxt ? `Do następnej rangi: <b>${fmt(nxt.minExp - exp)} EXP</b>. Za awans: darmowa skrzynia <b>${CASES.find(c=>c.id===nxt.rewardBox)?.name || nxt.rewardBox}</b>!` : "Posiadasz najwyższą możliwą rangę CS2!"}</small>
      </div>`;
  }
  renderDiceMeta();
  renderCrashUpgrades();
  renderMines();
  if(casinoSubtab === "league") renderCasinoLeague();
}

/* =======================================================================
   ZDARZENIA KASYNA
   ======================================================================= */
let casinoEventsBound = false;
function initCasinoEvents(){
  if(casinoEventsBound) return;
  casinoEventsBound = true;

  $("#rankPill")?.addEventListener("click", ()=>switchView("casino"));

  $("#casinoSubTabs")?.addEventListener("click", e=>{
    const btn = e.target.closest("[data-casino-tab]");
    if(btn) setCasinoTab(btn.dataset.casinoTab);
  });
  $("#casinoLeaguePanel")?.addEventListener("click", e=>{
    if(e.target.closest("[data-league-claim]")) casinoLeagueClaim();
  });

  $("#cfItems")?.addEventListener("click", e => {
    if(e.target.closest("[data-go-shop]")){ switchView("shop"); return; }
    const card = e.target.closest("[data-uid]");
    if(!card || cfBusy) return;
    const uid = card.dataset.uid;
    if(cfSelectedUids.has(uid)){
      cfSelectedUids.delete(uid);
    } else {
      if(cfSelectedUids.size >= 10){
        toast("Maksymalnie możesz obstawić 10 przedmiotów na raz!", "bad");
        return;
      }
      cfSelectedUids.add(uid);
    }
    card.classList.toggle("selected", cfSelectedUids.has(uid));
    const check = card.querySelector(".cf-check");
    if(check) check.textContent = cfSelectedUids.has(uid) ? "✓" : "";
    updateCoinflipSummary();
  });

  $("#cfSelectBest")?.addEventListener("click", ()=>{
    if(cfBusy) return;
    const top = (state.inv || []).slice().sort((a,b)=>b.value - a.value).slice(0, 10);
    if(!top.length){ toast("Brak przedmiotów w ekwipunku.","bad"); return; }
    cfSelectedUids = new Set(top.map(i=>i.uid));
    renderCoinflip();
  });
  $("#cfClear")?.addEventListener("click", ()=>{
    if(cfBusy) return;
    cfSelectedUids.clear();
    renderCoinflip();
  });

  $("#cfPickCT")?.addEventListener("click", () => runCoinflip("ct"));
  $("#cfPickT")?.addEventListener("click", () => runCoinflip("t"));
  $("#cfFreeSpin")?.addEventListener("click", runFreeCoinflip);

  $("#crashStartBtn")?.addEventListener("click", startCrash);
  $("#crashCashoutBtn")?.addEventListener("click", cashoutCrash);
  $("#crashHalf")?.addEventListener("click", ()=>{
    const inp = $("#crashBetInput");
    if(inp) inp.value = Math.max(100, Math.floor(casinoInputNum(inp.value) / 2));
  });
  $("#crash2x")?.addEventListener("click", ()=>{
    const inp = $("#crashBetInput");
    if(inp) inp.value = Math.max(100, Math.floor(casinoInputNum(inp.value) * 2));
  });
  $("#crashMax")?.addEventListener("click", ()=>{
    const inp = $("#crashBetInput");
    if(inp) inp.value = Math.max(100, Math.floor(state.coins));
  });
  $("#view-casino")?.addEventListener("click", e=>{
    const q = e.target.closest("[data-crashbet]");
    if(!q) return;
    const inp = $("#crashBetInput");
    if(inp) inp.value = q.dataset.crashbet;
  });
  $("#crashUps")?.addEventListener("click", e=>{
    const b = e.target.closest("[data-crash-up]");
    if(b) buyCrashUpgrade(b.dataset.crashUp);
  });

  $("#diceTarget")?.addEventListener("input", e=>{
    diceTarget = casinoClamp(casinoInputNum(e.target.value), 1, 100);
    e.target.value = diceTarget;
    renderDiceMeta();
  });
  $("#diceModeOver")?.addEventListener("click", ()=>{ diceMode = "over"; renderDiceMeta(); });
  $("#diceModeUnder")?.addEventListener("click", ()=>{ diceMode = "under"; renderDiceMeta(); });
  $("#diceRollBtn")?.addEventListener("click", runDice);
  $("#diceHalf")?.addEventListener("click", ()=>{
    const inp = $("#diceBet");
    if(inp) inp.value = Math.max(100, Math.floor(casinoInputNum(inp.value) / 2));
  });
  $("#dice2x")?.addEventListener("click", ()=>{
    const inp = $("#diceBet");
    if(inp) inp.value = Math.max(100, Math.floor(casinoInputNum(inp.value) * 2));
  });
  $("#diceMax")?.addEventListener("click", ()=>{
    const inp = $("#diceBet");
    if(inp) inp.value = Math.max(100, Math.floor(state.coins));
  });

  $("#minesBoard")?.addEventListener("click", e=>{
    const tile = e.target.closest("[data-mines-index]");
    if(tile) revealMinesTile(+tile.dataset.minesIndex);
  });
  $("#minesStartBtn")?.addEventListener("click", startMines);
  $("#minesCashoutBtn")?.addEventListener("click", cashoutMines);
  $("#minesCounts")?.addEventListener("click", e=>{
    const btn = e.target.closest("[data-mines-count]");
    if(btn) setMinesCount(+btn.dataset.minesCount);
  });
  $("#minesHalf")?.addEventListener("click", ()=>minesAdjustBet("half"));
  $("#mines2x")?.addEventListener("click", ()=>minesAdjustBet("2x"));
  $("#minesMax")?.addEventListener("click", ()=>minesAdjustBet("max"));
  $("#minesBet")?.addEventListener("keydown", e=>{
    if(e.key === "Enter" && !minesActive) startMines();
  });
}

initCasinoEvents();
renderMines();
