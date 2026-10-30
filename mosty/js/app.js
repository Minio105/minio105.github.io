/* =========================================================
   MOSTOWNIA — logika gry i interfejs
   ========================================================= */
"use strict";

(function () {
  const { BridgeSimulation, VehicleSimulation, SOLVER_DT } = window.BridgePhysics;
  const DESIGN_KEY = "mostownia_designs_v1";
  const MUTE_KEY = "mostownia_muted_v1";
  const $ = (id) => document.getElementById(id);

  const dom = {
    canvas: $("gameCanvas"), canvasWrap: $("canvasWrap"), levelTabs: $("levelTabs"),
    materials: $("materials"), miniMaterials: $("miniMaterials"), materialTable: $("materialTable"),
    budgetTotal: $("budgetTotal"), budgetLeft: $("budgetLeft"), budgetBar: $("budgetBar"),
    budgetPct: $("budgetPct"), projectCost: $("projectCost"), budgetCard: document.querySelector(".budget-card"),
    statElements: $("statElements"), statLength: $("statLength"), statRoad: $("statRoad"),
    selectionCard: $("selectionCard"), selectedName: $("selectedName"), selectedLength: $("selectedLength"),
    selectedCost: $("selectedCost"), selectedStress: $("selectedStress"),
    vehicles: $("vehicles"), levelNo: $("levelNo"), levelName: $("levelName"),
    levelMission: $("levelMission"), levelDifficulty: $("levelDifficulty"),
    levelSpan: $("levelSpan"), levelVehicles: $("levelVehicles"),
    btnTest: $("btnTest"), testSubtext: $("testSubtext"), btnUndo: $("btnUndo"),
    btnRedo: $("btnRedo"), btnDelete: $("btnDelete"), btnClear: $("btnClear"), btnHint: $("btnHint"),
    btnPause: $("btnPause"), btnResetTest: $("btnResetTest"), btnBackBuild: $("btnBackBuild"),
    buildActions: $("buildActions"), testActions: $("testActions"), testHud: $("testHud"),
    hudVehicle: $("hudVehicle"), hudMass: $("hudMass"), hudSpeed: $("hudSpeed"),
    hudLoad: $("hudLoad"), stressBar: $("stressBar"), countdown: $("countdown"),
    modeChip: $("modeChip"), canvasBanner: $("canvasBanner"), costBubble: $("costBubble"),
    toastStack: $("toastStack"), stageStatus: $("stageStatus"), statusText: $("statusText"),
    statusDot: $("statusDot"), saveIndicator: $("saveIndicator"), soundBtn: $("btnSound"),
    helpModal: $("helpModal"), resultModal: $("resultModal"), resultBadge: $("resultBadge"),
    resultEyebrow: $("resultEyebrow"), resultTitle: $("resultTitle"), resultSubtitle: $("resultSubtitle"),
    resultStars: $("resultStars"), resultStats: $("resultStats"), starNote: $("starNote"),
    btnResultBuild: $("btnResultBuild"), btnResultNext: $("btnResultNext"),
    canvasLegend: document.querySelector(".canvas-legend"), levelVehicles: $("levelVehicles")
  };

  const state = {
    levelIndex: 0, level: null, progress: getProgress(),
    designBeams: [], nextBeamId: 1, material: "road", vehicleId: "hatch",
    selectedId: null, pendingStart: null, drag: null, hoverNodeId: null,
    pointer: { x: 0, y: 0, wx: 0, wy: 0, inside: false },
    screen: { w: 0, h: 0, dpr: 1, scale: 1, ox: 0, oy: 0 },
    mode: "build", sim: null, car: null, test: null,
    undoStack: [], redoStack: [], hintUntil: 0, bannerDismissed: false,
    particles: [], shake: 0, dustTimer: 0, lastNow: 0, accumulator: 0,
    uiTimer: 0, lastResultSuccess: false, muted: false, saveTimer: 0,
    lastBreakSound: 0, lastResultReason: "",
    pausedFrom: "testing", countdownDisplay: null
  };

  let projects = readProjects();
  let saveIndicatorTimer = null;

  /* ---------------- dźwięk ---------------- */
  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }
    ensure() {
      if (!this.enabled) return null;
      try {
        if (!this.ctx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return null;
          this.ctx = new Ctx();
        }
        if (this.ctx.state === "suspended") this.ctx.resume();
        return this.ctx;
      } catch (error) {
        return null;
      }
    }
    tone(freq, duration = 0.08, type = "sine", gain = 0.025, delay = 0) {
      const ctx = this.ensure();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      const start = ctx.currentTime + delay;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    }
    click() { this.tone(540, 0.035, "triangle", 0.012); }
    place() { this.tone(315, 0.055, "triangle", 0.03); this.tone(540, 0.08, "sine", 0.022, 0.035); }
    remove() { this.tone(230, 0.07, "triangle", 0.018); }
    deny() { this.tone(120, 0.12, "square", 0.016); this.tone(102, 0.14, "square", 0.012, 0.07); }
    testStart() { this.tone(330, 0.1, "sine", 0.03); this.tone(440, 0.12, "sine", 0.025, 0.1); this.tone(660, 0.15, "sine", 0.022, 0.21); }
    breakSound() {
      const ctx = this.ensure();
      if (!ctx) return;
      const length = Math.floor(ctx.sampleRate * 0.19);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.2);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      filter.type = "lowpass";
      filter.frequency.value = 760;
      gain.gain.value = 0.10;
      src.buffer = buffer;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.start();
    }
    success() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.32, "sine", 0.027, i * 0.1));
    }
    fail() {
      [330, 262, 196].forEach((f, i) => this.tone(f, 0.28, "triangle", 0.024, i * 0.14));
    }
  }
  const audio = new AudioEngine();

  /* ---------------- przechowywanie ---------------- */
  function readProjects() {
    try {
      const raw = localStorage.getItem(DESIGN_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function persistProjects() {
    try {
      projects[state.level.id] = state.designBeams.map((b) => ({ ...b }));
      localStorage.setItem(DESIGN_KEY, JSON.stringify(projects));
      if (saveIndicatorTimer) clearTimeout(saveIndicatorTimer);
      dom.saveIndicator.classList.add("show");
      saveIndicatorTimer = setTimeout(() => dom.saveIndicator.classList.remove("show"), 1300);
    } catch (error) {
      // Gra działa dalej bez zapisu.
    }
  }

  function validateSavedBeams(level, rawBeams) {
    if (!Array.isArray(rawBeams)) return [];
    const result = [];
    const usedPairs = new Set();
    let spent = 0;
    for (const raw of rawBeams.slice(0, 140)) {
      if (!raw || !MATERIALS[raw.material]) continue;
      const a = level.nodeById[raw.a];
      const b = level.nodeById[raw.b];
      if (!a || !b || a.id === b.id) continue;
      if (raw.material === "road" && (!a.deck || !b.deck)) continue;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 20 || length > level.maxBeam + 1) continue;
      const pair = [a.id, b.id].sort().join("|");
      if (usedPairs.has(pair)) continue;
      const cost = (length / PX_PER_M) * MATERIALS[raw.material].cost;
      if (spent + cost > level.budget + 0.01) continue;
      usedPairs.add(pair);
      spent += cost;
      result.push({
        id: `b${result.length + 1}_${Math.floor(Math.random() * 9999)}`,
        a: a.id, b: b.id, material: raw.material
      });
    }
    return result;
  }

  /* ---------------- narzędzia projektowe ---------------- */
  function nodeDist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

  function beamCost(beam) {
    const a = state.level.nodeById[beam.a];
    const b = state.level.nodeById[beam.b];
    if (!a || !b) return 0;
    return (nodeDist(a, b) / PX_PER_M) * MATERIALS[beam.material].cost;
  }

  function getMetrics(beams = state.designBeams) {
    let cost = 0;
    let lengthPx = 0;
    let roadCount = 0;
    for (const beam of beams) {
      const a = state.level.nodeById[beam.a];
      const b = state.level.nodeById[beam.b];
      if (!a || !b) continue;
      const d = nodeDist(a, b);
      cost += (d / PX_PER_M) * MATERIALS[beam.material].cost;
      lengthPx += d;
      if (beam.material === "road") roadCount++;
    }
    return { cost, lengthPx, roadCount, elements: beams.length };
  }

  function roadRouteInfo(beams = state.designBeams) {
    const adjacency = new Map();
    let roadCount = 0;
    for (const beam of beams) {
      if (beam.material !== "road") continue;
      roadCount++;
      if (!adjacency.has(beam.a)) adjacency.set(beam.a, []);
      if (!adjacency.has(beam.b)) adjacency.set(beam.b, []);
      adjacency.get(beam.a).push(beam.b);
      adjacency.get(beam.b).push(beam.a);
    }
    const visited = new Set(["L"]);
    const previous = new Map();
    const queue = ["L"];
    while (queue.length) {
      const node = queue.shift();
      if (node === "R") break;
      for (const next of adjacency.get(node) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          previous.set(next, node);
          queue.push(next);
        }
      }
    }
    const connected = visited.has("R");
    let path = [];
    if (connected) {
      let cursor = "R";
      path = [cursor];
      while (cursor !== "L" && previous.has(cursor)) {
        cursor = previous.get(cursor);
        path.unshift(cursor);
      }
    }
    return { connected, roadCount, path };
  }

  function supportMaterialId(beam) {
    if (!beam) return "";
    return typeof beam.material === "string" ? beam.material : beam.material.id;
  }

  // Nośna część mostu musi tworzyć ciągłą drogę od każdego punktu drogowego
  // do stałej podpory w skale. Sama jezdnia nie może być traktowana jak lina.
  function supportNetworkStatus(beams = state.designBeams) {
    const adjacency = new Map();
    let supportCount = 0;
    for (const raw of beams) {
      if (!raw || raw.broken) continue;
      if (supportMaterialId(raw) === "road") continue;
      const design = raw.design || raw;
      const a = design.a;
      const b = design.b;
      if (!a || !b) continue;
      supportCount++;
      if (!adjacency.has(a)) adjacency.set(a, []);
      if (!adjacency.has(b)) adjacency.set(b, []);
      adjacency.get(a).push(b);
      adjacency.get(b).push(a);
    }

    const fixedIds = state.level.nodes.filter((node) => node.fixed).map((node) => node.id);
    const anchored = new Set(fixedIds);
    const queue = fixedIds.slice();
    while (queue.length) {
      const node = queue.shift();
      for (const next of adjacency.get(node) || []) {
        if (!anchored.has(next)) {
          anchored.add(next);
          queue.push(next);
        }
      }
    }

    const missing = state.level.interiorDeck.filter((id) => !anchored.has(id));
    return { ok: missing.length === 0, missing, supportCount };
  }

  function validateConnection(aId, bId, materialId) {
    if (state.mode !== "build") return { ok: false, reason: "Budowanie jest zablokowane podczas testu." };
    const a = state.level.nodeById[aId];
    const b = state.level.nodeById[bId];
    const material = MATERIALS[materialId];
    if (!a || !b || !material) return { ok: false, reason: "Nieprawidłowe punkty." };
    if (a.id === b.id) return { ok: false, reason: "Wybierz dwa różne punkty." };
    const length = nodeDist(a, b);
    const lengthM = length / PX_PER_M;
    const cost = lengthM * material.cost;
    if (length < 20) return { ok: false, reason: "Element jest zbyt krótki.", lengthM, cost };
    if (length > state.level.maxBeam + 0.1) {
      return { ok: false, reason: `Maksymalna długość elementu to ${(state.level.maxBeam / PX_PER_M).toFixed(1)} m.`, lengthM, cost };
    }
    if (materialId === "road" && (!a.deck || !b.deck)) {
      return { ok: false, reason: "Droga może łączyć wyłącznie punkty drogowe.", lengthM, cost };
    }
    const duplicate = state.designBeams.some(
      (beam) => (beam.a === a.id && beam.b === b.id) || (beam.a === b.id && beam.b === a.id)
    );
    if (duplicate) return { ok: false, reason: "Te punkty są już połączone.", lengthM, cost };
    const currentCost = getMetrics().cost;
    if (currentCost + cost > state.level.budget + 0.01) {
      return { ok: false, reason: "Brakuje środków w budżecie.", lengthM, cost, overBudget: true };
    }
    return { ok: true, reason: "", lengthM, cost };
  }

  function snapshot() { return state.designBeams.map((b) => ({ ...b })); }

  function pushUndo() {
    state.undoStack.push(snapshot());
    if (state.undoStack.length > 70) state.undoStack.shift();
    state.redoStack.length = 0;
  }

  function restoreDesign(beams) {
    state.designBeams = beams.map((b) => ({ ...b }));
    if (state.selectedId && !state.designBeams.some((b) => b.id === state.selectedId)) {
      state.selectedId = null;
    }
    state.pendingStart = null;
    state.drag = null;
    persistProjects();
    updateUI();
  }

  function addBeam(aId, bId, materialId, silent = false) {
    const validation = validateConnection(aId, bId, materialId);
    if (!validation.ok) {
      if (!silent) {
        toast(validation.reason, validation.overBudget ? "bad" : "warn");
        audio.deny();
      }
      return false;
    }
    pushUndo();
    const beam = {
      id: `b${state.nextBeamId++}`,
      a: aId, b: bId, material: materialId
    };
    state.designBeams.push(beam);
    state.selectedId = beam.id;
    state.pendingStart = null;
    state.drag = null;
    state.bannerDismissed = true;
    persistProjects();
    audio.place();
    updateUI();
    setStatus(`Dodano ${MATERIALS[materialId].name.toLowerCase()} · ${formatMoney(validation.cost)}`);
    return true;
  }

  function removeBeam(id, silent = false) {
    const index = state.designBeams.findIndex((beam) => beam.id === id);
    if (index < 0) return false;
    pushUndo();
    const [removed] = state.designBeams.splice(index, 1);
    if (state.selectedId === id) state.selectedId = null;
    persistProjects();
    if (!silent) {
      audio.remove();
      toast(`Usunięto ${MATERIALS[removed.material].name.toLowerCase()}.`, "", 1500);
    }
    updateUI();
    return true;
  }

  function changeBeamMaterial(id, materialId) {
    const beam = state.designBeams.find((item) => item.id === id);
    if (!beam || state.mode !== "build") return;
    if (beam.material === materialId) return;
    const a = state.level.nodeById[beam.a];
    const b = state.level.nodeById[beam.b];
    if (materialId === "road" && (!a.deck || !b.deck)) {
      toast("Droga może łączyć tylko punkty drogowe.", "warn");
      audio.deny();
      return;
    }
    const oldCost = beamCost(beam);
    const lengthM = nodeDist(a, b) / PX_PER_M;
    const newCost = lengthM * MATERIALS[materialId].cost;
    const total = getMetrics().cost - oldCost + newCost;
    if (total > state.level.budget + 0.01) {
      toast("Zmiana materiału przekracza budżet.", "bad");
      audio.deny();
      return;
    }
    pushUndo();
    beam.material = materialId;
    persistProjects();
    audio.place();
    updateUI();
    toast(`Materiał zmieniony na: ${MATERIALS[materialId].name}.`, "good", 1500);
  }

  function clearDesign() {
    if (!state.designBeams.length) {
      toast("Projekt jest już pusty.", "", 1500);
      return;
    }
    pushUndo();
    state.designBeams = [];
    state.selectedId = null;
    state.pendingStart = null;
    state.drag = null;
    persistProjects();
    audio.remove();
    updateUI();
    toast("Projekt wyczyszczony. Ctrl+Z cofa zmianę.", "", 2200);
  }

  function undo() {
    if (!state.undoStack.length || state.mode !== "build") return;
    state.redoStack.push(snapshot());
    const previous = state.undoStack.pop();
    restoreDesign(previous);
    audio.click();
    toast("Cofnięto ostatnią zmianę.", "", 1300);
  }

  function redo() {
    if (!state.redoStack.length || state.mode !== "build") return;
    state.undoStack.push(snapshot());
    const next = state.redoStack.pop();
    restoreDesign(next);
    audio.click();
    toast("Ponowiono zmianę.", "", 1300);
  }

  function selectBeam(id) {
    state.selectedId = id;
    state.pendingStart = null;
    state.drag = null;
    updateUI();
  }

  function deselect() {
    state.selectedId = null;
    state.pendingStart = null;
    state.drag = null;
    updateUI();
  }

  /* ---------------- interfejs ---------------- */
  function toast(message, type = "", duration = 2600) {
    const element = document.createElement("div");
    element.className = `toast ${type}`.trim();
    element.textContent = message;
    dom.toastStack.appendChild(element);
    while (dom.toastStack.children.length > 4) dom.toastStack.firstChild.remove();
    setTimeout(() => {
      element.classList.add("out");
      setTimeout(() => element.remove(), 280);
    }, duration);
  }

  function setStatus(text) {
    dom.stageStatus.textContent = text;
    dom.statusText.textContent = text;
  }

  function materialCardHTML(material) {
    return `
      <button class="material-card" data-material="${material.id}" aria-pressed="false">
        <span class="material-key">${material.key}</span>
        <span class="material-swatch ${material.id}"></span>
        <span class="material-name">
          <strong>${material.name}</strong>
          <small>${material.subtitle}</small>
        </span>
        <span class="material-price"><strong>${material.cost} zł/m</strong>${material.density} kg/m</span>
      </button>`;
  }

  function renderMaterials() {
    dom.materials.innerHTML = MATERIAL_ORDER.map((id) => materialCardHTML(MATERIALS[id])).join("");
    dom.materials.querySelectorAll(".material-card").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.mode !== "build") return;
        state.material = button.dataset.material;
        audio.click();
        updateUI();
      });
    });
  }

  function renderMaterialTable() {
    dom.materialTable.innerHTML = MATERIAL_ORDER.map((id) => {
      const material = MATERIALS[id];
      const strength = id === "cable" ? 59 : Math.round((material.maxTension / 110000) * 100);
      return `<div class="mat-table-col">
        <strong>${material.name}</strong>
        <span>${material.cost} zł/m · ${material.density} kg/m</span>
        <span>${id === "cable" ? "tylko rozciąganie" : `wytrzymałość ${(material.maxTension / 1000).toFixed(0)} kN`}</span>
        <div class="bar"><i style="width:${strength}%"></i></div>
      </div>`;
    }).join("");
  }

  function vehicleIcon(vehicle) {
    const cargo = vehicle.cargo;
    return `<svg viewBox="0 0 58 24" aria-hidden="true">
      <path d="M4 17h50" stroke="#172027" stroke-width="2" opacity=".35"/>
      <circle cx="15" cy="18" r="5" fill="#1c2429" stroke="#58656c" stroke-width="2"/>
      <circle cx="44" cy="18" r="5" fill="#1c2429" stroke="#58656c" stroke-width="2"/>
      <path d="${cargo
        ? "M5 8h28v9H5zM33 10h12l6 6v1H33z"
        : "M7 14c1-5 5-8 13-8 6 0 10 2 14 7 5 0 8 1 8 4v1H6z"}" fill="${vehicle.color}" stroke="${vehicle.colorDark}" stroke-width="1.4"/>
      <path d="${cargo ? "M9 10h20v4H9z" : "M18 8h10l5 5H15z"}" fill="#a9d1de" opacity=".8"/>
      <circle cx="15" cy="18" r="2" fill="#83939a"/>
      <circle cx="44" cy="18" r="2" fill="#83939a"/>
    </svg>`;
  }

  function renderVehicles() {
    dom.vehicles.innerHTML = Object.values(VEHICLES).map((vehicle) => {
      const allowed = state.level.vehicleList.includes(vehicle.id);
      return `<button class="vehicle-option" data-vehicle="${vehicle.id}" ${allowed ? "" : "disabled"} title="${allowed ? vehicle.subtitle : "Pojazd niedostępny na tym poziomie"}">
        <div class="v-icon">${vehicleIcon(vehicle)}</div>
        <strong>${vehicle.name}</strong>
        <span>${formatMass(vehicle.mass)}</span>
      </button>`;
    }).join("");
    dom.vehicles.querySelectorAll(".vehicle-option").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.mode !== "build" || button.disabled) return;
        state.vehicleId = button.dataset.vehicle;
        audio.click();
        updateUI();
      });
    });
  }

  function renderLevelTabs() {
    dom.levelTabs.innerHTML = LEVELS.map((level, index) => {
      const unlocked = index < state.progress.unlocked;
      const stars = state.progress.stars[level.id] || 0;
      return `<button class="level-tab ${unlocked ? "" : "locked"} ${index === state.levelIndex ? "active" : ""}"
        data-level="${index}" title="${unlocked ? level.name : "Poziom zablokowany"}" aria-label="Poziom ${level.id}: ${level.name}">
        ${level.id}${stars ? `<span class="tab-stars">${"★".repeat(stars)}</span>` : ""}
      </button>`;
    }).join("");
    dom.levelTabs.querySelectorAll(".level-tab").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.level);
        if (index >= state.progress.unlocked) {
          toast("Ukończ poprzedni poziom, aby odblokować ten etap.", "warn");
          audio.deny();
          return;
        }
        if (state.mode !== "build") {
          toast("Najpierw wróć do trybu budowania.", "warn");
          return;
        }
        switchLevel(index);
      });
    });
  }

  function updateMaterialCards() {
    dom.materials.querySelectorAll(".material-card").forEach((button) => {
      const active = button.dataset.material === state.material;
      button.classList.toggle("active", active);
      button.classList.toggle("disabled", state.mode !== "build");
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function updateVehicleCards() {
    dom.vehicles.querySelectorAll(".vehicle-option").forEach((button) => {
      const allowed = state.level.vehicleList.includes(button.dataset.vehicle);
      button.classList.toggle("active", button.dataset.vehicle === state.vehicleId);
      button.disabled = !allowed || state.mode !== "build";
    });
  }

  function renderMiniMaterials(selected) {
    dom.miniMaterials.innerHTML = MATERIAL_ORDER.map((id) => {
      const material = MATERIALS[id];
      return `<button class="mini-mat ${selected && selected.material === id ? "active" : ""}" data-mini-material="${id}" title="${material.name}">${material.name}</button>`;
    }).join("");
    dom.miniMaterials.querySelectorAll(".mini-mat").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.selectedId) changeBeamMaterial(state.selectedId, button.dataset.miniMaterial);
      });
    });
  }

  function updateSelectionCard() {
    const beam = state.designBeams.find((item) => item.id === state.selectedId);
    if (!beam || state.mode !== "build") {
      dom.selectionCard.hidden = true;
      return;
    }
    const a = state.level.nodeById[beam.a];
    const b = state.level.nodeById[beam.b];
    const lengthM = nodeDist(a, b) / PX_PER_M;
    const cost = beamCost(beam);
    dom.selectionCard.hidden = false;
    dom.selectedName.textContent = `${MATERIALS[beam.material].name} — ${a.id} ↔ ${b.id}`;
    dom.selectedLength.textContent = `${lengthM.toFixed(1)} m`;
    dom.selectedCost.textContent = formatMoney(cost);
    dom.selectedStress.textContent = "brak obciążenia";
    renderMiniMaterials(beam);
  }

  function updateUI() {
    if (!state.level) return;
    const metrics = getMetrics();
    const remaining = state.level.budget - metrics.cost;
    const route = roadRouteInfo();
    const percent = Math.min(100, (metrics.cost / state.level.budget) * 100);

    dom.levelNo.textContent = `POZIOM ${state.level.id}`;
    dom.levelName.textContent = state.level.name;
    dom.levelMission.textContent = state.level.mission;
    dom.levelDifficulty.textContent = state.level.difficulty;
    dom.levelSpan.textContent = `${state.level.spanMeters.toFixed(1)} m`;
    dom.levelVehicles.textContent = state.level.vehicleList.map((id) => VEHICLES[id].name).join(" / ");

    dom.budgetTotal.textContent = formatMoney(state.level.budget);
    dom.budgetLeft.textContent = formatMoney(Math.max(0, remaining));
    dom.projectCost.textContent = formatMoney(metrics.cost);
    dom.budgetBar.style.width = `${percent}%`;
    dom.budgetPct.textContent = `${Math.round(percent)}%`;
    dom.budgetCard.classList.toggle("over", remaining < -0.01);
    dom.budgetLeft.parentElement.classList.toggle("low", remaining < state.level.budget * 0.12);

    dom.statElements.textContent = String(metrics.elements);
    dom.statLength.textContent = `${(metrics.lengthPx / PX_PER_M).toFixed(1)} m`;
    dom.statRoad.textContent = route.connected ? "ciągła" : route.roadCount ? "przerwana" : "brak";
    dom.statRoad.className = route.connected ? "ok" : "missing";

    const ready = route.connected;
    dom.btnTest.disabled = false;
    dom.testSubtext.textContent = ready
      ? `Droga ciągła · ${formatMoney(metrics.cost)}`
      : "Brak ciągłej drogi";
    dom.btnTest.classList.toggle("not-ready", !ready);

    dom.btnUndo.disabled = !state.undoStack.length || state.mode !== "build";
    dom.btnRedo.disabled = !state.redoStack.length || state.mode !== "build";
    dom.btnDelete.disabled = !state.selectedId || state.mode !== "build";
    dom.btnClear.disabled = !state.designBeams.length || state.mode !== "build";
    dom.btnHint.disabled = state.mode !== "build";

    updateMaterialCards();
    updateVehicleCards();
    updateSelectionCard();

    const testing = state.mode === "testing" || state.mode === "paused" || state.mode === "result";
    dom.buildActions.hidden = state.mode !== "build";
    dom.testActions.hidden = !testing || state.mode === "result";
    dom.testHud.hidden = !testing;
    dom.canvasLegend.hidden = testing;
    if (state.mode === "build") dom.countdown.hidden = true;

    dom.btnPause.textContent = state.mode === "paused" ? "WZNÓW" : "PAUZA";
    const chipClass = state.mode === "testing" ? "testing" : state.mode === "paused" ? "paused" : "build";
    const chipText = state.mode === "testing" ? "TEST W TOKU" : state.mode === "paused" ? "SYMULACJA WSTRZYMANA" : "TRYB BUDOWANIA";
    dom.modeChip.className = `mode-chip ${chipClass}`;
    dom.modeChip.innerHTML = `<i></i> ${chipText}`;
    dom.statusDot.className = `status-dot ${chipClass}`;

    if (state.mode === "build") {
      dom.canvasBanner.classList.toggle("hidden", state.bannerDismissed || state.designBeams.length > 0);
      setStatus(ready ? "Droga jest ciągła. Możesz rozpocząć test." : (state.designBeams.length ? "Uzupełnij brakujące odcinki drogi." : "Wybierz materiał i połącz punkty konstrukcyjne."));
    } else if (state.mode === "paused") {
      setStatus("Symulacja wstrzymana — naciśnij WZNÓW lub Spację.");
    } else if (state.mode === "result") {
      setStatus("Test zakończony.");
    } else {
      setStatus("Test w toku — obserwuj obciążenie konstrukcji.");
    }
  }

  /* ---------------- poziomy i tryby ---------------- */
  function switchLevel(index) {
    if (index < 0 || index >= LEVELS.length) return;
    if (index >= state.progress.unlocked) {
      toast("Ten poziom jest jeszcze zablokowany.", "warn");
      return;
    }
    if (state.level) persistProjects();
    closeModal(dom.resultModal);
    closeModal(dom.helpModal);
    state.levelIndex = index;
    state.level = LEVELS[index];
    state.designBeams = validateSavedBeams(state.level, projects[state.level.id] || []);
    state.nextBeamId = state.designBeams.length + 1;
    state.undoStack = [];
    state.redoStack = [];
    state.selectedId = null;
    state.pendingStart = null;
    state.drag = null;
    state.hoverNodeId = null;
    state.mode = "build";
    state.sim = null;
    state.car = null;
    state.test = null;
    state.accumulator = 0;
    state.particles = [];
    state.shake = 0;
    state.bannerDismissed = state.designBeams.length > 0;
    state.vehicleId = state.level.vehicleList.includes(state.level.recommendedVehicle)
      ? state.level.recommendedVehicle
      : state.level.vehicleList[0];
    state.countdownDisplay = null;
    state.hintUntil = 0;
    dom.countdown.hidden = true;
    dom.resultModal.hidden = true;
    dom.costBubble.hidden = true;
    renderLevelTabs();
    renderVehicles();
    updateUI();
    resizeCanvas();
    toast(`Poziom ${state.level.id}: ${state.level.name}`, "", 1900);
    audio.click();
  }

  function startTest(reset = false) {
    if (state.mode === "build" && !reset) {
      const route = roadRouteInfo();
      if (!route.connected) {
        toast("Droga nie jest ciągła. Połącz odcinek drogowy od lewego do prawego brzegu.", "bad", 3600);
        state.hintUntil = performance.now() + 6500;
        audio.deny();
        updateUI();
        return;
      }
      const support = supportNetworkStatus();
      if (!support.ok) {
        toast("Każdy punkt drogowy musi mieć zakotwiczoną podporę. Poprowadź belki lub liny od jezdni do stałych punktów w skale.", "bad", 5200);
        state.hintUntil = performance.now() + 9000;
        audio.deny();
        updateUI();
        return;
      }
      persistProjects();
    }
    if (!state.level.vehicleList.includes(state.vehicleId)) {
      state.vehicleId = state.level.vehicleList[0];
    }
    closeModal(dom.resultModal);
    closeModal(dom.helpModal);
    state.selectedId = null;
    state.pendingStart = null;
    state.drag = null;
    state.sim = new BridgeSimulation(state.level, state.designBeams);
    state.car = new VehicleSimulation(state.level, VEHICLES[state.vehicleId]);
    state.test = {
      countdown: 3.35,
      runTime: 0,
      endTimer: null,
      success: false,
      reason: "running",
      finished: false,
      lastCountdown: 4,
      supportTimer: 0
    };
    state.mode = "testing";
    state.accumulator = 0;
    state.countdownDisplay = null;
    state.particles = [];
    state.shake = 0;
    dom.resultModal.hidden = true;
    dom.costBubble.hidden = true;
    dom.countdown.hidden = false;
    dom.countdown.querySelector("span").textContent = "PRZYGOTOWANIE";
    dom.countdown.querySelector("strong").textContent = "3";
    updateUI();
    audio.testStart();
    toast(reset ? "Test zresetowany." : "Most się stabilizuje. Za chwilę start.", "", 1800);
    setStatus("Przygotowanie do przejazdu...");
  }

  function pauseTest() {
    if (state.mode === "testing") {
      state.mode = "paused";
      state.pausedFrom = "testing";
      state.accumulator = 0;
      updateUI();
      audio.click();
    } else if (state.mode === "paused") {
      state.mode = "testing";
      state.accumulator = 0;
      updateUI();
      audio.click();
    }
  }

  function resetTest() {
    if (state.mode === "build") return;
    startTest(true);
  }

  function backToBuild() {
    closeModal(dom.resultModal);
    closeModal(dom.helpModal);
    state.mode = "build";
    state.sim = null;
    state.car = null;
    state.test = null;
    state.accumulator = 0;
    state.selectedId = null;
    state.pendingStart = null;
    state.drag = null;
    state.particles = [];
    state.shake = 0;
    dom.resultModal.hidden = true;
    dom.countdown.hidden = true;
    dom.testHud.hidden = true;
    dom.costBubble.hidden = true;
    updateUI();
    resizeCanvas();
    audio.click();
    toast("Wróciłeś do projektu. Możesz poprawić konstrukcję.", "good", 2200);
  }

  /* ---------------- test ---------------- */
  function fixedStep(dt) {
    const test = state.test;
    const sim = state.sim;
    const car = state.car;
    if (!test || !sim) return;

    if (test.countdown > 0) {
      test.countdown -= dt;
      if (test.countdown <= 0) {
        car.start();
        test.countdown = 0;
        toast("START!", "good", 900);
      }
    } else if (!test.endTimer) {
      car.update(dt, sim);
      test.runTime += dt;
    }

    sim.step(dt);
    handleBreakEvents();

    test.supportTimer += dt;
    if (!test.endTimer && test.supportTimer >= 0.2 && sim.time > 2.6) {
      test.supportTimer = 0;
      if (!supportNetworkStatus(sim.beams).ok) {
        test.success = false;
        test.reason = "collapse";
        test.endTimer = 1.15;
      }
    }

    if (!test.endTimer) {
      if (car.finished) {
        test.success = true;
        test.reason = "crossed";
        test.endTimer = 1.15;
      } else if (car.failed) {
        test.success = false;
        test.reason = "fell";
        test.endTimer = 1.15;
      } else if (test.runTime > 42) {
        test.success = false;
        test.reason = "timeout";
        test.endTimer = 1.15;
      }
    } else {
      test.endTimer -= dt;
      if (test.endTimer <= 0) {
        test.endTimer = -1;
        finishTest(test.success, test.reason);
      }
    }

    if (sim.brokenCount > 0) {
      state.shake = Math.max(state.shake, 3);
    }
    if (car && car.failed) state.shake = Math.max(state.shake, 4);
  }

  function handleBreakEvents() {
    if (!state.sim || !state.sim.breakEvents.length) return;
    for (const event of state.sim.breakEvents) {
      spawnBreakParticles(event);
      state.shake = Math.max(state.shake, 6);
    }
    const now = performance.now();
    if (now - state.lastBreakSound > 90) {
      audio.breakSound();
      state.lastBreakSound = now;
    }
  }

  function settleBridgeBeforeResult() {
    state.accumulator = 0;
  }

  function finishTest(success, reason) {
    const metrics = getMetrics();
    const sim = state.sim;
    const car = state.car;
    const broken = sim.brokenCount;
    const survived = broken === 0;
    const remaining = state.level.budget - metrics.cost;
    let stars = 0;
    if (success) {
      stars = 1;
      if (survived) stars++;
      if (metrics.cost <= state.level.budget * 0.9) stars++;
    }

    state.mode = "result";
    state.lastResultSuccess = success;
    state.lastResultReason = reason;
    state.accumulator = 0;
    setStatus("Test zakończony.");

    if (success) {
      state.progress.stars[state.level.id] = Math.max(state.progress.stars[state.level.id] || 0, stars);
      const nextUnlocked = Math.min(LEVELS.length, state.level.id + 1);
      if (state.level.id < LEVELS.length) {
        state.progress.unlocked = Math.max(state.progress.unlocked, nextUnlocked);
      }
      saveProgress(state.progress);
      renderLevelTabs();
      audio.success();
    } else {
      audio.fail();
    }

    const starReason = success
      ? stars === 3
        ? "Bezbłędne i oszczędne wykonanie — pełna ocena inżynierska."
        : stars === 2
          ? "Bezpieczny przejazd, ale konstrukcja nie była wystarczająco oszczędna."
          : "Pojazd przejechał, lecz most został uszkodzony lub koszt był zbyt wysoki."
      : reason === "collapse"
        ? "Nośna część mostu straciła połączenie ze skałą. Wróć do projektu i oprzyj jezdnię na zakotwiczonej kratownicy."
        : reason === "fell"
          ? "Pojazd stracił podparcie. Wróć do projektu i wzmocnij konstrukcję."
          : "Przejazd nie zakończył się w wyznaczonym czasie.";

    dom.resultModal.classList.toggle("failed", !success);
    dom.resultBadge.textContent = success ? "✓" : "×";
    dom.resultEyebrow.textContent = success ? "TEST ZAKOŃCZONY" : "TEST NIEUDANY";
    dom.resultTitle.textContent = success ? "Przeprawa udana!" : "Most nie utrzymał pojazdu";
    dom.resultSubtitle.textContent = success
      ? "Pojazd bezpiecznie dotarł na drugi brzeg."
      : (reason === "timeout"
        ? "Test trwał zbyt długo, by uznać przejazd."
        : reason === "collapse"
          ? "Konstrukcja nośna straciła zakotwiczenie — jezdnia nie ma już podparcia."
          : "Pojazd spadł do doliny — konstrukcja nie przeniosła obciążenia.");
    [...dom.resultStars.children].forEach((star, index) => {
      star.classList.toggle("on", index < stars);
    });
    const survivedText = survived ? "Tak" : "Nie";
    dom.resultStats.innerHTML = `
      <div><span>Dotarcie na brzeg</span><strong class="${success ? "good" : "bad"}">${success ? "Tak" : "Nie"}</strong></div>
      <div><span>Most przetrwał przejazd</span><strong class="${survived ? "good" : "bad"}">${survivedText}</strong></div>
      <div><span>Wydano z budżetu</span><strong>${formatMoney(metrics.cost)}</strong></div>
      <div><span>Pozostało</span><strong class="${remaining > 0 ? "good" : ""}">${formatMoney(Math.max(0, remaining))}</strong></div>
      <div><span>Uszkodzone elementy</span><strong class="${broken ? "bad" : "good"}">${broken}</strong></div>
      <div><span>Maks. obciążenie</span><strong>${Math.round((sim.maxStress || 0) * 100)}%</strong></div>`;
    dom.starNote.textContent = starReason;

    if (success) {
      const isLast = state.level.id === LEVELS.length;
      dom.btnResultNext.textContent = isLast ? "WRÓĆ DO BUDOWANIA" : "NASTĘPNY POZIOM";
    } else {
      dom.btnResultNext.textContent = "SPRÓBUJ PONOWNIE";
    }
    dom.btnResultBuild.textContent = "POPRAW MOST";
    dom.resultModal.hidden = false;
    updateUI();
  }

  /* ---------------- cząstki ---------------- */
  function spawnBreakParticles(event) {
    const material = event.material;
    for (let i = 0; i < 20; i++) {
      state.particles.push({
        x: event.x, y: event.y,
        vx: (Math.random() - 0.5) * 170,
        vy: -Math.random() * 120 - 10,
        life: 0.45 + Math.random() * 0.85,
        maxLife: 1.3,
        size: 1.2 + Math.random() * 2.6,
        color: i % 4 === 0 ? "#ffb347" : i % 3 === 0 ? material.colorLight : material.color,
        gravity: 360,
        shape: i % 5 === 0 ? "spark" : "dust"
      });
    }
  }

  function spawnDust(x, y) {
    state.particles.push({
      x: x + (Math.random() - 0.5) * 9,
      y,
      vx: -18 - Math.random() * 26,
      vy: -6 - Math.random() * 12,
      life: 0.45,
      maxLife: 0.45,
      size: 1.3 + Math.random() * 2,
      color: "rgba(214, 203, 183, .7)",
      gravity: 25,
      shape: "dust"
    });
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      p.vy += (p.gravity || 300) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.99;
      if (p.y > state.level.world.floorY) {
        p.y = state.level.world.floorY;
        p.vy *= -0.15;
      }
    }
    state.shake = Math.max(0, state.shake - dt * 24);
  }

  /* ---------------- obsługa wskaźnika ---------------- */
  function updateScreenPoint(clientX, clientY) {
    const rect = dom.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const s = state.screen;
    state.pointer.x = x;
    state.pointer.y = y;
    state.pointer.wx = (x - s.ox) / s.scale;
    state.pointer.wy = (y - s.oy) / s.scale;
    state.pointer.inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
  }

  function worldToScreen(x, y) {
    const s = state.screen;
    return { x: s.ox + x * s.scale, y: s.oy + y * s.scale };
  }

  function findNodeAt(sx, sy, threshold = 16) {
    let best = null;
    let bestDistance = threshold;
    for (const node of state.level.nodes) {
      const point = worldToScreen(node.x, node.y);
      const d = Math.hypot(point.x - sx, point.y - sy);
      if (d < bestDistance) {
        bestDistance = d;
        best = node;
      }
    }
    return best;
  }

  function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function findBeamAt(sx, sy) {
    let best = null;
    let bestDistance = 11;
    for (const beam of state.designBeams) {
      const a = state.level.nodeById[beam.a];
      const b = state.level.nodeById[beam.b];
      if (!a || !b) continue;
      const p1 = worldToScreen(a.x, a.y);
      const p2 = worldToScreen(b.x, b.y);
      const d = distanceToSegment(sx, sy, p1.x, p1.y, p2.x, p2.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = beam;
      }
    }
    return best;
  }

  function updateCostBubble() {
    if (state.mode !== "build" || !state.pendingStart || !state.pointer.inside) {
      dom.costBubble.hidden = true;
      return;
    }
    const start = state.level.nodeById[state.pendingStart];
    if (!start) {
      dom.costBubble.hidden = true;
      return;
    }
    const hover = state.hoverNodeId ? state.level.nodeById[state.hoverNodeId] : null;
    const target = hover && hover.id !== start.id ? hover : null;
    const endX = target ? target.x : state.pointer.wx;
    const endY = target ? target.y : state.pointer.wy;
    const lengthM = Math.hypot(endX - start.x, endY - start.y) / PX_PER_M;
    const material = MATERIALS[state.material];
    const cost = lengthM * material.cost;
    const validation = target ? validateConnection(start.id, target.id, state.material) : null;
    let text;
    if (!target) {
      text = `<strong>${material.name} · ${lengthM.toFixed(1)} m</strong><small>Wskaż drugi punkt konstrukcyjny</small>`;
      dom.costBubble.classList.remove("bad");
    } else if (validation.ok) {
      text = `<strong>${material.name} · ${lengthM.toFixed(1)} m</strong>${formatMoney(cost)}<small>Kliknij, aby zbudować</small>`;
      dom.costBubble.classList.remove("bad");
    } else {
      text = `<strong>${material.name} · ${lengthM.toFixed(1)} m</strong>${formatMoney(cost)}<small>${validation.reason}</small>`;
      dom.costBubble.classList.add("bad");
    }
    dom.costBubble.innerHTML = text;
    dom.costBubble.hidden = false;
    const left = Math.max(86, Math.min(dom.canvas.clientWidth - 86, state.pointer.x));
    const top = Math.max(62, Math.min(dom.canvas.clientHeight - 10, state.pointer.y));
    dom.costBubble.style.left = `${left}px`;
    dom.costBubble.style.top = `${top}px`;
  }

  function onPointerMove(event) {
    if (event.pointerType === "touch" && !event.buttons) return;
    updateScreenPoint(event.clientX, event.clientY);
    if (state.mode !== "build") {
      dom.canvas.style.cursor = "default";
      return;
    }
    const node = findNodeAt(state.pointer.x, state.pointer.y);
    state.hoverNodeId = node ? node.id : null;
    if (state.drag) {
      const dx = state.pointer.x - state.drag.startX;
      const dy = state.pointer.y - state.drag.startY;
      if (Math.hypot(dx, dy) > 5) state.drag.moved = true;
    }
    if (node) dom.canvas.style.cursor = "pointer";
    else if (findBeamAt(state.pointer.x, state.pointer.y)) dom.canvas.style.cursor = "pointer";
    else dom.canvas.style.cursor = "crosshair";
    updateCostBubble();
  }

  function onPointerDown(event) {
    audio.ensure();
    if (event.button !== undefined && event.button !== 0) return;
    updateScreenPoint(event.clientX, event.clientY);
    if (state.mode !== "build") return;
    const node = findNodeAt(state.pointer.x, state.pointer.y);
    if (node) {
      if (state.pendingStart) {
        if (state.pendingStart === node.id) {
          state.pendingStart = null;
          state.drag = null;
          dom.costBubble.hidden = true;
          updateUI();
        } else {
          addBeam(state.pendingStart, node.id, state.material);
        }
        return;
      }
      state.pendingStart = node.id;
      state.hoverNodeId = node.id;
      state.drag = {
        startId: node.id,
        startX: state.pointer.x,
        startY: state.pointer.y,
        moved: false
      };
      dom.canvas.setPointerCapture?.(event.pointerId);
      updateCostBubble();
      updateUI();
      return;
    }

    const beam = findBeamAt(state.pointer.x, state.pointer.y);
    if (beam) {
      selectBeam(beam.id);
      audio.click();
    } else {
      if (state.pendingStart) {
        state.pendingStart = null;
        state.drag = null;
        dom.costBubble.hidden = true;
      }
      if (state.selectedId) state.selectedId = null;
      updateUI();
    }
  }

  function onPointerUp(event) {
    if (state.mode !== "build") return;
    updateScreenPoint(event.clientX, event.clientY);
    if (!state.drag) return;
    const drag = state.drag;
    state.drag = null;
    if (!drag.moved) {
      // Pozostaw punkt aktywny — drugi klik dokończy połączenie.
      return;
    }
    const node = findNodeAt(state.pointer.x, state.pointer.y);
    if (node && node.id !== drag.startId) {
      addBeam(drag.startId, node.id, state.material);
    } else {
      state.pendingStart = null;
      dom.costBubble.hidden = true;
      updateUI();
    }
    try { dom.canvas.releasePointerCapture?.(event.pointerId); } catch (error) {}
  }

  function onPointerLeave() {
    state.pointer.inside = false;
    state.hoverNodeId = null;
    dom.costBubble.hidden = true;
    if (!state.drag) dom.canvas.style.cursor = "crosshair";
  }

  function cancelPending() {
    state.pendingStart = null;
    state.drag = null;
    state.hoverNodeId = null;
    dom.costBubble.hidden = true;
    updateUI();
  }

  /* ---------------- pomoc i modale ---------------- */
  function openModal(element) {
    element.hidden = false;
    audio.click();
  }

  function closeModal(element) {
    element.hidden = true;
  }

  function showHint() {
    if (state.mode !== "build") return;
    state.hintUntil = performance.now() + 9000;
    state.bannerDismissed = false;
    const route = roadRouteInfo();
    if (!route.connected) {
      toast("Krok 1: połącz sąsiednie punkty drogowe od lewego do prawego brzegu. Krok 2: dodaj ukośne belki tworzące trójkąty.", "warn", 5200);
    } else if (!supportNetworkStatus().ok) {
      toast("Droga jest ciągła, ale wymaga podparcia. Każdy punkt drogowy połącz belką lub liną z zakotwiczoną kratownicą w skale.", "warn", 5200);
    } else {
      toast("Droga i podpory są gotowe. Możesz rozpocząć test — obserwuj obciążenie elementów.", "good", 4600);
    }
    updateUI();
  }

  /* ---------------- pętla gry ---------------- */
  function resizeCanvas() {
    const rect = dom.canvasWrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    dom.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    dom.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const padding = Math.max(14, Math.min(30, rect.width * 0.022));
    const world = state.level.world;
    const scale = Math.min((rect.width - padding * 2) / world.w, (rect.height - padding * 2) / world.h);
    state.screen = {
      w: rect.width,
      h: rect.height,
      dpr,
      scale,
      ox: (rect.width - world.w * scale) / 2,
      oy: (rect.height - world.h * scale) / 2
    };
  }

  function updateHUD(now) {
    if (!state.sim) return;
    const car = state.car;
    const sim = state.sim;
    if (car) {
      dom.hudVehicle.textContent = VEHICLES[state.vehicleId]?.name || "—";
      dom.hudMass.textContent = formatMass(VEHICLES[state.vehicleId]?.mass || 0);
      dom.hudSpeed.textContent = `${Math.round(car.speedKmh || 0)} km/h`;
    }
    const load = Math.round(Math.min(999, (sim.getLiveMaxStress() || 0) * 100));
    dom.hudLoad.textContent = `${load}%`;
    dom.stressBar.style.width = `${Math.min(100, load)}%`;
    if (state.test) {
      if (state.test.countdown > 0) {
        const display = Math.ceil(state.test.countdown);
        if (display !== state.countdownDisplay) {
          state.countdownDisplay = display;
          dom.countdown.querySelector("strong").textContent = String(display);
          dom.countdown.querySelector("span").textContent = "PRZYGOTOWANIE";
        }
        dom.countdown.hidden = false;
      } else {
        dom.countdown.hidden = true;
      }
    }
    if (state.mode === "testing" && car && car.grounded && Math.abs(car.vx) > 20) {
      state.dustTimer += 1;
      if (state.dustTimer > 7) {
        state.dustTimer = 0;
        const rear = car.lastContacts.find((contact) => contact.wheel === "rear");
        if (rear) spawnDust(rear.x, rear.y - 1);
      }
    }
  }

  function frame(now) {
    const rawDt = state.lastNow ? (now - state.lastNow) / 1000 : 0;
    state.lastNow = now;
    const dt = Math.min(0.05, Math.max(0, rawDt));
    state.now = now / 1000;

    if (state.mode === "testing") {
      state.accumulator += dt;
      let iterations = 0;
      while (state.accumulator >= SOLVER_DT && iterations < 14) {
        fixedStep(SOLVER_DT);
        state.accumulator -= SOLVER_DT;
        iterations++;
        if (state.mode !== "testing") break;
      }
      if (iterations === 14) state.accumulator = 0;
    }

    updateParticles(dt);
    state.uiTimer += dt;
    if (state.uiTimer > 0.09) {
      state.uiTimer = 0;
      updateHUD(now);
    }
    render();
    requestAnimationFrame(frame);
  }

  function render() {
    if (!state.level) return;
    const canvas = dom.canvas;
    const ctx = canvas.getContext("2d");
    const dpr = state.screen.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, state.screen.w, state.screen.h);
    window.MostowniaRenderer.draw(ctx, state, state.now);
  }

  /* ---------------- zdarzenia ---------------- */
  function bindEvents() {
    dom.canvas.addEventListener("pointermove", onPointerMove);
    dom.canvas.addEventListener("pointerdown", onPointerDown);
    dom.canvas.addEventListener("pointerup", onPointerUp);
    dom.canvas.addEventListener("pointercancel", () => {
      state.drag = null;
      state.pendingStart = null;
      dom.costBubble.hidden = true;
      updateUI();
    });
    dom.canvas.addEventListener("pointerleave", onPointerLeave);
    dom.canvas.addEventListener("pointerenter", (event) => {
      state.pointer.inside = true;
      updateScreenPoint(event.clientX, event.clientY);
    });
    dom.canvas.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (state.mode !== "build") return;
      updateScreenPoint(event.clientX, event.clientY);
      const beam = findBeamAt(state.pointer.x, state.pointer.y);
      if (beam) removeBeam(beam.id);
      else if (state.pendingStart) cancelPending();
    });

    dom.btnTest.addEventListener("click", () => startTest(false));
    dom.btnUndo.addEventListener("click", undo);
    dom.btnRedo.addEventListener("click", redo);
    dom.btnDelete.addEventListener("click", () => {
      if (state.selectedId) removeBeam(state.selectedId);
    });
    dom.btnClear.addEventListener("click", clearDesign);
    dom.btnHint.addEventListener("click", showHint);
    dom.btnPause.addEventListener("click", pauseTest);
    dom.btnResetTest.addEventListener("click", resetTest);
    dom.btnBackBuild.addEventListener("click", backToBuild);
    $("btnDeselect").addEventListener("click", deselect);
    $("btnRemoveSelected").addEventListener("click", () => {
      if (state.selectedId) removeBeam(state.selectedId);
    });
    dom.btnResultBuild.addEventListener("click", backToBuild);
    dom.btnResultNext.addEventListener("click", () => {
      closeModal(dom.resultModal);
      if (state.lastResultSuccess) {
        if (state.levelIndex < LEVELS.length - 1) {
          switchLevel(state.levelIndex + 1);
        } else {
          backToBuild();
          toast("Ukończyłeś wszystkie poziomy! Twoje mosty przeszły próbę.", "good", 5000);
        }
      } else {
        startTest(true);
      }
    });

    $("btnHelp").addEventListener("click", () => openModal(dom.helpModal));
    $("btnDismissBanner").addEventListener("click", () => {
      state.bannerDismissed = true;
      updateUI();
    });
    document.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => closeModal($(button.dataset.close)));
    });
    dom.helpModal.addEventListener("click", (event) => {
      if (event.target === dom.helpModal) closeModal(dom.helpModal);
    });
    dom.resultModal.addEventListener("click", (event) => {
      if (event.target === dom.resultModal) backToBuild();
    });

    dom.soundBtn.addEventListener("click", () => {
      state.muted = !state.muted;
      audio.enabled = !state.muted;
      dom.soundBtn.classList.toggle("muted", state.muted);
      dom.soundBtn.setAttribute("aria-pressed", String(!state.muted));
      try { localStorage.setItem(MUTE_KEY, state.muted ? "1" : "0"); } catch (error) {}
      if (!state.muted) audio.click();
    });

    document.addEventListener("keydown", (event) => {
      if (event.target.matches("input, textarea, select")) return;
      const key = event.key.toLowerCase();
      if (event.key === "Escape") {
        if (!dom.helpModal.hidden) { closeModal(dom.helpModal); return; }
        if (!dom.resultModal.hidden) { backToBuild(); return; }
        if (state.pendingStart) { cancelPending(); return; }
        return;
      }
      if (!dom.helpModal.hidden) return;
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (key === "h") { openModal(dom.helpModal); return; }
      if (key === " " || event.code === "Space") {
        if (state.mode === "testing" || state.mode === "paused") {
          event.preventDefault();
          pauseTest();
        }
        return;
      }
      if (state.mode === "build") {
        if (["1", "2", "3", "4"].includes(key)) {
          state.material = MATERIAL_ORDER[Number(key) - 1];
          audio.click();
          updateUI();
          return;
        }
        if (key === "delete" || key === "backspace") {
          event.preventDefault();
          if (state.selectedId) removeBeam(state.selectedId);
          return;
        }
        if (key === "t") { startTest(false); return; }
      } else if (key === "r") {
        resetTest();
      } else if (key === "b") {
        backToBuild();
      }
    });

    window.addEventListener("resize", resizeCanvas);
    if (window.ResizeObserver) {
      new ResizeObserver(resizeCanvas).observe(dom.canvasWrap);
    }
    window.addEventListener("beforeunload", persistProjects);
  }

  /* ---------------- start ---------------- */
  function init() {
    try { state.muted = localStorage.getItem(MUTE_KEY) === "1"; } catch (error) {}
    audio.enabled = !state.muted;
    dom.soundBtn.classList.toggle("muted", state.muted);
    dom.soundBtn.setAttribute("aria-pressed", String(!state.muted));

    renderMaterials();
    renderMaterialTable();
    renderLevelTabs();
    bindEvents();
    switchLevel(0);
    resizeCanvas();
    requestAnimationFrame((now) => {
      state.lastNow = now;
      requestAnimationFrame(frame);
    });

    window.MOSTOWNIA = {
      state,
      addBeam,
      removeBeam,
      startTest,
      backToBuild,
      switchLevel,
      getMetrics,
      roadRouteInfo,
      validateConnection,
      resetTest,
      fastForward(seconds) {
        const steps = Math.max(1, Math.round(seconds / SOLVER_DT));
        for (let i = 0; i < steps; i++) {
          if (state.mode !== "testing") break;
          fixedStep(SOLVER_DT);
        }
        updateHUD(performance.now());
        return { mode: state.mode, test: state.test, broken: state.sim?.brokenCount };
      },
      setUnlocked(n) {
        state.progress.unlocked = Math.max(1, Math.min(LEVELS.length, n));
        saveProgress(state.progress);
        renderLevelTabs();
      }
    };
  }

  init();
})();
