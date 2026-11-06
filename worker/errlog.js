/* خطاهای سرور (۵۰۰) در جدول errlog — مشترک بین hamyar-reviews و hamyar-team؛ نگهبان (guard.js) آن‌ها را می‌خواند و خبر می‌دهد.
   نشانی بدون پارامتر (توکن‌ها در پارامترند) و پیام کوتاه نگه داشته می‌شود؛ ۳۰ روز. */
export const ERRLOG = 'CREATE TABLE IF NOT EXISTS errlog (id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, src TEXT, method TEXT, path TEXT, msg TEXT)';
export async function logError(db, src, req, e) {
  try {
    await db.prepare(ERRLOG).run();
    const path = new URL(req.url).pathname.replace(/\b[0-9a-f]{32,}\b/g, '…').slice(0, 200);
    const msg = String(e && (e.stack || e.message) || e).replace(/\b[0-9a-f]{40,}\b/g, '…').slice(0, 600);
    await db.prepare('INSERT INTO errlog (ts, src, method, path, msg) VALUES (?, ?, ?, ?, ?)').bind(Date.now(), src, req.method, path, msg).run();
  } catch (x) {}
}
