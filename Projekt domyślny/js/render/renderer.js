/* ==========================================================================
   renderer.js — rysowanie mapy: prowincje, granice, armie, etykiety, tryby mapy.
   Rysowanie jest przyrostowe: pełne przerysowanie następuje tylko wtedy, gdy
   stan gry się zmienił lub gdy zmieniła się kamera (flaga "dirty").
   ========================================================================== */
window.Renderer = (function () {
  'use strict';

  const MODES = [
    { id: 'political', name: 'Polityczna' },
    { id: 'diplomacy', name: 'Dyplomatyczna' },
    { id: 'army', name: 'Armia' },
    { id: 'economy', name: 'Gospodarka' },
    { id: 'population', name: 'Ludność' }
  ];

  const RAMP_ARMY = ['#12263a', '#2a6f97', '#8ecae6', '#ffd166', '#e63946'];
  const RAMP_ECON = ['#1b263b', '#3d5a80', '#7fb685', '#e0e08a', '#fff3b0'];
  const RAMP_POP = ['#1a1a2e', '#3c096c', '#7b2cbf', '#c77dff', '#f2e9ff'];
  const RAMP_TROUBLE = ['#1b263b', '#5c4033', '#a0522d', '#d9a066', '#f5e6c8'];

  function Renderer(canvas, world, state, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.state = state;
    this.camera = camera;
    this.dpr = window.devicePixelRatio || 1;
    this.mode = 'political';
    this.hoverPid = -1;
    this.selectedPid = -1;
    this.moveTargets = null;     // Set<int> zielone
    this.attackTargets = null;   // Set<int> czerwone
    this.fast = false;           // tryb szybki (podczas przeciągania)
    this.showLabels = true;
    this.showArmies = true;
    this.paths = null;
    this.maxTroopsCache = 0;
    this.dirty = true;
  }

  Renderer.prototype.resize = function () {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.camera.setViewport(w, h);
    this.dirty = true;
  };

  /* Jednorazowe przygotowanie ścieżek (Path2D) dla wszystkich prowincji. */
  Renderer.prototype.prepare = function () {
    const provinces = this.world.provinces;
    this.paths = new Array(provinces.length);
    for (let i = 0; i < provinces.length; i++) {
      this.paths[i] = buildPath(provinces[i]);
    }
  };

  function buildPath(pv) {
    const path = new Path2D();
    const contours = pv.contours;
    if (contours && contours.length) {
      for (let c = 0; c < contours.length; c++) {
        const flat = contours[c];
        path.moveTo(flat[0], flat[1]);
        for (let i = 2; i < flat.length; i += 2) path.lineTo(flat[i], flat[i + 1]);
        path.closePath();
      }
      return path;
    }
    // zapasowo: pojedyncze komórki
    const cols = this.world.GEO ? this.world.GEO.cols : 720;
    const cells = pv.cells || [];
    for (let i = 0; i < cells.length; i++) {
      const k = cells[i], c = k % cols, r = (k - c) / cols;
      path.rect(c, r, 1, 1);
    }
    return path;
  }

  Renderer.prototype.provinceColor = function (i) {
    const st = this.state;
    const pv = st.provinces[i];
    const owner = pv.country;
    const c = owner >= 0 ? st.countries[owner] : null;
    switch (this.mode) {
      case 'political':
        return c ? c.color : '#5a5f66';
      case 'diplomacy': {
        if (!c) return '#5a5f66';
        if (c.isPlayer) return '#2f7fe0';
        if (st.countries[st.playerId] && owner >= 0) {
          const rel = GameState.relation(st, st.playerId, owner);
          if (rel === GameState.REL.WAR) return '#c0392b';
          if (rel === GameState.REL.ALLY) return '#27ae60';
          if (Logic.truceActive(st, st.playerId, owner)) return '#b7950b';
        }
        return '#6b7280';
      }
      case 'army': {
        const t = pv.troops <= 0 ? 0 : Math.min(1, Math.log(pv.troops + 1) / Math.log(220));
        return Util.scaleColor(t, RAMP_ARMY);
      }
      case 'economy':
        return Util.scaleColor(Util.clamp(pv.econ / 100, 0, 1), RAMP_ECON);
      case 'population': {
        const t = Math.min(1, Math.log(pv.pop + 1000) / Math.log(6e8));
        return Util.scaleColor(t, RAMP_POP);
      }
      default:
        return c ? c.color : '#5a5f66';
    }
  };

  Renderer.prototype.render = function (opts) {
    opts = opts || {};
    const ctx = this.ctx, cam = this.camera, world = this.world, st = this.state;
    const dpr = this.dpr;
    const W = cam.viewW, H = cam.viewH;
    const fast = this.fast;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ocean
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0b1e33');
    grad.addColorStop(1, '#061423');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const view = cam.viewRect();
    const visible = [];
    const provinces = world.provinces;
    for (let i = 0; i < provinces.length; i++) {
      const bb = provinces[i].bbox;
      if (bb[2] < view.x0 || bb[0] > view.x1 || bb[3] < view.y0 || bb[1] > view.y1) continue;
      visible.push(i);
    }

    // siatka geograficzna
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const GEO = world.GEO;
    const gstep = 20;
    for (let lon = -180; lon <= 180; lon += gstep) {
      const x = (lon - GEO.lonMin) / GEO.cell;
      const p = cam.worldToScreen(x, 0);
      ctx.beginPath(); ctx.moveTo(p[0], 0); ctx.lineTo(p[0], H); ctx.stroke();
    }
    for (let lat = GEO.latMax - 10; lat > GEO.latMin; lat -= gstep) {
      const y = (GEO.latMax - lat) / GEO.cell;
      const p = cam.worldToScreen(0, y);
      ctx.beginPath(); ctx.moveTo(0, p[1]); ctx.lineTo(W, p[1]); ctx.stroke();
    }
    ctx.restore();

    if (!this.paths) this.prepare();

    // --- wypełnienie prowincji ---
    const s = dpr * cam.scale;
    ctx.setTransform(s, 0, 0, s, dpr * cam.x, dpr * cam.y);
    for (let v = 0; v < visible.length; v++) {
      const i = visible[v];
      ctx.fillStyle = this.provinceColor(i);
      ctx.fill(this.paths[i]);
    }

    // --- granice prowincji (cienkie) ---
    if (cam.scale > 2.2) {
      ctx.lineWidth = 0.55 / cam.scale;
      ctx.strokeStyle = 'rgba(10,14,20,0.35)';
      for (let v = 0; v < visible.length; v++) ctx.stroke(this.paths[visible[v]]);
    }

    // --- granice państw i linie brzegowe (grubsze) ---
    const coast = new Path2D(), border = new Path2D(), war = new Path2D();
    const playerId = st.playerId;
    for (let v = 0; v < visible.length; v++) {
      const i = visible[v];
      const segs = provinces[i].borderSegs;
      if (!segs) continue;
      const myOwner = st.provinces[i].country;
      for (let k = 0; k < segs.length; k += 5) {
        const nb = segs[k + 4];
        if (nb === i) continue;
        let target;
        if (nb < 0) target = coast;
        else {
          const nbOwner = st.provinces[nb].country;
          if (nbOwner === myOwner) continue;
          const hostile = (myOwner === playerId || nbOwner === playerId) &&
            Logic.atWar(st, myOwner, nbOwner);
          target = hostile ? war : border;
        }
        target.moveTo(segs[k], segs[k + 1]);
        target.lineTo(segs[k + 2], segs[k + 3]);
      }
    }
    ctx.lineWidth = 1.5 / cam.scale;
    ctx.strokeStyle = 'rgba(4,10,18,0.95)';
    ctx.stroke(coast);
    ctx.lineWidth = 1.15 / cam.scale;
    ctx.strokeStyle = 'rgba(12,16,24,0.75)';
    ctx.stroke(border);
    ctx.lineWidth = 1.7 / cam.scale;
    ctx.strokeStyle = 'rgba(220,60,50,0.85)';
    ctx.stroke(war);

    // podświetlenie własnego państwa
    if (playerId >= 0 && st.countries[playerId] && st.countries[playerId].alive) {
      const own = new Path2D();
      let any = false;
      for (let v = 0; v < visible.length; v++) {
        const i = visible[v];
        if (st.provinces[i].country !== playerId) continue;
        own.addPath(this.paths[i]);
        any = true;
      }
      if (any) {
        ctx.save();
        ctx.setLineDash([3 / cam.scale, 2 / cam.scale]);
        ctx.lineWidth = 1.2 / cam.scale;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.stroke(own);
        ctx.restore();
      }
    }

    // --- tryb szybki: bez etykiet i armii ---
    if (!fast) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.drawArmies(ctx, visible, view);
      this.drawCities(ctx, view);
      if (this.showLabels) this.drawLabels(ctx, visible, view);
      this.drawOverlays(ctx, visible);
    } else {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.drawOverlays(ctx, visible);
    }
    this.dirty = false;
  };

  /* Wskaźniki armii (liczba żołnierzy) */
  Renderer.prototype.drawArmies = function (ctx, visible, view) {
    if (!this.showArmies) return;
    const cam = this.camera, st = this.state;
    const scale = cam.scale;
    if (scale < 1.4) return;
    const list = [];
    for (let v = 0; v < visible.length; v++) {
      const i = visible[v];
      const pv = st.provinces[i];
      if (pv.troops <= 0) continue;
      list.push(i);
    }
    if (list.length > 700) {
      // zbyt wiele — pokazujemy tylko większe armie
      const filtered = list.filter(function (i) { return st.provinces[i].troops >= 8; });
      list.length = 0;
      Array.prototype.push.apply(list, filtered);
    }
    const maxShow = 900;
    const step = list.length > maxShow ? Math.ceil(list.length / maxShow) : 1;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = 0; k < list.length; k += step) {
      const i = list[k];
      const pv = st.provinces[i];
      const c = cam.worldToScreen(this.world.provinces[i].centroid[0], this.world.provinces[i].centroid[1]);
      if (c[0] < -40 || c[1] < -40 || c[0] > cam.viewW + 40 || c[1] > cam.viewH + 40) continue;
      const isPlayer = pv.country === st.playerId;
      const r = Util.clamp(6 + Math.log(pv.troops + 1) * 1.6, 8, 20);
      ctx.beginPath();
      ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
      ctx.fillStyle = isPlayer ? (pv.moved ? 'rgba(40,70,120,0.75)' : 'rgba(30,110,220,0.88)') : 'rgba(20,24,32,0.78)';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = isPlayer ? 'rgba(190,225,255,0.95)' : 'rgba(230,230,230,0.5)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold ' + Math.round(r * 0.95) + 'px Segoe UI, Arial, sans-serif';
      ctx.fillText(pv.troops > 999 ? Math.round(pv.troops / 1000) + 'k' : String(pv.troops), c[0], c[1] + (r > 11 ? 0.5 : 0.5));
    }
    ctx.restore();
  };

  Renderer.prototype.drawCities = function (ctx, view) {
    const cam = this.camera;
    if (cam.scale < 3.2) return;
    const cities = this.world.mapCities || [];
    const st = this.state;
    ctx.save();
    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];
      if (!city.cap && city.pop < 1500000) continue;
      const x = (city.lon - this.world.GEO.lonMin) / this.world.GEO.cell;
      const y = (this.world.GEO.latMax - city.lat) / this.world.GEO.cell;
      if (x < view.x0 - 2 || x > view.x1 + 2 || y < view.y0 - 2 || y > view.y1 + 2) continue;
      const c = cam.worldToScreen(x, y);
      ctx.beginPath();
      if (city.cap) {
        ctx.arc(c[0], c[1], 2.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fill();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.stroke();
      } else {
        ctx.arc(c[0], c[1], 1.7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(240,240,240,0.7)';
        ctx.fill();
      }
    }
    ctx.restore();
  };

  Renderer.prototype.drawLabels = function (ctx, visible, view) {
    const cam = this.camera, st = this.state, world = this.world;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    // nazwy państw — pokazujemy gdy nie jesteśmy bardzo zbliżeni
    if (cam.scale < 7) {
      const counts = {};
      for (let v = 0; v < visible.length; v++) {
        const i = visible[v];
        const cid = st.provinces[i].country;
        if (cid < 0) continue;
        (counts[cid] = counts[cid] || []).push(i);
      }
      const ids = Object.keys(counts).map(Number);
      for (let k = 0; k < ids.length; k++) {
        const cid = ids[k];
        const c = st.countries[cid];
        if (!c || !c.alive) continue;
        const list = counts[cid];
        let sx = 0, sy = 0, sw = 0;
        for (let i = 0; i < list.length; i++) {
          const g = world.provinces[list[i]].centroid;
          sx += g[0]; sy += g[1]; sw++;
        }
        const pos = cam.worldToScreen(sx / sw, sy / sw);
        if (pos[0] < 20 || pos[1] < 20 || pos[0] > cam.viewW - 20 || pos[1] > cam.viewH - 20) continue;
        const size = Util.clamp(11 + Math.sqrt(sw) * 1.4, 11, 20);
        ctx.font = 'bold ' + size + 'px Segoe UI, Arial, sans-serif';
        ctx.lineWidth = 3.4;
        ctx.strokeStyle = 'rgba(0,0,0,0.72)';
        ctx.strokeText(c.name, pos[0], pos[1]);
        ctx.fillStyle = c.isPlayer ? '#fff4b8' : 'rgba(255,255,255,0.92)';
        ctx.fillText(c.name, pos[0], pos[1]);
      }
    }

    // nazwy prowincji przy większym zbliżeniu
    if (cam.scale >= 4.2) {
      let drawn = 0;
      ctx.font = '600 11px Segoe UI, Arial, sans-serif';
      for (let v = 0; v < visible.length && drawn < 420; v++) {
        const i = visible[v];
        const wp = world.provinces[i];
        const sizeX = (wp.bbox[2] - wp.bbox[0]) * cam.scale;
        const sizeY = (wp.bbox[3] - wp.bbox[1]) * cam.scale;
        if (sizeX < 42 || sizeY < 18) continue;
        const pos = cam.worldToScreen(wp.centroid[0], wp.centroid[1]);
        if (pos[0] < 0 || pos[1] < 0 || pos[0] > cam.viewW || pos[1] > cam.viewH) continue;
        const name = wp.name;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.strokeText(name, pos[0], pos[1]);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(name, pos[0], pos[1]);
        drawn++;
      }
    }
    ctx.restore();
  };

  /* Zaznaczenie, cele ruchu, cele ataku, podgląd bitwy */
  Renderer.prototype.drawOverlays = function (ctx, visible) {
    const cam = this.camera, st = this.state;
    const outline = function (pid, color, width, dash) {
      const path = this.paths[pid];
      if (!path) return;
      ctx.save();
      if (dash) ctx.setLineDash(dash);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke(path);
      ctx.restore();
    }.bind(this);

    if (this.moveTargets) {
      this.moveTargets.forEach(function (pid) { outline(pid, 'rgba(70,220,130,0.95)', 2.4, [5, 3]); });
    }
    if (this.attackTargets) {
      this.attackTargets.forEach(function (pid) { outline(pid, 'rgba(255,90,70,0.95)', 2.4, [5, 3]); });
    }
    if (this.hoverPid >= 0 && this.hoverPid !== this.selectedPid) {
      outline(this.hoverPid, 'rgba(255,255,255,0.8)', 2);
    }
    if (this.selectedPid >= 0) {
      outline(this.selectedPid, 'rgba(255,235,120,1)', 3);
      const wp = this.world.provinces[this.selectedPid];
      const p = cam.worldToScreen(wp.centroid[0], wp.centroid[1]);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,235,120,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  };

  /* Trafienie w prowincję na podstawie pozycji kursora (w px CSS). */
  Renderer.prototype.provinceAt = function (sx, sy) {
    const w = this.camera.screenToWorld(sx, sy);
    const GEO = this.world.GEO;
    const c = Math.floor(w[0]), r = Math.floor(w[1]);
    if (c < 0 || r < 0 || c >= GEO.cols || r >= GEO.rows) return -1;
    return this.world.provinceOf[r * GEO.cols + c];
  };

  /* Współrzędne ekranowe prowincji (do dymków). */
  Renderer.prototype.screenPosOfProvince = function (pid) {
    const g = this.world.provinces[pid].centroid;
    return this.camera.worldToScreen(g[0], g[1]);
  };

  Renderer.MODES = MODES;
  return Renderer;
})();
