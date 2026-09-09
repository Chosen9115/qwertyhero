var QH = window.QH;

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

  if (QH.mode.typing()) return;                       // never steal input while typing
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

window.addEventListener('keydown', onKeyDown, true);

// entering a supported app: say so, briefly
if (QH.sites.current()) QH.bar.flash();
