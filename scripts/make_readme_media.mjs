// Makes the images the README uses, all into media/readme/:
//  - GIFs of selected live demos, recorded from index.html in headless Chrome
//  - GIFs cut from selected rendered clips
//  - one poster per catalog section: a labeled grid of every card
// Usage: node scripts/make_readme_media.mjs [--only name1,name2]   (needs ffmpeg on PATH)
// --only rebuilds just the named outputs, e.g. --only poster-ui,live-planet,hero-reel
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'media', 'readme');
const TMP = path.join(ROOT, '_work', 'readme-frames');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
const ff = (...a) => execFileSync('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', ...a]);
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const want = name => !ONLY || ONLY.includes(name);
const GIF_VF = 'scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4';

// Live demos: element id -> gif name. Learning demos use their canvas id; catalog cards use the card stage.
const LIVE = [
  ['ease-race', 'learn-easing-race'], ['cmp-follow', 'learn-follow-through'], ['cmp-secondary', 'learn-secondary-motion'], ['cmp-arcs', 'learn-arcs'],
  ['cam-rig', 'learn-camera-orbit'], ['tr-player', 'learn-transition-iris'], ['pg-preview', 'learn-your-words'], ['mood-energetic', 'learn-mood-energetic'], ['logo-live', 'learn-logo-reveal'],
  ['ex-fluid', 'live-fluid'], ['ex-reaction', 'live-reaction-diffusion'], ['ex-physarum', 'live-slime-mold'], ['ex-particletext', 'live-particle-text'],
  ['ex-liquidtype', 'live-liquid-type'], ['ex-blackhole', 'live-black-hole'], ['ex-ocean', 'live-ocean'], ['ex-isocity', 'live-isometric-city'],
  ['ex-softblob', 'live-soft-blobs'], ['ex-oscilloscope', 'live-oscilloscope'], ['ex-like', 'live-like-burst'], ['ex-sharedexpand', 'live-shared-expand'],
  ['ex-splitflap', 'live-split-flap'], ['ex-hexballs', 'live-hexagon-physics'], ['ex-sdfmorph', 'live-sdf-morph'],
  ['ex-ui2-glass', 'live-liquid-glass'], ['ex-g2-planet', 'live-planet'], ['ex-mg2-walk', 'live-walk-cycle'], ['ex-t2-neon', 'live-neon-sign'],
  ['ex-x-raster', 'live-software-rasterizer'], ['ex-au2-polyrhythm', 'live-polyrhythm'], ['ex-l2-d3-globe', 'live-dotted-globe'],
  ['ex-s2-attractors', 'live-strange-attractors'], ['ex-h2-lenia', 'live-lenia'],
];
// Rendered clips: file under media/ -> gif name, start fraction.
const CLIPS = [
  ['engine/liquid.mp4', 'clip-liquid', 0.35], ['engine/cloth.mp4', 'clip-cloth', 0.3], ['engine/unreal-niagara.mp4', 'clip-unreal-niagara', 0.3], ['engine/shatter.mp4', 'clip-shatter', 0.3],
  ['engine/cycles-photoreal.mp4', 'clip-cycles', 0.2], ['tools/webgpu.mp4', 'clip-webgpu', 0.5], ['tools/threejs.mp4', 'clip-threejs', 0.3], ['tools/remotion.mp4', 'clip-remotion', 0.3],
  ['tools/hyperframes.mp4', 'clip-hyperframes', 0.3], ['tools/manim.mp4', 'clip-manim', 0.3], ['edit/speed-ramp.mp4', 'clip-speed-ramp', 0.1], ['edit/datamosh.mp4', 'clip-datamosh', 0.35],
  ['engine/toon-line-art.mp4', 'clip-toon-line-art', 0.3], ['engine/exploded-view.mp4', 'clip-exploded-view', 0.3], ['tools/rust-pathtracer.mp4', 'clip-rust-pathtracer', 0.3],
  ['engine/unreal-lumen.mp4', 'clip-unreal-lumen', 0.5], ['tools/go-flip-hourglass.mp4', 'clip-flip-hourglass', 0.2], ['tools/taichi-mpm.mp4', 'clip-taichi-mpm', 0.3],
];

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
await page.waitForTimeout(600);

for (const [id, name] of LIVE.filter(([, n]) => want(n))) {
  const el = await page.$('#' + id); if (!el) { console.log('skip, not found:', id); continue; }
  const target = id.startsWith('ex-') ? await el.$('.stagewrap') : el;
  await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(1200);
  const dir = path.join(TMP, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  for (let i = 0; i < 40; i++) { await target.screenshot({ path: path.join(dir, `f_${String(i).padStart(3, '0')}.png`) }); await page.waitForTimeout(60); }
  ff('-framerate', '10', '-i', path.join(dir, 'f_%03d.png'), '-vf', GIF_VF, path.join(OUT, name + '.gif'));
  console.log('gif', name);
}

// Posters: one labeled grid per catalog section.
const cats = await page.evaluate(() => [...new Set(EX.cards.map(c => c.cat))].filter(c => document.getElementById('cat-' + c)));
for (const cat of cats.filter(c => want('poster-' + c))) {
  const ids = await page.evaluate(c => [...document.querySelectorAll('#cat-' + c + ' article.ex')].map(a => a.id), cat);
  const dir = path.join(TMP, 'poster-' + cat); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const files = [];
  for (const id of ids) {
    const el = await page.$('#' + id); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(1300);
    const f = path.join(dir, id + '.png'); await (await el.$('.stagewrap')).screenshot({ path: f });
    const title = await el.$eval('h3', h => h.textContent.replace(/'/g, '').replace(/:/g, ' -'));
    const lab = path.join(dir, id + '-l.png');
    ff('-i', f, '-vf', `scale=400:225,drawbox=y=ih-30:w=iw:h=30:color=black@0.65:t=fill,drawtext=text='${title}':fontcolor=white:fontsize=17:x=10:y=h-23:fontfile='C\\:/Windows/Fonts/segoeui.ttf'`, lab);
    files.push(lab);
  }
  const cols = 4, rows = Math.ceil(files.length / cols);
  const inputs = files.flatMap(f => ['-i', f]); const layout = files.map((_, i) => `${(i % cols) * 400}_${Math.floor(i / cols) * 225}`).join('|');
  if (files.length === 1) fs.copyFileSync(files[0], path.join(OUT, `poster-${cat}.jpg`));
  else ff(...inputs, '-filter_complex', `xstack=inputs=${files.length}:layout=${layout}:fill=black`, '-q:v', '4', path.join(OUT, `poster-${cat}.jpg`));
  console.log('poster', cat, files.length, 'cards', rows, 'rows');
}
await browser.close();

for (const [file, name, at] of CLIPS.filter(([, n]) => want(n))) {
  const src = path.join(ROOT, 'media', file); if (!fs.existsSync(src)) { console.log('skip, missing clip:', file); continue; }
  const d = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString());
  ff('-ss', String(d * at), '-t', '3.5', '-i', src, '-vf', 'fps=10,' + GIF_VF, path.join(OUT, name + '.gif'));
  console.log('gif', name);
}
// Hero GIFs: short parts of each reel joined into one loop. Each part is [start, length] in seconds.
function heroGif(file, parts, name) {
  const src = path.join(ROOT, 'media', 'reel', file);
  if (!fs.existsSync(src) || !want(name)) return;
  const files = parts.map(([s, len], i) => { const f = path.join(TMP, `${name}${i}.mp4`); ff('-ss', String(s), '-t', String(len), '-i', src, '-an', '-vf', 'fps=10,scale=640:-2', f); return f; });
  fs.writeFileSync(path.join(TMP, name + '.txt'), files.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  ff('-f', 'concat', '-safe', '0', '-i', path.join(TMP, name + '.txt'), '-vf', 'scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', path.join(OUT, name + '.gif'));
  console.log('gif', name);
}
heroGif('claude-motion-reel.mp4', [8, 16, 24.5, 33, 41, 48.5].map(s => [s, 1.4]), 'hero-reel');
heroGif('claude-motion-reel-2.mp4', [[5.4, 1.2], [9.4, 1.2], [13.4, 1.2], [15.4, 1.2], [19, 2], [23, 2], [29.4, 1.2], [31.4, 1.2], [35.6, 1.4]], 'hero-reel-2');
fs.rmSync(TMP, { recursive: true, force: true });
console.log('done');
