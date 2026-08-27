/* ============================================================================
   Tend - garden.js
   The reward garden. Every completed ticket becomes a plant; every ten
   completed tickets unlocks another section of the garden. Watering, chopping,
   building and pets all earn coins that can be spent in the shop.

   All persistence goes through Store.kv, which namespaces keys per account,
   so each account tends its own garden.
   ============================================================================ */

const Garden = (function () {
  'use strict';

  const NEUTRAL_POT = '#8a8f98';

  /* The gardener sprite is named after whoever is signed in. */
  function heroName() {
    const n = (Store.displayName() || '').trim();
    if (!n) return 'Your gardener';
    return n.split(/\s+/)[0];
  }

  const GARDEN_LAYOUT_KEY = 'garden-layout-v5';
  const HERO_POS_KEY = 'garden-hero-v5';
  const GARDEN_COLS = 8;
  const CELL_SIZE = 34;
  const SECTION_ROWS = 8;
  const TICKETS_PER_SECTION = 10;
  const WATER_COOLDOWN_MS = 60000;
  const SECTIONS_SHOWN_AHEAD = 1;

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

  function sectionInfo(i) {
    if (SECTIONS[i]) return SECTIONS[i];
    return { name: `Garden Plot ${i + 1}`, icon: '\u{1FAB4}', theme: THEME_ORDER[i % THEME_ORDER.length] };
  }

  function checkerBackground(theme) {
    const [c1, c2] = THEME_COLORS[theme];
    const size = CELL_SIZE * 2;
    return `background-image: linear-gradient(45deg, ${c1} 25%, transparent 25%, transparent 75%, ${c1} 75%, ${c1}), linear-gradient(45deg, ${c1} 25%, ${c2} 25%, ${c2} 75%, ${c1} 75%, ${c1}); background-size: ${size}px ${size}px; background-position: 0 0, ${CELL_SIZE}px ${CELL_SIZE}px;`;
  }

  function surfaceBackground(kind) {
    if (kind === 'bed') return 'repeating-linear-gradient(0deg, #6b4423 0 5px, #5a3a1e 5px 9px)';
    if (kind === 'porch') return 'repeating-linear-gradient(90deg, #c9a06a 0 7px, #b58e58 7px 14px)';
    if (kind === 'sand') return 'repeating-radial-gradient(circle at center, #e8d9a8 0 2px, #ddc98f 2px 3px, #e8d9a8 3px 7px)';
    if (kind === 'dock') return 'repeating-linear-gradient(0deg, #a97a45 0 6px, #8a5a2e 6px 8px)';
    if (kind === 'blanket') return 'repeating-linear-gradient(45deg, #e34948 0 6px, #f7f7f2 6px 12px)';
    return '#cccccc';
  }

  function unlockedSectionCount(completedCount) {
    return Math.floor(completedCount / TICKETS_PER_SECTION) + 1;
  }

  function treeSVG() {
    return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="6" y="13" width="4" height="6" fill="#6b4423"/><rect x="2" y="2" width="12" height="10" fill="#2f7a34"/><rect x="4" y="0" width="8" height="3" fill="#3f9142"/><rect x="3" y="5" width="3" height="3" fill="#3f9142"/></svg>`;
  }

  function fruitTreeSVG() {
    return `<svg width="26" height="34" viewBox="0 0 16 20" shape-rendering="crispEdges"><rect x="6" y="13" width="4" height="6" fill="#6b4423"/><rect x="2" y="2" width="12" height="10" fill="#2f7a34"/><rect x="4" y="4" width="2" height="2" fill="#d0353a"/><rect x="9" y="6" width="2" height="2" fill="#d0353a"/><rect x="6" y="9" width="2" height="2" fill="#eb6834"/></svg>`;
  }

  function washingLineSVG(width) {
    const w = width * CELL_SIZE - 4;
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

  const PET_TYPES = {
    dog: { label: 'Dog', icon: '\u{1F415}', cost: 10, temperament: 'friendly', svg: dogSVG },
    cat: { label: 'Cat', icon: '\u{1F408}', cost: 8, temperament: 'neutral', svg: catSVG },
    rabbit: { label: 'Rabbit', icon: '\u{1F430}', cost: 5, temperament: 'skittish', svg: rabbitSVG },
    bird: { label: 'Bird', icon: '\u{1F426}', cost: 5, temperament: 'skittish', svg: birdSVG }
  };

  const PET_TREATS = {
    dog: { label: 'Dog treat', icon: '\u{1F9B4}', cost: 1, gain: 15 },
    cat: { label: 'Cat treat', icon: '\u{1F41F}', cost: 1, gain: 15 },
    rabbit: { label: 'Rabbit treat', icon: '\u{1F955}', cost: 1, gain: 20 },
    bird: { label: 'Bird seed', icon: '\u{1F33E}', cost: 1, gain: 20 }
  };

  const SHOP_ITEMS = {
    hoe: { label: 'Hoe', icon: '\u{26CF}\u{FE0F}', cost: 3, svg: hoeSVG },
    hose: { label: 'Hose', icon: '\u{1F6BF}', cost: 4, svg: hoseSVG },
    bucket: { label: 'Bucket', icon: '\u{1FAA3}', cost: 2, svg: bucketSVG },
    axe: { label: 'Axe', icon: '\u{1FA93}', cost: 6, svg: axeSVG },
    shovel: { label: 'Shovel', icon: '\u{1FACF}', cost: 6, svg: shovelSVG }
  };

  const SAPLING_COST = 5;
  const SAPLING_WATERS_NEEDED = 5;
  const CABIN_LOGS_NEEDED = 10;

  const MAX_PETS = 10;
  const UNLOCK_PET_COST = 50;
  const RESET_PURCHASES_COST = 100;

  const OUTFITS = {
    classic: { label: 'Classic', icon: '\u{1F455}', cost: 0, hat: '#6b4423', shirt: '#3f9142', pants: '#2c3e8f' },
    strawhat: { label: 'Straw Hat & Overalls', icon: '\u{1F33E}', cost: 15, hat: '#eda100', shirt: '#4361ee', pants: '#2c5aa0' },
    flannel: { label: 'Red Flannel', icon: '\u{1F9E5}', cost: 12, hat: '#6b4423', shirt: '#d0353a', pants: '#3b3f45' },
    explorer: { label: 'Explorer Vest', icon: '\u{1F9ED}', cost: 18, hat: '#b98a55', shirt: '#6b8e4e', pants: '#5a4a35' },
    royal: { label: 'Royal Robes', icon: '\u{1F451}', cost: 25, hat: '#6a4fb0', shirt: '#7536ff', pants: '#4a3aa7' }
  };

  const OUTFITS_KEY = 'garden-outfits-v1';
  let ownedOutfits = ['classic'];
  let equippedOutfit = 'classic';

  function loadOutfits() {
    try {
      const raw = JSON.parse(Store.kv.getItem(OUTFITS_KEY));
      ownedOutfits = (raw && Array.isArray(raw.owned) && raw.owned.includes('classic')) ? raw.owned : ['classic'];
      equippedOutfit = (raw && raw.equipped && ownedOutfits.includes(raw.equipped)) ? raw.equipped : 'classic';
    } catch (e) {
      ownedOutfits = ['classic'];
      equippedOutfit = 'classic';
    }
  }

  function saveOutfits() {
    Store.kv.setItem(OUTFITS_KEY, JSON.stringify({ owned: ownedOutfits, equipped: equippedOutfit }));
  }

  function getEquippedOutfit() {
    return OUTFITS[equippedOutfit] || OUTFITS.classic;
  }

  function buyOutfit(id) {
    const def = OUTFITS[id];
    if (!def || ownedOutfits.includes(id) || coins < def.cost) return;
    coins -= def.cost;
    saveCoins();
    ownedOutfits.push(id);
    equippedOutfit = id;
    saveOutfits();
    renderCoins();
    positionHero();
    document.getElementById('garden-gardener').innerHTML = gardenerSVG('down', getEquippedOutfit());
  }

  function equipOutfit(id) {
    if (!ownedOutfits.includes(id)) return;
    equippedOutfit = id;
    saveOutfits();
    positionHero();
    document.getElementById('garden-gardener').innerHTML = gardenerSVG('down', getEquippedOutfit());
    renderShop();
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
    return `<svg width="${CELL_SIZE}" height="${CELL_SIZE}" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="0" y="0" width="16" height="16" fill="#2f6b32"/><rect x="2" y="2" width="3" height="3" fill="#3f9142"/><rect x="9" y="4" width="3" height="3" fill="#3f9142"/><rect x="5" y="9" width="3" height="3" fill="#3f9142"/><rect x="11" y="10" width="3" height="3" fill="#3f9142"/></svg>`;
  }

  function lilyPadSVG() {
    return `<svg width="26" height="26" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="3" y="6" width="10" height="6" fill="#4c9c4f"/><rect x="5" y="8" width="4" height="2" fill="#e87ba4"/></svg>`;
  }

  const MAZE_PATTERN = [
    '..#...#.',
    '..#.#.#.',
    '....#...',
    '#.#...#.',
    '..#.#...',
    '.....#..',
    '.#...#.#',
    '..#.#...'
  ];

  function mazeDecorations() {
    const list = [];
    MAZE_PATTERN.forEach((rowStr, r) => {
      for (let c = 0; c < rowStr.length; c++) {
        if (rowStr[c] === '#') list.push({ row: r, col: c, width: 1, height: 1, blocking: true, svg: hedgeSVG() });
      }
    });
    return list;
  }

  const DECORATIONS_BY_THEME = {
    grass: [
      { row: 0, col: 2, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree1', svg: treeSVG() },
      { row: 0, col: 5, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree2', svg: treeSVG() },
      { row: 2, col: 3, width: 2, height: 1, blocking: true, svg: washingLineSVG(2) },
      { row: 6, col: 3, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'shovel', id: 'bush1', svg: bushSVG() },
      { row: 7, col: 5, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'shovel', id: 'bush2', svg: bushSVG() },
      { row: 1, col: 0, width: 2, height: 5, blocking: false, kind: 'bed' },
      { row: 1, col: 6, width: 2, height: 5, blocking: false, kind: 'bed' },
      { row: 6, col: 5, width: 1, height: 1, blocking: true, movable: true, id: 'mower', svg: mowerSVG() },
      { row: 7, col: 2, width: 1, height: 1, blocking: true, movable: true, id: 'wheelbarrow', svg: wheelbarrowSVG() }
    ],
    glass: [
      { row: 1, col: 0, width: 4, height: 1, blocking: false, kind: 'bed' },
      { row: 1, col: 4, width: 4, height: 1, blocking: false, kind: 'bed' },
      { row: 5, col: 0, width: 4, height: 1, blocking: false, kind: 'bed' },
      { row: 5, col: 4, width: 4, height: 1, blocking: false, kind: 'bed' }
    ],
    wood: [
      { row: 1, col: 2, width: 1, height: 1, blocking: true, svg: tableSVG() },
      { row: 1, col: 5, width: 1, height: 1, blocking: true, svg: tableSVG() },
      { row: 6, col: 0, width: 8, height: 2, blocking: false, kind: 'porch' }
    ],
    patio: [
      { row: 0, col: 3, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree1', svg: treeSVG() },
      { row: 2, col: 6, width: 1, height: 1, blocking: true, svg: tableSVG() },
      { row: 6, col: 6, width: 1, height: 1, blocking: true, svg: grillSVG() },
      { row: 3, col: 2, width: 4, height: 4, blocking: false, kind: 'sand' }
    ],
    maze: mazeDecorations(),
    water: [
      { row: 2, col: 0, width: 2, height: 4, blocking: false, kind: 'dock' },
      { row: 1, col: 3, width: 1, height: 1, blocking: true, svg: lilyPadSVG() },
      { row: 1, col: 5, width: 1, height: 1, blocking: true, svg: lilyPadSVG() },
      { row: 3, col: 3, width: 1, height: 1, blocking: true, svg: lilyPadSVG() },
      { row: 3, col: 6, width: 1, height: 1, blocking: true, svg: lilyPadSVG() },
      { row: 5, col: 2, width: 1, height: 1, blocking: true, svg: lilyPadSVG() },
      { row: 5, col: 5, width: 1, height: 1, blocking: true, svg: lilyPadSVG() },
      { row: 6, col: 4, width: 1, height: 1, blocking: true, svg: lilyPadSVG() },
      { row: 2, col: 7, width: 1, height: 1, blocking: true, svg: lilyPadSVG() }
    ],
    soil: [
      { row: 1, col: 0, width: 4, height: 1, blocking: false, kind: 'bed' },
      { row: 1, col: 4, width: 4, height: 1, blocking: false, kind: 'bed' },
      { row: 4, col: 0, width: 4, height: 1, blocking: false, kind: 'bed' },
      { row: 4, col: 4, width: 4, height: 1, blocking: false, kind: 'bed' }
    ],
    orchard: [
      { row: 0, col: 1, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree1', svg: fruitTreeSVG() },
      { row: 0, col: 4, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree2', svg: fruitTreeSVG() },
      { row: 4, col: 7, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree3', svg: fruitTreeSVG() },
      { row: 3, col: 0, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree4', svg: fruitTreeSVG() },
      { row: 3, col: 3, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree5', svg: fruitTreeSVG() },
      { row: 3, col: 6, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree6', svg: fruitTreeSVG() },
      { row: 6, col: 1, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree7', svg: fruitTreeSVG() },
      { row: 6, col: 5, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree8', svg: fruitTreeSVG() },
      { row: 5, col: 2, width: 4, height: 3, blocking: false, kind: 'blanket' }
    ]
  };

  function findDecorationAt(row, col) {
    return placedDecorations.find(d => d.blocking &&
      row >= d.row && row < d.row + d.height &&
      col >= d.col && col < d.col + d.width) || null;
  }

  function isOnDirt(row, col) {
    if (dugTiles.has(row + ':' + col)) return true;
    return placedDecorations.some(d => !d.blocking && d.kind === 'bed' &&
      row >= d.row && row < d.row + d.height &&
      col >= d.col && col < d.col + d.width);
  }

  const MOVABLE_LAYOUT_KEY = 'garden-movables-v1';
  const PURCHASED_ITEMS_KEY = 'garden-items-v1';
  const PETS_KEY = 'garden-pets-v1';
  const COINS_KEY = 'coins-v1';
  const CHOPPED_TREES_KEY = 'garden-chopped-v1';
  const GROUND_LOGS_KEY = 'garden-logs-v1';
  const CABIN_SITES_KEY = 'garden-cabins-v1';
  const SAPLINGS_KEY = 'garden-saplings-v1';
  const DUG_TILES_KEY = 'garden-dug-v1';

  let movableLayout = {};
  let purchasedItems = [];
  let ownedPets = [];
  let coins = 0;
  let placedDecorations = [];
  let choppedTrees = new Set();
  let groundLogs = [];
  let cabinSites = [];
  let saplings = [];
  let heldLog = null;
  let heldSapling = null;
  let dugTiles = new Set();

  function loadDugTiles() {
    try {
      dugTiles = new Set(JSON.parse(Store.kv.getItem(DUG_TILES_KEY)) || []);
    } catch (e) {
      dugTiles = new Set();
    }
  }
  function saveDugTiles() {
    Store.kv.setItem(DUG_TILES_KEY, JSON.stringify([...dugTiles]));
  }

  function loadChoppedTrees() {
    try {
      choppedTrees = new Set(JSON.parse(Store.kv.getItem(CHOPPED_TREES_KEY)) || []);
    } catch (e) {
      choppedTrees = new Set();
    }
  }
  function saveChoppedTrees() {
    Store.kv.setItem(CHOPPED_TREES_KEY, JSON.stringify([...choppedTrees]));
  }

  function loadGroundLogs() {
    try {
      groundLogs = JSON.parse(Store.kv.getItem(GROUND_LOGS_KEY)) || [];
    } catch (e) {
      groundLogs = [];
    }
  }
  function saveGroundLogs() {
    Store.kv.setItem(GROUND_LOGS_KEY, JSON.stringify(groundLogs));
  }

  function loadCabinSites() {
    try {
      cabinSites = JSON.parse(Store.kv.getItem(CABIN_SITES_KEY)) || [];
    } catch (e) {
      cabinSites = [];
    }
  }
  function saveCabinSites() {
    Store.kv.setItem(CABIN_SITES_KEY, JSON.stringify(cabinSites));
  }

  function loadSaplings() {
    try {
      saplings = JSON.parse(Store.kv.getItem(SAPLINGS_KEY)) || [];
    } catch (e) {
      saplings = [];
    }
  }
  function saveSaplings() {
    Store.kv.setItem(SAPLINGS_KEY, JSON.stringify(saplings));
  }

  function isSaplingGrown(s) {
    return !!(s.planted && (s.waterCount || 0) >= SAPLING_WATERS_NEEDED);
  }

  function waterSaplingCheck(row, col, sapling) {
    if (!sapling || isSaplingGrown(sapling)) return;
    const last = wateredCooldown.get(sapling.id) || 0;
    if (Date.now() - last < WATER_COOLDOWN_MS) return;
    wateredCooldown.set(sapling.id, Date.now());
    sapling.waterCount = (sapling.waterCount || 0) + 1;
    saveSaplings();
    spawnSparkleAt(row, col);
    playWaterSound();
    addCoins(1);
  }

  function findUnplantedSaplingAt(row, col) {
    return saplings.find(s => !s.planted && s.row === row && s.col === col) || null;
  }

  function findPickupableSapling() {
    const onSelf = findUnplantedSaplingAt(heroPos.row, heroPos.col);
    if (onSelf) return onSelf;
    const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    for (const [dr, dc] of dirs) {
      const s = findUnplantedSaplingAt(heroPos.row + dr, heroPos.col + dc);
      if (s) return s;
    }
    return null;
  }

  function findFreeCellAtTop() {
    for (let r = 0; r <= gardenMaxUnlockedRow; r++) {
      for (let c = 0; c < GARDEN_COLS; c++) {
        if (findPlantAt(r, c) || findDecorationAt(r, c)) continue;
        if (findGroundLogAt(r, c)) continue;
        if (saplings.some(s => s.row === r && s.col === c)) continue;
        if (ownedPets.some(p => p.row === r && p.col === c)) continue;
        return { row: r, col: c };
      }
    }
    return { row: 0, col: 0 };
  }

  function loadMovableLayout() {
    try {
      movableLayout = JSON.parse(Store.kv.getItem(MOVABLE_LAYOUT_KEY)) || {};
    } catch (e) {
      movableLayout = {};
    }
  }
  function saveMovableLayout() {
    Store.kv.setItem(MOVABLE_LAYOUT_KEY, JSON.stringify(movableLayout));
  }

  function loadPurchasedItems() {
    try {
      purchasedItems = JSON.parse(Store.kv.getItem(PURCHASED_ITEMS_KEY)) || [];
    } catch (e) {
      purchasedItems = [];
    }
  }
  function savePurchasedItems() {
    Store.kv.setItem(PURCHASED_ITEMS_KEY, JSON.stringify(purchasedItems));
  }

  function loadPets() {
    try {
      ownedPets = JSON.parse(Store.kv.getItem(PETS_KEY)) || [];
    } catch (e) {
      ownedPets = [];
    }
  }
  function savePets() {
    Store.kv.setItem(PETS_KEY, JSON.stringify(ownedPets));
  }

  function loadCoins() {
    const n = parseInt(Store.kv.getItem(COINS_KEY), 10);
    coins = Number.isFinite(n) && n > 0 ? n : 0;
  }
  function saveCoins() {
    Store.kv.setItem(COINS_KEY, String(coins));
  }
  function addCoins(n) {
    coins += n;
    saveCoins();
    renderCoins();
    if (n > 0) {
      bumpCoinDisplay(n);
    }
  }
  function renderCoins() {
    const el = document.getElementById('garden-coins');
    if (el) el.textContent = `\u{1FA99} ${coins}`;
    const shopEl = document.getElementById('shop-coins-amt');
    if (shopEl) shopEl.textContent = coins;
    renderShop();
  }

  function bumpCoinDisplay(amount) {
    [document.getElementById('garden-coins'), document.getElementById('shop-coins-row')].forEach(el => {
      if (!el) return;
      el.classList.remove('coin-bump');
      void el.offsetWidth;
      el.classList.add('coin-bump');
      const popup = document.createElement('span');
      popup.className = 'coin-popup';
      popup.textContent = '+' + amount;
      el.appendChild(popup);
      setTimeout(() => popup.remove(), 700);
    });
  }

  let gardenLayout = {};
  let heroPos = { row: 0, col: 0 };
  let heroFacing = 1;
  let heroDirection = 'down';
  let gardenRows = SECTION_ROWS;
  let gardenMaxUnlockedRow = SECTION_ROWS - 1;
  let heldPlantId = null;
  let heldPlantVariety = null;
  let heldDecoration = null;
  let pendingTreats = [];
  let heldTreat = null;
  const wateredCooldown = new Map();

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  /* Sound engine (synthesized, no audio files) */
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, duration, type, volume) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.value = volume != null ? volume : 0.08;
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function playNoiseBurst(duration, filterFreq, volume) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  function playPickupSound() {
    playTone(520, 0.07, 'triangle', 0.06);
    setTimeout(() => playTone(700, 0.06, 'triangle', 0.05), 40);
  }

  function playDirtSound() {
    playNoiseBurst(0.09, 450, 0.07);
  }

  function playWaterSound() {
    playNoiseBurst(0.28, 2200, 0.028);
    const drops = 4;
    for (let i = 0; i < drops; i++) {
      const delay = i * 55 + Math.random() * 35;
      const freq = 850 + Math.random() * 750;
      setTimeout(() => playTone(freq, 0.05, 'sine', 0.05), delay);
    }
  }

  function playChopSound() {
    playNoiseBurst(0.06, 900, 0.08);
    setTimeout(() => playTone(160, 0.1, 'sawtooth', 0.05), 40);
  }

  const THEME_STEP_SOUND = {
    grass: 'grass', glass: 'stone', wood: 'wood', patio: 'stone',
    maze: 'grass', water: 'water', soil: 'dirt', orchard: 'grass'
  };

  function playStepSound(kind) {
    if (kind === 'water') { playNoiseBurst(0.1, 1400, 0.045); return; }
    if (kind === 'wood') { playTone(190, 0.05, 'triangle', 0.045); playNoiseBurst(0.03, 2500, 0.025); return; }
    if (kind === 'stone') { playTone(260, 0.04, 'square', 0.035); return; }
    if (kind === 'dirt') { playNoiseBurst(0.07, 500, 0.05); return; }
    playNoiseBurst(0.05, 3200, 0.03);
  }

  function loadGardenLayout() {
    try {
      const raw = Store.kv.getItem(GARDEN_LAYOUT_KEY);
      gardenLayout = raw ? JSON.parse(raw) : {};
    } catch (e) {
      gardenLayout = {};
    }
  }

  function saveGardenLayout() {
    Store.kv.setItem(GARDEN_LAYOUT_KEY, JSON.stringify(gardenLayout));
  }

  function loadHeroPos() {
    try {
      const raw = Store.kv.getItem(HERO_POS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      heroPos = (parsed && Number.isFinite(parsed.row) && Number.isFinite(parsed.col)) ? { row: parsed.row, col: parsed.col } : { row: 0, col: 0 };
      heroDirection = (parsed && parsed.direction) ? parsed.direction : 'down';
      heroFacing = heroDirection === 'left' ? -1 : 1;
    } catch (e) {
      heroPos = { row: 0, col: 0 };
      heroDirection = 'down';
      heroFacing = 1;
    }
  }

  function saveHeroPos() {
    Store.kv.setItem(HERO_POS_KEY, JSON.stringify({ row: heroPos.row, col: heroPos.col, direction: heroDirection }));
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

  function gardenerSVG(direction, outfit) {
    const o = outfit || OUTFITS.classic;
    if (direction === 'up') return gardenerBackSVG(o);
    if (direction === 'left' || direction === 'right') return gardenerSideSVG(o);
    return gardenerFrontSVG(o);
  }

  function sparkleSVG(size) {
    const s = size || 18;
    return `<svg width="${s}" height="${s}" viewBox="0 0 5 5" shape-rendering="crispEdges">
      <rect x="2" y="0" width="1" height="1" fill="#fff59d"/>
      <rect x="0" y="2" width="1" height="1" fill="#fff59d"/>
      <rect x="4" y="2" width="1" height="1" fill="#fff59d"/>
      <rect x="2" y="4" width="1" height="1" fill="#fff59d"/>
      <rect x="2" y="2" width="1" height="1" fill="#ffffff"/>
    </svg>`;
  }

  const PLANT_VARIETIES = [
    { name: 'Rose', plant: '<rect x="6" y="8" width="1" height="6" fill="#3f9142"/><rect x="4" y="10" width="2" height="1" fill="#2f7a34"/><rect x="8" y="9" width="2" height="1" fill="#2f7a34"/><rect x="4" y="3" width="6" height="5" fill="#d0353a"/><rect x="5" y="2" width="1" height="1" fill="#d0353a"/><rect x="8" y="2" width="1" height="1" fill="#d0353a"/>' },
    { name: 'Tulip', plant: '<rect x="6" y="7" width="1" height="7" fill="#3f9142"/><rect x="3" y="10" width="3" height="1" fill="#2f7a34"/><rect x="4" y="3" width="6" height="5" fill="#e0546a"/><rect x="5" y="2" width="4" height="1" fill="#e0546a"/>' },
    { name: 'Sunflower', plant: '<rect x="6" y="9" width="1" height="5" fill="#3f9142"/><rect x="3" y="11" width="2" height="1" fill="#2f7a34"/><rect x="9" y="10" width="2" height="1" fill="#2f7a34"/><rect x="2" y="2" width="10" height="8" fill="#f4c430"/><rect x="5" y="5" width="4" height="4" fill="#6b4423"/>' },
    { name: 'Daisy', plant: '<rect x="6" y="8" width="1" height="6" fill="#3f9142"/><rect x="3" y="3" width="8" height="6" fill="#f7f7f2"/><rect x="6" y="5" width="2" height="2" fill="#f4c430"/>' },
    { name: 'Lavender', plant: '<rect x="6" y="5" width="1" height="9" fill="#3f9142"/><rect x="4" y="1" width="1" height="1" fill="#9b8ad4"/><rect x="6" y="0" width="1" height="1" fill="#9b8ad4"/><rect x="8" y="1" width="1" height="1" fill="#9b8ad4"/><rect x="5" y="3" width="1" height="1" fill="#6a4fb0"/><rect x="7" y="3" width="1" height="1" fill="#6a4fb0"/><rect x="6" y="2" width="1" height="1" fill="#6a4fb0"/>' },
    { name: 'Cactus', plant: '<rect x="5" y="3" width="4" height="10" fill="#4c8c3c"/><rect x="2" y="6" width="2" height="5" fill="#4c8c3c"/><rect x="9" y="5" width="2" height="5" fill="#4c8c3c"/><rect x="6" y="1" width="2" height="2" fill="#e87ba4"/>' },
    { name: 'Succulent', plant: '<rect x="5" y="7" width="4" height="4" fill="#3fb8a8"/><rect x="3" y="8" width="2" height="2" fill="#3fb8a8"/><rect x="9" y="8" width="2" height="2" fill="#3fb8a8"/><rect x="4" y="5" width="2" height="2" fill="#6bc06e"/><rect x="8" y="5" width="2" height="2" fill="#6bc06e"/><rect x="6" y="4" width="2" height="2" fill="#6bc06e"/>' },
    { name: 'Bonsai Tree', plant: '<rect x="6" y="8" width="2" height="6" fill="#6b4423"/><rect x="3" y="2" width="8" height="6" fill="#2f7a34"/><rect x="5" y="1" width="4" height="2" fill="#3f9142"/>' },
    { name: 'Fern', plant: '<rect x="6" y="2" width="1" height="12" fill="#3f9142"/><rect x="2" y="4" width="3" height="1" fill="#6bc06e"/><rect x="2" y="7" width="3" height="1" fill="#6bc06e"/><rect x="2" y="10" width="3" height="1" fill="#6bc06e"/><rect x="9" y="5" width="3" height="1" fill="#6bc06e"/><rect x="9" y="8" width="3" height="1" fill="#6bc06e"/>' },
    { name: 'Ivy', plant: '<rect x="1" y="8" width="2" height="1" fill="#3f9142"/><rect x="0" y="10" width="2" height="1" fill="#2f7a34"/><rect x="11" y="8" width="2" height="1" fill="#3f9142"/><rect x="12" y="10" width="2" height="1" fill="#2f7a34"/><rect x="5" y="6" width="4" height="4" fill="#3f9142"/>' },
    { name: 'Orchid', plant: '<rect x="6" y="6" width="1" height="7" fill="#3f9142"/><rect x="7" y="5" width="1" height="1" fill="#3f9142"/><rect x="7" y="2" width="3" height="3" fill="#6a4fb0"/><rect x="4" y="4" width="3" height="3" fill="#e87ba4"/>' },
    { name: 'Bamboo', plant: '<rect x="4" y="1" width="2" height="12" fill="#3f9142"/><rect x="8" y="1" width="2" height="12" fill="#6bc06e"/><rect x="4" y="5" width="2" height="1" fill="#2f7a34"/><rect x="8" y="8" width="2" height="1" fill="#2f7a34"/><rect x="4" y="9" width="2" height="1" fill="#2f7a34"/><rect x="3" y="0" width="2" height="1" fill="#6bc06e"/><rect x="9" y="0" width="2" height="1" fill="#6bc06e"/>' },
    { name: 'Venus Flytrap', plant: '<rect x="5" y="8" width="1" height="5" fill="#3f9142"/><rect x="8" y="8" width="1" height="5" fill="#3f9142"/><rect x="3" y="5" width="4" height="3" fill="#2f7a34"/><rect x="4" y="6" width="2" height="1" fill="#d0353a"/><rect x="7" y="4" width="4" height="3" fill="#2f7a34"/><rect x="8" y="5" width="2" height="1" fill="#d0353a"/>' },
    { name: 'Pumpkin Vine', plant: '<rect x="2" y="8" width="4" height="3" fill="#3f9142"/><rect x="8" y="7" width="4" height="3" fill="#3f9142"/><rect x="5" y="8" width="4" height="4" fill="#eb6834"/><rect x="6" y="7" width="1" height="1" fill="#2f7a34"/>' },
    { name: 'Tomato Plant', plant: '<rect x="6" y="11" width="1" height="2" fill="#3f9142"/><rect x="3" y="5" width="8" height="6" fill="#2f7a34"/><rect x="4" y="6" width="2" height="2" fill="#d0353a"/><rect x="8" y="8" width="2" height="2" fill="#d0353a"/><rect x="6" y="5" width="2" height="2" fill="#d0353a"/>' },
    { name: 'Blueberry Bush', plant: '<rect x="6" y="11" width="1" height="2" fill="#6b4423"/><rect x="3" y="5" width="8" height="6" fill="#3f9142"/><rect x="4" y="6" width="1" height="1" fill="#4361ee"/><rect x="7" y="7" width="1" height="1" fill="#4361ee"/><rect x="9" y="6" width="1" height="1" fill="#4361ee"/><rect x="5" y="9" width="1" height="1" fill="#4361ee"/>' },
    { name: 'Basil Herb', plant: '<rect x="6" y="11" width="1" height="2" fill="#2f7a34"/><rect x="3" y="6" width="4" height="5" fill="#3f9142"/><rect x="7" y="5" width="4" height="6" fill="#6bc06e"/>' },
    { name: 'Clover', plant: '<rect x="6" y="10" width="1" height="3" fill="#2f7a34"/><rect x="4" y="7" width="3" height="3" fill="#6bc06e"/><rect x="7" y="7" width="3" height="3" fill="#6bc06e"/><rect x="5" y="5" width="3" height="3" fill="#3f9142"/>' },
    { name: 'Aloe Vera', plant: '<rect x="6" y="2" width="1" height="9" fill="#3fb8a8"/><rect x="5" y="8" width="3" height="2" fill="#3fb8a8"/><rect x="3" y="5" width="1" height="6" fill="#3fb8a8"/><rect x="2" y="9" width="3" height="1" fill="#3fb8a8"/><rect x="9" y="5" width="1" height="6" fill="#3fb8a8"/><rect x="9" y="9" width="3" height="1" fill="#3fb8a8"/>' },
    { name: 'Marigold', plant: '<rect x="6" y="9" width="1" height="5" fill="#3f9142"/><rect x="4" y="3" width="6" height="6" fill="#eb9c34"/><rect x="6" y="5" width="2" height="2" fill="#f4c430"/>' },
    { name: 'Peace Lily', plant: '<rect x="3" y="6" width="8" height="6" fill="#2f7a34"/><rect x="6" y="2" width="3" height="5" fill="#f7f7f2"/><rect x="7" y="2" width="1" height="2" fill="#f4c430"/>' },
    { name: 'Snake Plant', plant: '<rect x="4" y="2" width="2" height="11" fill="#2f7a34"/><rect x="7" y="0" width="2" height="13" fill="#3f9142"/><rect x="10" y="3" width="2" height="10" fill="#2f7a34"/><rect x="4" y="5" width="2" height="1" fill="#6bc06e"/><rect x="7" y="6" width="2" height="1" fill="#6bc06e"/>' }
  ];

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

  function findPlantAt(row, col) {
    for (const id in gardenLayout) {
      const p = gardenLayout[id];
      if (p.row === row && p.col === col) return id;
    }
    return null;
  }

  function focusGarden() {
    const plot = document.getElementById('garden-plot');
    if (plot) plot.focus();
  }

  const GARDEN_VISIBLE_KEY = 'garden-visible-v1';
  let gardenVisible = true;

  function loadGardenVisibility() {
    const raw = Store.kv.getItem(GARDEN_VISIBLE_KEY);
    gardenVisible = raw === null ? true : raw === 'true';
  }

  function saveGardenVisibility() {
    Store.kv.setItem(GARDEN_VISIBLE_KEY, String(gardenVisible));
  }

  function applyGardenVisibility() {
    const col = document.querySelector('.garden-col');
    if (col) col.style.display = gardenVisible ? '' : 'none';
    const btn = document.getElementById('garden-toggle-btn');
    if (btn) btn.textContent = gardenVisible ? 'Hide Garden' : 'Show Garden';
  }

  function toggleGardenVisibility() {
    gardenVisible = !gardenVisible;
    saveGardenVisibility();
    applyGardenVisibility();
  }

  function heldItemPreviewHtml() {
    if (heldPlantId != null && heldPlantVariety != null) {
      const variety = PLANT_VARIETIES[heldPlantVariety] || PLANT_VARIETIES[0];
      return buildPlantSVG(variety, NEUTRAL_POT);
    }
    if (heldDecoration) return heldDecoration.svg;
    if (heldTreat) return treatSVG();
    if (heldLog) return logSVG();
    if (heldSapling) return saplingSVG();
    return '';
  }

  function positionHero() {
    const x = heroPos.col * CELL_SIZE;
    const y = heroPos.row * CELL_SIZE;

    const heroEl = document.getElementById('garden-hero');
    if (heroEl) {
      heroEl.style.transform = `translate(${x}px, ${y}px) scaleX(${heroFacing})`;
      const heldHtml = heldItemPreviewHtml();
      const heldWrap = heldHtml ? `<div class="garden-held-indicator">${heldHtml}</div>` : '';
      heroEl.innerHTML = `${heldWrap}<div class="sprite-shadow"></div>${gardenerSVG(heroDirection, getEquippedOutfit())}`;
    }
  }

  function spawnSparkleAt(row, col) {
    const plot = document.getElementById('garden-plot');
    if (!plot) return;
    const el = document.createElement('div');
    el.className = 'garden-sparkle';
    el.style.left = (col * CELL_SIZE + CELL_SIZE / 2 - 8) + 'px';
    el.style.top = (row * CELL_SIZE + 2) + 'px';
    el.innerHTML = sparkleSVG();
    plot.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  function spawnFriendshipSparkleAt(row, col, friendship) {
    const plot = document.getElementById('garden-plot');
    if (!plot) return;
    const pct = Math.max(0, Math.min(100, friendship || 0));
    const size = 8 + (pct / 100) * 26;
    const el = document.createElement('div');
    el.className = 'garden-sparkle';
    el.style.left = (col * CELL_SIZE + CELL_SIZE / 2 - size / 2) + 'px';
    el.style.top = (row * CELL_SIZE - size * 0.25) + 'px';
    el.innerHTML = sparkleSVG(size);
    plot.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  function heartSVG() {
    return `<svg width="16" height="16" viewBox="0 0 7 7" shape-rendering="crispEdges">
      <rect x="1" y="1" width="2" height="2" fill="#e0546a"/>
      <rect x="4" y="1" width="2" height="2" fill="#e0546a"/>
      <rect x="0" y="2" width="7" height="2" fill="#e0546a"/>
      <rect x="1" y="4" width="5" height="1" fill="#e0546a"/>
      <rect x="2" y="5" width="3" height="1" fill="#e0546a"/>
      <rect x="3" y="6" width="1" height="1" fill="#e0546a"/>
    </svg>`;
  }

  function spawnHeartsAt(row, col) {
    const plot = document.getElementById('garden-plot');
    if (!plot) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'garden-sparkle';
        el.style.left = (col * CELL_SIZE + CELL_SIZE / 2 - 8 + (Math.random() * 10 - 5)) + 'px';
        el.style.top = (row * CELL_SIZE + 2) + 'px';
        el.innerHTML = heartSVG();
        plot.appendChild(el);
        setTimeout(() => el.remove(), 700);
      }, i * 130);
    }
  }

  function waterCheck(row, col, knownTaskId) {
    const taskId = knownTaskId || findPlantAt(row, col);
    if (!taskId) return;
    const last = wateredCooldown.get(taskId) || 0;
    if (Date.now() - last < WATER_COOLDOWN_MS) return;
    wateredCooldown.set(taskId, Date.now());
    spawnSparkleAt(row, col);
    playWaterSound();
    addCoins(1);
  }

  function findAdjacentPlant() {
    const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    for (const [dr, dc] of dirs) {
      const id = findPlantAt(heroPos.row + dr, heroPos.col + dc);
      if (id) return id;
    }
    return null;
  }

  function findAdjacentMovable() {
    const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    for (const [dr, dc] of dirs) {
      const r = heroPos.row + dr, c = heroPos.col + dc;
      const d = placedDecorations.find(x => x.movable && x.blocking &&
        r >= x.row && r < x.row + x.height && c >= x.col && c < x.col + x.width);
      if (d) return d;
    }
    return null;
  }

  function findAdjacentToolTarget(toolKind) {
    const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    for (const [dr, dc] of dirs) {
      const r = heroPos.row + dr, c = heroPos.col + dc;
      const d = placedDecorations.find(x => x.choppable && x.toolRequired === toolKind &&
        r >= x.row && r < x.row + x.height && c >= x.col && c < x.col + x.width);
      if (d) return d;
    }
    return null;
  }

  function findAdjacentGrownSapling() {
    const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    for (const [dr, dc] of dirs) {
      const r = heroPos.row + dr, c = heroPos.col + dc;
      const s = saplings.find(x => isSaplingGrown(x) && x.row === r && x.col === c);
      if (s) return s;
    }
    return null;
  }

  function findAdjacentTreat() {
    const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    for (const [dr, dc] of dirs) {
      const r = heroPos.row + dr, c = heroPos.col + dc;
      const t = pendingTreats.find(x => x.row === r && x.col === c);
      if (t) return t;
    }
    return null;
  }

  function findGroundLogAt(row, col) {
    return groundLogs.find(l => l.row === row && l.col === col) || null;
  }

  function findPickupableLog() {
    const onSelf = findGroundLogAt(heroPos.row, heroPos.col);
    if (onSelf) return onSelf;
    const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    for (const [dr, dc] of dirs) {
      const l = findGroundLogAt(heroPos.row + dr, heroPos.col + dc);
      if (l) return l;
    }
    return null;
  }

  function findCabinSiteAt(row, col) {
    return cabinSites.find(s => s.row === row && s.col === col) || null;
  }

  function dropOrStackLog() {
    const site = findCabinSiteAt(heroPos.row, heroPos.col);
    if (site && !site.complete) {
      site.logCount = Math.min(CABIN_LOGS_NEEDED, site.logCount + 1);
      if (site.logCount >= CABIN_LOGS_NEEDED) site.complete = true;
      heldLog = null;
      saveCabinSites();
      renderGarden();
      return;
    }

    const existingLog = findGroundLogAt(heroPos.row, heroPos.col);
    if (existingLog) {
      groundLogs = groundLogs.filter(l => l.id !== existingLog.id);
      cabinSites.push({
        id: 'cabin-' + hashStr(heroPos.row + ':' + heroPos.col + Date.now() + Math.random()),
        row: heroPos.row, col: heroPos.col, logCount: 2, complete: false
      });
      heldLog = null;
      saveGroundLogs();
      saveCabinSites();
      renderGarden();
      return;
    }

    groundLogs.push({ id: heldLog.id, row: heroPos.row, col: heroPos.col });
    heldLog = null;
    saveGroundLogs();
    renderGarden();
  }

  function checkTreatDelivery() {
    if (!heldTreat) return;
    const pet = ownedPets.find(p => p.id === heldTreat.petId);
    if (!pet) {
      heldTreat = null;
      renderGarden();
      return;
    }
    const dist = Math.abs(pet.row - heroPos.row) + Math.abs(pet.col - heroPos.col);
    if (dist <= 1) {
      const treatDef = PET_TREATS[pet.type];
      pet.friendship = Math.min(100, pet.friendship + (treatDef ? treatDef.gain : 15));
      savePets();
      spawnHeartsAt(pet.row, pet.col);
      heldTreat = null;
      renderGarden();
    }
  }

  function handleGardenKeydown(event) {
    const key = event.key.toLowerCase();

    if (key === 'e') {
      event.preventDefault();
      togglePickup();
      return;
    }

    if (key === 'x') {
      event.preventDefault();
      addCoins(100);
      return;
    }

    if (key === 'y') {
      event.preventDefault();
      coins = 0;
      saveCoins();
      renderCoins();
      return;
    }

    if (key === 'f') {
      event.preventDefault();
      saplings.forEach(s => { if (s.planted) s.waterCount = SAPLING_WATERS_NEEDED; });
      saveSaplings();
      renderGarden();
      return;
    }

    let dr = 0, dc = 0;
    if (key === 'arrowup' || key === 'w') dr = -1;
    else if (key === 'arrowdown' || key === 's') dr = 1;
    else if (key === 'arrowleft' || key === 'a') dc = -1;
    else if (key === 'arrowright' || key === 'd') dc = 1;
    else return;

    event.preventDefault();
    if (dc !== 0) {
      heroFacing = dc;
      heroDirection = dc === -1 ? 'left' : 'right';
    } else if (dr === -1) {
      heroDirection = 'up';
    } else if (dr === 1) {
      heroDirection = 'down';
    }

    const targetRow = heroPos.row + dr;
    const targetCol = heroPos.col + dc;

    if (targetRow < 0 || targetRow > gardenMaxUnlockedRow || targetCol < 0 || targetCol >= GARDEN_COLS) {
      saveHeroPos();
      positionHero();
      return;
    }

    const plantId = findPlantAt(targetRow, targetCol);
    if (plantId) {
      waterCheck(targetRow, targetCol, plantId);
      saveHeroPos();
      positionHero();
      return;
    }

    const saplingHere = saplings.find(s => s.planted && s.row === targetRow && s.col === targetCol);
    if (saplingHere && !isSaplingGrown(saplingHere)) {
      waterSaplingCheck(targetRow, targetCol, saplingHere);
      saveHeroPos();
      positionHero();
      return;
    }

    if (findDecorationAt(targetRow, targetCol)) {
      saveHeroPos();
      positionHero();
      return;
    }

    if (cabinSites.some(s => s.complete && s.row === targetRow && s.col === targetCol)) {
      saveHeroPos();
      positionHero();
      return;
    }

    heroPos = { row: targetRow, col: targetCol };
    saveHeroPos();
    positionHero();
    playStepSound(THEME_STEP_SOUND[sectionInfo(Math.floor(targetRow / SECTION_ROWS)).theme] || 'grass');
    reactPetsToHero();
    checkTreatDelivery();
    checkAnimalSounds();
  }

  const animalSoundCooldown = new Map();
  function checkAnimalSounds() {
    ownedPets.forEach(p => {
      if (p.row === heroPos.row && p.col === heroPos.col) {
        const last = animalSoundCooldown.get(p.id) || 0;
        if (Date.now() - last > 2000) {
          animalSoundCooldown.set(p.id, Date.now());
          spawnFriendshipSparkleAt(p.row, p.col, p.friendship);
        }
      }
    });
  }

  function togglePickup() {
    if (heldPlantId) {
      gardenLayout[heldPlantId] = { row: heroPos.row, col: heroPos.col, variety: heldPlantVariety };
      heldPlantId = null;
      heldPlantVariety = null;
      saveGardenLayout();
      playDirtSound();
      renderGarden();
      return;
    }

    if (heldLog) {
      dropOrStackLog();
      return;
    }

    if (heldSapling) {
      const sapling = saplings.find(s => s.id === heldSapling.id);
      if (sapling) {
        sapling.row = heroPos.row;
        sapling.col = heroPos.col;
        sapling.planted = true;
        sapling.plantedAt = Date.now();
        saveSaplings();
        playDirtSound();
      }
      heldSapling = null;
      renderGarden();
      return;
    }

    if (heldDecoration) {
      if (heldDecoration.kind === 'hoe') {
        const key = heroPos.row + ':' + heroPos.col;
        if (!dugTiles.has(key) && !findPlantAt(heroPos.row, heroPos.col) && !findDecorationAt(heroPos.row, heroPos.col)) {
          dugTiles.add(key);
          saveDugTiles();
          playDirtSound();
          renderGarden();
        }
        return;
      }

      if (heldDecoration.kind === 'axe') {
        const sapling = findAdjacentGrownSapling();
        if (sapling) {
          saplings = saplings.filter(s => s.id !== sapling.id);
          saveSaplings();
          groundLogs.push({ id: 'log-' + hashStr(sapling.id + Date.now() + Math.random()), row: sapling.row, col: sapling.col });
          saveGroundLogs();
          spawnSparkleAt(sapling.row, sapling.col);
          playChopSound();
          renderGarden();
          return;
        }
        const tree = findAdjacentToolTarget('axe');
        if (tree) {
          choppedTrees.add(tree.instanceId);
          saveChoppedTrees();
          groundLogs.push({ id: 'log-' + hashStr(tree.instanceId + Date.now() + Math.random()), row: tree.row, col: tree.col });
          saveGroundLogs();
          spawnSparkleAt(tree.row, tree.col);
          playChopSound();
          renderGarden();
          return;
        }
      }

      if (heldDecoration.kind === 'shovel') {
        const bush = findAdjacentToolTarget('shovel');
        if (bush) {
          choppedTrees.add(bush.instanceId);
          saveChoppedTrees();
          spawnSparkleAt(bush.row, bush.col);
          playChopSound();

          if (heldDecoration.source === 'item') {
            const item = purchasedItems.find(p => p.id === heldDecoration.sourceId);
            if (item) { item.row = heroPos.row; item.col = heroPos.col; }
            savePurchasedItems();
          } else if (heldDecoration.source === 'theme') {
            movableLayout[heldDecoration.instanceId] = { row: heroPos.row, col: heroPos.col };
            saveMovableLayout();
          }

          heldDecoration = { ...bush, movable: true, choppable: false };
          playPickupSound();
          renderGarden();
          return;
        }
      }

      if (heldDecoration.source === 'theme') {
        movableLayout[heldDecoration.instanceId] = { row: heroPos.row, col: heroPos.col };
        saveMovableLayout();
      } else if (heldDecoration.source === 'item') {
        const item = purchasedItems.find(p => p.id === heldDecoration.sourceId);
        if (item) { item.row = heroPos.row; item.col = heroPos.col; }
        savePurchasedItems();
      }
      heldDecoration = null;
      renderGarden();
      return;
    }

    if (heldTreat) {
      const idx = pendingTreats.findIndex(t => t.id === heldTreat.id);
      if (idx !== -1) pendingTreats[idx] = { ...pendingTreats[idx], row: heroPos.row, col: heroPos.col };
      heldTreat = null;
      renderGarden();
      return;
    }

    const taskId = findAdjacentPlant();
    if (taskId) {
      heldPlantVariety = gardenLayout[taskId].variety;
      heldPlantId = taskId;
      delete gardenLayout[taskId];
      saveGardenLayout();
      playPickupSound();
      renderGarden();
      return;
    }

    const decor = findAdjacentMovable();
    if (decor) {
      heldDecoration = decor;
      playPickupSound();
      renderGarden();
      return;
    }

    const log = findPickupableLog();
    if (log) {
      heldLog = log;
      groundLogs = groundLogs.filter(l => l.id !== log.id);
      saveGroundLogs();
      playPickupSound();
      renderGarden();
      return;
    }

    const sapling = findPickupableSapling();
    if (sapling) {
      heldSapling = { id: sapling.id };
      playPickupSound();
      renderGarden();
      return;
    }

    const treat = findAdjacentTreat();
    if (treat) {
      heldTreat = { id: treat.id, petId: treat.petId };
      pendingTreats = pendingTreats.filter(t => t.id !== treat.id);
      playPickupSound();
      renderGarden();
    }
  }

  function renderSectionSideLabels(bandsToRender, unlockedCount) {
    const wrap = document.getElementById('garden-side-labels');
    if (!wrap) return;
    wrap.style.height = (bandsToRender * SECTION_ROWS * CELL_SIZE) + 'px';

    const completed = App.tickets().filter(t => t.completedAt);

    let html = '';
    for (let i = 0; i < bandsToRender; i++) {
      const info = sectionInfo(i);
      const top = i * SECTION_ROWS * CELL_SIZE + (SECTION_ROWS * CELL_SIZE) / 2;
      const dimClass = i >= unlockedCount ? ' dimmed' : '';

      const counts = {};
      let total = 0;
      completed.forEach(t => {
        const pos = gardenLayout[t.id];
        if (!pos || Math.floor(pos.row / SECTION_ROWS) !== i) return;
        const variety = PLANT_VARIETIES[pos.variety] || PLANT_VARIETIES[0];
        counts[variety.name] = (counts[variety.name] || 0) + 1;
        total++;
      });
      const parts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      let summaryHtml;
      if (total === 0) {
        summaryHtml = '<ul class="garden-side-label-summary"><li>No plants yet</li></ul>';
      } else {
        const shown = parts.slice(0, 3).map(([name, n]) => `<li>${n} ${Util.escapeHtml(name)}</li>`).join('');
        const extra = parts.length > 3 ? `<li>+${parts.length - 3} more</li>` : '';
        summaryHtml = `<ul class="garden-side-label-summary">${shown}${extra}</ul>`;
      }

      html += `<div class="garden-side-label${dimClass}" style="top:${top}px;">
        <div class="garden-side-label-name">${info.icon} ${Util.escapeHtml(info.name)}</div>
        ${summaryHtml}
      </div>`;
    }
    wrap.innerHTML = html;
  }

  function findFreeCellNearHero() {
    for (let radius = 0; radius < GARDEN_COLS + SECTION_ROWS; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r = heroPos.row + dr, c = heroPos.col + dc;
          if (r < 0 || r > gardenMaxUnlockedRow || c < 0 || c >= GARDEN_COLS) continue;
          if (findPlantAt(r, c) || findDecorationAt(r, c)) continue;
          if (ownedPets.some(p => p.row === r && p.col === c)) continue;
          if (r === heroPos.row && c === heroPos.col) continue;
          return { row: r, col: c };
        }
      }
    }
    return { row: heroPos.row, col: heroPos.col };
  }

  function buyPet(type) {
    const def = PET_TYPES[type];
    if (!def || coins < def.cost || ownedPets.length >= MAX_PETS) return;
    coins -= def.cost;
    saveCoins();
    const cell = findFreeCellNearHero();
    ownedPets.push({
      id: 'pet-' + hashStr(type + Object.keys(ownedPets).length + Math.random()),
      type,
      row: cell.row,
      col: cell.col,
      friendship: 0
    });
    savePets();
    renderCoins();
    renderGarden();
  }

  function unlockRandomPet() {
    if (coins < UNLOCK_PET_COST || ownedPets.length >= MAX_PETS) return;
    coins -= UNLOCK_PET_COST;
    saveCoins();
    const types = Object.keys(PET_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const cell = findFreeCellNearHero();
    ownedPets.push({
      id: 'pet-' + hashStr(type + Object.keys(ownedPets).length + Math.random()),
      type,
      row: cell.row,
      col: cell.col,
      friendship: 0
    });
    savePets();
    renderCoins();
    renderGarden();
  }

  function buyItem(kind) {
    const def = SHOP_ITEMS[kind];
    if (!def || coins < def.cost) return;
    coins -= def.cost;
    saveCoins();
    const cell = findFreeCellNearHero();
    purchasedItems.push({
      id: 'item-' + hashStr(kind + purchasedItems.length + Math.random()),
      kind,
      row: cell.row,
      col: cell.col
    });
    savePurchasedItems();
    renderCoins();
    renderGarden();
  }

  function buySapling() {
    if (coins < SAPLING_COST) return;
    coins -= SAPLING_COST;
    saveCoins();
    const cell = findFreeCellAtTop();
    saplings.push({
      id: 'sap-' + hashStr('sap' + saplings.length + Date.now() + Math.random()),
      row: cell.row,
      col: cell.col,
      planted: false,
      plantedAt: null,
      waterCount: 0
    });
    saveSaplings();
    renderCoins();
    renderGarden();
  }

  function resetGarden() {
    if (coins < RESET_PURCHASES_COST) return;
    coins -= RESET_PURCHASES_COST;
    saveCoins();

    heldDecoration = null;
    heldTreat = null;
    heldLog = null;
    heldSapling = null;
    heldPlantId = null;
    heldPlantVariety = null;

    purchasedItems = [];
    ownedPets = [];
    pendingTreats = [];
    saplings = [];
    cabinSites = [];
    groundLogs = [];
    dugTiles = new Set();
    choppedTrees = new Set();
    movableLayout = {};
    ownedOutfits = ['classic'];
    equippedOutfit = 'classic';

    savePurchasedItems();
    savePets();
    saveSaplings();
    saveCabinSites();
    saveGroundLogs();
    saveDugTiles();
    saveChoppedTrees();
    saveMovableLayout();
    saveOutfits();

    renderCoins();
    document.getElementById('garden-gardener').innerHTML = gardenerSVG('down', getEquippedOutfit());
    positionHero();
    renderGarden();
  }

  function buyTreat(petId) {
    const pet = ownedPets.find(p => p.id === petId);
    const treatDef = pet && PET_TREATS[pet.type];
    if (!pet || !treatDef || coins < treatDef.cost) return;
    coins -= treatDef.cost;
    saveCoins();
    const cell = findFreeCellNearHero();
    pendingTreats.push({
      id: 'treat-' + hashStr(petId + pendingTreats.length + Math.random()),
      petId,
      row: cell.row,
      col: cell.col
    });
    renderCoins();
    renderGarden();
  }

  function renderShop() {
    const petsWrap = document.getElementById('shop-pets');
    if (petsWrap) {
      const capped = ownedPets.length >= MAX_PETS;
      const tiles = Object.entries(PET_TYPES).map(([type, def]) => `
        <button class="shop-tile" ${(coins < def.cost || capped) ? 'disabled' : ''} onclick="buyPet('${type}')">
          <span class="shop-tile-icon">${def.icon}</span>
          <span class="shop-tile-label">${Util.escapeHtml(def.label)}</span>
          <span class="shop-tile-action">\u{1FA99}${def.cost}</span>
        </button>`).join('') +
        `<button class="shop-tile" ${(coins < UNLOCK_PET_COST || capped) ? 'disabled' : ''} onclick="unlockRandomPet()">
          <span class="shop-tile-icon">\u{2728}</span>
          <span class="shop-tile-label">Mystery pet</span>
          <span class="shop-tile-action">\u{1FA99}${UNLOCK_PET_COST}</span>
        </button>`;
      petsWrap.innerHTML = `<div class="shop-info">Pets: ${ownedPets.length}/${MAX_PETS}</div><div class="shop-grid">${tiles}</div>`;
    }

    const itemsWrap = document.getElementById('shop-items');
    if (itemsWrap) {
      const tiles = Object.entries(SHOP_ITEMS).map(([kind, def]) => `
        <button class="shop-tile" ${coins < def.cost ? 'disabled' : ''} onclick="buyItem('${kind}')">
          <span class="shop-tile-icon">${def.icon}</span>
          <span class="shop-tile-label">${Util.escapeHtml(def.label)}</span>
          <span class="shop-tile-action">\u{1FA99}${def.cost}</span>
        </button>`).join('') +
        `<button class="shop-tile" ${coins < SAPLING_COST ? 'disabled' : ''} onclick="buySapling()">
          <span class="shop-tile-icon">\u{1F331}</span>
          <span class="shop-tile-label">Sapling (water 5x to grow)</span>
          <span class="shop-tile-action">\u{1FA99}${SAPLING_COST}</span>
        </button>` +
        `<button class="shop-tile" ${coins < RESET_PURCHASES_COST ? 'disabled' : ''} onclick="resetGarden()">
          <span class="shop-tile-icon">\u{267B}</span>
          <span class="shop-tile-label">Reset garden</span>
          <span class="shop-tile-action">\u{1FA99}${RESET_PURCHASES_COST}</span>
        </button>`;
      itemsWrap.innerHTML = `<div class="shop-grid">${tiles}</div>`;
    }

    const treatsWrap = document.getElementById('shop-treats');
    if (treatsWrap) {
      if (!ownedPets.length) {
        treatsWrap.innerHTML = '<div class="shop-empty">Buy a pet to unlock treats.</div>';
      } else {
        const tiles = ownedPets.map(p => {
          const petDef = PET_TYPES[p.type];
          const treatDef = PET_TREATS[p.type];
          const waiting = pendingTreats.some(t => t.petId === p.id) || (heldTreat && heldTreat.petId === p.id);
          return `<button class="shop-tile" ${(coins < treatDef.cost || waiting) ? 'disabled' : ''} onclick="buyTreat('${p.id}')">
            <span class="shop-tile-icon">${petDef.icon}</span>
            <span class="shop-tile-label">${Util.escapeHtml(petDef.label)} ${p.friendship}%</span>
            <span class="shop-tile-action">${treatDef.icon} \u{1FA99}${treatDef.cost}</span>
          </button>`;
        }).join('');
        treatsWrap.innerHTML = `<div class="shop-grid">${tiles}</div>`;
      }
    }

    const outfitsWrap = document.getElementById('shop-outfits');
    if (outfitsWrap) {
      const tiles = Object.entries(OUTFITS).map(([id, def]) => {
        const owned = ownedOutfits.includes(id);
        const equipped = equippedOutfit === id;
        let action, onclick, disabled, cls = '';
        if (equipped) {
          action = 'Equipped'; onclick = ''; disabled = true; cls = ' equipped';
        } else if (owned) {
          action = 'Equip'; onclick = `equipOutfit('${id}')`; disabled = false;
        } else {
          action = `\u{1FA99}${def.cost}`; onclick = `buyOutfit('${id}')`; disabled = coins < def.cost;
        }
        return `<button class="shop-tile${cls}" ${disabled ? 'disabled' : ''} onclick="${onclick}">
          <span class="shop-tile-icon">${def.icon}</span>
          <span class="shop-tile-label">${Util.escapeHtml(def.label)}</span>
          <span class="shop-tile-action">${action}</span>
        </button>`;
      }).join('');
      outfitsWrap.innerHTML = `<div class="shop-grid">${tiles}</div>`;
    }
  }

  function positionPets() {
    ownedPets.forEach(p => {
      const el = document.getElementById(p.id);
      if (el) el.style.transform = `translate(${p.col * CELL_SIZE}px, ${p.row * CELL_SIZE}px)`;
    });
  }

  function stepPet(p) {
    const def = PET_TYPES[p.type];
    if (!def) return;
    const dist = Math.abs(p.row - heroPos.row) + Math.abs(p.col - heroPos.col);
    const isFriendly = def.temperament === 'friendly' || p.friendship >= 60;
    const isSkittish = def.temperament === 'skittish' && p.friendship < 60;

    let dr = 0, dc = 0;

    if (isFriendly && dist > 1) {
      dr = Math.sign(heroPos.row - p.row);
      dc = Math.sign(heroPos.col - p.col);
      if (dr !== 0 && dc !== 0) { if (Math.random() < 0.5) dc = 0; else dr = 0; }
    } else if (isSkittish && dist <= 2) {
      dr = Math.sign(p.row - heroPos.row) || (Math.random() < 0.5 ? -1 : 1);
      dc = Math.sign(p.col - heroPos.col) || (Math.random() < 0.5 ? -1 : 1);
      if (dr !== 0 && dc !== 0) { if (Math.random() < 0.5) dc = 0; else dr = 0; }
    } else if (Math.random() < 0.6) {
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]];
      [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
    }

    if (dr === 0 && dc === 0) return;

    const nr = Math.max(0, Math.min(gardenMaxUnlockedRow, p.row + dr));
    const nc = Math.max(0, Math.min(GARDEN_COLS - 1, p.col + dc));
    if (nr === p.row && nc === p.col) return;
    if (nr === heroPos.row && nc === heroPos.col) return;
    if (findPlantAt(nr, nc) || findDecorationAt(nr, nc)) return;
    if (ownedPets.some(o => o !== p && o.row === nr && o.col === nc)) return;

    p.row = nr;
    p.col = nc;
  }

  function stepAllPets() {
    if (ownedPets.length) {
      ownedPets.forEach(stepPet);
      savePets();
      positionPets();
      checkTreatDelivery();
    }
    renderGarden();
  }

  function reactPetsToHero() {
    if (!ownedPets.length) return;
    let moved = false;
    ownedPets.forEach(p => {
      const dist = Math.abs(p.row - heroPos.row) + Math.abs(p.col - heroPos.col);
      if (dist <= 2) {
        stepPet(p);
        moved = true;
      }
    });
    if (moved) {
      savePets();
      positionPets();
    }
  }

  let petTickTimer = null;
  function startPetTicker() {
    if (petTickTimer) clearInterval(petTickTimer);
    petTickTimer = setInterval(stepAllPets, 5000);
  }

  function renderGarden() {
    const completed = App.tickets().filter(t => t.completedAt);
    const completedIds = new Set(completed.map(t => t.id));

    Object.keys(gardenLayout).forEach(id => {
      if (!completedIds.has(id)) delete gardenLayout[id];
    });

    const sorted = completed.slice().sort((a, b) => a.completedAt < b.completedAt ? -1 : 1);

    const unlockedCount = unlockedSectionCount(sorted.length);
    const bandsToRender = unlockedCount + SECTIONS_SHOWN_AHEAD;
    const maxUnlockedRow = unlockedCount * SECTION_ROWS - 1;

    placedDecorations = [];
    for (let i = 0; i < bandsToRender; i++) {
      const info = sectionInfo(i);
      const list = DECORATIONS_BY_THEME[info.theme] || [];
      list.forEach(d => {
        let row = i * SECTION_ROWS + d.row;
        let col = d.col;
        let instanceId = null;
        let svg = d.svg;

        if (d.movable || d.choppable) instanceId = i + ':' + d.id;

        const unlocked = !!(d.choppable && choppedTrees.has(instanceId));

        // Axe-felled trees vanish entirely — they leave a separate ground log behind instead.
        if (unlocked && d.toolRequired === 'axe') return;

        const isMovableNow = d.movable || (unlocked && d.toolRequired === 'shovel');

        if (isMovableNow) {
          if (heldDecoration && heldDecoration.instanceId === instanceId) return;
          const override = movableLayout[instanceId];
          if (override) { row = override.row; col = override.col; }
        }

        placedDecorations.push({
          ...d, row, col, instanceId, source: 'theme', svg,
          movable: isMovableNow, choppable: d.choppable && !unlocked
        });
      });
    }
    purchasedItems.forEach(it => {
      const instanceId = 'item:' + it.id;
      if (heldDecoration && heldDecoration.instanceId === instanceId) return;
      const def = SHOP_ITEMS[it.kind];
      if (!def) return;
      placedDecorations.push({
        row: it.row, col: it.col, width: 1, height: 1, blocking: true, movable: true,
        svg: def.svg(), instanceId, source: 'item', sourceId: it.id, kind: it.kind
      });
    });
    saplings.filter(s => s.planted).forEach(s => {
      placedDecorations.push({
        row: s.row, col: s.col, width: 1, height: 1, blocking: true, movable: false, choppable: false,
        svg: isSaplingGrown(s) ? treeSVG() : saplingSVG(), source: 'sapling', sourceId: s.id
      });
    });

    const occupied = new Set(
      placedDecorations.filter(d => d.blocking).flatMap(d => {
        const cells = [];
        for (let dr = 0; dr < d.height; dr++) {
          for (let dc = 0; dc < d.width; dc++) cells.push((d.row + dr) + ':' + (d.col + dc));
        }
        return cells;
      })
    );
    Object.values(gardenLayout).forEach(p => occupied.add(p.row + ':' + p.col));

    function firstFreeCell() {
      for (let r = 0; r <= maxUnlockedRow; r++) {
        for (let c = 0; c < GARDEN_COLS; c++) {
          const key = r + ':' + c;
          if (!occupied.has(key)) return { row: r, col: c };
        }
      }
      return null;
    }

    sorted.forEach(t => {
      if (!gardenLayout[t.id] && t.id !== heldPlantId) {
        const cell = firstFreeCell();
        if (cell) {
          const variety = hashStr(t.id) % PLANT_VARIETIES.length;
          gardenLayout[t.id] = { row: cell.row, col: cell.col, variety };
          occupied.add(cell.row + ':' + cell.col);
        }
      }
    });

    saveGardenLayout();
    gardenRows = bandsToRender * SECTION_ROWS;
    gardenMaxUnlockedRow = maxUnlockedRow;

    const plot = document.getElementById('garden-plot');
    plot.style.width = (GARDEN_COLS * CELL_SIZE) + 'px';
    plot.style.height = (gardenRows * CELL_SIZE) + 'px';

    let bandsHtml = '';
    let gateHtml = '';
    for (let i = 0; i < bandsToRender; i++) {
      const info = sectionInfo(i);
      const top = i * SECTION_ROWS * CELL_SIZE;
      const height = SECTION_ROWS * CELL_SIZE;
      const dimClass = i === unlockedCount ? ' dim-1' : (i > unlockedCount ? ' dim-2' : '');
      const roofHtml = (info.theme === 'glass' || info.theme === 'wood')
        ? `<div class="garden-section-roof ${info.theme}"></div>` : '';
      const wallHtml = `<div class="garden-section-wall" style="background:${wallPattern(info.theme)};"></div>`;

      const decorHtml = placedDecorations
        .filter(d => d.source === 'theme' && !d.movable && Math.floor(d.row / SECTION_ROWS) === i)
        .map(d => {
          const w = d.width * CELL_SIZE;
          const h = d.height * CELL_SIZE;
          const relTop = (d.row - i * SECTION_ROWS) * CELL_SIZE;
          if (d.blocking) {
            return `<div class="garden-decor" style="left:${d.col * CELL_SIZE}px; top:${relTop}px; width:${w}px; height:${h}px;"><div class="sprite-shadow"></div>${d.svg}</div>`;
          }
          return `<div class="garden-surface" style="left:${d.col * CELL_SIZE}px; top:${relTop}px; width:${w}px; height:${h}px; background:${surfaceBackground(d.kind)};"></div>`;
        }).join('');

      bandsHtml += `<div class="garden-section-band${dimClass}" style="top:${top}px;height:${height}px;${checkerBackground(info.theme)}">
        ${decorHtml}
        ${roofHtml}
        ${wallHtml}
      </div>`;

      if (i === unlockedCount) {
        const remaining = i * TICKETS_PER_SECTION - sorted.length;
        gateHtml = `<div class="garden-gate" style="top:${top - 8}px;">
          <div class="garden-gate-post left"></div>
          <div class="garden-gate-bar"></div>
          <div class="garden-gate-post right"></div>
          <div class="garden-gate-count">${remaining} to unlock</div>
        </div>`;
      }
    }

    const movablesHtml = placedDecorations.filter(d => d.movable).map(d =>
      `<div class="garden-decor" style="left:${d.col * CELL_SIZE}px; top:${d.row * CELL_SIZE}px; width:${d.width * CELL_SIZE}px; height:${d.height * CELL_SIZE}px;"><div class="sprite-shadow"></div>${d.svg}</div>`
    ).join('');

    let cellsHtml = '';
    sorted.forEach(t => {
      const pos = gardenLayout[t.id];
      if (!pos) return;
      const variety = PLANT_VARIETIES[pos.variety] || PLANT_VARIETIES[0];
      const potColor = App.categoryColor(t.category);
      const planted = isOnDirt(pos.row, pos.col);
      cellsHtml += `<div class="garden-cell" style="left:${pos.col * CELL_SIZE}px; top:${pos.row * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px;" title="${Util.escapeHtml(t.title)}">
        <div class="sprite-shadow"></div>
        ${buildPlantSVG(variety, potColor, planted)}
      </div>`;
    });

    const petsHtml = ownedPets.map(p => {
      const def = PET_TYPES[p.type];
      if (!def) return '';
      return `<div class="garden-pet" id="${p.id}" style="width:${CELL_SIZE}px; height:${CELL_SIZE}px; transform:translate(${p.col * CELL_SIZE}px, ${p.row * CELL_SIZE}px);" title="${Util.escapeHtml(def.label)}"><div class="sprite-shadow"></div>${def.svg()}</div>`;
    }).join('');

    const treatsHtml = pendingTreats.map(t =>
      `<div class="garden-decor" style="left:${t.col * CELL_SIZE}px; top:${t.row * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px;"><div class="sprite-shadow"></div>${treatSVG()}</div>`
    ).join('');

    const saplingsHtml = placedDecorations.filter(d => d.source === 'sapling').map(d =>
      `<div class="garden-decor" style="left:${d.col * CELL_SIZE}px; top:${d.row * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px;" title="${isSaplingGrown(saplings.find(s => s.id === d.sourceId) || {}) ? 'Grown tree — chop it with the axe!' : `Sapling (watered ${(saplings.find(s => s.id === d.sourceId) || {}).waterCount || 0}/${SAPLING_WATERS_NEEDED})`}"><div class="sprite-shadow"></div>${d.svg}</div>`
    ).join('');

    const unplantedSaplingsHtml = saplings.filter(s => !s.planted && !(heldSapling && heldSapling.id === s.id)).map(s =>
      `<div class="garden-decor" style="left:${s.col * CELL_SIZE}px; top:${s.row * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px;" title="Sapling — carry it somewhere and press E to plant it"><div class="sprite-shadow"></div>${saplingSVG()}</div>`
    ).join('');

    const groundLogsHtml = groundLogs.map(l =>
      `<div class="garden-decor" style="left:${l.col * CELL_SIZE}px; top:${l.row * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px;" title="Log">${logSVG()}</div>`
    ).join('');

    const cabinsHtml = cabinSites.map(s =>
      `<div class="garden-decor" style="left:${s.col * CELL_SIZE}px; top:${s.row * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px;" title="${s.complete ? 'Cabin' : 'Cabin site: ' + s.logCount + '/' + CABIN_LOGS_NEEDED + ' logs'}"><div class="sprite-shadow"></div>${cabinSVG(s.logCount)}</div>`
    ).join('');

    const dugTilesHtml = [...dugTiles].map(key => {
      const [r, c] = key.split(':').map(Number);
      return `<div class="garden-surface" style="left:${c * CELL_SIZE}px; top:${r * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px; background:${surfaceBackground('bed')};" title="Tilled dirt"></div>`;
    }).join('');

    plot.innerHTML = bandsHtml + dugTilesHtml + cellsHtml + movablesHtml + saplingsHtml + unplantedSaplingsHtml + groundLogsHtml + cabinsHtml + treatsHtml + petsHtml + gateHtml;

    const heroEl = document.createElement('div');
    heroEl.className = 'garden-hero';
    heroEl.id = 'garden-hero';
    heroEl.style.width = CELL_SIZE + 'px';
    heroEl.style.height = CELL_SIZE + 'px';
    plot.appendChild(heroEl);

    heroPos.row = Math.min(heroPos.row, maxUnlockedRow);
    heroPos.col = Math.min(heroPos.col, GARDEN_COLS - 1);
    positionHero();

    renderSectionSideLabels(bandsToRender, unlockedCount);
    renderCoins();

    document.getElementById('garden-gardener').innerHTML = gardenerSVG('down', getEquippedOutfit());

    const plantWord = sorted.length === 1 ? 'plant' : 'plants';
    document.getElementById('garden-status').textContent =
      `${heroName()} is tending ${sorted.length} ${plantWord} in the garden.`;
  }


  /* ---------- Help topics (worded around the current account name) ---------- */

  function helpTopics() {
    const who = heroName();
    return {
      water: { icon: '\u{1F4A7}', title: 'Watering', body: 'Walk right up next to a plant to water it (once per minute per plant). Each watering earns a coin and plays a splash.' },
      pickup: { icon: '\u{270B}', title: 'Picking things up', body: 'Press E next to a plant, tool, log, or sapling to pick it up. Press E again to put it down somewhere empty \u2014 or use it, if it is a tool.' },
      axe: { icon: '\u{1FA93}', title: 'Axe', body: 'Buy an axe from the shop. While holding it, press E next to a tree or a grown sapling to chop it down into a log you can carry off.' },
      hoe: { icon: '\u{26CF}\u{FE0F}', title: 'Hoe', body: 'Buy a hoe from the shop. While holding it, press E to till the tile ' + who + ' is standing on into plantable dirt \u2014 no need to put the hoe down first.' },
      shovel: { icon: '\u{1FACF}', title: 'Shovel', body: 'Buy a shovel. While holding it, press E next to a bush \u2014 ' + who + ' drops the shovel and picks up the bush in one go, ready to carry elsewhere.' },
      sapling: { icon: '\u{1F331}', title: 'Saplings', body: 'Buy a sapling and it appears at the top of the garden. Carry it to an empty spot and press E to plant it. Walk into it to water it \u2014 it needs 5 waterings to grow into a tree, once per minute, just like regular plants. Press F to instantly grow every planted sapling.' },
      cabin: { icon: '\u{1FAB5}', title: 'Building a cabin', body: 'Carry a log onto a tile with another log to start a cabin site. Keep bringing logs and watch it rise in stages \u2014 foundation, then walls, then a roof, then doors and windows once it finishes at 10 logs.' },
      pets: { icon: '\u{1F43E}', title: 'Pets', body: 'Buy a pet, or unlock a random one (10 max). Buy treats to feed a pet \u2014 you will need to carry the food to it yourself. Friendly pets stick close, skittish ones flee until you win them over.' },
      unlock: { icon: '\u{1F512}', title: 'Unlocking sections', body: 'Every 10 completed tickets unlocks the next part of the garden. The next locked section is always visible ahead, dimmed, behind a gate.' }
    };
  }

  let currentHelpTopic = null;

  function showHelpTopic(key) {
    const topic = helpTopics()[key];
    if (!topic) return;
    const box = document.getElementById('help-explanation');
    if (!box) return;

    if (currentHelpTopic === key) {
      box.style.display = 'none';
      box.innerHTML = '';
      currentHelpTopic = null;
      return;
    }

    currentHelpTopic = key;
    box.innerHTML = '<strong>' + topic.icon + ' ' + Util.escapeHtml(topic.title) + '</strong><p>' + Util.escapeHtml(topic.body) + '</p>';
    box.style.display = 'block';
  }

  /* ---------- Lifecycle ---------- */

  /* Read every piece of garden state for the account that is currently
     loaded in Store, dropping anything held mid-air from a previous account. */
  function loadAll() {
    heldPlantId = null;
    heldPlantVariety = null;
    heldDecoration = null;
    heldTreat = null;
    heldLog = null;
    heldSapling = null;
    pendingTreats = [];
    placedDecorations = [];
    wateredCooldown.clear();
    currentHelpTopic = null;

    loadGardenLayout();
    loadHeroPos();
    loadMovableLayout();
    loadPurchasedItems();
    loadPets();
    loadCoins();
    loadOutfits();
    loadChoppedTrees();
    loadGroundLogs();
    loadCabinSites();
    loadSaplings();
    loadGardenVisibility();
    loadDugTiles();
  }

  function start() {
    loadAll();
    render();
    applyGardenVisibility();
    startPetTicker();
  }

  function render() {
    renderGarden();
  }

  function stop() {
    if (petTickTimer) clearInterval(petTickTimer);
    petTickTimer = null;
  }

  /* Inline handlers in generated markup call these by name. */
  window.buyItem = buyItem;
  window.buyPet = buyPet;
  window.buySapling = buySapling;
  window.buyTreat = buyTreat;
  window.unlockRandomPet = unlockRandomPet;
  window.resetGarden = resetGarden;
  window.showHelpTopic = showHelpTopic;
  window.handleGardenKeydown = handleGardenKeydown;
  window.focusGarden = focusGarden;
  window.toggleGardenVisibility = toggleGardenVisibility;

  return {
    start: start,
    stop: stop,
    render: render,
    loadAll: loadAll,
    heroName: heroName,
    renderCoins: renderCoins,
    renderShop: renderShop
  };
})();
