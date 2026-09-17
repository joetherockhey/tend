/* Node check that a failed sync cannot delete somebody's repeating tasks.

   pruneRepeats() sweeps the two maps that say which tasks repeat, dropping
   entries whose task is gone. boot() runs after Store.open() resolves -
   INCLUDING the branch where the pull failed and open() fell back to the
   cache, which on a new device or a cleared browser is short or empty. Pruning
   against that read every repeating task as deleted, wiped its rule, and wrote
   the emptied map back; the write marks the garden bag dirty, so the next sync
   pushed the wipe to the server and every repeat on the account stopped
   repeating, everywhere. The guard is Store.hasSynced().
   Run: node test/prune.test.js */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');
const body = src.match(/function pruneRepeats\(\) \{[\s\S]*?\n  \}/)[0];

/* One run of the sweep over a given world. Returns what the maps look like
   afterwards, so the test can see what was kept and what was dropped. */
function sweep({ synced, ticketIds, rules, children }) {
  const store = { 'task-repeat-v1': Object.assign({}, rules),
                  'task-repeat-child-v1': Object.assign({}, children) };
  const run = new Function('tickets', 'Store', 'readMap', 'writeMap', 'REPEAT_KEY', 'REPEAT_CHILD_KEY', `
    ${body}
    pruneRepeats();
  `);
  run(
    () => ticketIds.map(id => ({ id })),
    { hasSynced: () => synced },
    k => Object.assign({}, store[k]),
    (k, v) => { store[k] = v; },
    'task-repeat-v1',
    'task-repeat-child-v1'
  );
  return store;
}

/* The bug. A daily task exists on the server; this boot never saw it. */
const afterFailedPull = sweep({
  synced: false,
  ticketIds: [],
  rules: { creatine: 'daily', gym: 'weekly' },
  children: { creatine: 'creatine-2' },
});
assert.deepStrictEqual(afterFailedPull['task-repeat-v1'], { creatine: 'daily', gym: 'weekly' },
  'a sync that never landed must not decide a repeating task is gone');
assert.deepStrictEqual(afterFailedPull['task-repeat-child-v1'], { creatine: 'creatine-2' },
  'nor that its next copy is gone');

/* A short cache is just as dangerous as an empty one. */
assert.deepStrictEqual(
  sweep({ synced: false, ticketIds: ['gym'], rules: { creatine: 'daily', gym: 'weekly' }, children: {} })['task-repeat-v1'],
  { creatine: 'daily', gym: 'weekly' },
  'a stale cache holding one of the two tasks still prunes nothing');

/* With a list it can trust, it still does its job. */
const afterRealSync = sweep({
  synced: true,
  ticketIds: ['creatine', 'creatine-2'],
  rules: { creatine: 'daily', deleted: 'weekly' },
  children: { creatine: 'creatine-2', deleted: 'ghost' },
});
assert.deepStrictEqual(afterRealSync['task-repeat-v1'], { creatine: 'daily' },
  'a rule for a task that really is deleted is swept up');
assert.deepStrictEqual(afterRealSync['task-repeat-child-v1'], { creatine: 'creatine-2' },
  'and so is a child entry pointing at a task that no longer exists');

/* A live parent whose child was deleted loses only the child entry - the rule
   stays, so the next tick spawns a fresh copy. */
assert.deepStrictEqual(
  sweep({ synced: true, ticketIds: ['creatine'], rules: { creatine: 'daily' }, children: { creatine: 'gone' } }),
  { 'task-repeat-v1': { creatine: 'daily' }, 'task-repeat-child-v1': {} },
  'deleting the spawned copy does not stop the task repeating');

console.log('prune ok');
