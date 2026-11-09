/* ══════════════════════════════════════════
   🧒 پرونده‌های گمشده (مشترک بین همه‌ی دستگاه‌ها)
   ستاد (دسترسی lost در پنل) پرونده ثبت می‌کند: نام، مشخصات، شماره‌ی تماس، تصویر کوچک چهره و امضای عددی (۱۲۸ عدد، حداکثر ۳ عکس)
   مدیران کاروان (ورود تأییدشده‌ی بله) فقط جستجو می‌کنند: امضای چهره‌ی فرد پیداشده را می‌فرستند و فقط ۳ پرونده‌ی شبیه‌تر را می‌گیرند
   (فهرست کامل به گوشی مدیران نمی‌رود؛ عکس فرد پیداشده هم اصلاً به سرور نمی‌آید).
   «پیدا شد» = پاک شدن فوری؛ هر پرونده حداکثر ۱۵ روز می‌ماند (این‌جا و در نگهبان فضا).
   مرزها باید با face.js یکی باشد.
══════════════════════════════════════════ */
export const LOST_DAYS = 15;
const D = 864e5, HI = 0.935, MID = 0.91, MAX_OPEN = 500, MAX_PICS = 3;

async function ensure(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS lost_cases (id TEXT PRIMARY KEY, name TEXT NOT NULL, info TEXT, contact TEXT, thumb TEXT, descs TEXT NOT NULL,
    created INTEGER NOT NULL, by TEXT, hits INTEGER DEFAULT 0, last_hit INTEGER)`).run();
}
const purge = env => env.DB.prepare('DELETE FROM lost_cases WHERE created < ?').bind(Date.now() - LOST_DAYS * D).run();
const clip = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
function validDesc(d) {
  if (!Array.isArray(d) || d.length !== 128 || !d.every(x => typeof x === 'number' && isFinite(x) && Math.abs(x) <= 1)) return null;
  const n = Math.hypot(...d); return n > 0.9 && n < 1.1 ? d : null;
}
const validThumb = t => typeof t === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(t) && t.length < 60000 ? t : null;
const cos = (a, b) => { let s = 0; for (let i = 0; i < 128; i++) s += a[i] * b[i]; return s; };

/* ۳ پرونده‌ی شبیه‌تر؛ اگر پرونده چند عکس دارد و عکس دوم هم شبیه است، کمی امتیاز اضافه (مثل قبل) */
async function match(env, desc) {
  await purge(env);
  const rows = (await env.DB.prepare('SELECT id, name, info, contact, thumb, descs, created, by FROM lost_cases').all()).results;
  return rows.map(r => {
    let ss = []; try { ss = JSON.parse(r.descs).map(d => cos(desc, d)).sort((a, b) => b - a); } catch (e) {}
    const s = ss.length > 1 ? Math.min(1, ss[0] + Math.max(0, ss[1] - MID) * 0.2) : (ss[0] || 0);
    const { descs, ...o } = r; return { ...o, s: Math.round(s * 1e4) / 1e4, n: ss.length };
  }).sort((a, b) => b.s - a.s).slice(0, 3);
}
const caseOut = r => { const { descs, ...o } = r; let n = 0; try { n = JSON.parse(descs).length; } catch (e) {} return { ...o, n, left: Math.max(0, Math.ceil((r.created + LOST_DAYS * D - Date.now()) / D)) }; };

/* ── پنل ستاد: /admin/lost/* (دسترسی lost) ── */
export async function handleLostAdmin(p, req, env, body, json, err, who) {
  if (!p.startsWith('/admin/lost/')) return null;
  await ensure(env);
  if (p === '/admin/lost/list' && req.method === 'GET') {
    await purge(env);
    const rows = (await env.DB.prepare('SELECT * FROM lost_cases ORDER BY created DESC').all()).results;
    const found = await env.DB.prepare("SELECT v FROM config WHERE k = 'lost:found'").first();
    return json({ cases: rows.map(caseOut), days: LOST_DAYS, found: found ? +found.v : 0 });
  }
  if (p === '/admin/lost/add' && req.method === 'POST') {
    const name = clip(body.name, 80), d = validDesc(body.desc), thumb = validThumb(body.thumb);
    if (!name) return err('نام فرد را بنویسید.');
    if (!d || !thumb) return err('امضای چهره نامعتبر است؛ عکس را دوباره انتخاب کنید.');
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM lost_cases').first()).n;
    if (n >= MAX_OPEN) return err('تعداد پرونده‌های باز به سقف رسیده؛ پرونده‌های پیداشده را «پیدا شد» بزنید.');
    const id = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare('INSERT INTO lost_cases (id, name, info, contact, thumb, descs, created, by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, name, clip(body.info, 200), clip(body.contact, 80), thumb, JSON.stringify([d]), Date.now(), who).run();
    return json({ ok: true, id });
  }
  if (p === '/admin/lost/photo' && req.method === 'POST') {
    const d = validDesc(body.desc), r = await env.DB.prepare('SELECT descs FROM lost_cases WHERE id = ?').bind(String(body.id || '')).first();
    if (!r) return err('این پرونده دیگر وجود ندارد.', 404);
    if (!d) return err('امضای چهره نامعتبر است.');
    const list = JSON.parse(r.descs);
    if (list.length >= MAX_PICS) return err(`برای هر نفر حداکثر ${MAX_PICS} عکس.`);
    list.push(d);
    await env.DB.prepare('UPDATE lost_cases SET descs = ? WHERE id = ?').bind(JSON.stringify(list), body.id).run();
    return json({ ok: true, n: list.length });
  }
  if ((p === '/admin/lost/found' || p === '/admin/lost/del') && req.method === 'POST') {
    const r = await env.DB.prepare('DELETE FROM lost_cases WHERE id = ?').bind(String(body.id || '')).run();
    if (p === '/admin/lost/found' && r.meta.changes) await env.DB.prepare("INSERT INTO config (k, v) VALUES ('lost:found', '1') ON CONFLICT(k) DO UPDATE SET v = CAST(v AS INTEGER) + 1").run();
    return json({ ok: true });
  }
  if (p === '/admin/lost/match' && req.method === 'POST') {
    const d = validDesc(body.desc); if (!d) return err('امضای چهره نامعتبر است.');
    return json({ matches: await match(env, d) });
  }
  return null;
}

/* ── اپ، مدیر کاروانِ واردشده: /mgr/lost/match ── */
export async function handleLostMgr(p, req, env, body, json, err, limited, mgr, notify) {
  if (p !== '/mgr/lost/match' || req.method !== 'POST') return null;
  if (!mgr) return err('دسترسی بخش مدیران فعال نیست.', 401);
  if (await limited(env, 'lostm:' + mgr.phone, 40, 3600)) return err('جستجوی زیاد در یک ساعت؛ کمی بعد دوباره امتحان کنید.', 429);
  const d = validDesc(body.desc); if (!d) return err('امضای چهره نامعتبر است.');
  await ensure(env);
  const M = await match(env, d), top = M[0];
  if (top) await env.DB.prepare('UPDATE lost_cases SET hits = hits + 1, last_hit = ? WHERE id = ?').bind(Date.now(), top.id).run();
  /* شباهت زیاد ← خبر فوری به مدیر اصلی در بله */
  if (top && top.s >= HI && notify) await notify(env, `🧒 احتمالاً گمشده پیدا شد\n\nپرونده: ${top.name}${top.info ? ' — ' + top.info : ''}\nشباهت چهره: زیاد\nپیداکننده: ${mgr.name || 'مدیر کاروان'} — ${mgr.phone}${mgr.company ? ' (' + mgr.company + ')' : ''}\n\nبا پیداکننده و خانواده تماس بگیرید و هویت را تأیید کنید؛ بعد در پنل «پیدا شد» را بزنید.`).catch(() => {});
  return json({ matches: M.map(({ by, created, ...m }) => m) });
}
