var QH = window.QH || (window.QH = {}); // var: content-script files share one global lexical scope

const STEP = 64;

// returns false when the browser's own default is already correct — then we don't preventDefault
function arrow(dx, dy) {
  const el = QH.dom.scroller();
  if (QH.dom.isPage(el)) return false;
  el.scrollBy({ left: dx, top: dy, behavior: 'instant' });
}

function page(dy, dx) {
  const el = QH.dom.scroller();
  const h = QH.dom.isPage(el) ? innerHeight : el.clientHeight;
  const w = QH.dom.isPage(el) ? innerWidth : el.clientWidth;
  el.scrollBy({ top: dy * h * 0.9, left: dx * w * 0.85, behavior: 'instant' });
}

QH.commands = {
  universal: {
    'ArrowUp':          { group: 'Scroll', desc: 'Scroll up',    display: '↑', run: () => arrow(0, -STEP) },
    'ArrowDown':        { group: 'Scroll', desc: 'Scroll down',  display: '↓', run: () => arrow(0, STEP) },
    'ArrowLeft':        { group: 'Scroll', desc: 'Scroll left',  display: '←', run: () => arrow(-STEP, 0) },
    'ArrowRight':       { group: 'Scroll', desc: 'Scroll right', display: '→', run: () => arrow(STEP, 0) },
    'shift+ArrowUp':    { group: 'Scroll', desc: 'Page up',           display: 'Shift ↑', run: () => page(-1, 0) },
    'shift+ArrowDown':  { group: 'Scroll', desc: 'Page down',         display: 'Shift ↓', run: () => page(1, 0) },
    'shift+ArrowLeft':  { group: 'Scroll', desc: 'Large scroll left', display: 'Shift ←', run: () => page(0, -1) },
    'shift+ArrowRight': { group: 'Scroll', desc: 'Large scroll right',display: 'Shift →', run: () => page(0, 1) },

    'g g':   { group: 'Scroll', desc: 'Top of page',    run: () => QH.dom.scroller().scrollTo({ top: 0 }) },
    'G':     { group: 'Scroll', desc: 'Bottom of page', display: 'Shift G',
               run: () => { const el = QH.dom.scroller(); el.scrollTo({ top: el.scrollHeight }); } },

    'f':     { group: 'Universal', desc: 'Target interactive elements', run: () => QH.hints.show() },
    '/':     { group: 'Universal', desc: 'Find on page',                run: () => QH.find.open() },
    // ';' not Space: Space is page-down on every scrollable page and play/pause on every
    // player — measured as the single most contested key on the web. Add 'Space' to this
    // list if you want the spec'd binding back.
    ';':     { group: 'Universal', desc: 'Spatial mode',      run: () => QH.spatial.start() },
    '?':     { group: 'Universal', desc: 'Show all commands', display: 'Shift ?', run: () => QH.help.toggle() }
  },

  // site commands augment the universal set; they win on a collision, nothing is removed.
  // `yields` is the other half: keys the site itself already binds well, which we hand back.
  lookup(name) {
    const site = QH.sites.current();
    if (site && site.commands[name]) return site.commands[name];
    if (site && site.yields.includes(name)) return null;
    return QH.commands.universal[name] || null;
  },

  // is `name` the first half of a chord like 'g i'?
  isPrefix(name) {
    if (name.length !== 1) return false;
    const site = QH.sites.current();
    const all = Object.keys(QH.commands.universal).concat(site ? Object.keys(site.commands) : []);
    return all.some(k => k.startsWith(name + ' '));
  }
};
