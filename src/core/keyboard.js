var QH = window.QH || (window.QH = {}); // var: content-script files share one global lexical scope

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

if (typeof module !== 'undefined') module.exports = QH.keys;
