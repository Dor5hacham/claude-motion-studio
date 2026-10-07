// Text motion demos for Motion Examples.html (Canvas 2D).
(function () {
  const { C, seg, lerp, ease, clamp01 } = EX;
  const MONO = '"Cascadia Mono", Consolas, monospace', DISP = 'Bahnschrift, "Segoe UI", sans-serif', UI = '"Segoe UI", sans-serif';
  const bg = (g, w, h, col = C.bg) => { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = col; g.fillRect(0, 0, w, h); };

  EX.add({
    cat: 'type', id: 'scramble', title: 'Scramble decode', aka: 'text decode, hacker text, cipher reveal', tool: 'Canvas 2D or CSS + JS', runs: 'CPU',
    notice: 'Each letter cycles random glyphs, then locks into place. The lock time is staggered left to right, so the word resolves like a wave.',
    use: 'tech product intros, loading states, title cards',
    prompt: "Scramble-decode the headline \"SHIP IT\": random glyphs for 0.5 s, letters lock in left to right {stg} apart, cyan monospace on near-black.",
    params: [{"key": "stg", "label": "Lock-in stagger", "min": 0.01, "max": 0.2, "step": 0.01, "value": 0.06, "unit": " s"}], setup(cv, L) {
      const g = cv.getContext('2d'); const words = ['MOTION DESIGN', 'GPU PARTICLES', 'RAY MARCHING', 'MADE WITH CODE'];
      const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=?/<>';
      return t => {
        bg(g, 640, 360); const cyc = 3.2, k = Math.floor(t / cyc) % words.length, lt = t % cyc, w = words[k];
        g.font = `700 46px ${MONO}`; g.textBaseline = 'middle';
        const cw = g.measureText('M').width + 2, x0 = 320 - (w.length * cw) / 2;
        const out = seg(lt, 2.6, 3.1);
        for (let i = 0; i < w.length; i++) {
          if (w[i] === ' ') continue;
          const lock = 0.35 + i * L.p.stg, unlock = 2.6 + i * 0.025;
          const locked = lt >= lock && lt < unlock;
          const ch = locked ? w[i] : glyphs[Math.floor((Math.sin(i * 91.7 + Math.floor(t * 18) * 12.3) * 0.5 + 0.5) * glyphs.length) % glyphs.length];
          g.fillStyle = locked ? C.cream : (lt < lock ? 'rgba(43,196,230,0.85)' : `rgba(43,196,230,${1 - out})`);
          if (lt > unlock && out >= 1) continue;
          g.fillText(ch, x0 + i * cw, 180);
          if (locked && lt - lock < 0.12) { g.fillStyle = 'rgba(43,196,230,0.35)'; g.fillRect(x0 + i * cw - 2, 152, cw - 2, 56); }
        }
        g.font = `500 14px ${MONO}`; g.fillStyle = 'rgba(244,239,230,0.4)'; g.fillText('// ' + (k + 1) + ' / ' + words.length, 40, 330);
      };
    },
  });

  EX.add({
    cat: 'type', id: 'splitflap', title: 'Split-flap board', aka: 'Solari board, flip display, departure board', tool: 'Canvas 2D', runs: 'CPU',
    notice: 'Every tile flips through the alphabet until it reaches its letter. The top flap folds down, then the bottom flap lands. Columns start a little apart.',
    use: 'announcements, countdowns, retro or travel themes',
    prompt: "Split-flap departure board, 3 rows x 14 tiles, each flip takes {flip}, flips through the alphabet to \"NOW BOARDING\", columns staggered 40 ms, with a soft click sound per flip.",
    params: [{"key": "flip", "label": "Time per flip", "min": 0.02, "max": 0.15, "step": 0.005, "value": 0.055, "unit": " s", "dec": 3}], setup(cv, L) {
      const g = cv.getContext('2d'); const A = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-';
      const msgs = [['CLAUDE MOTION ', ' GALLERY 2026 ', 'NOW SHOWING   '], ['FLIGHT CL 042 ', 'TO   SHADERS  ', 'GATE 7  ON TIME'], ['SPLIT FLAP   ', 'EVERY TILE    ', 'FLIPS TO A-Z  ']];
      const R = 3, N = 14, tw = 38, th = 58, gx = 4, gy = 10, x0 = (640 - N * (tw + gx)) / 2, y0 = 70;
      function tile(x, y, cur, nxt, f) {
        g.fillStyle = '#1a1a22'; g.fillRect(x, y, tw, th);
        g.font = `700 40px ${DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const half = (ch, top, sy) => {
          g.save(); g.beginPath(); g.rect(x, top ? y : y + th / 2, tw, th / 2); g.clip();
          g.translate(0, y + th / 2); g.scale(1, sy); g.translate(0, -(y + th / 2));
          g.fillStyle = top ? '#22222c' : '#1d1d26'; g.fillRect(x, y, tw, th); g.fillStyle = C.cream; g.fillText(ch, x + tw / 2, y + th / 2 + 2); g.restore();
        };
        half(nxt, true, 1); half(cur, false, 1);
        if (f < 0.5) half(cur, true, 1 - f * 2); else half(nxt, false, (f - 0.5) * 2);
        g.fillStyle = '#000'; g.fillRect(x, y + th / 2 - 1, tw, 2);
      }
      return t => {
        bg(g, 640, 360, '#0d0d12'); const cyc = 4.2, k = Math.floor(t / cyc) % msgs.length, lt = t % cyc;
        const prev = msgs[(k + msgs.length - 1) % msgs.length], cur = msgs[k];
        for (let r = 0; r < R; r++) for (let c = 0; c < N; c++) {
          const pi = Math.max(0, A.indexOf((prev[r][c] || ' '))), ti = Math.max(0, A.indexOf((cur[r][c] || ' ')));
          const flips = (ti - pi + A.length) % A.length, d = c * 0.04 + r * 0.08;
          const steps = Math.max(0, (lt - d) / L.p.flip); const n = Math.min(flips, Math.floor(steps));
          const a = A[(pi + n) % A.length], b = A[(pi + Math.min(flips, n + 1)) % A.length];
          tile(x0 + c * (tw + gx), y0 + r * (th + gy), a, b, n >= flips ? 0 : steps - Math.floor(steps));
        }
        g.textAlign = 'left';
      };
    },
  });

  EX.add({
    cat: 'type', id: 'varfont', title: 'Variable font wave', aka: 'variable type, weight animation, font axis animation', tool: 'Canvas 2D or CSS font-variation-settings', runs: 'CPU',
    notice: 'A variable font holds every weight from thin to bold in one file. Here each letter\'s weight follows a sine wave, so the boldness travels through the word.',
    use: 'brand headlines, music visuals, editorial intros',
    prompt: "Animate a variable font: the weight of each letter in \"FLUID\" waves from {lo} to {hi}, the wave travels left to right every 1.2 s, slight vertical bob.",
    params: [{"key": "lo", "label": "Lightest weight", "min": 300, "max": 700, "step": 10, "value": 300}, {"key": "hi", "label": "Boldest weight", "min": 300, "max": 700, "step": 10, "value": 700}], setup(cv, L) {
      const g = cv.getContext('2d'); const word = 'VARIABLE';
      return t => {
        bg(g, 640, 360); g.textBaseline = 'alphabetic';
        const ws = [...word].map((ch, i) => { const wgt = Math.round(L.p.lo + (L.p.hi - L.p.lo) * (0.5 + 0.5 * Math.sin(t * 3 - i * 0.7))); g.font = `${wgt} 104px ${DISP}`; return { ch, wgt, w: g.measureText(ch).width }; });
        const total = ws.reduce((s, l) => s + l.w, 0); let x = 320 - total / 2;
        ws.forEach((l, i) => { g.font = `${l.wgt} 104px ${DISP}`; const k = (l.wgt - 300) / 400; g.fillStyle = `rgb(${lerp(244, 255, k)},${lerp(239, 90, k)},${lerp(230, 54, k)})`; g.fillText(l.ch, x, 210 + Math.sin(t * 3 - i * 0.7) * 8); x += l.w; });
        g.font = `500 15px ${MONO}`; g.fillStyle = 'rgba(244,239,230,0.45)'; g.textAlign = 'center';
        g.fillText('Bahnschrift  wght 300 ↔ 700', 320, 300); g.textAlign = 'left';
      };
    },
  });

  EX.add({
    cat: 'type', id: 'captions', title: 'Word-by-word captions', aka: 'karaoke captions, kinetic subtitles, TikTok/Reels captions', tool: 'Canvas 2D, Remotion', runs: 'CPU',
    notice: 'Words appear in sync with speech. The active word pops with overshoot and gets a highlight box; spoken words stay, upcoming words are dim.',
    use: 'short-form video, talking-head clips, accessibility',
    prompt: 'Add word-by-word captions to my video using the transcript timings: 3 to 4 words per page, active word pops (ease-out-back) with a coral highlight box, bold 64 px sans.',
    setup(cv) {
      const g = cv.getContext('2d');
      const words = 'Every word lands exactly when it is spoken, so viewers can follow without sound'.split(' ');
      const times = words.map((_, i) => 0.3 + i * 0.32);
      const pages = []; for (let i = 0; i < words.length; i += 4) pages.push([i, Math.min(words.length, i + 4)]);
      return t => {
        const lt = t % (times[times.length - 1] + 1.6);
        const grd = g.createLinearGradient(0, 0, 640, 360); grd.addColorStop(0, '#2a1a3a'); grd.addColorStop(1, '#0e1a2a'); g.fillStyle = grd; g.fillRect(0, 0, 640, 360);
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); g.arc(320, 150, 90, 0, 7); g.fill(); g.beginPath(); g.ellipse(320, 330, 170, 90, 0, Math.PI, 0); g.fill();
        let pi = 0; for (let p = 0; p < pages.length; p++) if (lt >= times[pages[p][0]] - 0.05) pi = p;
        const [a, b] = pages[pi];
        g.font = `800 44px ${UI}`; g.textBaseline = 'middle';
        const ws = []; for (let i = a; i < b; i++) ws.push({ w: words[i], m: g.measureText(words[i]).width, i });
        const total = ws.reduce((s, x) => s + x.m, 0) + 16 * (ws.length - 1); let x = 320 - total / 2;
        for (const W of ws) {
          const k = seg(lt, times[W.i], times[W.i] + 0.22), active = lt >= times[W.i] && (W.i === words.length - 1 || lt < times[W.i + 1]);
          const s = lt < times[W.i] ? 1 : lerp(0.6, 1, ease.back(k));
          g.save(); g.translate(x + W.m / 2, 250); g.scale(s, s);
          if (active) { g.fillStyle = C.coral; g.beginPath(); g.roundRect(-W.m / 2 - 10, -30, W.m + 20, 60, 10); g.fill(); }
          g.fillStyle = lt < times[W.i] ? 'rgba(255,255,255,0.35)' : '#fff';
          g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.textAlign = 'center'; if (!active) g.strokeText(W.w, 0, 2); g.fillText(W.w, 0, 2);
          g.restore(); x += W.m + 16;
        }
        g.textAlign = 'left';
      };
    },
  });

  EX.add({
    cat: 'type', id: 'textpath', title: 'Text on a path', aka: 'circular text, orbit type, rotating badge', tool: 'Canvas 2D or SVG textPath', runs: 'CPU',
    notice: 'Letters are placed one by one along a circle and rotated to face outward. Two rings turn in opposite directions; the center pulses on a beat.',
    use: 'badges, logo lockups, loading screens, merch-style graphics',
    prompt: 'Rotating circular text badge: "MOTION · DESIGN · WITH · CODE ·" around a ring, slow clockwise spin, inner ring of small mono text spinning the other way, center logo pulses every 0.5 s.',
    setup(cv) {
      const g = cv.getContext('2d');
      function ring(text, r, rot, font, col) {
        g.font = font; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
        const n = text.length; for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; g.save(); g.translate(320 + Math.cos(a) * r, 180 + Math.sin(a) * r); g.rotate(a + Math.PI / 2); g.fillText(text[i], 0, 0); g.restore(); }
      }
      return t => {
        bg(g, 640, 360);
        ring('MOTION · DESIGN · WITH · CODE · ', 140, t * 0.5, `700 26px ${DISP}`, C.cream);
        ring('GPU · SHADERS · PARTICLES · PHYSICS · TYPE · ', 98, -t * 0.8, `500 13px ${MONO}`, C.amber);
        const beat = Math.exp(-((t % 0.5)) * 8);
        g.fillStyle = C.coral; g.beginPath(); g.arc(320, 180, 46 + beat * 10, 0, 7); g.fill();
        g.strokeStyle = 'rgba(255,90,54,0.4)'; g.lineWidth = 2; g.beginPath(); g.arc(320, 180, 60 + (t % 0.5) * 120, 0, 7); g.globalAlpha = 1 - (t % 0.5) * 2; g.stroke(); g.globalAlpha = 1;
        g.font = `700 22px ${DISP}`; g.fillStyle = C.bg; g.fillText('CODE', 320, 182); g.textAlign = 'left';
      };
    },
  });

  void clamp01;
})();
