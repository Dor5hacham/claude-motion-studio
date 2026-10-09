/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// A word hidden in sound, written from scratch with the Rust standard library only.
// The program rasterizes "MOTION" from a TrueType font, turns every pixel row into a sine tone
// (additive synthesis) and writes a WAV. Then its own FFT analyzes the WAV and draws the scrolling
// spectrogram, where the word appears as it plays.
//
//   spectrogram <out_dir> [--font C:/Windows/Fonts/bahnschrift.ttf]
//
// Writes <out_dir>/audio.wav and PPM frames (1280x720, 30 fps) for FFmpeg.

use std::f32::consts::PI;
use std::io::Write;

const SR: usize = 44100;
const DUR: f32 = 8.0;
const W: usize = 1280;
const H: usize = 720;
const ROWS: usize = 220;
const F_LO: f32 = 900.0;
const F_HI: f32 = 7600.0;
const COLS_PER_SEC: f32 = 190.0;
const T_TEXT: f32 = 1.35;
const NFFT: usize = 2048;
const PXS: f32 = 162.0;
const PLAY_X: f32 = 1160.0;
const PLOT_TOP: f32 = 40.0;
const PLOT_BOT: f32 = 596.0;
const F_MAX: f32 = 9000.0;

// ---------- TrueType outlines (same reader as fontraster) ----------

struct Font {
    d: Vec<u8>,
    glyf: usize,
    loca: usize,
    long_loca: bool,
    cmap: usize,
    hmtx: usize,
    n_hmetrics: usize,
    upem: f32,
}
#[derive(Clone, Copy)]
struct Pt {
    x: f32,
    y: f32,
    on: bool,
}
impl Font {
    fn load(path: &str) -> Font {
        let d = std::fs::read(path).expect("font file");
        let u16at = |o: usize| u16::from_be_bytes([d[o], d[o + 1]]) as usize;
        let u32at = |o: usize| u32::from_be_bytes([d[o], d[o + 1], d[o + 2], d[o + 3]]) as usize;
        let mut tab = std::collections::HashMap::new();
        for i in 0..u16at(4) {
            let r = 12 + 16 * i;
            tab.insert(String::from_utf8_lossy(&d[r..r + 4]).to_string(), u32at(r + 8));
        }
        let (head, cmap) = (tab["head"], tab["cmap"]);
        let mut sub = 0;
        for k in 0..u16at(cmap + 2) {
            let r = cmap + 4 + 8 * k;
            if u16at(r) == 3 && u16at(r + 2) == 1 { sub = cmap + u32at(r + 4); }
        }
        Font {
            glyf: tab["glyf"],
            loca: tab["loca"],
            long_loca: u16at(head + 50) == 1,
            cmap: sub,
            hmtx: tab["hmtx"],
            n_hmetrics: u16at(tab["hhea"] + 34),
            upem: u16at(head + 18) as f32,
            d,
        }
    }
    fn u16(&self, o: usize) -> usize { u16::from_be_bytes([self.d[o], self.d[o + 1]]) as usize }
    fn i16(&self, o: usize) -> i32 { i16::from_be_bytes([self.d[o], self.d[o + 1]]) as i32 }
    fn index(&self, ch: char) -> usize {
        let (c, s) = (ch as usize, self.cmap);
        let seg2 = self.u16(s + 6);
        let ends = s + 14;
        let starts = ends + seg2 + 2;
        let deltas = starts + seg2;
        let ranges = deltas + seg2;
        for i in (0..seg2).step_by(2) {
            if self.u16(ends + i) >= c {
                let start = self.u16(starts + i);
                if start > c { return 0; }
                let ro = self.u16(ranges + i);
                if ro == 0 { return (c + self.u16(deltas + i)) & 0xffff; }
                let g = self.u16(ranges + i + ro + 2 * (c - start));
                return if g == 0 { 0 } else { (g + self.u16(deltas + i)) & 0xffff };
            }
        }
        0
    }
    fn advance(&self, g: usize) -> f32 { self.u16(self.hmtx + 4 * g.min(self.n_hmetrics - 1)) as f32 }
    fn contours(&self, g: usize, dx: f32, dy: f32, out: &mut Vec<Vec<Pt>>) {
        let (a, b) = if self.long_loca {
            let o = self.loca + 4 * g;
            (u32::from_be_bytes(self.d[o..o + 4].try_into().unwrap()) as usize, u32::from_be_bytes(self.d[o + 4..o + 8].try_into().unwrap()) as usize)
        } else {
            (self.u16(self.loca + 2 * g) * 2, self.u16(self.loca + 2 * g + 2) * 2)
        };
        if a == b { return; }
        let o = self.glyf + a;
        let nc = self.i16(o);
        if nc < 0 {
            let mut p = o + 10;
            loop {
                let (flags, gi) = (self.u16(p), self.u16(p + 2));
                p += 4;
                let (ox, oy) = if flags & 1 != 0 {
                    p += 4;
                    (self.i16(p - 4), self.i16(p - 2))
                } else {
                    p += 2;
                    (self.d[p - 2] as i8 as i32, self.d[p - 1] as i8 as i32)
                };
                if flags & 0x08 != 0 { p += 2; } else if flags & 0x40 != 0 { p += 4; } else if flags & 0x80 != 0 { p += 8; }
                self.contours(gi, dx + ox as f32, dy + oy as f32, out);
                if flags & 0x20 == 0 { break; }
            }
            return;
        }
        let nc = nc as usize;
        let ends: Vec<usize> = (0..nc).map(|i| self.u16(o + 10 + 2 * i)).collect();
        let np = ends.last().map(|e| e + 1).unwrap_or(0);
        let mut p = o + 10 + 2 * nc;
        p += 2 + self.u16(p);
        let mut flags = Vec::with_capacity(np);
        while flags.len() < np {
            let f = self.d[p];
            p += 1;
            flags.push(f);
            if f & 8 != 0 {
                let r = self.d[p];
                p += 1;
                for _ in 0..r { flags.push(f); }
            }
        }
        let mut read = |short: u8, same: u8| -> Vec<i32> {
            let mut v = 0;
            flags.iter().map(|&f| {
                if f & short != 0 {
                    let dv = self.d[p] as i32;
                    p += 1;
                    v += if f & same != 0 { dv } else { -dv };
                } else if f & same == 0 {
                    v += self.i16(p);
                    p += 2;
                }
                v
            }).collect()
        };
        let xs = read(2, 16);
        let ys = read(4, 32);
        let mut s = 0;
        for &e in &ends {
            out.push((s..=e).map(|i| Pt { x: xs[i] as f32 + dx, y: ys[i] as f32 + dy, on: flags[i] & 1 != 0 }).collect());
            s = e + 1;
        }
    }
}

// Closed polyline of a contour in pixel space; consecutive off-curve points imply an on-curve midpoint.
fn polyline(c: &[Pt], tf: &dyn Fn(f32, f32) -> (f32, f32)) -> Vec<(f32, f32)> {
    let n = c.len();
    let mid = |a: Pt, b: Pt| Pt { x: 0.5 * (a.x + b.x), y: 0.5 * (a.y + b.y), on: true };
    let s0 = (0..n).find(|&i| c[i].on);
    let (s0, first) = match s0 { Some(i) => (i, c[i]), None => (0, mid(c[0], c[1])) };
    let mut out = vec![tf(first.x, first.y)];
    let mut cur = first;
    let mut ctrl: Option<Pt> = None;
    let quad = |a: Pt, b: Pt, e: Pt, out: &mut Vec<(f32, f32)>| {
        for k in 1..=12 {
            let t = k as f32 / 12.0;
            let u = 1.0 - t;
            out.push(tf(u * u * a.x + 2.0 * u * t * b.x + t * t * e.x, u * u * a.y + 2.0 * u * t * b.y + t * t * e.y));
        }
    };
    for k in 1..=n {
        let p = c[(s0 + k) % n];
        if p.on {
            let cp = ctrl.take().unwrap_or(mid(cur, p));
            quad(cur, cp, p, &mut out);
            cur = p;
        } else if let Some(cp) = ctrl {
            let m = mid(cp, p);
            quad(cur, cp, m, &mut out);
            cur = m;
            ctrl = Some(p);
        } else {
            ctrl = Some(p);
        }
    }
    if let Some(cp) = ctrl { quad(cur, cp, first, &mut out); }
    out
}

// Nonzero coverage of closed polylines, sampled 4x4 per pixel (small image, so brute force is fine).
fn coverage(polys: &[Vec<(f32, f32)>], w: usize, h: usize) -> Vec<f32> {
    let mut out = vec![0f32; w * h];
    let mut xs: Vec<(f32, i32)> = Vec::new();
    for y in 0..h {
        for sy in 0..4 {
            let yy = y as f32 + (sy as f32 + 0.5) / 4.0;
            xs.clear();
            for p in polys {
                for k in 0..p.len() {
                    let (a, b) = (p[k], p[(k + 1) % p.len()]);
                    if (a.1 <= yy) != (b.1 <= yy) { xs.push((a.0 + (yy - a.1) / (b.1 - a.1) * (b.0 - a.0), if b.1 > a.1 { 1 } else { -1 })); }
                }
            }
            xs.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
            for x in 0..w {
                for sx in 0..4 {
                    let xx = x as f32 + (sx as f32 + 0.5) / 4.0;
                    let wn: i32 = xs.iter().take_while(|c| c.0 < xx).map(|c| c.1).sum();
                    if wn != 0 { out[y * w + x] += 1.0 / 16.0; }
                }
            }
        }
    }
    out
}

// ---------- audio ----------

fn smooth(a: f32, b: f32, x: f32) -> f32 { let t = ((x - a) / (b - a)).clamp(0.0, 1.0); t * t * (3.0 - 2.0 * t) }

// Additive synthesis: one sine per image row, its loudness read from the image column at that moment.
// A rising chirp opens the piece and a low drone holds it together.
fn synth(img: &[f32], iw: usize) -> Vec<f32> {
    let n = (DUR * SR as f32) as usize;
    let mut out = vec![0f32; n];
    let mut seed = 12345u32;
    let freqs: Vec<f32> = (0..ROWS).map(|r| F_HI - (F_HI - F_LO) * r as f32 / (ROWS - 1) as f32).collect();
    let mut phase: Vec<f32> = (0..ROWS).map(|_| { seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5; seed as f32 / 4294967296.0 * 2.0 * PI }).collect();
    let (mut pc, mut pd1, mut pd2) = (0f32, 0f32, 0f32);
    for (i, o) in out.iter_mut().enumerate() {
        let t = i as f32 / SR as f32;
        let c = (t - T_TEXT) * COLS_PER_SEC;
        let mut s = 0.0;
        if c >= 0.0 && c < (iw - 1) as f32 {
            let (c0, fc) = (c as usize, c.fract());
            for r in 0..ROWS {
                let a = img[r * iw + c0] * (1.0 - fc) + img[r * iw + c0 + 1] * fc;
                phase[r] += 2.0 * PI * freqs[r] / SR as f32;
                if phase[r] > 2.0 * PI { phase[r] -= 2.0 * PI; }
                if a > 0.0 { s += a * phase[r].sin(); }
            }
        }
        s *= 0.05;
        // Chirp from 300 Hz to 8 kHz between 0.25 and 1.1 s.
        if (0.25..1.1).contains(&t) {
            let u = (t - 0.25) / 0.85;
            let f = 300.0 * (8000.0f32 / 300.0).powf(u);
            pc += 2.0 * PI * f / SR as f32;
            s += 0.35 * pc.sin() * smooth(0.0, 0.08, u) * smooth(1.0, 0.85, u);
        }
        // Drone on 110 and 165 Hz, fading in and out.
        pd1 += 2.0 * PI * 110.0 / SR as f32;
        pd2 += 2.0 * PI * 165.0 / SR as f32;
        s += (0.18 * pd1.sin() + 0.12 * pd2.sin()) * smooth(0.0, 1.2, t) * smooth(DUR, DUR - 0.8, t);
        *o = s;
    }
    let peak = out.iter().fold(0f32, |m, v| m.max(v.abs()));
    for v in out.iter_mut() { *v *= 0.85 / peak; }
    out
}

fn write_wav(path: &str, s: &[f32]) {
    let mut b = Vec::with_capacity(44 + s.len() * 2);
    let data = (s.len() * 2) as u32;
    b.extend_from_slice(b"RIFF");
    b.extend_from_slice(&(36 + data).to_le_bytes());
    b.extend_from_slice(b"WAVEfmt ");
    b.extend_from_slice(&16u32.to_le_bytes());
    b.extend_from_slice(&1u16.to_le_bytes());
    b.extend_from_slice(&1u16.to_le_bytes());
    b.extend_from_slice(&(SR as u32).to_le_bytes());
    b.extend_from_slice(&(SR as u32 * 2).to_le_bytes());
    b.extend_from_slice(&2u16.to_le_bytes());
    b.extend_from_slice(&16u16.to_le_bytes());
    b.extend_from_slice(b"data");
    b.extend_from_slice(&data.to_le_bytes());
    for v in s { b.extend_from_slice(&((v.clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes()); }
    std::fs::File::create(path).unwrap().write_all(&b).unwrap();
}

// ---------- analysis ----------

// In-place radix-2 FFT (real input in re, im zero).
fn fft(re: &mut [f32], im: &mut [f32]) {
    let n = re.len();
    let mut j = 0;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 { j ^= bit; bit >>= 1; }
        j |= bit;
        if i < j { re.swap(i, j); im.swap(i, j); }
    }
    let mut len = 2;
    while len <= n {
        let ang = -2.0 * PI / len as f32;
        for s in (0..n).step_by(len) {
            for k in 0..len / 2 {
                let (wi, wr) = (ang * k as f32).sin_cos();
                let (a, b) = (s + k, s + k + len / 2);
                let (tr, ti) = (re[b] * wr - im[b] * wi, re[b] * wi + im[b] * wr);
                re[b] = re[a] - tr;
                im[b] = im[a] - ti;
                re[a] += tr;
                im[a] += ti;
            }
        }
        len <<= 1;
    }
}

// One spectrum column (dB) per screen pixel of scroll, Hann window.
fn stft(s: &[f32]) -> Vec<Vec<f32>> {
    let cols = (DUR * PXS) as usize + 1;
    let win: Vec<f32> = (0..NFFT).map(|i| 0.5 - 0.5 * (2.0 * PI * i as f32 / NFFT as f32).cos()).collect();
    (0..cols).map(|k| {
        let c = (k as f32 / PXS * SR as f32) as i64 - NFFT as i64 / 2;
        let mut re: Vec<f32> = (0..NFFT).map(|i| { let j = c + i as i64; if j >= 0 && (j as usize) < s.len() { s[j as usize] * win[i] } else { 0.0 } }).collect();
        let mut im = vec![0f32; NFFT];
        fft(&mut re, &mut im);
        (0..NFFT / 2).map(|b| 10.0 * ((re[b] * re[b] + im[b] * im[b]) / (NFFT as f32 * 0.25 * NFFT as f32 * 0.25) + 1e-12).log10()).collect()
    }).collect()
}

type Rgb = [f32; 3];
// Navy, violet, coral, amber and cream ramp for decibels.
fn palette(t: f32) -> Rgb {
    let st: [(f32, Rgb); 6] = [
        (0.0, [11.0 / 255.0, 11.0 / 255.0, 16.0 / 255.0]),
        (0.25, [0.07, 0.09, 0.26]),
        (0.5, [0.42, 0.20, 0.62]),
        (0.72, [1.0, 0.353, 0.212]),
        (0.88, [1.0, 0.72, 0.25]),
        (1.0, [0.98, 0.95, 0.88]),
    ];
    let t = t.clamp(0.0, 1.0);
    for k in 1..st.len() {
        if t <= st[k].0 {
            let u = (t - st[k - 1].0) / (st[k].0 - st[k - 1].0);
            let (a, b) = (st[k - 1].1, st[k].1);
            return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
        }
    }
    st[5].1
}

fn render(t: f32, spec: &[Vec<f32>], audio: &[f32], path: &str) {
    let bg: Rgb = [11.0 / 255.0, 11.0 / 255.0, 16.0 / 255.0];
    let mut img = vec![bg; W * H];
    let kp = t * PXS;
    let bin_hz = SR as f32 / NFFT as f32;
    for x in 0..W {
        let k = kp - (PLAY_X - x as f32);
        if k < 0.0 || x as f32 > PLAY_X { continue; }
        let (k0, fk) = (k as usize, k.fract());
        let k1 = (k0 + 1).min(spec.len() - 1);
        for y in PLOT_TOP as usize..PLOT_BOT as usize {
            let f = F_MAX * (PLOT_BOT - y as f32 - 0.5) / (PLOT_BOT - PLOT_TOP);
            let b = f / bin_hz;
            let (b0, fb) = (b as usize, b.fract());
            let v = |c: &Vec<f32>| c[b0] * (1.0 - fb) + c[b0 + 1] * fb;
            let db = v(&spec[k0]) * (1.0 - fk) + v(&spec[k1]) * fk;
            let age = smooth(0.0, 40.0, PLAY_X - x as f32) * 0.25 + 0.75;
            let c = palette(((db + 92.0) / 78.0).clamp(0.0, 1.0).powf(1.2));
            img[y * W + x] = [c[0] * age + bg[0] * (1.0 - age), c[1] * age + bg[1] * (1.0 - age), c[2] * age + bg[2] * (1.0 - age)];
        }
    }
    // Faint grid every 1 kHz, ticks on the right.
    for khz in 1..9 {
        let y = (PLOT_BOT - (khz as f32 * 1000.0) / F_MAX * (PLOT_BOT - PLOT_TOP)) as usize;
        for x in 0..W {
            let a = if x as f32 > PLAY_X + 8.0 && (x as f32) < PLAY_X + 8.0 + if khz % 2 == 0 { 22.0 } else { 12.0 } { 0.5 } else { 0.06 };
            let p = &mut img[y * W + x];
            for c in 0..3 { p[c] += ([0.96, 0.93, 0.86][c] - p[c]) * a; }
        }
    }
    // Waveform strip: min and max of the samples behind each column.
    let (wy, wh) = (660.0f32, 44.0f32);
    for x in 0..=(PLAY_X as usize) {
        let t1 = t - (PLAY_X - x as f32) / PXS;
        let t0 = t1 - 1.0 / PXS;
        if t1 <= 0.0 { continue; }
        let (i0, i1) = (((t0.max(0.0)) * SR as f32) as usize, ((t1 * SR as f32) as usize).min(audio.len()));
        if i1 <= i0 { continue; }
        let (mn, mx) = audio[i0..i1].iter().fold((0f32, 0f32), |m, v| (m.0.min(*v), m.1.max(*v)));
        let (ya, yb) = ((wy - mx * wh) as usize, (wy - mn * wh) as usize + 1);
        for y in ya..yb.min(H) {
            let p = &mut img[y * W + x];
            for c in 0..3 { p[c] += ([0.96, 0.93, 0.86][c] - p[c]) * 0.55; }
        }
    }
    // Playhead with a soft glow.
    for y in (PLOT_TOP as usize - 10)..(H - 6) {
        for dx in -6i32..=6 {
            let x = (PLAY_X as i32 + dx) as usize;
            let a = if dx == 0 { 0.95 } else { 0.18 * (-(dx * dx) as f32 / 6.0).exp() };
            let p = &mut img[y * W + x];
            for c in 0..3 { p[c] += ([1.0, 0.353, 0.212][c] - p[c]) * a; }
        }
    }
    let mut out = format!("P6\n{} {}\n255\n", W, H).into_bytes();
    for (i, c) in img.iter().enumerate() {
        let dz = (((i * 7919) % 255) as f32 / 255.0 - 0.5) / 255.0;
        for ch in c { out.push(((ch + dz).clamp(0.0, 1.0) * 255.0).round() as u8); }
    }
    std::fs::File::create(path).unwrap().write_all(&out).unwrap();
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let out = args.get(1).cloned().unwrap_or_else(|| "frames".into());
    let font = args.iter().position(|a| a == "--font").and_then(|i| args.get(i + 1)).cloned().unwrap_or_else(|| "C:/Windows/Fonts/bahnschrift.ttf".into());
    std::fs::create_dir_all(&out).unwrap();
    let f = Font::load(&font);
    // The word, as an image whose rows are tones (row 0 is the highest).
    let size = ROWS as f32 * 0.86 / 0.7;
    let k = size / f.upem;
    let mut polys = Vec::new();
    let mut pen = 4.0;
    for ch in "MOTION".chars() {
        let g = f.index(ch);
        let mut cs = Vec::new();
        f.contours(g, 0.0, 0.0, &mut cs);
        let px = pen;
        let tf = move |u: f32, v: f32| (px + u * k, ROWS as f32 * 0.93 - v * k);
        for c in &cs { if c.len() > 1 { polys.push(polyline(c, &tf)); } }
        pen += f.advance(g) * k + size * 0.06;
    }
    let iw = pen.ceil() as usize + 4;
    let img = coverage(&polys, iw, ROWS);
    println!("word image {}x{}, {:.2} s of sound", iw, ROWS, iw as f32 / COLS_PER_SEC);
    let audio = synth(&img, iw);
    write_wav(&format!("{}/audio.wav", out), &audio);
    let spec = stft(&audio);
    for fr in 0..(DUR * 30.0) as usize {
        render(fr as f32 / 30.0, &spec, &audio, &format!("{}/f_{:04}.ppm", out, fr));
    }
    println!("done");
}
