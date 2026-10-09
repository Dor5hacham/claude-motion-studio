/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Renders reel.html frames to PNG with headless Chrome on the GPU.
// Usage: node render.mjs <outDir> <workers> all | <frame> [<frame> ...]
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath decodes %20 and drive letters, so paths with spaces work.
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const [outDir, workersArg, ...rest] = process.argv.slice(2);
const workers = Number(workersArg);
const frames = rest[0] === 'all' ? [...Array(3600).keys()] : rest.map(Number);
fs.mkdirSync(outDir, { recursive: true });

// Serves files from this folder to this machine only (127.0.0.1); paths that resolve outside it get 403.
const types = { '.html': 'text/html', '.png': 'image/png', '.js': 'text/javascript' };
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
}).listen(8123, '127.0.0.1');

// Chrome binary: CHROME_PATH if set, else the standard install path for this OS. ANGLE on D3D11 is Windows-only.
const CHROME = process.env.CHROME_PATH || ({ win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })[process.platform] || '/usr/bin/google-chrome';
const ANGLE = process.platform === 'win32' ? ['--use-angle=d3d11'] : [];
const browser = await chromium.launch({
  executablePath: CHROME,
  args: [...ANGLE, '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
let next = 0, done = 0;
const t0 = Date.now();
async function worker(id) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.log(`[w${id}]`, m.text()); });
  page.on('pageerror', e => console.log(`[w${id}] pageerror`, e.message));
  await page.goto('http://127.0.0.1:8123/reel.html');
  await page.evaluate(() => window.ready);
  while (next < frames.length) {
    const f = frames[next++];
    let buf;
    for (let attempt = 1; ; attempt++) {
      try {
        await page.evaluate(f => window.renderFrame(f), f);
        buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080 }, timeout: 60000 });
        break;
      } catch (e) {
        console.log(`[w${id}] frame ${f} attempt ${attempt} failed: ${e.message.split('\n')[0]}`);
        if (attempt >= 3) throw e;
      }
    }
    fs.writeFileSync(path.join(outDir, `f_${String(f).padStart(5, '0')}.png`), buf);
    if (++done % 100 === 0) console.log(`${done}/${frames.length} frames, ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
  }
  await page.close();
}
await Promise.all([...Array(workers)].map((_, i) => worker(i)));
await browser.close(); server.close();
console.log(`RENDER DONE ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
