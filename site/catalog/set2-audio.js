/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Sound and motion, set 2: the picture and the sound read one clock, so every flash lands on its note.
(function () {
  const { C } = EX;
  const W = 640, H = 360, TAU = Math.PI * 2;
  const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  // Color at x in [0,1] along a list of hex stops, as [r,g,b].
  const ramp = (stops, x) => { const n = stops.length - 1, k = Math.min(n - 1, Math.floor(x * n)), f = x * n - k, a = hex(stops[k]), b = hex(stops[k + 1]); return a.map((v, i) => Math.round(v + (b[i] - v) * f)); };

  // Audio clock for one card. start() (call it from a click) makes the AudioContext, a compressor, a small
  // reverb and an analyser; then every 25 ms it calls queue(A, from, to) to schedule the notes whose musical
  // time falls in [from, to), using A.at(T) to turn musical time into audio time. A.time(t) is the musical
  // time the listener hears right now, or the card time t while silent. The context is suspended while the
  // card is paused or scrolled away, so picture and sound never drift apart.
  function clock(L, queue, wet = 0.25) {
    let timer = 0, t0 = 0, done = 0;
    const A = {
      ac: null, out: null, an: null, live: false,
      at: T => T + t0,
      time: t => (A.live ? Math.max(0, A.ac.currentTime - t0 - (A.ac.outputLatency || 0)) : t),
      start() {
        if (A.ac) return;
        const ac = (A.ac = new AudioContext());
        const comp = ac.createDynamicsCompressor(), master = ac.createGain(), rev = ac.createConvolver(), send = ac.createGain();
        const n = ac.sampleRate * 2 | 0, ir = ac.createBuffer(2, n, ac.sampleRate);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4); }
        rev.buffer = ir; send.gain.value = wet; master.gain.value = 0.8;
        A.out = ac.createGain(); A.an = ac.createAnalyser(); A.an.fftSize = 2048; A.an.smoothingTimeConstant = 0.5;
        A.out.connect(comp); A.out.connect(send); send.connect(rev); rev.connect(comp); comp.connect(master); master.connect(A.an); A.an.connect(ac.destination);
        timer = setInterval(() => {
          if (!A.ac) return;
          if (!L.vis || L.paused) { if (ac.state === 'running') ac.suspend(); return; }
          if (ac.state === 'suspended') ac.resume();
          // the musical clock takes over from the card time only once the audio device really runs
          if (!A.live) { if (ac.state !== 'running' || ac.currentTime === 0) return; t0 = ac.currentTime - L.t; done = L.t + 0.03; A.live = true; }
          const now = ac.currentTime - t0, to = now + 0.15; if (done < now) done = now;
          if (to > done) { queue(A, done, to); done = to; }
        }, 25);
      },
      // keep: hand the current musical time back to the card so the silent picture carries on from it.
      stop(keep) { if (!A.ac) return; if (keep) L.t = A.time(L.t); clearInterval(timer); A.ac.close(); A.ac = null; A.live = false; },
    };
    if (L.state && L.state.kill) L.state.kill();
    L.state = { play: () => A.start(), stop: () => A.stop(true), kill: () => A.stop(false) };
    return A;
  }
  // A fresh array per card: core.js rewraps each control's fn in place, so cards must not share one.
  const soundControls = () => [{ label: 'Play sound', group: false, fn: L => L.state.play() }, { label: 'Stop', group: false, fn: L => L.state.stop() }];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // A struck note at musical time T: sine fundamental plus a quieter partial at ratio x f, exponential decay.
  function strike(A, T, f, vol, dec, pan = 0, ratio = 4, pv = 0.25) {
    const ac = A.ac, t = Math.max(ac.currentTime, A.at(T)), g = ac.createGain(), p = ac.createStereoPanner();
    p.pan.value = pan; g.connect(p); p.connect(A.out);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    [[f, 1], [f * ratio, pv]].forEach(([fr, a]) => {
      const o = ac.createOscillator(), og = ac.createGain(); o.frequency.value = fr; og.gain.value = a;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + (a < 1 ? dec * 0.4 : dec) + 0.05);
    });
  }

  // ---------- 1. Polyrhythm arcs ----------
  const PENTA = [0, 2, 4, 7, 9];
  EX.add({
    cat: 'audio', id: 'au2-polyrhythm', title: 'Polyrhythm arcs', aka: 'polyrhythm visualizer, realignment, pendulum music, phase music', tool: 'Web Audio API (scheduled oscillators) + Canvas 2D', runs: 'CPU',
    notice: 'Each dot rides its own arc at a whole-number speed, so the dots drift into waves and spirals and all line up again once per cycle. Every time a dot touches the line it plays its note: outer arcs are low, inner arcs are high, and the note pans to the side it hits. Picture and sound read the same clock, and the countdown shows when everything realigns.',
    use: 'music videos, meditative loops, teaching rhythm and ratios, ambient social clips',
    params: [
      { key: 'arcs', label: 'Arcs', min: 6, max: 21, step: 1, value: 15 },
      { key: 'cycle', label: 'Realign every (s)', min: 20, max: 240, step: 5, value: 60, unit: ' s' },
    ],
    prompt: 'Polyrhythm visual with sound: {arcs} nested semicircles over one baseline. Each dot travels its arc back and forth at a whole-number speed (the inner arc fastest), so all dots line up again every {cycle}. When a dot touches the line it plays its note from a major pentatonic scale (outer arcs low, inner arcs high), panned to the side it hits; its arc and end key flash and a ripple leaves the hit point. Schedule the notes ahead on the Web Audio clock and drive the picture from the same clock. Dark background, arc colors from coral to violet, a countdown to the next realignment.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), cx = W / 2, by = 316, R0 = 34, R1 = 292, MAXN = 30;
      let ph0 = 0, T0 = 0, P = L.p.cycle, cols = [], ncols = 0;
      const U = T => ph0 + (T - T0) / P;
      const rad = (i, n) => R0 + i * (R1 - R0) / (n - 1);
      const pitch = i => mtof(36 + 12 * Math.floor((20 - i) / 5) + PENTA[(20 - i) % 5]);
      const A = clock(L, (A, a, b) => {
        const n = L.p.arcs, ua = U(a), ub = U(b);
        for (let i = 0; i < n; i++) {
          const m = 2 * (MAXN - i);
          for (let k = Math.ceil(ua * m); k < ub * m; k++) {
            const T = T0 + (k / m - ph0) * P, side = k % 2 ? 1 : -1;
            strike(A, T, pitch(i), 0.16 - i * 0.003, 1.6 - i * 0.04, side * rad(i, n) / R1 * 0.7, 4, 0.12);
          }
        }
      });
      g.lineCap = 'round';
      return (t) => {
        const T = A.time(t), n = L.p.arcs;
        if (L.p.cycle !== P) { ph0 = U(T); T0 = T; P = L.p.cycle; }
        if (ncols !== n) { ncols = n; cols = []; for (let i = 0; i < n; i++) cols.push(ramp([C.coral, C.amber, C.cyan, C.violet], i / (n - 1)).join(',')); }
        const u = U(T);
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const sweep = 1 - Math.min(1, (1 - (u % 1)) * P / 2.5);
        g.strokeStyle = `rgba(244,239,230,${0.22 + 0.5 * sweep})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(16, by); g.lineTo(W - 16, by); g.stroke();
        for (let i = n - 1; i >= 0; i--) {
          const r = rad(i, n), m = 2 * (MAXN - i), um = u * m, k = Math.floor(um), since = (um - k) * P / m, fl = Math.exp(-since * 5), col = cols[i];
          g.strokeStyle = `rgba(${col},${0.13 + 0.55 * fl})`; g.lineWidth = 1.2 + 1.6 * fl; g.beginPath(); g.arc(cx, by, r, Math.PI, TAU); g.stroke();
          // end keys: the one just hit lights up
          for (const s of [-1, 1]) { const hit = (k % 2 ? 1 : -1) === s ? fl : 0; g.fillStyle = `rgba(${col},${0.25 + 0.75 * hit})`; g.fillRect(cx + s * r - 4, by + 3, 8, 4 + 6 * hit); }
          const q = (u * (MAXN - i)) % 1 * 2, dir = q < 1 ? 1 : -1, th = q < 1 ? Math.PI + q * Math.PI : TAU - (q - 1) * Math.PI;
          for (let s = 0; s < 4; s++) {
            const a0 = th - dir * 0.09 * s, a1 = th - dir * 0.09 * (s + 1), lo = Math.max(Math.PI, Math.min(a0, a1)), hi = Math.min(TAU, Math.max(a0, a1));
            if (hi <= lo) break; g.strokeStyle = `rgba(${col},${0.55 - s * 0.13})`; g.lineWidth = 3.2 - s * 0.6; g.beginPath(); g.arc(cx, by, r, lo, hi); g.stroke();
          }
          const x = cx + Math.cos(th) * r, y = by + Math.sin(th) * r;
          g.fillStyle = `rgba(${col},${0.18 + 0.3 * fl})`; g.beginPath(); g.arc(x, y, 7 + 7 * fl, 0, TAU); g.fill();
          g.fillStyle = C.cream; g.beginPath(); g.arc(x, y, 3.2 + 1.8 * fl, 0, TAU); g.fill();
          if (since < 0.7) { const hx = cx + (k % 2 ? 1 : -1) * r; g.strokeStyle = `rgba(${col},${0.7 * (1 - since / 0.7)})`; g.lineWidth = 1.5; g.beginPath(); g.arc(hx, by, 4 + since * 50, Math.PI, TAU); g.stroke(); }
        }
        const left = (1 - (u % 1)) * P;
        g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.textBaseline = 'alphabetic';
        g.textAlign = 'left'; g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', 18, 346);
        g.textAlign = 'right'; g.fillText(`${n} arcs  realign in ${left.toFixed(1)} s`, W - 18, 346); g.textAlign = 'left';
      };
    },
  });

  // Shared drum and synth voices for the scored cards. Each plays at musical time T through A.out.
  const noiseOf = A => { if (!A.nb) { const ac = A.ac, b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; A.nb = b; } return A.nb; };
  const env = (gn, t, a, peak, d) => { gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(peak, t + a); gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const V = {
    kick(A, T, vol = 0.9) { const ac = A.ac, t = A.at(T), o = ac.createOscillator(), gn = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12); env(gn, t, 0.002, vol, 0.34); o.connect(gn); gn.connect(A.out); o.start(t); o.stop(t + 0.4); },
    noise(A, T, f, type, vol, d, q = 0.8) { const ac = A.ac, t = A.at(T), s = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain(); s.buffer = noiseOf(A); fl.type = type; fl.frequency.value = f; fl.Q.value = q; env(gn, t, 0.001, vol, d); s.connect(fl); fl.connect(gn); gn.connect(A.out); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05); },
    tone(A, T, m, type, vol, d, cut = 0, pan = 0, att = 0.004) {
      const ac = A.ac, t = A.at(T), o = ac.createOscillator(), gn = ac.createGain(), p = ac.createStereoPanner(); o.type = type; o.frequency.value = mtof(m); p.pan.value = pan; env(gn, t, att, vol, d);
      let n = /** @type {AudioNode} */ (o); if (cut) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cut * 2.5, t); fl.frequency.exponentialRampToValueAtTime(cut, t + 0.15); fl.Q.value = 4; o.connect(fl); n = fl; }
      n.connect(gn); gn.connect(p); p.connect(A.out); o.start(t); o.stop(t + att + d + 0.05);
    },
  };

  // ---------- 2. Spectrum terrain ----------
  const BPM2 = 100, ST2 = 60 / BPM2 / 4, CH2 = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]], ROOT2 = [33, 29, 36, 31];
  const BASS2 = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], ARP2 = [0, 1, 2, 3, 4, 5, 4, 2];
  const arpNote = (bar, st) => { const c = CH2[bar], k = ARP2[st % 8]; return c[k % 3] + 12 * (1 + Math.floor(k / 3)); };
  EX.add({
    cat: 'audio', id: 'au2-waterfall', title: 'Spectrum terrain', aka: 'spectrum waterfall, 3D spectrogram, Unknown Pleasures lines, FFT landscape', tool: 'Web Audio API (AnalyserNode FFT) + Canvas 2D perspective', runs: 'CPU',
    notice: 'A four-bar synth loop is analysed every frame, and each spectrum becomes a ridge that slides back toward the horizon. Bass sits on the left, the hats hiss on the right, the arpeggio draws a peak that hops across, and nearer ridges hide the ones behind, like the Unknown Pleasures cover. Without sound, the same score draws a stand-in spectrum.',
    use: 'music videos, album art loops, live visuals, explaining what a spectrum is',
    params: [
      { key: 'depth', label: 'Perspective', min: 0.4, max: 4, step: 0.1, value: 1.8 },
      { key: 'hist', label: 'History (s)', min: 1, max: 6, step: 0.5, value: 3, unit: ' s' },
    ],
    prompt: 'Spectrum terrain for a synth loop: analyse the audio with a Web Audio AnalyserNode (FFT 2048) every frame, map 40 Hz to 12 kHz on a log axis, and draw each spectrum as a ridge line. Ridges slide back toward a horizon over {hist} with perspective strength {depth}; draw back to front and fill under each ridge with the background so near ridges hide far ones (Unknown Pleasures style). Lines colored coral at the bass to cyan at the highs, fading with distance, vanishing point swaying slowly. The loop: 100 BPM, Am F C G, kick, clap, hats, saw bass, pad and a sixteenth-note arpeggio.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), NX = 128, ROWS = 64, F0 = 40, F1 = 12000, LF = Math.log(F1 / F0), HZ = 70, FRONT = 318;
      const hist = new Float32Array(ROWS * NX), htime = new Float64Array(ROWS).fill(-1e9), live = new Float32Array(NX), bins = new Uint8Array(1024), fbin = new Float32Array(NX), taper = new Float32Array(NX);
      for (let i = 0; i < NX; i++) { const e = Math.min(i, NX - 1 - i) / 8; taper[i] = e >= 1 ? 1 : e * e * (3 - 2 * e); }
      let head = 0, nextCap = 0, lastT = 0, sr = 0;
      const pos = f => Math.log(f / F0) / LF;
      const A = clock(L, (A, a, b) => {
        for (let k = Math.ceil(a / ST2); k * ST2 < b; k++) {
          const T = k * ST2, s = k % 64, bar = s >> 4, st = s & 15;
          if (st === 0 || st === 8 || (st === 10 && bar === 3)) V.kick(A, T);
          if (st === 4 || st === 12) V.noise(A, T, 1700, 'bandpass', 0.55, 0.16);
          if (st % 4 === 2) V.noise(A, T, 8000, 'highpass', 0.22, 0.09); else if (st % 2) V.noise(A, T, 9500, 'highpass', 0.07, 0.03);
          if (BASS2[st]) V.tone(A, T, ROOT2[bar] + (st === 14 ? 12 : 0), 'sawtooth', 0.32, 0.26, 260);
          if (st === 0) CH2[bar].forEach((m, j) => V.tone(A, T, m, 'sawtooth', 0.035, 2.3, 1100, j - 1, 0.25));
          V.tone(A, T, arpNote(bar, st), 'triangle', 0.1, 0.16, 0, st % 2 ? 0.35 : -0.35);
        }
      }, 0.18);
      const add = (row, f, amp, w) => { const c = pos(f); for (let i = 0; i < NX; i++) { const d = (i / (NX - 1) - c) / w; if (d > -3 && d < 3) row[i] += amp * Math.exp(-d * d); } };
      // Stand-in spectrum read straight from the score: what the analyser would show at musical time T.
      function score(row, T) {
        row.fill(0); const k0 = Math.floor(T / ST2);
        for (let k = k0; k > k0 - 18 && k >= 0; k--) {
          const s = k % 64, bar = s >> 4, st = s & 15, age = T - k * ST2;
          if (st === 0 || st === 8 || (st === 10 && bar === 3)) add(row, 52, 1.6 * Math.exp(-age * 7), 0.07);
          if (st === 4 || st === 12) add(row, 1700, 0.8 * Math.exp(-age * 13), 0.16);
          if (st % 4 === 2) add(row, 8500, 0.55 * Math.exp(-age * 22), 0.13);
          if (BASS2[st]) { const f = mtof(ROOT2[bar] + (st === 14 ? 12 : 0)); for (let h = 1; h <= 5; h++) add(row, f * h, 1.1 / h * Math.exp(-age * 5), 0.012); }
          if (st === 0 && age < 2.8) { const e = Math.min(1, age / 0.25) * (age > 2.4 ? Math.exp(-(age - 2.4) * 8) : 1); CH2[bar].forEach(m => { for (let h = 1; h <= 6; h++) add(row, mtof(m) * h, 0.5 / h * e, 0.01); }); }
          if (age < 0.4) { const f = mtof(arpNote(bar, st)); add(row, f, 1.1 * Math.exp(-age * 10), 0.012); add(row, f * 3, 0.15 * Math.exp(-age * 10), 0.012); }
        }
        for (let i = 0; i < NX; i++) row[i] = (1 - Math.exp(-row[i] * 1.2) + 0.05 * EX.noise(i * 0.4, T * 4)) * taper[i];
      }
      function analyse(row) {
        if (sr !== A.ac.sampleRate) { sr = A.ac.sampleRate; for (let i = 0; i < NX; i++) fbin[i] = F0 * Math.exp(LF * i / (NX - 1)) / (sr / 2) * A.an.frequencyBinCount; A.an.minDecibels = -88; A.an.maxDecibels = -16; }
        A.an.getByteFrequencyData(bins);
        for (let i = 0; i < NX; i++) { const b = fbin[i], j = Math.floor(b), f = b - j, v = (bins[j] * (1 - f) + bins[j + 1] * f) / 255; row[i] = Math.pow(Math.min(1, v * (0.88 + 0.3 * i / NX)), 1.6) * taper[i]; }
      }
      const grad = g.createLinearGradient(40, 0, 600, 0); [C.coral, C.amber, C.cream, C.cyan, C.violet].forEach((c, i) => grad.addColorStop(i / 4, c));
      function ridge(row, o, z, T, lw) {
        const s = 1 / (1 + L.p.depth * z), base = HZ + (FRONT - HZ) * s, cx = W / 2 + 70 * Math.sin(T * 0.3) * (1 - s), half = 300 * s, amp = 150 * s;
        g.beginPath(); g.moveTo(cx - half, base);
        for (let i = 0; i < NX; i++) g.lineTo(cx - half + 2 * half * i / (NX - 1), base - row[o + i] * amp);
        g.lineTo(cx + half, base); g.fillStyle = C.bg; g.fill();
        g.globalAlpha = Math.max(0, 1 - z) * 0.85 + 0.05; g.lineWidth = lw; g.stroke();
        if (lw > 1.5) { g.globalAlpha = 0.18; g.lineWidth = 7; g.stroke(); }
        g.globalAlpha = 1;
      }
      g.lineJoin = 'round';
      return (t) => {
        const T = A.time(t), span = L.p.hist, gap = span / ROWS, on = A.live;
        if (T < lastT - 0.25) { htime.fill(-1e9); nextCap = T; } lastT = T;
        if (T >= nextCap) { if (on) analyse(live); else score(live, T); hist.set(live, head * NX); htime[head] = T; head = (head + 1) % ROWS; nextCap = Math.max(nextCap + gap, T - gap); }
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const sky = g.createLinearGradient(0, 0, 0, HZ + 40); sky.addColorStop(0, 'rgba(122,92,255,0.10)'); sky.addColorStop(1, 'rgba(122,92,255,0)'); g.fillStyle = sky; g.fillRect(0, 0, W, HZ + 40);
        g.strokeStyle = grad;
        for (let j = 0; j < ROWS; j++) { const r = (head + j) % ROWS, z = (T - htime[r]) / span; if (z >= 0 && z < 1) ridge(hist, r * NX, z, T, 1.1); }
        if (on) analyse(live); else score(live, T);
        ridge(live, 0, 0, T, 2);
        g.font = '500 11px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.5)'; g.textAlign = 'center';
        for (const [f, l] of /** @type {[number, string][]} */ ([[100, '100 Hz'], [1000, '1 kHz'], [10000, '10 kHz']])) { const x = W / 2 - 300 + 600 * pos(f); g.fillRect(x, FRONT + 4, 1, 5); g.fillText(l, x, FRONT + 22); }
        g.textAlign = 'left'; g.font = '500 12px Cascadia Mono, Consolas'; g.fillText(on ? 'LIVE FFT' : 'PREVIEW  press Play sound', 18, 26);
        g.textAlign = 'right'; g.fillText(`100 BPM  ${['Am', 'F', 'C', 'G'][Math.floor(T / ST2 / 16) % 4]}`, W - 18, 26); g.textAlign = 'left';
      };
    },
  });

  // ---------- 3. Karaoke ----------
  const BEAT3 = 60 / 96, LOOPB3 = 32;
  const LYR3 = ['Sound |and |pic|ture |keep |one |time', 'Ev|ery |word |lands |on |its |note', 'Watch |the |ball |and |sing |a|long', 'One |clock |drives |the |whole |song'];
  const DUR3 = [[1, .5, .5, 1, 1, 1, 2], [.5, .5, 1, 1, .5, .5, 2.5], [1, .5, .5, 1, 1, 1, 2], [1, 1, 1, .5, .5, 3]];
  const MID3 = [[64, 64, 67, 69, 67, 64, 62], [60, 62, 64, 67, 64, 62, 64], [69, 67, 69, 72, 71, 69, 67], [64, 67, 69, 67, 64, 60]];
  const VOW3 = ['aaieioa', 'eieaoio', 'oeoaiao', 'ooaeoo'];
  const FORM3 = { a: [800, 1200, 2500], e: [500, 1850, 2500], i: [320, 2300, 3000], o: [480, 850, 2400], u: [350, 750, 2300] };
  const CH3 = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50], [41, 45, 48], [48, 52, 55], [43, 47, 50], [48, 52, 55]];
  // One loop of notes in beats: { l: line, j: syllable, s: start, d: length, m: MIDI pitch, v: vowel }.
  const NOTES3 = [];
  LYR3.forEach((ln, l) => { let s = l * 8; ln.split('|').forEach((txt, j) => { NOTES3.push({ l, j, txt, s, d: DUR3[l][j], m: MID3[l][j], v: VOW3[l][j] }); s += DUR3[l][j]; }); });
  const NN3 = NOTES3.length;
  EX.add({
    cat: 'audio', id: 'au2-karaoke', title: 'Karaoke lyric sync', aka: 'sing-along, bouncing ball, lyric wipe, pitch lane, SingStar view', tool: 'Web Audio API (formant-filter voice) + Canvas 2D', runs: 'CPU',
    notice: 'A synthetic voice sings the melody: a sawtooth through three band-pass filters tuned to each vowel, with glide and vibrato. Every syllable fills with color over exactly the length of its note, the ball lands on it at the note start, and the pitch lane above draws each note as a bar with the sung pitch traced through it. All of it reads one beat clock.',
    use: 'lyric videos, sing-along content, language learning, any text that must follow audio',
    params: [
      { key: 'lead', label: 'Lane look-ahead (s)', min: 1.5, max: 5, step: 0.5, value: 3, unit: ' s' },
      { key: 'hop', label: 'Ball hop height', min: 0, max: 2, step: 0.1, value: 1 },
    ],
    prompt: 'Karaoke lyric video with a synthesized singer: four lines of original lyrics at 96 BPM, each syllable on its own note. Sing them with a formant voice (sawtooth into three band-pass filters per vowel, glide and vibrato). Each syllable fills from cream to coral over the exact length of its note; a ball hops from syllable to syllable (hop height {hop}) and lands on each one at its note start; the next line waits below and slides up during the rest. Above, a pitch lane scrolls the notes toward a playhead ({lead} of look-ahead), fills each bar as it is sung and traces the sung pitch with its glide and vibrato.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), PX = 200, YL = 290, LH = 44, FONT = '600 32px Bahnschrift, Segoe UI', lay = [];
      g.font = FONT;
      // Layout: x and width of each syllable, every line centered.
      LYR3.forEach((ln, l) => {
        const parts = ln.split('|'), ws = parts.map(p => g.measureText(p).width), tot = ws.reduce((a, b) => a + b, 0); let x = W / 2 - tot / 2;
        lay[l] = parts.map((p, j) => { const o = { x, w: g.measureText(p.trimEnd()).width, txt: p.trimEnd(), q: NOTES3.find(q => q.l === l && q.j === j) }; x += ws[j]; return o; });
      });
      const nAbs = n => { const k = Math.floor(n / NN3), q = NOTES3[n - k * NN3]; return { q, s: k * LOOPB3 + q.s, gl: k * 4 + q.l }; };
      const noteAt = b => { const k = Math.floor(b / LOOPB3), r = b - k * LOOPB3; let i = NN3 - 1; while (i > 0 && NOTES3[i].s > r) i--; return k * NN3 + i; };
      const lineStart = gl => Math.floor(gl / 4) * LOOPB3 + (gl % 4) * 8;
      const lineEnd = gl => { const l = gl % 4, ln = lay[l], q = ln[ln.length - 1].q; return Math.floor(gl / 4) * LOOPB3 + q.s + q.d; };
      // Sung pitch (MIDI, fractional) at beat b with glide and delayed vibrato; NaN between notes.
      const pitchAt = b => {
        const n = noteAt(b), { q, s } = nAbs(n); if (b >= s + q.d - 0.1) return NaN;
        const p = nAbs(n - 1), from = p.s + p.q.d > s - 0.05 ? p.q.m : q.m - 0.7, sec = (b - s) * BEAT3;
        return q.m + (from - q.m) * Math.exp(-sec / 0.035) + 0.22 * Math.sin(sec * TAU * 5.6) * Math.min(1, Math.max(0, (sec - 0.18) / 0.3));
      };
      let voice = null;
      const A = clock(L, (A, a, b) => {
        const ac = A.ac, B = BEAT3;
        if (!voice || voice.ac !== ac) {
          const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), vg = ac.createGain();
          const fs = [0, 1, 2].map(k => { const f = ac.createBiquadFilter(), fg = ac.createGain(); f.type = 'bandpass'; f.Q.value = 9 + k * 3; fg.gain.value = [1.6, 0.9, 0.45][k]; o.connect(f); f.connect(fg); fg.connect(vg); return f; });
          o.type = 'sawtooth'; lfo.frequency.value = 5.6; lg.gain.value = 22; lfo.connect(lg); lg.connect(o.detune); vg.gain.value = 0; vg.connect(A.out); o.start(); lfo.start();
          voice = { ac, o, vg, fs };
        }
        for (let k = Math.ceil(a / B); k * B < b; k++) {
          const T = k * B, bar = Math.floor(k / 4) % 8, bt = k % 4, ch = CH3[bar];
          if (bt === 0 || bt === 2) V.tone(A, T, ch[0] - 12, 'triangle', 0.3, 0.5);
          ch.forEach((m, j) => V.tone(A, T + 0.012 * j, m + 12, 'triangle', bt === 0 ? 0.06 : 0.035, 0.45, 0, j - 1));
          V.noise(A, T, 3200, 'bandpass', bt === 0 ? 0.09 : 0.05, 0.03, 3);
        }
        for (let n = noteAt(a / B); ; n++) {
          const { q, s } = nAbs(n), T = s * B; if (T >= b) break; if (T < a) continue;
          const t = A.at(T), te = A.at((s + q.d) * B) - 0.07, F = FORM3[q.v];
          voice.o.frequency.setTargetAtTime(mtof(q.m), t, 0.03); voice.fs.forEach((fl, k) => fl.frequency.setTargetAtTime(F[k], t, 0.02));
          voice.vg.gain.setTargetAtTime(0.5, t, 0.012); voice.vg.gain.setTargetAtTime(0, te, 0.025);
        }
      }, 0.3);
      const ym = m => 184 - (m - 58) * 8.4;
      return (t) => {
        const T = A.time(t), b = T / BEAT3, n = noteAt(b), cur = nAbs(n), nxt = nAbs(n + 1), pps = 380 / L.p.lead;
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        // pitch lane
        g.fillStyle = 'rgba(29,27,58,0.45)'; g.beginPath(); g.roundRect(14, 30, W - 28, 172, 10); g.fill();
        g.font = '500 10px Cascadia Mono, Consolas'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        for (const [m, nm] of /** @type {[number, string][]} */ ([[60, 'C4'], [64, 'E4'], [67, 'G4'], [72, 'C5']])) { g.fillStyle = 'rgba(244,239,230,0.07)'; g.fillRect(44, ym(m), W - 72, 1); g.fillStyle = 'rgba(244,239,230,0.35)'; g.fillText(nm, 22, ym(m) + 3); }
        g.save(); g.beginPath(); g.rect(44, 30, W - 72, 172); g.clip();
        for (let k = n - 8; k < n + 14; k++) {
          const { q, s } = nAbs(k), x = PX + (s - b) * BEAT3 * pps, w = q.d * BEAT3 * pps - 4, y = ym(q.m) - 5;
          if (x > W || x + w < 0) continue;
          g.fillStyle = 'rgba(244,239,230,0.10)'; g.strokeStyle = 'rgba(244,239,230,0.38)'; g.lineWidth = 1; g.beginPath(); g.roundRect(x, y, w, 10, 5); g.fill(); g.stroke();
          const sung = Math.min(w, PX - x); if (sung > 0) { g.fillStyle = k < n ? 'rgba(255,90,54,0.55)' : C.coral; g.beginPath(); g.roundRect(x, y, Math.max(sung, 10), 10, 5); g.fill(); }
          g.fillStyle = k === n ? C.cream : 'rgba(244,239,230,0.45)'; g.fillText(q.txt.trim(), x + 2, y - 5);
        }
        g.strokeStyle = C.amber; g.lineWidth = 2.2; g.lineJoin = 'round'; g.beginPath(); let pen = false;
        for (let i = 0; i <= 90; i++) {
          const bb = b - (90 - i) / 90 * (PX - 44) / pps / BEAT3, p = pitchAt(bb), x = PX - (b - bb) * BEAT3 * pps;
          if (isNaN(p)) { pen = false; continue; } if (pen) g.lineTo(x, ym(p)); else g.moveTo(x, ym(p)); pen = true;
        }
        g.stroke(); g.restore();
        g.fillStyle = 'rgba(244,239,230,0.25)'; g.fillRect(PX - 1, 34, 2, 164);
        const pn = pitchAt(b), since = (b - cur.s) * BEAT3;
        if (!isNaN(pn)) { const y = ym(pn); g.fillStyle = 'rgba(255,176,32,0.25)'; g.beginPath(); g.arc(PX, y, 9 + 8 * Math.exp(-since * 10), 0, TAU); g.fill(); g.fillStyle = C.cream; g.beginPath(); g.arc(PX, y, 4, 0, TAU); g.fill(); }
        // lyric lines: S is the scroll position, it moves only during the rest between two lines
        const gl0 = cur.gl, le = lineEnd(gl0), ls = lineStart(gl0 + 1), pr = Math.min(1, Math.max(0, (b - le) / (ls - le))), S = gl0 + EX.ease.inOut(pr);
        const lineY = gl => YL + (gl - S) * LH, lineA = gl => { const d = gl - S; return d < 0 ? Math.max(0, 1 + d * 1.6) : d <= 1 ? 1 - 0.62 * d : Math.max(0, 0.38 * (2 - d)); };
        g.font = FONT;
        for (let gl = Math.floor(S) - 1; gl <= Math.floor(S) + 2; gl++) {
          const al = lineA(gl), l = ((gl % 4) + 4) % 4; if (al <= 0.01) continue; const y = lineY(gl);
          g.globalAlpha = al;
          for (const sy of lay[l]) {
            const s0 = Math.floor(gl / 4) * LOOPB3 + sy.q.s, f = Math.min(1, Math.max(0, (b - s0) / sy.q.d));
            g.fillStyle = 'rgba(244,239,230,0.42)'; g.fillText(sy.txt, sy.x, y);
            if (f > 0) { g.save(); g.beginPath(); g.rect(sy.x - 2, y - 40, (sy.w + 4) * f, 52); g.clip(); g.fillStyle = f < 1 ? C.coral : C.amber; g.fillText(sy.txt, sy.x, y); g.restore(); }
          }
          g.globalAlpha = 1;
        }
        // ball: rests on the sung syllable, then hops so it lands exactly on the next note start
        const p0 = lay[cur.q.l][cur.q.j], p1 = lay[nxt.q.l][nxt.q.j], x0 = p0.x + p0.w / 2, x1 = p1.x + p1.w / 2, y0 = YL - 36, y1 = y0;
        const gap = (nxt.s - cur.s) * BEAT3, hop = Math.min(gap, 0.62), u = Math.min(1, Math.max(0, ((b - cur.s) * BEAT3 - (gap - hop)) / hop));
        const bx = x0 + (x1 - x0) * u, by = y0 + (y1 - y0) * u - Math.min(34, 16 + Math.abs(x1 - x0) * 0.16) * L.p.hop * 4 * u * (1 - u), sq = Math.exp(-since * 14);
        g.fillStyle = 'rgba(255,90,54,0.2)'; g.beginPath(); g.ellipse(bx, by, 11 + 4 * sq, 11 - 3 * sq, 0, 0, TAU); g.fill();
        g.fillStyle = C.coral; g.beginPath(); g.ellipse(bx, by + 2 * sq, 6.5 * (1 + 0.35 * sq), 6.5 * (1 - 0.3 * sq), 0, 0, TAU); g.fill();
        g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.5)'; g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', 18, 22);
        g.textAlign = 'right'; g.fillText(`line ${(gl0 % 4) + 1} of 4   96 BPM`, W - 18, 22); g.textAlign = 'left';
      };
    },
  });

  // ---------- 4. Sound of sorting ----------
  const N4 = 48;
  // Each sort works on a copy and logs every step as [kind, i, j, pitch value]: kind 0 compare, 1 swap, 2 write (j holds the value).
  const SORTS4 = /** @type {[string, (a: number[]) => number[][]][]} */ ([
    ['Insertion sort', a => { const o = []; for (let i = 1; i < a.length; i++) for (let j = i; j > 0; j--) { o.push([0, j - 1, j, a[j]]); if (a[j - 1] <= a[j]) break; [a[j - 1], a[j]] = [a[j], a[j - 1]]; o.push([1, j - 1, j, a[j - 1]]); } return o; }],
    ['Quicksort', a => {
      const o = [];
      const qs = (lo, hi) => {
        if (lo >= hi) return; const mid = (lo + hi) >> 1; [a[mid], a[hi]] = [a[hi], a[mid]]; o.push([1, mid, hi, a[hi]]); const p = a[hi]; let i = lo;
        for (let j = lo; j < hi; j++) { o.push([0, j, hi, a[j]]); if (a[j] < p) { [a[i], a[j]] = [a[j], a[i]]; o.push([1, i, j, a[i]]); i++; } }
        [a[i], a[hi]] = [a[hi], a[i]]; o.push([1, i, hi, a[i]]); qs(lo, i - 1); qs(i + 1, hi);
      };
      qs(0, a.length - 1); return o;
    }],
    ['Merge sort', a => {
      const o = [];
      const ms = (lo, hi) => {
        if (hi <= lo) return; const mid = (lo + hi) >> 1; ms(lo, mid); ms(mid + 1, hi); const t = a.slice(lo, hi + 1); let i = 0, j = mid + 1 - lo, k = lo;
        while (i <= mid - lo && j <= hi - lo) { o.push([0, lo + i, lo + j, t[i]]); const v = t[i] <= t[j] ? t[i++] : t[j++]; a[k] = v; o.push([2, k++, v, v]); }
        while (i <= mid - lo) { const v = t[i++]; a[k] = v; o.push([2, k++, v, v]); } while (j <= hi - lo) { const v = t[j++]; a[k] = v; o.push([2, k++, v, v]); }
      };
      ms(0, a.length - 1); return o;
    }],
    ['Heap sort', a => {
      const o = [], n = a.length;
      const sift = (i, end) => { for (;;) { let c = 2 * i + 1; if (c >= end) return; if (c + 1 < end) { o.push([0, c, c + 1, a[c]]); if (a[c + 1] > a[c]) c++; } o.push([0, i, c, a[i]]); if (a[i] >= a[c]) return; [a[i], a[c]] = [a[c], a[i]]; o.push([1, i, c, a[i]]); i = c; } };
      for (let i = (n >> 1) - 1; i >= 0; i--) sift(i, n);
      for (let e = n - 1; e > 0; e--) { [a[0], a[e]] = [a[e], a[0]]; o.push([1, 0, e, a[e]]); sift(0, e); }
      return o;
    }],
  ]);
  EX.add({
    cat: 'audio', id: 'au2-sorting', title: 'Sound of sorting', aka: 'sorting algorithm race, audible algorithms, sorting visualizer with sound', tool: 'Web Audio API (stepped oscillators) + Canvas 2D', runs: 'CPU',
    notice: 'Four sorting algorithms race on the same 48 values, and every compare or swap pings a pitch set by the value it touches, so you hear each method: insertion sort as long slides, quicksort as jumps, merge sort as rising runs, heap sort as zigzags. When one finishes, a green check sweep plays the sorted scale. The input changes each round (random, reversed, nearly sorted), and so does the winner.',
    use: 'computer science teaching, coding content, explainer videos, satisfying loops',
    params: [
      { key: 'rate', label: 'Steps per second', min: 60, max: 900, step: 20, value: 300 },
    ],
    prompt: 'Sound of sorting race: four panels (insertion sort, quicksort, merge sort, heap sort) sort the same 48 bars, colored by value from coral to violet. Log every compare, swap and write ahead of time, then replay them at {rate} steps per second; highlight the bars each step touches and play a short triangle-wave ping per step with pitch from the value (150 Hz to 2 kHz), one oscillator per panel, panned to its side. When a panel finishes, a green band sweeps up the sorted bars playing a rising scale, and it gets a rank badge. Rounds cycle through random, reversed and nearly sorted input with step counters on each panel.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), NA = SORTS4.length, SW = 2 * N4, HOLD = 260, r = EX.rng(11);
      const pitch = v => 150 * Math.pow(2000 / 150, (v - 1) / (N4 - 1));
      const cols = []; for (let v = 1; v <= N4; v++) cols.push(`rgb(${ramp([C.coral, C.amber, C.cyan, C.violet], (v - 1) / (N4 - 1)).join(',')})`);
      // Three rounds with different inputs; every algorithm's full step log is computed once here.
      const sorted = Array.from({ length: N4 }, (_, i) => i + 1), rand = sorted.slice();
      for (let i = N4 - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rand[i], rand[j]] = [rand[j], rand[i]]; }
      const near = sorted.slice(); for (let k = 0; k < 5; k++) { const i = Math.floor(r() * (N4 - 3)), j = i + 1 + Math.floor(r() * 3); [near[i], near[j]] = [near[j], near[i]]; }
      let start = 0;
      const rounds = /** @type {[string, number[]][]} */ ([['random', rand], ['reversed', sorted.slice().reverse()], ['nearly sorted', near]]).map(([name, input]) => {
        const logs = SORTS4.map(([, f]) => f(input.slice())), lens = logs.map(o => o.length), len = Math.max(...lens) + SW + HOLD;
        const rank = lens.map(x => 1 + lens.filter(y => y < x).length), rd = { name, input, logs, lens, rank, start, len }; start += len; return rd;
      });
      const CYC = start;
      const where = p => { const pc = p - Math.floor(p / CYC) * CYC; let ri = 0; while (ri < rounds.length - 1 && rounds[ri + 1].start <= pc) ri++; return { ri, local: pc - rounds[ri].start }; };
      let ph0 = 0, T0 = 0, RT = L.p.rate;
      const pos = T => ph0 + (T - T0) * RT;
      let voices = null;
      const A = clock(L, (A, a, b) => {
        const ac = A.ac;
        if (!voices || voices[0].ac !== ac) voices = SORTS4.map((_, k) => { const o = ac.createOscillator(), gn = ac.createGain(), p = ac.createStereoPanner(); o.type = 'triangle'; gn.gain.value = 0; p.pan.value = k % 2 ? 0.65 : -0.65; o.connect(gn); gn.connect(p); p.connect(A.out); o.start(); return { ac, o, gn }; });
        for (let p = Math.ceil(pos(a)); p < pos(b); p++) {
          const { ri, local } = where(p), rd = rounds[ri], t = A.at(T0 + (p - ph0) / RT);
          for (let k = 0; k < NA; k++) {
            const n = rd.lens[k]; let v = 0;
            if (local < n) v = rd.logs[k][local][3]; else if (local < n + SW && (local - n) % 2 === 0) v = (local - n) / 2 + 1;
            if (!v) continue;
            const vc = voices[k]; vc.o.frequency.setValueAtTime(pitch(v), t); vc.gn.gain.setValueAtTime(local < n ? 0.07 : 0.1, t); vc.gn.gain.setTargetAtTime(0.0001, t + 0.004, 0.014);
          }
        }
      }, 0.12);
      const st = SORTS4.map(() => ({ ri: -1, k: 0, arr: new Int16Array(N4), cmp: 0, swp: 0 }));
      const PW = 306, PH = 156, PXS = [12, 322], PYS = [34, 198];
      return (t) => {
        const T = A.time(t);
        if (L.p.rate !== RT) { ph0 = pos(T); T0 = T; RT = L.p.rate; }
        const { ri, local } = where(pos(T)), rd = rounds[ri];
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.font = '500 12px Cascadia Mono, Consolas'; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillStyle = 'rgba(244,239,230,0.55)';
        g.fillText(`INPUT  ${rd.name}   round ${ri + 1} of 3   ${N4} values`, 14, 22);
        g.textAlign = 'right'; g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', W - 14, 22); g.textAlign = 'left';
        for (let k = 0; k < NA; k++) {
          const s = st[k], log = rd.logs[k], n = rd.lens[k], want = Math.min(n, Math.floor(local) + 1);
          if (s.ri !== ri || want < s.k) { s.ri = ri; s.k = 0; s.cmp = 0; s.swp = 0; s.arr.set(rd.input); }
          while (s.k < want) { const o = log[s.k++]; if (o[0] === 0) s.cmp++; else { s.swp++; if (o[0] === 1) { const x = s.arr[o[1]]; s.arr[o[1]] = s.arr[o[2]]; s.arr[o[2]] = x; } else s.arr[o[1]] = o[2]; } }
          const x0 = PXS[k % 2], y0 = PYS[k >> 1], done = local >= n, cur = !done && s.k > 0 ? log[s.k - 1] : null, sweep = done ? (local - n) / 2 : -1;
          g.fillStyle = 'rgba(29,27,58,0.5)'; g.beginPath(); g.roundRect(x0, y0, PW, PH, 8); g.fill();
          const bw = (PW - 20) / N4, base = y0 + PH - 8;
          for (let i = 0; i < N4; i++) {
            const v = s.arr[i], h = 6 + (v / N4) * (PH - 44), hit = cur && (cur[1] === i || (cur[0] !== 2 && cur[2] === i));
            g.fillStyle = hit ? C.cream : done && i <= sweep && i > sweep - 7 ? C.green : cols[v - 1];
            g.globalAlpha = hit || done ? 1 : 0.78; g.fillRect(x0 + 10 + i * bw, base - h, bw - 1.2, h);
          }
          g.globalAlpha = 1;
          g.font = '600 14px Bahnschrift, Segoe UI'; g.fillStyle = C.cream; g.fillText(SORTS4[k][0], x0 + 10, y0 + 20);
          g.font = '500 11px Cascadia Mono, Consolas'; g.textAlign = 'right'; g.fillStyle = 'rgba(244,239,230,0.6)';
          g.fillText(done ? `done in ${(n / RT).toFixed(1)} s` : `${s.cmp} cmp  ${s.swp} ${k === 2 ? 'writes' : 'swaps'}`, x0 + PW - 10, y0 + 19); g.textAlign = 'left';
          if (done) {
            const rk = rd.rank[k], pop = EX.ease.back(Math.min(1, (local - n) / (0.25 * RT)));
            g.font = '600 14px Bahnschrift, Segoe UI'; g.save(); g.translate(x0 + 30 + g.measureText(SORTS4[k][0]).width, y0 + 15); g.scale(pop, pop); g.fillStyle = rk === 1 ? C.amber : 'rgba(244,239,230,0.18)'; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
            g.fillStyle = rk === 1 ? C.bg : C.cream; g.font = '700 11px Bahnschrift, Segoe UI'; g.textAlign = 'center'; g.fillText(['1st', '2nd', '3rd', '4th'][rk - 1], 0, 4); g.restore(); g.textAlign = 'left';
          }
        }
      };
    },
  });

  // ---------- 5. Doppler effect ----------
  EX.add({
    cat: 'audio', id: 'au2-doppler', title: 'Doppler effect, heard', aka: 'Doppler shift, passing siren, wavefronts, moving sound source', tool: 'Web Audio API (beeps scheduled at wave arrival) + Canvas 2D', runs: 'CPU',
    notice: 'The source beeps seven times a second, and every beep leaves a ring that spreads at the speed of sound. Each beep is scheduled to sound exactly when its ring reaches the listener, at the pitch that geometry gives, so you hear the beeps bunch up and rise as it approaches, then stretch out and drop as it leaves. Rings and dots are amber when they will be heard above 440 Hz and violet below, and the strip plots every beep the listener heard.',
    use: 'physics teaching, sound design for passing objects, science explainers',
    params: [
      { key: 'mach', label: 'Source speed (Mach)', min: 0.1, max: 0.9, step: 0.05, value: 0.5 },
    ],
    prompt: 'Doppler effect you can hear: a source crosses the screen at Mach {mach} and beeps 7 times a second at 440 Hz. Each beep leaves a circular wavefront that grows at the speed of sound (240 px/s here) from where it was emitted, so rings bunch up ahead and spread out behind. A listener sits below the path: schedule each beep with Web Audio to play at the moment its ring reaches the listener, at f = 440 / (1 - M cos theta) for the angle at emission, louder when near and panned to the side it came from; flash the listener on each arrival. Below, a strip chart plots every heard beep against a dashed 440 Hz line.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), CS = 240, FB = 7, F0 = 440, TY = 128, LX = 320, LY = 222, X0 = -70, SPAN = 780;
      // Motion segments: when the speed slider moves, a new segment starts so past positions stay where they were.
      const segs = [{ T0: 0, s0: 260, v: L.p.mach * CS }];
      const seg = te => { let i = segs.length - 1; while (i > 0 && segs[i].T0 > te) i--; return segs[i]; };
      const xs = te => { const q = seg(te), s = q.s0 + (te - q.T0) * q.v; return X0 + (s - Math.floor(s / SPAN) * SPAN); };
      // Beep k: emitted at k / FB from the source position; returns where, when it arrives and at what pitch.
      const E = { x: 0, d: 0, ta: 0, f: 0 };
      const emit = k => { const te = k / FB, q = seg(te), x = xs(te), dx = LX - x, dy = LY - TY, d = Math.hypot(dx, dy); E.x = x; E.d = d; E.ta = te + d / CS; E.f = F0 / (1 - (q.v / CS) * (dx / d)); return E; };
      const A = clock(L, (A, a, b) => {
        const ac = A.ac;
        for (let k = Math.floor((a - 3.5) * FB); k <= Math.ceil(b * FB); k++) {
          const e = emit(k); if (e.ta < a || e.ta >= b) continue;
          const t = A.at(e.ta), o = ac.createOscillator(), o2 = ac.createOscillator(), fl = ac.createBiquadFilter(), gn = ac.createGain(), p = ac.createStereoPanner();
          o.type = 'square'; o.frequency.value = e.f; o2.frequency.value = e.f * 2; fl.type = 'lowpass'; fl.frequency.value = e.f * 3; p.pan.value = Math.max(-0.9, Math.min(0.9, (e.x - LX) / 300));
          env(gn, t, 0.004, 0.45 / (1 + e.d / 110), 0.085); o.connect(fl); o2.connect(fl); fl.connect(gn); gn.connect(p); p.connect(A.out);
          o.start(t); o2.start(t); o.stop(t + 0.12); o2.stop(t + 0.12);
        }
      }, 0.12);
      const fy = f => 346 - (Math.log2(f / F0) + 1) / 2 * 58;
      return (t) => {
        const T = A.time(t), M = L.p.mach;
        if (M * CS !== segs[segs.length - 1].v) { const q = segs[segs.length - 1]; segs.push({ T0: T, s0: q.s0 + (T - q.T0) * q.v, v: M * CS }); if (segs.length > 4 && segs[1].T0 < T - 4) segs.splice(0, 1); }
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(244,239,230,0.06)'; g.fillRect(0, TY - 1, W, 2);
        // wavefronts, brightest where they cross the listener
        g.lineWidth = 1.4;
        for (let k = Math.ceil((T - 3.2) * FB); k <= Math.floor(T * FB); k++) {
          const e = emit(k), r = (T - k / FB) * CS; if (r > 760) continue;
          const near = Math.max(0, 1 - Math.abs(r - e.d) / 10);
          g.strokeStyle = near > 0 ? `rgba(43,196,230,${0.4 + 0.6 * near})` : `rgba(${e.f > F0 ? '255,176,32' : '122,92,255'},${0.6 * (1 - r / 760)})`; g.lineWidth = 1.2 + 1.6 * near;
          g.beginPath(); g.arc(e.x, TY, r, 0, TAU); g.stroke();
        }
        const sx = xs(T);
        const tr = g.createLinearGradient(sx - 90, 0, sx, 0); tr.addColorStop(0, 'rgba(255,90,54,0)'); tr.addColorStop(1, 'rgba(255,90,54,0.6)');
        g.fillStyle = tr; g.fillRect(sx - 90, TY - 2, 90, 4);
        const pulse = Math.exp(-((T * FB) % 1) / FB * 30);
        g.fillStyle = 'rgba(255,90,54,0.3)'; g.beginPath(); g.arc(sx, TY, 13 + 6 * pulse, 0, TAU); g.fill();
        g.fillStyle = C.coral; g.beginPath(); g.arc(sx, TY, 8, 0, TAU); g.fill();
        // listener: last beep that has arrived
        let kl = Math.floor(T * FB); while (emit(kl).ta > T) kl--; const last = emit(kl), since = T - last.ta, fl = Math.exp(-since * 14), fNow = last.f;
        g.strokeStyle = `rgba(43,196,230,${0.3 + 0.7 * fl})`; g.lineWidth = 2; g.beginPath(); g.arc(LX, LY, 12 + 8 * fl, 0, TAU); g.stroke();
        g.fillStyle = C.cyan; g.beginPath(); g.arc(LX, LY, 6, 0, TAU); g.fill();
        g.font = '600 15px Bahnschrift, Segoe UI'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = C.cream; g.fillText(`hears ${Math.round(fNow)} Hz`, LX + 26, LY - 2);
        g.font = '500 11px Cascadia Mono, Consolas'; g.fillStyle = fNow > F0 ? C.amber : C.violet; g.fillText(fNow > F0 ? 'approaching: higher' : 'leaving: lower', LX + 26, LY + 15);
        // strip chart of heard beeps, last 6 s
        g.fillStyle = 'rgba(29,27,58,0.5)'; g.beginPath(); g.roundRect(14, 280, W - 28, 72, 8); g.fill();
        g.strokeStyle = 'rgba(244,239,230,0.3)'; g.lineWidth = 1; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(60, fy(F0)); g.lineTo(W - 24, fy(F0)); g.stroke(); g.setLineDash([]);
        g.fillStyle = 'rgba(244,239,230,0.5)'; g.textBaseline = 'alphabetic'; g.fillText('440 Hz', 20, fy(F0) + 4); g.fillText('880', 20, fy(F0 * 2) + 9); g.fillText('220', 20, fy(F0 / 2) - 1);
        const PX1 = W - 30, pps = (PX1 - 64) / 6;
        g.strokeStyle = 'rgba(255,176,32,0.45)'; g.lineWidth = 1.5; g.beginPath(); let pen = false;
        let px0 = 1e9; for (let k = Math.floor((T - 6 - 3.5) * FB); k <= kl; k++) { const e = emit(k), wrap = e.x < px0; px0 = e.x; if (e.ta < T - 6) continue; const x = PX1 - (T - e.ta) * pps, y = fy(e.f); if (pen && !wrap) g.lineTo(x, y); else g.moveTo(x, y); pen = true; }
        g.stroke();
        for (let k = Math.floor((T - 6 - 3.5) * FB); k <= kl; k++) { const e = emit(k); if (e.ta < T - 6) continue; const x = PX1 - (T - e.ta) * pps, y = fy(e.f), nw = k === kl ? fl : 0; g.fillStyle = e.f > F0 ? C.amber : C.violet; g.beginPath(); g.arc(x, y, 2.4 + 3 * nw, 0, TAU); g.fill(); }
        g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', 18, 24);
        g.textAlign = 'right'; g.fillText(`Mach ${M.toFixed(2)}   emits ${F0} Hz, ${FB} beeps/s`, W - 18, 24); g.textAlign = 'left';
      };
    },
  });

  // ---------- 6. Falling notes ----------
  // Bach, Prelude in C major BWV 846, bars 1 to 8 (public domain): five chord tones per bar, broken the same way twice.
  const BACH6 = [[60, 64, 67, 72, 76], [60, 62, 69, 74, 77], [59, 62, 67, 74, 77], [60, 64, 67, 72, 76], [60, 64, 69, 76, 81], [60, 62, 66, 69, 74], [59, 62, 67, 74, 79], [59, 60, 64, 67, 72]];
  const NOTES6 = []; // { m: MIDI, s: start, d: length (sixteenths), h: hand 0 left 1 right }
  BACH6.forEach((ch, bar) => { for (let half = 0; half < 2; half++) { const b0 = bar * 16 + half * 8; NOTES6.push({ m: ch[0], s: b0, d: 8, h: 0 }, { m: ch[1], s: b0 + 1, d: 7, h: 0 }); [2, 3, 4, 2, 3, 4].forEach((c, i) => NOTES6.push({ m: ch[c], s: b0 + 2 + i, d: 1, h: 1 })); } });
  const LOOP6 = 128, LO6 = 48, HI6 = 84, isBlack = m => [1, 3, 6, 8, 10].includes(m % 12);
  EX.add({
    cat: 'audio', id: 'au2-pianoroll', title: 'Falling-notes piano', aka: 'Synthesia view, piano roll, MIDI visualizer, piano tutorial', tool: 'Web Audio API (PeriodicWave piano) + Canvas 2D', runs: 'CPU',
    notice: 'The first eight bars of Bach\'s Prelude in C fall toward a three-octave keyboard, and each bar touches its key at the exact moment its note sounds. The key goes down and lights, sparks jump off the hit, and the bar drains into the key while the note rings (left hand violet, right hand coral). The piano is synthesized: a harmonic wave through a closing low-pass filter.',
    use: 'piano tutorials, music education, MIDI-driven music videos, satisfying loops',
    params: [
      { key: 'bpm', label: 'Tempo (BPM)', min: 40, max: 110, step: 2, value: 66 },
      { key: 'fall', label: 'Fall speed (px/s)', min: 70, max: 320, step: 10, value: 150 },
    ],
    prompt: 'Falling-notes piano video (Synthesia style) for Bach\'s Prelude in C, bars 1 to 8, at {bpm} BPM: a three-octave keyboard (C3 to C6) at the bottom, rounded note bars falling at {fall} px/s so each one lands on its key exactly when the note plays; the key presses down and glows, sparks jump from the hit, and the bar drains into the key while it sounds. Left hand violet, right hand coral, dark background with faint lanes at every C. Synthesize the piano with Web Audio: a PeriodicWave with falling harmonics, a low-pass filter that closes after the strike, and a soft hammer click.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), KY = 292, NW = 22, WW = W / NW, keys = [];
      // Key geometry: white keys tile the width, black keys sit on the seams.
      let wi = 0; for (let m = LO6; m <= HI6; m++) { if (isBlack(m)) keys[m] = { x: wi * WW - WW * 0.3, w: WW * 0.6, b: true }; else { keys[m] = { x: wi * WW, w: WW, b: false }; wi++; } }
      const NN = NOTES6.length;
      let ph0 = 0, T0 = 0, BPM = L.p.bpm;
      const S16 = () => 60 / BPM / 4;
      const pos = T => ph0 + (T - T0) / S16(); // musical position in sixteenths
      let wave = null;
      const A = clock(L, (A, a, b) => {
        const ac = A.ac;
        if (!wave || wave.ac !== ac) { const n = 12, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) im[k] = Math.pow(0.62, k - 1) * (k % 2 ? 1 : 0.7); wave = { ac, w: ac.createPeriodicWave(re, im) }; }
        const pa = pos(a), pb = pos(b), k0 = Math.floor(pa / LOOP6);
        for (let k = k0; k * LOOP6 < pb; k++) for (let i = 0; i < NN; i++) {
          const q = NOTES6[i], s = k * LOOP6 + q.s; if (s < pa || s >= pb) continue;
          const t = A.at(T0 + (s - ph0) * S16()), f = mtof(q.m), o = ac.createOscillator(), fl = ac.createBiquadFilter(), gn = ac.createGain(), p = ac.createStereoPanner();
          const ring = Math.max(0.6, 2.6 - (q.m - 48) * 0.05), off = t + Math.max(q.d * S16(), 0.25) + 0.35, end = Math.min(t + ring, off);
          o.setPeriodicWave(wave.w); o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 9, t); fl.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.6);
          p.pan.value = (q.m - 66) / 30; gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(q.h ? 0.16 : 0.2, t + 0.006); gn.gain.exponentialRampToValueAtTime(0.03, t + ring * 0.6); gn.gain.setTargetAtTime(0.0001, end, 0.08);
          o.connect(fl); fl.connect(gn); gn.connect(p); p.connect(A.out); o.start(t); o.stop(end + 0.5);
          V.noise(A, T0 + (s - ph0) * S16(), f * 4, 'bandpass', 0.05, 0.02, 2);
        }
      }, 0.22);
      const rr = EX.rng(3), spark = []; for (let i = 0; i < 6 * NN; i++) spark.push(rr());
      const COL = [[122, 92, 255], [255, 90, 54]], lit = new Float32Array(HI6 + 1), litH = new Int8Array(HI6 + 1);
      return (t) => {
        const T = A.time(t);
        if (L.p.bpm !== BPM) { ph0 = pos(T); T0 = T; BPM = L.p.bpm; }
        const p = pos(T), sp = S16(), pxs = L.p.fall * sp; // pixels per sixteenth
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        for (let m = LO6; m <= HI6; m += 12) { g.fillStyle = 'rgba(244,239,230,0.05)'; g.fillRect(keys[m].x, 0, 1, KY); }
        lit.fill(0);
        const k0 = Math.floor((p - KY / pxs - 16) / LOOP6), k1 = Math.floor((p + KY / pxs) / LOOP6);
        // note bars (black-key notes last so they sit on top)
        for (let pass = 0; pass < 2; pass++) for (let k = k0; k <= k1; k++) for (let i = 0; i < NN; i++) {
          const q = NOTES6[i]; if (isBlack(q.m) !== (pass === 1)) continue;
          const s = k * LOOP6 + q.s, e = s + q.d, kk = keys[q.m];
          if (e < p || (s - p) * pxs > KY) continue;
          const yb = KY - (s - p) * pxs, yt = KY - (e - p) * pxs, y0 = Math.max(0, yt), y1 = Math.min(KY, yb), c = COL[q.h];
          if (p >= s) { lit[q.m] = Math.max(lit[q.m], 1 - Math.min(1, (p - s) * sp / 0.6) * 0.5); litH[q.m] = q.h; }
          if (y1 - y0 < 1) continue;
          g.fillStyle = `rgba(${c},${p >= s ? 1 : 0.85})`; g.beginPath(); g.roundRect(kk.x + 2, y0, kk.w - 4, y1 - y0, Math.min(5, (y1 - y0) / 2)); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(kk.x + 4, y0 + 2, 2, Math.max(0, y1 - y0 - 4));
        }
        // sparks from hits in the last 0.5 s
        for (let k = k0; k <= k1; k++) for (let i = 0; i < NN; i++) {
          const q = NOTES6[i], s = k * LOOP6 + q.s, age = (p - s) * sp; if (age < 0 || age > 0.5) continue;
          const kk = keys[q.m], cx = kk.x + kk.w / 2, c = COL[q.h];
          if (age < 0.22) { g.fillStyle = `rgba(255,240,225,${0.5 * (1 - age / 0.22)})`; g.beginPath(); g.ellipse(cx, KY, kk.w * (0.6 + age * 3), 7 + age * 30, 0, Math.PI, TAU); g.fill(); }
          for (let j = 0; j < 6; j++) { const r = spark[(i * 6 + j)], a = -Math.PI * (0.12 + 0.76 * r), v = 90 + 160 * spark[(i * 6 + (j + 3) % 6)]; const x = cx + Math.cos(a) * v * age, y = KY + Math.sin(a) * v * age + 300 * age * age, z = 4 * (1 - age * 1.6); if (z <= 0) continue; g.fillStyle = j % 2 ? `rgba(${c},${1 - age * 2})` : `rgba(255,236,214,${1 - age * 2})`; g.fillRect(x - z / 2, y - z / 2, z, z); }
        }
        for (let m = LO6; m <= HI6; m++) if (lit[m]) { const kk = keys[m], c = COL[litH[m]], gr = g.createLinearGradient(0, KY - 70, 0, KY); gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(1, `rgba(${c},${0.45 * lit[m]})`); g.fillStyle = gr; g.fillRect(kk.x - 6, KY - 70, kk.w + 12, 70); }
        g.fillStyle = 'rgba(255,90,54,0.35)'; g.fillRect(0, KY - 2, W, 2);
        // keyboard: whites then blacks; pressed keys dip and glow
        for (const pass of [false, true]) for (let m = LO6; m <= HI6; m++) {
          const kk = keys[m]; if (kk.b !== pass) continue; const on = lit[m], dip = on ? 2 : 0, c = COL[litH[m]];
          if (!kk.b) { g.fillStyle = on ? `rgb(${c.map(v => Math.round(244 + (v - 244) * on * 0.8)).join(',')})` : C.cream; g.fillRect(kk.x + 0.5, KY + dip, kk.w - 1, H - KY - 4); }
          else { g.fillStyle = on ? `rgb(${c.join(',')})` : '#1b1a24'; g.fillRect(kk.x, KY + dip, kk.w, 40); }
        }
        const top = g.createLinearGradient(0, 0, 0, 48); top.addColorStop(0, 'rgba(11,11,16,0.95)'); top.addColorStop(1, 'rgba(11,11,16,0)'); g.fillStyle = top; g.fillRect(0, 0, W, 48);
        g.font = '500 12px Cascadia Mono, Consolas'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(244,239,230,0.55)';
        g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', 14, 22);
        g.textAlign = 'right'; g.fillText(`J. S. Bach  Prelude in C  bar ${Math.floor((p % LOOP6 + LOOP6) % LOOP6 / 16) + 1} of 8`, W - 14, 22); g.textAlign = 'left';
      };
    },
  });

  // ---------- 7. Vinyl scratch ----------
  const SR7 = 32000, BEAT7 = 0.625, LOOP7 = 8 * BEAT7, LN7 = Math.round(LOOP7 * SR7);
  // The routine as [beat, record position in seconds]: the hand moves the record between keys with a cosine ease.
  const K7 = /** @type {[number, number][]} */ ([[0, 0], [0.75, 0.6], [1, 0], [1.25, 0.22], [1.5, 0], [1.75, 0.22], [2, 0], [2.5, 0.42], [3, 0], [3.25, 0.2], [3.375, 0.12], [3.5, 0.34], [4, 0], [4.75, 0.6], [5, 0], [5.5, 0.3],
    [5.625, 0.24], [5.75, 0.3], [5.875, 0.24], [6, 0.3], [6.125, 0.24], [6.25, 0.3], [6.375, 0.24], [6.5, 0.3], [7, 0], [7.25, 0.3], [7.5, 0], [7.75, 0.3], [8, 0]]);
  const GATE7 = [[0.75, 1], [2.125, 2.25], [2.375, 2.5], [2.5, 3], [4.75, 5], [7.25, 7.5], [7.75, 8]];
  const NAME7 = /** @type {[number, string][]} */ ([[0, 'forward'], [1, 'baby scratch'], [2, 'transformer'], [3, 'tear'], [4, 'forward'], [5, 'drag'], [5.5, 'scribble'], [6.5, 'drag back'], [7, 'chirp']]);
  const pos7 = b => { b -= Math.floor(b / 8) * 8; let i = 0; while (i < K7.length - 2 && K7[i + 1][0] <= b) i++; const [b0, p0] = K7[i], [b1, p1] = K7[i + 1], u = (b - b0) / (b1 - b0); return p0 + (p1 - p0) * (0.5 - 0.5 * Math.cos(Math.PI * u)); };
  const cut7 = b => { b -= Math.floor(b / 8) * 8; return GATE7.some(([s, e]) => b >= s && b < e); };
  // The record: a sung "ahh" made by additive synthesis, harmonics weighted by three vowel formants.
  function vowel7() {
    const n = Math.round(0.72 * SR7), out = new Float32Array(n), ph = new Float64Array(24), F = [[800, 90, 1], [1150, 110, 0.5], [2900, 160, 0.25]];
    for (let i = 0; i < n; i++) {
      const t = i / SR7, f0 = 235 - 45 * Math.min(1, t / 0.6) + 3 * Math.sin(t * 34), e = Math.min(1, t / 0.02) * Math.min(1, (0.72 - t) / 0.15); let s = 0;
      for (let h = 1; h <= 24; h++) { const fh = h * f0; if (fh > 4500) break; ph[h - 1] += TAU * fh / SR7; let a = 0; for (const [fc, bw, gn] of F) a += gn / (1 + ((fh - fc) / bw) ** 2); s += a * Math.sin(ph[h - 1]); }
      out[i] = s * e * 0.32 + (Math.random() - 0.5) * 0.03 * e;
    }
    return out;
  }
  EX.add({
    cat: 'audio', id: 'au2-scratch', title: 'Vinyl scratch routine', aka: 'turntablism, DJ scratching, TTM scratch notation, crossfader cuts', tool: 'Web Audio API (rendered AudioBuffer + gain automation) + Canvas 2D', runs: 'CPU',
    notice: 'A two-bar scratch routine over a boom-bap beat: forward, baby, transformer, tear, scribble and chirp. The record angle is the sample position, and the scratched audio is rendered from that same position curve, so the vinyl, the needle on the waveform and the sound cannot drift apart. The graph on the right is scratch notation: time across, record position up, dim where the crossfader cuts the sound.',
    use: 'music videos, DJ tutorials, explaining scratching, audio-reactive social clips',
    params: [{ key: 'cuts', label: 'Crossfader cuts (0 off, 1 on)', min: 0, max: 1, step: 1, value: 1 }],
    prompt: 'Vinyl scratch explainer: a top-down turntable with a spinning record, grooves, a coral label and a sticker that shows the angle, beside scratch notation (time across, record position up). Write the routine as keyframes of record position per beat at 96 BPM (forward, baby, transformer, tear, scribble, chirp) with cosine easing, make the record a synthesized "ahh", and render the scratched audio by reading the sample at that position curve, so the platter angle equals the sample position. Loop it with a boom-bap beat, apply crossfader cuts live with gain automation (cuts {cuts}), and show the technique name, a needle on the waveform and the crossfader knob.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), CX = 196, CY = 186, R = 150, src = vowel7(), GX = 392, GW = 234;
      // Waveform envelope for the strip, and the static notation graph (redrawn when cuts change).
      const envw = new Float32Array(GW); for (let i = 0; i < GW; i++) { let m = 0; const a = Math.floor(i / GW * src.length), b2 = Math.floor((i + 1) / GW * src.length); for (let j = a; j < b2; j++) m = Math.max(m, Math.abs(src[j])); envw[i] = m; }
      const graph = document.createElement('canvas'); graph.width = GW; graph.height = 118; const gg = graph.getContext('2d'); let drawnCuts = -1;
      const gy = p => 108 - p / 0.65 * 96;
      const drawGraph = () => {
        drawnCuts = L.p.cuts; gg.clearRect(0, 0, GW, 118); gg.fillStyle = 'rgba(29,27,58,0.6)'; gg.fillRect(0, 0, GW, 118);
        for (let b = 0; b <= 8; b++) { gg.fillStyle = b % 4 ? 'rgba(244,239,230,0.08)' : 'rgba(244,239,230,0.22)'; gg.fillRect(b / 8 * (GW - 1), 0, 1, 118); }
        gg.lineWidth = 2; gg.lineJoin = 'round';
        for (let i = 0; i < GW; i++) { const b = i / GW * 8, b2 = (i + 1) / GW * 8, off = drawnCuts && cut7(b); gg.strokeStyle = off ? 'rgba(244,239,230,0.18)' : C.coral; gg.beginPath(); gg.moveTo(i, gy(pos7(b))); gg.lineTo(i + 1, gy(pos7(b2))); gg.stroke(); }
      };
      const vinyl = g.createConicGradient(0.6, CX, CY); [[0, 0.0], [0.08, 0.07], [0.16, 0], [0.5, 0], [0.58, 0.06], [0.66, 0], [1, 0]].forEach(([s, a]) => vinyl.addColorStop(s, `rgba(255,255,255,${a})`));
      let rig = null;
      const A = clock(L, (A, a, b) => {
        const ac = A.ac;
        if (!rig || rig.ac !== ac) {
          // Render one loop of the scratched record and one of the beat; both loop sample-locked from the same start.
          const sc = new Float32Array(LN7), dr = new Float32Array(LN7);
          for (let n = 0; n < LN7; n++) { const x = pos7(n / SR7 / BEAT7) * SR7, i = Math.floor(x), f = x - i; sc[n] = i + 1 < src.length ? src[i] * (1 - f) + src[i + 1] * f : 0; }
          const add = (st, fn, len) => { const s0 = Math.round(st * BEAT7 / 4 * SR7); for (let n = 0; n < len * SR7 && s0 + n < LN7; n++) dr[s0 + n] += fn(n / SR7); };
          let ph = 0; const kick = t => { ph += TAU * (45 + 90 * Math.exp(-t * 28)) / SR7; return Math.sin(ph) * Math.exp(-t * 7) * 0.9; };
          [0, 7, 10, 16, 23, 26].forEach(s => { ph = 0; add(s, kick, 0.4); });
          let lp = 0; [4, 12, 20, 28].forEach(s => add(s, t => { const nz = Math.random() * 2 - 1; lp += 0.5 * (nz - lp); return ((nz - lp) * 0.8 + Math.sin(TAU * 185 * t) * 0.4) * Math.exp(-t * 18) * 0.6; }, 0.25));
          for (let s = 0; s < 32; s += 2) add(s, t => { const nz = Math.random() * 2 - 1; lp += 0.85 * (nz - lp); return (nz - lp) * Math.exp(-t * (s % 8 === 6 ? 14 : 60)) * 0.22; }, 0.2);
          const mk = data => { const buf = ac.createBuffer(1, LN7, SR7); buf.getChannelData(0).set(data); const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; return s; };
          const s1 = mk(sc), s2 = mk(dr), fader = ac.createGain(), t = A.at(a), off = a - Math.floor(a / LOOP7) * LOOP7;
          s1.connect(fader); fader.connect(A.out); s2.connect(A.out); s1.start(t, off); s2.start(t, off);
          rig = { ac, fader };
        }
        for (let k = Math.floor(a / LOOP7); k * LOOP7 < b; k++) for (const [s, e] of GATE7) {
          const ts = k * LOOP7 + s * BEAT7, te = k * LOOP7 + e * BEAT7;
          if (ts >= a && ts < b && L.p.cuts) rig.fader.gain.setTargetAtTime(0, A.at(ts), 0.003);
          if (te >= a && te < b) rig.fader.gain.setTargetAtTime(1, A.at(te), 0.003);
        }
      }, 0.12);
      return (t) => {
        const T = A.time(t), b = T / BEAT7, p = pos7(b), th = p * 0.555 * TAU, off = L.p.cuts && cut7(b), bl = b - Math.floor(b / 8) * 8;
        if (drawnCuts !== L.p.cuts) drawGraph();
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        // deck, platter and record
        g.fillStyle = '#17161f'; g.beginPath(); g.roundRect(26, 16, 360, 330, 14); g.fill();
        g.fillStyle = '#26252f'; g.beginPath(); g.arc(CX, CY, R + 6, 0, TAU); g.fill();
        g.fillStyle = '#0d0d12'; g.beginPath(); g.arc(CX, CY, R, 0, TAU); g.fill();
        g.lineWidth = 1; for (let r = 60; r < R - 3; r += 3.6) { g.strokeStyle = `rgba(255,255,255,${r % 7.2 < 3.6 ? 0.035 : 0.02})`; g.beginPath(); g.arc(CX, CY, r, 0, TAU); g.stroke(); }
        g.fillStyle = vinyl; g.beginPath(); g.arc(CX, CY, R, 0, TAU); g.fill();
        g.save(); g.translate(CX, CY); g.rotate(th);
        g.fillStyle = C.coral; g.beginPath(); g.arc(0, 0, 54, 0, TAU); g.fill();
        g.fillStyle = C.bg; g.font = '700 15px Bahnschrift, Segoe UI'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MOTION', 0, -16); g.font = '500 10px Cascadia Mono, Consolas'; g.fillText('STUDIO  96 BPM', 0, 18);
        g.fillStyle = C.cream; g.fillRect(-3, -R + 8, 6, 44);
        g.fillStyle = 'rgba(244,239,230,0.85)'; g.beginPath(); g.arc(0, -R + 62, 11, 0, TAU); g.fill(); g.strokeStyle = 'rgba(11,11,16,0.4)'; g.lineWidth = 2; g.stroke();
        g.restore();
        g.fillStyle = '#c9c4bb'; g.beginPath(); g.arc(CX, CY, 5, 0, TAU); g.fill();
        g.strokeStyle = '#b8b3aa'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(352, 48); g.lineTo(344, 200); g.lineTo(300, 262); g.stroke();
        g.fillStyle = '#d8d3ca'; g.beginPath(); g.arc(352, 48, 13, 0, TAU); g.fill(); g.save(); g.translate(300, 262); g.rotate(0.95); g.fillRect(-8, -5, 22, 12); g.restore();
        // technique name, notation, waveform, crossfader
        let nm = NAME7[0][1]; for (const [s, n] of NAME7) if (bl >= s) nm = n;
        g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)';
        g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', GX, 30);
        g.font = '700 30px Bahnschrift, Segoe UI'; g.fillStyle = C.cream; g.fillText(nm, GX, 68);
        g.drawImage(graph, GX, 84);
        const hx = GX + bl / 8 * GW; g.fillStyle = 'rgba(244,239,230,0.5)'; g.fillRect(hx, 84, 1.5, 118);
        g.fillStyle = off ? 'rgba(244,239,230,0.4)' : C.amber; g.beginPath(); g.arc(hx, 84 + gy(p), 5, 0, TAU); g.fill();
        g.font = '500 10px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.45)'; g.fillText('record position', GX + 4, 96); g.fillText('bar 1', GX + 4, 214); g.fillText('bar 2', GX + GW / 2 + 4, 214);
        g.fillStyle = 'rgba(29,27,58,0.6)'; g.fillRect(GX, 224, GW, 44);
        for (let i = 0; i < GW; i++) { const h = envw[i] * 40; g.fillStyle = i / GW * 0.72 <= p ? 'rgba(255,90,54,0.75)' : 'rgba(244,239,230,0.25)'; g.fillRect(GX + i, 246 - h / 2, 1, Math.max(1, h)); }
        const nx = GX + Math.min(1, p / 0.72) * GW; g.fillStyle = C.cream; g.fillRect(nx - 1, 220, 2, 52);
        g.fillStyle = 'rgba(244,239,230,0.12)'; g.beginPath(); g.roundRect(GX, 292, GW, 8, 4); g.fill();
        const kx = GX + (off ? 16 : GW - 16); g.fillStyle = off ? '#6b6773' : C.cyan; g.beginPath(); g.roundRect(kx - 14, 284, 28, 24, 5); g.fill();
        g.font = '500 10px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.45)'; g.fillText('crossfader: ' + (off ? 'cut' : 'open'), GX, 326);
        for (let i = 0; i < 8; i++) { g.fillStyle = Math.floor(bl) === i ? C.amber : 'rgba(244,239,230,0.15)'; g.beginPath(); g.arc(GX + 140 + i * 12, 322, 4, 0, TAU); g.fill(); }
      };
    },
  });

  // ---------- 8. Talking formant synth ----------
  // Phoneme specs: formants F1 F2 F3, voiced level, noise level, noise center.
  const PH8 = /** @type {Record<string, number[]>} */ ({
    a: [750, 1200, 2500, 1, 0, 0], e: [550, 1800, 2500, 1, 0, 0], i: [300, 2300, 3000, 1, 0, 0], o: [480, 850, 2400, 1, 0, 0], u: [330, 800, 2300, 1, 0, 0],
    m: [250, 1100, 2300, 0.3, 0, 0], n: [250, 1700, 2500, 0.3, 0, 0], l: [350, 1100, 2700, 0.6, 0, 0], r: [450, 1250, 1700, 0.7, 0, 0],
    h: [600, 1500, 2500, 0, 0.3, 1800], s: [400, 1800, 2600, 0, 0.4, 6500], z: [400, 1800, 2600, 0.25, 0.3, 6000], sh: [400, 1800, 2600, 0, 0.4, 3000],
    v: [400, 1500, 2500, 0.3, 0.25, 5000], d: [300, 1700, 2600, 0, 0, 0], p: [300, 1000, 2400, 0, 0, 0], _: [500, 1500, 2500, 0, 0, 0],
  });
  const WORDS8 = [['Hello!', 'h .07 0|e .09 178|l .07 165|o .22 135|_ .2 0'], ['I', 'a .12 160|i .1 170|_ .04 0'], ['am', 'a .1 150|m .14 140|_ .1 0'], ['Motion.', 'm .08 165|o .15 188|sh .1 0|a .07 140|n .14 120|_ .34 0'],
    ['Every', 'e .11 178|v .06 165|r .06 160|i .1 155'], ['sound', 's .12 0|a .1 172|u .08 165|n .06 150|d .05 0|_ .06 0'], ['has', 'h .06 0|a .12 150|z .1 140|_ .03 0'], ['a', 'a .08 140'], ['shape.', 'sh .12 0|e .15 168|i .06 150|p .08 0|_ .95 0']];
  const SEQ8 = []; let t8 = 0, f8 = 150; // { p: phoneme, s: start, d: length, f: pitch target, w: word index }
  WORDS8.forEach(([, ph], w) => ph.split('|').forEach(tok => { const [p, d, f] = tok.split(' '); if (+f) f8 = +f; SEQ8.push({ p, s: t8, d: +d, f: f8, w }); t8 += +d; }));
  const LOOP8 = t8, VOW8 = /** @type {[string, number, number, string][]} */ ([['i', 300, 2300, 'see'], ['e', 550, 1850, 'bed'], ['a', 750, 1200, 'father'], ['o', 480, 850, 'go'], ['u', 330, 800, 'too']]);
  EX.add({
    cat: 'audio', id: 'au2-formants', title: 'Talking formant synth', aka: 'speech synthesis, vowel chart, formants, spectrogram of a voice', tool: 'Web Audio API (sawtooth, three band-pass filters, noise) + Canvas 2D', runs: 'CPU',
    notice: 'A voice made of one buzzing sawtooth and three band-pass filters speaks a line, plus filtered noise for the hiss sounds. Vowels are just positions of the two lowest filter peaks, so on the vowel chart a dot glides between see, bed, father, go and too as the voice talks, and on the spectrogram the same peaks show up as bright bands with their tracks drawn on top. Make the glide slower and the speech slurs.',
    use: 'speech and phonetics teaching, robot and creature voices, explaining how voices and vowels work',
    params: [
      { key: 'glide', label: 'Formant glide (ms)', min: 5, max: 120, step: 5, value: 25, unit: ' ms' },
      { key: 'pitch', label: 'Voice pitch', min: 0.6, max: 1.8, step: 0.05, value: 1 },
    ],
    prompt: 'Talking formant synthesizer with a live picture: speak "Hello! I am Motion. Every sound has a shape." phoneme by phoneme with Web Audio (a sawtooth at pitch x{pitch} through three band-pass filters set to each phoneme\'s formants, gliding over {glide}; band-passed noise for h, s, sh, v; a falling intonation). Left: an F1/F2 vowel chart (front vowels left, open vowels low) with landmarks for see, bed, father, go, too and a glowing dot with a trail at the current formants, a ring for hiss sounds. Right: a scrolling spectrogram (0 to 4 kHz) with the three formant tracks drawn over it. Below: the sentence with the current word lit.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), N8 = SEQ8.length, SPX = 352, SPY = 44, SPW = 272, SPH = 240, PXS = 110, FMAX = 4200;
      const at = u => { let i = N8 - 1; while (i > 0 && SEQ8[i].s > u) i--; return i; };
      // Value of spec column j at loop time u, gliding from the previous phoneme with time constant tc (the same curve the audio follows).
      const val = (u, j, tc) => { const i = at(u), q = SEQ8[i], pv = SEQ8[(i + N8 - 1) % N8], a = PH8[q.p][j], b = PH8[pv.p][j]; return a + (b - a) * Math.exp(-(u - q.s) / tc); };
      const f0At = u => { const i = at(u), q = SEQ8[i], pv = SEQ8[(i + N8 - 1) % N8]; return (q.f + (pv.f - q.f) * Math.exp(-(u - q.s) / 0.03)) * L.p.pitch; };
      const loopU = T => T - Math.floor(T / LOOP8) * LOOP8;
      const X = f2 => 34 + (2600 - f2) / 1950 * 280, Y = f1 => 70 + (f1 - 220) / 600 * 200;
      const spec = document.createElement('canvas'); spec.width = SPW; spec.height = SPH; const sg = spec.getContext('2d'), col = sg.createImageData(1, SPH), cd = new Uint32Array(col.data.buffer), bins = new Uint8Array(1024);
      const LUT = new Uint32Array(256); for (let i = 0; i < 256; i++) { const [r, gg, b] = ramp(['#15142a', '#3a2a7a', '#ff5a36', '#ffb020', '#f4efe6'], i / 255); LUT[i] = (255 << 24 | b << 16 | gg << 8 | r) >>> 0; }
      sg.fillStyle = '#15142a'; sg.fillRect(0, 0, SPW, SPH);
      let voice = null, lastT = -1, acc = 0;
      const A = clock(L, (A, a, b) => {
        const ac = A.ac;
        if (!voice || voice.ac !== ac) {
          const o = ac.createOscillator(), vg = ac.createGain(), nz = ac.createBufferSource(), nf = ac.createBiquadFilter(), ng = ac.createGain();
          const fs = [0, 1, 2].map(k => { const f = ac.createBiquadFilter(), fg = ac.createGain(); f.type = 'bandpass'; f.Q.value = 7 + k * 3; fg.gain.value = [1.7, 1, 0.5][k]; o.connect(f); f.connect(fg); fg.connect(vg); return f; });
          o.type = 'sawtooth'; o.frequency.value = 150; vg.gain.value = 0; vg.connect(A.out); nz.buffer = noiseOf(A); nz.loop = true; nf.type = 'bandpass'; nf.Q.value = 1.2; ng.gain.value = 0; nz.connect(nf); nf.connect(ng); ng.connect(A.out); o.start(); nz.start();
          voice = { ac, o, vg, fs, nf, ng };
        }
        for (let k = Math.floor(a / LOOP8); k * LOOP8 < b; k++) for (const q of SEQ8) {
          const T = k * LOOP8 + q.s; if (T < a || T >= b) continue;
          const t = A.at(T), sp = PH8[q.p];
          voice.fs.forEach((fl, j) => fl.frequency.setTargetAtTime(sp[j], t, L.p.glide / 1000));
          voice.o.frequency.setTargetAtTime(q.f * L.p.pitch, t, 0.03);
          voice.vg.gain.setTargetAtTime(sp[3] * 0.5, t, 0.012);
          voice.ng.gain.setTargetAtTime(sp[4] * 0.6, t, 0.012); if (sp[5]) voice.nf.frequency.setValueAtTime(sp[5], t);
          if (q.p === 'p' || q.p === 'd') V.noise(A, T + q.d * 0.7, q.p === 'p' ? 1200 : 3500, 'bandpass', 0.35, 0.03, 1);
        }
      }, 0.15);
      // One spectrogram column at time T: the live analyser, or the same spectrum rebuilt from the phoneme script.
      function column(T) {
        const u = loopU(T), tc = L.p.glide / 1000, v = val(u, 3, 0.012), nz = val(u, 4, 0.012), nf = PH8[SEQ8[at(u)].p][5] || 3000, f0 = f0At(u), F = [val(u, 0, tc), val(u, 1, tc), val(u, 2, tc)];
        if (A.live) { A.an.getByteFrequencyData(bins); const k = 1024 / (A.ac.sampleRate / 2); for (let r = 0; r < SPH; r++) { const f = FMAX * (1 - r / SPH), b = f * k, j = b | 0; cd[r] = LUT[Math.min(255, (bins[j] * (1 - b + j) + bins[j + 1] * (b - j)) * 1.15 | 0)]; } }
        else for (let r = 0; r < SPH; r++) {
          const f = FMAX * (1 - r / SPH), d = f - Math.round(f / f0) * f0, e = 1 / (1 + ((f - F[0]) / 90) ** 2) + 0.6 / (1 + ((f - F[1]) / 120) ** 2) + 0.3 / (1 + ((f - F[2]) / 160) ** 2);
          const s = v * e * Math.exp(-((d / 22) ** 2)) * (f > f0 * 0.6 ? 1 : 0) / (1 + f / 2500) + nz * Math.exp(-(((f - nf) / 1600) ** 2)) * (0.4 + 0.6 * Math.random());
          cd[r] = LUT[Math.min(255, Math.sqrt(s) * 270 | 0)];
        }
      }
      return (t) => {
        const T = A.time(t), u = loopU(T), tc = L.p.glide / 1000, q = SEQ8[at(u)];
        // scroll the spectrogram by elapsed time, then paint the new columns
        if (lastT < 0 || T < lastT || T - lastT > 1) { sg.fillStyle = '#15142a'; sg.fillRect(0, 0, SPW, SPH); lastT = T; }
        acc += (T - lastT) * PXS; lastT = T; const n = Math.min(SPW, Math.floor(acc)); acc -= n;
        if (n > 0) { sg.globalCompositeOperation = 'copy'; sg.drawImage(spec, -n, 0); sg.globalCompositeOperation = 'source-over'; for (let k = 0; k < n; k++) { column(T - (n - 1 - k) / PXS); sg.putImageData(col, SPW - n + k, 0); } }
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        // vowel chart
        g.fillStyle = 'rgba(29,27,58,0.5)'; g.beginPath(); g.roundRect(14, 44, 322, 250, 8); g.fill();
        g.strokeStyle = 'rgba(244,239,230,0.14)'; g.setLineDash([4, 4]); g.beginPath(); VOW8.forEach(([, f1, f2], i) => { if (i) g.lineTo(X(f2), Y(f1)); else g.moveTo(X(f2), Y(f1)); }); g.closePath(); g.stroke(); g.setLineDash([]);
        g.font = '600 13px Bahnschrift, Segoe UI'; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (const [v, f1, f2, wd] of VOW8) { const on = q.p === v; g.fillStyle = on ? C.amber : 'rgba(244,239,230,0.5)'; g.fillText(v, X(f2), Y(f1) - 12); g.font = '500 9px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.35)'; g.fillText(wd, X(f2), Y(f1) + 12); g.font = '600 13px Bahnschrift, Segoe UI'; }
        g.lineCap = 'round';
        for (let k = 30; k > 0; k--) {
          const u0 = loopU(T - k * 0.02), u1 = loopU(T - (k - 1) * 0.02), v0 = val(u0, 3, 0.012); if (v0 < 0.2 || u1 < u0) continue;
          g.strokeStyle = `rgba(255,176,32,${(1 - k / 30) * 0.7 * v0})`; g.lineWidth = 2 + 4 * v0 * (1 - k / 30); g.beginPath(); g.moveTo(X(val(u0, 1, tc)), Y(val(u0, 0, tc))); g.lineTo(X(val(u1, 1, tc)), Y(val(u1, 0, tc))); g.stroke();
        }
        const vx = X(val(u, 1, tc)), vy = Y(val(u, 0, tc)), vo = val(u, 3, 0.012), nzv = val(u, 4, 0.012);
        if (vo > 0.05) { g.fillStyle = `rgba(255,176,32,${0.25 * vo})`; g.beginPath(); g.arc(vx, vy, 10 + 14 * vo, 0, TAU); g.fill(); g.fillStyle = C.cream; g.beginPath(); g.arc(vx, vy, 3 + 4 * vo, 0, TAU); g.fill(); }
        if (nzv > 0.05) { g.strokeStyle = `rgba(43,196,230,${0.4 + nzv})`; g.lineWidth = 2; g.setLineDash([2, 3]); g.beginPath(); g.arc(vx, vy, 12 + 30 * nzv, 0, TAU); g.stroke(); g.setLineDash([]); }
        const kind = q.p === '_' ? 'silence' : PH8[q.p][3] >= 0.9 ? 'vowel' : PH8[q.p][4] > 0 ? (PH8[q.p][3] > 0 ? 'buzzy hiss' : 'hiss') : PH8[q.p][3] > 0 ? 'hum or glide' : 'stop';
        g.textAlign = 'left'; g.font = '700 26px Bahnschrift, Segoe UI'; g.fillStyle = C.cream; g.fillText(q.p === '_' ? '-' : q.p, 40, 274); g.font = '500 10px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(kind, 40 + (q.p.length > 1 ? 32 : 20), 276);
        g.fillStyle = 'rgba(244,239,230,0.4)'; g.fillText('F2 (front to back)', 220, 284); g.save(); g.translate(26, 190); g.rotate(-Math.PI / 2); g.fillText('F1 (open)', 0, 0); g.restore();
        // spectrogram with formant tracks
        g.drawImage(spec, SPX, SPY); g.strokeStyle = 'rgba(244,239,230,0.18)'; g.lineWidth = 1; g.strokeRect(SPX - 0.5, SPY - 0.5, SPW + 1, SPH + 1);
        const fy = f => SPY + SPH * (1 - f / FMAX);
        for (let j = 0; j < 3; j++) {
          g.strokeStyle = ['rgba(244,239,230,0.85)', 'rgba(43,196,230,0.85)', 'rgba(122,92,255,0.9)'][j]; g.lineWidth = 1.5; g.beginPath(); let pen = false;
          for (let x = 0; x <= SPW; x += 4) { const uu = loopU(T - (SPW - x) / PXS); if (val(uu, 3, 0.012) < 0.25) { pen = false; continue; } const y = fy(val(uu, j, tc)); if (pen) g.lineTo(SPX + x, y); else g.moveTo(SPX + x, y); pen = true; }
          g.stroke(); g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillText('F' + (j + 1), SPX + SPW - 16, fy(val(u, j, tc)) - 7);
        }
        g.fillStyle = 'rgba(244,239,230,0.4)'; for (const f of [1000, 2000, 3000, 4000]) g.fillText(f / 1000 + 'k', SPX - 2 - 14, fy(f) + 3);
        // sentence
        g.font = '600 17px Bahnschrift, Segoe UI'; let x = 16; const y = 330;
        WORDS8.forEach(([wd], i) => { g.fillStyle = i === q.w && q.p !== '_' ? C.coral : i < q.w ? C.cream : 'rgba(244,239,230,0.35)'; g.fillText(wd, x, y); x += g.measureText(wd + ' ').width; });
        g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.textBaseline = 'alphabetic'; g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', 16, 26);
        g.textAlign = 'right'; g.fillText('spectrogram 0 to 4 kHz', W - 16, 26); g.textAlign = 'left';
      };
    },
  });

  // ---------- 9. Data sonification ----------
  // Hours of daylight on day d (0 = 1 January) at latitude lat, from the solar declination.
  const daylight = (lat, d) => { const dec = 23.44 * Math.PI / 180 * Math.sin(TAU * (284 + d + 1) / 365), x = -Math.tan(lat * Math.PI / 180) * Math.tan(dec); return x <= -1 ? 24 : x >= 1 ? 0 : 24 / Math.PI * Math.acos(x); };
  const CITY9 = /** @type {[string, number, string][]} */ ([['Quito 0°', 0, C.cyan], ['Madrid 40°N', 40.4, C.amber], ['Reykjavik 64°N', 64.1, C.coral]]);
  const MON9 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], EVT9 = /** @type {[number, string][]} */ ([[79, 'equinox'], [171, 'solstice'], [265, 'equinox'], [354, 'solstice']]);
  EX.add({
    cat: 'audio', id: 'au2-sonify', title: 'Data sonification', aka: 'audio graph, sonified chart, accessible data, listen to a chart', tool: 'Web Audio API (scheduled plucks, stereo panning) + Canvas 2D', runs: 'CPU',
    notice: 'A year of daylight at three latitudes, computed from the sun\'s declination, is drawn and played at the same time. Each week every city plucks a note whose pitch is its hours of daylight, panned from left to right with the date, so you hear Reykjavik swing three octaves while Quito holds one note. Equinoxes and solstices ring a bell and flag the chart.',
    use: 'accessible charts, data journalism, dashboards for screen-reader users, science explainers',
    params: [
      { key: 'sweep', label: 'Seconds per year', min: 4, max: 20, step: 1, value: 9, unit: ' s' },
      { key: 'snap', label: 'Snap pitch to a scale (0 or 1)', min: 0, max: 1, step: 1, value: 1 },
    ],
    prompt: 'Sonified line chart: hours of daylight across one year for Quito, Madrid and Reykjavik, computed from the solar declination. A playhead sweeps the year in {sweep}; each line draws itself behind it, a dot with a value label rides each line, and every week each city plucks a note whose pitch maps 0 to 24 hours onto three octaves (snap to a pentatonic scale: {snap}), panned left to right with the date. Ring a bell and flag the chart at the equinoxes and solstices. Dark background, cyan, amber and coral lines, month ticks, a legend with live values.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), X0 = 58, X1 = 610, Y0 = 62, Y1 = 300, DAYS = 365, HOLD = 1.2;
      const xd = d => X0 + (X1 - X0) * d / DAYS, yh = h => Y1 - (Y1 - Y0) * h / 24;
      const data = CITY9.map(([, lat]) => { const a = new Float32Array(DAYS + 1); for (let d = 0; d <= DAYS; d++) a[d] = daylight(lat, d); return a; });
      const midi = h => { const m = 48 + h * 1.5; if (!L.p.snap) return m; const o = Math.floor((m - 48) / 12), r = m - 48 - o * 12; let best = 0; for (const p of [0, 2, 4, 7, 9, 12]) if (Math.abs(p - r) < Math.abs(best - r)) best = p; return 48 + o * 12 + best; };
      let ph0 = 0, T0 = 0, SW = L.p.sweep;
      const cyc = () => SW + HOLD, U = T => ph0 + (T - T0) / cyc(); // U counts loops; the year runs over the first SW / cyc of each loop
      const dayAt = u => Math.min(DAYS, (u - Math.floor(u)) * cyc() / SW * DAYS);
      const A = clock(L, (A, a, b) => {
        const ua = U(a), ub = U(b), fr = SW / cyc();
        for (let k = Math.floor(ua); k <= Math.floor(ub); k++) {
          for (let w = 0; w <= 52; w++) {
            const u = k + fr * w / 52; if (u < ua || u >= ub) continue; const T = T0 + (u - ph0) * cyc(), d = w * 7;
            data.forEach((arr, i) => V.tone(A, T + i * 0.012, midi(arr[Math.min(DAYS, d)]), i === 2 ? 'square' : 'triangle', i === 2 ? 0.06 : 0.15, 0.22, i === 2 ? 1400 : 0, -0.8 + 1.6 * w / 52));
          }
          for (const [d] of EVT9) { const u = k + fr * d / DAYS; if (u >= ua && u < ub) strike(A, T0 + (u - ph0) * cyc(), 1568, 0.12, 2.2, -0.8 + 1.6 * d / DAYS, 2.76, 0.3); }
        }
      }, 0.2);
      return (t) => {
        const T = A.time(t);
        if (L.p.sweep !== SW) { ph0 = U(T); T0 = T; SW = L.p.sweep; }
        const u = U(T), d = dayAt(u), xp = xd(d), wk = Math.floor(d / 7), sinceWk = (d - wk * 7) / DAYS * SW;
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.font = '500 10px Cascadia Mono, Consolas'; g.textBaseline = 'middle'; g.textAlign = 'right';
        for (let h = 0; h <= 24; h += 6) { g.fillStyle = 'rgba(244,239,230,0.07)'; g.fillRect(X0, yh(h), X1 - X0, 1); g.fillStyle = 'rgba(244,239,230,0.4)'; g.fillText(h + ' h', X0 - 8, yh(h)); }
        g.textAlign = 'center';
        MON9.forEach((m, i) => { const x = xd(i * 30.4 + 15); g.fillStyle = 'rgba(244,239,230,0.4)'; g.fillText(m, x, Y1 + 16); });
        // event flags
        for (const [ed, nm] of EVT9) {
          if (ed > d) continue; const age = (d - ed) / DAYS * SW, fl = Math.exp(-age * 2.5), x = xd(ed);
          g.strokeStyle = `rgba(244,239,230,${0.15 + 0.6 * fl})`; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(x, Y0 - 4); g.lineTo(x, Y1); g.stroke(); g.setLineDash([]);
          g.fillStyle = `rgba(244,239,230,${0.35 + 0.65 * fl})`; g.fillText(nm, x, Y0 - 12 - 6 * fl);
        }
        // lines drawn up to the playhead, with a dot and value on each
        g.lineWidth = 2.5; g.lineJoin = 'round'; g.lineCap = 'round';
        data.forEach((arr, i) => {
          const col = CITY9[i][2]; g.strokeStyle = col; g.beginPath(); for (let k = 0; k <= Math.floor(d); k += 2) { const x = xd(k), y = yh(arr[k]); if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.lineTo(xp, yh(arr[Math.floor(d)])); g.stroke();
          const y = yh(arr[Math.floor(d)]), pl = Math.exp(-sinceWk * 9);
          g.globalAlpha = 0.3 * pl; g.fillStyle = col; g.beginPath(); g.arc(xp, y, 6 + 12 * (1 - pl), 0, TAU); g.fill(); g.globalAlpha = 1;
          g.fillStyle = col; g.beginPath(); g.arc(xp, y, 5, 0, TAU); g.fill();
        });
        // value labels, pushed apart so they never overlap where the lines cross
        const lab = data.map((arr, i) => ({ i, y: yh(arr[Math.floor(d)]) - 9 })).sort((p, q) => p.y - q.y);
        for (let j = 1; j < lab.length; j++) if (lab[j].y < lab[j - 1].y + 14) lab[j].y = lab[j - 1].y + 14;
        g.textAlign = 'left'; g.font = '600 11px Cascadia Mono, Consolas';
        if (xp < X1 - 60) for (const o of lab) { g.fillStyle = CITY9[o.i][2]; g.fillText(data[o.i][Math.floor(d)].toFixed(1) + ' h', xp + 12, o.y); }
        g.fillStyle = 'rgba(244,239,230,0.35)'; g.fillRect(xp, Y0 - 4, 1, Y1 - Y0 + 4);
        // legend and status
        g.textBaseline = 'alphabetic'; g.textAlign = 'left'; let lx = 18;
        CITY9.forEach(([nm, , col], i) => { g.fillStyle = col; g.fillRect(lx, 16, 10, 10); g.font = '600 12px Bahnschrift, Segoe UI'; g.fillStyle = C.cream; g.fillText(`${nm}  ${data[i][Math.floor(d)].toFixed(1)} h`, lx + 16, 26); lx += g.measureText(`${nm}  00.0 h`).width + 34; });
        g.font = '500 12px Cascadia Mono, Consolas'; g.textAlign = 'right'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', W - 14, 26);
        g.fillText(`week ${Math.min(52, wk + 1)}  pitch = hours, pan = date`, W - 14, 348); g.textAlign = 'left';
      };
    },
  });

  // ---------- 10. Drum hits as motion ----------
  const ST10 = 60 / 104 / 4, NS10 = 32;
  const KICK10 = [0, 7, 10, 16, 23, 26, 29], SNARE10 = [4, 12, 20, 28], CLAP10 = [12, 28], OPEN10 = [14, 30];
  const HAT10 = []; for (let s = 0; s < NS10; s += 2) if (!OPEN10.includes(s)) HAT10.push(s);
  const BASS10 = /** @type {[number, number][]} */ ([[0, 36], [3, 36], [7, 39], [10, 41], [16, 36], [19, 36], [23, 43], [26, 41], [29, 39]]);
  // Last and next hit of a pattern around step position p (in steps, any loop): returns [last, next] in steps.
  const around = (pat, p) => { const k = Math.floor(p / NS10), r = p - k * NS10; let last = -1e9, next = 1e9; for (const s of pat) { if (s <= r) last = k * NS10 + s; else { next = k * NS10 + s; break; } } if (last < -1e8) last = (k - 1) * NS10 + pat[pat.length - 1]; if (next > 1e8) next = (k + 1) * NS10 + pat[0]; return [last, next]; };
  EX.add({
    cat: 'audio', id: 'au2-drummotion', title: 'Drum hits as motion', aka: 'beat-synced animation, sound to motion mapping, drum visualizer, motion vocabulary', tool: 'Web Audio API (synth drums) + Canvas 2D', runs: 'CPU',
    notice: 'Each drum gets its own motion principle: the kick ball is thrown so gravity lands it exactly on the next kick, then squashes and shakes the frame, and the snare bursts. The clap hands pull back first (anticipation), slam shut on the hit, hold contact and spring open, while the hats step the dial with no easing at all, a stutter. The lane below shows the two-bar pattern under a playhead.',
    use: 'music videos, beat-synced social edits, motion design teaching, rhythm game feedback',
    params: [
      { key: 'squash', label: 'Squash amount', min: 0, max: 1, step: 0.05, value: 0.45 },
      { key: 'antic', label: 'Clap anticipation (s)', min: 0, max: 0.4, step: 0.02, value: 0.22, unit: ' s' },
    ],
    prompt: 'Drum hits as motion at 104 BPM, a two-bar beat of synthesized kick, snare, clap, hats and bass, each sound with its own motion principle in its own zone: a ball thrown by each kick so gravity lands it exactly on the next kick, squashing by {squash} and shaking the frame; a snare ring that bursts into shards; two clap hands that pull back for {antic} (anticipation), slam shut on the hit, hold contact for 90 ms and spring open with overshoot; a hat dial that steps 30 degrees per hat with no easing (stutter), flaring on open hats; a bass wave along the floor. Label each zone with its principle and show the pattern in a read-only lane with a playhead. Schedule the drums ahead on the Web Audio clock and drive every motion from the same clock.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), FY = 232, rr = EX.rng(5), shard = []; for (let i = 0; i < 12; i++) shard.push([i / 12 * TAU + rr() * 0.4, 0.6 + rr() * 0.6, rr() * 6]);
      const A = clock(L, (A, a, b) => {
        for (let k = Math.ceil(a / ST10); k * ST10 < b; k++) {
          const T = k * ST10, s = k % NS10;
          if (KICK10.includes(s)) V.kick(A, T, 1);
          if (SNARE10.includes(s)) { V.noise(A, T, 1900, 'bandpass', 0.6, 0.15); V.tone(A, T, 54, 'triangle', 0.25, 0.08); }
          if (CLAP10.includes(s)) for (let j = 0; j < 3; j++) V.noise(A, T + j * 0.011, 1300, 'bandpass', 0.5, j === 2 ? 0.12 : 0.012, 2);
          if (HAT10.includes(s)) V.noise(A, T, 9000, 'highpass', 0.16, 0.035); if (OPEN10.includes(s)) V.noise(A, T, 8000, 'highpass', 0.18, 0.22);
          const bn = BASS10.find(q => q[0] === s); if (bn) V.tone(A, T, bn[1], 'sawtooth', 0.3, 0.3, 300);
        }
      }, 0.15);
      const label = (txt, sub, x) => { g.textAlign = 'center'; g.font = '700 12px Bahnschrift, Segoe UI'; g.fillStyle = C.cream; g.fillText(txt, x, 258); g.font = '500 10px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.45)'; g.fillText(sub, x, 272); };
      return (t) => {
        const T = A.time(t), p = T / ST10, sec = q => (p - q) * ST10;
        const [k0, k1] = around(KICK10, p), [s0] = around(SNARE10, p), [c0, c1] = around(CLAP10, p), [o0] = around(OPEN10, p), [b0] = around(BASS10.map(q => q[0]), p);
        const kAge = sec(k0), shake = 3.5 * Math.exp(-kAge * 22);
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.save(); g.translate(Math.sin(T * 91) * shake, Math.cos(T * 77) * shake);
        g.fillStyle = 'rgba(244,239,230,0.1)'; g.fillRect(20, FY, 600, 1.5);
        // bass wave along the floor
        const bAge = sec(b0), bn = BASS10.find(q => q[0] === ((b0 % NS10) + NS10) % NS10), bAmp = 9 * Math.exp(-bAge * 5), wl = 40 - (bn ? bn[1] - 36 : 0) * 3;
        g.strokeStyle = 'rgba(122,92,255,0.8)'; g.lineWidth = 2; g.beginPath(); for (let x = 20; x <= 620; x += 4) { const y = FY + 12 + Math.sin((x - T * 120) / wl * TAU) * bAmp; if (x === 20) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
        // kick: thrown so gravity lands it on the next kick
        const gap = (k1 - k0) * ST10, u = Math.min(1, kAge / gap), hgt = Math.min(150, 420 * gap * gap), y = FY - 22 - hgt * 4 * u * (1 - u), vy = Math.abs(1 - 2 * u);
        const sq = L.p.squash * Math.exp(-kAge * 16), sx = (1 + sq) * (1 - 0.12 * vy * (u > 0.15 ? 1 : 0)), sy = (1 - sq) * (1 + 0.16 * vy * (u > 0.15 ? 1 : 0));
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(100, FY + 1, 22 * (1 - 0.4 * (1 - u) * u * 4), 4, 0, 0, TAU); g.fill();
        g.fillStyle = `rgba(255,90,54,${0.5 * Math.exp(-kAge * 10)})`; g.fillRect(40, FY - 1, 120, 3);
        g.fillStyle = C.coral; g.beginPath(); g.ellipse(100, y + 22 - 22 * sy, 22 * sx, 22 * sy, 0, 0, TAU); g.fill();
        // snare: ring burst and shards
        const sAge = sec(s0), cx = 250, cy = 150, pop = sAge < 0.4 ? 1 + 0.35 * Math.exp(-sAge * 12) * Math.cos(sAge * 30) : 1;
        if (sAge < 0.6) { g.strokeStyle = `rgba(255,176,32,${1 - sAge / 0.6})`; g.lineWidth = 3 * (1 - sAge / 0.6) + 0.5; g.beginPath(); g.arc(cx, cy, 26 + 90 * (1 - Math.exp(-sAge * 6)), 0, TAU); g.stroke();
          for (const [a, v, r0] of shard) { const d = 30 + sAge * 140 * v, x = cx + Math.cos(a) * d, yy = cy + Math.sin(a) * d + 90 * sAge * sAge; g.save(); g.translate(x, yy); g.rotate(r0 + sAge * 8); g.fillStyle = `rgba(255,176,32,${1 - sAge / 0.6})`; g.fillRect(-5, -2, 10, 4); g.restore(); } }
        g.fillStyle = C.amber; g.beginPath(); g.arc(cx, cy, 22 * pop, 0, TAU); g.fill(); g.fillStyle = C.bg; g.beginPath(); g.arc(cx, cy, 9 * pop, 0, TAU); g.fill();
        // clap: anticipation, slam on the hit, spring back open
        const toNext = (c1 - p) * ST10, cAge = sec(c0), an = L.p.antic, REST = 34;
        let half = REST;
        if (an > 0 && toNext < an) { const v = 1 - toNext / an; half = v < 0.5 ? REST + 16 * Math.sin(v / 0.5 * Math.PI / 2) : (REST + 16) * (1 - Math.pow((v - 0.5) / 0.5, 2)); }
        else if (cAge < 0.09) half = 0;
        else if (cAge < 0.8) half = REST * (1 - Math.exp(-(cAge - 0.09) * 8) * Math.cos((cAge - 0.09) * 14));
        const hx = 400; g.fillStyle = C.cyan;
        for (const sd of [-1, 1]) { g.save(); g.translate(hx + sd * (half + 14), 150); g.rotate(sd * 0.12 * Math.min(1, half / REST)); g.beginPath(); g.roundRect(-14, -36, 28, 72, 12); g.fill(); g.restore(); }
        if (cAge < 0.25) { g.strokeStyle = `rgba(244,239,230,${1 - cAge / 0.25})`; g.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r0 = 46 + cAge * 120; g.beginPath(); g.moveTo(hx + Math.cos(a) * r0, 150 + Math.sin(a) * r0); g.lineTo(hx + Math.cos(a) * (r0 + 12), 150 + Math.sin(a) * (r0 + 12)); g.stroke(); } }
        // hats: the dial steps with no easing; open hats flare
        const kk = Math.floor(p / NS10), rp = p - kk * NS10; let n = kk * HAT10.length; for (const s of HAT10) if (s <= rp) n++;
        const oAge = sec(o0), flare = oAge < 0.3 ? 1 + 0.6 * (1 - oAge / 0.3) : 1, ang = n * Math.PI / 6;
        g.strokeStyle = 'rgba(244,239,230,0.12)'; g.lineWidth = 2; g.beginPath(); g.arc(550, 150, 44, 0, TAU); g.stroke();
        for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(244,239,230,0.25)'; g.fillRect(550 + Math.cos(i / 12 * TAU) * 44 - 1.5, 150 + Math.sin(i / 12 * TAU) * 44 - 1.5, 3, 3); }
        g.strokeStyle = C.cream; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(550, 150); g.lineTo(550 + Math.cos(ang - Math.PI / 2) * 38 * flare, 150 + Math.sin(ang - Math.PI / 2) * 38 * flare); g.stroke();
        g.fillStyle = C.violet; g.beginPath(); g.arc(550, 150, 6 * flare, 0, TAU); g.fill();
        g.restore();
        label('KICK', 'land, squash, shake', 100); label('SNARE', 'burst', 250); label('CLAP', 'anticipate, slam', 400); label('HATS', 'stepped stutter', 550);
        // read-only pattern lane
        const LX = 70, LW = 550, rows = /** @type {[string, number[], string][]} */ ([['kick', KICK10, C.coral], ['snare', SNARE10, C.amber], ['clap', CLAP10, C.cyan], ['hats', HAT10.concat(OPEN10), C.cream]]);
        g.font = '500 9px Cascadia Mono, Consolas'; g.textAlign = 'right';
        rows.forEach(([nm, pat, col], ri) => {
          const yy = 290 + ri * 15; g.fillStyle = 'rgba(244,239,230,0.4)'; g.fillText(nm, LX - 8, yy + 7);
          for (let s = 0; s < NS10; s++) { const x = LX + s * LW / NS10, on = pat.includes(s), now = Math.floor(rp) === s; g.fillStyle = on ? col : 'rgba(244,239,230,0.06)'; g.globalAlpha = on ? (now ? 1 : 0.55) : 1; g.fillRect(x + 1, yy, LW / NS10 - 3, 10); }
          g.globalAlpha = 1;
        });
        g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillRect(LX + rp * LW / NS10, 286, 1.5, 64);
        g.textAlign = 'left'; g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', 18, 24);
        g.textAlign = 'right'; g.fillText('104 BPM  two bars', W - 18, 24); g.textAlign = 'left';
      };
    },
  });

  // ---------- 11. Echoes by image sources ----------
  EX.add({
    cat: 'audio', id: 'au2-echoes', title: 'Echoes from mirror sources', aka: 'room acoustics, image-source method, reverb explained, echogram', tool: 'Web Audio API (scheduled echo taps) + Canvas 2D', runs: 'CPU',
    notice: 'A clap in a canyon-sized box: every wall reflection acts like a copy of the source mirrored behind that wall, so each echo is a circle centered on a mirror source and clipped to the room. Each echo sounds when its circle reaches the listener, quieter and duller with every bounce, and the echogram on the right marks every arrival. Change the bounce count or the wall reflectivity to hear the room change.',
    use: 'acoustics teaching, sound design explainers, game audio prototyping, physics videos',
    params: [
      { key: 'order', label: 'Max bounces', min: 0, max: 4, step: 1, value: 3 },
      { key: 'refl', label: 'Wall reflectivity', min: 0.2, max: 0.95, step: 0.05, value: 0.7 },
    ],
    prompt: 'Room echoes with the image-source method: a top-down rectangular room the size of a canyon (1 px = 1 m, sound at 343 m/s), a source and a listener inside. Every {order}-bounce-or-fewer reflection is a mirror copy of the source across the walls; draw each echo as a circle growing from its mirror source, clipped to the room and colored by bounce count. Clap every 4 s and schedule each echo with Web Audio at distance / speed after the clap, gain = reflectivity ({refl}) to the power of the bounce count over distance, a low-pass that closes with each bounce. Flash the listener on every arrival and draw an echogram (time across, level up) with a playhead.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), RX0 = 22, RY0 = 44, LXr = 360, LYr = 290, SX = 92, SY = 86, LX = 268, LY = 214, CS = 343, PER = 4, SPAN = 4;
      const COLS = ['244,239,230', '255,176,32', '255,90,54', '122,92,255', '43,196,230'];
      const img = (i, n, Ln) => (i % 2 === 0 ? i * Ln + n : (i + 1) * Ln - n);
      // All mirror sources up to 4 bounces: position, bounce count, distance and arrival delay at the listener.
      const ims = [];
      for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) { const o = Math.abs(i) + Math.abs(j); if (o > 4) continue; const x = img(i, SX, LXr), y = img(j, SY, LYr), d = Math.hypot(x - LX, y - LY); ims.push({ x, y, o, d, t: d / CS }); }
      ims.sort((a, b) => a.t - b.t);
      const gainOf = q => Math.pow(L.p.refl, q.o) * 80 / (q.d + 40);
      const A = clock(L, (A, a, b) => {
        for (let k = Math.floor((a - SPAN) / PER); k * PER < b; k++) {
          const T0 = k * PER;
          if (T0 >= a && T0 < b) V.noise(A, T0, 1500, 'bandpass', 0.9, 0.06, 0.7);
          for (const q of ims) {
            if (q.o > L.p.order) continue; const T = T0 + q.t; if (T < a || T >= b) continue;
            const gn = Math.min(0.9, gainOf(q) * 2.6); if (gn < 0.01) continue;
            V.noise(A, T, 1500 / (1 + q.o * 0.6), 'bandpass', gn, 0.06 + q.o * 0.02, 0.7);
          }
        }
      }, 0.3);
      return (t) => {
        const T = A.time(t), k = Math.floor(T / PER), age = T - k * PER;
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.fillStyle = '#121120'; g.fillRect(RX0, RY0, LXr, LYr);
        // wavefronts from this clap and the one before, clipped to the room
        g.save(); g.beginPath(); g.rect(RX0, RY0, LXr, LYr); g.clip();
        for (const ag of [age, age + PER]) {
          if (ag > SPAN + 1) continue; const R = ag * CS;
          for (let n = ims.length - 1; n >= 0; n--) {
            const q = ims[n]; if (q.o > L.p.order) continue;
            const lev = Math.pow(L.p.refl, q.o) * Math.max(0, 1 - ag / (SPAN + 1)); if (lev < 0.03) continue;
            const dx = Math.max(RX0 - (RX0 + q.x), 0, RX0 + q.x - (RX0 + LXr)), dy = Math.max(RY0 - (RY0 + q.y), 0, RY0 + q.y - (RY0 + LYr)); if (R < Math.hypot(dx, dy)) continue;
            g.strokeStyle = `rgba(${COLS[q.o]},${0.15 + 0.8 * lev})`; g.lineWidth = 1 + 2 * lev; g.beginPath(); g.arc(RX0 + q.x, RY0 + q.y, R, 0, TAU); g.stroke();
          }
        }
        g.restore();
        g.strokeStyle = 'rgba(244,239,230,0.5)'; g.lineWidth = 3; g.strokeRect(RX0, RY0, LXr, LYr);
        // source and listener
        const sp = Math.exp(-age * 10);
        g.fillStyle = `rgba(244,239,230,${0.25 * sp})`; g.beginPath(); g.arc(RX0 + SX, RY0 + SY, 10 + 20 * (1 - sp), 0, TAU); g.fill();
        g.fillStyle = C.cream; g.beginPath(); g.arc(RX0 + SX, RY0 + SY, 7, 0, TAU); g.fill();
        let last = null; for (const q of ims) if (q.o <= L.p.order && q.t <= age && gainOf(q) * 2.6 > 0.01) last = q;
        const la = last ? age - last.t : 9, lf = Math.exp(-la * 12);
        g.strokeStyle = last ? `rgba(${COLS[last.o]},${0.3 + 0.7 * lf})` : 'rgba(43,196,230,0.3)'; g.lineWidth = 2; g.beginPath(); g.arc(RX0 + LX, RY0 + LY, 11 + 8 * lf, 0, TAU); g.stroke();
        g.fillStyle = C.cyan; g.beginPath(); g.arc(RX0 + LX, RY0 + LY, 6, 0, TAU); g.fill();
        g.font = '500 10px Cascadia Mono, Consolas'; g.textAlign = 'center'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillText('clap', RX0 + SX, RY0 + SY - 14); g.fillText('listener', RX0 + LX, RY0 + LY + 26);
        // echogram
        const EX0 = 404, EW = 222, EY = 196, EH = 120;
        g.fillStyle = 'rgba(29,27,58,0.55)'; g.beginPath(); g.roundRect(EX0, 70, EW, 260, 8); g.fill();
        g.textAlign = 'left'; g.font = '600 13px Bahnschrift, Segoe UI'; g.fillStyle = C.cream; g.fillText('Echogram', EX0 + 12, 92);
        g.font = '500 10px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.45)'; g.fillText('what the listener hears', EX0 + 12, 108);
        g.fillStyle = 'rgba(244,239,230,0.15)'; g.fillRect(EX0 + 12, EY + EH / 2, EW - 24, 1);
        const tx = s => EX0 + 12 + (EW - 24) * s / SPAN;
        for (const q of ims) {
          if (q.o > L.p.order || q.t > SPAN) continue; const lv = Math.min(1, Math.sqrt(gainOf(q) * 2.6)), h = 3 + lv * (EH / 2 - 6), heard = q.t <= age;
          g.fillStyle = `rgba(${COLS[q.o]},${heard ? 0.95 : 0.3})`; g.fillRect(tx(q.t) - 1, EY + EH / 2 - h, 2, h * 2);
        }
        g.fillStyle = C.cream; g.fillRect(tx(Math.min(SPAN, age)), EY - 4, 1.5, EH + 8);
        for (let s = 0; s <= SPAN; s++) { g.fillStyle = 'rgba(244,239,230,0.4)'; g.fillText(s + ' s', tx(s) - 6, EY + EH + 20); }
        for (let o = 0; o <= 4; o++) { const lx = EX0 + 12 + (o ? 34 + o * 34 : 0); g.fillStyle = `rgba(${COLS[o]},${o <= L.p.order ? 1 : 0.25})`; g.fillRect(lx, 126, 10, 10); g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(o === 0 ? 'direct' : String(o), lx + 14, 135); }
        g.fillStyle = 'rgba(244,239,230,0.45)'; g.fillText('color = number of bounces', EX0 + 12, 154);
        g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', RX0, 28);
        g.textAlign = 'right'; g.fillText('1 px = 1 m, sound at 343 m/s', W - 14, 28); g.textAlign = 'left';
      };
    },
  });

  // ---------- 12. FM synthesis, explained ----------
  const ST12 = 60 / 90 / 2, SEQ12 = [48, 55, 64, 67, 71, 74, 71, 67, 45, 52, 60, 64, 67, 71, 67, 64], RING12 = 1.4;
  // Bessel function J_n(x) by Simpson integration of its integral form; sideband k of an FM tone has amplitude J_k(index).
  const besselJ = (n, x) => { const M = 32; let s = 0; for (let i = 0; i <= M; i++) { const t = i / M * Math.PI, w = i === 0 || i === M ? 1 : i % 2 ? 4 : 2; s += w * Math.cos(n * t - x * Math.sin(t)); } return s * (Math.PI / M / 3) / Math.PI; };
  EX.add({
    cat: 'audio', id: 'au2-fm', title: 'FM synthesis, explained', aka: 'frequency modulation, DX7 sound, sidebands, Bessel spectrum, FM bells', tool: 'Web Audio API (oscillator driving another oscillator\'s frequency) + Canvas 2D', runs: 'CPU',
    notice: 'One sine wave (the modulator) pushes the frequency of another (the carrier) back and forth, and the harder it pushes, the more extra partials appear either side of the carrier, with heights set by Bessel functions. Each note starts with a big push that decays, so the spectrum blooms on the attack and collapses toward the carrier, which is why FM electric pianos and bells sound bright and then mellow. Change the ratio to move from piano to bell.',
    use: 'synth sound design teaching, retro 80s keys and bells, explaining modulation',
    params: [
      { key: 'ratio', label: 'Modulator ratio', min: 0.5, max: 5, step: 0.5, value: 1 },
      { key: 'index', label: 'Peak index', min: 0, max: 8, step: 0.5, value: 4 },
    ],
    prompt: 'Explain FM synthesis live: an electric-piano arpeggio at 90 BPM where each note is a carrier sine whose frequency is pushed by a modulator sine at {ratio} x the carrier, with a modulation index that starts at {index} and decays to a quarter over 0.35 s. Draw the modulator and the bent carrier waveform in two module boxes joined by an "x index" cable, the index envelope with a moving dot, and the spectrum: sidebands at carrier plus and minus k times the modulator, height |J_k(index)| from Bessel functions, blooming on every attack and collapsing toward the carrier.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), Jk = new Float32Array(17), BF = new Float32Array(17);
      const idxAt = u => L.p.index * (0.25 + 0.75 * Math.exp(-u / 0.35));
      const A = clock(L, (A, a, b) => {
        const ac = A.ac;
        for (let k = Math.ceil(a / ST12); k * ST12 < b; k++) {
          const T = k * ST12, t = A.at(T), fc = mtof(SEQ12[k % 16]), fm = fc * L.p.ratio;
          const car = ac.createOscillator(), mod = ac.createOscillator(), dev = ac.createGain(), amp = ac.createGain(), p = ac.createStereoPanner();
          car.frequency.value = fc; mod.frequency.value = fm; dev.gain.setValueAtTime(L.p.index * fm, t); dev.gain.setTargetAtTime(0.25 * L.p.index * fm, t, 0.35);
          amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(0.2, t + 0.005); amp.gain.setTargetAtTime(0.0001, t + 0.005, 0.45); p.pan.value = (k % 4 - 1.5) / 4;
          mod.connect(dev); dev.connect(car.frequency); car.connect(amp); amp.connect(p); p.connect(A.out); car.start(t); mod.start(t); car.stop(t + RING12 + 0.3); mod.stop(t + RING12 + 0.3);
        }
      }, 0.15);
      const box = (x, y, w, h, title, sub, col) => { g.fillStyle = 'rgba(29,27,58,0.6)'; g.beginPath(); g.roundRect(x, y, w, h, 8); g.fill(); g.strokeStyle = col; g.globalAlpha = 0.5; g.lineWidth = 1; g.stroke(); g.globalAlpha = 1; g.font = '700 12px Bahnschrift, Segoe UI'; g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(title, x + 10, y + 18); g.font = '500 9px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.5)'; g.fillText(sub, x + 10, y + 30); };
      return (t) => {
        const T = A.time(t), k = Math.floor(T / ST12), u = T - k * ST12, nn = SEQ12[((k % 16) + 16) % 16], fc = mtof(nn), r = L.p.ratio, fm = fc * r, I = idxAt(u), amp = Math.exp(-u / 0.45);
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        // modulator and carrier scopes, over three periods of the slower wave
        box(14, 38, 200, 116, 'MODULATOR', `sine at ${r} x carrier`, C.cyan); box(262, 38, 364, 116, 'CARRIER', 'sine whose frequency is pushed', C.amber);
        const span = 3 / Math.min(fc, fm);
        g.strokeStyle = C.cyan; g.lineWidth = 1.8; g.beginPath(); for (let i = 0; i <= 160; i++) { const x = i / 160 * span, y = 104 - Math.sin(TAU * fm * x) * 30 * Math.min(1, I / 6 + 0.15); if (i) g.lineTo(24 + i / 160 * 180, y); else g.moveTo(24, y); } g.stroke();
        g.strokeStyle = C.amber; g.beginPath(); for (let i = 0; i <= 320; i++) { const x = i / 320 * span, y = 104 - Math.sin(TAU * fc * x + I * Math.sin(TAU * fm * x)) * 34 * (0.3 + 0.7 * amp); if (i) g.lineTo(272 + i / 320 * 344, y); else g.moveTo(272, y); } g.stroke();
        g.strokeStyle = 'rgba(244,239,230,0.4)'; g.setLineDash([5, 5]); g.lineDashOffset = -T * 40; g.lineWidth = 2; g.beginPath(); g.moveTo(214, 96); g.lineTo(262, 96); g.stroke(); g.setLineDash([]);
        g.font = '600 10px Cascadia Mono, Consolas'; g.fillStyle = C.cream; g.textAlign = 'center'; g.fillText(`x ${I.toFixed(1)}`, 238, 88);
        // index envelope with the note's position
        box(14, 168, 200, 150, 'INDEX ENVELOPE', 'how hard the push is', C.coral);
        const ex = s => 26 + s / RING12 * 176, ey = v => 300 - v / 8 * 100;
        g.strokeStyle = 'rgba(255,90,54,0.6)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 60; i++) { const s = i / 60 * RING12; if (i) g.lineTo(ex(s), ey(idxAt(s))); else g.moveTo(ex(s), ey(idxAt(s))); } g.stroke();
        g.fillStyle = C.coral; g.beginPath(); g.arc(ex(Math.min(u, RING12)), ey(I), 5, 0, TAU); g.fill();
        g.font = '700 24px Bahnschrift, Segoe UI'; g.textAlign = 'left'; g.fillStyle = C.cream; g.fillText(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][nn % 12] + (Math.floor(nn / 12) - 1), 150, 206);
        // sideband spectrum: Bessel amplitudes at fc + k fm (negative frequencies fold back)
        box(228, 168, 398, 150, 'SPECTRUM', 'sidebands at carrier +/- k x modulator, height |J_k(index)|', C.cream);
        const FMX = fc + 9 * fm, sx = f => 240 + Math.min(1, f / FMX) * 374, BY0 = 304;
        // components at fc + j fm; a negative frequency folds back with its sign flipped, and equal frequencies add up
        let nb = 0;
        for (let j = -8; j <= 8; j++) {
          const f0 = fc + j * fm, a = besselJ(Math.abs(j), I) * (j < 0 && j % 2 ? -1 : 1) * (f0 < 0 ? -1 : 1), f = Math.abs(f0); let m = 0;
          while (m < nb && Math.abs(BF[m] - f) > 0.5) m++; if (m === nb) { BF[nb] = f; Jk[nb++] = 0; } Jk[m] += a;
        }
        g.fillStyle = 'rgba(244,239,230,0.12)'; g.fillRect(240, BY0, 374, 1);
        for (let m = 0; m < nb; m++) {
          const f = BF[m], a = Math.min(1.2, Math.abs(Jk[m])) * (0.35 + 0.65 * amp); if (f > FMX || a < 0.005) continue;
          const x = sx(f), h = a * 100, d = Math.round((f - fc) / fm); g.fillStyle = Math.abs(f - fc) < 0.5 ? C.amber : f > fc ? C.coral : C.cyan; g.fillRect(x - 2, BY0 - h, 4, h);
          if (Math.abs(d) <= 2 && h > 8 && Math.abs(f - fc - d * fm) < 0.5) { g.font = '500 9px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.textAlign = 'center'; g.fillText(d === 0 ? 'fc' : d > 0 ? `+${d}` : `${d}`, x, BY0 - h - 5); }
        }
        g.textAlign = 'left'; g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', 14, 24);
        g.textAlign = 'right'; g.fillText(`${fc.toFixed(0)} Hz carrier, ${fm.toFixed(0)} Hz modulator`, W - 14, 24); g.textAlign = 'left';
      };
    },
  });

  // ---------- 13. Shepard tone ----------
  const NP13 = 8, FMIN13 = 32.7;
  EX.add({
    cat: 'audio', id: 'au2-shepard', title: 'Endless rising tone', aka: 'Shepard tone, Shepard-Risset glissando, auditory illusion, pitch helix', tool: 'Web Audio API (8 oscillators with frequency and gain automation) + Canvas 2D', runs: 'CPU',
    notice: 'Eight sine waves one octave apart all glide upward together, and each one fades in at the bottom and out at the top under a bell-shaped curve, so the sound seems to rise forever without getting higher. On the left each partial is a dot climbing the pitch helix, one turn per octave; on the right the same partials slide through the bell. Each dot\'s height and brightness are the exact frequency and gain the oscillators are set to.',
    use: 'tension builds in film and game audio, illusion explainers, hypnotic loops',
    params: [
      { key: 'oct', label: 'Seconds per octave', min: 3, max: 20, step: 1, value: 8, unit: ' s' },
      { key: 'dir', label: 'Direction (1 up, -1 down)', min: -1, max: 1, step: 2, value: 1 },
    ],
    prompt: 'Shepard-Risset glissando with a matching visual: eight sine partials an octave apart from 33 Hz glide together ({oct} per octave, direction {dir}), each weighted by a raised-cosine bell over log frequency so partials fade in at the bottom and out at the top. Automate oscillator frequency and gain with Web Audio ramps from the same formulas the picture uses. Left: a 3D pitch helix (one turn per octave) with a glowing dot per partial climbing it, back half dimmer. Right: a log-frequency spectrum with the bell curve and one bar per partial gliding through it. Caption: always rising, never higher.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), HX = 170, HB = 318, HH = 34, HR = 92;
      let ph0 = 0, T0 = 0, RATE = L.p.dir / L.p.oct;
      const U = T => ph0 + (T - T0) * RATE; // position in octaves; partial k sits at (k + U) mod NP13
      const bell = p => 0.5 - 0.5 * Math.cos(TAU * p / NP13);
      let osc = null;
      const A = clock(L, (A, a, b) => {
        const ac = A.ac;
        if (!osc || osc[0].ac !== ac) osc = Array.from({ length: NP13 }, () => { const o = ac.createOscillator(), gn = ac.createGain(); gn.gain.value = 0; o.connect(gn); gn.connect(A.out); o.start(); return { ac, o, gn }; });
        const ua = U(a), ub = U(b), ta = A.at(a), tb = A.at(b);
        osc.forEach((v, k) => {
          const pa = ((k + ua) % NP13 + NP13) % NP13, pb = ((k + ub) % NP13 + NP13) % NP13;
          if (Math.abs(pb - pa) > NP13 / 2) { v.gn.gain.setValueAtTime(0, ta); v.o.frequency.setValueAtTime(FMIN13 * Math.pow(2, pb), tb); v.gn.gain.linearRampToValueAtTime(bell(pb) * 0.1, tb); return; }
          v.o.frequency.setValueAtTime(FMIN13 * Math.pow(2, pa), ta); v.o.frequency.exponentialRampToValueAtTime(FMIN13 * Math.pow(2, pb), tb);
          v.gn.gain.setValueAtTime(bell(pa) * 0.1, ta); v.gn.gain.linearRampToValueAtTime(bell(pb) * 0.1, tb);
        });
      }, 0.12);
      const hp = (p, out) => { const th = TAU * p, z = Math.sin(th); out[0] = HX + Math.cos(th) * HR; out[1] = HB - p * HH + z * 16; out[2] = z; return out; };
      const P = [0, 0, 0], Q = [0, 0, 0];
      return (t) => {
        const T = A.time(t), r = L.p.dir / L.p.oct;
        if (r !== RATE) { ph0 = U(T); T0 = T; RATE = r; }
        const u = U(T);
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        // helix: back half first, then partial dots, then front half
        for (const back of [true, false]) {
          g.lineWidth = back ? 1.2 : 2;
          for (let i = 0; i < 200; i++) {
            hp(i / 200 * NP13, P); hp((i + 1) / 200 * NP13, Q); if ((P[2] < 0) !== back) continue;
            const a = bell(i / 200 * NP13); g.strokeStyle = `rgba(122,92,255,${(back ? 0.15 : 0.35) + 0.45 * a * (back ? 0.4 : 1)})`;
            g.beginPath(); g.moveTo(P[0], P[1]); g.lineTo(Q[0], Q[1]); g.stroke();
          }
          for (let k = 0; k < NP13; k++) {
            const p = ((k + u) % NP13 + NP13) % NP13; hp(p, P); if ((P[2] < 0) !== back) continue; const a = bell(p);
            for (let j = 0; j < 12; j++) { const q0 = p - L.p.dir * j * 0.025, q1 = p - L.p.dir * (j + 1) * 0.025; if (q1 < 0 || q1 > NP13) break; hp(q0, Q); const x0 = Q[0], y0 = Q[1]; hp(q1, Q); g.strokeStyle = `rgba(255,176,32,${a * 0.8 * (1 - j / 12)})`; g.lineWidth = 4 - j * 0.25; g.beginPath(); g.moveTo(x0, y0); g.lineTo(Q[0], Q[1]); g.stroke(); }
            g.fillStyle = `rgba(255,176,32,${0.25 * a})`; g.beginPath(); g.arc(P[0], P[1], 8 + 14 * a, 0, TAU); g.fill();
            g.fillStyle = `rgba(244,239,230,${0.25 + 0.75 * a})`; g.beginPath(); g.arc(P[0], P[1], 3 + 4 * a, 0, TAU); g.fill();
          }
        }
        // spectrum with the bell
        const SX = 330, SW = 290, SY = 300, SH = 190, sx = p => SX + SW * p / NP13;
        g.fillStyle = 'rgba(29,27,58,0.45)'; g.beginPath(); g.roundRect(SX - 10, SY - SH - 20, SW + 20, SH + 46, 8); g.fill();
        g.strokeStyle = 'rgba(255,90,54,0.6)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 80; i++) { const p = i / 80 * NP13, x = sx(p), y = SY - bell(p) * SH; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
        for (let k = 0; k < NP13; k++) { const p = ((k + u) % NP13 + NP13) % NP13, a = bell(p), x = sx(p); g.fillStyle = `rgba(255,176,32,${0.35 + 0.65 * a})`; g.fillRect(x - 3, SY - a * SH, 6, a * SH); g.fillStyle = C.cream; g.beginPath(); g.arc(x, SY - a * SH, 3.5, 0, TAU); g.fill(); }
        g.font = '500 10px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.45)'; g.textAlign = 'center';
        for (let o = 0; o < NP13; o += 2) { const f = FMIN13 * Math.pow(2, o); g.fillText(f >= 1000 ? (f / 1000).toFixed(1) + ' kHz' : f.toFixed(0) + ' Hz', sx(o) + (o ? 0 : 8), SY + 16); }
        g.textAlign = 'left'; g.font = '700 22px Bahnschrift, Segoe UI'; g.fillStyle = C.cream; g.fillText(L.p.dir > 0 ? 'Always rising,' : 'Always falling,', 330, 40);
        g.fillStyle = C.amber; g.fillText(L.p.dir > 0 ? 'never higher.' : 'never lower.', 330, 66);
        g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', 18, 24);
      };
    },
  });

  // ---------- 14. 3D sound orbit ----------
  const PENT14 = [0, 3, 5, 7, 10, 12, 10, 7];
  EX.add({
    cat: 'audio', id: 'au2-orbit3d', title: '3D sound orbit (headphones)', aka: 'binaural audio, HRTF panning, spatial audio, 8D audio', tool: 'Web Audio API (PannerNode with HRTF) + Canvas 2D 3D projection', runs: 'CPU',
    notice: 'Put on headphones: a plucked melody and a soft shaker circle your head, swing in and out, and rise and fall. The browser\'s HRTF panner filters the sound the way your ears and head would, so you hear it behind and above you, not just left and right. The panner moves along the same 3D path that is drawn, seen from just behind the head, and every note sends a ripple from the sound.',
    use: 'spatial audio demos, VR and game sound prototypes, ASMR and 8D music visuals',
    params: [
      { key: 'orbit', label: 'Seconds per orbit', min: 4, max: 20, step: 1, value: 8, unit: ' s' },
      { key: 'lift', label: 'Height swing (m)', min: 0, max: 1.6, step: 0.1, value: 0.9, unit: ' m' },
    ],
    prompt: 'Spatial audio demo for headphones: a plucked pentatonic melody and a soft shaker orbit the listener once every {orbit}, swinging between 1.2 and 3.4 m and rising and falling {lift}, through a Web Audio PannerNode set to HRTF. Ramp the panner position along the same path that is drawn: a 3D view from behind and above a simple head (ears, nose pointing away), a floor grid of distance rings, the orbit path in perspective, a glowing sound source with a drop line to its floor shadow and a ripple on every note, plus a top-down radar with azimuth, elevation and distance readouts.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), CX = 250, CY = 205, F = 330, PA = 0.42, CAM = [0, 3.0, 6.2], FL = -1.3;
      const fw = [0, -Math.sin(PA), -Math.cos(PA)], up = [0, Math.cos(PA), -Math.sin(PA)];
      let ph0 = 0, T0 = 0, P = L.p.orbit;
      const ang = T => ph0 + (T - T0) / P * TAU;
      const pos = (T, o) => { const a = ang(T), r = 2.3 + 1.1 * Math.sin(a * 2), y = L.p.lift * Math.sin(a * 3 + 0.6); o[0] = r * Math.sin(a); o[1] = y; o[2] = -r * Math.cos(a); return o; };
      // Projects a world point (meters, listener at the origin facing -z) to the screen: [x, y, depth].
      const proj = (x, y, z, o) => { const vx = x - CAM[0], vy = y - CAM[1], vz = z - CAM[2], d = vy * fw[1] + vz * fw[2]; o[0] = CX + F * vx / d; o[1] = CY - F * (vy * up[1] + vz * up[2]) / d; o[2] = d; return o; };
      const S = [0, 0, 0], Pp = [0, 0, 0], Q = [0, 0, 0], O = [0, 0, 0], O2 = [0, 0, 0];
      let rig = null;
      const A = clock(L, (A, a, b) => {
        const ac = A.ac;
        if (!rig || rig.ac !== ac) {
          const pn = ac.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 1.2; pn.rolloffFactor = 1; pn.connect(A.out);
          const bus = ac.createGain(); bus.gain.value = 2.2; bus.connect(pn);
          const sh = ac.createBufferSource(), hf = ac.createBiquadFilter(), hg = ac.createGain(); sh.buffer = noiseOf(A); sh.loop = true; hf.type = 'bandpass'; hf.frequency.value = 6000; hf.Q.value = 0.8; hg.gain.value = 0; sh.connect(hf); hf.connect(hg); hg.connect(bus); sh.start();
          rig = { ac, pn, bus, hg };
        }
        const o = O2;
        for (let T = Math.ceil(a / 0.04) * 0.04; T < b; T += 0.04) { pos(T, o); const t = A.at(T); rig.pn.positionX.linearRampToValueAtTime(o[0], t); rig.pn.positionY.linearRampToValueAtTime(o[1], t); rig.pn.positionZ.linearRampToValueAtTime(o[2], t); }
        for (let k = Math.ceil(a / 0.25); k * 0.25 < b; k++) {
          const T = k * 0.25, t = A.at(T), m = 62 + PENT14[k % 8] + (Math.floor(k / 8) % 2 ? 5 : 0);
          const os = ac.createOscillator(), gn = ac.createGain(); os.type = 'triangle'; os.frequency.value = mtof(m); env(gn, t, 0.003, 0.22, 0.3); os.connect(gn); gn.connect(rig.bus); os.start(t); os.stop(t + 0.4);
          rig.hg.gain.setTargetAtTime(k % 2 ? 0.05 : 0.11, t, 0.01); rig.hg.gain.setTargetAtTime(0.015, t + 0.03, 0.04);
        }
      }, 0.12);
      return (t) => {
        const T = A.time(t);
        if (L.p.orbit !== P) { ph0 = ang(T); T0 = T; P = L.p.orbit; }
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        // floor: distance rings and spokes
        g.lineWidth = 1;
        for (let r = 1; r <= 4; r++) { g.strokeStyle = `rgba(122,92,255,${0.32 - r * 0.05})`; g.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * TAU; proj(Math.sin(a) * r, FL, -Math.cos(a) * r, Q); if (i) g.lineTo(Q[0], Q[1]); else g.moveTo(Q[0], Q[1]); } g.stroke(); }
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; proj(Math.sin(a) * 0.6, FL, -Math.cos(a) * 0.6, Pp); proj(Math.sin(a) * 4, FL, -Math.cos(a) * 4, Q); g.strokeStyle = 'rgba(122,92,255,0.12)'; g.beginPath(); g.moveTo(Pp[0], Pp[1]); g.lineTo(Q[0], Q[1]); g.stroke(); }
        proj(0, FL, -0.7, Pp); proj(0, FL, -1.5, Q); g.strokeStyle = 'rgba(43,196,230,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(Pp[0], Pp[1]); g.lineTo(Q[0], Q[1]); g.stroke();
        // orbit path, then the source and head in depth order
        g.strokeStyle = 'rgba(255,176,32,0.22)'; g.lineWidth = 1.5; g.beginPath(); const o = O;
        for (let i = 0; i <= 120; i++) { pos(T + (i / 120 - 0.5) * P, o); proj(o[0], o[1], o[2], Q); if (i) g.lineTo(Q[0], Q[1]); else g.moveTo(Q[0], Q[1]); } g.stroke();
        pos(T, o); proj(o[0], o[1], o[2], S); proj(o[0], FL, o[2], Pp);
        proj(0, 0, 0, Q); const headD = Q[2], hs = F * 0.42 / headD;
        const drawHead = () => {
          g.fillStyle = '#2b2a3a'; g.beginPath(); g.ellipse(Q[0], Q[1] + hs * 1.25, hs * 1.7, hs * 0.75, 0, Math.PI, TAU); g.fill(); g.fillRect(Q[0] - hs * 1.7, Q[1] + hs * 1.24, hs * 3.4, hs * 0.5);
          g.fillStyle = '#e8b27a'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(Q[0] + sx * hs * 1.02, Q[1] + hs * 0.05, hs * 0.2, hs * 0.32, 0, 0, TAU); g.fill(); }
          g.fillStyle = '#f2c08a'; g.beginPath(); g.arc(Q[0], Q[1], hs, 0, TAU); g.fill();
          g.fillStyle = '#5a3b2a'; g.beginPath(); g.arc(Q[0], Q[1] - hs * 0.12, hs * 0.98, Math.PI * 1.02, Math.PI * 1.98); g.fill(); g.beginPath(); g.ellipse(Q[0], Q[1] - hs * 0.2, hs * 0.97, hs * 0.72, 0, 0, TAU); g.fill();
          g.fillStyle = C.bg; g.font = '600 10px Bahnschrift, Segoe UI'; g.textAlign = 'center'; g.fillText('YOU', Q[0], Q[1] + hs * 0.55);
        };
        const nearer = S[2] < headD;
        if (nearer) drawHead();
        g.strokeStyle = 'rgba(255,176,32,0.35)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(Pp[0], Pp[1]); g.stroke(); g.setLineDash([]);
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(Pp[0], Pp[1], 120 / Pp[2] * 3, 40 / Pp[2] * 3, 0, 0, TAU); g.fill();
        const sr = F * 0.2 / S[2], age = T % 0.25;
        g.strokeStyle = `rgba(255,176,32,${0.8 * (1 - age / 0.25)})`; g.lineWidth = 2; g.beginPath(); g.arc(S[0], S[1], sr * (1.2 + age * 9), 0, TAU); g.stroke();
        g.fillStyle = 'rgba(255,176,32,0.25)'; g.beginPath(); g.arc(S[0], S[1], sr * 2, 0, TAU); g.fill();
        g.fillStyle = C.amber; g.beginPath(); g.arc(S[0], S[1], sr, 0, TAU); g.fill(); g.fillStyle = C.cream; g.beginPath(); g.arc(S[0] - sr * 0.3, S[1] - sr * 0.3, sr * 0.35, 0, TAU); g.fill();
        if (!nearer) drawHead();
        // radar and readouts
        const RXc = 560, RYc = 250, RR = 58, dist = Math.hypot(o[0], o[1], o[2]), az = (Math.atan2(o[0], -o[2]) * 180 / Math.PI + 360) % 360, el = Math.asin(o[1] / dist) * 180 / Math.PI;
        g.fillStyle = 'rgba(29,27,58,0.55)'; g.beginPath(); g.arc(RXc, RYc, RR + 8, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(244,239,230,0.12)'; g.lineWidth = 1; for (const r of [RR / 2, RR]) { g.beginPath(); g.arc(RXc, RYc, r, 0, TAU); g.stroke(); }
        g.fillStyle = C.cyan; g.beginPath(); g.moveTo(RXc, RYc - 8); g.lineTo(RXc - 5, RYc + 5); g.lineTo(RXc + 5, RYc + 5); g.closePath(); g.fill();
        g.fillStyle = C.amber; g.beginPath(); g.arc(RXc + o[0] / 4 * RR, RYc + o[2] / 4 * RR, 5, 0, TAU); g.fill();
        g.font = '500 11px Cascadia Mono, Consolas'; g.textAlign = 'left'; g.fillStyle = 'rgba(244,239,230,0.7)';
        g.fillText(`azimuth   ${az.toFixed(0).padStart(3)}°`, 486, 64); g.fillText(`elevation ${el >= 0 ? ' ' : ''}${el.toFixed(0)}°`, 486, 82); g.fillText(`distance  ${dist.toFixed(1)} m`, 486, 100);
        g.fillStyle = 'rgba(244,239,230,0.45)'; g.fillText('top view, you face up', 486, 330);
        g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(A.live ? 'LIVE AUDIO  HRTF' : 'PREVIEW  press Play sound, use headphones', 16, 24);
      };
    },
  });

  // ---------- 15. Music box ----------
  const TEETH15 = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81];
  // Twinkle, Twinkle, Little Star (traditional): melody in quarter beats, a bass note every two beats. Pins: [beat, MIDI].
  const PINS15 = /** @type {[number, number][]} */ ([]);
  {
    const L1 = [72, 72, 79, 79, 81, 81, 79], L2 = [77, 77, 76, 76, 74, 74, 72], L3 = [79, 79, 77, 77, 76, 76, 74];
    const BASS = /** @type {number[][]} */ ([[60, 60, 65, 60], [65, 60, 67, 60], [60, 65, 60, 67], [60, 65, 60, 67], [60, 60, 65, 60], [65, 60, 67, 60]]);
    [L1, L2, L3, L3, L1, L2].forEach((ln, i) => { ln.forEach((m, j) => PINS15.push([i * 8 + j, m])); BASS[i].forEach((m, j) => PINS15.push([i * 8 + j * 2, m])); });
  }
  const LOOPB15 = 48;
  EX.add({
    cat: 'audio', id: 'au2-musicbox', title: 'Music box', aka: 'pin cylinder, comb and pins, mechanical music, wind-up melody', tool: 'Web Audio API (comb-tooth tones) + Canvas 2D', runs: 'CPU',
    notice: 'A brass cylinder turns slowly, and every pin on it is one note of Twinkle, Twinkle, Little Star. When a pin reaches the steel comb it lifts its tooth and lets go, the tooth rings and quivers, and that is exactly when you hear it. The tone is a sine plus the high, fast-fading overtone a vibrating steel tooth makes, so it sounds like a real wind-up box.',
    use: 'nostalgic intros, toy and holiday spots, explaining how mechanical sequencers work',
    params: [{ key: 'bpm', label: 'Tempo (BPM)', min: 50, max: 150, step: 2, value: 92 }],
    prompt: 'Mechanical music box playing Twinkle, Twinkle, Little Star at {bpm} BPM: a shaded brass cylinder seen from the front turns slowly, its pins drawn in perspective (smaller and squashed toward the edges), one column of pins per comb tooth (C4 to A5). When a pin reaches the steel comb it bends the tooth, releases it, and the tooth quivers with a decaying wobble and a glint, at the exact moment its note plays: a Web Audio sine plus an overtone at 6.27 times the pitch that fades fast, panned by tooth. Warm wooden box around it, note names under the teeth.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), CX0 = 112, CX1 = 528, CY = 128, R = 70, PC = -0.62, NT = TEETH15.length, TW = (CX1 - CX0) / NT, DPS = TAU / LOOPB15;
      const tx = i => CX0 + TW * (i + 0.5), ti = m => TEETH15.indexOf(m);
      let ph0 = 0, T0 = 0, BPM = L.p.bpm;
      const beat = T => ph0 + (T - T0) * BPM / 60;
      const A = clock(L, (A, a, b) => {
        const ba = beat(a), bb = beat(b);
        for (let k = Math.floor(ba / LOOPB15); k * LOOPB15 < bb; k++) for (const [pb, m] of PINS15) {
          const B = k * LOOPB15 + pb; if (B < ba || B >= bb) continue;
          const T = T0 + (B - ph0) * 60 / BPM, i = ti(m);
          strike(A, T, mtof(m), 0.2, 2.4 - i * 0.12, (i / (NT - 1) - 0.5) * 1.2, 6.27, 0.16);
          V.noise(A, T, 7000, 'highpass', 0.04, 0.012);
        }
      }, 0.3);
      const brass = g.createLinearGradient(0, CY - R, 0, CY + R); [[0, '#3d2a0c'], [0.22, '#8a6420'], [0.4, '#f6d06a'], [0.55, '#c99a3a'], [0.85, '#5e420f'], [1, '#2a1c06']].forEach(([s, c]) => brass.addColorStop(/** @type {number} */ (s), /** @type {string} */ (c)));
      const wood = g.createLinearGradient(0, 0, 0, H); wood.addColorStop(0, '#2a1a12'); wood.addColorStop(1, '#170e09');
      const steel = g.createLinearGradient(0, 170, 0, 296); steel.addColorStop(0, '#d9dce3'); steel.addColorStop(0.45, '#8d929e'); steel.addColorStop(1, '#4a4e58');
      const hit = new Float32Array(NT), lift = new Float32Array(NT);
      return (t) => {
        const T = A.time(t);
        if (L.p.bpm !== BPM) { ph0 = beat(T); T0 = T; BPM = L.p.bpm; }
        const bn = beat(T), sec = 60 / BPM;
        g.fillStyle = wood; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(255,200,150,0.04)'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(0, 30 + i * 38); g.bezierCurveTo(200, 20 + i * 38 + 14, 440, 44 + i * 38 - 14, 640, 30 + i * 38); g.stroke(); }
        // cylinder body and end caps
        g.fillStyle = '#1a1209'; g.fillRect(CX0 - 26, CY - 8, 18, 16); g.fillRect(CX1 + 8, CY - 8, 18, 16);
        g.fillStyle = brass; g.fillRect(CX0, CY - R, CX1 - CX0, 2 * R);
        for (const x of [CX0, CX1]) { g.fillStyle = '#4a3410'; g.beginPath(); g.ellipse(x, CY, 9, R, 0, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(40,26,6,0.35)'; for (const x of [CX0 + 10, CX1 - 12]) g.fillRect(x, CY - R, 2, 2 * R);
        // pins: angle 0 faces the viewer; a pin reaches the comb at angle PC
        hit.fill(9); lift.fill(0);
        for (let k = Math.floor(bn / LOOPB15) - 1; k <= Math.floor(bn / LOOPB15) + 1; k++) for (const [pb, m] of PINS15) {
          const B = k * LOOPB15 + pb, i = ti(m), ps = PC + (B - bn) * DPS, c = Math.cos(ps);
          if (bn >= B) hit[i] = Math.min(hit[i], (bn - B) * sec); else if (B - bn < 0.18) lift[i] = Math.max(lift[i], 1 - (B - bn) / 0.18);
          if (c <= 0.05) continue;
          const x = tx(i), y = CY - R * Math.sin(ps), r = 2.6 + 1.6 * c;
          g.fillStyle = `rgba(40,26,6,${0.5 * c})`; g.beginPath(); g.ellipse(x + 1, y + 1.5, r, r * c * 0.8 + 0.6, 0, 0, TAU); g.fill();
          g.fillStyle = bn >= B ? '#b9bdc6' : '#eef0f5'; g.beginPath(); g.ellipse(x, y, r, r * c + 0.5, 0, 0, TAU); g.fill();
        }
        // comb: base plate and one tooth per note, longer for low notes
        const tipY = CY - R * Math.sin(PC) + 4;
        g.fillStyle = steel; g.fillRect(CX0 - 10, 268, CX1 - CX0 + 20, 26); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(CX0 - 10, 268, CX1 - CX0 + 20, 1.5);
        for (let i = 0; i < NT; i++) {
          const x = tx(i), age = hit[i], wob = age < 2 ? 5 * Math.exp(-age * 3.2) * Math.sin(age * 55) : 0, up = -6 * lift[i] * lift[i], tipx = x, tipy = tipY + up + wob, base = 268;
          g.fillStyle = steel; g.beginPath(); g.moveTo(x - TW * 0.27, base); g.lineTo(x + TW * 0.27, base); g.lineTo(tipx + TW * 0.17, tipy); g.lineTo(tipx - TW * 0.17, tipy); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - TW * 0.25, base); g.lineTo(tipx - TW * 0.15, tipy + 1); g.stroke();
          if (age < 0.6) { const gl = 1 - age / 0.6; g.fillStyle = `rgba(255,236,190,${0.65 * gl})`; g.beginPath(); g.moveTo(x - TW * 0.27, base); g.lineTo(x + TW * 0.27, base); g.lineTo(tipx + TW * 0.17, tipy); g.lineTo(tipx - TW * 0.17, tipy); g.closePath(); g.fill();
            g.fillStyle = `rgba(255,240,200,${0.8 * gl})`; g.beginPath(); g.arc(tipx, tipy - 2, 3 + 10 * (1 - gl), 0, TAU); g.fill(); }
          g.font = '500 9px Cascadia Mono, Consolas'; g.textAlign = 'center'; g.fillStyle = 'rgba(244,239,230,0.55)';
          const m = TEETH15[i]; g.fillText(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][m % 12] + (Math.floor(m / 12) - 1), x, 310);
        }
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(CX0 - 10, 294, CX1 - CX0 + 20, 3);
        g.textAlign = 'left'; g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', 16, 24);
        g.textAlign = 'right'; g.fillText('Twinkle, Twinkle, Little Star (traditional)', W - 16, 24);
        g.font = 'italic 13px Georgia'; g.fillStyle = 'rgba(255,214,160,0.35)'; g.textAlign = 'center'; g.fillText('Motion Studio', W / 2, 342); g.textAlign = 'left';
      };
    },
  });

  // ---------- 16. Granular cloud ----------
  const SR16 = 24000, LEN16 = 2.5, GD16 = 0.14;
  // The source sound: an A minor 9 chord whose notes enter one by one and swell, so the strip has a shape to scan.
  function chord16() {
    const n = Math.round(LEN16 * SR16), out = new Float32Array(n), notes = [220, 261.63, 329.63, 392, 493.88];
    notes.forEach((f, k) => { let p = 0; const t0 = k * 0.35; for (let i = 0; i < n; i++) { const t = i / SR16; if (t < t0) continue; p += TAU * f * (1 + 0.003 * Math.sin(t * 5 + k)) / SR16; const e = Math.min(1, (t - t0) / 0.15) * (0.55 + 0.45 * Math.sin(t * 2.2 + k)) * Math.min(1, (LEN16 - t) / 0.2); out[i] += e * (Math.sin(p) + 0.35 * Math.sin(2 * p) + 0.18 * Math.sin(3 * p)) * 0.16; } });
    return out;
  }
  const hash16 = (k, s) => { const x = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
  EX.add({
    cat: 'audio', id: 'au2-granular', title: 'Granular cloud', aka: 'granular synthesis, time stretch, grain cloud, microsound', tool: 'Web Audio API (AudioBufferSourceNode grains) + Canvas 2D', runs: 'CPU',
    notice: 'A slow scan head crawls along a short chord, and dozens of times a second a tiny slice (a grain) is cut near it, faded in and out, sometimes shifted a fifth or an octave, and played. Each grain is born as a particle at the spot it was cut from and floats up while it sounds, so the cloud you see is the cloud you hear. Because the head moves slower than real time, the chord is stretched out without dropping in pitch.',
    use: 'ambient pads, sound design textures, film tension beds, explaining time stretching',
    params: [
      { key: 'density', label: 'Grains per second', min: 5, max: 60, step: 1, value: 28 },
      { key: 'spray', label: 'Position spray (s)', min: 0, max: 0.5, step: 0.02, value: 0.12, unit: ' s' },
      { key: 'stretch', label: 'Time stretch (x)', min: 1, max: 20, step: 1, value: 8 },
    ],
    prompt: 'Granular synthesis you can see: synthesize a 2.5 s A minor 9 chord, show its waveform as a strip, and move a scan head across it {stretch} times slower than real time. Cut {density} grains per second of 140 ms with a fade in and out, each from the head position plus up to {spray} of random spray, some shifted up a fifth or an octave, and play each with a Web Audio AudioBufferSourceNode at a scheduled time. Draw every grain as a particle born on the strip where it was cut, rising and fading, bright while it sounds, colored by its pitch shift; shade the spray window around the head.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), src = chord16(), SX = 20, SW = 600, SY = 288, SH = 48, NW = 300, env = new Float32Array(NW), SHIFTS = [0, 0, 0, 7, 12, -5];
      for (let i = 0; i < NW; i++) { let m = 0; const a = Math.floor(i / NW * src.length), b2 = Math.floor((i + 1) / NW * src.length); for (let j = a; j < b2; j++) m = Math.max(m, Math.abs(src[j])); env[i] = m; }
      let ph0 = 0, T0 = 0, ST = L.p.stretch, DEN = L.p.density;
      const scan = T => ph0 + (T - T0) / ST; // source position in seconds, wraps over LEN16
      // Grain k starts at k / density; its source position, pitch shift and pan come from a hash of k, so sound and picture agree.
      let kb = 0, Tb = 0;
      const grain = (k, o) => { const T = Tb + (k - kb) / DEN, p = scan(T) + (hash16(k, 1) - 0.5) * 2 * L.p.spray, sh = SHIFTS[Math.floor(hash16(k, 2) * SHIFTS.length)]; o.T = T; o.pos = ((p % LEN16) + LEN16) % LEN16; o.sh = sh; o.pan = hash16(k, 3) * 2 - 1; return o; };
      const G = { T: 0, pos: 0, sh: 0, pan: 0 };
      let buf = null;
      const A = clock(L, (A, a, b) => {
        const ac = A.ac;
        if (!buf || buf.ac !== ac) { const B = ac.createBuffer(1, src.length, SR16); B.getChannelData(0).set(src); buf = { ac, B }; }
        for (let k = Math.ceil(kb + (a - Tb) * DEN); ; k++) {
          grain(k, G); if (G.T >= b) break; if (G.T < a) continue;
          const t = A.at(G.T), s = ac.createBufferSource(), gn = ac.createGain(), p = ac.createStereoPanner(), rate = Math.pow(2, G.sh / 12);
          s.buffer = buf.B; s.playbackRate.value = rate; p.pan.value = G.pan * 0.7; gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(0.5, t + GD16 / 2); gn.gain.linearRampToValueAtTime(0, t + GD16);
          s.connect(gn); gn.connect(p); p.connect(A.out); s.start(t, Math.min(G.pos, LEN16 - GD16 * rate - 0.01), GD16 * rate + 0.01);
        }
      }, 0.12);
      return (t) => {
        const T = A.time(t);
        if (L.p.stretch !== ST) { ph0 = scan(T); T0 = T; ST = L.p.stretch; }
        if (L.p.density !== DEN) { kb = Math.ceil(kb + (T - Tb) * DEN); Tb = T; DEN = L.p.density; }
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const xs = p => SX + SW * p / LEN16, head = ((scan(T) % LEN16) + LEN16) % LEN16;
        // waveform strip, spray window and scan head
        g.fillStyle = 'rgba(29,27,58,0.6)'; g.beginPath(); g.roundRect(SX - 6, SY - SH / 2 - 8, SW + 12, SH + 16, 8); g.fill();
        g.fillStyle = 'rgba(122,92,255,0.18)'; const s0 = xs(head - L.p.spray), s1 = xs(head + L.p.spray); g.fillRect(s0, SY - SH / 2, s1 - s0, SH); if (s0 < SX) g.fillRect(s0 + SW, SY - SH / 2, SX - s0, SH); if (s1 > SX + SW) g.fillRect(SX, SY - SH / 2, s1 - SX - SW, SH);
        for (let i = 0; i < NW; i++) { const h = env[i] * SH * 0.9; g.fillStyle = 'rgba(244,239,230,0.4)'; g.fillRect(SX + i * SW / NW, SY - h / 2, SW / NW - 0.6, Math.max(1, h)); }
        g.fillStyle = C.cream; g.fillRect(xs(head) - 1, SY - SH / 2 - 10, 2, SH + 20);
        // grains born in the last 1.6 s
        const kNow = Math.floor(kb + (T - Tb) * DEN);
        for (let k = kNow - Math.ceil(1.6 * DEN); k <= kNow; k++) {
          grain(k, G); const age = T - G.T; if (age < 0 || age > 1.6) continue;
          const x0 = xs(G.pos), x = x0 + G.pan * 60 * age + Math.sin(k * 1.7 + age * 3) * 8 * age, y = SY - SH / 2 - 6 - age * 140 - age * age * 20, on = age < GD16, w = on ? Math.sin(Math.PI * age / GD16) : 0, fade = 1 - age / 1.6;
          const col = G.sh > 0 ? (G.sh >= 12 ? '255,176,32' : '255,90,54') : G.sh < 0 ? '122,92,255' : '43,196,230';
          g.fillStyle = `rgba(${col},${0.25 * fade})`; g.beginPath(); g.arc(x, y, 5 + 9 * w + 3 * age, 0, TAU); g.fill();
          g.fillStyle = `rgba(${col},${0.35 + 0.65 * Math.max(w, fade * 0.6)})`; g.beginPath(); g.arc(x, y, 2 + 2.5 * w, 0, TAU); g.fill();
          if (on) { g.strokeStyle = `rgba(244,239,230,${0.7 * w})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, SY - SH / 2); g.lineTo(x, y); g.stroke(); }
        }
        // legend and status
        g.font = '500 11px Cascadia Mono, Consolas'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        const leg = /** @type {[string, string][]} */ ([['43,196,230', 'same pitch'], ['255,90,54', '+ fifth'], ['255,176,32', '+ octave'], ['122,92,255', '- fourth']]);
        leg.forEach(([c, l], i) => { g.fillStyle = `rgb(${c})`; g.beginPath(); g.arc(24 + i * 104, 346, 4, 0, TAU); g.fill(); g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(l, 34 + i * 104, 350); });
        g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', 16, 24);
        g.textAlign = 'right'; g.fillText(`${L.p.density} grains/s, ${L.p.stretch}x slower, pitch kept`, W - 16, 24); g.textAlign = 'left';
      };
    },
  });

  // ---------- 17. Marble xylophone ----------
  const BARS17 = [60, 64, 67, 72, 74, 76, 77, 79], FLY17 = 1.0, GRAV17 = 900;
  // Ode to Joy (Beethoven, public domain), melody and a bass note per bar: [beat, MIDI, launcher 0 left / 1 right].
  const HITS17 = /** @type {[number, number, number][]} */ ([]);
  {
    const P1 = [[76, 1], [76, 1], [77, 1], [79, 1], [79, 1], [77, 1], [76, 1], [74, 1], [72, 1], [72, 1], [74, 1], [76, 1]], E1 = [[76, 1.5], [74, 0.5], [74, 2]], E2 = [[74, 1.5], [72, 0.5], [72, 2]];
    let b = 0; for (const [m, d] of [...P1, ...E1, ...P1, ...E2]) { HITS17.push([b, m, 0]); b += d; }
    [60, 67, 60, 67, 60, 67, 60, 60].forEach((m, i) => HITS17.push([i * 4, m, 1]));
  }
  const LOOPB17 = 32;
  EX.add({
    cat: 'audio', id: 'au2-marbles', title: 'Marble xylophone', aka: 'Animusic style, marble machine, ballistic timing, music machine', tool: 'Web Audio API (struck bars) + Canvas 2D ballistics', runs: 'CPU',
    notice: 'Two launchers play Ode to Joy by throwing marbles at xylophone bars. Every throw is solved backwards from its note: the marble leaves exactly one second early, on the arc that gravity bends onto the right bar at the right instant, and the bar rings, glows and kicks the marble away. The launchers swing to aim and recoil on each shot, so the next note is visible a second before you hear it.',
    use: 'music videos, Animusic-style showpieces, kids content, explaining projectile motion',
    params: [{ key: 'bpm', label: 'Tempo (BPM)', min: 60, max: 150, step: 2, value: 108 }],
    prompt: 'Animusic-style marble xylophone: two launchers (left plays the melody of Ode to Joy, right plays a bass note per bar) at {bpm} BPM. Solve each throw backwards: a marble leaves 1 s before its note on the ballistic arc (gravity 900 px/s^2) that lands it on the right bar exactly when the note plays. Bars are rosewood with metal resonator tubes; a struck bar rings (Web Audio sine plus a 4x partial), glows and dips, and the marble bounces away and falls out of frame. Launchers ease round to aim at the next target and recoil on each shot. Dark stage, marbles colored by bar.',
    controls: soundControls(),
    setup(cv, L) {
      const g = cv.getContext('2d'), NB = BARS17.length, BY = 262, LP = [[46, 168], [594, 168]], cols = BARS17.map((_, i) => ramp([C.coral, C.amber, C.green, C.cyan, C.violet], i / (NB - 1)).join(','));
      const bx = i => 150 + i * 48, BW = 40, bl = i => 60 - i * 4;
      let ph0 = 0, T0 = 0, BPM = L.p.bpm;
      const beat = T => ph0 + (T - T0) * BPM / 60, timeOf = B => T0 + (B - ph0) * 60 / BPM;
      const A = clock(L, (A, a, b) => {
        const ba = beat(a), bb = beat(b);
        for (let k = Math.floor(ba / LOOPB17); k * LOOPB17 < bb; k++) for (const [hb, m] of HITS17) {
          const B = k * LOOPB17 + hb; if (B < ba || B >= bb) continue; const i = BARS17.indexOf(m);
          strike(A, timeOf(B), mtof(m), 0.24, 1.3 - i * 0.08, (bx(i) - 320) / 320, 4, 0.2); V.noise(A, timeOf(B), 3000, 'bandpass', 0.06, 0.015, 2);
        }
      }, 0.15);
      const tgt = [0, 0], ring = new Float32Array(BARS17.length), aim = new Int8Array(2), aimT = new Float64Array(2), last = new Float64Array(2);
      // Launch velocity that lands on bar i after FLY17 seconds.
      const vel = (li, i) => { const [lx, ly] = LP[li], tx = bx(i), ty = BY - 8; tgt[0] = (tx - lx) / FLY17; tgt[1] = (ty - ly - 0.5 * GRAV17 * FLY17 * FLY17) / FLY17; return tgt; };
      return (t) => {
        const T = A.time(t);
        if (L.p.bpm !== BPM) { ph0 = beat(T); T0 = T; BPM = L.p.bpm; }
        const bn = beat(T), k0 = Math.floor(bn / LOOPB17);
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        // bars and resonators
        ring.fill(0); aim[0] = aim[1] = -1; aimT[0] = aimT[1] = 1e9; last[0] = last[1] = -1e9;
        for (let k = k0 - 1; k <= k0 + 1; k++) for (const [hb, m] of HITS17) { const age = (T - timeOf(k * LOOPB17 + hb)); if (age >= 0 && age < 1.2) { const i = BARS17.indexOf(m); ring[i] = Math.max(ring[i], 1 - age / 1.2); } }
        for (let i = 0; i < NB; i++) {
          const x = bx(i), r = ring[i], dip = r > 0.85 ? (r - 0.85) / 0.15 * 4 : 0;
          g.fillStyle = '#3b3f4a'; g.fillRect(x - 8, BY + 18, 16, bl(i)); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x - 6, BY + 18, 3, bl(i));
          if (r > 0) { g.fillStyle = `rgba(${cols[i]},${0.35 * r})`; g.beginPath(); g.ellipse(x, BY + 6, 34 + 10 * r, 16 + 6 * r, 0, 0, TAU); g.fill(); }
          g.fillStyle = r > 0 ? `rgb(${ramp(['#7a3b22', '#f4efe6'], Math.min(1, r * 0.8)).join(',')})` : '#7a3b22'; g.beginPath(); g.roundRect(x - BW / 2, BY + dip, BW, 16, 4); g.fill();
          g.fillStyle = `rgba(${cols[i]},0.9)`; g.fillRect(x - BW / 2 + 4, BY + dip + 13, BW - 8, 3);
          g.font = '500 9px Cascadia Mono, Consolas'; g.textAlign = 'center'; g.fillStyle = 'rgba(244,239,230,0.5)'; const m = BARS17[i]; g.fillText(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][m % 12] + (Math.floor(m / 12) - 1), x, BY + 32 + bl(i));
        }
        // marbles in flight, and after the hit bouncing away
        for (let k = k0 - 1; k <= k0 + 1; k++) for (const [hb, m, li] of HITS17) {
          const th = timeOf(k * LOOPB17 + hb), tl = th - FLY17, i = BARS17.indexOf(m), [lx, ly] = LP[li];
          if (tl > T && tl < aimT[li]) { aimT[li] = tl; aim[li] = i; }
          if (tl <= T && tl > last[li]) last[li] = tl;
          const u = T - tl; if (u < 0 || u > FLY17 + 0.9) continue;
          const [vx, vy] = vel(li, i); let x, y;
          if (u <= FLY17) { x = lx + vx * u; y = ly + vy * u + 0.5 * GRAV17 * u * u; }
          else { const w = u - FLY17, ux = vx * 0.35 + (li ? -60 : 60), uy = -(vy + GRAV17 * FLY17) * 0.42; x = bx(i) + ux * w; y = BY - 8 + uy * w + 0.5 * GRAV17 * w * w; }
          if (y > H + 10) continue;
          g.fillStyle = `rgba(${cols[i]},0.25)`; g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill();
          g.fillStyle = `rgb(${cols[i]})`; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x - 2, y - 2, 2, 0, TAU); g.fill();
        }
        // launchers: aim at the next shot with an eased swing, recoil after each shot
        for (let li = 0; li < 2; li++) {
          const [lx, ly] = LP[li]; let ang = li ? -2.2 : -0.9;
          if (aim[li] >= 0) { const [vx, vy] = vel(li, aim[li]); ang = Math.atan2(vy, vx); }
          const rec = Math.exp(-Math.max(0, T - last[li]) * 12) * 10;
          g.save(); g.translate(lx, ly); g.rotate(ang);
          g.fillStyle = '#2b2a3a'; g.beginPath(); g.roundRect(-14 - rec, -11, 52, 22, 6); g.fill(); g.fillStyle = li ? C.cyan : C.coral; g.fillRect(28 - rec, -11, 8, 22);
          g.restore(); g.fillStyle = '#3b3a4c'; g.beginPath(); g.arc(lx, ly, 16, 0, TAU); g.fill(); g.fillRect(lx - 6, ly, 12, BY + 60 - ly);
        }
        g.textAlign = 'left'; g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText(A.live ? 'LIVE AUDIO' : 'PREVIEW  press Play sound', 16, 24);
        g.textAlign = 'right'; g.fillText('Ode to Joy (Beethoven)', W - 16, 24); g.textAlign = 'left';
      };
    },
  });
})();
