/* ==========================================================================
   camera.js — kamera mapy: przesuwanie, zoom, przeliczanie współrzędnych.
   Jednostką świata jest jedna komórka siatki (patrz worldgen.js).
   ========================================================================== */
window.Camera = (function () {
  'use strict';

  function Camera(worldW, worldH) {
    this.worldW = worldW;
    this.worldH = worldH;
    this.scale = 2;          // piksele na jednostkę świata
    this.x = 0;              // przesunięcie w px
    this.y = 0;
    this.minScale = 1;
    this.maxScale = 60;
    this.viewW = 100;
    this.viewH = 100;
  }

  Camera.prototype.setViewport = function (w, h) {
    this.viewW = w; this.viewH = h;
    // Minimalne zbliżenie = cały świat widoczny naraz (z niewielkim zapasem).
    this.minScale = Math.min(w / this.worldW, h / this.worldH) * 0.9;
    this.maxScale = 60;
    this.clampView();
  };

  /* Dopasuj cały świat do widoku (widok obejmuje całą mapę). */
  Camera.prototype.fit = function () {
    const s = Math.min(this.viewW / this.worldW, this.viewH / this.worldH) * 0.98;
    this.scale = Util.clamp(s, this.minScale, this.maxScale);
    this.x = (this.viewW - this.worldW * this.scale) / 2;
    this.y = (this.viewH - this.worldH * this.scale) / 2;
    this.clampView();
  };

  Camera.prototype.clampView = function () {
    const w = this.worldW * this.scale, h = this.worldH * this.scale;
    const pad = 40;
    const centerX = (this.viewW - w) / 2, centerY = (this.viewH - h) / 2;
    let minX, maxX, minY, maxY;
    if (w <= this.viewW) { minX = centerX - pad; maxX = centerX + pad; }
    else { minX = this.viewW - w - pad; maxX = pad; }
    if (h <= this.viewH) { minY = centerY - pad; maxY = centerY + pad; }
    else { minY = this.viewH - h - pad; maxY = pad; }
    this.x = Util.clamp(this.x, minX, maxX);
    this.y = Util.clamp(this.y, minY, maxY);
  };

  Camera.prototype.worldToScreen = function (wx, wy) {
    return [wx * this.scale + this.x, wy * this.scale + this.y];
  };
  Camera.prototype.screenToWorld = function (sx, sy) {
    return [(sx - this.x) / this.scale, (sy - this.y) / this.scale];
  };
  Camera.prototype.pxToWorld = function (px) { return px / this.scale; };

  Camera.prototype.panBy = function (dx, dy) {
    this.x += dx; this.y += dy;
    this.clampView();
  };

  /* Zoom wokół punktu ekranu (np. kursora). */
  Camera.prototype.zoomAt = function (sx, sy, factor) {
    const before = this.screenToWorld(sx, sy);
    this.scale = Util.clamp(this.scale * factor, this.minScale, this.maxScale);
    const after = this.screenToWorld(sx, sy);
    this.x += (after[0] - before[0]) * this.scale;
    this.y += (after[1] - before[1]) * this.scale;
    this.clampView();
  };

  Camera.prototype.centerOn = function (wx, wy, scale) {
    if (scale) this.scale = Util.clamp(scale, this.minScale, this.maxScale);
    this.x = this.viewW / 2 - wx * this.scale;
    this.y = this.viewH / 2 - wy * this.scale;
    this.clampView();
  };

  /* Widoczny prostokąt w jednostkach świata. */
  Camera.prototype.viewRect = function () {
    return {
      x0: -this.x / this.scale,
      y0: -this.y / this.scale,
      x1: (this.viewW - this.x) / this.scale,
      y1: (this.viewH - this.y) / this.scale
    };
  };

  return Camera;
})();
