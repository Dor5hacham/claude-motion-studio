// Set 2 simulation and generative demos: chaos, attractors and growth (Canvas 2D, CPU).
(function () {
  const { C, seg, lerp, ease, rng } = EX;
  const W = 640, H = 360;
  const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  // Colour ramp through the house palette, k in [0,1]; returns [r,g,b].
  const RAMP = [C.coral, C.amber, C.cyan, C.violet].map(hexRGB);
  const mixHex = (a, b, k) => { const p = hexRGB(a), q = hexRGB(b); return `rgb(${lerp(p[0], q[0], k) | 0},${lerp(p[1], q[1], k) | 0},${lerp(p[2], q[2], k) | 0})`; };
  const ramp = k => { const x = Math.min(0.9999, Math.max(0, k)) * (RAMP.length - 1), i = x | 0, f = x - i, a = RAMP[i], b = RAMP[i + 1]; return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]; };

  // Float RGB light buffer for additive trails. dot/line add light, fade(f) dims it, flush() tone-maps it into .canvas.
  function lightBuf(w, h) {
    const acc = new Float32Array(w * h * 3), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cg = cv.getContext('2d'), img = cg.createImageData(w, h), px = img.data;
    const dot = (x, y, r, gg, b) => {
      const xi = Math.floor(x), yi = Math.floor(y); if (xi < 0 || yi < 0 || xi >= w - 1 || yi >= h - 1) return;
      const fx = x - xi, fy = y - yi, i = (yi * w + xi) * 3, j = i + w * 3;
      const a = (1 - fx) * (1 - fy), bb = fx * (1 - fy), c = (1 - fx) * fy, d = fx * fy;
      acc[i] += r * a; acc[i + 1] += gg * a; acc[i + 2] += b * a; acc[i + 3] += r * bb; acc[i + 4] += gg * bb; acc[i + 5] += b * bb;
      acc[j] += r * c; acc[j + 1] += gg * c; acc[j + 2] += b * c; acc[j + 3] += r * d; acc[j + 4] += gg * d; acc[j + 5] += b * d;
    };
    return {
      acc, canvas: cv, dot,
      line(x0, y0, x1, y1, r, gg, b) { const n = Math.min(400, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.7) || 1), k = 0.7; for (let s = 1; s <= n; s++) { const u = s / n; dot(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, r * k, gg * k, b * k); } },
      fade(f) { for (let i = 0; i < acc.length; i++) acc[i] *= f; },
      clear() { acc.fill(0); },
      flush(gain = 1) { for (let i = 0, o = 0; i < acc.length; i += 3, o += 4) { const r = acc[i] * gain, gg = acc[i + 1] * gain, b = acc[i + 2] * gain; px[o] = 255 * r / (1 + r); px[o + 1] = 255 * gg / (1 + gg); px[o + 2] = 255 * b / (1 + b); px[o + 3] = 255; } cg.putImageData(img, 0, 0); },
    };
  }

  EX.add({
    cat: 'sim', id: 's2-dblpend', title: 'Double pendulum chaos', aka: 'butterfly effect, sensitive dependence on initial conditions, chaotic divergence', tool: 'Canvas 2D (RK4 integration)', runs: 'CPU',
    notice: '360 double pendulums start a hair apart and swing as one white arm. The tiny differences double again and again, so the arm splits into a rainbow fan and then into chaos. The small graph plots the spread on a log scale: a straight climb means exponential growth.',
    use: 'science explainers, "small change, big effect" stories, hypnotic loops',
    prompt: "Double pendulum chaos: 360 double pendulums from one pivot, started 10^{exp} degrees apart, integrated with RK4. They move as one bright white arm for a few seconds, then split into a coral-to-violet rainbow fan and then full chaos, additive blending, fading tip trails, a small log-scale graph of the spread, 24 s loop.",
    params: [{ key: 'exp', label: 'Starting spread (10^x degrees)', min: -9, max: -1, step: 1, value: -4, restart: true }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const N = 360, NB = 12, R = 78, OX = W / 2, OY = 168, GR = 9.81, HS = 1 / 240, LOOP = 24;
      const lb = lightBuf(W, H);
      const t1 = new Float64Array(N), t2 = new Float64Array(N), w1 = new Float64Array(N), w2 = new Float64Array(N);
      const tx = new Float64Array(N), ty = new Float64Array(N), ex = new Float64Array(N), ey = new Float64Array(N), ox = new Float64Array(N), oy = new Float64Array(N);
      const cols = [...Array(NB)].map((_, b) => { const c = ramp(b / (NB - 1)); return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; });
      const cr = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const c = ramp(i / (N - 1)); cr[i * 3] = c[0] / 255 * 0.45; cr[i * 3 + 1] = c[1] / 255 * 0.45; cr[i * 3 + 2] = c[2] / 255 * 0.45; }
      const B0 = b => Math.round(b * N / NB), B1 = b => Math.round((b + 1) * N / NB);
      const vig = g.createRadialGradient(OX, OY, 40, OX, OY, 420); vig.addColorStop(0, '#15131f'); vig.addColorStop(1, '#08080c');
      const hist = new Float32Array(240); let nh = 0, simT = 0, acc = 0, cyc = -1, nextH = 0;
      const d = [0, 0, 0, 0];
      // Angular accelerations for unit masses and arms; d receives [w1', w2'].
      const accel = (a1, a2, v1, v2) => {
        const dd = a1 - a2, s = Math.sin(dd), c = Math.cos(dd), den = 3 - Math.cos(2 * dd);
        d[0] = (-3 * GR * Math.sin(a1) - GR * Math.sin(a1 - 2 * a2) - 2 * s * (v2 * v2 + v1 * v1 * c)) / den;
        d[1] = 2 * s * (2 * v1 * v1 + 2 * GR * Math.cos(a1) + v2 * v2 * c) / den;
      };
      const step = i => {
        const a1 = t1[i], a2 = t2[i], v1 = w1[i], v2 = w2[i];
        accel(a1, a2, v1, v2); const k1a = d[0], k1b = d[1];
        accel(a1 + v1 * HS / 2, a2 + v2 * HS / 2, v1 + k1a * HS / 2, v2 + k1b * HS / 2); const k2a = d[0], k2b = d[1];
        const v1b = v1 + k1a * HS / 2, v2b = v2 + k1b * HS / 2;
        accel(a1 + (v1 + k1a * HS / 2) * HS / 2, a2 + (v2 + k1b * HS / 2) * HS / 2, v1 + k2a * HS / 2, v2 + k2b * HS / 2); const k3a = d[0], k3b = d[1];
        const v1c = v1 + k2a * HS / 2, v2c = v2 + k2b * HS / 2;
        accel(a1 + v1c * HS, a2 + v2c * HS, v1 + k3a * HS, v2 + k3b * HS); const k4a = d[0], k4b = d[1];
        const v1d = v1 + k3a * HS, v2d = v2 + k3b * HS;
        t1[i] = a1 + HS / 6 * (v1 + 2 * v1b + 2 * v1c + v1d); t2[i] = a2 + HS / 6 * (v2 + 2 * v2b + 2 * v2c + v2d);
        w1[i] = v1 + HS / 6 * (k1a + 2 * k2a + 2 * k3a + k4a); w2[i] = v2 + HS / 6 * (k1b + 2 * k2b + 2 * k3b + k4b);
      };
      const pos = () => { for (let i = 0; i < N; i++) { ex[i] = OX + Math.sin(t1[i]) * R; ey[i] = OY + Math.cos(t1[i]) * R; tx[i] = ex[i] + Math.sin(t2[i]) * R; ty[i] = ey[i] + Math.cos(t2[i]) * R; } };
      const reset = () => {
        const sp = Math.pow(10, L.p.exp) * Math.PI / 180;
        for (let i = 0; i < N; i++) { t1[i] = 2.05 + sp * i / (N - 1); t2[i] = 2.75; w1[i] = 0; w2[i] = 0; }
        pos(); lb.clear(); nh = 0; simT = 0; acc = 0; nextH = 0;
      };
      return (t, dt) => {
        const c = Math.floor(t / LOOP); if (c !== cyc) { cyc = c; reset(); }
        const lt = t - c * LOOP;
        acc += dt;
        ox.set(tx); oy.set(ty);
        while (acc >= HS) { for (let i = 0; i < N; i++) step(i); acc -= HS; simT += HS; }
        pos();
        if (simT >= nextH && nh < hist.length) {
          let mx = 0, my = 0; for (let i = 0; i < N; i++) { mx += tx[i]; my += ty[i]; } mx /= N; my /= N;
          let s = 0; for (let i = 0; i < N; i++) s += (tx[i] - mx) ** 2 + (ty[i] - my) ** 2;
          hist[nh++] = Math.log10(Math.sqrt(s / N) + 1e-12); nextH += 0.1;
        }
        lb.fade(Math.pow(0.93, dt * 60));
        for (let i = 0; i < N; i++) lb.line(ox[i], oy[i], tx[i], ty[i], cr[i * 3], cr[i * 3 + 1], cr[i * 3 + 2]);
        lb.flush();
        const fade = 1 - ease.inOut(seg(lt, LOOP - 1.4, LOOP)) * 0.9;
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = vig; g.fillRect(0, 0, W, H);
        g.globalAlpha = fade; g.globalCompositeOperation = 'lighter'; g.drawImage(lb.canvas, 0, 0);
        g.globalCompositeOperation = 'lighter'; g.lineWidth = 1.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = 0.1 * fade;
        for (let b = 0; b < NB; b++) {
          g.strokeStyle = cols[b]; g.beginPath();
          for (let i = B0(b); i < B1(b); i++) { g.moveTo(OX, OY); g.lineTo(ex[i], ey[i]); g.lineTo(tx[i], ty[i]); }
          g.stroke();
        }
        g.globalAlpha = 0.35 * fade;
        for (let b = 0; b < NB; b++) { g.fillStyle = cols[b]; g.beginPath(); for (let i = B0(b); i < B1(b); i++) { g.moveTo(tx[i] + 2.2, ty[i]); g.arc(tx[i], ty[i], 2.2, 0, 6.3); } g.fill(); }
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = fade;
        g.fillStyle = C.cream; g.beginPath(); g.arc(OX, OY, 3.5, 0, 6.3); g.fill();
        // log-scale spread graph, bottom right
        const gx = 482, gy = 300, gw = 140, gh = 44;
        g.strokeStyle = 'rgba(244,239,230,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(gx, gy - gh); g.lineTo(gx, gy); g.lineTo(gx + gw, gy); g.stroke();
        g.strokeStyle = C.cream; g.lineWidth = 1.5; g.beginPath();
        for (let k = 0; k < nh; k++) { const x = gx + k / (hist.length - 1) * gw, y = gy - (hist[k] + 9) / 12 * gh; k ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
        g.font = '500 11px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.5)';
        g.fillText('spread (log)', gx, gy + 16); g.textAlign = 'right'; g.fillText(`t ${simT.toFixed(1)} s`, gx + gw, gy + 16); g.textAlign = 'left';
        g.fillText(`360 pendulums, 10^${L.p.exp} deg apart`, 20, 340);
        g.globalAlpha = 1;
      };
    },
  });
  // Strange attractors: flow field f(x, y, z, out), integration step h, sim time per second, label and formula.
  const ATTR = [
    { name: 'Lorenz', h: 0.004, rate: 0.55, up: 2, eq: "x' = 10(y - x)   y' = x(28 - z) - y   z' = xy - 8z/3", f: (x, y, z, o) => { o[0] = 10 * (y - x); o[1] = x * (28 - z) - y; o[2] = x * y - 8 / 3 * z; } },
    { name: 'Aizawa', h: 0.008, rate: 1.1, up: 2, eq: "x' = (z - 0.7)x - 3.5y   y' = 3.5x + (z - 0.7)y   z' = 0.6 + 0.95z - z^3/3 - ...", f: (x, y, z, o) => { o[0] = (z - 0.7) * x - 3.5 * y; o[1] = 3.5 * x + (z - 0.7) * y; o[2] = 0.6 + 0.95 * z - z * z * z / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x * x * x; } },
    { name: 'Thomas', h: 0.04, rate: 5, up: 1, eq: "x' = sin y - 0.208x   y' = sin z - 0.208y   z' = sin x - 0.208z", f: (x, y, z, o) => { const b = 0.208186; o[0] = Math.sin(y) - b * x; o[1] = Math.sin(z) - b * y; o[2] = Math.sin(x) - b * z; } },
    { name: 'Halvorsen', h: 0.004, rate: 0.6, up: 1, eq: "x' = -1.89x - 4y - 4z - y^2   (and cyclic in x, y, z)", f: (x, y, z, o) => { const a = 1.89; o[0] = -a * x - 4 * y - 4 * z - y * y; o[1] = -a * y - 4 * z - 4 * x - z * z; o[2] = -a * z - 4 * x - 4 * y - x * x; } },
  ];

  EX.add({
    cat: 'sim', id: 's2-attractors', title: 'Strange attractors', aka: 'Lorenz attractor, chaotic flow, Aizawa, Thomas, Halvorsen', tool: 'Canvas 2D (Euler integration + 3D projection + float light buffer)', runs: 'CPU',
    notice: 'Six thousand particles ride a set of three equations, so they never settle and never repeat, yet stay on one shape. A slow orbit camera shows the 3D form, and colour shows depth. Every 10 s (or on a button) the particles fly to the next attractor.',
    use: 'science and math intros, tech brand backgrounds, ambient loops with depth',
    prompt: "Strange attractor gallery: 6,000 glowing particles flow along the Lorenz, Aizawa, Thomas and Halvorsen attractors (Euler steps, flow speed {speed}x), each leaving an additive trail that fades {fade} per frame. Slow orbit camera with perspective, colour by depth from amber (near) to violet (far). Every 10 s the particles fly to the next attractor with a 1.6 s ease-in-out morph; name and equations in small type.",
    params: [{ key: 'speed', label: 'Flow speed', min: 0.2, max: 3, step: 0.1, value: 1, unit: 'x' }, { key: 'fade', label: 'Trail fade', min: 0.02, max: 0.3, step: 0.01, value: 0.08 }],
    controls: ATTR.map((a, k) => ({ label: a.name, on: k === 0, fn: L => L.go && L.go(k, true) })),
    setup(cv, L) {
      const g = cv.getContext('2d'); const N = 6000, S = 112, MORPH = 1.6, HOLD = 10;
      const lb = lightBuf(W, H), o = [0, 0, 0];
      const px = new Float64Array(N), py = new Float64Array(N), pz = new Float64Array(N);
      const fx = new Float32Array(N), fy = new Float32Array(N), fz = new Float32Array(N), sx = new Float32Array(N), sy = new Float32Array(N);
      const pools = [];
      // Points spread along one long trajectory, plus centre and scale that fit the attractor in a unit box.
      const pool = k => {
        if (pools[k]) return pools[k];
        const a = ATTR[k]; let x = 0.1, y = 0, z = 0.2; const pts = new Float64Array(N * 3); let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (let i = -2000; i < N * 12; i++) { a.f(x, y, z, o); x += o[0] * a.h; y += o[1] * a.h; z += o[2] * a.h; if (i >= 0 && i % 12 === 0) { const j = i / 12 * 3; pts[j] = x; pts[j + 1] = y; pts[j + 2] = z; [x, y, z].forEach((v, c) => { mn[c] = Math.min(mn[c], v); mx[c] = Math.max(mx[c], v); }); } }
        const c = [0, 1, 2].map(i => (mn[i] + mx[i]) / 2), sc = 1 / Math.max(...[0, 1, 2].map(i => (mx[i] - mn[i]) / 2));
        return (pools[k] = { pts, c, sc });
      };
      let cur = 0, t0 = -MORPH, last = 0, auto = 0, first = true;
      const ux = new Float32Array(N), uy = new Float32Array(N), uz = new Float32Array(N);
      const LUT = new Float32Array(64 * 3); for (let i = 0; i < 64; i++) { const c = ramp(0.06 + i / 63 * 0.92); LUT[i * 3] = c[0] / 255; LUT[i * 3 + 1] = c[1] / 255; LUT[i * 3 + 2] = c[2] / 255; }
      const btns = () => /** @type {HTMLElement[]} */ ([...cv.closest('article').querySelectorAll('.ctl button')]);
      // Switches to attractor k; particles fly from where they are drawn now to points on the new shape.
      L.go = (k, user) => {
        if (!first) { fx.set(ux); fy.set(uy); fz.set(uz); t0 = last; }
        cur = k; auto = last; const P = pool(k); for (let i = 0; i < N; i++) { px[i] = P.pts[i * 3]; py[i] = P.pts[i * 3 + 1]; pz[i] = P.pts[i * 3 + 2]; }
        if (!user && !first) btns().forEach((bt, j) => bt.classList.toggle('on', j === k));
        first = false;
      };
      L.go(0);
      const blur = 'blur(5px)';
      return (t, dt) => {
        last = t; if (t - auto > HOLD) L.go((cur + 1) % ATTR.length);
        const a = ATTR[cur], f = a.f, P = pools[cur]; const span = dt * a.rate * L.p.speed, n = Math.max(1, Math.ceil(span / a.h)), h = span / n;
        for (let i = 0; i < N; i++) { let x = px[i], y = py[i], z = pz[i]; for (let s2 = 0; s2 < n; s2++) { f(x, y, z, o); x += o[0] * h; y += o[1] * h; z += o[2] * h; } px[i] = x; py[i] = y; pz[i] = z; }
        const e = ease.inOut(seg(t - t0, 0, MORPH)), yaw = t * 0.22, cy = Math.cos(yaw), syw = Math.sin(yaw), pit = 0.32, cp = Math.cos(pit), sp = Math.sin(pit);
        const c0 = P.c[0], c1 = P.c[1], c2 = P.c[2], sc = P.sc, up2 = a.up === 2;
        lb.fade(Math.pow(1 - L.p.fade, dt * 60));
        for (let i = 0; i < N; i++) {
          const nx = (px[i] - c0) * sc, ny = (py[i] - c1) * sc, nz = (pz[i] - c2) * sc;
          const X = lerp(fx[i], nx, e), Y = lerp(fy[i], up2 ? nz : ny, e), Z = lerp(fz[i], up2 ? ny : nz, e);
          ux[i] = X; uy[i] = Y; uz[i] = Z;
          const Y2 = e < 1 ? Y + Math.sin(e * Math.PI) * 0.25 * Math.sin(i * 0.37) : Y;
          const x1 = X * cy + Z * syw, z1 = -X * syw + Z * cy, y1 = Y2 * cp - z1 * sp, z2 = Y2 * sp + z1 * cp;
          const k = 3.4 / (3.4 + z2), qx = W / 2 + x1 * S * k, qy = H / 2 - 8 - y1 * S * k;
          const dep = Math.min(1, Math.max(0, (z2 + 1) / 2)), li = ((dep * 63) | 0) * 3, bri = lerp(0.26, 0.06, dep) * (e < 1 ? 0.6 : 1);
          if (sx[i] || sy[i]) { const dx = qx - sx[i], dy = qy - sy[i]; if (dx * dx + dy * dy < 900) lb.line(sx[i], sy[i], qx, qy, LUT[li] * bri, LUT[li + 1] * bri, LUT[li + 2] * bri); else lb.dot(qx, qy, LUT[li] * bri, LUT[li + 1] * bri, LUT[li + 2] * bri); }
          sx[i] = qx; sy[i] = qy;
        }
        lb.flush(1.2);
        g.globalCompositeOperation = 'source-over'; g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'lighter'; g.filter = blur; g.globalAlpha = 0.55; g.drawImage(lb.canvas, 0, 0); g.filter = 'none'; g.globalAlpha = 1; g.drawImage(lb.canvas, 0, 0);
        g.globalCompositeOperation = 'source-over';
        const tl = ease.out(seg(t - t0, MORPH * 0.6, MORPH + 0.6));
        g.globalAlpha = tl; g.fillStyle = C.cream; g.font = '600 22px Bahnschrift, Segoe UI'; g.fillText(a.name, 22, 318 + (1 - tl) * 8);
        g.globalAlpha = tl * 0.55; g.font = '500 11px Cascadia Mono, Consolas'; g.fillText(a.eq, 22, 340); g.globalAlpha = 1;
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-chladni', title: 'Chladni sand figures', aka: 'cymatics, standing waves, nodal lines, vibrating plate sand patterns', tool: 'Canvas 2D (particles on a standing-wave field)', runs: 'CPU',
    notice: 'A square plate vibrates in a standing wave. Each of 18,000 sand grains gets kicked in proportion to how much the plate moves under it, so grains bounce off the moving parts and pile up on the still nodal lines. When the mode changes, the sand jumps and finds the new pattern. The map on the right shows the motion: dark is still.',
    use: 'music and sound visuals, science explainers, satisfying pattern reveals',
    prompt: "Chladni plate seen from above: 18,000 cream sand grains on a dark steel square plate. The plate shape is cos(n pi x) cos(m pi y) - cos(m pi x) cos(n pi y). Each grain gets a random kick scaled by the plate motion under it plus a small slide downhill toward the nodal lines, so the sand forms the pattern in about two seconds. Cycle modes every 5 s, current mode m = {m}, n = {n}, with a small heat map of the vibration and the mode label beside the plate.",
    params: [{ key: 'm', label: 'Mode m', min: 1, max: 12, step: 1, value: 3 }, { key: 'n', label: 'Mode n', min: 1, max: 12, step: 1, value: 5 }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const N = 18000, PS = 300, X0 = (W - PS) / 2, Y0 = (H - PS) / 2, HOLD = 5.5; const r = rng(4);
      const MODES = [[3, 5, -1], [2, 7, 1], [4, 9, -1], [1, 6, 1], [5, 8, -1], [3, 10, 1], [6, 11, -1], [2, 5, 1]];
      const gx = new Float32Array(N), gy = new Float32Array(N);
      for (let i = 0; i < N; i++) { gx[i] = r(); gy[i] = r(); }
      const pc = document.createElement('canvas'); pc.width = PS; pc.height = PS; const pg = pc.getContext('2d'); const img = pg.createImageData(PS, PS); const pix = new Uint32Array(img.data.buffer);
      const base = new Uint32Array(PS * PS);
      for (let y = 0; y < PS; y++) for (let x = 0; x < PS; x++) { const d = Math.hypot(x - PS * 0.35, y - PS * 0.3) / PS, v = Math.max(0, 1 - d * 1.3), e = Math.min(x, y, PS - 1 - x, PS - 1 - y) < 2 ? 22 : 0; base[y * PS + x] = 0xff000000 | ((40 + v * 26 + e) << 16) | ((30 + v * 20 + e) << 8) | (26 + v * 18 + e); }
      const SAND = [[244, 239, 230], [255, 214, 150], [236, 200, 160]].map(c => 0xff000000 | (c[2] << 16) | (c[1] << 8) | c[0]);
      const mc = document.createElement('canvas'); mc.width = 64; mc.height = 64; const mg = mc.getContext('2d'); const mi = mg.createImageData(64, 64);
      let A = 0, B = 0, sg = -1, idx = 0, tMode = 0, manual = false, lm = L.p.m, ln = L.p.n;
      const setMode = (m, n, s2, t) => {
        A = m * Math.PI; B = n * Math.PI; sg = m === n ? 1 : s2; tMode = t;
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
          const u = (x + 0.5) / 64, v = (y + 0.5) / 64, f = Math.abs(Math.cos(B * u) * Math.cos(A * v) + sg * Math.cos(A * u) * Math.cos(B * v)) / 2, c = ramp(0.15 + f * 0.6), k = (x + y * 64) * 4, br = Math.min(1, f * 2.2);
          mi.data[k] = c[0] * br + 14 * (1 - br); mi.data[k + 1] = c[1] * br + 13 * (1 - br); mi.data[k + 2] = c[2] * br + 22 * (1 - br); mi.data[k + 3] = 255;
        }
        mg.putImageData(mi, 0, 0);
      };
      setMode(3, 5, -1, 0);
      return (t, dt) => {
        if (L.p.m !== lm || L.p.n !== ln) { lm = L.p.m; ln = L.p.n; manual = true; setMode(lm, ln, -1, t); }
        if (!manual && t - tMode > HOLD) { idx = (idx + 1) % MODES.length; const md = MODES[idx]; setMode(md[0], md[1], md[2], t); }
        const age = t - tMode, k = dt * 60, shake = (0.006 + 0.03 * Math.exp(-age * 2.2)) * k, pull = 0.0003 * k / Math.max(A, B) * 6;
        for (let i = 0; i < N; i++) {
          const x = gx[i], y = gy[i];
          const cbx = Math.cos(B * x), cay = Math.cos(A * y), cax = Math.cos(A * x), cby = Math.cos(B * y);
          const f = (cbx * cay + sg * cax * cby) / 2, af = Math.abs(f), s3 = f > 0 ? 1 : -1;
          const fx = (-B * Math.sin(B * x) * cay - sg * A * Math.sin(A * x) * cby) / 2, fy = (-A * cbx * Math.sin(A * y) - sg * B * cax * Math.sin(B * y)) / 2;
          const jit = af * shake + 0.0045 * k; let nx = x - s3 * fx * pull + (r() - 0.5) * jit, ny = y - s3 * fy * pull + (r() - 0.5) * jit;
          nx = nx < 0 ? -nx : nx > 1 ? 2 - nx : nx; ny = ny < 0 ? -ny : ny > 1 ? 2 - ny : ny;
          gx[i] = nx; gy[i] = ny;
        }
        pix.set(base);
        for (let i = 0; i < N; i++) { const x = (gx[i] * (PS - 2)) | 0, y = (gy[i] * (PS - 2)) | 0, o = y * PS + x; pix[o] = SAND[i % 3]; pix[o + 1] = SAND[(i + 1) % 3]; pix[o + PS] = SAND[2]; }
        pg.putImageData(img, 0, 0);
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const wob = Math.exp(-age * 3) * Math.sin(age * 70) * 1.2;
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(X0 + 6, Y0 + 8, PS, PS);
        g.drawImage(pc, X0 + wob, Y0);
        g.fillStyle = '#0d0c12'; g.beginPath(); g.arc(W / 2 + wob, H / 2, 6, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(244,239,230,0.25)'; g.lineWidth = 1; g.stroke();
        const m = Math.round(A / Math.PI), n = Math.round(B / Math.PI), lab = ease.out(seg(age, 0, 0.5));
        g.fillStyle = C.cream; g.globalAlpha = lab; g.font = '600 13px Bahnschrift, Segoe UI'; g.fillText('MODE', 30, 150);
        g.font = '600 34px Bahnschrift, Segoe UI'; g.fillText(`${m}, ${n}`, 30, 186 + (1 - lab) * 10);
        g.globalAlpha = 0.5 * lab; g.font = '500 11px Cascadia Mono, Consolas'; g.fillText(`~${Math.round((m * m + n * n) * 9)} Hz`, 30, 208);
        g.globalAlpha = 1; g.drawImage(mc, 512, 130, 96, 96); g.strokeStyle = 'rgba(244,239,230,0.2)'; g.strokeRect(511.5, 129.5, 97, 97);
        g.globalAlpha = 0.5; g.font = '500 11px Cascadia Mono, Consolas'; g.fillText('plate motion', 512, 244); g.globalAlpha = 1;
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-diffgrowth', title: 'Differential growth', aka: 'growing curve, coral and brain folds, space-filling line', tool: 'Canvas 2D (node springs + spatial hash repulsion)', runs: 'CPU',
    notice: 'A closed loop of points grows: long edges split in two, and random edges add new points. Each point pulls toward its two neighbours but pushes away from every other point nearby. With no room to stretch, the loop buckles into the folds of coral, brain or lettuce. It stays one closed loop: violet marks its inside.',
    use: 'organic brand textures, biology and growth stories, generative posters',
    prompt: "Differential growth: a small closed loop grows into a brain-coral pattern inside a circle. Points attract their two neighbours, repel every point within {rad} (spatial hash), long edges split, about {grow} random splits per step add growth. Draw it as a ribbon: dark wide stroke, then a radial coral-to-amber stroke, then a thin cream highlight, inside of the loop filled violet. Grow for 16 s to 2,600 points, hold, fade and regrow from a new seed.",
    params: [{ key: 'rad', label: 'Repulsion radius', min: 5, max: 14, step: 0.5, value: 8, unit: ' px' }, { key: 'grow', label: 'Random splits per step', min: 0, max: 6, step: 1, value: 2 }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const MAX = 2600, CX = W / 2, CY = H / 2, RB = 168, LOOP = 21;
      const x = new Float32Array(MAX), y = new Float32Array(MAX), nx = new Float32Array(MAX), ny = new Float32Array(MAX);
      const GW = 80, GH = 48, head = new Int32Array(GW * GH), next = new Int32Array(MAX);
      let n = 0, cyc = -1, r = rng(1), acc = 0;
      const reset = c => { r = rng(9 + c * 31); n = 40; for (let i = 0; i < n; i++) { const a = i / n * 6.283, rr = 14 + r() * 2; x[i] = CX + Math.cos(a) * rr; y[i] = CY + Math.sin(a) * rr; } };
      // Inserts a point between i and i+1.
      const split = i => { if (n >= MAX) return; const j = (i + 1) % n; const mx = (x[i] + x[j]) / 2, my = (y[i] + y[j]) / 2; x.copyWithin(i + 2, i + 1, n); y.copyWithin(i + 2, i + 1, n); x[i + 1] = mx; y[i + 1] = my; n++; };
      const step = () => {
        const R = L.p.rad, cs = W / GW; head.fill(-1);
        for (let i = 0; i < n; i++) { const gx2 = Math.min(GW - 1, Math.max(0, (x[i] / cs) | 0)), gy2 = Math.min(GH - 1, Math.max(0, (y[i] / cs) | 0)), c = gy2 * GW + gx2; next[i] = head[c]; head[c] = i; }
        const reach = Math.ceil(R / cs);
        for (let i = 0; i < n; i++) {
          const a = (i + n - 1) % n, b = (i + 1) % n, px = x[i], py = y[i];
          let fx = ((x[a] + x[b]) / 2 - px) * 0.35, fy = ((y[a] + y[b]) / 2 - py) * 0.35;
          const gx2 = (px / cs) | 0, gy2 = (py / cs) | 0; let rx = 0, ry = 0;
          for (let oy = -reach; oy <= reach; oy++) { const yy = gy2 + oy; if (yy < 0 || yy >= GH) continue; for (let ox = -reach; ox <= reach; ox++) { const xx = gx2 + ox; if (xx < 0 || xx >= GW) continue;
            for (let j = head[yy * GW + xx]; j >= 0; j = next[j]) { if (j === i) continue; const dx = px - x[j], dy = py - y[j], d2 = dx * dx + dy * dy; if (d2 < R * R && d2 > 1e-6) { const d = Math.sqrt(d2), k = (R - d) / R / d; rx += dx * k; ry += dy * k; } } } }
          fx += rx * 0.5; fy += ry * 0.5;
          const dc = Math.hypot(px - CX, py - CY); if (dc > RB) { fx -= (px - CX) / dc * (dc - RB) * 0.5; fy -= (py - CY) / dc * (dc - RB) * 0.5; }
          const m = Math.hypot(fx, fy); if (m > 1.2) { fx *= 1.2 / m; fy *= 1.2 / m; }
          nx[i] = px + fx; ny[i] = py + fy;
        }
        x.set(nx.subarray(0, n)); y.set(ny.subarray(0, n));
        const maxE = R * 0.62;
        for (let i = 0; i < n && n < MAX; i++) { const j = (i + 1) % n; if ((x[j] - x[i]) ** 2 + (y[j] - y[i]) ** 2 > maxE * maxE) { split(i); i++; } }
        for (let k = 0; k < L.p.grow; k++) split((r() * n) | 0);
      };
      const grad = g.createRadialGradient(CX, CY, 0, CX, CY, RB); grad.addColorStop(0, C.coral); grad.addColorStop(0.55, '#ff8a3c'); grad.addColorStop(1, C.amber);
      const inG = g.createRadialGradient(CX, CY, 0, CX, CY, RB); inG.addColorStop(0, '#6a2f5c'); inG.addColorStop(1, '#3a2466');
      const bgG = g.createRadialGradient(CX, CY, 20, CX, CY, 380); bgG.addColorStop(0, '#1a1426'); bgG.addColorStop(1, '#09080d');
      const path = () => { g.beginPath(); g.moveTo(x[0], y[0]); for (let i = 1; i < n; i++) g.lineTo(x[i], y[i]); g.closePath(); };
      return (t, dt) => {
        const c = Math.floor(t / LOOP); if (c !== cyc) { cyc = c; reset(c); acc = 0; }
        const lt = t - c * LOOP;
        if (lt < 17) { acc = Math.min(3, acc + dt * 100); while (acc >= 1) { step(); acc--; } }
        const a = 1 - ease.inOut(seg(lt, LOOP - 1.6, LOOP - 0.2)), sc = lerp(1, 0.94, 1 - a);
        g.fillStyle = bgG; g.fillRect(0, 0, W, H);
        g.save(); g.globalAlpha = a; g.translate(CX, CY); g.scale(sc, sc); g.translate(-CX, -CY);
        g.lineJoin = 'round'; path();
        g.fillStyle = inG; g.fill();
        g.strokeStyle = '#0c0910'; g.lineWidth = L.p.rad * 0.62; g.stroke();
        g.strokeStyle = grad; g.lineWidth = L.p.rad * 0.4; g.stroke();
        g.strokeStyle = 'rgba(255,240,220,0.55)'; g.lineWidth = 1; g.stroke();
        g.restore();
        g.globalAlpha = 0.45; g.fillStyle = C.cream; g.font = '500 11px Cascadia Mono, Consolas'; g.fillText(`${n} points`, 20, 340); g.globalAlpha = 1;
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-snowflake', title: 'Snowflake growth', aka: 'Reiter snowflake model, hexagonal cellular automaton, ice crystal growth', tool: 'JavaScript hex grid (Reiter cellular automaton) + Canvas 2D affine draw', runs: 'CPU',
    notice: 'A hexagonal grid holds water vapour. Cells that are ice, or touch ice, catch vapour and add a little more each step; all other cells share vapour with their six neighbours. Tips reach fresh vapour first, so arms grow and branch. Two numbers set the habit: background vapour (beta) and the steady supply (gamma).',
    use: 'winter and holiday visuals, science explainers, crystalline logo reveals',
    prompt: "Snowflake growing on a 160-cell hexagonal grid with Reiter's cellular automaton: alpha 1, background vapour beta {beta}, vapour supply gamma {gamma}. Frozen cells and their neighbours are receptive and keep their water plus gamma; the rest diffuse to the mean of their six neighbours. Draw the grid sheared into hexagons, ice from white tips to pale blue cores by freeze time, a darker depletion halo in the vapour, soft bloom, deep navy background. Grow over about 13 s, hold, fade, then grow the next habit (fern, stellar, star, sectored plate).",
    params: [{ key: 'beta', label: 'Background vapour (beta)', min: 0.25, max: 0.9, step: 0.01, value: 0.4 }, { key: 'gamma', label: 'Vapour supply (gamma)', min: 0, max: 0.02, step: 0.0001, value: 0.0001, dec: 4 }],
    controls: [['Fern', 0.4, 0.0001], ['Stellar', 0.35, 0.001], ['Star', 0.8, 0.002], ['Plate', 0.4, 0.02]].map(([lab], k) => ({ label: /** @type {string} */ (lab), on: k === 0, fn: L => L.snow && L.snow(k, true) })),
    setup(cv, L) {
      const g = cv.getContext('2d'); const N = 161, CC = 80, RMAX = 70, GROW = 13, HOLD = 2.6, FADE = 1;
      const PRE = [[0.4, 0.0001], [0.35, 0.001], [0.8, 0.002], [0.4, 0.02]];
      const s = new Float32Array(N * N), u = new Float32Array(N * N), fz = new Uint8Array(N * N), ft = new Float32Array(N * N), rec = new Uint8Array(N * N);
      const hd = i => { const dq = (i % N) - CC, dr = ((i / N) | 0) - CC; return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2; };
      const ins = []; for (let i = 0; i < N * N; i++) if (hd(i) < CC - 1) ins.push(i); const IN = Int32Array.from(ins);
      const oc = document.createElement('canvas'); oc.width = N; oc.height = N; const og = oc.getContext('2d'); const img = og.createImageData(N, N), px = img.data;
      const bc = document.createElement('canvas'); bc.width = N; bc.height = N; const bg2 = bc.getContext('2d'); const bimg = bg2.createImageData(N, N), bpx = bimg.data;
      const sc = 2.3, ox = W / 2 - 1.5 * sc * CC - sc * 0.75, oy = H / 2 - 0.866 * sc * CC - sc * 0.43;
      let beta = 0, gamma = 0, steps = 0, R = 0, t0 = 0, last = 0, manual = false, pi = 0;
      const art = () => cv.closest('article');
      const restart = () => { beta = L.p.beta; gamma = L.p.gamma; s.fill(beta); u.fill(beta); fz.fill(0); ft.fill(0); const c = CC * N + CC; s[c] = 1; fz[c] = 1; steps = 0; R = 0; t0 = last; };
      // Applies preset k by moving the sliders, so the prompt text follows.
      L.snow = (k, user) => {
        pi = k; const inputs = /** @type {HTMLInputElement[]} */ ([...art().querySelectorAll('.tweakpanel input')]);
        PRE[k].forEach((v, j) => { if (inputs[j]) { inputs[j].value = String(v); inputs[j].dispatchEvent(new Event('input')); } else L.p[j ? 'gamma' : 'beta'] = v; });
        if (user) manual = true; else art().querySelectorAll('.ctl button').forEach((b, j) => b.classList.toggle('on', j === k));
        restart();
      };
      const step = () => {
        for (let k = 0; k < IN.length; k++) { const i = IN[k]; const r = fz[i] | fz[i + 1] | fz[i - 1] | fz[i + N] | fz[i - N] | fz[i + N - 1] | fz[i - N + 1]; rec[i] = r; u[i] = r ? 0 : s[i]; }
        for (let k = 0; k < IN.length; k++) {
          const i = IN[k], un = u[i] + 0.5 * ((u[i + 1] + u[i - 1] + u[i + N] + u[i - N] + u[i + N - 1] + u[i - N + 1]) / 6 - u[i]);
          const v = rec[i] ? un + s[i] + gamma : un; s[i] = v;
          if (v >= 1 && !fz[i]) { fz[i] = 1; ft[i] = steps; const d = hd(i); if (d > R) R = d; }
        }
        steps++;
      };
      L.p.beta = L.p.beta || 0.4; restart();
      let lb = L.p.beta, lg = L.p.gamma;
      return (t, dt) => {
        last = t;
        if (L.p.beta !== lb || L.p.gamma !== lg) { lb = L.p.beta; lg = L.p.gamma; if (lb !== beta || lg !== gamma) { manual = true; restart(); } }
        let lt = t - t0;
        if (lt > GROW + HOLD + FADE) { if (!manual) L.snow((pi + 1) % PRE.length); else restart(); lb = L.p.beta; lg = L.p.gamma; lt = 0; }
        const target = RMAX * Math.min(1, lt / GROW); let n = 0; const tStart = performance.now();
        while (R < target && R < RMAX && n < 40 && performance.now() - tStart < 5) { step(); n++; }
        // outside cells keep beta and act as the vapour reservoir
        for (let k = 0; k < IN.length; k++) {
          const i = IN[k], o = i * 4;
          if (fz[i]) { const nb = fz[i + 1] + fz[i - 1] + fz[i + N] + fz[i - N] + fz[i + N - 1] + fz[i - N + 1], age = nb < 6 ? 0 : Math.pow(Math.min(1, (steps - ft[i]) / Math.max(60, steps * 0.8)), 0.7), rid = 0.5 + 0.5 * Math.cos(ft[i] * 0.09); px[o] = lerp(245, 70 + 40 * rid, age); px[o + 1] = lerp(252, 150 + 40 * rid, age); px[o + 2] = lerp(255, 215 + 25 * rid, age); px[o + 3] = 255; bpx[o] = px[o]; bpx[o + 1] = px[o + 1]; bpx[o + 2] = 255; bpx[o + 3] = 255; }
          else { const v = Math.min(1, s[i] / beta); px[o] = 9 + 12 * v; px[o + 1] = 12 + 18 * v; px[o + 2] = 26 + 34 * v; px[o + 3] = 255; bpx[o + 3] = 0; }
        }
        og.putImageData(img, 0, 0); bg2.putImageData(bimg, 0, 0);
        const fade = 1 - ease.inOut(seg(lt, GROW + HOLD, GROW + HOLD + FADE));
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = 'rgb(21,30,60)'; g.fillRect(0, 0, W, H);
        g.imageSmoothingEnabled = true; g.globalAlpha = fade; g.setTransform(sc, 0, 0.5 * sc, 0.866 * sc, ox, oy); g.drawImage(oc, 0, 0);
        g.globalCompositeOperation = 'lighter'; g.filter = 'blur(7px)'; g.globalAlpha = 0.45 * fade; g.drawImage(bc, 0, 0); g.filter = 'none';
        g.globalCompositeOperation = 'source-over'; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.5;
        g.fillStyle = C.cream; g.font = '500 11px Cascadia Mono, Consolas'; g.fillText(`beta ${beta.toFixed(2)}  gamma ${gamma.toFixed(4)}  step ${steps}`, 18, 342); g.globalAlpha = 1;
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-dla', title: 'Lichtenberg growth (DLA)', aka: 'diffusion-limited aggregation, Lichtenberg figure, electrical treeing, dendritic growth', tool: 'JavaScript grid (random walkers) + Canvas 2D', runs: 'CPU',
    notice: 'Particles wander in from far away on random walks and freeze the moment they touch the cluster. Tips stick out further and catch walkers first, so the cluster grows into branching, lightning-like trees. Trunks get thicker with every branch they carry, and pulses of light run out from the seed along the tree.',
    use: 'energy and electricity themes, neural and network metaphors, organic reveals',
    prompt: "Diffusion-limited aggregation as a Lichtenberg figure: random walkers launched on a circle just outside the cluster (big jumps while far away), stick with probability {stick} when they touch it, record their parent. Draw each particle as a line to its parent, width from the number of descendants, colour by depth from cream at the seed through coral to violet tips, soft bloom. Light pulses travel from the seed out along the branches every 1.4 s. Grow for 12 s, hold, fade and regrow.",
    params: [{ key: 'stick', label: 'Stickiness', min: 0.05, max: 1, step: 0.05, value: 1, restart: true }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const GW = 640, GH = 360, CX = 320, CY = 180, CS = 1, X0 = 0.5, Y0 = 0.5, RMAX = 170, MAXP = 14000, GROW = 13, LOOP = 19;
      const grid = new Int32Array(GW * GH), qx = new Int16Array(MAXP), qy = new Int16Array(MAXP), par = new Int32Array(MAXP), dep = new Int32Array(MAXP), desc = new Int32Array(MAXP);
      const tc = document.createElement('canvas'); tc.width = W; tc.height = H; const tg = tc.getContext('2d');
      const cols = ['#fff3dc', C.amber, C.coral, '#d9407a', C.violet, '#4a3bc4'];
      const WID = [0.7, 1.1, 1.6, 2.3, 3.2];
      let n = 0, Rc = 2, maxD = 1, r = rng(5), cyc = -1, wx = 0, wy = 0, alive = false, acc = 0;
      const byD = [];
      const reset = c => { r = rng(5 + c * 17); grid.fill(0); n = 1; qx[0] = CX; qy[0] = CY; par[0] = -1; dep[0] = 0; desc.fill(0); grid[CY * GW + CX] = 1; Rc = 2; maxD = 1; byD.length = 0; byD.push([0]); alive = false; };
      const launch = () => { const a = r() * 6.283, rr = Rc + 5; wx = Math.round(CX + Math.cos(a) * rr); wy = Math.round(CY + Math.sin(a) * rr); alive = true; };
      // Walks the current walker for up to budget steps; returns true when it stuck.
      const walk = budget => {
        for (let k = 0; k < budget; k++) {
          if (!alive) launch();
          const dx = wx - CX, dy = wy - CY, d = Math.sqrt(dx * dx + dy * dy);
          if (d > Rc * 2 + 40) { alive = false; continue; }
          if (d > Rc + 6) { const j = d - Rc - 4, a = r() * 6.283; wx = Math.round(wx + Math.cos(a) * j); wy = Math.round(wy + Math.sin(a) * j); continue; }
          const i = wy * GW + wx;
          const hit = grid[i - 1] || grid[i + 1] || grid[i - GW] || grid[i + GW] || grid[i - GW - 1] || grid[i - GW + 1] || grid[i + GW - 1] || grid[i + GW + 1];
          if (hit && r() < L.p.stick) {
            const p = hit - 1; qx[n] = wx; qy[n] = wy; par[n] = p; dep[n] = dep[p] + 1; grid[i] = n + 1;
            if (dep[n] > maxD) maxD = dep[n]; (byD[dep[n]] || (byD[dep[n]] = [])).push(n);
            for (let a2 = p; a2 >= 0; a2 = par[a2]) desc[a2]++;
            if (d + 1 > Rc) Rc = d + 1; n++; alive = false; return true;
          }
          const m = (r() * 4) | 0, nx = wx + (m === 0 ? 1 : m === 1 ? -1 : 0), ny = wy + (m === 2 ? 1 : m === 3 ? -1 : 0);
          if (!grid[ny * GW + nx]) { wx = nx; wy = ny; }
        }
        return false;
      };
      const seg2 = (ctx, i) => { const p = par[i]; ctx.moveTo(X0 + qx[i] * CS, Y0 + qy[i] * CS); ctx.lineTo(X0 + qx[p] * CS, Y0 + qy[p] * CS); };
      const bg = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 400); bg.addColorStop(0, '#16112a'); bg.addColorStop(1, '#07060c');
      return (t, dt) => {
        const c = Math.floor(t / LOOP); if (c !== cyc) { cyc = c; reset(c); acc = 0; }
        const lt = t - c * LOOP;
        if (lt < GROW && Rc < RMAX && n < MAXP) { acc += dt * 560; const t0 = performance.now(); while (acc >= 1 && performance.now() - t0 < 4 && Rc < RMAX && n < MAXP) { if (walk(4000)) acc--; } }
        tg.clearRect(0, 0, W, H); tg.lineCap = 'round';
        for (let wb = 0; wb < 5; wb++) for (let cb = 0; cb < 6; cb++) {
          tg.beginPath(); let any = false;
          for (let i = 1; i < n; i++) { const w = Math.min(4, Math.floor(Math.log2(desc[i] + 1) / 1.6)); if (w !== wb) continue; const cc = Math.min(5, Math.floor(dep[i] / (RMAX * 1.5) * 6)); if (cc !== cb) continue; seg2(tg, i); any = true; }
          if (any) { tg.strokeStyle = cols[cb]; tg.lineWidth = WID[wb]; tg.stroke(); }
        }
        // light pulses running out along the tree
        tg.globalCompositeOperation = 'lighter'; tg.strokeStyle = '#fff6e6'; tg.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const pt = lt - k * 1.4 - 0.6 - Math.floor((lt - 0.6) / 4.2) * 4.2; if (pt < 0) continue;
          const head = pt * 110; if (head - 8 > maxD) continue;
          for (let b = 0; b < 4; b++) {
            tg.beginPath(); tg.globalAlpha = 0.12 + 0.16 * b; tg.lineWidth = 0.8 + b * 0.35;
            for (let d2 = Math.max(1, Math.floor(head - 8 + b * 2)); d2 < Math.min(byD.length, head - 6 + b * 2); d2++) for (const i of byD[d2] || []) seg2(tg, i);
            tg.stroke();
          }
        }
        tg.globalAlpha = 1; tg.globalCompositeOperation = 'source-over';
        const fade = 1 - ease.inOut(seg(lt, LOOP - 1.4, LOOP - 0.2));
        g.globalAlpha = 1; g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.globalAlpha = fade; g.globalCompositeOperation = 'lighter'; g.filter = 'blur(6px)'; g.drawImage(tc, 0, 0); g.filter = 'none'; g.drawImage(tc, 0, 0);
        g.globalCompositeOperation = 'source-over'; g.fillStyle = C.cream; g.beginPath(); g.arc(X0 + CX * CS, Y0 + CY * CS, 3, 0, 6.3); g.fill();
        g.globalAlpha = 0.45; g.font = '500 11px Cascadia Mono, Consolas'; g.fillText(`${n} particles`, 18, 342); g.globalAlpha = 1;
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-magpend', title: 'Magnetic pendulum fractal', aka: 'basins of attraction, three-magnet pendulum, chaotic scattering', tool: 'WebGL2 fragment shader (one pendulum per pixel, shared context) + Canvas 2D', runs: 'GPU',
    notice: 'A pendulum swings over three magnets and always comes to rest on one of them. Every pixel of the map is its own pendulum, released from that spot and simulated on the GPU, coloured by the magnet it ends on and darker the longer it took. Near the borders the outcome is chaotic, so the colours braid into fractals. The white bobs are live pendulums.',
    use: 'chaos and science explainers, hypnotic abstract backgrounds, "where you start matters" stories',
    prompt: "Magnetic pendulum basin fractal: a pendulum (spring pull 0.45, friction {fric}, magnet height {h}) over three magnets in a triangle. A fragment shader simulates one pendulum per pixel for up to 600 steps and colours the pixel coral, amber or cyan by the magnet it ends on, darker the longer it took. Friction breathes slowly so the fractal borders morph. On top, five white bobs released at random leave glowing trails, then take the colour of the magnet they land on.",
    params: [{ key: 'fric', label: 'Friction', min: 0.06, max: 0.4, step: 0.01, value: 0.16 }, { key: 'h', label: 'Magnet height', min: 0.1, max: 0.6, step: 0.01, value: 0.25 }],
    setup(cv, L) {
      const ctx = cv.getContext('2d'); const G = EX.G; if (!G.gl) return () => {};
      const SC = H / 3.2, MAG = [[0, 1], [-0.866, -0.5], [0.866, -0.5]], MC = [C.coral, C.amber, C.cyan];
      const prog = G.prog(`uniform float uFric,uH2;
const vec2 M0=vec2(0.,1.),M1=vec2(-.866,-.5),M2=vec2(.866,-.5);
vec2 acc(vec2 p,vec2 v){vec2 a=-.45*p-uFric*v;vec2 d=M0-p;float r=dot(d,d)+uH2;a+=d/(r*sqrt(r));d=M1-p;r=dot(d,d)+uH2;a+=d/(r*sqrt(r));d=M2-p;r=dot(d,d)+uH2;a+=d/(r*sqrt(r));return a;}
vec3 run(vec2 p){vec2 v=vec2(0);float n=0.;
for(int i=0;i<600;i++){v+=acc(p,v)*.025;p+=v*.025;n+=1.;if(dot(v,v)<.0004&&min(min(length(p-M0),length(p-M1)),length(p-M2))<.2)break;}
float d0=length(p-M0),d1=length(p-M1),d2=length(p-M2);
vec3 c=d0<d1&&d0<d2?vec3(1.,.353,.212):d1<d2?vec3(1.,.69,.125):vec3(.169,.769,.902);
return c*(.2+.72*exp(-n/300.));}
void main(){vec2 q=(gl_FragCoord.xy-.5*uRes)/uRes.y*3.2,e=vec2(.25,.25)/uRes.y*3.2;
vec3 c=.5*(run(q+e)+run(q-e));float vg=1.-.35*dot(q/3.2,q/3.2);o=vec4(c*vg,1);}`);
      const NB = 5, TL = 150; const bobs = [];
      for (let k = 0; k < NB; k++) bobs.push({ x: 0, y: 0, vx: 0, vy: 0, sx: 0, sy: 0, tr: new Float32Array(TL * 2), n: 0, land: -1, wait: k * 0.7, rest: 0 });
      const r = rng(8);
      const spawn = b => { b.x = (r() - 0.5) * 5.2; b.y = (r() - 0.5) * 2.9; b.sx = b.x; b.sy = b.y; b.vx = 0; b.vy = 0; b.n = 0; b.land = -1; b.rest = 0; };
      const sx = x => W / 2 + x * SC, sy = y => H / 2 - y * SC;
      return (t, dt) => {
        const fric = L.p.fric * (1 + 0.3 * Math.sin(t * 0.35)), h2 = L.p.h * L.p.h;
        G.draw(prog, null, { uFric: fric, uH2: h2 }, W, H); G.copy(ctx, W, H);
        const nst = Math.max(1, Math.round(dt * 120));
        for (const b of bobs) {
          if (b.wait > 0) { b.wait -= dt; if (b.wait <= 0) spawn(b); continue; }
          for (let s2 = 0; s2 < nst && b.land < 0; s2++) {
            let ax = -0.45 * b.x - fric * b.vx, ay = -0.45 * b.y - fric * b.vy;
            for (const [mx, my] of MAG) { const dx = mx - b.x, dy = my - b.y, rr = dx * dx + dy * dy + h2, k3 = 1 / (rr * Math.sqrt(rr)); ax += dx * k3; ay += dy * k3; }
            b.vx += ax * 0.025; b.vy += ay * 0.025; b.x += b.vx * 0.025; b.y += b.vy * 0.025;
            const o = (b.n % TL) * 2; b.tr[o] = b.x; b.tr[o + 1] = b.y; b.n++;
            if (b.vx * b.vx + b.vy * b.vy < 0.0004) MAG.forEach(([mx, my], j) => { if (Math.hypot(mx - b.x, my - b.y) < 0.2) b.land = j; });
            if (b.n > 1400) b.land = 0;
          }
          if (b.land >= 0) { b.rest += dt; if (b.rest > 1.4) { b.wait = 0.2 + r() * 0.6; continue; } }
          const a = b.land >= 0 ? 1 - b.rest / 1.4 : 1, m = Math.min(b.n, TL), col = b.land >= 0 ? MC[b.land] : '#ffffff';
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          for (let c = 0; c < 4; c++) {
            ctx.beginPath(); ctx.strokeStyle = col; ctx.globalAlpha = a * (0.15 + 0.25 * c); ctx.lineWidth = 1 + c * 0.4;
            const i0 = Math.floor(m * c / 4), i1 = Math.floor(m * (c + 1) / 4);
            for (let i = i0; i <= Math.min(i1, m - 1); i++) { const o = ((b.n - m + i) % TL) * 2; i === i0 ? ctx.moveTo(sx(b.tr[o]), sy(b.tr[o + 1])) : ctx.lineTo(sx(b.tr[o]), sy(b.tr[o + 1])); }
            ctx.stroke();
          }
          ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx(b.sx), sy(b.sy), 5, 0, 6.3); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(sx(b.x), sy(b.y), 3.6, 0, 6.3); ctx.fill();
        }
        ctx.globalAlpha = 1;
        MAG.forEach(([mx, my], j) => { ctx.fillStyle = '#0b0b10'; ctx.strokeStyle = MC[j]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sx(mx), sy(my), 7, 0, 6.3); ctx.fill(); ctx.stroke(); });
        ctx.globalAlpha = 0.6; ctx.fillStyle = C.cream; ctx.font = '500 11px Cascadia Mono, Consolas'; ctx.fillText(`friction ${fric.toFixed(3)}`, 16, 344); ctx.globalAlpha = 1;
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-galaxies', title: 'Galaxy collision', aka: 'tidal tails, restricted N-body, Toomre encounter, galactic merger', tool: 'Canvas 2D (leapfrog N-body + float light buffer)', runs: 'CPU',
    notice: 'Two disk galaxies of 5,000 stars each fall past one another. Only the two heavy cores pull; stars are pulled by both cores but not by each other, the trick Toomre used in 1972. On the close pass, gravity tears long tidal tails and a bridge of stars between the galaxies before the cores fall back together.',
    use: 'space and science content, epic intros, "collision" and "merger" metaphors',
    prompt: "Galaxy collision with a restricted N-body model: two disk galaxies of 5,000 stars each on circular orbits around heavy cores, disks tilted {tilt} degrees to the orbit plane, on a parabolic encounter. Leapfrog steps; only cores attract. Draw stars as additive glowing points with short trails (cyan-violet galaxy and amber-coral galaxy), bright cream cores, slow orbiting camera. The close pass throws out long tidal tails and a bridge, then the cores merge. 22 s loop.",
    params: [{ key: 'tilt', label: 'Disk tilt', min: 0, max: 90, step: 5, value: 25, unit: ' deg', restart: true }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const NS = 5000, N = NS * 2, LOOP = 22, SCALE = 46, RATE = 1.05, HS = 0.01;
      const lb = lightBuf(W, H), r = rng(12);
      const x = new Float32Array(N), y = new Float32Array(N), z = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N), bri = new Float32Array(N);
      const cx = [0, 0], cy = [0, 0], cz = [0, 0], cvx = [0, 0], cvy = [0, 0], cvz = [0, 0], CM = [1, 1], EPS = 0.04;
      const COL = [[0.45, 0.75, 1], [1, 0.62, 0.3]];
      let cyc = -1, acc = 0, simT = 0;
      const reset = () => {
        simT = 0; cx[0] = -3; cy[0] = -2.4; cz[0] = 0; cx[1] = 3; cy[1] = 2.4; cz[1] = 0;
        const d = Math.hypot(6, 4.8), v = Math.sqrt(2 * (CM[0] + CM[1]) / d) / 2 * 0.9;
        cvx[0] = v; cvy[0] = 0; cvx[1] = -v; cvy[1] = 0; cvz[0] = cvz[1] = 0;
        const tl = L.p.tilt * Math.PI / 180;
        for (let gi = 0; gi < 2; gi++) {
          const ti = gi ? -tl : tl, ct = Math.cos(ti), st = Math.sin(ti);
          for (let k = 0; k < NS; k++) {
            const i = gi * NS + k, arm = k % 3 < 2, rr = arm ? 0.2 + Math.pow(r(), 0.9) * 1.5 : 0.1 + Math.pow(r(), 1.6) * 1.6;
            const a = arm ? (k % 3) * Math.PI + 2.6 * Math.log(rr / 0.2) + (r() + r() - 1) * 0.45 + gi : r() * 6.283;
            const vc = Math.sqrt(CM[gi] * rr * rr / Math.pow(rr * rr + EPS, 1.5));
            const px = Math.cos(a) * rr, py = Math.sin(a) * rr, pvx = -Math.sin(a) * vc, pvy = Math.cos(a) * vc;
            x[i] = cx[gi] + px; y[i] = cy[gi] + py * ct; z[i] = py * st; vx[i] = cvx[gi] + pvx; vy[i] = cvy[gi] + pvy * ct; vz[i] = pvy * st;
            bri[i] = (0.5 + r()) * (arm ? 1.1 : 0.7) * (1.4 - rr * 0.55);
          }
        }
        lb.clear(); acc = 0;
      };
      const step = () => {
        const dx = cx[1] - cx[0], dy = cy[1] - cy[0], dz = cz[1] - cz[0], d2 = dx * dx + dy * dy + dz * dz + 0.1, f = 1 / (d2 * Math.sqrt(d2));
        cvx[0] += dx * f * CM[1] * HS; cvy[0] += dy * f * CM[1] * HS; cvz[0] += dz * f * CM[1] * HS; cvx[1] -= dx * f * CM[0] * HS; cvy[1] -= dy * f * CM[0] * HS; cvz[1] -= dz * f * CM[0] * HS;
        for (let k = 0; k < 2; k++) { cx[k] += cvx[k] * HS; cy[k] += cvy[k] * HS; cz[k] += cvz[k] * HS; }
        const ax0 = cx[0], ay0 = cy[0], az0 = cz[0], ax1 = cx[1], ay1 = cy[1], az1 = cz[1];
        for (let i = 0; i < N; i++) {
          let ex = ax0 - x[i], ey = ay0 - y[i], ez = az0 - z[i], q = ex * ex + ey * ey + ez * ez + EPS, k = CM[0] / (q * Math.sqrt(q)) * HS;
          let ux = vx[i] + ex * k, uy = vy[i] + ey * k, uz = vz[i] + ez * k;
          ex = ax1 - x[i]; ey = ay1 - y[i]; ez = az1 - z[i]; q = ex * ex + ey * ey + ez * ez + EPS; k = CM[1] / (q * Math.sqrt(q)) * HS;
          ux += ex * k; uy += ey * k; uz += ez * k; vx[i] = ux; vy[i] = uy; vz[i] = uz; x[i] += ux * HS; y[i] += uy * HS; z[i] += uz * HS;
        }
      };
      const bg = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 420); bg.addColorStop(0, '#0e0d1c'); bg.addColorStop(1, '#050509');
      return (t, dt) => {
        const c = Math.floor(t / LOOP); if (c !== cyc) { cyc = c; reset(); }
        const lt = t - c * LOOP;
        acc += dt * RATE; let n = 0; while (acc >= HS && n < 12) { step(); acc -= HS; n++; simT += HS; } if (n === 12) acc = 0;
        const yaw = 0.35 + lt * 0.04, cyw = Math.cos(yaw), syw = Math.sin(yaw), pit = 0.9, cp = Math.cos(pit), sp = Math.sin(pit);
        const mx = (cx[0] + cx[1]) / 2, my = (cy[0] + cy[1]) / 2, mz = (cz[0] + cz[1]) / 2;
        const sep = Math.hypot(cx[1] - cx[0], cy[1] - cy[0], cz[1] - cz[0]), zs = Math.min(1, 7 / (sep + 1.6)) * SCALE;
        const proj = (X, Y, Z, out) => { X -= mx; Y -= my; Z -= mz; const x1 = X * cyw - Y * syw, y1 = X * syw + Y * cyw, y2 = y1 * cp - Z * sp, z2 = y1 * sp + Z * cp, k = 9 / (9 + z2); out[0] = W / 2 + x1 * zs * k; out[1] = H / 2 + y2 * zs * k; out[2] = k; };
        const o = [0, 0, 0];
        lb.fade(Math.pow(0.55, dt * 60));
        for (let i = 0; i < N; i++) { proj(x[i], y[i], z[i], o); const cc = COL[i < NS ? 0 : 1], b = bri[i] * 0.3 * o[2]; lb.dot(o[0], o[1], cc[0] * b, cc[1] * b, cc[2] * b); }
        lb.flush(1);
        const fade = 1 - ease.inOut(seg(lt, LOOP - 1.2, LOOP));
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.globalAlpha = fade * ease.out(seg(lt, 0, 0.8)); g.globalCompositeOperation = 'lighter'; g.filter = 'blur(4px)'; g.drawImage(lb.canvas, 0, 0); g.filter = 'none'; g.drawImage(lb.canvas, 0, 0);
        for (let k = 0; k < 2; k++) { proj(cx[k], cy[k], cz[k], o); const gr = g.createRadialGradient(o[0], o[1], 0, o[0], o[1], 16); gr.addColorStop(0, 'rgba(255,246,230,0.95)'); gr.addColorStop(1, 'rgba(255,246,230,0)'); g.fillStyle = gr; g.fillRect(o[0] - 16, o[1] - 16, 32, 32); }
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.5 * fade; g.fillStyle = C.cream; g.font = '500 11px Cascadia Mono, Consolas'; g.fillText(`${Math.round(simT * 45)} million years`, 18, 342); g.globalAlpha = 1;
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-fireflies', title: 'Fireflies that synchronize', aka: 'pulse-coupled oscillators, Mirollo-Strogatz, Kuramoto sync, emergent rhythm', tool: 'Canvas 2D (pulse-coupled phase oscillators)', runs: 'CPU',
    notice: 'Each of 240 fireflies has its own clock and flashes when it runs out. Seeing a neighbour flash nudges its clock forward a little. Nobody leads, yet small groups lock together, flashes sweep across the meadow in waves, and after some seconds the whole field blinks as one. The strip at the bottom counts flashes over time.',
    use: 'emergence and teamwork metaphors, nature scenes, ambient night loops',
    prompt: "Fireflies in a night meadow that synchronize: 240 pulse-coupled oscillators (Mirollo-Strogatz), each with its own rate near 1 Hz; a flash advances the phase of every firefly within {rad} by about {eps} times its phase (shared among the neighbours), chains can fire in the same frame. Yellow-green glows with additive blending, grass silhouettes in front and behind, the meadow lights up a little with every flash, and a strip at the bottom plots flashes per frame. Random start, full sync in about 10 s, 26 s loop.",
    params: [{ key: 'eps', label: 'Coupling', min: 0, max: 0.3, step: 0.01, value: 0.06 }, { key: 'rad', label: 'Seeing distance', min: 30, max: 700, step: 10, value: 170, unit: ' px' }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const N = 240, LOOP = 26, r = rng(23);
      const fx = new Float32Array(N), fy = new Float32Array(N), ph = new Float32Array(N), om = new Float32Array(N), fl = new Float32Array(N), ns = new Float32Array(N), fired = new Uint8Array(N);
      for (let i = 0; i < N; i++) { fx[i] = 20 + r() * 600; fy[i] = 70 + Math.pow(r(), 0.7) * 230; om[i] = 0.92 + r() * 0.16; ns[i] = r() * 100; }
      const sprite = document.createElement('canvas'); sprite.width = sprite.height = 48; const sg = sprite.getContext('2d');
      const gr = sg.createRadialGradient(24, 24, 0, 24, 24, 24); gr.addColorStop(0, 'rgba(255,255,235,1)'); gr.addColorStop(0.07, 'rgba(240,255,170,1)'); gr.addColorStop(0.16, 'rgba(200,250,110,0.45)'); gr.addColorStop(0.45, 'rgba(150,230,80,0.12)'); gr.addColorStop(1, 'rgba(120,200,60,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 48, 48);
      // grass silhouettes: one layer behind the fireflies and one in front
      const layer = (seed, base, hgt, col, n) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const q = c.getContext('2d'), rr = rng(seed); q.fillStyle = col; q.strokeStyle = col; q.lineCap = 'round';
        q.beginPath(); q.moveTo(0, H); for (let x = 0; x <= W; x += 16) q.lineTo(x, base + Math.sin(x * 0.012 + seed) * 8); q.lineTo(W, H); q.fill();
        for (let k = 0; k < n; k++) { const x = rr() * W, h = hgt * (0.4 + rr()), bend = (rr() - 0.5) * 40; q.lineWidth = 1 + rr() * 2.2; q.beginPath(); q.moveTo(x, base + 6); q.quadraticCurveTo(x + bend * 0.3, base - h * 0.6, x + bend, base - h); q.stroke(); }
        return c; };
      const back = layer(3, 300, 60, '#0d1424', 260), front = layer(7, 336, 46, '#05070d', 200);
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0a0d1e'); sky.addColorStop(1, '#141a2e');
      const stars = [...Array(70)].map(() => [r() * W, r() * 150, r() * 1.2 + 0.3]);
      const hist = new Float32Array(160); let hi = 0, cyc = -1, hb = 0;
      const queue = new Int32Array(N);
      return (t, dt) => {
        const c = Math.floor(t / LOOP); if (c !== cyc) { cyc = c; for (let i = 0; i < N; i++) { ph[i] = r(); fl[i] = 0; } hist.fill(0); hi = 0; hb = 0; }
        const lt = t - c * LOOP, R2 = L.p.rad * L.p.rad, eps = L.p.eps * 20 / Math.max(1, N * Math.min(1, Math.PI * R2 / 147200));
        let qn = 0; fired.fill(0);
        for (let i = 0; i < N; i++) { ph[i] += dt * om[i]; if (ph[i] >= 1) { queue[qn++] = i; fired[i] = 1; } }
        for (let q = 0; q < qn; q++) {
          const i = queue[q]; ph[i] = 0; fl[i] = 1;
          for (let j = 0; j < N; j++) { if (fired[j]) continue; const dx = fx[j] - fx[i], dy = fy[j] - fy[i]; if (dx * dx + dy * dy > R2) continue; ph[j] += eps * (ph[j] + 0.05); if (ph[j] >= 1) { fired[j] = 1; queue[qn++] = j; } }
        }
        let glow = 0;
        for (let i = 0; i < N; i++) { fl[i] *= Math.pow(0.004, dt); glow += fl[i]; const a = ns[i] + t * 0.15; fx[i] += Math.cos(a * 1.3 + Math.sin(a)) * 6 * dt; fy[i] += Math.sin(a * 0.9) * 4 * dt; }
        hist[hi % hist.length] += qn; hb += dt; if (hb >= 0.05) { hb -= 0.05; hi++; hist[hi % hist.length] = 0; }
        const amb = Math.min(1, glow / N * 3);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = sky; g.fillRect(0, 0, W, H);
        g.fillStyle = `rgba(150,200,90,${0.1 * amb})`; g.fillRect(0, 0, W, H);
        g.fillStyle = C.cream; for (const [x, y, s2] of stars) { g.globalAlpha = 0.35; g.fillRect(x, y, s2, s2); } g.globalAlpha = 1;
        g.drawImage(back, 0, 0);
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < N; i++) { const b = 0.05 + fl[i] * 0.95, z = 0.55 + (fy[i] - 70) / 230 * 0.6, s2 = 48 * z * (0.5 + fl[i] * 0.7); g.globalAlpha = b; g.drawImage(sprite, fx[i] - s2 / 2, fy[i] - s2 / 2, s2, s2); }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        g.drawImage(front, 0, 0);
        g.fillStyle = `rgba(170,230,100,${0.05 * amb})`; g.fillRect(0, 280, W, 80);
        // flashes per frame, newest on the right
        const bx = 400, by = 348, bw = 220; g.fillStyle = 'rgba(200,255,140,0.7)';
        for (let k = 0; k < hist.length; k++) { const v = hist[(hi + 1 + k) % hist.length]; if (v) { const h = Math.min(28, 1 + Math.sqrt(v) * 1.8); g.fillRect(bx + k / hist.length * bw, by - h, 1.2, h); } }
        g.globalAlpha = 0.5; g.fillStyle = C.cream; g.font = '500 11px Cascadia Mono, Consolas'; g.fillText('flashes', bx - 58, by); g.fillText(`t ${lt.toFixed(1)} s`, 18, by); g.globalAlpha = 1;
        const f2 = 1 - ease.inOut(seg(lt, LOOP - 0.8, LOOP)); if (f2 < 1) { g.fillStyle = `rgba(5,7,13,${1 - f2})`; g.fillRect(0, 0, W, H); }
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-ising', title: 'Magnet domains (Ising model)', aka: 'Ising model, Metropolis Monte Carlo, phase transition, critical point, coarsening', tool: 'JavaScript lattice (Metropolis sweeps) + Canvas 2D', runs: 'CPU',
    notice: 'Every cell is a tiny magnet pointing up (warm) or down (cool) that prefers to agree with its four neighbours, while heat flips cells at random. Hot, it is noise. Cooled below the critical temperature of about 2.27, neighbours win: domains form, merge and grow. Right at the critical point, clusters of every size appear at once.',
    use: 'physics and emergence explainers, "order from chaos" stories, living abstract textures',
    prompt: "2D Ising model on a 320 x 180 grid with Metropolis checkerboard sweeps (lookup table for exp(-dE/T)), external field {field}. Temperature drifts from 3.6 down through the critical point 2.27 to 1.4, holds while domains coarsen, then heats up again, 24 s loop. Up spins in a coral-amber gradient, down spins in deep violet-navy, upscaled with smoothing so domains look like soft liquid blobs. A thermometer bar marks the critical point and shows the magnetisation.",
    params: [{ key: 'field', label: 'External field', min: -0.3, max: 0.3, step: 0.01, value: 0 }],
    controls: [{ label: 'Auto sweep', on: true, fn: L => { L.ising = -1; } }, { label: 'Hot 3.5', fn: L => { L.ising = 3.5; } }, { label: 'Critical 2.27', fn: L => { L.ising = 2.269; } }, { label: 'Cold 1.5', fn: L => { L.ising = 1.5; } }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const SW = 320, SH = 180, LOOP = 24, r = rng(31); if (L.ising === undefined) L.ising = -1;
      const sp = new Int8Array(SW * SH); for (let i = 0; i < sp.length; i++) sp[i] = r() < 0.5 ? 1 : -1;
      const oc = document.createElement('canvas'); oc.width = SW; oc.height = SH; const og = oc.getContext('2d'); const img = og.createImageData(SW, SH), pix = new Uint32Array(img.data.buffer);
            const UP = new Uint32Array(SW * SH), DN = new Uint32Array(SW * SH), mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
      const pk = c => 0xff000000 | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0]);
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const k = (x / SW) * 0.7 + (y / SH) * 0.3; UP[y * SW + x] = pk(mix3(hexRGB(C.coral), hexRGB(C.amber), k)); DN[y * SW + x] = pk(mix3([44, 30, 104], [16, 20, 52], k)); }
      const pr = new Float32Array(20); let lastT = -1, lastH = 99, mag = 0, acc = 0;
      // Probability table for accepting a flip, indexed by the neighbour sum (-4..4) and spin.
      const table = (T, h) => { for (let s0 = 0; s0 < 2; s0++) for (let k = -4; k <= 4; k += 2) { const s2 = s0 ? 1 : -1, dE = 2 * s2 * (k + h); pr[s0 * 10 + k + 4] = dE <= 0 ? 1 : Math.exp(-dE / T); } };
      const sweep = () => {
        for (let par = 0; par < 2; par++) for (let y = 0; y < SH; y++) {
          const yu = ((y + SH - 1) % SH) * SW, yc = y * SW, yd = ((y + 1) % SH) * SW;
          for (let x = (y + par) & 1; x < SW; x += 2) { const i = yc + x, s0 = sp[i], k = sp[yu + x] + sp[yd + x] + sp[yc + (x + 1) % SW] + sp[yc + (x + SW - 1) % SW]; if (r() < pr[(s0 > 0 ? 10 : 0) + k + 4]) sp[i] = -s0; }
        }
      };
      return (t, dt) => {
        const lt = t % LOOP;
        const T = L.ising > 0 ? L.ising : lt < 10 ? lerp(3.6, 1.4, seg(lt, 1.5, 10)) : lt < 15 ? 1.4 : lerp(1.4, 3.6, ease.inOut(seg(lt, 15, 23)));
        if (Math.abs(T - lastT) > 1e-3 || L.p.field !== lastH) { table(T, L.p.field); lastT = T; lastH = L.p.field; }
        acc = Math.min(3, acc + dt * 60); while (acc >= 1) { sweep(); acc--; }
        let m = 0; for (let i = 0; i < sp.length; i++) { const s0 = sp[i]; m += s0; pix[i] = s0 > 0 ? UP[i] : DN[i]; }
        mag = lerp(mag, m / sp.length, 0.2);
        og.putImageData(img, 0, 0);
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.filter = 'blur(0.7px)'; g.drawImage(oc, -2, -2, W + 4, H + 4); g.filter = 'none';
        // thermometer: 1 to 4.2, critical mark at 2.27
        const tx = 22, ty0 = 70, ty1 = 276, ty = v => lerp(ty1, ty0, (v - 1) / 3.2);
        g.fillStyle = 'rgba(10,10,18,0.86)'; g.beginPath(); g.roundRect(10, 26, 108, 300, 10); g.fill();
        g.fillStyle = 'rgba(244,239,230,0.15)'; g.fillRect(tx, ty0, 6, ty1 - ty0);
        g.fillStyle = C.cream; g.fillRect(tx, ty(T), 6, ty1 - ty(T));
        g.strokeStyle = C.amber; g.lineWidth = 1.5; g.beginPath(); g.moveTo(tx - 4, ty(2.269)); g.lineTo(tx + 10, ty(2.269)); g.stroke();
        g.font = '500 11px Cascadia Mono, Consolas'; g.fillStyle = C.amber; g.fillText('Tc 2.27', tx + 14, ty(2.269) + 4);
        g.fillStyle = C.cream; g.font = '600 20px Bahnschrift, Segoe UI'; g.fillText(`T ${T.toFixed(2)}`, tx - 2, 54); g.beginPath(); g.moveTo(tx + 8, ty(T)); g.lineTo(tx + 14, ty(T) - 4); g.lineTo(tx + 14, ty(T) + 4); g.fill();
        g.font = '500 11px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.7)'; g.fillText('magnet', tx + 14, 296); g.fillText(`${mag >= 0 ? '+' : '-'}${Math.abs(mag).toFixed(2)}`, tx + 14, 312);
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-sph', title: 'Water tank (SPH)', aka: 'smoothed particle hydrodynamics, dam break, particle fluid, double density relaxation', tool: 'JavaScript particles (Clavet double density relaxation) + density-field render', runs: 'CPU',
    notice: 'The water is 1,200 particles. Each one measures how crowded it is within a small radius and pushes its neighbours apart when it is too crowded, which makes the swarm behave like a liquid. A gate lifts, the wall of water collapses, slams into the far side and sloshes, then a second blob drops in. The surface is drawn from a smoothed density field, with white foam where particles move fast.',
    use: 'liquid and product splash concepts, physics explainers, satisfying loops',
    prompt: "2D SPH water tank: 1,200 particles with Clavet double density relaxation (rest density {rho}, stiffness 0.35, near stiffness 0.6), gravity, 3 substeps per frame, spatial hash. A gate lifts and a dam-break wall of water collapses, splashes against the right wall and sloshes; at 8 s a second blob falls in. Render a smoothed density field with a deep-blue to cyan gradient, a soft bright rim and white foam where speed is high, inside a dark glass tank. 17 s loop.",
    params: [{ key: 'rho', label: 'Rest density', min: 1, max: 4, step: 0.1, value: 2, restart: true }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const N = 1200, HR = 16, TX0 = 40, TX1 = 600, TY0 = 30, TY1 = 330, LOOP = 17, GRAV = 0.06, KS = 0.35, KN = 0.6, GATE = TX0 + 182;
      const x = new Float32Array(N), y = new Float32Array(N), px = new Float32Array(N), py = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
      const CS = HR, GW = Math.ceil(W / CS) + 1, GH = Math.ceil(H / CS) + 1, head = new Int32Array(GW * GH), next = new Int32Array(N);
      const nb = new Int32Array(64), nq = new Float32Array(64);
      let n = 0, cyc = -1, dropped = false; const r = rng(2);
      const place = (cnt, x0, y0, cols, sp) => { for (let k = 0; k < cnt && n < N; k++, n++) { x[n] = x0 + (k % cols) * sp + r() * 0.5; y[n] = y0 - Math.floor(k / cols) * sp + r() * 0.5; vx[n] = vy[n] = 0; } };
      const reset = () => { n = 0; dropped = false; place(900, TX0 + 6, TY1 - 4, 25, 7); };
      const step = () => {
        const rho0 = L.p.rho;
        for (let i = 0; i < n; i++) { vy[i] += GRAV; px[i] = x[i]; py[i] = y[i]; x[i] += vx[i]; y[i] += vy[i]; }
        head.fill(-1); for (let i = 0; i < n; i++) { const c = Math.min(GH - 1, Math.max(0, (y[i] / CS) | 0)) * GW + Math.min(GW - 1, Math.max(0, (x[i] / CS) | 0)); next[i] = head[c]; head[c] = i; }
        for (let i = 0; i < n; i++) {
          const gx = (x[i] / CS) | 0, gy = (y[i] / CS) | 0; let m = 0, d = 0, dn = 0;
          for (let oy = -1; oy <= 1; oy++) { const yy = gy + oy; if (yy < 0 || yy >= GH) continue; for (let ox = -1; ox <= 1; ox++) { const xx = gx + ox; if (xx < 0 || xx >= GW) continue;
            for (let j = head[yy * GW + xx]; j >= 0 && m < 64; j = next[j]) { if (j === i) continue; const dx = x[j] - x[i], dy = y[j] - y[i], q2 = (dx * dx + dy * dy) / (HR * HR); if (q2 >= 1) continue; const q = 1 - Math.sqrt(q2); d += q * q; dn += q * q * q; nb[m] = j; nq[m++] = q; } } }
          const P = KS * (d - rho0), PN = KN * dn; let ax = 0, ay = 0;
          for (let k = 0; k < m; k++) { const j = nb[k], q = nq[k], dx = x[j] - x[i], dy = y[j] - y[i], len = Math.sqrt(dx * dx + dy * dy) || 1, D = (P * q + PN * q * q) * 0.5 / len; x[j] += dx * D; y[j] += dy * D; ax -= dx * D; ay -= dy * D; }
          x[i] += ax; y[i] += ay;
        }
        for (let i = 0; i < n; i++) {
          if (x[i] < TX0 + 2) x[i] = TX0 + 2 + r() * 0.1; if (gateOn && x[i] > GATE - 2 && px[i] <= GATE) x[i] = GATE - 2 - r() * 0.1; if (x[i] > TX1 - 2) x[i] = TX1 - 2 - r() * 0.1; if (y[i] > TY1 - 2) y[i] = TY1 - 2 - r() * 0.1; if (y[i] < -200) y[i] = -200;
          vx[i] = (x[i] - px[i]) * 0.998; vy[i] = (y[i] - py[i]) * 0.998;
        }
      };
      const FW = 320, FH = 180, fd = new Float32Array(FW * FH), fs = new Float32Array(FW * FH);
      const oc = document.createElement('canvas'); oc.width = FW; oc.height = FH; const og = oc.getContext('2d'); const img = og.createImageData(FW, FH), pix = img.data;
      const KR = 5, ker = new Float32Array((2 * KR + 1) ** 2); for (let a = -KR; a <= KR; a++) for (let b = -KR; b <= KR; b++) { const q = Math.hypot(a, b) / (KR + 0.5); ker[(a + KR) * (2 * KR + 1) + b + KR] = q < 1 ? (1 - q * q) ** 2 : 0; }
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0c0f1c'); bg.addColorStop(1, '#070810');
      let acc = 0, gateOn = true;
      return (t, dt) => {
        const c = Math.floor(t / LOOP); if (c !== cyc) { cyc = c; reset(); acc = 0; }
        const lt = t - c * LOOP;
        if (!dropped && lt > 8) { dropped = true; for (let k = 0; k < 300 && n < N; k++, n++) { const a = k * 2.39996, rr = Math.sqrt(k + 0.5) * 3.9; x[n] = 450 + Math.cos(a) * rr; y[n] = 40 + Math.sin(a) * rr; vx[n] = -0.4; vy[n] = 0.5; } }
        acc = Math.min(4, acc + dt * 130); gateOn = lt < 0.9; while (acc >= 1) { step(); acc--; }
        fd.fill(0); fs.fill(0);
        for (let i = 0; i < n; i++) {
          const cx = Math.round(x[i] / 2), cy = Math.round(y[i] / 2), sp = Math.min(1, Math.max(0, Math.abs(vx[i]) + Math.abs(vy[i]) - 1.4) * 0.5);
          for (let a = -KR; a <= KR; a++) { const yy = cy + a; if (yy < 0 || yy >= FH) continue; for (let b = -KR; b <= KR; b++) { const xx = cx + b; if (xx < 0 || xx >= FW) continue; const w = ker[(a + KR) * (2 * KR + 1) + b + KR]; fd[yy * FW + xx] += w; fs[yy * FW + xx] += w * sp; } }
        }
        for (let i = 0, o = 0; i < FW * FH; i++, o += 4) {
          const v = fd[i]; if (v < 0.8) { pix[o + 3] = 0; continue; }
          const a = Math.min(1, (v - 0.8) / 0.6), foam = Math.min(1, fs[i] / v * 1.4) * 0.8, rim = 1 - Math.min(1, (v - 0.8) / 0.9), yk = ((i / FW) | 0) / FH, deep = Math.min(1, Math.max(0, (yk - 0.35) / 0.6));
          let R = lerp(70, 18, deep) + rim * 150, G2 = lerp(200, 70, deep) + rim * 50, B = lerp(240, 160, deep) + rim * 15;
          R = lerp(R, 240, foam); G2 = lerp(G2, 250, foam); B = lerp(B, 255, foam);
          pix[o] = R; pix[o + 1] = G2; pix[o + 2] = B; pix[o + 3] = a * 255;
        }
        og.putImageData(img, 0, 0);
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.imageSmoothingEnabled = true; g.drawImage(oc, 0, 0, W, H);
        g.strokeStyle = 'rgba(160,200,255,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(TX0 - 2, TY0); g.lineTo(TX0 - 2, TY1 + 2); g.lineTo(TX1 + 2, TY1 + 2); g.lineTo(TX1 + 2, TY0); g.stroke();
        g.fillStyle = 'rgba(160,200,255,0.06)'; g.fillRect(TX0 - 2, TY0, 10, TY1 - TY0);
        const gy = -ease.inOut(seg(lt, 0.7, 1.3)) * 330; g.fillStyle = 'rgba(200,220,255,0.55)'; g.fillRect(GATE - 1, TY0 + gy - 10, 4, TY1 - TY0 + 10);
        const f = 1 - ease.inOut(seg(lt, LOOP - 0.8, LOOP)); if (f < 1) { g.fillStyle = `rgba(7,8,16,${1 - f})`; g.fillRect(0, 0, W, H); }
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-erosion', title: 'River networks from rain', aka: 'droplet erosion, terrain weathering, river networks, procedural landscape', tool: 'JavaScript heightmap (particle droplet erosion) + Canvas 2D hillshade', runs: 'CPU',
    notice: 'A noise terrain is rained on by thousands of droplets per second. Each droplet runs downhill, speeds up, picks up soil where it can carry more and drops it where it slows. Over seconds, smooth noise hills turn into sharp ridges, valleys and fans of sediment, and the glowing paths show the river network that the water carved for itself.',
    use: 'map and landscape generation, games and world-building, geography explainers',
    prompt: "Hydraulic erosion on a 256 x 144 heightmap: start from 5-octave noise terrain, then simulate {rate} rain droplets per frame (inertia {inertia}, capacity from slope x speed x water, erode with a radius-2 brush, deposit bilinearly, evaporation). Hillshade from the north-west with height tints from deep navy valleys to cream peaks, and draw the water flow as glowing cyan rivers that build up as the network forms. 20 s per landscape, then a new one.",
    params: [{ key: 'rate', label: 'Droplets per frame', min: 20, max: 600, step: 20, value: 160 }, { key: 'inertia', label: 'Droplet inertia', min: 0, max: 0.6, step: 0.02, value: 0.08 }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const MW = 256, MH = 144, LOOP = 20; let r = rng(41);
      const hm = new Float32Array(MW * MH), flow = new Float32Array(MW * MH);
      const oc = document.createElement('canvas'); oc.width = MW; oc.height = MH; const og = oc.getContext('2d'); const img = og.createImageData(MW, MH), px = img.data;
      let cyc = -1, hmin = 0, hmax = 1;
      const terrain = c => {
        const ox = c * 13.7, oy = c * 7.1; r = rng(41 + c);
        for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
          let h = 0, a = 1, f = 1 / 70, sum = 0; for (let o = 0; o < 5; o++) { h += a * EX.noise(x * f + ox, y * f + oy, c); sum += a; a *= 0.5; f *= 2; }
          h /= sum; const ridge = 1 - Math.abs(EX.noise(x / 90 + oy, y / 90 + ox, 3) - 0.5) * 2; hm[y * MW + x] = Math.pow(h, 1.5) * 1.3 + ridge * 0.2 + Math.pow(1 - y / MH, 1.4) * 0.9;
        }
        flow.fill(0); hmin = 1e9; hmax = -1e9; for (let i = 0; i < hm.length; i++) { hmin = Math.min(hmin, hm[i]); hmax = Math.max(hmax, hm[i]); }
      };
      const hgt = (x, y, out) => { const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * MW + xi, a = hm[i], b = hm[i + 1], c = hm[i + MW], d = hm[i + MW + 1];
        out[0] = (b - a) * (1 - fy) + (d - c) * fy; out[1] = (c - a) * (1 - fx) + (d - b) * fx; return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy; };
      const gr = [0, 0], BO = [], BWt = []; let bs = 0;
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const d = Math.hypot(a, b); if (d <= 2.2) { BO.push(a * MW + b); BWt.push(2.3 - d); bs += 2.3 - d; } }
      const BW = BWt.map(w => w / bs);
      const add = (x, y, v) => { const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * MW + xi; hm[i] += v * (1 - fx) * (1 - fy); hm[i + 1] += v * fx * (1 - fy); hm[i + MW] += v * (1 - fx) * fy; hm[i + MW + 1] += v * fx * fy; };
      // One droplet from a random spot, walking up to 40 cells downhill; erosion uses a radius-2 brush.
      const drop = () => {
        let x = 3 + r() * (MW - 8), y = 3 + r() * (MH - 8), dx = 0, dy = 0, sp = 1, wat = 1, sed = 0; const inert = L.p.inertia;
        for (let k = 0; k < 40; k++) {
          const h0 = hgt(x, y, gr); dx = dx * inert - gr[0] * (1 - inert); dy = dy * inert - gr[1] * (1 - inert);
          const len = Math.hypot(dx, dy); if (len < 1e-6) break; dx /= len; dy /= len;
          const nx = x + dx, ny = y + dy; if (nx < 3 || ny < 3 || nx >= MW - 4 || ny >= MH - 4) break;
          const dh = hgt(nx, ny, gr) - h0, cap = Math.max(-dh, 0.004) * sp * wat * 6;
          if (sed > cap || dh > 0) { const dep = dh > 0 ? Math.min(dh, sed) : (sed - cap) * 0.3; sed -= dep; add(x, y, dep); }
          else { const er = Math.min((cap - sed) * 0.3, -dh), c0 = (Math.round(y)) * MW + Math.round(x); for (let q = 0; q < BO.length; q++) hm[c0 + BO[q]] -= er * BW[q]; sed += er; }
          flow[(y | 0) * MW + (x | 0)] += wat * 0.006;
          sp = Math.sqrt(Math.max(0, sp * sp - dh * 4)); wat *= 0.98; x = nx; y = ny;
        }
      };
      const tint = [[10, 12, 34], [32, 34, 84], [88, 66, 124], [176, 120, 118], [232, 196, 160], [250, 246, 236]];
      let made = 0;
      return (t, dt) => {
        const c = Math.floor(t / LOOP); if (c !== cyc) { cyc = c; terrain(c); made = 0; }
        const lt = t - c * LOOP;
        if (lt < LOOP - 3) { const nd = Math.min(L.p.rate * 2, Math.round(L.p.rate * dt * 60)); for (let k = 0; k < nd; k++) drop(); made += nd; }
        const fdk = Math.pow(0.985, dt * 60); for (let i = 0; i < flow.length; i++) flow[i] *= fdk;
        for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
          const i = y * MW + x, o = i * 4, hl = hm[x > 0 ? i - 1 : i], hr = hm[x < MW - 1 ? i + 1 : i], hu = hm[y > 0 ? i - MW : i], hd = hm[y < MH - 1 ? i + MW : i];
          const nx = (hl - hr) * 14, ny = (hu - hd) * 14, sh = Math.max(0, Math.min(1.3, 0.55 + (nx * -0.6 + ny * -0.7) / Math.sqrt(nx * nx + ny * ny + 1) * 0.9));
          const hk = Math.max(0, Math.min(0.999, (hm[i] - hmin) / (hmax - hmin))) * (tint.length - 1), ti = hk | 0, tf = hk - ti, A = tint[ti], B = tint[ti + 1];
          const fl = Math.min(0.9, flow[i] * 1.2);
          px[o] = lerp((A[0] + (B[0] - A[0]) * tf) * sh, 90, fl); px[o + 1] = lerp((A[1] + (B[1] - A[1]) * tf) * sh, 220, fl); px[o + 2] = lerp((A[2] + (B[2] - A[2]) * tf) * sh, 255, fl); px[o + 3] = 255;
        }
        og.putImageData(img, 0, 0);
        g.imageSmoothingEnabled = true; g.drawImage(oc, 0, 0, MW, MH - 0.5, 0, 0, W, H);
        const f = Math.min(ease.out(seg(lt, 0, 0.8)), 1 - ease.inOut(seg(lt, LOOP - 0.9, LOOP))); if (f < 1) { g.fillStyle = `rgba(11,11,16,${1 - f})`; g.fillRect(0, 0, W, H); }
        g.globalAlpha = 0.6; g.fillStyle = C.cream; g.font = '500 11px Cascadia Mono, Consolas'; g.fillText(`${Math.round(made / 1000)}k droplets`, 16, 344); g.globalAlpha = 1;
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-venation', title: 'Leaf venation', aka: 'space colonization algorithm, vein growth, branching networks, Runions venation', tool: 'Canvas 2D (space colonization + pipe-model widths)', runs: 'CPU',
    notice: 'Two thousand invisible hormone sources are scattered inside the leaf. Each pulls on the closest vein tip within reach; every tip grows one step toward the average pull, and a source disappears once a vein reaches it. Veins branch where sources pull apart, and each vein is drawn as thick as the number of tips it feeds, like real plant plumbing.',
    use: 'nature and sustainability brands, organic network metaphors, botanical title cards',
    prompt: "Backlit leaf whose veins grow by the space colonization algorithm: 2,000 attraction points inside a leaf outline, each pulls its nearest vein node within {reach}, nodes step 4 px toward the mean pull, points die within 9 px of a vein. Vein width from the number of tips it carries (pipe model), glowing cream-amber veins on a deep green translucent leaf, soft vignette. Grow from the stem over 9 s, hold, fade, regrow with a new leaf.",
    params: [{ key: 'reach', label: 'Pull reach', min: 20, max: 120, step: 5, value: 55, unit: ' px', restart: true }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const NA = 2000, MAXN = 9000, STEP = 4, KILL = 9, LOOP = 15, CS = 24, GW = Math.ceil(W / CS), GH = Math.ceil(H / CS);
      const ax = new Float32Array(NA), ay = new Float32Array(NA), alive = new Uint8Array(NA), nx = new Float32Array(MAXN), ny = new Float32Array(MAXN), par = new Int32Array(MAXN), desc = new Int32Array(MAXN);
      const sx = new Float32Array(MAXN), sy = new Float32Array(MAXN), cnt = new Int32Array(MAXN), head = new Int32Array(GW * GH), nxt = new Int32Array(MAXN);
      let n = 0, cyc = -1, acc = 0, outline = [], r = rng(1), shape = { len: 540, wid: 0.36, tilt: 0 };
      // Leaf half-width along the midrib, u in [0,1] from stem to tip.
      const half = u => shape.len * shape.wid * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 1.1);
      const BX = 60, BY = H / 2;
      const toXY = (u, v) => { const x = BX + u * shape.len, y = BY + v + Math.sin(u * 3.1) * 14 * shape.tilt; return [x, y]; };
      const addNode = (x, y, p) => { nx[n] = x; ny[n] = y; par[n] = p; desc[n] = 0; for (let a = p; a >= 0; a = par[a]) desc[a]++; return n++; };
      const reset = c => {
        r = rng(7 + c * 13); shape = { len: 500 + r() * 40, wid: 0.27 + r() * 0.07, tilt: r() * 2 - 1 }; n = 0; acc = 0;
        let k = 0; while (k < NA) { const u = r(), v = (r() * 2 - 1); if (Math.abs(v) * shape.len * shape.wid < half(u) - 3 && u > 0.02) { const [x, y] = toXY(u, v * shape.len * shape.wid); ax[k] = x; ay[k] = y; alive[k] = 1; k++; } }
        outline = []; for (let i = 0; i <= 80; i++) { const u = i / 80; outline.push(toXY(u, -half(u))); } for (let i = 80; i >= 0; i--) { const u = i / 80; outline.push(toXY(u, half(u))); }
        addNode(BX - 50, BY, -1); for (let i = 1; i <= 12; i++) addNode(BX - 50 + i * 4.2, BY + Math.sin(i * 0.2) * 1.5, n - 1);
      };
      const grow = () => {
        const D = L.p.reach, D2 = D * D, rc = Math.ceil(D / CS); head.fill(-1);
        for (let i = 0; i < n; i++) { const c = Math.min(GH - 1, Math.max(0, (ny[i] / CS) | 0)) * GW + Math.min(GW - 1, Math.max(0, (nx[i] / CS) | 0)); nxt[i] = head[c]; head[c] = i; sx[i] = 0; sy[i] = 0; cnt[i] = 0; }
        let any = false;
        for (let a = 0; a < NA; a++) {
          if (!alive[a]) continue; const gx = (ax[a] / CS) | 0, gy = (ay[a] / CS) | 0; let best = -1, bd = D2;
          for (let oy = -rc; oy <= rc; oy++) { const yy = gy + oy; if (yy < 0 || yy >= GH) continue; for (let ox = -rc; ox <= rc; ox++) { const xx = gx + ox; if (xx < 0 || xx >= GW) continue;
            for (let j = head[yy * GW + xx]; j >= 0; j = nxt[j]) { const dx = ax[a] - nx[j], dy = ay[a] - ny[j], d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = j; } } } }
          if (best < 0) continue; if (bd < KILL * KILL) { alive[a] = 0; continue; }
          const d = Math.sqrt(bd); sx[best] += (ax[a] - nx[best]) / d; sy[best] += (ay[a] - ny[best]) / d; cnt[best]++; any = true;
        }
        const n0 = n;
        for (let i = 0; i < n0 && n < MAXN; i++) { if (!cnt[i]) continue; const l = Math.hypot(sx[i], sy[i]) || 1; addNode(nx[i] + sx[i] / l * STEP + (r() - 0.5) * 0.6, ny[i] + sy[i] / l * STEP + (r() - 0.5) * 0.6, i); }
        return any;
      };
      const vig = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 420); vig.addColorStop(0, '#0f1a14'); vig.addColorStop(1, '#050806');
      const WB = [0.6, 0.9, 1.3, 1.8, 2.5, 3.4, 4.6];
      return (t, dt) => {
        const c = Math.floor(t / LOOP); if (c !== cyc) { cyc = c; reset(c); }
        const lt = t - c * LOOP;
        if (lt > 0.6 && lt < LOOP - 3) { acc = Math.min(3, acc + dt * 24); while (acc >= 1) { grow(); acc--; } }
        const f = Math.min(ease.out(seg(lt, 0, 0.6)), 1 - ease.inOut(seg(lt, LOOP - 1, LOOP)));
        g.globalAlpha = 1; g.fillStyle = vig; g.fillRect(0, 0, W, H);
        g.globalAlpha = f;
        const lf = g.createLinearGradient(BX, 0, BX + shape.len, 0); lf.addColorStop(0, 'rgba(40,92,52,0.55)'); lf.addColorStop(0.6, 'rgba(70,128,60,0.5)'); lf.addColorStop(1, 'rgba(120,150,60,0.45)');
        g.fillStyle = lf; g.beginPath(); outline.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(200,230,150,0.35)'; g.lineWidth = 1.2; g.stroke();
        g.lineCap = 'round';
        for (let b = 0; b < WB.length; b++) {
          g.beginPath(); for (let i = 1; i < n; i++) { const w = Math.min(WB.length - 1, Math.floor(Math.log2(desc[i] + 1) * 0.75)); if (w !== b) continue; const p = par[i]; if (p < 0) continue; g.moveTo(nx[p], ny[p]); g.lineTo(nx[i], ny[i]); }
          g.strokeStyle = b > 3 ? '#fff1d0' : b > 1 ? '#ffd890' : 'rgba(255,214,140,0.8)'; g.lineWidth = WB[b]; g.stroke();
        }
        g.globalCompositeOperation = 'lighter'; g.filter = 'blur(5px)'; g.globalAlpha = 0.35 * f; g.drawImage(cv, 0, 0); g.filter = 'none'; g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-traffic', title: 'Phantom traffic jam', aka: 'ring road experiment, optimal velocity model, stop-and-go waves, jamiton', tool: 'Canvas 2D (optimal velocity car-following model on a ring)', runs: 'CPU',
    notice: 'Cars drive around a ring road with no lights, no merges and no accident. Each driver eases toward the speed that feels safe for the gap ahead, but reacts with a lag. One gentle brake grows into a stop-and-go wave that travels backwards against the traffic. The chart in the middle stacks the ring over time: the coral bands are jams drifting backwards.',
    use: 'traffic and logistics explainers, "small delays add up" stories, data-viz motion',
    prompt: "Ring-road phantom traffic jam with the optimal velocity model: {cars} cars on a 260 m loop, each accelerates toward V(gap) = 7 (tanh((gap - 8) / 3) + tanh(8 / 3)) m/s with driver sensitivity {sens} per second; one car brakes briefly at 3 s. Cars are small rounded rectangles on a dark elliptical road coloured by speed (coral stopped, cream medium, cyan fast), brake lights when stopped. Inside the ring, a scrolling space-time chart shows the stop-and-go waves as bands drifting backwards. 30 s loop.",
    params: [{ key: 'cars', label: 'Cars on the ring', min: 10, max: 36, step: 1, value: 22, restart: true }, { key: 'sens', label: 'Driver sensitivity', min: 0.3, max: 3, step: 0.1, value: 0.9, unit: ' /s' }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const LEN = 260, CX = W / 2, CY = H / 2, RX = 268, RY = 140, LOOP = 30, V0 = 14, CL = 4.5;
      const NP = 720, ex = new Float32Array(NP + 1), ey = new Float32Array(NP + 1), el = new Float32Array(NP + 1);
      for (let i = 0; i <= NP; i++) { const a = i / NP * 6.2832 - Math.PI / 2; ex[i] = CX + Math.cos(a) * RX; ey[i] = CY + Math.sin(a) * RY; if (i) el[i] = el[i - 1] + Math.hypot(ex[i] - ex[i - 1], ey[i] - ey[i - 1]); }
      const tot = el[NP], pt = [0, 0, 0];
      // Point and heading on the ellipse at fraction f of its length.
      const at = f => { const d = ((f % 1) + 1) % 1 * tot; let lo = 0, hi = NP; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (el[m] < d) lo = m; else hi = m; } const k = (d - el[lo]) / (el[hi] - el[lo] || 1); pt[0] = lerp(ex[lo], ex[hi], k); pt[1] = lerp(ey[lo], ey[hi], k); pt[2] = Math.atan2(ey[hi] - ey[lo], ex[hi] - ex[lo]); return pt; };
      const N = L.p.cars, pos = new Float64Array(N), vel = new Float64Array(N), acc = new Float64Array(N); const r = rng(5);
      const reset = () => { const g0 = LEN / N - CL, v0 = V0 / 2 * (Math.tanh((g0 - 8) / 3) + Math.tanh(8 / 3)); for (let i = 0; i < N; i++) { pos[i] = i / N * LEN + (r() - 0.5) * 0.3; vel[i] = v0; } };
      const SW = 300, SH = 104, sc = document.createElement('canvas'); sc.width = SW; sc.height = SH; const sg = sc.getContext('2d'); sg.fillStyle = '#0d0e18'; sg.fillRect(0, 0, SW, SH);
      const spdCol = v => { const k = Math.min(1, v / V0); const c = k < 0.5 ? [lerp(255, 244, k * 2), lerp(90, 239, k * 2), lerp(54, 230, k * 2)] : [lerp(244, 43, k * 2 - 1), lerp(239, 196, k * 2 - 1), lerp(230, 230, k * 2 - 1)]; return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; };
      let cyc = -1, rowAcc = 0, braked = false;
      return (t, dt) => {
        const c = Math.floor(t / LOOP); if (c !== cyc) { cyc = c; reset(); braked = false; sg.fillStyle = '#0d0e18'; sg.fillRect(0, 0, SW, SH); }
        const lt = t - c * LOOP, sens = L.p.sens, sub = 4, h = Math.min(dt, 0.05) * 1.6 / sub;
        for (let s2 = 0; s2 < sub; s2++) {
          for (let i = 0; i < N; i++) {
            const j = (i + 1) % N; let gap = pos[j] - pos[i] - CL; if (gap < -CL) gap += LEN;
            const vt = V0 / 2 * (Math.tanh((gap - 8) / 3) + Math.tanh(8 / 3));
            acc[i] = gap < 0.8 ? -vel[i] * 8 : sens * (vt - vel[i]) + (r() - 0.5) * 0.3;
          }
          if (!braked && lt > 3) { braked = true; vel[0] *= 0.35; }
          for (let i = 0; i < N; i++) { vel[i] = Math.max(0, vel[i] + acc[i] * h); pos[i] += vel[i] * h; if (pos[i] >= LEN) pos[i] -= LEN; }
        }
        // space-time chart: newest row on top, one row about every 1/12 s
        rowAcc += dt; if (rowAcc > 1 / 12) { rowAcc = 0; sg.drawImage(sc, 0, 1); sg.fillStyle = '#0d0e18'; sg.fillRect(0, 0, SW, 1); for (let i = 0; i < N; i++) { sg.fillStyle = spdCol(vel[i]); sg.fillRect((pos[i] / LEN) * SW - 1, 0, 3, 1); } }
        g.fillStyle = '#0a0a12'; g.fillRect(0, 0, W, H);
        g.strokeStyle = '#1e1f2e'; g.lineWidth = 26; g.beginPath(); g.ellipse(CX, CY, RX, RY, 0, 0, 6.3); g.stroke();
        g.strokeStyle = 'rgba(244,239,230,0.18)'; g.lineWidth = 1; g.setLineDash([8, 10]); g.beginPath(); g.ellipse(CX, CY, RX, RY, 0, 0, 6.3); g.stroke(); g.setLineDash([]);
        for (let i = 0; i < N; i++) {
          const q = at(pos[i] / LEN); g.save(); g.translate(q[0], q[1]); g.rotate(q[2]); g.fillStyle = spdCol(vel[i]);
          g.beginPath(); g.roundRect(-CL * 1.6, -4.5, CL * 3.2 - 2, 9, 3); g.fill(); if (vel[i] < 2) { g.fillStyle = '#ff2a10'; g.fillRect(-CL * 1.6, -4, 2, 8); } g.restore();
        }
        g.drawImage(sc, CX - SW / 2, CY - SH / 2 + 6); g.strokeStyle = 'rgba(244,239,230,0.15)'; g.strokeRect(CX - SW / 2 - 0.5, CY - SH / 2 + 5.5, SW + 1, SH + 1);
        g.fillStyle = 'rgba(244,239,230,0.55)'; g.font = '500 11px Cascadia Mono, Consolas'; g.fillText('position on the ring', CX - SW / 2, CY - SH / 2 - 2); g.textAlign = 'right'; g.fillText('time runs up', CX + SW / 2, CY - SH / 2 - 2); g.textAlign = 'left';
        let mv = 0; for (let i = 0; i < N; i++) mv += vel[i]; g.fillText(`average ${(mv / N * 3.6).toFixed(0)} km/h`, CX - SW / 2, CY + SH / 2 + 20);
        const f = Math.min(ease.out(seg(lt, 0, 0.5)), 1 - ease.inOut(seg(lt, LOOP - 0.8, LOOP))); if (f < 1) { g.fillStyle = `rgba(10,10,18,${1 - f})`; g.fillRect(0, 0, W, H); }
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-sandpile', title: 'Sandpile avalanches', aka: 'Abelian sandpile, self-organized criticality, Bak-Tang-Wiesenfeld model, sandpile fractal', tool: 'JavaScript grid (toppling stack) + Canvas 2D', runs: 'CPU',
    notice: 'Grains of sand are dropped one by one on the centre cell. A cell holding four or more grains topples and gives one grain to each neighbour, which can make them topple too, so a single grain can set off an avalanche of any size. With 50,000 grains the pile settles into this fractal mandala; the colours show 0, 1, 2 or 3 grains, and white cells are toppling right now.',
    use: 'emergence and "tipping point" stories, mathematical art, hypnotic loops',
    prompt: "Abelian sandpile growing from the centre of a 179 x 179 grid: drop {rate} grains per second on the middle cell, topple every cell with 4 or more grains (one grain to each neighbour) using a stack, up to 50,000 grains. Colour by grain count: 0 amber, 1 coral, 2 violet, 3 deep indigo, toppling cells white, slight bloom. Show the grain counter and a colour legend beside the square. Hold the finished fractal, fade, repeat (18 s).",
    params: [{ key: 'rate', label: 'Grains per second', min: 500, max: 8000, step: 100, value: 3600 }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const GN = 179, CC = 89, MAXG = 50000, CPX = 2, LOOP = 18;
      const grid = new Int32Array(GN * GN), touched = new Uint8Array(GN * GN), stack = new Int32Array(GN * GN * 4); let sp = 0, dropped = 0, acc = 0, cyc = -1;
      const oc = document.createElement('canvas'); oc.width = GN; oc.height = GN; const og = oc.getContext('2d'); const img = og.createImageData(GN, GN), pix = new Uint32Array(img.data.buffer);
      const pk = h => { const c = hexRGB(h); return 0xff000000 | (c[2] << 16) | (c[1] << 8) | c[0]; };
      const COLS = [pk(C.amber), pk(C.coral), pk(C.violet), pk('#211b4a')], HOT = pk('#ffffff');
      const push = i => { touched[i] = 1; if (sp < stack.length) stack[sp++] = i; };
      // Topples unstable cells until the pile is stable or the time budget runs out.
      const relax = budget => {
        const t0 = performance.now(); let k = 0;
        while (sp > 0) {
          const i = stack[--sp], c = grid[i]; if (c < 4) continue;
          const q = c >> 2; grid[i] = c & 3; const x = i % GN, y = (i / GN) | 0;
          if (x > 0) { if ((grid[i - 1] += q) >= 4) push(i - 1); } if (x < GN - 1) { if ((grid[i + 1] += q) >= 4) push(i + 1); }
          if (y > 0) { if ((grid[i - GN] += q) >= 4) push(i - GN); } if (y < GN - 1) { if ((grid[i + GN] += q) >= 4) push(i + GN); }
          if ((++k & 1023) === 0 && performance.now() - t0 > budget) break;
        }
      };
      const bgG = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 400); bgG.addColorStop(0, '#120f22'); bgG.addColorStop(1, '#07060d');
      return (t, dt) => {
        const c = Math.floor(t / LOOP); if (c !== cyc) { cyc = c; grid.fill(0); touched.fill(0); sp = 0; dropped = 0; acc = 0; }
        const lt = t - c * LOOP;
        if (dropped < MAXG) { acc += dt * L.p.rate; const add = Math.min(MAXG - dropped, Math.floor(acc)); if (add > 0) { acc -= add; dropped += add; grid[CC * GN + CC] += add; push(CC * GN + CC); } }
        relax(4);
        for (let i = 0; i < GN * GN; i++) { const v = grid[i]; pix[i] = v >= 4 ? HOT : v === 0 && !touched[i] ? 0 : COLS[v]; }
        og.putImageData(img, 0, 0);
        const f = Math.min(ease.out(seg(lt, 0, 0.4)), 1 - ease.inOut(seg(lt, LOOP - 1, LOOP)));
        g.globalAlpha = 1; g.fillStyle = bgG; g.fillRect(0, 0, W, H);
        const S = GN * CPX, X0 = (W - S) / 2, Y0 = (H - S) / 2;
        g.globalAlpha = f; g.imageSmoothingEnabled = false; g.drawImage(oc, X0, Y0, S, S);
        g.globalCompositeOperation = 'lighter'; g.imageSmoothingEnabled = true; g.filter = 'blur(6px)'; g.globalAlpha = 0.3 * f; g.drawImage(oc, X0, Y0, S, S); g.filter = 'none'; g.globalCompositeOperation = 'source-over';
        g.globalAlpha = f; g.font = '500 11px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillText('grains', 34, 150);
        g.fillStyle = C.cream; g.font = '600 24px Bahnschrift, Segoe UI'; g.fillText(dropped.toLocaleString('en-US'), 34, 178);
        g.font = '500 11px Cascadia Mono, Consolas'; ['0', '1', '2', '3', 'toppling'].forEach((lab, k) => { g.fillStyle = k < 4 ? [C.amber, C.coral, C.violet, '#2c2560'][k] : '#ffffff'; g.fillRect(500, 132 + k * 20, 12, 12); g.fillStyle = 'rgba(244,239,230,0.7)'; g.fillText(lab, 520, 142 + k * 20); });
        g.globalAlpha = 1; g.imageSmoothingEnabled = true;
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-crowd', title: 'Crowd at a narrow exit', aka: 'social force model, pedestrian dynamics, evacuation, faster-is-slower, clogging arches', tool: 'Canvas 2D (Helbing social force model + spatial hash)', runs: 'CPU',
    notice: 'Two hundred people leave a room through one door. Each wants to walk straight to the exit, keeps a little personal space, and pushes back when bodies touch. At the door, arches of jammed bodies form and break, so people leave in bursts; colour shows how hard each one is squeezed. Raise the hurry and the room empties slower, not faster.',
    use: 'safety and architecture explainers, queueing and bottleneck metaphors, crowd scenes',
    prompt: "Top-down evacuation with Helbing's social force model: 200 people (radius 4.5 to 6 px) in a room with one 30 px door; each accelerates toward the door at desired speed {hurry} px/s with 0.5 s relaxation, repels others with an exponential social force, and gets a stiff body force when overlapping, walls likewise. Spatial hash, 4 substeps. People drawn as circles with a heading tick, cyan when relaxed to coral when squeezed, a glowing exit, an evacuated counter and timer. Loop when the room is empty.",
    params: [{ key: 'hurry', label: 'Hurry (desired speed)', min: 30, max: 220, step: 10, value: 110, unit: ' px/s' }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const N = 200, RX0 = 40, RX1 = 450, RY0 = 30, RY1 = 330, DY = H / 2, DW = 15, CS = 16, GW = Math.ceil(W / CS) + 2, GH = Math.ceil(H / CS) + 2;
      const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N), rad = new Float32Array(N), pr = new Float32Array(N), out = new Float32Array(N);
      const head = new Int32Array(GW * GH), nxt = new Int32Array(N); const r = rng(9);
      let t0 = 0, done = -1, gone = 0, last = 0;
      const WALLS = [[RX0, RY0, RX1, RY0], [RX0, RY1, RX1, RY1], [RX0, RY0, RX0, RY1], [RX1, RY0, RX1, DY - DW], [RX1, DY + DW, RX1, RY1]];
      const reset = () => { for (let i = 0; i < N; i++) { rad[i] = 4.5 + r() * 1.5; x[i] = RX0 + 16 + (i % 14) * 25 + (r() - 0.5) * 8; y[i] = RY0 + 14 + Math.floor(i / 14) * 18.5 + (r() - 0.5) * 6; vx[i] = vy[i] = 0; out[i] = 0; } t0 = last; done = -1; gone = 0; };
      const wallF = (i, ax0, ay0, bx, by, f) => {
        const ex = bx - ax0, ey = by - ay0, l2 = ex * ex + ey * ey, u = Math.max(0, Math.min(1, ((x[i] - ax0) * ex + (y[i] - ay0) * ey) / l2));
        const dx = x[i] - (ax0 + ex * u), dy = y[i] - (ay0 + ey * u), d = Math.sqrt(dx * dx + dy * dy) || 1e-3, ov = rad[i] - d;
        const k = 900 * Math.exp(ov / 2.5) + (ov > 0 ? 9000 * ov : 0); f[0] += dx / d * k; f[1] += dy / d * k; if (ov > 0) pr[i] += ov;
      };
      const F = [0, 0];
      const step = h => {
        head.fill(-1); for (let i = 0; i < N; i++) { const c = (Math.min(GH - 1, Math.max(0, ((y[i] / CS) | 0) + 1))) * GW + Math.min(GW - 1, Math.max(0, ((x[i] / CS) | 0) + 1)); nxt[i] = head[c]; head[c] = i; pr[i] = 0; }
        const v0 = L.p.hurry;
        for (let i = 0; i < N; i++) {
          if (out[i] > 1.5) continue;
          let tx, ty; if (x[i] < RX1 - 2) { tx = RX1 + 8 - x[i]; ty = Math.max(-DW + 7, Math.min(DW - 7, y[i] - DY)) + DY - y[i]; } else { tx = 1; ty = (DY - y[i]) * 0.01; }
          const tl = Math.hypot(tx, ty) || 1; F[0] = (v0 * tx / tl - vx[i]) / 0.5; F[1] = (v0 * ty / tl - vy[i]) / 0.5;
          const gx = ((x[i] / CS) | 0) + 1, gy = ((y[i] / CS) | 0) + 1;
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const c = (gy + oy) * GW + gx + ox; if (c < 0 || c >= head.length) continue;
            for (let j = head[c]; j >= 0; j = nxt[j]) { if (j === i || out[j] > 1.5) continue; const dx = x[i] - x[j], dy = y[i] - y[j], d = Math.sqrt(dx * dx + dy * dy) || 1e-3; if (d > 30) continue;
              const ov = rad[i] + rad[j] - d, k = 700 * Math.exp(ov / 3) + (ov > 0 ? 8000 * ov : 0); F[0] += dx / d * k; F[1] += dy / d * k; if (ov > 0) pr[i] += ov; } }
          if (x[i] < RX1 + 10) for (const w of WALLS) wallF(i, w[0], w[1], w[2], w[3], F);
          vx[i] += F[0] * h; vy[i] += F[1] * h; const sp = Math.hypot(vx[i], vy[i]), mx = v0 * 1.6; if (sp > mx) { vx[i] *= mx / sp; vy[i] *= mx / sp; }
        }
        for (let i = 0; i < N; i++) { x[i] += vx[i] * h; y[i] += vy[i] * h; if (x[i] > RX1 + 4 && !out[i]) { out[i] = 0.001; gone++; } if (out[i]) out[i] += h; }
      };
      return (t, dt) => {
        last = t; if (t0 === 0 && done === -1 && gone === 0 && x[0] === 0) reset();
        const lt = t - t0; if (gone >= N && done < 0) done = lt; if (done >= 0 && lt - done > 2) reset();
        if (lt > 0.8) for (let k = 0; k < 4; k++) step(Math.min(dt, 0.04) / 4);
        g.fillStyle = '#0b0b12'; g.fillRect(0, 0, W, H); g.fillStyle = '#14141f'; g.fillRect(RX0, RY0, RX1 - RX0, RY1 - RY0);
        const eg = g.createRadialGradient(RX1, DY, 2, RX1, DY, 70); eg.addColorStop(0, 'rgba(95,211,141,0.45)'); eg.addColorStop(1, 'rgba(95,211,141,0)'); g.fillStyle = eg; g.fillRect(RX1 - 70, DY - 70, 140, 140);
        g.strokeStyle = '#3a3a52'; g.lineWidth = 4; g.lineCap = 'square'; g.beginPath(); for (const w of WALLS) { g.moveTo(w[0], w[1]); g.lineTo(w[2], w[3]); } g.stroke();
        g.fillStyle = C.green; g.font = '600 12px Bahnschrift, Segoe UI'; g.fillText('EXIT', RX1 + 12, DY - DW - 8);
        for (let i = 0; i < N; i++) {
          const a = out[i] ? Math.max(0, 1 - out[i] / 1.5) : 1; if (a <= 0) continue;
          const k = Math.min(1, pr[i] / 1.5); g.globalAlpha = a;
          g.fillStyle = k < 0.5 ? mixHex(C.cyan, C.cream, k * 2) : mixHex(C.cream, C.coral, k * 2 - 1); g.beginPath(); g.arc(x[i], y[i], rad[i], 0, 6.3); g.fill();
          const sp = Math.hypot(vx[i], vy[i]) || 1; g.strokeStyle = 'rgba(11,11,18,0.8)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x[i], y[i]); g.lineTo(x[i] + vx[i] / sp * rad[i], y[i] + vy[i] / sp * rad[i]); g.stroke();
        }
        g.globalAlpha = 1; g.fillStyle = 'rgba(244,239,230,0.6)'; g.font = '500 11px Cascadia Mono, Consolas';
        g.fillText(`out ${gone} / ${N}`, 480, 300); g.fillText(`time ${Math.max(0, (done >= 0 ? done : lt) - 0.8).toFixed(1)} s`, 480, 316);
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-ecosystem', title: 'Foxes, rabbits and grass', aka: 'predator-prey, agent-based ecosystem, Lotka-Volterra cycles, population waves', tool: 'Canvas 2D (agent-based model on a regrowing grass grid)', runs: 'CPU',
    notice: 'Rabbits wander, eat grass and multiply; grass grows back slowly. Foxes chase the nearest rabbit they can see, multiply when fed and starve when not. Neither side wins: rabbit booms feed fox booms, which crash the rabbits, which starve the foxes. On the map this plays out as travelling waves; the chart shows the classic lagging cycles.',
    use: 'ecology and systems-thinking explainers, "boom and bust" metaphors, living data art',
    prompt: "Agent-based predator-prey ecosystem on a regrowing grass grid (128 x 72 cells, regrow {grow} per step): rabbits random-walk, eat grass, split when well fed, starve when not; foxes steer to the nearest rabbit within 34 px (spatial hash), eat, split and starve. Dark map with grass in deep green shades, rabbits as cream dots, foxes as glowing coral dots, a population chart along the bottom showing the lagging boom-and-bust cycles. Runs continuously.",
    params: [{ key: 'grow', label: 'Grass regrowth', min: 0.001, max: 0.01, step: 0.0005, value: 0.004, dec: 4 }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const GW = 128, GH = 72, CPX = 5, MR = 3000, MF = 400, MAPH = 300; const r = rng(17);
      const grass = new Float32Array(GW * GH).fill(1);
      const rx = new Float32Array(MR), ry = new Float32Array(MR), ra = new Float32Array(MR), re = new Float32Array(MR);
      const fx = new Float32Array(MF), fy = new Float32Array(MF), fa = new Float32Array(MF), fe = new Float32Array(MF);
      let nr = 0, nf = 0;
      const addR = (x, y, e) => { if (nr >= MR) return; rx[nr] = x; ry[nr] = y; ra[nr] = r() * 6.283; re[nr] = e; nr++; };
      const addF = (x, y, e) => { if (nf >= MF) return; fx[nf] = x; fy[nf] = y; fa[nf] = r() * 6.283; fe[nf] = e; nf++; };
      for (let i = 0; i < 500; i++) addR(r() * W, r() * MAPH, 0.6 + r() * 0.6);
      for (let i = 0; i < 24; i++) addF(r() * W, r() * MAPH, 1 + r());
      const CS = 17, HW = Math.ceil(W / CS), HH = Math.ceil(MAPH / CS), head = new Int32Array(HW * HH), nxt = new Int32Array(MR);
      const hr = new Float32Array(240), hf = new Float32Array(240); let hn = 0, hacc = 0, acc = 0;
      const oc = document.createElement('canvas'); oc.width = GW; oc.height = GH; const og = oc.getContext('2d'); const img = og.createImageData(GW, GH), px = img.data;
      const wrapX = v => (v + W) % W, wrapY = v => (v + MAPH) % MAPH;
      const step = () => {
        const gr = L.p.grow; for (let i = 0; i < grass.length; i++) if (grass[i] < 1) grass[i] = Math.min(1, grass[i] + gr);
        for (let i = 0; i < nr; i++) {
          ra[i] += (r() - 0.5) * 0.9; rx[i] = wrapX(rx[i] + Math.cos(ra[i]) * 1.1); ry[i] = wrapY(ry[i] + Math.sin(ra[i]) * 1.1); re[i] -= 0.011;
          const c = ((ry[i] / CPX) | 0) * GW + ((rx[i] / CPX) | 0), gv = grass[c]; if (gv > 0.25) { re[i] += gv * 0.22; grass[c] = gv * 0.25; }
          if (re[i] > 1.8 && nr < MR) { re[i] *= 0.5; addR(rx[i], ry[i], re[i]); }
          if (re[i] <= 0) { nr--; rx[i] = rx[nr]; ry[i] = ry[nr]; ra[i] = ra[nr]; re[i] = re[nr]; i--; }
        }
        head.fill(-1); for (let i = 0; i < nr; i++) { const c = Math.min(HH - 1, (ry[i] / CS) | 0) * HW + Math.min(HW - 1, (rx[i] / CS) | 0); nxt[i] = head[c]; head[c] = i; }
        for (let i = 0; i < nf; i++) {
          const gx = (fx[i] / CS) | 0, gy = (fy[i] / CS) | 0; let best = -1, bd = 34 * 34;
          for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) { const cx = (gx + ox + HW) % HW, cy = (gy + oy + HH) % HH;
            for (let j = head[cy * HW + cx]; j >= 0; j = nxt[j]) { let dx = rx[j] - fx[i], dy = ry[j] - fy[i]; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; if (dy > MAPH / 2) dy -= MAPH; if (dy < -MAPH / 2) dy += MAPH; const d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = j; } } }
          if (best >= 0) { let dx = rx[best] - fx[i], dy = ry[best] - fy[i]; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; if (dy > MAPH / 2) dy -= MAPH; if (dy < -MAPH / 2) dy += MAPH; const ta = Math.atan2(dy, dx); let da = ta - fa[i]; da = Math.atan2(Math.sin(da), Math.cos(da)); fa[i] += da * 0.35;
            if (bd < 16 && re[best] > -50) { fe[i] += 0.45; re[best] = -100; } }
          else fa[i] += (r() - 0.5) * 0.6;
          fx[i] = wrapX(fx[i] + Math.cos(fa[i]) * 1.65); fy[i] = wrapY(fy[i] + Math.sin(fa[i]) * 1.65); fe[i] -= 0.0095;
          if (fe[i] > 2.6 && nf < MF) { fe[i] *= 0.5; addF(fx[i], fy[i], fe[i]); }
          if (fe[i] <= 0) { nf--; fx[i] = fx[nf]; fy[i] = fy[nf]; fa[i] = fa[nf]; fe[i] = fe[nf]; i--; }
        }
        for (let i = 0; i < nr; i++) if (re[i] < -50) { nr--; rx[i] = rx[nr]; ry[i] = ry[nr]; ra[i] = ra[nr]; re[i] = re[nr]; i--; }
        if (nf < 2) addF(r() * W, r() * MAPH, 1.5);
        if (nr < 10) for (let k = 0; k < 20; k++) addR(r() * W, r() * MAPH, 1);
      };
      return (t, dt) => {
        acc = Math.min(4, acc + dt * 60); while (acc >= 1) { step(); acc--; }
        hacc += dt; if (hacc > 0.125) { hacc = 0; hr[hn % 240] = nr; hf[hn % 240] = nf; hn++; }
        for (let i = 0; i < GW * GH; i++) { const v = grass[i], o = i * 4; px[o] = 12 + v * 22; px[o + 1] = 16 + v * 70; px[o + 2] = 20 + v * 34; px[o + 3] = 255; }
        og.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(oc, 0, 0, GW, 60, 0, 0, W, MAPH);
        g.fillStyle = C.cream; for (let i = 0; i < nr; i++) g.fillRect(rx[i] - 1, ry[i] - 1, 2.2, 2.2);
        g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,90,54,0.35)'; for (let i = 0; i < nf; i++) { g.beginPath(); g.arc(fx[i], fy[i], 6, 0, 6.3); g.fill(); }
        g.globalCompositeOperation = 'source-over'; g.fillStyle = C.coral; for (let i = 0; i < nf; i++) { g.beginPath(); g.arc(fx[i], fy[i], 2.6, 0, 6.3); g.fill(); }
        g.fillStyle = '#0b0b10'; g.fillRect(0, MAPH, W, H - MAPH); g.fillStyle = 'rgba(244,239,230,0.1)'; g.fillRect(0, MAPH, W, 1);
        const m = Math.min(hn, 240), x0 = 150, cw = 470, ch = 46, yb = H - 6;
        let mr = 1, mf = 1; for (let k = 0; k < m; k++) { mr = Math.max(mr, hr[(hn - m + k) % 240]); mf = Math.max(mf, hf[(hn - m + k) % 240]); }
        const plot = (arr, sc, col) => { g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); for (let k = 0; k < m; k++) { const v = arr[(hn - m + k) % 240], X = x0 + k / 239 * cw, Y = yb - Math.min(1, v / sc) * ch; k ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.stroke(); };
        plot(hr, mr * 1.05, C.cream); plot(hf, mf * 1.05, C.coral);
        g.font = '500 11px Cascadia Mono, Consolas'; g.fillStyle = C.cream; g.fillText(`rabbits ${nr}`, 14, MAPH + 24); g.fillStyle = C.coral; g.fillText(`foxes ${nf}`, 14, MAPH + 42);
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-bifurcation', title: 'Road to chaos (logistic map)', aka: 'bifurcation diagram, period doubling, logistic map, Feigenbaum cascade, cobweb plot', tool: 'Canvas 2D (iterated map + density buffer)', runs: 'CPU',
    notice: 'One line of maths, x becomes r times x times (1 - x), is run thousands of times for each value of r. A scan line sweeps r to the right and plots where x ends up: one value, then two, four, eight, then chaos, with calm windows inside it. The cobweb on the right shows the same iteration bouncing between the curve and the diagonal for the current r.',
    use: 'chaos and complexity explainers, math channels, "simple rules, complex results" stories',
    prompt: "Animated bifurcation diagram of the logistic map x -> r x (1 - x): a glowing scan line sweeps r from 2.8 to 4 over 12 s; for every pixel column, iterate 300 times to settle, then plot the next {pts} values into a density buffer drawn cream to amber with a soft glow. Mark the period-doubling points 3, 3.449, 3.544 and the onset of chaos 3.5699 with thin ticks. On the right, a cobweb plot for the current r: parabola, diagonal and the last 40 steps of the iteration. Hold, fade, repeat.",
    params: [{ key: 'pts', label: 'Points per column', min: 100, max: 3000, step: 100, value: 1200 }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const DX = 24, DY = 22, DW = 420, DH = 300, R0 = 2.8, R1 = 4, SWEEP = 12, LOOP = 16;
      const acc = new Float32Array(DW * DH), oc = document.createElement('canvas'); oc.width = DW; oc.height = DH; const og = oc.getContext('2d'); const img = og.createImageData(DW, DH), px = img.data;
      let col = 0, cyc = -1;
      const column = c => { for (let s2 = 0; s2 < 3; s2++) { const r = R0 + (c + s2 / 3) / DW * (R1 - R0); let x = 0.31; for (let k = 0; k < 300; k++) x = r * x * (1 - x); const n = L.p.pts; for (let k = 0; k < n; k++) { x = r * x * (1 - x); acc[((1 - x) * (DH - 1) | 0) * DW + c] += 9 / n; } } };
      const CX0 = 470, CY0 = 70, CS = 150;
      return (t) => {
        const cc = Math.floor(t / LOOP); if (cc !== cyc) { cyc = cc; acc.fill(0); col = 0; }
        const lt = t - cc * LOOP, target = Math.min(DW, Math.floor(seg(lt, 0.3, SWEEP + 0.3) * DW));
        while (col < target) column(col++);
        for (let i = 0, o = 0; i < acc.length; i++, o += 4) { const v = acc[i] * 6, k = v / (1 + v); px[o] = 255 * Math.min(1, k * 1.15); px[o + 1] = 235 * Math.pow(k, 1.25); px[o + 2] = 200 * Math.pow(k, 2.2); px[o + 3] = 255 * Math.min(1, k * 2.5); }
        og.putImageData(img, 0, 0);
        const f = 1 - ease.inOut(seg(lt, LOOP - 1, LOOP));
        g.globalAlpha = 1; g.fillStyle = '#0b0b12'; g.fillRect(0, 0, W, H);
        g.globalAlpha = f; g.globalCompositeOperation = 'lighter'; g.filter = 'blur(3px)'; g.drawImage(oc, DX, DY); g.filter = 'none'; g.drawImage(oc, DX, DY); g.globalCompositeOperation = 'source-over';
        g.strokeStyle = 'rgba(244,239,230,0.25)'; g.lineWidth = 1; g.strokeRect(DX - 0.5, DY - 0.5, DW + 1, DH + 1);
        g.font = '500 10px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)';
        for (const [rv, lab] of /** @type {[number, string][]} */ ([[3, '3'], [3.449, '3.45'], [3.5699, 'chaos 3.57'], [3.8284, 'period 3']])) { const X = DX + (rv - R0) / (R1 - R0) * DW; g.fillRect(X, DY + DH, 1, 5); g.fillText(lab, X - 6, DY + DH + 16); }
        const r = R0 + col / DW * (R1 - R0);
        if (col < DW) { const X = DX + col, X0 = Math.max(DX, X - 30); const lg = g.createLinearGradient(X - 30, 0, X, 0); lg.addColorStop(0, 'rgba(43,196,230,0)'); lg.addColorStop(1, 'rgba(43,196,230,0.35)'); g.fillStyle = lg; g.fillRect(X0, DY, X - X0, DH); g.fillStyle = C.cyan; g.fillRect(X, DY, 1.5, DH); }
        // cobweb for the current r
        const sx = v => CX0 + v * CS, sy = v => CY0 + CS - v * CS;
        g.strokeStyle = 'rgba(244,239,230,0.2)'; g.strokeRect(CX0 - 0.5, CY0 - 0.5, CS + 1, CS + 1); g.beginPath(); g.moveTo(sx(0), sy(0)); g.lineTo(sx(1), sy(1)); g.stroke();
        g.strokeStyle = C.amber; g.lineWidth = 1.5; g.beginPath(); for (let k = 0; k <= 40; k++) { const v = k / 40; k ? g.lineTo(sx(v), sy(r * v * (1 - v))) : g.moveTo(sx(v), sy(0)); } g.stroke();
        let x = 0.2; for (let k = 0; k < 200; k++) x = r * x * (1 - x);
        g.strokeStyle = C.cyan; g.lineWidth = 1; g.globalAlpha = f * 0.85; g.beginPath(); g.moveTo(sx(x), sy(x)); for (let k = 0; k < 40; k++) { const y = r * x * (1 - x); g.lineTo(sx(x), sy(y)); g.lineTo(sx(y), sy(y)); x = y; } g.stroke(); g.globalAlpha = f;
        g.fillStyle = C.cream; g.font = '600 22px Bahnschrift, Segoe UI'; g.fillText(`r = ${r.toFixed(3)}`, CX0, CY0 + CS + 40);
        g.font = '500 11px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText('x -> r x (1 - x)', CX0, CY0 - 14); g.fillText('cobweb', CX0 + CS - 42, CY0 + CS + 14);
        g.globalAlpha = 1;
      };
    },
  });
  EX.add({
    cat: 'sim', id: 's2-spirals', title: 'Spiral waves from noise', aka: 'cyclic cellular automaton, excitable medium, Belousov-Zhabotinsky look, Griffeath spirals', tool: 'JavaScript grid (cyclic cellular automaton) + Canvas 2D', runs: 'CPU',
    notice: 'Each cell holds one of {n} colours arranged in a cycle. A cell moves on to the next colour as soon as a neighbour already shows it. From pure noise, small patches start to chase each other, the patches that loop on themselves win, and the whole field ends up ruled by rotating spirals, like the Belousov-Zhabotinsky chemical reaction.',
    use: 'chemistry and biology visuals (heart tissue, slime moulds), hypnotic backgrounds, emergence explainers',
    prompt: "Cyclic cellular automaton on a 320 x 180 grid: {n} states in a cycle, a cell advances to the next state when any of its 4 neighbours already has it, 80 steps per second, random start. Draw each wave front bright amber-white fading through coral and violet into dark navy, upscaled with smoothing and a soft bloom, so the noise organises into rotating spiral waves within seconds. A Disturb button scrambles a disc to seed new spirals. Reseed every 25 s.",
    params: [{ key: 'n', label: 'States in the cycle', min: 5, max: 24, step: 1, value: 15, restart: true }],
    controls: [{ label: 'Disturb', group: false, fn: L => L.disturb && L.disturb() }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const SW = 320, SH = 180, LOOP = 25, NS = L.p.n; let r = rng(3);
      let a = new Uint8Array(SW * SH), b = new Uint8Array(SW * SH); let cyc = -1, acc = 0;
      const oc = document.createElement('canvas'); oc.width = SW; oc.height = SH; const og = oc.getContext('2d'); const img = og.createImageData(SW, SH), pix = new Uint32Array(img.data.buffer);
      const HL = 8, LUT = new Uint32Array(NS * HL), mixc = (p, q, u) => [lerp(p[0], q[0], u), lerp(p[1], q[1], u), lerp(p[2], q[2], u)];
      for (let k = 0; k < NS; k++) for (let z = 0; z < HL; z++) {
        const f = Math.pow(1 - k / NS, 2.6), c1 = [255, 240, 210], c2 = mixc(hexRGB(C.amber), hexRGB(C.coral), z / (HL - 1)), c3 = mixc(hexRGB(C.violet), [70, 50, 170], z / (HL - 1)), c4 = [10, 10, 22];
        const col = f > 0.7 ? mixc(c2, c1, (f - 0.7) / 0.3) : f > 0.32 ? mixc(c3, c2, (f - 0.32) / 0.38) : mixc(c4, c3, f / 0.32);
        LUT[k * HL + z] = 0xff000000 | ((col[2] | 0) << 16) | ((col[1] | 0) << 8) | (col[0] | 0);
      }
      const ZL = new Uint8Array(SW * SH); for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) ZL[y * SW + x] = Math.min(HL - 1, Math.floor((0.5 + 0.5 * Math.sin(x * 0.012 + y * 0.02)) * HL));
      const seed = c => { r = rng(3 + c * 7); for (let i = 0; i < a.length; i++) a[i] = (r() * NS) | 0; };
      L.disturb = () => { const cx = 40 + r() * (SW - 80), cy = 30 + r() * (SH - 60), rr = 18 + r() * 14; for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if ((x - cx) ** 2 + (y - cy) ** 2 < rr * rr) a[y * SW + x] = (r() * NS) | 0; };
      const step = () => {
        for (let y = 0; y < SH; y++) { const yu = ((y + SH - 1) % SH) * SW, yc = y * SW, yd = ((y + 1) % SH) * SW;
          for (let x = 0; x < SW; x++) { const v = a[yc + x], nx = v + 1 === NS ? 0 : v + 1;
            b[yc + x] = (a[yu + x] === nx || a[yd + x] === nx || a[yc + (x + 1) % SW] === nx || a[yc + (x + SW - 1) % SW] === nx) ? nx : v; } }
        const tmp = a; a = b; b = tmp;
      };
      return (t, dt) => {
        const c = Math.floor(t / LOOP); if (c !== cyc) { cyc = c; seed(c); }
        const lt = t - c * LOOP;
        acc = Math.min(4, acc + dt * 80); while (acc >= 1) { step(); acc--; }
        for (let i = 0; i < SW * SH; i++) pix[i] = LUT[a[i] * HL + ZL[i]];
        og.putImageData(img, 0, 0);
        const f = Math.min(ease.out(seg(lt, 0, 0.5)), 1 - ease.inOut(seg(lt, LOOP - 0.8, LOOP)));
        g.fillStyle = '#07070d'; g.fillRect(0, 0, W, H); g.globalAlpha = f; g.imageSmoothingEnabled = true; g.drawImage(oc, 0, 0, W, H);
        g.globalCompositeOperation = 'lighter'; g.filter = 'blur(5px)'; g.globalAlpha = 0.35 * f; g.drawImage(oc, 0, 0, W, H); g.filter = 'none'; g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      };
    },
  });

})();
