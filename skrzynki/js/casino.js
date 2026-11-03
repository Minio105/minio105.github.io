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
  state.exp = (state.exp || 0) + amount;
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
    el.innerHTML = `<span class="rp-ico">${curRank.icon}</span><span class="rp-info"><b>${curRank.name}</b><small>${exp} EXP ${nxt ? '('+pct+'%)' : '(MAX)'}</small></span><span class="rp-bar"><i style="width:${pct}%"></i></span>`;
    el.title = `Ranga CS2: ${curRank.name}\nAktualne EXP: ${fmt(exp)}${nxt ? '\nDo kolejnej rangi ('+nxt.name+'): ' + fmt(nxt.minExp - exp) + ' EXP' : '\nMaksymalna ranga!'}`;
  }
}

/* =======================================================================
   COINFLIP & CRASH (KASYNO SKÓREK)
   ======================================================================= */
let cfSelectedUids = new Set();
let cfBusy = false;

function renderCoinflip(){
  const wrap = $("#cfItems");
  if(!wrap) return;
  const inv = (state.inv || []).slice(0, 80); // pierwsze 80 dla płynności
  
  if(!inv.length){
    wrap.innerHTML = `<div class="empty-mini">Brak przedmiotów w ekwipunku do obstawienia!</div>`;
  } else {
    wrap.innerHTML = inv.map(it => {
      const isSel = cfSelectedUids.has(it.uid);
      const t = TIER[it.tier] || TIER.mil;
      return `<div class="cf-item ${isSel ? 'selected' : ''}" data-uid="${it.uid}" style="--c:${t.color}">
        <span class="cf-badge">${it.tier==='special'?'★':it.tier==='relic'?'✦':t.name}</span>
        <div class="cf-name">${esc(it.n)}</div>
        <div class="cf-val">🪙 ${fmtShort(it.value)}</div>
      </div>`;
    }).join("");
  }
  updateCoinflipSummary();
}

function updateCoinflipSummary(){
  const selList = state.inv.filter(i => cfSelectedUids.has(i.uid));
  const sumVal = selList.reduce((s, i) => s + i.value, 0);
  const sumEl = $("#cfSumVal");
  if(sumEl) sumEl.textContent = "🪙 " + fmtShort(sumVal);
  const btn = $("#cfStartBtn");
  if(btn) btn.disabled = selList.length === 0 || cfBusy;
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
  updateCoinflipSummary();

  const totalValue = selItems.reduce((s, i) => s + i.value, 0);
  // Usuń wybrane przedmioty z eq na czas rzutu
  state.inv = state.inv.filter(i => !cfSelectedUids.has(i.uid));
  renderInv();

  const coin = $("#cfCoin");
  if(coin){
    coin.classList.remove("flip-t", "flip-ct");
    void coin.offsetWidth; // reflow
  }

  sfxWhoosh();
  const winSide = Math.random() < 0.5 ? "ct" : "t"; // ct = Orzeł/Niebieski, t = Reszka/Pomarańczowy
  const playerWon = playerChoice === winSide;

  if(coin){
    coin.classList.add(winSide === "ct" ? "flip-ct" : "flip-t");
  }

  setTimeout(()=>{
    if(playerWon){
      // Gracz wygrywa: dostaje swoje przedmioty z powrotem + 1 losowy skin o zbliżonej wartości lub podwojenie wartości w monetach
      selItems.forEach(it => addToInv(it));
      // Nagroda bonusowa: równowartość w monetach
      state.coins += totalValue;
      state.stats.earned = (state.stats.earned || 0) + totalValue;
      addExp(Math.max(25, Math.floor(totalValue / 1000)), "coinflip_win");
      sfxWin("covert");
      confetti(["#38bdf8", "#ffd700", "#ffffff"]);
      toast(`🪙 <b>WYGRANA W COINFLIP!</b> Wygrałeś <b>🪙 ${fmt(totalValue)}</b> bonusu!`, "good");
    } else {
      // Gracz przegrywa postawione skiny
      state.stats.spent = (state.stats.spent || 0) + totalValue;
      addExp(Math.max(10, Math.floor(totalValue / 3000)), "coinflip_loss");
      sfxErr();
      toast(`💀 <b>PRZEGRANA W COINFLIP!</b> Straciłeś postawione przedmioty (${fmtShort(totalValue)}).`, "bad");
    }
    cfSelectedUids.clear();
    cfBusy = false;
    renderBalance();
    renderCoinflip();
    renderCasinoProfile();
    save();
  }, 2200);
}

/* =======================================================================
   CRASH (RAKIETA MNOŻNIKA)
   ======================================================================= */
let crashState = "idle"; // "idle", "running", "crashed"
let crashMult = 1.00;
let crashCrashPoint = 1.00;
let crashBet = 500;
let crashTimer = null;
let crashStartTime = 0;

function generateCrashPoint(){
  // Klasyczny algorytm Crash z house edge ~4%
  const r = Math.random();
  if(r < 0.04) return 1.00; // instant crash 4%
  return Math.max(1.01, +(0.96 / (1 - r)).toFixed(2));
}

function startCrash(){
  if(crashState === "running") return;
  const betInput = $("#crashBetInput");
  crashBet = Math.max(100, Math.floor(numFrom(betInput ? betInput.value : 500)));
  if(state.coins < crashBet){
    sfxErr();
    toast("Za mało monet na ten zakład!", "bad");
    return;
  }

  state.coins -= crashBet;
  state.stats.spent = (state.stats.spent || 0) + crashBet;
  renderBalance();
  addExp(Math.max(5, Math.floor(crashBet / 2000)), "crash_bet");

  crashState = "running";
  crashMult = 1.00;
  crashCrashPoint = generateCrashPoint();
  crashStartTime = performance.now();

  const multEl = $("#crashMultVal");
  const rocketEl = $("#crashRocket");
  const cashBtn = $("#crashCashoutBtn");
  const startBtn = $("#crashStartBtn");
  const statusEl = $("#crashStatus");

  if(startBtn) startBtn.disabled = true;
  if(cashBtn){ cashBtn.disabled = false; cashBtn.classList.add("pulse"); }
  if(statusEl) statusEl.textContent = "Rakieta leci...";
  if(multEl){ multEl.classList.remove("crashed"); multEl.style.color = "var(--ok)"; }

  sfxWhoosh();

  function tick(now){
    if(crashState !== "running") return;
    const elapsedSec = (now - crashStartTime) / 1000;
    // Mnożnik rośnie wykładniczo: 1.00 * e^(0.06 * t)
    crashMult = +(Math.pow(1.07, elapsedSec * 10)).toFixed(2);

    if(multEl) multEl.textContent = crashMult.toFixed(2) + "×";
    if(cashBtn) cashBtn.textContent = `Wypłać 🪙 ${fmtShort(crashBet * crashMult)}`;
    if(rocketEl){
      const x = Math.min(85, elapsedSec * 14);
      const y = Math.min(75, Math.pow(elapsedSec, 1.2) * 8);
      rocketEl.style.transform = `translate(${x}px, -${y}px) rotate(${Math.min(45, elapsedSec * 8)}deg)`;
    }

    if(crashMult >= crashCrashPoint){
      // CRASH!
      crashState = "crashed";
      if(multEl){
        multEl.textContent = crashCrashPoint.toFixed(2) + "× CRASH!";
        multEl.classList.add("crashed");
        multEl.style.color = "var(--cov)";
      }
      if(statusEl) statusEl.textContent = `💥 Rakieta wybuchła przy ${crashCrashPoint.toFixed(2)}×!`;
      if(cashBtn){ cashBtn.disabled = true; cashBtn.classList.remove("pulse"); }
      if(startBtn) startBtn.disabled = false;
      sfxErr();
      toast(`💥 <b>CRASH przy ${crashCrashPoint.toFixed(2)}×!</b> Straciłeś 🪙 ${fmt(crashBet)}.`, "bad");
      save();
      return;
    }

    crashTimer = requestAnimationFrame(tick);
  }

  crashTimer = requestAnimationFrame(tick);
}

function cashoutCrash(){
  if(crashState !== "running") return;
  cancelAnimationFrame(crashTimer);
  crashState = "idle";

  const winAmount = Math.round(crashBet * crashMult);
  state.coins += winAmount;
  state.stats.earned = (state.stats.earned || 0) + winAmount;
  renderBalance();

  addExp(Math.max(15, Math.floor(winAmount / 1500)), "crash_win");

  const cashBtn = $("#crashCashoutBtn");
  const startBtn = $("#crashStartBtn");
  const statusEl = $("#crashStatus");
  const multEl = $("#crashMultVal");

  if(cashBtn){ cashBtn.disabled = true; cashBtn.classList.remove("pulse"); }
  if(startBtn) startBtn.disabled = false;
  if(statusEl) statusEl.textContent = `Wypłacono przy ${crashMult.toFixed(2)}×! (+🪙 ${fmt(winAmount)})`;
  if(multEl) multEl.style.color = "var(--acc)";

  sfxWin("covert");
  confetti(["#38e08a", "#ffd700", "#ffffff"]);
  toast(`🚀 <b>WYPŁACONO!</b> Zgarnąłeś 🪙 ${fmt(winAmount)} (${crashMult.toFixed(2)}×)!`, "good");
  save();
  renderCasinoProfile();
}

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
        <div class="cr-exp-txt">EXP: <b>${fmt(exp)}</b> ${nxt ? `/ ${fmt(nxt.minExp)}` : '(Maksymalny stopień)'}</div>
        <div class="cr-bar"><i style="width:${pct}%"></i></div>
        <small class="muted">${nxt ? `Do następnej rangi: <b>${fmt(nxt.minExp - exp)} EXP</b>. Za awans: darmowa skrzynia <b>${CASES.find(c=>c.id===nxt.rewardBox)?.name || nxt.rewardBox}</b>!` : 'Posiadasz najwyższą możliwą rangę CS2!'}</small>
      </div>
    `;
  }
}

function initCasinoEvents(){
  $("#cfItems")?.addEventListener("click", e => {
    const card = e.target.closest("[data-uid]");
    if(!card || cfBusy) return;
    const uid = card.dataset.uid;
    if(cfSelectedUids.has(uid)){
      cfSelectedUids.delete(uid);
      card.classList.remove("selected");
    } else {
      if(cfSelectedUids.size >= 10){
        toast("Maksymalnie możesz obstawić 10 przedmiotów na raz!", "bad");
        return;
      }
      cfSelectedUids.add(uid);
      card.classList.add("selected");
    }
    updateCoinflipSummary();
  });

  $("#cfPickCT")?.addEventListener("click", () => runCoinflip("ct"));
  $("#cfPickT")?.addEventListener("click", () => runCoinflip("t"));

  $("#crashStartBtn")?.addEventListener("click", startCrash);
  $("#crashCashoutBtn")?.addEventListener("click", cashoutCrash);

  $("#crash2x")?.addEventListener("click", () => {
    const inp = $("#crashBetInput");
    if(inp) inp.value = Math.max(100, Math.floor(numFrom(inp.value) * 2));
  });
  $("#crashHalf")?.addEventListener("click", () => {
    const inp = $("#crashBetInput");
    if(inp) inp.value = Math.max(100, Math.floor(numFrom(inp.value) / 2));
  });
  $("#crashMax")?.addEventListener("click", () => {
    const inp = $("#crashBetInput");
    if(inp) inp.value = Math.max(100, Math.floor(state.coins));
  });
}
