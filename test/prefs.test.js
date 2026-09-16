/* Node check for the three-way merge that lets a setting changed offline
   survive coming back online.

   pull() used to take the server's prefs whole and then clear the dirty flag
   that would have pushed the local ones, so dark mode, the theme, haptics,
   weekends - and the marker that kept deleted categories deleted - were all
   silently reverted by the next sync. mergePrefs keeps the keys this device
   actually changed, and only those, so the other device's settings are not
   shouted down in the process. Run: node test/prefs.test.js */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/store.js', 'utf8');
const body = src.match(/function mergePrefs\(mine, theirs, base\) \{[\s\S]*?\n  \}/)[0];
const mergePrefs = new Function('return (' + body + ')')();

/* base = what the server held when this device last synced. */

/* Nothing changed here: the server's copy wins outright. */
assert.deepStrictEqual(
  mergePrefs({ theme: 'plum' }, { theme: 'reef' }, { theme: 'plum' }),
  { theme: 'reef' },
  'a setting this device never touched takes the server value');

/* Changed here and nowhere else: this device wins. */
assert.deepStrictEqual(
  mergePrefs({ dark: true }, { dark: false }, { dark: false }),
  { dark: true },
  'a setting changed offline comes back with you');

/* The case the whole merge exists for: each device changed a different key. */
assert.deepStrictEqual(
  mergePrefs({ dark: true, theme: 'midnight' }, { dark: false, theme: 'reef' }, { dark: false, theme: 'midnight' }),
  { dark: true, theme: 'reef' },
  'your offline change and their online change both survive');

/* A key only this device has ever heard of is kept. */
assert.deepStrictEqual(
  mergePrefs({ haptics: false }, {}, {}),
  { haptics: false },
  'a brand-new setting is not lost to a server that has never seen it');

/* A key only the server has is taken. */
assert.deepStrictEqual(
  mergePrefs({}, { calWeekends: true }, {}),
  { calWeekends: true },
  'a setting made on another device arrives');

/* Both changed the same key: the server wins, because there is no third fact
   to break the tie and the offline copy is the older news. */
assert.deepStrictEqual(
  mergePrefs({ theme: 'clay' }, { theme: 'reef' }, { theme: 'plum' }),
  { theme: 'clay' },
  'a genuine conflict keeps the local edit rather than dropping it silently');

/* false and 0 are real values, not absences - the bug this guards against is
   an `||` treating "haptics off" as "haptics unset". */
assert.deepStrictEqual(
  mergePrefs({ haptics: false }, { haptics: true }, { haptics: true }),
  { haptics: false },
  'turning a setting off counts as changing it');

/* Missing arguments must not throw: a first sync has no base at all. */
assert.deepStrictEqual(mergePrefs({ dark: true }, null, null), { dark: true },
  'no server copy and no base still works');
assert.deepStrictEqual(mergePrefs(null, { dark: true }, null), { dark: true },
  'no local copy still works');

console.log('prefs ok');
