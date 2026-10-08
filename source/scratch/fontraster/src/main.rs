// TrueType rasterizer written from scratch with the Rust standard library only.
// Reads a font file, decodes a glyph's quadratic outline and animates how it becomes pixels:
// points, curves, a scanline fill with crossings, then anti-aliased coverage at text size.
//
//   fontraster <out_dir> [--frames 240] [--every 1] [--font C:/Windows/Fonts/georgia.ttf] [--labels C:/Windows/Fonts/bahnschrift.ttf]
//
// Writes PPM frames (1280x720, 30 fps) for FFmpeg.

use std::io::Write;
use std::time::Instant;

const W: usize = 1280;
const H: usize = 720;
type Rgb = [f32; 3];
const BG: Rgb = [11.0 / 255.0, 11.0 / 255.0, 16.0 / 255.0];
const CREAM: Rgb = [0.96, 0.93, 0.86];
const CORAL: Rgb = [1.0, 0.353, 0.212];
const CYAN: Rgb = [0.2, 0.75, 1.0];
const AMBER: Rgb = [1.0, 0.72, 0.25];

// ---------- TrueType parsing ----------

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
        let n = u16at(4);
        let mut tab = std::collections::HashMap::new();
        for i in 0..n {
            let r = 12 + 16 * i;
            tab.insert(String::from_utf8_lossy(&d[r..r + 4]).to_string(), u32at(r + 8));
        }
        let head = tab["head"];
        let hhea = tab["hhea"];
        let cmap = tab["cmap"];
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
            n_hmetrics: u16at(hhea + 34),
            upem: u16at(head + 18) as f32,
            d,
        }
    }
    fn u16(&self, o: usize) -> usize { u16::from_be_bytes([self.d[o], self.d[o + 1]]) as usize }
    fn i16(&self, o: usize) -> i32 { i16::from_be_bytes([self.d[o], self.d[o + 1]]) as i32 }
    // Glyph index of a character (cmap format 4).
    fn index(&self, ch: char) -> usize {
        let c = ch as usize;
        let s = self.cmap;
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
    // Contours of a glyph in font units (y up); composite glyphs are flattened with their offsets.
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
                let flags = self.u16(p);
                let gi = self.u16(p + 2);
                p += 4;
                let (ox, oy) = if flags & 1 != 0 {
                    let r = (self.i16(p), self.i16(p + 2));
                    p += 4;
                    r
                } else {
                    let r = (self.d[p] as i8 as i32, self.d[p + 1] as i8 as i32);
                    p += 2;
                    r
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

// Quadratic pieces (start, control, end) of a contour; consecutive off-curve points imply an on-curve midpoint.
fn quads(c: &[Pt]) -> Vec<[(f32, f32); 3]> {
    let n = c.len();
    let mid = |a: Pt, b: Pt| Pt { x: 0.5 * (a.x + b.x), y: 0.5 * (a.y + b.y), on: true };
    let start = (0..n).find(|&i| c[i].on);
    let (s0, first) = match start { Some(i) => (i, c[i]), None => (0, mid(c[0], c[1])) };
    let mut out = Vec::new();
    let mut cur = first;
    let mut ctrl: Option<Pt> = None;
    for k in 1..=n {
        let p = c[(s0 + k) % n];
        if p.on {
            let cp = ctrl.take().unwrap_or(mid(cur, p));
            out.push([(cur.x, cur.y), (cp.x, cp.y), (p.x, p.y)]);
            cur = p;
        } else if let Some(cp) = ctrl {
            let m = mid(cp, p);
            out.push([(cur.x, cur.y), (cp.x, cp.y), (m.x, m.y)]);
            cur = m;
            ctrl = Some(p);
        } else {
            ctrl = Some(p);
        }
    }
    if let Some(cp) = ctrl { out.push([(cur.x, cur.y), (cp.x, cp.y), (first.x, first.y)]); }
    out
}

// Flattens the pieces into a polyline (pixel space) with cumulative lengths.
fn flatten(q: &[[(f32, f32); 3]], tf: &dyn Fn(f32, f32) -> (f32, f32)) -> Vec<(f32, f32)> {
    let mut pts = Vec::new();
    for s in q {
        let (a, b, c) = (tf(s[0].0, s[0].1), tf(s[1].0, s[1].1), tf(s[2].0, s[2].1));
        let len = ((a.0 - b.0).hypot(a.1 - b.1) + (b.0 - c.0).hypot(b.1 - c.1)).max(1.0);
        let n = ((len / 3.0).ceil() as usize).clamp(1, 64);
        if pts.is_empty() { pts.push(a); }
        for k in 1..=n {
            let t = k as f32 / n as f32;
            let u = 1.0 - t;
            pts.push((u * u * a.0 + 2.0 * u * t * b.0 + t * t * c.0, u * u * a.1 + 2.0 * u * t * b.1 + t * t * c.1));
        }
    }
    pts
}

// ---------- signed-area coverage rasterizer ----------

// Adds one edge to the accumulation buffer (width w + 2): each pixel gets the signed area the edge sweeps.
fn acc_line(acc: &mut [f32], w: usize, h: usize, p0: (f32, f32), p1: (f32, f32)) {
    if p0.1 == p1.1 { return; }
    let (dir, p0, p1) = if p0.1 < p1.1 { (1.0, p0, p1) } else { (-1.0, p1, p0) };
    let dxdy = (p1.0 - p0.0) / (p1.1 - p0.1);
    let mut x = p0.0;
    let ys = p0.1.max(0.0);
    if p0.1 < 0.0 { x -= p0.1 * dxdy; }
    let stride = w + 2;
    let xmax = w as f32;
    for y in (ys as usize)..(p1.1.ceil() as usize).min(h) {
        let ls = y * stride;
        let dy = ((y + 1) as f32).min(p1.1) - (y as f32).max(p0.1);
        let xn = x + dxdy * dy;
        let d = dy * dir;
        let (xa, xb) = if x < xn { (x.clamp(0.0, xmax), xn.clamp(0.0, xmax)) } else { (xn.clamp(0.0, xmax), x.clamp(0.0, xmax)) };
        let x0f = xa.floor();
        let x0i = x0f as usize;
        let x1c = xb.ceil();
        let x1i = x1c as usize;
        if x1i <= x0i + 1 {
            let xm = 0.5 * (xa + xb) - x0f;
            acc[ls + x0i] += d - d * xm;
            acc[ls + x0i + 1] += d * xm;
        } else {
            let s = 1.0 / (xb - xa);
            let fa = xa - x0f;
            let a0 = 0.5 * s * (1.0 - fa) * (1.0 - fa);
            let fb = xb - x1c + 1.0;
            let am = 0.5 * s * fb * fb;
            acc[ls + x0i] += d * a0;
            if x1i == x0i + 2 {
                acc[ls + x0i + 1] += d * (1.0 - a0 - am);
            } else {
                let a1 = s * (1.5 - fa);
                acc[ls + x0i + 1] += d * (a1 - a0);
                for xi in x0i + 2..x1i - 1 { acc[ls + xi] += d * s; }
                let a2 = a1 + (x1i - x0i - 3) as f32 * s;
                acc[ls + x1i - 1] += d * (1.0 - a2 - am);
            }
            acc[ls + x1i] += d * am;
        }
        x = xn;
    }
}
// Fills closed polylines into a coverage buffer (w x h) with the nonzero rule.
fn fill(polys: &[Vec<(f32, f32)>], w: usize, h: usize) -> Vec<f32> {
    let stride = w + 2;
    let mut acc = vec![0f32; stride * h];
    for p in polys {
        for k in 0..p.len() { acc_line(&mut acc, w, h, p[k], p[(k + 1) % p.len()]); }
    }
    let mut out = vec![0f32; w * h];
    for y in 0..h {
        let mut s = 0.0;
        for x in 0..w {
            s += acc[y * stride + x];
            out[y * w + x] = s.abs().min(1.0);
        }
    }
    out
}

// ---------- drawing helpers ----------

fn smooth(a: f32, b: f32, x: f32) -> f32 { let t = ((x - a) / (b - a)).clamp(0.0, 1.0); t * t * (3.0 - 2.0 * t) }
fn back_out(t: f32) -> f32 { let t = t.clamp(0.0, 1.0) - 1.0; 1.0 + t * t * (2.7 * t + 1.7) }
fn blend(img: &mut [Rgb], i: usize, c: Rgb, a: f32) {
    let p = &mut img[i];
    for k in 0..3 { p[k] += (c[k] - p[k]) * a.clamp(0.0, 1.0); }
}
// Anti-aliased thick segment.
fn seg(img: &mut [Rgb], a: (f32, f32), b: (f32, f32), r: f32, c: Rgb, alpha: f32) {
    let (x0, x1) = ((a.0.min(b.0) - r - 1.0).max(0.0) as usize, ((a.0.max(b.0) + r + 1.0) as usize).min(W - 1));
    let (y0, y1) = ((a.1.min(b.1) - r - 1.0).max(0.0) as usize, ((a.1.max(b.1) + r + 1.0) as usize).min(H - 1));
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let l2 = (dx * dx + dy * dy).max(1e-6);
    for y in y0..=y1 {
        for x in x0..=x1 {
            let (px, py) = (x as f32 + 0.5 - a.0, y as f32 + 0.5 - a.1);
            let t = ((px * dx + py * dy) / l2).clamp(0.0, 1.0);
            let d = (px - dx * t).hypot(py - dy * t);
            let cov = (r - d + 0.5).clamp(0.0, 1.0);
            if cov > 0.0 { blend(img, y * W + x, c, cov * alpha); }
        }
    }
}
// Filled disc (square = false) or hollow square marker.
fn marker(img: &mut [Rgb], cx: f32, cy: f32, r: f32, square: bool, c: Rgb, alpha: f32) {
    if r <= 0.05 { return; }
    for y in ((cy - r - 2.0).max(0.0) as usize)..=((cy + r + 2.0) as usize).min(H - 1) {
        for x in ((cx - r - 2.0).max(0.0) as usize)..=((cx + r + 2.0) as usize).min(W - 1) {
            let (px, py) = (x as f32 + 0.5 - cx, y as f32 + 0.5 - cy);
            let cov = if square {
                let d = px.abs().max(py.abs());
                ((r - d + 0.5).clamp(0.0, 1.0)) * ((d - (r - 2.0) + 0.5).clamp(0.0, 1.0))
            } else {
                (r - px.hypot(py) + 0.5).clamp(0.0, 1.0)
            };
            if cov > 0.0 { blend(img, y * W + x, c, cov * alpha); }
        }
    }
}

// A line of text rasterized with the same coverage fill, returned as polylines in pixel space.
fn text(f: &Font, s: &str, x: f32, base: f32, size: f32) -> Vec<Vec<(f32, f32)>> {
    let k = size / f.upem;
    let mut pen = x;
    let mut out = Vec::new();
    for ch in s.chars() {
        let g = f.index(ch);
        let mut cs = Vec::new();
        f.contours(g, 0.0, 0.0, &mut cs);
        let px = pen;
        let tf = move |u: f32, v: f32| (px + u * k, base - v * k);
        for c in &cs { if c.len() > 1 { out.push(flatten(&quads(c), &tf)); } }
        pen += f.advance(g) * k;
    }
    out
}

fn render(t: f32, glyph: &[Vec<Pt>], gfont: &Font, labels: &[Vec<f32>; 5], path: &str) {
    let mut img = vec![BG; W * H];
    for (i, p) in img.iter_mut().enumerate() {
        let (x, y) = ((i % W) as f32 / W as f32 - 0.4, (i / W) as f32 / H as f32 - 0.5);
        let v = 1.0 + 0.35 * (1.0 - (x * x + y * y) * 3.0).max(0.0);
        *p = [BG[0] * v, BG[1] * v, BG[2] * v];
    }
    // Big glyph transform: font units to pixels, centered on the left.
    let k = 560.0 / gfont.upem;
    let (gx, gy) = (480.0f32, 600.0f32);
    let tf = |u: f32, v: f32| (gx - 0.36 * gfont.upem * k + u * k, gy - v * k);
    let qs: Vec<Vec<[(f32, f32); 3]>> = glyph.iter().map(|c| quads(c)).collect();
    let polys: Vec<Vec<(f32, f32)>> = qs.iter().map(|q| flatten(q, &tf)).collect();
    let (ymin, ymax) = polys.iter().flatten().fold((f32::MAX, f32::MIN), |a, p| (a.0.min(p.1), a.1.max(p.1)));
    let total: usize = glyph.iter().map(|c| c.len()).sum();
    let fade_struct = 1.0 - 0.85 * smooth(5.6, 6.3, t);

    // Stage 3 and 4: the fill, revealed by the scanline.
    let sweep = ymin - 4.0 + (ymax - ymin + 8.0) * smooth(3.4, 5.4, t);
    if t > 3.4 {
        let cov = fill(&polys, W, H);
        for y in 0..H {
            if y as f32 > sweep { break; }
            for x in 0..W {
                let c = cov[y * W + x];
                if c > 0.0 { blend(&mut img, y * W + x, CREAM, c * 0.92); }
            }
        }
    }
    // Stage 1: control polygon, then the points.
    let mut idx = 0;
    for c in glyph {
        let n = c.len();
        for i in 0..n {
            let appear = 0.25 + 1.4 * (idx as f32 / total as f32);
            let a = tf(c[i].x, c[i].y);
            let b = tf(c[(i + 1) % n].x, c[(i + 1) % n].y);
            let la = smooth(appear, appear + 0.35, t) * 0.32 * fade_struct;
            if la > 0.0 { seg(&mut img, a, b, 0.6, CREAM, la); }
            idx += 1;
        }
    }
    // Stage 2: the curves draw on along each contour.
    let draw = smooth(1.7, 3.4, t);
    if draw > 0.0 {
        for p in &polys {
            let n = p.len();
            let lens: Vec<f32> = (0..n).map(|i| { let (a, b) = (p[i], p[(i + 1) % n]); (b.0 - a.0).hypot(b.1 - a.1) }).collect();
            let tot: f32 = lens.iter().sum();
            let mut left = tot * draw;
            for i in 0..n {
                if left <= 0.0 { break; }
                let (a, b) = (p[i], p[(i + 1) % n]);
                let f = (left / lens[i].max(1e-6)).min(1.0);
                seg(&mut img, a, (a.0 + (b.0 - a.0) * f, a.1 + (b.1 - a.1) * f), 1.6, CYAN, 0.95 * fade_struct.max(0.35));
                left -= lens[i];
            }
        }
    }
    let mut idx = 0;
    for c in glyph {
        for p in c {
            let appear = 0.25 + 1.4 * (idx as f32 / total as f32);
            let s = back_out((t - appear) / 0.35) * if t > appear { 1.0 } else { 0.0 };
            let (x, y) = tf(p.x, p.y);
            if p.on { marker(&mut img, x, y, 4.2 * s, false, CREAM, fade_struct); } else { marker(&mut img, x, y, 5.0 * s, true, CORAL, fade_struct); }
            idx += 1;
        }
    }
    // Scanline with its crossings and the inside spans (nonzero winding).
    let sa = smooth(3.3, 3.5, t) * (1.0 - smooth(5.35, 5.6, t));
    if sa > 0.0 {
        let mut xs: Vec<(f32, i32)> = Vec::new();
        for p in &polys {
            for k in 0..p.len() {
                let (a, b) = (p[k], p[(k + 1) % p.len()]);
                if (a.1 <= sweep) != (b.1 <= sweep) {
                    xs.push((a.0 + (sweep - a.1) / (b.1 - a.1) * (b.0 - a.0), if b.1 > a.1 { 1 } else { -1 }));
                }
            }
        }
        xs.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
        seg(&mut img, (120.0, sweep), (800.0, sweep), 0.7, CORAL, 0.55 * sa);
        let mut wnd = 0;
        for k in 0..xs.len() {
            let prev = wnd;
            wnd += xs[k].1;
            if prev == 0 && wnd != 0 && k + 1 < xs.len() {
                seg(&mut img, (xs[k].0, sweep), (xs[k + 1].0, sweep), 2.2, AMBER, sa);
            }
        }
        for &(x, _) in &xs { marker(&mut img, x, sweep, 4.5, false, CORAL, sa); }
    }
    // Stage 4: the same glyph at text size, magnified pixel by pixel.
    let pa = smooth(5.5, 6.2, t);
    if pa > 0.0 {
        let (cw, ch) = (34usize, 34usize);
        let ks = 30.0 / gfont.upem;
        let tfs = |u: f32, v: f32| (3.5 + u * ks, 27.0 - v * ks);
        let small: Vec<Vec<(f32, f32)>> = qs.iter().map(|q| flatten(q, &tfs)).collect();
        let cov = fill(&small, cw, ch);
        let (ox, oy, cell) = (842.0f32, 318.0f32, 10.0f32);
        for cy in 0..ch {
            let row_a = smooth(5.5 + cy as f32 * 0.03, 5.8 + cy as f32 * 0.03, t);
            for cx in 0..cw {
                let c = cov[cy * cw + cx];
                let base = [0.06, 0.06, 0.085];
                let col = [base[0] + (CREAM[0] - base[0]) * c, base[1] + (CREAM[1] - base[1]) * c, base[2] + (CREAM[2] - base[2]) * c];
                let (x0, y0) = (ox + cx as f32 * cell, oy + cy as f32 * cell);
                for y in (y0 as usize)..((y0 + cell - 1.0) as usize) {
                    for x in (x0 as usize)..((x0 + cell - 1.0) as usize) { blend(&mut img, y * W + x, col, row_a); }
                }
            }
        }
        // Actual size, next to the magnified grid.
        for y in 0..ch {
            for x in 0..cw {
                let c = cov[y * cw + x];
                if c > 0.0 { blend(&mut img, (oy as usize + 153 + y) * W + 1205 + x, CREAM, c * pa); }
            }
        }
    }
    // Stage labels on the right; the active one is coral.
    let stage = if t < 1.7 { 0 } else if t < 3.4 { 1 } else if t < 5.5 { 2 } else { 3 };
    for (k, lab) in labels.iter().enumerate() {
        let (col, a) = if k == 4 { (CREAM, 0.55) } else if k == stage { (CORAL, 1.0) } else { (CREAM, 0.38) };
        let a = a * smooth(0.0, 0.4, t);
        for i in 0..W * H { if lab[i] > 0.0 { blend(&mut img, i, col, lab[i] * a); } }
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
    let geti = |k: &str, d: usize| -> usize { args.iter().position(|a| a == k).and_then(|i| args.get(i + 1)).and_then(|s| s.parse().ok()).unwrap_or(d) };
    let gets = |k: &str, d: &str| -> String { args.iter().position(|a| a == k).and_then(|i| args.get(i + 1)).cloned().unwrap_or_else(|| d.into()) };
    let (frames, every) = (geti("--frames", 240), geti("--every", 1));
    let gfont = Font::load(&gets("--font", "C:/Windows/Fonts/georgia.ttf"));
    let lfont = Font::load(&gets("--labels", "C:/Windows/Fonts/bahnschrift.ttf"));
    std::fs::create_dir_all(&out).unwrap();
    let mut glyph = Vec::new();
    gfont.contours(gfont.index('&'), 0.0, 0.0, &mut glyph);
    println!("glyph '&': {} contours, {} points", glyph.len(), glyph.iter().map(|c| c.len()).sum::<usize>());
    let lines = ["1  Points", "2  Curves", "3  Scanline fill", "4  Coverage", "Georgia &, read from the .ttf"];
    let ys = [150.0, 200.0, 250.0, 300.0, 690.0];
    let sizes = [30.0, 30.0, 30.0, 30.0, 18.0];
    let labels: [Vec<f32>; 5] = std::array::from_fn(|k| {
        fill(&text(&lfont, lines[k], 842.0, ys[k], sizes[k]), W, H)
    });
    let t0 = Instant::now();
    for fr in (0..frames).step_by(every.max(1)) {
        render(fr as f32 / 30.0, &glyph, &gfont, &labels, &format!("{}/f_{:04}.ppm", out, fr));
        if fr % 30 == 0 { println!("frame {} at {:.1}s", fr, t0.elapsed().as_secs_f32()); }
    }
    println!("done {:.1}s", t0.elapsed().as_secs_f32());
}
