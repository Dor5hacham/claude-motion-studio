/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Spectral path tracer written from scratch with the Rust standard library only.
// Renders the "glass, gold and light" shot as PPM frames that FFmpeg turns into a video.
//
//   pathtracer <out_dir> [--w 1280] [--h 720] [--spp 32] [--from 0] [--to 210] [--fps 30]
//
// Threads come from the THREADS environment variable (default 12). Existing frames are skipped,
// so an interrupted render resumes where it stopped.

use std::f32::consts::PI;
use std::io::Write;
use std::ops::{Add, Div, Mul, Neg, Sub};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;

// ---------- math ----------

#[derive(Clone, Copy, Default, Debug)]
struct V {
    x: f32,
    y: f32,
    z: f32,
}
const fn v(x: f32, y: f32, z: f32) -> V {
    V { x, y, z }
}
const V0: V = v(0.0, 0.0, 0.0);
const V1: V = v(1.0, 1.0, 1.0);
impl Add for V {
    type Output = V;
    fn add(self, o: V) -> V { v(self.x + o.x, self.y + o.y, self.z + o.z) }
}
impl Sub for V {
    type Output = V;
    fn sub(self, o: V) -> V { v(self.x - o.x, self.y - o.y, self.z - o.z) }
}
impl Mul<f32> for V {
    type Output = V;
    fn mul(self, s: f32) -> V { v(self.x * s, self.y * s, self.z * s) }
}
impl Mul<V> for V {
    type Output = V;
    fn mul(self, o: V) -> V { v(self.x * o.x, self.y * o.y, self.z * o.z) }
}
impl Div<f32> for V {
    type Output = V;
    fn div(self, s: f32) -> V { self * (1.0 / s) }
}
impl Neg for V {
    type Output = V;
    fn neg(self) -> V { v(-self.x, -self.y, -self.z) }
}
fn dot(a: V, b: V) -> f32 { a.x * b.x + a.y * b.y + a.z * b.z }
fn cross(a: V, b: V) -> V { v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x) }
impl V {
    fn splat(s: f32) -> V { v(s, s, s) }
    fn len(self) -> f32 { dot(self, self).sqrt() }
    fn norm(self) -> V { self / self.len() }
    fn min(self, o: V) -> V { v(self.x.min(o.x), self.y.min(o.y), self.z.min(o.z)) }
    fn max(self, o: V) -> V { v(self.x.max(o.x), self.y.max(o.y), self.z.max(o.z)) }
    fn max_c(self) -> f32 { self.x.max(self.y).max(self.z) }
    fn min_c(self) -> f32 { self.x.min(self.y).min(self.z) }
    fn axis(self, i: usize) -> f32 { [self.x, self.y, self.z][i] }
    fn lum(self) -> f32 { 0.2126 * self.x + 0.7152 * self.y + 0.0722 * self.z }
}
fn lerp(a: V, b: V, t: f32) -> V { a + (b - a) * t }
fn smooth(t: f32) -> f32 { let t = t.clamp(0.0, 1.0); t * t * (3.0 - 2.0 * t) }
fn ease_io(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    if t < 0.5 { 4.0 * t * t * t } else { 1.0 - (-2.0 * t + 2.0).powi(3) / 2.0 }
}

// Orthonormal tangent frame around a unit normal (Duff et al. 2017).
fn onb(n: V) -> (V, V) {
    let s = if n.z >= 0.0 { 1.0 } else { -1.0 };
    let a = -1.0 / (s + n.z);
    let b = n.x * n.y * a;
    (v(1.0 + s * n.x * n.x * a, s * b, -s * n.x), v(b, s + n.y * n.y * a, -n.y))
}
fn to_world(n: V, l: V) -> V { let (t, b) = onb(n); t * l.x + b * l.y + n * l.z }
fn rot_y(p: V, a: f32) -> V { let (s, c) = a.sin_cos(); v(c * p.x + s * p.z, p.y, -s * p.x + c * p.z) }
fn rot_x(p: V, a: f32) -> V { let (s, c) = a.sin_cos(); v(p.x, c * p.y - s * p.z, s * p.y + c * p.z) }
fn rot_z(p: V, a: f32) -> V { let (s, c) = a.sin_cos(); v(c * p.x - s * p.y, s * p.x + c * p.y, p.z) }

// PCG32 random numbers, one stream per pixel.
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

// ---------- geometry ----------

#[derive(Clone, Copy)]
enum Shape {
    // Sphere moving linearly during the shutter: center(t) = c + vel * t.
    Sphere { c: V, vel: V, r: f32 },
    Tri { p0: V, e1: V, e2: V, n: [V; 3] },
}
#[derive(Clone, Copy)]
struct Prim {
    s: Shape,
    m: u16,
}
const EPS: f32 = 2e-4;

impl Prim {
    fn bounds(&self, shutter: f32) -> (V, V) {
        match self.s {
            Shape::Sphere { c, vel, r } => {
                let c1 = c + vel * shutter;
                (c.min(c1) - V::splat(r), c.max(c1) + V::splat(r))
            }
            Shape::Tri { p0, e1, e2, .. } => {
                let (p1, p2) = (p0 + e1, p0 + e2);
                (p0.min(p1).min(p2) - V::splat(1e-5), p0.max(p1).max(p2) + V::splat(1e-5))
            }
        }
    }
    fn hit(&self, o: V, d: V, time: f32, tmax: f32) -> Option<(f32, f32, f32)> {
        match self.s {
            Shape::Sphere { c, vel, r } => {
                let oc = o - (c + vel * time);
                let b = dot(oc, d);
                let disc = b * b - (dot(oc, oc) - r * r);
                if disc < 0.0 { return None; }
                let sq = disc.sqrt();
                let mut t = -b - sq;
                if t < EPS { t = -b + sq; }
                if t < EPS || t >= tmax { None } else { Some((t, 0.0, 0.0)) }
            }
            Shape::Tri { p0, e1, e2, .. } => {
                let pv = cross(d, e2);
                let det = dot(e1, pv);
                if det.abs() < 1e-10 { return None; }
                let inv = 1.0 / det;
                let tv = o - p0;
                let u = dot(tv, pv) * inv;
                if !(0.0..=1.0).contains(&u) { return None; }
                let qv = cross(tv, e1);
                let w = dot(d, qv) * inv;
                if w < 0.0 || u + w > 1.0 { return None; }
                let t = dot(e2, qv) * inv;
                if t > EPS && t < tmax { Some((t, u, w)) } else { None }
            }
        }
    }
    // Geometric and shading normals at a hit point.
    fn normals(&self, p: V, u: f32, w: f32, time: f32) -> (V, V) {
        match self.s {
            Shape::Sphere { c, vel, r } => { let n = (p - (c + vel * time)) / r; (n, n) }
            Shape::Tri { e1, e2, n, .. } => {
                let ng = cross(e1, e2).norm();
                let ns = (n[0] * (1.0 - u - w) + n[1] * u + n[2] * w).norm();
                (ng, ns)
            }
        }
    }
}

// ---------- BVH (binned SAH) ----------

#[derive(Clone, Copy, Default)]
struct Node {
    lo: V,
    hi: V,
    start: u32,
    count: u32,
    right: u32,
}
struct Bvh {
    nodes: Vec<Node>,
    idx: Vec<u32>,
}
fn area(lo: V, hi: V) -> f32 {
    let e = (hi - lo).max(V0);
    e.x * e.y + e.y * e.z + e.z * e.x
}

impl Bvh {
    fn build(prims: &[Prim], shutter: f32) -> Bvh {
        let bb: Vec<(V, V)> = prims.iter().map(|p| p.bounds(shutter)).collect();
        let cen: Vec<V> = bb.iter().map(|b| (b.0 + b.1) * 0.5).collect();
        let mut idx: Vec<u32> = (0..prims.len() as u32).collect();
        let mut nodes = Vec::with_capacity(prims.len() * 2);
        Self::split(&mut nodes, &mut idx, 0, &bb, &cen);
        Bvh { nodes, idx }
    }
    fn split(nodes: &mut Vec<Node>, idx: &mut [u32], base: usize, bb: &[(V, V)], cen: &[V]) -> u32 {
        let ni = nodes.len();
        nodes.push(Node::default());
        let (mut lo, mut hi) = (V::splat(f32::MAX), V::splat(-f32::MAX));
        let (mut clo, mut chi) = (lo, hi);
        for &i in idx.iter() {
            let i = i as usize;
            lo = lo.min(bb[i].0);
            hi = hi.max(bb[i].1);
            clo = clo.min(cen[i]);
            chi = chi.max(cen[i]);
        }
        nodes[ni].lo = lo;
        nodes[ni].hi = hi;
        let n = idx.len();
        let leaf = |nodes: &mut Vec<Node>| {
            nodes[ni].start = base as u32;
            nodes[ni].count = n as u32;
            ni as u32
        };
        if n <= 2 { return leaf(nodes); }
        const B: usize = 16;
        let mut best = (f32::MAX, 0usize, 0usize);
        for axis in 0..3 {
            let (a0, ext) = (clo.axis(axis), chi.axis(axis) - clo.axis(axis));
            if ext < 1e-7 { continue; }
            let mut bl = [(V::splat(f32::MAX), V::splat(-f32::MAX), 0u32); B];
            for &i in idx.iter() {
                let i = i as usize;
                let b = (((cen[i].axis(axis) - a0) / ext * B as f32) as usize).min(B - 1);
                bl[b].0 = bl[b].0.min(bb[i].0);
                bl[b].1 = bl[b].1.max(bb[i].1);
                bl[b].2 += 1;
            }
            let mut right_cost = [0f32; B];
            let (mut rlo, mut rhi, mut rc) = (V::splat(f32::MAX), V::splat(-f32::MAX), 0u32);
            for s in (1..B).rev() {
                rlo = rlo.min(bl[s].0);
                rhi = rhi.max(bl[s].1);
                rc += bl[s].2;
                right_cost[s] = if rc > 0 { area(rlo, rhi) * rc as f32 } else { 0.0 };
            }
            let (mut llo, mut lhi, mut lc) = (V::splat(f32::MAX), V::splat(-f32::MAX), 0u32);
            for s in 1..B {
                llo = llo.min(bl[s - 1].0);
                lhi = lhi.max(bl[s - 1].1);
                lc += bl[s - 1].2;
                if lc == 0 || lc as usize == n { continue; }
                let cost = area(llo, lhi) * lc as f32 + right_cost[s];
                if cost < best.0 { best = (cost, axis, s); }
            }
        }
        let leaf_cost = area(lo, hi) * n as f32;
        if best.0 >= leaf_cost && n <= 6 { return leaf(nodes); }
        let mut m;
        if best.0 < f32::MAX {
            let (axis, s) = (best.1, best.2);
            let (a0, ext) = (clo.axis(axis), chi.axis(axis) - clo.axis(axis));
            m = 0;
            for k in 0..n {
                let i = idx[k] as usize;
                let b = (((cen[i].axis(axis) - a0) / ext * B as f32) as usize).min(B - 1);
                if b < s { idx.swap(k, m); m += 1; }
            }
        } else {
            m = n / 2;
        }
        if m == 0 || m == n { m = n / 2; }
        let (l, r) = idx.split_at_mut(m);
        Self::split(nodes, l, base, bb, cen);
        let ri = Self::split(nodes, r, base + m, bb, cen);
        nodes[ni].right = ri;
        ni as u32
    }
    // Closest hit (or any hit when `any`) as (t, prim, u, w).
    fn intersect(&self, prims: &[Prim], o: V, d: V, time: f32, mut tmax: f32, any: bool) -> Option<(f32, u32, f32, f32)> {
        let inv = v(1.0 / d.x, 1.0 / d.y, 1.0 / d.z);
        let mut stack = [0u32; 64];
        let mut sp = 0usize;
        let mut ni = 0u32;
        let mut best = None;
        loop {
            let n = &self.nodes[ni as usize];
            if n.count > 0 {
                for k in n.start..n.start + n.count {
                    let pi = self.idx[k as usize];
                    if let Some((t, u, w)) = prims[pi as usize].hit(o, d, time, tmax) {
                        tmax = t;
                        best = Some((t, pi, u, w));
                        if any { return best; }
                    }
                }
            } else {
                let (l, r) = (ni + 1, n.right);
                let tl = slab(&self.nodes[l as usize], o, inv, tmax);
                let tr = slab(&self.nodes[r as usize], o, inv, tmax);
                match (tl, tr) {
                    (Some(a), Some(b)) => {
                        let (near, far) = if a <= b { (l, r) } else { (r, l) };
                        stack[sp] = far;
                        sp += 1;
                        ni = near;
                        continue;
                    }
                    (Some(_), None) => { ni = l; continue; }
                    (None, Some(_)) => { ni = r; continue; }
                    _ => {}
                }
            }
            if sp == 0 { break; }
            sp -= 1;
            ni = stack[sp];
        }
        best
    }
}
fn slab(n: &Node, o: V, inv: V, tmax: f32) -> Option<f32> {
    let t1 = (n.lo - o) * inv;
    let t2 = (n.hi - o) * inv;
    let tn = t1.min(t2).max_c().max(0.0);
    let tf = t1.max(t2).min_c().min(tmax);
    if tn <= tf { Some(tn) } else { None }
}

// ---------- materials ----------

#[derive(Clone, Copy)]
enum Mat {
    Diffuse(V),
    // Rough conductor: F0 color and GGX alpha.
    Metal { f0: V, a: f32 },
    // Diffuse base under a rough clear coat (the floor).
    Coat { alb: V, a: f32 },
    // Smooth dielectric. disp > 0 makes the index depend on wavelength (Cauchy).
    Glass { ior: f32, disp: f32 },
    Light(V),
}
const COAT_P: f32 = 0.35;

fn ggx_d(nh: f32, a2: f32) -> f32 { let d = nh * nh * (a2 - 1.0) + 1.0; a2 / (PI * d * d) }
fn ggx_g1(nv: f32, a2: f32) -> f32 { 2.0 * nv / (nv + (a2 + (1.0 - a2) * nv * nv).sqrt()) }
fn schlick(f0: V, c: f32) -> V { f0 + (V1 - f0) * (1.0 - c).max(0.0).powi(5) }
fn reflect(d: V, n: V) -> V { d - n * (2.0 * dot(d, n)) }

fn cos_sample(rng: &mut Rng) -> V {
    let (u1, u2) = (rng.f(), rng.f());
    let r = u1.sqrt();
    let phi = 2.0 * PI * u2;
    v(r * phi.cos(), r * phi.sin(), (1.0 - u1).max(0.0).sqrt())
}
fn ggx_h(n: V, a: f32, rng: &mut Rng) -> V {
    let (u1, u2) = (rng.f(), rng.f());
    let a2 = a * a;
    let ct = ((1.0 - u1) / (1.0 + (a2 - 1.0) * u1)).sqrt();
    let st = (1.0 - ct * ct).max(0.0).sqrt();
    let phi = 2.0 * PI * u2;
    to_world(n, v(st * phi.cos(), st * phi.sin(), ct))
}
// GGX reflection: returns (f * cos, pdf of sampling wi through the half vector).
fn spec_eval(n: V, wo: V, wi: V, a: f32, f0: V) -> (V, f32) {
    let h = (wo + wi).norm();
    let (nh, vh) = (dot(n, h).max(0.0), dot(wo, h).max(1e-6));
    let (nl, nv) = (dot(n, wi), dot(n, wo));
    let a2 = a * a;
    let d = ggx_d(nh, a2);
    let g = ggx_g1(nv, a2) * ggx_g1(nl, a2);
    (schlick(f0, vh) * (d * g / (4.0 * nv)), d * nh / (4.0 * vh))
}
// BSDF value times cosine, and the pdf `sample` would use for wi.
fn eval(m: &Mat, n: V, wo: V, wi: V) -> (V, f32) {
    let (nl, nv) = (dot(n, wi), dot(n, wo));
    if nl <= 0.0 || nv <= 0.0 { return (V0, 0.0); }
    match *m {
        Mat::Diffuse(a) => (a * (nl / PI), nl / PI),
        Mat::Metal { f0, a } => spec_eval(n, wo, wi, a, f0),
        Mat::Coat { alb, a } => {
            let (fs, ps) = spec_eval(n, wo, wi, a, V::splat(0.04));
            let kd = 1.0 - schlick(V::splat(0.04), nv).x;
            (fs + alb * (kd * nl / PI), COAT_P * ps + (1.0 - COAT_P) * nl / PI)
        }
        _ => (V0, 0.0),
    }
}
// Samples a direction: (wi, f*cos/pdf, pdf).
fn sample(m: &Mat, n: V, wo: V, rng: &mut Rng) -> Option<(V, V, f32)> {
    let wi = match *m {
        Mat::Diffuse(a) => {
            let wi = to_world(n, cos_sample(rng));
            return Some((wi, a, dot(n, wi).max(1e-6) / PI));
        }
        Mat::Metal { a, .. } => reflect(-wo, ggx_h(n, a, rng)),
        Mat::Coat { a, .. } => {
            if rng.f() < COAT_P { reflect(-wo, ggx_h(n, a, rng)) } else { to_world(n, cos_sample(rng)) }
        }
        _ => return None,
    };
    let (f, pdf) = eval(m, n, wo, wi);
    if pdf <= 1e-8 { return None; }
    Some((wi, f / pdf, pdf))
}
fn albedo(m: &Mat) -> V {
    match *m {
        Mat::Diffuse(a) => a,
        Mat::Metal { f0, .. } => f0,
        Mat::Coat { alb, .. } => alb + V::splat(0.04),
        Mat::Glass { .. } => V1,
        Mat::Light(e) => e / e.max_c(),
    }
}
fn fresnel_dielectric(ci: f32, ct: f32, eta: f32) -> f32 {
    let rs = (eta * ci - ct) / (eta * ci + ct);
    let rp = (ci - eta * ct) / (ci + eta * ct);
    0.5 * (rs * rs + rp * rp)
}

// RGB weight of one wavelength (nm), scaled so the average over 380..720 nm is white.
fn spec_rgb(lam: f32) -> V {
    fn g(x: f32, m: f32, s: f32) -> f32 { (-0.5 * ((x - m) / s).powi(2)).exp() }
    fn raw(l: f32) -> V { v(g(l, 605.0, 38.0) + 0.22 * g(l, 430.0, 18.0), g(l, 545.0, 38.0), g(l, 455.0, 28.0)) }
    static NORM: OnceLock<V> = OnceLock::new();
    let k = *NORM.get_or_init(|| {
        let mut s = V0;
        for i in 0..340 { s = s + raw(380.5 + i as f32); }
        let m = s / 340.0;
        v(1.0 / m.x, 1.0 / m.y, 1.0 / m.z)
    });
    raw(lam) * k
}

// ---------- scene ----------

struct Light {
    prim: u32,
    cdf: f32,
    p: f32,
}
struct Scene {
    prims: Vec<Prim>,
    mats: Vec<Mat>,
    lights: Vec<Light>,
    light_of: Vec<i32>,
    bvh: Bvh,
}

impl Scene {
    fn new(prims: Vec<Prim>, mats: Vec<Mat>, shutter: f32) -> Scene {
        let mut lights = Vec::new();
        let mut light_of = vec![-1; prims.len()];
        let mut total = 0.0;
        for (i, p) in prims.iter().enumerate() {
            if let Mat::Light(e) = mats[p.m as usize] {
                let a = match p.s {
                    Shape::Sphere { r, .. } => PI * r * r,
                    Shape::Tri { e1, e2, .. } => 0.5 * cross(e1, e2).len(),
                };
                let w = e.lum() * a;
                total += w;
                light_of[i] = lights.len() as i32;
                lights.push(Light { prim: i as u32, cdf: total, p: w });
            }
        }
        for l in lights.iter_mut() {
            l.cdf /= total;
            l.p /= total;
        }
        let bvh = Bvh::build(&prims, shutter);
        Scene { prims, mats, lights, light_of, bvh }
    }
    // Picks a light by power and a point on it: (wi, distance, radiance, solid-angle pdf).
    fn sample_light(&self, p: V, time: f32, rng: &mut Rng) -> Option<(V, f32, V, f32)> {
        let u = rng.f();
        let k = self.lights.iter().position(|l| u < l.cdf).unwrap_or(self.lights.len() - 1);
        let l = &self.lights[k];
        let pr = &self.prims[l.prim as usize];
        let Mat::Light(e) = self.mats[pr.m as usize] else { return None };
        match pr.s {
            Shape::Tri { p0, e1, e2, .. } => {
                let (mut a, mut b) = (rng.f(), rng.f());
                if a + b > 1.0 { a = 1.0 - a; b = 1.0 - b; }
                let q = p0 + e1 * a + e2 * b;
                let c = cross(e1, e2);
                let ar = 0.5 * c.len();
                let nl = c / (2.0 * ar);
                let dv = q - p;
                let d2 = dot(dv, dv);
                let dist = d2.sqrt();
                let wi = dv / dist;
                let cl = -dot(nl, wi);
                if cl <= 1e-4 { return None; }
                Some((wi, dist, e, l.p * d2 / (cl * ar)))
            }
            Shape::Sphere { c, vel, r } => {
                let cc = c + vel * time;
                let dc = cc - p;
                let d2 = dot(dc, dc);
                if d2 <= r * r { return None; }
                let cmax = (1.0 - r * r / d2).max(0.0).sqrt();
                let ct = 1.0 - rng.f() * (1.0 - cmax);
                let st = (1.0 - ct * ct).max(0.0).sqrt();
                let phi = 2.0 * PI * rng.f();
                let wi = to_world(dc / d2.sqrt(), v(st * phi.cos(), st * phi.sin(), ct));
                let oc = p - cc;
                let b = dot(oc, wi);
                let disc = (b * b - (dot(oc, oc) - r * r)).max(0.0);
                let dist = -b - disc.sqrt();
                Some((wi, dist, e, l.p / (2.0 * PI * (1.0 - cmax).max(1e-7))))
            }
        }
    }
    // Solid-angle pdf that sample_light would give for a BSDF ray from o that hit light prim pi at distance t.
    fn light_pdf(&self, pi: u32, o: V, d: V, t: f32, time: f32) -> f32 {
        let k = self.light_of[pi as usize];
        if k < 0 { return 0.0; }
        let sel = self.lights[k as usize].p;
        match self.prims[pi as usize].s {
            Shape::Tri { e1, e2, .. } => {
                let c = cross(e1, e2);
                let ar = 0.5 * c.len();
                let cl = -dot(c / (2.0 * ar), d);
                if cl <= 1e-4 { 0.0 } else { sel * t * t / (cl * ar) }
            }
            Shape::Sphere { c, vel, r } => {
                let dc = c + vel * time - o;
                let d2 = dot(dc, dc);
                if d2 <= r * r { return 0.0; }
                let cmax = (1.0 - r * r / d2).max(0.0).sqrt();
                sel / (2.0 * PI * (1.0 - cmax).max(1e-7))
            }
        }
    }
}

fn env(d: V) -> V {
    let t = smooth(0.5 * (d.y + 1.0));
    lerp(v(0.002, 0.002, 0.003), v(0.010, 0.012, 0.026), t)
}

struct Feat {
    alb: V,
    nrm: V,
}
const MAX_DEPTH: usize = 10;
const CLAMP: f32 = 12.0;

fn clampv(c: V) -> V { let m = c.max_c(); if m > CLAMP { c * (CLAMP / m) } else { c } }

// One path sample. Fills the denoiser features from the first non-glass hit.
fn radiance(sc: &Scene, mut o: V, mut d: V, time: f32, rng: &mut Rng, ft: &mut Feat) -> V {
    let mut l = V0;
    let mut thr = V1;
    let mut lam = 0.0f32;
    let mut spec = true;
    let mut pdf_prev = 1.0f32;
    let mut feat = false;
    for depth in 0..MAX_DEPTH {
        let Some((t, pi, u, w)) = sc.bvh.intersect(&sc.prims, o, d, time, f32::MAX, false) else {
            l = l + thr * env(d);
            if !feat { ft.alb = V0; ft.nrm = V0; }
            break;
        };
        let prim = &sc.prims[pi as usize];
        let p = o + d * t;
        let (ng, ns) = prim.normals(p, u, w, time);
        let front = dot(ng, d) < 0.0;
        let m = sc.mats[prim.m as usize];
        if let Mat::Light(e) = m {
            let lit = matches!(prim.s, Shape::Sphere { .. }) || front;
            if lit {
                let mut c = thr * e;
                if !spec {
                    let lp = sc.light_pdf(pi, o, d, t, time);
                    c = c * (pdf_prev * pdf_prev / (pdf_prev * pdf_prev + lp * lp));
                }
                l = l + if depth > 0 { clampv(c) } else { c };
            }
            if !feat { ft.alb = albedo(&m); ft.nrm = if front { ns } else { -ns }; }
            break;
        }
        let gf = if front { ng } else { -ng };
        if let Mat::Glass { ior, disp } = m {
            let mut n_l = ior;
            if disp > 0.0 {
                if lam == 0.0 {
                    lam = 380.0 + 340.0 * rng.f();
                    thr = thr * spec_rgb(lam);
                }
                let um = lam * 1e-3;
                n_l = ior + disp * (1.0 / (um * um) - 1.0 / 0.3025);
            }
            let ci = -dot(d, gf);
            let eta = if front { 1.0 / n_l } else { n_l };
            let s2 = eta * eta * (1.0 - ci * ci);
            let fr = if s2 >= 1.0 { 1.0 } else { fresnel_dielectric(ci, (1.0 - s2).sqrt(), eta) };
            if rng.f() < fr {
                d = reflect(d, gf);
                o = p + gf * EPS;
            } else {
                let ct = (1.0 - s2).sqrt();
                d = (d * eta + gf * (eta * ci - ct)).norm();
                o = p - gf * EPS;
            }
            spec = true;
            continue;
        }
        let nf = if dot(ns, gf) > 0.0 { ns } else { gf };
        if !feat { ft.alb = albedo(&m); ft.nrm = nf; feat = true; }
        let wo = -d;
        let so = p + gf * EPS;
        if let Some((wi, dist, le, lpdf)) = sc.sample_light(p, time, rng) {
            if dot(wi, gf) > 0.0 && lpdf > 0.0 {
                let (f, bpdf) = eval(&m, nf, wo, wi);
                if bpdf > 0.0 && f.max_c() > 0.0
                    && sc.bvh.intersect(&sc.prims, so, wi, time, dist - 2.0 * EPS, true).is_none()
                {
                    let c = thr * f * le * (lpdf / (lpdf * lpdf + bpdf * bpdf));
                    l = l + if depth > 0 { clampv(c) } else { c };
                }
            }
        }
        let Some((wi, wt, pdf)) = sample(&m, nf, wo, rng) else { break };
        if dot(wi, gf) <= 0.0 { break; }
        thr = thr * wt;
        pdf_prev = pdf;
        spec = false;
        o = so;
        d = wi;
        if depth >= 3 {
            let q = thr.max_c().min(0.95);
            if rng.f() > q { break; }
            thr = thr / q;
        }
    }
    l
}

// ---------- shot ----------

struct Cam {
    o: V,
    u: V,
    w: V,
    vv: V,
    hw: f32,
    hh: f32,
    ap: f32,
    fd: f32,
}

const GOLD_C: V = v(0.0, 0.72, 0.0);
const PRISM_C: V = v(-1.3, 0.0, 1.05);
const GEM_C: V = v(0.95, 0.42, 1.25);

fn quad(prims: &mut Vec<Prim>, c: V, ax: V, ay: V, m: u16) {
    // Rectangle centered at c with half axes ax, ay; it faces along ax x ay.
    let (a, b, cc, d) = (c - ax - ay, c + ax - ay, c + ax + ay, c - ax + ay);
    tri(prims, a, b, cc, m);
    tri(prims, a, cc, d, m);
}
fn tri(prims: &mut Vec<Prim>, a: V, b: V, c: V, m: u16) {
    let n = cross(b - a, c - a).norm();
    prims.push(Prim { s: Shape::Tri { p0: a, e1: b - a, e2: c - a, n: [n; 3] }, m });
}
fn tri_n(prims: &mut Vec<Prim>, a: (V, V), b: (V, V), c: (V, V), m: u16) {
    prims.push(Prim { s: Shape::Tri { p0: a.0, e1: b.0 - a.0, e2: c.0 - a.0, n: [a.1, b.1, c.1] }, m });
}
fn sphere(prims: &mut Vec<Prim>, c: V, vel: V, r: f32, m: u16) {
    prims.push(Prim { s: Shape::Sphere { c, vel, r }, m });
}

// Icosphere with one subdivision, flat facets: the cut gem.
fn gem(prims: &mut Vec<Prim>, c: V, r: f32, rot: f32, m: u16) {
    let t = (1.0 + 5f32.sqrt()) / 2.0;
    let vs = [
        v(-1.0, t, 0.0), v(1.0, t, 0.0), v(-1.0, -t, 0.0), v(1.0, -t, 0.0),
        v(0.0, -1.0, t), v(0.0, 1.0, t), v(0.0, -1.0, -t), v(0.0, 1.0, -t),
        v(t, 0.0, -1.0), v(t, 0.0, 1.0), v(-t, 0.0, -1.0), v(-t, 0.0, 1.0),
    ];
    let fs = [
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];
    let place = |p: V| {
        let p = p.norm();
        let p = v(p.x, p.y * 0.82, p.z);
        c + rot_x(rot_y(p, rot), 0.35) * r
    };
    for f in fs {
        let (a, b, cc) = (vs[f[0]], vs[f[1]], vs[f[2]]);
        let (ab, bc, ca) = ((a + b) * 0.5, (b + cc) * 0.5, (cc + a) * 0.5);
        for t3 in [[a, ab, ca], [ab, b, bc], [ca, bc, cc], [ab, bc, ca]] {
            tri(prims, place(t3[0]), place(t3[1]), place(t3[2]), m);
        }
    }
}

// Upright triangular glass prism standing on the floor, turned by `yaw` about its vertical axis.
fn prism(prims: &mut Vec<Prim>, c: V, side: f32, hgt: f32, yaw: f32, m: u16) {
    let r = side / 3f32.sqrt();
    let cs: Vec<V> = (0..3).map(|k| { let a = yaw + k as f32 * 2.0 * PI / 3.0; v(a.cos() * r, 0.0, a.sin() * r) }).collect();
    let p = |k: usize, y: f32| c + cs[k] + v(0.0, y, 0.0);
    tri(prims, p(0, hgt), p(2, hgt), p(1, hgt), m);
    tri(prims, p(0, 0.0), p(1, 0.0), p(2, 0.0), m);
    for k in 0..3 {
        let j = (k + 1) % 3;
        tri(prims, p(k, 0.0), p(k, hgt), p(j, hgt), m);
        tri(prims, p(k, 0.0), p(j, hgt), p(j, 0.0), m);
    }
}

// Upright torus with smooth normals, spun about the vertical axis.
fn torus(prims: &mut Vec<Prim>, c: V, rr: f32, r: f32, spin: f32, m: u16) {
    let (nu, nv) = (72, 28);
    let pt = |i: usize, j: usize| {
        let (a, b) = (2.0 * PI * i as f32 / nu as f32, 2.0 * PI * j as f32 / nv as f32);
        let dir = v(a.cos(), a.sin(), 0.0);
        let n = dir * b.cos() + v(0.0, 0.0, b.sin());
        let p = dir * rr + n * r;
        let tf = |q: V| rot_y(rot_z(q, 0.3), spin);
        (c + tf(p), tf(n))
    };
    for i in 0..nu {
        for j in 0..nv {
            let (a, b, cc, d) = (pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1));
            tri_n(prims, a, b, cc, m);
            tri_n(prims, a, cc, d, m);
        }
    }
}

// Builds the scene and camera at time ts (seconds).
fn shot(ts: f32, dur: f32, aspect: f32) -> (Vec<Prim>, Vec<Mat>, Cam) {
    let mats = vec![
        Mat::Coat { alb: v(0.045, 0.045, 0.055), a: 0.07 },              // 0 floor
        Mat::Metal { f0: v(1.0, 0.74, 0.32), a: 0.16 },                // 1 gold
        Mat::Metal { f0: v(0.95, 0.55, 0.42), a: 0.32 },               // 2 rough copper
        Mat::Glass { ior: 1.52, disp: 0.045 },                         // 3 flint prism
        Mat::Glass { ior: 2.0, disp: 0.05 },                           // 4 gem
        Mat::Light(v(1.0, 0.92, 0.82) * 5.0),                          // 5 key softbox
        Mat::Light(v(1.0, 0.33, 0.20) * 9.0),                          // 6 coral bar
        Mat::Light(v(0.25, 0.80, 1.0) * 8.0),                          // 7 cyan bar
        Mat::Light(v(1.0, 0.90, 0.75) * 9.0),                          // 8 cream bar
        Mat::Light(v(1.0, 0.36, 0.20) * 22.0),                         // 9 coral orbiter
        Mat::Light(v(0.30, 0.85, 1.0) * 20.0),                         // 10 cyan orbiter
        Mat::Light(v(1.0, 0.72, 0.25) * 22.0),                         // 11 amber orbiter
        Mat::Diffuse(v(0.05, 0.05, 0.06)),                             // 12 back wall
    ];
    let mut p = Vec::new();
    quad(&mut p, v(0.0, 0.0, 0.0), v(0.0, 0.0, 30.0), v(30.0, 0.0, 0.0), 0);
    quad(&mut p, v(0.0, 4.0, -6.0), v(30.0, 0.0, 0.0), v(0.0, 4.0, 0.0), 12);
    quad(&mut p, v(-0.6, 4.2, 1.6), v(1.3, 0.0, 0.0), v(0.0, 0.0, 0.7), 5);
    // Neon bars behind the set, facing the camera.
    for (k, x) in [-3.2f32, -1.9, -0.6, 0.7, 2.0, 3.3].iter().enumerate() {
        let m = [6u16, 8, 7, 6, 8, 7][k];
        let hgt = [1.3f32, 1.6, 1.1, 1.5, 1.2, 1.4][k];
        quad(&mut p, v(*x, hgt + 0.05, -3.4), v(0.045, 0.0, 0.0), v(0.0, hgt, 0.0), m);
    }

    sphere(&mut p, GOLD_C, V0, 0.72, 1);
    torus(&mut p, v(2.05, 0.71, -0.7), 0.52, 0.17, 0.6 + ts * 0.55, 2);
    prism(&mut p, PRISM_C, 0.62, 1.2, 0.4 + ts * 0.32, 3);
    gem(&mut p, GEM_C, 0.36, ts * 0.45, 4);

    // Three emissive moons on tilted orbits; each moves during the shutter (motion blur).
    let orb = |ph: f32, tilt: f32, spd: f32, rad: f32, t: f32| {
        let a = ph + spd * t;
        GOLD_C + rot_z(rot_x(v(a.cos() * rad, 0.0, a.sin() * rad), tilt), tilt * 0.6)
    };
    for (k, (ph, tilt, spd, rad, m)) in [(0.0f32, 0.35f32, 3.6f32, 1.12f32, 9u16), (2.1, -0.5, 3.1, 1.2, 10), (4.2, 0.15, 4.0, 1.06, 11)].iter().enumerate() {
        let c = orb(*ph, *tilt, *spd, *rad, ts);
        let c2 = orb(*ph, *tilt, *spd, *rad, ts + 0.01);
        let r = [0.065f32, 0.06, 0.055][k];
        sphere(&mut p, c, (c2 - c) / 0.01, r, *m);
    }

    // Camera: slow arc from left to right with a focus pull from the prism to the gold sphere.
    let k = ease_io(ts / dur);
    let o = lerp(v(-1.9, 1.2, 4.9), v(1.6, 0.95, 4.7), k);
    let at = lerp(v(-0.45, 0.6, 0.3), v(0.3, 0.6, 0.0), k);
    let w = (o - at).norm();
    let u = cross(v(0.0, 1.0, 0.0), w).norm();
    let vv = cross(w, u);
    let pull = smooth((ts / dur - 0.30) / 0.4);
    let fd = lerp(PRISM_C + v(0.0, 0.6, 0.0) - o, GOLD_C - o, pull).len();
    let hh = (30f32.to_radians() / 2.0).tan();
    let cam = Cam { o, u, w, vv, hw: hh * aspect, hh, ap: 0.075, fd };
    (p, mats, cam)
}

// ---------- denoise and output ----------

// Edge-avoiding a-trous wavelet filter guided by normals, albedo and per-pixel variance (SVGF style).
fn denoise(col: &mut Vec<V>, var: &mut Vec<f32>, alb: &[V], nrm: &[V], w: usize, h: usize, threads: usize) {
    let kern = [1.0f32 / 16.0, 1.0 / 4.0, 3.0 / 8.0, 1.0 / 4.0, 1.0 / 16.0];
    let mut vb = vec![0f32; w * h];
    for y in 0..h {
        for x in 0..w {
            let mut s = 0.0;
            let mut ws = 0.0;
            for dy in -1i32..=1 {
                for dx in -1i32..=1 {
                    let (xx, yy) = (x as i32 + dx, y as i32 + dy);
                    if xx < 0 || yy < 0 || xx >= w as i32 || yy >= h as i32 { continue; }
                    let k = if dx == 0 && dy == 0 { 4.0 } else if dx == 0 || dy == 0 { 2.0 } else { 1.0 };
                    s += var[yy as usize * w + xx as usize] * k;
                    ws += k;
                }
            }
            vb[y * w + x] = s / ws;
        }
    }
    *var = vb;
    for it in 0..5 {
        let step = 1i32 << it;
        let mut out = vec![V0; w * h];
        let mut ovar = vec![0f32; w * h];
        {
            let rows = Mutex::new(out.chunks_mut(w).zip(ovar.chunks_mut(w)).enumerate());
            let (cin, vin) = (&*col, &*var);
            std::thread::scope(|s| {
                for _ in 0..threads {
                    s.spawn(|| loop {
                        let job = rows.lock().unwrap().next();
                        let Some((y, (oc, ov))) = job else { break };
                        for x in 0..w {
                            let i = y * w + x;
                            let (cp, np, ap) = (cin[i], nrm[i], alb[i]);
                            let lp = cp.lum();
                            let sl = 4.0 * vin[i].max(0.0).sqrt() + 1e-3;
                            let (mut sc, mut sv, mut sw) = (V0, 0.0f32, 0.0f32);
                            for dy in -2i32..=2 {
                                let yy = y as i32 + dy * step;
                                if yy < 0 || yy >= h as i32 { continue; }
                                for dx in -2i32..=2 {
                                    let xx = x as i32 + dx * step;
                                    if xx < 0 || xx >= w as i32 { continue; }
                                    let j = yy as usize * w + xx as usize;
                                    let hk = kern[(dx + 2) as usize] * kern[(dy + 2) as usize];
                                    let wn = dot(np, nrm[j]).max(0.0).powi(32);
                                    let da = ap - alb[j];
                                    let wa = (-dot(da, da) * 40.0).exp();
                                    let wl = (-(lp - cin[j].lum()).abs() / sl).exp();
                                    let wt = if j == i { hk } else { hk * wn * wa * wl };
                                    sc = sc + cin[j] * wt;
                                    sv += wt * wt * vin[j];
                                    sw += wt;
                                }
                            }
                            oc[x] = sc / sw;
                            ov[x] = sv / (sw * sw);
                        }
                    });
                }
            });
        }
        *col = out;
        *var = ovar;
    }
}

// Separable Gaussian blur on a small buffer, used for bloom.
fn blur(img: &[V], w: usize, h: usize, sigma: f32) -> Vec<V> {
    let r = (sigma * 3.0) as i32;
    let k: Vec<f32> = (-r..=r).map(|i| (-(i * i) as f32 / (2.0 * sigma * sigma)).exp()).collect();
    let ks: f32 = k.iter().sum();
    let mut tmp = vec![V0; w * h];
    for y in 0..h {
        for x in 0..w {
            let mut s = V0;
            for i in -r..=r {
                let xx = (x as i32 + i).clamp(0, w as i32 - 1) as usize;
                s = s + img[y * w + xx] * k[(i + r) as usize];
            }
            tmp[y * w + x] = s / ks;
        }
    }
    let mut out = vec![V0; w * h];
    for y in 0..h {
        for x in 0..w {
            let mut s = V0;
            for i in -r..=r {
                let yy = (y as i32 + i).clamp(0, h as i32 - 1) as usize;
                s = s + tmp[yy * w + x] * k[(i + r) as usize];
            }
            out[y * w + x] = s / ks;
        }
    }
    out
}

fn aces(x: f32) -> f32 { ((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)).clamp(0.0, 1.0) }
fn srgb(x: f32) -> f32 { if x <= 0.0031308 { 12.92 * x } else { 1.055 * x.powf(1.0 / 2.4) - 0.055 } }

// Bloom, filmic tone map, sRGB and dither, then write a binary PPM.
fn write_frame(path: &str, col: &[V], w: usize, h: usize, seed: u64) {
    let (bw, bh) = (w / 4, h / 4);
    let mut small = vec![V0; bw * bh];
    for y in 0..bh {
        for x in 0..bw {
            let mut s = V0;
            for dy in 0..4 {
                for dx in 0..4 {
                    let c = col[(y * 4 + dy) * w + x * 4 + dx];
                    s = s + (c - V::splat(1.2)).max(V0);
                }
            }
            small[y * bw + x] = s / 16.0;
        }
    }
    let b1 = blur(&small, bw, bh, 3.0);
    let b2 = blur(&small, bw, bh, 12.0);
    let mut rng = Rng::new(seed);
    let mut buf = format!("P6\n{} {}\n255\n", w, h).into_bytes();
    for y in 0..h {
        for x in 0..w {
            let (sx, sy) = (((x as f32 + 0.5) / 4.0 - 0.5).clamp(0.0, (bw - 1) as f32), ((y as f32 + 0.5) / 4.0 - 0.5).clamp(0.0, (bh - 1) as f32));
            let (x0, y0) = (sx as usize, sy as usize);
            let (x1, y1) = ((x0 + 1).min(bw - 1), (y0 + 1).min(bh - 1));
            let (fx, fy) = (sx - x0 as f32, sy - y0 as f32);
            let bil = |b: &[V]| lerp(lerp(b[y0 * bw + x0], b[y0 * bw + x1], fx), lerp(b[y1 * bw + x0], b[y1 * bw + x1], fx), fy);
            let c = col[y * w + x] + bil(&b1) * 0.10 + bil(&b2) * 0.12;
            let c = c * 1.15;
            for ch in [c.x, c.y, c.z] {
                let s = srgb(aces(ch)) * 255.0 + rng.f() - 0.5;
                buf.push(s.round().clamp(0.0, 255.0) as u8);
            }
        }
    }
    std::fs::File::create(path).unwrap().write_all(&buf).unwrap();
}

fn render(fr: usize, w: usize, h: usize, spp: usize, fps: f32, dur: f32, threads: usize, path: &str) {
    let ts = fr as f32 / fps;
    let shutter = 1.0 / fps;
    let (prims, mats, cam) = shot(ts, dur, w as f32 / h as f32);
    let sc = Scene::new(prims, mats, shutter);
    let n = w * h;
    let mut col = vec![V0; n];
    let mut var = vec![0f32; n];
    let mut alb = vec![V0; n];
    let mut nrm = vec![V0; n];
    {
        let rows = Mutex::new(col.chunks_mut(w).zip(var.chunks_mut(w)).zip(alb.chunks_mut(w)).zip(nrm.chunks_mut(w)).enumerate());
        std::thread::scope(|s| {
            for _ in 0..threads {
                s.spawn(|| loop {
                    let job = rows.lock().unwrap().next();
                    let Some((y, (((c, va), a), nr))) = job else { break };
                    for x in 0..w {
                        let mut rng = Rng::new(((fr as u64) << 42) ^ ((y as u64) << 21) ^ x as u64);
                        let (mut sum, mut s1, mut s2, mut sa, mut sn) = (V0, 0.0f32, 0.0f32, V0, V0);
                        for k in 0..spp {
                            let px = (x as f32 + rng.f()) / w as f32 * 2.0 - 1.0;
                            let py = 1.0 - (y as f32 + rng.f()) / h as f32 * 2.0;
                            let (r, phi) = (rng.f().sqrt() * cam.ap, 2.0 * PI * rng.f());
                            let lens = cam.u * (r * phi.cos()) + cam.vv * (r * phi.sin());
                            let target = cam.o + (cam.u * (px * cam.hw) + cam.vv * (py * cam.hh) - cam.w) * cam.fd;
                            let o = cam.o + lens;
                            let d = (target - o).norm();
                            let time = (k as f32 + rng.f()) / spp as f32 * shutter;
                            let mut ft = Feat { alb: V0, nrm: V0 };
                            let mut l = radiance(&sc, o, d, time, &mut rng, &mut ft);
                            if !(l.x.is_finite() && l.y.is_finite() && l.z.is_finite()) { l = V0; }
                            sum = sum + l;
                            let lu = l.lum();
                            s1 += lu;
                            s2 += lu * lu;
                            sa = sa + ft.alb;
                            sn = sn + ft.nrm;
                        }
                        let k = spp as f32;
                        c[x] = sum / k;
                        let mean = s1 / k;
                        va[x] = (s2 / k - mean * mean).max(0.0) / k;
                        a[x] = sa / k;
                        nr[x] = if sn.len() > 1e-6 { sn.norm() } else { V0 };
                    }
                });
            }
        });
    }
    if std::env::var("NODENOISE").is_err() {
        denoise(&mut col, &mut var, &alb, &nrm, w, h, threads);
    }
    write_frame(path, &col, w, h, fr as u64 * 7919 + 1);
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let out = args.get(1).cloned().unwrap_or_else(|| "frames".into());
    let get = |k: &str, d: f32| -> f32 {
        args.iter().position(|a| a == k).and_then(|i| args.get(i + 1)).and_then(|s| s.parse().ok()).unwrap_or(d)
    };
    let (w, h, spp) = (get("--w", 1280.0) as usize, get("--h", 720.0) as usize, get("--spp", 32.0) as usize);
    let fps = get("--fps", 30.0);
    let total = get("--total", 210.0) as usize;
    let (from, to) = (get("--from", 0.0) as usize, get("--to", total as f32) as usize);
    let step = get("--step", 1.0) as usize;
    let threads = std::env::var("THREADS").ok().and_then(|s| s.parse().ok()).unwrap_or(12usize);
    std::fs::create_dir_all(&out).unwrap();
    let dur = total as f32 / fps;
    let t_all = Instant::now();
    for fr in (from..to).step_by(step.max(1)) {
        let path = format!("{}/f_{:04}.ppm", out, fr);
        if std::path::Path::new(&path).exists() { continue; }
        let t0 = Instant::now();
        render(fr, w, h, spp, fps, dur, threads, &path);
        println!("frame {} {:.2}s", fr, t0.elapsed().as_secs_f32());
    }
    println!("total {:.1}s", t_all.elapsed().as_secs_f32());
}
