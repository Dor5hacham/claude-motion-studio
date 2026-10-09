// Live "without vs with" comparisons for the Motion Guide vocabulary, plus the easing race
// and the frames/fps demo. Uses addLoop, EASES, clamp01, lerp from the guide's inline script.
(function () {
  const CORAL = '#ff5a36', AMBER = '#ffb020', CYAN = '#2bc4e6', VIOLET = '#7a5cff', CREAM = '#ece7de', DIM = '#6d6a76';
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const eo = EASES['ease-out'][0], eio = EASES['ease-in-out'][0], eexpo = EASES['expo-out'][0];

  // Mounts a demo (see addDemo); draw(g, t, W, H) runs only while visible, in design units.
  // On phones, narrow 'split' stacks the two halves (WITHOUT on top) and narrow [W, H] switches to that design size.
  // small is true while a phone layout draws, and px() then makes its text bigger.
  let small = false, stacked = false;
  const px = n => (small ? Math.round(n * 1.15) : n);
  const bg = (g, W, H) => { g.fillStyle = '#08080c'; g.fillRect(0, 0, W, H); };
  function live(id, draw, narrow) {
    const cv = /** @type {HTMLCanvasElement} */ (document.getElementById(id)); if (!cv) return null;
    const W0 = cv.width, H0 = cv.height, off = document.createElement('canvas'), og = off.getContext('2d');
    const size = n => (!n || !narrow ? [W0, H0] : narrow === 'split' ? [W0 / 2, H0 * 2] : narrow);
    return addDemo(cv, size, (g, t, W, H, n) => {
      small = n && !!narrow; stacked = small && narrow === 'split';
      if (!stacked) { bg(g, W, H); draw(g, t, W, H); small = false; return; }
      // Draw the whole split scene off screen, then put its right half under its left half.
      const k = cv.width / W, w = Math.round(W0 * k), h = Math.round(H0 * k);
      if (off.width !== w || off.height !== h) { off.width = w; off.height = h; }
      og.setTransform(k, 0, 0, k, 0, 0); og.globalAlpha = 1; bg(og, W0, H0); draw(og, t, W0, H0); small = stacked = false;
      g.drawImage(off, 0, 0, w / 2, h, 0, 0, W, H / 2); g.drawImage(off, w / 2, 0, w / 2, h, 0, H / 2, W, H / 2);
      g.strokeStyle = '#2a2a38'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    });
  }
  // Split view: left "without", right "with" + the prompt words that cause the change.
  // halfLabels draws only the divider and labels, for demos that paint their own backgrounds.
  function halves(g, W, H, right) {
    g.fillStyle = '#0d0d14'; g.fillRect(W / 2, 0, W / 2, H);
    halfLabels(g, W, H, right);
  }
  function halfLabels(g, W, H, right) {
    if (!stacked) { g.strokeStyle = '#2a2a38'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); }
    g.font = `600 ${px(13)}px Consolas`; g.fillStyle = DIM; g.fillText('WITHOUT', 16, 24);
    g.fillStyle = CORAL; g.fillText('WITH: ' + right, W / 2 + 16, 24);
  }
  const box = (g, x, y, s, col, r = 10) => { g.fillStyle = col; g.beginPath(); g.roundRect(x - s / 2, y - s / 2, s, s, r); g.fill(); };
  const ball = (g, x, y, r, col, sx = 1, sy = 1) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, r * sx, r * sy, 0, 0, 7); g.fill(); };

  // ---- Timing ----
  live('cmp-timing', (g, t, W) => {
    const lanes = /** @type {[number, string, string, string][]} */ ([[0.25, '250 ms', 'snappy, energetic', CORAL], [0.6, '600 ms', 'normal', AMBER], [1.5, '1.5 s', 'calm or heavy', CYAN]]);
    lanes.forEach(([d, lab, feel, col], i) => {
      const y = 62 + i * 66, cyc = t % 4.2, go = eo(seg(cyc, 0.4, 0.4 + d)) - eo(seg(cyc, 2.4, 2.4 + d));
      g.strokeStyle = '#1e1e2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(200, y); g.lineTo(W - 60, y); g.stroke();
      box(g, lerp(230, W - 90, go), y, 36, col);
      g.font = `700 ${px(16)}px Consolas`; g.fillStyle = col; g.fillText(lab, 20, y + 2); g.font = `${px(13)}px Segoe UI`; g.fillStyle = DIM; g.fillText(feel, 20, y + 20);
    });
    g.font = `600 ${px(13)}px Consolas`; g.fillStyle = DIM; g.fillText('SAME MOVE, THREE DURATIONS', 16, 24);
  }, [480, 240]);

  // ---- Hold ----
  live('cmp-hold', (g, t, W, H) => {
    halves(g, W, H, '"hold the title 1.5 s before it exits"');
    [[0, 0.1], [1, 1.5]].forEach(([side, hold]) => {
      const cx = side * W / 2 + W / 4, cyc = t % 3.6, inK = eexpo(seg(cyc, 0.3, 0.8)), outAt = 0.8 + hold, outK = seg(cyc, outAt, outAt + 0.35);
      g.save(); g.beginPath(); g.rect(side * W / 2 + 10, 60, W / 2 - 20, 90); g.clip();
      g.globalAlpha = inK * (1 - outK); g.font = '700 46px Bahnschrift'; g.textAlign = 'center'; g.fillStyle = CREAM;
      g.fillText('SUMMER SALE', cx, 125 + (1 - inK) * 40 - outK * 50); g.restore(); g.globalAlpha = 1; g.textAlign = 'left';
      // timeline: in, hold, out
      const x0 = side * W / 2 + 40, tw = W / 2 - 80, sc = tw / 3.6, y = 190;
      g.fillStyle = '#1e1e2a'; g.fillRect(x0, y, tw, 14);
      g.fillStyle = AMBER; g.fillRect(x0 + 0.3 * sc, y, 0.5 * sc, 14); g.fillStyle = CYAN; g.fillRect(x0 + 0.8 * sc, y, hold * sc, 14); g.fillStyle = CORAL; g.fillRect(x0 + outAt * sc, y, 0.35 * sc, 14);
      g.fillStyle = '#fff'; g.fillRect(x0 + cyc * sc - 1, y - 6, 2, 26);
      g.font = px(12) + 'px Consolas'; g.fillStyle = DIM; g.fillText('in', x0 + 0.3 * sc, y + 32); g.fillStyle = CYAN; g.fillText('hold ' + hold + ' s', x0 + 0.8 * sc + 4, y + 32); g.fillStyle = CORAL; g.fillText('out', x0 + outAt * sc, y + 46);
    });
  }, 'split');

  // ---- Follow-through and overlap ----
  // Each ribbon is 9 fixed-length segments. On the right, every segment angle is its own damped spring
  // driven by the box's acceleration, stepped at a fixed 1/240 s so it is stable at any frame rate.
  // Tips are looser and slower than roots, so they swing further and settle later (overlap).
  const SEGS = 9, SEGL = 14, SUB = 1 / 240, REST = Math.PI - Math.atan2(2, SEGL);
  const boxK = tt => { const c = ((tt % 3.2) + 3.2) % 3.2; return eio(seg(c, 0.4, 0.9)) - eio(seg(c, 2.0, 2.5)); };
  const bend = [0, 1, 2].map(() => ({ b: new Float64Array(SEGS), v: new Float64Array(SEGS) }));
  let simT = -1;
  live('cmp-follow', (g, t, W, H) => {
    halves(g, W, H, '"add follow-through to the ribbons when it stops"');
    // First frame, or back after being off screen: restart from rest two cycles back, so the ribbons
    // show the state they would have if the demo had kept running.
    if (simT < 0 || t < simT || t - simT > 0.25) { bend.forEach(r => { r.b.fill(0); r.v.fill(0); }); simT = t - 6.4; }
    while (simT < t) {
      simT += SUB;
      const acc = (boxK(simT + SUB) - 2 * boxK(simT) + boxK(simT - SUB)) / (SUB * SUB) * 210;
      bend.forEach((r, ri) => { for (let j = 0; j < SEGS; j++) {
        const w = 11 - j * 0.5 - ri * 0.6, gain = (0.0025 + j * 0.0008) * (1 + ri * 0.12);
        r.v[j] += SUB * (-w * w * r.b[j] - 2 * 0.2 * w * r.v[j] - gain * acc); r.b[j] += SUB * r.v[j];
      } });
    }
    [0, 1].forEach(side => {
      const ox = side * W / 2, bx = ox + lerp(170, 380, boxK(t)), by = 130;
      g.save(); g.beginPath(); g.rect(ox + 1, 36, W / 2 - 2, H - 36); g.clip();
      bend.forEach((r, ri) => {
        const ay = by - 22 + ri * 22; let x = bx - 30, y = ay;
        g.strokeStyle = [CORAL, AMBER, CYAN][ri]; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x, y);
        for (let j = 0; j < SEGS; j++) {
          const b = side ? Math.max(-0.6, Math.min(2.2, r.b[j] > 0 ? r.b[j] : r.b[j] * 0.4)) : 0, a = REST + b;
          x += Math.cos(a) * SEGL; y += Math.sin(a) * SEGL; g.lineTo(x, y);
        }
        g.stroke();
      });
      box(g, bx, by, 64, VIOLET, 14);
      g.restore();
    });
  }, 'split');

  // ---- Secondary motion ----
  live('cmp-secondary', (g, t, W, H) => {
    halves(g, W, H, '"add a dust puff and a wobble on landing"');
    [0, 1].forEach(side => {
      const cx = side * W / 2 + W / 4, gy = 200, cyc = t % 2.6, f = seg(cyc, 0.2, 0.75), y = lerp(50, gy - 30, f * f);
      g.fillStyle = '#1e1e2a'; g.fillRect(side * W / 2 + 40, gy, W / 2 - 80, 3);
      let sx = 1, sy = 1; const land = cyc - 0.75;
      if (side === 1 && land > 0) { const w = Math.exp(-land * 5) * Math.sin(land * 26) * 0.28; sx = 1 + w; sy = 1 - w; for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI, d = 10 + land * 90, r = 9 * (1 - seg(land, 0, 0.9)); if (r > 0) { g.fillStyle = 'rgba(236,231,222,0.35)'; g.beginPath(); g.arc(cx + Math.cos(a) * d * 1.4, gy - 4 + Math.sin(a) * d * 0.25, r, 0, 7); g.fill(); } } }
      ball(g, cx, Math.min(y, gy - 30) + 30 * (1 - sy), 30, CORAL, sx, sy);
    });
  }, 'split');

  // ---- Arcs ----
  live('cmp-arcs', (g, t, W, H) => {
    halves(g, W, H, '"move it along an arc, not a straight line"');
    [0, 1].forEach(side => {
      const ox = side * W / 2, cyc = t % 2.6, u = eio(seg(cyc, 0.3, 1.8));
      const pos = v => [ox + lerp(70, 410, v), side ? 200 - 4 * 130 * v * (1 - v) : 200];
      for (let i = 0; i <= 12; i++) { const v = eio(i / 12); if (v > u) break; const [x, y] = pos(v); g.fillStyle = 'rgba(255,176,32,0.35)'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
      const [x, y] = pos(u); ball(g, x, y, 18, AMBER);
    });
  }, 'split');

  // ---- Rhythm and beat sync (with optional click track) ----
  let ac = null, t0 = 0;
  const beatBtn = document.getElementById('beat-audio');
  if (beatBtn) beatBtn.onclick = () => {
    if (ac) { ac.close(); ac = null; beatBtn.textContent = 'Hear the beat'; beatBtn.classList.remove('on'); return; }
    ac = new AudioContext(); t0 = ac.currentTime + 0.05; beatBtn.textContent = 'Stop sound'; beatBtn.classList.add('on');
    for (let i = 0; i < 240; i++) { const o = ac.createOscillator(), gn = ac.createGain(), tt = t0 + i * 0.5; o.frequency.value = i % 4 ? 900 : 1500; gn.gain.setValueAtTime(0.0001, tt); gn.gain.exponentialRampToValueAtTime(0.3, tt + 0.002); gn.gain.exponentialRampToValueAtTime(0.0001, tt + 0.08); o.connect(gn).connect(ac.destination); o.start(tt); o.stop(tt + 0.1); }
  };
  const offBeats = [0.37, 0.91, 1.62, 2.21, 2.83, 3.55];
  live('cmp-beat', (g, t, W, H) => {
    halves(g, W, H, '"120 BPM, every change lands on the beat"');
    const T = ac ? Math.max(0, ac.currentTime - t0) : t, cyc = T % 4, beat = Math.floor(cyc / 0.5), sinceBeat = cyc - beat * 0.5;
    [0, 1].forEach(side => {
      const cx = side * W / 2 + W / 4; let idx, since;
      if (side) { idx = beat; since = sinceBeat; } else { idx = offBeats.filter(b => b <= cyc).length; const last = offBeats.filter(b => b <= cyc).pop(); since = last === undefined ? 9 : cyc - last; }
      const pop = 1 + 0.25 * Math.exp(-since * 10), col = [CORAL, AMBER, CYAN, VIOLET][idx % 4], kind = idx % 3;
      g.save(); g.translate(cx, 110); g.scale(pop, pop); g.fillStyle = col;
      if (kind === 0) { g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill(); } else if (kind === 1) box(g, 0, 0, 76, col, 10); else { g.beginPath(); g.moveTo(0, -46); g.lineTo(44, 34); g.lineTo(-44, 34); g.closePath(); g.fill(); }
      g.restore();
      const x0 = side * W / 2 + 40, tw = W / 2 - 80;
      for (let b = 0; b < 8; b++) { const x = x0 + b / 8 * tw + tw / 16; g.fillStyle = b === beat ? '#fff' : (b % 4 ? '#3a3a4e' : '#5a5a70'); g.beginPath(); g.arc(x, 205, b === beat ? 7 : 5, 0, 7); g.fill(); }
      if (!side) offBeats.forEach(b => { if (b < 4) { g.fillStyle = CORAL; g.fillRect(x0 + b / 4 * tw - 1, 186, 2, 10); } });
      g.fillStyle = '#fff'; g.fillRect(x0 + cyc / 4 * tw - 1, 182, 2, 34);
    });
    g.font = px(12) + 'px Consolas'; g.fillStyle = DIM; g.fillText('changes land between beats', 16, 232); g.fillText('one change per beat (0.5 s at 120 BPM)', W / 2 + 16, 232);
  }, 'split');

  // ---- Seamless loop ----
  live('cmp-loop', (g, t, W, H) => {
    halves(g, W, H, '"make it a seamless 2-second loop"');
    const L = 2, cyc = t % L, u = cyc / L;
    [0, 1].forEach(side => {
      const ox = side * W / 2;
      g.save(); g.beginPath(); g.rect(ox + 20, 50, W / 2 - 40, 120); g.clip();
      for (let i = -1; i < 6; i++) {
        const x = side ? ox + 40 + ((i + u) * 80) : ox + 40 + i * 80 + eio(u) * 60;
        ball(g, x, 110, 22, [CORAL, AMBER, CYAN, VIOLET][(i + 8) % 4]);
      }
      g.restore();
      const x0 = ox + 40, tw = W / 2 - 80; g.fillStyle = '#1e1e2a'; g.fillRect(x0, 200, tw, 8); g.fillStyle = side ? CYAN : AMBER; g.fillRect(x0, 200, tw * u, 8);
      if (!side && cyc < 0.15) { g.font = '700 22px Bahnschrift'; g.fillStyle = CORAL; g.fillText('JUMP', ox + W / 4 - 26, 80); }
    });
    g.font = px(12) + 'px Consolas'; g.fillStyle = DIM; g.fillText('last frame does not match the first', 16, 232); g.fillText('last frame flows into the first', W / 2 + 16, 232);
  }, 'split');

  // ---- Parallax ----
  live('cmp-parallax', (g, t, W, H) => {
    [0, 1].forEach(side => {
      const ox = side * W / 2; g.save(); g.beginPath(); g.rect(ox, 34, W / 2, H - 34); g.clip();
      const sky = g.createLinearGradient(0, 34, 0, H); sky.addColorStop(0, '#22163a'); sky.addColorStop(1, '#ff8a5a'); g.fillStyle = sky; g.fillRect(ox, 34, W / 2, H);
      /** @type {[number, number, number, string][]} */ ([[0.15, 150, 50, '#5a3a6a'], [0.45, 185, 32, '#3a2448'], [1.2, 215, 22, '#1a0f22']]).forEach(([sp, base, amp, col]) => {
        const s = side ? sp : 0.45, cam = t * 60 * s; g.fillStyle = col; g.beginPath(); g.moveTo(ox, H);
        for (let x = 0; x <= W / 2; x += 6) { const wx = (x + cam) * 0.02; g.lineTo(ox + x, base - Math.abs(Math.sin(wx) * amp + Math.sin(wx * 2.3) * amp * 0.4)); }
        g.lineTo(ox + W / 2, H); g.fill();
      });
      g.restore();
    });
    halfLabels(g, W, H, '"three-layer parallax as the camera slides right"');
  }, 'split');

  // ---- Easing race ----
  live('ease-race', (g, t, W, H) => {
    const names = Object.keys(EASES), cyc = t % 3.4, p = clamp01((cyc - 0.4) / 1.6);
    names.forEach((n, i) => {
      const y = 26 + i * ((H - 30) / names.length), f = EASES[n][0];
      g.font = `600 ${px(13)}px Consolas`; g.fillStyle = DIM; g.fillText(n, 14, y + 5);
      g.strokeStyle = '#1e1e2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(140, y); g.lineTo(W - 30, y); g.stroke();
      ball(g, lerp(150, W - 40, f(p)), y, 9, [CORAL, AMBER, CYAN, VIOLET][i % 4]);
    });
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(lerp(150, W - 40, p) - 1, 10, 2, H - 14);
  }, [480, 300]);

  // ---- Frames and fps ----
  live('fps-demo', (g, t, W) => {
    const pos = tt => { const u = (tt % 2) / 2; const b = Math.abs(Math.sin(u * Math.PI * 2)); return [lerp(160, W - 60, 0.5 - 0.5 * Math.cos(u * Math.PI * 2)), b]; };
    // filmstrip: 12 stills of one bounce
    g.font = `600 ${px(13)}px Consolas`; g.fillStyle = DIM; g.fillText('12 FRAMES OF ONE SECOND, SHOWN FAST ONE AFTER ANOTHER', 16, 20);
    // One row of 12 stills, or two rows of 6 in the phone layout.
    const cur = Math.floor((t % 1) * 12), per = W < 900 ? 6 : 12, rows = 12 / per;
    for (let i = 0; i < 12; i++) {
      const x = 16 + (i % per) * 77, y = 30 + Math.floor(i / per) * 80, u = i / 12, hgt = Math.abs(Math.sin(u * Math.PI)) * 40;
      g.fillStyle = i === cur ? '#2a2236' : '#14141c'; g.strokeStyle = i === cur ? CORAL : '#2a2a38'; g.lineWidth = 2; g.beginPath(); g.roundRect(x, y, 70, 70, 6); g.fill(); g.stroke();
      ball(g, x + 35, y + 58 - hgt, 9, AMBER, u < 0.06 || u > 0.94 ? 1.3 : 1, u < 0.06 || u > 0.94 ? 0.7 : 1);
      g.font = px(10) + 'px Consolas'; g.fillStyle = DIM; g.fillText(String(i + 1), x + 4, y + 12);
    }
    /** @type {[number, string][]} */ ([[12, 'choppy: stop-motion, anime'], [24, 'film look'], [30, 'web video'], [60, 'smooth: games, UI, sports']]).forEach(([fps, lab], i) => {
      const y = 140 + (rows - 1) * 80 + i * 40, tq = Math.floor(t * fps) / fps, [x, b] = pos(tq);
      g.font = `700 ${px(15)}px Consolas`; g.fillStyle = [CORAL, AMBER, CYAN, VIOLET][i]; g.fillText(fps + ' fps', 16, y + 5); g.font = px(12) + 'px Segoe UI'; g.fillStyle = DIM; g.fillText(lab, 16, y + 20);
      g.strokeStyle = '#1e1e2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(150, y); g.lineTo(W - 40, y); g.stroke();
      ball(g, x, y - b * 0, 11, [CORAL, AMBER, CYAN, VIOLET][i]);
    });
  }, [480, 380]);
})();
