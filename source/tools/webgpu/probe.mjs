// Checks whether headless Chrome exposes a WebGPU adapter with a given flag set.
// Usage: node probe.mjs <A|B|C|D> [headed]
// navigator.gpu needs a secure context, so the test page is served from localhost.
import { chromium } from 'playwright-core';
import http from 'node:http';

const sets = {
  A: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,UseSkiaRenderer', '--use-angle=d3d11'],
  B: ['--enable-unsafe-webgpu', '--use-webgpu-adapter=d3d12', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  C: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  D: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=WebGPUService'],
};
const which = process.argv[2] || 'C';
const headless = process.argv[3] !== 'headed';

const srv = http.createServer((q, s) => { s.writeHead(200, { 'Content-Type': 'text/html' }); s.end('<html></html>'); }).listen(8131);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless, args: sets[which] });
const p = await b.newPage();
await p.goto('http://localhost:8131/');
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
