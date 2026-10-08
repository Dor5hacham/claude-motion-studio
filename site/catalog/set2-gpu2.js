// GPU simulations and stylized looks, second set (shared WebGL2 context EX.G, see gpu.js).
(function () {
  const G = EX.G; if (!G.gl) return;
  const W = 640, H = 360;



  // ---------------- Lenia ----------------
  // Orbium, the classic Lenia glider (Bert Chan), 20x20 cells for kernel radius 13.
  const ORB = [
    0, 0, 0, 0, 0, 0, .1, .14, .1, 0, 0, .03, .03, 0, 0, .3, 0, 0, 0, 0,
    0, 0, 0, 0, 0, .08, .24, .3, .3, .18, .14, .15, .16, .15, .09, .2, 0, 0, 0, 0,
    0, 0, 0, 0, 0, .15, .34, .44, .46, .38, .18, .14, .11, .13, .19, .18, .45, 0, 0, 0,
    0, 0, 0, 0, .06, .13, .39, .5, .5, .37, .06, 0, 0, 0, .02, .16, .68, 0, 0, 0,
    0, 0, 0, .11, .17, .17, .33, .4, .38, .28, .14, 0, 0, 0, 0, 0, .18, .42, 0, 0,
    0, 0, .09, .18, .13, .06, .08, .26, .32, .32, .27, 0, 0, 0, 0, 0, 0, .82, 0, 0,
    .27, 0, .16, .12, 0, 0, 0, .25, .38, .44, .45, .34, 0, 0, 0, 0, 0, .22, .17, 0,
    0, .07, .2, .02, 0, 0, 0, .31, .48, .57, .6, .57, 0, 0, 0, 0, 0, 0, .49, 0,
    0, .59, .19, 0, 0, 0, 0, .2, .57, .69, .76, .76, .49, 0, 0, 0, 0, 0, .36, 0,
    0, .58, .19, 0, 0, 0, 0, 0, .67, .83, .9, .92, .87, .12, 0, 0, 0, 0, .22, .07,
    0, 0, .46, 0, 0, 0, 0, 0, .7, .93, 1, 1, 1, .61, 0, 0, 0, 0, .18, .11,
    0, 0, .82, 0, 0, 0, 0, 0, .47, 1, 1, .98, 1, .96, .27, 0, 0, 0, .19, .1,
    0, 0, .46, 0, 0, 0, 0, 0, .25, 1, 1, .84, .92, .97, .54, .14, .04, .1, .21, .05,
    0, 0, 0, .4, 0, 0, 0, 0, .09, .8, 1, .82, .8, .85, .63, .31, .18, .19, .2, .01,
    0, 0, 0, .36, .1, 0, 0, 0, .05, .54, .86, .79, .74, .72, .6, .39, .28, .24, .13, 0,
    0, 0, 0, .01, .3, .07, 0, 0, .08, .36, .64, .7, .64, .6, .51, .39, .29, .19, .04, 0,
    0, 0, 0, 0, .1, .24, .14, .1, .15, .29, .45, .53, .52, .46, .4, .31, .21, .08, 0, 0,
    0, 0, 0, 0, 0, .08, .21, .21, .22, .29, .36, .39, .37, .33, .26, .18, .09, 0, 0, 0,
    0, 0, 0, 0, 0, 0, .03, .13, .19, .22, .24, .24, .23, .18, .13, .05, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, .02, .06, .08, .09, .07, .05, .01, 0, 0, 0, 0, 0];
  EX.add({
    cat: 'gpu', id: 'h2-lenia', title: 'Lenia creatures', aka: 'continuous cellular automaton, artificial life, Orbium glider, SmoothLife', tool: 'WebGL2 fragment shaders, ping-pong float textures (ring kernel convolution)', runs: 'GPU',
    notice: 'Every cell holds a value from 0 to 1. Each step it sums its neighbors through a soft ring-shaped kernel 13 cells wide, and a bell curve turns that sum into growth or decay. With the right curve, blobs hold their shape and glide like living cells. Click to drop a new creature; push the sliders and watch them starve or explode.',
    use: 'science and biotech visuals, generative "living" logos, calm ambient loops',
    prompt: 'Lenia artificial life on the GPU: Orbium gliders (kernel radius 13, growth center {mu}, width {sigma}, dt 0.1) drift on a wrapping petri dish, glowing coral bodies with cyan growth fronts and faint violet trails, microscope vignette and HUD, 30 s ambient loop.',
    params: [{ key: 'mu', label: 'Growth center (mu)', min: 0.11, max: 0.19, step: 0.001, value: 0.15, dec: 3 }, { key: 'sigma', label: 'Growth width (sigma)', min: 0.008, max: 0.028, step: 0.0005, value: 0.015, dec: 4 }],
    controls: [{ label: 'Reseed', fn: L => L.state.seed() }, { label: 'Drop creature', fn: L => L.state.drop() }],
    setup(cv, L) {
      const ctx = cv.getContext('2d'); const SW = 192, SH = 108, R = 13;
      const pp = G.pingpong(SW, SH, true, true), trail = G.pingpong(SW, SH, true, true);
      let ks = 0; for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const r = Math.hypot(x, y) / R; if (r < 1) ks += Math.exp(-0.5 * Math.pow((r - 0.5) / 0.15, 2)); }
      const clear = G.prog(`void main(){o=vec4(0);}`);
      const stamp = G.prog(`uniform sampler2D uS; uniform vec4 uC; const float ORB[400]=float[](${ORB.map(v => v.toFixed(2)).join(',')});
        float orb(ivec2 i){return (i.x<0||i.y<0||i.x>19||i.y>19)?0.:ORB[i.y*20+i.x];}
        void main(){vec4 s=texelFetch(uS,ivec2(gl_FragCoord.xy),0); vec2 d=floor(gl_FragCoord.xy)-floor(uC.xy); d-=uRes*floor(d/uRes+.5);
        int k=int(uC.z); if(k%2==1) d=vec2(-d.y,d.x); if(k/2%2==1) d=-d; if(k>=4) d.x=-d.x;
        o=vec4(max(s.r,orb(ivec2(d)+10)),s.gba);}`);
      const step = G.prog(`uniform sampler2D uS; uniform float uM,uSg,uKn;
        void main(){ivec2 p=ivec2(gl_FragCoord.xy),N=ivec2(uRes); float u=0.;
          for(int y=-${R};y<=${R};y++)for(int x=-${R};x<=${R};x++){float r=length(vec2(x,y))/${R}.; if(r>=1.) continue; u+=exp(-.5*pow((r-.5)/.15,2.))*texelFetch(uS,(p+ivec2(x,y)+N)%N,0).r;}
          u*=uKn; float g=2.*exp(-.5*pow((u-uM)/uSg,2.))-1.; float a=clamp(texelFetch(uS,p,0).r+.1*g,0.,1.); o=vec4(a,u,g,1);}`);
      const fade = G.prog(`uniform sampler2D uS,uTr; uniform float uDecay; void main(){float a=texture(uS,vUv).r; o=vec4(max(texture(uTr,vUv).r*uDecay,a),0,0,1);}`);
      const show = G.prog(`uniform sampler2D uS,uTr; uniform vec2 uGrid; uniform float uFade;
        void main(){vec2 px=1./uGrid; vec4 s=texture(uS,vUv); float a=s.r;
          float ax=texture(uS,vUv+vec2(px.x,0)).r-texture(uS,vUv-vec2(px.x,0)).r, ay=texture(uS,vUv+vec2(0,px.y)).r-texture(uS,vUv-vec2(0,px.y)).r;
          vec3 n=normalize(vec3(-ax*2.2,-ay*2.2,1.)); float lit=dot(n,normalize(vec3(-.4,.5,.8)));
          float glow=0.; for(int i=0;i<8;i++){float an=float(i)*.785; glow+=texture(uS,vUv+vec2(cos(an),sin(an))*px*2.6).r;} glow/=8.;
          vec2 cp=(vUv-.5)*vec2(uRes.x/uRes.y,1.); float vig=smoothstep(1.05,.35,length(cp));
          vec3 col=vec3(.025,.03,.06)+vec3(.02,.04,.08)*vig;
          vec2 gd=abs(fract(vUv*uGrid/12.)-.5); col+=vec3(.05,.07,.12)*smoothstep(.47,.5,max(gd.x,gd.y))*vig;
          col+=vec3(.38,.25,.9)*texture(uTr,vUv).r*.16;
          col+=vec3(1.,.36,.21)*glow*.5;
          vec3 body=mix(vec3(.55,.12,.18),vec3(1.,.42,.25),smoothstep(.05,.5,a)); body=mix(body,vec3(1.,.88,.62),smoothstep(.6,1.,a));
          col=mix(col,body*(.6+.6*lit),smoothstep(.02,.18,a));
          col+=vec3(.17,.77,.9)*max(s.b,0.)*smoothstep(.0,.25,a)*smoothstep(.9,.4,a)*.8;
          col+=pow(max(lit,0.),18.)*.35*smoothstep(.1,.4,a);
          col*=.35+.65*vig; o=vec4(pow(col,vec3(.9))*uFade,1);}`);
      const census = G.prog(`uniform sampler2D uS; void main(){ivec2 b=ivec2(gl_FragCoord.xy)*ivec2(24,18); float m=0.; for(int y=0;y<18;y++)for(int x=0;x<24;x++) m+=texelFetch(uS,b+ivec2(x,y),0).r; o=vec4(m/432.,0,0,1);}`);
      const cen = G.target(8, 6, false, false), buf = new Uint8Array(8 * 6 * 4);
      const rnd = EX.rng(5); let steps = 0, acc = 0, nextDrop = 9, nextCensus = 1, mass = 0, reseedAt = -1, msg = '', fadeK = 1;
      const stampAt = (x, y, k) => { G.draw(stamp, pp.write, { uS: pp.read, uC: [x, y, k, 1] }); pp.swap(); };
      const st = (L.state = {
        seed: () => {
          G.draw(clear, pp.write); pp.swap(); G.draw(clear, trail.write); trail.swap(); steps = 0; msg = '';
          const k = Math.floor(rnd() * 8); for (let i = 0; i < 5; i++) stampAt(18 + i * 38 + rnd() * 8, 14 + ((i * 2) % 5) * 19 + rnd() * 6, k);
        },
        drop: () => { stampAt(rnd() * SW, rnd() * SH, Math.floor(rnd() * 8)); },
      });
      cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); stampAt((e.clientX - r.left) / r.width * SW, (1 - (e.clientY - r.top) / r.height) * SH, Math.floor(rnd() * 8)); });
      st.seed();
      return (t, dt) => {
        acc = Math.min(acc + dt * 80, 4);
        for (; acc >= 1; acc--) { G.draw(step, pp.write, { uS: pp.read, uM: L.p.mu, uSg: L.p.sigma, uKn: 1 / ks }); pp.swap(); steps++; }
        if (t > nextDrop) { nextDrop = t + 10; st.drop(); }
        // Twice a second, sum the grid in 48 blocks to spot a dead dish or a runaway bloom.
        if (t > nextCensus && reseedAt < 0) {
          nextCensus = t + 0.5; G.draw(census, cen, { uS: pp.read }); G.gl.readPixels(0, 0, 8, 6, G.gl.RGBA, G.gl.UNSIGNED_BYTE, buf);
          let full = 0; mass = 0; for (let i = 0; i < 48; i++) { mass += buf[i * 4]; if (buf[i * 4] > 40) full++; }
          if (mass < 4) { msg = 'colony died out, reseeding'; reseedAt = t + 1.2; } else if (full > 28) { msg = 'runaway bloom, reseeding'; reseedAt = t + 1.6; }
        }
        if (reseedAt > 0) { fadeK = EX.clamp01((reseedAt - t) / 0.5); if (t >= reseedAt) { st.seed(); reseedAt = -1; nextDrop = t + 9; } } else fadeK = Math.min(1, fadeK + dt * 2);
        G.draw(fade, trail.write, { uS: pp.read, uTr: trail.read, uDecay: Math.exp(-dt * 0.45) }); trail.swap();
        G.draw(show, null, { uS: pp.read, uTr: trail.read, uGrid: [SW, SH], uFade: fadeK }, W, H); G.copy(ctx, W, H);
        ctx.font = '600 11px Cascadia Mono, Consolas'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(11,11,16,.75)'; ctx.fillRect(10, 10, 330, msg && reseedAt > 0 ? 52 : 36); ctx.fillStyle = 'rgba(244,239,230,.8)';
        ctx.fillText('LENIA  /  ORBIUM', 16, 14); ctx.fillStyle = 'rgba(244,239,230,.45)';
        ctx.fillText(`mu ${L.p.mu.toFixed(3)}   sigma ${L.p.sigma.toFixed(4)}   step ${steps}   mass ${(mass * 432 / 255).toFixed(0)}`, 16, 30);
        if (msg && reseedAt > 0) { ctx.fillStyle = '#ff5a36'; ctx.fillText(msg.toUpperCase(), 16, 46); }
        ctx.fillStyle = 'rgba(244,239,230,.55)'; ctx.fillRect(W - 16 - 43, H - 22, 43, 2); ctx.fillText('R = 13 cells', W - 16 - 84, H - 38);
      };
    },
  });
  // ---------------- ripple tank ----------------
  const RIP_MODES = ['Double slit', 'Two sources', 'Single slit'];
  EX.add({
    cat: 'gpu', id: 'h2-ripple', title: 'Ripple tank', aka: 'wave equation, double-slit interference, diffraction, wave tank', tool: 'WebGL2 fragment shaders, ping-pong float textures (finite-difference wave equation)', runs: 'GPU',
    notice: 'Each cell keeps its height now and one step ago; the next height comes from the average of its neighbors, which is the 2D wave equation. Light through the water is focused by the curved crests, so they show up as bright lines, like a school ripple tank. Waves passing two slits overlap and cancel in fixed dark bands, and the strip at the right edge adds up the energy that arrives. In "Two sources", drag to move the second source.',
    use: 'physics and science explainers, calm interactive backgrounds, "signal" and "interference" metaphors',
    prompt: 'GPU ripple tank: finite-difference 2D wave equation on a 320x180 grid, plane waves (wavelength {lam} cells) pass a double slit {sep} cells apart, shadowgraph lighting with bright crests on deep teal, absorbing edges, a detector strip on the right that shows the time-averaged interference bands in amber.',
    params: [{ key: 'lam', label: 'Wavelength', min: 8, max: 26, step: 1, value: 14, unit: ' cells' }, { key: 'sep', label: 'Slit / source spacing', min: 14, max: 70, step: 1, value: 40, unit: ' cells' }],
    controls: [...RIP_MODES.map((m, i) => ({ label: m, on: i === 0, fn: L => L.state.set(i) })), { label: 'Show energy', group: false, fn: L => { L.state.view ^= 1; const b = document.querySelector('#ex-h2-ripple .ctl button:last-child'); if (b) b.classList.toggle('on', !!L.state.view); } }],
    setup(cv, L) {
      const ctx = cv.getContext('2d'); const SW = 320, SH = 180;
      const pp = G.pingpong(SW, SH, true, true), en = G.pingpong(SW, SH, true, true);
      const GEO = `uniform float uMode,uSep,uLam; uniform vec2 uB;
        float wall(vec2 q){if(uMode==1.) return 0.; if(abs(q.x-128.)>2.) return 0.; float y=q.y-90.;
          if(uMode==0.) return (abs(abs(y)-uSep*.5)<5.)?0.:1.; return abs(y)<8.?0.:1.;}
        vec2 srcA(){return vec2(70.,90.-uSep*.5);} vec2 srcB(){return uB;}`;
      const clear = G.prog(`void main(){o=vec4(0);}`);
      const step = G.prog(`uniform sampler2D uS; uniform float uPh; ${GEO}
        float h(ivec2 p){return texelFetch(uS,clamp(p,ivec2(0),ivec2(uRes)-1),0).r;}
        void main(){ivec2 p=ivec2(gl_FragCoord.xy); vec2 q=gl_FragCoord.xy; vec2 s=texelFetch(uS,p,0).rg;
          float lap=h(p+ivec2(1,0))+h(p-ivec2(1,0))+h(p+ivec2(0,1))+h(p-ivec2(0,1))-4.*s.r;
          float u=2.*s.r-s.g+.25*lap; float e=min(min(q.x,uRes.x-q.x),min(q.y,uRes.y-q.y)); float sp=clamp((22.-e)/22.,0.,1.);
          float k=1.-.16*sp*sp; u*=k*.9997; float pr=s.r*k;
          float w=sin(uPh);
          if(uMode==1.){float a=exp(-dot(q-srcA(),q-srcA())*.35)+exp(-dot(q-srcB(),q-srcB())*.35); u=mix(u,w,min(a,1.));}
          else if(abs(q.x-8.)<1.) u=w;
          if(wall(q)>.5){u=0.;pr=0.;} o=vec4(u,pr,0,1);}`);
      const accum = G.prog(`uniform sampler2D uS,uE; void main(){float u=texture(uS,vUv).r; o=vec4(mix(texture(uE,vUv).r,u*u,.008),0,0,1);}`);
      const show = G.prog(`uniform sampler2D uS,uE; uniform float uView,uPh; ${GEO}
        void main(){vec2 g=vec2(${SW}.,${SH}.); vec2 q=vUv*g; vec2 px=1./g;
          float u=texture(uS,vUv).r; float lap=texture(uS,vUv+vec2(px.x,0)).r+texture(uS,vUv-vec2(px.x,0)).r+texture(uS,vUv+vec2(0,px.y)).r+texture(uS,vUv-vec2(0,px.y)).r-4.*u;
          float gx=texture(uS,vUv+vec2(px.x,0)).r-texture(uS,vUv-vec2(px.x,0)).r;
          vec3 col=vec3(.02,.09,.12)+vec3(.02,.12,.14)*u*.5;
          float c=max(-lap,0.)*9.; col+=vec3(.55,.95,1.)*c/(1.+c)*smoothstep(10.,16.,q.x)+vec3(.2,.5,.6)*max(gx,0.)*.25*smoothstep(10.,16.,q.x);
          float E=texture(uE,vUv).r;
          if(uView>.5){float v=1.-exp(-E*60.); vec3 hc=mix(vec3(.03,.02,.08),vec3(.48,.36,1.),smoothstep(0.,.35,v)); hc=mix(hc,vec3(1.,.36,.21),smoothstep(.3,.7,v)); hc=mix(hc,vec3(1.,.85,.5),smoothstep(.7,1.,v)); col=hc+col*.15;}
          float wl=wall(q); col=mix(col,vec3(.16,.15,.24)+vec3(.12)*(1.-smoothstep(.6,1.6,abs(q.x-128.))),wl);
          if(uMode==1.){for(int i=0;i<2;i++){vec2 c=i==0?srcA():srcB(); float d=length(q-c); col+=vec3(1.,.69,.13)*(smoothstep(2.6,1.6,d)*(.7+.3*sin(uPh))+exp(-d*.35)*.25);}}
          else{col=mix(col,vec3(.08,.07,.1),step(q.x,10.)); col+=vec3(1.,.69,.13)*(smoothstep(1.2,.4,abs(q.x-8.))*.8+exp(-abs(q.x-8.)*.5)*.15)*(.75+.25*sin(uPh));}
          if(q.x>292.){float Ed=texture(uE,vec2(288.5/g.x,vUv.y)).r; float bar=step(q.x-293.,22.*(1.-exp(-Ed*45.))); col=mix(vec3(.04,.04,.07),vec3(1.,.69,.13)*(.55+.45*bar),bar)+vec3(.05)*step(abs(q.x-293.),.3);}
          o=vec4(col,1);}`);
      const st = (L.state = { mode: 0, view: 0, set: m => { st.mode = m; G.draw(clear, pp.write); pp.swap(); G.draw(clear, pp.write); pp.swap(); G.draw(clear, en.write); en.swap(); G.draw(clear, en.write); en.swap(); } });
      let B = [70, 90 + 20], drag = false, ph = 0, acc = 0;
      const toGrid = e => { const r = cv.getBoundingClientRect(); return [EX.clamp01((e.clientX - r.left) / r.width) * SW, (1 - EX.clamp01((e.clientY - r.top) / r.height)) * SH]; };
      cv.addEventListener('pointerdown', e => { if (st.mode !== 1) return; drag = true; B = toGrid(e); cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', e => { if (drag) B = toGrid(e); });
      cv.addEventListener('pointerup', () => { drag = false; });
      st.set(0);
      return (t, dt) => {
        const geo = { uMode: st.mode, uSep: L.p.sep, uLam: L.p.lam, uB: drag || st.mode !== 1 ? B : [70 + Math.sin(t * 0.4) * 30, 90 + L.p.sep * 0.5 + Math.sin(t * 0.27) * 10] };
        if (!drag && st.mode === 1) B = geo.uB;
        acc = Math.min(acc + dt * 240, 6);
        for (; acc >= 1; acc--) { ph += 2 * Math.PI * 0.5 / L.p.lam; G.draw(step, pp.write, Object.assign({ uS: pp.read, uPh: ph }, geo)); pp.swap(); G.draw(accum, en.write, { uS: pp.read, uE: en.read }); en.swap(); }
        G.draw(show, null, Object.assign({ uS: pp.read, uE: en.read, uView: st.view, uPh: ph }, geo), W, H); G.copy(ctx, W, H);
        ctx.font = '600 11px Cascadia Mono, Consolas'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(11,11,16,.8)'; ctx.fillRect(10, 10, 196, 36); ctx.fillStyle = 'rgba(244,239,230,.8)';
        ctx.fillText(RIP_MODES[st.mode].toUpperCase() + (st.view ? '  /  ENERGY' : ''), 16, 14);
        ctx.fillStyle = 'rgba(244,239,230,.55)'; ctx.fillText(`wavelength ${L.p.lam}   spacing ${L.p.sep}`, 16, 30);
        ctx.fillStyle = 'rgba(11,11,16,.85)'; ctx.fillRect(W - 66, 10, 60, 18); ctx.fillStyle = 'rgba(255,176,32,.85)'; ctx.fillText('DETECTOR', W - 62, 14);
      };
    },
  });

  // ---------------- burn-away transition ----------------
  // Draws the three title cards that burn into each other (plain Canvas 2D, uploaded once as textures).
  const burnCards = () => [0, 1, 2].map(i => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const r = EX.rng(11 + i);
    if (i === 0) {
      g.fillStyle = '#efe8dc'; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(90,70,40,${0.03 + r() * 0.05})`; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1); }
      g.strokeStyle = '#1d1b3a'; g.lineWidth = 1; g.strokeRect(24, 24, W - 48, H - 48); g.strokeRect(29, 29, W - 58, H - 58);
      g.textAlign = 'center'; g.fillStyle = '#1d1b3a'; g.font = '600 12px Cascadia Mono, Consolas'; g.fillText('M O T I O N   S T U D I O   P R E S E N T S', W / 2, 92);
      g.font = 'italic 60px Georgia'; g.fillText('The Last Letter', W / 2, 186); g.font = '18px Georgia'; g.fillStyle = '#5a5470'; g.fillText('a short film in three scenes', W / 2, 226);
      g.fillStyle = '#ff5a36'; g.beginPath(); g.arc(W - 92, H - 84, 30, 0, 7); g.fill(); g.strokeStyle = '#efe8dc'; g.lineWidth = 2; g.beginPath(); g.arc(W - 92, H - 84, 22, 0, 7); g.stroke();
      g.fillStyle = '#efe8dc'; g.font = 'italic 700 22px Georgia'; g.fillText('L', W - 92, H - 76);
    } else if (i === 1) {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0b0b1c'); gr.addColorStop(1, '#2a2050'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 140; k++) { g.fillStyle = `rgba(244,239,230,${0.2 + r() * 0.7})`; const s = r() < 0.1 ? 2 : 1; g.fillRect(r() * W, r() * H * 0.7, s, s); }
      g.fillStyle = '#f4efe6'; g.beginPath(); g.arc(520, 80, 26, 0, 7); g.fill(); g.fillStyle = '#121029'; g.beginPath(); g.arc(531, 72, 24, 0, 7); g.fill();
      g.fillStyle = '#121029'; let x = 0;
      while (x < W) { const bw = 20 + r() * 46, bh = 40 + r() * 90; g.fillRect(x, H - bh, bw - 3, bh); for (let wy = H - bh + 10; wy < H - 8; wy += 12) for (let wx = x + 5; wx < x + bw - 10; wx += 9) if (r() < 0.22) { g.fillStyle = '#ffb020'; g.fillRect(wx, wy, 3, 5); g.fillStyle = '#121029'; } x += bw; }
      g.textAlign = 'center'; g.fillStyle = '#ffb020'; g.font = '700 54px Bahnschrift'; g.fillText('C H A P T E R   T W O', W / 2, 168); g.fillStyle = 'rgba(244,239,230,.75)'; g.font = '18px Georgia'; g.fillText('the city never sleeps', W / 2, 204);
    } else {
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#ff5a36'); gr.addColorStop(1, '#ffb020'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(244,239,230,.35)'; g.lineWidth = 1; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(W / 2, H / 2, 40 + k * 26, 0, 7); g.stroke(); }
      g.textAlign = 'center'; g.fillStyle = '#f4efe6'; g.font = 'italic 700 120px Georgia'; g.fillText('Fin', W / 2, 212); g.fillStyle = '#1d1b3a'; g.font = '600 13px Cascadia Mono, Consolas'; g.fillText('T H A N K   Y O U   F O R   W A T C H I N G', W / 2, 262);
    }
    return c;
  });
  EX.add({
    cat: 'gpu', id: 'h2-burn', title: 'Burn-away transition', aka: 'paper burn dissolve, fire wipe, ember dissolve, noise threshold transition', tool: 'GLSL fragment shader (noise threshold, emissive edge ramp, analytic sparks)', runs: 'GPU',
    notice: 'Each pixel gets a burn time: its distance from the ignition point plus fractal noise. As a threshold sweeps past, the pixel turns brown, then black, then glows and opens to the next card. Sparks are born where the edge was a moment ago and rise. Click the card to light the next burn where you click.',
    use: 'title sequences, chapter breaks, "destroy the old, reveal the new" moments, vintage and adventure themes',
    prompt: 'Burn-away transition between three title cards: fire starts at one point and spreads along a noisy front over {dur}, scorched brown paper ahead of a glowing ember edge {edge} wide, black char, rising sparks, heat haze, next card revealed behind, hold 1.6 s per card, seamless loop.',
    params: [{ key: 'dur', label: 'Burn time', min: 1.2, max: 5, step: 0.1, value: 2.8, unit: ' s' }, { key: 'edge', label: 'Ember edge width', min: 0.004, max: 0.04, step: 0.001, value: 0.014, dec: 3 }],
    setup(cv, L) {
      const ctx = cv.getContext('2d'); const gl = G.gl; const HOLD = 1.6;
      const tex = burnCards().map(c => {
        const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return tx;
      });
      const prog = G.prog(`uniform sampler2D uA,uB; uniform vec2 uIgn; uniform float uTt,uDur,uEdge,uZoom;
        vec2 asp(){return vec2(uRes.x/uRes.y,1.);}
        float F(vec2 uv){vec2 p=uv*asp(); return length(p-uIgn*asp())+.34*fbm(p*3.2+uIgn*7.)+.07*fbm(p*15.);}
        float P(float tt){float x=clamp(tt/uDur,0.,1.); return -.12+2.35*pow(x,1.25);}
        void main(){vec2 uv=vUv; float d=F(uv)-P(uTt); float burning=step(0.,uTt)*step(uTt,uDur+.6);
          float hz=exp(-abs(d)*22.)*burning; vec2 w=(vec2(fbm(uv*8.+vec2(0,-uT*1.8)),fbm(uv*8.+5.+vec2(0,-uT*1.8)))-.5)*.014*hz;
          vec3 A=texture(uA,(uv+w-.5)/uZoom+.5).rgb, B=texture(uB,uv+w).rgb; float g=uEdge, c=uEdge*3.6+.012*vnoise(uv*40.); vec3 col;
          if(d<0.){col=B*(1.-.55*exp(d*45.));}
          else{float sc=smoothstep(g+c+.09,g+c,d); col=mix(A,A*vec3(.72,.46,.24),sc*.85);
            float ch=smoothstep(g+c,g+c*.35,d); col=mix(col,vec3(.045,.03,.025),ch);
            vec2 fp=uv*asp(); float fl=smoothstep(.58,.82,vnoise(fp*150.))*(.35+.65*vnoise(fp*30.+vec2(uT*3.,-uT*2.))); col+=vec3(1.,.32,.06)*fl*ch*smoothstep(g+c,g,d)*1.4;
            float e=smoothstep(g,0.,d); col=mix(col,mix(vec3(1.,.38,.06)*1.4,vec3(1.,.93,.7)*1.8,smoothstep(.45,1.,e)),e);}
          col+=vec3(1.,.42,.1)*exp(-abs(d)*26.)*.42*burning;
          for(int l=0;l<2;l++){float sc=l==0?34.:58., rise=l==0?.19:.28; vec2 p=uv*asp(); vec2 gg=(p-vec2(0.,uT*rise))*sc; vec2 id=floor(gg);
            for(int j=-1;j<=1;j++){vec2 cid=id+vec2(0,j); float h=hash21(cid+float(l)*17.); if(h<.45) continue; vec2 jit=hash22(cid+3.)-.5;
              float life=1.1+h*.6, age=fract(uT/life+h*7.); vec2 pos=(cid+.5+jit*.8)/sc+vec2(0.,uT*rise); pos.x+=sin(uT*2.+h*30.)*.012*age;
              float tb=uTt-age*life; float db=F((pos-vec2(0.,age*life*rise))/asp())-P(tb);
              float alive=exp(-abs(db)*45.)*step(0.,tb)*step(tb,uDur)*(1.-age); float r=length(p-pos);
              col+=mix(vec3(1.,.4,.1),vec3(1.,.85,.5),1.-age)*alive*(smoothstep(.0045,.0,r)*1.6+exp(-r*90.)*.25);}}
          col*=1.-.25*dot(uv-.5,uv-.5); o=vec4(col,1);}`);
      const IGN = [[0.12, 0.18], [0.88, 0.82], [0.5, 0.04], [0.92, 0.25], [0.2, 0.9], [0.06, 0.55]];
      let idx = 0, t0 = 0, ign = IGN[0], ni = 1;
      cv.addEventListener('pointerdown', e => { const tt = L.t - t0 - HOLD; if (tt > 0 && tt < L.p.dur + 0.4) return; const r = cv.getBoundingClientRect(); ign = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]; t0 = L.t - HOLD; });
      return t => {
        if (t - t0 > HOLD + L.p.dur + 0.4) { idx = (idx + 1) % 3; t0 = t; ign = IGN[ni++ % IGN.length]; }
        const tt = t - t0 - HOLD;
        G.draw(prog, null, { uA: tex[idx], uB: tex[(idx + 1) % 3], uIgn: ign, uTt: tt, uDur: L.p.dur, uEdge: L.p.edge, uZoom: 1 + 0.025 * EX.clamp01((t - t0) / (HOLD + L.p.dur)), uT: t }, W, H); G.copy(ctx, W, H);
      };
    },
  });

  // ---------------- ink drop in water ----------------
  EX.add({
    cat: 'gpu', id: 'h2-ink', title: 'Ink drop in water', aka: 'volumetric ink, vortex ring, ink in water macro, absorbing volume', tool: 'GLSL fragment shader (volume ray marching, Beer-Lambert absorption, 3D noise)', runs: 'GPU',
    notice: 'Two drops of ink sink into clear water in front of a white backdrop. Each drop is a density field: a vortex ring that rolls, widens and breaks into hanging lobes, plus a thin wake. A ray steps through the volume and each ink absorbs some colors more than others, so thin veils look pastel, thick cores look deep, and where violet and coral overlap the colors subtract.',
    use: 'beauty and cosmetics, perfume and drinks, calm premium openers, "spreading" or "mixing" metaphors',
    prompt: 'Macro shot of violet and coral ink drops falling into clear water on a white studio backdrop, ray-marched volume: each drop forms a rolling vortex ring that widens and breaks into {lobes} hanging lobes with fine turbulent wisps, Beer-Lambert absorption with ink strength {ink}, colors subtract where they overlap, slow camera drift, 10 s seamless loop.',
    params: [{ key: 'lobes', label: 'Ring lobes', min: 3, max: 9, step: 1, value: 6 }, { key: 'ink', label: 'Ink strength', min: 4, max: 30, step: 1, value: 10 }],
    setup(cv, L) {
      const ctx = cv.getContext('2d'); const RW = 480, RH = 270; const low = G.target(RW, RH, false, true);
      const vol = G.prog(`uniform float uLobes,uInk;
        float h31(vec3 p){p=fract(p*.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z);}
        float n3(vec3 p){vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}
        float drop(vec3 p,float t,float s){
          float yc=.85-1.05*(1.-exp(-t*.45))-.03*t, R=.035+.115*sqrt(t), a=.026+.008*t, A=smoothstep(1.,5.,t)*.12, tl=smoothstep(1.6,7.,t)*.42;
          vec3 q=p-vec3(0,yc,0); if(p.y<yc+.1&&length(q)>R+a+tl+A+.25) return 0.;
          float r=length(q.xz), phi=atan(q.z,q.x), lob=sin(uLobes*phi+s*6.);
          vec2 c=vec2(r-R*(1.+.25*A*lob),q.y+A*max(lob,0.)*.9); float d=length(c);
          float ang=-t*2.4; vec2 cr=mat2(cos(ang),-sin(ang),sin(ang),cos(ang))*c;
          vec3 np=vec3(cos(phi)*(R+cr.x),cr.y,sin(phi)*(R+cr.x))*9.+s*13.; float n=n3(np)*.6+n3(np*2.6)*.4, rg=1.-abs(2.*n3(np*1.7+3.)-1.);
          float ring=smoothstep(a*1.4,a*.2,d+(n-.5)*a*2.4)*(.25+.95*rg*rg);
          vec2 sx=p.xz+(vec2(n3(vec3(p.y*2.5,t*.25,s*9.)),n3(vec3(p.y*2.5+7.,t*.25,s*9.)))-.5)*(.06+.04*t);
          float stem=exp(-dot(sx,sx)/(.00018+.0002*t))*smoothstep(yc,yc+.25,p.y)*(.35+.4*n)*.5;
          float k=floor((uLobes*phi+s*6.-1.5708)/6.2832+.5); float pk=(6.2832*k+1.5708-s*6.)/uLobes;
          float yt=yc-A*.9, fk=tl*(.55+.6*fract(sin(k*12.9+s*7.)*437.5)), u=clamp((yt-p.y)/max(fk,.01),0.,1.);
          vec2 lc=vec2(cos(pk),sin(pk))*R*(1.+.25*A)*(1.+u*u*.5);
          vec2 dl=q.xz-lc+(vec2(n3(vec3(p.y*5.,k,t*.3)),n3(vec3(p.y*5.,k+5.,t*.3)))-.5)*.06*u; float w=(.008+.003*t)*(1.7-u);
          float ten=exp(-dot(dl,dl)/(w*w))*smoothstep(yt+.03,yt-.03,p.y)*smoothstep(yt-fk-.02,yt-fk+.08,p.y)*(.3+.5*n);
          vec3 bq=vec3(dl.x,p.y-(yt-fk),dl.y); float rb=.008+.016*smoothstep(2.,8.,t), db=length(vec2(length(bq.xz)-rb,bq.y*1.1));
          float bulb=smoothstep(.03,.004,db+(n-.5)*.03)*step(.01,tl)*(.3+.4*rg);
          float fade=smoothstep(0.,.25,t)*(1.-smoothstep(7.,10.,t));
          return (ring+stem+ten+bulb)*fade;}
        vec3 bg(vec2 uv){vec3 c=mix(vec3(.80,.82,.87),vec3(.97,.95,.91),smoothstep(-.2,1.,uv.y)); c+=.05*exp(-dot(uv-vec2(.55,.75),uv-vec2(.55,.75))*3.);
          float cs=pow(vnoise(uv*vec2(9.,5.)+vec2(uT*.3,uT*.2))*vnoise(uv*vec2(7.,4.)-vec2(uT*.25,0.)),2.); c+=vec3(.03,.04,.05)*cs*smoothstep(.4,1.,uv.y); return c;}
        void main(){vec2 uv=vUv, p2=(uv-.5)*vec2(uRes.x/uRes.y,1.);
          float ca=sin(uT*.0628*2.)*.35; vec3 ro=vec3(sin(ca)*2.9,.9,-cos(ca)*2.9), ww=normalize(vec3(0,-.15,0)-ro), uu=normalize(cross(vec3(0,1,0),ww)), vv=cross(ww,uu);
          vec3 rd=normalize(p2.x*uu+p2.y*vv+1.55*ww); vec3 col=bg(uv);
          vec3 bmin=vec3(-1.35,-1.2,-.8), bmax=vec3(1.35,1.1,.8); vec3 t0=(bmin-ro)/rd, t1=(bmax-ro)/rd; vec3 tn=min(t0,t1), tf=max(t0,t1);
          float tN=max(max(tn.x,tn.y),tn.z), tF=min(min(tf.x,tf.y),tf.z);
          if(tF>tN){const int N=72; float ds=(tF-tN)/float(N); float tt=tN+ds*fract(52.98*fract(dot(gl_FragCoord.xy,vec2(.0671,.00584))));
            vec3 s1=vec3(.73,1.02,.09)*uInk, s2=vec3(.02,1.05,1.55)*uInk; vec3 tau=vec3(0);
            float T1=mod(uT,10.), T2=mod(uT+5.,10.);
            for(int i=0;i<N;i++){vec3 p=ro+rd*tt; float d1=drop(p-vec3(-.62,0,.15),T1,0.), d2=drop(p-vec3(.62,.05,-.2),T2,1.);
              tau+=(s1*d1+s2*d2)*ds; if(min(min(tau.x,tau.y),tau.z)>5.) break; tt+=ds;}
            vec3 T=exp(-tau); col=col*T+vec3(.05,.03,.08)*(1.-T)*.4;}
          o=vec4(col,1);}`);
      const post = G.prog(`uniform sampler2D uL; void main(){vec3 c=texture(uL,vUv).rgb; vec2 q=vUv-.5; c*=1.-.35*dot(q,q); c+=(hash21(vUv*uRes+fract(uT)*91.)-.5)*.02; o=vec4(c,1);}`);
      return t => {
        G.draw(vol, low, { uT: t, uLobes: L.p.lobes, uInk: L.p.ink });
        G.draw(post, null, { uL: low, uT: t }, W, H); G.copy(ctx, W, H);
      };
    },
  });

  // ---------------- grass field in wind ----------------
  // Builds a program from a custom vertex shader (the shared helpers only cover full-screen passes).
  const progVF = (vs, fs) => {
    const gl = G.gl; const p = gl.createProgram();
    /** @type {[number, string][]} */ ([[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]).forEach(([k, src]) => { const sh = gl.createShader(k); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); });
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p)); return p;
  };
  EX.add({
    cat: 'gpu', id: 'h2-grass', title: 'Meadow in the wind', aka: 'grass field, instanced grass, wind gusts, procedural vegetation', tool: 'WebGL2 instanced drawing (110,000 blades built in the vertex shader) + GLSL sky', runs: 'GPU',
    notice: 'A hundred thousand grass blades come from one draw call. No mesh is uploaded: the vertex shader builds each blade from its instance number (place, height, facing) and bends it with a gust field of noise that rolls across the meadow, so waves of wind travel through the grass. Bent blades catch more of the low sun. Move the pointer over the field to part the grass.',
    use: 'nature and travel openers, calm hero loops, game-style environments, "growth" and "breeze" moods',
    prompt: 'Golden-hour meadow with 110,000 instanced grass blades built in the vertex shader, gusts of wind (strength {wind}, gust size {gust}) rolling across in visible waves, blades glow amber where backlit by a low sun, layered violet hills in haze, coral sky, the cursor parts the grass, slow 12 s loop.',
    params: [{ key: 'wind', label: 'Wind strength', min: 0, max: 1.6, step: 0.05, value: 0.8 }, { key: 'gust', label: 'Gust size', min: 0.3, max: 3, step: 0.1, value: 1.2, unit: 'x' }],
    setup(cv, L) {
      const ctx = cv.getContext('2d'); const gl = G.gl; const RW = 960, RH = 540, N = 110000;
      const CAM = 'const vec3 CAM=vec3(0.,.72,0.); const float PIT=.1, THY=.43, THX=.43*16./9.;';
      const sky = G.prog(`${CAM}
        void main(){vec2 n=vUv*2.-1.; vec3 f=vec3(0.,-sin(PIT),cos(PIT)), u=vec3(0.,cos(PIT),sin(PIT)); vec3 d=normalize(f+vec3(n.x*THX,0.,0.)+u*n.y*THY);
          vec3 sd=normalize(vec3(.32,.045,1.)); float e=d.y, sv=max(dot(d,sd),0.);
          vec3 col=mix(vec3(1.,.55,.32),vec3(.36,.24,.55),smoothstep(.0,.35,e)); col=mix(col,vec3(.12,.1,.28),smoothstep(.3,.7,e));
          col+=vec3(1.,.75,.45)*pow(sv,10.)*.65+vec3(1.,.95,.8)*smoothstep(.99955,.9997,sv)*1.6;
          float az=d.x/max(d.z,.1); float h1=.01+.07*fbm(vec2(az*1.6,1.)), h2=.004+.035*fbm(vec2(az*3.5+7.,2.));
          if(e<h1) col=mix(col,vec3(.62,.36,.46)+vec3(.25,.15,.05)*pow(sv,6.),.93); if(e<h2) col=mix(col,vec3(.42,.24,.36),.97);
          if(e<.0) col=mix(vec3(.07,.08,.03),vec3(.55,.36,.27),smoothstep(-.08,0.,e));
          o=vec4(col,1);}`);
      const vs = `#version 300 es
        precision highp float; uniform float uT,uWind,uGust; uniform vec3 uM; out vec3 vC; ${CAM}
        uint pcg(uint v){uint s=v*747796405u+2891336453u; uint w=((s>>((s>>28u)+4u))^s)*277803737u; return (w>>22u)^w;}
        float rnd(uint i){return float(pcg(i))/4294967295.;}
        float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float vn(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
        void main(){uint id=uint(gl_InstanceID)*5u; float r1=rnd(id),r2=rnd(id+1u),r3=rnd(id+2u),r4=rnd(id+3u),r5=rnd(id+4u);
          float zn=1.,zf=34.; float z=sqrt(mix(zn*zn,zf*zf,r1)); float x=(r2*2.-1.)*(z*THX*1.08+.3);
          vec3 b=vec3(x,0.,z); float H=(.26+.4*r3*r3)*(1.+z*.012), Wd=(.013+.009*r4)*(1.+z*.07);
          int v=gl_VertexID; float s=float(v/2)/4., side=float(v%2)-.5; if(v==8){s=1.;side=0.;}
          vec2 D=normalize(vec2(1.,.35)); vec2 gp=b.xz/(3.*uGust)-D*uT*.55; float g=vn(gp)*.65+vn(gp*2.3)*.35; g=smoothstep(.3,.85,g);
          float k=uWind*(.06+.95*g)+.05*sin(uT*2.3+r5*6.28);
          vec2 md=b.xz-uM.xz; float ml=length(md); float push=uM.y*smoothstep(1.4,.2,ml); vec2 bend=D*k+normalize(md+1e-4)*push*.75; bend*=min(1.,.9/max(length(bend),1e-4));
          float a=r5*6.28; vec3 R=vec3(cos(a),0.,sin(a)); float bl=length(bend);
          vec3 p=b+R*side*Wd*(1.-s*s*.95)+vec3(0.,1.,0.)*H*s*(1.-.45*bl*bl*s)+vec3(bend.x,0.,bend.y)*H*s*s;
          vec3 rel=p-CAM; vec3 f=vec3(0.,-sin(PIT),cos(PIT)), u=vec3(0.,cos(PIT),sin(PIT)); float vz=dot(rel,f);
          gl_Position=vec4(rel.x/THX,dot(rel,u)/THY,(vz*(60.+.05)-2.*60.*.05)/(60.-.05),vz);
          vec3 root=vec3(.07,.09,.04), mid=mix(vec3(.32,.42,.12),vec3(.5,.45,.14),r4), tip=mix(vec3(.95,.68,.3),vec3(1.,.82,.45),r3);
          vec3 c=mix(root,mid,smoothstep(0.,.55,s)); c=mix(c,tip,smoothstep(.45,1.,s)*(.45+.55*g*uWind/1.2+.3*r2));
          float sg=pow(max(dot(normalize(rel),normalize(vec3(.32,.045,1.))),0.),6.); c*=.62+.95*g*s*min(uWind,1.); c+=vec3(1.,.6,.25)*sg*s*s*(.35+.5*g); float fog=1.-exp(-z*.075); vC=mix(c,vec3(.78,.5,.38),fog*.85);}`;
      const grass = progVF(vs, `#version 300 es
        precision highp float; in vec3 vC; out vec4 o; void main(){o=vec4(vC,1.);}`);
      const U = { t: gl.getUniformLocation(grass, 'uT'), w: gl.getUniformLocation(grass, 'uWind'), g: gl.getUniformLocation(grass, 'uGust'), m: gl.getUniformLocation(grass, 'uM') };
      // The pointer is projected onto the ground plane with the same camera as the shaders.
      const mouse = [0, 0, 0]; let mT = 0;
      cv.addEventListener('pointermove', e => {
        const r = cv.getBoundingClientRect(), nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = 1 - ((e.clientY - r.top) / r.height) * 2, P = 0.1;
        const dy = -Math.sin(P) + Math.cos(P) * ny * 0.43, dz = Math.cos(P) + Math.sin(P) * ny * 0.43, dx = nx * 0.43 * 16 / 9;
        if (dy < -0.01) { const k = 0.72 / -dy; mouse[0] = dx * k; mouse[1] = dz * k; mT = 1; }
      });
      cv.addEventListener('pointerleave', () => { mT = 0; });
      ctx.imageSmoothingQuality = 'high';
      const rnd = EX.rng(4), SEED = Array.from({ length: 46 }, () => [rnd() * W, rnd() * H * 0.75, 0.6 + rnd() * 1.6, rnd() * 6.28]);
      return (t, dt) => {
        mouse[2] += (mT - mouse[2]) * Math.min(1, dt * 6);
        G.draw(sky, null, {}, RW, RH);
        gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST);
        gl.useProgram(grass); gl.uniform1f(U.t, t); gl.uniform1f(U.w, L.p.wind); gl.uniform1f(U.g, L.p.gust); gl.uniform3f(U.m, mouse[0], mouse[2], mouse[1]);
        gl.bindVertexArray(G.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 9, N);
        gl.disable(gl.DEPTH_TEST);
        ctx.drawImage(G.canvas, 0, 0, RW, RH, 0, 0, W, H);
        // Drifting seeds catch the low sun; they ride the same wind direction as the gusts.
        for (const q of SEED) {
          const x = ((q[0] + t * 34 * q[2] * (0.3 + L.p.wind)) % (W + 40)) - 20, y = q[1] + Math.sin(t * 0.9 + q[3]) * 14 + 8 * Math.sin(t * 2.1 + q[3] * 2);
          ctx.fillStyle = `rgba(255,214,150,${0.25 + 0.35 * q[2] / 2.2})`; ctx.beginPath(); ctx.arc(x, y, q[2] * 0.9, 0, 7); ctx.fill();
        }
      };
    },
  });

  // ---------------- oil paint (anisotropic Kuwahara) ----------------
  EX.add({
    cat: 'gpu', id: 'h2-oilpaint', title: 'Living oil painting', aka: 'anisotropic Kuwahara filter, painterly rendering, NPR, brush-stroke shader', tool: 'GLSL multi-pass: ray-marched scene, structure tensor, anisotropic Kuwahara, canvas and impasto pass', runs: 'GPU',
    notice: 'A ray-marched still life is rendered first, while the window light sweeps across it like a day passing. Then a filter finds the direction of every edge (structure tensor) and averages colors inside a small ellipse stretched along it, keeping only the calmest of eight sectors. Edges stay crisp and flat areas turn into strokes that follow the forms. A canvas weave and a fake paint relief finish the look. Use Split to compare.',
    use: 'painterly title backgrounds, art and museum themes, turning 3D or footage into a moving painting',
    prompt: 'Turn a slow 3D still life (vase, oranges, lemon on a draped table, window light sweeping across like a time-lapse) into a living oil painting: anisotropic Kuwahara filter with brush radius {rad} px and sector sharpness {q}, strokes follow the edges, canvas weave and impasto relief, warm Dutch-master palette, 12 s loop.',
    params: [{ key: 'rad', label: 'Brush radius', min: 2, max: 10, step: 0.5, value: 7, unit: ' px' }, { key: 'q', label: 'Sector sharpness', min: 2, max: 16, step: 1, value: 8 }],
    controls: [{ label: 'Painting', on: true, fn: L => { L.state.mode = 0; } }, { label: 'Split', fn: L => { L.state.mode = 1; } }, { label: 'Original', fn: L => { L.state.mode = 2; } }],
    setup(cv, L) {
      const ctx = cv.getContext('2d'); const st = (L.state = { mode: 0 });
      const scn = G.target(W, H, false, true), ten = G.target(W, H, true, true), tfm = G.target(W, H, true, true), akf = G.target(W, H, false, true);
      const scene = G.prog(`
        float sdV(vec3 p){p-=vec3(-.36,0.,.22); float y=clamp(p.y,0.,.62); float r=.11+.065*sin(y*5.6-.35)-.045*smoothstep(.42,.58,y)+.018*smoothstep(.57,.62,y); return max(length(p.xz)-r,abs(p.y-.31)-.31)*.7;}
        float sdE(vec3 p,vec3 r){float k0=length(p/r),k1=length(p/(r*r)); return k0*(k0-1.)/k1;}
        float map(vec3 p,out float m){float d=p.y-.022*sin(p.x*7.+sin(p.z*5.)*2.)*smoothstep(-.6,.4,p.z)-.01*sin(p.z*11.+p.x*3.); m=0.;
          float v=sdV(p); if(v<d){d=v;m=1.;}
          float o1=length(p-vec3(.08,.14,-.05))-.14; if(o1<d){d=o1;m=2.;} float o2=length(p-vec3(.36,.12,-.22))-.12; if(o2<d){d=o2;m=2.;} float o3=length(p-vec3(-.1,.11,-.42))-.11; if(o3<d){d=o3;m=2.;}
          float le=sdE(p-vec3(.5,.085,.18),vec3(.15,.085,.095)); if(le<d){d=le;m=3.;}
          vec3 q=p-vec3(-.36,.63,.22); if(length(q)<.4) for(int i=0;i<9;i++){float fi=float(i); float an=fi*2.4, el=.2+.8*fract(fi*.618); vec3 c=vec3(cos(an)*cos(el),sin(el)*.8,sin(an)*cos(el))*.14;
            vec3 qc=q-c; float bd=length(qc)-.066-.01*sin(qc.x*45.+fi)*sin(qc.y*45.)*sin(qc.z*45.); if(bd<d){d=bd*.8;m=5.+mod(fi,4.);}}
          float wl=1.1-p.z; if(wl<d){d=wl;m=4.;} return d;}
        float map(vec3 p){float m; return map(p,m);}
        vec3 nor(vec3 p){vec2 e=vec2(.002,0); return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
        float sha(vec3 p,vec3 l){float r=1.,t=.02; for(int i=0;i<28;i++){float h=map(p+l*t); r=min(r,10.*h/t); t+=clamp(h,.02,.2); if(r<.01||t>3.) break;} return clamp(r,0.,1.);}
        void main(){vec2 uv=(vUv-.5)*vec2(uRes.x/uRes.y,1.); float a=.3*sin(uT*.26); vec3 ta=vec3(.02,.36,0.), ro=ta+vec3(sin(a)*3.,.85,-cos(a)*3.);
          vec3 ww=normalize(ta-ro),uu=normalize(cross(vec3(0,1,0),ww)),vv=cross(ww,uu); vec3 rd=normalize(uv.x*uu+uv.y*vv+2.1*ww);
          float t=0.,m=0.; for(int i=0;i<96;i++){float d=map(ro+rd*t,m); if(d<.001||t>8.) break; t+=d;}
          vec3 p=ro+rd*t, n=nor(p); float la=-.9+.75*sin(uT*.26+1.2); vec3 l=normalize(vec3(cos(la)*-1.,.9+.3*sin(uT*.26),sin(la)*.4-.2));
          float fn=fbm(p.xy*14.+p.z*9.);
          vec3 alb=m==0.?vec3(.86,.8,.68):m==1.?vec3(.13,.2,.48):m==2.?vec3(.97,.42,.08):m==3.?vec3(.97,.82,.2):m==4.?vec3(.13,.1,.08):m==5.?vec3(1.,.36,.24):m==6.?vec3(.98,.9,.78):m==7.?vec3(.55,.36,.9):vec3(1.,.7,.15);
          if(m==0.){float sx=fract(p.x*3.2+.02*sin(p.z*9.)); alb=mix(alb,vec3(.8,.3,.2),smoothstep(.0,.03,sx)*smoothstep(.16,.13,sx)); alb=mix(alb,vec3(.25,.3,.5),smoothstep(.45,.48,sx)*smoothstep(.53,.5,sx));}
          if(m==1.) alb*=.75+.5*fn; if(m==2.||m==3.) alb*=.85+.3*fn; if(m>=5.) alb*=.75+.45*fn;
          if(m==4.) alb*=.55+.6*fbm(p.xy*2.5)+.2*fn;
          float dif=max(dot(n,l),0.)*sha(p+n*.003,l), amb=.5+.5*n.y, ao=clamp(map(p+n*.06)/.06,0.,1.);
          vec3 col=alb*(vec3(1.,.82,.6)*dif*1.5+vec3(.24,.27,.4)*amb*.55*ao); float sp=pow(max(dot(reflect(rd,n),l),0.),m==1.?40.:16.)*dif;
          col+=vec3(1.,.9,.75)*sp*(m==1.?.9:m==2.?.25:.15);
          if(m==4.) col+=vec3(.9,.62,.36)*.32*exp(-length(p.xy-vec2(-.9+.8*sin(uT*.26+1.2),.75))*2.2)*(.7+.6*fn);
          col=pow(col,vec3(.4545)); o=vec4(col,1);}`);
      const tensor = G.prog(`uniform sampler2D uS; void main(){vec2 d=1./uRes;
        vec3 gx=(-texture(uS,vUv+vec2(-d.x,-d.y)).rgb-2.*texture(uS,vUv+vec2(-d.x,0)).rgb-texture(uS,vUv+vec2(-d.x,d.y)).rgb+texture(uS,vUv+vec2(d.x,-d.y)).rgb+2.*texture(uS,vUv+vec2(d.x,0)).rgb+texture(uS,vUv+vec2(d.x,d.y)).rgb)*.25;
        vec3 gy=(-texture(uS,vUv+vec2(-d.x,-d.y)).rgb-2.*texture(uS,vUv+vec2(0,-d.y)).rgb-texture(uS,vUv+vec2(d.x,-d.y)).rgb+texture(uS,vUv+vec2(-d.x,d.y)).rgb+2.*texture(uS,vUv+vec2(0,d.y)).rgb+texture(uS,vUv+vec2(d.x,d.y)).rgb)*.25;
        o=vec4(dot(gx,gx),dot(gx,gy),dot(gy,gy),1);}`);
      const eig = G.prog(`uniform sampler2D uS; void main(){vec2 d=1./uRes; vec3 g=vec3(0); float ws=0.;
        for(int j=-4;j<=4;j++)for(int i=-4;i<=4;i++){float w=exp(-float(i*i+j*j)/18.); g+=texture(uS,vUv+vec2(i,j)*d*1.5).rgb*w; ws+=w;} g/=ws;
        float l1=.5*(g.x+g.z+sqrt((g.x-g.z)*(g.x-g.z)+4.*g.y*g.y)), l2=.5*(g.x+g.z-sqrt((g.x-g.z)*(g.x-g.z)+4.*g.y*g.y));
        vec2 t=vec2(l1-g.x,-g.y); t=length(t)>0.?normalize(t):vec2(0,1); float A=l1+l2>0.?(l1-l2)/(l1+l2):0.; o=vec4(t,A,1);}`);
      const kuw = G.prog(`uniform sampler2D uS,uF; uniform float uRad,uQ;
        void main(){vec2 d=1./uRes; vec4 f=texture(uF,vUv); vec2 t=f.xy; float A=f.z;
          float a=uRad*clamp((1.+A),.1,2.), b=uRad*clamp(1./(1.+A),.1,2.); vec2 tp=vec2(-t.y,t.x);
          int mx=min(int(sqrt(a*a*t.x*t.x+b*b*t.y*t.y)),14), my=min(int(sqrt(a*a*t.y*t.y+b*b*t.x*t.x)),14);
          vec3 m[8]; vec3 s[8]; float w[8]; for(int k=0;k<8;k++){m[k]=vec3(0);s[k]=vec3(0);w[k]=0.;}
          for(int j=-my;j<=my;j++)for(int i=-mx;i<=mx;i++){vec2 off=vec2(i,j); vec2 v=vec2(dot(off,t)/a,dot(off,tp)/b); float r2=dot(v,v); if(r2>1.) continue;
            vec3 c=texture(uS,vUv+off*d).rgb; float g=exp(-2.*r2); float rl=sqrt(r2); vec2 vn=rl>1e-3?v/rl:vec2(0);
            for(int k=0;k<8;k++){float an=float(k)*.7854; float cs=max(dot(vn,vec2(cos(an),sin(an))),0.); cs*=cs; cs*=cs; cs*=cs; float wk=(rl<.15?1.:cs)*g; m[k]+=c*wk; s[k]+=c*c*wk; w[k]+=wk;}}
          vec3 acc=vec3(0); float aw=0.; for(int k=0;k<8;k++){if(w[k]<1e-4) continue; vec3 mu=m[k]/w[k]; vec3 vr=abs(s[k]/w[k]-mu*mu); float sg=(vr.r+vr.g+vr.b)*255.; float ak=1./(1.+pow(sg,uQ*.5)); acc+=mu*ak; aw+=ak;}
          o=vec4(acc/max(aw,1e-5),1);}`);
      const fin = G.prog(`uniform sampler2D uS,uP,uF; uniform float uMode;
        float lic(vec2 px){vec3 f=texture(uF,px/uRes).xyz; vec2 dg=vec2(.8,.6), t=f.xy*sign(dot(f.xy,dg)+1e-4); t=normalize(mix(dg,t,smoothstep(.08,.45,f.z))); float s=0.; vec2 p=px; for(int k=0;k<9;k++){s+=vnoise(p/3.); p+=t*2.4;} p=px-t*2.4; for(int k=0;k<8;k++){s+=vnoise(p/3.); p-=t*2.4;} return s/17.;}
        void main(){vec2 d=1./uRes; vec2 px=vUv*uRes; vec3 src=texture(uS,vUv).rgb, pc=texture(uP,vUv).rgb;
          float h=lic(px), hx=lic(px+vec2(1,0)), hy=lic(px+vec2(0,1)); vec3 n=normalize(vec3((h-hx)*5.,(h-hy)*5.,1.)); float rel=dot(n,normalize(vec3(-.5,.6,.65)));
          float weave=.5+.25*sin(px.x*2.1)*sin(px.y*.35)+.25*sin(px.y*2.1)*sin(px.x*.35);
          vec3 paint=pc*(.86+.28*h)*(.8+.35*rel)+(weave-.5)*.04; paint=mix(vec3(dot(paint,vec3(.33))),paint,1.15);
          vec3 col=uMode==2.?src:paint; if(uMode==1.){col=vUv.x<.5?src:paint; col=mix(col,vec3(.95,.92,.85),smoothstep(1.2,0.,abs(px.x-uRes.x*.5)));}
          vec2 q=vUv-.5; col*=1.-.75*dot(q,q); o=vec4(col,1);}`);
      return t => {
        G.draw(scene, scn, { uT: t });
        G.draw(tensor, ten, { uS: scn }); G.draw(eig, tfm, { uS: ten });
        G.draw(kuw, akf, { uS: scn, uF: tfm, uRad: L.p.rad, uQ: L.p.q });
        G.draw(fin, null, { uS: scn, uP: akf, uF: tfm, uMode: st.mode }, W, H); G.copy(ctx, W, H);
        if (st.mode === 1) { ctx.font = '600 11px Cascadia Mono, Consolas'; ctx.fillStyle = 'rgba(244,239,230,.8)'; ctx.fillText('RENDER', 14, 22); ctx.fillText('PAINTED', W / 2 + 14, 22); }
      };
    },
  });





  // ---------------- video feedback ----------------
  const FB_PRESETS = [['Spiral', 1.035, 0.035, 0], ['Tunnel', 0.965, -0.02, 0], ['Mirror', 1.02, 0.012, 1]];
  EX.add({
    cat: 'gpu', id: 'h2-feedback', title: 'Video feedback echoes', aka: 'feedback loop, camera pointed at its own monitor, Droste trails, VJ feedback', tool: 'WebGL2 fragment shader (feedback through ping-pong float textures)', runs: 'GPU',
    notice: 'Each frame starts from the previous frame, slightly zoomed, turned and hue-shifted, then one neon shape is drawn on top. Old copies keep shrinking or growing away, so a single moving outline leaves spirals, tunnels and mirrored echoes, like pointing a camera at its own monitor. Move the pointer to steer the shape.',
    use: 'music videos and VJ loops, psychedelic or retro transitions, "echo" and "memory" metaphors',
    prompt: 'Analog video-feedback loop: a morphing neon polygon outline on a Lissajous path, each frame the previous frame is scaled by {zoom}, rotated {rot} rad and hue-shifted {hue}, fading slowly, so it leaves spiral and tunnel echoes, soft bloom, 12 s seamless loop.',
    params: [{ key: 'zoom', label: 'Zoom per frame', min: 0.94, max: 1.06, step: 0.001, value: 1.035, dec: 3 }, { key: 'rot', label: 'Turn per frame', min: -0.08, max: 0.08, step: 0.001, value: 0.035, dec: 3, unit: ' rad' }, { key: 'hue', label: 'Hue shift per frame', min: 0, max: 0.15, step: 0.005, value: 0.04, dec: 3 }],
    controls: FB_PRESETS.map((p, i) => ({ label: p[0], on: i === 0, fn: L => L.state.preset(i) })),
    setup(cv, L) {
      const ctx = cv.getContext('2d'); const pp = G.pingpong(W, H, true, true);
      const step = G.prog(`uniform sampler2D uP; uniform float uZoom,uRot,uHue,uMir,uTs; uniform vec2 uC;
        vec3 hue(vec3 c,float a){vec3 y=mat3(.299,.596,.211,.587,-.274,-.523,.114,-.322,.312)*c; float h=atan(y.z,y.y)+a,ch=length(y.yz); y.yz=ch*vec2(cos(h),sin(h)); return mat3(1.,1.,1.,.956,-.272,-1.106,.621,-.647,1.703)*y;}
        float poly(vec2 p,float n,float r){float a=atan(p.y,p.x)+uTs*.8, s=6.2832/n; return length(p)*cos(mod(a+s*.5,s)-s*.5)-r;}
        void main(){vec2 asp=vec2(uRes.x/uRes.y,1.); vec2 p=(vUv-.5)*asp; vec2 q=p; if(uMir>.5) q=abs(q);
          q=mat2(cos(uRot),-sin(uRot),sin(uRot),cos(uRot))*q/uZoom; vec2 uv=q/asp+.5;
          vec3 prev=(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)?vec3(0):hue(texture(uP,uv).rgb,uHue)*.982;
          float n=3.+mod(floor(uTs/2.5),4.), k=smoothstep(.0,.4,fract(uTs/2.5)); vec2 sp=uMir>.5?abs(p)-abs(uC):p-uC;
          float d=abs(mix(poly(sp,n<3.5?6.:n-1.,.15),poly(sp,n,.15),k)); vec3 sc=.6+.4*cos(6.2832*(uTs*.07+vec3(0.,.33,.67)));
          vec3 src=sc*(smoothstep(.007,.0,d)*1.4+exp(-d*40.)*.25); o=vec4(max(prev,src),1);}`);
      const show = G.prog(`uniform sampler2D uP; void main(){vec2 d=1./uRes; vec3 c=texture(uP,vUv).rgb; vec3 b=vec3(0); for(int i=0;i<8;i++){float a=float(i)*.785; b+=texture(uP,vUv+vec2(cos(a),sin(a))*d*4.).rgb;}
        c+=b/8.*.35; vec2 q=vUv-.5; c*=1.-.6*dot(q,q); c=c/(1.+c*.35); o=vec4(pow(c,vec3(.92)),1);}`);
      const clear = G.prog(`void main(){o=vec4(0,0,0,1);}`);
      const setIn = (k, v) => { L.p[k] = v; const q = (L.d.params || []).findIndex(x => x.key === k); const ins = /** @type {NodeListOf<HTMLInputElement & { oninput: () => void }>} */ (document.querySelectorAll('#ex-h2-feedback .tweakpanel input')); if (ins[q]) { ins[q].value = String(v); ins[q].oninput(); } };
      const st = (L.state = { mir: 0, preset: i => { const p = FB_PRESETS[i]; setIn('zoom', p[1]); setIn('rot', p[2]); st.mir = +p[3]; G.draw(clear, pp.write); pp.swap(); } });
      let mouse = null, acc = 0;
      cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouse = [((e.clientX - r.left) / r.width - 0.5) * W / H, 0.5 - (e.clientY - r.top) / r.height]; });
      cv.addEventListener('pointerleave', () => { mouse = null; });
      G.draw(clear, pp.write); pp.swap();
      return (t, dt) => {
        acc = Math.min(acc + dt * 60, 3);
        for (; acc >= 1; acc--) {
          const c = mouse || [Math.sin(t * 0.83) * 0.42, Math.sin(t * 1.17 + 0.6) * 0.24];
          G.draw(step, pp.write, { uP: pp.read, uZoom: L.p.zoom, uRot: L.p.rot, uHue: L.p.hue, uMir: st.mir, uTs: t, uC: c }); pp.swap();
        }
        G.draw(show, null, { uP: pp.read }, W, H); G.copy(ctx, W, H);
      };
    },
  });


  // ---------------- paper marbling ----------------
  EX.add({
    cat: 'gpu', id: 'h2-marbling', title: 'Paper marbling (ebru)', aka: 'suminagashi, marbled paper, ink drop and comb patterns, mathematical marbling', tool: 'GLSL fragment shader (exact inverse of every drop, comb and wave stroke, applied per pixel)', runs: 'GPU',
    notice: 'Ink drops land on a bath and push the older ink outward into rings; then combs and waves drag through it, the way marbled paper is made. Nothing is simulated on a grid: each drop, comb and wave is a formula with an exact inverse, so every pixel walks back through all the strokes, newest first, until it lands inside a drop and takes its color. That is why the lines stay razor sharp however much they are stretched.',
    use: 'book and stationery brands, luxury and craft packaging, artful backgrounds and transitions',
    prompt: 'Turkish paper marbling, made in a shader with the exact inverse of each stroke: {drops} ink drops in coral, amber, cream, cyan and violet fall on a navy bath and push each other into rings, then a comb with tines {tine} apart drags across, back again, then a fine vertical comb and a wave, sharp anti-aliased lines, subtle gloss, the paper lifts and it starts over, 20 s loop.',
    params: [{ key: 'drops', label: 'Ink drops', min: 8, max: 38, step: 1, value: 30 }, { key: 'tine', label: 'Comb tine spacing', min: 0.06, max: 0.3, step: 0.01, value: 0.14 }],
    setup(cv, L) {
      const ctx = cv.getContext('2d'); const gl = G.gl; const MAX = 44;
      const prog = G.prog(`uniform vec4 uA[${MAX}],uB[${MAX}]; uniform vec3 uC[${MAX}]; uniform float uN,uK,uFade;
        vec4 ink(vec2 p){for(int i=${MAX - 1};i>=0;i--){if(float(i)>=uN) continue; float k=float(i)>=uN-1.?uK:1.; vec4 a=uA[i],b=uB[i];
            if(a.x<.5){vec2 d=p-a.yz; float r=a.w*k, l2=dot(d,d); if(l2<r*r) return vec4(uC[i],sqrt(l2)/max(r,1e-5)); p=a.yz+d*sqrt(1.-r*r/l2);}
            else if(a.x<1.5){vec2 M=b.xy,N=vec2(-M.y,M.x); float d0=dot(p-a.yz,N), s=b.z; float d=abs(mod(d0+s*.5,s)-s*.5); p-=a.w*k*b.w/(d+b.w)*M;}
            else{vec2 M=b.xy,N=vec2(-M.y,M.x); p-=a.w*k*sin(b.z*dot(p,N)+b.w)*M;}}
          return vec4(.07,.09,.17,-1.);}
        void main(){vec2 asp=vec2(uRes.x/uRes.y,1.); vec3 acc=vec3(0);
          for(int s=0;s<4;s++){vec2 o2=(vec2(s%2,s/2)-.5)*.5/uRes; vec2 p=(vUv+o2-.5)*asp; vec4 c=ink(p); vec3 col=c.rgb;
            if(c.a>=0.) col*=1.-.22*smoothstep(.82,1.,c.a); acc+=col;}
          vec3 col=acc*.25; vec2 q=vUv-.5;
          float gloss=pow(max(0.,1.-length((vUv-vec2(.3,.8))*vec2(1.,1.6))),3.)*.18; col+=gloss*(1.-uFade);
          col=mix(col,vec3(.07,.09,.17),uFade); col*=1.-.5*dot(q,q); col+=(hash21(vUv*uRes)-.5)*.02; o=vec4(col,1);}`);
      const A = new Float32Array(MAX * 4), B = new Float32Array(MAX * 4), C = new Float32Array(MAX * 3);
      const COLS = [[0.96, 0.94, 0.9], [1, 0.35, 0.21], [1, 0.69, 0.13], [0.17, 0.77, 0.9], [0.48, 0.36, 1], [0.96, 0.94, 0.9], [0.95, 0.5, 0.42]];
      let ops = [], seed = 3;
      // One marbling session: drops first, then two opposing combs, a fine comb and a wave. Each op lasts dur seconds.
      const build = () => {
        const r = EX.rng(seed++); ops = []; const asp = W / H; const nd = Math.round(L.p.drops);
        const cells = []; for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) cells.push([(i + 0.2 + r() * 0.6) / 6 - 0.5, (j + 0.2 + r() * 0.6) / 4 - 0.5]);
        for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
        let ci = 0, last = null;
        for (let i = 0; i < nd; i++) {
          const ring = last && r() < 0.3; const c = ring ? last : cells[ci++ % cells.length]; last = c;
          ops.push({ a: [0, c[0] * asp * 1.05, c[1] * 1.05, ring ? 0.05 + r() * 0.06 : 0.1 + r() * 0.09], b: [0, 0, 0, 0], c: COLS[Math.floor(r() * COLS.length)], dur: 0.28, t0: 0 });
        }
        const s = L.p.tine, ang = (r() - 0.5) * 0.3;
        ops.push({ a: [1, 0, 0, 0.16], b: [Math.cos(ang), Math.sin(ang), s, 0.03], c: [0, 0, 0], dur: 2.2, t0: 0 });
        ops.push({ a: [1, 0, s * 0.5, 0.16], b: [-Math.cos(ang), -Math.sin(ang), s, 0.03], c: [0, 0, 0], dur: 2.2, t0: 0 });
        ops.push({ a: [1, 0, 0, 0.05], b: [0, 1, s * 0.4, 0.012], c: [0, 0, 0], dur: 2, t0: 0 });
        ops.push({ a: [2, 0, 0, 0.06], b: [1, 0, 9 + r() * 5, r() * 6], c: [0, 0, 0], dur: 2, t0: 0 });
        let t = 0.3; for (const o of ops) { o.t0 = t; t += o.dur; } return t;
      };
      let tStart = 0, tEnd = build();
      return t => {
        let lt = t - tStart; if (lt > tEnd + 2.9) { tEnd = build(); tStart = t; lt = 0; }
        let n = 0, k = 1;
        for (let i = 0; i < ops.length; i++) {
          const o = ops[i]; if (lt < o.t0) break; n = i + 1; const x = EX.clamp01((lt - o.t0) / o.dur); k = o.a[0] === 0 ? EX.ease.out(x) : EX.ease.inOut(x);
          A.set(o.a, i * 4); B.set(o.b, i * 4); C.set(o.c, i * 3);
        }
        const fade = EX.clamp01((lt - tEnd - 2) / 0.9);
        gl.useProgram(prog.p); gl.uniform4fv(prog.u.uA, A); gl.uniform4fv(prog.u.uB, B); gl.uniform3fv(prog.u.uC, C);
        G.draw(prog, null, { uN: n, uK: k, uFade: fade }, W, H); G.copy(ctx, W, H);
      };
    },
  });

  // ---------------- watercolor bloom ----------------
  EX.add({
    cat: 'gpu', id: 'h2-watercolor', title: 'Watercolor blooms', aka: 'wet-in-wet watercolor, pigment bleeding, edge darkening, paint simulation', tool: 'WebGL2 fragment shaders on ping-pong float textures (water flow over a paper height map, pigment transport and deposition)', runs: 'GPU',
    notice: 'Every cell of the paper holds water, pigment floating in the water, and pigment already stuck to the fibers. Water spreads to neighbors only when it can climb the paper\'s random fiber height, so edges grow ragged. Pigment rides along with the water and is pushed toward drier ground, so it piles up at the rim and dries into the dark edge real watercolor has. New drops land in wet paint and bloom into it.',
    use: 'handmade and organic brands, children\'s books, invitations, soft painterly title backgrounds',
    prompt: 'Wet-in-wet watercolor on cold-press paper simulated on the GPU: drops of coral, amber, violet, cyan and navy pigment land every {every} s, water bleeds along the paper fibers with ragged edges, pigment collects at the rims into dark edges (strength {edge}), granulation in the paper texture, colors mix where wet washes meet, 24 s then a fresh sheet.',
    params: [{ key: 'every', label: 'Seconds between drops', min: 0.3, max: 2.5, step: 0.1, value: 0.9, unit: ' s' }, { key: 'edge', label: 'Edge darkening', min: 0, max: 3, step: 0.1, value: 1.4 }],
    setup(cv, L) {
      const ctx = cv.getContext('2d'); const SW = 320, SH = 180;
      const S = G.pingpong(SW, SH, true, true), D = G.pingpong(SW, SH, true, true);
      const PAPER = 'float paper(vec2 q){return .55*vnoise(q*.9)+.3*vnoise(q*2.3+7.)+.15*vnoise(q*5.1+3.);}';
      const clear = G.prog(`void main(){o=vec4(0);}`);
      const drop = G.prog(`uniform sampler2D uS; uniform vec4 uP; uniform vec3 uA; ${PAPER}
        void main(){vec4 s=texture(uS,vUv); vec2 q=gl_FragCoord.xy; vec2 d=(q-uP.xy)/uP.z; float an=atan(d.y,d.x); float r=length(d)*(1.+.07*sin(an*3.+uP.w)+.05*sin(an*7.-uP.w*2.));
          float m=smoothstep(1.,.75,r); o=vec4(s.rgb+uA*m*.9,s.a+m*1.3);}`);
      // One water and pigment update for cell p; both passes below run it, one keeps the water, the other the pigment that sticks.
      const CORE = `uniform sampler2D uS; uniform float uEdge; ${PAPER}
        vec4 S(ivec2 p){return texelFetch(uS,clamp(p,ivec2(0),ivec2(uRes)-1),0);}
        void core(ivec2 p,out vec3 pig,out float w2,out vec3 dep){vec4 c=S(p); float hc=paper(vec2(p)); pig=c.rgb; float w=c.a;
          ivec2 N[4]=ivec2[](ivec2(1,0),ivec2(-1,0),ivec2(0,1),ivec2(0,-1)); float dw=0.; vec3 dp=vec3(0);
          for(int i=0;i<4;i++){vec4 n=S(p+N[i]); float hn=paper(vec2(p+N[i])); float th=.015+.3*hn*hn;
            float f=.16*(max(0.,n.a-w-th*step(w,.02))-max(0.,w-n.a-th*step(n.a,.02)));
            vec3 conc=f>0.?n.rgb/max(n.a,1e-3):pig/max(w,1e-3); dw+=f; dp+=f*conc;
            if(n.a>.02&&w>.02){float cap=clamp(.9*uEdge*(w-n.a),-.08,.08); dp-=cap>0.?pig*cap:n.rgb*cap;}}
          w=max(w+dw,0.); pig=max(pig+dp,vec3(0));
          w2=max(w-.001,0.); dep=pig*(w>1e-4?clamp(1.-w2/w,0.,1.):1.); dep+=pig*.0008*(1.+1.5*(1.-hc)); dep=min(dep,pig);}`;
      const step = G.prog(`${CORE} void main(){vec3 pig,dep; float w2; core(ivec2(gl_FragCoord.xy),pig,w2,dep); o=vec4(pig-dep,w2);}`);
      const depo = G.prog(`${CORE} uniform sampler2D uD; void main(){vec3 pig,dep; float w2; ivec2 p=ivec2(gl_FragCoord.xy); core(p,pig,w2,dep); o=vec4(texelFetch(uD,p,0).rgb+dep,1);}`);
      const show = G.prog(`uniform sampler2D uS,uD; uniform float uFade; uniform vec2 uGrid; ${PAPER}
        void main(){vec2 q=vUv*uGrid; vec4 s=texture(uS,vUv); vec3 d=texture(uD,vUv).rgb; float h=paper(q), hf=vnoise(vUv*uRes*.9)*.6+vnoise(vUv*uRes*.35)*.4;
          vec3 pap=vec3(.96,.93,.87)*(.93+.07*hf); vec3 A=d*(1.+.35*(1.-hf))+s.rgb*.75; vec3 col=pap*exp(-A*1.15);
          col*=1.-.06*smoothstep(.0,.25,s.a); col+=vec3(.05)*smoothstep(.05,.3,s.a)*pow(hf,3.);
          vec2 e=vec2(1./uRes.x,0); float lx=vnoise((vUv+e)*uRes*.9)-hf; col*=1.+lx*.08;
          col=mix(col,pap,uFade); vec2 v=vUv-.5; col*=1.-.25*dot(v,v); o=vec4(col,1);}`);
      const ABS = [[0, 1.05, 1.56], [0, 0.37, 2.0], [0.73, 1.02, 0], [1.77, 0.26, 0.1], [1.64, 1.71, 0.9], [0.05, 0.9, 1.4]];
      let rnd = EX.rng(9), nextDrop = 0.2, tS = 0, acc = 0, fresh = true, last = [SW / 2, SH / 2];
      const reset = () => { for (const P of [S, D]) { G.draw(clear, P.read); G.draw(clear, P.write); } };
      reset();
      return (t, dt) => {
        if (fresh) { tS = t; nextDrop = t + 0.2; fresh = false; }
        const lt = t - tS;
        if (lt > 24.8) { reset(); fresh = true; rnd = EX.rng(9 + Math.floor(t)); }
        if (t > nextDrop && lt < 22) {
          nextDrop = t + L.p.every * (0.6 + rnd() * 0.8);
          const near = rnd() < 0.55, x = near ? last[0] + (rnd() - 0.5) * 70 : 30 + rnd() * (SW - 60), y = near ? last[1] + (rnd() - 0.5) * 50 : 25 + rnd() * (SH - 50); last = [x, y];
          const a = ABS[Math.floor(rnd() * ABS.length)], k = 0.5 + rnd() * 0.7;
          G.draw(drop, S.write, { uS: S.read, uP: [x, y, 8 + rnd() * 16, rnd() * 6], uA: [a[0] * k, a[1] * k, a[2] * k] }); S.swap();
        }
        acc = Math.min(acc + dt * 60 * 4, 12);
        for (; acc >= 1; acc--) {
          G.draw(depo, D.write, { uS: S.read, uD: D.read, uEdge: L.p.edge }); D.swap();
          G.draw(step, S.write, { uS: S.read, uEdge: L.p.edge }); S.swap();
        }
        G.draw(show, null, { uS: S.read, uD: D.read, uGrid: [SW, SH], uFade: EX.clamp01((lt - 24) / 0.8) }, W, H); G.copy(ctx, W, H);
      };
    },
  });
})();
