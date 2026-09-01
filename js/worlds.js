/* ============================================================================
   Tend - worlds.js
   ----------------------------------------------------------------------------
   Two skins over one set of mechanics.

     garden - a farmer tending a garden
     ocean  - a mer-person tending a reef

   Everything here is appearance: sprites, names, colours, sounds. The rules
   live in garden.js and are identical in both worlds. That is deliberate - the
   two worlds are index-matched all the way down, so the same saved data reads
   correctly in either. Plant variety 7 is a Bonsai Tree above water and
   Staghorn Coral below; the pet stored as "dog" is a dog or a clownfish; the
   tool stored as "axe" is an axe or a coral saw. Switching worlds re-skins a
   garden without touching a single thing in it.

   To add a third world, copy one of these objects and keep the keys and array
   lengths the same.
   ============================================================================ */

const Worlds = (function () {
  'use strict';

  /* One tile of the grid, in pixels. Art that spans more than one tile sizes
     itself from this, and garden.js lays the grid out with it. */
  const TILE = 34;

  /* ======================================================================
     GARDEN
     ====================================================================== */

    function treeSVG() {
      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="6" y="13" width="4" height="6" fill="#6b4423"/><rect x="2" y="2" width="12" height="10" fill="#2f7a34"/><rect x="4" y="0" width="8" height="3" fill="#3f9142"/><rect x="3" y="5" width="3" height="3" fill="#3f9142"/></svg>`;
    }
    function fruitTreeSVG() {
      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="6" y="13" width="4" height="6" fill="#6b4423"/><rect x="2" y="2" width="12" height="10" fill="#2f7a34"/><rect x="4" y="4" width="2" height="2" fill="#d0353a"/><rect x="9" y="6" width="2" height="2" fill="#d0353a"/><rect x="6" y="9" width="2" height="2" fill="#eb6834"/></svg>`;
    }
    function washingLineSVG(width) {
      const w = width * TILE - 4;
      return `<svg width="${w}" height="34" viewBox="0 0 32 20" preserveAspectRatio="none" shape-rendering="crispEdges"><rect x="1" y="4" width="1" height="10" fill="#8a8f98"/><rect x="30" y="4" width="1" height="10" fill="#8a8f98"/><rect x="1" y="4" width="30" height="1" fill="#8a8f98"/><rect x="4" y="5" width="4" height="4" fill="#f7f7f2"/><rect x="10" y="5" width="4" height="5" fill="#4361ee"/><rect x="16" y="5" width="4" height="4" fill="#eda100"/><rect x="22" y="5" width="4" height="5" fill="#e87ba4"/></svg>`;
    }
    function wheelbarrowSVG() {
      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="2" y="14" width="4" height="4" fill="#3b3f45"/><rect x="3" y="15" width="2" height="2" fill="#6b7280"/><rect x="5" y="9" width="8" height="5" fill="#8a8f98"/><rect x="6" y="8" width="6" height="1" fill="#a4aab3"/><rect x="12" y="10" width="3" height="1" fill="#6b4423"/><rect x="12" y="12" width="3" height="1" fill="#6b4423"/></svg>`;
    }
    function bushSVG() {
      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="2" y="10" width="12" height="7" fill="#2f7a34"/><rect x="4" y="6" width="8" height="6" fill="#3f9142"/><rect x="6" y="5" width="4" height="3" fill="#4fa754"/></svg>`;
    }
    function mowerSVG() {
      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="9" y="2" width="2" height="8" fill="#6b7280"/><rect x="10" y="1" width="3" height="2" fill="#3b3f45"/><rect x="3" y="10" width="9" height="5" fill="#e34948"/><rect x="4" y="15" width="3" height="3" fill="#1f2430"/><rect x="9" y="15" width="3" height="3" fill="#1f2430"/><rect x="5" y="16" width="1" height="1" fill="#8a8f98"/><rect x="10" y="16" width="1" height="1" fill="#8a8f98"/></svg>`;
    }
    function hoeSVG() {
      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="7" y="4" width="2" height="14" fill="#8a5a2e"/><rect x="4" y="1" width="8" height="3" fill="#8a8f98"/><rect x="4" y="1" width="8" height="1" fill="#c9ccd1"/></svg>`;
    }
    function hoseSVG() {
      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="3" y="9" width="6" height="6" fill="#3b3f45"/><rect x="5" y="11" width="2" height="2" fill="#4361ee"/><rect x="9" y="8" width="5" height="2" fill="#4c8c3c"/><rect x="12" y="6" width="2" height="2" fill="#4c8c3c"/><rect x="12" y="4" width="2" height="2" fill="#eda100"/></svg>`;
    }
    function bucketSVG() {
      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="4" y="10" width="8" height="6" fill="#8a8f98"/><rect x="3" y="9" width="10" height="1" fill="#a4aab3"/><rect x="5" y="6" width="6" height="1" fill="#6b7280"/></svg>`;
    }
    function axeSVG() {
      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="7" y="4" width="2" height="14" fill="#8a5a2e"/><rect x="9" y="2" width="6" height="7" fill="#a4aab3"/><rect x="9" y="2" width="6" height="2" fill="#d3d6db"/><rect x="14" y="4" width="1" height="4" fill="#6b7280"/></svg>`;
    }
    function logSVG() {
      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="2" y="14" width="12" height="4" fill="#8a5a2e"/><rect x="2" y="14" width="12" height="1" fill="#a97a45"/><rect x="4" y="15" width="2" height="2" fill="#6b4423"/><rect x="10" y="15" width="2" height="2" fill="#6b4423"/><rect x="7" y="15" width="2" height="2" fill="#6b4423"/></svg>`;
    }
    function shovelSVG() {
      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="7" y="2" width="2" height="12" fill="#8a5a2e"/><rect x="5" y="13" width="6" height="6" fill="#a4aab3"/><rect x="6" y="14" width="4" height="4" fill="#8a8f98"/></svg>`;
    }
    /* The seedling every bought plant starts as. Shapes only, no <svg> of its
       own, so it can be dropped straight into the plant sprite's 14x20 box
       above the pot rim. */
    function seedlingShapes() {
      /* Deliberately tiny: a thin stem and two leaves. Any more and it reads as
         a grown plant, which is the one thing a seedling must never do. */
      return '<rect x="6" y="12" width="1" height="3" fill="#6b4423"/>'
           + '<rect x="4" y="11" width="2" height="1" fill="#4fa754"/>'
           + '<rect x="7" y="10" width="2" height="1" fill="#6bc06e"/>';
    }
    function saplingSVG() {
      return `<svg width="18" height="22" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="7" y="14" width="2" height="5" fill="#6b4423"/><rect x="5" y="9" width="6" height="6" fill="#4fa754"/><rect x="6" y="7" width="4" height="4" fill="#6bc06e"/></svg>`;
    }
    function cabinSVG(logCount) {
      const p = Math.max(0, Math.min(10, logCount));
      if (p < 2) return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"></svg>`;

      // Stage 1 (p2-2): foundation footing
      let rects = `<rect x="0" y="18" width="16" height="2" fill="#5a3a1e"/>`;

      // Stage 2 (p3-7): walls rise from the foundation up to full height
      if (p >= 3) {
        const wallH = Math.round((Math.min(p, 7) - 2) / 5 * 12);
        rects += `<rect x="1" y="${19 - wallH}" width="14" height="${wallH}" fill="#8a5a2e"/>`;
        for (let y = 19 - wallH; y < 19; y += 2) rects += `<rect x="1" y="${y}" width="14" height="1" fill="#6b4423"/>`;
      }

      // Stage 3 (p7-9): roof eave, then ridge cap
      if (p >= 7) {
        rects += `<rect x="0" y="5" width="16" height="3" fill="#5a3a1e"/>`;
      }
      if (p >= 9) {
        rects += `<rect x="2" y="3" width="12" height="2" fill="#6b4423"/>`;
      }

      // Stage 4 (p10, complete): door with handle, and wooden shutter windows
      if (p >= 10) {
        rects += `<rect x="6" y="12" width="4" height="7" fill="#3b2a18"/><rect x="9" y="15" width="1" height="1" fill="#eda100"/>`;
        rects += `<rect x="2" y="9" width="3" height="3" fill="#6b4423"/><rect x="3" y="10" width="1" height="1" fill="#5a3a1e"/>`;
        rects += `<rect x="11" y="9" width="3" height="3" fill="#6b4423"/><rect x="12" y="10" width="1" height="1" fill="#5a3a1e"/>`;
      }

      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges">${rects}</svg>`;
    }
    function dogSVG() {
      return `<svg width="24" height="22" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="8" width="10" height="5" fill="#a97a45"/><rect x="10" y="5" width="5" height="5" fill="#a97a45"/><rect x="12" y="3" width="2" height="2" fill="#8a5a2e"/><rect x="9" y="4" width="2" height="2" fill="#8a5a2e"/><rect x="0" y="8" width="2" height="3" fill="#8a5a2e"/><rect x="2" y="13" width="2" height="2" fill="#5a3a1e"/><rect x="7" y="13" width="2" height="2" fill="#5a3a1e"/></svg>`;
    }
    function catSVG() {
      return `<svg width="24" height="22" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="9" width="9" height="4" fill="#8a8f98"/><rect x="9" y="6" width="4" height="4" fill="#8a8f98"/><rect x="9" y="4" width="1" height="2" fill="#6b7280"/><rect x="11" y="4" width="1" height="2" fill="#6b7280"/><rect x="0" y="7" width="2" height="1" fill="#8a8f98"/><rect x="3" y="13" width="2" height="1" fill="#5a3a1e"/></svg>`;
    }
    function rabbitSVG() {
      return `<svg width="24" height="22" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="3" y="9" width="8" height="4" fill="#c9a06a"/><rect x="9" y="6" width="3" height="4" fill="#c9a06a"/><rect x="9" y="1" width="1" height="5" fill="#c9a06a"/><rect x="11" y="1" width="1" height="5" fill="#c9a06a"/><rect x="10" y="7" width="1" height="1" fill="#e87ba4"/></svg>`;
    }
    function birdSVG() {
      return `<svg width="24" height="22" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="4" y="8" width="6" height="4" fill="#4361ee"/><rect x="9" y="7" width="2" height="2" fill="#4361ee"/><rect x="11" y="8" width="2" height="1" fill="#eda100"/><rect x="4" y="9" width="3" height="2" fill="#2c3e8f"/></svg>`;
    }
    function treatSVG() {
      return `<svg width="20" height="20" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="3" y="8" width="10" height="5" fill="#8a8f98"/><rect x="4" y="7" width="8" height="2" fill="#a97a45"/><rect x="6" y="6" width="2" height="2" fill="#eda100"/></svg>`;
    }
    function tableSVG() {
      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="4" y="8" width="8" height="6" fill="#a97a45"/><rect x="1" y="9" width="2" height="3" fill="#6b4423"/><rect x="13" y="9" width="2" height="3" fill="#6b4423"/><rect x="5" y="14" width="1" height="3" fill="#6b4423"/><rect x="10" y="14" width="1" height="3" fill="#6b4423"/></svg>`;
    }
    function grillSVG() {
      return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="4" y="8" width="8" height="4" fill="#3b3f45"/><rect x="5" y="9" width="6" height="2" fill="#6b7280"/><rect x="5" y="12" width="1" height="4" fill="#1f2430"/><rect x="10" y="12" width="1" height="4" fill="#1f2430"/><rect x="7" y="4" width="2" height="4" fill="#8a8f98"/></svg>`;
    }
    function hedgeSVG() {
      return `<svg width="${TILE}" height="${TILE}" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="0" y="0" width="16" height="16" fill="#2f6b32"/><rect x="2" y="2" width="3" height="3" fill="#3f9142"/><rect x="9" y="4" width="3" height="3" fill="#3f9142"/><rect x="5" y="9" width="3" height="3" fill="#3f9142"/><rect x="11" y="10" width="3" height="3" fill="#3f9142"/></svg>`;
    }
    function lilyPadSVG() {
      return `<svg width="26" height="26" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="3" y="6" width="10" height="6" fill="#4c9c4f"/><rect x="5" y="8" width="4" height="2" fill="#e87ba4"/></svg>`;
    }
    function gardenerFrontSVG(o) {
      return `<svg width="30" height="32" viewBox="0 0 19 20" shape-rendering="crispEdges">
        <rect x="6" y="0" width="6" height="2" fill="${o.hat}"/>
        <rect x="3" y="2" width="12" height="2" fill="${o.hat}"/>
        <rect x="4" y="4" width="8" height="6" fill="#f2c48d"/>
        <rect x="6" y="7" width="1" height="1" fill="#1f2430"/>
        <rect x="9" y="7" width="1" height="1" fill="#1f2430"/>
        <rect x="3" y="10" width="10" height="6" fill="${o.shirt}"/>
        <rect x="1" y="10" width="2" height="5" fill="#f2c48d"/>
        <rect x="13" y="10" width="2" height="4" fill="#f2c48d"/>
        <rect x="4" y="16" width="3" height="4" fill="${o.pants}"/>
        <rect x="9" y="16" width="3" height="4" fill="${o.pants}"/>
        <rect x="15" y="11" width="3" height="4" fill="#8a8f98"/>
        <rect x="18" y="10" width="1" height="2" fill="#8a8f98"/>
      </svg>`;
    }
    function gardenerBackSVG(o) {
      return `<svg width="30" height="32" viewBox="0 0 19 20" shape-rendering="crispEdges">
        <rect x="6" y="0" width="6" height="2" fill="${o.hat}"/>
        <rect x="3" y="2" width="12" height="2" fill="${o.hat}"/>
        <rect x="4" y="4" width="8" height="6" fill="#5a3a1e"/>
        <rect x="3" y="10" width="10" height="6" fill="${o.shirt}"/>
        <rect x="1" y="10" width="2" height="5" fill="#f2c48d"/>
        <rect x="13" y="10" width="2" height="4" fill="#f2c48d"/>
        <rect x="4" y="16" width="3" height="4" fill="${o.pants}"/>
        <rect x="9" y="16" width="3" height="4" fill="${o.pants}"/>
      </svg>`;
    }
    function gardenerSideSVG(o) {
      return `<svg width="30" height="32" viewBox="0 0 19 20" shape-rendering="crispEdges">
        <rect x="7" y="0" width="7" height="2" fill="${o.hat}"/>
        <rect x="6" y="2" width="9" height="2" fill="${o.hat}"/>
        <rect x="7" y="4" width="6" height="6" fill="#f2c48d"/>
        <rect x="12" y="6" width="2" height="1" fill="#f2c48d"/>
        <rect x="11" y="7" width="1" height="1" fill="#1f2430"/>
        <rect x="6" y="10" width="8" height="6" fill="${o.shirt}"/>
        <rect x="12" y="10" width="3" height="5" fill="#f2c48d"/>
        <rect x="7" y="16" width="3" height="4" fill="${o.pants}"/>
        <rect x="11" y="16" width="3" height="4" fill="${o.pants}"/>
        <rect x="15" y="11" width="3" height="4" fill="#8a8f98"/>
        <rect x="18" y="10" width="1" height="2" fill="#8a8f98"/>
      </svg>`;
    }
    function wallPattern(theme) {
      if (theme === 'grass') return 'repeating-linear-gradient(90deg, #a97a45 0 4px, #8a5a2e 4px 5px, transparent 5px 8px)';
      if (theme === 'glass') return 'repeating-linear-gradient(90deg, #6bb6c9 0 10px, #4f96a8 10px 12px)';
      if (theme === 'wood') return 'repeating-linear-gradient(90deg, #8a5a2e 0 13px, #6b4423 13px 16px)';
      if (theme === 'patio') return 'repeating-linear-gradient(90deg, #9a9a90 0 11px, #7d7d74 11px 14px)';
      if (theme === 'maze') return 'repeating-linear-gradient(90deg, #2f6b32 0 6px, #3f9142 6px 9px)';
      if (theme === 'water') return 'repeating-linear-gradient(90deg, #5a8fa0 0 5px, #3f9142 5px 7px)';
      if (theme === 'soil') return 'repeating-linear-gradient(90deg, #8a5a2e 0 6px, #a97a45 6px 7px, transparent 7px 10px)';
      if (theme === 'orchard') return 'repeating-linear-gradient(45deg, #8a5a2e 0 4px, #a97a45 4px 8px)';
      return '#8a5a2e';
    }
    function surfaceBackground(kind) {
      if (kind === 'bed') return 'repeating-linear-gradient(0deg, #6b4423 0 5px, #5a3a1e 5px 9px)';
      if (kind === 'porch') return 'repeating-linear-gradient(90deg, #c9a06a 0 7px, #b58e58 7px 14px)';
      if (kind === 'sand') return 'repeating-radial-gradient(circle at center, #e8d9a8 0 2px, #ddc98f 2px 3px, #e8d9a8 3px 7px)';
      if (kind === 'dock') return 'repeating-linear-gradient(0deg, #a97a45 0 6px, #8a5a2e 6px 8px)';
      if (kind === 'blanket') return 'repeating-linear-gradient(45deg, #e34948 0 6px, #f7f7f2 6px 12px)';
      return '#cccccc';
    }
    function buildPlantSVG(variety, potColor, planted) {
      const potHtml = planted ? '' : `
        <rect x="2" y="15" width="10" height="1" fill="${potColor}"/>
        <rect x="3" y="16" width="8" height="3" fill="${potColor}"/>
        <rect x="4" y="18" width="6" height="1" fill="rgba(0,0,0,0.18)"/>`;
      return `<svg width="24" height="34" viewBox="0 0 14 20" shape-rendering="crispEdges">
        ${variety.plant}
        ${potHtml}
      </svg>`;
    }
    const SECTIONS = [
      { name: 'Garden', icon: '\u{1F331}', theme: 'grass' },
      { name: 'Greenhouse', icon: '\u{1F33F}', theme: 'glass' },
      { name: 'House', icon: '\u{1F3E1}', theme: 'wood' },
      { name: 'Yard', icon: '\u{1F333}', theme: 'patio' },
      { name: 'Hedge Maze', icon: '\u{1F343}', theme: 'maze' },
      { name: 'Pond', icon: '\u{1F438}', theme: 'water' },
      { name: 'Vegetable Patch', icon: '\u{1F955}', theme: 'soil' },
      { name: 'Orchard', icon: '\u{1F34E}', theme: 'orchard' }
    ];
    const THEME_COLORS = {
      grass: ['#dcefd7', '#eef7ec'],
      glass: ['#cfe8f0', '#e4f4f8'],
      wood: ['#c9a06a', '#dab883'],
      patio: ['#d7d9c8', '#e8e9dc'],
      maze: ['#dcefd7', '#eef7ec'],
      water: ['#a9d8e6', '#c9e9f2'],
      soil: ['#b98a55', '#c89a68'],
      orchard: ['#d3ecc8', '#e6f5df']
    };
    const THEME_ORDER = ['grass', 'glass', 'wood', 'patio', 'maze', 'water', 'soil', 'orchard'];

    /* Colours for the scenery scattered over each theme: blades of grass,
       pebbles, worn earth. Picked per theme rather than shaded from the
       background, which only ever produced grey. */
    const THEME_DETAIL = {
      grass:   { tuft: '#7cb86f', tuft2: '#57964e', pebble: '#c4cbbd', path: '#cdb68c', patch: '#cbe4c3', edge: '#b9a179' },
      glass:   { tuft: '#84c6a4', tuft2: '#5da586', pebble: '#d6e5ea', path: '#b7c7ce', patch: '#c3e0e9', edge: '#a9bcc4' },
      wood:    { tuft: '#a9854f', tuft2: '#856232', pebble: '#e2cfae', path: '#a87f4b', patch: '#c69c66', edge: '#8a6537' },
      patio:   { tuft: '#a3b088', tuft2: '#7f8d64', pebble: '#eeecdf', path: '#c6c7b4', patch: '#dcdcc9', edge: '#b2b39f' },
      maze:    { tuft: '#6faa63', tuft2: '#4d8a45', pebble: '#c4cbbd', path: '#cdb68c', patch: '#c6e2be', edge: '#b9a179' },
      water:   { tuft: '#6fbccd', tuft2: '#4a9cb2', pebble: '#e2f1f6', path: '#96c9da', patch: '#b6e1ec', edge: '#87b7c8' },
      soil:    { tuft: '#8b9850', tuft2: '#697537', pebble: '#dcc9a6', path: '#a67c49', patch: '#c0905c', edge: '#8b6a3e' },
      orchard: { tuft: '#74b665', tuft2: '#529548', pebble: '#d0dbc6', path: '#c8b083', patch: '#c7e7be', edge: '#b39c76' }
    };
    const PET_TYPES = {
      dog: { label: 'Dog', icon: '\u{1F415}', cost: 10, temperament: 'friendly', svg: dogSVG },
      cat: { label: 'Cat', icon: '\u{1F408}', cost: 8, temperament: 'neutral', svg: catSVG },
      rabbit: { label: 'Rabbit', icon: '\u{1F430}', cost: 5, temperament: 'skittish', svg: rabbitSVG },
      bird: { label: 'Bird', icon: '\u{1F426}', cost: 5, temperament: 'skittish', svg: birdSVG }
    };
    /* One food for every animal - buy it, carry it over, give it to whichever
       companion you reach first. */
    const PET_FOOD = { label: 'Animal feed', icon: '\u{1F96A}', cost: 1, gain: 18 };
    /* Emoji has no shovel - the character that looks closest is a donkey -
       so the shop and the help buttons use a drawn one instead. */
    const SHOVEL_GLYPH =
      '<svg class="glyph-icon" viewBox="0 0 16 20" shape-rendering="crispEdges" role="img" aria-label="shovel"><rect x="5" y="1" width="6" height="2" fill="#9a6636"/><rect x="7" y="3" width="2" height="9" fill="#8a5a2e"/><rect x="4" y="11" width="8" height="1" fill="#7b818a"/><rect x="4" y="12" width="8" height="4" fill="#b9bec6"/><rect x="5" y="16" width="6" height="2" fill="#b9bec6"/><rect x="6" y="18" width="4" height="1" fill="#a4aab3"/><rect x="9" y="12" width="3" height="4" fill="#a4aab3"/><rect x="9" y="16" width="2" height="2" fill="#a4aab3"/></svg>';
    /* 'retired' keeps a definition alive so anything already bought still draws
       in the garden, while taking it off the shop shelf. The hose and the
       bucket never did anything - they were ornaments - so they are gone. */
    const SHOP_ITEMS = {
      hoe: { label: 'Hoe', icon: '\u{26CF}\u{FE0F}', cost: 3, svg: hoeSVG },
      hose: { label: 'Hose', icon: '\u{1F6BF}', cost: 4, svg: hoseSVG, retired: true },
      bucket: { label: 'Bucket', icon: '\u{1FAA3}', cost: 2, svg: bucketSVG, retired: true },
      axe: { label: 'Axe', icon: '\u{1FA93}', cost: 6, svg: axeSVG },
      shovel: { label: 'Shovel', icon: SHOVEL_GLYPH, cost: 6, svg: shovelSVG }
    };
    const OUTFITS = {
      classic: { label: 'Classic', icon: '\u{1F455}', cost: 0, hat: '#6b4423', shirt: '#3f9142', pants: '#2c3e8f' },
      strawhat: { label: 'Straw Hat & Overalls', icon: '\u{1F33E}', cost: 15, hat: '#eda100', shirt: '#4361ee', pants: '#2c5aa0' },
      flannel: { label: 'Red Flannel', icon: '\u{1F9E5}', cost: 12, hat: '#6b4423', shirt: '#d0353a', pants: '#3b3f45' },
      explorer: { label: 'Explorer Vest', icon: '\u{1F9ED}', cost: 18, hat: '#b98a55', shirt: '#6b8e4e', pants: '#5a4a35' },
      royal: { label: 'Royal Robes', icon: '\u{1F451}', cost: 25, hat: '#6a4fb0', shirt: '#7536ff', pants: '#4a3aa7' }
    };
    const PLANT_VARIETIES = [
      { name: 'Rose', plant: '<rect x="6" y="8" width="1" height="6" fill="#3f9142"/><rect x="4" y="10" width="2" height="1" fill="#2f7a34"/><rect x="8" y="9" width="2" height="1" fill="#2f7a34"/><rect x="4" y="3" width="6" height="5" fill="#d0353a"/><rect x="5" y="2" width="1" height="1" fill="#d0353a"/><rect x="8" y="2" width="1" height="1" fill="#d0353a"/>' },
      { name: 'Tulip', plant: '<rect x="6" y="7" width="1" height="7" fill="#3f9142"/><rect x="3" y="10" width="3" height="1" fill="#2f7a34"/><rect x="4" y="3" width="6" height="5" fill="#e0546a"/><rect x="5" y="2" width="4" height="1" fill="#e0546a"/>' },
      { name: 'Sunflower', plant: '<rect x="6" y="9" width="1" height="5" fill="#3f9142"/><rect x="3" y="11" width="2" height="1" fill="#2f7a34"/><rect x="9" y="10" width="2" height="1" fill="#2f7a34"/><rect x="2" y="2" width="10" height="8" fill="#f4c430"/><rect x="5" y="5" width="4" height="4" fill="#6b4423"/>' },
      { name: 'Daisy', plant: '<rect x="6" y="8" width="1" height="6" fill="#3f9142"/><rect x="3" y="3" width="8" height="6" fill="#f7f7f2"/><rect x="6" y="5" width="2" height="2" fill="#f4c430"/>' },
      { name: 'Lavender', plant: '<rect x="6" y="5" width="1" height="9" fill="#3f9142"/><rect x="4" y="1" width="1" height="1" fill="#9b8ad4"/><rect x="6" y="0" width="1" height="1" fill="#9b8ad4"/><rect x="8" y="1" width="1" height="1" fill="#9b8ad4"/><rect x="5" y="3" width="1" height="1" fill="#6a4fb0"/><rect x="7" y="3" width="1" height="1" fill="#6a4fb0"/><rect x="6" y="2" width="1" height="1" fill="#6a4fb0"/>' },
      { name: 'Cactus', plant: '<rect x="5" y="3" width="4" height="10" fill="#4c8c3c"/><rect x="2" y="6" width="2" height="5" fill="#4c8c3c"/><rect x="9" y="5" width="2" height="5" fill="#4c8c3c"/><rect x="6" y="1" width="2" height="2" fill="#e87ba4"/>' },
      { name: 'Succulent', plant: '<rect x="5" y="7" width="4" height="4" fill="#3fb8a8"/><rect x="3" y="8" width="2" height="2" fill="#3fb8a8"/><rect x="9" y="8" width="2" height="2" fill="#3fb8a8"/><rect x="4" y="5" width="2" height="2" fill="#6bc06e"/><rect x="8" y="5" width="2" height="2" fill="#6bc06e"/><rect x="6" y="4" width="2" height="2" fill="#6bc06e"/>' },
      { name: 'Orchid', plant: '<rect x="6" y="6" width="1" height="7" fill="#3f9142"/><rect x="7" y="5" width="1" height="1" fill="#3f9142"/><rect x="7" y="2" width="3" height="3" fill="#6a4fb0"/><rect x="4" y="4" width="3" height="3" fill="#e87ba4"/>' },
      { name: 'Venus Flytrap', plant: '<rect x="5" y="8" width="1" height="5" fill="#3f9142"/><rect x="8" y="8" width="1" height="5" fill="#3f9142"/><rect x="3" y="5" width="4" height="3" fill="#2f7a34"/><rect x="4" y="6" width="2" height="1" fill="#d0353a"/><rect x="7" y="4" width="4" height="3" fill="#2f7a34"/><rect x="8" y="5" width="2" height="1" fill="#d0353a"/>' },
      { name: 'Tomato Plant', plant: '<rect x="6" y="11" width="1" height="2" fill="#3f9142"/><rect x="3" y="5" width="8" height="6" fill="#2f7a34"/><rect x="4" y="6" width="2" height="2" fill="#d0353a"/><rect x="8" y="8" width="2" height="2" fill="#d0353a"/><rect x="6" y="5" width="2" height="2" fill="#d0353a"/>' },
      { name: 'Blueberry Bush', plant: '<rect x="6" y="11" width="1" height="2" fill="#6b4423"/><rect x="3" y="5" width="8" height="6" fill="#3f9142"/><rect x="4" y="6" width="1" height="1" fill="#4361ee"/><rect x="7" y="7" width="1" height="1" fill="#4361ee"/><rect x="9" y="6" width="1" height="1" fill="#4361ee"/><rect x="5" y="9" width="1" height="1" fill="#4361ee"/>' },
      { name: 'Marigold', plant: '<rect x="6" y="9" width="1" height="5" fill="#3f9142"/><rect x="4" y="3" width="6" height="6" fill="#eb9c34"/><rect x="6" y="5" width="2" height="2" fill="#f4c430"/>' },
      { name: 'Peace Lily', plant: '<rect x="3" y="6" width="8" height="6" fill="#2f7a34"/><rect x="6" y="2" width="3" height="5" fill="#f7f7f2"/><rect x="7" y="2" width="1" height="2" fill="#f4c430"/>' },
      { name: 'Poppy', plant: '<rect x="6" y="7" width="1" height="7" fill="#3f9142"/><rect x="4" y="3" width="6" height="4" fill="#d0353a"/><rect x="3" y="4" width="1" height="2" fill="#e0546a"/><rect x="10" y="4" width="1" height="2" fill="#e0546a"/><rect x="6" y="4" width="2" height="2" fill="#3b3f45"/>' },
      { name: 'Bluebell', plant: '<rect x="6" y="2" width="1" height="12" fill="#3f9142"/><rect x="3" y="5" width="3" height="2" fill="#4361ee"/><rect x="7" y="7" width="3" height="2" fill="#4361ee"/><rect x="3" y="9" width="3" height="2" fill="#5a78f0"/><rect x="7" y="11" width="3" height="2" fill="#5a78f0"/>' },
      { name: 'Hyacinth', plant: '<rect x="6" y="9" width="1" height="5" fill="#3f9142"/><rect x="4" y="2" width="5" height="7" fill="#6a4fb0"/><rect x="5" y="1" width="3" height="1" fill="#9b8ad4"/><rect x="4" y="4" width="5" height="1" fill="#9b8ad4"/><rect x="4" y="7" width="5" height="1" fill="#9b8ad4"/>' },
      { name: 'Chrysanthemum', plant: '<rect x="6" y="10" width="1" height="4" fill="#2f7a34"/><rect x="3" y="4" width="8" height="6" fill="#eb9c34"/><rect x="2" y="6" width="1" height="2" fill="#f4c430"/><rect x="11" y="6" width="1" height="2" fill="#f4c430"/><rect x="5" y="3" width="4" height="1" fill="#f4c430"/><rect x="6" y="6" width="2" height="2" fill="#eb6834"/>' },
      { name: 'Foxglove', plant: '<rect x="6" y="4" width="1" height="10" fill="#2f7a34"/><rect x="7" y="3" width="3" height="2" fill="#e87ba4"/><rect x="3" y="5" width="3" height="2" fill="#e87ba4"/><rect x="7" y="7" width="3" height="2" fill="#d4649a"/><rect x="3" y="9" width="3" height="2" fill="#d4649a"/><rect x="5" y="1" width="3" height="2" fill="#f2a0c4"/>' },
      { name: 'Geranium', plant: '<rect x="6" y="10" width="1" height="4" fill="#3f9142"/><rect x="3" y="8" width="8" height="3" fill="#2f7a34"/><rect x="4" y="3" width="3" height="3" fill="#d0353a"/><rect x="7" y="4" width="3" height="3" fill="#e0546a"/><rect x="6" y="1" width="3" height="3" fill="#d0353a"/>' },
      { name: 'Hydrangea', plant: '<rect x="6" y="11" width="1" height="3" fill="#2f7a34"/><rect x="3" y="9" width="8" height="2" fill="#3f9142"/><rect x="3" y="3" width="8" height="6" fill="#9b8ad4"/><rect x="4" y="2" width="6" height="1" fill="#b3a4e0"/><rect x="5" y="5" width="2" height="2" fill="#7a9fe8"/><rect x="8" y="4" width="2" height="2" fill="#7a9fe8"/>' },
      { name: 'Camellia', plant: '<rect x="6" y="10" width="1" height="4" fill="#6b4423"/><rect x="2" y="7" width="4" height="3" fill="#2f7a34"/><rect x="8" y="7" width="4" height="3" fill="#2f7a34"/><rect x="4" y="2" width="6" height="5" fill="#e87ba4"/><rect x="6" y="4" width="2" height="2" fill="#f7f7f2"/>' },
      { name: 'Begonia', plant: '<rect x="6" y="11" width="1" height="3" fill="#4c8c3c"/><rect x="2" y="8" width="10" height="3" fill="#4c8c3c"/><rect x="4" y="5" width="6" height="3" fill="#eb6834"/><rect x="5" y="3" width="4" height="2" fill="#d0353a"/>' },
      { name: 'Petunia', plant: '<rect x="6" y="9" width="1" height="5" fill="#3f9142"/><rect x="2" y="4" width="4" height="4" fill="#7536ff"/><rect x="7" y="5" width="4" height="4" fill="#9b8ad4"/><rect x="3" y="5" width="2" height="2" fill="#c4aee6"/><rect x="8" y="6" width="2" height="2" fill="#c4aee6"/>' },
      { name: 'Zinnia', plant: '<rect x="6" y="10" width="1" height="4" fill="#3f9142"/><rect x="3" y="3" width="8" height="7" fill="#e0546a"/><rect x="5" y="2" width="4" height="1" fill="#f2a0c4"/><rect x="5" y="5" width="4" height="3" fill="#f4c430"/><rect x="6" y="6" width="2" height="1" fill="#eb9c34"/>' },
      { name: 'Iris', plant: '<rect x="6" y="8" width="1" height="6" fill="#4c8c3c"/><rect x="3" y="9" width="1" height="5" fill="#4c8c3c"/><rect x="9" y="9" width="1" height="5" fill="#4c8c3c"/><rect x="4" y="4" width="6" height="4" fill="#6a4fb0"/><rect x="5" y="2" width="2" height="2" fill="#9b8ad4"/><rect x="8" y="2" width="2" height="2" fill="#9b8ad4"/><rect x="6" y="5" width="2" height="1" fill="#f4c430"/>' },
      { name: 'Carnation', plant: '<rect x="6" y="9" width="1" height="5" fill="#4c8c3c"/><rect x="4" y="4" width="6" height="5" fill="#e87ba4"/><rect x="3" y="5" width="1" height="3" fill="#f2a0c4"/><rect x="10" y="5" width="1" height="3" fill="#f2a0c4"/><rect x="5" y="3" width="1" height="1" fill="#f2a0c4"/><rect x="8" y="3" width="1" height="1" fill="#f2a0c4"/>' },
      { name: 'Freesia', plant: '<rect x="3" y="6" width="1" height="8" fill="#3f9142"/><rect x="4" y="5" width="6" height="1" fill="#3f9142"/><rect x="9" y="3" width="3" height="3" fill="#f4c430"/><rect x="6" y="2" width="3" height="3" fill="#eda100"/><rect x="3" y="2" width="3" height="3" fill="#f4c430"/>' },
      { name: 'Jasmine', plant: '<rect x="6" y="6" width="1" height="8" fill="#2f7a34"/><rect x="3" y="8" width="3" height="1" fill="#3f9142"/><rect x="7" y="10" width="3" height="1" fill="#3f9142"/><rect x="2" y="4" width="3" height="3" fill="#f7f7f2"/><rect x="6" y="2" width="3" height="3" fill="#f7f7f2"/><rect x="9" y="6" width="3" height="3" fill="#f7f7f2"/><rect x="3" y="5" width="1" height="1" fill="#f4c430"/><rect x="7" y="3" width="1" height="1" fill="#f4c430"/>' },
      { name: 'Strawberry Plant', plant: '<rect x="6" y="11" width="1" height="3" fill="#2f7a34"/><rect x="2" y="6" width="10" height="5" fill="#3f9142"/><rect x="3" y="8" width="2" height="2" fill="#d0353a"/><rect x="7" y="7" width="2" height="2" fill="#d0353a"/><rect x="9" y="9" width="2" height="2" fill="#e0546a"/><rect x="5" y="4" width="2" height="2" fill="#f7f7f2"/>' },
      { name: 'Chilli Plant', plant: '<rect x="6" y="9" width="1" height="5" fill="#2f7a34"/><rect x="3" y="3" width="8" height="6" fill="#4c8c3c"/><rect x="4" y="8" width="1" height="4" fill="#d0353a"/><rect x="8" y="9" width="1" height="4" fill="#eb6834"/><rect x="6" y="10" width="1" height="3" fill="#d0353a"/>' },
      { name: 'Rosemary', plant: '<rect x="6" y="4" width="1" height="10" fill="#4c8c3c"/><rect x="4" y="5" width="2" height="1" fill="#6bc06e"/><rect x="7" y="6" width="2" height="1" fill="#6bc06e"/><rect x="4" y="8" width="2" height="1" fill="#6bc06e"/><rect x="7" y="9" width="2" height="1" fill="#6bc06e"/><rect x="4" y="11" width="2" height="1" fill="#6bc06e"/><rect x="5" y="2" width="3" height="2" fill="#9b8ad4"/>' },
      { name: 'Snapdragon', plant: '<rect x="6" y="6" width="1" height="8" fill="#2f7a34"/><rect x="7" y="2" width="4" height="3" fill="#e0546a"/><rect x="3" y="5" width="4" height="3" fill="#f2a0c4"/><rect x="7" y="8" width="4" height="3" fill="#e0546a"/><rect x="5" y="1" width="2" height="2" fill="#f2a0c4"/>' },
      { name: 'Cornflower', plant: '<rect x="6" y="8" width="1" height="6" fill="#4c8c3c"/><rect x="4" y="4" width="6" height="4" fill="#4361ee"/><rect x="3" y="5" width="1" height="2" fill="#5a78f0"/><rect x="10" y="5" width="1" height="2" fill="#5a78f0"/><rect x="5" y="3" width="1" height="1" fill="#5a78f0"/><rect x="8" y="3" width="1" height="1" fill="#5a78f0"/>' },
      { name: 'Nasturtium', plant: '<rect x="6" y="10" width="1" height="4" fill="#3f9142"/><rect x="2" y="7" width="5" height="3" fill="#6bc06e"/><rect x="8" y="8" width="4" height="2" fill="#6bc06e"/><rect x="4" y="3" width="6" height="4" fill="#eb6834"/><rect x="6" y="4" width="2" height="2" fill="#f4c430"/>' },
      { name: 'Pansy', plant: '<rect x="6" y="10" width="1" height="4" fill="#3f9142"/><rect x="3" y="4" width="4" height="4" fill="#6a4fb0"/><rect x="7" y="4" width="4" height="4" fill="#7536ff"/><rect x="4" y="7" width="6" height="3" fill="#f4c430"/><rect x="6" y="6" width="2" height="2" fill="#3b3f45"/>' },
      { name: 'Violet', plant: '<rect x="6" y="10" width="1" height="4" fill="#2f7a34"/><rect x="2" y="9" width="4" height="3" fill="#3f9142"/><rect x="8" y="9" width="4" height="3" fill="#3f9142"/><rect x="4" y="5" width="3" height="3" fill="#6a4fb0"/><rect x="8" y="6" width="3" height="3" fill="#9b8ad4"/><rect x="6" y="3" width="3" height="3" fill="#6a4fb0"/>' },
      { name: 'Primrose', plant: '<rect x="6" y="10" width="1" height="4" fill="#3f9142"/><rect x="2" y="9" width="10" height="2" fill="#2f7a34"/><rect x="3" y="4" width="4" height="4" fill="#f4c430"/><rect x="8" y="5" width="4" height="4" fill="#eda100"/><rect x="4" y="5" width="2" height="2" fill="#eb9c34"/>' },
      { name: 'Crocus', plant: '<rect x="6" y="9" width="1" height="5" fill="#4c8c3c"/><rect x="4" y="9" width="1" height="5" fill="#6bc06e"/><rect x="9" y="9" width="1" height="5" fill="#6bc06e"/><rect x="5" y="3" width="4" height="6" fill="#9b8ad4"/><rect x="6" y="2" width="2" height="1" fill="#c4aee6"/><rect x="6" y="5" width="2" height="2" fill="#f4c430"/>' },
      { name: 'Daffodil', plant: '<rect x="6" y="8" width="1" height="6" fill="#3f9142"/><rect x="3" y="9" width="1" height="5" fill="#6bc06e"/><rect x="3" y="4" width="8" height="4" fill="#f4c430"/><rect x="5" y="2" width="4" height="3" fill="#eda100"/><rect x="6" y="3" width="2" height="1" fill="#eb9c34"/>' },
      { name: 'Amaryllis', plant: '<rect x="6" y="8" width="2" height="6" fill="#3f9142"/><rect x="2" y="3" width="4" height="4" fill="#d0353a"/><rect x="8" y="3" width="4" height="4" fill="#e0546a"/><rect x="5" y="1" width="4" height="3" fill="#d0353a"/><rect x="6" y="4" width="2" height="2" fill="#f7f7f2"/>' },
      { name: 'Gladiolus', plant: '<rect x="5" y="2" width="2" height="12" fill="#3f9142"/><rect x="7" y="3" width="3" height="2" fill="#e87ba4"/><rect x="7" y="6" width="3" height="2" fill="#e0546a"/><rect x="7" y="9" width="3" height="2" fill="#e87ba4"/><rect x="2" y="5" width="3" height="2" fill="#e0546a"/><rect x="2" y="8" width="3" height="2" fill="#e87ba4"/>' },
      { name: 'Lupin', plant: '<rect x="6" y="9" width="1" height="5" fill="#4c8c3c"/><rect x="4" y="2" width="5" height="7" fill="#6a4fb0"/><rect x="5" y="1" width="3" height="1" fill="#9b8ad4"/><rect x="4" y="4" width="5" height="1" fill="#9b8ad4"/><rect x="4" y="7" width="5" height="1" fill="#9b8ad4"/><rect x="3" y="10" width="7" height="1" fill="#6bc06e"/>' },
      { name: 'Magnolia', plant: '<rect x="6" y="10" width="2" height="4" fill="#6b4423"/><rect x="2" y="8" width="4" height="2" fill="#2f7a34"/><rect x="8" y="8" width="4" height="2" fill="#2f7a34"/><rect x="3" y="3" width="8" height="5" fill="#f7f7f2"/><rect x="4" y="2" width="6" height="1" fill="#f2e2d0"/><rect x="6" y="5" width="2" height="2" fill="#e87ba4"/>' },
      { name: 'Azalea', plant: '<rect x="6" y="11" width="1" height="3" fill="#6b4423"/><rect x="2" y="8" width="10" height="3" fill="#2f7a34"/><rect x="3" y="4" width="4" height="4" fill="#e87ba4"/><rect x="7" y="3" width="4" height="4" fill="#f2a0c4"/><rect x="5" y="6" width="4" height="2" fill="#e0546a"/>' },
      { name: 'Gardenia', plant: '<rect x="6" y="11" width="1" height="3" fill="#2f7a34"/><rect x="2" y="7" width="4" height="4" fill="#2f7a34"/><rect x="8" y="7" width="4" height="4" fill="#3f9142"/><rect x="4" y="3" width="6" height="5" fill="#f7f7f2"/><rect x="5" y="2" width="4" height="1" fill="#f2e2d0"/><rect x="6" y="5" width="2" height="2" fill="#f4c430"/>' },
      { name: 'Bird of Paradise', plant: '<rect x="6" y="7" width="1" height="7" fill="#3f9142"/><rect x="2" y="8" width="4" height="2" fill="#2f7a34"/><rect x="3" y="6" width="6" height="2" fill="#4c8c3c"/><rect x="8" y="3" width="4" height="2" fill="#eb6834"/><rect x="6" y="2" width="3" height="2" fill="#f4c430"/><rect x="9" y="5" width="3" height="2" fill="#4361ee"/>' },
      { name: 'Protea', plant: '<rect x="6" y="10" width="2" height="4" fill="#6b4423"/><rect x="3" y="5" width="8" height="5" fill="#e87ba4"/><rect x="2" y="6" width="1" height="3" fill="#e0546a"/><rect x="11" y="6" width="1" height="3" fill="#e0546a"/><rect x="5" y="3" width="4" height="2" fill="#f2a0c4"/><rect x="6" y="6" width="2" height="3" fill="#f7f7f2"/>' },
      { name: 'Prickly Pear', plant: '<rect x="5" y="7" width="5" height="7" fill="#4c8c3c"/><rect x="2" y="4" width="4" height="5" fill="#4c8c3c"/><rect x="9" y="3" width="4" height="5" fill="#4c8c3c"/><rect x="3" y="3" width="2" height="1" fill="#eb6834"/><rect x="10" y="2" width="2" height="1" fill="#eb6834"/><rect x="6" y="6" width="1" height="1" fill="#f4c430"/>' },
      { name: 'String of Pearls', plant: '<rect x="2" y="2" width="10" height="2" fill="#6b4423"/><rect x="3" y="4" width="2" height="2" fill="#6bc06e"/><rect x="3" y="7" width="2" height="2" fill="#6bc06e"/><rect x="3" y="10" width="2" height="2" fill="#6bc06e"/><rect x="7" y="4" width="2" height="2" fill="#3fb8a8"/><rect x="7" y="7" width="2" height="2" fill="#3fb8a8"/><rect x="10" y="5" width="2" height="2" fill="#6bc06e"/><rect x="10" y="8" width="2" height="2" fill="#6bc06e"/>' },
      { name: 'Wisteria', plant: '<rect x="1" y="2" width="12" height="2" fill="#6b4423"/><rect x="3" y="4" width="2" height="6" fill="#9b8ad4"/><rect x="6" y="4" width="2" height="8" fill="#c4aee6"/><rect x="9" y="4" width="2" height="5" fill="#9b8ad4"/><rect x="3" y="9" width="2" height="1" fill="#6a4fb0"/><rect x="6" y="11" width="2" height="1" fill="#6a4fb0"/>' }
    ];
    const THEME_STEP_SOUND = {
      grass: 'grass', glass: 'stone', wood: 'wood', patio: 'stone',
      maze: 'grass', water: 'water', soil: 'dirt', orchard: 'grass'
    };
  /* ======================================================================
     OCEAN
     Same shapes, same slots, different world. Every array and key below
     lines up one-for-one with the garden above.
     ====================================================================== */

  /* --- structures --- */

  function kelpSVG() {
    return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="7" y="4" width="2" height="16" fill="#2f6b46"/><rect x="4" y="6" width="3" height="2" fill="#3f8f5c"/><rect x="9" y="9" width="3" height="2" fill="#3f8f5c"/><rect x="4" y="12" width="3" height="2" fill="#56b07a"/><rect x="9" y="15" width="3" height="2" fill="#3f8f5c"/><rect x="6" y="1" width="4" height="3" fill="#56b07a"/></svg>`;
  }

  function coralTreeSVG() {
    return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="7" y="12" width="2" height="8" fill="#c96a58"/><rect x="3" y="6" width="2" height="7" fill="#e0705a"/><rect x="11" y="7" width="2" height="6" fill="#e0705a"/><rect x="5" y="4" width="6" height="3" fill="#f0906a"/><rect x="2" y="4" width="3" height="2" fill="#f0906a"/><rect x="11" y="5" width="3" height="2" fill="#f0906a"/><rect x="6" y="1" width="2" height="3" fill="#ffb08c"/></svg>`;
  }

  function fishingNetSVG(width) {
    const w = (width || 2) * TILE - 4;
    return `<svg width="${w}" height="34" viewBox="0 0 32 20" preserveAspectRatio="none" shape-rendering="crispEdges"><rect x="1" y="3" width="1" height="12" fill="#6b5a45"/><rect x="30" y="3" width="1" height="12" fill="#6b5a45"/><rect x="1" y="4" width="30" height="1" fill="#d9d2c0"/><rect x="1" y="9" width="30" height="1" fill="#d9d2c0"/><rect x="6" y="4" width="1" height="6" fill="#d9d2c0"/><rect x="12" y="4" width="1" height="6" fill="#d9d2c0"/><rect x="18" y="4" width="1" height="6" fill="#d9d2c0"/><rect x="24" y="4" width="1" height="6" fill="#d9d2c0"/><rect x="8" y="10" width="3" height="3" fill="#5bb3cc"/><rect x="20" y="10" width="3" height="3" fill="#e0705a"/></svg>`;
  }

  function chestSVG() {
    return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="2" y="11" width="12" height="7" fill="#8a5a2e"/><rect x="2" y="8" width="12" height="3" fill="#a97a45"/><rect x="2" y="10" width="12" height="1" fill="#eda100"/><rect x="7" y="12" width="2" height="3" fill="#eda100"/><rect x="2" y="17" width="12" height="1" fill="#5a3a1e"/></svg>`;
  }

  function spongeSVG() {
    return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="3" y="10" width="10" height="8" fill="#d4526b"/><rect x="4" y="7" width="8" height="4" fill="#e0708a"/><rect x="6" y="5" width="4" height="3" fill="#e88fa8"/><rect x="5" y="12" width="2" height="2" fill="#b03a55"/><rect x="9" y="14" width="2" height="2" fill="#b03a55"/><rect x="8" y="9" width="2" height="2" fill="#b03a55"/></svg>`;
  }

  function anchorSVG() {
    return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="7" y="4" width="2" height="12" fill="#8a94a0"/><rect x="4" y="7" width="8" height="1" fill="#8a94a0"/><rect x="6" y="2" width="4" height="2" fill="#8a94a0"/><rect x="3" y="13" width="2" height="3" fill="#6b7580"/><rect x="11" y="13" width="2" height="3" fill="#6b7580"/><rect x="3" y="16" width="10" height="1" fill="#6b7580"/></svg>`;
  }

  function flatRockSVG() {
    return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="2" y="9" width="12" height="4" fill="#7a8794"/><rect x="3" y="7" width="10" height="2" fill="#8f9caa"/><rect x="5" y="13" width="6" height="4" fill="#5f6b78"/><rect x="4" y="8" width="3" height="1" fill="#a8b4c0"/></svg>`;
  }

  function ventSVG() {
    return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="4" y="12" width="8" height="6" fill="#3a4a5a"/><rect x="5" y="9" width="6" height="3" fill="#2c3a48"/><rect x="6" y="6" width="2" height="2" fill="#c9d8e0"/><rect x="9" y="3" width="2" height="2" fill="#e0edf2"/><rect x="6" y="1" width="2" height="1" fill="#e0edf2"/><rect x="6" y="14" width="2" height="2" fill="#eb6834"/></svg>`;
  }

  function coralWallSVG() {
    return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="0" y="6" width="16" height="12" fill="#d4526b"/><rect x="1" y="4" width="5" height="3" fill="#e0708a"/><rect x="9" y="3" width="5" height="4" fill="#e0708a"/><rect x="3" y="9" width="2" height="2" fill="#b03a55"/><rect x="11" y="12" width="2" height="2" fill="#b03a55"/><rect x="6" y="14" width="3" height="2" fill="#b03a55"/></svg>`;
  }

  function bubbleAnemoneSVG() {
    return `<svg width="26" height="26" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="4" y="8" width="8" height="4" fill="#8e6bb0"/><rect x="3" y="6" width="2" height="3" fill="#a78bd0"/><rect x="6" y="4" width="2" height="4" fill="#a78bd0"/><rect x="9" y="5" width="2" height="4" fill="#a78bd0"/><rect x="11" y="7" width="2" height="3" fill="#a78bd0"/><rect x="6" y="10" width="3" height="2" fill="#6a4fb0"/></svg>`;
  }

  /* --- tools --- */

  function sandRakeSVG() {
    return `<svg width="20" height="26" viewBox="0 0 12 16" shape-rendering="crispEdges"><rect x="5" y="2" width="1" height="9" fill="#c9b892"/><rect x="2" y="11" width="8" height="1" fill="#8a94a0"/><rect x="2" y="12" width="1" height="2" fill="#8a94a0"/><rect x="5" y="12" width="1" height="2" fill="#8a94a0"/><rect x="8" y="12" width="1" height="2" fill="#8a94a0"/></svg>`;
  }

  function currentJetSVG() {
    return `<svg width="20" height="26" viewBox="0 0 12 16" shape-rendering="crispEdges"><rect x="3" y="6" width="5" height="4" fill="#3d8fb0"/><rect x="8" y="7" width="3" height="2" fill="#5bb3cc"/><rect x="2" y="10" width="3" height="4" fill="#2b6f8f"/><rect x="9" y="3" width="1" height="1" fill="#a8dfe8"/><rect x="10" y="5" width="1" height="1" fill="#a8dfe8"/></svg>`;
  }

  function shellPailSVG() {
    return `<svg width="20" height="26" viewBox="0 0 12 16" shape-rendering="crispEdges"><rect x="3" y="7" width="7" height="6" fill="#f2e2d0"/><rect x="3" y="6" width="7" height="1" fill="#e0c8b0"/><rect x="5" y="8" width="1" height="4" fill="#e0c8b0"/><rect x="7" y="8" width="1" height="4" fill="#e0c8b0"/><rect x="2" y="4" width="1" height="3" fill="#d9b9a0"/></svg>`;
  }

  function coralSawSVG() {
    return `<svg width="20" height="26" viewBox="0 0 12 16" shape-rendering="crispEdges"><rect x="2" y="10" width="3" height="4" fill="#8a5a2e"/><rect x="4" y="5" width="6" height="4" fill="#c9d8e0"/><rect x="4" y="9" width="1" height="1" fill="#8a94a0"/><rect x="6" y="9" width="1" height="1" fill="#8a94a0"/><rect x="8" y="9" width="1" height="1" fill="#8a94a0"/></svg>`;
  }

  function sandScoopSVG() {
    return `<svg width="20" height="26" viewBox="0 0 12 16" shape-rendering="crispEdges"><rect x="5" y="2" width="1" height="8" fill="#c9b892"/><rect x="3" y="10" width="6" height="4" fill="#8a94a0"/><rect x="4" y="14" width="4" height="1" fill="#6b7580"/></svg>`;
  }

  function driftwoodSVG() {
    return `<svg width="26" height="26" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="2" y="7" width="12" height="4" fill="#a89880"/><rect x="2" y="7" width="12" height="1" fill="#c0b298"/><rect x="4" y="9" width="2" height="1" fill="#8a7c68"/><rect x="9" y="9" width="3" height="1" fill="#8a7c68"/></svg>`;
  }

  function oceanSeedlingShapes() {
    return '<rect x="6" y="12" width="1" height="3" fill="#2f6b46"/>'
         + '<rect x="4" y="11" width="2" height="1" fill="#56b07a"/>'
         + '<rect x="7" y="10" width="2" height="1" fill="#7cc79a"/>';
  }

  function kelpSproutSVG() {
    return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="7" y="13" width="2" height="6" fill="#2f6b46"/><rect x="5" y="11" width="3" height="2" fill="#56b07a"/><rect x="8" y="9" width="3" height="2" fill="#56b07a"/><rect x="6" y="7" width="3" height="2" fill="#7cc79a"/></svg>`;
  }

  /* A grotto rises from driftwood the same way a cabin does - same ten
     stages, same thresholds, different masonry. */
  function grottoSVG(logCount) {
    const p = Math.max(0, Math.min(10, logCount));
    if (p < 2) return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"></svg>`;

    let rects = `<rect x="0" y="18" width="16" height="2" fill="#5f6b78"/>`;

    if (p >= 3) {
      const wallH = Math.round((Math.min(p, 7) - 2) / 5 * 12);
      rects += `<rect x="1" y="${19 - wallH}" width="14" height="${wallH}" fill="#7a8794"/>`;
      for (let y = 19 - wallH; y < 19; y += 2) rects += `<rect x="1" y="${y}" width="14" height="1" fill="#5f6b78"/>`;
    }

    if (p >= 7) {
      rects += `<rect x="0" y="5" width="16" height="3" fill="#4f5b68"/>`;
    }
    if (p >= 9) {
      rects += `<rect x="2" y="3" width="12" height="2" fill="#d4526b"/>`;
    }

    if (p >= 10) {
      rects += `<rect x="6" y="12" width="4" height="7" fill="#2c3a48"/><rect x="9" y="15" width="1" height="1" fill="#a8dfe8"/>`;
      rects += `<rect x="2" y="9" width="3" height="3" fill="#5bb3cc"/><rect x="3" y="10" width="1" height="1" fill="#a8dfe8"/>`;
      rects += `<rect x="11" y="9" width="3" height="3" fill="#5bb3cc"/><rect x="12" y="10" width="1" height="1" fill="#a8dfe8"/>`;
    }

    return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges">${rects}</svg>`;
  }

  /* --- creatures --- */

  function clownfishSVG() {
    return `<svg width="24" height="22" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="3" y="6" width="9" height="6" fill="#eb6834"/><rect x="5" y="6" width="2" height="6" fill="#f7f7f2"/><rect x="9" y="6" width="2" height="6" fill="#f7f7f2"/><rect x="0" y="7" width="3" height="4" fill="#eb6834"/><rect x="12" y="7" width="2" height="2" fill="#1f2430"/><rect x="6" y="4" width="3" height="2" fill="#eb6834"/></svg>`;
  }

  function seahorseSVG() {
    return `<svg width="24" height="22" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="6" y="2" width="4" height="3" fill="#eda100"/><rect x="9" y="3" width="3" height="1" fill="#eda100"/><rect x="10" y="2" width="1" height="1" fill="#1f2430"/><rect x="6" y="5" width="4" height="6" fill="#f0b73c"/><rect x="5" y="8" width="1" height="4" fill="#eda100"/><rect x="6" y="11" width="3" height="2" fill="#eda100"/><rect x="8" y="13" width="3" height="1" fill="#eda100"/></svg>`;
  }

  function seaTurtleSVG() {
    return `<svg width="24" height="22" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="3" y="6" width="9" height="6" fill="#3f8f5c"/><rect x="5" y="7" width="2" height="2" fill="#2f6b46"/><rect x="8" y="9" width="2" height="2" fill="#2f6b46"/><rect x="12" y="7" width="3" height="3" fill="#56b07a"/><rect x="14" y="8" width="1" height="1" fill="#1f2430"/><rect x="2" y="11" width="3" height="2" fill="#56b07a"/><rect x="9" y="11" width="3" height="2" fill="#56b07a"/></svg>`;
  }

  function jellyfishSVG() {
    return `<svg width="24" height="22" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="3" y="3" width="10" height="5" fill="#a78bd0"/><rect x="5" y="1" width="6" height="2" fill="#c4aee6"/><rect x="4" y="8" width="2" height="5" fill="#8e6bb0"/><rect x="7" y="8" width="2" height="6" fill="#8e6bb0"/><rect x="10" y="8" width="2" height="4" fill="#8e6bb0"/><rect x="5" y="4" width="1" height="1" fill="#f0e6ff"/></svg>`;
  }

  function krillSVG() {
    return `<svg width="18" height="18" viewBox="0 0 12 12" shape-rendering="crispEdges"><rect x="3" y="5" width="6" height="3" fill="#f0906a"/><rect x="2" y="6" width="1" height="1" fill="#e0705a"/><rect x="9" y="4" width="2" height="2" fill="#f0906a"/><rect x="4" y="8" width="1" height="1" fill="#e0705a"/><rect x="6" y="8" width="1" height="1" fill="#e0705a"/></svg>`;
  }

  /* --- mer-folk --- */

  /* Mer-folk: a tapering tail with a wide fluke, so it never reads as legs.
     Hair is its own colour and the outfit shows as a crown band, a shell top
     and the colour of the tail. */

  function merFemaleFrontSVG(o) {
    return `<svg width="30" height="32" viewBox="0 0 19 20" shape-rendering="crispEdges">
      <rect x="4" y="1" width="9" height="3" fill="#a8432c"/>
      <rect x="4" y="0" width="9" height="1" fill="${o.hat}"/>
      <rect x="2" y="3" width="2" height="10" fill="#a8432c"/>
      <rect x="13" y="3" width="2" height="10" fill="#a8432c"/>
      <rect x="5" y="4" width="7" height="6" fill="#f2c48d"/>
      <rect x="6" y="7" width="1" height="1" fill="#1f2430"/>
      <rect x="10" y="7" width="1" height="1" fill="#1f2430"/>
      <rect x="5" y="10" width="7" height="3" fill="#f2c48d"/>
      <rect x="5" y="10" width="3" height="2" fill="${o.shirt}"/>
      <rect x="9" y="10" width="3" height="2" fill="${o.shirt}"/>
      <rect x="3" y="10" width="2" height="4" fill="#f2c48d"/>
      <rect x="12" y="10" width="2" height="4" fill="#f2c48d"/>
      <rect x="5" y="13" width="7" height="3" fill="${o.pants}"/>
      <rect x="6" y="16" width="5" height="2" fill="${o.pants}"/>
      <rect x="6" y="14" width="1" height="1" fill="rgba(255,255,255,0.35)"/>
      <rect x="9" y="15" width="1" height="1" fill="rgba(255,255,255,0.35)"/>
      <rect x="7" y="17" width="3" height="1" fill="${o.pants}"/>
      <rect x="0" y="18" width="17" height="2" fill="${o.pants}"/>
      <rect x="7" y="19" width="3" height="1" fill="rgba(0,0,0,0.18)"/>
      <rect x="1" y="18" width="2" height="1" fill="rgba(255,255,255,0.3)"/>
      <rect x="14" y="18" width="2" height="1" fill="rgba(255,255,255,0.3)"/>
    </svg>`;
  }

  function merFemaleBackSVG(o) {
    return `<svg width="30" height="32" viewBox="0 0 19 20" shape-rendering="crispEdges">
      <rect x="4" y="0" width="9" height="1" fill="${o.hat}"/>
      <rect x="3" y="1" width="11" height="12" fill="#a8432c"/>
      <rect x="5" y="10" width="7" height="1" fill="${o.shirt}"/>
      <rect x="3" y="10" width="2" height="4" fill="#f2c48d"/>
      <rect x="12" y="10" width="2" height="4" fill="#f2c48d"/>
      <rect x="5" y="13" width="7" height="3" fill="${o.pants}"/>
      <rect x="6" y="16" width="5" height="2" fill="${o.pants}"/>
      <rect x="7" y="17" width="3" height="1" fill="${o.pants}"/>
      <rect x="0" y="18" width="17" height="2" fill="${o.pants}"/>
      <rect x="7" y="19" width="3" height="1" fill="rgba(0,0,0,0.18)"/>
      <rect x="1" y="18" width="2" height="1" fill="rgba(255,255,255,0.3)"/>
      <rect x="14" y="18" width="2" height="1" fill="rgba(255,255,255,0.3)"/>
    </svg>`;
  }

  function merFemaleSideSVG(o) {
    return `<svg width="30" height="32" viewBox="0 0 19 20" shape-rendering="crispEdges">
      <rect x="6" y="1" width="8" height="3" fill="#a8432c"/>
      <rect x="6" y="0" width="8" height="1" fill="${o.hat}"/>
      <rect x="4" y="3" width="3" height="11" fill="#a8432c"/>
      <rect x="7" y="4" width="6" height="6" fill="#f2c48d"/>
      <rect x="11" y="7" width="1" height="1" fill="#1f2430"/>
      <rect x="13" y="6" width="1" height="2" fill="#f2c48d"/>
      <rect x="7" y="10" width="6" height="3" fill="#f2c48d"/>
      <rect x="7" y="10" width="5" height="2" fill="${o.shirt}"/>
      <rect x="12" y="11" width="3" height="3" fill="#f2c48d"/>
      <rect x="7" y="13" width="6" height="3" fill="${o.pants}"/>
      <rect x="6" y="16" width="5" height="2" fill="${o.pants}"/>
      <rect x="7" y="14" width="1" height="1" fill="rgba(255,255,255,0.35)"/>
      <rect x="6" y="17" width="3" height="1" fill="${o.pants}"/>
      <rect x="0" y="18" width="15" height="2" fill="${o.pants}"/>
      <rect x="6" y="19" width="3" height="1" fill="rgba(0,0,0,0.18)"/>
      <rect x="1" y="18" width="2" height="1" fill="rgba(255,255,255,0.3)"/>
    </svg>`;
  }

  function merMaleFrontSVG(o) {
    return `<svg width="30" height="32" viewBox="0 0 19 20" shape-rendering="crispEdges">
      <rect x="5" y="1" width="8" height="3" fill="#5a3a1e"/>
      <rect x="5" y="0" width="8" height="1" fill="${o.hat}"/>
      <rect x="5" y="4" width="7" height="6" fill="#f2c48d"/>
      <rect x="6" y="7" width="1" height="1" fill="#1f2430"/>
      <rect x="10" y="7" width="1" height="1" fill="#1f2430"/>
      <rect x="4" y="10" width="9" height="3" fill="#f2c48d"/>
      <rect x="4" y="10" width="9" height="1" fill="${o.shirt}"/>
      <rect x="6" y="11" width="5" height="1" fill="${o.shirt}"/>
      <rect x="2" y="10" width="2" height="4" fill="#f2c48d"/>
      <rect x="13" y="10" width="2" height="4" fill="#f2c48d"/>
      <rect x="5" y="13" width="7" height="3" fill="${o.pants}"/>
      <rect x="6" y="16" width="5" height="2" fill="${o.pants}"/>
      <rect x="6" y="14" width="1" height="1" fill="rgba(255,255,255,0.35)"/>
      <rect x="9" y="15" width="1" height="1" fill="rgba(255,255,255,0.35)"/>
      <rect x="7" y="17" width="3" height="1" fill="${o.pants}"/>
      <rect x="0" y="18" width="17" height="2" fill="${o.pants}"/>
      <rect x="7" y="19" width="3" height="1" fill="rgba(0,0,0,0.18)"/>
      <rect x="1" y="18" width="2" height="1" fill="rgba(255,255,255,0.3)"/>
      <rect x="14" y="18" width="2" height="1" fill="rgba(255,255,255,0.3)"/>
    </svg>`;
  }

  function merMaleBackSVG(o) {
    return `<svg width="30" height="32" viewBox="0 0 19 20" shape-rendering="crispEdges">
      <rect x="5" y="0" width="8" height="1" fill="${o.hat}"/>
      <rect x="5" y="1" width="8" height="6" fill="#5a3a1e"/>
      <rect x="4" y="10" width="9" height="3" fill="#f2c48d"/>
      <rect x="4" y="10" width="9" height="1" fill="${o.shirt}"/>
      <rect x="2" y="10" width="2" height="4" fill="#f2c48d"/>
      <rect x="13" y="10" width="2" height="4" fill="#f2c48d"/>
      <rect x="5" y="13" width="7" height="3" fill="${o.pants}"/>
      <rect x="6" y="16" width="5" height="2" fill="${o.pants}"/>
      <rect x="7" y="17" width="3" height="1" fill="${o.pants}"/>
      <rect x="0" y="18" width="17" height="2" fill="${o.pants}"/>
      <rect x="7" y="19" width="3" height="1" fill="rgba(0,0,0,0.18)"/>
      <rect x="1" y="18" width="2" height="1" fill="rgba(255,255,255,0.3)"/>
      <rect x="14" y="18" width="2" height="1" fill="rgba(255,255,255,0.3)"/>
    </svg>`;
  }

  function merMaleSideSVG(o) {
    return `<svg width="30" height="32" viewBox="0 0 19 20" shape-rendering="crispEdges">
      <rect x="6" y="1" width="8" height="3" fill="#5a3a1e"/>
      <rect x="6" y="0" width="8" height="1" fill="${o.hat}"/>
      <rect x="7" y="4" width="6" height="6" fill="#f2c48d"/>
      <rect x="11" y="7" width="1" height="1" fill="#1f2430"/>
      <rect x="13" y="6" width="1" height="2" fill="#f2c48d"/>
      <rect x="6" y="10" width="8" height="3" fill="#f2c48d"/>
      <rect x="6" y="10" width="8" height="1" fill="${o.shirt}"/>
      <rect x="12" y="11" width="3" height="3" fill="#f2c48d"/>
      <rect x="7" y="13" width="6" height="3" fill="${o.pants}"/>
      <rect x="6" y="16" width="5" height="2" fill="${o.pants}"/>
      <rect x="7" y="14" width="1" height="1" fill="rgba(255,255,255,0.35)"/>
      <rect x="6" y="17" width="3" height="1" fill="${o.pants}"/>
      <rect x="0" y="18" width="15" height="2" fill="${o.pants}"/>
      <rect x="6" y="19" width="3" height="1" fill="rgba(0,0,0,0.18)"/>
      <rect x="1" y="18" width="2" height="1" fill="rgba(255,255,255,0.3)"/>
    </svg>`;
  }

  /* A shell instead of a terracotta pot, for a plant that is not bedded in. */
  function oceanPlantSVG(variety, potColor, planted) {
    const baseHtml = planted ? '' : `
      <rect x="2" y="15" width="10" height="1" fill="${potColor}"/>
      <rect x="3" y="16" width="8" height="3" fill="${potColor}"/>
      <rect x="5" y="16" width="1" height="3" fill="rgba(255,255,255,0.35)"/>
      <rect x="8" y="16" width="1" height="3" fill="rgba(255,255,255,0.35)"/>
      <rect x="4" y="18" width="6" height="1" fill="rgba(0,0,0,0.18)"/>`;
    return `<svg width="24" height="34" viewBox="0 0 14 20" shape-rendering="crispEdges">
      ${variety.plant}
      ${baseHtml}
    </svg>`;
  }

  /* Index-matched to the garden's 22 varieties, so a plant bought in one world
     keeps its identity in the other. */
  const OCEAN_PLANTS = [
    { name: 'Sea Rose', plant: '<rect x="6" y="9" width="1" height="5" fill="#2f6b46"/><rect x="4" y="4" width="6" height="5" fill="#d0353a"/><rect x="3" y="6" width="1" height="2" fill="#e0546a"/><rect x="10" y="6" width="1" height="2" fill="#e0546a"/><rect x="5" y="3" width="1" height="1" fill="#e0546a"/><rect x="8" y="3" width="1" height="1" fill="#e0546a"/>' },
    { name: 'Tube Anemone', plant: '<rect x="5" y="7" width="3" height="7" fill="#8e6bb0"/><rect x="3" y="3" width="2" height="4" fill="#c4aee6"/><rect x="6" y="1" width="2" height="5" fill="#c4aee6"/><rect x="9" y="3" width="2" height="4" fill="#c4aee6"/><rect x="4" y="6" width="6" height="1" fill="#a78bd0"/>' },
    { name: 'Sunflower Star', plant: '<rect x="6" y="10" width="1" height="4" fill="#c96a58"/><rect x="3" y="3" width="8" height="6" fill="#eda100"/><rect x="2" y="5" width="1" height="2" fill="#f0b73c"/><rect x="11" y="5" width="1" height="2" fill="#f0b73c"/><rect x="5" y="2" width="1" height="1" fill="#f0b73c"/><rect x="8" y="2" width="1" height="1" fill="#f0b73c"/><rect x="6" y="5" width="2" height="2" fill="#c96a58"/>' },
    { name: 'Feather Duster', plant: '<rect x="6" y="8" width="1" height="6" fill="#a89880"/><rect x="3" y="3" width="8" height="5" fill="#f2e2d0"/><rect x="4" y="1" width="2" height="2" fill="#e0c8b0"/><rect x="8" y="1" width="2" height="2" fill="#e0c8b0"/><rect x="6" y="5" width="2" height="2" fill="#d4526b"/>' },
    { name: 'Sea Lavender', plant: '<rect x="6" y="5" width="1" height="9" fill="#3f8f5c"/><rect x="4" y="1" width="1" height="1" fill="#a78bd0"/><rect x="6" y="0" width="1" height="1" fill="#a78bd0"/><rect x="8" y="1" width="1" height="1" fill="#a78bd0"/><rect x="5" y="3" width="1" height="1" fill="#6a4fb0"/><rect x="7" y="3" width="1" height="1" fill="#6a4fb0"/><rect x="6" y="2" width="1" height="1" fill="#6a4fb0"/>' },
    { name: 'Pipe Sponge', plant: '<rect x="5" y="4" width="2" height="10" fill="#e0705a"/><rect x="2" y="7" width="2" height="7" fill="#e0705a"/><rect x="8" y="6" width="2" height="8" fill="#e0705a"/><rect x="5" y="3" width="2" height="1" fill="#ffb08c"/><rect x="2" y="6" width="2" height="1" fill="#ffb08c"/><rect x="8" y="5" width="2" height="1" fill="#ffb08c"/>' },
    { name: 'Coral Polyps', plant: '<rect x="5" y="7" width="4" height="4" fill="#5bb3cc"/><rect x="3" y="8" width="2" height="2" fill="#5bb3cc"/><rect x="9" y="8" width="2" height="2" fill="#5bb3cc"/><rect x="4" y="5" width="2" height="2" fill="#a8dfe8"/><rect x="8" y="5" width="2" height="2" fill="#a8dfe8"/><rect x="6" y="4" width="2" height="2" fill="#a8dfe8"/>' },
    { name: 'Fan Coral', plant: '<rect x="6" y="10" width="1" height="4" fill="#c96a58"/><rect x="2" y="3" width="10" height="6" fill="#e88fa8"/><rect x="4" y="4" width="1" height="4" fill="#d4526b"/><rect x="7" y="4" width="1" height="4" fill="#d4526b"/><rect x="9" y="4" width="1" height="4" fill="#d4526b"/><rect x="3" y="1" width="2" height="2" fill="#e88fa8"/><rect x="8" y="1" width="2" height="2" fill="#e88fa8"/>' },
    { name: 'Giant Clam', plant: '<rect x="2" y="8" width="10" height="5" fill="#f2e2d0"/><rect x="2" y="6" width="10" height="2" fill="#e0c8b0"/><rect x="4" y="7" width="6" height="2" fill="#8e6bb0"/><rect x="4" y="4" width="2" height="2" fill="#d9b9a0"/><rect x="8" y="4" width="2" height="2" fill="#d9b9a0"/><rect x="5" y="10" width="1" height="1" fill="#c4aee6"/><rect x="8" y="10" width="1" height="1" fill="#c4aee6"/>' },
    { name: 'Berry Sponge', plant: '<rect x="6" y="11" width="1" height="2" fill="#2f6b46"/><rect x="3" y="5" width="8" height="6" fill="#d4526b"/><rect x="4" y="6" width="2" height="2" fill="#8e6bb0"/><rect x="8" y="8" width="2" height="2" fill="#8e6bb0"/><rect x="6" y="5" width="2" height="2" fill="#8e6bb0"/>' },
    { name: 'Bubble Coral', plant: '<rect x="6" y="11" width="1" height="2" fill="#a89880"/><rect x="3" y="5" width="8" height="6" fill="#a8dfe8"/><rect x="4" y="6" width="2" height="2" fill="#e0f4f8"/><rect x="7" y="7" width="2" height="2" fill="#e0f4f8"/><rect x="9" y="5" width="1" height="1" fill="#e0f4f8"/><rect x="5" y="9" width="1" height="1" fill="#5bb3cc"/>' },
    { name: 'Cup Coral', plant: '<rect x="6" y="10" width="1" height="4" fill="#c96a58"/><rect x="3" y="4" width="7" height="6" fill="#f0906a"/><rect x="4" y="3" width="5" height="1" fill="#ffb08c"/><rect x="5" y="5" width="3" height="3" fill="#eda100"/>' },
    { name: 'Sea Pen', plant: '<rect x="6" y="8" width="1" height="6" fill="#e0c8b0"/><rect x="4" y="1" width="5" height="7" fill="#8e6bb0"/><rect x="3" y="3" width="1" height="4" fill="#a78bd0"/><rect x="9" y="3" width="1" height="4" fill="#a78bd0"/><rect x="6" y="3" width="1" height="4" fill="#c4aee6"/>' },
    { name: 'Blood Star', plant: '<rect x="6" y="10" width="1" height="4" fill="#c96a58"/><rect x="4" y="4" width="6" height="6" fill="#d4526b"/><rect x="2" y="6" width="2" height="2" fill="#e0705a"/><rect x="10" y="6" width="2" height="2" fill="#e0705a"/><rect x="5" y="2" width="1" height="2" fill="#e0705a"/><rect x="8" y="2" width="1" height="2" fill="#e0705a"/>' },
    { name: 'Bell Hydroid', plant: '<rect x="6" y="6" width="1" height="8" fill="#3f8f5c"/><rect x="3" y="4" width="3" height="2" fill="#8fd6e8"/><rect x="7" y="6" width="3" height="2" fill="#8fd6e8"/><rect x="4" y="1" width="4" height="3" fill="#c4aee6"/>' },
    { name: 'Sea Grape', plant: '<rect x="6" y="8" width="1" height="6" fill="#2f6b46"/><rect x="4" y="6" width="2" height="2" fill="#56b07a"/><rect x="7" y="5" width="2" height="2" fill="#56b07a"/><rect x="3" y="3" width="2" height="2" fill="#7cc79a"/><rect x="6" y="2" width="2" height="2" fill="#7cc79a"/><rect x="9" y="3" width="2" height="2" fill="#7cc79a"/>' },
    { name: 'Trumpet Coral', plant: '<rect x="3" y="7" width="2" height="7" fill="#eda100"/><rect x="6" y="5" width="2" height="9" fill="#f0b73c"/><rect x="9" y="8" width="2" height="6" fill="#eda100"/><rect x="2" y="5" width="4" height="2" fill="#f2e2d0"/><rect x="5" y="3" width="4" height="2" fill="#f2e2d0"/><rect x="8" y="6" width="4" height="2" fill="#f2e2d0"/>' },
    { name: 'Elkhorn Coral', plant: '<rect x="6" y="8" width="2" height="6" fill="#c96a58"/><rect x="3" y="4" width="2" height="5" fill="#e0705a"/><rect x="9" y="3" width="2" height="6" fill="#e0705a"/><rect x="4" y="7" width="6" height="2" fill="#c96a58"/><rect x="2" y="2" width="3" height="2" fill="#ffb08c"/><rect x="9" y="1" width="3" height="2" fill="#ffb08c"/>' },
    { name: 'Brain Coral', plant: '<rect x="2" y="5" width="10" height="8" fill="#c4aee6"/><rect x="3" y="4" width="8" height="1" fill="#a78bd0"/><rect x="3" y="7" width="8" height="1" fill="#8e6bb0"/><rect x="3" y="10" width="8" height="1" fill="#8e6bb0"/>' },
    { name: 'Coral Bouquet', plant: '<rect x="6" y="9" width="1" height="5" fill="#3f8f5c"/><rect x="3" y="5" width="3" height="3" fill="#d4526b"/><rect x="7" y="4" width="3" height="3" fill="#eda100"/><rect x="5" y="1" width="3" height="3" fill="#c4aee6"/>' },
    { name: 'Tube Worms', plant: '<rect x="3" y="6" width="2" height="8" fill="#f2e2d0"/><rect x="6" y="4" width="2" height="10" fill="#e0c8b0"/><rect x="9" y="7" width="2" height="7" fill="#f2e2d0"/><rect x="3" y="4" width="2" height="2" fill="#d4526b"/><rect x="6" y="2" width="2" height="2" fill="#d4526b"/><rect x="9" y="5" width="2" height="2" fill="#d4526b"/>' },
    { name: 'Bubble Weed', plant: '<rect x="6" y="8" width="1" height="6" fill="#2f6b46"/><rect x="4" y="6" width="2" height="2" fill="#8fd6e8"/><rect x="7" y="7" width="2" height="2" fill="#8fd6e8"/><rect x="3" y="3" width="3" height="3" fill="#b8e6f2"/><rect x="7" y="2" width="3" height="3" fill="#b8e6f2"/>' },
    { name: 'Feather Star', plant: '<rect x="6" y="9" width="2" height="5" fill="#c96a58"/><rect x="2" y="6" width="4" height="1" fill="#eda100"/><rect x="8" y="6" width="4" height="1" fill="#eda100"/><rect x="2" y="8" width="4" height="1" fill="#f0b73c"/><rect x="8" y="8" width="4" height="1" fill="#f0b73c"/><rect x="5" y="3" width="4" height="3" fill="#eda100"/>' },
    { name: 'Sea Anemone', plant: '<rect x="4" y="9" width="6" height="5" fill="#e0705a"/><rect x="2" y="5" width="2" height="5" fill="#f2a0c4"/><rect x="5" y="3" width="2" height="6" fill="#f2a0c4"/><rect x="8" y="4" width="2" height="6" fill="#f2a0c4"/><rect x="10" y="6" width="2" height="4" fill="#f2a0c4"/>' },
    { name: 'Sunburst Coral', plant: '<rect x="3" y="6" width="8" height="7" fill="#eda100"/><rect x="4" y="4" width="2" height="2" fill="#f4c430"/><rect x="8" y="4" width="2" height="2" fill="#f4c430"/><rect x="6" y="3" width="2" height="2" fill="#f4c430"/><rect x="5" y="8" width="2" height="2" fill="#c96a58"/><rect x="8" y="9" width="2" height="2" fill="#c96a58"/>' },
    { name: 'Star Coral', plant: '<rect x="2" y="6" width="10" height="7" fill="#7cc79a"/><rect x="3" y="7" width="2" height="2" fill="#2f6b46"/><rect x="7" y="7" width="2" height="2" fill="#2f6b46"/><rect x="5" y="10" width="2" height="2" fill="#2f6b46"/><rect x="9" y="10" width="2" height="2" fill="#2f6b46"/><rect x="4" y="4" width="6" height="2" fill="#56b07a"/>' },
    { name: 'Sea Moss', plant: '<rect x="2" y="9" width="10" height="4" fill="#2f6b46"/><rect x="3" y="7" width="3" height="2" fill="#56b07a"/><rect x="7" y="6" width="3" height="3" fill="#56b07a"/><rect x="5" y="5" width="2" height="2" fill="#7cc79a"/>' },
    { name: 'Red Algae', plant: '<rect x="6" y="7" width="1" height="7" fill="#c96a58"/><rect x="3" y="4" width="3" height="3" fill="#d4526b"/><rect x="7" y="3" width="3" height="3" fill="#d4526b"/><rect x="2" y="7" width="3" height="2" fill="#e0705a"/><rect x="8" y="7" width="3" height="2" fill="#e0705a"/>' },
    { name: 'Barrel Sponge', plant: '<rect x="3" y="4" width="8" height="10" fill="#e0705a"/><rect x="4" y="3" width="6" height="2" fill="#ffb08c"/><rect x="5" y="4" width="4" height="2" fill="#8e5a4a"/><rect x="4" y="8" width="1" height="4" fill="#c96a58"/><rect x="9" y="8" width="1" height="4" fill="#c96a58"/>' },
    { name: 'Sea Grass', plant: '<rect x="3" y="3" width="1" height="11" fill="#56b07a"/><rect x="5" y="1" width="1" height="13" fill="#3f8f5c"/><rect x="7" y="4" width="1" height="10" fill="#56b07a"/><rect x="9" y="2" width="1" height="12" fill="#7cc79a"/><rect x="11" y="5" width="1" height="9" fill="#3f8f5c"/>' },
    { name: 'Fire Coral', plant: '<rect x="5" y="7" width="3" height="7" fill="#eb6834"/><rect x="2" y="9" width="2" height="5" fill="#e0705a"/><rect x="9" y="8" width="2" height="6" fill="#e0705a"/><rect x="5" y="4" width="1" height="3" fill="#f4c430"/><rect x="7" y="3" width="1" height="4" fill="#f4c430"/><rect x="2" y="7" width="2" height="2" fill="#f4c430"/><rect x="9" y="6" width="2" height="2" fill="#f4c430"/>' },
    { name: 'Dragon Kelp', plant: '<rect x="6" y="6" width="1" height="8" fill="#2f6b46"/><rect x="7" y="2" width="4" height="3" fill="#56b07a"/><rect x="3" y="5" width="4" height="3" fill="#7cc79a"/><rect x="7" y="8" width="4" height="3" fill="#56b07a"/><rect x="5" y="1" width="2" height="2" fill="#eda100"/>' },
    { name: 'Blue Ridge Coral', plant: '<rect x="6" y="8" width="1" height="6" fill="#3f8f5c"/><rect x="4" y="4" width="6" height="4" fill="#4a9cb2"/><rect x="3" y="5" width="1" height="2" fill="#8fd6e8"/><rect x="10" y="5" width="1" height="2" fill="#8fd6e8"/><rect x="5" y="3" width="1" height="1" fill="#b8e6f2"/><rect x="8" y="3" width="1" height="1" fill="#b8e6f2"/>' },
    { name: 'Flame Anemone', plant: '<rect x="6" y="10" width="1" height="4" fill="#3f8f5c"/><rect x="2" y="7" width="5" height="3" fill="#7cc79a"/><rect x="8" y="8" width="4" height="2" fill="#7cc79a"/><rect x="4" y="3" width="6" height="4" fill="#e0705a"/><rect x="6" y="4" width="2" height="2" fill="#f0b73c"/>' },
    { name: 'Painted Anemone', plant: '<rect x="6" y="10" width="1" height="4" fill="#3f8f5c"/><rect x="3" y="4" width="4" height="4" fill="#8e6bb0"/><rect x="7" y="4" width="4" height="4" fill="#a78bd0"/><rect x="4" y="7" width="6" height="3" fill="#f0b73c"/><rect x="6" y="6" width="2" height="2" fill="#3a4a5a"/>' },
    { name: 'Violet Sponge', plant: '<rect x="6" y="10" width="1" height="4" fill="#2f6b46"/><rect x="2" y="9" width="4" height="3" fill="#3f8f5c"/><rect x="8" y="9" width="4" height="3" fill="#3f8f5c"/><rect x="4" y="5" width="3" height="3" fill="#8e6bb0"/><rect x="8" y="6" width="3" height="3" fill="#c4aee6"/><rect x="6" y="3" width="3" height="3" fill="#a78bd0"/>' },
    { name: 'Primrose Polyp', plant: '<rect x="6" y="10" width="1" height="4" fill="#3f8f5c"/><rect x="2" y="9" width="10" height="2" fill="#2f6b46"/><rect x="3" y="4" width="4" height="4" fill="#f0b73c"/><rect x="8" y="5" width="4" height="4" fill="#eda100"/><rect x="4" y="5" width="2" height="2" fill="#f2e2d0"/>' },
    { name: 'Crocus Coral', plant: '<rect x="6" y="9" width="1" height="5" fill="#3f8f5c"/><rect x="4" y="9" width="1" height="5" fill="#7cc79a"/><rect x="9" y="9" width="1" height="5" fill="#7cc79a"/><rect x="5" y="3" width="4" height="6" fill="#a78bd0"/><rect x="6" y="2" width="2" height="1" fill="#c4aee6"/><rect x="6" y="5" width="2" height="2" fill="#f0b73c"/>' },
    { name: 'Trumpet Kelp', plant: '<rect x="6" y="8" width="1" height="6" fill="#3f8f5c"/><rect x="3" y="9" width="1" height="5" fill="#7cc79a"/><rect x="3" y="4" width="8" height="4" fill="#f0b73c"/><rect x="5" y="2" width="4" height="3" fill="#eda100"/><rect x="6" y="3" width="2" height="1" fill="#c96a58"/>' },
    { name: 'Lily Anemone', plant: '<rect x="6" y="8" width="2" height="6" fill="#3f8f5c"/><rect x="2" y="3" width="4" height="4" fill="#d4526b"/><rect x="8" y="3" width="4" height="4" fill="#e0705a"/><rect x="5" y="1" width="4" height="3" fill="#d4526b"/><rect x="6" y="4" width="2" height="2" fill="#f2e2d0"/>' },
    { name: 'Sword Kelp', plant: '<rect x="5" y="2" width="2" height="12" fill="#2f6b46"/><rect x="7" y="3" width="3" height="2" fill="#56b07a"/><rect x="7" y="6" width="3" height="2" fill="#3f8f5c"/><rect x="7" y="9" width="3" height="2" fill="#56b07a"/><rect x="2" y="5" width="3" height="2" fill="#3f8f5c"/><rect x="2" y="8" width="3" height="2" fill="#7cc79a"/>' },
    { name: 'Spire Coral', plant: '<rect x="6" y="9" width="1" height="5" fill="#3f8f5c"/><rect x="4" y="2" width="5" height="7" fill="#8e6bb0"/><rect x="5" y="1" width="3" height="1" fill="#c4aee6"/><rect x="4" y="4" width="5" height="1" fill="#c4aee6"/><rect x="4" y="7" width="5" height="1" fill="#c4aee6"/><rect x="3" y="10" width="7" height="1" fill="#7cc79a"/>' },
    { name: 'Moon Coral', plant: '<rect x="6" y="10" width="2" height="4" fill="#8a5a2e"/><rect x="2" y="8" width="4" height="2" fill="#2f6b46"/><rect x="8" y="8" width="4" height="2" fill="#2f6b46"/><rect x="3" y="3" width="8" height="5" fill="#f2e2d0"/><rect x="4" y="2" width="6" height="1" fill="#e0c8b0"/><rect x="6" y="5" width="2" height="2" fill="#8fd6e8"/>' },
    { name: 'Blush Coral', plant: '<rect x="6" y="11" width="1" height="3" fill="#8a5a2e"/><rect x="2" y="8" width="10" height="3" fill="#2f6b46"/><rect x="3" y="4" width="4" height="4" fill="#e0705a"/><rect x="7" y="3" width="4" height="4" fill="#f2a0c4"/><rect x="5" y="6" width="4" height="2" fill="#d4526b"/>' },
    { name: 'Pearl Anemone', plant: '<rect x="6" y="11" width="1" height="3" fill="#2f6b46"/><rect x="2" y="7" width="4" height="4" fill="#2f6b46"/><rect x="8" y="7" width="4" height="4" fill="#3f8f5c"/><rect x="4" y="3" width="6" height="5" fill="#f2e2d0"/><rect x="5" y="2" width="4" height="1" fill="#b8e6f2"/><rect x="6" y="5" width="2" height="2" fill="#c4aee6"/>' },
    { name: 'Crest Coral', plant: '<rect x="6" y="7" width="1" height="7" fill="#3f8f5c"/><rect x="2" y="8" width="4" height="2" fill="#2f6b46"/><rect x="3" y="6" width="6" height="2" fill="#56b07a"/><rect x="8" y="3" width="4" height="2" fill="#e0705a"/><rect x="6" y="2" width="3" height="2" fill="#f0b73c"/><rect x="9" y="5" width="3" height="2" fill="#4a9cb2"/>' },
    { name: 'Urchin Bloom', plant: '<rect x="6" y="10" width="2" height="4" fill="#8a5a2e"/><rect x="3" y="5" width="8" height="5" fill="#d4526b"/><rect x="2" y="6" width="1" height="3" fill="#b04456"/><rect x="11" y="6" width="1" height="3" fill="#b04456"/><rect x="5" y="3" width="4" height="2" fill="#e0705a"/><rect x="6" y="6" width="2" height="3" fill="#f2e2d0"/>' },
    { name: 'Spine Coral', plant: '<rect x="5" y="7" width="5" height="7" fill="#3f8f5c"/><rect x="2" y="4" width="4" height="5" fill="#3f8f5c"/><rect x="9" y="3" width="4" height="5" fill="#3f8f5c"/><rect x="3" y="3" width="2" height="1" fill="#e0705a"/><rect x="10" y="2" width="2" height="1" fill="#e0705a"/><rect x="6" y="6" width="1" height="1" fill="#f0b73c"/>' },
    { name: 'Pearl Chain Weed', plant: '<rect x="2" y="2" width="10" height="2" fill="#8a5a2e"/><rect x="3" y="4" width="2" height="2" fill="#f2e2d0"/><rect x="3" y="7" width="2" height="2" fill="#f2e2d0"/><rect x="3" y="10" width="2" height="2" fill="#e0c8b0"/><rect x="7" y="4" width="2" height="2" fill="#b8e6f2"/><rect x="7" y="7" width="2" height="2" fill="#b8e6f2"/><rect x="10" y="5" width="2" height="2" fill="#f2e2d0"/><rect x="10" y="8" width="2" height="2" fill="#e0c8b0"/>' },
    { name: 'Hanging Kelp', plant: '<rect x="1" y="2" width="12" height="2" fill="#8a5a2e"/><rect x="3" y="4" width="2" height="6" fill="#56b07a"/><rect x="6" y="4" width="2" height="8" fill="#7cc79a"/><rect x="9" y="4" width="2" height="5" fill="#56b07a"/><rect x="3" y="9" width="2" height="1" fill="#2f6b46"/><rect x="6" y="11" width="2" height="1" fill="#2f6b46"/>' }
  ];

  const OCEAN_SECTIONS = [
    { name: 'Shallows', icon: '\u{1F41A}', theme: 'grass' },
    { name: 'Kelp Forest', icon: '\u{1F33F}', theme: 'glass' },
    { name: 'Shipwreck', icon: '\u{1F6A2}', theme: 'wood' },
    { name: 'Sandbar', icon: '\u{1F3D6}\u{FE0F}', theme: 'patio' },
    { name: 'Coral Maze', icon: '\u{1FAB8}', theme: 'maze' },
    { name: 'Open Water', icon: '\u{1FAE7}', theme: 'water' },
    { name: 'Seabed Beds', icon: '\u{1F331}', theme: 'soil' },
    { name: 'Anemone Field', icon: '\u{1F420}', theme: 'orchard' }
  ];

  /* The same idea below the water: seagrass, shell grit, a sandy channel. */
  const OCEAN_THEME_DETAIL = {
    grass:   { tuft: '#4fae8f', tuft2: '#2f8c70', pebble: '#dcecec', path: '#cfc3a0', patch: '#a9dcd0', edge: '#b5a887' },
    glass:   { tuft: '#5cc0c6', tuft2: '#3a9ba4', pebble: '#e0f0f4', path: '#bcd2d8', patch: '#b8e4ea', edge: '#a4bfc7' },
    wood:    { tuft: '#8a9f6a', tuft2: '#6b8050', pebble: '#e3d6b8', path: '#a89264', patch: '#c2ab7c', edge: '#8d7a52' },
    patio:   { tuft: '#8fb9a2', tuft2: '#6c9880', pebble: '#efeade', path: '#c9c4ae', patch: '#dcd8c6', edge: '#b3af9a' },
    maze:    { tuft: '#43a184', tuft2: '#2b8068', pebble: '#d6e8e6', path: '#c6bb9a', patch: '#a2d6c9', edge: '#ab9f80' },
    water:   { tuft: '#5cb6cf', tuft2: '#3a94b0', pebble: '#e4f2f8', path: '#96c6dc', patch: '#b2dfee', edge: '#84b3c8' },
    soil:    { tuft: '#93a367', tuft2: '#70804a', pebble: '#ded0ad', path: '#a4874f', patch: '#bd9b66', edge: '#8a7245' },
    orchard: { tuft: '#4bab7a', tuft2: '#2d8a5d', pebble: '#d5e4d6', path: '#c7b68e', patch: '#b3ddc4', edge: '#b09a75' }
  };

  const OCEAN_THEME_COLORS = {
    grass: ['#bfe6ea', '#d9f2f4'],
    glass: ['#a9d6c8', '#c6e6db'],
    wood: ['#7a6a55', '#8d7c66'],
    patio: ['#e6d9b0', '#f0e6c8'],
    maze: ['#bfe6ea', '#d9f2f4'],
    water: ['#8fc9de', '#a9daea'],
    soil: ['#b9a882', '#c9b892'],
    orchard: ['#a9d8d0', '#c2e6e0']
  };

  function oceanWallPattern(theme) {
    if (theme === 'grass') return 'repeating-linear-gradient(90deg, #5bb3cc 0 4px, #3d8fb0 4px 5px, transparent 5px 8px)';
    if (theme === 'glass') return 'repeating-linear-gradient(90deg, #3f8f5c 0 10px, #2f6b46 10px 12px)';
    if (theme === 'wood') return 'repeating-linear-gradient(90deg, #6b5a45 0 13px, #4f4335 13px 16px)';
    if (theme === 'patio') return 'repeating-linear-gradient(90deg, #c9b892 0 11px, #a89574 11px 14px)';
    if (theme === 'maze') return 'repeating-linear-gradient(90deg, #d4526b 0 6px, #b03a55 6px 9px)';
    if (theme === 'water') return 'repeating-linear-gradient(90deg, #3d8fb0 0 5px, #2b6f8f 5px 7px)';
    if (theme === 'soil') return 'repeating-linear-gradient(90deg, #a89574 0 6px, #c9b892 6px 7px, transparent 7px 10px)';
    if (theme === 'orchard') return 'repeating-linear-gradient(45deg, #8e6bb0 0 4px, #a78bd0 4px 8px)';
    return '#3d8fb0';
  }

  function oceanSurfaceBackground(kind) {
    if (kind === 'bed') return 'repeating-linear-gradient(0deg, #2f6b46 0 5px, #24543a 5px 9px)';
    if (kind === 'porch') return 'repeating-linear-gradient(90deg, #8a7c68 0 7px, #6b5a45 7px 14px)';
    if (kind === 'sand') return 'repeating-radial-gradient(circle at center, #ecdfba 0 2px, #ddcc9f 2px 3px, #ecdfba 3px 7px)';
    if (kind === 'dock') return 'repeating-linear-gradient(0deg, #8a7c68 0 6px, #6b5a45 6px 8px)';
    if (kind === 'blanket') return 'repeating-linear-gradient(45deg, #8e6bb0 0 6px, #c4aee6 6px 12px)';
    return '#5bb3cc';
  }

  /* --- the farmer, in a second cut --- */

  function farmerFemaleFrontSVG(o) {
    return `<svg width="30" height="32" viewBox="0 0 19 20" shape-rendering="crispEdges">
      <rect x="6" y="0" width="6" height="2" fill="${o.hat}"/>
      <rect x="3" y="2" width="12" height="2" fill="${o.hat}"/>
      <rect x="2" y="4" width="2" height="7" fill="#6b4423"/>
      <rect x="12" y="4" width="2" height="7" fill="#6b4423"/>
      <rect x="4" y="4" width="8" height="6" fill="#f2c48d"/>
      <rect x="6" y="7" width="1" height="1" fill="#1f2430"/>
      <rect x="9" y="7" width="1" height="1" fill="#1f2430"/>
      <rect x="3" y="10" width="10" height="5" fill="${o.shirt}"/>
      <rect x="1" y="10" width="2" height="5" fill="#f2c48d"/>
      <rect x="13" y="10" width="2" height="4" fill="#f2c48d"/>
      <rect x="2" y="15" width="12" height="3" fill="${o.pants}"/>
      <rect x="4" y="18" width="3" height="2" fill="#f2c48d"/>
      <rect x="9" y="18" width="3" height="2" fill="#f2c48d"/>
      <rect x="15" y="11" width="3" height="4" fill="#8a8f98"/>
      <rect x="18" y="10" width="1" height="2" fill="#8a8f98"/>
    </svg>`;
  }

  function farmerFemaleBackSVG(o) {
    return `<svg width="30" height="32" viewBox="0 0 19 20" shape-rendering="crispEdges">
      <rect x="6" y="0" width="6" height="2" fill="${o.hat}"/>
      <rect x="3" y="2" width="12" height="2" fill="${o.hat}"/>
      <rect x="3" y="4" width="10" height="8" fill="#6b4423"/>
      <rect x="3" y="10" width="10" height="5" fill="${o.shirt}" opacity="0.55"/>
      <rect x="1" y="10" width="2" height="5" fill="#f2c48d"/>
      <rect x="13" y="10" width="2" height="4" fill="#f2c48d"/>
      <rect x="2" y="15" width="12" height="3" fill="${o.pants}"/>
      <rect x="4" y="18" width="3" height="2" fill="#f2c48d"/>
      <rect x="9" y="18" width="3" height="2" fill="#f2c48d"/>
    </svg>`;
  }

  function farmerFemaleSideSVG(o) {
    return `<svg width="30" height="32" viewBox="0 0 19 20" shape-rendering="crispEdges">
      <rect x="7" y="0" width="7" height="2" fill="${o.hat}"/>
      <rect x="6" y="2" width="9" height="2" fill="${o.hat}"/>
      <rect x="5" y="4" width="3" height="8" fill="#6b4423"/>
      <rect x="7" y="4" width="6" height="6" fill="#f2c48d"/>
      <rect x="12" y="6" width="2" height="1" fill="#f2c48d"/>
      <rect x="11" y="7" width="1" height="1" fill="#1f2430"/>
      <rect x="6" y="10" width="8" height="5" fill="${o.shirt}"/>
      <rect x="12" y="10" width="3" height="5" fill="#f2c48d"/>
      <rect x="5" y="15" width="10" height="3" fill="${o.pants}"/>
      <rect x="7" y="18" width="3" height="2" fill="#f2c48d"/>
      <rect x="11" y="18" width="3" height="2" fill="#f2c48d"/>
      <rect x="15" y="11" width="3" height="4" fill="#8a8f98"/>
      <rect x="18" y="10" width="1" height="2" fill="#8a8f98"/>
    </svg>`;
  }

  /* ======================================================================
     The two worlds
     ====================================================================== */

  const OCEAN_PETS = {
    dog: { label: 'Clownfish', icon: '\u{1F420}', cost: 10, temperament: 'friendly', svg: clownfishSVG },
    cat: { label: 'Seahorse', icon: '\u{1F40E}', cost: 8, temperament: 'neutral', svg: seahorseSVG },
    rabbit: { label: 'Sea Turtle', icon: '\u{1F422}', cost: 5, temperament: 'skittish', svg: seaTurtleSVG },
    bird: { label: 'Jellyfish', icon: '\u{1FABC}', cost: 5, temperament: 'skittish', svg: jellyfishSVG }
  };

  const OCEAN_FOOD = { label: 'Fish food', icon: '\u{1F990}', cost: 1, gain: 18 };

  const OCEAN_ITEMS = {
    hoe: { label: 'Sand rake', icon: '\u{1F3D6}\u{FE0F}', cost: 3, svg: sandRakeSVG },
    hose: { label: 'Current jet', icon: '\u{1F30A}', cost: 4, svg: currentJetSVG, retired: true },
    bucket: { label: 'Shell pail', icon: '\u{1F41A}', cost: 2, svg: shellPailSVG, retired: true },
    axe: { label: 'Coral saw', icon: '\u{1FA9A}', cost: 6, svg: coralSawSVG },
    shovel: { label: 'Sand scoop', icon: '\u{1F944}', cost: 6, svg: sandScoopSVG }
  };

  const OCEAN_OUTFITS = {
    classic: { label: 'Classic', icon: '\u{1F41A}', cost: 0, hat: '#f2e2d0', shirt: '#d4526b', pants: '#2f8f8a' },
    strawhat: { label: 'Kelp Crown', icon: '\u{1F33F}', cost: 15, hat: '#56b07a', shirt: '#eda100', pants: '#2f6b46' },
    flannel: { label: 'Coral Weave', icon: '\u{1FAB8}', cost: 12, hat: '#8a5a2e', shirt: '#e0705a', pants: '#c96a58' },
    explorer: { label: 'Diver\'s Kit', icon: '\u{1F93F}', cost: 18, hat: '#3a4a5a', shirt: '#eda100', pants: '#5f6b78' },
    royal: { label: 'Pearl Regalia', icon: '\u{1F451}', cost: 25, hat: '#c4aee6', shirt: '#f2e2d0', pants: '#8e6bb0' }
  };

  const OCEAN_STEP_SOUND = {
    grass: 'water', glass: 'water', wood: 'wood', patio: 'dirt',
    maze: 'water', water: 'water', soil: 'dirt', orchard: 'water'
  };

  const GARDEN_WORLD = {
    id: 'garden',
    label: 'Garden',
    blurb: 'A farmer above ground: trees to fell, beds to till, a cabin to build from logs.',
    heroLabels: { male: 'Male', female: 'Female' },
    terms: {
      panel: 'My Garden',
      place: 'the garden',
      plant: 'plant', plants: 'plants',
      sprout: 'sapling', sprouted: 'tree',
      log: 'log', logs: 'logs', build: 'cabin',
      tilled: 'plantable dirt',
      chopTarget: 'a tree or a grown sapling',
      digTarget: 'a bush',
      hero: 'gardener',
      moveHint: 'Click the garden, then move with WASD or the arrow keys.'
    },
    sections: SECTIONS,
    themeColors: THEME_COLORS,
    themeDetail: THEME_DETAIL,
    themeOrder: THEME_ORDER,
    wallPattern: wallPattern,
    surfaceBackground: surfaceBackground,
    stepSound: THEME_STEP_SOUND,
    plants: PLANT_VARIETIES,
    plantSVG: buildPlantSVG,
    pets: PET_TYPES,
    food: PET_FOOD,
    /* Names for the scenery, so the magnifying glass has something to say. */
    decorNames: {
      tree: 'Oak tree', fruitTree: 'Fruit tree', bush: 'Bush', hedge: 'Hedge',
      washingLine: 'Washing line', table: 'Garden table', grill: 'Barbecue',
      lilyPad: 'Lily pad', mower: 'Lawnmower', wheelbarrow: 'Wheelbarrow',
      bed: 'Flower bed', blanket: 'Picnic blanket', dock: 'Jetty',
      porch: 'Porch', sand: 'Sandpit',
      sapling: 'Sapling', log: 'Log', cabin: 'Cabin', gate: 'Gate',
      soil: 'Dug soil'
    },
    items: SHOP_ITEMS,
    outfits: OUTFITS,
    art: {
      tree: treeSVG, fruitTree: fruitTreeSVG, washingLine: washingLineSVG,
      bush: bushSVG, mower: mowerSVG, wheelbarrow: wheelbarrowSVG,
      table: tableSVG, grill: grillSVG, hedge: hedgeSVG, lilyPad: lilyPadSVG,
      sapling: saplingSVG, seedling: seedlingShapes, log: logSVG, build: cabinSVG, treat: treatSVG
    },
    hero: {
      male: { front: gardenerFrontSVG, back: gardenerBackSVG, side: gardenerSideSVG },
      female: { front: farmerFemaleFrontSVG, back: farmerFemaleBackSVG, side: farmerFemaleSideSVG }
    }
  };

  const OCEAN_WORLD = {
    id: 'ocean',
    label: 'Ocean',
    blurb: 'Merfolk below the surface: kelp to cut, seabeds to rake, a grotto to build from driftwood.',
    heroLabels: { male: 'Merman', female: 'Mermaid' },
    terms: {
      panel: 'My Reef',
      place: 'the reef',
      plant: 'coral', plants: 'corals',
      sprout: 'kelp sprout', sprouted: 'kelp',
      log: 'driftwood', logs: 'driftwood', build: 'grotto',
      tilled: 'raked seabed',
      chopTarget: 'a kelp stalk or a grown sprout',
      digTarget: 'a sponge',
      hero: 'merfolk',
      moveHint: 'Click the reef, then swim with WASD or the arrow keys.'
    },
    sections: OCEAN_SECTIONS,
    themeColors: OCEAN_THEME_COLORS,
    themeDetail: OCEAN_THEME_DETAIL,
    themeOrder: THEME_ORDER,
    wallPattern: oceanWallPattern,
    surfaceBackground: oceanSurfaceBackground,
    stepSound: OCEAN_STEP_SOUND,
    plants: OCEAN_PLANTS,
    plantSVG: oceanPlantSVG,
    pets: OCEAN_PETS,
    food: OCEAN_FOOD,
    decorNames: {
      tree: 'Kelp tower', fruitTree: 'Fruiting kelp', bush: 'Coral clump', hedge: 'Coral wall',
      washingLine: 'Net line', table: 'Stone table', grill: 'Thermal vent',
      lilyPad: 'Sea lettuce', mower: 'Sand sweeper', wheelbarrow: 'Shell cart',
      bed: 'Seabed', blanket: 'Sand mat', dock: 'Reef ledge',
      porch: 'Shell deck', sand: 'Sand flat',
      sapling: 'Kelp shoot', log: 'Driftwood', cabin: 'Grotto', gate: 'Reef gate',
      soil: 'Turned sand'
    },
    items: OCEAN_ITEMS,
    outfits: OCEAN_OUTFITS,
    art: {
      tree: kelpSVG, fruitTree: coralTreeSVG, washingLine: fishingNetSVG,
      bush: spongeSVG, mower: anchorSVG, wheelbarrow: chestSVG,
      table: flatRockSVG, grill: ventSVG, hedge: coralWallSVG, lilyPad: bubbleAnemoneSVG,
      sapling: kelpSproutSVG, seedling: oceanSeedlingShapes, log: driftwoodSVG, build: grottoSVG, treat: krillSVG
    },
    hero: {
      male: { front: merMaleFrontSVG, back: merMaleBackSVG, side: merMaleSideSVG },
      female: { front: merFemaleFrontSVG, back: merFemaleBackSVG, side: merFemaleSideSVG }
    }
  };

  const ALL = { garden: GARDEN_WORLD, ocean: OCEAN_WORLD };

  function get(id) {
    return ALL[id] || GARDEN_WORLD;
  }

  function heroSVG(worldId, gender, direction, outfit) {
    const w = get(worldId);
    const set = w.hero[gender === 'female' ? 'female' : 'male'];
    const o = outfit || w.outfits.classic;
    if (direction === 'up') return set.back(o);
    if (direction === 'left' || direction === 'right') return set.side(o);
    return set.front(o);
  }

  /* A small scene of the world, for the sign-up chooser and settings. Shows the
     hero you would get, on the ground you would walk, with a couple of the
     plants and one of the creatures. */
  function previewHTML(worldId, gender) {
    const w = get(worldId);
    const [c1, c2] = w.themeColors[w.sections[0].theme];
    const ground = `background-color:${c2};background-image:linear-gradient(45deg,${c1} 25%,transparent 25%,transparent 75%,${c1} 75%),linear-gradient(45deg,${c1} 25%,transparent 25%,transparent 75%,${c1} 75%);background-size:20px 20px;background-position:0 0,10px 10px;`;
    const pet = w.pets.dog;
    const plantA = w.plantSVG(w.plants[2], '#c56a4e', true);
    const plantB = w.plantSVG(w.plants[11], '#4a7fb5', true);
    const plantC = w.plantSVG(w.plants[7], '#5c9e6b', true);
    return `<div class="world-preview" style="${ground}">
        <span class="wp-item">${plantA}</span>
        <span class="wp-item">${heroSVG(worldId, gender, 'down')}</span>
        <span class="wp-item">${plantB}</span>
        <span class="wp-item">${pet.svg()}</span>
        <span class="wp-item">${plantC}</span>
      </div>`;
  }

  return {
    TILE: TILE,
    DEFAULT_WORLD: 'garden',
    DEFAULT_HERO: 'male',
    get: get,
    ids: function () { return ['garden', 'ocean']; },
    list: function () { return [GARDEN_WORLD, OCEAN_WORLD]; },
    heroSVG: heroSVG,
    previewHTML: previewHTML
  };
})();
