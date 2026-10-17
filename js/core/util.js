/* ==========================================================================
   util.js — drobne funkcje pomocnicze wspólne dla całej gry
   ========================================================================== */
window.Util = (function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function invLerp(a, b, v) { return (v - a) / (b - a); }

  /* Deterministyczny generator liczb pseudolosowych (mulberry32). */
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /* 1234567 -> "1 234 567" (polski zapis) */
  function fmt(n) {
    n = Math.round(n || 0);
    const s = Math.abs(n).toString();
    let out = '';
    for (let i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
      out += s[i];
    }
    return (n < 0 ? '-' : '') + out;
  }

  function fmtShort(n) {
    n = n || 0;
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + ' mld';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' mln';
    if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + ' tys.';
    return fmt(n);
  }

  function fmtPct(v) { return (v * 100).toFixed(0) + '%'; }

  /* Kolory ------------------------------------------------------------------ */
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      const s = clamp(Math.round(v), 0, 255).toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }
  /* amt > 0 rozjaśnia, amt < 0 przyciemnia (zakres -1..1) */
  function shade(hex, amt) {
    const c = hexToRgb(hex);
    const f = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    return rgbToHex(c[0] + (f - c[0]) * p, c[1] + (f - c[1]) * p, c[2] + (f - c[2]) * p);
  }
  function mix(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    return rgbToHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = function (p, q, t) {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
    }
    return rgbToHex(r * 255, g * 255, b * 255);
  }
  function rgba(hex, a) {
    const c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  /* Kolor skali dla map tematycznych: t w 0..1 */
  function scaleColor(t, stops) {
    t = clamp(t, 0, 1);
    const n = stops.length - 1;
    const x = t * n;
    const i = Math.min(n - 1, Math.floor(x));
    return mix(stops[i], stops[i + 1], x - i);
  }

  /* Geometria ---------------------------------------------------------------- */
  function deg2rad(d) { return d * Math.PI / 180; }
  function haversineKm(lon1, lat1, lon2, lat2) {
    const R = 6371, dLat = deg2rad(lat2 - lat1), dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /* Odstęp między etapami generowania świata. rAF bywa wstrzymywany w kartach
     w tle, dlatego zawsze działa awaryjny setTimeout. */
  function nextFrame() {
    return new Promise(function (resolve) {
      let done = false;
      const finish = function () { if (!done) { done = true; resolve(); } };
      const timer = setTimeout(finish, 50);
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () { clearTimeout(timer); finish(); });
      }
    });
  }

  function romanize(num) {
    const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
      [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (let i = 0; i < map.length; i++) while (num >= map[i][0]) { out += map[i][1]; num -= map[i][0]; }
    return out || 'I';
  }

  function plural(n, one, few, many) {
    const n10 = n % 10, n100 = n % 100;
    if (n === 1) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  return {
    clamp: clamp, lerp: lerp, invLerp: invLerp, mulberry32: mulberry32, hashStr: hashStr,
    fmt: fmt, fmtShort: fmtShort, fmtPct: fmtPct,
    hexToRgb: hexToRgb, rgbToHex: rgbToHex, shade: shade, mix: mix, hslToHex: hslToHex,
    rgba: rgba, scaleColor: scaleColor,
    haversineKm: haversineKm, nextFrame: nextFrame, romanize: romanize, plural: plural,
    el: el, escapeHtml: escapeHtml
  };
})();
