/* Node check for the one bit of arithmetic behind the garden following the
   gardener on a phone: panFor() in js/garden.js decides how far the plot
   slides under its window. Run: node test/camera.test.js */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/garden.js', 'utf8');
const body = src.match(/function panFor\(row, cell, shownRows, viewH\) \{[\s\S]*?\n  \}/)[0];
const panFor = new Function('return (' + body + ')')();

/* A 12-row garden of 34px squares seen through a 200px window. */
const CELL = 34, ROWS = 12, VIEW = 200;

assert.strictEqual(panFor(0, CELL, ROWS, VIEW), 0,
  'the top row shows the top of the garden, not the sky above it');
assert.strictEqual(panFor(2, CELL, ROWS, VIEW), 0,
  'still pinned while the gardener is in the top half - you walk into the window first');

/* Row 5: 5*34 + 17 - 100 = 87, well inside the range, so it centres exactly. */
assert.strictEqual(panFor(5, CELL, ROWS, VIEW), 87,
  'in the middle the garden follows and the gardener sits centred');

/* The most it may ever slide is 12*34 - 200 = 208. */
assert.strictEqual(panFor(11, CELL, ROWS, VIEW), 208,
  'the last row stops at the bottom edge rather than scrolling past it');
assert.strictEqual(panFor(99, CELL, ROWS, VIEW), 208,
  'a row off the end cannot drag the garden any further');

/* A garden shorter than its window never moves at all. */
assert.strictEqual(panFor(3, CELL, 4, VIEW), 0,
  'nothing to follow to when the whole garden already fits');

/* Scaled down to fit a narrow phone, the sums are the same in smaller pixels. */
assert.strictEqual(panFor(5, 17, ROWS, 100), 43.5,
  'a scaled plot pans in scaled pixels');

console.log('camera ok');
