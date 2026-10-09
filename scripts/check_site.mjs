/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Checks index.html end to end in headless Chrome on the GPU:
//  - every script file in site/catalog and site/learn is loaded by the page (nothing created but hidden),
//    every vendor file is used and every file the page references exists
//  - card ids are unique, every internal #link has a target and every card has a section
//  - every prompt {placeholder} has a slider with that key, and no slider unit is written twice next to it
//  - every card and every learning demo renders while on screen at 1700 px, with no console or page errors
//  - narrow layouts at 820 and 390 px: no sideways scroll, DOM stages scaled to the card width (--k), split
//    demos stacked, learning demos drawn at their phone design size, tweak panels inside their card, the mobile menu
//  - search, filters, folded sections (Show all, Show fewer), links to folded or filtered cards and sections,
//    sidebar and banner counts, opening a #ex- link, and the scroll position kept on reload and Back
//  - the WebGPU card's CPU preview, with no WebGPU adapter and with no navigator.gpu
//  - optional: saves a screenshot of every card and learning demo, at every width, for reading by eye
// Usage: node scripts/check_site.mjs [--shots <dir>] [--filter <text>]
// --filter limits the cards rendered one by one to ids containing <text>; every other check still runs.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = pathToFileURL(path.join(ROOT, 'index.html')).href;
const args = process.argv.slice(2);
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const filter = args.includes('--filter') ? args[args.indexOf('--filter') + 1] : null;
const problems = [];
const FOLD = 6;
// A scroll target lands this close under the sticky header (and its filter row when shown), at most: --pad0 and --pad put it 14 px below.
const NEAR = 24;
// Learning demos that must exist, and the design [W, H] each one switches to on a phone (addDemo narrow).
const SPLIT = ['cmp-hold', 'cmp-follow', 'cmp-secondary', 'cmp-arcs', 'cmp-beat', 'cmp-loop', 'cmp-parallax'];
const PHONE = { 'fps-demo': [480, 380], 'c-ease': [500, 430], 'ease-race': [480, 300], 'cmp-timing': [480, 240], 'cam-rig': [480, 420], 'tr-player': [480, 420], 'logo-live': [480, 400] };
SPLIT.forEach(id => { PHONE[id] = [480, 480]; });
const LEARN = [...Object.keys(PHONE), 'c-stagger', 'c-squash', 'c-antic', 'fx-stack', 'pg-preview',
  ...['premium', 'energetic', 'playful', 'technical', 'dreamy', 'cinematic'].map(m => 'mood-' + m)];

// 1. every script is referenced
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const dir of ['site/catalog', 'site/learn']) {
  for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.js'))) {
    if (!html.includes(`${dir}/${f}`)) problems.push(`script not loaded by index.html: ${dir}/${f}`);
  }
}
// vendor scripts: loaded by the page, or loaded on demand by name from libs.js (e.g. Tone.js on first Play)
const libsSrc = fs.readFileSync(path.join(ROOT, 'site/catalog/libs.js'), 'utf8');
for (const f of fs.readdirSync(path.join(ROOT, 'site/vendor')).filter(f => f.endsWith('.js'))) {
  if (!html.includes(`site/vendor/${f}`) && !libsSrc.includes(`'${f}'`)) problems.push(`vendor script never used: site/vendor/${f}`);
}
for (const m of html.matchAll(/src="([^"]+)"/g)) if (!m[1].startsWith('http') && !fs.existsSync(path.join(ROOT, decodeURIComponent(m[1])))) problems.push('missing file referenced by index.html: ' + m[1]);
for (const m of libsSrc.matchAll(/VENDOR \+ '([^']+)'/g)) if (!fs.existsSync(path.join(ROOT, 'site/vendor', m[1]))) problems.push('libs.js loads a missing vendor file: ' + m[1]);

// Chrome binary: CHROME_PATH if set, else the standard install path for this OS. ANGLE on D3D11 is Windows-only.
const CHROME = process.env.CHROME_PATH || ({ win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })[process.platform] || '/usr/bin/google-chrome';
const ANGLE = process.platform === 'win32' ? ['--use-angle=d3d11'] : [];
const browser = await chromium.launch({ executablePath: CHROME, args: [...ANGLE, '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
// Opens index.html in a new page of the given width. Console and page errors become problems, tagged with the label.
async function open(width, label, init, hash = '') {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  page.on('console', m => { if (m.type() === 'error') problems.push(`console (${label}): ` + m.text().slice(0, 300)); });
  page.on('pageerror', e => problems.push(`pageerror (${label}): ` + e.message));
  if (init) await page.addInitScript(init);
  await page.goto(URL + hash);
  await page.waitForTimeout(800);
  return page;
}
const shot = async (el, name) => { if (shots) await el.screenshot({ path: path.join(shots, name + '.png') }); };
if (shots) fs.mkdirSync(shots, { recursive: true });

// Reads a 2D canvas back: how many sampled pixels differ from the top-left one, in the whole canvas and in its
// lower half. null when the canvas has no 2D context (WebGL, WebGPU).
const inkOf = id => {
  const cv = /** @type {HTMLCanvasElement} */ (document.getElementById(id)); const g = cv && cv.getContext('2d'); if (!g || !cv.width) return null;
  const d = g.getImageData(0, 0, cv.width, cv.height).data, bg = [d[0], d[1], d[2]]; let all = 0, low = 0;
  for (let y = 0; y < cv.height; y += 3) for (let x = 0; x < cv.width; x += 3) {
    const i = (y * cv.width + x) * 4; if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 30) { all++; if (y > cv.height / 2) low++; }
  }
  return { all, low, ratio: cv.height / cv.width, css: cv.clientHeight / Math.max(1, cv.clientWidth), w: cv.width, cw: cv.clientWidth };
};

// ---------- 1700 px: every card and learning demo ----------
const page = await open(1700, '1700 px');

// 2. ids, links, prompts
const info = await page.evaluate(() => {
  const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  const broken = [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1)).filter(h => h && !document.getElementById(h));
  const cards = [...document.querySelectorAll('article.ex')].map(a => a.id);
  const unplaced = (window.EX ? EX.cards : []).filter(c => !document.getElementById('cat-' + c.cat)).map(c => c.id + ' (cat ' + c.cat + ')');
  // A unit next to its placeholder reads twice once filled: "{a} degrees" with unit "deg" gives "30deg degrees".
  const SAME = { s: ['s', 'sec', 'secs', 'second', 'seconds'], ms: ['ms', 'millisecond', 'milliseconds'], deg: ['deg', 'degree', 'degrees', '°'], '°': ['°', 'deg', 'degree', 'degrees'], px: ['px', 'pixel', 'pixels'], '%': ['%', 'percent'], x: ['x', 'times'], k: ['k', 'thousand'], hz: ['hz', 'hertz'] };
  const prompts = [];
  for (const c of EX.cards) for (const m of c.prompt.matchAll(/\{(\w+)\}/g)) {
    const q = (c.params || []).find(x => x.key === m[1]);
    if (!q) { prompts.push(`${c.id}: prompt has {${m[1]}} but no slider with that key`); continue; }
    const u = (q.unit || '').trim().toLowerCase(); if (!u) continue;
    const next = c.prompt.slice(m.index + m[0].length).match(/^\s*([a-z%°]+)/i); if (!next) continue;
    const w = next[1].toLowerCase();
    if ((SAME[u] || [u]).includes(w) || (u.length > 1 && w.startsWith(u))) prompts.push(`${c.id}: unit "${q.unit}" of {${m[1]}} is followed by "${next[1]}" in the prompt`);
  }
  return { dup, broken: [...new Set(broken)], cards, unplaced, prompts, indexRows: document.querySelectorAll('#tech-index tbody tr').length };
});
info.dup.forEach(d => problems.push('duplicate id: ' + d));
info.broken.forEach(b => problems.push('broken link: #' + b));
info.unplaced.forEach(u => problems.push('card has no section: ' + u));
info.prompts.forEach(p => problems.push('prompt: ' + p));

// 3. render every card while on screen (catalog sections fold to their first cards, so open them all first)
await page.evaluate(() => document.querySelectorAll('section.cat').forEach(s => s.classList.add('open')));
let n = 0;
for (const id of info.cards) {
  if (filter && !id.includes(filter)) continue;
  const el = await page.$('#' + id); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(shots ? 1800 : 400);
  const st = await el.evaluate(a => { const v = a.querySelector('video'); return v ? { video: true, ready: v.readyState, err: v.error ? v.error.code : 0, w: v.videoWidth } : { video: false }; });
  if (st.video && (st.err || st.w === 0)) problems.push(`video not playing in ${id} (readyState ${st.ready}, error ${st.err})`);
  await shot(el, id);
  n++;
}
// learning demos: every canvas outside the catalog, plus the required list
const learnIds = await page.evaluate(() => [...document.querySelectorAll('main canvas[id]')].filter(c => !c.closest('article.ex')).map(c => c.id));
LEARN.filter(id => !learnIds.includes(id)).forEach(id => problems.push('missing learning demo #' + id));
const wide = {};
for (const id of learnIds) {
  const el = await page.$('#' + id); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(shots ? 1500 : 400);
  let ink = wide[id] = await page.evaluate(inkOf, id);
  // Some scenes loop through an empty frame (the mood titles), so look again before calling it blank.
  for (let k = 0; k < 4 && ink && ink.all < 20; k++) { await page.waitForTimeout(500); ink = wide[id] = await page.evaluate(inkOf, id); }
  if (ink && ink.all < 20) problems.push(`learning demo #${id} draws nothing at 1700 px`);
  await shot(el, 'learn-' + id);
}
await page.close();

// ---------- narrow layouts ----------
for (const W of [820, 390]) {
  const p = await open(W, W + ' px');
  await p.evaluate(() => document.querySelectorAll('section.cat').forEach(s => s.classList.add('open')));
  await p.waitForTimeout(300);
  const lay = await p.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`page scrolls sideways: ${document.documentElement.scrollWidth} px wide`);
    document.querySelectorAll('article.ex').forEach(a => { const r = a.getBoundingClientRect(); if (r.right > innerWidth + 1) out.push(`${a.id} sticks out to ${Math.round(r.right)} px`); });
    // DOM stages: laid out at 640 x 360 and scaled by --k to the card width.
    document.querySelectorAll('.stagewrap > .domstage').forEach(st => {
      const wrap = st.parentElement.getBoundingClientRect(), r = st.getBoundingClientRect(), id = st.closest('article').id;
      const k = parseFloat(getComputedStyle(st).getPropertyValue('--k')) || 1, want = Math.min(1, wrap.width / 640);
      if (Math.abs(k - want) > 0.01) out.push(`${id}: DOM stage --k is ${k.toFixed(3)}, card needs ${want.toFixed(3)}`);
      if (r.width > wrap.width + 2 || r.height > wrap.height + 2) out.push(`${id}: DOM stage ${Math.round(r.width)}x${Math.round(r.height)} does not fit its ${Math.round(wrap.width)}x${Math.round(wrap.height)} frame`);
    });
    // Tweak panels: every row inside its card.
    document.querySelectorAll('.tweakpanel').forEach(pn => {
      const panel = /** @type {HTMLElement} */ (pn), a = panel.closest('article'), cr = a.getBoundingClientRect(); panel.hidden = false;
      panel.querySelectorAll('label, label > *, button').forEach(x => { const r = x.getBoundingClientRect(); if (r.width && (r.left < cr.left - 1 || r.right > cr.right + 1)) out.push(`${a.id}: tweak panel row sticks out of the card`); });
      if (panel.scrollWidth > panel.clientWidth + 1) out.push(`${a.id}: tweak panel scrolls sideways`);
      panel.hidden = true;
    });
    return [...new Set(out)];
  });
  lay.forEach(x => problems.push(`${W} px: ${x}`));

  // Learning demos at their phone design size; split demos stacked (WITHOUT on top, WITH below).
  for (const id of learnIds) {
    const el = await p.$('#' + id); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(shots ? 1200 : 400);
    let ink = await p.evaluate(inkOf, id);
    for (let k = 0; k < 4 && ink && ink.all < 20; k++) { await p.waitForTimeout(500); ink = await p.evaluate(inkOf, id); }
    await shot(el, `w${W}-learn-${id}`);
    if (!ink) continue;
    if (ink.all < 20) problems.push(`${W} px: learning demo #${id} draws nothing`);
    if (Math.abs(ink.ratio - ink.css) > 0.02) problems.push(`${W} px: #${id} bitmap ${ink.ratio.toFixed(3)} does not match its shown shape ${ink.css.toFixed(3)} (stretched)`);
    if (Math.abs(ink.w - ink.cw * (await p.evaluate(() => devicePixelRatio))) > 2) problems.push(`${W} px: #${id} bitmap is ${ink.w} px wide for ${ink.cw} css px`);
    const phone = PHONE[id], narrow = ink.cw < 720 && !(id === 'logo-live' && ink.cw >= 580);
    if (phone && narrow && Math.abs(ink.ratio - phone[1] / phone[0]) > 0.02) problems.push(`${W} px: #${id} is not in its phone layout (${phone.join('x')})`);
    if (phone && !narrow && wide[id] && Math.abs(ink.ratio - wide[id].ratio) > 0.02) problems.push(`${W} px: #${id} switched layout above the phone width`);
    if (SPLIT.includes(id) && narrow && ink.low < 20) problems.push(`${W} px: split demo #${id} has an empty lower (WITH) half`);
  }
  // DOM cards render at this width with no errors.
  for (const id of info.cards) {
    if (filter && !id.includes(filter)) continue;
    const el = await p.$(`#${id}:has(.domstage)`); if (!el) continue;
    await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(shots ? 1200 : 300); await shot(el, `w${W}-${id}`);
  }

  // Mobile menu: opens under the header, a link closes it; from the keyboard focus moves in, Escape brings it back.
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200);
  await p.click('#menu-btn'); await p.waitForTimeout(400);
  const menu = await p.evaluate(() => {
    const nav = document.getElementById('sidenav'), r = nav.getBoundingClientRect(), hb = (f => (f.getClientRects().length ? f : document.querySelector('header.top')).getBoundingClientRect().bottom)(document.getElementById('filters'));
    return { open: nav.classList.contains('open'), left: Math.round(r.left), top: Math.round(r.top), hb: Math.round(hb), vis: getComputedStyle(nav).visibility, exp: document.getElementById('menu-btn').getAttribute('aria-expanded') };
  });
  if (!menu.open || menu.vis !== 'visible' || menu.left < -1 || menu.exp !== 'true') problems.push(`${W} px: Menu does not open the drawer (${JSON.stringify(menu)})`);
  if (Math.abs(menu.top - menu.hb) > 2) problems.push(`${W} px: drawer top ${menu.top} is not under the header (${menu.hb})`);
  await p.click('#sidenav a[href="#glossary"]'); await p.waitForTimeout(600);
  if (await p.evaluate(() => document.getElementById('sidenav').classList.contains('open'))) problems.push(`${W} px: a drawer link does not close the drawer`);
  await p.focus('#menu-btn'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  if (!await p.evaluate(() => document.getElementById('sidenav').contains(document.activeElement))) problems.push(`${W} px: opening the drawer from the keyboard does not move focus into it`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const esc = await p.evaluate(() => ({ open: document.getElementById('sidenav').classList.contains('open'), focus: document.activeElement.id }));
  if (esc.open || esc.focus !== 'menu-btn') problems.push(`${W} px: Escape does not close the drawer and return focus (${JSON.stringify(esc)})`);
  await p.close();
}

// ---------- search, filters, folding, links, scroll restore (1700 px) ----------
{
  const p = await open(1700, 'ui 1700 px');
  const state = () => p.evaluate(() => {
    const vis = el => el.getClientRects().length > 0, hb = (f => (f.getClientRects().length ? f : document.querySelector('header.top')).getBoundingClientRect().bottom)(document.getElementById('filters'));
    const secs = [...document.querySelectorAll('section.cat')].map(s => {
      const cards = [...s.querySelectorAll('article.ex')];
      const b = /** @type {HTMLButtonElement} */ (s.querySelector('button.more'));
      return { id: s.id, total: cards.length, shown: cards.filter(vis).length, hidden: !vis(s), more: b && !b.hidden ? b.textContent : null, top: Math.round(s.getBoundingClientRect().top - hb) };
    });
    const shownCards = [...document.querySelectorAll('article.ex')].filter(vis);
    const rows = [...document.querySelectorAll('#tech-index tbody tr')].filter(vis).map(tr => ({ learn: tr.children[1].textContent === 'Learn', runs: tr.children[3].textContent }));
    const counts = [...document.querySelectorAll('nav.side a[data-cat]')].map(a => {
      const s = document.querySelector(a.getAttribute('href')); return { href: a.getAttribute('href'), c: a.querySelector('.c').textContent, n: [...s.querySelectorAll('article.ex')].filter(vis).length };
    });
    const pressed = [...document.querySelectorAll('#filters button')].map(b => ({ v: b.closest('.seg').dataset.f + '=' + b.dataset.v, on: b.classList.contains('on'), aria: b.getAttribute('aria-pressed') }));
    return { secs, shown: shownCards.map(a => ({ id: a.id, search: a.dataset.search, kind: a.dataset.kind, sliders: a.dataset.sliders, runs: a.dataset.runs })), rows, counts, pressed, hint: document.getElementById('qhint').textContent, fcount: document.getElementById('fcount').textContent, firstTop: shownCards.length ? Math.round(shownCards[0].getBoundingClientRect().top - hb) : null };
  });
  const ui = msg => problems.push('ui: ' + msg);

  // Folding: every long section shows FOLD cards and a Show all button; Show all opens it, Show fewer folds it.
  let s = await state();
  for (const x of s.secs) {
    const want = Math.min(FOLD, x.total); if (x.shown !== want) ui(`${x.id} shows ${x.shown} of ${x.total} cards folded, expected ${want}`);
    if (x.total > FOLD && x.more !== `Show all ${x.total} examples (${x.total - FOLD} more)`) ui(`${x.id} Show all button reads "${x.more}"`);
  }
  const long = s.secs.find(x => x.total > FOLD);
  if (long) {
    await p.click(`#${long.id} button.more`); await p.waitForTimeout(400);
    let y = (await state()).secs.find(x => x.id === long.id);
    if (y.shown !== y.total || y.more !== 'Show fewer') ui(`Show all on ${long.id} shows ${y.shown} of ${y.total}, button "${y.more}"`);
    await p.click(`#${long.id} button.more`); await p.waitForTimeout(400);
    y = (await state()).secs.find(x => x.id === long.id);
    if (y.shown !== FOLD) ui(`Show fewer on ${long.id} leaves ${y.shown} cards`);
    if (y.top < -2 || y.top > NEAR) ui(`Show fewer on ${long.id} leaves the section top ${y.top} px from the header`);
  }

  // Search: every match shows, nothing else, rows and hint follow, and the first match is in view.
  const allCards = await p.evaluate(() => [...document.querySelectorAll('article.ex')].map(a => ({ id: a.id, search: a.dataset.search, kind: a.dataset.kind, sliders: a.dataset.sliders, runs: a.dataset.runs })));
  for (const term of ['gsap', 'zzqqxx']) {
    await p.evaluate(() => window.scrollTo(0, 9000)); await p.click('#q'); await p.fill('#q', term); await p.waitForTimeout(2500);
    s = await state();
    const want = allCards.filter(a => a.search.includes(term)).length;
    if (s.shown.length !== want || s.shown.some(a => !a.search.includes(term))) ui(`search "${term}" shows ${s.shown.length} cards, ${want} match`);
    if (!s.hint.startsWith(want === 1 ? '1 card' : `${want} cards`)) ui(`search "${term}" hint reads "${s.hint}"`);
    if (s.rows.filter(r => !r.learn).length !== want) ui(`search "${term}" leaves ${s.rows.filter(r => !r.learn).length} card rows in the index, ${want} match`);
    if (s.secs.some(x => !x.hidden && x.shown === 0)) ui(`search "${term}" leaves an empty section on screen`);
    if (want && (s.firstTop < -2 || s.firstTop > 1000)) ui(`search "${term}" does not bring the first match into view (${s.firstTop} px below the header)`);
  }
  await p.fill('#q', ''); await p.waitForTimeout(300);
  if ((await state()).secs.some(x => x.shown !== Math.min(FOLD, x.total))) ui('clearing the search does not fold the sections again');

  // Focusing the search box from far down does not move the page.
  await p.evaluate(() => { /** @type {HTMLElement} */ (document.activeElement).blur(); window.scrollTo({ top: 8000, behavior: 'instant' }); }); await p.waitForTimeout(300);
  const y0 = await p.evaluate(() => scrollY); await p.evaluate(() => document.getElementById('q').focus()); await p.waitForTimeout(600);
  if (Math.abs(await p.evaluate(() => scrollY) - y0) > 2) ui('focusing the search box scrolls the page');
  await p.evaluate(() => /** @type {HTMLElement} */ (document.activeElement).blur());

  // Filters: matching cards only, learn rows follow Show and Runs on, counts follow, aria-pressed marks the choice.
  const fits = (a, f, v) => f === 'runs' ? a.runs === v : v === 'sliders' ? a.sliders === '1' : a.kind === v;
  const LEARN_RUNS = { CPU: 19, GPU: 1 };
  // The filter row shows in the header while the catalog is on screen.
  const toCatalog = async () => { await p.evaluate(() => document.getElementById('type').scrollIntoView({ behavior: 'instant' })); await p.waitForTimeout(600); };
  await toCatalog();
  for (const [f, v] of [['kind', 'live'], ['kind', 'sliders'], ['kind', 'clip'], ['runs', 'CPU'], ['runs', 'GPU'], ['runs', 'WEB'], ['runs', 'ENGINE']]) {
    await p.click(`#filters .seg[data-f="${f}"] button[data-v="${v}"]`); await p.waitForTimeout(500);
    s = await state();
    const want = allCards.filter(a => fits(a, f, v)).length, tag = `filter ${f}=${v}`;
    if (s.shown.length !== want || s.shown.some(a => !fits(a, f, v))) ui(`${tag} shows ${s.shown.length} cards, ${want} match`);
    const learn = s.rows.filter(r => r.learn), wantLearn = f === 'kind' ? (v === 'live' ? 20 : 0) : (LEARN_RUNS[v] || 0);
    if (learn.length !== wantLearn || (f === 'runs' && learn.some(r => r.runs !== v))) ui(`${tag} leaves ${learn.length} Learn rows in the index, expected ${wantLearn}`);
    s.counts.filter(c => c.c !== String(c.n)).forEach(c => ui(`${tag}: sidebar count for ${c.href} reads ${c.c}, ${c.n} cards show`));
    s.pressed.filter(b => (b.v.startsWith(f + '=')) && (b.on !== (b.v === `${f}=${v}`) || b.aria !== String(b.on))).forEach(b => ui(`${tag}: button ${b.v} on=${b.on} aria-pressed=${b.aria}`));
    if (!s.fcount) ui(`${tag}: no match count in the filter row`);
    await p.click(`#filters .seg[data-f="${f}"] button[data-v=""]`); await p.waitForTimeout(300);
  }
  // A sidebar link to a section that a filter hides clears the filter and lands on the section.
  await toCatalog(); await p.click('#filters .seg[data-f="runs"] button[data-v="ENGINE"]'); await p.waitForTimeout(500);
  s = await state(); const gone = s.secs.find(x => x.hidden);
  if (!gone) ui('filter runs=ENGINE hides no section');
  else {
    await p.click(`nav.side a[href="#${gone.id}"]`); await p.waitForTimeout(2500);
    s = await state(); const back = s.secs.find(x => x.id === gone.id);
    if (back.hidden || s.pressed.some(b => b.v.endsWith('=') !== b.on)) ui(`a sidebar link to ${gone.id}, hidden by a filter, does not clear the filter`);
    else if (back.top < -2 || back.top > NEAR) ui(`a sidebar link to ${gone.id} lands ${back.top} px from the header`);
  }

  // A link to a folded card opens its section and lands the card under the header; also when a search hides it.
  const hb = () => p.evaluate(() => (f => (f.getClientRects().length ? f : document.querySelector('header.top')).getBoundingClientRect().bottom)(document.getElementById('filters')));
  const follow = async (id, label) => {
    await p.evaluate(id => { const a = document.createElement('a'); a.href = '#' + id; a.textContent = 'x'; document.querySelector('main').prepend(a); a.click(); a.remove(); }, id);
    await p.waitForTimeout(2500);
    const r = await p.evaluate(id => { const el = document.getElementById(id); return { vis: el.getClientRects().length > 0, top: el.getBoundingClientRect().top }; }, id);
    const gap = Math.round(r.top - await hb());
    if (!r.vis || gap < -2 || gap > NEAR) ui(`${label}: #${id} visible=${r.vis}, ${gap} px below the header`);
  };
  const lastGpu = await p.evaluate(() => [...document.querySelectorAll('#gpu article.ex')].pop().id);
  await p.evaluate(() => window.scrollTo(0, 0)); await follow(lastGpu, 'link to a folded card');
  const lastSim = await p.evaluate(() => [...document.querySelectorAll('#sim article.ex')].pop().id);
  await p.fill('#q', 'gsap'); await p.waitForTimeout(2500); await follow(lastSim, 'link to a card hidden by a search');
  if (await p.inputValue('#q')) ui('a link to a card hidden by a search does not clear the search');

  // Reload and Back return to the element that was under the header.
  await p.evaluate(() => { document.getElementById('gpu').scrollIntoView({ behavior: 'instant' }); window.scrollBy(0, 300); }); await p.waitForTimeout(700);
  const at = await p.evaluate(() => history.state && history.state.at);
  if (!at) ui('scrolling does not save the spot in history.state');
  else {
    const where = () => p.evaluate(id => { const el = document.getElementById(id); return el && el.getClientRects().length ? Math.round(el.getBoundingClientRect().top) : null; }, at[0]);
    await p.reload(); await p.waitForTimeout(1500);
    let top = await where(); if (top === null || Math.abs(top - at[1]) > 4) ui(`reload puts #${at[0]} at ${top}, it was at ${Math.round(at[1])}`);
    await p.click('nav.side a[href="#glossary"]'); await p.waitForTimeout(2500); await p.goBack(); await p.waitForTimeout(1200);
    top = await where(); if (top === null || Math.abs(top - at[1]) > 4) ui(`Back puts #${at[0]} at ${top}, it was at ${Math.round(at[1])}`);
  }
  await p.close();

  // Opening the page with a #ex- link to a folded card shows the card under the header.
  const q = await open(1700, 'hash load', null, '#ex-l2-d3-globe'); await q.waitForTimeout(2000);
  const land = await q.evaluate(() => { const el = document.getElementById('ex-l2-d3-globe'); return { vis: el.getClientRects().length > 0, gap: Math.round(el.getBoundingClientRect().top - (f => (f.getClientRects().length ? f : document.querySelector('header.top')).getBoundingClientRect().bottom)(document.getElementById('filters'))) }; });
  if (!land.vis || land.gap < -2 || land.gap > NEAR) ui(`opening index.html#ex-l2-d3-globe: visible=${land.vis}, ${land.gap} px below the header`);
  await q.close();
}

// ---------- WebGPU CPU preview ----------
for (const [mode, init] of /** @type {[string, () => void][]} */ ([
  ['no adapter', () => { if (navigator.gpu) navigator.gpu.requestAdapter = async () => null; }],
  ['no navigator.gpu', () => { Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined }); }],
])) {
  const p = await open(1700, 'WebGPU ' + mode, init, '#ex-w2-flow-silk'); await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const cv = /** @type {HTMLCanvasElement} */ (document.querySelector('#ex-w2-flow-silk canvas')), g = cv.getContext('2d'); if (!g) return null;
    const d = g.getImageData(0, 0, cv.width, cv.height).data; let lit = 0, amber = 0;
    for (let y = 0; y < cv.height; y += 2) for (let x = 0; x < cv.width; x += 2) {
      const i = (y * cv.width + x) * 4, sum = d[i] + d[i + 1] + d[i + 2];
      if (y < cv.height - 32 && sum > 120) lit++;
      if (y >= cv.height - 30 && d[i] > 180 && d[i + 1] > 110 && d[i + 2] < 90) amber++;
    }
    return { lit, amber };
  });
  if (!r) problems.push(`WebGPU ${mode}: the flow card has no 2D CPU preview`);
  else { if (r.lit < 300) problems.push(`WebGPU ${mode}: the CPU preview draws no particles (${r.lit} lit pixels)`); if (r.amber < 30) problems.push(`WebGPU ${mode}: the CPU preview shows no note on the stage`); }
  if (shots) await (await p.$('#ex-w2-flow-silk')).screenshot({ path: path.join(shots, `webgpu-${mode.replace(/\W+/g, '-')}.png`) });
  await p.close();
}

console.log(`cards: ${info.cards.length} (checked ${n}), learning demos: ${learnIds.length}, index rows: ${info.indexRows}`);
console.log(problems.length ? 'PROBLEMS:\n  ' + [...new Set(problems)].join('\n  ') : 'ALL CHECKS PASSED');
await browser.close();
process.exit(problems.length ? 1 : 0);
