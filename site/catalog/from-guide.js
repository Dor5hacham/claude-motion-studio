// Catalog cards that started as live demos in the Motion Guide: masked letter reveal,
// trim paths, shape morph and live GPU particles (own WebGL2 context).
(function () {
  const { C, seg, lerp, ease } = EX;
  const NS = 'http://www.w3.org/2000/svg';

  EX.add({
    cat: 'type', id: 'maskreveal', kind: 'dom', title: 'Masked letter reveal', aka: 'text rise, mask reveal, staggered letters', tool: 'CSS overflow mask + Web Animations API', runs: 'WEB',
    notice: 'Each letter sits in a box that hides anything outside it. The letter starts below the box and slides up, each one a little later than the last, so the word rises out of an invisible slot.',
    use: 'headlines, website heroes, title cards',
    params: [{ key: 'stg', label: 'Letter stagger', min: 0, max: 150, step: 5, value: 45, unit: ' ms' }, { key: 'dur', label: 'Move duration', min: 200, max: 1600, step: 50, value: 700, unit: ' ms' }],
    prompt: 'Headline "MOTION GUIDE" rises letter by letter through a mask, {stg} stagger, {dur} per letter with ease-out-expo, then slow letter tracking.',
    setup(st, L) {
      st.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;font:700 64px Bahnschrift;letter-spacing:4px;color:#ece7de"></div>';
      const row = st.firstChild; const word = 'MOTION GUIDE'; const els = [];
      for (let i = 0; i < word.length; i++) { const s = document.createElement('span'); s.style.cssText = 'display:inline-block;overflow:hidden;height:80px;line-height:80px'; const it = document.createElement('i'); it.style.cssText = 'display:inline-block;font-style:normal'; it.textContent = word[i] === ' ' ? ' ' : word[i]; if (i > 6) it.style.color = C.coral; s.appendChild(it); row.appendChild(s); els.push(it); }
      return t => {
        const lt = t % 3.6, stg = L.p.stg / 1000, dur = L.p.dur / 1000;
        els.forEach((it, i) => { const k = ease.expo(seg(lt, 0.3 + i * stg, 0.3 + i * stg + dur)), o = ease.inExpo(seg(lt, 3.0, 3.4)); it.style.transform = `translateY(${(1 - k) * 100 - o * 100}%)`; });
        row.style.letterSpacing = lerp(4, 12, ease.out(seg(lt, 1, 3))) + 'px';
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'trimpaths', kind: 'dom', title: 'Trim paths', aka: 'line draw-on, stroke animation, stroke-dashoffset', tool: 'SVG stroke-dasharray / stroke-dashoffset', runs: 'WEB',
    notice: 'A line "draws itself" by animating how much of the path is visible. The start and end of the visible part move separately, so lines can grow, travel and disappear. In After Effects this is called Trim Paths.',
    use: 'logo outlines, signatures, maps and routes, diagrams',
    params: [{ key: 'dur', label: 'Draw time', min: 0.3, max: 3, step: 0.1, value: 1.1, unit: ' s' }],
    prompt: 'Draw the logo outline on with trim paths over {dur}, ease-in-out, then erase it from the start so the line travels off, coral and cyan strokes.',
    setup(st, L) {
      const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 640 360'); svg.setAttribute('width', '640'); svg.setAttribute('height', '360'); st.appendChild(svg);
      const defs = [['M80 280 C 170 70, 270 70, 320 190 S 470 300, 560 90', C.coral, 9], ['M320 190 m -80 0 a 80 80 0 1 0 160 0 a 80 80 0 1 0 -160 0', C.cyan, 6], ['M90 325 L 550 325', C.amber, 5]];
      const els = defs.map(([d, c, w]) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', c); p.setAttribute('stroke-width', w); p.setAttribute('stroke-linecap', 'round'); svg.appendChild(p); return [p, p.getTotalLength()]; });
      return t => {
        const D = L.p.dur, cyc = t % (D * 2 + 1.25);
        els.forEach(([p, len], i) => { const s = ease.inOut(seg(cyc, 0.05 + i * 0.2, 0.05 + i * 0.2 + D)), e = ease.inOut(seg(cyc, D + 0.75 + i * 0.12, D * 2 + 0.75 + i * 0.12)); p.style.strokeDasharray = `${Math.max(0, (s - e) * len)} ${len}`; p.style.strokeDashoffset = -e * len; });
      };
    },
  });

  EX.add({
    cat: 'mg', id: 'shapemorph', title: 'Shape morph', aka: 'shape tween, corner-radius morph', tool: 'Canvas 2D (rounded rectangle radius + rotation)', runs: 'CPU',
    notice: 'A square turns into a circle by growing its corner radius while it rotates a quarter turn, and its color shifts at the same time. Three properties changing together read as one fluid transformation.',
    use: 'icon transitions, button states, logo animations',
    params: [{ key: 'dur', label: 'Morph time', min: 0.3, max: 2.5, step: 0.1, value: 1.2, unit: ' s' }],
    prompt: 'Morph the square button into a circle while it rotates 90 degrees and shifts from coral to violet, {dur}, ease-in-out, then morph back.',
    setup(cv, L) {
      const g = cv.getContext('2d');
      return t => {
        const D = L.p.dur, cyc = t % (D * 2 + 1.6), a = ease.inOut(seg(cyc, 0.3, 0.3 + D)), b = ease.inOut(seg(cyc, D + 1.1, D * 2 + 1.1)), m = a - b, S = 150;
        g.fillStyle = '#08080c'; g.fillRect(0, 0, 640, 360);
        g.save(); g.translate(320, 180); g.rotate((a + b) * Math.PI / 2);
        g.fillStyle = `rgb(${lerp(255, 122, m)},${lerp(90, 92, m)},${lerp(54, 255, m)})`;
        g.beginPath(); g.roundRect(-S / 2, -S / 2, S, S, m * S / 2); g.fill(); g.restore();
      };
    },
  });

  EX.add({
    cat: 'gpu', id: 'liveparticles', title: 'Live GPU particles', aka: 'particle morph, vertex shader particles', tool: 'WebGL2 vertex shader (own context)', runs: 'GPU',
    notice: 'Particles computed by a vertex shader on your graphics card every frame, morphing between a galaxy, a sphere and a ring. Push the count up to see how many your GPU handles smoothly.',
    use: 'logo reveals, tech intros, live website backgrounds',
    params: [{ key: 'count', label: 'Particles (thousands)', min: 10, max: 500, step: 10, value: 120, unit: 'k' }, { key: 'size', label: 'Point size', min: 1, max: 4, step: 0.2, value: 1.6, unit: ' px' }],
    prompt: 'GPU particle background for my website: {count} particles in a WebGL2 vertex shader morph between a galaxy, a sphere and a ring every 3 s, point size {size}, additive blending, coral to violet.',
    setup(cv, L) {
      const gl = cv.getContext('webgl2', { antialias: true }); if (!gl) return () => {};
      const vs = `#version 300 es
      in vec4 aS; uniform float uT; uniform float uA; uniform float uSize; out vec3 vC;
      vec3 rotY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
      float e(float x){x=clamp(x,0.,1.);return x<.5?4.*x*x*x:1.-pow(-2.*x+2.,3.)/2.;}
      void main(){
        float r=.2+pow(aS.x,.7)*1.8, th=floor(aS.y*4.)*1.5708+r*1.3+uT*(.8/(.3+r))+(aS.z-.5)*.7;
        vec3 gal=vec3(cos(th)*r,(aS.w-.5)*.15,sin(th)*r);
        float z=aS.y*2.-1., a=aS.z*6.2832; vec3 d=vec3(sqrt(1.-z*z)*cos(a),z,sqrt(1.-z*z)*sin(a));
        vec3 sph=d*(1.1+.08*sin(d.y*8.+uT*2.));
        float u=aS.x*6.2832; vec3 ring=vec3(cos(u)*1.5,sin(u*3.+uT)*.15,sin(u)*1.5)+d*.12*aS.w;
        float c=mod(uT,9.), dl=aS.w*.4;
        float k1=e((c-2.-dl)/1.2), k2=e((c-5.-dl)/1.2), k3=e((c-7.6-dl)/1.2);
        vec3 p=mix(mix(mix(gal,sph,k1),ring,k2),gal,k3);
        p+=vec3(sin(aS.x*40.+uT*3.),cos(aS.y*37.+uT*2.),sin(aS.z*31.+uT*2.5))*.25*(sin(k1*3.14)+sin(k2*3.14)+sin(k3*3.14));
        p=rotY(p,uT*.25); p=vec3(p.x,p.y*cos(.45)-p.z*sin(.45),p.y*sin(.45)+p.z*cos(.45));
        float w=3.6-p.z; gl_Position=vec4(p.x*1.9/w/uA*1.6,p.y*1.9/w*1.6,0.,1.);
        gl_PointSize=uSize;
        vec3 c1=mix(vec3(1.,.72,.3),vec3(.5,.36,1.),aS.x), c2=mix(vec3(.17,.77,.95),vec3(.5,.36,1.),d.y*.5+.5), c3=vec3(1.,.4,.25);
        vC=mix(mix(mix(c1,c2,k1),c3,k2),c1,k3)*.28;
      }`;
      const fs = `#version 300 es
      precision mediump float; in vec3 vC; out vec4 o; uniform float uGain; void main(){o=vec4(vC*uGain,1.);}`;
      const P = gl.createProgram();
      for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh)); gl.attachShader(P, sh); }
      gl.linkProgram(P);
      const MAX = 500000, data = new Float32Array(MAX * 4); for (let i = 0; i < data.length; i++) data[i] = Math.random();
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(P, 'aS'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
      const U = n => gl.getUniformLocation(P, n);
      return t => {
        const n = Math.round(L.p.count * 1000);
        gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0.03, 0.03, 0.05, 1); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(P); gl.uniform1f(U('uT'), t); gl.uniform1f(U('uA'), cv.width / cv.height); gl.uniform1f(U('uSize'), L.p.size); gl.uniform1f(U('uGain'), Math.min(1.6, Math.sqrt(120000 / n)));
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.bindVertexArray(vao); gl.drawArrays(gl.POINTS, 0, n);
      };
    },
  });
})();
