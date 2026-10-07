// GPU shader demos for Motion Examples.html. All share one WebGL2 context (EX.G).
(function () {
  const G = EX.G;
  if (!G.gl) { console.warn('WebGL2 not available: GPU demos skipped'); return; }
  const gl = G.gl;
  const ASPECT = 'vec2(uRes.x/uRes.y,1.)';

  // ---------------- reaction-diffusion ----------------
  EX.add({
    cat: 'gpu', id: 'reaction', title: 'Reaction-diffusion', aka: 'Gray-Scott, Turing patterns, organic growth', tool: 'WebGL2 fragment shaders, ping-pong float textures', runs: 'GPU',
    notice: 'Two virtual chemicals spread and react on a grid. The GPU updates every cell 16 times per frame. Two numbers (feed and kill) decide whether you get coral, spots or a maze.',
    use: 'organic textures, biology themes, logo "growth" reveals',
    prompt: "Reaction-diffusion (Gray-Scott, feed {f}, kill {k}) that grows patterns out of my logo shape, 15 s, lit by its own gradient, palette violet to coral.",
    controls: [{ label: 'Coral', on: true, fn: L => L.state.set(0.0545, 0.062) }, { label: 'Spots', fn: L => L.state.set(0.0367, 0.0649) }, { label: 'Maze', fn: L => L.state.set(0.029, 0.057) }, { label: 'Reseed', group: false, fn: L => L.state.seed() }],
    params: [{"key": "f", "label": "Feed rate", "min": 0.01, "max": 0.08, "step": 0.0005, "value": 0.0545, "dec": 4}, {"key": "k", "label": "Kill rate", "min": 0.04, "max": 0.075, "step": 0.0005, "value": 0.062, "dec": 4}], setup(cv, L) {
      const ctx = cv.getContext('2d'); const SW = 320, SH = 180; const pp = G.pingpong(SW, SH, true, true);
      const init = G.prog(`uniform float uSeed; void main(){vec2 p=vUv*uRes; float b=0.; for(int i=0;i<18;i++){vec2 c=hash22(vec2(float(i),uSeed))*uRes; if(length(p-c)<3.+hash21(vec2(float(i),uSeed+3.))*7.) b=1.;} o=vec4(1.,b,0,1);}`);
      const step = G.prog(`uniform sampler2D uS; uniform float uF,uK; uniform vec3 uDrop;
        void main(){vec2 px=1./uRes; vec2 c=texture(uS,vUv).rg;
        vec2 lap=-c+.2*(texture(uS,vUv+vec2(px.x,0)).rg+texture(uS,vUv-vec2(px.x,0)).rg+texture(uS,vUv+vec2(0,px.y)).rg+texture(uS,vUv-vec2(0,px.y)).rg)
          +.05*(texture(uS,vUv+px).rg+texture(uS,vUv-px).rg+texture(uS,vUv+vec2(px.x,-px.y)).rg+texture(uS,vUv+vec2(-px.x,px.y)).rg);
        float a=c.r,b=c.g,abb=a*b*b; a+=lap.r-abb+uF*(1.-a); b+=.5*lap.g+abb-(uK+uF)*b;
        if(uDrop.z>0.&&length(vUv*uRes-uDrop.xy)<uDrop.z) b=1.;
        o=vec4(clamp(a,0.,1.),clamp(b,0.,1.),0,1);}`);
      const show = G.prog(`uniform sampler2D uS; void main(){vec2 px=1./vec2(${SW}.,${SH}.); float b=texture(uS,vUv).g;
        float bx=texture(uS,vUv+vec2(px.x,0)).g-texture(uS,vUv-vec2(px.x,0)).g, by=texture(uS,vUv+vec2(0,px.y)).g-texture(uS,vUv-vec2(0,px.y)).g;
        vec3 n=normalize(vec3(-bx*5.,-by*5.,1.)); float l=dot(n,normalize(vec3(.4,.6,1.)));
        vec3 col=mix(vec3(.05,.04,.09),pal(b*1.4+.55,vec3(.55,.4,.5),vec3(.45,.4,.4),vec3(1.),vec3(.0,.12,.3)),smoothstep(.08,.32,b));
        col*=.65+.55*l; col+=pow(max(l,0.),24.)*.25*step(.1,b); o=vec4(col,1);}`);
      const st = (L.state = { f: 0.0545, k: 0.062, seedN: 1, seed: () => {}, set: (f, k) => { void f; void k; } });
      st.seed = () => { G.draw(init, pp.write, { uSeed: st.seedN++ }); pp.swap(); };
      st.set = (f, k) => { L.p.f = f; L.p.k = k; const ins = document.querySelectorAll('#ex-reaction .tweakpanel input'); if (ins.length) { ins[0].value = f; ins[0].oninput(); ins[1].value = k; ins[1].oninput(); } st.seed(); };
      st.seed(); let nextDrop = 2;
      return t => {
        for (let i = 0; i < 16; i++) {
          let drop = [0, 0, 0]; if (i === 0 && t > nextDrop) { nextDrop = t + 1.6; drop = [Math.random() * SW, Math.random() * SH, 4]; }
          G.draw(step, pp.write, { uS: pp.read, uF: L.p.f, uK: L.p.k, uDrop: drop }); pp.swap();
        }
        G.draw(show, null, { uS: pp.read }, 640, 360); G.copy(ctx, 640, 360);
      };
    },
  });

  // ---------------- stable fluids ----------------
  EX.add({
    cat: 'gpu', id: 'fluid', title: 'Fluid simulation', aka: 'stable fluids, Navier-Stokes, ink in water, smoke 2D', tool: 'WebGL2 fragment shaders (advection, pressure solve, vorticity)', runs: 'GPU',
    notice: 'A real fluid solver: velocity is carried along by itself, a pressure step keeps the fluid from compressing, and vorticity adds curls. Three emitters stir colored dye. Drag the mouse across it to push the fluid.',
    use: 'ink and smoke looks, interactive hero sections, liquid transitions',
    prompt: "Interactive 2D fluid simulation (stable fluids, vorticity {curl}) as a website hero: cursor pushes colored ink with force {force}, brand colors coral/amber/violet, dye persistence {diss} per frame.",
    params: [{"key": "curl", "label": "Vorticity (swirl)", "min": 0, "max": 60, "step": 1, "value": 28}, {"key": "diss", "label": "Dye persistence", "min": 0.95, "max": 0.999, "step": 0.001, "value": 0.991, "dec": 3}, {"key": "force", "label": "Stir force", "min": 50, "max": 800, "step": 10, "value": 320}], setup(cv, L) {
      const ctx = cv.getContext('2d'); const SW = 160, SH = 90, DW = 640, DH = 360;
      const vel = G.pingpong(SW, SH, true), pres = G.pingpong(SW, SH, true), dye = G.pingpong(DW, DH, true), div = G.target(SW, SH, true), curl = G.target(SW, SH, true);
      const tx = [1 / SW, 1 / SH];
      const splat = G.prog(`uniform sampler2D uTex; uniform vec2 uP; uniform vec3 uC; uniform float uR; void main(){vec2 p=vUv-uP; p.x*=${DW / DH}; vec3 s=exp(-dot(p,p)/uR)*uC; o=vec4(texture(uTex,vUv).xyz+s,1);}`);
      const advect = G.prog(`uniform sampler2D uV,uSrc; uniform vec2 uTx; uniform float uDt,uDiss; void main(){vec2 c=vUv-uDt*texture(uV,vUv).xy*uTx; o=vec4(texture(uSrc,c).xyz*uDiss,1);}`);
      const divP = G.prog(`uniform sampler2D uV; uniform vec2 uTx; void main(){float L=texture(uV,vUv-vec2(uTx.x,0)).x,R=texture(uV,vUv+vec2(uTx.x,0)).x,B=texture(uV,vUv-vec2(0,uTx.y)).y,T=texture(uV,vUv+vec2(0,uTx.y)).y; o=vec4(.5*(R-L+T-B),0,0,1);}`);
      const curlP = G.prog(`uniform sampler2D uV; uniform vec2 uTx; void main(){float L=texture(uV,vUv-vec2(uTx.x,0)).y,R=texture(uV,vUv+vec2(uTx.x,0)).y,B=texture(uV,vUv-vec2(0,uTx.y)).x,T=texture(uV,vUv+vec2(0,uTx.y)).x; o=vec4(.5*(R-L-T+B),0,0,1);}`);
      const vort = G.prog(`uniform sampler2D uV,uC; uniform vec2 uTx; uniform float uDt,uCurl; void main(){float L=texture(uC,vUv-vec2(uTx.x,0)).x,R=texture(uC,vUv+vec2(uTx.x,0)).x,B=texture(uC,vUv-vec2(0,uTx.y)).x,T=texture(uC,vUv+vec2(0,uTx.y)).x,C=texture(uC,vUv).x;
        vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); f/=length(f)+1e-4; f*=uCurl*C; f.y*=-1.; vec2 v=texture(uV,vUv).xy+f*uDt; o=vec4(clamp(v,-1000.,1000.),0,1);}`);
      const jac = G.prog(`uniform sampler2D uP,uD; uniform vec2 uTx; void main(){float L=texture(uP,vUv-vec2(uTx.x,0)).x,R=texture(uP,vUv+vec2(uTx.x,0)).x,B=texture(uP,vUv-vec2(0,uTx.y)).x,T=texture(uP,vUv+vec2(0,uTx.y)).x; o=vec4((L+R+B+T-texture(uD,vUv).x)*.25,0,0,1);}`);
      const grad = G.prog(`uniform sampler2D uP,uV; uniform vec2 uTx; void main(){float L=texture(uP,vUv-vec2(uTx.x,0)).x,R=texture(uP,vUv+vec2(uTx.x,0)).x,B=texture(uP,vUv-vec2(0,uTx.y)).x,T=texture(uP,vUv+vec2(0,uTx.y)).x; o=vec4(texture(uV,vUv).xy-vec2(R-L,T-B)*.5,0,1);}`);
      const scale = G.prog(`uniform sampler2D uP; void main(){o=vec4(texture(uP,vUv).x*.8,0,0,1);}`);
      const show = G.prog(`uniform sampler2D uD; void main(){vec3 c=texture(uD,vUv).rgb; c=c/(1.+c*.6); c=pow(c,vec3(.85)); o=vec4(vec3(.03,.03,.05)+c,1);}`);
      const cols = [[1, .35, .21], [1, .69, .13], [.48, .36, 1], [.17, .77, .9]];
      let mouse = null;
      cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height; if (mouse) { mouse.dx = x - mouse.x; mouse.dy = y - mouse.y; } mouse = Object.assign(mouse || {}, { x, y, fresh: true }); });
      const doSplat = (x, y, vx, vy, col, r) => { G.draw(splat, vel.write, { uTex: vel.read, uP: [x, y], uC: [vx, vy, 0], uR: r }); vel.swap(); G.draw(splat, dye.write, { uTex: dye.read, uP: [x, y], uC: col, uR: r }); dye.swap(); };
      return (t, dt) => {
        const h = Math.min(dt, 1 / 30);
        for (let i = 0; i < 3; i++) {
          const a = t * (0.5 + i * 0.17) + i * 2.1, x = 0.5 + Math.cos(a) * (0.28 + 0.06 * i), y = 0.5 + Math.sin(a * 1.3) * 0.3;
          const dir = a + Math.PI / 2 + Math.sin(t * 2 + i) * 0.6; const c = cols[(i + Math.floor(t / 4)) % 4];
          doSplat(x, y, Math.cos(dir) * L.p.force, Math.sin(dir) * L.p.force, c.map(v => v * 0.7), 0.0013);
        }
        if (mouse && mouse.fresh && mouse.dx !== undefined) { doSplat(mouse.x, mouse.y, mouse.dx * 9000, mouse.dy * 9000, cols[Math.floor(t * 2) % 4].map(v => v * 0.8), 0.0015); mouse.fresh = false; }
        G.draw(curlP, curl, { uV: vel.read, uTx: tx });
        G.draw(vort, vel.write, { uV: vel.read, uC: curl, uTx: tx, uDt: h, uCurl: L.p.curl }); vel.swap();
        G.draw(divP, div, { uV: vel.read, uTx: tx });
        G.draw(scale, pres.write, { uP: pres.read }); pres.swap();
        for (let i = 0; i < 24; i++) { G.draw(jac, pres.write, { uP: pres.read, uD: div, uTx: tx }); pres.swap(); }
        G.draw(grad, vel.write, { uP: pres.read, uV: vel.read, uTx: tx }); vel.swap();
        G.draw(advect, vel.write, { uV: vel.read, uSrc: vel.read, uTx: tx, uDt: h, uDiss: 0.992 }); vel.swap();
        G.draw(advect, dye.write, { uV: vel.read, uSrc: dye.read, uTx: tx, uDt: h, uDiss: L.p.diss }); dye.swap();
        G.draw(show, null, { uD: dye.read }, DW, DH); G.copy(ctx, DW, DH);
      };
    },
  });

  // ---------------- simple full-screen shaders ----------------
  const simple = (id, title, aka, tool, notice, use, prompt, body, controls) => EX.add({ cat: 'gpu', id, title, aka, tool, runs: 'GPU', notice, use, prompt, controls, setup: G.simple(body) });

  simple('mandelbrot', 'Fractal zoom', 'Mandelbrot set, infinite zoom, deep zoom', 'GLSL fragment shader',
    'Each pixel repeats z = z² + c up to 400 times and counts how fast it escapes. That count becomes color. Zooming in reveals new detail forever, until float precision runs out.',
    'hypnotic intros, math explainers, music visuals',
    'Mandelbrot deep zoom into the seahorse valley, smooth iteration coloring with a cosine palette, 20 s zoom in and back out, seamless loop.',
    `void main(){float z=pow(10.,-4.*(.5-.5*cos(uT*.32))); vec2 c=vec2(-.743643887,.131825904)+(vUv-.5)*${ASPECT}*2.8*z;
      vec2 q=vec2(0); float n=0.; for(int i=0;i<400;i++){q=vec2(q.x*q.x-q.y*q.y,2.*q.x*q.y)+c; if(dot(q,q)>256.) break; n++;}
      if(n>=400.){o=vec4(.02,.01,.04,1);return;} float sn=n-log2(log2(dot(q,q)))+4.;
      o=vec4(pal(sn*.025+uT*.04,vec3(.5),vec3(.5),vec3(1.),vec3(.0,.1,.25)),1);}`);

  simple('kaleido', 'Kaleidoscope', 'mirror symmetry, mandala, polar repeat', 'GLSL fragment shader',
    'Coordinates are turned into angle and distance, then the angle is folded into 8 mirrored slices. Anything drawn in one slice repeats around the circle.',
    'music visuals, meditative loops, VJ content',
    'Kaleidoscope with 8 mirrored segments over flowing fractal noise, slow rotation, rings pulse at 120 BPM, palette violet/coral/cyan.',
    `uniform float uSeg; void main(){vec2 p=(vUv-.5)*${ASPECT}*2.; float r=length(p),a=atan(p.y,p.x)+uT*.1; float N=floor(uSeg); a=mod(a,2.*PI/N); a=abs(a-PI/N); p=r*vec2(cos(a),sin(a));
      p=p*1.6+vec2(uT*.25,0.); float f=fbm(p*1.4+fbm(p+uT*.12)*1.5); float rings=.5+.5*sin(r*16.-uT*4.);
      vec3 col=pal(f*1.7+r*.3+uT*.05,vec3(.5),vec3(.5),vec3(1.),vec3(.0,.33,.67)); col*=.45+.75*rings*f; col*=smoothstep(1.25,.15,r); o=vec4(col,1);}`);

  simple('tunnel', 'Infinite tunnel', 'wormhole, polar tunnel, demoscene tunnel', 'GLSL fragment shader',
    'Distance from the center is turned into depth (1 / r) and the angle wraps around the walls. Scrolling depth with time flies you forward forever.',
    'transitions, sci-fi, music videos, loading screens',
    'Endless neon tunnel: polar-coordinate tunnel with glowing grid lines, camera sways gently, speed ramps on each beat, fade to my logo at the end.',
    `void main(){vec2 p=(vUv-.5)*${ASPECT}; p+=vec2(sin(uT*.7),cos(uT*.5))*.06; float r=length(p),a=atan(p.y,p.x)/PI;
      vec2 uv=vec2(.3/r+uT*1.4,a*3.+uT*.15); vec2 g=abs(fract(uv*vec2(2.,4.))-.5); float line=smoothstep(.42,.5,max(g.x,g.y));
      float cell=hash21(floor(uv*vec2(2.,4.))); vec3 col=mix(vec3(.04,.03,.09),pal(cell+uT*.1,vec3(.5),vec3(.5),vec3(1.),vec3(0.,.33,.67)),step(.75,cell)*.7);
      col+=line*mix(vec3(1.,.36,.2),vec3(.17,.77,.9),.5+.5*sin(uv.x*.5)); col*=smoothstep(0.,.45,r)*1.2; o=vec4(col,1);}`);

  simple('voronoi', 'Voronoi cells', 'cellular noise, Worley noise, cell pattern', 'GLSL fragment shader',
    'Random points drift around; every pixel takes the color of its nearest point. The borders are where two points are equally close. Used for cracks, scales, stained glass and caustics.',
    'organic textures, stained glass, cracks, biology',
    'Animated Voronoi cells like stained glass: points drift slowly, dark borders, each cell a color from my palette, gentle glow at cell centers.',
    `void main(){vec2 p=(vUv-.5)*${ASPECT}*6.; vec2 ip=floor(p),fp=fract(p); float d1=8.,d2=8.; vec2 id=vec2(0);
      for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y); vec2 h=hash22(ip+g); vec2 r=g+.5+.42*sin(uT*.8+6.28*h)-fp; float d=dot(r,r); if(d<d1){d2=d1;d1=d;id=ip+g;}else if(d<d2)d2=d;}
      float e=sqrt(d2)-sqrt(d1); float h=hash21(id); vec3 col=pal(h*.7+.05,vec3(.5),vec3(.5),vec3(1.),vec3(0.,.33,.67))*(.5+.5*smoothstep(0.,.7,e));
      col=mix(vec3(.03),col,smoothstep(.03,.08,e)); col+=exp(-sqrt(d1)*9.)*.5; o=vec4(col,1);}`);

  simple('synthwave', 'Synthwave landscape', 'retrowave, outrun grid, 80s sunset', 'GLSL fragment shader',
    'A perspective trick maps each pixel below the horizon to a point on the ground, so the grid lines converge and scroll. The sun gets stripes and the mountains are noise silhouettes.',
    'retro intros, music, gaming, nostalgia themes',
    'Synthwave scene: neon magenta grid scrolling toward the camera, striped gradient sun, noise mountains on the horizon, scanlines, 10 s seamless loop.',
    `void main(){vec2 p=(vUv-vec2(.5,.42))*${ASPECT};
      vec3 col=mix(vec3(.05,.02,.12),vec3(.5,.1,.38),smoothstep(-.05,.6,p.y)*0.+smoothstep(.55,-.02,p.y)*.9);
      vec2 sp=p-vec2(0,.17); float sr=length(sp); float sun=smoothstep(.2,.195,sr); float stripes=step(0.,sin(sp.y*80.-uT*3.)); sun*=mix(1.,stripes,smoothstep(.03,-.14,sp.y));
      col+=mix(vec3(1.,.2,.45),vec3(1.,.82,.3),smoothstep(-.18,.18,sp.y))*sun+vec3(1.,.3,.55)*exp(-sr*5.)*.35;
      float m=.015+.09*fbm(vec2(p.x*2.6+.5,1.))+.03*vnoise(vec2(p.x*14.,3.)); if(p.y<m&&p.y>0.) col=mix(vec3(.06,.01,.12),vec3(.22,.05,.3),p.y/m);
      if(p.y<0.){float z=.11/(-p.y); vec2 g=vec2(p.x*z*1.6,z+uT*2.2); vec2 gl=abs(fract(g)-.5)/fwidth(g); float line=1.-min(min(gl.x,gl.y),1.);
        col=mix(vec3(.04,0.,.08),vec3(1.,.25,.85),line*exp(-z*.06)); col+=vec3(.7,.15,.6)*exp(p.y*14.)*.5;}
      col*=.9+.1*sin(vUv.y*uRes.y*1.6); o=vec4(col,1);}`);

  simple('caustics', 'Water caustics', 'pool light, underwater shimmer, caustic patterns', 'GLSL fragment shader (layered cellular noise)',
    'Light focused by moving waves draws bright webs on the pool floor. Two layers of cell-edge noise at different speeds make the web, and the floor tiles are bent by the same motion.',
    'summer or travel themes, calm backgrounds, product shots near water',
    'Underwater pool floor with animated caustic light webs, tiles warped by refraction, aqua palette, soft god rays, seamless 8 s loop.',
    `float web(vec2 p,float t){vec2 ip=floor(p),fp=fract(p); float d1=8.,d2=8.; for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y); vec2 h=hash22(ip+g); vec2 r=g+.5+.4*sin(t+6.28*h)-fp; float d=dot(r,r); if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;} return sqrt(d2)-sqrt(d1);}
    void main(){vec2 p=(vUv-.5)*${ASPECT}*5.; vec2 w=vec2(fbm(p*.6+uT*.15),fbm(p*.6-uT*.12))-.5; vec2 q=p+w*.8;
      float c=exp(-web(q,uT*.9)*9.)+.6*exp(-web(q*1.7+3.,uT*1.2)*10.);
      vec2 tile=abs(fract(q*.8)-.5); float grout=smoothstep(.47,.5,max(tile.x,tile.y));
      vec3 col=mix(vec3(.02,.25,.38),vec3(.05,.4,.5),vUv.y)-grout*.08; col+=vec3(.6,.95,1.)*c*.7; col+=vec3(.5,.9,1.)*pow(max(0.,sin(vUv.x*20.+uT*.5+fbm(vUv*3.)*4.)),20.)*.08*vUv.y; o=vec4(col,1);}`);

  simple('metaballs', 'Metaballs', 'blobs, lava lamp, implicit surfaces 2D', 'GLSL fragment shader',
    'Each ball adds an invisible field that fades with distance. Wherever the sum passes a threshold, the shape is filled. Balls close together merge into one smooth blob.',
    'liquid UI, playful backgrounds, lava-lamp loops',
    'Lava-lamp metaballs: 8 blobs drift and merge with smooth edges, color blends between blobs, soft rim light, dark background, 12 s loop.',
    `uniform float uSize; void main(){vec2 p=(vUv-.5)*${ASPECT}; float f=0.; vec3 cs=vec3(0);
      for(int i=0;i<8;i++){float fi=float(i); vec2 c=vec2(sin(uT*(.45+fi*.1)+fi*2.)*.48,cos(uT*(.38+fi*.08)+fi*1.3)*.26); float r=(.085+.025*sin(fi*1.7))*uSize; float k=r*r/dot(p-c,p-c); f+=k; cs+=k*pal(fi/8.,vec3(.5),vec3(.5),vec3(1.),vec3(0.,.33,.67));}
      vec3 col=cs/f; float inside=smoothstep(.97,1.03,f), rim=smoothstep(.85,1.,f)-smoothstep(1.,1.2,f);
      vec3 bg=vec3(.04,.04,.07)+col*.18*smoothstep(.25,1.,f); o=vec4(mix(bg,col*(.75+.35*smoothstep(1.,3.,f)),inside)+rim*.5,1);}`);

  simple('meshgrad', 'Mesh gradient', 'animated gradient, aurora gradient, fluid gradient background', 'GLSL fragment shader',
    'Five colored points move slowly; each pixel blends their colors by distance, then noise bends the coordinates so the edges flow. Fine grain hides color banding.',
    'website hero backgrounds, app splash screens, brand videos',
    'Soft animated mesh gradient for a website hero in my brand colors, very slow movement (20 s cycle), noise warp, subtle film grain, low contrast so text stays readable.',
    `uniform float uWarp,uGrain; void main(){vec2 p=vUv; vec2 q=p+uWarp*vec2(fbm(p*2.+uT*.08),fbm(p*2.+5.-uT*.08))-uWarp*.5;
      vec3 cols[5]=vec3[](vec3(1.,.35,.21),vec3(1.,.69,.13),vec3(.17,.77,.9),vec3(.48,.36,1.),vec3(.95,.92,.88));
      vec3 acc=vec3(0); float ws=0.; for(int i=0;i<5;i++){float fi=float(i); vec2 c=vec2(.5+.42*sin(uT*.21*(1.+fi*.3)+fi*1.7),.5+.42*cos(uT*.17*(1.+fi*.2)+fi*2.3)); float w=1./pow(length((q-c)*${ASPECT})+.05,2.4); acc+=cols[i]*w; ws+=w;}
      vec3 col=acc/ws; col+=(hash21(vUv*uRes+fract(uT)*100.)-.5)*uGrain; o=vec4(col,1);}`);

  simple('sdfmorph', 'SDF shape morph', 'signed distance field, shape tween, distance field visualization', 'GLSL fragment shader',
    'Each shape is a formula that returns the distance to its edge. Blending two formulas morphs one shape into another with no points to match up. Press "Show distance field" to see the invisible distance rings.',
    'logo morphs, icon transitions, smooth shape tweens',
    'SDF morph between circle, rounded square, star and cross, 1.6 s per shape with ease-in-out, coral fill with soft glow, then show the distance-field rings for one second.',
    `uniform float uMode;
    float sdBox(vec2 p,vec2 b){vec2 d=abs(p)-b; return length(max(d,0.))+min(max(d.x,d.y),0.);}
    float shape(int i,vec2 p){if(i==0) return length(p)-.3; if(i==1) return sdBox(p,vec2(.21))-.07;
      if(i==2){float a=atan(p.y,p.x); return (length(p)-.27*(1.+.33*cos(5.*a)))*.72;} return min(sdBox(p,vec2(.33,.085)),sdBox(p,vec2(.085,.33)))-.03;}
    void main(){vec2 p=(vUv-.5)*${ASPECT}; float c=uT/1.6; int i=int(mod(floor(c),4.)); float k=smoothstep(.5,1.,fract(c));
      float an=uT*.35; p=mat2(cos(an),-sin(an),sin(an),cos(an))*p;
      float d=mix(shape(i,p),shape(int(mod(float(i+1),4.)),p),k); vec3 col;
      if(uMode>.5){col=d>0.?vec3(.17,.62,.92):vec3(1.,.45,.25); col*=1.-exp(-6.*abs(d)); col*=.78+.22*cos(130.*d); col=mix(col,vec3(1.),1.-smoothstep(0.,.006,abs(d)));}
      else{col=vec3(.04,.04,.07)+vec3(1.,.36,.2)*exp(-max(d,0.)*13.)*.35; col=mix(col,mix(vec3(1.,.36,.2),vec3(1.,.69,.13),p.y+.5),smoothstep(.003,-.003,d));}
      o=vec4(col,1);}`,
    [{ label: 'Shape', on: true, fn: L => { if (L.state) L.state.mode = 0; } }, { label: 'Show distance field', fn: L => { if (L.state) L.state.mode = 1; } }]);

  simple('repeat', 'Infinite repetition', 'domain repetition, endless 3D grid, fly-through', 'GLSL fragment shader (ray marching)',
    'One rounded cube is described once; the coordinates are wrapped with mod(), so the same cube repeats forever in every direction. The camera flies down a gap between them.',
    'tech intros, abstract fly-throughs, data-center or "infinite" metaphors',
    'Ray-marched fly-through of an endless lattice of rounded cubes (domain repetition), cubes pulse in size with a wave, colored per cell, fog in the distance, camera rolls slowly.',
    `float map(vec3 p){vec3 id=floor((p+1.)/2.); vec3 q=mod(p+1.,2.)-1.; float s=.24+.14*sin(uT*2.+id.x*1.3+id.y*2.1+id.z*.7); vec3 d=abs(q)-vec3(s); return length(max(d,0.))+min(max(d.x,max(d.y,d.z)),0.)-.07;}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; vec3 ro=vec3(1.+sin(uT*.3)*.25,1.+cos(uT*.25)*.25,uT*1.6); vec3 rd=normalize(vec3(uv,1.1)); float a=uT*.15; rd.xy=mat2(cos(a),-sin(a),sin(a),cos(a))*rd.xy;
      float t=0.; for(int i=0;i<100;i++){float d=map(ro+rd*t); if(d<.001||t>40.) break; t+=d*.9;}
      vec3 col=vec3(.02,.02,.04);
      if(t<40.){vec3 p=ro+rd*t; vec2 e=vec2(.001,0); vec3 n=normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));
        vec3 id=floor((p+1.)/2.); vec3 base=pal(hash21(id.xy+id.z*7.),vec3(.5),vec3(.5),vec3(1.),vec3(0.,.33,.67)); vec3 L=normalize(vec3(.5,.8,-.3));
        col=base*(.15+.85*max(dot(n,L),0.))+pow(max(dot(reflect(rd,n),L),0.),24.)*.6; col=mix(col,vec3(.02,.02,.04),1.-exp(-t*.07));}
      o=vec4(pow(col,vec3(.4545)),1);}`);

  simple('domainwarp', 'Domain-warped noise', 'fBm, marble shader, liquid noise', 'GLSL fragment shader',
    'Fractal noise (fBm) is fed back into itself twice: the output of one noise bends the coordinates of the next. That feedback turns plain clouds into marble, smoke and liquid. Push the warp slider to see the effect grow from soft clouds to swirls.',
    'backgrounds, music visuals, organic brand textures',
    'Seamless 10 s loop: domain-warped fBm noise, slow drift, cosine palette in deep violet and orange, lit by its own gradient.',
    `uniform float uWarp,uScale; void main(){vec2 p=(vUv-.5)*${ASPECT}*uScale;
      vec2 q=vec2(fbm(p+uT*.08),fbm(p+vec2(5.2,1.3)));
      vec2 r=vec2(fbm(p+uWarp*q+vec2(1.7,9.2)+uT*.15),fbm(p+uWarp*q+vec2(8.3,2.8)+uT*.12));
      float f=fbm(p+uWarp*1.1*r);
      vec3 col=.5+.42*cos(6.2832*(f*1.3+length(q)*.4+uT*.03+vec3(.02,.15,.32)));
      vec2 e=vec2(.004,0.); float fx=fbm(p+e+uWarp*1.1*r), fy=fbm(p+e.yx+uWarp*1.1*r);
      vec3 n=normalize(vec3((f-fx)/e.x,(f-fy)/e.x,5.)); col*=.55+.9*f*f; col+=pow(max(dot(n,normalize(vec3(.4,.5,1.))),0.),16.)*.25;
      o=vec4(col,1);}`);

  // ---------------- post FX lab ----------------
  const FX = ['Original', 'Pixelate', 'Halftone', 'Dither', 'ASCII', 'CRT', 'Glitch', 'Toon + edges', 'Duotone'];
  EX.add({
    cat: 'gpu', id: 'fxlab', title: 'Post-processing lab', aka: 'post FX, filters, stylization, compositing', tool: 'GLSL fragment shader on an image or video', runs: 'GPU',
    notice: 'The same frame from the reel, run through nine post effects. Each one is a small shader applied after rendering, the way a filter is applied in an editor. Pick one with the buttons.',
    use: 'giving any footage a style: retro, print, terminal, comic, broken-signal',
    prompt: 'Apply a post-processing stack to my video: ordered (Bayer) dithering in two brand colors, plus a CRT pass with scanlines, slight barrel distortion and RGB mask. Keep the original timing.',
    controls: FX.map((f, i) => ({ label: f, on: i === 0, fn: L => { L.state.mode = i; } })),
    setup(cv, L) {
      const ctx = cv.getContext('2d'); const st = (L.state = { mode: 0 });
      const imgTex = gl.createTexture(), atlasTex = gl.createTexture(); let ready = false;
      const setTex = (tex, src) => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); };
      const at = document.createElement('canvas'); at.width = 160; at.height = 16; const ag = at.getContext('2d');
      ag.fillStyle = '#000'; ag.fillRect(0, 0, 160, 16); ag.fillStyle = '#fff'; ag.font = '700 15px Consolas'; ag.textAlign = 'center'; ag.textBaseline = 'middle';
      ' .:-=+*#%@'.split('').forEach((ch, i) => ag.fillText(ch, i * 16 + 8, 8)); setTex(atlasTex, at);
      const im = new Image(); im.onload = () => { setTex(imgTex, im); ready = true; }; im.src = window.FX_SOURCE;
      const prog = G.prog(`uniform sampler2D uImg,uAtlas; uniform float uMode;
        vec3 img(vec2 uv){return texture(uImg,uv).rgb;} float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
        void main(){vec2 uv=vUv,px=uv*uRes; vec3 col=img(uv); int m=int(uMode+.5);
        if(m==1){float s=10.; col=img((floor(px/s)+.5)*s/uRes);}
        else if(m==2){float s=9.; vec2 r=mat2(.7071,-.7071,.7071,.7071)*px; vec2 cell=floor(r/s),f=fract(r/s)-.5; vec2 ctr=mat2(.7071,.7071,-.7071,.7071)*((cell+.5)*s)/uRes; float l=lum(img(ctr)); float rr=sqrt(1.-l)*.62; col=mix(vec3(.96,.93,.88),vec3(.1,.08,.14),smoothstep(rr+.06,rr-.06,length(f)));}
        else if(m==3){vec2 q=floor(px/2.); int bx=int(mod(q.x,4.)),by=int(mod(q.y,4.)); float bay[16]=float[](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); float th=(bay[by*4+bx]+.5)/16.; float l=lum(img((q*2.+1.)/uRes)); col=l>th?vec3(1.,.69,.42):vec3(.16,.07,.2);}
        else if(m==4){float s=8.; vec2 cell=floor(px/s); vec3 c=img((cell+.5)*s/uRes); float idx=floor(clamp(lum(c),0.,.999)*10.); vec2 f=fract(px/s); float g=texture(uAtlas,vec2((idx+f.x)/10.,f.y)).r; col=c*g*1.5;}
        else if(m==5){vec2 q=uv*2.-1.; q*=1.+dot(q.yx,q.yx)*.07; vec2 u=q*.5+.5; if(u.x<0.||u.y<0.||u.x>1.||u.y>1.) col=vec3(0.); else {col=vec3(img(u+vec2(.0025,0)).r,img(u).g,img(u-vec2(.0025,0)).b); col*=.7+.3*sin(u.y*uRes.y*3.14159); float mk=mod(floor(px.x),3.); col*=vec3(mk==0.?1.25:.85,mk==1.?1.25:.85,mk==2.?1.25:.85); col*=1.-.35*dot(q,q)*.5; col*=.96+.04*sin(uT*60.);}}
        else if(m==6){float row=floor(uv.y*28.); vec2 u=uv; if(hash21(vec2(row,floor(uT*8.)))<.3) u.x+=(hash21(vec2(row,floor(uT*16.)))-.5)*.12; float of=.008+.012*step(.75,hash21(vec2(floor(uT*6.),1.))); col=vec3(img(u+vec2(of,0)).r,img(u).g,img(u-vec2(of,0)).b); if(hash21(floor(uv*vec2(10.,18.))+floor(uT*5.))<.04) col=1.-col;}
        else if(m==7){vec3 q=floor(img(uv)*4.+.5)/4.; vec2 t=1./uRes; float a=lum(img(uv+t*vec2(-1,-1))),b=lum(img(uv+t*vec2(0,-1))),c=lum(img(uv+t*vec2(1,-1))),d=lum(img(uv+t*vec2(-1,0))),e=lum(img(uv+t*vec2(1,0))),f=lum(img(uv+t*vec2(-1,1))),g=lum(img(uv+t*vec2(0,1))),h=lum(img(uv+t*vec2(1,1)));
          float gx=-a-2.*d-f+c+2.*e+h, gy=-a-2.*b-c+f+2.*g+h; col=q*(1.-smoothstep(.2,.45,length(vec2(gx,gy))));}
        else if(m==8){float l=lum(img(uv)); col=mix(vec3(.11,.1,.3),vec3(1.,.42,.3),smoothstep(.08,.85,l)); col+=(hash21(px+fract(uT)*91.)-.5)*.07;}
        o=vec4(col,1);}`);
      return t => { if (!ready) return; G.draw(prog, null, { uImg: imgTex, uAtlas: atlasTex, uMode: st.mode, uT: t }, 640, 360); G.copy(ctx, 640, 360); };
    },
  });
})();

// Tweak sliders for the full-screen shader demos (values arrive as uniforms, see G.simple).
EX.tweak('kaleido', [{ key: 'seg', label: 'Mirror segments', min: 2, max: 16, step: 1, value: 8 }], 'Kaleidoscope with {seg} mirrored segments over flowing fractal noise, slow rotation, rings pulse at 120 BPM, palette violet/coral/cyan.');
EX.tweak('metaballs', [{ key: 'size', label: 'Blob size', min: 0.4, max: 2, step: 0.05, value: 1, unit: 'x' }], 'Lava-lamp metaballs: 8 blobs at {size} size drift and merge with smooth edges, color blends between blobs, soft rim light, dark background, 12 s loop.');
EX.tweak('meshgrad', [{ key: 'warp', label: 'Noise warp', min: 0, max: 0.4, step: 0.01, value: 0.14 }, { key: 'grain', label: 'Film grain', min: 0, max: 0.15, step: 0.005, value: 0.045, dec: 3 }], 'Soft animated mesh gradient for a website hero in my brand colors, very slow movement (20 s cycle), noise warp {warp}, film grain {grain}, low contrast so text stays readable.');
EX.tweak('domainwarp', [{ key: 'warp', label: 'Warp strength', min: 0, max: 6, step: 0.1, value: 3.5 }, { key: 'scale', label: 'Zoom out', min: 1, max: 8, step: 0.1, value: 3.2 }], 'Seamless 10 s loop: domain-warped fBm noise (warp strength {warp}, scale {scale}), slow drift, cosine palette in deep violet and orange, lit by its own gradient.');
