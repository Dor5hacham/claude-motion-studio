// Disney principles the Learn section does not cover yet: staging, exaggeration, straight ahead versus pose to pose.
// Each card plays the same short action twice in one stage: "without" on the left half, "with" on the right half.
(function () {
  const { C, ease, seg } = EX;
  const DIM = '#6d6a76';

  // Clears the stage and draws the split view: dark halves, a divider and the two Bahnschrift labels.
  function split(g, left, right) {
    g.fillStyle = C.bg; g.fillRect(0, 0, 640, 360);
    g.fillStyle = '#0e0e16'; g.fillRect(320, 0, 320, 360);
    labels(g, left, right);
  }
  // Draws the divider and labels only; call again after anything that paints over them.
  function labels(g, left, right) {
    g.strokeStyle = '#2a2a38'; g.lineWidth = 2; g.beginPath(); g.moveTo(320, 0); g.lineTo(320, 360); g.stroke();
    g.font = '600 14px Bahnschrift'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = DIM; g.fillText(left, 16, 28);
    g.fillStyle = C.coral; g.fillText(right, 336, 28);
  }
  const rbox = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };

  EX.add({
    cat: 'mg', id: 'p2-staging', title: 'Staging', aka: 'focal point, directing the eye, one idea at a time', tool: 'Canvas 2D', runs: 'CPU',
    notice: 'Staging means showing one idea at a time so the eye knows where to look. On the left every shape moves at once and the coral hop gets lost. On the right the rest of the scene freezes and dims, a soft spotlight opens, and only then does the hero hop.',
    use: 'product reveals, explainer scenes, any frame where one thing must read first',
    params: [{ key: 'dim', label: 'Dim the rest', min: 0, max: 1, step: 0.05, value: 0.8 }],
    prompt: 'Staging demo, 640x360 split screen on a near-black background. A coral rounded square hops among 14 amber, cyan, violet and cream shapes. Left half: every shape bobs and spins at the same time. Right half: the other shapes freeze and dim by {dim}, a soft spotlight opens on the hero, then it hops with a small squash on landing. Bahnschrift labels "without" and "with", 3 s loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'), r = EX.rng(11), cols = [C.amber, C.cyan, C.violet, C.cream];
      const HX = 160, FLOOR = 292;
      const crowd = [];
      while (crowd.length < 14) {
        const x = 26 + r() * 268, y = 70 + r() * 236;
        if (Math.hypot(x - HX, y - 250) < 70 || crowd.some(q => Math.hypot(q.x - x, q.y - y) < 46)) continue;
        crowd.push({ x, y, s: 16 + r() * 20, c: cols[crowd.length % 4], ph: r() * 6.28, sp: 1.6 + r() * 2.4, rot: r() * 3, round: r() < 0.5 });
      }
      const spot = g.createRadialGradient(0, 0, 40, 0, 0, 200);
      spot.addColorStop(0, 'rgba(6,6,10,0)'); spot.addColorStop(1, 'rgba(6,6,10,0.88)');
      return t => {
        split(g, 'WITHOUT', 'WITH: stage the hero, still the rest');
        const cyc = t % 3, hopU = seg(cyc, 1.0, 1.6), land = cyc - 1.6;
        for (let side = 0; side < 2; side++) {
          const ox = side * 320, k = side ? L.p.dim * ease.out(seg(cyc, 0.1, 0.7)) * (1 - ease.inOut(seg(cyc, 2.55, 2.95))) : 0, m = 1 - (side ? Math.min(1, k * 1.25) : 0);
          g.save(); g.beginPath(); g.rect(ox, 0, 320, 360); g.clip();
          g.fillStyle = '#1e1e2a'; g.fillRect(ox + 20, FLOOR, 280, 3);
          for (const q of crowd) {
            const x = ox + q.x + Math.sin(t * q.sp + q.ph) * 12 * m, y = q.y + Math.cos(t * q.sp * 1.3 + q.ph) * 9 * m;
            g.save(); g.translate(x, y); g.rotate(q.rot + Math.sin(t * q.sp * 0.7 + q.ph) * 0.9 * m);
            g.fillStyle = q.c; if (q.round) { g.beginPath(); g.arc(0, 0, q.s / 2, 0, 6.29); g.fill(); } else rbox(g, -q.s / 2, -q.s / 2, q.s, q.s, 4);
            if (k > 0) { g.globalAlpha = k; g.fillStyle = '#1b1b24'; if (q.round) { g.beginPath(); g.arc(0, 0, q.s / 2 + 0.5, 0, 6.29); g.fill(); } else rbox(g, -q.s / 2 - 0.5, -q.s / 2 - 0.5, q.s + 1, q.s + 1, 4); }
            g.restore();
          }
          if (k > 0) { g.save(); g.globalAlpha = k; g.translate(ox + HX, 250); g.fillStyle = spot; g.fillRect(-HX, -250, 320, 360); g.restore(); }
          const y = 70 * 4 * hopU * (1 - hopU), sq = land > 0 ? 0.22 * Math.exp(-land * 8) * Math.cos(land * 20) : (cyc > 0.75 && cyc < 1.0 ? 0.12 * Math.sin(Math.PI * seg(cyc, 0.75, 1.0)) : 0);
          const sx = 1 + sq, sy = 1 - sq, S = 44;
          g.globalAlpha = 0.35 * (1 - y / 100); g.fillStyle = '#000'; g.beginPath(); g.ellipse(ox + HX, FLOOR + 1, 26 * (1 - y / 160), 5, 0, 0, 6.29); g.fill(); g.globalAlpha = 1;
          g.fillStyle = C.coral; rbox(g, ox + HX - S * sx / 2, FLOOR - y - S * sy, S * sx, S * sy, 10);
          g.restore();
        }
        labels(g, 'WITHOUT', 'WITH: stage the hero, still the rest');
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'p2-exaggeration', title: 'Exaggeration', aka: 'push the pose, caricature of motion, cartoon physics', tool: 'Canvas 2D', runs: 'CPU',
    notice: 'Exaggeration pushes a real motion further so it reads clearly and feels alive. Both blocks do the same jump with the same timing, but the right one crouches deeper, stretches in the air, jumps higher and squashes harder on landing. Drag the slider to find the point where it reads well without turning to rubber.',
    use: 'mascots, game characters, playful UI, any motion that must read at a glance',
    params: [{ key: 'ex', label: 'Exaggeration', min: 0, max: 1.5, step: 0.05, value: 1 }],
    prompt: 'Exaggeration demo, 640x360 split screen on a near-black background. A cream block character with two dot eyes jumps in place every 2.4 s. Left half: a realistic jump, small crouch, 60 px high, almost no squash. Right half: the same timing pushed by {ex}: deep anticipation crouch, stretch along the motion in the air, a higher jump and a big springy squash on landing. Thin tick lines mark each apex height. Bahnschrift labels, seamless loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'), FLOOR = 296, S = 64;
      // Returns height, x scale and y scale of the jump at cycle time c for exaggeration amount a.
      const pose = (c, a, o) => {
        const H = 60 + 76 * a, cr = 0.06 + 0.3 * a, st = 0.05 + 0.3 * a, ld = 0.07 + 0.36 * a;
        let y = 0, s = 0;
        const crouch = ease.inOut(seg(c, 0.1, 0.5)) * (1 - seg(c, 0.5, 0.56));
        s += cr * crouch;
        const u = seg(c, 0.56, 1.36);
        if (u > 0 && u < 1) { y = H * 4 * u * (1 - u); s -= st * Math.abs(1 - 2 * u) * Math.min(1, u * 8, (1 - u) * 8); }
        const l = c - 1.36; if (l > 0) s += ld * Math.exp(-l * 6) * Math.cos(l * 19);
        o.y = y; o.sx = 1 + s * 0.85; o.sy = 1 - s; o.H = H; o.u = u;
        return o;
      };
      const P = { y: 0, sx: 1, sy: 1, H: 0, u: 0 };
      return t => {
        split(g, 'WITHOUT: realistic', 'WITH: exaggerated x' + L.p.ex.toFixed(2));
        const cyc = t % 2.4;
        for (let side = 0; side < 2; side++) {
          const ox = side * 320, cx = ox + 160, a = side ? L.p.ex : 0;
          pose(cyc, a, P);
          g.fillStyle = '#1e1e2a'; g.fillRect(ox + 30, FLOOR, 260, 3);
          const top = FLOOR - S - P.H;
          g.strokeStyle = side ? 'rgba(255,90,54,0.45)' : 'rgba(109,106,118,0.6)'; g.lineWidth = 1; g.setLineDash([4, 5]);
          g.beginPath(); g.moveTo(ox + 70, top); g.lineTo(ox + 250, top); g.stroke(); g.setLineDash([]);
          g.font = '12px Bahnschrift'; g.fillStyle = side ? C.coral : DIM; g.fillText(Math.round(P.H) + ' px', ox + 256, top + 4);
          g.globalAlpha = 0.4 * (1 - P.y / 260); g.fillStyle = '#000'; g.beginPath(); g.ellipse(cx, FLOOR + 1, 40 * P.sx * (1 - P.y / 400), 6, 0, 0, 6.29); g.fill(); g.globalAlpha = 1;
          const w = S * P.sx, h = S * P.sy, bx = cx - w / 2, by = FLOOR - P.y - h;
          g.fillStyle = side ? C.cream : '#b9b4ab'; rbox(g, bx, by, w, h, 14);
          const look = P.u > 0 && P.u < 1 ? -4 * (1 - P.u * 1.4) : 0, eh = 9 * Math.max(0.45, P.sy * (side && P.u > 0.3 && P.u < 0.7 ? 1.25 : 1));
          g.fillStyle = C.bg;
          for (const ex of [-0.2, 0.2]) { g.beginPath(); g.ellipse(cx + ex * w, by + h * 0.38 + look, 5, eh / 2, 0, 0, 6.29); g.fill(); }
          if (side) { g.fillStyle = C.coral; rbox(g, cx - w * 0.16, by + h * 0.66, w * 0.32, Math.max(3, 7 * (side && P.u > 0 && P.u < 1 ? 1.4 : 0.6)), 3); }
        }
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'p2-pose-to-pose', title: 'Straight ahead vs pose to pose', aka: 'key poses, in-betweens, frame by frame, blocking', tool: 'Canvas 2D', runs: 'CPU',
    notice: 'Straight ahead means making frame 1, then frame 2, then frame 3, each one built from the last: the motion is lively but drifts, and it misses the goal a little differently every loop. Pose to pose sets the key poses first, then fills the in-betweens, so the move lands exactly where it was planned. Animators use straight ahead for fire, water and chaos, and pose to pose for acting and layout.',
    use: 'teaching keyframe workflows, choosing between simulation and keyframes, planning an animation',
    params: [{ key: 'keys', label: 'Key poses', min: 2, max: 5, step: 1, value: 3 }],
    prompt: 'Straight ahead versus pose to pose demo, 640x360 split screen on a near-black background, a dashed goal ring in each half. Left half, straight ahead: a coral ball lays down 30 onion-skin frames one after another, each frame turned a little at random from the last, so the arc wanders and misses the goal differently every loop. Right half, pose to pose: {keys} numbered cream key poses pop in first along a planned arc, then eased in-betweens fill the gaps, then the ball plays through and lands on the goal. Bahnschrift labels, 4.5 s loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'), N = 30;
      const SX = 44, SY = 300, GX = 272, GY = 104, CX = 60, CY = 70;
      const free = new Float32Array((N + 1) * 2), plan = new Float32Array(64 * 2);
      let cycle = -1, nPlan = 0, nKeys = 0;
      const bez = (u, o, i) => { const v = 1 - u; o[i] = v * v * SX + 2 * v * u * CX + u * u * GX; o[i + 1] = v * v * SY + 2 * v * u * CY + u * u * GY; };
      // Rebuilds the wandering straight-ahead path (new seed each loop) and the planned key and in-between frames.
      const build = c => {
        const r = EX.rng(101 + c * 7);
        let x = SX, y = SY, a = -1.42; free[0] = x; free[1] = y;
        for (let i = 1; i <= N; i++) { a += 0.052 + (r() - 0.5) * 0.3; x += Math.cos(a) * 11.2; y += Math.sin(a) * 11.2; free[i * 2] = x; free[i * 2 + 1] = y; }
        nKeys = L.p.keys; nPlan = 0; const IB = 6;
        for (let k = 0; k < nKeys - 1; k++) for (let j = 0; j < IB; j++) bez((k + ease.inOut(j / IB)) / (nKeys - 1), plan, (nPlan++) * 2);
        bez(1, plan, (nPlan++) * 2);
      };
      const goal = ox => { g.strokeStyle = 'rgba(244,239,230,0.5)'; g.lineWidth = 2; g.setLineDash([5, 5]); g.beginPath(); g.arc(ox + GX, GY, 20, 0, 6.29); g.stroke(); g.setLineDash([]); g.font = '12px Bahnschrift'; g.fillStyle = DIM; g.fillText('goal', ox + GX - 12, GY - 28); };
      return t => {
        const c = Math.floor(t / 4.5), cyc = t % 4.5;
        if (c !== cycle || nKeys !== L.p.keys) { cycle = c; build(c); }
        split(g, 'WITHOUT KEYS: straight ahead', 'WITH KEYS: pose to pose');
        const fade = 1 - seg(cyc, 4.05, 4.45);
        goal(320);
        g.globalAlpha = fade;
        // Left: frames appear one by one, the newest is the ball.
        const shown = Math.min(N, Math.floor(seg(cyc, 0.25, 3.0) * N + 0.0001));
        g.lineWidth = 1.5;
        for (let i = 0; i < shown; i++) { g.strokeStyle = `rgba(255,90,54,${0.15 + 0.5 * i / N})`; g.beginPath(); g.arc(free[i * 2], free[i * 2 + 1], 11, 0, 6.29); g.stroke(); }
        g.fillStyle = C.coral; g.beginPath(); g.arc(free[shown * 2], free[shown * 2 + 1], 12, 0, 6.29); g.fill();
        goal(0);
        g.font = '12px Bahnschrift'; g.fillStyle = DIM; g.fillText('frame ' + (shown + 1) + ' of ' + (N + 1), 20, 340);
        // Right: keys pop in, then in-betweens, then the ball plays through.
        const IB = 6, ib = seg(cyc, 0.9, 1.7), play = seg(cyc, 1.8, 3.2);
        for (let i = 0; i < nPlan; i++) {
          if (i % IB === 0) continue;
          const vis = seg(ib * nPlan, i - 1, i); if (vis <= 0) continue;
          g.strokeStyle = `rgba(244,239,230,${0.35 * vis})`; g.beginPath(); g.arc(320 + plan[i * 2], plan[i * 2 + 1], 9, 0, 6.29); g.stroke();
        }
        for (let k = 0; k < nKeys; k++) {
          const i = k * IB, s = ease.back(seg(cyc, 0.25 + k * 0.12, 0.6 + k * 0.12)); if (s <= 0) continue;
          g.fillStyle = C.cream; g.beginPath(); g.arc(320 + plan[i * 2], plan[i * 2 + 1], 14 * s, 0, 6.29); g.fill();
          g.fillStyle = C.bg; g.font = '700 14px Bahnschrift'; g.textAlign = 'center'; g.fillText(String(k + 1), 320 + plan[i * 2], plan[i * 2 + 1] + 5); g.textAlign = 'left';
        }
        if (cyc > 1.8) { const f = Math.min(nPlan - 1, Math.round(play * (nPlan - 1))); g.fillStyle = C.coral; g.beginPath(); g.arc(320 + plan[f * 2], plan[f * 2 + 1], 12, 0, 6.29); g.fill(); }
        g.font = '12px Bahnschrift'; g.fillStyle = DIM;
        g.fillText(cyc < 0.9 ? 'keys first' : cyc < 1.8 ? 'then in-betweens' : 'then play', 340, 340);
        g.globalAlpha = 1;
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'p2-solid-drawing', title: 'Solid drawing', aka: 'volume, weight, form in perspective, thinking in 3D', tool: 'Canvas 2D (3D projection)', runs: 'CPU',
    notice: 'Solid drawing means a shape keeps its volume, weight and perspective while it moves. The left box is a flat card that fakes a turn by squashing its width, so it goes paper thin halfway through. The right box is a real cube projected in 3D: its faces trade places, one light shades each side, and it gets wider, not thinner, at the diagonal.',
    use: 'product turns, isometric icons, logo spins, any object that rotates on screen',
    params: [{ key: 'tilt', label: 'Camera tilt', min: 0, max: 40, step: 1, value: 22, unit: ' deg' }],
    prompt: 'Solid drawing demo, 640x360 split screen on a near-black background. A cream box makes a quarter turn every 2.4 s with ease in-out and a hold. Left half: a flat card fakes the turn by squashing its width to a sliver. Right half: a real cube projected in 3D with a {tilt} camera tilt, three faces shaded by one upper-left light, and a soft contact shadow. Bahnschrift labels, seamless loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'), S = 112, FLOOR = 292, FOC = 700, CR = 244, CG = 239, CB = 230;
      const V = [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1];
      const FACES = [[0, 1, 2, 3, 0, 0, -1], [5, 4, 7, 6, 0, 0, 1], [4, 0, 3, 7, -1, 0, 0], [1, 5, 6, 2, 1, 0, 0], [4, 5, 1, 0, 0, -1, 0], [3, 2, 6, 7, 0, 1, 0]];
      const P = new Float32Array(16), ln = Math.hypot(0.5, 0.6, 0.8), LX = -0.5 / ln, LY = -0.6 / ln, LZ = -0.8 / ln;
      return t => {
        split(g, 'WITHOUT: flat card', 'WITH: solid form');
        const cyc = t % 2.4, a = Math.PI / 2 * ease.inOut(seg(cyc, 0.35, 1.45)), tl = L.p.tilt * Math.PI / 180;
        for (const ox of [0, 320]) { g.fillStyle = '#1e1e2a'; g.fillRect(ox + 30, FLOOR, 260, 3); }
        // Left: a card that only scales its width.
        const k = Math.cos(2 * a), w = S * Math.max(0.03, Math.abs(k));
        g.globalAlpha = 0.4; g.fillStyle = '#000'; g.beginPath(); g.ellipse(160, FLOOR + 1, w * 0.6, 6, 0, 0, 6.29); g.fill(); g.globalAlpha = 1;
        g.fillStyle = C.cream; rbox(g, 160 - w / 2, FLOOR - S, w, S, Math.min(6, w / 2));
        // Right: a cube turned by yaw a, tilted toward the camera, then projected.
        const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(tl), st = Math.sin(tl);
        let maxY = -1e9;
        for (let i = 0; i < 8; i++) {
          const x = V[i * 3] * S / 2, y = V[i * 3 + 1] * S / 2, z = V[i * 3 + 2] * S / 2;
          const x1 = x * ca + z * sa, z1 = -x * sa + z * ca, y2 = y * ct - z1 * st, z2 = y * st + z1 * ct, f = FOC / (FOC + z2);
          P[i * 2] = 480 + x1 * f; P[i * 2 + 1] = y2 * f; if (P[i * 2 + 1] > maxY) maxY = P[i * 2 + 1];
        }
        const oy = FLOOR + 2 - maxY;
        g.globalAlpha = 0.45; g.fillStyle = '#000'; g.beginPath(); g.ellipse(480, FLOOR + 1, S * 0.78, 7 + 10 * st, 0, 0, 6.29); g.fill(); g.globalAlpha = 1;
        g.lineJoin = 'round'; g.lineWidth = 1;
        for (const fc of FACES) {
          const nx = fc[4] * ca + fc[6] * sa, nz1 = -fc[4] * sa + fc[6] * ca, ny = fc[5] * ct - nz1 * st, nz = fc[5] * st + nz1 * ct;
          if (nz >= -0.01) continue;
          const sh = 0.32 + 0.68 * Math.max(0, nx * LX + ny * LY + nz * LZ), col = `rgb(${CR * sh | 0},${CG * sh | 0},${CB * sh | 0})`;
          g.fillStyle = col; g.strokeStyle = col; g.beginPath();
          for (let j = 0; j < 4; j++) { const v = fc[j]; if (j) g.lineTo(P[v * 2], P[v * 2 + 1] + oy); else g.moveTo(P[v * 2], P[v * 2 + 1] + oy); }
          g.closePath(); g.fill(); g.stroke();
        }
      };
    },
  });
})();
