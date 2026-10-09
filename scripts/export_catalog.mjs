/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Loads index.html and writes every catalog card (live demos and clips) to scripts/catalog.json,
// so the README tables are generated from the same registry the site uses.
// Usage: node scripts/export_catalog.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Chrome binary: CHROME_PATH if set, else the standard install path for this OS. ANGLE on D3D11 is Windows-only.
const CHROME = process.env.CHROME_PATH || ({ win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })[process.platform] || '/usr/bin/google-chrome';
const ANGLE = process.platform === 'win32' ? ['--use-angle=d3d11'] : [];
const browser = await chromium.launch({ executablePath: CHROME, args: [...ANGLE, '--enable-gpu'] });
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
await page.waitForTimeout(500);
const cards = await page.evaluate(() => EX.cards.filter(c => document.getElementById('cat-' + c.cat)).map(c => ({
  id: 'ex-' + c.id, cat: c.cat, title: c.title, aka: c.aka, tool: c.tool, runs: c.runs,
  kind: c.kind === 'video' ? 'clip' : 'live', sliders: (c.params || []).length, src: c.src || null,
  // Same rule as fill() in site/catalog/core.js: the value at its default, with dec (or the step's) decimals, plus the unit.
  prompt: c.prompt.replace(/\{(\w+)\}/g, (m, k) => { const p = (c.params || []).find(x => x.key === k); if (!p) return m; const dec = p.dec !== undefined ? p.dec : (String(p.step).split('.')[1] || '').length; return (+p.value).toFixed(dec) + (p.unit || ''); }),
})));
fs.writeFileSync(path.join(ROOT, 'scripts', 'catalog.json'), JSON.stringify(cards, null, 1));
console.log(`exported ${cards.length} cards to scripts/catalog.json`);
await browser.close();
