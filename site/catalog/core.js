/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Shared runtime for Motion Examples.html.
// EX.add({...}) registers a demo card. Each demo's setup(stage) returns frame(t, dt),
// which the loop calls only while the card is on screen. GPU demos share one WebGL2
// context through EX.G and copy their result into their own 2D canvas.
(function () {
  const EX = (window.EX = /** @type {any} */ ({ cards: [] }));
  EX.C = { bg: '#0b0b10', cream: '#f4efe6', coral: '#ff5a36', amber: '#ffb020', cyan: '#2bc4e6', violet: '#7a5cff', navy: '#1d1b3a', paper: '#efe8dc', green: '#5fd38d' };
  EX.PAL = [EX.C.coral, EX.C.amber, EX.C.cyan, EX.C.violet, EX.C.cream];
  EX.clamp01 = x => Math.min(1, Math.max(0, x));
  EX.lerp = (a, b, t) => a + (b - a) * t;
  EX.seg = (t, a, b) => EX.clamp01((t - a) / (b - a));
  EX.ease = {
    out: x => 1 - Math.pow(1 - x, 3),
    inOut: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    expo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
    back: x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
    inExpo: x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10),
  };
  EX.rng = function (a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

  // 3D value noise in [0,1], smooth enough for flow fields and terrain.
  const P = new Uint8Array(512); { const r = EX.rng(7); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  function grad(h, x, y, z) { const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
  EX.noise = function (x, y, z = 0) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    const L = EX.lerp;
    return 0.5 + 0.5 * L(L(L(grad(P[AA] & 15, x, y, z), grad(P[BA] & 15, x - 1, y, z), u), L(grad(P[AB] & 15, x, y - 1, z), grad(P[BB] & 15, x - 1, y - 1, z), u), v),
      L(L(grad(P[AA + 1] & 15, x, y, z - 1), grad(P[BA + 1] & 15, x - 1, y, z - 1), u), L(grad(P[AB + 1] & 15, x, y - 1, z - 1), grad(P[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
  };

  // ---------- shared WebGL2 ----------
  const G = (EX.G = /** @type {any} */ ({}));
  G.canvas = document.createElement('canvas'); G.canvas.width = 960; G.canvas.height = 540;
  G.gl = G.canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  const gl = G.gl;
  if (gl) {
    G.floatOK = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    G.vao = gl.createVertexArray();
    G.VS = `#version 300 es
const vec2 Q[3]=vec2[](vec2(-1,-1),vec2(3,-1),vec2(-1,3));
out vec2 vUv; void main(){vec2 p=Q[gl_VertexID]; vUv=p*.5+.5; gl_Position=vec4(p,0,1);}`;
    G.HEAD = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform float uT; uniform vec2 uRes;
const float PI=3.14159265;
float hash21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){s+=a*vnoise(p);p=m*p;a*=.5;}return s;}
vec3 pal(float t,vec3 a,vec3 b,vec3 c,vec3 d){return a+b*cos(6.28318*(c*t+d));}
`;
    G.prog = function (fsBody) {
      const p = gl.createProgram();
      const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s) + '\n' + src); } gl.attachShader(p, s); };
      mk(gl.VERTEX_SHADER, G.VS); mk(gl.FRAGMENT_SHADER, G.HEAD + fsBody); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace('[0]', '')] = gl.getUniformLocation(p, a.name); }
      return { p, u };
    };
    // Render target; float targets hold simulation state.
    G.target = function (w, h, float = false, linear = true) {
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      const f = float && G.floatOK;
      gl.texImage2D(gl.TEXTURE_2D, 0, f ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, f ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      const flt = linear ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, flt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, flt);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { tex, fb, w, h };
    };
    G.pingpong = function (w, h, float, linear) { const a = G.target(w, h, float, linear), b = G.target(w, h, float, linear); return { read: a, write: b, swap() { const t = this.read; this.read = this.write; this.write = t; } }; };
    // Draw a program into a target (or the shared canvas when target is null).
    G.draw = function (prog, target, uniforms = {}, w, h) {
      const tw = target ? target.w : w, th = target ? target.h : h;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null); gl.viewport(0, 0, tw, th);
      gl.useProgram(prog.p); let unit = 0;
      for (const [k, v] of Object.entries(uniforms)) {
        const loc = prog.u[k]; if (loc == null) continue;
        if (v && v.tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.tex); gl.uniform1i(loc, unit++); }
        else if (v instanceof WebGLTexture) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v); gl.uniform1i(loc, unit++); }
        else if (typeof v === 'number') gl.uniform1f(loc, v);
        else if (v.length === 2) gl.uniform2fv(loc, v); else if (v.length === 3) gl.uniform3fv(loc, v); else if (v.length === 4) gl.uniform4fv(loc, v);
      }
      if (prog.u.uRes) gl.uniform2f(prog.u.uRes, tw, th);
      gl.bindVertexArray(G.vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    // Copy the bottom-left w x h of the shared canvas into a demo's 2D context.
    G.copy = function (ctx, w, h) { ctx.drawImage(G.canvas, 0, G.canvas.height - h, w, h, 0, 0, w, h); };
    // Simple full-screen shader demo: body defines mainImage-style code writing o.
    G.simple = function (fsBody) {
      return (stage, L) => {
        const ctx = stage.getContext('2d'); const prog = G.prog(fsBody); const st = { mode: 0 };
        if (L) L.state = st;
        // Tweak values become uniforms: L.p.size is sent as uSize.
        const asUniforms = () => { const u = {}; if (L) for (const k in L.p) u['u' + k[0].toUpperCase() + k.slice(1)] = L.p[k]; return u; };
        return t => { G.draw(prog, null, Object.assign({ uT: t, uMode: st.mode }, st.uniforms || {}, asUniforms()), stage.width, stage.height); G.copy(ctx, stage.width, stage.height); };
      };
    };
  }

  // ---------- cards ----------
  const TAG = { CPU: 'cpu', GPU: 'gpu', WEB: 'web', ENGINE: 'engine' };
  EX.add = function (d) { EX.cards.push(d); };
  // Adds tweak sliders (and optionally a templated prompt) to a card registered elsewhere.
  EX.tweak = function (id, params, prompt) { const d = EX.cards.find(c => c.id === id); if (!d) { console.warn('EX.tweak: no card', id); return; } d.params = params; if (prompt) d.prompt = prompt; };
  // Fills {key} placeholders in a prompt with the current tweak values.
  const fill = (txt, d, p) => txt.replace(/\{(\w+)\}/g, (m, k) => { const q = (d.params || []).find(x => x.key === k); if (!q || p[k] === undefined) return m; const dec = q.dec !== undefined ? q.dec : (String(q.step).split('.')[1] || '').length; return (+p[k]).toFixed(dec) + (q.unit || ''); });
  // DOM stages are laid out at 640 x 360; --k scales one down to its card width (site.css, under 1100 px).
  const fitDom = new ResizeObserver(es => es.forEach(e => /** @type {HTMLElement} */ (e.target.firstElementChild).style.setProperty('--k', String(Math.min(1, e.contentRect.width / 640)))));
  EX.build = function () {
    for (const d of EX.cards) {
      const host = document.getElementById('cat-' + d.cat); if (!host) continue;
      const card = document.createElement('article'); card.className = 'ex'; card.id = 'ex-' + d.id; card.dataset.search = (d.title + ' ' + d.aka + ' ' + d.tool + ' ' + d.cat).toLowerCase();
      const w = d.w || 640, h = d.h || 360;
      let stage;
      if (d.kind === 'dom') { stage = document.createElement('div'); stage.className = 'domstage'; }
      else if (d.kind === 'video') { stage = document.createElement('video'); stage.muted = true; stage.loop = true; stage.playsInline = true; stage.dataset.src = d.src; }
      else { stage = document.createElement('canvas'); stage.width = w; stage.height = h; }
      const sw = document.createElement('div'); sw.className = 'stagewrap'; sw.appendChild(stage); card.appendChild(sw); if (d.kind === 'dom') fitDom.observe(sw);
      const L = { el: stage, vis: false, t: 0, started: false, d, frame: null, speed: 1, paused: false, acc: 0, p: {} };
      (d.params || []).forEach(q => { L.p[q.key] = q.value; });
      // Playback bar: pause, replay, speed; plus a Tweak toggle when the demo has its own parameters.
      const bar = document.createElement('div'); bar.className = 'tweakbar';
      bar.innerHTML = `<button class="tb-pause">Pause</button><button class="tb-replay">Replay</button><label class="tb-speed">Speed <input type="range" min="0.25" max="3" step="0.25" value="1"><b>1x</b></label>${d.params ? '<button class="tb-tweak">Tweak</button>' : ''}${d.kind === 'video' && d.audio ? '<button class="tb-sound">Sound</button>' : ''}`;
      card.appendChild(bar);
      const pauseB = /** @type {HTMLButtonElement} */ (bar.querySelector('.tb-pause'));
      pauseB.onclick = () => { L.paused = !L.paused; pauseB.textContent = L.paused ? 'Play' : 'Pause'; pauseB.classList.toggle('on', L.paused); if (d.kind === 'video') L.paused ? stage.pause() : stage.play().catch(() => {}); };
      /** @type {HTMLButtonElement} */ (bar.querySelector('.tb-replay')).onclick = () => { L.t = 0; L.acc = 0; if (d.kind === 'video') { stage.currentTime = 0; return; } if (!L.started) return; if (d.kind === 'dom') stage.innerHTML = ''; try { L.frame = d.setup(stage, L); } catch (err) { console.error(d.id, err); } };
      const sp = /** @type {HTMLInputElement} */ (bar.querySelector('.tb-speed input')), spL = bar.querySelector('.tb-speed b');
      // Clips with a soundtrack start muted; the Sound button unmutes this one video.
      const soundB = /** @type {HTMLButtonElement} */ (bar.querySelector('.tb-sound'));
      if (soundB) soundB.onclick = () => { const v = /** @type {HTMLVideoElement} */ (stage); v.muted = !v.muted; soundB.classList.toggle('on', !v.muted); soundB.textContent = v.muted ? 'Sound' : 'Sound on'; };
      sp.oninput = () => { L.speed = +sp.value; spL.textContent = L.speed + 'x'; if (d.kind === 'video') stage.playbackRate = L.speed; };
      let panel = null;
      if (d.params) {
        panel = document.createElement('div'); panel.className = 'tweakpanel'; panel.hidden = true;
        d.params.forEach(q => {
          const row = document.createElement('label'); row.innerHTML = `<span>${q.label}</span><input type="range" min="${q.min}" max="${q.max}" step="${q.step}" value="${q.value}"><b></b>`;
          const inp = row.querySelector('input'), out = row.querySelector('b');
          const show = () => { out.textContent = fill('{' + q.key + '}', d, L.p); };
          inp.oninput = () => { L.p[q.key] = +inp.value; show(); promptSpan.textContent = fill(d.prompt, d, L.p); if (q.restart && L.started) /** @type {HTMLButtonElement} */ (bar.querySelector('.tb-replay')).click(); };
          show(); panel.appendChild(row);
        });
        const reset = document.createElement('button'); reset.textContent = 'Reset values'; reset.onclick = () => { panel.querySelectorAll('input').forEach((inp, i) => { inp.value = d.params[i].value; inp.oninput(); }); }; panel.appendChild(reset);
        card.appendChild(panel);
        /** @type {HTMLButtonElement} */ (bar.querySelector('.tb-tweak')).onclick = e => { panel.hidden = !panel.hidden; /** @type {HTMLElement} */ (e.target).classList.toggle('on', !panel.hidden); };
      }
      if (d.controls) {
        const row = document.createElement('div'); row.className = 'ctl';
        d.controls.forEach(c => { const b = document.createElement('button'); b.textContent = c.label; if (c.on) b.classList.add('on'); b.onclick = () => { if (c.group !== false) row.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); c.fn(L); }; row.appendChild(b); });
        card.appendChild(row);
      }
      const info = document.createElement('div'); info.className = 'info';
      info.innerHTML = `<h3>${d.title}</h3><div class="aka">Also called: ${d.aka}</div>
        <div class="tags"><span class="tag ${TAG[d.runs] || 'cpu'}">${d.runs}</span><span class="tool">${d.tool}</span></div>
        <p>${d.notice}</p>${d.use ? `<p class="use"><b>Good for:</b> ${d.use}</p>` : ''}
        <div class="say"><button class="copy">Copy</button><span></span></div>`;
      const promptSpan = info.querySelector('.say span'); promptSpan.textContent = fill(d.prompt, d, L.p);
      /** @type {HTMLButtonElement} */ (info.querySelector('.copy')).onclick = e => { navigator.clipboard.writeText(promptSpan.textContent); /** @type {HTMLElement} */ (e.target).textContent = 'Copied'; setTimeout(() => /** @type {HTMLElement} */ (e.target).textContent = 'Copy', 1200); };
      card.appendChild(info); host.appendChild(card);
      EX.loops.push(L);
      io.observe(stage);
    }
    document.querySelectorAll('section.cat').forEach(sec => { const n = sec.querySelectorAll('article.ex').length; const h = sec.querySelector('h2'); if (h && n) { const c = document.createElement('span'); c.className = 'count'; c.textContent = n + (n === 1 ? ' example' : ' examples'); h.appendChild(c); } });
  };
  EX.loops = [];
  const io = new IntersectionObserver(es => es.forEach(e => {
    const L = EX.loops.find(l => l.el === e.target); if (!L) return; L.vis = e.isIntersecting;
    if (L.vis && !L.started) {
      L.started = true;
      if (L.d.kind === 'video') { L.el.src = L.el.dataset.src; L.el.playbackRate = L.speed; }
      else { try { L.frame = L.d.setup(L.el, L); } catch (err) { console.error(L.d.id, err); } }
    }
    if (L.d.kind === 'video') { if (L.vis && !L.paused) L.el.play().catch(() => {}); else L.el.pause(); }
  }), { rootMargin: '100px', threshold: 0.01 });
  let last = performance.now();
  // Demos marked stepped advance one simulation step per call, so speed changes how many calls run per frame.
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const L of EX.loops) {
      if (!L.vis || !L.frame || L.paused) continue;
      try {
        if (L.d.stepped) { L.acc += L.speed; while (L.acc >= 1) { L.acc -= 1; L.t += dt; L.frame(L.t, dt); } }
        else { L.t += dt * L.speed; L.frame(L.t, dt * L.speed); }
      } catch (err) { console.error(L.d.id, err); L.frame = null; }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
