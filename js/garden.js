/* ============================================================================
   Tend - garden.js
   The reward garden. Every completed task becomes a plant; every ten
   completed tasks unlocks another section of the garden. Watering, chopping,
   building and pets all earn coins that can be spent in the shop.

   All persistence goes through Store.kv, which namespaces keys per account,
   so each account tends its own garden.
   ============================================================================ */

const Garden = (function () {
  'use strict';

  const NEUTRAL_POT = '#8a8f98';

  /* The active skin. Everything visual comes through here, so switching world
     is a preference change and a re-render - no data moves. */
  function W() {
    const prefs = Store.prefs() || {};
    return Worlds.get(prefs.world || Worlds.DEFAULT_WORLD);
  }

  function heroGender() {
    const prefs = Store.prefs() || {};
    return prefs.hero === 'female' ? 'female' : 'male';
  }

  function terms() {
    return W().terms;
  }

  function cap(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  /* The gardener sprite is named after whoever is signed in. */
  function heroName() {
    const n = (Store.displayName() || '').trim();
    if (!n) return 'Your gardener';
    return n.split(/\s+/)[0];
  }

  const GARDEN_LAYOUT_KEY = 'garden-layout-v5';
  const HERO_POS_KEY = 'garden-hero-v5';
  const GARDEN_COLS = 8;
  const CELL_SIZE = Worlds.TILE;
  const SECTION_ROWS = 8;
  /* New ground is bought, not earned. It used to unlock every ten completed
     tasks, which meant the only way to get more room was to do more work -
     coins are the currency for everything else, so they buy this too. */
  const SECTION_COST = 10;
  const WATER_COOLDOWN_MS = 60000;
  const SECTIONS_SHOWN_AHEAD = 1;







  function sectionInfo(i) {
    if (W().sections[i]) return W().sections[i];
    /* Past the named sections the themes repeat. THEME_ORDER itself lives in
       worlds.js, so the length has to come from the world, not from a name
       this file cannot see - which used to throw the moment anyone unlocked a
       ninth section. */
    const order = W().themeOrder;
    return { name: `Garden Plot ${i + 1}`, icon: '\u{1FAB4}', theme: order[i % order.length] };
  }

  function checkerBackground(theme) {
    const [c1, c2] = W().themeColors[theme];
    const size = CELL_SIZE * 2;
    return `background-image: linear-gradient(45deg, ${c1} 25%, transparent 25%, transparent 75%, ${c1} 75%, ${c1}), linear-gradient(45deg, ${c1} 25%, ${c2} 25%, ${c2} 75%, ${c1} 75%, ${c1}); background-size: ${size}px ${size}px; background-position: 0 0, ${CELL_SIZE}px ${CELL_SIZE}px;`;
  }



  /* Null until the first render, which is where an older garden is given the
     sections it had already earned so nothing it contains is walled off. */
  let sectionsBought = null;

  function loadSections(completedCount) {
    const raw = Store.kv.getItem(SECTIONS_KEY);
    if (raw === null || raw === undefined || raw === '') {
      sectionsBought = Math.floor((completedCount || 0) / 10);
      Store.kv.setItem(SECTIONS_KEY, String(sectionsBought));
      return;
    }
    const n = parseInt(raw, 10);
    sectionsBought = Number.isFinite(n) && n > 0 ? n : 0;
  }

  function saveSections() {
    Store.kv.setItem(SECTIONS_KEY, String(sectionsBought || 0));
  }

  function unlockedSectionCount() {
    return (sectionsBought || 0) + 1;
  }

  function buySection() {
    if (coins < SECTION_COST) return;
    coins -= SECTION_COST;
    sectionsBought = (sectionsBought || 0) + 1;
    saveCoins();
    saveSections();
    renderCoins();
    renderGarden();
    showThought('More room to plant');
  }











































  const PLANT_COST = 1;
  const SAPLING_COST = 5;
  const SAPLING_WATERS_NEEDED = 5;
  /* Everything you buy from the plant shop starts as a seedling and only
     becomes its own variety once it has been planted in the ground and
     watered. In a pot it stays a seedling however often you water it. */
  const PLANT_WATERS_NEEDED = 5;
  const CABIN_LOGS_NEEDED = 10;

  const MAX_PETS = 10;
  const UNLOCK_PET_COST = 50;
  const RESET_PURCHASES_COST = 100;



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
    return W().outfits[equippedOutfit] || W().outfits.classic;
  }

  function buyOutfit(id) {
    const def = W().outfits[id];
    if (!def || ownedOutfits.includes(id) || coins < def.cost) return;
    coins -= def.cost;
    saveCoins();
    ownedOutfits.push(id);
    equippedOutfit = id;
    saveOutfits();
    renderCoins();
    positionHero();
    document.getElementById('garden-gardener').innerHTML = heroSVG('down', getEquippedOutfit());
  }

  function equipOutfit(id) {
    if (!ownedOutfits.includes(id)) return;
    equippedOutfit = id;
    saveOutfits();
    positionHero();
    document.getElementById('garden-gardener').innerHTML = heroSVG('down', getEquippedOutfit());
    renderShop();
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
        if (rowStr[c] === '#') list.push({ row: r, col: c, width: 1, height: 1, blocking: true, art: 'hedge' });
      }
    });
    return list;
  }

  const DECORATIONS_BY_THEME = {
    grass: [
      { row: 0, col: 2, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree1', art: 'tree' },
      { row: 0, col: 5, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree2', art: 'tree' },
      { row: 2, col: 3, width: 2, height: 1, blocking: true, art: 'washingLine' },
      { row: 6, col: 3, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'shovel', id: 'bush1', art: 'bush' },
      { row: 7, col: 5, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'shovel', id: 'bush2', art: 'bush' },
      { row: 1, col: 0, width: 2, height: 5, blocking: false, kind: 'bed' },
      { row: 1, col: 6, width: 2, height: 5, blocking: false, kind: 'bed' },
      { row: 6, col: 5, width: 1, height: 1, blocking: true, movable: true, id: 'mower', art: 'mower' },
      { row: 7, col: 2, width: 1, height: 1, blocking: true, movable: true, id: 'wheelbarrow', art: 'wheelbarrow' }
    ],
    glass: [
      { row: 1, col: 0, width: 4, height: 1, blocking: false, kind: 'bed' },
      { row: 1, col: 4, width: 4, height: 1, blocking: false, kind: 'bed' },
      { row: 5, col: 0, width: 4, height: 1, blocking: false, kind: 'bed' },
      { row: 5, col: 4, width: 4, height: 1, blocking: false, kind: 'bed' }
    ],
    wood: [
      { row: 1, col: 2, width: 1, height: 1, blocking: true, art: 'table' },
      { row: 1, col: 5, width: 1, height: 1, blocking: true, art: 'table' },
      { row: 6, col: 0, width: 8, height: 2, blocking: false, kind: 'porch' }
    ],
    patio: [
      { row: 0, col: 3, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree1', art: 'tree' },
      { row: 2, col: 6, width: 1, height: 1, blocking: true, art: 'table' },
      { row: 6, col: 6, width: 1, height: 1, blocking: true, art: 'grill' },
      { row: 3, col: 2, width: 4, height: 4, blocking: false, kind: 'sand' }
    ],
    maze: mazeDecorations(),
    water: [
      { row: 2, col: 0, width: 2, height: 4, blocking: false, kind: 'dock' },
      { row: 1, col: 3, width: 1, height: 1, blocking: true, art: 'lilyPad' },
      { row: 1, col: 5, width: 1, height: 1, blocking: true, art: 'lilyPad' },
      { row: 3, col: 3, width: 1, height: 1, blocking: true, art: 'lilyPad' },
      { row: 3, col: 6, width: 1, height: 1, blocking: true, art: 'lilyPad' },
      { row: 5, col: 2, width: 1, height: 1, blocking: true, art: 'lilyPad' },
      { row: 5, col: 5, width: 1, height: 1, blocking: true, art: 'lilyPad' },
      { row: 6, col: 4, width: 1, height: 1, blocking: true, art: 'lilyPad' },
      { row: 2, col: 7, width: 1, height: 1, blocking: true, art: 'lilyPad' }
    ],
    soil: [
      { row: 1, col: 0, width: 4, height: 1, blocking: false, kind: 'bed' },
      { row: 1, col: 4, width: 4, height: 1, blocking: false, kind: 'bed' },
      { row: 4, col: 0, width: 4, height: 1, blocking: false, kind: 'bed' },
      { row: 4, col: 4, width: 4, height: 1, blocking: false, kind: 'bed' }
    ],
    orchard: [
      { row: 0, col: 1, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree1', art: 'fruitTree' },
      { row: 0, col: 4, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree2', art: 'fruitTree' },
      { row: 4, col: 7, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree3', art: 'fruitTree' },
      { row: 3, col: 0, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree4', art: 'fruitTree' },
      { row: 3, col: 3, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree5', art: 'fruitTree' },
      { row: 3, col: 6, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree6', art: 'fruitTree' },
      { row: 6, col: 1, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree7', art: 'fruitTree' },
      { row: 6, col: 5, width: 1, height: 1, blocking: true, choppable: true, toolRequired: 'axe', id: 'tree8', art: 'fruitTree' },
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
  const SECTIONS_KEY = 'garden-sections-v1';
  const DUG_TILES_KEY = 'garden-dug-v1';
  const COINS_AWARDED_KEY = 'coins-awarded-v1';
  const LENS_KEY = 'garden-lens-v1';
  const LENS_ON_KEY = 'garden-lens-on-v1';
  const LENS_COST = 4;

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
  let hasLens = false;
  let lensOn = true;
  let lensLastKey = '';
  let lensTimer = null;
  let activeThought = null;

  /* One coin per completed task, paid once. The ledger of task ids that
     have already paid out lives alongside the coin count, so ticking a task
     off and on again cannot mint coins. */
  let awardedCoins = new Set();
  let stateLoaded = false;

  function loadAwardedCoins() {
    try {
      awardedCoins = new Set(JSON.parse(Store.kv.getItem(COINS_AWARDED_KEY)) || []);
    } catch (e) {
      awardedCoins = new Set();
    }
  }

  function saveAwardedCoins() {
    Store.kv.setItem(COINS_AWARDED_KEY, JSON.stringify([...awardedCoins]));
  }

  /* Reconciles coins against the task list. Idempotent, so it is safe to run
     on every render - which is also what makes it work across devices and after
     an import. Un-completing a task takes its coin back; deleting a task
     outright does not, since that work was still done. */
  function syncCompletionCoins() {
    const tickets = App.tickets();
    const completedIds = new Set(tickets.filter(t => t.completedAt).map(t => t.id));
    const existingIds = new Set(tickets.map(t => t.id));

    let delta = 0;
    let changed = false;

    completedIds.forEach(id => {
      if (!awardedCoins.has(id)) {
        awardedCoins.add(id);
        delta += 1;
        changed = true;
      }
    });

    [...awardedCoins].forEach(id => {
      if (completedIds.has(id)) return;
      awardedCoins.delete(id);
      changed = true;
      if (existingIds.has(id)) delta -= 1;
    });

    if (changed) saveAwardedCoins();
    if (delta !== 0) addCoins(delta);
  }

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
      sectionsBought = 0;
    saveSections();
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
    coins = Math.max(0, coins + n);
    saveCoins();
    renderCoins();
    if (n > 0) {
      bumpCoinDisplay(n);
    }
  }
  /* Gold, with Tend's own sprout struck into it, rather than the platform's
     silver coin emoji. One definition, used by the counter, the shop prices
     and the little float when you earn one. */
  const COIN_SVG =
    '<svg class="coin-icon" viewBox="0 0 24 24" role="img" aria-label="coin">' +
      '<defs>' +
        '<linearGradient id="tend-coin-face" x1="0" y1="0" x2="0.4" y2="1">' +
          '<stop offset="0" stop-color="#ffe9a3"/>' +
          '<stop offset="0.45" stop-color="#f5c542"/>' +
          '<stop offset="1" stop-color="#d99a17"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<circle cx="12" cy="12" r="11" fill="#b87b0d"/>' +
      '<circle cx="12" cy="12" r="9.6" fill="url(#tend-coin-face)"/>' +
      '<circle cx="12" cy="12" r="7.9" fill="none" stroke="#e0ab24" stroke-width="0.8" opacity="0.75"/>' +
      /* the mark from the logo, struck in relief */
      '<g fill="none" stroke="#8a5a08" stroke-width="1.5" stroke-linecap="round">' +
        '<path d="M12 17.4 V11.2"/>' +
      '</g>' +
      '<path d="M12 11.6 C12 8.4 9.7 6.6 6.8 6.6 C6.8 9.8 9.1 11.6 12 11.6 Z" fill="#8a5a08"/>' +
      '<path d="M12 12.9 C12 10 14.3 8.2 17.2 8.2 C17.2 11.1 14.9 12.9 12 12.9 Z" fill="#8a5a08" opacity="0.72"/>' +
      '<ellipse cx="8.6" cy="7.6" rx="2.4" ry="1.5" fill="#fff6d6" opacity="0.45" transform="rotate(-35 8.6 7.6)"/>' +
    '</svg>';

  /* Each copy needs its own gradient id or later ones can render blank. */
  let coinIdSeq = 0;
  function coinSVG() {
    const id = 'tend-coin-face-' + (++coinIdSeq);
    return COIN_SVG.split('tend-coin-face').join(id);
  }

  function renderCoins() {
    const el = document.getElementById('garden-coins');
    if (el) el.innerHTML = `${coinSVG()} <span class="coin-count">${coins}</span>`;
    const shopIcon = document.getElementById('shop-coins-icon');
    if (shopIcon) shopIcon.innerHTML = coinSVG();
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
  let heldPlantGrown = true;
  let heldPlantWaters = 0;
  let heldPlantVariety = null;
  let heldPlantPot = null;
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







  function heroSVG(direction, outfit) {
    return Worlds.heroSVG(W().id, heroGender(), direction, outfit || getEquippedOutfit());
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





  /* Plants are bought, not derived from a task, so their pot colour is their
     own. Legacy plants (grown automatically before plants were purchasable)
     have no stored colour, so one is derived from their id instead. */
  const POT_COLORS = ['#c56a4e', '#8a8f98', '#4a7fb5', '#5c9e6b', '#b58a3c', '#8e6bb0', '#c26a8a', '#4f8f8a'];

  function potColorFor(id) {
    return POT_COLORS[hashStr(String(id)) % POT_COLORS.length];
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

  /* ------------------------------------------------------------------ */
  /* Touch controls                                                     */
  /* A phone has no arrow keys, so: tap a square and the hero walks to  */
  /* it; swipe to nudge one step; tap the hero to do what E does.       */
  /* ------------------------------------------------------------------ */

  const SWIPE_MIN = 24;          /* px before a drag counts as a swipe */
  const TAP_SLOP = 12;           /* px of wobble still counted as a tap */
  const WALK_STEP_MS = 110;      /* pace of an auto-walk */
  const WALK_MAX_STEPS = 40;     /* never wander forever */

  let touchStart = null;
  let walkTimer = null;

  function isTouchDevice() {
    return typeof window !== 'undefined' &&
      (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0);
  }

  function stopWalking() {
    if (walkTimer) { clearInterval(walkTimer); walkTimer = null; }
  }

  /* Walk towards a square one step at a time, closing the bigger gap first.
     If a step is blocked it tries the other axis; if both are blocked it
     stops, having already watered or bumped whatever was in the way. */
  function walkTo(row, col) {
    stopWalking();
    let steps = 0;
    walkTimer = setInterval(() => {
      steps++;
      const dRow = row - heroPos.row;
      const dCol = col - heroPos.col;
      if ((dRow === 0 && dCol === 0) || steps > WALK_MAX_STEPS) { stopWalking(); return; }

      const rowFirst = Math.abs(dRow) >= Math.abs(dCol);
      const primary = rowFirst ? [Math.sign(dRow), 0] : [0, Math.sign(dCol)];
      const secondary = rowFirst ? [0, Math.sign(dCol)] : [Math.sign(dRow), 0];

      let moved = false;
      if (primary[0] || primary[1]) moved = stepHero(primary[0], primary[1]);
      if (!moved && (secondary[0] || secondary[1])) moved = stepHero(secondary[0], secondary[1]);
      if (!moved) stopWalking();
    }, WALK_STEP_MS);
  }

  function cellFromPoint(clientX, clientY) {
    const plot = document.getElementById('garden-plot');
    if (!plot) return null;
    const box = plot.getBoundingClientRect();
    const col = Math.floor((clientX - box.left) / CELL_SIZE);
    const row = Math.floor((clientY - box.top) / CELL_SIZE);
    if (col < 0 || col >= GARDEN_COLS || row < 0 || row > gardenMaxUnlockedRow) return null;
    return { row, col };
  }

  function handleGardenTouchStart(event) {
    stopWalking();
    const t = event.changedTouches && event.changedTouches[0];
    if (!t) return;
    touchStart = { x: t.clientX, y: t.clientY, at: Date.now() };
  }

  function handleGardenTouchEnd(event) {
    const t = event.changedTouches && event.changedTouches[0];
    if (!t || !touchStart) { touchStart = null; return; }
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const start = touchStart;
    touchStart = null;

    /* A definite drag is a swipe: one step whichever way it leaned. */
    if (Math.abs(dx) > SWIPE_MIN || Math.abs(dy) > SWIPE_MIN) {
      event.preventDefault();
      if (Math.abs(dx) > Math.abs(dy)) stepHero(0, dx > 0 ? 1 : -1);
      else stepHero(dy > 0 ? 1 : -1, 0);
      return;
    }

    if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) return;

    const cell = cellFromPoint(start.x, start.y);
    if (!cell) return;
    event.preventDefault();

    /* Tapping yourself is the E key: pick up, plant, use. */
    if (cell.row === heroPos.row && cell.col === heroPos.col) {
      togglePickup();
      return;
    }
    walkTo(cell.row, cell.col);
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
    /* Installed as an app the garden is a tab of its own, so which of the
       three is on screen is the view's business, not this switch's. */
    const phoneView = window.App && App.isAppMode && App.isAppMode();
    if (col) col.style.display = (phoneView || gardenVisible) ? '' : 'none';
    /* The layout grid keeps a 420px track for the garden, so tell it when there
       is no garden to put there. */
    const layout = document.querySelector('.app-layout');
    if (layout) layout.classList.toggle('no-garden', !gardenVisible);
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
      if (!heldPlantGrown) return seedlingSVG(false);
      const variety = W().plants[heldPlantVariety] || W().plants[0];
      return W().plantSVG(variety, heldPlantPot || NEUTRAL_POT);
    }
    if (heldDecoration) return heldDecoration.svg;
    if (heldTreat) return W().art.treat();
    if (heldLog) return W().art.log();
    if (heldSapling) return W().art.sapling();
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
      /* The bubble lives inside the hero so it travels with them, which means
         it has to be redrawn whenever the hero is. */
      const thought = activeThought
        ? `<div class="garden-thought">${Util.escapeHtml(activeThought)}</div>` : '';
      heroEl.innerHTML = `${thought}${heldWrap}<div class="sprite-shadow"></div>${heroSVG(heroDirection, getEquippedOutfit())}`;
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

  /* Anything planted before seedlings existed has no `grown` field at all, and
     is a full plant - so only an explicit false counts as a seedling. */
  function isSeedling(pos) {
    return !!pos && pos.grown === false;
  }

  /* Every seedling looks the same, whatever it will turn into. Sitting in a
     pot it keeps the pot; in the ground the pot comes off. */
  function seedlingSVG(planted) {
    /* One neutral pot for every seedling: until it has grown they are all
       meant to look identical, so the plant's own pot colour waits. */
    const pot = planted ? '' : `
      <rect x="2" y="15" width="10" height="1" fill="${NEUTRAL_POT}"/>
      <rect x="3" y="16" width="8" height="3" fill="${NEUTRAL_POT}"/>
      <rect x="4" y="18" width="6" height="1" fill="rgba(0,0,0,0.18)"/>`;
    return `<svg width="24" height="34" viewBox="0 0 14 20" shape-rendering="crispEdges">
      ${W().art.seedling()}
      ${pot}
    </svg>`;
  }

  function seedlingLabel(pos) {
    const n = pos.waterCount || 0;
    const onDirt = isOnDirt(pos.row, pos.col);
    if (!onDirt) return 'Seedling - plant it in the ground';
    return 'Seedling - watered ' + n + ' of ' + PLANT_WATERS_NEEDED;
  }

  function waterCheck(row, col, knownTaskId) {
    const taskId = knownTaskId || findPlantAt(row, col);
    if (!taskId) return;
    const last = wateredCooldown.get(taskId) || 0;
    if (Date.now() - last < WATER_COOLDOWN_MS) return;
    wateredCooldown.set(taskId, Date.now());
    spawnSparkleAt(row, col);
    playWaterSound();

    const pos = gardenLayout[taskId];
    if (!isSeedling(pos)) return;

    /* Water goes straight through a pot. Roots need the ground. */
    if (!isOnDirt(row, col)) {
      showThought('Needs planting in the ground');
      return;
    }

    pos.waterCount = (pos.waterCount || 0) + 1;
    if (pos.waterCount >= PLANT_WATERS_NEEDED) {
      pos.grown = true;
      const variety = W().plants[pos.variety] || W().plants[0];
      spawnSparkleAt(row, col);
      showThought(variety.name + '!');
    }
    saveGardenLayout();
    renderGarden();
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
    /* Whichever companion you reach first gets it. If two are equally close,
       the one with the least friendship is the one that needs it most. */
    const near = ownedPets
      .filter(p => Math.abs(p.row - heroPos.row) + Math.abs(p.col - heroPos.col) <= 1)
      .sort((a, b) => a.friendship - b.friendship);
    const pet = near[0];
    if (!pet) return;
    const def = W().food;
    pet.friendship = Math.min(100, pet.friendship + ((def && def.gain) || 18));
    savePets();
    spawnHeartsAt(pet.row, pet.col);
    heldTreat = null;
    renderGarden();
  }

  function handleGardenKeydown(event) {
    const key = event.key.toLowerCase();

    if (key === 'e') {
      event.preventDefault();
      togglePickup();
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
    stepHero(dr, dc);
  }

  /* One step in a direction, with everything that a step can mean: watering
     what you walk into, bumping off scenery, greeting a pet. Shared by the
     keyboard and by the touch controls. Returns true if the hero actually
     changed square. */
  function stepHero(dr, dc) {
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
      return false;
    }

    const plantId = findPlantAt(targetRow, targetCol);
    if (plantId) {
      waterCheck(targetRow, targetCol, plantId);
      saveHeroPos();
      positionHero();
      lensLook(targetRow, targetCol);
      return false;
    }

    const saplingHere = saplings.find(s => s.planted && s.row === targetRow && s.col === targetCol);
    if (saplingHere && !isSaplingGrown(saplingHere)) {
      waterSaplingCheck(targetRow, targetCol, saplingHere);
      saveHeroPos();
      positionHero();
      lensLook(targetRow, targetCol);
      return false;
    }

    if (findDecorationAt(targetRow, targetCol)) {
      saveHeroPos();
      positionHero();
      lensLook(targetRow, targetCol);
      return false;
    }

    if (cabinSites.some(s => s.complete && s.row === targetRow && s.col === targetCol)) {
      saveHeroPos();
      positionHero();
      lensLook(targetRow, targetCol);
      return false;
    }

    heroPos = { row: targetRow, col: targetCol };
    saveHeroPos();
    positionHero();
    playStepSound(W().stepSound[sectionInfo(Math.floor(targetRow / SECTION_ROWS)).theme] || 'grass');
    reactPetsToHero();
    checkTreatDelivery();
    checkAnimalSounds();
    lensLook();
    return true;
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
      gardenLayout[heldPlantId] = {
        row: heroPos.row, col: heroPos.col,
        variety: heldPlantVariety, potColor: heldPlantPot,
        grown: heldPlantGrown, waterCount: heldPlantWaters
      };
      heldPlantId = null;
      heldPlantVariety = null;
      heldPlantPot = null;
      heldPlantGrown = true;
      heldPlantWaters = 0;
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
      heldPlantPot = gardenLayout[taskId].potColor || potColorFor(taskId);
      heldPlantGrown = !isSeedling(gardenLayout[taskId]);
      heldPlantWaters = gardenLayout[taskId].waterCount || 0;
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
      heldTreat = { id: treat.id };
      pendingTreats = pendingTreats.filter(t => t.id !== treat.id);
      playPickupSound();
      renderGarden();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Magnifying glass                                                     */
  /* Bought once and kept. With it, standing next to anything names that  */
  /* thing in a thought bubble over your head for a moment - which is why */
  /* there is no longer a list of plant names down the side of the plot.  */
  /* ------------------------------------------------------------------ */

  function loadLens() {
    hasLens = Store.kv.getItem(LENS_KEY) === '1';
    /* On by default once bought, but the switch is remembered. */
    lensOn = Store.kv.getItem(LENS_ON_KEY) !== '0';
  }

  function saveLens() {
    Store.kv.setItem(LENS_KEY, hasLens ? '1' : '0');
    Store.kv.setItem(LENS_ON_KEY, lensOn ? '1' : '0');
  }

  function buyLens() {
    if (hasLens || coins < LENS_COST) return;
    coins -= LENS_COST;
    hasLens = true;
    lensOn = true;
    saveCoins();
    saveLens();
    renderCoins();
    renderShop();
    showThought('You can name things now');
  }

  /* Bought once, but not everybody wants a bubble over their head all the
     time - so it has a switch, and turning it off does not lose the purchase. */
  function toggleLens() {
    if (!hasLens) return;
    lensOn = !lensOn;
    lensLastKey = '';
    if (!lensOn) {
      activeThought = null;
      if (lensTimer) { clearTimeout(lensTimer); lensTimer = null; }
      positionHero();
    }
    saveLens();
    renderShop();
    if (lensOn) showThought('Naming things again');
  }

  function decorName(key) {
    const names = W().decorNames || {};
    return names[key] || null;
  }

  /* What is standing on this square, in plain words - or null if nothing is. */
  function describeAt(row, col) {
    const plantId = findPlantAt(row, col);
    if (plantId) {
      const pos = gardenLayout[plantId];
      if (isSeedling(pos)) return seedlingLabel(pos);
      const variety = W().plants[pos.variety] || W().plants[0];
      return variety.name;
    }

    const pet = ownedPets.find(p => p.row === row && p.col === col);
    if (pet) {
      const def = W().pets[pet.type];
      return def ? def.label : null;
    }

    const sapling = saplings.find(x => x.planted && x.row === row && x.col === col);
    if (sapling) return decorName(isSaplingGrown(sapling) ? 'tree' : 'sapling');

    const log = groundLogs.find(l => l.row === row && l.col === col);
    if (log) return decorName('log');

    const cabin = cabinSites.find(c => c.row === row && c.col === col);
    if (cabin) return decorName('cabin');

    const food = pendingTreats.find(t => t.row === row && t.col === col);
    if (food) return W().food.label;

    const item = purchasedItems.find(it => it.row === row && it.col === col);
    if (item) {
      const def = W().items[item.kind];
      if (def) return def.label;
    }

    const decor = placedDecorations.find(d =>
      row >= d.row && row < d.row + d.height &&
      col >= d.col && col < d.col + d.width);
    if (decor) {
      if (decor.kind && W().items[decor.kind]) return W().items[decor.kind].label;
      return decorName(decor.art || decor.kind);
    }

    return null;
  }

  /* The square in front plus the four around it - whatever you have walked up
     to. The nearest thing wins, and the same thing does not announce itself
     twice in a row. */
  function lensLook(facingRow, facingCol) {
    if (!hasLens || !lensOn) return;
    const cells = [];
    if (Number.isFinite(facingRow) && Number.isFinite(facingCol)) cells.push([facingRow, facingCol]);
    [[-1, 0], [0, 1], [1, 0], [0, -1]].forEach(([dr, dc]) =>
      cells.push([heroPos.row + dr, heroPos.col + dc]));

    for (const [r, c] of cells) {
      const name = describeAt(r, c);
      if (name) {
        const key = r + ':' + c + ':' + name;
        if (key === lensLastKey) return;
        lensLastKey = key;
        showThought(name);
        return;
      }
    }
    lensLastKey = '';
  }

  function showThought(text) {
    if (!text) return;
    activeThought = text;
    positionHero();
    if (lensTimer) clearTimeout(lensTimer);
    lensTimer = setTimeout(() => {
      activeThought = null;
      lensTimer = null;
      positionHero();
    }, 1500);
  }

  function findFreeCellNearHero(avoidDirt) {
    for (let radius = 0; radius < GARDEN_COLS + SECTION_ROWS; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r = heroPos.row + dr, c = heroPos.col + dc;
          if (r < 0 || r > gardenMaxUnlockedRow || c < 0 || c >= GARDEN_COLS) continue;
          if (findPlantAt(r, c) || findDecorationAt(r, c)) continue;
          if (ownedPets.some(p => p.row === r && p.col === c)) continue;
          if (r === heroPos.row && c === heroPos.col) continue;
          if (avoidDirt && isOnDirt(r, c)) continue;
          return { row: r, col: c };
        }
      }
    }
    return null;
  }

  /* Somewhere a new seedling can stand in its pot: never a bed or dug soil,
     because arriving already planted would skip the part where you carry it
     over and choose where it goes. Near you if there is room, otherwise the
     first free spot from the top. */
  function findPottingSpot() {
    const near = findFreeCellNearHero(true);
    if (near) return near;
    for (let r = 0; r <= gardenMaxUnlockedRow; r++) {
      for (let c = 0; c < GARDEN_COLS; c++) {
        if (isOnDirt(r, c)) continue;
        if (findPlantAt(r, c) || findDecorationAt(r, c)) continue;
        if (findGroundLogAt(r, c)) continue;
        if (saplings.some(s => s.row === r && s.col === c)) continue;
        if (ownedPets.some(p => p.row === r && p.col === c)) continue;
        return { row: r, col: c };
      }
    }
    /* A garden with no bare ground left at all - the top row will have to do. */
    return findFreeCellAtTop();
  }

  function buyPet(type) {
    const def = W().pets[type];
    if (!def || coins < def.cost || ownedPets.length >= MAX_PETS) return;
    coins -= def.cost;
    saveCoins();
    const cell = findFreeCellNearHero() || { row: heroPos.row, col: heroPos.col };
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
    const types = Object.keys(W().pets);
    const type = types[Math.floor(Math.random() * types.length)];
    const cell = findFreeCellNearHero() || { row: heroPos.row, col: heroPos.col };
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
    const def = W().items[kind];
    if (!def || coins < def.cost) return;
    coins -= def.cost;
    saveCoins();
    const cell = findFreeCellNearHero() || { row: heroPos.row, col: heroPos.col };
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

  /* A plant is now something you buy with a coin you earned by finishing a
     task, rather than something that appears on its own. It arrives as a
     seedling: every one looks the same until it has grown, and which variety
     it turns out to be is a surprise kept until then. */
  function buyPlant() {
    if (coins < PLANT_COST) return;
    coins -= PLANT_COST;
    saveCoins();
    const cell = findPottingSpot();
    const id = 'plant-' + hashStr('plant' + Object.keys(gardenLayout).length + Date.now() + Math.random());
    gardenLayout[id] = {
      row: cell.row,
      col: cell.col,
      variety: Math.floor(Math.random() * W().plants.length),
      potColor: POT_COLORS[Math.floor(Math.random() * POT_COLORS.length)],
      grown: false,
      waterCount: 0
    };
    saveGardenLayout();
    playPickupSound();
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
    heldPlantPot = null;

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
    document.getElementById('garden-gardener').innerHTML = heroSVG('down', getEquippedOutfit());
    positionHero();
    renderGarden();
  }

  /* One bowl of food, good for any companion. It lands beside you; pick it up
     and walk it over to whichever animal you want to win over. */
  function buyFood() {
    const def = W().food;
    if (!ownedPets.length || !def || coins < def.cost) return;
    coins -= def.cost;
    saveCoins();
    const cell = findFreeCellNearHero() || { row: heroPos.row, col: heroPos.col };
    pendingTreats.push({
      id: 'food-' + hashStr(pendingTreats.length + '' + Math.random()),
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
      const tiles = Object.entries(W().pets).map(([type, def]) => `
        <button class="shop-tile" ${(coins < def.cost || capped) ? 'disabled' : ''} onclick="buyPet('${type}')">
          <span class="shop-tile-icon">${def.icon}</span>
          <span class="shop-tile-label">${Util.escapeHtml(def.label)}</span>
          <span class="shop-tile-action">${coinSVG()}${def.cost}</span>
        </button>`).join('') +
        `<button class="shop-tile" ${(coins < UNLOCK_PET_COST || capped) ? 'disabled' : ''} onclick="unlockRandomPet()">
          <span class="shop-tile-icon">\u{2728}</span>
          <span class="shop-tile-label">Mystery pet</span>
          <span class="shop-tile-action">${coinSVG()}${UNLOCK_PET_COST}</span>
        </button>`;
      petsWrap.innerHTML = `<div class="shop-info">Pets: ${ownedPets.length}/${MAX_PETS}</div><div class="shop-grid">${tiles}</div>`;
    }

    const plantsWrap = document.getElementById('shop-plants');
    if (plantsWrap) {
      const all = Object.values(gardenLayout);
      const growing = all.filter(isSeedling).length;
      const grown = all.length - growing;
      const tally = grown + ' ' + (grown === 1 ? terms().plant : terms().plants)
        + (growing ? ', ' + growing + ' still growing' : '');
      plantsWrap.innerHTML =
        `<div class="shop-info">Growing: ${Util.escapeHtml(tally)}</div>
         <div class="shop-grid">
           <button class="shop-tile" ${coins < PLANT_COST ? 'disabled' : ''} onclick="buyPlant()">
             <span class="shop-tile-icon">\u{1F331}</span>
             <span class="shop-tile-label">Seedling</span>
             <span class="shop-tile-action">${coinSVG()}${PLANT_COST}</span>
           </button>
         </div>`;
    }

    const itemsWrap = document.getElementById('shop-items');
    if (itemsWrap) {
      const tiles = Object.entries(W().items).map(([kind, def]) => `
        <button class="shop-tile" ${coins < def.cost ? 'disabled' : ''} onclick="buyItem('${kind}')">
          <span class="shop-tile-icon">${def.icon}</span>
          <span class="shop-tile-label">${Util.escapeHtml(def.label)}</span>
          <span class="shop-tile-action">${coinSVG()}${def.cost}</span>
        </button>`).join('') +
        `<button class="shop-tile" ${coins < SAPLING_COST ? 'disabled' : ''} onclick="buySapling()">
          <span class="shop-tile-icon">\u{1F331}</span>
          <span class="shop-tile-label">${Util.escapeHtml(cap(terms().sprout))} (water 5x to grow)</span>
          <span class="shop-tile-action">${coinSVG()}${SAPLING_COST}</span>
        </button>` +
        (hasLens
          ? `<button class="shop-tile owned" onclick="toggleLens()"
               title="${lensOn ? 'Tap to stop naming things' : 'Tap to name things again'}">
              <span class="shop-tile-icon">\u{1F50D}</span>
              <span class="shop-tile-label">Magnifying glass</span>
              <span class="shop-tile-action ${lensOn ? 'on' : 'off'}">Naming: ${lensOn ? 'on' : 'off'}</span>
            </button>`
          : `<button class="shop-tile" ${coins < LENS_COST ? 'disabled' : ''} onclick="buyLens()"
               title="Walk up to anything and it tells you what it is">
              <span class="shop-tile-icon">\u{1F50D}</span>
              <span class="shop-tile-label">Magnifying glass (names things)</span>
              <span class="shop-tile-action">${coinSVG()}${LENS_COST}</span>
            </button>`) +
        `<button class="shop-tile" ${coins < RESET_PURCHASES_COST ? 'disabled' : ''} onclick="resetGarden()">
          <span class="shop-tile-icon">\u{267B}</span>
          <span class="shop-tile-label">Reset ${Util.escapeHtml(terms().place)}</span>
          <span class="shop-tile-action">${coinSVG()}${RESET_PURCHASES_COST}</span>
        </button>`;
      itemsWrap.innerHTML = `<div class="shop-grid">${tiles}</div>`;
    }

    const treatsWrap = document.getElementById('shop-treats');
    if (treatsWrap) {
      if (!ownedPets.length) {
        treatsWrap.innerHTML = `<div class="shop-empty">Buy a companion to unlock ${Util.escapeHtml(W().food.label.toLowerCase())}.</div>`;
      } else {
        const def = W().food;
        const tile = `<button class="shop-tile" ${coins < def.cost ? 'disabled' : ''} onclick="buyFood()">
            <span class="shop-tile-icon">${def.icon}</span>
            <span class="shop-tile-label">${Util.escapeHtml(def.label)}</span>
            <span class="shop-tile-action">${coinSVG()}${def.cost}</span>
          </button>`;
        /* Who still needs winning over, so the one food tile is enough. */
        const roster = ownedPets.map(p => {
          const petDef = W().pets[p.type];
          return `<li><span>${petDef.icon} ${Util.escapeHtml(petDef.label)}</span><span>${p.friendship}%</span></li>`;
        }).join('');
        treatsWrap.innerHTML = `<div class="shop-grid">${tile}</div>
          <ul class="pet-roster">${roster}</ul>`;
      }
    }

    const outfitsWrap = document.getElementById('shop-outfits');
    if (outfitsWrap) {
      const tiles = Object.entries(W().outfits).map(([id, def]) => {
        const owned = ownedOutfits.includes(id);
        const equipped = equippedOutfit === id;
        let action, onclick, disabled, cls = '';
        if (equipped) {
          action = 'Equipped'; onclick = ''; disabled = true; cls = ' equipped';
        } else if (owned) {
          action = 'Equip'; onclick = `equipOutfit('${id}')`; disabled = false;
        } else {
          action = `${coinSVG()}${def.cost}`; onclick = `buyOutfit('${id}')`; disabled = coins < def.cost;
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
    const def = W().pets[p.type];
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
    /* Never draw - and above all never save - before this account's garden has
       been read in. Rendering first would write an empty layout over a real
       one, which is how you lose someone's garden. */
    if (!stateLoaded) return;

    /* Completed tasks pay out coins; they no longer plant anything by
       themselves. Plants are bought from the shop and stay put until moved. */
    syncCompletionCoins();

    const completedCount = App.tickets().filter(t => t.completedAt).length;
    if (sectionsBought === null) loadSections(completedCount);

    const unlockedCount = unlockedSectionCount();
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
        /* Art is looked up per render, so the same layout table serves every
           world and a world switch redraws without touching saved state. */
        let svg = d.art ? W().art[d.art](d.width) : d.svg;

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
      const def = W().items[it.kind];
      if (!def) return;
      placedDecorations.push({
        row: it.row, col: it.col, width: 1, height: 1, blocking: true, movable: true,
        svg: def.svg(), instanceId, source: 'item', sourceId: it.id, kind: it.kind
      });
    });
    saplings.filter(s => s.planted).forEach(s => {
      placedDecorations.push({
        row: s.row, col: s.col, width: 1, height: 1, blocking: true, movable: false, choppable: false,
        svg: isSaplingGrown(s) ? W().art.tree() : W().art.sapling(), source: 'sapling', sourceId: s.id
      });
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
      const wallHtml = `<div class="garden-section-wall" style="background:${W().wallPattern(info.theme)};"></div>`;

      const decorHtml = placedDecorations
        .filter(d => d.source === 'theme' && !d.movable && Math.floor(d.row / SECTION_ROWS) === i)
        .map(d => {
          const w = d.width * CELL_SIZE;
          const h = d.height * CELL_SIZE;
          const relTop = (d.row - i * SECTION_ROWS) * CELL_SIZE;
          if (d.blocking) {
            return `<div class="garden-decor" style="left:${d.col * CELL_SIZE}px; top:${relTop}px; width:${w}px; height:${h}px;"><div class="sprite-shadow"></div>${d.svg}</div>`;
          }
          return `<div class="garden-surface" style="left:${d.col * CELL_SIZE}px; top:${relTop}px; width:${w}px; height:${h}px; background:${W().surfaceBackground(d.kind)};"></div>`;
        }).join('');

      bandsHtml += `<div class="garden-section-band${dimClass}" style="top:${top}px;height:${height}px;${checkerBackground(info.theme)}">
        ${decorHtml}
        ${roofHtml}
        ${wallHtml}
      </div>`;

      if (i === unlockedCount) {
        const affordable = coins >= SECTION_COST;
        gateHtml = `<div class="garden-gate" style="top:${top - 8}px;">
          <div class="garden-gate-post left"></div>
          <div class="garden-gate-bar"></div>
          <div class="garden-gate-post right"></div>
          <button type="button" class="garden-gate-count ${affordable ? 'can-buy' : ''}"
                  onclick="event.stopPropagation();buySection()"
                  ${affordable ? '' : 'disabled'}
                  title="${affordable ? 'Open up the next part of the garden' : 'You need ' + SECTION_COST + ' coins'}">
            Unlock ${coinSVG()}${SECTION_COST}
          </button>
        </div>`;
      }
    }

    const movablesHtml = placedDecorations.filter(d => d.movable).map(d =>
      `<div class="garden-decor" style="left:${d.col * CELL_SIZE}px; top:${d.row * CELL_SIZE}px; width:${d.width * CELL_SIZE}px; height:${d.height * CELL_SIZE}px;"><div class="sprite-shadow"></div>${d.svg}</div>`
    ).join('');

    let cellsHtml = '';
    Object.keys(gardenLayout).forEach(id => {
      const pos = gardenLayout[id];
      const variety = W().plants[pos.variety] || W().plants[0];
      const potColor = pos.potColor || potColorFor(id);
      const planted = isOnDirt(pos.row, pos.col);
      const seedling = isSeedling(pos);
      const label = seedling ? seedlingLabel(pos) : variety.name;
      cellsHtml += `<div class="garden-cell" style="left:${pos.col * CELL_SIZE}px; top:${pos.row * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px;" title="${Util.escapeHtml(label)}">
        <div class="sprite-shadow"></div>
        ${seedling ? seedlingSVG(planted) : W().plantSVG(variety, potColor, planted)}
      </div>`;
    });

    const petsHtml = ownedPets.map(p => {
      const def = W().pets[p.type];
      if (!def) return '';
      return `<div class="garden-pet" id="${p.id}" style="width:${CELL_SIZE}px; height:${CELL_SIZE}px; transform:translate(${p.col * CELL_SIZE}px, ${p.row * CELL_SIZE}px);" title="${Util.escapeHtml(def.label)}"><div class="sprite-shadow"></div>${def.svg()}</div>`;
    }).join('');

    const treatsHtml = pendingTreats.map(t =>
      `<div class="garden-decor" style="left:${t.col * CELL_SIZE}px; top:${t.row * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px;"><div class="sprite-shadow"></div>${W().art.treat()}</div>`
    ).join('');

    const saplingsHtml = placedDecorations.filter(d => d.source === 'sapling').map(d =>
      `<div class="garden-decor" style="left:${d.col * CELL_SIZE}px; top:${d.row * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px;" title="${isSaplingGrown(saplings.find(s => s.id === d.sourceId) || {}) ? 'Grown tree — chop it with the axe!' : `Sapling (watered ${(saplings.find(s => s.id === d.sourceId) || {}).waterCount || 0}/${SAPLING_WATERS_NEEDED})`}"><div class="sprite-shadow"></div>${d.svg}</div>`
    ).join('');

    const unplantedSaplingsHtml = saplings.filter(s => !s.planted && !(heldSapling && heldSapling.id === s.id)).map(s =>
      `<div class="garden-decor" style="left:${s.col * CELL_SIZE}px; top:${s.row * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px;" title="${terms().sprout} — carry it somewhere and press E to plant it"><div class="sprite-shadow"></div>${W().art.sapling()}</div>`
    ).join('');

    const groundLogsHtml = groundLogs.map(l =>
      `<div class="garden-decor" style="left:${l.col * CELL_SIZE}px; top:${l.row * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px;" title="${terms().log}">${W().art.log()}</div>`
    ).join('');

    const cabinsHtml = cabinSites.map(s =>
      `<div class="garden-decor" style="left:${s.col * CELL_SIZE}px; top:${s.row * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px;" title="${s.complete ? terms().build : terms().build + ' site: ' + s.logCount + '/' + CABIN_LOGS_NEEDED + ' ' + terms().logs}"><div class="sprite-shadow"></div>${W().art.build(s.logCount)}</div>`
    ).join('');

    const dugTilesHtml = [...dugTiles].map(key => {
      const [r, c] = key.split(':').map(Number);
      return `<div class="garden-surface" style="left:${c * CELL_SIZE}px; top:${r * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px; background:${W().surfaceBackground('bed')};" title="${terms().tilled}"></div>`;
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

    renderCoins();

    document.getElementById('garden-gardener').innerHTML = heroSVG('down', getEquippedOutfit());

    const plantCount = Object.keys(gardenLayout).length;
    const t = terms();
    const plantWord = plantCount === 1 ? t.plant : t.plants;
    document.getElementById('garden-status').textContent = plantCount
      ? `${heroName()} is tending ${plantCount} ${plantWord} in ${t.place}.`
      : `${heroName()} has no ${t.plants} yet - finish a task to earn a coin, then buy one.`;
  }


  /* ---------- Help topics (worded around the current account name) ---------- */

  function helpTopics() {
    const who = heroName();
    const t = terms();
    return {
      coins: { icon: coinSVG(), title: 'Coins and ' + t.plants, body: 'Every task you complete earns one gold coin. Coins buy ' + t.plants + ' from the shop - one coin each - and everything else in there: tools, ' + t.sprout + 's, creatures and outfits. Un-tick a task and its coin goes back.' },
      water: { icon: '\u{1F4A7}', title: 'Watering and growing', body: 'Everything you buy from the shop arrives as a seedling, and they all look the same. Put one down on dug soil or a bed, then move right up against it to water it - once a minute, five times - and it grows into whichever ' + t.plant + ' it was always going to be. Left in its pot it will never grow, however much you water it. Watering a grown ' + t.plant + ' is just for the pleasure of it, and earns no coins.' },
      pickup: { icon: '\u{270B}', title: 'Picking things up', body: 'Press E next to a ' + t.plant + ', tool, ' + t.log + ' or ' + t.sprout + ' to pick it up. Press E again to put it down somewhere empty - or use it, if it is a tool.' },
      axe: { icon: '\u{1FA93}', title: W().items.axe.label, body: 'Buy ' + (W().id === 'ocean' ? 'a coral saw' : 'an axe') + ' from the shop. While holding it, press E next to ' + t.chopTarget + ' to cut it down into ' + t.log + ' you can carry off.' },
      hoe: { icon: '\u{26CF}\u{FE0F}', title: W().items.hoe.label, body: 'Buy ' + (W().id === 'ocean' ? 'a sand rake' : 'a hoe') + ' from the shop. While holding it, press E to turn the tile ' + who + ' is on into ' + t.tilled + ' - no need to put it down first.' },
      shovel: { icon: '\u{1FACF}', title: W().items.shovel.label, body: 'Buy ' + (W().id === 'ocean' ? 'a sand scoop' : 'a shovel') + '. While holding it, press E next to ' + t.digTarget + ' - ' + who + ' drops the tool and picks the thing up in one go, ready to carry elsewhere.' },
      sapling: { icon: '\u{1F331}', title: t.sprout.charAt(0).toUpperCase() + t.sprout.slice(1) + 's', body: 'Buy one and it appears at the top. Carry it to an empty spot and press E to plant it. Move into it to water it - five waterings, once a minute, and it grows into ' + t.sprouted + '. Press F to grow every planted one at once.' },
      cabin: { icon: '\u{1FAB5}', title: 'Building a ' + t.build, body: 'Carry ' + t.log + ' onto a tile that already has some to start a ' + t.build + ' site. Keep bringing more and watch it rise in stages - foundation, walls, roof, then doors and windows once it finishes at 10.' },
      pets: { icon: '\u{1F43E}', title: 'Companions', body: 'Buy one, or unlock a random one (10 max). One food suits every animal: buy a bowl, pick it up and walk it over to whichever one you want. Friendly ones stick close, skittish ones flee until you win them over.' },
      unlock: { icon: '\u{1F512}', title: 'More room', body: 'The next part of ' + t.place + ' is always visible ahead, dimmed, behind a gate. Tap the gate to open it for ' + SECTION_COST + ' coins. There is no limit - keep buying and ' + t.place + ' keeps going.' }
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
    stateLoaded = false;
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
    sectionsBought = null;    /* re-read, and migrate, on the next render */
    activeThought = null;
    lensLastKey = '';

    loadGardenLayout();
    loadHeroPos();
    loadMovableLayout();
    loadPurchasedItems();
    loadPets();
    loadCoins();
    loadLens();
    loadOutfits();
    loadChoppedTrees();
    loadGroundLogs();
    loadCabinSites();
    loadSaplings();
    loadGardenVisibility();
    loadDugTiles();
    loadAwardedCoins();
    stateLoaded = true;
  }

  /* The keyboard hint is no use on a phone, so each device is told how it
     actually moves. */
  function moveHintText() {
    return isTouchDevice()
      ? 'Tap a square to walk there, swipe to step one square, tap yourself to pick up or use.'
      : terms().moveHint;
  }

  function start() {
    const panel = document.getElementById('garden-panel-title');
    if (panel) panel.textContent = terms().panel;
    const hint = document.getElementById('garden-move-hint');
    if (hint) hint.textContent = moveHintText();
    const useHint = document.getElementById('garden-use-hint');
    if (useHint) useHint.hidden = isTouchDevice();
    const coinHelp = document.querySelector('.coin-help-btn');
    if (coinHelp && !coinHelp.firstChild) coinHelp.innerHTML = coinSVG();
    const buyHint = document.getElementById('garden-buy-hint');
    if (buyHint) buyHint.textContent = 'Finish a task to earn a coin, then buy a seedling - plant it in the ground and water it 5x to grow.';
    render();
    applyGardenVisibility();
    startPetTicker();
  }

  function render() {
    renderGarden();
  }

  /* Called when the world or the hero changes in settings. Nothing in storage
     moves - the same garden is simply drawn with the other world's art. */
  function reskin() {
    const panel = document.getElementById('garden-panel-title');
    if (panel) panel.textContent = terms().panel;
    const hint = document.getElementById('garden-move-hint');
    if (hint) hint.textContent = moveHintText();
    const useHint = document.getElementById('garden-use-hint');
    if (useHint) useHint.hidden = isTouchDevice();
    const coinHelp = document.querySelector('.coin-help-btn');
    if (coinHelp && !coinHelp.firstChild) coinHelp.innerHTML = coinSVG();
    const buyHint = document.getElementById('garden-buy-hint');
    if (buyHint) buyHint.textContent = 'Finish a task to earn a coin, then buy a seedling - plant it in the ground and water it 5x to grow.';
    currentHelpTopic = null;
    const box = document.getElementById('help-explanation');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    render();
    renderCoins();
    const g = document.getElementById('garden-gardener');
    if (g) g.innerHTML = heroSVG('down', getEquippedOutfit());
  }

  function stop() {
    if (petTickTimer) clearInterval(petTickTimer);
    petTickTimer = null;
    stopWalking();
  }

  /* Inline handlers in generated markup call these by name. */
  window.buyItem = buyItem;
  window.buyPet = buyPet;
  window.buyPlant = buyPlant;
  window.buySapling = buySapling;
  window.buyFood = buyFood;
  window.buyLens = buyLens;
  window.buySection = buySection;
  window.toggleLens = toggleLens;
  window.unlockRandomPet = unlockRandomPet;
  window.resetGarden = resetGarden;
  window.showHelpTopic = showHelpTopic;
  window.handleGardenKeydown = handleGardenKeydown;
  window.handleGardenTouchStart = handleGardenTouchStart;
  window.handleGardenTouchEnd = handleGardenTouchEnd;
  window.focusGarden = focusGarden;
  window.toggleGardenVisibility = toggleGardenVisibility;

  /* 'Garden' or 'Reef' - for the tab that opens it. */
  function shortLabel() {
    return cap(terms().place.replace(/^the\s+/i, ''));
  }

  /* Used only by the test harness: water a square without the once-a-minute
     wait, so growing five stages does not take five minutes to check. */
  function testWater(row, col) {
    const id = findPlantAt(row, col);
    if (!id) return;
    wateredCooldown.delete(id);
    waterCheck(row, col, id);
  }

  return {
    applyVisibility: applyGardenVisibility,
    __testWater: testWater,
    start: start,
    stop: stop,
    render: render,
    reskin: reskin,
    loadAll: loadAll,
    heroName: heroName,
    shortLabel: shortLabel,
    renderCoins: renderCoins,
    renderShop: renderShop
  };
})();
