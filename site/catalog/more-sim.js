// More simulation and generative demos for Motion Examples.html (Canvas 2D, CPU).
(function () {
  const { C, PAL, seg, lerp, ease, rng } = EX;
  const W = 640, H = 360;
  const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  EX.add({
    cat: 'sim', id: 'physarum', title: 'Slime mold network', aka: 'Physarum simulation, agent trails, transport networks', tool: 'JavaScript agents + trail map (GPU version: compute shader)', runs: 'CPU',
    notice: '12,000 tiny agents each sniff the trail ahead with three sensors, turn toward the strongest scent, step forward and leave scent behind. The trail blurs and fades. Out of these simple rules, glowing vein networks appear and keep rewiring.',
    use: 'organic tech visuals, network and connection metaphors, biology',
    prompt: "Physarum slime-mold simulation with 200k agents on the GPU: sensor angle {sa}, sensor distance {so}, turn {ra}, trail fades {decay} per step, glowing amber-to-violet veins that slowly connect points of my logo.",
    params: [{"key": "sa", "label": "Sensor angle", "min": 0.1, "max": 1.5, "step": 0.02, "value": 0.52, "unit": " rad"}, {"key": "so", "label": "Sensor distance", "min": 2, "max": 20, "step": 1, "value": 9, "unit": " px"}, {"key": "ra", "label": "Turn amount", "min": 0.05, "max": 1.2, "step": 0.05, "value": 0.4, "unit": " rad"}, {"key": "decay", "label": "Fade per step", "min": 0.002, "max": 0.05, "step": 0.001, "value": 0.012, "dec": 3}], stepped: true, setup(cv, L) {
      const g = cv.getContext('2d'); const SW = 320, SH = 180, N = 12000; const r = rng(21);
      let trail = new Float32Array(SW * SH), tmp = new Float32Array(SW * SH);
      const ax = new Float32Array(N), ay = new Float32Array(N), aa = new Float32Array(N);
      for (let i = 0; i < N; i++) { ax[i] = 2 + r() * (SW - 4); ay[i] = 2 + r() * (SH - 4); aa[i] = r() * 6.283; }
      const img = g.createImageData(SW, SH); const oc = document.createElement('canvas'); oc.width = SW; oc.height = SH; const og = oc.getContext('2d');
      const lut = []; for (let i = 0; i < 256; i++) { const k = i / 255; lut.push([lerp(8, 255, Math.pow(k, 0.8)) * (k > 0.5 ? 1 : 0.6 + 0.8 * k), lerp(6, 190, Math.pow(k, 1.6)), lerp(14, 80, k) + 120 * Math.sin(k * 3.14) * 0.6]); }
      
      const sense = (x, y, a) => { const sx = ((x + Math.cos(a) * L.p.so) % SW + SW) % SW | 0, sy = ((y + Math.sin(a) * L.p.so) % SH + SH) % SH | 0; return trail[sy * SW + sx]; };
      return () => {
        for (let i = 0; i < N; i++) {
          const x = ax[i], y = ay[i], a = aa[i];
          const f = sense(x, y, a), l = sense(x, y, a - L.p.sa), rr = sense(x, y, a + L.p.sa);
          const turn = L.p.ra * (0.5 + r()); if (f >= l && f >= rr) { /* strongest ahead: keep going */ } else if (f < l && f < rr) aa[i] += (r() - 0.5) * 2 * turn; else if (l > rr) aa[i] -= turn; else aa[i] += turn;
          let nx = x + Math.cos(aa[i]), ny = y + Math.sin(aa[i]);
          nx = (nx + SW) % SW; ny = (ny + SH) % SH;
          ax[i] = nx; ay[i] = ny; const ti = (ny | 0) * SW + (nx | 0); trail[ti] = Math.min(1, trail[ti] + 0.35);
        }
        // blur and fade every cell, wrapping at the edges (skipping edge cells lets scent pile up there forever)
        for (let y = 0; y < SH; y++) {
          const yu = ((y + SH - 1) % SH) * SW, yc = y * SW, yd = ((y + 1) % SH) * SW;
          for (let x = 0; x < SW; x++) {
            const xl = (x + SW - 1) % SW, xr = (x + 1) % SW;
            const sum = trail[yu + xl] + trail[yu + x] + trail[yu + xr] + trail[yc + xl] + trail[yc + x] + trail[yc + xr] + trail[yd + xl] + trail[yd + x] + trail[yd + xr];
            tmp[yc + x] = Math.max(0, trail[yc + x] * 0.7 + sum / 9 * 0.3 - L.p.decay);
          }
        }
        [trail, tmp] = [tmp, trail];
        const d = img.data; for (let i = 0; i < SW * SH; i++) { const c = lut[Math.min(255, (trail[i] * 255) | 0)]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
        og.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(oc, 0, 0, W, H);
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'softblob', title: 'Soft-body blobs (2D)', aka: 'pressure soft body, jelly physics, squishy blobs', tool: 'JavaScript (springs + pressure)', runs: 'CPU',
    notice: 'Each blob is a ring of 28 points joined by springs. A pressure force pushes outward to keep its area, like air in a balloon. They hop, squash on landing and wobble back to round. Compare with the Blender jelly clip further down.',
    use: 'playful characters, mascots, bouncy UI and logos',
    prompt: "Three soft-body blobs (spring ring + internal pressure {press}) hop in turn with jump strength {jump}, squash on landing and wobble, cute eyes that follow the motion, pastel colors on a dark floor.",
    params: [{"key": "press", "label": "Inner pressure", "min": 0.2, "max": 6, "step": 0.1, "value": 2.4}, {"key": "jump", "label": "Jump strength", "min": 2, "max": 16, "step": 0.5, "value": 9}], stepped: true, setup(cv, L) {
      const g = cv.getContext('2d'); const N = 28, floorY = 310;
      const mk = (cx, cy, R, col, ph) => { const p = [...Array(N)].map((_, i) => { const a = i / N * 6.283; return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, px: cx + Math.cos(a) * R, py: cy + Math.sin(a) * R }; }); const area0 = Math.PI * R * R; return { p, R, col, ph, area0, rest: 2 * R * Math.sin(Math.PI / N) }; };
      const blobs = [mk(170, 200, 52, C.coral, 0), mk(330, 180, 64, C.amber, 0.9), mk(490, 200, 48, C.cyan, 1.8)];
      return (t, dt) => {
        g.fillStyle = '#12101c'; g.fillRect(0, 0, W, H); g.fillStyle = '#1d1a2c'; g.fillRect(0, floorY, W, H - floorY);
        const steps = 3;
        for (const b of blobs) {
          const cyc = (t + b.ph) % 2.7; const jump = cyc < dt * 1.01;
          for (let s = 0; s < steps; s++) {
            for (const q of b.p) { const vx = (q.x - q.px) * 0.995, vy = (q.y - q.py) * 0.995; q.px = q.x; q.py = q.y; q.x += vx; q.y += vy + 0.18; if (jump && s === 0) q.py += L.p.jump; }
            let area = 0; for (let i = 0; i < N; i++) { const a = b.p[i], c = b.p[(i + 1) % N]; area += a.x * c.y - c.x * a.y; } area = Math.abs(area) / 2;
            const press = (b.area0 - area) / b.area0 * L.p.press;
            for (let it = 0; it < 4; it++) for (let i = 0; i < N; i++) {
              const a = b.p[i], c = b.p[(i + 1) % N]; const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - b.rest) / d * 0.5;
              a.x += dx * f; a.y += dy * f; c.x -= dx * f; c.y -= dy * f;
              const nx = dy / d, ny = -dx / d; a.x += nx * press; a.y += ny * press; c.x += nx * press; c.y += ny * press;
            }
            for (const q of b.p) { if (q.y > floorY) { q.y = floorY; q.px = q.x - (q.x - q.px) * 0.6; } if (q.x < 10) q.x = 10; if (q.x > W - 10) q.x = W - 10; }
          }
          let cx = 0, cy = 0; b.p.forEach(q => { cx += q.x; cy += q.y; }); cx /= N; cy /= N;
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(cx, floorY + 6, Math.max(4, b.R * (1.2 - (floorY - cy) / 500)), 7, 0, 0, 7); g.fill();
          g.fillStyle = b.col; g.beginPath();
          for (let i = 0; i <= N; i++) { const a = b.p[i % N], c = b.p[(i + 1) % N], mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2; i ? g.quadraticCurveTo(a.x, a.y, mx, my) : g.moveTo(mx, my); }
          g.fill();
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(cx - b.R * 0.3, cy - b.R * 0.35, b.R * 0.22, b.R * 0.12, -0.5, 0, 7); g.fill();
          const vy = b.p[0].y - b.p[0].py;
          [-1, 1].forEach(sx => { g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + sx * b.R * 0.28, cy - 6, 9, 0, 7); g.fill(); g.fillStyle = '#14101e'; g.beginPath(); g.arc(cx + sx * b.R * 0.28, cy - 6 + Math.max(-4, Math.min(4, vy)), 4.5, 0, 7); g.fill(); });
        }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'sand', title: 'Falling sand', aka: 'cellular automaton, pixel physics, powder simulation', tool: 'JavaScript grid (cellular automaton)', runs: 'CPU',
    notice: 'The screen is a grid of cells. Each frame, every sand grain looks below it: if empty it falls, if blocked it tries to slide diagonally. Three spouts pour colored sand that piles into dunes, then the floor opens.',
    use: 'satisfying loops, pixel-art games, "filling" transitions',
    prompt: 'Falling-sand cellular automaton: three moving spouts pour coral, amber and cyan sand that piles into striped dunes, then the floor opens and it all drains, pixel-art look, 12 s loop.',
    setup(cv) {
      const g = cv.getContext('2d'); const SW = 160, SH = 90; let grid = new Uint8Array(SW * SH); const r = rng(77);
      const cols = [null, ...[C.coral, C.amber, C.cyan, C.violet].map(hexRGB)]; const img = g.createImageData(SW, SH); const oc = document.createElement('canvas'); oc.width = SW; oc.height = SH; const og = oc.getContext('2d');
      let cyc = -1;
      return t => {
        const c = Math.floor(t / 12); if (c !== cyc) { cyc = c; grid.fill(0); }
        const lt = t % 12, drain = lt > 9.5;
        if (lt < 8.5) for (let s = 0; s < 3; s++) { const x = Math.floor(SW / 2 + Math.sin(t * (0.5 + s * 0.23) + s * 2) * 60); const col = 1 + ((s + Math.floor(t / 1.5)) % 4); for (let k = 0; k < 3; k++) { const xx = x + Math.floor(r() * 3) - 1; if (!grid[xx]) grid[xx] = col; } }
        for (let it = 0; it < 2; it++) {
          for (let y = SH - 2; y >= 0; y--) {
            const dir = r() < 0.5; for (let xi = 0; xi < SW; xi++) {
              const x = dir ? xi : SW - 1 - xi, i = y * SW + x, v = grid[i]; if (!v) continue;
              const below = i + SW;
              if (!grid[below]) { grid[below] = v; grid[i] = 0; continue; }
              const dl = x > 0 && !grid[below - 1], dr = x < SW - 1 && !grid[below + 1];
              if (dl && dr) { grid[r() < 0.5 ? below - 1 : below + 1] = v; grid[i] = 0; } else if (dl) { grid[below - 1] = v; grid[i] = 0; } else if (dr) { grid[below + 1] = v; grid[i] = 0; }
            }
          }
          if (drain) for (let x = 0; x < SW; x++) grid[(SH - 1) * SW + x] = 0;
        }
        const d = img.data; for (let i = 0; i < SW * SH; i++) { const v = grid[i]; if (v) { const cc = cols[v], sh = 0.85 + ((i * 2654435761) % 30) / 200; d[i * 4] = cc[0] * sh; d[i * 4 + 1] = cc[1] * sh; d[i * 4 + 2] = cc[2] * sh; } else { d[i * 4] = 14; d[i * 4 + 1] = 13; d[i * 4 + 2] = 20; } d[i * 4 + 3] = 255; }
        og.putImageData(img, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(oc, 0, 0, W, H);
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'lightning', title: 'Lightning', aka: 'electric arc, procedural bolt, storm', tool: 'Canvas 2D (midpoint displacement + glow)', runs: 'CPU',
    notice: 'A bolt is a straight line split again and again, with each midpoint pushed sideways by a random amount that shrinks each time. Branches fork off. A flash, a bright core, a soft glow and a fading afterimage sell the strike.',
    use: 'dramatic reveals, energy and power themes, storms, gaming',
    prompt: "Storm scene: procedural lightning bolts (midpoint displacement with branches) strike every {gap} or a bit more, sky flashes, bolt glows cyan-white then fades over 300 ms, light rain streaks.",
    params: [{"key": "gap", "label": "Time between strikes", "min": 0.05, "max": 2, "step": 0.05, "value": 0.4, "unit": " s"}], setup(cv, L) {
      const g = cv.getContext('2d'); const r = rng(13); let bolts = [], next = 0.3, flash = 0;
      const rain = [...Array(160)].map(() => ({ x: r() * W, y: r() * H, s: 8 + r() * 6 }));
      function bolt(x1, y1, x2, y2, disp, out, depth) {
        if (disp < 2) { out.push([x1, y1, x2, y2, depth]); return; }
        const mx = (x1 + x2) / 2 + (r() - 0.5) * disp, my = (y1 + y2) / 2 + (r() - 0.5) * disp * 0.3;
        bolt(x1, y1, mx, my, disp / 2, out, depth); bolt(mx, my, x2, y2, disp / 2, out, depth);
        if (depth < 2 && r() < 0.18 && disp > 20) { const a = Math.atan2(y2 - y1, x2 - x1) + (r() - 0.5) * 1.6; bolt(mx, my, mx + Math.cos(a) * disp * 1.4, my + Math.sin(a) * disp * 1.4, disp / 2, out, depth + 1); }
      }
      return (t, dt) => {
        if (t > next) { const segs = []; const x = 80 + r() * 480; bolt(x + (r() - 0.5) * 120, -10, x, 330, 180, segs, 0); bolts.push({ segs, life: 1 }); flash = 1; next = t + L.p.gap + r() * 1.1; }
        flash *= Math.pow(0.0005, dt);
        const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, `rgb(${18 + flash * 120},${18 + flash * 130},${40 + flash * 160})`); sky.addColorStop(1, '#0a0a12'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
        g.fillStyle = '#07070c'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 20) g.lineTo(x, 330 - Math.abs(Math.sin(x * 0.013)) * 30 - Math.abs(Math.sin(x * 0.041)) * 12); g.lineTo(W, H); g.fill();
        g.strokeStyle = 'rgba(180,200,255,0.25)'; g.lineWidth = 1; for (const d of rain) { d.y += d.s * dt * 60; d.x -= 2 * dt * 60; if (d.y > H) { d.y = -10; d.x = r() * W + 40; } g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - 3, d.y + 10); g.stroke(); }
        for (const b of bolts) {
          b.life -= dt * 2.8; if (b.life <= 0) continue;
          for (const [w, a, col] of /** @type {[number, number, string][]} */ ([[10, 0.12, '120,170,255'], [4, 0.35, '170,210,255'], [1.6, 1, '255,255,255']])) {
            g.strokeStyle = `rgba(${col},${a * b.life})`; g.lineWidth = w; g.lineCap = 'round'; g.beginPath();
            for (const [x1, y1, x2, y2, dpt] of b.segs) { if (dpt && w > 2) continue; g.moveTo(x1, y1); g.lineTo(x2, y2); } g.stroke();
          }
        }
        bolts = bolts.filter(b => b.life > 0);
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'fireworks', title: 'Fireworks', aka: 'particle bursts, explosions, celebration', tool: 'Canvas 2D particles (gravity, drag, fade)', runs: 'CPU',
    notice: 'A rocket climbs, slows, and at its peak bursts into 90 particles. Each particle has velocity, gravity and air drag, and fades out. Trails come from not fully clearing the previous frame. Some shells crackle with a second, twinkling burst.',
    use: 'celebrations, launches, milestones, New Year content',
    prompt: "Fireworks show over a city skyline: rockets launch with sparkling trails, burst into {count}-particle peonies with gravity {grav} and air drag, some crackle, colors from my palette, long exposure trails.",
    params: [{"key": "grav", "label": "Gravity", "min": 0, "max": 0.15, "step": 0.005, "value": 0.045, "dec": 3}, {"key": "count", "label": "Particles per burst", "min": 20, "max": 300, "step": 10, "value": 90}], setup(cv, L) {
      const g = cv.getContext('2d'); const r = rng(31); const rockets = [], parts = []; let next = 0;
      return (t, dt) => {
        const k = dt * 60;
        g.fillStyle = 'rgba(8,8,14,0.22)'; g.fillRect(0, 0, W, H);
        if (t > next) { rockets.push({ x: 120 + r() * 400, y: H, vx: (r() - 0.5) * 1.2, vy: -(7 + r() * 2.2), col: PAL[Math.floor(r() * 4)], crackle: r() < 0.4 }); next = t + 0.35 + r() * 0.6; }
        for (let i = rockets.length - 1; i >= 0; i--) {
          const q = rockets[i]; q.x += q.vx * k; q.y += q.vy * k; q.vy += 0.12 * k;
          parts.push({ x: q.x, y: q.y, vx: (r() - 0.5) * 0.4, vy: 0.5, life: 0.5, col: '#ffd9a0', size: 1.4 });
          if (q.vy > -0.6) { rockets.splice(i, 1); const n = L.p.count; for (let j = 0; j < n; j++) { const a = j / n * 6.283 + r() * 0.1, s = 2.2 + r() * 2.2; parts.push({ x: q.x, y: q.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col: q.col, size: 2.2, crackle: q.crackle }); } }
        }
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]; p.vx *= Math.pow(0.975, k); p.vy = p.vy * Math.pow(0.975, k) + L.p.grav * k; p.x += p.vx * k; p.y += p.vy * k; p.life -= 0.011 * k;
          if (p.life <= 0) { if (p.crackle && r() < 0.15) for (let j = 0; j < 4; j++) parts.push({ x: p.x, y: p.y, vx: (r() - 0.5) * 2, vy: (r() - 0.5) * 2, life: 0.35, col: '#ffffff', size: 1.2 }); parts.splice(i, 1); continue; }
          const tw = p.crackle && p.life < 0.5 ? (r() < 0.5 ? 1 : 0.2) : 1;
          g.globalAlpha = Math.min(1, p.life * 1.4) * tw; g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.size, 0, 7); g.fill();
        }
        g.globalAlpha = 1; g.fillStyle = '#050508';
        for (let x = 0, i = 0; x < W; x += 34, i++) { const h = 30 + ((i * 7919) % 50); g.fillRect(x, H - h, 30, h); }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'pendulumwave', title: 'Pendulum wave', aka: 'harmonic wave, phase pattern, kinetic sculpture', tool: 'Canvas 2D (math only)', runs: 'CPU',
    notice: 'Twenty pendulums with slightly different speeds start together. Their phase difference grows, so they form snakes, split into two and three waves, look random, then line up again. No physics engine, just cosine.',
    use: 'satisfying loops, science content, elegant intros',
    prompt: "Pendulum wave of {n} balls: each swings slightly faster than the one before so they form traveling waves, splits and chaos, then realign after {T}; seen from above, soft shadows.",
    params: [{"key": "n", "label": "Pendulums", "min": 5, "max": 30, "step": 1, "value": 20}, {"key": "T", "label": "Pattern repeats every", "min": 6, "max": 60, "step": 1, "value": 24, "unit": " s"}], setup(cv, L) {
      const g = cv.getContext('2d');
      return t => {
        g.fillStyle = '#0e0e16'; g.fillRect(0, 0, W, H);
        const T = L.p.T, N = L.p.n, tt = t % T;
        for (let i = 0; i < N; i++) {
          const f = (20 + i) / T, x = W / 2 + Math.cos(2 * Math.PI * f * tt) * 230, y = 30 + i * (310 / N);
          g.strokeStyle = 'rgba(244,239,230,0.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(W / 2, y); g.lineTo(x, y); g.stroke();
          g.fillStyle = `hsl(${(i / N) * 300 + 10},80%,62%)`; g.beginPath(); g.arc(x, y, 6.5, 0, 7); g.fill();
        }
        g.fillStyle = 'rgba(244,239,230,0.35)'; g.fillRect(W / 2 - 1, 22, 2, 310);
        g.font = '500 13px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.45)'; g.fillText(`t = ${tt.toFixed(1)} s / ${T} s`, 16, 344);
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'isocity', title: 'Isometric city build', aka: 'isometric illustration, 2.5D blocks, build-up animation', tool: 'Canvas 2D (isometric projection)', runs: 'CPU',
    notice: 'An isometric grid draws 3D-looking blocks with three shaded faces and no perspective. Buildings rise from back to front with overshoot, windows switch on in random order, then the city sinks back down.',
    use: 'explainer videos, SaaS and fintech illustration, "growth" stories',
    prompt: 'Isometric city builds itself: 8x8 lots, buildings grow from the back to the front with ease-out-back, 40 ms stagger, windows light up randomly at dusk, a car drives along the main road, then everything sinks.',
    setup(cv) {
      const g = cv.getContext('2d'); const r = rng(5); const NG = 8, tw = 30, th = 15;
      const hts = [...Array(NG * NG)].map((_, i) => { const x = i % NG, y = (i / NG) | 0; return (x === 3 || y === 4) ? 0 : 20 + r() * 90; });
      const cols = [[255, 90, 54], [255, 176, 32], [43, 196, 230], [122, 92, 255], [244, 239, 230]].map(c => c);
      const ci = hts.map(() => Math.floor(r() * 5)); const wins = hts.map(() => r());
      const iso = (i, j, z) => [W / 2 + (i - j) * tw, 70 + (i + j) * th - z];
      const face = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };
      return t => {
        const lt = t % 8; g.fillStyle = '#121220'; g.fillRect(0, 0, W, H);
        for (let i = 0; i < NG; i++) for (let j = 0; j < NG; j++) { const road = i === 3 || j === 4; face([iso(i, j, 0), iso(i + 1, j, 0), iso(i + 1, j + 1, 0), iso(i, j + 1, 0)], road ? '#2a2a3c' : '#1c1c2c'); }
        const cp = (t * 0.5) % 1, cx = iso(3.5, cp * NG, 0); g.fillStyle = C.amber; g.beginPath(); g.arc(cx[0], cx[1] - 3, 4, 0, 7); g.fill();
        for (let s = 0; s <= 2 * (NG - 1); s++) for (let i = 0; i < NG; i++) {
          const j = s - i; if (j < 0 || j >= NG) continue; const idx = j * NG + i, h0 = hts[idx]; if (!h0) continue;
          const k = ease.back(seg(lt, 0.2 + s * 0.08 + i * 0.01, 0.8 + s * 0.08 + i * 0.01)) * (1 - ease.inOut(seg(lt, 6.6 + s * 0.03, 7.3 + s * 0.03)));
          const h = Math.max(0, h0 * k); if (h < 0.5) continue; const c = cols[ci[idx]], m = 0.1;
          const A = iso(i + m, j + m, 0), B = iso(i + 1 - m, j + m, 0), Cc = iso(i + 1 - m, j + 1 - m, 0), D = iso(i + m, j + 1 - m, 0);
          const up = p => [p[0], p[1] - h];
          face([D, Cc, up(Cc), up(D)], `rgb(${c[0] * 0.55},${c[1] * 0.55},${c[2] * 0.55})`);
          face([B, Cc, up(Cc), up(B)], `rgb(${c[0] * 0.78},${c[1] * 0.78},${c[2] * 0.78})`);
          face([up(A), up(B), up(Cc), up(D)], `rgb(${c[0]},${c[1]},${c[2]})`);
          if (lt > 2.5 + wins[idx] * 2 && lt < 6.6) { g.fillStyle = 'rgba(255,240,180,0.85)'; for (let fy = 10; fy < h - 6; fy += 12) { const a = [lerp(D[0], Cc[0], 0.35), lerp(D[1], Cc[1], 0.35) - fy]; g.fillRect(a[0], a[1] - 4, 3, 5); const b2 = [lerp(B[0], Cc[0], 0.5), lerp(B[1], Cc[1], 0.5) - fy]; g.fillRect(b2[0], b2[1] - 4, 3, 5); } }
        }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'fieldlines', title: 'Field lines', aka: 'electric/magnetic field visualization, streamlines, vector field', tool: 'Canvas 2D (numerical integration)', runs: 'CPU',
    notice: 'Charges drift around. From each positive charge, 18 lines are traced step by step along the field until they reach a negative charge or leave the frame. Moving dashes show the direction of the field.',
    use: 'science and education, physics explainers, "connection" visuals',
    prompt: 'Animated field-line visualization: two positive and two negative charges orbit slowly, 20 field lines per positive charge traced with RK2, flowing dashes show direction, cyan to coral by strength.',
    setup(cv) {
      const g = cv.getContext('2d');
      return t => {
        g.fillStyle = '#0b0b12'; g.fillRect(0, 0, W, H);
        const Q = [[1, 200 + Math.cos(t * 0.5) * 60, 180 + Math.sin(t * 0.7) * 60], [1, 440 + Math.cos(t * 0.4 + 2) * 50, 120 + Math.sin(t * 0.6) * 40], [-1, 430 + Math.cos(t * 0.45) * 60, 260 + Math.sin(t * 0.5 + 1) * 40], [-1, 180 + Math.cos(t * 0.3 + 1) * 40, 90 + Math.sin(t * 0.55) * 30]];
        const E = (x, y) => { let ex = 0, ey = 0; for (const [q, cx, cy] of Q) { const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy + 30, d = Math.sqrt(d2); ex += q * dx / (d2 * d); ey += q * dy / (d2 * d); } return [ex, ey]; };
        g.lineWidth = 1.6; g.setLineDash([10, 8]); g.lineDashOffset = -t * 30;
        for (const [q, cx, cy] of Q) {
          if (q < 0) continue;
          for (let k = 0; k < 18; k++) {
            let x = cx + Math.cos(k / 18 * 6.283) * 8, y = cy + Math.sin(k / 18 * 6.283) * 8; g.beginPath(); g.moveTo(x, y);
            for (let s = 0; s < 260; s++) {
              let [ex, ey] = E(x, y); let m = Math.hypot(ex, ey) || 1; const hx = x + ex / m * 2.5, hy = y + ey / m * 2.5;
              [ex, ey] = E(hx, hy); m = Math.hypot(ex, ey) || 1; x += ex / m * 5; y += ey / m * 5; g.lineTo(x, y);
              if (x < -10 || x > W + 10 || y < -10 || y > H + 10) break;
              if (Q.some(([q2, qx, qy]) => q2 < 0 && Math.hypot(x - qx, y - qy) < 8)) break;
            }
            g.strokeStyle = `hsla(${190 - k * 8},80%,62%,0.8)`; g.stroke();
          }
        }
        g.setLineDash([]);
        for (const [q, cx, cy] of Q) { g.fillStyle = q > 0 ? C.coral : C.cyan; g.beginPath(); g.arc(cx, cy, 12, 0, 7); g.fill(); g.fillStyle = '#0b0b12'; g.font = '700 16px Segoe UI'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(q > 0 ? '+' : '−', cx, cy + 1); }
        g.textAlign = 'left';
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'orrery', title: 'Orrery', aka: 'solar system, orbital motion, planetary animation', tool: 'Canvas 2D (3D orbits projected to 2D)', runs: 'CPU',
    notice: 'Planets move on circles that are tilted in 3D and flattened by the camera angle. Inner planets go faster, as in Kepler\'s law. Things behind the sun are drawn first, so depth stays correct; one planet has a moon.',
    use: 'science, timelines, "ecosystem" or product-family diagrams',
    prompt: 'Elegant orrery: six planets on tilted orbits seen at a 25-degree angle, inner planets faster (Kepler), faint orbit rings, one planet with a moon and a ring, sun glow, labels that fade in.',
    setup(cv) {
      const g = cv.getContext('2d'); const P = [[60, 4, C.amber], [95, 6, C.cyan], [135, 7, C.coral], [185, 5, C.violet], [235, 11, C.cream], [285, 8, '#5fd38d']];
      return t => {
        g.fillStyle = '#07070d'; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + 0.3 * ((i * 37) % 10) / 10})`; g.fillRect((i * 197) % W, (i * 89) % H, 1.5, 1.5); }
        const tilt = 0.3, cx = W / 2, cy = H / 2;
        const bodies = P.map(([R, s, col], i) => { const a = t * 1.6 / Math.pow(R / 60, 1.5) + i * 1.3; return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * tilt, z: Math.sin(a), s, col, R, a, i }; });
        P.forEach(([R]) => { g.strokeStyle = 'rgba(244,239,230,0.12)'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, R, R * tilt, 0, 0, 7); g.stroke(); });
        const drawSun = () => { const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 70); gr.addColorStop(0, 'rgba(255,220,140,1)'); gr.addColorStop(0.25, 'rgba(255,150,60,0.9)'); gr.addColorStop(1, 'rgba(255,90,54,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, 70, 0, 7); g.fill(); };
        const drawBody = b => {
          const sc = 1 + b.z * 0.12; g.fillStyle = b.col; g.beginPath(); g.arc(b.x, b.y, b.s * sc, 0, 7); g.fill();
          if (b.i === 4) { g.strokeStyle = 'rgba(244,239,230,0.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(b.x, b.y, b.s * 2 * sc, b.s * 0.6 * sc, -0.3, 0, 7); g.stroke(); }
          if (b.i === 2) { const ma = t * 4; g.fillStyle = '#ccc'; g.beginPath(); g.arc(b.x + Math.cos(ma) * 16, b.y + Math.sin(ma) * 5, 2.5, 0, 7); g.fill(); }
        };
        bodies.filter(b => b.z < 0).forEach(drawBody); drawSun(); bodies.filter(b => b.z >= 0).forEach(drawBody);
      };
    },
  });
})();
