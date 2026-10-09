/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Shared helpers and the vocabulary demos for the Motion Studio page:
// easing playground, stagger, squash and stretch, anticipation, prompt builder, copy buttons.
// addLoop(el, fn) runs fn(t) every frame only while el is on screen and returns the loop L.
// redraw(L) runs fn again at the last t while el is on screen, for example after a resize cleared the canvas.
const clamp01 = x => Math.min(1, Math.max(0, x));
const lerp = (a, b, t) => a + (b - a) * t;
/** @type {Record<string, [(x: number) => number, string, string]>} */
const EASES = {
  'linear': [x => x, 'Constant speed. Looks mechanical. Use it only for things like spinning loaders or scrolling tickers.', 'linear'],
  'ease-in': [x => x * x * x, 'Starts slow, ends fast. Good for exits: things that leave the screen.', 'ease-in (cubic) for the exit'],
  'ease-out': [x => 1 - Math.pow(1 - x, 3), 'Starts fast, ends slow. The default for things that enter. Feels responsive.', 'ease-out (cubic) for entrances'],
  'ease-in-out': [x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2, 'Slow start and slow end. Calm and premium. Good for moves from A to B on screen.', 'smooth ease-in-out'],
  'expo-out': [x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x), 'A very fast start that glides to a stop. The modern "snappy" feel of tech promos.', 'ease-out-expo, 400 ms'],
  'back-out': [x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }, 'Goes past the target, then settles back. Called overshoot. Playful and lively.', 'ease-out-back (overshoot)'],
  'elastic': [x => x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (2 * Math.PI) / 3) + 1, 'Wobbles like a rubber band before it stops. Use in small doses.', 'elastic ease-out'],
  'bounce': [x => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375; return n * (x -= 2.625 / d) * x + .984375; }, 'Bounces at the end like a dropped ball.', 'bounce ease-out'],
  'spring': [x => 1 - Math.exp(-6 * x) * Math.cos(11 * x), 'Physics-based. Set by stiffness and damping instead of duration. Used by iOS and Framer Motion.', 'spring (stiffness 300, damping 20)'],
};
const eOut = EASES['ease-out'][0], eInOut = EASES['ease-in-out'][0], eBack = EASES['back-out'][0];
const COLORS = ['#ff5a36', '#ffb020', '#2bc4e6', '#7a5cff', '#ece7de'];

const loops = [];
function addLoop(el, fn) { const L = { el, fn, vis: false, t0: performance.now(), t: 0 }; loops.push(L); guideIO.observe(el); return L; }
const guideIO = new IntersectionObserver(es => es.forEach(e => { for (const L of loops) if (L.el === e.target) L.vis = e.isIntersecting; }), { threshold: 0.05 });
(function frame(now) { for (const L of loops) if (L.vis) L.fn(L.t = (now - L.t0) / 1000); requestAnimationFrame(frame); })(performance.now());
// Reads the layout, not L.vis: a resize can move a canvas into view before the IntersectionObserver reports it.
function redraw(L) { const b = L.el.getBoundingClientRect(); if (b.width && b.bottom > 0 && b.top < innerHeight) L.fn(L.t); }

// addDemo(cv, size, draw) is addLoop for a 2D demo drawn in design units. size(narrow, cw) returns the design
// [W, H]; narrow is true while the canvas shows under 720 css px (phones), so a demo can switch to a layout
// whose text stays readable, and cw is the shown width in css px for demos that need their own switch point. The bitmap follows the shown size times devicePixelRatio, so the drawing is
// sharp at any card width. draw(g, t, W, H, narrow) runs each visible frame with the design scale set.
// A new bitmap size clears the canvas after this frame's draw and before paint, so fit() redraws at once;
// otherwise every frame of a live window resize would show an empty canvas.
function addDemo(cv, size, draw) {
  const g = cv.getContext('2d'); let W = cv.width, H = cv.height, narrow = false;
  const L = addLoop(cv, t => { const k = cv.width / W; g.setTransform(k, 0, 0, k, 0, 0); g.globalAlpha = 1; g.filter = 'none'; draw(g, t, W, H, narrow); });
  const fit = () => {
    const cw = cv.clientWidth; if (!cw) return;
    narrow = cw < 720; [W, H] = size(narrow, cw);
    const w = Math.round(cw * devicePixelRatio), h = Math.round(w * H / W);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; redraw(L); }
  };
  new ResizeObserver(fit).observe(cv); fit();
  return L;
}

// ---------------- easing playground ----------------
(() => {
  const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('c-ease')); if (!cv) return;
  let cur = 'back-out'; const btns = document.getElementById('ease-btns');
  for (const k of Object.keys(EASES)) { const b = document.createElement('button'); b.textContent = k; b.onclick = () => { cur = k; L.t0 = performance.now(); sync(); }; btns.appendChild(b); }
  function sync() { [...btns.children].forEach(b => b.classList.toggle('on', b.textContent === cur)); document.getElementById('ease-desc').textContent = EASES[cur][1]; document.getElementById('ease-say').textContent = EASES[cur][2]; }
  sync();
  // Graph on the left, track on the right; on phones the track goes under the graph.
  const L = addDemo(cv, narrow => narrow ? [500, 430] : [1000, 300], (g, t, W, H, narrow) => {
    const f = EASES[cur][0], cyc = t % 3.2, p = clamp01((cyc - 0.4) / 1.4);
    g.fillStyle = '#08080c'; g.fillRect(0, 0, W, H);
    const gx = narrow ? 60 : 40, gy = narrow ? 24 : 40, gw = narrow ? 400 : 300, gh = 200;
    g.strokeStyle = '#2a2a38'; g.lineWidth = 1; g.strokeRect(gx, gy, gw, gh);
    g.fillStyle = '#6d6a76'; g.font = (narrow ? 15 : 13) + 'px Consolas'; g.fillText('time →', gx + gw - 60, gy + gh + 22); g.save(); g.translate(gx - 12, gy + gh); g.rotate(-Math.PI / 2); g.fillText('position →', 0, 0); g.restore();
    g.strokeStyle = '#ff5a36'; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= 120; i++) { const x = i / 120, y = f(x), X = gx + x * gw, Y = gy + gh - y * gh * 0.8 - gh * 0.1; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
    g.stroke();
    const py = f(p); g.fillStyle = '#fff'; g.beginPath(); g.arc(gx + p * gw, gy + gh - py * gh * 0.8 - gh * 0.1, 6, 0, 7); g.fill();
    const tx = narrow ? 0 : 420, tw = narrow ? 500 : 520, ty = narrow ? 310 : 150;
    g.strokeStyle = '#2a2a38'; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, ty + 40); g.lineTo(tx + tw, ty + 40); g.stroke();
    for (let i = 0; i <= 12; i++) { const x = f(i / 12); g.fillStyle = 'rgba(255,176,32,0.25)'; g.beginPath(); g.arc(tx + 30 + x * (tw - 60), ty + 70, 4, 0, 7); g.fill(); }
    g.fillStyle = '#6d6a76'; g.fillText('dots = position at equal time steps (spacing)', tx + 30, ty + 98);
    g.fillStyle = '#ff5a36'; g.beginPath(); g.arc(tx + 30 + py * (tw - 60), ty, 26, 0, 7); g.fill();
  });
})();

// ---------------- stagger ----------------
(() => {
  const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('c-stagger')); if (!cv) return;
  const pats = { 'none (all at once)': () => 0, 'left to right': i => i * 0.05, 'center out': (i, j) => Math.hypot(i - 9.5, j - 3) * 0.06, 'diagonal': (i, j) => (i + j) * 0.035, 'random': (i, j) => ((Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.8 };
  let cur = 'center out'; const btns = document.getElementById('stg-btns');
  for (const k of Object.keys(pats)) { const b = document.createElement('button'); b.textContent = k; b.onclick = () => { cur = k; L.t0 = performance.now(); sync(); }; btns.appendChild(b); }
  function sync() { [...btns.children].forEach(b => b.classList.toggle('on', b.textContent === cur)); }
  sync();
  const L = addDemo(cv, () => [1000, 300], (g, t) => {
    const cyc = t % 3.8; g.fillStyle = '#08080c'; g.fillRect(0, 0, 1000, 300);
    for (let i = 0; i < 20; i++) for (let j = 0; j < 7; j++) {
      const d = pats[cur](i, j), k = eBack(clamp01((cyc - 0.2 - d) / 0.5)) * (1 - eOut(clamp01((cyc - 3.0 - d * 0.3) / 0.35)));
      if (k <= 0) continue; const s = 34 * k; g.fillStyle = COLORS[(i + j) % 4];
      g.beginPath(); g.roundRect(60 + i * 46 - s / 2, 40 + j * 36 - s / 2, s * 0.8, s * 0.8, s * 0.2); g.fill();
    }
  });
})();

// ---------------- squash and stretch ----------------
(() => {
  const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('c-squash')); if (!cv) return; let on = true;
  const b = document.getElementById('sq-toggle'); b.onclick = () => { on = !on; b.classList.toggle('on', on); b.textContent = 'Squash and stretch: ' + (on ? 'ON' : 'OFF'); };
  addDemo(cv, () => [480, 300], (g, t) => {
    g.fillStyle = '#08080c'; g.fillRect(0, 0, 480, 300);
    const floorY = 250, R = 34, u = (t / 0.8) % 1, h = 4 * u * (1 - u) * 170, speed = Math.abs(1 - 2 * u), contact = Math.exp(-Math.min(u, 1 - u) * 45);
    const sy = on ? lerp(1 + 0.3 * speed, 0.58, contact) : 1, sx = 1 / sy;
    g.strokeStyle = '#2a2a38'; g.lineWidth = 3; g.beginPath(); g.moveTo(80, floorY); g.lineTo(400, floorY); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(240, floorY + 6, Math.max(4, R * (1.3 - h / 300)), 6, 0, 0, 7); g.fill();
    g.fillStyle = '#ff5a36'; g.beginPath(); g.ellipse(240, floorY - R * sy - h, R * sx, R * sy, 0, 0, 7); g.fill();
  });
})();

// ---------------- anticipation + overshoot ----------------
(() => {
  const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('c-antic')); if (!cv) return; let on = true;
  const b = document.getElementById('an-toggle'); b.onclick = () => { on = !on; b.classList.toggle('on', on); b.textContent = 'Anticipation + overshoot: ' + (on ? 'ON' : 'OFF'); };
  const inOutBack = x => { const c = 1.70158 * 1.525; return x < .5 ? (Math.pow(2 * x, 2) * ((c + 1) * 2 * x - c)) / 2 : (Math.pow(2 * x - 2, 2) * ((c + 1) * (x * 2 - 2) + c) + 2) / 2; };
  addDemo(cv, () => [480, 300], (g, t) => {
    g.fillStyle = '#08080c'; g.fillRect(0, 0, 480, 300);
    const cyc = t % 3.0; let p = clamp01((cyc - 0.5) / 1.0); if (cyc > 1.9) p = 1 - clamp01((cyc - 2.1) / 0.6);
    const k = on && cyc < 1.9 ? inOutBack(p) : eInOut(p), x = lerp(90, 390, k);
    g.strokeStyle = '#2a2a38'; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(90, 220); g.lineTo(90, 80); g.moveTo(390, 220); g.lineTo(390, 80); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#6d6a76'; g.font = '13px Consolas'; g.fillText('start', 74, 240); g.fillText('target', 370, 240);
    g.fillStyle = '#2bc4e6'; g.beginPath(); g.roundRect(x - 40, 110, 80, 80, 14); g.fill();
  });
})();

// ---------------- prompt builder ----------------
(() => {
  const $ = id => /** @type {HTMLInputElement} */ (document.getElementById(id)); if (!$('b-out')) return;
  const MOOD = {
    premium: 'premium and calm: long ease-in-out moves (1 to 1.5 s), generous holds, soft depth of field',
    energetic: 'energetic: ease-out-expo, short 200 to 300 ms moves, hard cuts on the beat, camera shake on impacts',
    playful: 'playful: ease-out-back overshoot, squash and stretch, bouncy staggers',
    tech: 'technical and futuristic: crisp ease-out-expo, monospace labels, typewriter text, grid details',
    organic: 'organic and dreamy: slow flowing motion, bloom, film grain, seamless drift',
    cinematic: 'cinematic: slow camera moves, depth of field, motion blur, filmic color grade',
  };
  function build() {
    const len = Math.max(3, Number($('b-len').value) || 20);
    const tech = [.../** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('#b-tech input:checked'))].map(i => i.value), post = [.../** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('#b-post input:checked'))].map(i => i.value);
    const segLen = len / Math.max(1, tech.length + 1), tl = []; let t = 0;
    const word = $('b-text').value.split('/')[0].trim();
    tl.push(`${t.toFixed(1)}-${(t + segLen).toFixed(1)} s  opening: ${tech.includes('kinetic typography') ? 'kinetic type reveal of "' + word + '"' : 'establishing shot'}`); t += segLen;
    tech.filter(x => x !== 'kinetic typography').forEach(x => { tl.push(`${t.toFixed(1)}-${(t + segLen).toFixed(1)} s  ${x}`); t += segLen; });
    if (tech.includes('kinetic typography')) tl.push(`${t.toFixed(1)}-${len.toFixed(1)} s  end card with "${$('b-text').value}"`);
    const lines = [
      `Make ${$('b-purpose').value}.`, `Deliverable: ${len} seconds, ${$('b-format').value}, ${$('b-fps').value} fps, MP4 (H.264) saved to my desktop.`,
      `Look: ${$('b-pal').value}. Mood is ${MOOD[$('b-mood').value]}.`, `Techniques: ${tech.length ? tech.join(', ') : 'your choice'}. Build everything with code; no stock footage.`,
      'Timeline (adjust as needed):', ...tl.map(s => '  ' + s), `Camera: ${$('b-cam').value}.`, `Transitions: ${$('b-tr').value}.`,
      post.length ? `Post effects: ${post.join(', ')}.` : 'No post effects.', `Text on screen: "${$('b-text').value}". Keep text at least 28 px tall and on screen long enough to read.`, $('b-sound').value,
    ];
    if ($('b-caps').checked) lines.push('Add a lower-third caption in each scene that names the technique and the tool used.');
    if ($('b-test').checked) lines.push('Before the full render, show me a contact sheet of 6 to 9 test frames across the timeline and wait for my OK.');
    $('b-out').value = lines.join('\n');
  }
  document.querySelectorAll('.builder input, .builder select').forEach(e => e.addEventListener('input', build));
  build();
  $('b-copy').onclick = () => { navigator.clipboard.writeText($('b-out').value); $('b-copy').textContent = 'Copied'; setTimeout(() => $('b-copy').textContent = 'Copy', 1200); };
})();

// copy buttons on example prompts
/** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('pre .copy')).forEach(b => b.onclick = () => {
  const txt = b.parentElement.textContent.replace(/^Copy/, '').replace(/^Copied/, '');
  navigator.clipboard.writeText(txt.trim()); b.textContent = 'Copied'; setTimeout(() => b.textContent = 'Copy', 1200);
});
