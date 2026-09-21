/* Node check for what a press on a Plan My Day row turns into.

   The whole row is the drag handle now, which puts it in direct competition
   with scrolling the page: on a phone, "drag this row down" and "scroll the
   list down" are the same gesture, and at the moment the finger lands there is
   nothing to tell them apart. So the row waits - for a hold on a finger, for a
   few pixels on a mouse, for nothing at all on the grip.

   Get that wrong in either direction and the page is broken in a way no
   assertion in the app would catch: too eager and the plan cannot be scrolled
   on a phone at all, too shy and rows cannot be picked up.

   Run: node test/plan-drag.test.js */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');

function grab(name) {
  const m = src.match(new RegExp('\\n  function ' + name + '\\([\\s\\S]*?\\n  \\}'));
  assert.ok(m, 'could not find ' + name + '() in js/app.js');
  return m[0];
}

function constant(name) {
  const m = src.match(new RegExp('\\n  const ' + name + ' = [^;]+;'));
  assert.ok(m, 'could not find ' + name);
  return m[0];
}

/* The real decision code, with the geometry, the animation and the saving
   stubbed out - none of it is what is under test. */
function build() {
  const timers = [];
  const listeners = [];
  const win = {
    addEventListener: (type, fn) => listeners.push(type),
    removeEventListener: (type, fn) => {
      const i = listeners.indexOf(type);
      if (i >= 0) listeners.splice(i, 1);
    }
  };
  const factory = new Function('window', 'setTimeout', 'clearTimeout',
    'requestAnimationFrame', 'cancelAnimationFrame', 'commitPlan',
    'planFollowPointer', 'planDragFrame', 'planEatClick', 'PLAN_SETTLE_MS', [
      constant('PLAN_HOLD_MS'),
      constant('PLAN_SLOP_PX'),
      'let planDrag = null;',
      grab('planRowDown'),
      grab('planBeginDrag'),
      grab('planBlockScroll'),
      grab('planPointerMove'),
      grab('planPointerUp'),
      'return { planRowDown, planPointerMove, planPointerUp, planBlockScroll,',
      '  held: () => planDrag, live: () => !!(planDrag && planDrag.live) };'
    ].join('\n'));

  const api = factory(
    win,
    (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    id => { if (timers[id - 1]) timers[id - 1].cancelled = true; },
    () => 1, () => {},
    () => {},          /* commitPlan */
    () => {},          /* planFollowPointer */
    () => {},          /* planDragFrame */
    () => {},          /* planEatClick */
    190
  );
  api.timers = timers;
  api.listeners = listeners;
  /* Fire the pending hold, the way a finger held still would. */
  api.hold = () => {
    const t = timers.find(t => t.ms === 280 && !t.cancelled && !t.done);
    assert.ok(t, 'no hold timer was set');
    t.done = true;
    t.fn();
  };
  api.holdPending = () => timers.some(t => t.ms === 280 && !t.cancelled && !t.done);
  return api;
}

/* A row, and a press somewhere on it. `on` is which part was touched. */
function press(on, pointerType, x, y) {
  const li = {
    classList: { add() {}, remove() {} },
    getBoundingClientRect: () => ({ top: 100, height: 44 }),
    style: {}
  };
  let prevented = 0;
  const target = {
    closest: sel => {
      if (sel === '.plan-row') return li;
      if (sel === 'input, .plan-unstar') return on === 'checkbox' || on === 'star' ? {} : null;
      if (sel === '.plan-grip') return on === 'grip' ? {} : null;
      return null;
    },
    setPointerCapture() {}
  };
  return {
    button: 0, pointerType, pointerId: 1,
    clientX: x == null ? 50 : x,
    clientY: y == null ? 120 : y,
    target, li,
    preventDefault: () => { prevented++; },
    prevented: () => prevented
  };
}

const move = (e, x, y) => ({ clientX: x, clientY: y, preventDefault: e.preventDefault });

/* --- the grip still picks up at once, finger or mouse --- */

for (const kind of ['touch', 'mouse']) {
  const api = build();
  const e = press('grip', kind);
  api.planRowDown(e);
  assert.ok(api.live(), 'the grip picks the row up immediately on a ' + kind);
  assert.ok(!api.holdPending(), 'and does not wait for a hold');
  assert.ok(e.prevented() > 0, 'and takes the gesture there and then');
}

/* --- a mouse on the body waits for movement, so a click still opens the task --- */

let api = build();
let e = press('body', 'mouse', 50, 120);
api.planRowDown(e);
assert.ok(!api.live(), 'pressing a row with a mouse does not pick it up yet');
assert.ok(!api.holdPending(), 'a mouse does not wait on a clock');

api.planPointerMove(move(e, 52, 123));
assert.ok(!api.live(), 'nor does a wobble of a few pixels');

api.planPointerMove(move(e, 52, 140));
assert.ok(api.live(), 'but a real drag does');

/* Let go without ever moving: that is a click, and the row must stay put. */
api = build();
e = press('body', 'mouse');
api.planRowDown(e);
api.planPointerUp();
assert.ok(!api.live(), 'a click never became a drag');
assert.strictEqual(api.held(), null, 'and nothing is left held');

/* --- a finger on the body has to hold still --- */

api = build();
e = press('body', 'touch', 50, 120);
api.planRowDown(e);
assert.ok(!api.live(), 'a finger does not pick the row up on contact');
assert.ok(api.holdPending(), 'it is given a moment to hold still');
assert.strictEqual(e.prevented(), 0,
  'and nothing is prevented meanwhile, or the page could not scroll');

api.hold();
assert.ok(api.live(), 'holding still picks it up');

/* The page must not scroll under a row that is being carried. */
let blocked = 0;
api.planBlockScroll({ preventDefault: () => { blocked++; } });
assert.strictEqual(blocked, 1, 'a held row cancels the scroll');

/* --- a finger that moves first is scrolling, and must be left alone --- */

api = build();
e = press('body', 'touch', 50, 120);
api.planRowDown(e);
api.planPointerMove(move(e, 50, 160));
assert.ok(!api.live(), 'a finger that moves before the hold is scrolling');
assert.strictEqual(api.held(), null, 'so the row is let go of entirely');
assert.ok(!api.holdPending(), 'and the hold is called off, not left to fire later');
assert.strictEqual(e.prevented(), 0, 'the scroll itself is never interfered with');
assert.deepStrictEqual(api.listeners, [], 'and nothing is left listening');

/* A small drift inside the hold is still a hold - a finger is never still. */
api = build();
e = press('body', 'touch', 50, 120);
api.planRowDown(e);
api.planPointerMove(move(e, 51, 124));
assert.ok(api.holdPending(), 'a few pixels of drift does not count as moving off');
api.hold();
assert.ok(api.live(), 'and the row still picks up');

/* --- the checkbox and the star are for pressing --- */

for (const part of ['checkbox', 'star']) {
  const api = build();
  api.planRowDown(press(part, 'touch'));
  assert.strictEqual(api.held(), null, 'pressing the ' + part + ' arms no drag');
  assert.deepStrictEqual(api.listeners, [], 'and listens for nothing');
}

/* A right-click is not a drag either. */
api = build();
e = press('body', 'mouse');
e.button = 2;
api.planRowDown(e);
assert.strictEqual(api.held(), null, 'a right-click arms no drag');

console.log('plan drag ok');
