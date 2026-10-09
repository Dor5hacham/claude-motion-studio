/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Writes the README art, 20 animated SVGs, into media/readme/art/:
//  - banner.svg: the project drawn as a motion editor timeline
//  - track-*.svg: one 1280x64 strip per README chapter, each moving with one named easing
//  - pipeline.svg, prompt-anatomy.svg, catalog-overview.svg, footer.svg
//  - ease-*.svg: eight 120x96 easing glyphs for the vocabulary table
// The counts come from scripts/catalog.json, so export the catalog first.
// Usage: node scripts/export_catalog.mjs && node scripts/make_readme_art.mjs
// Every file is linted after writing (ASCII only, copyright on line 2, no script, foreignObject,
// href, external url or @import, no event handlers, byte budget, reduced-motion query).
// The script exits with code 1 if a check fails.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'media', 'readme', 'art');
const CATALOG = path.join(ROOT, 'scripts', 'catalog.json');

if (!fs.existsSync(CATALOG)) {
  console.error('scripts/catalog.json is missing. Run node scripts/export_catalog.mjs first.');
  process.exit(1);
}
const cards = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));

// ---------- palette, fonts and shared helpers ----------

const C = { bg: '#0b0b10', panel: '#14141c', line: '#2a2a38', text: '#ece7de', dim: '#a39e96',
  coral: '#ff5a36', amber: '#ffb020', cyan: '#2bc4e6', violet: '#7a5cff', green: '#5fd38d' };
const DISPLAY = "Bahnschrift, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'Cascadia Mono', Consolas, 'SF Mono', Menlo, monospace";
const COPYRIGHT = '<!-- Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved. SPDX-License-Identifier: Proprietary -->';
const RM = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';

// Catalog sections in README order: key, full name, short label, color.
const SECTIONS = [
  ['reel', 'The reel, scene by scene', 'reel', C.text], ['type', 'Text in motion', 'type', C.coral],
  ['mg', '2D motion graphics', '2D', C.coral], ['ui', 'App and web UI motion', 'UI', C.coral],
  ['sim', 'Simulation and generative art', 'sim', C.cyan], ['gpu', 'GPU shaders', 'GPU', C.violet],
  ['audio', 'Sound and motion', 'sound', C.amber], ['libs', 'Animation libraries', 'libs', C.cyan],
  ['engine', '3D engines (Blender, Unreal)', '3D', C.green], ['tools', 'Code-to-video tools', 'tools', C.violet],
  ['edit', 'Editing and post-production', 'edit', C.amber], ['scratch', 'Built from scratch', 'scratch', C.green],
];
const count = (pred) => cards.filter(pred).length;
const TOTAL = cards.length, LIVE = count((c) => c.kind === 'live'), CLIPS = TOTAL - LIVE;
const perCat = (cat) => ({ n: count((c) => c.cat === cat), live: count((c) => c.cat === cat && c.kind === 'live'),
  clips: count((c) => c.cat === cat && c.kind === 'clip') });

// Bahnschrift advance widths in 1/100 em for ASCII 32..126, measured in Chrome on Windows (the same at every weight).
// Display text gets textLength from these, so a fallback font is stretched or squeezed to the same width.
const BAHN = [27, 27, 38, 62, 57, 69, 65, 18, 34, 34, 43, 53, 23, 48, 23, 38, 54, 33, 52, 53, 57, 54, 51, 50, 56, 51,
  23, 23, 42, 46, 43, 43, 88, 64, 65, 61, 65, 60, 57, 64, 68, 28, 50, 65, 57, 78, 70, 64, 61, 66, 65, 61, 54, 65, 61,
  87, 58, 53, 54, 29, 38, 29, 50, 44, 29, 53, 54, 50, 54, 54, 32, 54, 56, 25, 27, 53, 29, 86, 56, 54, 54, 54, 43, 52,
  33, 56, 50, 77, 52, 48, 49, 36, 28, 36, 51];

const f = (n) => String(Math.round(n * 10) / 10);
const f3 = (n) => String(Math.round(n * 1000) / 1000);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textWidth = (s, size, ls = 0) => [...s].reduce((w, ch) => w + (BAHN[ch.charCodeAt(0) - 32] ?? 55), 0) * size / 100 + ls * s.length;

// Display text: always carries textLength so fallback fonts cannot overflow.
function dtext(x, y, s, size, o = {}) {
  const { weight = 600, ls = 0, anchor, fill = C.text, attrs = '' } = o;
  return `<text class="d" x="${f(x)}" y="${f(y)}" font-size="${size}" font-weight="${weight}"${ls ? ` letter-spacing="${ls}"` : ''}` +
    ` textLength="${f(textWidth(s, size, ls))}" lengthAdjust="spacingAndGlyphs"${anchor ? ` text-anchor="${anchor}"` : ''} fill="${fill}"${attrs}>${esc(s)}</text>`;
}
// Mono text (the default family of every file).
function mtext(x, y, s, size, o = {}) {
  const { weight, ls, anchor, fill = C.text, attrs = '' } = o;
  return `<text x="${f(x)}" y="${f(y)}" font-size="${size}"${weight ? ` font-weight="${weight}"` : ''}${ls ? ` letter-spacing="${ls}"` : ''}` +
    `${anchor ? ` text-anchor="${anchor}"` : ''} fill="${fill}"${attrs}>${esc(s)}</text>`;
}
// Whole file: XML declaration, copyright, svg root with title and desc, one style block with the reduced-motion rule.
function doc(w, h, title, desc, css, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${COPYRIGHT}\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d">\n` +
    `<title id="t">${esc(title)}</title>\n<desc id="d">${esc(desc)}</desc>\n` +
    `<style>\ntext{font-family:${MONO}}.d{font-family:${DISPLAY}}\n${css}\n${RM}\n</style>\n${body}\n</svg>\n`;
}
// Dark rounded panel with a hairline; transparent outside the corners.
const panel = (w, h, rx = 14, fill = C.bg) => `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="${rx}" fill="${fill}" stroke="${C.line}"/>`;
// Ruler ticks as one path: n steps from x0 to x1, a major tick every `major` steps, ticks rise from baseline yb.
function ruler(x0, x1, yb, n, major, hMinor = 3.5, hMajor = 8, color = C.dim, op = 0.55) {
  let d = '';
  for (let i = 0; i <= n; i++) d += `M${f(x0 + (x1 - x0) * i / n)},${yb}v-${i % major === 0 ? hMajor : hMinor}`;
  return `<path d="${d}" stroke="${color}" stroke-opacity="${op}"/>`;
}
// Keyframe diamond centered on (cx, cy).
const dpath = (cx, cy, r) => `M${f(cx)},${f(cy - r)}l${r},${r}-${r},${r}-${r},-${r}z`;
// Playhead drawn at x = 0: a head at y0 and a line down to y1. Position it with a translate.
function playhead(y0, y1, color = C.coral) {
  return `<line x1="0" y1="${y0 + 8}" x2="0" y2="${y1}" stroke="${color}" stroke-width="5" stroke-opacity=".22"/>` +
    `<line x1="0" y1="${y0 + 8}" x2="0" y2="${y1}" stroke="${color}" stroke-width="1.6"/>` +
    `<path d="M-6,${y0}h12v7l-6,6-6,-6z" fill="${color}"/>`;
}
// Hollow dots at equal time steps along a curve: their spacing shows speed.
const ghosts = (pts, r, stroke, fill = C.panel) =>
  pts.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.1"/>`).join('');
const anim = (name, dur, timing = 'linear', delay = 0) => `animation:${name} ${f3(dur)}s ${timing}${delay ? ` ${f3(delay)}s` : ''} infinite both`;

// ---------- easing functions (the same function draws a curve and drives its keyframes) ----------

function cubic(x1, y1, x2, y2) {
  const bx = (s) => 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s * s * x2 + s ** 3;
  const by = (s) => 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s * s * y2 + s ** 3;
  const fn = (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (bx(m) < t) lo = m; else hi = m; }
    return by((lo + hi) / 2);
  };
  fn.css = `cubic-bezier(${x1},${y1},${x2},${y2})`;
  fn.bez = [x1, y1, x2, y2];
  return fn;
}
// Damped spring with damping ratio z and decay rate zw, pinned to exactly 1 at t = 1.
function makeSpring(z, zw) {
  const w = zw / z, wd = w * Math.sqrt(1 - z * z);
  const x = (u) => 1 - Math.exp(-z * w * u) * (Math.cos(wd * u) + (z * w / wd) * Math.sin(wd * u));
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : x(t) + t * (1 - x(1)));
}
// About 8 percent overshoot: small enough for the chapter strip playhead to stay inside its panel.
const spring = makeSpring(0.62, 5);
const elastic = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1);
const linear = (t) => Math.min(1, Math.max(0, t));
linear.css = 'linear';
const steps7 = (t) => (t >= 1 ? 1 : Math.floor(t * 7 + 1e-9) / 7);
steps7.css = 'steps(7)';
const E = {
  linear, in: cubic(0.42, 0, 1, 1), out: cubic(0, 0, 0.58, 1), inOut: cubic(0.42, 0, 0.58, 1),
  expoOut: cubic(0.16, 1, 0.3, 1), back: cubic(0.34, 1.56, 0.64, 1), elastic, spring, steps7,
};

// Keyframes that move along one axis from a to b with an easing, arriving at endPct and holding to 100%.
// Easings without a CSS form (spring, elastic) get one keyframe per step of the generating function.
function moveKF(name, axis, a, b, endPct, ease, step = 1) {
  const tr = (v) => (axis === 'x' ? `translate(${f(v)}px,0)` : `translate(0,${f(v)}px)`);
  if (ease.css) return `@keyframes ${name}{0%{transform:${tr(a)};animation-timing-function:${ease.css}}${endPct}%,100%{transform:${tr(b)}}}`;
  let s = `@keyframes ${name}{`;
  for (let p = 0; p <= endPct + 1e-9; p += step) s += `${f3(p)}%{transform:${tr(a + (b - a) * ease(p / endPct))}}`;
  return s + `100%{transform:${tr(b)}}}`;
}
// First normalized time at which an easing reaches value v.
function cross(ease, v) {
  for (let t = 0; t <= 1; t += 0.0005) if (ease(t) >= v - 1e-9) return t;
  return 1;
}

const files = {}; // name -> [svg text, byte budget]
const put = (name, text, budget = 12 * 1024) => { files[name] = [text, budget]; };

// ---------- 1. banner ----------
{
  const W = 1280, H = 400, DUR = 8, STILL = 4.7;
  const T0 = 186, T1 = 1250, PPS = (T1 - T0) / DUR;
  const tx = (s) => +(T0 + s * PPS).toFixed(1);
  const RULER_Y = 52, RULER_H = 28, TITLE_Y = 90, TITLE_H = 142, LANE_Y = 242, LANE_H = 22, LANE_GAP = 6;
  const BOTTOM = LANE_Y + 5 * (LANE_H + LANE_GAP) - LANE_GAP;
  const L = (i) => LANE_Y + i * (LANE_H + LANE_GAP);
  const o = [];
  const p = (s) => o.push(s);
  // keyframe that pops and rings when the playhead crosses time s (negative delay keeps it in phase from the start)
  const diamond = (s, cy, color, r = 6) => {
    const d = dpath(tx(s), cy, r), dl = `animation-delay:${f3(s - DUR)}s`;
    return `<path class="ring" d="${d}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0" style="${dl}"/>` +
      `<path class="kf" d="${d}" fill="${color}" stroke="${C.bg}" stroke-width="1.5" style="${dl}"/>`;
  };
  const clip = (a, b, y, color, label, keys) => {
    const x = tx(a), w = tx(b) - x;
    let s = `<rect x="${x}" y="${y + 2}" width="${f(w)}" height="${LANE_H - 4}" rx="4" fill="${color}" fill-opacity=".16" stroke="${color}" stroke-opacity=".55"/>`;
    s += `<rect x="${x}" y="${y + 2}" width="3" height="${LANE_H - 4}" rx="1.5" fill="${color}"/>`;
    s += `<text x="${f(x + 10)}" y="${y + LANE_H / 2 + 4.2}" class="clip" fill="${color}">${label}</text>`;
    for (const k of keys) s += diamond(k, y + LANE_H / 2, color);
    return s;
  };

  // graph editor geometry (ease-out-back) and the still pose of its sample dot at the overshoot peak
  const back = E.back, [b1, b2, b3, b4] = back.bez;
  const bxs = (s) => 3 * (1 - s) ** 2 * s * b1 + 3 * (1 - s) * s * s * b3 + s ** 3;
  const bys = (s) => 3 * (1 - s) ** 2 * s * b2 + 3 * (1 - s) * s * s * b4 + s ** 3;
  let peakS = 0;
  for (let s = 0; s <= 1; s += 0.0005) if (bys(s) > bys(peakS)) peakS = s;
  const peakT = bxs(peakS), peakV = bys(peakS);

  const css = `.clip{font-size:12px;font-weight:600;letter-spacing:.02em}
.lab{font-size:12.5px;font-weight:700;letter-spacing:.14em}
.ph{${anim('ph', DUR)}}
@keyframes ph{from{transform:translate(${T0}px,0)}to{transform:translate(${T1}px,0)}}
.kf{transform-box:fill-box;transform-origin:center;${anim('kf', DUR, 'ease-out')}}
@keyframes kf{0%{transform:scale(1.7)}9%,100%{transform:scale(1)}}
.ring{transform-box:fill-box;transform-origin:center;${anim('ring', DUR, 'ease-out')}}
@keyframes ring{0%{opacity:1;transform:scale(1)}12%,100%{opacity:0;transform:scale(2.8)}}
.ex{${anim('ex', 2)}}
@keyframes ex{0%{transform:translate(0,0)}75%,100%{transform:translate(280px,0)}}
.ey{${anim('ey', 2)}}
@keyframes ey{0%{transform:translate(0,0);animation-timing-function:${back.css}}75%,100%{transform:translate(0,-64px)}}
.sec{${anim('sec', DUR, `steps(${DUR})`)}}
@keyframes sec{from{transform:translate(0,0)}to{transform:translate(0,-${DUR * 16}px)}}
.fr1{${anim('fr1', 1, 'steps(6)')}}
@keyframes fr1{from{transform:translate(0,0)}to{transform:translate(0,-96px)}}
.fr2{${anim('fr2', 1 / 6, 'steps(10)')}}
@keyframes fr2{from{transform:translate(0,0)}to{transform:translate(0,-160px)}}
.beat{${anim('beat', 0.5, 'ease-out')}}
@keyframes beat{0%{opacity:.9}60%,100%{opacity:.25}}`;

  p(`<defs>
<radialGradient id="glowA" cx=".12" cy=".1" r=".6"><stop offset="0" stop-color="${C.coral}" stop-opacity=".16"/><stop offset="1" stop-color="${C.coral}" stop-opacity="0"/></radialGradient>
<radialGradient id="glowB" cx=".86" cy=".45" r=".5"><stop offset="0" stop-color="${C.violet}" stop-opacity=".16"/><stop offset="1" stop-color="${C.violet}" stop-opacity="0"/></radialGradient>
<linearGradient id="trail" x1="0" x2="1"><stop offset="0" stop-color="${C.coral}" stop-opacity="0"/><stop offset="1" stop-color="${C.coral}" stop-opacity=".13"/></linearGradient>
<linearGradient id="gpu" x1="0" x2="1"><stop offset="0" stop-color="${C.violet}" stop-opacity=".35"/><stop offset="1" stop-color="${C.coral}" stop-opacity=".22"/></linearGradient>
<linearGradient id="titleFill" x1="0" x2="1"><stop offset="0" stop-color="${C.text}"/><stop offset=".72" stop-color="${C.text}"/><stop offset="1" stop-color="${C.amber}"/></linearGradient>
<clipPath id="panel"><rect width="${W}" height="${H}" rx="14"/></clipPath>
<clipPath id="tl"><rect x="${T0 - 2}" y="${RULER_Y}" width="${T1 - T0 + 14}" height="${BOTTOM - RULER_Y + 8}"/></clipPath>
<clipPath id="tc"><rect x="-6" y="-12" width="12" height="16"/></clipPath>
</defs>`);
  p(`<g clip-path="url(#panel)">`);
  p(`<rect width="${W}" height="${H}" fill="${C.bg}"/><rect width="${W}" height="${H}" fill="url(#glowA)"/><rect width="${W}" height="${H}" fill="url(#glowB)"/>`);

  // top bar
  p(`<rect width="${W}" height="40" fill="${C.panel}" fill-opacity=".85"/><path d="M0,40.5H${W}" stroke="${C.line}"/>`);
  p(`<path d="M30,13l7,7-7,7-7,-7z" fill="${C.coral}"/>`);
  p(`<text x="48" y="25" class="lab" fill="${C.text}">MOTION STUDIO</text>`);
  p(mtext(184, 25, '/ claude-motion.comp', 12, { fill: C.dim }));
  p(`<g fill="${C.dim}" transform="translate(930,20)"><path d="M-30,-6v12M-28,0l9,-6v12z" stroke="${C.dim}" stroke-width="1.6"/><path d="M-6,-6l11,6-11,6z" fill="${C.coral}"/><path d="M28,-6v12M26,0l-9,-6v12z" stroke="${C.dim}" stroke-width="1.6"/></g>`);
  // timecode 00:0S:FF, one fixed slot per character
  {
    const x0 = 1012, slot = 8.6, xs = [...Array(8)].map((_, i) => f(x0 + slot * i + slot / 2));
    const col = (n) => [...Array(n)].map(() => '0').join(' ');
    const ys = (n) => [...Array(n)].map((_, i) => i * 16).join(' ');
    const digits = (n) => [...Array(n)].map((_, i) => i).join('');
    const sIdx = Math.floor(STILL), fr = Math.round((STILL % 1) * 60);
    p(`<g font-size="12.5" font-weight="700" fill="${C.amber}" text-anchor="middle">`);
    p(`<text x="${xs.slice(0, 4).join(' ')}" y="25">00:0</text><text x="${xs[5]}" y="25">:</text>`);
    p(`<g transform="translate(${xs[4]},25)" clip-path="url(#tc)"><g class="sec" transform="translate(0,${-sIdx * 16})"><text x="${col(8)}" y="${ys(8)}">${digits(8)}</text></g></g>`);
    p(`<g transform="translate(${xs[6]},25)" clip-path="url(#tc)"><g class="fr1" transform="translate(0,${-Math.floor(fr / 10) * 16})"><text x="${col(6)}" y="${ys(6)}">${digits(6)}</text></g></g>`);
    p(`<g transform="translate(${xs[7]},25)" clip-path="url(#tc)"><g class="fr2" transform="translate(0,${-(fr % 10) * 16})"><text x="${col(10)}" y="${ys(10)}">${digits(10)}</text></g></g>`);
    p(`</g>`);
    p(mtext(1100, 25, '60 fps  1920x1080', 12, { fill: C.dim }));
  }

  // track header column and ruler
  p(`<rect x="0" y="41" width="${T0 - 12}" height="${H - 41}" fill="${C.panel}" fill-opacity=".55"/><path d="M${T0 - 11.5},41V${H}" stroke="${C.line}"/>`);
  p(mtext(24, RULER_Y + 19, 'TRACKS', 12, { fill: C.dim, ls: '.14em' }));
  p(`<rect x="${T0 - 10}" y="${RULER_Y}" width="${W - T0 + 10}" height="${RULER_H}" fill="${C.panel}" fill-opacity=".7"/>`);
  p(ruler(tx(0), tx(DUR), RULER_Y + RULER_H, DUR * 10, 10, 3.5, 12));
  for (let i = 0; i < DUR; i++) p(mtext(tx(i) + 4, RULER_Y + 13, `${String(i).padStart(2, '0')}:00`, 11, { fill: C.dim }));
  p(`<rect x="${tx(0)}" y="${RULER_Y}" width="${tx(DUR) - tx(0)}" height="2" fill="${C.coral}" fill-opacity=".6"/>`);

  // lanes
  const lanes = [['TYPE', C.coral, 'type'], ['GPU', C.violet, 'gpu'], ['SIM', C.cyan, 'sim'], ['3D', C.green, 'engine'], ['AUDIO', C.amber, 'audio']];
  let grid = '';
  for (let i = 0; i <= DUR * 2; i++) grid += `M${tx(i / 2)},${TITLE_Y}V${BOTTOM}`;
  p(`<path d="${grid}" stroke="${C.line}" stroke-opacity=".45" stroke-dasharray="2 4"/>`);
  lanes.forEach(([name, color, cat], i) => {
    const y = L(i);
    p(`<rect x="${T0 - 10}" y="${y}" width="${W - T0 + 10}" height="${LANE_H}" fill="${C.panel}" fill-opacity=".45"/>`);
    p(`<rect x="24" y="${y + 5}" width="4" height="${LANE_H - 10}" rx="2" fill="${color}"/>`);
    p(`<text x="38" y="${y + LANE_H / 2 + 4.5}" class="lab" fill="${C.text}" fill-opacity=".85">${name}</text>`);
    p(mtext(T0 - 26, y + LANE_H / 2 + 4, String(perCat(cat).n), 11.5, { fill: C.dim, anchor: 'end' }));
  });

  // title track header
  p(`<rect x="24" y="${TITLE_Y + 10}" width="4" height="${TITLE_H - 20}" rx="2" fill="${C.coral}"/>`);
  p(`<text x="38" y="${TITLE_Y + 24}" class="lab" fill="${C.coral}">TITLE</text>`);
  p(mtext(38, TITLE_Y + 44, `${TOTAL} techniques`, 11.5, { fill: C.dim }));
  p(mtext(38, TITLE_Y + 61, `${LIVE} live`, 11.5, { fill: C.dim }));
  p(mtext(38, TITLE_Y + 78, `${CLIPS} clips`, 11.5, { fill: C.dim }));

  p(`<g clip-path="url(#tl)">`);
  // selected title layer
  const cx0 = tx(0.05), cx1 = tx(5.1);
  p(`<rect x="${cx0}" y="${TITLE_Y}" width="${f(cx1 - cx0)}" height="${TITLE_H}" rx="8" fill="${C.panel}" fill-opacity=".9" stroke="${C.coral}" stroke-opacity=".9" stroke-width="1.5"/>`);
  p(`<rect x="${cx0 + 1}" y="${TITLE_Y + 1}" width="${f(cx1 - cx0 - 2)}" height="22" rx="7" fill="${C.coral}" fill-opacity=".14"/>`);
  p(mtext(cx0 + 12, TITLE_Y + 16, 'TITLE.LAYER  ease-out-expo  45 ms stagger', 12, { fill: C.coral, weight: 700, ls: '.06em' }));
  p(`<rect x="${f(cx0 - 3)}" y="${TITLE_Y + TITLE_H / 2 - 14}" width="6" height="28" rx="3" fill="${C.coral}"/><rect x="${f(cx1 - 3)}" y="${TITLE_Y + TITLE_H / 2 - 14}" width="6" height="28" rx="3" fill="${C.coral}"/>`);
  p(dtext(cx0 + 22, TITLE_Y + 90, 'Motion Studio', 78, { weight: 700, ls: -1.5, fill: 'url(#titleFill)' }));
  p(mtext(cx0 + 25, TITLE_Y + 121, 'what Claude can animate, what it is called, and how to ask for it', 13.5, { fill: C.dim }));
  for (const k of [0.05, 0.6, 1.4, 5.1]) p(diamond(k, TITLE_Y + TITLE_H, C.coral, 6.5));

  // graph editor
  const gx = tx(5.3), gy = TITLE_Y, gw = T1 + 6 - gx, gh = TITLE_H;
  p(`<rect x="${gx}" y="${gy}" width="${f(gw)}" height="${gh}" rx="8" fill="${C.panel}" fill-opacity=".75" stroke="${C.line}"/>`);
  const cw = 280, ch = 64, ox = +(gx + (gw - cw) / 2).toFixed(1), oy = gy + gh - 28;
  let gg = '';
  for (let i = 0; i <= 4; i++) gg += `M${ox},${f(oy - i * ch / 4)}h${cw}M${f(ox + i * cw / 4)},${oy}v${-ch}`;
  p(`<path d="${gg}" stroke="${C.line}"/>`);
  p(mtext(gx + gw - 12, gy + 19, 'GRAPH  ease-out-back', 12, { fill: C.amber, weight: 700, ls: '.06em', anchor: 'end' }));
  p(mtext(gx + gw - 12, gy + gh - 8, 'cubic-bezier(.34, 1.56, .64, 1)', 12, { fill: C.dim, anchor: 'end' }));
  p(`<path d="M${ox},${oy}L${ox + cw},${oy - ch}" stroke="${C.dim}" stroke-opacity=".45" stroke-dasharray="3 4"/>`);
  const h1 = [f(ox + b1 * cw), f(oy - b2 * ch)], h2 = [f(ox + b3 * cw), f(oy - b4 * ch)];
  p(`<path d="M${ox},${oy}L${h1}M${ox + cw},${oy - ch}L${h2}" stroke="${C.violet}" stroke-width="1.2"/>`);
  p(`<circle cx="${h1[0]}" cy="${h1[1]}" r="3.5" fill="${C.bg}" stroke="${C.violet}" stroke-width="1.5"/><circle cx="${h2[0]}" cy="${h2[1]}" r="3.5" fill="${C.bg}" stroke="${C.violet}" stroke-width="1.5"/>`);
  const curve = `M${ox},${oy}C${h1} ${h2} ${ox + cw},${oy - ch}`;
  p(`<path d="${curve}" fill="none" stroke="${C.amber}" stroke-width="5" stroke-opacity=".18"/><path d="${curve}" fill="none" stroke="${C.amber}" stroke-width="2.2" stroke-linecap="round"/>`);
  p(ghosts([...Array(9)].map((_, i) => [ox + (i / 8) * cw, oy - back(i / 8) * ch]), 2.8, C.text));
  p(`<path d="${dpath(ox, oy, 5)}${dpath(ox + cw, oy - ch, 5)}" fill="${C.amber}"/>`);
  // overshoot dimension mark at the peak
  {
    const px = ox + peakT * cw, y1 = oy - ch, yp = oy - peakV * ch, ex = ox + cw, mx = ex + 22;
    p(`<path d="M${f(px)},${f(yp)}H${f(mx + 5)}" stroke="${C.text}" stroke-opacity=".55" stroke-dasharray="2 2"/>`);
    p(`<path d="M${f(ex + 9)},${f(y1)}H${f(mx + 5)}M${f(mx)},${f(yp)}V${f(y1)}" stroke="${C.text}" stroke-opacity=".8"/>`);
    p(mtext(gx + gw - 12, yp - 9, `+${Math.round((peakV - 1) * 100)}% overshoot`, 12, { fill: C.text, anchor: 'end', attrs: ' fill-opacity=".85"' }));
  }
  // sample dot: x linear, y eased with the same curve; the still pose sits at the overshoot peak
  const sx = peakT * cw, sy = -peakV * ch;
  p(`<g class="ex" transform="translate(${f(sx)},0)"><g class="ey" transform="translate(0,${f(sy)})"><circle cx="${ox}" cy="${oy}" r="9" fill="${C.coral}" fill-opacity=".25"/><circle cx="${ox}" cy="${oy}" r="5" fill="${C.coral}"/></g></g>`);
  p(`<g class="ey" transform="translate(0,${f(sy)})"><path d="M${ox - 16},${oy - 4}l6,4-6,4z" fill="${C.coral}"/></g>`);

  // lanes content
  p(clip(0.1, 2.2, L(0), C.coral, 'scramble decode', [0.1, 1.2, 2.2]));
  p(clip(2.4, 4.6, L(0), C.coral, 'split-flap board', [2.4, 3.6]));
  p(clip(4.8, 7.9, L(0), C.coral, 'particle text', [4.8, 6.1, 7.9]));
  {
    const y = L(1), x = tx(0), w = tx(5.2) - x;
    p(`<rect x="${x}" y="${y + 2}" width="${f(w)}" height="${LANE_H - 4}" rx="4" fill="url(#gpu)" stroke="${C.violet}" stroke-opacity=".6"/><rect x="${x}" y="${y + 2}" width="3" height="${LANE_H - 4}" rx="1.5" fill="${C.violet}"/>`);
    p(`<text x="${f(x + 10)}" y="${y + LANE_H / 2 + 4.2}" class="clip" fill="${C.text}">400,000 GPU particles</text>`);
    for (const k of [1.8, 3.2, 5.2]) p(diamond(k, y + LANE_H / 2, C.violet));
    p(clip(5.4, 8, y, C.violet, 'ray-marched blobs', [6.7]));
  }
  p(clip(0.9, 4.0, L(2), C.cyan, 'fluid simulation', [0.9, 2.5, 4.0]));
  p(clip(4.2, 7.2, L(2), C.cyan, 'reaction-diffusion', [5.7, 7.2]));
  p(clip(0.3, 2.8, L(3), C.green, 'rigid-body smash', [2.1]));
  p(clip(3.0, 5.6, L(3), C.green, 'Blender cloth', [4.4]));
  p(clip(5.8, 7.95, L(3), C.green, 'Unreal Niagara', [7.0]));
  {
    const y = L(4), mid = y + LANE_H / 2;
    let wf = '';
    for (let x = tx(0) + 1; x < tx(DUR); x += 4) {
      const s = (x - T0) / PPS, beat = Math.exp(-((s % 0.5) * 9));
      const n = 0.35 + 0.35 * Math.abs(Math.sin(s * 17.3) * Math.sin(s * 5.1 + 1)) + 0.5 * beat;
      const a = Math.round(Math.min(LANE_H / 2 - 2, (LANE_H / 2 - 2) * n));
      wf += `M${Math.round(x)},${mid - a}v${2 * a}`;
    }
    p(`<path d="${wf}" stroke="${C.amber}" stroke-opacity=".75" stroke-width="2" stroke-linecap="round"/>`);
    let beats = '';
    for (let i = 0; i < DUR * 2; i++) beats += `<rect class="beat" x="${f(tx(i * 0.5) - 1)}" y="${y}" width="2" height="${LANE_H}" fill="${C.amber}" opacity=".25"/>`;
    p(beats);
  }

  // playhead
  p(`<g class="ph" transform="translate(${tx(STILL)},0)">`);
  p(`<rect x="-150" y="${TITLE_Y - 4}" width="150" height="${BOTTOM - TITLE_Y + 8}" fill="url(#trail)"/>`);
  p(`<path d="M0,${RULER_Y + 18}V${BOTTOM + 8}" stroke="${C.coral}" stroke-width="5" stroke-opacity=".3"/><path d="M0,${RULER_Y + 18}V${BOTTOM + 8}" stroke="${C.coral}" stroke-width="1.6"/>`);
  p(`<path d="M-8,${RULER_Y + 2}h16v12l-8,8-8,-8z" fill="${C.coral}"/>`);
  p(`</g></g>`);
  p(`<path d="M0,${H - 12.5}H${W}" stroke="${C.line}" stroke-opacity=".6"/>`);
  p(`</g>`);
  p(`<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${C.line}"/>`);

  put('banner.svg', doc(W, H, 'Motion Studio',
    `Motion Studio drawn as a motion editor: a title layer, five tracks of catalog clips (${TOTAL} techniques, ${LIVE} live, ${CLIPS} clips), an ease-out-back curve in a graph editor and a playhead that sweeps across.`,
    css, o.join('\n')), 35 * 1024);
}

// ---------- 2. chapter strips ----------
// Each strip has two layouts in one file. The SVG picks one with a media query on its own rendered width:
// wide (the README column on a desktop) shows the ruler, clip bar and labelled keyframes at 17 px;
// narrow (a phone, under 600 px) shows only the track number and easing in 40 px type, so it stays readable.
{
  const W = 1280, H = 64, X0 = 228, X1 = 1140, SPAN = X1 - X0, DUR = 8, RUN = 20; // sweep is 1.6 s = 20 percent of 8 s
  const LS = 17, CW = LS * 0.62; // label size and a safe mono advance (Cascadia, Consolas, Menlo, Courier New)
  const NX0 = 300, NX1 = 1160; // narrow-layout bar; a 10 percent overshoot still ends inside the panel
  const chapters = [
    ['quick-start', C.coral, 'expo-out', E.expoOut, ['open index.html', 'watch', 'learn', 'copy', 'rebuild']],
    ['requirements', C.dim, 'linear', E.linear, ['Chrome or Edge 113+', 'Node 24', 'FFmpeg', 'Blender 5.2', 'Unreal 5.8', 'Rust and Go']],
    ['tutorial', C.amber, 'ease-in-out', E.inOut, ['1 how a video gets made', '2 motion vocabulary', '3 how to prompt']],
    ['catalog', C.violet, 'back', E.back, SECTIONS.map((s) => [s[2], s[3]])],
    ['cheat-sheet', C.cyan, 'spring', E.spring, ['template', 'which tool', 'habits']],
    ['tools', C.green, 'ease-out', E.out, ['browser', 'GPU', 'Blender', 'Unreal', 'FFmpeg', 'Python', 'Rust and Go']],
    ['reproduce', C.coral, 'steps(7)', E.steps7, ['reels', 'Blender', 'Unreal', 'tools', 'edits', 'scratch', 'checks']],
  ];
  chapters.forEach(([slug, color, easeName, ease, keys], idx) => {
    const n = keys.length, small = n > 8, r = small ? 5 : 6.5, num = String(idx).padStart(2, '0');
    // keyframes sit after their labels with equal free space between them; the last label ends inside
    // the clip bar, clear of the parked playhead. steps(7) keyframes sit on the seven step positions.
    const need = keys.map((k) => r + 6 + (Array.isArray(k) ? k[0] : k).length * CW);
    const free = (SPAN - 0.03 * SPAN - 14 - need.reduce((a, b) => a + b, 0)) / (n - 1);
    if (free < 8) throw new Error(`track-${slug}.svg: the labels do not fit at ${LS} px`);
    const fracs = keys.map((_, i) => (ease === E.steps7 ? i / 7
      : 0.03 + need.slice(0, i).reduce((a, b) => a + b + free, 0) / SPAN));
    const o = [panel(W, H), '<g class="wide">'];
    let css = `.nar{display:none}\n@media (max-width:600px){.wide{display:none}.nar{display:inline}}\n` +
      `.k{transform-box:fill-box;transform-origin:center}\n.ph{${anim('ph', DUR)}}\n${moveKF('ph', 'x', X0, X1, RUN, ease, 0.5)}\n` +
      `.ph2{${anim('ph2', DUR)}}\n${moveKF('ph2', 'x', NX0, NX1, RUN, ease, 0.5)}\n`;
    // track header
    o.push(`<rect x="18" y="14" width="4" height="38" rx="2" fill="${color}"/>`);
    o.push(mtext(32, 30, `TRACK ${num}`, 18, { weight: 700, ls: '.12em' }));
    o.push(mtext(32, 52, easeName, 16, { fill: C.dim }));
    o.push(`<path d="M200.5,10V54" stroke="${C.line}"/>`);
    // ruler and equal-time ghost dots of the playhead
    o.push(ruler(X0, X1, 15, 40, 10, 3, 7));
    o.push(ghosts([...Array(9)].map((_, i) => [X0 + ease(i / 8) * SPAN, 7]), 2.4, color, C.bg));
    o.push(mtext(1256, 46, '1.6 s', 15, { fill: C.dim, anchor: 'end' }));
    // clip bar
    o.push(`<rect x="${X0}" y="22" width="${SPAN}" height="36" rx="6" fill="${color}" fill-opacity=".12" stroke="${color}" stroke-opacity=".45"/><rect x="${X0}" y="22" width="3" height="36" rx="1.5" fill="${color}"/>`);
    // keyframes: a hollow marker that lights up when the playhead crosses it
    keys.forEach((k, i) => {
      const [label, kc] = Array.isArray(k) ? k : [k, color];
      const x = X0 + fracs[i] * SPAN, pct = cross(ease, fracs[i]) * RUN;
      const d = dpath(x, 40, r);
      o.push(`<path d="${d}" fill="${C.bg}" stroke="${kc}" stroke-opacity=".6"/><path class="k k${i}" d="${d}" fill="${kc}" stroke="${C.bg}"/>`);
      o.push(mtext(x + r + 6, 46, label, LS, { attrs: ' fill-opacity=".9"' }));
      css += `.k${i}{${anim('k' + i, DUR, 'ease-out')}}@keyframes k${i}{0%,${f3(pct)}%{opacity:0;transform:scale(1.9)}${f3(pct + 2.5)}%,100%{opacity:1;transform:scale(1)}}\n`;
    });
    o.push(`<g class="ph" transform="translate(${X1},0)">${playhead(3, 61)}</g>`);
    o.push('</g>');
    // narrow layout: about 0.3 scale on a phone, so 40 px type shows at about 12 px
    o.push('<g class="nar">');
    o.push(`<rect x="20" y="10" width="8" height="44" rx="4" fill="${color}"/>`);
    o.push(mtext(44, 47, `TRACK ${num}`, 40, { weight: 700, ls: '.1em' }));
    o.push(`<rect x="${NX0}" y="8" width="${NX1 - NX0}" height="48" rx="8" fill="${color}" fill-opacity=".12" stroke="${color}" stroke-opacity=".5" stroke-width="2"/>`);
    o.push(mtext(NX0 + 24, 46, easeName, 36, { fill: C.dim }));
    o.push(`<g class="ph2" transform="translate(${NX1},0)"><path d="M0,14V62" stroke="${C.coral}" stroke-width="5"/><path d="M-13,2h26v12l-13,11-13,-11z" fill="${C.coral}"/></g>`);
    o.push('</g>');
    put(`track-${slug}.svg`, doc(W, H, `Track ${num}, ${easeName}`,
      `Chapter strip: a playhead sweeps the track with ${easeName} motion and lights keyframes for ${keys.map((k) => (Array.isArray(k) ? k[0] : k)).join(', ')}.`,
      css.trim(), o.join('\n')));
  });
}

// ---------- 3. pipeline ----------
{
  const W = 1280, H = 240, NW = 232, GAP = 88, NX = (W - 4 * NW - 3 * GAP) / 2, NY = 52, NH = 168, PORT = NY + 40, LOOP = 4;
  const nodes = [
    [C.coral, 'INPUT', 'You describe it'], [C.violet, 'CODE', 'Claude writes code'],
    [C.cyan, 'RENDER', 'A renderer draws every frame'], [C.amber, 'ENCODE', 'FFmpeg makes the MP4'],
  ];
  const o = [panel(W, H)];
  let css = '';
  o.push(mtext(24, 31, 'PIPELINE', 12, { fill: C.dim, ls: '.14em', weight: 700 }));
  o.push(mtext(1256, 31, 'prompt > code > frames > MP4', 12, { fill: C.dim, anchor: 'end' }));
  const chip = (x, y, s, color) => {
    const w = s.length * 7.4 + 12;
    return [`<rect x="${f(x)}" y="${y}" width="${f(w)}" height="20" rx="10" fill="${color}" fill-opacity=".12" stroke="${color}" stroke-opacity=".5"/>` +
      mtext(x + w / 2, y + 14, s, 12, { anchor: 'middle' }), w];
  };
  // wires with frame tiles
  for (let i = 0; i < 3; i++) {
    const a = NX + i * (NW + GAP) + NW, b = a + GAP, color = nodes[i][0];
    o.push(`<path d="M${f(a)},${PORT}H${f(b)}" stroke="${color}" stroke-opacity=".55" stroke-width="2"/>`);
    const len = GAP - 34;
    for (let j = 0; j < 3; j++) {
      const park = len * (0.15 + 0.35 * j), delay = -LOOP * (1 - j / 3) - i * 0.4;
      o.push(`<g transform="translate(${f(a + 10)},${PORT - 5})"><g class="tile" style="animation-delay:${f3(delay)}s" transform="translate(${f(park)},0)"><rect width="14" height="10" rx="2" fill="${C.panel}" stroke="${color}"/><rect x="3" y="3" width="8" height="4" rx="1" fill="${color}" fill-opacity=".8"/></g></g>`);
    }
    css = `.tile{${anim('tile', LOOP)}}@keyframes tile{0%{transform:translate(0,0);opacity:0}12%{opacity:1}85%{opacity:1}100%{transform:translate(${len}px,0);opacity:0}}\n`;
  }
  nodes.forEach(([color, kind, title], i) => {
    const x = NX + i * (NW + GAP), y = NY;
    o.push(`<rect x="${f(x)}" y="${y}" width="${NW}" height="${NH}" rx="10" fill="${C.panel}" stroke="${C.line}"/>`);
    o.push(`<path d="M${f(x + 10)},${y + 1.5}h${NW - 20}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`);
    o.push(mtext(x + 14, y + 24, `0${i + 1}  ${kind}`, 12, { fill: color, weight: 700, ls: '.12em' }));
    o.push(dtext(x + 14, y + 47, title, 15));
    o.push(`<path d="M${f(x + 1)},${y + 60}h${NW - 2}" stroke="${C.line}"/>`);
    if (i > 0) o.push(`<circle cx="${f(x)}" cy="${PORT}" r="5" fill="${C.bg}" stroke="${nodes[i - 1][0]}" stroke-width="2"/>`);
    if (i < 3) o.push(`<circle cx="${f(x + NW)}" cy="${PORT}" r="5" fill="${color}"/>`);
    const cx = x + 14, cy = y + 72;
    if (i === 0) {
      [['length', '60 s'], ['look', 'dark, warm'], ['timing', 'on the beat']].forEach(([k, v], r) => {
        const yy = cy + 6 + r * 28;
        o.push(`<circle cx="${f(cx + 4)}" cy="${yy + 8}" r="4" fill="none" stroke="${color}" stroke-width="1.5"/>`);
        o.push(mtext(cx + 16, yy + 12, k, 12) + mtext(x + NW - 14, yy + 12, v, 12, { fill: C.dim, anchor: 'end' }));
      });
    } else if (i === 1) {
      let xx = cx, yy = cy;
      for (const s of ['shaders', 'Canvas', 'React', 'Python', 'Blender scripts']) {
        const w = s.length * 7.4 + 12;
        if (xx + w > x + NW - 12) { xx = cx; yy += 28; }
        o.push(chip(xx, yy, s, color)[0]);
        xx += w + 6;
      }
      o.push(mtext(cx, cy + 82, 'one file per shot', 12, { fill: C.dim }));
    } else if (i === 2) {
      let xx = cx;
      for (const s of ['Chrome on the GPU', 'Blender']) { const [c, w] = chip(xx, cy, s, color); o.push(c); xx += w + 6; }
      o.push(chip(cx, cy + 28, 'Remotion', color)[0]);
      // frame counter 0001 to 3600 in fixed digit slots
      const vals = [1, 450, 900, 1350, 1800, 2250, 2700, 3150, 3600].map((v) => String(v).padStart(4, '0'));
      const sx = [0, 1, 2, 3].map((k) => f(k * 8.6 + 4.3)).join(' ');
      const fx = x + NW - 14 - 4 * 8.6 - 46, fy = cy + 42;
      o.push(mtext(fx - 6, fy, 'frame', 12, { fill: C.dim, anchor: 'end' }));
      o.push(`<g transform="translate(${f(fx)},${fy})" clip-path="url(#fc)"><g class="cnt" transform="translate(0,-${8 * 16})" font-weight="700" fill="${C.text}" text-anchor="middle">` +
        vals.map((v, k) => `<text x="${sx}" y="${k * 16}">${v}</text>`).join('') + `</g></g>`);
      o.push(mtext(fx + 4 * 8.6 + 4, fy, '/3600', 12, { fill: C.dim }));
      o.push(`<rect x="${f(cx)}" y="${cy + 62}" width="${NW - 28}" height="4" rx="2" fill="${C.line}"/><rect class="bar" x="${f(cx)}" y="${cy + 62}" width="${NW - 28}" height="4" rx="2" fill="${color}"/>`);
      o.push(mtext(cx, cy + 86, '60 fps, 1920x1080', 12, { fill: C.dim }));
      css += `.cnt{${anim('cnt', LOOP, 'linear')}}@keyframes cnt{0%{transform:translate(0,0);animation-timing-function:steps(8,end)}90%,100%{transform:translate(0,-128px)}}\n`;
      css += `.bar{transform-box:fill-box;transform-origin:0 50%;${anim('bar', LOOP)}}@keyframes bar{0%{transform:scaleX(0)}90%,100%{transform:scaleX(1)}}\n`;
    } else {
      let xx = cx;
      ['H.264', 'WebM', 'GIF', 'ProRes'].forEach((s, k) => {
        const [c, w] = chip(xx, cy, s, color);
        o.push(`<g class="chip" style="animation-delay:${f3(k * 0.25)}s">${c}</g>`);
        xx += w + 6;
      });
      o.push(mtext(cx, cy + 42, 'ffmpeg -i f/%04d.png', 12, { fill: C.dim }));
      o.push(mtext(cx, cy + 62, '-c:v libx264 out.mp4', 12, { fill: C.dim }));
      o.push(mtext(cx, cy + 86, 'one command per format', 12, { fill: C.dim }));
      css += `.chip{${anim('chip', LOOP, 'ease-out')}}@keyframes chip{0%,70%{opacity:.25}78%,100%{opacity:1}}\n`;
    }
  });
  const body = `<defs><clipPath id="fc"><rect x="0" y="-12" width="${4 * 8.6}" height="16"/></clipPath></defs>\n` + o.join('\n');
  put('pipeline.svg', doc(W, H, 'How a video gets made',
    'A node graph: you describe it (length, look, timing), Claude writes code (shaders, Canvas, React, Python, Blender scripts), a renderer draws every frame (Chrome on the GPU, Blender, Remotion), and FFmpeg makes the MP4 (H.264, WebM, GIF, ProRes). Frame tiles flow along the wires.',
    css.trim(), body));
}

// ---------- 4. easing glyphs ----------
{
  // A nearly square plot (68 across, 48 up), so the curves differ at table size. The back and spring
  // glyphs exaggerate their overshoot (about 21 and 25 percent) so it shows at 96 px.
  const W = 120, H = 96, GX = 26, GW = 68, OY = 80, UNIT = 48, RUN = 70, LOOP = 2;
  const glyphs = [
    ['linear', 'Linear', E.linear], ['in', 'Ease-in', E.in], ['out', 'Ease-out', E.out], ['in-out', 'Ease-in-out', E.inOut],
    ['expo-out', 'Expo-out', E.expoOut], ['back', 'Back, overshoot', cubic(0.34, 1.9, 0.64, 1)], ['elastic', 'Elastic', E.elastic],
    ['spring', 'Spring', makeSpring(0.4, 4.5)],
  ];
  for (const [slug, name, ease] of glyphs) {
    const X = (t) => GX + t * GW, Y = (v) => OY - v * UNIT;
    let curve;
    if (ease === E.linear) {
      curve = `M${X(0)},${Y(0)}L${X(1)},${Y(1)}`;
    } else if (ease.bez) {
      const [a, b, c, d] = ease.bez;
      curve = `M${X(0)},${Y(0)}C${f(X(a))},${f(Y(b))} ${f(X(c))},${f(Y(d))} ${X(1)},${Y(1)}`;
    } else {
      curve = 'M' + [...Array(61)].map((_, i) => `${f(X(i / 60))},${f(Y(ease(i / 60)))}`).join('L');
    }
    const o = [panel(W, H, 8)];
    o.push(`<rect x="6" y="6" width="108" height="84" rx="5" fill="${C.panel}"/>`);
    o.push(`<path d="M${GX},${Y(0) + 0.5}h${GW}M${GX},${Y(1) + 0.5}h${GW}M${GX + 0.5},${Y(0)}V${Y(1)}" stroke="${C.line}" stroke-dasharray="2 3"/>`);
    o.push(`<path d="${curve}" fill="none" stroke="${C.amber}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`);
    o.push(ghosts([...Array(7)].map((_, i) => [X(i / 6), Y(ease(i / 6))]), 2.4, C.text));
    o.push(`<g transform="translate(${GX},${OY})"><g class="gx" transform="translate(${GW},0)"><g class="gy" transform="translate(0,${-UNIT})"><circle r="7" fill="${C.coral}" fill-opacity=".28"/><circle r="4" fill="${C.coral}"/></g></g></g>`);
    const css = `.gx{${anim('gx', LOOP)}}\n${moveKF('gx', 'x', 0, GW, RUN, E.linear)}\n.gy{${anim('gy', LOOP)}}\n${moveKF('gy', 'y', 0, -UNIT, RUN, ease)}`;
    put(`ease-${slug}.svg`, doc(W, H, `${name} curve`,
      `The ${name.toLowerCase()} easing curve with dots at equal time steps; a coral dot runs the curve.`, css, o.join('\n')));
  }
}

// ---------- 5. prompt anatomy ----------
{
  const W = 1280, H = 180, TY = 100, XA = 64, XB = 1224, DUR = 10, SWEEP = 6;
  const parts = ['Deliverable', 'Purpose', 'Look', 'Technique', 'Timeline', 'Motion feel', 'Camera', 'Text on screen', 'Sound', 'Checks'];
  const xs = parts.map((_, i) => 110 + i * ((1180 - 110) / 9));
  const o = [panel(W, H)];
  let css = `.ph{${anim('ph', DUR)}}@keyframes ph{0%{transform:translate(${XA}px,0)}${SWEEP * 10}%,100%{transform:translate(${XB}px,0)}}\n`;
  // bracket over parts 1 to 5
  const bx0 = xs[0] - 34, bx1 = xs[4] + 34, label = 'these five do most of the work', lw = label.length * 7.4 + 20, mid = (bx0 + bx1) / 2;
  o.push(`<path d="M${f(bx0)},34V26H${f(mid - lw / 2)}M${f(mid + lw / 2)},26H${f(bx1)}V34" fill="none" stroke="${C.coral}" stroke-opacity=".7"/>`);
  o.push(mtext(mid, 30, label, 12, { fill: C.coral, anchor: 'middle' }));
  o.push(mtext(1256, 30, '10 PARTS OF A BRIEF', 12, { fill: C.dim, anchor: 'end', ls: '.14em', weight: 700 }));
  // track
  o.push(`<rect x="${XA - 8}" y="${TY - 10}" width="${XB - XA + 16}" height="20" rx="5" fill="${C.panel}" stroke="${C.line}"/>`);
  o.push(`<rect x="${f(bx0)}" y="${TY - 10}" width="${f(bx1 - bx0)}" height="20" rx="5" fill="${C.coral}" fill-opacity=".14" stroke="${C.coral}" stroke-opacity=".5"/>`);
  o.push(ruler(XA, XB, TY + 9, 58, 1000, 3, 3, C.dim, 0.35));
  parts.forEach((name, i) => {
    const x = xs[i], big = i < 5, up = i % 2 === 0, color = big ? C.coral : C.dim;
    const pct = ((x - XA) / (XB - XA)) * SWEEP * 10;
    o.push(`<path d="M${f(x)},${up ? 74 : 112}v${up ? 14 : 14}" stroke="${color}" stroke-opacity=".6"/>`);
    o.push(`<path d="${dpath(x, TY, big ? 9 : 6)}" fill="${color}" stroke="${C.bg}" stroke-width="1.5"/>`);
    const num = String(i + 1).padStart(2, '0');
    o.push(`<g class="l${i}">` + (up
      ? mtext(x, 50, num, 12, { fill: color, anchor: 'middle', weight: 700 }) + dtext(x, 68, name, 13, { anchor: 'middle' })
      : dtext(x, 140, name, 13, { anchor: 'middle' }) + mtext(x, 158, num, 12, { fill: color, anchor: 'middle', weight: 700 })) + `</g>`);
    css += `.l${i}{${anim('l' + i, DUR)}}@keyframes l${i}{0%,${f3(Math.max(0, pct - 0.01))}%{opacity:.35}${f3(pct + 2)}%,100%{opacity:1}}\n`;
  });
  o.push(`<g class="ph" transform="translate(${XB},0)">${playhead(78, 124)}</g>`);
  put('prompt-anatomy.svg', doc(W, H, 'The ten parts of a motion brief',
    `Ten keyframes on one track: ${parts.join(', ')}. The first five do most of the work.`, css.trim(), o.join('\n')));
}

// ---------- 6. catalog overview ----------
{
  const W = 1280, H = 340, BX = 280, MAXW = 840, Y0 = 52, PITCH = 22, LOOP = 8; // about 30 px of padding above and below the rows
  const rows = SECTIONS.map(([cat, name, , color]) => ({ cat, name, color, ...perCat(cat) }));
  const max = Math.max(...rows.map((r) => r.n));
  const colors = [...new Set(rows.filter((r) => r.clips).map((r) => r.color))];
  const pid = (c) => 'h' + c.slice(1);
  let defs = '<defs>';
  for (const c of colors) defs += `<pattern id="${pid(c)}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${c}" fill-opacity=".16"/><rect width="2.5" height="6" fill="${c}" fill-opacity=".9"/></pattern>`;
  defs += `<pattern id="hdim" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${C.dim}" fill-opacity=".16"/><rect width="2.5" height="6" fill="${C.dim}"/></pattern></defs>`;
  const o = [defs, panel(W, H)];
  let css = `.bar{transform-box:fill-box;transform-origin:0 50%}\n`;
  css += `@keyframes grow{0%{transform:scaleX(0);animation-timing-function:${E.expoOut.css}}15%,100%{transform:scaleX(1)}}\n@keyframes fade{0%,8%{opacity:0}16%,100%{opacity:1}}\n`;
  o.push(mtext(24, 32, 'CATALOG', 12, { fill: C.dim, ls: '.14em', weight: 700 }));
  o.push(`<rect x="${BX}" y="22" width="18" height="12" rx="2" fill="${C.dim}"/>` + mtext(BX + 26, 32, 'live in the page', 12, { fill: C.dim }));
  o.push(`<rect x="${BX + 170}" y="22" width="18" height="12" rx="2" fill="url(#hdim)"/>` + mtext(BX + 196, 32, 'rendered clip', 12, { fill: C.dim }));
  o.push(`<text x="1256" y="32" font-size="12" font-weight="700" letter-spacing=".12em" text-anchor="end" fill="${C.dim}"><tspan fill="${C.text}">${TOTAL}</tspan> TECHNIQUES / <tspan fill="${C.text}">${LIVE}</tspan> LIVE / <tspan fill="${C.text}">${CLIPS}</tspan> CLIPS</text>`);
  let grid = '';
  for (let k = 10; k <= max; k += 10) grid += `M${f(BX + (k / max) * MAXW)},${Y0 - 4}V${Y0 + rows.length * PITCH}`;
  o.push(`<path d="${grid}" stroke="${C.line}" stroke-dasharray="2 4"/>`);
  rows.forEach((r, i) => {
    const y = Y0 + i * PITCH, w = (r.n / max) * MAXW, wl = (r.live / max) * MAXW, delay = i * 0.06;
    o.push(mtext(24, y + 15, String(i + 1).padStart(2, '0'), 12, { fill: C.dim }));
    o.push(dtext(52, y + 15.5, r.name, 14, { weight: 500 }));
    let bar = '';
    if (r.live) bar += `<rect x="${BX}" y="${y + 5}" width="${f(wl)}" height="12" rx="2" fill="${r.color}"/>`;
    if (r.clips) bar += `<rect x="${f(BX + wl)}" y="${y + 5}" width="${f(w - wl)}" height="12" rx="2" fill="url(#${pid(r.color)})"/>`;
    o.push(`<g class="bar" style="${anim('grow', LOOP, 'linear', delay)}">${bar}</g>`);
    const detail = r.clips && r.live ? `${r.live} live / ${r.clips} clips` : r.live ? 'all live' : 'all clips';
    const lx = BX + w + 10, nw = textWidth(String(r.n), 14);
    o.push(`<g style="${anim('fade', LOOP, 'linear', delay)}">` + dtext(lx, y + 16, String(r.n), 14, { weight: 700 }) + mtext(lx + nw + 8, y + 15.5, detail, 12, { fill: C.dim }) + `</g>`);
  });
  put('catalog-overview.svg', doc(W, H, 'The catalog at a glance',
    `The ${SECTIONS.length} catalog sections as bars, sized by technique count: ${TOTAL} in total, ${LIVE} live, ${CLIPS} clips. ` +
    rows.map((r) => `${r.name}: ${r.n}`).join('; ') + '.', css.trim(), o.join('\n')));
}

// ---------- 7. footer ----------
{
  const W = 1280, H = 140, RX0 = 660, OUTX = 1196, LOOP = 10;
  const o = [`<defs><linearGradient id="fade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".92"/></linearGradient></defs>`, panel(W, H)];
  const css = `.ph{${anim('ph', LOOP)}}@keyframes ph{0%{transform:translate(${RX0}px,0);animation-timing-function:${E.out.css}}24%,100%{transform:translate(${OUTX}px,0)}}`;
  o.push(dtext(40, 72, 'Every frame from code.', 36, { weight: 600 }));
  o.push(mtext(42, 102, 'Motion Studio / (c) 2026 Dor5hacham / All rights reserved.', 12, { fill: C.dim }));
  // ruler from 00:57 to the out point at 01:00
  const sec = (OUTX - RX0) / 3;
  o.push(ruler(RX0, OUTX, 40, 30, 10, 3, 9));
  for (let i = 0; i < 3; i++) o.push(mtext(RX0 + i * sec + 4, 30, `00:5${7 + i}`, 11, { fill: C.dim }));
  o.push(`<path d="M${OUTX},40V122" stroke="${C.coral}" stroke-dasharray="3 3" stroke-opacity=".7"/>`);
  o.push(`<path d="M${OUTX},18h-34v15h34z" fill="${C.coral}"/>` + mtext(OUTX - 17, 30, 'OUT', 11, { fill: C.bg, anchor: 'middle', weight: 700 }));
  o.push(mtext(OUTX + 8, 30, '01:00', 11, { fill: C.coral }));
  // last clip with the fade-to-black ramp
  const cy = 56, chh = 34, rampX = RX0 + (OUTX - RX0) * 0.5;
  o.push(`<rect x="${RX0}" y="${cy}" width="${OUTX - RX0}" height="${chh}" rx="5" fill="${C.coral}" fill-opacity=".16" stroke="${C.coral}" stroke-opacity=".55"/>`);
  o.push(`<rect x="${f(rampX)}" y="${cy}" width="${f(OUTX - rampX)}" height="${chh}" rx="5" fill="url(#fade)"/>`);
  o.push(`<rect x="${RX0}" y="${cy}" width="3" height="${chh}" rx="1.5" fill="${C.coral}"/>` + mtext(RX0 + 12, cy + 25, 'end card', 12, { fill: C.coral, weight: 600 }));
  o.push(`<path d="M${RX0 + 4},${cy + 6}H${f(rampX)}L${OUTX - 2},${cy + chh - 4}" fill="none" stroke="${C.amber}" stroke-width="1.6"/>`);
  o.push(`<path d="${dpath(rampX, cy + 6, 5)}${dpath(OUTX - 2, cy + chh - 4, 5)}" fill="${C.amber}" stroke="${C.bg}"/>`);
  o.push(mtext(rampX, cy + chh + 18, 'opacity 100% to 0%: fade to black', 12, { fill: C.dim }));
  o.push(`<g class="ph" transform="translate(${OUTX},0)">${playhead(44, 126)}</g>`);
  put('footer.svg', doc(W, H, 'Out point',
    'The out point of the timeline: the playhead stops on OUT after a fade to black. Every frame from code. Motion Studio, (c) 2026 Dor5hacham, all rights reserved.',
    css, o.join('\n')));
}

// ---------- write and lint ----------
fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
const fail = (name, why) => { failed++; console.error(`FAIL ${name}: ${why}`); };
for (const [name, [text, budget]] of Object.entries(files)) {
  fs.writeFileSync(path.join(OUT, name), text);
  const bytes = Buffer.byteLength(text);
  const lines = text.split('\n');
  if (/[^\x09\x0a\x0d\x20-\x7e]/.test(text)) fail(name, 'non-ASCII character');
  if (lines[1] !== COPYRIGHT) fail(name, 'copyright comment is not on line 2');
  for (const bad of ['<script', 'foreignObject', 'href=', 'url(http', '@import']) if (text.includes(bad)) fail(name, `contains ${bad}`);
  if (/\son[a-z]+\s*=/i.test(text)) fail(name, 'contains an event handler attribute');
  if (bytes > budget) fail(name, `${bytes} bytes is over the ${budget} byte budget`);
  if (!text.includes('@media (prefers-reduced-motion:reduce)')) fail(name, 'no reduced-motion media query');
  console.log(`${name.padEnd(26)} ${String(bytes).padStart(6)} bytes`);
}
if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log(`wrote ${Object.keys(files).length} files to media/readme/art/`);
