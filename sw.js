// WGL v19 · 2026-07-24 — must match the stamp at the top of index.html
const CACHE = 'wgl-v19'; // bumped 2026-07-24: one-tap outing sign-up + roster/guest picker
const ASSETS = [
  '/worthington-golf-league/',
  '/worthington-golf-league/index.html',
  '/worthington-golf-league/manifest.json',
  '/worthington-golf-league/icon-192.png',
  '/worthington-golf-league/icon-512.png',
  '/worthington-golf-league/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // NOTE: no skipWaiting here — the page shows a "New version" toast and the
  // user opts in. Tapping the toast sends SKIP_WAITING below.
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
  // Only intercept same-origin GETs — let cross-origin (GitHub API, Apps Script) pass through
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
