var QH = window.QH || (window.QH = {}); // var: content-script files share one global lexical scope

// normal | hints | spatial | find | help.
// "insert" is never stored — it is derived from what has focus, so it can't drift out of sync.
QH.mode = {
  current: 'normal',
  set(m) { QH.mode.current = m; },
  typing() { return QH.keys.editable(QH.keys.deepActive()); },
  label() { return QH.mode.current === 'normal' ? (QH.mode.typing() ? 'insert' : 'normal') : QH.mode.current; }
};
