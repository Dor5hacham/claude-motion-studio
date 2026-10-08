// Live WebGPU compute demos. Each card owns a 'webgpu' canvas context (separate from the shared WebGL2 EX.G),
// moves its particles with WGSL compute shaders and draws them with a compute rasterizer (atomic adds into a pixel buffer).
(function () {
  const SW = 640, SH = 360;

  // Shared WGSL: uniforms, buffers, hashing, the atomic splat, the trail resolve pass and the display shader.
  // Each card appends its own pal(), and its compute entry points.
  const COMMON = `
struct U { t: f32, dt: f32, fade: f32, gain: f32, n: u32, frame: u32, p0: f32, p1: f32, p2: f32, p3: f32, q0: f32, q1: f32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> P: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> acc: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> trail: array<vec2f>;
const SW = 640u; const SH = 360u;
fn hash(x: u32) -> u32 { var v = x * 747796405u + 2891336453u; v = ((v >> ((v >> 28u) + 4u)) ^ v) * 277803737u; return (v >> 22u) ^ v; }
fn rnd(x: u32) -> f32 { return f32(hash(x)) / 4294967295.0; }
fn splat(p: vec2f, hue: f32) {
  if (p.x < 0. || p.y < 0. || p.x >= f32(SW) || p.y >= f32(SH)) { return; }
  let i = (u32(p.y) * SW + u32(p.x)) * 2u;
  atomicAdd(&acc[i], 1u); atomicAdd(&acc[i + 1u], u32(clamp(hue, 0., 1.) * 255.));
}
@compute @workgroup_size(256) fn resolve(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x; if (i >= SW * SH) { return; }
  let c = f32(atomicExchange(&acc[2u * i], 0u)); let h = f32(atomicExchange(&acc[2u * i + 1u], 0u)) / 255.;
  trail[i] = trail[i] * u.fade + vec2f(c, h);
}
fn tr(x: i32, y: i32) -> vec2f { return trail[u32(clamp(y, 0, 359)) * SW + u32(clamp(x, 0, 639))]; }
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f { let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)); return vec4f(p * 2. - 1., 0., 1.); }
@fragment fn fs(@builtin(position) q: vec4f) -> @location(0) vec4f {
  let x = i32(q.x); let y = i32(q.y); let s = tr(x, y);
  var g = vec2f(0.);
  for (var k = 0; k < 8; k++) { let a = f32(k) * .785398 + .39; g += tr(x + i32(round(cos(a) * 3.5)), y + i32(round(sin(a) * 3.5))); }
  g /= 8.;
  let d = 1. - exp(-s.x * u.gain); let gd = 1. - exp(-g.x * u.gain * .8);
  let hue = s.y / max(s.x, 1e-4); let gh = g.y / max(g.x, 1e-4);
  let uv = q.xy / vec2f(640., 360.) - .5;
  var col = vec3f(.043, .043, .063) + pal(gh) * gd * .5 + pal(hue) * d * .85 + vec3f(1., .95, .86) * pow(d, 5.) * .45;
  col *= 1. - .7 * dot(uv, uv);
  return vec4f(col, 1.);
}
`;

  // Draws a plain notice on the stage when WebGPU cannot start; the card then stays a still frame.
  function say(stage, msg) {
    const g = /** @type {CanvasRenderingContext2D} */ (stage.getContext('2d')); if (!g) return;
    g.fillStyle = '#0b0b10'; g.fillRect(0, 0, SW, SH); g.textAlign = 'center';
    g.fillStyle = '#f3ead8'; g.font = '22px Bahnschrift'; g.fillText(msg, SW / 2, SH / 2 - 8);
    g.fillStyle = '#8b8aa3'; g.font = '14px Segoe UI'; g.fillText('This card needs WebGPU: Chrome or Edge 113 or newer on a supported GPU.', SW / 2, SH / 2 + 22);
  }

  // Starts a WebGPU card. make(dev, ctx, fmt) builds buffers and pipelines once and returns { reset(), frame(t, dt) };
  // the result is kept on L.wg, so Replay only resets the simulation instead of creating a second device.
  function boot(stage, L, make) {
    if (L.wg) { L.wg.reset(); return (t, dt) => L.wg.frame(t, dt); }
    const gpu = /** @type {any} */ (navigator).gpu;
    if (!gpu) { say(stage, 'WebGPU is not available in this browser'); return () => {}; }
    if (!L.wgBusy) {
      L.wgBusy = true;
      gpu.requestAdapter().then(a => (a ? a.requestDevice() : null)).then(dev => {
        if (!dev) { say(stage, 'No WebGPU adapter found'); return; }
        const ctx = /** @type {any} */ (stage.getContext('webgpu')); const fmt = gpu.getPreferredCanvasFormat();
        ctx.configure({ device: dev, format: fmt, alphaMode: 'opaque' });
        L.wg = make(dev, ctx, fmt);
      }).catch(() => say(stage, 'WebGPU could not start'));
    }
    return (t, dt) => { if (L.wg) L.wg.frame(t, dt); };
  }

  // Builds the compute rasterizer around a particle buffer of `bytes` bytes and the card's WGSL `code`.
  // run(v, passes) writes the uniforms, dispatches each [entry, threads] pair, resolves trails and presents.
  function rig(dev, ctx, fmt, bytes, code, entries) {
    const UB = dev.createBuffer({ size: 48, usage: 0x40 | 0x8 });
    const PB = dev.createBuffer({ size: bytes, usage: 0x80 | 0x8 });
    const AB = dev.createBuffer({ size: SW * SH * 8, usage: 0x80 });
    const TB = dev.createBuffer({ size: SW * SH * 8, usage: 0x80 });
    const bgl = dev.createBindGroupLayout({ entries: [0, 1, 2, 3].map(b => ({ binding: b, visibility: 4 | 2, buffer: { type: b ? 'storage' : 'uniform' } })) });
    const layout = dev.createPipelineLayout({ bindGroupLayouts: [bgl] });
    const module = dev.createShaderModule({ code: COMMON + code });
    const cp = {}; for (const e of entries.concat('resolve')) cp[e] = dev.createComputePipeline({ layout, compute: { module, entryPoint: e } });
    const rp = dev.createRenderPipeline({ layout, vertex: { module, entryPoint: 'vs' }, fragment: { module, entryPoint: 'fs', targets: [{ format: fmt }] }, primitive: { topology: 'triangle-list' } });
    const bg = dev.createBindGroup({ layout: bgl, entries: [UB, PB, AB, TB].map((b, i) => ({ binding: i, resource: { buffer: b } })) });
    const ub = new ArrayBuffer(48), uf = new Float32Array(ub), uu = new Uint32Array(ub);
    const clear = { r: 0, g: 0, b: 0, a: 1 };
    return (v, passes) => {
      uf[0] = v.t; uf[1] = v.dt; uf[2] = v.fade; uf[3] = v.gain; uu[4] = v.n; uu[5] = v.frame; uf[6] = v.p0 || 0; uf[7] = v.p1 || 0; uf[8] = v.p2 || 0; uf[9] = v.p3 || 0;
      dev.queue.writeBuffer(UB, 0, ub);
      const enc = dev.createCommandEncoder(); const cpass = enc.beginComputePass(); cpass.setBindGroup(0, bg);
      for (const [e, n] of passes) { cpass.setPipeline(cp[e]); cpass.dispatchWorkgroups(Math.ceil(n / 256)); }
      cpass.setPipeline(cp.resolve); cpass.dispatchWorkgroups(Math.ceil(SW * SH / 256)); cpass.end();
      const rpass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: clear }] });
      rpass.setPipeline(rp); rpass.setBindGroup(0, bg); rpass.draw(3); rpass.end();
      dev.queue.submit([enc.finish()]);
    };
  }

  // ---------------- curl-noise flow, up to one million particles ----------------
  const FLOW = `
fn pal(h: f32) -> vec3f {
  var C = array<vec3f, 4>(vec3f(1., .35, .21), vec3f(1., .74, .32), vec3f(.32, .82, .95), vec3f(.58, .42, 1.));
  let k = fract(h) * 4.; let i = u32(k) % 4u; return mix(C[i], C[(i + 1u) % 4u], smoothstep(0., 1., fract(k)));
}
fn g3(i: vec3i, f: vec3f) -> f32 {
  let h = hash((u32(i.x) * 73856093u) ^ (u32(i.y) * 19349663u) ^ (u32(i.z) * 83492791u));
  return dot(vec3f(f32(h & 1023u), f32((h >> 10u) & 1023u), f32((h >> 20u) & 1023u)) / 511.5 - 1., f);
}
fn gn(p: vec3f) -> f32 {
  let i = vec3i(floor(p)); let f = fract(p); let w = f * f * f * (f * (f * 6. - 15.) + 10.);
  let a = mix(mix(g3(i, f), g3(i + vec3i(1, 0, 0), f - vec3f(1., 0., 0.)), w.x), mix(g3(i + vec3i(0, 1, 0), f - vec3f(0., 1., 0.)), g3(i + vec3i(1, 1, 0), f - vec3f(1., 1., 0.)), w.x), w.y);
  let b = mix(mix(g3(i + vec3i(0, 0, 1), f - vec3f(0., 0., 1.)), g3(i + vec3i(1, 0, 1), f - vec3f(1., 0., 1.)), w.x), mix(g3(i + vec3i(0, 1, 1), f - vec3f(0., 1., 1.)), g3(i + vec3i(1, 1, 1), f - vec3f(1., 1., 1.)), w.x), w.y);
  return mix(a, b, w.z);
}
fn pot(p: vec2f) -> f32 { let z = u.t * .09; return gn(vec3f(p * u.p0, z)) + .45 * gn(vec3f(p * u.p0 * 2.3 + 11.7, z * 1.6)); }
@compute @workgroup_size(256) fn step(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x; if (i >= u.n) { return; }
  var q = P[i];
  if (q.z <= 0. || u.frame == 0u) {
    let s = i * 3u + u.frame * 2654435761u;
    q = vec4f(rnd(s) * 680. - 20., rnd(s + 1u) * 400. - 20., 1.5 + rnd(s + 2u) * 4., 0.);
    if (u.frame == 0u) { q.z = rnd(s + 2u) * 5.5; }
  }
  let p = q.xy / 360.; let e = .003;
  let dx = (pot(p + vec2f(e, 0.)) - pot(p - vec2f(e, 0.))) / (2. * e);
  let dy = (pot(p + vec2f(0., e)) - pot(p - vec2f(0., e))) / (2. * e);
  let v = (vec2f(dy, -dx) - u.p2 * vec2f(dx, dy)) * u.p1 * 26.;
  let np = q.xy + v * u.dt;
  q = vec4f(np, q.z - u.dt, atan2(v.y, v.x) / 6.2831853 + .5);
  P[i] = q;
  splat(np, q.w);
}`;

  EX.add({
    cat: 'gpu', id: 'w2-flow-silk', title: 'WebGPU flow silk: a million particles', aka: 'compute shader particles, curl noise flow field, atomic splatting, compute rasterization', tool: 'WebGPU, WGSL compute shaders', runs: 'GPU',
    notice: 'Up to a million particles ride a curl-noise flow, all moved by one WGSL compute shader each frame. They are drawn without triangles: each particle adds 1 to its pixel with an atomic add, and the counts fade into silky trails colored by flow direction. Raise Gather and the flow pulls them into bright filaments.',
    use: 'hero backgrounds, data-flow visuals, showing what WebGPU compute can do',
    params: [{ key: 'n', label: 'Particles (thousands)', min: 50, max: 1000, step: 50, value: 1000 }, { key: 'scale', label: 'Noise scale', min: 0.8, max: 5, step: 0.1, value: 2.2, dec: 1 }, { key: 'speed', label: 'Flow speed', min: 0.2, max: 3, step: 0.1, value: 1.2, dec: 1 }, { key: 'gather', label: 'Gather into filaments', min: 0, max: 1.2, step: 0.05, value: 0.6, dec: 2 }],
    prompt: 'Live WebGPU hero background: {n} thousand particles moved by a WGSL compute shader through 2D curl noise (scale {scale}, speed {speed}) plus a gather term of {gather} that pulls them into glowing filaments. Rasterize in compute with atomic adds into a pixel buffer, fade it into trails, color by flow direction in coral, amber, cyan and violet on near-black with a soft glow. Show a clear message when WebGPU is missing.',
    setup(stage, L) {
      return boot(stage, L, (dev, ctx, fmt) => {
        const run = rig(dev, ctx, fmt, 1000000 * 16, FLOW, ['step']); let frame = 0;
        return {
          reset() { frame = 0; },
          frame(t, dt) {
            const n = Math.round(L.p.n) * 1000;
            run({ t, dt: Math.min(dt, 1 / 20), fade: frame ? 0.9 : 0, gain: 0.02 * Math.sqrt(1e6 / n), n, frame: frame++, p0: L.p.scale, p1: L.p.speed, p2: L.p.gather }, [['step', n]]);
          },
        };
      });
    },
  });


})();
