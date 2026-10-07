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
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(data);
  });
}).listen(8124);

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
let next = 0, done = 0;
const t0 = Date.now();
async function worker(id) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[w${id}]`, m.text()); });
  page.on('pageerror', e => console.log(`[w${id}] pageerror`, e.message));
  await page.goto(`http://localhost:8124/${pageName}`);
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
