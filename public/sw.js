/* LUMEN ATLAS — minimal app-shell service worker.
   Never caches API, private media, uploads or avatars. */
const CACHE = 'lumen-shell-v1';
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/media/') ||
    url.pathname.startsWith('/uploads/') ||
    url.pathname === '/sw.js'
  ) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        if (res.ok) caches.open(CACHE).then(cache => cache.put('/', res.clone()));
        return res;
      }).catch(() => caches.match('/'))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/') || url.pathname.endsWith('.png') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) caches.open(CACHE).then(cache => cache.put(req, res.clone()));
        return res;
      }))
    );
  }
});
