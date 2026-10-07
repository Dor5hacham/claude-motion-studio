// Extra demos for Motion Examples.html: particle text, CSS 3D card flip, parallax, motion path.
(function () {
  const { C, PAL, seg, lerp, ease, rng, noise } = EX;
  const W = 640, H = 360;

  EX.add({
    cat: 'type', id: 'particletext', title: 'Particle text', aka: 'text to particles, disintegrate, reassemble', tool: 'Canvas 2D (pixel sampling)', runs: 'CPU',
    notice: 'The word is drawn off screen, then every filled pixel becomes a particle with a home position. Particles scatter, swirl through noise, then spring back home with a stagger from left to right.',
    use: 'logo reveals, "build" moments, hover effects on websites',
    prompt: "My wordmark disintegrates into 4,000 particles that drift {drift} on noise for 1.5 s, then reassemble left to right with ease-out-expo, particles coral to amber across the word.",
    params: [{"key": "drift", "label": "Scatter drift", "min": 0, "max": 120, "step": 5, "value": 40, "unit": " px"}], setup(cv, L) {
      const g = cv.getContext('2d'); const oc = document.createElement('canvas'); oc.width = W; oc.height = H; const o = oc.getContext('2d');
      o.fillStyle = '#fff'; o.font = '700 150px Bahnschrift'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText('MOTION', W / 2, H / 2 + 6);
      const d = o.getImageData(0, 0, W, H).data, ps = [], r = rng(8);
      for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) if (d[(y * W + x) * 4 + 3] > 128) ps.push({ hx: x, hy: y, sx: r() * W, sy: r() * H, k: r() });
      return t => {
        const lt = t % 6; g.fillStyle = 'rgba(11,11,16,0.45)'; g.fillRect(0, 0, W, H);
        for (const p of ps) {
          const out = ease.inOut(seg(lt, 2.4 + p.k * 0.3, 3.3 + p.k * 0.3)), back = ease.expo(seg(lt, 4.2 + p.hx / W * 0.8, 5.2 + p.hx / W * 0.8));
          const scatter = Math.max(0, out - back) + (lt < 0.8 ? 1 - ease.expo(seg(lt, 0, 0.8 + p.hx / W * 0.6)) : 0);
          const a = noise(p.hx * 0.01, p.hy * 0.01, lt * 0.4) * Math.PI * 4;
          const x = lerp(p.hx, p.sx + Math.cos(a) * L.p.drift, scatter), y = lerp(p.hy, p.sy + Math.sin(a) * L.p.drift, scatter);
          g.fillStyle = `rgb(255,${lerp(90, 176, p.hx / W) | 0},${lerp(54, 32, p.hx / W) | 0})`; g.fillRect(x, y, 2.2, 2.2);
        }
      };
    },
  });

  EX.add({
    cat: 'ui', id: 'cardflip', kind: 'dom', title: '3D card flip', aka: 'CSS 3D transform, perspective flip, tilt card', tool: 'CSS 3D transforms (perspective, rotateY, backface-visibility)', runs: 'WEB',
    notice: 'Three cards turn over in 3D one after another. Each has a front and back face; perspective makes the near edge larger as it turns. No WebGL, just CSS.',
    use: 'pricing cards, reveals, flashcards, product feature tiles',
    prompt: 'Three feature cards flip in 3D (rotateY 180, 700 ms, ease-in-out, 120 ms stagger) to reveal details on the back, with 1,000 px perspective and a soft shadow that shifts during the turn.',
    setup(st) {
      st.innerHTML = `<div style="display:flex;gap:28px;justify-content:center;align-items:center;height:100%;perspective:1000px">${['GPU', 'CPU', 'ENGINE'].map((n, i) => `
        <div class="cf" style="width:150px;height:210px;position:relative;transform-style:preserve-3d">
          <div style="position:absolute;inset:0;backface-visibility:hidden;border-radius:16px;background:${['linear-gradient(140deg,#2bc4e6,#7a5cff)', 'linear-gradient(140deg,#ffb020,#ff5a36)', 'linear-gradient(140deg,#7a5cff,#ff5a36)'][i]};display:flex;align-items:flex-end;padding:16px;font:700 26px Bahnschrift;color:#0b0b10">${n}</div>
          <div style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);border-radius:16px;background:#1d1d29;border:1px solid #333348;padding:16px;font:14px/1.5 Segoe UI;color:#d8d2c8"><b style="font:700 18px Bahnschrift;color:#fff">${n}</b><br>${['Shaders, particles, fluids', 'Physics, type, sound', 'Blender, Unreal'][i]}</div>
        </div>`).join('')}</div>`;
      const cards = st.querySelectorAll('.cf');
      return t => {
        const lt = t % 4.4;
        cards.forEach((c, i) => {
          const k = ease.inOut(seg(lt, 0.5 + i * 0.12, 1.2 + i * 0.12)) * (1 - ease.inOut(seg(lt, 3.0 + i * 0.12, 3.7 + i * 0.12)));
          c.style.transform = `rotateY(${k * 180}deg) translateZ(${Math.sin(k * Math.PI) * 40}px)`;
          // a CSS filter here would flatten the 3D context, so the shadow lives on the faces instead
          c.querySelectorAll(':scope > div').forEach(f => { f.style.boxShadow = `${Math.sin(k * Math.PI) * -18}px 18px 30px rgba(0,0,0,0.5)`; });
        });
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'parallax', title: 'Parallax layers', aka: '2.5D, multiplane, depth layers', tool: 'Canvas 2D (or CSS transforms on image layers)', runs: 'CPU',
    notice: 'Five flat layers scroll at different speeds: far mountains crawl, near hills rush past. The speed difference alone makes the scene feel deep, the same trick as Disney\'s multiplane camera.',
    use: 'scrolling websites, title backgrounds, making flat art feel 3D',
    prompt: "Parallax landscape with 5 layers (sky, far mountains, mid hills, trees, foreground grass), camera slides right, depth strength {depth} (0 = flat, everything moves together), haze increases with distance, sunset palette.",
    params: [{"key": "depth", "label": "Depth strength", "min": 0, "max": 2, "step": 0.05, "value": 1}], setup(cv, L) {
      const g = cv.getContext('2d');
      const layers = /** @type {[number, number, number, string][]} */ ([[0.05, 0.62, 70, 'rgba(120,70,120,0.85)'], [0.15, 0.7, 60, '#6a345f'], [0.35, 0.79, 45, '#4a2448'], [0.7, 0.88, 30, '#2a1830'], [1.4, 0.97, 18, '#120a18']]);
      return t => {
        const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#1b1038'); sky.addColorStop(0.6, '#ff7a4a'); sky.addColorStop(1, '#ffb020'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(255,230,180,0.95)'; g.beginPath(); g.arc(470, 170, 46, 0, 7); g.fill();
        const cam = t * 90;
        layers.forEach(([sp, base, amp, col], li) => {
          g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
          for (let x = 0; x <= W; x += 6) { const wx = (x + cam * Math.pow(sp, L.p.depth)) * 0.004 * (1 + li * 0.5); g.lineTo(x, H * base - noise(wx, li * 10 + 0.37, 0.61) * amp * 1.8 + (li === 3 ? Math.abs(Math.sin(wx * 9)) * -20 : 0)); }
          g.lineTo(W, H); g.fill();
        });
        g.font = '600 13px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillText('layer speeds: 0.05  0.15  0.35  0.7  1.4', 16, 24);
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'motionpath', title: 'Motion path', aka: 'path animation, follow path, auto-orient', tool: 'Canvas 2D or SVG (offset-path in CSS)', runs: 'CPU',
    notice: 'The plane rides a curved path and turns to face where it is going (auto-orient). Speed follows an ease-in-out, and a dashed trail draws behind it with trim paths.',
    use: 'travel routes, map animations, explainer arrows, delivery trackers',
    prompt: 'A paper plane flies along a curvy SVG path from left to right in 3 s, auto-oriented to the path, ease-in-out speed, dashed trail draws behind it, lands on a pin that pops with overshoot.',
    setup(cv) {
      const g = cv.getContext('2d'); const pts = [];
      for (let i = 0; i <= 200; i++) { const u = i / 200; pts.push([lerp(60, 590, u), 200 + Math.sin(u * Math.PI * 2.2) * 90 * (1 - u * 0.5) - u * 40]); }
      return t => {
        const lt = t % 4.2, k = ease.inOut(seg(lt, 0.3, 3.3)), n = Math.floor(k * 200);
        g.fillStyle = '#0f1420'; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
        g.setLineDash([8, 8]); g.strokeStyle = C.amber; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= n; i++) i ? g.lineTo(...pts[i]) : g.moveTo(...pts[i]); g.stroke(); g.setLineDash([]);
        const pin = ease.back(seg(lt, 3.2, 3.6)); const [ex, ey] = pts[200];
        if (pin > 0) { g.fillStyle = C.coral; g.beginPath(); g.arc(ex, ey - 22 * pin, 12 * pin, 0, 7); g.fill(); g.beginPath(); g.moveTo(ex - 8 * pin, ey - 18 * pin); g.lineTo(ex, ey); g.lineTo(ex + 8 * pin, ey - 18 * pin); g.fill(); }
        const i = Math.min(199, n), [x, y] = pts[i], [x2, y2] = pts[i + 1]; const a = Math.atan2(y2 - y, x2 - x);
        if (lt < 3.4) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = C.cream; g.beginPath(); g.moveTo(18, 0); g.lineTo(-12, -11); g.lineTo(-6, 0); g.lineTo(-12, 11); g.closePath(); g.fill(); g.fillStyle = '#c9c2b6'; g.beginPath(); g.moveTo(18, 0); g.lineTo(-6, 0); g.lineTo(-12, 11); g.fill(); g.restore(); }
        void PAL;
      };
    },
  });
})();
