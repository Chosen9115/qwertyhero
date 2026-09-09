var QH = window.QH || (window.QH = {}); // var: content-script files share one global lexical scope

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
