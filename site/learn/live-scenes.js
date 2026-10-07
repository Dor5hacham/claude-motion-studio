// Live scene demos for the Motion Guide: camera rig, transition player, post-FX stack,
// mood previews, the prompt playground and the live logo-reveal example.
// Uses addLoop, EASES, clamp01, lerp from the guide's inline script.
(function () {
  const CORAL = '#ff5a36', AMBER = '#ffb020', CYAN = '#2bc4e6', VIOLET = '#7a5cff', CREAM = '#ece7de', DIM = '#6d6a76', NAVY = '#1d1b3a';
  const PALS = { warm: ['#0b0b10', CORAL, AMBER, CYAN, CREAM], paper: ['#efe8dc', CORAL, NAVY, '#2bb8a0', '#1d1b3a'], neon: ['#07040f', '#ff2bd6', '#00e5ff', '#b6ff3b', '#ffffff'], mono: ['#0e0e0e', '#ffffff', '#9a9a9a', '#ff3b30', '#ffffff'] };
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const E = k => EASES[k][0];
  function mount(id, draw) { const cv = document.getElementById(id); if (!cv) return; const g = cv.getContext('2d'); addLoop(cv, t => { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; draw(g, t, cv.width, cv.height); }); }
  function buttons(hostId, items, onPick, initial) {
    const host = document.getElementById(hostId); if (!host) return;
    items.forEach(([key, label]) => { const b = document.createElement('button'); b.textContent = label; b.dataset.k = key; if (key === initial) b.classList.add('on'); b.onclick = () => { host.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); onPick(key); }; host.appendChild(b); });
  }

  // =============== Camera rig ===============
  const CAM = {
    static: ['Static', 'The camera does not move. Calm and documentary.', 'locked-off static camera'],
    push: ['Push-in', 'Moves toward the subject. Builds focus and tension.', 'slow push-in on the hero object'],
    pull: ['Pull-out', 'Moves away to reveal the surroundings. Good for endings.', 'pull-out reveal of the whole scene'],
    orbit: ['Orbit', 'Circles the subject. Shows 3D form; the classic product shot.', '180-degree orbit around the product'],
    pan: ['Pan', 'Turns left to right from one spot.', 'slow pan from left to right'],
    tilt: ['Tilt', 'Turns up or down from one spot.', 'tilt up from the floor to the hero'],
    crane: ['Crane', 'Rises up and over the scene. Epic, establishing.', 'crane up and over the scene'],
    whip: ['Whip pan', 'A very fast pan with motion blur, often used as a transition.', 'whip pan to the next shot'],
    rack: ['Rack focus', 'Focus shifts from near to far; the rest goes soft.', 'rack focus from the foreground to the hero'],
    shake: ['Camera shake', 'Small random jitter: impact, handheld energy.', 'camera shake on impact, 300 ms'],
    dolly: ['Dolly zoom', 'Camera moves back while zooming in: the background stretches. The "Vertigo" effect.', 'dolly zoom on the hero'],
  };
  let camMove = 'orbit';
  buttons('cam-btns', Object.entries(CAM).map(([k, v]) => [k, v[0]]), k => { camMove = k; camT0 = performance.now(); sayCam(); }, camMove);
  let camT0 = performance.now();
  function sayCam() { const d = document.getElementById('cam-desc'), s = document.getElementById('cam-say'); if (d) d.textContent = CAM[camMove][1]; if (s) s.textContent = CAM[camMove][2]; }
  sayCam();
  // Scene: a grid floor, pillars, and a hero sphere at the origin. Painter's algorithm, simple 3D projection.
  const objs = []; for (let i = -3; i <= 3; i++) for (let j = -2; j <= 4; j++) { if (i === 0 && j === 0) continue; if ((i * 7 + j * 3) % 3 === 0) objs.push({ x: i * 2.2, z: j * 2.2, h: 0.8 + ((i * i + j) % 4) * 0.5, c: [CORAL, AMBER, CYAN, VIOLET][(i + j + 8) % 4] }); }
  objs.push({ x: -1.4, z: -2.6, h: 1.2, c: CREAM, near: true });
  mount('cam-rig', (g, _t, W, H) => {
    const t = ((performance.now() - camT0) / 1000) % 4.5, k = E('ease-in-out')(seg(t, 0.4, 3.6));
    let eye = [0, 2.2, -9], look = [0, 0.8, 0], fov = 1.0, blurNear = 0, blurFar = 0, shake = [0, 0], whip = 0;
    if (camMove === 'push') eye = [0, 2, lerp(-12, -4.5, k)];
    if (camMove === 'pull') eye = [0, lerp(1.6, 4, k), lerp(-4.5, -14, k)];
    if (camMove === 'orbit') { const a = lerp(-1.4, 1.4, k); eye = [Math.sin(a) * 8, 2.4, -Math.cos(a) * 8]; }
    if (camMove === 'pan') look = [lerp(-6, 6, k), 0.8, 0];
    if (camMove === 'tilt') look = [0, lerp(-3, 1.2, k), 0];
    if (camMove === 'crane') { eye = [0, lerp(0.6, 9, k), lerp(-9, -6, k)]; }
    if (camMove === 'whip') { const w = seg(t, 1.6, 2.1); look = [lerp(-8, 8, E('ease-in-out')(w)), 0.8, 0]; whip = Math.sin(w * Math.PI); }
    if (camMove === 'rack') { const f = E('ease-in-out')(seg(t, 1.2, 2.4)); blurNear = lerp(0, 7, f); blurFar = lerp(6, 0, f); eye = [1.2, 1.6, -7]; }
    if (camMove === 'shake') { const s = t > 1.5 ? Math.exp(-(t - 1.5) * 6) : 0; shake = [Math.sin(t * 90) * 14 * s, Math.cos(t * 77) * 10 * s]; }
    if (camMove === 'dolly') { const d = lerp(6, 16, k); eye = [0, 1.4, -d]; fov = 2 * Math.atan(1.25 / d) * 3.2; }
    // camera basis
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = a => { const l = Math.hypot(...a); return a.map(v => v / l); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const fw = norm(sub(look, eye)), rt = norm(cross([0, 1, 0], fw)), up = cross(fw, rt), f = (H / 2) / Math.tan(fov / 2);
    const proj = p => { const d = sub(p, eye), z = dot(d, fw); return z < 0.1 ? null : [W / 2 + dot(d, rt) * f / z + shake[0], H / 2 - dot(d, up) * f / z + shake[1], z]; };
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#120f22'); sky.addColorStop(1, '#2a1830'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const draws = (pass) => {
      g.strokeStyle = 'rgba(122,92,255,0.25)'; g.lineWidth = 1;
      for (let i = -12; i <= 12; i++) { const a = proj([i, 0, -12]), b = proj([i, 0, 12]), c = proj([-12, 0, i]), d = proj([12, 0, i]); if (a && b) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } if (c && d) { g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.stroke(); } }
      const all = objs.map(o => ({ o, p: proj([o.x, o.h / 2, o.z]) })).filter(e => e.p).sort((a, b) => b.p[2] - a.p[2]);
      const hero = proj([0, 1, 0]);
      const items = [...all.map(e => ({ z: e.p[2], fn: () => { const o = e.o, top = proj([o.x, o.h, o.z]), bot = proj([o.x, 0, o.z]); if (!top || !bot) return; const w = 0.7 * f / e.p[2]; g.filter = o.near ? `blur(${blurNear}px)` : (Math.abs(e.p[2] - (hero ? hero[2] : 9)) > 3 ? `blur(${blurFar * 0.6}px)` : 'none'); g.fillStyle = o.c; g.fillRect(top[0] - w / 2, top[1], w, bot[1] - top[1]); g.filter = 'none'; } })),
        ...(hero ? [{ z: hero[2], fn: () => { const r = 1 * f / hero[2]; const gr = g.createRadialGradient(hero[0] - r * 0.3, hero[1] - r * 0.3, r * 0.1, hero[0], hero[1], r); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, CORAL); gr.addColorStop(1, '#5a1a10'); g.fillStyle = gr; g.beginPath(); g.arc(hero[0], hero[1], r, 0, 7); g.fill(); } }] : [])].sort((a, b) => b.z - a.z);
      items.forEach(i => i.fn()); void pass;
    };
    if (whip > 0.05) { for (let s = 0; s < 6; s++) { g.globalAlpha = 0.22; g.save(); g.translate((s - 3) * whip * 40, 0); draws(s); g.restore(); } g.globalAlpha = 1; } else draws(0);
    g.font = '600 13px Consolas'; g.fillStyle = CREAM; g.fillText(CAM[camMove][0].toUpperCase(), 16, 24);
  });

  // =============== Transition player ===============
  const TR = {
    cut: ['Hard cut', 'Instant switch. The most common transition of all.'], fade: ['Crossfade', 'One shot dissolves into the next. Soft, calm.'], dip: ['Dip to black', 'Fade out to black, then in. Marks a pause or time skip.'],
    wipe: ['Linear wipe', 'An edge sweeps across and reveals the next shot.'], iris: ['Iris', 'A growing circle reveals the next shot.'], push: ['Push / slide', 'The new shot pushes the old one out of frame.'],
    zoom: ['Zoom through', 'Scale into the shot until it becomes the next one.'], whip: ['Whip pan', 'Fast blurred slide; energy and speed.'], glitch: ['Glitch', 'Sliced, shifted, RGB-split frames for a digital break.'],
    blinds: ['Blinds', 'Bars wipe in one after another.'], match: ['Match cut', 'A shape in shot A becomes a shape in shot B, so the eye carries over.'],
  };
  let trKind = 'iris', trT0 = performance.now();
  buttons('tr-btns', Object.entries(TR).map(([k, v]) => [k, v[0]]), k => { trKind = k; trT0 = performance.now(); const d = document.getElementById('tr-desc'); if (d) d.textContent = TR[k][1]; const s = document.getElementById('tr-say'); if (s) s.textContent = `${TR[k][0].toLowerCase()} from scene A to scene B, 0.6 s`; }, trKind);
  const sceneA = (g, W, H, t) => { g.fillStyle = '#2a0f0a'; g.fillRect(0, 0, W, H); g.fillStyle = CORAL; g.beginPath(); g.arc(W * 0.3, H / 2, 70 + 6 * Math.sin(t * 3), 0, 7); g.fill(); g.font = '700 54px Bahnschrift'; g.fillStyle = CREAM; g.fillText('SCENE A', W * 0.48, H / 2 + 18); };
  const sceneB = (g, W, H, t) => { g.fillStyle = '#0d1430'; g.fillRect(0, 0, W, H); for (let i = 0; i < 5; i++) { g.fillStyle = [CYAN, VIOLET][i % 2]; g.fillRect(W * 0.58 + i * 46, H / 2 - 30 + Math.sin(t * 3 + i) * 20, 34, 60); } g.fillStyle = CYAN; g.beginPath(); g.arc(W * 0.3, H / 2, 70, 0, 7); g.fill(); g.font = '700 54px Bahnschrift'; g.fillStyle = CREAM; g.fillText('SCENE B', W * 0.06, 70); };
  const off = document.createElement('canvas'), off2 = document.createElement('canvas');
  mount('tr-player', (g, _t, W, H) => {
    off.width = off2.width = W; off.height = off2.height = H; const a = off.getContext('2d'), b = off2.getContext('2d');
    const t = ((performance.now() - trT0) / 1000) % 4, raw = seg(t, 1.4, 2.0), p = E('ease-in-out')(raw);
    sceneA(a, W, H, t); sceneB(b, W, H, t);
    const both = (alphaB) => { g.drawImage(off, 0, 0); g.globalAlpha = alphaB; g.drawImage(off2, 0, 0); g.globalAlpha = 1; };
    if (t > 3.4) { g.drawImage(off2, 0, 0); }
    else if (trKind === 'cut') g.drawImage(raw >= 0.5 ? off2 : off, 0, 0);
    else if (trKind === 'fade') both(p);
    else if (trKind === 'dip') { g.drawImage(p < 0.5 ? off : off2, 0, 0); g.fillStyle = `rgba(0,0,0,${1 - Math.abs(p - 0.5) * 2})`; g.fillRect(0, 0, W, H); }
    else if (trKind === 'wipe') { g.drawImage(off, 0, 0); g.drawImage(off2, 0, 0, W * p, H, 0, 0, W * p, H); g.fillStyle = CREAM; if (p > 0 && p < 1) g.fillRect(W * p - 2, 0, 4, H); }
    else if (trKind === 'iris') { g.drawImage(off, 0, 0); g.save(); g.beginPath(); g.arc(W / 2, H / 2, p * Math.hypot(W, H) / 2, 0, 7); g.clip(); g.drawImage(off2, 0, 0); g.restore(); }
    else if (trKind === 'push') { g.drawImage(off, -W * p, 0); g.drawImage(off2, W * (1 - p), 0); }
    else if (trKind === 'zoom') { if (p < 0.5) { const s = 1 + p * 6; g.save(); g.translate(W * 0.3, H / 2); g.scale(s, s); g.translate(-W * 0.3, -H / 2); g.drawImage(off, 0, 0); g.restore(); g.fillStyle = `rgba(255,255,255,${p * 1.6})`; g.fillRect(0, 0, W, H); } else { const s = 1 + (1 - p) * 3; g.save(); g.translate(W / 2, H / 2); g.scale(s, s); g.translate(-W / 2, -H / 2); g.drawImage(off2, 0, 0); g.restore(); g.fillStyle = `rgba(255,255,255,${(1 - p) * 1.6})`; g.fillRect(0, 0, W, H); } }
    else if (trKind === 'whip') { const x = -W * p; for (let s = 0; s < 8; s++) { g.globalAlpha = 0.18; g.drawImage(off, x + s * 30 * Math.sin(p * Math.PI), 0); g.drawImage(off2, x + W + s * 30 * Math.sin(p * Math.PI), 0); } g.globalAlpha = 1; }
    else if (trKind === 'glitch') { const src = raw < 0.5 ? off : off2; g.drawImage(src, 0, 0); const k = Math.sin(raw * Math.PI); for (let i = 0; i < 18; i++) { if (Math.random() > k) continue; const y = Math.random() * H, h = 4 + Math.random() * 24, dx = (Math.random() - 0.5) * 120 * k; g.drawImage(Math.random() < 0.5 ? off : off2, 0, y, W, h, dx, y, W, h); } if (k > 0.2) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 * k; g.drawImage(src, 8 * k, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; } }
    else if (trKind === 'blinds') { g.drawImage(off, 0, 0); for (let i = 0; i < 10; i++) { const q = clamp01((raw - i * 0.05) / 0.55), w = W / 10; g.drawImage(off2, i * w, 0, w, H * E('ease-in-out')(q), i * w, 0, w, H * E('ease-in-out')(q)); } }
    else if (trKind === 'match') { g.drawImage(raw < 0.5 ? off : off2, 0, 0); const r = 70 + 40 * Math.sin(raw * Math.PI); g.fillStyle = raw < 0.5 ? CORAL : CYAN; g.beginPath(); g.arc(W * 0.3, H / 2, r, 0, 7); g.fill(); }
    const x0 = 20, tw = W - 40; g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x0, H - 22, tw, 8); g.fillStyle = AMBER; g.fillRect(x0 + tw * 1.4 / 4, H - 22, tw * 0.6 / 4, 8); g.fillStyle = '#fff'; g.fillRect(x0 + tw * t / 4 - 1, H - 28, 2, 20);
    g.font = '600 12px Consolas'; g.fillStyle = CREAM; g.fillText(TR[trKind][0].toUpperCase() + '   (amber = transition)', 20, H - 32);
  });

  // =============== Post-FX stack (WebGL on a reel still) ===============
  (function () {
    const cv = document.getElementById('fx-stack'); if (!cv || !window.FX_SOURCE) return; const gl = cv.getContext('webgl2'); if (!gl) return;
    const vs = `#version 300 es
const vec2 P[3]=vec2[](vec2(-1,-1),vec2(3,-1),vec2(-1,3)); out vec2 v; void main(){v=P[gl_VertexID]*.5+.5;gl_Position=vec4(P[gl_VertexID],0,1);}`;
    const fs = `#version 300 es
precision highp float; in vec2 v; out vec4 o; uniform sampler2D uI; uniform float uT; uniform vec2 uR; uniform float fBloom,fGrain,fVig,fCA,fGrade,fDOF,fLetter,fScan,fSplit;
float h(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec3 img(vec2 u){return texture(uI,u).rgb;}
void main(){vec2 u=v; vec3 c;
  float ca=fCA*.006; c=vec3(img(u+(u-.5)*ca).r,img(u).g,img(u-(u-.5)*ca).b);
  if(fDOF>.5){float b=smoothstep(.12,.42,abs(u.y-.5)); vec3 s=vec3(0); for(int i=0;i<12;i++){float a=float(i)*2.39996; vec2 d=vec2(cos(a),sin(a))*sqrt(float(i)/12.)*b*.012*vec2(uR.y/uR.x,1.); s+=img(u+d);} c=mix(c,s/12.,b);}
  if(fBloom>.5){vec3 s=vec3(0); for(int i=0;i<16;i++){float a=float(i)*2.39996; vec2 d=vec2(cos(a),sin(a))*sqrt(float(i)/16.)*.035*vec2(uR.y/uR.x,1.); vec3 x=img(u+d); s+=max(x-.6,0.);} c+=s/16.*2.2;}
  if(fGrade>.5){float l=dot(c,vec3(.299,.587,.114)); c=mix(c,mix(vec3(.05,.22,.3),vec3(1.,.62,.35),smoothstep(.15,.85,l))*(l*1.25+.1),.55); c=pow(c,vec3(.95));}
  if(fScan>.5) c*=.82+.18*sin(u.y*uR.y*3.14159);
  if(fVig>.5) c*=smoothstep(1.1,.35,length((u-.5)*vec2(1.5,1.)));
  if(fGrain>.5) c+=(h(u*uR+fract(uT)*100.)-.5)*.09;
  if(fLetter>.5&&(u.y<.12||u.y>.88)) c=vec3(0);
  if(fSplit>.5&&u.x<.5) c=img(u);
  if(fSplit>.5&&abs(u.x-.5)<.0015) c=vec3(1);
  o=vec4(c,1);}`;
    const P = gl.createProgram(); [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(([k, s]) => { const sh = gl.createShader(k); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh)); gl.attachShader(P, sh); }); gl.linkProgram(P);
    const tex = gl.createTexture(); let ready = false; const im = new Image(); im.onload = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); ready = true; }; im.src = window.FX_SOURCE;
    const FX = [['Bloom', 'subtle bloom on highlights'], ['Grain', 'light film grain'], ['Vig', 'soft vignette'], ['CA', 'slight chromatic aberration'], ['Grade', 'teal-and-orange color grade'], ['DOF', 'tilt-shift depth of field'], ['Letter', '2.39:1 letterbox bars'], ['Scan', 'CRT scanlines']];
    const on = { Bloom: true, Grain: true, Vig: true }; let split = false;
    const host = document.getElementById('fx-btns'), say = document.getElementById('fx-say');
    const upd = () => { const w = FX.filter(([k]) => on[k]).map(([, s]) => s); say.textContent = w.length ? 'Post: ' + w.join(', ') + '.' : 'No post effects.'; };
    FX.forEach(([k, s]) => { const b = document.createElement('button'); b.textContent = { Bloom: 'Bloom', Grain: 'Film grain', Vig: 'Vignette', CA: 'Chromatic aberration', Grade: 'Color grade', DOF: 'Depth of field', Letter: 'Letterbox', Scan: 'Scanlines' }[k]; b.classList.toggle('on', !!on[k]); b.onclick = () => { on[k] = !on[k]; b.classList.toggle('on', on[k]); upd(); }; host.appendChild(b); void s; });
    const sb = document.createElement('button'); sb.textContent = 'Before / after split'; sb.style.marginLeft = '12px'; sb.onclick = () => { split = !split; sb.classList.toggle('on', split); }; host.appendChild(sb); upd();
    const vao = gl.createVertexArray(); const U = n => gl.getUniformLocation(P, n);
    addLoop(cv, t => { if (!ready) return; gl.viewport(0, 0, cv.width, cv.height); gl.useProgram(P); gl.bindVertexArray(vao); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U('uI'), 0); gl.uniform1f(U('uT'), t); gl.uniform2f(U('uR'), cv.width, cv.height); FX.forEach(([k]) => gl.uniform1f(U('f' + k), on[k] ? 1 : 0)); gl.uniform1f(U('fSplit'), split ? 1 : 0); gl.drawArrays(gl.TRIANGLES, 0, 3); });
  })();

  // =============== Shared title scene, used by moods, playground and logo reveal ===============
  // cfg: dur (s per move), ease (EASES key), stagger (s), pattern, entrance, camera, palette, grain, glow, glitch, text
  function titleScene(g, W, H, t, cfg) {
    const pal = PALS[cfg.palette] || PALS.warm, cyc = t % cfg.loop, inStart = 0.3;
    let sx = 0, sy = 0, sc = 1, rot = 0;
    if (cfg.camera === 'push') sc = 1 + 0.08 * (cyc / cfg.loop);
    if (cfg.camera === 'sway') { rot = Math.sin(t * 0.8) * 0.02; sx = Math.sin(t * 0.6) * 10; }
    const landT = inStart + cfg.dur + cfg.stagger * 5;
    if (cfg.camera === 'shake') { const s = cyc > landT ? Math.exp(-(cyc - landT) * 8) : 0; sx = Math.sin(t * 95) * 10 * s; sy = Math.cos(t * 81) * 7 * s; }
    g.fillStyle = pal[0]; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2 + sx, H / 2 + sy); g.rotate(rot); g.scale(sc, sc); g.translate(-W / 2, -H / 2);
    const text = (cfg.text || 'LAUNCH').toUpperCase().slice(0, 12), n = text.length, f = E(cfg.ease), outAt = cfg.loop - 0.9;
    const order = i => cfg.pattern === 'center' ? Math.abs(i - (n - 1) / 2) : cfg.pattern === 'random' ? ((i * 7) % n) : cfg.pattern === 'none' ? 0 : i;
    const fs = Math.min(110, (W * 0.8) / (n * 0.62)); g.font = `700 ${fs}px Bahnschrift`; g.textBaseline = 'alphabetic';
    const widths = [...text].map(c => g.measureText(c).width), total = widths.reduce((a, b) => a + b, 0) + (n - 1) * 4; let x = W / 2 - total / 2;
    if (cfg.glow) { g.shadowColor = pal[1]; g.shadowBlur = 24; }
    [...text].forEach((ch, i) => {
      const d = order(i) * cfg.stagger, k = f(seg(cyc, inStart + d, inStart + d + cfg.dur)), out = E('ease-in')(seg(cyc, outAt + d * 0.5, outAt + d * 0.5 + Math.min(0.5, cfg.dur)));
      let dy = 0, s = 1, a = 1, blur = 0, clip = false;
      if (cfg.entrance === 'fade') a = k; if (cfg.entrance === 'slide') { dy = (1 - k) * 60; a = Math.min(1, k * 2); }
      if (cfg.entrance === 'pop') { s = k; } if (cfg.entrance === 'mask') { dy = (1 - k) * fs; clip = true; } if (cfg.entrance === 'blur') { a = k; blur = (1 - k) * 14; }
      a *= 1 - out; dy -= out * 40;
      g.save(); if (clip) { g.beginPath(); g.rect(0, H / 2 - fs * 0.85, W, fs * 1.05); g.clip(); }
      g.globalAlpha = Math.max(0, a); if (blur > 0.3) g.filter = `blur(${blur}px)`;
      g.translate(x + widths[i] / 2, H / 2 + fs * 0.12 + dy); g.scale(s, s); g.fillStyle = i % 4 === 3 ? pal[1] : pal[4]; g.textAlign = 'center'; g.fillText(ch, 0, 0); g.restore();
      x += widths[i] + 4;
    });
    g.shadowBlur = 0;
    for (let i = 0; i < 5; i++) {
      const d = 0.15 + order(i % n) * cfg.stagger * 0.5 + i * cfg.stagger, k = f(seg(cyc, inStart + d, inStart + d + cfg.dur)), out = seg(cyc, outAt, outAt + 0.4);
      const bx = W / 2 - 160 + i * 80, by = H / 2 + fs * 0.55;
      g.globalAlpha = 1 - out; g.fillStyle = pal[1 + (i % 3)]; g.save(); g.translate(bx, by + (1 - k) * 30); g.scale(k, k); g.beginPath(); g.roundRect(-14, -14, 28, 28, i % 2 ? 14 : 5); g.fill(); g.restore();
    }
    g.globalAlpha = 1; g.restore();
    if (cfg.glitch) { const gk = Math.exp(-Math.abs(cyc - landT) * 10); for (let i = 0; i < 8 * gk; i++) { const y = Math.random() * H, hh = 3 + Math.random() * 14; g.drawImage(g.canvas, 0, y, W, hh, (Math.random() - 0.5) * 50 * gk, y, W, hh); } }
    if (cfg.grain) { g.globalAlpha = 0.06; for (let i = 0; i < 300; i++) { g.fillStyle = Math.random() < 0.5 ? '#fff' : '#000'; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); } g.globalAlpha = 1; }
  }
  window.MG_titleScene = titleScene;

  // =============== Mood previews ===============
  const MOODS = {
    premium: { dur: 1.2, ease: 'ease-in-out', stagger: 0.06, pattern: 'left', entrance: 'blur', camera: 'push', palette: 'warm', grain: true, loop: 4.2, text: 'AURA' },
    energetic: { dur: 0.25, ease: 'expo-out', stagger: 0.03, pattern: 'left', entrance: 'slide', camera: 'shake', palette: 'neon', glitch: true, loop: 2.4, text: 'GO HARD' },
    playful: { dur: 0.55, ease: 'back-out', stagger: 0.07, pattern: 'center', entrance: 'pop', camera: 'sway', palette: 'paper', loop: 3.2, text: 'HELLO' },
    technical: { dur: 0.35, ease: 'expo-out', stagger: 0.04, pattern: 'random', entrance: 'mask', camera: 'static', palette: 'mono', loop: 3, text: 'SYSTEM' },
    dreamy: { dur: 1.6, ease: 'ease-in-out', stagger: 0.12, pattern: 'center', entrance: 'fade', camera: 'sway', palette: 'warm', glow: true, grain: true, loop: 5, text: 'DRIFT' },
    cinematic: { dur: 1.0, ease: 'ease-out', stagger: 0.05, pattern: 'left', entrance: 'mask', camera: 'push', palette: 'mono', grain: true, loop: 4.4, text: 'CHAPTER ONE' },
  };
  Object.entries(MOODS).forEach(([k, cfg]) => mount('mood-' + k, (g, t, W, H) => { titleScene(g, W, H, t, cfg); if (k === 'cinematic') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H * 0.12); g.fillRect(0, H * 0.88, W, H * 0.12); } }));

  // =============== "Your words, live" playground ===============
  const PG = {
    feel: { label: 'Feel', opts: { calm: ['Calm', 'calm timing (1.2 s moves)', { dur: 1.2 }], normal: ['Normal', 'normal timing (600 ms moves)', { dur: 0.6 }], snappy: ['Snappy', 'snappy timing (250 ms moves)', { dur: 0.25 }] }, val: 'normal' },
    ease: { label: 'Easing', opts: { 'linear': ['Linear', 'linear easing', { ease: 'linear' }], 'ease-out': ['Ease-out', 'ease-out', { ease: 'ease-out' }], 'ease-in-out': ['Ease-in-out', 'ease-in-out', { ease: 'ease-in-out' }], 'expo-out': ['Expo-out', 'ease-out-expo', { ease: 'expo-out' }], 'back-out': ['Overshoot', 'ease-out-back overshoot', { ease: 'back-out' }], 'elastic': ['Elastic', 'elastic ease-out', { ease: 'elastic' }], 'bounce': ['Bounce', 'bounce ease-out', { ease: 'bounce' }] }, val: 'back-out' },
    stagger: { label: 'Stagger', opts: { none: ['None', 'all letters together', { stagger: 0, pattern: 'none' }], left: ['Left to right', 'letters staggered 50 ms left to right', { stagger: 0.05, pattern: 'left' }], center: ['Center out', 'letters staggered 50 ms from the center out', { stagger: 0.05, pattern: 'center' }], random: ['Random', 'letters staggered in random order', { stagger: 0.05, pattern: 'random' }] }, val: 'left' },
    entrance: { label: 'Entrance', opts: { fade: ['Fade', 'fade in', { entrance: 'fade' }], slide: ['Slide up', 'slide up 60 px', { entrance: 'slide' }], pop: ['Scale pop', 'scale pop', { entrance: 'pop' }], mask: ['Mask reveal', 'rise through a mask', { entrance: 'mask' }], blur: ['Blur in', 'blur in from soft focus', { entrance: 'blur' }] }, val: 'mask' },
    camera: { label: 'Camera', opts: { static: ['Static', 'static camera', { camera: 'static' }], push: ['Slow push-in', 'slow push-in', { camera: 'push' }], shake: ['Shake on landing', 'camera shake when the title lands', { camera: 'shake' }], sway: ['Handheld sway', 'gentle handheld sway', { camera: 'sway' }] }, val: 'push' },
    palette: { label: 'Palette', opts: { warm: ['Warm dark', 'warm dark palette (#0b0b10, coral, amber)', { palette: 'warm' }], paper: ['Light paper', 'cream paper background with navy and coral', { palette: 'paper' }], neon: ['Neon', 'neon magenta and cyan on black', { palette: 'neon' }], mono: ['Mono + red', 'black and white with one red accent', { palette: 'mono' }] }, val: 'warm' },
    fx: { label: 'Finish', opts: { clean: ['Clean', 'no post effects', {}], grain: ['Film grain', 'light film grain', { grain: true }], glow: ['Glow', 'soft glow on the letters', { glow: true }], glitch: ['Glitch hit', 'RGB glitch hit when the title lands', { glitch: true }] }, val: 'grain' },
  };
  let pgChanged = '';
  const pgHost = document.getElementById('pg-controls');
  if (pgHost) {
    Object.entries(PG).forEach(([gk, grp]) => {
      const row = document.createElement('div'); row.className = 'pg-row'; row.innerHTML = `<span>${grp.label}</span>`; const btns = document.createElement('div'); btns.className = 'btns';
      Object.entries(grp.opts).forEach(([ok, [lab]]) => { const b = document.createElement('button'); b.textContent = lab; if (ok === grp.val) b.classList.add('on'); b.onclick = () => { grp.val = ok; pgChanged = gk; btns.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); pgPrompt(); }; btns.appendChild(b); });
      row.appendChild(btns); pgHost.appendChild(row);
    });
    const ti = document.getElementById('pg-text'); if (ti) ti.oninput = () => { pgChanged = 'text'; pgPrompt(); };
  }
  function pgCfg() { const c = { dur: 0.6, ease: 'ease-out', stagger: 0.05, pattern: 'left', entrance: 'mask', camera: 'static', palette: 'warm', loop: 4, text: (document.getElementById('pg-text') || {}).value || 'LAUNCH' }; Object.values(PG).forEach(g => Object.assign(c, g.opts[g.val][2])); c.loop = Math.max(3.4, 0.3 + c.dur + c.stagger * 12 + 1.8 + 0.9); return c; }
  function pgPrompt() {
    const out = document.getElementById('pg-prompt'); if (!out) return; const ph = k => PG[k].opts[PG[k].val][1];
    const parts = [['text', `Title "${pgCfg().text.toUpperCase()}"`], ['entrance', ph('entrance')], ['stagger', ph('stagger')], ['feel', ph('feel')], ['ease', 'with ' + ph('ease')], ['camera', ph('camera')], ['palette', ph('palette')], ['fx', ph('fx')]];
    out.innerHTML = parts.map(([k, s]) => `<span class="${k === pgChanged ? 'hl' : ''}">${s}</span>`).join(', ') + '. Hold 1 s, then exit upward. Show me test frames first.';
  }
  pgPrompt();
  mount('pg-preview', (g, t, W, H) => titleScene(g, W, H, t, pgCfg()));

  // =============== Logo reveal example, played live ===============
  mount('logo-live', (g, t, W, H) => {
    const T = t % 8.6, cx = W / 2, cy = H / 2;
    g.fillStyle = '#0b0b10'; g.fillRect(0, 0, W, H);
    const pop = E('back-out')(seg(T, 0.1, 0.9)), stretch = E('ease-in-out')(seg(T, 1.0, 1.7)), open = E('expo-out')(seg(T, 1.7, 2.3)), exit = E('ease-in')(seg(T, 6.5, 7.3)), fade = seg(T, 7.4, 8.0);
    const lw = lerp(24, 420, stretch) * (1 - exit), lh = lerp(24, 5, stretch) * pop, gap = 70 * open * (1 - exit);
    g.fillStyle = CORAL; const rr = (y) => { g.beginPath(); g.roundRect(cx - lw / 2, y - lh / 2, Math.max(lw, 0.01), Math.max(lh, 0.01), Math.min(lw, lh) / 2); g.fill(); };
    if (T < 7.4) { rr(cy - gap); if (open > 0) rr(cy + gap); }
    g.save(); g.beginPath(); g.rect(0, cy - gap + 3, W, Math.max(0, gap * 2 - 6)); g.clip();
    const word = 'NOVA', track = lerp(0, 14, E('ease-out')(seg(T, 4.0, 6.5))); g.font = '700 96px Bahnschrift'; const ws = [...word].map(c => g.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0) + track * 3; let x = cx - tot / 2;
    [...word].forEach((ch, i) => { const k = E('expo-out')(seg(T, 2.0 + i * 0.045, 2.8 + i * 0.045)), o = E('ease-in')(seg(T, 6.4 + i * 0.04, 6.9 + i * 0.04)); g.fillStyle = CREAM; g.fillText(ch, x, cy + 34 + (1 - k) * 110 - o * 120); x += ws[i] + track; });
    g.restore();
    const sub = 'Launching March 3', n = Math.floor(seg(T, 4.0, 5.2) * sub.length); g.font = '400 20px Consolas'; g.textAlign = 'center'; g.fillStyle = `rgba(236,231,222,${1 - exit})`; g.fillText(sub.slice(0, n), cx, cy + gap + 40); g.textAlign = 'left';
    g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H);
    const marks = [[0, 'dot pops'], [1.0, 'line + split'], [2.0, '"NOVA" rises'], [4.0, 'hold, tracking, subtitle'], [6.5, 'exit'], [7.4, 'fade']];
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, H - 40, W, 40); marks.forEach(([m, lab], i) => { const xx = 16 + m / 8 * (W - 32); g.fillStyle = T >= m && (i === marks.length - 1 || T < marks[i + 1][0]) ? AMBER : DIM; g.font = '11px Consolas'; g.fillText(lab, xx, H - 14); g.fillRect(xx, H - 36, 2, 8); });
    g.fillStyle = '#fff'; g.fillRect(16 + Math.min(T, 8) / 8 * (W - 32) - 1, H - 40, 2, 14);
  });
  void VIOLET; void NAVY;
})();
