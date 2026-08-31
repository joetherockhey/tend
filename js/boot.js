/* ============================================================================
   Tend - boot.js
   Fills in the branding from config, then hands over to the auth gate.
   ============================================================================ */

(function () {
  'use strict';

  const CFG = window.TEND_CONFIG || {};
  const NAME = CFG.APP_NAME || 'Tend';
  const TAGLINE = CFG.TAGLINE || 'Tasks that grow a garden.';

  function markHTML() {
    const tpl = document.getElementById('brand-mark-template');
    return tpl ? tpl.innerHTML : '';
  }

  document.title = NAME;

  const authBrand = document.getElementById('auth-brand');
  authBrand.innerHTML = markHTML() + '<span class="auth-brand-name">' + Util.escapeHtml(NAME) + '</span>';
  document.getElementById('auth-tagline').textContent = TAGLINE;

  const headerBrand = document.getElementById('header-brand');
  headerBrand.innerHTML = markHTML() + '<span class="brand-name">' + Util.escapeHtml(NAME) + '</span>';

  /* The mark is rendered twice, so the gradient needs a unique id in each copy
     or the second one can go blank in some browsers. */
  [authBrand, headerBrand].forEach(function (host, i) {
    const svg = host.querySelector('svg');
    if (!svg) return;
    const oldId = 'tend-mark-grad';
    const newId = oldId + '-' + i;
    svg.innerHTML = svg.innerHTML.split(oldId).join(newId);
  });

  window.addEventListener('error', function (e) {
    console.error('[Tend]', e.message, e.filename + ':' + e.lineno);
  });

  /* Register the service worker so Tend can be installed on a phone and opened
     with no connection. Only over http(s) - a page opened as a bare file has no
     origin to scope a worker to, and the single-file build has no sw.js beside
     it anyway. */
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    /* Whether this page was already under a worker's control tells us, later,
       whether a change of controller is a first install or a genuine update. */
    const hadController = !!navigator.serviceWorker.controller;

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        /* Registration can resolve with nothing when workers are unavailable
           or blocked, and there is then nothing to keep up to date. */
        if (!reg || typeof reg.update !== 'function') return;

        /* An app kept on a home screen is resumed rather than reloaded, so left
           to itself it can sit on an old version for days. Every time it comes
           back to the front it asks whether there is a newer one. */
        const check = function () {
          if (document.visibilityState !== 'visible') return;
          try {
            const r = reg.update();
            if (r && r.catch) r.catch(function () { /* offline: try again next time */ });
          } catch (e) { /* ignore */ }
        };
        document.addEventListener('visibilitychange', check);
        window.addEventListener('focus', check);
        window.addEventListener('pageshow', check);
        window.TEND_SW = reg;
      }).catch(function (err) {
        console.warn('[Tend] offline support unavailable:', err && err.message);
      });
    });

    /* A new worker has taken over, which means what is on screen came from the
       old one. Reload once so the code and the page agree. */
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloading) return;   /* first install: nothing stale to replace */
      reloading = true;
      location.reload();
    });
  }

  Auth.start(function () { App.boot(); });
})();
