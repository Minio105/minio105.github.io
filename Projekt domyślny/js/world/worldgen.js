/* ==========================================================================
   worldgen.js — buduje świat gry z danych Natural Earth:
     1. lista krajów,
     2. rasteryzacja lądów do siatki 0.5° x 0.5°,
     3. podział każdego kraju na spójne prowincje (BFS + najdalsze punkty),
     4. nazwy prowincji od najbliższych miast,
     5. geometria (kontury -> Path2D + odcinki granic) i sąsiedztwa.
   Wszystko deterministyczne — ten sam świat po każdym wczytaniu gry.
   ========================================================================== */
window.WorldGen = (function () {
  'use strict';

  const GEO = {
    cell: 0.5,
    lonMin: -180, lonMax: 180,
    latMax: 84, latMin: -58
  };
  GEO.cols = Math.round((GEO.lonMax - GEO.lonMin) / GEO.cell); // 720
  GEO.rows = Math.round((GEO.latMax - GEO.latMin) / GEO.cell); // 284

  const TARGET_CELLS_PER_PROVINCE = 13;
  const MAX_PROVINCES_PER_COUNTRY = 220;
  const MIN_PROVINCE_CELLS = 4;

  function cellLon(c) { return GEO.lonMin + (c + 0.5) * GEO.cell; }
  function cellLat(r) { return GEO.latMax - (r + 0.5) * GEO.cell; }
  function lonToCol(lon) { return Math.floor((lon - GEO.lonMin) / GEO.cell); }
  function latToRow(lat) { return Math.floor((GEO.latMax - lat) / GEO.cell); }

  /* ---------------------------------------------------------------- kraje -- */
  function buildCountries() {
    const feats = (window.WORLD_GEOJSON && window.WORLD_GEOJSON.features) || [];
    const out = [];
    for (let i = 0; i < feats.length; i++) {
      const f = feats[i];
      const p = f.properties || {};
      const geom = f.geometry;
      if (!geom || !geom.coordinates) continue;
      const iso = p.ADM0_A3 || p.ISO_A3 || p.SU_A3 || '';
      const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
      if (!polys || !polys.length) continue;
      out.push({
        id: out.length,
        iso: iso,
        name: p.NAME_PL || p.NAME || p.ADMIN || 'Państwo',
        nameEn: p.NAME || p.ADMIN || 'Country',
        continent: p.CONTINENT || '',
        subregion: p.SUBREGION || '',
        pop: Math.max(0, Math.round(p.POP_EST || 0)),
        gdp: Math.max(0, Math.round(p.GDP_MD || 0)),
        mc: [p.MAPCOLOR7 | 0, p.MAPCOLOR8 | 0, p.MAPCOLOR9 | 0],
        unclaimed: iso === 'ATA' || /Antarctic/i.test(p.ADMIN || ''),
        polys: polys,
        cellCount: 0
      });
    }
    // Najludniejsze kraje pierwsze — dzięki temu przy nakładających się
    // poligonach wygrywa ważniejszy kraj, a identyfikatory są stabilne.
    out.sort(function (a, b) { return b.pop - a.pop || (a.name < b.name ? -1 : 1); });
    out.forEach(function (c, i) { c.id = i; });
    return out;
  }

  /* --------------------------------------------------------- rasteryzacja -- */
  function rasterize(countries) {
    const cols = GEO.cols, rows = GEO.rows, cell = GEO.cell;
    const grid = new Int32Array(cols * rows).fill(-1);
    const rowCross = new Array(rows);
    for (let r = 0; r < rows; r++) rowCross[r] = [];
    const touchedFlag = new Uint8Array(rows);
    const touched = [];
    const cmp = function (a, b) { return a - b; };
    let crossings = 0, skippedWrap = 0;

    for (let ci = 0; ci < countries.length; ci++) {
      const country = countries[ci];
      touched.length = 0;
      const polys = country.polys;
      for (let pi = 0; pi < polys.length; pi++) {
        const poly = polys[pi];
        for (let ri = 0; ri < poly.length; ri++) {
          const ring = poly[ri];
          const n = ring.length;
          if (n < 3) continue;
          for (let i = 0; i < n; i++) {
            const a = ring[i], b = ring[(i + 1) % n];
            const lon1 = a[0], lat1 = a[1], lon2 = b[0], lat2 = b[1];
            if (Math.abs(lon2 - lon1) > 180) { skippedWrap++; continue; } // krawędź przez antymeridian
            if (lat1 === lat2) continue;
            if (lat1 > GEO.latMax && lat2 > GEO.latMax) continue;
            if (lat1 < GEO.latMin && lat2 < GEO.latMin) continue;
            let y1 = (GEO.latMax - lat1) / cell, y2 = (GEO.latMax - lat2) / cell;
            const ys = Math.min(y1, y2), ye = Math.max(y1, y2);
            const xLow = y1 < y2 ? lon1 : lon2, xHigh = y1 < y2 ? lon2 : lon1;
            let r0 = Math.ceil(ys - 0.5), r1 = Math.ceil(ye - 0.5) - 1;
            if (r0 < 0) r0 = 0;
            if (r1 > rows - 1) r1 = rows - 1;
            if (r1 < r0) continue;
            const dxdy = (xHigh - xLow) / (ye - ys);
            for (let r = r0; r <= r1; r++) {
              const lon = xLow + (r + 0.5 - ys) * dxdy;
              const xc = (lon - GEO.lonMin) / cell - 0.5;
              if (xc < -1 || xc > cols) continue;
              rowCross[r].push(xc);
              if (!touchedFlag[r]) { touchedFlag[r] = 1; touched.push(r); }
              crossings++;
            }
          }
        }
      }
      // wypełnienie wierszy (parzysta-nieparzysta reguła)
      for (let t = 0; t < touched.length; t++) {
        const r = touched[t];
        const xs = rowCross[r];
        xs.sort(cmp);
        const base = r * cols;
        for (let k = 0; k + 1 < xs.length; k += 2) {
          let c0 = Math.ceil(xs[k] - 0.5), c1 = Math.ceil(xs[k + 1] - 0.5) - 1;
          if (c1 < 0 || c0 > cols - 1) continue;
          if (c0 < 0) c0 = 0;
          if (c1 > cols - 1) c1 = cols - 1;
          for (let c = c0; c <= c1; c++) grid[base + c] = country.id;
        }
        xs.length = 0;
        touchedFlag[r] = 0;
      }
    }
    // liczba komórek na kraj
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (v >= 0) countries[v].cellCount++;
    }
    return { grid: grid, crossings: crossings, skippedWrap: skippedWrap };
  }

  /* ------------------------------------------------------------ prowincje -- */
  function buildProvinces(grid, countries) {
    const cols = GEO.cols, rows = GEO.rows;
    const n = cols * rows;
    const provinceOf = new Int32Array(n).fill(-1);
    const visited = new Uint8Array(n);
    const stack = new Int32Array(n);
    const provinces = [];

    for (let i = 0; i < n; i++) {
      const cid = grid[i];
      if (cid < 0 || visited[i]) continue;
      // spójny obszar lądowy danego kraju
      let sp = 0;
      stack[sp++] = i;
      visited[i] = 1;
      const cells = [];
      while (sp > 0) {
        const cur = stack[--sp];
        cells.push(cur);
        const c = cur % cols, r = (cur - c) / cols;
        if (c > 0) { const k = cur - 1; if (!visited[k] && grid[k] === cid) { visited[k] = 1; stack[sp++] = k; } }
        if (c < cols - 1) { const k = cur + 1; if (!visited[k] && grid[k] === cid) { visited[k] = 1; stack[sp++] = k; } }
        if (r > 0) { const k = cur - cols; if (!visited[k] && grid[k] === cid) { visited[k] = 1; stack[sp++] = k; } }
        if (r < rows - 1) { const k = cur + cols; if (!visited[k] && grid[k] === cid) { visited[k] = 1; stack[sp++] = k; } }
      }
      splitComponent(cells, cid);
    }

    function splitComponent(cells, cid) {
      const count = cells.length;
      let K = Math.round(count / TARGET_CELLS_PER_PROVINCE);
      if (count < 10) K = 1;
      K = Util.clamp(K, 1, MAX_PROVINCES_PER_COUNTRY);
      K = Math.min(K, Math.max(1, Math.floor(count / 3)));

      let cx = 0, cy = 0;
      for (let i = 0; i < count; i++) {
        const k = cells[i], c = k % cols, r = (k - c) / cols;
        cx += c + 0.5; cy += r + 0.5;
      }
      cx /= count; cy /= count;

      const seeds = [];
      if (K <= 1) {
        // najbliżej środka ciężkości
        let best = cells[0], bestD = Infinity;
        for (let i = 0; i < count; i++) {
          const k = cells[i], c = k % cols, r = (k - c) / cols;
          const d = (c + 0.5 - cx) * (c + 0.5 - cx) + (r + 0.5 - cy) * (r + 0.5 - cy);
          if (d < bestD) { bestD = d; best = k; }
        }
        seeds.push(best);
      } else {
        let best = cells[0], bestD = Infinity;
        for (let i = 0; i < count; i++) {
          const k = cells[i], c = k % cols, r = (k - c) / cols;
          const d = (c + 0.5 - cx) * (c + 0.5 - cx) + (r + 0.5 - cy) * (r + 0.5 - cy);
          if (d < bestD) { bestD = d; best = k; }
        }
        seeds.push(best);
        const dist = new Float64Array(count).fill(Infinity);
        for (let it = 1; it < K; it++) {
          const last = seeds[seeds.length - 1];
          const lc = last % cols, lr = (last - lc) / cols;
          let bi = -1, bd = -1;
          for (let i = 0; i < count; i++) {
            const k = cells[i], c = k % cols, r = (k - c) / cols;
            const d = (c - lc) * (c - lc) + (r - lr) * (r - lr);
            if (d < dist[i]) dist[i] = d;
            if (dist[i] > bd) { bd = dist[i]; bi = i; }
          }
          if (bi < 0 || bd <= 0) break;
          seeds.push(cells[bi]);
        }
      }

      // BFS z wielu źródeł — prowincje są spójne
      const pid0 = provinces.length;
      for (let s = 0; s < seeds.length; s++) {
        const pid = pid0 + s;
        provinces.push({
          id: pid, country: cid, cells: [], cellCount: 0,
          pop: 0, econ: 0, areaKm2: 0,
          centroid: [0, 0], centroidLonLat: [0, 0], bbox: [0, 0, 0, 0]
        });
        provinceOf[seeds[s]] = pid;
      }
      const q = new Int32Array(count);
      let qh = 0, qt = 0;
      for (let s = 0; s < seeds.length; s++) q[qt++] = seeds[s];
      while (qh < qt) {
        const cur = q[qh++];
        const c = cur % cols, r = (cur - c) / cols;
        const pid = provinceOf[cur];
        if (c > 0) { const k = cur - 1; if (grid[k] === cid && provinceOf[k] < 0) { provinceOf[k] = pid; q[qt++] = k; } }
        if (c < cols - 1) { const k = cur + 1; if (grid[k] === cid && provinceOf[k] < 0) { provinceOf[k] = pid; q[qt++] = k; } }
        if (r > 0) { const k = cur - cols; if (grid[k] === cid && provinceOf[k] < 0) { provinceOf[k] = pid; q[qt++] = k; } }
        if (r < rows - 1) { const k = cur + cols; if (grid[k] === cid && provinceOf[k] < 0) { provinceOf[k] = pid; q[qt++] = k; } }
      }
    }

    /* scalanie zbyt małych prowincji z sąsiadem o najdłuższej granicy */
    const sizes = new Int32Array(provinces.length);
    for (let i = 0; i < n; i++) { const p = provinceOf[i]; if (p >= 0) sizes[p]++; }
    const tiny = [];
    for (let p = 0; p < provinces.length; p++) {
      if (sizes[p] > 0 && sizes[p] < MIN_PROVINCE_CELLS) tiny.push(p);
    }
    if (tiny.length) {
      const cellLists = new Map();
      for (let p = 0; p < provinces.length; p++) cellLists.set(p, []);
      for (let i = 0; i < n; i++) { const p = provinceOf[i]; if (p >= 0) cellLists.get(p).push(i); }
      for (let ti = 0; ti < tiny.length; ti++) {
        const pid = tiny[ti];
        if (provinceOf[cellLists.get(pid)[0]] !== pid) continue; // już scalona
        const list = cellLists.get(pid);
        const tally = new Map();
        for (let li = 0; li < list.length; li++) {
          const k = list[li], c = k % cols, r = (k - c) / cols;
          const nb = [c > 0 ? k - 1 : -1, c < cols - 1 ? k + 1 : -1, r > 0 ? k - cols : -1, r < rows - 1 ? k + cols : -1];
          for (let d = 0; d < 4; d++) {
            const nk = nb[d];
            if (nk < 0) continue;
            const np = provinceOf[nk];
            if (np < 0 || np === pid) continue;
            tally.set(np, (tally.get(np) || 0) + 1);
          }
        }
        let target = -1, bestScore = -1;
        tally.forEach(function (score, np) {
          if (score > bestScore) { bestScore = score; target = np; }
        });
        if (target < 0) continue;
        for (let li = 0; li < list.length; li++) provinceOf[list[li]] = target;
        const tl = cellLists.get(target);
        for (let li = 0; li < list.length; li++) tl.push(list[li]);
        sizes[target] += list.length;
        sizes[pid] = 0;
        cellLists.set(pid, []);
      }
    }

    /* finalna numeracja prowincji (zwarta) + komórki */
    const remap = new Int32Array(provinces.length).fill(-1);
    let finalProvinces = [];
    for (let i = 0; i < n; i++) {
      const p = provinceOf[i];
      if (p < 0) continue;
      let np = remap[p];
      if (np < 0) {
        np = finalProvinces.length;
        remap[p] = np;
        const src = provinces[p];
        src.id = np;
        src.cells = [];
        finalProvinces.push(src);
      }
      provinceOf[i] = np;
      finalProvinces[np].cells.push(i);
    }
    // usuń puste
    const compact = finalProvinces.filter(function (p) { return p.cells.length > 0; });
    if (compact.length !== finalProvinces.length) {
      const remap2 = new Int32Array(finalProvinces.length).fill(-1);
      compact.forEach(function (p, i) { remap2[p.id] = i; p.id = i; });
      for (let i = 0; i < n; i++) if (provinceOf[i] >= 0) provinceOf[i] = remap2[provinceOf[i]];
      finalProvinces = compact;
    }
    return { provinceOf: provinceOf, provinces: finalProvinces };
  }

  /* ------------------------------------------------- statystyki prowincji -- */
  function computeProvinceStats(provinces) {
    for (let i = 0; i < provinces.length; i++) {
      const p = provinces[i];
      p.cellCount = p.cells.length;
      let sx = 0, sy = 0, slon = 0, slat = 0, w = 0, area = 0, coastal = false;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let ci = 0; ci < p.cells.length; ci++) {
        const k = p.cells[ci], c = k % GEO.cols, r = (k - c) / GEO.cols;
        const lat = cellLat(r);
        const cellArea = 111.32 * GEO.cell * Math.cos(lat * Math.PI / 180) * 110.57 * GEO.cell;
        const wt = Math.cos(lat * Math.PI / 180);
        sx += (c + 0.5) * wt; sy += (r + 0.5) * wt;
        slon += cellLon(c) * wt; slat += lat * wt;
        w += wt; area += cellArea;
        if (c < x0) x0 = c; if (c + 1 > x1) x1 = c + 1;
        if (r < y0) y0 = r; if (r + 1 > y1) y1 = r + 1;
      }
      p.centroid = [sx / w, sy / w];
      p.centroidLonLat = [slon / w, slat / w];
      p.bbox = [x0, y0, x1, y1];
      p.areaKm2 = area;
      p.popWeight = w;
    }
  }

  /* Uwaga: sprawdzenie "coastal" wymaga dostępu do siatki — robimy to osobno. */
  function markCoastal(provinces, grid) {
    const cols = GEO.cols, rows = GEO.rows;
    for (let i = 0; i < provinces.length; i++) {
      const p = provinces[i];
      let coastal = false;
      for (let ci = 0; ci < p.cells.length && !coastal; ci++) {
        const k = p.cells[ci], c = k % cols, r = (k - c) / cols;
        if (c === 0 || r === 0 || c === cols - 1 || r === rows - 1) coastal = true;
        else if (grid[k - 1] < 0 || grid[k + 1] < 0 || grid[k - cols] < 0 || grid[k + cols] < 0) coastal = true;
      }
      p.coastal = coastal;
    }
  }

  /* -------------------------------------------------------- sąsiedztwa ---- */
  function buildAdjacency(provinces, provinceOf) {
    const cols = GEO.cols, rows = GEO.rows;
    const sets = new Array(provinces.length);
    for (let i = 0; i < provinces.length; i++) sets[i] = new Set();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c, a = provinceOf[k];
        if (a < 0) continue;
        if (c < cols - 1) { const b = provinceOf[k + 1]; if (b >= 0 && b !== a) { sets[a].add(b); sets[b].add(a); } }
        if (r < rows - 1) { const b = provinceOf[k + cols]; if (b >= 0 && b !== a) { sets[a].add(b); sets[b].add(a); } }
      }
    }
    for (let i = 0; i < provinces.length; i++) provinces[i].neighbors = Array.from(sets[i]);
  }

  /* ------------------------------------------------------------ geometria -- */
  function rdp(points, eps) {
    const n = points.length;
    if (n < 3) return points;
    const keep = new Uint8Array(n);
    keep[0] = 1; keep[n - 1] = 1;
    const stack = [[0, n - 1]];
    while (stack.length) {
      const seg = stack.pop();
      const i0 = seg[0], i1 = seg[1];
      if (i1 <= i0 + 1) continue;
      const ax = points[i0][0], ay = points[i0][1];
      const bx = points[i1][0], by = points[i1][1];
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      let maxD = -1, maxI = -1;
      for (let i = i0 + 1; i < i1; i++) {
        const px = points[i][0] - ax, py = points[i][1] - ay;
        let d;
        if (len2 === 0) d = px * px + py * py;
        else {
          let t = (px * dx + py * dy) / len2;
          if (t < 0) t = 0; else if (t > 1) t = 1;
          const qx = px - t * dx, qy = py - t * dy;
          d = qx * qx + qy * qy;
        }
        if (d > maxD) { maxD = d; maxI = i; }
      }
      if (maxD > eps * eps) {
        keep[maxI] = 1;
        stack.push([i0, maxI]);
        stack.push([maxI, i1]);
      }
    }
    const out = [];
    for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
    return out;
  }

  function buildProvinceGeometry(provinces, provinceOf) {
    const cols = GEO.cols, rows = GEO.rows;
    const W = cols + 1;
    const nbOf = function (c, r) {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
      return provinceOf[r * cols + c];
    };
    for (let pi = 0; pi < provinces.length; pi++) {
      const p = provinces[pi];
      const out = new Map();
      const segs = [];
      const addEdge = function (from, to) {
        let list = out.get(from);
        if (!list) { list = []; out.set(from, list); }
        list.push(to);
      };
      for (let ci = 0; ci < p.cells.length; ci++) {
        const k = p.cells[ci], c = k % cols, r = (k - c) / cols;
        let nb = nbOf(c, r - 1);
        if (nb !== p.id) { addEdge((r) * W + (c + 1), (r) * W + c); segs.push(c + 1, r, c, r, nb); }
        nb = nbOf(c + 1, r);
        if (nb !== p.id) { addEdge((r + 1) * W + (c + 1), (r) * W + (c + 1)); segs.push(c + 1, r + 1, c + 1, r, nb); }
        nb = nbOf(c, r + 1);
        if (nb !== p.id) { addEdge((r + 1) * W + c, (r + 1) * W + (c + 1)); segs.push(c, r + 1, c + 1, r + 1, nb); }
        nb = nbOf(c - 1, r);
        if (nb !== p.id) { addEdge(r * W + c, (r + 1) * W + c); segs.push(c, r, c, r + 1, nb); }
      }

      // składanie pętli
      const loops = [];
      let guard = 0;
      while (out.size > 0 && guard++ < 200000) {
        let start = null;
        out.forEach(function (list, key) { if (start === null && list.length) start = key; });
        if (start === null) break;
        const startList = out.get(start);
        let cur = start;
        let next = startList.pop();
        if (!startList.length) out.delete(start);
        const loop = [cur];
        let closed = false;
        let steps = 0;
        while (steps++ < 400000) {
          loop.push(next);
          if (next === start) { closed = true; break; }
          const list = out.get(next);
          if (!list || !list.length) break;
          const px = cur % W, py = (cur - px) / W;
          const cx = next % W, cy = (next - cx) / W;
          const dx = cx - px, dy = cy - py;
          let bestI = -1, bestAngle = Infinity;
          for (let i = 0; i < list.length; i++) {
            const e = list[i];
            const ex = (e % W) - cx, ey = Math.floor(e / W) - cy;
            const cross = dx * ey - dy * ex;
            const dot = dx * ex + dy * ey;
            const ang = (dot < 0 && cross === 0) ? Math.PI : Math.atan2(cross, dot);
            if (ang < bestAngle) { bestAngle = ang; bestI = i; }
          }
          const chosen = list.splice(bestI, 1)[0];
          if (!list.length) out.delete(next);
          cur = next;
          next = chosen;
        }
        if (closed) loops.push(loop);
      }

      // kontrola poprawności: suma pól pętli musi równać się liczbie komórek
      let signedArea = 0;
      const loopsXY = [];
      for (let li = 0; li < loops.length; li++) {
        const loop = loops[li];
        if (loop.length < 4) continue;
        const pts = [];
        for (let i = 0; i < loop.length - 1; i++) {
          const v = loop[i];
          pts.push([v % W, (v - (v % W)) / W]);
        }
        if (pts.length < 3) continue;
        let area2 = 0;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          area2 += a[0] * b[1] - b[0] * a[1];
        }
        signedArea += area2 / 2;
        loopsXY.push(pts);
      }
      const ok = Math.abs(Math.abs(signedArea) - p.cellCount) < 0.75;
      p.contours = [];
      if (ok) {
        for (let li = 0; li < loopsXY.length; li++) {
          const pts = rdp(loopsXY[li], 0.42);
          if (pts.length < 3) continue;
          const flat = new Float32Array(pts.length * 2);
          for (let i = 0; i < pts.length; i++) { flat[i * 2] = pts[i][0]; flat[i * 2 + 1] = pts[i][1]; }
          p.contours.push(flat);
        }
      }
      p.geometryOk = ok && p.contours.length > 0;

      // odcinki granic (z informacją o prowincji po drugiej stronie)
      p.borderSegs = new Float32Array(segs);
    }
  }

  /* ---------------------------------------------------- nazwy i stolice ---- */
  function assignNames(world) {
    const cities = (window.WORLD_CITIES || []).map(function (c) {
      return { name: c[0], lon: c[1], lat: c[2], pop: c[3], cap: c[4] === 1 };
    });
    cities.sort(function (a, b) { return b.pop - a.pop; });
    const countries = world.countries, provinces = world.provinces;
    const grid = world.grid;
    const cols = GEO.cols, rows = GEO.rows;

    const countryOfCity = new Int32Array(cities.length).fill(-1);
    for (let i = 0; i < cities.length; i++) {
      const c = lonToCol(cities[i].lon), r = latToRow(cities[i].lat);
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const pid = world.provinceOf[r * cols + c];
      if (pid >= 0) countryOfCity[i] = provinces[pid].country;
    }

    const named = new Uint8Array(provinces.length);
    const cityUsed = new Uint8Array(cities.length);
    const MAX_KM = 260;

    function nearestProvinceInCountry(cityIdx, countryId, onlyUnnamed) {
      const city = cities[cityIdx];
      let best = -1, bestD = Infinity;
      for (let p = 0; p < provinces.length; p++) {
        if (provinces[p].country !== countryId) continue;
        if (onlyUnnamed && named[p]) continue;
        const ll = provinces[p].centroidLonLat;
        const dx = (ll[0] - city.lon) * Math.cos(city.lat * Math.PI / 180);
        const dy = ll[1] - city.lat;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) { bestD = d2; best = p; }
      }
      if (best < 0) return -1;
      const km = Math.sqrt(bestD) * 111.32;
      return km <= MAX_KM ? best : -1;
    }

    // 1. przejście: duże miasta nadają nazwy unikalnym prowincjom
    for (let i = 0; i < cities.length; i++) {
      const cid = countryOfCity[i];
      if (cid < 0) continue;
      const p = nearestProvinceInCountry(i, cid, true);
      if (p < 0) continue;
      provinces[p].name = cities[i].name;
      provinces[p].cityLonLat = [cities[i].lon, cities[i].lat];
      provinces[p].namedByCity = true;
      if (cities[i].cap) provinces[p].hasCapitalCity = true;
      named[p] = 1;
      cityUsed[i] = 1;
    }

    // 2. przejście: pozostałe prowincje — najbliższe miasto (może się powtarzać)
    const fallbackCount = new Int32Array(countries.length);
    for (let p = 0; p < provinces.length; p++) {
      if (named[p]) continue;
      const cid = provinces[p].country;
      let best = -1, bestD = Infinity;
      for (let i = 0; i < cities.length; i++) {
        if (countryOfCity[i] !== cid) continue;
        const ll = provinces[p].centroidLonLat;
        const dx = (cities[i].lon - ll[0]) * Math.cos(ll[1] * Math.PI / 180);
        const dy = cities[i].lat - ll[1];
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) { bestD = d2; best = i; }
      }
      if (best >= 0 && Math.sqrt(bestD) * 111.32 <= 700) {
        provinces[p].name = cities[best].name;
        provinces[p].cityLonLat = [cities[best].lon, cities[best].lat];
      } else {
        // brak miasta w zasięgu — numerujemy w obrębie kraju (nie globalnie)
        fallbackCount[cid]++;
        provinces[p].name = countries[cid].name + ' ' + fallbackCount[cid];
      }
      named[p] = 1;
    }
    dedupeNames(provinces, countries);

    // stolice krajów: prowincja z miastem-stolicą (największym) albo największa prowincja
    const capProv = new Int32Array(countries.length).fill(-1);
    const capWeight = new Float64Array(countries.length);
    const bigProv = new Int32Array(countries.length).fill(-1);
    const bigWeight = new Float64Array(countries.length);
    for (let p = 0; p < provinces.length; p++) {
      const pv = provinces[p];
      const cid = pv.country;
      if (pv.popWeight > bigWeight[cid]) { bigWeight[cid] = pv.popWeight; bigProv[cid] = p; }
      if (pv.hasCapitalCity && pv.popWeight > capWeight[cid]) { capWeight[cid] = pv.popWeight; capProv[cid] = p; }
    }
    for (let i = 0; i < countries.length; i++) {
      const cap = capProv[i] >= 0 ? capProv[i] : bigProv[i];
      countries[i].capitalProvince = cap;
      if (cap >= 0) provinces[cap].isCapital = true;
    }
  }

  /* Powtarzające się nazwy w obrębie kraju rozróżniamy kierunkiem geograficznym. */
  function dedupeNames(provinces, countries) {
    const ccx = new Float64Array(countries.length), ccy = new Float64Array(countries.length), cw = new Float64Array(countries.length);
    for (let i = 0; i < provinces.length; i++) {
      const p = provinces[i];
      ccx[p.country] += p.centroid[0] * p.popWeight;
      ccy[p.country] += p.centroid[1] * p.popWeight;
      cw[p.country] += p.popWeight;
    }
    const groups = new Map();
    for (let i = 0; i < provinces.length; i++) {
      const p = provinces[i];
      let m = groups.get(p.country);
      if (!m) { m = new Map(); groups.set(p.country, m); }
      const list = m.get(p.name);
      if (list) list.push(p); else m.set(p.name, [p]);
    }
    const dirs = ['wsch.', 'płn.-wsch.', 'płn.', 'płn.-zach.', 'zach.', 'płd.-zach.', 'płd.', 'płd.-wsch.'];
    const used = new Set();
    groups.forEach(function (m, cid) {
      m.forEach(function (list, name) {
        if (list.length < 2) return;
        list.sort(function (a, b) { return b.popWeight - a.popWeight; });
        for (let i = 1; i < list.length; i++) {
          const p = list[i];
          const dx = p.centroid[0] - (ccx[cid] / (cw[cid] || 1));
          const dy = p.centroid[1] - (ccy[cid] / (cw[cid] || 1));
          const ang = Math.atan2(-dy, dx) * 180 / Math.PI; // 0 = wschód, 90 = północ
          const idx = Math.round((((ang % 360) + 360) % 360) / 45) % 8;
          // najpierw kierunek zgodny z położeniem, potem kolejne wolne kierunki
          let newName = '', k = 0;
          while (k < 8) {
            const cand = name + ' (' + dirs[(idx + k) % 8] + ')';
            if (!used.has(cid + '|' + cand)) { newName = cand; break; }
            k++;
          }
          if (!newName) {
            // wszystkie kierunki zajęte — numeracja rzymska bez powtarzania kierunku
            let n = 2;
            do { newName = name + ' ' + Util.romanize(n++); } while (used.has(cid + '|' + newName));
          }
          used.add(cid + '|' + newName);
          p.name = newName;
        }
        used.add(cid + '|' + name);
      });
    });
  }

  /* --------------------------------------------------------- liczba ludności */
  function distributePopulation(world) {
    const countries = world.countries, provinces = world.provinces;
    const weights = new Float64Array(countries.length);
    for (let i = 0; i < provinces.length; i++) weights[provinces[i].country] += provinces[i].popWeight;
    for (let i = 0; i < provinces.length; i++) {
      const p = provinces[i];
      const c = countries[p.country];
      const share = weights[p.country] > 0 ? p.popWeight / weights[p.country] : 0;
      p.pop = Math.max(1000, Math.round(c.pop * share));
      const gdpc = c.pop > 0 ? (c.gdp * 1e6) / c.pop : 2000;
      const base = Util.clamp(Math.round(35 * Math.log10(Math.max(200, gdpc) / 300)), 5, 100);
      const rnd = Util.mulberry32(Util.hashStr(p.name + '|' + p.country))();
      p.econ = Util.clamp(Math.round(base + (rnd * 14 - 7)), 3, 100);
    }
  }

  /* ------------------------------------------------------------- budowa ---- */
  async function build(onProgress) {
    const t0 = Date.now();
    const timings = {};
    const mark = function (k) { timings[k] = Date.now() - t0; };
    const report = function (stage, frac, info) {
      if (onProgress) onProgress(stage, frac, info);
    };

    report('Wczytywanie danych geograficznych', 0.02);
    await Util.nextFrame();

    const countries = buildCountries();
    mark('kraje');
    report('Rasteryzacja mapy świata', 0.08, countries.length + ' krajów');
    await Util.nextFrame();

    const rast = rasterize(countries);
    mark('rasteryzacja');
    report('Rasteryzacja mapy świata', 0.45, Util.fmt(rast.crossings) + ' przecięć');
    await Util.nextFrame();

    const built = buildProvinces(rast.grid, countries);
    const provinces = built.provinces;
    mark('prowincje');
    report('Tworzenie prowincji', 0.62, provinces.length + ' prowincji');
    await Util.nextFrame();

    computeProvinceStats(provinces);
    markCoastal(provinces, rast.grid);
    buildAdjacency(provinces, built.provinceOf);
    mark('sasiedztwa');
    report('Budowa sąsiedztw', 0.72);
    await Util.nextFrame();

    const world = {
      GEO: GEO,
      countries: countries.filter(function (c) { return c.cellCount > 0; }),
      provinces: provinces,
      grid: rast.grid,
      provinceOf: built.provinceOf,
      cellLon: cellLon,
      cellLat: cellLat,
      stats: { countries: 0, provinces: provinces.length, landCells: 0, skippedWrap: rast.skippedWrap }
    };
    // kraje -> prowincje (ułatwia dostęp) — najpierw przeliczamy ID krajów na zwarte
    const cRemap = new Int32Array(countries.length).fill(-1);
    world.countries.forEach(function (c, i) { cRemap[c.id] = i; c.id = i; });
    for (let i = 0; i < world.provinces.length; i++) {
      const p = world.provinces[i];
      p.country = cRemap[p.country];
    }
    for (let i = 0; i < world.provinces.length; i++) {
      const p = world.provinces[i];
      const c = world.countries[p.country];
      if (!c) continue;
      (c.provinces = c.provinces || []).push(p.id);
    }
    world.stats.countries = world.countries.length;

    report('Nadawanie nazw prowincjom', 0.82);
    await Util.nextFrame();
    assignNames(world);
    mark('nazwy');

    report('Rozmieszczanie ludności', 0.9);
    await Util.nextFrame();
    distributePopulation(world);
    mark('ludnosc');

    report('Generowanie geometrii', 0.94);
    await Util.nextFrame();
    buildProvinceGeometry(world.provinces, world.provinceOf);
    mark('geometria');

    // centroidy i skrzynki krajów
    const counts = new Int32Array(world.countries.length);
    world.countries.forEach(function (c) { c.cx = 0; c.cy = 0; c.cw = 0; });
    for (let i = 0; i < world.provinces.length; i++) {
      const p = world.provinces[i];
      const c = world.countries[p.country];
      if (!c) continue;
      c.cx += p.centroid[0] * p.popWeight; c.cy += p.centroid[1] * p.popWeight; c.cw += p.popWeight;
      counts[p.country]++;
    }
    for (let i = 0; i < world.countries.length; i++) {
      const c = world.countries[i];
      c.centroid = c.cw > 0 ? [c.cx / c.cw, c.cy / c.cw] : [0, 0];
      c.provinceCount = counts[i];
      c.capitalProvince = c.provinceCount > 0 ? c.capitalProvince : -1;
      delete c.polys; // geometria kraju nie jest już potrzebna
    }

    // miasta do etykiet na mapie
    world.mapCities = (window.WORLD_CITIES || []).map(function (c) {
      return { name: c[0], lon: c[1], lat: c[2], pop: c[3], cap: c[4] === 1 };
    }).filter(function (c) {
      return c.lat <= GEO.latMax && c.lat >= GEO.latMin;
    });

    report('Gotowe', 1);
    world.timings = timings;
    world.loadMs = Date.now() - t0;
    return world;
  }

  return {
    GEO: GEO,
    build: build,
    cellLon: cellLon,
    cellLat: cellLat,
    lonToCol: lonToCol,
    latToRow: latToRow
  };
})();
