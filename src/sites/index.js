var QH = window.QH || (window.QH = {}); // var: content-script files share one global lexical scope

// ---- helpers every adapter shares -------------------------------------------------
const CLICKABLE = 'button,[role=button],a[href],[role=menuitem],[role=tab],[role=checkbox],[role=link]';

function nameOf(el) {
  return (el.getAttribute('aria-label') || el.getAttribute('data-tooltip') ||
    el.getAttribute('title') || el.getAttribute('data-testid') || '').trim();
}

// click the first visible control whose accessible name matches
function hit(re, sel = CLICKABLE) {
  const el = QH.dom.deepQueryAll(sel).find(e => {
    if (!QH.dom.visible(e)) return false;
    if (re.test(nameOf(e))) return true;
    const t = (e.textContent || '').trim();
    return t.length > 0 && t.length < 40 && re.test(t);
  });
  if (!el) return false;
  QH.dom.activate(el);
  return true;
}

// click the first visible element matching a raw selector (no name matching)
function click(sel) {
  const el = QH.dom.deepQueryAll(sel).find(QH.dom.visible);
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

function focusEl(sel) {
  const el = QH.dom.deepQueryAll(sel).find(QH.dom.visible);
  if (!el) return false;
  el.focus();
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
      'g i': ['Issues',        () => go(/\/issues(\?|$)/) || miss('issues')],
      'g p': ['Pull requests', () => go(/\/pulls?(\?|$)/) || miss('pull requests')],
      'g a': ['Actions',       () => go(/\/actions(\?|$)/) || miss('actions')],
      'g w': ['Wiki',          () => go(/\/wiki(\?|$)/) || miss('wiki')],
      'g n': ['Notifications', () => go(/^\/notifications/) || (location.assign('/notifications'), true)],
    }
  },

  // MIRROR — Gmail's own g-chords, bound to the same destinations so they work whether or
  // not the user has "keyboard shortcuts on" in settings.
  'mail.google.com': {
    name: 'Gmail', group: 'Mail', yields: '',
    native: { 'j / k': 'Next / previous (if enabled in settings)', 'e': 'Archive', 'r': 'Reply' },
    keys: {
      c:     ['Compose',   () => click('[gh=cm]') || hit(/^compose$/i) || miss('compose')],
      '/':   ['Search',    () => focusEl('input[aria-label*="Search" i],input[name=q]') || miss('search')],
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
      i:     ['Message box', () => focusEl('[data-qa=message_input] [contenteditable=true],[contenteditable=true]') || miss('composer')],
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
      '/':   ['Search',        () => focusEl('input[role=combobox],input[aria-label*="Search" i]') || miss('search')],
    }
  },

  // FILL
  'chatgpt.com': {
    name: 'ChatGPT', group: 'Chat', yields: '',
    native: { 'Ctrl Shift O': 'New chat', 'Ctrl Shift S': 'Toggle sidebar' },
    keys: {
      i: ['Focus prompt',   () => focusEl('#prompt-textarea,textarea,[contenteditable=true]') || miss('prompt')],
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
  registry: REGISTRY,

  current() {
    if (resolved !== undefined) return resolved;
    const host = location.hostname;
    const key = Object.keys(REGISTRY).find(k => host === k || host.endsWith('.' + k) || host.endsWith(k));
    if (!key) return (resolved = null);
    const site = REGISTRY[key];
    const commands = {};
    for (const [k, [desc, run]] of Object.entries(site.keys)) commands[k] = { desc, group: site.group, run };
    return (resolved = {
      name: site.name, group: site.group, commands,
      yields: site.yields || '', native: site.native || {}
    });
  }
};
