var QH = window.QH || (window.QH = {}); // var: content-script files share one global lexical scope

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
    QH.mode.set('spatial');
    QH.spatial.render();
  },

  render() {
    const r = QH.spatial.rect;
    const layer = QH.ui.layer('qh-spatial');
    const frame = `<div class="qh-dim"></div>` +
      `<div class="qh-frame" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px"></div>`;
    const cells = QH.spatial.KEYS.map((k, i) => {
      const c = QH.spatial.subdivide(r, k);
      return `<div class="qh-cell" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px">${k}</div>`;
    }).join('');
    layer.innerHTML = frame + cells;
  },

  exit() {
    QH.ui.clear('qh-spatial');
    QH.spatial.rect = null;
    QH.spatial.stack = [];
    QH.mode.set('normal');
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

if (typeof module !== 'undefined') module.exports = QH.spatial;
