// WGL BetaV2 · 2026-09-04 v5 — XSS fix: escHtml wraps on announcement body + all outing text fields + calendar event name/sub + team num; playoff bracket in standings; admin calendar generator; calEvents live merge; calendar dynamic; outing sheet dynamic; sc-modal dark mode; sc-add-nine-btn; view toggle CSS vars
const CACHE = 'wgl-betav2-v5';
const ASSETS = [
  '/worthington-golf-league/betav2/',
  '/worthington-golf-league/betav2/index.html',
  '/worthington-golf-league/betav2/sw.js',
  '/worthington-golf-league/betav2/manifest.json',
  '/worthington-golf-league/betav2/icon-192.png',
  '/worthington-golf-league/betav2/icon-512.png',
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
