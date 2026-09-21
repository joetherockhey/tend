/* Node check for Plan My Day: the bit of it that is arithmetic rather than
   dragging. Three things can go quietly wrong and none of them would look
   broken on screen - a plan surviving into the next day, a newly starred task
   jumping the queue it was never in, and the last half hour of the evening
   being offered at half eleven at night.

   Run: node test/plan.test.js */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/app.js', 'utf8');

function grab(name) {
  const m = src.match(new RegExp('\\n  function ' + name + '\\([\\s\\S]*?\\n  \\}'));
  assert.ok(m, 'could not find ' + name + '() in js/app.js');
  return m[0];
}

const CONSTS = ['PLAN_SLOT_MINUTES', 'PLAN_DAY_END', 'PLAN_LAST_SLOT'].map(n => {
  const m = src.match(new RegExp('\\n  const ' + n + ' = [^;]+;'));
  assert.ok(m, 'could not find ' + n);
  return m[0];
}).join('\n');

/* The three functions under test, wired to a fake clock and a fake store so
   the day can be moved about without waiting for one. */
function build(nowMinutes, prefsObj, ticketList) {
  const today = '2026-09-21';
  const Store = { prefs: () => prefsObj };
  const Util = { todayStr: () => today };
  const tickets = () => ticketList || [];
  const factory = new Function('Store', 'Util', 'tickets', 'NOW', [
    CONSTS,
    grab('planState'),
    grab('planTasks'),
    grab('planDoneToday'),
    'function planMinutesNow() { return NOW; }',
    grab('planSlots'),
    'return { planState, planTasks, planDoneToday, planSlots };'
  ].join('\n'));
  return factory(Store, Util, tickets, nowMinutes);
}

/* --- a plan belongs to its day --- */

let prefs = { plan: { date: '2026-09-20', mode: 'times', order: ['a', 'b'], times: { a: 540 } } };
let api = build(9 * 60, prefs, []);
let plan = api.planState();
assert.strictEqual(plan.date, '2026-09-21', 'yesterday’s plan is replaced, not carried over');
assert.deepStrictEqual(plan.order, [], 'and it comes back empty');
assert.deepStrictEqual(plan.times, {}, 'with nothing still pinned to a time');
assert.strictEqual(plan.mode, 'order', 'and back on the running order');

prefs = { plan: { date: '2026-09-21', mode: 'times', order: ['a'], times: { a: 540 } } };
plan = build(9 * 60, prefs, []).planState();
assert.strictEqual(plan.mode, 'times', 'today’s plan is left exactly as it was');
assert.deepStrictEqual(plan.order, ['a'], 'including the order');

/* Rubbish in prefs - a half-written sync, a hand-edited export - must not be
   able to throw the page rather than render it. */
plan = build(9 * 60, { plan: { date: '2026-09-21', order: 'nope', times: 7, mode: 'sideways' } }, []).planState();
assert.deepStrictEqual(plan.order, [], 'an order that is not a list is discarded');
assert.deepStrictEqual(plan.times, {}, 'so are times that are not an object');
assert.strictEqual(plan.mode, 'order', 'and a mode nobody has heard of');

/* --- who is on the plan, and in what order --- */

const TASKS = [
  { id: 'new', priority: true },                  /* starred since the plan was made */
  { id: 'c', priority: true },
  { id: 'a', priority: true },
  { id: 'b', priority: true },
  { id: 'plain', priority: false },
  { id: 'old', priority: true, archived: true }
];

api = build(9 * 60, { plan: { date: '2026-09-21', mode: 'order', order: ['a', 'b', 'c'], times: {} } }, TASKS);
assert.deepStrictEqual(api.planTasks().map(t => t.id), ['a', 'b', 'c', 'new'],
  'the plan holds its order, and anything newly starred goes on the end');

api = build(9 * 60, { plan: { date: '2026-09-21', mode: 'order', order: [], times: {} } }, TASKS);
assert.deepStrictEqual(api.planTasks().map(t => t.id), ['new', 'c', 'a', 'b'],
  'with no plan yet the ticket list’s own order stands');

assert.ok(!api.planTasks().some(t => t.id === 'plain'), 'an unstarred task is not on the plan');
assert.ok(!api.planTasks().some(t => t.id === 'old'), 'nor is an archived one');

/* A plan is what is left to do: ticking something off crosses it out, the same
   as it would on paper. It is still counted, though - "2 done, 3 to go" is the
   reason to look at the page twice. */
const DONE = [
  { id: 'x', priority: true, completedAt: '2026-09-21' },
  { id: 'y', priority: true, completedAt: null },
  { id: 'z', priority: true, completedAt: '2026-09-14' }
];
api = build(9 * 60, { plan: { date: '2026-09-21', order: ['x', 'y', 'z'], times: {} } }, DONE);
assert.deepStrictEqual(api.planTasks().map(t => t.id), ['y'],
  'a task ticked off comes off the plan');
assert.deepStrictEqual(api.planDoneToday().map(t => t.id), ['x'],
  'and is counted as done today - but one finished last week is not');

/* --- taking something off the plan --- */

/* Unstarring on the plan used to leave the row sitting there: togglePriority
   redrew the task list and nothing else, so a plan you were looking at kept
   showing a task that was no longer on it until you switched pages. Clearing
   the star is only half the job - the plan has to be redrawn too. */
const PLAN_TASKS = [
  { id: 'a', title: 'A', priority: true },
  { id: 'b', title: 'B', priority: true }
];
const drew = [];
const togglePriority = new Function('tickets', 'snapshot', 'Store', 'renderAll',
  grab('togglePriority') + '\nreturn togglePriority;'
)(() => PLAN_TASKS, () => {}, { saveTickets: () => {} }, () => drew.push('all'));

togglePriority('a');
assert.strictEqual(PLAN_TASKS[0].priority, false, 'unstarring clears the star');
assert.ok(drew.includes('all'), 'and redraws the plan, not only the task list');

api = build(9 * 60, { plan: { date: '2026-09-21', order: ['a', 'b'], times: {} } }, PLAN_TASKS);
assert.deepStrictEqual(api.planTasks().map(t => t.id), ['b'], 'so it is off the plan');
assert.ok(!PLAN_TASKS[0].archived && !PLAN_TASKS[0].completedAt,
  'but still an ordinary task - not archived, not ticked off');

/* --- the half hours on offer --- */

const slotsAt = mins => build(mins, { plan: { date: '2026-09-21', order: [], times: {} } }, []).planSlots();

let slots = slotsAt(9 * 60 + 17);
assert.strictEqual(slots[0], 9 * 60, 'the first slot is the half hour you are in, not the next one');
assert.strictEqual(slots[slots.length - 1], 22 * 60, 'the last is the end of the evening');
assert.strictEqual(slots[1] - slots[0], 30, 'and they run every half hour');

slots = slotsAt(9 * 60 + 45);
assert.strictEqual(slots[0], 9 * 60 + 30, 'past the half hour, that half hour is the one you are in');

/* Late enough that the evening is already over: there is still a plan to make. */
slots = slotsAt(22 * 60 + 40);
assert.ok(slots.length >= 2, 'there is always some day left to drop things into');
assert.strictEqual(slots[0], 22 * 60 + 30, 'starting from now');
assert.ok(slots[slots.length - 1] <= 23 * 60 + 30, 'and never running past the end of the day');

slots = slotsAt(23 * 60 + 50);
assert.deepStrictEqual(slots, [23 * 60 + 30], 'ten to midnight leaves exactly one');

console.log('plan ok');
