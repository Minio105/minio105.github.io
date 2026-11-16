"use strict";

/* =======================================================================
   🧭 PREFERENCJE INTERFEJSU — ostatni widok i filtry po odświeżeniu
   ======================================================================= */
const UI_PREF_KEY = "caseOpenerUi_v1";
const UI_VIEWS = ["shop","bots","market","codes","inv","stats","up","battle","album","daily","casino","events"];
function readUiPrefs(){
  try{
    const raw = localStorage.getItem(UI_PREF_KEY);
    const d = raw ? JSON.parse(raw) : null;
    return (d && typeof d === "object" && !Array.isArray(d)) ? d : {};
  }catch(e){ return {}; }
}
function writeUiPrefs(){
  try{
    const invFilter = $("#invFilter");
    const invSort = $("#invSort");
    const invSearch = $("#invSearch");
    localStorage.setItem(UI_PREF_KEY, JSON.stringify({
      view: typeof currentView === "string" && UI_VIEWS.includes(currentView) ? currentView : "shop",
      shopFilter: typeof shopFilter === "string" ? shopFilter : "all",
      invFilter: invFilter ? invFilter.value : "all",
      invSort: invSort ? invSort.value : "value",
      invSearch: invSearch ? invSearch.value : ""
    }));
  }catch(e){}
}
function applyUiPrefs(p){
  p = p && typeof p === "object" ? p : {};
  if(typeof p.shopFilter === "string" && typeof SHOP_FILTERS !== "undefined" && SHOP_FILTERS.some(f=>f.id===p.shopFilter)){
    shopFilter = p.shopFilter;
  }
  const invFilter = $("#invFilter");
  if(invFilter && typeof p.invFilter === "string" && [...invFilter.options].some(o=>o.value===p.invFilter)){
    invFilter.value = p.invFilter;
  }
  const invSort = $("#invSort");
  if(invSort && typeof p.invSort === "string" && [...invSort.options].some(o=>o.value===p.invSort)){
    invSort.value = p.invSort;
  }
  const invSearch = $("#invSearch");
  if(invSearch) invSearch.value = typeof p.invSearch === "string" ? p.invSearch.slice(0,80) : "";
}

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

/* =======================================================================
   👹 INTERAKTYWNA ARENA BOSSÓW (ZMODERNIZOWANY SYSTEM WALKI)
   ======================================================================= */
const BOSSES = [
  {
    id: "boss_golem",
    name: "Golem Cieni",
    title: "Starożytny Strażnik Skarbca",
    desc: "Kamienny olbrzym nasycony ciemną magią. Zadaje ciężkie, powolne ciosy.",
    hp: 1500000,
    stake: 5000000,
    reward: 25000000,
    icon: "🗿",
    color: "#7c3aed",
    attackPower: 0.22,
    drop: { w: "Kosa Cienia", n: "Relikt Golema", tier: "relic", art: "knife", value: 45000000 }
  },
  {
    id: "boss_dragon",
    name: "Smok Otchłani",
    title: "Władca Magmowych Szczelin",
    desc: "Ziejący czarnym ogniem smok. Potrafi podpalić i wyprowadzić niszczycielskie uderzenie.",
    hp: 6000000,
    stake: 25000000,
    reward: 150000000,
    icon: "🐉",
    color: "#ef4444",
    attackPower: 0.26,
    drop: { w: "AWP", n: "Smoczy Żar Otchłani", tier: "relic", art: "awp", value: 280000000 }
  },
  {
    id: "boss_reaper",
    name: "Żniwiarz",
    title: "Zbieracz Zagubionych Dusz",
    desc: "Legendarny kosiarz dusz. Posiada zdolność kradzieży życia i morderczy szał.",
    hp: 18000000,
    stake: 100000000,
    reward: 800000000,
    icon: "💀",
    color: "#d32ce6",
    attackPower: 0.30,
    drop: { w: "Karambit", n: "Ostatnie Żniwa", tier: "relic", art: "knife", value: 1500000000 }
  }
];

let activeBossFight = null;
let bossViewMode = "quick";

/* 👑 KAMPANIA BOSSÓW — rozdziały, etapy i modyfikatory.
   Królowa Góry jest pierwszym rozdziałem; dalej otwiera się Otchłań. */
const BOSS_CAMPAIGN = [
  {
    id:"chapter_1", name:"Królowa Góry", icon:"👑", color:"#fbbf24",
    desc:"Pierwszy rozdział kampanii. Wejdź na szczyt i udowodnij, że nie boisz się korony.",
    stages:[
      {id:"c1s1", bossId:"boss_golem", name:"Strażnik Korony", desc:"Golem pilnuje wejścia na szczyt. Musisz zmieścić się w limicie tur.", mods:["limit"], maxRounds:10, bonus:10000000, caseId:"smuggler"},
      {id:"c1s2", bossId:"boss_dragon", name:"Smok pod Tronem", desc:"Smok odwraca szczęście: ciężkie ciosy zawodzą częściej, a jego szał jest groźniejszy.", mods:["reversed"], bonus:30000000, caseId:"sticker"},
      {id:"c1s3", bossId:"boss_reaper", name:"Królowa Cieni", desc:"Ostatnia strażniczka korony zakazuje ulepszeń. Tylko czysta taktyka.", mods:["noheal"], bonus:100000000, caseId:"gambler"}
    ]
  },
  {
    id:"chapter_2", name:"Otchłań", icon:"🌑", color:"#a855f7",
    desc:"Korona pękła, a pod górą otworzyła się Otchłań. Bossowie są silniejsi i nie wybaczają błędów.",
    stages:[
      {id:"c2s1", bossId:"boss_golem", name:"Golem z Otchłani", desc:"Wzmocniony gniewem Otchłani. Każdy jego cios boli znacznie bardziej.", mods:["bossRage"], bonus:250000000, caseId:"reaper"},
      {id:"c2s2", bossId:"boss_dragon", name:"Smok Zagłady", desc:"Limit tur i wściekłość bossa jednocześnie. Nie ma miejsca na wahanie.", mods:["limit","bossRage"], maxRounds:8, bonus:500000000, caseId:"reaper"},
      {id:"c2s3", bossId:"boss_reaper", name:"Żniwiarz Królowej", desc:"Odwrócone szczęście i zakaz ulepszeń. Finał kampanii.", mods:["reversed","noheal"], bonus:1000000000, caseId:"gambler"}
    ]
  }
];
const BOSS_MOD_INFO = {
  limit:{icon:"⏳", name:"Limit tur", desc:"Musisz pokonać bossa w ograniczonej liczbie tur."},
  reversed:{icon:"🔀", name:"Odwrócone szczęście", desc:"Ciężkie ciosy mają tylko 25% szans, a boss częściej używa specjalnych ataków."},
  noheal:{icon:"🚫", name:"Zakaz ulepszeń", desc:"Mikstura i regeneracja są zablokowane."},
  bossRage:{icon:"🔥", name:"Szał bossa", desc:"Boss zadaje o 30% więcej obrażeń."}
};
function bossCampaignStage(stageId){
  for(const ch of BOSS_CAMPAIGN){
    const st = ch.stages.find(x=>x.id===stageId);
    if(st) return { chapter:ch, stage:st };
  }
  return null;
}
function bossCampaignCleared(stageId){
  return !!(state.bossCampaign && state.bossCampaign.cleared && state.bossCampaign.cleared[stageId]);
}
function bossCampaignChapterUnlocked(chapterIndex){
  if(chapterIndex <= 0) return true;
  const prev = BOSS_CAMPAIGN[chapterIndex - 1];
  return !!prev && prev.stages.every(st=>bossCampaignCleared(st.id));
}
function bossCampaignStageUnlocked(chapterIndex, stageIndex){
  if(!bossCampaignChapterUnlocked(chapterIndex)) return false;
  if(stageIndex <= 0) return true;
  const ch = BOSS_CAMPAIGN[chapterIndex];
  return !!ch && bossCampaignCleared(ch.stages[stageIndex - 1].id);
}
function bossCampaignCurrent(){
  for(let ci=0; ci<BOSS_CAMPAIGN.length; ci++){
    if(!bossCampaignChapterUnlocked(ci)) break;
    for(const st of BOSS_CAMPAIGN[ci].stages){
      if(!bossCampaignCleared(st.id)) return { chapter:BOSS_CAMPAIGN[ci], stage:st };
    }
  }
  return null;
}
function bossModInfo(id){ return BOSS_MOD_INFO[id] || {icon:"⚙️", name:id, desc:""}; }
function bossMod(f, id){ return !!(f && Array.isArray(f.mods) && f.mods.indexOf(id) >= 0); }
function bossCampaignHTML(){
  const playerStats = calcPlayerCombatStats();
  const current = bossCampaignCurrent();
  let html = `<div class="campaign-intro">
    <div><b>👑 Kampania bossów</b> — ${BOSS_CAMPAIGN.reduce((a,ch)=>a+ch.stages.length,0)} etapów w ${BOSS_CAMPAIGN.length} rozdziałach.</div>
    <div class="muted">Twoja moc: <b>HP ${fmt(playerStats.maxHp)}</b> · <b>Atak ~${fmt(playerStats.dmg)}</b>.${current ? " Następny etap: <b>"+esc(current.stage.name)+"</b>." : " <b style='color:var(--ok)'>Kampania ukończona!</b>"}</div>
  </div>`;
  BOSS_CAMPAIGN.forEach((ch,ci)=>{
    const unlocked = bossCampaignChapterUnlocked(ci);
    const clearedCount = ch.stages.filter(st=>bossCampaignCleared(st.id)).length;
    html += `<div class="campaign-chapter ${unlocked?"":"locked"}" style="--cc:${ch.color}">
      <div class="campaign-chapter-head">
        <span class="cch-ico">${ch.icon}</span>
        <div><b>${esc(ch.name)}</b><small>${clearedCount} / ${ch.stages.length} etapów</small></div>
        <span class="cch-state">${!unlocked ? "🔒 zablokowany" : clearedCount===ch.stages.length ? "✔ ukończony" : "▶ dostępny"}</span>
      </div>
      <div class="campaign-desc">${esc(ch.desc)}</div>
      <div class="campaign-stages">`;
    ch.stages.forEach((st,si)=>{
      const boss = BOSSES.find(b=>b.id===st.bossId);
      const cleared = bossCampaignCleared(st.id);
      const can = bossCampaignStageUnlocked(ci,si);
      const mods = (st.mods||[]).map(id=>{ const m=bossModInfo(id); return `<span class="camp-mod" title="${esc(m.desc)}">${m.icon} ${esc(m.name)}</span>`; }).join("");
      const afford = boss && state.coins >= boss.stake;
      html += `<div class="campaign-stage ${cleared?"cleared":""} ${can?"":"locked"}">
        <div class="cs-head"><span class="cs-ico">${boss ? boss.icon : "👹"}</span><div><b>${esc(st.name)}</b><small>${boss ? esc(boss.name) : "Boss"} · etap ${si+1}</small></div>${cleared?'<span class="cs-done">✔</span>':""}</div>
        <div class="cs-desc">${esc(st.desc)}</div>
        <div class="cs-mods">${mods}</div>
        <div class="cs-foot"><span>Stawka: <b>🪙 ${boss?fmtShort(boss.stake):"?"}</b></span><span>Bonus: <b>🪙 ${fmtShort(st.bonus||0)}</b>${st.caseId?" + 📦":""}</span></div>
        <button class="btn primary cs-btn" data-campaign-stage="${st.id}" ${can && afford ? "" : "disabled"}>${!can ? "🔒 Zablokowany" : !afford ? "Za mało monet" : cleared ? "🔁 Powtórz etap" : "⚔️ Start etapu"}</button>
      </div>`;
    });
    html += `</div></div>`;
  });
  return html;
}

function calcPlayerCombatStats() {
  const topSkins = state.inv.slice().sort((a,b)=>b.value-a.value).slice(0, 5);
  const skinPower = sumVal(topSkins);
  const coinBonus = Math.floor(state.coins * 0.002);
  const baseHp = Math.max(800000, Math.floor(skinPower * 1.3) + coinBonus);
  const baseDmg = Math.max(120000, Math.floor(baseHp * 0.25));
  return { hp: baseHp, maxHp: baseHp, dmg: baseDmg, topSkins };
}

function openBossModal() {
  const overlay = $("#bossOverlay");
  if (!overlay) return;
  if(typeof hideRecordFx === "function") hideRecordFx();
  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
  renderBossList();
}

function closeBossModal() {
  const overlay = $("#bossOverlay");
  if (!overlay) return;
  if(typeof hideRecordFx === "function") hideRecordFx();
  overlay.classList.remove("show");
  overlay.setAttribute("aria-hidden", "true");
  activeBossFight = null;
}

function renderBossList() {
  if(typeof hideRecordFx === "function") hideRecordFx();
  const title = $("#bossModalTitle");
  if (title) title.innerHTML = `👹 Arena bossów`;
  const body = $("#bossModalBody");
  if (!body) return;

  const tabs = `<div class="boss-mode-tabs">
    <button class="boss-mode-tab ${bossViewMode==="quick"?"active":""}" data-bossmode="quick">⚔️ Szybka walka</button>
    <button class="boss-mode-tab ${bossViewMode==="campaign"?"active":""}" data-bossmode="campaign">👑 Kampania</button>
  </div>`;

  if (bossViewMode === "campaign") {
    body.innerHTML = tabs + bossCampaignHTML();
    body.querySelectorAll("[data-bossmode]").forEach(btn => {
      btn.addEventListener("click", () => { bossViewMode = btn.dataset.bossmode; renderBossList(); });
    });
    body.querySelectorAll("[data-campaign-stage]").forEach(btn => {
      btn.addEventListener("click", () => {
        const found = bossCampaignStage(btn.dataset.campaignStage);
        if (found) startBossFight(found.stage.bossId, found.stage);
      });
    });
    return;
  }

  const playerStats = calcPlayerCombatStats();
  const kills = state.bossKills || {};

  let html = tabs + `
    <div style="margin-bottom:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid var(--line);font-size:12.5px;line-height:1.5;">
      Twoja aktualna moc bojowa z 5 najlepszych skinów i monet: 
      <b style="color:var(--ok)">HP: ${fmt(playerStats.maxHp)}</b> · 
      <b style="color:var(--acc)">Bazowy Atak: ~${fmt(playerStats.dmg)}</b>
      <div class="muted" style="font-size:11.5px;margin-top:4px;">
        Pokonaj bossa w turze strategicznej, aby zdobyć <b>ogromną pulę monet</b> oraz szansę na <b>✦ Legendarny Relikt Bossa</b>!
        Kampania dodaje <b>modyfikatory</b> i dodatkowe nagrody.
      </div>
    </div>
    <div class="boss-select-grid">
  `;

  BOSSES.forEach(b => {
    const isDefeated = !!kills[b.id];
    const canAfford = state.coins >= b.stake;
    html += `
      <div class="boss-card ${isDefeated ? 'defeated' : ''}" style="--bc:${b.color}">
        <div class="boss-card-head">
          <div class="boss-icon-wrap">${b.icon}</div>
          <div class="boss-meta">
            <h4>${b.name}</h4>
            <span class="boss-title-sub">${b.title}</span>
          </div>
        </div>
        <div class="boss-desc">${b.desc}</div>
        <div class="boss-stat-list">
          <div class="boss-stat-row"><span>Zdrowie (HP):</span><b style="color:#ef4444">${fmt(b.hp)}</b></div>
          <div class="boss-stat-row"><span>Stawka wejścia:</span><b style="color:var(--acc)">🪙 ${fmtShort(b.stake)}</b></div>
          <div class="boss-stat-row"><span>Główna nagroda:</span><b style="color:var(--ok)">🪙 ${fmtShort(b.reward)}</b></div>
        </div>
        <div class="boss-drop-preview">
          <span>🎁 Łup:</span> <b>✦ ${b.drop.w} · ${b.drop.n}</b>
        </div>
        <button class="btn primary boss-start-btn" data-bossid="${b.id}" ${canAfford ? '' : 'disabled'}>
          ${canAfford ? '⚔️ Podejmij Wyzwanie' : 'Za mało monet ('+fmtShort(b.stake)+')'}
        </button>
      </div>
    `;
  });

  html += `</div>`;
  body.innerHTML = html;

  body.querySelectorAll("[data-bossmode]").forEach(btn => {
    btn.addEventListener("click", () => { bossViewMode = btn.dataset.bossmode; renderBossList(); });
  });
  body.querySelectorAll(".boss-start-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const bid = btn.dataset.bossid;
      if (bid) startBossFight(bid);
    });
  });
}

function startBossFight(bossId, campaignStage) {
  const b = BOSSES.find(x => x.id === bossId);
  if (!b) return;
  if (campaignStage) bossViewMode = "campaign";
  if (state.coins < b.stake) {
    sfxErr();
    toast(`Za mało monet na walkę z ${b.icon} ${b.name} (🪙 ${fmt(b.stake)})`, "bad");
    return;
  }

  // Pobranie wpisowego
  state.coins -= b.stake;
  state.stats.spent += b.stake;
  state.stats.battles++;
  missionTrack("battle", 1);
  missionTrack("spend", b.stake);
  renderBalance();
  save();

  const p = calcPlayerCombatStats();
  const mods = campaignStage && Array.isArray(campaignStage.mods) ? campaignStage.mods.slice() : [];
  const modText = mods.length
    ? " Modyfikatory: " + mods.map(id=>{ const m=bossModInfo(id); return m.icon+" "+m.name; }).join(", ") + "."
    : "";
  activeBossFight = {
    boss: b,
    bossHp: b.hp,
    bossMaxHp: b.hp,
    playerHp: p.maxHp,
    playerMaxHp: p.maxHp,
    playerDmg: p.dmg,
    round: 1,
    defending: false,
    critReady: false,
    campaign: campaignStage || null,
    mods,
    maxRounds: campaignStage && campaignStage.maxRounds ? campaignStage.maxRounds : 0,
    log: [
      `⚔️ Rozpoczyna się rajd na: ${b.icon} <b>${b.name}</b>! Wpisowe 🪙 ${fmtShort(b.stake)} pobrane.${modText}`
    ]
  };

  sfxWhoosh();
  renderBossArena();
}

function renderBossArena() {
  const f = activeBossFight;
  if (!f) return;
  const b = f.boss;

  const title = $("#bossModalTitle");
  if (title) title.innerHTML = f.campaign
    ? `👑 Kampania · ${f.campaign.name}`
    : `${b.icon} Walka z: ${b.name}`;
  const body = $("#bossModalBody");
  if (!body) return;

  const playerPct = Math.max(0, Math.min(100, Math.round((f.playerHp / f.playerMaxHp) * 100)));
  const bossPct = Math.max(0, Math.min(100, Math.round((f.bossHp / f.bossMaxHp) * 100)));
  const modBanner = f.mods && f.mods.length
    ? `<div class="boss-mod-banner"><b>👑 ${esc(f.campaign ? f.campaign.name : "Kampania")}</b>${f.mods.map(id=>{ const m=bossModInfo(id); return `<span class="bm-chip" title="${esc(m.desc)}">${m.icon} ${esc(m.name)}</span>`; }).join("")}</div>`
    : "";

  body.innerHTML = modBanner + `
    <div class="boss-arena">
      <div class="boss-versus">
        <!-- GRACZ -->
        <div class="boss-combatant player-side">
          <div class="combatant-header">
            <div class="combatant-avatar">🛡️</div>
            <div>
              <div class="combatant-name">TWÓJ BOHATER</div>
              <div class="combatant-sub">Atak: ~${fmtShort(f.playerDmg)}</div>
            </div>
          </div>
          <div class="boss-hp-wrap">
            <div class="boss-hp-bar" id="playerHpBar" style="width:${playerPct}%"></div>
          </div>
          <div class="boss-hp-text" id="playerHpText">${fmt(f.playerHp)} / ${fmt(f.playerMaxHp)} HP (${playerPct}%)</div>
        </div>

        <!-- VS ŚRODEK -->
        <div class="boss-vs-center">
          <div class="boss-vs-badge">VS</div>
          <div class="boss-round-tag">RUNDA ${f.round}${f.maxRounds ? " / "+f.maxRounds : ""}</div>
        </div>

        <!-- BOSS -->
        <div class="boss-combatant boss-side" id="bossCardSide" style="--bc:${b.color}">
          <div class="combatant-header">
            <div class="combatant-avatar">${b.icon}</div>
            <div>
              <div class="combatant-name">${b.name}</div>
              <div class="combatant-sub">${b.title}</div>
            </div>
          </div>
          <div class="boss-hp-wrap">
            <div class="boss-hp-bar" id="bossHpBar" style="width:${bossPct}%"></div>
          </div>
          <div class="boss-hp-text" id="bossHpText">${fmt(f.bossHp)} / ${fmt(f.bossMaxHp)} HP (${bossPct}%)</div>
        </div>
      </div>

      <!-- KONSOLA BITWY -->
      <div class="boss-log-box" id="bossLogBox">
        ${f.log.map(entry => `<div class="boss-log-entry">${entry}</div>`).join("")}
      </div>

      <!-- PRZYCISKI AKCJI -->
      <div class="boss-actions-grid" id="bossActionsGrid">
        <button class="boss-action-btn" id="bossActAttack">
          <span class="act-ico">🗡️</span>
          <span class="act-name">Zwykły Atak</span>
          <span class="act-desc">Pewne 100% obrażeń</span>
        </button>
        <button class="boss-action-btn" id="bossActHeavy">
          <span class="act-ico">💥</span>
          <span class="act-name">Potężny Cios</span>
          <span class="act-desc">180% obrażeń (75% celności)</span>
        </button>
        <button class="boss-action-btn" id="bossActDefend">
          <span class="act-ico">🛡️</span>
          <span class="act-name">Blok Tarczą</span>
          <span class="act-desc">−60% obrażeń + kontratak</span>
        </button>
        <button class="boss-action-btn" id="bossActHeal" ${bossMod(f,"noheal")?'disabled':''}>
          <span class="act-ico">🧪</span>
          <span class="act-name">Mikstura / Regeneracja</span>
          <span class="act-desc">${bossMod(f,"noheal")?"🚫 zakaz ulepszeń":"+25% maksymalnego HP"}</span>
        </button>
      </div>
    </div>
  `;

  // Auto-scroll loga
  const logBox = $("#bossLogBox");
  if (logBox) logBox.scrollTop = logBox.scrollHeight;

  // Podpięcie akcji
  $("#bossActAttack")?.addEventListener("click", () => handlePlayerAction("attack"));
  $("#bossActHeavy")?.addEventListener("click", () => handlePlayerAction("heavy"));
  $("#bossActDefend")?.addEventListener("click", () => handlePlayerAction("defend"));
  $("#bossActHeal")?.addEventListener("click", () => handlePlayerAction("heal"));
}

function handlePlayerAction(actionType) {
  const f = activeBossFight;
  if (!f) return;

  const btnContainer = $("#bossActionsGrid");
  if (btnContainer) {
    btnContainer.querySelectorAll("button").forEach(b => b.disabled = true);
  }

  let playerDamage = 0;
  let logText = "";
  f.defending = false;

  if (actionType === "heal" && bossMod(f, "noheal")) {
    f.log.push(`<span class="status">🚫 Zakaz ulepszeń — mikstura jest zablokowana w tym etapie.</span>`);
    updateArenaBars();
    setTimeout(() => handleBossTurn(), 700);
    return;
  }

  if (actionType === "attack") {
    const variance = 0.9 + Math.random() * 0.25;
    playerDamage = Math.floor(f.playerDmg * variance);
    logText = `<span class="player-hit">🗡️ Wyprowadzasz atak i zadajesz <b>${fmt(playerDamage)}</b> obrażeń!</span>`;
    sfxTick();
  } else if (actionType === "heavy") {
    const heavyChance = bossMod(f, "reversed") ? 0.25 : 0.75;
    if (Math.random() < heavyChance) {
      const variance = 1.6 + Math.random() * 0.4;
      playerDamage = Math.floor(f.playerDmg * variance);
      logText = `<span class="special-action">💥 Potężne uderzenie krytyczne za <b>${fmt(playerDamage)}</b> obrażeń!</span>`;
      sfxCoin();
    } else {
      playerDamage = 0;
      logText = `<span class="status">💨 Chybienie! Boss zdołał uniknąć Twojego ciężkiego ciosu!</span>`;
      sfxErr();
    }
  } else if (actionType === "defend") {
    f.defending = true;
    const counterDmg = Math.floor(f.playerDmg * 0.45);
    playerDamage = counterDmg;
    logText = `<span class="defend-action">🛡️ Przyjmujesz pozycję obronną i zadajesz z riposty <b>${fmt(counterDmg)}</b> obrażeń!</span>`;
    sfxTick();
  } else if (actionType === "heal") {
    const healAmount = Math.floor(f.playerMaxHp * 0.25);
    f.playerHp = Math.min(f.playerMaxHp, f.playerHp + healAmount);
    logText = `<span class="player-hit">🧪 Używasz eliksiru: uleczono <b>+${fmt(healAmount)} HP</b>!</span>`;
    sfxClover();
  }

  if (playerDamage > 0) {
    f.bossHp = Math.max(0, f.bossHp - playerDamage);
    const bossCard = $("#bossCardSide");
    if (bossCard) {
      bossCard.classList.remove("boss-shake");
      void bossCard.offsetWidth;
      bossCard.classList.add("boss-shake");
    }
  }

  f.log.push(logText);
  updateArenaBars();

  // Sprawdzenie czy boss poległ
  if (f.bossHp <= 0) {
    setTimeout(() => handleBossVictory(), 600);
    return;
  }

  // Tura Bossa po chwili
  setTimeout(() => handleBossTurn(), 700);
}

function handleBossTurn() {
  const f = activeBossFight;
  if (!f) return;
  const b = f.boss;

  const rage = bossMod(f, "bossRage") ? 1.3 : 1;
  const rawBossDmg = Math.floor(f.playerMaxHp * b.attackPower * rage * (0.85 + Math.random() * 0.35));
  let finalDmg = rawBossDmg;

  let bossLog = "";
  const isSpecial = Math.random() < (bossMod(f, "reversed") ? 0.5 : 0.3);

  if (f.defending) {
    finalDmg = Math.floor(finalDmg * 0.4);
    bossLog = `<span class="boss-hit">🛡️ Zablokowano cios bossa! Otrzymujesz tylko <b>${fmt(finalDmg)}</b> obrażeń.</span>`;
  } else if (isSpecial) {
    finalDmg = Math.floor(finalDmg * 1.4);
    bossLog = `<span class="special-action">🔥 ${b.name} używa potężnego skilla i uderza za <b>${fmt(finalDmg)}</b> obrażeń!</span>`;
    sfxErr();
  } else {
    bossLog = `<span class="boss-hit">⚔️ ${b.name} atakuje i zadaje Ci <b>${fmt(finalDmg)}</b> obrażeń.</span>`;
  }

  f.playerHp = Math.max(0, f.playerHp - finalDmg);
  f.round++;
  f.log.push(bossLog);
  updateArenaBars();

  if (f.playerHp <= 0) {
    setTimeout(() => handleBossDefeat(), 600);
  } else if (f.maxRounds && f.round > f.maxRounds) {
    f.log.push(`<span class="status">⏳ Limit tur minął — ${b.name} przetrwał rajd.</span>`);
    updateArenaBars();
    setTimeout(() => handleBossDefeat("limit"), 700);
  } else {
    const btnContainer = $("#bossActionsGrid");
    if (btnContainer) {
      btnContainer.querySelectorAll("button").forEach(btn => {
        btn.disabled = btn.id === "bossActHeal" && bossMod(f, "noheal");
      });
    }
  }
}

function updateArenaBars() {
  const f = activeBossFight;
  if (!f) return;

  const playerPct = Math.max(0, Math.min(100, Math.round((f.playerHp / f.playerMaxHp) * 100)));
  const bossPct = Math.max(0, Math.min(100, Math.round((f.bossHp / f.bossMaxHp) * 100)));

  const pBar = $("#playerHpBar");
  if (pBar) pBar.style.width = playerPct + "%";
  const pText = $("#playerHpText");
  if (pText) pText.textContent = `${fmt(f.playerHp)} / ${fmt(f.playerMaxHp)} HP (${playerPct}%)`;

  const bBar = $("#bossHpBar");
  if (bBar) bBar.style.width = bossPct + "%";
  const bText = $("#bossHpText");
  if (bText) bText.textContent = `${fmt(f.bossHp)} / ${fmt(f.bossMaxHp)} HP (${bossPct}%)`;

  const logBox = $("#bossLogBox");
  if (logBox) {
    logBox.innerHTML = f.log.map(entry => `<div class="boss-log-entry">${entry}</div>`).join("");
    logBox.scrollTop = logBox.scrollHeight;
  }
}

function handleBossVictory() {
  const f = activeBossFight;
  if (!f) return;
  const b = f.boss;

  state.stats.battleWins++;
  state.stats.bossWins = (state.stats.bossWins || 0) + 1;
  state.bossKills = state.bossKills || {};
  state.bossKills[b.id] = true;

  let campaignBonus = 0, campaignCase = null, campaignFirst = false;
  if (f.campaign) {
    if (!state.bossCampaign || typeof state.bossCampaign !== "object") state.bossCampaign = { cleared:{} };
    state.bossCampaign.cleared = (state.bossCampaign.cleared && typeof state.bossCampaign.cleared === "object") ? state.bossCampaign.cleared : {};
    campaignFirst = !state.bossCampaign.cleared[f.campaign.id];
    state.bossCampaign.cleared[f.campaign.id] = true;
    if (campaignFirst) {
      campaignBonus = numFrom(f.campaign.bonus);
      if (campaignBonus) {
        state.coins += campaignBonus;
        state.stats.earned = numFrom(state.stats.earned) + campaignBonus;
      }
      if (f.campaign.caseId) {
        state.caseStock = (state.caseStock && typeof state.caseStock === "object" && !Array.isArray(state.caseStock)) ? state.caseStock : {};
        state.caseStock[f.campaign.caseId] = numFrom(state.caseStock[f.campaign.caseId]) + 1;
        campaignCase = CASES.find(c=>c.id===f.campaign.caseId) || null;
      }
      missionTrack("campaign_win", 1, { stage:f.campaign.id });
    }
  }

  state.coins += b.reward;
  state.stats.earned += b.reward;
  missionTrack("win", 1);
  missionTrack("battleearn", b.reward);
  missionTrack("boss_win", 1, { bossId: b.id });

  // Szansa na unikalny relikt z bossa (50%)
  let dropItem = null;
  if (Math.random() < 0.50) {
    dropItem = {
      uid: "boss_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      w: b.drop.w,
      n: b.drop.n,
      art: b.drop.art || "knife",
      tier: "relic",
      value: b.drop.value,
      ts: Date.now()
    };
    addToInv(dropItem);
  }

  // Zapis bitwy w historii
  state.battles.unshift({
    win: true,
    draw: false,
    cn: "Boss: " + b.name,
    n: 1,
    cost: b.stake,
    gain: b.reward + campaignBonus + (dropItem ? dropItem.value : 0) + (campaignCase ? campaignCase.price : 0),
    ts: Date.now(),
    mt: "relic",
    mn: b.name + " · POKONANY",
    mval: f.playerMaxHp,
    at: "special",
    an: b.name,
    aval: b.hp
  });
  state.battles = state.battles.slice(0, 8);

  markDirty();
  save();
  renderBalance();
  renderStats();
  checkAchievements();

  sfxWin("relic");
  confetti(["#ffd700", "#ef4444", "#a855f7", "#38e08a", "#ffffff"]);
  if(dropItem && typeof recordDropFor === "function"){
    const rec = recordDropFor([dropItem]);
    if(rec) setTimeout(()=>{ if($("#bossOverlay").classList.contains("show")) showRecordFx(rec); }, 900);
  }

  const body = $("#bossModalBody");
  if (body) {
    body.innerHTML = `
      <div style="text-align:center;padding:24px 10px;display:flex;flex-direction:column;align-items:center;gap:14px;">
        <div style="font-size:60px;filter:drop-shadow(0 0 25px #10b981)">🏆</div>
        <h3 style="font-size:24px;color:var(--ok);margin:0">ZWYCIĘSTWO! POKONAŁEŚ ${b.name}!</h3>
        <p style="color:var(--dim);max-width:480px;line-height:1.5;margin:0">
          Twoja odwaga i taktyka okazały się silniejsze od potwora. Nagroda trafiła na Twoje konto!
        </p>
        <div style="font-size:22px;font-weight:900;color:var(--acc);margin:8px 0">
          🪙 +${fmt(b.reward)} monet
        </div>
        ${campaignBonus ? `<div class="boss-campaign-win">👑 Bonus kampanii: <b>🪙 +${fmt(campaignBonus)}</b>${campaignCase ? " + 📦 "+esc(campaignCase.name) : ""}</div>` : ""}
        ${f.campaign && !campaignFirst ? `<div class="muted" style="font-size:11px">Etap powtórzony — bonus kampanii przyznawany jest tylko za pierwsze przejście.</div>` : ""}
        ${dropItem ? `
          <div style="background:rgba(251,191,36,0.12);border:1px solid #ffd700;border-radius:12px;padding:12px 20px;display:flex;align-items:center;gap:12px;margin:4px 0">
            <span style="font-size:32px">✦</span>
            <div style="text-align:left">
              <div style="font-size:11px;color:#fcd34d;font-weight:800;letter-spacing:1px">DODATKOWY ŁUP Z BOSSA:</div>
              <div style="font-size:15px;font-weight:900;color:#fff">${dropItem.w} · ${dropItem.n}</div>
              <div style="font-size:12px;color:var(--acc)">Wartość: 🪙 ${fmt(dropItem.value)}</div>
            </div>
          </div>
        ` : ''}
        <div style="display:flex;gap:10px;margin-top:12px">
          <button class="btn primary" id="bossVicAgain">${f.campaign ? "Wróć do kampanii" : "Wróć do listy bossów"}</button>
          <button class="btn" id="bossVicClose">Zamknij</button>
        </div>
      </div>
    `;
    $("#bossVicAgain")?.addEventListener("click", () => renderBossList());
    $("#bossVicClose")?.addEventListener("click", () => closeBossModal());
  }
}

function handleBossDefeat(reason) {
  const f = activeBossFight;
  if (!f) return;
  const b = f.boss;
  const reasonText = reason === "limit"
    ? "⏳ Limit tur minął, zanim zdołałeś pokonać bossa."
    : "Twoje punkty zdrowia spadły do zera.";

  state.battles.unshift({
    win: false,
    draw: false,
    cn: "Boss: " + b.name,
    n: 1,
    cost: b.stake,
    gain: 0,
    ts: Date.now(),
    mt: "covert",
    mn: "Poległy w walce",
    mval: f.playerMaxHp,
    at: "special",
    an: b.name,
    aval: b.hp
  });
  state.battles = state.battles.slice(0, 8);

  markDirty();
  save();
  renderBalance();
  renderStats();

  sfxErr();

  const body = $("#bossModalBody");
  if (body) {
    body.innerHTML = `
      <div style="text-align:center;padding:24px 10px;display:flex;flex-direction:column;align-items:center;gap:14px;">
        <div style="font-size:60px;filter:drop-shadow(0 0 25px #ef4444)">💀</div>
        <h3 style="font-size:24px;color:#ef4444;margin:0">PORAŻKA! ${b.name} CIĘ ZMIAŻDŻYŁ!</h3>
        <p style="color:var(--dim);max-width:480px;line-height:1.5;margin:0">
          ${reasonText} Wpisowe w wysokości <b>🪙 ${fmt(b.stake)}</b> przepadło. Wzbogać ekwipunek i spróbuj ponownie!
        </p>
        <div style="display:flex;gap:10px;margin-top:12px">
          <button class="btn primary" id="bossDefTry">${f.campaign ? "Powtórz etap" : "Spróbuj ponownie"}</button>
          <button class="btn" id="bossDefClose">Zamknij</button>
        </div>
      </div>
    `;
    const retryStage = f.campaign;
    $("#bossDefTry")?.addEventListener("click", () => retryStage ? startBossFight(retryStage.bossId, retryStage) : renderBossList());
    $("#bossDefClose")?.addEventListener("click", () => closeBossModal());
  }
}

// Globalny listener zamykania okna Bossa
document.addEventListener("DOMContentLoaded", () => {
  $("#bossClose")?.addEventListener("click", closeBossModal);
});
// Także wywołanie na wypadek gdy DOM już załadowany
$("#bossClose")?.addEventListener("click", closeBossModal);


/* 🎰 KRÓLOWA GÓRY — maszyna losująca z rosnącym ryzykiem */
let kohPrize = 100000;
function playKoh(){
  if(battleBusy || battleStage) return;
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
  if(won) missionTrack("koh_win", 1, { result, mult, gain });
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
   ⌨️ SKRÓTY KLAWIATURY + WSKAŹNIK ZAPISU
   ======================================================================= */
document.addEventListener("keydown", e=>{
  if(e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  const tag = (t && t.tagName ? t.tagName : "").toLowerCase();
  if(tag === "input" || tag === "textarea" || tag === "select" || (t && t.isContentEditable)) return;
  if(document.querySelector(".overlay.show")) return;

  if(/^[1-9]$/.test(e.key)){
    const tabs = $$(".tab");
    const tab = tabs[Number(e.key) - 1];
    if(tab && tab.dataset.view){
      e.preventDefault();
      switchView(tab.dataset.view);
    }
    return;
  }

  if(e.key === "Enter" && t && t.closest){
    const card = t.closest(".case-card[data-case]");
    if(!card) return;
    const btn = card.querySelector("[data-stockopen]") || card.querySelector("[data-open]");
    if(btn && !btn.disabled){
      e.preventDefault();
      btn.click();
    }
  }
});

const saveStatusEl = $("#saveStatus");
if(saveStatusEl){
  const quickCopy = ()=>exportSave();
  saveStatusEl.addEventListener("click", quickCopy);
  saveStatusEl.addEventListener("keydown", e=>{
    if(e.key === "Enter" || e.key === " "){
      e.preventDefault();
      quickCopy();
    }
  });
}
setInterval(()=>{ if(typeof updateSaveStatus === "function") updateSaveStatus(); }, 15000);

/* =======================================================================
   16. START
   ======================================================================= */
load();
// świeży gracz (albo zapis bez tych danych) dostaje od razu oba zestawy misji
if(!state.missions || !Array.isArray(state.missions.list) || !state.missions.list.length) rollMissions();
if(!state.weekly  || !Array.isArray(state.weekly.list)  || !state.weekly.list.length)  rollWeekly();
$("#soundBtn").textContent = state.sound ? "🔊" : "🔇";
$("#fastBtn").classList.toggle("on", state.fast);
const uiPrefs = readUiPrefs();
applyUiPrefs(uiPrefs);
renderBalance(true); renderRankBadge();
renderShop(); renderBots(); renderCodes(); renderInv(); renderStats(); renderUp(); renderBattle(); updateBonus(); updateClover();
shopTick();
renderAlbumBadge(); renderDailyBadge(); checkAchievements();
if(uiPrefs.view && uiPrefs.view !== "shop" && UI_VIEWS.includes(uiPrefs.view)){
  switchView(uiPrefs.view);
}
save();   // od razu utrwalamy wczytany stan (migracja starych zapisów)
if(state.stats.opened>0) toast("Witaj ponownie! Otwarte skrzynki: <b>"+state.stats.opened+"</b> · ekwipunek: <b>"+state.inv.length+"</b>","good");
setTimeout(grantRescue, 600);   // jeśli wracasz bez niczego — ratunek od razu