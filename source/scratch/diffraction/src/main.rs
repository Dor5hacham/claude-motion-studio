/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Fourier optics written from scratch with the Rust standard library only.
// The far-field (Fraunhofer) diffraction pattern of an aperture is the squared magnitude of its 2D
// Fourier transform. The aperture morphs from a circle to an iris, a square, a triangle and a grating;
// sampling the pattern at 12 wavelengths gives the colored starbursts and grating spectra.
//
//   diffraction <out_dir> [--frames 240] [--every 1]
//
// Threads come from the THREADS environment variable (default 12). Writes PPM frames for FFmpeg.

use std::f32::consts::PI;
use std::io::Write;
use std::time::Instant;

const N: usize = 512;
const W: usize = 1280;
const H: usize = 720;
const NL: usize = 12;
const SCALE: f32 = 4.0;

#[derive(Clone, Copy, Default)]
struct C {
    re: f32,
    im: f32,
}

// In-place radix-2 FFT of one line of length N.
fn fft(a: &mut [C], tw: &[C]) {
    let n = a.len();
    let mut j = 0;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j |= bit;
        if i < j { a.swap(i, j); }
    }
    let mut len = 2;
    while len <= n {
        let step = n / len;
        for s in (0..n).step_by(len) {
            for k in 0..len / 2 {
                let w = tw[k * step];
                let (u, v) = (a[s + k], a[s + k + len / 2]);
                let t = C { re: v.re * w.re - v.im * w.im, im: v.re * w.im + v.im * w.re };
                a[s + k] = C { re: u.re + t.re, im: u.im + t.im };
                a[s + k + len / 2] = C { re: u.re - t.re, im: u.im - t.im };
            }
        }
        len <<= 1;
    }
}

// 2D FFT: rows, then columns, each pass split across threads.
fn fft2(a: &mut [C], tw: &[C], threads: usize) {
    let rows = N.div_ceil(threads) * N;
    std::thread::scope(|s| {
        for ch in a.chunks_mut(rows) {
            s.spawn(move || for r in ch.chunks_mut(N) { fft(r, tw); });
        }
    });
    let mut t = vec![C::default(); N * N];
    for y in 0..N {
        for x in 0..N { t[x * N + y] = a[y * N + x]; }
    }
    std::thread::scope(|s| {
        for ch in t.chunks_mut(rows) {
            s.spawn(move || for r in ch.chunks_mut(N) { fft(r, tw); });
        }
    });
    for y in 0..N {
        for x in 0..N { a[y * N + x] = t[x * N + y]; }
    }
}

fn smoother(t: f32) -> f32 { let t = t.clamp(0.0, 1.0); t * t * t * (t * (t * 6.0 - 15.0) + 10.0) }

// Signed distances (aperture pixels, negative inside) of the five apertures.
fn sd_poly(x: f32, y: f32, k: usize, r: f32, rot: f32) -> f32 {
    let a = r * (PI / k as f32).cos();
    (0..k).map(|i| {
        let th = rot + (i as f32 + 0.5) * 2.0 * PI / k as f32;
        x * th.cos() + y * th.sin()
    }).fold(f32::MIN, f32::max) - a
}
fn sd_shape(i: usize, x: f32, y: f32, rot: f32) -> f32 {
    match i {
        0 => (x * x + y * y).sqrt() - 40.0,
        1 => sd_poly(x, y, 6, 44.0, rot),
        2 => sd_poly(x, y, 4, 50.0, rot + PI / 4.0),
        3 => sd_poly(x, y, 3, 56.0, rot - PI / 2.0),
        _ => {
            let (sp, wd) = (13.0f32, 3.2f32);
            let gx = ((x / sp + 0.5).rem_euclid(1.0) - 0.5).abs() * sp - wd;
            gx.max(x.abs() - 2.6 * sp).max(y.abs() - 42.0)
        }
    }
}
// Aperture at time t: shape index and blend, with a slow turn.
fn aperture(t: f32) -> Vec<C> {
    let keys = [0.0f32, 1.6, 3.2, 4.8, 6.4];
    let mut i = 0;
    while i + 1 < keys.len() && t >= keys[i + 1] { i += 1; }
    let blend = if i + 1 < keys.len() { smoother((t - keys[i] - 0.8) / 0.8) } else { 0.0 };
    let rot = 0.12 * t;
    let mut a = vec![C::default(); N * N];
    for y in 0..N {
        for x in 0..N {
            let (px, py) = (x as f32 + 0.5 - N as f32 / 2.0, y as f32 + 0.5 - N as f32 / 2.0);
            let d0 = sd_shape(i, px, py, rot);
            let d = if blend > 0.0 { d0 + (sd_shape(i + 1, px, py, rot) - d0) * blend } else { d0 };
            a[y * N + x].re = (0.5 - d).clamp(0.0, 1.0);
        }
    }
    a
}

fn spectrum() -> [(f32, [f32; 3]); NL] {
    fn g(x: f32, m: f32, s: f32) -> f32 { (-0.5 * ((x - m) / s).powi(2)).exp() }
    let mut out = [(0f32, [0f32; 3]); NL];
    let mut sum = [0f32; 3];
    for (k, o) in out.iter_mut().enumerate() {
        let l = 420.0 + 260.0 * k as f32 / (NL - 1) as f32;
        let c = [g(l, 605.0, 36.0) + 0.25 * g(l, 430.0, 18.0), g(l, 545.0, 36.0), g(l, 455.0, 26.0)];
        for ch in 0..3 { sum[ch] += c[ch]; }
        *o = (l, c);
    }
    for o in out.iter_mut() { for ch in 0..3 { o.1[ch] /= sum[ch]; } }
    out
}

fn render(t: f32, tw: &[C], spec: &[(f32, [f32; 3]); NL], threads: usize, path: &str) {
    let mut a = aperture(t);
    let area: f32 = a.iter().map(|c| c.re).sum();
    let mask: Vec<f32> = a.iter().map(|c| c.re).collect();
    fft2(&mut a, tw, threads);
    // Intensity, shifted so zero frequency sits in the middle and normalized to a peak of 1.
    let mut it = vec![0f32; N * N];
    for y in 0..N {
        for x in 0..N {
            let c = a[y * N + x];
            it[((y + N / 2) % N) * N + (x + N / 2) % N] = (c.re * c.re + c.im * c.im) / (area * area);
        }
    }
    let sample = |fx: f32, fy: f32| -> f32 {
        let (x, y) = (fx + N as f32 / 2.0, fy + N as f32 / 2.0);
        if x < 0.0 || y < 0.0 || x >= (N - 1) as f32 || y >= (N - 1) as f32 { return 0.0; }
        let (ix, iy) = (x as usize, y as usize);
        let (tx, ty) = (x - ix as f32, y - iy as f32);
        let i = iy * N + ix;
        (it[i] * (1.0 - tx) + it[i + 1] * tx) * (1.0 - ty) + (it[i + N] * (1.0 - tx) + it[i + N + 1] * tx) * ty
    };
    let k = 3.0e5f32;
    let lk = (1.0 + k).ln();
    let mut img = vec![[0f32; 3]; W * H];
    let rows = H.div_ceil(threads) * W;
    std::thread::scope(|s| {
        for (ci, ch) in img.chunks_mut(rows).enumerate() {
            let sample = &sample;
            s.spawn(move || {
                for (j, px) in ch.iter_mut().enumerate() {
                    let idx = ci * rows + j;
                    let (x, y) = ((idx % W) as f32 + 0.5 - W as f32 / 2.0, (idx / W) as f32 + 0.5 - H as f32 / 2.0);
                    let mut c = [0f32; 3];
                    for (l, w) in spec.iter() {
                        let sc = SCALE * l / 550.0;
                        let v = sample(x / sc, y / sc);
                        for chn in 0..3 { c[chn] += v * w[chn]; }
                    }
                    let vg = 1.0 - ((x / W as f32).powi(2) + (y / H as f32).powi(2)) * 0.4;
                    for chn in 0..3 {
                        let v = ((1.0 + k * c[chn]).ln() / lk).clamp(0.0, 1.0);
                        px[chn] = 0.035 * vg * [0.43, 0.43, 0.63][chn] + v.powf(1.25);
                    }
                }
            });
        }
    });
    // Inset: the aperture itself, lower left.
    let (ix0, iy0, isz) = (40usize, H - 40 - 150, 150usize);
    for y in 0..isz {
        for x in 0..isz {
            let (ax, ay) = (N / 2 - 75 + x, N / 2 - 75 + y);
            let m = mask[ay * N + ax];
            let edge = x < 2 || y < 2 || x >= isz - 2 || y >= isz - 2;
            let p = &mut img[(iy0 + y) * W + ix0 + x];
            let base = [0.035, 0.035, 0.05];
            for chn in 0..3 {
                let cream = [0.96, 0.93, 0.86][chn];
                p[chn] = if edge { cream * 0.5 } else { base[chn] * (1.0 - m) + cream * m };
            }
        }
    }
    let mut out = format!("P6\n{} {}\n255\n", W, H).into_bytes();
    for (i, c) in img.iter().enumerate() {
        let dz = (((i * 7919) % 255) as f32 / 255.0 - 0.5) / 255.0;
        for ch in c { out.push((((ch + dz).clamp(0.0, 1.0)).powf(1.0 / 1.1) * 255.0).round() as u8); }
    }
    std::fs::File::create(path).unwrap().write_all(&out).unwrap();
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let out = args.get(1).cloned().unwrap_or_else(|| "frames".into());
    let get = |k: &str, d: usize| -> usize {
        args.iter().position(|a| a == k).and_then(|i| args.get(i + 1)).and_then(|s| s.parse().ok()).unwrap_or(d)
    };
    let (frames, every) = (get("--frames", 240), get("--every", 1));
    let threads = std::env::var("THREADS").ok().and_then(|s| s.parse().ok()).unwrap_or(12usize);
    std::fs::create_dir_all(&out).unwrap();
    let tw: Vec<C> = (0..N / 2).map(|k| { let a = -2.0 * PI * k as f32 / N as f32; C { re: a.cos(), im: a.sin() } }).collect();
    let spec = spectrum();
    let t0 = Instant::now();
    for fr in (0..frames).step_by(every.max(1)) {
        render(fr as f32 / 30.0, &tw, &spec, threads, &format!("{}/f_{:04}.ppm", out, fr));
        if fr % 30 == 0 { println!("frame {} at {:.1}s", fr, t0.elapsed().as_secs_f32()); }
    }
    println!("done {:.1}s", t0.elapsed().as_secs_f32());
}
