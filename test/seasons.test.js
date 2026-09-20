/* Node check for the season axis: the sections you open run Spring, Summer,
   Autumn, Winter and round again, a section keeps its place and gains a
   season, and the mix that tints a band lands where it should at both ends.
   Run: node test/seasons.test.js */
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/garden.js', 'utf8');

/* Same trick as sections.test.js: lift the functions straight out of the
   source rather than loading a file that wants a browser. */
function grab(name) {
  const m = src.match(new RegExp('\\n  function ' + name + '\\([\\s\\S]*?\\n  \\}'));
  assert.ok(m, 'could not find ' + name + '() in js/garden.js');
  return m[0];
}

const NO_SEASON = { id: '', label: '', icon: '', tint: [0, 0, 0], tintStrength: 0, detail: {} };

const world = {
  themeOrder: ['grass', 'glass', 'wood', 'patio', 'maze', 'water', 'soil', 'orchard'],
  sections: [
    { name: 'Garden', theme: 'grass' }, { name: 'Greenhouse', theme: 'glass' },
    { name: 'House', theme: 'wood' }, { name: 'Yard', theme: 'patio' },
    { name: 'Hedge Maze', theme: 'maze' }, { name: 'Pond', theme: 'water' },
    { name: 'Vegetable Patch', theme: 'soil' }, { name: 'Orchard', theme: 'orchard' }
  ],
  seasons: ['spring', 'summer', 'autumn', 'winter'].map(id => ({
    id: id, label: id[0].toUpperCase() + id.slice(1), icon: 'x',
    tint: [0, 0, 0], tintStrength: 0, detail: {},
    prop: '<svg></svg>', propName: 'Prop'
  }))
};

const g = new Function('NO_SEASON', 'W', [
  grab('seasonInfo'), grab('sectionInfo'), grab('mixHex'), grab('tinted'),
  'return { seasonInfo, sectionInfo, mixHex, tinted };'
].join('\n'))(NO_SEASON, () => world);

/* --- the calendar --- */
const run = [0, 1, 2, 3, 4, 5].map(i => g.seasonInfo(i, world).id);
assert.deepStrictEqual(run, ['spring', 'summer', 'autumn', 'winter', 'spring', 'summer'],
  'sections run in calendar order and start over');

/* --- a section is a place AND a season --- */
const third = g.sectionInfo(2, world);
assert.strictEqual(third.theme, 'wood', 'the place is untouched by the season');
assert.strictEqual(third.name, 'Autumn House', 'the sign reads season then place');
assert.strictEqual(third.season.id, 'autumn');

/* Past the eight named sections the themes repeat, and so do the seasons. */
const ninth = g.sectionInfo(8, world);
assert.strictEqual(ninth.theme, 'grass', 'a ninth section is back to the first theme');
assert.strictEqual(ninth.name, 'Spring Plot 9', 'and back to the first season');

/* A world that declares no seasons renders exactly as it did before. */
const plain = g.sectionInfo(2, { themeOrder: world.themeOrder, sections: world.sections });
assert.strictEqual(plain.name, 'House', 'no seasons, no rename');
assert.strictEqual(plain.season, undefined, 'and nothing extra hung off it');

/* --- the tint --- */
assert.strictEqual(g.mixHex('#000000', [255, 255, 255], 0), 'rgb(0, 0, 0)', 'no mix is no change');
assert.strictEqual(g.mixHex('#000000', [255, 255, 255], 1), 'rgb(255, 255, 255)', 'a full mix is the tint');
assert.strictEqual(g.mixHex('#000000', [100, 200, 50], 0.5), 'rgb(50, 100, 25)', 'half way is half way');
assert.strictEqual(g.mixHex('#ffffff', [0, 0, 0], 5), 'rgb(0, 0, 0)', 'strength above 1 is clamped, not wrapped');
assert.strictEqual(g.tinted('#123456', { id: 'spring', tintStrength: 0 }), '#123456',
  'a season with no strength leaves the colour alone');

/* --- the layer that actually gets painted --- */
const layer = new Function('tileHash', 'Util', [
  grab('seasonLayerHtml'),
  'return seasonLayerHtml;'
].join('\n'))(
  (r, c, s) => Math.abs((r * 73856093) ^ (c * 19349663) ^ (s * 83492791)),
  { escapeHtml: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;') }
);

const html = layer(2, g.sectionInfo(2, world));
assert.ok(html.includes('season-wash'), 'the band gets its light');
assert.ok(!html.includes('Autumn House'), 'no name plate pinned over the garden');
assert.strictEqual((html.match(/<i /g) || []).length, 7, 'seven things drifting through it');
assert.ok(html.includes('title="Prop"'), 'the prop stands in the corner, named');
assert.ok(!/NaN|undefined/.test(html), 'and no holes in the generated style');
assert.strictEqual(layer(0, plain), '', 'a world with no seasons paints no season layer');

/* --- both worlds actually carry a season table --- */
const worlds = fs.readFileSync(__dirname + '/../js/worlds.js', 'utf8');
assert.ok(/sections: SECTIONS,\s*\n\s*seasons: SEASONS,/.test(worlds), 'the garden has seasons');
assert.ok(/sections: OCEAN_SECTIONS,\s*\n\s*seasons: OCEAN_SEASONS,/.test(worlds), 'the reef has seasons');
['spring', 'summer', 'autumn', 'winter'].forEach(id =>
  assert.ok(worlds.includes("id: '" + id + "'"), 'worlds.js declares ' + id));

console.log('seasons ok');
