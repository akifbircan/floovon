/* PWA: Chrome "Uygulama olarak yükle" kriteri için minimal service worker */
self.addEventListener('install', function () {
  self.skipWaiting();
});
self.addEventListener('activate', function () {
  self.clients.claim();
});
