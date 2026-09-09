var QH = window.QH || (window.QH = {}); // var: content-script files share one global lexical scope

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
    QH.mode.set('hints');
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
    QH.mode.set('normal');
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

if (typeof module !== 'undefined') module.exports = QH.hints;
