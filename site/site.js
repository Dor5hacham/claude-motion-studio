// Page wiring for index.html: builds catalog cards, the technique index, search,
// sidebar counts, the current-section highlight and the prompt-anatomy hover.
(function () {
  EX.build();
  const SECTION = { reel: 'The reel', type: 'Text in motion', mg: '2D motion graphics', ui: 'App and web UI', sim: 'Simulation and generative', gpu: 'GPU shaders', audio: 'Sound and motion', libs: 'Animation libraries', engine: '3D engine', tools: 'Code-to-video tools', edit: 'Editing tricks' };
  const RUNS = { CPU: 'cpu', GPU: 'gpu', WEB: 'web', ENGINE: 'engine' };

  // Sidebar counts and the hub total.
  let total = 0;
  document.querySelectorAll('nav.side a[data-cat]').forEach(a => { const n = EX.cards.filter(c => c.cat === a.dataset.cat).length; total += n; const c = document.createElement('span'); c.className = 'c'; c.textContent = n; a.appendChild(c); });
  const hub = document.getElementById('hub-count'); if (hub) hub.textContent = `${total} techniques, live or as rendered clips, each with a prompt.`;

  // Technique index: learning demos first, then every catalog card.
  const LEARN = [['Easing', 'easing', 'Canvas 2D', 'CPU'], ['Easing race', 'easing', 'Canvas 2D', 'CPU'], ['Stagger', 'stagger', 'Canvas 2D', 'CPU'], ['Squash and stretch', 'vocabulary', 'Canvas 2D', 'CPU'], ['Anticipation and overshoot', 'vocabulary', 'Canvas 2D', 'CPU'],
    ['Timing', 'compare', 'Canvas 2D', 'CPU'], ['Hold', 'compare', 'Canvas 2D', 'CPU'], ['Follow-through and overlap', 'compare', 'Canvas 2D', 'CPU'], ['Secondary motion', 'compare', 'Canvas 2D', 'CPU'], ['Arcs', 'compare', 'Canvas 2D', 'CPU'], ['Rhythm and beat sync', 'compare', 'Canvas 2D + Web Audio', 'CPU'], ['Seamless loop', 'compare', 'Canvas 2D', 'CPU'], ['Parallax (comparison)', 'compare', 'Canvas 2D', 'CPU'],
    ['Frames and frame rate', 'pipeline', 'Canvas 2D', 'CPU'], ['Camera moves (11)', 'camera', 'Canvas 2D 3D projection', 'CPU'], ['Transitions (11)', 'transitions', 'Canvas 2D compositing', 'CPU'], ['Post effects stack', 'post', 'WebGL2 fragment shader', 'GPU'], ['Mood recipes (6)', 'prompting', 'Canvas 2D', 'CPU'], ['Prompt playground', 'words', 'Canvas 2D', 'CPU'], ['Logo reveal, played live', 'examples', 'Canvas 2D', 'CPU']];
  const tb = document.querySelector('#tech-index tbody');
  const row = (name, href, sec, tool, runs, type) => { const tr = document.createElement('tr'); tr.dataset.search = (name + ' ' + sec + ' ' + tool).toLowerCase(); tr.innerHTML = `<td><a href="#${href}">${name}</a></td><td>${sec}</td><td>${tool}</td><td><span class="tag ${RUNS[runs] || 'cpu'}">${runs}</span></td><td class="dim">${type}</td>`; tb.appendChild(tr); };
  LEARN.forEach(([n, h, tool, runs]) => row(n, h, 'Learn', tool, runs, 'live lesson'));
  EX.cards.filter(c => document.getElementById('cat-' + c.cat)).forEach(c => row(c.title, 'ex-' + c.id, SECTION[c.cat] || c.cat, c.tool, c.runs, c.kind === 'video' ? 'rendered clip' : (c.params ? 'live, with sliders' : 'live')));
  const ih = document.querySelector('#index h2'); if (ih) { const s = document.createElement('span'); s.className = 'count'; s.textContent = tb.children.length + ' entries'; ih.appendChild(s); }

  // Search across cards and index rows; hides empty catalog sections.
  const q = document.getElementById('q'), hint = document.getElementById('qhint');
  q.addEventListener('input', () => {
    const s = q.value.trim().toLowerCase(); let shown = 0;
    document.querySelectorAll('article.ex').forEach(a => { const hit = !s || a.dataset.search.includes(s); a.classList.toggle('hide', !hit); if (hit) shown++; });
    document.querySelectorAll('section.cat').forEach(sec => { sec.style.display = s && !sec.querySelector('article.ex:not(.hide)') ? 'none' : ''; });
    tb.querySelectorAll('tr').forEach(tr => tr.classList.toggle('hide', !!s && !tr.dataset.search.includes(s)));
    hint.textContent = s ? `${shown} cards match` : '';
    if (s && shown) { const first = document.querySelector('article.ex:not(.hide)'); if (first && first.getBoundingClientRect().top > window.innerHeight) first.scrollIntoView({ block: 'start' }); }
  });

  // Current section in the sidebar and the header crumb.
  const links = [...document.querySelectorAll('nav.side a')], crumb = document.getElementById('crumb');
  const secIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; const id = e.target.id;
    links.forEach(a => a.classList.toggle('cur', a.getAttribute('href') === '#' + id));
    const a = links.find(l => l.getAttribute('href') === '#' + id); if (a && crumb) crumb.textContent = 'MOTION STUDIO / ' + a.firstChild.textContent.toUpperCase();
  }), { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('section.sec').forEach(s => secIO.observe(s));

  // Prompt anatomy: hovering a part lights it up in the example prompt.
  const parts = document.querySelectorAll('#anatomy div'), spans = document.querySelectorAll('#annot span');
  parts.forEach(p => {
    p.addEventListener('mouseenter', () => { spans.forEach(s => s.classList.toggle('lit', s.dataset.part === p.dataset.part)); p.classList.add('lit'); });
    p.addEventListener('mouseleave', () => { spans.forEach(s => s.classList.remove('lit')); p.classList.remove('lit'); });
  });

  // Opening a link to a card that is far away: make sure it is visible and outlined.
  if (location.hash.startsWith('#ex-')) setTimeout(() => { const el = document.querySelector(location.hash); if (el) el.scrollIntoView({ block: 'center' }); }, 300);
})();
