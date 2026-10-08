// App and web UI motion, set 2: glass, morphing pills, gestures, button states, CSS scroll timelines.
// Every card plays a demo loop on its own and hands control to the mouse while the user interacts.
(function () {
  const { C, seg, lerp, ease, clamp01 } = EX;
  const W = 640, H = 360;
  // Maps a pointer event to stage pixels (the stage is always 640x360 but may be scaled by CSS).
  const local = (el, e) => { const r = el.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
  // Damped spring toward s.to: call once per frame; stiffness k and damping c as in Framer Motion.
  const spring = (s, k, c, dt) => { const n = Math.ceil(dt / 0.008); const h = dt / n; for (let i = 0; i < n; i++) { s.v += ((s.to - s.x) * k - s.v * c) * h; s.x += s.v * h; } return s.x; };
  const sp = (x) => ({ x, v: 0, to: x });

  // Paints album cover art number k (0 to 7) as an s x s rounded square; shared by the glass page and the cover flow.
  function paintCover(g, x, y, s, k) {
    g.save(); g.beginPath(); g.roundRect(x, y, s, s, 12); g.clip();
    const P = [C.coral, C.amber, C.cyan, C.violet, C.green, C.cream];
    if (k === 0) { const l = g.createLinearGradient(x, y, x, y + s); l.addColorStop(0, C.amber); l.addColorStop(1, C.coral); g.fillStyle = l; g.fillRect(x, y, s, s); g.fillStyle = '#140806'; g.font = `800 ${s * 0.42}px Bahnschrift`; g.fillText('SUN', x + 10, y + s - 14); }
    else if (k === 1) { g.fillStyle = C.navy; g.fillRect(x, y, s, s); g.strokeStyle = C.cyan; g.lineWidth = 7; for (let i = -s; i < s * 2; i += 18) { g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i + s, y + s); g.stroke(); } }
    else if (k === 2) { g.fillStyle = C.violet; g.fillRect(x, y, s, s); for (let r = s * 0.7; r > 4; r -= 12) { g.strokeStyle = r % 24 < 12 ? C.cream : C.coral; g.lineWidth = 5; g.beginPath(); g.arc(x + s * 0.5, y + s * 0.5, r, 0, 7); g.stroke(); } }
    else if (k === 3) { for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { g.fillStyle = (i + j) % 2 ? C.cream : C.coral; g.fillRect(x + i * s / 6, y + j * s / 6, s / 6 + 1, s / 6 + 1); } }
    else if (k === 4) { g.fillStyle = '#0f2a1f'; g.fillRect(x, y, s, s); for (let i = 0; i < 9; i++) { const h = s * (0.25 + 0.6 * Math.abs(Math.sin(i * 1.7))); g.fillStyle = C.green; g.fillRect(x + 8 + i * (s - 16) / 9, y + s - h, (s - 16) / 9 - 4, h); } }
    else if (k === 5) { const l = g.createLinearGradient(x, y, x, y + s); l.addColorStop(0, '#2a1650'); l.addColorStop(1, '#ff3d7f'); g.fillStyle = l; g.fillRect(x, y, s, s); g.fillStyle = C.amber; g.beginPath(); g.arc(x + s / 2, y + s * 0.62, s * 0.3, Math.PI, 0); g.fill(); g.fillStyle = '#2a1650'; for (let i = 0; i < 5; i++) g.fillRect(x, y + s * 0.42 + i * i * 2.2 + i * 4, s, 2 + i * 0.6); g.fillRect(x, y + s * 0.62, s, s); g.strokeStyle = '#ff3d7f'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x, y + s * 0.66 + i * i * 2.4); g.lineTo(x + s, y + s * 0.66 + i * i * 2.4); g.stroke(); } }
    else if (k === 6) { g.fillStyle = C.cream; g.fillRect(x, y, s, s); for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { g.fillStyle = P[(i * 3 + j) % 4]; g.beginPath(); g.arc(x + 10 + i * (s - 20) / 6, y + 10 + j * (s - 20) / 6, 3 + ((i + j) % 3) * 1.5, 0, 7); g.fill(); } }
    else { g.fillStyle = '#111'; g.fillRect(x, y, s, s); g.fillStyle = C.cyan; g.font = `800 ${s * 0.62}px Bahnschrift`; g.textAlign = 'center'; g.fillText('88', x + s / 2, y + s * 0.72); g.textAlign = 'left'; g.fillStyle = C.coral; g.fillRect(x, y + s - 12, s, 12); }
    g.restore();
  }
  const ALBUMS = [['Solar flare', 'Amber Lane'], ['Night drive', 'The Cyan Kids'], ['Orbitals', 'Violet Hour'], ['Checkmate', 'Paper Planes'], ['Low end', 'Greenroom'], ['Horizon', 'Synth Club'], ['Dot matrix', 'Pixel Choir'], ['Eighty-eight', 'Neon Keys']];

  // ---------------- liquid glass lens ----------------
  // Draws the scrolling music-app page once into a 2D canvas; the shader samples it as a repeating texture.
  function drawGlassPage(S) {
    const PW = 640, PH = 720, cv = document.createElement('canvas'); cv.width = PW * S; cv.height = PH * S;
    const g = cv.getContext('2d'); g.scale(S, S);
    const bgr = g.createLinearGradient(0, 0, 0, PH); bgr.addColorStop(0, '#0e0d18'); bgr.addColorStop(0.5, '#151330'); bgr.addColorStop(1, '#0e0d18');
    g.fillStyle = bgr; g.fillRect(0, 0, PW, PH);
    const cover = (x, y, s2, k) => paintCover(g, x, y, s2, k);
    const titles = ALBUMS;
    const row = (y, from) => { for (let i = 0; i < 4; i++) { const x = 28 + i * 150, k = from + i; cover(x, y, 132, k); g.fillStyle = C.cream; g.font = '600 14px Segoe UI'; g.fillText(titles[k][0], x, y + 154); g.fillStyle = '#8a87a0'; g.font = '13px Segoe UI'; g.fillText(titles[k][1], x, y + 172); } };
    g.fillStyle = C.cream; g.font = '700 30px Bahnschrift'; g.fillText('Listen now', 28, 52);
    g.fillStyle = '#8a87a0'; g.font = '14px Segoe UI'; g.fillText('Picked for you, updated every morning', 30, 74);
    row(92, 0);
    g.fillStyle = C.cream; g.font = '700 21px Bahnschrift'; g.fillText('Top charts', 28, 312);
    const songs = ['Glass houses', 'Refraction', 'Slow honey', 'Paper moon', 'Run it back'];
    songs.forEach((s, i) => {
      const y = 330 + i * 30;
      g.fillStyle = '#5a5872'; g.font = '700 14px Bahnschrift'; g.fillText(String(i + 1), 30, y + 19);
      g.fillStyle = [C.coral, C.cyan, C.amber, C.violet, C.green][i]; g.beginPath(); g.roundRect(52, y + 4, 22, 22, 5); g.fill();
      g.fillStyle = C.cream; g.font = '600 14px Segoe UI'; g.fillText(s, 86, y + 19);
      g.fillStyle = '#8a87a0'; g.font = '13px Segoe UI'; g.fillText(titles[(i * 3) % 8][1], 250, y + 19); g.fillText(`${2 + i % 3}:${String(10 + i * 7).padStart(2, '0')}`, 580, y + 19);
      g.fillStyle = '#25233c'; g.fillRect(52, y + 29, 560, 1);
    });
    g.fillStyle = C.cream; g.font = '700 21px Bahnschrift'; g.fillText('New releases', 28, 506);
    row(518, 4);
    return cv;
  }
  let glassTex = null;

  EX.add({
    cat: 'ui', id: 'ui2-glass', title: 'Liquid glass lens', aka: 'liquid glass, refractive glass UI, magnifier lens, glassmorphism with real refraction', tool: 'WebGL2 fragment shader (SDF refraction) over a Canvas 2D page', runs: 'GPU',
    notice: 'A glass lens and a glass tab bar float over a scrolling music app. Both are signed distance fields: the edge bends the page behind it, the center magnifies, red and blue split at the rim, and a smooth minimum melts the lens into the bar when they touch. Move the mouse over it to steer the lens; press to swell it.',
    use: 'modern app chrome (tab bars, toolbars, controls), hero sections, product UI showcases',
    params: [{ key: 'refr', label: 'Edge refraction', min: 0, max: 40, step: 1, value: 18, unit: ' px' }, { key: 'zoom', label: 'Magnification', min: 1, max: 2, step: 0.05, value: 1.35, unit: 'x' }, { key: 'ca', label: 'Chromatic edge', min: 0, max: 0.6, step: 0.02, value: 0.22 }, { key: 'merge', label: 'Liquid merge', min: 1, max: 80, step: 1, value: 42, unit: ' px' }],
    prompt: 'Liquid glass UI in WebGL: a round glass lens (radius 62 px) and a pill tab bar float over a slowly scrolling music app. Signed distance fields, edge refraction {refr} sampling outward like thick glass, center magnification {zoom}, chromatic split {ca} at the rim, specular rim light from the top left, soft drop shadow. The lens follows the cursor on a spring, stretches along its velocity, and melts into the tab bar with a smooth minimum of {merge}.',
    setup(cv, L) {
      const G = EX.G, gl = G.gl, ctx = cv.getContext('2d');
      if (!gl) { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); return () => {}; }
      if (!glassTex) {
        glassTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, glassTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, drawGlassPage(2));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      }
      const prog = G.prog(`uniform sampler2D uPage; uniform float uScroll,uRefr,uZoom,uCa,uMerge; uniform vec4 uLens,uStr,uBar;
float sdBox(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.)/k;return min(a,b)-h*h*k*.25;}
float dLens(vec2 p){vec2 q=p-uLens.xy;vec2 r=vec2(dot(q,uStr.xy),dot(q,vec2(-uStr.y,uStr.x)))/vec2(1.+uStr.z,1.-uStr.z*.45);return (length(r)-uLens.z)*(1.-uStr.z*.45);}
float dBar(vec2 p){return sdBox(p-uBar.xy,uBar.zw,uBar.w);}
float sdf(vec2 p){return smin(dLens(p),dBar(p),uMerge);}
vec3 pg(vec2 p){return texture(uPage,vec2(p.x/640.,(p.y+uScroll)/720.)).rgb;}
void main(){
  vec2 p=vec2(vUv.x*640.,(1.-vUv.y)*360.);
  float d=sdf(p);
  vec3 bg=pg(p);
  float sh=sdf(p-vec2(0.,9.));
  bg*=1.-.42*exp(-max(sh,0.)/13.)*smoothstep(-2.,2.,d);
  vec3 col=bg;
  if(d<2.){
    vec2 e=vec2(1.,0.);
    vec2 gr=normalize(vec2(sdf(p+e.xy)-sdf(p-e.xy),sdf(p+e.yx)-sdf(p-e.yx))+1e-6);
    float depth=clamp(-d/24.,0.,1.),rim=1.-depth;rim*=rim;
    float dl=dLens(p),db=dBar(p);
    float wl=clamp(.5+(db-dl)/(2.*uMerge+2.),0.,1.);
    vec2 c=uLens.xy;
    vec2 q=p-(p-c)*(1.-1./uZoom)*wl*smoothstep(0.,.5,depth);
    vec2 off=gr*uRefr*rim;
    vec3 g;
    g.r=pg(q+off*(1.+uCa)).r; g.g=pg(q+off).g; g.b=pg(q+off*(1.-uCa)).b;
    float fb=1.-wl;
    if(fb>.01){vec3 s=vec3(0.);for(int i=0;i<8;i++){float a=float(i)*.785;s+=pg(q+off+vec2(cos(a),sin(a))*5.).rgb;}g=mix(g,s/8.,fb*.85);g=mix(g,vec3(.06,.06,.1),fb*.32);}
    g=mix(g,vec3(1.),.05+.1*rim);
    float band=smoothstep(-4.,-.5,d)*(1.-smoothstep(-.5,1.2,d));
    float li=pow(abs(dot(gr,normalize(vec2(-.62,-.78)))),3.);
    g+=band*(.18+.95*li)+ .12*rim*max(0.,-gr.y);
    col=mix(bg,g,clamp(.5-d,0.,1.));
  }
  o=vec4(col,1.);
}`);
      const lens = { x: 200, y: 140, vx: 0, vy: 0, r: 62, vr: 0, tr: 62 };
      const U = { uPage: glassTex, uScroll: 0, uRefr: 0, uZoom: 1, uCa: 0, uMerge: 1, uLens: [0, 0, 62, 0], uStr: [1, 0, 0, 0], uBar: [320, 316, 150, 25] };
      let mouse = null;
      cv.onpointermove = e => { mouse = Object.assign(local(cv, e), { t: performance.now() }); };
      cv.onpointerleave = () => { mouse = null; };
      cv.onpointerdown = e => { mouse = Object.assign(local(cv, e), { t: performance.now() }); lens.tr = 84; };
      cv.onpointerup = () => { lens.tr = 62; };
      cv.style.cursor = 'none';
      const icons = ['home', 'search', 'library', 'profile'];
      const icon = (k, x, y, on) => {
        ctx.strokeStyle = on ? C.coral : 'rgba(244,239,230,0.85)'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
        if (k === 'home') { ctx.moveTo(x - 9, y - 1); ctx.lineTo(x, y - 9); ctx.lineTo(x + 9, y - 1); ctx.moveTo(x - 6, y - 3); ctx.lineTo(x - 6, y + 7); ctx.lineTo(x + 6, y + 7); ctx.lineTo(x + 6, y - 3); }
        else if (k === 'search') { ctx.arc(x - 2, y - 2, 6.5, 0, 7); ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + 8, y + 8); }
        else if (k === 'library') { ctx.roundRect(x - 9, y - 8, 5, 16, 1.5); ctx.roundRect(x - 2, y - 8, 5, 16, 1.5); ctx.moveTo(x + 5, y - 6); ctx.lineTo(x + 10, y + 7); }
        else { ctx.arc(x, y - 4, 4.5, 0, 7); ctx.moveTo(x - 8, y + 9); ctx.quadraticCurveTo(x, y - 2, x + 8, y + 9); }
        ctx.stroke();
      };
      return (t, dt) => {
        const live = mouse && performance.now() - mouse.t < 2500;
        const tx = live ? mouse.x : 320 + 235 * Math.sin(t * 0.47), ty = live ? mouse.y : 150 + 100 * Math.sin(t * 0.83 + 0.6);
        const k = Math.min(dt, 1 / 30);
        lens.vx += ((tx - lens.x) * 90 - lens.vx * 13) * k; lens.vy += ((ty - lens.y) * 90 - lens.vy * 13) * k;
        lens.x += lens.vx * k; lens.y += lens.vy * k;
        lens.vr += ((lens.tr - lens.r) * 260 - lens.vr * 14) * k; lens.r += lens.vr * k;
        const sp = Math.hypot(lens.vx, lens.vy);
        U.uScroll = (t * 16) % 720; U.uRefr = L.p.refr; U.uZoom = L.p.zoom; U.uCa = L.p.ca; U.uMerge = L.p.merge;
        U.uLens[0] = lens.x; U.uLens[1] = lens.y; U.uLens[2] = lens.r;
        U.uStr[0] = sp > 1 ? lens.vx / sp : 1; U.uStr[1] = sp > 1 ? lens.vy / sp : 0; U.uStr[2] = Math.min(0.32, sp * 0.0007);
        G.draw(prog, null, U, W, H); G.copy(ctx, W, H);
        const sel = Math.floor(t / 2.2) % 4;
        icons.forEach((k2, i) => icon(k2, 320 - 111 + i * 74, 316, i === sel));
      };
    },
  });

  // ---------------- dynamic island ----------------
  const handset = '<svg viewBox="0 0 24 24" width="22" height="22"><path fill="#fff" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';
  EX.add({
    cat: 'ui', id: 'ui2-island', kind: 'dom', title: 'Dynamic Island morph', aka: 'live activity pill, morphing notch, expanding status pill', tool: 'DOM + JavaScript spring physics (width, height, radius)', runs: 'WEB',
    notice: 'A black pill at the top of a phone grows into a call banner, a music player and a timer. Width, height and corner radius each ride their own spring, so the shape overshoots and settles, and the content fades in only after the shape has mostly landed. The album art is one element that moves and grows between the small and the large player. Click the island, or use the buttons.',
    use: 'live activities, status and call banners, now-playing widgets, any compact UI that expands in place',
    params: [{ key: 'stiff', label: 'Spring stiffness', min: 60, max: 500, step: 10, value: 230 }, { key: 'damp', label: 'Spring damping', min: 6, max: 40, step: 1, value: 19 }],
    prompt: 'Dynamic Island style morph: a black pill (120 x 34 px) at the top of a phone springs into an incoming-call banner (396 x 76), a compact then expanded music player (396 x 176) and a timer that splits off a small bubble. Width, height and radius use springs (stiffness {stiff}, damping {damp}); content crossfades with a slight blur and scale 150 ms after the shape moves; album art is a shared element between compact and expanded. Clicking the pill expands or collapses it.',
    controls: [{ label: 'Call', group: false, fn: L => L.state.go('call') }, { label: 'Music', group: false, fn: L => L.state.go('musicX') }, { label: 'Timer', group: false, fn: L => L.state.go('timer') }],
    setup(st, L) {
      const css = `<style>
.u2i-ph{position:absolute;left:96px;top:16px;width:448px;height:440px;border-radius:62px;background:#050507;box-shadow:0 0 0 2px #2a2a33,0 30px 60px rgba(0,0,0,.6)}
.u2i-sc{position:absolute;inset:9px;border-radius:54px;overflow:hidden;background:radial-gradient(120% 90% at 20% 10%,#7a5cff 0%,#3b2a8a 35%,#1d1b3a 60%,#0b0b10 100%)}
.u2i-sc:before{content:'';position:absolute;width:300px;height:300px;right:-80px;top:120px;border-radius:50%;background:radial-gradient(circle,#ff5a36cc,#ff5a3600 70%)}
.u2i-sb{position:absolute;top:18px;left:42px;right:40px;display:flex;justify-content:space-between;font:600 16px Segoe UI;color:#fff}
.u2i-bat{width:26px;height:12px;border:1.5px solid #fff9;border-radius:4px;position:relative;margin-top:3px}.u2i-bat:after{content:'';position:absolute;inset:1.5px;right:7px;background:#fff;border-radius:2px}
.u2i-date{position:absolute;top:96px;width:100%;text-align:center;font:600 17px Segoe UI;color:#fffc}
.u2i-clk{position:absolute;top:110px;width:100%;text-align:center;font:600 96px Bahnschrift;color:#fff;letter-spacing:-2px}
.u2i-hint{position:absolute;top:258px;width:100%;text-align:center;font:13px Segoe UI;color:#fff8}
.u2i-isl{position:absolute;top:38px;left:320px;transform-origin:50% 0;background:#000;overflow:hidden;cursor:pointer}
.u2i-c{position:absolute;inset:0;opacity:0;font-family:Segoe UI;color:#fff}
.u2i-av{position:absolute;left:14px;top:13px;width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,#ffb020,#ff5a36);font:700 20px Bahnschrift;color:#140806;display:flex;align-items:center;justify-content:center}
.u2i-btn{position:absolute;top:16px;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.u2i-art{position:absolute;background:linear-gradient(160deg,#2bc4e6,#1d1b3a 55%,#7a5cff);overflow:hidden}
.u2i-art:after{content:'';position:absolute;left:15%;top:20%;width:70%;height:70%;border-radius:50%;border:3px solid #ffb020;opacity:.9}
.u2i-bars{position:absolute;display:flex;gap:3px;align-items:center;height:20px;transform-origin:right center}.u2i-bars i{width:3px;border-radius:2px;background:#ff5a36}
.u2i-pr{position:absolute;left:22px;right:22px;top:104px;height:5px;border-radius:3px;background:#ffffff30}.u2i-pr i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:#fff}
.u2i-tm{position:absolute;top:116px;font:12px Segoe UI;color:#fff9}
.u2i-ctl{position:absolute;top:128px;left:0;right:0;display:flex;justify-content:center;gap:46px;align-items:center}
.u2i-bub{position:absolute;top:38px;width:34px;height:34px;border-radius:50%;background:#000;display:flex;align-items:center;justify-content:center}
</style>`;
      const tri = (flip) => `<svg width="30" height="20" viewBox="0 0 30 20" style="transform:scaleX(${flip})"><path fill="#fff" d="M2 10 15 2v16zM15 10 28 2v16z"/></svg>`;
      st.innerHTML = css + `<div class="u2i-ph"><div class="u2i-sc"><div class="u2i-sb"><span class="u2i-st">9:41</span><span class="u2i-st" style="display:flex;gap:6px;font-size:13px">5G <i class="u2i-bat"></i></span></div>
        <div class="u2i-date">Thursday, October 8</div><div class="u2i-clk">9:41</div><div class="u2i-hint">Click the island</div></div></div>
        <div class="u2i-isl">
          <div class="u2i-c" data-k="call"><div class="u2i-av">MC</div><div style="position:absolute;left:76px;top:16px"><div style="font-size:13px;color:#fff9">mobile</div><div style="font:600 18px Segoe UI">Mia Chen</div></div>
            <div class="u2i-btn" style="right:70px;background:#ff3b30"><span style="transform:rotate(135deg);display:flex">${handset}</span></div><div class="u2i-btn" style="right:14px;background:#34c759">${handset}</div></div>
          <div class="u2i-c" data-k="mus"><div class="u2i-art"></div><div class="u2i-bars">${'<i></i>'.repeat(5)}</div></div>
          <div class="u2i-c" data-k="musX"><div style="position:absolute;left:100px;top:26px"><div style="font:600 17px Segoe UI">Night drive</div><div style="font-size:14px;color:#fff9">The Cyan Kids</div></div>
            <div class="u2i-pr"><i></i></div><div class="u2i-tm" style="left:22px">1:12</div><div class="u2i-tm" style="right:22px">-2:31</div>
            <div class="u2i-ctl">${tri(1)}<svg width="22" height="24"><rect x="2" y="1" width="6" height="22" rx="2" fill="#fff"/><rect x="14" y="1" width="6" height="22" rx="2" fill="#fff"/></svg>${tri(-1)}</div></div>
          <div class="u2i-c" data-k="tim"><svg style="position:absolute;left:9px;top:7px" width="20" height="20"><circle cx="10" cy="10" r="8" fill="none" stroke="#ff9f0a" stroke-width="2.5"/><path d="M10 5v5l3 2" stroke="#ff9f0a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
            <div class="u2i-cd" style="position:absolute;right:12px;top:5px;font:600 17px Bahnschrift;color:#ff9f0a">4:59</div></div>
        </div>
        <div class="u2i-bub"><svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8.5" fill="none" stroke="#ff9f0a44" stroke-width="3"/><circle class="u2i-ring" cx="11" cy="11" r="8.5" fill="none" stroke="#ff9f0a" stroke-width="3" stroke-dasharray="53.4" stroke-linecap="round" transform="rotate(-90 11 11)"/></svg></div>`;
      const q = s => /** @type {HTMLElement} */ (st.querySelector(s));
      const isl = q('.u2i-isl'), bub = q('.u2i-bub'), art = q('.u2i-art'), bars = q('.u2i-bars'), barI = Array.from(bars.children).map(e => /** @type {HTMLElement} */ (e));
      const prog = /** @type {HTMLElement} */ (q('.u2i-pr').firstElementChild), cd = q('.u2i-cd'), ring = q('.u2i-ring'), sts = [...st.querySelectorAll('.u2i-st')].map(e => /** @type {HTMLElement} */ (e));
      const cont = /** @type {Record<string, any>} */ ({}); st.querySelectorAll('.u2i-c').forEach(e => { cont[/** @type {HTMLElement} */ (e).dataset.k] = { el: e, op: 0 }; });
      const SIZE = { idle: [120, 34, 17], call: [396, 76, 38], music: [230, 34, 17], musicX: [396, 176, 46], timer: [176, 34, 17] };
      const SHOW = { idle: [], call: ['call'], music: ['mus'], musicX: ['mus', 'musX'], timer: ['tim'] };
      const PLAN = [['idle', 1.0], ['call', 2.6], ['idle', 0.7], ['music', 1.5], ['musicX', 3.0], ['music', 1.0], ['timer', 2.6], ['idle', 0.6]];
      const LOOP = PLAN.reduce((a, b) => a + +b[1], 0);
      const w = sp(120), h = sp(34), r = sp(17), b = sp(0), s = sp(1);
      let state = 'idle', since = 0, manualAt = -1e9, now = 0, hover = false;
      const go = (k) => { if (k !== state) { state = k; since = now; } };
      L.state = { go: k => { manualAt = now; go(k); } };
      isl.onpointerenter = () => { hover = true; }; isl.onpointerleave = () => { hover = false; s.to = 1; };
      isl.onpointerdown = () => { s.to = 0.94; };
      isl.onpointerup = () => { s.to = 1.04; manualAt = now; go({ idle: 'music', music: 'musicX', musicX: 'music', call: 'idle', timer: 'idle' }[state]); };
      return (t, dt) => {
        now = t;
        if (t - manualAt > 6) { let lt = t % LOOP, k = 'idle'; for (const [n, d] of PLAN) { if (lt < +d) { k = String(n); break; } lt -= +d; } go(k); }
        const [tw, th, tr] = SIZE[state]; w.to = tw; h.to = th; r.to = tr; b.to = state === 'timer' ? 1 : 0;
        if (s.to !== 0.94) s.to = hover ? (h.to > 50 ? 1.015 : 1.05) : 1;
        const K = L.p.stiff, D = L.p.damp;
        const ww = spring(w, K, D, dt), hh = Math.max(20, spring(h, K, D, dt)), rr = Math.min(hh / 2, spring(r, K, D, dt)), bb = spring(b, K * 0.8, D * 0.8, dt), ss = spring(s, 400, 20, dt);
        isl.style.width = ww + 'px'; isl.style.height = hh + 'px'; isl.style.borderRadius = rr + 'px';
        isl.style.transform = `translateX(-50%) scale(${ss})`; isl.style.boxShadow = hh > 50 ? '0 14px 34px rgba(0,0,0,.45)' : 'none';
        bub.style.left = (320 + ww / 2 * ss + lerp(-30, 8, bb)) + 'px'; bub.style.transform = `scale(${lerp(0.3, 1, clamp01(bb))})`; bub.style.opacity = bb > 0.05 ? '1' : '0';
        sts.forEach((e, i) => { e.style.opacity = String(clamp01((300 - ww) / 70) * (i ? 1 - clamp01(bb) : 1)); });
        const age = t - since, show = SHOW[state];
        for (const k in cont) { const c = cont[k]; c.op = show.includes(k) ? (age > 0.15 ? Math.min(1, c.op + dt / 0.22) : c.op) : Math.max(0, c.op - dt / 0.1); const e = ease.out(c.op); c.el.style.opacity = String(e); c.el.style.filter = e < 0.99 ? `blur(${(1 - e) * 5}px)` : 'none'; c.el.style.transform = `scale(${0.9 + 0.1 * e})`; }
        cont.mus.el.style.transform = 'none';
        const p = clamp01((hh - 34) / 142);
        const as = lerp(22, 64, p); art.style.left = lerp(7, 22, p) + 'px'; art.style.top = lerp(6, 22, p) + 'px'; art.style.width = art.style.height = as + 'px'; art.style.borderRadius = lerp(6, 14, p) + 'px';
        bars.style.right = lerp(12, 26, p) + 'px'; bars.style.top = lerp(7, 34, p) + 'px'; bars.style.transform = `scale(${lerp(1, 1.5, p)})`;
        barI.forEach((e, i) => { e.style.height = (4 + 14 * Math.abs(Math.sin(t * (5 + i * 1.3) + i * 2))) + 'px'; });
        prog.style.width = (32 + (t * 2) % 30) + '%';
        const left = 300 - ((t * 1) % 300); cd.textContent = Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0');
        ring.setAttribute('stroke-dashoffset', String(53.4 * (1 - left / 300)));
      };
    },
  });

  // ---------------- swipe card deck ----------------
  const SCENES = /** @type {[string, string, string, string, string, string, string[]][]} */ ([
    ['Kyoto', 'Japan, 9 nights', 'linear-gradient(#ff8a5c,#ffb020 60%,#ffd9a0)', '#ffe9c2', '#7a2f3a', '#3a1630', ['Temples', 'Rail']],
    ['Reykjavik', 'Iceland, 6 nights', 'linear-gradient(#0b0b2a,#1d1b3a 55%,#2b4a6a)', '#e8f6ff', '#2a3550', '#0f1424', ['Aurora', 'Hot springs']],
    ['Marrakesh', 'Morocco, 5 nights', 'linear-gradient(#ffcf7a,#ff7a45 70%)', '#fff2c8', '#c4502b', '#7a2a18', ['Souks', 'Desert']],
    ['Patagonia', 'Chile, 12 nights', 'linear-gradient(#9fe6ff,#2bc4e6 60%,#d9f6ff)', '#ffffff', '#3b5b7a', '#1f2f45', ['Hiking', 'Glaciers']],
    ['Lisbon', 'Portugal, 4 nights', 'linear-gradient(#ffd6e0,#ff9f9f 50%,#ffcf7a)', '#fff8e6', '#b24a5e', '#5a2140', ['Trams', 'Coast']],
  ]);
  const heart = '<svg viewBox="0 0 24 24" width="26" height="26"><path fill="#5fd38d" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.2 0 3.9 1.2 5.4 3.1 1.5-1.9 3.2-3.1 5.4-3.1 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z"/></svg>';
  EX.add({
    cat: 'ui', id: 'ui2-swipe', kind: 'dom', title: 'Swipe card deck', aka: 'Tinder swipe, fling to dismiss, gesture cards, drag to decide', tool: 'Pointer events + JavaScript (velocity tracking, springs)', runs: 'WEB',
    notice: 'Drag the top card: it follows the finger and tilts around the point you grabbed, and a KEEP or NOPE stamp fades in with the distance. On release the speed of the flick and the distance decide: past the threshold the card flies off with its own momentum, otherwise a spring pulls it back with a small overshoot. The next card grows up from behind as you drag. A ghost finger plays the gestures until you take over.',
    use: 'dating and discovery apps, flashcards, triage inboxes, any yes or no decision feed',
    params: [{ key: 'dist', label: 'Throw distance', min: 40, max: 220, step: 10, value: 110, unit: ' px' }, { key: 'flick', label: 'Throw speed', min: 200, max: 2000, step: 50, value: 650, unit: ' px/s' }],
    prompt: 'Swipe card deck: the top card follows the pointer with rotation proportional to x (sign flips if grabbed below center), KEEP and NOPE stamps fade in by distance. On release throw the card if it moved more than {dist} or the flick was faster than {flick}, keeping its velocity; otherwise spring back (stiffness 320, damping 18). The next card scales from 0.94 to 1 as the top card moves away. Round nope and like buttons swell toward the drag direction.',
    setup(st, L) {
      st.innerHTML = `<style>
.u2s-bg{position:absolute;inset:0;background:radial-gradient(70% 90% at 50% 40%,#1d1b3a,#0b0b10)}
.u2s-card{position:absolute;left:200px;top:14px;width:240px;height:300px;border-radius:20px;background:#f4efe6;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.45);touch-action:none;cursor:grab;user-select:none;will-change:transform}
.u2s-ph{position:absolute;left:0;top:0;right:0;height:196px;overflow:hidden}
.u2s-sun{position:absolute;width:74px;height:74px;border-radius:50%;left:120px;top:44px}
.u2s-m{position:absolute;left:-10px;right:-10px;bottom:0;height:150px}
.u2s-in{position:absolute;left:18px;right:18px;top:206px;font-family:Segoe UI;color:#1d1b3a}
.u2s-in b{font:700 26px Bahnschrift;display:block}.u2s-in span{font-size:14px;color:#6a6680}
.u2s-ch{display:flex;gap:6px;margin-top:9px}.u2s-ch i{font:600 11px Segoe UI;font-style:normal;padding:4px 9px;border-radius:99px;background:#1d1b3a12;color:#1d1b3a}
.u2s-st{position:absolute;top:26px;font:800 30px Bahnschrift;padding:2px 10px;border:4px solid;border-radius:8px;opacity:0;letter-spacing:2px}
.u2s-btn{position:absolute;top:150px;width:60px;height:60px;border-radius:50%;background:#181826;box-shadow:0 8px 20px rgba(0,0,0,.4),inset 0 0 0 1px #ffffff14;display:flex;align-items:center;justify-content:center;cursor:pointer}
.u2s-x{width:26px;height:26px;position:relative}.u2s-x:before,.u2s-x:after{content:'';position:absolute;left:11px;top:-1px;width:4px;height:28px;border-radius:2px;background:#ff5a36;transform:rotate(45deg)}.u2s-x:after{transform:rotate(-45deg)}
.u2s-n{position:absolute;top:222px;width:120px;text-align:center;font:600 13px Segoe UI;color:#8a87a0}.u2s-n b{display:block;font:700 22px Bahnschrift;color:#f4efe6}
.u2s-f{position:absolute;z-index:50;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:#ffffff40;border:2px solid #fff;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.4)}
</style><div class="u2s-bg"></div>
<div class="u2s-btn" style="left:96px"><i class="u2s-x"></i></div><div class="u2s-btn" style="left:484px">${heart}</div>
<div class="u2s-n" style="left:66px"><b class="u2s-cn">0</b>passed</div><div class="u2s-n" style="left:454px"><b class="u2s-ck">0</b>kept</div>` +
        SCENES.map(([t, s, sky, sun, m1, m2, chips], i) => `<div class="u2s-card"><div class="u2s-ph" style="background:${sky}"><div class="u2s-sun" style="background:${sun};${i === 1 ? 'width:22px;height:22px;left:170px;top:30px' : ''}"></div>
${i === 1 ? '<div style="position:absolute;left:-40px;top:20px;width:320px;height:90px;background:radial-gradient(50% 50% at 50% 50%,#5fd38d99,#2bc4e600);transform:rotate(-12deg)"></div>' : ''}
<div class="u2s-m" style="background:${m1};clip-path:polygon(0 70%,22% 30%,38% 55%,58% 12%,80% 48%,100% 28%,100% 100%,0 100%)"></div>
<div class="u2s-m" style="background:${m2};height:90px;clip-path:polygon(0 40%,30% 70%,55% 30%,75% 60%,100% 20%,100% 100%,0 100%)"></div></div>
<div class="u2s-in"><b>${t}</b><span>${s}</span><div class="u2s-ch">${chips.map(c => `<i>${c}</i>`).join('')}</div></div>
<div class="u2s-st" style="left:18px;color:#5fd38d;transform:rotate(-14deg)">KEEP</div><div class="u2s-st" style="right:18px;color:#ff5a36;transform:rotate(14deg)">NOPE</div></div>`).join('') + '<div class="u2s-f"></div>';
      const q = s => /** @type {HTMLElement} */ (st.querySelector(s));
      const finger = q('.u2s-f'), btns = Array.from(st.querySelectorAll('.u2s-btn')).map(e => /** @type {HTMLElement} */ (e)), cn = q('.u2s-cn'), ck = q('.u2s-ck');
      const cards = Array.from(st.querySelectorAll('.u2s-card')).map((e, i) => { const el = /** @type {HTMLElement} */ (e); const s2 = el.querySelectorAll('.u2s-st'); return { el, keep: /** @type {HTMLElement} */ (s2[0]), nope: /** @type {HTMLElement} */ (s2[1]), x: sp(0), y: sp(0), vx: 0, vy: 0, sign: 1, mode: 'deck', d: sp(i), fade: 1 }; });
      const order = cards.map((_, i) => i); let drag = null, now = 0, userAt = -1e9, kept = 0, passed = 0;
      const top = () => cards[order[0]];
      const press = (px, py) => { const c = top(); if (c.mode === 'fly') return; c.mode = 'drag'; drag = { c, gx: px - c.x.x, gy: py - c.y.x, lx: px, lt: now }; c.sign = py < 180 ? 1 : -1; c.vx = 0; };
      const move = (px, py) => { if (!drag) return; const c = drag.c, dt = Math.max(0.008, now - drag.lt); c.vx = lerp(c.vx, (px - drag.lx) / dt, 0.5); drag.lx = px; drag.lt = now; c.x.x = px - drag.gx; c.y.x = (py - drag.gy) * 0.4; };
      const fly = (c, dir, v) => { c.mode = 'fly'; c.vx = dir * Math.max(Math.abs(v), 1100); c.vy = -120; if (dir > 0) ck.textContent = String(++kept); else cn.textContent = String(++passed); };
      const release = () => { if (!drag) return; const c = drag.c, x = c.x.x, v = c.vx; drag = null; if (Math.abs(x) > L.p.dist || Math.abs(v) > L.p.flick) fly(c, Math.sign(Math.abs(v) > L.p.flick ? v : x), v); else { c.mode = 'deck'; c.x.v = v; c.y.v = 0; } };
      let userDrag = false, fDown = 0;
      cards.forEach(c => {
        c.el.onpointerdown = e => { if (c !== top() || c.mode === 'fly') return; userAt = now; userDrag = true; fDown = 0; drag = null; c.el.setPointerCapture(e.pointerId); c.el.style.cursor = 'grabbing'; const p = local(st, e); press(p.x, p.y); };
        c.el.onpointermove = e => { if (userDrag && drag && drag.c === c) { const p = local(st, e); move(p.x, p.y); userAt = now; } };
        c.el.onpointerup = () => { if (userDrag) { userDrag = false; userAt = now; release(); } c.el.style.cursor = 'grab'; };
      });
      btns.forEach((b, i) => { b.onclick = () => { userAt = now; const c = top(); if (c.mode !== 'fly') { drag = null; fly(c, i ? 1 : -1, 0); } }; });
      // Ghost finger keys: time, x, y, pressed.
      const KEYS = [[0, 330, 300, 0], [0.5, 330, 230, 0], [0.75, 330, 230, 1], [1.5, 420, 222, 1], [1.62, 420, 222, 0], [2.3, 320, 240, 0], [2.5, 320, 240, 1], [2.85, 110, 268, 1], [2.87, 110, 268, 0], [3.8, 300, 220, 0], [4.0, 300, 220, 1], [4.65, 480, 196, 1], [4.67, 480, 196, 0], [5.6, 330, 300, 0], [6.4, 330, 300, 0]];
      return (t, dt) => {
        now = t;
        const auto = !userDrag && t - userAt > 4;
        if (drag && now - drag.lt > 0.05) drag.c.vx *= 0.8;
        if (auto) {
          const lt = t % 6.4; let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= lt) i++;
          const [t0, x0, y0, d0] = KEYS[i], [t1, x1, y1] = KEYS[i + 1], k = ease.inOut(clamp01((lt - t0) / (t1 - t0)));
          const fx = lerp(x0, x1, k), fy = lerp(y0, y1, k);
          if (d0 && !fDown) press(fx, fy); else if (!d0 && fDown) release();
          fDown = d0; if (fDown) move(fx, fy);
          finger.style.transform = `translate(${fx}px,${fy}px) scale(${fDown ? 0.82 : 1})`; finger.style.opacity = String(clamp01(Math.min(lt * 3, (6.2 - lt) * 3)));
        } else finger.style.opacity = '0';
        const tc = top(); let pull = 0;
        if (tc.mode === 'drag' || tc.mode === 'fly') pull = clamp01(Math.abs(tc.x.x) / 160);
        cards.forEach((c, ci) => {
          const pos = order.indexOf(ci);
          if (c.mode === 'fly') { c.x.x += c.vx * dt; c.y.x += c.vy * dt; c.vy += 300 * dt; if (Math.abs(c.x.x) > 560) { order.push(order.shift()); c.mode = 'deck'; c.x.x = c.x.v = 0; c.y.x = c.y.v = 0; c.d.x = 3.2; c.fade = 0; } }
          else if (c.mode === 'deck') { spring(c.x, 320, 18, dt); spring(c.y, 320, 18, dt); }
          c.d.to = Math.min(3, pos - (pos === 1 ? pull : pos === 2 ? pull * 0.5 : 0) * 1); if (pos === 0) c.d.to = 0;
          const d = spring(c.d, 260, 22, dt); c.fade = Math.min(1, c.fade + dt * 2);
          const rot = c.x.x * 0.075 * c.sign;
          c.el.style.transform = `translate(${c.x.x}px,${c.y.x + d * 11}px) rotate(${rot}deg) scale(${1 - d * 0.055})`;
          c.el.style.zIndex = String(10 - pos); c.el.style.opacity = String(pos > 2 ? clamp01(3.3 - d) * c.fade : c.fade);
          c.el.style.filter = d > 0.05 ? `brightness(${1 - d * 0.12})` : 'none';
          c.keep.style.opacity = String(clamp01(c.x.x / 90)); c.nope.style.opacity = String(clamp01(-c.x.x / 90));
        });
        const dx = tc.x.x;
        btns[0].style.transform = `scale(${1 + 0.28 * clamp01(-dx / 120)})`; btns[1].style.transform = `scale(${1 + 0.28 * clamp01(dx / 120)})`;
      };
    },
  });

  // ---------------- submit button states ----------------
  const arrow = '<svg width="20" height="24" viewBox="-1 -1 16 22"><path d="M0 0v16l4.5-4 3 7 2.6-1.1-3-6.9h6z" fill="#fff" stroke="#0b0b10" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  EX.add({
    cat: 'ui', id: 'ui2-submit', kind: 'dom', title: 'Submit button states', aka: 'loading button, morphing button, success check, error shake, async feedback', tool: 'DOM + JavaScript timeline (SVG stroke drawing)', runs: 'WEB',
    notice: 'One button tells the whole story of a request. It dips on press, shrinks into a circle with a spinner, then either turns green and draws a check mark, or turns coral, shakes like a head saying no, and points to the field that needs fixing. The list on the left lights up the current state. Click the button, or force an outcome with the buttons below.',
    use: 'sign-up and checkout forms, save buttons, any action that waits for a server',
    params: [{ key: 'wait', label: 'Server time', min: 0.4, max: 3, step: 0.1, value: 1.5, unit: ' s' }, { key: 'shake', label: 'Shake strength', min: 0, max: 20, step: 1, value: 10, unit: ' px' }],
    prompt: 'Submit button with full async states: on press scale to 0.95, then the 282 x 52 px pill morphs into a 52 px circle (380 ms ease-in-out) while the label fades, a spinner arc rotates for {wait}; success turns it green and draws a check mark with stroke-dashoffset, then it springs back to a pill reading "Account created"; failure turns it coral, draws an X, shakes {shake} with a decaying sine, reopens as "Try again" and slides an error message under the password field. Show a small state list that highlights idle, pressed, loading, success or error.',
    controls: [{ label: 'Succeed', group: false, fn: L => L.state.submit('ok', true) }, { label: 'Fail', group: false, fn: L => L.state.submit('err', true) }],
    setup(st, L) {
      st.innerHTML = `<style>
.u2b-bg{position:absolute;inset:0;background:linear-gradient(135deg,#12111f,#0b0b10)}
.u2b-card{position:absolute;left:250px;top:24px;width:330px;height:314px;border-radius:18px;background:#181826;box-shadow:0 20px 50px rgba(0,0,0,.45),inset 0 0 0 1px #ffffff10;font-family:Segoe UI}
.u2b-card h4{position:absolute;left:24px;top:18px;margin:0;font:700 23px Bahnschrift;color:#f4efe6}
.u2b-lb{position:absolute;left:24px;font-size:12px;color:#8a87a0}
.u2b-in{position:absolute;left:24px;width:282px;height:36px;border-radius:9px;background:#10101a;box-shadow:inset 0 0 0 1.5px #2c2b40;color:#ece7de;font-size:14px;line-height:36px;text-indent:12px;box-sizing:border-box}
.u2b-err{position:absolute;left:24px;top:186px;font-size:12px;color:#ff5a36;opacity:0}
.u2b-btn{position:absolute;top:242px;height:52px;border-radius:26px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#f4efe6;font:600 16px Segoe UI;white-space:nowrap;overflow:hidden}
.u2b-btn span{position:absolute}
.u2b-btn svg{position:absolute;left:50%;top:50%;margin:-16px 0 0 -16px;overflow:visible}
.u2b-sl{position:absolute;left:50px;top:84px;font:13px Segoe UI;color:#5a5872}
.u2b-sl div{height:38px;display:flex;align-items:center;gap:12px}.u2b-sl i{width:10px;height:10px;border-radius:50%;background:#2c2b40}
.u2b-cur{position:absolute;left:0;top:0;z-index:5;pointer-events:none}
</style><div class="u2b-bg"></div>
<div class="u2b-sl"><div style="color:#8a87a0;font:600 11px Segoe UI;letter-spacing:2px;height:26px">STATE</div>${['idle', 'pressed', 'loading', 'success', 'error'].map(s => `<div><i></i>${s}</div>`).join('')}</div>
<div class="u2b-card"><h4>Create account</h4><div class="u2b-lb" style="top:62px">Email</div><div class="u2b-in" style="top:80px">alex@motion.studio</div>
<div class="u2b-lb" style="top:126px">Password</div><div class="u2b-in u2b-pw" style="top:144px">&#8226;&#8226;&#8226;&#8226;&#8226;</div>
<div class="u2b-err">Use at least 8 characters</div></div>
<div class="u2b-btn"><span class="u2b-l0">Create account</span><span class="u2b-l1"></span>
<svg width="32" height="32" viewBox="-16 -16 32 32"><circle class="u2b-sp" r="13" fill="none" stroke="#f4efe6" stroke-width="3" stroke-linecap="round"/>
<path class="u2b-ok" d="M-8 0.5 L-2.5 6 L8.5 -6" fill="none" stroke="#0b0b10" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="26" stroke-dashoffset="26"/>
<path class="u2b-no" d="M-6 -6 L6 6 M6 -6 L-6 6" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="17" stroke-dashoffset="17"/></svg></div>
<div class="u2b-cur">${arrow}</div>`;
      const q = s => /** @type {HTMLElement} */ (st.querySelector(s));
      const btn = q('.u2b-btn'), l0 = q('.u2b-l0'), l1 = q('.u2b-l1'), spin = q('.u2b-sp'), ok = q('.u2b-ok'), no = q('.u2b-no'), pw = q('.u2b-pw'), err = q('.u2b-err'), cur = q('.u2b-cur');
      const dots = Array.from(st.querySelectorAll('.u2b-sl div')).slice(1).map(e => /** @type {HTMLElement} */ (e));
      const CX = 415, BW = 282, BASE = [122, 92, 255], OKC = [95, 211, 141], ERRC = [255, 90, 54];
      let now = 0, t0 = -99, outcome = 'ok', nextOk = true, userAt = -99, autoAt = 0, autoFired = false, hover = false, down = false;
      const busyFor = () => 2.95 + L.p.wait;
      const submit = (oc, user) => { if (now - t0 < busyFor() + 0.1) return; t0 = now; outcome = oc; if (user) { userAt = now; autoAt = -1; } };
      L.state = { submit };
      btn.onpointerenter = () => { hover = true; userAt = now; autoAt = -1; }; btn.onpointerleave = () => { hover = false; down = false; };
      btn.onpointerdown = () => { down = true; userAt = now; }; btn.onpointerup = () => { if (!down) return; down = false; nextOk = !nextOk; submit(nextOk ? 'err' : 'ok', true); };
      const mix = (a, b, k) => a.map((v, i) => Math.round(lerp(v, b[i], k)));
      return t => {
        now = t;
        const S = L.p.wait, E = 0.5 + S, busy = t - t0 < busyFor();
        // ghost cursor: enters, clicks, leaves, while nobody else is using the card
        if (!busy && !hover && t - userAt > 4 && autoAt < 0) { autoAt = t; autoFired = false; }
        let cx = 660, cy = 380, press = 0;
        if (autoAt >= 0 && t - userAt > 4) {
          const a = t - autoAt, kin = ease.inOut(seg(a, 0.15, 0.8)), kout = ease.inOut(seg(a, 1.2, 1.9));
          cx = lerp(lerp(640, CX + 46, kin), 660, kout); cy = lerp(lerp(370, 274, kin), 380, kout); press = a > 0.85 && a < 0.97 ? 1 : 0;
          if (a > 0.85 && !autoFired) { autoFired = true; nextOk = !nextOk; submit(nextOk ? 'err' : 'ok', false); }
          if (a > busyFor() + 1.1) autoAt = -1;
        }
        cur.style.transform = `translate(${cx}px,${cy}px) scale(${press ? 0.85 : 1})`;
        const a = busy ? t - t0 : 99, isOk = outcome === 'ok';
        const res = isOk ? E + 1.0 : E + 0.4, back = busyFor() - 0.35;
        let w = BW;
        if (a < 99) w = lerp(BW, 52, ease.inOut(seg(a, 0.12, 0.5))) + (BW - 52) * ease.back(seg(a, res, res + 0.45));
        const sc = 1 - 0.05 * Math.sin(Math.PI * seg(a, 0, 0.22)) - (down ? 0.04 : 0);
        const shake = isOk ? 0 : L.p.shake * Math.sin((a - E) * 42) * Math.exp(-(a - E) * 5) * (a > E && a < E + 0.9 ? 1 : 0);
        let col = BASE;
        if (a < 99) col = mix(BASE, isOk ? OKC : ERRC, seg(a, E, E + 0.18) * (1 - seg(a, back, back + 0.3)));
        btn.style.left = (CX - w / 2 + shake) + 'px'; btn.style.width = w + 'px';
        btn.style.background = `rgb(${col})`; btn.style.color = isOk && a > E && a < back + 0.15 ? '#0b0b10' : '#f4efe6';
        btn.style.transform = `translateY(${hover && !busy ? -2 : 0}px) scale(${sc})`;
        btn.style.boxShadow = `0 ${hover && !busy ? 14 : 8}px ${hover && !busy ? 30 : 20}px rgba(${col},0.35)`;
        l0.style.opacity = String(a < 99 ? (1 - seg(a, 0.1, 0.24)) + seg(a, back + 0.1, back + 0.35) : 1);
        l1.textContent = isOk ? 'Account created' : 'Try again';
        l1.style.opacity = String(seg(a, res + 0.25, res + 0.45) * (1 - seg(a, back - 0.05, back + 0.1)));
        const sk = seg(a, 0.42, 0.55) * (1 - seg(a, E, E + 0.12));
        spin.style.opacity = String(sk); spin.setAttribute('stroke-dasharray', `${22 + 34 * (0.5 + 0.5 * Math.sin(a * 5))} 200`); spin.setAttribute('transform', `rotate(${a * 420})`);
        ok.style.opacity = String(isOk ? 1 - seg(a, res, res + 0.12) : 0); ok.setAttribute('stroke-dashoffset', String(26 * (1 - ease.out(seg(a, E + 0.08, E + 0.42)))));
        no.style.opacity = String(!isOk ? 1 - seg(a, res, res + 0.1) : 0); no.setAttribute('stroke-dashoffset', String(17 * (1 - ease.out(seg(a, E + 0.02, E + 0.25)))));
        const bad = !isOk && a > E && a < back + 0.2;
        pw.style.boxShadow = `inset 0 0 0 1.5px ${bad ? '#ff5a36' : '#2c2b40'}`; pw.style.transform = `translateX(${shake * 0.5}px)`;
        const ek = !isOk ? ease.out(seg(a, E + 0.25, E + 0.5)) * (1 - seg(a, back, back + 0.2)) : 0;
        err.style.opacity = String(ek); err.style.transform = `translateY(${(1 - ek) * -6}px)`;
        const stt = a < 0.2 ? 1 : a < E ? 2 : a < back ? (isOk ? 3 : 4) : 0;
        dots.forEach((d, i) => { const on = i === stt; d.style.color = on ? '#f4efe6' : '#5a5872'; /** @type {HTMLElement} */ (d.firstElementChild).style.background = on ? ['#7a5cff', '#ffb020', '#2bc4e6', '#5fd38d', '#ff5a36'][i] : '#2c2b40'; });
      };
    },
  });

  // ---------------- CSS scroll-driven animations ----------------
  EX.add({
    cat: 'ui', id: 'ui2-scrolltl', kind: 'dom', title: 'CSS scroll-driven animations', aka: 'animation-timeline, scroll() and view() timelines, scroll-linked reveal, reading progress bar', tool: 'Pure CSS (animation-timeline, animation-range, timeline-scope, @property)', runs: 'WEB',
    notice: 'Every moving part here is a plain CSS animation whose clock is the scroll position instead of time: the progress bar, the shrinking header, the parallax hero, the cards that rise as they enter, and the percent readout. JavaScript only plays the reader, scrolling up and down. Scroll it yourself with the wheel or drag the page, and the code panel lights up the rule that is working.',
    use: 'blog and article pages, landing pages, reading progress, scroll reveals without a JavaScript library',
    prompt: 'Build a scroll-driven article page in pure CSS, no JavaScript animation: a reading progress bar on scroll-timeline --page (shared with timeline-scope), a sticky header that shrinks from 96 to 44 px over the first 140 px of scroll with animation-timeline: scroll(), a parallax hero, cards that fade and rise with animation-timeline: view() and animation-range: entry 10% cover 30%, and a percent counter animated through an @property integer. Respect prefers-reduced-motion.',
    setup(st) {
      st.innerHTML = `<style>
@property --u2cp{syntax:'<integer>';inherits:false;initial-value:0}
.u2c-root{position:absolute;inset:0;background:#0b0b10;timeline-scope:--u2c-page;font-family:Segoe UI}
.u2c-win{position:absolute;left:16px;top:18px;width:354px;height:324px;border-radius:12px;overflow:hidden;background:#f4efe6;box-shadow:0 20px 50px rgba(0,0,0,.5)}
.u2c-chr{position:absolute;left:0;right:0;top:0;height:30px;background:#1d1b2c;display:flex;align-items:center;gap:6px;padding-left:12px}
.u2c-chr i{width:9px;height:9px;border-radius:50%;background:#ff5f57}.u2c-chr i+i{background:#febc2e}.u2c-chr i+i+i{background:#28c840}
.u2c-chr span{margin-left:14px;padding:3px 14px;border-radius:7px;background:#2c2a40;color:#a9a6bf;font-size:11px}
.u2c-bar{position:absolute;left:0;top:30px;height:3px;width:100%;z-index:3;background:linear-gradient(90deg,#ff5a36,#ffb020);transform-origin:0 50%;animation:u2c-grow linear both;animation-timeline:--u2c-page}
@keyframes u2c-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.u2c-sc{position:absolute;left:0;right:0;top:30px;bottom:0;overflow-y:auto;scrollbar-width:none;scroll-timeline:--u2c-page block;cursor:grab}
.u2c-hw{position:sticky;top:0;height:0;z-index:2}
.u2c-hd{position:absolute;left:0;right:0;top:0;height:96px;display:flex;align-items:flex-end;padding:0 18px 10px;box-sizing:border-box;color:#fff;animation:u2c-shrink linear both;animation-timeline:scroll();animation-range:0 140px}
.u2c-hd b{font:700 34px Bahnschrift;transform-origin:0 100%;animation:u2c-title linear both;animation-timeline:scroll();animation-range:0 140px}
@keyframes u2c-shrink{to{height:44px;background:#f4efe6f0;color:#1d1b3a;box-shadow:0 6px 16px rgba(0,0,0,.12);padding-bottom:9px}}
@keyframes u2c-title{to{transform:scale(.56)}}
.u2c-hero{height:176px;overflow:hidden;position:relative}
.u2c-hi{position:absolute;left:0;right:0;top:-20px;height:240px;background:radial-gradient(circle at 70% 46%,#ffd27a 0 34px,#ffb02000 35px),linear-gradient(#ff7a45,#7a5cff 70%,#1d1b3a);animation:u2c-par linear both;animation-timeline:scroll();animation-range:0 260px}
.u2c-hi:after{content:'';position:absolute;left:0;right:0;bottom:0;height:110px;background:#1d1b3a;clip-path:polygon(0 60%,18% 28%,34% 52%,55% 10%,74% 44%,100% 22%,100% 100%,0 100%)}
@keyframes u2c-par{to{transform:translateY(70px)}}
.u2c-h{margin:18px 18px 6px;font:700 15px Bahnschrift;color:#1d1b3a;letter-spacing:.5px}
.u2c-card{display:flex;gap:12px;align-items:center;margin:0 14px 10px;padding:10px;border-radius:12px;background:#fff;box-shadow:0 4px 14px rgba(29,27,58,.08);animation:u2c-rise linear both;animation-timeline:view();animation-range:entry 10% cover 30%}
.u2c-card i{width:46px;height:46px;border-radius:9px;flex:none}
.u2c-card b{display:block;font:600 14px Segoe UI;color:#1d1b3a}.u2c-card span{font-size:12px;color:#7a7690}
@keyframes u2c-rise{from{opacity:0;transform:translateY(34px) scale(.92)}}
.u2c-q{margin:18px 18px;padding:18px;border-radius:14px;background:#1d1b3a;color:#f4efe6;font:600 17px Georgia;line-height:1.35;animation:u2c-zoom linear both;animation-timeline:view();animation-range:entry 0% cover 45%}
@keyframes u2c-zoom{from{opacity:0;transform:scale(.8) rotate(-3deg)}}
.u2c-ft{height:70px;display:flex;align-items:center;justify-content:center;color:#7a7690;font-size:12px}
.u2c-code{position:absolute;left:382px;top:18px;width:242px;height:324px;border-radius:12px;background:#14131f;box-shadow:inset 0 0 0 1px #ffffff12;padding:12px 0;box-sizing:border-box;font:10.5px/15px Cascadia Mono,Consolas,monospace;color:#a9a6bf}
.u2c-blk{padding:3px 12px;margin:0 0 5px;border-left:2px solid transparent}
.u2c-blk em{font-style:normal;color:#ff9f7a}.u2c-blk u{text-decoration:none;color:#7fe0f5}
.u2c-b1{animation:u2c-hl1 linear both;animation-timeline:--u2c-page}
.u2c-b2{animation:u2c-hl2 linear both;animation-timeline:--u2c-page}
.u2c-b3{animation:u2c-hl3 linear both;animation-timeline:--u2c-page}
@keyframes u2c-hl1{0%,100%{background:#ffb02010;border-color:#ffb02060}}
@keyframes u2c-hl2{0%{background:#ff5a3626;border-color:#ff5a36}25%,100%{background:transparent;border-color:transparent}}
@keyframes u2c-hl3{0%,12%{background:transparent;border-color:transparent}24%,88%{background:#2bc4e622;border-color:#2bc4e6}100%{background:transparent;border-color:transparent}}
.u2c-pct{position:absolute;left:12px;right:12px;bottom:12px;display:flex;justify-content:space-between;align-items:baseline;color:#5a5872;font:11px Segoe UI;animation:u2c-count linear both;animation-timeline:--u2c-page;counter-reset:u2cp var(--u2cp)}
.u2c-pct:after{content:counter(u2cp) '%';font:700 26px Bahnschrift;color:#f4efe6}
@keyframes u2c-count{to{--u2cp:100}}
@media (prefers-reduced-motion:reduce){.u2c-card,.u2c-q,.u2c-hi{animation:none}}
</style><div class="u2c-root">
<div class="u2c-win"><div class="u2c-chr"><i></i><i></i><i></i><span>motion.studio/journal</span></div><div class="u2c-bar"></div>
<div class="u2c-sc"><div class="u2c-hw"><div class="u2c-hd"><b>Journal</b></div></div><div class="u2c-hero"><div class="u2c-hi"></div></div>
<div class="u2c-h">LATEST TRIPS</div>
${[['Night ferry to Naxos', '9 min read', '#2bc4e6'], ['Fog over the Golden Gate', '6 min read', '#7a5cff'], ['A week of trains in Japan', '12 min read', '#ff5a36'], ['Desert stars in Wadi Rum', '7 min read', '#ffb020'], ['Cold water, warm bread', '5 min read', '#5fd38d'], ['The long way to Lisbon', '8 min read', '#1d1b3a']].map(([a, b, c]) => `<div class="u2c-card"><i style="background:linear-gradient(135deg,${c},${c}55)"></i><div><b>${a}</b><span>${b}</span></div></div>`).join('')}
<div class="u2c-q">"Every animation here runs on the scroll position, not on the clock."</div>
<div class="u2c-card"><i style="background:linear-gradient(135deg,#ff5a36,#7a5cff)"></i><div><b>Packing light, moving slow</b><span>4 min read</span></div></div>
<div class="u2c-ft">You reached the end</div></div></div>
<div class="u2c-code">
<div class="u2c-blk u2c-b1">.bar {<br>&nbsp; animation: <em>grow</em> linear;<br>&nbsp; animation-timeline: <u>--page</u>;<br>}</div>
<div class="u2c-blk u2c-b2">header {<br>&nbsp; animation: <em>shrink</em> linear both;<br>&nbsp; animation-timeline: <u>scroll()</u>;<br>&nbsp; animation-range: 0 140px;<br>}</div>
<div class="u2c-blk u2c-b3">.card {<br>&nbsp; animation: <em>rise</em> linear both;<br>&nbsp; animation-timeline: <u>view()</u>;<br>&nbsp; animation-range:<br>&nbsp;&nbsp;&nbsp; entry 10% cover 30%;<br>}</div>
<div class="u2c-pct"><span>scrolled</span></div></div></div>`;
      const sc = /** @type {HTMLElement} */ (st.querySelector('.u2c-sc'));
      let userAt = -99, now = 0, drag = null;
      sc.onwheel = () => { userAt = now; };
      sc.onpointerdown = e => { userAt = now; drag = { y: e.clientY, s: sc.scrollTop }; sc.setPointerCapture(e.pointerId); sc.style.cursor = 'grabbing'; };
      sc.onpointermove = e => { if (!drag) return; userAt = now; sc.scrollTop = drag.s - (e.clientY - drag.y); };
      sc.onpointerup = () => { drag = null; sc.style.cursor = 'grab'; };
      // The only script: an automatic reader that scrolls down, pauses, and scrolls back up.
      return t => {
        now = t; if (t - userAt < 4) return;
        const max = sc.scrollHeight - sc.clientHeight, lt = t % 12;
        const k = lt < 1 ? 0 : lt < 7.5 ? ease.inOut(seg(lt, 1, 7.5)) : lt < 9 ? 1 : 1 - ease.inOut(seg(lt, 9, 11.4));
        sc.scrollTop += (k * max - sc.scrollTop) * 0.25;
      };
    },
  });

  // ---------------- activity rings ----------------
  EX.add({
    cat: 'ui', id: 'ui2-rings', title: 'Activity rings', aka: 'fitness rings, goal progress rings, closing rings celebration', tool: 'Canvas 2D (conic gradients, arc caps, particles)', runs: 'CPU',
    notice: 'Three rings fill one after another, each with an ease-out that slows near its value. Past 100% a ring keeps going over itself, and a soft shadow under the tip shows the overlap. When the last ring closes, the set spins once and sparks fly. Hover a ring to focus it, or drag around it to dial its value by hand.',
    use: 'health and fitness apps, goal trackers, dashboards, onboarding rewards',
    params: [{ key: 'stag', label: 'Stagger', min: 0, max: 0.8, step: 0.05, value: 0.25, unit: ' s' }, { key: 'dur', label: 'Fill time', min: 0.4, max: 3, step: 0.1, value: 1.8, unit: ' s' }],
    prompt: 'Activity rings in Canvas 2D: three concentric rings (coral Move, green Exercise, cyan Stand, 24 px thick) fill to 132%, 112% and 100% over {dur} each with a {stag} stagger and ease-out-expo. Use a conic gradient from a dark to a bright shade, round caps, and a drop shadow under the tip once a ring passes 100%. Stats on the right count up in sync. When all three close, spin the set 360 degrees and burst sparkles, then unwind and loop. Hover focuses a ring; dragging around a ring sets its value.',
    setup(cv, L) {
      const g = cv.getContext('2d'), CX = 196, CY = 180, R = [130, 102, 74], LW = 24;
      const COL = [C.coral, C.green, C.cyan], DARK = ['#c23a1c', '#3a9c63', '#1a8fae'], TGT = [1.32, 1.12, 1.0];
      const NAME = ['Move', 'Exercise', 'Stand'], GOAL = [400, 30, 12], UNIT = ['KCAL', 'MIN', 'HRS'];
      const cur = [0, 0, 0], prev = [0, 0, 0];
      const N = 160, px = new Float32Array(N), py = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N), life = new Float32Array(N), pc = new Uint8Array(N); let pi = 0;
      const burst = (x, y, c, n, sp0) => { for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, s = sp0 * (0.4 + Math.random()); px[pi] = x; py[pi] = y; vx[pi] = Math.cos(a) * s; vy[pi] = Math.sin(a) * s; life[pi] = 1; pc[pi] = c; pi = (pi + 1) % N; } };
      let hover = -1, drag = -1, dragA = 0, userAt = -99, now = 0, celebrateAt = -99, spin = 0;
      const ringAt = (x, y) => { const d = Math.hypot(x - CX, y - CY); for (let i = 0; i < 3; i++) if (Math.abs(d - R[i]) < LW / 2 + 3) return i; return -1; };
      cv.onpointermove = e => { const p = local(cv, e); if (drag >= 0) { const a = Math.atan2(p.y - CY, p.x - CX); let da = a - dragA; if (da > Math.PI) da -= 6.283; if (da < -Math.PI) da += 6.283; dragA = a; cur[drag] = Math.max(0, Math.min(1.9, cur[drag] + da / 6.283)); userAt = now; } else hover = ringAt(p.x, p.y); cv.style.cursor = drag >= 0 || hover >= 0 ? 'grab' : 'default'; };
      cv.onpointerdown = e => { const p = local(cv, e); const i = ringAt(p.x, p.y); if (i < 0) return; drag = i; dragA = Math.atan2(p.y - CY, p.x - CX); userAt = now; cv.setPointerCapture(e.pointerId); };
      cv.onpointerup = () => { drag = -1; };
      cv.onpointerleave = () => { if (drag < 0) hover = -1; };
      const ring = (i, p) => {
        const r = R[i]; g.lineWidth = LW; g.lineCap = 'round';
        g.strokeStyle = COL[i] + '2e'; g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.stroke();
        if (p <= 0.002) return;
        const top = -Math.PI / 2, end = top + p * 6.283;
        if (p <= 1) {
          const grd = g.createConicGradient(top, 0, 0); grd.addColorStop(0, DARK[i]); grd.addColorStop(p * 0.999, COL[i]); grd.addColorStop(1, COL[i]);
          g.strokeStyle = grd; g.beginPath(); g.arc(0, 0, r, top, end); g.stroke();
        } else {
          const grd = g.createConicGradient(end, 0, 0); grd.addColorStop(0, DARK[i]); grd.addColorStop(1, COL[i]);
          g.strokeStyle = grd; g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.stroke();
          const tx = Math.cos(end) * r, ty = Math.sin(end) * r;
          g.save(); g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 9; g.shadowOffsetX = -Math.sin(end + spin) * 5; g.shadowOffsetY = Math.cos(end + spin) * 5;
          g.fillStyle = COL[i]; g.beginPath(); g.arc(tx, ty, LW / 2 - 0.5, 0, 6.283); g.fill(); g.restore();
          g.strokeStyle = COL[i]; g.lineCap = 'butt'; g.beginPath(); g.arc(0, 0, r, end - 0.25, end); g.stroke(); g.lineCap = 'round';
        }
        // arrow glyph at the start, like a fitness ring
        const ax = 0, ay = -r; g.strokeStyle = '#0b0b10'; g.lineWidth = 3; g.beginPath(); g.moveTo(ax - 4, ay - 5); g.lineTo(ax + 3, ay); g.lineTo(ax - 4, ay + 5); g.stroke();
      };
      return (t, dt) => {
        now = t;
        const lt = t % 9.5, back = ease.inOut(seg(lt, 7.6, 8.5));
        const user = t - userAt < 4 || drag >= 0;
        for (let i = 0; i < 3; i++) {
          const a0 = 0.4 + i * L.p.stag, auto = TGT[i] * ease.expo(seg(lt, a0, a0 + L.p.dur)) * (1 - back);
          if (!user) cur[i] += (auto - cur[i]) * Math.min(1, dt * 9);
          if (prev[i] < 0.999 && cur[i] >= 0.999) { burst(CX, CY - R[i], i, 18, 230); }
          prev[i] = cur[i];
        }
        const all = cur[0] >= 0.999 && cur[1] >= 0.999 && cur[2] >= 0.999;
        if (all && t - celebrateAt > 3) { celebrateAt = t; for (let k = 0; k < 3; k++) for (let j = 0; j < 16; j++) { const a = j / 16 * 6.283; burst(CX + Math.cos(a) * R[k], CY + Math.sin(a) * R[k], k, 1, 170); } }
        if (!all && t - celebrateAt > 1.4) celebrateAt = -99;
        const ck = seg(t - celebrateAt, 0, 1.3); spin = celebrateAt > 0 ? ease.inOut(ck) * 6.283 : 0;
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.save(); g.translate(CX, CY); g.rotate(spin);
        for (let i = 0; i < 3; i++) ring(i, cur[i]);
        if (hover >= 0) { g.strokeStyle = 'rgba(11,11,16,0.66)'; g.lineWidth = LW + 3; for (let i = 0; i < 3; i++) if (i !== hover) { g.beginPath(); g.arc(0, 0, R[i], 0, 6.283); g.stroke(); } }
        g.restore();
        g.globalCompositeOperation = 'lighter';
        for (let k = 0; k < N; k++) {
          if (life[k] <= 0) continue;
          life[k] -= dt * 1.1; vx[k] *= 1 - dt * 2.2; vy[k] = vy[k] * (1 - dt * 2.2) + 60 * dt; px[k] += vx[k] * dt; py[k] += vy[k] * dt;
          const s = 3 + 7 * life[k]; g.globalAlpha = Math.max(0, life[k]); g.fillStyle = COL[pc[k]];
          g.fillRect(px[k] - s, py[k] - 1, s * 2, 2); g.fillRect(px[k] - 1, py[k] - s, 2, s * 2); g.beginPath(); g.arc(px[k], py[k], s * 0.35, 0, 6.283); g.fill();
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 3; i++) {
          const y = 76 + i * 78, on = hover < 0 || hover === i;
          g.globalAlpha = on ? 1 : 0.4;
          g.fillStyle = COL[i]; g.font = '600 13px Segoe UI'; g.fillText(NAME[i].toUpperCase(), 390, y);
          g.font = '700 38px Bahnschrift'; const v = String(Math.round(cur[i] * GOAL[i])); g.fillText(v, 388, y + 40);
          const vw = g.measureText(v).width; g.fillStyle = '#8a87a0'; g.font = '600 17px Bahnschrift'; g.fillText(`/${GOAL[i]} ${UNIT[i]}`, 394 + vw, y + 40);
          g.fillStyle = COL[i] + '2e'; g.fillRect(390, y + 50, 210, 3); g.fillStyle = COL[i]; g.fillRect(390, y + 50, 210 * Math.min(1, cur[i]), 3);
        }
        g.globalAlpha = 1;
        const pk = celebrateAt > 0 ? ease.back(seg(t - celebrateAt, 0.5, 0.9)) * (1 - seg(t - celebrateAt, 3.6, 4)) : 0;
        if (pk > 0.01) { g.save(); g.translate(CX, CY); g.scale(pk, pk); g.fillStyle = C.cream; g.font = '700 17px Bahnschrift'; g.textAlign = 'center'; g.fillText('ALL', 0, -3); g.fillText('CLOSED', 0, 16); g.restore(); g.textAlign = 'left'; }
      };
    },
  });

  // ---------------- page curl ----------------
  // Draws the 8 magazine pages (280 x 300 each, 4 x 2 grid) once into an atlas canvas at scale S.
  function drawCurlAtlas(S) {
    const PW = 280, PH = 300, cv = document.createElement('canvas'); cv.width = PW * 4 * S; cv.height = PH * 2 * S;
    const g = cv.getContext('2d'); g.scale(S, S);
    const TXT = 'Good motion starts slow, gathers speed and settles softly, the way real things do. An ease-out makes an arrival feel calm; an ease-in makes an exit feel quick. Springs add weight: a little overshoot tells the eye that something has mass. Stagger turns a block into a sentence the eye can read. Holds give the viewer time to breathe, and a loop that ends where it began never shows its seam.';
    const para = (x, y, w, lh, n, size) => {
      g.font = `${size}px Georgia`; g.fillStyle = '#3a3848'; const words = (TXT + ' ' + TXT).split(' '); let line = '', row = 0;
      for (const wd of words) { const tst = line ? line + ' ' + wd : wd; if (g.measureText(tst).width > w) { g.fillText(line, x, y + row * lh); line = wd; if (++row >= n) return; } else line = tst; }
    };
    const head = (x, y, txt, size, col) => { g.font = `700 ${size}px Bahnschrift`; g.fillStyle = col; g.fillText(txt, x, y); };
    const foot = (i, left) => { g.font = '9px Segoe UI'; g.fillStyle = '#8a8698'; g.textAlign = left ? 'left' : 'right'; g.fillText(`MOTION  ${i + 1}`, left ? 22 : PW - 22, PH - 14); g.textAlign = 'left'; };
    for (let i = 0; i < 8; i++) {
      g.save(); g.translate((i % 4) * PW, Math.floor(i / 4) * PH);
      g.beginPath(); g.rect(0, 0, PW, PH); g.clip();
      g.fillStyle = '#f2ece1'; g.fillRect(0, 0, PW, PH);
      const left = i % 2 === 0;
      if (i === 0) { const l = g.createLinearGradient(0, 0, 0, PH); l.addColorStop(0, '#1d1b3a'); l.addColorStop(1, '#7a5cff'); g.fillStyle = l; g.fillRect(0, 0, PW, PH); head(22, 92, 'MOTION', 54, C.cream); g.font = '13px Segoe UI'; g.fillStyle = '#d9d3ff'; g.fillText('Issue 12: the physics of feel', 24, 116); g.fillStyle = C.coral; g.beginPath(); g.arc(200, 214, 52, 0, 7); g.fill(); g.fillStyle = C.amber; g.beginPath(); g.arc(150, 236, 30, 0, 7); g.fill(); }
      else if (i === 1) { head(24, 52, 'The art of', 24, '#1d1b3a'); head(24, 80, 'the ease', 24, C.coral); g.fillStyle = C.coral; g.fillRect(24, 92, 40, 3); g.font = '700 40px Georgia'; g.fillStyle = '#1d1b3a'; g.fillText('G', 22, 140); para(56, 116, 200, 13, 3, 10); para(24, 158, 232, 13, 9, 10); }
      else if (i === 2) { const l = g.createLinearGradient(0, 0, 0, 200); l.addColorStop(0, '#ff7a45'); l.addColorStop(1, '#7a5cff'); g.fillStyle = l; g.fillRect(0, 0, PW, 210); g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(140, 150, 50, Math.PI, 0); g.fill(); g.fillStyle = '#1d1b3a'; for (let k = 0; k < 6; k++) g.fillRect(0, 150 + k * k * 2 + k * 3, PW, 2 + k * 0.5); g.fillRect(0, 175, PW, 40); g.font = 'italic 11px Georgia'; g.fillStyle = '#5a5872'; g.fillText('Sunset over the timeline, frame 1,240.', 22, 234); para(22, 258, 236, 13, 2, 10); }
      else if (i === 3) { head(24, 50, 'Springs, not curves', 21, '#1d1b3a'); para(24, 74, 232, 13, 4, 10); g.strokeStyle = '#d8d0c2'; g.lineWidth = 1; g.strokeRect(24, 130, 232, 110); g.strokeStyle = C.cyan; g.lineWidth = 2.5; g.beginPath(); for (let x = 0; x <= 232; x += 2) { const k = x / 232, y = 1 - Math.exp(-6 * k) * Math.cos(16 * k); g.lineTo(24 + x, 230 - y * 70); } g.stroke(); g.setLineDash([4, 4]); g.strokeStyle = '#b0a898'; g.beginPath(); g.moveTo(24, 160); g.lineTo(256, 160); g.stroke(); g.setLineDash([]); para(24, 260, 232, 13, 1, 10); }
      else if (i === 4) { g.fillStyle = C.coral; g.font = '700 70px Georgia'; g.fillText('“', 18, 86); g.font = 'italic 22px Georgia'; g.fillStyle = '#1d1b3a'; ['Overshoot is how', 'the eye learns', 'that a thing', 'has weight.'].forEach((s, k) => g.fillText(s, 26, 112 + k * 30)); g.font = '12px Segoe UI'; g.fillStyle = '#8a8698'; g.fillText('From the studio notebook', 28, 250); }
      else if (i === 5) { head(24, 50, 'Palette', 24, '#1d1b3a'); [C.coral, C.amber, C.cyan, C.violet, C.green, C.navy].forEach((c, k) => { const x = 24 + (k % 3) * 80, y = 72 + Math.floor(k / 3) * 96; g.fillStyle = c; g.beginPath(); g.roundRect(x, y, 70, 62, 8); g.fill(); g.font = '10px Cascadia Mono, Consolas'; g.fillStyle = '#5a5872'; g.fillText(c, x, y + 78); }); para(24, 270, 232, 13, 1, 10); }
      else if (i === 6) { g.fillStyle = '#1d1b3a'; g.fillRect(0, 0, PW, PH); for (let r = 150; r > 6; r -= 14) { g.strokeStyle = r % 28 < 14 ? C.cyan : C.violet; g.lineWidth = 6; g.beginPath(); g.arc(140, 150, r, 0, 7); g.stroke(); } head(22, 280, 'Rhythm', 26, C.cream); }
      else { head(24, 52, 'Before you go', 22, '#1d1b3a'); ['Ease out on the way in', 'Ease in on the way out', 'Stagger by 40 to 80 ms', 'Hold the key frame', 'Loop without a seam'].forEach((s, k) => { g.fillStyle = PALQ[k % 4]; g.beginPath(); g.arc(30, 82 + k * 30, 5, 0, 7); g.fill(); g.font = '13px Segoe UI'; g.fillStyle = '#2a2838'; g.fillText(s, 44, 87 + k * 30); }); para(24, 250, 232, 13, 2, 10); }
      if (i !== 0 && i !== 6) foot(i, left);
      g.restore();
    }
    return cv;
  }
  const PALQ = [C.coral, C.amber, C.cyan, C.violet];
  let curlTex = null;

  EX.add({
    cat: 'ui', id: 'ui2-curl', title: 'Page curl', aka: 'page turn, book flip, magazine flip, peel effect', tool: 'WebGL2 fragment shader (cylinder fold) over a Canvas 2D page atlas', runs: 'GPU',
    notice: 'A magazine page turns over a cylinder that rolls across the paper. For every pixel the shader asks which layer is on top: the curled back of the page, its front still lying flat, or the page underneath, and shades each by the angle of the paper with a soft shadow under the fold. Drag the right page to turn it by hand; let go past the spine and it finishes the turn, otherwise it falls back.',
    use: 'digital magazines and catalogs, e-readers, playful onboarding, transitions between two screens',
    params: [{ key: 'rad', label: 'Curl radius', min: 6, max: 70, step: 1, value: 38, unit: ' px' }, { key: 'shade', label: 'Shadow strength', min: 0, max: 1, step: 0.05, value: 0.55 }],
    prompt: 'Page turn in a WebGL fragment shader: a two-page magazine spread; the right page curls from its bottom corner around a cylinder (radius up to {rad}) that moves to the spine, showing the back of the page on top, shading by the paper angle, and a soft shadow ({shade}) on the page below. The corner follows the mouse when dragged, constrained so the page never stretches past the spine; released past the spine it completes the turn with ease-out, otherwise it falls back. Auto-play one turn every 3.4 s.',
    setup(cv, L) {
      const G = EX.G, gl = G.gl, ctx = cv.getContext('2d');
      if (!gl) { ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); return () => {}; }
      if (!curlTex) {
        curlTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, curlTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, drawCurlAtlas(2));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      const prog = G.prog(`uniform sampler2D uAtlas; uniform vec2 uM; uniform float uR,uShade; uniform vec4 uPg;
const vec2 C0=vec2(600.,330.);
vec3 page(float idx,vec2 q){float i=mod(idx,8.);vec2 cell=vec2(mod(i,4.),floor(i/4.));q=clamp(q,vec2(.002),vec2(.998));return texture(uAtlas,(cell+q)/vec2(4.,2.)).rgb;}
vec2 qR(vec2 u){return vec2((u.x-320.)/280.,(u.y-30.)/300.);}
vec2 qBack(vec2 u){return vec2(1.-(u.x-320.)/280.,(u.y-30.)/300.);}
bool inR(vec2 u){return u.x>=320.&&u.x<=600.&&u.y>=30.&&u.y<=330.;}
float sdR(vec2 u){vec2 d=abs(u-vec2(460.,180.))-vec2(140.,150.);return length(max(d,0.))+min(max(d.x,d.y),0.);}
float spine(float x){float a=abs(x-320.);return 1.-.28*exp(-a/10.)-.1*exp(-a/50.);}
void main(){
  vec2 p=vec2(vUv.x*640.,(1.-vUv.y)*360.);
  vec2 v=vUv-.5; vec3 col=mix(vec3(.075,.07,.1),vec3(.03,.03,.045),dot(v,v)*2.5);
  vec2 cb=abs(p-vec2(320.,180.))-vec2(288.,158.);
  if(max(cb.x,cb.y)<0.)col=vec3(.12,.11,.22);
  if(p.y>=30.&&p.y<=330.&&p.x>=40.&&p.x<320.)col=page(uPg.x,vec2((p.x-40.)/280.,(p.y-30.)/300.))*spine(p.x);
  if(inR(p))col=page(uPg.y,qR(p))*spine(p.x);
  float Lm=length(C0-uM);
  if(Lm<.5){ if(inR(p))col=page(uPg.z,qR(p))*spine(p.x); o=vec4(col,1.); return; }
  vec2 dir=(C0-uM)/Lm; vec2 O=(C0+uM)*.5-dir*PI*uR*.5;
  float d=dot(p-O,dir), r=uR;
  bool done=false; vec3 tc=col;
  if(d<r){
    float th=d<0.?PI:PI-asin(clamp(d/r,-1.,1.));
    float s=d<0.?PI*r-d:r*th;
    vec2 u=p+dir*(s-d);
    if(inR(u)){float b=d<0.?.93:.68+.27*(-cos(th));b+=d<0.?0.:.1*pow(max(0.,sin(th)),6.);tc=mix(page(uPg.w,qBack(u)),vec3(.95,.93,.88),.1)*b*spine(640.-u.x);done=true;}
  }
  if(!done&&d>=0.&&d<r){float th=asin(d/r);vec2 u=p+dir*(r*th-d);if(inR(u)){tc=page(uPg.z,qR(u))*(.72+.28*cos(th))*spine(u.x);done=true;}}
  if(!done&&d<0.&&inR(p)){
    vec2 u2=p+dir*(PI*r-2.*d);
    tc=page(uPg.z,qR(p))*spine(p.x)*(1.-uShade*.55*exp(-max(sdR(u2),0.)/7.));
    done=true;
  }
  if(!done&&d>=0.&&inR(p))tc=col*(1.-.8*uShade*exp(-max(d-r,0.)/(10.+r*.5)));
  o=vec4(tc,1.);
}`);
      const SB = [320, 330], ST = [320, 30], C0 = [600, 330], END = [40, 330];
      const M = [600, 330], U = { uAtlas: curlTex, uM: M, uR: 1, uShade: 0.5, uPg: [0, 2, 1, 2] };
      let spread = 0, userAt = -99, now = 0, drag = null, tween = null, hoverP = null, autoT0 = -1, autoN = 0;
      const constrain = (x, y) => {
        let dx = x - SB[0], dy = y - SB[1], l = Math.hypot(dx, dy); if (l > 280) { x = SB[0] + dx * 280 / l; y = SB[1] + dy * 280 / l; }
        dx = x - ST[0]; dy = y - ST[1]; l = Math.hypot(dx, dy); if (l > 410) { x = ST[0] + dx * 410 / l; y = ST[1] + dy * 410 / l; }
        M[0] = x; M[1] = Math.min(y, 345);
      };
      cv.onpointerdown = e => { const p = local(cv, e); if (p.x < 320 || tween) return; drag = { ox: M[0] - p.x, oy: M[1] - p.y }; userAt = now; cv.setPointerCapture(e.pointerId); };
      cv.onpointermove = e => { const p = local(cv, e); if (drag) { constrain(p.x + drag.ox, p.y + drag.oy); userAt = now; } else { hoverP = p.x > 320 ? p : null; if (hoverP) userAt = now; } cv.style.cursor = p.x > 320 ? 'grab' : 'default'; };
      cv.onpointerup = () => { if (!drag) return; drag = null; userAt = now; tween = { t0: now, from: [M[0], M[1]], to: M[0] < 320 ? END : C0 }; };
      cv.onpointerleave = () => { hoverP = null; };
      const finish = () => { spread++; M[0] = C0[0]; M[1] = C0[1]; };
      return t => {
        now = t;
        if (tween) {
          const k = ease.out(seg(t, tween.t0, tween.t0 + 0.55)); M[0] = lerp(tween.from[0], tween.to[0], k); M[1] = lerp(tween.from[1], tween.to[1], k) - (tween.to === END ? 50 * Math.sin(Math.PI * k) * (1 - k) : 0);
          if (k >= 1) { if (tween.to === END) finish(); tween = null; userAt = now; }
        } else if (!drag && t - userAt > 3) {
          if (autoT0 < 0) { autoT0 = t; autoN = 0; }
          const at = t - autoT0, n = Math.floor(at / 3.4), lt = at - n * 3.4;
          if (n > autoN) { finish(); autoN = n; }
          const k = ease.inOut(seg(lt, 0.5, 2.3)), pk = ease.out(seg(lt, 0.1, 0.5));
          if (lt < 0.5) { M[0] = C0[0] - 28 * pk; M[1] = C0[1] - 24 * pk; }
          else { M[0] = lerp(572, END[0], k); M[1] = lerp(306, END[1], k) - 80 * Math.sin(Math.PI * k); }
        } else if (!drag && hoverP && Math.hypot(hoverP.x - C0[0], hoverP.y - C0[1]) < 120) {
          M[0] = lerp(M[0], C0[0] + (hoverP.x - C0[0]) * 0.35, 0.2); M[1] = lerp(M[1], C0[1] + (hoverP.y - C0[1]) * 0.35, 0.2);
        } else if (!drag) { M[0] = lerp(M[0], C0[0], 0.2); M[1] = lerp(M[1], C0[1], 0.2); }
        if (drag || tween || t - userAt <= 3) autoT0 = -1;
        const Lm = Math.hypot(C0[0] - M[0], C0[1] - M[1]);
        U.uR = 0.5 + L.p.rad * Math.pow(Math.sin(Math.PI * clamp01(Lm / 560)), 0.8); U.uShade = L.p.shade;
        const b = spread * 2; U.uPg[0] = b; U.uPg[1] = b + 3; U.uPg[2] = b + 1; U.uPg[3] = b + 2;
        G.draw(prog, null, U, W, H); G.copy(ctx, W, H);
      };
    },
  });

  // ---------------- dock magnification ----------------
  const ICONS = /** @type {[string, string][]} */ ([
    ['Files', '<rect width="48" height="48" rx="11" fill="url(#u2d-g0)"/><path d="M10 16h11l3 3h14v17H10z" fill="#fff" opacity=".95"/><path d="M10 21h28" stroke="#2b7bd6" stroke-width="2"/>'],
    ['Mail', '<rect width="48" height="48" rx="11" fill="url(#u2d-g1)"/><rect x="9" y="14" width="30" height="21" rx="3" fill="#fff"/><path d="M10 16l14 11 14-11" fill="none" stroke="#2b9fd8" stroke-width="2.4" stroke-linejoin="round"/>'],
    ['Music', '<rect width="48" height="48" rx="11" fill="url(#u2d-g2)"/><path d="M20 32V14l14-3v18" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle cx="17" cy="32" r="4.5" fill="#fff"/><circle cx="31" cy="29" r="4.5" fill="#fff"/>'],
    ['Photos', '<rect width="48" height="48" rx="11" fill="#f7f4ee"/>' + [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<ellipse cx="24" cy="15.5" rx="4.6" ry="8" fill="${['#ff5a36', '#ffb020', '#f5d90a', '#5fd38d', '#2bc4e6', '#3b6cff', '#7a5cff', '#e04fb0'][i]}" opacity=".85" transform="rotate(${i * 45} 24 24)"/>`).join('')],
    ['Code', '<rect width="48" height="48" rx="11" fill="#1d1b3a"/><path d="M18 17l-7 7 7 7M30 17l7 7-7 7" fill="none" stroke="#2bc4e6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 14l-4 20" stroke="#ff5a36" stroke-width="3" stroke-linecap="round"/>'],
    ['Notes', '<rect width="48" height="48" rx="11" fill="#fffaf0"/><rect width="48" height="13" rx="11" fill="#ffb020"/><rect y="7" width="48" height="6" fill="#ffb020"/><path d="M10 21h28M10 27h28M10 33h20" stroke="#d8cfbf" stroke-width="2"/>'],
    ['Calendar', '<rect width="48" height="48" rx="11" fill="#fff"/><text x="24" y="15" font-family="Segoe UI" font-weight="700" font-size="9" fill="#ff3b30" text-anchor="middle">OCT</text><text x="24" y="39" font-family="Segoe UI" font-weight="300" font-size="24" fill="#1d1b3a" text-anchor="middle">8</text>'],
    ['Maps', '<rect width="48" height="48" rx="11" fill="#bfe8b8"/><path d="M0 30L48 18v8L0 38z" fill="#f4efe6"/><path d="M14 48V0" stroke="#ffd27a" stroke-width="5"/><path d="M12 36c6-8 14-2 22-14" fill="none" stroke="#3b6cff" stroke-width="3" stroke-linecap="round"/><circle cx="34" cy="21" r="4" fill="#ff3b30"/>'],
    ['Settings', '<rect width="48" height="48" rx="11" fill="url(#u2d-g3)"/><circle cx="24" cy="24" r="11" fill="none" stroke="#3a3d48" stroke-width="5" stroke-dasharray="3.6 3.3"/><circle cx="24" cy="24" r="8" fill="none" stroke="#3a3d48" stroke-width="3.5"/><circle cx="24" cy="24" r="3" fill="#3a3d48"/>'],
    ['Trash', '<rect width="48" height="48" rx="11" fill="#ffffff22"/><path d="M15 16h18l-2 22H17z" fill="#ffffff55" stroke="#fff" stroke-width="1.6"/><path d="M12 16h24M20 13h8" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M20 20v14M24 20v14M28 20v14" stroke="#ffffffaa" stroke-width="1.4"/>'],
  ]);
  EX.add({
    cat: 'ui', id: 'ui2-dock', kind: 'dom', title: 'Dock magnification', aka: 'macOS dock, fisheye menu, magnifying toolbar, app launch bounce', tool: 'DOM + JavaScript (cosine falloff, smoothed pointer)', runs: 'WEB',
    notice: 'Each icon in the dock grows with its distance to the pointer, using a cosine falloff, so neighbours swell a little and the icon under the pointer the most. Sizes are measured from the resting layout, not the magnified one, which keeps the row stable. Click an icon and it bounces three times with shrinking height, then a dot shows the app is open. Move the mouse along the dock to try it.',
    use: 'toolbars and launchers, icon menus, playful navigation, desktop-style web apps',
    params: [{ key: 'mag', label: 'Magnification', min: 1, max: 2.6, step: 0.05, value: 1.9, unit: 'x' }, { key: 'range', label: 'Falloff range', min: 50, max: 260, step: 5, value: 140, unit: ' px' }],
    prompt: 'macOS-style dock in HTML and JavaScript: 10 app icons (38 px) in a frosted glass bar; icons scale up to {mag} near the pointer with a cosine falloff over {range}, measured from the resting layout so the row does not jitter; the bar widens to fit; a label fades in above the hovered icon. Clicking an icon bounces it three times with decaying height over 1.2 s, then a small dot appears under it.',
    setup(st, L) {
      st.innerHTML = `<style>
.u2d-wp{position:absolute;inset:0;background:radial-gradient(60% 80% at 25% 30%,#7a5cff 0,#7a5cff00 70%),radial-gradient(50% 70% at 80% 70%,#ff5a36 0,#ff5a3600 70%),radial-gradient(40% 50% at 60% 20%,#2bc4e6aa 0,#2bc4e600 70%),#1d1b3a}
.u2d-mb{position:absolute;left:0;right:0;top:0;height:24px;background:#0b0b1055;backdrop-filter:blur(12px);display:flex;align-items:center;gap:16px;padding:0 14px;font:12px Segoe UI;color:#fff}
.u2d-mb b{font-weight:700}.u2d-mb span:last-child{margin-left:auto}
.u2d-win{position:absolute;left:150px;top:58px;width:340px;height:170px;border-radius:12px;background:#f4efe6ee;box-shadow:0 20px 50px rgba(0,0,0,.4);overflow:hidden;font-family:Segoe UI}
.u2d-win i{position:absolute;top:10px;width:10px;height:10px;border-radius:50%}
.u2d-bar{position:absolute;bottom:8px;height:54px;border-radius:20px;background:#ffffff26;backdrop-filter:blur(18px) saturate(1.4);box-shadow:inset 0 0 0 1px #ffffff40,0 10px 30px rgba(0,0,0,.25)}
.u2d-ic{position:absolute;bottom:14px;cursor:pointer;filter:drop-shadow(0 4px 6px rgba(0,0,0,.3))}.u2d-ic svg{display:block;width:100%;height:100%}
.u2d-dot{position:absolute;bottom:9px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:#fff;opacity:0}
.u2d-tip{position:absolute;padding:4px 10px;border-radius:7px;background:#1d1b3add;color:#fff;font:12px Segoe UI;white-space:nowrap;transform:translateX(-50%);opacity:0;pointer-events:none}
.u2d-sep{position:absolute;bottom:18px;width:1px;height:34px;background:#ffffff40}
.u2d-cur{position:absolute;left:0;top:0;z-index:5;pointer-events:none}
</style><div class="u2d-wp"></div>
<div class="u2d-mb"><b>Studio</b><span>File</span><span>Edit</span><span>View</span><span>Window</span><span>Thu Oct 8  9:41</span></div>
<div class="u2d-win"><i style="left:12px;background:#ff5f57"></i><i style="left:28px;background:#febc2e"></i><i style="left:44px;background:#28c840"></i>
<div style="position:absolute;left:20px;top:38px;font:700 22px Bahnschrift;color:#1d1b3a">Hover the dock</div><div style="position:absolute;left:20px;top:70px;width:300px;font:13px/1.5 Segoe UI;color:#5a5872">Icons grow with a cosine falloff around the pointer. Click one to launch it.</div></div>
<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="u2d-g0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6cc4ff"/><stop offset="1" stop-color="#2b7bd6"/></linearGradient>
<linearGradient id="u2d-g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fd0ff"/><stop offset="1" stop-color="#1a7fe0"/></linearGradient>
<linearGradient id="u2d-g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a6a"/><stop offset="1" stop-color="#ff2d55"/></linearGradient>
<linearGradient id="u2d-g3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e6ee"/><stop offset="1" stop-color="#9ea3b3"/></linearGradient></defs></svg>
<div class="u2d-bar"></div><div class="u2d-sep"></div>${ICONS.map(([n, s]) => `<div class="u2d-ic" title="${n}"><svg viewBox="0 0 48 48">${s}</svg></div><div class="u2d-dot"></div>`).join('')}
<div class="u2d-tip"></div><div class="u2d-cur">${arrow}</div>`;
      const q = s => /** @type {HTMLElement} */ (st.querySelector(s)), qa = s => Array.from(st.querySelectorAll(s)).map(e => /** @type {HTMLElement} */ (e));
      const bar = q('.u2d-bar'), sep = q('.u2d-sep'), tip = q('.u2d-tip'), cur = q('.u2d-cur'), ics = qa('.u2d-ic'), dots = qa('.u2d-dot');
      const N = ICONS.length, B = 38, GAP = 7, SEPW = 14, cx = new Float32Array(N);
      const scale = new Float32Array(N).fill(1), bounceAt = new Float32Array(N).fill(-99), open = new Uint8Array(N); open[0] = 1;
      const baseX = new Float32Array(N); { let x = 320 - (N * B + (N - 1) * GAP + SEPW) / 2; for (let i = 0; i < N; i++) { if (i === N - 1) x += SEPW; baseX[i] = x + B / 2; x += B + GAP; } }
      let mouse = null, now = 0, userAt = -99, sx = -999, hot = -1;
      st.onpointermove = e => { mouse = local(st, e); userAt = now; };
      st.onpointerleave = () => { mouse = null; };
      ics.forEach((ic, i) => { ic.onclick = () => { userAt = now; bounceAt[i] = now; }; });
      return (t, dt) => {
        now = t;
        let px = -999, py = 400, ghost = false;
        if (mouse && t - userAt < 3) { px = mouse.x; py = mouse.y; }
        else {
          ghost = true; const lt = t % 8;
          const k = ease.inOut(seg(lt, 0.4, 3.0)), k2 = ease.inOut(seg(lt, 4.4, 5.6)), out = ease.inOut(seg(lt, 6.4, 7.4));
          px = lerp(lerp(150, 520, k), baseX[2], k2); py = lerp(lerp(392, 326, ease.out(seg(lt, 0, 0.8))), 400, out);
          px = lerp(px, 600, out);
          if (lt > 5.7 && lt - dt <= 5.7) bounceAt[2] = t;
          cur.style.transform = `translate(${px - 2}px,${py - 2}px) scale(${lt > 5.7 && lt < 5.82 ? 0.85 : 1})`;
        }
        cur.style.opacity = ghost ? '1' : '0';
        const inDock = py > 280 && py < 362 && px > 0 && px < 640;
        sx = inDock ? (sx < -900 ? px : lerp(sx, px, Math.min(1, dt * 24))) : sx;
        const M = L.p.mag, R = L.p.range;
        let total = 0; hot = -1; let best = 1e9;
        for (let i = 0; i < N; i++) {
          const d = Math.abs(sx - baseX[i]), target = inDock && sx > -900 && d < R ? 1 + (M - 1) * (0.5 + 0.5 * Math.cos(Math.PI * d / R)) : 1;
          scale[i] += (target - scale[i]) * Math.min(1, dt * 16); total += B * scale[i];
          if (inDock && d < best && d < B / 2 + GAP) { best = d; hot = i; }
        }
        total += (N - 1) * GAP + SEPW;
        // keep the point under the pointer fixed: map its resting position into the magnified row
        let x = 0; for (let i = 0; i < N; i++) { if (i === N - 1) x += SEPW; cx[i] = x + B * scale[i] / 2; x += B * scale[i] + GAP; }
        const bl = baseX[0] - B / 2, rel = sx - bl; let pm = rel;
        if (rel <= baseX[0] - bl) pm = cx[0] - (baseX[0] - bl - rel); else if (rel >= baseX[N - 1] - bl) pm = cx[N - 1] + rel - (baseX[N - 1] - bl);
        else for (let i = 0; i < N - 1; i++) { const a0 = baseX[i] - bl, a1 = baseX[i + 1] - bl; if (rel < a1) { pm = lerp(cx[i], cx[i + 1], (rel - a0) / (a1 - a0)); break; } }
        x = Math.max(16, Math.min(624 - total, sx < -900 ? 320 - total / 2 : sx - pm));
        bar.style.left = (x - 10) + 'px'; bar.style.width = (total + 20) + 'px';
        for (let i = 0; i < N; i++) {
          if (i === N - 1) { sep.style.left = (x + SEPW / 2 - GAP / 2) + 'px'; x += SEPW; }
          const w = B * scale[i], bk = (t - bounceAt[i]) / 1.2;
          const by = bk >= 0 && bk < 1 ? -26 * Math.abs(Math.sin(Math.PI * bk * 3)) * Math.pow(1 - bk, 1.4) : 0;
          if (bk >= 0.6 && bk < 1 && i !== N - 1) open[i] = 1;
          const ic = ics[i]; ic.style.left = x + 'px'; ic.style.width = ic.style.height = w + 'px'; ic.style.transform = `translateY(${by}px)`;
          dots[i].style.left = (x + w / 2) + 'px'; dots[i].style.opacity = open[i] ? '0.9' : '0';
          if (i === hot) { tip.textContent = ICONS[i][0]; tip.style.left = (x + w / 2) + 'px'; tip.style.top = (360 - 14 - w - 34 + by) + 'px'; }
          x += w + GAP;
        }
        tip.style.opacity = hot >= 0 ? '1' : '0';
        if (ghost && t % 8 < 0.05) for (let i = 1; i < N; i++) open[i] = 0;
      };
    },
  });

  // ---------------- bottom sheet with detents ----------------
  EX.add({
    cat: 'ui', id: 'ui2-sheet', kind: 'dom', title: 'Bottom sheet with detents', aka: 'draggable sheet, snap points, velocity projection, rubber band', tool: 'Pointer events + JavaScript (velocity projection, spring, rubber band)', runs: 'WEB',
    notice: 'The sheet snaps to three heights. On release it does not pick the closest height but the one closest to where the flick would carry it: position plus velocity times a short glide time. So a fast flick down from the top skips the middle stop. Pulled past the ends it stretches with a rubber band, and it settles on a spring that keeps the release speed. The rail on the left shows the projection. Drag the sheet yourself.',
    use: 'map and music apps, filters and pickers on mobile, any panel that the user drags open',
    params: [{ key: 'glide', label: 'Glide time', min: 0, max: 0.5, step: 0.01, value: 0.16, unit: ' s' }, { key: 'k', label: 'Spring stiffness', min: 80, max: 600, step: 10, value: 320 }],
    prompt: 'Bottom sheet with three detents (peek, half, full) on a map screen. Track pointer velocity while dragging; on release project the landing point as y + velocity x {glide} and snap to the detent nearest to that projection, animating with a spring (stiffness {k}) that starts with the release velocity. Rubber-band past the top and bottom with (1 - 1 / (x * 0.55 / h + 1)) * h. Dim the map as the sheet reaches full height.',
    setup(st, L) {
      st.innerHTML = `<style>
.u2h-bg{position:absolute;inset:0;background:linear-gradient(160deg,#151428,#0b0b10)}
.u2h-ph{position:absolute;left:236px;top:8px;width:240px;height:344px;border-radius:38px;background:#050507;box-shadow:0 0 0 2px #2a2a33,0 24px 50px rgba(0,0,0,.6)}
.u2h-sc{position:absolute;left:8px;top:8px;width:224px;height:328px;border-radius:30px;overflow:hidden;background:#000}
.domstage canvas.u2h-map{position:absolute;left:0;top:0;width:224px;height:328px;transform-origin:50% 0}
.u2h-dim{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}
.u2h-sh{position:absolute;left:0;right:0;top:0;height:460px;border-radius:22px 22px 0 0;background:#f7f4ee;box-shadow:0 -6px 24px rgba(0,0,0,.25);touch-action:none;cursor:grab;font-family:Segoe UI;color:#1d1b3a;user-select:none}
.u2h-hd{width:36px;height:5px;border-radius:3px;background:#c9c3b6;margin:7px auto 9px}
.u2h-se{margin:0 12px;height:32px;border-radius:10px;background:#e9e4da;display:flex;align-items:center;gap:8px;padding-left:10px;font-size:13px;color:#8a8698}
.u2h-se i{width:11px;height:11px;border:2px solid #8a8698;border-radius:50%;position:relative}.u2h-se i:after{content:'';position:absolute;left:10px;top:10px;width:5px;height:2px;background:#8a8698;transform:rotate(45deg)}
.u2h-ch{display:flex;gap:6px;margin:12px 12px 6px}.u2h-ch b{font:600 11px Segoe UI;padding:6px 10px;border-radius:99px;color:#fff}
.u2h-row{display:flex;gap:10px;align-items:center;margin:0 12px;padding:9px 0;border-bottom:1px solid #e6e0d4}
.u2h-row i{width:30px;height:30px;border-radius:50%;flex:none}.u2h-row b{display:block;font-size:13px}.u2h-row span{font-size:11px;color:#8a8698}
.u2h-rl{position:absolute;left:150px;width:3px;border-radius:2px;background:#2c2b40}
.u2h-tk{position:absolute;left:80px;width:80px;font:12px Segoe UI;color:#5a5872;text-align:right;padding-right:16px;box-sizing:border-box}
.u2h-tk:after{content:'';position:absolute;right:-3px;top:7px;width:12px;height:2px;background:#5a5872}
.u2h-mk{position:absolute;left:144px;width:15px;height:15px;margin-top:-7px;border-radius:50%;background:#ff5a36;box-shadow:0 0 0 4px #ff5a3633}
.u2h-pj{position:absolute;left:140px;width:23px;height:23px;margin-top:-11px;border-radius:50%;border:2px dashed #ffb020;box-sizing:border-box;opacity:0}
.u2h-ar{position:absolute;left:150.5px;width:2px;background:#ffb020;opacity:0}
.u2h-rd{position:absolute;left:500px;font-family:Segoe UI;color:#8a87a0;font-size:12px}.u2h-rd b{display:block;font:700 26px Bahnschrift;color:#f4efe6;margin:2px 0 14px}
.u2h-f{position:absolute;left:0;top:0;z-index:9;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#ffffff40;border:2px solid #fff;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.4)}
</style><div class="u2h-bg"></div>
<div class="u2h-rl"></div><div class="u2h-ar"></div>${['Full', 'Half', 'Peek'].map(n => `<div class="u2h-tk">${n}</div>`).join('')}<div class="u2h-pj"></div><div class="u2h-mk"></div>
<div class="u2h-rd" style="top:110px">Release velocity<b class="u2h-v">0 px/s</b>Snaps to<b class="u2h-to">Peek</b></div>
<div class="u2h-ph"><div class="u2h-sc"><canvas class="u2h-map" width="448" height="656"></canvas><div class="u2h-dim"></div>
<div class="u2h-sh"><div class="u2h-hd"></div><div class="u2h-se"><i></i>Search places</div>
<div class="u2h-ch">${[['Coffee', '#ff5a36'], ['Parks', '#3a9c63'], ['Food', '#ffb020'], ['Transit', '#2bc4e6']].map(([n, c]) => `<b style="background:${c}">${n}</b>`).join('')}</div>
${[['Harbor Roasters', '0.3 km, open now', '#ff5a36'], ['Cedar Park', '0.8 km, trails', '#3a9c63'], ['Night Market', '1.1 km, until 2 am', '#ffb020'], ['Ferry Terminal', '1.6 km, every 20 min', '#2bc4e6'], ['Glass Museum', '2.4 km, 10 to 6', '#7a5cff'], ['Lighthouse Point', '3.0 km, sunset spot', '#1d1b3a']].map(([a, b, c]) => `<div class="u2h-row"><i style="background:${c}"></i><div><b>${a}</b><span>${b}</span></div></div>`).join('')}
</div></div></div><div class="u2h-f"></div>`;
      const q = s => /** @type {HTMLElement} */ (st.querySelector(s));
      const sheet = q('.u2h-sh'), map = /** @type {HTMLCanvasElement} */ (st.querySelector('.u2h-map')), dim = q('.u2h-dim'), mk = q('.u2h-mk'), pj = q('.u2h-pj'), ar = q('.u2h-ar'), vT = q('.u2h-v'), toT = q('.u2h-to'), finger = q('.u2h-f'), rail = q('.u2h-rl');
      const ticks = Array.from(st.querySelectorAll('.u2h-tk')).map(e => /** @type {HTMLElement} */ (e));
      // map: drawn once at 2x
      { const g = map.getContext('2d'); g.scale(2, 2); g.fillStyle = '#ebe6dc'; g.fillRect(0, 0, 224, 328); g.fillStyle = '#bfe3f2'; g.beginPath(); g.moveTo(0, 210); g.bezierCurveTo(60, 190, 120, 260, 224, 230); g.lineTo(224, 328); g.lineTo(0, 328); g.fill();
        g.fillStyle = '#cfe8c4'; g.beginPath(); g.roundRect(120, 40, 80, 60, 10); g.fill(); g.beginPath(); g.roundRect(20, 120, 50, 40, 8); g.fill();
        g.strokeStyle = '#fff'; g.lineCap = 'round'; [[[0, 70], [224, 110]], [[60, 0], [100, 328]], [[0, 170], [224, 150]], [[170, 0], [150, 328]]].forEach(([a, b], i) => { g.lineWidth = i % 2 ? 9 : 6; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); });
        g.strokeStyle = '#ffd27a'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 30); g.quadraticCurveTo(110, 150, 224, 60); g.stroke();
        [[90, 96, C.coral], [150, 140, C.green], [40, 60, C.amber], [180, 190, C.cyan]].forEach(([x, y, c]) => { g.fillStyle = String(c); g.beginPath(); g.arc(+x, +y - 10, 8, Math.PI * 0.85, Math.PI * 0.15); g.lineTo(+x, +y); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(+x, +y - 11, 3, 0, 7); g.fill(); }); }
      const D = [40, 168, 252], NAMES = ['Full', 'Half', 'Peek'], SY = 16;
      ticks.forEach((tk, i) => { tk.style.top = (SY + D[i] - 8) + 'px'; });
      rail.style.top = (SY + D[0]) + 'px'; rail.style.height = (D[2] - D[0]) + 'px';
      const y = sp(D[2]); let drag = null, now = 0, userAt = -99, relAt = -99, relY = 0, projY = 0, vel = 0, fDown = 0, userDrag = false;
      const rb = (x, d) => (1 - 1 / (x * 0.55 / d + 1)) * d;
      const press = (py) => { drag = { y0: py, s0: y.x, raw: y.x, last: py, lt: now }; vel = 0; };
      const move = (py) => { if (!drag) return; const dt = Math.max(0.008, now - drag.lt); vel = lerp(vel, (py - drag.last) / dt, 0.45); drag.last = py; drag.lt = now; const raw = drag.s0 + py - drag.y0; y.x = raw < D[0] ? D[0] - rb(D[0] - raw, 300) : raw > D[2] ? D[2] + rb(raw - D[2], 300) : raw; y.v = 0; };
      const release = () => { if (!drag) return; drag = null; projY = y.x + vel * L.p.glide; let best = 0; D.forEach((d, i) => { if (Math.abs(projY - d) < Math.abs(projY - D[best])) best = i; }); y.to = D[best]; y.v = vel; relAt = now; relY = y.x; vT.textContent = (Math.round(vel) || 0).toLocaleString('en-US') + ' px/s'; toT.textContent = NAMES[best]; };
      sheet.onpointerdown = e => { userAt = now; userDrag = true; fDown = 0; sheet.setPointerCapture(e.pointerId); sheet.style.cursor = 'grabbing'; press(local(st, e).y); };
      sheet.onpointermove = e => { if (userDrag) { userAt = now; move(local(st, e).y); } };
      sheet.onpointerup = () => { if (userDrag) { userDrag = false; userAt = now; release(); } sheet.style.cursor = 'grab'; };
      const KEYS = [[0, 356, 330, 0], [0.4, 356, 290, 0], [0.6, 356, 290, 1], [1.6, 356, 210, 1], [1.75, 356, 210, 0], [2.4, 356, 214, 0], [2.6, 356, 214, 1], [2.75, 356, 150, 0], [3.9, 356, 80, 0], [4.2, 356, 80, 1], [4.38, 356, 190, 0], [5.4, 356, 300, 0], [7, 356, 330, 0]];
      return (t, dt) => {
        now = t;
        if (!userDrag && t - userAt > 4) {
          const lt = t % 7; let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= lt) i++;
          const [t0, x0, y0, d0] = KEYS[i], [t1, x1, y1] = KEYS[i + 1], k = clamp01((lt - t0) / (t1 - t0)), kk = d0 ? k : ease.inOut(k);
          const fx = lerp(x0, x1, kk), fy = lerp(y0, y1, kk);
          if (d0 && !fDown) press(fy); else if (!d0 && fDown) release();
          fDown = d0; if (fDown) move(fy);
          finger.style.transform = `translate(${fx}px,${fy}px) scale(${fDown ? 0.82 : 1})`; finger.style.opacity = String(clamp01(Math.min(lt * 3, (6.6 - lt) * 3)));
        } else finger.style.opacity = '0';
        if (!drag) spring(y, L.p.k, 2 * Math.sqrt(L.p.k) * 0.8, dt);
        const sy = y.x; sheet.style.transform = `translateY(${sy}px)`;
        const full = clamp01((D[1] - sy) / (D[1] - D[0]));
        dim.style.opacity = String(0.4 * full); map.style.transform = `scale(${1 - 0.06 * full}) translateY(${-10 * full}px)`; map.style.borderRadius = (14 * full) + 'px';
        mk.style.top = (SY + sy) + 'px';
        const pk = 1 - seg(t - relAt, 0.9, 1.5); const pjy = Math.max(D[0] - 30, Math.min(D[2] + 30, projY));
        pj.style.top = (SY + pjy) + 'px'; pj.style.opacity = String(pk);
        ar.style.top = (SY + Math.min(relY, pjy)) + 'px'; ar.style.height = Math.abs(pjy - relY) + 'px'; ar.style.opacity = String(pk * 0.8);
      };
    },
  });

  // ---------------- elastic tab indicator ----------------
  EX.add({
    cat: 'ui', id: 'ui2-tabs', kind: 'dom', title: 'Elastic tab indicator', aka: 'worm indicator, stretchy tabs, swipeable tab pages, sliding pill', tool: 'DOM + JavaScript (two springs per indicator edge)', runs: 'WEB',
    notice: 'The pill under the active tab has two edges, each on its own spring. The edge in front is stiff and the edge behind is soft, so the pill stretches toward the new tab and then catches up, like a worm. The pages below are one strip: drag it and the pill follows your finger between tabs, then a flick decides the page. Click a tab or drag the pages.',
    use: 'tab bars and segmented controls, onboarding pagers, settings sections, dashboards with views',
    params: [{ key: 'lead', label: 'Leading edge stiffness', min: 100, max: 1200, step: 20, value: 700 }, { key: 'trail', label: 'Trailing edge stiffness', min: 40, max: 1200, step: 20, value: 160 }],
    prompt: 'Tab bar with an elastic pill indicator: the left and right edges of the pill are separate springs; the edge moving toward the new tab uses stiffness {lead}, the trailing edge {trail}, so the pill stretches and then contracts. Pages below sit in one horizontal strip that can be dragged; the indicator interpolates between tab rectangles with the drag progress, and on release a velocity projection picks the page. Labels crossfade from grey to dark as the pill passes under them.',
    setup(st, L) {
      const TABS = ['Overview', 'Activity', 'Files', 'Settings'];
      st.innerHTML = `<style>
.u2t-bg{position:absolute;inset:0;background:radial-gradient(80% 100% at 50% 0,#1d1b3a,#0b0b10)}
.u2t-pn{position:absolute;left:40px;top:18px;width:560px;height:324px;border-radius:18px;background:#15141f;box-shadow:0 20px 50px rgba(0,0,0,.45),inset 0 0 0 1px #ffffff10;font-family:Segoe UI;overflow:hidden}
.u2t-tr{position:absolute;left:20px;top:18px;height:40px;border-radius:13px;background:#0d0c15;display:flex;padding:0 4px}
.u2t-ind{position:absolute;top:4px;height:32px;border-radius:10px;background:linear-gradient(135deg,#ff5a36,#ffb020);box-shadow:0 4px 16px #ff5a3655}
.u2t-tb{position:relative;z-index:1;padding:0 21px;font:600 14px/40px Segoe UI;color:#8a87a0;cursor:pointer;white-space:nowrap}
.u2t-vp{position:absolute;left:20px;top:74px;width:520px;height:232px;overflow:hidden;cursor:grab;touch-action:none;user-select:none}
.u2t-st{position:absolute;left:0;top:0;height:100%;display:flex}
.u2t-pg{width:520px;height:100%;flex:none;box-sizing:border-box;padding-right:20px;position:relative;color:#f4efe6}
.u2t-tile{position:absolute;border-radius:14px;background:#1e1d2c;padding:14px;box-sizing:border-box}
.u2t-tile span{font-size:12px;color:#8a87a0}.u2t-tile b{display:block;font:700 30px Bahnschrift;margin-top:4px}
.u2t-row{display:flex;align-items:center;gap:12px;height:46px;border-bottom:1px solid #24233a;font-size:13px}.u2t-row i{width:30px;height:30px;border-radius:50%;flex:none}.u2t-row em{margin-left:auto;font-style:normal;color:#8a87a0;font-size:12px}
.u2t-fl{position:absolute;width:112px;height:100px;border-radius:12px;background:#1e1d2c}.u2t-fl i{position:absolute;left:14px;top:14px;width:34px;height:42px;border-radius:5px}.u2t-fl span{position:absolute;left:14px;bottom:12px;font-size:12px}
.u2t-sw{margin-left:auto;width:40px;height:24px;border-radius:12px;position:relative}.u2t-sw b{position:absolute;top:3px;width:18px;height:18px;border-radius:50%;background:#fff}
.u2t-cur{position:absolute;left:0;top:0;z-index:5;pointer-events:none}
</style><div class="u2t-bg"></div><div class="u2t-pn">
<div class="u2t-tr"><div class="u2t-ind"></div>${TABS.map(n => `<div class="u2t-tb">${n}</div>`).join('')}</div>
<div style="position:absolute;right:62px;top:27px;width:22px;height:22px;border-radius:7px;border:2px solid #3a3858;box-sizing:border-box"></div><div style="position:absolute;right:20px;top:22px;width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2bc4e6,#7a5cff);font:700 12px/32px Bahnschrift;text-align:center;color:#0b0b10">MS</div>
<div class="u2t-vp"><div class="u2t-st">
<div class="u2t-pg"><div class="u2t-tile" style="left:0;top:0;width:160px;height:96px"><span>Visitors</span><b>48.2k</b></div><div class="u2t-tile" style="left:170px;top:0;width:160px;height:96px"><span>Avg. time</span><b>3:41</b></div><div class="u2t-tile" style="left:340px;top:0;width:160px;height:96px"><span>Bounce</span><b style="color:#5fd38d">-12%</b></div>
<div class="u2t-tile" style="left:0;top:106px;width:500px;height:118px">${[0.4, 0.62, 0.5, 0.78, 0.66, 0.9, 0.72, 0.84, 0.58, 0.95, 0.8, 0.88].map((v, i) => `<i style="position:absolute;bottom:14px;left:${16 + i * 39}px;width:24px;height:${Math.round(v * 84)}px;border-radius:5px;background:${i === 9 ? '#ff5a36' : '#3a3858'}"></i>`).join('')}</div></div>
<div class="u2t-pg">${[['Mia pushed 3 commits', '2 min', '#2bc4e6'], ['Ravi commented on Reel v4', '18 min', '#ffb020'], ['Render finished: 3,600 frames', '1 h', '#5fd38d'], ['Lena invited you to Shaders', '3 h', '#7a5cff'], ['Weekly report is ready', '1 d', '#ff5a36']].map(([a, b, c]) => `<div class="u2t-row"><i style="background:${c}"></i>${a}<em>${b}</em></div>`).join('')}</div>
<div class="u2t-pg">${[['reel.mp4', '#ff5a36'], ['fluid.frag', '#2bc4e6'], ['cover.png', '#ffb020'], ['notes.md', '#8a87a0'], ['mix.wav', '#7a5cff'], ['scene.blend', '#5fd38d'], ['logo.svg', '#ff5a36'], ['data.csv', '#2bc4e6']].map(([n, c], i) => `<div class="u2t-fl" style="left:${(i % 4) * 126}px;top:${Math.floor(i / 4) * 112}px"><i style="background:linear-gradient(135deg,${c},${c}66)"></i><span>${n}</span></div>`).join('')}</div>
<div class="u2t-pg">${[['Reduce motion', 0], ['Autoplay previews', 1], ['Spring physics', 1], ['Sound effects', 0], ['Show frame rate', 1]].map(([n, on]) => `<div class="u2t-row">${n}<div class="u2t-sw" style="background:${on ? '#5fd38d' : '#3a3858'}"><b style="left:${on ? 19 : 3}px"></b></div></div>`).join('')}</div>
</div></div></div><div class="u2t-cur">${arrow}</div>`;
      const q = s => /** @type {HTMLElement} */ (st.querySelector(s));
      const ind = q('.u2t-ind'), strip = q('.u2t-st'), vp = q('.u2t-vp'), cur = q('.u2t-cur'), tabs = Array.from(st.querySelectorAll('.u2t-tb')).map(e => /** @type {HTMLElement} */ (e));
      const tl = tabs.map(e => e.offsetLeft), tw = tabs.map(e => e.offsetWidth), N = TABS.length;
      const p = sp(0), le = sp(tl[0]), re = sp(tl[0] + tw[0]);
      let now = 0, userAt = -99, drag = null, vel = 0, ghostDown = false;
      const go = (i) => { p.to = Math.max(0, Math.min(N - 1, i)); };
      const press = (x) => { drag = { x0: x, p0: p.x, lx: x, lt: now }; vel = 0; };
      const move = (x) => { if (!drag) return; const dt = Math.max(0.008, now - drag.lt); const raw = drag.p0 - (x - drag.x0) / 520; vel = lerp(vel, -(x - drag.lx) / 520 / dt, 0.45); drag.lx = x; drag.lt = now; p.x = raw < 0 ? -0.25 * (1 - 1 / (1 - raw * 2)) : raw > N - 1 ? N - 1 + 0.25 * (1 - 1 / (1 + (raw - N + 1) * 2)) : raw; p.v = 0; };
      const release = () => { if (!drag) return; drag = null; go(Math.round(p.x + vel * 0.22)); p.v = vel; };
      tabs.forEach((tb, i) => { tb.onclick = () => { userAt = now; go(i); }; });
      vp.onpointerdown = e => { userAt = now; vp.setPointerCapture(e.pointerId); vp.style.cursor = 'grabbing'; press(local(st, e).x); };
      vp.onpointermove = e => { if (drag && !ghostDown) { userAt = now; move(local(st, e).x); } };
      vp.onpointerup = () => { if (drag && !ghostDown) { userAt = now; release(); } vp.style.cursor = 'grab'; };
      const tabPt = i => [40 + 20 + tl[i] + tw[i] / 2, 18 + 18 + 22];
      return (t, dt) => {
        now = t;
        let gx = 700, gy = 400, pressV = false;
        if (t - userAt > 3 && !(drag && !ghostDown)) {
          const lt = t % 9, mv = (a, b, c, d) => { const k = ease.inOut(seg(lt, c, d)); gx = lerp(a[0], b[0], k); gy = lerp(a[1], b[1], k); };
          const T1 = tabPt(1), T3 = tabPt(3), T0 = tabPt(0), P0 = [220, 200], P1 = [430, 200], OUT = [660, 380];
          if (lt < 1.0) mv(OUT, T1, 0.2, 0.95); else if (lt < 2.5) mv(T1, T3, 1.7, 2.45); else if (lt < 4.0) mv(T3, P0, 3.2, 3.95); else if (lt < 4.9) mv(P0, P1, 4.05, 4.85); else if (lt < 6.5) mv(P1, T0, 5.5, 6.45); else mv(T0, OUT, 7.4, 8.4);
          const click = (at, i) => { if (lt >= at && lt - dt < at) go(i); if (lt >= at && lt < at + 0.12) pressV = true; };
          click(1.0, 1); click(2.5, 3); click(6.5, 0);
          const down = lt >= 4.0 && lt < 4.9;
          if (down && !ghostDown) { ghostDown = true; press(gx); } else if (!down && ghostDown) { ghostDown = false; release(); }
          if (ghostDown) { move(gx); pressV = true; }
          cur.style.opacity = '1';
        } else { cur.style.opacity = '0'; if (ghostDown) { ghostDown = false; release(); } }
        cur.style.transform = `translate(${gx}px,${gy}px) scale(${pressV ? 0.85 : 1})`;
        if (!drag) spring(p, 260, 26, dt);
        const pc = Math.max(0, Math.min(N - 1, p.x)), i0 = Math.min(N - 2, Math.floor(pc)), f = pc - i0;
        const tL = lerp(tl[i0], tl[i0 + 1], f), tR = lerp(tl[i0] + tw[i0], tl[i0 + 1] + tw[i0 + 1], f);
        le.to = tL; re.to = tR;
        const right = tL > le.x, kL = right ? L.p.trail : L.p.lead, kR = right ? L.p.lead : L.p.trail;
        spring(le, kL, 2 * Math.sqrt(kL) * 0.9, dt); spring(re, kR, 2 * Math.sqrt(kR) * 0.9, dt);
        const over = p.x < 0 ? p.x * 60 : p.x > N - 1 ? (p.x - N + 1) * 60 : 0;
        ind.style.left = (le.x + over) + 'px'; ind.style.width = Math.max(20, re.x - le.x) + 'px';
        strip.style.transform = `translateX(${-p.x * 520}px)`;
        tabs.forEach((tb, i) => { const w = clamp01(1 - Math.abs(pc - i)); const c = (a, b) => Math.round(lerp(a, b, w)); tb.style.color = `rgb(${c(138, 20)},${c(135, 8)},${c(160, 6)})`; });
      };
    },
  });

  // ---------------- pull to refresh ----------------
  EX.add({
    cat: 'ui', id: 'ui2-pull', kind: 'dom', title: 'Pull to refresh', aka: 'rubber band overscroll, gum drop refresh, elastic list', tool: 'Pointer events + SVG + JavaScript (rubber band, springs)', runs: 'WEB',
    notice: 'Pull the feed down and it follows the finger less and less: the rubber band that phones use at the edge of a list. A grey drop stretches as you pull; past the threshold it is ready, and on release it snaps into a spinner while the list holds open. New posts then slide in at the top and the list springs shut. The chart plots finger travel against how far the list really moves. Drag the feed down yourself.',
    use: 'feeds, inboxes and any list that loads new items, elastic edges of scroll views',
    params: [{ key: 'th', label: 'Refresh threshold', min: 40, max: 110, step: 5, value: 80, unit: ' px' }, { key: 'c', label: 'Rubber band constant', min: 0.2, max: 1.2, step: 0.05, value: 0.55 }],
    prompt: 'Pull to refresh on a mobile feed: the list follows the finger through a rubber band, offset = (1 - 1 / (travel x {c} / 330 + 1)) x 330. A grey gum drop above the list stretches with the pull (two circles joined by curved sides, the lower one shrinking); past {th} the label says release, and on release the drop snaps into an 8-bar spinner while the list springs to a 56 px hold. After loading, two new posts expand in at the top with a stagger and the list springs back to 0.',
    setup(st, L) {
      st.innerHTML = `<style>
.u2p-bg{position:absolute;inset:0;background:linear-gradient(160deg,#151428,#0b0b10)}
.u2p-ph{position:absolute;left:236px;top:8px;width:240px;height:344px;border-radius:38px;background:#050507;box-shadow:0 0 0 2px #2a2a33,0 24px 50px rgba(0,0,0,.6)}
.u2p-sc{position:absolute;left:8px;top:8px;width:224px;height:328px;border-radius:30px;overflow:hidden;background:#efeae0;touch-action:none;cursor:grab;user-select:none;font-family:Segoe UI}
.u2p-top{position:absolute;left:0;right:0;top:0;height:46px;background:#f7f4ee;z-index:2;font:700 18px Bahnschrift;color:#1d1b3a;padding:16px 0 0 16px;box-sizing:border-box;box-shadow:0 1px 0 #e0d9cc}
.u2p-dr{position:absolute;left:0;top:46px;width:224px;height:140px}
.u2p-ls{position:absolute;left:0;right:0;top:46px;background:#f7f4ee;min-height:400px}
.u2p-row{display:flex;gap:10px;padding:0 14px;overflow:hidden;border-bottom:1px solid #e6e0d4;align-items:center}
.u2p-row i{width:34px;height:34px;border-radius:50%;flex:none}.u2p-row b{display:block;font-size:13px;color:#1d1b3a}.u2p-row span{font-size:11px;color:#8a8698}
.u2p-new{background:#fff6e6}
.u2p-st{position:absolute;left:498px;top:140px;width:130px;font:12px Segoe UI;color:#8a87a0}.u2p-st b{display:block;font:700 22px/1.15 Bahnschrift;color:#f4efe6;margin-top:4px}
.u2p-f{position:absolute;left:0;top:0;z-index:9;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#ffffff40;border:2px solid #fff;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.4)}
</style><div class="u2p-bg"></div>
<svg style="position:absolute;left:24px;top:60px" width="190" height="240" viewBox="0 0 190 240" font-family="Segoe UI" font-size="10" fill="#8a87a0">
<text x="0" y="10" fill="#f4efe6" font-size="12" font-weight="600">Rubber band</text>
<path d="M30 210H180M30 210V30" stroke="#3a3858" stroke-width="1.5" fill="none"/><text x="180" y="226" text-anchor="end">finger travel</text><text x="26" y="40" text-anchor="end" transform="rotate(-90 26 40)" dy="-6">list offset</text>
<path d="M30 210L90 30" stroke="#3a3858" stroke-dasharray="4 4" fill="none"/><text x="94" y="40">1:1</text>
<path class="u2p-th" stroke="#ffb020" stroke-dasharray="3 3" fill="none"/><text class="u2p-tht" x="180" text-anchor="end" fill="#ffb020">refresh</text>
<path class="u2p-cv" stroke="#2bc4e6" stroke-width="2.5" fill="none"/><circle class="u2p-dot" r="5" fill="#ff5a36"/></svg>
<div class="u2p-st">State<b class="u2p-sl">Pull down</b></div>
<div class="u2p-ph"><div class="u2p-sc"><div class="u2p-top">Feed</div>
<svg class="u2p-dr" viewBox="0 0 224 140"><path class="u2p-drop" fill="#a8a3b5"/><g class="u2p-arw" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M5 -1A5.5 5.5 0 1 1 1 -5.4"/><path d="M-1.5 -8.5L1.5 -5.5L-1.5 -2.5"/></g>
<g class="u2p-spin">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="-1.5" y="-11" width="3" height="6.5" rx="1.5" fill="#5a5872" transform="rotate(${i * 45})"/>`).join('')}</g></svg>
<div class="u2p-ls">${[['Ravi Patel', 'Shipped spring presets', '#2bc4e6', 1], ['Mia Chen', 'Fluid sim now runs at 120 fps', '#ff5a36', 1], ['Lena Ortiz', 'Shared 12 new loaders', '#7a5cff', 0], ['Sam Okafor', 'Who wants to review the reel?', '#ffb020', 0], ['Noor Haddad', 'Page curl shader is in', '#5fd38d', 0], ['Jon Weiss', 'Coffee at 4?', '#1d1b3a', 0], ['Ada Kim', 'Ray marcher went live', '#2bc4e6', 0]].map(([a, b, c, n]) => `<div class="u2p-row${n ? ' u2p-new' : ''}" style="height:${n ? 0 : 56}px"><i style="background:${c}"></i><div><b>${a}</b><span>${b}</span></div></div>`).join('')}</div>
</div></div><div class="u2p-f"></div>`;
      const q = s => /** @type {HTMLElement} */ (st.querySelector(s));
      const sc = q('.u2p-sc'), ls = q('.u2p-ls'), drop = q('.u2p-drop'), arw = q('.u2p-arw'), spin = q('.u2p-spin'), sl = q('.u2p-sl'), dot = q('.u2p-dot'), cvP = q('.u2p-cv'), thP = q('.u2p-th'), thT = q('.u2p-tht'), finger = q('.u2p-f');
      const news = Array.from(st.querySelectorAll('.u2p-new')).map(e => /** @type {HTMLElement} */ (e)), bars = Array.from(spin.children).map(e => /** @type {SVGElement} */ (e));
      const D = 330, rb = x => (1 - 1 / (x * L.p.c / D + 1)) * D, inv = y => D / L.p.c * (1 / (1 - Math.min(y, D - 1) / D) - 1);
      const gx = x => 30 + x / 300 * 150, gy = y => 210 - y / 120 * 180;
      const off = sp(0); let state = 'idle', drag = null, now = 0, userAt = -99, loadAt = -99, newK = 0, newTo = 0, fDown = 0, userDrag = false, travel = 0, lastC = -1;
      const press = y => { if (state === 'loading') return; drag = { y0: y, t0: inv(Math.max(0, off.x)) }; state = 'pull'; };
      const move = y => { if (!drag) return; travel = Math.max(0, drag.t0 + y - drag.y0); off.x = rb(travel); off.v = 0; };
      const release = () => { if (!drag) return; drag = null; if (off.x >= L.p.th) { state = 'loading'; loadAt = now; off.to = 56; newTo = 0; } else { state = 'idle'; off.to = 0; } };
      sc.onpointerdown = e => { userAt = now; userDrag = true; fDown = 0; drag = null; sc.setPointerCapture(e.pointerId); sc.style.cursor = 'grabbing'; press(local(st, e).y); };
      sc.onpointermove = e => { if (userDrag) { userAt = now; move(local(st, e).y); } };
      sc.onpointerup = () => { if (userDrag) { userDrag = false; userAt = now; release(); } sc.style.cursor = 'grab'; };
      const KEYS = [[0, 356, 380, 0], [0.4, 356, 110, 0], [0.6, 356, 110, 1], [2.4, 356, 330, 1], [2.5, 356, 330, 0], [3.2, 356, 380, 0], [4.9, 356, 140, 0], [5.1, 356, 140, 1], [5.8, 356, 230, 1], [5.9, 356, 230, 0], [6.6, 356, 380, 0], [8, 356, 380, 0]];
      return (t, dt) => {
        now = t;
        if (!userDrag && t - userAt > 4) {
          const lt = t % 8; let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= lt) i++;
          const [t0, x0, y0, d0] = KEYS[i], [t1, x1, y1] = KEYS[i + 1], kk = ease.inOut(clamp01((lt - t0) / (t1 - t0)));
          const fx = lerp(x0, x1, kk), fy = lerp(y0, y1, kk);
          if (d0 && !fDown) press(fy); else if (!d0 && fDown) release();
          fDown = d0; if (fDown) move(fy);
          if (lt > 7.2 && state === 'idle') newTo = 0;
          finger.style.transform = `translate(${fx}px,${fy}px) scale(${fDown ? 0.82 : 1})`; finger.style.opacity = String(clamp01(Math.min(lt * 3, (7.6 - lt) * 3)) * (lt > 3.2 && lt < 4.9 ? 0 : 1));
        } else finger.style.opacity = '0';
        if (state === 'loading' && t - loadAt > 1.4) { state = 'done'; off.to = 0; newTo = 1; }
        if (state === 'done' && Math.abs(off.x) < 0.5 && t - loadAt > 2.6) state = 'idle';
        if (!drag) spring(off, 300, 26, dt);
        newK += Math.sign(newTo - newK) * Math.min(Math.abs(newTo - newK), dt / 0.45);
        news.forEach((r, i) => { const k = ease.out(clamp01(newK * 1.6 - i * 0.6)); r.style.height = (56 * k) + 'px'; r.style.opacity = String(k); });
        const o = Math.max(0, off.x); ls.style.transform = `translateY(${off.x}px)`;
        // gum drop: two circles joined by curved sides
        const vis = state === 'loading' || state === 'done' ? 0 : clamp01((o - 26) / 14), s = clamp01((o - 40) / Math.max(10, L.p.th - 40));
        const r1 = 13 - s * 3, r2 = 13 - s * 8.5, y1 = 22, y2 = 22 + s * Math.max(0, o - 50) * 0.75, cx = 112;
        drop.setAttribute('d', `M${cx - r1} ${y1}A${r1} ${r1} 0 0 1 ${cx + r1} ${y1}Q${cx + r1 * 0.9} ${(y1 + y2) / 2} ${cx + r2} ${y2}A${r2} ${r2} 0 0 1 ${cx - r2} ${y2}Q${cx - r1 * 0.9} ${(y1 + y2) / 2} ${cx - r1} ${y1}Z`);
        drop.style.opacity = String(vis); arw.style.opacity = String(vis); arw.setAttribute('transform', `translate(${cx} ${y1}) rotate(${o * 3}) scale(${r1 / 13})`);
        const sk = state === 'loading' ? clamp01((t - loadAt) / 0.2) : state === 'done' ? 1 - clamp01((t - loadAt - 1.4) / 0.25) : 0;
        spin.setAttribute('transform', `translate(${cx} ${Math.max(14, o / 2)}) scale(${0.6 + 0.4 * sk})`); spin.style.opacity = String(sk);
        const step = Math.floor(t * 12) % 8; bars.forEach((b, i) => { b.style.opacity = String(0.2 + 0.8 * (((i - step) % 8 + 8) % 8) / 7); });
        sl.textContent = state === 'loading' ? 'Refreshing' : state === 'done' ? 'Up to date' : drag && o >= L.p.th ? 'Release to refresh' : 'Pull down';
        sl.style.color = drag && o >= L.p.th ? '#ffb020' : '#f4efe6';
        if (lastC !== L.p.c) { lastC = L.p.c; let d = ''; for (let x = 0; x <= 300; x += 10) d += (x ? 'L' : 'M') + gx(x).toFixed(1) + ' ' + gy(Math.min(120, rb(x))).toFixed(1); cvP.setAttribute('d', d); }
        thP.setAttribute('d', `M30 ${gy(L.p.th)}H180`); thT.setAttribute('y', String(gy(L.p.th) - 5));
        const tr = drag ? travel : inv(o); dot.setAttribute('cx', String(gx(Math.min(300, tr)))); dot.setAttribute('cy', String(gy(Math.min(120, o))));
      };
    },
  });

  // ---------------- cover flow ----------------
  EX.add({
    cat: 'ui', id: 'ui2-coverflow', kind: 'dom', title: 'Cover flow carousel', aka: 'coverflow, 3D carousel, momentum scrolling, snap carousel', tool: 'CSS 3D transforms + JavaScript (momentum, friction, snap spring)', runs: 'WEB',
    notice: 'Album covers stand in a 3D row: the centre one faces you, the others turn away and stack tight behind it. Drag sideways and let go: the row keeps its speed and slows down with friction, then a spring snaps the nearest cover to the centre. The floor reflection is a CSS box reflection. Drag the row, or click a side cover to bring it forward.',
    use: 'media libraries, product pickers, portfolio galleries, onboarding carousels',
    params: [{ key: 'fric', label: 'Friction', min: 0.5, max: 8, step: 0.1, value: 2.6, unit: ' /s' }, { key: 'angle', label: 'Side angle', min: 0, max: 80, step: 1, value: 60, unit: ' deg' }],
    prompt: 'Cover-flow carousel in CSS 3D: 8 album covers, the centre one flat and forward, the others rotateY({angle}) and stacked 48 px apart behind it, perspective 900 px, -webkit-box-reflect reflections on a dark floor. Dragging moves the row one cover per 150 px; on release keep the velocity and decay it with friction {fric}, then snap the nearest cover to the centre with a spring. The row wraps around forever. Title and artist fade up when the centre cover changes.',
    setup(st, L) {
      st.innerHTML = `<style>
.u2f-bg{position:absolute;inset:0;background:linear-gradient(#0b0b10 0,#16142a 58%,#07070b 58.2%,#0b0b10 100%)}
.u2f-st{position:absolute;inset:0;perspective:900px;perspective-origin:50% 40%;touch-action:none;cursor:grab;user-select:none}
.u2f-cv{position:absolute;left:235px;top:38px;width:170px;height:170px;border-radius:12px;-webkit-box-reflect:below 3px linear-gradient(transparent 55%,#ffffff40);will-change:transform}
.u2f-cv canvas{display:block;width:170px;height:170px;border-radius:12px}
.u2f-tt{position:absolute;left:0;right:0;top:292px;text-align:center;font:600 17px Segoe UI;color:#f4efe6;pointer-events:none}.u2f-tt span{display:block;font:13px Segoe UI;color:#8a87a0;margin-top:2px}
.u2f-dots{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:center;gap:6px;pointer-events:none}.u2f-dots i{width:6px;height:6px;border-radius:3px;background:#3a3858}
</style><div class="u2f-bg"></div><div class="u2f-st">${ALBUMS.map((_, i) => `<div class="u2f-cv" data-i="${i}"><canvas width="340" height="340"></canvas></div>`).join('')}</div>
<div class="u2f-tt"><b class="u2f-a"></b><span class="u2f-b"></span></div><div class="u2f-dots">${ALBUMS.map(() => '<i></i>').join('')}</div>`;
      const q = s => /** @type {HTMLElement} */ (st.querySelector(s));
      const stage = q('.u2f-st'), tt = q('.u2f-tt'), ta = q('.u2f-a'), tb = q('.u2f-b');
      const cvs = Array.from(st.querySelectorAll('.u2f-cv')).map(e => /** @type {HTMLElement} */ (e)), dots = Array.from(st.querySelectorAll('.u2f-dots i')).map(e => /** @type {HTMLElement} */ (e));
      cvs.forEach((c, i) => { const g = /** @type {HTMLCanvasElement} */ (c.firstElementChild).getContext('2d'); g.scale(2, 2); paintCover(g, 0, 0, 170, i); });
      const N = ALBUMS.length, wrap = o => ((o + N / 2) % N + N) % N - N / 2;
      const ps = sp(0); let p = 0, v = 0, mode = 'snap', drag = null, now = 0, userAt = -99, shown = -1, shownAt = 0, autoN = 0, autoAt = 0;
      const snapTo = (target, vel) => { mode = 'snap'; ps.x = p; ps.v = vel; ps.to = target; };
      stage.onpointerdown = e => { userAt = now; stage.setPointerCapture(e.pointerId); stage.style.cursor = 'grabbing'; const x = local(st, e).x; drag = { x0: x, p0: p, lx: x, lt: now, moved: 0, el: /** @type {HTMLElement} */ (e.target).closest('.u2f-cv') }; mode = 'drag'; v = 0; };
      stage.onpointermove = e => { if (!drag) return; userAt = now; const x = local(st, e).x, dt = Math.max(0.008, now - drag.lt); drag.moved = Math.max(drag.moved, Math.abs(x - drag.x0)); p = drag.p0 - (x - drag.x0) / 150; v = lerp(v, -(x - drag.lx) / 150 / dt, 0.45); drag.lx = x; drag.lt = now; };
      stage.onpointerup = () => { if (!drag) return; userAt = now; stage.style.cursor = 'grab'; const d = drag; drag = null;
        if (d.moved < 5 && d.el) { const i = +(/** @type {HTMLElement} */ (d.el).dataset.i); snapTo(p + wrap(i - p), 0); } else mode = 'coast'; };
      return (t, dt) => {
        now = t;
        if (!drag && t - userAt > 3 && t - autoAt > 2) {
          autoAt = t; autoN++;
          if (autoN % 4 === 0) { mode = 'coast'; v = 7.5; } else snapTo(Math.round(p) + 1, 0);
        }
        if (drag && now - drag.lt > 0.06) v *= 0.8;
        if (mode === 'coast') { p += v * dt; v *= Math.exp(-L.p.fric * dt); if (Math.abs(v) < 1.4) snapTo(Math.round(p + v * 0.12), v); }
        else if (mode === 'snap') { spring(ps, 190, 21, dt); p = ps.x; }
        for (let i = 0; i < N; i++) {
          const o = wrap(i - p), a = Math.abs(o), sg = Math.sign(o), c = cvs[i];
          const x = sg * (Math.min(a, 1) * 128 + Math.max(0, a - 1) * 48), z = -Math.min(a, 1) * 130 - Math.max(0, a - 1) * 24, ry = -Math.max(-1, Math.min(1, o)) * L.p.angle;
          c.style.transform = `translate3d(${x}px,0,${z}px) rotateY(${ry}deg)`; c.style.zIndex = String(100 - Math.round(a * 10)); c.style.opacity = String(clamp01(3.7 - a));
          c.style.filter = a > 0.02 ? `brightness(${1 - Math.min(a, 2) * 0.22})` : 'none';
        }
        const ci = ((Math.round(p) % N) + N) % N;
        if (ci !== shown) { shown = ci; shownAt = t; ta.textContent = ALBUMS[ci][0]; tb.textContent = ALBUMS[ci][1]; }
        const k = ease.out(seg(t - shownAt, 0, 0.3)); tt.style.opacity = String(k); tt.style.transform = `translateY(${(1 - k) * 8}px)`;
        dots.forEach((d, i) => { d.style.background = i === ci ? '#f4efe6' : '#3a3858'; d.style.width = (i === ci ? 16 : 6) + 'px'; });
      };
    },
  });

  // ---------------- command palette ----------------
  // Fuzzy subsequence match: returns a score and the matched character positions, or null.
  const fuzzy = (q, s) => {
    if (!q) return { score: 0, idx: [] };
    const ls = s.toLowerCase(), idx = []; let qi = 0, score = 0, prev = -2;
    for (let i = 0; i < ls.length && qi < q.length; i++) if (ls[i] === q[qi]) { idx.push(i); score += (prev === i - 1 ? 5 : 1) + (i === 0 ? 5 : ls[i - 1] === ' ' ? 3 : 0); prev = i; qi++; }
    return qi === q.length ? { score: score - ls.length * 0.01, idx } : null;
  };
  EX.add({
    cat: 'ui', id: 'ui2-cmdk', kind: 'dom', title: 'Command palette', aka: 'Ctrl K menu, quick open, fuzzy finder, spotlight search', tool: 'DOM + JavaScript (fuzzy match, springs per row)', runs: 'WEB',
    notice: 'A palette opens over the app with a quick scale and fade while the app dims. Every keystroke runs a fuzzy match: rows that no longer match fade out, the rest slide to their new rank on their own springs, and the matched letters light up. The highlight glides between rows, and Enter flashes the row and closes the palette. Click the card and type, use the arrow keys and Enter, or click a command.',
    use: 'productivity apps, editors and dashboards, site search, any app with many actions',
    params: [{ key: 'row', label: 'Row spring stiffness', min: 80, max: 800, step: 20, value: 380 }],
    prompt: 'Command palette (Ctrl K) over a dimmed app: opens with scale 0.94 to 1 and fade in 180 ms; a fuzzy subsequence match ranks 10 commands on every keystroke, matched letters bold coral; rows are absolutely positioned and each slides to its new rank on its own spring (stiffness {row}); rows that stop matching fade and shrink; the list height springs to fit; the selection highlight glides between rows; Enter flashes the row coral, closes the palette and shows a small toast.',
    setup(st, L) {
      const CMDS = [['New file', 'Ctrl N', C.cyan], ['Open recent', 'Ctrl R', C.violet], ['Animate with spring', 'S', C.coral], ['Add easing curve', 'E', C.amber], ['Toggle animations', 'Ctrl T', C.green], ['Export video', 'Ctrl E', C.coral], ['Render frames', 'F12', C.cyan], ['Go to timeline', 'G T', C.violet], ['Change theme', 'Ctrl J', C.amber], ['Show shortcuts', '?', C.green]];
      st.innerHTML = `<style>
.u2k-app{position:absolute;inset:0;background:#101018;font-family:Segoe UI}
.u2k-side{position:absolute;left:0;top:0;bottom:0;width:120px;background:#0c0c13;border-right:1px solid #1e1d2c}
.u2k-side i{display:block;height:8px;border-radius:4px;background:#24233a;margin:14px 16px 0}
.u2k-ln{position:absolute;left:140px;height:7px;border-radius:4px}
.u2k-dim{position:absolute;inset:0;background:#05050a;opacity:0}
.u2k-pal{position:absolute;left:110px;top:34px;width:420px;border-radius:14px;background:#1b1a28;box-shadow:0 30px 70px rgba(0,0,0,.6),inset 0 0 0 1px #ffffff14;overflow:hidden;transform-origin:50% 0}
.u2k-in{display:flex;align-items:center;gap:10px;height:48px;padding:0 16px;border-bottom:1px solid #2a2940}
.u2k-in input{flex:1;background:none;border:0;outline:0;color:#f4efe6;font:16px Segoe UI;caret-color:#ff5a36}
.u2k-in input::placeholder{color:#5a5872}
.u2k-ls{position:relative;overflow:hidden}
.u2k-hl{position:absolute;left:8px;right:8px;top:6px;height:36px;border-radius:9px;background:#2a2940}
.u2k-it{position:absolute;left:8px;right:8px;top:6px;height:36px;display:flex;align-items:center;gap:12px;padding:0 10px;border-radius:9px;color:#c9c5d8;font-size:14px;cursor:pointer}
.u2k-it i{width:20px;height:20px;border-radius:6px;flex:none}.u2k-it b{color:#ff5a36;font-weight:700}
.u2k-it kbd{margin-left:auto;font:11px Cascadia Mono,Consolas,monospace;color:#8a87a0;background:#24233a;border-radius:5px;padding:2px 6px}
.u2k-none{position:absolute;left:0;right:0;top:14px;text-align:center;color:#5a5872;font-size:13px}
.u2k-ft{display:flex;gap:14px;height:30px;align-items:center;padding:0 16px;border-top:1px solid #2a2940;font-size:11px;color:#5a5872}
.u2k-hint{position:absolute;left:0;right:0;bottom:16px;display:flex;justify-content:center;gap:6px;font:12px Segoe UI;color:#8a87a0;align-items:center}
.u2k-hint kbd{font:600 12px Segoe UI;color:#f4efe6;background:#24233a;border-radius:6px;padding:4px 9px;box-shadow:0 2px 0 #0b0b10;display:inline-block}
.u2k-toast{position:absolute;left:50%;bottom:52px;padding:9px 16px;border-radius:10px;background:#f4efe6;color:#1d1b3a;font:600 13px Segoe UI;transform:translateX(-50%);opacity:0;white-space:nowrap}
</style><div class="u2k-app"><div class="u2k-side">${'<i></i>'.repeat(7)}</div>
${[[30, 220, '#3a3858'], [52, 300, '#7a5cff66'], [74, 180, '#2bc4e655'], [96, 340, '#3a3858'], [118, 260, '#ff5a3655'], [140, 200, '#3a3858'], [162, 380, '#ffb02055'], [184, 240, '#3a3858'], [206, 310, '#5fd38d55'], [228, 170, '#3a3858'], [250, 280, '#3a3858'], [272, 220, '#7a5cff66']].map(([y, w, c]) => `<div class="u2k-ln" style="top:${y}px;width:${w}px;background:${c}"></div>`).join('')}</div>
<div class="u2k-dim"></div>
<div class="u2k-pal"><div class="u2k-in"><svg width="18" height="18" viewBox="0 0 18 18"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="#8a87a0" stroke-width="2"/><path d="M12 12l4 4" stroke="#8a87a0" stroke-width="2" stroke-linecap="round"/></svg><input placeholder="Type a command" spellcheck="false"></div>
<div class="u2k-ls"><div class="u2k-hl"></div>${CMDS.map(([n, k, c]) => `<div class="u2k-it"><i style="background:${c}"></i><span>${n}</span><kbd>${k}</kbd></div>`).join('')}<div class="u2k-none">No matching commands</div></div>
<div class="u2k-ft"><span>Up and down to move</span><span>Enter to run</span><span>Esc to close</span></div></div>
<div class="u2k-toast"></div><div class="u2k-hint"><kbd class="u2k-k1">Ctrl</kbd><kbd class="u2k-k2">K</kbd><span>&nbsp;in the demo. Click here and type to try it.</span></div>`;
      const q = s => /** @type {HTMLElement} */ (st.querySelector(s));
      const pal = q('.u2k-pal'), dim = q('.u2k-dim'), ls = q('.u2k-ls'), hl = q('.u2k-hl'), none = q('.u2k-none'), toast = q('.u2k-toast'), k1 = q('.u2k-k1'), k2 = q('.u2k-k2');
      const inp = /** @type {HTMLInputElement} */ (st.querySelector('.u2k-in input'));
      const items = Array.from(st.querySelectorAll('.u2k-it')).map((e, i) => ({ el: /** @type {HTMLElement} */ (e), lab: /** @type {HTMLElement} */ (e.children[1]), name: CMDS[i][0], y: sp(i * 36), v: sp(1), rank: i }));
      const openK = sp(0), hy = sp(0), lh = sp(36 * 5 + 12), hint = q('.u2k-hint'); let open = false, sel = 0, n = items.length, now = 0, userAt = -99, flashAt = -99, toastAt = -99, lastQ = null, pressAt = -99, closing = false;
      const filter = () => {
        const qv = inp.value.trim().toLowerCase(); if (qv === lastQ) return; lastQ = qv;
        const res = items.map((it, i) => ({ it, i, m: fuzzy(qv, it.name) })).filter(r => r.m).sort((a, b) => b.m.score - a.m.score || a.i - b.i);
        items.forEach(it => { it.rank = -1; });
        res.forEach((r, k) => { r.it.rank = k; r.it.lab.innerHTML = [...r.it.name].map((ch, j) => r.m.idx.includes(j) ? `<b>${ch}</b>` : ch).join(''); });
        n = res.length; sel = 0;
      };
      const setOpen = (o) => { open = o; if (o) { pal.style.visibility = 'visible'; inp.value = ''; lastQ = null; filter(); } };
      const run = () => { const it = items.find(x => x.rank === sel); if (!it || closing) return; flashAt = now; closing = true; toast.textContent = 'Ran: ' + it.name; };
      const key = (k) => { if (k === 'ArrowDown') sel = Math.min(n - 1, sel + 1); else if (k === 'ArrowUp') sel = Math.max(0, sel - 1); else if (k === 'Enter') run(); else if (k === 'Escape') setOpen(false); };
      st.onpointerdown = e => { userAt = now; if (!open) { setOpen(true); pressAt = now; } if (!/** @type {HTMLElement} */ (e.target).closest('.u2k-it')) { e.preventDefault(); inp.focus({ preventScroll: true }); } };
      inp.oninput = () => { userAt = now; filter(); };
      inp.onkeydown = e => { userAt = now; if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) { e.preventDefault(); key(e.key); } };
      items.forEach(it => { it.el.onpointerenter = () => { if (it.rank >= 0) { sel = it.rank; userAt = now; } }; it.el.onclick = () => { if (it.rank >= 0) { sel = it.rank; run(); } }; });
      // auto script: [time, action]
      const SCRIPT = [[0.6, 'open'], [1.2, 'a'], [1.38, 'n'], [1.55, 'i'], [1.75, 'm'], [2.6, 'ArrowDown'], [3.0, 'ArrowDown'], [3.4, 'ArrowUp'], [3.9, 'Enter'], [6.0, 'open'], [6.6, 'e'], [6.8, 'x'], [7.0, 'p'], [7.9, 'Enter']];
      let autoT0 = -1;
      return (t, dt) => {
        now = t;
        const auto = t - userAt > 5 && document.activeElement !== inp;
        if (auto) {
          if (autoT0 < 0) autoT0 = t;
          const lt = (t - autoT0) % 10.5, pl = lt - dt;
          for (const [at, act] of SCRIPT) if (lt >= +at && pl < +at) { if (act === 'open') { setOpen(true); pressAt = t; } else if (String(act).length === 1) { inp.value += act; filter(); } else key(String(act)); }
        } else autoT0 = -1;
        if (closing && t - flashAt > 0.32) { closing = false; setOpen(false); toastAt = t; inp.blur(); }
        const rk = 1 - seg(t - pressAt, 0.0, 0.25); k1.style.transform = k2.style.transform = `translateY(${rk > 0 && rk < 1 ? 2 : 0}px)`; k1.style.boxShadow = k2.style.boxShadow = rk > 0 && rk < 1 ? '0 0 0 #0b0b10' : '0 2px 0 #0b0b10';
        openK.to = open ? 1 : 0; const ok = clamp01(spring(openK, 520, 34, dt));
        pal.style.opacity = String(ok); pal.style.transform = `translateY(${(1 - ok) * -10}px) scale(${0.94 + 0.06 * ok})`; pal.style.visibility = !open && ok < 0.01 ? 'hidden' : 'visible'; dim.style.opacity = String(0.55 * ok); hint.style.opacity = String(1 - 0.75 * ok);
        const K = L.p.row, Dm = 2 * Math.sqrt(K) * 0.8;
        items.forEach(it => {
          if (it.rank >= 0) it.y.to = it.rank * 36; it.v.to = it.rank >= 0 ? 1 : 0;
          const y = spring(it.y, K, Dm, dt), v = clamp01(spring(it.v, 500, 40, dt));
          it.el.style.transform = `translateY(${y}px) scale(${0.95 + 0.05 * v})`; it.el.style.opacity = String(v); it.el.style.pointerEvents = it.rank >= 0 ? 'auto' : 'none';
          const fl = it.rank === sel ? 1 - seg(t - flashAt, 0.05, 0.3) : 0; it.el.style.background = fl > 0 && fl < 1 ? `rgba(255,90,54,${0.85 * fl})` : 'transparent'; it.el.style.color = it.rank === sel ? '#f4efe6' : '#c9c5d8';
        });
        lh.to = Math.max(1, Math.min(5, n)) * 36 + 12; ls.style.height = spring(lh, 420, 36, dt) + 'px';
        hy.to = sel * 36; hl.style.transform = `translateY(${spring(hy, 600, 40, dt)}px)`; hl.style.opacity = n ? '1' : '0';
        none.style.opacity = n ? '0' : '1';
        const tk = seg(t - toastAt, 0, 0.25) * (1 - seg(t - toastAt, 1.6, 1.9)); toast.style.opacity = String(tk); toast.style.transform = `translateX(-50%) translateY(${(1 - ease.out(seg(t - toastAt, 0, 0.3))) * 12}px)`;
      };
    },
  });

  // ---------------- holographic tilt card ----------------
  EX.add({
    cat: 'ui', id: 'ui2-holo', kind: 'dom', title: 'Holographic tilt card', aka: 'foil card, 3D hover tilt, glare effect, collectible card shine', tool: 'CSS 3D transforms + blend modes driven by CSS variables', runs: 'WEB',
    notice: 'A trading card tilts toward the pointer in 3D. Three layers sit on the art: a rainbow foil that slides with the tilt in color-dodge, a glitter mask so the foil only shows on sparkles, and a white glare that follows the pointer in overlay. JavaScript only writes four CSS variables per frame through springs; the gradients and blend modes do the rest. Move the mouse over the card; click to lift it.',
    use: 'collectible and reward cards, pricing tiers, product hero images, premium profile cards',
    params: [{ key: 'tilt', label: 'Max tilt', min: 0, max: 35, step: 1, value: 18, unit: ' deg' }, { key: 'foil', label: 'Foil strength', min: 0, max: 1, step: 0.05, value: 0.7 }],
    prompt: 'Holographic trading card hover effect in CSS: the card rotates up to {tilt} toward the pointer with perspective 900 px and a spring; a repeating rainbow gradient layer in mix-blend-mode color-dodge (opacity {foil}) shifts its background-position with the tilt; a dotted glitter mask limits the foil to sparkles; a radial white glare follows the pointer in overlay; the drop shadow moves opposite the tilt. JavaScript only updates CSS variables. Click lifts the card with a spring.',
    setup(st, L) {
      st.innerHTML = `<style>
.u2o-bg{position:absolute;inset:0;background:radial-gradient(60% 80% at 50% 45%,#22204a,#0b0b10)}
.u2o-wrap{position:absolute;left:0;right:0;top:0;bottom:0;perspective:900px}
.u2o-card{position:absolute;left:216px;top:24px;width:208px;height:300px;border-radius:16px;transform-style:preserve-3d;cursor:pointer;
  --rx:0deg;--ry:0deg;--mx:50%;--my:50%;--px:50%;--py:50%;--lift:1;
  transform:rotateX(var(--rx)) rotateY(var(--ry)) scale(var(--lift))}
.u2o-sh{position:absolute;left:226px;top:44px;width:188px;height:280px;border-radius:16px;background:#000;filter:blur(18px);opacity:.6}
.u2o-face{position:absolute;inset:0;border-radius:16px;overflow:hidden;background:linear-gradient(160deg,#ffd27a,#ff5a36 45%,#7a5cff);padding:9px;box-sizing:border-box}
.u2o-in{position:absolute;inset:9px;border-radius:10px;overflow:hidden;background:#141228}
.u2o-in canvas{display:block;width:190px;height:282px}
.u2o-foil{position:absolute;inset:0;border-radius:16px;mix-blend-mode:color-dodge;
  background:repeating-linear-gradient(115deg,#ff5a36 0%,#ffb020 6%,#5fd38d 12%,#2bc4e6 18%,#7a5cff 24%,#ff5a36 30%);background-size:300% 300%;background-position:var(--px) var(--py);
  mask-image:linear-gradient(115deg,transparent 30%,#000 44%,#000 56%,transparent 70%),radial-gradient(circle,#000 0 0.9px,transparent 1.3px),radial-gradient(circle,#000 0 1.3px,transparent 1.8px);mask-size:300% 300%,5px 5px,11px 13px;mask-position:var(--px) var(--py),0 0,3px 5px;mask-composite:intersect,add,add}
.u2o-foil2{position:absolute;inset:0;border-radius:16px;mix-blend-mode:color-dodge;opacity:.35;
  background:repeating-linear-gradient(115deg,#ff5a36 0%,#ffb020 6%,#5fd38d 12%,#2bc4e6 18%,#7a5cff 24%,#ff5a36 30%);background-size:300% 300%;background-position:var(--px) var(--py);
  mask-image:linear-gradient(115deg,transparent 32%,#000 46%,#000 54%,transparent 68%);mask-size:300% 300%;mask-position:var(--px) var(--py)}
.u2o-glare{position:absolute;inset:0;border-radius:16px;mix-blend-mode:overlay;background:radial-gradient(circle at var(--mx) var(--my),rgba(255,255,255,.75),rgba(255,255,255,.12) 30%,rgba(0,0,0,.35) 80%)}
.u2o-hint{position:absolute;left:0;right:0;bottom:12px;text-align:center;font:12px Segoe UI;color:#8a87a0}
</style><div class="u2o-bg"></div><div class="u2o-sh"></div><div class="u2o-wrap"><div class="u2o-card"><div class="u2o-face"><div class="u2o-in"><canvas width="380" height="564"></canvas></div></div><div class="u2o-foil"></div><div class="u2o-foil2"></div><div class="u2o-glare"></div></div></div><div class="u2o-hint">Hover to tilt, click to lift</div>`;
      const q = s => /** @type {HTMLElement} */ (st.querySelector(s));
      const card = q('.u2o-card'), sh = q('.u2o-sh'), foil = q('.u2o-foil'), foil2 = q('.u2o-foil2');
      { const g = /** @type {HTMLCanvasElement} */ (st.querySelector('.u2o-in canvas')).getContext('2d'); g.scale(2, 2);
        const bg = g.createLinearGradient(0, 0, 0, 282); bg.addColorStop(0, '#1d1b3a'); bg.addColorStop(1, '#0b0b10'); g.fillStyle = bg; g.fillRect(0, 0, 190, 282);
        g.fillStyle = '#f4efe6'; g.font = '700 15px Bahnschrift'; g.fillText('Spring Physics', 12, 24); g.fillStyle = '#ffb020'; g.font = '700 12px Bahnschrift'; g.textAlign = 'right'; g.fillText('k 320', 178, 24); g.textAlign = 'left';
        g.save(); g.beginPath(); g.roundRect(12, 34, 166, 126, 6); g.clip(); const sky = g.createLinearGradient(0, 34, 0, 160); sky.addColorStop(0, '#2bc4e6'); sky.addColorStop(1, '#7a5cff'); g.fillStyle = sky; g.fillRect(12, 34, 166, 126);
        g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(95, 104, 34, 0, 7); g.fill(); g.strokeStyle = '#ff5a36'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); for (let x = 0; x <= 166; x += 2) { const k = x / 166, y = 140 - 60 * Math.exp(-4 * k) * Math.cos(18 * k); x ? g.lineTo(12 + x, y) : g.moveTo(12, y); } g.stroke(); g.restore();
        g.fillStyle = '#8a87a0'; g.font = 'italic 10px Georgia'; g.fillText('Overshoots once, settles twice,', 12, 180); g.fillText('never quite stops on time.', 12, 193);
        [['Stiffness', '320'], ['Damping', '18'], ['Mass', '1.0']].forEach(([a, b], i) => { g.fillStyle = '#c9c5d8'; g.font = '11px Segoe UI'; g.fillText(a, 12, 218 + i * 16); g.fillStyle = '#f4efe6'; g.font = '700 11px Bahnschrift'; g.textAlign = 'right'; g.fillText(b, 178, 218 + i * 16); g.textAlign = 'left'; g.fillStyle = '#2c2b40'; g.fillRect(12, 222 + i * 16, 166, 1); });
        g.fillStyle = '#ffb020'; g.font = '10px Segoe UI'; g.fillText('MOTION STUDIO  12 / 120', 12, 272); }
      const rx = sp(0), ry = sp(0), mx = sp(50), my = sp(50), lift = sp(1); let mouse = null, now = 0;
      st.onpointermove = e => { mouse = Object.assign(local(st, e), { t: now }); };
      st.onpointerleave = () => { mouse = null; };
      card.onpointerdown = () => { lift.to = 1.08; lift.v += 1.5; }; card.onpointerup = () => { lift.to = 1; };
      return (t, dt) => {
        now = t;
        let u, v;
        if (mouse && t - mouse.t < 3) { u = clamp01((mouse.x - 216) / 208) * 2 - 1; v = clamp01((mouse.y - 24) / 300) * 2 - 1; }
        else { u = Math.sin(t * 0.9) * 0.85; v = Math.sin(t * 1.37 + 0.8) * 0.7; }
        const T = L.p.tilt; ry.to = u * T; rx.to = -v * T; mx.to = 50 + u * 45; my.to = 50 + v * 45;
        spring(rx, 170, 16, dt); spring(ry, 170, 16, dt); spring(mx, 170, 18, dt); spring(my, 170, 18, dt); spring(lift, 300, 14, dt);
        const s = card.style;
        s.setProperty('--rx', rx.x.toFixed(2) + 'deg'); s.setProperty('--ry', ry.x.toFixed(2) + 'deg'); s.setProperty('--mx', mx.x.toFixed(1) + '%'); s.setProperty('--my', my.x.toFixed(1) + '%');
        s.setProperty('--px', (50 + ry.x * 2.2).toFixed(1) + '%'); s.setProperty('--py', (50 - rx.x * 2.2).toFixed(1) + '%'); s.setProperty('--lift', lift.x.toFixed(4));
        foil.style.opacity = String(L.p.foil); foil2.style.opacity = String(L.p.foil * 0.65);
        sh.style.transform = `translate(${-ry.x * 1.1}px,${rx.x * 1.1 + (lift.x - 1) * 120}px) scale(${1 + (lift.x - 1) * 1.5})`; sh.style.opacity = String(0.6 - (lift.x - 1) * 2);
      };
    },
  });

  // ---------------- chat send ----------------
  EX.add({
    cat: 'ui', id: 'ui2-chat', kind: 'dom', title: 'Chat send and reply', aka: 'message send animation, typing indicator, bubble pop, tapback reaction', tool: 'DOM + JavaScript (FLIP from input to bubble, springs)', runs: 'WEB',
    notice: 'A sent message leaves the text field and flies into the thread: the bubble starts where the typed text was and eases into its place, while older bubbles spring upward to make room. Then three dots wave while the other person types, the reply pops from its corner with an overshoot, and a heart tapback lands on it. Click the field, type, and press Enter: you get a reply.',
    use: 'messaging and support chat, comment threads, AI assistants, any conversational UI',
    params: [{ key: 'fly', label: 'Send flight time', min: 0.15, max: 1.2, step: 0.05, value: 0.42, unit: ' s' }],
    prompt: 'Chat UI motion: when a message is sent, the new bubble starts at the text field position and size (FLIP) and eases into the thread over {fly} with ease-out, older bubbles spring up by its height; status changes Delivered to Read; a typing indicator with three dots in a sine wave appears, then the reply bubble scales in from its bottom-left corner with a spring (overshoot); a heart tapback pops onto the reply. Bubbles have a tail on the latest message of each run.',
    setup(st, L) {
      st.innerHTML = `<style>
.u2m-bg{position:absolute;inset:0;background:linear-gradient(160deg,#151428,#0b0b10)}
.u2m-pn{position:absolute;left:140px;top:12px;width:360px;height:336px;border-radius:22px;background:#f7f4ee;overflow:hidden;font-family:Segoe UI;box-shadow:0 24px 50px rgba(0,0,0,.5)}
.u2m-hd{position:absolute;left:0;right:0;top:0;height:54px;display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:1px solid #e6e0d4;background:#fbf9f4;z-index:2}
.u2m-hd i{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#ffb020,#ff5a36)}.u2m-hd div{line-height:1.2}.u2m-hd b{display:block;font-size:14px;color:#1d1b3a}.u2m-hd span{font-size:11px;color:#5fa86f}
.u2m-th{position:absolute;left:0;right:0;top:54px;bottom:56px;overflow:hidden;-webkit-mask-image:linear-gradient(transparent,#000 22px)}
.u2m-msg{position:absolute;bottom:8px;max-width:220px;padding:8px 12px;border-radius:18px;font-size:13.5px;line-height:1.3;will-change:transform}
.u2m-me{right:14px;background:#ff5a36;color:#fff;transform-origin:100% 100%}.u2m-them{left:14px;background:#e8e3d8;color:#1d1b3a;transform-origin:0 100%}
.u2m-me.u2m-tail{border-bottom-right-radius:5px}.u2m-them.u2m-tail{border-bottom-left-radius:5px}
.u2m-dots{display:flex;gap:4px;padding:3px 2px}.u2m-dots i{width:7px;height:7px;border-radius:50%;background:#8a8698}
.u2m-st{position:absolute;right:16px;bottom:0;font-size:10.5px;color:#8a8698;opacity:0}
.u2m-tb{position:absolute;right:-10px;top:-12px;width:24px;height:24px;border-radius:50%;background:#ff5a36;border:2px solid #f7f4ee;display:flex;align-items:center;justify-content:center;transform:scale(0)}
.u2m-bar{position:absolute;left:0;right:0;bottom:0;height:56px;display:flex;align-items:center;gap:8px;padding:0 12px;border-top:1px solid #e6e0d4;background:#fbf9f4}
.u2m-bar input{flex:1;height:34px;border-radius:17px;border:1px solid #ddd6c8;background:#fff;padding:0 14px;font:13.5px Segoe UI;color:#1d1b3a;outline:none}
.u2m-send{width:34px;height:34px;border-radius:50%;background:#ff5a36;display:flex;align-items:center;justify-content:center;cursor:pointer}
</style><div class="u2m-bg"></div><div class="u2m-pn"><div class="u2m-hd"><i></i><div><b>Mia Chen</b><span>online</span></div></div>
<div class="u2m-th"><div class="u2m-st">Delivered</div></div>
<div class="u2m-bar"><input placeholder="Message" spellcheck="false"><div class="u2m-send"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div></div>`;
      const q = s => /** @type {HTMLElement} */ (st.querySelector(s));
      const th = q('.u2m-th'), stl = q('.u2m-st'), inp = /** @type {HTMLInputElement} */ (st.querySelector('.u2m-bar input')), send = q('.u2m-send'), pn = q('.u2m-pn');
      const msgs = []; let now = 0, userAt = -99, statusAt = -99, statusTxt = '', typing = null, replyQ = 0;
      const REPLIES = ['Ha, love it', 'On it', 'See you soon', 'Deal', 'Wait, really?'];
      const layout = () => { let y = 0; for (let i = msgs.length - 1; i >= 0; i--) { const m = msgs[i]; if (i < msgs.length - 1 && msgs[i + 1].me === m.me) y += 4; else if (i < msgs.length - 1) y += 10; if (m.me && i === lastMe()) y += 14; m.y.to = y; y += m.h; } };
      const lastMe = () => { for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].me && !msgs[i].dots) return i; return -1; };
      const add = (text, me, dots) => {
        const el = document.createElement('div'); el.className = 'u2m-msg ' + (me ? 'u2m-me' : 'u2m-them');
        if (dots) el.innerHTML = '<div class="u2m-dots"><i></i><i></i><i></i></div>'; else el.textContent = text;
        th.appendChild(el); const m = { el, me, dots, h: el.offsetHeight, y: sp(0), born: now, from: null, tb: null, tbAt: -99 };
        msgs.push(m); msgs.forEach((x, i) => x.el.classList.toggle('u2m-tail', i === msgs.length - 1 || msgs[i + 1].me !== x.me)); layout();
        m.y.x = m.y.to; while (msgs.length > 9) { msgs.shift().el.remove(); }
        return m;
      };
      const removeMsg = m => { const i = msgs.indexOf(m); if (i >= 0) { msgs.splice(i, 1); m.el.remove(); msgs.forEach((x, j) => x.el.classList.toggle('u2m-tail', j === msgs.length - 1 || msgs[j + 1].me !== x.me)); layout(); } };
      const sendMsg = () => {
        const text = inp.value.trim(); if (!text) return;
        const ir = inp.getBoundingClientRect(), tr = th.getBoundingClientRect(), sc = tr.width / 360;
        const m = add(text, true, false); const er = m.el.getBoundingClientRect();
        m.from = { dx: (ir.left + 14 * sc - er.left) / sc, dy: (ir.top - er.top) / sc + m.y.to };
        inp.value = ''; statusTxt = 'Delivered'; statusAt = now + L.p.fly;
      };
      const theyType = (text, delay) => { if (typing && typing.m) removeMsg(typing.m); typing = { at: now + delay, text, m: null }; };
      const tapback = m => { const b = document.createElement('div'); b.className = 'u2m-tb'; b.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24"><path fill="#fff" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.2 0 3.9 1.2 5.4 3.1 1.5-1.9 3.2-3.1 5.4-3.1 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z"/></svg>'; m.el.appendChild(b); m.tb = b; m.tbAt = now; };
      inp.onkeydown = e => { userAt = now; if (e.key === 'Enter') { e.preventDefault(); sendMsg(); theyType(REPLIES[replyQ++ % REPLIES.length], 0.9); } };
      inp.onfocus = () => { userAt = now; };
      send.onclick = () => { userAt = now; if (inp.value.trim()) { sendMsg(); theyType(REPLIES[replyQ++ % REPLIES.length], 0.9); } };
      const SCRIPT = [[0.3, 'them', 'Are you close?'], [2.0, 'type', 'On my way, 5 min'], [3.7, 'send'], [4.0, 'them', 'Perfect, grabbing a table'], [6.8, 'heart'], [7.6, 'type', 'Order me a flat white?'], [9.4, 'send'], [9.7, 'them', 'Already done']];
      let autoT0 = -1, typeTxt = '', typeAt = 0, lastLt = 0;
      return (t, dt) => {
        now = t;
        const auto = t - userAt > 6 && document.activeElement !== inp;
        if (auto) {
          if (autoT0 < 0) autoT0 = t;
          const lt = (t - autoT0) % 13.5;
          if (lt < lastLt) { while (msgs.length) msgs.shift().el.remove(); typing = null; statusTxt = ''; inp.value = ''; typeTxt = ''; }
          for (const [at, act, txt] of SCRIPT) if (lt >= +at && lastLt < +at) {
            if (act === 'them') theyType(String(txt), 0.15); else if (act === 'type') { typeTxt = String(txt); typeAt = t; } else if (act === 'send') { sendMsg(); typeTxt = ''; } else if (act === 'heart') { const m = msgs.slice().reverse().find(x => !x.me && !x.dots); if (m && !m.tb) tapback(m); }
          }
          if (typeTxt) inp.value = typeTxt.slice(0, Math.floor((t - typeAt) / 0.07));
          lastLt = lt; pn.style.opacity = String(Math.min(1 - seg(lt, 13.0, 13.4), seg(lt, 0, 0.3)));
        } else { autoT0 = -1; lastLt = 0; pn.style.opacity = '1'; }
        if (typing) {
          if (!typing.m && t >= typing.at) { typing.m = add('', false, true); statusTxt = 'Read'; statusAt = t; }
          if (typing.m && t >= typing.at + 1.3) { removeMsg(typing.m); const r = add(typing.text, false, false); r.born = t; typing = null; }
        }
        const lm = lastMe();
        msgs.forEach((m, i) => {
          const y = spring(m.y, 260, 24, dt), age = t - m.born; let tf = `translateY(${-y}px)`;
          if (m.from) { const k = ease.out(clamp01(age / L.p.fly)); tf = `translate(${m.from.dx * (1 - k)}px,${-y + m.from.dy * (1 - k) - Math.sin(Math.PI * k) * 10}px)`; if (k >= 1) m.from = null; m.el.style.opacity = String(clamp01(0.4 + k * 2)); }
          else if (!m.me) { const k = clamp01(age / 0.5), s = 1 - Math.exp(-7 * k) * Math.cos(11 * k); tf += ` scale(${Math.max(0.01, s)})`; }
          m.el.style.transform = tf;
          if (m.dots) Array.from(m.el.querySelectorAll('i')).forEach((d, j) => { /** @type {HTMLElement} */ (d).style.transform = `translateY(${-3 * Math.max(0, Math.sin(t * 7 - j * 0.9))}px)`; });
          if (m.tb) { const k = clamp01((t - m.tbAt) / 0.5), s = 1 - Math.exp(-6 * k) * Math.cos(10 * k); m.tb.style.transform = `scale(${s}) rotate(${(1 - s) * -40}deg)`; m.tb.style.right = m.me ? 'auto' : '-10px'; }
          if (i === lm) stl.style.transform = `translateY(${-(y - 9)}px)`;
        });
        stl.textContent = statusTxt; stl.style.opacity = String(lm >= 0 && statusTxt ? clamp01((t - statusAt) / 0.25) : 0);
      };
    },
  });

  // ---------------- spotlight card grid ----------------
  EX.add({
    cat: 'ui', id: 'ui2-spotlight', kind: 'dom', title: 'Spotlight card grid', aka: 'cursor glow borders, hover spotlight, glowing card grid', tool: 'CSS radial gradients + mask-composite, driven by CSS variables', runs: 'WEB',
    notice: 'A soft light follows the pointer over a grid of cards. Each card draws the light twice: once as a faint fill inside and once on its 1 px border, cut out with a mask so only the outline glows. Because every card gets the pointer position relative to itself, borders of nearby cards light up too, even across the gaps. Move the mouse over the grid; click a card for a ripple.',
    use: 'feature grids on landing pages, pricing tables, dashboards, dark-mode product sites',
    params: [{ key: 'rad', label: 'Light radius', min: 80, max: 400, step: 10, value: 260, unit: ' px' }],
    prompt: 'Spotlight hover for a grid of dark feature cards: set --x and --y on every card to the pointer position relative to that card; a ::before layer draws radial-gradient({rad} circle at var(--x) var(--y), amber, transparent 60%) on a 1 px border cut out with mask-composite: exclude, and an ::after layer adds a faint inner glow, so neighbouring borders light up across the gaps. Ease the light toward the pointer, and ripple out from the click point.',
    setup(st, L) {
      const FEAT = [['Springs', 'Stiffness, damping, mass', C.coral], ['Easing', 'Curves with intent', C.amber], ['Stagger', 'Order the eye can read', C.cyan], ['Paths', 'Motion along a curve', C.violet], ['Shaders', 'Every pixel at once', C.green], ['Physics', 'Weight you can feel', C.coral]];
      st.innerHTML = `<style>
.u2g-bg{position:absolute;inset:0;background:#09090e}
.u2g-gr{position:absolute;left:28px;top:30px;width:584px;height:300px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:12px}
.u2g-c{position:relative;border-radius:14px;background:#13121c;overflow:hidden;cursor:pointer;--x:-999px;--y:-999px}
.u2g-c:before{content:'';position:absolute;inset:0;border-radius:14px;padding:1px;background:radial-gradient(var(--r) circle at var(--x) var(--y),#ffd27a,#ffb020 18%,#ff5a3690 38%,transparent 65%),#24233a;
  mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;pointer-events:none}
.u2g-c:after{content:'';position:absolute;inset:0;background:radial-gradient(calc(var(--r) * 1.3) circle at var(--x) var(--y),rgba(255,176,32,.17),rgba(255,90,54,.05) 35%,transparent 60%);pointer-events:none}
.u2g-ic{position:absolute;left:18px;top:18px;width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center}
.u2g-c b{position:absolute;left:18px;top:76px;font:700 18px Bahnschrift;color:#f4efe6}.u2g-c span{position:absolute;left:18px;top:102px;font:13px Segoe UI;color:#8a87a0}
.u2g-rp{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;border:2px solid #ffb020;pointer-events:none}
</style><div class="u2g-bg"></div><div class="u2g-gr">${FEAT.map(([a, b, c], i) => `<div class="u2g-c"><div class="u2g-ic" style="background:${c}22;box-shadow:inset 0 0 0 1px ${c}55"><svg width="20" height="20" viewBox="0 0 20 20">${[
        '<path d="M2 10c2-6 4 6 6 0s4 6 6 0 3 4 4 0" fill="none" stroke="CC" stroke-width="2" stroke-linecap="round"/>',
        '<path d="M2 18C8 18 10 2 18 2" fill="none" stroke="CC" stroke-width="2.2" stroke-linecap="round"/>',
        '<rect x="2" y="3" width="10" height="3" rx="1.5" fill="CC"/><rect x="5" y="8.5" width="10" height="3" rx="1.5" fill="CC" opacity=".7"/><rect x="8" y="14" width="10" height="3" rx="1.5" fill="CC" opacity=".45"/>',
        '<path d="M3 16C3 6 17 14 17 4" fill="none" stroke="CC" stroke-width="2" stroke-dasharray="3 3"/><circle cx="17" cy="4" r="2.5" fill="CC"/>',
        '<rect x="3" y="3" width="6" height="6" rx="1" fill="CC"/><rect x="11" y="3" width="6" height="6" rx="1" fill="CC" opacity=".6"/><rect x="3" y="11" width="6" height="6" rx="1" fill="CC" opacity=".6"/><rect x="11" y="11" width="6" height="6" rx="1" fill="CC" opacity=".3"/>',
        '<circle cx="10" cy="5" r="3.5" fill="CC"/><path d="M10 9v4M5 18h10" stroke="CC" stroke-width="2" stroke-linecap="round"/>'][i].replace(/CC/g, c)}</svg></div><b>${a}</b><span>${b}</span></div>`).join('')}</div>`;
      const gr = /** @type {HTMLElement} */ (st.querySelector('.u2g-gr')), cards = Array.from(st.querySelectorAll('.u2g-c')).map(e => /** @type {HTMLElement} */ (e));
      const rects = cards.map(c => ({ x: c.offsetLeft + 28, y: c.offsetTop + 30 }));
      let mouse = null, now = 0; const lx = sp(320), ly = sp(180); const ripples = [];
      st.onpointermove = e => { mouse = Object.assign(local(st, e), { t: now }); };
      st.onpointerleave = () => { mouse = null; };
      cards.forEach((c, i) => { c.onpointerdown = e => { const p = local(st, e), r = document.createElement('div'); r.className = 'u2g-rp'; r.style.left = (p.x - rects[i].x) + 'px'; r.style.top = (p.y - rects[i].y) + 'px'; c.appendChild(r); ripples.push({ el: r, t0: now }); }; });
      let autoClick = 0;
      return (t, dt) => {
        now = t;
        const live = mouse && t - mouse.t < 3;
        lx.to = live ? mouse.x : 320 + 215 * Math.sin(t * 0.7); ly.to = live ? mouse.y : 180 + 95 * Math.sin(t * 1.13 + 0.5);
        spring(lx, 120, 20, dt); spring(ly, 120, 20, dt);
        gr.style.setProperty('--r', L.p.rad + 'px');
        cards.forEach((c, i) => { c.style.setProperty('--x', (lx.x - rects[i].x).toFixed(1) + 'px'); c.style.setProperty('--y', (ly.x - rects[i].y).toFixed(1) + 'px'); });
        if (!live && Math.floor(t / 3.2) > autoClick) { autoClick = Math.floor(t / 3.2); const i = cards.findIndex((c, j) => lx.x >= rects[j].x && lx.x <= rects[j].x + c.offsetWidth && ly.x >= rects[j].y && ly.x <= rects[j].y + c.offsetHeight); if (i >= 0) { const r = document.createElement('div'); r.className = 'u2g-rp'; r.style.left = (lx.x - rects[i].x) + 'px'; r.style.top = (ly.x - rects[i].y) + 'px'; cards[i].appendChild(r); ripples.push({ el: r, t0: t }); } }
        for (let k = ripples.length - 1; k >= 0; k--) { const rp = ripples[k], a = (t - rp.t0) / 0.7; if (a >= 1) { rp.el.remove(); ripples.splice(k, 1); continue; } const d = 10 + ease.out(a) * 260; rp.el.style.width = rp.el.style.height = d + 'px'; rp.el.style.margin = (-d / 2) + 'px 0 0 ' + (-d / 2) + 'px'; rp.el.style.opacity = String(1 - a); }
      };
    },
  });

  // ---------------- slider with a swinging bubble ----------------
  EX.add({
    cat: 'ui', id: 'ui2-slider', kind: 'dom', title: 'Slider with a swinging bubble', aka: 'pendulum tooltip, elastic slider, magnetic ticks, range input micro-interaction', tool: 'Pointer events + JavaScript (pendulum spring, rubber band, magnetic snapping)', runs: 'WEB',
    notice: 'The value bubble hangs from the thumb like a pendulum: when the thumb speeds up the bubble lags and tilts, and when it stops the bubble swings past centre and settles. Past the ends the thumb stretches on a rubber band and springs back. The lower slider has five stops: near a stop the thumb is pulled in like a magnet, and on release it snaps with a spring. Drag either thumb.',
    use: 'settings and audio controls, pricing and range pickers, onboarding questions, playful forms',
    params: [{ key: 'swing', label: 'Swing amount', min: 0, max: 3, step: 0.1, value: 1.2 }, { key: 'mag', label: 'Magnet pull', min: 0, max: 1, step: 0.05, value: 0.6 }],
    prompt: 'Two custom sliders. Volume: the value bubble above the thumb is a damped pendulum driven by the thumb acceleration (swing {swing}), it scales in on press and out on release, and the thumb rubber-bands past the ends. Room size: five labelled stops; while dragging pull the thumb toward the nearest stop with strength {mag} inside 30 px, light the stop it is near, and on release snap with a spring. Thumbs squash slightly on press.',
    setup(st, L) {
      const STOPS = ['XS', 'S', 'M', 'L', 'XL'];
      st.innerHTML = `<style>
.u2s2-bg{position:absolute;inset:0;background:radial-gradient(70% 90% at 50% 30%,#1d1b3a,#0b0b10)}
.u2s2-pn{position:absolute;left:70px;top:22px;width:500px;height:316px;border-radius:18px;background:#15141f;box-shadow:0 20px 50px rgba(0,0,0,.45),inset 0 0 0 1px #ffffff10;font-family:Segoe UI}
.u2s2-lb{position:absolute;left:40px;font:600 13px Segoe UI;color:#8a87a0;letter-spacing:.5px}
.u2s2-tr{position:absolute;left:40px;width:420px;height:8px;border-radius:4px;background:#2a2940}
.u2s2-fill{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:linear-gradient(90deg,#7a5cff,#ff5a36,#ffb020);background-size:420px 8px}
.u2s2-th{position:absolute;width:28px;height:28px;margin:-10px 0 0 -14px;border-radius:50%;background:#f4efe6;box-shadow:0 4px 12px rgba(0,0,0,.4);cursor:grab;touch-action:none}
.u2s2-bub{position:absolute;width:0;height:0}
.u2s2-bb{position:absolute;left:-30px;top:-74px;width:60px;height:44px;transform-origin:30px 58px}
.u2s2-bb div{position:absolute;inset:0;border-radius:12px;background:#ff5a36;color:#fff;font:700 20px/44px Bahnschrift;text-align:center}
.u2s2-bb i{position:absolute;left:24px;top:38px;width:12px;height:12px;background:#ff5a36;transform:rotate(45deg);border-radius:2px}
.u2s2-tk{position:absolute;top:-4px;width:4px;height:16px;margin-left:-2px;border-radius:2px;background:#3a3858}
.u2s2-tl{position:absolute;top:24px;width:40px;margin-left:-20px;text-align:center;font:600 12px Segoe UI;color:#5a5872}
.u2s2-f{position:absolute;left:0;top:0;z-index:9;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#ffffff40;border:2px solid #fff;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.4)}
</style><div class="u2s2-bg"></div><div class="u2s2-pn">
<div class="u2s2-lb" style="top:34px">VOLUME</div>
<div class="u2s2-tr u2s2-t1" style="top:134px"><div class="u2s2-fill"></div><div class="u2s2-bub"><div class="u2s2-bb"><i></i><div>0</div></div></div><div class="u2s2-th"></div></div>
<div class="u2s2-lb" style="top:190px">ROOM SIZE</div>
<div class="u2s2-tr u2s2-t2" style="top:236px">${STOPS.map((_, i) => `<div class="u2s2-tk" style="left:${i * 105}px"></div><div class="u2s2-tl" style="left:${i * 105}px">${STOPS[i]}</div>`).join('')}<div class="u2s2-fill" style="background:#2bc4e6"></div><div class="u2s2-th"></div></div>
</div><div class="u2s2-f"></div>`;
      const q = s => /** @type {HTMLElement} */ (st.querySelector(s)), qa = (el, s) => Array.from(el.querySelectorAll(s)).map(e => /** @type {HTMLElement} */ (e));
      const t1 = q('.u2s2-t1'), t2 = q('.u2s2-t2'), th1 = /** @type {HTMLElement} */ (t1.querySelector('.u2s2-th')), th2 = /** @type {HTMLElement} */ (t2.querySelector('.u2s2-th'));
      const fill1 = /** @type {HTMLElement} */ (t1.querySelector('.u2s2-fill')), fill2 = /** @type {HTMLElement} */ (t2.querySelector('.u2s2-fill')), bub = q('.u2s2-bub'), bb = q('.u2s2-bb'), bnum = /** @type {HTMLElement} */ (bb.lastElementChild);
      const ticks = qa(t2, '.u2s2-tk'), tlabs = qa(t2, '.u2s2-tl'), finger = q('.u2s2-f');
      const TW = 420, OX = 70 + 40, Y1 = 22 + 134 + 4, Y2 = 22 + 236 + 4;
      const x1 = sp(120), x2 = sp(210), sc1 = sp(0), sq1 = sp(1), sq2 = sp(1); let ang = 0, angV = 0, pv = 0, px = 120, accS = 0, drag = 0, now = 0, userAt = -99, user = false, fDown = 0;
      const rb = (x) => x < 0 ? -18 * (1 - 1 / (1 - x / 60)) : x > TW ? TW + 18 * (1 - 1 / (1 + (x - TW) / 60)) : x;
      const magnet = x => { const k = Math.round(x / 105) * 105, d = x - k; return Math.abs(d) < 30 ? x - d * L.p.mag * (1 - Math.abs(d) / 30) : x; };
      const press = (which, x) => { drag = which; if (which === 1) { sc1.to = 1; sq1.to = 1.16; } else sq2.to = 1.16; move(x); };
      const move = x => { const lx = x - OX; if (drag === 1) { x1.x = rb(lx); x1.v = 0; } else if (drag === 2) { x2.x = magnet(Math.max(0, Math.min(TW, lx))); x2.v = 0; } };
      const release = () => { if (drag === 1) { sc1.to = 0; sq1.to = 1; x1.to = Math.max(0, Math.min(TW, x1.x)); } else if (drag === 2) { sq2.to = 1; x2.to = Math.round(x2.x / 105) * 105; } drag = 0; };
      [[th1, 1], [th2, 2], [t1, 1], [t2, 2]].forEach(([el, w]) => { const e0 = /** @type {HTMLElement} */ (el); e0.onpointerdown = e => { e.stopPropagation(); userAt = now; user = true; fDown = 0; release(); e0.setPointerCapture(e.pointerId); press(+w, local(st, e).x); }; e0.onpointermove = e => { if (user && drag) { userAt = now; move(local(st, e).x); } }; e0.onpointerup = () => { if (user) { user = false; userAt = now; release(); } }; });
      // ghost finger keys: time, x (stage), slider, pressed
      const KEYS = [[0, 200, 1, 0], [0.4, OX + 120, 1, 0], [0.55, OX + 120, 1, 1], [1.4, OX + 360, 1, 1], [1.5, OX + 360, 1, 1], [1.9, OX + 180, 1, 1], [2.0, OX + 180, 1, 1], [2.5, OX + 470, 1, 1], [2.6, OX + 470, 1, 0], [3.4, OX + 210, 2, 0], [3.6, OX + 210, 2, 1], [4.6, OX + 330, 2, 1], [4.7, OX + 330, 2, 0], [5.4, OX + 40, 2, 0], [5.6, OX + 40, 2, 1], [6.3, OX + 98, 2, 1], [6.4, OX + 98, 2, 0], [7.5, 200, 1, 0]];
      return (t, dt) => {
        now = t;
        if (!user && t - userAt > 3.5) {
          const lt = t % 7.5; let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= lt) i++;
          const [t0, xa, wa, d0] = KEYS[i], [t1k, xb, wb] = KEYS[i + 1], k = ease.inOut(clamp01((lt - t0) / (t1k - t0)));
          const fx = lerp(xa, xb, k), fy = lerp(wa === 1 ? Y1 : Y2, wb === 1 ? Y1 : Y2, k);
          if (d0 && !fDown) press(wa, fx); else if (!d0 && fDown) release();
          fDown = d0; if (fDown) move(fx);
          finger.style.transform = `translate(${fx + 6}px,${fy + 18}px) scale(${fDown ? 0.82 : 1})`; finger.style.opacity = String(clamp01(Math.min(lt * 3, (7.3 - lt) * 3)));
        } else finger.style.opacity = '0';
        if (drag !== 1) spring(x1, 300, 20, dt);
        if (drag !== 2) spring(x2, 420, 22, dt);
        spring(sc1, 420, 22, dt); spring(sq1, 600, 24, dt); spring(sq2, 600, 24, dt);
        const vx = lerp(pv, (x1.x - px) / Math.max(dt, 1e-3), 0.5); accS = lerp(accS, Math.max(-5000, Math.min(5000, (vx - pv) / Math.max(dt, 1e-3))), 0.3); px = x1.x; pv = vx;
        const n = Math.ceil(dt / 0.004), h = dt / n; for (let j = 0; j < n; j++) { angV += (-140 * ang - 6 * angV - accS * 0.03 * L.p.swing) * h; ang += angV * h; }
        ang = Math.max(-0.75, Math.min(0.75, ang));
        th1.style.left = x1.x + 'px'; th1.style.transform = `scale(${sq1.x},${1 - (sq1.x - 1) * 0.6})`; fill1.style.width = Math.max(0, Math.min(TW, x1.x)) + 'px';
        bub.style.left = x1.x + 'px'; bb.style.transform = `rotate(${ang}rad) scale(${Math.max(0, sc1.x)})`; bnum.textContent = String(Math.round(clamp01(x1.x / TW) * 100));
        th2.style.left = x2.x + 'px'; th2.style.transform = `scale(${sq2.x},${1 - (sq2.x - 1) * 0.6})`; fill2.style.width = x2.x + 'px';
        const near = Math.round(x2.x / 105);
        ticks.forEach((tk, i) => { tk.style.background = i <= near ? '#2bc4e6' : '#3a3858'; tk.style.transform = `scaleY(${i === near ? 1.25 : 1})`; });
        tlabs.forEach((tl, i) => { tl.style.color = i === near ? '#f4efe6' : '#5a5872'; });
      };
    },
  });



  // ---------------- drag to reorder ----------------
  EX.add({
    cat: 'ui', id: 'ui2-reorder', kind: 'dom', title: 'Drag to reorder', aka: 'sortable list, reorderable playlist, drag and drop list', tool: 'Pointer events + JavaScript (live reorder, one spring per row)', runs: 'WEB',
    notice: 'Grab a row and it lifts: it grows a little, casts a deeper shadow and tilts with its speed. While you drag, the list reorders live: every other row has its own spring toward its new slot, so they slide out of the way instead of jumping. Let go and the row settles into its slot, and the track numbers update. Drag any row up or down.',
    use: 'playlists, to-do lists, kanban columns, settings that set an order, layer panels',
    params: [{ key: 'k', label: 'Row spring stiffness', min: 80, max: 800, step: 20, value: 420 }],
    prompt: 'Sortable playlist: on press the row scales to 1.03 with a larger shadow and tilts up to 4 degrees with its vertical velocity; while dragging, compute the slot under the row and reorder the array live; every row springs to its slot (stiffness {k}, slight overshoot); on release the dragged row springs into place and the numbers update. Rubber-band the row at the top and bottom of the list.',
    setup(st, L) {
      const PITCH = 50, N = 5;
      st.innerHTML = `<style>
.u2r-bg{position:absolute;inset:0;background:radial-gradient(70% 90% at 50% 30%,#1d1b3a,#0b0b10)}
.u2r-pn{position:absolute;left:120px;top:14px;width:400px;height:332px;border-radius:20px;background:#15141f;box-shadow:0 20px 50px rgba(0,0,0,.45),inset 0 0 0 1px #ffffff10;font-family:Segoe UI}
.u2r-pn h4{position:absolute;left:22px;top:18px;margin:0;font:700 20px Bahnschrift;color:#f4efe6}.u2r-pn small{position:absolute;right:22px;top:24px;font-size:12px;color:#8a87a0}
.u2r-ls{position:absolute;left:14px;right:14px;top:62px;height:${N * PITCH}px}
.u2r-row{position:absolute;left:0;right:0;top:0;height:44px;border-radius:12px;background:#1e1d2c;display:flex;align-items:center;gap:12px;padding:0 12px;box-sizing:border-box;cursor:grab;touch-action:none;user-select:none}
.u2r-row canvas{width:32px;height:32px;border-radius:7px;flex:none}
.u2r-n{width:16px;font:700 13px Bahnschrift;color:#5a5872;text-align:right}
.u2r-row b{display:block;font:600 13px Segoe UI;color:#f4efe6}.u2r-row span{font-size:11px;color:#8a87a0}
.u2r-row em{margin-left:auto;font-style:normal;font-size:12px;color:#8a87a0}
.u2r-hd{width:12px;height:18px;background:radial-gradient(circle,#5a5872 1.6px,transparent 2px) 0 0/6px 6px}
.u2r-f{position:absolute;left:0;top:0;z-index:99;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#ffffff40;border:2px solid #fff;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.4)}
</style><div class="u2r-bg"></div><div class="u2r-pn"><h4>Up next</h4><small>Drag to reorder</small><div class="u2r-ls">
${[0, 1, 2, 3, 5].map((k, i) => `<div class="u2r-row"><div class="u2r-n">${i + 1}</div><canvas width="64" height="64" data-k="${k}"></canvas><div><b>${ALBUMS[k][0]}</b><span>${ALBUMS[k][1]}</span></div><em>${3 + i % 2}:${String(12 + i * 9).padStart(2, '0')}</em><i class="u2r-hd"></i></div>`).join('')}</div></div><div class="u2r-f"></div>`;
      const finger = /** @type {HTMLElement} */ (st.querySelector('.u2r-f'));
      st.querySelectorAll('.u2r-row canvas').forEach(c => { const cv = /** @type {HTMLCanvasElement} */ (c), g = cv.getContext('2d'); g.scale(64 / 132, 64 / 132); paintCover(g, 0, 0, 132, +cv.dataset.k); });
      const rows = Array.from(st.querySelectorAll('.u2r-row')).map((e, i) => ({ el: /** @type {HTMLElement} */ (e), num: /** @type {HTMLElement} */ (e.firstElementChild), y: sp(i * PITCH), lift: sp(0), tilt: 0 }));
      const order = rows.map((_, i) => i); let drag = null, now = 0, userAt = -99, user = false, fDown = 0;
      const LY = 14 + 62;
      const press = (y) => { const pos = Math.max(0, Math.min(N - 1, Math.floor((y - LY) / PITCH))); const id = order[pos]; drag = { id, off: y - LY - rows[id].y.x, ly: y, lt: now, v: 0 }; rows[id].lift.to = 1; };
      const move = (y) => {
        if (!drag) return; const r = rows[drag.id], dt = Math.max(0.008, now - drag.lt); drag.v = lerp(drag.v, (y - drag.ly) / dt, 0.4); drag.ly = y; drag.lt = now;
        let ry = y - LY - drag.off; const max = (N - 1) * PITCH; ry = ry < 0 ? -20 * (1 - 1 / (1 - ry / 60)) : ry > max ? max + 20 * (1 - 1 / (1 + (ry - max) / 60)) : ry; r.y.x = ry; r.y.v = 0;
        const pos = Math.max(0, Math.min(N - 1, Math.round(ry / PITCH))), cur = order.indexOf(drag.id); if (pos !== cur) { order.splice(cur, 1); order.splice(pos, 0, drag.id); }
      };
      const release = () => { if (!drag) return; const r = rows[drag.id]; r.lift.to = 0; r.y.v = drag.v * 0.5; drag = null; };
      rows.forEach(r => {
        r.el.onpointerdown = e => { userAt = now; user = true; fDown = 0; release(); r.el.setPointerCapture(e.pointerId); r.el.style.cursor = 'grabbing'; press(local(st, e).y); };
        r.el.onpointermove = e => { if (user && drag) { userAt = now; move(local(st, e).y); } };
        r.el.onpointerup = () => { if (user) { user = false; userAt = now; release(); } r.el.style.cursor = 'grab'; };
      });
      const slotY = p => LY + p * PITCH + 22, FX = 470;
      const KEYS = [[0, FX + 40, slotY(2), 0], [0.4, FX, slotY(1), 0], [0.6, FX, slotY(1), 1], [1.6, FX, slotY(3), 1], [1.75, FX, slotY(3), 0], [2.4, FX, slotY(4), 0], [2.6, FX, slotY(4), 1], [3.5, FX, slotY(0), 1], [3.65, FX, slotY(0), 0], [4.3, FX, slotY(2), 0], [4.5, FX, slotY(2), 1], [5.0, FX, slotY(4), 1], [5.15, FX, slotY(4), 0], [6.4, FX + 40, slotY(2), 0]];
      return (t, dt) => {
        now = t;
        if (!user && t - userAt > 3.5) {
          const lt = t % 6.4; let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= lt) i++;
          const [t0, x0, y0, d0] = KEYS[i], [t1, x1, y1] = KEYS[i + 1], k = ease.inOut(clamp01((lt - t0) / (t1 - t0)));
          const fx = lerp(x0, x1, k), fy = lerp(y0, y1, k);
          if (d0 && !fDown) press(fy); else if (!d0 && fDown) release();
          fDown = d0; if (fDown) move(fy);
          finger.style.transform = `translate(${fx}px,${fy}px) scale(${fDown ? 0.82 : 1})`; finger.style.opacity = String(clamp01(Math.min(lt * 3, (6.2 - lt) * 3)));
        } else finger.style.opacity = '0';
        const K = L.p.k, D = 2 * Math.sqrt(K) * 0.7;
        order.forEach((id, pos) => { const r = rows[id]; r.y.to = pos * PITCH; r.num.textContent = String(pos + 1); });
        rows.forEach((r, id) => {
          const dragging = drag && drag.id === id;
          if (!dragging) spring(r.y, K, D, dt);
          const lf = spring(r.lift, 500, 26, dt); r.tilt = lerp(r.tilt, dragging ? Math.max(-4, Math.min(4, drag.v * 0.012)) : 0, 0.2);
          r.el.style.transform = `translateY(${r.y.x}px) scale(${1 + 0.03 * lf}) rotate(${r.tilt}deg)`; r.el.style.zIndex = String(lf > 0.02 ? 10 : 1);
          r.el.style.boxShadow = `0 ${2 + 14 * lf}px ${6 + 26 * lf}px rgba(0,0,0,${0.25 + 0.3 * lf})`; r.el.style.background = lf > 0.02 ? '#26253a' : '#1e1d2c';
        });
      };
    },
  });

  // ---------------- native CSS: height auto, entry and exit, stagger ----------------
  EX.add({
    cat: 'ui', id: 'ui2-cssnative', kind: 'dom', title: 'Native CSS open and close', aka: 'animate height auto, interpolate-size, ::details-content, @starting-style, sibling-index stagger', tool: 'Pure CSS (interpolate-size, ::details-content, @starting-style, transition-behavior, sibling-index())', runs: 'WEB',
    notice: 'Three things that used to need JavaScript, done by the browser. The accordion animates to height: auto thanks to interpolate-size, through the ::details-content part of a plain details element. Chips enter from @starting-style and leave with display: none kept alive by transition-behavior: allow-discrete, and sibling-index() staggers them. Selected chips grow to fit their check mark, again to width: auto. Script only clicks for you when you are idle. Open a question or click a chip.',
    use: 'FAQs and settings sections, filter chips, menus and popovers, any show and hide without a library',
    prompt: 'Build with modern CSS only: an exclusive FAQ (details name="faq") whose ::details-content transitions height from 0 to auto using interpolate-size: allow-keywords, plus content-visibility with allow-discrete; the chevron rotates. Filter chips enter with @starting-style (opacity 0, scale 0.8), exit to display: none with transition-behavior: allow-discrete, and stagger with transition-delay: calc(sibling-index() * 40ms). A selected chip transitions its width to auto to make room for a check mark.',
    setup(st) {
      const QA = [['What is interpolate-size?', 'A property that lets the browser animate to and from keyword sizes like auto, so height: auto finally transitions.'], ['Why ::details-content?', 'It is the part of a details element that holds everything except the summary, so you can size and fade it.'], ['Does it need JavaScript?', 'No. Open and close are native, and the transition runs in CSS. Script here only plays the demo.'], ['Can it animate closing?', 'Yes: allow-discrete keeps content-visibility visible until the height reaches zero.']];
      const CHIPS = ['Spring', 'Ease out', 'Stagger', 'Loop', 'Hold', 'Overshoot', 'Anticipate', 'Arc'];
      st.innerHTML = `<style>
.u2n-root{position:absolute;inset:0;background:#0b0b10;font-family:Segoe UI;interpolate-size:allow-keywords}
.u2n-faq{position:absolute;left:18px;top:18px;width:300px;height:324px;border-radius:16px;background:#15141f;box-shadow:inset 0 0 0 1px #ffffff10;padding:14px 14px 0;box-sizing:border-box;overflow:hidden}
.u2n-faq h4,.u2n-ch h4{margin:0 0 10px;font:700 16px Bahnschrift;color:#f4efe6}
.u2n-faq details{border-radius:10px;background:#1e1d2c;margin-bottom:8px}
.u2n-faq summary{list-style:none;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;font:600 13px Segoe UI;color:#ece7de;cursor:pointer}
.u2n-faq summary::-webkit-details-marker{display:none}
.u2n-faq summary i{width:8px;height:8px;border-right:2px solid #8a87a0;border-bottom:2px solid #8a87a0;transform:rotate(45deg);transition:transform .35s cubic-bezier(.3,1.4,.5,1);margin-top:-4px}
.u2n-faq details[open] summary i{transform:rotate(225deg);margin-top:4px;border-color:#ff5a36}
.u2n-faq details::details-content{height:0;overflow:clip;opacity:0;transition:height .45s cubic-bezier(.2,.8,.2,1),opacity .3s,content-visibility .45s allow-discrete}
.u2n-faq details[open]::details-content{height:auto;opacity:1}
.u2n-faq p{margin:0;padding:0 12px 12px;font-size:12px;line-height:1.45;color:#a9a6bf}
.u2n-ch{position:absolute;left:334px;top:18px;width:288px;height:140px;border-radius:16px;background:#15141f;box-shadow:inset 0 0 0 1px #ffffff10;padding:14px;box-sizing:border-box}
.u2n-cl{display:flex;flex-wrap:wrap;gap:7px}
.u2n-c{display:flex;align-items:center;gap:0;height:28px;padding:0 12px;border-radius:14px;background:#24233a;color:#c9c5d8;font:600 12px Segoe UI;cursor:pointer;
  transition:opacity .3s,scale .3s,display .3s allow-discrete,background .25s,color .25s,gap .25s;transition-delay:calc(sibling-index() * 40ms)}
@starting-style{.u2n-c{opacity:0;scale:.8}}
.u2n-c.u2n-off{display:none;opacity:0;scale:.8}
.u2n-c svg{width:0;transition:width .3s cubic-bezier(.3,1.4,.5,1)}
.u2n-c.u2n-sel{background:#ff5a36;color:#fff;gap:5px}.u2n-c.u2n-sel svg{width:12px}
.u2n-code{position:absolute;left:334px;top:166px;width:288px;height:176px;border-radius:16px;background:#14131f;box-shadow:inset 0 0 0 1px #ffffff10;padding:11px 12px;box-sizing:border-box;font:9.6px/13.6px Cascadia Mono,Consolas,monospace;color:#a9a6bf;white-space:pre}
.u2n-code em{font-style:normal;color:#ff9f7a}.u2n-code u{text-decoration:none;color:#7fe0f5}
</style><div class="u2n-root">
<div class="u2n-faq"><h4>Questions</h4>${QA.map(([q, a], i) => `<details name="u2n-faq"${i === 0 ? ' open' : ''}><summary>${q}<i></i></summary><p>${a}</p></details>`).join('')}</div>
<div class="u2n-ch"><h4>Filters</h4><div class="u2n-cl">${CHIPS.map(c => `<div class="u2n-c"><svg height="12" viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>${c}</div>`).join('')}</div></div>
<div class="u2n-code"><u>:root</u> { <em>interpolate-size</em>: allow-keywords }
<u>details::details-content</u> {
  height: 0; overflow: clip;
  transition: height .45s,
    content-visibility .45s <em>allow-discrete</em> }
<u>[open]::details-content</u> { height: auto }
<u>.chip</u> { transition: opacity .3s, scale .3s,
    display .3s <em>allow-discrete</em>;
  transition-delay:
    calc(<em>sibling-index()</em> * 40ms) }
<em>@starting-style</em> { <u>.chip</u> { opacity: 0 } }</div></div>`;
      const dets = Array.from(st.querySelectorAll('details')), chips = Array.from(st.querySelectorAll('.u2n-c')).map(e => /** @type {HTMLElement} */ (e));
      let userAt = -99, now = 0, step = -1;
      st.onpointerdown = () => { userAt = now; };
      chips.forEach(c => { c.onclick = () => c.classList.toggle('u2n-sel'); });
      // Demo only: every 1.6 s open the next question or change the chip filter.
      const SUBS = [[0, 1, 2, 3, 4, 5, 6, 7], [0, 2, 5, 7], [1, 3, 4, 6], [0, 1, 2, 3, 4, 5, 6, 7]];
      return t => {
        now = t; if (t - userAt < 6) return;
        const s = Math.floor(t / 1.6); if (s === step) return; step = s;
        if (s % 2 === 0) dets[(s / 2) % dets.length].open = true;
        else { const sub = SUBS[((s - 1) / 2) % SUBS.length]; chips.forEach((c, i) => { c.classList.toggle('u2n-off', !sub.includes(i)); c.classList.toggle('u2n-sel', sub.length < 8 && sub.includes(i) && i % 2 === 0); }); }
      };
    },
  });

  // ---------------- form field micro-interactions ----------------
  EX.add({
    cat: 'ui', id: 'ui2-fields', kind: 'dom', title: 'Form field micro-interactions', aka: 'floating labels, input focus animation, password strength meter, character counter ring', tool: 'DOM + JavaScript (springs driven by input state)', runs: 'WEB',
    notice: 'Each field reacts to what you do. The label floats up and shrinks on focus, and the underline grows outward from the exact point you clicked. A wrong email shakes and slides in a hint when you leave the field, a right one draws a check. The password meter fills bar by bar and changes color, and the bio counter ring fills and turns coral at the limit. Click a field and type.',
    use: 'sign-up and checkout forms, settings, profile editors, any form that should feel alive',
    params: [{ key: 'lim', label: 'Bio character limit', min: 10, max: 80, step: 1, value: 40 }],
    prompt: 'Form micro-interactions: floating labels rise 20 px and scale to 0.78 on focus with a spring; a 2 px underline grows from the click x position with scaleX; invalid email shakes (decaying sine, 8 px) and slides a hint down on blur, valid email draws a check with stroke-dashoffset; a 4-bar password meter fills with a 60 ms stagger, coral to amber to green; a bio counter ring fills to the {lim} character limit, turns amber at 80% and coral past it.',
    setup(st, L) {
      const F = [['Full name', 'text'], ['Email', 'text'], ['Password', 'password'], ['Short bio', 'text']];
      st.innerHTML = `<style>
.u2e-bg{position:absolute;inset:0;background:radial-gradient(70% 90% at 50% 20%,#1d1b3a,#0b0b10)}
.u2e-pn{position:absolute;left:130px;top:12px;width:380px;height:336px;border-radius:18px;background:#15141f;box-shadow:0 20px 50px rgba(0,0,0,.45),inset 0 0 0 1px #ffffff10;font-family:Segoe UI}
.u2e-pn h4{position:absolute;left:24px;top:16px;margin:0;font:700 19px Bahnschrift;color:#f4efe6}
.u2e-f{position:absolute;left:24px;width:332px;height:48px}
.u2e-f input{position:absolute;left:0;right:34px;bottom:6px;height:26px;background:none;border:0;outline:0;color:#f4efe6;font:15px Segoe UI;padding:0}
.u2e-lb{position:absolute;left:0;top:18px;font:15px Segoe UI;color:#8a87a0;transform-origin:0 50%;pointer-events:none}
.u2e-ln{position:absolute;left:0;right:0;bottom:0;height:1px;background:#33324a}
.u2e-ul{position:absolute;left:0;right:0;bottom:0;height:2px;background:#ff5a36;transform:scaleX(0)}
.u2e-msg{position:absolute;left:0;top:50px;font-size:11px;color:#ff5a36;opacity:0}
.u2e-ok{position:absolute;right:6px;bottom:8px}
.u2e-bars{position:absolute;left:0;right:0;top:52px;display:flex;gap:5px}.u2e-bars i{flex:1;height:4px;border-radius:2px;background:#2a2940;position:relative;overflow:hidden}.u2e-bars b{position:absolute;inset:0;transform-origin:0 50%;transform:scaleX(0)}
.u2e-st{position:absolute;right:0;top:60px;font-size:11px;color:#8a87a0}
.u2e-ring{position:absolute;right:2px;bottom:6px}
</style><div class="u2e-bg"></div><div class="u2e-pn"><h4>Create your profile</h4>
${F.map(([l, ty], i) => `<div class="u2e-f" style="top:${52 + i * 70}px"><input type="${ty}" spellcheck="false" autocomplete="off"><div class="u2e-lb">${l}</div><div class="u2e-ln"></div><div class="u2e-ul"></div>
${i === 1 ? '<div class="u2e-msg">Enter a valid email, like name@site.com</div><svg class="u2e-ok" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#5fd38d"/><path d="M5.5 10.5l3 3 6-6.5" fill="none" stroke="#0b0b10" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="14" stroke-dashoffset="14"/></svg>' : ''}
${i === 2 ? '<div class="u2e-bars"><i><b></b></i><i><b></b></i><i><b></b></i><i><b></b></i></div><div class="u2e-st"></div>' : ''}
${i === 3 ? '<svg class="u2e-ring" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#2a2940" stroke-width="3"/><circle class="u2e-rg" cx="12" cy="12" r="9" fill="none" stroke="#2bc4e6" stroke-width="3" stroke-linecap="round" stroke-dasharray="56.5" stroke-dashoffset="56.5" transform="rotate(-90 12 12)"/></svg>' : ''}</div>`).join('')}</div>`;
      const fs = Array.from(st.querySelectorAll('.u2e-f')).map(e => { const el = /** @type {HTMLElement} */ (e); return { el, inp: /** @type {HTMLInputElement} */ (el.querySelector('input')), lb: /** @type {HTMLElement} */ (el.querySelector('.u2e-lb')), ul: /** @type {HTMLElement} */ (el.querySelector('.u2e-ul')), fl: sp(0), u: sp(0), ox: 0.5, shakeAt: -99, wasErr: false }; });
      const msg = /** @type {HTMLElement} */ (st.querySelector('.u2e-msg')), okC = /** @type {SVGElement} */ (st.querySelector('.u2e-ok')), okP = /** @type {SVGElement} */ (okC.lastElementChild);
      const bars = Array.from(st.querySelectorAll('.u2e-bars b')).map(e => /** @type {HTMLElement} */ (e)), stT = /** @type {HTMLElement} */ (st.querySelector('.u2e-st')), rg = /** @type {SVGElement} */ (st.querySelector('.u2e-rg'));
      const barK = [0, 0, 0, 0].map(() => sp(0)), okK = sp(0), msgK = sp(0), ringK = sp(0);
      let now = 0, userAt = -99, vf = -1, autoT0 = -1, lastLt = 0;
      fs.forEach((f, i) => { f.inp.onpointerdown = e => { userAt = now; const r = f.el.getBoundingClientRect(); f.ox = clamp01((e.clientX - r.left) / r.width); }; f.inp.oninput = () => { userAt = now; }; f.inp.onfocus = () => { userAt = now; vf = i; }; f.inp.onblur = () => { if (vf === i) vf = -1; }; });
      const validEmail = v => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v);
      const SCRIPT = [[0.4, 'f', 0, 0.3], [0.7, 't', 0, 'Alex Rivera'], [1.9, 'f', 1, 0.6], [2.1, 't', 1, 'alex@studio'], [3.1, 'f', 2, 0.2], [3.3, 't', 2, 'motion'], [4.1, 't', 2, 'motion-Kit-26!'], [5.4, 'f', 1, 0.8], [5.6, 't', 1, 'alex@studio.dev'], [6.4, 'f', 3, 0.4], [6.6, 't', 3, 'I make interfaces that move with care, and a little bounce.'], [9.6, 'f', -1, 0]];
      let typing = null;
      return (t, dt) => {
        now = t;
        const auto = t - userAt > 6 && !fs.some(f => document.activeElement === f.inp);
        if (auto) {
          if (autoT0 < 0) { autoT0 = t; lastLt = 0; }
          const lt = (t - autoT0) % 11;
          if (lt < lastLt) { fs.forEach(f => { f.inp.value = ''; }); typing = null; vf = -1; }
          for (const [at, k, i, v] of SCRIPT) if (lt >= +at && lastLt < +at) { if (k === 'f') { vf = +i; if (vf >= 0) fs[vf].ox = +v; } else typing = { i: +i, from: fs[+i].inp.value, to: String(v), t0: t }; }
          if (typing) { const n = Math.min(typing.to.length, Math.floor((t - typing.t0) / 0.045)); const base = typing.to.startsWith(typing.from) ? typing.from.length : 0; fs[typing.i].inp.value = typing.to.slice(0, Math.max(base, n)); if (n >= typing.to.length) typing = null; }
          lastLt = lt;
        } else autoT0 = -1;
        fs.forEach((f, i) => {
          const foc = vf === i, val = f.inp.value;
          f.fl.to = foc || val ? 1 : 0; f.u.to = foc ? 1 : 0;
          const fl = spring(f.fl, 380, 24, dt), u = spring(f.u, 300, 26, dt);
          let err = false;
          if (i === 1) { err = !!val && !foc && !validEmail(val); if (err && !f.wasErr) f.shakeAt = t; f.wasErr = err; okK.to = validEmail(val) ? 1 : 0; msgK.to = err ? 1 : 0; }
          if (i === 3) { const over = val.length > L.p.lim; if (over && !f.wasErr) f.shakeAt = t; f.wasErr = over; }
          const sh = 8 * Math.sin((t - f.shakeAt) * 40) * Math.exp(-(t - f.shakeAt) * 6) * (t - f.shakeAt < 0.8 ? 1 : 0);
          const col = err || (i === 3 && f.wasErr) ? '#ff5a36' : foc ? (i === 1 && validEmail(val) ? '#5fd38d' : '#ff5a36') : '#8a87a0';
          f.lb.style.transform = `translate(${sh}px,${-20 * fl}px) scale(${1 - 0.22 * fl})`; f.lb.style.color = fl > 0.5 ? col : '#8a87a0';
          f.ul.style.transformOrigin = `${f.ox * 100}% 50%`; f.ul.style.transform = `scaleX(${Math.max(u, err ? 1 : 0)})`; f.ul.style.background = col === '#8a87a0' ? '#ff5a36' : col;
          f.inp.style.transform = `translateX(${sh}px)`;
        });
        const ok = spring(okK, 400, 22, dt); okC.style.transform = `scale(${Math.max(0, ok)})`; okC.style.transformOrigin = '50% 50%'; okC.style.transformBox = 'fill-box'; okP.setAttribute('stroke-dashoffset', String(14 * (1 - clamp01((ok - 0.3) / 0.7))));
        const mk = spring(msgK, 400, 28, dt); msg.style.opacity = String(clamp01(mk)); msg.style.transform = `translateY(${(1 - mk) * -6}px)`;
        const pw = fs[2].inp.value; const sc = pw ? Math.min(4, (pw.length >= 6 ? 1 : 0) + (pw.length >= 10 ? 1 : 0) + (/[A-Z]/.test(pw) ? 1 : 0) + (/[0-9]/.test(pw) ? 1 : 0) + (/[^A-Za-z0-9]/.test(pw) ? 1 : 0)) : 0;
        const PC = ['#ff5a36', '#ff5a36', '#ffb020', '#5fd38d', '#5fd38d'][sc];
        barK.forEach((b, i) => { b.to = i < sc ? 1 : 0; const k = spring(b, 300 - i * 40, 22, dt); bars[i].style.transform = `scaleX(${clamp01(k)})`; bars[i].style.background = PC; });
        stT.textContent = pw ? ['Too short', 'Weak', 'Fair', 'Strong', 'Excellent'][sc] : ''; stT.style.color = PC;
        const len = fs[3].inp.value.length, lim = L.p.lim; ringK.to = Math.min(1, len / lim); const rk = spring(ringK, 300, 24, dt);
        rg.setAttribute('stroke-dashoffset', String(56.5 * (1 - clamp01(rk)))); rg.setAttribute('stroke', len > lim ? '#ff5a36' : len > lim * 0.8 ? '#ffb020' : '#2bc4e6');
      };
    },
  });

  // ---------------- lightbox with drag to dismiss ----------------
  EX.add({
    cat: 'ui', id: 'ui2-lightbox', kind: 'dom', title: 'Lightbox with drag to dismiss', aka: 'photo viewer, swipe down to close, interactive dismiss, zoom from thumbnail', tool: 'Pointer events + JavaScript (shared element, gesture-driven progress, springs)', runs: 'WEB',
    notice: 'Tap a photo and it grows out of its own cell into the viewer while the gallery dims. Pull it down and the gesture drives everything at once: the photo follows the finger, shrinks with the distance, and the backdrop fades, so you see the gallery coming back. Let go far or fast enough and it flies home into its cell; otherwise it springs back. Click a photo, then drag it down.',
    use: 'photo galleries, product images, media messages, any full-screen preview on mobile or web',
    params: [{ key: 'dist', label: 'Dismiss distance', min: 30, max: 200, step: 5, value: 90, unit: ' px' }],
    prompt: 'Photo lightbox: on tap the thumbnail animates from its grid rect to a 280 px centred viewer (shared element, spring) while a black backdrop fades to 85%. Dragging the open photo moves it with the pointer, scales it down by distance (up to 40%) and fades the backdrop by distance; on release, if it moved more than {dist} or faster than 700 px/s, animate it back into its original cell, otherwise spring it back to the centre. Hide the source cell while the photo is out.',
    setup(st, L) {
      const CW = 116, GAP = 10, GX = (640 - 4 * CW - 3 * GAP) / 2, GY = 78, VS = 260;
      st.innerHTML = `<style>
.u2l-bg{position:absolute;inset:0;background:#0f0e17;font-family:Segoe UI}
.u2l-bg h4{position:absolute;left:${GX}px;top:28px;margin:0;font:700 22px Bahnschrift;color:#f4efe6}.u2l-bg span{position:absolute;right:${GX}px;top:34px;font-size:12px;color:#8a87a0}
.domstage canvas.u2l-c{position:absolute;width:${CW}px;height:${CW}px;border-radius:10px;cursor:zoom-in}
.u2l-dim{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}
.domstage canvas.u2l-v{position:absolute;left:0;top:0;border-radius:12px;touch-action:none;cursor:grab;visibility:hidden;box-shadow:0 20px 50px rgba(0,0,0,.5)}
.u2l-cap{position:absolute;left:0;right:0;top:${180 + VS / 2 + 10}px;text-align:center;font:600 13px Segoe UI;color:#f4efe6;opacity:0;pointer-events:none}
.u2l-f{position:absolute;left:0;top:0;z-index:9;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#ffffff40;border:2px solid #fff;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.4)}
</style><div class="u2l-bg"><h4>Gallery</h4><span>Click a photo, drag it down to close</span></div>
${ALBUMS.map((_, i) => `<canvas class="u2l-c" width="${CW * 2}" height="${CW * 2}" style="left:${GX + (i % 4) * (CW + GAP)}px;top:${GY + Math.floor(i / 4) * (CW + GAP)}px"></canvas>`).join('')}
<div class="u2l-dim"></div><div class="u2l-cap"></div><canvas class="u2l-v" width="${VS * 2}" height="${VS * 2}"></canvas><div class="u2l-f"></div>`;
      const cells = Array.from(st.querySelectorAll('.u2l-c')).map(e => /** @type {HTMLCanvasElement} */ (e)), view = /** @type {HTMLCanvasElement} */ (st.querySelector('.u2l-v'));
      const dim = /** @type {HTMLElement} */ (st.querySelector('.u2l-dim')), cap = /** @type {HTMLElement} */ (st.querySelector('.u2l-cap')), finger = /** @type {HTMLElement} */ (st.querySelector('.u2l-f'));
      cells.forEach((c, i) => { const g = c.getContext('2d'); g.scale(CW * 2 / 132, CW * 2 / 132); paintCover(g, 0, 0, 132, i); });
      const vg = view.getContext('2d');
      const k = sp(0), ox = sp(0), oy = sp(0); let cur = -1, drag = null, now = 0, userAt = -99, user = false, fDown = 0;
      const cellRect = i => ({ x: GX + (i % 4) * (CW + GAP), y: GY + Math.floor(i / 4) * (CW + GAP), s: CW });
      const VR = { x: 320 - VS / 2, y: 180 - VS / 2 - 10, s: VS };
      const openAt = i => { if (cur >= 0 && k.to === 1) return; cur = i; vg.setTransform(1, 0, 0, 1, 0, 0); vg.clearRect(0, 0, VS * 2, VS * 2); vg.scale(VS * 2 / 132, VS * 2 / 132); paintCover(vg, 0, 0, 132, i); k.to = 1; ox.x = oy.x = 0; ox.v = oy.v = 0; cap.textContent = ALBUMS[i][0] + ', ' + ALBUMS[i][1]; };
      const press = (x, y) => { if (cur < 0 || k.to !== 1) return; drag = { x0: x - ox.x, y0: y - oy.x, ly: y, lt: now, v: 0 }; };
      const move = (x, y) => { if (!drag) return; const dt = Math.max(0.008, now - drag.lt); drag.v = lerp(drag.v, (y - drag.ly) / dt, 0.45); drag.ly = y; drag.lt = now; ox.x = x - drag.x0; oy.x = y - drag.y0; ox.v = oy.v = 0; };
      const release = () => { if (!drag) return; const v = drag.v; drag = null; if (Math.abs(oy.x) > L.p.dist || Math.abs(v) > 700) { k.to = 0; ox.to = 0; oy.to = 0; oy.v = v * 0.3; } else { ox.to = 0; oy.to = 0; oy.v = v; } };
      cells.forEach((c, i) => { c.onclick = () => { userAt = now; openAt(i); }; });
      view.onpointerdown = e => { userAt = now; user = true; fDown = 0; view.setPointerCapture(e.pointerId); view.style.cursor = 'grabbing'; const p = local(st, e); press(p.x, p.y); };
      view.onpointermove = e => { if (user && drag) { userAt = now; const p = local(st, e); move(p.x, p.y); } };
      view.onpointerup = () => { if (user) { user = false; userAt = now; release(); } view.style.cursor = 'grab'; };
      dim.onclick = () => { userAt = now; k.to = 0; };
      const cc = i => [cellRect(i).x + CW / 2, cellRect(i).y + CW / 2];
      // ghost: [time, x, y, pressed, action]
      const KEYS = [[0, 660, 380, 0], [0.5, ...cc(2), 0], [0.65, ...cc(2), 1, 'open2'], [0.75, ...cc(2), 0], [1.8, 330, 170, 0], [2.0, 330, 170, 1], [2.6, 340, 220, 1], [2.7, 340, 220, 0], [3.4, 320, 160, 0], [3.6, 320, 160, 1], [3.85, 300, 290, 0], [4.8, ...cc(5), 0], [4.95, ...cc(5), 1, 'open5'], [5.05, ...cc(5), 0], [6.2, 320, 170, 0], [6.4, 320, 170, 1], [6.65, 360, 310, 0], [7.6, 660, 380, 0]];
      let lastLt = 0;
      return (t, dt) => {
        now = t;
        if (!user && t - userAt > 4) {
          const lt = t % 7.6; let i = 0; while (i < KEYS.length - 2 && +KEYS[i + 1][0] <= lt) i++;
          const a = KEYS[i], b = KEYS[i + 1], e = ease.inOut(clamp01((lt - +a[0]) / (+b[0] - +a[0])));
          const fx = lerp(+a[1], +b[1], e), fy = lerp(+a[2], +b[2], e), d0 = +a[3];
          for (const kk of KEYS) if (kk[4] && lt >= +kk[0] && lastLt < +kk[0]) openAt(+String(kk[4]).slice(4));
          if (d0 && !fDown && !a[4]) press(fx, fy); else if (!d0 && fDown) release();
          fDown = a[4] ? 0 : d0; if (fDown) move(fx, fy);
          finger.style.transform = `translate(${fx}px,${fy}px) scale(${d0 ? 0.82 : 1})`; finger.style.opacity = String(clamp01(Math.min(lt * 3, (7.4 - lt) * 3)));
          lastLt = lt;
        } else { finger.style.opacity = '0'; lastLt = 0; }
        const kk = spring(k, 220, 22, dt); if (!drag) { spring(ox, 260, 24, dt); spring(oy, 260, 24, dt); }
        if (cur >= 0) {
          const c = cellRect(cur), pr = clamp01(Math.abs(oy.x) / 320), sdr = 1 - 0.4 * Math.min(1, Math.abs(oy.x) / 300);
          const s = lerp(c.s, VR.s, kk) * sdr, cx = lerp(c.x + c.s / 2, VR.x + VR.s / 2, kk) + ox.x, cy = lerp(c.y + c.s / 2, VR.y + VR.s / 2, kk) + oy.x;
          view.style.visibility = kk > 0.01 || k.to === 1 ? 'visible' : 'hidden'; view.style.width = view.style.height = s + 'px'; view.style.transform = `translate(${cx - s / 2}px,${cy - s / 2}px)`; view.style.borderRadius = lerp(10, 14, kk) + 'px';
          cells.forEach((cl, i) => { cl.style.visibility = i === cur && (kk > 0.01 || k.to === 1) ? 'hidden' : 'visible'; });
          dim.style.opacity = String(0.85 * clamp01(kk) * (1 - pr)); dim.style.pointerEvents = k.to === 1 ? 'auto' : 'none';
          cap.style.opacity = String(clamp01((kk - 0.7) / 0.3) * clamp01(1 - pr * 6));
          if (k.to === 0 && kk < 0.005 && Math.abs(ox.x) + Math.abs(oy.x) < 0.5) { cur = -1; view.style.visibility = 'hidden'; cells.forEach(cl => { cl.style.visibility = 'visible'; }); dim.style.opacity = '0'; }
        }
      };
    },
  });
})();
