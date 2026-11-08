/* ══════════════════════════════════════════
   🧭 سفرهای مدیران راهنما — از اکسلی که افزونه‌ی «همیار کاروان» از سامانه‌ی عتبات می‌سازد
   هر ردیف یک کاروان: تاریخ ورود به عراق، مدیر و موبایل، شرکت مجری، کارگزار، هتل‌های هر شهر با تاریخ‌ها
   وضعیت: ok (زائر دارد) | empty (هنوز زائر ثبت نشده) | cancel (در گزارش گروه‌ها قرمز = لغو)
   بارگذاری دوباره‌ی یک بازه، کاروان‌های همان بازه را جایگزین می‌کند؛ اصلاح دستی (لغو دستی، شماره) نگه داشته می‌شود.
   فقط در D1 (هرگز در data.js یا GitHub عمومی نیست).
══════════════════════════════════════════ */
import { mgrPhone } from './mgr.js';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS mgr_trips (key TEXT PRIMARY KEY, entry TEXT NOT NULL, status TEXT NOT NULL, manual TEXT, prov TEXT, border TEXT, pkg TEXT, route TEXT,
    pilgrims INTEGER, company TEXT, agent TEXT, agent_code TEXT, mgr TEXT, phone TEXT, phone_fix TEXT, hotels TEXT, updated INTEGER NOT NULL, by TEXT)`,
  `CREATE INDEX IF NOT EXISTS mgr_trips_entry ON mgr_trips (entry)`,
  `CREATE INDEX IF NOT EXISTS mgr_trips_phone ON mgr_trips (phone)`
];
let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.batch(SCHEMA.map(q => env.DB.prepare(q)));
  ready = true;
}
const S = (v, n) => String(v ?? '').trim().slice(0, n);
const FA = s => String(s ?? '').replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
const N = s => FA(s).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\s‌‏‎.,،\-_/()]+/g, '').toLowerCase();
/* تاریخ شمسی ۱۴۰۵/۸/۷ → 1405/08/07 (رشته‌ی هم‌طول تا مرتب‌سازی و بازه درست کار کند) */
export function jDate(v) {
  const m = FA(v).match(/(1[34]\d\d)\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}` : '';
}
const CITIES = ['najaf', 'karbala', 'kadhimiya'];
const STATUS = ['ok', 'empty', 'cancel'];
const tripOut = r => {
  let hotels = []; try { hotels = JSON.parse(r.hotels || '[]'); } catch (e) {}
  return { key: r.key, entry: r.entry, status: r.manual === 'cancel' ? 'cancel' : r.status, auto: r.status, manual: r.manual || '', prov: r.prov || '', border: r.border || '',
    pkg: r.pkg || '', route: r.route || '', pilgrims: r.pilgrims ?? 0, company: r.company || '', agent: r.agent || '', agent_code: r.agent_code || '',
    mgr: r.mgr || '', phone: r.phone_fix || r.phone || '', phone_fixed: !!r.phone_fix, hotels, updated: r.updated };
};

export async function handleTripsAdmin(p, req, env, url, body, json, err, who) {
  if (!p.startsWith('/admin/mgr/trips')) return null;
  await ensure(env);
  const now = Date.now();
  if (p === '/admin/mgr/trips' && req.method === 'GET') {
    const from = jDate(url.searchParams.get('from')) || '0000/00/00', to = jDate(url.searchParams.get('to')) || '9999/99/99';
    const rows = (await env.DB.prepare('SELECT * FROM mgr_trips WHERE entry BETWEEN ? AND ? ORDER BY entry, company, agent LIMIT 5000').bind(from, to).all()).results.map(tripOut);
    const last = await env.DB.prepare('SELECT MAX(updated) AS t, MIN(entry) AS a, MAX(entry) AS b, COUNT(*) AS n FROM mgr_trips').first();
    return json({ rows, last });
  }
  if (p === '/admin/mgr/trips/import' && req.method === 'POST') {
    const seen = new Map();
    const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 4000).map(r => {
      const entry = jDate(r.entry);
      const hotels = (Array.isArray(r.hotels) ? r.hotels : []).filter(h => CITIES.includes(h.c) && (h.h || h.in)).slice(0, 6)
        .map(h => ({ c: h.c, h: S(h.h, 120), in: jDate(h.in), out: jDate(h.out), n: Math.max(0, Math.min(60, parseInt(FA(h.n)) || 0)) }));
      const x = { entry, status: STATUS.includes(r.status) ? r.status : 'empty', prov: S(r.prov, 60), border: S(r.border, 40), pkg: S(r.pkg, 300), route: S(r.route, 300),
        pilgrims: Math.max(0, Math.min(999, parseInt(FA(r.pilgrims)) || 0)), company: S(r.company, 150), agent: S(r.agent, 150), agent_code: S(FA(r.agent_code), 20),
        mgr: S(r.mgr, 100), phone: S(mgrPhone(r.phone), 20), hotels: JSON.stringify(hotels) };
      /* کلید پایدار بین دو بارگذاری؛ کاروان‌های کاملاً هم‌مشخصات با شماره‌ی ترتیب از هم جدا می‌شوند */
      const base = [N(x.agent), N(x.company), N(x.pkg), entry, N(x.mgr)].join('|');
      const i = (seen.get(base) || 0) + 1; seen.set(base, i);
      x.key = base + '|' + i;
      return x;
    }).filter(x => x.entry);
    if (!rows.length) return err('در فایل هیچ کاروانی با تاریخ ورود درست پیدا نشد.');
    const ent = rows.map(r => r.entry).sort();
    const from = [jDate(body.from), ent[0]].filter(Boolean).sort()[0], to = [jDate(body.to), ent[ent.length - 1]].filter(Boolean).sort().pop();
    /* اصلاح‌های دستیِ همین بازه پس از جایگزینی دوباره اعمال می‌شود */
    const fix = new Map((await env.DB.prepare('SELECT key, manual, phone_fix FROM mgr_trips WHERE entry BETWEEN ? AND ? AND (manual IS NOT NULL OR phone_fix IS NOT NULL)').bind(from, to).all())
      .results.map(r => [r.key, r]));
    let kept = 0;
    for (const r of rows) { const f = fix.get(r.key); r.manual = f ? f.manual : null; r.phone_fix = f ? f.phone_fix : null; if (f) kept++; }
    const J = "json_extract(value, '$.";
    const cols = ['key', 'entry', 'status', 'manual', 'prov', 'border', 'pkg', 'route', 'pilgrims', 'company', 'agent', 'agent_code', 'mgr', 'phone', 'phone_fix', 'hotels'];
    const q = [env.DB.prepare('DELETE FROM mgr_trips WHERE entry BETWEEN ? AND ?').bind(from, to)];
    for (let i = 0; i < rows.length; i += 500)
      q.push(env.DB.prepare(`INSERT OR REPLACE INTO mgr_trips (${cols.join(', ')}, updated, by) SELECT ${cols.map(c => `${J}${c}')`).join(', ')}, ?2, ?3 FROM json_each(?1)`)
        .bind(JSON.stringify(rows.slice(i, i + 500)), now, who));
    await env.DB.batch(q);
    const c = s => rows.filter(r => (r.manual === 'cancel' ? 'cancel' : r.status) === s).length;
    return json({ ok: true, n: rows.length, from, to, kept, ok_n: c('ok'), empty: c('empty'), cancel: c('cancel'), nophone: rows.filter(r => !r.phone && !r.phone_fix).length });
  }
  if (p === '/admin/mgr/trips/set' && req.method === 'POST') {
    const key = S(body.key, 900), r = await env.DB.prepare('SELECT key FROM mgr_trips WHERE key = ?').bind(key).first();
    if (!r) return err('این کاروان پیدا نشد؛ صفحه را تازه کنید.');
    if ('manual' in body) await env.DB.prepare('UPDATE mgr_trips SET manual = ?, updated = ?, by = ? WHERE key = ?').bind(body.manual === 'cancel' ? 'cancel' : null, now, who, key).run();
    if ('phone' in body) {
      const ph = mgrPhone(body.phone);
      if (ph && !/^0\d{10}$/.test(ph)) return err('شماره موبایل درست نیست (مثلاً ۰۹۱۲۳۴۵۶۷۸۹).');
      await env.DB.prepare('UPDATE mgr_trips SET phone_fix = ?, updated = ?, by = ? WHERE key = ?').bind(ph || null, now, who, key).run();
    }
    return json({ ok: true });
  }
  return null;
}
