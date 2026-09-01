/* ============================================================================
   Tend - sw.js (service worker)
   ----------------------------------------------------------------------------
   Makes Tend installable and usable with no connection.

   The strategy is NETWORK FIRST for the app's own files: when you are online you
   always get the current code, so a push is live for everyone on their next
   load. The cache is only the fallback for when the network is not there.

   That is the deliberate opposite of the usual cache-first advice. Cache-first
   is faster, but it means a bad version can pin itself in place on someone's
   phone, and there is no support desk here to talk them through clearing it.

   Nothing else is touched: requests to Supabase and to any CDN pass straight
   through, so your data is never served from a stale cache.
   ============================================================================ */

const VERSION = 'tend-v35';
const APP_SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/util.js',
  './js/qr.js',
  './js/worlds.js',
  './js/store.js',
  './js/garden.js',
  './js/app.js',
  './js/auth.js',
  './js/boot.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())   /* a missing file must not block install */
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  if (req.method !== 'GET') return;                       /* never cache writes */
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        /* Supabase, CDNs: straight through */

  event.respondWith(
    fetch(req)
      .then(res => {
        /* Keep the latest good copy of anything we serve. */
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then(cache => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit =>
          hit || caches.match('./index.html')             /* offline deep link */
        )
      )
  );
});
