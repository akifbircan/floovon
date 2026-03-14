/* PWA: Chrome "Uygulama olarak yükle" kriteri için service worker.
   Fetch dinleyicisi yok; ağ istekleri tarayıcıda normal şekilde işlenir (dev ortamında "Failed to fetch" hatasını önler).
   Çiçek Sepeti: sayfa postMessage ile bildirim isteği gönderir; SW sistem bildirimi gösterir (mobil/arka plan güvenilir). */
self.addEventListener('install', function () {
  self.skipWaiting();
});
self.addEventListener('activate', function () {
  self.clients.claim();
});

self.addEventListener('message', function (event) {
  var d = event.data;
  if (!d || d.type !== 'ciceksepeti_show_notification') return;
  var title = d.title || 'Yeni Çiçek Sepeti siparişi';
  var body = d.body || '';
  var icon = d.icon || '/favicon.ico';
  var tag = (d.tag && String(d.tag)) || ('ciceksepeti-' + Date.now());
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: icon,
      tag: tag,
      requireInteraction: false
    })
  );
});
