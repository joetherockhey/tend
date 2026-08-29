/* ============================================================================
   Tend - boot.js
   Fills in the branding from config, then hands over to the auth gate.
   ============================================================================ */

(function () {
  'use strict';

  const CFG = window.TEND_CONFIG || {};
  const NAME = CFG.APP_NAME || 'Tend';
  const TAGLINE = CFG.TAGLINE || 'Tickets that grow a garden.';

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
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('[Tend] offline support unavailable:', err && err.message);
      });
    });
  }

  Auth.start(function () { App.boot(); });
})();
