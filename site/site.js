/**
 * Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
 * SPDX-License-Identifier: Proprietary
 */

// Page wiring for index.html: builds catalog cards, the technique index, search and catalog filters,
// folded catalog sections, sidebar counts, chapter tabs and banners, the current-section highlight,
// the mobile menu, back-to-top and the prompt-anatomy hover.
(function () {
  EX.build();
  const SECTION = { reel: 'The reel', type: 'Text in motion', mg: '2D motion graphics', ui: 'App and web UI', sim: 'Simulation and generative', gpu: 'GPU shaders', audio: 'Sound and motion', libs: 'Animation libraries', engine: '3D engine', tools: 'Code-to-video tools', edit: 'Editing tricks', scratch: 'Built from scratch' };
  const RUNS = { CPU: 'cpu', GPU: 'gpu', WEB: 'web', ENGINE: 'engine' };

  // Sidebar counts and the hub total.
  let total = 0;
  /** @type {NodeListOf<HTMLAnchorElement>} */ (document.querySelectorAll('nav.side a[data-cat]')).forEach(a => { const n = EX.cards.filter(c => c.cat === a.dataset.cat).length; total += n; const c = document.createElement('span'); c.className = 'c'; c.textContent = n; a.appendChild(c); });
  const hub = document.getElementById('hub-count'); if (hub) hub.textContent = `${total} techniques, live or as rendered clips, each with a prompt.`;

  // Technique index: learning demos first, then every catalog card. A card's row shows exactly when its card shows.
  const LEARN =[['Easing', 'easing', 'Canvas 2D', 'CPU'], ['Easing race', 'easing', 'Canvas 2D', 'CPU'], ['Stagger', 'stagger', 'Canvas 2D', 'CPU'], ['Squash and stretch', 'vocabulary', 'Canvas 2D', 'CPU'], ['Anticipation and overshoot', 'vocabulary', 'Canvas 2D', 'CPU'],
    ['Timing', 'compare', 'Canvas 2D', 'CPU'], ['Hold', 'compare', 'Canvas 2D', 'CPU'], ['Follow-through and overlap', 'compare', 'Canvas 2D', 'CPU'], ['Secondary motion', 'compare', 'Canvas 2D', 'CPU'], ['Arcs', 'compare', 'Canvas 2D', 'CPU'], ['Rhythm and beat sync', 'compare', 'Canvas 2D + Web Audio', 'CPU'], ['Seamless loop', 'compare', 'Canvas 2D', 'CPU'], ['Parallax (comparison)', 'compare', 'Canvas 2D', 'CPU'],
    ['Frames and frame rate', 'pipeline', 'Canvas 2D', 'CPU'], ['Camera moves (11)', 'camera', 'Canvas 2D 3D projection', 'CPU'], ['Transitions (11)', 'transitions', 'Canvas 2D compositing', 'CPU'], ['Post effects stack', 'post', 'WebGL2 fragment shader', 'GPU'], ['Mood recipes (6)', 'prompting', 'Canvas 2D', 'CPU'], ['Prompt playground', 'words', 'Canvas 2D', 'CPU'], ['Logo reveal, played live', 'examples', 'Canvas 2D', 'CPU']];
  const tb = document.querySelector('#tech-index tbody');
  const row = (name, href, sec, tool, runs, type) => { const tr = document.createElement('tr'); tr.innerHTML = `<td><a href="#${href}">${name}</a></td><td>${sec}</td><td>${tool}</td><td><span class="tag ${RUNS[runs] || 'cpu'}">${runs}</span></td><td class="dim">${type}</td>`; tb.appendChild(tr); return tr; };
  const learnRows = LEARN.map(([n, h, tool, runs]) => { const tr = row(n, h, 'Learn', tool, runs, 'live lesson'); tr.dataset.search = (n + ' learn ' + tool).toLowerCase(); tr.dataset.runs = runs; return tr; });
  const cardRows = EX.cards.filter(c => document.getElementById('cat-' + c.cat)).map(c => [row(c.title, 'ex-' + c.id, SECTION[c.cat] || c.cat, c.tool, c.runs, c.kind === 'video' ? 'rendered clip' : (c.params ? 'live, with sliders' : 'live')), document.getElementById('ex-' + c.id)]);
  const ih = document.querySelector('#index h2'); if (ih) { const s = document.createElement('span'); s.className = 'count'; s.textContent = tb.children.length + ' entries'; ih.appendChild(s); }

  // Chapters: the sidebar's groups (START, LEARN, ...). Each gets a header tab, and its banner (.part)
  // gets one link per section with the section's card count.
  const nav = document.getElementById('sidenav'), links = /** @type {HTMLAnchorElement[]} */ ([...nav.querySelectorAll('a')]);
  /** @type {{ name: string, el: HTMLElement, tab: HTMLAnchorElement, links: HTMLAnchorElement[] }[]} */ const groups = [];
  [...nav.children].forEach(el => {
    if (el.classList.contains('grp')) groups.push({ name: el.textContent.trim(), el: /** @type {HTMLElement} */ (el), tab: null, links: [] });
    else if (el.tagName === 'A' && groups.length) groups[groups.length - 1].links.push(/** @type {HTMLAnchorElement} */ (el));
  });
  const groupOf = id => groups.find(g => g.links.some(a => a.getAttribute('href') === '#' + id));
  const tabs = document.getElementById('chapters');
  groups.forEach(g => {
    const part = document.querySelector(`.part[data-grp="${g.name}"]`);
    g.tab = document.createElement('a'); g.tab.textContent = g.name[0] + g.name.slice(1).toLowerCase(); g.tab.href = part ? '#' + part.id : g.links[0].getAttribute('href'); tabs.appendChild(g.tab);
    if (part) g.links.forEach(a => {
      const j = document.createElement('a'); j.href = a.getAttribute('href'); j.textContent = a.firstChild.textContent;
      const c = a.querySelector('.c'); if (c) { const n = document.createElement('span'); n.textContent = c.textContent; j.appendChild(n); }
      part.querySelector('.jump').appendChild(j);
    });
  });
  // Section counts in the sidebar and the banners: [count span, section, total]. While a search or filter is on,
  // view() shows how many cards of each section match instead of the total.
  const counts = /** @type {[HTMLElement, HTMLElement, string][]} */ ([...document.querySelectorAll('nav.side a[data-cat] .c, .part .jump a span')].map(c => {
    const sec = /** @type {HTMLElement} */ (document.querySelector(c.parentElement.getAttribute('href'))); return [/** @type {HTMLElement} */ (c), sec, c.textContent];
  }).filter(x => x[1]));

  // Search, catalog filters and folding. Catalog sections show their first FOLD cards and a "Show all"
  // button; while a search or filter is on, every match shows. Cards carry data-kind, data-sliders and data-runs.
  const FOLD = 6;
  const q = /** @type {HTMLInputElement} */ (document.getElementById('q')), hint = document.getElementById('qhint'), fcount = document.getElementById('fcount');
  const filt = { kind: '', runs: '' };
  EX.cards.forEach(c => { const a = document.getElementById('ex-' + c.id); if (!a) return; a.dataset.kind = c.kind === 'video' ? 'clip' : 'live'; a.dataset.sliders = c.params ? '1' : ''; a.dataset.runs = c.runs; });
  const cats = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('section.cat')]);
  cats.forEach(sec => {
    const gal = sec.querySelector('.gal'); if (gal.querySelectorAll('article.ex').length <= FOLD) return;
    const b = document.createElement('button'); b.className = 'more'; gal.after(b);
    // Show fewer jumps back to the section top. A smooth scroll would pass, and start, every card below it.
    b.onclick = () => { const open = sec.classList.toggle('open'); view(); if (!open) sec.scrollIntoView({ block: 'start', behavior: 'instant' }); };
  });
  const match = (a, s) => (!s || a.dataset.search.includes(s))
    && (!filt.kind || (filt.kind === 'sliders' ? a.dataset.sliders === '1' : a.dataset.kind === filt.kind))
    && (!filt.runs || a.dataset.runs === filt.runs);
  const matches = n => n === 1 ? '1 card matches' : `${n} cards match`;
  // Shows the matching cards and index rows and updates the counts. body.narrowed keeps the filter row in the header.
  function view() {
    const s = q.value.trim().toLowerCase(), filtered = !!(filt.kind || filt.runs), narrowed = !!s || filtered; let shown = 0;
    cats.forEach(sec => {
      let k = 0; const cards = /** @type {NodeListOf<HTMLElement>} */ (sec.querySelectorAll('article.ex'));
      cards.forEach(a => { const hit = match(a, s); a.classList.toggle('hide', !hit); a.classList.toggle('fold', hit && !narrowed && ++k > FOLD); if (hit) shown++; });
      sec.style.display = narrowed && !sec.querySelector('article.ex:not(.hide)') ? 'none' : '';
      const b = /** @type {HTMLButtonElement} */ (sec.querySelector('button.more'));
      if (b) { b.hidden = narrowed; b.textContent = sec.classList.contains('open') ? 'Show fewer' : `Show all ${cards.length} examples (${cards.length - FOLD} more)`; }
    });
    // Learn rows are live lessons without tweak sliders, so Clips and With sliders hide them; Runs on matches their runs column.
    learnRows.forEach(tr => tr.classList.toggle('hide', !((!s || tr.dataset.search.includes(s)) && (!filt.kind || filt.kind === 'live') && (!filt.runs || tr.dataset.runs === filt.runs))));
    counts.forEach(([c, sec, total]) => { const n = narrowed ? sec.querySelectorAll('article.ex:not(.hide)').length : 0; c.textContent = narrowed ? String(n) : total; c.parentElement.classList.toggle('none', narrowed && !n); });
    cardRows.forEach(([tr, a]) => tr.classList.toggle('hide', !a || a.classList.contains('hide')));
    hint.textContent = s ? matches(shown) + (filtered ? ' with the filters' : '') : '';
    fcount.textContent = filtered && !s ? matches(shown) + ' the filters' : '';
    document.body.classList.toggle('narrowed', narrowed);
    return { s, shown };
  }

  // Scroll targets land below the sticky header. Its height changes with the width, so --pad (the scroll-margin-top
  // of everything in main, see site.css) is measured with the filter row shown, as it is in the catalog.
  // --hdr (its height, plus the filter row while it shows) places the sticky table headings and the mobile drawer under it.
  const head = /** @type {HTMLElement} */ (document.querySelector('header.top')), frow = document.getElementById('filters');
  let padTop = 0;
  // --pad0 is the offset without the filter row, --pad with it; site.css uses --pad where the row shows on arrival.
  const pad = () => {
    const r = document.documentElement.style, d = frow.style.display, h = head.offsetHeight; r.setProperty('--hdr', (frow.offsetHeight ? h + frow.offsetHeight : h) + 'px');
    frow.style.display = 'flex'; const pad0 = h + 14; padTop = h + frow.offsetHeight + 14; frow.style.display = d;
    r.setProperty('--pad0', pad0 + 'px'); r.setProperty('--pad', padTop + 'px');
  };
  const ro = new ResizeObserver(pad); ro.observe(head); ro.observe(frow);
  const below = () => (frow.offsetHeight ? frow : head).getBoundingClientRect().bottom;
  const cardInView = () => [...document.querySelectorAll('article.ex')].some(a => { const r = a.getBoundingClientRect(); return r.height > 0 && r.bottom > below() && r.top < innerHeight; });
  const toFirst = () => {
    const first = document.querySelector('article.ex:not(.hide)'); if (!first) return;
    const top = first.getBoundingClientRect().top; if (top >= below() && top < innerHeight) return;
    pad(); window.scrollBy({ top: top - padTop });
  };
  q.addEventListener('input', () => { const { s, shown } = view(); if (s && shown) toFirst(); });
  // A filter change that leaves no card in view (the catalog shrank above it) scrolls to the first match.
  const segs = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('#filters .seg')]);
  const setSeg = (seg, b) => { seg.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); filt[seg.dataset.f] = b.dataset.v; };
  segs.forEach(seg => setSeg(seg, seg.querySelector('button.on')));
  segs.forEach(seg => seg.addEventListener('click', e => {
    const b = /** @type {HTMLElement} */ (e.target); if (b.tagName !== 'BUTTON') return;
    const saw = cardInView(); setSeg(seg, b); view(); if (saw && !cardInView()) toFirst();
  }));
  view();

  // Mobile menu, reading progress and back to top.
  const menuBtn = document.getElementById('menu-btn'), prog = document.getElementById('progress'), toTop = document.getElementById('totop');
  // Menu and Escape open and close the drawer. Opened from the keyboard, focus moves into it; Escape brings it back.
  const setMenu = open => { nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.onclick = e => { const open = !nav.classList.contains('open'); setMenu(open); if (open && !e.detail) /** @type {HTMLElement} */ (nav.querySelector('a.cur') || nav.querySelector('a')).focus(); };
  document.addEventListener('keydown', e => { if (e.key !== 'Escape' || !nav.classList.contains('open')) return; const back = nav.contains(document.activeElement); setMenu(false); if (back) menuBtn.focus(); });
  toTop.onclick = () => window.scrollTo({ top: 0 });
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false; const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
      prog.style.width = (max > 0 ? h.scrollTop / max * 100 : 0) + '%'; toTop.classList.toggle('show', h.scrollTop > h.clientHeight);
    });
  }, { passive: true });

  // A link to a card, or to a catalog section, clears a search or filter that hides it, and a link to a card opens
  // its folded section first, so the browser can scroll to it. Any in-page link closes the mobile menu.
  const reveal = hash => {
    const el = hash.length > 1 ? document.getElementById(hash.slice(1)) : null; const sec = /** @type {HTMLElement} */ (el && el.closest('section.cat')); if (!sec) return;
    if (el.classList.contains('hide') || sec.style.display === 'none') { q.value = ''; segs.forEach(seg => setSeg(seg, seg.querySelector('button[data-v=""]'))); view(); }
    if (el.classList.contains('fold')) { sec.classList.add('open'); view(); }
  };
  let linkNav = false;
  document.addEventListener('click', e => {
    const t = /** @type {HTMLElement} */ (e.target), a = t.closest('a[href^="#"]');
    if (a) { mark(); reveal(a.getAttribute('href')); linkNav = true; setTimeout(() => { linkNav = false; }); }
    if (nav.classList.contains('open') && (a || (!nav.contains(t) && t !== menuBtn))) setMenu(false);
  }, true);
  window.addEventListener('hashchange', () => reveal(location.hash));

  // Back, Forward and reload return to the element that was under the header, not to the old scroll offset:
  // a section opened since then moves everything below it. Each history entry keeps that [id, top] in its state,
  // saved when a scroll ends and just before a link leaves the entry. A followed link also fires popstate, in the
  // same task as its click (linkNav): that one only reveals, so the browser's smooth scroll runs.
  history.scrollRestoration = 'manual';
  function mark() {
    const y = below(); let m = null, top = 0;
    document.querySelectorAll('section.sec, .part, article.ex').forEach(el => { const r = el.getBoundingClientRect(); if (r.height && r.top <= y) { m = el; top = r.top; } });
    if (m) history.replaceState({ at: [m.id, top] }, '');
  }
  const restore = () => {
    const at = history.state && history.state.at, el = at && document.getElementById(at[0]), t = document.getElementById(location.hash.slice(1));
    if (el && el.getClientRects().length) window.scrollBy({ top: el.getBoundingClientRect().top - at[1], behavior: 'instant' });
    else if (t) t.scrollIntoView({ block: 'start', behavior: 'instant' });
    else if (!location.hash) window.scrollTo({ top: 0, behavior: 'instant' });
  };
  let markT = 0;
  window.addEventListener('scroll', () => { clearTimeout(markT); markT = setTimeout(mark, 150); }, { passive: true });
  window.addEventListener('popstate', () => { reveal(location.hash); if (linkNav) linkNav = false; else restore(); });

  // Current section: sidebar link, chapter tab, header crumb, and the filter row while in the catalog.
  // A chapter banner (.part, data-grp) counts as its chapter, with no current sidebar link.
  // The band can hold the end of one section and the start of the next: all sections in it are kept, and the
  // current one is the lowest of them, so it falls back to the one above when the lower one leaves.
  const crumb = document.getElementById('crumb'), secs = [...document.querySelectorAll('section.sec, .part')], inBand = new Set();
  const secIO = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) inBand.add(e.target); else inBand.delete(e.target); });
    const s = secs.filter(x => inBand.has(x)).pop(); if (!s) return;
    const id = s.id, grp = /** @type {HTMLElement} */ (s).dataset.grp;
    links.forEach(a => { const on = a.getAttribute('href') === '#' + id; a.classList.toggle('cur', on); if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    const a = links.find(l => l.getAttribute('href') === '#' + id), g = grp ? groups.find(x => x.name === grp) : groupOf(id);
    if (crumb && (a || g)) crumb.textContent = 'MOTION STUDIO / ' + (a ? a.firstChild.textContent : g.name).toUpperCase();
    if (!g) return;
    groups.forEach(x => { x.el.classList.toggle('cur', x === g); x.tab.classList.toggle('cur', x === g); if (x === g) x.tab.setAttribute('aria-current', 'location'); else x.tab.removeAttribute('aria-current'); });
    if (tabs.scrollWidth > tabs.clientWidth) tabs.scrollLeft = g.tab.offsetLeft - tabs.offsetLeft - (tabs.clientWidth - g.tab.offsetWidth) / 2;
    document.body.classList.toggle('in-catalog', g.name === 'CATALOG');
  }, { rootMargin: '-45% 0px -50% 0px' });
  secs.forEach(s => secIO.observe(s));

  // Prompt anatomy: hovering a part lights it up in the example prompt.
  const parts = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#anatomy div')), spans = /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#annot span'));
  parts.forEach(p => {
    p.addEventListener('mouseenter', () => { spans.forEach(s => s.classList.toggle('lit', s.dataset.part === p.dataset.part)); p.classList.add('lit'); });
    p.addEventListener('mouseleave', () => { spans.forEach(s => s.classList.remove('lit')); p.classList.remove('lit'); });
  });

  // A reload goes back to its saved spot. Opening a link to a card that is far away: make sure it is visible
  // and outlined, its top below the header.
  if (location.hash.startsWith('#ex-')) reveal(location.hash);
  if (history.state && history.state.at) setTimeout(() => { pad(); restore(); }, 300);
  else if (location.hash.startsWith('#ex-')) { setTimeout(() => { const el = document.querySelector(location.hash); if (el) { pad(); el.scrollIntoView({ block: 'start' }); } }, 300); }
})();
