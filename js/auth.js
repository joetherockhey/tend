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
  let view = 'signin';     // signin | signup | reset | inbox | newpassword | profiles | newprofile
  let busy = false;

  /* Where the confirmation email's link lands. Without this Supabase falls back
     to the project's Site URL, which was still localhost - so the link in the
     email opened a 404. The page has to be in the project's Redirect URLs too. */
  const CONFIRM_URL = new URL('confirmed.html', location.href).href;

  /* Carried between views: the address someone typed follows them to the reset
     or sign-in form, and the inbox screen names where the letter went. */
  let prefillEmail = '';
  let resendReadyAt = 0;
  let waving = false;      /* just signed out: the gardener says goodbye once */

  /* What the new account will look like. Set by the chooser, saved on the way in. */
  let pickedWorld = Worlds.DEFAULT_WORLD;
  let pickedHero = Worlds.DEFAULT_HERO;

  /* The gate is before anyone has signed in, so it cannot ask the account who
     its gardener is. It remembers the last one seen on this device instead,
     which on anyone's own phone is theirs. */
  const LOOK_KEY = 'tend:gate-look';
  function lastLook() {
    try { return JSON.parse(localStorage.getItem(LOOK_KEY)) || {}; } catch (e) { return {}; }
  }
  function rememberLook(world, hero) {
    try { localStorage.setItem(LOOK_KEY, JSON.stringify({ world, hero })); } catch (e) { /* private mode */ }
  }

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
      btn.onclick = () => {
        pickedWorld = btn.dataset.world;
        redrawChooser(host);
        say(pickedWorld === 'ocean' ? 'Fancy the reef instead? I swim, you know.' : "A garden it is. I'll fetch the watering can.");
      };
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
    drawSprite();
  }

  /* ========================= the gardener at the gate ========================= */

  /* Who stands at the gate: the one being picked while an account is made,
     otherwise whoever was last here. */
  function gateLook() {
    if (view === 'signup' || view === 'newprofile') return { world: pickedWorld, hero: pickedHero };
    const l = lastLook();
    return { world: l.world || Worlds.DEFAULT_WORLD, hero: l.hero || Worlds.DEFAULT_HERO };
  }

  function place() { return gateLook().world === 'ocean' ? 'reef' : 'garden'; }

  function lineFor() {
    if (view === 'signup') return "Make an account and I'll get your " + place() + ' started.';
    if (view === 'reset') return "Forgotten it? Happens to me with the shed key. I'll email you a link to pick a new one.";
    if (view === 'newpassword') return "Pick a new password and I'll let you back in.";
    if (view === 'inbox') return "I've sent a letter to " + prefillEmail + '. Tap the link inside, then come back here and sign in.';
    if (view === 'newprofile') return 'What should I call you?';
    if (view === 'profiles') return Store.localProfiles().length
      ? "Hello! Who's tending today?"
      : 'Hello! I look after the ' + place() + ". Make a profile and I'll get started.";
    if (waving) return 'See you soon. The ' + place() + ' will wait for you.';
    return 'Hello! I look after the ' + place() + ". Sign in, or make an account and I'll get started.";
  }

  function guideHTML() {
    return `<div class="gate-guide">
        <span class="gate-sprite" id="gate-sprite" aria-hidden="true"></span>
        <div class="gate-say">
          <p class="gate-bubble" id="gate-bubble" role="status" aria-live="polite">${Util.escapeHtml(lineFor())}</p>
          <div class="gate-fix" id="gate-fix"></div>
        </div>
      </div>`;
  }

  function drawSprite() {
    const host = document.getElementById('gate-sprite');
    if (!host) return;
    const l = gateLook();
    host.innerHTML = Worlds.heroSVG(l.world, l.hero, 'down');
  }

  /* The gardener's line changes. kind is '' | 'error' | 'success'. */
  function say(text, kind) {
    const b = document.getElementById('gate-bubble');
    if (!b) return;
    b.textContent = text;
    b.className = 'gate-bubble' + (kind ? ' ' + kind : '');
    const fix = document.getElementById('gate-fix');
    if (fix) fix.innerHTML = '';
  }

  /* One button under the bubble that gets past the problem it just described. */
  function offerFix(label, run) {
    const fix = document.getElementById('gate-fix');
    if (!fix) return;
    fix.innerHTML = `<button type="button" class="auth-link">${Util.escapeHtml(label)}</button>`;
    fix.firstChild.onclick = run;
  }

  function typedEmail() {
    const e = document.getElementById('auth-email');
    return e ? e.value.trim() : prefillEmail;
  }

  /* Changing view keeps whatever address was typed. */
  function go(next) { prefillEmail = typedEmail(); view = next; render(); }

  /* The field someone is on gets a word about what it is for. */
  function coachLine(id) {
    if (id === 'auth-name') return "That's the name I'll go by, and what friends see on your " + place() + '.';
    if (id === 'auth-email') return "That email is only for signing in and resetting your password. I won't send you anything else.";
    if (id === 'auth-password') return 'At least 8 characters. Something only you would guess.';
    return '';
  }
  function wireCoach() {
    const form = document.getElementById('auth-form');
    if (form) form.addEventListener('focusin', e => { const l = coachLine(e.target.id); if (l) say(l); });
  }

  async function resend() {
    const email = prefillEmail || typedEmail();
    if (!email) { say('Put your email in above first, then I can send it.', 'error'); return; }
    resendReadyAt = Date.now() + 60000;
    tickResend();
    const { error } = await Store.client().auth.resend({ type: 'signup', email, options: { emailRedirectTo: CONFIRM_URL } });
    if (error) { say(friendlyError(error), 'error'); return; }
    say('Sent another. The newest link is the one that works.', 'success');
  }

  /* Supabase allows one resend a minute, so the button counts down rather
     than failing when it is pressed early. */
  function tickResend() {
    const btn = document.getElementById('btn-resend');
    if (!btn) return;
    const left = Math.ceil((resendReadyAt - Date.now()) / 1000);
    btn.disabled = left > 0;
    btn.textContent = left > 0 ? 'Send it again in ' + left + 's' : 'Send it again';
    if (left > 0) setTimeout(tickResend, 1000);
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
    rememberLook(Store.prefs().world, Store.prefs().hero);
    hideGate();
    onReady();
  }

  async function enterLocal(profile) {
    const opened = await Store.open({ id: profile.id, name: profile.name, email: '' });
    applyChoiceIfNew(null, opened);
    rememberLook(Store.prefs().world, Store.prefs().hero);
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

    if (view === 'profiles') renderProfiles();
    else if (view === 'newprofile') renderNewProfile();
    else if (view === 'signup') renderSignup();
    else if (view === 'reset') renderReset();
    else if (view === 'inbox') renderInbox();
    else if (view === 'newpassword') renderNewPassword();
    else renderSignin();

    el.body.insertAdjacentHTML('afterbegin', guideHTML());
    drawSprite();
    waving = false;
    const em = document.getElementById('auth-email');
    if (em && prefillEmail && !em.value) em.value = prefillEmail;
  }

  /* Problems and good news come from the gardener; the box under the heading
     is left for "Signing in..." while something is on its way. */
  function message(kind, text) {
    if (kind === 'error' || kind === 'success') { say(text, kind); return; }
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
    document.getElementById('link-reset').onclick = () => go('reset');
    const su = document.getElementById('link-signup');
    if (su) su.onclick = () => go('signup');
  }

  async function submitSignin(e) {
    e.preventDefault();
    if (busy) return;
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    setBusy(true, 'Signing in...');
    const { data, error } = await Store.client().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      message('error', friendlyError(error));
      if (/email not confirmed/i.test(error.message || '')) { prefillEmail = email; offerFix('Send the letter again', resend); }
      else if (/invalid login credentials/i.test(error.message || '')) offerFix('Send me a reset link', () => go('reset'));
      return;
    }
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
    wireCoach();
    document.getElementById('link-signin').onclick = () => go('signin');
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
      options: {
        emailRedirectTo: CONFIRM_URL,
        data: { display_name: name, world: pickedWorld, hero: pickedHero }
      }
    });
    setBusy(false);
    if (error) {
      message('error', friendlyError(error));
      if (/already registered/i.test(error.message || '')) offerFix('Sign in instead', () => go('signin'));
      return;
    }

    /* With email confirmation switched on there is no session yet. The look
       just picked is remembered now, so it is them at the gate on the way back. */
    if (data.session && data.user) {
      await enterCloud(data.user);
    } else {
      rememberLook(pickedWorld, pickedHero);
      prefillEmail = email;
      resendReadyAt = Date.now() + 60000;
      view = 'inbox';
      render();
    }
  }

  /* ---- cloud: waiting on the confirmation email ---- */

  function renderInbox() {
    el.body.innerHTML = `
      <h2>Check your inbox</h2>
      <p class="auth-tagline">It can take a minute to arrive, and sometimes lands in spam or junk.
        Open the link on any device, then sign in here.</p>
      <div class="auth-form">
        <button type="button" class="auth-submit" id="btn-inbox-signin">I've confirmed, sign me in</button>
        <button type="button" class="auth-secondary" id="btn-resend">Send it again</button>
      </div>
      <div class="auth-alt">
        Wrong address? <button class="auth-link" id="link-signup">Start again</button>
      </div>`;
    document.getElementById('btn-inbox-signin').onclick = () => { view = 'signin'; render(); };
    document.getElementById('btn-resend').onclick = resend;
    document.getElementById('link-signup').onclick = () => { view = 'signup'; render(); };
    tickResend();
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
    document.getElementById('link-signin').onclick = () => go('signin');
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
    message('success', "Sent. Open the link on this device and I'll ask you for a new password.");
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
    if (/invalid login credentials/i.test(m)) return "That email and password didn't open the gate. Try again, or I can send you a reset link.";
    if (/email not confirmed/i.test(m)) return "You haven't opened my letter yet. Tap the link in the email I sent, then sign in.";
    if (/already registered/i.test(m)) return "There's already an account with that email. Sign in instead?";
    if (/rate limit|too many|security purposes/i.test(m)) return 'Too many tries at once. Give it a minute and try again.';
    if (/fetch|network/i.test(m)) return "I can't reach the server. Check your connection and try again.";
    return m;
  }

  /* ========================= account actions ========================= */

  async function signOut() {
    await Store.flush();
    waving = true;
    if (Store.isCloud()) {
      await Store.client().auth.signOut();
      /* onAuthStateChange shows the gate. */
    } else {
      Store.close();
      view = 'profiles';
      showGate();
    }
  }

  /* Deleting the account for real, not just emptying it. The one RPC removes
     the row in auth.users and every table cascades off it, so the tasks, the
     categories, the garden and the Friends entry go with it. Then the device
     forgets the account and the page reloads into the sign-in gate - a reload
     rather than showGate(), because nothing in memory should outlive an
     account that no longer exists. */
  async function deleteAccount() {
    const { error } = await Store.client().rpc('delete_my_account');
    if (error) {
      /* The one piece of cloud setup a site can be missing. Say which file to
         run rather than passing on the raw Postgres complaint. */
      if (/delete_my_account|schema cache|does not exist/i.test(error.message || '')) {
        throw new Error('Account deletion is not set up on this site yet - supabase/delete-account.sql has not been run.');
      }
      throw new Error(friendlyError(error));
    }
    Store.forgetAccountLocally();
    /* The session died with the row, so this usually errors. It is here to
       clear the token Supabase keeps in localStorage. */
    try { await Store.client().auth.signOut(); } catch (e) { /* expected */ }
    location.reload();
  }

  async function switchProfile() {
    await Store.flush();
    Store.close();
    view = Store.isCloud() ? 'signin' : 'profiles';
    showGate();
  }

  return { start, signOut, deleteAccount, switchProfile, brandMarkSVG };
})();
