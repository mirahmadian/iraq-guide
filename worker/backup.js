/* ══════════════════════════════════════════
   📦 بکاپ کامل برای نگه‌داری نزد مدیر اصلی (فقط مدیر اصلی؛ رمزگذاری و ZIP در مرورگر خود او انجام می‌شود)
   /admin/backup/list  فهرست دیتابیس‌ها، جدول‌ها، ساختار و تعداد ردیف‌ها
   /admin/backup/rows  ردیف‌های یک جدول، صفحه‌به‌صفحه (BLOB به base64)
   /admin/backup/src   ZIP کد برنامه از GitHub (با همان کلید GitHub مدیر)
   /admin/backup/done  ثبت زمان آخرین بکاپ (برای یادآوری هفتگی در گزارش روزانه‌ی بله)
══════════════════════════════════════════ */
const DBS = [['reviews', 'DB', 'hamyar-reviews'], ['hotels', 'HDB', 'hamyar-hotels'], ['media', 'MDB', 'hamyar-hotels-media'], ['backups', 'BKDB', 'hamyar-backups']];
const skip = t => /^(sqlite_|_cf_)/.test(t);
async function tablesOf(db) {
  return (await db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type = 'table' DESC, name").all()).results.filter(r => !skip(r.name) && !skip(r.tbl_name));
}
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };

export async function handleBackupAdmin(p, req, env, url, json, err, cors, repo) {
  if (!p.startsWith('/admin/backup/')) return null;
  if (p === '/admin/backup/list' && req.method === 'GET') {
    const out = [];
    for (const [k, bind, name] of DBS) {
      const db = env[bind]; if (!db) continue;
      const objs = await tablesOf(db), tables = [];
      for (const o of objs.filter(o => o.type === 'table')) {
        const n = (await db.prepare(`SELECT COUNT(*) AS n FROM "${o.name.replace(/"/g, '""')}"`).first()).n;
        tables.push({ t: o.name, sql: o.sql, n, blob: /\bBLOB\b/i.test(o.sql) });
      }
      out.push({ k, name, tables, extra: objs.filter(o => o.type !== 'table').map(o => o.sql) });
    }
    const last = await env.DB.prepare("SELECT v FROM config WHERE k = 'bk:local'").first();
    return json({ dbs: out, last: last ? +last.v : null });
  }
  if (p === '/admin/backup/rows' && req.method === 'GET') {
    const d = DBS.find(x => x[0] === url.searchParams.get('db')), db = d && env[d[1]];
    if (!db) return err('دیتابیس نامعتبر');
    const t = url.searchParams.get('t') || '';
    if (!(await tablesOf(db)).some(o => o.type === 'table' && o.name === t)) return err('جدول نامعتبر');
    const off = Math.max(0, +url.searchParams.get('off') || 0), lim = Math.min(2000, Math.max(1, +url.searchParams.get('lim') || 500));
    const q = `SELECT * FROM "${t.replace(/"/g, '""')}"`;
    let res;
    try { res = await db.prepare(q + ' ORDER BY rowid LIMIT ? OFFSET ?').bind(lim, off).all(); }
    catch (e) { res = await db.prepare(q + ' LIMIT ? OFFSET ?').bind(lim, off).all(); }
    const rows = res.results.map(r => {
      for (const c in r) {
        const v = r[c];
        if (v instanceof ArrayBuffer) r[c] = { $b: b64(new Uint8Array(v)) };
        else if (ArrayBuffer.isView(v)) r[c] = { $b: b64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
        else if (Array.isArray(v)) r[c] = { $b: b64(Uint8Array.from(v)) };
      }
      return r;
    });
    return json({ rows });
  }
  if (p === '/admin/backup/src' && req.method === 'GET') {
    const tok = (req.headers.get('Authorization') || '').replace(/^(token|Bearer)\s+/i, '').trim();
    const r = await fetch(`https://api.github.com/repos/${repo}/zipball/main`, { headers: { Authorization: 'token ' + tok, 'User-Agent': 'hamyar-reviews', Accept: 'application/vnd.github+json' } });
    if (!r.ok) return err('دریافت کد برنامه از GitHub ممکن نشد (' + r.status + ').', 502);
    return new Response(r.body, { headers: { 'Content-Type': 'application/zip', ...cors } });
  }
  if (p === '/admin/backup/done' && req.method === 'POST') {
    await env.DB.prepare("INSERT INTO config (k, v) VALUES ('bk:local', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(String(Date.now())).run();
    return json({ ok: true });
  }
  return null;
}
