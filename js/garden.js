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
  /* What a plant is worth if you cash it in: a seedling gives back what it
     cost, a grown one is worth the waiting. */
  const SEEDLING_VALUE = 1;
  const PLANT_VALUE = 2;
  /* Long enough that walking into a plant twice in one step does not count
     twice, short enough that watering something five times is a thing you can
     actually do in one visit. It was a full minute, which made growing a single
     seedling a four-minute job and read as "watering does nothing". */
  const WATER_COOLDOWN_MS = 6000;
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



  /* ------------------------------------------------------------------ */
  /* Somebody else's plot, drawn read-only for the Friends tab.           */
  /* It is handed a world, a plot and a section count and builds its own   */
  /* HTML from those - it reads none of this account's state and writes    */
  /* nothing, so looking at a friend's garden cannot disturb your own.     */
  /* ------------------------------------------------------------------ */

  function previewPlotHTML(g) {
    g = g || {};
    const world = Worlds.get(g.world || Worlds.DEFAULT_WORLD);
    const layout = g.layout || {};
    /* Only the land they have actually opened up. The real plot shows one
       locked band ahead as something to save for, which is no use to a
       visitor - it would just be half a panel of grey. */
    const bands = Math.max(1, Math.min(12, Number(g.sections) || 1));
    const rows = bands * SECTION_ROWS;
    const chopped = new Set(g.chopped || []);
    const movables = g.movables || {};
    const dug = new Set((g.dug || []).map(String));
    const px = n => n * CELL_SIZE;

    const themeOf = i => (world.sections[i] && world.sections[i].theme)
      || world.themeOrder[i % world.themeOrder.length];

    /* Every theme decoration, resolved the way the real plot resolves it -
       felled ones gone, moved ones where they were moved to. */
    const placed = [];
    for (let i = 0; i < bands; i++) {
      (DECORATIONS_BY_THEME[themeOf(i)] || []).forEach(d => {
        let row = i * SECTION_ROWS + d.row;
        let col = d.col;
        const instanceId = (d.movable || d.choppable) ? i + ':' + d.id : null;
        const felled = !!(d.choppable && chopped.has(instanceId));
        if (felled && d.toolRequired === 'axe') return;
        const movableNow = d.movable || (felled && d.toolRequired === 'shovel');
        if (movableNow) {
          const moved = movables[instanceId];
          if (moved) { row = moved.row; col = moved.col; }
        }
        placed.push({ ...d, row, col, band: i, movable: movableNow,
                      svg: d.art ? world.art[d.art](d.width) : d.svg });
      });
    }

    /* Dirt, the same test the real garden makes: a bed, or soil they dug. */
    const onDirt = (row, col) => dug.has(row + ':' + col) || placed.some(d =>
      !d.blocking && d.kind === 'bed' &&
      row >= d.row && row < d.row + d.height && col >= d.col && col < d.col + d.width);

    const decor = (row, col, w, h, svg, shadow) =>
      `<div class="garden-decor" style="left:${px(col)}px; top:${px(row)}px; width:${px(w)}px; height:${px(h)}px;">`
      + (shadow === false ? '' : '<div class="sprite-shadow"></div>') + svg + '</div>';

    /* --- the bands, with their texture, edging, walls and roofs --- */
    let bandsHtml = '';
    for (let i = 0; i < bands; i++) {
      const theme = themeOf(i);
      const [c1, c2] = world.themeColors[theme];
      const size = CELL_SIZE * 2;
      const checker = `background-image: linear-gradient(45deg, ${c1} 25%, transparent 25%, transparent 75%, ${c1} 75%, ${c1}), linear-gradient(45deg, ${c1} 25%, ${c2} 25%, ${c2} 75%, ${c1} 75%, ${c1}); background-size: ${size}px ${size}px; background-position: 0 0, ${CELL_SIZE}px ${CELL_SIZE}px;`;
      const roofHtml = (theme === 'glass' || theme === 'wood')
        ? `<div class="garden-section-roof ${theme}"></div>` : '';

      const bandDecor = placed.filter(d => !d.movable && d.band === i).map(d => {
        const relTop = px(d.row - i * SECTION_ROWS);
        if (d.blocking) {
          return `<div class="garden-decor" style="left:${px(d.col)}px; top:${relTop}px; width:${px(d.width)}px; height:${px(d.height)}px;"><div class="sprite-shadow"></div>${d.svg}</div>`;
        }
        return `<div class="garden-surface" style="left:${px(d.col)}px; top:${relTop}px; width:${px(d.width)}px; height:${px(d.height)}px; background:${world.surfaceBackground(d.kind)};"></div>`;
      }).join('');

      bandsHtml += `<div class="garden-section-band" style="top:${px(i * SECTION_ROWS)}px; height:${px(SECTION_ROWS)}px; ${checker}">
        ${scatterHtml(i, theme, world)}
        ${i > 0 ? edgingHtml(theme, world) : ''}
        ${bandDecor}
        ${roofHtml}
        <div class="garden-section-wall" style="background:${world.wallPattern(theme)};"></div>
      </div>`;
    }

    const dugHtml = [...dug].map(key => {
      const [r, c] = key.split(':').map(Number);
      if (!isFinite(r) || !isFinite(c)) return '';
      return `<div class="garden-surface" style="left:${px(c)}px; top:${px(r)}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px; background:${world.surfaceBackground('bed')};"></div>`;
    }).join('');

    const movablesHtml = placed.filter(d => d.movable)
      .map(d => decor(d.row, d.col, d.width, d.height, d.svg)).join('');

    /* --- the plants, with the same sway, nudge and half-grown stage --- */
    let cellsHtml = '';
    Object.keys(layout).forEach(id => {
      const pos = layout[id];
      if (!pos || pos.held || pos.row == null || pos.row >= rows) return;
      const variety = world.plants[pos.variety] || world.plants[0];
      const planted = onDirt(pos.row, pos.col);
      const seedling = pos.grown === false;
      const half = seedling && (pos.waterCount || 0) >= Math.ceil(PLANT_WATERS_NEEDED / 2);
      const potColor = pos.potColor || NEUTRAL_POT;

      const nudgeX = (hashStr(id + ':x') % 5) - 2;
      const scale = (0.93 + (hashStr(id + ':s') % 13) / 100).toFixed(2);
      const delay = (hashStr(id + ':d') % 40) / 10;

      let art;
      if (half) art = `<span class="half-grown">${world.plantSVG(variety, potColor, planted)}</span>`;
      else if (seedling) {
        const pot = planted ? '' : `<rect x="2" y="15" width="10" height="1" fill="${NEUTRAL_POT}"/><rect x="3" y="16" width="8" height="3" fill="${NEUTRAL_POT}"/><rect x="4" y="18" width="6" height="1" fill="rgba(0,0,0,0.18)"/>`;
        art = `<svg width="24" height="34" viewBox="0 0 14 20" shape-rendering="crispEdges">${world.art.seedling()}${pot}</svg>`;
      } else art = world.plantSVG(variety, potColor, planted);

      cellsHtml += `<div class="garden-cell${planted ? ' sways' : ''}" style="left:${px(pos.col)}px; top:${px(pos.row)}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px; --sway-delay:${delay}s;">
        <div class="sprite-shadow" style="transform:translateX(calc(-46% + ${nudgeX}px)) scaleX(${scale});"></div>
        <span class="plant-art" style="--nudge:${nudgeX}px; --scale:${scale}; transform:translateX(${nudgeX}px) scale(${scale});">${art}</span>
      </div>`;
    });

    const itemsHtml = (g.items || []).map(it => {
      const def = world.items[it.kind];
      return def ? decor(it.row, it.col, 1, 1, def.svg()) : '';
    }).join('');

    const saplingsHtml = (g.saplings || []).map(sp => decor(sp.row, sp.col, 1, 1,
      (sp.planted && (sp.waterCount || 0) >= SAPLING_WATERS_NEEDED) ? world.art.tree() : world.art.sapling())).join('');

    const logsHtml = (g.logs || []).map(l => decor(l.row, l.col, 1, 1, world.art.log(), false)).join('');
    const cabinsHtml = (g.cabins || []).map(c => decor(c.row, c.col, 1, 1, world.art.build(c.logCount))).join('');
    const treatsHtml = (g.treats || []).map(t => decor(t.row, t.col, 1, 1, world.art.treat(), false)).join('');

    /* Pets get the same element shape as the real ones, so the preview's own
       ticker can walk them about afterwards. */
    const petsHtml = (g.pets || []).map(pet => {
      const def = world.pets[pet.type];
      if (!def) return '';
      return `<div class="garden-pet" data-pet="${Util.escapeHtml(pet.id || '')}" style="width:${CELL_SIZE}px; height:${CELL_SIZE}px; transform:translate(${px(pet.col)}px, ${px(pet.row)}px);"><div class="sprite-shadow"></div>${def.svg()}</div>`;
    }).join('');

    /* Their gardener, in whatever they last bought and put on. Where they were
       standing is a per-device thing and is often not synced, so if it did not
       come through they are simply stood in the middle of their first band. */
    const hp = (g.heroPos && isFinite(g.heroPos.row) && isFinite(g.heroPos.col)) ? g.heroPos : null;
    const heroRow = Math.max(0, Math.min(rows - 1, hp ? Number(hp.row) : Math.floor(SECTION_ROWS / 2)));
    const heroCol = Math.max(0, Math.min(GARDEN_COLS - 1, hp ? Number(hp.col) : Math.floor(GARDEN_COLS / 2)));
    const heroOutfit = (g.outfits && world.outfits[g.outfits.equipped]) || world.outfits.classic;
    const heroArt = Worlds.heroSVG(world.id, g.hero === 'female' ? 'female' : 'male',
                                   (hp && hp.direction) || 'down', heroOutfit);
    const heroHtml = `<div class="garden-hero garden-preview-hero" style="width:${CELL_SIZE}px; height:${CELL_SIZE}px; transform:translate(${px(heroCol)}px, ${px(heroRow)}px);"><div class="sprite-shadow"></div>${heroArt}</div>`;

    return `<div class="garden-plot garden-preview" style="width:${px(GARDEN_COLS)}px; height:${px(rows)}px;">`
      + bandsHtml + dugHtml + cellsHtml + movablesHtml + itemsHtml + saplingsHtml
      + logsHtml + cabinsHtml + treatsHtml + petsHtml + heroHtml
      + `<div class="garden-effects"></div></div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Bringing a friend's plot to life.                                    */
  /* The same butterflies and the same wandering pets as a real garden,   */
  /* run against the preview's own element and its own copy of the data.  */
  /* Nothing here writes to storage or touches this account's state, and  */
  /* it all stops the moment the preview is closed or replaced.           */
  /* ------------------------------------------------------------------ */

  let previewLife = null;

  function stopPreviewLife() {
    if (!previewLife) return;
    if (previewLife.frame != null) cancelAnimationFrame(previewLife.frame);
    if (previewLife.timer) clearInterval(previewLife.timer);
    if (previewLife.petTimer) clearInterval(previewLife.petTimer);
    if (previewLife.heroTimer) clearInterval(previewLife.heroTimer);
    previewLife = null;
  }

  function startPreviewLife(host, g) {
    stopPreviewLife();
    if (!host || !g) return;

    const world = Worlds.get(g.world || Worlds.DEFAULT_WORLD);
    const plot = host.querySelector('.garden-preview');
    const layer = plot && plot.querySelector('.garden-effects');
    if (!plot || !layer) return;

    const rows = Math.round(plot.offsetHeight / CELL_SIZE) || SECTION_ROWS;
    const bounds = { w: GARDEN_COLS * CELL_SIZE, h: rows * CELL_SIZE };
    const ocean = world.id === 'ocean';
    const layout = g.layout || {};

    /* Their flowers, for the butterflies to hang about over. */
    const flowers = Object.keys(layout).map(id => layout[id])
      .filter(p => p && !p.held && p.row != null && p.row < rows)
      .map(p => ({ x: p.col * CELL_SIZE + CELL_SIZE / 2, y: p.row * CELL_SIZE + CELL_SIZE * 0.35, grown: p.grown !== false }));

    /* A copy of their pets, so walking them about changes nothing of theirs. */
    const pets = (g.pets || []).map(p => ({ ...p })).filter(p => world.pets[p.type]);

    previewLife = { flyers: [], last: 0, frame: null, timer: null, petTimer: null, heroTimer: null };

    const target = () => {
      const n = Object.keys(layout).filter(id => layout[id] && !layout[id].held).length;
      return n > 15 ? 3 : n > 10 ? 2 : n > 5 ? 1 : 0;
    };

    const pick = f => {
      f.age = 0;
      const grown = flowers.filter(x => x.grown);
      const pool = grown.length ? grown : flowers;
      if (!pool.length) {
        f.tx = 8 + Math.random() * Math.max(8, bounds.w - 16);
        f.ty = 6 + Math.random() * Math.max(8, bounds.h - 12);
        f.hover = 300 + Math.random() * 700;
        return;
      }
      const stay = (f.flower && Math.random() < 0.6) ? f.flower : pool[Math.floor(Math.random() * pool.length)];
      f.flower = stay;
      const close = Math.random() < 0.55;
      const spread = close ? 7 : 13;
      f.tx = stay.x + (Math.random() * spread * 2 - spread);
      f.ty = stay.y + (Math.random() * spread * 1.6 - spread * 1.2);
      f.hover = close ? (500 + Math.random() * 1100) : (1600 + Math.random() * 2600);
    };

    const spawn = () => {
      const el = document.createElement('div');
      el.className = 'garden-ambient';
      el.innerHTML = ambientArt(world);
      layer.appendChild(el);
      const side = Math.floor(Math.random() * 4);
      const f = {
        el: el,
        x: side === 0 ? -18 : side === 1 ? bounds.w + 18 : Math.random() * bounds.w,
        y: side === 2 ? -16 : side === 3 ? bounds.h + 16 : Math.random() * bounds.h,
        vx: 0, vy: 0, tx: 0, ty: 0, hover: 0, age: 0, flower: null,
        dir: Math.random() < 0.5 ? -1 : 1,
        speed: 0.34 + Math.random() * 0.26,
        phase: Math.random() * Math.PI * 2,
        life: 40000 + Math.random() * 50000
      };
      pick(f);
      previewLife.flyers.push(f);
    };

    const loop = ts => {
      if (!previewLife) return;
      previewLife.frame = requestAnimationFrame(loop);
      const dt = previewLife.last ? Math.min(80, ts - previewLife.last) : 16;
      previewLife.last = ts;
      if (document.hidden || !previewLife.flyers.length) return;
      const k = Math.min(3, dt / 16);

      for (let i = previewLife.flyers.length - 1; i >= 0; i--) {
        const f = previewLife.flyers[i];
        f.life -= dt; f.hover -= dt; f.age += dt;
        f.phase += 0.085 * k;

        const dx = f.tx - f.x, dy = f.ty - f.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if ((dist < 9 && f.hover <= 0) || f.age > 9000) pick(f);

        const pull = dist < 14 ? 0.02 : 0.055;
        f.vx += ((dx / dist) * pull * f.speed + Math.cos(f.phase * 1.7) * 0.05) * k;
        f.vy += ((dy / dist) * pull * f.speed + Math.sin(f.phase) * 0.06) * k;
        f.vx *= 0.94; f.vy *= 0.94;
        const max = 1.1 * f.speed, sp = Math.hypot(f.vx, f.vy);
        if (sp > max) { f.vx = f.vx / sp * max; f.vy = f.vy / sp * max; }
        f.x = Math.max(-30, Math.min(bounds.w + 30, f.x + f.vx * k));
        f.y = Math.max(-26, Math.min(bounds.h + 26, f.y + f.vy * k));
        if (Math.abs(f.vx) > 0.06) f.dir = f.vx < 0 ? -1 : 1;

        if (f.life <= 0) { f.el.remove(); previewLife.flyers.splice(i, 1); continue; }
        const flap = ocean ? 1 : (0.62 + 0.38 * Math.abs(Math.sin(f.phase * 1.9)));
        f.el.style.opacity = f.life < 900 ? (f.life / 900).toFixed(2) : '0.9';
        f.el.style.transform = 'translate(' + f.x.toFixed(1) + 'px, ' + f.y.toFixed(1) + 'px) scaleX(' + (f.dir * flap).toFixed(2) + ')';
      }
    };

    previewLife.timer = setInterval(() => {
      if (!previewLife || document.hidden || !plot.offsetParent) return;
      if (previewLife.reduced === undefined) {
        previewLife.reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }
      if (previewLife.reduced) return;
      const want = target();
      if (previewLife.flyers.length > want) {
        for (let i = 0; i < previewLife.flyers.length - want; i++) {
          if (previewLife.flyers[i].life > 1200) previewLife.flyers[i].life = 900;
        }
      } else if (previewLife.flyers.length < want && Math.random() < 0.6) spawn();
    }, 1600);

    /* Their gardener takes a turn about the place too, so a friend's garden is
       not a photograph. They only ever move on the preview's own element. */
    const heroEl = plot.querySelector('.garden-preview-hero');
    if (heroEl) {
      const start = heroEl.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      const walker = {
        row: start ? Math.round(Number(start[2]) / CELL_SIZE) : 0,
        col: start ? Math.round(Number(start[1]) / CELL_SIZE) : 0,
        facing: 1
      };
      previewLife.heroTimer = setInterval(() => {
        if (!previewLife || document.hidden || !plot.offsetParent) return;
        if (Math.random() < 0.35) return;
        const dirs = [[-1, 0, null], [1, 0, null], [0, -1, -1], [0, 1, 1]];
        const [dr, dc, face] = dirs[Math.floor(Math.random() * dirs.length)];
        walker.row = Math.max(0, Math.min(rows - 1, walker.row + dr));
        walker.col = Math.max(0, Math.min(GARDEN_COLS - 1, walker.col + dc));
        if (face) walker.facing = face;
        heroEl.style.transform = 'translate(' + (walker.col * CELL_SIZE) + 'px, '
          + (walker.row * CELL_SIZE) + 'px) scaleX(' + walker.facing + ')';
      }, 2200);
    }

    /* Their animals mill about the same way yours do - there is nobody for
       them to follow or shy away from here, so it is the wander alone. */
    if (pets.length) {
      previewLife.petTimer = setInterval(() => {
        if (!previewLife || document.hidden || !plot.offsetParent) return;
        pets.forEach(pet => {
          if (Math.random() >= 0.6) return;
          const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
          const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
          const nr = Math.max(0, Math.min(rows - 1, pet.row + dr));
          const nc = Math.max(0, Math.min(GARDEN_COLS - 1, pet.col + dc));
          pet.row = nr; pet.col = nc;
          const el = plot.querySelector('.garden-pet[data-pet="' + (pet.id || '') + '"]');
          if (el) el.style.transform = 'translate(' + (nc * CELL_SIZE) + 'px, ' + (nr * CELL_SIZE) + 'px)';
        });
      }, 5000);
    }

    previewLife.frame = requestAnimationFrame(loop);
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
    /* Ten coins is ten finished tasks, so it is worth being sure. */
    const t = terms();
    if (!window.confirm('Open up the next part of ' + t.place + ' for ' + SECTION_COST + ' coins?')) return;
    spendCoins(SECTION_COST);
    sectionsBought = (sectionsBought || 0) + 1;
    saveSections();
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
    spendCoins(def.cost);
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
      /* The first garden reads X Y X Y Y X Y X across - beds down columns 0,
         2, 5 and 7 with grass between them. Rows 1-5 only, so the trees, the
         washing line, the mower and the wheelbarrow keep their squares. */
      { row: 1, col: 0, width: 1, height: 5, blocking: false, kind: 'bed' },
      { row: 1, col: 2, width: 1, height: 5, blocking: false, kind: 'bed' },
      { row: 1, col: 5, width: 1, height: 5, blocking: false, kind: 'bed' },
      { row: 1, col: 7, width: 1, height: 5, blocking: false, kind: 'bed' },
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
  const COINS_SPENT_KEY = 'coins-spent-v1';
  const COINS_BONUS_KEY = 'coins-bonus-v1';
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
  /* Everything ever spent, and everything earned other than by finishing a
     task (cashing a plant in). With those two numbers and the ledger of paid
     tasks the balance can always be worked out again from scratch, which is
     what stops an update, a new device or a half-finished sync from quietly
     leaving you poorer than your finished work says you should be. */
  let coinsSpent = 0;
  let coinsBonus = 0;
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
    /* An empty task list part way through a sign-in is not the same as having
       no tasks. Rebuilding the ledger from it would throw away every coin you
       have earned, so nothing is touched until there is something to read. */
    if (!tickets.length && awardedCoins.size) { recomputeCoins(); return; }

    const completedIds = new Set(tickets.filter(t => t.completedAt).map(t => t.id));
    const existingIds = new Set(tickets.map(t => t.id));

    let changed = false;

    completedIds.forEach(id => {
      if (awardedCoins.has(id)) return;
      awardedCoins.add(id);
      changed = true;
    });

    [...awardedCoins].forEach(id => {
      if (completedIds.has(id)) return;
      awardedCoins.delete(id);
      changed = true;
      /* Un-ticking a task takes its coin back. Deleting one does not - that
         work was still done - so its coin moves across to the kept pile. */
      if (!existingIds.has(id)) coinsBonus += 1;
    });

    if (changed) { saveAwardedCoins(); saveCoinLedger(); }
    if (recomputeCoins()) renderCoins();
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

  /* Up, right, down, left - but the way the gardener is looking always comes
     first, so E acts on what is in front of you rather than on whatever happens
     to be north of you. */
  function facingFirstDirs() {
    const dirs = [[-1, 0], [0, 1], [1, 0], [0, -1]];
    const face = { up: 0, right: 1, down: 2, left: 3 }[heroDirection];
    if (face == null) return dirs;
    return [dirs[face]].concat(dirs.filter((d, i) => i !== face));
  }

  function facingSquare() {
    const [dr, dc] = facingFirstDirs()[0];
    return [heroPos.row + dr, heroPos.col + dc];
  }

  function findUnplantedSaplingAt(row, col) {
    return saplings.find(s => !s.planted && s.row === row && s.col === col) || null;
  }

  function findPickupableSapling() {
    const onSelf = findUnplantedSaplingAt(heroPos.row, heroPos.col);
    if (onSelf) return onSelf;
    const dirs = facingFirstDirs();
    for (const [dr, dc] of dirs) {
      const s = findUnplantedSaplingAt(heroPos.row + dr, heroPos.col + dc);
      if (s) return s;
    }
    return null;
  }

  /* One answer to "is anything already standing here?". Every placement helper
     goes through this, so a bought seedling can no longer land on top of a log,
     a sapling, a bowl of food or the gardener. */
  function cellOccupied(row, col) {
    if (findPlantAt(row, col)) return true;
    if (findDecorationAt(row, col)) return true;
    if (findGroundLogAt(row, col)) return true;
    if (saplings.some(s => s.row === row && s.col === col)) return true;
    if (cabinSites.some(s => s.row === row && s.col === col)) return true;
    if (pendingTreats.some(t => t.row === row && t.col === col)) return true;
    if (ownedPets.some(p => p.row === row && p.col === col)) return true;
    if (row === heroPos.row && col === heroPos.col) return true;
    return false;
  }

  /* The first free square reading down from the top, or null when the garden is
     genuinely full. It used to answer 0:0 when full, which silently stacked
     every further purchase on that one square with only the first ever drawn -
     buy ten seedlings with no room and nine of them disappeared, coins and all. */
  function findFreeCellAtTop() {
    for (let r = 0; r <= gardenMaxUnlockedRow; r++) {
      for (let c = 0; c < GARDEN_COLS; c++) {
        if (!cellOccupied(r, c)) return { row: r, col: c };
      }
    }
    return null;
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

  function num(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /* Read the two ledgers. The first time this runs on a garden that predates
     them, they are worked backwards out of whatever balance was stored, so
     nobody's coins change on the update. */
  function loadCoinLedger() {
    const stored = Store.kv.getItem(COINS_SPENT_KEY);
    if (stored === null) {
      const balance = num(Store.kv.getItem(COINS_KEY));
      coinsSpent = Math.max(0, awardedCoins.size - balance);
      coinsBonus = Math.max(0, balance - awardedCoins.size);
      saveCoinLedger();
    } else {
      coinsSpent = num(stored);
      coinsBonus = num(Store.kv.getItem(COINS_BONUS_KEY));
    }
    recomputeCoins();
  }

  function saveCoinLedger() {
    Store.kv.setItem(COINS_SPENT_KEY, String(coinsSpent));
    Store.kv.setItem(COINS_BONUS_KEY, String(coinsBonus));
  }

  /* The balance is never stored as a fact - it is this sum, every time.
     Returns whether it moved, so callers can skip a pointless redraw. */
  function recomputeCoins() {
    const next = Math.max(0, awardedCoins.size + coinsBonus - coinsSpent);
    if (next === coins) return false;
    coins = next;
    /* Still written down, so an older copy of the app (or a glance at the
       stored data) sees the right number. Nothing here reads it back. */
    Store.kv.setItem(COINS_KEY, String(coins));
    return true;
  }

  function spendCoins(n) {
    if (!(n > 0)) return;
    coinsSpent += n;
    saveCoinLedger();
    recomputeCoins();
    renderCoins();
  }

  function earnCoins(n) {
    if (!(n > 0)) return;
    coinsBonus += n;
    saveCoinLedger();
    recomputeCoins();
    renderCoins();
    bumpCoinDisplay(n);
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

  /* A stable number for a square, so its scatter never moves between renders. */
  function tileHash(row, col, salt) {
    let h = (row * 73856093) ^ (col * 19349663) ^ ((salt || 0) * 83492791);
    h = (h ^ (h >>> 13)) * 1274126177;
    return Math.abs(h ^ (h >>> 16));
  }

  function shade(hex, amount) {
    const h = String(hex || '#888888').replace('#', '');
    const to = amount < 0 ? 0 : 255;
    const a = Math.abs(amount);
    const mix = c => Math.round(c + (to - c) * a);
    return `rgb(${mix(parseInt(h.slice(0,2),16))}, ${mix(parseInt(h.slice(2,4),16))}, ${mix(parseInt(h.slice(4,6),16))})`;
  }

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

  /* A cash register: the bell struck, then two bright notes ringing over it.
     Played when a task is ticked off, which is the moment a coin is earned. */
  function playCashSound() {
    playNoiseBurst(0.04, 5200, 0.045);
    playTone(1318.5, 0.14, 'triangle', 0.07);
    setTimeout(() => playTone(1760, 0.34, 'triangle', 0.075), 85);
    setTimeout(() => playTone(2637, 0.28, 'sine', 0.03), 105);
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
    migrateVarieties();
    releaseHeldPlants();
  }

  /* A plant is only ever flagged held while somebody is carrying it, and that
     lasts one session. So anything still flagged when the garden loads was
     interrupted - a reload, an update, a sync landing mid-carry - and is put
     back down where it was picked up rather than left invisible. */
  function releaseHeldPlants() {
    let changed = false;
    Object.keys(gardenLayout).forEach(id => {
      if (gardenLayout[id] && gardenLayout[id].held) {
        delete gardenLayout[id].held;
        changed = true;
      }
    });
    if (changed) saveGardenLayout();
  }

  /* ------------------------------------------------------------------ */
  /* Thirteen varieties came out of both worlds (Sep 2026).             */
  /* `variety` is a stored index into the list, so without this every    */
  /* plant after a gap would silently become a different species: a rose */
  /* would come back as a tulip. This renumbers what survived, and gives */
  /* a plant whose variety is gone a new one worked out from its own id  */
  /* - so a bed of bonsais turns into a mixed bed rather than a row of   */
  /* identical roses. It runs once per garden and then leaves a marker.  */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* Which kinds you have found.                                          */
  /* A variety is only revealed when a seedling grows into it, so the      */
  /* ledger is written there. It only ever counts up: cashing a plant in,  */
  /* digging it up or switching worlds does not un-find a kind. The two    */
  /* worlds are paired index for index, so one ledger serves both.         */
  /* ------------------------------------------------------------------ */

  const FOUND_VARIETIES_KEY = 'garden-found-v1';
  let foundVarieties = new Set();

  function loadFoundVarieties() {
    try {
      const raw = JSON.parse(Store.kv.getItem(FOUND_VARIETIES_KEY));
      foundVarieties = new Set(Array.isArray(raw) ? raw.filter(n => typeof n === 'number') : []);
    } catch (e) {
      foundVarieties = new Set();
    }
  }

  function saveFoundVarieties() {
    Store.kv.setItem(FOUND_VARIETIES_KEY, JSON.stringify([...foundVarieties].sort((a, b) => a - b)));
  }

  function markFound(variety) {
    if (typeof variety !== 'number' || foundVarieties.has(variety)) return false;
    foundVarieties.add(variety);
    saveFoundVarieties();
    return true;
  }

  /* Gardens that predate the ledger are credited with whatever is already
     grown in them, so nobody starts back at zero. */
  function creditGrownVarieties() {
    let added = false;
    Object.keys(gardenLayout).forEach(id => {
      const p = gardenLayout[id];
      if (!p || isSeedling(p) || typeof p.variety !== 'number') return;
      if (!foundVarieties.has(p.variety)) { foundVarieties.add(p.variety); added = true; }
    });
    if (added) saveFoundVarieties();
  }

  function foundTally() {
    return { found: foundVarieties.size, total: W().plants.length };
  }

  const VARIETY_MIGRATION_KEY = 'garden-varieties-v2';
  const VARIETY_REMAP = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 10: 7, 12: 8, 14: 9, 15: 10, 19: 11, 20: 12, 22: 13, 23: 14, 24: 15, 25: 16, 26: 17, 27: 18, 28: 19, 29: 20, 30: 21, 31: 22, 32: 23, 33: 24, 34: 25, 35: 26, 36: 27, 37: 28, 38: 29, 40: 30 };

  function migrateVarieties() {
    if (Store.kv.getItem(VARIETY_MIGRATION_KEY) === '1') return;

    const count = W().plants.length;
    let changed = false;
    Object.keys(gardenLayout).forEach(id => {
      const pos = gardenLayout[id];
      if (!pos || typeof pos.variety !== 'number') return;
      const moved = VARIETY_REMAP[pos.variety];
      const next = moved === undefined ? hashStr(id + ':variety') % count : moved;
      if (next !== pos.variety) { pos.variety = next; changed = true; }
    });

    Store.kv.setItem(VARIETY_MIGRATION_KEY, '1');
    if (changed) saveGardenLayout();
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

  /* A plant in your hands is still a plant: it stays in the layout with
     held: true rather than being deleted, so a reload or a sync landing while
     you carry it cannot destroy it. Nothing that looks at the ground sees it. */
  function findPlantAt(row, col) {
    for (const id in gardenLayout) {
      const p = gardenLayout[id];
      if (p.held) continue;
      if (p.row === row && p.col === col) return id;
    }
    return null;
  }

  function plantIds() {
    return Object.keys(gardenLayout).filter(id => !gardenLayout[id].held);
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

  /* Walk to a square along two straight legs rather than a diagonal
     staircase: finish one axis, then the other, so the path reads as
     "up, then across". Which axis goes first is decided once and kept for
     the whole walk - from the way the finger dragged when there is one,
     otherwise the longer leg first. A blocked step falls back to the other
     axis for that tick so it can still round an obstacle. */
  function walkTo(row, col, firstAxis) {
    stopWalking();

    let axis = firstAxis;
    if (axis !== 'row' && axis !== 'col') {
      axis = Math.abs(row - heroPos.row) >= Math.abs(col - heroPos.col) ? 'row' : 'col';
    }

    let steps = 0;
    walkTimer = setInterval(() => {
      steps++;
      const dRow = row - heroPos.row;
      const dCol = col - heroPos.col;
      if ((dRow === 0 && dCol === 0) || steps > WALK_MAX_STEPS) { stopWalking(); return; }

      const rowStep = [Math.sign(dRow), 0];
      const colStep = [0, Math.sign(dCol)];
      /* Keep spending the first axis until it is used up, then the other. */
      const order = axis === 'row'
        ? [dRow ? rowStep : colStep, dCol ? colStep : rowStep]
        : [dCol ? colStep : rowStep, dRow ? rowStep : colStep];

      let moved = false;
      for (const [dr, dc] of order) {
        if (!dr && !dc) continue;
        /* Water only the square you actually asked to walk to. */
        const water = heroPos.row + dr === row && heroPos.col + dc === col;
        if (stepHero(dr, dc, { water })) { moved = true; break; }
      }
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
    const cell = cellFromPoint(t.clientX, t.clientY);
    touchStart = {
      x: t.clientX, y: t.clientY, at: Date.now(),
      firstAxis: null,
      /* A drag that begins on the gardener is a "walk over there" - the most
         natural way to move a character with a finger. */
      onHero: !!cell && cell.row === heroPos.row && cell.col === heroPos.col
    };
  }

  /* The way the line was drawn decides which leg is walked first. The first
     direction the finger clearly commits to - up/down or left/right - is
     remembered, so dragging up and then across walks up first, then across. */
  function handleGardenTouchMove(event) {
    if (!touchStart || touchStart.firstAxis) return;
    const t = event.changedTouches && event.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) {
      touchStart.firstAxis = Math.abs(dy) >= Math.abs(dx) ? 'row' : 'col';
    }
  }

  function handleGardenTouchEnd(event) {
    const t = event.changedTouches && event.changedTouches[0];
    if (!t || !touchStart) { touchStart = null; return; }
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const start = touchStart;
    touchStart = null;

    const moved = Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP;

    /* Dragged from the gardener: walk to wherever the finger was let go. */
    if (start.onHero && moved) {
      event.preventDefault();
      const target = cellFromPoint(t.clientX, t.clientY);
      const firstAxis = start.firstAxis || (Math.abs(dy) >= Math.abs(dx) ? 'row' : 'col');
      if (target) walkTo(target.row, target.col, firstAxis);
      return;
    }

    /* A definite drag from anywhere else is a swipe: one step whichever way it
       leaned. */
    if (Math.abs(dx) > SWIPE_MIN || Math.abs(dy) > SWIPE_MIN) {
      event.preventDefault();
      if (Math.abs(dx) > Math.abs(dy)) stepHero(0, dx > 0 ? 1 : -1);
      else stepHero(dy > 0 ? 1 : -1, 0);
      return;
    }

    if (moved) return;

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
    const phoneView = typeof App !== 'undefined' && App.isAppMode && App.isAppMode();
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
      /* The hero is mirrored with scaleX when facing left, which would print
         the bubble's words backwards - so the text is flipped back inside it. */
      const thought = activeThought
        ? `<div class="garden-thought${heroFacing < 0 ? ' mirrored' : ''}"><span>${Util.escapeHtml(activeThought)}</span></div>` : '';
      heroEl.innerHTML = `${thought}${heldWrap}<div class="sprite-shadow"></div>${heroSVG(heroDirection, getEquippedOutfit())}`;
    }
  }

  /* Sparkles, hearts and the drifting wildlife all live in one layer that is
     kept across re-renders. renderGarden replaces the plot's innerHTML, which
     used to destroy a sparkle in the same tick it was created - so watering a
     seedling made a sound and showed nothing. */
  let effectsLayer = null;

  function effects() {
    const plot = document.getElementById('garden-plot');
    if (!plot) return null;
    if (!effectsLayer) {
      effectsLayer = document.createElement('div');
      effectsLayer.className = 'garden-effects';
    }
    if (effectsLayer.parentElement !== plot) plot.appendChild(effectsLayer);
    return effectsLayer;
  }

  function spawnSparkleAt(row, col) {
    const plot = effects();
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
    const plot = effects();
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
    const plot = effects();
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
    playWaterSound();

    const pos = gardenLayout[taskId];
    let justGrew = false;

    if (isSeedling(pos)) {
      /* Water goes straight through a pot. Roots need the ground. */
      if (!isOnDirt(row, col)) {
        spawnSparkleAt(row, col);
        showThought('Needs planting in the ground');
        return;
      }
      pos.waterCount = (pos.waterCount || 0) + 1;
      if (pos.waterCount >= PLANT_WATERS_NEEDED) {
        pos.grown = true;
        justGrew = true;
      }
      if (justGrew) markFound(pos.variety);
      saveGardenLayout();
      /* Growing something is worth getting to the server now rather than in a
         second's time, in case the tab is closed or updated in between. */
      if (justGrew && Store.flush) Store.flush();
      renderGarden();
    }

    /* After the redraw, never before it. */
    spawnSparkleAt(row, col);
    /* Counting up out loud. Watering used to give a sparkle and nothing else,
       so a watering that had not counted and one that had looked identical. */
    if (!justGrew && isSeedling(pos) && isOnDirt(row, col)) {
      showThought('Watered ' + pos.waterCount + ' of ' + PLANT_WATERS_NEEDED);
    }
    if (justGrew) {
      spawnSparkleAt(row, col - 1);
      spawnSparkleAt(row, col + 1);
      /* Naming the thing that just grew is the magnifying glass's job, and
         only the magnifying glass's. Without one you get the sparkle and see
         for yourself what came up. */
      if (hasLens && lensOn) {
        const variety = W().plants[pos.variety] || W().plants[0];
        showThought(variety.name + '!');
      }
    }
  }

  function findAdjacentPlant() {
    const dirs = facingFirstDirs();
    for (const [dr, dc] of dirs) {
      const id = findPlantAt(heroPos.row + dr, heroPos.col + dc);
      if (id) return id;
    }
    return null;
  }

  function findAdjacentMovable() {
    const dirs = facingFirstDirs();
    for (const [dr, dc] of dirs) {
      const r = heroPos.row + dr, c = heroPos.col + dc;
      const d = placedDecorations.find(x => x.movable && x.blocking &&
        r >= x.row && r < x.row + x.height && c >= x.col && c < x.col + x.width);
      if (d) return d;
    }
    return null;
  }

  function findAdjacentToolTarget(toolKind) {
    const dirs = facingFirstDirs();
    for (const [dr, dc] of dirs) {
      const r = heroPos.row + dr, c = heroPos.col + dc;
      const d = placedDecorations.find(x => x.choppable && x.toolRequired === toolKind &&
        r >= x.row && r < x.row + x.height && c >= x.col && c < x.col + x.width);
      if (d) return d;
    }
    return null;
  }

  function findAdjacentGrownSapling() {
    const dirs = facingFirstDirs();
    for (const [dr, dc] of dirs) {
      const r = heroPos.row + dr, c = heroPos.col + dc;
      const s = saplings.find(x => isSaplingGrown(x) && x.row === r && x.col === c);
      if (s) return s;
    }
    return null;
  }

  function findAdjacentTreat() {
    const dirs = facingFirstDirs();
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
    const dirs = facingFirstDirs();
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
  function stepHero(dr, dc, opts) {
    /* Walking a route can brush past several plants on its way round an
       obstacle. Only a step you meant - a key, a swipe, or the last step of a
       tap - waters what it bumps into. */
    const mayWater = !opts || opts.water !== false;
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
      if (mayWater) waterCheck(targetRow, targetCol, plantId);
      saveHeroPos();
      positionHero();
      lensLook(targetRow, targetCol);
      return false;
    }

    const saplingHere = saplings.find(s => s.planted && s.row === targetRow && s.col === targetCol);
    if (saplingHere && !isSaplingGrown(saplingHere)) {
      if (mayWater) waterSaplingCheck(targetRow, targetCol, saplingHere);
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
      };   /* no held flag - it is back in the ground */
      heldPlantId = null;
      heldPlantVariety = null;
      heldPlantPot = null;
      heldPlantGrown = true;
      heldPlantWaters = 0;
      saveGardenLayout();
      renderShop();
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

    /* Whatever you are looking at comes first, of whatever kind. Only when the
       square in front is empty do the other three neighbours get a look in. */
    const [fr, fc] = facingSquare();
    if (takeFromSquare(fr, fc)) return;

    const taskId = findAdjacentPlant();
    if (taskId) { takePlant(taskId); return; }

    const decor = findAdjacentMovable();
    if (decor) { takeDecoration(decor); return; }

    const log = findPickupableLog();
    if (log) { takeLog(log); return; }

    const sapling = findPickupableSapling();
    if (sapling) { takeSapling(sapling); return; }

    const treat = findAdjacentTreat();
    if (treat) takeTreat(treat);
  }

  /* Everything E can lift, tried on one square. Keeping them in one place is
     what lets the square in front of you be checked across every kind of thing
     before falling back to the neighbours. */
  function takeFromSquare(r, c) {
    if (r < 0 || r > gardenMaxUnlockedRow || c < 0 || c >= GARDEN_COLS) return false;

    const plantId = findPlantAt(r, c);
    if (plantId) { takePlant(plantId); return true; }

    const decor = placedDecorations.find(x => x.movable && x.blocking &&
      r >= x.row && r < x.row + x.height && c >= x.col && c < x.col + x.width);
    if (decor) { takeDecoration(decor); return true; }

    const log = findGroundLogAt(r, c);
    if (log) { takeLog(log); return true; }

    const sapling = findUnplantedSaplingAt(r, c);
    if (sapling) { takeSapling(sapling); return true; }

    const treat = pendingTreats.find(t => t.row === r && t.col === c);
    if (treat) { takeTreat(treat); return true; }

    return false;
  }

  function takePlant(taskId) {
    heldPlantVariety = gardenLayout[taskId].variety;
    heldPlantPot = gardenLayout[taskId].potColor || potColorFor(taskId);
    heldPlantGrown = !isSeedling(gardenLayout[taskId]);
    heldPlantWaters = gardenLayout[taskId].waterCount || 0;
    heldPlantId = taskId;
    gardenLayout[taskId].held = true;
    saveGardenLayout();
    renderShop();
    playPickupSound();
    renderGarden();
  }

  function takeDecoration(decor) {
    heldDecoration = decor;
    playPickupSound();
    renderGarden();
  }

  function takeLog(log) {
    heldLog = log;
    groundLogs = groundLogs.filter(l => l.id !== log.id);
    saveGroundLogs();
    playPickupSound();
    renderGarden();
  }

  function takeSapling(sapling) {
    heldSapling = { id: sapling.id };
    playPickupSound();
    renderGarden();
  }

  function takeTreat(treat) {
    heldTreat = { id: treat.id };
    pendingTreats = pendingTreats.filter(t => t.id !== treat.id);
    playPickupSound();
    renderGarden();
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
    spendCoins(LENS_COST);
    hasLens = true;
    lensOn = true;
    saveLens();
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

  /* What is standing on this square, in plain words - or null if nothing is. */
  /* Plants, and nothing else. The glass used to name the flower bed, the dug
     soil, the mower, the fence - everything you walked past - which buried the
     one thing it is for. */
  function describeAt(row, col) {
    const plantId = findPlantAt(row, col);
    if (!plantId) return null;
    const pos = gardenLayout[plantId];
    if (isSeedling(pos)) return seedlingLabel(pos);
    const variety = W().plants[pos.variety] || W().plants[0];
    return variety.name;
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

  /* ------------------------------------------------------------------ */
  /* Ground dressing                                                      */
  /* None of this is interactive - it exists so a section reads as a      */
  /* place rather than a checkerboard.                                    */
  /* ------------------------------------------------------------------ */

  function detail(theme, world) {
    const d = (world || W()).themeDetail || {};
    return d[theme] || d.grass ||
      { tuft: '#7cb86f', tuft2: '#57964e', pebble: '#c4cbbd', path: '#cdb68c', patch: '#cbe4c3', edge: '#b9a179' };
  }

  /* Tufts and pebbles, scattered from the tile's own hash so they stay put
     between renders. Sparse on purpose - this is texture, not decoration. */
  function scatterHtml(bandIndex, theme, world) {
    const d = detail(theme, world);
    let out = '';
    for (let r = 0; r < SECTION_ROWS; r++) {
      for (let c = 0; c < GARDEN_COLS; c++) {
        const h = tileHash(bandIndex * SECTION_ROWS + r, c, 7);
        const kind = h % 10;
        const x = c * CELL_SIZE + 5 + (h >> 3) % (CELL_SIZE - 14);
        const y = r * CELL_SIZE + 8 + (h >> 7) % (CELL_SIZE - 16);
        if (kind === 0 || kind === 1) {
          out += `<span class="ground-tuft" style="left:${x}px;top:${y}px;">
            <i style="background:${d.tuft};height:4px;left:0;"></i>
            <i style="background:${d.tuft2};height:6px;left:2px;"></i>
            <i style="background:${d.tuft};height:3px;left:4px;"></i></span>`;
        } else if (kind === 2) {
          out += `<span class="ground-pebble" style="left:${x}px;top:${y}px;background:${d.pebble};"></span>`;
        } else if (kind === 3) {
          const size = 12 + (h >> 11) % 10;
          out += `<span class="ground-patch" style="left:${x - 4}px;top:${y - 4}px;width:${size}px;height:${Math.round(size * 0.7)}px;background:${d.patch};"></span>`;
        }
      }
    }
    return out;
  }

  /* A worn track down the middle, so the eye has somewhere to walk. Two tiles
     wide, between the beds, and it lines up from one section to the next. */
  function edgingHtml(theme, world) {
    const d = detail(theme, world);
    let stones = '';
    const stoneW = CELL_SIZE / 2;
    for (let c = 0; c < GARDEN_COLS * 2; c++) {
      const h = tileHash(c, 0, 31);
      stones += `<i style="left:${c * stoneW + 1}px;width:${stoneW - 3}px;background:${d.edge};height:${3 + h % 2}px;opacity:${0.55 + (h % 3) * 0.12};"></i>`;
    }
    return `<div class="ground-edging">${stones}</div>`;
  }

  function findFreeCellNearHero(avoidDirt) {
    for (let radius = 0; radius < GARDEN_COLS + SECTION_ROWS; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const r = heroPos.row + dr, c = heroPos.col + dc;
          if (r < 0 || r > gardenMaxUnlockedRow || c < 0 || c >= GARDEN_COLS) continue;
          if (cellOccupied(r, c)) continue;
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
        if (cellOccupied(r, c)) continue;
        return { row: r, col: c };
      }
    }
    /* No bare ground left at all - a bed will do, rather than lose the
       purchase. Null only when there is not one free square anywhere. */
    return findFreeCellAtTop();
  }

  function buyPet(type) {
    const def = W().pets[type];
    if (!def || coins < def.cost || ownedPets.length >= MAX_PETS) return;
    spendCoins(def.cost);
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
    spendCoins(UNLOCK_PET_COST);
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
    if (!def || def.retired || coins < def.cost) return;
    spendCoins(def.cost);
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
  /* Cash in whatever you are carrying. Only works on a plant in your hands,
     which means you have already picked it deliberately. */
  function sellHeldPlant() {
    if (heldPlantId == null) return;
    const value = heldPlantGrown ? PLANT_VALUE : SEEDLING_VALUE;
    earnCoins(value);
    /* Cashing in is the one thing that really removes a plant. */
    delete gardenLayout[heldPlantId];
    heldPlantId = null;
    heldPlantVariety = null;
    heldPlantPot = null;
    heldPlantGrown = true;
    heldPlantWaters = 0;
    saveGardenLayout();
    renderGarden();
    positionHero();
    showThought('+' + value + (value === 1 ? ' coin' : ' coins'));
  }

  /* Said when there is nowhere left to stand anything. */
  function noRoomMessage() {
    return 'No room left - plant or cash one in first';
  }

  function buyPlant() {
    if (coins < PLANT_COST) return;
    /* Find the room before taking the coin. Buying with nowhere to stand used
       to spend the coin and lose the seedling. */
    const cell = findPottingSpot();
    if (!cell) {
      showThought(noRoomMessage());
      renderShop();
      return;
    }
    spendCoins(PLANT_COST);
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
    const cell = findFreeCellAtTop();
    if (!cell) {
      showThought(noRoomMessage());
      renderShop();
      return;
    }
    spendCoins(SAPLING_COST);
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

  /* One bowl of food, good for any companion. It lands beside you; pick it up
     and walk it over to whichever animal you want to win over. */
  function buyFood() {
    const def = W().food;
    if (!ownedPets.length || !def || coins < def.cost) return;
    const cell = findFreeCellNearHero() || findFreeCellAtTop();
    if (!cell) {
      showThought(noRoomMessage());
      renderShop();
      return;
    }
    spendCoins(def.cost);
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
      const all = plantIds().map(id => gardenLayout[id]);
      const growing = all.filter(isSeedling).length;
      const grown = all.length - growing;
      const kinds = foundTally();
      const tally = grown + ' ' + (grown === 1 ? terms().plant : terms().plants)
        + (growing ? ', ' + growing + ' still growing' : '')
        + ' \u00b7 found ' + kinds.found + ' of ' + kinds.total + ' kinds';
      const holding = heldPlantId != null;
      const value = heldPlantGrown ? PLANT_VALUE : SEEDLING_VALUE;
      const noRoom = !findPottingSpot();
      plantsWrap.innerHTML =
        `<div class="shop-info">Growing: ${Util.escapeHtml(tally)}${noRoom ? ' - no room for another' : ''}</div>
         <div class="shop-grid">
           <button class="shop-tile" ${(coins < PLANT_COST || noRoom) ? 'disabled' : ''} onclick="buyPlant()"
             title="${noRoom ? 'The garden is full - plant or cash one in to make room' : ''}">
             <span class="shop-tile-icon">\u{1F331}</span>
             <span class="shop-tile-label">Seedling</span>
             <span class="shop-tile-action">${coinSVG()}${PLANT_COST}</span>
           </button>
           <button class="shop-tile" ${(coins < SAPLING_COST || !findFreeCellAtTop()) ? 'disabled' : ''} onclick="buySapling()">
             <span class="shop-tile-icon">\u{1F331}</span>
             <span class="shop-tile-label">${Util.escapeHtml(cap(terms().sprout))} (water 5x to grow)</span>
             <span class="shop-tile-action">${coinSVG()}${SAPLING_COST}</span>
           </button>
           <button class="shop-tile ${holding ? 'sell' : ''}" ${holding ? '' : 'disabled'} onclick="sellHeldPlant()"
             title="${holding ? 'Cash in what you are carrying' : 'Pick a ' + terms().plant + ' up first, then cash it in here'}">
             <span class="shop-tile-icon">\u{1F4B0}</span>
             <span class="shop-tile-label">${holding ? 'Cash in what you are holding' : 'Cash in a ' + Util.escapeHtml(terms().plant)}</span>
             <span class="shop-tile-action">${holding ? '+' + coinSVG() + value : 'seedling 1, grown 2'}</span>
           </button>
         </div>`;
    }

    const itemsWrap = document.getElementById('shop-items');
    if (itemsWrap) {
      const tiles = Object.entries(W().items).filter(([, def]) => !def.retired).map(([kind, def]) => `
        <button class="shop-tile" ${coins < def.cost ? 'disabled' : ''} onclick="buyItem('${kind}')">
          <span class="shop-tile-icon">${def.icon}</span>
          <span class="shop-tile-label">${Util.escapeHtml(def.label)}</span>
          <span class="shop-tile-action">${coinSVG()}${def.cost}</span>
        </button>`).join('') +
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
            </button>`);
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
  /* ------------------------------------------------------------------ */
  /* Ambient life                                                         */
  /* Butterflies (fish in the ocean) that wander the plot and hang about over  */
  /* the flowers. How many there are follows how much is planted - an empty    */
  /* plot gets none. Driven frame by frame from JavaScript so a redraw, or     */
  /* picking a plant up, never interrupts them.                               */
  /* ------------------------------------------------------------------ */

  let ambientTimer = null;
  let ambientFrame = null;
  let ambientLast = 0;
  let ambientFlyers = [];

  function ambientArt(world) {
    const ocean = (world || W()).id === 'ocean';
    const wings = ocean
      ? ['#8fd6e8', '#f2b8a0', '#c9e8a0']
      : ['#f2c94c', '#f2a0c4', '#a0c8f2'];
    const c = wings[Math.floor(Math.random() * wings.length)];
    if (ocean) {
      /* a small fish */
      return `<svg viewBox="0 0 12 8" width="12" height="8" shape-rendering="crispEdges">
        <rect x="3" y="2" width="6" height="4" fill="${c}"/>
        <rect x="0" y="3" width="3" height="2" fill="${c}"/>
        <rect x="7" y="3" width="1" height="1" fill="#3a4a5a"/></svg>`;
    }
    return `<svg viewBox="0 0 12 8" width="12" height="8" shape-rendering="crispEdges">
      <rect x="1" y="1" width="4" height="3" fill="${c}"/>
      <rect x="7" y="1" width="4" height="3" fill="${c}"/>
      <rect x="1" y="4" width="4" height="2" fill="${c}" opacity="0.75"/>
      <rect x="7" y="4" width="4" height="2" fill="${c}" opacity="0.75"/>
      <rect x="5" y="2" width="2" height="4" fill="#5a4a35"/></svg>`;
  }

  /* How many the garden deserves. An empty plot gets none at all; the fuller
     it is the more there are, capped so it never becomes a swarm. */
  function ambientTarget() {
    const plants = plantIds().length;
    if (plants > 15) return 3;
    if (plants > 10) return 2;
    if (plants > 5) return 1;
    return 0;
  }

  /* Every plant's middle, in pixels. Grown ones are the real draw - a seedling
     is worth a passing look but not a long hover. */
  function ambientFlowers() {
    const out = [];
    plantIds().forEach(id => {
      const p = gardenLayout[id];
      if (!p || p.row == null || p.row > gardenMaxUnlockedRow) return;
      out.push({
        x: p.col * CELL_SIZE + CELL_SIZE / 2,
        y: p.row * CELL_SIZE + CELL_SIZE * 0.35,
        grown: !isSeedling(p)
      });
    });
    return out;
  }

  function ambientBounds() {
    return {
      w: GARDEN_COLS * CELL_SIZE,
      h: (gardenMaxUnlockedRow + 1) * CELL_SIZE
    };
  }

  /* Somewhere to head next: usually a flower to hang about over, now and then
     a random spot, so they wander instead of commuting. */
  function ambientPickTarget(f) {
    const b = ambientBounds();
    const flowers = ambientFlowers();
    const grown = flowers.filter(p => p.grown);
    const pool = grown.length ? grown : flowers;
    f.age = 0;

    /* With nothing planted there is nowhere to be, so they simply drift. */
    if (!pool.length) {
      f.tx = 8 + Math.random() * Math.max(8, b.w - 16);
      f.ty = 6 + Math.random() * Math.max(8, b.h - 12);
      f.hover = 300 + Math.random() * 700;
      return;
    }

    /* Otherwise it is always a flower. Most moves are a short hop around the
       one they are already on; now and then they cross to another. Nothing
       sends them off wandering the empty grass. */
    const stay = f.flower && Math.random() < 0.6 ? f.flower : pool[Math.floor(Math.random() * pool.length)];
    f.flower = stay;
    const close = Math.random() < 0.55;
    const spread = close ? 7 : 13;
    f.tx = stay.x + (Math.random() * spread * 2 - spread);
    f.ty = stay.y + (Math.random() * spread * 1.6 - spread * 1.2);
    f.hover = close ? (500 + Math.random() * 1100) : (1600 + Math.random() * 2600);
  }

  function spawnAmbient() {
    const layer = effects();
    if (!layer) return null;
    const b = ambientBounds();
    const el = document.createElement('div');
    el.className = 'garden-ambient';
    el.innerHTML = ambientArt();
    layer.appendChild(el);

    /* In from whichever edge the dice pick, rather than always the left. */
    const side = Math.floor(Math.random() * 4);
    const f = {
      el: el,
      x: side === 0 ? -18 : side === 1 ? b.w + 18 : Math.random() * b.w,
      y: side === 2 ? -16 : side === 3 ? b.h + 16 : Math.random() * b.h,
      vx: 0,
      vy: 0,
      tx: 0,
      ty: 0,
      hover: 0,
      age: 0,
      flower: null,
      dir: Math.random() < 0.5 ? -1 : 1,
      /* Deliberately unhurried - a butterfly that crosses a bed in a second
         reads as a bug, not a butterfly. */
      speed: 0.34 + Math.random() * 0.26,
      phase: Math.random() * Math.PI * 2,
      life: 40000 + Math.random() * 50000
    };
    ambientPickTarget(f);
    ambientFlyers.push(f);
    return f;
  }

  /* One frame of drifting. Positions live in JavaScript rather than in a CSS
     animation, which is the whole point: renderGarden re-appends the effects
     layer, and a running CSS animation restarts when its element moves in the
     DOM - so picking a plant up used to send every butterfly back to the edge. */
  function ambientStep(dt) {
    const b = ambientBounds();
    const ocean = W().id === 'ocean';
    const k = Math.min(3, dt / 16);

    for (let i = ambientFlyers.length - 1; i >= 0; i--) {
      const f = ambientFlyers[i];
      f.life -= dt;
      f.hover -= dt;
      f.age += dt;
      f.phase += 0.085 * k;

      let dx = f.tx - f.x;
      let dy = f.ty - f.y;
      const dist = Math.hypot(dx, dy) || 0.001;

      /* Close enough, and done hanging about - find the next flower. Also
         re-pick if a target has somehow stayed out of reach. */
      if ((dist < 9 && f.hover <= 0) || f.age > 9000) ambientPickTarget(f);

      const pull = dist < 14 ? 0.02 : 0.055;
      f.vx += ((dx / dist) * pull * f.speed + Math.cos(f.phase * 1.7) * 0.05) * k;
      f.vy += ((dy / dist) * pull * f.speed + Math.sin(f.phase) * 0.06) * k;
      f.vx *= 0.94;
      f.vy *= 0.94;

      const max = 1.1 * f.speed;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > max) { f.vx = f.vx / sp * max; f.vy = f.vy / sp * max; }

      f.x += f.vx * k;
      f.y += f.vy * k;

      /* Never let one wander off and never come back. */
      f.x = Math.max(-30, Math.min(b.w + 30, f.x));
      f.y = Math.max(-26, Math.min(b.h + 26, f.y));

      if (Math.abs(f.vx) > 0.06) f.dir = f.vx < 0 ? -1 : 1;

      if (f.life <= 0) {
        if (f.el.parentElement) f.el.remove();
        ambientFlyers.splice(i, 1);
        continue;
      }

      /* The layer is rebuilt from time to time; put strays back in it. */
      if (!f.el.parentElement) {
        const layer = effects();
        if (layer) layer.appendChild(f.el); else continue;
      }

      const flap = ocean ? 1 : (0.62 + 0.38 * Math.abs(Math.sin(f.phase * 1.9)));
      f.el.style.opacity = f.life < 900 ? (f.life / 900).toFixed(2) : '0.9';
      f.el.style.transform =
        'translate(' + f.x.toFixed(1) + 'px, ' + f.y.toFixed(1) + 'px) ' +
        'scaleX(' + (f.dir * flap).toFixed(2) + ')';
    }
  }

  function ambientLoop(ts) {
    ambientFrame = requestAnimationFrame(ambientLoop);
    const dt = ambientLast ? Math.min(80, ts - ambientLast) : 16;
    ambientLast = ts;
    if (document.hidden || !ambientFlyers.length) return;
    ambientStep(dt);
  }

  function ambientReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function clearAmbient() {
    ambientFlyers.forEach(f => { if (f.el.parentElement) f.el.remove(); });
    ambientFlyers = [];
  }

  /* Keeps the population honest: tops up towards the target a few at a time,
     and quietly retires the extras when plants are sold off. */
  function ambientTick() {
    if (document.hidden) return;
    const plot = document.getElementById('garden-plot');
    if (!plot || !plot.offsetParent) return;      /* not on screen */
    if (ambientReducedMotion()) { clearAmbient(); return; }

    const target = ambientTarget();
    if (ambientFlyers.length > target) {
      for (let i = 0; i < ambientFlyers.length - target; i++) {
        if (ambientFlyers[i].life > 1200) ambientFlyers[i].life = 900;
      }
    } else if (ambientFlyers.length < target && Math.random() < 0.6) {
      spawnAmbient();
    }
  }

  function startAmbient() {
    if (ambientTimer) clearInterval(ambientTimer);
    ambientTimer = setInterval(ambientTick, 1600);
    if (ambientFrame == null) {
      ambientLast = 0;
      ambientFrame = requestAnimationFrame(ambientLoop);
    }
  }

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
        ${scatterHtml(i, info.theme)}
        ${i > 0 ? edgingHtml(info.theme) : ''}
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
    plantIds().forEach(id => {
      const pos = gardenLayout[id];
      const variety = W().plants[pos.variety] || W().plants[0];
      const potColor = pos.potColor || potColorFor(id);
      const planted = isOnDirt(pos.row, pos.col);
      const seedling = isSeedling(pos);
      const label = seedling ? seedlingLabel(pos) : variety.name;

      /* Two of the same variety side by side used to look like the same stamp
         twice. A small, fixed nudge and size difference per plant makes a group
         read as a clump. */
      /* Separate hashes per property: consecutive ids differ by one, so
         shifting the same hash gave whole runs of plants identical numbers. */
      const nudgeX = (hashStr(id + ':x') % 5) - 2;
      const scale = (0.93 + (hashStr(id + ':s') % 13) / 100).toFixed(2);
      /* Staggered so a bed does not sway in unison. */
      const delay = (hashStr(id + ':d') % 40) / 10;
      const swayClass = planted ? ' sways' : '';

      /* Halfway through its watering a seedling starts to look like what it
         will become, so the five waterings show progress rather than counting
         silently. */
      const half = seedling && (pos.waterCount || 0) >= Math.ceil(PLANT_WATERS_NEEDED / 2);
      let art;
      if (half) art = `<span class="half-grown">${W().plantSVG(variety, potColor, planted)}</span>`;
      else if (seedling) art = seedlingSVG(planted);
      else art = W().plantSVG(variety, potColor, planted);

      cellsHtml += `<div class="garden-cell${swayClass}" style="left:${pos.col * CELL_SIZE}px; top:${pos.row * CELL_SIZE}px; width:${CELL_SIZE}px; height:${CELL_SIZE}px; --sway-delay:${delay}s;" title="${Util.escapeHtml(label)}">
        <div class="sprite-shadow" style="transform:translateX(calc(-46% + ${nudgeX}px)) scaleX(${scale});"></div>
        <span class="plant-art" style="--nudge:${nudgeX}px; --scale:${scale}; transform:translateX(${nudgeX}px) scale(${scale});">${art}</span>
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

    /* Put the effects layer back on top - the same element, so anything mid
       animation carries on rather than restarting. */
    effects();

    heroPos.row = Math.min(heroPos.row, maxUnlockedRow);
    heroPos.col = Math.min(heroPos.col, GARDEN_COLS - 1);
    positionHero();

    renderCoins();

    document.getElementById('garden-gardener').innerHTML = heroSVG('down', getEquippedOutfit());

    const plantCount = plantIds().length;
    const t = terms();
    const plantWord = plantCount === 1 ? t.plant : t.plants;
    const tally = foundTally();
    const sentence = plantCount
      ? `${heroName()} is tending ${plantCount} ${plantWord} in ${t.place}.`
      : `${heroName()} has no ${t.plants} yet - finish a task to earn a coin, then buy one.`;
    document.getElementById('garden-status').innerHTML =
      Util.escapeHtml(sentence)
      + ` <span class="garden-found" title="Every kind you have grown at least once">`
      + `Found ${tally.found} of ${tally.total} ${Util.escapeHtml(t.plants)}.</span>`;
  }


  /* ---------- Help topics (worded around the current account name) ---------- */

  function helpTopics() {
    const who = heroName();
    const t = terms();
    return {
      cashin: { icon: '\u{1F4B0}', title: 'Cashing in', body: 'Changed your mind about a ' + t.plant + '? Pick it up, then use Cash in at the top of the shop. A seedling gives back the coin it cost; one you have grown is worth two.' },
      coins: { icon: coinSVG(), title: 'Coins and ' + t.plants, body: 'Every task you complete earns one gold coin. Coins buy ' + t.plants + ' from the shop - one coin each - and everything else in there: tools, ' + t.sprout + 's, creatures and outfits. Un-tick a task and its coin goes back.' },
      water: { icon: '\u{1F4A7}', title: 'Watering and growing', body: 'Everything you buy from the shop arrives as a seedling, and they all look the same. Put one down on dug soil or a bed, then move right up against it to water it - once a minute, five times - and it grows into whichever ' + t.plant + ' it was always going to be. Left in its pot it will never grow, however much you water it. Watering a grown ' + t.plant + ' is just for the pleasure of it, and earns no coins.' },
      pickup: { icon: '\u{270B}', title: 'Picking things up', body: 'Press E next to a ' + t.plant + ', tool, ' + t.log + ' or ' + t.sprout + ' to pick it up. Press E again to put it down somewhere empty - or use it, if it is a tool.' },
      axe: { icon: '\u{1FA93}', title: W().items.axe.label, body: 'Buy ' + (W().id === 'ocean' ? 'a coral saw' : 'an axe') + ' from the shop. While holding it, press E next to ' + t.chopTarget + ' to cut it down into ' + t.log + ' you can carry off.' },
      hoe: { icon: '\u{26CF}\u{FE0F}', title: W().items.hoe.label, body: 'Buy ' + (W().id === 'ocean' ? 'a sand rake' : 'a hoe') + ' from the shop. While holding it, press E to turn the tile ' + who + ' is on into ' + t.tilled + ' - no need to put it down first.' },
      shovel: { icon: W().items.shovel.icon, title: W().items.shovel.label, body: 'Buy ' + (W().id === 'ocean' ? 'a sand scoop' : 'a shovel') + '. While holding it, press E next to ' + t.digTarget + ' - ' + who + ' drops the tool and picks the thing up in one go, ready to carry elsewhere.' },
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
    loadFoundVarieties();
    creditGrownVarieties();
    loadHeroPos();
    loadMovableLayout();
    loadPurchasedItems();
    loadPets();
    loadLens();
    loadOutfits();
    loadChoppedTrees();
    loadGroundLogs();
    loadCabinSites();
    loadSaplings();
    loadGardenVisibility();
    loadDugTiles();
    loadAwardedCoins();
    loadCoinLedger();
    stateLoaded = true;
  }

  /* The keyboard hint is no use on a phone, so each device is told how it
     actually moves. */
  function moveHintText() {
    return isTouchDevice()
      ? 'Tap a square to walk there, or drag from yourself. Tap yourself to pick up or use.'
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
    startAmbient();
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
    if (ambientTimer) clearInterval(ambientTimer);
    ambientTimer = null;
    if (ambientFrame != null) cancelAnimationFrame(ambientFrame);
    ambientFrame = null;
    clearAmbient();
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
  window.sellHeldPlant = sellHeldPlant;
  window.toggleLens = toggleLens;
  window.unlockRandomPet = unlockRandomPet;
  window.showHelpTopic = showHelpTopic;
  window.handleGardenKeydown = handleGardenKeydown;
  window.handleGardenTouchStart = handleGardenTouchStart;
  window.handleGardenTouchMove = handleGardenTouchMove;
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
    __walkTo: (r, c, axis) => walkTo(r, c, axis),
    __heroPos: () => ({ row: heroPos.row, col: heroPos.col }),
    __setHero: (r, c) => { heroPos.row = r; heroPos.col = c; positionHero(); },
    __spawnAmbient: spawnAmbient,
    start: start,
    stop: stop,
    render: render,
    reskin: reskin,
    loadAll: loadAll,
    heroName: heroName,
    playCashSound: playCashSound,
    previewPlotHTML: previewPlotHTML,
    startPreviewLife: startPreviewLife,
    stopPreviewLife: stopPreviewLife,
    shortLabel: shortLabel,
    renderCoins: renderCoins,
    renderShop: renderShop
  };
})();
