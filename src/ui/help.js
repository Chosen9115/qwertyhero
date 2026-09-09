var QH = window.QH || (window.QH = {}); // var: content-script files share one global lexical scope

QH.help = {
  toggle() { QH.mode.current === 'help' ? QH.help.close() : QH.help.open(); },

  open() {
    const site = QH.sites.current();
    const groups = new Map();
    const add = (group, key, desc) => {
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push([key, desc]);
    };

    if (site) for (const [k, c] of Object.entries(site.commands)) add(site.group || site.name, k.toUpperCase(), c.desc);
    for (const [k, c] of Object.entries(QH.commands.universal)) {
      if (site && site.yields.includes(k)) continue;   // we handed this one back
      add(c.group, c.display || k, c.desc);
    }
    add('Universal', 'Esc', 'Back to QwertyHero mode');

    // what the page itself binds — GitHub and every Primer app publish data-hotkey,
    // MediaWiki publishes accesskey. Free truth, no adapter needed.
    for (const [k, d] of Object.entries((site && site.native) || {})) add('This site’s own keys', k, d);
    const seen = new Set();
    for (const el of QH.dom.deepQueryAll('[data-hotkey],[accesskey]')) {
      const k = el.getAttribute('data-hotkey') || 'Alt ' + el.getAttribute('accesskey');
      const d = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 44);
      if (!d || seen.has(k)) continue;
      seen.add(k);
      add('This site’s own keys', k, d);
    }

    const html = [...groups].map(([g, rows]) =>
      `<h2>${g}</h2>` + rows.map(([k, d]) => `<div class="qh-row"><i>${k}</i><em>${d}</em></div>`).join('')
    ).join('');

    QH.ui.layer('qh-help').innerHTML =
      `<div class="qh-help"><div class="qh-sheet"><h1>${site ? site.name : 'QwertyHero'}</h1>${html}` +
      `<div class="qh-foot">Any key closes. Site commands augment the universal set — they never replace it.</div></div></div>`;
    QH.mode.set('help');
  },

  close() { QH.ui.clear('qh-help'); QH.mode.set('normal'); },

  key(e, name) {
    if (name === 'Shift' || name === 'Control' || name === 'Alt' || name === 'Meta') return;
    e.preventDefault(); e.stopPropagation();
    QH.help.close();
  }
};
