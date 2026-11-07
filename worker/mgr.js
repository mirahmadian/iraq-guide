/* ══════════════════════════════════════════
   🧳 ورود مدیران کاروان به «بخش ویژه» برنامه — تأیید شماره با بازوی بله
   ۱. همکاران پنل فهرست شماره‌ی مدیران را وارد می‌کنند (mgr_people؛ فقط در D1، نه GitHub)
   ۲. برنامه یک کد یک‌بارمصرف می‌گیرد (/mgr/link) و بازو را با ?start=m_کد باز می‌کند
   ۳. مدیر در بله «ارسال شماره من» را می‌زند؛ خود بله شماره را تأیید می‌کند
   ۴. اگر شماره در فهرست بود: برنامه با /mgr/status خودش وارد می‌شود، یا مدیر کد ۶ رقمی بازو را وارد می‌کند (/mgr/otp)
   هر شماره حداکثر روی ۲ گوشی؛ با حذف از فهرست یا پایان تاریخ، دسترسی در اولین بررسی قطع می‌شود.
══════════════════════════════════════════ */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS mgr_people (phone TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT, company TEXT, city TEXT, until INTEGER,
    active INTEGER NOT NULL DEFAULT 1, chat_id INTEGER, created INTEGER NOT NULL, by TEXT, last_login INTEGER, logins INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS mgr_devices (tok TEXT PRIMARY KEY, phone TEXT NOT NULL, dev TEXT, created INTEGER NOT NULL, last INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS mgr_devices_phone ON mgr_devices (phone)`,
  `CREATE TABLE IF NOT EXISTS mgr_links (code TEXT PRIMARY KEY, dev TEXT, exp INTEGER NOT NULL, phone TEXT, otp TEXT, state TEXT NOT NULL DEFAULT 'wait')`,
  `CREATE TABLE IF NOT EXISTS mgr_pending (chat_id INTEGER PRIMARY KEY, code TEXT NOT NULL, t INTEGER NOT NULL)`
];
let ready = false;
async function ensure(env) { if (ready) return; await env.DB.batch(SCHEMA.map(q => env.DB.prepare(q))); ready = true; }

const MAX_DEVICES = 2, LINK_MIN = 15, OTP_MIN = 10;
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const rand = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha = async s => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const randCode = () => [...crypto.getRandomValues(new Uint8Array(10))].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
const randOtp = () => String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
/* شماره: ارقام فارسی/عربی → لاتین؛ +98/98 → 0 ؛ +964 → 00964 */
export function mgrPhone(p) {
  let d = String(p || '').replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[^\d+]/g, '');
  if (d.startsWith('+98')) d = '0' + d.slice(3); else if (d.startsWith('98') && d.length === 12) d = '0' + d.slice(2);
  else if (d.startsWith('+')) d = '00' + d.slice(1);
  else if (/^9\d{9}$/.test(d)) d = '0' + d;
  return d;
}
const phoneOk = p => /^0\d{10}$/.test(p) || /^00\d{9,15}$/.test(p);
const validSql = '(active = 1 AND (until IS NULL OR until > ?))';
const meOf = r => ({ name: r.name, role: r.role || '', company: r.company || '', city: r.city || '', until: r.until || null });

async function issueToken(env, phone, dev) {
  const tok = rand(32), now = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO mgr_devices (tok, phone, dev, created, last) VALUES (?, ?, ?, ?, ?)').bind(await sha(tok), phone, dev || null, now, now),
    env.DB.prepare(`DELETE FROM mgr_devices WHERE phone = ?1 AND tok NOT IN (SELECT tok FROM mgr_devices WHERE phone = ?1 ORDER BY last DESC LIMIT ${MAX_DEVICES})`).bind(phone),
    env.DB.prepare('UPDATE mgr_people SET last_login = ?, logins = logins + 1 WHERE phone = ?').bind(now, phone)
  ]);
  return tok;
}
async function person(env, phone) { return env.DB.prepare(`SELECT * FROM mgr_people WHERE phone = ? AND ${validSql}`).bind(phone, Date.now()).first(); }

/* ── برنامه ── */
export async function handleMgr(p, req, env, body, dev, json, err, limited, ip) {
  await ensure(env);
  const now = Date.now();
  if (p === '/mgr/link' && req.method === 'POST') {
    if (!env.BALE_TOKEN) return err('بازوی بله هنوز راه‌اندازی نشده است.', 503);
    if (!dev) return err('شناسه گوشی نامعتبر');
    if (await limited(env, 'mlink:' + await sha(env.SALT + ip), 20, 3600)) return err('کمی بعد دوباره امتحان کنید.', 429);
    const code = randCode();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM mgr_links WHERE exp < ?').bind(now),
      env.DB.prepare('INSERT INTO mgr_links (code, dev, exp) VALUES (?, ?, ?)').bind(code, dev, now + LINK_MIN * 6e4)
    ]);
    return json({ code, url: `https://ble.ir/HamyarKaravan_Bot?start=m_${code}` });
  }
  if (p === '/mgr/status' && req.method === 'POST') {
    const l = await env.DB.prepare('SELECT * FROM mgr_links WHERE code = ? AND dev = ? AND exp > ?').bind(String(body.code || ''), dev, now).first();
    if (!l) return json({ expired: true });
    if (l.state === 'no') return json({ denied: true });
    if (l.state !== 'ok') return json({ wait: true });
    const r = await person(env, l.phone);
    await env.DB.prepare('DELETE FROM mgr_links WHERE code = ?').bind(l.code).run();
    if (!r) return json({ denied: true });
    return json({ ok: true, token: await issueToken(env, r.phone, dev), me: meOf(r) });
  }
  if (p === '/mgr/otp' && req.method === 'POST') {
    if (await limited(env, 'motp:' + await sha(env.SALT + ip), 12, 3600)) return err('تعداد تلاش زیاد است؛ یک ساعت دیگر امتحان کنید.', 429);
    const otp = mgrPhone(body.otp);
    if (!/^\d{6}$/.test(otp)) return err('کد ۶ رقمی را درست وارد کنید.');
    const l = await env.DB.prepare("SELECT * FROM mgr_links WHERE otp = ? AND state = 'ok' AND exp > ?").bind(otp, now).first();
    const r = l && await person(env, l.phone);
    if (!r) return err('این کد درست نیست یا منقضی شده است. دوباره از بازوی بله کد بگیرید.');
    await env.DB.prepare('DELETE FROM mgr_links WHERE code = ?').bind(l.code).run();
    return json({ ok: true, token: await issueToken(env, r.phone, dev), me: meOf(r) });
  }
  if (p === '/mgr/me' && req.method === 'GET') {
    const r = await mgrAuth(env, req);
    if (!r) return err('دسترسی بخش مدیران فعال نیست.', 401);
    return json({ ok: true, me: meOf(r) });
  }
  if (p === '/mgr/logout' && req.method === 'POST') {
    const t = (req.headers.get('Authorization') || '').match(/^mgr\s+([0-9a-f]{64})$/i);
    if (t) await env.DB.prepare('DELETE FROM mgr_devices WHERE tok = ?').bind(await sha(t[1].toLowerCase())).run();
    return json({ ok: true });
  }
  return null;
}
/* توکن گوشی ← مدیر (اگر هنوز در فهرست و معتبر است) */
export async function mgrAuth(env, req) {
  await ensure(env);
  const t = (req.headers.get('Authorization') || '').match(/^mgr\s+([0-9a-f]{64})$/i);
  if (!t) return null;
  const h = await sha(t[1].toLowerCase());
  const r = await env.DB.prepare(`SELECT p.* FROM mgr_devices d JOIN mgr_people p ON p.phone = d.phone WHERE d.tok = ? AND p.active = 1 AND (p.until IS NULL OR p.until > ?)`).bind(h, Date.now()).first();
  if (r) await env.DB.prepare('UPDATE mgr_devices SET last = ? WHERE tok = ?').bind(Date.now(), h).run();
  return r;
}

/* ── بازوی بله (از bale.js صدا زده می‌شود؛ true = پیام رسیدگی شد) ── */
const ASK_KB = { keyboard: [[{ text: '📱 ارسال شماره من', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };
export async function mgrBaleHook(env, m, send) {
  await ensure(env);
  const chat = m.chat.id, from = m.from || {}, text = String(m.text || '').trim(), now = Date.now();
  const say = (t, kb) => send(env, 'sendMessage', { chat_id: chat, text: t, reply_markup: kb || { remove_keyboard: true } });
  const verify = async (l, r) => {
    const otp = randOtp();
    await env.DB.batch([
      env.DB.prepare("UPDATE mgr_links SET state = 'ok', phone = ?, otp = ?, exp = ? WHERE code = ?").bind(r.phone, otp, now + OTP_MIN * 6e4, l.code),
      env.DB.prepare('UPDATE mgr_people SET chat_id = ? WHERE phone = ?').bind(chat, r.phone)
    ]);
    await say(`✅ ${r.name} عزیز، شماره‌ی شما تأیید شد.\n\nبه برنامه‌ی همیار کاروان برگردید؛ بخش ویژه‌ی مدیران خودش باز می‌شود.\n\nاگر باز نشد، این کد را در برنامه وارد کنید:\n${otp}\n(تا ${OTP_MIN} دقیقه معتبر است؛ آن را به کسی ندهید.)`);
  };
  const start = text.match(/^\/start\s+m_([a-z0-9]{6,20})$/i);
  if (start) {
    const l = await env.DB.prepare("SELECT * FROM mgr_links WHERE code = ? AND exp > ? AND state = 'wait'").bind(start[1].toLowerCase(), now).first();
    if (!l) { await say('این لینک منقضی شده است. در برنامه دوباره دکمه‌ی «ورود مدیران کاروان» را بزنید.'); return true; }
    const known = await env.DB.prepare(`SELECT * FROM mgr_people WHERE chat_id = ? AND ${validSql}`).bind(chat, now).first();
    if (known) { await verify(l, known); return true; }
    await env.DB.prepare('INSERT OR REPLACE INTO mgr_pending (chat_id, code, t) VALUES (?, ?, ?)').bind(chat, l.code, now).run();
    await say('🧳 ورود به بخش ویژه‌ی مدیران کاروان\n\nبرای تأیید، دکمه‌ی «📱 ارسال شماره من» را در پایین صفحه بزنید.', ASK_KB);
    return true;
  }
  if (m.contact) {
    const pend = await env.DB.prepare('SELECT code FROM mgr_pending WHERE chat_id = ? AND t > ?').bind(chat, now - LINK_MIN * 6e4).first();
    if (!pend) return false;
    if (m.contact.user_id && from.id && m.contact.user_id !== from.id) { await say('لطفاً شماره‌ی خودتان را با دکمه‌ی پایین بفرستید.', ASK_KB); return true; }
    await env.DB.prepare('DELETE FROM mgr_pending WHERE chat_id = ?').bind(chat).run();
    const l = await env.DB.prepare("SELECT * FROM mgr_links WHERE code = ? AND exp > ? AND state = 'wait'").bind(pend.code, now).first();
    if (!l) { await say('زمان ورود تمام شد. در برنامه دوباره دکمه‌ی «ورود مدیران کاروان» را بزنید.'); return true; }
    const phone = mgrPhone(m.contact.phone_number), r = await person(env, phone);
    if (r) { await verify(l, r); return true; }
    await env.DB.prepare("UPDATE mgr_links SET state = 'no' WHERE code = ?").bind(l.code).run();
    await say(`شماره‌ی شما (${phone}) در فهرست مدیران کاروان ثبت نشده است.\n\nاگر مدیر کاروان یا از عوامل اجرایی هستید، با ستاد تماس بگیرید تا شماره‌تان ثبت شود و بعد دوباره امتحان کنید.`);
    return true;
  }
  return false;
}

/* ── پنل مدیریت (دسترسی «mgr») ── */
export async function handleMgrAdmin(p, req, env, body, json, err, who) {
  if (!p.startsWith('/admin/mgr')) return null;
  await ensure(env);
  const now = Date.now();
  if (p === '/admin/mgr' && req.method === 'GET') {
    const people = (await env.DB.prepare(`SELECT p.phone, p.name, p.role, p.company, p.city, p.until, p.active, p.created, p.by, p.last_login, p.logins, p.chat_id IS NOT NULL AS bale,
      (SELECT COUNT(*) FROM mgr_devices d WHERE d.phone = p.phone) AS devices FROM mgr_people p ORDER BY p.created DESC LIMIT 5000`).all()).results;
    return json({ people, max: MAX_DEVICES });
  }
  const S = (v, n) => String(v ?? '').trim().slice(0, n);
  const untilOf = v => { const n = +v; return n > now ? n : null; };
  if (p === '/admin/mgr/save' && req.method === 'POST') {
    const phone = mgrPhone(body.phone), name = S(body.name, 80), old = body.old ? mgrPhone(body.old) : '';
    if (!phoneOk(phone)) return err('شماره موبایل درست نیست (مثلاً ۰۹۱۲۳۴۵۶۷۸۹).');
    if (!name) return err('نام را بنویسید.');
    if (old && old !== phone && await env.DB.prepare('SELECT 1 FROM mgr_people WHERE phone = ?').bind(phone).first()) return err('این شماره قبلاً در فهرست هست.');
    const q = [env.DB.prepare(`INSERT INTO mgr_people (phone, name, role, company, city, until, active, created, by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      ON CONFLICT(phone) DO UPDATE SET name = ?2, role = ?3, company = ?4, city = ?5, until = ?6, active = ?7`)
      .bind(phone, name, S(body.role, 40), S(body.company, 120), S(body.city, 40), untilOf(body.until), body.active === false ? 0 : 1, now, who)];
    if (old && old !== phone) q.push(env.DB.prepare('DELETE FROM mgr_people WHERE phone = ?').bind(old), env.DB.prepare('DELETE FROM mgr_devices WHERE phone = ?').bind(old));
    if (body.active === false) q.push(env.DB.prepare('DELETE FROM mgr_devices WHERE phone = ?').bind(phone));
    await env.DB.batch(q);
    return json({ ok: true, phone });
  }
  if (p === '/admin/mgr/import' && req.method === 'POST') {
    const rows = (Array.isArray(body.rows) ? body.rows : []).slice(0, 3000)
      .map(r => ({ phone: mgrPhone(r.phone), name: S(r.name, 80), role: S(r.role, 40), company: S(r.company, 120), city: S(r.city, 40) }))
      .filter(r => phoneOk(r.phone) && r.name);
    if (!rows.length) return err('هیچ ردیف درستی (نام + شماره موبایل) پیدا نشد.');
    const until = untilOf(body.until), J = "json_extract(value, '$.";
    await env.DB.prepare(`INSERT INTO mgr_people (phone, name, role, company, city, until, active, created, by)
      SELECT ${J}phone'), ${J}name'), ${J}role'), ${J}company'), ${J}city'), ?2, 1, ?3, ?4 FROM json_each(?1) WHERE true
      ON CONFLICT(phone) DO UPDATE SET name = excluded.name, role = COALESCE(NULLIF(excluded.role, ''), role), company = COALESCE(NULLIF(excluded.company, ''), company),
        city = COALESCE(NULLIF(excluded.city, ''), city), until = COALESCE(excluded.until, until)`).bind(JSON.stringify(rows), until, now, who).run();
    return json({ ok: true, n: rows.length });
  }
  if (p === '/admin/mgr/del' && req.method === 'POST') {
    const phone = mgrPhone(body.phone);
    await env.DB.batch([env.DB.prepare('DELETE FROM mgr_people WHERE phone = ?').bind(phone), env.DB.prepare('DELETE FROM mgr_devices WHERE phone = ?').bind(phone)]);
    return json({ ok: true });
  }
  if (p === '/admin/mgr/revoke' && req.method === 'POST') {
    await env.DB.prepare('DELETE FROM mgr_devices WHERE phone = ?').bind(mgrPhone(body.phone)).run();
    return json({ ok: true });
  }
  /* کد یک‌بارمصرف دستی برای کسی که بله ندارد (۲۴ ساعت) */
  if (p === '/admin/mgr/otp' && req.method === 'POST') {
    const r = await person(env, mgrPhone(body.phone));
    if (!r) return err('این شماره در فهرست نیست یا غیرفعال است.');
    let otp; do { otp = randOtp(); } while (await env.DB.prepare('SELECT 1 FROM mgr_links WHERE otp = ? AND exp > ?').bind(otp, now).first());
    await env.DB.prepare("INSERT INTO mgr_links (code, dev, exp, phone, otp, state) VALUES (?, NULL, ?, ?, ?, 'ok')").bind('a' + randCode(), now + 864e5, r.phone, otp).run();
    return json({ ok: true, otp, name: r.name });
  }
  return null;
}
