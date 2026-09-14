/* Node check for the one bit of arithmetic behind a friend's garden showing
   every band they own: `garden-sections-v1` holds bands *bought*, the plot is
   that plus the starting one. Run: node test/sections.test.js */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/store.js', 'utf8');
const body = src.match(/function unlockedSections\(raw\) \{[\s\S]*?\n  \}/)[0];
const unlockedSections = new Function('return (' + body + ')')();

assert.strictEqual(unlockedSections('0'), 1, 'a fresh garden is one band');
assert.strictEqual(unlockedSections('1'), 2, 'one bought band is two');
assert.strictEqual(unlockedSections(5), 6, 'five bought bands are six');
assert.strictEqual(unlockedSections(null), 1, 'nothing stored is one band');
assert.strictEqual(unlockedSections('nonsense'), 1, 'junk is one band');

console.log('sections ok');
