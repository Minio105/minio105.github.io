/* =========================================================
   MOSTOWNIA — renderer Canvas 2D
   ========================================================= */
"use strict";

(function () {
  const TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function hexToRgb(hex) {
    const value = hex.replace("#", "");
    const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16)
    };
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
  }

  function mixColor(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return `rgb(${Math.round(lerp(ca.r, cb.r, t))}, ${Math.round(lerp(ca.g, cb.g, t))}, ${Math.round(lerp(ca.b, cb.b, t))})`;
  }

  function stressColor(base, ratio) {
    if (ratio <= 0.52) return base;
    if (ratio <= 0.82) return mixColor(base, "#ffad33", (ratio - 0.52) / 0.3);
    return mixColor("#ffad33", "#ff433f", (ratio - 0.82) / 0.18);
  }

  function hash(n) {
    const x = Math.sin(n * 128.321 + 17.17) * 43758.5453;
    return x - Math.floor(x);
  }

  function roundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawCloud(ctx, x, y, scale, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#f5fbf7";
    ctx.beginPath();
    ctx.ellipse(x, y + 3 * scale, 34 * scale, 11 * scale, 0, 0, TAU);
    ctx.ellipse(x - 22 * scale, y + 5 * scale, 22 * scale, 8 * scale, 0, 0, TAU);
    ctx.ellipse(x + 25 * scale, y + 5 * scale, 20 * scale, 7 * scale, 0, 0, TAU);
    ctx.ellipse(x - 5 * scale, y - 7 * scale, 18 * scale, 12 * scale, 0, 0, TAU);
    ctx.ellipse(x + 14 * scale, y - 3 * scale, 16 * scale, 10 * scale, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawTree(ctx, x, y, scale, tone) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = tone === "dark" ? "#4a3b2c" : "#584735";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -28);
    ctx.stroke();
    ctx.fillStyle = tone === "dark" ? "#314f39" : "#3f6142";
    const blobs = [
      [-10, -34, 14], [10, -36, 15], [0, -45, 17], [-3, -28, 12], [16, -26, 10], [-17, -25, 10]
    ];
    for (const [bx, by, br] of blobs) {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = tone === "dark" ? "rgba(121,153,94,.25)" : "rgba(144,178,107,.3)";
    ctx.beginPath();
    ctx.arc(-5, -48, 10, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBackground(ctx, state, now) {
    const level = state.level;
    const w = level.world.w;
    const h = level.world.h;
    const floor = level.world.floorY;
    const yL = level.yL;
    const yR = level.yR;
    const gapL = level.gapL;
    const gapR = level.gapR;

    const sky = ctx.createLinearGradient(0, 0, 0, 520);
    sky.addColorStop(0, "#65b1cf");
    sky.addColorStop(0.52, "#a9d7df");
    sky.addColorStop(1, "#e2eee6");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const sunX = 1085;
    const sunY = 92;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
    sunGlow.addColorStop(0, "rgba(255, 244, 193, .92)");
    sunGlow.addColorStop(0.14, "rgba(255, 236, 165, .38)");
    sunGlow.addColorStop(1, "rgba(255, 235, 170, 0)");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(sunX - 160, sunY - 160, 320, 320);
    ctx.fillStyle = "rgba(255, 248, 210, .86)";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 22, 0, TAU);
    ctx.fill();

    // Chmury — delikatnie dryfujące.
    drawCloud(ctx, 180 + Math.sin(now * 0.035) * 12, 104, 1.05, 0.72);
    drawCloud(ctx, 530 + Math.sin(now * 0.023 + 1.7) * 15, 66, 0.72, 0.52);
    drawCloud(ctx, 880 + Math.sin(now * 0.027 + 2.8) * 11, 152, 0.56, 0.45);
    drawCloud(ctx, 1260 + Math.sin(now * 0.018 + 3.2) * 9, 82, 0.8, 0.35);

    // Ptaki.
    ctx.strokeStyle = "rgba(37, 67, 73, .35)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const bx = 720 + i * 19 + Math.sin(now * 0.2 + i) * 8;
      const by = 165 + i * 8 + Math.sin(now * 0.8 + i) * 3;
      ctx.beginPath();
      ctx.arc(bx - 4, by, 4.5, Math.PI * 1.08, Math.PI * 1.75);
      ctx.arc(bx + 4, by, 4.5, Math.PI * 1.25, Math.PI * 1.92);
      ctx.stroke();
    }

    // Odległe pasma gór.
    ctx.fillStyle = "rgba(86, 130, 125, .48)";
    ctx.beginPath();
    ctx.moveTo(0, 420);
    ctx.lineTo(70, 346);
    ctx.lineTo(150, 392);
    ctx.lineTo(265, 300);
    ctx.lineTo(390, 386);
    ctx.lineTo(520, 324);
    ctx.lineTo(650, 400);
    ctx.lineTo(790, 330);
    ctx.lineTo(930, 392);
    ctx.lineTo(1060, 298);
    ctx.lineTo(1190, 375);
    ctx.lineTo(1400, 312);
    ctx.lineTo(1400, 560);
    ctx.lineTo(0, 560);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(54, 101, 96, .46)";
    ctx.beginPath();
    ctx.moveTo(0, 470);
    ctx.lineTo(120, 415);
    ctx.lineTo(270, 462);
    ctx.lineTo(410, 405);
    ctx.lineTo(560, 456);
    ctx.lineTo(690, 407);
    ctx.lineTo(850, 465);
    ctx.lineTo(1010, 408);
    ctx.lineTo(1160, 458);
    ctx.lineTo(1320, 416);
    ctx.lineTo(1400, 455);
    ctx.lineTo(1400, 580);
    ctx.lineTo(0, 580);
    ctx.closePath();
    ctx.fill();

    // Mgła w dolinie.
    const haze = ctx.createLinearGradient(0, 390, 0, 650);
    haze.addColorStop(0, "rgba(214, 237, 229, 0)");
    haze.addColorStop(0.62, "rgba(199, 224, 215, .35)");
    haze.addColorStop(1, "rgba(122, 160, 147, .24)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 385, w, 285);

    // Tylna ściana kanionu.
    const canyon = ctx.createLinearGradient(0, yL, 0, floor);
    canyon.addColorStop(0, "rgba(68, 91, 77, .34)");
    canyon.addColorStop(0.43, "rgba(49, 70, 62, .62)");
    canyon.addColorStop(1, "rgba(22, 42, 43, .92)");
    ctx.fillStyle = canyon;
    ctx.fillRect(gapL - 20, yL + 5, gapR - gapL + 40, floor - yL + 40);
    ctx.fillStyle = "rgba(235, 244, 235, .09)";
    for (let i = 0; i < 4; i++) {
      const yy = yL + 55 + i * 53;
      ctx.beginPath();
      ctx.moveTo(gapL + 15, yy);
      ctx.bezierCurveTo(gapL + 120, yy - 15, gapR - 110, yy + 18, gapR - 12, yy - 4);
      ctx.lineTo(gapR - 12, yy + 4);
      ctx.bezierCurveTo(gapR - 130, yy + 26, gapL + 100, yy - 5, gapL + 15, yy + 8);
      ctx.closePath();
      ctx.fill();
    }

    // Rzeka na dnie przepaści.
    const riverY = floor - 34;
    const river = ctx.createLinearGradient(0, riverY, 0, h);
    river.addColorStop(0, "#4f8f94");
    river.addColorStop(0.5, "#2d6771");
    river.addColorStop(1, "#214b59");
    ctx.fillStyle = river;
    ctx.fillRect(gapL - 80, riverY, gapR - gapL + 160, h - riverY + 5);
    ctx.strokeStyle = "rgba(211, 242, 232, .34)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const yy = riverY + 9 + i * 8;
      ctx.beginPath();
      ctx.moveTo(gapL + 30 + Math.sin(now * 0.45 + i) * 8, yy);
      for (let x = gapL + 30; x < gapR - 20; x += 28) {
        ctx.lineTo(x, yy + Math.sin(x * 0.12 + now * 1.1 + i) * 2.2);
      }
      ctx.stroke();
    }

    drawCliff(ctx, level, "left", now);
    drawCliff(ctx, level, "right", now);

    // Trawa i drzewa na brzegach.
    ctx.fillStyle = "#4c6f42";
    ctx.fillRect(0, yL + 10, gapL - 10, 5);
    ctx.fillRect(gapR + 10, yR + 10, w - gapR - 10, 5);
    drawTree(ctx, 62, yL + 8, 0.9, "dark");
    drawTree(ctx, 143, yL + 7, 0.72, "light");
    drawTree(ctx, gapR + 92, yR + 7, 0.95, "dark");
    drawTree(ctx, gapR + 168, yR + 8, 0.65, "light");

    drawRoads(ctx, level);

    // Docelowa flaga.
    drawFinish(ctx, level, now);

    if (state.mode === "build") {
      drawDimLine(ctx, state, level, now);
      drawGuides(ctx, state, now);
    }
  }

  function drawCliff(ctx, level, side, now) {
    const isLeft = side === "left";
    const xEdge = isLeft ? level.gapL : level.gapR;
    const y = isLeft ? level.yL : level.yR;
    const floor = level.world.floorY;
    const sign = isLeft ? -1 : 1;
    const far = isLeft ? -20 : level.world.w + 20;

    const pts = [
      [far, y - 8],
      [xEdge, y - 8],
      [xEdge + sign * -1, y + 54],
      [xEdge + sign * 7, y + 114],
      [xEdge + sign * -6, y + 174],
      [xEdge + sign * 5, y + 236],
      [xEdge + sign * -14, y + 312],
      [xEdge + sign * 32, floor + 9],
      [far, floor + 9]
    ];

    const path = new Path2D();
    path.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
    path.closePath();

    ctx.save();
    ctx.clip(path);
    const rock = ctx.createLinearGradient(0, y, 0, floor);
    rock.addColorStop(0, isLeft ? "#7d6748" : "#756044");
    rock.addColorStop(0.3, "#64513a");
    rock.addColorStop(0.68, "#493c2d");
    rock.addColorStop(1, "#302d28");
    ctx.fillStyle = rock;
    ctx.fillRect(Math.min(far, xEdge) - 10, y - 10, Math.abs(xEdge - far) + 40, floor - y + 25);

    // Warstwy skalne.
    for (let i = 0; i < 9; i++) {
      const yy = y + 28 + i * 31 + hash(i + (isLeft ? 2 : 9)) * 15;
      ctx.strokeStyle = i % 3 === 0 ? "rgba(37, 30, 22, .25)" : "rgba(213, 190, 148, .1)";
      ctx.lineWidth = 1.2 + hash(i) * 1.2;
      ctx.beginPath();
      const start = isLeft ? xEdge - 300 : xEdge + 120;
      const end = isLeft ? xEdge + 26 : xEdge - 26;
      ctx.moveTo(start, yy);
      ctx.bezierCurveTo(
        lerp(start, end, 0.35), yy - 7,
        lerp(start, end, 0.7), yy + 7,
        end, yy + (hash(i + 5) - 0.5) * 10
      );
      ctx.stroke();
    }

    // Pęknięcia i pionowe smugi.
    for (let i = 0; i < 5; i++) {
      const baseX = xEdge + sign * (8 + hash(i + 31) * 32);
      const baseY = y + 40 + hash(i + 42) * 250;
      ctx.strokeStyle = "rgba(31, 26, 21, .28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(baseX + sign * (4 + hash(i + 3) * 16), baseY + 23 + hash(i + 7) * 30);
      ctx.lineTo(baseX + sign * (2 + hash(i + 12) * 11), baseY + 46 + hash(i + 2) * 36);
      ctx.stroke();
    }
    ctx.restore();

    // Krawędź urwiska.
    const edge = new Path2D();
    edge.moveTo(xEdge, y - 8);
    edge.lineTo(xEdge + sign * -1, y + 54);
    edge.lineTo(xEdge + sign * 7, y + 114);
    edge.lineTo(xEdge + sign * -6, y + 174);
    edge.lineTo(xEdge + sign * 5, y + 236);
    edge.lineTo(xEdge + sign * -14, y + 312);
    edge.lineTo(xEdge + sign * 32, floor + 9);
    ctx.strokeStyle = "rgba(32, 27, 21, .48)";
    ctx.lineWidth = 2.2;
    ctx.stroke(edge);

    // Warstwa ziemi / trawy tuż pod jezdnią.
    ctx.fillStyle = "#5b7246";
    ctx.beginPath();
    ctx.moveTo(far, y + 9);
    ctx.lineTo(xEdge, y + 9);
    ctx.lineTo(xEdge + sign * 4, y + 16);
    ctx.lineTo(xEdge + sign * -4, y + 22);
    ctx.lineTo(far, y + 20);
    ctx.closePath();
    ctx.fill();
  }

  function drawRoads(ctx, level) {
    const drawRoadStrip = (x1, x2, y) => {
      ctx.fillStyle = "#333c42";
      ctx.fillRect(x1, y, x2 - x1, 13);
      ctx.fillStyle = "#6d787e";
      ctx.fillRect(x1, y, x2 - x1, 2);
      ctx.strokeStyle = "rgba(239, 238, 223, .54)";
      ctx.lineWidth = 1.3;
      ctx.setLineDash([12, 14]);
      ctx.beginPath();
      ctx.moveTo(x1, y + 10);
      ctx.lineTo(x2, y + 10);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    drawRoadStrip(-4, level.gapL, level.yL);
    drawRoadStrip(level.gapR, level.world.w + 4, level.yR);

    // Przyczółki.
    const block = (x, y, dir) => {
      ctx.fillStyle = "#68665c";
      ctx.fillRect(dir < 0 ? x - 34 : x + 3, y + 12, 33, 31);
      ctx.fillStyle = "#4f4f49";
      ctx.fillRect(dir < 0 ? x - 34 : x + 3, y + 36, 33, 8);
      ctx.strokeStyle = "rgba(255,255,255,.15)";
      ctx.lineWidth = 1;
      ctx.strokeRect(dir < 0 ? x - 31 : x + 5, y + 16, 27, 14);
    };
    block(level.gapL, level.yL, -1);
    block(level.gapR, level.yR, 1);

    // Znacznik startu.
    ctx.strokeStyle = "rgba(255, 235, 195, .65)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(level.startX - 34, level.yL + 1);
    ctx.lineTo(level.startX - 34, level.yL + 12);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawFinish(ctx, level, now) {
    const x = level.finishX;
    const y = level.yR;
    ctx.save();
    ctx.strokeStyle = "#2d3539";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 51);
    ctx.stroke();
    const wave = Math.sin(now * 2.1) * 2.2;
    ctx.translate(x + 1, y - 50);
    ctx.rotate(-0.04 + wave * 0.006);
    ctx.fillStyle = "#f0f1e9";
    ctx.fillRect(0, 0, 31, 19);
    ctx.fillStyle = "#242c30";
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        if ((row + col) % 2 === 0) ctx.fillRect(col * 6.2, row * 6.3, 6.2, 6.3);
      }
    }
    ctx.strokeStyle = "rgba(22, 30, 33, .4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 31, 19);
    ctx.restore();
    ctx.save();
    ctx.font = "700 9px 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(232, 245, 245, .65)";
    ctx.textAlign = "center";
    ctx.fillText("META", x + 15, y - 58);
    ctx.restore();
  }

  function drawDimLine(ctx, state, level, now) {
    const y = level.world.floorY - 82;
    const x1 = level.gapL;
    const x2 = level.gapR;
    const s = state.screen.scale;
    const inv = 1 / s;

    ctx.save();
    ctx.strokeStyle = "rgba(234, 246, 244, .34)";
    ctx.fillStyle = "rgba(234, 246, 244, .6)";
    ctx.lineWidth = 1 * inv;
    ctx.setLineDash([5 * inv, 6 * inv]);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y - 6 * inv);
    ctx.lineTo(x1, y + 6 * inv);
    ctx.moveTo(x2, y - 6 * inv);
    ctx.lineTo(x2, y + 6 * inv);
    ctx.stroke();
    // Groty.
    ctx.beginPath();
    ctx.moveTo(x1 + 7 * inv, y - 4 * inv);
    ctx.lineTo(x1, y);
    ctx.lineTo(x1 + 7 * inv, y + 4 * inv);
    ctx.moveTo(x2 - 7 * inv, y - 4 * inv);
    ctx.lineTo(x2, y);
    ctx.lineTo(x2 - 7 * inv, y + 4 * inv);
    ctx.stroke();

    const label = `ROZPIĘTOŚĆ  ${level.spanMeters.toFixed(1)} m`;
    ctx.font = `600 ${10 * inv}px "Segoe UI", sans-serif`;
    const width = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(10, 23, 27, .54)";
    roundedRect(ctx, (x1 + x2) / 2 - width / 2 - 8 * inv, y - 18 * inv, width + 16 * inv, 14 * inv, 4 * inv);
    ctx.fill();
    ctx.fillStyle = "rgba(231, 246, 244, .72)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, (x1 + x2) / 2, y - 11 * inv);
    ctx.restore();
  }

  function beamPairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

  function drawGuides(ctx, state, now) {
    const level = state.level;
    const s = state.screen.scale;
    const inv = 1 / s;
    const roadPairs = new Set();
    for (const beam of state.designBeams) {
      if (beam.material === "road") roadPairs.add(beamPairKey(beam.a, beam.b));
    }
    const hintActive = state.hintUntil > performance.now();
    const pulse = hintActive ? 0.38 + Math.sin(now * 6) * 0.18 : 0.19;
    ctx.save();
    ctx.lineWidth = (hintActive ? 2.0 : 1.2) * inv;
    ctx.strokeStyle = hintActive ? `rgba(255, 197, 95, ${pulse + 0.2})` : `rgba(255, 213, 143, ${pulse})`;
    ctx.setLineDash([4 * inv, 7 * inv]);
    ctx.lineDashOffset = hintActive ? -now * 20 : 0;
    for (const guide of level.roadGuides) {
      if (roadPairs.has(beamPairKey(guide[0], guide[1]))) continue;
      const a = level.nodeById[guide[0]];
      const b = level.nodeById[guide[1]];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    if (!hintActive) return;
    // Szkielet podpowiedzi — kratownica z pierwszym rzędem węzłów.
    ctx.save();
    ctx.strokeStyle = "rgba(135, 228, 205, .38)";
    ctx.lineWidth = 1.5 * inv;
    ctx.setLineDash([3 * inv, 5 * inv]);
    for (let i = 1; i < level.deckNodeIds.length - 1; i++) {
      const top = level.nodeById[level.deckNodeIds[i]];
      const lower = level.nodeById[`s0_${i}`];
      if (!top || !lower) continue;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(lower.x, lower.y);
      ctx.stroke();
      const neighbors = [level.deckNodeIds[i - 1], level.deckNodeIds[i + 1]];
      for (const nid of neighbors) {
        const neighbor = level.nodeById[nid];
        if (!neighbor) continue;
        ctx.beginPath();
        ctx.moveTo(lower.x, lower.y);
        ctx.lineTo(neighbor.x, neighbor.y);
        ctx.stroke();
      }
      if (i < level.deckNodeIds.length - 2) {
        const nextLower = level.nodeById[`s0_${i + 1}`];
        if (nextLower) {
          ctx.beginPath();
          ctx.moveTo(lower.x, lower.y);
          ctx.lineTo(nextLower.x, nextLower.y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawDesignBeams(ctx, state) {
    const sorted = [...state.designBeams].sort((a, b) => {
      const order = { cable: 0, wood: 1, steel: 2, road: 3 };
      return (order[a.material] || 0) - (order[b.material] || 0);
    });
    for (const beam of sorted) {
      const a = state.level.nodeById[beam.a];
      const b = state.level.nodeById[beam.b];
      if (!a || !b) continue;
      drawBeam(ctx, state, a.x, a.y, b.x, b.y, MATERIALS[beam.material], 0, false);
    }
  }

  function drawPhysicsBeams(ctx, state) {
    const sim = state.sim;
    if (!sim) return;
    const sorted = [...sim.beams].filter((b) => !b.broken).sort((a, b) => {
      const order = { cable: 0, wood: 1, steel: 2, road: 3 };
      return (order[a.material.id] || 0) - (order[b.material.id] || 0);
    });
    for (const beam of sorted) {
      drawBeam(
        ctx, state,
        beam.a.x, beam.a.y, beam.b.x, beam.b.y,
        beam.material,
        beam.renderStress,
        true,
        beam
      );
    }
  }

  function drawBeam(ctx, state, x1, y1, x2, y2, material, stress, physical, physicsBeam) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;
    const ux = dx / len;
    const uy = dy / len;
    const s = state.screen.scale;
    const color = stressColor(material.color, stress);
    const dark = material.colorDark;
    const light = material.colorLight;
    const stressed = stress > 0.55;

    ctx.save();
    if (stressed) {
      ctx.shadowColor = stress > 0.84 ? "rgba(255, 62, 54, .8)" : "rgba(255, 165, 54, .55)";
      ctx.shadowBlur = 6 + stress * 8;
    }

    if (material.id === "road") {
      const thick = 9.4;
      const nx = -uy;
      const ny = ux;
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 + nx * thick, y2 + ny * thick);
      ctx.lineTo(x1 + nx * thick, y1 + ny * thick);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = stress > 0.52 ? color : "rgba(223, 221, 200, .36)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 9]);
      ctx.beginPath();
      ctx.moveTo(x1 + nx * thick * 0.55, y1 + ny * thick * 0.55);
      ctx.lineTo(x2 + nx * thick * 0.55, y2 + ny * thick * 0.55);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255,255,255,.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1 + nx * thick, y1 + ny * thick);
      ctx.lineTo(x2 + nx * thick, y2 + ny * thick);
      ctx.stroke();
    } else if (material.id === "cable") {
      let slack = 0;
      if (physical && physicsBeam && physicsBeam.length < physicsBeam.rest) {
        slack = Math.min(22, (physicsBeam.rest - physicsBeam.length) * 1.1);
      }
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2 + slack;
      ctx.strokeStyle = "rgba(14, 24, 29, .72)";
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY + 3, x2, y2);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(222, 236, 240, .45)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.stroke();
    } else {
      const thick = material.id === "steel" ? 6.4 : 5.4;
      ctx.strokeStyle = dark;
      ctx.lineWidth = thick + 2.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = thick;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = stress > 0.35 ? "rgba(255, 238, 195, .34)" : rgba(light, 0.42);
      ctx.lineWidth = material.id === "steel" ? 1.1 : 1.3;
      ctx.beginPath();
      ctx.moveTo(x1 - uy * 1.2, y1 + ux * 1.2);
      ctx.lineTo(x2 - uy * 1.2, y2 + ux * 1.2);
      ctx.stroke();

      if (material.id === "steel") {
        const count = Math.max(2, Math.floor(len / 26));
        ctx.fillStyle = "rgba(214, 231, 239, .5)";
        for (let i = 1; i < count; i++) {
          const t = i / count;
          ctx.beginPath();
          ctx.arc(lerp(x1, x2, t), lerp(y1, y2, t), 1.15, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = "rgba(91, 54, 24, .26)";
        ctx.lineWidth = 0.7;
        const count = Math.max(2, Math.floor(len / 17));
        for (let i = 1; i < count; i++) {
          const t = i / count;
          const gx = lerp(x1, x2, t);
          const gy = lerp(y1, y2, t);
          ctx.beginPath();
          ctx.moveTo(gx - uy * 2, gy + ux * 2);
          ctx.lineTo(gx + uy * 2, gy - ux * 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    if (stress > 0.9 && physical) {
      const blink = 0.35 + Math.sin(performance.now() * 0.02) * 0.25;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.strokeStyle = "#fff3b8";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBuildNodes(ctx, state, now) {
    const s = state.screen.scale;
    const inv = 1 / s;
    const pending = state.pendingStart;
    for (const node of state.level.nodes) {
      const isPending = node.id === pending;
      const isHover = node.id === state.hoverNodeId;
      const isConnected = state.designBeams.some((b) => b.a === node.id || b.b === node.id);
      const pulse = isPending ? 0.55 + Math.sin(now * 7) * 0.18 : 0;
      const baseR = node.fixed ? 6.2 : node.deck ? 5.6 : 4.8;
      const r = (baseR + (isHover ? 1.8 : 0) + (isPending ? 1.5 : 0)) * inv;

      ctx.save();
      if (isPending || isHover) {
        ctx.fillStyle = isPending ? `rgba(255, 195, 88, ${pulse})` : "rgba(255, 195, 88, .18)";
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 7 * inv, 0, TAU);
        ctx.fill();
      }
      if (node.fixed) {
        ctx.shadowColor = "rgba(93, 221, 185, .55)";
        ctx.shadowBlur = 7;
        ctx.fillStyle = isHover ? "#c9ffed" : "#62d7b4";
        ctx.strokeStyle = "rgba(11, 42, 34, .8)";
        ctx.lineWidth = 1.2 * inv;
        ctx.beginPath();
        const rr = r * 0.9;
        ctx.moveTo(node.x, node.y - rr);
        ctx.lineTo(node.x + rr, node.y);
        ctx.lineTo(node.x, node.y + rr);
        ctx.lineTo(node.x - rr, node.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(9, 31, 27, .85)";
        ctx.beginPath();
        ctx.arc(node.x, node.y, 1.9 * inv, 0, TAU);
        ctx.fill();
      } else if (node.deck) {
        ctx.shadowColor = isConnected ? "rgba(255, 193, 82, .55)" : "rgba(255, 190, 80, .25)";
        ctx.shadowBlur = isConnected ? 6 : 3;
        ctx.fillStyle = "#142229";
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = isHover || isPending ? "#ffe0a1" : "#e8ae4f";
        ctx.lineWidth = 1.7 * inv;
        ctx.stroke();
        ctx.fillStyle = isHover || isPending ? "#fff2c8" : "#f5c773";
        ctx.beginPath();
        ctx.arc(node.x, node.y, Math.max(0.9, r * 0.34), 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = "#14242b";
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = isHover ? "#f2fbff" : "rgba(200, 226, 236, .82)";
        ctx.lineWidth = 1.4 * inv;
        ctx.stroke();
        ctx.fillStyle = "rgba(193, 220, 231, .9)";
        ctx.beginPath();
        ctx.arc(node.x, node.y, Math.max(0.8, r * 0.3), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // Zaznaczony element — końce i lekka aureola.
    if (state.selectedId) {
      const beam = state.designBeams.find((b) => b.id === state.selectedId);
      if (beam) {
        const a = state.level.nodeById[beam.a];
        const b = state.level.nodeById[beam.b];
        ctx.save();
        ctx.strokeStyle = "rgba(255, 198, 94, .6)";
        ctx.lineWidth = 1.6 * inv;
        ctx.setLineDash([4 * inv, 4 * inv]);
        for (const p of [a, b]) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8 * inv, 0, TAU);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  function drawPhysicsNodes(ctx, state, now) {
    const sim = state.sim;
    if (!sim) return;
    const s = state.screen.scale;
    const inv = 1 / s;
    for (const node of sim.nodes) {
      const r = (node.fixed ? 2.5 : 2.1) * inv;
      ctx.fillStyle = node.fixed ? "#8af1d2" : "rgba(230, 242, 246, .75)";
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, TAU);
      ctx.fill();
      if (node.fixed) {
        ctx.strokeStyle = "rgba(82, 224, 184, .3)";
        ctx.lineWidth = 1 * inv;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 3 * inv, 0, TAU);
        ctx.stroke();
      }
    }
  }

  function previewInfo(state) {
    if (state.mode !== "build" || !state.pendingStart) return null;
    const start = state.level.nodeById[state.pendingStart];
    if (!start || !state.pointer.inside) return null;
    const target = state.hoverNodeId ? state.level.nodeById[state.hoverNodeId] : null;
    const x2 = target && target.id !== start.id ? target.x : state.pointer.wx;
    const y2 = target && target.id !== start.id ? target.y : state.pointer.wy;
    const length = Math.hypot(x2 - start.x, y2 - start.y);
    const material = MATERIALS[state.material];
    let valid = false;
    if (target && target.id !== start.id) {
      valid = window.MOSTOWNIA
        ? window.MOSTOWNIA.validateConnection(start.id, target.id, state.material).ok
        : true;
    }
    return { start, target, x2, y2, length: length / PX_PER_M, valid, material };
  }

  function drawPreview(ctx, state, now) {
    const preview = previewInfo(state);
    if (!preview) return;
    const s = state.screen.scale;
    const inv = 1 / s;
    const color = preview.target && !preview.valid ? "#ff5c58" : preview.material.colorLight;
    const dashes = [7 * inv, 6 * inv];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6 * inv;
    ctx.setLineDash(dashes);
    ctx.lineDashOffset = -now * 18;
    ctx.beginPath();
    ctx.moveTo(preview.start.x, preview.start.y);
    ctx.lineTo(preview.x2, preview.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(preview.x2, preview.y2, (preview.target ? 7 : 4) * inv, 0, TAU);
    ctx.fill();
    if (preview.target) {
      ctx.strokeStyle = preview.valid ? "rgba(255, 206, 112, .9)" : "rgba(255, 92, 88, .95)";
      ctx.lineWidth = 2 * inv;
      ctx.beginPath();
      ctx.arc(preview.target.x, preview.target.y, 11 * inv, 0, TAU);
      ctx.stroke();
    }
    // Etykieta długości przy podglądzie.
    const label = `${preview.length.toFixed(1)} m`;
    ctx.font = `700 ${10 * inv}px "Segoe UI", sans-serif`;
    const width = ctx.measureText(label).width + 12 * inv;
    const mx = lerp(preview.start.x, preview.x2, 0.55);
    const my = lerp(preview.start.y, preview.y2, 0.55);
    ctx.fillStyle = "rgba(9, 20, 25, .8)";
    roundedRect(ctx, mx - width / 2, my - 20 * inv, width, 14 * inv, 4 * inv);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, mx, my - 13 * inv);
    ctx.restore();
  }

  function drawWheel(ctx, x, y, radius, rotation, dark) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = "#161d20";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#425057";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(160, 174, 178, .38)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * radius * 0.4, Math.sin(a) * radius * 0.4);
      ctx.lineTo(Math.cos(a) * radius * 0.9, Math.sin(a) * radius * 0.9);
      ctx.stroke();
    }
    ctx.fillStyle = "#89979c";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.24, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawCarShape(ctx, vehicle) {
    const L = vehicle.length;
    const H = vehicle.height;
    const cargo = vehicle.cargo;
    const front = L / 2;
    const back = -L / 2;

    if (cargo) {
      // Ciężarówka: kontener + kabina.
      const cabStart = L * 0.1;
      ctx.fillStyle = vehicle.colorDark;
      roundedRect(ctx, back, -H * 0.82, L * 0.6, H * 0.75, 2.5);
      ctx.fill();
      ctx.fillStyle = "#d7d4c5";
      roundedRect(ctx, back + 2, -H * 0.94, L * 0.6 - 3, H * 0.82, 2);
      ctx.fill();
      ctx.fillStyle = "rgba(72, 82, 85, .15)";
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(back + 6 + i * 9, -H * 0.9, 1.4, H * 0.72);
      }
      ctx.fillStyle = vehicle.color;
      roundedRect(ctx, cabStart, -H * 0.88, front - cabStart, H * 0.78, 3);
      ctx.fill();
      ctx.fillStyle = "#b9d6dd";
      roundedRect(ctx, cabStart + 3, -H * 0.78, 11, H * 0.32, 2);
      ctx.fill();
      ctx.fillStyle = vehicle.colorDark;
      ctx.fillRect(back + 1, -H * 0.2, L - 4, 3);
      ctx.fillRect(cabStart - 1, -H * 0.88, 2, H * 0.72);
      // Zderzak i światła.
      ctx.fillStyle = "#e8d98a";
      ctx.fillRect(front - 3, -H * 0.38, 2.5, 3);
      ctx.fillStyle = "#ff5b4f";
      ctx.fillRect(back, -H * 0.38, 2.2, 2.6);
      ctx.fillStyle = vehicle.colorDark;
      ctx.fillRect(front - 4, -4, 4, 2);
    } else {
      ctx.fillStyle = vehicle.colorDark;
      ctx.beginPath();
      ctx.moveTo(back + 1, -3);
      ctx.lineTo(back + 3, -H * 0.5);
      ctx.lineTo(back + L * 0.22, -H * 0.7);
      ctx.lineTo(back + L * 0.36, -H * 0.99);
      ctx.lineTo(back + L * 0.7, -H * 0.99);
      ctx.lineTo(front - 2, -H * 0.55);
      ctx.lineTo(front, -H * 0.32);
      ctx.lineTo(front, -3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = vehicle.color;
      ctx.beginPath();
      ctx.moveTo(back + 3, -4);
      ctx.lineTo(back + 5, -H * 0.45);
      ctx.lineTo(back + L * 0.24, -H * 0.64);
      ctx.lineTo(back + L * 0.38, -H * 0.89);
      ctx.lineTo(back + L * 0.68, -H * 0.89);
      ctx.lineTo(front - 5, -H * 0.48);
      ctx.lineTo(front - 2, -H * 0.27);
      ctx.lineTo(front - 2, -4);
      ctx.closePath();
      ctx.fill();
      // Szyby.
      ctx.fillStyle = "#9cc9d4";
      ctx.beginPath();
      ctx.moveTo(back + L * 0.27, -H * 0.58);
      ctx.lineTo(back + L * 0.4, -H * 0.82);
      ctx.lineTo(back + L * 0.52, -H * 0.82);
      ctx.lineTo(back + L * 0.52, -H * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(back + L * 0.56, -H * 0.58);
      ctx.lineTo(back + L * 0.56, -H * 0.82);
      ctx.lineTo(back + L * 0.67, -H * 0.82);
      ctx.lineTo(front - 5, -H * 0.45);
      ctx.lineTo(front - 5, -H * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.33)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(back + 4, -H * 0.48);
      ctx.lineTo(front - 5, -H * 0.43);
      ctx.stroke();
      ctx.fillStyle = "#ffe69a";
      ctx.beginPath();
      ctx.arc(front - 5, -H * 0.3, 1.6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ff6654";
      ctx.fillRect(back + 1, -H * 0.32, 2, 2.2);
    }
  }

  function drawVehicle(ctx, state, car, vehicle, options = {}) {
    const x = car.x;
    const y = car.y;
    const angle = car.angle || 0;
    const wheelSpin = car.wheelSpin || 0;
    const radius = vehicle.wheelRadius;
    const half = vehicle.wheelbase / 2;
    const grounded = options.preview || car.contactCount > 0;

    // Cień pod pojazdem.
    if (grounded || options.preview) {
      ctx.save();
      ctx.translate(x, y + radius + 2);
      ctx.rotate(angle);
      ctx.fillStyle = "rgba(17, 27, 28, .24)";
      ctx.beginPath();
      ctx.ellipse(0, 0, vehicle.length * 0.48, 4.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    drawWheel(ctx, -half, 0, radius, wheelSpin, true);
    drawWheel(ctx, half, 0, radius, wheelSpin, true);
    ctx.save();
    ctx.translate(0, -1);
    drawCarShape(ctx, vehicle);
    ctx.restore();
    // Odblask nadwozia.
    ctx.strokeStyle = "rgba(255,255,255,.22)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-vehicle.length * 0.3, -vehicle.height * 0.46);
    ctx.lineTo(vehicle.length * 0.22, -vehicle.height * 0.46);
    ctx.stroke();
    ctx.restore();
  }

  function drawCarsAndPreview(ctx, state, now) {
    if (state.mode !== "build" && state.car) {
      drawVehicle(ctx, state, state.car, VEHICLES[state.vehicleId]);
    } else if (state.mode === "build") {
      const vehicle = VEHICLES[state.vehicleId];
      if (!vehicle) return;
      const preview = {
        x: state.level.startX,
        y: state.level.yL - vehicle.wheelRadius,
        angle: 0,
        wheelSpin: 0,
        contactCount: 1
      };
      drawVehicle(ctx, state, preview, vehicle, { preview: true });
      // Delikatny podpis nad pojazdem.
      const s = state.screen.scale;
      const inv = 1 / s;
      ctx.save();
      ctx.font = `600 ${8 * inv}px "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(11, 24, 29, .5)";
      const label = "POJAZD TESTOWY";
      const width = ctx.measureText(label).width + 9 * inv;
      roundedRect(ctx, preview.x - width / 2, preview.y - vehicle.height - 22 * inv, width, 11 * inv, 3 * inv);
      ctx.fill();
      ctx.fillStyle = "rgba(236, 247, 246, .72)";
      ctx.textBaseline = "middle";
      ctx.fillText(label, preview.x, preview.y - vehicle.height - 16.5 * inv);
      ctx.restore();
    }
  }

  function drawFragments(ctx, state) {
    if (!state.sim) return;
    for (const f of state.sim.fragments) {
      const alpha = clamp(f.life / f.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = Math.min(1, alpha * 1.8);
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.strokeStyle = f.material.colorDark;
      ctx.lineWidth = 6.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-f.length / 2, 0);
      ctx.lineTo(f.length / 2, 0);
      ctx.stroke();
      ctx.strokeStyle = f.material.color;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(-f.length / 2, 0);
      ctx.lineTo(f.length / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawParticles(ctx, state) {
    for (const p of state.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.shape === "spark") {
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillRect(-p.size * 1.8, -p.size * 0.32, p.size * 3.4, p.size * 0.64);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawTestOverlayEffects(ctx, state) {
    if (!state.sim || state.mode === "build") return;
    if (state.sim.brokenCount > 0) {
      const s = state.screen.scale;
      const inv = 1 / s;
      ctx.save();
      ctx.font = `700 ${9 * inv}px "Segoe UI", sans-serif`;
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255, 100, 90, .85)";
      ctx.fillText(`USZKODZONE ELEMENTY: ${state.sim.brokenCount}`, state.level.gapL + 8, state.level.yL - 64);
      ctx.restore();
    }
    if (state.sim.getLiveMaxStress() > 0.85) {
      const s = state.screen.scale;
      const inv = 1 / s;
      ctx.save();
      ctx.globalAlpha = 0.65 + Math.sin(performance.now() * 0.012) * 0.25;
      ctx.strokeStyle = "rgba(255, 80, 67, .55)";
      ctx.lineWidth = 5 * inv;
      ctx.strokeRect(state.level.gapL - 3, state.level.yL - 75, state.level.gapR - state.level.gapL + 6, state.level.yR - state.level.yL + 150);
      ctx.restore();
    }
  }

  function draw(ctx, state, now) {
    if (!state.level || !state.screen) return;
    const s = state.screen;
    const screenW = s.w;
    const screenH = s.h;

    ctx.save();
    const letterbox = ctx.createLinearGradient(0, 0, 0, screenH);
    letterbox.addColorStop(0, "#101b21");
    letterbox.addColorStop(1, "#080e12");
    ctx.fillStyle = letterbox;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();

    const shake = state.shake || 0;
    const shakeX = shake ? (Math.random() - 0.5) * shake : 0;
    const shakeY = shake ? (Math.random() - 0.5) * shake * 0.7 : 0;

    ctx.save();
    ctx.translate(s.ox + shakeX, s.oy + shakeY);
    ctx.scale(s.scale, s.scale);
    ctx.beginPath();
    ctx.rect(0, 0, state.level.world.w, state.level.world.h);
    ctx.clip();

    drawBackground(ctx, state, now);

    if (state.mode === "build") {
      drawDesignBeams(ctx, state);
    } else {
      drawPhysicsBeams(ctx, state);
    }

    drawCarsAndPreview(ctx, state, now);
    drawFragments(ctx, state);
    drawParticles(ctx, state);

    if (state.mode === "build") {
      drawBuildNodes(ctx, state, now);
      drawPreview(ctx, state, now);
    } else {
      drawPhysicsNodes(ctx, state, now);
      drawTestOverlayEffects(ctx, state);
    }

    ctx.restore();

    // Winieta i delikatna mgła na krawędziach planszy.
    ctx.save();
    const vignette = ctx.createRadialGradient(
      screenW * 0.5, screenH * 0.45, Math.min(screenW, screenH) * 0.15,
      screenW * 0.5, screenH * 0.5, Math.max(screenW, screenH) * 0.72
    );
    vignette.addColorStop(0, "rgba(4, 12, 14, 0)");
    vignette.addColorStop(0.75, "rgba(4, 12, 14, .04)");
    vignette.addColorStop(1, "rgba(4, 12, 14, .28)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();
  }

  window.MostowniaRenderer = { draw };
})();
