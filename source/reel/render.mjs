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

const types = { '.html': 'text/html', '.png': 'image/png', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(data);
  });
}).listen(8123);

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
let next = 0, done = 0;
const t0 = Date.now();
async function worker(id) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.log(`[w${id}]`, m.text()); });
  page.on('pageerror', e => console.log(`[w${id}] pageerror`, e.message));
  await page.goto('http://localhost:8123/reel.html');
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
