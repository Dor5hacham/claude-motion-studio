/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Oscilloscope music demo for Motion Examples.html: the stereo signal is the picture.
(function () {
  const { C } = EX;
  const W = 640, H = 360, SR = 48000, FREQ = 82.41, LOOP = 12;
  // Cube edges as one closed path (some edges are traced twice so the beam never jumps).
  const CUBE = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const CPATH = [0, 1, 2, 3, 0, 4, 5, 1, 5, 6, 2, 6, 7, 3, 7, 4, 0];
  function shape(i, u, T) {
    const a = u * Math.PI * 2;
    if (i === 0) return [Math.cos(a), Math.sin(a)];
    if (i === 1) { const k = 5, r = 0.55 + 0.45 * Math.abs(Math.cos(k * a / 2)); return [Math.cos(a) * r, Math.sin(a) * r]; }
    if (i === 2) { const s = u * 4, e = Math.floor(s), f = s - e; const P = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]; return [P[e][0] + (P[e + 1][0] - P[e][0]) * f, P[e][1] + (P[e + 1][1] - P[e][1]) * f].map(v => v * 0.8); }
    if (i === 3) { const s = u * (CPATH.length - 1), e = Math.floor(s), f = s - e; const A = CUBE[CPATH[e]], B = CUBE[CPATH[e + 1]]; let x = A[0] + (B[0] - A[0]) * f, y = A[1] + (B[1] - A[1]) * f, z = A[2] + (B[2] - A[2]) * f; const r1 = T * 0.9, r2 = T * 0.6; [x, z] = [x * Math.cos(r1) - z * Math.sin(r1), x * Math.sin(r1) + z * Math.cos(r1)]; [y, z] = [y * Math.cos(r2) - z * Math.sin(r2), y * Math.sin(r2) + z * Math.cos(r2)]; const p = 3 / (z + 4.2); return [x * p * 0.75, y * p * 0.75]; }
    return [Math.sin(3 * a + T), Math.sin(2 * a)];
  }
  // Position of the beam at time T (seconds): shape changes every 2.4 s with a short morph.
  function beam(T) {
    const seg = T % LOOP / 2.4, i = Math.floor(seg) % 5, j = (i + 1) % 5, m = Math.max(0, (seg - Math.floor(seg) - 0.75) / 0.25);
    const u = (T * FREQ) % 1; const A = shape(i, u, T), B = shape(j, u, T); const k = m * m * (3 - 2 * m);
    return [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k];
  }

  EX.add({
    cat: 'audio', id: 'oscilloscope', title: 'Oscilloscope music', aka: 'XY scope art, vector audio, sound you can see', tool: 'Web Audio (stereo buffer) + Canvas 2D', runs: 'CPU',
    notice: 'The left channel moves the beam left and right, the right channel moves it up and down. So the sound wave literally is the picture: a circle, a flower, a square, a spinning wireframe cube, a Lissajous knot. Press "Play sound" and you hear the shapes you see. Lower your volume first.',
    use: 'music videos, experimental art, sound-design explainers',
    prompt: 'Oscilloscope-music clip: generate a stereo audio track where left = x and right = y of a beam that draws a rotating wireframe logo, then render the matching green phosphor-glow XY scope video in sync.',
    controls: [{ label: 'Play sound', group: false, fn: L => L.state.play() }, { label: 'Stop', group: false, fn: L => L.state.stop() }],
    setup(cv, L) {
      const g = cv.getContext('2d'); let ac = null, src = null, t0 = 0;
      L.state = {
        play() {
          if (ac) return; ac = new AudioContext({ sampleRate: SR }); const buf = ac.createBuffer(2, SR * LOOP, SR); const l = buf.getChannelData(0), r = buf.getChannelData(1);
          for (let n = 0; n < l.length; n++) { const [x, y] = beam(n / SR); l[n] = x * 0.35; r[n] = y * 0.35; }
          src = ac.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(ac.destination); t0 = ac.currentTime + 0.05; src.start(t0);
        },
        stop() { if (ac) { src.stop(); ac.close(); ac = null; } },
      };
      return t => {
        const T = ac ? Math.max(0, ac.currentTime - t0) : t;
        g.fillStyle = 'rgba(2,8,4,0.35)'; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(60,255,140,0.06)'; g.lineWidth = 1; for (let x = 40; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 20; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
        const N = 900, span = 1 / 50; g.lineCap = 'round';
        for (const [w, a] of [[7, 0.08], [3, 0.25], [1.3, 0.95]]) {
          g.strokeStyle = `rgba(90,255,160,${a})`; g.lineWidth = w; g.beginPath();
          for (let i = 0; i <= N; i++) { const [x, y] = beam(T - span + span * i / N); const px = W / 2 + x * 150, py = H / 2 - y * 150; i ? g.lineTo(px, py) : g.moveTo(px, py); }
          g.stroke();
        }
        g.font = '500 13px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(90,255,160,0.6)'; g.fillText(ac ? 'LIVE AUDIO  L = x  R = y' : 'PREVIEW (press Play sound)', 16, 340);
        void C;
      };
    },
  });
})();
