/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Second set of 2D motion-graphics demos (Canvas 2D, CPU): procedural walk cycle and more.
(function () {
  const { C, lerp, ease, noise } = EX;
  const W = 640, H = 360;
  const TAU = Math.PI * 2;
  const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

  EX.add({
    cat: 'mg', id: 'mg2-walk', title: 'Procedural walk cycle', aka: 'walk cycle, two-bone IK, character rig, contact down passing up', tool: 'Canvas 2D (two-bone IK + phase curves)', runs: 'CPU',
    notice: 'No keyframes: one phase value drives everything. Each foot is planted for 56% of the cycle and swings for the rest, a two-bone IK solver bends the knees, the hips dip on the down pose and rise on the up pose, the heel peels off before the toe leaves, and the head lags the body by a few frames. Show the rig to see the bones, the foot path and the four classic poses.',
    use: 'character explainers, mascots, game sprites, learning the walk cycle',
    params: [{ key: 'stride', label: 'Stride', min: 90, max: 200, step: 5, value: 150, unit: ' px' }, { key: 'bounce', label: 'Hip bounce', min: 0, max: 14, step: 0.5, value: 6, unit: ' px' }, { key: 'arms', label: 'Arm swing', min: 0, max: 50, step: 1, value: 28, unit: ' deg' }],
    controls: [{ label: 'Character', on: true, fn: L => { L.rig = false; } }, { label: 'Show rig', fn: L => { L.rig = true; } }],
    prompt: 'Procedural 2D walk cycle of a flat, stylish character (coral sweater, navy trousers, amber beanie) on a cream backdrop: 1.1 s per cycle, stride {stride}, hip bounce {bounce}, arm swing {arms}, two-bone IK legs with planted feet, heel strike and heel peel, head follow-through, the ground and two parallax layers scroll so the walker stays in frame; a rig toggle shows bones, the foot path and labels for contact, down, passing and up.',
    setup(cv, L) {
      const g = cv.getContext('2d');
      const G = 300, HX = 292, T1 = 58, T2 = 56, REACH = T1 + T2, CYC = 1.1, D = 0.56, LIFT = 20;
      const pts = {};
      let ph = 0, scroll = 0;
      const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
      // Foot pose for phase p in [0,1): x relative to the hip, lift above ground, angle (+ toe up, - heel up).
      function footPose(p, S) {
        const c = S * D / 2;
        if (p < D) { const u = p / D; return [c - p * S, 0, u < 0.2 ? 0.32 * (1 - smooth(u / 0.2)) : u > 0.55 ? -0.8 * smooth((u - 0.55) / 0.45) : 0]; }
        const u = (p - D) / (1 - D), e = u * u * u * (u * (u * 6 - 15) + 10);
        return [c + S * e - p * S, LIFT * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 1.3), lerp(-0.8, 0.32, smooth(u * 1.15))];
      }
      // Ankle position and foot angle: heel-up rotates around the toe, toe-up around the heel.
      function ankle(p, S) {
        const [x, lift, ang] = footPose(p, S), ax = HX + x, ay = G - 9 - lift;
        const px = ang < 0 ? ax + 27 : ax - 8, py = G - lift, [rx, ry] = rot(ax - px, ay - py, -ang);
        return [px + rx, py + ry, -ang, lift];
      }
      function ik(hx, hy, ax, ay) {
        let dx = ax - hx, dy = ay - hy, d = Math.hypot(dx, dy); const dd = Math.min(d, REACH * 0.995);
        const base = Math.atan2(dy, dx), off = Math.acos(Math.min(1, (T1 * T1 + dd * dd - T2 * T2) / (2 * T1 * dd)));
        const kx = hx + Math.cos(base - off) * T1, ky = hy + Math.sin(base - off) * T1;
        return [kx, ky, hx + Math.cos(base) * dd, hy + Math.sin(base) * dd];
      }
      const bob = (p, b) => b * Math.pow(0.5 + 0.5 * Math.cos(2 * TAU * (p - 0.125)), 2);
      // Hip height: as high as the planted legs reach (so it rises on passing and up), plus the designer's dip on down.
      const hipY = (p, S, b) => {
        let y = G - 30 - REACH;
        for (const q of [p, (p + 0.5) % 1]) { const [ax, ay] = ankle(q, S); const dx = ax - HX, lim = ay - Math.sqrt(Math.max(0, Math.pow(REACH * 0.985, 2) - dx * dx)); y = (y + lim + Math.sqrt((y - lim) * (y - lim) + 16)) / 2; }
        return y + bob(p, b);
      };
      const lim = (x1, y1, x2, y2, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
      function shoe(x, y, a, col, sole) {
        g.save(); g.translate(x, y); g.rotate(a);
        g.fillStyle = col; g.beginPath(); g.moveTo(-9, -5); g.lineTo(9, -7); g.quadraticCurveTo(27, -2, 29, 6); g.lineTo(29, 9); g.lineTo(-10, 9); g.closePath(); g.fill();
        g.fillStyle = sole; g.fillRect(-10, 6, 39, 3.5); g.restore();
      }
      function leg(p, S, hx, hy, far, key) {
        const [ax, ay, fa] = ankle(p, S), [kx, ky, ex, ey] = ik(hx, hy, ax, ay);
        const pant = far ? '#121029' : C.navy;
        lim(hx, hy, kx, ky, 21, pant); lim(kx, ky, ex, ey, 17, pant);
        shoe(ex, ey, fa, far ? '#8f8678' : '#fbf8f2', far ? '#2a2540' : '#3a3358');
        const [tx, ty] = rot(27, 8, fa);
        pts[key] = [hx, hy, kx, ky, ex, ey, ex + tx, ey + ty];
      }
      function arm(p, sx, sy, sw, far, key) {
        const a = sw * Math.cos(TAU * p), bend = 0.12 + 0.4 * (0.5 + 0.5 * Math.cos(TAU * (p - 0.09)));
        const f = sw ? a / sw : 0, ex = sx + Math.sin(a) * 46, ey = sy + Math.cos(a) * 46, b = a + bend * (0.4 + 0.6 * smooth(f * 0.5 + 0.5));
        const wx = ex + Math.sin(b) * 42, wy = ey + Math.cos(b) * 42;
        const sl = far ? '#b8401f' : C.coral;
        lim(sx, sy, ex, ey, 17, sl); lim(ex, ey, wx, wy, 14, sl);
        g.fillStyle = far ? '#b98463' : '#e9b48c'; g.beginPath(); g.arc(wx + Math.sin(b) * 6, wy + Math.cos(b) * 6, 7.5, 0, TAU); g.fill();
        pts[key] = [sx, sy, ex, ey, wx, wy];
      }
      function scene(off) {
        const sky = g.createLinearGradient(0, 0, 0, G); sky.addColorStop(0, '#f6efe2'); sky.addColorStop(1, '#ead9c2'); g.fillStyle = sky; g.fillRect(0, 0, W, G);
        g.fillStyle = C.coral; g.beginPath(); g.arc(470, 150, 74, 0, TAU); g.fill();
        g.fillStyle = '#f6efe2'; for (let i = 0; i < 5; i++) g.fillRect(380, 150 + i * 14 + 8, 180, 3 + i * 1.6);
        g.fillStyle = '#d9c6ad'; g.beginPath(); g.moveTo(0, G);
        for (let x = 0; x <= W; x += 8) g.lineTo(x, G - 70 - noise((x + off * 0.2) * 0.006, 3.3) * 90); g.lineTo(W, G); g.fill();
        g.fillStyle = '#c4ab8c'; const s2 = off * 0.5;
        for (let k = Math.floor(s2 / 170) - 1; k < Math.floor(s2 / 170) + 6; k++) {
          const x = k * 170 - s2, h = 60 + ((k * 7919) % 5 + 5) % 5 * 14;
          g.fillRect(x + 40, G - h, 5, h); g.beginPath(); g.ellipse(x + 42, G - h, 22, 30 + h * 0.15, 0, 0, TAU); g.fill();
        }
        g.fillStyle = C.navy; g.fillRect(0, G, W, H - G);
        g.fillStyle = 'rgba(244,239,230,0.18)'; for (let x = -(off % 64); x < W; x += 64) g.fillRect(x, G + 16, 30, 3);
        g.fillStyle = 'rgba(244,239,230,0.08)'; for (let x = -((off * 1.6) % 140); x < W; x += 140) g.fillRect(x, G + 38, 70, 4);
      }
      return (t, dt) => {
        const S = L.p.stride, B = L.p.bounce, sw = L.p.arms * Math.PI / 180;
        ph = (ph + dt / CYC) % 1; scroll += dt * S / CYC;
        scene(scroll);
        const hy = hipY(ph, S, B), lean = 0.07 + 0.02 * Math.cos(2 * TAU * (ph - 0.125));
        g.fillStyle = 'rgba(11,11,16,0.35)'; g.beginPath(); g.ellipse(HX + 6, G + 2, 62 - (G - hy - 100) * 0.4, 6, 0, 0, TAU); g.fill();
        const [ux, uy] = rot(0, -76, lean), sx = HX + ux, sy = hy + uy;
        g.globalAlpha = L.rig ? 0.28 : 1;
        arm(ph, sx - 2, sy + 4, sw, true, 'af');
        leg((ph + 0.5) % 1, S, HX - 3, hy, true, 'lf');
        g.save(); g.translate(HX, hy); g.rotate(lean);
        g.fillStyle = C.coral; g.beginPath(); g.moveTo(-17, 6); g.lineTo(-19, -58); g.quadraticCurveTo(-18, -82, 2, -84); g.quadraticCurveTo(20, -82, 19, -58); g.lineTo(17, 6); g.closePath(); g.fill();
        g.fillStyle = '#e04a2a'; g.fillRect(-17, -6, 34, 8);
        g.fillStyle = C.navy; g.beginPath(); g.ellipse(0, 6, 18, 13, 0, 0, TAU); g.fill(); g.restore();
        leg(ph, S, HX + 2, hy, false, 'ln');
        const lag = (bob(ph - 0.07, B) - bob(ph, B)) * 0.8, nod = (bob(ph - 0.12, B) - bob(ph - 0.02, B)) * 0.012;
        const hx = sx + 9, hh = sy - 30 + lag;
        lim(sx + 3, sy + 2, hx - 2, hh + 14, 11, '#d79f78');
        g.save(); g.translate(hx, hh); g.rotate(lean * 0.5 + nod);
        g.fillStyle = '#e9b48c'; g.beginPath(); g.arc(0, 0, 21, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(17, -2); g.quadraticCurveTo(28, 4, 19, 9); g.fill();
        g.fillStyle = '#d4986f'; g.beginPath(); g.ellipse(-4, 3, 4, 6, 0, 0, TAU); g.fill();
        g.fillStyle = C.navy; g.beginPath(); g.arc(10, 1, 2.6, 0, TAU); g.fill();
        g.strokeStyle = C.navy; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(10, 11); g.lineTo(15, 11); g.stroke();
        g.fillStyle = C.amber; g.beginPath(); g.arc(0, -4, 22.5, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill();
        g.fillStyle = '#e09a12'; g.fillRect(-23, -10, 46, 6);
        g.fillStyle = C.amber; g.beginPath(); g.arc(-6 - lag * 0.5, -29 + lag * 0.4, 6.5, 0, TAU); g.fill();
        g.restore();
        arm((ph + 0.5) % 1, sx + 2, sy + 4, sw, false, 'an');
        pts.head = [hx, hh];
        g.globalAlpha = 1;
        if (L.rig) {
          g.setLineDash([3, 5]); g.strokeStyle = 'rgba(122,92,255,0.75)'; g.lineWidth = 1.5; g.beginPath();
          for (let i = 0; i <= 64; i++) { const q = i / 64, a = ankle(q, S), y = a[1] - hipY(q, S, B) + hy; i ? g.lineTo(a[0], y) : g.moveTo(a[0], y); }
          g.stroke(); g.setLineDash([]);
          const bone = (arr, col) => { g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < arr.length; i += 2) i ? g.lineTo(arr[i], arr[i + 1]) : g.moveTo(arr[i], arr[i + 1]); g.stroke(); for (let i = 0; i < arr.length; i += 2) { g.fillStyle = '#fff'; g.beginPath(); g.arc(arr[i], arr[i + 1], 4.5, 0, TAU); g.fill(); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); } };
          bone(pts.lf, '#9c8fd6'); bone(pts.af, '#9c8fd6'); bone([HX, hy, sx, sy, pts.head[0], pts.head[1]], C.violet); bone(pts.ln, C.violet); bone(pts.an, C.violet);
          const keys = ['CONTACT', 'DOWN', 'PASSING', 'UP'], k8 = Math.round(ph * 8) % 8, near = Math.abs(((ph * 8 - Math.round(ph * 8)))) ;
          g.font = '700 22px Bahnschrift'; g.textAlign = 'left'; g.fillStyle = `rgba(29,27,58,${0.25 + 0.75 * (1 - smooth(near / 0.45))})`; g.fillText(keys[k8 % 4], 28, 46);
          g.font = '12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(29,27,58,0.7)'; g.fillText((k8 < 4 ? 'near' : 'far') + ' foot planted   phase ' + (Math.floor(ph * 100) / 100).toFixed(2), 28, 66);
          const x0 = 40, x1 = 600, ty = 340;
          g.fillStyle = 'rgba(244,239,230,0.25)'; g.fillRect(x0, ty - 1, x1 - x0, 2);
          for (let i = 0; i < 8; i++) { const x = lerp(x0, x1, i / 8), on = i === k8; g.fillStyle = on ? C.amber : 'rgba(244,239,230,0.55)'; g.fillRect(x - 1, ty - 7, 2, 14); g.font = '10px Cascadia Mono, Consolas'; g.fillText(keys[i % 4], x + 4, ty - 6); }
          g.fillStyle = C.coral; g.beginPath(); g.arc(lerp(x0, x1, ph), ty, 5, 0, TAU); g.fill();
        }
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-graph', title: 'Graph editor', aka: 'f-curve, value graph, speed graph, bezier handles, keyframe interpolation', tool: 'Canvas 2D (cubic bezier keyframes, solved per frame)', runs: 'CPU',
    notice: 'This is how After Effects and Blender store motion: keyframes joined by bezier curves, value going up, time going right. The ball on the right takes its height from the curve under the playhead, the ticks beside it show the spacing, and the strip below is the speed graph. Flat handles mean ease, a steep line means fast, broken handles make the sharp turn of a bounce. Drag the handles to make your own curve.',
    use: 'learning easing, matching an After Effects or Blender curve in code, timing reviews',
    params: [{ key: 'infl', label: 'Handle influence', min: 5, max: 100, step: 1, value: 33, unit: '%' }],
    controls: ['Auto', 'Linear', 'Ease', 'Overshoot', 'Bounce', 'Anticipate'].map((n, i) => ({ label: n, on: i === 0, fn: L => { L.auto = i === 0; if (i) L.pick = n; } })),
    prompt: 'Teaching animation: a dark graph editor like After Effects or Blender with a value curve over 48 frames at 24 fps, keyframes as diamonds and bezier handles with {infl} influence, a cyan playhead, a ball beside the graph that follows the curve with spacing ticks and slight stretch, and a speed graph underneath; cycle through linear, ease in-out, overshoot, bounce and anticipation presets, the new curve draws on from left to right.',
    setup(cv, L) {
      const g = cv.getContext('2d');
      const N = 48, GX0 = 70, GX1 = 470, GY0 = 50, GY1 = 282, SY0 = 300, SY1 = 342, BX = 566;
      const X = f => GX0 + f / N * (GX1 - GX0), Y = v => GY1 - (v + 30) / 160 * (GY1 - GY0);
      const k = (t, v, it, iv, ot, ov) => ({ t, v, it, iv, ot, ov });
      const PRE = {
        Linear: [k(0, 0, 0, 0, 16, 33.3), k(48, 100, -16, -33.3, 0, 0)],
        Ease: [k(0, 0, 0, 0, 16, 0), k(48, 100, -16, 0, 0, 0)],
        Overshoot: [k(0, 0, 0, 0, 6.6, 42), k(20, 114, -6.6, 0, 9.3, 0), k(48, 100, -9.3, 0, 0, 0)],
        Bounce: [k(0, 100, 0, 0, 5, 0), k(15, 0, -5, 66.7, 3, 24), k(24, 36, -3, 0, 3, 0), k(33, 0, -3, 24, 1.6, 6.7), k(37.7, 10, -1.6, 0, 1.6, 0), k(42.5, 0, -1.6, 6.7, 1.8, 0), k(48, 0, -1.8, 0, 0, 0)],
        Anticipate: [k(0, 0, 0, 0, 3.3, 0), k(10, -16, -3.3, 0, 3, 0), k(34, 100, -16, 0, 3, 0), k(48, 100, -3, 0, 0, 0)],
      };
      const ORDER = ['Overshoot', 'Ease', 'Bounce', 'Anticipate', 'Linear'];
      let name = 'Overshoot', keys = PRE[name], prev = null, sw = -9, drag = null, custom = null, hover = null;
      if (L.auto === undefined) L.auto = true;
      // Effective handle offsets after the influence slider, clamped inside the segment so time never runs backward.
      const eff = (ks, i, side, f) => {
        const a = ks[i], seg = side ? (ks[i + 1] ? ks[i + 1].t - a.t : 0) : (i ? a.t - ks[i - 1].t : 0);
        const dt = side ? a.ot : a.it, dv = side ? a.ov : a.iv; if (!dt) return [0, 0];
        const t2 = Math.max(-seg, Math.min(seg, dt * f)); return [t2, dv * t2 / dt];
      };
      const cub = (a, b, c, d, s) => { const m = 1 - s; return m * m * m * a + 3 * m * m * s * b + 3 * m * s * s * c + s * s * s * d; };
      function value(ks, f, fac) {
        if (f <= ks[0].t) return ks[0].v; const last = ks[ks.length - 1]; if (f >= last.t) return last.v;
        let i = 0; while (ks[i + 1].t < f) i++;
        const a = ks[i], b = ks[i + 1], [ot, ov] = eff(ks, i, 1, fac), [it, iv] = eff(ks, i + 1, 0, fac);
        let lo = 0, hi = 1; for (let n = 0; n < 22; n++) { const m = (lo + hi) / 2; if (cub(a.t, a.t + ot, b.t + it, b.t, m) < f) lo = m; else hi = m; }
        const s = (lo + hi) / 2; return cub(a.v, a.v + ov, b.v + iv, b.v, s);
      }
      function curve(ks, fac, col, w) {
        g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(GX0 - 30, Y(ks[0].v)); g.lineTo(X(ks[0].t), Y(ks[0].v));
        for (let i = 0; i + 1 < ks.length; i++) { const a = ks[i], b = ks[i + 1], [ot, ov] = eff(ks, i, 1, fac), [it, iv] = eff(ks, i + 1, 0, fac); g.bezierCurveTo(X(a.t + ot), Y(a.v + ov), X(b.t + it), Y(b.v + iv), X(b.t), Y(b.v)); }
        g.lineTo(GX1 + 14, Y(ks[ks.length - 1].v)); g.stroke();
      }
      const handlePts = (ks, fac) => { const out = []; ks.forEach((a, i) => { for (const side of [0, 1]) { const [dt, dv] = eff(ks, i, side, fac); if (dt) out.push({ i, side, x: X(a.t + dt), y: Y(a.v + dv), kx: X(a.t), ky: Y(a.v) }); } }); return out; };
      const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
      const pick = (x, y) => handlePts(keys, L.p.infl / 33).find(h => Math.hypot(h.x - x, h.y - y) < 12) || null;
      cv.onpointerdown = e => {
        const [x, y] = pos(e), h = pick(x, y); if (!h) return;
        if (!custom) { custom = keys.map(a => Object.assign({}, a)); keys = custom; name = 'Custom'; }
        drag = h; L.auto = false; cv.setPointerCapture(e.pointerId);
        cv.closest('article').querySelectorAll('.ctl button').forEach(b => b.classList.remove('on'));
      };
      cv.onpointermove = e => {
        const [x, y] = pos(e); hover = drag || pick(x, y); cv.style.cursor = hover ? 'grab' : '';
        if (!drag) return; const a = keys[drag.i], fac = L.p.infl / 33;
        const ft = (x - GX0) / (GX1 - GX0) * N - a.t, fv = (GY1 - y) / (GY1 - GY0) * 160 - 30 - a.v;
        const dt = drag.side ? Math.max(0.3, ft) : Math.min(-0.3, ft);
        if (drag.side) { a.ot = dt / fac; a.ov = fv / fac; } else { a.it = dt / fac; a.iv = fv / fac; }
      };
      cv.onpointerup = () => { drag = null; };
      const setCurve = n => { if (n === name && !custom) return; prev = { ks: keys, fac: L.p.infl / 33 }; name = n; keys = PRE[n]; custom = null; sw = L.t; };
      const vals = new Float32Array(97), spd = new Float32Array(97);
      return t => {
        const loop = 2.6, lt = t % loop, f = Math.min(N, Math.max(0, (lt - 0.3) * 24)), fac = L.p.infl / 33;
        if (L.pick) { setCurve(L.pick); L.pick = null; }
        if (L.auto) { const n = ORDER[Math.floor(t / (loop * 2)) % ORDER.length]; if (n !== name) setCurve(n); }
        g.fillStyle = '#101017'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#17171f'; g.fillRect(GX0 - 30, GY0 - 22, GX1 - GX0 + 44, SY1 - GY0 + 30);
        g.font = '11px Cascadia Mono, Consolas'; g.textAlign = 'right';
        for (let v = -25; v <= 125; v += 25) { g.fillStyle = v === 0 || v === 100 ? '#2c2c3a' : '#1e1e28'; g.fillRect(GX0 - 30, Y(v), GX1 - GX0 + 44, 1); g.fillStyle = '#55556a'; if (v % 50 === 0) g.fillText(String(v), GX0 - 34, Y(v) + 4); }
        g.textAlign = 'center';
        for (let fr = 0; fr <= N; fr += 6) { g.fillStyle = '#1e1e28'; g.fillRect(X(fr), GY0 - 22, 1, GY1 - GY0 + 22); g.fillStyle = '#55556a'; g.fillText(String(fr), X(fr), SY1 + 14); }
        g.textAlign = 'left'; g.fillStyle = '#8a8aa0'; g.fillText('VALUE', GX0 - 26, GY0 - 8); g.fillText('SPEED', GX0 - 26, SY0 + 10);
        g.fillStyle = '#1e1e28'; g.fillRect(GX0 - 30, SY0 - 6, GX1 - GX0 + 44, 1);
        const rev = EX.clamp01((L.t - sw) / 0.5), revE = ease.inOut(rev);
        if (prev && rev < 1) { g.globalAlpha = 1 - rev; curve(prev.ks, prev.fac, '#ff5a36', 2.5); g.globalAlpha = 1; }
        g.save(); g.beginPath(); g.rect(0, 0, lerp(GX0 - 30, W, revE), H); g.clip();
        curve(keys, fac, C.coral, 3);
        for (const h of handlePts(keys, fac)) { const on = hover && hover.i === h.i && hover.side === h.side; g.strokeStyle = 'rgba(244,239,230,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(h.kx, h.ky); g.lineTo(h.x, h.y); g.stroke(); g.fillStyle = on ? C.cyan : C.amber; g.beginPath(); g.arc(h.x, h.y, on ? 6 : 4.5, 0, TAU); g.fill(); }
        for (const a of keys) { g.save(); g.translate(X(a.t), Y(a.v)); g.rotate(Math.PI / 4); g.fillStyle = C.cream; g.fillRect(-5, -5, 10, 10); g.restore(); }
        for (let i = 0; i < 97; i++) vals[i] = value(keys, i / 2, fac);
        let mx = 4; for (let i = 0; i < 97; i++) { spd[i] = Math.abs(vals[Math.min(96, i + 1)] - vals[Math.max(0, i - 1)]) / (i > 0 && i < 96 ? 1 : 0.5); mx = Math.max(mx, spd[i]); }
        g.beginPath(); g.moveTo(X(0), SY1);
        for (let i = 0; i < 97; i++) g.lineTo(X(i / 2), SY1 - spd[i] / mx * (SY1 - SY0 - 4));
        g.lineTo(X(N), SY1); g.closePath(); g.fillStyle = 'rgba(43,196,230,0.22)'; g.fill(); g.strokeStyle = C.cyan; g.lineWidth = 1.5; g.stroke();
        g.restore();
        const v = value(keys, f, fac), px = X(f), py = Y(v);
        g.fillStyle = C.cyan; g.fillRect(px - 1, GY0 - 22, 2, SY1 - GY0 + 22); g.fillRect(px - 15, SY1 + 2, 30, 16);
        g.fillStyle = '#101017'; g.font = '700 11px Cascadia Mono, Consolas'; g.textAlign = 'center'; g.fillText(String(Math.round(f)), px, SY1 + 14);
        g.setLineDash([3, 4]); g.strokeStyle = 'rgba(255,90,54,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, py); g.lineTo(BX - 26, py); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, 5, 0, TAU); g.fill();
        g.fillStyle = '#17171f'; g.fillRect(BX - 40, GY0 - 22, 80, SY1 - GY0 + 30);
        g.fillStyle = '#2c2c3a'; g.fillRect(BX - 1, Y(125), 2, Y(-25) - Y(125));
        for (let fr = 0; fr <= N; fr += 2) { const y = Y(vals[fr * 2]); g.fillStyle = fr <= f ? 'rgba(255,176,32,0.9)' : 'rgba(244,239,230,0.25)'; g.fillRect(BX - 24, y - 0.75, 12, 1.5); }
        const sp = Math.abs(value(keys, Math.min(N, f + 0.5), fac) - value(keys, Math.max(0, f - 0.5), fac)), st = 1 + Math.min(0.55, sp * 0.035);
        g.save(); g.translate(BX + 6, py); g.scale(1 / st, st); g.fillStyle = C.coral; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(-4, -4, 4, 0, TAU); g.fill(); g.restore();
        g.textAlign = 'left'; g.font = '700 15px Bahnschrift'; g.fillStyle = C.cream; g.fillText(name.toUpperCase(), GX0 - 26, 22);
        g.font = '11px Cascadia Mono, Consolas'; g.fillStyle = '#8a8aa0'; g.fillText('frame ' + String(Math.round(f)).padStart(2, '0') + ' / ' + N + '   value ' + v.toFixed(1) + '   influence ' + L.p.infl + '%', GX0 + 90, 22);
        g.textAlign = 'center'; g.fillText(L.auto ? 'auto' : 'drag handles', BX, SY1 + 14);
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-colorcycle', title: 'Palette color cycling', aka: 'color cycling, palette rotation, indexed color, Mark Ferrari style pixel art', tool: 'Canvas 2D (indexed pixels + rotating palette)', runs: 'CPU',
    notice: 'Every pixel here is a number, not a color, and nothing in the picture ever moves. Only the palette rotates: the waterfall, the spray, the glints on the lake and the stars are runs of palette entries that shift by one step at a time, so the bands seem to flow. This is how 8-bit and 16-bit games animated water with almost no memory. Show the palette to watch the ranges turn.',
    use: 'retro and pixel-art loops, game backgrounds, lightweight ambient scenes',
    params: [{ key: 'rate', label: 'Cycle speed', min: 1, max: 30, step: 1, value: 12, unit: ' steps/s' }],
    controls: [{ label: 'Scene', on: true, fn: L => { L.view = 0; } }, { label: 'Scene + palette', fn: L => { L.view = 1; } }, { label: 'Cycling off', fn: L => { L.view = 2; } }],
    prompt: 'Pixel-art waterfall at dusk in the Mark Ferrari color-cycling style: a 320x180 indexed image built procedurally (Bayer-dithered violet-to-amber sky, cliffs with pines, a waterfall, spray, a lake with glints, twinkling stars), animated only by rotating palette ranges at {rate}, waterfall fastest and lake slowest, scaled 2x with no smoothing, plus a view that shows the 128-entry palette turning.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const SW = 320, SH = 180, LIP = 64, LAKE = 130;
      const idx = new Uint8Array(SW * SH), base = new Uint8Array(256 * 3), lut = new Uint32Array(256);
      const oc = document.createElement('canvas'); oc.width = SW; oc.height = SH; const og = oc.getContext('2d');
      const img = og.createImageData(SW, SH), buf = new Uint32Array(img.data.buffer);
      const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      // Fills palette entries [at, at+n) with a gradient through the given hex stops.
      const ramp = (at, n, stops) => { const c = stops.map(hex); for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) * (c.length - 1) : 0, k = Math.min(c.length - 2, Math.floor(u)), f = u - k; for (let j = 0; j < 3; j++) base[(at + i) * 3 + j] = Math.round(lerp(c[k][j], c[k + 1] ? c[k + 1][j] : c[k][j], f)); } };
      const list = (at, hs) => hs.forEach((h, i) => { const c = hex(h); base[(at + i) * 3] = c[0]; base[(at + i) * 3 + 1] = c[1]; base[(at + i) * 3 + 2] = c[2]; });
      ramp(0, 24, ['#120b26', '#2a1648', '#5a2560', '#a8405e', '#f0744c', '#ffb867']);
      list(24, ['#150d2a', '#150d2a', '#150d2a', '#2a2048', '#150d2a', '#150d2a', '#8f86c8', '#fff6dc']);
      ramp(32, 4, ['#6c3a6a', '#4a2852']); ramp(36, 4, ['#3a1d44', '#24122e']); ramp(40, 8, ['#f0a070', '#a0505a', '#62304e', '#40203e', '#2a1530', '#1a0d22', '#120818']);
      list(48, ['#0f0a18', '#1c1028', '#ffd6a0', '#2e1a2c']);
      list(64, ['#ffffff', '#e6f8ff', '#b6e4f6', '#7cc4e8', '#4f97c9', '#3a76ad', '#4f97c9', '#7cc4e8', '#4f97c9', '#3a76ad', '#2c5e94', '#3a76ad', '#7cc4e8', '#b6e4f6', '#7cc4e8', '#4f97c9']);
      list(80, ['#9fd0ec', '#5a96c4', '#3a6aa0', '#2a5084', '#3a6aa0', '#5a96c4', '#3a6aa0', '#2a4878', '#223e6a', '#2a4878', '#3a6aa0', '#5a96c4', '#3a6aa0', '#2a5084', '#2a4878', '#3a6aa0']);
      list(96, ['#ffffff', '#f2fbff', '#d8eef8', '#b4d8ec', '#8cbcdc', '#6a9cc8', '#5a86b4', '#4e74a0', '#5a86b4', '#6a9cc8', '#8cbcdc', '#b4d8ec', '#d8eef8', '#b4d8ec', '#8cbcdc', '#6a9cc8']);
      list(112, ['#ffd6a0', '#ff9a66', '#c85a5a', '#6a2e5a', '#4a2252', '#3a1c48', '#3a1c48', '#3a1c48', '#3a1c48', '#3a1c48', '#3a1c48', '#3a1c48', '#4a2252', '#6a2e5a', '#a8405e', '#f0744c']);
      ramp(128, 16, ['#5a2560', '#3a1c48', '#24123a', '#140a24']);
      const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      const dith = (x, y) => (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const r = EX.rng(9), MX = 262, MY = 26;
      // Cliff top per column: a notch for the fall, a high left cliff, a lower right cliff that slopes down to the shore.
      const cliffTop = x => { if (Math.abs(x - 160) < 21) return LIP; if (x < 160) return LIP - 8 - noise(x * 0.05, 2.2) * 14 - Math.min(10, (139 - x) * 0.25); const tp = LIP - 4 - noise(x * 0.06, 7.7) * 10; return x < 236 ? tp : tp + Math.pow((x - 236) / 60, 1.6) * 90; };
      const fallW = y => 15 + (y - LIP) * 0.07;
      for (let y = 0; y < LAKE; y++) for (let x = 0; x < SW; x++) {
        const dd = dith(x, y); let v = Math.min(23, Math.floor(y / 116 * 23 + dd));
        const md = Math.hypot(x - MX, y - MY);
        if (md < 9) v = 50; else if (md < 24 && dd < (24 - md) / 36) v = Math.min(23, v + 3);
        const far = 100 - noise(x * 0.018, 5.1) * 40, mid = 116 - noise(x * 0.03, 8.4) * 30;
        if (y > far) v = 32 + Math.min(3, Math.floor((y - far) / 9 + dd));
        if (y > mid) v = 36 + Math.min(3, Math.floor((y - mid) / 7 + dd));
        const top = cliffTop(x);
        if (y > top) { const depth = y - top, strata = noise(x * 0.07, y * 0.4, 1.3); v = depth < 1.5 ? 40 : 42 + Math.min(5, Math.max(0, Math.floor(depth / 10 + strata * 2.4 + dd - 0.9))); if (depth < 4 && depth >= 1.5 && dd < 0.5) v = 41; }
        const wx = Math.abs(x - 160), fw = fallW(y);
        if (y >= LIP - 2 && wx < fw) {
          const s = 0.55 + noise(x * 0.5, 0.3) * 0.6, o = Math.floor(noise(x * 0.31, 4.4) * 40);
          const edge = wx > fw - 3 || (wx > fw - 6 && dd < 0.5);
          v = (edge ? 80 : 64) + (((Math.floor(y * s) - o) % 16) + 16) % 16;
          if (y < LIP + 2 && dd < 0.6) v = 96 + ((x * 3) % 16);
        }
        idx[y * SW + x] = v;
      }
      for (let k = 0; k < 110; k++) { const x = Math.floor(r() * SW), y = Math.floor(r() * 56); if (y < cliffTop(x) - 3 && Math.hypot(x - MX, y - MY) > 14) idx[y * SW + x] = 24 + Math.floor(r() * 8); }
      for (let k = 0; k < 30; k++) {
        const x0 = k % 3 ? 4 + r() * 134 : 184 + r() * 66, top = cliffTop(Math.round(x0)), h = 8 + r() * 16;
        for (let y = Math.floor(top - h); y < top + 2; y++) { const w = (y - (top - h)) / h * (2.5 + h * 0.18); for (let x = Math.floor(x0 - w); x <= x0 + w; x++) if (x >= 0 && x < SW && y >= 0 && y < LAKE && Math.abs(x - 160) > fallW(y) + 1) idx[y * SW + x] = (y * 3 + x) % 7 ? 48 : 49; }
      }
      for (let y = LAKE; y < SH; y++) for (let x = 0; x < SW; x++) {
        const ry = y - LAKE, dd = dith(x, y), my = LAKE - 1 - Math.floor(ry * 1.4); let v = 128 + Math.min(15, Math.floor(ry / 50 * 15 + dd));
        if (my >= 0 && dd < 0.5 - ry * 0.004) v = idx[my * SW + x];
        const row = Math.floor(ry / 3), len = 5 + (row * 7) % 8, ph = Math.floor(noise(row * 0.7, 3.1) * 48);
        if (ry % 3 === 1 && noise(x * 0.05, row * 0.5, 6.6) > 0.6 - ry * 0.002) v = 112 + (((Math.floor((x + ph) / len * 2.2)) % 16) + 16) % 16;
        if (Math.abs(x - MX) < 13 - ry * 0.12 && ry % 2 === 0 && dd < 0.7) v = 112 + ((Math.floor(x / 3) + ry) % 3);
        idx[y * SW + x] = v;
      }
      for (const [rx, rw] of [[120, 9], [204, 7], [62, 5]]) for (let y = LAKE - 3; y < LAKE + 5; y++) for (let x = rx - rw; x <= rx + rw; x++) { const e = Math.pow((x - rx) / rw, 2) + Math.pow((y - LAKE) / 4, 2); if (e < 1) idx[y * SW + x] = y < LAKE - 1 && x < rx ? 41 : 48; }
      for (let y = LAKE - 26; y < LAKE + 12; y++) for (let x = 104; x < 216; x++) {
        const d = Math.hypot(x - 160, (y - LAKE + 2) * 2.2), n = noise(x * 0.15, y * 0.22, 2.8), dens = n * 0.9 + (1 - d / 56) - 0.95;
        if (dens > 0 && dith(x, y) < dens * 4) idx[y * SW + x] = 96 + Math.floor(d * 0.6 + n * 5) % 16;
      }
      const RANGES = /** @type {[number, number, number, string][]} */ ([[24, 8, 0.35, 'stars'], [64, 16, 1.5, 'waterfall'], [80, 16, 1.5, 'edge'], [96, 16, 1, 'spray'], [112, 16, 0.55, 'lake']]);
      let acc = 0;
      return (t, dt) => {
        const view = L.view || 0; if (view !== 2) acc += dt * L.p.rate;
        for (let i = 0; i < 256; i++) lut[i] = 0xff000000 | (base[i * 3 + 2] << 16) | (base[i * 3 + 1] << 8) | base[i * 3];
        for (const [at, n, sp] of RANGES) { const sh = Math.floor(acc * sp) % n; for (let i = 0; i < n; i++) { const j = at + (((i - sh) % n) + n) % n; lut[at + i] = 0xff000000 | (base[j * 3 + 2] << 16) | (base[j * 3 + 1] << 8) | base[j * 3]; } }
        for (let i = 0; i < SW * SH; i++) buf[i] = lut[idx[i]];
        og.putImageData(img, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(oc, 0, 0, W, H);
        if (view === 1) {
          g.fillStyle = 'rgba(11,11,16,0.86)'; g.fillRect(0, 296, W, 64);
          const cw = 4, x0 = 88, px = i => i < 52 ? x0 + i * cw : x0 + 52 * cw + 10 + (i - 64) * cw;
          for (let i = 0; i < 144; i++) { if (i >= 52 && i < 64) continue; const c = lut[i]; g.fillStyle = `rgb(${c & 255},${(c >> 8) & 255},${(c >> 16) & 255})`; g.fillRect(px(i), 322, cw, 18); }
          g.font = '10px Cascadia Mono, Consolas'; g.textAlign = 'left';
          for (const [at, n, , lab] of RANGES) { const x = px(at); g.fillStyle = C.amber; g.fillRect(x, 318, n * cw - 1, 2); g.fillRect(x, 341, n * cw - 1, 2); g.fillText(String(lab), x, 312); }
          g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText('fixed: sky, hills, rock', x0, 354); g.fillText('PALETTE', 16, 335);
        }
        if (view === 2) { g.font = '700 13px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(11,11,16,0.7)'; g.fillRect(16, 16, 214, 26); g.fillStyle = C.cream; g.fillText('palette frozen: a still image', 26, 34); }
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-chartmorph', title: 'Chart morph', aka: 'data morph, chart transition, shape interpolation, animated infographic', tool: 'Canvas 2D (shapes resampled to matching outlines)', runs: 'CPU',
    notice: 'One dataset turns into a pie, a donut, a stacked bar, a bar chart and a line chart. Every shape is redrawn as a closed outline of 96 points built from four sides, so the outer arc of a slice always becomes the top of its bar and the points can simply slide to their new places. Items move one after another, and the labels count between percent and absolute values.',
    use: 'data stories, report and dashboard intros, explainer videos, annual reviews',
    params: [{ key: 'dur', label: 'Morph time', min: 0.3, max: 2, step: 0.05, value: 0.9, unit: ' s' }, { key: 'stg', label: 'Stagger', min: 0, max: 0.25, step: 0.01, value: 0.07, unit: ' s' }],
    prompt: 'Animated infographic of one dataset (energy mix: six sources in percent and TWh) that morphs pie > donut > stacked bar > bar chart > line chart and back in a seamless loop: each shape resampled to the same number of outline points so slices unroll into bars, {dur} per morph with ease-in-out, {stg} stagger between items, value labels ride along and count between percent and TWh, axes fade in only for bars and line, dark background with amber, cyan, violet, green and coral.',
    setup(cv, L) {
      const g = cv.getContext('2d');
      const DATA = [['Solar', 31, C.amber], ['Wind', 24, C.cyan], ['Hydro', 17, C.violet], ['Nuclear', 13, C.green], ['Gas', 9, C.coral], ['Coal', 6, '#8c8798']];
      const M = DATA.length, NS = 24, N = NS * 4, CX = 320, CY = 192, TOTAL = 4200;
      const FORMS = ['Pie', 'Donut', 'Bars', 'Line', 'Stacked bar'], PCT = [1, 1, 0, 0, 1], LIN = 3;
      // Closed outline of N points from four sides; side(k, u) returns the point at u in [0,1) along side k.
      const outline = side => { const a = new Float32Array(N * 2); for (let k = 0; k < 4; k++) for (let j = 0; j < NS; j++) { const [x, y] = side(k, j / NS); a[(k * NS + j) * 2] = x; a[(k * NS + j) * 2 + 1] = y; } return a; };
      const sector = (cx, cy, r0, r1, a0, a1) => outline((k, u) => { const [a, r] = k === 0 ? [lerp(a0, a1, u), r1] : k === 1 ? [a1, lerp(r1, r0, u)] : k === 2 ? [lerp(a1, a0, u), r0] : [a0, lerp(r0, r1, u)]; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
      const rect = (x0, y0, x1, y1) => outline((k, u) => k === 0 ? [lerp(x0, x1, u), y0] : k === 1 ? [x1, lerp(y0, y1, u)] : k === 2 ? [lerp(x1, x0, u), y1] : [x0, lerp(y1, y0, u)]);
      const band = (px, py, qx, qy, w) => { const l = Math.hypot(qx - px, qy - py), nx = (qy - py) / l * w, ny = -(qx - px) / l * w; return outline((k, u) => k === 0 ? [lerp(px, qx, u) + nx, lerp(py, qy, u) + ny] : k === 1 ? [qx + lerp(nx, -nx, u), qy + lerp(ny, -ny, u)] : k === 2 ? [lerp(qx, px, u) - nx, lerp(qy, py, u) - ny] : [px + lerp(-nx, nx, u), py + lerp(-ny, ny, u)]); };
      const BASE = 300, bx = i => 120 + i * 80, bh = v => v / 31 * 190;
      const forms = [[], [], [], [], []];
      let a = -Math.PI / 2, sx = 64;
      for (let i = 0; i < M; i++) {
        const v = DATA[i][1], da = v / 100 * TAU, mid = a + da / 2, w = v / 100 * 512, x = bx(i), h = bh(v);
        const polar = r => [CX + Math.cos(mid) * r, CY + Math.sin(mid) * r];
        forms[0].push([sector(CX, CY, 0, 128, a, a + da), polar(84), polar(150)]);
        forms[1].push([sector(CX, CY, 76, 128, a + 0.012, a + da - 0.012), polar(102), polar(152)]);
        forms[4].push([rect(sx + 1, 166, sx + w - 1, 218), [sx + w / 2, 192], [sx + w / 2, i % 2 ? 262 : 244]]);
        forms[2].push([rect(x - 26, BASE - h, x + 26, BASE), [x, BASE - h - 12], [x, BASE + 22]]);
        const last = i + 1 === M, nx = last ? x : bx(i + 1), ny = last ? BASE - h : BASE - bh(DATA[i + 1][1]);
        forms[3].push([last ? sector(x, BASE - h, 0, 2, -Math.PI, Math.PI) : band(x, BASE - h, nx, ny, 2), [x, BASE - h - 18], [x, BASE + 22]]);
        a += da; sx += w;
      }
      const cur = new Float32Array(N * 2);
      const fmt = (v, pct) => pct ? Math.round(v) + '%' : Math.round(v).toLocaleString('en-US');
      const mixHex = (h, k) => { const c = [1, 3, 5].map(o => parseInt(h.slice(o, o + 2), 16)); return `rgb(${c.map(x => Math.round(lerp(x, 236, k))).join(',')})`; };
      return t => {
        const dur = L.p.dur, stg = L.p.stg, hold = 1.3, per = hold + dur + stg * (M - 1) + 0.15, lt = t % (per * FORMS.length);
        const k = Math.floor(lt / per), k2 = (k + 1) % FORMS.length, local = lt - k * per;
        const P = DATA.map((_, i) => ease.inOut(EX.seg(local, hold + i * stg, hold + i * stg + dur)));
        const avg = P.reduce((s, x) => s + x, 0) / M, wOf = f => (k === f ? 1 - avg : 0) + (k2 === f ? avg : 0);
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const ax = wOf(2) + wOf(3);
        if (ax > 0.01) {
          g.globalAlpha = ax; g.font = '11px Cascadia Mono, Consolas'; g.textAlign = 'right';
          for (let q = 0; q <= 3; q++) { const y = BASE - bh(q * 10); g.fillStyle = q ? 'rgba(244,239,230,0.07)' : 'rgba(244,239,230,0.3)'; g.fillRect(70, y, 500, 1); g.fillStyle = 'rgba(244,239,230,0.35)'; g.fillText(String(q * 420), 64, y + 4); }
          g.fillText('TWh', 64, 92); g.globalAlpha = 1;
        }
        const dn = wOf(1);
        if (dn > 0.01) { g.globalAlpha = dn; g.textAlign = 'center'; g.fillStyle = C.cream; g.font = '700 30px Bahnschrift'; g.fillText(fmt(TOTAL * ease.out(dn), false), CX, CY + 6); g.font = '11px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.5)'; g.fillText('TWh in total', CX, CY + 26); g.globalAlpha = 1; }
        for (let i = 0; i < M; i++) {
          const p = P[i], A = forms[k][i][0], B = forms[k2][i][0], ln = (k === LIN ? 1 - p : 0) + (k2 === LIN ? p : 0);
          for (let j = 0; j < N * 2; j++) cur[j] = A[j] + (B[j] - A[j]) * p;
          g.fillStyle = mixHex(DATA[i][2], ln * 0.85); g.beginPath(); g.moveTo(cur[0], cur[1]); for (let j = 1; j < N; j++) g.lineTo(cur[j * 2], cur[j * 2 + 1]); g.closePath(); g.fill();
        }
        for (let i = 0; i < M; i++) {
          const p = P[i], ln = (k === LIN ? 1 - p : 0) + (k2 === LIN ? p : 0), raw = DATA[i][1];
          const [, va, na] = forms[k][i], [, vb, nb] = forms[k2][i], x = lerp(va[0], vb[0], p), y = lerp(va[1], vb[1], p) + 5;
          if (ln > 0.01) { const d = forms[LIN][i][1]; g.globalAlpha = ln; g.fillStyle = C.bg; g.beginPath(); g.arc(d[0], d[1] + 18, 7.5, 0, TAU); g.fill(); g.fillStyle = DATA[i][2]; g.beginPath(); g.arc(d[0], d[1] + 18, 5, 0, TAU); g.fill(); g.globalAlpha = 1; }
          // Same unit: the label just rides along. New unit: the old label fades, then the new one counts up from zero.
          const label = (f, v, al) => { g.globalAlpha = al; g.fillStyle = PCT[f] ? C.bg : C.cream; g.fillText(fmt(PCT[f] ? v : v * 42, !!PCT[f]), x, y); g.globalAlpha = 1; };
          g.textAlign = 'center'; g.font = '700 15px Bahnschrift';
          if (PCT[k] === PCT[k2]) label(p < 0.5 ? k : k2, raw, 1);
          else if (p < 0.4) label(k, raw, 1 - p / 0.4);
          else { const q = (p - 0.4) / 0.6; label(k2, raw * ease.out(q), Math.min(1, q * 3)); }
          g.font = '11px Segoe UI'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillText(DATA[i][0], lerp(na[0], nb[0], p), lerp(na[1], nb[1], p) + 4);
        }
        g.textAlign = 'left'; g.font = '600 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.45)'; g.fillText('ENERGY MIX 2025', 24, 30);
        const tk = ease.out(EX.seg(local, hold, hold + 0.35)), o = tk < 0.5 ? 1 - tk * 2 : tk * 2 - 1;
        g.globalAlpha = o; g.font = '700 22px Bahnschrift'; g.fillStyle = C.cream; g.fillText(FORMS[tk < 0.5 ? k : k2].toUpperCase(), 24, 56 + (1 - o) * 8 * (tk < 0.5 ? -1 : 1)); g.globalAlpha = 1;
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-opart', title: 'Op art and moire', aka: 'moire pattern, optical art, Bridget Riley, interference, vibrating lines', tool: 'Canvas 2D (difference blending, warped grids)', runs: 'CPU',
    notice: 'Four optical-art pieces in black and cream. Two sets of rings and two sunbursts overlap with difference blending, so wherever they cross the colors flip and large moving fringes appear that nobody drew. The checkerboard bends because its columns get narrower near a fold that slides, and the wavy lines shimmer because their phase drifts a little more on each line.',
    use: 'title backgrounds, music visuals, hypnotic loops, fashion and editorial motion',
    params: [{ key: 'gap', label: 'Line spacing', min: 5, max: 18, step: 0.5, value: 9, unit: ' px' }],
    controls: ['Auto', 'Rings', 'Sunbursts', 'Squares', 'Current'].map((n, i) => ({ label: n, on: i === 0, fn: L => { L.auto = i === 0; if (i) L.pick = i - 1; } })),
    prompt: 'Bridget Riley style op-art loop in cream and near-black: two sets of concentric rings {gap} apart drift around each other with difference blending so moire fringes swim between them, then two counter-rotating 120-spoke sunbursts, then a "Movement in Squares" checkerboard whose columns squeeze toward a sliding fold, then rippling parallel lines whose phase drifts per line; 5 s per piece, iris transitions between them, crisp anti-aliased lines.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const BK = '#0b0b10', CR = '#efe8dc';
      if (L.auto === undefined) L.auto = true;
      const rings = (cx, cy, gap) => { g.beginPath(); for (let r = gap / 2; r < 760; r += gap) { g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, TAU); } g.lineWidth = gap / 2; g.stroke(); };
      const burst = (cx, cy, n, rot) => { g.beginPath(); for (let k = 0; k < n; k += 2) { const a0 = rot + k / n * TAU, a1 = rot + (k + 1) / n * TAU; g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * 900, cy + Math.sin(a0) * 900); g.lineTo(cx + Math.cos(a1) * 900, cy + Math.sin(a1) * 900); g.closePath(); } g.fill(); };
      // Each piece paints the whole frame at time t.
      const PIECES = [
        t => {
          const gap = L.p.gap; g.fillStyle = BK; g.fillRect(0, 0, W, H); g.strokeStyle = CR;
          rings(320 + Math.cos(t * 0.45) * 70, 180 + Math.sin(t * 0.62) * 34, gap);
          g.globalCompositeOperation = 'difference'; rings(320 - Math.cos(t * 0.45) * 70, 180 - Math.sin(t * 0.62) * 34, gap * 1.04); g.globalCompositeOperation = 'source-over';
        },
        t => {
          g.fillStyle = BK; g.fillRect(0, 0, W, H); g.fillStyle = CR; const n = Math.round(1080 / L.p.gap / 2) * 2;
          burst(250 + Math.sin(t * 0.4) * 30, 180, n, t * 0.05);
          g.globalCompositeOperation = 'difference'; burst(390 - Math.sin(t * 0.4) * 30, 180 + Math.sin(t * 0.3) * 20, n, -t * 0.04); g.globalCompositeOperation = 'source-over';
        },
        t => {
          g.fillStyle = CR; g.fillRect(0, 0, W, H); g.fillStyle = BK;
          const rows = Math.max(6, Math.round(H / (L.p.gap * 3.6))), rh = H / rows, fold = W * (0.5 + 0.3 * Math.sin(t * 0.55)), depth = 0.8 + 0.17 * Math.sin(t * 0.8);
          for (const dir of [1, -1]) {
            let x = fold, k = 0;
            while (dir > 0 ? x < W : x > 0) {
              const w = rh * Math.max(0.035, 1 - depth * Math.exp(-k * 0.2)), x2 = x + dir * w;
              for (let r = 0; r < rows; r++) if ((k + r + (dir < 0 ? 1 : 0)) % 2 === 0) g.fillRect(Math.min(x, x2), r * rh, Math.abs(w) + 0.4, rh + 0.4);
              x = x2; k++;
            }
          }
        },
        t => {
          g.fillStyle = CR; g.fillRect(0, 0, W, H); g.strokeStyle = BK; const gap = L.p.gap; g.lineWidth = gap * 0.42; g.lineJoin = 'round';
          for (let y = -gap; y < H + gap; y += gap) {
            g.beginPath();
            for (let x = 0; x <= W; x += 4) { const u = x / W, amp = gap * (0.15 + 1.1 * u * u), ph = x * (0.03 + 0.05 * u) - t * 2.2 + y * 0.045; const yy = y + Math.sin(ph) * amp; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
            g.stroke();
          }
        },
      ];
      let cur = 0, prev = 0, sw = -9;
      return t => {
        let want = cur;
        if (L.pick !== undefined && L.pick !== null) { want = L.pick; L.pick = null; }
        else if (L.auto) want = Math.floor(t / 5) % PIECES.length;
        if (want !== cur) { prev = cur; cur = want; sw = t; }
        const k = ease.inOut(EX.clamp01((t - sw) / 0.9));
        if (k < 1) { PIECES[prev](t); g.save(); g.beginPath(); g.arc(320, 180, k * 370, 0, TAU); g.clip(); PIECES[cur](t); g.restore(); g.strokeStyle = C.coral; g.lineWidth = 3; g.beginPath(); g.arc(320, 180, k * 370, 0, TAU); g.stroke(); }
        else PIECES[cur](t);
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-cutout', title: 'Paper cut-out stop motion', aka: 'cut-out animation, on twos, stepped animation, papercraft, boil', tool: 'Canvas 2D (stepped time + cached frames + drop shadows)', runs: 'CPU',
    notice: 'Torn paper layers with soft drop shadows, animated the way stop motion is shot: time is rounded down to whole drawings, so the picture only changes every few frames and each piece lands a hair off its last spot (the boil). The film strip counts 24 frames per second and lights the frames that get a new drawing. On ones is smooth, on twos is the classic hand-made rhythm, on fours feels like puppets.',
    use: 'handmade and crafty brand pieces, kids content, editorial illustration, making digital motion feel tactile',
    params: [{ key: 'step', label: 'Frames per drawing', min: 1, max: 4, step: 1, value: 2 }, { key: 'boil', label: 'Boil', min: 0, max: 3, step: 0.1, value: 1, unit: ' px' }],
    prompt: 'Stop-motion paper cut-out loop: a coral paper boat with cream sails rocks on three layers of torn-paper waves, an island with a blinking lighthouse, drifting paper clouds, a sun with turning rays and a violet bird flapping across, each layer with a white torn edge, soft drop shadow and paper grain; animated at 24 fps with a new drawing every {step} frames and {boil} of random placement boil per drawing, plus a small film strip that marks which frames get a new drawing.',
    setup(cv, L) {
      const g = cv.getContext('2d');
      const oc = document.createElement('canvas'); oc.width = W; oc.height = H; const o = oc.getContext('2d');
      const grain = document.createElement('canvas'); grain.width = W; grain.height = H;
      { const q = grain.getContext('2d'), r = EX.rng(4); q.fillStyle = '#fff'; q.fillRect(0, 0, W, H);
        for (let i = 0; i < 9000; i++) { q.fillStyle = `rgba(90,60,30,${0.03 + r() * 0.07})`; q.fillRect(r() * W, r() * H, 1 + r() * 1.5, 1); }
        q.lineWidth = 0.6; for (let i = 0; i < 600; i++) { const x = r() * W, y = r() * H, a = r() * TAU, l = 4 + r() * 10; q.strokeStyle = `rgba(110,80,50,${0.05 + r() * 0.06})`; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); q.stroke(); } }
      const shadow = on => { o.shadowColor = on ? 'rgba(60,30,10,0.32)' : 'transparent'; o.shadowBlur = on ? 9 : 0; o.shadowOffsetX = on ? 2 : 0; o.shadowOffsetY = on ? 4 : 0; };
      // Draws one paper piece: a white torn rim with a shadow, then the colored sheet. path(grow) traces the outline.
      const paper = (path, col, rim = true) => { if (rim) { shadow(true); o.fillStyle = '#fffaf0'; o.beginPath(); path(1); o.fill(); shadow(false); } else shadow(true); o.fillStyle = col; o.beginPath(); path(0); o.fill(); shadow(false); };
      let n = 0, rnd = EX.rng(1);
      // Boil: each piece lands slightly off on every new drawing.
      const boil = (id, cx, cy, draw) => { rnd = EX.rng(n * 131 + id * 977 + 7); const b = L.p.boil; o.save(); o.translate(cx + (rnd() - 0.5) * 2 * b, cy + (rnd() - 0.5) * 2 * b); o.rotate((rnd() - 0.5) * 0.01 * b); o.translate(-cx, -cy); draw(); o.restore(); };
      const waveY = (x, base, amp, k, ph) => base + amp * Math.sin(x * k + ph);
      const wave = (id, base, amp, k, ph, col) => boil(id, W / 2, base, () => paper(gr => { o.moveTo(-20, H + 10); for (let x = -20; x <= W + 20; x += 5) o.lineTo(x, waveY(x, base, amp, k, ph) + (noise(x * 0.21, id) - 0.5) * 2.6 - gr * (2 + noise(x * 0.6, id + 3) * 2.5)); o.lineTo(W + 20, H + 10); o.closePath(); }, col));
      const blob = (pts, gr) => { for (const [x, y, r] of pts) { o.moveTo(x + r + gr * 2, y); o.arc(x, y, r + gr * 2, 0, TAU); } };
      function render(tq) {
        o.fillStyle = '#f2e4cb'; o.fillRect(0, 0, W, H);
        const sy = 92 + Math.sin(tq * 1.3) * 5;
        boil(1, 520, sy, () => {
          paper(gr => { for (let i = 0; i < 12; i++) { const a = tq * 0.35 + i / 12 * TAU, b = 0.13; o.moveTo(520 + Math.cos(a - b) * (40 - gr), sy + Math.sin(a - b) * (40 - gr)); o.lineTo(520 + Math.cos(a) * (62 + gr * 2), sy + Math.sin(a) * (62 + gr * 2)); o.lineTo(520 + Math.cos(a + b) * (40 - gr), sy + Math.sin(a + b) * (40 - gr)); o.closePath(); } }, '#ff8c2a');
          paper(gr => { o.arc(520, sy, 36 + gr * 2, 0, TAU); }, C.amber);
        });
        [[0, 150, 70, 1], [1, 420, 52, 0.8], [2, 640, 104, 1.1]].forEach(([i, x0, y0, s]) => {
          const x = ((x0 - tq * 14 * s) % 760 + 760) % 760 - 60;
          boil(10 + i, x, y0, () => paper(gr => blob([[x - 28 * s, y0 + 6, 16 * s], [x - 6 * s, y0 - 8, 22 * s], [x + 20 * s, y0, 17 * s], [x + 2 * s, y0 + 10, 16 * s]], gr), '#fffdf8', false));
        });
        boil(20, 120, 214, () => {
          paper(gr => { o.moveTo(10, 232); o.quadraticCurveTo(70, 168 - gr * 3, 150, 186 - gr * 2); o.quadraticCurveTo(210, 196 - gr * 2, 240, 232); o.closePath(); }, '#6fae8f');
          paper(gr => { o.rect(96 - gr, 128 - gr, 16 + gr * 2, 54 + gr); }, '#fffaf0', false);
          o.fillStyle = C.coral; for (let k = 0; k < 3; k++) o.fillRect(96, 134 + k * 16, 16, 7);
          o.fillStyle = '#3a2e4a'; o.fillRect(93, 120, 22, 9); o.beginPath(); o.moveTo(93, 120); o.lineTo(104, 108); o.lineTo(115, 120); o.fill();
          if (n % 6 < 3) { o.fillStyle = 'rgba(255,214,120,0.9)'; o.beginPath(); o.moveTo(104, 124); o.lineTo(40, 112); o.lineTo(40, 136); o.closePath(); o.fill(); }
        });
        wave(30, 236, 6, 0.024, tq * 1.6, '#3a7fb0');
        const bx = 330 + Math.sin(tq * 0.7) * 26, by = waveY(bx, 254, 7, 0.024, tq * 1.6 + 1.2), ba = Math.atan(7 * 0.024 * Math.cos(bx * 0.024 + tq * 1.6 + 1.2)) * 0.9;
        boil(40, bx, by, () => {
          o.save(); o.translate(bx, by); o.rotate(ba);
          paper(gr => { o.moveTo(-2, -98); o.lineTo(-2, -22); o.lineTo(-44 - gr * 2, -22); o.closePath(); }, C.amber);
          paper(gr => { o.moveTo(4, -104 - gr * 2); o.lineTo(4, -22); o.lineTo(58 + gr * 2, -22); o.closePath(); }, '#fffaf0', false);
          o.fillStyle = C.coral; o.beginPath(); o.moveTo(4, -52); o.lineTo(38.3, -52); o.lineTo(44.8, -42); o.lineTo(4, -42); o.closePath(); o.fill();
          o.fillStyle = '#6b4a2e'; o.fillRect(-1, -110, 4, 92);
          const fl = n % 2 ? 6 : -4; o.fillStyle = C.coral; o.beginPath(); o.moveTo(3, -110); o.quadraticCurveTo(14, -112 + fl, 24, -106); o.lineTo(3, -100); o.closePath(); o.fill();
          paper(gr => { o.moveTo(-66 - gr * 2, -20 - gr * 2); o.lineTo(68 + gr * 2, -20 - gr * 2); o.lineTo(48, 16); o.lineTo(-48, 16); o.closePath(); }, C.coral);
          o.fillStyle = '#fffaf0'; o.fillRect(-58, -12, 116, 5);
          o.restore();
        });
        wave(50, 262, 8, 0.03, -tq * 1.9 + 2, '#5db3d8');
        const fx = ((620 - tq * 70) % 900 + 900) % 900 - 100, fy = 150 + Math.sin(tq * 2) * 12, fw = Math.sin(tq * 11);
        boil(60, fx, fy, () => paper(gr => { o.ellipse(fx, fy, 15 + gr, 7 + gr, -0.1, 0, TAU); o.moveTo(fx - 13, fy - 2); o.lineTo(fx - 26 - gr, fy - 9); o.lineTo(fx - 24, fy + 3); o.closePath(); o.moveTo(fx - 4, fy); o.lineTo(fx + 8, fy - 30 * fw - gr); o.lineTo(fx + 10, fy); o.closePath(); o.moveTo(fx + 13, fy - 4); o.lineTo(fx + 22 + gr, fy - 1); o.lineTo(fx + 13, fy + 2); o.closePath(); }, C.violet));
        wave(70, 300, 9, 0.022, tq * 2.3 + 4, '#1f4f86');
        o.globalCompositeOperation = 'multiply'; o.drawImage(grain, 0, 0); o.globalCompositeOperation = 'source-over';
      }
      let key = '';
      const NAMES = ['ONES', 'TWOS', 'THREES', 'FOURS'];
      return t => {
        const st = L.p.step; n = Math.floor(t * 24 / st); const k2 = n + '|' + st + '|' + L.p.boil;
        if (k2 !== key) { key = k2; render(n * st / 24); }
        g.drawImage(oc, 0, 0);
        const f = Math.floor(t * 24) % 24, x0 = 152, cw = 16;
        g.fillStyle = 'rgba(11,11,16,0.78)'; g.fillRect(0, 330, W, 30);
        g.font = '700 12px Cascadia Mono, Consolas'; g.textAlign = 'left'; g.fillStyle = C.cream; g.fillText('ON ' + NAMES[st - 1], 14, 349);
        for (let i = 0; i < 24; i++) { const x = x0 + i * cw, fresh = i % st === 0; g.fillStyle = fresh ? C.amber : 'rgba(244,239,230,0.16)'; g.fillRect(x, 337, cw - 3, 16); if (i === f) { g.strokeStyle = C.coral; g.lineWidth = 2; g.strokeRect(x - 1, 336, cw - 1, 18); } }
        g.font = '11px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.65)'; g.fillText('24 fps', 104, 349); g.textAlign = 'right'; g.fillText(Math.round(24 / st) + ' drawings/s', 628, 349); g.textAlign = 'left';
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-smear', title: 'Smear frames', aka: 'smears, multiples, motion blur, fast action in 2D animation', tool: 'Canvas 2D (stepped frames + tapered smear shapes)', runs: 'CPU',
    notice: 'A fast move only lasts three or four frames, so drawn one sharp pose at a time it strobes. Animators fix this in the drawing itself: a smear stretches the shape back to where it was on the last frame, multiples draw extra copies along the path, and motion blur averages many in-between poses. Here the time is cut into real frames and only the frames that move far get the effect.',
    use: 'snappy character animation, logo and icon hits, cartoon-style action, fixing strobing at low frame rates',
    params: [{ key: 'fps', label: 'Frame rate', min: 8, max: 30, step: 1, value: 24, unit: ' fps' }],
    controls: ['Auto', 'Plain', 'Motion blur', 'Smear', 'Multiples'].map((n, i) => ({ label: n, on: i === 0, fn: L => { L.auto = i === 0; if (i) L.mode = i - 1; } })),
    prompt: 'Cartoon action study at {fps}: a round amber bean character with a coral scarf anticipates, zips across the floor in four frames, overshoots and settles, then jumps back in a fast arc and lands with squash; show the same move four ways (plain frames that strobe, motion blur from sub-frame samples, a tapered smear from the last position to the new one with speed lines, and multiples), label each mode and the pixels moved per frame.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const FLOOR = 290, LOOP = 3.2;
      const MODES = [['PLAIN', 'one sharp pose per frame: fast moves strobe'], ['MOTION BLUR', 'average many poses inside the shutter'], ['SMEAR', 'stretch the shape back to where it was last frame'], ['MULTIPLES', 'draw extra copies along the path']];
      const ORDER = [2, 0, 1, 3];
      if (L.auto === undefined) L.auto = true;
      const seg = EX.seg;
      // Pose of the bean at time t: feet position, squash scale and lean.
      function pose(t) {
        const lt = ((t % LOOP) + LOOP) % LOOP; let x = 110, y = 0, sx = 1, sy = 1, lean = 0;
        if (lt < 0.5) { sy = 1 + Math.sin(lt * 9) * 0.02; }
        else if (lt < 0.8) { const u = ease.inOut(seg(lt, 0.5, 0.8)); x = 110 - 18 * u; sy = 1 - 0.22 * u; sx = 1 + 0.18 * u; lean = -0.28 * u; }
        else if (lt < 0.95) { const u = seg(lt, 0.8, 0.95); x = lerp(92, 548, u * u * (2 - u)); sy = 1.12; sx = 0.9; lean = 0.3; }
        else if (lt < 1.4) { const u = seg(lt, 0.95, 1.4), d = Math.exp(-6 * u); x = 530 + 18 * d * Math.cos(u * 10); sy = 1 - 0.18 * d * Math.cos(u * 14); sx = 2 - sy; lean = 0.3 * d * Math.cos(u * 10); }
        else if (lt < 1.9) { x = 530; sy = 1 + Math.sin(lt * 9) * 0.02; }
        else if (lt < 2.1) { const u = ease.inOut(seg(lt, 1.9, 2.1)); x = 530 + 8 * u; sy = 1 - 0.25 * u; sx = 1 + 0.2 * u; lean = 0.25 * u; }
        else if (lt < 2.42) { const u = seg(lt, 2.1, 2.42); x = lerp(538, 110, ease.inOut(u)); y = -Math.sin(Math.PI * u) * 112; sy = 1.18 - 0.1 * Math.abs(u - 0.5); sx = 0.86; lean = -0.35 * Math.cos(Math.PI * u); }
        else if (lt < 2.8) { const u = seg(lt, 2.42, 2.8), d = Math.exp(-5 * u); x = 110; sy = 1 - 0.3 * d * Math.cos(u * 13); sx = 2 - sy; }
        return { x, y, sx, sy, lean };
      }
      const center = p => [p.x + Math.sin(p.lean) * 45 * p.sy, FLOOR + p.y - Math.cos(p.lean) * 45 * p.sy];
      function bean(p, dir, eyes = true, vx = 0) {
        g.save(); g.translate(p.x, FLOOR + p.y); g.rotate(p.lean); g.scale(p.sx, p.sy);
        g.fillStyle = C.amber; g.beginPath(); g.roundRect(-32, -92, 64, 92, 32); g.fill();
        g.fillStyle = '#ffc95a'; g.beginPath(); g.roundRect(-24, -84, 10, 50, 5); g.fill();
        g.fillStyle = C.coral; g.fillRect(-32, -44, 64, 11);
        const sw = Math.max(-1.2, Math.min(1.2, vx * 0.03)), tx = -dir * 28; g.beginPath(); g.moveTo(tx, -44); g.quadraticCurveTo(tx - dir * 14, -40 + sw * 6, tx - dir * 26, -36 + sw * 14); g.lineTo(tx - dir * 22, -28 + sw * 14); g.quadraticCurveTo(tx - dir * 10, -32 + sw * 4, tx, -33); g.closePath(); g.fill();
        if (eyes) { for (const ex of [-11, 11]) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex + dir * 6, -64, 7, 9, 0, 0, TAU); g.fill(); g.fillStyle = C.navy; g.beginPath(); g.arc(ex + dir * 9, -63, 3.6, 0, TAU); g.fill(); } g.strokeStyle = C.navy; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.arc(dir * 7, -54, 5, 0.3, Math.PI - 0.3); g.stroke(); }
        g.restore();
      }
      function smear(p0, p1) {
        const [x0, y0] = center(p0), [x1, y1] = center(p1), a = Math.atan2(y1 - y0, x1 - x0), r1 = 34, r0 = 5;
        const grd = g.createLinearGradient(x0, y0, x1, y1); grd.addColorStop(0, 'rgba(255,176,32,0)'); grd.addColorStop(0.35, 'rgba(255,176,32,0.85)'); grd.addColorStop(1, C.amber);
        g.fillStyle = grd; g.beginPath(); g.arc(x1, y1, r1, a - Math.PI / 2, a + Math.PI / 2); g.lineTo(x0 + Math.cos(a + Math.PI / 2) * r0, y0 + Math.sin(a + Math.PI / 2) * r0); g.arc(x0, y0, r0, a + Math.PI / 2, a + Math.PI * 1.5); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(244,239,230,0.55)'; g.lineWidth = 2; g.lineCap = 'round';
        for (const o of [-24, 4, 28]) { const nx = -Math.sin(a) * o, ny = Math.cos(a) * o, s = 0.15 + Math.abs(o) / 90; g.beginPath(); g.moveTo(lerp(x0, x1, s) + nx, lerp(y0, y1, s) + ny); g.lineTo(lerp(x0, x1, 0.62) + nx, lerp(y0, y1, 0.62) + ny); g.stroke(); }
      }
      let modeIdx = 2;
      return t => {
        const fps = L.p.fps, fi = Math.floor(t * fps), tf = fi / fps, tp = (fi - 1) / fps;
        if (L.auto) modeIdx = ORDER[Math.floor(tf / LOOP) % 4]; else if (L.mode !== undefined) modeIdx = L.mode;
        const p1 = pose(tf), p0 = pose(tp), c0 = center(p0), c1 = center(p1), D = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]), vx = p1.x - p0.x, fast = D > 22;
        if (Math.abs(vx) > 15) L.dir = Math.sign(vx); const dir = L.dir || 1;
        const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#15132a'); bg.addColorStop(1, '#0b0b10'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(244,239,230,0.12)'; g.fillRect(0, FLOOR, W, 2); for (let x = 20; x < W; x += 40) g.fillRect(x, FLOOR + 10, 14, 2);
        const sh = 1 / (1 - p1.y / 200); g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(p1.x, FLOOR + 4, 38 * sh, 7 * sh, 0, 0, TAU); g.fill();
        if (modeIdx === 1) { for (let i = 0; i < 12; i++) { g.globalAlpha = 0.2; bean(pose(tf - (i / 11) * 0.5 / fps), dir, true, vx); } g.globalAlpha = 1; bean(p1, dir, true, vx); }
        else if (modeIdx === 2 && fast) { smear(p0, p1); bean(p1, dir, true, vx); }
        else if (modeIdx === 3 && fast) { for (let k = 1; k <= 3; k++) { const u = k / 4, q = { x: lerp(p0.x, p1.x, u), y: lerp(p0.y, p1.y, u), sx: p1.sx, sy: p1.sy, lean: p1.lean }; bean(q, dir, k === 3, vx); } bean(p1, dir, true, vx); }
        else bean(p1, dir, true, vx);
        const [mn, md] = MODES[modeIdx];
        g.textAlign = 'left'; g.font = '700 22px Bahnschrift'; g.fillStyle = C.cream; g.fillText(mn, 24, 42);
        g.font = '12px Segoe UI'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillText(md, 24, 62);
        g.textAlign = 'right'; g.font = '12px Cascadia Mono, Consolas'; g.fillStyle = fast ? C.coral : 'rgba(244,239,230,0.5)'; g.fillText(`${fps} fps  frame ${String(fi % Math.round(LOOP * fps)).padStart(2, '0')}  moved ${Math.round(D)} px`, 616, 42);
        g.textAlign = 'left';
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-halftone', title: 'Halftone print look', aka: 'Ben-Day dots, CMYK halftone, rosette, pop art, comic print', tool: 'GLSL fragment shader (four rotated dot screens)', runs: 'GPU',
    notice: 'The picture is printed the way comics and posters are: four inks, cyan, magenta, yellow and black, each laid down as a grid of dots turned to its own angle (15, 75, 0 and 45 degrees). A dot grows where its ink is darker, and the overlapping grids form small rosettes, which the loupe shows three times larger. As the light circles the planet, only the dot sizes change.',
    use: 'pop-art and comic styles, retro posters, editorial motion, print-texture overlays',
    params: [{ key: 'dot', label: 'Dot spacing', min: 4, max: 16, step: 0.5, value: 7, unit: ' px' }],
    controls: [{ label: 'Halftone', on: true, fn: L => { (L.state = L.state || { mode: 0 }).mode = 0; } }, { label: 'Separations', fn: L => { (L.state = L.state || { mode: 0 }).mode = 2; } }, { label: 'Continuous tone', fn: L => { (L.state = L.state || { mode: 0 }).mode = 1; } }],
    prompt: 'Pop-art comic panel as a GLSL halftone shader: a banded ringed planet over an orange sunburst on yellow paper, thick black ink outlines, printed as four CMYK dot screens at 15, 75, 0 and 45 degrees with {dot} spacing so rosettes appear, dot size follows a light that circles the planet, a 3x loupe shows the dots, plus a view with the four separations side by side.',
    setup(cv, L) {
      const G = EX.G; const ctx = cv.getContext('2d');
      if (!G.gl) { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); return () => {}; }
      const st = (L.state = L.state || { mode: 0 }); if (st.mode === undefined) st.mode = 0;
      const prog = G.prog(`uniform float uDot, uMode;
const vec2 PC = vec2(250., 186.); const float PR = 104.;
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
// CMYK coverage of the artwork at pixel p (y up).
vec4 art(vec2 p){
  vec2 d = p - PC; float ang = atan(d.y, d.x) + uT * .06;
  float ray = step(.5, fract(ang / 6.28318 * 18.));
  vec4 col = vec4(0., mix(.12, .58, ray) * (1. - length(d) / 900.), .9, 0.);
  vec2 q = rot(.32) * d; float e = length(vec2(q.x, q.y / .27)) / PR;
  bool ring = e > 1.32 && e < 1.95, back = q.y > 0.;
  vec4 rc = vec4(.04, .32 + .34 * (.5 + .5 * sin(e * 42.)), .95, .06);
  if (ring && back) col = rc;
  float r2 = dot(d, d) / (PR * PR);
  if (r2 < 1.) {
    vec3 n = vec3(d / PR, sqrt(1. - r2));
    vec3 Ld = normalize(vec3(cos(uT * .45) * .95, .45, .5 + .5 * sin(uT * .45)));
    float lam = max(0., dot(n, Ld)), lon = atan(n.x, n.z) + uT * .25;
    float band = .5 + .5 * sin(n.y * 15. + sin(lon * 3.) * .7);
    col = mix(vec4(.9, .12, 0., 0.), vec4(.7, .75, 0., 0.), band * band);
    col.w = clamp((1. - lam) * 1.1 - .12, 0., .92);
  }
  if (ring && !back) col = rc;
  return col;
}
float inkLines(vec2 p){
  vec2 d = p - PC; float r = length(d) / PR;
  vec2 q = rot(.32) * d; float e = length(vec2(q.x, q.y / .27)) / PR; bool back = q.y > 0.;
  bool frontRing = !back && e > 1.32 && e < 1.95;
  float w = frontRing ? 0. : 1. - smoothstep(1.4, 2.4, abs(r - 1.) / fwidth(r));
  float le = max(1. - smoothstep(1.2, 2.2, abs(e - 1.32) / fwidth(e)), 1. - smoothstep(1.2, 2.2, abs(e - 1.95) / fwidth(e)));
  if (!(back && r < 1.)) w = max(w, le);
  return w;
}
float dotc(vec2 p, float a, float s, int ch){
  vec2 q = rot(a) * p / s, cell = floor(q) + .5;
  float c = clamp(art(rot(-a) * cell * s)[ch], 0., 1.), rad = sqrt(c) * .62, aa = .8 / s;
  return 1. - smoothstep(rad - aa, rad + aa, length(q - cell));
}
void main(){
  vec2 p = vUv * uRes, LC = vec2(540., 96.); float LR = uMode == 0. ? 74. : -9., dl = length(p - LC);
  vec2 sp = dl < LR ? vec2(318., 232.) + (p - LC) / 3.2 : p, qd = floor(p / vec2(320., 180.));
  float k = qd.x + (1. - qd.y) * 2.;
  if (uMode == 2.) sp = (p - qd * vec2(320., 180.)) * 2.;
  vec4 v = art(sp); float dc = v.x, dm = v.y, dy = v.z, dk = v.w;
  if (uMode != 1.) { dc = dotc(sp, .2618, uDot, 0); dm = dotc(sp, 1.309, uDot, 1); dy = dotc(sp, 0., uDot, 2); dk = dotc(sp, .7854, uDot, 3); }
  if (uMode == 2.) { dk = max(dk, inkLines(sp)); dc *= float(k == 0.); dm *= float(k == 1.); dy *= float(k == 2.); dk *= float(k == 3.); }
  vec3 col = vec3(.99, .96, .9) * mix(vec3(1.), vec3(0., .63, .89), dc) * mix(vec3(1.), vec3(.92, .1, .5), dm) * mix(vec3(1.), vec3(1., .9, .05), dy) * (1. - dk * .92);
  if (uMode != 2.) col *= 1. - inkLines(sp) * .95;
  if (uMode == 2.) col *= 1. - .85 * float(abs(p.x - 320.) < 1.5 || abs(p.y - 180.) < 1.5);
  else col = mix(col, vec3(.07, .06, .1), smoothstep(LR - 1., LR + 1., dl) * (1. - smoothstep(LR + 4., LR + 6., dl)));
  o = vec4(col, 1.);
}`);
      const TAGS = [['CYAN', '15'], ['MAGENTA', '75'], ['YELLOW', '0'], ['BLACK', '45']];
      return t => {
        G.draw(prog, null, { uT: t, uDot: L.p.dot, uMode: st.mode }, W, H); G.copy(ctx, W, H);
        ctx.font = '700 11px Cascadia Mono, Consolas'; ctx.textAlign = 'left';
        const tag = (x, y, s) => { const w = ctx.measureText(s).width + 14; ctx.fillStyle = 'rgba(18,16,26,0.86)'; ctx.fillRect(x, y - 13, w, 19); ctx.fillStyle = C.cream; ctx.fillText(s, x + 7, y); };
        if (st.mode === 2) TAGS.forEach(([n, a], i) => tag((i % 2) * 320 + 10, (i >> 1) * 180 + 24, n + ' ' + a + ' deg'));
        else { tag(14, 344, st.mode === 1 ? 'CONTINUOUS TONE' : 'CMYK  C15 M75 Y0 K45'); if (!st.mode) tag(498, 180, 'LOUPE 3.2x'); }
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-puppet', title: 'Puppet pins (mesh warp)', aka: 'puppet tool, puppet warp, mesh deformation, moving least squares', tool: 'Canvas 2D (rigid MLS deformation + textured triangles)', runs: 'CPU',
    notice: 'A flat drawing gets a triangle mesh and seven pins, like the Puppet tool in After Effects. Only the yellow pins are animated; the gray ones hold the pot. Every mesh point then finds the rotation and offset that best follow the pins near it (rigid moving least squares), so the cactus bends without stretching its face, and each triangle of the drawing is redrawn onto its moved triangle. Drag a pin to pose it yourself.',
    use: 'animating flat illustrations and logos without rigging, mascots, wobbly organic motion',
    params: [{ key: 'amt', label: 'Dance amount', min: 0, max: 1.6, step: 0.05, value: 1 }, { key: 'alpha', label: 'Pin falloff', min: 0.5, max: 2.5, step: 0.05, value: 1.2 }],
    controls: [{ label: 'Character', on: true, fn: L => { L.mesh = false; } }, { label: 'Show mesh', fn: L => { L.mesh = true; } }],
    prompt: 'Puppet-pin animation of a flat cactus character in a terracotta pot: a 12x17 triangle mesh over the drawing, seven pins (three fixed on the pot, body, head and both arm tips) keyframed to a 120 BPM two-step with a squash on every beat, the mesh deformed with rigid moving least squares (falloff {alpha}, dance amount {amt}) so the face stays undistorted, each triangle texture-mapped with an affine transform, spotlight on a dark stage, a toggle shows the mesh and the pins can be dragged.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const TW = 240, TH = 340, OX = 320 - TW / 2, OY = 350 - TH, CS = 20, NX = TW / CS, NY = TH / CS;
      const tex = document.createElement('canvas'); tex.width = TW; tex.height = TH; const t2 = tex.getContext('2d');
      t2.lineCap = 'round'; t2.lineJoin = 'round';
      t2.strokeStyle = '#4fbf7c'; t2.lineWidth = 34; t2.beginPath(); t2.moveTo(84, 182); t2.lineTo(44, 182); t2.quadraticCurveTo(28, 182, 28, 164); t2.lineTo(28, 108); t2.moveTo(156, 160); t2.lineTo(196, 160); t2.quadraticCurveTo(212, 160, 212, 142); t2.lineTo(212, 90); t2.stroke();
      t2.fillStyle = '#5fd38d'; t2.beginPath(); t2.roundRect(70, 66, 100, 214, 50); t2.fill();
      t2.strokeStyle = 'rgba(30,110,70,0.45)'; t2.lineWidth = 3; for (const x of [92, 120, 148]) { t2.beginPath(); t2.moveTo(x, 96); t2.lineTo(x, 262); t2.stroke(); }
      t2.strokeStyle = 'rgba(30,110,70,0.35)'; t2.beginPath(); t2.moveTo(28, 122); t2.lineTo(28, 166); t2.moveTo(212, 104); t2.lineTo(212, 146); t2.stroke();
      t2.strokeStyle = '#f4efe6'; t2.lineWidth = 1.6; const r = EX.rng(5);
      for (let i = 0; i < 40; i++) { const x = 80 + r() * 80, y = 96 + r() * 170; t2.beginPath(); t2.moveTo(x, y); t2.lineTo(x + 3, y - 3); t2.moveTo(x, y); t2.lineTo(x - 3, y - 3); t2.stroke(); }
      t2.fillStyle = '#ffffff'; for (const ex of [104, 136]) { t2.beginPath(); t2.ellipse(ex, 132, 9, 11, 0, 0, TAU); t2.fill(); }
      t2.fillStyle = C.navy; for (const ex of [106, 138]) { t2.beginPath(); t2.arc(ex, 134, 5.5, 0, TAU); t2.fill(); }
      t2.fillStyle = 'rgba(255,120,140,0.55)'; for (const ex of [90, 150]) { t2.beginPath(); t2.ellipse(ex, 152, 9, 5, 0, 0, TAU); t2.fill(); }
      t2.strokeStyle = C.navy; t2.lineWidth = 3.5; t2.beginPath(); t2.arc(120, 150, 11, 0.25, Math.PI - 0.25); t2.stroke();
      t2.fillStyle = '#ff7aa8'; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; t2.beginPath(); t2.ellipse(120 + Math.cos(a) * 13, 60 + Math.sin(a) * 13, 11, 7, a, 0, TAU); t2.fill(); }
      t2.fillStyle = C.amber; t2.beginPath(); t2.arc(120, 60, 8, 0, TAU); t2.fill();
      t2.fillStyle = '#c8603a'; t2.beginPath(); t2.moveTo(52, 286); t2.lineTo(188, 286); t2.lineTo(172, 338); t2.lineTo(68, 338); t2.closePath(); t2.fill();
      t2.fillStyle = '#e07a4a'; t2.beginPath(); t2.roundRect(42, 266, 156, 26, 6); t2.fill();
      t2.fillStyle = 'rgba(255,255,255,0.18)'; t2.fillRect(50, 270, 140, 5);
      const alpha = t2.getImageData(0, 0, TW, TH).data;
      const cellUsed = (cx, cy) => { for (let y = cy * CS; y < (cy + 1) * CS; y += 2) for (let x = cx * CS; x < (cx + 1) * CS; x += 2) if (alpha[(y * TW + x) * 4 + 3] > 8) return true; return false; };
      const cells = []; for (let cy = 0; cy < NY; cy++) for (let cx = 0; cx < NX; cx++) if (cellUsed(cx, cy)) cells.push([cx, cy]);
      const NV = (NX + 1) * (NY + 1), vx = new Float32Array(NV), vy = new Float32Array(NV);
      const PINS = [[75, 330], [165, 330], [120, 276], [120, 200], [120, 84], [28, 104], [212, 86]], NP = PINS.length;
      const qx = new Float32Array(NP), qy = new Float32Array(NP), hold = PINS.map(() => ({ on: false, x: 0, y: 0, rel: -9 }));
      let drag = -1;
      const pos = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; };
      cv.onpointerdown = e => { const [x, y] = pos(e); for (let i = 3; i < NP; i++) if (Math.hypot(qx[i] - x, qy[i] - y) < 16) { drag = i; hold[i].on = true; hold[i].x = x; hold[i].y = y; cv.setPointerCapture(e.pointerId); break; } };
      cv.onpointermove = e => { const [x, y] = pos(e); if (drag >= 0) { hold[drag].x = x; hold[drag].y = y; } let near = false; for (let i = 3; i < NP; i++) if (Math.hypot(qx[i] - x, qy[i] - y) < 16) near = true; cv.style.cursor = drag >= 0 ? 'grabbing' : near ? 'grab' : ''; };
      cv.onpointerup = () => { if (drag >= 0) { hold[drag].on = false; hold[drag].rel = L.t; } drag = -1; };
      // Rigid moving least squares: where the rest point (x, y) goes, given pins PINS -> (qx, qy).
      function mls(x, y, a, out, k) {
        let sw = 0, px = 0, py = 0, cx = 0, cy = 0;
        for (let i = 0; i < NP; i++) { const dx = PINS[i][0] - x, dy = PINS[i][1] - y, d2 = dx * dx + dy * dy; if (d2 < 1e-6) { out[0][k] = qx[i]; out[1][k] = qy[i]; return; } const w = 1 / Math.pow(d2, a); sw += w; px += w * PINS[i][0]; py += w * PINS[i][1]; cx += w * qx[i]; cy += w * qy[i]; }
        px /= sw; py /= sw; cx /= sw; cy /= sw;
        const bx = x - px, by = y - py; let fx = 0, fy = 0;
        for (let i = 0; i < NP; i++) {
          const dx = PINS[i][0] - x, dy = PINS[i][1] - y, w = 1 / Math.pow(dx * dx + dy * dy, a);
          const ax = PINS[i][0] - px, ay = PINS[i][1] - py, hx = qx[i] - cx, hy = qy[i] - cy, dot = ax * bx + ay * by, crs = ax * by - ay * bx;
          fx += w * (hx * dot - hy * crs); fy += w * (hx * crs + hy * dot);
        }
        const fl = Math.hypot(fx, fy) || 1, bl = Math.hypot(bx, by);
        out[0][k] = fx / fl * bl + cx; out[1][k] = fy / fl * bl + cy;
      }
      const OUT = [vx, vy];
      function tri(s0x, s0y, s1x, s1y, s2x, s2y, i0, i1, i2) {
        const d0x = vx[i0], d0y = vy[i0], d1x = vx[i1], d1y = vy[i1], d2x = vx[i2], d2y = vy[i2];
        const det = (s1x - s0x) * (s2y - s0y) - (s2x - s0x) * (s1y - s0y);
        const a = ((d1x - d0x) * (s2y - s0y) - (d2x - d0x) * (s1y - s0y)) / det, b = ((d1y - d0y) * (s2y - s0y) - (d2y - d0y) * (s1y - s0y)) / det;
        const c = ((d2x - d0x) * (s1x - s0x) - (d1x - d0x) * (s2x - s0x)) / det, d = ((d2y - d0y) * (s1x - s0x) - (d1y - d0y) * (s2x - s0x)) / det;
        const mx = (d0x + d1x + d2x) / 3, my = (d0y + d1y + d2y) / 3, gr = (px, py) => { const l = Math.hypot(px - mx, py - my) || 1; return [px + (px - mx) / l * 0.7, py + (py - my) / l * 0.7]; };
        const A = gr(d0x, d0y), B = gr(d1x, d1y), Cc = gr(d2x, d2y);
        g.save(); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(Cc[0], Cc[1]); g.closePath(); g.clip();
        g.transform(a, b, c, d, d0x - a * s0x - c * s0y, d0y - b * s0x - d * s0y); g.drawImage(tex, 0, 0); g.restore();
      }
      const note = (x, y, s, al) => { g.globalAlpha = al; g.fillStyle = C.amber; g.beginPath(); g.ellipse(x, y, 6 * s, 4.5 * s, -0.4, 0, TAU); g.fill(); g.fillRect(x + 4.5 * s, y - 24 * s, 2 * s, 24 * s); g.beginPath(); g.moveTo(x + 6.5 * s, y - 24 * s); g.quadraticCurveTo(x + 16 * s, y - 18 * s, x + 12 * s, y - 10 * s); g.lineTo(x + 6.5 * s, y - 17 * s); g.fill(); g.globalAlpha = 1; };
      return t => {
        const b = t * 2, A = L.p.amt, down = Math.pow(Math.abs(Math.cos(Math.PI * b)), 4);
        const hx = 40 * Math.sin(Math.PI * b) * A, hy = (-8 + 22 * down) * A;
        const anim = [[0, 0], [0, 0], [0, 0], [hx * 0.42, hy * 0.55], [hx, hy], [hx * 0.5 - 12 * A * Math.cos(Math.PI * b), -34 * A * Math.sin(Math.PI * b + 0.8) + hy * 0.4], [hx * 0.5 + 10 * A * Math.cos(Math.PI * b), 34 * A * Math.sin(Math.PI * b + 0.8) + hy * 0.4]];
        for (let i = 0; i < NP; i++) {
          let x = OX + PINS[i][0] + anim[i][0], y = OY + PINS[i][1] + anim[i][1]; const h = hold[i];
          if (h.on) { x = h.x; y = h.y; } else { const k = EX.clamp01((L.t - h.rel) / 0.6); if (k < 1) { const e = ease.inOut(k); x = lerp(h.x, x, e); y = lerp(h.y, y, e); } }
          qx[i] = x; qy[i] = y;
        }
        for (let i = 0; i < NP; i++) { qx[i] -= OX; qy[i] -= OY; }
        for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) mls(i * CS, j * CS, L.p.alpha, OUT, j * (NX + 1) + i);
        for (let k = 0; k < NV; k++) { vx[k] += OX; vy[k] += OY; }
        for (let i = 0; i < NP; i++) { qx[i] += OX; qy[i] += OY; }
        const bg = g.createRadialGradient(320, 250, 20, 320, 220, 380); bg.addColorStop(0, '#2b2550'); bg.addColorStop(1, '#0b0b10'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(255,240,200,0.06)'; g.beginPath(); g.moveTo(250, 0); g.lineTo(390, 0); g.lineTo(470, 350); g.lineTo(170, 350); g.closePath(); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(320, 350, 96, 9, 0, 0, TAU); g.fill();
        for (let k = 0; k < 5; k++) { const u = ((t * 0.35 + k / 5) % 1); note(150 + (k * 97) % 360 + Math.sin(u * 9 + k) * 14, 300 - u * 260, 0.8 + (k % 3) * 0.2, Math.sin(u * Math.PI) * 0.7); }
        for (const [cx, cy] of cells) { const i00 = cy * (NX + 1) + cx, i10 = i00 + 1, i01 = i00 + NX + 1, i11 = i01 + 1, x0 = cx * CS, y0 = cy * CS; tri(x0, y0, x0 + CS, y0, x0, y0 + CS, i00, i10, i01); tri(x0 + CS, y0, x0 + CS, y0 + CS, x0, y0 + CS, i10, i11, i01); }
        if (L.mesh) {
          g.strokeStyle = 'rgba(43,196,230,0.7)'; g.lineWidth = 1; g.beginPath();
          for (const [cx, cy] of cells) { const i00 = cy * (NX + 1) + cx, i10 = i00 + 1, i01 = i00 + NX + 1, i11 = i01 + 1; g.moveTo(vx[i00], vy[i00]); g.lineTo(vx[i10], vy[i10]); g.lineTo(vx[i11], vy[i11]); g.lineTo(vx[i01], vy[i01]); g.closePath(); g.moveTo(vx[i10], vy[i10]); g.lineTo(vx[i01], vy[i01]); }
          g.stroke();
        }
        for (let i = 0; i < NP; i++) { g.fillStyle = i < 3 ? '#8a8aa0' : C.amber; g.strokeStyle = '#0b0b10'; g.lineWidth = 2; g.beginPath(); g.arc(qx[i], qy[i], 6, 0, TAU); g.fill(); g.stroke(); }
        g.font = '12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.textAlign = 'left'; g.fillText(`${cells.length * 2} triangles, ${NP} pins`, 16, 26); g.fillText('drag a yellow pin', 16, 44);
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-sankey', title: 'Sankey flow build', aka: 'Sankey diagram, flow chart animation, alluvial, data ribbons', tool: 'Canvas 2D (bezier ribbons + particles along curves)', runs: 'CPU',
    notice: 'Five energy sources feed three sectors. The nodes grow first, then each ribbon unrolls from left to right with a stagger, and its width is the amount that flows. Small particles ride along the curves to show the direction, then the piece spotlights one source at a time by dimming every other ribbon, and finally pulls everything back out.',
    use: 'budgets, energy and supply-chain stories, user journeys, any "where does it go" data',
    params: [{ key: 'flow', label: 'Particle speed', min: 0, max: 1, step: 0.05, value: 0.3 }, { key: 'curve', label: 'Ribbon curve', min: 0.1, max: 0.9, step: 0.05, value: 0.5 }],
    prompt: 'Animated Sankey diagram, 12 s loop on a dark background: five energy sources (solar, wind, hydro, gas, oil) flow into homes, industry and transport; nodes grow with a stagger, ribbons with a source-to-target gradient unroll left to right (bezier curvature {curve}), values count up, particles drift along each ribbon at speed {flow} to show direction, then each source is spotlighted in turn while the other ribbons dim to 18%, and everything retracts at the end.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const seg = EX.seg;
      const SRC = [['Solar', C.amber], ['Wind', C.cyan], ['Hydro', C.violet], ['Gas', C.coral], ['Oil', '#8c8798']], TGT = ['Homes', 'Industry', 'Transport'];
      const FL = [[0, 0, 30], [0, 1, 10], [0, 2, 2], [1, 0, 18], [1, 1, 20], [1, 2, 4], [2, 0, 8], [2, 1, 12], [3, 0, 15], [3, 1, 22], [3, 2, 6], [4, 1, 6], [4, 2, 40]];
      const sv = SRC.map((_, i) => FL.filter(f => f[0] === i).reduce((s, f) => s + f[2], 0)), tv = TGT.map((_, j) => FL.filter(f => f[1] === j).reduce((s, f) => s + f[2], 0));
      const K = 1.32, X0 = 150, X1 = 476, NW = 14;
      const sy = [], ty = []; let y = 34; sv.forEach(v => { sy.push(y); y += v * K + 12; }); y = 42; tv.forEach(v => { ty.push(y); y += v * K + 24; });
      const so = sy.slice(), to = ty.slice();
      const links = FL.map(([s, t, v], i) => { const l = { s, t, v, i, a0: so[s], b0: to[t], w: v * K, al: 1, parts: [] }; so[s] += l.w; to[t] += l.w; const n = Math.max(2, Math.round(v / 3)); for (let k = 0; k < n; k++) l.parts.push([k / n + EX.rng(i * 7 + k)() * 0.2, 0.18 + EX.rng(i * 13 + k)() * 0.64]); return l; });
      const cub = (a, b, c, d, s) => { const m = 1 - s; return m * m * m * a + 3 * m * m * s * b + 3 * m * s * s * c + s * s * s * d; };
      let flowT = 0;
      return (t, dt) => {
        const lt = t % 12, xa = X0 + NW, xb = X1, cu = L.p.curve, xm1 = lerp(xa, xb, cu), xm2 = lerp(xb, xa, cu);
        const focus = lt > 3 && lt < 9 ? Math.floor((lt - 3) / 1.2) : -1, out = ease.inOut(seg(lt, 10.4, 11.4));
        flowT += dt * L.p.flow;
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.font = '600 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.45)'; g.textAlign = 'left'; g.fillText('ENERGY FLOW, TWh', 20, 22);
        for (const l of links) {
          const inK = ease.inOut(seg(lt, 0.6 + l.i * 0.1, 1.5 + l.i * 0.1)); if (inK <= 0 || out >= 1) continue;
          l.al += ((focus < 0 || focus === l.s ? 1 : 0.18) - l.al) * Math.min(1, dt * 8);
          const a0 = l.a0, a1 = l.a0 + l.w, b0 = l.b0, b1 = l.b0 + l.w;
          g.save(); g.beginPath(); g.rect(lerp(xa, xb, out), 0, (xb - xa) * (inK - out) + 1, H); g.clip();
          const gr = g.createLinearGradient(xa, 0, xb, 0); gr.addColorStop(0, SRC[l.s][1]); gr.addColorStop(1, 'rgba(244,239,230,0.55)');
          g.globalAlpha = 0.55 * l.al; g.fillStyle = gr; g.beginPath(); g.moveTo(xa, a0); g.bezierCurveTo(xm1, a0, xm2, b0, xb, b0); g.lineTo(xb, b1); g.bezierCurveTo(xm2, b1, xm1, a1, xa, a1); g.closePath(); g.fill();
          if (inK >= 1 && out <= 0) {
            g.globalAlpha = 0.9 * l.al; g.fillStyle = '#fff';
            for (const [ph, f] of l.parts) { const s = (ph + flowT) % 1, x = cub(xa, xm1, xm2, xb, s), yt = cub(a0, a0, b0, b0, s), yb = cub(a1, a1, b1, b1, s); g.beginPath(); g.arc(x, lerp(yt, yb, f), 1.6, 0, TAU); g.fill(); }
          }
          g.restore();
        }
        g.globalAlpha = 1;
        SRC.forEach(([n, col], i) => {
          const k = ease.out(seg(lt, i * 0.08, 0.5 + i * 0.08)) * (1 - out), h = sv[i] * K, dim = focus < 0 || focus === i ? 1 : 0.35; if (k <= 0) return;
          g.globalAlpha = dim; g.fillStyle = col; g.fillRect(X0, sy[i] + h * (1 - k) / 2, NW, h * k);
          g.globalAlpha = dim * (1 - out); g.textAlign = 'right'; g.font = '600 13px Segoe UI'; g.fillStyle = C.cream; g.fillText(n, X0 - 12, sy[i] + h / 2 + 1);
          g.font = '700 12px Bahnschrift'; g.fillStyle = col; g.fillText(String(Math.round(sv[i] * ease.out(seg(lt, 0.6, 2.2)))), X0 - 12, sy[i] + h / 2 + 15);
        });
        TGT.forEach((n, j) => {
          const k = ease.out(seg(lt, 1.8 + j * 0.1, 2.5 + j * 0.1)) * (1 - out), h = tv[j] * K; if (k <= 0) return;
          const got = focus < 0 ? tv[j] : FL.filter(f => f[0] === focus && f[1] === j).reduce((s, f) => s + f[2], 0);
          g.globalAlpha = 1; g.fillStyle = C.cream; g.fillRect(X1, ty[j] + h * (1 - k) / 2, NW, h * k);
          g.globalAlpha = 1 - out; g.textAlign = 'left'; g.font = '600 13px Segoe UI'; g.fillText(n, X1 + NW + 12, ty[j] + h / 2 + 1);
          g.font = '700 12px Bahnschrift'; g.fillStyle = focus < 0 ? 'rgba(244,239,230,0.6)' : SRC[focus][1]; g.fillText(String(Math.round(got * ease.out(seg(lt, 1.8, 3)))) + (focus < 0 ? '' : ' from ' + SRC[focus][0].toLowerCase()), X1 + NW + 12, ty[j] + h / 2 + 15);
        });
        g.globalAlpha = 1;
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-bauhaus', title: 'Bauhaus tile grid', aka: 'geometric pattern loop, modular grid, tile flip, Bauhaus motion poster', tool: 'Canvas 2D (tile state machine + wave stagger)', runs: 'CPU',
    notice: 'A poster grid of square tiles, each a flat background with one shape: a quarter circle, a half circle, a ring, a triangle, stripes or dots. On every beat a wave starts from a random tile and spreads out; each tile it reaches either turns its shape a quarter turn with overshoot, swaps the shape by shrinking and popping, or wipes in new colors. Only five colors and eight shapes, but it never looks the same twice.',
    use: 'music and event promos, brand pattern systems, social loops, editorial openers',
    params: [{ key: 'bpm', label: 'Tempo', min: 50, max: 160, step: 1, value: 96, unit: ' BPM' }, { key: 'wave', label: 'Wave stagger', min: 0, max: 0.12, step: 0.005, value: 0.045, unit: ' s', dec: 3 }],
    prompt: 'Bauhaus-style motion poster: an 8x4 grid of square tiles (two of them 2x2) in cream, coral, amber, navy and cyan, each with one flat shape (quarter circle, half circle, circle, ring, corner triangle, stripes, dots, arch); on every beat at {bpm} a wave spreads from a random tile with {wave} delay per tile step, and each tile it reaches turns its shape 90 degrees with ease-out-back, pops to a new shape, or wipes in a new color pair; no gaps, no text, seamless.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const S = 72, GX = 32, GY = 36, NC = 8, NR = 4;
      const COLS = [C.cream, C.coral, C.amber, C.navy, C.cyan], r = EX.rng(3);
      const big = [[1, 1], [5, 0]], taken = new Set();
      const tiles = [];
      const pair = () => { const a = Math.floor(r() * 5); let b = Math.floor(r() * 4); if (b >= a) b++; return [a, b]; };
      const mk = (c, rr, n) => { const [bg, fg] = pair(); tiles.push({ c, r: rr, n, m: Math.floor(r() * 8), m0: 0, rot: Math.floor(r() * 4), rot0: 0, bg, fg, bg0: bg, fg0: fg, kind: -1, st: -9 }); };
      for (const [c, rr] of big) { mk(c, rr, 2); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) taken.add((rr + j) * NC + c + i); }
      for (let rr = 0; rr < NR; rr++) for (let c = 0; c < NC; c++) if (!taken.has(rr * NC + c)) mk(c, rr, 1);
      // Draws motif m in a square of side s centered on the origin.
      function motif(m, s, col) {
        const h = s / 2; g.fillStyle = col; g.beginPath();
        if (m === 0) { g.moveTo(-h, -h); g.arc(-h, -h, s, 0, Math.PI / 2); }
        else if (m === 1) { g.arc(0, -h, h, 0, Math.PI); }
        else if (m === 2) { g.arc(0, 0, s * 0.36, 0, TAU); }
        else if (m === 3) { g.arc(0, 0, s * 0.4, 0, TAU); g.moveTo(s * 0.2, 0); g.arc(0, 0, s * 0.2, 0, TAU, true); }
        else if (m === 4) { g.moveTo(-h, -h); g.lineTo(h, -h); g.lineTo(-h, h); }
        else if (m === 5) { for (let k = 0; k < 3; k++) g.rect(-h, -h + k * s / 3, s, s / 6); }
        else if (m === 6) { for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const x = (a - 1) * s * 0.3, y = (b - 1) * s * 0.3; g.moveTo(x + s * 0.09, y); g.arc(x, y, s * 0.09, 0, TAU); } }
        else { g.rect(-s * 0.32, 0, s * 0.64, h); g.moveTo(s * 0.32, 0); g.arc(0, 0, s * 0.32, 0, Math.PI, true); }
        g.fill('evenodd');
      }
      let beat = -1;
      return t => {
        const bl = 60 / L.p.bpm, b = Math.floor(t / bl);
        if (b !== beat) {
          beat = b; const br = EX.rng(b * 7919 + 11), oc = Math.floor(br() * NC), orr = Math.floor(br() * NR);
          for (const T of tiles) {
            if (br() < 0.25) continue;
            const d = Math.abs(T.c + (T.n - 1) / 2 - oc) + Math.abs(T.r + (T.n - 1) / 2 - orr), k = br();
            T.st = b * bl + d * L.p.wave; T.rot0 = T.rot; T.m0 = T.m; T.bg0 = T.bg; T.fg0 = T.fg;
            if (k < 0.55) { T.kind = 0; T.rot = T.rot + 1; }
            else if (k < 0.8) { T.kind = 1; T.m = (T.m + 1 + Math.floor(br() * 7)) % 8; }
            else { T.kind = 2; const [bg, fg] = pair(); T.bg = bg; T.fg = fg; }
          }
        }
        g.fillStyle = '#e9e0d0'; g.fillRect(0, 0, W, H);
        for (const T of tiles) {
          const s = S * T.n, x = GX + T.c * S, y = GY + T.r * S, p = EX.clamp01((t - T.st) / 0.42);
          g.save(); g.beginPath(); g.rect(x, y, s, s); g.clip();
          let bg = COLS[T.bg], fg = COLS[T.fg], m = T.m, sc = 1, rot = T.rot;
          if (T.kind === 0) rot = lerp(T.rot0, T.rot, ease.back(p));
          if (T.kind === 1) { if (p < 0.5) { m = T.m0; sc = 1 - ease.inOut(p * 2); } else sc = ease.back((p - 0.5) * 2); }
          if (T.kind === 2 && p < 1) { bg = COLS[T.bg0]; fg = COLS[p < 0.55 ? T.fg0 : T.fg]; }
          g.fillStyle = bg; g.fillRect(x, y, s, s);
          if (T.kind === 2 && p < 1) { const w = ease.inOut(p) * s; g.fillStyle = COLS[T.bg]; g.fillRect(x, y, w, s); }
          g.translate(x + s / 2, y + s / 2); g.rotate(rot * Math.PI / 2); g.scale(sc, sc); motif(m, s, fg);
          g.restore();
        }
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-logogrid', title: 'Logo construction grid', aka: 'logo construction, golden ratio circles, guides to final mark, brand reveal', tool: 'Canvas 2D (arc sweeps, clip paths, even-odd clipping)', runs: 'CPU',
    notice: 'The classic brand-film reveal: guide lines draw out from the center, then five construction circles sweep on with their centers and radii labeled (each a golden-ratio step of the first). The final mark is just those circles combined: one circle minus another makes the crescent, the overlap of two makes the leaf, and the smallest becomes the dot. The guides fade, the wordmark tracks in, and it all folds away.',
    use: 'brand guidelines, logo reveals, design case studies, "how it was made" posts',
    params: [{ key: 'gw', label: 'Guide opacity', min: 0.1, max: 1, step: 0.05, value: 0.7 }],
    prompt: 'Logo construction reveal, 9 s loop on deep navy: a thin guide grid and 45-degree axis draw out from the center, five construction circles in golden-ratio sizes (1, 0.86, 1/phi twice, 1/phi^4) sweep on with center crosses, radius lines and ratio labels at guide opacity {gw}, then the mark fills from them (a coral crescent from circle minus circle with a conic wipe, an amber leaf from the overlap of two circles popping with overshoot and a vein drawing on, a cyan dot), guides fade, the wordmark LUMEN tracks in, then everything folds away.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const seg = EX.seg, LOOP = 9;
      const CC = [300, 168, 112], DD = [334, 148, 96], LC = [340, 160], u = [Math.SQRT1_2, -Math.SQRT1_2], n = [Math.SQRT1_2, Math.SQRT1_2], LR = 69.2, SEP = 43;
      const L1 = [LC[0] + n[0] * SEP, LC[1] + n[1] * SEP, LR], L2 = [LC[0] - n[0] * SEP, LC[1] - n[1] * SEP, LR], DT = [412, 90, 16.3];
      const CIRC = /** @type {[number[], string, number][]} */ ([[CC, '1.000', -2.4], [DD, '0.857', 0.45], [L1, '0.618', 2.2], [L2, '0.618', -2.0], [DT, '0.146', 0.4]]);
      const circle = (c, r = c[2]) => { g.moveTo(c[0] + r, c[1]); g.arc(c[0], c[1], r, 0, TAU); };
      return t => {
        const lt = t % LOOP, gw = L.p.gw, fold = ease.inOut(seg(lt, 7.9, 8.7)), guide = (1 - 0.8 * ease.inOut(seg(lt, 3.8, 4.6))) * (1 - fold) * gw;
        const bg = g.createRadialGradient(320, 170, 30, 320, 180, 420); bg.addColorStop(0, '#1d1b3a'); bg.addColorStop(1, '#0b0b14'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.lineWidth = 1;
        const gk = ease.out(seg(lt, 0.1, 1.0));
        if (guide > 0.01) {
          g.strokeStyle = `rgba(244,239,230,${0.09 * guide / gw})`; g.beginPath();
          for (let x = 320 % 32; x < W; x += 32) { g.moveTo(x, 168 - 200 * gk); g.lineTo(x, 168 + 200 * gk); }
          for (let y = 168 % 32; y < H; y += 32) { g.moveTo(320 - 340 * gk, y); g.lineTo(320 + 340 * gk, y); }
          g.stroke();
          g.strokeStyle = `rgba(244,239,230,${0.4 * guide})`; g.beginPath();
          g.moveTo(LC[0] - u[0] * 260 * gk, LC[1] - u[1] * 260 * gk); g.lineTo(LC[0] + u[0] * 260 * gk, LC[1] + u[1] * 260 * gk);
          g.moveTo(CC[0], CC[1] - 190 * gk); g.lineTo(CC[0], CC[1] + 190 * gk); g.moveTo(CC[0] - 300 * gk, CC[1]); g.lineTo(CC[0] + 300 * gk, CC[1]); g.stroke();
          g.font = '10px Cascadia Mono, Consolas'; g.textAlign = 'left';
          CIRC.forEach(([c, lab, a], i) => {
            const k = ease.inOut(seg(lt, 0.7 + i * 0.32, 1.6 + i * 0.32)); if (k <= 0) return;
            g.strokeStyle = `rgba(43,196,230,${0.85 * guide})`; g.beginPath(); g.arc(c[0], c[1], c[2], a, a + TAU * k); g.stroke();
            g.strokeStyle = `rgba(244,239,230,${0.7 * guide})`; g.beginPath(); g.moveTo(c[0] - 5, c[1]); g.lineTo(c[0] + 5, c[1]); g.moveTo(c[0], c[1] - 5); g.lineTo(c[0], c[1] + 5); g.stroke();
            const rk = ease.out(seg(lt, 1.2 + i * 0.32, 1.7 + i * 0.32)), ex = c[0] + Math.cos(a) * c[2] * rk, ey = c[1] + Math.sin(a) * c[2] * rk;
            g.setLineDash([3, 3]); g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
            g.fillStyle = `rgba(43,196,230,${guide * rk})`; g.fillText('r ' + lab, ex + (Math.cos(a) > 0 ? 6 : -46), ey + (Math.sin(a) > 0 ? 12 : -5));
          });
        }
        const s = 1 - 0.35 * fold, al = 1 - fold;
        g.save(); g.globalAlpha = al; g.translate(320, 168); g.scale(s, s); g.rotate(-fold * 0.4); g.translate(-320, -168);
        const ck = ease.inOut(seg(lt, 2.6, 3.5));
        if (ck > 0) {
          g.save(); g.beginPath(); g.moveTo(CC[0], CC[1]); g.arc(CC[0], CC[1], CC[2] + 2, -2.4, -2.4 + TAU * ck); g.closePath(); g.clip();
          g.beginPath(); g.rect(0, 0, W, H); circle(DD); g.clip('evenodd'); g.fillStyle = C.coral; g.beginPath(); circle(CC); g.fill(); g.restore();
        }
        const lk = ease.back(seg(lt, 3.0, 3.5));
        if (lk > 0) {
          g.save(); g.translate(LC[0], LC[1]); g.scale(lk, lk); g.translate(-LC[0], -LC[1]);
          g.beginPath(); circle(L1); g.clip(); g.fillStyle = C.amber; g.beginPath(); circle(L2); g.fill();
          const vk = ease.inOut(seg(lt, 3.4, 4.0)), half = Math.sqrt(LR * LR - SEP * SEP);
          g.strokeStyle = '#1d1b3a'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(LC[0] - u[0] * half * 0.8, LC[1] - u[1] * half * 0.8); g.lineTo(LC[0] + u[0] * half * lerp(-0.8, 0.8, vk), LC[1] + u[1] * half * lerp(-0.8, 0.8, vk)); if (vk > 0) g.stroke();
          g.restore();
        }
        const dk = ease.back(seg(lt, 3.35, 3.75));
        if (dk > 0) { g.fillStyle = C.cyan; g.beginPath(); g.arc(DT[0], DT[1], DT[2] * dk, 0, TAU); g.fill(); }
        g.restore();
        const wk = ease.out(seg(lt, 4.3, 5.6)) * (1 - fold);
        if (wk > 0) {
          g.font = '600 24px Bahnschrift'; g.fillStyle = `rgba(244,239,230,${wk})`; g.textAlign = 'center';
          const word = 'LUMEN', sp = lerp(2, 14, wk); let wsum = 0; for (const ch of word) wsum += g.measureText(ch).width + sp; let x = 320 - (wsum - sp) / 2;
          g.textAlign = 'left'; for (const ch of word) { g.fillText(ch, x, 336); x += g.measureText(ch).width + sp; }
        }
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-lipsync', title: 'Lip sync with mouth shapes', aka: 'lip sync, visemes, phonemes, mouth chart, Preston Blair', tool: 'Canvas 2D (viseme timeline + mouth shape tween)', runs: 'CPU',
    notice: 'Cartoon dialogue is not animated sound by sound but with about nine mouth shapes, one per group of sounds (M B P all close the lips, F and V bite the lip). A timeline lists which shape holds for how long, here for one short line, and the mouth tweens between them in a few hundredths of a second. The chart on the right lights the current shape, the brows lift on stressed words, and the eyes blink in the pause.',
    use: 'explainer characters, mascots that talk, game dialogue, learning how lip sync is planned',
    params: [{ key: 'tw', label: 'Mouth tween', min: 0, max: 0.14, step: 0.005, value: 0.05, unit: ' s', dec: 3 }],
    prompt: 'Flat 2D talking head lip-synced to the line "Hello motion lovers, watch my lips!" with nine Preston Blair mouth shapes (AI, E, O, U, MBP, FV, L, CDG, rest) on a viseme timeline, each shape held for its sound and tweened to the next over {tw}, upper teeth and tongue visible in open shapes, brows lift on stressed words, a blink in the pause, a mouth chart beside the face that highlights the current shape, captions with the spoken word highlighted, and a dope-sheet strip with a playhead.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const LOOP = 4.2, T0 = 0.3, SKIN = '#f2c29b', LIP = '#c4505a';
      const V = { AI: [0.78, 0.6, 0.2, 1, 0.55, 0], E: [0.92, 0.3, 0, 1, 0.25, 0], O: [0.48, 0.55, 1, 0, 0.35, 0], U: [0.3, 0.3, 1, 0, 0, 0], MBP: [0.52, 0, 0, 0, 0, 0], FV: [0.72, 0.14, 0, 1, 0, 1], L: [0.66, 0.42, 0.3, 1, 1, 0], CDG: [0.72, 0.2, 0.1, 1, 0.15, 0], REST: [0.56, 0.035, 0, 0, 0, 0] };
      const CHART = ['AI', 'E', 'O', 'U', 'MBP', 'FV', 'L', 'CDG', 'REST'];
      const SEQ = /** @type {[string, [string, number][]][]} */ ([['Hello', [['E', 0.07], ['L', 0.08], ['O', 0.16]]], ['motion', [['MBP', 0.07], ['O', 0.12], ['CDG', 0.09], ['E', 0.06], ['CDG', 0.08]]], ['lovers,', [['L', 0.07], ['AI', 0.1], ['FV', 0.08], ['E', 0.08], ['CDG', 0.1]]], ['', [['REST', 0.18]]], ['watch', [['U', 0.08], ['AI', 0.13], ['CDG', 0.1]]], ['my', [['MBP', 0.07], ['AI', 0.16]]], ['lips!', [['L', 0.07], ['E', 0.08], ['MBP', 0.08], ['CDG', 0.12]]]]);
      const KEYS = [], WORDS = []; let tt = T0;
      SEQ.forEach(([w, vs], wi) => { const a = tt; vs.forEach(([v, d]) => { KEYS.push({ v, a: tt, d, wi }); tt += d; }); WORDS.push([w, a, tt]); });
      const END = tt;
      // Draws mouth shape P = [width, open, roundness, teeth, tongue, bite] centered at (cx, cy).
      function mouth(cx, cy, s, P) {
        const [w, h, r, teeth, tongue] = P, X = w * 46 * s, Hh = h * 60 * s;
        g.save(); g.translate(cx, cy); g.lineCap = 'round'; g.lineJoin = 'round';
        if (Hh < 3 * s) { g.strokeStyle = LIP; g.lineWidth = 5 * s; g.beginPath(); g.moveTo(-X, 0); g.quadraticCurveTo(0, 3 * s + Hh, X, 0); g.stroke(); g.restore(); return; }
        const top = -Hh * (0.35 + 0.15 * r), bot = Hh * (0.65 - 0.15 * r), ky = lerp(0.15, 0.552, r), kx = lerp(0.75, 0.552, r);
        const path = () => { g.beginPath(); g.moveTo(-X, 0); g.bezierCurveTo(-X, top * ky, -X * kx, top, 0, top); g.bezierCurveTo(X * kx, top, X, top * ky, X, 0); g.bezierCurveTo(X, bot * ky, X * kx, bot, 0, bot); g.bezierCurveTo(-X * kx, bot, -X, bot * ky, -X, 0); g.closePath(); };
        path(); g.fillStyle = '#3a0f22'; g.fill(); g.save(); g.clip();
        if (teeth > 0) { g.fillStyle = '#fffaf2'; g.fillRect(-X, top - 2, X * 2, Math.min(Hh * 0.32, 10 * s) * teeth + 2); }
        if (tongue > 0) { g.fillStyle = '#ff7a8a'; g.beginPath(); g.ellipse(0, bot + 2 * s - tongue * Hh * 0.12, X * 0.62, Hh * 0.22 + tongue * Hh * 0.12, 0, 0, TAU); g.fill(); }
        g.restore(); path(); g.strokeStyle = LIP; g.lineWidth = 4.5 * s; g.stroke(); g.restore();
      }
      const at = lt => { let i = 0; while (i + 1 < KEYS.length && KEYS[i + 1].a <= lt) i++; return i; };
      return t => {
        const lt = t % LOOP, speaking = lt >= T0 && lt < END, i = at(lt), k = KEYS[i];
        let P = V.REST, cur = 'REST';
        if (lt >= T0) {
          const prev = i ? V[KEYS[i - 1].v] : V.REST, nxt = lt < END ? V[k.v] : V.REST, start = lt < END ? k.a : END;
          const u = L.p.tw > 0 ? ease.out(EX.clamp01((lt - start) / L.p.tw)) : 1, from = lt < END ? prev : V[KEYS[KEYS.length - 1].v];
          P = nxt.map((x, j) => lerp(from[j], x, u)); cur = lt < END ? k.v : 'REST';
        }
        const wi = speaking ? k.wi : -1, stress = wi === 0 || wi === 6 ? 1 : 0;
        const brow = stress ? Math.sin(Math.PI * EX.clamp01((lt - WORDS[wi][1]) / 0.6)) : 0;
        const blink = Math.max(0, 1 - Math.abs(lt - 3.1) / 0.07, 1 - Math.abs(lt - 0.12) / 0.07);
        const tilt = Math.sin(t * 2.1) * 0.03 + (speaking ? Math.sin(lt * 9) * 0.012 : 0), bob = speaking ? Math.abs(Math.sin(lt * 6.5)) * -3 : 0;
        g.fillStyle = '#1b1832'; g.fillRect(0, 0, W, H);
        g.save(); g.translate(176, 132); g.scale(0.8, 0.8); g.translate(-190, -160);
        g.fillStyle = '#25213f'; g.beginPath(); g.arc(190, 160, 150, 0, TAU); g.fill();
        g.save(); g.beginPath(); g.arc(190, 160, 150, 0, TAU); g.clip();
        g.translate(190, 260); g.rotate(tilt); g.translate(-190, -260 + bob);
        g.fillStyle = C.coral; g.beginPath(); g.ellipse(190, 310, 130, 60, 0, 0, TAU); g.fill(); g.fillStyle = '#e09670'; g.fillRect(172, 236, 36, 30);
        g.fillStyle = SKIN; g.beginPath(); g.ellipse(190, 160, 92, 104, 0, 0, TAU); g.fill();
        for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(190 + sx * 92, 168, 14, 20, 0, 0, TAU); g.fill(); }
        g.fillStyle = C.navy; g.beginPath(); g.moveTo(96, 170); g.bezierCurveTo(80, 60, 160, 30, 210, 46); g.bezierCurveTo(270, 50, 300, 100, 286, 170); g.bezierCurveTo(270, 120, 240, 100, 200, 98); g.bezierCurveTo(150, 100, 120, 120, 96, 170); g.fill();
        for (const sx of [-1, 1]) {
          const ex = 190 + sx * 36, ey = 150; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey, 15, 18, 0, 0, TAU); g.fill();
          g.fillStyle = C.navy; g.beginPath(); g.arc(ex + 2, ey + 2, 8, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 5, ey - 2, 2.6, 0, TAU); g.fill();
          if (blink > 0) { g.fillStyle = SKIN; g.fillRect(ex - 17, ey - 20, 34, 38 * blink); }
          g.strokeStyle = C.navy; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - 14, ey - 30 - brow * 9 + (sx > 0 ? 2 : 0)); g.quadraticCurveTo(ex, ey - 38 - brow * 12, ex + 14, ey - 30 - brow * 9 + (sx < 0 ? 2 : 0)); g.stroke();
        }
        g.strokeStyle = '#d99c78'; g.lineWidth = 3; g.beginPath(); g.moveTo(190, 168); g.quadraticCurveTo(200, 186, 186, 188); g.stroke();
        g.fillStyle = 'rgba(255,110,120,0.35)'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(190 + sx * 54, 192, 13, 8, 0, 0, TAU); g.fill(); }
        mouth(190, 216, 1, P);
        g.restore(); g.restore();
        g.font = '10px Cascadia Mono, Consolas'; g.textAlign = 'center';
        CHART.forEach((n, j) => {
          const x = 372 + (j % 3) * 86, y = 24 + Math.floor(j / 3) * 70, on = n === cur;
          g.fillStyle = on ? 'rgba(255,176,32,0.16)' : 'rgba(244,239,230,0.05)'; g.fillRect(x, y, 78, 62);
          if (on) { g.strokeStyle = C.amber; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, 76, 60); }
          g.fillStyle = SKIN; g.fillRect(x + 12, y + 8, 54, 36); mouth(x + 39, y + 26, 0.55, V[n]);
          g.fillStyle = on ? C.amber : 'rgba(244,239,230,0.55)'; g.fillText(n, x + 39, y + 57);
        });
        let cx = 0; g.font = '600 15px Segoe UI'; const words = WORDS.filter(w => w[0]); const total = words.reduce((s, w) => s + g.measureText(w[0] + ' ').width, 0); cx = 320 - total / 2; g.textAlign = 'left';
        for (const [w, a, b] of words) { g.fillStyle = lt >= a && lt < b ? C.cream : 'rgba(244,239,230,0.35)'; g.fillText(w, cx, 274); cx += g.measureText(w + ' ').width; }
        const X0 = 40, X1 = 600, sx = v => X0 + (v - T0) / (END - T0) * (X1 - X0);
        g.font = '9px Cascadia Mono, Consolas'; g.textAlign = 'center';
        KEYS.forEach((q, j) => { const a = sx(q.a), b = sx(q.a + q.d), on = speaking && j === i; g.fillStyle = on ? C.amber : j % 2 ? 'rgba(244,239,230,0.13)' : 'rgba(244,239,230,0.2)'; g.fillRect(a, 292, b - a - 1, 24); if (b - a > 22) { g.fillStyle = on ? '#1b1832' : 'rgba(244,239,230,0.7)'; g.fillText(q.v, (a + b) / 2, 308); } });
        if (lt >= T0 && lt <= END) { g.fillStyle = C.coral; g.fillRect(sx(lt) - 1, 286, 2, 36); }
        g.textAlign = 'left'; g.fillStyle = 'rgba(244,239,230,0.4)'; g.fillText('VISEME TIMELINE', X0, 336);
      };
    },
  });


  EX.add({
    cat: 'mg', id: 'mg2-ribbons', title: 'Twisting ribbons', aka: 'ribbon trail, two-sided ribbon, twist, gymnastics ribbon, flowing bands', tool: 'Canvas 2D (arc-length resampled trail + width times cos(twist))', runs: 'CPU',
    notice: 'Each ribbon follows the path its head took, resampled to 110 points at equal spacing so it keeps its length when the head slows down. Along that trail the band turns around its own centerline: its visible width is the full width times the cosine of the twist angle, so it thins to a line when seen edge-on, and when the cosine goes negative the other side of the ribbon, in its second color, comes into view. Darkening the edge-on parts sells the turn.',
    use: 'brand ribbons and swooshes, celebration and award spots, transitions that wrap the frame, explainer flourishes',
    params: [{ key: 'tw', label: 'Twist rate', min: 0, max: 0.3, step: 0.005, value: 0.09, dec: 3 }, { key: 'hw', label: 'Ribbon width', min: 6, max: 34, step: 1, value: 18, unit: ' px' }],
    prompt: 'Three two-sided ribbons (coral and amber, cyan and violet, cream and navy) fly in looping paths over a dark background like rhythmic-gymnastics ribbons: each is its head path walked backward and resampled to 110 segments over a fixed length, tapered at the tail, twisting along its length at rate {tw} so width becomes {hw} times cos(twist) and the back color shows when the cosine flips sign, edge-on parts darkened, a soft offset shadow, seamless and smooth.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const N = 110, M = 320, DT = 0.012, LEN = 430;
      const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const RIB = [[C.coral, C.amber], [C.cyan, C.violet], [C.cream, '#3a3670']].map(([a, b]) => [a, b].map(h => { const c = hex(h); return [...Array(24).keys()].map(i => { const k = 0.35 + 0.65 * i / 23; return `rgb(${c[0] * k | 0},${c[1] * k | 0},${c[2] * k | 0})`; }); }));
      const px = new Float32Array(N), py = new Float32Array(N), hx = new Float32Array(M), hy = new Float32Array(M), hl = new Float32Array(M);
      // Head path of ribbon k; the ribbon body is this path walked backward and resampled to a fixed length.
      const path = (k, tau, i) => { hx[i] = 320 + 240 * Math.sin(0.62 * tau + k * 2.1) + 50 * Math.sin(1.9 * tau + k * 1.3); hy[i] = 180 + 112 * Math.sin(0.93 * tau + k * 1.7) * Math.cos(0.31 * tau + k) + 30 * Math.sin(2.7 * tau + k); };
      const body = () => { hl[0] = 0; for (let i = 1; i < M; i++) hl[i] = hl[i - 1] + Math.hypot(hx[i] - hx[i - 1], hy[i] - hy[i - 1]); const total = Math.min(LEN, hl[M - 1]); let j = 0; for (let i = 0; i < N; i++) { const d = i / (N - 1) * total; while (j < M - 2 && hl[j + 1] < d) j++; const u = (d - hl[j]) / (hl[j + 1] - hl[j] || 1); px[i] = lerp(hx[j], hx[j + 1], u); py[i] = lerp(hy[j], hy[j + 1], u); } };
      return t => {
        const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#141228'); bg.addColorStop(1, '#0b0b10'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
        const hw = L.p.hw, tw = L.p.tw;
        for (let k = 0; k < 3; k++) {
          for (let i = 0; i < M; i++) path(k, t * 1.15 - i * DT + k * 5, i); body();
          for (const pass of [0, 1]) {
            let lx0 = 0, ly0 = 0, rx0 = 0, ry0 = 0, c0 = 1;
            for (let i = 0; i < N; i++) {
              const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1), tx = px[a] - px[b], ty = py[a] - py[b], tl = Math.hypot(tx, ty) || 1;
              const th = i * tw * 1.4 + t * 2.4 + k * 1.7, c = Math.cos(th), taper = Math.min(1, i / 6) * Math.pow(1 - i / N, 0.7), w = hw * c * taper;
              const nx = -ty / tl * w, ny = tx / tl * w, sx = pass ? 0 : 7, sy = pass ? 0 : 10;
              const lx = px[i] + nx + sx, ly = py[i] + ny + sy, rx = px[i] - nx + sx, ry = py[i] - ny + sy;
              if (i) {
                const cm = (c + c0) / 2;
                g.fillStyle = pass ? RIB[k][cm >= 0 ? 0 : 1][Math.min(23, Math.abs(cm) * 24 | 0)] : 'rgba(0,0,0,0.28)';
                g.beginPath(); g.moveTo(lx0, ly0); g.lineTo(lx, ly); g.lineTo(rx, ry); g.lineTo(rx0, ry0); g.closePath(); g.fill();
                if (pass) { g.strokeStyle = g.fillStyle; g.lineWidth = 0.8; g.stroke(); }
              }
              lx0 = lx; ly0 = ly; rx0 = rx; ry0 = ry; c0 = c;
            }
          }
        }
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-wiggle', title: 'Wiggle expression', aka: 'wiggle(), noise-driven motion, organic jitter, handheld shake', tool: 'Canvas 2D (1D Perlin noise with octaves)', runs: 'CPU',
    notice: 'After Effects\' wiggle(freq, amp) is smooth noise added to a value. The same square gets the same amount of wiggle four times, only the frequency changes: half a wiggle per second drifts, two floats, six looks nervous and fifteen is a shake. Each trail is the last second and a half of its path, and the strip below graphs its x value. Octaves stack faster, smaller copies of the noise for detail.',
    use: 'handheld camera shake, floating UI elements, nervous or energetic characters, keeping still frames alive',
    params: [{ key: 'amp', label: 'Amount (amp)', min: 0, max: 60, step: 1, value: 36, unit: ' px' }, { key: 'oct', label: 'Octaves', min: 1, max: 4, step: 1, value: 1 }],
    prompt: 'Teaching card for the After Effects wiggle expression: four identical coral rounded squares side by side with wiggle frequencies 0.5, 2, 6 and 15 per second, all with amount {amp} and {oct} octaves of 1D Perlin noise on x, y and rotation, each with a fading 1.5 s trail, a crosshair at its rest position, a label for the feel (drift, float, nervous, shake), a scrolling graph of its x value underneath, and the expression shown as code at the top.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const F = [[0.5, 'drift'], [2, 'float'], [6, 'nervous'], [15, 'shake']], CW = 160, CY = 150;
      // wiggle(freq, amp) at time t on its own noise channel ch, with octaves halving amp and doubling freq.
      const wig = (t, f, a, ch, oct) => { let s = 0, aa = a, ff = f; for (let k = 0; k < oct; k++) { s += aa * (noise(t * ff, ch * 9.7 + k * 3.1, 0.37) - 0.5) * 2.8; aa *= 0.5; ff *= 2; } return s; };
      return t => {
        const A = L.p.amp, O = L.p.oct;
        g.fillStyle = '#0f0e18'; g.fillRect(0, 0, W, H);
        g.font = '13px Cascadia Mono, Consolas'; g.textAlign = 'left'; g.fillStyle = 'rgba(244,239,230,0.45)'; g.fillText('position = value +', 20, 28);
        g.fillStyle = C.amber; g.fillText(`wiggle(freq, ${A})`, 168, 28); g.fillStyle = 'rgba(244,239,230,0.45)'; g.fillText(O > 1 ? `   octaves ${O}, amp x0.5 each` : '', 312, 28);
        F.forEach(([f, word], c) => {
          const cx = c * CW + CW / 2, col = c % 2 ? '#15141f' : '#12111b';
          g.fillStyle = col; g.fillRect(c * CW, 44, CW, 316);
          g.strokeStyle = 'rgba(244,239,230,0.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 60, CY); g.lineTo(cx + 60, CY); g.moveTo(cx, CY - 60); g.lineTo(cx, CY + 60); g.stroke();
          g.lineCap = 'round';
          for (let i = 1; i < 90; i++) {
            const t0 = t - (i - 1) / 60, t1 = t - i / 60;
            g.strokeStyle = `rgba(255,90,54,${0.7 * (1 - i / 90)})`; g.lineWidth = 2.5;
            g.beginPath(); g.moveTo(cx + wig(t0, f, A, c * 3, O), CY + wig(t0, f, A, c * 3 + 1, O)); g.lineTo(cx + wig(t1, f, A, c * 3, O), CY + wig(t1, f, A, c * 3 + 1, O)); g.stroke();
          }
          const x = cx + wig(t, f, A, c * 3, O), y = CY + wig(t, f, A, c * 3 + 1, O), rot = wig(t, f, A * 0.6, c * 3 + 2, O) * Math.PI / 180;
          g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = C.coral; g.beginPath(); g.roundRect(-13, -13, 26, 26, 6); g.fill(); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-7, -7, 5, 5); g.restore();
          g.textAlign = 'center'; g.font = '700 18px Bahnschrift'; g.fillStyle = C.cream; g.fillText(`${f} / s`, cx, 246); g.font = '12px Segoe UI'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(word, cx, 264);
          const gy = 316, gx0 = c * CW + 14, gw = CW - 28;
          g.strokeStyle = 'rgba(244,239,230,0.1)'; g.beginPath(); g.moveTo(gx0, gy); g.lineTo(gx0 + gw, gy); g.stroke();
          g.strokeStyle = C.cyan; g.lineWidth = 1.5; g.beginPath();
          for (let i = 0; i <= 66; i++) { const tt = t - 2 + i / 33, v = wig(tt, f, A, c * 3, O); const px = gx0 + i / 66 * gw, py = gy - Math.max(-30, Math.min(30, v * 0.55)); i ? g.lineTo(px, py) : g.moveTo(px, py); }
          g.stroke(); g.fillStyle = C.cyan; g.beginPath(); g.arc(gx0 + gw, gy - Math.max(-30, Math.min(30, (x - cx) * 0.55)), 3, 0, TAU); g.fill();
        });
        g.textAlign = 'left';
      };
    },
  });


  EX.add({
    cat: 'mg', id: 'mg2-callouts', title: 'Product callouts', aka: 'feature callouts, leader lines, annotation animation, product explainer', tool: 'Canvas 2D (trimmed leader lines + 2D camera)', runs: 'CPU',
    notice: 'The standard product-launch move: a dot pops on a feature, its leader line draws out with an elbow, and the label slides up out of a mask while its number counts. Four callouts arrive one after another, then a 2D camera visits each one, scaling up around the point between the feature and its label while the others dim, and finally pulls back to show the whole set.',
    use: 'product launches and ads, feature tours, app store videos, technical explainers',
    params: [{ key: 'zoom', label: 'Camera zoom', min: 1, max: 2.2, step: 0.05, value: 1.6, unit: 'x' }],
    prompt: 'Product feature video for flat-illustrated over-ear headphones on a dark stage with a soft spotlight: four callouts (40 h battery, adaptive noise cancelling, memory foam cushions, USB-C fast charge) appear 0.45 s apart, each a pulsing dot, an elbowed leader line drawn with trim paths and a label that rises out of a mask with its number counting up; then a 2D camera zooms to {zoom} on each callout in turn with the others dimmed, pulls back to show all, and everything retracts; 12 s loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const seg = EX.seg, LOOP = 12;
      const CALL = [
        { p: [452, 268], e: [520, 300], x: [618, 300], big: 40, unit: ' h', sub: 'battery life' },
        { p: [470, 212], e: [524, 128], x: [622, 128], big: 0, unit: 'ANC', sub: 'noise cancelling' },
        { p: [236, 232], e: [140, 128], x: [22, 128], big: 0, unit: 'Memory foam', sub: 'protein leather cushions' },
        { p: [196, 298], e: [126, 318], x: [18, 318], big: 10, unit: ' min', sub: 'USB-C, 5 h of play' },
      ];
      function phones(bob) {
        g.save(); g.translate(0, bob); g.lineCap = 'round';
        g.strokeStyle = '#2b2846'; g.lineWidth = 20; g.beginPath(); g.arc(320, 196, 124, Math.PI * 1.04, Math.PI * 1.96); g.stroke();
        g.strokeStyle = '#46416e'; g.lineWidth = 8; g.beginPath(); g.arc(320, 196, 112, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
        g.fillStyle = '#8a86a8'; g.fillRect(193, 168, 10, 30); g.fillRect(437, 168, 10, 30);
        for (const sx of [-1, 1]) {
          const cx = 320 + sx * 120; g.fillStyle = '#1d1b3a'; g.beginPath(); g.roundRect(sx < 0 ? cx + 28 : cx - 48, 196, 20, 104, 10); g.fill();
          const gr = g.createLinearGradient(cx - 36, 0, cx + 36, 0); gr.addColorStop(0, '#f4efe6'); gr.addColorStop(1, '#d9d1c2'); g.fillStyle = gr; g.beginPath(); g.roundRect(cx - 36, 190, 72, 116, 30); g.fill();
          g.strokeStyle = C.coral; g.lineWidth = 3; g.beginPath(); g.arc(cx, 248, 18, 0, TAU); g.stroke();
        }
        g.fillStyle = '#2b2846'; g.beginPath(); g.roundRect(464, 204, 9, 20, 4); g.fill();
        g.fillStyle = '#2b2846'; g.fillRect(190, 300, 14, 5); g.fillStyle = C.green; g.beginPath(); g.arc(452, 268, 3, 0, TAU); g.fill();
        g.restore();
      }
      return t => {
        const lt = t % LOOP, Z = L.p.zoom;
        const focus = lt > 3.2 && lt < 9.2 ? Math.floor((lt - 3.2) / 1.5) : -1, fl = focus >= 0 ? (lt - 3.2) % 1.5 : 0;
        const zIn = focus < 0 ? 0 : ease.inOut(Math.min(1, fl / 0.45, (1.5 - fl) / 0.45 + (focus < 3 ? 1 : 0)));
        const out = ease.inOut(seg(lt, 10.4, 11.3));
        const prod = ease.out(seg(lt, 0, 0.8)) * (1 - ease.inOut(seg(lt, 11.1, 11.8)));
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const sp = g.createRadialGradient(320, 220, 10, 320, 220, 300); sp.addColorStop(0, 'rgba(122,92,255,0.22)'); sp.addColorStop(1, 'rgba(122,92,255,0)'); g.fillStyle = sp; g.fillRect(0, 0, W, H);
        let fx = 320, fy = 180;
        if (focus >= 0) { const c = CALL[focus]; const prevC = focus ? CALL[focus - 1] : null; fx = (c.p[0] + c.e[0]) / 2; fy = (c.p[1] + c.e[1]) / 2; if (prevC && fl < 0.45) { const k = ease.inOut(fl / 0.45); fx = lerp((prevC.p[0] + prevC.e[0]) / 2, fx, k); fy = lerp((prevC.p[1] + prevC.e[1]) / 2, fy, k); } }
        const zk = focus > 0 && fl < 0.45 ? 1 : zIn, s = lerp(1, Z, zk), cx = lerp(320, fx, zk), cy = lerp(180, fy, zk);
        g.save(); g.translate(320, 180); g.scale(s, s); g.translate(-cx, -cy);
        g.globalAlpha = prod; g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(320, 330, 150, 10, 0, 0, TAU); g.fill();
        phones((1 - prod) * 30 + Math.sin(t * 1.4) * 3); g.globalAlpha = 1;
        CALL.forEach((c, i) => {
          const a0 = 0.8 + i * 0.45, dot = ease.back(seg(lt, a0, a0 + 0.3)) * (1 - out), line = ease.inOut(seg(lt, a0 + 0.15, a0 + 0.6)) * (1 - out), lab = ease.out(seg(lt, a0 + 0.5, a0 + 0.9)) * (1 - out);
          const dim = focus >= 0 && focus !== i ? 0.25 : 1; if (dot <= 0 && line <= 0) return;
          g.globalAlpha = dim;
          const by = Math.sin(t * 1.4) * 3, P = [c.p[0], c.p[1] + by], l1 = Math.hypot(c.e[0] - P[0], c.e[1] - P[1]), l2 = Math.abs(c.x[0] - c.e[0]), d = line * (l1 + l2);
          g.strokeStyle = C.cream; g.lineWidth = 1.5; g.beginPath(); g.moveTo(P[0], P[1]);
          if (d <= l1) g.lineTo(lerp(P[0], c.e[0], d / l1), lerp(P[1], c.e[1], d / l1)); else { g.lineTo(c.e[0], c.e[1]); g.lineTo(c.e[0] + Math.sign(c.x[0] - c.e[0]) * (d - l1), c.e[1]); }
          if (line > 0) g.stroke();
          const pr = (t * 0.9 + i * 0.25) % 1; g.strokeStyle = `rgba(255,90,54,${(1 - pr) * 0.8 * dot})`; g.lineWidth = 2; g.beginPath(); g.arc(P[0], P[1], 6 + pr * 14, 0, TAU); g.stroke();
          g.fillStyle = C.coral; g.beginPath(); g.arc(P[0], P[1], 5.5 * dot, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(P[0], P[1], 2 * dot, 0, TAU); g.fill();
          if (lab > 0) {
            const right = c.x[0] > c.e[0];
            g.save(); g.beginPath(); g.rect(right ? c.e[0] : c.e[0] - 214, c.e[1] - 44, 214, 41); g.clip();
            const yo = (1 - lab) * 26; g.textAlign = right ? 'left' : 'right'; const tx = right ? c.e[0] + 4 : c.e[0] - 4;
            g.font = '700 20px Bahnschrift'; g.fillStyle = C.cream; g.fillText(c.big ? Math.round(c.big * lab) + c.unit : c.unit, tx, c.e[1] - 22 + yo);
            g.font = '11px Segoe UI'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillText(c.sub, tx, c.e[1] - 7 + yo);
            g.restore();
          }
          g.globalAlpha = 1;
        });
        g.restore(); g.textAlign = 'left';
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-girih', title: 'Islamic star pattern', aka: 'girih, Hankin method, geometric star pattern, 4.8.8 tiling, polygons in contact', tool: 'Canvas 2D (Hankin\'s polygons-in-contact method)', runs: 'CPU',
    notice: 'The pattern grows from a hidden tiling of octagons and small squares. From the middle of every tile edge two rays leave at the same contact angle and run inward until they meet their neighbors, which draws an eight-point star in each octagon and a small star in each square. Animating that one angle morphs the whole pattern from thin crosses to fat stars. Show the tiling to see the construction.',
    use: 'cultural and architectural pieces, luxury and fashion patterns, meditative loops, backgrounds that hold up at any size',
    params: [{ key: 'band', label: 'Strap width', min: 1.5, max: 12, step: 0.5, value: 5, unit: ' px' }],
    controls: [{ label: 'Pattern', on: true, fn: L => { L.tiling = false; } }, { label: 'Show tiling', fn: L => { L.tiling = true; } }],
    prompt: 'Animated Islamic geometric star pattern built with Hankin\'s polygons-in-contact method on a 4.8.8 tiling of octagons and squares: from each edge midpoint two rays at a contact angle that sweeps between 28 and 70 degrees and eases at both ends, meeting their neighbors to form eight-point stars; coral stars in the octagons, cyan stars in the squares, cream straps {band} wide with dark outlines on deep navy, the whole field slowly rotating, plus a view that overlays the hidden tiling.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const S = 96, Ls = S / (1 + Math.SQRT2), RO = Ls / (2 * Math.sin(Math.PI / 8)), RS = Ls / Math.SQRT2;
      const polys = [];
      for (let j = -5; j <= 5; j++) for (let i = -6; i <= 6; i++) {
        const ox = i * S, oy = j * S;
        if (Math.hypot(ox, oy) > 430) continue;
        polys.push({ x: ox, y: oy, v: [...Array(8).keys()].map(k => [ox + Math.cos(Math.PI / 8 + k * Math.PI / 4) * RO, oy + Math.sin(Math.PI / 8 + k * Math.PI / 4) * RO]), oct: true });
        polys.push({ x: ox + S / 2, y: oy + S / 2, v: [...Array(4).keys()].map(k => [ox + S / 2 + Math.cos(k * Math.PI / 2) * RS, oy + S / 2 + Math.sin(k * Math.PI / 2) * RS]), oct: false });
      }
      // Star outline for one tile at contact angle th: [M0, P0, M1, P1, ...].
      function star(p, th) {
        const n = p.v.length, out = [];
        for (let i = 0; i < n; i++) {
          const a = p.v[i], b = p.v[(i + 1) % n], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          let ex = b[0] - a[0], ey = b[1] - a[1]; const el = Math.hypot(ex, ey); ex /= el; ey /= el;
          let nx = p.x - mx, ny = p.y - my; const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
          const dx = Math.cos(th) * ex + Math.sin(th) * nx, dy = Math.cos(th) * ey + Math.sin(th) * ny;
          const ux = b[0] - p.x, uy = b[1] - p.y, cr = dx * uy - dy * ux, s = ((p.x - mx) * uy - (p.y - my) * ux) / cr;
          out.push(mx, my, mx + dx * s, my + dy * s);
        }
        return out;
      }
      const path = pts => { g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); };
      return t => {
        const th = lerp(28, 70, ease.inOut(0.5 + 0.5 * Math.sin(t * 0.55))) * Math.PI / 180;
        g.fillStyle = '#101a2e'; g.fillRect(0, 0, W, H);
        g.save(); g.translate(320, 180); g.rotate(t * 0.04);
        const stars = polys.map(p => star(p, th));
        g.fillStyle = 'rgba(255,90,54,0.88)'; g.beginPath(); polys.forEach((p, i) => { if (p.oct) path(stars[i]); }); g.fill();
        g.fillStyle = 'rgba(43,196,230,0.8)'; g.beginPath(); polys.forEach((p, i) => { if (!p.oct) path(stars[i]); }); g.fill();
        g.lineJoin = 'round'; g.beginPath(); stars.forEach(path);
        g.strokeStyle = '#0b0b10'; g.lineWidth = L.p.band + 3; g.stroke(); g.strokeStyle = '#f1e6cf'; g.lineWidth = L.p.band; g.stroke();
        if (L.tiling) { g.strokeStyle = 'rgba(255,176,32,0.9)'; g.lineWidth = 1.2; g.beginPath(); for (const p of polys) { const v = p.v; g.moveTo(v[0][0], v[0][1]); for (let k = 1; k < v.length; k++) g.lineTo(v[k][0], v[k][1]); g.closePath(); } g.stroke(); }
        g.restore();
        g.fillStyle = 'rgba(11,11,16,0.75)'; g.fillRect(14, 324, 204, 24); g.font = '12px Cascadia Mono, Consolas'; g.fillStyle = C.cream; g.textAlign = 'left'; g.fillText(`contact angle ${(th * 180 / Math.PI).toFixed(0)} deg`, 24, 340);
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-accordion', title: 'Accordion fold reveal', aka: 'fold reveal, zigzag fold, fake 3D fold, map unfold', tool: 'Canvas 2D (sliced panels + cos and sin of the fold angle)', runs: 'CPU',
    notice: 'A poster opens like a folded map, but nothing is 3D. Each panel is drawn cos(angle) wide, so the whole strip widens as the fold angle drops to zero, and each panel is cut into thin slices whose height grows toward the peaks and shrinks toward the valleys for a hint of perspective. Panels that face the light brighten and the others darken by sin(angle). A spring ease lets the paper pop slightly past flat before it settles.',
    use: 'poster and menu reveals, map and brochure openers, "unfold the story" transitions, product packaging',
    params: [{ key: 'n', label: 'Panels', min: 2, max: 12, step: 1, value: 6 }, { key: 'depth', label: 'Perspective', min: 0, max: 0.25, step: 0.01, value: 0.12 }],
    prompt: 'Accordion fold reveal of a travel poster (SEASIDE, sunset over the sea, cliffs, a sailboat) on a dark table: the poster is split into {n} vertical panels folded like a map; the fold angle eases from 88 degrees to flat with a small spring overshoot, each panel drawn cos(angle) wide and sliced so peaks are taller than valleys (perspective {depth}), panels facing the light brighten and the others darken by sin(angle), a soft shadow grows under it, it holds, then folds back up; 6.6 s loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const PW = 480, PH = 300, CY = 172;
      const pc = document.createElement('canvas'); pc.width = PW; pc.height = PH; const p = pc.getContext('2d');
      const sky = p.createLinearGradient(0, 0, 0, 190); sky.addColorStop(0, '#2a1f5a'); sky.addColorStop(0.65, '#ff7a4a'); sky.addColorStop(1, '#ffc070'); p.fillStyle = sky; p.fillRect(0, 0, PW, 190);
      p.fillStyle = '#ffe2a8'; p.beginPath(); p.arc(330, 186, 50, Math.PI, TAU); p.fill();
      const sea = p.createLinearGradient(0, 186, 0, PH); sea.addColorStop(0, '#2b5c8e'); sea.addColorStop(1, '#0f2240'); p.fillStyle = sea; p.fillRect(0, 186, PW, PH - 186);
      p.fillStyle = 'rgba(255,214,150,0.75)'; for (let k = 0; k < 8; k++) { const w = 90 - k * 9; p.fillRect(330 - w / 2 + (k % 2) * 6, 194 + k * 11, w, 3); }
      p.fillStyle = C.navy; p.beginPath(); p.moveTo(0, 300); p.lineTo(0, 120); p.lineTo(40, 104); p.lineTo(86, 150); p.lineTo(120, 170); p.lineTo(160, 190); p.lineTo(150, 300); p.fill();
      p.fillStyle = '#141230'; p.beginPath(); p.moveTo(0, 300); p.lineTo(0, 180); p.lineTo(60, 200); p.lineTo(110, 300); p.fill();
      p.fillStyle = '#1d1b3a'; p.beginPath(); p.moveTo(236, 214); p.lineTo(276, 214); p.lineTo(270, 222); p.lineTo(242, 222); p.fill(); p.beginPath(); p.moveTo(256, 212); p.lineTo(256, 176); p.lineTo(274, 210); p.fill();
      p.fillStyle = C.cream; p.font = '700 58px Bahnschrift'; p.textAlign = 'center'; p.fillText('SEASIDE', PW / 2, 74); p.font = '600 12px Cascadia Mono, Consolas'; p.fillText('SUMMER 2026  /  NORTH COAST', PW / 2, 98);
      p.strokeStyle = C.cream; p.lineWidth = 10; p.strokeRect(5, 5, PW - 10, PH - 10);
      return t => {
        const lt = t % 6.6, N = Math.round(L.p.n), pw = PW / N, D = L.p.depth;
        const open = ease.back(EX.seg(lt, 0.35, 1.75)) * (1 - ease.inOut(EX.seg(lt, 4.7, 5.9)));
        const th = (1 - open) * 88 * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th), w = pw * cs, x0 = 320 - PW * cs / 2;
        g.fillStyle = '#15131d'; g.fillRect(0, 0, W, H);
        g.fillStyle = `rgba(0,0,0,${0.5 * cs})`; g.beginPath(); g.ellipse(320, CY + PH / 2 + 8, PW * cs * 0.52 + 10, 12, 0, 0, TAU); g.fill();
        if (w < 0.3) return;
        const hAt = k => PH * (1 + D * sn * (k % 2 ? -1 : 1));
        for (let i = 0; i < N; i++) {
          const xl = x0 + i * w, hl = hAt(i), hr = hAt(i + 1), S = Math.max(2, Math.min(24, Math.ceil(w / 2)));
          g.save(); g.beginPath(); g.moveTo(xl, CY - hl / 2); g.lineTo(xl + w, CY - hr / 2); g.lineTo(xl + w, CY + hr / 2); g.lineTo(xl, CY + hl / 2); g.closePath(); g.clip();
          for (let j = 0; j < S; j++) { const h = Math.max(lerp(hl, hr, j / S), lerp(hl, hr, (j + 1) / S)); g.drawImage(pc, i * pw + j * pw / S, 0, pw / S, PH, xl + j * w / S, CY - h / 2, w / S + 0.7, h); }
          g.restore();
          const lit = (i % 2 === 0) === (sn >= 0), a = Math.abs(sn);
          const gr = g.createLinearGradient(xl, 0, xl + w, 0);
          const pk = i % 2 === 0;
          if (lit) { gr.addColorStop(0, `rgba(255,255,255,${(pk ? 0.16 : 0.04) * a})`); gr.addColorStop(1, `rgba(255,255,255,${(pk ? 0.04 : 0.16) * a})`); } else { gr.addColorStop(0, `rgba(0,0,0,${(pk ? 0.2 : 0.5) * a})`); gr.addColorStop(1, `rgba(0,0,0,${(pk ? 0.5 : 0.2) * a})`); }
          g.fillStyle = gr; g.beginPath(); g.moveTo(xl, CY - hl / 2); g.lineTo(xl + w, CY - hr / 2); g.lineTo(xl + w, CY + hr / 2); g.lineTo(xl, CY + hl / 2); g.closePath(); g.fill();
        }
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-plexus', title: 'Plexus network', aka: 'plexus effect, connected dots, network lines, constellation', tool: 'Canvas 2D (3D points, distance links, batched strokes)', runs: 'CPU',
    notice: 'The tech-promo background made famous by the Plexus plug-in. 170 points drift inside a slowly turning 3D box and are projected with perspective. Any two points closer than the link distance get a line that fades as they move apart, so the web keeps rewiring itself. Amber packets hop from point to point along the links, and the cursor joins the network when it is over the card.',
    use: 'tech and data backgrounds, network and AI themes, conference openers, lower-third backdrops',
    params: [{ key: 'dist', label: 'Link distance', min: 40, max: 170, step: 1, value: 118, unit: ' px' }],
    prompt: 'Plexus-style network background: 170 points drifting in a slowly rotating 3D box with perspective, a line between any two points closer than {dist} that fades with distance and depth, cyan to violet by depth, points sized by depth, a dozen amber data packets hopping along the links with short trails, the cursor connects to nearby points in coral, deep navy background, seamless loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const N = 170, r = EX.rng(17), BW = 330, BH = 190, BD = 240, F = 640, CD = 720;
      const P = [...Array(N)].map(() => [(r() * 2 - 1) * BW, (r() * 2 - 1) * BH, (r() * 2 - 1) * BD, (r() - 0.5) * 18, (r() - 0.5) * 18, (r() - 0.5) * 18]);
      const sx = new Float32Array(N), sy = new Float32Array(N), sz = new Float32Array(N), wx = new Float32Array(N), wy = new Float32Array(N), wz = new Float32Array(N);
      const LIM = [BW, BH, BD], BK = 8, paths = [...Array(BK)].map(() => []);
      const packets = [...Array(12)].map(() => ({ a: Math.floor(r() * N), b: -1, u: 0, sp: 1.4 + r() }));
      let mouse = null;
      cv.onpointermove = e => { const b = cv.getBoundingClientRect(); mouse = [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; };
      cv.onpointerleave = () => { mouse = null; };
      return (t, dt) => {
        const D = L.p.dist, ry = t * 0.12, rx = 0.25 + Math.sin(t * 0.2) * 0.1, cy = Math.cos(ry), syy = Math.sin(ry), cx = Math.cos(rx), sxx = Math.sin(rx);
        for (let i = 0; i < N; i++) {
          const p = P[i]; for (let k = 0; k < 3; k++) { p[k] += p[k + 3] * dt; const lim = LIM[k]; if (p[k] > lim || p[k] < -lim) { p[k + 3] *= -1; p[k] = Math.max(-lim, Math.min(lim, p[k])); } }
          const x1 = p[0] * cy + p[2] * syy, z1 = -p[0] * syy + p[2] * cy, y1 = p[1] * cx - z1 * sxx, z2 = p[1] * sxx + z1 * cx;
          wx[i] = x1; wy[i] = y1; wz[i] = z2; const s = F / (z2 + CD); sx[i] = 320 + x1 * s; sy[i] = 180 + y1 * s; sz[i] = s;
        }
        g.fillStyle = '#0b0d1c'; g.fillRect(0, 0, W, H);
        for (const q of paths) q.length = 0;
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
          const dx = wx[i] - wx[j], dy = wy[i] - wy[j], dz = wz[i] - wz[j], d2 = dx * dx + dy * dy + dz * dz; if (d2 > D * D) continue;
          const a = Math.pow(1 - Math.sqrt(d2) / D, 1.4) * Math.min(1, (sz[i] + sz[j]) * 0.6), b = Math.min(BK - 1, a * BK | 0); paths[b].push(i, j);
        }
        g.lineWidth = 1;
        for (let b = 0; b < BK; b++) { const q = paths[b]; if (!q.length) continue; g.strokeStyle = `rgba(120,180,255,${((b + 0.5) / BK * 0.95).toFixed(3)})`; g.beginPath(); for (let k = 0; k < q.length; k += 2) { g.moveTo(sx[q[k]], sy[q[k]]); g.lineTo(sx[q[k + 1]], sy[q[k + 1]]); } g.stroke(); }
        if (mouse) { g.strokeStyle = 'rgba(255,90,54,0.6)'; g.beginPath(); for (let i = 0; i < N; i++) if (Math.hypot(sx[i] - mouse[0], sy[i] - mouse[1]) < 120) { g.moveTo(mouse[0], mouse[1]); g.lineTo(sx[i], sy[i]); } g.stroke(); }
        g.globalCompositeOperation = 'lighter'; for (let i = 0; i < N; i++) { const k = EX.clamp01((sz[i] - 0.6) / 0.8); if (k > 0.5) { g.fillStyle = `rgba(120,160,255,${(0.12 * k).toFixed(3)})`; g.beginPath(); g.arc(sx[i], sy[i], 4 + 6 * k, 0, TAU); g.fill(); } } g.globalCompositeOperation = 'source-over';
        for (let i = 0; i < N; i++) { const s = sz[i], k = EX.clamp01((s - 0.6) / 0.8); g.fillStyle = `rgba(${lerp(122, 220, k) | 0},${lerp(92, 236, k) | 0},255,${(0.4 + 0.6 * k).toFixed(2)})`; g.beginPath(); g.arc(sx[i], sy[i], 0.8 + 2.2 * k, 0, TAU); g.fill(); }
        for (const pk of packets) {
          if (pk.b < 0) { let best = -1; for (let j = 0; j < N; j++) { if (j === pk.a) continue; const dx = wx[pk.a] - wx[j], dy = wy[pk.a] - wy[j], dz = wz[pk.a] - wz[j]; if (dx * dx + dy * dy + dz * dz < D * D && (best < 0 || r() < 0.35)) best = j; } if (best < 0) { pk.a = Math.floor(r() * N); continue; } pk.b = best; pk.u = 0; }
          pk.u += dt * pk.sp; if (pk.u >= 1) { pk.a = pk.b; pk.b = -1; continue; }
          const x = lerp(sx[pk.a], sx[pk.b], pk.u), y = lerp(sy[pk.a], sy[pk.b], pk.u), x0 = lerp(sx[pk.a], sx[pk.b], Math.max(0, pk.u - 0.35)), y0 = lerp(sy[pk.a], sy[pk.b], Math.max(0, pk.u - 0.35));
          const gr = g.createLinearGradient(x0, y0, x, y); gr.addColorStop(0, 'rgba(255,176,32,0)'); gr.addColorStop(1, 'rgba(255,176,32,0.9)'); g.strokeStyle = gr; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x, y); g.stroke();
          g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill();
        }
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-inkwash', title: 'Ink bleed transition', aka: 'ink transition, watercolor reveal, noise threshold wipe, organic matte', tool: 'GLSL fragment shader (fbm threshold matte)', runs: 'GPU',
    notice: 'One illustration bleeds into the next like ink dropped on wet paper. The matte is distance from a drop point minus fractal noise, compared against a threshold that rises over time, so the edge creeps out in irregular fingers instead of a clean circle. A dark band right on the threshold is the ink rim, a faint darkening just outside it is the wet edge, and paper grain sits over everything.',
    use: 'scene changes in editorial and documentary pieces, art and culture promos, softer alternatives to wipes',
    params: [{ key: 'bleed', label: 'Edge roughness', min: 0, max: 1, step: 0.05, value: 0.55 }],
    prompt: 'Ink-bleed transition between two flat illustrations (a warm dusk with a sun and layered ridges, and a cool night sea with a moon and a reflected path) as a GLSL shader: the matte is distance from a drop point minus fbm noise with roughness {bleed}, compared to a threshold that eases up over 2.2 s, with a dark indigo ink rim on the edge, a faint wet halo outside it and paper grain; hold, then bleed back from another point; 7 s loop.',
    setup(cv, L) {
      const G = EX.G; const ctx = cv.getContext('2d');
      if (!G.gl) { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); return () => {}; }
      const shader = G.prog(`uniform float uProg, uDir, uBleed; uniform vec2 uOrg;
vec3 sceneA(vec2 q){
  vec3 c = mix(vec3(1., .74, .48), vec3(.38, .2, .44), smoothstep(.2, 1., q.y));
  float d = length(q - vec2(1.15, .56)); c = mix(c, vec3(1., .93, .78), smoothstep(.135, .125, d));
  for (int k = 0; k < 3; k++) { float fk = float(k); float h = .44 - fk * .11 + .05 * sin(q.x * 6. + fk * 2.1) + .025 * sin(q.x * 17. + fk * 5.); if (q.y < h) c = mix(vec3(.33, .17, .35), vec3(.13, .08, .2), fk / 2.); }
  return c;
}
vec3 sceneB(vec2 q){
  vec3 c = mix(vec3(.12, .3, .42), vec3(.04, .05, .14), smoothstep(.35, 1., q.y));
  float d = length(q - vec2(.52, .7)); c = mix(c, vec3(.93, .95, .86), smoothstep(.085, .077, d)); c += vec3(.1, .12, .1) * exp(-d * 9.);
  if (q.y < .36) { c = mix(vec3(.05, .16, .24), vec3(.02, .07, .13), (.36 - q.y) * 2.5); float s = step(.6, fract(q.y * 40. + sin(q.x * 9.) * .2)) * smoothstep(.16, .0, abs(q.x - .52)) * smoothstep(.0, .3, q.y); c = mix(c, vec3(.85, .88, .78), s * .8); }
  for (int k = 0; k < 6; k++) { vec2 sp = vec2(fract(sin(float(k) * 12.9) * 43.7) * 1.7, .55 + fract(sin(float(k) * 7.3) * 91.1) * .4); c += vec3(.9) * smoothstep(.006, .0, length(q - sp)); }
  return c;
}
void main(){
  vec2 q = vec2(vUv.x * uRes.x / uRes.y, vUv.y);
  float n = fbm(q * 3.2 + vec2(uDir * 7.1, 2.3)) * 1.1 + fbm(q * 9. - vec2(1.7, uDir * 3.)) * .25;
  float field = length(q - uOrg) - (n - .5) * uBleed * .9, T = mix(-.25, 2.2, uProg);
  float inside = smoothstep(T + .004, T - .004, field);
  vec3 a = sceneA(q), b = sceneB(q);
  vec3 col = uDir < .5 ? mix(a, b, inside) : mix(b, a, inside);
  float rim = exp(-abs(field - T) * 90.) * step(.001, uProg) * step(uProg, .999);
  float halo = smoothstep(T + .09, T, field) * (1. - inside) * step(uProg, .999);
  col = mix(col, col * vec3(.82, .82, .92), halo * .6);
  col = mix(col, vec3(.1, .08, .22), rim * .75);
  col *= .93 + .07 * vnoise(vUv * uRes * .7) + .03 * (vnoise(vUv * uRes * .08) - .5);
  o = vec4(col, 1.);
}`);
      return t => {
        const lt = t % 7, A = EX.seg(lt, 1, 3.2), B = EX.seg(lt, 4.5, 6.7), back = lt >= 3.85;
        const prog = ease.inOut(back ? B : A), org = back ? [0.35, 0.3] : [1.35, 0.72];
        G.draw(shader, null, { uProg: prog, uDir: back ? 1 : 0, uBleed: L.p.bleed, uOrg: org }, W, H); G.copy(ctx, W, H);
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-onion', title: 'Onion skin and arcs', aka: 'onion skinning, ghost frames, arcs, spacing chart, animation principles', tool: 'Canvas 2D (stepped frames + tinted ghost poses)', runs: 'CPU',
    notice: 'Animators check motion with onion skinning: the previous drawings show through in red and the next ones in green, so you can see the spacing between poses at a glance. Here a fish leaps on a parabola at 12 drawings per second and turns to follow its own path. The arc view draws the trajectory with one tick per drawing: ticks bunch up at the top where the fish slows down and spread out near the water where it is fastest.',
    use: 'teaching and reviewing animation, planning arcs and spacing, making jumps and throws feel natural',
    params: [{ key: 'skins', label: 'Ghost frames each way', min: 1, max: 5, step: 1, value: 3 }],
    controls: [{ label: 'Onion skin', on: true, fn: L => { L.mode = 0; } }, { label: 'Arc and spacing', fn: L => { L.mode = 1; } }, { label: 'Plain', fn: L => { L.mode = 2; } }],
    prompt: 'Animation teaching loop at 12 drawings per second: a coral fish leaps out of a navy sea on a parabola, rotating to follow its path, splashes and ripples on exit and entry; onion-skin view shows the {skins} previous drawings tinted red and the next ones tinted green; an arc view draws the dotted trajectory with one tick per drawing so slow-in at the apex and fast ends are visible; mode name and a one-line explanation in the corner.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const WY = 262, X0 = 140, X1 = 500, HT = 190, T0 = 0.3, T1 = 1.4, LOOP = 2.1, FPS = 12;
      const at = t => { const lt = ((t % LOOP) + LOOP) % LOOP; if (lt < T0 || lt > T1) return null; const u = (lt - T0) / (T1 - T0); return [lerp(X0, X1, u), WY + 8 - 4 * HT * u * (1 - u), Math.atan2(-4 * HT * (1 - 2 * u), X1 - X0), lt]; };
      function fish(x, y, a, lt, tint, al) {
        g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = al;
        const wag = Math.sin(lt * 22) * 0.35;
        g.fillStyle = tint || C.coral; g.beginPath(); g.save(); g.translate(-26, 0); g.rotate(wag); g.moveTo(0, 0); g.lineTo(-22, -14); g.quadraticCurveTo(-16, 0, -22, 14); g.closePath(); g.restore(); g.fill();
        g.beginPath(); g.moveTo(-4, -11); g.quadraticCurveTo(4, -24, 14, -11); g.fill();
        g.beginPath(); g.ellipse(0, 0, 31, 13, 0, 0, TAU); g.fill();
        if (!tint) { g.fillStyle = '#ffb08f'; g.beginPath(); g.ellipse(2, 5, 24, 6, 0, 0, Math.PI); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(17, -3, 4.5, 0, TAU); g.fill(); g.fillStyle = C.navy; g.beginPath(); g.arc(18.5, -3, 2.3, 0, TAU); g.fill(); g.strokeStyle = 'rgba(29,27,58,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(6, 0, 10, -1.2, 1.2); g.stroke(); }
        g.restore();
      }
      const splash = (x, dt, seed) => { if (dt < 0 || dt > 0.7) return; const r = EX.rng(seed); g.fillStyle = 'rgba(200,235,255,0.9)'; for (let i = 0; i < 14; i++) { const vx = (r() - 0.5) * 160, vy = -120 - r() * 160; const px = x + vx * dt, py = WY + vy * dt + 420 * dt * dt; if (py < WY + 4) { g.beginPath(); g.arc(px, py, 2 + r() * 2.5, 0, TAU); g.fill(); } } g.strokeStyle = `rgba(200,235,255,${0.7 * (1 - dt / 0.7)})`; g.lineWidth = 2; for (const k of [1, 1.7]) { g.beginPath(); g.ellipse(x, WY + 6, 14 + dt * 90 * k, 3 + dt * 12 * k, 0, 0, TAU); g.stroke(); } };
      return t => {
        const mode = L.mode || 0, fi = Math.floor(t * FPS), tf = fi / FPS, lt = ((tf % LOOP) + LOOP) % LOOP;
        const sky = g.createLinearGradient(0, 0, 0, WY); sky.addColorStop(0, '#16243e'); sky.addColorStop(1, '#2c4f6e'); g.fillStyle = sky; g.fillRect(0, 0, W, WY);
        if (mode === 1) {
          g.setLineDash([4, 6]); g.strokeStyle = 'rgba(244,239,230,0.45)'; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i <= 60; i++) { const u = i / 60, x = lerp(X0, X1, u), y = WY + 8 - 4 * HT * u * (1 - u); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.setLineDash([]);
          for (let k = 0; ; k++) { const tt = T0 + k / FPS; if (tt > T1) break; const p = at(tt); if (!p) continue; const past = tt <= lt; g.fillStyle = past ? C.amber : 'rgba(244,239,230,0.5)'; g.beginPath(); g.arc(p[0], p[1], 4, 0, TAU); g.fill(); }
        }
        if (mode === 0) for (let k = L.p.skins; k >= 1; k--) for (const [dir, tint] of /** @type {[number, string][]} */ ([[-1, '#ff4d4d'], [1, '#4dd88a']])) { const p = at(tf + dir * k / FPS); if (p) fish(p[0], p[1], p[2], p[3], tint, 0.42 * (1 - (k - 1) / (L.p.skins + 1))); }
        const p = at(tf);
        if (p) fish(p[0], p[1], p[2], p[3], null, 1);
        g.fillStyle = C.navy; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 8) g.lineTo(x, WY + Math.sin(x * 0.03 + tf * 3) * 3); g.lineTo(W, H); g.fill();
        g.strokeStyle = 'rgba(244,239,230,0.35)'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= W; x += 8) { const y = WY + Math.sin(x * 0.03 + tf * 3) * 3; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
        splash(X0, lt - T0, 3); splash(X1, lt - T1, 9);
        const T = [['ONION SKIN', 'red: drawings before, green: drawings after'], ['ARCS AND SPACING', 'one tick per drawing: close ticks = slow, far apart = fast'], ['PLAIN', 'just the drawing on this frame']][mode];
        g.textAlign = 'left'; g.font = '700 20px Bahnschrift'; g.fillStyle = C.cream; g.fillText(T[0], 22, 38); g.font = '12px Segoe UI'; g.fillStyle = 'rgba(244,239,230,0.65)'; g.fillText(T[1], 22, 58);
        g.textAlign = 'right'; g.font = '12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillText(`12 drawings/s  drawing ${String(Math.floor(lt * FPS)).padStart(2, '0')}`, 616, 346); g.textAlign = 'left';
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-droste', title: 'Infinite zoom (Droste)', aka: 'Droste effect, recursive zoom, infinite loop zoom, picture in picture', tool: 'Canvas 2D (nested frames + exponential scale)', runs: 'CPU',
    notice: 'The poster contains a smaller copy of itself, which contains another, and so on. Seven nested levels are drawn from the outside in, each one 0.45 times the size of the last. The camera scales by 1/0.45 every loop, exponentially so the speed feels constant, and the moment the next level fills the frame the color list shifts by one, so the zoom never ends. A twist turns each level a little more for a spiral dive.',
    use: 'hypnotic intros and outros, "deeper and deeper" story beats, music visuals, seamless social loops',
    params: [{ key: 'twist', label: 'Twist per level', min: 0, max: 30, step: 1, value: 10, unit: ' deg' }, { key: 'per', label: 'Seconds per level', min: 1, max: 6, step: 0.1, value: 2.6, unit: ' s' }],
    prompt: 'Seamless infinite-zoom loop (Droste effect) of an art-deco poster that contains itself: each level has a sunburst, a thin inner frame with corner fans and a window holding the next level at 0.45 scale, colors cycle navy, coral, amber, cyan, violet, cream per level; the camera zooms exponentially one level every {per}, each level twisted {twist} more than the last for a spiral dive, colors shift by one each loop so it never ends.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const R = 0.45, COLS = [C.navy, C.coral, C.amber, C.cyan, C.violet, '#efe3cc'];
      const INK = ['#f4efe6', '#1d1b3a', '#1d1b3a', '#1d1b3a', '#f4efe6', '#1d1b3a'];
      function level(ci, k, t, tw) {
        const bg = COLS[ci], ink = INK[ci];
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.save(); g.translate(320, 180); g.rotate((Math.abs(k) % 2 ? -1 : 1) * t * 0.15); g.fillStyle = ink; g.globalAlpha = 0.12; g.beginPath();
        for (let i = 0; i < 24; i += 2) { const a0 = i / 24 * TAU, a1 = (i + 1) / 24 * TAU; g.moveTo(0, 0); g.lineTo(Math.cos(a0) * 420, Math.sin(a0) * 420); g.lineTo(Math.cos(a1) * 420, Math.sin(a1) * 420); g.closePath(); }
        g.fill(); g.restore(); g.globalAlpha = 1;
        g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(16, 16, W - 32, H - 32);
        for (const [cx, cy, a] of /** @type {[number, number, number][]} */ ([[16, 16, 0], [W - 16, 16, Math.PI / 2], [W - 16, H - 16, Math.PI], [16, H - 16, Math.PI * 1.5]])) { g.save(); g.translate(cx, cy); g.rotate(a); g.fillStyle = ink; for (let r = 34; r > 0; r -= 12) { g.globalAlpha = r === 34 ? 0.9 : 0.5; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, 0, Math.PI / 2); g.closePath(); g.fill(); g.fillStyle = r === 34 ? bg : ink; } g.restore(); }
        g.globalAlpha = 1; g.fillStyle = ink; g.save(); g.translate(320, 180); g.rotate(tw); g.fillRect(-W * R / 2 - 8, -H * R / 2 - 8, W * R + 16, H * R + 16); g.restore();
      }
      return t => {
        const per = L.p.per, z = (t / per) % 1, n = Math.floor(t / per), tw = L.p.twist * Math.PI / 180;
        for (let k = -1; k < 7; k++) {
          const s = Math.pow(1 / R, z) * Math.pow(R, k), ci = ((n + k) % COLS.length + COLS.length) % COLS.length;
          if (s * W < 2) break;
          g.save(); g.translate(320, 180); g.rotate((k - z) * tw); g.scale(s, s); g.translate(-320, -180);
          g.beginPath(); g.rect(0, 0, W, H); g.clip(); level(ci, n + k, t, tw); g.restore();
        }
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'mg2-headturn', title: 'Head turn rig', aka: '2.5D head turn, character turnaround, feature parallax, sphere-mapped face', tool: 'Canvas 2D (features placed on a sphere and projected)', runs: 'CPU',
    notice: 'A flat character turns all the way around without a single extra drawing. Every feature sits at a longitude and latitude on an invisible sphere: as the head turns, each one slides sideways by the sine of its angle, gets narrower by the cosine, and disappears when it faces away. The nose sits slightly outside the sphere so it pokes past the outline in profile, the ears swap from behind to in front, and the hairline drops toward the back so the back view is all hair.',
    use: 'explainer characters, avatars and mascots, character sheets and turnarounds, game portraits',
    params: [{ key: 'step', label: 'Hold per view', min: 0.4, max: 3, step: 0.1, value: 1.4, unit: ' s' }],
    controls: [{ label: 'Character', on: true, fn: L => { L.rig = false; } }, { label: 'Show rig', fn: L => { L.rig = true; } }],
    prompt: 'Flat 2D character head that turns a full 360 degrees in 45-degree steps (ease-in-out turn, then hold {step}) with no extra drawings: eyes, brows, blush, mouth and nose are placed by longitude and latitude on an invisible sphere, so they slide by sin, narrow by cos and hide when facing away; the nose sits outside the sphere to stick out in profile, ears swap layers, the hairline drops toward the back so the back view is all hair; a rig view shows the sphere meridians and the feature anchors.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const CX = 320, CY = 168, RX = 88, RY = 100, SKIN = '#f2c29b', HAIR = '#3a2346';
      let th = 0;
      const P = (psi, lat, d = 1) => [CX + RX * d * Math.sin(psi - th) * Math.cos(lat), CY - RY * d * Math.sin(lat), Math.cos(psi - th)];
      const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
      const hairline = psi => { const f = Math.abs(wrap(psi)); return f < 1 ? 0.5 : f > 2.3 ? -0.8 : lerp(0.5, -0.8, ease.inOut((f - 1) / 1.3)); };
      function ear(s) { const [x, y, c] = P(s * Math.PI / 2, 0.02, 1); const w = 5 + 9 * Math.abs(Math.sin(s * Math.PI / 2 - th)); g.fillStyle = SKIN; g.beginPath(); g.ellipse(x, y, w, 19, 0, 0, TAU); g.fill(); g.fillStyle = '#dc9f7a'; g.beginPath(); g.ellipse(x, y, w * 0.5, 11, 0, 0, TAU); g.fill(); return c; }
      return t => {
        const u = t / L.p.step; th = (Math.floor(u) + ease.inOut(EX.clamp01((u % 1) / 0.4))) * Math.PI / 4;
        g.fillStyle = '#17142a'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#221d3d'; g.beginPath(); g.arc(CX, CY + 10, 150, 0, TAU); g.fill();
        g.fillStyle = C.coral; g.beginPath(); g.ellipse(CX, 352, 130, 70, 0, Math.PI, TAU); g.fill(); g.fillStyle = '#e3a07c'; g.fillRect(CX - 22, 250, 44, 42);
        for (const s of [-1, 1]) if (Math.cos(s * Math.PI / 2 - th) < 0) ear(s);
        g.fillStyle = SKIN; g.beginPath(); g.ellipse(CX, CY, RX, RY, 0, 0, TAU); g.fill();
        for (const s of [-1, 1]) if (Math.cos(s * Math.PI / 2 - th) >= 0) ear(s);
        const al = c => EX.clamp01((c - 0.05) / 0.25);
        for (const s of [-1, 1]) {
          const [bx, by, bc] = P(s * 0.6, -0.16); if (bc > 0.05) { g.globalAlpha = al(bc) * 0.5; g.fillStyle = '#ff7a8a'; g.beginPath(); g.ellipse(bx, by, 13 * bc + 1, 7, 0, 0, TAU); g.fill(); }
          const [ex, ey, ec] = P(s * 0.42, 0.1); if (ec > 0.05) { g.globalAlpha = al(ec); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey, 12 * ec + 1, 14, 0, 0, TAU); g.fill(); g.fillStyle = C.navy; g.beginPath(); g.ellipse(ex, ey + 1, 6.5 * ec + 0.5, 7.5, 0, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 2.5 * ec, ey - 3, 2.2, 0, TAU); g.fill(); }
          const [wx, wy, wc] = P(s * 0.42, 0.34); if (wc > 0.05) { g.globalAlpha = al(wc); g.strokeStyle = HAIR; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(wx - 13 * wc, wy + 2); g.quadraticCurveTo(wx, wy - 6, wx + 13 * wc, wy + 2); g.stroke(); }
        }
        const [mx, my, mc] = P(0, -0.38); if (mc > 0.05) { g.globalAlpha = al(mc); g.strokeStyle = '#b3474f'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(mx - 15 * mc, my - 2); g.quadraticCurveTo(mx, my + 9, mx + 15 * mc, my - 2); g.stroke(); }
        const [nx, ny, nc] = P(0, -0.06, 1.2), [ax, ay] = P(-0.14, -0.2, 1), [bx2, by2] = P(0.14, -0.2, 1), [qx, qy] = P(0, 0.04, 1), [rx, ry] = P(0, -0.2, 1.02);
        if (nc > -0.25) { g.globalAlpha = EX.clamp01((nc + 0.25) / 0.3); g.fillStyle = '#e3a07c'; g.beginPath(); g.moveTo(nx, ny); g.lineTo(bx2, by2); g.lineTo(ax, ay); g.closePath(); g.fill(); g.beginPath(); g.moveTo(qx, qy); g.lineTo(nx, ny); g.lineTo(rx, ry); g.closePath(); g.fill(); }
        g.globalAlpha = 1;
        const hl = [], N = 36; for (let i = 0; i <= N; i++) { const psi = th - Math.PI / 2 + Math.PI * i / N, h = hairline(psi); hl.push(P(psi, h)); }
        const hL = hairline(th - Math.PI / 2), hR = hairline(th + Math.PI / 2);
        g.fillStyle = HAIR; g.beginPath(); hl.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
        for (let i = 0; i <= 30; i++) { const a = lerp(hR, Math.PI - hL, i / 30); g.lineTo(CX + RX * 1.07 * Math.cos(a), CY - RY * 1.07 * Math.sin(a) - 4); }
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.arc(CX - 6, CY - 10, RY * 0.88, -2.3, -1.5); g.stroke();
        if (L.rig) {
          g.lineWidth = 1;
          for (let k = 0; k < 12; k++) { const psi = k * Math.PI / 6; g.strokeStyle = k === 0 ? 'rgba(255,90,54,0.9)' : 'rgba(43,196,230,0.55)'; g.beginPath(); let on = false; for (let j = 0; j <= 24; j++) { const lat = -Math.PI / 2 + Math.PI * j / 24, [x, y, c] = P(psi, lat); if (c >= 0) { on ? g.lineTo(x, y) : g.moveTo(x, y); on = true; } else on = false; } g.stroke(); }
          for (const lat of [0.34, 0.1, -0.16, -0.38]) { g.strokeStyle = 'rgba(244,239,230,0.35)'; g.beginPath(); for (let j = 0; j <= 24; j++) { const [x, y] = P(th - Math.PI / 2 + Math.PI * j / 24, lat); j ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
          g.fillStyle = C.amber; for (const [psi, lat] of [[-0.42, 0.1], [0.42, 0.1], [0, -0.38], [-0.6, -0.16], [0.6, -0.16], [0, -0.06]]) { const [x, y, c] = P(psi, lat); if (c > 0) { g.beginPath(); g.arc(x, y, 3.5, 0, TAU); g.fill(); } }
        }
        g.font = '12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.textAlign = 'left'; g.fillText(`turn ${String(Math.round(((th * 180 / Math.PI) % 360 + 360) % 360)).padStart(3, ' ')} deg`, 20, 30);
      };
    },
  });
})();
