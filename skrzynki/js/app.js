"use strict";

/* =======================================================================
   15. TRWAŁOŚĆ — autozapis i zapis przy zamykaniu
   ======================================================================= */
setInterval(()=>{ if(dirty) save(); }, 4000);
setInterval(()=>{
  checkDailyRoll();      // 🎯 misje przechodzą na nowy dzień też bez przeładowania
  checkWeeklyRoll();     // 📅 a tygodniowe na nowy tydzień co 7 dni
  updateDailyHint();
  updateWeeklyHint();
  // siatka bezpieczeństwa: jeśli zapis zniknął/uszkodził się, odbudowujemy go
  // (celowo NIE porównujemy zawartości — to powodowało walkę między kartami)
  if(!isValidSave(readSave(SAVE_KEY))){ dirty = true; save(); }
}, 15000);

window.addEventListener("beforeunload", ()=>{ if(dirty) save(); });
window.addEventListener("pagehide", ()=>{ if(dirty) save(); });

/* 👹 BOSS FIGHT — gra o ogromną stawkę z szansą na unikalną broń */
const BOSSES = [
  {id:"boss_golem",  name:"Golem Cieni",     hp:1000000,  stake:5000000,   reward:25000000,   icon:"🗿", color:"#7c3aed"},
  {id:"boss_dragon", name:"Smok Otchłani",    hp:5000000,  stake:25000000,  reward:150000000,  icon:"🐉", color:"#ef4444"},
  {id:"boss_reaper", name:"Żniwiarz",        hp:15000000, stake:100000000, reward:800000000,  icon:"💀", color:"#d32ce6"}
];
function fightBoss(bossId){
  if(battleBusy || battleStage) return;
  const b = BOSSES.find(x=>x.id===bossId);
  if(!b) return;
  if(state.coins < b.stake){ sfxErr(); toast("Za mało monet na walkę z "+b.icon+" "+b.name+" (🪙 "+fmt(b.stake)+")","bad"); return; }
  battleBusy = true;
  state.coins -= b.stake;
  state.stats.spent += b.stake;
  state.stats.battles++;
  missionTrack("battle",1); missionTrack("spend",b.stake);
  const playerPower = Math.max(100, Math.floor(sumVal(state.inv.slice().sort((a,b)=>b.value-a.value).slice(0,5))) + state.coins*0.001);
  const win = playerPower > b.hp * (0.8 + Math.random()*0.4);
  state.battles.unshift({
    win, draw:false, cn:"Boss: "+b.name, n:1, cost:b.stake, gain: win?b.reward:0, ts:Date.now(),
    mt:"classified", mn:b.name+" · 👹", mval:playerPower, at:"special", an:"Boss", aval:b.hp
  });
  state.battles = state.battles.slice(0,8);
  if(win){
    state.stats.battleWins++;
    state.stats.bossWins = (state.stats.bossWins||0)+1;
    state.bossKills = state.bossKills || {};
    state.bossKills[b.id] = true;
    state.coins += b.reward;
    state.stats.earned += b.reward;
    missionTrack("win",1); missionTrack("battleearn",b.reward);
    toast("👹 <b>Pokonałeś "+b.name+"!</b> Nagroda: 🪙 "+fmt(b.reward),"good");
    confetti(["#ffd700","#ef4444","#a855f7","#38e08a"]);
  } else {
    sfxErr();
    toast("👹 <b>"+b.name+" Cię pokonał!</b> Straciłeś 🪙 "+fmt(b.stake),"bad");
  }
  markDirty(); save(); renderBalance(); renderStats();
  battleBusy = false;
  checkAchievements();
}

/* 🎰 KRÓLOWA GÓRY — maszyna losująca z rosnącym ryzykiem */
let kohPrize = 100000;
function playKoh(){
  if(battleBusy || battleStage) return;
  const kohPrize = getKohPrize();
  if(state.coins < kohPrize){ sfxErr(); toast("Za mało monet na Królową Góry (🪙 "+fmt(kohPrize)+")","bad"); return; }
  battleBusy = true;
  state.coins -= kohPrize;
  state.stats.spent += kohPrize;
  const roll = Math.max(0, Math.random() - KOH_STEP*upLvl("jackpot"));
  let result, mult;
  if(roll < 0.02){ result="JACKPOT"; mult=50; }
  else if(roll < 0.10){ result="Wielki wygrany"; mult=10; }
  else if(roll < 0.30){ result="Wygrana"; mult=3; }
  else if(roll < 0.60){ result="Mała wygrana"; mult=1.5; }
  else { result="Przegrana"; mult=0; }
  const gain = Math.round(kohPrize * mult);
  if(gain > 0){
    state.coins += gain;
    state.stats.earned += gain;
    missionTrack("battleearn",gain);
  }
  if(result==="JACKPOT" || result==="Wielki wygrany"){
    state.stats.kohWins = (state.stats.kohWins||0)+1;
  }
  const won = gain > 0;
  state.battles.unshift({
    win:won, draw:false, cn:"🎰 Królowa Góry", n:1, cost:kohPrize, gain, ts:Date.now(),
    mt: won?"classified":"mil", mn:result+" ×"+mult, mval:gain, at:"mil", an:"", aval:0
  });
  state.battles = state.battles.slice(0,8);
  kohPrize = Math.max(100000, Math.round(kohPrize * (won ? 0.5 : 2)));
  if(result==="JACKPOT") kohPrize = 100000;
  markDirty(); save(); renderBalance(); renderStats();
  battleBusy = false;
  if(won){ sfxCoin(); toast("🎰 <b>"+result+"!</b> Wygrywasz 🪙 "+fmt(gain)+" (×"+mult+")","good"); confetti(); }
  else { sfxErr(); toast("🎰 <b>"+result+"</b> — przegrywasz 🪙 "+fmt(kohPrize/2),"bad"); }
  checkAchievements();
}
document.addEventListener("visibilitychange", ()=>{ if(document.hidden && dirty) save(); });

// ostrzeżenie, jeśli przeglądarka blokuje zapis (np. tryb prywatny)
(function storageHealthcheck(){
  try{
    localStorage.setItem("__coTest","1");
    localStorage.removeItem("__coTest");
  }catch(e){
    setTimeout(()=>toast("⚠️ Przeglądarka <b>blokuje zapis</b> — postęp może przepaść! Zrób kopię (💾 Kopia).","bad"), 1200);
  }
})();

/* =======================================================================
   16. START
   ======================================================================= */
load();
// świeży gracz (albo zapis bez tych danych) dostaje od razu oba zestawy misji
if(!state.missions || !Array.isArray(state.missions.list) || !state.missions.list.length) rollMissions();
if(!state.weekly  || !Array.isArray(state.weekly.list)  || !state.weekly.list.length)  rollWeekly();
$("#soundBtn").textContent = state.sound ? "🔊" : "🔇";
$("#fastBtn").classList.toggle("on", state.fast);
renderBalance(true);
renderShop(); renderBots(); renderCodes(); renderInv(); renderStats(); renderUp(); renderBattle(); updateBonus(); updateClover();
shopTick();
renderAlbumBadge(); renderDailyBadge(); checkAchievements();
save();   // od razu utrwalamy wczytany stan (migracja starych zapisów)
if(state.stats.opened>0) toast("Witaj ponownie! Otwarte skrzynki: <b>"+state.stats.opened+"</b> · ekwipunek: <b>"+state.inv.length+"</b>","good");
setTimeout(grantRescue, 600);   // jeśli wracasz bez niczego — ratunek od razu