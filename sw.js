const CACHE = 'caravan-2.74';
const STATIC = [
  './',
  'index.html',
  'data.js',
  'version.js',
  'icons.js',
  'food.js',
  'map-viewer.js',
  'banner.js',
  'prayer.js',
  'besat.js',
  'reminder.js',
  'home.js',
  'emergency.js',
  'zyarat.js',
  'lost.js',
  'azan.js',
  'notice.js',
  'currency.js',
  'stay.js',
  'today.js',
  'guide.js',
  'reviews.js',
  'stats.js',
  'bale.js',
  'flight-def.js',
  'flight.js',
  'mgr.js',
  'rate.json',
  'rate-market.json',
  'besat-logo.png',
  'besat-emblem.png',
  'ins-logo.png',
  'manifest.json',
  'app-icon.png',
  'app-icon-192.png',
  'apple-touch-icon.png',
  'hajj-logo.png',
  'fonts/fonts.css',
  'fonts/Vazirmatn-arabic.woff2',
  'fonts/Vazirmatn-latin.woff2',
  'fonts/Vazirmatn-latin-ext.woff2',
  'fonts/Estedad-arabic.woff2',
  'fonts/Estedad-latin.woff2'
];

/* نصب: فایل‌های اصلی و فونت را cache می‌کنیم تا آفلاین هم کار کند */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

/* فعال‌سازی: cache قدیمی را پاک می‌کنیم و کنترل همه تب‌ها را می‌گیریم */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'flight-data').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* fetch:
   - پنل ادمین و فایل‌هایش هرگز cache نمی‌شوند (همیشه نسخه تازه؛ انتشار به‌هرحال اینترنت می‌خواهد)
   - کد برنامه (html/js/css/json): اول از شبکه، اگر اینترنت نبود از cache
   - بقیه (عکس، نقشه، فونت): اول از cache */
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin) return;
  const file = u.pathname.split('/').pop();
  if (file.startsWith('admin')) return;
  const isCode = req.mode === 'navigate' || file === '' || /\.(html|js|css|json)$/.test(file);

  if (isCode) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }))
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
  /* برنامه فهرست نقشه‌ها و تصاویر را می‌فرستد تا برای استفاده آفلاین از قبل ذخیره شوند */
  if (e.data && e.data.type === 'warm') e.waitUntil(warmCache(e.data.urls || []));
});

async function warmCache(urls) {
  const c = await caches.open(CACHE);
  for (const u of urls) {
    try {
      if (await c.match(u)) continue;
      const res = await fetch(u, { cache: 'no-cache' });
      if (res && res.ok) await c.put(u, res);
    } catch (_) {}
  }
}

/* ✈️ اعلان ساعت حرکت به فرودگاه: سرور (worker/flight.js) بدون محتوا بیدار می‌کند؛ متن از حافظه‌ی گوشی (flight.js) */
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let d = null;
    try { const r = await (await caches.open('flight-data')).match('flight.json'); d = r && await r.json(); } catch (_) {}
    const now = Date.now(), due = d && d.steps ? d.steps.filter(s => s.t <= now + 3 * 6e4) : [];
    const s = due[due.length - 1];
    await self.registration.showNotification(s ? s.title : '✈️ یادآوری حرکت به فرودگاه', {
      body: s ? s.body : 'برای دیدن ساعت حرکت، برنامه همیار کاروان را باز کنید.',
      icon: 'app-icon-192.png', badge: 'app-icon-192.png', lang: 'fa', dir: 'rtl', tag: 'flight-' + (s ? s.k : 'x'),
      requireInteraction: true, renotify: true, vibrate: [300, 150, 300, 150, 600], data: { url: './#flight' }
    });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => 'focus' in c);
    if (w) { if (/flight/.test(url)) w.postMessage('open-flight'); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
