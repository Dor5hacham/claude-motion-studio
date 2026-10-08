// Demoscene effects written from scratch: 1990s screen tricks, each a pixel loop into a low-res
// ImageData that is scaled up crisp. Every card keeps its whole effect in one setup().
(function () {
  const { C } = EX;
  const W = 640, H = 360, RW = 320, RH = 180;
  // Low-res buffer plus a scanline overlay; blit() scales the buffer to the stage with no smoothing.
  const lowres = g => {
    const oc = document.createElement('canvas'); oc.width = RW; oc.height = RH; const og = oc.getContext('2d');
    const img = og.createImageData(RW, RH), px = new Uint32Array(img.data.buffer);
    const sl = document.createElement('canvas'); sl.width = W; sl.height = H; const sg = sl.getContext('2d');
    sg.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 1; y < H; y += 2) sg.fillRect(0, y, W, 1);
    const blit = () => { og.putImageData(img, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(oc, 0, 0, W, H); g.drawImage(sl, 0, 0); };
    return { px, blit };
  };

  // ---------------- rotozoomer ----------------
  EX.add({
    cat: 'scratch', id: 'ds-rotozoom', title: 'Rotozoomer', aka: 'rotozoom, rotating zooming texture, affine texture mapping, Amiga and PC demo effect', tool: 'Plain JavaScript writing pixels into an ImageData (no WebGL)', runs: 'CPU',
    notice: 'A small 128 x 128 tile spins and zooms across the whole screen with no 3D at all. For each screen pixel the code runs the rotation backwards to find which texel lands there, and since that mapping is linear, moving one pixel right just adds the same two numbers to the texture position. Wrapping the coordinates with a bit mask makes the tile repeat forever.',
    use: 'retro intros and loading screens, music visuals, teaching affine transforms and inverse mapping',
    params: [{ key: 'spin', label: 'Spin speed', min: 0, max: 3, step: 0.05, value: 1 }, { key: 'zoom', label: 'Zoom swing', min: 0, max: 2, step: 0.05, value: 1 }],
    prompt: 'Write a classic demoscene rotozoomer from scratch in plain JavaScript: draw a seamless 128x128 tile once (navy checker, coral disc, amber ring, cream letters), then every frame fill a 320x180 ImageData by inverse mapping each screen pixel through a rotation and scale back into the tile, stepping the texture position by a constant per pixel and wrapping with a bit mask. Spin speed {spin}, zoom swing {zoom} (scale breathing in and out on a sine), a slow drifting center, scaled up 2x with no smoothing and faint scanlines.',
    setup(cv, L) {
      const g = cv.getContext('2d');
      const { px, blit } = lowres(g);
      // Tile: drawn once, read back as packed RGBA words. The checker period divides 128, so it wraps.
      const TS = 128, tc = document.createElement('canvas'); tc.width = TS; tc.height = TS; const tg = tc.getContext('2d', { willReadFrequently: true });
      for (let y = 0; y < TS; y += 16) for (let x = 0; x < TS; x += 16) { tg.fillStyle = ((x + y) / 16) & 1 ? '#2a2450' : C.navy; tg.fillRect(x, y, 16, 16); }
      tg.fillStyle = C.cyan; for (const [x, y] of [[0, 0], [TS, 0], [0, TS], [TS, TS]]) { tg.beginPath(); tg.moveTo(x, y - 10); tg.lineTo(x + 10, y); tg.lineTo(x, y + 10); tg.lineTo(x - 10, y); tg.fill(); }
      tg.fillStyle = C.coral; tg.beginPath(); tg.arc(64, 64, 38, 0, Math.PI * 2); tg.fill();
      tg.strokeStyle = C.amber; tg.lineWidth = 6; tg.beginPath(); tg.arc(64, 64, 46, 0, Math.PI * 2); tg.stroke();
      tg.fillStyle = C.cream; tg.font = '700 34px Bahnschrift, Segoe UI'; tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.fillText('MS', 64, 66);
      const tex = new Uint32Array(tg.getImageData(0, 0, TS, TS).data.buffer);
      const OFF = 1 << 20;   // keeps texture coordinates positive so |0 and the mask never flip at zero
      let ang = 0;
      return (t, dt) => {
        ang += (dt || 0) * L.p.spin * 0.7;
        const s = 0.18 + L.p.zoom * 0.55 * (1 + Math.sin(t * 0.6));   // texels per screen pixel
        const ca = Math.cos(ang) * s, sa = Math.sin(ang) * s;
        const cu = OFF + 64 + 220 * Math.sin(t * 0.21), cv2 = OFF + 64 + 160 * Math.sin(t * 0.17 + 1);
        for (let y = 0, k = 0; y < RH; y++) {
          const dy = y - RH / 2;
          let u = cu - RW / 2 * ca - dy * sa, v = cv2 - RW / 2 * sa + dy * ca;
          for (let x = 0; x < RW; x++, k++, u += ca, v += sa) px[k] = tex[((v | 0) & 127) << 7 | ((u | 0) & 127)];
        }
        blit();
      };
    },
  });
})();
