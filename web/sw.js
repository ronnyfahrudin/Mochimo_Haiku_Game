/* Minimal service worker: cache the app shell; API always network-first. */
const SHELL = ['.', 'index.html', 'style.css', 'app.js', 'codec-client.js', 'manifest.webmanifest', 'icon.svg'];
const VER = 'vk-shell-v1';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.includes('/api/')) return; // network only
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
