/* Görev Mimarı — çevrimdışı çalışma (service worker).
   İlk ziyarette oyun dosyalarını önbelleğe alır; sonra internet olmasa da açılır.
   Her istekte önbellekten hemen yanıt verir, arka planda yeni sürümü indirir (stale-while-revalidate).
   CACHE adı yayın betiği (scripts/build_site.py) tarafından her yayında değiştirilir. */
const CACHE = 'ma-%BUILD_ID%';
const CORE = [
  './', 'index.html', 'loader.js', 'site.webmanifest',
  'mission-game/css/style.css',
  'assets/favicon-32.png', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png',
  ...['icons', 'data', 'model', 'sim', 'viz', 'ui'].flatMap((f) => [`mission-game/js/${f}.js`, `mission-game-en/js/${f}.js`]),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
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
  const allowed = url.origin === location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!allowed) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: url.origin === location.origin });
    const network = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => cached || (req.mode === 'navigate' ? cache.match('index.html') : undefined));
    return cached || network;
  }));
});
