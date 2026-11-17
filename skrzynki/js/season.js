"use strict";

/* =======================================================================
   🏆 SEZON — 8 tygodni, 12 poziomów, darmowa ścieżka + diamentowa (Premium)
   Postęp liczy się z EXP zdobywanego w całej grze. Na końcu: limitowana
   Skrzynka Sezonowa z unikalnymi skinami.
   ======================================================================= */
const SEASON_START = Date.UTC(2026, 10, 1);        // 1 listopada 2026
const SEASON_MS = 56 * 24 * 60 * 60 * 1000;        // 8 tygodni
const SEASON_PREMIUM_COST = 80;
const SEASON_DIAMOND_PRICE = 250000;               // monety za 1 diament
const SEASON_DIAMOND_MAX = 20;                     // limit wymiany na sezon
const SEASON_MASTER_CONTRACTS = 6;                 // kontrakty Bazaru do Karnetu Mistrza
const SEASON_MASTER_REWARDS = {
  1:{t:"diamonds", amount:10},
  3:{t:"suitcase", id:"suit_kos"},
  5:{t:"diamonds", amount:20},
  7:{t:"case", id:"chroma"},
  9:{t:"suitcase", id:"suit_collector"},
  11:{t:"case", id:"season_limited"}
};
const SEASON_VIP_COST = 60;                        // diamenty — wyłącznie kosmetyka
const SEASON_VIP_REWARDS = {
  3:{icon:"🖼️", name:"Złota ramka kart"},
  7:{icon:"✨", name:"Aura mistrza"},
  11:{icon:"👑", name:"Tytuł: Władca Sezonu"}
};

const SEASON_TIERS = [
  {lvl:1,  xp:0,     free:{t:"coins", amount:5000},              prem:{t:"diamonds", amount:15}},
  {lvl:2,  xp:600,   free:{t:"clover", ms:5*60000},              prem:{t:"coins", amount:50000}},
  {lvl:3,  xp:1500,  free:{t:"case", id:"start"},                prem:{t:"diamonds", amount:20}},
  {lvl:4,  xp:2800,  free:{t:"coins", amount:80000},             prem:{t:"suitcase", id:"suit_blades"}},
  {lvl:5,  xp:4500,  free:{t:"diamonds", amount:30},             prem:{t:"case", id:"chroma"}},
  {lvl:6,  xp:6800,  free:{t:"clover", ms:15*60000},             prem:{t:"diamonds", amount:25}},
  {lvl:7,  xp:9800,  free:{t:"coins", amount:200000},            prem:{t:"suitcase", id:"suit_gloves"}},
  {lvl:8,  xp:13500, free:{t:"case", id:"frost"},                prem:{t:"diamonds", amount:30}},
  {lvl:9,  xp:18000, free:{t:"coins", amount:500000},            prem:{t:"case", id:"void"}},
  {lvl:10, xp:24000, free:{t:"diamonds", amount:50},             prem:{t:"diamonds", amount:20}},
  {lvl:11, xp:31000, free:{t:"suitcase", id:"suit_relics"},      prem:{t:"coins", amount:2000000}},
  {lvl:12, xp:40000, free:{t:"case", id:"royal"},                prem:{t:"case", id:"season_limited"}}
];

function seasonIndex(){
  return Math.max(0, Math.floor((Date.now() - SEASON_START) / SEASON_MS));
}
function seasonFresh(index){
  return {index, xp:0, free:[], premium:[], premiumUnlocked:false, bought:0, dmSuits:0,
          contracts:0, masterUnlocked:false, master:[], vip:false, vipClaimed:[], completed:false};
}
function seasonLoad(d){
  const idx = seasonIndex();
  const s = d && d.season && typeof d.season === "object" ? d.season : null;
  if(s && numFrom(s.index) === idx){
    state.season = {
      index:idx,
      xp:Math.max(0, numFrom(s.xp)),
      free:Array.isArray(s.free) ? s.free.filter(n=>Number.isInteger(n)) : [],
      premium:Array.isArray(s.premium) ? s.premium.filter(n=>Number.isInteger(n)) : [],
      premiumUnlocked:s.premiumUnlocked === true,
      bought:Math.max(0, Math.min(SEASON_DIAMOND_MAX, numFrom(s.bought))),
      dmSuits:Math.max(0, numFrom(s.dmSuits)),
      contracts:Math.max(0, numFrom(s.contracts)),
      masterUnlocked:s.masterUnlocked === true,
      master:Array.isArray(s.master) ? s.master.filter(n=>Number.isInteger(n)) : [],
      vip:s.vip === true,
      vipClaimed:Array.isArray(s.vipClaimed) ? s.vipClaimed.filter(n=>Number.isInteger(n)) : [],
      completed:s.completed === true
    };
  } else {
    if(s && numFrom(s.index) < idx) state.stats.seasons = numFrom(state.stats.seasons) + 1;
    state.season = seasonFresh(idx);
  }
}
function seasonEnsure(){
  const idx = seasonIndex();
  if(state.season && numFrom(state.season.index) === idx) return false;
  const old = state.season;
  if(old && numFrom(old.index) < idx) state.stats.seasons = numFrom(state.stats.seasons) + 1;
  state.season = seasonFresh(idx);
  markDirty(); save({kind:"season"});
  if(typeof currentView !== "undefined" && currentView === "season" && typeof renderSeason === "function") renderSeason();
  toast("🏆 <b>Nowy sezon!</b> Świeża ścieżka nagród czeka w zakładce Sezon.","good");
  return true;
}
function seasonMerge(other){
  if(!other || typeof other !== "object") return;
  const mine = state.season || seasonFresh(seasonIndex());
  if(numFrom(other.index) !== numFrom(mine.index)) return;
  mine.xp = Math.max(numFrom(mine.xp), numFrom(other.xp));
  ["free","premium"].forEach(k=>{
    const arr = Array.isArray(other[k]) ? other[k] : [];
    mine[k] = [...new Set((mine[k]||[]).concat(arr.filter(n=>Number.isInteger(n))))];
  });
  mine.premiumUnlocked = mine.premiumUnlocked || other.premiumUnlocked === true;
  mine.bought = Math.max(numFrom(mine.bought), numFrom(other.bought));
  mine.dmSuits = Math.max(numFrom(mine.dmSuits), numFrom(other.dmSuits));
  mine.contracts = Math.max(numFrom(mine.contracts), numFrom(other.contracts));
  mine.masterUnlocked = mine.masterUnlocked || other.masterUnlocked === true;
  mine.vip = mine.vip || other.vip === true;
  ["master","vipClaimed"].forEach(k=>{
    mine[k] = [...new Set((mine[k]||[]).concat(Array.isArray(other[k]) ? other[k].filter(n=>Number.isInteger(n)) : []))];
  });
  mine.completed = mine.completed || other.completed === true;
  state.season = mine;
}
function seasonAddXp(amount){
  if(!state.season) return;
  const before = numFrom(state.season.xp);
  state.season.xp = before + Math.max(0, Math.round(amount));
  const reached = SEASON_TIERS.filter(t=>state.season.xp >= t.xp).length;
  if(reached > numFrom(state.stats.seasonLevels)) state.stats.seasonLevels = reached;
  if(reached >= SEASON_TIERS.length && !state.season.completed){
    state.season.completed = true;
    sfxWin("special");
    confetti(["#22d3ee","#fbbf24","#ffffff","#a855f7"]);
    toast("🏆 <b>SEZON UKOŃCZONY!</b> Odbierz limitowaną Skrzynkę Sezonową z premium!","good");
  }
  seasonCheckMaster();
  markDirty();
}
function seasonCheckMaster(){
  if(!state.season || state.season.masterUnlocked) return;
  const reached = SEASON_TIERS.filter(t=>state.season.xp>=t.xp).length;
  if(numFrom(state.season.contracts) >= SEASON_MASTER_CONTRACTS || reached >= 8){
    state.season.masterUnlocked = true;
    sfxWin("special");
    confetti(["#ffd54a","#f59e0b","#ffffff"]);
    toast("🛡️ <b>KARNET MISTRZA ODBLOKOWANY!</b> Dodatkowa darmowa ścieżka nagród czeka w Sezonie.","good");
    markDirty();
  }
}
function seasonMasterClaim(i){
  if(!state.season || !state.season.masterUnlocked) return;
  const r = SEASON_MASTER_REWARDS[i];
  if(!r || !seasonReached(i) || state.season.master.indexOf(i)>=0) return;
  seasonGrant(r);
  state.season.master.push(i);
  sfxCoin(); confetti(["#ffd54a","#ffffff"]);
  toast("🛡️ <b>Karnet Mistrza · poziom "+(i+1)+":</b> "+seasonRewardText(r),"good");
  markDirty(); save({kind:"season"}); renderBalance(); renderInv(); renderShop(); renderSeason();
}
function seasonUnlockVip(){
  if(!state.season || state.season.vip) return;
  if(numFrom(state.diamonds) < SEASON_VIP_COST){ sfxErr(); toast("Za mało diamentów na VIP — potrzebujesz "+SEASON_VIP_COST+" 💎.","bad"); return; }
  if(!state.season.premiumUnlocked){ sfxErr(); toast("Najpierw odblokuj Premium — VIP jest dla niego dodatkiem.","bad"); return; }
  if(typeof bossGatePassed === "function" && !bossGatePassed()){ sfxErr(); toast("Season VIP wymaga ukończenia rozdziału 5 kampanii bossów.","bad"); return; }
  state.diamonds -= SEASON_VIP_COST;
  state.season.vip = true;
  sfxWin("special"); confetti(["#ffd54a","#c084fc","#ffffff"]);
  toast("👑 <b>SEASON VIP AKTYWNY!</b> Kosmetyczne nagrody na wyższych poziomach.","good");
  markDirty(); save({kind:"season"}); renderBalance(); renderSeason();
}
function seasonVipClaim(i){
  if(!state.season || !state.season.vip) return;
  const r = SEASON_VIP_REWARDS[i];
  if(!r || !seasonReached(i) || state.season.vipClaimed.indexOf(i)>=0) return;
  state.season.vipClaimed.push(i);
  sfxCoin(); confetti(["#ffd54a","#c084fc"]);
  toast("👑 <b>Season VIP:</b> "+r.icon+" "+r.name,"good");
  markDirty(); save({kind:"season"}); renderSeason();
}
function seasonTier(i){ return SEASON_TIERS[i] || null; }
function seasonReached(i){ return !!state.season && state.season.xp >= (seasonTier(i)||{}).xp; }
function seasonClaimed(i, track){
  const arr = state.season ? state.season[track] : [];
  return Array.isArray(arr) && arr.indexOf(i) >= 0;
}
function seasonRewardText(r){
  if(!r) return "";
  if(r.t === "coins") return "🪙 "+fmt(r.amount);
  if(r.t === "clover") return "🍀 "+Math.round(r.ms/60000)+" min";
  if(r.t === "diamonds") return "💎 "+r.amount;
  if(r.t === "case" || r.t === "suitcase"){
    const c = CASES.find(x=>x.id===r.id);
    return (c && c.suitcase ? "🧳 " : "📦 ")+(c ? c.name : r.id);
  }
  return "";
}
function seasonRewardIcon(r){
  if(!r) return {icon:"🎁", color:"#94a3b8"};
  if(r.t === "coins") return {icon:"🪙", color:"#fbbf24"};
  if(r.t === "clover") return {icon:"🍀", color:"#38e08a"};
  if(r.t === "diamonds") return {icon:"💎", color:"#c084fc"};
  if(r.t === "case" || r.t === "suitcase"){
    const c = CASES.find(x=>x.id===r.id);
    return {icon:c ? (c.suitcase ? "🧳" : c.icon) : "📦", color:c ? c.color : "#38bdf8"};
  }
  return {icon:"🎁", color:"#94a3b8"};
}
function seasonGrant(r){
  if(!r) return;
  if(r.t === "coins"){
    state.coins += r.amount;
    state.stats.earned = numFrom(state.stats.earned) + r.amount;
  } else if(r.t === "clover"){
    state.cloverUntil = Math.max(Date.now(), state.cloverUntil||0) + r.ms;
    if(typeof updateClover === "function") updateClover();
  } else if(r.t === "diamonds"){
    state.diamonds = numFrom(state.diamonds) + r.amount;
  } else if(r.t === "case" || r.t === "suitcase"){
    state.caseStock = (state.caseStock && typeof state.caseStock === "object" && !Array.isArray(state.caseStock)) ? state.caseStock : {};
    state.caseStock[r.id] = numFrom(state.caseStock[r.id]) + 1;
  }
}
function seasonClaim(i, track){
  const t = seasonTier(i);
  if(!t || !state.season) return;
  if(track === "premium" && !state.season.premiumUnlocked){
    sfxErr(); toast("Najpierw odblokuj ścieżkę 💎 Premium.","bad"); return;
  }
  if(!seasonReached(i)){ sfxErr(); toast("Nie osiągnąłeś jeszcze tego poziomu.","bad"); return; }
  if(seasonClaimed(i, track)){ sfxErr(); return; }
  const r = track === "premium" ? t.prem : t.free;
  seasonGrant(r);
  state.season[track].push(i);
  sfxCoin(); confetti(["#22d3ee","#fbbf24","#ffffff"]);
  toast("🏆 <b>Poziom "+t.lvl+" · "+(track === "premium" ? "Premium" : "Darmowy")+":</b> "+seasonRewardText(r),"good");
  markDirty(); save({kind:"season"});
  renderBalance(); renderInv(); renderShop(); renderSeason();
}
function seasonUnlockPremium(){
  if(!state.season || state.season.premiumUnlocked) return;
  if(numFrom(state.diamonds) < SEASON_PREMIUM_COST){
    sfxErr(); toast("Za mało diamentów — potrzebujesz "+SEASON_PREMIUM_COST+" 💎.","bad"); return;
  }
  state.diamonds -= SEASON_PREMIUM_COST;
  state.season.premiumUnlocked = true;
  sfxWin("special"); confetti(["#22d3ee","#fbbf24","#ffffff"]);
  toast("💎 <b>Premium odblokowany!</b> Wszystkie nagrody diamentowe są teraz dostępne.","good");
  markDirty(); save({kind:"season"}); renderBalance(); renderSeason();
}
function seasonBuyDiamonds(){
  if(!state.season) return;
  if(state.season.bought >= SEASON_DIAMOND_MAX){
    sfxErr(); toast("W tym sezonie wymieniłeś już maksimum monet na diamenty.","bad"); return;
  }
  if(state.coins < SEASON_DIAMOND_PRICE){
    sfxErr(); toast("Za mało monet na diament.","bad"); return;
  }
  state.coins -= SEASON_DIAMOND_PRICE;
  state.diamonds = numFrom(state.diamonds) + 1;
  state.season.bought++;
  sfxCoin(); toast("💎 Kupiono 1 diament. Pozostało wymian: "+(SEASON_DIAMOND_MAX-state.season.bought)+".","good");
  markDirty(); save({kind:"season"}); renderBalance(); renderSeason();
}
function seasonTimeLeft(){
  const idx = seasonIndex();
  const end = SEASON_START + (idx+1)*SEASON_MS;
  const ms = Math.max(0, end - Date.now());
  const d = Math.floor(ms/86400000), h = Math.floor(ms%86400000/3600000);
  return d+" dni "+h+" godz.";
}
function renderSeason(){
  const body = $("#seasonBody");
  if(!body || !state.season) return;
  const s = state.season;
  if(typeof document !== "undefined") document.body.classList.toggle("season-vip", s.vip === true);
  const reached = SEASON_TIERS.filter(t=>s.xp>=t.xp).length;
  const pct = Math.min(100, Math.round(100*s.xp/SEASON_TIERS[SEASON_TIERS.length-1].xp));
  const next = SEASON_TIERS[reached] || null;
  const cards = SEASON_TIERS.map((t,i)=>{
    const ok = seasonReached(i);
    const fr = seasonClaimed(i,"free"), pr = seasonClaimed(i,"premium");
    const canF = ok && !fr, canP = ok && !pr && s.premiumUnlocked;
    const current = reached > 0 && i === reached-1;
    const fi = seasonRewardIcon(t.free), pi = seasonRewardIcon(t.prem);
    const mr = SEASON_MASTER_REWARDS[i], vr = SEASON_VIP_REWARDS[i];
    const mClaimed = s.master.indexOf(i)>=0, vClaimed = s.vipClaimed.indexOf(i)>=0;
    const canM = !!mr && s.masterUnlocked && ok && !mClaimed;
    const canV = !!vr && s.vip && ok && !vClaimed;
    const done = fr && (pr || !s.premiumUnlocked);
    return `<div class="season-tier${ok?" reached":""} ${done?" done":""} ${current?" current":""}" style="animation-delay:${i*55}ms">
      <div class="st-glow"></div>
      <div class="st-top"><span class="st-lvl">${t.lvl}</span><span class="st-xp">${fmt(t.xp)} XP</span>${current?'<span class="st-now">TERAZ</span>':""}</div>
      <div class="st-art" style="--c:${fi.color}"><span class="st-art-i">${fi.icon}</span><span class="st-art-foil"></span></div>
      <div class="st-row free"><span class="st-ri">${fi.icon}</span><div class="st-copy"><small>DARMOWE</small><b>${seasonRewardText(t.free)}</b></div>
        <button class="mini-btn" data-season-claim="free:${i}" ${canF?"":"disabled"}>${fr?"✔":"Odbierz"}</button></div>
      <div class="st-row prem${s.premiumUnlocked?"":" locked"}" style="--c:${pi.color}"><span class="st-ri">${s.premiumUnlocked?pi.icon:"🔒"}</span><div class="st-copy"><small>💎 PREMIUM</small><b>${s.premiumUnlocked?seasonRewardText(t.prem):"🔒 "+seasonRewardText(t.prem)}</b></div>
        <button class="mini-btn" data-season-claim="premium:${i}" ${canP?"":"disabled"}>${pr?"✔":s.premiumUnlocked?"Odbierz":"🔒"}</button></div>
      ${mr ? `<div class="st-row master${s.masterUnlocked?"":" locked"}"><span class="st-ri">${s.masterUnlocked?seasonRewardIcon(mr).icon:"🔒"}</span><div class="st-copy"><small>🛡️ MISTRZ</small><b>${s.masterUnlocked?seasonRewardText(mr):"🔒 "+seasonRewardText(mr)}</b></div>
        <button class="mini-btn" data-season-master="${i}" ${canM?"":"disabled"}>${mClaimed?"✔":s.masterUnlocked?"Odbierz":"🔒"}</button></div>` : ""}
      ${vr ? `<div class="st-row vip${s.vip?"":" locked"}"><span class="st-ri">${s.vip?vr.icon:"🔒"}</span><div class="st-copy"><small>👑 VIP · KOSMETYKA</small><b>${s.vip?vr.name:"🔒 "+vr.name}</b></div>
        <button class="mini-btn" data-season-vip="${i}" ${canV?"":"disabled"}>${vClaimed?"✔":s.vip?"Odbierz":"🔒"}</button></div>` : ""}
    </div>`;
  }).join("");
  const nextReward = next ? next.free : SEASON_TIERS[SEASON_TIERS.length-1].free;
  const ni = seasonRewardIcon(nextReward);
  body.innerHTML = `
    <div class="season-hero">
      <div class="sh-rays"></div>
      <div class="sh-ico"><span>🏆</span><i class="sh-ico-ring"></i></div>
      <div class="sh-main"><span class="sh-kicker">SEZON ${s.index+1} · 8 TYGODNI · ZŁOTA ERA</span>
        <h3>Ścieżka sezonowa</h3>
        <div class="sh-bar"><i style="width:${pct}%"></i><span class="sh-shine"></span></div>
        <div class="sh-sub">Poziom <b>${reached} / ${SEASON_TIERS.length}</b> · ${fmt(s.xp)} XP · ${next?"następny za <b>"+fmt(next.xp-s.xp)+" XP</b>":"<b>WSZYSTKIE POZIOMY</b>"}</div>
        <div class="sh-next"><span style="--c:${ni.color}">${ni.icon}</span>${next?"Następna nagroda: "+seasonRewardText(nextReward):"Sezon ukończony — odbierz nagrody!"}</div>
      </div>
      <div class="sh-side">
        <div class="sh-diam"><b>💎 ${fmt(state.diamonds)}</b><small>diamentów</small></div>
        <div class="sh-time"><b>${seasonTimeLeft()}</b><small>pozostało</small></div>
      </div>
    </div>
    <div class="season-actions">
      ${s.premiumUnlocked
        ? '<span class="season-unlocked">💎 Premium aktywny</span>'
        : `<button class="btn primary" id="seasonUnlockBtn">💎 Odblokuj Premium (${SEASON_PREMIUM_COST})</button>`}
      ${s.masterUnlocked
        ? '<span class="season-master-tag">🛡️ Karnet Mistrza aktywny</span>'
        : `<span class="season-master-tag locked">🛡️ Mistrz: ${numFrom(s.contracts)}/${SEASON_MASTER_CONTRACTS} kontraktów (lub poziom 8)</span>`}
      <button class="btn gold" id="seasonBuyDiamBtn">🪙 Kup 1 diament (${fmt(SEASON_DIAMOND_PRICE)})</button>
      <span class="season-muted">wymiany monet: ${s.bought}/${SEASON_DIAMOND_MAX}</span>
    </div>
    <div class="season-passes">
      <div class="pass-card master${s.masterUnlocked?" on":""}">
        <div class="pc-head"><span class="pc-ico">🛡️</span><div><b>KARNET MISTRZA</b><small>darmowy · dodatkowe nagrody</small></div><span class="pc-badge">FREE</span></div>
        <div class="pc-desc">Odblokuj się wykonując <b>6 kontraktów Bazaru</b> w tym sezonie albo osiągając <b>8. poziom</b>.</div>
        <div class="pc-bar"><i style="width:${Math.min(100, Math.round(100*Math.max(numFrom(s.contracts)/SEASON_MASTER_CONTRACTS, reached/8)))}%"></i></div>
        <div class="pc-foot">${s.masterUnlocked
          ? `✔ Odbierz nagrody: <b>${s.master.length}/${Object.keys(SEASON_MASTER_REWARDS).length}</b>`
          : `${numFrom(s.contracts)}/${SEASON_MASTER_CONTRACTS} kontraktów · poziom ${reached}/8`}</div>
      </div>
      <div class="pass-card vip${s.vip?" on":""}">
        <div class="pc-head"><span class="pc-ico">👑</span><div><b>SEASON VIP</b><small>płatny · tylko kosmetyka</small></div><span class="pc-badge">VIP</span></div>
        <div class="pc-desc">Złota ramka, aura mistrza i tytuł. <b>Bez przewagi w grze</b> — wymaga aktywnego Premium.</div>
        ${s.vip
          ? `<div class="pc-foot">✔ Aktywny · odebrano <b>${s.vipClaimed.length}/${Object.keys(SEASON_VIP_REWARDS).length}</b></div>`
          : (typeof bossGatePassed === "function" && !bossGatePassed()
              ? `<button class="btn gold pc-unlock" disabled>🔒 Wymaga rozdziału 5</button>`
              : `<button class="btn gold pc-unlock" data-vip-unlock>👑 Odblokuj za ${SEASON_VIP_COST} 💎</button>`)}
      </div>
    </div>
    <div class="season-track-wrap">
      <button class="season-nav prev" id="seasonPrev" aria-label="Przewiń ścieżkę w lewo">‹</button>
      <div class="season-line"><i style="width:${pct}%"></i></div>
      <div class="season-track" id="seasonTrack">${cards}</div>
      <button class="season-nav next" id="seasonNext" aria-label="Przewiń ścieżkę w prawo">›</button>
    </div>
    <div class="season-scroll-hint">Przesuń w prawo lub przeciągnij ścieżkę, aby zobaczyć kolejne poziomy →</div>
    <div class="season-note">Postęp sezonu rośnie razem z EXP ze skrzynek, bitew, misji i kasyna. Diamenty zostają na kolejne sezony — resetuje się tylko ścieżka nagród.</div>
  `;
  requestAnimationFrame(()=>{
    const track = $("#seasonTrack");
    if(!track) return;
    const active = track.querySelector(".season-tier.current");
    if(active) track.scrollLeft = Math.max(0, active.offsetLeft - track.clientWidth/2 + active.clientWidth/2);
  });
}
function seasonScroll(dir){
  const track = $("#seasonTrack");
  if(!track) return;
  const max = track.scrollWidth - track.clientWidth;
  const to = Math.max(0, Math.min(max, track.scrollLeft + dir * Math.max(240, track.clientWidth*0.72)));
  if(state.reduceMotion || state.perfMode){ track.scrollLeft = to; return; }
  const from = track.scrollLeft, start = Date.now(), dur = 320;
  const step = ()=>{
    const p = Math.min(1, (Date.now()-start)/dur);
    const e = 1-Math.pow(1-p,3);
    track.scrollLeft = from + (to-from)*e;
    if(p<1) setTimeout(step, 16);
  };
  setTimeout(step, 16);
}
const seasonView = document.getElementById("view-season");
if(seasonView){
  seasonView.addEventListener("click", e=>{
    if(e.target.closest("#seasonPrev")){ seasonScroll(-1); return; }
    if(e.target.closest("#seasonNext")){ seasonScroll(1); return; }
    if(e.target.closest("#seasonUnlockBtn")){ seasonUnlockPremium(); return; }
    if(e.target.closest("#seasonBuyDiamBtn")){ seasonBuyDiamonds(); return; }
    if(e.target.closest("[data-vip-unlock]")){ seasonUnlockVip(); return; }
    const mb = e.target.closest("[data-season-master]");
    if(mb){ seasonMasterClaim(Number(mb.dataset.seasonMaster)); return; }
    const vb = e.target.closest("[data-season-vip]");
    if(vb){ seasonVipClaim(Number(vb.dataset.seasonVip)); return; }
    const b = e.target.closest("[data-season-claim]");
    if(!b) return;
    const [track, i] = b.dataset.seasonClaim.split(":");
    seasonClaim(Number(i), track);
  });
  /* kółko myszy nad ścieżką przewija w poziomie */
  seasonView.addEventListener("wheel", e=>{
    const track = e.target.closest("#seasonTrack");
    if(!track) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if(!delta) return;
    e.preventDefault();
    track.scrollLeft += delta;
  }, {passive:false});
  /* przeciąganie myszką — na telefonie działa natywny swipe */
  let drag = null;
  seasonView.addEventListener("pointerdown", e=>{
    const track = e.target.closest("#seasonTrack");
    if(!track || e.pointerType === "touch") return;
    drag = {el:track, x:e.clientX, left:track.scrollLeft, moved:false};
  });
  seasonView.addEventListener("pointermove", e=>{
    if(!drag) return;
    const dx = e.clientX - drag.x;
    if(Math.abs(dx) > 3) drag.moved = true;
    drag.el.scrollLeft = drag.left - dx;
  });
  const endDrag = ()=>{
    if(drag && drag.moved){
      const el = drag.el;
      const card = Math.round(el.scrollLeft / 250);
      el.scrollTo({left:card*250, behavior:"smooth"});
    }
    drag = null;
  };
  seasonView.addEventListener("pointerup", endDrag);
  seasonView.addEventListener("pointercancel", endDrag);
  seasonView.addEventListener("pointerleave", endDrag);
}
