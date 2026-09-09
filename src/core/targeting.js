var QH = window.QH || (window.QH = {}); // var: content-script files share one global lexical scope

const INTERACTIVE = [
  'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea', 'summary', 'label[for]',
  '[role=button]', '[role=link]', '[role=checkbox]', '[role=switch]', '[role=radio]', '[role=tab]',
  '[role=menuitem]', '[role=menuitemcheckbox]', '[role=menuitemradio]', '[role=option]',
  '[role=combobox]', '[role=textbox]', '[role=searchbox]', '[role=slider]', '[role=treeitem]',
  '[contenteditable=""]', '[contenteditable=true]', '[onclick]', '[tabindex]:not([tabindex="-1"])',
  'video', 'audio'
].join(',');

QH.dom = {
  // ponytail: walks every element looking for shadow roots — O(n) per call. Only runs on `f`
  // or a site action, so it's fine; swap for a cached TreeWalker if a huge page ever feels slow.
  deepQueryAll(sel, root = document) {
    const out = [...root.querySelectorAll(sel)];
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot && el.id !== 'qwertyhero-root') out.push(...QH.dom.deepQueryAll(sel, el.shadowRoot));
    }
    return out;
  },

  visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    return el.checkVisibility
      ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })
      : true;
  },

  // interactive elements currently on screen, optionally clipped to a viewport rect
  targets(rect) {
    return QH.dom.deepQueryAll(INTERACTIVE).filter(el => {
      if (el.disabled || el.getAttribute('aria-hidden') === 'true') return false;
      if (!QH.dom.visible(el)) return false;
      if (!rect) return true;
      const r = el.getBoundingClientRect();
      return centerIn(r, rect);
    });
  },

  activate(el) {
    if (QH.keys.editable(el)) { el.focus(); return; }
    if (el.focus) el.focus({ preventScroll: true });
    el.click();
  },

  // the thing that should actually scroll: focused container > the page > biggest inner scroller
  scroller() {
    const near = ancestorScroller(QH.keys.deepActive());
    if (near) return near;
    const doc = document.scrollingElement || document.documentElement;
    if (doc.scrollHeight > innerHeight + 2) return doc;
    if (Date.now() - cachedAt < 1000 && cached && cached.isConnected) return cached;
    cached = biggest() || doc;
    cachedAt = Date.now();
    return cached;
  },

  isPage(el) { return el === (document.scrollingElement || document.documentElement); }
};

let cached = null, cachedAt = 0;

function centerIn(r, box) {
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  return cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h;
}

function scrollable(el) {
  if (!el || el.nodeType !== 1) return false;
  const s = getComputedStyle(el);
  return /(auto|scroll|overlay)/.test(s.overflowY + ' ' + s.overflowX) &&
    (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2);
}

function ancestorScroller(el) {
  for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement || (el.getRootNode() || {}).host) {
    if (scrollable(el)) return el;
  }
  return null;
}

function biggest() {
  let best = null, bestArea = innerWidth * innerHeight * 0.2;
  for (const el of document.querySelectorAll('div,main,section,ul,ol,[role=main],[role=feed],[role=log]')) {
    if (!scrollable(el)) continue;
    const r = el.getBoundingClientRect(), a = r.width * r.height;
    if (a > bestArea) { best = el; bestArea = a; }
  }
  return best;
}
