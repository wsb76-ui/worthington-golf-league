const CACHE = 'wgl-v14'; // bumped 2026-07-17: first-run name picker, per-admin PINs + audit trail
const ASSETS = [
  '/worthington-golf-league/',
  '/worthington-golf-league/index.html',
  '/worthington-golf-league/manifest.json',
  '/worthington-golf-league/icon-192.png',
  '/worthington-golf-league/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only intercept same-origin requests — let cross-origin requests (GitHub API, etc.) pass through untouched
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
