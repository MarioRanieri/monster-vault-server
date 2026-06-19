/**
 * Monster Vault — Service Worker (PWA)
 *
 * Strategia:
 *   - Cross-origin (foto Cloudinary, cdnjs, flagcdn): NON intercettate → vanno
 *     direttamente in rete. Intercettarle rompe le immagini cross-origin nella
 *     PWA installata (in particolare su iOS, che gestisce male le response opaque).
 *   - API same-origin (/api/**): Network-first → dati freschi, fallback cache offline.
 *   - Asset statici same-origin (/, /index.html, icone…): Cache-first con
 *     aggiornamento in background.
 *
 * Aggiorna CACHE_VERSION per forzare il rinnovo della cache su tutti i client.
 */

var CACHE_VERSION = 'mv-v19';
var STATIC_ASSETS = ['/', '/index.html', '/map.html', '/map-data.js', '/world-map.svg'];

// ── INSTALL: precache gli asset statici ──────────────────────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: elimina le vecchie versioni della cache ────────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(k) { return k !== CACHE_VERSION; })
          .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// ── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;

  var url;
  try { url = new URL(e.request.url); } catch (_) { return; }

  // SOLO same-origin: lascia che le risorse cross-origin (Cloudinary, cdnjs,
  // flagcdn) vengano caricate nativamente dal browser senza passare dal SW.
  if (url.origin !== self.location.origin) return;

  // API: Network-first (dati aggiornati con fallback cache per offline)
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then(function(response) {
          if (url.pathname === '/api/cans' && response.ok) {
            var clone = response.clone();
            caches.open(CACHE_VERSION).then(function(cache) { cache.put(e.request, clone); });
          }
          return response;
        })
        .catch(function() { return caches.match(e.request); })
    );
    return;
  }

  // HTML e script di pagina: NETWORK-FIRST → dopo un deploy la versione nuova si vede
  // al PRIMO caricamento (prima erano cache-first: serviva ricaricare due volte).
  // Il server è tenuto sempre sveglio (UptimeRobot) quindi la rete è sempre pronta;
  // la cache resta come fallback offline.
  var isPage = e.request.mode === 'navigate' || url.pathname === '/' ||
               url.pathname.endsWith('.html') || url.pathname.endsWith('.js');
  if (isPage) {
    e.respondWith(
      fetch(e.request)
        .then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_VERSION).then(function(cache) { cache.put(e.request, clone); });
          }
          return response;
        })
        .catch(function() { return caches.match(e.request); })
    );
    return;
  }

  // Asset statici same-origin: Cache-first con aggiornamento in background
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var networkFetch = fetch(e.request).then(function(response) {
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_VERSION).then(function(cache) { cache.put(e.request, clone); });
        }
        return response;
      }).catch(function() { return cached; });
      return cached || networkFetch;
    })
  );
});
