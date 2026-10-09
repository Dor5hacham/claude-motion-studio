/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Generative-art classics for the catalog (Canvas 2D, CPU): the paper-folding dragon curve.
(function () {
  const { C } = EX;
  const W = 640, H = 360;
  const smooth = x => x * x * (3 - 2 * x);

  EX.add({
    cat: 'sim', id: 'gn-dragonfold', title: 'Dragon curve unfolding', aka: 'Heighway dragon, paper-folding curve, Jurassic Park fractal', tool: 'Canvas 2D', runs: 'CPU',
    notice: 'Fold a strip of paper in half again and again, then open every fold to a right angle: you get the dragon curve. Here each step copies the whole line and swings the copy 90 degrees around its end point. Each color is one fold, and the camera zooms out to keep the growing curve in frame.',
    use: 'fractal intros, math explainers, "one rule, repeated" stories',
    params: [{ key: 'folds', label: 'Folds', min: 4, max: 14, step: 1, value: 12 }, { key: 'speed', label: 'Folds per second', min: 0.2, max: 3, step: 0.1, value: 1.2 }],
    prompt: 'Heighway dragon curve that builds itself fold by fold: start from one line, then {folds} times copy the whole curve and swing the copy 90 degrees around its end point with an eased rotation, {speed} folds per second. Color each fold differently (coral, amber, cream, cyan, violet), zoom the camera out smoothly to keep the curve framed, hold, then repeat.',
    setup(stage, L) {
      const g = stage.getContext('2d'); const MAX = 14, n = 1 << MAX;
      // the finished curve; after k folds the curve is exactly its first 2^k + 1 points
      const px = new Float64Array(n + 1), py = new Float64Array(n + 1);
      px[1] = 1;
      for (let k = 0; k < MAX; k++) {
        const m = 1 << k, ex = px[m], ey = py[m];
        for (let j = 1; j <= m; j++) { const dx = px[m - j] - ex, dy = py[m - j] - ey; px[m + j] = ex - dy; py[m + j] = ey + dx; }
      }
      const cols = [C.coral, C.amber, C.cream, C.cyan, C.violet];
      const qx = new Float64Array(n + 1), qy = new Float64Array(n + 1);
      let clock = 0;
      return (t, dt) => {
        clock += dt * L.p.speed;
        const folds = L.p.folds | 0, cyc = folds + 2.5, ph = clock % cyc;
        let k = Math.floor(ph), th = Math.PI / 2 * smooth(ph - k);
        if (k >= folds) { k = folds - 1; th = Math.PI / 2; }
        const m = 1 << k, ex = px[m], ey = py[m], co = Math.cos(th), si = Math.sin(th);
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (let i = 0; i <= m; i++) { qx[i] = px[i]; qy[i] = py[i]; }
        for (let j = 1; j <= m; j++) { const dx = px[m - j] - ex, dy = py[m - j] - ey; qx[m + j] = ex + dx * co - dy * si; qy[m + j] = ey + dx * si + dy * co; }
        for (let i = 0; i <= 2 * m; i++) { const x = qx[i], y = qy[i]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const sc = Math.min((W - 80) / Math.max(1e-6, x1 - x0), (H - 70) / Math.max(1e-6, y1 - y0), 220);
        const ox = W / 2 - (x0 + x1) / 2 * sc, oy = H / 2 + 6 - (y0 + y1) / 2 * sc;
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(1, Math.min(5, sc * 0.3));
        // segments made by fold f are indices 2^f .. 2^(f+1) - 1, so each fold is one path
        for (let f = -1; f <= k; f++) {
          const a = f < 0 ? 0 : 1 << f, b = f < 0 ? 1 : 1 << (f + 1);
          g.strokeStyle = cols[(f + 1) % cols.length]; g.beginPath(); g.moveTo(ox + qx[a] * sc, oy + qy[a] * sc);
          for (let i = a + 1; i <= b; i++) g.lineTo(ox + qx[i] * sc, oy + qy[i] * sc);
          g.stroke();
        }
        g.fillStyle = C.cream; g.beginPath(); g.arc(ox + ex * sc, oy + ey * sc, 4, 0, 6.283); g.fill();
        g.font = '13px ui-monospace, monospace'; g.fillStyle = C.cream;
        g.fillText('fold ' + (k + 1) + ' of ' + folds + '   ' + (2 * m) + ' segments', 16, 24);
      };
    },
  });
})();
