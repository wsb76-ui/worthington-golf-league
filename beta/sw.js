// WGL Beta v17 · 2026-08-28 — GPS tab: tracer bar hidden behind button, scroll locked
const CACHE = 'wgl-beta-v17';
const ASSETS = [
  '/worthington-golf-league/beta/',
  '/worthington-golf-league/beta/index.html',
  '/worthington-golf-league/beta/sw.js',
  '/worthington-golf-league/beta/manifest.json',
  '/worthington-golf-league/beta/icon-192.png',
  '/worthington-golf-league/beta/icon-512.png',
  '/worthington-golf-league/manifest.json',
  '/worthington-golf-league/icon-192.png',
  '/worthington-golf-league/icon-512.png',
  '/worthington-golf-league/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
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
