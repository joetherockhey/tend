/* Node check for the shop's stock: every plant variety sits in exactly one
   seed packet in both worlds, every tool is flagged as one (so it can only be
   bought once), and the bee hive is on sale as a decoration.
   Run: node test/shop.test.js */
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(__dirname + '/../js/worlds.js', 'utf8').replace(/^\s*const Worlds\s*=/m, 'window.Worlds ='), ctx);
const Worlds = ctx.window.Worlds || ctx.Worlds;
assert.ok(Worlds, 'worlds.js did not expose Worlds');

for (const w of Worlds.list()) {
  const seen = w.plantCategories.flatMap(c => c.varieties).sort((a, b) => a - b);
  assert.deepStrictEqual(seen, w.plants.map((_, i) => i), w.id + ': packets must cover every variety once');
  w.plantCategories.forEach(c => assert.ok(c.label && c.icon && c.desc, w.id + ' ' + c.id + ' needs label, icon, desc'));

  ['hoe', 'axe', 'shovel'].forEach(k => assert.strictEqual(w.items[k].tool, true, w.id + ' ' + k + ' is a tool'));
  assert.ok(w.items.beehive && !w.items.beehive.tool && !w.items.beehive.retired, w.id + ': beehive is a decoration on sale');
  Object.values(w.items).filter(d => !d.retired).forEach(d => assert.ok(d.desc, w.id + ' ' + d.label + ' needs a description'));
}
console.log('shop: ok');
