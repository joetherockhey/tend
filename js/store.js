/* ============================================================================
   Tend - store.js
   ----------------------------------------------------------------------------
   One storage API for the whole app, with two interchangeable backends:

     LOCAL MODE  (config.js left blank)
       Named profiles created on the device. Everything lives in this browser's
       localStorage. No server, no signup.

     CLOUD MODE  (Supabase URL + anon key filled in)
       Real accounts. Tickets, categories and garden state live in Postgres,
       protected by row-level security, and follow the user to any device.
       localStorage is still written on every change and acts as an offline
       cache, so the app keeps working with no connection and pushes the
       backlog once it returns.

   Everything the rest of the app touches is synchronous and in memory.
   Talking to the network happens behind a debounced flush.
   ============================================================================ */

const Store = (function () {
  'use strict';

  const CFG = window.TEND_CONFIG || {};
  const CLOUD = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

  const LS_PROFILES = 'tend:profiles';
  const LS_LAST_ACCOUNT = 'tend:last-account';
  const FLUSH_DELAY_MS = 900;

  let client = null;          // supabase client, cloud mode only
  let account = null;         // { id, name, email }
  let status = CLOUD ? 'idle' : 'local';
  let statusListeners = [];

  /* ---- in-memory state for the open account ---- */
  let tickets = [];
  let categories = [];
  let prefs = {};
  let gardenBag = {};         // the key/value bag garden.js reads and writes

  /* ---- what we believe the server already has ---- */
  let snapshot = { tickets: {}, categories: {}, state: null };

  /* ---- dirty flags ---- */
  let dirty = { tickets: false, categories: false, state: false };
  let retryTimer = null;

  /* ---- live sync ---- */
  let channel = null;            // supabase realtime subscription
  let changeListeners = [];      // told when the server sent us newer data
  let liveTimer = null;          // debounce for incoming realtime events
  let pollTimer = null;          // fallback poll while the tab is on screen
  let refreshing = false;
  let liveHooked = false;
  const POLL_MS = 25000;

  /* Where the hero is standing belongs to the device you are standing on. If
     it synced, moving on the laptop would drag the phone's farmer around. */
  const DEVICE_LOCAL_KEYS = ['garden-hero-v5', 'garden-visible-v1'];

  function isDeviceLocal(key) {
    return DEVICE_LOCAL_KEYS.indexOf(key) !== -1;
  }

  /* The part of the garden bag that belongs to the account rather than to
     this particular browser. */
  function syncableBag() {
    const out = {};
    Object.keys(gardenBag).forEach(k => { if (!isDeviceLocal(k)) out[k] = gardenBag[k]; });
    return out;
  }

  /* ===================== merging the garden bag =====================
     app_state.garden is one JSON blob, pushed and pulled whole, so the last
     device to write wins the lot. That is right for where things are standing.
     It is wrong for what has been bought: a tab that had not yet seen a
     purchase - or a push that quietly failed and was followed by a pull - took
     the purchase back. Joe lost his coins that way once and his magnifying
     glass a second time.

     So the keys that record something owned are merged rather than replaced:
     owned on either side means owned. Everything else is still
     last-write-wins.

     A deliberate clear-out bumps RESET_GEN_KEY, and the side with the higher
     generation is then taken whole, merging starting again from there. Nothing
     bumps it today - the "reset the garden" purchase was taken out of the shop
     - but the guard stays, so any future clear-out is not quietly undone. */

  const RESET_GEN_KEY = 'garden-reset-v1';

  function parseJson(v, fallback) {
    try { const p = JSON.parse(v); return p === null ? fallback : p; } catch (e) { return fallback; }
  }

  /* Once true, always true. */
  function keepFlag(a, b) { return (a === '1' || b === '1') ? '1' : (a !== undefined ? a : b); }

  /* Only ever counts up. Two devices spending at once undercounts the spend,
     which leaves the user with coins rather than short of them. */
  function keepMax(a, b) {
    const x = Number(a), y = Number(b);
    return String(Math.max(isFinite(x) ? x : 0, isFinite(y) ? y : 0));
  }

  function unionOfList(a, b) {
    const out = [];
    [parseJson(a, []), parseJson(b, [])].forEach(list => {
      if (Array.isArray(list)) list.forEach(v => { if (out.indexOf(v) === -1) out.push(v); });
    });
    return JSON.stringify(out);
  }

  /* Union by id, and the fresher copy's own entry wins - so a pet keeps the
     position and friendship the newer side gave it. */
  function unionById(a, b) {
    const out = [];
    const seen = {};
    [parseJson(a, []), parseJson(b, [])].forEach(list => {
      if (!Array.isArray(list)) return;
      list.forEach(item => {
        if (!item || item.id === undefined || seen[item.id]) return;
        seen[item.id] = true;
        out.push(item);
      });
    });
    return JSON.stringify(out);
  }

  function unionOfOutfits(a, b) {
    const x = parseJson(a, {}) || {}, y = parseJson(b, {}) || {};
    const owned = [];
    [].concat(x.owned || [], y.owned || []).forEach(o => { if (owned.indexOf(o) === -1) owned.push(o); });
    if (!owned.length) owned.push('classic');
    return JSON.stringify({ owned: owned, equipped: x.equipped || y.equipped || 'classic' });
  }

  /* The plot itself is last-write-wins - where a plant stands is a fact only
     the device that moved it knows. But how far a seedling has come is not:
     watering only ever counts up, and a device with an older copy of the plot
     used to hand somebody their grown plant back as a seedling. So for a plant
     both sides know about, growth takes the better of the two. The fresher
     side still decides which plants exist, so cashing one in still removes it. */
  function mergePlots(a, b) {
    const fresh = parseJson(a, null), other = parseJson(b, null);
    if (!fresh || typeof fresh !== 'object') return b;
    if (!other || typeof other !== 'object') return a;

    const out = {};
    Object.keys(fresh).forEach(id => {
      const f = fresh[id], o = other[id];
      out[id] = f;
      if (!f || !o || typeof f !== 'object' || typeof o !== 'object') return;
      const waters = Math.max(Number(f.waterCount) || 0, Number(o.waterCount) || 0);
      /* grown is absent on plants from before seedlings existed, and absent
         means grown - so only an explicit false counts as "not yet". */
      const grown = (f.grown !== false) || (o.grown !== false);
      out[id] = Object.assign({}, f, { waterCount: waters, grown: grown });
    });
    return JSON.stringify(out);
  }

  const OWNED_KEYS = {
    'garden-layout-v5': mergePlots,
    'garden-found-v1': unionOfList,
    'garden-lens-v1': keepFlag,
    'garden-sections-v1': keepMax,
    'coins-spent-v1': keepMax,
    'coins-bonus-v1': keepMax,
    'garden-items-v1': unionById,
    'garden-pets-v1': unionById,
    'garden-chopped-v1': unionOfList,
    'garden-dug-v1': unionOfList,
    'garden-outfits-v1': unionOfOutfits
  };

  function resetGen(bag) {
    const n = Number(bag && bag[RESET_GEN_KEY]);
    return isFinite(n) ? n : 0;
  }

  /* 'fresh' wins on everything except what is owned, which is merged. */
  function mergeGardenBags(fresh, other) {
    fresh = fresh || {};
    other = other || {};
    const gf = resetGen(fresh), go = resetGen(other);

    /* A reset on one side is a deliberate clear-out; the newer one is taken as
       it stands, purchases and all. */
    if (go > gf) return Object.assign({}, other);
    if (gf > go) return Object.assign({}, fresh);

    const out = Object.assign({}, fresh);
    Object.keys(OWNED_KEYS).forEach(k => {
      const a = fresh[k], b = other[k];
      if (a === undefined && b === undefined) return;
      if (a === undefined) { out[k] = b; return; }
      if (b === undefined) { out[k] = a; return; }
      out[k] = OWNED_KEYS[k](a, b);
    });
    return out;
  }

  /* ========================= status plumbing ========================= */

  function setStatus(s) {
    if (status === s) return;
    status = s;
    statusListeners.forEach(fn => { try { fn(s); } catch (e) { /* ignore */ } });
  }

  function onStatus(fn) {
    statusListeners.push(fn);
    fn(status);
  }

  /* ========================= localStorage cache ========================= */

  function cacheKey(part) {
    return 'tend:cache:' + (account ? account.id : 'anon') + ':' + part;
  }

  function kvKey(key) {
    return 'tend:kv:' + (account ? account.id : 'anon') + ':' + key;
  }

  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* Storage full or blocked (private windows). Memory still holds the
         truth, and in cloud mode the server does too. */
    }
  }

  function writeCache() {
    if (!account) return;
    lsSet(cacheKey('tickets'), tickets);
    lsSet(cacheKey('categories'), categories);
    lsSet(cacheKey('prefs'), prefs);
    lsSet(cacheKey('snapshot'), snapshot);
    lsSet(cacheKey('dirty'), dirty);
  }

  function readCache() {
    tickets = lsGet(cacheKey('tickets'), []) || [];
    categories = lsGet(cacheKey('categories'), []) || [];
    prefs = lsGet(cacheKey('prefs'), {}) || {};
    snapshot = lsGet(cacheKey('snapshot'), { tickets: {}, categories: {}, state: null }) || { tickets: {}, categories: {}, state: null };
    const d = lsGet(cacheKey('dirty'), null);
    dirty = d && typeof d === 'object' ? d : { tickets: false, categories: false, state: false };

    /* The garden bag is stored as individual keys so garden.js can keep using
       a plain get/set interface. */
    gardenBag = {};
    const prefix = kvKey('');
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) gardenBag[k.slice(prefix.length)] = localStorage.getItem(k);
      }
    } catch (e) { /* ignore */ }
  }

  /* ========================= the garden key/value bag ========================= */

  const kv = {
    getItem: function (key) {
      const v = gardenBag[key];
      return v === undefined ? null : v;
    },
    setItem: function (key, value) {
      gardenBag[key] = String(value);
      lsRawSet(kvKey(key), String(value));
      if (!isDeviceLocal(key)) markDirty('state');
    },
    removeItem: function (key) {
      delete gardenBag[key];
      try { localStorage.removeItem(kvKey(key)); } catch (e) { /* ignore */ }
      if (!isDeviceLocal(key)) markDirty('state');
    }
  };

  function lsRawSet(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { /* ignore */ }
  }

  /* ========================= dirty tracking + flush ========================= */

  function markDirty(part) {
    dirty[part] = true;
    writeCache();
    if (CLOUD && account) {
      setStatus('saving');
      scheduleFlush();
    }
  }

  const scheduleFlush = Util.debounce(function () { flush(); }, FLUSH_DELAY_MS);

  function anyDirty() {
    return dirty.tickets || dirty.categories || dirty.state;
  }

  async function flush() {
    if (!CLOUD || !client || !account || !anyDirty()) {
      if (!anyDirty() && CLOUD) setStatus('idle');
      return;
    }
    try {
      if (dirty.tickets) await pushTickets();
      if (dirty.categories) await pushCategories();
      if (dirty.state) await pushState();
      writeCache();
      setStatus('idle');
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    } catch (err) {
      console.warn('[Tend] sync failed, will retry:', err && err.message ? err.message : err);
      setStatus('offline');
      if (!retryTimer) {
        retryTimer = setTimeout(() => { retryTimer = null; flush(); }, 15000);
      }
    }
  }

  /* ---- tickets: diff against the last confirmed push ---- */

  function ticketRow(t, index) {
    return {
      id: t.id,
      user_id: account.id,
      title: t.title || '',
      notes: t.notes || '',
      setting: t.setting || '',
      category: t.category || '',
      follow_up: !!t.followUp,
      priority: !!t.priority,
      archived: !!t.archived,
      due_date: Util.toIsoDate(t.dueDate),
      created_on: Util.toIsoDate(t.createdAt) || Util.todayStr(),
      completed_on: Util.toIsoDate(t.completedAt),
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
      sort_index: index
    };
  }

  function rowToTicket(r) {
    return {
      id: r.id,
      title: r.title || '',
      notes: r.notes || '',
      setting: r.setting || '',
      category: r.category || '',
      followUp: !!r.follow_up,
      priority: !!r.priority,
      archived: !!r.archived,
      dueDate: Util.toIsoDate(r.due_date),
      createdAt: Util.toIsoDate(r.created_on) || Util.todayStr(),
      completedAt: Util.toIsoDate(r.completed_on),
      subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
      _sort: r.sort_index == null ? 0 : r.sort_index
    };
  }

  async function pushTickets() {
    const rows = tickets.map(ticketRow);
    const changed = [];
    const nextSnap = {};

    rows.forEach(r => {
      const json = JSON.stringify(r);
      nextSnap[r.id] = json;
      if (snapshot.tickets[r.id] !== json) changed.push(r);
    });

    const removed = Object.keys(snapshot.tickets).filter(id => !nextSnap[id]);

    if (changed.length) {
      /* Chunked so a big import does not blow past request limits. */
      for (let i = 0; i < changed.length; i += 200) {
        const { error } = await client.from('tickets').upsert(changed.slice(i, i + 200));
        if (error) throw error;
      }
    }
    if (removed.length) {
      const { error } = await client.from('tickets').delete().in('id', removed).eq('user_id', account.id);
      if (error) throw error;
    }

    snapshot.tickets = nextSnap;
    dirty.tickets = false;
  }

  async function pushCategories() {
    const rows = categories.map((c, i) => ({
      id: c.id,
      user_id: account.id,
      name: c.name,
      color: c.color,
      sort_index: i
    }));
    const nextSnap = {};
    const changed = [];
    rows.forEach(r => {
      const json = JSON.stringify(r);
      nextSnap[r.id] = json;
      if (snapshot.categories[r.id] !== json) changed.push(r);
    });
    const removed = Object.keys(snapshot.categories).filter(id => !nextSnap[id]);

    if (changed.length) {
      const { error } = await client.from('categories').upsert(changed);
      if (error) throw error;
    }
    if (removed.length) {
      const { error } = await client.from('categories').delete().in('id', removed).eq('user_id', account.id);
      if (error) throw error;
    }
    snapshot.categories = nextSnap;
    dirty.categories = false;
  }

  async function pushState() {
    /* Read what is up there and fold its purchases in before overwriting it.
       The blob is last-write-wins, so a device that has not pulled lately would
       otherwise push somebody's magnifying glass away. */
    let garden = syncableBag();
    try {
      const { data } = await client.from('app_state').select('garden')
        .eq('user_id', account.id).maybeSingle();
      if (data && data.garden) {
        const merged = mergeGardenBags(garden, data.garden);
        if (JSON.stringify(merged) !== JSON.stringify(garden)) {
          garden = merged;
          /* Keep this device's own copy in step with what is being sent. */
          Object.keys(merged).forEach(k => { gardenBag[k] = merged[k]; });
          Object.keys(gardenBag).forEach(k => {
            if (!isDeviceLocal(k) && merged[k] === undefined) delete gardenBag[k];
          });
          mirrorGardenBag();
          /* The merge just changed what this device holds - a purchase or a
             kind of plant the other device knew about. Say so, or the repair
             sits in storage unseen until something else happens to redraw.
             refresh() cannot catch this one: it snapshots after the flush, by
             which time the merge has already happened on both sides. */
          announceChange();
        }
      }
    } catch (e) { /* if we cannot read it, push what we have */ }

    const row = {
      user_id: account.id,
      display_name: account.name || '',
      prefs: prefs,
      garden: garden,
      updated_at: new Date().toISOString()
    };
    const json = JSON.stringify({ display_name: row.display_name, prefs: row.prefs, garden: row.garden });
    if (snapshot.state === json) { dirty.state = false; return; }
    const { error } = await client.from('app_state').upsert(row);
    if (error) throw error;
    snapshot.state = json;
    dirty.state = false;
  }

  /* ---- pull ---- */

  async function pull() {
    const [tRes, cRes, sRes] = await Promise.all([
      client.from('tickets').select('*').eq('user_id', account.id),
      client.from('categories').select('*').eq('user_id', account.id),
      client.from('app_state').select('*').eq('user_id', account.id).maybeSingle()
    ]);
    if (tRes.error) throw tRes.error;
    if (cRes.error) throw cRes.error;
    if (sRes.error) throw sRes.error;

    tickets = (tRes.data || []).map(rowToTicket).sort((a, b) => a._sort - b._sort);
    tickets.forEach(t => { delete t._sort; });

    categories = (cRes.data || [])
      .slice()
      .sort((a, b) => (a.sort_index || 0) - (b.sort_index || 0))
      .map(r => ({ id: r.id, name: r.name, color: r.color }));

    const st = sRes.data;
    prefs = (st && st.prefs) || {};
    /* Keep this device's own keys - the server never had them. */
    const keepLocal = {};
    DEVICE_LOCAL_KEYS.forEach(k => { if (gardenBag[k] !== undefined) keepLocal[k] = gardenBag[k]; });

    const serverGarden = (st && st.garden) || {};
    const mineGarden = syncableBag();
    /* A flush that failed leaves changes here the server has never seen, so
       this copy is the fresher one; otherwise the server's is. Either way the
       purchases from both sides survive. */
    const unsent = dirty.state;
    const mergedGarden = unsent
      ? mergeGardenBags(mineGarden, serverGarden)
      : mergeGardenBags(serverGarden, mineGarden);
    /* If merging brought anything back that the server does not hold, it has to
       go up again - otherwise the repair only ever lives on this device. */
    const owesAPush = JSON.stringify(mergedGarden) !== JSON.stringify(serverGarden);

    gardenBag = Object.assign({}, mergedGarden, keepLocal);
    if (st && st.display_name) account.name = st.display_name;

    /* Rebuild the snapshot so the next flush only sends real changes. */
    snapshot = { tickets: {}, categories: {}, state: null };
    tickets.forEach((t, i) => { snapshot.tickets[t.id] = JSON.stringify(ticketRow(t, i)); });
    categories.forEach((c, i) => {
      snapshot.categories[c.id] = JSON.stringify({ id: c.id, user_id: account.id, name: c.name, color: c.color, sort_index: i });
    });
    /* The snapshot is what the server actually holds, so a merge that changed
       anything still reads as a difference and gets pushed. */
    snapshot.state = JSON.stringify({ display_name: account.name || '', prefs: prefs, garden: serverGarden });

    dirty = { tickets: false, categories: false, state: owesAPush };
    if (owesAPush && CLOUD && account) scheduleFlush();

    /* Mirror the pulled garden bag into localStorage for offline use. */
    mirrorGardenBag();
    writeCache();
  }

  function mirrorGardenBag() {
    const prefix = kvKey('');
    try {
      const stale = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(prefix) === 0 && !(k.slice(prefix.length) in gardenBag)) stale.push(k);
      }
      stale.forEach(k => localStorage.removeItem(k));
      Object.keys(gardenBag).forEach(k => localStorage.setItem(prefix + k, gardenBag[k]));
    } catch (e) { /* ignore */ }
  }

  /* ========================= live sync =========================
     Two devices, one account: whatever one of them changes should turn up on
     the other without anybody reloading. Supabase pushes the change over a
     websocket; if that never connects (realtime not enabled, a firewall, a
     sleeping phone) a quiet poll and a check on waking cover the same ground
     a little more slowly. */

  function onChange(fn) {
    changeListeners.push(fn);
    return function () { changeListeners = changeListeners.filter(f => f !== fn); };
  }

  function announceChange() {
    changeListeners.forEach(fn => { try { fn(); } catch (e) { console.warn('[Tend] change listener failed:', e); } });
  }

  /* Send anything of ours that is waiting, take everything of theirs, then
     tell the app to redraw. Safe to call as often as you like. */
  async function refresh() {
    if (!CLOUD || !client || !account || refreshing) return false;
    refreshing = true;
    try {
      if (anyDirty()) await flush();
      const before = JSON.stringify({ t: tickets, c: categories, p: prefs, g: syncableBag() });
      await pull();
      const after = JSON.stringify({ t: tickets, c: categories, p: prefs, g: syncableBag() });
      setStatus('idle');
      if (before !== after) { announceChange(); return true; }
      return false;
    } catch (err) {
      console.warn('[Tend] refresh failed:', err && err.message);
      setStatus('offline');
      return false;
    } finally {
      refreshing = false;
    }
  }

  const scheduleRefresh = function () {
    if (liveTimer) clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { liveTimer = null; refresh(); }, 400);
  };

  function startRealtime() {
    if (!CLOUD || !client || !account) return;
    stopRealtime();
    try {
      const filter = 'user_id=eq.' + account.id;
      channel = client.channel('tend-' + account.id);
      ['tickets', 'categories', 'app_state'].forEach(table => {
        channel.on('postgres_changes',
          { event: '*', schema: 'public', table: table, filter: filter },
          function () {
            /* Our own writes come straight back to us too. Rather than trying
               to time that out - which goes wrong the moment two devices are
               both busy - every event just triggers a refresh, and refresh only
               tells the app about it when the data genuinely differs. */
            scheduleRefresh();
          });
      });
      channel.subscribe(function (state) {
        if (state === 'SUBSCRIBED') console.info('[Tend] live sync on');
      });
    } catch (err) {
      console.warn('[Tend] live sync unavailable, falling back to polling:', err && err.message);
      channel = null;
    }
  }

  function stopRealtime() {
    if (channel && client) {
      try { client.removeChannel(channel); } catch (e) { /* ignore */ }
    }
    channel = null;
  }

  /* The belt and braces: check on waking, on coming back online, on returning
     to the tab, and every so often while the tab is actually being looked at.
     This alone is enough to keep a phone and a laptop in step. */
  function hookLiveFallbacks() {
    if (liveHooked || typeof document === 'undefined') return;
    liveHooked = true;

    const wake = function () {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', function () { refresh(); });
    window.addEventListener('pageshow', wake);

    pollTimer = setInterval(function () {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
  }

  /* ========================= other people's gardens =========================
     The Friends tab. `public.gardens` is a read-only view holding each
     account's name, world and plot and nothing else - see
     supabase/gardens.sql, which has to be run once before this returns
     anything. In local mode there is no server, so the profiles on this
     device stand in for it. */

  async function listGardens() {
    if (!CLOUD || !client) return localGardens();
    const { data, error } = await client
      .from('gardens')
      .select('user_id, display_name, world, hero, layout, sections, found, chopped, movables, items, saplings, logs, cabins, dug, pets, outfits, hero_pos')
      .order('display_name');
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.user_id,
      name: r.display_name || 'Gardener',
      isMe: !!(account && r.user_id === account.id),
      world: r.world || 'garden',
      hero: r.hero === 'female' ? 'female' : 'male',
      layout: safeParse(r.layout, {}),
      sections: Number(r.sections) || 1,
      found: safeParse(r.found, []),
      chopped: safeParse(r.chopped, []),
      movables: safeParse(r.movables, {}),
      items: safeParse(r.items, []),
      saplings: safeParse(r.saplings, []),
      logs: safeParse(r.logs, []),
      cabins: safeParse(r.cabins, []),
      dug: safeParse(r.dug, []),
      pets: safeParse(r.pets, []),
      outfits: safeParse(r.outfits, {}),
      heroPos: safeParse(r.hero_pos, null)
    }));
  }

  function safeParse(raw, fallback) {
    try { const v = JSON.parse(raw); return v === null ? fallback : v; } catch (e) { return fallback; }
  }

  /* Local mode: the profiles kept in this browser, read straight out of their
     own key/value bags. */
  function localGardens() {
    return localProfiles().map(prof => {
      const prefix = 'tend:kv:' + prof.id + ':';
      const get = k => { try { return localStorage.getItem(prefix + k); } catch (e) { return null; } };
      let prefsOfProfile = {};
      try { prefsOfProfile = JSON.parse(localStorage.getItem('tend:cache:' + prof.id + ':prefs')) || {}; } catch (e) { /* none yet */ }
      return {
        id: prof.id,
        name: prof.name || 'Gardener',
        isMe: !!(account && prof.id === account.id),
        world: prefsOfProfile.world || 'garden',
        hero: prefsOfProfile.hero === 'female' ? 'female' : 'male',
        layout: safeParse(get('garden-layout-v5'), {}),
        sections: Number(get('garden-sections-v1')) || 1,
        found: safeParse(get('garden-found-v1'), []),
        chopped: safeParse(get('garden-chopped-v1'), []),
        movables: safeParse(get('garden-movables-v1'), {}),
        items: safeParse(get('garden-items-v1'), []),
        saplings: safeParse(get('garden-saplings-v1'), []),
        logs: safeParse(get('garden-logs-v1'), []),
        cabins: safeParse(get('garden-cabins-v1'), []),
        dug: safeParse(get('garden-dug-v1'), []),
        pets: safeParse(get('garden-pets-v1'), []),
        outfits: safeParse(get('garden-outfits-v1'), {}),
        heroPos: safeParse(get('garden-hero-v5'), null)
      };
    });
  }

  /* ========================= opening an account ========================= */

  /* Cloud mode: called by auth.js with the signed-in user.
     Local mode: called with a device profile. */
  async function open(acct) {
    account = { id: acct.id, name: acct.name || '', email: acct.email || '' };
    lsSet(LS_LAST_ACCOUNT, account.id);

    readCache();                       /* instant paint from cache */

    if (!CLOUD) {
      seedDefaultsIfEmpty();
      normaliseTicketDates();
      setStatus('local');
      return { fromCache: false };
    }

    /* In cloud mode we do NOT seed defaults before pulling. Seeding first
       meant every fresh device invented five brand-new category ids and
       pushed them as extra rows, so the same names piled up on the server. */
    const hadPendingWrites = anyDirty();
    try {
      if (hadPendingWrites) {
        /* Offline edits made on this device win over the server copy. */
        await flush();
      }
      await pull();
      dedupeCategories();               /* heals accounts that already piled up */
      normaliseTicketDates();
      seedDefaultsIfEmpty();            /* only if the server genuinely has none */
      setStatus('idle');
      startRealtime();
      hookLiveFallbacks();
      return { fromCache: false };
    } catch (err) {
      console.warn('[Tend] could not reach the server, using the offline copy:', err && err.message);
      seedDefaultsIfEmpty();
      normaliseTicketDates();
      setStatus('offline');
      /* Still hook the wake-ups: the moment the connection is back we catch up. */
      startRealtime();
      hookLiveFallbacks();
      return { fromCache: true };
    }
  }

  function close() {
    scheduleFlush.flush();
    stopRealtime();
    if (liveTimer) { clearTimeout(liveTimer); liveTimer = null; }
    account = null;
    tickets = [];
    categories = [];
    prefs = {};
    gardenBag = {};
    snapshot = { tickets: {}, categories: {}, state: null };
    dirty = { tickets: false, categories: false, state: false };
  }

  const DEFAULT_CATEGORIES = [
    { name: 'Work', color: '#4a5bd4' },
    { name: 'Home', color: '#2a78d6' },
    { name: 'Health', color: '#0f9d6a' },
    { name: 'Money', color: '#eda100' },
    { name: 'Errands', color: '#e87ba4' },
    { name: 'Fun', color: '#8c52ff' }
  ];

  /* Collapse categories that share a name (case-insensitive), keeping the
     first one. Marking them dirty makes the next flush delete the extras
     server-side, so an account only ever needs to be cleaned up once. */
  function dedupeCategories() {
    if (!Array.isArray(categories) || categories.length < 2) return;
    const seen = new Map();
    const kept = [];
    categories.forEach(c => {
      const key = String(c.name || '').trim().toLowerCase();
      if (!key) return;
      if (seen.has(key)) return;
      seen.set(key, c);
      kept.push(c);
    });
    if (kept.length === categories.length) return;
    console.info('[Tend] merged ' + (categories.length - kept.length) + ' duplicate categories');
    categories = kept;
    if (CLOUD) markDirty('categories');
    else writeCache();
  }

  /* Dates that came in from an import or an older version can be shaped
     differently enough that the calendar never finds them. Straightened out
     once, on the way in, and saved back so it only ever happens once. */
  function normaliseTicketDates() {
    if (!Array.isArray(tickets) || !tickets.length) return;
    let changed = 0;
    tickets.forEach(t => {
      ['dueDate', 'createdAt', 'completedAt'].forEach(field => {
        const fixed = Util.toIsoDate(t[field]);
        if ((fixed || null) !== (t[field] || null)) { t[field] = fixed; changed++; }
      });
      if (!t.createdAt) { t.createdAt = Util.todayStr(); changed++; }
    });
    if (!changed) return;
    console.info('[Tend] tidied ' + changed + ' date(s) so the calendar can see them');
    if (CLOUD) markDirty('tickets');
    else writeCache();
  }

  /* Bumped whenever a category is added to the list above. An account that
     has not seen this version yet gets the new ones added; after that the
     marker stops it happening again, so deleting one makes it stay deleted. */
  const DEFAULTS_VERSION = 2;

  function seedDefaultsIfEmpty() {
    if (!Array.isArray(categories) || !categories.length) {
      categories = DEFAULT_CATEGORIES.map(c => ({ id: Util.uid(), name: c.name, color: c.color }));
      prefs.categoryDefaults = DEFAULTS_VERSION;
      if (CLOUD) { markDirty('categories'); markDirty('state'); }
      else writeCache();
      return;
    }
    topUpDefaultCategories();
  }

  /* An account created before a default existed never gets it, because seeding
     only ever ran on an empty list. This adds the ones it has not been offered,
     once. */
  function topUpDefaultCategories() {
    if ((prefs.categoryDefaults || 0) >= DEFAULTS_VERSION) return;
    const have = new Set(categories.map(c => String(c.name || '').trim().toLowerCase()));
    const missing = DEFAULT_CATEGORIES.filter(c => !have.has(c.name.toLowerCase()));
    prefs.categoryDefaults = DEFAULTS_VERSION;
    if (missing.length) {
      /* Added at the front, where the newest defaults belong. */
      categories = missing.map(c => ({ id: Util.uid(), name: c.name, color: c.color })).concat(categories);
      console.info('[Tend] added ' + missing.map(c => c.name).join(', ') + ' to your categories');
      if (CLOUD) markDirty('categories');
    }
    if (CLOUD) markDirty('state');
    else writeCache();
  }

  /* ========================= public data accessors ========================= */

  function saveTickets() {
    if (CLOUD) markDirty('tickets');
    else { writeCache(); }
  }

  function saveCategories() {
    if (CLOUD) markDirty('categories');
    else { writeCache(); }
  }

  function savePrefs() {
    if (CLOUD) markDirty('state');
    else { writeCache(); }
  }

  function setDisplayName(name) {
    if (!account) return;
    account.name = name;
    if (CLOUD) {
      markDirty('state');
    } else {
      const list = localProfiles();
      const p = list.find(x => x.id === account.id);
      if (p) { p.name = name; lsSet(LS_PROFILES, list); }
    }
  }

  /* ========================= local-mode profiles ========================= */

  function localProfiles() {
    const list = lsGet(LS_PROFILES, []);
    return Array.isArray(list) ? list : [];
  }

  function createLocalProfile(name) {
    const list = localProfiles();
    const p = { id: 'p-' + Util.uid(), name: String(name || 'Me').trim() || 'Me', createdAt: new Date().toISOString() };
    list.push(p);
    lsSet(LS_PROFILES, list);
    return p;
  }

  function deleteLocalProfile(id) {
    const list = localProfiles().filter(p => p.id !== id);
    lsSet(LS_PROFILES, list);
    /* Remove everything belonging to that profile. */
    try {
      const doomed = [];
      const a = 'tend:cache:' + id + ':';
      const b = 'tend:kv:' + id + ':';
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.indexOf(a) === 0 || k.indexOf(b) === 0)) doomed.push(k);
      }
      doomed.forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
  }

  function localProfileTicketCount(id) {
    const list = lsGet('tend:cache:' + id + ':tickets', []);
    return Array.isArray(list) ? list.length : 0;
  }

  function lastAccountId() {
    return lsGet(LS_LAST_ACCOUNT, null);
  }

  /* ========================= export / import ========================= */

  function exportData() {
    return {
      app: 'tend',
      version: 1,
      exportedAt: new Date().toISOString(),
      account: { name: account ? account.name : '', email: account ? account.email : '' },
      tickets: tickets,
      categories: categories,
      prefs: prefs,
      garden: gardenBag
    };
  }

  /* Replaces everything for the open account.
     Accepts a Tend export, a bare array of tasks, or the { tasks: [...] }
     shape used by the older single-file tracker this app grew out of. */
  function importData(data) {
    let list = null;
    if (Array.isArray(data)) list = data;
    else if (data && Array.isArray(data.tickets)) list = data.tickets;
    else if (data && Array.isArray(data.tasks)) list = data.tasks;
    if (!list) throw new Error('No tasks found in that file.');
    if (Array.isArray(data)) data = { tickets: list };

    tickets = list.map(t => ({
      id: t.id || Util.uid(),
      title: t.title || '',
      notes: t.notes || '',
      setting: t.setting || '',
      /* Older files from the work version used raisedBy / jiraNeeded. */
      category: t.category || t.raisedBy || '',
      followUp: !!(t.followUp || t.jiraNeeded),
      priority: !!t.priority,
      archived: !!t.archived,
      /* An imported file is the most likely source of an odd date shape. */
      dueDate: Util.toIsoDate(t.dueDate || t.due || null),
      createdAt: Util.toIsoDate(t.createdAt || t.created || null) || Util.todayStr(),
      completedAt: Util.toIsoDate(t.completedAt || t.completed || null),
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : []
    }));
    if (Array.isArray(data.categories) && data.categories.length) {
      categories = data.categories.map(c => ({
        id: c.id || Util.uid(),
        name: c.name,
        color: c.color || Util.colorFor(c.name)
      }));
    }
    /* Any category names the tasks mention but the file did not define get
       created, so nothing lands colourless. */
    const known = new Set(categories.map(c => c.name.toLowerCase()));
    tickets.forEach(t => {
      if (t.category && !known.has(t.category.toLowerCase())) {
        known.add(t.category.toLowerCase());
        categories.push({ id: Util.uid(), name: t.category, color: Util.colorFor(t.category) });
      }
    });

    if (data.prefs && typeof data.prefs === 'object') prefs = data.prefs;
    if (data.garden && typeof data.garden === 'object') {
      gardenBag = {};
      Object.keys(data.garden).forEach(k => { gardenBag[k] = String(data.garden[k]); });
      mirrorGardenBag();
    }
    if (CLOUD) {
      markDirty('tickets'); markDirty('categories'); markDirty('state');
    } else {
      writeCache();
    }
  }

  function eraseAccountData() {
    tickets = [];
    categories = [];
    prefs = {};
    gardenBag = {};
    try {
      const prefix = kvKey('');
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) doomed.push(k);
      }
      doomed.forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
    seedDefaultsIfEmpty();
    if (CLOUD) { markDirty('tickets'); markDirty('categories'); markDirty('state'); }
    else writeCache();
  }

  /* ========================= startup ========================= */

  /* Loads the Supabase client from a CDN, but only in cloud mode. */
  async function init() {
    if (!CLOUD) { setStatus('local'); return { cloud: false }; }
    const libUrl = CFG.SUPABASE_LIB_URL || 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
    const mod = await import(/* @vite-ignore */ libUrl);
    client = mod.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return { cloud: true };
  }

  /* Push anything outstanding before the tab goes away. */
  window.addEventListener('pagehide', function () {
    if (CLOUD && anyDirty()) { writeCache(); flush(); }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && CLOUD && anyDirty()) { writeCache(); flush(); }
  });
  window.addEventListener('online', function () {
    if (CLOUD && anyDirty()) flush();
  });

  return {
    /* mode + identity */
    init, open, close,
    isCloud: function () { return CLOUD; },
    mode: function () { return CLOUD ? 'cloud' : 'local'; },
    client: function () { return client; },
    account: function () { return account; },
    accountId: function () { return account ? account.id : null; },
    displayName: function () { return account ? account.name : ''; },
    email: function () { return account ? account.email : ''; },
    setDisplayName,
    config: CFG,

    /* data */
    tickets: function () { return tickets; },
    setTickets: function (list) { tickets = list; saveTickets(); },
    saveTickets,
    categories: function () { return categories; },
    saveCategories,
    prefs: function () { return prefs; },
    savePrefs,
    kv,

    /* sync */
    flush: function () { scheduleFlush.flush(); return flush(); },
    status: function () { return status; },
    onStatus,
    pull,
    refresh,
    onChange,

    /* local profiles */
    localProfiles, createLocalProfile, deleteLocalProfile, localProfileTicketCount, lastAccountId,

    /* other people's gardens */
    listGardens,

    /* backup */
    exportData, importData, eraseAccountData
  };
})();
