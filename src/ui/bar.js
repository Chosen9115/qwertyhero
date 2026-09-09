var QH = window.QH || (window.QH = {}); // var: content-script files share one global lexical scope

QH.bar = {
  timer: 0,

  // items: [[key, label], ...]
  show(app, items, ttl = 2600) {
    const layer = QH.ui.layer('qh-bar');
    const cmds = items.map(([k, label]) => `<span class="qh-cmd"><kbd>${k}</kbd>${label}</span>`).join('');
    layer.innerHTML =
      `<div class="qh-bar"><span class="qh-brand">QwertyHero</span>` +
      (app ? `<span class="qh-sep"></span><span class="qh-app">${app}</span>` : '') +
      `<span class="qh-sep"></span>${cmds}<span class="qh-sep"></span><span class="qh-cmd"><kbd>?</kbd></span></div>`;

    const bar = layer.firstElementChild;
    requestAnimationFrame(() => bar.classList.add('on'));
    clearTimeout(QH.bar.timer);
    QH.bar.timer = setTimeout(() => {
      bar.classList.remove('on');
      setTimeout(() => { if (!bar.classList.contains('on')) layer.innerHTML = ''; }, 400);
    }, ttl);
  },

  // brief context ping: what mode am I in, what can I press
  flash(msg) {
    const site = QH.sites.current();
    if (msg) return QH.bar.show(site && site.name, [['', msg]], 1800);
    const items = site
      ? Object.entries(site.commands)
          .sort((a, b) => a[0].length - b[0].length)   // keys you can press right now, before chords
          .slice(0, 4).map(([k, c]) => [k, c.desc])
      : [['f', 'target'], ['/', 'find'], [';', 'spatial']];
    QH.bar.show(site && site.name, items);
  }
};
