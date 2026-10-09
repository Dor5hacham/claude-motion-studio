/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Lattice Boltzmann wind tunnel written from scratch with the Rust standard library only.
// A NACA 2412 airfoil pitches up until it stalls; smoke streaklines and vorticity show the flow.
//
//   windtunnel <out_dir> [--frames 240] [--steps 60] [--warm 9000] [--from 0] [--every 1]
//
// Threads come from the THREADS environment variable (default 12). Writes PPM frames for FFmpeg.

use std::f32::consts::PI;
use std::io::Write;
use std::time::Instant;

const NX: usize = 800;
const NY: usize = 450;
const EX: [i32; 9] = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const EY: [i32; 9] = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const WT: [f32; 9] = [4.0 / 9.0, 1.0 / 9.0, 1.0 / 9.0, 1.0 / 9.0, 1.0 / 9.0, 1.0 / 36.0, 1.0 / 36.0, 1.0 / 36.0, 1.0 / 36.0];
const OPP: [usize; 9] = [0, 3, 4, 1, 2, 7, 8, 5, 6];
const U0: f32 = 0.1;
const TAU0: f32 = 0.51;
const CS2: f32 = 0.01;
const CHORD: f32 = 150.0;
const PIVOT: (f32, f32) = (230.0, 236.0);
const SCALE: f32 = 1.6;
const W: usize = 1280;
const H: usize = 720;
const EMIT: usize = 4;

fn feq(rho: f32, ux: f32, uy: f32) -> [f32; 9] {
    let usq = 1.5 * (ux * ux + uy * uy);
    let mut o = [0f32; 9];
    for i in 0..9 {
        let eu = 3.0 * (EX[i] as f32 * ux + EY[i] as f32 * uy);
        o[i] = WT[i] * rho * (1.0 + eu + 0.5 * eu * eu - usq);
    }
    o
}
fn smoother(t: f32) -> f32 { let t = t.clamp(0.0, 1.0); t * t * t * (t * (t * 6.0 - 15.0) + 10.0) }

// Angle of attack in degrees at clip time t in seconds (negative during the warm-up).
fn aoa(t: f32) -> f32 { 4.0 + 20.0 * smoother((t - 1.0) / 3.5) }

// NACA 2412 outline as a closed polygon in cell units (y up), pitched nose up by `deg` about the quarter chord.
fn airfoil(deg: f32) -> Vec<(f32, f32)> {
    let (m, p, t) = (0.02f32, 0.4f32, 0.12f32);
    let n = 120;
    let (mut up, mut lo) = (Vec::new(), Vec::new());
    for k in 0..=n {
        let b = k as f32 / n as f32 * PI;
        let x = 0.5 * (1.0 - b.cos());
        let yt = 5.0 * t * (0.2969 * x.sqrt() - 0.1260 * x - 0.3516 * x * x + 0.2843 * x.powi(3) - 0.1036 * x.powi(4));
        let (yc, dyc) = if x < p {
            (m / (p * p) * (2.0 * p * x - x * x), 2.0 * m / (p * p) * (p - x))
        } else {
            (m / (1.0 - p).powi(2) * ((1.0 - 2.0 * p) + 2.0 * p * x - x * x), 2.0 * m / (1.0 - p).powi(2) * (p - x))
        };
        let th = dyc.atan();
        up.push((x - yt * th.sin(), yc + yt * th.cos()));
        lo.push((x + yt * th.sin(), yc - yt * th.cos()));
    }
    let (s, c) = (-deg.to_radians()).sin_cos();
    up.iter().rev().chain(lo.iter().skip(1)).map(|&(x, y)| {
        let (dx, dy) = ((x - 0.25) * CHORD, y * CHORD);
        (PIVOT.0 + dx * c - dy * s, PIVOT.1 + dx * s + dy * c)
    }).collect()
}

fn inside(poly: &[(f32, f32)], x: f32, y: f32) -> bool {
    let mut c = false;
    let n = poly.len();
    for k in 0..n {
        let (x0, y0) = poly[k];
        let (x1, y1) = poly[(k + 1) % n];
        if (y0 <= y) != (y1 <= y) && x < x0 + (y - y0) / (y1 - y0) * (x1 - x0) { c = !c; }
    }
    c
}
fn seg_dist(px: f32, py: f32, a: (f32, f32), b: (f32, f32)) -> f32 {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let t = (((px - a.0) * dx + (py - a.1) * dy) / (dx * dx + dy * dy).max(1e-12)).clamp(0.0, 1.0);
    ((px - a.0 - t * dx).powi(2) + (py - a.1 - t * dy).powi(2)).sqrt()
}

// D2Q9 lattice with BGK collisions, a Smagorinsky eddy viscosity and a sponge before the outlet.
struct Lbm {
    f: Vec<f32>,
    g: Vec<f32>,
    solid: Vec<u8>,
    ux: Vec<f32>,
    uy: Vec<f32>,
}

impl Lbm {
    fn new() -> Lbm {
        let e = feq(1.0, U0, 0.0);
        let mut f = vec![0f32; NX * NY * 9];
        for c in 0..NX * NY { f[c * 9..c * 9 + 9].copy_from_slice(&e); }
        Lbm { g: f.clone(), f, solid: vec![0; NX * NY], ux: vec![U0; NX * NY], uy: vec![0.0; NX * NY] }
    }
    // Scanline-fills the airfoil into the solid mask; cells that open up start at rest.
    fn set_airfoil(&mut self, poly: &[(f32, f32)]) {
        let old = self.solid.clone();
        self.solid.fill(0);
        let ymin = poly.iter().map(|p| p.1).fold(f32::MAX, f32::min).floor().max(0.0) as usize;
        let ymax = poly.iter().map(|p| p.1).fold(f32::MIN, f32::max).ceil().min((NY - 1) as f32) as usize;
        let mut xs = Vec::new();
        for y in ymin..=ymax {
            let yc = y as f32;
            xs.clear();
            for k in 0..poly.len() {
                let (x0, y0) = poly[k];
                let (x1, y1) = poly[(k + 1) % poly.len()];
                if (y0 <= yc) != (y1 <= yc) { xs.push(x0 + (yc - y0) / (y1 - y0) * (x1 - x0)); }
            }
            xs.sort_by(|a, b| a.partial_cmp(b).unwrap());
            for pr in xs.chunks(2) {
                if pr.len() < 2 { continue; }
                let (a, b) = (pr[0].ceil().max(0.0) as usize, pr[1].floor().min((NX - 1) as f32) as usize);
                for x in a..=b { self.solid[y * NX + x] = 1; }
            }
        }
        let rest = feq(1.0, 0.0, 0.0);
        for c in 0..NX * NY {
            if old[c] == 1 && self.solid[c] == 0 { self.f[c * 9..c * 9 + 9].copy_from_slice(&rest); }
        }
    }
    // One fused stream (pull) and collide step over all rows, split across threads.
    fn step(&mut self, threads: usize) {
        let rows = NY.div_ceil(threads);
        let (f, solid) = (&self.f, &self.solid);
        let inflow = feq(1.0, U0, 0.0);
        std::thread::scope(|s| {
            let parts = self.g.chunks_mut(rows * NX * 9).zip(self.ux.chunks_mut(rows * NX)).zip(self.uy.chunks_mut(rows * NX));
            for (ci, ((gc, uxc), uyc)) in parts.enumerate() {
                s.spawn(move || {
                    let y0 = ci * rows;
                    for ry in 0..uxc.len() / NX {
                        let y = y0 + ry;
                        for x in 0..NX {
                            let c = y * NX + x;
                            let lc = ry * NX + x;
                            if solid[c] != 0 {
                                gc[lc * 9..lc * 9 + 9].fill(0.0);
                                uxc[lc] = 0.0;
                                uyc[lc] = 0.0;
                                continue;
                            }
                            let mut fi = [0f32; 9];
                            for i in 0..9 {
                                let sx = x as i32 - EX[i];
                                let sy = y as i32 - EY[i];
                                fi[i] = if sx < 0 || sy < 0 || sy >= NY as i32 {
                                    inflow[i]
                                } else if sx >= NX as i32 {
                                    f[c * 9 + i]
                                } else {
                                    let sc = sy as usize * NX + sx as usize;
                                    if solid[sc] != 0 { f[c * 9 + OPP[i]] } else { f[sc * 9 + i] }
                                };
                            }
                            let mut rho: f32 = fi.iter().sum();
                            if !(rho > 0.2 && rho < 5.0) {
                                fi = feq(1.0, U0, 0.0);
                                rho = 1.0;
                            }
                            let ux = (fi[1] - fi[3] + fi[5] - fi[6] - fi[7] + fi[8]) / rho;
                            let uy = (fi[2] - fi[4] + fi[5] + fi[6] - fi[7] - fi[8]) / rho;
                            let fe = feq(rho, ux, uy);
                            let (mut pxx, mut pyy, mut pxy) = (0f32, 0f32, 0f32);
                            for i in 0..9 {
                                let d = fi[i] - fe[i];
                                let (ex, ey) = (EX[i] as f32, EY[i] as f32);
                                pxx += ex * ex * d;
                                pyy += ey * ey * d;
                                pxy += ex * ey * d;
                            }
                            let q = (pxx * pxx + pyy * pyy + 2.0 * pxy * pxy).sqrt();
                            let mut tau = 0.5 * (TAU0 + (TAU0 * TAU0 + 18.0 * std::f32::consts::SQRT_2 * CS2 * q / rho).sqrt());
                            if x + 90 > NX {
                                let sp = (x + 90 - NX) as f32 / 90.0;
                                tau += 0.8 * sp * sp;
                            }
                            let om = 1.0 / tau;
                            for i in 0..9 { gc[lc * 9 + i] = fi[i] - om * (fi[i] - fe[i]); }
                            uxc[lc] = ux;
                            uyc[lc] = uy;
                        }
                    }
                });
            }
        });
        std::mem::swap(&mut self.f, &mut self.g);
    }
}

fn bilerp(a: &[f32], x: f32, y: f32) -> f32 {
    let x = x.clamp(0.0, (NX - 2) as f32);
    let y = y.clamp(0.0, (NY - 2) as f32);
    let (ix, iy) = (x as usize, y as usize);
    let (fx, fy) = (x - ix as f32, y - iy as f32);
    let i = iy * NX + ix;
    (a[i] * (1.0 - fx) + a[i + 1] * fx) * (1.0 - fy) + (a[i + NX] * (1.0 - fx) + a[i + NX + 1] * fx) * fy
}

// Smoke particles released at the inlet in evenly spaced lines (streaklines).
struct Smoke {
    x: Vec<f32>,
    y: Vec<f32>,
}
impl Smoke {
    fn emit(&mut self) {
        for k in 0..27 {
            self.x.push(1.0);
            self.y.push(42.0 + k as f32 * 14.0);
        }
    }
    // Midpoint (RK2) advection by dt steps; particles that leave or hit the wing are removed.
    fn advect(&mut self, lbm: &Lbm, dt: f32, threads: usize) {
        let n = self.x.len();
        let chunk = n.div_ceil(threads).max(1);
        std::thread::scope(|s| {
            for (xs, ys) in self.x.chunks_mut(chunk).zip(self.y.chunks_mut(chunk)) {
                s.spawn(move || {
                    for k in 0..xs.len() {
                        let (x, y) = (xs[k], ys[k]);
                        let (u1, v1) = (bilerp(&lbm.ux, x, y), bilerp(&lbm.uy, x, y));
                        let (xm, ym) = (x + u1 * dt * 0.5, y + v1 * dt * 0.5);
                        xs[k] = x + bilerp(&lbm.ux, xm, ym) * dt;
                        ys[k] = y + bilerp(&lbm.uy, xm, ym) * dt;
                    }
                });
            }
        });
        let mut k = 0;
        while k < self.x.len() {
            let (x, y) = (self.x[k], self.y[k]);
            let gone = x >= (NX - 2) as f32 || y < 0.0 || y >= (NY - 1) as f32 || lbm.solid[(y.round() as usize).min(NY - 1) * NX + (x.round() as usize).min(NX - 1)] != 0;
            if gone {
                self.x.swap_remove(k);
                self.y.swap_remove(k);
            } else {
                k += 1;
            }
        }
    }
}

type Rgb = [f32; 3];
fn mixc(a: Rgb, b: Rgb, t: f32) -> Rgb { [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] }
const BG: Rgb = [11.0 / 255.0, 11.0 / 255.0, 16.0 / 255.0];
const CREAM: Rgb = [0.96, 0.93, 0.86];
const CORAL: Rgb = [1.0, 0.353, 0.212];
const CYAN: Rgb = [0.2, 0.75, 1.0];

fn to_px(x: f32, y: f32) -> (f32, f32) { ((x + 0.5) * SCALE, (NY as f32 - 0.5 - y) * SCALE) }

// Draws vorticity, smoke, the wing and the angle gauge, then writes a binary PPM.
fn render(lbm: &Lbm, smoke: &Smoke, deg: f32, path: &str) {
    let mut vort = vec![0f32; NX * NY];
    for y in 1..NY - 1 {
        for x in 1..NX - 1 {
            let c = y * NX + x;
            vort[c] = 0.5 * (lbm.uy[c + 1] - lbm.uy[c - 1]) - 0.5 * (lbm.ux[c + NX] - lbm.ux[c - NX]);
        }
    }
    let mut acc = vec![0f32; W * H];
    for k in 0..smoke.x.len() {
        let (px, py) = to_px(smoke.x[k], smoke.y[k]);
        let (fx, fy) = (px - 0.5, py - 0.5);
        if fx < 0.0 || fy < 0.0 || fx >= (W - 1) as f32 || fy >= (H - 1) as f32 { continue; }
        let (ix, iy) = (fx as usize, fy as usize);
        let (tx, ty) = (fx - ix as f32, fy - iy as f32);
        let i = iy * W + ix;
        acc[i] += (1.0 - tx) * (1.0 - ty);
        acc[i + 1] += tx * (1.0 - ty);
        acc[i + W] += (1.0 - tx) * ty;
        acc[i + W + 1] += tx * ty;
    }
    let mut img = vec![[0f32; 3]; W * H];
    for py in 0..H {
        for px in 0..W {
            let (cx, cy) = ((px as f32 + 0.5) / SCALE - 0.5, NY as f32 - 0.5 - (py as f32 + 0.5) / SCALE);
            let edge = ((cy - 3.0) / 12.0).min((NY as f32 - 4.0 - cy) / 12.0).min((cx - 3.0) / 12.0).clamp(0.0, 1.0);
            let w = bilerp(&vort, cx, cy) * 22.0 * edge;
            let vg = 1.0 - ((px as f32 / W as f32 - 0.45).powi(2) + (py as f32 / H as f32 - 0.5).powi(2)) * 0.6;
            let mut c = BG.map(|v| v * vg);
            c = mixc(c, CORAL, (w.max(0.0)).min(1.0).powf(0.8) * 0.42);
            c = mixc(c, CYAN, ((-w).max(0.0)).min(1.0).powf(0.8) * 0.38);
            let s = 1.0 - (-acc[py * W + px] * 0.55).exp();
            c = mixc(c, CREAM, s * 0.92);
            img[py * W + px] = c;
        }
    }
    // Wing: anti-aliased fill from the signed distance to its outline.
    let poly: Vec<(f32, f32)> = airfoil(deg).iter().map(|&(x, y)| to_px(x, y)).collect();
    let (x0, x1) = (poly.iter().map(|p| p.0).fold(f32::MAX, f32::min) - 2.0, poly.iter().map(|p| p.0).fold(f32::MIN, f32::max) + 2.0);
    let (y0, y1) = (poly.iter().map(|p| p.1).fold(f32::MAX, f32::min) - 2.0, poly.iter().map(|p| p.1).fold(f32::MIN, f32::max) + 2.0);
    for py in (y0 as usize)..=(y1 as usize).min(H - 1) {
        for px in (x0 as usize)..=(x1 as usize).min(W - 1) {
            let (fx, fy) = (px as f32 + 0.5, py as f32 + 0.5);
            let mut d = f32::MAX;
            for k in 0..poly.len() { d = d.min(seg_dist(fx, fy, poly[k], poly[(k + 1) % poly.len()])); }
            let sd = if inside(&poly, fx, fy) { d } else { -d };
            let cov = (sd + 0.5).clamp(0.0, 1.0);
            if cov <= 0.0 { continue; }
            let shade = 0.78 + 0.3 * ((y1 - fy) / (y1 - y0)).clamp(0.0, 1.0);
            let mut c = CORAL.map(|v| v * shade);
            if sd < 1.6 { c = mixc(c, CREAM, 0.55 * (1.0 - sd / 1.6).clamp(0.0, 1.0)); }
            img[py * W + px] = mixc(img[py * W + px], c, cov);
        }
    }
    // Angle-of-attack gauge in the lower left: reference line, chord line and the filled wedge between.
    let (gx, gy, gr) = (112.0f32, 628.0f32, 54.0f32);
    let a = deg.to_radians();
    for py in (gy - gr - 3.0) as usize..=(gy + 6.0) as usize {
        for px in (gx - gr - 3.0) as usize..=(gx + 8.0) as usize {
            let (dx, dy) = (px as f32 + 0.5 - gx, gy - (py as f32 + 0.5));
            let r = (dx * dx + dy * dy).sqrt();
            let phi = dy.atan2(-dx);
            let mut c = img[py * W + px];
            if r < gr && phi >= 0.0 && phi <= a { c = mixc(c, CORAL, 0.55 * (r / gr * 6.0).min(1.0)); }
            let on_ref = dx <= 0.0 && dy.abs() < 1.0 && r < gr + 2.0;
            let lx = -a.cos();
            let ly = a.sin();
            let along = dx * lx + dy * ly;
            let off = (dx * ly - dy * lx).abs();
            let on_chord = along > 0.0 && along < gr + 2.0 && off < 1.1;
            let on_arc = (r - gr).abs() < 0.8 && phi >= 0.0 && phi <= 0.55;
            if on_ref { c = mixc(c, CREAM, 0.45); }
            if on_arc { c = mixc(c, CREAM, 0.3); }
            if on_chord { c = mixc(c, CREAM, 0.95); }
            img[py * W + px] = c;
        }
    }
    let mut buf = format!("P6\n{} {}\n255\n", W, H).into_bytes();
    for (k, c) in img.iter().enumerate() {
        let d = ((k as u32).wrapping_mul(2654435761) >> 24) as f32 / 255.0 - 0.5;
        for ch in c { buf.push((ch.clamp(0.0, 1.0).powf(1.0 / 1.1) * 255.0 + d).round().clamp(0.0, 255.0) as u8); }
    }
    std::fs::File::create(path).unwrap().write_all(&buf).unwrap();
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let out = args.get(1).cloned().unwrap_or_else(|| "frames".into());
    let get = |k: &str, d: usize| -> usize {
        args.iter().position(|a| a == k).and_then(|i| args.get(i + 1)).and_then(|s| s.parse().ok()).unwrap_or(d)
    };
    let (frames, steps, warm, from, every) = (get("--frames", 240), get("--steps", 60), get("--warm", 9000), get("--from", 0), get("--every", 1));
    let threads = std::env::var("THREADS").ok().and_then(|s| s.parse().ok()).unwrap_or(12usize);
    std::fs::create_dir_all(&out).unwrap();
    let mut lbm = Lbm::new();
    let mut smoke = Smoke { x: Vec::new(), y: Vec::new() };
    let mut deg = aoa(-1.0);
    lbm.set_airfoil(&airfoil(deg));
    let total = warm + frames * steps;
    let t0 = Instant::now();
    for k in 0..total {
        let t = (k as f32 - warm as f32) / (steps as f32 * 30.0);
        let d = aoa(t);
        if (d - deg).abs() > 0.05 {
            deg = d;
            lbm.set_airfoil(&airfoil(deg));
        }
        lbm.step(threads);
        if k % EMIT == 0 { smoke.emit(); }
        if k % 2 == 1 { smoke.advect(&lbm, 2.0, threads); }
        if k >= warm && (k + 1 - warm) % steps == 0 {
            let fr = (k + 1 - warm) / steps - 1;
            if fr >= from && (fr - from) % every == 0 {
                render(&lbm, &smoke, deg, &format!("{}/f_{:04}.ppm", out, fr));
                if fr % 30 == 0 { println!("frame {} aoa {:.1} smoke {} at {:.1}s", fr, deg, smoke.x.len(), t0.elapsed().as_secs_f32()); }
            }
        }
    }
    println!("done {:.1}s", t0.elapsed().as_secs_f32());
}
