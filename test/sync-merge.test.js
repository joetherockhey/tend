/* Node check for the garden sync merge: a device that only redrew an older copy
   of the plot must not undo a move made on the other device, moves of two
   different plants on two devices both survive, and key order (which Postgres
   jsonb does not keep) is not mistaken for a change.
   Run: node test/sync-merge.test.js */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/store.js', 'utf8').replace(/\r\n/g, '\n');

/* Lift the merge code straight out of the source, as the other tests do. */
const start = src.indexOf('  const RESET_GEN_KEY');
const end = src.indexOf('  /* ========================= status plumbing');
const grab = name => {
  const m = src.match(new RegExp('\\n  function ' + name + '\\([\\s\\S]*?\\n  \\}'));
  assert.ok(m, 'could not find ' + name + '() in js/store.js');
  return m[0];
};
const api = new Function(src.slice(start, end) + grab('stableStringify') +
  '\nlet snapshot = { state: null };' +
  '\nreturn { mergeMine, stableStringify };')();
const { mergeMine, stableStringify } = api;

const plot = obj => JSON.stringify(obj);
const rose = (row, col, waters = 5) => ({ row, col, variety: 0, potColor: '#c56a4e', grown: waters >= 5, waterCount: waters });

/* The base is what both devices last agreed on. */
const base = { 'garden-layout-v5': plot({ p1: rose(1, 0), p2: rose(3, 3, 2) }) };

/* A moved p1. B only redrew its old copy: B's push must take A's move. */
const serverAfterA = { 'garden-layout-v5': plot({ p1: rose(0, 4), p2: rose(3, 3, 2) }) };
let merged = mergeMine(Object.assign({}, base), serverAfterA, base);
assert.deepStrictEqual(JSON.parse(merged['garden-layout-v5']).p1, rose(0, 4), 'an untouched copy must not undo a move');

/* B watered p2 while A moved p1: both survive. */
const bMine = { 'garden-layout-v5': plot({ p1: rose(1, 0), p2: rose(3, 3, 3) }) };
merged = JSON.parse(mergeMine(bMine, serverAfterA, base)['garden-layout-v5']);
assert.deepStrictEqual(merged.p1, rose(0, 4), 'the other device\'s move survives');
assert.strictEqual(merged.p2.waterCount, 3, 'this device\'s watering survives');

/* B sold p2 (removed it) while A moved p1. */
merged = JSON.parse(mergeMine({ 'garden-layout-v5': plot({ p1: rose(1, 0) }) }, serverAfterA, base)['garden-layout-v5']);
assert.ok(!merged.p2 && merged.p1.row === 0, 'a sale here and a move there both land');

/* Purchases still merge whatever the base says. */
merged = mergeMine({ 'coins-spent-v1': '4' }, { 'coins-spent-v1': '9' }, { 'coins-spent-v1': '4' });
assert.strictEqual(merged['coins-spent-v1'], '9');

/* Key order is not a change. */
assert.strictEqual(stableStringify({ a: 1, b: { c: '{"x":1,"y":2}' } }), stableStringify({ b: { c: '{"y":2,"x":1}' }, a: 1 }));
assert.notStrictEqual(stableStringify({ a: 1 }), stableStringify({ a: 2 }));

/* Echoes of our own saves are recognised; anything else counts as news. */
const echo = new Function('Util', 'account', src.slice(start, end) + ['stableStringify', 'ticketRow', 'rowToTicket', 'sameTime', 'isOwnEcho', 'fingerprintOf'].map(grab).join('\n') +
  '\nlet snapshot = { tickets: {}, categories: {}, state: null }; let serverStateAt = null;' +
  '\nreturn { snapshot, ticketRow, isOwnEcho, fingerprintOf, setAt: v => { serverStateAt = v; } };')(
  { toIsoDate: d => d || '', todayStr: () => '2026-09-24' }, { id: 'u-1' });
const task = { id: 't1', title: 'Water the roses', notes: '', category: '', createdAt: '2026-09-20', subtasks: [{ text: 'a', done: false }] };
echo.snapshot.tickets.t1 = JSON.stringify(echo.ticketRow(task, 0));
/* What the database sends back: extra columns, keys in its own order. */
const dbRow = Object.assign({ updated_at: '2026-09-24T10:00:00.123+00:00' }, echo.ticketRow(task, 0), { subtasks: [{ done: false, text: 'a' }] });
assert.ok(echo.isOwnEcho('tickets', { eventType: 'UPDATE', new: dbRow }), 'our own ticket save is an echo');
assert.ok(!echo.isOwnEcho('tickets', { eventType: 'UPDATE', new: Object.assign({}, dbRow, { title: 'Water the tulips' }) }), 'an edit elsewhere is news');
assert.ok(!echo.isOwnEcho('tickets', { eventType: 'DELETE', old: { id: 't1' } }), 'a delete of a task we still have is news');
assert.ok(echo.isOwnEcho('tickets', { eventType: 'DELETE', old: { id: 'gone' } }), 'our own delete is an echo');
echo.setAt('2026-09-24T10:00:00.123456+00:00');
assert.ok(echo.isOwnEcho('app_state', { eventType: 'UPDATE', new: { updated_at: '2026-09-24T10:00:00.123456+00:00' } }));
assert.ok(!echo.isOwnEcho('app_state', { eventType: 'UPDATE', new: { updated_at: '2026-09-24T10:00:05+00:00' } }));
assert.ok(!echo.isOwnEcho('tickets', {}), 'a message we cannot read is news');

/* The fingerprint moves on an edit, a delete and a garden write - not on row order. */
const fp = echo.fingerprintOf;
const rows = [{ id: 'a', updated_at: '1' }, { id: 'b', updated_at: '1' }];
assert.strictEqual(fp(rows, [], { updated_at: 'x' }), fp(rows.slice().reverse(), [], { updated_at: 'x' }));
assert.notStrictEqual(fp(rows, [], { updated_at: 'x' }), fp([rows[0], { id: 'b', updated_at: '2' }], [], { updated_at: 'x' }));
assert.notStrictEqual(fp(rows, [], { updated_at: 'x' }), fp([rows[0]], [], { updated_at: 'x' }));
assert.notStrictEqual(fp(rows, [], { updated_at: 'x' }), fp(rows, [], { updated_at: 'y' }));

console.log('sync-merge: ok');
