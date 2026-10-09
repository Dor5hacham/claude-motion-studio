// More text and UI demos for Motion Examples.html.
(function () {
  const { C, PAL, seg, lerp, ease, clamp01 } = EX;
  const W = 640, H = 360;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

  EX.add({
    cat: 'type', id: 'liquidtype', title: 'Liquid-filled type', aka: 'water fill text, text mask fill, sloshing liquid', tool: 'Canvas 2D (compositing: destination-in mask)', runs: 'CPU',
    notice: 'A wave of liquid is drawn on its own layer, then the word is used as a mask so the liquid shows only inside the letters. The level rises and drains, the surface sloshes, and bubbles rise.',
    use: 'progress or loading moments, drinks and beauty brands, "filling up" metaphors',
    prompt: "The word \"FRESH\" fills with sloshing cyan liquid from bottom to top over 2 s (waves up to {wave}), bubbles rise inside the letters, then it drains with a wobble.",
    params: [{"key": "wave", "label": "Slosh height", "min": 0, "max": 30, "step": 1, "value": 9, "unit": " px"}], setup(cv, L) {
      const g = cv.getContext('2d'); const off = document.createElement('canvas'); off.width = W; off.height = H; const o = off.getContext('2d');
      const bubbles = [...Array(40)].map((_, i) => ({ x: 60 + (i * 137) % 520, s: 0.3 + (i * 0.37) % 1, r: 2 + (i % 4) }));
      return t => {
        const lt = t % 6, level = H * 0.78 - ease.inOut(seg(lt, 0.3, 2.6)) * H * 0.62 + ease.inOut(seg(lt, 4.2, 5.8)) * H * 0.62;
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        // empty glass: a faint fill of the word, so the letters read before the liquid arrives
        g.font = '700 190px Bahnschrift'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(127,232,255,0.13)'; g.fillText('FRESH', W / 2, H / 2 + 10); g.textAlign = 'left';
        o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, W, H);
        const grd = o.createLinearGradient(0, level - 20, 0, H); grd.addColorStop(0, '#7fe8ff'); grd.addColorStop(1, '#1b6fd8'); o.fillStyle = grd;
        o.beginPath(); o.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) o.lineTo(x, level + Math.sin(x * 0.02 + t * 3) * L.p.wave * (1 + Math.sin(t * 1.3)) + Math.sin(x * 0.045 - t * 2.1) * 5);
        o.lineTo(W, H); o.fill();
        o.fillStyle = 'rgba(255,255,255,0.55)';
        for (const b of bubbles) { const y = H - ((t * 60 * b.s + b.x) % (H - level + 40)); if (y > level + 6) { o.beginPath(); o.arc(b.x + Math.sin(t * 3 + b.x) * 4, y, b.r, 0, 7); o.fill(); } }
        o.globalCompositeOperation = 'destination-in'; o.fillStyle = '#000'; o.font = '700 190px Bahnschrift'; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText('FRESH', W / 2, H / 2 + 10);
        g.drawImage(off, 0, 0);
        g.textAlign = 'left';
      };
    },
  });

  EX.add({
    cat: 'type', id: 'typetunnel', title: 'Typographic tunnel', aka: 'infinite zoom text, text vortex, type rings', tool: 'Canvas 2D (scaled layers)', runs: 'CPU',
    notice: 'The same words are drawn on rings at eight depths. Each ring grows exponentially and is replaced by a new one at the center, so the zoom never ends. Alternate rings spin the other way.',
    use: 'hypnotic intros, music videos, event openers',
    prompt: 'Endless typographic tunnel: the phrase "ALWAYS IN MOTION" repeated around rings that zoom toward the camera forever, alternate rings counter-rotate, coral and cream, 120 BPM pulse.',
    setup(cv) {
      const g = cv.getContext('2d'); const txt = 'ALWAYS IN MOTION · ';
      return t => {
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        for (let k = 7; k >= 0; k--) {
          const z = k + ((t * 0.55) % 1), s = Math.pow(2, z - 4.2), R = 150 * s; if (R < 6) continue;
          const alpha = Math.min(1, R / 40) * Math.max(0, 1 - (R - 500) / 300); if (alpha <= 0) continue;
          g.save(); g.translate(W / 2, H / 2); g.rotate((k % 2 ? -1 : 1) * t * 0.35 + k);
          g.font = `700 ${Math.max(4, 26 * s)}px Bahnschrift`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = (Math.floor(z + t * 0.55) % 2) ? `rgba(255,90,54,${alpha})` : `rgba(244,239,230,${alpha})`;
          const n = Math.max(1, Math.floor(2 * Math.PI * R / (26 * s * 0.62)));
          for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.save(); g.rotate(a); g.translate(0, -R); g.fillText(txt[i % txt.length], 0, 0); g.restore(); }
          g.restore();
        }
      };
    },
  });

  EX.add({
    cat: 'type', id: 'jellytype', title: 'Jelly letters', aka: 'elastic type, springy text, interactive type', tool: 'Canvas 2D (spring physics per letter)', runs: 'CPU',
    notice: 'Every letter is on its own spring. An invisible pointer (or your mouse) sweeps across and pushes letters away; they wobble back with squash and stretch based on their speed.',
    use: 'playful brands, interactive headlines, kids and games',
    prompt: "Interactive jelly headline: each letter sits on a spring (stiffness {k}, damping {damp}), the cursor pushes letters away within {rad}, letters squash along their velocity, bright playful colors.",
    params: [{"key": "k", "label": "Spring stiffness", "min": 0.01, "max": 0.3, "step": 0.01, "value": 0.08}, {"key": "damp", "label": "Damping", "min": 0.6, "max": 0.97, "step": 0.01, "value": 0.85}, {"key": "rad", "label": "Push radius", "min": 40, "max": 240, "step": 10, "value": 120, "unit": " px"}], setup(cv, L) {
      const g = cv.getContext('2d'); const word = 'BOUNCY'; let mouse = null;
      cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouse = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H, t: performance.now() }; });
      g.font = '800 120px Bahnschrift'; const ws = [...word].map(ch => g.measureText(ch).width); const total = ws.reduce((a, b) => a + b, 0) + 10 * (word.length - 1);
      let x = W / 2 - total / 2; const letters = [...word].map((ch, i) => { const o = { ch, hx: x + ws[i] / 2, hy: H / 2, x: x + ws[i] / 2, y: H / 2, vx: 0, vy: 0 }; x += ws[i] + 10; return o; });
      return (t, dt) => {
        const auto = !mouse || performance.now() - mouse.t > 2000;
        const px = auto ? W / 2 + Math.sin(t * 1.1) * 320 : mouse.x, py = auto ? H / 2 + Math.sin(t * 2.3) * 70 : mouse.y;
        g.fillStyle = '#14101e'; g.fillRect(0, 0, W, H);
        const k = dt * 60;
        letters.forEach((l, i) => {
          const dx = l.x - px, dy = l.y - py, d = Math.hypot(dx, dy);
          if (d < L.p.rad) { const f = (L.p.rad - d) / L.p.rad * 2.2; l.vx += dx / (d || 1) * f * k; l.vy += dy / (d || 1) * f * k; }
          l.vx = (l.vx + (l.hx - l.x) * L.p.k * k) * Math.pow(L.p.damp, k); l.vy = (l.vy + (l.hy - l.y) * L.p.k * k) * Math.pow(L.p.damp, k);
          l.x += l.vx * k; l.y += l.vy * k;
          const sp = Math.min(0.45, Math.hypot(l.vx, l.vy) * 0.04), ang = Math.atan2(l.vy, l.vx);
          g.save(); g.translate(l.x, l.y); g.rotate(ang); g.scale(1 + sp, 1 - sp * 0.7); g.rotate(-ang);
          g.font = '800 120px Bahnschrift'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = PAL[i % 4]; g.fillText(l.ch, 0, 0); g.restore();
        });
        g.fillStyle = 'rgba(244,239,230,0.25)'; g.beginPath(); g.arc(px, py, 10, 0, 7); g.fill();
      };
    },
  });

  EX.add({
    cat: 'ui', id: 'magnetic', kind: 'dom', title: 'Magnetic button and cursor follower', aka: 'custom cursor, magnetic hover, blend-mode cursor', tool: 'CSS + JavaScript (mix-blend-mode, transforms)', runs: 'WEB',
    notice: 'A soft circle follows the pointer with a delay. Near the button, the button leans toward the pointer as if pulled by a magnet, and the cursor grows and inverts colors with a blend mode.',
    use: 'portfolio sites, agency sites, premium landing pages',
    prompt: "Add a magnetic hover to the main CTA: within 100 px the button moves {pull} of the cursor distance toward it with a spring; a custom cursor circle follows with lag and grows to 80 px with mix-blend-mode: difference over buttons.",
    params: [{"key": "pull", "label": "Magnet pull", "min": 0, "max": 1, "step": 0.05, "value": 0.3}], setup(st, L) {
      st.innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:40px;font:600 18px Segoe UI">
        <div class="mg-btn" style="padding:18px 34px;border-radius:999px;background:#ff5a36;color:#140806">Get started</div>
        <div class="mg-btn" style="padding:18px 34px;border-radius:999px;border:2px solid #ece7de;color:#ece7de">See work</div></div>
        <div class="mg-cur" style="position:absolute;left:0;top:0;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:#fff;mix-blend-mode:difference;pointer-events:none"></div>`;
      const btns = [...st.querySelectorAll('.mg-btn')], cur = st.querySelector('.mg-cur'); let mouse = null;
      st.addEventListener('pointermove', e => { const r = st.getBoundingClientRect(); mouse = { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height, t: performance.now() }; });
      const c = { x: W / 2, y: H / 2, s: 24 }; const bo = btns.map(() => ({ x: 0, y: 0 }));
      return t => {
        const auto = !mouse || performance.now() - mouse.t > 2000;
        const px = auto ? W / 2 + Math.sin(t * 0.9) * 230 : mouse.x, py = auto ? H / 2 + Math.sin(t * 1.7) * 60 : mouse.y;
        c.x = lerp(c.x, px, 0.18); c.y = lerp(c.y, py, 0.18);
        let hover = false;
        btns.forEach((b, i) => {
          const sr = st.getBoundingClientRect(), k = W / sr.width, r = b.getBoundingClientRect(), bw = r.width * k, bh = r.height * k; const bx = (r.left - sr.left) * k + bw / 2 - bo[i].x, by = (r.top - sr.top) * k + bh / 2 - bo[i].y;
          const dx = px - bx, dy = py - by, d = Math.hypot(dx / (bw / 2 + 60), dy / (bh / 2 + 60));
          const pull = d < 1 ? L.p.pull : 0; if (d < 1) hover = true;
          bo[i].x = lerp(bo[i].x, dx * pull, 0.15); bo[i].y = lerp(bo[i].y, dy * pull, 0.15);
          b.style.transform = `translate(${bo[i].x}px,${bo[i].y}px)`;
        });
        c.s = lerp(c.s, hover ? 80 : 24, 0.15);
        cur.style.transform = `translate(${c.x}px,${c.y}px) scale(${c.s / 24})`;
      };
    },
  });

  EX.add({
    cat: 'ui', id: 'toasts', kind: 'dom', title: 'Toast stack', aka: 'notifications, snackbar, stacked cards', tool: 'CSS transforms + spring easing (Framer Motion style)', runs: 'WEB',
    notice: 'New notifications spring in from the bottom with overshoot. Older ones step back: they shrink a little and fade, like a deck of cards. The oldest swipes away to the right.',
    use: 'app notifications, success messages, activity feeds',
    prompt: 'Toast notifications: new toast springs up from the bottom (stiffness 400, damping 30), older toasts scale to 0.94 and shift up 10 px each like a stack, max 3 visible, oldest swipes out right after 4 s.',
    setup(st) {
      const msgs = [['Render complete', '3,600 frames in 17 min', C.green], ['Upload finished', 'Claude Motion Reel.mp4', C.cyan], ['Physics baked', '432 rigid bodies', C.amber], ['New comment', '"The fluid demo is wild"', C.coral], ['Shader compiled', 'fluid.frag in 4 ms', C.violet]];
      st.innerHTML = msgs.map(([a, b, c]) => `<div class="ts" style="position:absolute;right:40px;bottom:40px;width:300px;padding:14px 16px;border-radius:12px;background:#1e1e2a;border:1px solid #33334a;box-shadow:0 10px 30px rgba(0,0,0,.4);display:flex;gap:12px;align-items:center;opacity:0">
        <i style="width:10px;height:10px;border-radius:50%;background:${c};flex:none"></i><div><b style="font:600 15px Segoe UI;color:#ece7de;display:block">${a}</b><span style="font:13px Segoe UI;color:#8a8794">${b}</span></div></div>`).join('') +
        `<div style="position:absolute;left:40px;top:40px;font:700 28px Bahnschrift;color:#2a2a3a">Dashboard</div>`;
      const els = [...st.querySelectorAll('.ts')]; const spring = x => x <= 0 ? 0 : 1 - Math.exp(-7 * x) * Math.cos(9 * x);
      return t => {
        const period = 1.1, total = els.length * period, lt = t % (total + 1.2);
        els.forEach((e, i) => {
          const age = lt - i * period; if (age < 0) { e.style.opacity = 0; return; }
          const enter = spring(age / 0.9); const newer = Math.max(0, Math.min(els.length - 1, Math.floor(lt / period)) - i);
          const depth = Math.min(newer, 3); const out = ease.inExpo(seg(lt - (i + 3) * period, 0, 0.45));
          const y = (1 - enter) * 90 - depth * 12, sc = 1 - depth * 0.05;
          e.style.transform = `translate(${out * 360}px,${y}px) scale(${sc})`; e.style.opacity = Math.max(0, Math.min(1, enter * 1.4) * (depth >= 3 ? 0 : 1 - depth * 0.15) * (1 - out));
          e.style.zIndex = 10 - depth;
        });
      };
    },
  });

  EX.add({
    cat: 'ui', id: 'sharedexpand', kind: 'dom', title: 'Shared-element expand', aka: 'FLIP animation, hero transition, card to detail', tool: 'JavaScript FLIP technique (or Framer Motion layoutId, View Transitions API)', runs: 'WEB',
    notice: 'A small card grows into the full detail view: its position, size and corner radius interpolate from the card to the screen. The detail text fades in only after the move lands, then it all reverses.',
    use: 'galleries, product lists, app navigation that keeps context',
    prompt: 'When a project card is clicked, expand it into the detail page with a shared-element transition (FLIP / View Transitions API), 450 ms ease-out-expo, image stays continuous, details fade in after 150 ms.',
    setup(st) {
      const grads = ['linear-gradient(135deg,#ff5a36,#ffb020)', 'linear-gradient(135deg,#2bc4e6,#7a5cff)', 'linear-gradient(135deg,#7a5cff,#ff5a36)'];
      st.innerHTML = `<div style="position:absolute;left:40px;top:28px;font:700 22px Bahnschrift;color:#ece7de">Projects</div>` +
        grads.map((g, i) => `<div class="se-c" style="position:absolute;left:${40 + i * 190}px;top:80px;width:170px;height:220px;border-radius:14px;background:${g}"></div>`).join('') +
        `<div class="se-x" style="position:absolute;border-radius:14px;background:${grads[1]};overflow:hidden"><div class="se-t" style="position:absolute;left:30px;bottom:26px;color:#0b0b10;opacity:0"><b style="font:700 34px Bahnschrift;display:block">Fluid study</b><span style="font:15px Segoe UI">GPU stable fluids, 160x90 grid, 24 pressure iterations</span></div></div>`;
      const x = st.querySelector('.se-x'), tx = st.querySelector('.se-t'), src = st.querySelectorAll('.se-c')[1];
      const A = { l: 230, t: 80, w: 170, h: 220, r: 14 }, B = { l: 0, t: 0, w: W, h: H, r: 0 };
      return t => {
        const lt = t % 4.4, k = ease.expo(seg(lt, 0.7, 1.3)) * (1 - ease.inOut(seg(lt, 3.3, 3.9)));
        x.style.left = lerp(A.l, B.l, k) + 'px'; x.style.top = lerp(A.t, B.t, k) + 'px'; x.style.width = lerp(A.w, B.w, k) + 'px'; x.style.height = lerp(A.h, B.h, k) + 'px'; x.style.borderRadius = lerp(A.r, B.r, k) + 'px';
        src.style.opacity = k > 0.001 ? 0 : 1; tx.style.opacity = ease.out(seg(lt, 1.35, 1.7)) * (1 - seg(lt, 3.2, 3.35)); tx.style.transform = `translateY(${(1 - ease.out(seg(lt, 1.35, 1.75))) * 14}px)`;
      };
    },
  });

  EX.add({
    cat: 'ui', id: 'daynight', kind: 'dom', title: 'Day/night toggle', aka: 'theme switch, dark mode toggle, morphing icon', tool: 'SVG + JavaScript', runs: 'WEB',
    notice: 'One switch, many coordinated moves: the knob slides, the sun becomes a moon as a dark circle slides over it, clouds drift out, stars twinkle in and the whole scene changes color.',
    use: 'dark-mode switches, settings, delightful onboarding',
    prompt: 'Dark-mode toggle: knob slides with ease-in-out (400 ms), the sun morphs into a crescent moon by sliding a mask circle, clouds exit left, stars fade in with stagger, page background crossfades.',
    setup(st) {
      const s = svgEl('svg', { viewBox: '0 0 640 360', width: 640, height: 360 }, st);
      const bg = svgEl('rect', { width: 640, height: 360 }, s);
      const stars = [...Array(26)].map((_, i) => svgEl('circle', { cx: 40 + (i * 233) % 560, cy: 30 + (i * 97) % 120, r: 1.5 + (i % 3) * 0.6, fill: '#fff', opacity: 0 }, s));
      const track = svgEl('rect', { x: 200, y: 150, width: 240, height: 110, rx: 55 }, s);
      const clouds = [0, 1, 2].map(i => svgEl('ellipse', { cx: 300 + i * 50, cy: 225 + (i % 2) * 8, rx: 34, ry: 16, fill: '#fff', opacity: 0.9 }, s));
      const knob = svgEl('circle', { cx: 255, cy: 205, r: 42, fill: '#ffd34d' }, s);
      const mask = svgEl('circle', { cx: 330, cy: 180, r: 34 }, s);
      return t => {
        const lt = t % 4, k = ease.inOut(seg(lt, 0.6, 1.2)) * (1 - ease.inOut(seg(lt, 2.6, 3.2)));
        bg.setAttribute('fill', `rgb(${lerp(150, 14, k) | 0},${lerp(210, 16, k) | 0},${lerp(250, 40, k) | 0})`);
        track.setAttribute('fill', `rgb(${lerp(90, 30, k) | 0},${lerp(170, 30, k) | 0},${lerp(240, 70, k) | 0})`);
        const kx = lerp(255, 385, k); knob.setAttribute('cx', kx); knob.setAttribute('fill', k > 0.5 ? '#e8e4f0' : '#ffd34d');
        mask.setAttribute('cx', kx + lerp(80, 18, k)); mask.setAttribute('cy', 205 - lerp(40, 14, k)); mask.setAttribute('fill', track.getAttribute('fill')); mask.setAttribute('r', 36);
        mask.setAttribute('opacity', k > 0.02 ? 1 : 0);
        clouds.forEach((c, i) => { c.setAttribute('cx', 300 + i * 50 - k * 260); c.setAttribute('opacity', 0.9 * (1 - k)); });
        stars.forEach((s2, i) => s2.setAttribute('opacity', clamp01(k * 1.6 - i * 0.02) * (0.6 + 0.4 * Math.sin(t * 3 + i))));
      };
    },
  });
})();
