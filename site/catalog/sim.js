/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Simulation and generative-art demos for Motion Examples.html (Canvas 2D, CPU).
(function () {
  const { C, PAL, seg, lerp, ease, noise, rng } = EX;
  const W = 640, H = 360;
  const clear = (g, a = 1, col = '11,11,16') => { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = `rgba(${col},${a})`; g.fillRect(0, 0, W, H); };
  const hsl = (h, s = 80, l = 60, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

  EX.add({
    cat: 'sim', id: 'flowfield', title: 'Flow field', aka: 'Perlin flow, curl noise trails, vector field art', tool: 'Canvas 2D (GPU version: WebGL)', runs: 'CPU',
    notice: 'A noise function gives every point on the canvas a direction. 2,500 particles follow those directions and the old frames fade slowly, so their paths become silky trails.',
    use: 'abstract backgrounds, generative posters, ambient loops',
    prompt: "Flow-field animation: 5,000 particles follow slowly changing Perlin noise (noise scale {scale}), each moves {step} per frame, trails fade by {fade} per frame, warm-to-cool palette by direction, loopable.",
    params: [{"key": "scale", "label": "Noise scale", "min": 0.001, "max": 0.012, "step": 0.0005, "value": 0.0035, "dec": 4}, {"key": "step", "label": "Step length", "min": 0.5, "max": 4, "step": 0.1, "value": 1.6, "unit": " px"}, {"key": "fade", "label": "Trail fade", "min": 0.01, "max": 0.3, "step": 0.01, "value": 0.06}], stepped: true, setup(cv, L) {
      const g = cv.getContext('2d'); const r = rng(3); const N = 2500;
      const ps = [...Array(N)].map(() => ({ x: r() * W, y: r() * H }));
      clear(g);
      return (t) => {
        g.fillStyle = `rgba(11,11,16,${L.p.fade})`; g.fillRect(0, 0, W, H); g.lineWidth = 1.2;
        for (const p of ps) {
          const a = noise(p.x * L.p.scale, p.y * L.p.scale, t * 0.12) * Math.PI * 4;
          const nx = p.x + Math.cos(a) * L.p.step, ny = p.y + Math.sin(a) * L.p.step;
          g.strokeStyle = hsl((a * 57.3 + t * 10) % 360 * 0.35 + 5, 85, 62, 0.55);
          g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(nx, ny); g.stroke();
          p.x = nx; p.y = ny;
          if (p.x < 0 || p.x > W || p.y < 0 || p.y > H || r() < 0.004) { p.x = r() * W; p.y = r() * H; }
        }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'boids', title: 'Flocking', aka: 'boids, swarm, crowd simulation', tool: 'Canvas 2D (JavaScript)', runs: 'CPU',
    notice: 'Each bird follows three rules: keep some distance, match neighbors\' direction, move toward the group. Nobody leads, yet a flock appears. Color shows heading.',
    use: 'nature scenes, data swarms, organic crowd motion',
    prompt: "Boids flocking simulation, 300 agents: separation {sep}, alignment {ali}, cohesion {coh}, small triangles colored by heading, the flock avoids the mouse cursor.",
    params: [{"key": "sep", "label": "Separation", "min": 0, "max": 0.3, "step": 0.01, "value": 0.05}, {"key": "ali", "label": "Alignment", "min": 0, "max": 0.3, "step": 0.01, "value": 0.05}, {"key": "coh", "label": "Cohesion", "min": 0, "max": 0.004, "step": 0.0001, "value": 0.0009, "dec": 4}], setup(cv, L) {
      const g = cv.getContext('2d'); const r = rng(11); const N = 170;
      const b = [...Array(N)].map(() => ({ x: r() * W, y: r() * H, vx: r() * 2 - 1, vy: r() * 2 - 1 }));
      return (t, dt) => {
        clear(g, 0.35);
        const k = dt * 60;
        for (const p of b) {
          let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, n = 0;
          for (const q of b) { if (q === p) continue; let dx = q.x - p.x, dy = q.y - p.y; const d2 = dx * dx + dy * dy; if (d2 < 2500) { n++; ax += q.vx; ay += q.vy; cx += dx; cy += dy; if (d2 < 300) { sx -= dx / (d2 + 1) * 12; sy -= dy / (d2 + 1) * 12; } } }
          if (n) { p.vx += (ax / n - p.vx) * L.p.ali + cx / n * L.p.coh + sx * L.p.sep; p.vy += (ay / n - p.vy) * L.p.ali + cy / n * L.p.coh + sy * L.p.sep; }
          p.vx += Math.cos(t * 0.3) * 0.004; p.vy += Math.sin(t * 0.4) * 0.004;
          const s = Math.hypot(p.vx, p.vy) || 1, sp = Math.min(Math.max(s, 1.4), 2.6); p.vx = p.vx / s * sp; p.vy = p.vy / s * sp;
          p.x = (p.x + p.vx * k + W) % W; p.y = (p.y + p.vy * k + H) % H;
          const a = Math.atan2(p.vy, p.vx);
          g.save(); g.translate(p.x, p.y); g.rotate(a); g.fillStyle = hsl((a * 57.3 + 360) % 360 * 0.5 + 170, 80, 62); g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, 3.5); g.lineTo(-5, -3.5); g.fill(); g.restore();
        }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'cloth2d', title: 'Cloth (Verlet)', aka: 'cloth simulation, mass-spring, soft constraint physics', tool: 'Canvas 2D (JavaScript physics)', runs: 'CPU',
    notice: 'A grid of points linked by stick constraints, pinned along the top. Gravity and gusts of wind push the points; the sticks pull them back. Shading follows how much each patch leans.',
    use: 'flags, banners, curtains, fabric logo reveals',
    prompt: "Cloth banner pinned along the top, Verlet physics, gusty wind at {wind} strength, gravity {grav}, shading from the fold angle, my logo printed on it. In Blender for a realistic version.",
    params: [{"key": "wind", "label": "Wind strength", "min": 0, "max": 4, "step": 0.1, "value": 1, "unit": "x"}, {"key": "grav", "label": "Gravity", "min": 0.05, "max": 1, "step": 0.05, "value": 0.35}], stepped: true, setup(cv, L) {
      const g = cv.getContext('2d'); const NX = 30, NY = 17, S = 14, x0 = (W - (NX - 1) * S) / 2, y0 = 40;
      const P = []; for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) P.push({ x: x0 + i * S, y: y0 + j * S, px: x0 + i * S, py: y0 + j * S, pin: j === 0 && i % 4 === 0 });
      const id = (i, j) => j * NX + i; const K = [];
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { if (i < NX - 1) K.push([id(i, j), id(i + 1, j)]); if (j < NY - 1) K.push([id(i, j), id(i, j + 1)]); }
      return (t, dt) => {
        clear(g, 1, '13,13,20');
        const wind = ((0.5 + 0.5 * Math.sin(t * 1.1)) * 0.11 + 0.05 * Math.sin(t * 4.3)) * L.p.wind;
        for (const p of P) { if (p.pin) continue; const vx = (p.x - p.px) * 0.99, vy = (p.y - p.py) * 0.99; p.px = p.x; p.py = p.y; p.x += vx + wind * (0.6 + 0.4 * noise(p.x * 0.01, p.y * 0.01, t)); p.y += vy + L.p.grav; }
        for (let it = 0; it < 5; it++) for (const [a, b] of K) { const A = P[a], B = P[b]; const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, f = (d - S) / d * 0.5; if (!A.pin) { A.x += dx * f; A.y += dy * f; } if (!B.pin) { B.x -= dx * f; B.y -= dy * f; } }
        for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
          const a = P[id(i, j)], b = P[id(i + 1, j)], c = P[id(i + 1, j + 1)], d = P[id(i, j + 1)];
          const lean = ((b.x - a.x) - S) / S; const sh = Math.max(0.35, Math.min(1.2, 0.85 + lean * 2.2 + (c.y - b.y - S) / S));
          const base = (Math.floor(i / 5) + Math.floor(j / 4)) % 2 ? [255, 90, 54] : [255, 176, 32];
          g.fillStyle = `rgb(${base[0] * sh | 0},${base[1] * sh | 0},${base[2] * sh | 0})`;
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); g.fill();
        }
        g.fillStyle = C.cream; for (const p of P) if (p.pin) { g.beginPath(); g.arc(p.x, p.y, 4, 0, 7); g.fill(); }
        void dt;
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'springtail', title: 'Spring chain', aka: 'follow-through, overlapping action, secondary motion, IK tail', tool: 'Canvas 2D (spring physics)', runs: 'CPU',
    notice: 'The head moves along a curve. Each segment springs toward the one in front, so the tail lags, swings and settles. This is follow-through, made by physics instead of keyframes.',
    use: 'tails, ribbons, cables, character secondary motion, cursor trails',
    prompt: "A glowing ribbon follows the cursor with spring physics: 30 segments, each springs toward the previous one (stiffness {k}, damping {damp}), gravity {grav}, tapering width, coral to violet.",
    params: [{"key": "k", "label": "Stiffness", "min": 0.02, "max": 0.6, "step": 0.01, "value": 0.25}, {"key": "damp", "label": "Damping", "min": 0.5, "max": 0.98, "step": 0.01, "value": 0.82}, {"key": "grav", "label": "Gravity", "min": 0, "max": 1, "step": 0.05, "value": 0.35}], stepped: true, setup(cv, L) {
      const g = cv.getContext('2d'); const N = 34; const seg2 = [...Array(N)].map((_, i) => ({ x: W / 2, y: H / 2 + i * 10, vx: 0, vy: 0 }));
      return (t) => {
        clear(g, 0.4);
        seg2[0].x = W / 2 + Math.sin(t * 1.3) * 220 + Math.sin(t * 3.1) * 30; seg2[0].y = H / 2 + Math.sin(t * 2.1) * 110;
        for (let i = 1; i < N; i++) {
          // spring toward a point one rest length behind the segment ahead, plus gravity, then cap the stretch
          const a = seg2[i - 1], p = seg2[i]; let dx = p.x - a.x, dy = p.y - a.y; const d = Math.hypot(dx, dy) || 1;
          const tx = a.x + dx / d * 10, ty = a.y + dy / d * 10;
          p.vx = (p.vx + (tx - p.x) * L.p.k) * L.p.damp; p.vy = (p.vy + (ty - p.y) * L.p.k + L.p.grav) * L.p.damp; p.x += p.vx; p.y += p.vy;
          dx = p.x - a.x; dy = p.y - a.y; const d2 = Math.hypot(dx, dy); if (d2 > 13) { p.x = a.x + dx / d2 * 13; p.y = a.y + dy / d2 * 13; }
        }
        for (let i = N - 1; i > 0; i--) { const a = seg2[i - 1], p = seg2[i], k = 1 - i / N; g.strokeStyle = `rgb(${lerp(122, 255, k)},${lerp(92, 90, k)},${lerp(255, 54, k)})`; g.lineWidth = 3 + k * 22; g.lineCap = 'round'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(p.x, p.y); g.stroke(); }
        g.fillStyle = C.cream; g.beginPath(); g.arc(seg2[0].x, seg2[0].y, 9, 0, 7); g.fill();
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'tree', title: 'Growing tree', aka: 'L-system, recursive branching, procedural growth', tool: 'Canvas 2D (recursion)', runs: 'CPU',
    notice: 'One rule repeated: a branch splits into two smaller branches. Growth is animated by depth, branches sway with a phase offset per level, and blossoms pop at the tips.',
    use: 'nature themes, growth metaphors, "building something" intros',
    prompt: "Procedural tree grows from a seed in 3 s (recursive branching, 9 levels, branch angle {spread}, each branch {ratio} as long as its parent), sways in wind, coral blossoms pop at the tips with ease-out-back.",
    params: [{"key": "spread", "label": "Branch angle", "min": 0.1, "max": 1.2, "step": 0.02, "value": 0.42, "unit": " rad"}, {"key": "ratio", "label": "Length ratio", "min": 0.6, "max": 0.82, "step": 0.01, "value": 0.76}], setup(cv, L) {
      const g = cv.getContext('2d');
      return (t) => {
        clear(g); const lt = t % 7, grow = ease.out(seg(lt, 0, 3.4)) * 10, fade = 1 - seg(lt, 6.4, 7);
        g.globalAlpha = fade; let leaf = 0;
        const br = (x, y, a, len, d) => {
          const k = Math.min(1, Math.max(0, grow - d)); if (k <= 0) return;
          const sway = Math.sin(lt * 1.6 + d * 0.6) * 0.03 * d;
          const ex = x + Math.cos(a + sway) * len * k, ey = y + Math.sin(a + sway) * len * k;
          g.strokeStyle = d < 3 ? '#cfc6b8' : `rgba(244,239,230,${0.9 - d * 0.06})`; g.lineWidth = Math.max(1, 9 - d); g.lineCap = 'round';
          g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
          if (d >= 8) { const bk = ease.back(seg(lt, 2.9 + (leaf++ % 40) * 0.02, 3.4 + (leaf % 40) * 0.02)); if (bk > 0) { g.fillStyle = PAL[leaf % 3]; g.beginPath(); g.arc(ex, ey, 4 * bk, 0, 7); g.fill(); } return; }
          if (k < 1) return;
          const spread = L.p.spread + 0.06 * Math.sin(d * 3.1);
          br(ex, ey, a - spread, len * L.p.ratio, d + 1); br(ex, ey, a + spread * 0.9, len * (L.p.ratio - 0.04), d + 1);
        };
        br(W / 2, H - 20, -Math.PI / 2, 78, 0); g.globalAlpha = 1;
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'packing', title: 'Circle packing', aka: 'space filling, packing growth, generative layout', tool: 'Canvas 2D (JavaScript)', runs: 'CPU',
    notice: 'New circles appear in free space and grow until they touch a neighbor or the edge. The screen fills with tightly packed shapes, smallest last.',
    use: 'generative backgrounds, logo fills, poster art',
    prompt: 'Circle packing animation that fills the word "GROW": circles spawn inside the letters and grow until they touch, palette coral/amber/cyan, 6 s, then dissolve.',
    setup(cv) {
      const g = cv.getContext('2d'); let cs = [], r = rng(1), cyc = -1;
      return (t) => {
        const c = Math.floor(t / 7); if (c !== cyc) { cyc = c; cs = []; r = rng(100 + c); }
        const lt = t % 7, fade = 1 - seg(lt, 6.3, 7);
        if (lt < 5.5) for (let a = 0; a < 12; a++) { const x = r() * W, y = r() * H; if (!cs.some(q => Math.hypot(q.x - x, q.y - y) < q.r + 2)) cs.push({ x, y, r: 1, grow: true, c: PAL[Math.floor(r() * 4)] }); }
        for (const p of cs) if (p.grow) { p.r += 0.6; if (p.x - p.r < 0 || p.x + p.r > W || p.y - p.r < 0 || p.y + p.r > H) p.grow = false; else for (const q of cs) if (q !== p && Math.hypot(q.x - p.x, q.y - p.y) < q.r + p.r + 1.5) { p.grow = false; break; } }
        clear(g); g.globalAlpha = fade;
        for (const p of cs) { g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
        g.globalAlpha = 1;
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'ridges', title: 'Ridgelines', aka: 'joy plot, Unknown Pleasures lines, terrain lines', tool: 'Canvas 2D (noise)', runs: 'CPU',
    notice: 'Forty lines, each a slice of moving noise that is strongest in the middle. Each line is filled black first, so it hides the lines behind it and the stack reads as 3D.',
    use: 'music visuals, album-style art, data-flavored intros',
    prompt: "Joy-plot ridgeline animation: 45 stacked lines of flowing noise, peaks up to {amp} tall in the center, flowing at speed {flow}, black fill hides lines behind, cream strokes, loopable.",
    params: [{"key": "amp", "label": "Peak height", "min": 20, "max": 220, "step": 5, "value": 120, "unit": " px"}, {"key": "flow", "label": "Flow speed", "min": 0, "max": 2, "step": 0.05, "value": 0.6}], setup(cv, L) {
      const g = cv.getContext('2d');
      return (t) => {
        clear(g, 1, '8,8,12');
        const lines = 40, x0 = 150, x1 = 490;
        for (let i = 0; i < lines; i++) {
          const y = 60 + i * 6.6; g.beginPath(); g.moveTo(x0, y);
          for (let x = x0; x <= x1; x += 4) { const u = (x - x0) / (x1 - x0), env = Math.pow(Math.sin(u * Math.PI), 4); const n = noise(x * 0.025, i * 0.35 - t * L.p.flow, t * 0.2); g.lineTo(x, y - Math.pow(n, 2.2) * L.p.amp * env - 1.5 * Math.sin(u * 30 + t)); }
          g.lineTo(x1, y); g.fillStyle = '#08080c'; g.fill(); g.strokeStyle = C.cream; g.lineWidth = 1.4; g.stroke();
        }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'harmono', title: 'Harmonograph', aka: 'Lissajous, pendulum drawing, spirograph', tool: 'Canvas 2D (math curves)', runs: 'CPU',
    notice: 'Two damped pendulums move the pen in x and two in y. Slightly different frequencies make the line drift and spiral inward. The drawing is revealed over time like a trim path.',
    use: 'elegant line art, logo backgrounds, meditative loops',
    prompt: 'Harmonograph line drawing: four damped sine pendulums (frequencies 2, 3, 3.01, 2), line draws on over 5 s with a gradient stroke, then fades and redraws with new ratios.',
    setup(cv) {
      const g = cv.getContext('2d'); const sets = [[2, 3, 3.01, 2], [3, 2.01, 4, 3], [5, 4, 4.02, 3], [2, 1.002, 3, 2]];
      return (t) => {
        clear(g); const cyc = 6.5, k = Math.floor(t / cyc) % sets.length, lt = t % cyc, f = sets[k];
        const prog = ease.inOut(seg(lt, 0.1, 5.0)), fade = 1 - seg(lt, 5.9, 6.5), N = 2600, n = Math.floor(N * prog);
        let px, py;
        for (let i = 0; i <= n; i++) {
          const s = i / N * 60, d = Math.exp(-s * 0.035);
          const x = W / 2 + 160 * d * (Math.sin(f[0] * s * 0.5 + 1) + Math.sin(f[1] * s * 0.5) * 0.5) * 0.66;
          const y = H / 2 + 120 * d * (Math.sin(f[2] * s * 0.5 + 0.5) + Math.sin(f[3] * s * 0.5 + 2) * 0.5) * 0.66;
          if (i) { g.strokeStyle = hsl(10 + i / N * 260, 85, 62, 0.85 * fade); g.lineWidth = 1.3; g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke(); }
          px = x; py = y;
        }
        if (n > 0) { g.fillStyle = C.cream; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill(); }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'warp', title: 'Warp-speed starfield', aka: 'hyperspace, star streaks, speed lines', tool: 'Canvas 2D (3D projection)', runs: 'CPU',
    notice: 'Stars are 3D points flying toward the camera. Each is drawn as a line from where it was to where it is, so streaks get longer as the speed ramps up into the jump.',
    use: 'transitions, launch moments, sci-fi intros',
    prompt: "Starfield that ramps from cruise to warp speed {max} over 2 s: star streak length scales with speed, white flash at the jump, then cuts to my title.",
    params: [{"key": "max", "label": "Top speed", "min": 10, "max": 200, "step": 5, "value": 80}], setup(cv, L) {
      const g = cv.getContext('2d'); const r = rng(5); const S = [...Array(900)].map(() => ({ x: (r() - 0.5) * 2000, y: (r() - 0.5) * 1200, z: r() * 1000 + 1 }));
      return (t, dt) => {
        const lt = t % 6, sp = lt < 2 ? 3 : lt < 4 ? 3 + Math.pow(seg(lt, 2, 4), 3) * L.p.max : (L.p.max + 3) * (1 - ease.out(seg(lt, 4, 6))) + 3;
        clear(g, 0.9, '5,5,10');
        for (const s of S) {
          const z0 = s.z; s.z -= sp * dt * 60; if (s.z < 1) { s.z += 1000; continue; }
          const p0x = W / 2 + s.x / z0 * 180, p0y = H / 2 + s.y / z0 * 180, p1x = W / 2 + s.x / s.z * 180, p1y = H / 2 + s.y / s.z * 180;
          const b = Math.min(1, 300 / s.z); g.strokeStyle = `rgba(${lerp(180, 255, b)},${lerp(200, 240, b)},255,${b})`; g.lineWidth = Math.max(0.6, 2.4 * b);
          g.beginPath(); g.moveTo(p0x, p0y); g.lineTo(p1x, p1y); g.stroke();
        }
        const fl = Math.exp(-Math.abs(lt - 4) * 9); if (fl > 0.02) { g.fillStyle = `rgba(255,255,255,${fl * 0.8})`; g.fillRect(0, 0, W, H); }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'barrace', title: 'Bar chart race', aka: 'racing bars, animated ranking, data animation', tool: 'Canvas 2D (D3 or Remotion also work)', runs: 'CPU',
    notice: 'Values change smoothly over the years. Bars resize, re-sort and slide to their new rank with easing, while labels count along. The year ticks in the corner.',
    use: 'data stories, rankings over time, social-media explainers',
    prompt: 'Bar chart race from my CSV (years 2015 to 2025, top 8 items): bars re-sort with smooth sliding, values count up, big year counter bottom right, 20 s total.',
    setup(cv) {
      const g = cv.getContext('2d'); const names = ['WebGL', 'Blender', 'Unreal', 'Canvas', 'Shaders', 'Remotion', 'Three.js', 'p5.js'];
      const r = rng(9); const Y = 11; const data = names.map(() => { let v = 20 + r() * 40; return [...Array(Y)].map(() => (v += r() * 22 - 4)); });
      const rank = names.map((_, i) => i);
      return (t, dt) => {
        clear(g, 1, '16,16,24'); const u = (t % 12) / 11 * (Y - 1), y0 = Math.floor(Math.min(u, Y - 1.001)), f = ease.inOut(u - y0);
        const vals = data.map(d => lerp(d[y0], d[Math.min(Y - 1, y0 + 1)], f)); const max = Math.max(...vals);
        const order = vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
        order.forEach((i, pos) => { rank[i] = lerp(rank[i], pos, 1 - Math.exp(-dt * 8)); });
        names.forEach((nm, i) => {
          const y = 30 + rank[i] * 38, w = vals[i] / max * 420;
          g.fillStyle = PAL[i % 4]; g.globalAlpha = 0.9; g.beginPath(); g.roundRect(130, y, w, 28, 6); g.fill(); g.globalAlpha = 1;
          g.font = '600 15px Segoe UI'; g.fillStyle = C.cream; g.textAlign = 'right'; g.fillText(nm, 120, y + 19);
          g.textAlign = 'left'; g.font = '500 14px Cascadia Mono, Consolas'; g.fillText(Math.round(vals[i]), 138 + w, y + 19);
        });
        g.font = '700 64px Bahnschrift'; g.fillStyle = 'rgba(244,239,230,0.18)'; g.textAlign = 'right'; g.fillText(2015 + Math.round(u), 620, 340); g.textAlign = 'left';
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'hexballs', title: 'Balls in a spinning hexagon', aka: '2D rigid-body physics, collision simulation', tool: 'Canvas 2D (JavaScript physics)', runs: 'CPU',
    notice: 'Gravity pulls the balls down; they bounce off each other and off the walls of a rotating hexagon. The moving walls throw the balls, so they never settle.',
    use: 'physics showcases, satisfying loops, game-like motion',
    prompt: "2D physics: 14 balls bounce inside a hexagon spinning at {spin}, gravity {grav}, restitution {bounce}, ball-to-ball collisions, motion trails, colors from my palette.",
    params: [{"key": "grav", "label": "Gravity", "min": 0, "max": 0.5, "step": 0.01, "value": 0.18}, {"key": "bounce", "label": "Bounciness", "min": 0.3, "max": 1, "step": 0.05, "value": 0.85}, {"key": "spin", "label": "Spin speed", "min": -3, "max": 3, "step": 0.1, "value": 0.8, "unit": " rad/s"}], setup(cv, L) {
      const g = cv.getContext('2d'); const r = rng(4); const R = 150, cx = W / 2, cy = H / 2;
      const B = [...Array(14)].map((_, i) => ({ x: cx + (r() - 0.5) * 120, y: cy + (r() - 0.5) * 120, vx: (r() - 0.5) * 4, vy: (r() - 0.5) * 4, r: 9 + r() * 7, c: PAL[i % 4] }));
      return (t, dt) => {
        clear(g, 0.3); const om = L.p.spin, ang = t * om;
        const V = [...Array(6)].map((_, i) => [cx + Math.cos(ang + i * Math.PI / 3) * R, cy + Math.sin(ang + i * Math.PI / 3) * R]);
        const steps = 4, h = Math.min(dt, 1 / 30) * 60 / steps;
        for (let s = 0; s < steps; s++) {
          for (const b of B) { b.vy += L.p.grav * h; b.x += b.vx * h; b.y += b.vy * h; }
          for (const b of B) for (let i = 0; i < 6; i++) {
            const [ax, ay] = V[i], [bx, by] = V[(i + 1) % 6]; const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey;
            const u = Math.max(0, Math.min(1, ((b.x - ax) * ex + (b.y - ay) * ey) / L2)); const px = ax + ex * u, py = ay + ey * u;
            let nx = cx - px, ny = cy - py; const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
            const d = (b.x - px) * nx + (b.y - py) * ny;
            if (d < b.r) {
              b.x += nx * (b.r - d); b.y += ny * (b.r - d);
              const wvx = -om * (py - cy) / 60, wvy = om * (px - cx) / 60;
              const rvx = b.vx - wvx, rvy = b.vy - wvy, vn = rvx * nx + rvy * ny;
              if (vn < 0) { b.vx -= (1 + L.p.bounce) * vn * nx; b.vy -= (1 + L.p.bounce) * vn * ny; }
            }
          }
          for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
            const a = B[i], c = B[j]; let dx = c.x - a.x, dy = c.y - a.y; const d = Math.hypot(dx, dy), m = a.r + c.r;
            if (d < m && d > 0) { dx /= d; dy /= d; const o = (m - d) / 2; a.x -= dx * o; a.y -= dy * o; c.x += dx * o; c.y += dy * o; const vn = (c.vx - a.vx) * dx + (c.vy - a.vy) * dy; if (vn < 0) { a.vx += vn * dx * 0.95; a.vy += vn * dy * 0.95; c.vx -= vn * dx * 0.95; c.vy -= vn * dy * 0.95; } }
          }
        }
        g.strokeStyle = C.cream; g.lineWidth = 4; g.lineJoin = 'round'; g.beginPath(); V.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke();
        for (const b of B) { g.fillStyle = b.c; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill(); }
      };
    },
  });
})();
