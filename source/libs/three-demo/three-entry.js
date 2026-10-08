// Three.js demo for the "Animation libraries" section (card id three-configurator).
// Bundled with esbuild into site/vendor/three-demo.js (classic script, works from file://).
// Exposes window.LIBS_THREE.setup(stage, L) for a kind:'dom' card; it returns frame(t, dt).
// L.p holds the Tweak slider values (spin, ior, thick, env); L.state keeps the chosen finish and color across Replay.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SWATCHES = [['Coral', '#ff5a36'], ['Amber', '#ffb020'], ['Cyan', '#2bc4e6'], ['Violet', '#7a5cff'], ['Cream', '#f4efe6']];
const FINISHES = [
  { name: 'Glass', transmission: 1, roughness: 0.03, clearcoat: 0, sheen: 0, tint: 0.06 },
  { name: 'Frosted glass', transmission: 1, roughness: 0.4, clearcoat: 0, sheen: 0, tint: 0.1 },
  { name: 'Ceramic', transmission: 0, roughness: 0.32, clearcoat: 1, sheen: 0, tint: 0.8 },
  { name: 'Velvet', transmission: 0, roughness: 1, clearcoat: 0, sheen: 1, tint: 1, dark: 0.45 },
];
// Finish and color pairs shown one after another until someone clicks a button.
const AUTO = [[0, 0], [1, 2], [2, 1], [3, 3], [0, 1], [2, 4], [3, 0], [1, 3]];
const TWEEN = 0.65;
const WHITE = new THREE.Color('#ffffff');
const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const smooth = pts => new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(90);

// Builds renderer, scene and drag handling once per stage element, so Replay reuses the same WebGL context.
function build() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(640, 360);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  const cv = renderer.domElement;
  Object.assign(cv.style, { display: 'block', position: 'absolute', left: '0', top: '0', touchAction: 'none', cursor: 'grab' });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d0d14');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 640 / 360, 0.1, 100);
  camera.position.set(0, 2.0, 8.2); camera.lookAt(0, 1.35, 0);

  // Studio: gradient backdrop, two light strips (the glass bends them), glossy pedestal.
  const back = new THREE.SphereGeometry(30, 32, 16), bc = [], top = new THREE.Color('#24204a'), bot = new THREE.Color('#0b0b10');
  for (let i = 0; i < back.attributes.position.count; i++) { const y = back.attributes.position.getY(i) / 30; const c = bot.clone().lerp(top, Math.max(0, Math.min(1, y * 1.6 + 0.35))); bc.push(c.r, c.g, c.b); }
  back.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
  scene.add(new THREE.Mesh(back, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  for (const x of [-2.3, 2.3]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 5.2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4efe6').multiplyScalar(1.4) }));
    strip.position.set(x, 2.1, -4.2); scene.add(strip);
  }
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.2, 0.24, 96), new THREE.MeshPhysicalMaterial({ color: '#0e0e16', roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 0.35 }));
  ped.position.y = -0.12; scene.add(ped);

  // Soft contact shadow: a radial gradient drawn into a canvas texture.
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sg = sc.getContext('2d'), gr = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = gr; sg.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.006; shadow.scale.y = 0.62; scene.add(shadow);

  const key = new THREE.DirectionalLight('#fff3e2', 1.4); key.position.set(3, 6, 4); scene.add(key);
  const rimA = new THREE.PointLight('#ff5a36', 25, 12), rimB = new THREE.PointLight('#2bc4e6', 25, 12);
  rimA.position.set(-3, 2.5, -2); rimB.position.set(3, 2, -2); scene.add(rimA, rimB);

  // The product: one lathe profile for the glass, one for the liquid, one for the cap.
  const spin = new THREE.Group(); scene.add(spin);
  const bottle = new THREE.Group(); bottle.scale.z = 0.62; spin.add(bottle);
  const body = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, thickness: 1.2, ior: 1.5, roughness: 0.03, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.05, sheen: 0, sheenRoughness: 0.35, sheenColor: '#ffffff', specularIntensity: 1 });
  const liquid = new THREE.MeshPhysicalMaterial({ color: '#ff5a36', roughness: 0.15, clearcoat: 1, emissive: '#ff5a36', emissiveIntensity: 0.12 });
  const gold = new THREE.MeshPhysicalMaterial({ color: '#ffcf7a', metalness: 1, roughness: 0.28 });
  bottle.add(new THREE.Mesh(new THREE.LatheGeometry(smooth([[0, 0], [0.82, 0], [0.98, 0.04], [1.06, 0.16], [1.1, 0.5], [1.1, 1.3], [1.04, 1.7], [0.86, 1.98], [0.5, 2.16], [0.3, 2.22], [0.28, 2.42], [0, 2.42]]), 96), body));
  bottle.add(new THREE.Mesh(new THREE.LatheGeometry(smooth([[0, 0.14], [0.8, 0.14], [0.9, 0.22], [0.93, 0.5], [0.93, 1.42], [0, 1.44]]), 96), liquid));
  bottle.add(new THREE.Mesh(new THREE.LatheGeometry(smooth([[0, 2.38], [0.36, 2.38], [0.41, 2.44], [0.42, 2.56], [0.42, 2.98], [0.38, 3.05], [0, 3.08]]), 96), gold));

  const D = { down: false, x: 0, y: 0, vel: 0, yaw: 0.4, pitch: 0 };
  cv.addEventListener('pointerdown', e => { D.down = true; D.x = e.clientX; D.y = e.clientY; D.vel = 0; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
  cv.addEventListener('pointermove', e => {
    if (!D.down) return;
    const dx = e.clientX - D.x, dy = e.clientY - D.y; D.x = e.clientX; D.y = e.clientY;
    D.yaw += dx * 0.012; D.vel = dx * 0.012 * 60; D.pitch = Math.max(-0.35, Math.min(0.35, D.pitch + dy * 0.006));
  });
  const up = () => { D.down = false; cv.style.cursor = 'grab'; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  return { renderer, scene, camera, spin, body, liquid, D };
}

const CSS = `.tc-ui{position:absolute;inset:0;pointer-events:none;font-family:"Segoe UI",sans-serif}
.tc-ui button{pointer-events:auto;cursor:pointer}
.tc-mats{position:absolute;left:14px;top:14px;display:flex;flex-direction:column;gap:6px}
.tc-mats button{font:600 12px "Cascadia Mono",Consolas,monospace;color:#ece7de;background:rgba(20,20,28,.72);border:1px solid #34344a;border-radius:999px;padding:5px 12px;text-align:left}
.tc-mats button.on{background:#f4efe6;color:#0b0b10;border-color:#f4efe6}
.tc-sws{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:10px;padding:7px 10px;border-radius:999px;background:rgba(20,20,28,.72);border:1px solid #2a2a38}
.tc-sws button{width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,.15);padding:0}
.tc-sws button.on{outline:2px solid #f4efe6;outline-offset:2px}
.tc-name{position:absolute;right:16px;top:14px;text-align:right;font:700 18px Bahnschrift,"Segoe UI",sans-serif;color:#f4efe6}
.tc-name span{display:block;font:12px "Cascadia Mono",Consolas,monospace;color:#8a8794;margin-top:2px}
.tc-hint{position:absolute;right:16px;bottom:18px;font:12px "Cascadia Mono",Consolas,monospace;color:#8a8794}`;

function setup(stage, L) {
  const S = stage._three || (stage._three = build());
  const { renderer, scene, camera, spin, body, liquid, D } = S;
  stage.appendChild(renderer.domElement);
  const style = document.createElement('style'); style.textContent = CSS; stage.appendChild(style);
  const ui = document.createElement('div'); ui.className = 'tc-ui'; stage.appendChild(ui);
  ui.innerHTML = `<div class="tc-mats">${FINISHES.map((f, i) => `<button data-m="${i}">${f.name}</button>`).join('')}</div>
    <div class="tc-name"></div>
    <div class="tc-sws">${SWATCHES.map(([n, c], i) => `<button data-c="${i}" title="${n}" style="background:${c}"></button>`).join('')}</div>
    <div class="tc-hint">drag to rotate</div>`;
  const prev = L && L.state ? L.state : {};
  const st = { mat: prev.mat || 0, col: prev.col || 0, manual: !!prev.manual, autoI: -1, t0: -9, from: null, to: null };
  if (L) L.state = st;
  let now = 0;

  const snap = () => ({ transmission: body.transmission, roughness: body.roughness, clearcoat: body.clearcoat, sheen: body.sheen, color: body.color.clone(), sheenColor: body.sheenColor.clone(), liquid: liquid.color.clone() });
  const target = (mi, ci) => {
    const f = FINISHES[mi], c = new THREE.Color(SWATCHES[ci][1]);
    return { transmission: f.transmission, roughness: f.roughness, clearcoat: f.clearcoat, sheen: f.sheen, color: WHITE.clone().lerp(c, f.tint).multiplyScalar(f.dark || 1), sheenColor: c.clone().lerp(WHITE, 0.6), liquid: c };
  };
  const apply = (a, b, k) => {
    for (const n of ['transmission', 'roughness', 'clearcoat', 'sheen']) body[n] = a[n] + (b[n] - a[n]) * k;
    body.color.copy(a.color).lerp(b.color, k); body.sheenColor.copy(a.sheenColor).lerp(b.sheenColor, k);
    liquid.color.copy(a.liquid).lerp(b.liquid, k); liquid.emissive.copy(liquid.color);
  };
  const label = () => {
    ui.querySelectorAll('.tc-mats button').forEach(b => b.classList.toggle('on', +b.dataset.m === st.mat));
    ui.querySelectorAll('.tc-sws button').forEach(b => b.classList.toggle('on', +b.dataset.c === st.col));
    ui.querySelector('.tc-name').innerHTML = `${FINISHES[st.mat].name}<span>${SWATCHES[st.col][0]} &middot; ${st.manual ? 'your pick' : 'auto demo'}</span>`;
  };
  const choose = (mi, ci, t) => { st.from = snap(); st.mat = mi; st.col = ci; st.to = target(mi, ci); st.t0 = t; label(); };
  ui.querySelectorAll('.tc-mats button').forEach(b => { b.onclick = () => { st.manual = true; choose(+b.dataset.m, st.col, now); }; });
  ui.querySelectorAll('.tc-sws button').forEach(b => { b.onclick = () => { st.manual = true; choose(st.mat, +b.dataset.c, now); }; });
  const first = target(st.mat, st.col); apply(first, first, 1); label();

  return (t, dt) => {
    now = t;
    const p = (L && L.p) || {};
    if (!st.manual) { const i = Math.floor(t / 4) % AUTO.length; if (i !== st.autoI) { st.autoI = i; if (t > 0.5) choose(AUTO[i][0], AUTO[i][1], t); } }
    const k = st.to ? Math.min(1, Math.max(0, (t - st.t0) / TWEEN)) : 1;
    if (st.to) apply(st.from, st.to, ease(k));
    body.ior = p.ior !== undefined ? p.ior : 1.5;
    body.thickness = p.thick !== undefined ? p.thick : 1.2;
    scene.environmentIntensity = p.env !== undefined ? p.env : 1;
    const autoSpin = p.spin !== undefined ? p.spin : 0.5;
    if (!D.down) { D.vel *= Math.exp(-dt * 2.5); D.yaw += (D.vel + autoSpin) * dt; D.pitch *= Math.exp(-dt * 1.5); }
    const pop = Math.sin(Math.PI * k);
    spin.rotation.set(D.pitch * 0.6, D.yaw + 0.45 * pop, 0);
    spin.scale.setScalar(1 + 0.04 * pop);
    renderer.render(scene, camera);
  };
}

// THREE is the whole namespace, for other cards that build their own scene (set2-libs.js, card l2-three-flight).
window.LIBS_THREE = { setup, version: THREE.REVISION, THREE };
