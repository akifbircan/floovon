/* PWA: Chrome "Uygulama olarak yükle" kriteri için service worker.
   Fetch dinleyicisi yok; ağ istekleri tarayıcıda normal şekilde işlenir (dev ortamında "Failed to fetch" hatasını önler). */
self.addEventListener('install', function () {
  self.skipWaiting();
});
self.addEventListener('activate', function () {
  self.clients.claim();
});
