/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Headless render driver for a Motion Canvas project.
// Starts the Vite dev server, opens the editor in headless Chrome, clicks the
// editor's RENDER button (exporter and settings come from src/project.meta),
// and waits until the FFmpeg exporter has finished writing output/project.mp4.
//
// Usage: node render.mjs [chromePath]
// Chrome binary: the argument, else CHROME_PATH, else the standard install path for this OS.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = process.argv[2] ?? (process.env.CHROME_PATH || ({
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})[process.platform] || '/usr/bin/google-chrome');
const PORT = 9123;
const OUT = path.resolve('output/project.mp4');

function startVite() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const onData = buf => {
      const s = buf.toString().replace(/\u001b\[[0-9;]*m/g, '');
      process.stdout.write('[vite] ' + s);
      if (s.includes(`localhost:${PORT}`)) resolve(proc);
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', b => process.stderr.write('[vite] ' + b));
    proc.on('exit', code => reject(new Error('vite exited ' + code)));
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const vite = await startVite();
let browser;
try {
  if (fs.existsSync(OUT)) fs.rmSync(OUT);
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    defaultViewport: {width: 1600, height: 1000},
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  });
  const page = await browser.newPage();
  page.on('console', m => {
    const tx = m.text();
    if (m.type() === 'error' || /render|ffmpeg|export/i.test(tx)) console.log('[page]', m.type(), tx);
  });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${PORT}/`, {waitUntil: 'networkidle0', timeout: 120000});

  // Find the editor's RENDER button and click it.
  const findButton = label =>
    page.evaluateHandle(lbl => {
      return [...document.querySelectorAll('button')].find(b => b.textContent.trim().toUpperCase() === lbl) ?? null;
    }, label);

  let btn;
  for (let i = 0; i < 60; i++) {
    btn = await findButton('RENDER');
    if (btn.asElement()) break;
    await sleep(500);
  }
  if (!btn.asElement()) {
    const labels = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent.trim()));
    throw new Error('RENDER button not found. Buttons: ' + JSON.stringify(labels));
  }
  const t0 = Date.now();
  await btn.asElement().click();
  console.log('Clicked RENDER');

  // While rendering, the button reads ABORT; it returns to RENDER when done.
  let sawAbort = false;
  for (;;) {
    await sleep(500);
    const abort = (await findButton('ABORT')).asElement();
    if (abort) sawAbort = true;
    if (sawAbort && !abort) break;
    if (!sawAbort && Date.now() - t0 > 20000) throw new Error('Render never started');
    if (Date.now() - t0 > 540000) throw new Error('Render timed out');
  }
  // Give the FFmpeg server process a moment to finalize the file.
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const size = fs.existsSync(OUT) ? fs.statSync(OUT).size : 0;
    if (size > 0 && size === last) break;
    last = size;
    await sleep(500);
  }
  console.log(`RENDER DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${OUT} (${last} bytes)`);
} finally {
  if (browser) await browser.close();
  vite.kill();
}
