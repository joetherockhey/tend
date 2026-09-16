/* Node check for the one bit of arithmetic behind the garden following the
   gardener on a phone: panFor() in js/garden.js decides where the window on
   the garden should be, given where it is now. Run: node test/camera.test.js */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/garden.js', 'utf8');
const edge = Number(src.match(/const CAMERA_EDGE_ROWS = (\d+);/)[1]);
const body = src.match(/function panFor\(row, cell, shownRows, viewH, pan\) \{[\s\S]*?\n  \}/)[0];
const panFor = new Function('CAMERA_EDGE_ROWS', 'return (' + body + ')')(edge);

/* A 12-row garden of 34px squares seen through a 200px window: rows 0-5 are
   in view when the window is at the top, and it can travel 12*34-200 = 208. */
const CELL = 34, ROWS = 12, VIEW = 200, MAX = 208;
const at = (row, pan) => panFor(row, CELL, ROWS, VIEW, pan);

/* The whole point of the rewrite: walking about inside the window moves
   nothing at all. Centring on every step made the floor slide under one key. */
for (const row of [0, 1, 2, 3, 4]) {
  assert.strictEqual(at(row, 0), 0,
    'row ' + row + ' is already in view, so the ground must not move');
}

/* Row 5 ends at 5*34+34 = 204, which is past the 200px edge - the first step
   that would put the gardener out of sight, and it moves by exactly the 4px
   needed to show them. Not a row, not a recentring: the minimum. */
assert.strictEqual(at(5, 0), 4, 'stepping into the bottom row brings it into view');

/* Having moved, standing still does not move again. */
assert.strictEqual(at(5, 4), 4, 'the window settles rather than drifting');

/* And walking back up inside the window is free again. */
assert.strictEqual(at(2, 4), 4, 'walking back up inside the window moves nothing');

/* Up past the top edge pulls it back, by the minimum again. */
assert.strictEqual(at(0, 34), 0, 'stepping above the window brings the top back');
assert.strictEqual(at(1, 100), 34, 'row 1 needs the window at 34, no further');

/* The ends of the garden are hard stops. */
assert.strictEqual(at(11, 0), MAX, 'the last row stops at the bottom edge');
assert.strictEqual(at(11, MAX), MAX, 'and stays there');
assert.strictEqual(at(99, MAX), MAX, 'a row off the end cannot drag it further');
assert.strictEqual(at(0, -50), 0, 'nothing above the first row is ever shown');

/* A garden shorter than its window never moves at all. */
assert.strictEqual(panFor(3, CELL, 4, VIEW, 0), 0, 'the whole garden already fits');

/* A free look leaves the window anywhere; the next step that would put the
   gardener out of sight takes it back, and no step before that does. */
assert.strictEqual(at(3, 150), 102, 'panned past the gardener, the next step pulls the window back to them');
assert.strictEqual(at(8, 150), 150, 'but a gardener still in view leaves it where the finger left it');

/* Scaled up to fill a phone, the sums are the same in bigger pixels: 40px
   squares in a 400px window show rows 0-9, and row 10 moves it one row. */
assert.strictEqual(panFor(9, 40, ROWS, 400, 0), 0, 'the last row that fits moves nothing');
assert.strictEqual(panFor(10, 40, ROWS, 400, 0), 40, 'the one past it moves by exactly a row');

console.log('camera ok');
