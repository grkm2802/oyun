/* Görev Mimarı — çevrimdışı çalışma (service worker).
   İlk ziyarette oyun dosyalarını önbelleğe alır; sonra internet olmasa da açılır.
   Sitenin kendi dosyaları: önce internetten (her zaman en yeni sürüm), internet yoksa önbellekten.
   Google Fonts: önce önbellekten (değişmezler), arka planda yenilenir.
   CACHE adı yayın betiği (scripts/build_site.py) tarafından her yayında değiştirilir. */
const CACHE = 'ma-%BUILD_ID%';
const CORE = [
  './', 'index.html', 'loader.js', 'firebase-config.js', 'site.webmanifest',
  'mission-game/css/style.css',
  'assets/favicon-32.png', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png',
  ...['icons', 'data', 'model', 'sim', 'viz', 'ui', 'workshop', 'tour', 'online'].flatMap((f) => [`mission-game/js/${f}.js`, `mission-game-en/js/${f}.js`]),
];

self.addEventListener('install', (e) => {
  // cache: 'reload' → tarayıcının HTTP önbelleğindeki eski kopyayı değil, sunucudaki yenisini al
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ma-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!own && !fonts) return;

  if (own) {
    // önce ağ: yayınlanan güncelleme ilk açılışta görünür; çevrimdışıysa önbellek
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req, { ignoreSearch: true }))
          || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
      }
    }));
    return;
  }

  // yazı tipleri: önce önbellek, arka planda yenile
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
