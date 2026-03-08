/* PWA: Chrome "Uygulama olarak yükle" kriteri için service worker */
self.addEventListener('install', function () {
  self.skipWaiting();
});
self.addEventListener('activate', function () {
  self.clients.claim();
});
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
