// Loads index.html and writes every catalog card (live demos and clips) to scripts/catalog.json,
// so the README tables are generated from the same registry the site uses.
// Usage: node scripts/export_catalog.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu'] });
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
await page.waitForTimeout(500);
const cards = await page.evaluate(() => EX.cards.filter(c => document.getElementById('cat-' + c.cat)).map(c => ({
  id: 'ex-' + c.id, cat: c.cat, title: c.title, aka: c.aka, tool: c.tool, runs: c.runs,
  kind: c.kind === 'video' ? 'clip' : 'live', sliders: (c.params || []).length, src: c.src || null,
  prompt: c.prompt.replace(/\{(\w+)\}/g, (m, k) => { const p = (c.params || []).find(x => x.key === k); return p ? String(p.value) + (p.unit || '') : m; }),
})));
fs.writeFileSync(path.join(ROOT, 'scripts', 'catalog.json'), JSON.stringify(cards, null, 1));
console.log(`exported ${cards.length} cards to scripts/catalog.json`);
await browser.close();
