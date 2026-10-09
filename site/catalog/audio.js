/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Audio-reactive demo for Motion Examples.html: a Web Audio synth beat drives the visuals.
(function () {
  const { C, PAL, lerp } = EX;

  // Builds a small 120 BPM synth loop and returns { ctx, analyser, stop }.
  function startBeat() {
    const ctx = new AudioContext(); const master = ctx.createGain(); master.gain.value = 0.55;
    const an = ctx.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.75; master.connect(an); an.connect(ctx.destination);
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const kick = t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); env(g, t, 0.002, 1.0, 0.32); o.connect(g).connect(master); o.start(t); o.stop(t + 0.4); };
    const noise = (t, f, type, peak, d) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; env(g, t, 0.001, peak, d); s.connect(fl).connect(g).connect(master); s.start(t); s.stop(t + d + 0.05); };
    const bass = (t, f) => { const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(180, t + 0.2); fl.Q.value = 6; env(g, t, 0.005, 0.35, 0.2); o.connect(fl).connect(g).connect(master); o.start(t); o.stop(t + 0.3); };
    const stab = (t, fs) => fs.forEach(f => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; env(g, t, 0.01, 0.07, 0.35); o.connect(g).connect(master); o.start(t); o.stop(t + 0.45); });
    const prog = /** @type {[number, number[]][]} */ ([[55, [220, 261.6, 329.6]], [43.65, [174.6, 220, 261.6]], [65.4, [196, 261.6, 329.6]], [49, [196, 246.9, 293.7]]]);
    const step = 0.125; let next = ctx.currentTime + 0.05, n = 0;
    const timer = setInterval(() => {
      while (next < ctx.currentTime + 0.2) {
        const s = n % 16, bar = Math.floor(n / 16) % 4, [b, ch] = prog[bar];
        if (s % 4 === 0) kick(next);
        if (s % 4 === 2) noise(next, 8000, 'highpass', 0.25, 0.05);
        if (s % 2 === 1) noise(next, 9000, 'highpass', 0.08, 0.025);
        if (s === 4 || s === 12) noise(next, 1600, 'bandpass', 0.6, 0.14);
        if (s % 2 === 0) bass(next, s % 8 === 6 ? b * 2 : b);
        if (s === 0 || s === 7 || s === 10) stab(next, ch);
        next += step; n++;
      }
    }, 40);
    return { ctx, an, stop() { clearInterval(timer); ctx.close(); } };
  }

  EX.add({
    cat: 'audio', id: 'reactive', title: 'Audio-reactive visuals', aka: 'music visualizer, beat-reactive motion, sound-driven animation', tool: 'Web Audio API (analyser) + Canvas 2D', runs: 'CPU',
    notice: 'Press "Play sound": a 120 BPM beat is synthesized live, and an analyser splits it into frequency bands every frame. Bass drives the pulse and the particle bursts, highs drive the outer bars. Without sound it runs on a stand-in signal.',
    use: 'music videos, live visuals, podcasts, beat-synced social clips',
    prompt: 'Audio-reactive visual for my track (path): circular spectrum bars, the center pulses on the kick, particle bursts on every snare, colors shift each bar. Render 1080p60 synced to the audio.',
    controls: [{ label: 'Play sound', group: false, fn: L => L.state.play() }, { label: 'Stop', group: false, fn: L => L.state.stop() }],
    setup(cv, L) {
      const g = cv.getContext('2d'); let audio = null; const bins = new Uint8Array(256); const parts = []; let lastBass = 0;
      L.state = { play() { if (!audio) audio = startBeat(); }, stop() { if (audio) { audio.stop(); audio = null; } } };
      return (t, dt) => {
        if (audio) audio.an.getByteFrequencyData(bins);
        else for (let i = 0; i < 256; i++) { const kick = Math.exp(-((t % 0.5)) * 10); bins[i] = Math.max(0, Math.min(255, (i < 12 ? 220 * kick : 140 * Math.exp(-i / 60)) * (0.6 + 0.4 * Math.sin(t * 3 + i * 0.3)))); }
        let bass = 0; for (let i = 1; i < 8; i++) bass += bins[i]; bass /= 7 * 255;
        if (bass > 0.62 && lastBass <= 0.62) for (let k = 0; k < 26; k++) { const a = Math.random() * 7; parts.push({ x: 320, y: 180, vx: Math.cos(a) * (2 + Math.random() * 4), vy: Math.sin(a) * (2 + Math.random() * 4), life: 1, c: PAL[k % 4] }); }
        lastBass = bass;
        g.fillStyle = `rgba(11,11,16,${0.35})`; g.fillRect(0, 0, 640, 360);
        const R = 70 + bass * 26, N = 96, hue = Math.floor(t / 2) % 4;
        for (let i = 0; i < N; i++) {
          const v = bins[Math.floor(4 + i / N * 150)] / 255, a = i / N * Math.PI * 2 - Math.PI / 2, len = 6 + v * 90;
          g.strokeStyle = i % 2 ? PAL[hue] : PAL[(hue + 1) % 4]; g.lineWidth = 3; g.lineCap = 'round';
          g.beginPath(); g.moveTo(320 + Math.cos(a) * (R + 8), 180 + Math.sin(a) * (R + 8)); g.lineTo(320 + Math.cos(a) * (R + 8 + len), 180 + Math.sin(a) * (R + 8 + len)); g.stroke();
        }
        g.fillStyle = PAL[hue]; g.globalAlpha = 0.9; g.beginPath(); g.arc(320, 180, R, 0, 7); g.fill(); g.globalAlpha = 1;
        g.fillStyle = C.bg; g.font = '700 22px Bahnschrift'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(audio ? 'LIVE' : 'PREVIEW', 320, 182); g.textAlign = 'left';
        for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.life -= dt * 1.2; if (p.life <= 0) { parts.splice(i, 1); continue; } g.fillStyle = p.c; g.globalAlpha = p.life; g.beginPath(); g.arc(p.x, p.y, 3 + 3 * p.life, 0, 7); g.fill(); }
        g.globalAlpha = 1; g.font = '500 13px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.5)'; g.fillText(`bass ${bass.toFixed(2)}`, 20, 340);
        void lerp;
      };
    },
  });
})();
