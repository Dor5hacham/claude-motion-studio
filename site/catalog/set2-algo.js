// Algorithms as motion design for the simulation section (Canvas 2D, CPU).
(function () {
  const { C, seg, lerp, ease, rng } = EX;
  const W = 640, H = 360;
  const hexRGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const smooth = x => x * x * (3 - 2 * x);
  // ramp(f) maps 0..1 to an rgb() string along the given hex stops.
  const ramp = stops => { const s = stops.map(hexRGB); return f => { const x = Math.min(0.9999, Math.max(0, f)) * (s.length - 1), i = x | 0, k = x - i, a = s[i], b = s[i + 1]; return `rgb(${lerp(a[0], b[0], k) | 0},${lerp(a[1], b[1], k) | 0},${lerp(a[2], b[2], k) | 0})`; }; };
  const hud = (g, label, value, a) => {
    g.globalAlpha = a; g.font = '600 11px Cascadia Mono, Consolas'; g.letterSpacing = '2px'; g.textBaseline = 'alphabetic';
    g.fillStyle = C.cream; g.textAlign = 'left'; g.fillText(label, 16, H - 12);
    g.fillStyle = 'rgba(244,239,230,0.55)'; g.textAlign = 'right'; g.fillText(value, W - 16, H - 12);
    g.textAlign = 'left'; g.letterSpacing = '0px'; g.globalAlpha = 1;
  };

  EX.add({
    cat: 'sim', id: 'a2-maze', title: 'Maze carve, flood and solve', aka: 'recursive backtracker, depth-first maze generation, breadth-first flood fill, shortest path', tool: 'Canvas 2D (depth-first search + breadth-first search)', runs: 'CPU',
    notice: 'A glowing head digs a maze by depth-first search: it steps to a random unvisited neighbor and backs up along its own trail (the coral line) when stuck. A few walls then pop open to make loops. A breadth-first flood spreads from the top-left corner as a color wave that marks distance, and the shortest path to the exit is read back through it.',
    use: 'game and puzzle intros, "finding the way" metaphors, explainers about search and planning',
    params: [{ key: 'cell', label: 'Cell size', min: 12, max: 40, step: 2, value: 20, unit: ' px', restart: true }, { key: 'loops', label: 'Extra openings', min: 0, max: 30, step: 1, value: 6, unit: '%', restart: true }],
    prompt: 'Maze in three acts, 13 s loop on near-black: a recursive backtracker carves {cell} corridors drawn as thick rounded navy tubes, its stack shown as a glowing coral trail with a bright head; then {loops} of the walls pop open with small flashes; a breadth-first flood spreads from the top-left in a coral, amber, cyan, violet distance wave; the shortest path draws on in cream with a dot head and a traveling pulse; fade out and start again with a new seed. Small mono HUD with the phase name and counters.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const cs = L.p.cell, T = 13.4, lw = cs * 0.56;
      const cols = Math.floor((W - 24) / cs), rows = Math.floor((H - 56) / cs), N = cols * rows;
      const ox = (W - (cols - 1) * cs) / 2, oy = (H - 30 - (rows - 1) * cs) / 2;
      const X = i => ox + (i % cols) * cs, Y = i => oy + ((i / cols) | 0) * cs;
      const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
      const base = mk(), bg = base.getContext('2d'), grid = mk(), gg = grid.getContext('2d');
      gg.fillStyle = 'rgba(244,239,230,0.14)'; for (let i = 0; i < N; i++) gg.fillRect(X(i) - 1, Y(i) - 1, 2, 2);
      const open = new Uint8Array(N), seen = new Uint8Array(N), dist = new Int32Array(N), par = new Int32Array(N), order = new Int32Array(N);
      const ev = new Int32Array(2 * N + 2), st = new Int32Array(N + 1), live = new Int32Array(N + 1), dStart = new Int32Array(N + 2);
      const flood = ramp([C.coral, C.amber, C.green, C.cyan, C.violet]);
      let nEv = 0, sp = 0, done = 0, visited = 0, D = 1, path = [], gaps = [], gapsDone = 0, flooded = 0, cyc = -1, dcol = [];
      const nb = (i, d) => { const x = i % cols, y = (i / cols) | 0; return d === 0 ? (y > 0 ? i - cols : -1) : d === 1 ? (x < cols - 1 ? i + 1 : -1) : d === 2 ? (y < rows - 1 ? i + cols : -1) : (x > 0 ? i - 1 : -1); };
      // Builds the whole maze for one loop: carve events, extra openings, distances and the path.
      function build(seed) {
        const r = rng(seed); open.fill(0); seen.fill(0); nEv = 0; let top = 0;
        const s0 = ((rows / 2) | 0) * cols + ((cols / 2) | 0); st[top++] = s0; seen[s0] = 1; ev[nEv++] = s0;
        while (top) {
          const c = st[top - 1]; let n = 0, pick = -1, pd = 0;
          for (let d = 0; d < 4; d++) { const q = nb(c, d); if (q >= 0 && !seen[q] && r() * ++n < 1) { pick = q; pd = d; } }
          if (pick < 0) { top--; ev[nEv++] = -1; continue; }
          open[c] |= 1 << pd; open[pick] |= 1 << ((pd + 2) & 3); seen[pick] = 1; st[top++] = pick; ev[nEv++] = pick;
        }
        gaps = []; const want = Math.round(N * L.p.loops / 100);
        for (let k = 0; k < want * 30 && gaps.length < want; k++) { const i = (r() * N) | 0, d = 1 + ((r() * 2) | 0), q = nb(i, d); if (q < 0 || open[i] & (1 << d)) continue; open[i] |= 1 << d; open[q] |= 1 << ((d + 2) & 3); gaps.push([i, q]); }
        dist.fill(-1); let h = 0, tl = 0; order[tl++] = 0; dist[0] = 0; par[0] = -1;
        while (h < tl) { const c = order[h++]; for (let d = 0; d < 4; d++) if (open[c] & (1 << d)) { const q = nb(c, d); if (dist[q] < 0) { dist[q] = dist[c] + 1; par[q] = c; order[tl++] = q; } } }
        D = dist[order[N - 1]]; dStart.fill(N); for (let k = N - 1; k >= 0; k--) dStart[dist[order[k]]] = k;
        dcol = []; for (let d = 0; d <= D; d++) dcol.push(flood(d / D));
        path = []; for (let c = N - 1; c >= 0; c = par[c]) path.push(c); path.reverse();
        sp = 0; done = 0; visited = 0; gapsDone = 0; flooded = 0; bg.clearRect(0, 0, W, H);
      }
      const seedrng = rng(4242);
      const at = u => { const n = Math.min(path.length - 1, Math.floor(u)), f = u - n, a = path[n], b = path[Math.min(n + 1, path.length - 1)]; return [lerp(X(a), X(b), f), lerp(Y(a), Y(b), f)]; };
      // Builds the path polyline between u0 and u1, measured in cells from the start.
      const pathTo = (u1, u0 = 0) => { const p0 = at(u0), p1 = at(u1); g.beginPath(); g.moveTo(p0[0], p0[1]); for (let k = Math.floor(u0) + 1; k <= u1; k++) g.lineTo(X(path[k]), Y(path[k])); g.lineTo(p1[0], p1[1]); return p1; };
      return t => {
        const c = Math.floor(t / T), lt = t - c * T;
        if (c !== cyc) { cyc = c; build(((seedrng() * 1e9) | 0) + c); }
        // carve: replay the recorded events up to the current time
        const target = Math.floor(nEv * smooth(seg(lt, 0.5, 5.4)));
        if (done < target) {
          bg.lineCap = 'round'; bg.lineWidth = lw; bg.strokeStyle = '#272442'; bg.beginPath();
          while (done < target) { const b = ev[done++]; if (b < 0) { sp--; continue; } if (sp) { bg.moveTo(X(live[sp - 1]), Y(live[sp - 1])); bg.lineTo(X(b), Y(b)); } else { bg.moveTo(X(b) - 0.01, Y(b)); bg.lineTo(X(b), Y(b)); } live[sp++] = b; visited++; }
          bg.stroke();
        }
        // extra openings
        const gt = Math.floor(gaps.length * seg(lt, 5.5, 6.2));
        if (gapsDone < gt) { bg.lineCap = 'round'; bg.lineWidth = lw; bg.strokeStyle = '#272442'; bg.beginPath(); while (gapsDone < gt) { const [a, b] = gaps[gapsDone++]; bg.moveTo(X(a), Y(a)); bg.lineTo(X(b), Y(b)); } bg.stroke(); }
        // flood: color each reached cell by its distance
        const front = lt < 6.4 ? -1 : (D + 1) * seg(lt, 6.4, 9.4);
        bg.lineCap = 'round'; bg.lineWidth = lw;
        while (flooded < N && dist[order[flooded]] <= front) { const q = order[flooded++], p = par[q]; bg.strokeStyle = dcol[dist[q]]; bg.beginPath(); if (p >= 0) bg.moveTo(X(p), Y(p)); else bg.moveTo(X(q) - 0.01, Y(q)); bg.lineTo(X(q), Y(q)); bg.stroke(); }

        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.globalAlpha = 0.3 + 0.7 * seg(lt, 0, 0.5); g.drawImage(grid, 0, 0); g.globalAlpha = 1;
        g.drawImage(base, 0, 0);
        g.lineCap = 'round'; g.lineJoin = 'round';
        if (sp && lt < 5.6) {
          g.beginPath(); g.moveTo(X(live[0]), Y(live[0])); for (let k = 1; k < sp; k++) g.lineTo(X(live[k]), Y(live[k]));
          g.strokeStyle = 'rgba(255,90,54,0.28)'; g.lineWidth = lw; g.stroke(); g.strokeStyle = C.coral; g.lineWidth = Math.max(2, cs * 0.14); g.stroke();
          const hx = X(live[sp - 1]), hy = Y(live[sp - 1]), gr = g.createRadialGradient(hx, hy, 0, hx, hy, cs * 1.6);
          gr.addColorStop(0, 'rgba(255,240,220,1)'); gr.addColorStop(0.2, 'rgba(255,176,32,0.8)'); gr.addColorStop(1, 'rgba(255,90,54,0)');
          g.fillStyle = gr; g.fillRect(hx - cs * 1.6, hy - cs * 1.6, cs * 3.2, cs * 3.2);
        }
        for (let k = 0; k < gaps.length; k++) {
          const f = seg(lt, 5.5 + k / gaps.length * 0.7, 5.95 + k / gaps.length * 0.7); if (f <= 0 || f >= 1) continue;
          const [a, b] = gaps[k], mx = (X(a) + X(b)) / 2, my = (Y(a) + Y(b)) / 2;
          g.strokeStyle = `rgba(255,176,32,${1 - f})`; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, cs * (0.3 + ease.out(f) * 0.9), 0, 7); g.stroke();
        }
        if (lt > 6.4 && lt < 9.6) {
          const fi = Math.floor(front), k0 = dStart[Math.max(0, fi - 3)], k1 = dStart[Math.min(D + 1, fi + 1)];
          for (let k = k0; k < k1; k++) { const q = order[k], a = 1 - (front - dist[q]) / 4; if (a <= 0) continue; g.fillStyle = `rgba(255,248,235,${a * 0.9})`; g.beginPath(); g.arc(X(q), Y(q), lw * 0.42, 0, 7); g.fill(); }
        }
        const dim = 0.6 * ease.inOut(seg(lt, 10.4, 11.2)); if (dim > 0) { g.fillStyle = `rgba(11,11,16,${dim})`; g.fillRect(0, 0, W, H); }
        const mA = seg(lt, 6.0, 6.5);
        if (mA > 0) for (const [q, col] of /** @type {[number, string][]} */ ([[0, C.cream], [N - 1, C.cream]])) { g.globalAlpha = mA; g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(X(q), Y(q), cs * (0.55 + 0.1 * Math.sin(lt * 6)), 0, 7); g.stroke(); g.globalAlpha = 1; }
        const pp = ease.inOut(seg(lt, 9.5, 11.0));
        if (pp > 0) {
          const len = (path.length - 1) * pp;
          pathTo(len); g.strokeStyle = C.bg; g.lineWidth = cs * 0.4; g.stroke();
          const [hx, hy] = pathTo(len); g.strokeStyle = C.cream; g.lineWidth = cs * 0.2; g.stroke();
          const s1 = ((lt - 11) * 16) % (path.length + 20); if (pp >= 1 && s1 > 0.1 && s1 - 4 < len) { pathTo(Math.min(len, s1), Math.max(0, s1 - 4)); g.strokeStyle = 'rgba(255,176,32,0.35)'; g.lineWidth = cs * 0.6; g.stroke(); g.strokeStyle = C.amber; g.lineWidth = cs * 0.24; g.stroke(); }
          g.fillStyle = C.cream; g.beginPath(); g.arc(hx, hy, cs * 0.3 * (1 + 0.4 * (1 - seg(lt, 11, 11.4))), 0, 7); g.fill();
        }
        const vis = 1 - seg(lt, 12.7, 13.3);
        if (lt < 5.5) hud(g, 'DEPTH-FIRST CARVE', `visited ${visited} / ${N}   stack ${sp}`, vis);
        else if (lt < 6.3) hud(g, 'KNOCK OUT WALLS', `+${gapsDone} loops`, vis);
        else if (lt < 9.5) hud(g, 'BREADTH-FIRST FLOOD', `distance ${Math.min(D, Math.floor(front))}`, vis);
        else hud(g, 'SHORTEST PATH', `${Math.round((path.length - 1) * pp)} steps`, vis);
        const fo = ease.inOut(seg(lt, 12.6, 13.3)); if (fo > 0) { g.fillStyle = `rgba(11,11,16,${fo})`; g.fillRect(0, 0, W, H); }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-wfc', title: 'Wave function collapse map', aka: 'WFC, constraint propagation, procedural tile map, entropy-first generation', tool: 'Canvas 2D (wave function collapse, simple tiled model)', runs: 'CPU',
    notice: 'Every square starts as a blur of all 31 tiles it could still be. The square with the fewest options picks one at random, and its neighbors drop every tile whose edges would not match, so roads, rivers and bridges always connect. The map sharpens outward from each decision, then dissolves back into the blur for a new seed.',
    use: 'procedural maps and levels, generative pattern design, explaining constraint solvers',
    params: [{ key: 'pace', label: 'Collapse time', min: 3, max: 14, step: 0.5, value: 7, unit: ' s', restart: true }],
    prompt: 'Wave function collapse building a hand-inked paper map, 16 x 9 tiles of 40 px: grass, forest, crop fields, roads with dashed center lines, a river with bends, bridges, ponds and houses at road ends. Undecided squares show all remaining tiles as faint overlays, a coral cursor flickers through the options of the lowest-entropy square, each collapse pops in with overshoot, collapsing takes {pace}, hold, then the map dissolves back to the blur and a new seed plays. Small navy HUD with collapsed count and options left.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const TS = 40, GW = 16, GH = 9, NC = GW * GH, PACE = L.p.pace, T0 = 0.8, T1 = T0 + PACE, T = T1 + 4.6;
      const paper = '#efe8dc', roadC = '#4a4560', water = '#5bbfe0', bank = '#2f87ad', tree = '#5a9663', treeD = '#2f5a3e';
      // Each tile is drawn facing north, then rotated; sockets are [N, E, S, W] with 0 land, 1 road, 2 river.
      const road = (c, pts) => { c.lineCap = 'butt'; c.strokeStyle = roadC; c.lineWidth = 8; c.beginPath(); pts(c); c.stroke(); c.strokeStyle = 'rgba(244,239,230,0.85)'; c.lineWidth = 1.2; c.setLineDash([4, 4]); c.beginPath(); pts(c); c.stroke(); c.setLineDash([]); };
      const river = (c, pts) => { c.lineCap = 'butt'; c.strokeStyle = bank; c.lineWidth = 13; c.beginPath(); pts(c); c.stroke(); c.strokeStyle = water; c.lineWidth = 9; c.beginPath(); pts(c); c.stroke(); c.strokeStyle = 'rgba(255,255,255,0.45)'; c.lineWidth = 1.2; c.setLineDash([3, 7]); c.beginPath(); pts(c); c.stroke(); c.setLineDash([]); };
      const NS = c => { c.moveTo(20, 0); c.lineTo(20, 40); }, NC_ = c => { c.moveTo(20, 0); c.lineTo(20, 20); }, NE = c => { c.moveTo(20, 0); c.arc(40, 0, 20, Math.PI, Math.PI / 2, true); }, EW = c => { c.moveTo(0, 20); c.lineTo(40, 20); };
      const tufts = (c, seed, n) => { const r = rng(seed); c.strokeStyle = 'rgba(110,140,90,0.55)'; c.lineWidth = 1; for (let k = 0; k < n; k++) { const x = 5 + r() * 30, y = 6 + r() * 30; c.beginPath(); c.moveTo(x - 2, y - 2); c.lineTo(x, y + 1); c.lineTo(x + 2, y - 3); c.stroke(); } };
      const SHAPES = [
        { sock: [0, 0, 0, 0], w: 5, rots: [0], draw: c => tufts(c, 3, 4) },
        { sock: [0, 0, 0, 0], w: 1.3, rots: [0, 1], draw: c => { const r = rng(9); for (let k = 0; k < 6; k++) { const x = 8 + r() * 24, y = 8 + r() * 24, s = 5 + r() * 3; c.fillStyle = 'rgba(30,40,30,0.18)'; c.beginPath(); c.arc(x + 2, y + 2, s, 0, 7); c.fill(); c.fillStyle = tree; c.strokeStyle = treeD; c.lineWidth = 1; c.beginPath(); c.arc(x, y, s, 0, 7); c.fill(); c.stroke(); } } },
        { sock: [0, 0, 0, 0], w: 1.2, rots: [0], draw: c => { c.fillStyle = '#e7d396'; c.fillRect(5, 5, 30, 30); c.strokeStyle = '#c9a24e'; c.lineWidth = 1.4; c.beginPath(); for (let y = 9; y < 35; y += 5) { c.moveTo(7, y); c.lineTo(33, y); } c.stroke(); } },
        { sock: [1, 0, 0, 0], w: 0.25, rots: [0, 1, 2, 3], draw: c => { road(c, c2 => { c2.moveTo(20, 0); c2.lineTo(20, 16); }); c.fillStyle = 'rgba(30,20,20,0.2)'; c.fillRect(13, 17, 18, 15); c.fillStyle = C.coral; c.fillRect(11, 15, 18, 15); c.strokeStyle = '#9c2f1c'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(11, 22.5); c.lineTo(29, 22.5); c.stroke(); } },
        { sock: [1, 0, 1, 0], w: 1.2, rots: [0, 1], draw: c => road(c, NS) },
        { sock: [1, 1, 0, 0], w: 0.6, rots: [0, 1, 2, 3], draw: c => road(c, NE) },
        { sock: [1, 1, 1, 0], w: 0.2, rots: [0, 1, 2, 3], draw: c => road(c, c2 => { NS(c2); c2.moveTo(20, 20); c2.lineTo(40, 20); }) },
        { sock: [1, 1, 1, 1], w: 0.15, rots: [0], draw: c => road(c, c2 => { NS(c2); EW(c2); }) },
        { sock: [2, 0, 2, 0], w: 1, rots: [0, 1], draw: c => river(c, NS) },
        { sock: [2, 2, 0, 0], w: 0.45, rots: [0, 1, 2, 3], draw: c => river(c, NE) },
        { sock: [2, 1, 2, 1], w: 0.35, rots: [0, 1], draw: c => { river(c, NS); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, 17, 40, 10); road(c, EW); c.strokeStyle = '#2a2638'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(10, 15); c.lineTo(30, 15); c.moveTo(10, 25); c.lineTo(30, 25); c.stroke(); } },
        { sock: [2, 0, 0, 0], w: 0.12, rots: [0, 1, 2, 3], draw: c => { river(c, NC_); c.fillStyle = bank; c.beginPath(); c.ellipse(20, 23, 14, 12, 0, 0, 7); c.fill(); c.fillStyle = water; c.beginPath(); c.ellipse(20, 23, 11.5, 9.5, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.2; c.beginPath(); c.arc(17, 21, 5, 3.5, 4.6); c.stroke(); } },
      ];
      const tiles = [];
      for (const s of SHAPES) for (const rot of s.rots) {
        const sp = document.createElement('canvas'); sp.width = sp.height = TS; const c = sp.getContext('2d');
        c.translate(20, 20); c.rotate(rot * Math.PI / 2); c.translate(-20, -20); s.draw(c);
        const sock = [0, 0, 0, 0]; for (let d = 0; d < 4; d++) sock[(d + rot) & 3] = s.sock[d];
        tiles.push({ sp, sock, w: s.w });
      }
      const NT = tiles.length, ALL = (2 ** NT) - 1;
      // side[d][s]: tiles with socket s on side d; opp[d][s]: tiles that may sit beyond side d when it shows s.
      const side = [0, 1, 2, 3].map(d => [0, 1, 2].map(s => tiles.reduce((m, t, i) => t.sock[d] === s ? m | (1 << i) : m, 0)));
      const opp = [0, 1, 2, 3].map(d => [0, 1, 2].map(s => side[(d + 2) & 3][s]));
      const pop = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
      const nbr = (i, d) => { const x = i % GW, y = (i / GW) | 0; return d === 0 ? (y > 0 ? i - GW : -1) : d === 1 ? (x < GW - 1 ? i + 1 : -1) : d === 2 ? (y < GH - 1 ? i + GW : -1) : (x > 0 ? i - 1 : -1); };
      let snaps = [], chosen = [], opts = [], restarts = 0, shown = 0, cyc = -1;
      const queue = new Int32Array(NC * 8);
      // Runs one full collapse and records the masks after every decision; returns false on a contradiction.
      function solve(r) {
        const m = new Uint32Array(NC).fill(ALL); snaps = [m.slice()]; chosen = [-1]; opts = [NC * NT];
        for (;;) {
          let best = -1, be = 1e9;
          for (let i = 0; i < NC; i++) { const n = pop(m[i]); if (!n) return false; if (n > 1) { const e = n + r() * 0.9; if (e < be) { be = e; best = i; } } }
          if (best < 0) return true;
          let tw = 0; for (let k = 0; k < NT; k++) if (m[best] & (1 << k)) tw += tiles[k].w;
          let pick = r() * tw, tk = 0; for (let k = 0; k < NT; k++) if (m[best] & (1 << k)) { pick -= tiles[k].w; tk = k; if (pick <= 0) break; }
          m[best] = 1 << tk; let qh = 0, qt = 0; queue[qt++] = best;
          while (qh < qt) {
            const i = queue[qh++];
            for (let d = 0; d < 4; d++) {
              const j = nbr(i, d); if (j < 0) continue; let allow = 0;
              for (let s = 0; s < 3; s++) if (m[i] & side[d][s]) allow |= opp[d][s];
              const nm = (m[j] & allow) >>> 0; if (nm === m[j]) continue; if (!nm) return false;
              m[j] = nm; if (qt < queue.length) queue[qt++] = j;
            }
          }
          snaps.push(m.slice()); chosen.push(best); let o = 0; for (let i = 0; i < NC; i++) o += pop(m[i]); opts.push(o);
        }
      }
      const map = document.createElement('canvas'); map.width = W; map.height = H; const mg = map.getContext('2d');
      const pr = hexRGB(paper), dk = [214, 204, 186];
      const drawCell = (i, m) => {
        const x = (i % GW) * TS, y = ((i / GW) | 0) * TS, n = pop(m), f = (n - 1) / (NT - 1);
        mg.fillStyle = n === 1 ? paper : `rgb(${lerp(pr[0], dk[0], 0.35 + 0.65 * f) | 0},${lerp(pr[1], dk[1], 0.35 + 0.65 * f) | 0},${lerp(pr[2], dk[2], 0.35 + 0.65 * f) | 0})`; mg.fillRect(x, y, TS, TS);
        if (n === 1) { mg.drawImage(tiles[31 - Math.clz32(m)].sp, x, y); return; }
        mg.globalAlpha = Math.min(0.75, 1.25 / n); for (let k = 0; k < NT; k++) if (m & (1 << k)) mg.drawImage(tiles[k].sp, x, y);
        mg.globalAlpha = 1; mg.strokeStyle = 'rgba(54,48,74,0.12)'; mg.lineWidth = 1; mg.strokeRect(x + 0.5, y + 0.5, TS - 1, TS - 1);
      };
      const seeder = rng(808);
      // Steps advance slowly at first so the first decisions can be read, then speed up.
      const stepAt = lt => lt < T1 + 1 ? Math.floor((snaps.length - 1) * Math.pow(seg(lt, T0, T1), 2)) : Math.floor((snaps.length - 1) * (1 - ease.inOut(seg(lt, T - 2.2, T - 0.5))));
      const timeOf = k => T0 + PACE * Math.sqrt(k / (snaps.length - 1));
      const vig = g.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 420); vig.addColorStop(0, 'rgba(60,40,20,0)'); vig.addColorStop(1, 'rgba(60,40,20,0.28)');
      return t => {
        const c = Math.floor(t / T), lt = t - c * T;
        if (c !== cyc) { cyc = c; restarts = 0; while (!solve(rng(((seeder() * 1e9) | 0) + c)) && restarts < 60) restarts++; shown = 0; for (let i = 0; i < NC; i++) drawCell(i, snaps[0][i]); }
        const k = Math.min(snaps.length - 1, stepAt(lt));
        if (k !== shown) { const A = snaps[shown], B = snaps[k]; for (let i = 0; i < NC; i++) if (A[i] !== B[i]) drawCell(i, B[i]); shown = k; }
        g.drawImage(map, 0, 0);
        const fwd = lt < T1 + 0.5;
        if (fwd && k + 1 < snaps.length) {
          const q = chosen[k + 1], m = snaps[k][q], n = pop(m), x = (q % GW) * TS, y = ((q / GW) | 0) * TS;
          let pick = Math.floor(lt * 18) % n; for (let b = 0; b < NT; b++) if (m & (1 << b)) { if (!pick--) { g.globalAlpha = 0.85; g.drawImage(tiles[b].sp, x, y); g.globalAlpha = 1; break; } }
          g.strokeStyle = C.coral; g.lineWidth = 2.5; g.strokeRect(x + 1.5, y + 1.5, TS - 3, TS - 3);
        }
        if (fwd) for (let j = Math.max(1, k - 12); j <= k; j++) {
          const a = (lt - timeOf(j)) / 0.32; if (a < 0 || a >= 1) continue;
          const q = chosen[j], x = (q % GW) * TS + 20, y = ((q / GW) | 0) * TS + 20, s = lerp(1.35, 1, ease.back(Math.min(1, a * 1.6)));
          g.save(); g.translate(x, y); g.scale(s, s); g.drawImage(tiles[31 - Math.clz32(snaps[j][q])].sp, -20, -20); g.restore();
          g.strokeStyle = `rgba(255,90,54,${0.8 * (1 - a) * (1 - a)})`; g.lineWidth = 2; g.strokeRect(x - 20 * s, y - 20 * s, 40 * s, 40 * s);
        }
        const sh = seg(lt, T1 + 0.4, T1 + 1.8);
        if (sh > 0 && sh < 1) { const sx = lerp(-200, W + 200, ease.inOut(sh)), gr = g.createLinearGradient(sx - 90, 0, sx + 90, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,250,235,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
        g.fillStyle = vig; g.fillRect(0, 0, W, H);
        let col = 0; for (let i = 0; i < NC; i++) if (pop(snaps[k][i]) === 1) col++;
        const txt = `WAVE FUNCTION COLLAPSE   ${col} / ${NC} decided   ${opts[k]} options left${restarts ? `   ${restarts} restart${restarts > 1 ? 's' : ''}` : ''}`;
        g.font = '600 11px Cascadia Mono, Consolas'; g.letterSpacing = '1px'; const tw = g.measureText(txt).width;
        g.fillStyle = 'rgba(29,27,58,0.88)'; g.beginPath(); g.roundRect(10, H - 34, tw + 24, 24, 12); g.fill();
        g.fillStyle = C.cream; g.textBaseline = 'middle'; g.fillText(txt, 22, H - 21.5); g.letterSpacing = '0px'; g.textBaseline = 'alphabetic';
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-stipple', title: 'Weighted Voronoi stippling', aka: 'Lloyd relaxation, centroidal Voronoi tessellation, stipple art, pointillism', tool: 'Canvas 2D + D3 (d3-delaunay)', runs: 'CPU',
    notice: 'Dots are first scattered at random, more of them where the hidden picture is bright, so the image shows but looks clumpy. Then each dot moves again and again to the brightness-weighted center of its Voronoi cell (the faint web) and the clumps even out into a clean stipple. When the picture changes, the dots are paired up along a space-filling curve and fly to their new places.',
    use: 'engraving and print-style art, logo builds from particles, data-art portraits, generative posters',
    params: [{ key: 'dots', label: 'Dots', min: 800, max: 5000, step: 100, value: 2200, restart: true }, { key: 'relax', label: 'Step toward centroid', min: 0.1, max: 1.9, step: 0.05, value: 1 }],
    prompt: 'Weighted Voronoi stippling with d3-delaunay, a 14 s loop on near-black: {dots} dots are rejection-sampled from a ringed planet drawn in an offscreen canvas and fly in from random noise, then Lloyd relaxation (each step moves {relax} of the way to the brightness-weighted centroid of the Voronoi cell, 40 steps per second, faint Voronoi web visible) turns the clumpy scatter into an even stipple. After 7 s the target becomes a big Georgia italic ampersand: dots are paired by Hilbert-curve order and fly there with a staggered ease-in-out, then relax again. Dot size and color follow brightness from violet to coral to cream, a small target thumbnail and a mono HUD with the phase and iteration count.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const d3 = /** @type {any} */ (window).d3;
      if (!d3 || !d3.Delaunay) { g.fillStyle = C.bg; g.fillRect(0, 0, W, H); g.fillStyle = C.cream; g.font = '14px Segoe UI'; g.fillText('D3 did not load.', 24, 40); return () => {}; }
      const DW = 256, DH = 144, SX = W / DW, SY = H / DH, N = L.p.dots, HALF = 7, FLY = 1.5, STAG = 0.7;
      // Target pictures are drawn in grayscale on a 256 x 144 design grid; brightness becomes density.
      const planet = c => {
        const x = 128, y = 72, R = 46, ring = back => { c.save(); c.translate(x, y); c.rotate(-0.32); c.beginPath(); c.ellipse(0, 0, 96, 22, 0, back ? Math.PI : 0, back ? 2 * Math.PI : Math.PI); c.strokeStyle = '#bbb'; c.lineWidth = 7; c.stroke(); c.strokeStyle = '#777'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 108, 25, 0, back ? Math.PI : 0, back ? 2 * Math.PI : Math.PI); c.stroke(); c.restore(); };
        ring(true);
        const gr = c.createRadialGradient(x - 18, y - 20, 4, x, y, R); gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#9a9a9a'); gr.addColorStop(1, '#141414'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill();
        c.save(); c.beginPath(); c.arc(x, y, R, 0, 7); c.clip(); c.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = -3; k <= 3; k++) { c.beginPath(); c.ellipse(x, y + k * 13 + 4, R * 1.2, 3.2, -0.1, 0, 7); c.fill(); } c.restore();
        ring(false);
        const mg = c.createRadialGradient(36, 30, 1, 40, 34, 10); mg.addColorStop(0, '#eee'); mg.addColorStop(1, '#222'); c.fillStyle = mg; c.beginPath(); c.arc(40, 34, 10, 0, 7); c.fill();
      };
      const amp = c => { const gr = c.createLinearGradient(0, 10, 0, 140); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#606060'); c.fillStyle = gr; c.font = 'italic 700 150px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('&', 128, 80); };
      const pics = [planet, amp].map(draw => {
        const cn = document.createElement('canvas'); cn.width = DW; cn.height = DH; const c = cn.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, DW, DH); c.scale(DW / 256, DH / 144); draw(c);
        const px = c.getImageData(0, 0, DW, DH).data, d = new Float32Array(DW * DH);
        for (let i = 0; i < DW * DH; i++) { const v = px[i * 4] / 255; d[i] = v > 0.04 ? 0.18 + 0.82 * v : 0.002; }
        return { cn, d };
      });
      const r = rng(17), pts = new Float64Array(N * 2), fx = new Float64Array(N), fy = new Float64Array(N), tx = new Float64Array(N), ty = new Float64Array(N), dl = new Float64Array(N), bow = new Float64Array(N);
      for (let i = 0; i < N; i++) { pts[2 * i] = r() * W; pts[2 * i + 1] = r() * H; }
      const del = new d3.Delaunay(pts), sx = new Float64Array(N), sy = new Float64Array(N), sw = new Float64Array(N);
      const hil = (x, y) => { let d = 0; for (let s = 128; s > 0; s >>= 1) { const rx = x & s ? 1 : 0, ry = y & s ? 1 : 0; d += s * s * ((3 * rx) ^ ry); if (!ry) { if (rx) { x = 255 - x; y = 255 - y; } const q = x; x = y; y = q; } } return d; };
      const order = (xs, ys) => { const k = new Float64Array(N); for (let i = 0; i < N; i++) k[i] = hil(Math.min(255, Math.max(0, (xs[i] / W * 256) | 0)), Math.min(255, Math.max(0, (ys[i] / H * 256) | 0))); return [...Array(N).keys()].sort((a, b) => k[a] - k[b]); };
      // Picks new homes for the dots: rejection sampling from the density, paired with the current dots in Hilbert-curve order.
      const retarget = d => {
        const nx = new Float64Array(N), ny = new Float64Array(N), cx = new Float64Array(N), cy = new Float64Array(N);
        for (let i = 0; i < N;) { const x = r() * DW, y = r() * DH; if (r() * 1.002 < d[(y | 0) * DW + (x | 0)]) { nx[i] = x * SX; ny[i] = y * SY; i++; } }
        for (let i = 0; i < N; i++) { cx[i] = pts[2 * i]; cy[i] = pts[2 * i + 1]; }
        const a = order(cx, cy), b = order(nx, ny);
        for (let k = 0; k < N; k++) { const i = a[k]; fx[i] = cx[i]; fy[i] = cy[i]; tx[i] = nx[b[k]]; ty[i] = ny[b[k]]; dl[i] = k / N * STAG; bow[i] = (r() - 0.5) * 0.5; }
      };
      let iter = 0, acc = 0, last = -1, settled = false;
      // One weighted Lloyd step: every density pixel adds its weight to the nearest dot, then dots move toward their centroids.
      const relax = d => {
        sx.fill(0); sy.fill(0); sw.fill(0); let hint = 0;
        for (let y = 0; y < DH; y++) {
          const py0 = y * SY, rev = y & 1;
          for (let k = 0; k < DW; k++) { const x = rev ? DW - 1 - k : k, px = (x + r()) * SX, py = py0 + r() * SY, w = d[y * DW + x]; hint = del.find(px, py, hint); sw[hint] += w; sx[hint] += w * px; sy[hint] += w * py; }
        }
        const f = L.p.relax;
        for (let i = 0; i < N; i++) if (sw[i] > 0) { pts[2 * i] += (sx[i] / sw[i] - pts[2 * i]) * f; pts[2 * i + 1] += (sy[i] / sw[i] - pts[2 * i + 1]) * f; } else { pts[2 * i] += (r() - 0.5) * 3; pts[2 * i + 1] += (r() - 0.5) * 3; }
        del.update(); iter++;
      };
      const NB = 14, bk = new Uint8Array(N), ramp14 = ramp(['#3b2f86', C.violet, C.coral, C.amber, C.cream]), bc = [...Array(NB)].map((_, k) => ramp14(k / (NB - 1))), br = [...Array(NB)].map((_, k) => 0.6 + 1.1 * k / (NB - 1));
      return (t, dt) => {
        const ph = t % HALF, cur = Math.floor(t / HALF) % 2, D = pics[cur].d, A = pics[1 - cur].d, mix = t < HALF ? 1 : ease.inOut(seg(ph, 0.2, FLY + STAG));
        if (cur !== last) { last = cur; retarget(D); iter = 0; settled = false; }
        const flying = ph < FLY + STAG + 0.05;
        if (flying) for (let i = 0; i < N; i++) { const e = ease.inOut(seg(ph, dl[i], dl[i] + FLY)), dx = tx[i] - fx[i], dy = ty[i] - fy[i], b = Math.sin(Math.PI * e) * bow[i]; pts[2 * i] = fx[i] + dx * e - dy * b; pts[2 * i + 1] = fy[i] + dy * e + dx * b; }
        else if (!settled) { del.update(); settled = true; acc = 0; }
        if (settled && ph < 5.2) { acc += dt; if (acc >= 1 / 40) { relax(D); acc = Math.min(acc - 1 / 40, 1 / 40); } }
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const web = settled ? 0.22 * (1 - seg(ph, 3, 4.6)) * seg(ph, FLY + STAG, FLY + STAG + 0.3) : 0;
        if (web > 0) { g.beginPath(); del.voronoi([0, 0, W, H]).render(g); g.strokeStyle = `rgba(122,92,255,${web})`; g.lineWidth = 0.6; g.stroke(); }
        for (let i = 0; i < N; i++) { const x = pts[2 * i], y = pts[2 * i + 1], j = Math.min(DH - 1, Math.max(0, (y / SY) | 0)) * DW + Math.min(DW - 1, Math.max(0, (x / SX) | 0)); bk[i] = Math.min(NB - 1, (Math.sqrt(lerp(A[j], D[j], mix)) * NB) | 0); }
        for (let b = 0; b < NB; b++) {
          g.beginPath(); const rr = br[b];
          for (let i = 0; i < N; i++) if (bk[i] === b) { const x = pts[2 * i], y = pts[2 * i + 1]; g.moveTo(x + rr, y); g.arc(x, y, rr, 0, 6.2832); }
          g.fillStyle = bc[b]; g.fill();
        }
        g.globalAlpha = 0.9; g.drawImage(pics[cur].cn, W - 112, 12, 96, 54); g.globalAlpha = 1; g.strokeStyle = 'rgba(244,239,230,0.35)'; g.lineWidth = 1; g.strokeRect(W - 112.5, 11.5, 97, 55);
        g.font = '600 9px Cascadia Mono, Consolas'; g.letterSpacing = '2px'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.textAlign = 'right'; g.fillText('TARGET', W - 16, 80); g.textAlign = 'left'; g.letterSpacing = '0px';
        if (flying) hud(g, 'SAMPLE AND FLY', `${N} dots, paired in Hilbert order`, 1);
        else hud(g, 'WEIGHTED LLOYD RELAXATION', `iteration ${iter}${ph >= 5.2 ? '   settled' : ''}`, 1);
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-pathrace', title: 'Pathfinding race', aka: 'A* vs Dijkstra vs greedy best-first, graph search, open and closed sets, heuristic search', tool: 'Canvas 2D (priority-queue graph search)', runs: 'CPU',
    notice: 'Three searches get the same map and expand one square per tick. Dijkstra spreads evenly by cost so far, A* adds a straight-line guess to the goal and stretches toward it, greedy best-first follows only the guess. Bright squares are the open set waiting in the queue, dim ones are done. Greedy usually wins the race but finds a longer road; A* finds the shortest one while exploring far less than Dijkstra.',
    use: 'explaining AI and game pathfinding, "smart vs brute force" stories, technical talks',
    params: [{ key: 'rate', label: 'Squares per second', min: 30, max: 600, step: 10, value: 170, unit: ' squares' }, { key: 'walls', label: 'Obstacles', min: 0, max: 40, step: 1, value: 15, unit: '%', restart: true }],
    prompt: 'Pathfinding race in three side-by-side panels on the same 28 x 38 grid with {walls} obstacles: Dijkstra (cyan), A* (coral) and greedy best-first (amber), 8-way moves, each expands {rate} per second. Open set as bright squares, closed set dimmer and shaded by distance, small gaps between squares, muted slate walls with three long barriers that force a zigzag. When a search reaches the goal its path draws on in cream and a 1st, 2nd or 3rd badge pops in with overshoot; counters under each panel show squares explored and path length. Hold, fade, new map.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const CS = 7, GC = 28, GR = 38, NN = GC * GR, PX = [12, 222, 432], PY = 50, PW = GC * CS, PH = GR * CS;
      const ALG = [{ name: 'DIJKSTRA', sub: 'priority = g', col: C.cyan }, { name: 'A* SEARCH', sub: 'priority = g + h', col: C.coral }, { name: 'GREEDY BEST-FIRST', sub: 'priority = h', col: C.amber }];
      const PANEL = '#14131f', pr = hexRGB(PANEL);
      const shade = (hex, k) => { const a = hexRGB(hex); return `rgb(${lerp(pr[0], a[0], k) | 0},${lerp(pr[1], a[1], k) | 0},${lerp(pr[2], a[2], k) | 0})`; };
      ALG.forEach(a => { a.open = a.col; a.closed = [...Array(8)].map((_, k) => shade(a.col, 0.62 - k * 0.06)); a.cv = document.createElement('canvas'); a.cv.width = PW; a.cv.height = PH; a.g = a.cv.getContext('2d'); });
      const wall = new Uint8Array(NN), S = (GR - 3) * GC + 2, G = 2 * GC + GC - 3;
      const hp = new Int32Array(NN * 9), hk = new Float64Array(NN * 9); let hn = 0;
      const push = (i, k) => { let j = hn++; while (j > 0) { const p = (j - 1) >> 1; if (hk[p] <= k) break; hp[j] = hp[p]; hk[j] = hk[p]; j = p; } hp[j] = i; hk[j] = k; };
      const popMin = () => { const top = hp[0], li = hp[--hn], lk = hk[hn]; let j = 0; for (;;) { let c = 2 * j + 1; if (c >= hn) break; if (c + 1 < hn && hk[c + 1] < hk[c]) c++; if (hk[c] >= lk) break; hp[j] = hp[c]; hk[j] = hk[c]; j = c; } hp[j] = li; hk[j] = lk; return top; };
      const hOf = i => { const dx = Math.abs(i % GC - G % GC), dy = Math.abs(((i / GC) | 0) - ((G / GC) | 0)); return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy); };
      // Runs one search to the goal and records when each square was discovered and expanded.
      function search(mode) {
        const gc = new Float64Array(NN).fill(1e9), par = new Int32Array(NN).fill(-1), done = new Uint8Array(NN), disc = [], dStep = [], exp = [];
        hn = 0; gc[S] = 0; push(S, 0); disc.push(S); dStep.push(0);
        while (hn) {
          const c = popMin(); if (done[c]) continue; done[c] = 1; exp.push(c); if (c === G) break;
          const cx = c % GC, cy = (c / GC) | 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue; const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= GC || y >= GR) continue;
            const n = y * GC + x; if (wall[n] || done[n]) continue; if (dx && dy && (wall[cy * GC + x] || wall[y * GC + cx])) continue;
            const ng = gc[c] + (dx && dy ? Math.SQRT2 : 1); if (ng >= gc[n]) continue;
            if (gc[n] > 1e8) { disc.push(n); dStep.push(exp.length); }
            gc[n] = ng; par[n] = c; const h = hOf(n); push(n, mode === 0 ? ng : mode === 1 ? ng + h * 1.0001 : h);
          }
        }
        const path = []; if (done[G]) for (let c = G; c >= 0; c = par[c]) path.push(c);
        return { disc, dStep, exp, gc, path: path.reverse(), cost: gc[G], pd: 0, pe: 0, fin: -1 };
      }
      let res = [], st = 'intro', clock = 0, stepF = 0, seed = 1, maxG = 1;
      function newMap() {
        for (let tries = 0; tries < 30; tries++) {
          const r = rng(seed++ * 7919), ox = r() * 50, oy = r() * 50, thr = 0.8 - L.p.walls / 100 * 0.8, on = L.p.walls >= 5;
          for (let i = 0; i < NN; i++) { const x = i % GC, y = (i / GC) | 0; wall[i] = EX.noise(x * 0.23 + ox, y * 0.23 + oy) > thr ? 1 : 0; }
          if (on) [[29, 1], [19, 0], [9, 1]].forEach(([wy, right]) => {
            const gap = right ? 17 + ((r() * 7) | 0) : 1 + ((r() * 6) | 0), hook = right ? 4 + ((r() * 8) | 0) : 14 + ((r() * 8) | 0);
            for (let x = 0; x < GC; x++) if (x < gap || x > gap + 2) wall[wy * GC + x] = 1;
            for (let y = wy + 1; y < wy + 5; y++) wall[y * GC + hook] = 1;
          });
          for (const c of [S, G]) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = c % GC + dx, y = ((c / GC) | 0) + dy; if (x >= 0 && y >= 0 && x < GC && y < GR) wall[y * GC + x] = 0; }
          res = [0, 1, 2].map(search); if (res[0].path.length) break;
        }
        maxG = 1; for (const c of res[0].exp) maxG = Math.max(maxG, res[0].gc[c]);
        ALG.forEach(a => { a.g.fillStyle = PANEL; a.g.fillRect(0, 0, PW, PH); a.g.fillStyle = '#4d4a6b'; for (let i = 0; i < NN; i++) if (wall[i]) a.g.fillRect((i % GC) * CS, ((i / GC) | 0) * CS, CS, CS); a.g.fillStyle = '#1b1a29'; for (let i = 0; i < NN; i++) if (!wall[i]) a.g.fillRect((i % GC) * CS + 3, ((i / GC) | 0) * CS + 3, 1, 1); });
        stepF = 0; clock = 0; st = 'intro';
      }
      newMap();
      const cell = (a, i, col) => { a.g.fillStyle = col; a.g.fillRect((i % GC) * CS + 0.5, ((i / GC) | 0) * CS + 0.5, CS - 1, CS - 1); };
      const ctr = (k, i) => [PX[k] + (i % GC) * CS + CS / 2, PY + ((i / GC) | 0) * CS + CS / 2];
      return (t, dt) => {
        clock += dt;
        if (st === 'intro' && clock > 0.9) { st = 'search'; clock = 0; }
        if (st === 'search') { stepF += L.p.rate * dt; if (res.every(q => q.fin >= 0) && clock > Math.max(...res.map(q => q.fin)) + 0.8) { st = 'hold'; clock = 0; } }
        if (st === 'hold' && clock > 2.6) { st = 'fade'; clock = 0; }
        if (st === 'fade' && clock > 0.7) newMap();
        res.forEach((q, k) => {
          const a = ALG[k], n = Math.min(q.exp.length, Math.floor(stepF));
          while (q.pd < q.disc.length && q.dStep[q.pd] <= n) cell(a, q.disc[q.pd++], a.open);
          while (q.pe < n) { const c = q.exp[q.pe++]; if (c !== S && c !== G) cell(a, c, a.closed[Math.min(7, (q.gc[c] / maxG * 8) | 0)]); }
          if (q.fin < 0 && n >= q.exp.length && st === 'search') q.fin = clock;
        });
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const fadeIn = st === 'intro' ? ease.out(seg(clock, 0, 0.6)) : 1;
        const ranks = res.map(q => res.filter(o => o.exp.length < q.exp.length).length + 1);
        res.forEach((q, k) => {
          const a = ALG[k], x0 = PX[k];
          g.globalAlpha = fadeIn; g.drawImage(a.cv, x0, PY + (1 - fadeIn) * 12);
          g.font = '600 13px Bahnschrift, Segoe UI'; g.letterSpacing = '2px'; g.fillStyle = a.col; g.fillText(a.name, x0, 24);
          g.font = '500 10px Cascadia Mono, Consolas'; g.letterSpacing = '0px'; g.fillStyle = 'rgba(244,239,230,0.5)'; g.fillText(a.sub, x0, 40);
          const n = Math.min(q.exp.length, Math.floor(stepF)), done = q.fin >= 0;
          g.font = '500 11px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.75)'; g.fillText(`explored ${n}`, x0, PY + PH + 18);
          g.textAlign = 'right'; g.fillStyle = done ? C.cream : 'rgba(244,239,230,0.35)'; g.fillText(done ? `path ${q.cost.toFixed(1)}` : 'path ...', x0 + PW, PY + PH + 18); g.textAlign = 'left';
          g.globalAlpha = 1;
          if (done && q.path.length) {
            const pp = st === 'search' ? ease.inOut(seg(clock, q.fin, q.fin + 0.7)) : 1, len = (q.path.length - 1) * pp, m = Math.floor(len);
            g.lineCap = 'round'; g.lineJoin = 'round';
            for (const [w, col] of /** @type {[number, string][]} */ ([[5, PANEL], [2.4, C.cream]])) {
              g.beginPath(); let [px, py] = ctr(k, q.path[0]); g.moveTo(px, py);
              for (let j = 1; j <= m; j++) { [px, py] = ctr(k, q.path[j]); g.lineTo(px, py); }
              if (m < q.path.length - 1) { const [ax, ay] = ctr(k, q.path[m]), [bx, by] = ctr(k, q.path[m + 1]); g.lineTo(lerp(ax, bx, len - m), lerp(ay, by, len - m)); }
              g.strokeStyle = col; g.lineWidth = w; g.stroke();
            }
            const bt = st === 'search' ? seg(clock, q.fin, q.fin + 0.45) : 1, s = ease.back(bt);
            if (bt > 0) { const bx = x0 + PW - 22, by = 30; g.save(); g.translate(bx, by); g.scale(s, s); g.fillStyle = a.col; g.beginPath(); g.roundRect(-20, -10, 40, 20, 10); g.fill(); g.fillStyle = C.bg; g.font = '700 11px Bahnschrift, Segoe UI'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['1ST', '2ND', '3RD'][ranks[k] - 1], 0, 1); g.restore(); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; }
          }
          for (const [c, col] of /** @type {[number, string][]} */ ([[S, C.cream], [G, a.col]])) { const [cx, cy] = ctr(k, c); g.fillStyle = col; g.beginPath(); g.arc(cx, cy, 4.5, 0, 7); g.fill(); g.strokeStyle = C.bg; g.lineWidth = 1.5; g.stroke(); }
        });
        if (st === 'fade') { g.fillStyle = `rgba(11,11,16,${ease.inOut(seg(clock, 0, 0.7))})`; g.fillRect(0, 0, W, H); }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-tsp', title: 'Traveling salesman, annealed', aka: 'TSP, simulated annealing, 2-opt, tour optimization, combinatorial search', tool: 'Canvas 2D (simulated annealing with 2-opt moves)', runs: 'CPU',
    notice: 'A random tour through 300 cities starts as a tangled star. Each move flips a stretch of the tour (2-opt). Shorter tours are always kept; longer ones are kept only by chance, and that chance shrinks as the temperature cools. Early on the loop churns, then it settles into one clean loop whose colors run smoothly around it.',
    use: 'optimization and logistics stories, "chaos to order" transitions, data-art loops',
    params: [{ key: 'n', label: 'Cities', min: 40, max: 600, step: 10, value: 300, restart: true }, { key: 'cool', label: 'Cooling time', min: 2, max: 14, step: 0.5, value: 7, unit: ' s', restart: true }],
    prompt: 'Traveling salesman solved live by simulated annealing with 2-opt moves: {n} evenly spaced cities in an elliptical ring pop in with overshoot, a random tour draws on as a tangled star, then the temperature cools exponentially over {cool} while thousands of moves per frame untangle it into one clean loop. The tour line has a soft glow and a coral, amber, cyan, violet gradient along its order, so it looks chaotic while tangled and smooth when solved. HUD with temperature, tour length and acceptance rate, a log-scale sparkline of the length, then a bright comet runs around the final loop before the next set of cities.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const N = L.p.n, COOL = L.p.cool, TA = 1.6, TB = TA + COOL, T = TB + 4.4, NB = 16;
      const X = new Float32Array(N), Y = new Float32Array(N), dm = new Float32Array(N * N), tour = new Int32Array(N), spark = new Float32Array(200);
      const grad = ramp([C.coral, C.amber, C.cyan, C.violet, C.coral]), bcol = [...Array(NB)].map((_, k) => grad(k / NB));
      let len = 0, len0 = 1, acc = 0, tries = 0, ns = 0, cyc = -1, r = rng(1), lastS = -1;
      const D = (a, b) => dm[a * N + b];
      // Places new cities evenly in an elliptical ring (best-candidate sampling) and starts from a random tour.
      function reset(seed) {
        r = rng(seed);
        for (let i = 0; i < N; i++) { let bd = -1; for (let k = 0; k < 12; k++) { const a = r() * 6.2832, rr = Math.sqrt(lerp(0.16, 1, r())), x = W / 2 + Math.cos(a) * rr * 272, y = 150 + Math.sin(a) * rr * 122; let md = 1e9; for (let j = 0; j < i; j++) md = Math.min(md, (x - X[j]) ** 2 + (y - Y[j]) ** 2); if (md > bd) { bd = md; X[i] = x; Y[i] = y; } } }
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) dm[i * N + j] = Math.hypot(X[i] - X[j], Y[i] - Y[j]);
        for (let i = 0; i < N; i++) tour[i] = i; for (let i = N - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0, q = tour[i]; tour[i] = tour[j]; tour[j] = q; }
        len = 0; for (let i = 0; i < N; i++) len += D(tour[i], tour[(i + 1) % N]); len0 = len; ns = 0; lastS = -1; acc = 0; tries = 0;
      }
      // Tries k random 2-opt moves at temperature temp (0 means only improvements).
      const anneal = (k, temp) => {
        for (let m = 0; m < k; m++) {
          let i = (r() * N) | 0, j = (r() * N) | 0; if (i === j) continue; if (i > j) { const q = i; i = j; j = q; } if (i === 0 && j === N - 1) continue;
          const a = tour[(i + N - 1) % N], b = tour[i], c = tour[j], d = tour[(j + 1) % N], delta = D(a, c) + D(b, d) - D(a, b) - D(c, d);
          tries++;
          if (delta < 0 || (temp > 0 && r() < Math.exp(-delta / temp))) { for (let p = i, q = j; p < q; p++, q--) { const s = tour[p]; tour[p] = tour[q]; tour[q] = s; } len += delta; acc++; }
        }
      };
      const edges = (u0, u1) => { for (let b = 0; b < NB; b++) { g.beginPath(); const k0 = Math.floor(b * N / NB), k1 = Math.floor((b + 1) * N / NB); for (let k = Math.max(k0, u0); k < Math.min(k1, u1); k++) { const p = tour[k], q = tour[(k + 1) % N]; g.moveTo(X[p], Y[p]); g.lineTo(X[q], Y[q]); } g.strokeStyle = bcol[b]; g.stroke(); } };
      return t => {
        const c = Math.floor(t / T), lt = t - c * T;
        if (c !== cyc) { cyc = c; reset(9001 + c * 131); }
        const p = seg(lt, TA, TB), temp = lt < TA ? 0 : p < 1 ? 45 * Math.pow(0.1 / 45, p) : 0;
        acc = 0; tries = 0;
        if (lt >= TA && lt < TB + 1.2) anneal(p < 1 ? 2500 : 4000, temp);
        const si = Math.floor(lt / (T / 200)); if (si !== lastS && si < 200) { spark[si] = len; ns = si + 1; lastS = si; }
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const draw = lt < TA ? Math.floor(N * ease.inOut(seg(lt, 0.7, 1.5))) : N;
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.globalAlpha = 0.16; g.lineWidth = 6; edges(0, draw); g.globalAlpha = 1; g.lineWidth = 1.5; edges(0, draw);
        if (lt > TB + 0.6) {
          const head = ((lt - TB - 0.6) * N * 0.45) % N;
          g.lineWidth = 3; g.strokeStyle = 'rgba(255,250,240,0.9)'; g.beginPath();
          for (let k = Math.floor(head) - 14; k < head; k++) { const p0 = tour[(k + N) % N], p1 = tour[(k + 1 + N) % N]; g.moveTo(X[p0], Y[p0]); g.lineTo(X[p1], Y[p1]); }
          g.stroke(); const hp = tour[Math.floor(head) % N]; g.fillStyle = '#fff'; g.beginPath(); g.arc(X[hp], Y[hp], 3.5, 0, 7); g.fill();
        }
        g.fillStyle = C.cream; g.beginPath();
        for (let i = 0; i < N; i++) { const s = ease.back(seg(lt, X[i] / W * 0.5, X[i] / W * 0.5 + 0.35)) * 2; if (s <= 0) continue; g.moveTo(X[i] + s, Y[i]); g.arc(X[i], Y[i], s, 0, 6.2832); }
        g.fill();
        const sx = W - 196, sy = H - 74, sw = 180, sh = 30; let mx = 0, mn = 1e9; for (let i = 0; i < ns; i++) { mx = Math.max(mx, Math.log(spark[i])); mn = Math.min(mn, Math.log(spark[i])); }
        g.font = '600 9px Cascadia Mono, Consolas'; g.letterSpacing = '2px'; g.fillStyle = 'rgba(244,239,230,0.45)'; g.fillText('LENGTH, LOG SCALE', sx, sy - 6); g.letterSpacing = '0px';
        g.strokeStyle = 'rgba(244,239,230,0.15)'; g.lineWidth = 1; g.beginPath(); g.moveTo(sx, sy + sh + 0.5); g.lineTo(sx + sw, sy + sh + 0.5); g.stroke();
        if (ns > 1) { g.strokeStyle = C.amber; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < ns; i++) { const x = sx + i / 199 * sw, y = sy + sh - (Math.log(spark[i]) - mn) / Math.max(1e-3, mx - mn) * sh; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
        const pct = tries ? Math.round(acc / tries * 100) : 0;
        if (lt < TB) hud(g, lt < TA ? 'RANDOM TOUR' : 'SIMULATED ANNEALING', `T ${temp.toFixed(2).padStart(5)}   length ${Math.round(len)}   accepted ${String(pct).padStart(2)}%`, 1);
        else hud(g, '2-OPT POLISH', `length ${Math.round(len)}   ${Math.round((1 - len / len0) * 100)}% shorter than the start`, 1);
        const fo = ease.inOut(seg(lt, T - 0.7, T)); if (fo > 0) { g.fillStyle = `rgba(11,11,16,${fo})`; g.fillRect(0, 0, W, H); }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-turmite', title: "Langton's ant time-lapse", aka: 'turmites, multi-color Langton ant, emergent behavior, 2D Turing machine', tool: 'Canvas 2D (ImageData grid, rule string)', runs: 'CPU',
    notice: 'An ant on a grid reads the color under it, turns left or right as its rule string says, repaints the square with the next color and steps forward. The camera starts close enough to follow single steps, then speeds up and pulls back. The classic two-color ant wanders in chaos for about 10,000 steps before it suddenly builds a straight highway; longer rules grow symmetric blooms, a filled square or a sliding triangle.',
    use: 'emergence and complexity stories, generative textures, "simple rules, rich results" intros',
    controls: [{ label: 'All rules', on: true, fn: L => { L.rule = -1; L.t = 0; } }, { label: 'RL', fn: L => { L.rule = 0; L.t = 0; } }, { label: 'LLRR', fn: L => { L.rule = 1; L.t = 0; } }, { label: 'LRRRRRLLR', fn: L => { L.rule = 2; L.t = 0; } }, { label: 'RRLLLRLLLRRR', fn: L => { L.rule = 3; L.t = 0; } }],
    prompt: "Langton's ant time-lapse gallery, 7 to 9 s per rule on near-black: a turmite on a 512 x 512 grid follows a rule string (RL, LLRR, LRRRRRLLR, RRLLLRLLLRRR: on color i turn as letter i says, paint color i+1, step). Start zoomed in at 28 px per cell with faint grid lines and a glowing ant, step slowly, then double the speed every 0.3 s up to thousands of steps per second while the camera eases out to fit the pattern. Colors per state from coral, amber, cream, cyan, violet; the rule shown as colored letter tiles and a step counter in a mono HUD.",
    setup(cv, L) {
      const g = cv.getContext('2d'); const GN = 512, R0 = 3, DBL = 0.3;
      const RULES = [{ s: 'RL', seg: 9, cap: 3000, cols: [C.amber] }, { s: 'LLRR', seg: 7, cap: 20000, cols: [C.coral, C.amber, C.cyan] }, { s: 'LRRRRRLLR', seg: 7, cap: 30000, cols: [C.violet, '#24214a', C.cyan, C.green, C.cream, C.amber, '#ff8a3d', C.coral] }, { s: 'RRLLLRLLLRRR', seg: 7, cap: 25000, cols: [C.navy, '#2c2a6a', C.violet, '#a35cff', C.coral, '#ff7a45', C.amber, '#ffd166', C.cream, C.cyan, '#1f8fb0'] }];
      const off = document.createElement('canvas'); off.width = off.height = GN; const og = off.getContext('2d'); const img = og.createImageData(GN, GN), px = img.data, px32 = new Uint32Array(px.buffer);
      const grid = new Uint8Array(GN * GN);
      const abgr = hex => { const [r, gg, b] = hexRGB(hex); return (255 << 24 | b << 16 | gg << 8 | r) >>> 0; };
      let rule = null, turn = [], pal = new Uint32Array(16), ax = 0, ay = 0, dir = 0, steps = 0, x0 = 0, x1 = 0, y0 = 0, y1 = 0, cur = -2, lastT = 0, cs = 28, cx = 0, cy = 0;
      const TOTAL = RULES.reduce((a, q) => a + q.seg, 0);
      // Steps done after tau seconds: the rate doubles every DBL seconds from R0 per second until it reaches cap.
      const stepsAt = (tau, cap) => { if (tau <= 0) return 0; const tc = DBL * Math.log2(cap / R0), k = DBL / Math.LN2; return Math.floor(tau <= tc ? R0 * k * (2 ** (tau / DBL) - 1) : R0 * k * (cap / R0 - 1) + cap * (tau - tc)); };
      // Starts a rule from an empty grid with the ant in the middle facing up.
      function start(k) {
        rule = RULES[k]; turn = [...rule.s].map(ch => ch === 'R' ? 1 : 3); pal[0] = abgr('#0e0d18'); rule.cols.forEach((c, i) => { pal[i + 1] = abgr(c); });
        grid.fill(0); px32.fill(pal[0]); og.putImageData(img, 0, 0);
        ax = ay = GN / 2; dir = 0; steps = 0; x0 = x1 = ax; y0 = y1 = ay; cs = 28; cx = ax + 0.5; cy = ay + 0.5;
      }
      return (t, dt) => {
        const sel = L.rule === undefined ? -1 : L.rule; let id, k, lt;
        if (sel >= 0) { k = sel; id = Math.floor(t / RULES[k].seg); lt = t - id * RULES[k].seg; } else { const c = Math.floor(t / TOTAL); lt = t - c * TOTAL; k = 0; while (lt >= RULES[k].seg) lt -= RULES[k++].seg; id = c * 4 + k; }
        if (id !== cur || t < lastT) { cur = id; start(k); } lastT = t;
        const n = rule.s.length, SEG = rule.seg, target = stepsAt(Math.min(lt, SEG - 0.6) - 0.5, rule.cap);
        let dx0 = GN, dx1 = 0, dy0 = GN, dy1 = 0;
        while (steps < target) {
          const i = ay * GN + ax, s = grid[i]; dir = (dir + turn[s]) & 3; const ns = s + 1 === n ? 0 : s + 1; grid[i] = ns; px32[i] = pal[ns];
          if (ax < dx0) dx0 = ax; if (ax > dx1) dx1 = ax; if (ay < dy0) dy0 = ay; if (ay > dy1) dy1 = ay;
          ax = (ax + (dir === 1 ? 1 : dir === 3 ? -1 : 0) + GN) % GN; ay = (ay + (dir === 2 ? 1 : dir === 0 ? -1 : 0) + GN) % GN; steps++;
          if (ax < x0) x0 = ax; if (ax > x1) x1 = ax; if (ay < y0) y0 = ay; if (ay > y1) y1 = ay;
        }
        if (dx1 >= dx0) og.putImageData(img, 0, 0, dx0, dy0, dx1 - dx0 + 1, dy1 - dy0 + 1);
        // camera: ease toward a zoom that fits the visited area, capped for the close-up start
        const fit = Math.min(28, W / (x1 - x0 + 20), (H - 64) / (y1 - y0 + 20)), kz = 1 - Math.exp(-dt * 4);
        cs = Math.exp(lerp(Math.log(cs), Math.log(fit), kz)); cx = lerp(cx, (x0 + x1 + 1) / 2, kz); cy = lerp(cy, (y0 + y1 + 1) / 2, kz);
        const vx = cx - W / 2 / cs, vy = cy - (H - 44) / 2 / cs;
        g.fillStyle = '#0e0d18'; g.fillRect(0, 0, W, H); g.imageSmoothingEnabled = false;
        g.drawImage(off, vx, vy, W / cs, H / cs, 0, 0, W, H); g.imageSmoothingEnabled = true;
        const ga = 0.22 * seg(cs, 5, 14);
        if (ga > 0) { g.strokeStyle = `rgba(244,239,230,${ga})`; g.lineWidth = 1; g.beginPath(); for (let gx = Math.ceil(vx); gx < vx + W / cs; gx++) { const sx = Math.round((gx - vx) * cs) + 0.5; g.moveTo(sx, 0); g.lineTo(sx, H); } for (let gy = Math.ceil(vy); gy < vy + H / cs; gy++) { const sy = Math.round((gy - vy) * cs) + 0.5; g.moveTo(0, sy); g.lineTo(W, sy); } g.stroke(); }
        const hx = (ax + 0.5 - vx) * cs, hy = (ay + 0.5 - vy) * cs, rr = Math.max(7, cs * 1.4), gr = g.createRadialGradient(hx, hy, 0, hx, hy, rr);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.3, 'rgba(255,90,54,0.6)'); gr.addColorStop(1, 'rgba(255,90,54,0)'); g.fillStyle = gr; g.fillRect(hx - rr, hy - rr, rr * 2, rr * 2);
        if (cs > 8) { g.save(); g.translate(hx, hy); g.rotate(dir * Math.PI / 2); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -cs * 0.32); g.lineTo(cs * 0.24, cs * 0.22); g.lineTo(-cs * 0.24, cs * 0.22); g.closePath(); g.fill(); g.restore(); }
        const band = g.createLinearGradient(0, H - 70, 0, H); band.addColorStop(0, 'rgba(11,11,16,0)'); band.addColorStop(1, 'rgba(11,11,16,0.9)'); g.fillStyle = band; g.fillRect(0, H - 70, W, 70);
        g.font = '600 10px Cascadia Mono, Consolas'; g.letterSpacing = '2px'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillText('RULE', 16, H - 15); g.letterSpacing = '0px';
        const tw = Math.min(22, 330 / n);
        for (let i = 0; i < n; i++) { const x = 64 + i * (tw + 3), cc = i === 0 ? '#0e0d18' : rule.cols[i - 1]; g.fillStyle = cc; g.beginPath(); g.roundRect(x, H - 32, tw, 24, 4); g.fill(); g.strokeStyle = 'rgba(244,239,230,0.35)'; g.lineWidth = 1; g.stroke(); const [r0, g0, b0] = hexRGB(cc); g.fillStyle = r0 * 0.3 + g0 * 0.59 + b0 * 0.11 > 140 ? '#14121f' : C.cream; g.font = '700 13px Bahnschrift, Segoe UI'; g.textAlign = 'center'; g.fillText(rule.s[i], x + tw / 2, H - 15); g.textAlign = 'left'; }
        g.font = '600 11px Cascadia Mono, Consolas'; g.letterSpacing = '2px'; g.textAlign = 'right'; g.fillStyle = C.cream; g.fillText(`STEP ${steps.toLocaleString('en-US')}`, W - 16, H - 15); g.textAlign = 'left'; g.letterSpacing = '0px';
        const fo = Math.max(1 - seg(lt, 0, 0.35), seg(lt, SEG - 0.35, SEG)); if (fo > 0) { g.fillStyle = `rgba(11,11,16,${fo})`; g.fillRect(0, 0, W, H); }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-epicycles', title: 'Fourier epicycles', aka: 'discrete Fourier transform drawing, rotating circles, Fourier series of a path', tool: 'Canvas 2D (contour tracing + discrete Fourier transform)', runs: 'CPU',
    notice: 'A glyph is drawn into a hidden canvas, its outline is traced into 400 points, and a Fourier transform turns that loop into circles of fixed size, each spinning at a whole-number speed. Chained tip to tail, the circles trace the outline in one turn. Then circles are removed one by one, smallest first, and the drawing melts back into a single circle.',
    use: 'math and signal-processing explainers, logo draw-ons, hypnotic loops',
    params: [{ key: 'terms', label: 'Circles', min: 2, max: 300, step: 1, value: 160 }],
    prompt: 'Fourier epicycles drawing glyphs, a 9 s loop per glyph on near-black: trace the outer outline of a Georgia italic bold ampersand, section sign and question mark from an offscreen canvas (Moore neighbor tracing, resampled to 400 points), take the discrete Fourier transform and draw {terms} rotating circles chained tip to tail, largest first, thin cream circles and arms, a glowing coral pen tip, the traced line in a coral to amber to cyan gradient. After one full turn, remove circles smallest first so the drawing simplifies back into one circle, then the next glyph grows from it. Mono HUD with the circle count.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const NP = 400, T = 9, CS = 300, SAMP = 360;
      // Traces the outer outline of the largest blob of a glyph and returns NP evenly spaced points centered on their bounding box.
      const outline = (ch, font) => {
        const c = document.createElement('canvas'); c.width = c.height = CS; const x = c.getContext('2d');
        x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(ch, CS / 2, CS / 2 + 10);
        const a = x.getImageData(0, 0, CS, CS).data, on = new Uint8Array(CS * CS), lab = new Int32Array(CS * CS);
        for (let i = 0; i < CS * CS; i++) on[i] = a[i * 4 + 3] > 120 ? 1 : 0;
        let best = -1, bestN = 0, nl = 0; const st = new Int32Array(CS * CS);
        for (let i = 0; i < CS * CS; i++) if (on[i] && !lab[i]) { nl++; let n = 0, sp = 0; st[sp++] = i; lab[i] = nl; while (sp) { const p = st[--sp]; n++; const px = p % CS, py = (p / CS) | 0; for (const q of [px > 0 ? p - 1 : -1, px < CS - 1 ? p + 1 : -1, py > 0 ? p - CS : -1, py < CS - 1 ? p + CS : -1]) if (q >= 0 && on[q] && !lab[q]) { lab[q] = nl; st[sp++] = q; } } if (n > bestN) { bestN = n; best = nl; } }
        const fg = (px, py) => px >= 0 && py >= 0 && px < CS && py < CS && lab[py * CS + px] === best;
        let s0 = 0; while (lab[s0] !== best) s0++;
        const DX = [-1, -1, 0, 1, 1, 1, 0, -1], DY = [0, -1, -1, -1, 0, 1, 1, 1], sx = s0 % CS, sy = (s0 / CS) | 0, raw = [[sx, sy]];
        let cx = sx, cy = sy, b = 0;
        for (let guard = 0; guard < 40000; guard++) {
          let moved = false;
          for (let k = 1; k <= 8; k++) { const d = (b + k) & 7, nx = cx + DX[d], ny = cy + DY[d]; if (!fg(nx, ny)) continue; const pd = (b + k - 1) & 7, bx = cx + DX[pd], by = cy + DY[pd]; cx = nx; cy = ny; for (let e = 0; e < 8; e++) if (cx + DX[e] === bx && cy + DY[e] === by) b = e; moved = true; break; }
          if (!moved || (cx === sx && cy === sy)) break; raw.push([cx, cy]);
        }
        const sm = raw.map((_, i) => { let ax = 0, ay = 0; for (let k = -3; k <= 3; k++) { const q = raw[(i + k + raw.length) % raw.length]; ax += q[0]; ay += q[1]; } return [ax / 7, ay / 7]; });
        const cum = [0]; for (let i = 1; i <= sm.length; i++) { const p = sm[i - 1], q = sm[i % sm.length]; cum.push(cum[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1])); }
        const tot = cum[sm.length], out = []; let j = 0;
        for (let i = 0; i < NP; i++) { const d = i / NP * tot; while (cum[j + 1] < d) j++; const f = (d - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), p = sm[j], q = sm[(j + 1) % sm.length]; out.push([lerp(p[0], q[0], f), lerp(p[1], q[1], f)]); }
        const mx = (Math.min(...out.map(p => p[0])) + Math.max(...out.map(p => p[0]))) / 2, my = (Math.min(...out.map(p => p[1])) + Math.max(...out.map(p => p[1]))) / 2;
        return out.map(p => [p[0] - mx, p[1] - my]);
      };
      // Discrete Fourier transform of the closed path, sorted by circle size.
      const dft = pts => { const cs = []; for (let k = -NP / 2; k < NP / 2; k++) { let re = 0, im = 0; for (let n = 0; n < NP; n++) { const a = -2 * Math.PI * k * n / NP; re += pts[n][0] * Math.cos(a) - pts[n][1] * Math.sin(a); im += pts[n][0] * Math.sin(a) + pts[n][1] * Math.cos(a); } cs.push({ k, re: re / NP, im: im / NP, r: Math.hypot(re, im) / NP }); } const c0 = cs.find(c => c.k === 0); return [c0, ...cs.filter(c => c.k !== 0).sort((a, b) => b.r - a.r)]; };
      const SH = [['&', 'italic 700 280px Georgia'], ['§', 'italic 700 270px Georgia'], ['?', 'italic 700 280px Georgia']].map(([ch, f]) => dft(outline(ch, f)));
      const ox = W / 2, oy = H / 2 - 12, grad = ramp([C.coral, C.amber, C.cyan, C.coral]), NB = 24, bcol = [...Array(NB)].map((_, k) => grad(k / NB));
      const crv = new Float64Array((SAMP + 1) * 2);
      // Fills crv with the curve drawn by the first K circles, from angle 0 to th (each circle advances by a fixed rotation per sample).
      const curve = (cs, K, th) => {
        crv.fill(0); const d = th / SAMP;
        for (let i = 0; i < K; i++) { const c = cs[i], wr = Math.cos(c.k * d), wi = Math.sin(c.k * d); let zr = c.re, zi = c.im; for (let s = 0; s <= SAMP; s++) { crv[2 * s] += zr; crv[2 * s + 1] += zi; const nr = zr * wr - zi * wi; zi = zr * wi + zi * wr; zr = nr; } }
        for (let s = 0; s <= SAMP; s++) { crv[2 * s] += ox; crv[2 * s + 1] += oy; }
      };
      return t => {
        const id = Math.floor(t / T), lt = t - id * T, cs = SH[id % SH.length], KM = Math.min(L.p.terms, cs.length);
        const grow = ease.out(seg(lt, 0, 0.6)), th = 2 * Math.PI * ease.inOut(seg(lt, 0.5, 6.5)), melt = seg(lt, 6.9, 8.5);
        const K = Math.max(2, Math.round(Math.exp(lerp(Math.log(KM), Math.log(2), melt))));
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const full = melt > 0, drawn = full ? 2 * Math.PI : th;
        if (drawn > 0) {
          curve(cs, K, drawn); g.lineCap = 'round'; g.lineJoin = 'round';
          for (const [w, a] of /** @type {[number, number][]} */ ([[7, 0.14], [2.2, 1]])) {
            g.lineWidth = w; g.globalAlpha = a;
            for (let b = 0; b < NB; b++) { const s0 = Math.floor(b * SAMP / NB), s1 = Math.floor((b + 1) * SAMP / NB); g.beginPath(); g.moveTo(crv[2 * s0], crv[2 * s0 + 1]); for (let s = s0 + 1; s <= s1; s++) g.lineTo(crv[2 * s], crv[2 * s + 1]); g.strokeStyle = bcol[b]; g.stroke(); }
          }
          g.globalAlpha = 1;
        }
        const arms = (full ? 0.75 : 1) * grow, KA = full ? K : KM;
        if (arms > 0) {
          let x = ox + cs[0].re, y = oy + cs[0].im; g.lineWidth = 1;
          for (let i = 1; i < KA; i++) {
            const c = cs[i], ca = Math.cos(c.k * th), sa = Math.sin(c.k * th), nx = x + (c.re * ca - c.im * sa) * grow, ny = y + (c.re * sa + c.im * ca) * grow;
            if (c.r > 1.2 && i < 80) { g.strokeStyle = `rgba(244,239,230,${arms * Math.min(0.28, 0.06 + c.r / 200)})`; g.beginPath(); g.arc(x, y, c.r * grow, 0, 6.2832); g.stroke(); }
            g.strokeStyle = `rgba(244,239,230,${arms * 0.7})`; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke(); x = nx; y = ny;
          }
          const gr = g.createRadialGradient(x, y, 0, x, y, 14); gr.addColorStop(0, `rgba(255,255,255,${arms})`); gr.addColorStop(0.3, `rgba(255,90,54,${arms * 0.7})`); gr.addColorStop(1, 'rgba(255,90,54,0)'); g.fillStyle = gr; g.fillRect(x - 14, y - 14, 28, 28);
        }
        hud(g, full ? 'REMOVING CIRCLES' : 'FOURIER EPICYCLES', `${full ? K : KM} circles   ${NP} samples`, 1);
        const fo = Math.max(seg(lt, T - 0.35, T), 1 - seg(lt, 0, 0.25)); if (fo > 0) { g.fillStyle = `rgba(11,11,16,${fo})`; g.fillRect(0, 0, W, H); }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-quadtree', title: 'Quadtree mosaic', aka: 'quadtree image compression, adaptive subdivision, region splitting, mosaic art', tool: 'Canvas 2D (quadtree + summed-area tables)', runs: 'CPU',
    notice: 'A hidden painting starts as one flat block of its average color. Each step splits the block whose color is most wrong into four, so detail piles up along edges (sun, ridges, water) while flat sky stays in big tiles. Summed-area tables make each error check instant. After 2,400 splits a wipe compares the mosaic with the source, then the tree merges back into one block.',
    use: 'image compression and level-of-detail explainers, mosaic and pixel-art reveals, transitions',
    params: [{ key: 'splits', label: 'Splits', min: 50, max: 4000, step: 50, value: 2400, restart: true }],
    prompt: 'Quadtree mosaic reveal, a 14 s loop: a sunset lake scene (flat poster colors: banded sky, layered violet mountains, a big amber sun, striped reflections, three birds) is drawn in a hidden canvas; start from one block of its average color and split the block with the largest color error into four, {splits} times, the rate doubling from about one split per second so the first splits read clearly. Tiles have 1 px gaps and small rounded corners, new tiles flash, a mono HUD shows cell count and RMS error. Hold, a vertical wipe compares mosaic and source, then the tree merges back to one block.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const AW = 320, AH = 180, SC = W / AW, NS = L.p.splits, T = 14;
      const src = document.createElement('canvas'); src.width = W; src.height = H; const s = src.getContext('2d');
      for (const [y0, bc] of /** @type {[number, string][]} */ ([[0, '#1d1b3a'], [44, '#33296f'], [84, '#5b45c9'], [118, '#a457d6'], [148, '#ff5a6e'], [176, '#ff7a45'], [200, '#ffb020']])) { s.fillStyle = bc; s.fillRect(0, y0, W, 222 - y0); }
      s.fillStyle = '#ffd166'; s.beginPath(); s.arc(400, 150, 62, 0, 7); s.fill(); s.fillStyle = '#fff1c9'; s.beginPath(); s.arc(400, 150, 40, 0, 7); s.fill();
      for (const [mc, f, base, sd] of /** @type {[string, number, number, number][]} */ ([['#3b2f86', 0.9, 178, 3], ['#2a2366', 1.4, 196, 7], ['#1d1b3a', 2.1, 212, 11]])) { s.fillStyle = mc; s.beginPath(); s.moveTo(0, 222); for (let x = 0; x <= W; x += 4) s.lineTo(x, base - EX.noise(x * 0.006 * f, sd) * 80 + 30); s.lineTo(W, 222); s.fill(); }
      s.fillStyle = '#231d55'; s.fillRect(0, 220, W, H - 220); s.fillStyle = '#ff7a45'; s.fillRect(0, 220, W, 4);
      for (let y = 230, k = 0; y < H; y += 10, k++) { const w = 150 * (1 - (y - 220) / 170); s.fillStyle = k % 2 ? '#ffb020' : '#ffd166'; s.fillRect(400 - w / 2 + Math.sin(k * 2.3) * 12, y, w, 4); }
      s.strokeStyle = '#1d1b3a'; s.lineWidth = 3; s.lineCap = 'round'; for (const [bx, by, bs] of /** @type {[number, number, number][]} */ ([[170, 70, 10], [196, 84, 7], [150, 92, 6]])) { s.beginPath(); s.moveTo(bx - bs, by - bs * 0.5); s.quadraticCurveTo(bx - bs * 0.4, by - bs * 0.6, bx, by); s.quadraticCurveTo(bx + bs * 0.4, by - bs * 0.6, bx + bs, by - bs * 0.5); s.stroke(); }
      s.fillStyle = '#100e22'; s.beginPath(); s.moveTo(0, H); s.lineTo(0, 300); s.quadraticCurveTo(120, 286, 230, H); s.fill();
      // Summed-area tables of the color and squared color at analysis resolution.
      const sm = document.createElement('canvas'); sm.width = AW; sm.height = AH; const sg = sm.getContext('2d'); sg.drawImage(src, 0, 0, AW, AH);
      const px = sg.getImageData(0, 0, AW, AH).data, SW = AW + 1, I = [0, 1, 2, 3, 4, 5].map(() => new Float64Array(SW * (AH + 1)));
      for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) for (let c = 0; c < 3; c++) { const v = px[(y * AW + x) * 4 + c], o = (y + 1) * SW + x + 1; I[c][o] = v + I[c][o - 1] + I[c][o - SW] - I[c][o - SW - 1]; I[c + 3][o] = v * v + I[c + 3][o - 1] + I[c + 3][o - SW] - I[c + 3][o - SW - 1]; }
      const box = (A, x, y, w, h) => A[(y + h) * SW + x + w] - A[y * SW + x + w] - A[(y + h) * SW + x] + A[y * SW + x];
      const cx = [], cy = [], cw = [], ch = [], col = [], err = [];
      const mk = (x, y, w, h) => { const n = w * h; let e = 0; const m = [0, 1, 2].map(c => { const sm1 = box(I[c], x, y, w, h), sm2 = box(I[c + 3], x, y, w, h); e += sm2 - sm1 * sm1 / n; return Math.round(sm1 / n); }); cx.push(x); cy.push(y); cw.push(w); ch.push(h); col.push(`rgb(${m[0]},${m[1]},${m[2]})`); err.push(w < 2 || h < 2 ? -1 : e); return cx.length - 1; };
      // Precomputes the split order with a max-heap on color error.
      const heap = [mk(0, 0, AW, AH)], order = [], kids = [], errAt = [err[0]];
      const up = i => { while (i) { const p = (i - 1) >> 1; if (err[heap[p]] >= err[heap[i]]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const down = i => { for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < heap.length && err[heap[l]] > err[heap[m]]) m = l; if (r < heap.length && err[heap[r]] > err[heap[m]]) m = r; if (m === i) return; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } };
      let total = err[0];
      while (order.length < NS && heap.length && err[heap[0]] > 0) {
        const c = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; down(0); }
        const w1 = cw[c] >> 1, h1 = ch[c] >> 1, k = [mk(cx[c], cy[c], w1, h1), mk(cx[c] + w1, cy[c], cw[c] - w1, h1), mk(cx[c], cy[c] + h1, w1, ch[c] - h1), mk(cx[c] + w1, cy[c] + h1, cw[c] - w1, ch[c] - h1)];
        total -= err[c]; for (const q of k) { total += Math.max(0, err[q]); heap.push(q); up(heap.length - 1); }
        order.push(c); kids.push(k); errAt.push(total);
      }
      const NO = order.length, D = Math.log2(Math.max(2, NO));
      const mos = document.createElement('canvas'); mos.width = W; mos.height = H; const mg = mos.getContext('2d');
      const tile = i => { const x = cx[i] * SC, y = cy[i] * SC, w = cw[i] * SC, h = ch[i] * SC, gp = w >= 10 && h >= 10 ? 1 : 0; mg.fillStyle = col[i]; if (w >= 14) { mg.beginPath(); mg.roundRect(x + gp, y + gp, w - 2 * gp, h - 2 * gp, 3); mg.fill(); } else mg.fillRect(x + gp, y + gp, w - 2 * gp, h - 2 * gp); };
      const clear = i => { mg.fillStyle = C.bg; mg.fillRect(cx[i] * SC, cy[i] * SC, cw[i] * SC, ch[i] * SC); };
      let shown = 0; clear(0); tile(0);
      const splitsAt = lt => lt < 9 ? Math.floor(NO * (2 ** (seg(lt, 0.6, 8.6) * D) - 1) / (2 ** D - 1)) : Math.floor(NO * (2 ** ((1 - seg(lt, 11.9, 13.3)) * D) - 1) / (2 ** D - 1));
      const timeOf = k => 0.6 + 8 * Math.log2(1 + k / NO * (2 ** D - 1)) / D;
      return t => {
        const lt = t % T, target = splitsAt(lt);
        while (shown < target) { const c = order[shown], k = kids[shown++]; clear(c); for (const q of k) tile(q); }
        while (shown > target) { const c = order[--shown]; clear(c); tile(c); }
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H); g.drawImage(mos, 0, 0);
        if (lt < 8.8) for (let j = Math.max(0, shown - 6); j < shown; j++) { const a = (lt - timeOf(j)) / 0.5; if (a < 0 || a >= 1) continue; const c = order[j]; if (cw[c] * SC < 12) continue; g.strokeStyle = `rgba(255,248,235,${(1 - a) * 0.9})`; g.lineWidth = 2; g.strokeRect(cx[c] * SC + 1, cy[c] * SC + 1, cw[c] * SC - 2, ch[c] * SC - 2); }
        const wp = seg(lt, 9.6, 10.6) - seg(lt, 11, 11.8);
        if (wp > 0) { const wx = W * ease.inOut(wp); g.drawImage(src, 0, 0, wx, H, 0, 0, wx, H); g.fillStyle = C.cream; g.fillRect(wx - 1, 0, 2, H); g.font = '600 10px Cascadia Mono, Consolas'; g.letterSpacing = '2px'; g.fillStyle = 'rgba(255,248,235,0.85)'; if (wx > 90) g.fillText('SOURCE', wx - 76, 22); if (wx < W - 90) g.fillText('MOSAIC', wx + 12, 22); g.letterSpacing = '0px'; }
        const band = g.createLinearGradient(0, H - 46, 0, H); band.addColorStop(0, 'rgba(11,11,16,0)'); band.addColorStop(1, 'rgba(11,11,16,0.8)'); g.fillStyle = band; g.fillRect(0, H - 46, W, 46);
        hud(g, 'QUADTREE', `${1 + 3 * shown} cells   RMS error ${Math.sqrt(Math.max(0, errAt[shown]) / (AW * AH * 3)).toFixed(1)}`, 1);
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-casteljau', title: 'Bezier curve, built by lerps', aka: "de Casteljau's algorithm, Bezier construction, nested linear interpolation", tool: 'Canvas 2D (repeated linear interpolation)', runs: 'CPU',
    notice: 'A Bezier curve is only linear interpolation done again and again. At a value t between 0 and 1, a point slides along each side of the control polygon; those points form a shorter polygon, and the same step repeats until one point is left. That last point draws the curve as t sweeps from 0 to 1, while the control points drift and earlier passes fade into a ribbon.',
    use: 'motion design and graphics explainers, ribbon and flourish animations, teaching easing curves',
    params: [{ key: 'deg', label: 'Degree', min: 2, max: 7, step: 1, value: 4, restart: true }, { key: 'sweep', label: 'Time per pass', min: 1, max: 6, step: 0.1, value: 2.6, unit: ' s' }],
    prompt: "Animated de Casteljau construction of a degree-{deg} Bezier curve on near-black: control points labeled P0, P1 and so on drift slowly on noise; at parameter t, lerp points slide along every segment and each nested level of lines gets its own color (violet, cyan, green, amber), the final glowing coral point draws the curve as t eases from 0 to 1 in {sweep}; earlier passes stay as fading ghost curves that build a ribbon. A slider at the bottom shows t with its value.",
    setup(cv, L) {
      const g = cv.getContext('2d'); const N = L.p.deg + 1, GH = 7, r = rng(5);
      const seeds = [...Array(N)].map(() => [r() * 50, r() * 50]), lv = ramp([C.cream, C.violet, C.cyan, C.green, C.amber]);
      const P = [...Array(N)].map(() => [0, 0]), work = [...Array(N)].map(() => [0, 0]), ghosts = [];
      // Control points spread across the stage and wander on smooth noise.
      const place = t => { for (let i = 0; i < N; i++) { const bx = 70 + i * (500 / (N - 1)), by = i % 2 ? 90 : 240; P[i][0] = bx + (EX.noise(seeds[i][0], t * 0.18) - 0.5) * 160; P[i][1] = by + (EX.noise(seeds[i][1], t * 0.18 + 9) - 0.5) * 170; } };
      const at = (u, out) => { for (let i = 0; i < N; i++) { work[i][0] = P[i][0]; work[i][1] = P[i][1]; } for (let k = N - 1; k > 0; k--) for (let i = 0; i < k; i++) { work[i][0] = lerp(work[i][0], work[i + 1][0], u); work[i][1] = lerp(work[i][1], work[i + 1][1], u); } out[0] = work[0][0]; out[1] = work[0][1]; return out; };
      const pt = [0, 0];
      let pass = -1;
      return t => {
        const SW = L.p.sweep, PER = SW + 0.7, id = Math.floor(t / PER), ph = t - id * PER, u = ease.inOut(seg(ph, 0, SW));
        place(t);
        if (id !== pass) { if (pass >= 0) { const c = []; for (let s = 0; s <= 80; s++) { at(s / 80, pt); c.push(pt[0], pt[1]); } ghosts.unshift(c); if (ghosts.length > GH) ghosts.pop(); } pass = id; }
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H); g.lineCap = 'round'; g.lineJoin = 'round';
        ghosts.forEach((c, k) => { g.strokeStyle = `rgba(255,90,54,${0.32 * (1 - k / GH)})`; g.lineWidth = 2; g.beginPath(); for (let s = 0; s < c.length; s += 2) s ? g.lineTo(c[s], c[s + 1]) : g.moveTo(c[s], c[s + 1]); g.stroke(); });
        g.beginPath(); for (let s = 0; s <= 80; s++) { at(s / 80 * u, pt); s ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1]); }
        g.strokeStyle = 'rgba(255,90,54,0.25)'; g.lineWidth = 9; g.stroke(); g.strokeStyle = C.coral; g.lineWidth = 3.2; g.stroke();
        for (let i = 0; i < N; i++) { work[i][0] = P[i][0]; work[i][1] = P[i][1]; }
        for (let k = N; k > 1; k--) {
          const col = lv((N - k) / Math.max(1, N - 2));
          g.strokeStyle = col; g.globalAlpha = k === N ? 0.45 : 0.9; g.lineWidth = k === N ? 1.2 : 1.6; g.setLineDash(k === N ? [4, 5] : []);
          g.beginPath(); for (let i = 0; i < k; i++) i ? g.lineTo(work[i][0], work[i][1]) : g.moveTo(work[i][0], work[i][1]); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
          g.fillStyle = col; for (let i = 0; i < k; i++) { g.beginPath(); g.arc(work[i][0], work[i][1], k === N ? 5 : 3.2, 0, 7); g.fill(); }
          for (let i = 0; i < k - 1; i++) { work[i][0] = lerp(work[i][0], work[i + 1][0], u); work[i][1] = lerp(work[i][1], work[i + 1][1], u); }
        }
        const hx = work[0][0], hy = work[0][1], gr = g.createRadialGradient(hx, hy, 0, hx, hy, 20); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,90,54,0.8)'); gr.addColorStop(1, 'rgba(255,90,54,0)'); g.fillStyle = gr; g.fillRect(hx - 20, hy - 20, 40, 40);
        g.font = '600 11px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.75)'; for (let i = 0; i < N; i++) g.fillText(`P${i}`, P[i][0] + 9, P[i][1] - 9);
        const tx0 = 220, tx1 = W - 24, ty = H - 16, kx = lerp(tx0, tx1, u);
        g.strokeStyle = 'rgba(244,239,230,0.2)'; g.lineWidth = 3; g.beginPath(); g.moveTo(tx0, ty); g.lineTo(tx1, ty); g.stroke();
        g.strokeStyle = C.coral; g.beginPath(); g.moveTo(tx0, ty); g.lineTo(kx, ty); g.stroke(); g.fillStyle = C.cream; g.beginPath(); g.arc(kx, ty, 6, 0, 7); g.fill();
        g.font = '600 11px Cascadia Mono, Consolas'; g.letterSpacing = '2px'; g.fillStyle = C.cream; g.fillText('DE CASTELJAU', 16, H - 12); g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillText(`t ${u.toFixed(2)}`, 140, H - 12); g.letterSpacing = '0px';
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-fortune', title: "Fortune's sweep line", aka: 'Voronoi diagram by sweep line, beach line, parabolic fronts, circle events', tool: 'Canvas 2D + D3 (d3-delaunay for the finished cells)', runs: 'CPU',
    notice: "A coral line sweeps down the screen. Every site above it grows a parabola: the points as close to the site as to the line. The lowest parabolas form the beach line (cream), and everything above it is final, so the Voronoi cells appear right behind it. Rings flash at circle events, where an arc of the beach line pinches out and a new Voronoi corner is fixed.",
    use: 'computational geometry explainers, "order emerges" reveals, generative cell patterns',
    params: [{ key: 'sites', label: 'Sites', min: 6, max: 80, step: 1, value: 26, restart: true }],
    prompt: "Visualize Fortune's sweep-line Voronoi algorithm, a 10 s loop on near-black: {sites} evenly spread sites, a glowing coral sweep line moves down at constant speed, each site above it shows its faint parabola, the lower envelope is a bright cream beach line, and the finished Voronoi cells (deep coral, amber, cyan and violet tones with cream edges) are revealed only above the beach line. Sites light up with a ring when the line passes them; a circle flashes at each circle event where a Voronoi vertex is fixed. Hold the full diagram, fade, new sites.",
    setup(cv, L) {
      const g = cv.getContext('2d'); const d3 = /** @type {any} */ (window).d3;
      if (!d3 || !d3.Delaunay) { g.fillStyle = C.bg; g.fillRect(0, 0, W, H); g.fillStyle = C.cream; g.font = '14px Segoe UI'; g.fillText('D3 did not load.', 24, 40); return () => {}; }
      const N = L.p.sites, T = 10, Y0 = -10, Y1 = H + 320, SWEEP = 7.4, XS = 161;
      const cells = document.createElement('canvas'); cells.width = W; cells.height = H; const cg = cells.getContext('2d');
      const stops = [C.coral, C.amber, C.green, C.cyan, C.violet].map(hexRGB), bgc = hexRGB(C.bg);
      const tone = f => { const x = Math.min(0.999, Math.max(0, f)) * (stops.length - 1), i = x | 0, k = x - i; return [0, 1, 2].map(j => lerp(stops[i][j], stops[i + 1][j], k)); };
      let S = [], ev = [], cyc = -1; const beach = new Float32Array(XS);
      // New evenly spread sites, their finished Voronoi picture and the circle events (circumcircles of the Delaunay triangles).
      function build(seed) {
        const r = rng(seed); S = [];
        for (let i = 0; i < N; i++) { let best = null, bd = -1; for (let k = 0; k < 15; k++) { const p = [20 + r() * (W - 40), 16 + r() * (H - 32)]; let md = 1e9; for (const q of S) md = Math.min(md, (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2); if (md > bd) { bd = md; best = p; } } S.push(best); }
        const del = d3.Delaunay.from(S), vor = del.voronoi([0, 0, W, H]);
        cg.clearRect(0, 0, W, H);
        S.forEach((p, i) => { const c = tone(p[0] / W * 0.85 + (p[1] / H) * 0.15), k = 0.5 + 0.22 * ((i * 7) % 5) / 4; cg.fillStyle = `rgb(${lerp(bgc[0], c[0], k) | 0},${lerp(bgc[1], c[1], k) | 0},${lerp(bgc[2], c[2], k) | 0})`; cg.beginPath(); vor.renderCell(i, cg); cg.fill(); });
        cg.strokeStyle = 'rgba(244,239,230,0.85)'; cg.lineWidth = 1.5; cg.beginPath(); vor.render(cg); cg.stroke();
        ev = []; const tr = del.triangles;
        for (let t = 0; t < tr.length; t += 3) { const [ax, ay] = S[tr[t]], [bx, by] = S[tr[t + 1]], [qx, qy] = S[tr[t + 2]], d = 2 * (ax * (by - qy) + bx * (qy - ay) + qx * (ay - by)); if (Math.abs(d) < 1e-9) continue; const ux = ((ax * ax + ay * ay) * (by - qy) + (bx * bx + by * by) * (qy - ay) + (qx * qx + qy * qy) * (ay - by)) / d, uy = ((ax * ax + ay * ay) * (qx - bx) + (bx * bx + by * by) * (ax - qx) + (qx * qx + qy * qy) * (bx - ax)) / d; ev.push([ux, uy, Math.hypot(ax - ux, ay - uy)]); }
      }
      return t => {
        const c = Math.floor(t / T), lt = t - c * T;
        if (c !== cyc) { cyc = c; build(31 + c * 977); }
        const ly = lerp(Y0, Y1, seg(lt, 0.3, 0.3 + SWEEP)), done = lt > 0.3 + SWEEP;
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        for (let k = 0; k < XS; k++) { const x = k * W / (XS - 1); let b = -1e9; for (const [sx, sy] of S) { if (sy >= ly) continue; const d = ly - sy; if (d < 0.5) continue; b = Math.max(b, (sy + ly) / 2 - (x - sx) * (x - sx) / (2 * d)); } beach[k] = done ? H + 50 : b; }
        g.save(); g.beginPath(); g.moveTo(0, -1); for (let k = 0; k < XS; k++) g.lineTo(k * W / (XS - 1), Math.max(-1, beach[k])); g.lineTo(W, -1); g.closePath(); g.clip(); g.drawImage(cells, 0, 0); g.restore();
        if (!done) {
          g.lineWidth = 1; g.strokeStyle = 'rgba(244,239,230,0.12)';
          for (const [sx, sy] of S) { if (sy >= ly || ly - sy < 0.5 || ly - sy > 240) continue; const d = ly - sy; g.beginPath(); for (let k = 0; k < XS; k++) { const x = k * W / (XS - 1), y = (sy + ly) / 2 - (x - sx) * (x - sx) / (2 * d); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
          g.strokeStyle = C.cream; g.lineWidth = 2.4; g.beginPath(); let on = false; for (let k = 0; k < XS; k++) { const x = k * W / (XS - 1), y = beach[k]; if (y < -1e8) { on = false; continue; } on ? g.lineTo(x, y) : g.moveTo(x, y); on = true; } g.stroke();
          for (const [ux, uy, R] of ev) { const a = (ly - (uy + R)) / 40; if (a < 0 || a > 1 || uy < -20 || uy > H + 20) continue; g.strokeStyle = `rgba(122,92,255,${(1 - a) * 0.9})`; g.lineWidth = 1.5; g.beginPath(); g.arc(ux, uy, R, 0, 7); g.stroke(); g.fillStyle = `rgba(255,255,255,${1 - a})`; g.beginPath(); g.arc(ux, uy, 3.5, 0, 7); g.fill(); }
          if (ly > -5 && ly < H + 5) { const gr = g.createLinearGradient(0, ly - 14, 0, ly + 14); gr.addColorStop(0, 'rgba(255,90,54,0)'); gr.addColorStop(0.5, 'rgba(255,90,54,0.35)'); gr.addColorStop(1, 'rgba(255,90,54,0)'); g.fillStyle = gr; g.fillRect(0, ly - 14, W, 28); g.fillStyle = C.coral; g.fillRect(0, ly - 1, W, 2); }
        }
        for (const [sx, sy] of S) {
          const passed = sy < ly, a = passed ? (ly - sy) / 60 : 1;
          g.fillStyle = passed ? C.cream : 'rgba(244,239,230,0.35)'; g.beginPath(); g.arc(sx, sy, passed ? 3 : 2.2, 0, 7); g.fill();
          if (passed && a < 1) { g.strokeStyle = `rgba(255,176,32,${1 - a})`; g.lineWidth = 1.5; g.beginPath(); g.arc(sx, sy, 4 + a * 16, 0, 7); g.stroke(); }
        }
        hud(g, done ? 'VORONOI DIAGRAM' : "FORTUNE'S SWEEP", done ? `${N} cells` : `sweep y ${Math.round(ly)}`, 1);
        const fo = ease.inOut(seg(lt, T - 0.6, T)) + (1 - seg(lt, 0, 0.3)); if (fo > 0) { g.fillStyle = `rgba(11,11,16,${Math.min(1, fo)})`; g.fillRect(0, 0, W, H); }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-sudoku', title: 'Sudoku by backtracking', aka: 'depth-first search, constraint satisfaction, backtracking solver, most-constrained-variable heuristic', tool: 'Canvas 2D (recursive backtracking, replayed)', runs: 'CPU',
    notice: 'The solver fills empty squares one at a time with the first digit that breaks no rule, and when a square has no legal digit it erases its last guesses and tries the next one. The chart on the right is the search depth: every drop is a backtrack. Switch to "Fewest options first" and the same puzzle falls in about 50 moves instead of thousands.',
    use: 'explaining search, recursion and heuristics, puzzle and game content, satisfying solves',
    controls: [{ label: 'Row by row', on: true, fn: L => { L.mode = 0; L.t = 0; } }, { label: 'Fewest options first', fn: L => { L.mode = 1; L.t = 0; } }],
    prompt: 'Sudoku solved live by backtracking, a 12 s loop per puzzle on near-black: givens in cream Bahnschrift, guesses in amber, the newest guess in coral with a glow, erased guesses flash red; the move rate doubles from a few per second to thousands so the whole search fits in 8 s. A depth chart on the right draws the sawtooth of the search as it happens, with counters for digits placed and backtracks. When solved, a green wave runs over the grid with a small bounce on every digit, then the guesses clear in a wave. A toggle switches to the fewest-options-first heuristic.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const T = 12, X0 = 30, Y0 = 26, CW = 34, CX = 372, CY = 64, CWD = 248, CHT = 186;
      const PUZ = ['530070000600195000098000060800060003400803001700020006060000280000419005000080079', '030050040008010500460000012070502080000603000040109030250000098001020600080060020', '100007090030020008009600500005300900010080002600004000300000010040000007007000300'];
      let ev = [], depth = new Int16Array(1), given = [], board = new Uint8Array(81), mark = new Float32Array(81), shown = 0, placed = 0, back = 0, key = '', maxD = 1;
      // Solves one puzzle and records every placement (digit) and erase (0) for replay.
      function record(s, mrv) {
        const b = [...s].map(Number); ev = []; const dl = [0]; let d = 0;
        const ok = (i, v) => { const r = (i / 9) | 0, c = i % 9, br = r - r % 3, bc = c - c % 3; for (let k = 0; k < 9; k++) if (b[r * 9 + k] === v || b[k * 9 + c] === v || b[(br + ((k / 3) | 0)) * 9 + bc + k % 3] === v) return false; return true; };
        const rec = () => {
          if (ev.length > 30000) return true; let best = -1, bn = 10;
          for (let i = 0; i < 81; i++) if (!b[i]) { if (!mrv) { best = i; break; } let n = 0; for (let v = 1; v <= 9; v++) if (ok(i, v)) n++; if (n < bn) { bn = n; best = i; } }
          if (best < 0) return true;
          for (let v = 1; v <= 9; v++) if (ok(best, v)) { b[best] = v; ev.push(best * 10 + v); dl.push(++d); if (rec()) return true; b[best] = 0; ev.push(best * 10); dl.push(--d); }
          return false;
        };
        rec(); depth = Int16Array.from(dl); maxD = Math.max(1, ...dl);
        given = [...s].map(Number); board = Uint8Array.from(given); mark.fill(-9); shown = 0; placed = 0; back = 0;
      }
      // Short searches play at a steady pace; long ones double their rate so thousands of moves fit in 8 s.
      const stepsAt = lt => { const NS = ev.length, D = Math.log2(Math.max(2, NS)), u = seg(lt, 0.6, 8.4), w = Math.min(1, Math.max(0, (D - 6) / 4)); return Math.floor(NS * lerp(u, (2 ** (u * D) - 1) / (2 ** D - 1), w)); };
      return t => {
        const mode = L.mode || 0, id = Math.floor(t / T), lt = t - id * T, k2 = mode + ':' + id;
        if (k2 !== key) { key = k2; record(PUZ[id % PUZ.length], mode === 1); }
        const target = stepsAt(lt);
        while (shown < target) { const e = ev[shown++], c = (e / 10) | 0, v = e % 10; board[c] = v; mark[c] = lt; if (v) placed++; else back++; }
        const solved = shown >= ev.length && lt > 8.4, clr = seg(lt, 10.4, 11.2);
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let i = 0; i < 81; i++) {
          const r = (i / 9) | 0, c = i % 9, x = X0 + c * CW, y = Y0 + r * CW, box = ((r / 3) | 0) + ((c / 3) | 0) & 1, age = lt - mark[i];
          const wv = solved ? seg(lt, 8.5 + (r + c) * 0.05, 8.9 + (r + c) * 0.05) : 0, cl = !given[i] && clr > (16 - r - c) / 16 * 0.7;
          g.fillStyle = box ? '#17162b' : '#121122'; g.fillRect(x + 1, y + 1, CW - 2, CW - 2);
          if (wv > 0 && wv < 1) { g.fillStyle = `rgba(95,211,141,${Math.sin(wv * Math.PI) * 0.55})`; g.fillRect(x + 1, y + 1, CW - 2, CW - 2); }
          if (!board[i] && age < 0.2 && !given[i]) { g.fillStyle = `rgba(255,70,60,${(1 - age / 0.2) * 0.32})`; g.fillRect(x + 1, y + 1, CW - 2, CW - 2); }
          if (!board[i] || cl) continue;
          const s = 1 + (wv > 0 ? Math.sin(wv * Math.PI) * 0.25 : 0) + (!given[i] && age < 0.15 ? (1 - age / 0.15) * 0.2 : 0);
          if (!given[i] && age < 0.25 && !solved) { g.fillStyle = `rgba(255,90,54,${(1 - age / 0.25) * 0.35})`; g.fillRect(x + 1, y + 1, CW - 2, CW - 2); }
          g.font = `${given[i] ? 700 : 500} ${Math.round(19 * s)}px Bahnschrift, Segoe UI`; g.fillStyle = given[i] ? C.cream : age < 0.25 && !solved ? C.coral : C.amber; g.fillText(String(board[i]), x + CW / 2, y + CW / 2 + 1);
        }
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.strokeStyle = 'rgba(244,239,230,0.55)'; g.lineWidth = 2; for (let k = 0; k <= 3; k++) { g.beginPath(); g.moveTo(X0 + k * 3 * CW, Y0); g.lineTo(X0 + k * 3 * CW, Y0 + 9 * CW); g.moveTo(X0, Y0 + k * 3 * CW); g.lineTo(X0 + 9 * CW, Y0 + k * 3 * CW); g.stroke(); }
        g.font = '600 10px Cascadia Mono, Consolas'; g.letterSpacing = '2px'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillText('SEARCH DEPTH', CX, CY - 14); g.letterSpacing = '0px';
        g.strokeStyle = 'rgba(244,239,230,0.15)'; g.lineWidth = 1; g.strokeRect(CX + 0.5, CY + 0.5, CWD, CHT);
        if (shown > 0) {
          const cols = Math.min(CWD, ev.length), per = ev.length / cols; g.beginPath(); g.moveTo(CX, CY + CHT);
          for (let x = 0; x < cols; x++) { const a = Math.floor(x * per), b = Math.min(shown, Math.floor((x + 1) * per)); if (a > shown) break; let m = 0; for (let j = a; j <= b; j++) m = Math.max(m, depth[j]); g.lineTo(CX + (x + 1) / cols * CWD, CY + CHT - m / maxD * (CHT - 8)); }
          g.lineTo(CX + Math.min(1, shown / ev.length) * CWD, CY + CHT); g.closePath(); g.fillStyle = 'rgba(255,176,32,0.18)'; g.fill(); g.strokeStyle = C.amber; g.lineWidth = 1.5; g.stroke();
        }
        g.font = '500 11px Cascadia Mono, Consolas'; g.fillStyle = C.cream; g.fillText(`placed      ${placed}`, CX, CY + CHT + 26); g.fillText(`backtracked ${back}`, CX, CY + CHT + 44);
        g.fillStyle = solved ? C.green : 'rgba(244,239,230,0.5)'; g.fillText(solved ? 'SOLVED' : `depth ${depth[shown]} / ${maxD}`, CX, CY + CHT + 62);
        g.font = '600 11px Cascadia Mono, Consolas'; g.letterSpacing = '2px'; g.fillStyle = mode ? C.cyan : C.coral; g.fillText(mode ? 'FEWEST OPTIONS FIRST' : 'ROW BY ROW', CX, 26); g.letterSpacing = '0px';
        const fo = Math.max(ease.inOut(seg(lt, T - 0.5, T)), 1 - seg(lt, 0, 0.3)); if (fo > 0) { g.fillStyle = `rgba(11,11,16,${fo})`; g.fillRect(0, 0, W, H); }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-topo', title: 'Living topographic map', aka: 'marching squares, isolines, contour map, hypsometric tint', tool: 'Canvas 2D (marching squares on a noise height field)', runs: 'CPU',
    notice: 'A height field made of noise drifts slowly. Marching squares visits every grid cell, checks which corners are above each height, and draws the matching line piece, so all the contour lines are rebuilt from scratch every frame. The sea level rises and falls: coasts (cyan) creep inland, islands split and merge, peaks keep their markers.',
    use: 'map and terrain backgrounds, data-landscape intros, calm generative loops, outdoor and travel brands',
    params: [{ key: 'levels', label: 'Contour levels', min: 4, max: 30, step: 1, value: 16 }, { key: 'tide', label: 'Sea level swing', min: 0, max: 0.2, step: 0.01, value: 0.09 }],
    prompt: 'A living topographic map on a night palette: a drifting two-octave noise height field on a 97 x 55 grid, {levels} contour levels traced every frame with marching squares (thin cream lines, every fourth one thicker), elevation bands tinted from deep navy through violet and coral to amber and cream peaks, water below a sea level that rises and falls by {tide} with a bright cyan coastline, small triangle markers with heights on the peaks. Slow, calm, seamless.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const GW = 97, GH = 55, SX = W / (GW - 1), SY = H / (GH - 1), BW = 160, BH = 90;
      const F = new Float32Array(GW * GH), seg4 = new Float32Array(GW * GH * 2 * 4), band = document.createElement('canvas'); band.width = BW; band.height = BH;
      const bgx = band.getContext('2d'), img = bgx.createImageData(BW, BH), p32 = new Uint32Array(img.data.buffer);
      const abgr = c => (255 << 24 | c[2] << 16 | c[1] << 8 | c[0]) >>> 0;
      const land = ['#191838', '#221f4c', '#2e2964', '#3d3184', '#5440b4', '#7a4fc8', '#a354c4', '#d0577f', '#f06a52', '#ff8a3d', '#ffb020', '#ffd88a', '#f4efe6'].map(hexRGB);
      const sea = ['#06121f', '#0a2033', '#0e3049', '#124362'].map(hexRGB);
      const mix = (P, f) => { const x = Math.min(0.999, Math.max(0, f)) * (P.length - 1), i = x | 0, k = x - i; return [0, 1, 2].map(j => lerp(P[i][j], P[i + 1][j], k) | 0); };
      let ns = 0, lutK = -1; const CAP = GW * GH * 2, landLUT = new Uint32Array(31), seaLUT = new Uint32Array(64).map((_, i) => abgr(mix(sea, 1 - i / 63)));
      const put = (n, x1, y1, x2, y2) => { seg4[n * 4] = x1; seg4[n * 4 + 1] = y1; seg4[n * 4 + 2] = x2; seg4[n * 4 + 3] = y2; return n + 1; };
      // Marching squares for one height: appends line pieces to seg4 and returns the new count.
      const march = (v, n) => {
        for (let y = 0; y < GH - 1; y++) for (let x = 0; x < GW - 1; x++) {
          const i = y * GW + x, a = F[i], b = F[i + 1], c = F[i + GW + 1], d = F[i + GW];
          const k = (a > v ? 8 : 0) | (b > v ? 4 : 0) | (c > v ? 2 : 0) | (d > v ? 1 : 0); if (k === 0 || k === 15) continue;
          const x0 = x * SX, y0 = y * SY, tx = x0 + (v - a) / (b - a) * SX, ry = y0 + (v - b) / (c - b) * SY, bx = x0 + (v - d) / (c - d) * SX, ly = y0 + (v - a) / (d - a) * SY, rx = x0 + SX, by = y0 + SY;
          if (n + 2 > CAP) return n;
          if (k === 1 || k === 14) n = put(n, x0, ly, bx, by); else if (k === 2 || k === 13) n = put(n, bx, by, rx, ry); else if (k === 3 || k === 12) n = put(n, x0, ly, rx, ry);
          else if (k === 4 || k === 11) n = put(n, tx, y0, rx, ry); else if (k === 6 || k === 9) n = put(n, tx, y0, bx, by); else if (k === 7 || k === 8) n = put(n, x0, ly, tx, y0);
          else if (k === 5) { n = put(n, x0, ly, tx, y0); n = put(n, bx, by, rx, ry); } else { n = put(n, tx, y0, rx, ry); n = put(n, x0, ly, bx, by); }
        }
        return n;
      };
      const stroke = (n0, n1) => { g.beginPath(); for (let s = n0; s < n1; s++) { g.moveTo(seg4[s * 4], seg4[s * 4 + 1]); g.lineTo(seg4[s * 4 + 2], seg4[s * 4 + 3]); } g.stroke(); };
      return t => {
        const z = t * 0.035, sl = 0.42 + L.p.tide * Math.sin(t * 0.45), K = L.p.levels;
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const u = x * 0.042 + t * 0.012, w = y * 0.042; F[y * GW + x] = Math.pow(0.68 * EX.noise(u, w, z) + 0.32 * EX.noise(u * 2.3 + 7, w * 2.3, z * 1.7), 1.25) * 1.25; }
        if (K !== lutK) { lutK = K; for (let b = 0; b < K; b++) landLUT[b] = abgr(mix(land, b / K)); }
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
          const gx = x / (BW - 1) * (GW - 1), gy = y / (BH - 1) * (GH - 1), ix = Math.min(GW - 2, gx | 0), iy = Math.min(GH - 2, gy | 0), fx = gx - ix, fy = gy - iy, i = iy * GW + ix;
          const e = lerp(lerp(F[i], F[i + 1], fx), lerp(F[i + GW], F[i + GW + 1], fx), fy);
          p32[y * BW + x] = e < sl ? seaLUT[Math.min(63, ((sl - e) / 0.3 * 63) | 0)] : landLUT[Math.min(K - 1, ((e - sl) / (1 - sl) * K) | 0)];
        }
        bgx.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(band, 0, 0, W, H);
        ns = 0; g.lineCap = 'round';
        for (let k = 1; k < K; k++) {
          const v = sl + (1 - sl) * k / K, n0 = ns; ns = march(v, ns);
          g.strokeStyle = k % 4 === 0 ? 'rgba(244,239,230,0.55)' : 'rgba(244,239,230,0.22)'; g.lineWidth = k % 4 === 0 ? 1.4 : 0.8; stroke(n0, ns);
        }
        for (let k = 1; k <= 3; k++) { const n0 = ns; ns = march(sl - k * 0.05, ns); g.strokeStyle = `rgba(43,196,230,${0.28 - k * 0.06})`; g.lineWidth = 0.8; stroke(n0, ns); }
        const n0 = ns; ns = march(sl, ns); g.strokeStyle = 'rgba(43,196,230,0.35)'; g.lineWidth = 5; stroke(n0, ns); g.strokeStyle = '#9be9ff'; g.lineWidth = 1.6; stroke(n0, ns);
        g.font = '600 10px Cascadia Mono, Consolas'; g.textAlign = 'center';
        for (let y = 2; y < GH - 2; y++) for (let x = 2; x < GW - 2; x++) {
          const i = y * GW + x, e = F[i]; if (e < sl + 0.28) continue; let top = true;
          for (let dy = -2; dy <= 2 && top; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && F[i + dy * GW + dx] >= e) { top = false; break; }
          if (!top) continue; const px = x * SX, py = y * SY; if (py > H - 44 || px < 30 || px > W - 30) continue;
          g.fillStyle = C.cream; g.beginPath(); g.moveTo(px, py - 5); g.lineTo(px + 4.5, py + 3); g.lineTo(px - 4.5, py + 3); g.closePath(); g.fill();
          g.lineWidth = 3; g.strokeStyle = 'rgba(11,11,16,0.75)'; const lab = `${Math.round((e - sl) * 3000)} m`; g.strokeText(lab, px, py - 9); g.fillText(lab, px, py - 9);
        }
        g.textAlign = 'left';
        const fb = g.createLinearGradient(0, H - 44, 0, H); fb.addColorStop(0, 'rgba(11,11,16,0)'); fb.addColorStop(1, 'rgba(11,11,16,0.85)'); g.fillStyle = fb; g.fillRect(0, H - 44, W, 44);
        hud(g, 'MARCHING SQUARES', `${K} levels   ${(GW - 1) * (GH - 1)} cells   sea ${sl >= 0.42 ? '+' : ''}${Math.round((sl - 0.42) * 3000)} m`, 1);
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-rbtree', title: 'Self-balancing tree', aka: 'red-black tree insertion, tree rotations, balanced binary search tree', tool: 'Canvas 2D (red-black tree, snapshots tweened)', runs: 'CPU',
    notice: 'Keys drop into a binary search tree one by one, always as red nodes. When two reds touch, the tree fixes itself: it recolors when the uncle is red, and otherwise rotates around a node so a long branch swings up. Every change is a snapshot and the nodes glide between snapshots, so rotations read as motion. However the keys arrive, the height stays close to log2 of the count.',
    use: 'computer science explainers, data-structure teaching, satisfying "self-organizing" motion',
    params: [{ key: 'keys', label: 'Keys', min: 6, max: 28, step: 1, value: 20, restart: true }, { key: 'pace', label: 'Seconds per step', min: 0.15, max: 1.2, step: 0.05, value: 0.4 }],
    prompt: 'Red-black tree insertion animated, on near-black: {keys} unique keys are inserted one at a time; each new node drops from above the root as a coral (red) circle, then every fix-up step (recolor when the uncle is red, rotate left or right otherwise) is its own snapshot and nodes glide between snapshots with an ease-out-back over {pace}. Black nodes are dark with a cream ring, edges thin cream, the nodes in the current step get an amber ring, a big label names the step (insert 42, recolor, rotate left at 17). All nodes slide sideways to make room. HUD with key count, tree height and log2. Hold, fade, new keys.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const NK = L.p.keys, RED = hexRGB(C.coral), BLK = [34, 32, 52];
      let snaps = [], keyList = [], cyc = -1, t0 = 0;
      // Builds the tree for one loop and records a snapshot after every structural change.
      function build(seed) {
        const r = rng(seed), pool = [...Array(99).keys()].map(k => k + 1); for (let i = pool.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
        const keys = pool.slice(0, NK), nodes = []; let root = null; snaps = [];
        const snap = (label, sub, hot, born) => {
          const xi = new Int16Array(NK).fill(-1), dp = new Int16Array(NK), par = new Int16Array(NK).fill(-1), red = new Uint8Array(NK); let n = 0, h = 0;
          const walk = (q, d) => { if (!q) return; walk(q.left, d + 1); xi[q.id] = n++; dp[q.id] = d; h = Math.max(h, d + 1); red[q.id] = q.red ? 1 : 0; if (q.parent) par[q.id] = q.parent.id; walk(q.right, d + 1); };
          walk(root, 0); snaps.push({ xi, dp, par, red, n, h, label, sub, hot: hot.map(q => q.id), born: born ? born.id : -1 });
        };
        const rot = (x, left) => { const y = left ? x.right : x.left; if (left) { x.right = y.left; if (y.left) y.left.parent = x; } else { x.left = y.right; if (y.right) y.right.parent = x; } y.parent = x.parent; if (!x.parent) root = y; else if (x === x.parent.left) x.parent.left = y; else x.parent.right = y; if (left) y.left = x; else y.right = x; x.parent = y; };
        snap('', '', [], null);
        for (const k of keys) {
          const z = { id: nodes.length, key: k, red: true, left: null, right: null, parent: null }; nodes.push(z);
          let y = null, x = root; while (x) { y = x; x = k < x.key ? x.left : x.right; } z.parent = y; if (!y) root = z; else if (k < y.key) y.left = z; else y.right = z;
          snap(`INSERT ${k}`, 'new keys start red', [z], z);
          let q = z;
          while (q.parent && q.parent.red) {
            const p = q.parent, gp = p.parent, lft = p === gp.left, u = lft ? gp.right : gp.left;
            if (u && u.red) { p.red = false; u.red = false; gp.red = true; snap('RECOLOR', 'uncle is red: parent and uncle turn black', [p, u, gp], null); q = gp; continue; }
            if (q === (lft ? p.right : p.left)) { q = p; rot(q, lft); snap(`ROTATE ${lft ? 'LEFT' : 'RIGHT'} AT ${q.key}`, 'straighten the zigzag', [q, q.parent], null); }
            q.parent.red = false; q.parent.parent.red = true; const top = q.parent.parent; rot(top, !lft); snap(`ROTATE ${lft ? 'RIGHT' : 'LEFT'} AT ${top.key}`, 'swing the long side up, swap colors', [top, top.parent], null);
          }
          if (root.red) { root.red = false; snap('ROOT TURNS BLACK', 'the root is always black', [root], null); }
        }
        keyList = keys;
      }
      const pos = (s, id) => { const sp = Math.min(38, 600 / Math.max(1, s.n - 1)); return [W / 2 + (s.xi[id] - (s.n - 1) / 2) * sp, 92 + s.dp[id] * 40]; };
      return t => {
        const pace = L.p.pace;
        if (cyc < 0 || t < t0 || t - t0 >= snaps.length * pace + 3.2) { cyc++; t0 = cyc ? t : 0; build(70 + cyc * 313); }
        const TT = snaps.length * pace + 3.2, lt = t - t0, e = Math.min(snaps.length - 1, Math.max(1, Math.floor(lt / pace) + 1)), A = snaps[e - 1], B = snaps[e], p = Math.min(1, (lt - (e - 1) * pace) / (pace * 0.85));
        const pe = ease.back(p), pc = ease.inOut(p);
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        const at = id => { const b = pos(B, id); if (A.xi[id] < 0) return [b[0], lerp(40, b[1], ease.out(p))]; const a = pos(A, id); return [lerp(a[0], b[0], pe), lerp(a[1], b[1], pe)]; };
        g.strokeStyle = 'rgba(244,239,230,0.35)'; g.lineWidth = 1.5; g.beginPath();
        for (let id = 0; id < NK; id++) { if (B.xi[id] < 0 || B.par[id] < 0) continue; const [x1, y1] = at(id), [x2, y2] = at(B.par[id]); g.moveTo(x1, y1); g.lineTo(x2, y2); }
        g.stroke();
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 12px Bahnschrift, Segoe UI';
        for (let id = 0; id < NK; id++) {
          if (B.xi[id] < 0) continue; const [x, y] = at(id), ra = A.xi[id] < 0 ? 1 : A.red[id], rb = B.red[id], k = lerp(ra, rb, pc);
          g.fillStyle = `rgb(${lerp(BLK[0], RED[0], k) | 0},${lerp(BLK[1], RED[1], k) | 0},${lerp(BLK[2], RED[2], k) | 0})`; g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill();
          g.strokeStyle = k < 0.5 ? 'rgba(244,239,230,0.7)' : 'rgba(255,200,180,0.5)'; g.lineWidth = 1.5; g.stroke();
          if (B.hot.includes(id) && lt < snaps.length * pace) { g.strokeStyle = `rgba(255,176,32,${0.4 + 0.6 * (1 - p)})`; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 18 + 3 * Math.sin(lt * 9), 0, 7); g.stroke(); }
          g.fillStyle = C.cream; g.fillText(String(keyList[id]), x, y + 1);
        }
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        const done = lt >= snaps.length * pace;
        g.font = '700 22px Bahnschrift, Segoe UI'; g.letterSpacing = '2px'; g.fillStyle = done ? C.green : C.cream; g.globalAlpha = done ? 1 : 0.4 + 0.6 * Math.min(1, p * 2); g.fillText(done ? 'BALANCED' : B.label, 16, 34); g.letterSpacing = '0px';
        g.font = '500 12px Segoe UI'; g.fillStyle = 'rgba(244,239,230,0.6)'; g.fillText(done ? `${B.n} keys in ${B.h} levels` : B.sub, 16, 54); g.globalAlpha = 1;
        hud(g, 'RED-BLACK TREE', `keys ${B.n}   height ${B.h}   log2(n+1) ${Math.log2(B.n + 1).toFixed(1)}`, 1);
        const fo = Math.max(ease.inOut(seg(lt, TT - 0.6, TT)), 1 - seg(lt, 0, 0.3)); if (fo > 0) { g.fillStyle = `rgba(11,11,16,${fo})`; g.fillRect(0, 0, W, H); }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-kmeans', title: 'K-means clustering', aka: "Lloyd's algorithm for clustering, unsupervised learning, centroid iteration", tool: 'Canvas 2D (k-means, assign and update steps)', runs: 'CPU',
    notice: 'Nine hundred points come from a few hidden blobs. K centers start on random points. Each round has two moves: every point takes the color of its nearest center (the color ripples outward), then every center glides to the average of its points, leaving a trail. After a handful of rounds nothing changes and the clusters are found, though a bad start can still split one blob and merge two others.',
    use: 'data science and machine-learning explainers, segmentation stories, dashboard intros',
    params: [{ key: 'k', label: 'Clusters (k)', min: 2, max: 9, step: 1, value: 5, restart: true }],
    prompt: 'K-means clustering animated on near-black, a loop of about 12 s: 900 points sampled from five elongated Gaussian blobs pop in as gray dots, {k} centers drop onto random points as large rings with a cross; each round, points recolor to their nearest center with a ripple that spreads out from the centers and soft colored regions show the nearest-center areas, then the centers glide to the mean of their points with a trail. Stop when nothing moves, show the round count and inertia, fade, new data.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const K = L.p.k, NP = 900, RW = 160, RH = 90;
      const PALK = [C.coral, C.amber, C.cyan, C.violet, C.green, C.cream, '#ff8ad8', '#4c6fff', '#c6f36b'], rgbK = PALK.map(hexRGB);
      const px = new Float32Array(NP), py = new Float32Array(NP), reg = document.createElement('canvas'); reg.width = RW; reg.height = RH;
      const rg = reg.getContext('2d'), rimg = rg.createImageData(RW, RH), r32 = new Uint32Array(rimg.data.buffer), bgc = hexRGB(C.bg);
      const tint = rgbK.map(c => (255 << 24 | lerp(bgc[2], c[2], 0.16) << 16 | lerp(bgc[1], c[1], 0.16) << 8 | lerp(bgc[0], c[0], 0.16)) >>> 0);
      let hist = [], asg = [], T = 10, cyc = -1, t0 = 0;
      // Samples new data and runs k-means to convergence, keeping every round's centers and assignments.
      function build(seed) {
        const r = rng(seed), gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return u - 3; };
        const blobs = []; for (let k = 0; blobs.length < 5 && k < 400; k++) { const b = { x: 90 + r() * 460, y: 60 + r() * 220, a: r() * 3.14, sx: 18 + r() * 36, sy: 10 + r() * 20 }; if (blobs.every(o => Math.hypot(o.x - b.x, o.y - b.y) > 125 - k * 0.2)) blobs.push(b); }
        for (let i = 0; i < NP; i++) { const b = blobs[i % 5], u = gauss() * b.sx, v = gauss() * b.sy; px[i] = Math.min(W - 8, Math.max(8, b.x + u * Math.cos(b.a) - v * Math.sin(b.a))); py[i] = Math.min(H - 40, Math.max(8, b.y + u * Math.sin(b.a) + v * Math.cos(b.a))); }
        let cen = [...Array(K)].map(() => { const i = (r() * NP) | 0; return [px[i], py[i]]; }); hist = [cen]; asg = [];
        for (let it = 0; it < 20; it++) {
          const a = new Uint8Array(NP); for (let i = 0; i < NP; i++) { let bd = 1e9; for (let c = 0; c < K; c++) { const d = (px[i] - cen[c][0]) ** 2 + (py[i] - cen[c][1]) ** 2; if (d < bd) { bd = d; a[i] = c; } } }
          asg.push(a); const sx = new Float64Array(K), sy = new Float64Array(K), n = new Float64Array(K); for (let i = 0; i < NP; i++) { sx[a[i]] += px[i]; sy[a[i]] += py[i]; n[a[i]]++; }
          const nc = cen.map((c, j) => n[j] ? [sx[j] / n[j], sy[j] / n[j]] : c); const moved = Math.max(...nc.map((c, j) => Math.hypot(c[0] - cen[j][0], c[1] - cen[j][1])));
          hist.push(nc); cen = nc; if (moved < 0.05) break;
        }
        T = 1.6 + asg.length * 1.1 + 2.6;
      }
      const inertia = (a, cen) => { let s = 0; for (let i = 0; i < NP; i++) s += (px[i] - cen[a[i]][0]) ** 2 + (py[i] - cen[a[i]][1]) ** 2; return s; };
      const dl = new Float32Array(NP);
      return t => {
        if (cyc < 0 || t < t0 || t - t0 >= T) { cyc++; t0 = cyc ? t : 0; build(5 + cyc * 271); }
        const lt = t - t0, R = asg.length, ri = Math.min(R - 1, Math.max(0, Math.floor((lt - 1.6) / 1.1))), rp = lt - 1.6 - ri * 1.1, started = lt >= 1.6, conv = lt >= 1.6 + R * 1.1;
        const cA = hist[ri], cB = hist[ri + 1], mv = started ? ease.inOut(seg(rp, 0.55, 1.05)) : 0, cen = cA.map((c, j) => [lerp(c[0], cB[j][0], mv), lerp(c[1], cB[j][1], mv)]);
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        if (started) {
          for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) { const X = (x + 0.5) * W / RW, Y = (y + 0.5) * H / RH; let bd = 1e9, bc = 0; for (let c = 0; c < K; c++) { const d = (X - cen[c][0]) ** 2 + (Y - cen[c][1]) ** 2; if (d < bd) { bd = d; bc = c; } } r32[y * RW + x] = tint[bc]; }
          rg.putImageData(rimg, 0, 0); g.globalAlpha = seg(lt, 1.6, 2.2); g.imageSmoothingEnabled = true; g.drawImage(reg, 0, 0, W, H); g.globalAlpha = 1;
        }
        const a = asg[ri], prev = ri > 0 ? asg[ri - 1] : null;
        if (started) { let md = 1; for (let i = 0; i < NP; i++) { const c = cA[a[i]]; dl[i] = Math.hypot(px[i] - c[0], py[i] - c[1]); md = Math.max(md, dl[i]); } for (let i = 0; i < NP; i++) dl[i] = dl[i] / md * 0.45; }
        for (let b = -1; b < K; b++) {
          g.beginPath();
          for (let i = 0; i < NP; i++) {
            const pop = seg(lt, i / NP * 0.6, i / NP * 0.6 + 0.25); if (pop <= 0) continue;
            const col = !started ? -1 : rp >= dl[i] || conv ? a[i] : prev ? prev[i] : -1; if (col !== b) continue;
            const rr = 2.1 * ease.back(pop); g.moveTo(px[i] + rr, py[i]); g.arc(px[i], py[i], rr, 0, 6.2832);
          }
          g.fillStyle = b < 0 ? 'rgba(244,239,230,0.45)' : PALK[b]; g.fill();
        }
        const drop = ease.back(seg(lt, 0.9, 1.4));
        for (let c = 0; c < K; c++) {
          if (drop <= 0) break;
          g.strokeStyle = PALK[c]; g.globalAlpha = 0.5; g.lineWidth = 1.5; g.beginPath(); for (let j = 0; j <= ri; j++) { const q = hist[j][c]; j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.lineTo(cen[c][0], cen[c][1]); g.stroke(); g.globalAlpha = 1;
          const [x, y] = cen[c], s = 11 * drop; g.fillStyle = C.bg; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); g.strokeStyle = PALK[c]; g.lineWidth = 3; g.stroke();
          g.lineWidth = 2; g.beginPath(); g.moveTo(x - s * 0.5, y); g.lineTo(x + s * 0.5, y); g.moveTo(x, y - s * 0.5); g.lineTo(x, y + s * 0.5); g.stroke();
        }
        const band = g.createLinearGradient(0, H - 44, 0, H); band.addColorStop(0, 'rgba(11,11,16,0)'); band.addColorStop(1, 'rgba(11,11,16,0.85)'); g.fillStyle = band; g.fillRect(0, H - 44, W, 44);
        if (!started) hud(g, 'K-MEANS', `${NP} points   k = ${K}`, 1);
        else if (conv) hud(g, 'CONVERGED', `${R} rounds   inertia ${Math.round(inertia(a, hist[R]) / 1000)}k`, 1);
        else hud(g, rp < 0.55 ? 'ASSIGN' : 'UPDATE', `round ${ri + 1}   inertia ${Math.round(inertia(a, cen) / 1000)}k`, 1);
        const fo = Math.max(ease.inOut(seg(lt, T - 0.6, T)), 1 - seg(lt, 0, 0.25)); if (fo > 0) { g.fillStyle = `rgba(11,11,16,${fo})`; g.fillRect(0, 0, W, H); }
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-hilbert', title: 'Hilbert curve unfolding', aka: 'space-filling curve, recursive curve, fractal path, locality-preserving order', tool: 'Canvas 2D (Hilbert index to x, y)', runs: 'CPU',
    notice: 'One unbroken line visits every square of a grid without crossing itself. Going one order deeper replaces each corner of the curve with a small U of four, so each frame of the morph slides every point out of its parent square into its own quarter, in a wave along the line. Points next to each other on the line stay next to each other on the page, which is why databases and image tools use this order.',
    use: 'recursive and fractal explainers, data and tech backgrounds, maze-like reveals and logo builds',
    params: [{ key: 'max', label: 'Deepest order', min: 3, max: 7, step: 1, value: 6, restart: true }],
    prompt: 'Hilbert curve unfolding from order 1 to order {max} in a 320 px square on near-black: order 1 draws on, then each deeper order morphs out of the previous one (every point slides from its parent square to its own quarter with an ease-in-out and a wave of delay along the line) and holds briefly; line width shrinks with the cell size, a coral, amber, cyan, violet gradient runs along the line. A big order number flips on the left, cell count and length on the right; a bright comet runs the full curve, then everything folds back to order 1 and undraws.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const MAX = L.p.max, S = 320, OX = (W - S) / 2, OY = (H - S) / 2 - 6, NB = 24, cols = [...Array(NB)].map((_, k) => ramp([C.coral, C.amber, C.cyan, C.violet])(k / (NB - 1)));
      const d2xy = (n, d) => { let x = 0, y = 0, t = d; for (let s = 1; s < n; s *= 2) { const rx = 1 & (t / 2), ry = 1 & (t ^ rx); if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } const q = x; x = y; y = q; } x += s * rx; y += s * ry; t = Math.floor(t / 4); } return [x, y]; };
      const PX = [null], PY = [null];
      for (let o = 1; o <= MAX; o++) { const n = 1 << o, N = n * n, xs = new Float32Array(N), ys = new Float32Array(N); for (let j = 0; j < N; j++) { const [x, y] = d2xy(n, j); xs[j] = OX + (x + 0.5) * S / n; ys[j] = OY + S - (y + 0.5) * S / n; } PX.push(xs); PY.push(ys); }
      const cx = new Float32Array(4 ** MAX), cy = new Float32Array(4 ** MAX), STEP = 1.6, T1 = 1.2 + (MAX - 1) * STEP, T2 = T1 + 2.6, T = T2 + (MAX - 1) * 0.28 + 1;
      const width = o => Math.max(1.3, Math.min(10, S / (1 << o) * 0.3));
      // Fills cx, cy with order o points, each moved part of the way out of its parent square.
      const morph = (o, p, back) => { const N = 4 ** o, X = PX[o], Y = PY[o], XP = PX[o - 1], YP = PY[o - 1]; for (let j = 0; j < N; j++) { const e = back ? ease.inOut(p) : ease.inOut(seg(p, j / N * 0.35, j / N * 0.35 + 0.65)); cx[j] = lerp(XP[j >> 2], X[j], e); cy[j] = lerp(YP[j >> 2], Y[j], e); } return N; };
      const copy = o => { cx.set(PX[o]); cy.set(PY[o]); return 4 ** o; };
      const line = (N, upto, w) => { g.lineWidth = w; for (let b = 0; b < NB; b++) { const s0 = Math.floor(b * (N - 1) / NB), s1 = Math.min(Math.floor((b + 1) * (N - 1) / NB), upto); if (s0 >= upto) break; if (s1 <= s0) continue; g.beginPath(); g.moveTo(cx[s0], cy[s0]); for (let s = s0 + 1; s <= s1; s++) g.lineTo(cx[s], cy[s]); g.strokeStyle = cols[b]; g.stroke(); } };
      return t => {
        const lt = t % T; let o, N, w, upto;
        if (lt < 1.2) { o = 1; N = copy(1); w = width(1); upto = 3 * ease.inOut(seg(lt, 0.15, 1.1)); }
        else if (lt < T1) { const k = Math.floor((lt - 1.2) / STEP), p = seg(lt - 1.2 - k * STEP, 0, 0.9); o = k + 2; N = morph(o, p, false); w = lerp(width(o - 1), width(o), ease.inOut(p)); upto = N - 1; }
        else if (lt < T2) { o = MAX; N = copy(MAX); w = width(MAX); upto = N - 1; }
        else { const k = Math.floor((lt - T2) / 0.28); if (k < MAX - 1) { const p = seg(lt - T2 - k * 0.28, 0, 0.26); o = MAX - k; N = morph(o, 1 - p, true); w = lerp(width(o), width(o - 1), p); } else { o = 1; N = copy(1); w = width(1); } upto = k < MAX - 1 ? N - 1 : 3 * (1 - ease.inOut(seg(lt, T - 0.9, T - 0.2))); }
        g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(244,239,230,0.08)'; g.lineWidth = 1; g.strokeRect(OX - 0.5, OY - 0.5, S + 1, S + 1);
        g.lineCap = 'round'; g.lineJoin = 'round';
        const full = Math.floor(upto); line(N, full, w);
        if (upto < N - 1 && full < N - 1) { const f = upto - full; g.strokeStyle = cols[Math.min(NB - 1, Math.floor(full / (N - 1) * NB))]; g.beginPath(); g.moveTo(cx[full], cy[full]); g.lineTo(lerp(cx[full], cx[full + 1], f), lerp(cy[full], cy[full + 1], f)); g.stroke(); }
        if (lt >= T1 && lt < T2) { const L0 = Math.floor(((lt - T1) / (T2 - T1)) * (N + N * 0.06)), len = Math.floor(N * 0.05); g.strokeStyle = 'rgba(255,250,240,0.95)'; g.lineWidth = w + 1.2; g.beginPath(); let on = false; for (let s = Math.max(0, L0 - len); s < Math.min(N, L0); s++) { on ? g.lineTo(cx[s], cy[s]) : g.moveTo(cx[s], cy[s]); on = true; } g.stroke(); }
        g.font = '600 10px Cascadia Mono, Consolas'; g.letterSpacing = '2px'; g.fillStyle = 'rgba(244,239,230,0.55)'; g.fillText('ORDER', 40, 140); g.letterSpacing = '0px';
        g.save(); g.beginPath(); g.rect(30, 146, 110, 100); g.clip(); const flip = lt > 1.2 && lt < T1 ? ease.out(seg(lt - 1.2 - Math.floor((lt - 1.2) / STEP) * STEP, 0, 0.35)) : 1;
        g.font = '700 96px Bahnschrift, Segoe UI'; g.fillStyle = C.cream; g.fillText(String(o), 36, 236 + (1 - flip) * 90); g.restore();
        const n = 1 << o; g.font = '500 12px Cascadia Mono, Consolas'; g.fillStyle = 'rgba(244,239,230,0.75)';
        g.fillText(`${n} x ${n} grid`, 500, 150); g.fillText(`${(n * n).toLocaleString('en-US')} cells`, 500, 170); g.fillText(`${(n * n - 1).toLocaleString('en-US')} steps long`, 500, 190); g.fillStyle = 'rgba(244,239,230,0.45)'; g.fillText('one line,', 500, 222); g.fillText('no crossings', 500, 240);
        hud(g, 'HILBERT CURVE', lt >= T1 && lt < T2 ? 'every square, one pass' : lt >= T2 ? 'folding back' : `order ${o} of ${MAX}`, 1);
      };
    },
  });

  EX.add({
    cat: 'sim', id: 'a2-mst', title: 'Minimum spanning tree constellations', aka: "Kruskal's algorithm, union-find, single-linkage clustering", tool: 'Canvas 2D + D3 (d3-delaunay for candidate edges)', runs: 'CPU',
    notice: "Kruskal's algorithm looks at every possible link between stars from shortest to longest. A link that joins two separate groups is kept and the smaller group takes on the larger group's color; a link inside one group would close a loop, so it flashes red and is skipped. When every star is connected, cutting the few longest links splits the tree into its natural groups.",
    use: 'network and connection stories, clustering explainers, star-map and constellation visuals',
    params: [{ key: 'stars', label: 'Stars', min: 30, max: 400, step: 10, value: 170, restart: true }, { key: 'cut', label: 'Clusters after the cut', min: 2, max: 9, step: 1, value: 5, restart: true }],
    prompt: "Kruskal's minimum spanning tree as a night-sky constellation, a 14 s loop: {stars} twinkling stars in five loose groups, candidate links from a Delaunay triangulation checked from shortest to longest at a rate that doubles every second; kept links glow in their group's color and the smaller group's stars blend to the larger group's color, links that would close a loop flash red and vanish. When the tree is complete, the longest links snap one by one with a white spark until {cut} clusters remain, each recolored. Mono HUD with links kept, links skipped and total length.",
    setup(cv, L) {
      const g = cv.getContext('2d'); const d3 = /** @type {any} */ (window).d3;
      if (!d3 || !d3.Delaunay) { g.fillStyle = C.bg; g.fillRect(0, 0, W, H); g.fillStyle = C.cream; g.font = '14px Segoe UI'; g.fillText('D3 did not load.', 24, 40); return () => {}; }
      const N = L.p.stars, KC = L.p.cut, T = 14, PALK = [C.coral, C.amber, C.cyan, C.violet, C.green, '#ff8ad8', '#4c6fff', C.cream, '#c6f36b'].map(hexRGB);
      const X = new Float32Array(N), Y = new Float32Array(N), SZ = new Float32Array(N), TW = new Float32Array(N), par = new Int32Array(N), siz = new Int32Array(N), col = new Float32Array(N * 3), tgt = new Float32Array(N * 3);
      let edges = [], mem = [], shown = 0, kept = [], rej = [], cyc = -1, total = 0, cuts = [], clusterCol = null;
      const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
      // New stars, candidate links sorted by length, and the links to cut at the end.
      function build(seed) {
        const r = rng(seed);
        const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) / 1.4; }, G = [];
        for (let k = 0; G.length < 5 && k < 500; k++) { const q = [90 + r() * (W - 180), 70 + r() * (H - 150)]; if (G.every(o => Math.hypot(o[0] - q[0], o[1] - q[1]) > 170 - k * 0.2)) G.push(q); }
        for (let i = 0; i < N; i++) { const c = G[i % G.length], sp = 34 + (i % G.length) * 5; let bd = -1; for (let k = 0; k < 8; k++) { const x = Math.min(W - 14, Math.max(14, c[0] + gauss() * sp * 1.3)), y = Math.min(H - 46, Math.max(12, c[1] + gauss() * sp)); let md = 1e9; for (let j = 0; j < i; j++) md = Math.min(md, (x - X[j]) ** 2 + (y - Y[j]) ** 2); if (md > bd) { bd = md; X[i] = x; Y[i] = y; } } SZ[i] = 0.8 + r() * r() * 2.6; TW[i] = r() * 6.28; }
        const pts = []; for (let i = 0; i < N; i++) pts.push([X[i], Y[i]]); const del = d3.Delaunay.from(pts), seen = new Set(); edges = [];
        for (let t = 0; t < del.triangles.length; t++) { const a = del.triangles[t], b = del.triangles[t % 3 === 2 ? t - 2 : t + 1], k = Math.min(a, b) * N + Math.max(a, b); if (seen.has(k)) continue; seen.add(k); edges.push([a, b, Math.hypot(X[a] - X[b], Y[a] - Y[b])]); }
        edges.sort((p, q) => p[2] - q[2]);
        for (let i = 0; i < N; i++) { par[i] = i; siz[i] = 1; const c = PALK[i % PALK.length]; for (let j = 0; j < 3; j++) col[i * 3 + j] = tgt[i * 3 + j] = c[j]; }
        mem = [...Array(N)].map((_, i) => [i]); shown = 0; kept = []; rej = []; total = 0; clusterCol = null;
        const p2 = new Int32Array(N).map((_, i) => i), f2 = a => { while (p2[a] !== a) a = p2[a] = p2[p2[a]]; return a; }, mst = [];
        for (const e of edges) { const a = f2(e[0]), b = f2(e[1]); if (a !== b) { p2[a] = b; mst.push(e); } }
        cuts = mst.slice().sort((p, q) => q[2] - p[2]).slice(0, KC - 1);
      }
      const stepsAt = lt => { const NE = edges.length, D = Math.log2(NE); return Math.floor(NE * (2 ** (seg(lt, 0.8, 8.2) * D) - 1) / (2 ** D - 1)); };
      return (t, dt) => {
        const c = Math.floor(t / T), lt = t - c * T;
        if (c !== cyc) { cyc = c; build(12 + c * 457); }
        const target = stepsAt(lt);
        while (shown < target) {
          const [a0, b0, len] = edges[shown++]; let a = find(a0), b = find(b0);
          if (a === b) { rej.push([a0, b0, lt]); continue; }
          if (siz[a] < siz[b]) { const q = a; a = b; b = q; }
          par[b] = a; siz[a] += siz[b]; for (const m of mem[b]) { mem[a].push(m); for (let j = 0; j < 3; j++) tgt[m * 3 + j] = tgt[a * 3 + j]; } mem[b] = [];
          kept.push([a0, b0, lt, len]); total += len;
        }
        const cutT = 9.2, cutting = lt > cutT;
        if (cutting && !clusterCol) {
          const p3 = new Int32Array(N).map((_, i) => i), f3 = q => { while (p3[q] !== q) q = p3[q] = p3[p3[q]]; return q; };
          for (const [a0, b0] of kept) if (!cuts.some(e => (e[0] === a0 && e[1] === b0))) p3[f3(a0)] = f3(b0);
          const roots = new Map(); clusterCol = new Int32Array(N);
          for (let i = 0; i < N; i++) { const rt = f3(i); if (!roots.has(rt)) roots.set(rt, roots.size); clusterCol[i] = roots.get(rt); }
        }
        const k = 1 - Math.exp(-dt * 6);
        for (let i = 0; i < N; i++) { if (clusterCol && lt > cutT + 0.4 * KC) { const cc = PALK[clusterCol[i] % PALK.length]; for (let j = 0; j < 3; j++) tgt[i * 3 + j] = cc[j]; } for (let j = 0; j < 3; j++) col[i * 3 + j] += (tgt[i * 3 + j] - col[i * 3 + j]) * k; }
        const rgb = (i, a) => `rgba(${col[i * 3] | 0},${col[i * 3 + 1] | 0},${col[i * 3 + 2] | 0},${a})`;
        g.fillStyle = '#07070d'; g.fillRect(0, 0, W, H);
        g.lineCap = 'round';
        for (const [a0, b0, t0] of kept) {
          const ci = cuts.findIndex(e => e[0] === a0 && e[1] === b0), ct = cutT + ci * 0.4; let s = 1;
          if (ci >= 0 && lt > ct) { s = 1 - ease.inOut(seg(lt, ct, ct + 0.35)); if (lt < ct + 0.3) { const mx = (X[a0] + X[b0]) / 2, my = (Y[a0] + Y[b0]) / 2, f = seg(lt, ct, ct + 0.3); g.strokeStyle = `rgba(255,255,255,${1 - f})`; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, 4 + f * 18, 0, 7); g.stroke(); } if (s <= 0) continue; }
          const grow = ease.out(seg(lt, t0, t0 + 0.25)) * s, mx = (X[a0] + X[b0]) / 2, my = (Y[a0] + Y[b0]) / 2, hx = (X[b0] - X[a0]) / 2 * grow, hy = (Y[b0] - Y[a0]) / 2 * grow;
          g.strokeStyle = rgb(a0, 0.18); g.lineWidth = 5; g.beginPath(); g.moveTo(mx - hx, my - hy); g.lineTo(mx + hx, my + hy); g.stroke();
          g.strokeStyle = rgb(a0, 0.9); g.lineWidth = 1.4; g.stroke();
        }
        rej = rej.filter(e => lt - e[2] < 0.35);
        for (const [a0, b0, t0] of rej) { g.strokeStyle = `rgba(255,70,60,${0.55 * (1 - (lt - t0) / 0.35)})`; g.lineWidth = 1; g.beginPath(); g.moveTo(X[a0], Y[a0]); g.lineTo(X[b0], Y[b0]); g.stroke(); }
        for (let i = 0; i < N; i++) { const tw = 0.75 + 0.25 * Math.sin(t * 2.3 + TW[i]), s = SZ[i] * ease.back(seg(lt, i / N * 0.6, i / N * 0.6 + 0.3)); if (s <= 0) continue; g.fillStyle = rgb(i, 0.25 * tw); g.beginPath(); g.arc(X[i], Y[i], s * 3, 0, 7); g.fill(); g.fillStyle = `rgba(255,250,240,${tw})`; g.beginPath(); g.arc(X[i], Y[i], s, 0, 7); g.fill(); }
        hud(g, cutting ? 'CUT THE LONGEST LINKS' : 'KRUSKAL', cutting ? `${KC} clusters` : `kept ${kept.length} / ${N - 1}   skipped ${shown - kept.length}   length ${Math.round(total)}`, 1);
        const fo = Math.max(ease.inOut(seg(lt, T - 0.6, T)), 1 - seg(lt, 0, 0.25)); if (fo > 0) { g.fillStyle = `rgba(7,7,13,${fo})`; g.fillRect(0, 0, W, H); }
      };
    },
  });



  EX.add({
    cat: 'sim', id: 'a2-wireworld', title: 'Wireworld circuit board', aka: 'Wireworld cellular automaton, electron flow, PCB trace animation', tool: 'Canvas 2D (cellular automaton on a typed-array grid)', runs: 'CPU',
    notice: 'Every square is empty, wire, an electron head or an electron tail, and four rules run the board: a head becomes a tail, a tail becomes wire again, and wire becomes a head when one or two of its eight neighbors are heads. Small loops on the left keep one electron circling and send out a pulse each lap; the pulses race along generated circuit traces, split at branches and cancel where they collide.',
    use: 'tech and electronics backgrounds, data-flow metaphors, "signal" and connectivity intros',
    params: [{ key: 'gens', label: 'Generations per frame', min: 1, max: 4, step: 1, value: 2 }],
    prompt: 'Wireworld cellular automaton as an animated circuit board, 160 x 90 cells at 4 px: five clock loops of different lengths on the left each hold one circulating electron and emit a pulse per lap into procedurally routed PCB traces (straight runs with 45-degree bends, branches, round pads drawn at the ends, traces never touch so no feedback loops form). Wire cells dim violet, electron heads white, tails amber, a blurred additive glow under the electrons, {gens} generations per frame. Mono HUD with the generation count and live electrons.',
    setup(cv, L) {
      const g = cv.getContext('2d'); const GW = 160, GH = 90, r = rng(2024);
      let A = new Uint8Array(GW * GH), B = new Uint8Array(GW * GH); const own = new Int16Array(GW * GH).fill(-1);
      const id = (x, y) => y * GW + x, inb = (x, y) => x >= 1 && y >= 1 && x < GW - 1 && y < GH - 2;
      const free = (x, y, who) => { if (!inb(x, y)) return false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const o = own[id(x + dx, y + dy)]; if (o >= 0 && o !== who) return false; } return true; };
      let nextOwner = 0; const ends = [];
      const put = (x, y, who) => { A[id(x, y)] = 1; own[id(x, y)] = who; };
      // Routes one trace to the right from (x, y) with 45-degree bends and occasional branches; the end is kept for a pad.
      const route = (x, y, depth) => {
        const who = nextOwner++; let dir = 0, run = 4 + ((r() * 10) | 0), steps = 0;
        put(x, y, who);
        while (steps++ < 400) {
          if (--run <= 0) { dir = dir ? 0 : (r() < 0.5 ? -1 : 1); run = dir ? 3 + ((r() * 8) | 0) : 5 + ((r() * 14) | 0); }
          const nx = x + 1, ny = y + dir;
          if (!free(nx, ny, who) || !free(nx + 1, ny + dir, who)) { if (dir === 0) { dir = r() < 0.5 ? -1 : 1; run = 3; if (free(x + 1, y + dir, who)) continue; } break; }
          x = nx; y = ny; put(x, y, who);
          if (depth < 2 && dir === 0 && steps > 6 && r() < 0.05) { const bd = r() < 0.5 ? -1 : 1; if (free(x + 1, y + bd, who) && free(x + 2, y + 2 * bd, -2) && free(x + 3, y + 2 * bd, -2)) { const bx = x + 1, by = y + bd; put(bx, by, who); route(bx + 1, by + bd, depth + 1); } }
        }
        ends.push([x, y]);
      };
      // Clock loops: a ring of wire with cut corners holding one electron, with an output tap on its right side.
      const loops = [[3, 8, 8, 5], [3, 25, 6, 4], [3, 41, 10, 6], [3, 60, 7, 5], [3, 76, 5, 4]];
      for (const [lx, ly, lw, lh] of loops) {
        const who = nextOwner++, cells = [];
        for (let x = lx + 1; x < lx + lw - 1; x++) cells.push([x, ly]); for (let y = ly + 1; y < ly + lh - 1; y++) cells.push([lx + lw - 1, y]); for (let x = lx + lw - 2; x > lx; x--) cells.push([x, ly + lh - 1]); for (let y = ly + lh - 2; y > ly; y--) cells.push([lx, y]);
        for (const [x, y] of cells) put(x, y, who);
        A[id(cells[1][0], cells[1][1])] = 2; A[id(cells[0][0], cells[0][1])] = 3;
        const ty = ly + (lh >> 1); put(lx + lw, ty, who); route(lx + lw + 1, ty, 0);
      }
      const START = A.slice(); let gen = 0;
      const img = g.createImageData(GW, GH), p32 = new Uint32Array(img.data.buffer), off = document.createElement('canvas'); off.width = GW; off.height = GH; const og = off.getContext('2d');
      const gimg = g.createImageData(GW, GH), q32 = new Uint32Array(gimg.data.buffer), glow = document.createElement('canvas'); glow.width = GW; glow.height = GH; const gg = glow.getContext('2d');
      const abgr = h => { const c = hexRGB(h); return (255 << 24 | c[2] << 16 | c[1] << 8 | c[0]) >>> 0; };
      const COL = [abgr('#0d0c17'), abgr('#2e2950'), abgr('#fff8ec'), abgr('#ffb020')], GL = [0, 0, abgr('#ffe2a8'), abgr('#ff7a2a')];
      const board = document.createElement('canvas'); board.width = W; board.height = H; const bgc = board.getContext('2d');
      bgc.fillStyle = '#0d0c17'; bgc.fillRect(0, 0, W, H); bgc.fillStyle = 'rgba(244,239,230,0.05)'; for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < W; x += 8) bgc.fillRect(x, y, 1, 1);
      bgc.strokeStyle = '#4a4378'; bgc.lineWidth = 2; for (const [x, y] of ends) { bgc.beginPath(); bgc.arc(x * 4 + 2, y * 4 + 2, 6, 0, 7); bgc.stroke(); }
      const step = () => {
        for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
          const i = y * GW + x, s = A[i];
          if (s === 0) { B[i] = 0; continue; } if (s === 2) { B[i] = 3; continue; } if (s === 3) { B[i] = 1; continue; }
          const n = (A[i - GW - 1] === 2 ? 1 : 0) + (A[i - GW] === 2 ? 1 : 0) + (A[i - GW + 1] === 2 ? 1 : 0) + (A[i - 1] === 2 ? 1 : 0) + (A[i + 1] === 2 ? 1 : 0) + (A[i + GW - 1] === 2 ? 1 : 0) + (A[i + GW] === 2 ? 1 : 0) + (A[i + GW + 1] === 2 ? 1 : 0);
          B[i] = n === 1 || n === 2 ? 2 : 1;
        }
        const q = A; A = B; B = q; gen++;
      };
      let last = -1;
      return t => {
        if (t < last) { A.set(START); gen = 0; } last = t;
        for (let k = 0; k < L.p.gens; k++) step();
        let heads = 0; for (let i = 0; i < GW * GH; i++) { const s = A[i]; p32[i] = s ? COL[s] : 0; q32[i] = GL[s]; if (s === 2) heads++; }
        og.putImageData(img, 0, 0); gg.putImageData(gimg, 0, 0);
        g.drawImage(board, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(off, 0, 0, W, H);
        g.globalCompositeOperation = 'lighter'; g.imageSmoothingEnabled = true; g.filter = 'blur(5px)'; g.drawImage(glow, 0, 0, W, H); g.filter = 'none'; g.globalAlpha = 0.6; g.drawImage(glow, 0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        hud(g, 'WIREWORLD', `generation ${gen}   ${heads} electrons`, 1);
      };
    },
  });
})();
