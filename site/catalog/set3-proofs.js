/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Visual math proofs in a calm explainer style (Canvas 2D, CPU).
(function () {
  const { C, seg, ease } = EX;
  const W = 640, H = 360;
  const SANS = '"Segoe UI", sans-serif', HEAD = 'Bahnschrift, "Segoe UI", sans-serif', MONO = '"Cascadia Mono", Consolas, monospace';
  const fmt = v => String(Math.round(v * 100) / 100);

  // Draws the numbered step list on the right; i is the active step.
  function drawSteps(g, x, y, steps, i) {
    g.textAlign = 'left'; g.textBaseline = 'middle';
    steps.forEach((s, k) => {
      g.globalAlpha = k === i ? 1 : k < i ? 0.5 : 0.18;
      g.fillStyle = k === i ? C.coral : C.cream; g.font = '600 13px ' + MONO; g.fillText(String(k + 1), x, y + k * 30);
      g.fillStyle = C.cream; g.font = '15px ' + SANS; g.fillText(s, x + 22, y + k * 30);
    });
    g.globalAlpha = 1;
  }

  EX.add({
    cat: 'mg', id: 'vp-pythag', title: 'Pythagorean theorem by rearrangement', aka: 'visual proof, math explainer, a squared plus b squared, sliding triangles', tool: 'Canvas 2D', runs: 'CPU',
    notice: 'Four copies of one right triangle sit in a square and leave a tilted gap of area c squared. The triangles slide to new spots inside the same frame, and the gap becomes two squares, a squared and b squared. The frame and the triangles never changed, so the two gaps are equal.',
    use: 'math and science explainers, lesson intros, any "same parts, new arrangement" story',
    params: [{ key: 'a', label: 'Leg a (b = 10 - a)', min: 1, max: 9, step: 0.5, value: 3 }],
    prompt: 'A calm, 3Blue1Brown-style animated proof of the Pythagorean theorem on a near-black background: four equal right triangles (legs a = {a} and b = 10 - a) fill a square and leave a tilted c-squared gap, then slide one by one inside the same frame until the gap is an a-squared and a b-squared square. Numbered step captions on the right, soft colors, the equation with real numbers at the end, seamless loop.',
    setup(cv, L) {
      const g = cv.getContext('2d');
      const S = 270, X0 = 50, Y0 = 45, P = 12;
      const steps = ['Four equal right triangles', 'The gap is one square: c²', 'Slide them inside the frame', 'The gap is now a² + b²', 'Same gap, so c² = a² + b²'];
      const px = (x, y) => [X0 + x, Y0 + S - y];
      const poly = (pts, fill, stroke) => {
        g.beginPath(); pts.forEach((p, i) => { const [x, y] = px(p[0], p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
        if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); }
      };
      const label = (txt, x, y, col, size) => { const [sx, sy] = px(x, y); g.fillStyle = col; g.font = '600 ' + size + 'px ' + HEAD; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, sx, sy); };
      return (t) => {
        const u = t % P, la = L.p.a, lb = 10 - la, a = la / 10 * S, b = S - a;
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const fade = 1 - seg(u, 11, 11.8), cIn = seg(u, 1.2, 2) * (1 - seg(u, 3.2, 3.8)), abIn = seg(u, 6, 6.8);
        g.globalAlpha = fade;
        // gaps first, triangles on top
        if (cIn > 0) { g.globalAlpha = fade * cIn; poly([[a, 0], [S, a], [b, S], [0, b]], 'rgba(43,196,230,0.35)', C.cyan); label('c²', S / 2, S / 2, C.cyan, 30); }
        if (abIn > 0) {
          g.globalAlpha = fade * abIn;
          poly([[0, 0], [a, 0], [a, a], [0, a]], 'rgba(255,90,54,0.35)', C.coral); label('a²', a / 2, a / 2, C.coral, Math.max(14, Math.min(30, a * 0.4)));
          poly([[a, a], [S, a], [S, S], [a, S]], 'rgba(255,176,32,0.3)', C.amber); label('b²', a + b / 2, a + b / 2, C.amber, Math.max(14, Math.min(30, b * 0.4)));
        }
        // the four triangles: corner, horizontal leg, vertical leg, shift to the second layout
        const tris = [[0, 0, a, b, 0, a], [S, 0, -b, a, 0, 0], [S, S, -a, -b, -b, 0], [0, S, b, -a, a, -b]];
        tris.forEach((d, i) => {
          const m = ease.inOut(seg(u, 3.4 + i * 0.35, 4.6 + i * 0.35)), cx = d[0] + d[4] * m, cy = d[1] + d[5] * m;
          g.globalAlpha = fade * seg(u, i * 0.2, i * 0.2 + 0.6);
          poly([[cx, cy], [cx + d[2], cy], [cx, cy + d[3]]], 'rgba(122,92,255,0.55)', C.cream);
        });
        g.globalAlpha = fade;
        g.strokeStyle = 'rgba(244,239,230,0.7)'; g.lineWidth = 2; g.strokeRect(X0, Y0, S, S);
        // side labels: the bottom and right edges split into a and b in both layouts
        g.globalAlpha = fade * 0.9;
        label('a', a / 2, -14, C.cream, 16); label('b', a + b / 2, -14, C.cream, 16);
        label('a', S + 14, a / 2, C.cream, 16); label('b', S + 14, a + b / 2, C.cream, 16);
        g.fillStyle = C.cream; [[a, 0, 0], [S, a, 8]].forEach(q => { const [x, y] = px(q[0], q[1]); g.fillRect(x - 1, y - 1, q[2] ? 8 : 2, q[2] ? 2 : 8); });
        if (u < 3.4) { g.globalAlpha = fade * seg(u, 0.6, 1.2) * (1 - seg(u, 3.0, 3.4)); label('c', a / 2 + 12, b / 2 + 12, C.cream, 16); }
        // captions
        g.globalAlpha = fade;
        g.fillStyle = C.amber; g.font = '600 13px ' + HEAD; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('PYTHAGORAS BY REARRANGEMENT', 360, 48);
        const si = u < 1.2 ? 0 : u < 3.3 ? 1 : u < 6 ? 2 : u < 8 ? 3 : 4;
        g.save(); g.globalAlpha = fade; drawSteps(g, 360, 84, steps, si); g.restore();
        const eq = seg(u, 8, 8.6) * fade;
        if (eq > 0) {
          g.globalAlpha = eq; g.fillStyle = C.cream; g.font = '15px ' + MONO; g.textAlign = 'left';
          g.fillText('a = ' + fmt(la) + ', b = ' + fmt(lb), 360, 258);
          g.fillStyle = C.cyan; g.fillText('c² = ' + fmt(la * la + lb * lb), 360, 286);
          g.fillStyle = C.cream; g.fillText('   = ' + fmt(la * la) + ' + ' + fmt(lb * lb), 360, 310);
        }
        g.globalAlpha = 1;
      };
    },
  });
})();
