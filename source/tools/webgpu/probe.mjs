/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Checks whether headless Chrome exposes a WebGPU adapter with a given flag set.
// Usage: node probe.mjs <A|B|C|D> [headed]
// navigator.gpu needs a secure context, so the test page is served from 127.0.0.1 (this machine only).
// Chrome binary: CHROME_PATH if set, else the standard install path for this OS.
import { chromium } from 'playwright-core';
import http from 'node:http';

const CHROME = process.env.CHROME_PATH || ({ win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })[process.platform] || '/usr/bin/google-chrome';
const sets = {
  A: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,UseSkiaRenderer', '--use-angle=d3d11'],
  B: ['--enable-unsafe-webgpu', '--use-webgpu-adapter=d3d12', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  C: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  D: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=WebGPUService'],
};
const which = process.argv[2] || 'C';
const headless = process.argv[3] !== 'headed';

// ANGLE on D3D11 is Windows-only, so other systems drop that flag.
const args = sets[which].filter(a => process.platform === 'win32' || a !== '--use-angle=d3d11');

const srv = http.createServer((q, s) => { s.writeHead(200, { 'Content-Type': 'text/html' }); s.end('<html></html>'); }).listen(8131, '127.0.0.1');
const b = await chromium.launch({ executablePath: CHROME, headless, args });
const p = await b.newPage();
await p.goto('http://127.0.0.1:8131/');
const r = await p.evaluate(async () => {
  if (!navigator.gpu) return 'no navigator.gpu';
  try {
    const a = await navigator.gpu.requestAdapter();
    if (!a) return 'adapter null';
    await a.requestDevice();
    const info = a.info || {};
    return 'OK ' + JSON.stringify({ vendor: info.vendor, arch: info.architecture, maxStorageBuffer: a.limits.maxStorageBufferBindingSize });
  } catch (e) { return 'ERR ' + e.message; }
});
console.log(which, headless ? 'headless' : 'headed', r, 'Chrome', b.version());
await b.close();
srv.close();
