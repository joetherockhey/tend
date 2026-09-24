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

  /* The loading picture (see index.html): the gardener, seen side-on while
     they walk and water and face-on for the dance, and the flower the
     seedling becomes - one of the fifty, a different one on each load.
     Always the garden farmer, whatever world was last here, since watering a
     seedling is a garden thing. The side sprite's own little can comes out,
     because they carry the big one; for the dance they put it down. */
  (function () {
    const flower = document.getElementById('tend-loading-flower');
    const side = document.getElementById('tend-loading-side');
    const front = document.getElementById('tend-loading-front');
    if (!flower || !side || !front) return;
    const plants = Worlds.get('garden').plants;
    flower.innerHTML = plants[Math.floor(Math.random() * plants.length)].plant;
    let hero = Worlds.DEFAULT_HERO;
    try { hero = (JSON.parse(localStorage.getItem('tend:gate-look')) || {}).hero || hero; } catch (e) { /* private mode */ }
    const fit = svg => svg.replace(/width="\d+" height="\d+"/, 'width="19" height="20"');
    const noCan = svg => svg.replace(/<rect[^>]*#8a8f98[^>]*\/>/g, '');
    const sideArt = noCan(fit(Worlds.heroSVG('garden', hero, 'right')));
    side.innerHTML = sideArt;
    const body = noCan(fit(Worlds.heroSVG('garden', hero, 'down')))
      .replace(/<rect x="(1|13)" y="10" width="2" height="\d" fill="#f2c48d"\/>/g, '');
    macarena(front, body, sideArt);
  })();

  /* The dance at the end of the loading scene is the Macarena, as near as
     nineteen pixels allow: right arm out, left arm out, palms up, hands to
     the opposite shoulders, behind the head, to the opposite hips, onto
     their own hips for the wiggle, then the quarter-turn hop - and round
     again until the app has loaded. The arms are drawn per pose over the
     sprite with its own arms taken out; the can is set down on the ground. */
  function macarena(host, body, sideArt) {
    const SKIN = '#f2c48d';
    const r = (x, y, w, h) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + SKIN + '"/>';
    /* L is the arm on the viewer's left - the gardener's right. */
    const ARMS = {
      L: { down: r(1, 10, 2, 5), out: r(-4, 10, 7, 2) + r(-4, 12, 2, 1), up: r(-4, 10, 7, 2) + r(-4, 9, 2, 1),
           cross: r(3, 11, 10, 2), head: r(1, 4, 2, 7) + r(3, 3, 2, 2), hip: r(3, 13, 10, 2), own: r(1, 10, 2, 3) + r(2, 13, 2, 2) },
      R: { down: r(13, 10, 2, 5), out: r(13, 10, 7, 2) + r(18, 12, 2, 1), up: r(13, 10, 7, 2) + r(18, 9, 2, 1),
           cross: r(3, 13, 10, 2), head: r(13, 4, 2, 7) + r(11, 3, 2, 2), hip: r(3, 15, 10, 1), own: r(13, 10, 2, 3) + r(12, 13, 2, 2) }
    };
    const CAN = '<g><rect x="17" y="16" width="4" height="4" fill="#b9bec6"/><rect x="21" y="17" width="2" height="1" fill="#a4aab3"/><rect x="18" y="15" width="2" height="1" fill="#a4aab3"/></g>';
    const STEPS = [
      ['out', 'down'], ['out', 'out'], ['up', 'out'], ['up', 'up'],
      ['cross', 'up'], ['cross', 'cross'], ['head', 'cross'], ['head', 'head'],
      ['hip', 'head'], ['hip', 'hip'],
      ['own', 'own', -1], ['own', 'own', 1], ['own', 'own', -1], ['own', 'own', 1],
      'hop'
    ];
    const pose = step => {
      if (step === 'hop') return CAN + '<g transform="translate(0,-3)">' + sideArt + '</g>';
      const art = body.replace('</svg>', ARMS.L[step[0]] + ARMS.R[step[1]] + '</svg>');
      return CAN + '<g transform="translate(' + (step[2] || 0) + ',0)">' + art + '</g>';
    };
    host.innerHTML = pose(['down', 'down']);
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0, timer = 0;
    /* In step with the CSS that turns them to face you (lg-front, 4.4s). */
    setTimeout(function () {
      timer = setInterval(function () {
        /* Sign-in has replaced the loading screen: stop dancing. */
        if (!document.body.contains(host)) { clearInterval(timer); return; }
        host.innerHTML = pose(STEPS[i++ % STEPS.length]);
      }, 380);
    }, 4400);
  }

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
