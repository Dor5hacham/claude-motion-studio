// Built from scratch: engines with no library and no engine behind them. Each card holds its
// whole renderer, physics or synth in one setup() so it can be read top to bottom.
(function () {
  const { C, ease } = EX;
  const W = 640, H = 360;
  const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const pack = (r, g, b) => (255 << 24 | b << 16 | g << 8 | r) >>> 0;

  // ---------------- software rasterizer ----------------
  EX.add({
    cat: 'scratch', id: 'x-raster', title: 'Software rasterizer', aka: 'CPU 3D engine, z-buffer, scanline renderer, 3D without WebGL', tool: 'Plain JavaScript writing pixels into an ImageData (no WebGL)', runs: 'CPU',
    notice: 'A 3D engine in plain JavaScript with no GPU help: each frame it moves 3,200 vertices with matrices, lights them, clips triangles at the near plane and drops the ones facing away. Then it fills each pixel with edge functions, a z-buffer and perspective-correct texture lookups. Set "Perspective-correct" to 0 to see the PlayStation 1 texture wobble.',
    use: 'teaching how a GPU works, retro and pixel-art 3D, rendering where WebGL is not available',
    params: [{ key: 'pix', label: 'Pixel size', min: 1, max: 8, step: 1, value: 1, unit: ' px' }, { key: 'fov', label: 'Field of view', min: 30, max: 110, step: 1, value: 58, unit: ' deg' }, { key: 'persp', label: 'Perspective-correct', min: 0, max: 1, step: 1, value: 1 }],
    prompt: 'Write a software 3D rasterizer in plain JavaScript (no WebGL): model and view matrices, near-plane clipping, back-face culling, edge-function triangle fill with a z-buffer, Gouraud lighting and texture mapping with perspective correction set to {persp} (1 = on, 0 = PlayStation-style affine wobble), writing into an ImageData with a pixel size of {pix} and a {fov} field of view. Scene: a textured (3,4) torus knot spinning above a checker floor with fog. Buttons for wireframe, depth buffer and shaded views, and a 12 s tour that wipes between them.',
    controls: [{ label: 'Tour', on: true, fn: L => { L.state.mode = -1; } }, { label: 'Wireframe', fn: L => { L.state.mode = 0; } }, { label: 'Depth buffer', fn: L => { L.state.mode = 1; } }, { label: 'Shaded', fn: L => { L.state.mode = 2; } }],
    setup(cv, L) {
      const g = cv.getContext('2d');
      const st = (L.state = L.state || { mode: -1 });
      // Texture: drawn once on a canvas, then read back as packed RGBA words (256 x 64, wraps).
      const TW = 256, TH = 64;
      const tc = document.createElement('canvas'); tc.width = TW; tc.height = TH; const tg = tc.getContext('2d');
      tg.fillStyle = C.coral; tg.fillRect(0, 0, TW, TH);
      tg.fillStyle = C.amber; tg.fillRect(0, 0, TW, 7); tg.fillRect(0, TH - 7, TW, 7);
      tg.fillStyle = C.cream; for (let i = 0; i < 16; i++) tg.fillRect(i * 16 + 4, 11, 8, 3), tg.fillRect(i * 16 + 4, TH - 14, 8, 3);
      tg.fillStyle = C.navy; tg.font = '700 28px Bahnschrift, Segoe UI'; tg.textBaseline = 'middle'; tg.textAlign = 'center'; tg.fillText('NO GPU', 64, TH / 2 + 1); tg.fillText('NO GPU', 192, TH / 2 + 1);
      const tex = new Uint32Array(tg.getImageData(0, 0, TW, TH).data.buffer);

      // Mesh: a (3,4) torus knot tube plus a floor grid, in one vertex list.
      const SU = 240, SR = 12, NK = (SU + 1) * (SR + 1), FN = 6, NV = NK + (FN + 1) * (FN + 1), RAD = 1.3, TUBE = 0.3;
      const P = new Float32Array(NV * 3), N = new Float32Array(NV * 3), UV = new Float32Array(NV * 2), idx = [];
      const kp = u => { const q = 4 / 3 * u, r = RAD * (2 + Math.cos(q)) * 0.5; return [r * Math.cos(u), r * Math.sin(u), RAD * Math.sin(q) * 0.5]; };
      const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
      const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      for (let i = 0; i <= SU; i++) {
        const u = i / SU * Math.PI * 6, p1 = kp(u), p2 = kp(u + 0.01);
        const T = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]], B = nrm(cross(T, [p2[0] + p1[0], p2[1] + p1[1], p2[2] + p1[2]])), Nn = nrm(cross(B, T));
        for (let j = 0; j <= SR; j++) {
          const v = j / SR * Math.PI * 2, a = -Math.cos(v), b = Math.sin(v), k = i * (SR + 1) + j;
          for (let c = 0; c < 3; c++) { N[k * 3 + c] = a * Nn[c] + b * B[c]; P[k * 3 + c] = p1[c] + TUBE * N[k * 3 + c]; }
          UV[k * 2] = i / SU * 5; UV[k * 2 + 1] = j / SR;
          if (i < SU && j < SR) { const b2 = k + SR + 1; idx.push(k, b2, k + 1, b2, b2 + 1, k + 1); }
        }
      }
      const KT = idx.length;
      for (let j = 0; j <= FN; j++) for (let i = 0; i <= FN; i++) {
        const k = NK + j * (FN + 1) + i, x = (i / FN - 0.5) * 26, z = (j / FN - 0.5) * 26;
        P[k * 3] = x; P[k * 3 + 1] = -1.75; P[k * 3 + 2] = z; N[k * 3 + 1] = 1; UV[k * 2] = x; UV[k * 2 + 1] = z;
        if (i < FN && j < FN) idx.push(k, k + 1, k + FN + 1, k + 1, k + FN + 2, k + FN + 1);
      }
      const IDX = Uint32Array.from(idx), NT = IDX.length / 3;
      // Per-vertex results: view-space position, diffuse, specular; SV holds projected vertices (stride 8).
      const VP = new Float32Array(NV * 3), VD = new Float32Array(NV), VS = new Float32Array(NV), SV = new Float32Array((NV + 8) * 8);
      const NEAR = 0.15;
      const bgs = [hexRGB('#08080f'), [0, 0, 0], hexRGB('#2a2450')];
      let s = 0, rw = 0, rh = 0, img = null, px = null, zb = null, oc = null, og = null, bgW = null, bgD = null, bgS = null;
      const resize = n => {
        s = n; rw = Math.ceil(W / n); rh = Math.ceil(H / n);
        oc = document.createElement('canvas'); oc.width = rw; oc.height = rh; og = oc.getContext('2d');
        img = og.createImageData(rw, rh); px = new Uint32Array(img.data.buffer); zb = new Float32Array(rw * rh);
        bgW = new Uint32Array(rw * rh); bgD = new Uint32Array(rw * rh); bgS = new Uint32Array(rw * rh);
        for (let y = 0; y < rh; y++) {
          const k = Math.pow(y / rh, 1.4), top = hexRGB('#0b0b10'), hz = bgs[2];
          const cs = pack(top[0] + (hz[0] - top[0]) * k | 0, top[1] + (hz[1] - top[1]) * k | 0, top[2] + (hz[2] - top[2]) * k | 0);
          bgW.fill(pack(8, 8, 15), y * rw, (y + 1) * rw); bgD.fill(pack(0, 0, 0), y * rw, (y + 1) * rw); bgS.fill(cs, y * rw, (y + 1) * rw);
        }
      };
      let persp = 1, F = 1, hw = 0, hh = 0, wx = 0, mL = 2, mR = 2, drawn = 0, filled = 0;
      const proj = (o, x, y, z, u, v, d, sp) => { const iw = 1 / z, m = persp ? iw : 1; SV[o] = hw + x * iw * F; SV[o + 1] = hh - y * iw * F; SV[o + 2] = iw; SV[o + 3] = u * m; SV[o + 4] = v * m; SV[o + 5] = d * m; SV[o + 6] = sp * m; };
      // Fills one projected triangle (SV offsets a, b, c) with depth test and per-pixel shading.
      const tri = (a, b, c, floor) => {
        const ax = SV[a], ay = SV[a + 1], bx = SV[b], by = SV[b + 1], cx = SV[c], cy = SV[c + 1];
        const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        if (area <= 0) return;
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(rw - 1, Math.ceil(Math.max(ax, bx, cx)));
        const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(rh - 1, Math.ceil(Math.max(ay, by, cy)));
        if (x0 > x1 || y0 > y1) return;
        drawn++;
        const ia = 1 / area, l0 = 1 / Math.hypot(cx - bx, cy - by), l1 = 1 / Math.hypot(ax - cx, ay - cy), l2 = 1 / Math.hypot(bx - ax, by - ay);
        const e0 = by - cy, e1 = cy - ay, e2 = ay - by;
        for (let y = y0; y <= y1; y++) {
          const py = y + 0.5, qx = x0 + 0.5, row = y * rw;
          let w0 = (cx - bx) * (py - by) - (cy - by) * (qx - bx), w1 = (ax - cx) * (py - cy) - (ay - cy) * (qx - cx), w2 = (bx - ax) * (py - ay) - (by - ay) * (qx - ax);
          for (let x = x0; x <= x1; x++, w0 += e0, w1 += e1, w2 += e2) {
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            const b0 = w0 * ia, b1 = w1 * ia, b2 = w2 * ia, k = row + x;
            const iw = b0 * SV[a + 2] + b1 * SV[b + 2] + b2 * SV[c + 2];
            if (iw <= zb[k]) continue;
            zb[k] = iw; filled++;
            const m = x < wx ? mL : mR, z = 1 / iw;
            let r, gg, bb;
            if (m === 1) { const v = Math.max(0, Math.min(1, 1 - (z - 3.6) / 9)); const q = Math.pow(v, 1.5) * 255; r = q; gg = q * 0.96; bb = q * 0.9; }
            else {
              const q = persp ? z : 1;
              if (m === 0) {
                const dl = Math.min(w0 * l0, w1 * l1, w2 * l2), line = dl < 0.95 ? 1 - dl / 0.95 : 0;
                if (floor) { r = 12 + 110 * line; gg = 12 + 90 * line; bb = 22 + 230 * line; }
                else { r = 20 + 23 * line; gg = 19 + 177 * line; bb = 38 + 192 * line; }
              } else if (floor) {
                const u = (b0 * SV[a + 3] + b1 * SV[b + 3] + b2 * SV[c + 3]) * q, v = (b0 * SV[a + 4] + b1 * SV[b + 4] + b2 * SV[c + 4]) * q;
                const chk = (Math.floor(u * 0.5) + Math.floor(v * 0.5)) & 1, sh = 1 - 0.75 * Math.exp(-(u * u + v * v) * 0.35);
                r = (chk ? 58 : 34) * sh; gg = (chk ? 52 : 30) * sh; bb = (chk ? 96 : 62) * sh;
              } else {
                const u = (b0 * SV[a + 3] + b1 * SV[b + 3] + b2 * SV[c + 3]) * q, v = (b0 * SV[a + 4] + b1 * SV[b + 4] + b2 * SV[c + 4]) * q;
                const d = (b0 * SV[a + 5] + b1 * SV[b + 5] + b2 * SV[c + 5]) * q, sp = (b0 * SV[a + 6] + b1 * SV[b + 6] + b2 * SV[c + 6]) * q;
                const t = tex[(((v * TH) | 0) & (TH - 1)) * TW + (((u * TW) | 0) & (TW - 1))];
                r = Math.min(255, (t & 255) * d + sp); gg = Math.min(255, (t >> 8 & 255) * d + sp); bb = Math.min(255, (t >> 16 & 255) * d + sp);
              }
              if (floor) { const f = Math.min(1, Math.max(0, (z - 4) / 13)), bg = (m === 0 ? bgW : bgS)[k]; r += ((bg & 255) - r) * f; gg += ((bg >> 8 & 255) - gg) * f; bb += ((bg >> 16 & 255) - bb) * f; }
            }
            px[k] = 255 << 24 | bb << 16 | gg << 8 | r;
          }
        }
      };
      const tmp = new Float32Array(7 * 8);
      // Clips a triangle against the near plane z = NEAR in view space, then fills the 1 or 2 pieces.
      const clipTri = (i0, i1, i2, floor) => {
        const src = [i0, i1, i2]; let n = 0;
        for (let e = 0; e < 3; e++) {
          const A = src[e], B = src[(e + 1) % 3], az = VP[A * 3 + 2], bz = VP[B * 3 + 2];
          const put = (Ai, Bi, t) => { const o = n * 7; for (let c = 0; c < 3; c++) tmp[o + c] = VP[Ai * 3 + c] + (VP[Bi * 3 + c] - VP[Ai * 3 + c]) * t; tmp[o + 3] = UV[Ai * 2] + (UV[Bi * 2] - UV[Ai * 2]) * t; tmp[o + 4] = UV[Ai * 2 + 1] + (UV[Bi * 2 + 1] - UV[Ai * 2 + 1]) * t; tmp[o + 5] = VD[Ai] + (VD[Bi] - VD[Ai]) * t; tmp[o + 6] = VS[Ai] + (VS[Bi] - VS[Ai]) * t; n++; };
          if (az >= NEAR) put(A, A, 0);
          if ((az >= NEAR) !== (bz >= NEAR)) put(A, B, (NEAR - az) / (bz - az));
        }
        if (n < 3) return;
        for (let k = 0; k < n; k++) { const o = k * 7; proj((NV + k) * 8, tmp[o], tmp[o + 1], tmp[o + 2], tmp[o + 3], tmp[o + 4], tmp[o + 5], tmp[o + 6]); }
        for (let k = 1; k < n - 1; k++) tri(NV * 8, (NV + k) * 8, (NV + k + 1) * 8, floor);
      };
      const NAMES = ['WIREFRAME', 'DEPTH BUFFER', 'SHADED'], SEQ = [2, 0, 1];
      return t => {
        const t0 = performance.now();
        if (s !== L.p.pix) resize(L.p.pix);
        persp = L.p.persp; F = 1 / Math.tan(L.p.fov * Math.PI / 360) * rh / 2; hw = rw / 2; hh = rh / 2;
        if (st.mode < 0) {
          const p = t % 12, i = Math.floor(p / 4), lt = p - i * 4; mR = SEQ[i];
          if (lt > 3.1) { mL = SEQ[(i + 1) % 3]; wx = Math.round(ease.inOut((lt - 3.1) / 0.9) * rw); } else { mL = mR; wx = 0; }
        } else { mL = mR = st.mode; wx = 0; }
        // Camera on a slow orbit; the knot spins and bobs.
        const ca = 0.6 + t * 0.22, eye = [Math.sin(ca) * 6.4, 1.4 + Math.sin(t * 0.37) * 0.5, -Math.cos(ca) * 6.4], tgt = [0, -0.1, 0];
        const fw = nrm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]), rt = nrm(cross(fw, [0, 1, 0])), up = cross(rt, fw);
        const ry = t * 0.7, rx = 0.35 + Math.sin(t * 0.5) * 0.25, cyv = Math.cos(ry), syv = Math.sin(ry), cxv = Math.cos(rx), sxv = Math.sin(rx);
        const Rm = [cyv, syv * sxv, syv * cxv, 0, cxv, -sxv, -syv, cyv * sxv, cyv * cxv], bob = 0.12 * Math.sin(t * 1.3);
        const Ls = nrm([-0.5, 0.8, -0.35]), Lv = [Ls[0] * rt[0] + Ls[1] * rt[1] + Ls[2] * rt[2], Ls[0] * up[0] + Ls[1] * up[1] + Ls[2] * up[2], Ls[0] * fw[0] + Ls[1] * fw[1] + Ls[2] * fw[2]];
        for (let i = 0; i < NV; i++) {
          let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
          if (i < NK) {
            const X = Rm[0] * x + Rm[1] * y + Rm[2] * z, Y = Rm[3] * x + Rm[4] * y + Rm[5] * z + bob, Z = Rm[6] * x + Rm[7] * y + Rm[8] * z; x = X; y = Y; z = Z;
            const NX = Rm[0] * nx + Rm[1] * ny + Rm[2] * nz, NY = Rm[3] * nx + Rm[4] * ny + Rm[5] * nz, NZ = Rm[6] * nx + Rm[7] * ny + Rm[8] * nz; nx = NX; ny = NY; nz = NZ;
          }
          x -= eye[0]; y -= eye[1]; z -= eye[2];
          const vx = x * rt[0] + y * rt[1] + z * rt[2], vy = x * up[0] + y * up[1] + z * up[2], vz = x * fw[0] + y * fw[1] + z * fw[2];
          const mx = nx * rt[0] + ny * rt[1] + nz * rt[2], my = nx * up[0] + ny * up[1] + nz * up[2], mz = nx * fw[0] + ny * fw[1] + nz * fw[2];
          VP[i * 3] = vx; VP[i * 3 + 1] = vy; VP[i * 3 + 2] = vz;
          const dif = Math.max(0, mx * Lv[0] + my * Lv[1] + mz * Lv[2]);
          let hx = Lv[0] - vx, hy = Lv[1] - vy, hz = Lv[2] - vz; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
          VD[i] = 0.28 + 0.85 * dif; VS[i] = Math.pow(Math.max(0, mx * hx + my * hy + mz * hz), 28) * 190;
          if (vz >= NEAR) proj(i * 8, vx, vy, vz, UV[i * 2], UV[i * 2 + 1], VD[i], VS[i]);
        }
        for (let y = 0; y < rh; y++) { const o = y * rw, a = (mL === 0 ? bgW : mL === 1 ? bgD : bgS), b = (mR === 0 ? bgW : mR === 1 ? bgD : bgS); if (wx > 0) px.set(a.subarray(o, o + wx), o); px.set(b.subarray(o + wx, o + rw), o + wx); }
        zb.fill(0); drawn = 0; filled = 0;
        for (let k = 0; k < NT; k++) {
          const i0 = IDX[k * 3], i1 = IDX[k * 3 + 1], i2 = IDX[k * 3 + 2], fl = k * 3 >= KT;
          const z0 = VP[i0 * 3 + 2], z1 = VP[i1 * 3 + 2], z2 = VP[i2 * 3 + 2];
          if (z0 >= NEAR && z1 >= NEAR && z2 >= NEAR) tri(i0 * 8, i1 * 8, i2 * 8, fl);
          else if (z0 >= NEAR || z1 >= NEAR || z2 >= NEAR) clipTri(i0, i1, i2, fl);
        }
        og.putImageData(img, 0, 0);
        g.imageSmoothingEnabled = false; g.drawImage(oc, 0, 0, rw * s, rh * s);
        const ms = performance.now() - t0;
        if (wx > 0) { g.fillStyle = C.cream; g.fillRect(wx * s - 1, 0, 2, H); }
        g.font = '600 12px Bahnschrift, Segoe UI'; g.textBaseline = 'top';
        g.fillStyle = C.coral; g.fillRect(16, 17, 8, 8); g.fillStyle = C.cream; g.fillText(NAMES[wx > 0 ? mL : mR], 30, 15);
        g.font = '11px Cascadia Mono, Consolas, monospace'; g.textBaseline = 'alphabetic';
        const hud = `${NT} triangles   ${drawn} drawn   ${filled} pixels   ${rw}x${rh}   ${ms.toFixed(1)} ms`;
        g.fillStyle = 'rgba(11,11,16,0.72)'; g.fillRect(8, H - 30, g.measureText(hud).width + 16, 22); g.fillStyle = 'rgba(244,239,230,0.75)'; g.fillText(hud, 16, H - 15);
      };
    },
  });

  // ---------------- GPU path tracer ----------------
  const G = EX.G, gl = G.gl;
  if (gl) EX.add({
    cat: 'scratch', id: 'x-pathtrace', title: 'Path tracer', aka: 'Monte Carlo path tracing, progressive rendering, Cornell box, global illumination', tool: 'WebGL2 fragment shader written from scratch, float accumulation buffer', runs: 'GPU',
    notice: 'Every pixel fires random light paths into a Cornell box: they bounce off the walls, reflect off the gold ball and refract through the glass one, and each hit asks the ceiling light directly how much it adds. One frame is pure noise, so each new frame is averaged into a float buffer and the picture clears up. When the camera moves the average starts again, so you can watch the noise settle.',
    use: 'understanding how Blender Cycles or Arnold works, product shots with real light bounce, soft shadows and caustics',
    params: [{ key: 'spp', label: 'Samples per frame', min: 1, max: 8, step: 1, value: 2 }, { key: 'bounce', label: 'Bounces', min: 1, max: 8, step: 1, value: 5 }, { key: 'aper', label: 'Lens aperture', min: 0, max: 0.2, step: 0.01, value: 0.05 }],
    prompt: 'Write a progressive path tracer from scratch in a WebGL2 fragment shader: a Cornell box with coral and cyan walls, a glass ball (Fresnel reflection and refraction), a glossy gold ball and a matte violet ball, an area light with next-event estimation, {bounce} bounces, {spp} samples per pixel per frame averaged in a float ping-pong buffer, thin-lens depth of field (aperture {aper}) focused on the glass ball, ACES tone mapping. The camera holds 5.5 s per view then glides 1.5 s to the next; reset the average while it moves and show the sample count.',
    setup(cv, L) {
      const ctx = cv.getContext('2d'); const keep = (L.state = L.state || { pp: null, trace: null, show: null });
      // Accumulation buffer: RGBA32F when the GPU can render to float, else 8-bit. Kept across Replay so GPU memory is not re-allocated.
      const mk = () => {
        if (!G.floatOK) return G.target(W, H, false, false);
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { tex, fb, w: W, h: H };
      };
      const pp = keep.pp || (keep.pp = { read: mk(), write: mk(), swap() { const t = this.read; this.read = this.write; this.write = t; } });
      const trace = keep.trace || (keep.trace = G.prog(`uniform sampler2D uAcc; uniform float uN,uSpp,uBounce,uAper,uSeed; uniform vec3 uEye,uTgt;
        uint seed; float rnd(){seed=seed*747796405u+2891336453u; uint w=((seed>>((seed>>28u)+4u))^seed)*277803737u; return float((w>>22u)^w)/4294967296.;}
        const vec3 BMIN=vec3(-1.6,0.,-1.), BMAX=vec3(1.6,2.,1.), LE=vec3(1.,.86,.68)*11.; const vec2 LH=vec2(.55,.38);
        const vec3 GC=vec3(-.62,.55,.12); const float GR=.55;
        float hT; vec3 hN,hA; int hM;
        void wall(vec3 ro,vec3 rd,vec3 n,float d,vec3 col){float dn=dot(rd,n); if(abs(dn)<1e-6) return; float t=(d-dot(ro,n))/dn; if(t<1e-4||t>=hT) return; vec3 p=ro+rd*t;
          if(any(lessThan(p,BMIN-1e-3))||any(greaterThan(p,BMAX+1e-3))) return; hT=t; hN=n; hA=col; hM=0;
          if(n.y<-.5&&abs(p.x)<LH.x&&abs(p.z)<LH.y) hM=3;}
        void ball(vec3 ro,vec3 rd,vec3 c,float r,vec3 col,int m){vec3 oc=ro-c; float b=dot(oc,rd),h=b*b-dot(oc,oc)+r*r; if(h<0.) return; h=sqrt(h); float t=-b-h; if(t<1e-4) t=-b+h; if(t<1e-4||t>=hT) return; hT=t; hN=(ro+rd*t-c)/r; hA=col; hM=m;}
        bool scene(vec3 ro,vec3 rd){hT=1e9; hM=-1;
          wall(ro,rd,vec3(0,1,0),0.,vec3(.82,.79,.74)); wall(ro,rd,vec3(0,-1,0),-2.,vec3(.82,.79,.74)); wall(ro,rd,vec3(0,0,1),-1.,vec3(.82,.79,.74));
          wall(ro,rd,vec3(1,0,0),-1.6,vec3(.86,.25,.13)); wall(ro,rd,vec3(-1,0,0),-1.6,vec3(.1,.55,.68));
          ball(ro,rd,GC,GR,vec3(1),2); ball(ro,rd,vec3(.78,.46,-.38),.46,vec3(1.,.72,.34),1); ball(ro,rd,vec3(.42,.2,.62),.2,vec3(.45,.33,.95),0);
          return hM>=0;}
        vec3 cosDir(vec3 n){float a=6.2831853*rnd(),u=rnd()*2.-1.; return normalize(n+vec3(sqrt(1.-u*u)*vec2(cos(a),sin(a)),u));}
        vec3 path(vec3 ro,vec3 rd){vec3 acc=vec3(0),thr=vec3(1); bool spec=true;
          for(int b=0;b<8;b++){ if(float(b)>=uBounce||!scene(ro,rd)) break;
            vec3 p=ro+rd*hT,n=hN,alb=hA;
            if(hM==3){ if(spec) acc+=thr*LE; break; }
            if(hM==0){ if(dot(n,rd)>0.) n=-n;
              vec3 lp=vec3((rnd()*2.-1.)*LH.x,2.,(rnd()*2.-1.)*LH.y),ld=lp-p; float d2=dot(ld,ld),d=sqrt(d2); ld/=d; float cs=dot(n,ld);
              if(cs>0.&&ld.y>0.){ vec3 o=p+n*1e-3; if(!scene(o,ld)||hT>d-2e-3||hM==3) acc+=thr*alb/PI*LE*cs*ld.y*(4.*LH.x*LH.y)/d2; }
              ro=p+n*1e-3; rd=cosDir(n); thr*=alb; spec=false; }
            else if(hM==1){ vec3 r=reflect(rd,n)+.09*(vec3(rnd(),rnd(),rnd())*2.-1.); rd=normalize(r); if(dot(rd,n)<=0.) break; ro=p+n*1e-3; thr*=alb; spec=true; }
            else { bool outside=dot(rd,n)<0.; vec3 nn=outside?n:-n; float ci=-dot(rd,nn),F=.04+.96*pow(1.-ci,5.); vec3 rf=refract(rd,nn,outside?1./1.5:1.5);
              if(dot(rf,rf)<.5||rnd()<F){ rd=reflect(rd,nn); ro=p+nn*1e-3; } else { rd=rf; ro=p-nn*1e-3; thr*=vec3(.96,.98,1.); } spec=true; }
            if(b>2){ float q=max(thr.x,max(thr.y,thr.z)); if(rnd()>q) break; thr/=q; }
          }
          return acc;}
        void main(){ivec2 ip=ivec2(gl_FragCoord.xy); seed=uint(ip.x)*1973u+uint(ip.y)*9277u+uint(uSeed)*26699u|1u; rnd(); rnd();
          vec3 fw=normalize(uTgt-uEye),rt=normalize(cross(fw,vec3(0,1,0))),up=cross(rt,fw); float fd=length(GC-uEye)-GR*.6;
          vec3 sum=vec3(0);
          for(int s=0;s<8;s++){ if(float(s)>=uSpp) break;
            vec2 uv=(gl_FragCoord.xy+vec2(rnd(),rnd())-.5*uRes)/uRes.y; vec3 rd=normalize(fw*1.95+rt*uv.x+up*uv.y);
            vec3 fp=uEye+rd*fd/dot(rd,fw); float a=6.2831853*rnd(),r=sqrt(rnd())*uAper; vec3 ro=uEye+(rt*cos(a)+up*sin(a))*r;
            sum+=path(ro,normalize(fp-ro)); }
          vec3 cur=sum/uSpp; vec3 prev=texelFetch(uAcc,ip,0).rgb; o=vec4(uN>0.?mix(prev,cur,uSpp/(uN+uSpp)):cur,1);}`));
      const show = keep.show || (keep.show = G.prog(`uniform sampler2D uAcc; void main(){vec3 x=texelFetch(uAcc,ivec2(gl_FragCoord.xy),0).rgb*.85;
        vec3 c=clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); c=pow(c,vec3(1./2.2)); vec2 q=vUv-.5; c*=1.-dot(q,q)*.5; o=vec4(c,1);}`));
      // Camera keyframes: hold, then glide to the next; the average restarts while it moves.
      const KEYS = [[[0, 1.0, 4.85], [0, 0.92, 0]], [[-1.15, 1.45, 3.85], [0.15, 0.7, 0]], [[0.95, 0.5, 3.6], [-0.15, 0.82, 0]]];
      const HOLD = 5.5, MOVE = 1.5;
      let N = 0, seedN = 1, last = '';
      return t => {
        const cyc = HOLD + MOVE, p = t % (cyc * 3), i = Math.floor(p / cyc), lt = p - i * cyc, k = lt < HOLD ? 0 : ease.inOut((lt - HOLD) / MOVE);
        const A = KEYS[i], B = KEYS[(i + 1) % 3], mix = (a, b) => a.map((v, j) => v + (b[j] - v) * k);
        const eye = mix(A[0], B[0]), tgt = mix(A[1], B[1]);
        const key = eye.join() + tgt.join() + L.p.bounce + L.p.aper;
        if (key !== last) { N = 0; last = key; }
        if (N < 4096) { G.draw(trace, pp.write, { uAcc: pp.read, uN: N, uSpp: L.p.spp, uBounce: L.p.bounce, uAper: L.p.aper, uSeed: seedN++, uEye: eye, uTgt: tgt }); pp.swap(); N += L.p.spp; }
        G.draw(show, null, { uAcc: pp.read }, W, H); G.copy(ctx, W, H);
        const moving = k > 0;
        ctx.font = '600 12px Bahnschrift, Segoe UI'; ctx.textBaseline = 'top';
        ctx.fillStyle = moving ? C.amber : C.coral; ctx.fillRect(16, 17, 8, 8); ctx.fillStyle = C.cream; ctx.fillText(moving ? 'CAMERA MOVING: AVERAGE RESETS' : 'PATH TRACING', 30, 15);
        ctx.font = '11px Cascadia Mono, Consolas, monospace'; ctx.textBaseline = 'alphabetic';
        const hud = `${N} samples per pixel   ${L.p.bounce} bounces   ${(N * W * H / 1e6).toFixed(N < 40 ? 1 : 0)} M paths`;
        ctx.fillStyle = 'rgba(11,11,16,0.72)'; ctx.fillRect(8, H - 30, ctx.measureText(hud).width + 16, 22); ctx.fillStyle = 'rgba(244,239,230,0.75)'; ctx.fillText(hud, 16, H - 15);
        ctx.fillStyle = 'rgba(244,239,230,0.15)'; ctx.fillRect(W - 136, H - 22, 120, 3); ctx.fillStyle = C.coral; ctx.fillRect(W - 136, H - 22, 120 * Math.min(1, Math.log2(1 + N) / 10), 3);
      };
    },
  });

  // Draws the card label (top left) and a stats line (bottom left) over a finished frame.
  const hud = (g, label, line, dot = C.coral) => {
    g.font = '600 12px Bahnschrift, Segoe UI'; g.textBaseline = 'top'; g.fillStyle = 'rgba(11,11,16,0.6)'; g.fillRect(8, 9, g.measureText(label).width + 32, 24); g.fillStyle = dot; g.fillRect(16, 17, 8, 8); g.fillStyle = C.cream; g.fillText(label, 30, 15);
    g.font = '11px Cascadia Mono, Consolas, monospace'; g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(11,11,16,0.72)'; g.fillRect(8, H - 30, g.measureText(line).width + 16, 22); g.fillStyle = 'rgba(244,239,230,0.75)'; g.fillText(line, 16, H - 15);
  };

  // ---------------- 2D rigid-body physics ----------------
  EX.add({
    cat: 'scratch', id: 'x-rigid', title: 'Rigid-body physics engine', aka: 'impulse solver, SAT collision, Box2D-style physics, stacking', tool: 'Plain JavaScript physics (SAT, contact clipping, sequential impulses) + Canvas 2D', runs: 'CPU',
    notice: 'A small Box2D-style engine: each step finds touching polygons with the separating axis test, clips their edges to get up to two contact points, and pushes the bodies apart with impulses over ten passes, keeping friction and last step\'s impulses so stacks stand still. An earthquake shakes the ground under a temple, a pyramid, a crate tower and a row of dominoes, then every block flies back home. Lower "Solver passes" and the stacks start to sag and jitter.',
    use: 'games and playful UI physics, understanding what Matter.js or Box2D do inside, custom physics where a library is too heavy',
    params: [{ key: 'iter', label: 'Solver passes', min: 1, max: 20, step: 1, value: 10 }, { key: 'grav', label: 'Gravity', min: 2, max: 30, step: 0.5, value: 14, unit: ' m/s2' }, { key: 'fric', label: 'Friction', min: 0, max: 1, step: 0.05, value: 0.6 }],
    prompt: 'Write a 2D rigid-body physics engine from scratch in JavaScript, no library: convex polygons, separating axis test, reference/incident edge clipping for up to two contact points, sequential impulses with {iter} solver passes, warm starting, friction {fric}, Baumgarte position correction, gravity {grav}, fixed 60 Hz step. Scene: dominoes, a temple of pillars and slabs, a pyramid of crates and a crate tower; from 2.5 s to 6.3 s the ground shakes sideways at 2.6 Hz (the ground velocity feeds the friction), a seismograph traces it, then at 9.5 s every block flies back to its place with a staggered overshoot and the loop restarts. A debug view shows contact points and impulses.',
    controls: [{ label: 'Rendered', on: true, fn: L => { L.state.debug = false; } }, { label: 'Debug view', fn: L => { L.state.debug = true; } }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const st = (L.state = L.state || { debug: false });
      const S = 30, GY = 1, WW = W / S;
      const bodies = [];
      // Adds a convex polygon (counter-clockwise points) recentered on its centroid; density 0 makes it static.
      const poly = (pts, x, y, dens, col) => {
        let A = 0, cx = 0, cy = 0;
        for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length], c = ax * by - ay * bx; A += c / 2; cx += (ax + bx) * c / 6; cy += (ay + by) * c / 6; }
        cx /= A; cy /= A; const lp = pts.map(([px, py]) => [px - cx, py - cy]); let I = 0;
        for (let i = 0; i < lp.length; i++) { const [ax, ay] = lp[i], [bx, by] = lp[(i + 1) % lp.length], c = ax * by - ay * bx; I += c * (ax * ax + ax * bx + bx * bx + ay * ay + ay * by + by * by) / 12; }
        const n = lp.length, m = dens * A;
        const b = { lp, n, wv: new Float64Array(n * 2), wn: new Float64Array(n * 2), ln: lp.map((p, i) => { const q = lp[(i + 1) % n], ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey); return [ey / l, -ex / l]; }),
          x: x + cx, y: y + cy, a: 0, vx: 0, vy: 0, w: 0, im: dens ? 1 / m : 0, ii: dens ? 1 / (dens * I) : 0, r: Math.max(...lp.map(p => Math.hypot(p[0], p[1]))), col, x0: 0, y0: 0, a0: 0, sx: 0, sy: 0, sa: 0, rank: 0 };
        b.x0 = b.x; b.y0 = b.y; bodies.push(b); return b;
      };
      const box = (w, h, x, y, dens, col) => poly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], x, y, dens, col);
      box(WW + 2, 1, WW / 2, GY - 0.5, 0, null); box(1, 30, -0.5, 12, 0, null); box(1, 30, WW + 0.5, 12, 0, null);
      const TX = 8.6;
      for (let k = 0; k < 4; k++) {
        const b0 = GY + k * 1.66;
        box(0.42, 1.3, TX - 0.95, b0 + 0.65, 1, C.cream); box(0.42, 1.3, TX + 0.95, b0 + 0.65, 1, C.cream);
        box(2.7, 0.36, TX, b0 + 1.48, 1, k % 2 ? C.amber : C.coral);
      }
      poly([[-1.45, 0], [1.45, 0], [0, 0.95]], TX, GY + 4 * 1.66, 1, C.violet);
      const PX = 15.6;
      for (let r = 0; r < 5; r++) for (let i = 0; i < 5 - r; i++) box(0.82, 0.82, PX + (i - (4 - r) / 2) * 0.86, GY + 0.41 + r * 0.83, 1, [C.cyan, '#3b5bdb', C.cyan, C.paper, C.amber][r]);
      for (let i = 0; i < 7; i++) box(0.24, 1.5, 1.3 + i * 0.78, GY + 0.75, 1, i % 2 ? C.coral : C.amber);
      for (let i = 0; i < 6; i++) box(0.9, 0.9, 19.7, GY + 0.45 + i * 0.91, 1, i % 2 ? C.violet : C.cream);
      const ground = bodies[0], GX0 = ground.x;
      const dyn = bodies.filter(b => b.im > 0);
      dyn.slice().sort((p, q) => p.y0 - q.y0).forEach((b, i) => { b.rank = i / dyn.length; });

      const pose = b => {
        const c = Math.cos(b.a), s = Math.sin(b.a);
        for (let i = 0; i < b.n; i++) { const [px, py] = b.lp[i], [nx, ny] = b.ln[i]; b.wv[i * 2] = b.x + c * px - s * py; b.wv[i * 2 + 1] = b.y + s * px + c * py; b.wn[i * 2] = c * nx - s * ny; b.wn[i * 2 + 1] = s * nx + c * ny; }
      };
      // Deepest face of A against the vertices of B: [separation, face index].
      const maxSep = (A, B) => {
        let best = -1e9, bi = 0;
        for (let i = 0; i < A.n; i++) {
          const nx = A.wn[i * 2], ny = A.wn[i * 2 + 1], vx = A.wv[i * 2], vy = A.wv[i * 2 + 1]; let mn = 1e9;
          for (let j = 0; j < B.n; j++) { const d = nx * (B.wv[j * 2] - vx) + ny * (B.wv[j * 2 + 1] - vy); if (d < mn) mn = d; }
          if (mn > best) { best = mn; bi = i; }
        }
        return [best, bi];
      };
      const arb = new Map();
      // Polygon vs polygon: returns contacts {x, y, nx, ny, sep, id} with the normal pointing from A to B.
      const collide = (A, B) => {
        const [sa, fa] = maxSep(A, B); if (sa > 0) return null;
        const [sb, fb] = maxSep(B, A); if (sb > 0) return null;
        const flip = sb > sa + 0.005, R = flip ? B : A, I = flip ? A : B, rf = flip ? fb : fa;
        const nx = R.wn[rf * 2], ny = R.wn[rf * 2 + 1], v1x = R.wv[rf * 2], v1y = R.wv[rf * 2 + 1], j2 = (rf + 1) % R.n, v2x = R.wv[j2 * 2], v2y = R.wv[j2 * 2 + 1];
        let ii = 0, md = 1e9; for (let k = 0; k < I.n; k++) { const d = I.wn[k * 2] * nx + I.wn[k * 2 + 1] * ny; if (d < md) { md = d; ii = k; } }
        const k2 = (ii + 1) % I.n; let pts = [[I.wv[ii * 2], I.wv[ii * 2 + 1], 0], [I.wv[k2 * 2], I.wv[k2 * 2 + 1], 1]];
        const tl = Math.hypot(v2x - v1x, v2y - v1y), tx = (v2x - v1x) / tl, ty = (v2y - v1y) / tl;
        const clip = (ps, px, py, o) => {
          const out = [], d0 = ps[0][0] * px + ps[0][1] * py - o, d1 = ps[1][0] * px + ps[1][1] * py - o;
          if (d0 >= 0) out.push(ps[0]); if (d1 >= 0) out.push(ps[1]);
          if (d0 * d1 < 0) { const f = d0 / (d0 - d1); out.push([ps[0][0] + (ps[1][0] - ps[0][0]) * f, ps[0][1] + (ps[1][1] - ps[0][1]) * f, d0 < 0 ? ps[0][2] : ps[1][2]]); }
          return out;
        };
        pts = clip(pts, tx, ty, tx * v1x + ty * v1y); if (pts.length < 2) return null;
        pts = clip(pts, -tx, -ty, -(tx * v2x + ty * v2y)); if (pts.length < 2) return null;
        const out = [];
        for (const p of pts) { const sep = (p[0] - v1x) * nx + (p[1] - v1y) * ny; if (sep <= 0.02) out.push({ x: p[0] - nx * sep, y: p[1] - ny * sep, nx: flip ? -nx : nx, ny: flip ? -ny : ny, sep, id: (flip ? 1000 : 0) + rf * 50 + ii * 2 + p[2], pn: 0, pt: 0, mn: 0, mt: 0, bias: 0, rax: 0, ray: 0, rbx: 0, rby: 0 }); }
        return out.length ? out : null;
      };
      let ncont = 0, ms = 0;
      // One fixed 1/60 s step: gravity, contacts with warm starting, impulse passes, then positions.
      const step = dt => {
        const t0 = performance.now();
        for (const b of dyn) { b.vy -= L.p.grav * dt; pose(b); }
        for (const b of bodies) if (!b.im) pose(b);
        const seen = new Set(); ncont = 0;
        for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
          const A = bodies[i], B = bodies[j]; if (!A.im && !B.im) continue;
          const dx = B.x - A.x, dy = B.y - A.y, rr = A.r + B.r; if (dx * dx + dy * dy > rr * rr) continue;
          const cs = collide(A, B); const key = i * 1000 + j; if (!cs) continue;
          const old = arb.get(key); if (old) for (const c of cs) { const o = old.cs.find(q => q.id === c.id); if (o) { c.pn = o.pn; c.pt = o.pt; } }
          arb.set(key, { A, B, cs }); seen.add(key); ncont += cs.length;
        }
        for (const k of [...arb.keys()]) if (!seen.has(k)) arb.delete(k);
        const fr = L.p.fric;
        for (const { A, B, cs } of arb.values()) for (const c of cs) {
          c.rax = c.x - A.x; c.ray = c.y - A.y; c.rbx = c.x - B.x; c.rby = c.y - B.y;
          const rna = c.rax * c.ny - c.ray * c.nx, rnb = c.rbx * c.ny - c.rby * c.nx, rta = c.rax * -c.nx - c.ray * c.ny, rtb = c.rbx * -c.nx - c.rby * c.ny;
          c.mn = 1 / (A.im + B.im + A.ii * rna * rna + B.ii * rnb * rnb); c.mt = 1 / (A.im + B.im + A.ii * rta * rta + B.ii * rtb * rtb);
          c.bias = -0.2 / dt * Math.min(0, c.sep + 0.01);
          const px = c.pn * c.nx + c.pt * c.ny, py = c.pn * c.ny - c.pt * c.nx;
          A.vx -= A.im * px; A.vy -= A.im * py; A.w -= A.ii * (c.rax * py - c.ray * px); B.vx += B.im * px; B.vy += B.im * py; B.w += B.ii * (c.rbx * py - c.rby * px);
        }
        for (let it = 0; it < L.p.iter; it++) for (const { A, B, cs } of arb.values()) for (const c of cs) {
          let dvx = B.vx - B.w * c.rby - A.vx + A.w * c.ray, dvy = B.vy + B.w * c.rbx - A.vy - A.w * c.rax;
          const vn = dvx * c.nx + dvy * c.ny, p0 = c.pn; c.pn = Math.max(0, p0 + c.mn * (-vn + c.bias)); let d = c.pn - p0;
          let px = d * c.nx, py = d * c.ny;
          A.vx -= A.im * px; A.vy -= A.im * py; A.w -= A.ii * (c.rax * py - c.ray * px); B.vx += B.im * px; B.vy += B.im * py; B.w += B.ii * (c.rbx * py - c.rby * px);
          dvx = B.vx - B.w * c.rby - A.vx + A.w * c.ray; dvy = B.vy + B.w * c.rbx - A.vy - A.w * c.rax;
          const vt = dvx * c.ny - dvy * c.nx, t0 = c.pt, mx = fr * c.pn; c.pt = Math.max(-mx, Math.min(mx, t0 + c.mt * -vt)); d = c.pt - t0;
          px = d * c.ny; py = -d * c.nx;
          A.vx -= A.im * px; A.vy -= A.im * py; A.w -= A.ii * (c.rax * py - c.ray * px); B.vx += B.im * px; B.vy += B.im * py; B.w += B.ii * (c.rbx * py - c.rby * px);
        }
        for (const b of dyn) { b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt; }
        ms = performance.now() - t0;
      };
      const reset = () => { for (const b of dyn) { b.x = b.x0; b.y = b.y0; b.a = 0; b.vx = b.vy = b.w = 0; } arb.clear(); };
      let acc = 0, prev = -1, snap = false, simT = 0, gi = 0; const seis = new Float32Array(160);
      const DH = '#0f0f18';
      // Ground shake: amplitude ramps up, holds and fades between 2.5 s and 6.3 s.
      const quake = lt => { const a = 0.24 * Math.min(1, Math.max(0, (lt - 2.5) / 0.8)) * Math.min(1, Math.max(0, (6.3 - lt) / 0.8)), w = 16.3; return [a * Math.sin(w * lt), a * w * Math.cos(w * lt)]; };
      return (t, dt) => {
        const lt = t % 14;
        if (lt < prev) { reset(); simT = lt; }
        if (lt < 9.5) { acc += Math.min(dt, 0.05); while (acc >= 1 / 60) { simT = Math.min(simT + 1 / 60, lt); const [ox, ov] = quake(simT); ground.x = GX0 + ox; ground.vx = ov; seis[gi % 160] = ox * S; gi++; step(1 / 60); acc -= 1 / 60; } snap = false; }
        else if (lt < 11.6) {
          ground.x = GX0; ground.vx = 0; simT = lt;
          if (!snap) { snap = true; arb.clear(); ncont = 0; for (const b of dyn) { b.sx = b.x; b.sy = b.y; b.sa = Math.atan2(Math.sin(b.a), Math.cos(b.a)); } }
          for (const b of dyn) { const k = ease.back(Math.min(1, Math.max(0, (lt - 9.5 - b.rank * 0.7) / 1.2))); b.x = b.sx + (b.x0 - b.sx) * k; b.y = b.sy + (b.y0 - b.sy) * k; b.a = b.sa * (1 - k); }
        } else if (snap) { snap = false; reset(); }
        prev = lt;
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(244,239,230,0.045)'; g.lineWidth = 1; g.beginPath(); for (let x = 0; x <= W; x += S) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); } for (let y = H - GY * S; y >= 0; y -= S) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); } g.stroke();
        const off = (ground.x - GX0) * S; g.fillStyle = DH; g.fillRect(0, H - GY * S, W, GY * S); g.fillStyle = 'rgba(244,239,230,0.25)'; g.fillRect(0, H - GY * S, W, 1);
        g.fillStyle = 'rgba(244,239,230,0.18)'; for (let x = -30; x < W + 30; x += 30) g.fillRect(x + off, H - GY * S + 6, 12, 2);
        const SX = W - 196, SY = 18; g.fillStyle = 'rgba(11,11,16,0.6)'; g.fillRect(SX - 8, SY - 8, 188, 52); g.strokeStyle = 'rgba(244,239,230,0.12)'; g.beginPath(); g.moveTo(SX, SY + 18.5); g.lineTo(SX + 172, SY + 18.5); g.stroke();
        g.strokeStyle = C.coral; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < 160; i++) { const v = seis[(gi + i) % 160], x = SX + i * 172 / 159, y = SY + 18 - v * 2.4; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
        g.font = '10px Cascadia Mono, Consolas, monospace'; g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(244,239,230,0.5)'; g.fillText('GROUND', SX, SY + 40);
        for (const b of dyn) {
          pose(b); g.beginPath(); for (let i = 0; i < b.n; i++) g.lineTo(b.wv[i * 2] * S, H - b.wv[i * 2 + 1] * S); g.closePath();
          if (st.debug) { g.strokeStyle = 'rgba(244,239,230,0.7)'; g.lineWidth = 1; g.stroke(); g.fillStyle = C.cream; g.fillRect(b.x * S - 1.5, H - b.y * S - 1.5, 3, 3); }
          else { g.fillStyle = b.col; g.fill(); g.strokeStyle = 'rgba(11,11,16,0.55)'; g.lineWidth = 1.5; g.stroke(); }
        }
        if (st.debug) for (const { cs } of arb.values()) for (const c of cs) {
          const x = c.x * S, y = H - c.y * S, len = Math.min(40, 4 + c.pn * 22);
          g.strokeStyle = C.amber; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + c.nx * len, y - c.ny * len); g.stroke();
          g.fillStyle = C.coral; g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill();
        }
        hud(g, st.debug ? 'DEBUG: CONTACT POINTS AND IMPULSES' : 'SAT COLLISION + SEQUENTIAL IMPULSES', `${dyn.length} bodies   ${ncont} contacts   ${L.p.iter} passes   ${ms.toFixed(2)} ms per step`);
      };
    },
  });

  // ---------------- voxel engine ----------------
  if (gl) EX.add({
    cat: 'scratch', id: 'x-voxel', title: 'Voxel engine', aka: 'DDA ray casting, voxel terrain, Minecraft-style world, grid traversal', tool: 'JavaScript height map + WebGL2 fragment shader (DDA grid traversal)', runs: 'GPU',
    notice: 'JavaScript builds a 256 x 256 height map once from tiling noise and sends it to the GPU. For every pixel the shader walks the voxel grid one cell wall at a time (the DDA algorithm) until it enters a solid block, then casts a second walk toward the sun for the shadow, checks 8 neighbors for corner shading and adds water and fog. "Step count" shows how many cells each ray visited.',
    use: 'block worlds and game prototypes, stylized landscape fly-throughs, teaching grid traversal',
    params: [{ key: 'steps', label: 'Max steps per ray', min: 32, max: 256, step: 8, value: 200 }, { key: 'sun', label: 'Sun height', min: 0.06, max: 1.3, step: 0.02, value: 0.36, unit: ' rad' }],
    prompt: 'Write a voxel engine from scratch: a 256 x 256 tiling height map from value noise (water at level 14, sand, grass, rock, snow), rendered in a WebGL2 fragment shader by DDA grid traversal (up to {steps} steps per ray), a second DDA toward the sun for hard shadows (sun height {sun}), per-corner ambient occlusion, faint block edges, a wavy water plane with Fresnel sky reflection and distance fog. The camera glides over the terrain and keeps its height above the peaks; the sun circles slowly. Add a view that colors each pixel by its step count.',
    controls: [{ label: 'Shaded', on: true, fn: L => { L.state.mode = 0; } }, { label: 'Step count', fn: L => { L.state.mode = 1; } }],
    setup(cv, L) {
      const ctx = cv.getContext('2d'); const st = (L.state = L.state || { mode: 0, tex: /** @type {WebGLTexture} */ (null), prog: null });
      // Height map: tiling value noise (each octave wraps at its own period), heights 0 to 63.
      const N = 256, hm = new Uint8Array(N * N);
      const hsh = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
      const vn = (x, y, P) => { const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy, a = ix % P, b = (ix + 1) % P, c = iy % P, d = (iy + 1) % P, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
        const top = hsh(a, c) + (hsh(b, c) - hsh(a, c)) * su, bot = hsh(a, d) + (hsh(b, d) - hsh(a, d)) * su; return top + (bot - top) * sv; };
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        let f = 0, amp = 0.5, P = 4; for (let o = 0; o < 6; o++) { f += amp * vn(x / N * P, y / N * P, P); P *= 2; amp *= 0.5; }
        const k = Math.max(0, (f - 0.3) * 1.65); hm[y * N + x] = Math.min(63, Math.round(Math.pow(k, 1.5) * 58 + 8));
      }
      const tex = st.tex || (st.tex = gl.createTexture()); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, N, N, 0, gl.RED, gl.UNSIGNED_BYTE, hm); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const prog = st.prog || (st.prog = G.prog(`uniform sampler2D uHm; uniform vec3 uEye,uSunD; uniform vec2 uView; uniform float uSteps,uMode;
        const float WL=14.;
        int hgt(ivec2 c){return int(texelFetch(uHm,c&255,0).r*255.+.5);}
        bool solid(ivec3 c){return c.y<hgt(c.xz);}
        vec3 sky(vec3 rd){float y=max(rd.y,0.); vec3 col=mix(vec3(.46,.5,.62),vec3(.04,.1,.33),pow(y,.5)); float s=max(dot(rd,uSunD),0.); return col+vec3(1.,.55,.25)*(pow(s,900.)*8.+pow(s,6.)*.45);}
        bool dda(vec3 ro,vec3 rd,int ms,out float t,out ivec3 c,out vec3 n,out int k){
          c=ivec3(floor(ro)); vec3 dd=abs(1./rd),sr=sign(rd); ivec3 s=ivec3(sr); vec3 sd=(sr*(vec3(c)-ro)+sr*.5+.5)*dd,m=vec3(0); t=0.; n=vec3(0,1,0); k=0;
          for(int i=0;i<256;i++){ k=i; if(i>=ms) break;
            if(solid(c)){ t=dot(sd-dd,m); n=-m*sr; return true; }
            if((c.y>64&&rd.y>=0.)||c.y<0) break;
            m=step(sd.xyz,sd.yzx)*step(sd.xyz,sd.zxy); sd+=m*dd; c+=ivec3(m)*s; }
          return false;}
        vec3 voxel(vec3 p,ivec3 c,vec3 n,float t){
          int h=hgt(c.xz); float hv=hash21(vec2(c.xz)+float(c.y)*7.13); vec3 b;
          if(c.y>=40) b=vec3(.94,.93,.9); else if(c.y>=28) b=vec3(.52,.48,.58); else if(h<=int(WL)+2) b=vec3(.9,.77,.5);
          else if(n.y>.5&&c.y==h-1) b=mix(vec3(.33,.6,.3),vec3(.5,.66,.28),hv); else b=vec3(.48,.33,.22);
          b*=.88+.24*hv; b*=b;
          vec3 f=fract(p); vec2 uv=n.x!=0.?f.zy:(n.y!=0.?f.xz:f.xy);
          ivec3 o=c+ivec3(n),a1=n.x!=0.?ivec3(0,0,1):ivec3(1,0,0),a2=n.y!=0.?ivec3(0,0,1):ivec3(0,1,0);
          float s1=float(solid(o+a1)),s2=float(solid(o-a1)),s3=float(solid(o+a2)),s4=float(solid(o-a2));
          vec4 q=vec4(s2+s4+float(solid(o-a1-a2)),s1+s4+float(solid(o+a1-a2)),s2+s3+float(solid(o-a1+a2)),s1+s3+float(solid(o+a1+a2)));
          q=1.-q/3.*.8; float ao=mix(mix(q.x,q.y,uv.x),mix(q.z,q.w,uv.x),uv.y);
          float sh=0.,ts; ivec3 cs; vec3 ns; int ks; if(dot(n,uSunD)>0.&&!dda(p+n*.002,uSunD,96,ts,cs,ns,ks)) sh=1.;
          vec3 lig=vec3(1.,.68,.4)*max(dot(n,uSunD),0.)*sh*3.+vec3(.3,.4,.75)*(.55+.45*n.y)*.42*ao+vec3(.3,.16,.08)*.18*ao;
          vec2 e=min(uv,1.-uv); float edge=mix(1.,.8+.2*smoothstep(0.,.07,min(e.x,e.y)),exp(-t*.025));
          return b*lig*edge;}
        void main(){vec2 uv=(vUv-.5)*vec2(uRes.x/uRes.y,1.);
          vec3 fw=vec3(sin(uView.x)*cos(uView.y),sin(uView.y),cos(uView.x)*cos(uView.y)),rt=normalize(cross(fw,vec3(0,1,0))),up=cross(rt,fw);
          vec3 rd=normalize(fw*1.15+rt*uv.x+up*uv.y); rd+=vec3(1e-6); vec3 ro=uEye;
          float t; ivec3 c; vec3 n; int k; bool hit=dda(ro,rd,int(uSteps),t,c,n,k);
          if(uMode>.5){float h=float(k)/uSteps; vec3 r=h<.33?mix(vec3(.04,.04,.1),vec3(.48,.36,1.),h/.33):h<.66?mix(vec3(.48,.36,1.),vec3(1.,.35,.21),(h-.33)/.33):mix(vec3(1.,.35,.21),vec3(1.,.86,.5),(h-.66)/.34); o=vec4(r,1); return;}
          float tw=rd.y<0.?(WL-ro.y)/rd.y:1e9, te=hit?t:1e9;
          vec3 col=hit?voxel(ro+rd*t,c,n,t):sky(rd);
          if(tw<te){vec3 pw=ro+rd*tw; vec3 wn=normalize(vec3(sin(pw.x*.9+uT*1.4)*.035+sin(pw.z*1.3-uT*1.1)*.025,1.,cos(pw.z*.8+uT*1.2)*.035+sin(pw.x*1.7+uT)*.02));
            float fr=.02+.98*pow(1.-max(dot(-rd,wn),0.),5.); vec3 rr=reflect(rd,wn); float dp=hit?t-tw:40.;
            vec3 under=col*exp(-dp*vec3(.5,.16,.1))+vec3(.0,.018,.035); col=mix(under,sky(rr),fr)+vec3(1.,.8,.55)*pow(max(dot(rr,uSunD),0.),300.)*3.; te=tw;}
          float d=min(te,180.); col=mix(col,sky(rd),1.-exp(-max(d-45.,0.)*.009)); if(!hit&&tw>1e8) col=sky(rd);
          col=1.-exp(-col*1.25); o=vec4(pow(col,vec3(.4545)),1);}`));
      const H0 = (x, z) => hm[(((z | 0) & 255) * N) + ((x | 0) & 255)];
      let ey = -1, last = 0;
      return t => {
        const dt = Math.min(0.1, Math.max(0, t - last)); last = t;
        const px = t * 7, pz = 34 * Math.sin(t * 0.09), vx = 7, vz = 34 * 0.09 * Math.cos(t * 0.09), yaw = Math.atan2(vx, vz) + 0.25 * Math.sin(t * 0.21);
        let top = 0; for (let a = -4; a <= 18; a += 2) for (let b = -6; b <= 6; b += 2) { const s = Math.sin(yaw), c = Math.cos(yaw); top = Math.max(top, H0(px + s * a + c * b, pz + c * a - s * b)); }
        const goal = Math.max(top, 14) + 11; ey = ey < 0 ? goal : ey + (goal - ey) * Math.min(1, dt * 1.6);
        const az = 2.2 + t * 0.06, el = L.p.sun;
        G.draw(prog, null, { uHm: tex, uEye: [px, ey, pz], uView: [yaw, -0.17 - 0.05 * Math.sin(t * 0.3)], uSunD: [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)], uSteps: L.p.steps, uMode: st.mode, uT: t }, W, H);
        G.copy(ctx, W, H);
        hud(ctx, st.mode ? 'DDA STEPS PER PIXEL (DARK = FEW, BRIGHT = MANY)' : 'VOXEL RAY CASTING (DDA)', `256 x 256 x 64 voxels   up to ${L.p.steps} cells per ray   + shadow ray   + 8 occlusion lookups`);
      };
    },
  });

  // ---------------- CPU ray tracer in a worker ----------------
  // Runs inside the Web Worker (turned into a Blob URL below). Each message asks for one bucket:
  // it traces the bucket's pixels and posts the RGBA bytes back.
  function rayWorker() {
    const WS = /** @type {any} */ (self);
    let SP = new Float64Array(0), NS = 0, SPP = 4, DEPTH = 4, E = [0, 0, 0], FW = [0, 0, 1], RT = [1, 0, 0], UP = [0, 1, 0];
    const CR = new Float64Array(8), CG = new Float64Array(8), CB = new Float64Array(8);
    const LS = [[-4.5, 6.5, 3.5, 1.05, 0.86, 0.68], [5, 3.2, -2.5, 0.22, 0.32, 0.55]];
    let HT = 0, HI = -1, seed = 1;
    const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    // Nearest hit along the ray: HI = sphere index, -2 for the floor, -1 for nothing.
    const hit = (ox, oy, oz, dx, dy, dz, tmax) => {
      HT = tmax; HI = -1;
      if (dy < -1e-6) { const t = -oy / dy; if (t > 1e-4 && t < HT) { HT = t; HI = -2; } }
      for (let i = 0; i < NS; i++) {
        const o = i * 10, lx = ox - SP[o], ly = oy - SP[o + 1], lz = oz - SP[o + 2], r = SP[o + 3];
        const b = lx * dx + ly * dy + lz * dz, c = lx * lx + ly * ly + lz * lz - r * r, h = b * b - c; if (h < 0) continue;
        const sq = Math.sqrt(h); let t = -b - sq; if (t < 1e-4) t = -b + sq; if (t > 1e-4 && t < HT) { HT = t; HI = i; }
      }
    };
    const bg = dy => { const k = Math.pow(Math.min(1, Math.max(0, dy * 4)), 0.55); return [0.11 + (0.006 - 0.11) * k, 0.07 + (0.007 - 0.07) * k, 0.2 + (0.022 - 0.2) * k]; };
    // Whitted-style trace; writes the color for recursion level k into CR/CG/CB[k].
    const trace = (k, ox, oy, oz, dx, dy, dz) => {
      hit(ox, oy, oz, dx, dy, dz, 1e9);
      if (HI === -1) { const b = bg(dy); CR[k] = b[0]; CG[k] = b[1]; CB[k] = b[2]; return; }
      const t = HT, id = HI, px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
      let nx = 0, ny = 1, nz = 0, ar, ag, ab, kind = 0, refl = 0;
      if (id === -2) { const chk = (Math.floor(px * 0.8) + Math.floor(pz * 0.8)) & 1; ar = chk ? 0.62 : 0.1; ag = chk ? 0.58 : 0.09; ab = chk ? 0.52 : 0.16; refl = 0.22; }
      else { const o = id * 10, r = SP[o + 3]; nx = (px - SP[o]) / r; ny = (py - SP[o + 1]) / r; nz = (pz - SP[o + 2]) / r; ar = SP[o + 4]; ag = SP[o + 5]; ab = SP[o + 6]; kind = SP[o + 7]; refl = SP[o + 8]; }
      if (kind === 2) {
        let cosi = -(dx * nx + dy * ny + dz * nz), mx = nx, my = ny, mz = nz, eta = 1 / 1.5;
        if (cosi < 0) { cosi = -cosi; mx = -nx; my = -ny; mz = -nz; eta = 1.5; }
        const k2 = 1 - eta * eta * (1 - cosi * cosi); let F = 0.04 + 0.96 * Math.pow(1 - cosi, 5); if (k2 < 0) F = 1;
        const rx = dx + 2 * cosi * mx, ry = dy + 2 * cosi * my, rz = dz + 2 * cosi * mz;
        let r = 0, g = 0, b = 0;
        if (k < DEPTH) {
          trace(k + 1, px + mx * 1e-3, py + my * 1e-3, pz + mz * 1e-3, rx, ry, rz); r = CR[k + 1] * F; g = CG[k + 1] * F; b = CB[k + 1] * F;
          if (F < 1) { const q = eta * cosi - Math.sqrt(k2); trace(k + 1, px - mx * 1e-3, py - my * 1e-3, pz - mz * 1e-3, eta * dx + q * mx, eta * dy + q * my, eta * dz + q * mz); r += CR[k + 1] * (1 - F) * 0.97; g += CG[k + 1] * (1 - F) * 0.99; b += CB[k + 1] * (1 - F); }
        }
        CR[k] = r; CG[k] = g; CB[k] = b; return;
      }
      let r = ar * 0.05, g = ag * 0.06, b = ab * 0.09;
      const vx = -dx, vy = -dy, vz = -dz;
      if (kind === 0) for (const l of LS) {
        const sx = l[0] + (rnd() - 0.5) * 1.2, sy = l[1] + (rnd() - 0.5) * 1.2, sz = l[2] + (rnd() - 0.5) * 1.2;
        let lx = sx - px, ly = sy - py, lz = sz - pz; const d = Math.hypot(lx, ly, lz); lx /= d; ly /= d; lz /= d;
        const nl = nx * lx + ny * ly + nz * lz; if (nl <= 0) continue;
        hit(px + nx * 1e-3, py + ny * 1e-3, pz + nz * 1e-3, lx, ly, lz, d); if (HI !== -1) continue;
        let hx = lx + vx, hy = ly + vy, hz = lz + vz; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
        const sp = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), 60) * (id === -2 ? 0.2 : 0.7);
        r += (ar * nl + sp) * l[3]; g += (ag * nl + sp) * l[4]; b += (ab * nl + sp) * l[5];
      }
      if (refl > 0 && k < DEPTH) {
        const dn = dx * nx + dy * ny + dz * nz, cosi = -dn, F = kind === 1 ? refl : refl + (1 - refl) * Math.pow(1 - cosi, 5) * 0.45;
        trace(k + 1, px + nx * 1e-3, py + ny * 1e-3, pz + nz * 1e-3, dx - 2 * dn * nx, dy - 2 * dn * ny, dz - 2 * dn * nz);
        const tr = kind === 1 ? ar : 1, tg = kind === 1 ? ag : 1, tb = kind === 1 ? ab : 1;
        r = r * (1 - F) + CR[k + 1] * F * tr; g = g * (1 - F) + CG[k + 1] * F * tg; b = b * (1 - F) + CB[k + 1] * F * tb;
      }
      if (id === -2) { const f = 1 - Math.exp(-t * 0.03), c = bg(0.01); r += (c[0] - r) * f; g += (c[1] - g) * f; b += (c[2] - b) * f; }
      CR[k] = r; CG[k] = g; CB[k] = b;
    };
    WS.onmessage = e => {
      const m = e.data;
      if (m.scene) { SP = m.scene.sp; NS = SP.length / 10; SPP = m.scene.spp; DEPTH = m.scene.depth; E = m.scene.eye; FW = m.scene.fw; RT = m.scene.rt; UP = m.scene.up; return; }
      const { x0, y0, w, h, W, H, id } = m, out = new Uint8ClampedArray(w * h * 4), n = SPP, ns = n * n;
      seed = (x0 * 7919 + y0 * 104729 + 1) | 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0;
        for (let s = 0; s < ns; s++) {
          const u = ((x0 + x + ((s % n) + rnd()) / n) - W / 2) / H, v = (H / 2 - (y0 + y + (Math.floor(s / n) + rnd()) / n)) / H;
          let dx = FW[0] * 1.6 + RT[0] * u + UP[0] * v, dy = FW[1] * 1.6 + RT[1] * u + UP[1] * v, dz = FW[2] * 1.6 + RT[2] * u + UP[2] * v; const l = Math.hypot(dx, dy, dz);
          dx /= l; dy /= l; dz /= l; trace(0, E[0], E[1], E[2], dx, dy, dz); r += CR[0]; g += CG[0]; b += CB[0];
        }
        const o = (y * w + x) * 4, f = c => 255 * Math.pow((c / ns) / (1 + c / ns * 0.55), 1 / 2.2);
        out[o] = f(r); out[o + 1] = f(g); out[o + 2] = f(b); out[o + 3] = 255;
      }
      WS.postMessage({ id, x0, y0, w, h, out }, [out.buffer]);
    };
  }

  EX.add({
    cat: 'scratch', id: 'x-bucket', title: 'Ray tracer in a worker', aka: 'Whitted ray tracing, bucket rendering, Web Worker, offline renderer', tool: 'Plain JavaScript ray tracer in a Blob Web Worker + Canvas 2D', runs: 'CPU',
    notice: 'A classic ray tracer in plain JavaScript, running in a background Web Worker so the page never stalls. The image is cut into 32 px buckets rendered from the center outward, like V-Ray or Arnold: each pixel shoots several rays, finds the nearest ball or floor, checks two soft lights for shadows and recurses for chrome reflections and glass refraction. Each finished bucket is posted back and painted over the last shot.',
    use: 'offline renders without a GPU, understanding render buckets and ray depth, heavy work kept off the main thread',
    params: [{ key: 'aa', label: 'Rays per pixel (n x n)', min: 1, max: 5, step: 1, value: 3 }, { key: 'depth', label: 'Ray depth', min: 1, max: 6, step: 1, value: 4 }],
    prompt: 'Write a Whitted-style ray tracer from scratch in plain JavaScript that runs in a Web Worker made from a Blob URL: spheres and a checker floor, two soft area lights with shadow rays, Blinn highlights, chrome reflection, glass refraction with Fresnel, {aa} x {aa} jittered rays per pixel, recursion depth {depth}. Render 640 x 360 in 32 px buckets ordered from the center outward, two buckets in flight, painted over the previous frame with amber corner brackets on the active buckets. Hold each finished image 2.5 s, then orbit the camera and render the next.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const st = (L.state = L.state || { worker: /** @type {Worker} */ (null) });
      if (st.worker) st.worker.terminate();
      const url = URL.createObjectURL(new Blob(['(' + rayWorker.toString() + ')()'], { type: 'text/javascript' }));
      const wk = (st.worker = new Worker(url)); URL.revokeObjectURL(url);
      const img = document.createElement('canvas'); img.width = W; img.height = H; const ig = img.getContext('2d');
      ig.fillStyle = C.bg; ig.fillRect(0, 0, W, H);
      const TS = 32, tiles = [];
      for (let y = 0; y < H; y += TS) for (let x = 0; x < W; x += TS) tiles.push({ x, y, w: Math.min(TS, W - x), h: Math.min(TS, H - y), d: Math.hypot(x + TS / 2 - W / 2, (y + TS / 2 - H / 2) * 1.3) });
      tiles.sort((a, b) => a.d - b.d);
      const PAL = [C.cyan, C.violet, C.cream, C.green, C.cyan, C.violet, C.cream, C.amber].map(hexRGB);
      let shot = -1, next = 0, done = 0, busy = new Map(), holdUntil = 0, t0 = 0, took = 0, tNow = 0;
      // Builds the scene for one shot (camera orbit and ring angle) and sends it to the worker.
      const newShot = () => {
        shot++; next = 0; done = 0; t0 = performance.now();
        const sp = [], add = (x, y, z, r, c, kind, refl) => sp.push(x, y, z, r, c[0], c[1], c[2], kind, refl, 0);
        const lin = c => c.map(v => Math.pow(v / 255, 2.2));
        add(0, 1.15, 0, 1.15, [0.95, 0.93, 0.9], 1, 0.92);
        add(-2.45, 0.8, 1.1, 0.8, [1, 1, 1], 2, 0);
        add(2.35, 0.72, 0.9, 0.72, lin(hexRGB(C.coral)), 0, 0.03);
        add(1.05, 0.42, 2.45, 0.42, lin(hexRGB(C.amber)), 0, 0.3);
        const ring = shot * 0.55;
        for (let i = 0; i < 8; i++) { const a = ring + i * Math.PI / 4; add(Math.cos(a) * 3.9, 0.28, Math.sin(a) * 3.9 - 0.4, 0.28, lin(PAL[i]), i % 4 === 3 ? 1 : 0, i % 4 === 3 ? 0.85 : 0.02); }
        const ca = 0.25 + shot * 0.75, eye = [Math.sin(ca) * 7.6, 2.2 + Math.sin(shot * 1.7) * 0.7, Math.cos(ca) * 7.6], tgt = [0, 0.75, 0];
        const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / l); };
        const fw = nrm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]), rt = nrm([fw[1] * 0 - fw[2] * 1, fw[2] * 0 - fw[0] * 0, fw[0] * 1 - fw[1] * 0]);
        const up = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
        wk.postMessage({ scene: { sp: Float64Array.from(sp), spp: L.p.aa, depth: L.p.depth, eye, fw, rt, up } });
        ig.fillStyle = 'rgba(11,11,16,0.62)'; ig.fillRect(0, 0, W, H);
      };
      wk.onmessage = e => {
        const m = e.data; if (m.id !== shot) return;
        ig.putImageData(new ImageData(m.out, m.w, m.h), m.x0, m.y0); busy.delete(m.x0 + ',' + m.y0); done++;
        if (done === tiles.length) { took = (performance.now() - t0) / 1000; holdUntil = tNow + 2.5; }
      };
      return t => {
        tNow = t;
        if (shot < 0 || (done === tiles.length && t > holdUntil)) newShot();
        while (busy.size < 2 && next < tiles.length) { const q = tiles[next++]; busy.set(q.x + ',' + q.y, q); wk.postMessage({ id: shot, x0: q.x, y0: q.y, w: q.w, h: q.h, W, H }); }
        g.drawImage(img, 0, 0);
        g.strokeStyle = C.amber; g.lineWidth = 2;
        for (const q of busy.values()) {
          const x = q.x + 1, y = q.y + 1, w = q.w - 2, h = q.h - 2, c = 7; g.fillStyle = 'rgba(255,176,32,0.12)'; g.fillRect(x, y, w, h);
          g.beginPath(); g.moveTo(x, y + c); g.lineTo(x, y); g.lineTo(x + c, y); g.moveTo(x + w - c, y); g.lineTo(x + w, y); g.lineTo(x + w, y + c);
          g.moveTo(x + w, y + h - c); g.lineTo(x + w, y + h); g.lineTo(x + w - c, y + h); g.moveTo(x + c, y + h); g.lineTo(x, y + h); g.lineTo(x, y + h - c); g.stroke();
        }
        hud(g, done < tiles.length ? 'RENDERING IN A WEB WORKER' : 'DONE: HOLDING THE FRAME', `bucket ${done} / ${tiles.length}   ${L.p.aa * L.p.aa} rays per pixel   depth ${L.p.depth}   ${took ? took.toFixed(1) + ' s per image' : 'first image'}`, done < tiles.length ? C.amber : C.green);
      };
    },
  });

  // ---------------- synth from raw samples ----------------
  EX.add({
    cat: 'scratch', id: 'x-synth', title: 'Synth from raw samples', aka: 'software synthesizer, acid bassline, DSP from scratch, sample-by-sample audio', tool: 'Plain JavaScript DSP into a Float32Array, played as a Web Audio AudioBuffer', runs: 'CPU',
    notice: 'All 341,000 samples of this 7.7 s loop are computed in JavaScript: a band-limited sawtooth, a resonant filter whose cutoff is kicked open by an envelope on each note, an amplitude envelope, a feedback delay, plus a kick, hats and a clap made from a sine and noise. Web Audio only plays the finished buffer. The scope, step grid, envelope and filter curve all read the same numbers; press "Play sound" to hear them.',
    use: 'understanding what a synth plugin does inside, generated sound effects and music for games, audio without any library',
    params: [{ key: 'cut', label: 'Filter cutoff', min: 80, max: 2000, step: 10, value: 300, unit: ' Hz' }, { key: 'res', label: 'Resonance', min: 0, max: 0.97, step: 0.01, value: 0.84 }, { key: 'env', label: 'Envelope amount', min: 0, max: 6, step: 0.1, value: 3.6, unit: ' oct' }, { key: 'dec', label: 'Envelope decay', min: 0.03, max: 0.6, step: 0.01, value: 0.17, unit: ' s' }],
    prompt: 'Write a synth from scratch in plain JavaScript that computes every sample into a Float32Array (44.1 kHz, 7.7 s loop at 124 BPM) and plays it as a looping AudioBuffer after a "Play sound" click: a PolyBLEP sawtooth acid bassline through a resonant state-variable low-pass (cutoff {cut}, resonance {res}), filter envelope {env} with decay {dec}, accents, a dotted-eighth feedback delay, a sine kick with a pitch drop, noise hats and a clap, soft clipping. Draw it live: a triggered oscilloscope of the bass, the 16-step grid with the playhead, the filter envelope with a moving dot, and the filter frequency response with its resonant peak. Re-render the buffer when a slider moves.',
    controls: [{ label: 'Play sound', group: false, fn: L => L.state.play() }, { label: 'Stop', group: false, fn: L => L.state.stop() }],
    setup(cv, L) {
      const g = cv.getContext('2d');
      const SR = 44100, STEP = 60 / 124 / 4, BARS = 4, LOOP = STEP * 16 * BARS, LEN = Math.round(LOOP * SR);
      const A = [0, -1, 12, 0, -1, 15, 0, 12, 0, -1, 10, 0, 3, -1, 12, 7], B = [0, -1, 12, 0, -1, 15, 0, 12, 0, 19, 10, -1, 17, 15, 12, 10];
      const SEQ = [A, A, B, A.map((n, i) => i === 15 ? 19 : n)], ACC = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
      const mix = new Float32Array(LEN), bass = new Float32Array(LEN), cut = new Float32Array(Math.ceil(LEN / 64) + 1), dl = new Float32Array(Math.round(STEP * 3 * SR));
      let ns = 1;
      const noise = () => { ns ^= ns << 13; ns ^= ns >>> 17; ns ^= ns << 5; return (ns >>> 0) / 2147483648 - 1; };
      const blep = (p, dt) => { if (p < dt) { p /= dt; return p + p - p * p - 1; } if (p > 1 - dt) { p = (p - 1) / dt; return p * p + p + p + 1; } return 0; };
      let rendered = '', renderMs = 0;
      // Computes the whole loop, sample by sample, into mix (what you hear) and bass (what the scope shows).
      const render = () => {
        const t0 = performance.now(); const P = L.p; ns = 1; dl.fill(0);
        let ph = 0, ic1 = 0, ic2 = 0, amp = 0, kph = 0, hlp = 0, b1 = 0, b2 = 0, di = 0;
        const k = 2 - 2 * P.res;
        for (let i = 0; i < LEN; i++) {
          const t = i / SR, s = Math.floor(t / STEP), w = t - s * STEP, n = SEQ[Math.floor(s / 16) % BARS][s % 16], acc = ACC[s % 16];
          let back = 0; while (back < 16 && SEQ[Math.floor(((s - back + 64) % 64) / 16)][(s - back + 64) % 16] < 0) back++;
          const pn = SEQ[Math.floor(((s - back + 64) % 64) / 16)][(s - back + 64) % 16], since = w + back * STEP;
          const f = 55 * Math.pow(2, Math.max(0, pn) / 12), dt = f / SR;
          ph += dt; if (ph >= 1) ph -= 1;
          const osc = 2 * ph - 1 - blep(ph, dt);
          const gate = n >= 0 && w < STEP * 0.6; amp += ((gate ? 1 : 0) - amp) * (gate ? 0.03 : 0.006);
          const fe = Math.exp(-since / (P.dec * (acc ? 0.7 : 1))), fc = Math.min(SR * 0.45, P.cut * Math.pow(2, P.env * fe * (acc ? 1.25 : 1)));
          const gg = Math.tan(Math.PI * fc / SR), a1 = 1 / (1 + gg * (gg + k)), a2 = gg * a1, a3 = gg * a2;
          const v3 = osc - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3; ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
          const bo = Math.tanh(v2 * (acc ? 2.2 : 1.6)) * amp * (acc ? 1 : 0.75);
          const echo = dl[di]; dl[di] = bo + echo * 0.38; di = (di + 1) % dl.length;
          if ((i & 63) === 0) cut[i >> 6] = fc;
          let kick = 0; if (s % 4 === 0) { const kf = 44 + 120 * Math.exp(-w * 32); kph += 2 * Math.PI * kf / SR; kick = Math.sin(kph) * Math.exp(-w * 7); } else kph = 0;
          const nz = noise(); hlp += (nz - hlp) * 0.35; const hp = nz - hlp;
          const hat = hp * Math.exp(-w * (s % 4 === 2 ? 22 : 70)) * (s % 4 === 2 ? 0.22 : 0.07);
          let clap = 0; if (s % 8 === 4) { b1 += 0.16 * (nz - b1 - b2 * 0.4); b2 += 0.16 * b1; clap = b1 * Math.exp(-w * 16) * 0.9; }
          bass[i] = bo; mix[i] = Math.tanh((kick * 0.9 + bo * 0.42 + echo * 0.16 + hat + clap) * 1.1) * 0.85;
        }
        renderMs = performance.now() - t0;
      };
      const st = (L.state = L.state || { ac: null, src: null, start: 0, play: () => {}, stop: () => {} });
      if (st.src) { st.src.stop(); st.src = null; }
      // Starts (or restarts) the looping buffer at the given offset in seconds.
      const start = off => {
        const ac = st.ac; if (st.src) st.src.stop();
        const buf = ac.createBuffer(1, LEN, SR); buf.copyToChannel(mix, 0);
        const src = ac.createBufferSource(); src.buffer = buf; src.loop = true; const gn = ac.createGain(); gn.gain.value = 0.7; src.connect(gn).connect(ac.destination);
        src.start(0, off); st.src = src; st.start = ac.currentTime - off;
      };
      st.play = () => { if (!st.ac) st.ac = new AudioContext(); st.ac.resume(); start(0); };
      st.stop = () => { if (st.src) { st.src.stop(); st.src = null; } };
      // The looping sound stops when the card scrolls out of view.
      if (!cv.dataset.soundWatch) { cv.dataset.soundWatch = '1'; new IntersectionObserver(es => { if (!es[0].isIntersecting) { L.state.stop(); if (L.state.ac) L.state.ac.suspend(); } }).observe(cv); }
      const key = () => [L.p.cut, L.p.res, L.p.env, L.p.dec].join();
      let changedAt = -1, pend = '';
      render(); rendered = key();
      const RX = 330, RW = 294, EX0 = 16, EW = 294;
      return t => {
        const kk = key();
        if (kk !== rendered) { if (kk !== pend) { pend = kk; changedAt = t; } else if (t - changedAt > 0.12) { render(); rendered = kk; if (st.src) start((st.ac.currentTime - st.start) % LOOP); } }
        const pt = st.src ? (st.ac.currentTime - st.start) % LOOP : t % LOOP, pi = Math.min(LEN - 1, Math.floor(pt * SR)), s = Math.floor(pt / STEP), w = pt - s * STEP;
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        // Oscilloscope of the last 2,400 bass samples played, triggered on a rising zero crossing.
        let j = Math.max(1, pi - 2400); for (let n = 0; n < 2400 && j > 1; n++, j--) if (bass[j - 1] < 0 && bass[j] >= 0) break;
        g.strokeStyle = 'rgba(244,239,230,0.07)'; g.lineWidth = 1; g.beginPath(); g.moveTo(16, 104.5); g.lineTo(W - 16, 104.5); g.stroke();
        g.strokeStyle = 'rgba(244,239,230,0.22)'; g.beginPath(); for (let x = 0; x < W - 32; x++) { const v = mix[j + x * 2]; x ? g.lineTo(16 + x, 104 - v * 36) : g.moveTo(16, 104 - v * 36); } g.stroke();
        g.strokeStyle = C.coral; g.lineWidth = 2; g.shadowColor = C.coral; g.shadowBlur = 10; g.beginPath(); for (let x = 0; x < W - 32; x++) { const v = bass[j + x * 2]; x ? g.lineTo(16 + x, 104 - v * 48) : g.moveTo(16, 104 - v * 48); } g.stroke(); g.shadowBlur = 0;
        // 16-step grid of the current bar with the playhead.
        const bar = Math.floor(s / 16) % BARS, sq = SEQ[bar], cw = (W - 32) / 16;
        for (let i = 0; i < 16; i++) {
          const x = 16 + i * cw, on = i === s % 16, n = sq[i];
          g.fillStyle = on ? 'rgba(255,90,54,0.16)' : (i % 4 ? 'rgba(244,239,230,0.03)' : 'rgba(244,239,230,0.06)'); g.fillRect(x + 1, 166, cw - 2, 62);
          if (n >= 0) { const y = 214 - n / 19 * 40, pop = on ? 1 + 0.5 * Math.exp(-w * 14) : 1; g.fillStyle = on ? C.cream : ACC[i] ? C.amber : 'rgba(244,239,230,0.55)'; g.fillRect(x + cw / 2 - 9 * pop, y - 3 * pop, 18 * pop, 6 * pop); }
          g.fillStyle = i % 4 === 0 ? C.coral : i % 8 === 4 ? C.cyan : 'rgba(244,239,230,0.25)'; g.beginPath(); g.arc(x + cw / 2, 236, i % 4 === 0 ? 3 : i % 8 === 4 ? 2.5 : 1.5, 0, 7); g.fill();
        }
        g.font = '10px Cascadia Mono, Consolas, monospace'; g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(244,239,230,0.5)';
        g.fillText(`BAR ${bar + 1}/4   STEP ${s % 16 + 1}/16`, 16, 160); g.fillText('BASS VOICE (CORAL) AND FULL MIX', 16, 44 + 6);
        // Filter envelope of the current note, with the playhead dot.
        let back = 0; while (back < 15 && sq[(s % 16 - back + 16) % 16] < 0) back++;
        const since = w + back * STEP, acc = ACC[(s % 16 - back + 16) % 16], dec = L.p.dec * (acc ? 0.7 : 1), span = 0.6;
        g.fillStyle = 'rgba(244,239,230,0.5)'; g.fillText('FILTER ENVELOPE', EX0, 258); g.fillText('FILTER RESPONSE', RX, 258);
        g.strokeStyle = 'rgba(244,239,230,0.12)'; g.strokeRect(EX0 + 0.5, 264.5, EW, 56); g.strokeRect(RX + 0.5, 264.5, RW, 56);
        g.strokeStyle = C.amber; g.lineWidth = 1.5; g.beginPath(); for (let x = 0; x <= EW; x += 2) { const tt = x / EW * span, y = 318 - Math.exp(-tt / dec) * 50; x ? g.lineTo(EX0 + x, y) : g.moveTo(EX0 + x, y); } g.stroke();
        if (since < span) { const x = EX0 + since / span * EW, y = 318 - Math.exp(-since / dec) * 50; g.fillStyle = C.cream; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
        // Low-pass response |H| of the state-variable filter at the cutoff playing right now.
        const fc = cut[pi >> 6] || L.p.cut, kq = 2 - 2 * L.p.res;
        g.strokeStyle = C.cyan; g.lineWidth = 1.5; g.beginPath();
        for (let x = 0; x <= RW; x += 2) { const f = 20 * Math.pow(1000, x / RW), r = f / fc, m = 1 / Math.sqrt((1 - r * r) * (1 - r * r) + kq * kq * r * r), db = 20 * Math.log10(m), y = Math.min(320, Math.max(266, 292 - db * 0.85)); x ? g.lineTo(RX + x, y) : g.moveTo(RX + x, y); }
        g.stroke(); const cx = RX + Math.log(fc / 20) / Math.log(1000) * RW; g.fillStyle = 'rgba(43,196,230,0.5)'; g.fillRect(cx, 266, 1, 54);
        g.fillStyle = 'rgba(244,239,230,0.5)'; g.fillText(`${Math.round(fc)} Hz`, Math.min(RX + RW - 50, cx + 4), 276);
        hud(g, st.src ? 'PLAYING: EVERY SAMPLE COMPUTED IN JAVASCRIPT' : 'SILENT: PRESS PLAY SOUND TO HEAR IT', `${LEN.toLocaleString('en-US')} samples   ${SR} Hz   rendered in ${renderMs.toFixed(0)} ms`, st.src ? C.green : C.coral);
      };
    },
  });

  // ---------------- 2.5D raycaster ----------------
  EX.add({
    cat: 'scratch', id: 'x-raycast', title: 'Raycaster (1992 style)', aka: 'Wolfenstein 3D engine, 2.5D raycasting, textured walls, floor casting', tool: 'Plain JavaScript writing pixels into an ImageData (no WebGL)', runs: 'CPU',
    notice: 'The world is a flat 16 x 16 grid: for each of the 640 screen columns one ray walks the grid until it meets a wall, and its distance sets how tall that wall slice is drawn and where on the texture to read. Floor and ceiling are filled row by row, glowing orbs are sprites hidden behind nearer walls, and light fades with distance. "Map and rays" shows the rays from above; "Fish-eye" uses the raw distance instead of the corrected one, which bends every wall.',
    use: 'retro game looks, teaching how early 3D games worked, very cheap first-person scenes',
    params: [{ key: 'fov', label: 'Field of view', min: 40, max: 120, step: 1, value: 70, unit: ' deg' }, { key: 'light', label: 'Light reach', min: 0.2, max: 3, step: 0.1, value: 1, unit: 'x' }],
    prompt: 'Write a Wolfenstein-style raycaster from scratch in plain JavaScript into an ImageData: a 16 x 16 grid map, one DDA ray per screen column with fish-eye correction, four 64 px wall textures drawn on a canvas (brick, tech panel, wood, stone), row-by-row floor and ceiling casting, glowing orb sprites clipped by a per-column depth buffer, distance light with reach {light}, field of view {fov}. The camera walks a smooth loop through the halls with a gentle head bob; a minimap shows the ray fan. Buttons for a top-down rays view and a fish-eye view.',
    controls: [{ label: 'Textured', on: true, fn: L => { L.state.mode = 0; } }, { label: 'Map and rays', fn: L => { L.state.mode = 1; } }, { label: 'Fish-eye', fn: L => { L.state.mode = 2; } }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const st = (L.state = L.state || { mode: 0 });
      const MAP = ['1111111111111111', '1......2.......1', '1.33...2..444..1', '1.3....2....4..1', '1......2222.4..1', '1..............1', '1.2222....3333.1', '1.2..........3.1', '1.2..44..44..3.1', '1.2..........3.1', '1.2222.33......1', '1..............1', '1..444...222...1', '1....4...2.....1', '1..............1', '1111111111111111'];
      const MW = 16, M = new Uint8Array(MW * MW); MAP.forEach((r, y) => r.split('').forEach((c, x) => { M[y * MW + x] = c === '.' ? 0 : +c; }));
      // 64 px textures painted on a canvas once, read back as packed RGBA words.
      const TS = 64, tc = document.createElement('canvas'); tc.width = TS; tc.height = TS; const tg = tc.getContext('2d', { willReadFrequently: true });
      const grab = paint => { tg.clearRect(0, 0, TS, TS); paint(tg); return new Uint32Array(tg.getImageData(0, 0, TS, TS).data.buffer.slice(0)); };
      const r = EX.rng(5);
      const TEX = [null,
        grab(c => { c.fillStyle = '#2a1414'; c.fillRect(0, 0, 64, 64); for (let y = 0; y < 8; y++) for (let x = -1; x < 4; x++) { c.fillStyle = `hsl(${10 + r() * 10},${60 + r() * 15}%,${38 + r() * 12}%)`; c.fillRect(x * 16 + (y % 2) * 8 + 1, y * 8 + 1, 14, 6); } }),
        grab(c => { c.fillStyle = '#16203a'; c.fillRect(0, 0, 64, 64); c.strokeStyle = '#2bc4e6'; c.lineWidth = 2; c.strokeRect(5, 5, 54, 54); c.fillStyle = '#0d1426'; c.fillRect(12, 12, 40, 26); c.fillStyle = '#2bc4e6'; for (let i = 0; i < 5; i++) c.fillRect(16, 16 + i * 4, 8 + r() * 26, 2); c.fillStyle = '#ffb020'; c.fillRect(14, 46, 6, 6); c.fillStyle = '#ff5a36'; c.fillRect(24, 46, 6, 6); }),
        grab(c => { for (let i = 0; i < 4; i++) { c.fillStyle = `hsl(${30 + r() * 8},${55 + r() * 10}%,${30 + r() * 10}%)`; c.fillRect(i * 16, 0, 16, 64); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(i * 16, 0, 1, 64); for (let k = 0; k < 5; k++) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(i * 16 + 2 + r() * 12, r() * 64, 1, 8 + r() * 20); } } }),
        grab(c => { c.fillStyle = '#25212f'; c.fillRect(0, 0, 64, 64); for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) { c.fillStyle = `hsl(${255 + r() * 20},${10 + r() * 10}%,${30 + r() * 10}%)`; c.fillRect(x * 32 + (y % 2) * 16 - 16 + 1, y * 16 + 1, 30, 14); c.fillRect(x * 32 + (y % 2) * 16 + 48 + 1, y * 16 + 1, 30, 14); } c.fillStyle = 'rgba(95,211,141,0.5)'; for (let i = 0; i < 40; i++) c.fillRect(r() * 64, 44 + r() * 20, 2, 2); }),
      ];
      const FLO = grab(c => { c.fillStyle = '#1b1a24'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#23222e'; c.fillRect(0, 0, 32, 32); c.fillRect(32, 32, 32, 32); c.fillStyle = 'rgba(244,239,230,0.08)'; c.fillRect(0, 0, 64, 1); c.fillRect(0, 0, 1, 64); });
      const CEI = grab(c => { c.fillStyle = '#121120'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#1a1830'; c.fillRect(2, 2, 60, 60); c.fillStyle = 'rgba(255,176,32,0.55)'; c.fillRect(26, 26, 12, 12); });
      const SPR = [[6.5, 5.25, 0], [10.5, 5.75, 1], [8.5, 8.5, 0], [12.5, 11.25, 1], [6.5, 11.75, 0], [1.75, 8.5, 1], [14.25, 8.5, 0]];
      const img = g.createImageData(W, H), px = new Uint32Array(img.data.buffer), zb = new Float32Array(W), hitX = new Float32Array(W), hitY = new Float32Array(W);
      // Camera path: a closed Catmull-Rom loop through the halls.
      const WP = [[3, 5.5], [13, 5.5], [14.5, 7], [14.5, 10], [13, 11.5], [3, 11.5], [1.5, 10], [1.5, 7]];
      const path = u => { const n = WP.length, i = Math.floor(u) % n, f = u - Math.floor(u), p = k => WP[((i + k) % n + n) % n];
        const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (3 * b - a - 3 * c + d) * f * f * f);
        return [cr(p(-1)[0], p(0)[0], p(1)[0], p(2)[0]), cr(p(-1)[1], p(0)[1], p(1)[1], p(2)[1])]; };
      const shade = (c, f) => { const r2 = (c & 255) * f + 6 * (1 - f), g2 = (c >> 8 & 255) * f + 5 * (1 - f), b2 = (c >> 16 & 255) * f + 14 * (1 - f); return 255 << 24 | b2 << 16 | g2 << 8 | r2; };
      return t => {
        const u = t * 0.16, P = path(u), Q = path(u + 0.3), ang = Math.atan2(Q[1] - P[1], Q[0] - P[0]);
        const pX = P[0], pY = P[1], dX = Math.cos(ang), dY = Math.sin(ang), pl = Math.tan(L.p.fov * Math.PI / 360), plX = -dY * pl, plY = dX * pl;
        const bob = Math.sin(t * 7.2) * 4, hz = H / 2 + bob, reach = L.p.light, lit = d => Math.min(1, 1.25 / (1 + d * d * 0.05 / (reach * reach)));
        // Floor and ceiling, one row at a time.
        for (let y = 0; y < H; y++) {
          const p = y - hz; if (Math.abs(p) < 1) { px.fill(0xff0e0b0b, y * W, y * W + W); continue; }
          const rd = (H / 2) / Math.abs(p), fx0 = dX - plX, fy0 = dY - plY, sx = rd * 2 * plX / W, sy = rd * 2 * plY / W, T = p > 0 ? FLO : CEI, f = lit(rd);
          let fx = pX + rd * fx0, fy = pY + rd * fy0; const row = y * W;
          for (let x = 0; x < W; x++, fx += sx, fy += sy) px[row + x] = shade(T[((fy * TS) & 63) * TS + ((fx * TS) & 63)], f);
        }
        // Walls: one DDA ray per column.
        for (let x = 0; x < W; x++) {
          const cx = 2 * x / W - 1, rx = dX + plX * cx, ry = dY + plY * cx, ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry);
          let mx = pX | 0, my = pY | 0; const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
          let sdx = (rx < 0 ? pX - mx : mx + 1 - pX) * ddx, sdy = (ry < 0 ? pY - my : my + 1 - pY) * ddy, side = 0, cell = 0;
          for (let k = 0; k < 64; k++) { if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; } cell = M[my * MW + mx]; if (cell) break; }
          const perp = side ? sdy - ddy : sdx - ddx, d = st.mode === 2 ? perp * Math.hypot(rx, ry) : perp;
          zb[x] = perp; hitX[x] = pX + rx * perp; hitY[x] = pY + ry * perp;
          let wx = side ? pX + perp * rx : pY + perp * ry; wx -= Math.floor(wx); let tx = (wx * TS) | 0; if ((side === 0 && rx > 0) || (side === 1 && ry < 0)) tx = TS - 1 - tx;
          const lh = H / d, y0 = Math.max(0, Math.ceil(hz - lh / 2)), y1 = Math.min(H - 1, Math.floor(hz + lh / 2)), T = TEX[cell] || TEX[1], f = lit(perp) * (side ? 0.72 : 1);
          let ty = (y0 - (hz - lh / 2)) * TS / lh; const ts = TS / lh;
          for (let y = y0; y <= y1; y++, ty += ts) px[y * W + x] = shade(T[((ty | 0) & 63) * TS + tx], f);
        }
        // Orb sprites, additive, hidden behind nearer walls.
        const inv = 1 / (plX * dY - dX * plY);
        for (const [sx0, sy0, kind] of SPR) {
          const rx = sx0 - pX, ry = sy0 - pY, tx = inv * (dY * rx - dX * ry), ty = inv * (-plY * rx + plX * ry); if (ty < 0.2) continue;
          const sxc = W / 2 * (1 + tx / ty), sz = H / ty * 0.3, yc = hz - H / ty * (0.16 + 0.04 * Math.sin(t * 2 + sx0)), col = kind ? [43, 196, 230] : [255, 176, 32], f = lit(ty) * 1.3;
          const x0 = Math.max(0, Math.floor(sxc - sz)), x1 = Math.min(W - 1, Math.ceil(sxc + sz)), ya = Math.max(0, Math.floor(yc - sz)), yb = Math.min(H - 1, Math.ceil(yc + sz));
          for (let x = x0; x <= x1; x++) { if (ty > zb[x]) continue; const dxn = (x - sxc) / sz;
            for (let y = ya; y <= yb; y++) { const dyn = (y - yc) / sz, q = dxn * dxn + dyn * dyn; if (q > 1) continue; const a = (q < 0.06 ? 1.6 : Math.pow(1 - q, 2.2) * 0.75) * f, k = y * W + x, c = px[k];
              px[k] = 255 << 24 | Math.min(255, (c >> 16 & 255) + col[2] * a) << 16 | Math.min(255, (c >> 8 & 255) + col[1] * a) << 8 | Math.min(255, (c & 255) + col[0] * a); } }
        }
        g.putImageData(img, 0, 0);
        // Minimap (or the big map view) with the ray fan.
        const big = st.mode === 1, cs = big ? 20 : 7, ox = big ? (W - MW * cs) / 2 : W - MW * cs - 14, oy = big ? (H - MW * cs) / 2 : 14;
        if (big) { g.fillStyle = 'rgba(11,11,16,0.72)'; g.fillRect(0, 0, W, H); }
        g.fillStyle = 'rgba(11,11,16,0.7)'; g.fillRect(ox - 4, oy - 4, MW * cs + 8, MW * cs + 8);
        const MC = ['', '#c2412a', '#2bc4e6', '#c98a2c', '#6f6884'];
        for (let y = 0; y < MW; y++) for (let x = 0; x < MW; x++) { const c = M[y * MW + x]; if (c) { g.fillStyle = MC[c]; g.fillRect(ox + x * cs, oy + y * cs, cs - (big ? 1 : 0), cs - (big ? 1 : 0)); } }
        g.strokeStyle = big ? 'rgba(255,176,32,0.35)' : 'rgba(255,176,32,0.45)'; g.lineWidth = 1; g.beginPath();
        for (let x = 0; x < W; x += big ? 4 : 16) { g.moveTo(ox + pX * cs, oy + pY * cs); g.lineTo(ox + hitX[x] * cs, oy + hitY[x] * cs); } g.stroke();
        for (const [sx0, sy0, kind] of SPR) { g.fillStyle = kind ? C.cyan : C.amber; g.beginPath(); g.arc(ox + sx0 * cs, oy + sy0 * cs, big ? 4 : 2, 0, 7); g.fill(); }
        g.fillStyle = C.cream; g.beginPath(); g.arc(ox + pX * cs, oy + pY * cs, big ? 5 : 3, 0, 7); g.fill();
        hud(g, ['RAYCASTING: ONE RAY PER COLUMN', 'TOP VIEW: 640 RAYS, ONE PER COLUMN', 'FISH-EYE: RAW RAY LENGTH, NO CORRECTION'][st.mode], `16 x 16 map   640 rays   ${L.p.fov} deg field of view   no WebGL`, st.mode === 2 ? C.amber : C.coral);
      };
    },
  });

  // ---------------- JPEG-style codec ----------------
  EX.add({
    cat: 'scratch', id: 'x-codec', title: 'Image codec (JPEG style)', aka: 'DCT compression, quantization, compression artifacts, JPEG from scratch', tool: 'Plain JavaScript DCT codec on Canvas 2D pixels', runs: 'CPU',
    notice: 'Every frame, a moving picture is squeezed the way JPEG does it: colors split into brightness and half-size color, each 8 x 8 block turned into 64 wave strengths with a DCT, those strengths divided by a quality table and rounded (most become zero, which is where the space is saved), then rebuilt. The inset shows the kept waves of one block. Quality sweeps by itself until you move the slider.',
    use: 'understanding compression artifacts, glitch and low-bitrate looks on purpose, teaching how images and video are stored',
    params: [{ key: 'q', label: 'Quality', min: 1, max: 100, step: 1, value: 50 }],
    prompt: 'Write a JPEG-style codec from scratch in plain JavaScript and run it live on an animated 320 x 180 picture (dusk gradient, striped sun, mountains, bold title text): RGB to YCbCr, 4:2:0 chroma subsampling, 8 x 8 DCT, the standard quantization tables scaled to quality {q}, rounding, then inverse DCT back to pixels, shown at 2x with crisp blocks. Show kept coefficients and estimated size, an inset with one block\'s 8 x 8 coefficient grid, and buttons for the amplified error image and a per-block coefficient heat map. Sweep quality from 100 to 2 and back over 12 s until the user moves the slider.',
    controls: [{ label: 'Compressed', on: true, fn: L => { L.state.mode = 0; } }, { label: 'Error x8', fn: L => { L.state.mode = 1; } }, { label: 'Coefficients kept', fn: L => { L.state.mode = 2; } }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const st = (L.state = L.state || { mode: 0 });
      const SW = 320, SH = 180, YW = 320, YH = 184, CW = 160, CH = 96;
      const src = document.createElement('canvas'); src.width = SW; src.height = SH; const sg = src.getContext('2d', { willReadFrequently: true });
      const out = document.createElement('canvas'); out.width = SW; out.height = SH; const og = out.getContext('2d'); const oimg = og.createImageData(SW, SH), op = oimg.data;
      const QL = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99];
      const QC = [17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99];
      const COS = new Float32Array(64); for (let u = 0; u < 8; u++) for (let x = 0; x < 8; x++) COS[u * 8 + x] = (u ? Math.sqrt(0.25) : Math.sqrt(0.125)) * Math.cos((2 * x + 1) * u * Math.PI / 16);
      const Y = new Float32Array(YW * YH), Cb = new Float32Array(CW * CH), Cr = new Float32Array(CW * CH), Y0 = new Float32Array(YW * YH);
      const qtL = new Float32Array(64), qtC = new Float32Array(64), blk = new Float32Array(64), tmp = new Float32Array(64), keptY = new Uint8Array((YW / 8) * (YH / 8));
      const probe = new Int16Array(64); let kept = 0;
      // Forward DCT, quantize, inverse DCT for one 8 x 8 block of a plane (in place). Returns the number of nonzero coefficients.
      const code = (P, pw, bx, by, qt, keepProbe) => {
        const o = by * 8 * pw + bx * 8; let nz = 0;
        for (let y = 0; y < 8; y++) for (let u = 0; u < 8; u++) { let s = 0; for (let x = 0; x < 8; x++) s += COS[u * 8 + x] * (P[o + y * pw + x] - 128); tmp[y * 8 + u] = s; }
        for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) { let s = 0; for (let y = 0; y < 8; y++) s += COS[v * 8 + y] * tmp[y * 8 + u]; const q = Math.round(s / qt[v * 8 + u]); if (q) nz++; if (keepProbe) probe[v * 8 + u] = q; blk[v * 8 + u] = q * qt[v * 8 + u]; }
        for (let v = 0; v < 8; v++) for (let x = 0; x < 8; x++) { let s = 0; for (let u = 0; u < 8; u++) s += COS[u * 8 + x] * blk[v * 8 + u]; tmp[v * 8 + x] = s; }
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { let s = 0; for (let v = 0; v < 8; v++) s += COS[v * 8 + y] * tmp[v * 8 + x]; P[o + y * pw + x] = s + 128; }
        return nz;
      };
      // The animated source picture, drawn with Canvas 2D at 320 x 180.
      const scene = t => {
        const sky = sg.createLinearGradient(0, 0, 0, SH); sky.addColorStop(0, '#1d1b3a'); sky.addColorStop(0.55, '#7a3b6e'); sky.addColorStop(1, '#ff7a4a'); sg.fillStyle = sky; sg.fillRect(0, 0, SW, SH);
        sg.fillStyle = '#f4efe6'; for (let i = 0; i < 40; i++) { const x = (i * 97.3 + t * 3) % SW, y = (i * 41.7) % 70; sg.fillRect(x, y, 1, 1); }
        const sx = 160 + Math.sin(t * 0.4) * 70, sy = 112; sg.save(); sg.beginPath(); sg.arc(sx, sy, 46, 0, 7); sg.clip();
        const sun = sg.createLinearGradient(0, sy - 46, 0, sy + 46); sun.addColorStop(0, '#ffd166'); sun.addColorStop(1, '#ff5a36'); sg.fillStyle = sun; sg.fillRect(sx - 46, sy - 46, 92, 92);
        sg.fillStyle = '#7a3b6e'; for (let i = 0; i < 6; i++) sg.fillRect(sx - 46, sy + 4 + i * 8 + ((t * 8) % 8), 92, 1 + i * 0.6); sg.restore();
        sg.fillStyle = '#2a1840'; sg.beginPath(); sg.moveTo(0, SH); for (let x = 0; x <= SW; x += 8) sg.lineTo(x, 132 + Math.sin(x * 0.03 + 1) * 14 + Math.sin(x * 0.11) * 5); sg.lineTo(SW, SH); sg.fill();
        sg.fillStyle = '#120c22'; sg.beginPath(); sg.moveTo(0, SH); for (let x = 0; x <= SW; x += 6) sg.lineTo(x, 152 + Math.sin(x * 0.05 + t * 0.3) * 8 + Math.sin(x * 0.19) * 3); sg.lineTo(SW, SH); sg.fill();
        sg.font = '700 44px Bahnschrift, Segoe UI'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillStyle = '#f4efe6'; sg.fillText('8 x 8', 160 + Math.sin(t * 0.7) * 6, 46);
        sg.font = '12px Segoe UI'; sg.fillStyle = '#2bc4e6'; sg.fillText('every block is 64 waves', 160, 76);
      };
      let auto = true, lastQ = L.p.q, ms = 0;
      return t => {
        const t0 = performance.now();
        if (L.p.q !== lastQ) { auto = false; lastQ = L.p.q; }
        const q = auto ? Math.max(2, Math.round(100 - 98 * (0.5 - 0.5 * Math.cos(t * Math.PI / 6)))) : L.p.q;
        const S = q < 50 ? 5000 / q : 200 - 2 * q;
        for (let i = 0; i < 64; i++) { qtL[i] = Math.min(255, Math.max(1, Math.floor((QL[i] * S + 50) / 100))); qtC[i] = Math.min(255, Math.max(1, Math.floor((QC[i] * S + 50) / 100))); }
        scene(t); const d = sg.getImageData(0, 0, SW, SH).data;
        for (let y = 0; y < YH; y++) for (let x = 0; x < YW; x++) { const k = (Math.min(SH - 1, y) * SW + x) * 4; Y[y * YW + x] = Y0[y * YW + x] = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]; }
        for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
          let r = 0, gg = 0, b = 0; for (let j = 0; j < 4; j++) { const k = (Math.min(SH - 1, y * 2 + (j >> 1)) * SW + x * 2 + (j & 1)) * 4; r += d[k]; gg += d[k + 1]; b += d[k + 2]; }
          r /= 4; gg /= 4; b /= 4; Cb[y * CW + x] = 128 - 0.1687 * r - 0.3313 * gg + 0.5 * b; Cr[y * CW + x] = 128 + 0.5 * r - 0.4187 * gg - 0.0813 * b;
        }
        const pbx = Math.floor((160 + Math.sin(t * 0.7) * 6 - 40) / 8) + Math.floor((0.5 + 0.5 * Math.sin(t * 0.23)) * 10), pby = 5;
        kept = 0;
        for (let by = 0; by < YH / 8; by++) for (let bx = 0; bx < YW / 8; bx++) { const n = code(Y, YW, bx, by, qtL, bx === pbx && by === pby); keptY[by * (YW / 8) + bx] = n; kept += n; }
        for (let by = 0; by < CH / 8; by++) for (let bx = 0; bx < CW / 8; bx++) kept += code(Cb, CW, bx, by, qtC, false) + code(Cr, CW, bx, by, qtC, false);
        for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
          const yy = Y[y * YW + x], cb = Cb[(y >> 1) * CW + (x >> 1)] - 128, cr = Cr[(y >> 1) * CW + (x >> 1)] - 128, k = (y * SW + x) * 4;
          let r = yy + 1.402 * cr, gg = yy - 0.3441 * cb - 0.7141 * cr, b = yy + 1.772 * cb;
          if (st.mode === 1) { r = Math.abs(r - d[k]) * 8; gg = Math.abs(gg - d[k + 1]) * 8; b = Math.abs(b - d[k + 2]) * 8; }
          else if (st.mode === 2) { const n = keptY[(y >> 3) * (YW / 8) + (x >> 3)] / 64, l = 0.25 + 0.2 * (yy / 255); r = r * l + 255 * Math.min(1, n * 3) * 0.75; gg = gg * l + 176 * Math.min(1, n * 3) * 0.6; b = b * l + 32 * n; }
          op[k] = r; op[k + 1] = gg; op[k + 2] = b; op[k + 3] = 255;
        }
        og.putImageData(oimg, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(out, 0, 0, W, H);
        // Probe block outline and its 8 x 8 grid of kept coefficients.
        g.strokeStyle = C.cyan; g.lineWidth = 2; g.strokeRect(pbx * 16, pby * 16, 16, 16);
        const ix = W - 124, iy = H - 156, cs = 13;
        g.fillStyle = 'rgba(11,11,16,0.82)'; g.fillRect(ix - 10, iy - 22, 8 * cs + 20, 8 * cs + 32);
        g.font = '10px Cascadia Mono, Consolas, monospace'; g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillText('BLOCK WAVES KEPT', ix - 2, iy - 8);
        for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) { const c = probe[v * 8 + u], a = c ? Math.min(1, 0.25 + Math.log2(1 + Math.abs(c)) / 6) : 0; g.fillStyle = c ? (c > 0 ? `rgba(255,176,32,${a})` : `rgba(43,196,230,${a})`) : 'rgba(244,239,230,0.05)'; g.fillRect(ix + u * cs, iy + v * cs, cs - 2, cs - 2); }
        g.strokeStyle = C.cyan; g.lineWidth = 1; g.strokeRect(ix - 1.5, iy - 1.5, 8 * cs + 1, 8 * cs + 1);
        const kb = kept * 5 / 8 / 1024; ms = performance.now() - t0;
        hud(g, ['QUALITY ' + q + (auto ? ' (SWEEPING)' : ''), 'ERROR x8: WHAT THE CODEC THREW AWAY', 'COEFFICIENTS KEPT PER BLOCK'][st.mode], `kept ${kept} of ${(YW * YH + 2 * CW * CH)} waves   about ${kb.toFixed(1)} KB vs ${(SW * SH * 3 / 1024).toFixed(0)} KB raw   ${ms.toFixed(1)} ms`, st.mode ? C.cyan : C.coral);
      };
    },
  });

  // ---------------- neural network ----------------
  EX.add({
    cat: 'scratch', id: 'x-neural', title: 'Neural network from scratch', aka: 'multilayer perceptron, backpropagation, Adam optimizer, decision boundary', tool: 'Plain JavaScript (forward pass, backpropagation, Adam) + Canvas 2D', runs: 'CPU',
    notice: 'A tiny neural network (2 inputs, two hidden layers, 1 output) learns which color each point is, starting from random weights. Each step it runs the 240 points forward, sends the error back through each layer to get a gradient for every weight (backpropagation), and nudges them with Adam. The background is its current guess for every spot, so you watch the boundary curl into the spiral, then it starts over on rings and a checkerboard.',
    use: 'explaining machine learning visually, data and AI themes, showing training as motion',
    params: [{ key: 'lr', label: 'Learning rate', min: 0.002, max: 0.08, step: 0.002, value: 0.012, dec: 3 }, { key: 'hid', label: 'Neurons per layer', min: 3, max: 24, step: 1, value: 16, restart: true }],
    prompt: 'Write a neural network from scratch in plain JavaScript, no library: 2 inputs, two tanh hidden layers of {hid} neurons, a sigmoid output, binary cross-entropy, backpropagation by hand and the Adam optimizer at learning rate {lr}, 150 full-batch steps per second. Train it live on 240 points of two interleaved spirals (coral and cyan), then rings, then a checkerboard, restarting from random weights each time. Draw the decision field as a soft coral-to-cyan gradient with a cream boundary line, the network diagram with edge thickness by weight and nodes lit by activation, and the loss curve.',
    controls: [{ label: 'Reset weights', group: false, fn: L => L.state.reset() }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const HN = L.p.hid, NP = 240, r = EX.rng(9);
      const st = (L.state = { reset: () => {} });
      const X = new Float64Array(NP * 2), T = new Float64Array(NP);
      const SETS = /** @type {[string, number][]} */ ([['TWO SPIRALS', 11], ['RINGS', 6], ['CHECKERBOARD', 7]]);
      const make = k => {
        for (let i = 0; i < NP; i++) {
          const c = i % 2; let x, y;
          if (k === 0) { const s = (i >> 1) / (NP / 2), a = s * 4.4 * Math.PI + c * Math.PI, rr = 0.08 + 0.84 * s; x = rr * Math.cos(a) + (r() - 0.5) * 0.05; y = rr * Math.sin(a) + (r() - 0.5) * 0.05; }
          else if (k === 1) { const a = r() * 6.283, rr = c ? 0.12 + r() * 0.3 : 0.6 + r() * 0.3; x = rr * Math.cos(a); y = rr * Math.sin(a); }
          else { x = r() * 1.8 - 0.9; y = r() * 1.8 - 0.9; T[i] = (x > 0) !== (y > 0) ? 1 : 0; X[i * 2] = x; X[i * 2 + 1] = y; continue; }
          X[i * 2] = x; X[i * 2 + 1] = y; T[i] = c;
        }
      };
      // All weights live in one array; Adam keeps two moment arrays of the same size.
      const o1 = 0, ob1 = o1 + HN * 2, o2 = ob1 + HN, ob2 = o2 + HN * HN, o3 = ob2 + HN, ob3 = o3 + HN, NW = ob3 + 1;
      const Wt = new Float64Array(NW), G = new Float64Array(NW), M1 = new Float64Array(NW), M2 = new Float64Array(NW);
      const h1 = new Float64Array(HN), h2 = new Float64Array(HN), d1 = new Float64Array(HN), d2 = new Float64Array(HN);
      let steps = 0, loss = 0, acc = 0;
      const init = () => {
        const u = (i0, n, a) => { for (let i = 0; i < n; i++) Wt[i0 + i] = (r() * 2 - 1) * a; };
        Wt.fill(0); M1.fill(0); M2.fill(0); u(o1, HN * 2, Math.sqrt(6 / (2 + HN)) * 1.6); u(o2, HN * HN, Math.sqrt(6 / (2 * HN))); u(o3, HN, Math.sqrt(6 / (HN + 1))); steps = 0;
      };
      // Forward pass for one point; fills h1, h2 and returns the output probability.
      const fwd = (x, y) => {
        for (let j = 0; j < HN; j++) h1[j] = Math.tanh(Wt[o1 + j * 2] * x + Wt[o1 + j * 2 + 1] * y + Wt[ob1 + j]);
        for (let j = 0; j < HN; j++) { let s = Wt[ob2 + j]; for (let k = 0; k < HN; k++) s += Wt[o2 + j * HN + k] * h1[k]; h2[j] = Math.tanh(s); }
        let s = Wt[ob3]; for (let k = 0; k < HN; k++) s += Wt[o3 + k] * h2[k]; return 1 / (1 + Math.exp(-s));
      };
      // One full-batch gradient step: backpropagation, then Adam.
      const train = lr => {
        G.fill(0); let L0 = 0, ok = 0;
        for (let i = 0; i < NP; i++) {
          const x = X[i * 2], y = X[i * 2 + 1], tt = T[i], p = fwd(x, y), dz = p - tt;
          L0 -= tt * Math.log(p + 1e-9) + (1 - tt) * Math.log(1 - p + 1e-9); if ((p > 0.5) === (tt > 0.5)) ok++;
          G[ob3] += dz; for (let k = 0; k < HN; k++) { G[o3 + k] += dz * h2[k]; d2[k] = dz * Wt[o3 + k] * (1 - h2[k] * h2[k]); }
          d1.fill(0);
          for (let j = 0; j < HN; j++) { const dj = d2[j]; G[ob2 + j] += dj; for (let k = 0; k < HN; k++) { G[o2 + j * HN + k] += dj * h1[k]; d1[k] += dj * Wt[o2 + j * HN + k]; } }
          for (let k = 0; k < HN; k++) { const dk = d1[k] * (1 - h1[k] * h1[k]); G[o1 + k * 2] += dk * x; G[o1 + k * 2 + 1] += dk * y; G[ob1 + k] += dk; }
        }
        steps++; const b1 = 1 - Math.pow(0.9, steps), b2 = 1 - Math.pow(0.999, steps);
        for (let i = 0; i < NW; i++) { const gi = G[i] / NP; M1[i] = 0.9 * M1[i] + 0.1 * gi; M2[i] = 0.999 * M2[i] + 0.001 * gi * gi; Wt[i] -= lr * (M1[i] / b1) / (Math.sqrt(M2[i] / b2) + 1e-8); }
        loss = L0 / NP; acc = ok / NP;
      };
      st.reset = init;
      const FS = 64, fimg = g.createImageData(FS, FS), fc = document.createElement('canvas'); fc.width = FS; fc.height = FS; const fg = fc.getContext('2d');
      const S0 = 12, SZ = 336, lossHist = new Float32Array(300); let lh = 0, set = -1, setStart = 0, budget = 0, last = 0;
      const ca = hexRGB(C.coral), cb = hexRGB(C.cyan);
      return t => {
        const dt = Math.min(0.05, Math.max(0, t - last)); last = t;
        const cyc = SETS.reduce((s, q) => s + q[1], 0); let lt = t % cyc, k = 0; while (lt > SETS[k][1]) { lt -= SETS[k][1]; k++; }
        if (k !== set) { set = k; make(k); init(); lh = 0; setStart = t; budget = 0; }
        if (lt > 0.4) { budget += dt * 150; let n = 0; while (budget >= 1 && n < 14) { train(L.p.lr); budget--; n++; if (steps % 4 === 0) { lossHist[lh % 300] = loss; lh++; } } budget = Math.min(budget, 2); }
        // Decision field on a 64 x 64 grid, scaled up smoothly.
        const fd = fimg.data;
        for (let y = 0; y < FS; y++) for (let x = 0; x < FS; x++) {
          const p = fwd((x + 0.5) / FS * 2 - 1, 1 - (y + 0.5) / FS * 2), e = Math.exp(-Math.pow((p - 0.5) * 12, 2)) * 0.75, k4 = (y * FS + x) * 4, v = 0.28 + 0.12 * Math.abs(p - 0.5) * 2;
          fd[k4] = (cb[0] + (ca[0] - cb[0]) * p) * v + 244 * e * 0.8; fd[k4 + 1] = (cb[1] + (ca[1] - cb[1]) * p) * v + 239 * e * 0.8; fd[k4 + 2] = (cb[2] + (ca[2] - cb[2]) * p) * v + 230 * e * 0.8; fd[k4 + 3] = 255;
        }
        fg.putImageData(fimg, 0, 0);
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.imageSmoothingEnabled = true; g.drawImage(fc, S0, S0, SZ, SZ);
        const pop = Math.min(1, (t - setStart) / 0.5);
        for (let i = 0; i < NP; i++) {
          const x = S0 + (X[i * 2] + 1) / 2 * SZ, y = S0 + (1 - (X[i * 2 + 1] + 1) / 2) * SZ, rr = 3.2 * ease.back(Math.min(1, Math.max(0, pop * 1.6 - (i / NP) * 0.6)));
          if (rr <= 0) continue; g.fillStyle = T[i] ? C.coral : C.cyan; g.strokeStyle = 'rgba(11,11,16,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); g.stroke();
        }
        // Network diagram, lit by the activations for a probe point circling the field.
        const pa = t * 0.6, pxp = Math.cos(pa) * 0.55, pyp = Math.sin(pa * 1.3) * 0.55, out = fwd(pxp, pyp);
        g.strokeStyle = C.cream; g.lineWidth = 1.5; g.beginPath(); g.arc(S0 + (pxp + 1) / 2 * SZ, S0 + (1 - (pyp + 1) / 2) * SZ, 7, 0, 7); g.stroke();
        const NX = [380, 450, 530, 600], ny = (n, i) => 40 + (i + 0.5) * (220 / n), sw = (w, a) => { g.strokeStyle = w > 0 ? `rgba(255,176,32,${a})` : `rgba(43,196,230,${a})`; g.lineWidth = Math.min(3, Math.abs(w) * 0.9) + 0.2; };
        for (let j = 0; j < HN; j++) for (let k2 = 0; k2 < 2; k2++) { sw(Wt[o1 + j * 2 + k2], 0.5); g.beginPath(); g.moveTo(NX[0], ny(2, k2)); g.lineTo(NX[1], ny(HN, j)); g.stroke(); }
        for (let j = 0; j < HN; j++) for (let k2 = 0; k2 < HN; k2++) { sw(Wt[o2 + j * HN + k2], 0.28); g.beginPath(); g.moveTo(NX[1], ny(HN, k2)); g.lineTo(NX[2], ny(HN, j)); g.stroke(); }
        for (let k2 = 0; k2 < HN; k2++) { sw(Wt[o3 + k2], 0.6); g.beginPath(); g.moveTo(NX[2], ny(HN, k2)); g.lineTo(NX[3], ny(1, 0)); g.stroke(); }
        const node = (x, y, a) => { g.fillStyle = a > 0 ? `rgba(255,176,32,${0.25 + 0.75 * a})` : `rgba(43,196,230,${0.25 - 0.75 * a})`; g.strokeStyle = 'rgba(244,239,230,0.6)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.stroke(); };
        node(NX[0], ny(2, 0), pxp); node(NX[0], ny(2, 1), pyp);
        for (let j = 0; j < HN; j++) { node(NX[1], ny(HN, j), h1[j]); node(NX[2], ny(HN, j), h2[j]); }
        g.fillStyle = out > 0.5 ? C.coral : C.cyan; g.beginPath(); g.arc(NX[3], ny(1, 0), 9, 0, 7); g.fill();
        // Loss curve.
        const LX = 372, LY = 276, LW = 252, LH = 44; g.strokeStyle = 'rgba(244,239,230,0.12)'; g.lineWidth = 1; g.strokeRect(LX + 0.5, LY + 0.5, LW, LH);
        g.strokeStyle = C.coral; g.lineWidth = 1.5; g.beginPath(); const n = Math.min(lh, 300);
        for (let i = 0; i < n; i++) { const v = lossHist[(lh - n + i) % 300], x = LX + i / 299 * LW, y = LY + LH - Math.min(1, v / 0.75) * LH; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
        g.font = '10px Cascadia Mono, Consolas, monospace'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.textBaseline = 'alphabetic'; g.fillText('LOSS', LX + 4, LY - 5); g.fillText('2 > ' + HN + ' > ' + HN + ' > 1', NX[0] - 8, 30);
        hud(g, 'LEARNING: ' + SETS[k][0], `step ${steps}   loss ${loss.toFixed(3)}   accuracy ${(acc * 100).toFixed(0)}%   ${NW} weights`, acc > 0.97 ? C.green : C.coral);
      };
    },
  });

  // ---------------- typesetting engine ----------------
  EX.add({
    cat: 'scratch', id: 'x-typeset', title: 'Line-breaking engine', aka: 'Knuth-Plass algorithm, justified text, typesetting, text reflow', tool: 'Plain JavaScript line breaker (boxes, glue, dynamic programming) + Canvas 2D', runs: 'CPU',
    notice: 'Two copies of one paragraph, justified to the same moving column width: the left one breaks greedily, filling each line as far as it can and never looking back. The right one uses the Knuth-Plass method from TeX, which scores every possible set of breaks for the whole paragraph with dynamic programming and keeps the most even spacing. The bar beside each line shows how far its spaces had to stretch, and every word springs to its new place when the lines change.',
    use: 'editorial and long-form layouts, responsive text animation, understanding why some justified text has rivers',
    params: [{ key: 'tol', label: 'Space stretch', min: 0.2, max: 1.5, step: 0.05, value: 0.6, unit: ' em' }, { key: 'spring', label: 'Word spring', min: 40, max: 600, step: 10, value: 320 }],
    prompt: 'Write a line-breaking engine from scratch in plain JavaScript: words as boxes, spaces as glue that can stretch {tol} and shrink, a greedy first-fit breaker and a Knuth-Plass breaker (dynamic programming over all breakpoints, demerits = (1 + 100 |r|^3)^2, last line ragged). Show both side by side in 13 px Georgia, justified, while the column width eases between 150 and 270 px (1 s moves, 2.2 s holds); every word springs to its new position (stiffness {spring}), a bar beside each line shows its stretch, and the total demerits of both layouts are compared.',
    setup(cv, L) {
      const g = cv.getContext('2d');
      const TEXT = 'When a column narrows, every line must still end flush at both margins, so the spaces between words stretch or shrink to make up the difference. A greedy typesetter fills each line as full as it can and never looks back. The Knuth-Plass method, used by TeX since 1978, weighs every break in the paragraph at once and picks the most even spacing for the whole.';
      const FONT = '13px Georgia', LH = 17, words = TEXT.split(' '), n = words.length;
      g.font = FONT; const wd = words.map(w => g.measureText(w).width), SP = g.measureText(' ').width * 1.15;
      const pre = new Float64Array(n + 1); for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + wd[i];
      // Adjustment ratio of a line holding words i..j-1 at width w (Infinity when it cannot fit).
      const ratio = (i, j, w, last) => {
        const gaps = j - i - 1, nat = pre[j] - pre[i] + gaps * SP, st = 13 * L.p.tol, sh = SP * 0.35;
        if (nat > w) return gaps ? ((w - nat) / (gaps * sh) >= -1 ? (w - nat) / (gaps * sh) : -Infinity) : 0;
        if (last) return 0; return gaps ? (w - nat) / (gaps * st) : Infinity;
      };
      const dem = r => { const b = 100 * Math.pow(Math.min(Math.abs(r), 10), 3); return (1 + b) * (1 + b); };
      const greedy = w => { const br = []; let i = 0; while (i < n) { let j = i + 1; while (j < n && pre[j + 1] - pre[i] + (j - i) * SP <= w) j++; br.push(j); i = j; } return br; };
      const best = new Float64Array(n + 1), from = new Int32Array(n + 1);
      // Knuth-Plass: best[j] = cheapest way to end a line after word j, over every earlier break i.
      const optimal = w => {
        best.fill(Infinity); best[0] = 0;
        for (let j = 1; j <= n; j++) for (let i = j - 1; i >= 0; i--) {
          const r = ratio(i, j, w, j === n); if (r === -Infinity) break; if (r === Infinity && j - i > 1) continue;
          const c = best[i] + (r === Infinity ? 1e12 : dem(r)); if (c < best[j]) { best[j] = c; from[j] = i; }
        }
        const br = []; for (let j = n; j > 0; j = from[j]) br.unshift(j); return br;
      };
      const P = [0, 1].map(() => ({ x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n), tx: new Float32Array(n), ty: new Float32Array(n), r: [], total: 0, init: false }));
      // Places the words of a layout justified in a column, as spring targets.
      const place = (S, br, x0, y0, w) => {
        let i = 0; S.r = []; S.total = 0;
        br.forEach((j, li) => { const last = j === n, r = ratio(i, j, w, last), gaps = j - i - 1, nat = pre[j] - pre[i] + gaps * SP; S.r.push(r); S.total += last ? 0 : dem(r);
          const gap = last || !gaps ? SP : SP + (w - nat) / gaps; let x = x0; for (let k = i; k < j; k++) { S.tx[k] = x; S.ty[k] = y0 + li * LH; x += wd[k] + gap; } i = j; });
        if (!S.init) { S.init = true; S.x.set(S.tx); S.y.set(S.ty); }
      };
      let last = 0;
      return t => {
        const dt = Math.min(0.033, Math.max(0, t - last)); last = t;
        const KW = [170, 268, 205, 150, 240], seg = 3.2, i0 = Math.floor(t / seg) % KW.length, lt = t % seg, k = lt < 2.2 ? 0 : ease.inOut((lt - 2.2) / 1), w = KW[i0] + (KW[(i0 + 1) % KW.length] - KW[i0]) * k, X0 = [24, 342], Y0 = 74;
        place(P[0], greedy(w), X0[0], Y0, w); place(P[1], optimal(w), X0[1], Y0, w);
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const KS = L.p.spring, DM = 2 * Math.sqrt(KS);
        g.font = '600 11px Bahnschrift, Segoe UI'; g.textBaseline = 'alphabetic';
        [['GREEDY: FIRST FIT', C.coral], ['KNUTH-PLASS: WHOLE PARAGRAPH', C.green]].forEach(([s, c], i) => { g.fillStyle = c; g.fillText(s, X0[i], 56); });
        for (let s = 0; s < 2; s++) {
          const S = P[s], x0 = X0[s];
          g.fillStyle = 'rgba(244,239,230,0.05)'; g.fillRect(x0 - 6, Y0 - 14, w + 12, S.r.length * LH + 10);
          g.fillStyle = 'rgba(255,90,54,0.5)'; g.fillRect(x0 + w + 5.5, Y0 - 14, 1, S.r.length * LH + 10);
          S.r.forEach((r, li) => { const y = Y0 + li * LH - 9, m = Math.min(1, Math.abs(r) / 1.6), c = r < 0 ? C.cyan : m < 0.45 ? C.green : m < 0.8 ? C.amber : C.coral; g.fillStyle = c; g.fillRect(x0 + w + 10, y, 3 + m * 16, 7); });
          g.font = FONT; g.fillStyle = C.cream;
          for (let i = 0; i < n; i++) {
            S.vx[i] += (KS * (S.tx[i] - S.x[i]) - DM * S.vx[i]) * dt; S.vy[i] += (KS * (S.ty[i] - S.y[i]) - DM * S.vy[i]) * dt; S.x[i] += S.vx[i] * dt; S.y[i] += S.vy[i] * dt;
            g.fillText(words[i], S.x[i], S.y[i]);
          }
        }
        const fmt = v => v > 1e9 ? 'overfull' : Math.round(v).toLocaleString('en-US');
        hud(g, 'COLUMN ' + Math.round(w) + ' PX', `total demerits   greedy ${fmt(P[0].total)}   Knuth-Plass ${fmt(P[1].total)}   lower is more even`, C.green);
      };
    },
  });

  // ---------------- Mode 7 ----------------
  EX.add({
    cat: 'scratch', id: 'x-mode7', title: 'Mode 7 racer', aka: 'SNES Mode 7, affine scanline floor, pseudo-3D racing, Mario Kart look', tool: 'Plain JavaScript writing pixels into an ImageData (no WebGL)', runs: 'CPU',
    notice: 'The whole race track is one flat 1024 x 1024 picture: for every screen row below the horizon the engine works out how far away that row is, then copies pixels along a slanted line across the picture, one scaling and rotation per row, the trick the Super Nintendo did in hardware. Trees and cones are flat sprites scaled by distance. "Texture view" shows the picture and the slice of it the camera is reading.',
    use: 'retro racing and flying looks, map fly-overs, cheap ground planes without 3D',
    params: [{ key: 'cam', label: 'Camera height', min: 8, max: 60, step: 1, value: 22 }, { key: 'fov', label: 'Field of view', min: 50, max: 110, step: 1, value: 80, unit: ' deg' }],
    prompt: 'Write a SNES Mode 7 style racer from scratch in plain JavaScript into an ImageData: a 1024 x 1024 track picture drawn on a canvas (mowed grass stripes, sand run-off, coral and cream curbs, asphalt with a dashed center line), and for every row below the horizon compute its distance from camera height {cam} and field of view {fov}, then sample the picture along that row\'s rotated line, with fog toward the horizon. Parallax mountains in the sky, trees and cones as distance-scaled sprites, a small kart at the bottom that leans into turns. The camera laps the track. A second view shows the flat texture with the camera\'s view trapezoid.',
    controls: [{ label: 'Mode 7', on: true, fn: L => { L.state.map = false; } }, { label: 'Texture view', fn: L => { L.state.map = true; } }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const st = (L.state = L.state || { map: false });
      const TS = 1024, tc = document.createElement('canvas'); tc.width = TS; tc.height = TS; const tg = tc.getContext('2d', { willReadFrequently: true });
      const tr = th => 330 + 70 * Math.sin(2 * th) + 40 * Math.cos(3 * th), tp = th => [512 + Math.cos(th) * tr(th), 512 + Math.sin(th) * tr(th)];
      tg.fillStyle = '#1f4a34'; tg.fillRect(0, 0, TS, TS); tg.fillStyle = '#245a3e'; for (let i = 0; i < TS; i += 64) tg.fillRect(i, 0, 32, TS);
      const loop = (w, col, dash) => { tg.beginPath(); for (let i = 0; i <= 360; i++) { const p = tp(i / 360 * Math.PI * 2); i ? tg.lineTo(p[0], p[1]) : tg.moveTo(p[0], p[1]); } tg.closePath(); tg.lineWidth = w; tg.strokeStyle = col; tg.setLineDash(dash || []); tg.stroke(); tg.setLineDash([]); };
      loop(120, '#c9a46a'); loop(86, C.cream); loop(86, C.coral, [14, 14]); loop(74, '#3a3646'); loop(2, 'rgba(244,239,230,0.85)', [18, 22]);
      const sp = tp(0); tg.save(); tg.translate(sp[0], sp[1]); tg.fillStyle = C.cream; for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) tg.fillRect(-37 + i * 9.25, -9 + j * 9, 9.25, 9); tg.restore();
      const tex = new Uint32Array(tg.getImageData(0, 0, TS, TS).data.buffer);
      // Sprites: trees outside the track, cones on the inside of the curves.
      const tree = document.createElement('canvas'); tree.width = 40; tree.height = 64; const t2 = tree.getContext('2d');
      t2.fillStyle = '#5a3a26'; t2.fillRect(17, 46, 6, 18); t2.fillStyle = '#5fd38d'; t2.beginPath(); t2.moveTo(20, 0); t2.lineTo(38, 50); t2.lineTo(2, 50); t2.fill(); t2.fillStyle = '#3c9e64'; t2.beginPath(); t2.moveTo(20, 0); t2.lineTo(38, 50); t2.lineTo(20, 50); t2.fill();
      const cone = document.createElement('canvas'); cone.width = 20; cone.height = 24; const c2 = cone.getContext('2d');
      c2.fillStyle = C.amber; c2.beginPath(); c2.moveTo(10, 0); c2.lineTo(18, 22); c2.lineTo(2, 22); c2.fill(); c2.fillStyle = C.cream; c2.fillRect(5, 11, 10, 3); c2.fillStyle = '#2a2433'; c2.fillRect(0, 21, 20, 3);
      const SPR = []; for (let i = 0; i < 48; i++) { const th = i / 48 * Math.PI * 2 + 0.05, R = tr(th) + (i % 2 ? 92 : -92), big = i % 2 === 1; SPR.push({ x: 512 + Math.cos(th) * R, y: 512 + Math.sin(th) * R, img: big ? tree : cone, s: big ? 30 : 9, d: 0, sx: 0, sy: 0 }); }
      const img = g.createImageData(W, H), px = new Uint32Array(img.data.buffer), HZ = 112;
      const sky = document.createElement('canvas'); sky.width = 1280; sky.height = HZ; const kg = sky.getContext('2d');
      const sgr = kg.createLinearGradient(0, 0, 0, HZ); sgr.addColorStop(0, '#1d1b3a'); sgr.addColorStop(1, '#ff7a4a'); kg.fillStyle = sgr; kg.fillRect(0, 0, 1280, HZ);
      kg.fillStyle = '#3a2350'; kg.beginPath(); kg.moveTo(0, HZ); for (let x = 0; x <= 1280; x += 16) kg.lineTo(x, HZ - 30 - 22 * Math.abs(Math.sin(x * Math.PI / 640 * 3)) - 10 * Math.sin(x * 0.05)); kg.lineTo(1280, HZ); kg.fill();
      kg.fillStyle = '#24183a'; kg.beginPath(); kg.moveTo(0, HZ); for (let x = 0; x <= 1280; x += 10) kg.lineTo(x, HZ - 12 - 10 * Math.abs(Math.sin(x * Math.PI / 640 * 5 + 1))); kg.lineTo(1280, HZ); kg.fill();
      const fog = [0x3a, 0x2a, 0x55];
      let prevA = null, lean = 0, lastT = 0;
      return t => {
        const dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
        const th = t * 0.22, P = tp(th), Q = tp(th + 0.02), a = Math.atan2(Q[1] - P[1], Q[0] - P[0]);
        const turn = prevA === null ? 0 : Math.atan2(Math.sin(a - prevA), Math.cos(a - prevA)) / Math.max(dt, 1e-3); prevA = a; lean += (Math.max(-1, Math.min(1, turn * 1.2)) - lean) * Math.min(1, dt * 6);
        const fx = Math.cos(a), fy = Math.sin(a), rx = -fy, ry = fx, F = (W / 2) / Math.tan(L.p.fov * Math.PI / 360), CH = L.p.cam;
        const cx = P[0] - fx * 30, cy = P[1] - fy * 30;
        // Sky strip scrolls with the heading; then one affine row per scanline below the horizon.
        const off = ((a / (Math.PI * 2)) * 1280 % 1280 + 1280) % 1280; g.drawImage(sky, off, 0, Math.min(W, 1280 - off), HZ, 0, 0, Math.min(W, 1280 - off), HZ); if (1280 - off < W) g.drawImage(sky, 0, 0, W - (1280 - off), HZ, 1280 - off, 0, W - (1280 - off), HZ);
        for (let y = HZ; y < H; y++) {
          const dz = CH * F / (y - HZ + 0.5), mx = cx + fx * dz, my = cy + fy * dz, hw = dz * (W / 2) / F, sx = rx * hw * 2 / W, sy = ry * hw * 2 / W;
          let wx = mx - rx * hw, wy = my - ry * hw; const f = Math.min(1, dz / 900), k = 1 - f * f, row = y * W;
          for (let x = 0; x < W; x++, wx += sx, wy += sy) { const c = tex[((wy | 0) & 1023) * TS + ((wx | 0) & 1023)]; px[row + x] = 255 << 24 | ((c >> 16 & 255) * k + fog[2] * (1 - k)) << 16 | ((c >> 8 & 255) * k + fog[1] * (1 - k)) << 8 | ((c & 255) * k + fog[0] * (1 - k)); }
        }
        g.putImageData(img, 0, 0, 0, HZ, W, H - HZ);
        // Sprites, far to near.
        for (const s of SPR) { const dx = s.x - cx, dy = s.y - cy; s.d = dx * fx + dy * fy; const lx = dx * rx + dy * ry; s.sx = W / 2 + lx / s.d * F; s.sy = HZ + CH * F / s.d; }
        SPR.sort((p, q) => q.d - p.d);
        for (const s of SPR) { if (s.d < 12 || s.d > 900) continue; const sc = F / s.d * s.s / 20, w = s.img.width * sc, h = s.img.height * sc; if (s.sx + w < 0 || s.sx - w > W) continue; g.globalAlpha = Math.min(1, (900 - s.d) / 200); g.drawImage(s.img, s.sx - w / 2, s.sy - h, w, h); }
        g.globalAlpha = 1;
        // The kart, leaning into the turn.
        g.save(); g.translate(W / 2, H - 76); g.rotate(-lean * 0.12); g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 22, 46, 9, 0, 0, 7); g.fill();
        g.fillStyle = '#191622'; g.fillRect(-44, 4, 18, 18); g.fillRect(26, 4, 18, 18); g.fillStyle = C.coral; g.beginPath(); g.moveTo(-34, 14); g.lineTo(-24, -12); g.lineTo(24, -12); g.lineTo(34, 14); g.closePath(); g.fill();
        g.fillStyle = C.cream; g.fillRect(-14, -26, 28, 16); g.fillStyle = C.navy; g.fillRect(-10, -22, 20, 8); g.fillStyle = C.amber; g.fillRect(-30, 8, 8, 4); g.fillRect(22, 8, 8, 4); g.restore();
        if (st.map) {
          const ms = 300, mx0 = (W - ms) / 2, my0 = (H - ms) / 2 - 6, sc = ms / TS; g.fillStyle = 'rgba(11,11,16,0.75)'; g.fillRect(0, 0, W, H); g.drawImage(tc, mx0, my0, ms, ms);
          const corner = (dz, side) => { const hw = dz * (W / 2) / F; return [mx0 + (cx + fx * dz + rx * hw * side) * sc, my0 + (cy + fy * dz + ry * hw * side) * sc]; };
          const n0 = CH * F / (H - HZ), n1 = 900, q = [corner(n0, -1), corner(n0, 1), corner(n1, 1), corner(n1, -1)];
          g.save(); g.beginPath(); g.rect(mx0, my0, ms, ms); g.clip(); g.fillStyle = 'rgba(255,176,32,0.22)'; g.strokeStyle = C.amber; g.lineWidth = 1.5; g.beginPath(); q.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); g.stroke(); g.restore();
          g.fillStyle = C.cream; g.beginPath(); g.arc(mx0 + cx * sc, my0 + cy * sc, 4, 0, 7); g.fill();
        }
        hud(g, st.map ? 'THE FLAT TEXTURE AND THE SLICE THE CAMERA READS' : 'MODE 7: ONE ROTATED, SCALED ROW PER SCANLINE', `1024 x 1024 texture   ${H - HZ} rows   camera height ${CH}   no WebGL`, C.amber);
      };
    },
  });

  // ---------------- 2D shadow engine ----------------
  EX.add({
    cat: 'scratch', id: 'x-shadows', title: '2D light and shadow engine', aka: 'visibility polygon, 2D shadow casting, line of sight, field of view', tool: 'Plain JavaScript ray casting to segment corners + Canvas 2D (additive light)', runs: 'CPU',
    notice: 'Every wall is a list of line segments, and for each light the engine casts rays only toward segment corners (plus a hair to each side), keeps the nearest hit of each ray and sorts the hits by angle: joined up, they make the exact area the light can see. That shape is filled with a glow and added on top of the other lights, and three slightly offset copies per light soften the shadow edges. "Rays" shows the rays of one light.',
    use: 'top-down game lighting and stealth vision cones, dramatic logo reveals with moving light, teaching ray casting',
    params: [{ key: 'reach', label: 'Light reach', min: 120, max: 600, step: 10, value: 340, unit: ' px' }, { key: 'soft', label: 'Shadow softness', min: 0, max: 24, step: 1, value: 10, unit: ' px' }],
    prompt: 'Write a 2D light and shadow engine from scratch in plain JavaScript: walls as line segments (a frame, rotating squares and triangles, a few slabs), visibility polygons built by casting rays at every segment corner and 0.0001 rad to each side, sorted by angle. Three lights (coral, cyan, amber) drift on Lissajous paths; each light is drawn as three offset visibility polygons ({soft} apart) filled with a radial glow of reach {reach}, blended additively, walls drawn dark with a lit rim on top. A debug view draws one light\'s rays and polygon outline.',
    controls: [{ label: 'Lit', on: true, fn: L => { L.state.rays = false; } }, { label: 'Rays', fn: L => { L.state.rays = true; } }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const st = (L.state = L.state || { rays: false });
      const SHAPES = [[150, 110, 34, 4, 0.5], [470, 240, 40, 4, -0.4], [330, 120, 30, 3, 0.7], [210, 260, 26, 3, -0.6], [520, 95, 22, 6, 0.3], [90, 230, 20, 5, -0.8]];
      const SLABS = [[300, 300, 360, 288], [40, 70, 80, 40], [600, 300, 560, 330], [400, 40, 440, 60]];
      const seg = new Float64Array(4 * 80); let ns = 0;
      const addSeg = (a, b, c, d) => { seg[ns * 4] = a; seg[ns * 4 + 1] = b; seg[ns * 4 + 2] = c; seg[ns * 4 + 3] = d; ns++; };
      const polys = [];
      // Rebuilds the segment list for time t (the shapes spin).
      const build = t => {
        ns = 0; polys.length = 0;
        addSeg(0, 0, W, 0); addSeg(W, 0, W, H); addSeg(W, H, 0, H); addSeg(0, H, 0, 0);
        for (const [x, y, r, n, sp] of SHAPES) { const pts = []; for (let i = 0; i < n; i++) { const a = t * sp + i * Math.PI * 2 / n; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } polys.push(pts); pts.forEach((p, i) => { const q = pts[(i + 1) % n]; addSeg(p[0], p[1], q[0], q[1]); }); }
        for (const [a, b, c, d] of SLABS) { const nx = -(d - b), ny = c - a, l = Math.hypot(nx, ny) / 6, ox = nx / l, oy = ny / l; const pts = [[a, b], [c, d], [c + ox, d + oy], [a + ox, b + oy]]; polys.push(pts); pts.forEach((p, i) => { const q = pts[(i + 1) % 4]; addSeg(p[0], p[1], q[0], q[1]); }); }
      };
      const hitA = new Float64Array(80 * 4 * 3), hitX = new Float64Array(80 * 4 * 3), hitY = new Float64Array(80 * 4 * 3), ord = new Int32Array(80 * 4 * 3); let nh = 0;
      // Visibility polygon from (lx, ly): rays at every segment end and a hair to each side, nearest hit each, sorted by angle.
      const visible = (lx, ly) => {
        nh = 0;
        for (let s = 0; s < ns * 2; s++) {
          const ex = seg[s * 2], ey = seg[s * 2 + 1], base = Math.atan2(ey - ly, ex - lx);
          for (let k = -1; k <= 1; k++) {
            const a = base + k * 1e-4, dx = Math.cos(a), dy = Math.sin(a); let best = 1e9;
            for (let j = 0; j < ns; j++) {
              const ax = seg[j * 4], ay = seg[j * 4 + 1], bx = seg[j * 4 + 2] - ax, by = seg[j * 4 + 3] - ay, den = dx * by - dy * bx; if (Math.abs(den) < 1e-12) continue;
              const qx = ax - lx, qy = ay - ly, tt = (qx * by - qy * bx) / den, u = (qx * dy - qy * dx) / den; if (tt > 0 && u >= 0 && u <= 1 && tt < best) best = tt;
            }
            hitA[nh] = a; hitX[nh] = lx + dx * best; hitY[nh] = ly + dy * best; ord[nh] = nh; nh++;
          }
        }
        const o = Array.from(ord.subarray(0, nh)).sort((p, q) => hitA[p] - hitA[q]); return o;
      };
      const LIGHTS = [[C.coral, 255, 90, 54, 0.31, 0.43, 0], [C.cyan, 43, 196, 230, 0.27, 0.37, 2.1], [C.amber, 255, 176, 32, 0.22, 0.29, 4.2]];
      return t => {
        build(t);
        g.globalCompositeOperation = 'source-over'; g.fillStyle = '#07070b'; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'lighter';
        const soft = L.p.soft, reach = L.p.reach, Lpos = [];
        for (const [, r, gg, b, fx, fy, ph] of LIGHTS) {
          const lx = W / 2 + Math.sin(t * fx + ph) * 250, ly = H / 2 + Math.sin(t * fy * 1.3 + ph * 1.7) * 130; Lpos.push([lx, ly]);
          const offs = soft > 0 ? [[0, 0], [soft, 0], [-soft * 0.5, soft * 0.87]] : [[0, 0]];
          for (const [ox, oy] of offs) {
            const px0 = lx + ox, py0 = ly + oy, o = visible(px0, py0);
            const grd = g.createRadialGradient(px0, py0, 0, px0, py0, reach); grd.addColorStop(0, `rgba(${r},${gg},${b},${0.75 / offs.length})`); grd.addColorStop(0.35, `rgba(${r},${gg},${b},${0.3 / offs.length})`); grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
            g.fillStyle = grd; g.beginPath(); o.forEach((i, k) => k ? g.lineTo(hitX[i], hitY[i]) : g.moveTo(hitX[i], hitY[i])); g.closePath(); g.fill();
          }
        }
        g.globalCompositeOperation = 'source-over';
        for (const pts of polys) { g.fillStyle = '#121019'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); g.strokeStyle = 'rgba(244,239,230,0.35)'; g.lineWidth = 1.2; g.stroke(); }
        LIGHTS.forEach(([c], i) => { const [lx, ly] = Lpos[i]; g.fillStyle = C.cream; g.beginPath(); g.arc(lx, ly, 4, 0, 7); g.fill(); g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(lx, ly, 8, 0, 7); g.stroke(); });
        if (st.rays) {
          const [lx, ly] = Lpos[0], o = visible(lx, ly);
          g.strokeStyle = 'rgba(255,90,54,0.35)'; g.lineWidth = 1; g.beginPath(); for (const i of o) { g.moveTo(lx, ly); g.lineTo(hitX[i], hitY[i]); } g.stroke();
          g.strokeStyle = C.cream; g.lineWidth = 1.5; g.beginPath(); o.forEach((i, k) => k ? g.lineTo(hitX[i], hitY[i]) : g.moveTo(hitX[i], hitY[i])); g.closePath(); g.stroke();
          g.fillStyle = C.coral; for (const i of o) g.fillRect(hitX[i] - 1.5, hitY[i] - 1.5, 3, 3);
        }
        hud(g, st.rays ? 'RAYS TO EVERY CORNER, ONE LIGHT' : 'VISIBILITY POLYGONS, ADDED TOGETHER', `${ns} segments   ${ns * 6} rays per light   ${soft > 0 ? 3 : 1} samples per light   3 lights`, C.amber);
      };
    },
  });



  // ---------------- plucked strings ----------------
  EX.add({
    cat: 'scratch', id: 'x-strings', title: 'Plucked-string model', aka: 'Karplus-Strong synthesis, physical modeling, digital waveguide, harp', tool: 'Plain JavaScript physical model into a Float32Array, played as a Web Audio AudioBuffer', runs: 'CPU',
    notice: 'Each string is only a short loop of numbers whose length sets the pitch: a pluck fills it with a burst of noise, and every sample the loop is read, averaged with its neighbor and fed back slightly quieter. That averaging removes the harsh highs first, so the noise turns into a ringing tone that dies away like a real string. The strings on screen are drawn straight from those loops, so you see the noise settle into a smooth wave; press "Play sound" to hear the 8-string harp.',
    use: 'natural plucked sounds with no samples, generative music, showing how physical modeling works',
    params: [{ key: 'decay', label: 'Sustain', min: 0.985, max: 0.9995, step: 0.0005, value: 0.997, dec: 4 }, { key: 'bright', label: 'Pluck brightness', min: 0.1, max: 1, step: 0.05, value: 0.6 }],
    prompt: 'Write a Karplus-Strong plucked-string harp from scratch in plain JavaScript: 8 strings tuned to A minor pentatonic from A2 to D4, each a delay line filled with low-passed noise (brightness {bright}) on a pluck and fed back through a two-sample average times {decay}. Render a 7.2 s arpeggio loop sample by sample into a Float32Array with a light feedback echo and play it as a looping AudioBuffer after a "Play sound" click. Draw each string as its own delay line laid along a horizontal string with fixed ends, glowing with its energy, a flash where it is plucked, and re-render when a slider moves.',
    controls: [{ label: 'Play sound', group: false, fn: L => L.state.play() }, { label: 'Stop', group: false, fn: L => L.state.stop() }],
    setup(cv, L) {
      const g = cv.getContext('2d');
      const SR = 44100, STEP = 0.225, PAT = [0, 2, 4, 5, 7, 5, 4, 2, 1, 3, 4, 6, 7, 6, 4, 3, 0, 2, 4, 5, 7, 6, 5, 4, 3, 4, 5, 7, 6, 5, 3, 1], LOOP = STEP * PAT.length, LEN = Math.round(LOOP * SR);
      const NAMES = ['A2', 'C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4'], SEMI = [0, 3, 5, 7, 10, 12, 15, 17], NS = 8, FR = 60, NF = Math.round(LOOP * FR), PTS = 72;
      const lens = SEMI.map(s => Math.round(SR / (110 * Math.pow(2, s / 12))));
      const lines = lens.map(n => new Float32Array(n)), ptr = new Int32Array(NS);
      const mix = new Float32Array(LEN), snap = new Float32Array(NF * NS * PTS), energy = new Float32Array(NF * NS), echo = new Float32Array(Math.round(SR * STEP * 3));
      let seed = 7; const noise = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2147483648 - 1; };
      let renderMs = 0;
      // Runs every string sample by sample for the whole loop; also stores each string's shape 60 times a second.
      const render = () => {
        const t0 = performance.now(), D = L.p.decay, B = L.p.bright; seed = 7; lines.forEach(l => l.fill(0)); ptr.fill(0); echo.fill(0); let ei = 0;
        const pluck = (s, amp) => { const l = lines[s]; let lp = 0; for (let i = 0; i < l.length; i++) { lp += (noise() - lp) * B; l[i] = lp * amp * (0.6 + 0.4 * Math.sin(Math.PI * i / l.length)); } };
        let nextStep = 0, stp = 0, nextSnap = 0, fi = 0;
        for (let i = 0; i < LEN; i++) {
          if (i >= nextStep) { const s = PAT[stp % PAT.length]; pluck(s, 0.8); if (stp % 8 === 0) pluck(stp % 16 ? 1 : 0, 0.7); stp++; nextStep = Math.round(stp * STEP * SR); }
          let out = 0;
          for (let s = 0; s < NS; s++) { const l = lines[s], n = l.length, p = ptr[s], q = (p + 1) % n, v = l[p]; l[p] = (v + l[q]) * 0.5 * D; ptr[s] = q; out += v; }
          const e = echo[ei]; echo[ei] = out * 0.3 + e * 0.35; ei = (ei + 1) % echo.length;
          mix[i] = Math.tanh((out + e * 0.6) * 0.55);
          if (i >= nextSnap && fi < NF) {
            for (let s = 0; s < NS; s++) { const l = lines[s], n = l.length; let en = 0; for (let k = 0; k < PTS; k++) { const v = l[(ptr[s] + Math.floor(k / PTS * n)) % n]; snap[(fi * NS + s) * PTS + k] = v; en += v * v; } energy[fi * NS + s] = Math.sqrt(en / PTS); }
            fi++; nextSnap = Math.round(fi / FR * SR);
          }
        }
        renderMs = performance.now() - t0;
      };
      const st = (L.state = L.state || { ac: null, src: null, start: 0, play: () => {}, stop: () => {} });
      if (st.src) { st.src.stop(); st.src = null; }
      const start = off => {
        const ac = st.ac; if (st.src) st.src.stop();
        const buf = ac.createBuffer(1, LEN, SR); buf.copyToChannel(mix, 0);
        const src = ac.createBufferSource(); src.buffer = buf; src.loop = true; const gn = ac.createGain(); gn.gain.value = 0.8; src.connect(gn).connect(ac.destination);
        src.start(0, off); st.src = src; st.start = ac.currentTime - off;
      };
      st.play = () => { if (!st.ac) st.ac = new AudioContext(); st.ac.resume(); start(0); };
      st.stop = () => { if (st.src) { st.src.stop(); st.src = null; } };
      // The looping sound stops when the card scrolls out of view.
      if (!cv.dataset.soundWatch) { cv.dataset.soundWatch = '1'; new IntersectionObserver(es => { if (!es[0].isIntersecting) { L.state.stop(); if (L.state.ac) L.state.ac.suspend(); } }).observe(cv); }
      const key = () => L.p.decay + ',' + L.p.bright; let rendered = key(), pend = '', changedAt = 0; render();
      const COLS = [C.coral, C.amber, C.cream, C.cyan, C.violet, C.coral, C.amber, C.cyan], X0 = 96, X1 = 600;
      return t => {
        const kk = key();
        if (kk !== rendered) { if (kk !== pend) { pend = kk; changedAt = t; } else if (t - changedAt > 0.12) { render(); rendered = kk; if (st.src) start((st.ac.currentTime - st.start) % LOOP); } }
        const pt = st.src ? (st.ac.currentTime - st.start) % LOOP : t % LOOP, fi = Math.min(NF - 1, Math.floor(pt * FR)), stp = Math.floor(pt / STEP), since = pt - stp * STEP;
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(244,239,230,0.04)'; g.fillRect(X0 - 14, 44, X1 - X0 + 28, 290);
        for (let s = 0; s < NS; s++) {
          const y = 300 - s * 34, en = energy[fi * NS + s], amp = 22 + s * -1.2, base = (fi * NS + s) * PTS;
          g.strokeStyle = COLS[s]; g.globalAlpha = 0.35 + Math.min(0.65, en * 4); g.lineWidth = 1.2 + Math.min(2.5, en * 10); g.shadowColor = COLS[s]; g.shadowBlur = Math.min(18, en * 90);
          g.beginPath(); for (let k = 0; k <= PTS; k++) { const v = k < PTS ? snap[base + k] : 0, env = Math.sin(Math.PI * k / PTS), x = X0 + (X1 - X0) * k / PTS, yy = y - v * amp * 3 * env; k ? g.lineTo(x, yy) : g.moveTo(x, yy); } g.stroke();
          g.shadowBlur = 0; g.globalAlpha = 1;
          g.fillStyle = C.cream; g.beginPath(); g.arc(X0, y, 3, 0, 7); g.arc(X1, y, 3, 0, 7); g.fill();
          g.font = '10px Cascadia Mono, Consolas, monospace'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillText(NAMES[s], X0 - 44, y); g.fillText(lens[s] + '', X1 + 12, y);
        }
        const ps = PAT[stp % PAT.length], fl = Math.exp(-since * 9); if (fl > 0.02) { const y = 300 - ps * 34; g.strokeStyle = `rgba(244,239,230,${fl})`; g.lineWidth = 2; g.beginPath(); g.arc(X0 + (X1 - X0) * 0.3, y, 6 + (1 - fl) * 26, 0, 7); g.stroke(); }
        g.font = '10px Cascadia Mono, Consolas, monospace'; g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(244,239,230,0.45)'; g.fillText('NOTE', X0 - 44, 40); g.fillText('LOOP (SAMPLES)', X1 - 52, 40);
        hud(g, st.src ? 'PLAYING: 8 STRINGS, EVERY SAMPLE IN JAVASCRIPT' : 'SILENT: PRESS PLAY SOUND TO HEAR IT', `${LEN.toLocaleString('en-US')} samples   ${NS} delay loops   rendered in ${renderMs.toFixed(0)} ms`, st.src ? C.green : C.coral);
      };
    },
  });

  // ---------------- 2D game engine ----------------
  EX.add({
    cat: 'scratch', id: 'x-platformer', title: 'Tiny 2D game engine', aka: 'platformer engine, tile map, tile collision, side scroller, pixel art', tool: 'Plain JavaScript (tile map, collision, camera, sprites) + Canvas 2D at 320 x 180', runs: 'CPU',
    notice: 'A small side-scroller engine: the level is a grid of 16 px tiles, the hero is a box that moves on x, gets pushed out of any solid tile, then moves on y and does the same, which is all the collision a platformer needs. A simple brain looks one tile ahead and jumps at walls and gaps, the camera eases after the hero with some look-ahead, and three background layers scroll slower for depth. The hero squashes on landing and stretches on take-off; "Debug view" shows the tiles, boxes and the probes the brain reads.',
    use: 'game prototypes, retro game trailers and loading screens, teaching how platformer physics works',
    params: [{ key: 'run', label: 'Run speed', min: 40, max: 160, step: 5, value: 95, unit: ' px/s' }, { key: 'jump', label: 'Jump speed', min: 180, max: 380, step: 10, value: 300, unit: ' px/s' }],
    prompt: 'Write a tiny 2D platformer engine from scratch in plain JavaScript, rendered at 320 x 180 and scaled 2x with crisp pixels: a generated 16 px tile map (grass ground with dirt, gaps up to 3 tiles, steps up to 2 tiles, floating brick platforms with coins), axis-separated tile collision, gravity, an auto-running hero at {run} with a jump of {jump} that jumps when a wall or gap is one tile ahead, coins with a sparkle and a counter, a smoothed camera with look-ahead, three parallax layers, squash on landing and stretch on take-off, and a debug view with tile grid, hitboxes and the look-ahead probes. Loop back to the start when the level ends.',
    controls: [{ label: 'Game', on: true, fn: L => { L.state.debug = false; } }, { label: 'Debug view', fn: L => { L.state.debug = true; } }],
    setup(cv, L) {
      const g = cv.getContext('2d'); const st = (L.state = L.state || { debug: false });
      const FW = 320, FH = 180, T = 16, MW = 160, MH = 12, r = EX.rng(31);
      const fb = document.createElement('canvas'); fb.width = FW; fb.height = FH; const f = fb.getContext('2d');
      // Level: column heights with steps and gaps, floating platforms, coins.
      const M = new Uint8Array(MW * MH), coins = [];
      let h = 3;
      for (let x = 0; x < MW; x++) {
        if (x > 8 && x < MW - 12 && r() < 0.13) { const gw = 2 + Math.floor(r() * 2); for (let k = 0; k < gw && x < MW; k++, x++) coins.push([x * T + 8, (MH - h - 3) * T + 8, 1]); }
        if (x > 6 && r() < 0.18) h = Math.max(2, Math.min(5, h + (r() < 0.5 ? -1 : 1) * (r() < 0.3 ? 2 : 1)));
        for (let y = MH - h; y < MH; y++) M[y * MW + x] = y === MH - h ? 1 : 2;
        if (x > 10 && x % 11 === 0 && x < MW - 6) { const py = MH - h - 4; for (let k = 0; k < 3; k++) { M[py * MW + x + k] = 3; coins.push([(x + k) * T + 8, (py - 1) * T + 8, 1]); } }
      }
      const solid = (tx, ty) => tx >= 0 && tx < MW && ty >= 0 && ty < MH && M[ty * MW + tx] > 0;
      // Tile art, painted once.
      const tile = paint => { const c = document.createElement('canvas'); c.width = T; c.height = T; paint(c.getContext('2d')); return c; };
      const TL = [null,
        tile(c => { c.fillStyle = '#6b4a35'; c.fillRect(0, 0, T, T); c.fillStyle = '#5fd38d'; c.fillRect(0, 0, T, 5); c.fillStyle = '#3c9e64'; c.fillRect(0, 5, T, 2); c.fillRect(3, 7, 2, 2); c.fillRect(11, 7, 2, 1); c.fillStyle = '#5a3d2b'; c.fillRect(6, 11, 3, 2); }),
        tile(c => { c.fillStyle = '#6b4a35'; c.fillRect(0, 0, T, T); c.fillStyle = '#5a3d2b'; c.fillRect(2, 3, 3, 2); c.fillRect(10, 9, 3, 2); c.fillRect(6, 13, 2, 2); }),
        tile(c => { c.fillStyle = '#c2412a'; c.fillRect(0, 0, T, T); c.fillStyle = '#ff5a36'; c.fillRect(1, 1, 6, 6); c.fillRect(9, 1, 6, 6); c.fillRect(1, 9, 14, 6); c.fillStyle = '#ffb08f'; c.fillRect(1, 1, 6, 1); c.fillRect(9, 1, 6, 1); c.fillRect(1, 9, 14, 1); })];
      const P = { x: 2 * T, y: (MH - 6) * T, vx: 0, vy: 0, w: 10, h: 14, ground: false, sq: 0, score: 0 };
      const spark = [];
      let camX = 0, last = 0, fade = 0, probeA = [0, 0], probeB = [0, 0];
      const reset = () => { P.x = 2 * T; P.y = (MH - 7) * T; P.vx = P.vy = 0; P.score = 0; coins.forEach(c => { c[2] = 1; }); camX = 0; };
      // Moves the hero box along one axis and pushes it out of any solid tile it ends up in.
      const move = (dx, dy) => {
        P.x += dx; P.y += dy;
        const x0 = Math.floor(P.x / T), x1 = Math.floor((P.x + P.w - 0.01) / T), y0 = Math.floor(P.y / T), y1 = Math.floor((P.y + P.h - 0.01) / T);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) {
          if (dx > 0) { P.x = tx * T - P.w; P.vx = 0; } else if (dx < 0) { P.x = (tx + 1) * T; P.vx = 0; }
          if (dy > 0) { P.y = ty * T - P.h; if (P.vy > 260) P.sq = 1; P.vy = 0; P.ground = true; } else if (dy < 0) { P.y = (ty + 1) * T; P.vy = 0; }
        }
      };
      const step = dt => {
        P.vx = L.p.run; P.vy = Math.min(600, P.vy + 800 * dt);
        const fx = Math.floor((P.x + P.w + 6) / T), fy = Math.floor((P.y + P.h - 1) / T);
        probeA = [fx, fy]; probeB = [fx + 1, fy + 1];
        const wall = solid(fx, fy) || solid(fx, fy - 1), gap = !solid(fx, fy + 1) && !solid(fx + 1, fy + 1);
        if (P.ground && (wall || gap)) { P.vy = -L.p.jump; P.ground = false; P.sq = -1; }
        P.ground = false; move(P.vx * dt, 0); move(0, P.vy * dt);
        for (const c of coins) if (c[2] && Math.abs(c[0] - (P.x + P.w / 2)) < 10 && Math.abs(c[1] - (P.y + P.h / 2)) < 12) { c[2] = 0; P.score++; for (let i = 0; i < 8; i++) spark.push([c[0], c[1], Math.cos(i * 0.785) * 60, Math.sin(i * 0.785) * 60, 0.5]); }
        P.sq *= Math.pow(0.0005, dt);
        if (fade <= 0 && (P.y > FH + 40 || P.x > (MW - 4) * T)) fade = 1;
      };
      let acc = 0;
      return t => {
        const dt = Math.min(0.05, Math.max(0, t - last)); last = t; acc += dt;
        let n = 0; while (acc >= 1 / 120 && n < 12) { step(1 / 120); acc -= 1 / 120; n++; } if (n === 12) acc = 0;
        if (fade > 0) { fade -= dt * 2.2; if (fade <= 0.5 && fade + dt * 2.2 > 0.5) reset(); }
        const target = P.x - FW * 0.35 + P.vx * 0.35; camX += (Math.max(0, Math.min(MW * T - FW, target)) - camX) * Math.min(1, dt * 4);
        const cx = Math.round(camX);
        // Parallax: sky, far hills, near hills.
        const sky = f.createLinearGradient(0, 0, 0, FH); sky.addColorStop(0, '#1d1b3a'); sky.addColorStop(1, '#7a3b6e'); f.fillStyle = sky; f.fillRect(0, 0, FW, FH);
        f.fillStyle = '#ffb020'; f.beginPath(); f.arc(250, 50, 18, 0, 7); f.fill();
        /** @type {[number, string, number, number, number][]} */ ([[0.2, '#3a2350', 70, 0.03, 30], [0.5, '#2a1840', 100, 0.05, 22]]).forEach(([k, col, base, fq, amp]) => { f.fillStyle = col; f.beginPath(); f.moveTo(0, FH); for (let x = 0; x <= FW; x += 4) { const wx = x + cx * k; f.lineTo(x, base + Math.sin(wx * fq) * amp * 0.6 + Math.sin(wx * fq * 2.7) * amp * 0.4); } f.lineTo(FW, FH); f.fill(); });
        const yo = FH - MH * T;
        for (let ty = 0; ty < MH; ty++) for (let tx = Math.floor(cx / T); tx <= Math.floor((cx + FW) / T); tx++) { const v = solid(tx, ty) ? M[ty * MW + tx] : 0; if (v) f.drawImage(TL[v], tx * T - cx, ty * T + yo); }
        for (const c of coins) if (c[2]) { const w = Math.abs(Math.sin(t * 4 + c[0] * 0.1)) * 5 + 1; f.fillStyle = '#ffb020'; f.fillRect(c[0] - cx - w / 2, c[1] - 5 + yo, w, 10); f.fillStyle = '#fff1c4'; f.fillRect(c[0] - cx - w / 4, c[1] - 4 + yo, Math.max(1, w / 3), 3); }
        for (let i = spark.length - 1; i >= 0; i--) { const s = spark[i]; s[0] += s[2] * dt; s[1] += s[3] * dt; s[4] -= dt; if (s[4] <= 0) { spark.splice(i, 1); continue; } f.fillStyle = `rgba(255,241,196,${s[4] * 2})`; f.fillRect(s[0] - cx - 1, s[1] - 1 + yo, 2, 2); }
        // Hero with squash and stretch.
        const sq = P.sq, sw = P.w * (1 + 0.35 * sq), sh = P.h * (1 - 0.3 * sq), hx = Math.round(P.x - cx + P.w / 2 - sw / 2), hy = Math.round(P.y + yo + P.h - sh), run = Math.floor(t * 12) % 2;
        f.fillStyle = '#ff5a36'; f.fillRect(hx, hy, sw, sh); f.fillStyle = '#f4efe6'; f.fillRect(hx + sw - 6, hy + 2, 5, 5); f.fillStyle = '#0b0b10'; f.fillRect(hx + sw - 3, hy + 3, 2, 2);
        f.fillStyle = '#1d1b3a'; if (P.vy === 0) { f.fillRect(hx + 1 + run * 3, hy + sh, 3, 2); f.fillRect(hx + sw - 4 - run * 3, hy + sh, 3, 2); } else f.fillRect(hx + 2, hy + sh, sw - 4, 2);
        if (st.debug) {
          f.strokeStyle = 'rgba(244,239,230,0.12)'; f.lineWidth = 1; f.beginPath(); for (let x = -(cx % T); x <= FW; x += T) { f.moveTo(x + 0.5, yo); f.lineTo(x + 0.5, FH); } for (let y = yo; y <= FH; y += T) { f.moveTo(0, y + 0.5); f.lineTo(FW, y + 0.5); } f.stroke();
          f.strokeStyle = '#2bc4e6'; f.strokeRect(P.x - cx + 0.5, P.y + yo + 0.5, P.w, P.h);
          f.strokeStyle = '#ffb020'; f.strokeRect(probeA[0] * T - cx + 0.5, probeA[1] * T + yo + 0.5, T - 1, T - 1); f.strokeRect(probeA[0] * T - cx + 0.5, (probeA[1] + 1) * T + yo + 0.5, T - 1, T - 1); f.strokeRect(probeB[0] * T - cx + 0.5, probeB[1] * T + yo + 0.5, T - 1, T - 1);
          f.strokeStyle = '#5fd38d'; f.beginPath(); f.moveTo(P.x - cx + P.w / 2, P.y + yo + P.h / 2); f.lineTo(P.x - cx + P.w / 2 + P.vx * 0.15, P.y + yo + P.h / 2 + P.vy * 0.15); f.stroke();
        }
        if (fade > 0) { f.fillStyle = `rgba(11,11,16,${1 - Math.abs(fade - 0.5) * 2})`; f.fillRect(0, 0, FW, FH); }
        g.imageSmoothingEnabled = false; g.drawImage(fb, 0, 0, W, H);
        g.font = '700 16px Cascadia Mono, Consolas, monospace'; g.textBaseline = 'top'; g.fillStyle = C.amber; g.fillText('COINS ' + String(P.score).padStart(2, '0'), W - 120, 16);
        hud(g, st.debug ? 'DEBUG: TILES, HITBOX, LOOK-AHEAD PROBES' : 'TILE MAP + BOX COLLISION', `${MW} x ${MH} tiles   x then y collision   camera look-ahead   320 x 180 at 2x`, C.green);
      };
    },
  });
})();
