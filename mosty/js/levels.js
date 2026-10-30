/* =========================================================
   MOSTOWNIA — dane materiałów, pojazdów i poziomów
   Skala świata: 20 px = 1 m
   ========================================================= */
"use strict";

const PX_PER_M = 20;
const GRAVITY = 9.81 * PX_PER_M; // px/s²

const MATERIALS = {
  road: {
    id: "road",
    key: "1",
    name: "Droga",
    subtitle: "jezdnia na belkach",
    cost: 58,
    density: 42,
    EA: 1_600_000,
    maxTension: 120_000,
    maxCompression: 100_000,
    color: "#4b5661",
    colorDark: "#252f38",
    colorLight: "#9aa5ad",
    accent: "#d9b16f",
    strengthClass: "medium",
    description: "Ciężka jezdnia. Tylko ona pozwala samochodowi przejechać."
  },
  wood: {
    id: "wood",
    key: "2",
    name: "Drewno",
    subtitle: "tanie, lekkie, elastyczne",
    cost: 26,
    density: 17,
    EA: 650_000,
    maxTension: 28_000,
    maxCompression: 25_000,
    color: "#b97c3e",
    colorDark: "#7c4b22",
    colorLight: "#e0ad68",
    accent: "#f1c078",
    strengthClass: "low",
    description: "Dobra belka kratownicowa. Nie lubi dużych sił ściskających."
  },
  steel: {
    id: "steel",
    key: "3",
    name: "Stal",
    subtitle: "mocna, ciężka, droga",
    cost: 72,
    density: 52,
    EA: 3_200_000,
    maxTension: 140_000,
    maxCompression: 120_000,
    color: "#698ba3",
    colorDark: "#3e5668",
    colorLight: "#aec9da",
    accent: "#a8d3ee",
    strengthClass: "high",
    description: "Największa nośność. Duża masa obciąża jednak całą konstrukcję."
  },
  cable: {
    id: "cable",
    key: "4",
    name: "Lina",
    subtitle: "tylko rozciąganie",
    cost: 18,
    density: 5,
    EA: 900_000,
    maxTension: 80_000,
    maxCompression: 0,
    color: "#3d4b55",
    colorDark: "#232d34",
    colorLight: "#84949e",
    accent: "#9ab0bc",
    strengthClass: "tension",
    description: "Lekka i tania. Przenosi wyłącznie rozciąganie — nigdy nie podpiera."
  }
};

const MATERIAL_ORDER = ["road", "wood", "steel", "cable"];

const VEHICLES = {
  hatch: {
    id: "hatch",
    name: "Hatchback",
    subtitle: "lekki samochód miejski",
    mass: 920,
    speed: 112,
    wheelbase: 44,
    length: 72,
    height: 27,
    wheelRadius: 10,
    color: "#e2654f",
    colorDark: "#a33e30",
    colorLight: "#ff9b86",
    cargo: false
  },
  sedan: {
    id: "sedan",
    name: "Sedan",
    subtitle: "cięższy samochód osobowy",
    mass: 1540,
    speed: 101,
    wheelbase: 53,
    length: 86,
    height: 30,
    wheelRadius: 11,
    color: "#e9e2d3",
    colorDark: "#a59e90",
    colorLight: "#fff9e9",
    cargo: false
  },
  truck: {
    id: "truck",
    name: "Ciężarówka",
    subtitle: "dostawy o masie 4,2 t",
    mass: 4200,
    speed: 82,
    wheelbase: 69,
    length: 108,
    height: 37,
    wheelRadius: 12,
    color: "#d8aa45",
    colorDark: "#8e6920",
    colorLight: "#ffda7b",
    cargo: true
  },
  heavy: {
    id: "heavy",
    name: "Ciężki testowy",
    subtitle: "pojazd próbny 7,8 t",
    mass: 7800,
    speed: 66,
    wheelbase: 84,
    length: 126,
    height: 42,
    wheelRadius: 13,
    color: "#7d8992",
    colorDark: "#46515a",
    colorLight: "#b5c0c8",
    cargo: true
  }
};

const LEVEL_CONFIGS = [
  {
    id: 1,
    name: "Zielona Dolina",
    difficulty: "ŁATWY",
    gapL: 360,
    gapR: 780,
    yL: 332,
    yR: 332,
    budget: 6200,
    supportRows: 2,
    rowGap: 82,
    deckSpacing: 84,
    maxBeam: 190,
    vehicles: ["hatch", "sedan"],
    recommended: "hatch",
    mission: "Połącz brzegi lekką przeprawą. Użyj drogi oraz drewnianej lub stalowej kratownicy, a potem bezpiecznie przeprowadź samochód."
  },
  {
    id: 2,
    name: "Wąwóz Sokoła",
    difficulty: "ŚREDNI",
    gapL: 300,
    gapR: 880,
    yL: 326,
    yR: 326,
    budget: 6900,
    supportRows: 2,
    rowGap: 82,
    deckSpacing: 86,
    maxBeam: 192,
    vehicles: ["hatch", "sedan", "truck"],
    recommended: "sedan",
    mission: "Szeroka przepaść i napięty budżet. Każdy metr ma znaczenie — zaplanuj kratownicę zanim położysz pierwszy odcinek drogi."
  },
  {
    id: 3,
    name: "Przełęcz Grań",
    difficulty: "TRUDNY",
    gapL: 260,
    gapR: 1000,
    yL: 318,
    yR: 292,
    budget: 11500,
    supportRows: 2,
    rowGap: 84,
    deckSpacing: 88,
    maxBeam: 198,
    vehicles: ["sedan", "truck"],
    recommended: "truck",
    mission: "Brzegi leżą na różnych wysokościach, a przez dolinę musi przejechać ciężarówka. Ukośne podpory przeniosą siłę na skały."
  },
  {
    id: 4,
    name: "Przepaść Milowa",
    difficulty: "EKSPERT",
    gapL: 180,
    gapR: 1160,
    yL: 338,
    yR: 338,
    budget: 14500,
    supportRows: 2,
    rowGap: 86,
    deckSpacing: 88,
    maxBeam: 202,
    vehicles: ["truck", "heavy"],
    recommended: "truck",
    mission: "Blisko kilometr przepaści w skali projektu. Ograniczony budżet nie pozwala na czystą stal — mieszaj materiały i rozkładaj siły."
  },
  {
    id: 5,
    name: "Kanion Ostatni",
    difficulty: "MISTRZ",
    gapL: 140,
    gapR: 1220,
    yL: 318,
    yR: 286,
    budget: 20000,
    supportRows: 3,
    rowGap: 82,
    deckSpacing: 90,
    maxBeam: 280,
    vehicles: ["heavy"],
    recommended: "heavy",
    mission: "Finałowa próba: 7,8-tonowy pojazd i najdłuższa rozpiętość. Zbuduj głęboką kratownicę na najniższym rzędzie punktów, wzmocnij końce stalą i prowadź liny w obu kierunkach."
  }
];

function buildLevel(config) {
  const world = { w: 1400, h: 760, floorY: 704 };
  const nodes = [];
  const nodeById = {};
  const deckNodeIds = [];

  function addNode(id, x, y, kind, fixed) {
    const node = {
      id,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      kind,
      fixed: Boolean(fixed),
      deck: kind === "deck" || kind === "anchor"
    };
    nodes.push(node);
    nodeById[id] = node;
    return node;
  }

  // Brzegi. Punkty zakotwiczenia są nieruchome.
  addNode("L", config.gapL, config.yL, "anchor", true);
  addNode("R", config.gapR, config.yR, "anchor", true);
  deckNodeIds.push("L");

  const gap = config.gapR - config.gapL;
  const segments = Math.max(3, Math.ceil(gap / config.deckSpacing));
  const interiorDeck = [];

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const id = `d${i}`;
    const x = config.gapL + gap * t;
    const y = config.yL + (config.yR - config.yL) * t;
    addNode(id, x, y, "deck", false);
    interiorDeck.push(id);
    deckNodeIds.push(id);
  }
  deckNodeIds.push("R");

  // Wolne punkty konstrukcyjne pod pomostem.
  for (let row = 0; row < config.supportRows; row++) {
    const dy = (row + 1) * config.rowGap;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const x = config.gapL + gap * t;
      const y = config.yL + (config.yR - config.yL) * t + dy;
      addNode(`s${row}_${i}`, x, y, "support", false);
    }
  }

  // Stałe punkty w skale — naturalne podpory dla ukośnych belek.
  for (let row = 0; row < Math.min(2, config.supportRows + 1); row++) {
    const dy = (row + 1) * config.rowGap;
    addNode(`bL${row}`, config.gapL - 52, config.yL + dy, "bank", true);
    addNode(`bR${row}`, config.gapR + 52, config.yR + dy, "bank", true);
  }

  const roadGuides = [];
  for (let i = 0; i < deckNodeIds.length - 1; i++) {
    roadGuides.push([deckNodeIds[i], deckNodeIds[i + 1]]);
  }

  const vehicleList = config.vehicles;
  const startX = Math.max(56, config.gapL - 190);
  const finishX = Math.min(world.w - 42, config.gapR + 160);

  return {
    ...config,
    world,
    nodes,
    nodeById,
    deckNodeIds,
    interiorDeck,
    roadGuides,
    vehicleList,
    startX,
    finishX,
    spanMeters: gap / PX_PER_M,
    shoreSegments: [
      { x1: 0, y1: config.yL, x2: config.gapL, y2: config.yL, shore: true },
      { x1: config.gapR, y1: config.yR, x2: world.w, y2: config.yR, shore: true }
    ],
    recommendedVehicle: config.recommended
  };
}

const LEVELS = LEVEL_CONFIGS.map(buildLevel);

function formatMoney(value) {
  return `${Math.round(value).toLocaleString("pl-PL")} zł`;
}

function formatMass(kg) {
  if (kg >= 1000) return `${(kg / 1000).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} t`;
  return `${Math.round(kg)} kg`;
}

function getProgress() {
  try {
    const raw = localStorage.getItem("mostownia_progress_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        unlocked: Math.max(1, Math.min(LEVELS.length, Number(parsed.unlocked) || 1)),
        stars: parsed.stars && typeof parsed.stars === "object" ? parsed.stars : {}
      };
    }
  } catch (error) {
    // localStorage może być zablokowany — gra nadal działa.
  }
  return { unlocked: 1, stars: {} };
}

function saveProgress(progress) {
  try {
    localStorage.setItem("mostownia_progress_v1", JSON.stringify(progress));
  } catch (error) {
    // Brak zapisu nie blokuje rozgrywki.
  }
}
