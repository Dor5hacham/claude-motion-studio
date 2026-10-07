// App and website motion demos for Motion Examples.html (SVG, CSS, DOM, Canvas 2D).
(function () {
  const { C, seg, lerp, ease, clamp01 } = EX;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

  EX.add({
    cat: 'ui', id: 'like', kind: 'dom', title: 'Like-button burst', aka: 'micro-interaction, tap feedback, celebration burst', tool: 'SVG + JavaScript (also Lottie)', runs: 'WEB',
    notice: 'On tap the heart squashes, then overshoots, a ring expands and fades, and dots fly out. The counter rolls its last digit up. Click the heart to replay.',
    use: 'buttons in apps, reactions, success states',
    prompt: 'Like-button micro-interaction: heart scales 1 > 0.7 > 1.25 > 1 with ease-out-back, a coral ring expands and fades, 12 dots burst out, counter digit rolls up. Total 600 ms.',
    setup(st, L) {
      const s = svgEl('svg', { viewBox: '0 0 640 360', width: 640, height: 360 }, st);
      svgEl('rect', { width: 640, height: 360, fill: '#101018' }, s);
      const ring = svgEl('circle', { cx: 320, cy: 170, r: 20, fill: 'none', stroke: C.coral, 'stroke-width': 20, opacity: 0 }, s);
      const dots = [...Array(12)].map((_, i) => svgEl('circle', { cx: 320, cy: 170, r: 6, fill: EX.PAL[i % 4], opacity: 0 }, s));
      const heart = svgEl('path', { d: 'M0,18 C-28,-4 -40,-20 -26,-34 C-14,-46 0,-38 0,-26 C0,-38 14,-46 26,-34 C40,-20 28,-4 0,18 Z', fill: 'none', stroke: '#8a8794', 'stroke-width': 4, transform: 'translate(320,182) scale(1.6)', style: 'cursor:pointer' }, s);
      const cnt = svgEl('g', {}, s); const clip = svgEl('clipPath', { id: 'likeclip' }, s); svgEl('rect', { x: 260, y: 252, width: 140, height: 44 }, clip); cnt.setAttribute('clip-path', 'url(#likeclip)');
      const tA = svgEl('text', { x: 320, y: 285, 'text-anchor': 'middle', fill: C.cream, 'font-family': 'Segoe UI', 'font-size': 30, 'font-weight': 600 }, cnt);
      const tB = svgEl('text', { x: 320, y: 285, 'text-anchor': 'middle', fill: C.coral, 'font-family': 'Segoe UI', 'font-size': 30, 'font-weight': 600 }, cnt);
      tA.textContent = '1,204'; tB.textContent = '1,205';
      let off = 0; heart.addEventListener('click', () => { off = L.t - 0.3; });
      return t => {
        const lt = ((t - off) % 2.6 + 2.6) % 2.6, c = lt - 0.3;
        let sc = 1; if (c > 0) sc = c < 0.08 ? lerp(1, 0.7, c / 0.08) : lerp(0.7, 1, ease.back(clamp01((c - 0.08) / 0.4)));
        const on = c > 0.08 && lt < 2.3;
        heart.setAttribute('transform', `translate(320,182) scale(${1.6 * sc})`);
        heart.setAttribute('fill', on ? C.coral : 'none'); heart.setAttribute('stroke', on ? C.coral : '#8a8794');
        const rk = seg(c, 0.05, 0.45);
        ring.setAttribute('r', lerp(20, 95, ease.out(rk))); ring.setAttribute('stroke-width', lerp(22, 0, rk)); ring.setAttribute('opacity', c > 0.05 && rk < 1 ? 1 : 0);
        dots.forEach((d, i) => { const a = i / 12 * Math.PI * 2, k = ease.out(seg(c, 0.12, 0.6)); d.setAttribute('cx', 320 + Math.cos(a) * lerp(50, 125, k)); d.setAttribute('cy', 170 + Math.sin(a) * lerp(50, 125, k)); d.setAttribute('r', lerp(7, 0, k)); d.setAttribute('opacity', c > 0.12 && k < 1 ? 1 : 0); });
        const ck = on ? ease.back(seg(c, 0.1, 0.45)) : 0;
        tA.setAttribute('y', 285 - ck * 40); tB.setAttribute('y', 325 - ck * 40);
      };
    },
  });

  EX.add({
    cat: 'ui', id: 'loaders', kind: 'dom', title: 'Loaders', aka: 'spinners, progress indicators, activity indicators', tool: 'Pure CSS @keyframes', runs: 'WEB',
    notice: 'Six loaders made only with CSS keyframes. Most of them are one animation repeated on several elements with a staggered animation-delay.',
    use: 'waiting states in any app or site',
    prompt: 'Make a pure-CSS loader: three dots that bounce in a wave (120 ms stagger), ease-in-out, coral, 1 s loop, and respect prefers-reduced-motion.',
    setup(st) {
      st.innerHTML = `<div class="ld-grid">
        <div><div class="ld-spin"></div><span>arc spinner</span></div>
        <div><div class="ld-dots"><i></i><i></i><i></i></div><span>staggered dots</span></div>
        <div><div class="ld-bars"><i></i><i></i><i></i><i></i><i></i></div><span>equalizer bars</span></div>
        <div><div class="ld-morph"></div><span>shape morph</span></div>
        <div><div class="ld-orbit"><i></i><i></i></div><span>orbit</span></div>
        <div><div class="ld-line"><i></i></div><span>indeterminate bar</span></div></div>`;
      return () => {};
    },
  });

  EX.add({
    cat: 'ui', id: 'gooey', kind: 'dom', title: 'Gooey merge', aka: 'metaball effect, liquid blobs, goo filter', tool: 'SVG filter (blur + alpha threshold)', runs: 'WEB',
    notice: 'Plain circles are blurred, then the alpha is pushed to hard edges. Where blurs overlap they fuse, so circles seem to melt into each other like liquid.',
    use: 'menus that split into buttons, playful loaders, liquid tabs',
    prompt: 'Gooey menu button: the main circle splits into 4 smaller circles that slide out with ease-out-back, connected by a liquid SVG goo filter while they separate.',
    setup(st) {
      const s = svgEl('svg', { viewBox: '0 0 640 360', width: 640, height: 360 }, st);
      svgEl('rect', { width: 640, height: 360, fill: '#101018' }, s);
      const defs = svgEl('defs', {}, s); const f = svgEl('filter', { id: 'goo' }, defs);
      svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 12, result: 'b' }, f);
      svgEl('feColorMatrix', { in: 'b', mode: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10', result: 'g' }, f);
      const lg = svgEl('linearGradient', { id: 'gg', x1: 0, y1: 0, x2: 1, y2: 1 }, defs); svgEl('stop', { offset: 0, 'stop-color': C.coral }, lg); svgEl('stop', { offset: 1, 'stop-color': C.violet }, lg);
      const grp = svgEl('g', { filter: 'url(#goo)', fill: 'url(#gg)' }, s);
      const big = svgEl('circle', { cx: 320, cy: 180, r: 56 }, grp);
      const small = [...Array(7)].map(() => svgEl('circle', { cx: 320, cy: 180, r: 24 }, grp));
      return t => {
        big.setAttribute('r', 52 + 6 * Math.sin(t * 2));
        small.forEach((c, i) => { const a = t * (0.6 + i * 0.13) + i * 0.9, r = 70 + 90 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.3)); c.setAttribute('cx', 320 + Math.cos(a) * r * 1.4); c.setAttribute('cy', 180 + Math.sin(a) * r * 0.75); c.setAttribute('r', 18 + 8 * Math.sin(t + i)); });
      };
    },
  });

  EX.add({
    cat: 'ui', id: 'menu', kind: 'dom', title: 'Menu morph and staggered reveal', aka: 'hamburger to X, nav drawer, slide-in panel', tool: 'CSS transforms driven by JavaScript (or Framer Motion)', runs: 'WEB',
    notice: 'The three bars turn into an X: the top and bottom rotate, the middle collapses. The drawer slides in with ease-out-expo, and its items follow one by one.',
    use: 'mobile navigation, side panels, any open/close UI',
    prompt: 'Mobile menu: hamburger morphs to X in 300 ms, drawer slides in from the right with ease-out-expo, menu items stagger in 40 ms apart with a 16 px slide; reverse on close.',
    setup(st) {
      st.innerHTML = `<div class="mm-phone"><div class="mm-bar"><b>Studio</b><div class="mm-burger"><i></i><i></i><i></i></div></div>
        <div class="mm-body"><div class="mm-card"></div><div class="mm-card s"></div><div class="mm-card s"></div></div>
        <div class="mm-drawer">${['Home', 'Work', 'Shaders', 'Particles', 'Contact'].map(x => `<div class="mm-item">${x}</div>`).join('')}</div></div>`;
      const bars = st.querySelectorAll('.mm-burger i'), drawer = st.querySelector('.mm-drawer'), items = st.querySelectorAll('.mm-item');
      return t => {
        const lt = t % 3.4; const open = ease.inOut(seg(lt, 0.5, 0.8)) * (1 - ease.inOut(seg(lt, 2.4, 2.7)));
        bars[0].style.transform = `translateY(${open * 8}px) rotate(${open * 45}deg)`;
        bars[1].style.transform = `scaleX(${1 - open})`; bars[1].style.opacity = 1 - open;
        bars[2].style.transform = `translateY(${-open * 8}px) rotate(${-open * 45}deg)`;
        const dk = ease.expo(seg(lt, 0.55, 1.15)) * (1 - ease.out(seg(lt, 2.4, 2.75)));
        drawer.style.transform = `translateX(${(1 - dk) * 105}%)`;
        items.forEach((it, i) => { const k = ease.out(seg(lt, 0.8 + i * 0.05, 1.2 + i * 0.05)) * (1 - seg(lt, 2.35, 2.5)); it.style.opacity = k; it.style.transform = `translateX(${(1 - k) * 18}px)`; });
      };
    },
  });

  EX.add({
    cat: 'ui', id: 'skeleton', kind: 'dom', title: 'Skeleton loading to content', aka: 'shimmer placeholder, content reveal, list stagger', tool: 'CSS gradients + JavaScript', runs: 'WEB',
    notice: 'Grey placeholders with a moving shine show the layout while data loads. Then the real rows replace them, each one slightly later than the one above.',
    use: 'feeds, dashboards, any screen that loads data',
    prompt: 'Skeleton loading state for the feed: grey blocks with a left-to-right shimmer every 1.2 s, then real cards fade and slide up 12 px, 60 ms stagger.',
    setup(st) {
      const row = (i) => `<div class="sk-row"><div class="sk-av sk"></div><div class="sk-lines"><div class="sk l1"></div><div class="sk l2"></div></div>
        <div class="sk-real"><div class="sk-av" style="background:${EX.PAL[i]}"></div><div><b>${['Ray marching', 'GPU particles', 'Cloth sim'][i]}</b><span>${['GLSL fragment shader', 'WebGL2 vertex shader', 'Blender, Bullet'][i]}</span></div></div></div>`;
      st.innerHTML = `<div class="sk-wrap">${[0, 1, 2].map(row).join('')}</div>`;
      const sks = st.querySelectorAll('.sk'), reals = st.querySelectorAll('.sk-real'), rows = st.querySelectorAll('.sk-row');
      return t => {
        const lt = t % 4.2, loading = lt < 1.8;
        const shine = ((lt % 1.2) / 1.2) * 300 - 100;
        sks.forEach(s => { s.style.backgroundPosition = `${-shine}% 0`; s.style.opacity = loading ? 1 : 1 - seg(lt, 1.8, 2.0); });
        reals.forEach((r, i) => { const k = ease.out(seg(lt, 1.85 + i * 0.08, 2.35 + i * 0.08)) * (1 - seg(lt, 3.9, 4.1)); r.style.opacity = k; r.style.transform = `translateY(${(1 - k) * 12}px)`; });
        rows.forEach(r => r.style.opacity = 1 - seg(lt, 3.9, 4.1) * (loading ? 0 : 1));
      };
    },
  });

  EX.add({
    cat: 'ui', id: 'dashboard', title: 'Dashboard count-up', aka: 'number ticker, progress ring, chart grow-in', tool: 'Canvas 2D (or SVG + CSS)', runs: 'CPU',
    notice: 'Numbers count up with ease-out so they slow down near the final value. The ring fills, bars grow in a stagger, and the sparkline draws itself.',
    use: 'stats reveals, reports, investor or product videos',
    prompt: 'Animate the stats card: numbers count up over 1.2 s with ease-out-expo, the progress ring fills to 72%, five bars grow with a 70 ms stagger, sparkline draws on.',
    setup(cv) {
      const g = cv.getContext('2d');
      return t => {
        const lt = t % 4.6, out = 1 - seg(lt, 4.2, 4.5); const k = ease.expo(seg(lt, 0.2, 1.6));
        g.fillStyle = '#101018'; g.fillRect(0, 0, 640, 360); g.globalAlpha = out;
        const card = (x, y, w, h) => { g.fillStyle = '#181822'; g.beginPath(); g.roundRect(x, y, w, h, 14); g.fill(); };
        card(24, 24, 280, 150); card(328, 24, 288, 150); card(24, 190, 592, 146);
        g.font = '500 14px Segoe UI'; g.fillStyle = '#8a8794'; g.fillText('Frames rendered', 44, 56); g.fillText('GPU load', 348, 56); g.fillText('Renders per day', 44, 220);
        g.font = '700 48px Bahnschrift'; g.fillStyle = C.cream; g.fillText(Math.round(3600 * k).toLocaleString('en-US'), 44, 120);
        g.font = '600 15px Segoe UI'; g.fillStyle = C.green; g.fillText('+' + (18.4 * k).toFixed(1) + '%', 44, 152);
        const rk = ease.out(seg(lt, 0.4, 1.8)) * 0.72;
        g.lineWidth = 14; g.lineCap = 'round'; g.strokeStyle = '#26263a'; g.beginPath(); g.arc(540, 100, 48, 0, 7); g.stroke();
        g.strokeStyle = C.cyan; g.beginPath(); g.arc(540, 100, 48, -Math.PI / 2, -Math.PI / 2 + rk * Math.PI * 2); g.stroke();
        g.font = '700 26px Bahnschrift'; g.fillStyle = C.cream; g.textAlign = 'center'; g.fillText(Math.round(rk * 100) + '%', 540, 110); g.textAlign = 'left';
        g.font = '700 40px Bahnschrift'; g.fillText((9.8 * k).toFixed(1) + ' ms', 348, 120);
        const vals = [0.45, 0.7, 0.55, 0.9, 0.78, 0.62, 0.95];
        vals.forEach((v, i) => { const bk = ease.back(seg(lt, 0.5 + i * 0.07, 1.1 + i * 0.07)); const bh = 80 * v * bk; g.fillStyle = i === 6 ? C.coral : '#3a3a55'; g.beginPath(); g.roundRect(44 + i * 40, 316 - bh, 26, Math.max(0, bh), 5); g.fill(); });
        const sk = seg(lt, 0.8, 2.2); g.strokeStyle = C.amber; g.lineWidth = 3; g.beginPath();
        for (let i = 0; i <= 60 * sk; i++) { const x = 340 + i * 4.3, y = 290 - 50 * (0.5 + 0.35 * Math.sin(i * 0.25) + 0.15 * Math.sin(i * 0.9)) - i * 0.4; i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke(); g.globalAlpha = 1;
      };
    },
  });
})();
