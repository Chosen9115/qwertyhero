# QwertyHero

Keyboard-native browsing. Three layers, each a fallback for the one above:

```
1. KNOWN APPLICATION   m  ->  toggleMicrophone
2. KNOWN DOM           f  ->  [a] [s] [d]
3. KNOW NOTHING        ;  ->  Q W E / A S D / Z X C  (recursive)
```

`Shift+?` always tells you exactly what the keyboard can do right here — including the
keys the *site* binds, read live out of its own `data-hotkey` / `accesskey` attributes.

## Install

`chrome://extensions` -> Developer mode -> Load unpacked -> this folder. No build step.

## The keymap

### Universal — every page

```
↑ ↓ ← →          Scroll
Shift + ↑ ↓      Page up / down
Shift + ← →      Large horizontal scroll
g g              Top of page
Shift + G        Bottom of page
f                Target interactive elements
/                Find on page
;                Spatial mode
Esc              Back to QwertyHero mode
Shift + ?        Every command, in context
```

Plain arrows fall through to the browser when the page itself scrolls; they're only
intercepted when the real scroller is an inner container. 13 of 29 sites measured have
inner scrollers and 8 of 29 don't scroll the document at all, so this matters.

QwertyHero never fires while you're typing — focus in any input, textarea,
contenteditable or `role=textbox` hands the keyboard back completely. `Esc` blurs.

### Spatial — `;`

```
q w e / a s d / z x c   Narrow to that ninth, recursively
f                       Hints, but only inside the region
Enter                   Activate the nearest actionable element, or click the point
Backspace               Zoom back out one level
Esc                     Exit
```

`; e a x` is 1/729 of the viewport. Measured live: 1440x900 -> 480x300 -> 160x100 -> 53x33.

### Goto layer — `g` + letter

`g` is the one convention the web already agrees on: GitHub publishes `g c` / `g i` /
`g p` in `data-hotkey`, and Gmail, Slack, Linear and X all use the same shape. QwertyHero
adopts it rather than competing with it, and fills it in on the sites that lack it.

```
g h   home / feed        g n   notifications      g m   messages
g i   inbox / issues     g p   pull requests      g d   drafts / DMs
```

Where a site already has its own `g`-chord, ours points at the same place. Where the
site's noun differs (Gmail `g t` = sent, Slack `g t` = threads), the site wins —
mirroring the app you're in beats cross-site tidiness.

## Why `;` and not `Space`

Space is the most contested key on the web: page-down on every scrollable page,
play/pause on every video player. Taking it for spatial mode costs more than it buys.
`;` is home row, right hand, and was bound by none of the 29 sites measured.

To go back to the spec'd binding, add `'Space'` next to `';'` in `src/core/commands.js`.

## How adapters relate to a site

Measured, not assumed — every plain letter was pressed on each site and the page diffed:

| Site | Live plain letters | What QwertyHero does |
|---|---|---|
| YouTube | `f i k m` (document-level) | **yields** `f` — fullscreen is theirs |
| GitHub | `/ j k s t w y` | **yields** `/`, **mirrors** the `g` chords |
| Twitch | none globally (player-focus scoped) | nothing to yield |
| Wikipedia | none (`accesskey` is alt-modified) | reads its accesskeys into `Shift+?` |
| Hacker News, Google | none | universal layer only |

Which gives three honest categories:

- **mirror** — the site binds this key to this action already. Bind the same thing, so it
  works whether or not the site's shortcuts are switched on. A collision becomes redundancy.
- **yield** — the site's meaning for the key is better than ours. Hand it back, document it.
- **fill** — nothing is bound. This is where an adapter actually earns its keep: Meet,
  Slack, LinkedIn, Notion.

Meet is the clearest **fill**: its only shortcuts are undiscoverable ctrl-chords.

```
m mic   v camera   c chat   p participants   s share   r raise hand   Shift+H leave
```

`Shift+H` for leave, not `h`: a stray keystroke next to `g` should never drop you out of a
live call. Meet's own chords (`Ctrl D`, `Ctrl E`, `Ctrl Alt H`) show up in `Shift+?` too.

## Adapter verification status

Resolved read-only against live, signed-in apps — every action matched to an element,
nothing clicked.

| App | Resolved | Notes |
|---|---|---|
| Gmail | **7/7** | `c` `/` and all four `g` chords hit real targets |
| Calendar | **4/4** | create / today / next / previous |
| GitHub | **5/6** | `g n` had no link on a repo page -> navigates to `/notifications` directly |
| ChatGPT | **3/4** | `r` regenerate only exists once a reply is on screen |
| Slack | **3/6** | `i` `/` `g h` verified in a real workspace; threads/DMs/activity sit behind "More…", so they're documented as Slack's own ctrl-chords instead of faked |
| Meet | **7/7** | verified in a live call. First pass looked like 7/7 but `m` was matching the `Microphone: Default` **device picker**, not the mute toggle — the regex now excludes labels containing `:` or `settings` |
| LinkedIn, Notion | — | profile wasn't signed in; still unverified |

A miss is loud, not silent: the bar says `couldn't find chat` rather than doing nothing.

## Test

`node test/selftest.js` — key naming, the never-steal-typing predicate, prefix-free hint
label generation, spatial subdivision math.

## Layout

```
manifest.json       MV3, no permissions, no host_permissions
src/qwertyhero.js   the whole extension
test/selftest.js    node test/selftest.js
```

One file on purpose. Content scripts share a single global scope, so a `src/` tree of
twelve modules bought directory tidiness and nothing else — each file paid a header line
to re-declare the same `QH` global that was already shared. Sections are banner-commented
in load order: keys, mode, targeting, ui root, hints, spatial, find, bar, help, sites,
commands, dispatcher.
