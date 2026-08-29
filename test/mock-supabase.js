/* ============================================================================
   Tend - test/mock-supabase.js
   ----------------------------------------------------------------------------
   A tiny stand-in for @supabase/supabase-js, used by the browser smoke test in
   test/smoke.js so the cloud code path can be exercised without a real
   project. It keeps its "database" in localStorage under mock-supabase:*, so a
   page reload behaves like a server that remembers.

   This file is NOT used by the app in normal operation. Point
   TEND_CONFIG.SUPABASE_LIB_URL at it only when you want a fake backend.
   ============================================================================ */

const DB_KEY = 'mock-supabase:db';
const SESSION_KEY = 'mock-supabase:session';

function loadDB() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || { users: [], tickets: [], categories: [], app_state: [] }; }
  catch (e) { return { users: [], tickets: [], categories: [], app_state: [] }; }
}
function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* A query builder that supports just the shapes store.js uses. */
function table(name) {
  const filters = [];
  const api = {
    select() { api._op = 'select'; return api; },
    eq(col, val) { filters.push([col, val]); return api; },
    in(col, vals) { filters.push([col, vals, 'in']); return api; },
    maybeSingle() { api._single = true; return api.then ? api : api; },
    async upsert(rows) {
      const db = loadDB();
      const list = Array.isArray(rows) ? rows : [rows];
      list.forEach(row => {
        const keyCols = name === 'app_state' ? ['user_id'] : ['id', 'user_id'];
        const i = db[name].findIndex(r => keyCols.every(k => r[k] === row[k]));
        if (i === -1) db[name].push(JSON.parse(JSON.stringify(row)));
        else db[name][i] = Object.assign({}, db[name][i], JSON.parse(JSON.stringify(row)));
      });
      saveDB(db);
      return { data: list, error: null };
    },
    delete() { api._op = 'delete'; return api; },
    then(resolve) {
      const db = loadDB();
      let rows = db[name].slice();
      filters.forEach(([col, val, kind]) => {
        rows = kind === 'in' ? rows.filter(r => val.includes(r[col])) : rows.filter(r => r[col] === val);
      });
      if (api._op === 'delete') {
        const doomed = new Set(rows.map(r => JSON.stringify(r)));
        db[name] = db[name].filter(r => !doomed.has(JSON.stringify(r)));
        saveDB(db);
        return resolve({ data: null, error: null });
      }
      return resolve({ data: api._single ? (rows[0] || null) : rows, error: null });
    }
  };
  return api;
}

export function createClient() {
  const listeners = [];

  function currentSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }

  return {
    auth: {
      async getSession() { return { data: { session: currentSession() }, error: null }; },

      async signUp({ email, password, options }) {
        const db = loadDB();
        if (db.users.some(u => u.email === email)) {
          return { data: null, error: { message: 'User already registered' } };
        }
        const user = {
          id: uuid(),
          email,
          password,
          user_metadata: { display_name: (options && options.data && options.data.display_name) || '' }
        };
        db.users.push(user);
        /* Mirrors the on_auth_user_created trigger in schema.sql. */
        db.app_state.push({ user_id: user.id, display_name: user.user_metadata.display_name, prefs: {}, garden: {} });
        saveDB(db);
        const session = { user: user };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return { data: { user, session }, error: null };
      },

      async signInWithPassword({ email, password }) {
        const db = loadDB();
        const user = db.users.find(u => u.email === email && u.password === password);
        if (!user) return { data: null, error: { message: 'Invalid login credentials' } };
        localStorage.setItem(SESSION_KEY, JSON.stringify({ user }));
        return { data: { user, session: { user } }, error: null };
      },

      async signOut() {
        localStorage.removeItem(SESSION_KEY);
        listeners.forEach(fn => fn('SIGNED_OUT', null));
        return { error: null };
      },

      async resetPasswordForEmail() { return { data: {}, error: null }; },
      async updateUser() { return { data: { user: (currentSession() || {}).user }, error: null }; },

      onAuthStateChange(fn) {
        listeners.push(fn);
        return { data: { subscription: { unsubscribe() {} } } };
      }
    },

    from: table,

    /* A stand-in for Supabase Realtime. Every tab of this origin shares the
       fake database in localStorage, and the browser fires a storage event in
       the OTHER tabs whenever one of them writes - which is close enough to a
       change arriving over a websocket to exercise the same code path. */
    channel(name) {
      const handlers = [];
      let onStorage = null;
      const chan = {
        name,
        on(type, opts, cb) { handlers.push(cb); return chan; },
        subscribe(cb) {
          onStorage = function (e) {
            if (e.key === DB_KEY) handlers.forEach(h => h({ eventType: 'UPDATE' }));
          };
          window.addEventListener('storage', onStorage);
          if (cb) cb('SUBSCRIBED');
          return chan;
        },
        _teardown() {
          if (onStorage) window.removeEventListener('storage', onStorage);
          onStorage = null;
        }
      };
      return chan;
    },

    removeChannel(chan) { if (chan && chan._teardown) chan._teardown(); }
  };
}
