// Live "without vs with" comparisons for the Motion Guide vocabulary, plus the easing race
// and the frames/fps demo. Uses addLoop, EASES, clamp01, lerp from the guide's inline script.
(function () {
  const CORAL = '#ff5a36', AMBER = '#ffb020', CYAN = '#2bc4e6', VIOLET = '#7a5cff', CREAM = '#ece7de', DIM = '#6d6a76';
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const eo = EASES['ease-out'][0], eio = EASES['ease-in-out'][0], eexpo = EASES['expo-out'][0];

  // Mounts a canvas loop; draw(g, t, W, H) runs only while visible.
  function live(id, draw) {
    const cv = /** @type {HTMLCanvasElement} */ (document.getElementById(id)); if (!cv) return null;
    const g = cv.getContext('2d');
    return addLoop(cv, t => { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = '#08080c'; g.fillRect(0, 0, cv.width, cv.height); draw(g, t, cv.width, cv.height); });
  }
  // Split view: left "without", right "with" + the prompt words that cause the change.
  function halves(g, W, H, right) {
    g.fillStyle = '#0d0d14'; g.fillRect(W / 2, 0, W / 2, H);
    g.strokeStyle = '#2a2a38'; g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
    g.font = '600 13px Consolas'; g.fillStyle = DIM; g.fillText('WITHOUT', 16, 24);
    g.fillStyle = CORAL; g.fillText('WITH: ' + right, W / 2 + 16, 24);
  }
  const box = (g, x, y, s, col, r = 10) => { g.fillStyle = col; g.beginPath(); g.roundRect(x - s / 2, y - s / 2, s, s, r); g.fill(); };
  const ball = (g, x, y, r, col, sx = 1, sy = 1) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, r * sx, r * sy, 0, 0, 7); g.fill(); };

  // ---- Timing ----
  live('cmp-timing', (g, t) => {
    const lanes = /** @type {[number, string, string, string][]} */ ([[0.25, '250 ms', 'snappy, energetic', CORAL], [0.6, '600 ms', 'normal', AMBER], [1.5, '1.5 s', 'calm or heavy', CYAN]]);
    lanes.forEach(([d, lab, feel, col], i) => {
      const y = 62 + i * 66, cyc = t % 4.2, go = eo(seg(cyc, 0.4, 0.4 + d)) - eo(seg(cyc, 2.4, 2.4 + d));
      g.strokeStyle = '#1e1e2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(200, y); g.lineTo(900, y); g.stroke();
      box(g, lerp(230, 870, go), y, 36, col);
      g.font = '700 16px Consolas'; g.fillStyle = col; g.fillText(lab, 20, y + 2); g.font = '13px Segoe UI'; g.fillStyle = DIM; g.fillText(feel, 20, y + 20);
    });
    g.font = '600 13px Consolas'; g.fillStyle = DIM; g.fillText('SAME MOVE, THREE DURATIONS', 16, 24);
  });

  // ---- Hold ----
  live('cmp-hold', (g, t, W, H) => {
    halves(g, W, H, '"hold the title 1.5 s before it exits"');
    [[0, 0.1], [1, 1.6]].forEach(([side, hold]) => {
      const cx = side * W / 2 + W / 4, cyc = t % 3.6, inK = eexpo(seg(cyc, 0.3, 0.8)), outAt = 0.8 + hold, outK = seg(cyc, outAt, outAt + 0.35);
      g.save(); g.beginPath(); g.rect(side * W / 2 + 10, 60, W / 2 - 20, 90); g.clip();
      g.globalAlpha = inK * (1 - outK); g.font = '700 46px Bahnschrift'; g.textAlign = 'center'; g.fillStyle = CREAM;
      g.fillText('SUMMER SALE', cx, 125 + (1 - inK) * 40 - outK * 50); g.restore(); g.globalAlpha = 1; g.textAlign = 'left';
      // timeline: in, hold, out
      const x0 = side * W / 2 + 40, tw = W / 2 - 80, sc = tw / 3.6, y = 190;
      g.fillStyle = '#1e1e2a'; g.fillRect(x0, y, tw, 14);
      g.fillStyle = AMBER; g.fillRect(x0 + 0.3 * sc, y, 0.5 * sc, 14); g.fillStyle = CYAN; g.fillRect(x0 + 0.8 * sc, y, hold * sc, 14); g.fillStyle = CORAL; g.fillRect(x0 + outAt * sc, y, 0.35 * sc, 14);
      g.fillStyle = '#fff'; g.fillRect(x0 + cyc * sc - 1, y - 6, 2, 26);
      g.font = '12px Consolas'; g.fillStyle = DIM; g.fillText('in', x0 + 0.3 * sc, y + 32); g.fillStyle = CYAN; g.fillText('hold ' + hold + ' s', x0 + 0.8 * sc + 4, y + 32); g.fillStyle = CORAL; g.fillText('out', x0 + outAt * sc, y + 46);
    });
  });

  // ---- Follow-through and overlap ----
  const chains = [0, 1].map(() => [0, 1, 2].map(() => [...Array(9)].map(() => ({ x: 0, y: 0, vx: 0, vy: 0, init: false }))));
  live('cmp-follow', (g, t, W, H) => {
    halves(g, W, H, '"add follow-through to the ribbons when it stops"');
    [0, 1].forEach(side => {
      const ox = side * W / 2, cyc = t % 3.2, k = eexpo(seg(cyc, 0.4, 0.9)) - eexpo(seg(cyc, 2.0, 2.5)), bx = ox + lerp(170, 380, k), by = 130;
      chains[side].forEach((ch, ri) => {
        const ay = by - 22 + ri * 22;
        ch.forEach((p, i) => {
          const tx = bx - 34 - i * 14, ty = ay + i * 2;
          if (side === 0 || !p.init) { p.x = tx; p.y = ty; p.init = true; return; }
          const lead = i === 0 ? { x: bx - 34, y: ay } : ch[i - 1];
          const rx = lead.x - 14, ry = lead.y + 2;
          p.vx = (p.vx + (rx - p.x) * 0.22) * 0.8; p.vy = (p.vy + (ry - p.y) * 0.22) * 0.8; p.x += p.vx; p.y += p.vy;
        });
        g.strokeStyle = [CORAL, AMBER, CYAN][ri]; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(bx - 30, ay); ch.forEach(p => g.lineTo(p.x, p.y)); g.stroke();
      });
      box(g, bx, by, 64, VIOLET, 14);
    });
  });

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
  });

  // ---- Arcs ----
  live('cmp-arcs', (g, t, W, H) => {
    halves(g, W, H, '"move it along an arc, not a straight line"');
    [0, 1].forEach(side => {
      const ox = side * W / 2, cyc = t % 2.6, u = eio(seg(cyc, 0.3, 1.8));
      const pos = v => [ox + lerp(70, 410, v), side ? 200 - 4 * 130 * v * (1 - v) : 200];
      for (let i = 0; i <= 12; i++) { const v = eio(i / 12); if (v > u) break; const [x, y] = pos(v); g.fillStyle = 'rgba(255,176,32,0.35)'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
      const [x, y] = pos(u); ball(g, x, y, 18, AMBER);
    });
  });

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
    g.font = '12px Consolas'; g.fillStyle = DIM; g.fillText('changes land between beats', 16, 232); g.fillText('one change per beat (0.5 s at 120 BPM)', W / 2 + 16, 232);
  });

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
    g.font = '12px Consolas'; g.fillStyle = DIM; g.fillText('last frame does not match the first', 16, 232); g.fillText('last frame flows into the first', W / 2 + 16, 232);
  });

  // ---- Parallax ----
  live('cmp-parallax', (g, t, W, H) => {
    halves(g, W, H, '"three-layer parallax as the camera slides right"');
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
    halves(g, W, H, '"three-layer parallax as the camera slides right"');
  });

  // ---- Easing race ----
  live('ease-race', (g, t, W, H) => {
    const names = Object.keys(EASES), cyc = t % 3.4, p = clamp01((cyc - 0.4) / 1.6);
    names.forEach((n, i) => {
      const y = 26 + i * ((H - 30) / names.length), f = EASES[n][0];
      g.font = '600 13px Consolas'; g.fillStyle = DIM; g.fillText(n, 14, y + 5);
      g.strokeStyle = '#1e1e2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(140, y); g.lineTo(W - 30, y); g.stroke();
      ball(g, lerp(150, W - 40, f(p)), y, 9, [CORAL, AMBER, CYAN, VIOLET][i % 4]);
    });
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(lerp(150, W - 40, p) - 1, 10, 2, H - 14);
  });

  // ---- Frames and fps ----
  live('fps-demo', (g, t, W) => {
    const pos = tt => { const u = (tt % 2) / 2; const b = Math.abs(Math.sin(u * Math.PI * 2)); return [lerp(160, W - 60, 0.5 - 0.5 * Math.cos(u * Math.PI * 2)), b]; };
    // filmstrip: 12 stills of one bounce
    g.font = '600 13px Consolas'; g.fillStyle = DIM; g.fillText('12 FRAMES OF ONE SECOND, SHOWN FAST ONE AFTER ANOTHER', 16, 20);
    const cur = Math.floor((t % 1) * 12);
    for (let i = 0; i < 12; i++) {
      const x = 16 + i * 77, y = 30, u = i / 12, hgt = Math.abs(Math.sin(u * Math.PI)) * 40;
      g.fillStyle = i === cur ? '#2a2236' : '#14141c'; g.strokeStyle = i === cur ? CORAL : '#2a2a38'; g.lineWidth = 2; g.beginPath(); g.roundRect(x, y, 70, 70, 6); g.fill(); g.stroke();
      ball(g, x + 35, y + 58 - hgt, 9, AMBER, u < 0.06 || u > 0.94 ? 1.3 : 1, u < 0.06 || u > 0.94 ? 0.7 : 1);
      g.font = '10px Consolas'; g.fillStyle = DIM; g.fillText(String(i + 1), x + 4, y + 12);
    }
    /** @type {[number, string][]} */ ([[12, 'choppy: stop-motion, anime'], [24, 'film look'], [30, 'web video'], [60, 'smooth: games, UI, sports']]).forEach(([fps, lab], i) => {
      const y = 140 + i * 40, tq = Math.floor(t * fps) / fps, [x, b] = pos(tq);
      g.font = '700 15px Consolas'; g.fillStyle = [CORAL, AMBER, CYAN, VIOLET][i]; g.fillText(fps + ' fps', 16, y + 5); g.font = '12px Segoe UI'; g.fillStyle = DIM; g.fillText(lab, 16, y + 20);
      g.strokeStyle = '#1e1e2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(150, y); g.lineTo(W - 40, y); g.stroke();
      ball(g, x, y - b * 0, 11, [CORAL, AMBER, CYAN, VIOLET][i]);
    });
  });
})();
