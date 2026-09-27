/* Node check for the garden look's glide and bounce: glideStep() and rubber()
   in js/garden.js. Run: node test/look.test.js */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/garden.js', 'utf8');
const num = name => Number(src.match(new RegExp('const ' + name + ' = ([\\d.]+);'))[1]);
const fn = name => src.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}'))[0];
const { glideStep, rubber } = new Function('LOOK_FRICTION', 'LOOK_BOUNCE',
  fn('rubber') + fn('glideStep') + 'return { glideStep, rubber };')(num('LOOK_FRICTION'), num('LOOK_BOUNCE'));

const MAX = 400, VIEW = 300;
const run = (pan, vel) => {
  let done = false, peak = pan, low = pan, frames = 0;
  while (!done && frames++ < 1000) {
    [pan, vel, done] = glideStep(pan, vel, 16, MAX);
    peak = Math.max(peak, pan); low = Math.min(low, pan);
  }
  return { pan, peak, low, frames, done };
};

/* The stretch gives ground but never a whole window. */
assert.ok(rubber(10, VIEW) > 4 && rubber(10, VIEW) < 10, 'a small pull shows about half');
assert.ok(rubber(10000, VIEW) < VIEW, 'a huge pull never passes the window');

/* Let go stretched past the top: springs back to exactly 0, never beyond. */
let r = run(-60, 0);
assert.ok(r.done && r.pan === 0 && r.peak <= 0, 'springs back to the top without wobbling past');
assert.ok(r.frames < 60, 'and settles within a second');

/* Stretched past the bottom: back to exactly maxPan. */
r = run(MAX + 60, 0);
assert.ok(r.done && r.pan === MAX && r.low >= MAX, 'springs back to the bottom');

/* A fast flick into the top overshoots a little, then comes back to 0. */
r = run(100, -3);
assert.ok(r.low < 0 && r.low > -VIEW, 'a flick into the top overshoots, but not wildly');
assert.strictEqual(r.pan, 0, 'and lands on the top');

/* A gentle glide in the middle just coasts to a stop inside. */
r = run(200, 0.3);
assert.ok(r.done && r.pan > 200 && r.pan < MAX, 'a gentle glide stops inside');

console.log('look ok');
