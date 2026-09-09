// node test/selftest.js — the branchy bits only: key naming, hint labels, spatial math.
const assert = require('assert');
global.window = global;

const { keys, hints, spatial } = require('../src/qwertyhero.js');

// --- key naming: shift is implicit for printable chars, explicit for named keys
assert.equal(keys.name({ key: 'f' }), 'f');
assert.equal(keys.name({ key: '?', shiftKey: true }), '?');
assert.equal(keys.name({ key: ' ' }), 'Space');
assert.equal(keys.name({ key: 'ArrowUp', shiftKey: true }), 'shift+ArrowUp');
assert.equal(keys.name({ key: 'ArrowUp' }), 'ArrowUp');
assert.equal(keys.name({ key: 'k', ctrlKey: true }), 'ctrl+k');

// --- typing detection: we must never steal keys from these
const el = (tagName, extra = {}) => ({ tagName, getAttribute: () => null, ...extra });
assert.equal(keys.editable(el('INPUT', { type: 'text' })), true);
assert.equal(keys.editable(el('INPUT', { type: 'checkbox' })), false);
assert.equal(keys.editable(el('TEXTAREA')), true);
assert.equal(keys.editable(el('DIV', { isContentEditable: true })), true);
assert.equal(keys.editable(el('DIV')), false);
assert.equal(keys.editable({ tagName: 'DIV', getAttribute: (a) => (a === 'role' ? 'textbox' : null) }), true);
assert.equal(keys.editable(null), false);

// --- hint labels: unique, fixed length, long enough to address every target
for (const n of [1, 9, 26, 27, 300, 700]) {
  const l = hints.labels(n);
  assert.equal(l.length, n);
  assert.equal(new Set(l).size, n, `labels collide at n=${n}`);
}
// prefix-free is load-bearing: "one match left" only means "done" if no label extends another
for (const n of [9, 27, 300]) {
  const l = hints.labels(n);
  for (const a of l) for (const b of l) assert.ok(a === b || !b.startsWith(a), `${a} prefixes ${b}`);
}
assert.ok(hints.labels(26).every(s => s.length === 1), 'first 26 targets should be one keystroke');
assert.equal(hints.labels(1).length, 1);

// --- spatial subdivision: QWE/ASD/ZXC laid over the rect, recursively
const vp = { x: 0, y: 0, w: 900, h: 900 };
assert.deepEqual(spatial.subdivide(vp, 'q'), { x: 0, y: 0, w: 300, h: 300 });
assert.deepEqual(spatial.subdivide(vp, 'e'), { x: 600, y: 0, w: 300, h: 300 });
assert.deepEqual(spatial.subdivide(vp, 'a'), { x: 0, y: 300, w: 300, h: 300 });
assert.deepEqual(spatial.subdivide(vp, 'c'), { x: 600, y: 600, w: 300, h: 300 });
assert.equal(spatial.subdivide(vp, 'j'), null);

const ea = spatial.subdivide(spatial.subdivide(vp, 'e'), 'a');       // Space E A
assert.deepEqual(ea, { x: 600, y: 100, w: 100, h: 100 });
assert.equal((ea.w * ea.h) / (vp.w * vp.h), 1 / 81);

const eax = spatial.subdivide(ea, 'x');                              // Space E A X
assert.ok(Math.abs((eax.w * eax.h) / (vp.w * vp.h) - 1 / 729) < 1e-12);
assert.ok(eax.x >= ea.x && eax.x + eax.w <= ea.x + ea.w);            // stays inside its parent

console.log('ok');
