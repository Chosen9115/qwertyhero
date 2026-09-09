// QwertyHero — keyboard-native browsing.
// One file on purpose: content scripts share a single global scope, so splitting this
// across a src/ tree bought directory tidiness and nothing else.

var QH = window.QH || (window.QH = {}); // var: also the module-scope holder under node

// ---- keys — naming, editable, deep focus ---------------------------------------
QH.keys = {
  // "f" | "?" | "Space" | "shift+ArrowUp" — shift stays implicit for printable chars
  name(e) {
    const k = e.key === ' ' ? 'Space' : e.key;
    const mods = [];
    if (e.shiftKey && k.length > 1) mods.push('shift');
    if (e.ctrlKey) mods.push('ctrl');
    if (e.altKey) mods.push('alt');
    if (e.metaKey) mods.push('meta');
    return [...mods, k].join('+');
  },

  editable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT')
      return !/^(button|submit|reset|checkbox|radio|file|image|color|range)$/i.test(el.type || 'text');
    const role = el.getAttribute && el.getAttribute('role');
    return role === 'textbox' || role === 'searchbox' || role === 'combobox';
  },

  deepActive() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return el;
  }
};

// ---- mode ----------------------------------------------------------------------
// normal | hints | spatial | find | help.
// "insert" is never stored — it is derived from what has focus, so it can't drift out of sync.
QH.mode = { current: 'normal' };

// ---- targeting — deep query, visibility, activate, scroller --------------------
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

// ---- ui root — shadow host + all CSS -------------------------------------------
const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }

.qh-bar {
  position: fixed; left: 50%; bottom: 24px;
  transform: translateX(-50%) translateY(6px);
  display: flex; align-items: center; gap: 14px;
  padding: 9px 16px; border-radius: 12px;
  background: rgba(18,18,20,.82); backdrop-filter: blur(18px) saturate(1.4);
  border: 1px solid rgba(255,255,255,.09);
  box-shadow: 0 12px 44px rgba(0,0,0,.38);
  font: 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: rgba(255,255,255,.6); letter-spacing: .02em; white-space: nowrap;
  opacity: 0; transition: opacity .3s ease, transform .3s ease;
}
.qh-bar.on { opacity: 1; transform: translateX(-50%) translateY(0); }
.qh-brand { color: rgba(255,255,255,.32); text-transform: uppercase; letter-spacing: .16em; font-size: 10px; }
.qh-sep { width: 1px; height: 12px; background: rgba(255,255,255,.12); }
.qh-app { color: rgba(255,255,255,.94); }
.qh-cmd { display: inline-flex; align-items: center; gap: 6px; }

kbd {
  display: inline-block; background: rgba(255,255,255,.10); color: rgba(255,255,255,.95);
  border-radius: 4px; padding: 3px 6px; font: inherit; line-height: 1;
}

.qh-hint {
  position: fixed; padding: 2px 4px; border-radius: 3px;
  font: 700 11px/1 ui-monospace, Menlo, monospace; letter-spacing: .06em;
  background: #ffd54a; color: #1a1400; box-shadow: 0 1px 4px rgba(0,0,0,.45);
}
.qh-hint b { opacity: .34; }

/* the dim is its own full-viewport layer: at level 1 the frame fills the screen, so its
   outside-shadow paints off-screen and would dim nothing. The frame's shadow then stacks
   on top of this to darken everything outside the region you've narrowed to. */
.qh-dim { position: fixed; inset: 0; background: rgba(0,0,0,.58); }
.qh-frame { position: fixed; border: 1.5px solid #ffd54a; box-shadow: 0 0 0 9999px rgba(0,0,0,.45); }
.qh-cell {
  position: fixed; display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255,255,255,.16);
  color: #fff; text-transform: uppercase; letter-spacing: .1em;
  font: 600 clamp(15px, 3vh, 40px)/1 ui-monospace, Menlo, monospace;
  text-shadow: 0 2px 10px rgba(0,0,0,.95), 0 0 2px rgba(0,0,0,.9);
}

.qh-find {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
  pointer-events: auto; display: flex; align-items: center; gap: 8px;
  padding: 9px 14px; border-radius: 12px; background: rgba(18,18,20,.92);
  border: 1px solid rgba(255,255,255,.1); backdrop-filter: blur(18px);
  box-shadow: 0 12px 44px rgba(0,0,0,.4);
  font: 13px/1 ui-monospace, Menlo, monospace; color: #fff;
}
.qh-find span { color: rgba(255,255,255,.38); }
.qh-find input { all: unset; width: 300px; color: #fff; caret-color: #ffd54a; font: inherit; }
.qh-find.miss input { color: #ff7a7a; }

.qh-help {
  position: fixed; inset: 0; pointer-events: auto; display: flex;
  align-items: center; justify-content: center;
  background: rgba(8,8,10,.5); backdrop-filter: blur(6px);
}
.qh-sheet {
  max-height: 78vh; overflow: auto; min-width: 440px; padding: 28px 32px 32px;
  border-radius: 16px; background: rgba(20,20,22,.97);
  border: 1px solid rgba(255,255,255,.09); box-shadow: 0 28px 90px rgba(0,0,0,.55);
  color: rgba(255,255,255,.86); font: 13px/1.5 ui-monospace, Menlo, monospace;
}
.qh-sheet h1 { margin: 0 0 4px; font: 500 11px/1 inherit; letter-spacing: .22em; text-transform: uppercase; color: rgba(255,255,255,.42); }
.qh-sheet h2 { margin: 22px 0 8px; font: 500 11px/1 inherit; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.32); }
.qh-row { display: flex; gap: 18px; padding: 3px 0; }
.qh-row i { flex: 0 0 140px; font-style: normal; color: #fff; }
.qh-row em { font-style: normal; color: rgba(255,255,255,.58); }
.qh-foot { margin-top: 22px; color: rgba(255,255,255,.3); font-size: 11px; }
`;

QH.ui = {
  host: null,

  root() {
    if (QH.ui.host && QH.ui.host.isConnected) return QH.ui.host.shadowRoot;
    const host = document.createElement('div');
    host.id = 'qwertyhero-root';
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    const sr = host.attachShadow({ mode: 'open' });
    sr.innerHTML = `<style>${CSS}</style>`;
    (document.body || document.documentElement).appendChild(host);
    QH.ui.host = host;
    return sr;
  },

  layer(id) {
    const sr = QH.ui.root();
    let el = sr.getElementById(id);
    if (!el) { el = document.createElement('div'); el.id = id; sr.appendChild(el); }
    return el;
  },

  clear(id) { QH.ui.layer(id).innerHTML = ''; }
};

// ---- hints ---------------------------------------------------------------------
const CHARS = 'fjdkslaghrueiwoqptyzxcvbnm'; // home row first

QH.hints = {
  active: [],
  typed: '',

  // Vimium-style BFS: prefix-free, and short where it can be. The census says the median
  // page has 33 on-screen targets, so fixed-length labels would cost 2 keystrokes almost
  // everywhere; this gives 1 keystroke to the first 26.
  labels(count, chars = CHARS) {
    if (count < 1) return [];
    const out = [''];
    let offset = 0;
    while (out.length - offset < count || out.length === 1) {
      const stem = out[offset++];
      for (const ch of chars) out.push(stem + ch);
    }
    return out.slice(offset, offset + count);
  },

  show(rect) {
    const els = QH.dom.targets(rect);
    if (!els.length) { QH.bar.flash('nothing actionable here'); return; }
    const labels = QH.hints.labels(els.length);
    QH.hints.active = els.map((el, i) => ({ el, label: labels[i] }));
    QH.hints.typed = '';
    QH.mode.current = 'hints';
    QH.hints.render();
  },

  render() {
    const layer = QH.ui.layer('qh-hints');
    const typed = QH.hints.typed;
    layer.innerHTML = '';
    for (const h of QH.hints.active) {
      if (!h.label.startsWith(typed)) continue;
      const r = h.el.getBoundingClientRect();
      const tag = document.createElement('div');
      tag.className = 'qh-hint';
      // nudged up-left so the label sits beside the target instead of covering its first word
      tag.style.left = Math.max(0, Math.min(innerWidth - 40, r.left - 6)) + 'px';
      tag.style.top = Math.max(0, Math.min(innerHeight - 16, r.top - 8)) + 'px';
      tag.innerHTML = `<b>${typed}</b>${h.label.slice(typed.length)}`;
      layer.appendChild(tag);
    }
  },

  hide() {
    QH.ui.clear('qh-hints');
    QH.hints.active = [];
    QH.hints.typed = '';
    QH.mode.current = 'normal';
  },

  key(e, name) {
    e.preventDefault(); e.stopPropagation();
    if (name === 'Escape') return QH.hints.hide();
    if (name === 'Backspace') { QH.hints.typed = QH.hints.typed.slice(0, -1); return QH.hints.render(); }
    if (name.length !== 1 || !/[a-z]/i.test(name)) return;

    const typed = QH.hints.typed + name.toLowerCase();
    const matches = QH.hints.active.filter(h => h.label.startsWith(typed));
    if (!matches.length) return QH.hints.hide();
    QH.hints.typed = typed;
    if (matches.length === 1) {
      const el = matches[0].el;
      QH.hints.hide();
      QH.dom.activate(el);
      return;
    }
    QH.hints.render();
  }
};

// ---- spatial -------------------------------------------------------------------
QH.spatial = {
  KEYS: ['q', 'w', 'e', 'a', 's', 'd', 'z', 'x', 'c'],
  rect: null,
  stack: [],

  // pure: the 3x3 cell of `rect` addressed by `key`
  subdivide(rect, key) {
    const i = QH.spatial.KEYS.indexOf(key);
    if (i < 0) return null;
    const w = rect.w / 3, h = rect.h / 3;
    return { x: rect.x + (i % 3) * w, y: rect.y + Math.floor(i / 3) * h, w, h };
  },

  start() {
    QH.spatial.stack = [];
    QH.spatial.rect = { x: 0, y: 0, w: innerWidth, h: innerHeight };
    QH.mode.current = 'spatial';
    QH.spatial.render();
  },

  render() {
    const r = QH.spatial.rect;
    const layer = QH.ui.layer('qh-spatial');
    const frame = `<div class="qh-dim"></div>` +
      `<div class="qh-frame" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px"></div>`;
    const cells = QH.spatial.KEYS.map(k => {
      const c = QH.spatial.subdivide(r, k);
      return `<div class="qh-cell" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px">${k}</div>`;
    }).join('');
    layer.innerHTML = frame + cells;
  },

  exit() {
    QH.ui.clear('qh-spatial');
    QH.spatial.rect = null;
    QH.spatial.stack = [];
    QH.mode.current = 'normal';
  },

  activate() {
    const r = QH.spatial.rect;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const inside = QH.dom.targets(r);
    QH.spatial.exit(); // overlay must be gone before elementFromPoint
    if (inside.length) {
      inside.sort((a, b) => dist(a, cx, cy) - dist(b, cx, cy));
      QH.dom.activate(inside[0]);
      return;
    }
    const el = document.elementFromPoint(cx, cy);
    if (el) el.click();
  },

  key(e, name) {
    e.preventDefault(); e.stopPropagation();
    if (name === 'Escape') return QH.spatial.exit();
    if (name === 'Enter') return QH.spatial.activate();
    if (name === 'Backspace') {
      if (!QH.spatial.stack.length) return QH.spatial.exit();
      QH.spatial.rect = QH.spatial.stack.pop();
      return QH.spatial.render();
    }
    if (name === 'f') { // spatial narrows the region, hints pick inside it
      const r = QH.spatial.rect;
      QH.spatial.exit();
      return QH.hints.show(r);
    }
    const next = QH.spatial.subdivide(QH.spatial.rect, name);
    if (!next) return;
    QH.spatial.stack.push(QH.spatial.rect);
    QH.spatial.rect = next;
    QH.spatial.render();
  }
};

function dist(el, cx, cy) {
  const r = el.getBoundingClientRect();
  return Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
}

// ---- find ----------------------------------------------------------------------
QH.find = {
  input: null,

  open() {
    const layer = QH.ui.layer('qh-find');
    layer.innerHTML = '<div class="qh-find"><span>/</span><input type="text" spellcheck="false" autocomplete="off"></div>';
    const input = layer.querySelector('input');
    QH.find.input = input;
    input.addEventListener('input', () => QH.find.step(input.value, true));
    QH.mode.current = 'find';
    input.focus();
  },

  // window.find is non-standard but native everywhere Chromium runs, and it does the
  // scrolling + highlighting for free. fromTop resets the selection so typing stays incremental.
  step(q, fromTop) {
    const box = QH.find.input && QH.find.input.parentElement;
    if (!q) { box && box.classList.remove('miss'); return; }
    if (fromTop) getSelection().removeAllRanges();
    const hit = window.find(q, false, false, true, false, true, false);
    box && box.classList.toggle('miss', !hit);
  },

  close() {
    QH.ui.clear('qh-find');
    QH.find.input = null;
    QH.mode.current = 'normal';
  },

  key(e, name) {
    if (name === 'Escape') { e.preventDefault(); e.stopPropagation(); return QH.find.close(); }
    if (name === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      QH.find.step(QH.find.input.value, false); // next match, don't rewind
      return;
    }
    // everything else types into our own input
  }
};

// ---- bar -----------------------------------------------------------------------
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

// ---- help sheet ----------------------------------------------------------------
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
    QH.mode.current = 'help';
  },

  close() { QH.ui.clear('qh-help'); QH.mode.current = 'normal'; },

  key(e, name) {
    if (name === 'Shift' || name === 'Control' || name === 'Alt' || name === 'Meta') return;
    e.preventDefault(); e.stopPropagation();
    QH.help.close();
  }
};

// ---- site adapters -------------------------------------------------------------
// ---- helpers every adapter shares -------------------------------------------------
const CLICKABLE = 'button,[role=button],a[href],[role=menuitem],[role=tab],[role=checkbox],[role=link]';

function nameOf(el) {
  return (el.getAttribute('aria-label') || el.getAttribute('data-tooltip') ||
    el.getAttribute('title') || el.getAttribute('data-testid') || '').trim();
}

// Activate the first visible element matching `sel`; with `re`, its accessible name must
// match too. activate() focuses editables and clicks everything else, so this covers
// "click that button", "click this exact selector" and "put the cursor in the composer".
function hit(re, sel = CLICKABLE) {
  const el = QH.dom.deepQueryAll(sel).find(e => {
    if (!QH.dom.visible(e)) return false;
    if (!re) return true;
    if (re.test(nameOf(e))) return true;
    const t = (e.textContent || '').trim();
    return t.length > 0 && t.length < 40 && re.test(t);
  });
  if (!el) return false;
  QH.dom.activate(el);
  return true;
}

function go(hrefRe) {
  const el = QH.dom.deepQueryAll('a[href]').find(a => hrefRe.test(a.getAttribute('href') || ''));
  if (!el) return false;
  el.click();
  return true;
}

function miss(what) { QH.bar.flash(`couldn't find ${what}`); return true; }

// ---- the three ways an adapter can relate to a site --------------------------------
// mirror  the site already binds this key to this action -> bind the same thing, so it works
//         whether or not the site's own shortcuts are enabled. A collision becomes redundancy.
// yield   the site binds this key to something better -> hand the key back, document it.
// fill    nothing is bound -> this is where an adapter actually earns its keep.
//
// `yields` lists universal keys we give up. `native` is documentation only, for Shift+?.
const REGISTRY = {
  // FILL — Meet's only shortcuts are undiscoverable ctrl-chords
  'meet.google.com': {
    name: 'Meet', group: 'Meeting', yields: '',
    native: { 'Ctrl D': 'Mic', 'Ctrl E': 'Camera', 'Ctrl Alt H': 'Raise hand' },
    keys: {
      // the ':' guard matters: Meet ships a "Microphone: Default" device picker that sits
      // before the real toggle in document order and would swallow every press.
      m: ['Microphone',   () => hit(/^(?!.*(:|settings)).*(turn (on|off).*)?(microphone|mikrofon|micr[oó]fono)/i) || miss('mic')],
      v: ['Camera',       () => hit(/^(?!.*(:|settings)).*(camera|kamera|c[aá]mara)/i) || miss('camera')],
      c: ['Chat',         () => hit(/chat with everyone|^chat$/i) || miss('chat')],
      p: ['Participants', () => hit(/people|participants|show everyone/i) || miss('participants')],
      s: ['Share screen', () => hit(/present now|share screen|presentar/i) || miss('share')],
      r: ['Raise hand',   () => hit(/raise hand|lower hand/i) || miss('hand')],
      // Shift, deliberately: a stray 'h' next to 'g' should never drop you out of a live call
      H: ['Leave call',   () => hit(/leave call|hang up|end call/i) || miss('leave')],
    }
  },

  // YIELD — measured live at document level: f i k m. Our `f` would break fullscreen.
  'youtube.com': {
    name: 'YouTube', group: 'Player', yields: 'f',
    native: { 'k / Space': 'Play / pause', 'm': 'Mute', 'f': 'Fullscreen', 't': 'Theater',
              'j / l': 'Back / forward 10s', 'i': 'Miniplayer', 'c': 'Captions' },
    keys: {
      'g h': ['Home',          () => go(/^\/$|youtube\.com\/?$/) || miss('home')],
      'g s': ['Subscriptions', () => go(/\/feed\/subscriptions/) || miss('subscriptions')],
      'g l': ['Library',       () => go(/\/feed\/(library|you)/) || miss('library')],
      'g n': ['Notifications', () => hit(/notifications/i) || miss('notifications')],
    }
  },

  // MIRROR — GitHub publishes its keymap in data-hotkey; we bind the same targets so they
  // work even when a page hasn't wired them. `/` is theirs: repo search beats page find here.
  'github.com': {
    name: 'GitHub', group: 'Repo', yields: '/',
    native: { '/ or s': 'Search this repo', 'j / k': 'Move selection', 't': 'File finder', 'y': 'Permalink' },
    keys: {
      'g c': ['Code',          () => go(/^\/[^/]+\/[^/]+\/?$/) || miss('code')],
      'g i': ['Issues',        () => go(/^\/[^/]+\/[^/]+\/issues(\?|$)/) || miss('issues')],
      'g p': ['Pull requests', () => go(/^\/[^/]+\/[^/]+\/pulls?(\?|$)/) || miss('pull requests')],
      'g a': ['Actions',       () => go(/^\/[^/]+\/[^/]+\/actions(\?|$)/) || miss('actions')],
      'g w': ['Wiki',          () => go(/^\/[^/]+\/[^/]+\/wiki(\?|$)/) || miss('wiki')],
      'g n': ['Notifications', () => go(/^\/notifications/) || (location.assign('/notifications'), true)],
    }
  },

  // MIRROR — Gmail's own g-chords, bound to the same destinations so they work whether or
  // not the user has "keyboard shortcuts on" in settings.
  'mail.google.com': {
    name: 'Gmail', group: 'Mail', yields: '',
    native: { 'j / k': 'Next / previous (if enabled in settings)', 'e': 'Archive', 'r': 'Reply' },
    keys: {
      c:     ['Compose',   () => hit(null, '[gh=cm]') || hit(/^compose$/i) || miss('compose')],
      '/':   ['Search',    () => hit(null, 'input[aria-label*="Search" i],input[name=q]') || miss('search')],
      'g i': ['Inbox',     () => go(/#inbox$/) || miss('inbox')],
      'g s': ['Starred',   () => go(/#starred$/) || miss('starred')],
      'g t': ['Sent',      () => go(/#sent$/) || miss('sent')],
      'g d': ['Drafts',    () => go(/#drafts$/) || miss('drafts')],
    }
  },

  // MIRROR — Calendar's native t/n/p/d/w/m, same actions
  'calendar.google.com': {
    name: 'Calendar', group: 'Calendar', yields: '',
    native: { 'd / w / m': 'Day / week / month view (if enabled)' },
    keys: {
      c: ['Create',   () => hit(/^create$/i) || miss('create')],
      t: ['Today',    () => hit(/^today$/i) || miss('today')],
      n: ['Next',     () => hit(/next (day|week|month|period)/i) || miss('next')],
      p: ['Previous', () => hit(/previous (day|week|month|period)/i) || miss('previous')],
    }
  },

  // YIELD — the doc surface owns the keyboard the moment you focus it, which our
  // never-steal-typing rule already respects. Only the chrome around it is ours.
  'docs.google.com': {
    name: 'Docs', group: 'Document', yields: '',
    native: { 'Ctrl + …': 'Docs owns every editing chord while the cursor is in the document' },
    keys: {
      s: ['Share',    () => hit(/^share$/i) || miss('share')],
      o: ['Outline',  () => hit(/document outline|show outline/i) || miss('outline')],
    }
  },

  // FILL, but only where it works: i / '/' / g h verified in a live workspace. Threads,
  // DMs and Activity sit behind the "More…" tab — two clicks, and Slack already binds them.
  'slack.com': {
    name: 'Slack', group: 'Workspace', yields: '',
    native: { 'Ctrl K': 'Quick switcher', 'Ctrl Shift T': 'Threads',
              'Ctrl Shift K': 'DMs', 'Ctrl Shift A': 'Activity', 'Ctrl /': 'Slack’s own sheet' },
    keys: {
      i:     ['Message box', () => hit(null, '[data-qa=message_input] [contenteditable=true],[contenteditable=true]') || miss('composer')],
      '/':   ['Search',      () => hit(/search|jump to/i) || miss('search')],
      'g h': ['Home',        () => hit(/^home$/i) || miss('home')],
    }
  },

  // FILL
  'notion.so': {
    name: 'Notion', group: 'Workspace', yields: '',
    native: { 'Ctrl P': 'Search', 'Ctrl \\': 'Toggle sidebar' },
    keys: {
      '/':   ['Search',   () => hit(/^search$/i) || miss('search')],
      n:     ['New page', () => hit(/new page/i) || miss('new page')],
      'g u': ['Back',     () => (history.back(), true)],
    }
  },

  // FILL — LinkedIn has no keyboard layer at all
  'linkedin.com': {
    name: 'LinkedIn', group: 'Feed', yields: '',
    keys: {
      'g h': ['Home',          () => go(/^\/feed/) || miss('home')],
      'g m': ['Messaging',     () => go(/^\/messaging/) || miss('messaging')],
      'g n': ['Notifications', () => go(/^\/notifications/) || miss('notifications')],
      'g j': ['Jobs',          () => go(/^\/jobs/) || miss('jobs')],
      '/':   ['Search',        () => hit(null, 'input[role=combobox],input[aria-label*="Search" i]') || miss('search')],
    }
  },

  // FILL
  'chatgpt.com': {
    name: 'ChatGPT', group: 'Chat', yields: '',
    native: { 'Ctrl Shift O': 'New chat', 'Ctrl Shift S': 'Toggle sidebar' },
    keys: {
      i: ['Focus prompt',   () => hit(null, '#prompt-textarea,textarea,[contenteditable=true]') || miss('prompt')],
      n: ['New chat',       () => hit(/new chat/i) || miss('new chat')],
      s: ['Toggle sidebar', () => hit(/close sidebar|open sidebar/i) || miss('sidebar')],
      r: ['Regenerate',     () => hit(/regenerate|try again/i) || miss('regenerate (needs a reply on screen)')],
    }
  },

  // ADOPT — X already has the most complete keyboard layer on the web. We take nothing
  // but `/`, and the help sheet just tells you what X already does.
  'x.com': {
    name: 'X', group: 'Timeline', yields: '/',
    native: { 'j / k': 'Next / previous post', 'g h': 'Home', 'g n': 'Notifications',
              'g m': 'Messages', 'n': 'New post', 'l': 'Like', 'r': 'Reply', '?': 'X’s own sheet' },
    keys: {}
  },
};

let resolved;

QH.sites = {
  current() {
    if (resolved !== undefined) return resolved;
    const host = location.hostname;
    const key = Object.keys(REGISTRY).find(k => host === k || host.endsWith('.' + k));
    if (!key) return (resolved = null);
    const site = REGISTRY[key];
    const commands = {};
    for (const [k, [desc, run]] of Object.entries(site.keys)) commands[k] = { desc, run };
    return (resolved = {
      name: site.name, group: site.group, commands,
      yields: site.yields || '', native: site.native || {}
    });
  }
};

// ---- commands — the universal keymap -------------------------------------------
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

// ---- dispatcher — keypress -> command -> target/action -------------------------
let pending = '', pendingTimer = 0;
const clearPending = () => { pending = ''; clearTimeout(pendingTimer); };

// keypress -> command -> target/action. Nothing below this line touches the DOM directly.
function onKeyDown(e) {
  if (e.isComposing || e.defaultPrevented) return;
  const name = QH.keys.name(e);

  // an open overlay owns the keyboard
  switch (QH.mode.current) {
    case 'hints':   return QH.hints.key(e, name);
    case 'spatial': return QH.spatial.key(e, name);
    case 'find':    return QH.find.key(e, name);
    case 'help':    return QH.help.key(e, name);
  }

  // Esc always returns you to QwertyHero mode
  if (name === 'Escape') {
    clearPending();
    const el = QH.keys.deepActive();
    if (QH.keys.editable(el) && el.blur) { el.blur(); e.preventDefault(); }
    QH.bar.flash();
    return;
  }

  if (QH.keys.editable(QH.keys.deepActive())) return; // never steal input while typing
  if (e.ctrlKey || e.altKey || e.metaKey) return;     // leave browser + app chords alone

  const full = pending ? pending + ' ' + name : name;
  clearPending();

  const cmd = QH.commands.lookup(full);
  if (!cmd) {
    // 'g' on its own isn't a command, it's the first half of one — wait for the second key
    if (full === name && QH.commands.isPrefix(name)) {
      pending = name;
      pendingTimer = setTimeout(clearPending, 1200);
      QH.bar.show(null, [[name, '…']], 1300);
      e.preventDefault(); e.stopPropagation();
    }
    return;
  }
  if (cmd.run(e) === false) return;                   // command deferred to the browser default
  e.preventDefault();
  e.stopPropagation();
}

if (typeof document !== 'undefined') {
  window.addEventListener('keydown', onKeyDown, true);
  if (QH.sites.current()) QH.bar.flash();   // entering a supported app: say so, briefly
}

if (typeof module !== 'undefined') module.exports = QH;
