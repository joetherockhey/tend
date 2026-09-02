/* ============================================================================
   Tend - auth.js
   ----------------------------------------------------------------------------
   The gate in front of the app.

   Cloud mode: email + password accounts via Supabase Auth.
   Local mode: a list of profiles kept on this device.

   Either way it ends the same: an account object is handed to Store.open()
   and then App.boot() takes over.
   ============================================================================ */

const Auth = (function () {
  'use strict';

  const CFG = window.TEND_CONFIG || {};
  let onReady = null;
  let view = 'signin';     // signin | signup | reset | profiles | newprofile
  let busy = false;

  /* What the new account will look like. Set by the chooser, saved on the way in. */
  let pickedWorld = Worlds.DEFAULT_WORLD;
  let pickedHero = Worlds.DEFAULT_HERO;

  /* The world chooser: two rows of choices and a live preview of the result. */
  function chooserHTML() {
    const worldBtns = Worlds.list().map(w =>
      `<button type="button" class="choice ${w.id === pickedWorld ? 'on' : ''}" data-world="${w.id}">
         <span class="choice-name">${Util.escapeHtml(w.label)}</span>
       </button>`).join('');

    const world = Worlds.get(pickedWorld);
    const heroBtns = ['male', 'female'].map(g =>
      `<button type="button" class="choice ${g === pickedHero ? 'on' : ''}" data-hero="${g}">
         <span class="choice-name">${Util.escapeHtml(world.heroLabels[g])}</span>
       </button>`).join('');

    return `
      <div class="chooser">
        <div class="chooser-row">
          <span class="chooser-label">World</span>
          <div class="choice-group" id="world-choices">${worldBtns}</div>
        </div>
        <div class="chooser-row">
          <span class="chooser-label">You</span>
          <div class="choice-group" id="hero-choices">${heroBtns}</div>
        </div>
        <div id="world-preview-slot">${Worlds.previewHTML(pickedWorld, pickedHero)}</div>
        <p class="chooser-blurb">${Util.escapeHtml(world.blurb)}</p>
      </div>`;
  }

  /* Rebinds after every redraw, since the preview markup is replaced wholesale. */
  function wireChooser(host) {
    const box = host.querySelector('.chooser');
    if (!box) return;
    box.querySelectorAll('[data-world]').forEach(btn => {
      btn.onclick = () => { pickedWorld = btn.dataset.world; redrawChooser(host); };
    });
    box.querySelectorAll('[data-hero]').forEach(btn => {
      btn.onclick = () => { pickedHero = btn.dataset.hero; redrawChooser(host); };
    });
  }

  function redrawChooser(host) {
    const box = host.querySelector('.chooser');
    if (!box) return;
    box.outerHTML = chooserHTML();
    wireChooser(host);
  }

  const el = {};

  function cache() {
    el.screen = document.getElementById('auth-screen');
    el.body = document.getElementById('auth-body');
    el.shell = document.getElementById('app-shell');
  }

  /* ========================= gate visibility ========================= */

  function showGate() {
    cache();
    el.screen.hidden = false;
    el.shell.hidden = true;
    document.body.classList.add('gated');
    render();
  }

  function hideGate() {
    cache();
    el.screen.hidden = true;
    el.shell.hidden = false;
    document.body.classList.remove('gated');
  }

  /* ========================= entry point ========================= */

  async function start(readyCallback) {
    onReady = readyCallback;
    cache();

    if (!Store.isCloud()) {
      view = 'profiles';
      /* Straight back into the profile used last time, if it still exists. */
      const last = Store.lastAccountId();
      const profiles = Store.localProfiles();
      const match = profiles.find(p => p.id === last);
      if (match) { await enterLocal(match); return; }
      showGate();
      return;
    }

    /* Cloud mode: load the client, then look for a live session. */
    try {
      await Store.init();
    } catch (err) {
      showGate();
      message('error', 'Could not load the sign-in library. Check your connection and reload.');
      return;
    }

    const client = Store.client();
    const { data } = await client.auth.getSession();
    if (data && data.session && data.session.user) {
      await enterCloud(data.session.user);
    } else {
      view = 'signin';
      showGate();
    }

    /* Keep the app and the session in step (token refresh, sign-out in
       another tab, arriving back from a password-reset link). */
    client.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_OUT') {
        Store.close();
        view = 'signin';
        showGate();
      } else if (event === 'PASSWORD_RECOVERY') {
        view = 'newpassword';
        showGate();
      }
    });
  }

  function displayNameFor(user) {
    const meta = user.user_metadata || {};
    if (meta.display_name) return meta.display_name;
    const email = user.email || '';
    const local = email.split('@')[0] || 'Me';
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  /* A brand new account starts in the world its owner picked; an existing one
     keeps whatever it already had.

     The second argument is what Store.open() returned. It matters: "this
     account has no world yet" is only true if the server was actually read.
     Sign in on a new device while the connection is down and the cache is
     empty, and an existing reef account looked brand new - so this wrote the
     chooser's default (garden) over it, marked the state dirty, and pushed
     that over their real world the moment the connection came back. Nothing in
     the app ever said what had happened; the reef just quietly became a garden,
     for them and for everyone looking at them in Friends. */
  function applyChoiceIfNew(meta, openResult) {
    const prefs = Store.prefs();
    if (prefs.world) return;                       /* an existing account keeps its own */
    if (openResult && openResult.fromCache) return; /* we never saw the server: assume nothing */
    const m = meta || {};
    prefs.world = m.world || pickedWorld;
    prefs.hero = m.hero || pickedHero;
    Store.savePrefs();
  }

  async function enterCloud(user) {
    const opened = await Store.open({ id: user.id, name: displayNameFor(user), email: user.email || '' });
    applyChoiceIfNew(user.user_metadata, opened);
    hideGate();
    onReady();
  }

  async function enterLocal(profile) {
    const opened = await Store.open({ id: profile.id, name: profile.name, email: '' });
    applyChoiceIfNew(null, opened);
    hideGate();
    onReady();
  }

  /* ========================= rendering ========================= */

  function brandMarkSVG() {
    return document.getElementById('brand-mark-template').innerHTML;
  }

  function render() {
    cache();
    if (!el.body) return;

    if (view === 'profiles') return renderProfiles();
    if (view === 'newprofile') return renderNewProfile();
    if (view === 'signup') return renderSignup();
    if (view === 'reset') return renderReset();
    if (view === 'newpassword') return renderNewPassword();
    return renderSignin();
  }

  function message(kind, text) {
    const box = document.getElementById('auth-msg');
    if (!box) return;
    box.className = 'auth-msg ' + (kind || '');
    box.textContent = text || '';
    if (!text) box.className = 'auth-msg';
  }

  function msgSlot() { return '<div class="auth-msg" id="auth-msg"></div>'; }

  /* ---- cloud: sign in ---- */

  function renderSignin() {
    el.body.innerHTML = `
      <h2>Sign in</h2>
      <form class="auth-form" id="auth-form" autocomplete="on">
        ${msgSlot()}
        <div>
          <label for="auth-email">Email</label>
          <input type="email" id="auth-email" autocomplete="email" required>
        </div>
        <div>
          <label for="auth-password">Password</label>
          <input type="password" id="auth-password" autocomplete="current-password" required>
        </div>
        <button type="submit" class="auth-submit">Sign in</button>
      </form>
      <div class="auth-alt">
        <button class="auth-link" id="link-reset">Forgot your password?</button>
        ${CFG.ALLOW_SIGNUP === false ? '' : '<br><br>No account yet? <button class="auth-link" id="link-signup">Create one</button>'}
      </div>`;

    document.getElementById('auth-form').addEventListener('submit', submitSignin);
    document.getElementById('link-reset').onclick = () => { view = 'reset'; render(); };
    const su = document.getElementById('link-signup');
    if (su) su.onclick = () => { view = 'signup'; render(); };
  }

  async function submitSignin(e) {
    e.preventDefault();
    if (busy) return;
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    setBusy(true, 'Signing in...');
    const { data, error } = await Store.client().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { message('error', friendlyError(error)); return; }
    await enterCloud(data.user);
  }

  /* ---- cloud: sign up ---- */

  function renderSignup() {
    el.body.innerHTML = `
      <h2>Create an account</h2>
      <form class="auth-form" id="auth-form">
        ${msgSlot()}
        <div>
          <label for="auth-name">Your name</label>
          <input type="text" id="auth-name" autocomplete="name" placeholder="What should the gardener be called?" required>
        </div>
        <div>
          <label for="auth-email">Email</label>
          <input type="email" id="auth-email" autocomplete="email" required>
        </div>
        <div>
          <label for="auth-password">Password</label>
          <input type="password" id="auth-password" autocomplete="new-password" minlength="8" required>
        </div>
        ${chooserHTML()}
        <button type="submit" class="auth-submit">Create account</button>
      </form>
      <div class="auth-alt">
        Already have an account? <button class="auth-link" id="link-signin">Sign in</button>
      </div>`;

    document.getElementById('auth-form').addEventListener('submit', submitSignup);
    wireChooser(el.body);
    document.getElementById('link-signin').onclick = () => { view = 'signin'; render(); };
  }

  async function submitSignup(e) {
    e.preventDefault();
    if (busy) return;
    const name = document.getElementById('auth-name').value.trim();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (password.length < 8) { message('error', 'Use at least 8 characters for your password.'); return; }

    setBusy(true, 'Creating your account...');
    const { data, error } = await Store.client().auth.signUp({
      email,
      password,
      options: { data: { display_name: name, world: pickedWorld, hero: pickedHero } }
    });
    setBusy(false);
    if (error) { message('error', friendlyError(error)); return; }

    /* With email confirmation switched on there is no session yet. */
    if (data.session && data.user) {
      await enterCloud(data.user);
    } else {
      view = 'signin';
      render();
      message('success', 'Account created. Check your email for the confirmation link, then sign in.');
    }
  }

  /* ---- cloud: password reset ---- */

  function renderReset() {
    el.body.innerHTML = `
      <h2>Reset your password</h2>
      <form class="auth-form" id="auth-form">
        ${msgSlot()}
        <div>
          <label for="auth-email">Email</label>
          <input type="email" id="auth-email" autocomplete="email" required>
        </div>
        <button type="submit" class="auth-submit">Send reset link</button>
      </form>
      <div class="auth-alt">
        <button class="auth-link" id="link-signin">Back to sign in</button>
      </div>`;
    document.getElementById('auth-form').addEventListener('submit', submitReset);
    document.getElementById('link-signin').onclick = () => { view = 'signin'; render(); };
  }

  async function submitReset(e) {
    e.preventDefault();
    if (busy) return;
    const email = document.getElementById('auth-email').value.trim();
    setBusy(true, 'Sending...');
    const { error } = await Store.client().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href.split('#')[0]
    });
    setBusy(false);
    if (error) { message('error', friendlyError(error)); return; }
    message('success', 'Reset link sent. Open it on this device and you will be asked for a new password.');
  }

  function renderNewPassword() {
    el.body.innerHTML = `
      <h2>Choose a new password</h2>
      <form class="auth-form" id="auth-form">
        ${msgSlot()}
        <div>
          <label for="auth-password">New password</label>
          <input type="password" id="auth-password" autocomplete="new-password" minlength="8" required>
        </div>
        <button type="submit" class="auth-submit">Save password</button>
      </form>`;
    document.getElementById('auth-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const password = document.getElementById('auth-password').value;
      if (password.length < 8) { message('error', 'Use at least 8 characters.'); return; }
      setBusy(true, 'Saving...');
      const { data, error } = await Store.client().auth.updateUser({ password });
      setBusy(false);
      if (error) { message('error', friendlyError(error)); return; }
      if (data && data.user) await enterCloud(data.user);
    });
  }

  /* ---- local mode: profiles on this device ---- */

  function renderProfiles() {
    const profiles = Store.localProfiles();

    const rows = profiles.map(p => {
      const count = Store.localProfileTicketCount(p.id);
      const color = Util.colorFor(p.id);
      return `
        <div class="profile-row">
          <button class="profile-pick" data-id="${Util.escapeHtml(p.id)}">
            <span class="profile-avatar" style="background:${color}">${Util.escapeHtml(Util.initials(p.name))}</span>
            <span>${Util.escapeHtml(p.name)}</span>
            <span class="profile-count">${count} task${count === 1 ? '' : 's'}</span>
          </button>
          <button class="profile-del" data-del="${Util.escapeHtml(p.id)}" title="Delete this profile and its data">&times;</button>
        </div>`;
    }).join('');

    el.body.innerHTML = `
      <h2>${profiles.length ? 'Choose a profile' : 'Welcome'}</h2>
      ${msgSlot()}
      ${profiles.length ? `<div class="profile-list">${rows}</div>` : '<p class="auth-tagline">Create a profile to get started. Everything you add is kept in this browser.</p>'}
      <button class="auth-submit" id="btn-new-profile">+ New profile</button>
      <div class="auth-mode-note">
        <strong>Local mode.</strong> Profiles live in this browser only, so they do not follow you to another device.
        Use <em>Export</em> in the account menu to back up or move a profile.
      </div>`;

    el.body.querySelectorAll('.profile-pick').forEach(btn => {
      btn.onclick = () => {
        const p = Store.localProfiles().find(x => x.id === btn.dataset.id);
        if (p) enterLocal(p);
      };
    });
    el.body.querySelectorAll('.profile-del').forEach(btn => {
      btn.onclick = () => {
        const p = Store.localProfiles().find(x => x.id === btn.dataset.del);
        if (!p) return;
        if (confirm(`Delete "${p.name}" and everything in it? This cannot be undone.`)) {
          Store.deleteLocalProfile(p.id);
          render();
        }
      };
    });
    document.getElementById('btn-new-profile').onclick = () => { view = 'newprofile'; render(); };
  }

  function renderNewProfile() {
    const first = !Store.localProfiles().length;
    el.body.innerHTML = `
      <h2>New profile</h2>
      <form class="auth-form" id="auth-form">
        ${msgSlot()}
        <div>
          <label for="auth-name">Name</label>
          <input type="text" id="auth-name" placeholder="Your name" required>
        </div>
        ${chooserHTML()}
        <button type="submit" class="auth-submit">Create profile</button>
      </form>
      ${first ? '' : '<div class="auth-alt"><button class="auth-link" id="link-back">Back to profiles</button></div>'}`;

    wireChooser(el.body);
    document.getElementById('auth-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const name = document.getElementById('auth-name').value.trim();
      if (!name) { message('error', 'Give the profile a name.'); return; }
      const p = Store.createLocalProfile(name);
      enterLocal(p);
    });
    const back = document.getElementById('link-back');
    if (back) back.onclick = () => { view = 'profiles'; render(); };
  }

  /* ========================= helpers ========================= */

  function setBusy(state, label) {
    busy = state;
    const btn = el.body.querySelector('.auth-submit');
    if (btn) {
      btn.disabled = state;
      if (state) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Working...'; }
      else if (btn.dataset.label) { btn.textContent = btn.dataset.label; }
    }
    if (state) message('info', label || 'Working...');
    else message('', '');
  }

  function friendlyError(error) {
    const m = (error && error.message) || 'Something went wrong.';
    if (/invalid login credentials/i.test(m)) return 'That email and password combination did not work.';
    if (/email not confirmed/i.test(m)) return 'Confirm your email address first - check your inbox for the link.';
    if (/already registered/i.test(m)) return 'There is already an account with that email. Try signing in.';
    if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
    if (/fetch|network/i.test(m)) return 'Could not reach the server. Check your connection.';
    return m;
  }

  /* ========================= account actions ========================= */

  async function signOut() {
    await Store.flush();
    if (Store.isCloud()) {
      await Store.client().auth.signOut();
      /* onAuthStateChange shows the gate. */
    } else {
      Store.close();
      view = 'profiles';
      showGate();
    }
  }

  async function switchProfile() {
    await Store.flush();
    Store.close();
    view = Store.isCloud() ? 'signin' : 'profiles';
    showGate();
  }

  return { start, signOut, switchProfile, brandMarkSVG };
})();
