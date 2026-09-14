/* Node check for the date a repeating task comes back on: it must be a day
   that has not happened yet, or ticking it off puts it straight back in the
   feed. Run: node test/repeat.test.js */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');
const step = src.match(/function stepRepeatDate\(iso, rule, n\) \{[\s\S]*?\n  \}/)[0];
const next = src.match(/function nextRepeatDate\(from, rule\) \{[\s\S]*?\n  \}/)[0];

/* Today is pinned so the answers are the same in January as in June. */
const TODAY = '2026-09-14';
const pad = n => String(n).padStart(2, '0');
const Util = {
  dateToStr: d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
  todayStr: () => TODAY,
  toIsoDate: v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : null
};
const make = new Function('Util', step + '\n' + next + '\nreturn { stepRepeatDate, nextRepeatDate };');
const { nextRepeatDate } = make(Util);

/* The bug: an overdue daily handed over to another overdue copy. */
assert.strictEqual(nextRepeatDate('2026-09-09', 'daily'), '2026-09-15', 'five days behind comes back tomorrow');
assert.strictEqual(nextRepeatDate(TODAY, 'daily'), '2026-09-15', 'ticked on the day, back tomorrow');
assert.strictEqual(nextRepeatDate(null, 'daily'), '2026-09-15', 'no date counts from today');

/* Weekly keeps its weekday: the 9th is a Wednesday, so is the 16th. */
assert.strictEqual(nextRepeatDate('2026-08-26', 'weekly'), '2026-09-16', 'weeks behind keeps its weekday');
assert.strictEqual(nextRepeatDate('2026-09-12', 'weekly'), '2026-09-19', 'a week on');

/* Monthly clamps short months without drifting off the 31st afterwards. */
assert.strictEqual(nextRepeatDate('2026-08-31', 'monthly'), '2026-09-30', 'September has no 31st');
assert.strictEqual(nextRepeatDate('2026-01-31', 'monthly'), '2026-09-30', 'months behind, still the next real one');
assert.strictEqual(nextRepeatDate('2026-01-20', 'monthly'), '2026-09-20', 'and it keeps its day of the month');

/* Whatever the rule, it is always a day that has not happened yet. */
['daily', 'weekly', 'monthly'].forEach(rule => {
  assert.ok(nextRepeatDate('2019-03-07', rule) > TODAY, rule + ' never comes back in the past');
});

console.log('repeat ok');
