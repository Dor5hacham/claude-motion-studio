// More GPU shader demos for Motion Examples.html (shared WebGL2 context).
(function () {
  const G = EX.G; if (!G.gl) return; const gl = G.gl;
  const ASPECT = 'vec2(uRes.x/uRes.y,1.)';
  const simple = (id, title, aka, tool, notice, use, prompt, body) => EX.add({ cat: 'gpu', id, title, aka, tool, runs: 'GPU', notice, use, prompt, setup: G.simple(body) });

  simple('ocean', 'Ocean waves', 'ray-marched water, sea shader, open ocean', 'GLSL fragment shader (height-field ray marching)',
    'The sea surface is a sum of six wave layers moving in different directions. A ray steps from the camera until it hits that surface. Reflection of the sky, a Fresnel term (more reflective at grazing angles), a sun glint and foam on the crests make it read as water.',
    'travel and nature intros, calm loops, product shots over water',
    'Ray-marched open ocean at golden hour: layered directional waves, Fresnel sky reflection, sun glitter path, foam on crests, slow forward camera drift, 10 s.',
    `uniform float uAmp; float waves(vec2 p){float h=0.,a=uAmp,f=.32; for(int i=0;i<6;i++){float fi=float(i); vec2 d=normalize(vec2(cos(fi*1.9+.3),sin(fi*1.3+.7))); float x=dot(d,p)*f+uT*sqrt(f)*1.7+fi; h+=a*(1.-abs(sin(x)))*.9-a*.45; a*=.52; f*=1.85;} return h;}
    vec3 sky(vec3 rd){vec3 sd=normalize(vec3(.2,.12,1.)); float s=max(dot(rd,sd),0.); vec3 c=mix(vec3(1.,.62,.38),vec3(.18,.24,.45),smoothstep(0.,.5,rd.y)); return c+vec3(1.,.8,.5)*pow(s,300.)*6.+vec3(1.,.55,.3)*pow(s,8.)*.4;}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; vec3 ro=vec3(0.,2.2,uT*1.4); vec3 rd=normalize(vec3(uv.x,uv.y-.18,1.)); vec3 col=sky(rd);
      if(rd.y<0.){float t=0.; for(int i=0;i<110;i++){vec3 p=ro+rd*t; float d=p.y-waves(p.xz); if(d<.002*t) break; t+=max(d*.55,.02); if(t>120.) break;}
        vec3 p=ro+rd*t; vec2 e=vec2(.05,0); vec3 n=normalize(vec3(waves(p.xz-e.xy)-waves(p.xz+e.xy),2.*e.x,waves(p.xz-e.yx)-waves(p.xz+e.yx)));
        float fr=.04+.96*pow(1.-max(dot(n,-rd),0.),5.); vec3 base=vec3(.0,.08,.13)+vec3(.0,.22,.24)*clamp(p.y+.4,0.,1.);
        col=mix(base,sky(reflect(rd,n)),fr); col+=vec3(1.)*smoothstep(.32,.55,p.y)*.35; col=mix(col,sky(rd),smoothstep(30.,110.,t));}
      o=vec4(pow(col,vec3(.9)),1);}`);

  simple('blackhole', 'Black hole', 'gravitational lensing, accretion disk, Interstellar look', 'GLSL fragment shader (artistic lensing approximation)',
    'Light from the stars behind is bent toward the center, so the starfield smears into rings near the hole. A hot spinning disk is brighter on the side moving toward you, and its far side appears bent over the top. This is an artistic approximation, not a physics simulation.',
    'space and sci-fi, "pull" or "gravity" metaphors, dramatic intros',
    'Black hole with gravitational lensing of a starfield, a glowing accretion disk brighter on the approaching side, the far side of the disk arched over the top, slow camera drift, film grain.',
    `vec3 stars(vec2 p){vec2 i=floor(p*60.); float h=hash21(i); vec3 c=vec3(0.); if(h>.985) c=vec3(1.)*smoothstep(.5,0.,length(fract(p*60.)-.5))*(h-.985)*60.; c+=vec3(.25,.12,.35)*fbm(p*3.)*.5+vec3(.05,.1,.2)*fbm(p*6.+3.)*.4; return c;}
    void main(){vec2 p=(vUv-.5)*${ASPECT}*1.6; p+=vec2(sin(uT*.1),cos(uT*.13))*.03; float r=length(p), rs=.18;
      vec2 q=p-normalize(p)*(rs*rs*1.6/max(r,.001)); vec3 col=stars(q*.6+vec2(uT*.01,0.))*smoothstep(rs,rs*1.6,r);
      float ring=exp(-pow((r-rs*1.08)/.012,2.))*1.2; col+=vec3(1.,.8,.55)*ring;
      vec2 dp=vec2(p.x,p.y/.22); float re=length(dp); float ang=atan(dp.y,dp.x);
      float band=smoothstep(rs*1.5,rs*1.9,re)*smoothstep(rs*4.2,rs*2.4,re); float stre=.6+.4*fbm(vec2(ang*3.-uT*1.6,re*14.)); float dop=1.+.7*p.x/max(re,.01)*sign(-1.);
      vec3 dc=mix(vec3(1.,.45,.15),vec3(1.,.9,.7),stre)*band*stre*(1.3-.6*p.x/(re+.01));
      float front=step(0.,-p.y)+step(rs*1.05,r)*step(0.,p.y); col+=dc*front*1.3;
      float arch=exp(-pow((r-rs*1.5)/.035,2.))*smoothstep(-.02,.08,p.y)*(.7+.3*fbm(vec2(atan(p.y,p.x)*4.-uT,1.))); col+=vec3(1.,.6,.3)*arch*.9;
      col*=smoothstep(rs*.98,rs*1.02,r); col=col/(1.+col*.4); o=vec4(col+(hash21(vUv*uRes+uT)-.5)*.03,1);}`);

  simple('aurora', 'Aurora', 'northern lights, light curtains, night sky', 'GLSL fragment shader (layered noise curtains)',
    'Twenty thin curtains are stacked in depth. Each one waves sideways with noise and fades with height, adding green, cyan and violet light. Stars twinkle above, a mountain line sits on the horizon, and a lake mirrors the sky with ripples.',
    'calm loops, travel, meditation and music backgrounds',
    'Aurora borealis over a mountain lake at night: layered green-to-violet light curtains drift and ripple, twinkling stars, mirror reflection with gentle ripples, 15 s seamless loop.',
    `vec3 sky(vec2 p){vec3 c=mix(vec3(.01,.02,.05),vec3(.02,.05,.1),p.y); vec2 sp=p*vec2(90.,60.); float h=hash21(floor(sp)); c+=step(.992,h)*(.5+.5*sin(uT*3.+h*40.))*smoothstep(.5,0.,length(fract(sp)-.5));
      for(int i=0;i<20;i++){float fi=float(i)/20.; float y=.42+fi*.32+.08*sin(p.x*2.+fi*6.+uT*.3); float x=p.x*(1.+fi)+fbm(vec2(p.x*1.5+fi*3.,uT*.15))*1.5; float curtain=pow(.5+.5*sin(x*6.+uT*.4+fi*9.),3.);
        float a=smoothstep(y-.3,y,p.y)*smoothstep(y+.05,y,p.y)*curtain; a*=.6+.4*vnoise(vec2(p.x*40.+fi*7.,uT*.5)); c+=mix(vec3(.15,1.,.55),vec3(.7,.3,1.),fi*fi)*a*.2;} return c;}
    void main(){vec2 p=vUv; p.x*=uRes.x/uRes.y; float hz=.32; vec3 col;
      float m=hz+.06+.07*fbm(vec2(p.x*2.,1.))-.04;
      if(vUv.y>hz){col=sky(vec2(p.x,vUv.y)); if(vUv.y<m) col=vec3(.01,.012,.02);}
      else {float ry=2.*hz-vUv.y+.004*sin(vUv.y*300.+uT*2.)*(hz-vUv.y)*8.; vec2 rp=vec2(p.x+.003*sin(vUv.y*120.+uT),ry); col=(ry<m?vec3(.01,.012,.02):sky(rp))*.55+vec3(0.,.01,.02);}
      o=vec4(col,1);}`);

  simple('fire', 'Fire', 'flames, procedural fire, campfire shader', 'GLSL fragment shader (scrolling noise + color ramp)',
    'Noise scrolls upward fast. It is cut by a teardrop-shaped mask that narrows toward the top, and the result is mapped through a black-red-orange-yellow-white color ramp. Embers are bright points that rise and fade.',
    'warm intros, cozy loops, "hot" product moments, game effects',
    'Procedural campfire shader: scrolling fBm flames inside a teardrop mask, black to red to orange to white color ramp, rising embers, heat shimmer above, 8 s seamless loop.',
    `uniform float uHeat; void main(){vec2 p=(vUv-vec2(.5,.08))*${ASPECT}; vec2 q=p*vec2(2.2,1.6); float n=fbm(q*vec2(3.,2.)-vec2(0.,uT*2.6))*.8+fbm(q*7.-vec2(0.,uT*4.))*.3;
      float shape=1.-length(vec2(p.x*(2.2+p.y*3.),p.y*.9-.25)); float f=clamp(shape*uHeat-n*1.1+.35,0.,1.); f*=step(-.02,p.y);
      vec3 col=vec3(1.5*f,1.5*f*f*f,f*f*f*f*f*f*1.2); col=clamp(col,0.,1.);
      for(int i=0;i<14;i++){float fi=float(i); float life=fract(uT*.35+fi*.137); vec2 ep=vec2((hash21(vec2(fi,1.))-.5)*.3+sin(uT*2.+fi)*.04*life,life*.75); col+=vec3(1.,.55,.2)*smoothstep(.008,0.,length(p-ep))*(1.-life)*2.;}
      col+=vec3(.08,.03,.02)*(1.-vUv.y); o=vec4(col,1);}`);

  simple('chrome', 'Liquid chrome blob', 'metallic blob, mirror material, 3D abstract', 'GLSL fragment shader (ray marching + environment reflection)',
    'A sphere whose surface is pushed in and out by moving sine waves. It reflects a made-up studio: a dark room with two bright softbox strips and a colored floor glow. Mirror materials are mostly about what they reflect.',
    'abstract brand visuals, premium tech intros, album art',
    'Liquid chrome blob rotating slowly, surface ripples like mercury, reflects a studio with two softbox strips and coral/violet floor glow, soft shadow, shallow depth of field.',
    `uniform float uRip; float map(vec3 p){float d=length(p)-1.; d+=uRip*sin(p.x*4.+uT*1.7)*sin(p.y*4.3-uT*1.3)*sin(p.z*3.7+uT); return d*.75;}
    vec3 env(vec3 r){vec3 c=mix(vec3(.08,.08,.11),vec3(.35,.36,.42),smoothstep(-.2,1.,r.y)); c+=vec3(.9)*smoothstep(.85,.95,abs(r.x))*smoothstep(-.2,.5,r.y)*.8; c+=vec3(1.)*smoothstep(.93,.97,abs(dot(r,normalize(vec3(.7,.5,-.2)))))*step(0.,r.y)*2.; c+=vec3(.9,.95,1.)*smoothstep(.96,.99,dot(r,normalize(vec3(-.8,.3,.4))))*1.5;
      c+=mix(vec3(1.,.35,.2),vec3(.48,.36,1.),r.x*.5+.5)*smoothstep(-.1,-.6,r.y)*.9; return c;}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; float a=uT*.3; vec3 ro=vec3(sin(a)*4.8,.5,cos(a)*4.8); vec3 ww=normalize(-ro),uu=normalize(cross(ww,vec3(0,1,0))),vv=cross(uu,ww); vec3 rd=normalize(uv.x*uu+uv.y*vv+1.5*ww);
      vec3 col=mix(vec3(.04,.04,.06),vec3(.09,.08,.12),vUv.y); float t=0.; for(int i=0;i<90;i++){float d=map(ro+rd*t); if(d<.001||t>10.) break; t+=d;}
      if(t<10.){vec3 p=ro+rd*t; vec2 e=vec2(.002,0); vec3 n=normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx))); vec3 r=reflect(rd,n);
        float fr=.6+.4*pow(1.-max(dot(n,-rd),0.),3.); col=env(r)*fr*vec3(.95,.96,1.);}
      else {vec2 fp=uv-vec2(0.,-.36); col+=-.05*smoothstep(.5,0.,length(fp*vec2(1.,4.)));}
      o=vec4(pow(col,vec3(.85)),1);}`);

  // LED board: a 2D canvas makes the content each frame, the shader turns it into glowing LEDs.
  EX.add({
    cat: 'gpu', id: 'ledboard', title: 'LED matrix board', aka: 'dot-matrix display, stadium screen, pixel sign', tool: 'Canvas 2D content + GLSL LED shader', runs: 'GPU',
    notice: 'A tiny 96x54 picture is drawn each frame (scrolling text and equalizer bars). The shader turns every pixel of it into a round LED with a glow, and draws unlit LEDs as dim dots. Two tools working together.',
    use: 'retro signage, scoreboards, ticker tapes, event screens',
    prompt: 'Dot-matrix LED sign: my message scrolls right to left in amber LEDs at 96x54 resolution, unlit LEDs faintly visible, bloom around lit ones, an equalizer row below reacts to the music.',
    setup(cv) {
      const ctx = cv.getContext('2d'); const LW = 96, LH = 54; const src = document.createElement('canvas'); src.width = LW; src.height = LH; const s = src.getContext('2d');
      const tex = gl.createTexture();
      const prog = G.prog(`uniform sampler2D uSrc; void main(){vec2 grid=vec2(${LW}.,${LH}.); vec2 cell=floor(vUv*grid); vec2 f=fract(vUv*grid)-.5; vec3 c=texture(uSrc,(cell+.5)/grid).rgb;
        float d=length(f); float led=smoothstep(.42,.3,d); float glow=exp(-d*d*8.)*.6; vec3 off=vec3(.07,.05,.04);
        vec3 col=off*led+c*(led*1.2+glow); vec3 halo=texture(uSrc,vUv+vec2(.006,0)).rgb+texture(uSrc,vUv-vec2(.006,0)).rgb+texture(uSrc,vUv+vec2(0,.01)).rgb+texture(uSrc,vUv-vec2(0,.01)).rgb; col+=halo*.06; o=vec4(col,1);}`);
      return t => {
        s.fillStyle = '#000'; s.fillRect(0, 0, LW, LH); s.font = '700 22px Consolas'; s.textBaseline = 'top'; s.fillStyle = '#ffb020';
        const msg = 'MOTION WITH CLAUDE  *  SHADERS  *  PARTICLES  *  '; const w = s.measureText(msg).width; const x = -((t * 30) % w);
        s.fillText(msg, x, 4); s.fillText(msg, x + w, 4);
        for (let i = 0; i < 24; i++) { const h = Math.floor(3 + 14 * Math.abs(Math.sin(t * 4 + i * 0.7) * Math.sin(t * 1.3 + i * 0.3))); s.fillStyle = i % 2 ? '#ff5a36' : '#2bc4e6'; s.fillRect(i * 4, LH - h, 3, h); }
        gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        G.draw(prog, null, { uSrc: tex }, 640, 360); G.copy(ctx, 640, 360);
      };
    },
  });

  simple('hologram', 'Hologram', 'holographic UI, sci-fi projection, scanline glow', 'GLSL fragment shader (ray marching + Fresnel rim)',
    'A ray-marched shape is drawn only by its edges (a Fresnel rim), so it looks made of light. Moving scanlines, flicker, a sideways glitch jolt and a projector cone from below finish the sci-fi look.',
    'sci-fi UI, product "x-ray" reveals, tech and gaming intros',
    'Holographic projection of a rotating torus knot: cyan Fresnel rim light only, horizontal scanlines scrolling up, random flicker and glitch offsets, projector cone and grid base below.',
    `float sdTorus(vec3 p,vec2 t){vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y;}
    float map(vec3 p){float a=uT*.6; p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz; p.xy=mat2(cos(.5),-sin(.5),sin(.5),cos(.5))*p.xy; float d=sdTorus(p,vec2(.8,.22)); d=min(d,length(p)-.35+.05*sin(p.y*20.+uT*4.)); return d;}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; float gl2=step(.97,hash21(vec2(floor(uT*10.),1.))); uv.x+=gl2*(hash21(vec2(floor(vUv.y*20.),floor(uT*10.)))-.5)*.08;
      vec3 ro=vec3(0,.3,3.2), rd=normalize(vec3(uv.x,uv.y-.08,-1.6)); vec3 col=vec3(.01,.02,.04);
      float t=0.; for(int i=0;i<80;i++){float d=map(ro+rd*t); if(d<.001||t>8.) break; t+=d;}
      if(t<8.){vec3 p=ro+rd*t; vec2 e=vec2(.002,0); vec3 n=normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));
        float fr=pow(1.-abs(dot(n,rd)),2.5); float scan=.6+.4*sin(p.y*90.-uT*6.); col+=vec3(.2,.85,1.)*(fr*1.6+.08)*scan;}
      float cone=smoothstep(.55,0.,abs(uv.x)/(.15+(-.55-uv.y)*-.0+.4*(uv.y+.55)))*smoothstep(-.55,.4,uv.y)*.12; col+=vec3(.2,.8,1.)*cone*step(uv.y,.2);
      vec2 gp=vec2(uv.x/(-uv.y+.05),1./(-uv.y+.05)); if(uv.y<-.3){vec2 gg=abs(fract(gp*vec2(2.,1.)+vec2(0.,uT*.3))-.5); col+=vec3(.1,.5,.7)*smoothstep(.46,.5,max(gg.x,gg.y))*smoothstep(-.3,-.5,uv.y)*.6;}
      col*=.9+.1*sin(vUv.y*uRes.y*2.)+.05*sin(uT*37.); o=vec4(col,1);}`);
})();

// Tweak sliders for these shader demos (values arrive as uniforms, see G.simple).
EX.tweak('ocean', [{ key: 'amp', label: 'Wave height', min: 0.1, max: 1.2, step: 0.05, value: 0.55 }], 'Ray-marched open ocean at golden hour: layered directional waves (height {amp}), Fresnel sky reflection, sun glitter path, foam on crests, slow forward camera drift, 10 s.');
EX.tweak('chrome', [{ key: 'rip', label: 'Surface ripple', min: 0, max: 0.3, step: 0.01, value: 0.09 }], 'Liquid chrome blob rotating slowly, surface ripple {rip} like mercury, reflects a studio with two softbox strips and coral/violet floor glow, soft shadow.');
EX.tweak('fire', [{ key: 'heat', label: 'Flame size', min: 0.8, max: 2.5, step: 0.05, value: 1.6 }], 'Procedural campfire shader: scrolling fBm flames inside a teardrop mask (flame size {heat}), black to red to orange to white color ramp, rising embers, 8 s seamless loop.');
