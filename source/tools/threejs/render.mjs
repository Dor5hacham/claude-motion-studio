/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Renders a page frame by frame with headless Chrome on the GPU.
// The page must expose `window.ready` (a promise) and `window.renderFrame(f)` (may be async).
// Usage: node render.mjs <page.html> <outDir> <frameCount> <workers> [frame ...]
// Serves the folder of this script on port 8124 so ES modules and import maps load.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const [pageName, outDir, countArg, workersArg, ...only] = process.argv.slice(2);
const frames = only.length ? only.map(Number) : [...Array(Number(countArg)).keys()];
const workers = Number(workersArg);
const W = 1280, H = 720;
fs.mkdirSync(outDir, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wgsl': 'text/plain', '.json': 'application/json' };
// Only this machine (127.0.0.1) can connect; paths that resolve outside this folder get 403.
const server = http.createServer((req, res) => {
  let p;
  try { p = path.resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0])); } catch { res.writeHead(400); res.end(); return; }
  if (p !== ROOT && !p.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    });
  } catch { res.writeHead(400); res.end(); }
}).listen(8124, '127.0.0.1');

// Chrome binary: CHROME_PATH if set, else the standard install path for this OS. ANGLE on D3D11 is Windows-only.
const CHROME = process.env.CHROME_PATH || ({ win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })[process.platform] || '/usr/bin/google-chrome';
const ANGLE = process.platform === 'win32' ? ['--use-angle=d3d11'] : [];
const browser = await chromium.launch({
  executablePath: CHROME,
  args: [...ANGLE, '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
let next = 0, done = 0;
const t0 = Date.now();
async function worker(id) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[w${id}]`, m.text()); });
  page.on('pageerror', e => console.log(`[w${id}] pageerror`, e.message));
  await page.goto(`http://127.0.0.1:8124/${pageName}`);
  await page.evaluate(() => window.ready);
  while (next < frames.length) {
    const f = frames[next++];
    let buf;
    for (let attempt = 1; ; attempt++) {
      try {
        await page.evaluate(f => window.renderFrame(f), f);
        buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H }, timeout: 60000 });
        break;
      } catch (e) {
        console.log(`[w${id}] frame ${f} attempt ${attempt} failed: ${e.message.split('\n')[0]}`);
        if (attempt >= 3) throw e;
      }
    }
    fs.writeFileSync(path.join(outDir, `f_${String(f).padStart(5, '0')}.png`), buf);
    if (++done % 50 === 0) console.log(`${done}/${frames.length} frames, ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
  }
  await page.close();
}
await Promise.all([...Array(workers)].map((_, i) => worker(i)));
await browser.close(); server.close();
console.log(`RENDER DONE ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
