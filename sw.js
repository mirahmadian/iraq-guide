const CACHE = 'caravan-v5';
const STATIC = [
  './',
  'index.html',
  'data.js',
  'manifest.json',
  'app-icon.png',
  'hajj-logo.png',
  'fonts/fonts.css',
  'fonts/Vazirmatn-arabic.woff2',
  'fonts/Vazirmatn-latin.woff2',
  'fonts/Vazirmatn-latin-ext.woff2'
];

/* نصب: فایل‌های اصلی و فونت را cache می‌کنیم تا آفلاین هم کار کند */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

/* فعال‌سازی: cache قدیمی را پاک می‌کنیم و کنترل همه تب‌ها را می‌گیریم */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* fetch: network-first برای HTML و JS، cache-first برای بقیه */
self.addEventListener('fetch', e => {
  const url = e.request.url;
  const isCore = url.endsWith('index.html') || url.endsWith('data.js') ||
                 url.endsWith('/') || url.includes('iraq-guide/') && !url.includes('.');

  if (isCore || e.request.mode === 'navigate') {
    /* همیشه اول از شبکه بگیر، کش را آپدیت کن */
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  /* بقیه فایل‌ها: cache-first */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      });
    })
  );
});

/* به همه تب‌های باز بگو reload کن وقتی SW عوض شد */
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
