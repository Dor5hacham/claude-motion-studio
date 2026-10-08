// Registers every rendered clip from the generated catalog (catalog/clips.js) as a video card.
// Clips with "audio": true in clips-meta.json get a Sound button; all clips start muted.
(function () {
  (window.CLIPS || []).forEach(c => EX.add({
    cat: c.cat, id: 'clip-' + c.id, kind: 'video', src: 'media/' + c.file,
    title: c.title, aka: c.aka, tool: c.tool, runs: c.runs, notice: c.notice, use: c.use, prompt: c.prompt, audio: !!c.audio,
  }));
})();
