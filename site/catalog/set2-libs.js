// Library demos, second set (ids l2-*): each card shows a different strength of one vendored library:
// D3, Matter.js, anime.js, Rough.js, p5.js, Motion, Lottie, GSAP, PixiJS and Three.js.
// Loads after vendor/ and libs.js. Library globals are read inside setup(), and every card is driven by the shared frame(t, dt) loop.
// PixiJS and Three.js render into the shared EX.G context (960 x 540) and restoreGL() puts its state back afterwards.
(function () {
  const { C, lerp, ease, clamp01 } = EX;
  const MONO = '"Cascadia Mono", Consolas, monospace', DISP = 'Bahnschrift, "Segoe UI", sans-serif';
  const W = /** @type {any} */ (window);
  const RAD = Math.PI / 180;

  // Shows a short message in the stage when a library file did not load; returns an empty frame function.
  function missing(stage, name) {
    const msg = name + ' did not load. Check site/vendor/.';
    if (stage.getContext) {
      const g = stage.getContext('2d');
      if (g) { g.fillStyle = C.bg; g.fillRect(0, 0, 640, 360); g.fillStyle = C.coral; g.font = `600 16px ${MONO}`; g.textAlign = 'center'; g.fillText(msg, 320, 180); g.textAlign = 'left'; }
    } else stage.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;color:${C.coral};font:600 16px ${MONO}">${msg}</div>`;
    return () => {};
  }
  // Canvas pixel position of a pointer event on a 640 x 360 stage.
  const at = (cv, e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 640 / r.width, (e.clientY - r.top) * 360 / r.height]; };

  // ---------------------------------------------------------------- D3 geo
  // Land mask for the dotted globe. Source: Natural Earth land via world-atlas land-110m (public domain).
  // Grid: rows every 1.2 degrees of latitude from the south pole up, round(360 cos(lat) / 1.2) dots per row
  // from 180 W eastward. One bit per dot (1 = land), little-endian bytes, base64.
  const LAND = '////////5///P/7//3/4////f+B/8P//H+B/yP///wP+P+T///8/8P8H+P///z8A/38A/////z8A/P8D8P////8PABB+B+D//////wAAAIAB4P//////BwAAAB4A/P9/////AwAAACAAADT/5///PwAAAAAgAAAA6D////8AAAAAAAQAAADAD/7/HwAAAAAAIAAAAAAwACHjAQAAAAAAgAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAwAAAAAAAAAAAAAAAAAAAAAAAAAAwAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAfAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAHwAAAAAAAAAAAAAAAAAAAAAAHAAAAAAAAAAA+AAAAAAAAAAAAAAAAAAAAAACAAMAAAAAAAAAAD8AAAAAAAAAAAAAAAAAAAAABgAEAAAAAAAAAAD4AwAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAP4AAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAA+D8AAAAAAAAAAAAAAAAAAAAAHwCAAQAAAAAAAAAA/B8AAAAAAAAAAAAAAAAAAAAAfwCAAAAAAAAAAAAA8H8AAAAAAAAAAAAAAAAAAAAA8A8ACAAAAAAAAAAAAPx/AAAAAAAABgAAAAAAAAA4APoPAAAAAAAAAAAAAADw/wEAAAAAAPgBAAAAAAAAgB/w/wAAAAAAAAAAAAAAAP5/AAAAAAAA/wAAAAAAAADgf/7/AAAAAAAAAAAAAAAA/v8AAAAAAAD+AwAAAAAAAID///8DAAAAAAAAAAAAAADw/wcAAAAAAPA/AAAAAAAAAPj//38AAAAAAAAAAAAAAAD8/wMAAAAAAPw/AAAAAAAAAPz//38AAAAAAAAAAAAAAAD4/w8AAAAAAPj/AAAAAAAAAPD///8BAAAAAAAAAAAAAACA//8AAAAAAID/DwAAAAAAAAD8//9/AAAAAAAAAAAAAAAAwP//AAAAAACA/z9gAAAAAAAA/P//fwAAAAAAAAAAAAAAAAD//wcAAAAAAP//gQMAAAAAAPD///8BAAAAAAAAAAAAAAAA8P//AwAAAADg/x94AAAAAAAA/P//PwAEAAAAAAAAAAAAAAD8//8BAAAAAPj/D3gAAAAAAAD4//8fAAIAAAAAAAAAAAAAAPj//wcAAAAA8P8f4AAAAAAAAAD//z8AAAAAAAAAAAAAAAAAwP//PwAAAACA//8DDwAAAAAAAOD//wAAAAAAAAAAAAAAAAAA/v//BwAAAAD4///gAQAAAAAAAPj/PQAAAAAAAAAAAAAAAADA////AwAAAAD8///hAQAAAAAAAPB/HAAAAAAAAAAAAAAAAADg////BwAAAADw//8HBwAAAAAAAIB/cAAAAQAAAAAAAAAAAACA////HwAAAACA//8fGAAAAAAAAADggwEAAAAAAAAAAAAAAAAA/P///wMAAAAA+P//AwEAAAAAAAAA+BAAAAAAAAAAAAAAAAAAgP////8AAAAAAP7/fwAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAPD///9/AAAAAID//x8AAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAD4////fwAAAACA//8PAAAAAAAAABAIACMAAQAAAAAAAAAAAAAA+P////8AAAAAgP//HwAAAAAAAIAHAMA3gAAAAAAAAAAAAAAAAPj/////AQAAAAD//z8AAAAAAADgAAAA/gAAAAAAAAAAAAAAAADg/////wcAAAAA+P//AQAAAAAAgABQAPhDAAAAAAAAAAAAAAAAAP////8PAAAAAOD//w8AAAAAAAAGAAD4DwYAAAAAAAAAAAAAAADw////PwAAAACA////AAAAAAAAcPgUZB8gAAAAAAAAAAAAAAAAAP///z8AAAAAAPj//x8AAAAAAICDzwAmAAAAAAAAAAAAAAAAAADw//8/AAAAAADA////AwAAAAAAHPwBIAAAAAAAAAAAAAAAAAAAAP///wEAAAAAAPj//38AAAAAAMDBnycAAAAAAAAAAAAAAAAAAADg//8fAAAAAACA////HwAAAAAALvwBAgAAAAAAAAAAAAAAAAAAAPz//wEAAAAAAPj///8DAAAAALABHgAAAAAAAAAAAAAAAAAAAADA//8PAAAAAADA////PwAAAADADOABAAAAAAAAAAAAAAAAAAAAAP7/PwAAAAD+wf////8DAAAAAGAADgAAAAAAAAAAAAAAAAAAAADw/w8AAAAA+P//////HwAAwACAABAYAAAAAAAAAAAAAAAAAAAA5P8fAAAAAPj//////38AAIABgAAANAAAAAAAAAAAAAAAAAAAALL/DwAAAAD4//////9/AABgAYAQACAAAAAAAAAAAAAAAAAAAIAB/woAAAAA/P//////fwAAMABAGAAEAAAAAAAAAAAAAAAAAADAAAkAAAAAgP//////fzAAABwAAB8ABQAAAAAAAAAAAAAAAAAAPAAAAAAAAPD//////x8AAMAHAPQDAAAAAAAAAAAAAAAAAAAA4AMAAAAAAAD//////38PAAA8AOA/gAMAAAAAAAAAAAAAAAAA4B8AAAAAAAD8///////9AQDwAID/AAIAAAAAAAAAAAAAAAAA/AMAAAAAAADw///////4BwDwA7B/AAYAAAAAAAAAAAAAAAAA/wMAAAAAAAD4/////3/8DwD8A/gfAAEAAAAAAAAAAAAAAAD48wB0AAAAAAD//////8f/A4B/gP8JAAAAAAAAAABAAAAAAOAPBgABAAAAAPj/////H/8fAP4H/mcAAAAAAAAAAAAAAAAAgB8YMAAAAAAA8P////8//38A/R/+TwAAAAAAAAAAAAAAAADAD4AOAAAAAAD4/////8//P8D/v///AAAAAAAAAAAAAAAAAPkDAAAAAAAAAP///////P8B/v///z8BAAAAAAAAAAAAAADkDwAIAAAAAAD4//////kfAf7/////BQAAAAAAAAAAAAAA9B8AAgAAAAAA+P/////8H/7//////wAAAAAAAAAAAAAAQP4DYAAAAAAAAP/////nf+z//////w8AAAAAAAAAAAAAAP0fgAEAAAAAAPj///////z//////x8AAAAAAAAAAAAAgP4/wwAAAAAAAPj/////n////////wcAAAAAAAAAAAAA6P//DwAAAAAAgP//9///////////HwAAAAAAAAAAAADw//8fAAAAAAAA///hgP////////8fCAAAAAAAAAAAAPz//w8AAAAAAMD/DwDg/////////4EAAAAAAAAAAADw////AAAAAAAA/h8AgP////////8BDwAAAAAAAAAA/P///wEAAAAAAPkPIOj///////8/mA8AAAAAAAAAwP///x8AAAAAAAh/QGj/////////MTgAAAAAAAAAwP///w8AAAAAAD6AMf9//P////8fBgQAAAAAAAAA/v///wEAAAAA+AGQ+P/x/////z8IEAAAAAAAAAD+////AQAAAAD4QeT8//z/////3wMEAAAAAAAAwP///38AAAAAwB84n+Pz//////8fAAAAAAAAAMD///9/AAAAAOAPxgfw+P//////BwUAAAAAAAD4////BwAAAADgk3/g8///////fxgAAAAAAAD4////XwAAAAD45x/9/P//////jwAAAAAAAMD/////AwAAAOD///Lj//////8/AAAAAAAAoP///38wAAAA/P///////////wMAAAAAAID+//+/OQAAAP7///////////8FAAAAAADg////LwIAAAD///////////8vAAAAAADg/////wEAAOD///////////8FAAAAAAD+///8PwAAIPf//////////wcEAAAAoP//f/8PAADo/P////////9/YAAAAQD+///+DwAA0BD9////////AzgAgAHA//+HfwAAAIbg////////D+AAAATg//+BPwAAgKH5////////AAcAIMD//wF/AAAAgOH///////8AAQAu/P8f8AAAAAAf////////XwQAX///H3AAAgDA9////////8cB+P//f/AABwDA9////////+8B/v//HxBwAAC8/////////wf8//9vHDxwAO////////+f/f//P1x84ADu/f//////P/7//8fjBwD47b//////h/9/8jX8AIB//f////8H/7+pHfwBwA/Y////f/AAnn78BwAH4P//fwAA8O2DfwAAiP7/HwAA+HfwDwCAyP8jAAAwCPAPAADwBwAAAPThPwBA4AMFABCF/wEABg4AABDkPxAAEAAA4PcPBgABAADeHwQgAADg/wAAAAA4AwAAAIABAAAAAAAAAAAAAAAA';
  const AIR = { TLV: [34.78, 32.01], JFK: [-73.78, 40.64], LHR: [-0.45, 51.47], NRT: [140.39, 35.77], SIN: [103.99, 1.36], DXB: [55.36, 25.25], SYD: [151.18, -33.95], GRU: [-46.47, -23.43], JNB: [28.24, -26.13], LAX: [-118.41, 33.94], CDG: [2.55, 49.01], BOM: [72.87, 19.09], HKG: [113.92, 22.31], MEX: [-99.07, 19.44], NBO: [36.93, -1.32], KEF: [-22.6, 63.98], YVR: [-123.18, 49.19], SCL: [-70.79, -33.39] };
  const ROUTES = 'TLV-JFK LHR-SIN LAX-NRT GRU-JNB DXB-SYD KEF-YVR CDG-HKG MEX-LHR NBO-BOM JFK-GRU TLV-NRT SCL-LAX JNB-DXB YVR-HKG LHR-JFK SIN-SYD BOM-CDG MEX-SCL TLV-NBO NRT-SYD'.split(' ').map(s => s.split('-'));

  EX.add({
    cat: 'libs', id: 'l2-d3-globe', title: 'Dotted globe with flight arcs', aka: 'flight map, route map, great-circle arcs, spinning earth, 3D globe in 2D', runs: 'CPU',
    tool: 'D3 (d3-geo: geoOrthographic, geoPath, geoGraticule10, geoInterpolate, geoDistance)',
    notice: 'The land is about 8,000 dots: Natural Earth coastlines sampled onto a 1.2 degree grid once, then stored as a short bitmask. D3 tilts and spins an orthographic projection, draws the graticule clipped at the horizon, and d3.geoInterpolate gives each flight its great-circle path, lifted off the surface in the middle. Drag the globe to spin it.',
    use: 'company footprint maps, travel and logistics stories, hero sections, network and traffic dashboards',
    prompt: 'Using D3 (d3-geo) on a canvas, draw a dotted globe: Natural Earth land sampled into about 8,000 dots on a 1.2 degree grid, d3.geoOrthographic tilted 20 degrees and spinning {spin} degrees per second, a faint geoGraticule10 and an atmosphere glow. Fly {flights} routes between real airports along great circles from d3.geoInterpolate, lifted {lift} of the radius at mid-flight, with a fading trail, a plane at the head and a landing ring. List the flights in the air with distances from d3.geoDistance. Drag to spin.',
    params: [
      { key: 'spin', label: 'Spin', min: 0, max: 30, step: 1, value: 9, unit: '' },
      { key: 'lift', label: 'Arc height', min: 0, max: 0.6, step: 0.02, value: 0.3 },
      { key: 'flights', label: 'Flights', min: 4, max: 20, step: 1, value: 12, unit: '', restart: true },
    ],
    setup(cv, L) {
      const d3 = W.d3; if (!d3 || !d3.geoOrthographic) return missing(cv, 'D3');
      const g = cv.getContext('2d'), CX = 404, CY = 186, R = 152, TILT = -20, P = 10;
      // land dots as unit vectors
      const raw = atob(LAND), xs = [], ys = [], zs = [];
      let i = 0;
      for (let lat = -90 + 0.6; lat < 90; lat += 1.2) {
        const m = Math.max(1, Math.round(360 * Math.cos(lat * RAD) / 1.2)), cp = Math.cos(lat * RAD), sp = Math.sin(lat * RAD);
        for (let j = 0; j < m; j++, i++) if ((raw.charCodeAt(i >> 3) >> (i & 7)) & 1) { const lo = (-180 + (j + 0.5) * 360 / m) * RAD; xs.push(cp * Math.cos(lo)); ys.push(cp * Math.sin(lo)); zs.push(sp); }
      }
      const N = xs.length, DX = Float32Array.from(xs), DY = Float32Array.from(ys), DZ = Float32Array.from(zs);
      const SX = new Float32Array(N), SY = new Float32Array(N), SB = new Int8Array(N);
      const unit = ([lo, la]) => [Math.cos(la * RAD) * Math.cos(lo * RAD), Math.cos(la * RAD) * Math.sin(lo * RAD), Math.sin(la * RAD)];
      // flights: 65 great-circle samples each, from d3.geoInterpolate
      const NS = 64, COLS = [C.coral, C.amber, C.cyan];
      const nF = Math.round((L.p && L.p.flights) || 12);
      const flights = ROUTES.slice(0, nF).map(([a, b], k) => {
        const A = AIR[a], B = AIR[b], ip = d3.geoInterpolate(A, B), dist = d3.geoDistance(A, B), s = new Float32Array((NS + 1) * 3);
        for (let q = 0; q <= NS; q++) s.set(unit(ip(q / NS)), q * 3);
        const dur = 1.6 + dist * 1.4;
        return { a, b, s, dist, km: Math.round(dist * 6371), dur, lag: dur * 0.45, start: k * P / nF, col: COLS[k % 3], A: unit(A), B: unit(B) };
      });
      const cities = Object.keys(AIR).map(k => ({ k, u: unit(AIR[k]) }));
      const proj = d3.geoOrthographic().scale(R).translate([CX, CY]).clipAngle(90), path = d3.geoPath(proj, g), grat = d3.geoGraticule10();
      const st = { off: 0, vel: 0, down: false, x: 0 };
      cv.style.cursor = 'grab'; cv.style.touchAction = 'none';
      cv.onpointerdown = e => { st.down = true; st.x = at(cv, e)[0]; st.vel = 0; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; };
      cv.onpointermove = e => { if (!st.down) return; const x = at(cv, e)[0]; st.off += (x - st.x) * 0.35; st.vel = (x - st.x) * 0.35 * 60; st.x = x; };
      cv.onpointerup = cv.onpointercancel = () => { st.down = false; cv.style.cursor = 'grab'; };
      // background: glow, atmosphere and ocean disc, drawn once
      const bg = document.createElement('canvas'); bg.width = 640; bg.height = 360;
      {
        const b = bg.getContext('2d'); b.fillStyle = C.bg; b.fillRect(0, 0, 640, 360);
        let gr = b.createRadialGradient(CX, CY, R * 0.6, CX, CY, R * 1.9); gr.addColorStop(0, 'rgba(43,100,160,0.28)'); gr.addColorStop(1, 'rgba(43,100,160,0)'); b.fillStyle = gr; b.fillRect(0, 0, 640, 360);
        gr = b.createRadialGradient(CX, CY, R * 0.96, CX, CY, R * 1.14); gr.addColorStop(0, 'rgba(110,200,240,0.35)'); gr.addColorStop(1, 'rgba(110,200,240,0)'); b.fillStyle = gr; b.beginPath(); b.arc(CX, CY, R * 1.14, 0, 7); b.fill();
        gr = b.createRadialGradient(CX - R * 0.35, CY - R * 0.45, R * 0.1, CX, CY, R); gr.addColorStop(0, '#16284a'); gr.addColorStop(1, '#080d1a'); b.fillStyle = gr; b.beginPath(); b.arc(CX, CY, R, 0, 7); b.fill();
      }
      const DOT = [0.62, 0.8, 0.98, 1.12], DA = ['rgba(150,205,230,0.28)', 'rgba(165,215,236,0.5)', 'rgba(185,226,240,0.75)', 'rgba(214,240,248,0.98)'];
      let cl = 1, sl = 0;
      const cp = Math.cos(TILT * RAD), sp = Math.sin(TILT * RAD), out = [0, 0, 0, 0];
      // Projects unit vector (x, y, z) lifted by h into out = [sx, sy, depth, visible].
      const project = (x, y, z, h) => {
        const x1 = x * cl - y * sl, y1 = x * sl + y * cl, k = 1 + h;
        const X = y1 * k, Y = (z * cp + x1 * sp) * k, D = (x1 * cp - z * sp) * k;
        out[0] = CX + R * X; out[1] = CY - R * Y; out[2] = D; out[3] = D > 0 || X * X + Y * Y > 1 ? 1 : 0;
      };
      // Draws a ring lying flat on the surface at unit vector u.
      const ring = (u, r, col, a) => {
        project(u[0], u[1], u[2], 0); if (out[2] <= 0.05) return;
        const ang = Math.atan2(out[1] - CY, out[0] - CX);
        g.globalAlpha = a * Math.min(1, out[2] * 3); g.strokeStyle = col; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(out[0], out[1], Math.max(0.1, r * out[2]), r, ang, 0, 7); g.stroke(); g.globalAlpha = 1;
      };
      return (t, dt) => {
        const p = Object.assign({ spin: 9, lift: 0.3 }, L.p);
        if (!st.down) { st.vel *= Math.exp(-dt * 2.2); st.off += st.vel * dt; }
        const lamD = -20 + t * p.spin + st.off, lam = lamD * RAD; cl = Math.cos(lam); sl = Math.sin(lam);
        g.drawImage(bg, 0, 0);
        // graticule through d3.geoPath, clipped at the horizon
        proj.rotate([lamD, TILT]);
        g.beginPath(); path(grat); g.strokeStyle = 'rgba(120,170,220,0.12)'; g.lineWidth = 0.8; g.stroke();
        // land dots in four depth bands, so the limb fades
        for (let q = 0; q < N; q++) {
          const x = DX[q], y = DY[q], z = DZ[q], x1 = x * cl - y * sl, D = x1 * cp - z * sp;
          if (D <= 0) { SB[q] = -1; continue; }
          SX[q] = CX + R * (x * sl + y * cl); SY[q] = CY - R * (z * cp + x1 * sp); SB[q] = D > 0.75 ? 3 : D > 0.45 ? 2 : D > 0.2 ? 1 : 0;
        }
        for (let b = 0; b < 4; b++) {
          const r = DOT[b]; g.fillStyle = DA[b]; g.beginPath();
          for (let q = 0; q < N; q++) if (SB[q] === b) { g.moveTo(SX[q] + r, SY[q]); g.arc(SX[q], SY[q], r, 0, 6.2832); }
          g.fill();
        }
        // cities
        g.font = `600 9px ${MONO}`; g.textAlign = 'left';
        for (const c of cities) {
          project(c.u[0], c.u[1], c.u[2], 0); if (out[2] <= 0) continue;
          const a = Math.min(1, out[2] * 2.5); g.globalAlpha = a; g.fillStyle = C.cream; g.beginPath(); g.arc(out[0], out[1], 1.8, 0, 7); g.fill();
          if (out[2] > 0.35) { g.globalAlpha = a * 0.7 * clamp01((out[2] - 0.35) * 4); g.fillText(c.k, out[0] + 4, out[1] - 3); }
        }
        g.globalAlpha = 1;
        // flights: trail from tail to head, plane at the head, rings at take-off and landing
        const active = [];
        g.lineCap = 'round';
        for (const f of flights) {
          const lt = ((t - f.start) % P + P) % P, uh = clamp01(lt / f.dur), ut = clamp01((lt - f.lag) / f.dur);
          if (uh < 1 && lt > 0) active.push([f, uh]);
          if (lt < 0.9) ring(f.A, 3 + lt * 12, f.col, 1 - lt / 0.9);
          if (lt > f.dur && lt < f.dur + 1.4) { const k = (lt - f.dur) / 1.4; ring(f.B, 3 + ease.out(k) * 16, f.col, 1 - k); ring(f.B, 2 + ease.out(k) * 8, C.cream, (1 - k) * 0.6); }
          if (ut >= 1 || uh <= 0) continue;
          const eh = ease.inOut(uh), et = ease.inOut(ut), hMax = p.lift * (0.25 + f.dist / Math.PI);
          const q0 = Math.floor(et * NS), q1 = Math.min(NS, Math.ceil(eh * NS)), s = f.s;
          let px = 0, py = 0, pv = 0;
          g.strokeStyle = f.col;
          for (let q = q0; q <= q1; q++) {
            const u = q === q0 ? et : q === q1 ? eh : q / NS, k = Math.min(NS - 1, Math.floor(u * NS)), fr = u * NS - k;
            const x = lerp(s[k * 3], s[k * 3 + 3], fr), y = lerp(s[k * 3 + 1], s[k * 3 + 4], fr), z = lerp(s[k * 3 + 2], s[k * 3 + 5], fr), n = Math.hypot(x, y, z);
            project(x / n, y / n, z / n, hMax * Math.sin(Math.PI * u));
            if (q > q0 && pv && out[3]) { g.globalAlpha = 0.15 + 0.85 * clamp01((u - et) / Math.max(1e-3, eh - et)); g.lineWidth = 1.2 + 1.6 * g.globalAlpha; g.beginPath(); g.moveTo(px, py); g.lineTo(out[0], out[1]); g.stroke(); }
            if (q === q1 && q > q0 && out[3] && uh < 1) {
              const ang = Math.atan2(out[1] - py, out[0] - px);
              g.fillStyle = f.col; g.globalAlpha = 0.3; g.beginPath(); g.arc(out[0], out[1], 6, 0, 7); g.fill();
              g.globalAlpha = 1; g.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), out[0], out[1]);
              g.fillStyle = C.cream; g.beginPath(); g.moveTo(5, 0); g.lineTo(-1, -4.5); g.lineTo(-2, -1); g.lineTo(-4.5, -2.4); g.lineTo(-4, 0); g.lineTo(-4.5, 2.4); g.lineTo(-2, 1); g.lineTo(-1, 4.5); g.closePath(); g.fill();
              g.setTransform(1, 0, 0, 1, 0, 0);
            }
            px = out[0]; py = out[1]; pv = out[3];
          }
          g.globalAlpha = 1;
        }
        // HUD: flights in the air
        active.sort((a, b) => a[0].start - b[0].start);
        g.textAlign = 'left'; g.fillStyle = C.cream; g.font = `700 13px ${DISP}`; g.fillText('IN THE AIR', 22, 36);
        g.fillStyle = '#7f8aa3'; g.font = `11px ${MONO}`; g.fillText(active.length + ' flights on great circles', 22, 54);
        active.slice(0, 6).forEach(([f, uh], r) => {
          const y = 86 + r * 40;
          g.globalAlpha = clamp01(uh * 10); g.fillStyle = f.col; g.fillRect(22, y - 10, 3, 26);
          g.fillStyle = C.cream; g.font = `600 13px ${MONO}`; g.fillText(f.a + ' → ' + f.b, 32, y + 2);
          g.fillStyle = '#7f8aa3'; g.font = `11px ${MONO}`; g.textAlign = 'right'; g.fillText(f.km.toLocaleString('en-US') + ' km', 196, y + 2); g.textAlign = 'left';
          g.fillStyle = '#20263a'; g.fillRect(32, y + 9, 164, 3); g.fillStyle = f.col; g.fillRect(32, y + 9, 164 * ease.inOut(uh), 3);
        });
        g.globalAlpha = 1;
        g.fillStyle = '#58607a'; g.font = `11px ${MONO}`; g.fillText(`geoOrthographic().rotate([${((lamD % 360 + 540) % 360 - 180).toFixed(0)}, ${TILT}])`, 22, 344);
      };
    },
  });

  // ---------------------------------------------------------------- Matter.js
  const SENT = [['Every', 'word', 'is', 'a', 'body.'], ['It', 'falls,', 'piles', 'up,'], ['then', 'springs', 'back', 'home.']];
  const ACCENT = { 'body.': C.coral, 'falls,': C.amber, 'piles': C.cyan, 'springs': C.violet, 'home.': C.coral };

  EX.add({
    cat: 'libs', id: 'l2-matter-words', title: 'Words that fall and spring back', aka: 'physics typography, falling text, tumbling words, kinetic sentence, text rigid bodies', runs: 'CPU',
    tool: 'Matter.js (Bodies.rectangle with chamfer, Constraint springs, collisionFilter, Query.point)',
    notice: 'Each word is a rounded Matter.js rectangle the size of its label. The words drop from the end of the sentence backward, tumble and pile up on the floor. Then gravity turns off and two spring constraints per word pull it to its home slot and level it, so it overshoots and settles. Drag a word while it is loose.',
    use: 'playful hero headlines, error and empty pages, section intros, social clips',
    prompt: 'Using Matter.js on a canvas, set a 3-line sentence as rounded word chips. After 1 s drop the words one after another from the last word back, with gravity {grav} and restitution {bounce}, so they tumble and pile on the floor. At 6 s turn gravity off, stop word-to-word collisions, and attach two Constraint springs (stiffness {stiff}) per word to its home slot so it flies back, overshoots and levels out. Show the springs and the empty slots, let me drag loose words, and loop every 11 s.',
    params: [
      { key: 'grav', label: 'Gravity', min: 0.3, max: 2, step: 0.1, value: 1 },
      { key: 'bounce', label: 'Bounce', min: 0, max: 0.8, step: 0.05, value: 0.3 },
      { key: 'stiff', label: 'Spring stiffness', min: 0.005, max: 0.08, step: 0.005, value: 0.02, dec: 3 },
    ],
    setup(cv, L) {
      const M = W.Matter; if (!M) return missing(cv, 'Matter.js');
      const g = cv.getContext('2d'), FONT = `700 28px ${DISP}`, H = 46, GAP = 10, FLOOR = 330, LOOP = 11;
      g.font = FONT;
      const engine = M.Engine.create({ positionIterations: 8, velocityIterations: 6 }), world = engine.world;
      const wallOpt = { isStatic: true, friction: 0.6, collisionFilter: { category: 1, mask: 3 } };
      M.Composite.add(world, [M.Bodies.rectangle(320, FLOOR + 30, 760, 60, wallOpt), M.Bodies.rectangle(-30, 100, 60, 600, wallOpt), M.Bodies.rectangle(670, 100, 60, 600, wallOpt)]);
      const words = [];
      SENT.forEach((line, r) => {
        const ws = line.map(s => g.measureText(s).width + 26), tw = ws.reduce((a, b) => a + b, 0) + GAP * (line.length - 1);
        let x = 320 - tw / 2;
        line.forEach((s, k) => {
          const w = ws[k], hx = x + w / 2, hy = 92 + r * (H + 14);
          const b = M.Bodies.rectangle(hx, hy, w, H, { chamfer: { radius: 12 }, friction: 0.5, frictionAir: 0.012, density: 0.0015, collisionFilter: { category: 2, mask: 3 } });
          M.Composite.add(world, b);
          words.push({ s, w, b, hx, hy, col: ACCENT[s] || C.cream, state: 'home', springs: null });
          x += w + GAP;
        });
      });
      const nW = words.length;
      const hold = o => { M.Body.setPosition(o.b, { x: o.hx, y: o.hy }); M.Body.setAngle(o.b, 0); M.Body.setVelocity(o.b, { x: 0, y: 0 }); M.Body.setAngularVelocity(o.b, 0); };
      const unspring = o => { if (o.springs) { o.springs.forEach(c => M.Composite.remove(world, c)); o.springs = null; } };
      const reset = () => { words.forEach(o => { unspring(o); o.state = 'home'; o.b.collisionFilter.mask = 3; hold(o); }); };
      reset();
      // dragging a loose word with a pointer constraint
      let drag = null;
      cv.style.cursor = 'grab'; cv.style.touchAction = 'none';
      cv.onpointerdown = e => {
        const [x, y] = at(cv, e), hit = M.Query.point(words.filter(o => o.state === 'loose').map(o => o.b), { x, y })[0];
        if (!hit) return;
        drag = M.Constraint.create({ pointA: { x, y }, bodyB: hit, pointB: { x: x - hit.position.x, y: y - hit.position.y }, stiffness: 0.12, damping: 0.1 });
        M.Composite.add(world, drag); cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
      };
      cv.onpointermove = e => { if (drag) { const [x, y] = at(cv, e); drag.pointA.x = x; drag.pointA.y = y; } };
      cv.onpointerup = cv.onpointercancel = () => { if (drag) { M.Composite.remove(world, drag); drag = null; } cv.style.cursor = 'grab'; };
      let acc = 0, simT = 0, cyc = -1;
      const step = (lt, p) => {
        engine.gravity.y = lt < 6 ? p.grav : 0;
        words.forEach((o, i) => {
          const rel = 1 + (nW - 1 - i) * 0.07, ret = 6 + i * 0.05;
          if (o.state === 'home' && lt >= rel && lt < 6) { o.state = 'loose'; M.Body.setAngularVelocity(o.b, (EX.rng(i * 7 + cyc * 31)() - 0.5) * 0.08); }
          if (o.state === 'loose' && lt >= ret) {
            o.state = 'return'; o.b.collisionFilter.mask = 1; o.b.frictionAir = 0.03;
            if (drag && drag.bodyB === o.b) { M.Composite.remove(world, drag); drag = null; }
            const dx = o.w / 2 - 8;
            o.springs = [-dx, dx].map(ox => M.Constraint.create({ pointA: { x: o.hx + ox, y: o.hy }, bodyB: o.b, pointB: { x: ox * Math.cos(o.b.angle), y: ox * Math.sin(o.b.angle) }, stiffness: 0, damping: 0.02, length: 0 }));
            M.Composite.add(world, o.springs);
          }
          if (o.state === 'return') {
            const k = clamp01((lt - ret) / 0.8);
            o.springs.forEach(c => { c.stiffness = p.stiff * k * k; });
            const d = Math.hypot(o.b.position.x - o.hx, o.b.position.y - o.hy), a = Math.abs(Math.atan2(Math.sin(o.b.angle), Math.cos(o.b.angle)));
            if ((lt > ret + 1 && d < 0.8 && a < 0.01 && o.b.speed < 0.3) || lt > LOOP - 0.6) { unspring(o); o.state = 'home'; o.b.collisionFilter.mask = 3; }
          }
          if (o.state === 'home') hold(o);
          else o.b.restitution = p.bounce;
        });
        M.Engine.update(engine, 1000 / 60);
      };
      // Draws one word chip at body position and angle.
      const chip = (o, x, y, a) => {
        g.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), x, y);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.roundRect(-o.w / 2 + 3, -H / 2 + 5, o.w, H, 12); g.fill();
        g.fillStyle = o.col; g.beginPath(); g.roundRect(-o.w / 2, -H / 2, o.w, H, 12); g.fill();
        g.fillStyle = '#0b0b10'; g.fillText(o.s, 0, 10);
      };
      return (t, dt) => {
        const p = Object.assign({ grav: 1, bounce: 0.3, stiff: 0.02 }, L.p);
        const c = Math.floor(t / LOOP); if (c !== cyc) { cyc = c; reset(); simT = c * LOOP; acc = 0; }
        acc += dt; let n = 0;
        while (acc >= 1 / 60 && n < 4) { acc -= 1 / 60; n++; simT += 1 / 60; step(simT - cyc * LOOP, p); }
        if (acc > 0.1) acc = 0;
        const lt = t - cyc * LOOP;
        g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#101018'; g.fillRect(0, 0, 640, 360);
        g.fillStyle = '#16161f'; g.fillRect(0, FLOOR, 640, 360 - FLOOR); g.fillStyle = '#2a2a3a'; g.fillRect(0, FLOOR, 640, 2);
        // empty home slots
        g.setLineDash([4, 5]); g.lineWidth = 1.5;
        for (const o of words) if (o.state !== 'home') { g.strokeStyle = 'rgba(244,239,230,0.18)'; g.beginPath(); g.roundRect(o.hx - o.w / 2, o.hy - H / 2, o.w, H, 12); g.stroke(); }
        g.setLineDash([]);
        // springs
        for (const o of words) if (o.springs) for (const s of o.springs) {
          const b = M.Constraint.pointBWorld(s); g.strokeStyle = o.col; g.globalAlpha = 0.55; g.lineWidth = 1.5;
          g.beginPath(); const sx = s.pointA.x, sy = s.pointA.y, dx = b.x - sx, dy = b.y - sy, len = Math.hypot(dx, dy), nx = -dy / (len || 1), ny = dx / (len || 1), coils = 10;
          g.moveTo(sx, sy); for (let q = 1; q < coils * 2; q++) { const u = q / (coils * 2), z = (q % 2 ? 1 : -1) * 4; g.lineTo(sx + dx * u + nx * z, sy + dy * u + ny * z); } g.lineTo(b.x, b.y); g.stroke();
          g.globalAlpha = 1; g.fillStyle = o.col; g.beginPath(); g.arc(sx, sy, 2.5, 0, 7); g.fill();
        }
        g.font = FONT; g.textAlign = 'center';
        for (const o of words) chip(o, o.b.position.x, o.b.position.y, o.b.angle);
        g.setTransform(1, 0, 0, 1, 0, 0); g.textAlign = 'left';
        const ph = lt < 1 ? 'hold' : lt < 6 ? 'gravity ' + p.grav.toFixed(1) + ', restitution ' + p.bounce.toFixed(2) : words.some(o => o.state !== 'home') ? 'gravity 0, Constraint springs, stiffness ' + p.stiff.toFixed(3) : 'home';
        g.font = `600 13px ${MONO}`; g.fillStyle = C.cream; g.fillText('Matter.js', 18, 26);
        g.font = `12px ${MONO}`; g.fillStyle = '#8a8794'; g.fillText(ph, 100, 26);
        g.textAlign = 'right'; g.fillText(lt > 1.2 && lt < 6 ? 'drag a loose word' : '', 622, 26); g.textAlign = 'left';
      };
    },
  });

  EX.add({
    cat: 'libs', id: 'l2-matter-wreck', title: 'Wrecking ball in slow motion', aka: 'demolition, brick wall smash, bullet time, rigid body impact', runs: 'CPU',
    tool: 'Matter.js (Constraint rope, Bodies, Events collisionStart, engine.timing.timeScale)',
    notice: 'A heavy ball on a Matter.js Constraint rope swings into a tower of 70 bricks. A collisionStart event listener turns every hard hit into a puff of dust, and the first hit drops engine.timing.timeScale for a moment of slow motion before the physics speeds back up. The tower is rebuilt every 9 seconds.',
    use: 'game prototypes, launch teasers, playful error pages, physics explainers',
    prompt: 'Using Matter.js on a canvas, hang a heavy ball (density 20 times the bricks) on a Constraint rope from a crane, pull it back 70 degrees, and release it into a running-bond tower of 70 bricks. Listen to Events collisionStart and spawn dust puffs where pairs hit harder than a threshold. Start the bricks asleep. On the first ball hit, ease engine.timing.timeScale down to {slow}, hold it {hold}, then ease back to 1. Draw a dusk sky, the crane, the rope as chain links, and rebuild the tower every 9 s.',
    params: [
      { key: 'slow', label: 'Slow motion', min: 0.1, max: 1, step: 0.05, value: 0.25 },
      { key: 'hold', label: 'Slow-mo time', min: 0.3, max: 3, step: 0.1, value: 1.4, unit: ' s' },
    ],
    setup(cv, L) {
      const M = W.Matter; if (!M) return missing(cv, 'Matter.js');
      const g = cv.getContext('2d'), FLOOR = 332, AX = 256, AY = 18, LEN = 236, BR = 30, BW = 30, BH = 17, LOOP = 9;
      const COLS = ['#c9573c', '#d9693f', '#b84a35', '#e07a4a', '#a8432f'];
      let engine, ball, rope, bricks, dust, hitT, simT, acc;
      const build = () => {
        engine = M.Engine.create({ positionIterations: 10, velocityIterations: 8, constraintIterations: 4, enableSleeping: true });
        const wo = { isStatic: true, friction: 0.9 };
        M.Composite.add(engine.world, [M.Bodies.rectangle(320, FLOOR + 30, 900, 60, wo), M.Bodies.rectangle(-40, 180, 80, 600, wo), M.Bodies.rectangle(680, 180, 80, 600, wo)]);
        bricks = []; const R = EX.rng(5);
        for (let r = 0; r < 14; r++) for (let c = 0; c < 5; c++) {
          const off = r % 2 ? BW / 2 : 0, x = 372 + c * BW + off, y = FLOOR - BH / 2 - r * BH;
          const b = M.Bodies.rectangle(x, y, BW - 1, BH - 0.5, { friction: 0.7, restitution: 0.05, density: 0.0015, slop: 0.02 });
          b.col = COLS[Math.floor(R() * COLS.length)]; bricks.push(b);
        }
        M.Composite.add(engine.world, bricks); bricks.forEach(b => M.Sleeping.set(b, true)); // asleep until hit, so the tower stands still
        const a = -70 * RAD;
        ball = M.Bodies.circle(AX + Math.sin(a) * LEN, AY + Math.cos(a) * LEN, BR, { density: 0.03, frictionAir: 0.0008, restitution: 0.1, friction: 0.2 });
        M.Body.setStatic(ball, true);
        rope = M.Constraint.create({ pointA: { x: AX, y: AY }, bodyB: ball, length: LEN, stiffness: 1 });
        M.Composite.add(engine.world, [ball, rope]);
        dust = []; hitT = -1; simT = 0; acc = 0; const RD = EX.rng(cyc * 13 + 3);
        M.Events.on(engine, 'collisionStart', ev => {
          for (const pr of ev.pairs) {
            const A = pr.bodyA, B = pr.bodyB, rel = Math.hypot(A.velocity.x - B.velocity.x, A.velocity.y - B.velocity.y);
            if (rel < 2.2 || dust.length > 160) continue;
            const s = pr.collision.supports && pr.collision.supports[0]; if (!s) continue;
            const isBall = A === ball || B === ball;
            if (isBall && hitT < 0) hitT = now;
            const n = isBall ? 7 : 2;
            for (let k = 0; k < n; k++) dust.push({ x: s.x, y: s.y, vx: (RD() - 0.5) * 50, vy: -10 - RD() * 40, t0: simT, r: 3 + RD() * (isBall ? 9 : 5) });
          }
        });
      };
      let cyc = 0, scale = 1, now = 0;
      build();
      return (t, dt) => {
        const p = Object.assign({ slow: 0.25, hold: 1.4 }, L.p), c = Math.floor(t / LOOP), lt = t - c * LOOP;
        if (c !== cyc) { cyc = c; build(); }
        if (lt > 0.8 && ball.isStatic) M.Body.setStatic(ball, false);
        // slow motion: ease timeScale down after the first ball hit, hold, then back to 1
        let target = 1;
        now = lt; if (hitT >= 0) target = lt - hitT < p.hold ? p.slow : 1;
        scale += (target - scale) * (1 - Math.exp(-dt * (target < scale ? 14 : 2.5)));
        engine.timing.timeScale = scale;
        acc += dt; let n = 0;
        while (acc >= 1 / 60 && n < 4) { acc -= 1 / 60; n++; simT += scale / 60; M.Engine.update(engine, 1000 / 60); }
        if (acc > 0.1) acc = 0;
        // sky, sun glow, crane
        const sky = g.createLinearGradient(0, 0, 0, 360); sky.addColorStop(0, '#141432'); sky.addColorStop(0.7, '#3a2246'); sky.addColorStop(1, '#5b2c3c'); g.fillStyle = sky; g.fillRect(0, 0, 640, 360);
        const sun = g.createRadialGradient(520, 250, 10, 520, 250, 220); sun.addColorStop(0, 'rgba(255,150,80,0.45)'); sun.addColorStop(1, 'rgba(255,150,80,0)'); g.fillStyle = sun; g.fillRect(0, 0, 640, 360);
        g.strokeStyle = '#0d0c18'; g.lineWidth = 3; g.beginPath(); g.moveTo(60, FLOOR); g.lineTo(60, 8); g.lineTo(AX + 30, 8); g.moveTo(60, 40); g.lineTo(110, 8); g.stroke();
        g.lineWidth = 1.5; g.beginPath(); for (let x = 60; x < AX + 20; x += 18) { g.moveTo(x, 8); g.lineTo(x + 9, 16); g.lineTo(x + 18, 8); } g.moveTo(60, 16); g.lineTo(AX + 20, 16); g.stroke();
        g.fillStyle = '#0d0c18'; g.fillRect(AX - 7, 8, 14, 14); g.fillRect(0, FLOOR, 640, 360 - FLOOR);
        // rope as chain links
        const bx = ball.position.x, by = ball.position.y, dx = bx - AX, dy = by - (AY + 4), dl = Math.hypot(dx, dy), nl = Math.floor(dl / 9);
        g.strokeStyle = '#8f8aa0'; g.lineWidth = 2;
        for (let k = 0; k < nl; k++) { const u = (k + 0.5) / nl, x = AX + dx * u, y = AY + 4 + dy * u; g.save(); g.translate(x, y); g.rotate(Math.atan2(dy, dx)); g.beginPath(); g.ellipse(0, 0, 5.5, k % 2 ? 1.2 : 3, 0, 0, 7); g.stroke(); g.restore(); }
        // bricks
        for (const b of bricks) {
          const v = b.vertices; g.fillStyle = b.col; g.beginPath(); g.moveTo(v[0].x, v[0].y); for (let k = 1; k < v.length; k++) g.lineTo(v[k].x, v[k].y); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(30,12,16,0.55)'; g.lineWidth = 1; g.stroke();
        }
        // ball with a rim light
        const gr = g.createRadialGradient(bx - 10, by - 12, 4, bx, by, BR); gr.addColorStop(0, '#6e6a80'); gr.addColorStop(0.6, '#2a2836'); gr.addColorStop(1, '#14131c');
        g.fillStyle = gr; g.beginPath(); g.arc(bx, by, BR, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,160,100,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, BR - 1, -0.4, 1.2); g.stroke();
        g.fillStyle = '#14131c'; g.fillRect(bx - 5, by - BR - 6, 10, 8);
        // dust in simulation time, so it slows down with the physics
        for (let i = dust.length - 1; i >= 0; i--) {
          const d = dust[i], a = simT - d.t0; if (a > 1.2) { dust.splice(i, 1); continue; }
          const k = a / 1.2; g.globalAlpha = 0.5 * (1 - k); g.fillStyle = '#d9c2b0';
          g.beginPath(); g.arc(d.x + d.vx * a, d.y + d.vy * a + 20 * a * a, d.r * (1 + k * 2.5), 0, 7); g.fill();
        }
        g.globalAlpha = 1;
        if (lt > LOOP - 0.6) { g.fillStyle = `rgba(11,11,16,${clamp01((lt - LOOP + 0.6) / 0.5)})`; g.fillRect(0, 0, 640, 360); }
        g.font = `600 13px ${MONO}`; g.fillStyle = C.cream; g.fillText('Matter.js', 18, 340);
        g.font = `12px ${MONO}`; g.fillStyle = scale < 0.98 ? C.amber : '#a8a2b8'; g.fillText(`engine.timing.timeScale = ${scale.toFixed(2)}`, 100, 340);
      };
    },
  });



  // ---------------------------------------------------------------- anime.js v4 SVG
  // Resamples a polyline to n points spaced evenly along its length, so every drawing has the same point count.
  function resample(pts, n) {
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const out = [], len = cum[cum.length - 1]; let j = 1;
    for (let k = 0; k < n; k++) {
      const s = len * k / (n - 1); while (j < pts.length - 1 && cum[j] < s) j++;
      const f = (s - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]);
      out.push([lerp(pts[j - 1][0], pts[j][0], f), lerp(pts[j - 1][1], pts[j][1], f)]);
    }
    return out;
  }
  // Four one-line drawings (pulse, peaks, loops, skyline) as 'M x y L x y ...' strings with the same structure.
  function lineArt() {
    const gs = (x, c, s) => Math.exp(-(((x - c) / s) ** 2)), pulse = [], loops = [];
    for (let x = 40; x <= 600; x += 0.5) {
      let y = 0; for (const c of [150, 330, 510]) { const d = x - c; y += -9 * gs(d, -40, 9) + 9 * gs(d, -7, 2.5) - 105 * gs(d, 0, 3.2) + 30 * gs(d, 8, 3) - 18 * gs(d, 38, 11); }
      pulse.push([x, 236 + y]);
    }
    const cx = 300, cy = 92, r = 32, a0 = Math.atan2(128 - cy, 240 - cx), sun = [];
    for (let k = 0; k <= 60; k++) { const a = a0 + k / 60 * Math.PI * 2; sun.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    const peaks = [[40, 236], [100, 250], [150, 190], [185, 214], [240, 128], ...sun, [330, 204], [395, 138], [430, 176], [470, 150], [522, 232], [560, 250], [600, 250]];
    for (let k = 0; k <= 1400; k++) { const u = k / 1400, th = u * Math.PI * 2 * 7, R = 34 * Math.pow(Math.sin(Math.PI * u), 0.6); loops.push([40 + 560 * u - R * Math.sin(th), 236 - R * (1 - Math.cos(th))]); }
    const sky = []; let x = 0; const R2 = EX.rng(4);
    for (const h of [62, 104, 48, 150, 86, 120, 58, 96, 132, 70, 40, 112, 66]) {
      const w = 26 + Math.floor(R2() * 22); sky.push([x, 250], [x, 250 - h]);
      if (h === 150) sky.push([x + w / 2 - 2, 250 - h], [x + w / 2 - 2, 250 - h - 44], [x + w / 2 + 2, 250 - h - 44], [x + w / 2 + 2, 250 - h]);
      sky.push([x + w, 250 - h], [x + w, 250]); x += w + 4 + Math.floor(R2() * 6);
    }
    const sk = 500 / x; sky.forEach(q => { q[0] = 64 + q[0] * sk; }); sky.unshift([40, 236]); sky.push([600, 250]);
    const d = pts => 'M' + resample(pts, 220).map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L');
    return [d(pulse), d(peaks), d(loops), d(sky)];
  }

  EX.add({
    cat: 'libs', id: 'l2-anime-lineart', kind: 'dom', title: 'One line, four drawings', aka: 'line drawing animation, self-drawing SVG, path morph, retro stripes, one-line art', runs: 'WEB',
    tool: 'anime.js v4 (createDrawable, morphTo, createMotionPath, createTimeline, stagger)',
    notice: 'A single line draws itself as a heartbeat, then morphs into mountains with a sun, a looping cord and a city skyline, and finally erases itself. createDrawable turns the draw into one value, morphTo moves every point of the path to the next drawing, and createMotionPath carries the pen dot along the line. The colored stripes run the same animation with a stagger, so they trail behind in every morph.',
    use: 'brand intros, section dividers, onboarding illustrations, loading screens',
    prompt: 'Using anime.js v4, build an SVG line drawing on a dark navy background: one path with {stripes} retro offset stripes (cream, coral, amber, cyan, violet). Draw it as an ECG pulse with createDrawable (draw 0 0 to 0 1) and a pen dot moving along it with createMotionPath, then morphTo a mountain range with a looping sun, a looping phone cord and a city skyline, {morph} ms per morph, stripes delayed with stagger({stg}). Erase it at the end and loop. All four drawings share the same point count so the morphs stay clean.',
    params: [
      { key: 'stripes', label: 'Stripes', min: 1, max: 5, step: 1, value: 4, unit: '', restart: true },
      { key: 'stg', label: 'Stagger', min: 0, max: 200, step: 10, value: 80, unit: ' ms', restart: true },
      { key: 'morph', label: 'Morph time', min: 400, max: 2000, step: 100, value: 1100, unit: '', restart: true },
    ],
    setup(st, L) {
      const A = W.anime; if (!A || !A.createDrawable || !A.morphTo || !A.createMotionPath) return missing(st, 'anime.js');
      if (st._tl) { try { st._tl.pause(); } catch (e) { /* done */ } }
      const p = Object.assign({ stripes: 4, stg: 80, morph: 1100 }, L.p), n = Math.round(p.stripes), STG = p.stg, MS = p.morph;
      const D = lineArt(), NAMES = ['pulse', 'peaks', 'loops', 'skyline'], COLS = [C.cream, C.coral, C.amber, C.cyan, C.violet];
      const stripes = COLS.slice(0, n).map((c, k) => `<path d="${D[0]}" transform="translate(${k * 4},${k * 7})" fill="none" stroke="${c}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`).reverse().join('');
      st.innerHTML = `<style>.al{position:absolute;inset:0;background:radial-gradient(120% 100% at 30% 10%,#1f1b45 0%,#0d0c1c 60%,#0b0b10 100%);overflow:hidden}
        .al svg{position:absolute;left:0;top:0}
        .al-h{position:absolute;left:18px;top:14px;font:600 13px ${MONO};color:${C.cream}}
        .al-c{position:absolute;left:18px;top:34px;font:12px ${MONO};color:#8f8aa8;white-space:pre}
        .al-c b{color:${C.amber};font-weight:600}
        .al-n{position:absolute;right:22px;bottom:16px;text-align:right;font:700 30px ${DISP};color:${C.cream};letter-spacing:1px}
        .al-n span{display:block;font:12px ${MONO};color:#8f8aa8;letter-spacing:2px}</style>
        <div class="al"><svg viewBox="0 0 640 360" width="640" height="360"><g visibility="hidden">${D.map(d => `<path d="${d}"/>`).join('')}</g>
        <g class="al-lines">${stripes}</g><g class="al-pen"><circle r="9" fill="${C.cream}" opacity="0.18"/><circle r="4.5" fill="${C.cream}"/></g></svg>
        <div class="al-h">anime.js v4</div><div class="al-c"></div><div class="al-n"></div></div>`;
      const ref = [...st.querySelectorAll('g[visibility] path')], lines = [...st.querySelectorAll('.al-lines path')].reverse();
      const pen = /** @type {SVGGElement} */ (st.querySelector('.al-pen')), code = /** @type {HTMLElement} */ (st.querySelector('.al-c')), name = /** @type {HTMLElement} */ (st.querySelector('.al-n'));
      const draws = A.createDrawable(lines), spread = STG * (n - 1);
      const tl = A.createTimeline({ autoplay: false, defaults: { ease: 'inOutCubic' } }); st._tl = tl;
      const phases = /** @type {[number, string, number][]} */ ([[0, 'draw', 0]]);
      tl.add(draws, { draw: ['0 0', '0 1'], duration: 1600, delay: A.stagger(STG) }, 0)
        .add(pen, Object.assign({ duration: 1600 }, A.createMotionPath(ref[0])), 0);
      let at = 1600 + spread + 700;
      for (let k = 1; k < 4; k++) { tl.add(lines, { d: A.morphTo(ref[k], 0), duration: MS, delay: A.stagger(STG) }, at); phases.push([at, 'morph', k]); at += MS + spread + 900; }
      tl.add(draws, { draw: ['0 1', '1 1'], duration: 1300, delay: A.stagger(STG) }, at)
        .add(pen, Object.assign({ duration: 1300 }, A.createMotionPath(ref[3])), at);
      phases.push([at, 'erase', 3]);
      const penOn = [[0, 1600], [at, at + 1300]], LOOP = at + 1300 + spread + 600;
      // morphTo writes the previous drawing into d while the timeline is built, so start from the first drawing again
      const restart = () => lines.forEach(l => l.setAttribute('d', D[0]));
      restart();
      let shown = -1, last = -1;
      return t => {
        const ms = (t * 1000) % LOOP;
        if (ms < last) restart();
        last = ms;
        tl.seek(ms);
        let ph = 0; while (ph < phases.length - 1 && ms >= phases[ph + 1][0]) ph++;
        const op = Math.max(...penOn.map(([a, b]) => clamp01(Math.min((ms - a) / 120, (b - ms) / 160))));
        pen.style.opacity = op.toFixed(3);
        if (ph !== shown) {
          shown = ph; const [, kind, k] = phases[ph];
          code.innerHTML = kind === 'draw' ? `<b>animate</b>(createDrawable(lines), { draw: ['0 0', '0 1'], delay: stagger(${STG}) })\n<b>animate</b>(pen, { ...createMotionPath(pulse) })`
            : kind === 'morph' ? `<b>animate</b>(lines, { d: morphTo(${NAMES[k]}), duration: ${MS}, delay: stagger(${STG}) })`
              : `<b>animate</b>(createDrawable(lines), { draw: ['0 1', '1 1'], delay: stagger(${STG}) })\n<b>animate</b>(pen, { ...createMotionPath(skyline) })`;
          name.innerHTML = `${NAMES[k]}<span>${String(k + 1).padStart(2, '0')} / 04</span>`;
        }
        const since = ms - phases[ph][0];
        name.style.opacity = (phases[ph][1] === 'erase' ? 1 - clamp01(since / 900) : clamp01(since / 400)).toFixed(3);
      };
    },
  });





  // ---------------------------------------------------------------- D3 hierarchy
  const DISK = [['Photos', C.coral, ['2024', '2025', 'Edits', 'Screens', 'Raw']], ['Video', C.amber, ['Trips', 'Clips', 'Exports', 'Drafts']], ['Apps', C.cyan, ['Editor', 'Browser', 'Games', 'Tools', 'Chat', 'Maps']],
    ['Music', C.violet, ['Albums', 'Stems', 'Podcasts']], ['Docs', C.green, ['Work', 'Taxes', 'Notes', 'Books']], ['System', '#8a8794', ['Cache', 'Logs', 'Updates']]];

  EX.add({
    cat: 'libs', id: 'l2-d3-treemap', title: 'Treemap that retiles', aka: 'treemap, disk usage map, nested rectangles, squarified treemap', runs: 'CPU',
    tool: 'D3 (d3.hierarchy, sum, sort, d3.treemap with treemapSquarify, Binary, Slice, Dice, SliceDice)',
    notice: 'A disk-usage tree laid out by d3.treemap: every rectangle\'s area is its size. Each step swaps the tiling method (squarify keeps boxes close to square, binary splits by weight, slice and dice cut strips, sliceDice alternates by depth) and sometimes the data too. Every file box moves from its old rectangle to its new one, so you can follow it through each layout.',
    use: 'storage and budget breakdowns, market maps, portfolio views, dashboards',
    prompt: 'Using D3 on a canvas, lay out a two-level disk-usage tree (6 folders, about 25 files) with d3.hierarchy, sum and sort, then d3.treemap with paddingInner {pad} and paddingTop for folder labels. Every {every} s switch the tile method (treemapSquarify, treemapBinary, treemapSlice, treemapDice, treemapSliceDice) and every second step change the sizes, then morph each file\'s rectangle from its old x0, y0, x1, y1 to the new one over 1.1 s with cubic easing. Color by folder, shade files, and label boxes that are big enough.',
    params: [
      { key: 'every', label: 'Switch every', min: 1.5, max: 6, step: 0.5, value: 3, unit: '' },
      { key: 'pad', label: 'Padding', min: 0, max: 6, step: 0.5, value: 2, unit: '' },
    ],
    setup(cv, L) {
      const d3 = W.d3; if (!d3 || !d3.treemap) return missing(cv, 'D3');
      const g = cv.getContext('2d'), X0 = 16, Y0 = 44, WD = 608, HT = 300;
      const TILES = [['treemapSquarify', 'squarify'], ['treemapBinary', 'binary'], ['treemapSliceDice', 'sliceDice'], ['treemapSlice', 'slice'], ['treemapSquarify', 'squarify'], ['treemapDice', 'dice']];
      const tree = k => {
        const r = EX.rng(Math.floor(k / 2) * 31 + 5);
        return { name: 'disk', children: DISK.map(([name, col, files]) => ({ name, col, children: files.map(f => ({ name: f, value: Math.round(4 + Math.pow(r(), 1.6) * 60) })) })) };
      };
      const cache = new Map();
      // Rectangles by id ('folder/file' and 'folder') for step k.
      const layout = (k, pad) => {
        const key = k + '|' + pad; if (cache.has(key)) return cache.get(key); if (cache.size > 12) cache.clear();
        const [fn] = TILES[k % TILES.length], root = d3.hierarchy(tree(k)).sum(d => d.value || 0).sort((a, b) => b.value - a.value);
        d3.treemap().tile(d3[fn]).size([WD, HT]).paddingInner(pad).paddingOuter(2).paddingTop(18).round(false)(root);
        const out = new Map(); root.descendants().forEach(d => { if (d.depth) out.set(d.depth === 1 ? d.data.name : d.parent.data.name + '/' + d.data.name, { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1, v: d.value, d: d.depth, col: d.depth === 1 ? d.data.col : d.parent.data.col, name: d.data.name, i: d.parent.children.indexOf(d) }); });
        cache.set(key, out); return out;
      };
      const total = k => [...layout(k, 2).values()].filter(o => o.d === 1).reduce((a, o) => a + o.v, 0);
      return t => {
        const p = Object.assign({ every: 3, pad: 2 }, L.p), step = Math.floor(t / p.every), lt = t - step * p.every;
        const A = layout(Math.max(0, step - 1), p.pad), B = layout(step, p.pad), e = step === 0 ? 1 : ease.inOut(clamp01(lt / 1.1));
        g.fillStyle = C.bg; g.fillRect(0, 0, 640, 360);
        const box = (o, q) => [lerp(o.x0, q.x0, e) + X0, lerp(o.y0, q.y0, e) + Y0, lerp(o.x1, q.x1, e) + X0, lerp(o.y1, q.y1, e) + Y0];
        g.textBaseline = 'top';
        for (const pass of [1, 2]) for (const [id, q] of B) {
          if (q.d !== pass) continue;
          const o = A.get(id) || q, [x0, y0, x1, y1] = box(o, q), w = x1 - x0, h = y1 - y0; if (w < 1 || h < 1) continue;
          const c = d3.color(q.col);
          if (pass === 1) { g.fillStyle = c.darker(1.6).formatHex(); g.beginPath(); g.roundRect(x0, y0, w, h, 5); g.fill(); if (w > 46) { g.font = `600 11px ${MONO}`; g.fillStyle = q.col; g.save(); g.beginPath(); g.rect(x0, y0, w - 4, 16); g.clip(); g.fillText(q.name.toUpperCase(), x0 + 6, y0 + 4); g.restore(); } continue; }
          g.fillStyle = c.brighter(((q.i % 3) - 1) * 0.35).formatHex(); g.beginPath(); g.roundRect(x0, y0, w, h, 3); g.fill();
          if (w > 44 && h > 30) { g.save(); g.beginPath(); g.rect(x0, y0, w - 3, h); g.clip(); g.fillStyle = '#0b0b10'; g.font = `600 12px ${DISP}`; g.fillText(q.name, x0 + 5, y0 + 5); g.font = `11px ${MONO}`; g.globalAlpha = 0.7; g.fillText(Math.round(lerp(o.v, q.v, e)) + ' GB', x0 + 5, y0 + 20); g.globalAlpha = 1; g.restore(); }
        }
        g.textBaseline = 'alphabetic';
        const [fn, nm] = TILES[step % TILES.length];
        g.font = `600 13px ${MONO}`; g.fillStyle = C.cream; g.fillText('D3', 18, 28); g.fillStyle = C.amber; g.fillText(nm, 44, 28);
        g.font = `12px ${MONO}`; g.fillStyle = '#8a8794'; g.fillText(`d3.treemap().tile(d3.${fn})`, 150, 28);
        g.textAlign = 'right'; g.fillText(`${total(step)} GB used`, 622, 28); g.textAlign = 'left';
      };
    },
  });

  // ---------------------------------------------------------------- D3 shape
  const GENRES = ['Pop', 'Hip-hop', 'Rock', 'Electronic', 'Jazz', 'Classical', 'Latin', 'Indie'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  EX.add({
    cat: 'libs', id: 'l2-d3-stream', title: 'Streamgraph that restacks', aka: 'stacked area chart, streamgraph, 100% stacked chart, ThemeRiver', runs: 'CPU',
    tool: 'D3 (d3.stack with stackOffsetWiggle, Expand, Silhouette and None, d3.area with curveBasis drawn to canvas)',
    notice: 'One year of listening in eight genres, stacked by d3.stack. Every few seconds the same data is restacked with a different offset: a centered streamgraph (wiggle), a silhouette, a 100% chart (expand) and a plain stacked area. Each layer flows from its old shape to its new one, and the labels follow the thickest part of every layer. Point at a layer to read it.',
    use: 'data stories, annual reports, trend dashboards, editorial graphics',
    prompt: 'Using D3 on a canvas, draw a streamgraph of 8 music genres over 52 weeks from smooth random bumps. Build it with d3.stack and draw each layer with d3.area().curve(d3.curveBasis).context(ctx). Every {every} s restack with the next offset (stackOffsetWiggle with stackOrderInsideOut, stackOffsetSilhouette, stackOffsetExpand, stackOffsetNone) and morph every layer to its new shape over {morph} s with cubic easing. Label each layer at its thickest point, add a month axis, highlight the layer under the pointer, and draw new data every full cycle.',
    params: [
      { key: 'every', label: 'Switch every', min: 2, max: 8, step: 0.5, value: 3.5, unit: '' },
      { key: 'morph', label: 'Morph time', min: 0.3, max: 2.5, step: 0.1, value: 1.3, unit: '' },
    ],
    setup(cv, L) {
      const d3 = W.d3; if (!d3 || !d3.stack || !d3.area) return missing(cv, 'D3');
      const g = cv.getContext('2d'), NL = GENRES.length, M = 52, X0 = 40, X1 = 620, TOP = 56, BOT = 318;
      const xs = d3.scaleLinear().domain([0, M - 1]).range([X0, X1]);
      const colors = GENRES.map((_, i) => d3.interpolateRgbBasis([C.coral, C.amber, '#f4d9a6', C.cyan, C.violet])(i / (NL - 1)));
      const MODES = [
        ['stackOffsetWiggle', 'stackOrderInsideOut', 'streamgraph'], ['stackOffsetSilhouette', 'stackOrderInsideOut', 'silhouette'],
        ['stackOffsetExpand', 'stackOrderNone', '100% stacked'], ['stackOffsetNone', 'stackOrderNone', 'stacked area'],
      ];
      // Data set k: smooth random bumps per genre and week.
      const makeData = k => {
        const r = EX.rng(k * 101 + 7), rows = [...Array(M)].map(() => ({}));
        GENRES.forEach(name => {
          const bumps = [...Array(4)].map(() => [r() * 1.2 - 0.1, 6 + r() * 14, 0.3 + r() * 1.2]);
          for (let i = 0; i < M; i++) { let v = 0.08; for (const [c, w, a] of bumps) v += a * Math.exp(-(((i / (M - 1) - c) * w) ** 2) / 2); rows[i][name] = v * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(i / M * 9 + k * 2))); }
        });
        return rows;
      };
      // Pixel arrays Y0/Y1 [layer][week] for data k stacked in mode m, scaled to fill the chart.
      const cache = new Map(), dataOf = k => { const key = 'd' + k; if (!cache.has(key)) cache.set(key, makeData(k)); return cache.get(key); };
      const layout = (k, m) => {
        const key = k + '|' + m; if (cache.has(key)) return cache.get(key);
        if (cache.size > 16) cache.clear();
        const [off, ord] = MODES[m], series = d3.stack().keys(GENRES).offset(d3[off]).order(d3[ord])(dataOf(k));
        const lo = d3.min(series, s => d3.min(s, d => d[0])), hi = d3.max(series, s => d3.max(s, d => d[1]));
        const ys = d3.scaleLinear().domain([lo, hi]).range([BOT, TOP]);
        const out = { Y0: [], Y1: [] };
        series.forEach(s => { out.Y0[s.index] = Float32Array.from(s, d => ys(d[0])); out.Y1[s.index] = Float32Array.from(s, d => ys(d[1])); });
        cache.set(key, out); return out;
      };
      const Y0 = GENRES.map(() => new Float32Array(M)), Y1 = GENRES.map(() => new Float32Array(M)), idx = d3.range(M);
      let cur = 0;
      const area = d3.area().x(i => xs(i)).y0(i => Y0[cur][i]).y1(i => Y1[cur][i]).curve(d3.curveBasis).context(g);
      const ptr = { x: -1, y: -1 };
      cv.onpointermove = e => { const [x, y] = at(cv, e); ptr.x = x; ptr.y = y; };
      cv.onpointerleave = () => { ptr.x = -1; };
      return t => {
        const p = Object.assign({ every: 3.5, morph: 1.3 }, L.p), step = Math.floor(t / p.every), lt = t - step * p.every;
        const kOf = s => Math.floor(s / MODES.length), a = layout(kOf(Math.max(0, step - 1)), (Math.max(0, step - 1)) % 4), b = layout(kOf(step), step % 4);
        const e = step === 0 ? 1 : ease.inOut(clamp01(lt / p.morph));
        for (let l = 0; l < NL; l++) for (let i = 0; i < M; i++) { Y0[l][i] = lerp(a.Y0[l][i], b.Y0[l][i], e); Y1[l][i] = lerp(a.Y1[l][i], b.Y1[l][i], e); }
        // which layer is under the pointer
        let hot = -1;
        if (ptr.x >= X0 && ptr.x <= X1) { const wi = Math.round(xs.invert(ptr.x)); for (let l = 0; l < NL; l++) if (ptr.y <= Y0[l][wi] && ptr.y >= Y1[l][wi]) hot = l; }
        g.fillStyle = C.bg; g.fillRect(0, 0, 640, 360);
        g.strokeStyle = '#1c1c28'; g.lineWidth = 1; g.beginPath();
        for (let mo = 0; mo <= 12; mo++) { const x = Math.round(X0 + (X1 - X0) * mo / 12) + 0.5; g.moveTo(x, TOP - 8); g.lineTo(x, BOT + 4); } g.stroke();
        for (let l = 0; l < NL; l++) {
          cur = l; g.globalAlpha = hot < 0 || hot === l ? 1 : 0.35;
          g.beginPath(); area(idx); g.fillStyle = colors[l]; g.fill(); g.strokeStyle = C.bg; g.lineWidth = 1; g.stroke();
        }
        g.globalAlpha = 1;
        // labels at the thickest week of each layer
        g.textAlign = 'center'; g.font = `600 12px ${DISP}`;
        for (let l = 0; l < NL; l++) {
          let best = 0, bi = 0; for (let i = 3; i < M - 3; i++) { const th = Y0[l][i] - Y1[l][i]; if (th > best) { best = th; bi = i; } }
          if (best < 16) continue;
          g.globalAlpha = clamp01((best - 16) / 10) * (hot < 0 || hot === l ? 1 : 0.4); g.fillStyle = '#0b0b10'; g.fillText(GENRES[l], xs(bi), (Y0[l][bi] + Y1[l][bi]) / 2 + 4);
        }
        g.globalAlpha = 1;
        g.font = `11px ${MONO}`; g.fillStyle = '#6f6c80'; MONTHS.forEach((m, mo) => g.fillText(m, X0 + (X1 - X0) * (mo + 0.5) / 12, BOT + 22));
        g.textAlign = 'left';
        const [off, ord, nm] = MODES[step % 4];
        g.font = `600 13px ${MONO}`; g.fillStyle = C.cream; g.fillText('D3', 18, 26); g.fillStyle = C.amber; g.fillText(nm, 44, 26);
        g.font = `12px ${MONO}`; g.fillStyle = '#8a8794'; g.fillText(`d3.stack().offset(d3.${off}).order(d3.${ord})`, 18, 44);
        if (hot >= 0) {
          const wi = Math.round(xs.invert(ptr.x)), raw = dataOf(kOf(step))[wi][GENRES[hot]];
          g.strokeStyle = 'rgba(244,239,230,0.6)'; g.beginPath(); g.moveTo(ptr.x + 0.5, TOP - 8); g.lineTo(ptr.x + 0.5, BOT + 4); g.stroke();
          g.fillStyle = C.cream; g.font = `600 12px ${MONO}`; g.textAlign = ptr.x > 480 ? 'right' : 'left';
          g.fillText(`${GENRES[hot]}  week ${wi + 1}  ${(raw * 1000).toFixed(0)}k plays`, ptr.x + (ptr.x > 480 ? -8 : 8), Math.max(TOP + 4, ptr.y - 10)); g.textAlign = 'left';
        }
      };
    },
  });

  // ---------------------------------------------------------------- Rough.js
  // Smooth closed or open polyline through points (Catmull-Rom), sampled k times per segment.
  function smoothPts(pts, k, closed) {
    const out = [], n = pts.length, P = i => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < (closed ? n : n - 1); i++) for (let s = 0; s < k; s++) {
      const u = s / k, p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map(d => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3)));
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }

  EX.add({
    cat: 'libs', id: 'l2-rough-map', title: 'Hand-drawn treasure map', aka: 'sketchy map, pirate map, route animation, illustrated map', runs: 'CPU',
    tool: 'Rough.js (generator.path with SVG path data, polygon, ellipse, curve, fillStyle hachure, zigzag, cross-hatch, solid)',
    notice: 'The island is an SVG path string handed to Rough.js, which turns it into a wobbly ink outline with hachure shading. Mountains use zigzag fill, the woods cross-hatch, the lake solid fill. The pieces stamp onto the parchment one after another, then a dashed route walks from the ship to an X. The seed changes a few times a second, so the ink lines boil gently.',
    use: 'game and story intros, travel blogs, event maps, explainer videos',
    prompt: 'Using Rough.js on a parchment canvas, draw a treasure map: an island from an SVG path (rough generator.path, hachure fill, roughness {rough}), offset coastline ripples, zigzag-filled mountains, cross-hatched woods, a solid lake, a ship, sea waves and a compass rose, with Segoe Print labels. Stamp each piece in with a small overshoot, one after another, then animate a dashed route from the ship across the island to an X that is crossed out and circled. Change the seed {boil} times per second for a gentle line boil and loop every 12 s.',
    params: [
      { key: 'rough', label: 'Roughness', min: 0.2, max: 3, step: 0.1, value: 1.3 },
      { key: 'boil', label: 'Boil fps', min: 0, max: 10, step: 1, value: 3, unit: '' },
    ],
    setup(cv, L) {
      const rough = W.rough; if (!rough) return missing(cv, 'Rough.js');
      const g = cv.getContext('2d'), rc = rough.canvas(cv), gen = rc.generator, INK = '#3b2a1e', R = EX.rng(9), LOOP = 12;
      const HAND = '"Segoe Print", "Comic Sans MS", cursive';
      // parchment, drawn once
      const bg = document.createElement('canvas'); bg.width = 640; bg.height = 360;
      {
        const b = bg.getContext('2d'), gr = b.createRadialGradient(320, 180, 60, 320, 180, 380); gr.addColorStop(0, '#f1e3c2'); gr.addColorStop(1, '#c9a873');
        b.fillStyle = gr; b.fillRect(0, 0, 640, 360);
        for (let i = 0; i < 2600; i++) { b.fillStyle = `rgba(${R() < 0.5 ? '120,80,40' : '255,250,235'},${R() * 0.08})`; b.fillRect(R() * 640, R() * 360, 1 + R() * 2, 1 + R() * 2); }
        b.strokeStyle = 'rgba(90,60,30,0.35)'; b.lineWidth = 2; b.strokeRect(10, 10, 620, 340); b.lineWidth = 0.8; b.strokeRect(16, 16, 608, 328);
      }
      const CX = 330, CY = 186, island = [];
      for (let i = 0; i < 44; i++) { const a = i / 44 * Math.PI * 2, n = EX.noise(Math.cos(a) * 1.4 + 5, Math.sin(a) * 1.4 + 2); island.push([CX + Math.cos(a) * 178 * (0.72 + n * 0.5), CY + Math.sin(a) * 104 * (0.72 + n * 0.5)]); }
      const toPath = (pts, s) => 'M' + smoothPts(pts, 3, true).map(([x, y]) => `${(CX + (x - CX) * s).toFixed(1)} ${(CY + (y - CY) * s).toFixed(1)}`).join(' L') + ' Z';
      const route = smoothPts([[112, 262], [150, 252], [190, 236], [236, 208], [262, 176], [300, 168], [322, 204], [352, 232], [400, 244], [432, 236], [452, 222]], 14, false);
      const rlen = [0]; for (let i = 1; i < route.length; i++) rlen.push(rlen[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
      const waves = []; for (let k = 0; k < 400 && waves.length < 16; k++) { const x = 40 + R() * 560, y = 36 + R() * 290, d = Math.hypot((x - CX) / 190, (y - CY) / 118); if (d > 1.25 && !(x > 500 && y > 250) && !(x < 250 && y < 92)) waves.push([x, y]); }
      const star = []; for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + i * Math.PI / 8, r = i % 4 === 0 ? 34 : i % 2 ? 9 : 20; star.push([566 + Math.cos(a) * r, 292 + Math.sin(a) * r]); }
      // Each element: center for the stamp, start time, and a maker that returns rough drawables for options o.
      const E = [
        { c: [CX, CY], t: 0.1, mk: o => [1.16, 1.08].map(s => gen.path(toPath(island, s), Object.assign({}, o, { stroke: 'rgba(59,42,30,0.35)', strokeWidth: 1 }))) },
        { c: [CX, CY], t: 0.3, mk: o => [gen.path(toPath(island, 1), Object.assign({}, o, { fill: '#d9b46e', fillStyle: 'hachure', hachureAngle: -41, hachureGap: 6, fillWeight: 1.2 }))] },
        { c: [300, 232], t: 0.7, mk: o => [gen.ellipse(300, 232, 58, 26, Object.assign({}, o, { fill: '#86aab4', fillStyle: 'solid' }))] },
        { c: [244, 196], t: 0.9, mk: o => [[232, 188], [252, 182], [268, 196], [244, 204], [224, 202], [258, 212], [212, 214]].map(([x, y], i) => gen.circle(x, y, 17 + (i % 3) * 3, Object.assign({}, o, { fill: '#6f8a4e', fillStyle: 'cross-hatch', hachureGap: 4 }))) },
        { c: [400, 150], t: 1.1, mk: o => [[372, 168, 30], [404, 156, 40], [438, 170, 28]].map(([x, y, h]) => gen.polygon([[x - h * 0.8, y + 16], [x, y - h + 16], [x + h * 0.8, y + 16]], Object.assign({}, o, { fill: '#8d6b48', fillStyle: 'zigzag', hachureGap: 4 }))) },
        { c: [100, 250], t: 1.4, mk: o => [gen.polygon([[74, 252], [126, 252], [118, 266], [82, 266]], Object.assign({}, o, { fill: '#7a4b2b', fillStyle: 'solid' })), gen.line(100, 252, 100, 214, o), gen.polygon([[102, 216], [124, 240], [102, 244]], Object.assign({}, o, { fill: '#f6ecd6', fillStyle: 'solid' }))] },
        { c: [566, 292], t: 1.6, mk: o => [gen.circle(566, 292, 62, o), gen.polygon(star, Object.assign({}, o, { fill: '#a8321e', fillStyle: 'hachure', hachureGap: 3 }))] },
        { c: [320, 300], t: 1.8, mk: o => waves.map(([x, y]) => gen.curve([[x - 12, y], [x - 6, y - 4], [x, y], [x + 6, y - 4], [x + 12, y]], Object.assign({}, o, { stroke: 'rgba(59,42,30,0.6)', strokeWidth: 1.2 }))) },
      ];
      const X = { t: 8.4, mk: o => [gen.line(440, 210, 464, 232, Object.assign({}, o, { stroke: '#a8321e', strokeWidth: 3.5 })), gen.line(464, 210, 440, 232, Object.assign({}, o, { stroke: '#a8321e', strokeWidth: 3.5 }))] };
      const RING = { t: 8.9, mk: o => [gen.ellipse(452, 221, 56, 44, Object.assign({}, o, { stroke: '#a8321e', strokeWidth: 1.6 }))] };
      const LABELS = /** @type {[string, number, number, number][]} */ ([['Misty Woods', 196, 160, 1.3], ['Dragon Peaks', 404, 112, 1.5], ['Still Lake', 300, 268, 1.2], ['N', 566, 252, 1.9]]);
      const cache = new Map();
      const draws = (key, el, seed, p) => {
        const k = key + '|' + seed + '|' + p.rough; let d = cache.get(k);
        if (!d) { if (cache.size > 400) cache.clear(); d = el.mk({ seed, roughness: p.rough, stroke: INK, strokeWidth: 1.6, bowing: 1.2 }); cache.set(k, d); }
        d.forEach(x => rc.draw(x));
      };
      return t => {
        const p = Object.assign({ rough: 1.3, boil: 3 }, L.p), lt = t % LOOP, seed = p.boil > 0 ? 1 + (Math.floor(t * p.boil) % 5) : 1;
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.drawImage(bg, 0, 0);
        // stamp-in: small overshoot scale and fade per element
        const stamp = (c, t0, fn) => { const k = clamp01((lt - t0) / 0.4); if (k <= 0) return; const s = 1 + (1 - ease.back(k)) * 0.12; g.globalAlpha = Math.min(1, k * 2); g.setTransform(s, 0, 0, s, c[0] * (1 - s), c[1] * (1 - s)); fn(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; };
        E.forEach((el, i) => stamp(el.c, el.t, () => draws('e' + i, el, seed * 7 + i, p)));
        g.textAlign = 'center';
        LABELS.forEach(([s, x, y, t0], i) => stamp([x, y], t0 + 0.6, () => { g.font = `${i === 3 ? 700 : 400} ${i === 3 ? 15 : 14}px ${HAND}`; g.fillStyle = INK; g.fillText(s, x, y); }));
        stamp([110, 46], 2.2, () => { g.font = `700 26px ${HAND}`; g.fillStyle = INK; g.textAlign = 'left'; g.fillText('Isla Rough', 36, 54); g.fillStyle = 'rgba(59,42,30,0.7)'; g.font = `12px ${HAND}`; g.fillText('drawn by Rough.js', 40, 74); });
        g.textAlign = 'left';
        // route: dashed ink line growing from the ship to the X, with a walker at the head
        const k = ease.inOut(clamp01((lt - 2.8) / 5.4)), upto = k * rlen[rlen.length - 1];
        if (k > 0) {
          g.strokeStyle = '#a8321e'; g.lineWidth = 2.6; g.lineCap = 'round'; g.setLineDash([7, 7]); g.beginPath(); g.moveTo(route[0][0], route[0][1]);
          let hx = route[0][0], hy = route[0][1];
          for (let i = 1; i < route.length; i++) {
            if (rlen[i] > upto) { const f = (upto - rlen[i - 1]) / (rlen[i] - rlen[i - 1]); hx = lerp(route[i - 1][0], route[i][0], f); hy = lerp(route[i - 1][1], route[i][1], f); g.lineTo(hx, hy); break; }
            hx = route[i][0]; hy = route[i][1]; g.lineTo(hx, hy);
          }
          g.stroke(); g.setLineDash([]);
          if (k < 1) { g.fillStyle = '#a8321e'; g.beginPath(); g.arc(hx, hy, 4.5, 0, 7); g.fill(); g.strokeStyle = 'rgba(168,50,30,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(hx, hy, 8 + Math.sin(t * 8) * 1.5, 0, 7); g.stroke(); }
        }
        stamp([452, 221], X.t, () => draws('x', X, seed * 7 + 40, p));
        stamp([452, 221], RING.t, () => draws('r', RING, seed * 7 + 41, p));
        stamp([452, 276], 9.3, () => { g.font = `700 15px ${HAND}`; g.fillStyle = '#a8321e'; g.textAlign = 'center'; g.fillText('X marks the spot', 452, 278); g.textAlign = 'left'; });
        if (lt > LOOP - 0.6) { g.fillStyle = `rgba(232,214,176,${clamp01((lt - LOOP + 0.6) / 0.5)})`; g.fillRect(0, 0, 640, 360); }
      };
    },
  });





  // ---------------------------------------------------------------- Motion
  EX.add({
    cat: 'libs', id: 'l2-motion-picker', kind: 'dom', title: 'Momentum time picker', aka: 'wheel picker, drum picker, flick scrolling, momentum with snap, iOS picker', runs: 'WEB',
    tool: 'Motion (inertia generator with modifyTarget, min and max bounce, sampled with next(t))',
    notice: 'Three wheels in CSS 3D, each item on a cylinder. A flick starts a Motion inertia generator: it glides, slows down exponentially, and modifyTarget rounds the resting point to a whole item, so every flick lands exactly on a row. The AM/PM wheel has min and max, so a hard flick runs past the end and springs back. The graph plots the last flick. Drag a wheel and let go.',
    use: 'date and time inputs, carousels, wheel menus, any flick-to-scroll list',
    prompt: 'Using Motion (motion.dev), build an iOS-style time picker with hour, minute and AM/PM wheels in CSS 3D (items on a cylinder with rotateX and translateZ, fading toward the edges). Every {every} s flick one wheel: create Motion.inertia({ keyframes: [value], velocity, power: {power}, timeConstant: {tc}, modifyTarget: Math.round }), with min and max on the AM/PM wheel so it bounces, and sample it each frame with next(ms). Let me drag and throw any wheel, show the resulting time, and plot the last flick against its snapped target.',
    params: [
      { key: 'power', label: 'Power', min: 0.2, max: 1.4, step: 0.05, value: 0.8 },
      { key: 'tc', label: 'Time constant', min: 100, max: 900, step: 25, value: 325, unit: ' ms' },
      { key: 'every', label: 'Flick every', min: 1, max: 6, step: 0.2, value: 2.4, unit: '' },
    ],
    setup(st, L) {
      const Mo = W.Motion; if (!Mo || !Mo.inertia) return missing(st, 'Motion');
      const IH = 36, STEP = 20, RZ = IH / 2 / Math.tan(STEP / 2 * RAD);
      st.innerHTML = `<style>.mp{position:absolute;inset:0;background:radial-gradient(90% 120% at 50% 0%,#20203a 0%,#0b0b10 70%);font-family:${DISP};color:${C.cream}}
        .mp-panel{position:absolute;left:206px;top:84px;width:300px;height:216px;border-radius:22px;background:#15151f;box-shadow:0 18px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.06);overflow:hidden}
        .mp-band{position:absolute;left:10px;right:10px;top:${108 - IH / 2}px;height:${IH}px;border-radius:9px;background:#262636}
        .mp-w{position:absolute;top:0;height:216px;perspective:520px;cursor:grab;touch-action:none}
        .mp-i{position:absolute;left:0;right:0;top:${108 - IH / 2}px;height:${IH}px;line-height:${IH}px;text-align:center;font:600 24px ${DISP};backface-visibility:hidden;will-change:transform}
        .mp-fade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(#15151f 0%,rgba(21,21,31,0) 38%,rgba(21,21,31,0) 62%,#15151f 100%)}
        .mp-time{position:absolute;left:206px;width:300px;top:26px;text-align:center;font:700 34px ${DISP};letter-spacing:1px}
        .mp-time span{color:${C.amber}}
        .mp-g{position:absolute;left:20px;top:96px;width:160px!important;height:150px!important}
        .mp-gl{position:absolute;left:20px;top:78px;font:12px ${MONO};color:#8a8794}
        .mp-code{position:absolute;left:0;right:0;bottom:12px;text-align:center;font:12px/17px ${MONO};color:#8a8794;white-space:pre}
        .mp-code b{color:${C.amber};font-weight:600}</style>
        <div class="mp"><div class="mp-time"></div><div class="mp-gl">last flick</div><canvas class="mp-g" width="160" height="150"></canvas>
        <div class="mp-panel"><div class="mp-band"></div></div><div class="mp-code"></div></div>`;
      const panel = /** @type {HTMLElement} */ (st.querySelector('.mp-panel')), timeEl = /** @type {HTMLElement} */ (st.querySelector('.mp-time')), code = /** @type {HTMLElement} */ (st.querySelector('.mp-code'));
      const gcv = /** @type {HTMLCanvasElement} */ (st.querySelector('.mp-g')), gg = gcv.getContext('2d');
      const pad = n => String(n).padStart(2, '0');
      const wheels = [
        { items: [...Array(12)].map((_, i) => String(i + 1)), loop: true, x: 26, w: 92, v: 6 },
        { items: [...Array(60)].map((_, i) => pad(i)), loop: true, x: 118, w: 92, v: 41 },
        { items: ['AM', 'PM'], loop: false, x: 210, w: 70, v: 1 },
      ].map(o => {
        const el = document.createElement('div'); el.className = 'mp-w'; el.style.left = o.x + 'px'; el.style.width = o.w + 'px'; panel.appendChild(el);
        const pool = [...Array(11)].map(() => { const d = document.createElement('div'); d.className = 'mp-i'; el.appendChild(d); return d; });
        return Object.assign(o, { el, pool, gen: null, t0: 0, drag: false, ly: 0, lt: 0, vel: 0 });
      });
      panel.appendChild(Object.assign(document.createElement('div'), { className: 'mp-fade' }));
      const last = { pts: /** @type {number[]} */ ([]), from: 0, to: 0, t0: 0, vel: 0, label: '' };
      let now = 0;
      // Starts a Motion inertia generator on wheel w with velocity in items per second.
      const flick = (w, vel, p) => {
        const opt = Object.assign({ keyframes: [w.v], velocity: vel, power: p.power, timeConstant: p.tc, modifyTarget: Math.round, restDelta: 0.002 }, w.loop ? {} : { min: 0, max: w.items.length - 1, bounceStiffness: 260, bounceDamping: 16 });
        w.gen = Mo.inertia(opt); w.t0 = now;
        const probe = Mo.inertia(opt); last.pts = []; for (let k = 0; k <= 60; k++) last.pts.push(probe.next(k * 40).value);
        last.from = w.v; last.to = last.pts[60]; last.t0 = now; last.vel = vel; const n = w.items.length; last.label = w.items[((Math.round(last.to) % n) + n) % n];
        code.innerHTML = `Motion.inertia({ keyframes: [value], velocity: <b>${vel.toFixed(1)}</b>, power: <b>${p.power}</b>,
 timeConstant: <b>${p.tc}</b>, modifyTarget: Math.round${w.loop ? '' : ', min: 0, max: 1'} }).next(ms)`;
      };
      // Drag deltas are in screen px; 640 / shown width turns them into stage px while --k scales the stage down.
      wheels.forEach(w => {
        w.el.onpointerdown = e => { w.drag = true; w.gen = null; w.ly = e.clientY; w.lt = performance.now(); w.vel = 0; w.el.setPointerCapture(e.pointerId); w.el.style.cursor = 'grabbing'; };
        w.el.onpointermove = e => { if (!w.drag) return; const dy = (e.clientY - w.ly) * 640 / st.getBoundingClientRect().width, tn = performance.now(), dtm = Math.max(1, tn - w.lt); w.v -= dy / IH; w.vel = -dy / IH / dtm * 1000; w.ly = e.clientY; w.lt = tn; };
        w.el.onpointerup = w.el.onpointercancel = () => { if (!w.drag) return; w.drag = false; w.el.style.cursor = 'grab'; flick(w, w.vel, Object.assign({ power: 0.8, tc: 325 }, L.p)); };
      });
      let fl = -1;
      return t => {
        now = t;
        const p = Object.assign({ power: 0.8, tc: 325, every: 2.4 }, L.p), f = Math.floor(t / p.every);
        if (f !== fl && t > 0.5) {
          fl = f; const r = EX.rng(f * 61 + 9), wi = [1, 0, 2, 1][f % 4], w = wheels[wi];
          if (!w.drag) flick(w, wi === 2 ? (w.v > 0.5 ? -1 : 1) * (5 + r() * 3) : (r() < 0.5 ? -1 : 1) * (8 + r() * 26), p);
        }
        for (const w of wheels) {
          if (w.gen && !w.drag) { const s = w.gen.next((t - w.t0) * 1000); w.v = s.value; if (s.done) w.gen = null; }
          const n = w.items.length, base = Math.round(w.v);
          w.pool.forEach((d, j) => {
            const k = base + j - 5, ang = (k - w.v) * STEP, ok = (w.loop || (k >= 0 && k < n)) && Math.abs(ang) < 85;
            d.style.visibility = ok ? 'visible' : 'hidden'; if (!ok) return;
            d.textContent = w.items[((k % n) + n) % n];
            d.style.transform = `rotateX(${(-ang).toFixed(2)}deg) translateZ(${RZ.toFixed(1)}px)`;
            d.style.opacity = (0.25 + 0.75 * Math.cos(ang * RAD)).toFixed(3);
            d.style.color = Math.abs(k - w.v) < 0.5 ? C.cream : '#8a8794';
          });
        }
        const it = w => w.items[((Math.round(w.v) % w.items.length) + w.items.length) % w.items.length];
        timeEl.innerHTML = `${pad(it(wheels[0]))}:${it(wheels[1])} <span>${it(wheels[2])}</span>`;
        // graph of the last flick: value over 2.4 s, snapped target dashed, a dot for now
        gg.clearRect(0, 0, 160, 150); gg.fillStyle = '#15151f'; gg.beginPath(); gg.roundRect(0, 0, 160, 150, 10); gg.fill();
        if (last.pts.length) {
          const lo = Math.min(...last.pts, last.from) - 0.5, hi = Math.max(...last.pts, last.from) + 0.5, Y = v => 136 - (v - lo) / (hi - lo) * 122;
          gg.setLineDash([4, 4]); gg.strokeStyle = '#4a4a62'; gg.beginPath(); gg.moveTo(8, Y(last.to)); gg.lineTo(152, Y(last.to)); gg.stroke(); gg.setLineDash([]);
          gg.strokeStyle = C.coral; gg.lineWidth = 2; gg.beginPath(); last.pts.forEach((v, k) => { const x = 8 + k / 60 * 144; k ? gg.lineTo(x, Y(v)) : gg.moveTo(x, Y(v)); }); gg.stroke();
          const kk = Math.min(60, (t - last.t0) * 1000 / 40), vi = last.pts[Math.floor(kk)];
          gg.fillStyle = C.cream; gg.beginPath(); gg.arc(8 + kk / 60 * 144, Y(vi), 3.5, 0, 7); gg.fill();
          gg.fillStyle = '#8a8794'; gg.font = `11px ${MONO}`; gg.fillText('lands on ' + last.label, 10, Y(last.to) - 5 < 14 ? Y(last.to) + 14 : Y(last.to) - 5);
        }
      };
    },
  });

  // ---------------------------------------------------------------- Lottie
  // Walk cycle angles in degrees for phase f (0..1 per stride) and amplitude A; also used by the rig overlay.
  const walkPose = (f, A) => {
    const ph = f * Math.PI * 2, leg = s => -A * Math.sin(ph + s), knee = s => 8 + 46 * Math.pow(Math.max(0, Math.cos(ph + s)), 1.5);
    return {
      hipsY: -6 * Math.cos(ph) ** 2, torso: 4 + 2 * Math.sin(2 * ph), head: -3 - 2 * Math.sin(2 * ph + 0.6), antenna: 12 * Math.sin(2 * ph - 1.2),
      thighN: leg(0), shinN: knee(0), thighF: leg(Math.PI), shinF: knee(Math.PI),
      armN: A * 0.85 * Math.sin(ph), foreN: -(22 + 10 * Math.sin(ph)), armF: A * 0.85 * Math.sin(ph + Math.PI), foreF: -(22 + 10 * Math.sin(ph + Math.PI)),
    };
  };
  // Builds a 96-frame, 30 fps Lottie file: a robot rig of parented shape layers walking three strides, with a blink.
  function walkLottie(A) {
    const FR = 96, STRIDE = 32, sv = k => ({ a: 0, k }), hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255, 1];
    const kf = fn => ({ a: 1, k: [...Array(FR / 2 + 1)].map((_, i) => { const t = i * 2, v = fn(t), o = /** @type {any} */ ({ t, s: Array.isArray(v) ? v : [v] }); if (t < FR) { o.o = { x: [0], y: [0] }; o.i = { x: [1], y: [1] }; } return o; }) });
    const pose = t => walkPose((t % STRIDE) / STRIDE, A);
    const tr = (o = /** @type {any} */ ({})) => ({ ty: 'tr', p: o.p || sv([0, 0]), a: o.a || sv([0, 0]), s: o.s || sv([100, 100]), r: sv(0), o: sv(100), sk: sv(0), sa: sv(0) });
    const fl = c => ({ ty: 'fl', c: sv(hex(c)), o: sv(100), r: 1 });
    const rc = (x, y, w, h, r, c) => ({ ty: 'gr', it: [{ ty: 'rc', d: 1, p: sv([x, y]), s: sv([w, h]), r: sv(r) }, fl(c), tr()] });
    const el = (x, y, w, h, c, o) => ({ ty: 'gr', it: [{ ty: 'el', d: 1, p: sv([x, y]), s: sv([w, h]) }, fl(c), tr(o)] });
    let ind = 0;
    const layer = (nm, shapes, ks, parent) => Object.assign({ ddd: 0, ind: ++ind, ty: 4, nm, sr: 1, ks: Object.assign({ o: sv(100), r: sv(0), p: sv([0, 0, 0]), a: sv([0, 0, 0]), s: sv([100, 100, 100]) }, ks), ao: 0, shapes, ip: 0, op: FR, st: 0, bm: 0 }, parent ? { parent } : {});
    // ground and shadow (comp space), then the rig; lottie draws the first layer on top, so the list is reversed at the end
    // the ground moves one foot travel per step (two steps per stride), with dashes spaced so 96 frames loop
    const v = 4 * 88 * Math.sin(A * RAD), gap = v / 3, nd = Math.ceil((640 + 3 * v) / gap) + 2;
    const dashes = [...Array(nd)].map((_, k) => rc(k * gap, 0, Math.min(24, gap * 0.45), 3, 1.5, '#3a3a56'));
    const layers = [layer('ground', dashes, { p: kf(t => [-t / STRIDE * v, 316, 0]) })];
    layers.push(layer('shadow', [el(0, 0, 96, 12, '#07070d')], { p: sv([300, 318, 0]), s: kf(t => [100 + pose(t).hipsY * 2.5, 100, 100]) }));
    const hips = layer('hips', [rc(0, 0, 34, 16, 6, '#1a1a22')], { p: kf(t => [300, 210 + pose(t).hipsY, 0]) }); hips.ind = 50;
    const limb = (nm, parent, p, len, w, c, rk, extra) => layer(nm, [rc(0, len / 2, w, len + w * 0.4, w / 2, c), ...(extra || [])], { p: sv([...p, 0]), r: kf(t => pose(t)[rk]) }, parent);
    const far = (c) => c === '#c9c4d8' ? '#77728a' : c;
    // far side (behind torso)
    const thighF = limb('thigh far', 50, [0, 4], 44, 18, far('#c9c4d8'), 'thighF'); thighF.ind = 51;
    const shinF = limb('shin far', 51, [0, 44], 44, 16, far('#c9c4d8'), 'shinF', [rc(9, 46, 32, 12, 5, '#1a1a22')]); shinF.ind = 52;
    const armF = limb('arm far', 60, [6, -56], 38, 14, far('#c9c4d8'), 'armF'); armF.ind = 53;
    const foreF = limb('forearm far', 53, [0, 36], 34, 13, far('#c9c4d8'), 'foreF', [el(0, 36, 16, 16, '#1a1a22')]); foreF.ind = 54;
    const torso = layer('torso', [rc(0, -34, 66, 66, 16, C.coral), el(-8, -36, 18, 18, '#f4efe6'), rc(14, -16, 22, 6, 3, '#a8321e')], { p: sv([0, -8, 0]), r: kf(t => pose(t).torso) }, 50); torso.ind = 60;
    const blink = { s: { a: 1, k: [[0, 100], [60, 100], [63, 10], [67, 100], [96, 100]].map(([t, v], i, a) => Object.assign({ t, s: [100, v] }, i < a.length - 1 ? { o: { x: [0.4], y: [0] }, i: { x: [0.6], y: [1] } } : {})) }, a: sv([4, -26]), p: sv([4, -26]) };
    const head = layer('head', [{ ty: 'gr', it: [el(-8, -26, 8, 12, C.cyan), el(16, -26, 8, 12, C.cyan), tr(blink)] }, rc(4, -26, 52, 30, 9, '#1a1a22'), rc(0, -26, 70, 50, 14, '#f4efe6')], { p: sv([0, -68, 0]), r: kf(t => pose(t).head) }, 60); head.ind = 61;
    const antenna = layer('antenna', [el(0, -22, 13, 13, C.amber), rc(0, -10, 4, 20, 2, '#c9c4d8')], { p: sv([-6, -50, 0]), r: kf(t => pose(t).antenna) }, 61); antenna.ind = 62;
    const thighN = limb('thigh near', 50, [0, 4], 44, 18, '#c9c4d8', 'thighN'); thighN.ind = 70;
    const shinN = limb('shin near', 70, [0, 44], 44, 16, '#c9c4d8', 'shinN', [rc(9, 46, 32, 12, 5, '#1a1a22')]); shinN.ind = 71;
    const armN = limb('arm near', 60, [-2, -56], 38, 14, '#c9c4d8', 'armN'); armN.ind = 72;
    const foreN = limb('forearm near', 72, [0, 36], 34, 13, '#c9c4d8', 'foreN', [el(0, 36, 16, 16, '#1a1a22')]); foreN.ind = 73;
    // draw order back to front: ground, shadow, far arm, far leg, hips, torso, head, antenna, near leg, near arm
    const order = [...layers, foreF, armF, shinF, thighF, hips, torso, head, antenna, shinN, thighN, foreN, armN];
    return { v: '5.7.4', fr: 30, ip: 0, op: FR, w: 640, h: 360, nm: 'walk', ddd: 0, assets: [], layers: order.reverse() };
  }

  EX.add({
    cat: 'libs', id: 'l2-lottie-walk', kind: 'dom', title: 'Robot walk cycle rig', aka: 'character rig, walk cycle, parenting, puppet animation, Lottie character', runs: 'WEB',
    tool: 'Lottie (lottie-web SVG player, parented shape layers, rotation keyframes, written by code)',
    notice: 'A robot built as a Lottie rig, the way an After Effects animator would: every limb is its own layer, and the parent field chains them (hips to thigh to shin, torso to upper arm to forearm, head to antenna), so each layer only rotates around its own joint. Code writes the rotation keyframes for one stride, the antenna lags behind the head for follow-through, and the eyes blink once per loop. Turn the rig on to see the bones.',
    use: 'app mascots, onboarding characters, game UI, explainer videos',
    prompt: 'Write a Lottie file in code (no After Effects): a 640 x 360, 30 fps, 96-frame loop of a robot walking. Make every body part a shape layer and chain them with the parent field: hips, thighs, shins with feet, torso, upper arms, forearms with hands, head and antenna. Key the joint rotations from a walk-cycle function (thigh swing {stride} degrees, knees bending in the swing phase, arms opposite to the legs, hips bobbing twice per stride, antenna lagging for follow-through), scroll ground dashes in sync with the stride and add a blink. Play it with lottie-web at {speed}x and offer a toggle that draws the bones.',
    params: [
      { key: 'stride', label: 'Stride', min: 8, max: 40, step: 1, value: 26, unit: '', restart: true },
      { key: 'speed', label: 'Speed', min: 0.25, max: 2, step: 0.05, value: 1, unit: '' },
    ],
    controls: [
      { label: 'Rig off', on: true, fn: L => { L.state.rig = false; } },
      { label: 'Rig on', fn: L => { L.state.rig = true; } },
    ],
    setup(st, L) {
      const lottie = W.lottie; if (!lottie) return missing(st, 'Lottie');
      if (st._anim) { try { st._anim.destroy(); } catch (e) { /* gone */ } }
      const S = { rig: !!(L.state && L.state.rig) }; L.state = S;
      const A = (L.p && L.p.stride) || 26;
      st.innerHTML = `<style>.lw{position:absolute;inset:0;background:linear-gradient(#1b1a33 0%,#141326 70%,#0e0d1a 100%)}
        .lw-box,.lw-rig{position:absolute;inset:0}
        .lw-hud{position:absolute;left:16px;top:14px;font:12px/18px ${MONO};color:#8a8794;white-space:pre}
        .lw-hud b{color:${C.amber};font-weight:600}
        .lw-t{position:absolute;right:16px;top:14px;font:600 13px ${MONO};color:${C.cream}}</style>
        <div class="lw"><div class="lw-box"></div><canvas class="lw-rig" width="640" height="360"></canvas><div class="lw-hud"></div><div class="lw-t">Lottie</div></div>`;
      const box = /** @type {HTMLElement} */ (st.querySelector('.lw-box')), hud = /** @type {HTMLElement} */ (st.querySelector('.lw-hud'));
      const rcv = /** @type {HTMLCanvasElement} */ (st.querySelector('.lw-rig')), rg = rcv.getContext('2d');
      const anim = lottie.loadAnimation({ container: box, renderer: 'svg', loop: false, autoplay: false, animationData: walkLottie(A), rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } });
      st._anim = anim;
      let fr = 0;
      return (t, dt) => {
        const sp = (L.p && L.p.speed) || 1; fr = (fr + dt * 30 * sp) % 96;
        anim.goToAndStop(fr, true);
        const po = walkPose((fr % 32) / 32, A), d = Math.round;
        hud.innerHTML = `hips ${'›'} thigh ${'›'} shin\ntorso ${'›'} arm ${'›'} forearm\nhead ${'›'} antenna\n\nthigh <b>${d(po.thighN)}°</b>  shin <b>${d(po.shinN)}°</b>\narm <b>${d(po.armN)}°</b>  forearm <b>${d(po.foreN)}°</b>\nframe <b>${fr.toFixed(1)}</b> / 96`;
        rg.clearRect(0, 0, 640, 360);
        if (!S.rig) return;
        // forward kinematics of the same chain: translate to the joint, then rotate
        const chain = (x, y, a, steps) => { const pts = [[x, y]]; for (const [dx, dy, r] of steps) { const c = Math.cos(a * RAD), s = Math.sin(a * RAD); x += dx * c - dy * s; y += dx * s + dy * c; a += r; pts.push([x, y]); } return pts; };
        const hx = 300, hy = 210 + po.hipsY;
        const bones = [
          chain(hx, hy, 0, [[0, 4, po.thighN], [0, 44, po.shinN], [0, 44, 0]]), chain(hx, hy, 0, [[0, 4, po.thighF], [0, 44, po.shinF], [0, 44, 0]]),
          chain(hx, hy, 0, [[0, -8, po.torso], [-2, -56, po.armN], [0, 36, po.foreN], [0, 34, 0]]), chain(hx, hy, 0, [[0, -8, po.torso], [6, -56, po.armF], [0, 36, po.foreF], [0, 34, 0]]),
          chain(hx, hy, 0, [[0, -8, po.torso], [0, -68, po.head], [-6, -50, po.antenna], [0, -22, 0]]),
        ];
        rg.lineWidth = 2; rg.strokeStyle = C.amber; rg.fillStyle = C.amber;
        for (const b of bones) { rg.beginPath(); b.forEach(([x, y], i) => (i ? rg.lineTo(x, y) : rg.moveTo(x, y))); rg.stroke(); b.forEach(([x, y]) => { rg.beginPath(); rg.arc(x, y, 3.5, 0, 7); rg.fill(); }); }
      };
    },
  });

  // ---------------------------------------------------------------- GSAP
  const ROWS = [['SCROLL FASTER', 'out'], ['TYPE THAT MOVES', 'ink'], ['GSAP UTILS WRAP', 'hot'], ['VELOCITY SKEW', 'out'], ['SEAMLESS LOOP', 'ink']];

  EX.add({
    cat: 'libs', id: 'l2-gsap-marquee', kind: 'dom', title: 'Velocity marquee poster', aka: 'infinite marquee, ticker tape, scroll velocity skew, kinetic poster', runs: 'WEB',
    tool: 'GSAP (quickSetter, utils.wrap, utils.clamp, SplitText)',
    notice: 'Five rows of type slide in opposite directions forever. gsap.utils.wrap keeps each row inside one text width, so the loop has no seam, and gsap.quickSetter writes x and skew every frame without creating tweens. A flick of speed (or your drag) pushes the rows faster, leans them by their velocity and makes the coral row\'s letters wave through SplitText, then everything eases back to cruise.',
    use: 'agency and portfolio sites, event posters, section breaks, social clips',
    prompt: 'Using GSAP, build a kinetic poster on paper color: five rows of huge condensed type, tilted 6 degrees, alternating outlined, black and coral rows, each scrolling forever in the opposite direction to its neighbor. Move each row with gsap.quickSetter on x, wrapped with gsap.utils.wrap over one text width, at {base} px per second. Every {every} s add a speed flick that decays, drag to throw the rows yourself, skew each row by its velocity with gsap.utils.clamp (max {skew} degrees), and wave the coral row\'s SplitText characters with the speed.',
    params: [
      { key: 'base', label: 'Cruise speed', min: 0, max: 200, step: 5, value: 60, unit: '' },
      { key: 'skew', label: 'Max skew', min: 0, max: 30, step: 1, value: 14, unit: '' },
      { key: 'every', label: 'Flick every', min: 1.5, max: 8, step: 0.5, value: 3.5, unit: '' },
    ],
    setup(st, L) {
      const gsap = W.gsap; if (!gsap || !gsap.quickSetter || !gsap.utils) return missing(st, 'GSAP');
      const SplitText = W.SplitText; if (SplitText) gsap.registerPlugin(SplitText);
      st.innerHTML = `<style>.gm{position:absolute;inset:0;background:${C.paper};overflow:hidden;cursor:grab;touch-action:none}
        .gm-rot{position:absolute;left:-60px;right:-60px;top:-34px;transform:rotate(-6deg)}
        .gm-row{height:78px;white-space:nowrap;overflow:visible}
        .gm-tr{display:inline-block;will-change:transform}
        .gm-tr span{display:inline-block;font:800 76px/78px ${DISP};letter-spacing:-1px;padding-right:34px}
        .gm-out span{color:transparent;-webkit-text-stroke:2px #1a1720;font:900 70px/78px "Segoe UI",sans-serif;letter-spacing:0}
        .gm-ink span{color:#1a1720}
        .gm-hot{background:${C.coral}}.gm-hot span{color:${C.paper}}
        .gm-hud{position:absolute;left:14px;bottom:12px;padding:5px 11px;border-radius:999px;background:#1a1720;color:${C.paper};font:12px ${MONO}}
        .gm-hud b{color:${C.amber};font-weight:600}</style>
        <div class="gm"><div class="gm-rot">${ROWS.map(([s, k]) => `<div class="gm-row gm-${k}"><div class="gm-tr">${`<span>${s} •</span>`.repeat(4)}</div></div>`).join('')}</div><div class="gm-hud"></div></div>`;
      const box = /** @type {HTMLElement} */ (st.querySelector('.gm')), hud = /** @type {HTMLElement} */ (st.querySelector('.gm-hud'));
      const rows = [...st.querySelectorAll('.gm-tr')].map((tr, i) => {
        const unit = /** @type {HTMLElement} */ (tr.firstElementChild).offsetWidth || 600;
        return { tr, dir: i % 2 ? 1 : -1, off: -unit * ((i * 0.37) % 1), wrap: gsap.utils.wrap(-unit, 0), setX: gsap.quickSetter(tr, 'x', 'px'), setSkew: gsap.quickSetter(tr, 'skewX', 'deg') };
      });
      const hotSpans = [...st.querySelectorAll('.gm-hot span')];
      const chars = SplitText ? hotSpans.flatMap(sp => new SplitText(sp, { type: 'chars' }).chars) : [];
      const setY = chars.map(c => gsap.quickSetter(c, 'y', 'px'));
      const S = { boost: 0, drag: false, lx: 0, flick: -1, vel: 0, shown: 0 };
      box.onpointerdown = e => { S.drag = true; S.lx = e.clientX; box.setPointerCapture(e.pointerId); box.style.cursor = 'grabbing'; };
      box.onpointermove = e => { if (!S.drag) return; const dx = (e.clientX - S.lx) * 640 / st.getBoundingClientRect().width; S.lx = e.clientX; S.boost += dx * 0.12; };
      box.onpointerup = box.onpointercancel = () => { S.drag = false; box.style.cursor = 'grab'; };
      const clampSkew = (m, v) => gsap.utils.clamp(-m, m, v);
      return (t, dt) => {
        const p = Object.assign({ base: 60, skew: 14, every: 3.5 }, L.p);
        const f = Math.floor(t / p.every); if (f !== S.flick) { if (S.flick >= 0 || t > 0.6) S.boost += 9 * (f % 3 === 2 ? -1 : 1); S.flick = f; }
        S.boost *= Math.exp(-dt * 1.6);
        const target = 1 + S.boost; S.vel += (target - S.vel) * (1 - Math.exp(-dt * 8));
        for (const r of rows) {
          r.off += r.dir * p.base * S.vel * dt;
          r.setX(r.wrap(r.off)); r.setSkew(clampSkew(p.skew, -r.dir * (S.vel - 1) * 2.2));
        }
        const amp = Math.min(22, Math.abs(S.vel - 1) * 3.2);
        for (let i = 0; i < setY.length; i++) setY[i](Math.sin(t * 9 - i * 0.55) * amp);
        S.shown += (S.vel - S.shown) * 0.25;
        hud.innerHTML = `velocity <b>${S.shown.toFixed(1)}x</b> &nbsp; skewX <b>${clampSkew(p.skew, (S.shown - 1) * 2.2).toFixed(1)}&deg;</b> &nbsp; drag to throw`;
      };
    },
  });

  EX.add({
    cat: 'libs', id: 'l2-gsap-adspot', kind: 'dom', title: 'Ad spot from nested timelines', aka: 'banner ad, product spot, motion graphics timeline, scene sequencing', runs: 'WEB',
    tool: 'GSAP (nested timelines, addLabel, position parameter, SplitText, stagger, attr tweens, yoyo)',
    notice: 'An 11-second product spot made like a motion designer would: four scenes, each its own GSAP timeline, added to one master timeline at named labels. The strip below is that master: colored blocks are the child timelines, ticks are the labels, and the playhead is master.time(). Because scenes overlap with the position parameter ("-=0.4"), each one starts while the last is leaving.',
    use: 'banner and social ads, product teasers, launch videos, app store previews',
    prompt: 'Using GSAP, build an 11 s product spot for "ORBIT" headphones at 640 x 360 from four scene timelines added to a master timeline with addLabel: intro (coral circle wipe, SplitText letters rising with back.out and a {stagger} s stagger), product (an SVG headband drawing itself with an attr tween on stroke-dashoffset, ear cups popping in, then floating with yoyo), features (three chips sliding in staggered and out), and call to action (price, a pre-order button with elastic scale and a light sweep). Overlap scenes with "-=0.4", play at {speed}x, and draw a timeline strip with scene blocks, labels and the playhead.',
    params: [
      { key: 'stagger', label: 'Letter stagger', min: 0.01, max: 0.2, step: 0.01, value: 0.06, unit: '', restart: true },
      { key: 'speed', label: 'Speed', min: 0.25, max: 2, step: 0.05, value: 1, unit: '' },
    ],
    setup(st, L) {
      const gsap = W.gsap; if (!gsap || !gsap.timeline) return missing(st, 'GSAP');
      const SplitText = W.SplitText; if (SplitText) gsap.registerPlugin(SplitText);
      if (st._tl) { st._tl.kill(); st._tl = null; }
      st.innerHTML = `<style>.ad{position:absolute;inset:0;background:#0f0f18;overflow:hidden;font-family:${DISP};color:${C.cream}}
        .ad-wipe{position:absolute;left:270px;top:110px;width:100px;height:100px;border-radius:50%;background:${C.coral};transform:scale(0)}
        .ad-brand{position:absolute;left:0;right:0;top:92px;text-align:center;font:800 92px/1 ${DISP};letter-spacing:10px;color:#0f0f18}
        .ad-sub{position:absolute;left:0;right:0;top:196px;text-align:center;font:600 15px ${MONO};letter-spacing:6px;color:#0f0f18}
        .ad-svg{position:absolute;left:206px;top:20px}
        .ad-chips{position:absolute;left:400px;top:52px;display:flex;flex-direction:column;gap:12px}
        .ad-chip{padding:9px 16px;border-radius:999px;background:#1f1f2e;border:1px solid #33334a;font:600 15px ${DISP};display:flex;gap:10px;align-items:center;opacity:0}
        .ad-chip i{width:10px;height:10px;border-radius:50%}
        .ad-price{position:absolute;left:0;right:0;top:70px;text-align:center;font:800 64px ${DISP};opacity:0}
        .ad-price span{font:600 18px ${MONO};color:#8a8794;letter-spacing:2px;display:block}
        .ad-btn{position:absolute;left:250px;top:176px;width:140px;height:46px;border-radius:999px;background:${C.amber};color:#0f0f18;font:700 17px/46px ${DISP};text-align:center;overflow:hidden;transform:scale(0)}
        .ad-btn b{position:absolute;top:-10px;left:-40px;width:26px;height:70px;background:rgba(255,255,255,.6);transform:rotate(20deg)}
        .ad-strip{position:absolute;left:16px;right:16px;bottom:12px;height:46px}
        .ad-strip div{position:absolute;height:14px;border-radius:4px;top:18px;font:10px/14px ${MONO};color:#0f0f18;padding-left:5px;overflow:hidden;white-space:nowrap}
        .ad-strip em{position:absolute;top:0;font:10px ${MONO};color:#8a8794;font-style:normal;transform:translateX(-50%)}
        .ad-ph{position:absolute;top:12px;width:2px;height:26px;background:${C.cream}}
        .ad-tc{position:absolute;right:0;top:-18px;font:11px ${MONO};color:${C.cream}}</style>
        <div class="ad"><div class="ad-wipe"></div><div class="ad-brand">ORBIT</div><div class="ad-sub">WIRELESS SOUND</div>
        <svg class="ad-svg" width="230" height="230" viewBox="0 0 230 230"><path class="ad-band" d="M45,150 C45,40 185,40 185,150" fill="none" stroke="${C.cream}" stroke-width="12" stroke-linecap="round"/>
        <g class="ad-cupL"><rect x="22" y="120" width="44" height="72" rx="18" fill="${C.coral}"/><rect x="58" y="132" width="12" height="48" rx="5" fill="#2a2a3a"/></g>
        <g class="ad-cupR"><rect x="164" y="120" width="44" height="72" rx="18" fill="${C.coral}"/><rect x="160" y="132" width="12" height="48" rx="5" fill="#2a2a3a"/></g></svg>
        <div class="ad-chips"><div class="ad-chip"><i style="background:${C.cyan}"></i>40 h battery</div><div class="ad-chip"><i style="background:${C.violet}"></i>Noise off</div><div class="ad-chip"><i style="background:${C.amber}"></i>Spatial audio</div></div>
        <div class="ad-price"><span>PRE-ORDER</span>$129</div><div class="ad-btn">Order now<b></b></div><div class="ad-strip"></div></div>`;
      const q = s => /** @type {HTMLElement} */ (st.querySelector(s));
      const band = q('.ad-band'), svg = q('.ad-svg'), chips = [...st.querySelectorAll('.ad-chip')], strip = q('.ad-strip');
      const blen = /** @type {SVGPathElement} */ (/** @type {unknown} */ (band)).getTotalLength();
      gsap.set(band, { attr: { 'stroke-dasharray': blen, 'stroke-dashoffset': blen } }); gsap.set([q('.ad-cupL'), q('.ad-cupR')], { scale: 0, transformOrigin: '50% 50%' }); gsap.set(svg, { opacity: 1 });
      const chars = SplitText ? new SplitText(q('.ad-brand'), { type: 'chars' }).chars : [q('.ad-brand')];
      const stg = (L.p && L.p.stagger) || 0.06;
      const intro = gsap.timeline()
        .to(q('.ad-wipe'), { scale: 9, duration: 0.9, ease: 'expo.inOut' })
        .from(chars, { yPercent: 120, opacity: 0, duration: 0.7, stagger: stg, ease: 'back.out(2)' }, '-=0.3')
        .from(q('.ad-sub'), { opacity: 0, letterSpacing: '18px', duration: 0.6, ease: 'power2.out' }, '-=0.3')
        .to([...chars, q('.ad-sub')], { y: -40, opacity: 0, duration: 0.45, stagger: 0.03, ease: 'power2.in' }, '+=0.5')
        .to(q('.ad-wipe'), { scale: 0, duration: 0.6, ease: 'expo.in' }, '-=0.3');
      const product = gsap.timeline()
        .to(band, { attr: { 'stroke-dashoffset': 0 }, duration: 0.9, ease: 'power2.inOut' })
        .to([q('.ad-cupL'), q('.ad-cupR')], { scale: 1, duration: 0.6, stagger: 0.12, ease: 'back.out(2.2)' }, '-=0.25')
        .to(svg, { y: -10, rotation: -4, duration: 0.7, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      const features = gsap.timeline()
        .to(svg, { x: -120, duration: 0.6, ease: 'power3.inOut' })
        .fromTo(chips, { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, stagger: 0.18, ease: 'power3.out' }, '-=0.3')
        .to(chips, { x: 40, opacity: 0, duration: 0.35, stagger: 0.08, ease: 'power2.in' }, '+=1.1')
        .to(svg, { opacity: 0, scale: 0.8, duration: 0.4, ease: 'power2.in' }, '-=0.2');
      const cta = gsap.timeline()
        .fromTo(q('.ad-price'), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' })
        .to(q('.ad-btn'), { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.45)' }, '-=0.2')
        .fromTo(q('.ad-btn b'), { x: 0 }, { x: 230, duration: 0.7, ease: 'power2.inOut' }, '+=0.2')
        .to({}, { duration: 1 });
      const tl = gsap.timeline({ paused: true }); st._tl = tl;
      tl.addLabel('intro', 0).add(intro, 'intro').addLabel('product', '-=0.4').add(product, 'product').addLabel('features', '-=0.4').add(features, 'features').addLabel('cta', '-=0.3').add(cta, 'cta');
      // the strip: one block per child timeline, a tick per label
      const D = tl.duration(), X = s => (s / D * 100).toFixed(2) + '%', cols = [C.coral, C.cream, C.cyan, C.amber];
      [[intro, 'intro'], [product, 'product'], [features, 'features'], [cta, 'cta']].forEach(([c, nm], i) => {
        const b = document.createElement('div'); b.style.left = X(c.startTime()); b.style.width = `calc(${X(c.duration())} - 2px)`; b.style.background = cols[i]; b.style.opacity = '0.85'; b.textContent = String(nm); strip.appendChild(b);
        const e = document.createElement('em'); e.style.left = X(tl.labels[String(nm)]); e.textContent = `'${nm}'`; if (i === 0) e.style.transform = 'none'; strip.appendChild(e);
      });
      const ph = document.createElement('i'); ph.className = 'ad-ph'; strip.appendChild(ph);
      const tc = document.createElement('span'); tc.className = 'ad-tc'; strip.appendChild(tc);
      let T = 0;
      return (t, dt) => {
        T = (T + dt * ((L.p && L.p.speed) || 1)) % (D + 0.6);
        const tt = Math.min(T, D); tl.time(tt);
        ph.style.left = X(tt); tc.textContent = `master.time(${tt.toFixed(2)}) / ${D.toFixed(1)} s`;
      };
    },
  });

  // ---------------------------------------------------------------- shared WebGL helpers for library renderers
  // Puts the shared EX.G context back to the defaults the other GPU cards expect, after a library rendered into it.
  function restoreGL(gl) {
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.ONE, gl.ZERO); gl.blendEquation(gl.FUNC_ADD); gl.colorMask(true, true, true, true); gl.depthMask(true); gl.frontFace(gl.CCW);
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE); gl.depthFunc(gl.LESS);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL); gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0); gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0); gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.useProgram(null);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
  }
  // One PixiJS renderer on the shared EX.G canvas (960 x 540), created on first use; resolves to the PIXI.Application.
  let pixiShared = null;
  function sharedPixi(PIXI) {
    if (pixiShared) return pixiShared;
    const app = new PIXI.Application();
    pixiShared = app.init({ canvas: EX.G.canvas, context: EX.G.gl, width: 960, height: 540, resolution: 1, autoDensity: false, antialias: false, background: '#07070c', autoStart: false, sharedTicker: false, preference: 'webgl', hello: false })
      .then(() => { app.ticker.stop(); restoreGL(EX.G.gl); return app; });
    return pixiShared;
  }

  // ---------------------------------------------------------------- PixiJS
  // Target positions and colors for one shape: text drawn into a canvas and sampled, or a procedural galaxy.
  function particleShape(n, kind, rnd) {
    const X = new Float32Array(n), Y = new Float32Array(n), R = new Uint8Array(n), Gc = new Uint8Array(n), B = new Uint8Array(n);
    const mix = (i, a, b, k) => { R[i] = lerp(a[0], b[0], k); Gc[i] = lerp(a[1], b[1], k); B[i] = lerp(a[2], b[2], k); };
    const CORAL = [255, 90, 54], AMBER = [255, 176, 32], CYAN = [43, 196, 230], VIOLET = [122, 92, 255], CREAM = [244, 239, 230];
    if (kind === 'galaxy') {
      for (let i = 0; i < n; i++) {
        const kind2 = rnd(), u = rnd(), gauss = () => (rnd() + rnd() + rnd() - 1.5) * 0.8;
        let x, y;
        if (kind2 < 0.16) { x = gauss() * 30; y = gauss() * 30; mix(i, CREAM, AMBER, rnd()); }
        else if (kind2 < 0.26) { const r = Math.sqrt(rnd()) * 210, a = rnd() * 6.283; x = Math.cos(a) * r; y = Math.sin(a) * r; mix(i, CREAM, CYAN, rnd()); }
        else { const r = 20 + Math.sqrt(u) * 190, a = (i % 2) * Math.PI + r * 0.026 + gauss() * (0.5 + 22 / r); x = Math.cos(a) * r; y = Math.sin(a) * r; mix(i, u < 0.45 ? AMBER : CYAN, u < 0.45 ? CORAL : VIOLET, rnd()); }
        X[i] = x; Y[i] = y; // galaxy is stored centered and unrotated
      }
      return { X, Y, R, G: Gc, B, galaxy: true };
    }
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${kind === '50,000' ? 150 : 142}px ${DISP}`; g.fillText(kind, 320, 186);
    const img = g.getImageData(0, 0, 640, 360).data, idx = [];
    for (let i = 0; i < 640 * 360; i++) if (img[i * 4 + 3] > 140) idx.push(i);
    const pair = kind === '50,000' ? [CORAL, AMBER] : [CYAN, VIOLET];
    for (let i = 0; i < n; i++) { const q = idx[Math.floor(rnd() * idx.length)]; X[i] = (q % 640) + rnd(); Y[i] = Math.floor(q / 640) + rnd(); mix(i, pair[0], pair[1], clamp01((X[i] - 90) / 460 + (rnd() - 0.5) * 0.2)); }
    return { X, Y, R, G: Gc, B, galaxy: false };
  }

  EX.add({
    cat: 'libs', id: 'l2-pixi-particles', title: '50,000 sprites that change shape', aka: 'particle morph, particle text, sprite swarm, galaxy particles', runs: 'GPU',
    tool: 'PixiJS v8 (ParticleContainer, Particle, dynamicProperties, additive blend, shared WebGL context)',
    notice: 'Fifty thousand sprites fly between the number 50,000, a spinning galaxy and the word PixiJS. A ParticleContainer draws them all in one batch and only re-uploads position and color each frame, which is why this many stay smooth. Each sprite leaves with a small delay and an arc of its own, so the swarm sweeps across. Move the pointer over it to push sprites aside.',
    use: 'hero intros, logo reveals, data and count reveals, event screens',
    prompt: 'Using PixiJS v8, put {count} small soft-dot sprites in a ParticleContainer with dynamicProperties position and color and additive blending. Sample the text 50,000 and the word PixiJS from a canvas, and build a two-arm spiral galaxy procedurally. Hold each shape {hold} s, then fly every sprite to the next shape over {fly} s with a per-sprite delay from left to right and a curved path. Rotate the galaxy, give the text a slight shimmer, and push sprites away from the pointer.',
    params: [
      { key: 'count', label: 'Sprites', min: 10000, max: 60000, step: 5000, value: 50000, unit: '', restart: true },
      { key: 'hold', label: 'Hold', min: 0.5, max: 4, step: 0.1, value: 2.2, unit: '' },
      { key: 'fly', label: 'Flight time', min: 0.6, max: 3, step: 0.1, value: 1.6, unit: '' },
    ],
    setup(cv, L) {
      const PIXI = W.PIXI; if (!PIXI || !PIXI.ParticleContainer || !PIXI.Particle) return missing(cv, 'PixiJS');
      if (!EX.G.gl) return missing(cv, 'WebGL2');
      const g = cv.getContext('2d'), n = Math.round((L.p && L.p.count) || 50000), rnd = EX.rng(12);
      const shapes = [particleShape(n, '50,000', rnd), particleShape(n, 'galaxy', rnd), particleShape(n, 'PixiJS', rnd)];
      const delay = new Float32Array(n), swirl = new Float32Array(n), ph = new Float32Array(n);
      for (let i = 0; i < n; i++) { delay[i] = rnd() * 0.25; swirl[i] = (rnd() - 0.5) * 0.7; ph[i] = rnd() * 6.283; }
      const ptr = { x: -999, y: -999 };
      cv.onpointermove = e => { const [x, y] = at(cv, e); ptr.x = x; ptr.y = y; };
      cv.onpointerleave = () => { ptr.x = ptr.y = -999; };
      let ready = null, root = null, parts = null;
      sharedPixi(PIXI).then(app => {
        const dc = document.createElement('canvas'); dc.width = dc.height = 16;
        const dg = dc.getContext('2d'), gr = dg.createRadialGradient(8, 8, 0, 8, 8, 8); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        dg.fillStyle = gr; dg.fillRect(0, 0, 16, 16);
        const tex = PIXI.Texture.from(dc);
        parts = []; for (let i = 0; i < n; i++) parts.push(new PIXI.Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5, scaleX: 0.28, scaleY: 0.28, alpha: 0.1 }));
        const pc = new PIXI.ParticleContainer({ dynamicProperties: { position: true, color: true }, texture: tex, particles: parts });
        pc.blendMode = 'add'; pc.update(); // particles passed to the constructor are not marked dirty, so upload the static buffer once
        if (cv._pixiRoot) cv._pixiRoot.destroy({ children: true }); // Replay: free the previous sprites
        root = cv._pixiRoot = new PIXI.Container(); root.scale.set(1.5); root.addChild(pc);
        ready = app;
      }).catch(err => console.error('l2-pixi-particles', err));
      const A = 26 << 24; // alpha 0.1, so overlapping sprites add up to color instead of white
      return t => {
        const p = Object.assign({ hold: 2.2, fly: 1.6 }, L.p), seg = p.hold + p.fly + 0.25, k = Math.floor(t / seg), lt = t - k * seg;
        const a = shapes[k % 3], b = shapes[(k + 1) % 3];
        if (ready) {
          const ga = t * 0.25, gc = Math.cos(ga), gs = Math.sin(ga), SQ = 0.46, mx = ptr.x, my = ptr.y, sh = 0.6 * Math.sin(t);
          for (let i = 0; i < n; i++) {
            let ax = a.X[i], ay = a.Y[i], bx = b.X[i], by = b.Y[i];
            if (a.galaxy) { const x = ax * gc - ay * gs, y = ax * gs + ay * gc; ax = 320 + x; ay = 180 + y * SQ; }
            if (b.galaxy) { const x = bx * gc - by * gs, y = bx * gs + by * gc; bx = 320 + x; by = 180 + y * SQ; }
            const u = clamp01((lt - p.hold - (delay[i] + (ax / 640) * 0.35) * 0.667 * p.fly) / (p.fly * 0.6)), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2, arc = Math.sin(Math.PI * e) * swirl[i];
            let x = ax + (bx - ax) * e - (by - ay) * arc, y = ay + (by - ay) * e + (bx - ax) * arc;
            if (e === 0 && !a.galaxy) { x += Math.sin(t * 1.7 + ph[i]) * sh; y += Math.cos(t * 1.3 + ph[i]) * sh; }
            const dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy;
            if (d2 < 3600) { const d = Math.sqrt(d2) + 0.01, f = (1 - d / 60) * (1 - d / 60) * 34 / d; x += dx * f; y += dy * f; }
            const P = parts[i]; P.x = x; P.y = y;
            const r = a.R[i] + (b.R[i] - a.R[i]) * e, gg = a.G[i] + (b.G[i] - a.G[i]) * e, bb = a.B[i] + (b.B[i] - a.B[i]) * e;
            P.color = (((bb & 255) << 16) | ((gg & 255) << 8) | (r & 255)) + A;
          }
          const gl = EX.G.gl, r = ready.renderer;
          r.resetState(); r.render({ container: root, clear: true, clearColor: '#07070c' }); restoreGL(gl);
          g.drawImage(EX.G.canvas, 0, 0, 960, 540, 0, 0, 640, 360);
        } else { g.fillStyle = '#07070c'; g.fillRect(0, 0, 640, 360); }
        g.font = `600 13px ${MONO}`; g.fillStyle = C.cream; g.textAlign = 'left'; g.fillText('PixiJS', 18, 26);
        g.font = `12px ${MONO}`; g.fillStyle = '#8a8794'; g.fillText(`ParticleContainer, ${n.toLocaleString('en-US')} sprites`, 76, 26);
        g.textAlign = 'right'; g.fillText('move the pointer to push', 622, 346); g.textAlign = 'left';
      };
    },
  });





  // ---------------------------------------------------------------- Three.js
  // Builds the gate course once: a closed spline, neon gates along it, the spline as a glowing tube, dust and a floor grid.
  // Renders through the shared EX.G context; the scene is kept on the stage so Replay reuses it.
  function gateCourse(T) {
    const renderer = new T.WebGLRenderer({ canvas: EX.G.canvas, context: EX.G.gl, antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1); renderer.autoClear = true;
    const scene = new T.Scene(), BG = new T.Color('#0d0a1f');
    scene.background = BG; scene.fog = new T.FogExp2(BG, 0.03);
    const camera = new T.PerspectiveCamera(70, 16 / 9, 0.1, 400);
    const R = EX.rng(8), ctrl = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = 70 + (R() - 0.5) * 40; ctrl.push(new T.Vector3(Math.cos(a) * r * 1.2, (R() - 0.5) * 28 + Math.sin(a * 3) * 6, Math.sin(a) * r)); }
    const curve = new T.CatmullRomCurve3(ctrl, true, 'centripetal');
    const len = curve.getLength();
    // Draws a canvas texture: a soft dot, or a glowing square outline for the gate halos.
    const canvasTex = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return new T.CanvasTexture(c); };
    const glowTex = canvasTex(256, (x, n) => { x.strokeStyle = '#fff'; x.shadowColor = '#fff'; for (const [w, b] of [[14, 40], [8, 18], [4, 6]]) { x.lineWidth = w; x.shadowBlur = b; x.strokeRect(n / 4, n / 4, n / 2, n / 2); } });
    const dotTex = canvasTex(32, (x, n) => { const gr = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, n, n); });
    // gates: a 4-segment torus is a square ring (the core), and a plane with the glow texture behind it
    const NG = 90, dummy = new T.Object3D(), cols = ['#ff5a36', '#ffb020', '#2bc4e6', '#7a5cff'].map(c => new T.Color(c));
    const core = new T.InstancedMesh(new T.TorusGeometry(2.6, 0.07, 4, 4), new T.MeshBasicMaterial({ color: '#ffffff' }), NG);
    const halo = new T.InstancedMesh(new T.PlaneGeometry(7.36, 7.36), new T.MeshBasicMaterial({ color: '#ffffff', map: glowTex, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }), NG);
    for (let i = 0; i < NG; i++) {
      const u = (i + 0.5) / NG, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      dummy.position.copy(p); dummy.lookAt(p.clone().add(tg)); dummy.rotateZ(i % 2 ? 0.12 : -0.12); dummy.updateMatrix(); halo.setMatrixAt(i, dummy.matrix);
      dummy.rotateZ(Math.PI / 4); dummy.updateMatrix(); core.setMatrixAt(i, dummy.matrix);
      const c = cols[Math.floor(i / 6) % 4]; core.setColorAt(i, c); halo.setColorAt(i, c);
    }
    scene.add(halo, core);
    // the spline itself, drawn as a thin rail 1.6 units under the flight path
    const tube = new T.Mesh(new T.TubeGeometry(curve, 900, 0.04, 5, true), new T.MeshBasicMaterial({ color: '#ffe2a8', transparent: true, opacity: 0.45, blending: T.AdditiveBlending, depthWrite: false }));
    tube.position.y = -1.6; scene.add(tube);
    // dust around the course
    const ND = 5000, dp = new Float32Array(ND * 3), dc = new Float32Array(ND * 3), tmp = new T.Color();
    for (let i = 0; i < ND; i++) {
      const p = curve.getPointAt(R()), r = 4 + Math.pow(R(), 0.7) * 26, a = R() * 6.283, b = (R() - 0.5) * 3;
      dp.set([p.x + Math.cos(a) * r, p.y + b * r * 0.4, p.z + Math.sin(a) * r], i * 3);
      tmp.set(cols[i % 4]).lerp(new T.Color('#f4efe6'), 0.6); dc.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.Float32BufferAttribute(dp, 3)); dg.setAttribute('color', new T.Float32BufferAttribute(dc, 3));
    scene.add(new T.Points(dg, new T.PointsMaterial({ size: 0.45, map: dotTex, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending })));
    const grid = new T.GridHelper(600, 120, '#3a2f7a', '#241d52'); grid.position.y = -32; scene.add(grid);
    // top-down outline of the course for the mini-map
    const map = []; for (let i = 0; i <= 160; i++) { const p = curve.getPointAt(i / 160); map.push([p.x, p.z]); }
    return { renderer, scene, camera, curve, len, map, fog: scene.fog, pos: new T.Vector3(), look: new T.Vector3(), t1: new T.Vector3(), t2: new T.Vector3() };
  }

  // Builds the low-poly island once: flat-shaded terrain with per-face colors, water, instanced trees, sun and moon lights with shadows, stars.
  function islandScene(T) {
    const renderer = new T.WebGLRenderer({ canvas: EX.G.canvas, context: EX.G.gl, antialias: false });
    renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    const scene = new T.Scene(); scene.background = new T.Color(); scene.fog = new T.Fog('#000', 60, 150);
    const camera = new T.PerspectiveCamera(40, 16 / 9, 0.5, 400);
    const N = EX.noise, height = (x, z) => {
      const d = Math.hypot(x * 1.05, z * 1.25) / 26, mask = Math.max(0, 1 - d * d);
      const n = N(x * 0.07 + 3, z * 0.07 + 7) * 0.65 + N(x * 0.18 + 11, z * 0.18) * 0.25 + N(x * 0.5, z * 0.5 + 5) * 0.1;
      return mask * (n * 16 - 3) + mask * mask * 4 - 2.2;
    };
    const geo = new T.PlaneGeometry(64, 64, 90, 90); geo.rotateX(-Math.PI / 2);
    const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) pa.setY(i, height(pa.getX(i), pa.getZ(i)));
    const flat = geo.toNonIndexed(), fp = flat.attributes.position, col = new Float32Array(fp.count * 3), c = new T.Color();
    const BANDS = /** @type {[number, string][]} */ ([[0.6, '#e8d29a'], [3.2, '#7dbb5a'], [6.5, '#4f8f45'], [9.5, '#8a8078'], [99, '#f4efe6']]);
    for (let i = 0; i < fp.count; i += 3) {
      const y = (fp.getY(i) + fp.getY(i + 1) + fp.getY(i + 2)) / 3, band = BANDS.find(b => y < b[0]);
      c.set(y < -0.4 ? '#c9b47f' : band[1]).offsetHSL(0, 0, (EX.noise(i * 0.013, 2) - 0.5) * 0.08);
      for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
    }
    flat.setAttribute('color', new T.Float32BufferAttribute(col, 3)); flat.computeVertexNormals();
    const land = new T.Mesh(flat, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    land.receiveShadow = land.castShadow = true; scene.add(land);
    const water = new T.Mesh(new T.CircleGeometry(200, 64), new T.MeshStandardMaterial({ color: '#2a7bb0', roughness: 0.6, metalness: 0.05 }));
    water.rotation.x = -Math.PI / 2; water.receiveShadow = true; scene.add(water);
    // trees on grass, as one InstancedMesh of cones
    const R = EX.rng(31), trees = new T.InstancedMesh(new T.ConeGeometry(0.55, 1.9, 6), new T.MeshStandardMaterial({ color: '#2f6b3a', flatShading: true, roughness: 0.9 }), 260), m = new T.Object3D();
    let nt = 0;
    for (let k = 0; k < 4000 && nt < 260; k++) {
      const x = (R() - 0.5) * 50, z = (R() - 0.5) * 44, y = height(x, z);
      if (y < 1.2 || y > 7 || EX.noise(x * 0.15, z * 0.15, 4) < 0.45) continue;
      const s = 0.7 + R() * 0.7; m.position.set(x, y + 0.85 * s, z); m.scale.set(s, s, s); m.rotation.y = R() * 6; m.updateMatrix(); trees.setMatrixAt(nt++, m.matrix);
    }
    trees.count = nt; trees.castShadow = true; scene.add(trees);
    const sun = new T.DirectionalLight('#fff', 2), moon = new T.DirectionalLight('#8fa8ff', 0.3), hemi = new T.HemisphereLight('#bfe3ff', '#3a3020', 0.6);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 140 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
    scene.add(sun, sun.target, moon, hemi);
    const disc = new T.Mesh(new T.SphereGeometry(3.2, 16, 12), new T.MeshBasicMaterial({ color: '#ffe8b0', fog: false })); scene.add(disc);
    const sp = new Float32Array(1500 * 3); for (let i = 0; i < 1500; i++) { const a = R() * 6.283, e = Math.asin(R()), r = 180; sp.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    const stars = new T.Points(sg, new T.PointsMaterial({ color: '#ffffff', size: 1.1, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false })); scene.add(stars);
    const SKY = [[0, '#070a1c'], [0.21, '#14163a'], [0.25, '#ff8f63'], [0.3, '#8ccbf2'], [0.5, '#7ec2f2'], [0.7, '#8ccbf2'], [0.75, '#ff7448'], [0.79, '#231b45'], [1, '#070a1c']].map(([k, h]) => [k, new T.Color(h)]);
    return { renderer, scene, camera, sun, moon, hemi, disc, stars, water, SKY, tmp: new T.Color(), deep: new T.Color('#1f6a9c'), warm: new T.Color('#ffae70'), white: new T.Color('#fff6e6') };
  }

  EX.add({
    cat: 'libs', id: 'l2-three-island', title: 'Low-poly island, day to night', aka: 'time of day, sun cycle, real-time shadows, flat shading, diorama', runs: 'GPU',
    tool: 'Three.js (DirectionalLight shadows, PCFShadowMap, flatShading, vertex colors, InstancedMesh, ACES tone mapping)',
    notice: 'A noise height map becomes a flat-shaded island, each triangle colored by its height: sand, grass, forest, rock and snow. A DirectionalLight sun circles over it and casts real shadow maps from the hills and 260 instanced trees, while the sky, fog and light colors follow the time of day. At night a cool moon light and stars take over.',
    use: 'game worlds, map and travel stories, weather apps, ambient hero scenes',
    prompt: 'Using Three.js, build a low-poly island: a PlaneGeometry displaced by noise with an island falloff, made non-indexed so every triangle gets one vertex color by height (sand, grass, forest, rock, snow), MeshStandardMaterial with flatShading, a transparent water disc and about 260 cone trees in an InstancedMesh. Run a {day} s day: a DirectionalLight sun on an arc with PCFShadowMap shadows, warm at sunrise and sunset, a sky and fog color ramp, a moon light and Points stars at night, ACES tone mapping, and a camera orbiting at {orbit} rad/s. Show the clock.',
    params: [
      { key: 'day', label: 'Day length', min: 6, max: 60, step: 1, value: 16, unit: '' },
      { key: 'orbit', label: 'Orbit', min: 0, max: 0.5, step: 0.01, value: 0.08 },
    ],
    setup(cv, L) {
      const LT = W.LIBS_THREE, T = LT && LT.THREE; if (!T) return missing(cv, 'Three.js');
      if (!EX.G.gl) return missing(cv, 'WebGL2');
      const S = cv._island || (cv._island = islandScene(T)), g = cv.getContext('2d');
      const { renderer, scene, camera, sun, moon, hemi, disc, stars, water, SKY, tmp, deep, warm, white } = S;
      return t => {
        const p = Object.assign({ day: 16, orbit: 0.08 }, L.p), ph = (t / p.day + 0.2) % 1, el = (ph - 0.25) * Math.PI * 2;
        const sx = Math.cos(el), sy = Math.sin(el), day = clamp01(sy * 3 + 0.35), night = 1 - clamp01(sy * 4 + 0.6);
        let k = 1; while (k < SKY.length - 1 && SKY[k][0] < ph) k++;
        const [k0, c0] = SKY[k - 1], [k1, c1] = SKY[k]; tmp.copy(c0).lerp(c1, (ph - k0) / (k1 - k0));
        scene.background.copy(tmp); scene.fog.color.copy(tmp);
        sun.position.set(sx * 60, sy * 60, 22); sun.intensity = 2.6 * clamp01((sy + 0.06) * 3); sun.color.copy(warm).lerp(white, clamp01(sy * 1.6));
        moon.position.set(-sx * 60, Math.max(10, -sy * 60), -20); moon.intensity = 0.35 * night * clamp01(-sy * 3);
        hemi.intensity = 0.15 + 0.6 * day; hemi.color.copy(tmp).lerp(white, 0.4);
        water.material.color.copy(deep).lerp(tmp, 0.5).multiplyScalar(0.55 + 0.45 * day);
        disc.position.set(sx * 150, sy * 150, 55); disc.visible = sy > -0.08; disc.material.color.copy(warm).lerp(white, clamp01(sy * 2));
        stars.material.opacity = night;
        const a = t * p.orbit + 0.6; camera.position.set(Math.cos(a) * 54, 24, Math.sin(a) * 54); camera.lookAt(0, 1, 0);
        renderer.resetState(); renderer.setViewport(0, 0, 960, 540); renderer.render(scene, camera); restoreGL(EX.G.gl);
        g.drawImage(EX.G.canvas, 0, 0, 960, 540, 0, 0, 640, 360);
        const mins = Math.floor(ph * 24 * 60), hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(mins % 60 - (mins % 15)).padStart(2, '0');
        g.fillStyle = 'rgba(11,11,16,0.55)'; g.beginPath(); g.roundRect(14, 12, 168, 50, 10); g.fill();
        g.font = `700 24px ${DISP}`; g.fillStyle = C.cream; g.fillText(`${hh}:${mm}`, 26, 44);
        g.font = `12px ${MONO}`; g.fillStyle = sy > 0 ? C.amber : '#9fb4ff'; g.fillText(sy > 0 ? 'sun' : 'moon', 104, 34);
        g.fillStyle = '#b8b4c8'; g.fillText(`el ${(Math.asin(sy) / RAD).toFixed(0)}°`, 104, 50);
      };
    },
  });

  EX.add({
    cat: 'libs', id: 'l2-three-flight', title: 'Camera flight along a spline', aka: 'fly-through, camera rail, drone race, on-rails camera, look-ahead camera', runs: 'GPU',
    tool: 'Three.js (CatmullRomCurve3, getPointAt, TubeGeometry, InstancedMesh, FogExp2, Points)',
    notice: 'The camera rides a closed CatmullRomCurve3 through 90 neon gates. Each frame it sits at getPointAt(u) and looks at a point a little further along the same curve, so it turns into every bend before it reaches it, and it banks by how sharply the path turns. The thin gold rail under the path is the spline itself, and the map in the corner shows the camera and its look-ahead target from above.',
    use: 'product and architecture fly-throughs, game intros, music visuals, scroll-driven 3D stories',
    prompt: 'Using Three.js, build a closed CatmullRomCurve3 (centripetal) through 12 random points in a wide loop with height changes, and fly the camera along it at {speed} units per second with getPointAt. Look at the point {look} units ahead and bank up to {bank} radians from the change in tangent. Place 90 neon square gates (a 4-segment TorusGeometry in an InstancedMesh, plus an additive canvas-texture glow) along the curve, show the spline as a thin TubeGeometry rail just under the path, add 5,000 dust Points, a GridHelper floor and FogExp2 (density {fog}), and a top-down mini-map of the path.',
    params: [
      { key: 'speed', label: 'Speed', min: 4, max: 60, step: 1, value: 22, unit: '' },
      { key: 'look', label: 'Look ahead', min: 0.5, max: 40, step: 0.5, value: 9, unit: '' },
      { key: 'bank', label: 'Bank', min: 0, max: 1.2, step: 0.05, value: 0.5 },
      { key: 'fog', label: 'Fog density', min: 0, max: 0.08, step: 0.002, value: 0.03, dec: 3 },
    ],
    setup(cv, L) {
      const LT = W.LIBS_THREE, T = LT && LT.THREE; if (!T) return missing(cv, 'Three.js');
      if (!EX.G.gl) return missing(cv, 'WebGL2');
      const S = cv._course || (cv._course = gateCourse(T)), g = cv.getContext('2d');
      const { renderer, scene, camera, curve, len, map, pos, look, t1, t2 } = S;
      let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (const [x, z] of map) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
      const MW = 112, ms = MW / Math.max(maxX - minX, maxZ - minZ), mx0 = 640 - 16 - MW, my0 = 16, mp = (x, z) => [mx0 + (x - minX) * ms, my0 + (z - minZ) * ms];
      let roll = 0;
      return (t, dt) => {
        const p = Object.assign({ speed: 22, look: 9, bank: 0.5, fog: 0.03 }, L.p);
        const u = ((t * p.speed) / len) % 1, ua = (u + p.look / len) % 1;
        curve.getPointAt(u, pos); curve.getPointAt(ua, look);
        curve.getTangentAt(u, t1); curve.getTangentAt((u + 12 / len) % 1, t2);
        const turn = t1.x * t2.z - t1.z * t2.x, target = Math.max(-1, Math.min(1, turn * 4)) * p.bank;
        roll += (target - roll) * (1 - Math.exp(-dt * 3));
        camera.position.copy(pos); camera.position.y += 0.4; camera.lookAt(look); camera.rotateZ(roll);
        S.fog.density = p.fog;
        renderer.resetState(); renderer.setViewport(0, 0, 960, 540); renderer.render(scene, camera); restoreGL(EX.G.gl);
        g.drawImage(EX.G.canvas, 0, 0, 960, 540, 0, 0, 640, 360);
        // mini-map and readout
        g.fillStyle = 'rgba(11,11,16,0.6)'; g.beginPath(); g.roundRect(mx0 - 8, my0 - 8, MW + 16, (maxZ - minZ) * ms + 16, 8); g.fill();
        g.strokeStyle = 'rgba(255,226,168,0.7)'; g.lineWidth = 1.2; g.beginPath(); map.forEach(([x, z], i) => { const [a, b] = mp(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke();
        const [cx, cy] = mp(pos.x, pos.z), [lx, ly] = mp(look.x, look.z);
        g.strokeStyle = C.cyan; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(lx, ly); g.stroke();
        g.fillStyle = C.cyan; g.beginPath(); g.arc(lx, ly, 2.5, 0, 7); g.fill();
        g.fillStyle = C.coral; g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fill();
        g.font = `600 13px ${MONO}`; g.fillStyle = C.cream; g.textAlign = 'left'; g.fillText('Three.js', 18, 26);
        g.font = `12px ${MONO}`; g.fillStyle = '#b3aed0';
        g.fillText(`curve.getPointAt(${u.toFixed(3)})`, 18, 324); g.fillText(`camera.lookAt(getPointAt(${ua.toFixed(3)}))   roll ${roll.toFixed(2)}`, 18, 344);
      };
    },
  });
})();
