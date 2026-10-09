// Second set of typography-in-motion demos (Canvas 2D, plus one shader on the shared EX.G).
(function () {
  const { C, seg, ease, clamp01 } = EX;
  const W = 640, H = 360;
  const MONO = '"Cascadia Mono", Consolas, monospace', DISP = 'Bahnschrift, "Segoe UI", sans-serif';

  EX.add({
    cat: 'type', id: 't2-swissbands', title: 'Kinetic Swiss poster', aka: 'band stretch type, slit poster, accordion type, elastic grid poster', tool: 'Canvas 2D (drawImage band slices)', runs: 'CPU',
    notice: 'The poster is drawn once into a hidden canvas, then copied back as thin horizontal bands. Each band gets its height from a cosine bump that steps down the page on every beat, so some rows stretch while the others compress. The heights always add up to the same total, so the block never changes size and the loop is seamless.',
    use: 'event posters, music visuals, brand loops, social headers',
    params: [{ key: 'bands', label: 'Bands', min: 6, max: 60, step: 1, value: 30 }, { key: 'amt', label: 'Stretch', min: 0, max: 12, step: 0.5, value: 6 }],
    prompt: 'Kinetic Swiss poster loop: heavy black grotesk stacked "FORM / FOLLOWS / MOTION" justified edge to edge on off-white paper with a coral disc, sliced into {bands} horizontal bands; a cosine stretch bump (peak band {amt}x taller than the rest) steps down the poster on every beat at 120 BPM with ease-in-out moves and short holds, total height constant, small mono caption strip, seamless 4 s loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const PH = 318, PAD = 18;
      const SS = 3, src = document.createElement('canvas'); src.width = W; src.height = PH * SS; const s = src.getContext('2d'); s.scale(1, SS);
      s.fillStyle = C.paper; s.fillRect(0, 0, W, PH);
      s.fillStyle = C.coral; s.beginPath(); s.arc(476, 168, 122, 0, 7); s.fill();
      const lines = /** @type {[string, number][]} */ ([['FORM', 112], ['FOLLOWS', 84], ['MOTION', 90]]);
      let y = PAD; s.fillStyle = '#121214';
      for (const [w, lh] of lines) {
        s.setTransform(1, 0, 0, SS, 0, 0); s.font = `700 100px ${DISP}`; const m = s.measureText(w);
        const sx = (W - 2 * PAD) / (m.actualBoundingBoxLeft + m.actualBoundingBoxRight), sy = lh / (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
        s.setTransform(sx, 0, 0, sy * SS, PAD + m.actualBoundingBoxLeft * sx, (y + m.actualBoundingBoxAscent * sy) * SS); s.fillText(w, 0, 0); y += lh + 6;
      }
      const wts = new Float32Array(61);
      return t => {
        const N = L.p.bands | 0, beats = 8, u = (t / 0.5) % beats;
        const ph = (Math.floor(u) + ease.inOut(clamp01((u % 1) / 0.62))) / beats;
        let sum = 0; for (let k = 0; k < N; k++) { wts[k] = 1 + L.p.amt * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * ((k + 0.5) / N - ph)), 4); sum += wts[k]; }
        g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
        let acc = 0, y0 = 0;
        for (let k = 0; k < N; k++) {
          acc += wts[k]; const y1 = k === N - 1 ? PH : Math.round(acc / sum * PH);
          if (y1 > y0) g.drawImage(src, 0, k * PH * SS / N, W, PH * SS / N, 0, y0, W, y1 - y0);
          y0 = y1;
        }
        g.fillStyle = '#121214'; g.fillRect(PAD, PH + 6, W - 2 * PAD, 1.5);
        g.font = `500 11px ${MONO}`; g.textBaseline = 'middle';
        g.fillText('KINETIC POSTER NO. 07', PAD, PH + 24); g.fillText(`${N} BANDS / 120 BPM`, 236, PH + 24);
        const bi = Math.floor(u);
        for (let i = 0; i < beats; i++) { g.fillStyle = i === bi ? C.coral : '#121214'; g.fillRect(W - PAD - (beats - i) * 16 + 4, PH + 19, 10, 10); }
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-neon', title: 'Neon sign power-on', aka: 'neon flicker, glowing sign, tube light type, buzzing neon', tool: 'Canvas 2D (pre-rendered glow layers, additive compositing)', runs: 'CPU',
    notice: 'Each letter is pre-rendered twice: a dark glass tube and a lit tube with a white-hot core and two blurred halos. Per frame the lit layers are added on top with a brightness from a stutter function, so letters strike on one by one with uneven flicker, and one tube keeps failing. The light spill is the brick texture multiplied by a blurred copy of each word, so the wall flickers with the sign.',
    use: 'bar and nightlife brands, retro intros, title cards, "open" moments',
    params: [{ key: 'flick', label: 'Flicker amount', min: 0, max: 1, step: 0.05, value: 0.6 }],
    prompt: 'Neon sign on a dark brick wall powering on: script "Motion" in hot pink tubes and outlined "STUDIO" in cyan, letters strike on one by one with an uneven stutter (flicker amount {flick}), white-hot tube cores with a tight and a wide glow, colored light spill on the bricks that flickers with the sign, the "t" keeps buzzing out, unlit tubes stay visible as dark glass, 8 s loop that cuts to dark.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const r = EX.rng(11);
      const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
      const hs = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
      const alb = mk(W, H), a = alb.getContext('2d');
      a.fillStyle = '#5a524c'; a.fillRect(0, 0, W, H);
      for (let row = 0, y = -8; y < H; row++, y += 26) for (let x = (row % 2) * -32 - 6; x < W; x += 64) {
        const v = 0.75 + r() * 0.45; a.fillStyle = `rgb(${150 * v | 0},${74 * v | 0},${58 * v | 0})`; a.fillRect(x + 2, y + 2, 60, 22);
        for (let k = 0; k < 10; k++) { a.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,230,210'},${r() * 0.18})`; a.fillRect(x + 2 + r() * 56, y + 2 + r() * 19, 1 + r() * 5, 1 + r() * 2); }
      }
      const wall = mk(W, H), wg = wall.getContext('2d'); wg.drawImage(alb, 0, 0); wg.fillStyle = 'rgba(5,5,9,0.88)'; wg.fillRect(0, 0, W, H);
      const vg = wg.createRadialGradient(320, 190, 120, 320, 190, 420); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.7)'); wg.fillStyle = vg; wg.fillRect(0, 0, W, H);
      const PINK = '#ff2f78', CYAN = '#2bd4ff', AMB = '#ffb020';
      // A tube: one glyph (or a straight rule) with its unlit and lit layers and its own timing.
      const items = [], P = 42;
      function glyph(c, it, mode) {
        c.font = it.font; c.textBaseline = 'alphabetic'; c.lineJoin = 'round'; c.lineCap = 'round';
        const lw = it.lw * (mode === 'glow' ? 2.6 : mode === 'core' ? 0.45 : 1);
        if (it.rule) { c.lineWidth = lw || 4; c.beginPath(); c.moveTo(it.x, it.y); c.lineTo(it.x + it.w, it.y); c.stroke(); }
        else if (it.lw) { c.lineWidth = lw; c.strokeText(it.ch, it.x, it.y); }
        else { if (mode === 'glow') { c.lineWidth = 6; c.strokeText(it.ch, it.x, it.y); } c.fillText(it.ch, it.x, it.y); }
      }
      function add(it) {
        const m = mk(1, 1).getContext('2d'); m.font = it.font; const mt = m.measureText(it.ch || 'M');
        const asc = it.rule ? 4 : mt.actualBoundingBoxAscent, desc = it.rule ? 4 : mt.actualBoundingBoxDescent, l = it.rule ? 0 : mt.actualBoundingBoxLeft, rr = it.rule ? it.w : mt.actualBoundingBoxRight;
        it.x0 = Math.floor(it.x - l - P); it.y0 = Math.floor(it.y - asc - P);
        const w = Math.ceil(l + rr + 2 * P), h = Math.ceil(asc + desc + 2 * P);
        it.off = mk(w, h); it.lit = mk(w, h);
        const o = it.off.getContext('2d'); o.translate(-it.x0, -it.y0); o.fillStyle = o.strokeStyle = '#1c1519'; glyph(o, it, 'tube');
        o.globalAlpha = 0.2; o.fillStyle = o.strokeStyle = it.col; glyph(o, it, 'tube'); o.globalAlpha = 1;
        o.translate(-0.8, -0.8); o.fillStyle = o.strokeStyle = 'rgba(255,255,255,0.09)'; glyph(o, it, 'core');
        const q = it.lit.getContext('2d'); q.translate(-it.x0, -it.y0); q.fillStyle = q.strokeStyle = it.col;
        q.filter = 'blur(12px)'; glyph(q, it, 'glow'); q.filter = 'blur(3px)'; glyph(q, it, 'tube');
        q.filter = 'none'; q.fillStyle = q.strokeStyle = it.core; glyph(q, it, 'tube');
        items.push(it);
      }
      const m0 = mk(1, 1).getContext('2d');
      const word = (text, font, cx, y, col, core, lw, grp, t0, dt, track) => {
        m0.font = font; const ws = [...text].map(ch => m0.measureText(ch).width); const total = ws.reduce((s, v) => s + v, 0) + track * (text.length - 1);
        let x = cx - total / 2; [...text].forEach((ch, i) => { add({ ch, font, x, y, col, core, lw, grp, on: t0 + i * dt + (hs(i, t0) - 0.5) * dt * 0.8 }); x += ws[i] + track; });
        return [cx - total / 2, cx + total / 2];
      };
      word('Motion', `700 118px "Segoe Print", ${DISP}`, 322, 196, PINK, '#ffe1ec', 0, 0, 0.45, 0.24, 0);
      const span = word('STUDIO', `700 50px ${DISP}`, 320, 288, CYAN, '#e6fcff', 3.2, 1, 2.3, 0.07, 16);
      add({ rule: true, x: span[0] - 92, y: 270, w: 66, font: '10px sans-serif', col: AMB, core: '#fff3d6', lw: 3.4, grp: 1, on: 2.0 });
      add({ rule: true, x: span[1] + 26, y: 270, w: 66, font: '10px sans-serif', col: AMB, core: '#fff3d6', lw: 3.4, grp: 1, on: 2.05 });
      const fail = 2, bursts = [[3.8, 0.5], [5.4, 0.2], [6.3, 0.6]];
      // Light spill: brick albedo multiplied by a wide blur of each lit word.
      const spill = [0, 1].map(gi => {
        const sh = mk(W, H), sg = sh.getContext('2d'); for (const it of items) if (it.grp === gi) { sg.fillStyle = sg.strokeStyle = it.col; glyph(sg, it, 'glow'); }
        const lc = mk(W, H), lg = lc.getContext('2d'); lg.fillStyle = '#000'; lg.fillRect(0, 0, W, H);
        for (const blur of [26, 64]) { lg.filter = `blur(${blur}px)`; lg.drawImage(sh, 0, 0); lg.drawImage(sh, 0, 0); }
        const out = mk(W, H), og = out.getContext('2d'); og.drawImage(alb, 0, 0); og.globalCompositeOperation = 'multiply'; og.drawImage(lc, 0, 0);
        const boost = mk(W, H), bg2 = boost.getContext('2d'); bg2.globalCompositeOperation = 'lighter'; bg2.drawImage(out, 0, 0); bg2.globalAlpha = 0.3; bg2.drawImage(out, 0, 0);
        return boost;
      });
      const bright = new Float32Array(items.length), gsum = new Float32Array(2);
      return t => {
        const lt = t % 8.2, F = L.p.flick;
        gsum[0] = gsum[1] = 0; const cnt = [0, 0];
        items.forEach((it, i) => {
          let b = 0; const S = 0.12 + 0.55 * F;
          if (lt >= it.on && lt < it.on + S) { const q = (lt - it.on) / S; b = hs(i, Math.floor(lt * 26)) < 0.2 + 0.8 * q ? 0.55 + 0.45 * hs(i + 9, Math.floor(lt * 31)) : 0.04; }
          else if (lt >= it.on) {
            b = 0.97 + 0.03 * Math.sin(lt * 9 + i);
            if (i === fail) for (const [s0, d] of bursts) if (lt > s0 && lt < s0 + d * F * 1.6) b = hs(i, Math.floor(lt * 30)) < 0.6 ? 0.05 : 0.85;
          }
          if (lt > 7.45) b *= Math.max(0, 1 - (lt - 7.45) / 0.09);
          bright[i] = b; gsum[it.grp] += b; cnt[it.grp]++;
        });
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.drawImage(wall, 0, 0);
        g.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 2; k++) { g.globalAlpha = gsum[k] / cnt[k]; g.drawImage(spill[k], 0, 0); }
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        for (const it of items) g.drawImage(it.off, it.x0, it.y0);
        g.globalCompositeOperation = 'lighter';
        items.forEach((it, i) => { if (bright[i] > 0.01) { g.globalAlpha = Math.min(1, bright[i]); g.drawImage(it.lit, it.x0, it.y0); } });
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-ascii', title: 'ASCII 3D renderer', aka: 'text-mode 3D, donut.c style, character shading, ASCII art animation', tool: 'Canvas 2D (z-buffered point splats + glyph atlas)', runs: 'CPU',
    notice: 'A trefoil knot tube is sampled into 29,000 surface points. Every frame they are rotated and projected onto a grid of character cells, and each cell keeps only its nearest point, like a z-buffer. Cells just behind a nearer strand stay blank, which outlines the crossings. The lighting on that point picks a character from a ramp of denser and denser glyphs, the position along the knot picks the color, and bright specular spots switch to cream.',
    use: 'developer and terminal brands, retro tech intros, hacker aesthetics, loading screens',
    params: [{ key: 'cell', label: 'Cell size', min: 4, max: 14, step: 1, value: 6, unit: ' px' }],
    prompt: 'ASCII 3D renderer: a trefoil knot tube tumbling slowly in 3D, drawn only with the character ramp " .,:-=+*#%@" on a monospace grid with {cell} wide cells; each cell keeps the nearest surface point (z-buffer), diffuse light picks the character, color runs coral to amber to violet along the knot, specular hot spots turn cream, dark terminal background with a small HUD, seamless loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const RAMP = ' .,:-=+*#%@', NR = RAMP.length;
      const NU = 720, NV = 40, NP = NU * NV, TR = 0.5;
      const px = new Float32Array(NP), py = new Float32Array(NP), pz = new Float32Array(NP), nx = new Float32Array(NP), ny = new Float32Array(NP), nz = new Float32Array(NP), hu = new Uint8Array(NP);
      const knot = u => [Math.sin(u) + 2 * Math.sin(2 * u), Math.cos(u) - 2 * Math.cos(2 * u), -Math.sin(3 * u)];
      for (let i = 0; i < NU; i++) {
        const u = i / NU * Math.PI * 2, c = knot(u), d = knot(u + 1e-3);
        let tx = d[0] - c[0], ty = d[1] - c[1], tz = d[2] - c[2]; let l = Math.hypot(tx, ty, tz); tx /= l; ty /= l; tz /= l;
        let ax = ty * c[2] - tz * c[1], ay = tz * c[0] - tx * c[2], az = tx * c[1] - ty * c[0]; l = Math.hypot(ax, ay, az); ax /= l; ay /= l; az /= l;
        const bx = ty * az - tz * ay, by = tz * ax - tx * az, bz = tx * ay - ty * ax;
        for (let j = 0; j < NV; j++) {
          const v = j / NV * Math.PI * 2, cs = Math.cos(v), sn = Math.sin(v), k = i * NV + j;
          nx[k] = cs * ax + sn * bx; ny[k] = cs * ay + sn * by; nz[k] = cs * az + sn * bz;
          px[k] = c[0] + TR * nx[k]; py[k] = c[1] + TR * ny[k]; pz[k] = c[2] + TR * nz[k];
          hu[k] = Math.floor((0.5 - 0.5 * Math.cos(u)) * 7.999);
        }
      }
      // Glyph atlas: one row per color (8 along the knot plus cream highlight), one column per ramp character.
      const stops = [[255, 90, 54], [255, 176, 32], [122, 92, 255]];
      const hueRGB = k => { const x = k / 7 * 2, i = Math.min(1, Math.floor(x)), f = x - i; return stops[i].map((v, c) => v + (stops[i + 1][c] - v) * f); };
      const atlas = document.createElement('canvas'), ag = atlas.getContext('2d'); let built = 0;
      const build = (cw, ch) => {
        atlas.width = cw * NR; atlas.height = ch * 9; ag.font = `700 ${Math.min(ch * 0.95, cw / 0.56).toFixed(1)}px ${MONO}`; ag.textAlign = 'center'; ag.textBaseline = 'middle';
        for (let row = 0; row < 9; row++) for (let i = 1; i < NR; i++) {
          const rgb = row < 8 ? hueRGB(row) : [255, 244, 222], b = row < 8 ? 0.55 + 0.45 * i / (NR - 1) : 1;
          ag.fillStyle = `rgb(${rgb[0] * b | 0},${rgb[1] * b | 0},${rgb[2] * b | 0})`; ag.fillText(RAMP[i], i * cw + cw / 2, row * ch + ch / 2 + 1);
        }
        built = cw;
      };
      const MAXC = 128 * 72, zb = new Float32Array(MAXC), ci = new Uint8Array(MAXC), crow = new Uint8Array(MAXC);
      let lx = -0.45, ly = -0.65, lz = -0.62; const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
      let hx = lx, hy = ly, hz = lz - 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
      return t => {
        const cw = L.p.cell | 0, ch = Math.round(cw * 1.75), cols = Math.floor(W / cw), rows = Math.floor((H - 22) / ch);
        if (built !== cw) build(cw, ch);
        const ox = (W - cols * cw) / 2, oy = 6; zb.fill(0, 0, cols * rows);
        // Rotation matrix M = Ry(a) * Rx(b) * Rz(c): spin in the knot plane, a slow tilt and a sway.
        const a = Math.sin(t * 0.41) * 0.55, b = 0.2 + Math.sin(t * 0.29) * 0.3, c0 = t * 0.45;
        const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c0), sc = Math.sin(c0);
        const m00 = ca * cc + sa * sb * sc, m01 = -ca * sc + sa * sb * cc, m02 = sa * cb, m10 = cb * sc, m11 = cb * cc, m12 = -sb, m20 = -sa * cc + ca * sb * sc, m21 = sa * sc + ca * sb * cc, m22 = ca * cb;
        const F = 330 * (rows * ch) / 330;
        for (let k = 0; k < NP; k++) {
          const x = px[k], y = py[k], z = pz[k];
          const x1 = m00 * x + m01 * y + m02 * z, y2 = m10 * x + m11 * y + m12 * z, z2 = m20 * x + m21 * y + m22 * z;
          const ooz = 1 / (z2 + 8.5), sx = cols * cw / 2 + x1 * F * ooz, sy = rows * ch / 2 + y2 * F * ooz;
          const c = Math.floor(sx / cw), r = Math.floor(sy / ch); if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
          const idx = r * cols + c; if (ooz <= zb[idx]) continue; zb[idx] = ooz;
          const n0 = nx[k], n1 = ny[k], n2 = nz[k];
          const q0 = m00 * n0 + m01 * n1 + m02 * n2, q1 = m10 * n0 + m11 * n1 + m12 * n2, q2 = m20 * n0 + m21 * n1 + m22 * n2;
          const dif = Math.max(0, q0 * lx + q1 * ly + q2 * lz), sp = Math.pow(Math.max(0, q0 * hx + q1 * hy + q2 * hz), 40);
          const lum = (0.08 + 0.92 * dif + 0.2 * Math.max(0, -q2)) * (0.7 + 0.3 * Math.min(1, (ooz - 0.083) / 0.06)) + 0.3 * sp;
          ci[idx] = Math.max(1, Math.min(NR - 1, Math.round(lum * (NR - 1)))); crow[idx] = sp > 0.6 ? 8 : hu[k];
        }
        g.fillStyle = '#07070b'; g.fillRect(0, 0, W, H);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const idx = r * cols + c, z = zb[idx]; if (z === 0) continue;
          // A cell just behind a nearer strand stays blank, which outlines every crossing.
          if ((c > 0 && zb[idx - 1] - z > 0.006) || (c < cols - 1 && zb[idx + 1] - z > 0.006) || (r > 0 && zb[idx - cols] - z > 0.006) || (r < rows - 1 && zb[idx + cols] - z > 0.006)) continue;
          g.drawImage(atlas, ci[idx] * cw, crow[idx] * ch, cw, ch, ox + c * cw, oy + r * ch, cw, ch);
        }
        g.font = `500 11px ${MONO}`; g.textBaseline = 'middle'; g.fillStyle = 'rgba(244,239,230,0.42)';
        g.fillText(`trefoil knot   ${cols} x ${rows} cells   ramp "${RAMP}"`, 14, H - 11);
        g.fillStyle = C.coral; g.fillText(t % 1 < 0.5 ? '_' : ' ', W - 24, H - 11);
      };
    },
  });

  // GPU card: shares the one WebGL2 context EX.G, so it is skipped when WebGL2 is missing.
  let meltGL = null;
  if (EX.G.gl) EX.add({
    cat: 'type', id: 't2-melt', title: 'Melting type', aka: 'dripping text, hot wax type, liquid letters, drip effect', tool: 'WebGL2 fragment shaders (vertical smear field + height-field shading) on a canvas-drawn texture', runs: 'GPU',
    notice: 'The word is drawn once into a blurred 2D canvas and uploaded as a texture. A first shader looks up the column above every pixel, as far as a noise-shaped drip length, so letters stretch down in drips that taper to a point and start at different times. A second shader treats the result as a height field and lights it like glossy wax, with a soft drop shadow.',
    use: 'summer and heat campaigns, food and candle brands, horror and psychedelic titles, "meltdown" moments',
    params: [{ key: 'heat', label: 'Heat (drip length)', min: 0.05, max: 0.6, step: 0.01, value: 0.32 }],
    prompt: 'Melting type shader: the word "MELT" in heavy sans drips like hot wax over 5 s, drips of different lengths (max {heat} of the frame height) start at different times and taper to rounded points, letters sag slightly, glossy coral-to-amber wax with sharp specular highlights and a soft shadow on a near-black wall, then rewinds back to solid in 1 s with ease-in-out, 8 s loop. Draw the word into a 2D canvas once and upload it as a texture.',
    setup(cv, L) {
      const G = EX.G, gl = G.gl, ctx = cv.getContext('2d');
      if (!meltGL) {
        const tc = document.createElement('canvas'); tc.width = W; tc.height = H; const tg = tc.getContext('2d');
        tg.fillStyle = '#000'; tg.fillRect(0, 0, W, H); tg.filter = 'blur(4px)'; tg.fillStyle = '#fff'; tg.font = `700 236px ${DISP}`; tg.textAlign = 'center'; tg.fillText('MELT', W / 2, 228);
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        meltGL = {
          tex, field: G.target(W, H),
          melt: G.prog(`uniform sampler2D uTxt; uniform float uP,uHeat;
            void main(){ float x=vUv.x;
              float n1=max(vnoise(vec2(x*38.,1.7)),.93*vnoise(vec2(x*21.,5.2))), n2=vnoise(vec2(x*7.,7.3)), n3=vnoise(vec2(x*64.,3.1));
              float D=uHeat*(pow(n1,4.)*2.+.05*n3)*smoothstep(0.,1.,uP*(.45+1.1*n2));
              float sag=uHeat*.07*uP*vnoise(vec2(x*4.,2.));
              float wob=.0025*uP*sin(vUv.y*34.+x*19.);
              float f=0.;
              for(int i=0;i<48;i++){ float k=float(i)/47.; f=max(f,texture(uTxt,vec2(x+wob*k,vUv.y+sag+D*k)).r*(1.-.3*k)); }
              o=vec4(f,0,0,1); }`),
          shade: G.prog(`uniform sampler2D uF;
            void main(){ vec2 px=1./uRes; float c=texture(uF,vUv).r;
              float l=texture(uF,vUv-vec2(px.x*2.,0)).r, r=texture(uF,vUv+vec2(px.x*2.,0)).r, d=texture(uF,vUv-vec2(0,px.y*2.)).r, u=texture(uF,vUv+vec2(0,px.y*2.)).r;
              float a=smoothstep(.38,.52,c);
              vec3 n=normalize(vec3((l-r)*2.6,(d-u)*2.6,1.)); vec3 Ld=normalize(vec3(-.45,.65,.75));
              float dif=max(dot(n,Ld),0.), spec=pow(max(dot(reflect(-Ld,n),vec3(0,0,1)),0.),36.);
              vec3 wax=mix(vec3(.95,.24,.12),vec3(1.,.66,.16),smoothstep(.25,.85,vUv.y));
              vec3 col=wax*(.28+.8*dif)+vec3(1.,.95,.85)*spec*.85;
              col*=.75+.25*smoothstep(.3,1.,c);
              vec3 bg=mix(vec3(.025,.022,.035),vec3(.07,.055,.08),vUv.y);
              bg+=.035*vnoise(vUv*vec2(160.,90.));
              float sh=smoothstep(.25,.6,texture(uF,vUv+vec2(-.008,.016)).r); bg*=1.-.6*sh;
              o=vec4(mix(bg,col,a),1); }`),
        };
      }
      const M = meltGL;
      return t => {
        const lt = t % 8, p = lt < 6.3 ? ease.inOut(seg(lt, 0.5, 5.6)) : 1 - ease.inOut(seg(lt, 6.3, 7.3));
        G.draw(M.melt, M.field, { uTxt: M.tex, uP: p, uHeat: L.p.heat });
        G.draw(M.shade, null, { uF: M.field }, W, H); G.copy(ctx, W, H);
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-hello', title: 'Handwritten write-on', aka: 'hello write-on, signature animation, script reveal, pen stroke lettering', tool: 'Canvas 2D (hand-authored Catmull-Rom strokes, variable-width pen)', runs: 'CPU',
    notice: 'The word is one continuous pen path, written by hand as a list of points and smoothed with Catmull-Rom splines; sharp turns are split into separate pieces so they stay crisp. The pen slows down in tight curves like a real hand, and the line is thicker on downstrokes and thinner on upstrokes. New segments are added to an offscreen canvas each frame, so the cost stays tiny.',
    use: 'product intros, greeting moments, signatures, onboarding welcome screens',
    params: [{ key: 'dur', label: 'Writing time', min: 1.5, max: 6, step: 0.1, value: 3.4, unit: ' s' }],
    prompt: 'Handwritten "hello" write-on like the Apple hello: one continuous cursive stroke drawn by a moving pen over {dur}, the pen slows in tight curves, the line is thicker on downstrokes and thinner on upstrokes with tapered ends, a coral-to-amber-to-cyan gradient along the stroke with a soft glow and a bright pen tip on deep navy, hold, then fade and loop.',
    setup(cv, L) {
      const g = cv.getContext('2d');
      // The word as pen pieces; a new piece starts at every cusp (unslanted design space, baseline y=240).
      const pieces = [
        [[40, 240], [62, 226], [84, 196], [99, 156], [106, 118], [104, 95], [96, 87], [88, 95], [85, 125], [86, 175], [88, 240]],
        [[88, 240], [92, 216], [102, 194], [116, 183], [129, 186], [136, 202], [137, 224], [140, 238], [152, 242], [168, 232], [186, 214], [202, 198], [206, 187], [199, 180], [188, 182], [180, 196], [179, 216], [185, 233], [198, 242], [214, 239], [230, 225], [245, 200], [258, 160], [265, 118], [264, 95], [256, 87], [247, 95], [243, 125], [242, 175], [244, 222], [251, 239], [263, 242], [278, 232], [294, 210], [308, 175], [318, 128], [320, 98], [313, 87], [304, 95], [300, 125], [299, 175], [301, 222], [308, 239], [320, 242], [334, 232], [348, 210], [362, 190], [378, 181]],
        [[378, 181], [364, 182], [352, 195], [348, 216], [355, 236], [370, 243], [385, 234], [391, 213], [388, 194], [384, 186], [393, 180], [410, 180], [432, 173]],
      ];
      const pts = [];
      for (const pc of pieces) {
        const P = pc.map(([x, y]) => [x + (240 - y) * 0.24, y]), n = P.length;
        for (let i = 0; i < n - 1; i++) {
          const p0 = i > 0 ? P[i - 1] : [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]], p1 = P[i], p2 = P[i + 1], p3 = i + 2 < n ? P[i + 2] : [2 * P[n - 1][0] - P[n - 2][0], 2 * P[n - 1][1] - P[n - 2][1]];
          const steps = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 1.5));
          for (let s = 0; s < steps; s++) {
            const u = s / steps, u2 = u * u, u3 = u2 * u;
            const f = k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
            pts.push([f(0), f(1)]);
          }
        }
      }
      { const lp = pieces[pieces.length - 1], e = lp[lp.length - 1]; pts.push([e[0] + (240 - e[1]) * 0.24, e[1]]); }
      // Fit to the stage, then give every point a width, a color and a time (slower where the path bends).
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const sc = Math.min(520 / (x1 - x0), 230 / (y1 - y0)), ox = W / 2 - (x0 + x1) / 2 * sc, oy = H / 2 + 6 - (y0 + y1) / 2 * sc;
      const N = pts.length, X = new Float32Array(N), Y = new Float32Array(N), Wd = new Float32Array(N), T = new Float32Array(N), COL = [];
      for (let i = 0; i < N; i++) { X[i] = pts[i][0] * sc + ox; Y[i] = pts[i][1] * sc + oy; }
      const stops = [[255, 90, 54], [255, 176, 32], [43, 196, 230], [122, 92, 255]];
      let acc = 0;
      for (let i = 0; i < N; i++) {
        const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1), dx = X[b] - X[a], dy = Y[b] - Y[a], dl = Math.hypot(dx, dy) || 1;
        const ta = Math.atan2(Y[i] - Y[a], X[i] - X[a]), tb = Math.atan2(Y[b] - Y[i], X[b] - X[i]); let turn = Math.abs(tb - ta); if (turn > Math.PI) turn = 2 * Math.PI - turn;
        const end = Math.min(1, i / 14, (N - 1 - i) / 30);
        Wd[i] = (4 + 4 * Math.max(0, dy / dl)) * (0.35 + 0.65 * end) * sc / 1.2;
        if (i > 0) acc += Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]) * (1 + 6 * turn / (Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]) * 0.03 + 0.05));
        T[i] = acc;
        const q = i / (N - 1) * 3, k = Math.min(2, Math.floor(q)), f = q - k, c = stops[k].map((v, j) => Math.round(v + (stops[k + 1][j] - v) * f));
        COL.push(`rgb(${c[0]},${c[1]},${c[2]})`);
      }
      for (let i = 0; i < N; i++) T[i] /= acc;
      const ink = document.createElement('canvas'); ink.width = W; ink.height = H; const ig = ink.getContext('2d'); ig.lineCap = 'round';
      let drawn = 0, lastLt = 0;
      const bgGrad = g.createRadialGradient(320, 170, 40, 320, 200, 460); bgGrad.addColorStop(0, '#24224a'); bgGrad.addColorStop(1, '#0c0b1c');
      return t => {
        const D = L.p.dur, cyc = D + 3.2, lt = t % cyc;
        if (lt < lastLt) { ig.clearRect(0, 0, W, H); drawn = 0; }
        lastLt = lt;
        const p = seg(lt, 0.4, 0.4 + D);
        let idx = drawn; while (idx < N - 1 && T[idx + 1] <= p) idx++;
        for (let i = Math.max(1, drawn); i <= idx; i++) { ig.strokeStyle = COL[i]; ig.lineWidth = Wd[i]; ig.beginPath(); ig.moveTo(X[i - 1], Y[i - 1]); ig.lineTo(X[i], Y[i]); ig.stroke(); }
        drawn = idx;
        g.globalAlpha = 1; g.fillStyle = bgGrad; g.fillRect(0, 0, W, H);
        const fade = 1 - ease.inOut(seg(lt, D + 2.2, D + 3.0));
        const lift = -(1 - fade) * 10;
        g.globalAlpha = fade * 0.5; g.filter = 'blur(6px)'; g.drawImage(ink, 0, lift); g.filter = 'none';
        g.globalAlpha = fade; g.drawImage(ink, 0, lift);
        if (p > 0 && p < 1) {
          const x = X[idx], y = Y[idx], gl = g.createRadialGradient(x, y, 0, x, y, 18); gl.addColorStop(0, 'rgba(255,248,235,0.95)'); gl.addColorStop(0.25, 'rgba(255,220,180,0.45)'); gl.addColorStop(1, 'rgba(255,200,150,0)');
          g.globalAlpha = 1; g.fillStyle = gl; g.beginPath(); g.arc(x, y, 18, 0, 7); g.fill();
        }
        g.globalAlpha = 1;
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-helix', title: 'Text helix', aka: 'spiral type tower, 3D cylinder text, rotating type column, barber-pole type', tool: 'Canvas 2D (3D projection, per-glyph affine transforms, depth sort)', runs: 'CPU',
    notice: 'One sentence winds five times around an invisible cylinder. For every glyph the code finds its 3D position and the direction of the spiral at that point, projects both, and draws the glyph with that affine transform, so letters foreshorten at the sides and appear mirrored on the far side. Glyphs are sorted by depth every frame; the far side is dimmed and a light beam runs through the core between the two halves.',
    use: 'conference and event openers, music and fashion promos, "360" or "all around" messages',
    params: [{ key: 'tilt', label: 'Camera tilt', min: 4, max: 45, step: 1, value: 20, unit: ' deg' }, { key: 'spin', label: 'Spin speed', min: 0, max: 2, step: 0.05, value: 0.55, unit: ' rad/s' }],
    prompt: 'Text helix: the sentence "WORDS IN ORBIT · TYPE THAT TURNS IN THREE DIMENSIONS · MOTION" wraps five times around a rotating vertical cylinder (spin {spin}), camera tilted {tilt} down so the rings read as ellipses, glyphs stay upright and foreshorten at the sides, far-side glyphs mirrored and dimmed violet, near-side glyphs cream with "MOTION" in coral, glyphs depth-sorted every frame, a thin cyan light beam through the core, deep navy background.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const TXT = 'WORDS IN ORBIT · TYPE THAT TURNS IN THREE DIMENSIONS · MOTION · ';
      const FS = 24, font = `700 ${FS}px ${DISP}`, CH = Math.ceil(FS * 1.3);
      const chars = [...new Set(TXT)], mg = document.createElement('canvas').getContext('2d'); mg.font = font;
      const cwid = chars.map(c => Math.ceil(mg.measureText(c).width) + 2), cx0 = []; let ax = 0; for (const w of cwid) { cx0.push(ax); ax += w + 2; }
      const atlas = document.createElement('canvas'); atlas.width = ax; atlas.height = CH * 3; const ag = atlas.getContext('2d');
      ag.font = font; ag.textBaseline = 'alphabetic';
      ['#f4efe6', C.coral, '#8f7cff'].forEach((col, row) => { ag.fillStyle = col; chars.forEach((c, i) => ag.fillText(c, cx0[i] + 1, row * CH + FS)); });
      const R = 136, TURN = 38, TURNS = 5;
      const gl = [], arcLen = TURNS * 2 * Math.PI * R; let s = 0, k = 0;
      const hi = new Set(); { const at = TXT.indexOf('MOTION'); for (let j = 0; j < 6; j++) hi.add(at + j); }
      while (s < arcLen) { const ch = TXT[k % TXT.length], ci = chars.indexOf(ch); gl.push({ ci, row: hi.has(k % TXT.length) ? 1 : 0, th: (s + cwid[ci] / 2) / R }); s += cwid[ci] + 1; k++; }
      const N = gl.length, PX = new Float32Array(N), PY = new Float32Array(N), TX = new Float32Array(N), TY = new Float32Array(N), SY = new Float32Array(N), Z = new Float32Array(N), FC = new Float32Array(N);
      const order = gl.map((_, i) => i), byZ = (a, b) => Z[a] - Z[b];
      const kk = TURN / (2 * Math.PI * R), kn = Math.hypot(1, kk), Fz = 700;
      const bgG = g.createLinearGradient(0, 0, 0, H); bgG.addColorStop(0, '#15143a'); bgG.addColorStop(1, '#07070f');
      const beamG = g.createLinearGradient(W / 2 - 14, 0, W / 2 + 14, 0); beamG.addColorStop(0, 'rgba(43,196,230,0)'); beamG.addColorStop(0.5, 'rgba(120,230,255,0.55)'); beamG.addColorStop(1, 'rgba(43,196,230,0)');
      return t => {
        const rot = t * L.p.spin, ph = L.p.tilt * Math.PI / 180, cf = Math.cos(ph), sf = Math.sin(ph), half = TURNS * TURN / 2;
        for (let i = 0; i < N; i++) {
          const th = gl[i].th + rot, sn = Math.sin(th), cs = Math.cos(th), x = R * sn, z = R * cs, y = half - TURN * gl[i].th / (2 * Math.PI);
          const yu = y * cf - z * sf, zc = z * cf + y * sf, sc = Fz / (Fz - zc);
          PX[i] = W / 2 + x * sc; PY[i] = H / 2 + 8 - yu * sc; Z[i] = zc; FC[i] = cs;
          const tx = cs / kn, ty = -kk / kn, tz = -sn / kn;
          TX[i] = tx * sc; TY[i] = -(ty * cf - tz * sf) * sc; SY[i] = cf * sc;
        }
        order.sort(byZ); let firstFront = 0; while (firstFront < N && FC[order[firstFront]] < 0) firstFront++;
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = bgG; g.fillRect(0, 0, W, H);
        // Far half first, then the beam on the axis, then the near half; each half in depth order.
        for (let pass = 0; pass < 2; pass++) for (let j = 0; j < N; j++) {
          const i = order[j], G0 = gl[i], f = FC[i], back = f < 0;
          if (back !== (pass === 0)) continue;
          if (pass === 1 && j === firstFront) {
            g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = beamG; g.fillRect(W / 2 - 14, 0, 28, H);
          }
          g.globalAlpha = back ? 0.16 + 0.3 * (1 + f) * 0.5 : 0.35 + 0.65 * f;
          g.setTransform(TX[i], TY[i], 0, SY[i], PX[i], PY[i]);
          const w = cwid[G0.ci]; g.drawImage(atlas, cx0[G0.ci], (back ? 2 : G0.row) * CH, w, CH, -w / 2, -FS * 0.82, w, CH);
        }
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-rainword', title: 'Digital rain to title', aka: 'code rain reveal, glyph rain logo, falling code lock-in', tool: 'Canvas 2D (column heads, per-cell state, glyph atlas)', runs: 'CPU',
    notice: 'Glyph columns fall at their own speeds, each with a bright head and a fading tail, and glyphs keep flickering to new characters. During the reveal every cell inside a hidden word locks the moment a head passes over it, while the rain thins out, so the title condenses out of the stream. After a hold the locked glyphs let go from the top down and the rain takes them back.',
    use: 'tech and security brands, hackathon and launch intros, logo reveals, data themes',
    params: [{ key: 'dens', label: 'Rain density', min: 0.15, max: 1, step: 0.05, value: 0.75 }],
    prompt: 'Digital rain that resolves into a title: columns of cyan monospace glyphs fall at different speeds with white heads and fading tails (density {dens}), glyphs flicker; from 1.8 s every cell inside the word "SIGNAL" locks when a falling head passes it, flashing coral then settling to cream, while the rain thins out; hold 1.5 s, then the word releases from the top down back into the rain, seamless 8 s loop on near-black.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const r = EX.rng(29);
      const cw = 10, ch = 14, cols = 64, rows = 25, NC = cols * rows, oy = (H - rows * ch) / 2;
      const GL = '0123456789ABCDEFXZ<>/\\|=+*:-#$%&@?'.split(''), NG = GL.length;
      const atlas = document.createElement('canvas'); atlas.width = NG * cw; atlas.height = 4 * ch; const ag = atlas.getContext('2d');
      ag.font = `600 13px ${MONO}`; ag.textAlign = 'center'; ag.textBaseline = 'middle';
      ['#2bc4e6', '#eafcff', '#f4efe6', C.coral].forEach((col, row) => { ag.fillStyle = col; GL.forEach((c, i) => ag.fillText(c, i * cw + cw / 2, row * ch + ch / 2 + 1)); });
      const mc = document.createElement('canvas'); mc.width = cols * cw; mc.height = rows * ch; const mg = mc.getContext('2d');
      mg.font = `700 220px ${DISP}`; const mm = mg.measureText('SIGNAL'), sx = 600 / (mm.actualBoundingBoxLeft + mm.actualBoundingBoxRight);
      mg.setTransform(sx, 0, 0, 1, mc.width / 2, mc.height / 2 + (mm.actualBoundingBoxAscent - mm.actualBoundingBoxDescent) / 2); mg.textAlign = 'center'; mg.fillStyle = '#fff'; mg.fillText('SIGNAL', 0, 0);
      const md = mg.getImageData(0, 0, mc.width, mc.height).data, mask = new Uint8Array(NC);
      for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) mask[rr * cols + c] = md[((rr * ch + ch / 2 | 0) * mc.width + (c * cw + cw / 2 | 0)) * 4] > 128 ? 1 : 0;
      const head = new Float32Array(cols), spd = new Float32Array(cols), tail = new Float32Array(cols);
      const gly = new Uint8Array(NC), glow = new Float32Array(NC), lock = new Float32Array(NC).fill(-1), rel = new Float32Array(NC);
      const spawn = (c, y) => { head[c] = y; spd[c] = 9 + r() * 15; tail[c] = 5 + r() * 14; };
      for (let c = 0; c < cols; c++) spawn(c, r() * rows * 1.6 - rows * 0.6);
      for (let i = 0; i < NC; i++) { gly[i] = r() * NG | 0; rel[i] = 5.3 + Math.floor(i / cols) / rows * 0.9 + r() * 0.25; }
      let lastLt = 0;
      return (t, dt) => {
        const lt = t % 8, h = Math.min(0.05, dt); if (lt < lastLt) lock.fill(-1); lastLt = lt;
        const hold = lt > 2.6 && lt < 5.2, dens = L.p.dens * (hold ? 0.1 : 1), decay = Math.pow(0.02, h);
        for (let c = 0; c < cols; c++) {
          head[c] += spd[c] * h;
          if (head[c] - tail[c] > rows && r() < dens * h * 6) spawn(c, -r() * 6);
          for (let rr = 0; rr < rows; rr++) {
            const i = rr * cols + c, d = head[c] - rr;
            const tr = d >= 0 && d < tail[c] ? Math.pow(1 - d / tail[c], 1.6) : 0;
            glow[i] = Math.max(glow[i] * decay, tr);
            if (mask[i] && lock[i] < 0 && lt > 1.8 && lt < rel[i] - 0.6 && ((d >= 0 && d < 1.2) || lt > 3.6 + (i % 7) * 0.05)) lock[i] = lt;
            if (lock[i] >= 0 && lt > rel[i]) { lock[i] = -1; glow[i] = 1; }
            if (lock[i] < 0 && r() < 0.05) gly[i] = r() * NG | 0;
          }
        }
        const dim = 1 - 0.65 * seg(lt, 2.2, 3.2) * (1 - seg(lt, 5.0, 5.8));
        g.fillStyle = '#05060a'; g.fillRect(0, 0, W, H);
        for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
          const i = rr * cols + c, x = c * cw, y = oy + rr * ch, d = head[c] - rr;
          if (lock[i] >= 0) {
            const k = lt - lock[i]; g.globalAlpha = 1;
            g.fillStyle = k < 0.22 ? 'rgba(255,90,54,0.55)' : 'rgba(255,214,190,0.16)'; g.fillRect(x, y, cw, ch);
            g.drawImage(atlas, gly[i] * cw, (k < 0.22 ? 3 : 2) * ch, cw, ch, x, y, cw, ch);
          } else if (glow[i] > 0.03) {
            g.globalAlpha = Math.min(1, glow[i]) * (0.75 + 0.25 * L.p.dens) * dim;
            g.drawImage(atlas, gly[i] * cw, (d >= 0 && d < 1 ? 1 : 0) * ch, cw, ch, x, y, cw, ch);
          }
        }
        g.globalAlpha = 1;
      };
    },
  });

  // Exact Euclidean distance transform (Felzenszwalb and Huttenlocher), used to turn glyph bitmaps into signed distance fields.
  function edt(grid, S) {
    const f = new Float64Array(S), d = new Float64Array(S), v = new Int32Array(S), z = new Float64Array(S + 1);
    const pass = (get, set) => {
      for (let line = 0; line < S; line++) {
        for (let q = 0; q < S; q++) f[q] = get(line, q);
        let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
        for (let q = 1; q < S; q++) {
          let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
          while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
          k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
        }
        k = 0; for (let q = 0; q < S; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
        for (let q = 0; q < S; q++) set(line, q, d[q]);
      }
    };
    pass((x, y) => grid[y * S + x], (x, y, val) => { grid[y * S + x] = val; });
    pass((y, x) => grid[y * S + x], (y, x, val) => { grid[y * S + x] = val; });
    return grid;
  }

  let morphGL = null;
  if (EX.G.gl) EX.add({
    cat: 'type', id: 't2-sdfmorph', title: 'Glyph morph with contour lines', aka: 'letter morph, SDF type morph, topographic type, distance-field lettering', tool: 'WebGL2 fragment shader on signed distance fields built in JavaScript (exact distance transform)', runs: 'GPU',
    notice: 'Each letter is drawn once to a hidden canvas and turned into a signed distance field: for every pixel, how far it is from the nearest edge, negative inside. Blending two fields gives a smooth in-between shape, so one glyph melts into the next. The shader draws the zero line as the letter and repeats the distance as ripple contours that travel outward like a topographic map.',
    use: 'logo and monogram transitions, brand systems, tech and science titles, music visuals',
    params: [{ key: 'gap', label: 'Contour spacing', min: 4, max: 24, step: 1, value: 10, unit: ' px' }],
    prompt: 'Glyph morph: one big letter morphs through M, O, R, P, H by blending signed distance fields (hold 0.9 s, morph 0.7 s ease-in-out), filled coral-to-amber with a soft glow, the distance field repeated as thin cream contour lines every {gap} that ripple outward and fade with distance, darker contours inside the letter, deep ink-blue background, small mono caption showing the current pair.',
    setup(cv, L) {
      const G = EX.G, gl = G.gl, ctx = cv.getContext('2d'); const SEQ = 'MORPH', S = 256;
      if (!morphGL) {
        const data = new Float32Array(S * SEQ.length * S);
        const c = document.createElement('canvas'); c.width = c.height = S; const cg = c.getContext('2d', { willReadFrequently: true });
        [...SEQ].forEach((ch, gi) => {
          cg.fillStyle = '#000'; cg.fillRect(0, 0, S, S); cg.fillStyle = '#fff'; cg.font = `700 210px ${DISP}`; cg.textAlign = 'center';
          const m = cg.measureText(ch); cg.fillText(ch, S / 2, S / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
          const px = cg.getImageData(0, 0, S, S).data, inG = new Float64Array(S * S), outG = new Float64Array(S * S);
          for (let i = 0; i < S * S; i++) { const a = px[i * 4] / 255; outG[i] = a >= 1 ? 0 : a <= 0 ? 1e20 : Math.max(0, 0.5 - a) ** 2; inG[i] = a >= 1 ? 1e20 : a <= 0 ? 0 : Math.max(0, a - 0.5) ** 2; }
          edt(outG, S); edt(inG, S);
          for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x; data[(S - 1 - y) * S * SEQ.length + gi * S + x] = Math.sqrt(outG[i]) - Math.sqrt(inG[i]); }
        });
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, S * SEQ.length, S, 0, gl.RED, gl.FLOAT, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        morphGL = {
          tex, prog: G.prog(`uniform sampler2D uSdf; uniform float uA,uB,uK,uGap;
            const float N=${SEQ.length}.;
            float sdf(float gi, vec2 q){ vec2 c=clamp(q,vec2(.004),vec2(.996)); float d=texture(uSdf,vec2((gi+c.x)/N,c.y)).r; return d+length(q-c)*256.; }
            void main(){ vec2 p=(vUv-.5)*vec2(uRes.x/uRes.y,1.); vec2 q=p/0.92+.5;
              float d=mix(sdf(uA,q),sdf(uB,q),uK)*0.92*uRes.y/256.;
              float aa=1.2, fill=1.-smoothstep(-aa,aa,d);
              float ph=d/uGap-uT*.9, line=abs(fract(ph)-.5)*uGap, ln=1.-smoothstep(.55,1.6,line);
              vec3 bg=mix(vec3(.03,.035,.07),vec3(.07,.07,.14),1.-length(p));
              vec3 col=bg+vec3(.96,.92,.86)*ln*.55*exp(-max(d,0.)/75.)*step(0.,d);
              col+=vec3(1.,.36,.2)*.5*exp(-abs(d)/14.)*step(0.,d);
              vec3 ink=mix(vec3(1.,.35,.21),vec3(1.,.69,.13),clamp(-d/40.,0.,1.));
              ink*=1.-.28*ln*smoothstep(4.,10.,-d);
              o=vec4(mix(col,ink,fill),1); }`),
        };
      }
      const M = morphGL, NS = SEQ.length;
      return t => {
        const cyc = 1.6, k = Math.floor(t / cyc), lt = t - k * cyc, a = k % NS, b = (k + 1) % NS, mk = ease.inOut(seg(lt, 0.9, 1.6));
        G.draw(M.prog, null, { uSdf: M.tex, uA: a, uB: b, uK: mk, uGap: L.p.gap, uT: t }, W, H); G.copy(ctx, W, H);
        ctx.font = `500 12px ${MONO}`; ctx.fillStyle = 'rgba(244,239,230,0.55)'; ctx.textBaseline = 'middle';
        ctx.fillText(`sdf  ${SEQ[a]} → ${SEQ[b]}   mix ${mk.toFixed(2)}`, 16, H - 16);
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-sundial', title: 'Sundial type', aka: 'cast shadow type, golden hour lettering, long shadow animation, time-lapse light', tool: 'Canvas 2D (shadow as an affine shear of the text)', runs: 'CPU',
    notice: 'Cut-out letters stand on a floor while the sun crosses the sky behind the camera, like a day in time-lapse. The shadow of an upright letter on flat ground is the same text drawn through one affine transform (a shear set by the sun direction), so long shadows swing across the floor and shrink toward noon. Sky color, the light on the letter faces and the shadow softness all follow the sun height.',
    use: 'travel and outdoor brands, architecture, time and "a day in" stories, calm title cards',
    params: [{ key: 'len', label: 'Max shadow length', min: 1, max: 6, step: 0.25, value: 4, unit: 'x height' }],
    prompt: 'Sundial type time-lapse: the words "GOLDEN HOUR" stand as upright cut-out letters on a wide sandy floor while the sun arcs from left to right behind the camera over 8 s; each letter casts a long soft shadow back across the floor (the text drawn through a shear transform, max {len}), the shadows swing from one side to the other and shorten at noon, sky goes from coral dawn to pale noon to amber dusk, letter faces brighten with the sun, warm light wash from the sun side, fade through dusk and loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const WORD = 'GOLDEN HOUR', HZ = 84, BY = 296, PITCH = 0.85, K = Math.sin(PITCH), CP = Math.cos(PITCH);
      g.font = `700 100px ${DISP}`; const m = g.measureText(WORD), fs = Math.min(130, 100 * 560 / m.width), font = `700 ${fs.toFixed(1)}px ${DISP}`;
      const mix = (a, b, k) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
      return t => {
        const cyc = 9.5, lt = t % cyc, p = clamp01(lt / 8), night = Math.max(1 - seg(lt, 0, 0.7), seg(lt, 8.0, 9.4));
        const phi = -1.3 + 2.6 * p, el = 0.08 + 0.55 * Math.sin(Math.PI * p), ce = Math.cos(el);
        const sx = Math.sin(phi) * ce, sy = Math.sin(el), sz = Math.cos(phi) * ce;
        let dx = -sx / sy, dz = -sz / sy; const ln = Math.hypot(dx, dz), mx = L.p.len; if (ln > mx) { dx *= mx / ln; dz *= mx / ln; }
        const day = clamp01(sy / 0.5);
        g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.globalAlpha = 1;
        const sk = g.createLinearGradient(0, 0, 0, HZ);
        sk.addColorStop(0, mix([52, 34, 78], [92, 136, 196], day)); sk.addColorStop(1, mix([255, 136, 70], [240, 226, 204], day));
        g.fillStyle = sk; g.fillRect(0, 0, W, HZ);
        g.fillStyle = mix([255, 170, 150], [255, 255, 255], day); g.globalAlpha = 0.28;
        for (let i = 0; i < 4; i++) { const cx = ((i * 211 + t * 9) % 900) - 130; g.beginPath(); g.ellipse(cx, 18 + i * 13, 120 - i * 14, 5 + i * 1.5, 0, 0, 7); g.fill(); }
        g.globalAlpha = 1;
        const gr = g.createLinearGradient(0, HZ, 0, H); gr.addColorStop(0, mix([236, 160, 110], [238, 226, 204], day)); gr.addColorStop(1, mix([150, 88, 70], [206, 180, 146], day));
        g.fillStyle = gr; g.fillRect(0, HZ, W, H - HZ);
        g.fillStyle = 'rgba(90,50,40,0.08)'; for (let i = 1; i < 12; i++) { const y = HZ + Math.pow(i / 12, 1.9) * (H - HZ); g.fillRect(0, y, W, 1); }
        g.strokeStyle = 'rgba(90,50,40,0.07)'; g.lineWidth = 1; g.beginPath(); for (let i = -8; i <= 8; i++) { g.moveTo(W / 2 + i * 12, HZ); g.lineTo(W / 2 + i * 150, H); } g.stroke();
        const wx = sx < 0 ? 0 : W, wash = g.createRadialGradient(wx, HZ, 0, wx, HZ, 520); wash.addColorStop(0, `rgba(255,200,120,${0.45 * (1 - day * 0.6)})`); wash.addColorStop(1, 'rgba(255,200,120,0)');
        g.fillStyle = wash; g.fillRect(0, 0, W, H);
        // Shadow: height above the baseline becomes depth away from the camera, sheared by the sun direction.
        g.font = font; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.setTransform(1, 0, -dx, -K * dz, dx * BY, BY + K * dz * BY);
        g.filter = `blur(${(0.8 + Math.hypot(dx, dz) * 0.9).toFixed(1)}px)`; g.globalAlpha = 0.4 + 0.3 * clamp01(sy * 3);
        g.fillStyle = 'rgb(70,30,34)'; g.fillText(WORD, W / 2, BY);
        g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.globalAlpha = 1;
        // Letters: a darker edge for thickness, then the face lit by the sun.
        const lit = 0.35 + 0.65 * clamp01(sz * 0.6 + sy * 0.6);
        g.setTransform(1, 0, 0, CP, 0, BY * (1 - CP));
        g.fillStyle = mix([70, 24, 26], [150, 44, 32], lit); for (let k = 1; k <= 6; k++) g.fillText(WORD, W / 2, BY + k * 1.2);
        g.fillStyle = mix([110, 40, 36], [255, 96, 58], lit); g.fillText(WORD, W / 2, BY);
        g.setTransform(1, 0, 0, 1, 0, 0);
        if (night > 0) { g.fillStyle = `rgba(12,9,24,${night * 0.92})`; g.fillRect(0, 0, W, H); }
        g.textAlign = 'left';
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-timedisp', title: 'Time-displacement type', aka: 'slit-scan type, time warp text, rubber delay, echo type', tool: 'Canvas 2D (per-strip clipping, each strip drawn at its own time)', runs: 'CPU',
    notice: 'The word moves with a simple sway, spin and pulse. The frame is cut into 4 px strips, and each strip draws the word as it was a little earlier, with the delay set by a map. Rigid motion turns rubbery: edges bend, letters smear and snap back. A coral echo with twice the delay sits behind.',
    use: 'music videos, fashion promos, transitions, experimental title sequences',
    params: [{ key: 'lag', label: 'Max delay', min: 0, max: 0.8, step: 0.02, value: 0.4, unit: ' s' }],
    controls: [{ label: 'Top to bottom', on: true, fn: L => { L.state.map = 0; } }, { label: 'From center', fn: L => { L.state.map = 1; } }, { label: 'Ripple', fn: L => { L.state.map = 2; } }],
    prompt: 'Time-displacement effect on the word "TIME": it sways, spins up to 25 degrees and pulses in scale; the frame is cut into 4 px horizontal strips and each strip shows the word up to {lag} earlier according to a delay map (top to bottom, from the center, or a moving ripple), so the rigid motion bends like rubber; cream type with a coral echo at twice the delay on deep navy.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const st = (L.state = L.state || { map: 0 });
      const mkWord = col => { const c = document.createElement('canvas'); c.width = 620; c.height = 260; const x = c.getContext('2d'); x.font = `700 176px ${DISP}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText('TIME', 310, 140); return c; };
      const cream = mkWord(C.cream), coral = mkWord(C.coral), SH = 4;
      const pose = (tt, out) => { out[0] = W / 2 + 80 * Math.sin(tt * 1.3); out[1] = H / 2 - 6 + 18 * Math.sin(tt * 2.1); out[2] = 0.42 * Math.sin(tt * 1.9) * (0.65 + 0.35 * Math.sin(tt * 0.43)); out[3] = 1 + 0.14 * Math.sin(tt * 2.6); };
      const P = [0, 0, 0, 0];
      const delay = (y, t) => st.map === 0 ? y / H : st.map === 1 ? Math.abs(y - H / 2) / (H / 2) : 0.5 + 0.5 * Math.sin(y * 0.035 - t * 3);
      const layer = (img, t, k) => {
        for (let y = 0; y < H; y += SH) {
          pose(t - k * L.p.lag * delay(y + SH / 2, t), P);
          g.save(); g.beginPath(); g.rect(0, y, W, SH + 0.5); g.clip();
          const c = Math.cos(P[2]) * P[3], s = Math.sin(P[2]) * P[3];
          g.setTransform(c, s, -s, c, P[0], P[1]); g.drawImage(img, -310, -130); g.restore();
        }
      };
      return t => {
        g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#101032'; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(244,239,230,0.05)'; for (let y = 0; y < H; y += SH * 2) g.fillRect(0, y, W, 1);
        g.globalAlpha = 0.85; layer(coral, t, 2); g.globalAlpha = 1; layer(cream, t, 1);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.font = `500 11px ${MONO}`; g.fillStyle = 'rgba(244,239,230,0.45)'; g.textBaseline = 'middle';
        g.fillText(['delay map: top to bottom', 'delay map: from center', 'delay map: ripple'][st.map] + `   ${H / SH} strips`, 14, H - 14);
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-shatter', title: 'Shattered type', aka: 'breaking text, glass shatter title, Voronoi fracture type, explode and reassemble', tool: 'Canvas 2D (Voronoi cells by half-plane clipping, per-shard clip and transform)', runs: 'CPU',
    notice: 'The word is cut into Voronoi shards: each cell is the bounding box clipped by the half-planes between its seed point and every other seed. Cracks spread from the impact point first, then every shard flies along a simple ballistic path, spinning and popping toward the camera, while time slows down. The whole flight then runs backward with an ease, so the word snaps back together.',
    use: 'impact moments, sports and gaming titles, "breakthrough" messages, trailer hits',
    params: [{ key: 'n', label: 'Shards', min: 8, max: 90, step: 1, value: 42, restart: true }],
    prompt: 'Shattered type: the word "BREAK" in heavy coral sans cracks from an impact point (cracks spread over 0.3 s), then breaks into {n} Voronoi shards that fly out ballistically with spin and a slight pop toward the camera, slow motion after the hit, a white flash and shockwave ring at impact, hang for a beat, then the flight rewinds with ease-in-out and the word snaps back together, dark charcoal background, 6 s loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const r = EX.rng(17);
      const word = document.createElement('canvas'); word.width = W; word.height = H; const wg = word.getContext('2d');
      wg.font = `700 158px ${DISP}`; wg.textAlign = 'center'; wg.textBaseline = 'middle';
      const gr = wg.createLinearGradient(0, 110, 0, 250); gr.addColorStop(0, '#ff7a4f'); gr.addColorStop(1, '#e8401f'); wg.fillStyle = gr; wg.fillText('BREAK', W / 2, H / 2 + 6);
      const m = wg.measureText('BREAK'), bx0 = W / 2 - m.actualBoundingBoxLeft - 8, bx1 = W / 2 + m.actualBoundingBoxRight + 8, by0 = H / 2 + 6 - m.actualBoundingBoxAscent - 8, by1 = H / 2 + 6 + m.actualBoundingBoxDescent + 8;
      // Voronoi cells: clip the box by the bisector half-plane of every other seed.
      const N = L.p.n | 0, seeds = []; for (let i = 0; i < N; i++) seeds.push([bx0 + r() * (bx1 - bx0), by0 + r() * (by1 - by0)]);
      const clip = (poly, nx, ny, d) => { const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d; if (da <= 0) out.push(a); if ((da <= 0) !== (db <= 0)) { const k = da / (da - db); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } } return out; };
      const IX = bx0 + (bx1 - bx0) * 0.38, IY = H / 2 + 10;
      const shards = seeds.map((s, i) => {
        let poly = [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]];
        seeds.forEach((q, j) => { if (j !== i && poly.length) { const nx = q[0] - s[0], ny = q[1] - s[1]; poly = clip(poly, nx, ny, (nx * (s[0] + q[0]) + ny * (s[1] + q[1])) / 2); } });
        let cx = 0, cy = 0; poly.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= poly.length; cy /= poly.length;
        const dx = cx - IX, dy = cy - IY, d = Math.hypot(dx, dy) || 1, sp = 30 + (120 + 90 * r()) * Math.exp(-d / 260);
        return { poly, cx, cy, vx: dx / d * sp, vy: dy / d * sp - 70 * r(), w: (r() - 0.5) * 4, z: 0.15 + 0.5 * r() * Math.exp(-d / 300) };
      });
      const crack = document.createElement('canvas'); crack.width = W; crack.height = H; const cg = crack.getContext('2d');
      cg.drawImage(word, 0, 0); cg.globalCompositeOperation = 'source-atop'; cg.lineWidth = 1.6;
      /** @type {[number, string][]} */ ([[1.2, 'rgba(255,214,190,0.75)'], [0, 'rgba(40,8,8,0.9)']]).forEach(([o, col]) => { cg.strokeStyle = col; for (const s of shards) { cg.beginPath(); s.poly.forEach((p, k) => k ? cg.lineTo(p[0] + o, p[1] + o) : cg.moveTo(p[0] + o, p[1] + o)); cg.closePath(); cg.stroke(); } });
      const bgG = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 420); bgG.addColorStop(0, '#1d1c22'); bgG.addColorStop(1, '#0a0a0d');
      const TMAX = 0.85, GRAV = 240;
      return t => {
        const lt = t % 6, tau = lt < 3.6 ? TMAX * ease.out(seg(lt, 1.15, 3.4)) : TMAX * (1 - ease.inOut(seg(lt, 3.75, 4.75)));
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = bgG; g.fillRect(0, 0, W, H);
        if (tau <= 0) {
          g.drawImage(word, 0, 0);
          const cr = seg(lt, 0.8, 1.15); if (cr > 0 && lt < 2) { g.save(); g.beginPath(); g.arc(IX, IY, cr * 420, 0, 7); g.clip(); g.drawImage(crack, 0, 0); g.restore(); }
          const sealF = 1 - seg(lt, 4.75, 5.1); if (lt > 4.75 && sealF > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = sealF * 0.5; g.drawImage(word, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
        } else {
          for (const s of shards) {
            const x = s.cx + s.vx * tau, y = s.cy + s.vy * tau + 0.5 * GRAV * tau * tau, sc = 1 + s.z * tau;
            g.save(); g.translate(x, y); g.rotate(s.w * tau); g.scale(sc, sc); g.translate(-s.cx, -s.cy);
            g.beginPath(); s.poly.forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.clip();
            g.drawImage(crack, 0, 0); g.restore();
          }
          g.globalAlpha = 1;
        }
        const fl = 1 - seg(lt, 1.15, 1.4); if (lt > 1.15 && fl > 0) {
          g.globalAlpha = fl; g.globalCompositeOperation = 'lighter'; const fg = g.createRadialGradient(IX, IY, 0, IX, IY, 110); fg.addColorStop(0, 'rgba(255,214,170,0.9)'); fg.addColorStop(0.4, 'rgba(255,120,60,0.35)'); fg.addColorStop(1, 'rgba(255,90,40,0)'); g.fillStyle = fg; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
          g.strokeStyle = `rgba(255,236,220,${fl * 0.7})`; g.lineWidth = 3 * fl + 0.5; g.beginPath(); g.arc(IX, IY, 30 + (1 - fl) * 260, 0, 7); g.stroke(); g.globalAlpha = 1;
        }
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-scanimation', title: 'Scanimation type', aka: 'kinegram, barrier-grid animation, picket-fence animation, optical type illusion', tool: 'Canvas 2D (interlaced frames + sliding barrier grid)', runs: 'CPU',
    notice: 'Five frames of a bouncing word are cut into thin vertical slits and woven into one still image, which looks like noise. A sheet of black bars with one open slit per group slides over it; at each position the slits line up with one frame only, so the word comes alive under the sheet and falls back to stripes where the sheet ends. No pixel of the image underneath ever changes.',
    use: 'print-to-motion explainers, packaging and book ideas, optical illusion intros, retro toy aesthetics',
    params: [{ key: 'slit', label: 'Slit width', min: 1, max: 4, step: 1, value: 2, unit: ' px', restart: true }],
    prompt: 'Scanimation (barrier-grid) type: 5 frames of the word "WAVE" with letters bouncing in a wave are interlaced into {slit} wide vertical slits as one coral-on-cream still; a black acetate sheet with one open slit every 5 slits slides over it at 12 frames per second, its edge sweeping in and out with ease-in-out, so the word animates under the sheet and turns to stripes outside it; paper texture, slight sheen on the acetate edge.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const N = 5, S = L.p.slit | 0, PER = N * S, WORD = 'WAVE';
      const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
      const frames = [];
      for (let k = 0; k < N; k++) {
        const c = mk(), x = c.getContext('2d'); x.font = `700 150px ${DISP}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#d8401f';
        const ws = [...WORD].map(ch => x.measureText(ch).width), tot = ws.reduce((a, b) => a + b, 0) + 14 * (WORD.length - 1); let px = W / 2 - tot / 2;
        [...WORD].forEach((ch, i) => { const ph = 2 * Math.PI * k / N - i * 1.1, up = Math.max(0, Math.sin(ph)), sq = 1 - 0.18 * Math.max(0, -Math.sin(ph)); x.save(); x.translate(px + ws[i] / 2, 248 - up * 62); x.scale(1 / Math.sqrt(sq), sq); x.fillText(ch, 0, 0); x.restore(); px += ws[i] + 14; });
        x.fillStyle = '#1f9fc0'; const bx = W / 2 + Math.cos(2 * Math.PI * k / N) * 250, by = 290 - Math.abs(Math.sin(2 * Math.PI * k / N)) * 40; x.beginPath(); x.arc(bx, by, 12, 0, 7); x.fill();
        frames.push(c);
      }
      const inter = mk(), ig = inter.getContext('2d'); ig.fillStyle = '#f2ead9'; ig.fillRect(0, 0, W, H);
      for (let x = 0, i = 0; x < W; x += S, i++) ig.drawImage(frames[i % N], x, 0, S, H, x, 0, S, H);
      ig.globalAlpha = 0.06; const r = EX.rng(3); for (let i = 0; i < 2500; i++) { ig.fillStyle = r() < 0.5 ? '#000' : '#fff'; ig.fillRect(r() * W, r() * H, 1.5, 1.5); } ig.globalAlpha = 1;
      const bars = document.createElement('canvas'); bars.width = W + PER * 2; bars.height = H; const bg2 = bars.getContext('2d');
      bg2.fillStyle = '#0c0b10'; for (let x = 0; x < bars.width; x += PER) bg2.fillRect(x + S, 0, PER - S, H);
      return t => {
        const lt = t % 9, edge = 40 + (W - 40) * ease.inOut(seg(lt, 0.4, 1.8)) - (W - 260) * ease.inOut(seg(lt, 5.6, 6.8)) - 220 * ease.inOut(seg(lt, 7.6, 8.7));
        const step = Math.floor(t * 12) % N;
        g.drawImage(inter, 0, 0);
        g.save(); g.beginPath(); g.rect(0, 0, Math.max(0, edge), H); g.clip();
        g.drawImage(bars, -PER * 2 + step * S + PER, 0);
        g.fillStyle = 'rgba(120,140,170,0.06)'; g.fillRect(0, 0, edge, H); g.restore();
        const sh = g.createLinearGradient(edge - 18, 0, edge + 2, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0.35)');
        g.fillStyle = sh; g.fillRect(edge - 18, 0, 20, H); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(edge + 2, 0, 3, H);
        g.fillStyle = 'rgba(12,11,16,0.85)'; g.fillRect(W - 166, 8, 156, 20); g.font = `500 11px ${MONO}`; g.fillStyle = 'rgba(242,234,217,0.8)'; g.textBaseline = 'middle'; g.fillText(`${N} frames x ${S} px slits`, W - 158, 18);
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-typewriter', title: 'Typewriter carriage', aka: 'typewriter text, typed letter animation, carriage return, analog typing', tool: 'Canvas 2D (keystroke schedule, incremental paper canvas)', runs: 'CPU',
    notice: 'The strike point stays still and the paper moves, as on a real typewriter: each keystroke shifts the sheet left by one character, and a carriage return slides it back with an ease and feeds one line up. Key timing follows a human rhythm, slower at spaces and punctuation. Every letter is stamped once into a paper canvas with its own small offset, tilt and ink density, so the cost per frame stays flat.',
    use: 'storytelling intros, letters and quotes, writing and journalism brands, nostalgic product videos',
    params: [{ key: 'wpm', label: 'Typing speed', min: 30, max: 160, step: 5, value: 110, unit: ' wpm', restart: true }],
    prompt: 'Typewriter animation at {wpm}: the camera stays on the strike point while the paper moves left one character per keystroke, carriage return slides it back with an ease and feeds a line, human key rhythm with pauses at spaces and punctuation, each letter stamped in a monospace face with a tiny random offset, tilt and uneven ink, a dark platen roller and metal type guide in front, a small shake on every strike, the sheet ejects and a fresh one rolls in to loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const r = EX.rng(8);
      const TEXT = 'Dear reader,\nevery letter lands\nwith a small clack.\nThe paper moves.\n     - C.';
      const FS = 30, font = `500 ${FS}px Consolas, ${MONO}`, LH = 42, PW = 520, PH = 470, MX = 50, MY = 84, SX = 300, SY = 262;
      const paper = document.createElement('canvas'); paper.width = PW; paper.height = PH; const pg = paper.getContext('2d');
      pg.font = font; const CW = pg.measureText('M').width;
      const clean = () => {
        pg.setTransform(1, 0, 0, 1, 0, 0); pg.globalAlpha = 1; pg.fillStyle = '#f3ede0'; pg.fillRect(0, 0, PW, PH);
        const rr = EX.rng(4); pg.globalAlpha = 0.05; for (let i = 0; i < 1600; i++) { pg.fillStyle = rr() < 0.5 ? '#7a6a50' : '#fff'; pg.fillRect(rr() * PW, rr() * PH, 1 + rr() * 2, 1); } pg.globalAlpha = 1;
      };
      // Keystroke schedule: per character its time, column, line and stamp jitter.
      const keys = []; const spk = 60 / (L.p.wpm * 5); let tk = 0.9, col = 0, line = 0;
      for (const ch of TEXT) {
        if (ch === '\n') { tk += 0.7; col = 0; line++; continue; }
        tk += spk * (0.6 + 0.8 * r()) + (ch === ' ' ? spk * 0.8 : 0) + (',.'.includes(keys.length ? keys[keys.length - 1].ch : '') ? spk * 2.5 : 0);
        keys.push({ ch, t: tk, col, line, dx: (r() - 0.5) * 1.2, dy: (r() - 0.5) * 1.6, rot: (r() - 0.5) * 0.06, ink: 0.62 + 0.38 * r(), ghost: r() < 0.12 });
        col++;
      }
      const END = tk, CYC = END + 2.6; let drawn = 0, lastLt = 0;
      clean();
      return t => {
        const lt = t % CYC; if (lt < lastLt) { clean(); drawn = 0; } lastLt = lt;
        while (drawn < keys.length && keys[drawn].t <= lt) {
          const k = keys[drawn++]; if (k.ch === ' ') continue;
          pg.setTransform(Math.cos(k.rot), Math.sin(k.rot), -Math.sin(k.rot), Math.cos(k.rot), MX + k.col * CW + k.dx, MY + k.line * LH + k.dy);
          pg.font = font; pg.textBaseline = 'alphabetic'; pg.fillStyle = '#1c1a22';
          if (k.ghost) { pg.globalAlpha = 0.25; pg.fillText(k.ch, 0.9, -0.4); }
          pg.globalAlpha = k.ink; pg.fillText(k.ch, 0, 0); pg.globalAlpha = 1;
        }
        pg.setTransform(1, 0, 0, 1, 0, 0);
        // carriage position: eased between keystrokes and returns
        const prev = drawn > 0 ? keys[drawn - 1] : null, next = keys[drawn];
        let cx = 0, cl = 0;
        if (!prev) cx = 0; else { cx = prev.col + 1; cl = prev.line; }
        if (next && next.line !== cl && prev) { const k = ease.inOut(seg(lt, prev.t + 0.1, prev.t + 0.55)); cx = (prev.col + 1) * (1 - k); cl = prev.line + k; }
        const hit = prev ? Math.exp(-(lt - prev.t) * 40) : 0;
        const eject = ease.inOut(seg(lt, END + 1.2, END + 2.2)), feed = 1 - ease.out(seg(lt, 0, 0.8));
        const ox = SX - MX - cx * CW, oy = SY - MY - cl * LH - eject * 420 + feed * 260 + hit * 0.8;
        g.fillStyle = '#17151c'; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(ox + 6, oy + 8, PW, PH);
        g.drawImage(paper, ox, oy);
        // machine: platen roller, paper bail and type guide
        const lamp = g.createRadialGradient(SX, SY - 120, 40, SX, SY - 80, 420); lamp.addColorStop(0, 'rgba(255,214,150,0.10)'); lamp.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = lamp; g.fillRect(0, 0, W, SY + 12);
        const rg = g.createLinearGradient(0, SY + 12, 0, SY + 46); rg.addColorStop(0, '#3a3840'); rg.addColorStop(0.35, '#121116'); rg.addColorStop(1, '#050507');
        g.fillStyle = rg; g.fillRect(0, SY + 12, W, 34); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, SY + 17, W, 1.5);
        const bd = g.createLinearGradient(0, SY + 46, 0, H); bd.addColorStop(0, '#3d6a63'); bd.addColorStop(1, '#1d3532'); g.fillStyle = bd; g.fillRect(0, SY + 46, W, H - SY - 46);
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, SY + 46, W, 1);
        g.fillStyle = '#c9b98f'; g.fillRect(SX - 70, SY + 66, 140, 18); g.fillStyle = '#2b2620'; g.font = `700 10px ${DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('C L A U D E   M O T I O N', SX, SY + 75.5); g.textAlign = 'left';
        g.fillStyle = '#9a96a0'; g.fillRect(0, SY + 12, W, 2);
        g.fillStyle = '#b8b3ba'; g.beginPath(); g.moveTo(SX - 22, SY + 13); g.lineTo(SX - 7, SY + 2); g.lineTo(SX + 7, SY + 2); g.lineTo(SX + 22, SY + 13); g.closePath(); g.fill();
        g.fillStyle = '#17151c'; g.fillRect(SX - CW / 2 - 1, SY - 1, CW + 2, 4);
        if (hit > 0.05) { g.fillStyle = `rgba(40,36,44,${hit})`; g.fillRect(SX - CW / 2, SY - 20 * hit, CW, 22 * hit); }
        g.font = `500 11px ${MONO}`; g.fillStyle = 'rgba(244,239,230,0.45)'; g.textBaseline = 'middle'; g.fillText(`${L.p.wpm} wpm`, 16, H - 16);
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-chrome', title: 'Retro chrome title', aka: '80s chrome text, extruded logo, VHS title, glint sweep', tool: 'Canvas 2D (pre-rendered chrome face, stacked extrusion copies, source-atop glint)', runs: 'CPU',
    notice: 'The chrome face is painted once: a hard horizon gradient from sky blue to burnt orange, white rim and an italic shear. Depth comes from drawing a silhouette 18 times along an extrusion vector, back copies purple and front copies pink, so turning the vector reads as a camera move. A white band clipped to the letters with source-atop sweeps across as the glint, and four-point stars pop on the corners.',
    use: 'retro and synthwave branding, gaming and music titles, VHS-style intros, event posters',
    params: [{ key: 'depth', label: 'Extrusion depth', min: 0, max: 44, step: 1, value: 26, unit: ' px' }],
    prompt: '1980s chrome title: "MOTION" in heavy italic sans with a sky-blue to burnt-orange chrome gradient split by a dark horizon line, white rim, extruded {depth} deep from hot pink to deep purple, flies in with ease-out-back while turning, then floats while the extrusion angle drifts like a slow camera orbit, white glint sweeps across every 2.4 s, four-point star sparkles pop on the corners, pink script "Studio" below with a glow, starry purple night background, 6 s loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const FW = 620, FH = 220, WORD = 'MOTION', SK = -0.2;
      const mk = () => { const c = document.createElement('canvas'); c.width = FW; c.height = FH; return c; };
      const face = mk(), fg = face.getContext('2d'), sil = [mk(), mk()];
      const setT = x => { x.font = `700 150px ${DISP}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.setTransform(1, 0, SK, 1, FW / 2 - SK * 165, 0); };
      setT(fg); const m = fg.measureText(WORD), top = 165 - m.actualBoundingBoxAscent;
      const cg = fg.createLinearGradient(0, top, 0, 165);
      [[0, '#f4fbff'], [0.42, '#6fb2ec'], [0.5, '#16204a'], [0.53, '#6a3a2e'], [0.75, '#e0904a'], [1, '#fff1cc']].forEach(([k, c]) => cg.addColorStop(/** @type {number} */ (k), /** @type {string} */ (c)));
      fg.lineWidth = 5; fg.lineJoin = 'round'; fg.strokeStyle = '#fff6ec'; fg.strokeText(WORD, 0, 165); fg.fillStyle = cg; fg.fillText(WORD, 0, 165);
      sil.forEach((c, i) => { const x = c.getContext('2d'); setT(x); x.fillStyle = i ? '#ff3fa4' : '#4a1878'; x.lineWidth = 5; x.lineJoin = 'round'; x.strokeStyle = x.fillStyle; x.strokeText(WORD, 0, 165); x.fillText(WORD, 0, 165); });
      const tmp = mk(), tg = tmp.getContext('2d');
      const r = EX.rng(41), stars = [...Array(90)].map(() => [r() * W, r() * H * 0.8, r() * 1.4 + 0.3, r() * 6]);
      const corners = [[118, 64], [520, 70], [300, 58], [470, 176]];
      const sparkle = (x, y, s) => { if (s <= 0) return; g.save(); g.translate(x, y); g.rotate(s * 0.6); g.fillStyle = '#ffffff'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 3.5 * s : 26 * s; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); g.restore(); };
      return t => {
        const lt = t % 6, inK = ease.back(seg(lt, 0.1, 1.0)), outK = ease.inOut(seg(lt, 5.3, 5.95));
        const bgG = g.createLinearGradient(0, 0, 0, H); bgG.addColorStop(0, '#0b0620'); bgG.addColorStop(0.7, '#2a0f45'); bgG.addColorStop(1, '#3d1240');
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = bgG; g.fillRect(0, 0, W, H);
        for (const s of stars) { g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + s[3]); g.fillStyle = '#fff'; g.fillRect(s[0], s[1], s[2], s[2]); }
        g.globalAlpha = 1; g.fillStyle = 'rgba(255,63,164,0.5)'; g.fillRect(0, 286, W, 1.5);
        const sc = (0.25 + 0.75 * inK) * (1 + 0.15 * outK), sx = sc * (0.35 + 0.65 * clamp01(seg(lt, 0.1, 0.9) * 1.1)), alpha = 1;
        const ang = 2.15 + 0.45 * Math.sin(t * 0.8) - (1 - clamp01(inK)) * 1.2, dep = L.p.depth * clamp01(inK), ex = Math.cos(ang), ey = Math.sin(ang);
        g.globalAlpha = alpha; g.setTransform(sx, 0, 0, sc, W / 2, 150 + Math.sin(t * 1.6) * 3);
        const n = 18;
        for (let k = n; k >= 1; k--) { const d = dep * k / n; g.drawImage(sil[0], -FW / 2 + ex * d, -FH / 2 + ey * d); g.globalAlpha = alpha * Math.pow(1 - k / n, 1.4); g.drawImage(sil[1], -FW / 2 + ex * d, -FH / 2 + ey * d); g.globalAlpha = alpha; }
        tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, FW, FH); tg.drawImage(face, 0, 0);
        const gp = (lt % 2.4) / 2.4; if (gp < 0.4) {
          const gx = -120 + gp / 0.4 * (FW + 240); tg.globalCompositeOperation = 'source-atop';
          const gl = tg.createLinearGradient(gx - 60, 0, gx + 60, 0); gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,255,0.85)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
          tg.fillStyle = gl; tg.setTransform(1, 0, 0.5, 1, -80, 0); tg.fillRect(gx - 60, 0, 120, FH); tg.setTransform(1, 0, 0, 1, 0, 0);
        }
        g.drawImage(tmp, -FW / 2, -FH / 2);
        g.setTransform(1, 0, 0, 1, 0, 0);
        corners.forEach(([x, y], i) => { const s0 = 1.3 + i * 0.95; sparkle(W / 2 + (x - FW / 2) * sx, 150 + (y - FH / 2) * sc, alpha * Math.sin(Math.PI * seg(lt, s0, s0 + 0.45))); });
        g.globalAlpha = alpha * clamp01(seg(lt, 0.9, 1.4)); g.font = `700 46px "Segoe Print", ${DISP}`; g.textAlign = 'center';
        g.shadowColor = '#ff3fa4'; g.shadowBlur = 16; g.fillStyle = '#ffd1ea'; g.fillText('Studio', W / 2 + 120, 300); g.shadowBlur = 0; g.textAlign = 'left'; g.globalAlpha = 1;
        if (outK > 0) { g.globalAlpha = outK; g.fillStyle = bgG; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-crawl', title: 'Perspective text crawl', aka: 'opening crawl, receding text, scrolling credits in perspective, floor text', tool: 'Canvas 2D (row-by-row perspective resampling)', runs: 'CPU',
    notice: 'The text is set once, justified, on a tall hidden canvas. Each screen row then copies one thin slice of it: rows near the horizon read from far down the page and draw it narrow, rows near the bottom read nearby text and draw it wide, which is exactly a plane tilted away from the camera. Scrolling only moves the start of that lookup, so the crawl runs forever and fades into the distance.',
    use: 'story openers, credits, manifesto and mission videos, playful presentations',
    params: [{ key: 'tilt', label: 'Tilt (flatness)', min: 0.2, max: 1, step: 0.05, value: 0.5 }, { key: 'speed', label: 'Scroll speed', min: 10, max: 120, step: 1, value: 46, unit: ' px/s' }],
    prompt: 'Perspective text crawl: a justified amber paragraph block with a title ("CHAPTER SEVEN / A LONG SCROLL") recedes on a tilted plane toward the horizon at {speed}, plane flatness {tilt}, letters shrink and fade into the distance, built row by row from a flat text canvas, slow twinkling starfield behind, seamless endless loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const TW = 560, PAD = 30;
      const paras = ['Motion design is the craft of making change feel inevitable. Nothing in this frame is a video file.', 'Every word was set once on a flat sheet, then tilted onto a plane and pushed toward the horizon one screen row at a time, sixty times a second.', 'Rows near the bottom read text close by and draw it wide. Rows near the horizon read text far away and draw it thin. That is all perspective is.', 'The crawl never ends. It simply runs out of stars.'];
      const src = document.createElement('canvas'); src.width = TW; src.height = 1700; const sg = src.getContext('2d');
      sg.fillStyle = '#ffb020'; sg.textAlign = 'center'; sg.font = `600 30px ${DISP}`; sg.fillText('CHAPTER SEVEN', TW / 2, 70); sg.font = `700 56px ${DISP}`; sg.fillText('A LONG SCROLL', TW / 2, 140);
      sg.textAlign = 'left'; sg.font = `600 30px ${DISP}`; let y = 230;
      for (const p of paras) {
        const words = p.split(' '); let line = [];
        const flush = (last) => { const wsum = line.reduce((a, w) => a + sg.measureText(w).width, 0), gap = last || line.length < 2 ? sg.measureText(' ').width : (TW - 2 * PAD - wsum) / (line.length - 1); let x = PAD; for (const w of line) { sg.fillText(w, x, y); x += sg.measureText(w).width + gap; } y += 44; line = []; };
        for (const w of words) { const test = line.concat(w).join(' '); if (sg.measureText(test).width > TW - 2 * PAD && line.length) flush(false); line.push(w); }
        flush(true); y += 30;
      }
      const SH = y + 520, HZ = 30, NH = H - HZ;
      const tile = document.createElement('canvas'); tile.width = TW; tile.height = SH * 2; const tg = tile.getContext('2d'); tg.drawImage(src, 0, 0); tg.drawImage(src, 0, SH);
      const r = EX.rng(12), stars = [...Array(140)].map(() => [r() * W, r() * H, r() * 1.3 + 0.3, r() * 6]);
      let scroll = 120;
      return (t, dt) => {
        scroll = (scroll + L.p.speed * Math.min(0.05, dt)) % SH;
        g.globalAlpha = 1; g.fillStyle = '#04040a'; g.fillRect(0, 0, W, H);
        for (const s of stars) { g.globalAlpha = 0.4 + 0.4 * Math.sin(t * 1.5 + s[3]); g.fillStyle = '#e8e6ff'; g.fillRect(s[0], s[1], s[2], s[2]); }
        const A = NH / (L.p.tilt * 1.25);
        // One-pixel rows near the camera, two-pixel rows in the distance where the text is tiny.
        for (let yy = H - 1; yy > HZ;) {
          const q = (yy - HZ) / NH; if (q < 0.06) break;
          const step = q > 0.5 ? 1 : 2, v = A / q - A, dv = A / (q * q) / NH * step, s = 1.25 * q;
          const fade = clamp01((q - 0.06) / 0.22);
          if (fade > 0) { g.globalAlpha = fade; const sv = ((scroll - v) % SH + SH) % SH; g.drawImage(tile, 0, sv, TW, Math.max(0.5, dv), W / 2 - TW * s / 2, yy - step + 1, TW * s, step); }
          yy -= step;
        }
        g.globalAlpha = 1;
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-stencil', title: 'Stencil spray reveal', aka: 'spray paint type, graffiti stencil, street art reveal, overspray', tool: 'Canvas 2D (accumulated spray dots split by stencil masks)', runs: 'CPU',
    notice: 'A spray nozzle zigzags over a cardboard stencil and drops a few hundred soft dots per frame into one paint layer that never clears. Two masks split that layer: dots over the cut-out letters belong to the wall, dots on the cardboard ride along with the card. When the card lifts away it takes its overspray with it and leaves crisp letters, and a few drips run down.',
    use: 'street and urban brands, sports and music promos, DIY and craft themes, "reveal" moments',
    params: [{ key: 'flow', label: 'Paint flow', min: 0.2, max: 2, step: 0.1, value: 1 }],
    prompt: 'Stencil spray reveal: a cardboard stencil with "WET PAINT" cut out (stencil bridges in the letters) sits on a concrete wall; a spray can zigzags across it in three passes over 3 s, soft coral spray dots (flow {flow}) build up on the wall through the cut-outs and as overspray on the card; the card then lifts off with a tilt and a growing shadow, revealing crisp painted letters, a few paint drips run down, then the wall is cleaned and it loops.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const r = EX.rng(77);
      const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
      const CX0 = 36, CY0 = 92, CX1 = 604, CY1 = 270;
      const wall = mk(), wg = wall.getContext('2d'); wg.fillStyle = '#8d8a85'; wg.fillRect(0, 0, W, H);
      for (let i = 0; i < 9000; i++) { const v = r(); wg.fillStyle = `rgba(${v < 0.5 ? '40,38,36' : '235,232,226'},${0.04 + r() * 0.08})`; wg.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3); }
      wg.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 120; y < H; y += 120) wg.fillRect(0, y, W, 2);
      const vg = wg.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 440); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); wg.fillStyle = vg; wg.fillRect(0, 0, W, H);
      const hole = mk(), hg = hole.getContext('2d'); hg.font = `700 120px ${DISP}`; const m = hg.measureText('WET PAINT'), fs = 120 * 520 / m.width;
      hg.font = `700 ${fs.toFixed(1)}px ${DISP}`; hg.textAlign = 'center'; hg.textBaseline = 'middle'; hg.fillStyle = '#fff'; hg.fillText('WET PAINT', W / 2, (CY0 + CY1) / 2 + 4);
      hg.globalCompositeOperation = 'destination-out'; for (let x = 70; x < 580; x += 37) hg.fillRect(x, (CY0 + CY1) / 2 - 6 + ((x / 37) % 2 ? -26 : 22), 5, 12);
      const solid = mk(), sg = solid.getContext('2d'); sg.fillStyle = '#fff'; sg.fillRect(CX0, CY0, CX1 - CX0, CY1 - CY0); sg.globalCompositeOperation = 'destination-out'; sg.drawImage(hole, 0, 0);
      const shade = mk(), shg = shade.getContext('2d'); shg.drawImage(solid, 0, 0); shg.globalCompositeOperation = 'source-in'; shg.fillStyle = '#000'; shg.fillRect(0, 0, W, H);
      const exposed = mk(), eg = exposed.getContext('2d'); eg.fillStyle = '#fff'; eg.fillRect(0, 0, W, H); eg.globalCompositeOperation = 'destination-out'; eg.drawImage(solid, 0, 0);
      const card = mk(), kg = card.getContext('2d'); kg.fillStyle = '#c9a97a'; kg.fillRect(CX0, CY0, CX1 - CX0, CY1 - CY0);
      for (let i = 0; i < 2500; i++) { kg.fillStyle = `rgba(${r() < 0.5 ? '120,90,50' : '255,240,210'},${r() * 0.12})`; kg.fillRect(CX0 + r() * (CX1 - CX0), CY0 + r() * (CY1 - CY0), 1 + r() * 4, 1); }
      kg.strokeStyle = 'rgba(90,60,30,0.5)'; kg.lineWidth = 2; kg.strokeRect(CX0 + 1, CY0 + 1, CX1 - CX0 - 2, CY1 - CY0 - 2);
      kg.globalCompositeOperation = 'destination-out'; kg.drawImage(hole, 0, 0); kg.globalCompositeOperation = 'source-over';
      kg.strokeStyle = 'rgba(70,45,20,0.55)'; kg.lineWidth = 1.5; kg.globalCompositeOperation = 'source-atop';
      const paint = mk(), pg = paint.getContext('2d'), tmp = mk(), tg = tmp.getContext('2d');
      // Drips start at the lowest painted pixel of a few columns.
      const hd = hg.getImageData(0, 0, W, H).data, drips = [];
      for (const x of [118, 196, 262, 341, 409, 488, 540]) { let yb = -1; for (let y = H - 1; y > 0; y--) if (hd[(y * W + x) * 4 + 3] > 200) { yb = y; break; } if (yb > 0) drips.push({ x, y: yb, len: 18 + r() * 46, t0: 5.0 + r() * 0.6 }); }
      const nozzle = lt => { const k = clamp01((lt - 0.7) / 3.0), pass = Math.min(2, Math.floor(k * 3)), f = k * 3 - pass, x = pass % 2 ? 600 - f * 560 : 40 + f * 560; return [x, CY0 + 34 + pass * 52 + Math.sin(f * 9) * 6]; };
      let lastLt = 0;
      return (t, dt) => {
        const lt = t % 8; if (lt < lastLt) pg.clearRect(0, 0, W, H); lastLt = lt;
        const spraying = lt > 0.7 && lt < 3.7, [nx, ny] = nozzle(lt);
        if (spraying) { const n = Math.round(650 * L.p.flow * Math.min(0.05, dt) * 60); for (let i = 0; i < n; i++) { const a = r() * 6.283, d = Math.sqrt(-2 * Math.log(r() + 1e-6)) * 24; pg.globalAlpha = 0.22 + r() * 0.45; pg.fillStyle = r() < 0.85 ? '#ff5a36' : '#e8401f'; const s = 0.8 + r() * 2.2; pg.fillRect(nx + Math.cos(a) * d, ny + Math.sin(a) * d * 1.15, s, s); } pg.globalAlpha = 1; }
        const lift = ease.inOut(seg(lt, 4.2, 5.2)), clean = ease.inOut(seg(lt, 7.0, 7.7));
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.drawImage(wall, 0, 0);
        tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, W, H); tg.drawImage(paint, 0, 0); tg.globalCompositeOperation = 'destination-in'; tg.drawImage(exposed, 0, 0);
        g.globalAlpha = 1 - clean; g.drawImage(tmp, 0, 0);
        for (const d of drips) { const k = ease.out(seg(lt, d.t0, d.t0 + 1.4)); if (k <= 0) continue; const y1 = d.y + d.len * k; g.fillStyle = '#ef4a28'; g.fillRect(d.x - 2, d.y - 2, 4, y1 - d.y + 2); g.beginPath(); g.arc(d.x, y1, 3.2, 0, 7); g.fill(); }
        g.globalAlpha = 1;
        if (lift < 1) {
          const ty = -300 * lift, rot = -0.18 * lift, sc = 1 + 0.1 * lift, cx = W / 2, cy = (CY0 + CY1) / 2;
          g.globalAlpha = 0.35 * (1 - lift * 0.6); g.fillStyle = '#000'; g.filter = `blur(${(3 + 14 * lift).toFixed(1)}px)`;
          g.setTransform(sc, 0, 0, sc, cx + 4 + 26 * lift, cy + ty * 0.8 + 5 + 30 * lift); g.rotate(rot); g.drawImage(shade, -cx, -cy); g.filter = 'none';
          g.globalAlpha = 1; g.setTransform(sc, 0, 0, sc, cx, cy + ty); g.rotate(rot); g.translate(-cx, -cy);
          g.drawImage(card, 0, 0);
          tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, W, H); tg.drawImage(paint, 0, 0); tg.globalCompositeOperation = 'destination-in'; tg.drawImage(solid, 0, 0);
          g.drawImage(tmp, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
        }
        if (spraying || (lt > 0.4 && lt < 0.7) || (lt > 3.7 && lt < 4.0)) {
          const cx = nx + 18, cy = ny - 64;
          const mist = g.createRadialGradient(nx, ny, 0, nx, ny, 40); mist.addColorStop(0, spraying ? 'rgba(255,120,90,0.35)' : 'rgba(0,0,0,0)'); mist.addColorStop(1, 'rgba(255,120,90,0)'); g.fillStyle = mist; g.fillRect(nx - 40, ny - 40, 80, 80);
          g.save(); g.translate(cx, cy); g.rotate(0.28);
          g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-12, -26, 30, 74);
          const cg2 = g.createLinearGradient(-15, 0, 15, 0); cg2.addColorStop(0, '#2a2a30'); cg2.addColorStop(0.4, '#5a5a66'); cg2.addColorStop(1, '#1c1c22'); g.fillStyle = cg2; g.beginPath(); g.roundRect(-15, -30, 30, 74, 6); g.fill();
          g.fillStyle = C.coral; g.fillRect(-15, -4, 30, 18); g.fillStyle = '#d9d6d0'; g.beginPath(); g.roundRect(-9, -42, 18, 13, 3); g.fill(); g.fillStyle = '#222'; g.fillRect(-3, -44, 6, 4);
          g.restore();
        }
      };
    },
  });

  let loupeGL = null;
  if (EX.G.gl) EX.add({
    cat: 'type', id: 't2-loupe', title: 'Magnifier over fine print', aka: 'loupe effect, lens magnification, microtext reveal, refraction lens', tool: 'WebGL2 fragment shader (lens mapping with chromatic aberration) on a canvas-drawn page texture', runs: 'GPU',
    notice: 'A printed page is drawn once at twice the stage resolution and uploaded as a texture. Inside the lens the shader reads the page closer to the lens center, which magnifies it, with a slight barrel bulge and red and blue read at slightly different scales near the rim. Microtext rules that look like grey lines turn into readable sentences as the loupe slides over them.',
    use: 'product detail callouts, "read the fine print" moments, banking and security features, editorial explainers',
    params: [{ key: 'mag', label: 'Magnification', min: 1.2, max: 4, step: 0.1, value: 2.4, unit: 'x' }],
    prompt: 'A magnifying loupe glides over a cream book page: Georgia heading and two columns of body text, a big coral "Ag" specimen, and grey hairline rules that are really 4 px microtext; inside the lens the page is magnified {mag} with a slight barrel bulge, chromatic fringing near the rim, a dark rim, a glossy highlight arc and a soft shadow with a handle, so the microtext becomes readable as the lens passes; slow Lissajous path with gentle easing.',
    setup(cv, L) {
      const G = EX.G, gl = G.gl, ctx = cv.getContext('2d');
      if (!loupeGL) {
        const pc = document.createElement('canvas'); pc.width = W * 2; pc.height = H * 2; const p = pc.getContext('2d'); p.scale(2, 2);
        p.fillStyle = '#f1ebdf'; p.fillRect(0, 0, W, H);
        p.fillStyle = '#2a2420'; p.font = `700 30px Georgia, serif`; p.fillText('The fine print', 36, 52);
        p.font = `italic 13px Georgia, serif`; p.fillStyle = '#7a6d60'; p.fillText('Notes on reading closely, set in Georgia', 38, 74);
        const body = 'Type is meant to be read at a glance, yet the best pages reward a second look. Margins breathe, rules align, and the smallest details carry the most care. Printers once hid tiny lines of text inside borders so that a copy could be told from the original. Here those lines are only four pixels tall. From a distance they read as grey hairlines; under the glass they speak.';
        p.font = `12px Georgia, serif`; p.fillStyle = '#3a332c';
        const words = body.split(' '); let line = '', y = 104; const colW = 300;
        for (const w of words) { const test = line ? line + ' ' + w : w; if (p.measureText(test).width > colW) { p.fillText(line, 38, y); y += 18; line = w; } else line = test; }
        p.fillText(line, 38, y);
        const micro = 'YOU FOUND THE FINE PRINT - EVERY LETTER WAS DRAWN ONCE INTO A CANVAS AND MAGNIFIED ON THE GPU - ';
        p.font = `600 4px ${MONO}`; p.fillStyle = '#6a625a';
        for (const [x, yy, w] of [[38, 262, 300], [38, 300, 300], [372, 300, 232], [38, 330, 566]]) { let s = ''; while (p.measureText(s).width < w) s += micro; p.save(); p.beginPath(); p.rect(x, yy - 5, w, 7); p.clip(); p.fillText(s, x, yy); p.restore(); }
        p.font = `500 10px ${MONO}`; p.fillStyle = '#7a6d60'; p.fillText('fig. 1  specimen', 372, 280);
        p.font = `700 150px Georgia, serif`; p.fillStyle = C.coral; p.fillText('Ag', 380, 246);
        p.strokeStyle = '#cbbfae'; p.lineWidth = 1; p.beginPath(); p.moveTo(356, 90); p.lineTo(356, 286); p.stroke();
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pc); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        loupeGL = {
          tex, prog: G.prog(`uniform sampler2D uPage; uniform vec2 uC; uniform float uR,uM;
            vec3 pg(vec2 p){ return texture(uPage,p/uRes).rgb; }
            float seg2(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
            void main(){ vec2 p=vUv*uRes, off=p-uC; float d=length(off)/uR;
              vec2 hd=normalize(vec2(.62,-.78)), h0=uC+hd*uR*1.02, h1=uC+hd*(uR+130.);
              vec3 col=pg(p);
              float sh=max(smoothstep(1.32,.95,length(p-uC-vec2(9.,-13.))/uR), smoothstep(16.,4.,seg2(p-vec2(9.,-13.),h0,h1))*.8);
              col*=1.-.28*sh*step(1.,d);
              float hdst=seg2(p,h0,h1); if(hdst<11.){ vec3 hc=mix(vec3(.10,.09,.11),vec3(.32,.30,.34),smoothstep(11.,0.,hdst)*.6+.2*sin(hdst*.3)); col=hc; }
              if(d<1.){ float k=(1./uM)*(1.+.16*d*d), ca=.018*d*d*d;
                col=vec3(pg(uC+off*k*(1.+ca)).r, pg(uC+off*k).g, pg(uC+off*k*(1.-ca)).b);
                col*=1.-.22*smoothstep(.7,1.,d); col+=vec3(.03,.035,.05)*(1.-d);
                vec2 n=off/uR; float arc=smoothstep(.06,.0,abs(length(n-vec2(.08,-.1))-.78))*smoothstep(-.2,.5,-n.x+n.y);
                col+=arc*.45; }
              float rim=smoothstep(.045,.0,abs(d-1.)-.012); col=mix(col,vec3(.13,.12,.14)+.25*smoothstep(-.5,.9,-off.x/uR+off.y/uR)*rim,rim);
              o=vec4(col,1); }`),
        };
      }
      const M = loupeGL;
      return t => {
        const u = t * 0.32, cx = 320 + 210 * Math.sin(u * 1.0 + 0.4), cy = 128 + 88 * Math.sin(u * 1.7 + 1.1);
        G.draw(M.prog, null, { uPage: M.tex, uC: [cx, cy], uR: 78, uM: L.p.mag }, W, H); G.copy(ctx, W, H);
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-flipdot', title: 'Flip-dot display', aka: 'flip-disc sign, electromechanical display, bus destination sign, dot matrix flip', tool: 'Canvas 2D (pre-rendered disc faces, scaled per flip angle)', runs: 'CPU',
    notice: 'Each disc has a yellow face and a black face. Messages are set once into the dot grid from a hand-written 5 x 7 pixel font, and when the message changes, only the discs that differ flip, in a wave that sweeps across the board with a little random delay. A flip is a disc squashed horizontally by the cosine of its angle, with the face switching halfway and a small rattle at the end.',
    use: 'transit and travel themes, retro signage, scoreboards, announcements with a mechanical feel',
    params: [{ key: 'wave', label: 'Wave delay per column', min: 0, max: 0.08, step: 0.005, value: 0.025, unit: ' s', dec: 3 }],
    prompt: 'Flip-dot display: a 60 x 17 board of round discs, yellow on one side and black on the other, on a dark panel with rivets; two-line messages in a 5 x 7 pixel font ("NEXT STOP / STUDIO 7", "MOTION / ON TIME", "GATE 7 / DEPARTS") change every 3 s, only changed discs flip, in a wave from left to right ({wave} per column plus a little random delay), each flip 0.14 s with a slight rattle, a soft glare sweeps across the board.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const COLS = 60, ROWS = 17, P = 10, R = 4.4, X0 = (W - COLS * P) / 2 + P / 2, Y0 = (H - ROWS * P) / 2 + P / 2 + 4;
      // 5 x 7 pixel font, one string of 35 bits per glyph (row by row).
      const FONT = { N: '10001110011010110011100011000110001', E: '11111100001000011110100001000011111', X: '10001100010101000100010101000110001', T: '11111001000010000100001000010000100', S: '01111100001000001110000010000111110', O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000', M: '10001110111010110101100011000110001', I: '01110001000010000100001000010001110', U: '10001100011000110001100011000101110', D: '11110100011000110001100011000111110', G: '01110100011000010111100011000101111', A: '01110100011000111111100011000110001', R: '11110100011000111110101001001010001', 7: '11111000010001000100010000100001000', ' ': '00000000000000000000000000000000000' };
      const msgs = [['NEXT STOP', 'STUDIO 7'], ['MOTION', 'ON TIME'], ['GATE 7', 'DEPARTS']];
      const bits = msgs.map(lines => {
        const b = new Uint8Array(COLS * ROWS);
        lines.forEach((ln, li) => { const x0 = Math.floor((COLS - (ln.length * 6 - 1)) / 2), y0 = 1 + li * 8; [...ln].forEach((ch, ci) => { const f = FONT[ch] || FONT[' ']; for (let k = 0; k < 35; k++) if (f[k] === '1') b[(y0 + Math.floor(k / 5)) * COLS + x0 + ci * 6 + (k % 5)] = 1; }); });
        return b;
      });
      const face = (col, rim) => { const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d'); const gr = x.createRadialGradient(9, 8, 1, 12, 12, 12); gr.addColorStop(0, rim); gr.addColorStop(1, col); x.fillStyle = gr; x.beginPath(); x.arc(12, 12, 11, 0, 7); x.fill(); return c; };
      const yel = face('#f2c21c', '#fff1a0'), blk = face('#141416', '#3a3a40');
      const r = EX.rng(5), jit = new Float32Array(COLS * ROWS).map(() => r() * 0.06);
      const panel = document.createElement('canvas'); panel.width = W; panel.height = H; const pgx = panel.getContext('2d');
      pgx.fillStyle = '#0e0e11'; pgx.fillRect(0, 0, W, H);
      pgx.fillStyle = '#1c1c21'; pgx.beginPath(); pgx.roundRect(X0 - P, Y0 - P - 4, COLS * P + P, ROWS * P + P + 8, 8); pgx.fill();
      pgx.fillStyle = '#26262c'; for (const [x, y] of [[X0 - P + 8, Y0 - P + 4], [X0 + COLS * P - 12, Y0 - P + 4], [X0 - P + 8, Y0 + ROWS * P - 6], [X0 + COLS * P - 12, Y0 + ROWS * P - 6]]) { pgx.beginPath(); pgx.arc(x, y, 3, 0, 7); pgx.fill(); }
      pgx.fillStyle = '#0a0a0c'; for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) { pgx.beginPath(); pgx.arc(X0 + i * P, Y0 + j * P, R + 0.8, 0, 7); pgx.fill(); }
      return t => {
        const cyc = 3, k = Math.floor(t / cyc), lt = t - k * cyc, cur = bits[k % 3], prev = bits[(k + 2) % 3], first = k === 0;
        g.drawImage(panel, 0, 0);
        for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
          const id = j * COLS + i, a = first ? 0 : prev[id], b = cur[id];
          let side = b, sx = 1;
          if (a !== b) {
            const f = clamp01((lt - 0.15 - i * L.p.wave - jit[id]) / 0.14);
            if (f < 1) { const ang = f * Math.PI; sx = Math.abs(Math.cos(ang)); side = ang < Math.PI / 2 ? a : b; }
            else { const q = lt - 0.29 - i * L.p.wave - jit[id]; sx = 1 - 0.25 * Math.exp(-q * 18) * Math.abs(Math.sin(q * 60)); }
          }
          const w = 2 * R * Math.max(0.08, sx);
          g.drawImage(side ? yel : blk, X0 + i * P - w / 2, Y0 + j * P - R, w, 2 * R);
        }
        const gx = ((t * 0.35) % 1.6 - 0.3) * W, gl = g.createLinearGradient(gx - 90, 0, gx + 90, 0);
        gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,255,0.07)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gl; g.fillRect(0, 0, W, H);
      };
    },
  });

  let flagGL = null;
  if (EX.G.gl) EX.add({
    cat: 'type', id: 't2-flag', title: 'Waving flag type', aka: 'flag wave, cloth banner text, fabric ripple, wind-blown banner', tool: 'WebGL2 fragment shader (procedural cloth waves + slope shading) on a canvas-drawn texture', runs: 'GPU',
    notice: 'The banner with its lettering is drawn once in a 2D canvas and uploaded as a texture. For every screen pixel the shader works out where on the cloth it lands: traveling waves push the cloth up and down more and more toward the free end, and the slope of the waves gives a normal that lights the folds and darkens the troughs. The letters bend, catch light and fall into shadow with the fabric.',
    use: 'sports and team graphics, national days and events, campaign banners, outdoor themes',
    params: [{ key: 'wind', label: 'Wind', min: 0, max: 2, step: 0.05, value: 1 }],
    prompt: 'Waving flag with lettering: a navy banner with coral, amber and cyan stripes at the hoist and the word "MOTION" in cream, hung from a metal pole against a soft dawn sky with drifting clouds; traveling waves grow toward the free end (wind {wind}), diagonal folds, highlights on crests and shade in the troughs, the type bending with the cloth, slight gravity sag, endless loop, done in one fragment shader.',
    setup(cv, L) {
      const G = EX.G, gl = G.gl, ctx = cv.getContext('2d');
      if (!flagGL) {
        const fc = document.createElement('canvas'); fc.width = 960; fc.height = 560; const f = fc.getContext('2d');
        f.fillStyle = '#1d1b3a'; f.fillRect(0, 0, 960, 560);
        [C.coral, C.amber, C.cyan].forEach((c, i) => { f.fillStyle = c; f.fillRect(0, i * 560 / 3, 120, 560 / 3 + 1); });
        f.fillStyle = 'rgba(244,239,230,0.12)'; f.fillRect(120, 0, 8, 560);
        f.font = `700 200px ${DISP}`; f.textAlign = 'center'; f.textBaseline = 'middle'; f.fillStyle = C.cream; f.fillText('MOTION', 545, 300);
        f.font = `600 34px ${DISP}`; f.fillStyle = C.amber; f.fillText('S T U D I O', 545, 140);
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fc); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        flagGL = {
          tex, prog: G.prog(`uniform sampler2D uFlag; uniform float uWind;
            float wave(float u,float v,float t){ float a=uWind*u*(.55+.45*u); return a*(.075*sin(u*9.-t*4.2+v*1.6)+.03*sin(u*17.-t*6.3-v*2.4)); }
            void main(){ vec2 p=vUv; p.x*=uRes.x/uRes.y; float t=uT;
              vec3 sky=mix(vec3(.98,.80,.66),vec3(.36,.52,.80),smoothstep(.0,1.,vUv.y));
              sky=mix(sky,vec3(1.,.97,.93),.35*smoothstep(.5,.85,fbm(vec2(vUv.x*3.-t*.03,vUv.y*6.))));
              vec3 col=sky;
              float px0=.24, fw=1.3, fh=.72, top=.86;
              float u=(p.x-px0)/fw;
              float sag=.05*u*u*(1.2-.5*uWind);
              float v=0.;
              for(int i=0;i<3;i++){ v=(top-p.y+wave(clamp(u,0.,1.),v,t)+sag)/fh; }
              float dz=(wave(u+.01,v,t)-wave(u-.01,v,t))/.02;
              if(u>0.&&u<1.&&v>0.&&v<1.){
                vec3 fl=texture(uFlag,vec2(u,1.-v)).rgb;
                float sh=.78+.5*clamp(-dz*1.6,-.6,.6);
                float spec=pow(max(0.,-dz*1.2),3.)*.22;
                vec3 c2=fl*sh+spec*vec3(1.,.9,.8);
                float e=min(min(u,1.-u)*fw,min(v,1.-v)*fh)*uRes.y; c2=mix(sky,c2,smoothstep(0.,1.2,e));
                col=c2;
              } else {
                float sv=(top-.025-p.y+wave(clamp(u,0.,1.),0.5,t)+sag)/fh;
                if(u>0.&&u<1.&&sv>0.&&sv<1.) col*=.86;
              }
              float pd=abs(p.x-(px0-.012)); if(pd<.012&&p.y<top+.04){ float k=pd/.012; col=mix(vec3(.85,.85,.88),vec3(.35,.35,.4),k*k)*(0.8+.2*sin(p.y*3.)); }
              float bd=length(p-vec2(px0-.012,top+.055)); if(bd<.024) col=mix(vec3(1.,.85,.4),vec3(.6,.42,.1),bd/.024);
              o=vec4(col,1); }`),
        };
      }
      const M = flagGL;
      return t => { G.draw(M.prog, null, { uFlag: M.tex, uWind: L.p.wind, uT: t }, W, H); G.copy(ctx, W, H); };
    },
  });

  EX.add({
    cat: 'type', id: 't2-wordclock', title: 'Word clock', aka: 'text clock, letter grid clock, time in words, typographic clock', tool: 'Canvas 2D (letter grid, word lookup, staggered fades)', runs: 'CPU',
    notice: 'A fixed grid of letters spells every phrase a clock needs. The time is rounded to five minutes, turned into words ("IT IS TWENTY PAST SEVEN"), and only the cells of those words light up. When the phrase changes, old letters fade out and new ones fade in one after another in reading order, and four corner dots count the minutes in between.',
    use: 'ambient displays, smart home and watch faces, editorial countdowns, calm "time" moments',
    params: [{ key: 'rate', label: 'Time-lapse', min: 1, max: 6, step: 0.5, value: 2.5, unit: ' min/s' }],
    controls: [{ label: 'Time-lapse', on: true, fn: L => { L.state.real = false; } }, { label: 'Real time', fn: L => { L.state.real = true; } }],
    prompt: 'Word clock: a 12 x 10 grid of letters on dark slate where only the words of the current time light up ("IT IS QUARTER PAST SIX"), rounded to five minutes, four corner dots for the minutes in between; when the phrase changes, old letters fade out and new letters fade in with a 40 ms stagger in reading order, lit letters warm white with a soft glow, unlit letters barely visible; time-lapse at {rate} or real time.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const st = (L.state = L.state || { real: false });
      const GRID = ['ITXISZFIVEMK', 'TENQUARTERLA', 'TWENTYHALFYO', 'PASTEBTOWNIX', 'ONETWOTHREEF', 'FOURFIVESIXA', 'SEVENEIGHTUR', 'NINEKTENRAYS', 'ELEVENTWELVE', 'MOTIONOCLOCK'];
      const WD = { IT: [0, 0, 2], IS: [0, 3, 2], M5: [0, 6, 4], M10: [1, 0, 3], QUARTER: [1, 3, 7], TWENTY: [2, 0, 6], HALF: [2, 6, 4], PAST: [3, 0, 4], TO: [3, 6, 2], OCLOCK: [9, 6, 6], MOTION: [9, 0, 6] };
      const HR = [[8, 6, 6], [4, 0, 3], [4, 3, 3], [4, 6, 5], [5, 0, 4], [5, 4, 4], [5, 8, 3], [6, 0, 5], [6, 5, 5], [7, 0, 4], [7, 5, 3], [8, 0, 6]];
      const MIN = [[], ['M5', 'PAST'], ['M10', 'PAST'], ['QUARTER', 'PAST'], ['TWENTY', 'PAST'], ['TWENTY', 'M5', 'PAST'], ['HALF', 'PAST'], ['TWENTY', 'M5', 'TO'], ['TWENTY', 'TO'], ['QUARTER', 'TO'], ['M10', 'TO'], ['M5', 'TO']];
      const CW = 42, CH = 30, GX = (W - 12 * CW) / 2 + CW / 2, GY = (H - 10 * CH) / 2 + CH / 2 + 2;
      const litFor = (mins, intro) => {
        const on = new Uint8Array(120), m5 = Math.floor((mins % 60) / 5); let h = Math.floor(mins / 60) % 12; if (m5 >= 7) h = (h + 1) % 12;
        const mark = (/** @type {number[]} */ w) => { for (let k = 0; k < w[2]; k++) on[w[0] * 12 + w[1] + k] = 1; };
        mark(WD.IT); mark(WD.IS); MIN[m5].forEach(w => mark(WD[w])); mark(HR[h]); if (m5 === 0) mark(WD.OCLOCK); if (intro) mark(WD.MOTION);
        return on;
      };
      const level = new Float32Array(120); let shown = null, changeAt = 0, prevOn = new Uint8Array(120), simMin = 6 * 60 + 52, lastT = 0;
      const bgG = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 420); bgG.addColorStop(0, '#24252c'); bgG.addColorStop(1, '#101115');
      return t => {
        let mins;
        if (st.real) { const d = new Date(); mins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
        else { simMin += (t - lastT) * L.p.rate; mins = simMin; }
        lastT = t;
        const on = litFor(mins, !st.real && t < 1.2), key = on.join('');
        if (key !== shown) { if (shown !== null) { prevOn = Uint8Array.from(shown, ch => +ch); } shown = key; changeAt = t; }
        g.fillStyle = bgG; g.fillRect(0, 0, W, H);
        g.font = `600 21px ${DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        let order = 0;
        for (let i = 0; i < 120; i++) {
          let target;
          if (on[i]) { const k = clamp01((t - changeAt - (prevOn[i] ? 0 : 0.18 + order * 0.04)) / 0.25); target = prevOn[i] ? 1 : k; if (!prevOn[i]) order++; }
          else target = prevOn[i] ? 1 - clamp01((t - changeAt) / 0.3) : 0;
          level[i] = target;
          const x = GX + (i % 12) * CW, y = GY + Math.floor(i / 12) * CH, ch = GRID[Math.floor(i / 12)][i % 12];
          g.shadowBlur = 0; g.fillStyle = '#34353d'; g.fillText(ch, x, y);
          if (level[i] > 0.01) { g.globalAlpha = level[i]; g.shadowColor = 'rgba(255,214,160,0.9)'; g.shadowBlur = 14; g.fillStyle = '#fff4e2'; g.fillText(ch, x, y); g.shadowBlur = 0; g.globalAlpha = 1; }
        }
        const extra = Math.floor(mins % 5);
        [[22, 22], [W - 22, 22], [W - 22, H - 22], [22, H - 22]].forEach(([x, y], k) => { g.fillStyle = k < extra ? '#fff4e2' : '#34353d'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); });
        g.textAlign = 'left';
      };
    },
  });



  let pressGL = null;
  if (EX.G.gl) EX.add({
    cat: 'type', id: 't2-letterpress', title: 'Letterpress under moving light', aka: 'deboss, emboss, blind press, raking light type, paper relief', tool: 'WebGL2 fragment shader (height field from blurred text, normals, ray-marched self-shadow)', runs: 'GPU',
    notice: 'The type is drawn once into a canvas and blurred a little, and the shader reads that blur as a height field pressed into paper. Normals come from the slope, a low raking light circles the sheet, and a short march toward the light checks whether the wall of a letter blocks it, so the debossed letters get sharp shadows on one side and bright rims on the other as the light moves. The raised seal uses the same field with the sign flipped.',
    use: 'stationery, wedding and luxury brands, packaging mockups, premium print reveals',
    params: [{ key: 'depth', label: 'Press depth', min: 0.2, max: 2.5, step: 0.05, value: 1.2 }],
    controls: [{ label: 'Inked', on: true, fn: L => { L.state.ink = 1; } }, { label: 'Blind press', fn: L => { L.state.ink = 0; } }],
    prompt: 'Letterpress under a moving light: "Letterpress" in Georgia italic and a small caps line debossed into thick cotton paper (press depth {depth}), plus a raised round seal, lit by a warm low raking light that circles the sheet every 8 s; normals from the height field, sharp self-shadows inside the letter walls and bright rims on the lit side, subtle paper fibers, coral ink in the impressions or blind press, all in one fragment shader.',
    setup(cv, L) {
      const G = EX.G, gl = G.gl, ctx = cv.getContext('2d'); const st = (L.state = L.state || { ink: 1 });
      if (!pressGL) {
        const hc = document.createElement('canvas'); hc.width = W * 2; hc.height = H * 2; const h = hc.getContext('2d'); h.scale(2, 2);
        h.fillStyle = '#000'; h.fillRect(0, 0, W, H); h.filter = 'blur(1.6px)'; h.fillStyle = '#f00'; h.textAlign = 'center';
        h.font = `italic 700 78px Georgia, serif`; h.fillText('Letterpress', 268, 172);
        h.font = `600 15px ${DISP}`; h.fillText('F I N E   P R I N T I N G   S I N C E   T O D A Y', 268, 216);
        h.fillRect(148, 240, 240, 2.5);
        h.filter = 'blur(1.4px)'; h.strokeStyle = '#0f0'; h.lineWidth = 5; h.beginPath(); h.arc(552, 262, 44, 0, 7); h.stroke(); h.lineWidth = 1.5; h.beginPath(); h.arc(552, 262, 36, 0, 7); h.stroke();
        h.fillStyle = '#0f0'; h.font = `700 36px Georgia, serif`; h.textBaseline = 'middle'; h.fillText('M', 552, 265);
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, hc); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        pressGL = {
          tex, prog: G.prog(`uniform sampler2D uH; uniform float uDepth,uInk;
            float H(vec2 p){ vec4 c=texture(uH,p/uRes); return (-c.r+.6*c.g)*uDepth*6.; }
            void main(){ vec2 p=vUv*uRes; float t=uT*.785;
              vec3 lp=vec3(320.+360.*cos(t),180.+200.*sin(t),95.);
              float h=H(p), hx=H(p+vec2(1,0))-H(p-vec2(1,0)), hy=H(p+vec2(0,1))-H(p-vec2(0,1));
              vec3 n=normalize(vec3(-hx*.5,-hy*.5,1.)), P=vec3(p,h), Ld=normalize(lp-P);
              float sh=1.; for(int i=1;i<=12;i++){ vec3 q=P+Ld*float(i)*2.2; float hq=H(q.xy); if(hq>q.z+.05) sh=min(sh,.25+.75*smoothstep(1.,.0,hq-q.z)); }
              float dif=max(dot(n,Ld),0.), spec=pow(max(dot(reflect(-Ld,n),vec3(0,0,1)),0.),24.);
              float fib=fbm(p*vec2(.09,.05))*.06+vnoise(p*.9)*.03;
              vec3 paper=vec3(.95,.92,.86)-fib;
              float inside=smoothstep(.45,.75,texture(uH,p/uRes).r);
              vec3 base=mix(paper,mix(paper,vec3(.86,.28,.18),.9),inside*uInk);
              vec3 col=base*(.6+.55*dif*sh)*(.82+.18*sh)+spec*.18*sh*vec3(1.,.9,.75);
              float fall=1.-.35*smoothstep(150.,520.,length(p-lp.xy)); col*=fall*vec3(1.04,.99,.92);
              o=vec4(col,1); }`),
        };
      }
      const M = pressGL;
      return t => { G.draw(M.prog, null, { uH: M.tex, uDepth: L.p.depth, uInk: st.ink, uT: t }, W, H); G.copy(ctx, W, H); };
    },
  });

  let scapeGL = null;
  if (EX.G.gl) EX.add({
    cat: 'type', id: 't2-typescape', title: 'Typescape flyover', aka: 'type as architecture, extruded word city, text height field, monumental type', tool: 'WebGL2 fragment shader (height-field ray marching on a canvas-drawn texture)', runs: 'GPU',
    notice: 'Words are drawn once into a canvas and read as a height map, so every letter becomes a monolith standing on a sandy plain. Each pixel marches a ray from a gliding camera until it drops below the height field, then lights the hit with a low sun, a second march toward the sun for hard shadows, and haze with distance. The texture repeats along the flight path, so the flyover never ends.',
    use: 'architecture and real estate titles, epic intros, brand worlds, conference openers',
    params: [{ key: 'tall', label: 'Letter height', min: 0.1, max: 0.9, step: 0.05, value: 0.4 }],
    prompt: 'Typescape flyover: big words ("MOTION", "TYPE", "FORM", "LIGHT") extruded as monolithic cream blocks on a warm sand plain, a low golden sun casting long hard shadows, a camera gliding low over the letters with a gentle sway, haze in the distance, ray-marched from a height map drawn in a 2D canvas (letter height {tall}), endless loop.',
    setup(cv, L) {
      const G = EX.G, gl = G.gl, ctx = cv.getContext('2d');
      if (!scapeGL) {
        const S = 1024, hc = document.createElement('canvas'); hc.width = S; hc.height = S; const h = hc.getContext('2d');
        h.fillStyle = '#000'; h.fillRect(0, 0, S, S); h.textAlign = 'center'; h.textBaseline = 'middle';
        // height = red channel; letters at different heights read as a skyline
        h.fillStyle = '#fff'; h.font = `700 250px ${DISP}`; h.fillText('MOTION', S / 2, 170);
        h.fillStyle = '#b0b0b0'; h.font = `700 210px ${DISP}`; h.fillText('TYPE', S * 0.3, 450); h.fillStyle = '#d0d0d0'; h.fillText('FORM', S * 0.72, 640);
        h.fillStyle = '#909090'; h.font = `700 190px ${DISP}`; h.fillText('LIGHT', S / 2, 870);
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, hc);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        scapeGL = {
          tex, prog: G.prog(`uniform sampler2D uH; uniform float uTall;
            float Hf(vec2 xz){ vec2 uv=vec2(xz.x/8.+.5, -xz.y/8.); if(uv.x<0.||uv.x>1.) return 0.; return texture(uH,uv).r*uTall; }
            void main(){ vec2 sp=(vUv-.5)*vec2(uRes.x/uRes.y,1.); float t=uT;
              vec3 ro=vec3(sin(t*.2)*1.1, 2.1+.15*sin(t*.27), t*.8);
              vec3 fw=normalize(vec3(-sin(t*.2)*.22, -.47, 1.)), rt=normalize(cross(vec3(0,1,0),fw)), up=cross(fw,rt);
              vec3 rd=normalize(fw*1.45+rt*sp.x+up*sp.y);
              vec3 sun=normalize(vec3(-.8,.38,.4));
              vec3 sky=mix(vec3(1.,.8,.58),vec3(.48,.58,.8),clamp(rd.y*2.5+.25,0.,1.));
              vec3 col=sky;
              if(rd.y<0.){
                float d=max(0.,(ro.y-uTall-.01)/(-rd.y)), dg=ro.y/(-rd.y), kind=0.; vec3 p;
                for(int i=0;i<160;i++){ p=ro+rd*d; if(d>=dg){ d=dg; kind=1.; break; } if(p.y<Hf(p.xz)){ kind=2.; break; } d+=.022; }
                if(kind>1.){ float a=d-.022, b=d; for(int k=0;k<7;k++){ float m=(a+b)*.5; vec3 q=ro+rd*m; if(q.y<Hf(q.xz)) b=m; else a=m; } d=b; }
                p=ro+rd*d;
                vec3 n=vec3(0,1,0), alb=vec3(.87,.7,.52)*(.92+.08*vnoise(p.xz*7.));
                if(kind>1.){ float hh=Hf(p.xz), e=.012; alb=mix(vec3(.93,.88,.8),vec3(.99,.96,.91),hh/uTall);
                  if(hh-p.y>.012){ vec2 g=vec2(Hf(p.xz+vec2(e,0))-Hf(p.xz-vec2(e,0)), Hf(p.xz+vec2(0,e))-Hf(p.xz-vec2(0,e))); if(length(g)>1e-4) n=normalize(vec3(-g.x,0.,-g.y)); } }
                float sh=1., s=.03; for(int j=0;j<40;j++){ vec3 q=p+vec3(0,.004,0)+sun*s; if(q.y>uTall) break; if(q.y<Hf(q.xz)){ sh=0.; break; } s+=.025; }
                float dif=max(dot(n,sun),0.);
                vec3 lit=alb*(vec3(.36,.38,.5)+vec3(1.2,.98,.78)*dif*sh);
                col=mix(lit,sky,1.-exp(-d*.085)); }
              o=vec4(col,1); }`),
        };
      }
      const M = scapeGL;
      return t => { G.draw(M.prog, null, { uH: M.tex, uTall: L.p.tall, uT: t }, W, H); G.copy(ctx, W, H); };
    },
  });

  let bleedGL = null;
  if (EX.G.gl && EX.G.floatOK) EX.add({
    cat: 'type', id: 't2-inkbleed', title: 'Ink bleed type', aka: 'wet ink spread, watercolor bleed, feathering ink, blotting paper', tool: 'WebGL2 fragment shaders (ping-pong float textures: water and pigment)', runs: 'GPU',
    notice: 'Each pixel holds two numbers, water and pigment, in a float texture that is updated three times per frame. Water creeps into dry neighbors at random moments, favoring a fixed pattern of paper fibers, and slowly evaporates; pigment is carried only into wet paper and weakens with every pixel it travels. The result is lettering that feathers out unevenly, with dark cores, soft blue fringes and granulation in the paper.',
    use: 'stationery and craft brands, poetry and literature, calligraphy, organic or handmade moods',
    params: [{ key: 'spread', label: 'Wetness', min: 0.2, max: 1, step: 0.05, value: 0.7 }],
    prompt: 'Ink bleed type: the word "bleed" in heavy italic serif is stamped in wet indigo ink on cotton paper and feathers outward for 5 s along the paper fibers (wetness {spread}), water spreads faster than pigment so the edges go soft and blue while the cores stay near-black, granulation in the pigment, the spread slows as the paper dries; GPU simulation with water and pigment in a float texture, paper fades back and it restamps every 9 s.',
    setup(cv, L) {
      const G = EX.G, gl = G.gl, ctx = cv.getContext('2d');
      if (!bleedGL) {
        const tc = document.createElement('canvas'); tc.width = W; tc.height = H; const tg = tc.getContext('2d');
        tg.fillStyle = '#000'; tg.fillRect(0, 0, W, H); tg.fillStyle = '#fff'; tg.textAlign = 'center'; tg.textBaseline = 'middle';
        tg.font = `italic 700 180px Georgia, serif`; tg.fillText('bleed', W / 2, 170);
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        bleedGL = {
          tex, pp: G.pingpong(W, H, true, false),
          init: G.prog(`uniform sampler2D uTxt; void main(){ float k=texture(uTxt,vUv).r; o=vec4(k,k,0,1); }`),
          step: G.prog(`uniform sampler2D uS; uniform float uSpread,uStep;
            void main(){ vec2 px=1./uRes, ip=floor(vUv*uRes); vec4 c=texture(uS,vUv);
              float a=hash21(ip), b=hash21(ip+vec2(17.,31.)), f=fbm(vUv*vec2(7.,4.)+vec2(3.1,1.7));
              float wx=.95+.05*a, wy=.95+.05*b;
              vec4 l=texture(uS,vUv-vec2(px.x,0)), r=texture(uS,vUv+vec2(px.x,0)), d=texture(uS,vUv-vec2(0,px.y)), u=texture(uS,vUv+vec2(0,px.y));
              float wN=max(max(l.r,r.r)*wx,max(d.r,u.r)*wy)*.992;
              float nw=c.r; if(wN>nw&&hash21(ip+vec2(uStep*.37,uStep*.11))<uSpread*.25*(.05+.95*f*f)) nw=wN;
              nw=max(0.,nw-.0009);
              float gN=max(max(l.g,r.g),max(d.g,u.g))*(.935+.06*a*b);
              float ng=c.g; if(nw>.08&&gN>ng) ng=mix(ng,gN,.5);
              o=vec4(nw,ng,0,1); }`),
          show: G.prog(`uniform sampler2D uS; uniform float uFade;
            void main(){ vec4 c=texture(uS,vUv); float g=c.g*uFade, w=c.r*uFade;
              vec3 paper=vec3(.965,.945,.905)-.05*fbm(vUv*vec2(60.,34.))-.02*vnoise(vUv*vec2(400.,40.));
              float k=clamp(g*(.8+.4*vnoise(vUv*vec2(520.,290.))),0.,1.);
              vec3 ink=mix(vec3(.3,.38,.72),vec3(.06,.06,.16),smoothstep(.15,.85,k));
              vec3 col=mix(paper,ink,smoothstep(0.,.95,k)*.97);
              col*=1.-.2*smoothstep(.05,.4,w)*vec3(1.,.96,.88);
              o=vec4(col,1); }`),
        };
      }
      const M = bleedGL; let lastLt = 1e9, stepN = 0;
      return t => {
        const lt = t % 9;
        if (lt < lastLt) { G.draw(M.init, M.pp.write, { uTxt: M.tex }); M.pp.swap(); }
        lastLt = lt;
        if (lt < 6.5) for (let i = 0; i < 3; i++) { G.draw(M.step, M.pp.write, { uS: M.pp.read, uSpread: L.p.spread, uStep: (stepN++ % 997) }); M.pp.swap(); }
        G.draw(M.show, null, { uS: M.pp.read, uFade: 1 - seg(lt, 8.2, 8.95) }, W, H); G.copy(ctx, W, H);
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-drum', title: 'Rolling word headline', aka: 'rotating words, word drum, text roller, slot-machine headline', tool: 'Canvas 2D (words on a virtual cylinder, ghost copies for motion blur)', runs: 'CPU',
    notice: 'The changing word sits on a virtual drum: every option is placed at an angle around a horizontal axis, so its height and opacity follow the cosine of that angle. Every 1.6 s the drum turns one step with an overshoot, ghost copies at slightly earlier angles add motion blur only while it spins, and the rest of the sentence slides to make room as the word width eases to the new size.',
    use: 'website heroes, agency reels, product taglines, "we do X" statements',
    params: [{ key: 'blur', label: 'Motion blur', min: 0, max: 1, step: 0.05, value: 0.6 }],
    prompt: 'Rolling word headline: "We design [motion / type / shaders / stories / systems]." in large sans on near-black, the bracketed word sits on a 3D drum and rolls up to the next option every 1.6 s with ease-out-back overshoot, words foreshorten and fade as they turn away, motion blur ghosts during the spin (strength {blur}), the period and the line re-center smoothly as the word width changes, coral drum word with an underline that redraws.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const WORDS = ['motion', 'type', 'shaders', 'stories', 'systems'], N = WORDS.length;
      const FS = 64, font = `700 ${FS}px ${DISP}`, R = 66, STEP = Math.PI / 3;
      g.font = font; const wid = WORDS.map(w => g.measureText(w).width), lead = 'We design', lw = g.measureText(lead + ' ').width, dot = g.measureText('.').width;
      const posAt = tt => { const k = Math.floor(tt / 1.6), f = tt - k * 1.6; return k + ease.back(seg(f, 0.9, 1.45)); };
      return t => {
        const pos = posAt(t), cur = Math.floor(pos), fr = pos - cur;
        const ww = wid[cur % N] + (wid[(cur + 1) % N] - wid[cur % N]) * clamp01(fr), total = lw + ww + dot, x0 = W / 2 - total / 2, cy = H / 2 + 6;
        g.fillStyle = '#0d0c12'; g.fillRect(0, 0, W, H);
        g.font = font; g.textBaseline = 'middle'; g.textAlign = 'left';
        g.fillStyle = C.cream; g.fillText(lead, x0, cy); g.fillText('.', x0 + lw + ww, cy);
        const vel = Math.abs(posAt(t) - posAt(t - 1 / 60)) * 60, ghosts = L.p.blur > 0 && vel > 0.4 ? 5 : 0;
        g.save(); g.beginPath(); g.rect(x0 + lw - 10, cy - R - 26, Math.max(...wid) + 40, 2 * R + 52); g.clip();
        for (let gh = ghosts; gh >= 0; gh--) {
          const p = pos - gh * vel * 0.006 * L.p.blur; const a0 = gh ? 0.16 * L.p.blur : 1;
          for (let i = Math.floor(p) - 2; i <= Math.floor(p) + 3; i++) {
            const phi = (i - p) * STEP; if (Math.abs(phi) >= Math.PI / 2) continue;
            const cs = Math.cos(phi), y = cy + Math.sin(phi) * R;
            g.globalAlpha = a0 * Math.pow(cs, 4); g.setTransform(1, 0, 0, cs, x0 + lw, y);
            g.fillStyle = C.coral; g.fillText(WORDS[((i % N) + N) % N], 0, 0);
          }
        }
        g.restore(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
        const lt = t % 1.6, ul = lt < 0.9 ? ease.out(seg(lt, 0.0, 0.45)) : 1 - ease.inOut(seg(lt, 0.75, 0.95));
        g.fillStyle = C.coral; g.fillRect(x0 + lw, cy + FS * 0.48, ww * ul, 4);
        g.fillStyle = 'rgba(244,239,230,0.28)'; g.fillRect(x0 + lw - 6, cy - R - 2, 1, 2 * R + 4);
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-rackfocus', title: 'Rack focus type', aka: 'depth of field type, focus pull, bokeh title, layered depth typography', tool: 'Canvas 2D (per-layer blur from a thin-lens formula, drawn bokeh discs, parallax)', runs: 'CPU',
    notice: 'Three layers of type sit at different distances from a slowly drifting camera, so they slide past each other with parallax. A focus distance moves between the layers with eased holds, and each layer is blurred by how far its depth is from focus (the thin-lens circle of confusion). The lights in the background are drawn as discs that grow with that blur, which is what turns points into bokeh.',
    use: 'cinematic titles, interviews and documentaries, "focus" and clarity messages, premium product intros',
    params: [{ key: 'ap', label: 'Aperture (blur strength)', min: 0.2, max: 2, step: 0.05, value: 1 }],
    prompt: 'Rack focus title: three layers of type at different depths (a huge coral "FOCUS" close to the lens, "on what matters" in cream in the middle, a far wall of small grey words with warm city lights), slow lateral camera drift with parallax, the focus pulls near, middle, far and back with eased holds, blur per layer from the thin-lens circle of confusion (aperture {ap}), background lights bloom into round bokeh discs when out of focus, small focus-distance readout.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const r = EX.rng(19);
      const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
      const far = mk(W + 120, H), fg2 = far.getContext('2d'); fg2.font = `600 15px ${DISP}`; fg2.fillStyle = '#6b6f80';
      const words = 'light depth lens frame focus blur grain shadow color depth space time motion story edit cut scene'.split(' ');
      for (let y = 30; y < H; y += 26) { let x = (y * 7) % 40 - 20; while (x < far.width) { const w = words[(r() * words.length) | 0]; fg2.globalAlpha = 0.35 + r() * 0.4; fg2.fillText(w, x, y); x += fg2.measureText(w).width + 18; } }
      const lights = /** @type {[number, number, number, string][]} */ ([...Array(26)].map(() => [r() * (W + 120), 40 + r() * 280, 0.4 + r() * 0.6, r() < 0.5 ? '255,176,32' : '255,120,80']));
      const mid = mk(W + 60, H), mg2 = mid.getContext('2d'); mg2.font = `500 44px Georgia, serif`; mg2.textAlign = 'center'; mg2.fillStyle = C.cream; mg2.fillText('on what matters', (W + 60) / 2, 236);
      const near = mk(W + 240, H), ng = near.getContext('2d'); ng.font = `700 190px ${DISP}`; ng.textAlign = 'center'; ng.fillStyle = C.coral; ng.fillText('FOCUS', (W + 240) / 2, 160);
      // depths in meters; the drift moves near layers more than far ones
      const D = [0.7, 2.2, 9], FK = [0.7, 2.2, 9, 2.2];
      const focusAt = tt => { const cyc = 8, k = Math.floor(tt / 2) % 4, f = (tt % cyc) % 2, a = FK[k], b = FK[(k + 1) % 4]; return a + (b - a) * ease.inOut(seg(f, 1.2, 2)); };
      const coc = (d, f) => Math.min(26, L.p.ap * 14 * Math.abs(1 / d - 1 / f) / (1 / 0.5));
      return t => {
        const f = 1 / (1 / focusAt(t)), drift = Math.sin(t * 0.35);
        g.filter = 'none'; g.globalAlpha = 1;
        const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#15131c'); bg.addColorStop(1, '#0a090e'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
        const bf = coc(D[2], f), bm = coc(D[1], f), bn = coc(D[0], f);
        g.filter = bf > 0.4 ? `blur(${bf.toFixed(1)}px)` : 'none'; g.drawImage(far, -60 + drift * 12, 0); g.filter = 'none';
        for (const [x, y, s, col] of lights) { const rad = 1.4 + bf * 0.9 * s, a = Math.min(0.9, 2.2 / (rad * 0.6 + 1)); g.fillStyle = `rgba(${col},${a.toFixed(3)})`; g.beginPath(); g.arc(x - 60 + drift * 12, y, rad, 0, 7); g.fill(); if (bf > 2) { g.strokeStyle = `rgba(${col},${(a * 0.6).toFixed(3)})`; g.lineWidth = 1; g.stroke(); } }
        g.filter = bm > 0.4 ? `blur(${bm.toFixed(1)}px)` : 'none'; g.drawImage(mid, -30 + drift * 34, 0);
        g.filter = bn > 0.4 ? `blur(${bn.toFixed(1)}px)` : 'none'; g.drawImage(near, -120 + drift * 90, 0); g.filter = 'none';
        g.font = `500 11px ${MONO}`; g.fillStyle = 'rgba(244,239,230,0.55)'; g.textBaseline = 'middle'; g.fillText(`focus ${f.toFixed(2)} m   f/${(1.4 / L.p.ap).toFixed(1)}`, 14, H - 14);
        g.fillStyle = 'rgba(244,239,230,0.2)'; g.fillRect(W - 174, H - 15, 160, 1); g.fillStyle = C.amber; g.fillRect(W - 174 + 160 * clamp01(Math.log(f / 0.6) / Math.log(10 / 0.6)), H - 19, 2, 9);
      };
    },
  });

  EX.add({
    cat: 'type', id: 't2-ransom', title: 'Ransom-note collage', aka: 'cut-out letters, magazine collage type, stop-motion type, zine lettering', tool: 'Canvas 2D (pre-cut letter sprites, stepped time at 12 fps, boil jitter)', runs: 'CPU',
    notice: 'Every letter is cut once into its own sprite: a random typeface, weight, color and a paper scrap with uneven edges. Time is rounded down to steps of 1/12 s, so the letters slap down on twos like stop motion, and on every step each scrap jitters a little ("boil") so the still frame keeps living. At the end they are swept off in the same choppy rhythm.',
    use: 'zines and punk aesthetics, music and fashion promos, playful campaign titles, social posts',
    params: [{ key: 'fps', label: 'Stop-motion rate', min: 6, max: 30, step: 1, value: 12, unit: ' fps' }],
    prompt: 'Ransom-note collage: "MAKE IT MOVE" built from letters cut out of magazines, each on its own scrap with a different typeface, weight, color and slight tilt, slapped onto off-white paper one by one with a tiny scale-down settle, animated on stepped time at {fps} like stop motion, every scrap boils with small random jitter on each step, soft drop shadows, then swept off and rebuilt, 7 s loop.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const r = EX.rng(31);
      const FONTS = [`700 ${'$'}px Georgia, serif`, `italic 700 ${'$'}px Georgia, serif`, `700 ${'$'}px ${DISP}`, `300 ${'$'}px ${DISP}`, `700 ${'$'}px "Segoe Print", serif`, `700 ${'$'}px Consolas, monospace`, `900 ${'$'}px "Segoe UI", sans-serif`];
      const PAPERS = [['#f4efe6', '#1b1a22'], ['#ffd23a', '#1b1a22'], ['#1b1a22', '#f4efe6'], ['#ff5a36', '#fff'], ['#2bc4e6', '#101020'], ['#e9e2d0', '#c4302b'], ['#7a5cff', '#fff'], ['#ffffff', '#ff5a36']];
      const LINES = ['MAKE IT', 'MOVE'];
      const pieces = [];
      LINES.forEach((ln, li) => {
        const row = [];
        for (const ch of ln) {
          if (ch === ' ') { row.push(null); continue; }
          const fs = 58 + r() * 34, font = FONTS[(r() * FONTS.length) | 0].replace('$', fs.toFixed(0)), [pc, ic] = PAPERS[(r() * PAPERS.length) | 0];
          const c = document.createElement('canvas'), x = c.getContext('2d'); x.font = font;
          const lc = r() < 0.25 ? ch.toLowerCase() : ch, m = x.measureText(lc), w = Math.ceil(m.width + 22), h = Math.ceil(fs * 1.12);
          c.width = w + 12; c.height = h + 12; x.translate(6, 6);
          x.fillStyle = pc; x.beginPath(); const n = 9; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; const px = w / 2 + Math.sign(Math.cos(a)) * Math.min(1, Math.abs(Math.cos(a)) * 1.6) * (w / 2 - r() * 4), py = h / 2 + Math.sign(Math.sin(a)) * Math.min(1, Math.abs(Math.sin(a)) * 1.6) * (h / 2 - r() * 4); x.lineTo(px, py); } x.closePath(); x.fill();
          x.globalAlpha = 0.08; x.fillStyle = '#000'; for (let yy = 2; yy < h; yy += 3) x.fillRect(0, yy, w, 1); x.globalAlpha = 1;
          x.font = font; x.fillStyle = ic; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(lc, w / 2, h / 2 + fs * 0.04);
          row.push({ c, w: c.width, h: c.height, rot: (r() - 0.5) * 0.28, dy: (r() - 0.5) * 12 });
        }
        pieces.push(row);
      });
      // Lay out each line centered with small overlaps, then give every piece an arrival time.
      const all = [];
      pieces.forEach((row, li) => {
        const tot = row.reduce((s, p) => s + (p ? p.w - 10 : 26), 0); let x = W / 2 - tot / 2;
        row.forEach(p => { if (!p) { x += 26; return; } p.x = x + p.w / 2; p.y = (li ? 248 : 128) + p.dy; x += p.w - 10; all.push(p); });
      });
      all.forEach((p, i) => { p.t0 = 0.3 + i * 0.22 + r() * 0.06; p.out = 5.5 + r() * 0.4; p.ox = (r() - 0.5) * 900; p.oy = -300 - r() * 200; });
      const paper = document.createElement('canvas'); paper.width = W; paper.height = H; const pp = paper.getContext('2d');
      pp.fillStyle = '#ece6da'; pp.fillRect(0, 0, W, H); for (let i = 0; i < 3000; i++) { pp.fillStyle = `rgba(${r() < 0.5 ? '120,100,80' : '255,255,255'},${r() * 0.08})`; pp.fillRect(r() * W, r() * H, 1 + r() * 2, 1); }
      pp.strokeStyle = 'rgba(0,0,0,0.05)'; pp.beginPath(); pp.moveTo(0, 190); pp.lineTo(W, 172); pp.stroke();
      return t => {
        const fpsQ = L.p.fps, ts = Math.floor(t * fpsQ) / fpsQ, lt = ts % 7, step = Math.floor(t * fpsQ);
        g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(paper, 0, 0);
        all.forEach((p, i) => {
          if (lt < p.t0) return;
          const k = seg(lt, p.t0, p.t0 + 0.25), sc = 1 + 0.35 * (1 - ease.out(k)), gone = ease.inExpo(seg(lt, p.out, p.out + 0.75));
          const jx = (Math.sin(step * 12.9898 + i * 78.233) * 43758.5453 % 1) * 1.4, jy = (Math.sin(step * 39.346 + i * 11.135) * 24634.6345 % 1) * 1.4, jr = (Math.sin(step * 7.13 + i * 3.7) * 9631.17 % 1) * 0.02;
          const x = p.x + jx + p.ox * gone, y = p.y + jy + p.oy * gone, rot = p.rot + jr + gone * 2;
          g.setTransform(sc * Math.cos(rot), sc * Math.sin(rot), -sc * Math.sin(rot), sc * Math.cos(rot), x + 4, y + 5);
          g.globalAlpha = 0.22; g.filter = 'blur(2px)'; g.drawImage(p.c, -p.w / 2, -p.h / 2); g.filter = 'none'; g.globalAlpha = 1;
          g.setTransform(sc * Math.cos(rot), sc * Math.sin(rot), -sc * Math.sin(rot), sc * Math.cos(rot), x, y);
          g.drawImage(p.c, -p.w / 2, -p.h / 2);
        });
        g.setTransform(1, 0, 0, 1, 0, 0);
      };
    },
  });

})();
