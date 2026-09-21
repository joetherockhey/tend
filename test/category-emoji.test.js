/* Node check that a category gets the emoji a person would expect.

   The lookup is an ordered list of keywords and the first match wins, which
   is the whole risk in it: "Workout" contains "work", "Homework" contains
   both "home" and "work", "Education" and "Vacation" both contain "cat".
   Get the order or the word-start boundary wrong and those quietly land on
   the wrong row - still an emoji, so nothing looks broken, just wrong.
   Run: node test/category-emoji.test.js */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');
const table = src.match(/const CATEGORY_EMOJI = \[[\s\S]*?'i'\)\]\);/)[0];
const sprouts = src.match(/const CATEGORY_SPROUTS = \[[\s\S]*?\];/)[0];
const body = src.match(/function categoryEmoji\(name\) \{[\s\S]*?\n  \}/)[0];

const categoryEmoji = new Function(
  `${table}\n${sprouts}\n${body}\nreturn { categoryEmoji, CATEGORY_SPROUTS };`
)();
const emoji = categoryEmoji.categoryEmoji;
const SPROUTS = categoryEmoji.CATEGORY_SPROUTS;

/* The six a new account starts with. */
assert.strictEqual(emoji('Work'), '💼');
assert.strictEqual(emoji('Home'), '🏠');
assert.strictEqual(emoji('Health'), '💪');
assert.strictEqual(emoji('Money'), '💰');
assert.strictEqual(emoji('Errands'), '🛒');
assert.strictEqual(emoji('Fun'), '🎉');

/* The ones that would go wrong if the rows were reordered. */
assert.strictEqual(emoji('Workout'), '💪', 'workout must beat work');
assert.strictEqual(emoji('Homework'), '📚', 'homework is study, not home or work');
assert.strictEqual(emoji('Education'), '📚', 'the "cat" inside education is not a pet');
assert.strictEqual(emoji('Vacation'), '✈️', 'nor the one inside vacation');
assert.strictEqual(emoji('Cat'), '🐾', 'but a cat on its own is');

/* Matching is at a word start, so a keyword buried mid-word is not a match. */
assert.ok(SPROUTS.includes(emoji('Groundwork')), 'a keyword buried mid-word is not a match');
assert.strictEqual(emoji('Ground work'), '💼', 'but the same letters after a space are');
assert.ok(SPROUTS.includes(emoji('Zibblenap')), 'an unknown name still gets something');

/* Case does not matter, and the sprout for a name is the same every time -
   that is the only reason it is safe to derive rather than store. */
assert.strictEqual(emoji('money'), emoji('MONEY'));
assert.strictEqual(emoji('Zibblenap'), emoji('Zibblenap'));
assert.ok(SPROUTS.includes(emoji('')), 'an empty name does not throw');

console.log('category emoji ok');
