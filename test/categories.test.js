/* Node check that a deleted category stays deleted.

   Tend used to top up the default categories on an account that already had
   some, guarded by a version marker in prefs. prefs are replaced wholesale by
   a pull, so on any account whose server row did not carry the marker, every
   load put back every default the person had deleted - Errands and Fun most
   often, because they are last in the list. seedDefaultsIfEmpty now does
   nothing at all to an account that has categories.
   Run: node test/categories.test.js */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/store.js', 'utf8');
const defaults = src.match(/const DEFAULT_CATEGORIES = \[[\s\S]*?\];/)[0];
const body = src.match(/function seedDefaultsIfEmpty\(\) \{[\s\S]*?\n  \}/)[0];

/* Built fresh per case so each one gets its own `categories`. */
function run(startingWith) {
  const calls = [];
  const scope = new Function('Util', 'CLOUD', 'markDirty', 'writeCache', 'start', `
    ${defaults}
    let categories = start;
    ${body}
    seedDefaultsIfEmpty();
    return categories;
  `);
  let n = 0;
  const cats = scope(
    { uid: () => 'id-' + (++n) },
    true,
    k => calls.push('dirty:' + k),
    () => calls.push('cache'),
    startingWith
  );
  return { names: cats.map(c => c.name), calls };
}

/* A brand-new account still gets the full set. */
const fresh = run([]);
assert.deepStrictEqual(fresh.names, ['Work', 'Home', 'Health', 'Money', 'Errands', 'Fun'],
  'an empty account is seeded with every default');
assert.ok(fresh.calls.includes('dirty:categories'), 'and the seed is saved');

/* An account that deleted two of them keeps them deleted, however many times
   this runs - which is the bug, because it ran on every single load. */
let kept = ['Work', 'Home', 'Health', 'Money'].map(n => ({ id: n, name: n, color: '#000' }));
for (let load = 1; load <= 5; load++) {
  const r = run(kept);
  assert.deepStrictEqual(r.names, ['Work', 'Home', 'Health', 'Money'],
    'load ' + load + ': nothing is added back to an account that has categories');
  assert.deepStrictEqual(r.calls, [], 'load ' + load + ': and nothing is written');
}

/* Even down to one, and even when the one left is not a default at all. */
assert.deepStrictEqual(run([{ id: 'x', name: 'Allotment', color: '#000' }]).names, ['Allotment'],
  'a single category of your own is left alone');

console.log('categories ok');
