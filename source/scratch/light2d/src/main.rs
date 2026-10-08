// 2D spectral light tracer written from scratch with the Rust standard library only.
// Newton's prism experiment: a white beam splits in a turning prism and a lens bends the spectrum onto a screen.
// Every ray is drawn as an anti-aliased line, so the picture is the light itself moving through the plane.
//
//   light2d <out_dir> [--frames 240] [--rays 600000] [--from 0] [--every 1]
//
// Threads come from the THREADS environment variable (default 12). Writes PPM frames for FFmpeg.

use std::f32::consts::PI;
use std::io::Write;
use std::ops::{Add, Mul, Neg, Sub};
use std::time::Instant;

const W: usize = 1280;
const H: usize = 720;
const EPS: f32 = 1e-3;
const SX: f32 = 1214.0;
const SY0: f32 = 250.0;
const SY1: f32 = 690.0;
const BEAM_W: f32 = 14.0;

#[derive(Clone, Copy, Debug)]
struct P {
    x: f32,
    y: f32,
}
const fn p(x: f32, y: f32) -> P { P { x, y } }
impl Add for P {
    type Output = P;
    fn add(self, o: P) -> P { p(self.x + o.x, self.y + o.y) }
}
impl Sub for P {
    type Output = P;
    fn sub(self, o: P) -> P { p(self.x - o.x, self.y - o.y) }
}
impl Mul<f32> for P {
    type Output = P;
    fn mul(self, s: f32) -> P { p(self.x * s, self.y * s) }
}
impl Neg for P {
    type Output = P;
    fn neg(self) -> P { p(-self.x, -self.y) }
}
fn dot(a: P, b: P) -> f32 { a.x * b.x + a.y * b.y }
fn norm(a: P) -> P { a * (1.0 / dot(a, a).sqrt()) }
fn dir(a: f32) -> P { p(a.cos(), a.sin()) }

struct Rng(u64);
impl Rng {
    fn new(seed: u64) -> Rng {
        let mut r = Rng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ 0xD1B5_4A32_D192_ED03);
        r.next();
        r
    }
    fn next(&mut self) -> u32 {
        let old = self.0;
        self.0 = old.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        let xs = (((old >> 18) ^ old) >> 27) as u32;
        xs.rotate_right((old >> 59) as u32)
    }
    fn f(&mut self) -> f32 { (self.next() >> 8) as f32 * (1.0 / 16777216.0) }
}

// Convex glass body: an intersection of half-planes (prism) or of disks (lens).
// Its index is n(lambda) = ior + disp * (1 / lambda^2 - 1 / 0.55^2) with lambda in micrometers.
enum Shape {
    Poly(Vec<(P, P)>),
    Disks(Vec<(P, f32)>),
}
struct Body {
    shape: Shape,
    ior: f32,
    disp: f32,
}

// Entry and exit distances of a ray through a convex body, with the outward normals there.
fn interval(b: &Body, o: P, d: P) -> Option<(f32, P, f32, P)> {
    let (mut tin, mut tout) = (-1e30f32, 1e30f32);
    let (mut nin, mut nout) = (p(0.0, 0.0), p(0.0, 0.0));
    match &b.shape {
        Shape::Poly(edges) => {
            for &(a, n) in edges {
                let num = dot(n, o - a);
                let den = dot(n, d);
                if den.abs() < 1e-9 {
                    if num > 0.0 { return None; }
                    continue;
                }
                let t = -num / den;
                if den < 0.0 {
                    if t > tin { tin = t; nin = n; }
                } else if t < tout {
                    tout = t;
                    nout = n;
                }
            }
        }
        Shape::Disks(ds) => {
            for &(c, r) in ds {
                let oc = o - c;
                let bq = dot(oc, d);
                let disc = bq * bq - (dot(oc, oc) - r * r);
                if disc < 0.0 { return None; }
                let s = disc.sqrt();
                let (t0, t1) = (-bq - s, -bq + s);
                if t0 > tin { tin = t0; nin = (o + d * t0 - c) * (1.0 / r); }
                if t1 < tout { tout = t1; nout = (o + d * t1 - c) * (1.0 / r); }
            }
        }
    }
    if tin < tout { Some((tin, nin, tout, nout)) } else { None }
}

fn inside(b: &Body, q: P) -> f32 {
    // Signed distance (negative inside), exact enough for drawing the outlines.
    match &b.shape {
        Shape::Poly(edges) => edges.iter().map(|&(a, n)| dot(n, q - a)).fold(f32::MIN, f32::max),
        Shape::Disks(ds) => ds.iter().map(|&(c, r)| dot(q - c, q - c).sqrt() - r).fold(f32::MIN, f32::max),
    }
}

struct Scene {
    bodies: Vec<Body>,
    beam_o: P,
    beam_d: P,
}

fn smoother(t: f32) -> f32 { let t = t.clamp(0.0, 1.0); t * t * t * (t * (t * 6.0 - 15.0) + 10.0) }

// The set at time t: the prism turns back and forth; the lens rises into the fan between 2.6 and 4.4 s.
fn scene(t: f32) -> Scene {
    let phi = 0.13 * (2.0 * PI * (t - 1.0) / 7.0).sin();
    let c = p(500.0, 362.0);
    let r = 230.0 / 3f32.sqrt();
    let vs: Vec<P> = (0..3).map(|k| c + dir(phi - PI / 2.0 + k as f32 * 2.0 * PI / 3.0) * r).collect();
    let edges = (0..3).map(|k| {
        let (a, b) = (vs[k], vs[(k + 1) % 3]);
        let mid = (a + b) * 0.5;
        (a, norm(mid - c))
    }).collect();
    let prism = Body { shape: Shape::Poly(edges), ior: 1.52, disp: 0.055 };
    let ax = dir(0.27);
    let lc = p(870.0, 860.0 - 422.0 * smoother((t - 2.6) / 1.8));
    let lens = Body { shape: Shape::Disks(vec![(lc + ax * 122.0, 170.0), (lc - ax * 122.0, 170.0)]), ior: 1.5, disp: 0.004 };
    let a = -25f32.to_radians();
    Scene { bodies: vec![prism, lens], beam_o: p(-6.0, 537.0), beam_d: dir(a) }
}

// RGB weight of one wavelength (nm), scaled so the average over 400..700 nm is white.
fn spec_rgb(l: f32) -> [f32; 3] {
    fn g(x: f32, m: f32, s: f32) -> f32 { (-0.5 * ((x - m) / s).powi(2)).exp() }
    fn raw(l: f32) -> [f32; 3] { [g(l, 610.0, 34.0) + 0.3 * g(l, 415.0, 18.0), g(l, 540.0, 34.0), g(l, 455.0, 24.0)] }
    static NORM: std::sync::OnceLock<[f32; 3]> = std::sync::OnceLock::new();
    let s = NORM.get_or_init(|| {
        let mut s = [0f32; 3];
        for i in 0..300 {
            let r = raw(400.5 + i as f32);
            for k in 0..3 { s[k] += r[k] / 300.0; }
        }
        s
    });
    let r = raw(l);
    [r[0] / s[0], r[1] / s[1], r[2] / s[2]]
}

// Adds an anti-aliased line with constant brightness per unit length.
fn line(buf: &mut [f32], a: P, b: P, c: [f32; 3]) {
    let (dx, dy) = (b.x - a.x, b.y - a.y);
    if dx.abs() >= dy.abs() {
        if dx.abs() < 1e-6 { return; }
        let (a, b) = if a.x <= b.x { (a, b) } else { (b, a) };
        let g = (b.y - a.y) / (b.x - a.x);
        let w = (1.0 + g * g).sqrt();
        let x0 = (a.x - 0.5).ceil().max(0.0) as i32;
        let x1 = (b.x - 0.5).floor().min((W - 1) as f32) as i32;
        for x in x0..=x1 {
            let y = a.y + g * (x as f32 + 0.5 - a.x) - 0.5;
            let iy = y.floor() as i32;
            let fy = y - iy as f32;
            for (yy, wt) in [(iy, 1.0 - fy), (iy + 1, fy)] {
                if yy >= 0 && yy < H as i32 {
                    let i = (yy as usize * W + x as usize) * 3;
                    for k in 0..3 { buf[i + k] += c[k] * w * wt; }
                }
            }
        }
    } else {
        let (a, b) = if a.y <= b.y { (a, b) } else { (b, a) };
        let g = (b.x - a.x) / (b.y - a.y);
        let w = (1.0 + g * g).sqrt();
        let y0 = (a.y - 0.5).ceil().max(0.0) as i32;
        let y1 = (b.y - 0.5).floor().min((H - 1) as f32) as i32;
        for y in y0..=y1 {
            let x = a.x + g * (y as f32 + 0.5 - a.y) - 0.5;
            let ix = x.floor() as i32;
            let fx = x - ix as f32;
            for (xx, wt) in [(ix, 1.0 - fx), (ix + 1, fx)] {
                if xx >= 0 && xx < W as i32 {
                    let i = (y as usize * W + xx as usize) * 3;
                    for k in 0..3 { buf[i + k] += c[k] * w * wt; }
                }
            }
        }
    }
}

fn fresnel(ci: f32, ct: f32, eta: f32) -> f32 {
    let rs = (eta * ci - ct) / (eta * ci + ct);
    let rp = (ci - eta * ct) / (ci + eta * ct);
    0.5 * (rs * rs + rp * rp)
}

// Follows one ray of wavelength lam through the glass, drawing every segment; light that lands
// on the screen is also added to its strip.
// `budget` is how far the light has traveled since it was switched on.
fn trace(sc: &Scene, mut o: P, mut d: P, lam: f32, mut budget: f32, rng: &mut Rng, buf: &mut [f32], strip: &mut [f32]) {
    let col = spec_rgb(lam);
    let um = lam * 1e-3;
    for _ in 0..24 {
        let mut best = f32::MAX;
        let mut hit: Option<(usize, P, bool)> = None;
        for (bi, b) in sc.bodies.iter().enumerate() {
            if let Some((tin, nin, tout, nout)) = interval(b, o, d) {
                if tin > EPS && tin < best {
                    best = tin;
                    hit = Some((bi, nin, true));
                } else if tin <= EPS && tout > EPS && tout < best {
                    best = tout;
                    hit = Some((bi, nout, false));
                }
            }
        }
        let mut on_screen = false;
        if d.x > 0.0 {
            let t = (SX - o.x) / d.x;
            let y = o.y + d.y * t;
            if t > EPS && t < best && (SY0..=SY1).contains(&y) {
                best = t;
                on_screen = true;
                hit = None;
            }
        }
        if hit.is_none() && !on_screen {
            let tx = if d.x > 0.0 { (W as f32 + 4.0 - o.x) / d.x } else if d.x < 0.0 { (-4.0 - o.x) / d.x } else { f32::MAX };
            let ty = if d.y > 0.0 { (H as f32 + 4.0 - o.y) / d.y } else if d.y < 0.0 { (-4.0 - o.y) / d.y } else { f32::MAX };
            line(buf, o, o + d * tx.min(ty).max(0.0).min(budget), col);
            return;
        }
        if best > budget {
            line(buf, o, o + d * budget, col);
            return;
        }
        budget -= best;
        let q = o + d * best;
        line(buf, o, q, col);
        if on_screen {
            let iy = (q.y as usize).min(H - 1);
            for k in 0..3 { strip[iy * 3 + k] += col[k]; }
            return;
        }
        let (bi, n, entering) = hit.unwrap();
        let b = &sc.bodies[bi];
        let nl = b.ior + b.disp * (1.0 / (um * um) - 1.0 / 0.3025);
        let (eta, nf) = if entering { (1.0 / nl, n) } else { (nl, -n) };
        let ci = -dot(d, nf);
        let s2 = eta * eta * (1.0 - ci * ci);
        let fr = if s2 >= 1.0 { 1.0 } else { fresnel(ci, (1.0 - s2).sqrt(), eta) };
        if rng.f() < fr {
            d = norm(d - nf * (2.0 * dot(d, nf)));
        } else {
            let ct = (1.0 - s2).sqrt();
            d = norm(d * eta + nf * (eta * ci - ct));
        }
        o = q;
    }
}

// Separable Gaussian blur, used for the glow.
fn blur(img: &[f32], w: usize, h: usize, sigma: f32) -> Vec<f32> {
    let r = (sigma * 3.0) as i32;
    let k: Vec<f32> = (-r..=r).map(|i| (-(i * i) as f32 / (2.0 * sigma * sigma)).exp()).collect();
    let ks: f32 = k.iter().sum();
    let mut tmp = vec![0f32; w * h * 3];
    let mut out = vec![0f32; w * h * 3];
    for y in 0..h {
        for x in 0..w {
            for c in 0..3 {
                let mut s = 0.0;
                for i in -r..=r {
                    let xx = (x as i32 + i).clamp(0, w as i32 - 1) as usize;
                    s += img[(y * w + xx) * 3 + c] * k[(i + r) as usize];
                }
                tmp[(y * w + x) * 3 + c] = s / ks;
            }
        }
    }
    for y in 0..h {
        for x in 0..w {
            for c in 0..3 {
                let mut s = 0.0;
                for i in -r..=r {
                    let yy = (y as i32 + i).clamp(0, h as i32 - 1) as usize;
                    s += tmp[(yy * w + x) * 3 + c] * k[(i + r) as usize];
                }
                out[(y * w + x) * 3 + c] = s / ks;
            }
        }
    }
    out
}

fn render(t: f32, rays: usize, threads: usize, path: &str) {
    let sc = scene(t);
    let per = rays.div_ceil(threads);
    let perp = p(-sc.beam_d.y, sc.beam_d.x);
    let budget = 600.0 * t;
    let results: Vec<(Vec<f32>, Vec<f32>)> = std::thread::scope(|s| {
        let hs: Vec<_> = (0..threads).map(|k| {
            let sc = &sc;
            s.spawn(move || {
                let mut buf = vec![0f32; W * H * 3];
                let mut strip = vec![0f32; H * 3];
                let mut rng = Rng::new(7919 + k as u64);
                for j in 0..per {
                    let i = k * per + j;
                    if i >= rays { break; }
                    let u = (i as f32 + rng.f()) / rays as f32;
                    let lam = 400.0 + 300.0 * ((u * 7919.0).fract());
                    let off = (rng.f() - 0.5) * BEAM_W;
                    let ang = (rng.f() - 0.5) * 0.004;
                    let d = norm(sc.beam_d + perp * ang);
                    trace(sc, sc.beam_o + perp * off, d, lam, budget, &mut rng, &mut buf, &mut strip);
                }
                (buf, strip)
            })
        }).collect();
        hs.into_iter().map(|h| h.join().unwrap()).collect()
    });
    let mut acc = vec![0f32; W * H * 3];
    let mut strip = vec![0f32; H * 3];
    for (b, st) in &results {
        for i in 0..acc.len() { acc[i] += b[i]; }
        for i in 0..strip.len() { strip[i] += st[i]; }
    }
    let k = 1.1 * BEAM_W / rays as f32;
    for v in acc.iter_mut() { *v *= k; }
    // Quarter-resolution glow.
    let (qw, qh) = (W / 4, H / 4);
    let mut small = vec![0f32; qw * qh * 3];
    for y in 0..qh {
        for x in 0..qw {
            for c in 0..3 {
                let mut s = 0.0;
                for dy in 0..4 {
                    for dx in 0..4 { s += acc[((y * 4 + dy) * W + x * 4 + dx) * 3 + c]; }
                }
                small[(y * qw + x) * 3 + c] = s / 16.0;
            }
        }
    }
    let glow = blur(&small, qw, qh, 3.0);
    let glow2 = blur(&small, qw, qh, 10.0);
    // Screen strip: light per pixel row, softened a little.
    let mut sstrip = vec![0f32; H * 3];
    for y in 0..H {
        for c in 0..3 {
            let mut s = 0.0;
            let mut ws = 0.0;
            for d in -3i32..=3 {
                let yy = (y as i32 + d).clamp(0, H as i32 - 1) as usize;
                let wt = (-(d * d) as f32 / 4.0).exp();
                s += strip[yy * 3 + c] * wt;
                ws += wt;
            }
            sstrip[y * 3 + c] = s / ws * 3.0 * BEAM_W / rays as f32;
        }
    }
    let bg = [11.0 / 255.0, 11.0 / 255.0, 16.0 / 255.0];
    let cream = [0.96f32, 0.93, 0.86];
    let mut out = format!("P6\n{} {}\n255\n", W, H).into_bytes();
    for y in 0..H {
        for x in 0..W {
            let q = p(x as f32 + 0.5, y as f32 + 0.5);
            let (gx, gy) = ((q.x / 4.0 - 0.5).clamp(0.0, (qw - 1) as f32), (q.y / 4.0 - 0.5).clamp(0.0, (qh - 1) as f32));
            let gi = ((gy.round() as usize) * qw + gx.round() as usize) * 3;
            let vig = 1.0 - ((q.x / W as f32 - 0.5).powi(2) + (q.y / H as f32 - 0.5).powi(2)) * 0.5;
            let mut c = [0f32; 3];
            for ch in 0..3 {
                let l = acc[(y * W + x) * 3 + ch] + 0.35 * glow[gi + ch] + 0.25 * glow2[gi + ch];
                c[ch] = bg[ch] * vig + (1.0 - (-l * 1.6).exp());
            }
            // Glass: faint body and a thin cream outline.
            for b in &sc.bodies {
                let sd = inside(b, q);
                if sd < 0.0 { for ch in 0..3 { c[ch] += 0.022 * cream[ch]; } }
                let edge = (1.2 - sd.abs()).clamp(0.0, 1.0) * 0.38;
                for ch in 0..3 { c[ch] = c[ch] * (1.0 - edge) + cream[ch] * edge; }
            }
            // Screen: a thin bar that glows with the light it catches.
            if q.x > SX && q.x < SX + 7.0 && q.y > SY0 && q.y < SY1 {
                for ch in 0..3 { c[ch] = 0.10 * cream[ch] + (1.0 - (-sstrip[y * 3 + ch] * 1.5).exp()); }
            }
            let dz = (((x * 7 + y * 13) % 17) as f32 / 17.0 - 0.5) / 255.0;
            for ch in 0..3 { out.push(((c[ch] + dz).clamp(0.0, 1.0).powf(1.0 / 1.15) * 255.0).round() as u8); }
        }
    }
    std::fs::File::create(path).unwrap().write_all(&out).unwrap();
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let out = args.get(1).cloned().unwrap_or_else(|| "frames".into());
    let get = |k: &str, d: usize| -> usize {
        args.iter().position(|a| a == k).and_then(|i| args.get(i + 1)).and_then(|s| s.parse().ok()).unwrap_or(d)
    };
    let (frames, rays, from, every) = (get("--frames", 240), get("--rays", 600_000), get("--from", 0), get("--every", 1));
    let threads = std::env::var("THREADS").ok().and_then(|s| s.parse().ok()).unwrap_or(12usize);
    std::fs::create_dir_all(&out).unwrap();
    let t0 = Instant::now();
    for fr in (from..frames).step_by(every.max(1)) {
        render(fr as f32 / 30.0, rays, threads, &format!("{}/f_{:04}.ppm", out, fr));
        if fr % 30 == 0 { println!("frame {} at {:.1}s", fr, t0.elapsed().as_secs_f32()); }
    }
    println!("done {:.1}s", t0.elapsed().as_secs_f32());
}
