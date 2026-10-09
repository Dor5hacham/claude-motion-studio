// Mechanisms in motion, solved by real kinematics (Canvas 2D, CPU).
(function () {
  const { C } = EX;
  const W = 640, H = 360;

  EX.add({
    cat: 'sim', id: 'mc-strandbeest', title: 'Strandbeest leg linkage', aka: 'Theo Jansen linkage, holy numbers, walking mechanism, eleven-bar linkage', tool: 'Canvas 2D + circle-intersection kinematics', runs: 'CPU',
    notice: 'One crank turns and two mirrored legs walk, using the lengths Theo Jansen found for his beach animals. Each joint is solved every frame as the crossing point of two circles, so nothing is keyframed. The coral curve is the true foot path: flat along the ground, then a lifted arc back.',
    use: 'engineering explainers, kinetic art, robot and machine motion',
    params: [{ key: 'speed', label: 'Crank speed', min: 0.1, max: 1.5, step: 0.05, value: 0.45, unit: ' rev/s' }, { key: 'crank', label: 'Crank length', min: 11, max: 17, step: 0.1, value: 15 }],
    prompt: "A Theo Jansen Strandbeest leg linkage walking, solved with real kinematics from Jansen's holy numbers (crank length {crank}), the crank turning at {speed}, two mirrored legs plus a dim back pair, the foot path traced in coral, clean technical-illustration line style on a dark background.",
    setup(stage, L) {
      const g = stage.getContext('2d');
      // Jansen's holy numbers (a, l, b, c, d, e, f, g, h, i, j, k); the crank length m comes from the slider.
      const A = 38, LV = 7.8, LB = 41.5, LC = 39.3, LD = 40.1, LE = 55.8, LF = 39.4, LG = 36.7, LH = 65.7, LI = 49, LJ = 50, LK = 61.9;
      const S = 2.4, OX = W / 2, OY = 112;
      /** Both crossing points of circle (p, r1) and circle (q, r2). @returns {number[][]} */
      const inter = (p, r1, q, r2) => {
        const dx = q[0] - p[0], dy = q[1] - p[1], D = Math.hypot(dx, dy) || 1e-6, a = (r1 * r1 - r2 * r2 + D * D) / (2 * D);
        const hh = Math.sqrt(Math.max(0, r1 * r1 - a * a)), mx = p[0] + a * dx / D, my = p[1] + a * dy / D;
        return [[mx - hh * dy / D, my + hh * dx / D], [mx + hh * dy / D, my - hh * dx / D]];
      };
      const hi = s => (s[0][1] > s[1][1] ? s[0] : s[1]), lo = s => (s[0][1] < s[1][1] ? s[0] : s[1]), lf = s => (s[0][0] < s[1][0] ? s[0] : s[1]);
      /** Solves one left-hand leg for crank angle th (y up, crank axle at the origin). */
      const leg = (th, m) => {
        const M = [m * Math.cos(th), m * Math.sin(th)], B = [-A, -LV];
        const J = hi(inter(M, LJ, B, LB)), K = lo(inter(M, LK, B, LC)), E = lf(inter(B, LD, J, LE)), F = lf(inter(E, LF, K, LG)), P = lo(inter(F, LH, K, LI));
        return { M, B, J, K, E, F, P };
      };
      /** Leg for crank angle th on side sx (-1 left, 1 right, mirrored about the axle). */
      const legSide = (th, m, sx) => {
        const q = leg(sx < 0 ? th : Math.PI - th, m);
        if (sx > 0) for (const key in q) q[key] = [-q[key][0], q[key][1]];
        return q;
      };
      const X = p => OX + p[0] * S, Y = p => OY - p[1] * S;
      let th = 0, ground = 0, prevStance = null;
      const drawLeg = (q, alpha, main) => {
        g.globalAlpha = alpha;
        g.fillStyle = 'rgba(43,196,230,0.12)';
        for (const tri of [[q.B, q.J, q.E], [q.K, q.F, q.P]]) { g.beginPath(); tri.forEach((p, n) => (n ? g.lineTo(X(p), Y(p)) : g.moveTo(X(p), Y(p)))); g.closePath(); g.fill(); }
        g.lineWidth = main ? 3 : 2; g.lineCap = 'round';
        const bars = /** @type {[number[], number[], string][]} */ ([[q.M, q.J, C.amber], [q.M, q.K, C.amber], [q.B, q.J, C.cyan], [q.B, q.K, C.cyan], [q.B, q.E, C.cyan], [q.J, q.E, C.cyan], [q.E, q.F, C.cream], [q.K, q.F, C.cream], [q.F, q.P, C.cream], [q.K, q.P, C.cream]]);
        for (const [p, r, col] of bars) { g.strokeStyle = col; g.beginPath(); g.moveTo(X(p), Y(p)); g.lineTo(X(r), Y(r)); g.stroke(); }
        for (const p of [q.J, q.K, q.E, q.F]) { g.fillStyle = C.bg; g.strokeStyle = C.cream; g.lineWidth = 1.5; g.beginPath(); g.arc(X(p), Y(p), 3.5, 0, 7); g.fill(); g.stroke(); }
        g.fillStyle = C.coral; g.beginPath(); g.arc(X(q.P), Y(q.P), main ? 5 : 4, 0, 7); g.fill();
        g.globalAlpha = 1;
      };
      return (t, dt) => {
        const m = L.p.crank;
        th += Math.min(dt, 0.05) * L.p.speed * 2 * Math.PI;
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        // foot paths for the current crank length, and the ground under their lowest point
        const path = []; let minY = 1e9;
        for (let s = 0; s <= 180; s++) { const q = leg(s / 180 * 2 * Math.PI, m); path.push(q.P); minY = Math.min(minY, q.P[1]); }
        const gy = Y([0, minY]) + 5;
        // the stance foot is the lowest one: the ground moves with it, as if the machine walks
        const legs = [[th + Math.PI, -1], [th + Math.PI, 1], [th, -1], [th, 1]].map(([a, sx]) => legSide(a, m, sx));
        let st = 0; legs.forEach((q, n) => { if (q.P[1] < legs[st].P[1]) st = n; });
        const sp = legs[st].P[0];
        if (prevStance && prevStance[0] === st) ground += (sp - prevStance[1]) * S;
        prevStance = [st, sp];
        g.strokeStyle = 'rgba(244,239,230,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, gy); g.lineTo(W, gy); g.stroke();
        g.strokeStyle = 'rgba(244,239,230,0.18)'; g.lineWidth = 1;
        for (let x = ((ground % 24) + 24) % 24 - 24; x < W + 24; x += 24) { g.beginPath(); g.moveTo(x, gy); g.lineTo(x - 10, gy + 10); g.stroke(); }
        g.setLineDash([4, 4]); g.strokeStyle = C.coral; g.lineWidth = 1.5;
        for (const sx of [-1, 1]) { g.beginPath(); path.forEach((p, n) => { const px = OX + sx * p[0] * S, py = Y(p); n ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); }
        g.setLineDash([]);
        drawLeg(legs[0], 0.3, false); drawLeg(legs[1], 0.3, false);
        // frame: crank axle and the two fixed pivots
        g.strokeStyle = C.violet; g.lineWidth = 4;
        g.beginPath(); g.moveTo(X([-A, -LV]), Y([-A, -LV])); g.lineTo(X([0, 0]), Y([0, 0])); g.lineTo(X([A, -LV]), Y([A, -LV])); g.stroke();
        g.strokeStyle = 'rgba(255,176,32,0.25)'; g.lineWidth = 1; g.beginPath(); g.arc(OX, OY, m * S, 0, 7); g.stroke();
        drawLeg(legs[2], 1, true); drawLeg(legs[3], 1, true);
        g.strokeStyle = C.amber; g.lineWidth = 4; g.beginPath(); g.moveTo(OX, OY); g.lineTo(X(legs[2].M), Y(legs[2].M)); g.stroke();
        for (const p of [[-A, -LV], [A, -LV], [0, 0]]) { g.fillStyle = C.violet; g.beginPath(); g.arc(X(p), Y(p), 5, 0, 7); g.fill(); }
        g.fillStyle = C.amber; g.beginPath(); g.arc(X(legs[2].M), Y(legs[2].M), 4, 0, 7); g.fill();
        g.fillStyle = 'rgba(244,239,230,0.6)'; g.font = '12px ui-monospace, monospace';
        g.fillText('crank ' + m.toFixed(1) + '   a 38  b 41.5  c 39.3  d 40.1  e 55.8  f 39.4  g 36.7  h 65.7  i 49  j 50  k 61.9', 14, 20);
      };
    },
  });
})();
