// Ray-marched 3D worlds for Motion Examples.html (shared WebGL2 context EX.G).
(function () {
  const G = EX.G; if (!G.gl) return; const gl = G.gl;
  const ASPECT = 'vec2(uRes.x/uRes.y,1.)';

  // Shared tileable 3D value-noise texture (64^3 voxels, period 16 noise cells), built on first use.
  // Shaders declare uniform highp sampler3D uNoise and read noise at p as texture(uNoise,p/16.).r
  // (or snap to voxels with a smoothstep first, as n3() below does, to hide the linear facets).
  let noiseTex = null;
  const noise3D = () => {
    if (noiseTex) return noiseTex;
    const N = 64, C = 16, r = EX.rng(5), lat = new Float32Array(C * C * C), d = new Float32Array(N * N * N), lerp = EX.lerp;
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    const f = t => t * t * t * (t * (t * 6 - 15) + 10), at = (x, y, z) => lat[((z & 15) * C + (y & 15)) * C + (x & 15)];
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const gx = x * C / N, gy = y * C / N, gz = z * C / N, ix = Math.floor(gx), iy = Math.floor(gy), iz = Math.floor(gz), u = f(gx - ix), v = f(gy - iy), w = f(gz - iz);
      d[(z * N + y) * N + x] = lerp(lerp(lerp(at(ix, iy, iz), at(ix + 1, iy, iz), u), lerp(at(ix, iy + 1, iz), at(ix + 1, iy + 1, iz), u), v),
        lerp(lerp(at(ix, iy, iz + 1), at(ix + 1, iy, iz + 1), u), lerp(at(ix, iy + 1, iz + 1), at(ix + 1, iy + 1, iz + 1), u), v), w);
    }
    noiseTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, noiseTex);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16F, N, N, N, 0, gl.RED, gl.FLOAT, d);
    for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, k, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_3D, null);
    return noiseTex;
  };

  // Setup for a full-screen shader card drawn at L.p.scale of 640x360 and scaled up to the stage.
  // Tweak values arrive as uniforms (L.p.power as uPower). With useNoise the 3D noise sits on unit 7.
  // tick(u, t, dt, L), when given, adds per-frame uniforms such as a distance integrated from a speed slider.
  const scaled = (body, useNoise, tick) => (stage, L) => {
    const ctx = stage.getContext('2d'); const prog = G.prog(body); ctx.imageSmoothingQuality = 'high';
    const u = { uT: 0 }, tex = useNoise ? noise3D() : null, names = {};
    for (const k in L.p) names[k] = 'u' + k[0].toUpperCase() + k.slice(1);
    if (tex) { gl.useProgram(prog.p); gl.uniform1i(prog.u.uNoise, 7); }
    return (t, dt) => {
      const s = L.p.scale || 1, w = Math.round(640 * s), h = Math.round(360 * s);
      u.uT = t; for (const k in names) u[names[k]] = L.p[k];
      if (tick) tick(u, t, dt, L);
      if (tex) { gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_3D, tex); gl.activeTexture(gl.TEXTURE0); }
      G.draw(prog, null, u, w, h);
      if (tex) { gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_3D, null); gl.activeTexture(gl.TEXTURE0); }
      ctx.drawImage(G.canvas, 0, G.canvas.height - h, w, h, 0, 0, 640, 360);
    };
  };
  const card = (d, body, useNoise, tick) => EX.add(Object.assign({ cat: 'gpu', runs: 'GPU', setup: scaled(body, useNoise, tick) }, d));
  const SCALE = { key: 'scale', label: 'Render scale', min: 0.4, max: 1, step: 0.05, value: 1, unit: 'x' };

  // ---------------- Mandelbulb ----------------
  card({
    id: 'g2-mandelbulb', title: 'Mandelbulb fractal', aka: '3D fractal, distance estimator, orbit trap, Mandelbulb', tool: 'GLSL fragment shader (ray marching a distance estimator)',
    notice: 'Every point in space is pushed through z = z^n + c in spherical coordinates, and a distance estimate tells the ray how far it can safely jump. Color comes from an orbit trap: how close each point\'s orbit passed to the axes. Soft shadows, ambient occlusion and a slowly breathing power make it feel like a living object.',
    use: 'album art, science and math intros, hypnotic loops, "infinite detail" metaphors',
    prompt: 'Ray-marched Mandelbulb 3D fractal, power {power} breathing by {breathe}, orbit-trap coloring in coral, amber and violet on deep navy, warm key light with soft shadows, cool fill, ambient occlusion, slow orbiting camera, 20 s seamless loop.',
    params: [{ key: 'power', label: 'Power', min: 3, max: 12, step: 0.1, value: 8 }, { key: 'breathe', label: 'Breathing', min: 0, max: 3, step: 0.05, value: 1.2 }, SCALE],
  }, `uniform float uPower,uBreathe; float P; vec4 trap;
    float map(vec3 p){vec3 w=p; float m=dot(w,w); vec4 tr=vec4(abs(w),m); float dz=1.;
      for(int i=0;i<5;i++){float r=sqrt(m); dz=P*pow(r,P-1.)*dz+1.; float th=P*acos(clamp(w.y/r,-1.,1.)),ph=P*atan(w.x,w.z);
        w=p+pow(r,P)*vec3(sin(th)*sin(ph),cos(th),sin(th)*cos(ph)); tr=min(tr,vec4(abs(w),m)); m=dot(w,w); if(m>256.) break;}
      trap=vec4(m,tr.yzw); return .25*log(m)*sqrt(m)/dz;}
    vec2 isph(vec3 ro,vec3 rd,float r){float b=dot(ro,rd),c=dot(ro,ro)-r*r,h=b*b-c; if(h<0.) return vec2(-1.); h=sqrt(h); return vec2(-b-h,-b+h);}
    float shadow(vec3 ro,vec3 rd){float res=1.,t=.01; for(int i=0;i<28;i++){float h=map(ro+rd*t); res=min(res,10.*h/t); t+=clamp(h,.008,.2); if(res<.01||t>2.) break;} return clamp(res,0.,1.);}
    void main(){float w=6.2831853/20.; P=uPower+uBreathe*sin(uT*w*2.);
      vec2 uv=(vUv-.5)*${ASPECT}; float a=uT*w+.6, el=.35+.25*sin(uT*w);
      vec3 ro=(4.1-.5*cos(uT*w*2.))*vec3(cos(el)*sin(a),sin(el),cos(el)*cos(a)); vec3 ww=normalize(-ro),uu=normalize(cross(ww,vec3(0,1,0))),vv=cross(uu,ww);
      vec3 rd=normalize(uv.x*uu+uv.y*vv+1.4*ww); float px=1.6/uRes.y/1.4;
      vec3 bg=mix(vec3(.012,.012,.03),vec3(.07,.04,.12),smoothstep(.9,-.3,length(uv-vec2(.25,.3)))); bg+=vec3(1.,.36,.21)*.05*exp(-4.*length(uv+vec2(.5,.4)))+vec3(.5,.35,.9)*.04*pow(clamp(1.-length(uv)*1.4,0.,1.),2.);
      vec3 col=bg; vec2 bs=isph(ro,rd,1.25);
      if(bs.y>0.){float t=max(bs.x,.01); bool hit=false; vec4 tr;
        for(int i=0;i<150;i++){float h=map(ro+rd*t); if(h<.4*px*t){hit=true;break;} t+=h; if(t>bs.y) break;}
        if(hit){tr=trap; vec3 p=ro+rd*t; vec2 e=vec2(1,-1)*.5*px*t;
          vec3 n=normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));
          vec3 base=vec3(.06,.05,.14); base=mix(base,vec3(.9,.22,.12),clamp(tr.y*1.2,0.,1.)); base=mix(base,vec3(.32,.2,.85),clamp(tr.z*tr.z*1.5,0.,1.)); base=mix(base,vec3(1.,.62,.1),clamp(pow(tr.w,6.)*.45,0.,1.)); base*=.42;
          float occ=clamp(.05*log(tr.x),0.,1.); occ=occ*occ;
          vec3 L1=normalize(.65*uu+.7*vv-.45*ww); float dif=max(dot(n,L1),0.); float sh=dif>.001?shadow(p+n*.002,L1):0.;
          vec3 hv=normalize(L1-rd); float spe=pow(max(dot(n,hv),0.),24.)*dif*sh*(.04+.96*pow(1.-max(dot(hv,L1),0.),5.));
          float sky=.5+.5*n.y, back=max(dot(n,normalize(-.6*uu-.1*vv+.6*ww)),0.), fre=pow(clamp(1.+dot(n,rd),0.,1.),3.);
          col=base*(vec3(1.4,1.05,.8)*1.9*dif*sh+vec3(.25,.35,.6)*.8*sky*occ+vec3(.5,.25,.6)*.5*back*occ+vec3(1.,.5,.4)*fre*occ*.6)+vec3(1.,.9,.8)*spe*3.;
          col=mix(col,bg,1.-exp(-.02*t*t));}}
      col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14); col=pow(clamp(col,0.,1.),vec3(.4545));
      col*=1.-.35*dot(uv,uv); col+=(hash21(vUv*uRes+fract(uT)*91.)-.5)*.012; o=vec4(col,1);}`);

  // ---------------- Planet ----------------
  card({
    id: 'g2-planet', title: 'Living planet', aka: 'procedural planet, atmospheric scattering, Earth from space, Rayleigh and Mie', tool: 'GLSL fragment shader (ray-sphere hits + single-scattering atmosphere)',
    notice: 'Continents, ice caps and a separate cloud layer all come from 3D noise sampled on the sphere, so nothing is painted. The blue rim and orange sunset band are computed: light is traced through a thin atmosphere where small molecules scatter blue (Rayleigh) and haze scatters forward (Mie). On the night side, city lights switch on along the coasts.',
    use: 'space and science intros, global or climate stories, sci-fi title cards',
    prompt: 'A procedural Earth-like planet turning slowly in space (spin {spin}): noise continents with deserts, forests and ice caps, sea level {sea}, a drifting cloud layer with shadows, ocean sun glint, Rayleigh and Mie atmospheric scattering at density {atmo} with a blue rim and orange terminator, amber city lights on the night side, starfield, 20 s.',
    params: [{ key: 'spin', label: 'Spin speed', min: 0, max: 4, step: 0.1, value: 1, unit: 'x' }, { key: 'sea', label: 'Sea level', min: 0.38, max: 0.6, step: 0.005, value: 0.5, dec: 3 }, { key: 'atmo', label: 'Atmosphere density', min: 0, max: 3, step: 0.05, value: 1 }, SCALE],
  }, `uniform highp sampler3D uNoise; uniform float uSpin,uSea,uAtmo;
    float n3(vec3 p){vec3 x=p*4.+.5,i=floor(x),f=fract(x); f=f*f*(3.-2.*f); return texture(uNoise,(i+f-.5)/64.).r;}
    float fbm3(vec3 p){float s=0.,a=.5; for(int i=0;i<5;i++){s+=a*n3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5;} return s*1.03;}
    vec2 isph(vec3 ro,vec3 rd,float r){float b=dot(ro,rd),c=dot(ro,ro)-r*r,h=b*b-c; if(h<0.) return vec2(-1.); h=sqrt(h); return vec2(-b-h,-b+h);}
    const float RA=1.06,HR=.012,HM=.004; const vec3 BR=vec3(2.6,6.,14.6); const float BM=4.;
    vec2 lightOD(vec3 p,vec3 sd){float tl=isph(p,sd,RA).y, dt=tl/4., r=0., m=0.; for(int j=0;j<4;j++){float h=length(p+sd*dt*(float(j)+.5))-1.; if(h<0.) return vec2(1e3); r+=exp(-h/HR); m+=exp(-h/HM);} return vec2(r,m)*dt;}
    vec3 atmo(vec3 ro,vec3 rd,float tmax,vec3 sd,out vec3 tr){tr=vec3(1); vec2 a=isph(ro,rd,RA); if(a.y<0.) return vec3(0);
      float t0=max(a.x,0.),t1=min(a.y,tmax),dt=(t1-t0)/12.; vec3 sR=vec3(0),sM=vec3(0); float oR=0.,oM=0.; vec3 br=BR*uAtmo; float bm=BM*uAtmo;
      for(int i=0;i<12;i++){vec3 p=ro+rd*(t0+dt*(float(i)+.5)); float h=length(p)-1.,hr=exp(-h/HR)*dt,hm=exp(-h/HM)*dt; oR+=hr; oM+=hm;
        vec2 l=lightOD(p,sd); vec3 at=exp(-(br*(oR+l.x)+bm*1.1*(oM+l.y))); sR+=at*hr; sM+=at*hm;}
      float mu=dot(rd,sd),g=.76; float pR=.0597*(1.+mu*mu), pM=.1194*((1.-g*g)*(1.+mu*mu))/((2.+g*g)*pow(1.+g*g-2.*g*mu,1.5));
      tr=exp(-(br*oR+bm*1.1*oM)); return 7.*(sR*br*pR+sM*bm*pM);}
    mat3 rot(float a,vec3 ax){ax=normalize(ax); float c=cos(a),s=sin(a); return mat3(c)+(1.-c)*outerProduct(ax,ax)+mat3(0.,ax.z,-ax.y,-ax.z,0.,ax.x,ax.y,-ax.x,0.)*s;}
    float height(vec3 q){vec3 w=q*1.6+.55*(vec3(n3(q*1.3+4.),n3(q*1.3+19.),n3(q*1.3+33.))-.5)*2.; return fbm3(w*1.4+2.)*.75+fbm3(w*4.2)*.25;}
    float clouds(vec3 q){vec3 w=q*2.3+vec3(n3(q*2.+40.),n3(q*2.+51.),0.)*1.4; float c=(fbm3(w*2.4+vec3(0.,uT*.03,0.))-.5)*2.4+.5; float band=.8+.25*cos(q.y*7.); return smoothstep(.5,.78,c*band);}
    vec3 stars(vec3 rd){vec2 sp=vec2(atan(rd.z,rd.x),asin(rd.y))*120.; vec2 id=floor(sp); float h=hash21(id); vec3 c=vec3(0);
      if(h>.992) c=mix(vec3(.7,.8,1.),vec3(1.,.85,.7),hash21(id+3.))*smoothstep(.45,0.,length(fract(sp)-hash22(id)*.6-.2))*(h-.992)*120.;
      c+=vec3(.1,.05,.16)*pow(fbm(sp/120.*2.5+7.),3.)*.35; return c;}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; vec3 ro=vec3(-.2+.15*sin(uT*.07),.35,4.1), ta=vec3(-.42,.08,0.);
      vec3 ww=normalize(ta-ro),uu=normalize(cross(ww,vec3(0,1,0))),vv=cross(uu,ww); vec3 rd=normalize(uv.x*uu+uv.y*vv+1.5*ww);
      vec3 sd=normalize(vec3(-1.,.25,.12)); vec3 col=stars(rd)+vec3(1.,.8,.6)*pow(max(dot(rd,sd),0.),12.)*.15; float tmax=1e3;
      vec2 hp=isph(ro,rd,1.);
      if(hp.x>0.){tmax=hp.x; vec3 p=ro+rd*hp.x, n=normalize(p); mat3 R=rot(uT*.08*uSpin+1.2,vec3(.4,1.,0.)); vec3 q=n*R, qs=sd*R;
        float h=height(q), land=smoothstep(uSea,uSea+.004,h), e=h-uSea; float dif0=max(dot(n,sd),0.), dif;
        vec2 lo=lightOD(p+n*.002,sd); vec3 sun=exp(-(BR*uAtmo*lo.x+BM*uAtmo*1.1*lo.y))*2.2;
        float lat=abs(q.y), moist=(fbm3(q*3.+20.)-.5)*2.5+.5-.3*smoothstep(.45,.15,abs(lat-.28))+.2*smoothstep(.5,.7,lat);
        vec3 ground=mix(vec3(.42,.3,.16),vec3(.17,.18,.07),smoothstep(.22,.4,moist)); ground=mix(ground,vec3(.03,.085,.025),smoothstep(.4,.58,moist));
        ground=mix(ground,vec3(.24,.2,.17),smoothstep(.06,.13,e)); ground=mix(vec3(.4,.36,.25),ground,smoothstep(.0,.004,e));
        vec3 tx=normalize(cross(q,abs(q.y)<.7?vec3(0,1,0):vec3(1,0,0))), ty=cross(q,tx); float hx=height(q+tx*.012)-h, hy=height(q+ty*.012)-h;
        vec3 bn=normalize(q-(tx*hx+ty*hy)/.012*.3*land); dif=max(dot(R*bn,sd),0.);
        vec3 ocean=mix(vec3(.004,.02,.07),vec3(.01,.09,.16),smoothstep(-.08,0.,e));
        float ice=smoothstep(.8,.88,lat+e*.6+(moist-.5)*.15);
        vec3 alb=mix(ocean,ground,land); alb=mix(alb,vec3(.85,.9,.95),ice);
        float cl=clouds(q), csh=1.-.65*clouds(q+qs*.018);
        vec3 surf=alb*sun*dif*csh; vec3 hv=normalize(sd-rd);
        surf+=(1.-land)*(1.-ice)*sun*pow(max(dot(n,hv),0.),70.)*(.05+.95*pow(1.-max(dot(n,-rd),0.),5.))*3.*csh;
        surf=mix(surf,vec3(1.)*sun*(dif0*.95+.03),cl*.92);
        float night=smoothstep(.06,-.12,dot(n,sd)); float coast=1.-smoothstep(.0,.09,e);
        float cz=smoothstep(.5,.72,n3(q*8.+60.)), city=cz*(smoothstep(.7,.86,n3(q*64.))+.35*smoothstep(.62,.8,n3(q*27.+9.)))*land*coast*(1.-ice)*(1.-cl*.85)*night;
        surf+=vec3(1.,.62,.26)*city*1.1; col=surf;}
      vec3 tr; vec3 sc=atmo(ro,rd,tmax,sd,tr); col=col*tr+sc;
      col=1.-exp(-col*1.4); col=pow(col,vec3(.4545)); col*=1.-.25*dot(uv,uv); o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.01,1);}`, true);

  // ---------------- Volumetric clouds ----------------
  card({
    id: 'g2-clouds', title: 'Golden-hour cloud flight', aka: 'volumetric clouds, ray-marched clouds, sky flythrough, silver lining', tool: 'GLSL fragment shader (volume ray marching + light marching)',
    notice: 'The clouds are a 3D density field made of layered noise. Each ray takes up to 90 steps through it, and at every step a second short march toward the sun measures how much light gets through, which gives the dark bellies and bright tops. A forward-scattering phase function makes the edges glow when you look toward the low sun: the silver lining.',
    use: 'travel and aviation intros, dreamy title backgrounds, "above the clouds" moments, weather stories',
    prompt: 'Volumetric cloud flythrough at golden hour: ray-marched noise clouds, cloud cover {cover}, light marched toward a low sun at {sun} for dark bellies and glowing tops, silver lining from forward scattering, violet shadows, warm haze on the horizon, camera skims the cloud tops at speed {speed} with a gentle bank, 15 s.',
    params: [{ key: 'cover', label: 'Cloud cover', min: 0, max: 1, step: 0.02, value: 0.5 }, { key: 'sun', label: 'Sun height', min: 1, max: 30, step: 0.5, value: 7, unit: ' deg' }, { key: 'speed', label: 'Flight speed', min: 0, max: 3, step: 0.05, value: 1 }, Object.assign({}, SCALE, { value: 0.6 })],
  }, `uniform highp sampler3D uNoise; uniform float uCover,uSun,uDist; vec3 sd;
    float n3(vec3 p){vec3 x=p*4.+.5,i=floor(x),f=fract(x); f=f*f*(3.-2.*f); return texture(uNoise,(i+f-.5)/64.).r;}
    float den(vec3 p,int oc){float h=(p.y-1.)/3.4; if(h<0.||h>1.) return 0.; vec3 q=p*.24+vec3(uT*.015,0.,0.);
      float cov=n3(vec3(p.xz*.045,7.3)); float s=0.,a=.5; for(int i=0;i<5;i++){if(i>=oc) break; s+=a*n3(q); q=q*2.1+vec3(.31,1.7,.9); a*=.47;}
      float th=.3+.5*h-.5*(cov-.5)-(uCover-.5)*.35; return clamp((s-th)*7.,0.,1.)*smoothstep(0.,.1,h);}
    float lightOD(vec3 p){float od=0.,dt=.3; for(int j=0;j<5;j++){p+=sd*dt; od+=den(p,3)*dt; dt*=1.6;} return od;}
    vec3 sky(vec3 rd){float y=max(rd.y,0.); vec3 c=mix(vec3(.8,.3,.1),vec3(.03,.05,.2),pow(y,.25)); c=mix(c,vec3(.75,.3,.28),.35*exp(-abs(rd.y)*12.));
      float s=max(dot(rd,sd),0.); c+=vec3(1.,.45,.15)*pow(s,14.)*.3+vec3(1.,.7,.4)*pow(s,120.)*1.2; c+=vec3(1.,.95,.85)*smoothstep(.99986,.99993,s)*10.;
      if(rd.y<0.) c=mix(c,vec3(.1,.08,.17),1.-exp(rd.y*8.)); return c;}
    float hg(float c,float g){return (1.-g*g)/(4.*PI*pow(1.+g*g-2.*g*c,1.5));}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; float se=radians(uSun); sd=normalize(vec3(.32*cos(se),sin(se),cos(se)));
      float z=uDist*2.6; vec3 ro=vec3(sin(z*.05)*6.,4.75+.35*sin(uT*.21),z); float bank=.1*cos(z*.05);
      vec3 fw=normalize(vec3(.25*cos(z*.05),-.12,1.)), rt=normalize(cross(vec3(sin(bank),cos(bank),0.),fw)), up=cross(fw,rt); vec3 rd=normalize(uv.x*rt+uv.y*up+1.45*fw);
      vec3 bg=sky(rd); float ca=dot(rd,sd), ph=mix(hg(ca,.6),hg(ca,-.25),.3);
      float tA=(4.4-ro.y)/rd.y, tB=(1.-ro.y)/rd.y; float t0=max(min(tA,tB),0.), t1=min(max(tA,tB),110.); if(rd.y>=0.&&ro.y>4.4) t1=-1.;
      vec3 acc=vec3(0); float T=1.; float t=t0+fract(52.98*fract(dot(gl_FragCoord.xy,vec2(.0671,.00584))))*.18;
      for(int i=0;i<90;i++){if(t>t1||T<.02) break; float dt=.15+t*.018; vec3 p=ro+rd*t; float d=den(p,4);
        if(d>.002){float od=lightOD(p); float h=clamp((p.y-1.)/3.4,0.,1.); float se2=d*6.;
          vec3 sun=vec3(1.,.5,.2)*8.*(exp(-od*3.)+.25*exp(-od*.8))*ph*(1.-exp(-d*4.));
          vec3 amb=mix(vec3(.05,.04,.12),vec3(.25,.27,.48),h*h)*.75; vec3 S=(sun+amb)*se2; float tr=exp(-se2*dt);
          S=mix(S,bg*se2,1.-exp(-t*.011)); acc+=T*(S-S*tr)/se2; T*=tr;}
        t+=dt;}
      vec3 col=bg*T+acc; col+=vec3(1.,.55,.25)*pow(max(ca,0.),40.)*.15;
      col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14); col=clamp(col,0.,1.); col=mix(col,col*col*(3.-2.*col),.5); col=pow(col,vec3(.4545)); col*=1.-.3*dot(uv,uv);
      o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.012,1);}`, true, (u, t, dt, L) => { u.uDist = (u.uDist || 0) + dt * L.p.speed; });

  // ---------------- Gemstone ----------------
  // Round brilliant cut as 73 half-spaces (normal, offset): a point is inside when dot(n,p) <= offset for all of them.
  const gemPlanes = (() => {
    const out = [[0, 1, 0, 0.325]];
    const ring = (n, a0, ang, r, y, up) => {
      const s = Math.sin(ang * Math.PI / 180), c = Math.cos(ang * Math.PI / 180);
      for (let k = 0; k < n; k++) { const az = (a0 + k * 360 / n) * Math.PI / 180; const ny = up ? c : -c; out.push([s * Math.cos(az), ny, s * Math.sin(az), s * r + ny * y]); }
    };
    ring(8, 0, 34.5, 1, 0.03, true); ring(8, 22.5, 21, 0.57, 0.325, true); ring(16, 11.25, 42, 1, 0.03, true);
    ring(16, 0, 90, 1, 0, true); ring(8, 0, 40.75, 1, -0.03, false); ring(16, 11.25, 42.5, 1, -0.03, false);
    return out.map(p => `vec4(${p.map(v => v.toFixed(5)).join(',')})`).join(',');
  })();
  let gemHdr = null;
  EX.add({
    cat: 'gpu', id: 'g2-gem', title: 'Diamond with fire', aka: 'gemstone shader, refraction, chromatic dispersion, brilliant cut', tool: 'GLSL fragment shaders (analytic polyhedron tracing + glare pass)', runs: 'GPU',
    notice: 'The stone is 73 flat facets, and each ray is traced exactly: it refracts in, bounces off the inner facets (total internal reflection keeps most light inside), and refracts out. Red, green and blue are traced separately with slightly different refractive indices, so white studio lights split into rainbow flashes: the fire. A second pass adds star glints to the brightest pixels.',
    use: 'jewelry and luxury product shots, premium brand reveals, "brilliance" metaphors',
    prompt: 'A round brilliant-cut diamond turning at {spin} in a dark studio: exact facet refraction with total internal reflection, chromatic dispersion {disp} (red, green and blue traced with separate indices of refraction) for rainbow fire, softbox and point lights in amber, coral and cyan, four-point star glints at {glare} strength, 10 s.',
    params: [{ key: 'disp', label: 'Dispersion', min: 0, max: 4, step: 0.1, value: 1.6, unit: 'x' }, { key: 'spin', label: 'Turn speed', min: 0, max: 2, step: 0.05, value: 0.5, unit: ' rad/s' }, { key: 'glare', label: 'Star glints', min: 0, max: 2, step: 0.05, value: 1 }],
    setup(stage, L) {
      const ctx = stage.getContext('2d'), W = 640, H = 360, hdr = gemHdr || (gemHdr = G.target(W, H, true));
      const gem = G.prog(`uniform float uDisp,uAng; const vec4 PL[73]=vec4[](${gemPlanes}); mat3 M;
        vec3 env(vec3 d){vec3 c=vec3(.006,.006,.01)+vec3(.03,.026,.04)*smoothstep(-.4,.9,d.y);
          c+=vec3(1.,.96,.9)*2.2*smoothstep(.86,.9,d.y)*(.7+.3*cos(d.x*9.));
          c+=vec3(1.,.62,.2)*5.*smoothstep(.08,.03,abs(d.z+.15))*smoothstep(.2,.4,-d.x)*smoothstep(-.5,0.,d.y);
          c+=vec3(.3,.85,1.)*4.*smoothstep(.07,.02,abs(d.x-.75))*smoothstep(-.6,0.,d.y)*step(0.,d.z);
          c+=vec3(1.,.38,.24)*3.*smoothstep(.9,.97,dot(d,normalize(vec3(.2,.1,-1.))));
          for(int k=0;k<7;k++){float fk=float(k); vec3 ld=normalize(vec3(sin(fk*2.4),.5+.45*cos(fk*1.7),cos(fk*2.4))); c+=mix(vec3(1.,.9,.75),vec3(.75,.85,1.),fract(fk*.37))*30.*pow(max(dot(d,ld),0.),900.);}
          return c;}
        bool enter(vec3 ro,vec3 rd,out float tn,out vec3 nn){float t0=-1e9,t1=1e9; nn=vec3(0,1,0);
          for(int i=0;i<73;i++){vec4 pl=PL[i]; float dn=dot(pl.xyz,rd),ds=pl.w-dot(pl.xyz,ro); if(abs(dn)<1e-7){if(ds<0.) return false; continue;}
            float t=ds/dn; if(dn<0.){if(t>t0){t0=t;nn=pl.xyz;}} else t1=min(t1,t);}
          tn=t0; return t0<t1&&t0>0.;}
        float leave(vec3 p,vec3 d,out vec3 nn){float tm=1e9; nn=vec3(0,1,0); for(int i=0;i<73;i++){vec4 pl=PL[i]; float dn=dot(pl.xyz,d); if(dn>1e-6){float t=(pl.w-dot(pl.xyz,p))/dn; if(t<tm){tm=t;nn=pl.xyz;}}} return max(tm,0.);}
        float fres(float c,float f0){return f0+(1.-f0)*pow(1.-clamp(c,0.,1.),5.);}
        float chan(vec3 p,vec3 rd,vec3 n,float ior,int ch){float f0=pow((ior-1.)/(ior+1.),2.); vec3 d=refract(rd,n,1./ior); float thr=1.-fres(dot(-rd,n),f0),acc=0.;
          for(int b=0;b<7;b++){vec3 m; float t=leave(p,d,m); p+=d*t; vec3 od=refract(d,-m,ior);
            if(dot(od,od)<.5){d=reflect(d,-m); continue;}
            float F=fres(dot(od,m),f0); acc+=thr*(1.-F)*env(M*od)[ch]; thr*=F; d=reflect(d,-m);}
          return acc+thr*env(M*d)[ch]*.5;}
        void main(){vec2 uv=(vUv-.5)*${ASPECT}; vec3 ro=vec3(0.,.85,3.7), ww=normalize(vec3(0.,-.2,0.)-ro), uu=normalize(cross(ww,vec3(0,1,0))), vv=cross(uu,ww); vec3 rd=normalize(uv.x*uu+uv.y*vv+1.85*ww);
          float a=uAng, tl=.12+.07*sin(uT*.4); mat3 Ry=mat3(cos(a),0.,sin(a),0.,1.,0.,-sin(a),0.,cos(a)), Rx=mat3(1.,0.,0.,0.,cos(tl),sin(tl),0.,-sin(tl),cos(tl)); M=Rx*Ry;
          vec3 bg=vec3(.012,.011,.02)+vec3(.09,.06,.12)*exp(-3.*length(uv-vec2(0.,.05)))+vec3(.12,.05,.03)*exp(-6.*length(uv-vec2(-.6,-.45)));
          vec3 col=bg; vec3 gro=ro*M, grd=rd*M; float tn; vec3 n;
          if(enter(gro,grd,tn,n)){vec3 p=gro+grd*tn; vec3 r=reflect(grd,n); float F=fres(dot(-grd,n),.17); vec3 ior=2.42+uDisp*vec3(-.022,0.,.022);
            col=env(M*r)*F+vec3(chan(p,grd,n,ior.r,0),chan(p,grd,n,ior.g,1),chan(p,grd,n,ior.b,2));}
          o=vec4(col,1);}`);
      const post = G.prog(`uniform sampler2D uS; uniform float uGlare;
        vec3 hi(vec2 uv){vec3 c=texture(uS,uv).rgb; return max(c-1.2,0.);}
        void main(){vec3 c=texture(uS,vUv).rgb; vec2 px=1./uRes; vec3 g=vec3(0);
          for(int k=0;k<4;k++){float a=.35+float(k)*1.5708; vec2 dir=vec2(cos(a),sin(a))*px; for(int i=1;i<18;i++){float fi=float(i); g+=hi(vUv+dir*fi*2.)*exp(-fi*.22);}}
          vec3 b=vec3(0); for(int i=0;i<12;i++){float a=float(i)*2.39996; vec2 off=vec2(cos(a),sin(a))*sqrt(float(i)+.5)*3.5*px; b+=hi(vUv+off);}
          c+=g*.09*uGlare+b*.03*uGlare; c=c*(2.51*c+.03)/(c*(2.43*c+.59)+.14); c=pow(clamp(c,0.,1.),vec3(.4545));
          vec2 q=vUv-.5; c*=1.-.5*dot(q,q); o=vec4(c+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.01,1);}`);
      let ang = 0;
      return (t, dt) => {
        ang += dt * L.p.spin;
        G.draw(gem, hdr, { uT: t, uDisp: L.p.disp, uAng: ang });
        G.draw(post, null, { uS: hdr, uGlare: L.p.glare, uT: t }, W, H); G.copy(ctx, W, H);
      };
    },
  });

  // ---------------- Mountain flyover ----------------
  card({
    id: 'g2-terrain', title: 'Mountain flyover at sunset', aka: 'procedural terrain, height-field ray marching, eroded fBm, landscape shader', tool: 'GLSL fragment shader (height-field ray marching + soft shadows)',
    notice: 'The mountains are one formula: layers of noise where each layer is damped on steep slopes, which carves ridges and valleys that read like erosion. Rays step toward that height field, a second march toward the low sun casts long soft shadows, and snow settles only where the slope is gentle enough to hold it. Distance fog turns warm toward the sun and blue away from it.',
    use: 'travel, outdoor and adventure intros, calm establishing shots, game title screens',
    prompt: 'Ray-marched procedural mountain flyover at sunset: eroded fBm terrain, snow above {snow} that only sticks to gentle slopes, low sun at {sun} with long soft shadows, warm aerial fog toward the sun and blue haze away from it, valley mist, camera glides low over the ridges at speed {speed}, 15 s.',
    params: [{ key: 'snow', label: 'Snow line', min: 0.5, max: 4, step: 0.05, value: 2.7 }, { key: 'sun', label: 'Sun height', min: 2, max: 40, step: 0.5, value: 13, unit: ' deg' }, { key: 'speed', label: 'Flight speed', min: 0, max: 3, step: 0.05, value: 1 }, Object.assign({}, SCALE, { value: 0.75 })],
  }, `uniform float uDist,uSnow,uSun; vec3 sd;
    vec3 noised(vec2 x){vec2 p=floor(x),f=fract(x),u=f*f*f*(f*(f*6.-15.)+10.),du=30.*f*f*(f*(f-2.)+1.);
      float a=hash21(p),b=hash21(p+vec2(1,0)),c=hash21(p+vec2(0,1)),d=hash21(p+vec2(1,1));
      return vec3(a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y,du*(vec2(b-a,c-a)+(a-b-c+d)*u.yx));}
    float terr(vec2 p,int oc){p*=.22; float a=0.,b=1.; vec2 d=vec2(0); for(int i=0;i<11;i++){if(i>=oc) break; vec3 n=noised(p); d+=n.yz; a+=b*n.x/(1.+dot(d,d)); b*=.5; p=mat2(1.6,-1.2,1.2,1.6)*p;} return a*2.4-.5;}
    vec3 sky(vec3 rd){float s=max(dot(rd,sd),0.); vec3 c=mix(vec3(.9,.42,.18),vec3(.05,.1,.3),pow(max(rd.y,0.),.4));
      c+=vec3(1.,.5,.2)*pow(s,10.)*.5+vec3(1.,.75,.45)*pow(s,150.)*1.5+vec3(1.,.95,.85)*smoothstep(.99985,.99993,s)*10.; return c;}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; float se=radians(uSun); sd=normalize(vec3(.8*cos(se),sin(se),.6*cos(se)));
      float z=uDist*1.6; vec2 cx=vec2(4.*sin(z*.09),z), fx=vec2(4.*sin((z+2.5)*.09),z+2.5);
      float gy=max(.5*(terr(cx,4)+terr(fx,4))+1.5,max(terr(cx,4),terr(fx,4))+.8); vec3 ro=vec3(cx.x,gy,cx.y);
      vec3 fw=normalize(vec3(fx.x-cx.x,-.3,2.5)), rt=normalize(cross(vec3(-.08*cos(z*.09),1.,0.),fw)), up=cross(fw,rt); vec3 rd=normalize(uv.x*rt+uv.y*up+1.5*fw);
      vec3 bg=sky(rd), col=bg; float t=.05; bool hit=false;
      for(int i=0;i<220;i++){vec3 p=ro+rd*t; float h=p.y-terr(p.xz,7); if(abs(h)<.0012*t){hit=true;break;} if(t>70.||(p.y>4.&&rd.y>0.)) break; t+=.38*h;}
      if(!hit&&t<70.&&ro.y+rd.y*t<4.) hit=true;
      if(hit){vec3 p=ro+rd*t; float e=.0015*t; vec3 n=normalize(vec3(terr(p.xz-vec2(e,0),10)-terr(p.xz+vec2(e,0),10),2.*e,terr(p.xz-vec2(0,e),10)-terr(p.xz+vec2(0,e),10)));
        float sh=1.,ts=.04; for(int i=0;i<40;i++){vec3 q=p+sd*ts; float hh=q.y-terr(q.xz,5); sh=min(sh,12.*hh/ts); ts+=clamp(hh,.04,.5); if(sh<0.||q.y>4.) break;} sh=clamp(sh,0.,1.);
        float nz=vnoise(p.xz*7.), nz2=vnoise(p.xz*1.3);
        vec3 alb=mix(vec3(.13,.1,.08),vec3(.24,.2,.16),nz); alb=mix(alb,vec3(.07,.09,.04),smoothstep(.75,.9,n.y)*smoothstep(1.,.3,p.y));
        float snow=smoothstep(.62,.8,n.y+(p.y-uSnow)*.5+(nz2-.5)*.4); alb=mix(alb,vec3(.82,.86,.95),snow);
        float dif=max(dot(n,sd),0.)*sh, amb=.5+.5*n.y, bac=max(dot(n,normalize(vec3(-sd.x,0.,-sd.z))),0.)*clamp(1.-p.y*.2,0.,1.);
        col=alb*(dif*vec3(1.,.58,.32)*4.4+amb*vec3(.22,.3,.55)*.5+bac*vec3(.4,.24,.18)*.3);
        col+=snow*vec3(1.,.8,.6)*pow(max(dot(reflect(rd,n),sd),0.),24.)*sh*.6;
        float fo=1.-exp(-pow(t*.026,1.5)); vec3 fc=mix(vec3(.3,.36,.55),vec3(1.,.52,.25),pow(max(dot(rd,sd),0.),5.)); col=mix(col,fc,fo);
        col=mix(col,fc*1.1,(1.-exp(-t*.15))*exp(-max(p.y+.2,0.)*2.5)*.4);}
      col+=vec3(1.,.55,.25)*pow(max(dot(rd,sd),0.),6.)*.12;
      col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14); col=pow(clamp(col,0.,1.),vec3(.4545)); col*=1.-.3*dot(uv,uv);
      o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.012,1);}`, false, (u, t, dt, L) => { u.uDist = (u.uDist || 0) + dt * L.p.speed; });

  // ---------------- Rain on glass ----------------
  card({
    id: 'g2-rain', title: 'Rain on a night window', aka: 'raindrops on glass, droplet refraction, bokeh city, condensation', tool: 'GLSL fragment shader (procedural droplets + lens refraction)',
    notice: 'The city behind the glass is drawn as out-of-focus bokeh discs. Every drop on the window is a tiny lens: inside it the shader samples the city again, flipped and in sharper focus, so each drop holds a small upside-down picture of the lights. Running drops slide down in stop-and-go hops, and their trails wipe the fogged glass clear.',
    use: 'moody openers, music videos, noir and city stories, cozy "stay in" brand moments',
    prompt: 'Rain on a window at night, 12 s: city lights behind the glass as soft bokeh in amber, coral, cyan and violet (blur {blur}), drops slide down in stop-and-go hops and leave clear trails through foggy condensation ({fog} fog), static droplets fade in and out, rain amount {rain}, each drop refracts a sharp upside-down view of the lights, small specular glints, slow traffic lights drifting at the bottom.',
    params: [{ key: 'rain', label: 'Rain amount', min: 0.1, max: 1, step: 0.01, value: 0.75 }, { key: 'fog', label: 'Condensation', min: 0, max: 1, step: 0.02, value: 0.6 }, { key: 'blur', label: 'Background blur', min: 0.2, max: 1, step: 0.02, value: 0.8 }],
  }, `uniform float uRain,uFog,uBlur;
    vec3 city(vec2 uv,float b){vec3 col=mix(vec3(.025,.02,.04),vec3(.008,.01,.03),smoothstep(.1,.95,uv.y))+vec3(.1,.05,.025)*smoothstep(.5,.0,uv.y)*.5;
      for(int l=0;l<4;l++){float fl=float(l), sc=3.+fl*2.4; vec2 q=uv*sc+vec2(fl*7.3,fl*3.1); if(l==3){q=uv*vec2(9.,22.)+vec2(uT*1.2,0.);}
        vec2 id=floor(q), f=fract(q);
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y), cid=id+o; vec2 h=hash22(cid+fl*17.); float h2=hash21(cid+fl*5.3);
          float wy=l==3?(cid.y+h.y)/22.:(cid.y+h.y-fl*3.1)/sc; float pres=l==3?step(.5,h2)*step(wy,.17)*step(.1,wy):step(.28,h2)*smoothstep(.9,.25,wy);
          if(pres<.01) continue;
          float rr=(.1+.22*hash21(cid+fl*2.1))*mix(.16,1.,b), soft=mix(.02,.3,b)*rr+.004; float d=length(f-o-h);
          float disc=smoothstep(rr,rr-soft,d), rim=smoothstep(rr-soft*2.,rr,d)*disc;
          float k=fract(h2*7.13); vec3 lc=k<.3?vec3(1.,.62,.22):k<.5?vec3(1.,.36,.22):k<.68?vec3(.3,.78,1.):k<.82?vec3(.55,.42,1.):vec3(1.,.88,.72);
          if(l==3) lc=fract(h2*3.7)<.5?vec3(1.,.2,.12):vec3(1.,.85,.6);
          float tw=.8+.2*sin(uT*(.7+h.x*2.)+h.y*20.); col+=lc*disc*(1.+rim*.7)*pres*tw*.5*pow(mix(.16,1.,b),-.6);}}
      return col;}
    float xp(float y,float id,float hc){return (id+.5)*.115+.025*sin(y*11.+hc*30.)*(.6+.4*sin(y*3.1+hc*9.));}
    void main(){vec2 uv=vUv*${ASPECT}; vec2 off=vec2(0); float m=0.,wipe=0.,rr=1.,dd=0.; vec2 dl=vec2(0);
      for(int l=0;l<2;l++){float sc=l==0?13.:25.; vec2 q=uv*sc+float(l)*3.7; vec2 id=floor(q), f=fract(q)-.5; vec2 h=hash22(id+float(l)*9.); float hz=hash21(id*1.7+3.);
        float life=fract(uT*.06*(1.+hz)+hz); float r=(.1+.2*hz)*smoothstep(0.,.08,life)*smoothstep(1.,.7,life)*step(hash21(id+77.),uRain*.6+.05);
        vec2 dv=f-(h-.5)*.55; float d=length(dv); float c=smoothstep(r,r*.75,d);
        if(c>m){m=c; off=-dv*5./sc; rr=r; dd=d; dl=dv;}}
      float cid=floor(uv.x/.115);
      for(int k=-1;k<=1;k++){float id=cid+float(k), hc=hash21(vec2(id,5.)); if(hc>uRain) continue;
        float s=uT*(.45+.35*hc)+hc*10., prog=(floor(s)+smoothstep(0.,.35,fract(s)))*.085, y=1.25-mod(prog+hc*1.7,1.75);
        vec2 dv=vec2(uv.x-xp(y,id,hc),uv.y-y)/.115; float r=.24+.08*hc; dv.x*=1.+.35*clamp(dv.y/r,-1.,1.); float d=length(dv*vec2(1.,.9)); float c=smoothstep(r,r*.8,d);
        if(c>m){m=c; off=-dv*.115*4.5; rr=r; dd=d; dl=dv;}
        float tx=abs(uv.x-xp(uv.y,id,hc))/.115, above=uv.y-y; float len=.55*smoothstep(0.,1.,hc+.3);
        wipe=max(wipe,smoothstep(.12,.06,tx)*step(0.,above)*smoothstep(len,len*.2,above));
        float kk=uv.y/.035, fy=fract(kk)-.5, pr=step(.45,hash21(vec2(id,floor(kk)))); vec2 tv=vec2((uv.x-xp(floor(kk)*.035+.0175,id,hc))/.115,fy*.035/.115);
        float tr=.05*pr*smoothstep(len*1.4,0.,above)*step(.03,above); float tc=smoothstep(tr,tr*.6,length(tv));
        if(tc>m){m=tc; off=-tv*.115*4.; rr=tr; dd=length(tv); dl=tv;}}
      vec3 clear=city(uv,uBlur), fogged=city(uv,1.)*.7+vec3(.022,.026,.036);
      vec3 col=mix(clear,fogged,uFog*(1.-wipe));
      if(m>0.){vec3 dc=city(uv+off,.5)*1.5+.02; float edge=smoothstep(rr*.6,rr,dd); dc*=1.-.6*edge;
        dc+=vec3(1.,.95,.9)*smoothstep(.28*rr,0.,length(dl-vec2(-.3,.4)*rr))*.7+vec3(1.,.8,.6)*smoothstep(.3*rr,0.,length((dl-vec2(.12,-.6)*rr)*vec2(.8,1.6)))*.08; col=mix(col,dc,m);}
      vec2 q=vUv-.5; col*=1.-.45*dot(q,q); col=col/(1.+col*.25); col=pow(col,vec3(.4545));
      o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.014,1);}`);

  // ---------------- Neon city ----------------
  card({
    id: 'g2-city', title: 'Neon city flythrough', aka: 'cyberpunk city, procedural skyscrapers, wet street reflections, night city', tool: 'GLSL fragment shader (ray marching repeated boxes + reflection bounce)',
    notice: 'One box formula is repeated on a grid, and a hash of each cell picks the tower height, so the city never ends. Windows are a grid painted on the faces and switched on at random; neon tubes on the corners add their glow while the ray passes them. Where a ray hits the wet street it bounces once and marches again, which mirrors the whole skyline in the puddles.',
    use: 'cyberpunk and tech intros, music videos, night-life brands, game title screens',
    prompt: 'Ray-marched neon city flythrough at night: endless procedural skyscrapers on a grid (tower height from a hash per block), lit windows in warm and cool tones ({lights} lit), coral, cyan and violet neon tubes with glow, flying traffic lights in lanes, wet street that mirrors the skyline, violet fog, camera glides down the avenue at speed {speed}, 15 s.',
    params: [{ key: 'lights', label: 'Windows lit', min: 0.05, max: 0.9, step: 0.01, value: 0.42 }, { key: 'speed', label: 'Flight speed', min: 0, max: 3, step: 0.05, value: 1 }, Object.assign({}, SCALE, { value: 0.8 })],
  }, `uniform float uLights,uDist; float glow; vec3 gcol;
    float sdBox(vec3 p,vec3 b){vec3 d=abs(p)-b; return length(max(d,0.))+min(max(d.x,max(d.y,d.z)),0.);}
    float hgt(vec2 id){float h=hash21(id+.5); return .9+h*h*6.+step(.93,h)*4.;}
    float map(vec3 p,bool g){vec2 id=floor(p.xz*.5); vec2 q=p.xz-id*2.-1.; float h=hgt(id);
      float d=sdBox(vec3(q.x,p.y-h*.5,q.y),vec3(.62,h*.5,.62)); if(hash21(id+3.1)>.5) d=min(d,sdBox(vec3(q.x,p.y-h-.15,q.y),vec3(.4,.15,.4)));
      vec2 rb=1.-abs(q); d=min(d,max(min(rb.x,rb.y),0.)+.04); d=min(d,p.y);
      if(g){float hn=hash21(id+7.7); if(hn>.3){vec2 cq=abs(q)-.64; float y0=h*(.2+.3*hash21(id+1.3)),y1=min(h*.9,y0+1.4); float nd=length(vec3(cq.x,max(abs(p.y-(y0+y1)*.5)-(y1-y0)*.5,0.),cq.y))-.012;
        float k=fract(hn*13.); vec3 nc=k<.33?vec3(1.,.3,.2):k<.66?vec3(.2,.8,1.):vec3(.6,.35,1.); float fl=.85+.15*step(.1,fract(uT*1.3+hn*7.));
        glow+=.0009/(nd*nd+.0012)*fl; gcol+=nc*.0009/(nd*nd+.0012)*fl; d=min(d,max(nd,.004));}}
      return d;}
    vec3 nrm(vec3 p){vec2 e=vec2(.002,0); return normalize(vec3(map(p+e.xyy,false)-map(p-e.xyy,false),map(p+e.yxy,false)-map(p-e.yxy,false),map(p+e.yyx,false)-map(p-e.yyx,false)));}
    vec3 sky(vec3 rd){return mix(vec3(.25,.08,.16),vec3(.015,.012,.04),smoothstep(-.02,.35,rd.y))+vec3(.5,.15,.2)*exp(-abs(rd.y)*18.)*.3;}
    vec3 shade(vec3 p,vec3 n,vec3 rd,float t){vec2 id=floor(p.xz*.5); vec3 col=vec3(.022,.02,.032)*(.6+.4*n.y);
      if(abs(n.y)<.5&&p.y>.05){float u=abs(n.x)>.5?p.z:p.x; vec2 w=vec2(u*11.,p.y*8.5); vec2 wi=floor(w), wf=fract(w);
        float win=step(.12,wf.x)*step(wf.x,.88)*step(.16,wf.y)*step(wf.y,.84); float r=hash21(wi+id*31.+n.xz*7.);
        float bt=hash21(id+9.9), lit=step(r,uLights)*win; vec3 wc=mix(vec3(1.,.56,.26),vec3(.5,.72,1.),step(bt,fract(r*17.)))*(.5+.9*fract(r*31.));
        col+=wc*lit*(.9+.1*sin(uT*3.+r*40.))*2.2; col+=(vec3(.006,.008,.016)-col*.5)*win*(1.-lit); col+=vec3(.5,.14,.2)*exp(-p.y*.9)*.12;}
      return col;}
    vec3 cars(vec3 ro,vec3 rd,float tmax){vec3 c=vec3(0); for(int i=0;i<10;i++){float fi=float(i); float dir=mod(fi,2.)*2.-1.;
        vec3 cp=vec3(dir*.45+(hash21(vec2(fi,1.))-.5)*.2,1.7+floor(hash21(vec2(fi,2.))*3.)*.9,0.); cp.z=ro.z-4.+mod(hash21(vec2(fi,3.))*40.+uT*dir*2.6,40.);
        vec3 v=cp-ro; float tc=dot(v,rd); if(tc<0.||tc>tmax) continue; float d=length(v-rd*tc); vec3 lc=dir>0.?vec3(1.,.2,.15):vec3(1.,.9,.7);
        c+=lc*(exp(-d*d*2500.)*2.5+.006/(d*d*50.+.02))*exp(-tc*.03);} return c;}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; float z=uDist*3.; vec3 ro=vec3(.1*sin(uT*.3),3.2+.6*sin(uT*.17),z);
      float yaw=.1*sin(uT*.13), pitch=-.17+.06*sin(uT*.21); vec3 fw=normalize(vec3(sin(yaw),pitch,cos(yaw))), rt=normalize(cross(vec3(.03*sin(uT*.3),1.,0.),fw)), up=cross(fw,rt);
      vec3 rd=normalize(uv.x*rt+uv.y*up+1.2*fw); glow=0.; gcol=vec3(0);
      float t=.05; bool hit=false; for(int i=0;i<140;i++){float d=map(ro+rd*t,true); if(d<.001*t){hit=true;break;} t+=d; if(t>70.) break;}
      vec3 fogc=vec3(.05,.03,.09); vec3 col=sky(rd);
      if(hit){vec3 p=ro+rd*t, n=nrm(p); col=shade(p,n,rd,t);
        if(n.y>.5&&p.y<.02){float pud=smoothstep(.35,.6,vnoise(p.xz*1.3)); vec3 rn=normalize(n+vec3(vnoise(p.xz*30.+uT*2.)-.5,0.,vnoise(p.xz*30.-uT*2.+5.)-.5)*.04*(1.-pud));
          vec3 rr=reflect(rd,rn); float t2=.02; bool h2=false; for(int i=0;i<70;i++){float d=map(p+rr*t2,false); if(d<.002*t2){h2=true;break;} t2+=d; if(t2>45.) break;}
          vec3 rc=h2?shade(p+rr*t2,nrm(p+rr*t2),rr,t2):sky(rr); rc=mix(rc,fogc,1.-exp(-t2*.05)); rc+=cars(p,rr,h2?t2:60.);
          float fr=.25+.6*pow(1.-max(dot(-rd,n),0.),3.); col=mix(col,rc,fr*mix(.45,.95,pud));}
        col=mix(col,fogc,1.-exp(-t*.045));}
      col+=gcol*.11*exp(-t*.01); col+=cars(ro,rd,hit?t:80.);
      col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14); col=pow(clamp(col,0.,1.),vec3(.4545)); col*=1.-.35*dot(uv,uv);
      o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.014,1);}`, false, (u, t, dt, L) => { u.uDist = (u.uDist || 0) + dt * L.p.speed; });

  // ---------------- Soap bubbles ----------------
  card({
    id: 'g2-bubbles', title: 'Soap bubbles, thin-film color', aka: 'iridescence, thin-film interference, bubble shader, oil-slick colors', tool: 'GLSL fragment shader (ray-sphere hits + spectral thin-film interference)',
    notice: 'A soap film is only a few hundred nanometers thick, so light reflected from its front and back surfaces interferes: some wavelengths cancel and others add up. The shader computes that for eight wavelengths at every pixel from the local film thickness, which drains downward and swirls, and turns the spectrum into color. Where the film gets thinnest, near the top, it turns dark just before it would pop.',
    use: 'dreamy product and beauty visuals, kids and play themes, iridescent brand accents',
    prompt: 'Soap bubbles drifting up through a dark studio, 15 s: spectral thin-film interference (film about {thick}, thinner at the top where it turns dark, swirling at speed {swirl}), each bubble reflects a window and a warm floor glow on its front and, mirrored, on its inner back, soft bokeh background in teal and violet.',
    params: [{ key: 'thick', label: 'Film thickness', min: 150, max: 1200, step: 10, value: 520, unit: ' nm' }, { key: 'swirl', label: 'Swirl speed', min: 0, max: 3, step: 0.05, value: 1 }],
  }, `uniform float uThick,uSwirl;
    vec3 env(vec3 d){vec3 c=mix(vec3(.05,.035,.03),vec3(.03,.05,.08),smoothstep(-.4,.5,d.y)); c+=vec3(1.,.55,.25)*smoothstep(-.1,-.7,d.y)*.5;
      if(d.z>.25){vec2 w=d.xy/d.z; vec2 q=w-vec2(-.5,.55); float win=step(abs(q.x),.6)*step(abs(q.y),.2)*step(.02,abs(abs(q.x)-.2)); c+=vec3(1.,.97,.92)*win*2.6;}
      c+=vec3(.3,.8,1.)*smoothstep(.85,.97,dot(d,normalize(vec3(.8,.3,-.6))))*1.6; c+=vec3(.6,.4,1.)*smoothstep(.9,.99,dot(d,normalize(vec3(-.7,-.1,-.7))))*1.; return c;}
    vec3 bg(vec2 uv){vec3 c=mix(vec3(.006,.02,.025),vec3(.035,.012,.05),vUv.x*.7+vUv.y*.3);
      for(int i=0;i<9;i++){float fi=float(i); vec2 p=vec2(hash21(vec2(fi,1.))*2.-1.,hash21(vec2(fi,2.))*1.2-.6)*vec2(1.,1.)+vec2(sin(uT*.05+fi)*.05,0.); float r=.08+.12*hash21(vec2(fi,3.));
        c+=mix(vec3(.2,.6,.6),vec3(.55,.3,.8),hash21(vec2(fi,4.)))*.045*smoothstep(r,r*.85,length(uv-p));} return c;}
    vec3 wl(float l){return vec3(exp(-pow((l-605.)/55.,2.))+.3*exp(-pow((l-440.)/25.,2.)),exp(-pow((l-545.)/50.,2.)),exp(-pow((l-455.)/38.,2.)));}
    vec3 film(float th,float ci){float ct=sqrt(1.-(1.-ci*ci)/1.77); vec3 s=vec3(0),w=vec3(0); for(int i=0;i<8;i++){float l=400.+float(i)*40.; vec3 k=wl(l); float r=sin(2.*PI*1.33*th*ct/l); s+=k*r*r; w+=k;} return s/w*2.;}
    float thick(vec3 n,float id){float sw=uT*.25*uSwirl+id*7.; vec2 a=vec2(n.x*cos(sw)-n.z*sin(sw),n.y); float f=fbm(a*1.8+vec2(id*3.,-uT*.08*uSwirl)+fbm(a*2.5+id)*1.2);
      return uThick*(.12+.95*smoothstep(1.,-.9,n.y))*(.65+.7*f);}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; vec3 ro=vec3(0.,0.,4.), rd=normalize(vec3(uv,-2.2)); vec3 col=bg(uv);
      for(int i=0;i<12;i++){float fi=float(i); float r=.2+.42*hash21(vec2(fi,9.)); float z=-2.2+fi*.33; float sp=.12+.08*hash21(vec2(fi,8.));
        vec3 c=vec3((fract(fi*.618+.2)-.5)*3.6-.35+.25*sin(uT*.4+fi*2.),mod(hash21(vec2(fi,6.))*3.8+uT*sp,3.8)-1.9,z); c.x+=.1*sin(uT*.9+fi);
        vec3 oc=ro-c; float b=dot(oc,rd), h=b*b-dot(oc,oc)+r*r; if(h<0.) continue; h=sqrt(h); float t0=-b-h,t1=-b+h; if(t0<0.) continue;
        vec3 nf=(ro+rd*t0-c)/r, nb=(ro+rd*t1-c)/r; float cf=max(dot(-rd,nf),0.), cb=max(dot(rd,nb),0.);
        float ff=.06+.94*pow(1.-cf,5.), fb=.06+.94*pow(1.-cb,5.);
        vec3 Rf=film(thick(nf,fi),cf)*mix(.35,1.,ff), Rb=film(thick(nb,fi),cb)*mix(.35,1.,fb)*.6;
        col=col*(1.-.25*(Rb+Rf)*.5)+env(reflect(rd,-nb))*Rb*.6+env(reflect(rd,nf))*Rf; col+=vec3(.9,.95,1.)*pow(1.-cf,6.)*.05;}
      col=col/(1.+col*.3); col=pow(col,vec3(.4545)); vec2 q=vUv-.5; col*=1.-.4*dot(q,q); o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.012,1);}`);

  // ---------------- Nebula ----------------
  card({
    id: 'g2-nebula', title: 'Emission nebula', aka: 'volumetric nebula, emission and absorption, space gas clouds, deep-space orbit', tool: 'GLSL fragment shader (volume ray marching, emission + absorption)',
    notice: 'The gas is a ball of 3D noise bent by more noise, so it breaks into wisps and lobes. Unlike the clouds card, no sun lights it: the gas glows by itself, so each ray only adds up light and lets dark dust lanes swallow what lies behind them. Three young stars light the gas near them, and the camera slowly circles the whole cloud.',
    use: 'space and science intros, album art, sci-fi title cards, calm ambient loops',
    prompt: 'Volumetric emission nebula, 20 s: domain-warped 3D noise gas that glows in coral, violet and cyan (glow {glow}), dark dust lanes with density {dust} that block the light behind them, three young blue-white stars inside that light up the gas around them with diffraction spikes, faint star field, camera slowly circles the cloud at speed {speed}.',
    params: [{ key: 'glow', label: 'Gas glow', min: 0.2, max: 3, step: 0.05, value: 1 }, { key: 'dust', label: 'Dust lanes', min: 0, max: 3, step: 0.05, value: 1.2 }, { key: 'speed', label: 'Drift speed', min: 0, max: 3, step: 0.05, value: 1 }, Object.assign({}, SCALE, { value: 0.75 })],
  }, `uniform highp sampler3D uNoise; uniform float uGlow,uDust,uDist;
    float n3(vec3 p){vec3 x=p*4.+.5,i=floor(x),f=fract(x); f=f*f*(3.-2.*f); return texture(uNoise,(i+f-.5)/64.).r;}
    float fbm3(vec3 p){float s=0.,a=.5; for(int i=0;i<5;i++){s+=a*n3(p); p=p*2.07+vec3(1.7,9.2,3.1); a*=.5;} return s;}
    const vec3 ST[3]=vec3[](vec3(.9,.5,.3),vec3(-1.4,-.3,-.6),vec3(.2,-1.1,1.));
    float dens(vec3 p,out float dust,out float hue){vec3 q=p*.7; q+=1.5*(vec3(n3(q*.6+1.3),n3(q*.6+7.1),n3(q*.6+3.7))-.5);
      float rg=1.-abs(2.*fbm3(q*1.4+5.)-1.); float f=fbm3(q)*.5+rg*rg*.6+.42-.3*length(p*vec3(.9,1.3,1.)); hue=n3(q*.8+20.);
      dust=smoothstep(.54,.7,fbm3(q*2.1+11.))*uDust*smoothstep(.2,.5,f); return smoothstep(.55,.9,f);}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; float a=uDist*.12+.5; vec3 ro=vec3(6.2*sin(a),.8*sin(uDist*.07),6.2*cos(a));
      vec3 ww=normalize(-ro), uu=normalize(cross(ww,vec3(.15*sin(uT*.05),1.,0.))), vv=cross(uu,ww); vec3 rd=normalize(uv.x*uu+uv.y*vv+1.6*ww);
      vec2 sp=vec2(atan(rd.x,rd.z),asin(rd.y))*150.; vec2 sid=floor(sp); float sh=hash21(sid); vec3 bgc=vec3(.004,.004,.012)+(sh>.985?vec3(.8,.85,1.)*smoothstep(.4,0.,length(fract(sp)-.5))*(sh-.985)*60.:vec3(0.));
      vec3 col=vec3(0); float T=1.; float b=dot(ro,rd), h=b*b-dot(ro,ro)+16.;
      if(h>0.){h=sqrt(h); float t0=max(-b-h,0.), t1=-b+h, dt=(t1-t0)/80., t=t0+dt*hash21(gl_FragCoord.xy+fract(uT)*17.);
        for(int i=0;i<80;i++){vec3 p=ro+rd*t; float du,hue; float d=dens(p,du,hue);
          if(d>.001||du>.001){vec3 ec=mix(vec3(1.,.2,.1),vec3(.42,.16,1.),smoothstep(.36,.48,hue)); ec=mix(ec,vec3(.05,.65,1.),smoothstep(.52,.64,hue));
            vec3 em=ec*d*d*.38*uGlow; for(int k=0;k<3;k++){vec3 sv=p-ST[k]; em+=vec3(.5,.75,1.)*d*.45/(1.+dot(sv,sv)*6.)*uGlow;}
            col+=T*em*dt; T*=exp(-(d*.6+du*4.)*dt);}
          if(T<.02) break; t+=dt;}}
      col+=T*bgc;
      for(int k=0;k<3;k++){vec3 sv=ST[k]-ro; vec3 w=normalize(sv); float ang=acos(min(dot(rd,w),1.)); vec2 lp=vec2(dot(rd,uu),dot(rd,vv))-vec2(dot(w,uu),dot(w,vv));
        col+=vec3(.8,.9,1.)*(exp(-ang*ang*60000.)*3.+(exp(-abs(lp.x)*700.)*exp(-abs(lp.y)*45.)+exp(-abs(lp.y)*700.)*exp(-abs(lp.x)*45.))*.8)*(.35+.65*T);}
      col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14); col=pow(clamp(col,0.,1.),vec3(.4545)); col*=1.-.3*dot(uv,uv);
      o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.012,1);}`, true, (u, t, dt, L) => { u.uDist = (u.uDist || 0) + dt * L.p.speed; });

  // ---------------- Gyroid cave ----------------
  card({
    id: 'g2-cave', title: 'Bioluminescent gyroid cave', aka: 'gyroid, triply periodic surface, cave flythrough, glowing veins', tool: 'GLSL fragment shader (ray marching a gyroid + carved tunnel)',
    notice: 'The rock is a gyroid: one short formula, dot(sin(p), cos(p.zxy)), that fills space with endless curving chambers. A tube along the camera path is subtracted from it so the flight never hits a wall. A second, finer gyroid draws the glowing veins where it crosses the rock, and pulses of light run along them.',
    use: 'sci-fi and fantasy openers, deep-sea or alien world moods, music videos, game menus',
    prompt: 'Ray-marched flight through an endless bioluminescent cave made from a gyroid surface, a tunnel carved along a winding camera path, wet dark rock with a headlamp light, cyan and violet glowing veins where a finer gyroid crosses the rock (vein glow {veins}), light pulses running along them, drifting glowing spores, teal fog, speed {speed}, 20 s.',
    params: [{ key: 'veins', label: 'Vein glow', min: 0, max: 3, step: 0.05, value: 1.2 }, { key: 'speed', label: 'Flight speed', min: 0, max: 3, step: 0.05, value: 1 }, SCALE],
  }, `uniform float uVeins,uDist;
    vec2 path(float z){return vec2(sin(z*.13)*2.2+sin(z*.31)*.6,cos(z*.1)*1.3);}
    float gyr(vec3 p){return dot(sin(p),cos(p.zxy));}
    float map(vec3 p){float d=(gyr(p*.9)+.35)/.9*.55; d=max(d,1.05+.22*gyr(p*1.6+2.)-length(p.xy-path(p.z))); d+=.06*gyr(p*3.1+1.)+.018*gyr(p*8.3); return d*.9;}
    vec3 nrm(vec3 p,float t){vec2 e=vec2(.002*t+.002,0); return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; float z=uDist*1.4; vec3 ro=vec3(path(z),z), ta=vec3(path(z+1.5),z+1.5);
      vec3 fw=normalize(ta-ro), rt=normalize(cross(vec3(.15*sin(z*.13),1.,0.),fw)), up=cross(fw,rt); vec3 rd=normalize(uv.x*rt+uv.y*up+1.25*fw);
      float t=.02; bool hit=false; for(int i=0;i<130;i++){float d=map(ro+rd*t); if(d<.0012*t){hit=true;break;} t+=d*.8; if(t>30.) break;}
      vec3 fogc=vec3(.004,.02,.03); vec3 col=fogc;
      if(hit){vec3 p=ro+rd*t, n=nrm(p,t); vec3 lp=ro+up*.25+rt*.2; vec3 ld=lp-p; float ll=length(ld); ld/=ll;
        float ao=0.,sc=1.; for(int k=1;k<5;k++){float h=.06*float(k); ao+=(h-map(p+n*h))*sc; sc*=.7;} ao=clamp(1.-ao*3.,0.,1.);
        float dif=max(dot(n,ld),0.)/(1.+ll*ll*.08); float spe=pow(max(dot(reflect(-ld,n),-rd),0.),60.)/(1.+ll*ll*.08)*2.;
        vec3 rock=mix(vec3(.03,.035,.045),vec3(.11,.085,.075),smoothstep(.2,.8,vnoise(p.xy*3.+p.z*2.)))*(.7+.3*gyr(p*5.)); col=rock*(dif*vec3(1.,.85,.7)*1.6+.03)*ao+spe*vec3(.6,.75,.8)*.6;
        float g2=gyr(p*2.6+vec3(0.,0.,1.7)); float vein=exp(-abs(g2)*14.); float pulse=.35+.65*pow(.5+.5*sin(p.z*1.4-uT*3.+gyr(p*.5)*2.),6.);
        vec3 vc=mix(vec3(.1,.9,1.),vec3(.6,.3,1.),.5+.5*sin(p.z*.21+p.x)); col+=vc*vein*pulse*uVeins*1.4*ao;
        col+=vc*.06*uVeins*exp(-abs(g2)*3.)*ao;}
      col=mix(col,fogc,1.-exp(-t*t*.006));
      for(int k=0;k<14;k++){float fk=float(k); float zz=floor(z/2.)*2.+fk*1.2; vec3 sp=vec3(path(zz)+vec2(sin(fk*3.1+uT*.4),cos(fk*2.3+uT*.3))*.6,zz+sin(uT*.2+fk)*.2);
        vec3 v=sp-ro; float tc=dot(v,rd); if(tc<.1||(hit&&tc>t)) continue; float dd=length(v-rd*tc); col+=mix(vec3(.2,.9,1.),vec3(.7,.4,1.),fract(fk*.37))*.0009/(dd*dd+.00005)*exp(-tc*.18)*uVeins*.3;}
      col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14); col=pow(clamp(col,0.,1.),vec3(.4545)); col*=1.-.35*dot(uv,uv);
      o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.014,1);}`, false, (u, t, dt, L) => { u.uDist = (u.uDist || 0) + dt * L.p.speed; });

  // ---------------- Underwater ----------------
  card({
    id: 'g2-underwater', title: 'Kelp forest with light shafts', aka: 'underwater scene, god rays, volumetric light, caustics, Snell window', tool: 'GLSL fragment shader (ray marching + volumetric light shafts)',
    notice: 'Sunlight enters through a wavy surface, so it arrives as moving bright webs (caustics) on the sand and as beams in the water. The beams come from marching along each view ray and asking, at every step, how much light the wavy surface sends down to that point. Water swallows red first, so color fades to blue-green with distance, and looking up you see the bright Snell window of the sky.',
    use: 'ocean and travel stories, calm ambient loops, nature documentaries, eco brands',
    prompt: 'Ray-marched underwater kelp forest, 15 s: swaying kelp stalks on rippled sand, moving caustic light webs on the floor, volumetric god rays (strength {rays}) shining down through the water, wavy Snell window of the sky overhead, water absorbs red first so distance fades to blue-green (clarity {clear}), drifting marine snow, slow forward glide.',
    params: [{ key: 'rays', label: 'Light shafts', min: 0, max: 3, step: 0.05, value: 1.2 }, { key: 'clear', label: 'Water clarity', min: 0.3, max: 2, step: 0.05, value: 1 }, SCALE],
  }, `uniform float uRays,uClear; const float SURF=7.; const vec3 LD=normalize(vec3(.25,1.,.35));
    float web(vec2 p,float t){vec2 ip=floor(p),fp=fract(p); float d1=8.,d2=8.; for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y); vec2 h=hash22(ip+g); vec2 r=g+.5+.4*sin(t+6.28*h)-fp; float d=dot(r,r); if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;} return sqrt(d2)-sqrt(d1);}
    float caus(vec2 p){vec2 w=vec2(vnoise(p*.5+uT*.2),vnoise(p*.5-uT*.17+4.))-.5; p+=w*.9; return pow(exp(-web(p*.9,uT*.8)*5.)+.6*exp(-web(p*1.6+3.,uT*1.1)*6.),1.6);}
    float floorH(vec2 p){return .5*vnoise(p*.12)+.08*sin(p.x*2.1+sin(p.y*.7)*1.5)*vnoise(p*.3+3.)+.25*vnoise(p*.4);}
    float kelp(vec3 p){vec2 id=floor(p.xz/2.6); float hk=hash21(id); if(hk<.3) return .8; vec2 c=(id+.5+(hash22(id+2.)-.5)*.5)*2.6; float ht=4.5+3.*hash21(id+5.);
      vec3 q=p; float sway=sin(uT*.7+hk*6.+p.y*.3)*(.07*p.y)+.04*p.y; q.xz-=c+vec2(sway,sway*.5); float d=9.;
      for(int k=0;k<2;k++){float a=p.y*(.5+.3*hk)+hk*6.+float(k)*1.9+.3*sin(uT*.5+p.y); vec2 r=mat2(cos(a),-sin(a),sin(a),cos(a))*q.xz;
        float w=(.07+.11*smoothstep(.5,2.5,p.y))*smoothstep(ht+float(k)*.6,ht-1.2,p.y)*(.75+.25*sin(p.y*2.3+hk*9.)); r.x-=w*.9;
        vec2 bd=abs(r)-vec2(w,.012); d=min(d,length(max(bd,0.))+min(max(bd.x,bd.y),0.));}
      d=min(d,length(q.xz)-.035); return max(d,p.y-ht-.6)*.6;}
    float map(vec3 p){return min(p.y-floorH(p.xz),kelp(p));}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; float z=uT*.6; vec3 ro=vec3(1.2*sin(uT*.07),2.2+.3*sin(uT*.13),z);
      vec3 fw=normalize(vec3(.1*sin(uT*.05),.12+.08*sin(uT*.09),1.)), rt=normalize(cross(vec3(0,1,0),fw)), up=cross(fw,rt); vec3 rd=normalize(uv.x*rt+uv.y*up+1.3*fw);
      vec3 ext=vec3(.45,.11,.07)/uClear; vec3 wcol=vec3(.02,.2,.26);
      float t=.05; bool hit=false; float tm=rd.y>0.?(SURF-ro.y)/rd.y:60.; tm=min(tm,60.);
      for(int i=0;i<110;i++){float d=map(ro+rd*t); if(d<.002*t){hit=true;break;} t+=d; if(t>tm) break;}
      t=min(t,tm); vec3 col;
      if(hit){vec3 p=ro+rd*t; vec2 e=vec2(.01,0); vec3 n=normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));
        bool isK=kelp(p)<p.y-floorH(p.xz); vec3 alb=isK?mix(vec3(.2,.17,.04),vec3(.45,.28,.05),vnoise(p.xy*3.+p.z)):vec3(.55,.48,.36)*(.8+.2*vnoise(p.xz*9.));
        vec2 cp=p.xz+LD.xz/LD.y*(SURF-p.y); float lgt=(.25+caus(cp*.7)*1.6)*max(dot(n,LD),0.)*exp(-(SURF-p.y)*.12);
        col=alb*(lgt*vec3(.9,1.,.95)+wcol*.6*(.5+.5*n.y))*exp(-ext*(SURF-p.y)*.5); if(isK) col+=vec3(.55,.5,.12)*(.15+.5*pow(max(dot(rd,LD),0.),2.))*exp(-(SURF-p.y)*.1)*(.5+caus(cp*.7));}
      else if(rd.y>0.){vec3 p=ro+rd*t; vec2 wv=vec2(vnoise(p.xz*.8+uT*.5),vnoise(p.xz*.8-uT*.4+7.))-.5; vec3 sn=normalize(vec3(wv.x*.3,1.,wv.y*.3));
        vec3 tr=refract(rd,-sn,1.33); col=dot(tr,tr)>.01?mix(vec3(.5,.8,.95),vec3(1.,.98,.9)*3.,pow(max(dot(tr,LD),0.),40.))*1.2:wcol*.5;}
      else col=wcol;
      vec3 fogc=wcol*(.6+.6*max(rd.y,0.)); col=col*exp(-ext*t)+fogc*(1.-exp(-ext*t));
      float sh=0.; float ns=44., ds=min(t,30.)/ns, ts=ds*hash21(gl_FragCoord.xy);
      for(int i=0;i<44;i++){vec3 p=ro+rd*ts; vec2 cp=p.xz+LD.xz/LD.y*(SURF-p.y); float c=smoothstep(.45,.9,vnoise(cp*.5+vec2(uT*.15,0.))*.6+vnoise(cp*1.1-vec2(0.,uT*.2))*.4); sh+=c*c*6.*exp(-ts*.09)*exp(-(SURF-p.y)*.06)*ds; ts+=ds;}
      col+=vec3(.7,.92,.85)*sh*.05*uRays*(.6+.4*pow(max(dot(rd,LD),0.),2.));
      for(int k=0;k<24;k++){float fk=float(k); vec3 sp=vec3(fract(hash21(vec2(fk,1.))+uT*.01)*8.-4.,fract(hash21(vec2(fk,2.))-uT*.015)*6.+.5,floor(z/6.)*6.+fract(hash21(vec2(fk,3.)))*12.);
        vec3 v=sp-ro; float tc=dot(v,rd); if(tc<.2||tc>t) continue; float dd=length(v-rd*tc); col+=vec3(.7,.9,.9)*.00012/(dd*dd+.00003)*exp(-tc*.25);}
      col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14); col=pow(clamp(col,0.,1.),vec3(.4545)); col*=1.-.4*dot(uv,uv);
      o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.014,1);}`);

  // ---------------- Newton's cradle ----------------
  card({
    id: 'g2-cradle', title: 'Ray-traced Newton\'s cradle', aka: 'analytic ray tracing, ray-capsule intersection, mirror inter-reflections, desk toy', tool: 'GLSL fragment shader (analytic ray tracing: spheres, capsules, box)',
    notice: 'No ray marching here: every ray is tested against exact formulas for 5 spheres, 16 capsules (strings and frame) and a box, which is fast and razor sharp. When a ray hits chrome it bounces and is traced again, up to four times, so the balls reflect each other in an endless chain. The swing is a plain sine wave split in two: the left ball takes the negative half and the right ball the positive half.',
    use: 'physics and cause-and-effect metaphors, premium product shots, loading loops, explainer intros',
    prompt: 'Ray-traced Newton\'s cradle on a black lacquer base in a dark studio, 8 s: five chrome balls on thin strings, the end balls swing out {amp} and click back (sine timing at speed {speed}), mirror balls reflect each other and a softbox above, coral and cyan rim strips, soft contact shadows, camera slowly orbits at desk height.',
    params: [{ key: 'amp', label: 'Swing angle', min: 5, max: 50, step: 1, value: 32, unit: ' deg' }, { key: 'speed', label: 'Swing speed', min: 0.25, max: 2, step: 0.05, value: 1, unit: 'x' }, SCALE],
  }, `uniform float uAmp,uSpeed; vec3 B[5]; const float R=.5, LEN=3.2, TOP=3.;
    float iSph(vec3 ro,vec3 rd,vec3 c){vec3 oc=ro-c; float b=dot(oc,rd), h=b*b-dot(oc,oc)+R*R; if(h<0.) return -1.; return -b-sqrt(h);}
    float iCap(vec3 ro,vec3 rd,vec3 pa,vec3 pb,float ra){vec3 ba=pb-pa, oa=ro-pa; float baba=dot(ba,ba), bard=dot(ba,rd), baoa=dot(ba,oa), rdoa=dot(rd,oa), oaoa=dot(oa,oa);
      float a=baba-bard*bard, b=baba*rdoa-baoa*bard, c=baba*oaoa-baoa*baoa-ra*ra*baba, h=b*b-a*c;
      if(h>=0.){float t=(-b-sqrt(h))/a, y=baoa+t*bard; if(y>0.&&y<baba) return t; vec3 oc=(y<=0.)?oa:ro-pb; b=dot(rd,oc); c=dot(oc,oc)-ra*ra; h=b*b-c; if(h>0.) return -b-sqrt(h);} return -1.;}
    vec3 nCap(vec3 p,vec3 a,vec3 b,float r){vec3 ba=b-a, pa=p-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return (pa-h*ba)/r;}
    float iBox(vec3 ro,vec3 rd,vec3 sz,out vec3 n){vec3 m=1./rd, k=abs(m)*sz, t1=-m*ro-k, t2=-m*ro+k; float tN=max(max(t1.x,t1.y),t1.z), tF=min(min(t2.x,t2.y),t2.z); if(tN>tF||tF<0.) return -1.; n=-sign(rd)*step(vec3(tN),t1); return tN;}
    void seg(int i,out vec3 a,out vec3 b,out float r){float fi=float(i);
      if(i<10){int k=i/2; float s=mod(fi,2.)*2.-1.; a=B[k]+vec3(0.,R*.9,0.); b=vec3((float(k)-2.)*1.02,TOP,s*.9); r=.011; return;}
      if(i<12){float s=fi*2.-21.; a=vec3(-2.9,TOP,s*.9); b=vec3(2.9,TOP,s*.9); r=.055; return;}
      float sx=i<14?-2.9:2.9, sz=mod(fi,2.)*1.8-.9; a=vec3(sx,TOP,sz); b=vec3(sx,-1.,sz); r=.06;}
    float trace(vec3 ro,vec3 rd,out vec3 n,out int m){float tb=1e9; m=0;
      for(int i=0;i<5;i++){float t=iSph(ro,rd,B[i]); if(t>1e-3&&t<tb){tb=t; n=(ro+rd*t-B[i])/R; m=1;}}
      for(int i=0;i<16;i++){vec3 a,b; float r; seg(i,a,b,r); float t=iCap(ro,rd,a,b,r); if(t>1e-3&&t<tb){tb=t; n=nCap(ro+rd*t,a,b,r); m=i<10?2:3;}}
      vec3 bn; float t=iBox(ro-vec3(0.,-1.15,0.),rd,vec3(3.4,.15,1.4),bn); if(t>1e-3&&t<tb){tb=t; n=bn; m=4;}
      return tb;}
    float strip(vec3 d,vec2 x){if(d.y<=0.) return 0.; vec2 q=vec2(d.x,d.z)/d.y*7.; return smoothstep(.06,0.,abs(q.x-x.x)-x.y)*smoothstep(-1.6,-1.,q.y)*smoothstep(4.5,3.8,q.y);}
    vec3 env(vec3 d){vec3 c=vec3(.008,.008,.012)+vec3(.12,.1,.14)*exp(-abs(d.y-.05)*6.)+vec3(.04,.035,.05)*smoothstep(-.2,.8,d.y);
      c+=vec3(.9,.92,1.)*1.6*strip(d.xzy,vec2(4.,.35));
      if(d.y>0.){vec2 q=d.xz/d.y; c+=vec3(1.,.97,.92)*3.2*smoothstep(.05,0.,max(abs(q.x)-.9,abs(q.y-.1)-.45));}
      c+=vec3(1.,.36,.21)*3.*strip(-d.zxy,vec2(3.,.3))+vec3(.17,.77,.9)*3.*strip(vec3(d.x,-d.z,d.y),vec2(-3.,.3)); return c;}
    float sph(vec3 ro,vec3 rd,vec3 c,float k){vec3 oc=ro-c; float b=dot(oc,rd), cc=dot(oc,oc)-R*R, h=b*b-cc; float d=sqrt(max(0.,R*R-h))-R, t=-b-sqrt(max(h,0.)); return (t<0.)?1.:smoothstep(0.,1.,2.5*k*d/t);}
    void main(){float th=radians(uAmp)*sin(uT*6.2831853/1.6*uSpeed);
      for(int i=0;i<5;i++){float a=i==0?min(th,0.):i==4?max(th,0.):0.; float x=(float(i)-2.)*1.02; B[i]=vec3(x+LEN*sin(a),TOP-LEN*cos(a),0.);}
      vec2 uv=(vUv-.5)*${ASPECT}; float ca=6.2831853*uT/40.+.5; vec3 ro=vec3(10.5*sin(ca),2.6+.3*sin(uT*.2),10.5*cos(ca)), ta=vec3(0.,.95,0.);
      vec3 ww=normalize(ta-ro), uu=normalize(cross(ww,vec3(0,1,0))), vv=cross(uu,ww); vec3 rd=normalize(uv.x*uu+uv.y*vv+1.85*ww);
      vec3 col=vec3(0), thr=vec3(1); vec3 LD=normalize(vec3(.05,1.,.1));
      for(int bnc=0;bnc<4;bnc++){vec3 n; int m; float t=trace(ro,rd,n,m); if(m==0){col+=thr*(bnc==0?vec3(.006,.006,.01)+vec3(.03,.026,.04)*exp(-abs(rd.y-.1)*4.):env(rd)); break;}
        vec3 p=ro+rd*t; float fre=pow(1.-max(dot(n,-rd),0.),5.);
        float shd=1.; if(m>=4){for(int i=0;i<5;i++) shd=min(shd,sph(p,LD,B[i],5.));}
        if(m==1){thr*=vec3(.92,.93,.96)*(.85+.15*fre);}
        else if(m==2){col+=thr*(vec3(.02)+vec3(.6)*pow(max(dot(n,LD),0.),2.)*.1); break;}
        else if(m==3){col+=thr*vec3(.02,.02,.025)*max(dot(n,LD),0.); thr*=vec3(.75,.72,.68)*(.6+.4*fre);}
        else {col+=thr*vec3(.006,.005,.005)*(.3+shd); thr*=(.05+.9*fre)*vec3(.9,.9,.95)*(.4+.6*shd);}
        ro=p+n*1e-3; rd=reflect(rd,n); if(max(thr.r,max(thr.g,thr.b))<.01) break;}
      col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14); col=pow(clamp(col,0.,1.),vec3(.4545)); col*=1.-.4*dot(uv,uv);
      o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.01,1);}`);

  // ---------------- Jellyfish ----------------
  card({
    id: 'g2-jelly', title: 'Glowing jellyfish', aka: 'bioluminescence, translucent SDF, squash and stretch, follow-through', tool: 'GLSL fragment shader (ray marching a pulsing SDF + volumetric glow)',
    notice: 'The bell is a hollow half-sphere distance field that squeezes and springs back on a pulse curve, and every squeeze pushes the animal up with an ease-out, then it coasts until the next beat: classic squash and stretch. Tentacles are bent capsules whose sway is delayed by height, so they trail behind the bell (follow-through). It looks translucent because each surface the ray passes adds a little light, most at grazing angles (Fresnel), and the ray keeps going.',
    use: 'ocean and nature films, calm ambient loops, "organic" brand moments, motion-principle lessons',
    prompt: 'Ray-marched bioluminescent jellyfish rising through deep blue water, 12 s: translucent bell that contracts and springs back every {pulse} (squash and stretch, ease-out push upward), eight trailing tentacles and frilly oral arms that lag behind the bell (follow-through), cyan-violet Fresnel rim glow (strength {glow}) with soft inner light, drifting marine snow, faint light from above, camera slowly circles.',
    params: [{ key: 'pulse', label: 'Pulse period', min: 1, max: 4, step: 0.05, value: 2, unit: ' s' }, { key: 'glow', label: 'Glow', min: 0.2, max: 2.5, step: 0.05, value: 1 }, SCALE],
  }, `uniform float uPulse,uGlow; float squeeze, rise; float glw; int part;
    float pulse(float t){float x=fract(t/uPulse); return smoothstep(0.,.18,x)*(1.-smoothstep(.18,.75,x));}
    float map(vec3 p){p.y-=rise; float s=squeeze;
      vec3 q=p; q.xz*=1.+.28*s; q.y*=1.-.2*s; float ang=atan(q.z,q.x); float r=length(q*vec3(1.,1.3,1.));
      float bell=abs(r-.8)-.035; float rim=-q.y-.02*s+.035*abs(sin(ang*8.)); bell=max(bell,rim-.08); float d=bell*.7; part=0;
      float tn=9.; for(int k=0;k<8;k++){float a=float(k)*.785+.2; vec2 b=vec2(cos(a),sin(a))*(.72-.16*s); float yy=-p.y; if(yy<0.) continue; float lag=uT*1.5-yy*1.2;
        vec2 off=b*(1.-.06*yy)+vec2(sin(lag+float(k)),cos(lag*.8+float(k)*2.))*.06*yy; float rr=.009*(1.-smoothstep(0.,3.6,yy))+.003; tn=min(tn,max(length(p.xz-off)-rr,yy-3.6));}
      float arms=9.; for(int k=0;k<4;k++){float a=float(k)*1.571+.6; float yy=-p.y+.1; float lag=uT*1.2-yy*1.5; vec2 c=vec2(cos(a),sin(a))*.08*(1.+yy*.3)+vec2(sin(lag+float(k)*1.3),cos(lag+float(k)))*.07*yy;
        float w=.06*(1.+.5*sin(yy*10.-uT*3.+float(k)))*smoothstep(1.8,.2,yy); vec2 dq=p.xz-c; arms=min(arms,max(abs(dot(dq,vec2(-sin(a+yy*2.),cos(a+yy*2.))))-.008,max(length(dq)-w,max(-yy,yy-1.8))));}
      glw+=.0004/(.004+tn*tn*3000.)+.0006/(.01+arms*arms*800.);
      if(tn<d){d=tn; part=1;} if(arms<d){d=arms; part=2;} return d*.85;}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; float ph=uT/uPulse; squeeze=pulse(uT); rise=(floor(ph)+smoothstep(.04,.8,fract(ph)))*.5; float camY=ph*.5+.2;
      vec3 ta=vec3(0.,camY-.95,0.); vec3 ro=ta+vec3(6.*sin(uT*.08),.9,6.*cos(uT*.08));
      vec3 ww=normalize(ta-ro), uu=normalize(cross(ww,vec3(0,1,0))), vv=cross(uu,ww); vec3 rd=normalize(uv.x*uu+uv.y*vv+1.6*ww);
      vec3 bg=mix(vec3(.0,.008,.025),vec3(.015,.07,.13),smoothstep(-.6,.8,rd.y))+vec3(.1,.25,.3)*pow(max(rd.y,0.),4.)*.5;
      vec3 c1=vec3(.25,.85,1.), c2=vec3(.75,.35,1.); vec3 col=vec3(0); float T=1.; glw=0.; float t=3.; int hits=0;
      for(int i=0;i<140;i++){vec3 p=ro+rd*t; float d=map(p);
        if(d<.0015){vec2 e=vec2(.003,0); int pt=part; vec3 n=normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));
          float fr=pow(1.-abs(dot(n,rd)),2.); float hy=p.y-rise; vec3 jc=mix(c1,c2,.5+.5*sin(hy*2.5+uT*.7));
          vec3 sc=jc*(.12+1.3*fr)+jc*squeeze*.35*smoothstep(-.2,.6,hy);
          if(pt==0){vec3 lq=p-vec3(0.,rise,0.); float an=atan(lq.z,lq.x), rr=length(lq.xz); sc+=jc*.5*pow(abs(cos(an*8.)),40.)*smoothstep(.2,.5,rr);
            sc+=vec3(1.,.55,.75)*.7*smoothstep(.06,.0,abs(rr-.24-.07*cos(an*4.)))*step(.2,lq.y);}
          float al=pt==0?.1+.6*fr:.7; col+=T*sc*al; T*=1.-al; hits++;
          if(T<.03||hits>5) break; t+=.025; continue;}
        t+=max(d,.006); if(t>12.) break;}
      col+=T*bg+mix(c1,c2,.4)*glw*.35*uGlow;
      for(int k=0;k<36;k++){float fk=float(k); vec3 sp=vec3(hash21(vec2(fk,1.))*7.-3.5,mod(hash21(vec2(fk,2.))*7.-uT*.05-camY,7.)-3.5+camY-.8,hash21(vec2(fk,3.))*7.-3.5);
        vec3 v=sp-ro; float tc=dot(v,rd); if(tc<.1) continue; float dd=length(v-rd*tc); col+=vec3(.6,.8,.9)*.00004/(dd*dd+.00002)*smoothstep(11.,3.,tc);}
      col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14); col=pow(clamp(col,0.,1.),vec3(.4545)); col*=1.-.4*dot(uv,uv);
      o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.014,1);}`);

  // ---------------- Snow globe ----------------
  card({
    id: 'g2-snowglobe', title: 'Snow globe, shaken', aka: 'refraction through a sphere, scene inside glass, particle settle, holiday', tool: 'GLSL fragment shader (ray-sphere refraction + ray marching inside + analytic snowflakes)',
    notice: 'The glass is an exact ray-sphere hit: part of the light reflects (Fresnel), the rest bends into the water and is ray marched through a tiny village of cones and boxes. Rays that miss the village bend again on the way out, so the room behind appears upside down and squeezed. Every few seconds the globe gets a quick shake (a jolt that dies away) and the flakes burst upward, swirl and settle back with a long ease-out.',
    use: 'holiday campaigns, greeting cards, cozy brand moments, "shake things up" metaphors',
    prompt: 'A snow globe on a dark wooden base in a cozy room, 16 s: glass sphere with Fresnel reflections and real refraction (the warm bokeh room behind appears upside down), inside a small snowy village with pine trees and a cottage with a glowing window, every {every} the globe jolts and {flakes} snowflakes burst up, swirl and slowly settle with a long ease-out, camera slowly drifts.',
    params: [{ key: 'flakes', label: 'Snowflakes', min: 10, max: 90, step: 1, value: 60 }, { key: 'every', label: 'Shake every', min: 4, max: 14, step: 0.5, value: 8, unit: ' s' }, SCALE],
  }, `uniform float uFlakes,uEvery; float U; vec2 shk;
    float sdCone(vec3 p,vec2 c,float h){vec2 q=h*vec2(c.x/c.y,-1.); vec2 w=vec2(length(p.xz),p.y); vec2 a=w-q*clamp(dot(w,q)/dot(q,q),0.,1.), b=w-q*vec2(clamp(w.x/q.x,0.,1.),1.); float k=sign(q.y), d=min(dot(a,a),dot(b,b)), s=max(k*(w.x*q.y-w.y*q.x),k*(w.y-q.y)); return sqrt(d)*sign(s);}
    float sdBox(vec3 p,vec3 b){vec3 d=abs(p)-b; return length(max(d,0.))+min(max(d.x,max(d.y,d.z)),0.);}
    float tree(vec3 p,float s){p/=s; float d=sdCone(p-vec3(0.,.5,0.),vec2(.45,.9),.32); d=min(d,sdCone(p-vec3(0.,.36,0.),vec2(.5,.87),.3)); d=min(d,sdCone(p-vec3(0.,.22,0.),vec2(.55,.84),.3)); d=min(d,max(length(p.xz)-.03,abs(p.y+.02)-.08)); return d*s;}
    vec2 inner(vec3 p){float g=p.y+.42-.035*vnoise(p.xz*5.)-.06*exp(-dot(p.xz,p.xz)*3.); vec2 r=vec2(g,0.);
      float tr=min(tree(p-vec3(-.38,-.42,.05),1.),min(tree(p-vec3(.42,-.42,-.18),.85),tree(p-vec3(-.08,-.42,-.45),1.15))); if(tr<r.x) r=vec2(tr,1.);
      vec3 hp=p-vec3(.12,-.33,.18); float hs=sdBox(hp,vec3(.15,.1,.11)); vec3 rp=hp-vec3(0.,.1,0.); float roof=max(abs(rp.z)*.9+rp.y*.75-.1,max(-rp.y,abs(rp.x)-.18)); float hh=min(hs,roof); if(hh<r.x) r=vec2(hh,2.+step(roof,hs));
      return r;}
    vec3 room(vec3 d){vec3 c=mix(vec3(.03,.018,.014),vec3(.06,.035,.03),smoothstep(-.3,.4,d.y));
      for(int i=0;i<16;i++){float fi=float(i); vec3 ld=normalize(vec3(sin(fi*2.4+.5)*1.2,.03+.3*hash21(vec2(fi,1.)),-cos(fi*2.4+.5))); float r=.04+.035*hash21(vec2(fi,2.));
        c+=mix(vec3(1.,.55,.22),vec3(1.,.8,.5),hash21(vec2(fi,3.)))*smoothstep(r,r*.75,acos(min(dot(d,ld),1.)))*.9;}
      vec2 wq=d.xy-vec2(.45,.45); c+=vec3(.5,.65,.9)*.7*smoothstep(.02,0.,max(abs(wq.x)-.2,abs(wq.y)-.16))*step(.012,abs(wq.x))*step(.012,abs(wq.y))*step(0.,d.z); return c;}
    vec3 snow(vec3 ro,vec3 rd,float tmax){vec3 c=vec3(0); for(int i=0;i<90;i++){if(float(i)>=uFlakes) break; float fi=float(i);
        float y0=-.3+1.05*hash21(vec2(fi,4.)), st=1.-exp(-U*.38); float y=mix(y0,-.4+.03*hash21(vec2(fi,6.)),st)+.18*exp(-U*1.8)*(hash21(vec2(fi,8.))-.3);
        float rr=sqrt(max(.75-y*y,0.))*(.15+.8*hash21(vec2(fi,5.))); float a=hash21(vec2(fi,7.))*6.283+2.6*(1.-exp(-U*.6))+.12*U*(1.-st);
        vec3 fp=vec3(cos(a)*rr,y,sin(a)*rr); vec3 v=fp-ro; float tc=dot(v,rd); if(tc<0.||tc>tmax) continue; float dd=length(v-rd*tc); c+=vec3(1.)*smoothstep(.022,.006,dd);} return c;}
    vec3 inside(vec3 ro,vec3 rd){float t=0.; vec2 h; bool hit=false; float tx=-dot(ro,rd)+sqrt(max(dot(ro,rd)*dot(ro,rd)-dot(ro,ro)+.97*.97,0.));
      for(int i=0;i<70;i++){h=inner(ro+rd*t); if(h.x<.001){hit=true;break;} t+=h.x*.9; if(t>tx) break;}
      vec3 col; if(hit){vec3 p=ro+rd*t; vec3 n=vec3(0); for(int k=min(int(uT),0);k<4;k++){vec3 e=.5773*(2.*vec3(float(((k+3)>>1)&1),float((k>>1)&1),float(k&1))-1.); n+=e*inner(p+e*.002).x;} n=normalize(n);
        vec3 L=normalize(vec3(-.4,.9,.3)); float dif=max(dot(n,L),0.)*.8+.25; vec3 wl=vec3(.12,-.36,.29)-p; float wd=length(wl); float wlit=max(dot(n,wl/wd),0.)/(1.+wd*wd*40.);
        vec3 alb=h.y<.5?vec3(.85,.9,1.):h.y<1.5?mix(vec3(.04,.18,.1),vec3(.8,.85,.95),smoothstep(.55,.85,n.y)):h.y<2.5?vec3(.55,.25,.15):vec3(.85,.88,.95);
        col=alb*(dif*vec3(.75,.82,1.)+wlit*vec3(1.,.6,.25)*3.);
        if(h.y>1.5&&h.y<2.5){vec3 hp=p-vec3(.12,-.33,.18); float win=step(abs(hp.x+.05),.035)*step(abs(hp.y+.01),.035)*step(.1,hp.z)+step(abs(hp.z),.04)*step(abs(hp.y+.01),.035)*step(.14,hp.x); col+=vec3(1.,.65,.25)*win*2.5;}
        tx=t;}
      else {vec3 p=ro+rd*tx; vec3 n=normalize(p); vec3 rr=refract(rd,-n,1.33); col=dot(rr,rr)>.01?room(rr):room(reflect(rd,-n))*.5;}
      return col+snow(ro,rd,tx);}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; float ev=uEvery; U=mod(uT+ev-1.5,ev); float j=exp(-U*5.)*step(U,1.5); shk=vec2(sin(U*28.),sin(U*21.+1.))*.05*j;
      float ca=.35*sin(uT*.12); vec3 ro=vec3(3.9*sin(ca),.3,3.9*cos(ca)), ta=vec3(0.,-.3,0.);
      vec3 ww=normalize(ta-ro), uu=normalize(cross(ww,vec3(0,1,0))), vv=cross(uu,ww); vec3 rd=normalize(uv.x*uu+uv.y*vv+1.55*ww);
      vec3 gc=vec3(shk.x,shk.y*.4,0.); float rot=shk.x*2.; mat2 R=mat2(cos(rot),-sin(rot),sin(rot),cos(rot));
      vec3 col=room(rd)*.6; float tb=1e9;
      float b0=dot(ro-gc,rd), h0=b0*b0-dot(ro-gc,ro-gc)+1.;
      for(int i=0;i<1;i++){float t=.0; for(int k=0;k<60;k++){vec3 p=ro+rd*t-gc; vec2 q=vec2(length(p.xz)-.92+.1*(p.y+1.2),abs(p.y+1.05)-.25); float d=min(max(q.x,q.y),0.)+length(max(q,0.))-.03; if(d<.001){tb=t;break;} t+=d; if(t>8.) break;}}
      if(rd.y<0.){float tf=(-1.3-ro.y)/rd.y; if(tf<tb&&tf<9.&&(h0<0.||tf<-b0-sqrt(max(h0,0.)))){vec3 p=ro+rd*tf; col=mix(vec3(.035,.02,.014),vec3(.055,.032,.02),vnoise(p.xz*1.2))*(.35+.65*exp(-length(p.xz-gc.xz)*.4))*smoothstep(9.,6.,tf); col*=.45+.55*smoothstep(.85,1.7,length(p.xz-gc.xz)); tb=tf;}}
      if(tb<1e9&&rd.y<0.&&(ro+rd*tb).y>-1.31){vec3 p=ro+rd*tb-gc; vec2 e=vec2(.002,0); col=mix(vec3(.12,.06,.03),vec3(.2,.11,.05),vnoise(vec2(atan(p.z,p.x)*8.,p.y*40.)));
        float gold=smoothstep(.02,0.,abs(p.y+.84)-.025); col=mix(col,vec3(1.,.75,.35)*.9*(.75+.25*sin(atan(p.z,p.x)*3.+uT)),gold); col*=.4+.6*smoothstep(-1.35,-.8,p.y);}
      if(h0>0.){float ts=-b0-sqrt(h0); if(ts>0.&&ts<tb){vec3 p=ro+rd*ts, n=normalize(p-gc); float fr=.04+.96*pow(1.-max(dot(n,-rd),0.),5.);
        vec3 r=refract(rd,n,1./1.33); vec3 lo=p-gc+r*.002; lo.xz=R*lo.xz; vec3 lr=r; lr.xz=R*lr.xz; vec3 ins=inside(lo,lr);
        col=ins*(1.-fr)*vec3(.96,.98,1.)+room(reflect(rd,n))*fr*1.5+vec3(1.)*pow(max(dot(reflect(rd,n),normalize(vec3(.4,.6,.7))),0.),300.)*2.;}}
      col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14); col=pow(clamp(col,0.,1.),vec3(.4545)); col*=1.-.4*dot(uv,uv);
      o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.012,1);}`);

  // ---------------- Lava lamp ----------------
  card({
    id: 'g2-lavalamp', title: 'Lava lamp', aka: '3D metaballs, smooth union, subsurface glow, retro lamp', tool: 'GLSL fragment shader (ray marching smooth-min blobs through refracting glass)',
    notice: 'Seven wax blobs rise and sink on slow, unrelated sine cycles. They are joined with a smooth minimum, so two blobs that come close grow a neck, merge, and later stretch and pinch apart. The glass bends the view a little on the way in, the wax is lit from the bulb below with a fake subsurface glow (bright where it is thin), and the lamp throws a warm pool of light on the wall behind.',
    use: 'retro and chill moods, music and lo-fi loops, "merge" and "split" metaphors, cozy brand moments',
    prompt: 'Ray-marched 1970s lava lamp in a dark room, 20 s: seven wax blobs rise, merge with a smooth union (blend {blend}), stretch and pinch apart, wax color {hue} lit from the bulb below with subsurface glow, violet liquid, slightly refracting glass, chrome base and cap, warm light pool on the wall, slow camera drift, flow speed {speed}.',
    params: [{ key: 'blend', label: 'Blob blend', min: 0.02, max: 0.5, step: 0.01, value: 0.16 }, { key: 'speed', label: 'Flow speed', min: 0, max: 3, step: 0.05, value: 1, unit: 'x' }, { key: 'hue', label: 'Wax hue', min: 0, max: 1, step: 0.01, value: 0.97 }, SCALE],
  }, `uniform float uBlend,uHue,uDist;
    float rad(float y){return .36+.14*exp(-pow((y+.35)/.8,2.))-.05*smoothstep(-.6,1.1,y);}
    float glass(vec3 p){return max((length(p.xz)-rad(p.y))*.92,abs(p.y)-1.15);}
    float metal(vec3 p){float b=max(length(p.xz)-mix(.62,.44,clamp((p.y+2.)/.8,0.,1.)),abs(p.y+1.6)-.4); float c=max(length(p.xz)-mix(.33,.17,clamp((p.y-1.15)/.45,0.,1.)),abs(p.y-1.375)-.225); return min(b,c)*.9;}
    float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h);}
    float wax(vec3 p){float d=length(p-vec3(0.,-1.5,0.))-.48; d=min(d,length(p-vec3(0.,1.4,0.))-.26);
      for(int i=0;i<7;i++){float fi=float(i); float ph=uDist*(.11+.05*hash21(vec2(fi,1.)))+fi*1.7; float y=-.05-1.*cos(ph)+.15*sin(ph*2.3);
        vec3 c=vec3(.12*sin(ph*1.3+fi),y,.12*cos(ph*1.1+fi*2.)); float r=.1+.07*hash21(vec2(fi,2.))+.025*sin(ph*3.); vec3 q=p-c; q.y/=1.+.35*abs(sin(ph));
        d=smin(d,length(q)-r,uBlend);}
      return max(d,glass(p)+.03);}
    vec3 room(vec3 d){vec3 c=mix(vec3(.02,.012,.02),vec3(.035,.02,.03),smoothstep(-.3,.5,d.y)); c+=vec3(1.,.4,.15)*.25*exp(-8.*length(d.xy-vec2(.0,-.05)))*step(0.,d.z);
      c+=vec3(.5,.6,.9)*1.2*smoothstep(.03,0.,max(abs(d.x+.6)-.15,abs(d.y-.35)-.3))*step(0.,-d.z); return c;}
    vec3 waxCol(){return .5+.5*cos(6.2832*(uHue+vec3(0.,.25,.4)));}
    vec3 insideL(vec3 ro,vec3 rd){float t=.0; vec3 liq=vec3(0); vec3 wc=waxCol()*1.2;
      for(int i=0;i<90;i++){vec3 p=ro+rd*t; float g=glass(p); if(g>.002) break; float d=wax(p); liq+=vec3(.16,.03,.26)*(.15+1.2*exp(-(p.y+1.3)*1.6))*.012;
        if(d<.002){vec3 n=vec3(0); for(int k=min(int(uT),0);k<4;k++){vec3 e=.5773*(2.*vec3(float(((k+3)>>1)&1),float((k>>1)&1),float(k&1))-1.); n+=e*wax(p+e*.003);} n=normalize(n);
          vec3 Lp=vec3(0.,-1.4,0.)-p; float ll=length(Lp); float dif=max(dot(n,Lp/ll),0.); float th=clamp(wax(p-n*.12)/-.12,0.,1.);
          float fr=pow(1.-max(dot(n,-rd),0.),2.); vec3 c=wc*wc*(.1+dif*.7/(1.+ll*ll*.3))+wc*vec3(1.,.6,.3)*(1.-th)*.45+wc*wc*.25*exp(-(p.y+1.4)*1.5); c*=.45+.75*pow(1.-fr,1.5); c+=wc*vec3(1.,.85,.6)*pow(1.-fr,6.)*.25;
          return c+liq;}
        t+=max(min(d,-g),.004);}
      return liq+vec3(.18,.03,.25)*.25;}
    void main(){vec2 uv=(vUv-.5)*${ASPECT}; float ca=.4*sin(uT*.1)-.15; vec3 ro=vec3(7.4*sin(ca),.25+.2*sin(uT*.07),7.4*cos(ca)), ta=vec3(1.05,-.25,0.);
      vec3 ww=normalize(ta-ro), uu=normalize(cross(ww,vec3(0,1,0))), vv=cross(uu,ww); vec3 rd=normalize(uv.x*uu+uv.y*vv+1.55*ww);
      vec3 wc=waxCol(); vec3 col; float tw=(-1.6-ro.z)/rd.z; vec3 pw=ro+rd*tw; float tf=rd.y<0.?(-2.-ro.y)/rd.y:1e9;
      if(tf<tw){vec3 pf=ro+rd*tf; col=vec3(.018,.012,.01)*(1.+.5*vnoise(pf.xz*1.5))+wc*wc*.15*exp(-length(pf.xz)*1.3);}
      else {col=vec3(.012,.009,.014)+wc*wc*.22*exp(-length((pw.xy-vec2(0.,-.4))*vec2(.9,.6))*1.6)+vec3(.4,.15,.6)*.04*exp(-length(pw.xy-vec2(0.,.4))*1.5);}
      float t=3.5; int m=0; for(int i=0;i<90;i++){vec3 p=ro+rd*t; float g=glass(p), mt=metal(p); float d=min(g,mt); if(d<.001){m=g<mt?1:2;break;} t+=d; if(t>9.) break;}
      if(m>0){vec3 p=ro+rd*t; vec2 e=vec2(.002,0);
        if(m==1){vec3 n=normalize(vec3(glass(p+e.xyy)-glass(p-e.xyy),glass(p+e.yxy)-glass(p-e.yxy),glass(p+e.yyx)-glass(p-e.yyx))); float fr=.04+.96*pow(1.-max(dot(n,-rd),0.),5.);
          vec3 r=refract(rd,n,1./1.08); col=insideL(p+r*.004,r)*(1.-fr)+room(reflect(rd,n))*fr*2.+vec3(1.)*pow(max(dot(reflect(rd,n),normalize(vec3(-.5,.4,.8))),0.),200.)*.8;}
        else {vec3 n=normalize(vec3(metal(p+e.xyy)-metal(p-e.xyy),metal(p+e.yxy)-metal(p-e.yxy),metal(p+e.yyx)-metal(p-e.yyx))); vec3 r=reflect(rd,n);
          col=room(r)*1.6*vec3(.9,.92,.95)+wc*.5*smoothstep(-.2,.6,r.y)*smoothstep(-1.,-1.3,p.y)+vec3(1.)*pow(max(dot(r,normalize(vec3(-.4,.5,.8))),0.),60.)*.6;}}
      col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14); col=pow(clamp(col,0.,1.),vec3(.4545)); col*=1.-.35*dot(uv,uv);
      o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.012,1);}`, false, (u, t, dt, L) => { u.uDist = (u.uDist || 0) + dt * L.p.speed; });

  // ---------------- Clockwork ----------------
  card({
    id: 'g2-gears', title: 'Clockwork gear train', aka: 'meshing gears, polar repetition, brass mechanism, steampunk', tool: 'GLSL fragment shader (ray marching polar-repeated SDFs)',
    notice: 'Each gear is drawn once as a single tooth: the angle around the center is folded with mod(), so one tooth repeats all the way round (polar repetition). Teeth count is tied to radius, and each gear turns at the speed of its neighbor times the ratio of their tooth counts, in the opposite direction, so the teeth stay meshed. Brass and steel come from environment reflections, soft shadows and ambient occlusion.',
    use: 'process and teamwork metaphors, "how it works" explainers, watch and craft brands, steampunk titles',
    prompt: 'Ray-marched clockwork: six meshing brass and steel gears on a dark plate, teeth made by polar repetition, gear speeds set by their radius ratios so the teeth stay meshed (drive speed {speed}), spokes and hubs, warm key light with soft shadows, ambient occlusion, slow camera pan across the mechanism, 15 s.',
    params: [{ key: 'speed', label: 'Drive speed', min: 0, max: 3, step: 0.05, value: 1, unit: 'x' }, SCALE],
  }, `uniform float uDist; const float MOD=.12;
    const vec3 GD[6]=vec3[](vec3(40.,-1.,0.),vec3(22.,0.,20.),vec3(26.,0.,200.),vec3(18.,1.,-30.),vec3(30.,2.,160.),vec3(14.,0.,285.));
    vec3 GP[6]; float ang[6];
    float sdBox2(vec2 p,vec2 b){vec2 d=abs(p)-b; return length(max(d,0.))+min(max(d.x,d.y),0.);}
    float gear(vec3 p,int i){vec3 q=p-vec3(GP[i].xy,0.); float N=GD[i].x, R=GP[i].z, a=atan(q.y,q.x)+ang[i], r=length(q.xy), sec=6.2832/N;
      float an=mod(a+sec*.5,sec)-sec*.5; vec2 lp=r*vec2(cos(an),sin(an)); float tooth=sdBox2(lp-vec2(R,0.),vec2(MOD*.42,MOD*.25*(1.15-.6*(lp.x-R)/MOD)))-.006;
      float d=min(r-R+MOD*.25,tooth); float sp=mod(a,1.0472)-.5236; float spoke=abs(r*sin(sp))-R*.07;
      float win=max(max(r-R*.74,R*.3-r),-spoke); d=max(d,-win+.012); d=max(d,abs(q.z)-.05)-.004;
      float hub=max(r-R*.2,abs(q.z)-.09)-.006; return max(min(d,hub),-(r-.035));}
    int mid; float map(vec3 p){float d=p.z+.25; mid=0; for(int i=0;i<6;i++){float g=gear(p,i); if(g<d){d=g; mid=i+1;}} return d;}
    float shadow(vec3 ro,vec3 rd){float res=1.,t=.02; for(int i=0;i<32;i++){float h=map(ro+rd*t); res=min(res,8.*h/t); t+=clamp(h,.01,.15); if(res<.005||t>2.5) break;} return clamp(res,0.,1.);}
    vec3 env(vec3 r){return vec3(.03,.025,.025)+vec3(1.,.8,.55)*1.6*smoothstep(.55,.95,dot(r,normalize(vec3(-.5,.6,.7))))+vec3(.45,.55,.75)*.35*smoothstep(-.3,1.,r.y);}
    void main(){vec2 uv=(vUv-.5)*${ASPECT};
      for(int i=0;i<6;i++){vec3 g=GD[i]; float R=g.x*MOD/6.2832; if(g.y<0.){GP[i]=vec3(0.,0.,R); ang[i]=uDist*.5; continue;} int j=int(g.y); float th=radians(g.z);
        GP[i]=vec3(GP[j].xy+(GP[j].z+R)*vec2(cos(th),sin(th)),R); ang[i]=-(th+ang[j])*GD[j].x/g.x+3.14159/g.x-th-3.14159;}
      float px=.55*sin(uT*.15)-.1; vec3 ro=vec3(px*1.3,-2.+.15*sin(uT*.11),3.), ta=vec3(px,-.2,0.);
      vec3 ww=normalize(ta-ro), uu=normalize(cross(ww,vec3(0,1,0))), vv=cross(uu,ww); vec3 rd=normalize(uv.x*uu+uv.y*vv+1.6*ww);
      float t=1.; bool hit=false; for(int i=0;i<120;i++){float d=map(ro+rd*t); if(d<.0007*t){hit=true;break;} t+=d*.9; if(t>9.) break;}
      vec3 col=vec3(.01);
      if(hit){vec3 p=ro+rd*t; map(p); int m=mid; vec3 n=vec3(0); for(int k=min(int(uT),0);k<4;k++){vec3 e=.5773*(2.*vec3(float(((k+3)>>1)&1),float((k>>1)&1),float(k&1))-1.); n+=e*map(p+e*.0015);} n=normalize(n);
        vec3 L=normalize(vec3(-.5,.6,.8)); float sh=shadow(p+n*.003,L); float dif=max(dot(n,L),0.)*sh;
        float ao=0.,sc=1.; for(int k=1;k<5;k++){float h=.03*float(k); ao+=(h-map(p+n*h))*sc; sc*=.65;} ao=clamp(1.-ao*6.,0.,1.);
        vec3 r=reflect(rd,n); float fre=pow(1.-max(dot(n,-rd),0.),5.); bool steel=m==2||m==5;
        if(m==0){col=vec3(.045,.04,.045)*(.25+dif*1.2)*ao*(.8+.2*vnoise(p.xy*20.));}
        else {vec3 base=steel?vec3(.72,.75,.8):vec3(1.,.62,.26); col=base*(env(r)*(.35+.65*sh)*(.6+.4*fre)+dif*.3)*ao+vec3(1.,.9,.7)*pow(max(dot(r,L),0.),50.)*sh*1.5;}
        col=mix(col,vec3(.01),1.-exp(-max(t-3.5,0.)*.35));}
      col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14); col=pow(clamp(col,0.,1.),vec3(.4545)); col*=1.-.35*dot(uv,uv);
      o=vec4(col+(hash21(vUv*uRes+fract(uT)*91.)-.5)*.012,1);}`, false, (u, t, dt, L) => { u.uDist = (u.uDist || 0) + dt * L.p.speed; });
})();
