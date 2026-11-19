// WGL v2. Scope is this folder only (/v2/ on GitHub Pages).
// Do not claim or cache anything outside that path — the live app has its own worker.
const CACHE = 'wgl-v2-1';

function scopePath() {
  return new URL('./', self.location).pathname;
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    new URL('./', self.location).href,
    new URL('./index.html', self.location).href,
    new URL('./css/app.css', self.location).href,
    new URL('./js/app.js', self.location).href,
    new URL('./manifest.json', self.location).href
  ]).catch(() => {})));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('wgl-v2-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const scope = scopePath();
  if (!url.pathname.startsWith(scope)) return;
  event.respondWith(
    fetch(event.request).then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return res;
    }).catch(() => caches.match(event.request))
  );
});
