var QH = window.QH || (window.QH = {}); // var: content-script files share one global lexical scope

QH.find = {
  input: null,

  open() {
    const layer = QH.ui.layer('qh-find');
    layer.innerHTML = '<div class="qh-find"><span>/</span><input type="text" spellcheck="false" autocomplete="off"></div>';
    const input = layer.querySelector('input');
    QH.find.input = input;
    input.addEventListener('input', () => QH.find.step(input.value, true));
    QH.mode.set('find');
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
    QH.mode.set('normal');
  },

  key(e, name) {
    if (name === 'Escape') { e.preventDefault(); e.stopPropagation(); return QH.find.close(); }
    if (name === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      QH.find.step(QH.find.input.value, false); // next match, don't rewind
      if (e.shiftKey) return;
      return;
    }
    // everything else types into our own input
  }
};
