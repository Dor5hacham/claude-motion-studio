// Animation library demos for Motion Examples.html: one card per open-source library.
// The libraries load from vendor/ as classic scripts. Every demo is driven by the shared
// frame(t, dt) loop, so library timelines stay paused and are seeked by time.
(function () {
  const { C, lerp, ease, clamp01 } = EX;
  const MONO = '"Cascadia Mono", Consolas, monospace', DISP = 'Bahnschrift, "Segoe UI", sans-serif';
  const HAND = '"Segoe Print", "Comic Sans MS", "Segoe UI", sans-serif';
  // Library globals from the vendor/ scripts loaded before this file (undefined if a file failed to load).
  const G = /** @type {any} */ (window);
  const { LIBS_THREE, PIXI, p5, gsap, SplitText, MorphSVGPlugin, Motion, anime, lottie, d3, Matter, rough } = G;
  // Tone.js is loaded on the first Play click, so no AudioContext is created before a user gesture.
  const VENDOR = (document.currentScript && /** @type {HTMLScriptElement} */ (document.currentScript).src || '').replace(/catalog\/libs\.js(\?.*)?$/, '') + 'vendor/';
  let tonePromise = null;
  const loadTone = () => tonePromise || (tonePromise = new Promise((res, rej) => {
    if (G.Tone) return res(G.Tone);
    const sc = document.createElement('script'); sc.src = VENDOR + 'Tone.js';
    sc.onload = () => res(G.Tone); sc.onerror = () => { tonePromise = null; rej(new Error('Tone.js did not load from ' + sc.src)); };
    document.head.appendChild(sc);
  }));

  // Shows a short message in the stage when a library file did not load.
  function missing(stage, name) {
    const msg = name + ' did not load. Check site/vendor/.';
    if (stage.getContext) {
      const g = stage.getContext('2d');
      if (g) { g.fillStyle = C.bg; g.fillRect(0, 0, 640, 360); g.fillStyle = C.coral; g.font = `600 16px ${MONO}`; g.textAlign = 'center'; g.fillText(msg, 320, 180); g.textAlign = 'left'; }
    } else stage.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;color:${C.coral};font:600 16px ${MONO}">${msg}</div>`;
    return () => {};
  }
  // Adds a scoped <style> block to a DOM stage.
  const css = (stage, txt) => { const s = document.createElement('style'); s.textContent = txt; stage.appendChild(s); };
  const div = (parent, cls, html) => { const d = document.createElement('div'); if (cls) d.className = cls; if (html !== undefined) d.innerHTML = html; parent.appendChild(d); return d; };
  const keep = (L, key, def) => (L.state && L.state[key] !== undefined ? L.state[key] : def);

  // ---------------------------------------------------------------- Three.js
  EX.add({
    cat: 'libs', id: 'three-configurator', kind: 'dom', title: 'Product configurator', aka: '3D product viewer, PBR materials, glass and velvet shading, material swatches', runs: 'GPU',
    tool: 'Three.js (MeshPhysicalMaterial transmission, clearcoat and sheen, RoomEnvironment, LatheGeometry)',
    notice: 'A perfume bottle made from one spun outline (LatheGeometry) and shaded with MeshPhysicalMaterial. Transmission makes glass that bends the light strips behind it, clearcoat adds a lacquer layer for ceramic, and sheen gives soft velvet. Pick a finish or a color and the material values tween over about half a second. Drag the bottle to turn it.',
    use: 'product pages, online shop configurators, launch sites, packaging previews',
    prompt: 'Using Three.js, build a product configurator: a perfume bottle made with LatheGeometry and MeshPhysicalMaterial (transmission, ior {ior}, thickness {thick}, clearcoat, sheen), RoomEnvironment reflections at intensity {env}, a soft contact shadow, drag to rotate with inertia, auto-spin {spin} rad/s, and finish and color swatch buttons (glass, frosted, ceramic, velvet) that tween the material over 0.6 s.',
    params: [
      { key: 'spin', label: 'Auto spin', min: 0, max: 2, step: 0.1, value: 0.5 },
      { key: 'ior', label: 'Glass IOR', min: 1, max: 2.33, step: 0.01, value: 1.5 },
      { key: 'thick', label: 'Glass thickness', min: 0, max: 3, step: 0.1, value: 1.2 },
      { key: 'env', label: 'Reflections', min: 0, max: 2, step: 0.05, value: 1 },
    ],
    setup(st, L) { if (!LIBS_THREE) return missing(st, 'Three.js'); return LIBS_THREE.setup(st, L); },
  });

  // ---------------------------------------------------------------- PixiJS
  // Builds the koi pond scene into an initialized PIXI.Application and returns frame(t, dt).
  function koiPond(app, st, L) {
    const P = PIXI, R = EX.rng(11);
    app.stage.removeChildren().forEach(c => c.destroy({ children: true }));
    const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
    const T = app._koiTex || (app._koiTex = (() => {
      const r = EX.rng(3);
      const bottom = mk(700, 420, (g, w, h) => {
        const gr = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 420); gr.addColorStop(0, '#15414a'); gr.addColorStop(1, '#06131a');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 420; i++) {
          const x = r() * w, y = r() * h, s = 3 + r() * 11, l = 14 + r() * 22;
          g.fillStyle = `hsla(${190 + r() * 30},${18 + r() * 20}%,${l}%,${0.35 + r() * 0.4})`;
          g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.3), r() * 3, 0, 7); g.fill();
        }
        for (let i = 0; i < 26; i++) { // weed clumps
          const x = r() * w, y = r() * h; g.strokeStyle = 'rgba(40,90,70,0.45)'; g.lineWidth = 2;
          for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 30, y - 10, x + (r() - 0.5) * 40, y - 18 - r() * 16); g.stroke(); }
        }
      });
      const disp = mk(256, 256, (g, w, h) => {
        g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 70; i++) {
          const x = r() * w, y = r() * h, s = 18 + r() * 46, cr = Math.floor(70 + r() * 116), cg = Math.floor(70 + r() * 116);
          for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
            const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, s);
            gr.addColorStop(0, `rgba(${cr},${cg},128,0.55)`); gr.addColorStop(1, `rgba(${cr},${cg},128,0)`);
            g.fillStyle = gr; g.fillRect(x + ox - s, y + oy - s, s * 2, s * 2);
          }
        }
      });
      const caus = mk(256, 256, (g, w, h) => {
        g.filter = 'blur(1.5px)'; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2.2;
        for (let i = 0; i < 46; i++) {
          const x = r() * w, y = r() * h, a = r() * 6.3, l = 30 + r() * 50;
          for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
            g.beginPath(); g.moveTo(x + ox, y + oy);
            g.quadraticCurveTo(x + ox + Math.cos(a + 1) * l * 0.6, y + oy + Math.sin(a + 1) * l * 0.6, x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke();
          }
        }
      });
      const vign = mk(640, 360, (g, w, h) => {
        const gr = g.createRadialGradient(w / 2, h / 2, 150, w / 2, h / 2, 400); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      });
      const skins = [['#f4efe6', '#ff5a36'], ['#ff5a36', '#f4efe6'], ['#ffb020', '#ff5a36'], ['#f4efe6', '#1a1a22'], ['#f4efe6', '#ffb020'], ['#ff7a3a', '#1a1a22']];
      const fish = skins.map(([base, spot]) => mk(150, 48, (g) => {
        const body = new Path2D('M28,24 C50,9 112,8 140,17 C150,21 150,27 140,31 C112,40 50,39 28,24 Z');
        g.fillStyle = 'rgba(244,239,230,0.55)'; // fins
        g.beginPath(); g.moveTo(32, 24); g.bezierCurveTo(14, 6, 4, 4, 1, 8); g.bezierCurveTo(8, 20, 8, 28, 1, 40); g.bezierCurveTo(4, 44, 14, 42, 32, 24); g.fill();
        g.beginPath(); g.ellipse(104, 9, 12, 5, -0.5, 0, 7); g.fill(); g.beginPath(); g.ellipse(104, 39, 12, 5, 0.5, 0, 7); g.fill();
        g.fillStyle = base; g.fill(body);
        g.save(); g.clip(body); g.fillStyle = spot;
        for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(40 + r() * 95, 16 + r() * 16, 8 + r() * 16, 5 + r() * 8, r() * 3, 0, 7); g.fill(); }
        g.restore();
        g.fillStyle = '#0b0b10'; g.beginPath(); g.arc(136, 20, 1.6, 0, 7); g.fill(); g.beginPath(); g.arc(136, 28, 1.6, 0, 7); g.fill();
      }));
      const tx = c => P.Texture.from(c);
      const dT = tx(disp); try { dT.source.addressMode = 'repeat'; } catch (e) { /* older API */ }
      const cT = tx(caus); try { cT.source.addressMode = 'repeat'; } catch (e) { /* older API */ }
      return { bottom: tx(bottom), disp: dT, caus: cT, vign: tx(vign), fish: fish.map(tx) };
    })());

    const dispSprite = new P.Sprite(T.disp); dispSprite.scale.set(2.2);
    app.stage.addChild(dispSprite); // sits behind the opaque pond, only drives the filter
    const water = new P.Container(); app.stage.addChild(water);
    const bottom = new P.Sprite(T.bottom); bottom.position.set(-30, -30); water.addChild(bottom);
    const shadows = new P.Container(); shadows.alpha = 0.5; water.addChild(shadows);
    const fishLayer = new P.Container(); water.addChild(fishLayer);
    const caus = new P.TilingSprite({ texture: T.caus, width: 700, height: 420 }); caus.position.set(-30, -30); caus.blendMode = 'add'; caus.alpha = 0.16; caus.tileScale.set(1.6); water.addChild(caus);
    const dispF = new P.DisplacementFilter({ sprite: dispSprite, scale: 16 });
    const blurF = new P.BlurFilter({ strength: 6, quality: 3 });
    const ripples = new P.Graphics(); app.stage.addChild(ripples);
    const pads = new P.Container(); app.stage.addChild(pads);
    const vign = new P.Sprite(T.vign); app.stage.addChild(vign);

    const padDefs = [[90, 70, 34], [560, 300, 42], [600, 70, 26], [70, 300, 30], [470, 40, 22]];
    const padObjs = padDefs.map(([x, y, rr], i) => {
      const g = new P.Graphics();
      g.moveTo(0, 0).arc(0, 0, rr, 0.32, Math.PI * 2 - 0.05).closePath().fill({ color: i % 2 ? 0x2d6b48 : 0x23583c }).stroke({ width: 2, color: 0x3f8a5e });
      for (let k = 1; k < 7; k++) { const a = 0.32 + k * 0.85; g.moveTo(0, 0).lineTo(Math.cos(a) * rr * 0.85, Math.sin(a) * rr * 0.85); }
      g.stroke({ width: 1, color: 0x4f9c6c, alpha: 0.6 });
      if (i === 1) { // lotus flower
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.ellipse(Math.cos(a) * 9, Math.sin(a) * 9, 9, 5).fill({ color: k % 2 ? 0xf4efe6 : 0xffc0a8 }); }
        g.circle(0, 0, 5).fill({ color: 0xffb020 });
      }
      g.position.set(x, y); g.rotation = R() * 6; pads.addChild(g); return { g, x, y, ph: R() * 6 };
    });

    const nFish = Math.round((L.p && L.p.fish) || 9);
    const fish = [];
    for (let i = 0; i < nFish; i++) {
      const tex = T.fish[i % T.fish.length], pts = [];
      for (let k = 0; k < 12; k++) pts.push(new P.Point(k * 150 / 11, 0));
      const c = new P.Container(), rope = new P.MeshRope({ texture: tex, points: pts }); rope.x = -75; c.addChild(rope);
      const sc = new P.Container(), sh = new P.MeshRope({ texture: tex, points: pts }); sh.x = -75; sh.tint = 0x000000; sc.addChild(sh);
      const s = 0.5 + R() * 0.45; c.scale.set(s); sc.scale.set(s);
      fishLayer.addChild(c); shadows.addChild(sc);
      fish.push({ c, sc, pts, s, x: 80 + R() * 480, y: 60 + R() * 240, a: R() * 6.28, sp: 32 + R() * 26, ph: R() * 6.28, seed: R() * 50 });
    }
    const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
    return (t, dt) => {
      const p = L.p || {};
      const on = st.filters;
      water.filters = on ? [dispF] : []; shadows.filters = on ? [blurF] : [];
      dispF.scale.x = dispF.scale.y = on ? (p.wobble !== undefined ? p.wobble : 16) : 0;
      caus.visible = on;
      dispSprite.x = (t * 18) % 563; dispSprite.y = (t * 11) % 563;
      caus.tilePosition.set(t * 9, t * 5);
      const sp = p.speed !== undefined ? p.speed : 1;
      const food = st.food && t - st.food.t < 5 ? st.food : null;
      for (const f of fish) {
        let turn = (EX.noise(f.seed, t * 0.35) - 0.5) * 3.2;
        const edge = clamp01((Math.max(Math.abs(f.x - 320) / 270, Math.abs(f.y - 180) / 140) - 0.7) / 0.3);
        turn += wrapA(Math.atan2(180 - f.y, 320 - f.x) - f.a) * edge * 4;
        let boost = 1;
        if (food) { const da = wrapA(Math.atan2(food.y - f.y, food.x - f.x) - f.a); turn += da * 2.2; if (Math.hypot(food.x - f.x, food.y - f.y) > 30) boost = 1.8; }
        f.a += turn * dt; const v = f.sp * sp * boost;
        f.x += Math.cos(f.a) * v * dt; f.y += Math.sin(f.a) * v * dt;
        f.ph += dt * (3 + v * 0.12);
        for (let k = 0; k < 12; k++) { const u = 1 - k / 11; f.pts[k].y = Math.sin(k * 0.55 - f.ph) * 7 * Math.pow(u, 1.4) - turn * 4 * u * u; }
        f.c.position.set(f.x, f.y); f.c.rotation = f.a;
        f.sc.position.set(f.x + 10, f.y + 14); f.sc.rotation = f.a;
      }
      // ripples: a few on a timer plus one where food was dropped
      ripples.clear();
      const period = 0.8;
      for (let k = Math.max(0, Math.floor(t / period) - 3); k <= Math.floor(t / period); k++) {
        const r2 = EX.rng(k * 31 + 7), x = 40 + r2() * 560, y = 30 + r2() * 300, age = t - k * period;
        if (age < 0 || age > 2.4) continue;
        for (let j = 0; j < 2; j++) { const a2 = age - j * 0.35; if (a2 <= 0) continue; ripples.circle(x, y, 4 + a2 * 34).stroke({ width: 1.5, color: 0xcff6ff, alpha: 0.35 * (1 - a2 / 2.4) }); }
      }
      if (food) { const age = t - food.t; for (let j = 0; j < 3; j++) { const a2 = age - j * 0.3; if (a2 > 0 && a2 < 2.5) ripples.circle(food.x, food.y, 3 + a2 * 40).stroke({ width: 2, color: 0xffb020, alpha: 0.6 * (1 - a2 / 2.5) }); } if (age < 4) ripples.circle(food.x, food.y, 3).fill({ color: 0xffb020, alpha: 1 - age / 4 }); }
      padObjs.forEach(o => { o.g.x = o.x + Math.sin(t * 0.4 + o.ph) * 3; o.g.y = o.y + Math.cos(t * 0.33 + o.ph) * 3; o.g.rotation += dt * 0.02; });
      app.render();
    };
  }

  EX.add({
    cat: 'libs', id: 'pixi-koi', title: 'Koi pond', aka: '2D WebGL scene, displacement water, sprite mesh, rope animation', runs: 'GPU',
    tool: 'PixiJS (MeshRope, DisplacementFilter, BlurFilter, TilingSprite)', w: 640, h: 360,
    notice: 'Each fish is a picture bent along a MeshRope, so a sine wave down its spine makes it swim. A DisplacementFilter pushes the whole pond around with a moving noise image, which looks like water. Turn the filters off to see the same scene without them. Click the pond to drop food.',
    use: 'game scenes, playful landing pages, ambient backgrounds, interactive banners',
    prompt: 'Using PixiJS v8, make a top-down koi pond: {fish} koi made from generated textures on MeshRope with a swimming sine wave at {speed} speed, blurred drop shadows, a DisplacementFilter (scale {wobble}) over the water, scrolling caustic light, lily pads, and fish that swim to where I click.',
    params: [
      { key: 'fish', label: 'Fish', min: 3, max: 20, step: 1, value: 9, restart: true },
      { key: 'wobble', label: 'Water wobble', min: 0, max: 40, step: 1, value: 16 },
      { key: 'speed', label: 'Swim speed', min: 0.3, max: 2.5, step: 0.1, value: 1, unit: 'x' },
    ],
    controls: [
      { label: 'Filters on', on: true, fn: L => { L.state.filters = true; } },
      { label: 'Filters off', fn: L => { L.state.filters = false; } },
    ],
    setup(cv, L) {
      if (!PIXI) return missing(cv, 'PixiJS');
      const st = { filters: keep(L, 'filters', true), food: /** @type {any} */ (null) }; L.state = st;
      let frame = null;
      const go = app => { frame = koiPond(app, st, L); };
      const box = cv._pixi;
      if (box) { if (box.app) go(box.app); else box.wait = [go]; }
      else {
        const app = new PIXI.Application(); const b = cv._pixi = { app: null, wait: [go] };
        app.init({ canvas: cv, width: 640, height: 360, background: '#06131a', antialias: true, autoStart: false, sharedTicker: false, preference: 'webgl', hello: false, resolution: 1, autoDensity: false })
          .then(() => { app.ticker.stop(); b.app = app; b.wait.forEach(f => f(app)); b.wait = []; })
          .catch(err => console.error('pixi-koi', err));
      }
      cv.onclick = e => { const r = cv.getBoundingClientRect(); st.food = { x: (e.clientX - r.left) * 640 / r.width, y: (e.clientY - r.top) * 360 / r.height, t: L.t }; };
      cv.style.cursor = 'pointer';
      return (t, dt) => { if (frame) frame(t, dt); };
    },
  });

  // ---------------------------------------------------------------- p5.js
  EX.add({
    cat: 'libs', id: 'p5-truchet', kind: 'dom', title: 'Truchet tile flip', aka: 'Truchet tiles, 10 PRINT maze, tile pattern, generative pattern', runs: 'CPU',
    tool: 'p5.js (instance mode, arc, rotate, noise, lerpColor)',
    notice: 'Every square holds two quarter circles. Turn a square 90 degrees and the pipes connect in a new way, so the whole pattern rewires itself. Every wave flips a random group of tiles, spreading out from one point, and p5 noise picks the colors.',
    use: 'generative posters, backgrounds, loading screens, pattern design',
    prompt: 'Using p5.js in instance mode, draw a grid of Truchet tiles ({cell} cells) made of two quarter-circle arcs. Every {every} s flip {flip}% of the tiles by 90 degrees with an eased rotation that spreads out from a random tile. Color the strokes with noise() and lerpColor between coral, amber, cyan and violet on near-black.',
    params: [
      { key: 'cell', label: 'Tile size', min: 24, max: 72, step: 4, value: 40, unit: ' px', restart: true },
      { key: 'flip', label: 'Tiles per wave', min: 5, max: 80, step: 5, value: 35, unit: '' },
      { key: 'every', label: 'Wave every', min: 0.8, max: 4, step: 0.1, value: 1.8, unit: '' },
    ],
    controls: [
      { label: 'Arcs', on: true, fn: L => { L.state.mode = 0; } },
      { label: 'Tubes', fn: L => { L.state.mode = 1; } },
      { label: 'Maze', fn: L => { L.state.mode = 2; } },
    ],
    setup(st, L) {
      if (!p5) return missing(st, 'p5.js');
      if (st._p5) { try { st._p5.remove(); } catch (e) { /* already gone */ } }
      const S = { mode: keep(L, 'mode', 0) }; L.state = S;
      const cell = (L.p && L.p.cell) || 40;
      const cols = Math.ceil(640 / cell) + 1, rows = Math.ceil(360 / cell) + 1;
      const ox = (640 - cols * cell) / 2, oy = (360 - rows * cell) / 2;
      const base = new Uint8Array(cols * rows); { const r = EX.rng(5); for (let i = 0; i < base.length; i++) base[i] = r() < 0.5 ? 1 : 0; }
      let waveT0 = 0, waveIdx = 0; const waves = [];
      // A wave: random origin, random subset of tiles, delay by distance.
      const makeWave = (k, frac) => {
        const r = EX.rng(k * 7919 + 13), cx = Math.floor(r() * cols), cy = Math.floor(r() * rows), list = [];
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (r() < frac) list.push([j * cols + i, Math.hypot(i - cx, j - cy) * 0.045]);
        return list;
      };
      let T = 0, ready = false;
      const PAL = ['#ff5a36', '#ffb020', '#2bc4e6', '#7a5cff', '#ff5a36'];
      const inst = new p5(p => {
        p.setup = () => { p.createCanvas(640, 360); p.pixelDensity(1); p.noLoop(); p.noiseSeed(4); ready = true; };
        p.draw = () => {
          if (!ready) return;
          const pal = PAL.map(c => p.color(c));
          const colAt = (i, j) => { const n = clamp01((p.noise(i * 0.11, j * 0.11, T * 0.12) - 0.25) * 2) * 3.999; const k = Math.floor(n); return p.lerpColor(pal[k], pal[k + 1], n - k); };
          p.background('#0b0b10'); p.noFill();
          const cur = waves.length ? waves[waves.length - 1] : null, lt = T - waveT0;
          const anim = new Map(); if (cur) for (const [idx, d] of cur) anim.set(idx, ease.inOut(clamp01((lt - d) / 0.45)));
          for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
            const idx = j * cols + i, a = anim.has(idx) ? anim.get(idx) : 0;
            const s = cell, x = ox + i * s + s / 2, y = oy + j * s + s / 2, col = colAt(i, j);
            p.push(); p.translate(x, y); p.rotate((base[idx] + a) * p.HALF_PI);
            const pop = 1 - Math.sin(a * Math.PI) * 0.18; p.scale(pop);
            if (S.mode === 2) {
              p.strokeCap(p.ROUND); p.stroke(col); p.strokeWeight(s * 0.16); p.line(-s / 2, -s / 2, s / 2, s / 2);
            } else {
              const arcs = () => { p.arc(-s / 2, -s / 2, s, s, 0, p.HALF_PI); p.arc(s / 2, s / 2, s, s, p.PI, p.PI + p.HALF_PI); };
              p.strokeCap(p.SQUARE);
              if (S.mode === 1) {
                p.stroke(p.lerpColor(col, p.color('#0b0b10'), 0.55)); p.strokeWeight(s * 0.36); arcs();
                p.stroke(col); p.strokeWeight(s * 0.24); arcs();
                p.stroke(244, 239, 230, 150); p.strokeWeight(s * 0.05); arcs();
              } else { p.stroke(col); p.strokeWeight(s * 0.2); arcs(); }
            }
            p.pop();
          }
        };
      }, st);
      st._p5 = inst;
      return t => {
        T = t; const every = (L.p && L.p.every) || 1.8, frac = ((L.p && L.p.flip) || 35) / 100;
        if (t - waveT0 >= every || !waves.length) {
          if (waves.length) for (const [idx] of waves[waves.length - 1]) base[idx] ^= 1;
          waves.length = 0; waves.push(makeWave(waveIdx++, frac)); waveT0 = t;
        }
        if (ready) inst.redraw();
      };
    },
  });

  // ---------------------------------------------------------------- GSAP
  EX.add({
    cat: 'libs', id: 'gsap-scrub', kind: 'dom', title: 'Scroll-scrubbed story', aka: 'scrollytelling, scroll-linked animation, ScrollTrigger scrub, pinned section', runs: 'WEB',
    tool: 'GSAP (timeline, SplitText, MorphSVGPlugin, progress scrubbing)',
    notice: 'One paused GSAP timeline holds the whole story: split letters fly in, a circle morphs into a star, panels slide sideways, a title drops in. The scroll position sets the timeline progress, as ScrollTrigger scrub does, so scrolling back plays it in reverse. Here a fake scroll (bar on the right) moves on its own.',
    use: 'product launch pages, scrollytelling articles, portfolio sites',
    prompt: 'Using GSAP with ScrollTrigger, SplitText and MorphSVGPlugin, build a pinned scroll story: the headline splits into characters that fly in with a {stagger} s stagger, a circle morphs into a star while a counter runs 0 to 100%, three panels scroll sideways, then the end title drops in with bounce. Use scrub: {scrub} so it follows the scrollbar smoothly in both directions.',
    params: [
      { key: 'scrub', label: 'Scrub lag', min: 0, max: 2, step: 0.1, value: 0.6, unit: ' s' },
      { key: 'stagger', label: 'Letter stagger', min: 0.01, max: 0.12, step: 0.01, value: 0.04, unit: '', restart: true },
    ],
    setup(st, L) {
      if (!gsap) return missing(st, 'GSAP');
      if (st._tl) { st._tl.kill(); st._tl = null; }
      const plugins = [SplitText, MorphSVGPlugin].filter(Boolean); if (plugins.length) gsap.registerPlugin(...plugins);
      css(st, `.gs{position:absolute;inset:0;background:radial-gradient(120% 90% at 30% 20%,#1d1b3a 0%,#0b0b10 70%);overflow:hidden;font-family:${DISP};color:${C.cream}}
        .gs-h{position:absolute;left:0;right:22px;top:92px;text-align:center;font:700 62px/1.02 ${DISP};letter-spacing:1px}
        .gs-h em{font-style:normal;color:${C.coral}}
        .gs-svgw{position:absolute;left:220px;top:80px;width:200px;height:200px}
        .gs-count{position:absolute;left:0;right:22px;top:290px;text-align:center;font:700 26px ${MONO};color:${C.amber};opacity:0}
        .gs-track{position:absolute;top:70px;left:0;display:flex;gap:26px;padding-left:40px}
        .gs-panel{width:250px;height:200px;border-radius:18px;padding:22px;box-sizing:border-box;color:#0b0b10;font:700 30px/1.05 ${DISP};display:flex;flex-direction:column;justify-content:space-between}
        .gs-panel span{font:600 13px ${MONO};letter-spacing:1px;opacity:.75}
        .gs-end{position:absolute;left:0;right:22px;top:96px;text-align:center;font:800 118px/1 ${DISP};letter-spacing:6px}
        .gs-end div{display:inline-block}
        .gs-sub{position:absolute;left:0;right:22px;top:232px;text-align:center;font:600 16px ${MONO};color:${C.cyan};letter-spacing:2px}
        .gs-bar{position:absolute;right:8px;top:8px;bottom:8px;width:7px;border-radius:4px;background:#22222e}
        .gs-bar i{position:absolute;left:0;width:7px;height:62px;border-radius:4px;background:${C.cream};opacity:.8}
        .gs-hud{position:absolute;left:14px;bottom:10px;font:12px ${MONO};color:#8a8794}
        .gs-hud b{color:${C.amber};font-weight:600}`);
      const W = div(st, 'gs');
      const h = div(W, 'gs-h', 'SCROLL TELLS<br><em>THE STORY</em>');
      const sw = div(W, 'gs-svgw');
      const star = (() => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 36 : 92; d += (i ? 'L' : 'M') + (100 + Math.cos(a) * r).toFixed(1) + ',' + (100 + Math.sin(a) * r).toFixed(1); } return d + 'Z'; })();
      sw.innerHTML = `<svg viewBox="0 0 200 200" width="200" height="200"><path class="gs-blob" fill="${C.violet}" d="M100,18 C145,18 182,55 182,100 C182,145 145,182 100,182 C55,182 18,145 18,100 C18,55 55,18 100,18Z"/><path class="gs-star" d="${star}" style="display:none"/></svg>`;
      const blob = sw.querySelector('.gs-blob'), starEl = sw.querySelector('.gs-star');
      const count = div(W, 'gs-count', '0%');
      const track = div(W, 'gs-track');
      [['Pin', 'the section stays put', C.coral], ['Scrub', 'progress follows scroll', C.amber], ['Reverse', 'scroll up to rewind', C.cyan]].forEach(([a, b, c], i) => { const pnl = div(track, 'gs-panel', `<span>0${i + 1}</span><div>${a}</div><span>${b}</span>`); pnl.style.background = c; });
      const end = div(W, 'gs-end', 'GSAP'); const sub = div(W, 'gs-sub', 'ONE TIMELINE, DRIVEN BY SCROLL');
      const bar = /** @type {HTMLElement} */ (div(W, 'gs-bar', '<i></i>').firstChild); const hud = div(W, 'gs-hud');
      const splitH = SplitText ? new SplitText(h, { type: 'chars,words' }) : null;
      const splitE = SplitText ? new SplitText(end, { type: 'chars' }) : null;
      const chars = splitH ? splitH.chars : [h], echars = splitE ? splitE.chars : [end];
      const stg = (L.p && L.p.stagger) || 0.04;
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } }); st._tl = tl;
      const cnt = { v: 0 };
      tl.from(chars, { yPercent: 130, rotate: 25, opacity: 0, duration: 0.8, stagger: stg, ease: 'back.out(2)' }, 0)
        .to(chars, { yPercent: -140, opacity: 0, duration: 0.6, stagger: { each: stg * 0.5, from: 'center' }, ease: 'power2.in' }, 1.7)
        .fromTo(sw, { scale: 0, rotate: -120 }, { scale: 1, rotate: 0, duration: 0.8, ease: 'back.out(1.6)' }, 2.1)
        .to(count, { opacity: 1, duration: 0.3 }, 2.1)
        .to(cnt, { v: 100, duration: 1.8, ease: 'none', onUpdate: () => { count.textContent = Math.round(cnt.v) + '%'; } }, 2.1)
        .to(blob, Object.assign({ fill: C.amber, duration: 1, ease: 'power2.inOut' }, MorphSVGPlugin ? { morphSVG: starEl } : {}), 2.9)
        .to(sw, { rotate: 144, duration: 1, ease: 'power2.inOut' }, 2.9)
        .to(sw, { x: -460, opacity: 0, duration: 0.6, ease: 'power2.in' }, 4.1)
        .to(count, { opacity: 0, duration: 0.3 }, 4.1)
        .fromTo(track, { x: 640 }, { x: -260, duration: 2.6, ease: 'none' }, 4.3)
        .to(track, { opacity: 0, duration: 0.3 }, 6.9)
        .from(echars, { y: -300, rotate: i => (i % 2 ? 30 : -30), duration: 1, stagger: 0.09, ease: 'bounce.out' }, 7.0)
        .from(sub, { opacity: 0, y: 20, duration: 0.5 }, 8.0)
        .to({}, { duration: 0.6 }, 8.5);
      const K = [[0, 0], [1.2, 0], [2.4, 0.2], [3.4, 0.2], [4.8, 0.46], [5.8, 0.46], [8.0, 0.8], [9.0, 0.8], [10.4, 1], [12.6, 1], [13.8, 0], [16, 0]];
      const scrollAt = t => { t %= 16; for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const [t0, v0] = K[i - 1], [t1, v1] = K[i]; return lerp(v0, v1, ease.inOut((t - t0) / (t1 - t0))); } return 0; };
      let shown = 0;
      return (t, dt) => {
        const target = scrollAt(t), lag = L.p ? L.p.scrub : 0.6;
        shown = lag > 0.01 ? shown + (target - shown) * (1 - Math.exp(-dt * 3 / lag)) : target;
        tl.progress(shown);
        bar.style.top = (target * (344 - 62)) + 'px';
        hud.innerHTML = `scroll <b>${Math.round(target * 100)}%</b> &nbsp; tl.progress(<b>${shown.toFixed(2)}</b>)`;
      };
    },
  });

  // ---------------------------------------------------------------- Motion
  EX.add({
    cat: 'libs', id: 'motion-springs', kind: 'dom', title: 'Spring layout shuffle', aka: 'spring physics, staggered layout animation, physics-based easing', runs: 'WEB',
    tool: 'Motion (motion.dev animate with type: spring, stagger)',
    notice: 'Twenty letter tiles move between four layouts: words, scattered, a ring and a stack. Each move is a spring, so it has no fixed duration; stiffness and damping decide how fast it gets there and how much it bounces. stagger() starts the tiles one after another from the center out. The graph shows the current spring.',
    use: 'card grids, filters and sorting, onboarding screens, playful headers',
    prompt: 'Using Motion (motion.dev) animate(), move 20 tiles between a word grid, a scatter, a ring and a stack every {hold} s. Animate x, y, rotate and scale with type: spring, stiffness {stiff}, damping {damp}, and delay: stagger({stg}, { from: "center" }).',
    params: [
      { key: 'stiff', label: 'Stiffness', min: 40, max: 800, step: 10, value: 260 },
      { key: 'damp', label: 'Damping', min: 4, max: 60, step: 1, value: 14 },
      { key: 'stg', label: 'Stagger', min: 0, max: 0.12, step: 0.005, value: 0.03, dec: 3 },
      { key: 'hold', label: 'Hold time', min: 1.2, max: 4, step: 0.1, value: 2.2 },
    ],
    setup(st, L) {
      if (!Motion || !Motion.animate) return missing(st, 'Motion');
      (st._anims || []).forEach(a => { try { a.stop(); } catch (e) { /* done */ } });
      css(st, `.mo{position:absolute;inset:0;background:#101018}
        .mo-t{position:absolute;left:0;top:0;width:52px;height:52px;border-radius:14px;display:grid;place-items:center;font:700 28px ${DISP};color:#0b0b10;box-shadow:0 6px 18px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.35);will-change:transform}
        .mo-g{position:absolute;right:14px;bottom:12px;width:150px;height:74px}
        .mo-l{position:absolute;left:14px;bottom:12px;font:12px ${MONO};color:#8a8794}
        .mo-l b{color:${C.amber};font-weight:600}`);
      const W = div(st, 'mo');
      const words = ['MOTION', 'SPRINGS', 'STAGGER'], grads = [[C.coral, C.amber], [C.amber, '#ffd27a'], [C.cyan, C.violet]];
      const tiles = [];
      words.forEach((w, r) => [...w].forEach((ch, c) => { const el = div(W, 'mo-t', ch); el.style.background = `linear-gradient(135deg,${grads[r][0]},${grads[r][1]})`; tiles.push({ el, r, c, len: w.length }); }));
      const n = tiles.length;
      const graph = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); graph.setAttribute('class', 'mo-g'); graph.setAttribute('viewBox', '0 0 150 74'); W.appendChild(graph);
      graph.innerHTML = `<rect width="150" height="74" rx="8" fill="#181822"/><line x1="8" x2="142" y1="22" y2="22" stroke="#34344a" stroke-dasharray="3 3"/><path fill="none" stroke="${C.coral}" stroke-width="2"/>`;
      const gpath = graph.querySelector('path'); const lab = div(W, 'mo-l');
      const LAY = [
        () => tiles.map(o => ({ x: 320 - (o.len * 60 - 8) / 2 + o.c * 60 + 26, y: 180 - 86 + o.r * 60 + 26, rotate: 0, scale: 1 })),
        (k) => { const r = EX.rng(k * 13 + 1); return tiles.map(() => ({ x: 50 + r() * 540, y: 46 + r() * 250, rotate: (r() - 0.5) * 90, scale: 0.7 + r() * 0.5 })); },
        () => tiles.map((_, i) => { const a = i / n * Math.PI * 2 - Math.PI / 2; return { x: 320 + Math.cos(a) * 138, y: 170 + Math.sin(a) * 138, rotate: a * 180 / Math.PI + 90, scale: 0.8 }; }),
        (k) => { const r = EX.rng(k * 7 + 3); return tiles.map(() => ({ x: 320 + (r() - 0.5) * 30, y: 170 + (r() - 0.5) * 24, rotate: (r() - 0.5) * 40, scale: 1.15 })); },
      ];
      const names = ['words', 'scatter', 'ring', 'stack'];
      let phase = -1, phaseT = 0, cur = LAY[0](), anims = [], delays = [], sig = '';
      const set = (el, v) => { el.style.transform = `translate(${v.x - 26}px,${v.y - 26}px) rotate(${v.rotate}deg) scale(${v.scale})`; };
      tiles.forEach((o, i) => set(o.el, cur[i]));
      const drawGraph = (k, d) => { // damped spring response, unit mass
        let x = 0, v = 0, pts = []; for (let i = 0; i <= 134; i++) { for (let s = 0; s < 4; s++) { const a = k * (1 - x) - d * v; v += a * 0.0025; x += v * 0.0025; } pts.push((8 + i) + ',' + (66 - x * 44).toFixed(1)); }
        gpath.setAttribute('d', 'M' + pts.join('L'));
      };
      return t => {
        const p = L.p || {}, hold = p.hold || 2.2, k = p.stiff || 260, d = p.damp || 14, stg = p.stg !== undefined ? p.stg : 0.03;
        const ph = Math.floor(t / hold);
        if (ph !== phase) {
          const from = ph === 0 ? cur : LAY[ph % 4](ph);
          phase = ph; phaseT = ph * hold;
          const to = LAY[(ph + 1) % 4](ph + 1);
          anims.forEach(a => { try { a.stop(); } catch (e) { /* done */ } });
          const sd = Motion.stagger(stg, { from: 'center' });
          delays = tiles.map((_, i) => sd(i, n));
          anims = tiles.map((o, i) => {
            const a = Motion.animate(o.el, { x: [from[i].x - 26, to[i].x - 26], y: [from[i].y - 26, to[i].y - 26], rotate: [from[i].rotate, to[i].rotate], scale: [from[i].scale, to[i].scale] }, { type: Motion.spring, stiffness: k, damping: d, mass: 1 });
            a.pause(); a.time = 0; return a;
          });
          st._anims = anims;
          lab.innerHTML = `${names[ph % 4]} &rarr; <b>${names[(ph + 1) % 4]}</b>`;
        }
        const lt = t - phaseT;
        anims.forEach((a, i) => { a.time = Math.max(0, lt - delays[i]); });
        const s2 = k + '|' + d; if (s2 !== sig) { sig = s2; drawGraph(k, d); }
      };
    },
  });

  // ---------------------------------------------------------------- anime.js
  EX.add({
    cat: 'libs', id: 'anime-grid', kind: 'dom', title: 'Grid stagger ripple', aka: 'grid stagger, wave from point, staggered animation', runs: 'WEB',
    tool: 'anime.js v4 (createTimeline, stagger with grid, from and axis)',
    notice: 'A grid of 300 dots, and one anime.js call animates them all. stagger() with a grid option measures each dot\'s distance from a start cell, so the delay and size spread out like a ripple. With axis: "x" or "y" the distance is split by direction, which pushes dots away. Click any dot to start a wave there.',
    use: 'hero backgrounds, loading states, data grids, interactive art',
    prompt: 'Using anime.js v4, make a 25 x 12 grid of dots. Every {every} s pick a start cell and run createTimeline with delay: stagger({stg}, { grid: [25, 12], from: index }), scale up and back with outElastic, translateX and translateY with stagger({push}, { grid, from, axis }) so dots push away, and change color each wave. Clicking a dot starts a wave there.',
    params: [
      { key: 'stg', label: 'Stagger', min: 10, max: 120, step: 5, value: 45, unit: ' ms' },
      { key: 'push', label: 'Push', min: 0, max: 12, step: 0.5, value: 4, unit: '' },
      { key: 'every', label: 'Wave every', min: 1, max: 4, step: 0.1, value: 2.2, unit: '' },
    ],
    controls: [
      { label: 'Ripple', on: true, fn: L => { L.state.mode = 0; } },
      { label: 'Push', fn: L => { L.state.mode = 1; } },
      { label: 'Spin', fn: L => { L.state.mode = 2; } },
    ],
    setup(st, L) {
      if (!anime || !anime.createTimeline) return missing(st, 'anime.js');
      if (st._tl) { try { st._tl.pause(); } catch (e) { /* done */ } }
      const S = { mode: keep(L, 'mode', 0), click: /** @type {number|null} */ (null) }; L.state = S;
      css(st, `.an{position:absolute;inset:0;background:#0d0d14}
        .an-d{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#3a3a50;cursor:pointer}
        .an-ring{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:2px solid ${C.cream};opacity:0;pointer-events:none}
        .an-code{position:absolute;left:0;right:0;bottom:12px;text-align:center;font:13px ${MONO};color:#8a8794}
        .an-code b{color:${C.amber};font-weight:600}`);
      const W = div(st, 'an'); const COLS = 25, ROWS = 12, SP = 22, x0 = 320 - (COLS - 1) * SP / 2, y0 = 30;
      const dots = [];
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
        const d = div(W, 'an-d'); d.style.left = (x0 + i * SP) + 'px'; d.style.top = (y0 + j * SP) + 'px';
        const idx = dots.length; d.onclick = () => { S.click = idx; }; dots.push(d);
      }
      const ring = div(W, 'an-ring'), code = div(W, 'an-code');
      const cols = [C.coral, C.amber, C.cyan, C.violet, C.cream];
      const { createTimeline, stagger } = anime; const grid = [COLS, ROWS];
      let tl = null, wave = -1, waveT = 0, origin = 0;
      const build = (k, from) => {
        if (tl) { tl.seek(tl.duration); tl.pause(); }
        const p = L.p || {}, stg = p.stg || 45, push = p.push !== undefined ? p.push : 4, col = cols[k % cols.length];
        tl = createTimeline({ autoplay: false }); st._tl = tl;
        const delay = stagger(stg, { grid, from });
        if (S.mode === 0) {
          tl.add(dots, { scale: [{ to: stagger([2.1, 0.4], { grid, from }), duration: 320, ease: 'outQuad' }, { to: 1, duration: 1100, ease: 'outElastic(1, .5)' }], backgroundColor: { to: col, duration: 300, ease: 'linear' }, delay }, 0);
        } else if (S.mode === 1) {
          tl.add(dots, {
            translateX: [{ to: stagger(push, { grid, from, axis: 'x' }), duration: 380, ease: 'outQuad' }, { to: 0, duration: 1100, ease: 'outElastic(1, .45)' }],
            translateY: [{ to: stagger(push, { grid, from, axis: 'y' }), duration: 380, ease: 'outQuad' }, { to: 0, duration: 1100, ease: 'outElastic(1, .45)' }],
            scale: [{ to: 0.55, duration: 380 }, { to: 1, duration: 900, ease: 'outElastic(1, .5)' }],
            backgroundColor: { to: col, duration: 300, ease: 'linear' }, delay,
          }, 0);
        } else {
          tl.add(dots, { rotate: { from: 0, to: 180, duration: 900, ease: 'inOutQuad' }, borderRadius: [{ to: '15%', duration: 300 }, { to: '50%', duration: 700, ease: 'inOutSine' }], scale: [{ to: 1.45, duration: 400, ease: 'outQuad' }, { to: 1, duration: 700, ease: 'outBack(2)' }], backgroundColor: { to: col, duration: 300, ease: 'linear' }, delay }, 0);
        }
        const fx = ['scale', 'translateX/Y with axis', 'rotate + borderRadius'][S.mode];
        code.innerHTML = `delay: stagger(<b>${stg}</b>, { grid: [${COLS}, ${ROWS}], from: <b>${from}</b> }) &nbsp; ${fx}`;
        ring.style.left = dots[from].style.left; ring.style.top = dots[from].style.top;
      };
      return t => {
        const every = (L.p && L.p.every) || 2.2;
        if (S.click !== null) { origin = S.click; S.click = null; wave++; waveT = t; build(wave, origin); }
        else if (wave < 0 || t - waveT >= every) { wave++; waveT = t; origin = wave === 0 ? Math.floor(COLS * ROWS / 2) - 13 : Math.floor(EX.rng(wave * 97 + 5)() * COLS * ROWS); build(wave, origin); }
        const lt = (t - waveT) * 1000;
        tl.seek(Math.min(lt, tl.duration));
        const rk = clamp01(lt / 700); ring.style.opacity = (1 - rk).toFixed(3); ring.style.transform = `scale(${1 + rk * 3})`;
      };
    },
  });

  // ---------------------------------------------------------------- Lottie
  // Tiny helpers that write Lottie (Bodymovin) JSON by hand: groups, shapes, fills, strokes, trim paths, keyframes.
  const LT = (() => {
    const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255, 1];
    const EZ = { inOut: [0.65, 0, 0.35, 1], out: [0.22, 1, 0.36, 1], back: [0.34, 1.56, 0.64, 1], lin: [0.3, 0.3, 0.7, 0.7] };
    const sv = k => ({ a: 0, k });
    const kf = list => ({ a: 1, k: list.map(([t, v, e], i) => { const o = /** @type {any} */ ({ t, s: Array.isArray(v) ? v : [v] }); if (i < list.length - 1) { const E = EZ[e || 'inOut']; o.o = { x: [E[0]], y: [E[1]] }; o.i = { x: [E[2]], y: [E[3]] }; } return o; }) });
    const tr = (/** @type {any} */ o = {}) => ({ ty: 'tr', p: o.p || sv([0, 0]), a: o.a || sv([0, 0]), s: o.s || sv([100, 100]), r: o.r || sv(0), o: o.o || sv(100), sk: sv(0), sa: sv(0) });
    const gr = (it, o) => ({ ty: 'gr', it: [...it, tr(o)] });
    const el = (w, x = 0, y = 0, h = w) => ({ ty: 'el', d: 1, p: sv([x, y]), s: sv([w, h]) });
    const rc = (w, h, r, x = 0, y = 0) => ({ ty: 'rc', d: 1, p: sv([x, y]), s: sv([w, h]), r: sv(r) });
    const sh = (v, i, o, c) => ({ ty: 'sh', ks: sv({ v, i: i || v.map(() => [0, 0]), o: o || v.map(() => [0, 0]), c: !!c }) });
    const fl = c => ({ ty: 'fl', c: sv(hex(c)), o: sv(100), r: 1 });
    const st = (c, w) => ({ ty: 'st', c: sv(hex(c)), o: sv(100), w: sv(w), lc: 2, lj: 2, ml: 4 });
    const tm = (s, e) => ({ ty: 'tm', s, e, o: sv(0), m: 1 });
    let ind = 0;
    const layer = (nm, shapes, /** @type {any} */ o = {}) => ({ ddd: 0, ind: ++ind, ty: 4, nm, sr: 1, ks: { o: o.o || sv(100), r: o.r || sv(0), p: o.p || sv([0, 0, 0]), a: o.a || sv([0, 0, 0]), s: o.s || sv([100, 100, 100]) }, ao: 0, shapes, ip: o.ip || 0, op: o.op || 90, st: 0, bm: 0 });
    return { sv, kf, gr, el, rc, sh, fl, st, tm, layer, reset: () => { ind = 0; } };
  })();

  // Builds a 90-frame, 30 fps Lottie composition with three icons: weather, bell, success check.
  function lottieIcons(sw, swing) {
    const { sv, kf, gr, el, rc, sh, fl, st, tm, layer } = LT; LT.reset();
    const layers = [];
    // success check (right)
    const burst = gr([...[...Array(8)].map((_, k) => { const a = k * Math.PI / 4 - Math.PI / 8; return sh([[Math.cos(a) * 66, Math.sin(a) * 66], [Math.cos(a) * 88, Math.sin(a) * 88]]); }),
      tm(kf([[46, 0, 'out'], [58, 100]]), kf([[40, 0, 'out'], [52, 100]])), st(C.amber, Math.max(2, sw * 0.7))]);
    const check = gr([sh([[-26, 2], [-8, 20], [28, -18]]), tm(sv(0), kf([[30, 0, 'out'], [44, 100]])), st('#0b0b10', sw + 3)]);
    const disc = gr([el(112), fl(C.cyan)], { s: kf([[22, [0, 0], 'back'], [34, [100, 100]]]) });
    const ring = gr([el(112), tm(sv(0), kf([[0, 0], [24, 100]])), st(C.cyan, sw)]);
    layers.push(layer('check', [burst, check, disc, ring], { p: sv([500, 160, 0]), o: kf([[74, 100], [84, 0]]), s: kf([[44, [100, 100, 100], 'out'], [50, [108, 108, 100]], [58, [100, 100, 100]]]) }));
    // bell (middle), rotates around its top
    const sw2 = [[0, 0], [6, -swing], [14, swing * 0.8], [22, -swing * 0.6], [30, swing * 0.4], [38, -swing * 0.2], [46, 0]];
    const badge = gr([el(28), fl(C.coral), st('#101018', 5)], { p: sv([30, -30]), s: kf([[10, [0, 0], 'back'], [20, [100, 100]], [78, [100, 100]], [86, [0, 0]]]) });
    const lip = gr([rc(86, 12, 6, 0, 24), fl('#e0961a')]);
    const body = gr([sh([[-34, 22], [0, -44], [34, 22]], [[0, 0], [-30, 0], [-2, -46]], [[2, -46], [30, 0], [0, 0]], true), fl(C.amber)]);
    const clap = gr([el(18, 0, 38), fl('#e0961a')], { a: sv([0, 20]), p: sv([0, 20]), r: kf(sw2.map(([t, v]) => [t + 3, -v * 1.4])) });
    const knob = gr([el(14, 0, -50), fl(C.amber)]);
    layers.push(layer('bell', [badge, lip, body, clap, knob], { p: sv([320, 104, 0]), a: sv([0, -56, 0]), r: kf(sw2) }));
    const waves = [];
    for (const size of [124, 162]) for (const [s, e] of [[19, 31], [69, 81]]) waves.push(gr([el(size), tm(sv(s), sv(e)), st(C.cream, 4)], { o: kf([[2, 0], [7, 100], [32, 0]]), s: kf([[2, [85, 85], 'out'], [32, [118, 118]]]) }));
    layers.push(layer('waves', waves, { p: sv([320, 160, 0]) }));
    // weather (left)
    const cloud = gr([el(120, 0, 16, 52), el(62, -24, -2), el(72, 16, -12), fl(C.cream)], { p: kf([[0, [0, 0]], [45, [8, 0]], [90, [0, 0]]]) });
    const rays = [...Array(8)].map((_, k) => gr([rc(8, 18, 4, 0, -44), fl(C.amber)], { r: sv(k * 45) }));
    const sun = gr([...rays, el(52), fl(C.amber)], { p: sv([-28, -26]), r: kf([[0, 0, 'lin'], [90, 45]]), s: kf([[0, [100, 100]], [45, [108, 108]], [90, [100, 100]]]) });
    layers.push(layer('weather', [cloud, sun], { p: sv([140, 160, 0]) }));
    for (let j = 0; j < 3; j++) for (let rep = 0; rep < 3; rep++) {
      const ph = j * 10 + rep * 30, x = 140 + (j - 1) * 26;
      if (ph + 27 > 90) continue;
      layers.push(layer('drop', [gr([sh([[0, 0], [0, 11]]), st(C.cyan, Math.max(3, sw * 0.7))])], { p: kf([[ph, [x, 198, 0], 'lin'], [ph + 26, [x, 240, 0]]]), o: kf([[ph, 0], [ph + 5, 100], [ph + 26, 0]]), ip: ph, op: ph + 27 }));
    }
    return { v: '5.7.4', fr: 30, ip: 0, op: 90, w: 640, h: 360, nm: 'icons', ddd: 0, assets: [], layers };
  }

  EX.add({
    cat: 'libs', id: 'lottie-icons', kind: 'dom', title: 'Animated icon set', aka: 'Lottie, Bodymovin, vector animation file, animated icons', runs: 'WEB',
    tool: 'Lottie (lottie-web SVG player, animation JSON written by hand)',
    notice: 'A Lottie file is JSON that lists shapes and keyframes. Designers usually export it from After Effects, but here Claude wrote it by hand: a sun turning behind a drifting cloud, a bell that swings and gets a badge, and a check mark that draws itself with trim paths. lottie-web plays it as SVG, and goToAndStop picks the frame.',
    use: 'app icons, empty states, onboarding, success and error feedback',
    prompt: 'Write a Lottie JSON file (no After Effects) with three icons in a 640 x 360, 30 fps, 3 s loop: a sun rotating behind a drifting cloud with rain, a bell that swings {swing} degrees and pops a coral badge with ease-out-back, and a circle that draws itself with a trim path, then a {sw} px check mark. Play it with lottie-web as SVG.',
    params: [
      { key: 'sw', label: 'Stroke width', min: 3, max: 12, step: 1, value: 7, unit: '', restart: true },
      { key: 'swing', label: 'Bell swing', min: 0, max: 40, step: 1, value: 20, unit: '', restart: true },
    ],
    setup(st, L) {
      if (!lottie) return missing(st, 'Lottie');
      if (st._anim) { try { st._anim.destroy(); } catch (e) { /* gone */ } }
      css(st, `.lo{position:absolute;inset:0;background:#101018}
        .lo-card{position:absolute;top:56px;width:168px;height:210px;margin-left:-84px;border-radius:22px;background:#171722;border:1px solid #24243200}
        .lo-lab{position:absolute;top:276px;width:168px;margin-left:-84px;text-align:center;font:12px ${MONO};color:#8a8794;letter-spacing:1px}
        .lo-box{position:absolute;inset:0}
        .lo-bar{position:absolute;left:24px;right:24px;bottom:22px;height:4px;border-radius:2px;background:#24243a}
        .lo-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:2px;background:${C.coral}}
        .lo-code{position:absolute;left:24px;bottom:34px;font:12px ${MONO};color:#8a8794}
        .lo-code b{color:${C.amber};font-weight:600}`);
      const W = div(st, 'lo');
      [[140, 'WEATHER'], [320, 'NOTIFICATION'], [500, 'SUCCESS']].forEach(([x, s]) => { div(W, 'lo-card').style.left = x + 'px'; const l = div(W, 'lo-lab', s); l.style.left = x + 'px'; });
      const box = div(W, 'lo-box'), bar = /** @type {HTMLElement} */ (div(W, 'lo-bar', '<i></i>').firstChild), code = div(W, 'lo-code');
      const p = L.p || {};
      const anim = lottie.loadAnimation({ container: box, renderer: 'svg', loop: false, autoplay: false, animationData: lottieIcons(p.sw || 7, p.swing !== undefined ? p.swing : 20), rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
      st._anim = anim;
      return t => {
        const f = (t * 30) % 90;
        anim.goToAndStop(f, true);
        bar.style.width = (f / 90 * 100).toFixed(2) + '%';
        code.innerHTML = `anim.goToAndStop(<b>${f.toFixed(1)}</b>, true) &nbsp; frame ${Math.floor(f)} / 90`;
      };
    },
  });

  // ---------------------------------------------------------------- D3
  EX.add({
    cat: 'libs', id: 'd3-force', kind: 'dom', title: 'Force layout that reorganizes', aka: 'force-directed graph, network graph, beeswarm, clustering', runs: 'WEB',
    tool: 'D3 (d3-force simulation, data join, scales, axis)',
    notice: 'Ninety dots are pushed around by forces instead of keyframes. Links pull connected dots together and every dot pushes the others away, which makes a network. Swap the forces and the same dots move into group clusters, or into a beeswarm sorted by value along an axis. The label at the top names the active forces.',
    use: 'data stories, network maps, dashboards, explainer graphics',
    prompt: 'Using D3 v7, draw 90 nodes in 5 colored groups with links. Run a d3.forceSimulation with forceLink (distance {dist}), forceManyBody (strength {charge}) and forceCollide. Every {every} switch the forces: network, clusters pulled to group centers with forceX and forceY, then a beeswarm placed by value on an axis. Fade the links out in the beeswarm.',
    params: [
      { key: 'charge', label: 'Charge', min: -80, max: -5, step: 1, value: -30, unit: '' },
      { key: 'dist', label: 'Link distance', min: 10, max: 60, step: 1, value: 24, unit: '' },
      { key: 'every', label: 'Switch every', min: 3, max: 10, step: 0.5, value: 5, unit: ' s' },
    ],
    controls: [
      { label: 'Auto', on: true, fn: L => { L.state.auto = true; } },
      { label: 'Network', fn: L => { L.state.auto = false; L.state.mode = 0; } },
      { label: 'Clusters', fn: L => { L.state.auto = false; L.state.mode = 1; } },
      { label: 'Beeswarm', fn: L => { L.state.auto = false; L.state.mode = 2; } },
    ],
    setup(st, L) {
      if (!d3) return missing(st, 'D3');
      const S = { auto: keep(L, 'auto', true), mode: keep(L, 'mode', 0) }; L.state = S;
      const R = EX.rng(21), names = ['design', 'code', 'audio', '3D', 'video'], cols = [C.coral, C.amber, C.cyan, C.violet, C.cream];
      const nodes = [], links = [];
      names.forEach((_, g) => {
        for (let i = 0; i < 18; i++) {
          const id = nodes.length;
          nodes.push({ id, g, value: Math.max(2, Math.min(98, 18 + g * 16 + (R() + R() - 1) * 30)), r: 3.5 + R() * 5.5, x: 320 + (R() - 0.5) * 60, y: 180 + (R() - 0.5) * 60 });
          if (i > 0) links.push({ source: id, target: id - 1 - Math.floor(R() * Math.min(i, 4)) });
        }
      });
      for (let k = 0; k < 14; k++) { const a = Math.floor(R() * 90), b = Math.floor(R() * 90); if (nodes[a].g !== nodes[b].g) links.push({ source: a, target: b }); }
      const svg = d3.select(st).append('svg').attr('width', 640).attr('height', 360).attr('viewBox', '0 0 640 360').style('position', 'absolute').style('left', 0).style('top', 0);
      svg.append('rect').attr('width', 640).attr('height', 360).attr('fill', '#0f0f17');
      const xs = d3.scaleLinear().domain([0, 100]).range([60, 580]);
      const axisG = svg.append('g').attr('transform', 'translate(0,305)').call(d3.axisBottom(xs).ticks(5)).attr('opacity', 0);
      axisG.selectAll('text').attr('fill', '#8a8794').style('font', `11px ${MONO}`); axisG.selectAll('line,path').attr('stroke', '#44445a');
      axisG.append('text').attr('x', 580).attr('y', 32).attr('text-anchor', 'end').attr('fill', '#8a8794').style('font', `11px ${MONO}`).text('value');
      const centers = names.map((_, g) => ({ x: 96 + g * 112, y: 186 + (g % 2 ? 34 : -34) }));
      const linkSel = svg.append('g').selectAll('line').data(links).join('line').attr('stroke', '#6a6884').attr('stroke-width', 1);
      const nodeSel = svg.append('g').selectAll('circle').data(nodes, d => d.id).join('circle').attr('fill', d => cols[d.g]).attr('stroke', '#0f0f17').attr('stroke-width', 1.5);
      const labSel = svg.append('g').selectAll('text').data(names).join('text').attr('x', (_, g) => centers[g].x).attr('y', (_, g) => centers[g].y + (g % 2 ? 70 : -62)).attr('text-anchor', 'middle').attr('fill', (_, g) => cols[g]).style('font', `600 13px ${MONO}`).text(d => d).attr('opacity', 0);
      const head = svg.append('text').attr('x', 16).attr('y', 26).attr('fill', C.cream).style('font', `600 13px ${MONO}`);
      const fLink = d3.forceLink(links).id(d => d.id), fCharge = d3.forceManyBody(), fColl = d3.forceCollide(d => d.r + 1.5).iterations(2), fx = d3.forceX(), fy = d3.forceY();
      const sim = d3.forceSimulation(nodes).randomSource(EX.rng(9)).alphaDecay(0.012).velocityDecay(0.38).stop()
        .force('link', fLink).force('charge', fCharge).force('collide', fColl).force('x', fx).force('y', fy);
      const HEAD = ['forceLink + forceManyBody + forceCollide', 'forceX / forceY pull each group to its center', 'forceX by value + forceCollide = beeswarm'];
      let applied = -1, sig = '', lo = 0.5, ao = 0, go = 0;
      const apply = (m, p) => {
        if (m === 0) { fLink.distance(p.dist).strength(0.6); fCharge.strength(p.charge); fx.x(320).strength(0.05); fy.y(180).strength(0.08); }
        if (m === 1) { fLink.distance(p.dist).strength(0.02); fCharge.strength(p.charge * 0.4); fx.x(d => centers[d.g].x).strength(0.2); fy.y(d => centers[d.g].y).strength(0.2); }
        if (m === 2) { fLink.strength(0); fCharge.strength(0); fx.x(d => xs(d.value)).strength(0.45); fy.y(200).strength(0.1); }
        sim.alpha(Math.max(sim.alpha(), 0.7));
        head.text(HEAD[m]);
      };
      return (t, dt) => {
        const p = Object.assign({ charge: -30, dist: 24, every: 5 }, L.p);
        const m = S.auto ? Math.floor(t / p.every) % 3 : S.mode;
        const s2 = m + '|' + p.charge + '|' + p.dist;
        if (s2 !== sig) { sig = s2; applied = m; apply(m, p); }
        const steps = Math.max(1, Math.min(3, Math.round(dt * 60)));
        for (let i = 0; i < steps; i++) sim.tick();
        for (const d of nodes) { d.x = Math.max(d.r + 4, Math.min(636 - d.r, d.x)); d.y = Math.max(d.r + 34, Math.min(352 - d.r, d.y)); }
        const k = 1 - Math.exp(-dt * 4);
        lo += ([0.5, 0.14, 0][applied] - lo) * k; ao += ((applied === 2 ? 1 : 0) - ao) * k; go += ((applied === 1 ? 1 : 0) - go) * k;
        linkSel.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y).attr('stroke-opacity', lo);
        nodeSel.attr('cx', d => d.x).attr('cy', d => d.y).attr('r', (d, i) => d.r * Math.max(0, ease.back(clamp01((t - i * 0.012) / 0.5))));
        axisG.attr('opacity', ao); labSel.attr('opacity', go);
      };
    },
  });

  // ---------------------------------------------------------------- Matter.js
  EX.add({
    cat: 'libs', id: 'matter-galton', title: 'Galton board', aka: 'bean machine, plinko, rigid body physics, normal distribution', runs: 'CPU',
    tool: 'Matter.js (Engine, Bodies, Composite, fixed time step)',
    notice: 'Balls drop onto 13 rows of pegs and bounce left or right at random. Matter.js handles every collision, and the piles in the bins grow toward the bell curve that probability predicts (the dashed line). A little sideways damping keeps each bounce small, as on a real board. The engine runs with a fixed 60 Hz step, so the result does not depend on the frame rate.',
    use: 'explainers, playful landing pages, game prototypes, data stories',
    prompt: 'Using Matter.js, build a Galton board on a canvas: 13 rows of static peg circles, 14 bins with walls, and {balls} balls dropped from the top at {rate} per second with restitution {bounce}. Step Engine.update at a fixed 60 Hz, damp the sideways speed of each ball a little every step, draw it yourself in a dark palette, color balls in bands, and overlay the expected binomial curve as a dashed line. Restart when full.',
    params: [
      { key: 'balls', label: 'Balls', min: 50, max: 320, step: 10, value: 160, unit: '' },
      { key: 'rate', label: 'Drop rate', min: 4, max: 30, step: 1, value: 14, unit: '' },
      { key: 'bounce', label: 'Bounce', min: 0, max: 0.9, step: 0.05, value: 0.2 },
    ],
    setup(cv, L) {
      if (!Matter) return missing(cv, 'Matter.js');
      const M = Matter, g = cv.getContext('2d');
      const ROWS = 13, SX = 20, SY = 14, TOP = 52, CX = 320, LAST = ROWS - 1, BIN_TOP = TOP + LAST * SY + 12, BOT = 352, BR = 3.1, PR = 3;
      const pegs = []; for (let r = 0; r < ROWS; r++) for (let k = 0; k <= r; k++) pegs.push([CX + (k - r / 2) * SX, TOP + r * SY]);
      const divs = []; for (let k = 0; k <= LAST; k++) divs.push(CX + (k - LAST / 2) * SX);
      const wallX = (LAST / 2 + 1) * SX;
      // slanted guides along both sides of the peg triangle keep balls on the board
      const guides = [-1, 1].map(sd => [CX + sd * 0.3 * SX, TOP - SY, CX + sd * (LAST / 2 + 0.8) * SX, TOP + LAST * SY]);
      const COLS = [C.coral, C.amber, C.cyan, C.violet];
      const binom = []; { let c = 1; for (let k = 0; k <= 13; k++) { binom.push(c / 8192); c = c * (13 - k) / (k + 1); } }
      let engine, balls, spawned, endT, rng, simT, acc;
      const reset = () => {
        engine = M.Engine.create({ positionIterations: 10, velocityIterations: 8 }); engine.gravity.y = 1;
        const W = engine.world, opt = { isStatic: true, friction: 0, restitution: 0 };
        pegs.forEach(([x, y]) => M.Composite.add(W, M.Bodies.circle(x, y, PR, opt)));
        divs.forEach(x => M.Composite.add(W, M.Bodies.rectangle(x, (BIN_TOP + BOT) / 2 + 6, 3, BOT - BIN_TOP + 12, opt)));
        guides.forEach(([x1, y1, x2, y2]) => M.Composite.add(W, M.Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1), 3, Object.assign({ angle: Math.atan2(y2 - y1, x2 - x1) }, opt))));
        M.Composite.add(W, [M.Bodies.rectangle(CX - wallX - 3, (TOP + BOT) / 2, 6, BOT - TOP + 80, opt), M.Bodies.rectangle(CX + wallX + 3, (TOP + BOT) / 2, 6, BOT - TOP + 80, opt), M.Bodies.rectangle(CX, BOT + 10, 420, 20, opt)]);
        balls = []; spawned = 0; endT = 0; rng = EX.rng(17); simT = 0; acc = 0;
      };
      reset();
      return (_, dt) => {
        const p = Object.assign({ balls: 160, rate: 14, bounce: 0.2 }, L.p);
        acc += dt; let n = 0;
        while (acc >= 1 / 60 && n < 6) {
          acc -= 1 / 60; n++; simT += 1 / 60;
          const lastB = balls[balls.length - 1];
          if (spawned < p.balls && simT * p.rate > spawned && (!lastB || lastB.position.y > 26)) {
            const b = M.Bodies.circle(CX + (rng() - 0.5) * 4, 12, BR, { restitution: p.bounce, friction: 0.01, frictionAir: 0.03, density: 0.002 });
            M.Body.setVelocity(b, { x: 0, y: 1.5 });
            b.col = Math.floor(spawned / 25) % 4; M.Composite.add(engine.world, b); balls.push(b); spawned++;
          }
          // sideways damping inside the peg field, so each bounce stays small as on a real board
          for (const b of balls) if (b.position.y < BIN_TOP && b.position.y > TOP - 4) M.Body.setVelocity(b, { x: b.velocity.x * 0.95, y: b.velocity.y });
          M.Engine.update(engine, 1000 / 60);
        }
        if (acc > 0.2) acc = 0;
        for (const b of balls) b.restitution = p.bounce;
        if (spawned >= p.balls) { endT += dt; if (endT > 5) reset(); }
        // draw
        g.fillStyle = C.bg; g.fillRect(0, 0, 640, 360);
        g.fillStyle = '#14141e'; g.beginPath(); g.roundRect(CX - wallX - 14, 4, wallX * 2 + 28, 352, 14); g.fill();
        g.fillStyle = '#2e2e40'; g.beginPath(); g.moveTo(CX - 50, 16); g.lineTo(CX - 8, 40); g.lineTo(CX + 8, 40); g.lineTo(CX + 50, 16); g.lineTo(CX + 46, 14); g.lineTo(CX + 6, 36); g.lineTo(CX - 6, 36); g.lineTo(CX - 46, 14); g.fill();
        g.fillStyle = 'rgba(244,239,230,0.85)'; for (const [x, y] of pegs) { g.beginPath(); g.arc(x, y, PR, 0, 7); g.fill(); }
        g.strokeStyle = '#3a3a50'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); guides.forEach(([x1, y1, x2, y2]) => { g.moveTo(x1, y1); g.lineTo(x2, y2); }); g.stroke();
        g.fillStyle = '#3a3a50'; for (const x of divs) g.fillRect(x - 1.5, BIN_TOP, 3, BOT - BIN_TOP);
        g.fillRect(CX - wallX - 3, TOP - 20, 3, BOT - TOP + 20); g.fillRect(CX + wallX, TOP - 20, 3, BOT - TOP + 20); g.fillRect(CX - wallX - 3, BOT, wallX * 2 + 6, 3);
        for (const b of balls) { g.fillStyle = COLS[b.col]; g.beginPath(); g.arc(b.position.x, b.position.y, BR, 0, 7); g.fill(); }
        let landed = 0; for (const b of balls) if (b.position.y > BIN_TOP) landed++;
        g.setLineDash([5, 5]); g.strokeStyle = 'rgba(244,239,230,0.7)'; g.lineWidth = 1.5; g.beginPath();
        for (let k = 0; k <= 13; k++) { const x = CX + (k - 6.5) * SX, h = landed * binom[k] * (2 * BR) * (2 * BR) / SX / 0.82; k ? g.lineTo(x, BOT - h) : g.moveTo(x, BOT - h); }
        g.stroke(); g.setLineDash([]);
        g.textAlign = 'left'; g.fillStyle = C.cream; g.font = `600 15px ${DISP}`; g.fillText('Matter.js', 24, 34);
        g.font = `12px ${MONO}`; g.fillStyle = '#8a8794';
        g.fillText(`balls   ${spawned} / ${p.balls}`, 24, 58); g.fillText(`landed  ${landed}`, 24, 76); g.fillText(`bounce  ${p.bounce.toFixed(2)}`, 24, 94);
        g.textAlign = 'right'; g.fillText('dashed line =', 616, 300); g.fillText('binomial curve', 616, 316); g.textAlign = 'left';
        if (endT > 4) { g.fillStyle = `rgba(11,11,16,${clamp01(endT - 4)})`; g.fillRect(0, 0, 640, 360); }
      };
    },
  });

  // ---------------------------------------------------------------- Rough.js
  EX.add({
    cat: 'libs', id: 'rough-sketch', title: 'Hand-drawn diagram', aka: 'sketchy style, whiteboard animation, hand-drawn chart, line boil', runs: 'CPU',
    tool: 'Rough.js (rough.canvas, generator, fillStyle, seed)',
    notice: 'Rough.js draws boxes, circles, lines and curves so they look sketched with a marker. Each shape is revealed with a wipe, like a whiteboard video. Changing the random seed a few times a second redraws every line a little differently, which is the classic hand-drawn "boil". Each loop shows a new fill style.',
    use: 'explainer videos, friendly diagrams, onboarding, blog illustrations',
    prompt: 'Using Rough.js on a paper-colored canvas, draw a whiteboard diagram "Idea > Prompt > Motion" with boxes, arrows, an ellipse and an ease curve. Reveal each shape with a left-to-right wipe, use roughness {rough}, hachureGap {gap}, cycle fillStyle through hachure, zigzag, cross-hatch and dots, and change the seed {boil} times per second for a boiling line effect.',
    params: [
      { key: 'rough', label: 'Roughness', min: 0, max: 3, step: 0.1, value: 1.4 },
      { key: 'gap', label: 'Hachure gap', min: 3, max: 14, step: 1, value: 7, unit: '' },
      { key: 'boil', label: 'Boil fps', min: 0, max: 12, step: 1, value: 5, unit: '' },
    ],
    controls: [
      { label: 'Auto', on: true, fn: L => { L.state.style = -1; } },
      { label: 'Hachure', fn: L => { L.state.style = 0; } },
      { label: 'Zigzag', fn: L => { L.state.style = 1; } },
      { label: 'Cross-hatch', fn: L => { L.state.style = 2; } },
      { label: 'Dots', fn: L => { L.state.style = 3; } },
    ],
    setup(cv, L) {
      if (!rough) return missing(cv, 'Rough.js');
      const g = cv.getContext('2d'), rc = rough.canvas(cv), gen = rc.generator;
      const S = { style: keep(L, 'style', -1) }; L.state = S;
      const STY = ['hachure', 'zigzag', 'cross-hatch', 'dots'], INK = '#2a2730';
      const curvePts = []; for (let i = 0; i <= 40; i++) { const u = i / 40; curvePts.push([92 + u * 470, 312 - 58 * ease.back(u)]); }
      const star = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 26; star.push([592 + Math.cos(a) * r, 58 + Math.sin(a) * r]); }
      const E = [
        { t: 0.0, d: 0.7, bb: [30, 22, 420, 52], text: ['From idea to motion', 40, 60, `26px ${HAND}`, INK] },
        { t: 0.5, d: 0.5, bb: [36, 104, 160, 100], mk: (o) => [gen.rectangle(44, 112, 144, 84, Object.assign({ fill: C.coral }, o))], text: ['Idea', 116, 162, `20px ${HAND}`, INK, 'center'] },
        { t: 1.0, d: 0.35, bb: [190, 130, 64, 40], mk: (o) => arrow(194, 152, 248, 152, o) },
        { t: 1.3, d: 0.5, bb: [248, 104, 160, 100], mk: (o) => [gen.rectangle(256, 112, 144, 84, Object.assign({ fill: C.amber }, o))], text: ['Prompt', 328, 162, `20px ${HAND}`, INK, 'center'] },
        { t: 1.8, d: 0.35, bb: [402, 130, 64, 40], mk: (o) => arrow(406, 152, 456, 152, o) },
        { t: 2.1, d: 0.6, bb: [450, 86, 186, 132], mk: (o) => [gen.ellipse(540, 152, 162, 102, Object.assign({ fill: C.cyan }, o))], text: ['Motion', 540, 162, `20px ${HAND}`, INK, 'center'] },
        { t: 2.7, d: 0.5, bb: [70, 236, 530, 92], mk: (o) => [gen.line(92, 316, 92, 242, o), gen.line(92, 316, 584, 316, o)] },
        { t: 2.9, d: 0.9, bb: [86, 236, 500, 90], mk: (o) => [gen.curve(curvePts, Object.assign({}, o, { stroke: C.violet, strokeWidth: 3 }))], text: ['ease-out-back', 476, 300, `15px ${HAND}`, C.violet] },
        { t: 3.6, d: 0.4, bb: [560, 26, 66, 64], mk: (o) => [gen.polygon(star, Object.assign({ fill: C.violet }, o))] },
        { t: 3.9, d: 0.4, bb: [30, 66, 300, 20], mk: (o) => [gen.line(40, 74, 316, 70, Object.assign({}, o, { stroke: C.coral, strokeWidth: 3 }))] },
      ];
      function arrow(x1, y1, x2, y2, o) { return [gen.line(x1, y1, x2, y2, o), gen.line(x2, y2, x2 - 13, y2 - 9, o), gen.line(x2, y2, x2 - 13, y2 + 9, o)]; }
      const cache = new Map();
      const CY = 7.6;
      return t => {
        const p = Object.assign({ rough: 1.4, gap: 7, boil: 5 }, L.p);
        const cyc = Math.floor(t / CY), lt = t - cyc * CY, si = S.style >= 0 ? S.style : cyc % 4, style = STY[si];
        const seed = p.boil > 0 ? 1 + (Math.floor(t * p.boil) % 6) : 1;
        g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = C.paper; g.fillRect(0, 0, 640, 360);
        g.strokeStyle = 'rgba(42,39,48,0.06)'; g.lineWidth = 1; g.beginPath();
        for (let x = 0; x <= 640; x += 20) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, 360); } for (let y = 0; y <= 360; y += 20) { g.moveTo(0, y + 0.5); g.lineTo(640, y + 0.5); } g.stroke();
        if (cache.size > 600) cache.clear();
        E.forEach((e, i) => {
          const k = ease.out(clamp01((lt - e.t) / e.d)); if (k <= 0) return;
          g.save(); g.beginPath(); g.rect(e.bb[0], e.bb[1], e.bb[2] * k, e.bb[3]); g.clip();
          if (e.mk) {
            const key = i + '|' + seed + '|' + style + '|' + p.rough + '|' + p.gap;
            let ds = cache.get(key);
            if (!ds) { ds = e.mk({ seed: seed * 17 + i, roughness: p.rough, stroke: INK, strokeWidth: 2.2, fillStyle: style, hachureGap: p.gap, fillWeight: style === 'dots' ? 2 : 1.6, hachureAngle: -41, bowing: 1.2 }); cache.set(key, ds); }
            ds.forEach(d => rc.draw(d));
          }
          if (e.text) { const [s, x, y, f, c, al] = e.text; g.font = f; g.fillStyle = c; g.textAlign = al || 'left'; const j = p.boil > 0 ? (EX.rng(seed * 31 + i)() - 0.5) * 1.6 : 0; g.fillText(s, x + j, y + j * 0.6); g.textAlign = 'left'; }
          g.restore();
        });
        g.font = `13px ${MONO}`; g.fillStyle = '#8a8070'; g.textAlign = 'right'; g.fillText(`fillStyle: '${style}'   seed: ${seed}`, 620, 346); g.textAlign = 'left';
        const out = clamp01((lt - (CY - 0.6)) / 0.6); if (out > 0) { g.fillStyle = `rgba(239,232,220,${out})`; g.fillRect(0, 0, 640, 360); }
      };
    },
  });

  // ---------------------------------------------------------------- Tone.js
  // One shared audio rig for the sequencer, created on the first Play click.
  let toneRig = null;
  function makeToneRig() {
    const T = G.Tone, rig = { pat: null, playing: false };
    const out = new T.Gain(0.7).toDestination();
    const comp = new T.Compressor(-16, 3).connect(out);
    const delay = new T.FeedbackDelay('8n.', 0.32).connect(comp); delay.wet.value = 0.3;
    const wave = new T.Waveform(256); out.connect(wave);
    const kick = new T.MembraneSynth({ pitchDecay: 0.03, octaves: 6, envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.1 } }).connect(comp);
    const snF = new T.Filter(1900, 'bandpass').connect(comp);
    const snare = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } }).connect(snF); snare.volume.value = 4;
    const hatF = new T.Filter(7000, 'highpass').connect(comp);
    const hat = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 } }).connect(hatF); hat.volume.value = -10;
    const bass = new T.MonoSynth({ oscillator: { type: 'sawtooth' }, filter: { Q: 3, type: 'lowpass' }, envelope: { attack: 0.004, decay: 0.18, sustain: 0.25, release: 0.15 }, filterEnvelope: { attack: 0.003, decay: 0.14, sustain: 0.15, release: 0.2, baseFrequency: 110, octaves: 2.6 } }).connect(comp); bass.volume.value = -8;
    const chord = new T.PolySynth(T.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.004, decay: 0.3, sustain: 0.06, release: 0.5 } }); chord.connect(comp); chord.connect(delay); chord.volume.value = -14;
    const lead = new T.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.004, decay: 0.12, sustain: 0.08, release: 0.2 } }); lead.connect(comp); lead.connect(delay); lead.volume.value = -20;
    new T.Sequence((time, s) => {
      const P = rig.pat; if (!P) return;
      if (P[0][s]) kick.triggerAttackRelease('C1', '8n', time);
      if (P[1][s]) snare.triggerAttackRelease('16n', time);
      if (P[2][s]) hat.triggerAttackRelease('32n', time, P[2][s] === 2 ? 1 : 0.55);
      if (P[3][s]) bass.triggerAttackRelease(P[3][s], '16n', time);
      if (P[4][s]) chord.triggerAttackRelease(P[4][s], '8n', time);
      if (P[5][s]) lead.triggerAttackRelease(P[5][s], '16n', time);
    }, [...Array(16).keys()], '16n').start(0);
    Object.assign(rig, { wave, delay });
    return rig;
  }

  EX.add({
    cat: 'libs', id: 'tone-sequencer', title: 'Step sequencer', aka: 'drum machine, beat grid, 16-step sequencer, music visualizer', runs: 'CPU',
    tool: 'Tone.js (Transport, Sequence, MembraneSynth, NoiseSynth, PolySynth, FeedbackDelay, Waveform)',
    notice: 'A 16-step beat: kick, snare, hats, bass, chords and a lead. Tone.js schedules every note on the audio clock a little ahead of time, so the beat stays tight even when the page is busy, and the grid lights each hit. It runs silently until you press Play sound. Click any cell to change the pattern, even while it plays.',
    use: 'music visuals, interactive toys, sound design for UI, rhythm games',
    prompt: 'Using Tone.js, build a 16-step sequencer on a canvas: rows for kick (MembraneSynth), snare and hats (NoiseSynth through filters), bass (MonoSynth), chords (PolySynth) and a lead with a FeedbackDelay (feedback {fb}). Tone.Sequence at {bpm} BPM with swing {swing}. Light each cell when it plays, let me click cells to toggle them, and draw the live Waveform under the grid.',
    params: [
      { key: 'bpm', label: 'BPM', min: 70, max: 170, step: 1, value: 112, unit: '' },
      { key: 'swing', label: 'Swing', min: 0, max: 0.7, step: 0.05, value: 0.15 },
      { key: 'fb', label: 'Delay feedback', min: 0, max: 0.8, step: 0.01, value: 0.32 },
    ],
    controls: [
      { label: 'Play sound', group: false, fn: L => L.state.play() },
      { label: 'Stop', group: false, fn: L => L.state.stop() },
    ],
    setup(cv, L) {
      const g = cv.getContext('2d');
      const ROWS = ['KICK', 'SNARE', 'HATS', 'BASS', 'CHORD', 'LEAD'], RC = [C.coral, C.amber, C.cream, C.violet, C.cyan, '#5fd38d'];
      const pat = ROWS.map(() => Array(16).fill(0));
      [0, 4, 8, 12, 14].forEach(s => { pat[0][s] = 1; }); [4, 12].forEach(s => { pat[1][s] = 1; });
      for (let s = 0; s < 16; s++) if (s % 2 === 0 || s === 7 || s === 15) pat[2][s] = s % 4 === 2 ? 2 : 1;
      Object.entries({ 0: 'C2', 3: 'C2', 6: 'Eb2', 8: 'F2', 10: 'F2', 11: 'G2', 14: 'Bb1' }).forEach(([s, n]) => { pat[3][s] = n; });
      Object.entries({ 0: ['C4', 'Eb4', 'G4'], 6: ['C4', 'Eb4', 'G4'], 8: ['Ab3', 'C4', 'Eb4'], 14: ['Bb3', 'D4', 'F4'] }).forEach(([s, n]) => { pat[4][s] = n; });
      Object.entries({ 0: 'G4', 2: 'Bb4', 4: 'C5', 7: 'Eb5', 9: 'D5', 10: 'C5', 12: 'Bb4', 15: 'G4' }).forEach(([s, n]) => { pat[5][s] = n; });
      const DEF = [() => 1, () => 1, () => 1, () => 'C2', () => ['C4', 'Eb4', 'G4'], s => ['C5', 'D5', 'Eb5', 'G5', 'Bb5'][s % 5]];
      const X0 = 104, CW = 33, Y0 = 44, RH = 38;
      const hits = ROWS.map(() => Array(16).fill(-9)), sparks = [];
      const transport = () => (G.Tone.getTransport ? G.Tone.getTransport() : G.Tone.Transport);
      const S = {
        play: async () => {
          try {
            await loadTone();
            await G.Tone.start();
            if (!toneRig) toneRig = makeToneRig();
            toneRig.pat = pat; const tr = transport();
            tr.bpm.value = L.p.bpm; tr.swing = L.p.swing; tr.swingSubdivision = '16n';
            if (tr.state !== 'started') tr.start('+0.05');
            toneRig.playing = true;
          } catch (err) { console.error('tone-sequencer', err); }
        },
        stop: () => { if (toneRig) { transport().stop(); toneRig.playing = false; } },
      };
      L.state = S;
      if (toneRig) toneRig.pat = pat;
      cv.onclick = e => {
        const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * 640 / r.width, y = (e.clientY - r.top) * 360 / r.height;
        const s = Math.floor((x - X0) / CW), row = Math.floor((y - Y0) / RH);
        if (s < 0 || s > 15 || row < 0 || row > 5) return;
        pat[row][s] = pat[row][s] ? 0 : DEF[row](s);
      };
      cv.style.cursor = 'pointer';
      let lastStep = -1;
      return t => {
        const p = Object.assign({ bpm: 112, swing: 0.15, fb: 0.32 }, L.p);
        const playing = !!(toneRig && toneRig.playing);
        let step;
        if (playing) {
          const tr = transport(); tr.bpm.value = p.bpm; tr.swing = p.swing; toneRig.delay.feedback.value = p.fb;
          step = Math.floor(tr.ticks / (tr.PPQ / 4)) % 16;
        } else step = Math.floor(t / (60 / p.bpm / 4)) % 16;
        if (step !== lastStep) {
          lastStep = step;
          for (let r = 0; r < 6; r++) if (pat[r][step]) {
            hits[r][step] = t;
            for (let k = 0; k < 4; k++) { const a = -Math.PI / 2 + (k - 1.5) * 0.5; sparks.push({ x: X0 + step * CW + CW / 2 - 1, y: Y0 + r * RH + RH / 2 - 1, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, t0: t, c: RC[r] }); }
          }
        }
        g.fillStyle = C.bg; g.fillRect(0, 0, 640, 360);
        g.font = `600 13px ${MONO}`; g.fillStyle = C.cream; g.fillText('Tone.js', 18, 26);
        g.fillStyle = '#8a8794'; g.font = `12px ${MONO}`;
        g.fillText(`${p.bpm} BPM   swing ${p.swing.toFixed(2)}   step ${String(step + 1).padStart(2, '0')}/16   ${playing ? 'PLAYING' : 'silent preview, press Play sound'}`, 104, 26);
        // playhead column
        g.fillStyle = 'rgba(244,239,230,0.07)'; g.beginPath(); g.roundRect(X0 + step * CW - 1, Y0 - 4, CW, RH * 6 + 4, 6); g.fill();
        for (let r = 0; r < 6; r++) {
          g.fillStyle = RC[r]; g.font = `600 12px ${MONO}`; g.fillText(ROWS[r], 22, Y0 + r * RH + RH / 2 + 4);
          for (let s = 0; s < 16; s++) {
            const x = X0 + s * CW, y = Y0 + r * RH, on = !!pat[r][s], age = t - hits[r][s], fl = on ? Math.exp(-Math.max(0, age) * 7) : 0;
            const pad = 4 - fl * 3;
            g.globalAlpha = 1; g.fillStyle = on ? RC[r] : (s % 4 === 0 ? '#20202c' : '#181822');
            if (on) g.globalAlpha = 0.45 + 0.55 * fl;
            g.beginPath(); g.roundRect(x + pad, y + pad, CW - 3 - pad * 2 + 2, RH - 4 - pad * 2 + 2, 5); g.fill();
            if (fl > 0.05) { g.globalAlpha = fl * 0.5; g.shadowColor = RC[r]; g.shadowBlur = 18; g.fill(); g.shadowBlur = 0; }
            g.globalAlpha = 1;
          }
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i], a = t - s.t0; if (a > 0.5 || a < 0) { sparks.splice(i, 1); continue; }
          g.globalAlpha = 1 - a / 0.5; g.fillStyle = s.c; g.fillRect(s.x + s.vx * a, s.y + s.vy * a + 80 * a * a, 3, 3);
        }
        g.globalAlpha = 1;
        // bottom: live waveform when playing, level meters always
        const by = 322;
        g.strokeStyle = '#24243a'; g.lineWidth = 1; g.beginPath(); g.moveTo(X0, by); g.lineTo(X0 + 16 * CW - 3, by); g.stroke();
        if (playing) {
          const v = toneRig.wave.getValue(); g.strokeStyle = C.cyan; g.lineWidth = 2; g.beginPath();
          for (let i = 0; i < v.length; i++) { const x = X0 + i / (v.length - 1) * (16 * CW - 3), y = by - v[i] * 60; i ? g.lineTo(x, y) : g.moveTo(x, y); }
          g.stroke();
        } else {
          g.fillStyle = '#5a5870'; g.font = `12px ${MONO}`; g.textAlign = 'center';
          g.fillText('the live waveform from Tone.Waveform appears here while sound plays', X0 + 8 * CW, by + 22); g.textAlign = 'left';
        }
        for (let r = 0; r < 6; r++) {
          const lv = Math.max(0, ...hits[r].map(h => Math.exp(-Math.max(0, t - h) * 5) * (t >= h ? 1 : 0)));
          g.fillStyle = '#20202c'; g.fillRect(22 + r * 12, 300, 8, 44); g.fillStyle = RC[r]; g.fillRect(22 + r * 12, 344 - 44 * lv, 8, 44 * lv);
        }
      };
    },
  });
})();
