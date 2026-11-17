"use strict";

/* =======================================================================
   ⚗️ SKIN UPGRADER
   -----------------------------------------------------------------------
   Wybierasz posiadany skin i cel (mnożnik + konkretny skin docelowy).
   Wynik jest losowy — przy sukcesie skin znika, a w ekwipunku ląduje cel.
   Przy porażce skin jest tracony. Bez opłat w monetach: ryzykujesz wartość
   przedmiotu. Wszystkie dane zapisują się w istniejącym stanie gry.
   ======================================================================= */

const UPG_MULTIPLIERS = [2, 5, 10, 25, 50, 100];
const UPG_PAGE = 8;
let UPG_CATALOG = null;
let UPG_RAF = 0;
let UPG_TIMER = 0;
let UPG_PENDING = null;
const upg = {sourceUid:null, mult:2, targetKey:null, srcPage:0, tgtPage:0, pickMode:"src", busy:false};

/* Szansa maleje wykładniczo z mnożnikiem: 2×≈56%, 5×≈30%, 10×≈17%, 100×≈4%. */
function upgChance(mult){
  return Math.max(2, Math.min(90, Math.round(92 * Math.pow(mult, -0.72))));
}
function upgCatalog(){
  if(UPG_CATALOG) return UPG_CATALOG;
  const out = [];
  const seen = new Set();
  (typeof ALBUM !== "undefined" ? ALBUM : new Map()).forEach(e=>{
    if(!e || seen.has(e.key)) return;
    const c = CASES.find(x=>x.id===e.caseId);
    if(!c || c.noItems || c.troll) return;
    const value = Math.max(1, Math.round(itemValue(c, e.tier, e.key)));
    seen.add(e.key);
    out.push({key:e.key, w:e.w, n:e.n, art:e.art, tier:e.tier, caseId:e.caseId, value});
  });
  out.sort((a,b)=>a.value-b.value);
  UPG_CATALOG = out;
  return out;
}
function upgSource(){
  return state.inv.find(i=>i.uid===upg.sourceUid) || null;
}
function upgTargets(src){
  if(!src) return [];
  const cat = upgCatalog();
  const lo = src.value * upg.mult * 0.65;
  const hi = src.value * upg.mult * 1.45;
  let list = cat.filter(t=>t.key!==(src.w+"|"+src.n) && t.value>=lo && t.value<=hi);
  if(list.length < UPG_PAGE){
    list = cat.filter(t=>t.key!==(src.w+"|"+src.n) && t.value>src.value)
      .sort((a,b)=>Math.abs(a.value/src.value-upg.mult)-Math.abs(b.value/src.value-upg.mult))
      .slice(0, 24);
  }
  return list;
}
function upgTarget(){
  const list = upgTargets(upgSource());
  return list.find(t=>t.key===upg.targetKey) || list[0] || null;
}
function upgTierName(t){ return TIER[t] ? TIER[t].name : t; }

function upgItemCard(item, badge, extra){
  const t = TIER[item.tier] || TIER.mil;
  const f = fxOf(item);
  return `<div class="ug-item tier-${item.tier}${extra||""}" style="--c:${t.color}${f?";--fx:"+f.color:""}">
    ${badge?`<span class="ug-badge">${badge}</span>`:""}
    <div class="ug-art">${weaponSVG(item, hash(item.w+item.n+(item.uid||item.key||"")).toString(36))}</div>
    <div class="ug-item-name">${esc(item.w)}</div>
    <div class="ug-item-skin">${esc(item.n)}</div>
    <div class="ug-item-val">🪙 ${fmtShort(item.value)}</div>
  </div>`;
}
function upgGridCard(item, key, on){
  const t = TIER[item.tier] || TIER.mil;
  const f = fxOf(item);
  const attr = key === "src" ? `data-upg-source="${esc(item.uid)}"` : `data-upg-target="${esc(item.key)}"`;
  return `<button class="ug-grid-item tier-${item.tier}${on?" on":""}" ${attr} style="--c:${t.color}${f?";--fx:"+f.color:""}">
    <span class="ug-art">${weaponSVG(item, hash(item.uid||item.key).toString(36))}</span>
    <span class="ug-gi-name">${esc(item.w)}</span>
    <span class="ug-gi-skin">${esc(item.n)}</span>
    <span class="ug-gi-val">🪙 ${fmtShort(item.value)}</span>
  </button>`;
}
function upgPager(total, page, kind){
  const pages = Math.max(1, Math.ceil(total/UPG_PAGE));
  if(pages<=1) return "";
  return `<div class="ug-pager">
    <button class="tb-btn" data-upg-page-${kind}="-1" ${page<=0?"disabled":""}>‹</button>
    <span>${page+1} / ${pages}</span>
    <button class="tb-btn" data-upg-page-${kind}="1" ${page>=pages-1?"disabled":""}>›</button>
  </div>`;
}

function renderUpgrader(){
  const body = $("#upgBody");
  if(!body) return;
  const us = state.stats.upgrader || {done:0,wins:0,losses:0,spent:0,bestMult:0};
  const inv = state.inv.slice().sort((a,b)=>b.value-a.value);
  const src = upgSource();
  const targets = upgTargets(src);
  const target = upgTarget();
  if(upg.srcPage*UPG_PAGE >= inv.length) upg.srcPage = Math.max(0, Math.floor((inv.length-1)/UPG_PAGE));
  if(upg.tgtPage*UPG_PAGE >= targets.length) upg.tgtPage = Math.max(0, Math.floor((targets.length-1)/UPG_PAGE));
  const pct = src && target ? upgChance(upg.mult) : 0;
  const realMult = src && target ? (target.value/Math.max(1,src.value)) : 0;

  const list = upg.pickMode === "tgt"
    ? (!src ? "" : targets.slice(upg.tgtPage*UPG_PAGE, upg.tgtPage*UPG_PAGE+UPG_PAGE)
        .map(t=>upgGridCard(t, "tgt", t.key===upg.targetKey)).join(""))
    : inv.slice(upg.srcPage*UPG_PAGE, upg.srcPage*UPG_PAGE+UPG_PAGE)
        .map(i=>upgGridCard(i, "src", i.uid===upg.sourceUid)).join("");
  const listEmpty = upg.pickMode === "tgt"
    ? (!src ? "Najpierw wybierz skin źródłowy." : "Brak celów — zmień mnożnik.")
    : "Ekwipunek jest pusty — najpierw otwórz skrzynkę.";

  body.innerHTML = `
    <div class="cc-head ug-head">
      <div class="cc-title">
        <span class="cc-kicker">GRA 05 · RYZYKO</span>
        <h3>⚗️ Skin Upgrader</h3>
      </div>
      <span class="tag">${us.done ? us.done+" prób · "+us.wins+"✔ / "+us.losses+"✖ · ×"+us.bestMult : "NOWY SYSTEM"}</span>
    </div>
    <p class="muted ug-desc">Wybierz skin i mnożnik. <b>Wygrana</b> daje skin docelowy, <b>porażka</b> niszczy przedmiot. Im wyższy mnożnik, tym mniejsza szansa.</p>

    <div class="ug-top">
      <div class="ug-left">
        <div class="ug-label">TWÓJ SKIN <button class="ug-mini-btn" data-upg-pick="src">Wybierz</button></div>
        <div class="ug-left-box" id="upgStage">
          ${src ? upgItemCard(src, "POSIADANY") : `<div class="ug-empty-slot">?</div>`}
        </div>
        <div class="ug-chips" id="upgMults">
          ${UPG_MULTIPLIERS.map(m=>`<button class="ug-chip${m===upg.mult?" on":""}" data-upg-mult="${m}" ${!src?"disabled":""}>×${m}<small>${upgChance(m)}%</small></button>`).join("")}
        </div>
        <button class="btn gold ug-go" id="upgBtn" ${upg.busy||!src||!target?"disabled":""}>⚗️ UPGRADE ${src&&target?"· 🪙 "+fmtShort(src.value):""}</button>
      </div>

      <div class="ug-gauge" id="upgGauge">
        <div class="ug-ring" style="--pct:${pct}">
          <span class="ug-ring-arc"></span>
          <div class="ug-ring-in"><b id="upgChance">${pct?pct+"%":"—"}</b><small>WIN CHANCE</small></div>
        </div>
        <div class="ug-mult">×${upg.mult} <span>mnożnik</span></div>
        <div class="ug-real" id="upgMult">${realMult?"×"+realMult.toFixed(2):"—"}</div>
        <div class="ug-arrow">➜</div>
      </div>

      <div class="ug-right">
        <div class="ug-label">SKIN DOCELOWY <button class="ug-mini-btn" data-upg-pick="tgt">Zmień</button></div>
        <div class="ug-right-box">
          ${target ? upgItemCard(target, "CEL") : `<div class="ug-empty-slot">?</div>`}
        </div>
        <div class="ug-target-info" id="upgTargetInfo">${target?esc(target.w)+" · "+esc(target.n):"Wybierz skin i mnożnik"}</div>
      </div>
    </div>

    <div class="ug-feedback" id="upgFeedback" aria-live="assertive"></div>

    <div class="ug-pick-head">
      <b>${upg.pickMode==="tgt"?"Wybierz skin docelowy":"Wybierz skin z ekwipunku"}</b>
      <div class="ug-pick-tabs">
        <button class="ug-mini-btn${upg.pickMode==="src"?" on":""}" data-upg-pick="src">Ekwipunek</button>
        <button class="ug-mini-btn${upg.pickMode==="tgt"?" on":""}" data-upg-pick="tgt">Cele</button>
      </div>
    </div>
    <div class="ug-grid" id="${upg.pickMode==="tgt"?"upgTargetList":"upgSourceList"}">${list || `<div class="ug-empty">${listEmpty}</div>`}</div>
    <div id="${upg.pickMode==="tgt"?"upgTargetPager":"upgSourcePager"}">${upgPager(upg.pickMode==="tgt"?targets.length:inv.length, upg.pickMode==="tgt"?upg.tgtPage:upg.srcPage, upg.pickMode==="tgt"?"tgt":"src")}</div>
  `;
}

/*Animacja losowania — lekka, z requestAnimationFrame i respektem dla ustawień.*/
function upgStop(finalize){
  if(UPG_RAF){ cancelAnimationFrame(UPG_RAF); UPG_RAF = 0; }
  if(UPG_TIMER){ clearTimeout(UPG_TIMER); UPG_TIMER = 0; }
  UPG_PENDING = null;
  upg.busy = false;
  const stage = $("#upgStage"); if(stage) stage.classList.remove("rolling");
  const gauge = $("#upgGauge"); if(gauge) gauge.classList.remove("rolling");
  const arc = $("#upgGauge .ug-ring-arc"); if(arc) arc.style.transform = "";
  finalize();
}
function upgPlay(finalize){
  const stage = $("#upgStage");
  const feedback = $("#upgFeedback");
  if(feedback) feedback.innerHTML = "";
  const low = !stage || state.perfMode || state.reduceMotion || state.fast || document.hidden;
  if(low){ finalize(); return; }
  upg.busy = true;
  UPG_PENDING = finalize;
  const btn = $("#upgBtn"); if(btn) btn.disabled = true;
  stage.classList.add("rolling");
  const gauge = $("#upgGauge"); if(gauge) gauge.classList.add("rolling");
  const ring = $("#upgGauge .ug-ring");
  const arc = $("#upgGauge .ug-ring-arc");
  const chanceEl = $("#upgChance");
  sfxWhoosh();
  const cat = upgCatalog();
  const start = performance.now(), dur = 2600;   // dłuższe, bardziej dramatyczne losowanie
  let last = 0, lastTarget = 0, lastFrame = 0, angle = 0, shown = 50, target = 50;
  if(ring) ring.style.setProperty("--pct", 26);  /* stały łuk — obraca się cały pierścień */
  const tick = now=>{
    const p = Math.min(1, (now-start)/dur);
    /* tarcza kręci się spokojnie i zwalnia pod koniec (ok. 1 obrót w całości) */
    const dt = lastFrame ? Math.min(48, now-lastFrame) : 16;
    lastFrame = now;
    angle += (0.22*(1-p) + 0.04) * dt;
    /* żółty łuk i wskazówka muszą się kręcić razem — ustawiam transform
       bezpośrednio na łuku, nie przez dziedziczony custom property */
    if(arc) arc.style.transform = "rotate("+angle+"deg)";
    if(ring){
      /* wskazówka kręci się wyraźnie szybciej niż złoty łuk */
      ring.style.setProperty("--spin", angle+"deg");
      ring.style.setProperty("--needle", (angle*2.6)+"deg");
    }
    /* liczba „dojeżdża” płynnie do losowanego celu zamiast skakać */
    if(now-lastTarget > (300 - 190*p)){
      lastTarget = now;
      target = 4 + Math.random()*92;
    }
    shown += (target-shown) * (0.10 + 0.07*p);
    if(chanceEl) chanceEl.textContent = Math.round(shown)+"%";
    const swap = 70 + 260 * Math.pow(p, 2.2);
    if(now-last > swap){
      last = now;
      const a = cat[(Math.random()*cat.length)|0] || {w:"?",n:"?",tier:"mil",value:0};
      stage.innerHTML = upgItemCard(a, "…");
    }
    if(p < 1){ UPG_RAF = requestAnimationFrame(tick); return; }
    upgStop(finalize);
  };
  UPG_RAF = requestAnimationFrame(tick);
  /* awaryjnie: RAF bywa wstrzymany w ukrytej karcie — wtedy domykamy sami */
  UPG_TIMER = setTimeout(()=>{ if(UPG_PENDING===finalize) upgStop(finalize); }, 3400);
}
document.addEventListener("visibilitychange", ()=>{
  if(document.hidden && UPG_PENDING){
    const f = UPG_PENDING;
    upgStop(f);
  }
});

function upgFinalize(src, target, success){
  const stats = state.stats.upgrader = state.stats.upgrader || {done:0,wins:0,losses:0,spent:0,bestMult:0};
  const idx = state.inv.findIndex(i=>i.uid===src.uid);
  if(idx>=0) state.inv.splice(idx,1);
  stats.done++;
  stats.spent += numFrom(src.value);
  stats.bestMult = Math.max(numFrom(stats.bestMult), success ? upg.mult : 0);
  if(success){
    stats.wins++;
    const item = {
      uid:"up"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
      w:target.w, n:target.n, art:target.art, tier:target.tier,
      caseId:target.caseId, fx:null, value:Math.round(target.value), ts:Date.now(), upgraded:true
    };
    addToInv(item);
    sfxWin(item.tier);
    if(typeof confetti === "function" && !state.perfMode && !state.reduceMotion)
      confetti(["#4ade80","#ffd700","#ffffff"]);
  } else {
    stats.losses++;
    sfxErr();
  }
  markDirty(); save();
  upg.sourceUid = null; upg.targetKey = null; upg.srcPage = 0; upg.tgtPage = 0;
  renderUpgrader(); renderInv(); renderStats();
  const fb = $("#upgFeedback");
  if(fb){
    fb.className = "ug-feedback "+(success?"win":"lose");
    fb.innerHTML = success
      ? `<div class="ug-fb-ico">✅</div><div><b>SUKCES!</b><span>${esc(src.w)} · ${esc(src.n)} → ${esc(target.w)} · ${esc(target.n)} · 🪙 ${fmtShort(target.value)}</span></div>`
      : `<div class="ug-fb-ico">💥</div><div><b>PORAŻKA</b><span>${esc(src.w)} · ${esc(src.n)} został zniszczony. Szansa wynosiła ${upgChance(upg.mult)}%.</span></div>`;
  }
  toast(success
    ? "⚗️ <b>Upgrade udany!</b> Nowy skin: "+esc(target.n)
    : "⚗️ <b>Upgrade nie udał się.</b> Skin utracony.", success?"good":"bad");
}

function runUpgrade(){
  if(upg.busy) return;
  const src = upgSource(), target = upgTarget();
  if(!src || !target){ sfxErr(); return; }
  const chance = upgChance(upg.mult);
  const success = Math.random()*100 < chance;
  upgPlay(()=>upgFinalize(src, target, success));
}

/* Delegacja zdarzeń — jeden listener na panel kasyna. */
const upgView = document.getElementById("upgPanel");
if(upgView) upgView.addEventListener("click", e=>{
  if(upg.busy) return;
  const pk = e.target.closest("[data-upg-pick]");
  if(pk){
    upg.pickMode = pk.dataset.upgPick === "tgt" ? "tgt" : "src";
    sfxCoin(); renderUpgrader(); return;
  }
  const s = e.target.closest("[data-upg-source]");
  if(s){
    upg.sourceUid = s.dataset.upgSource;
    upg.targetKey = null; upg.tgtPage = 0;
    sfxTick ? sfxTick() : sfxCoin();
    renderUpgrader(); return;
  }
  const m = e.target.closest("[data-upg-mult]");
  if(m){
    upg.mult = Number(m.dataset.upgMult)||2;
    upg.targetKey = null; upg.tgtPage = 0;
    sfxCoin(); renderUpgrader(); return;
  }
  const t = e.target.closest("[data-upg-target]");
  if(t){
    upg.targetKey = t.dataset.upgTarget;
    sfxCoin(); renderUpgrader(); return;
  }
  const ps = e.target.closest("[data-upg-page-src]");
  if(ps){
    upg.srcPage = Math.max(0, upg.srcPage + Number(ps.dataset.upgPageSrc));
    renderUpgrader(); return;
  }
  const pt = e.target.closest("[data-upg-page-tgt]");
  if(pt){
    upg.tgtPage = Math.max(0, upg.tgtPage + Number(pt.dataset.upgPageTgt));
    renderUpgrader(); return;
  }
  if(e.target.closest("#upgBtn")) runUpgrade();
});
