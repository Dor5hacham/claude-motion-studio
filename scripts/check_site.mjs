// Checks index.html end to end in headless Chrome on the GPU:
//  - every script file in guide-assets/{examples,guide} is loaded by the page (nothing created but hidden)
//  - card ids are unique and every internal #link has a target
//  - every card renders while on screen, with no console or page errors
//  - optional: saves a screenshot of every card for reading by eye
// Usage: node scripts/check_site.mjs [--shots <dir>] [--filter <text>]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const filter = args.includes('--filter') ? args[args.indexOf('--filter') + 1] : null;
const problems = [];

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

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
await page.waitForTimeout(800);

// 2. ids and links
const info = await page.evaluate(() => {
  const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  const broken = [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1)).filter(h => h && !document.getElementById(h));
  const cards = [...document.querySelectorAll('article.ex')].map(a => a.id);
  const unplaced = (window.EX ? EX.cards : []).filter(c => !document.getElementById('cat-' + c.cat)).map(c => c.id + ' (cat ' + c.cat + ')');
  return { dup, broken: [...new Set(broken)], cards, unplaced, indexRows: document.querySelectorAll('#tech-index tbody tr').length };
});
info.dup.forEach(d => problems.push('duplicate id: ' + d));
info.broken.forEach(b => problems.push('broken link: #' + b));
info.unplaced.forEach(u => problems.push('card has no section: ' + u));

// 3. render every card while on screen
if (shots) fs.mkdirSync(shots, { recursive: true });
let n = 0;
for (const id of info.cards) {
  if (filter && !id.includes(filter)) continue;
  const el = await page.$('#' + id); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(shots ? 1800 : 400);
  const st = await el.evaluate(a => { const v = a.querySelector('video'); return v ? { video: true, ready: v.readyState, err: v.error ? v.error.code : 0, w: v.videoWidth } : { video: false }; });
  if (st.video && (st.err || st.w === 0)) problems.push(`video not playing in ${id} (readyState ${st.ready}, error ${st.err})`);
  if (shots) await el.screenshot({ path: path.join(shots, id + '.png') });
  n++;
}
// learning demos
for (const id of ['fps-demo', 'ease-race', 'cmp-timing', 'cmp-beat', 'cam-rig', 'tr-player', 'fx-stack', 'mood-premium', 'pg-preview', 'logo-live']) {
  const el = await page.$('#' + id); if (!el) { problems.push('missing learning demo #' + id); continue; }
  await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(shots ? 1500 : 300);
  if (shots) await el.screenshot({ path: path.join(shots, 'learn-' + id + '.png') });
}
errors.forEach(e => problems.push('console: ' + e));
console.log(`cards: ${info.cards.length} (checked ${n}), index rows: ${info.indexRows}`);
console.log(problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'ALL CHECKS PASSED');
await browser.close();
process.exit(problems.length ? 1 : 0);
