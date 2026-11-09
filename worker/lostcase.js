/* ══════════════════════════════════════════
   🧒 پرونده‌های گمشده (مشترک بین همه‌ی دستگاه‌ها)
   ستاد (دسترسی lost در پنل) پرونده ثبت می‌کند: نام، مشخصات، شماره‌ی تماس، تصویر کوچک چهره و امضای عددی (۱۲۸ عدد، حداکثر ۳ عکس)
   مدیران کاروان (ورود تأییدشده‌ی بله) فقط جستجو می‌کنند: امضای چهره‌ی فرد پیداشده را می‌فرستند و فقط ۳ پرونده‌ی شبیه‌تر را می‌گیرند
   (فهرست کامل به گوشی مدیران نمی‌رود؛ عکس فرد پیداشده هم اصلاً به سرور نمی‌آید).
   «پیدا شد» = پاک شدن فوری؛ هر پرونده حداکثر ۱۵ روز می‌ماند (این‌جا و در نگهبان فضا).
   تأیید خانواده در بله: هر پرونده یک لینک بله‌ی اختصاصی دارد (?start=f_کد) که ستاد به همان خانواده می‌دهد.
   اگر مدیر «شباهت زیاد» بگیرد و خودش دکمه‌ی ارسال را بزند، فقط برش چهره برای همان خانواده فرستاده می‌شود
   با دو دکمه‌ی «بله خودش است / نه». عکس روی سرور ذخیره نمی‌شود؛ پیام عکس در بله بعد از جواب یا ۲۴ ساعت پاک می‌شود.
   مرزها باید با face.js یکی باشد.
══════════════════════════════════════════ */
import { BOT_USER } from './bale.js';
export const LOST_DAYS = 15;
const D = 864e5, HI = 0.935, MID = 0.91, MAX_OPEN = 500, MAX_PICS = 3;

let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS lost_cases (id TEXT PRIMARY KEY, name TEXT NOT NULL, info TEXT, contact TEXT, thumb TEXT, descs TEXT NOT NULL,
    created INTEGER NOT NULL, by TEXT, hits INTEGER DEFAULT 0, last_hit INTEGER)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS lost_sends (sid INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT NOT NULL, mgr_phone TEXT, mgr_name TEXT, mgr_chat INTEGER,
    chat INTEGER NOT NULL, msg_id INTEGER, created INTEGER NOT NULL, ans TEXT, ans_at INTEGER)`).run();
  const cols = (await env.DB.prepare('PRAGMA table_info(lost_cases)').all()).results.map(c => c.name);
  if (!cols.includes('fam_code')) await env.DB.prepare('ALTER TABLE lost_cases ADD COLUMN fam_code TEXT').run();
  if (!cols.includes('fam_chat')) await env.DB.prepare('ALTER TABLE lost_cases ADD COLUMN fam_chat INTEGER').run();
  ready = true;
}
const famLink = code => code ? `https://ble.ir/${BOT_USER}?start=f_${code}` : '';
const rnd = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
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
  const rows = (await env.DB.prepare('SELECT id, name, info, contact, thumb, descs, created, by, fam_chat IS NOT NULL AS fam FROM lost_cases').all()).results;
  return rows.map(r => {
    let ss = []; try { ss = JSON.parse(r.descs).map(d => cos(desc, d)).sort((a, b) => b - a); } catch (e) {}
    const s = ss.length > 1 ? Math.min(1, ss[0] + Math.max(0, ss[1] - MID) * 0.2) : (ss[0] || 0);
    const { descs, ...o } = r; return { ...o, s: Math.round(s * 1e4) / 1e4, n: ss.length };
  }).sort((a, b) => b.s - a.s).slice(0, 3);
}
const caseOut = r => { const { descs, fam_code, fam_chat, ...o } = r; o.fam = !!fam_chat; o.link = famLink(fam_code); let n = 0; try { n = JSON.parse(descs).length; } catch (e) {} return { ...o, n, left: Math.max(0, Math.ceil((r.created + LOST_DAYS * D - Date.now()) / D)) }; };

/* ── پنل ستاد: /admin/lost/* (دسترسی lost) ── */
export async function handleLostAdmin(p, req, env, body, json, err, who) {
  if (!p.startsWith('/admin/lost/')) return null;
  await ensure(env);
  if (p === '/admin/lost/list' && req.method === 'GET') {
    await purge(env);
    const rows = (await env.DB.prepare('SELECT * FROM lost_cases ORDER BY created DESC').all()).results;
    const sends = (await env.DB.prepare('SELECT case_id, mgr_name, ans, created FROM lost_sends WHERE created > ? ORDER BY created').bind(Date.now() - LOST_DAYS * D).all()).results;
    for (const r of rows) { const l = sends.filter(x => x.case_id === r.id); r.sends = l.length; r.last = l.length ? l[l.length - 1] : null; }
    const found = await env.DB.prepare("SELECT v FROM config WHERE k = 'lost:found'").first();
    return json({ cases: rows.map(caseOut), days: LOST_DAYS, found: found ? +found.v : 0 });
  }
  if (p === '/admin/lost/add' && req.method === 'POST') {
    const name = clip(body.name, 80), d = validDesc(body.desc), thumb = validThumb(body.thumb);
    if (!name) return err('نام فرد را بنویسید.');
    if (!d || !thumb) return err('امضای چهره نامعتبر است؛ عکس را دوباره انتخاب کنید.');
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM lost_cases').first()).n;
    if (n >= MAX_OPEN) return err('تعداد پرونده‌های باز به سقف رسیده؛ پرونده‌های پیداشده را «پیدا شد» بزنید.');
    const id = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join(''), code = rnd(10);
    await env.DB.prepare('INSERT INTO lost_cases (id, name, info, contact, thumb, descs, created, by, fam_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, name, clip(body.info, 200), clip(body.contact, 80), thumb, JSON.stringify([d]), Date.now(), who, code).run();
    return json({ ok: true, id, link: famLink(code) });
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
export async function handleLostMgr(p, req, env, body, json, err, limited, mgr, notify, send, url) {
  if (!mgr) return err('دسترسی بخش مدیران فعال نیست.', 401);
  await ensure(env);
  if (p === '/mgr/lost/send' && req.method === 'POST') return lostSend(env, body, json, err, limited, mgr, notify, send);
  if (p === '/mgr/lost/sent' && req.method === 'GET') {
    const r = await env.DB.prepare('SELECT ans FROM lost_sends WHERE sid = ? AND mgr_phone = ?').bind(+url.searchParams.get('sid') || 0, mgr.phone).first();
    return r ? json({ ans: r.ans || '' }) : err('یافت نشد', 404);
  }
  if (p !== '/mgr/lost/match' || req.method !== 'POST') return null;
  if (await limited(env, 'lostm:' + mgr.phone, 40, 3600)) return err('جستجوی زیاد در یک ساعت؛ کمی بعد دوباره امتحان کنید.', 429);
  const d = validDesc(body.desc); if (!d) return err('امضای چهره نامعتبر است.');
  const M = await match(env, d), top = M[0];
  if (top) await env.DB.prepare('UPDATE lost_cases SET hits = hits + 1, last_hit = ? WHERE id = ?').bind(Date.now(), top.id).run();
  /* شباهت زیاد ← خبر فوری به مدیر اصلی در بله */
  if (top && top.s >= HI && notify) await notify(env, `🧒 احتمالاً گمشده پیدا شد\n\nپرونده: ${top.name}${top.info ? ' — ' + top.info : ''}\nشباهت چهره: زیاد\nپیداکننده: ${mgr.name || 'مدیر کاروان'} — ${mgr.phone}${mgr.company ? ' (' + mgr.company + ')' : ''}\n\nبا پیداکننده و خانواده تماس بگیرید و هویت را تأیید کنید؛ بعد در پنل «پیدا شد» را بزنید.`).catch(() => {});
  return json({ matches: M.map(({ by, created, ...m }) => ({ ...m, fam: !!m.fam && m.s >= HI })) });
}

/* ── فرستادن برش چهره برای خانواده‌ی همان پرونده (فقط با زدن دکمه به‌دست مدیر و فقط شباهت زیاد) ── */
const validPhoto = t => typeof t === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(t) && t.length < 120000 ? t : null;
async function lostSend(env, body, json, err, limited, mgr, notify, send) {
  if (!env.BALE_TOKEN) return err('بازوی بله فعال نیست.');
  if (await limited(env, 'losts:' + mgr.phone, 10, 3600)) return err('ارسال زیاد در یک ساعت؛ با ستاد تماس بگیرید.', 429);
  const d = validDesc(body.desc), photo = validPhoto(body.photo);
  if (!d || !photo) return err('عکس نامعتبر است؛ دوباره جستجو کنید.');
  const c = await env.DB.prepare('SELECT id, name, descs, fam_chat FROM lost_cases WHERE id = ?').bind(String(body.id || '')).first();
  if (!c) return err('این پرونده دیگر وجود ندارد (شاید پیدا شده).', 404);
  if (!c.fam_chat) return err('خانواده‌ی این پرونده در بله وصل نیست؛ با شماره‌ی پرونده تماس بگیرید.');
  /* سرور خودش دوباره می‌سنجد: فقط شباهت زیاد */
  const ss = JSON.parse(c.descs).map(x => cos(d, x)).sort((a, b) => b - a), s = ss.length > 1 ? Math.min(1, ss[0] + Math.max(0, ss[1] - MID) * 0.2) : ss[0];
  if (!(s >= HI)) return err('فقط برای «شباهت زیاد» می‌شود عکس را برای خانواده فرستاد.');
  const wait = await env.DB.prepare('SELECT sid FROM lost_sends WHERE case_id = ? AND ans IS NULL AND created > ?').bind(c.id, Date.now() - D).first();
  if (wait) return json({ ok: true, sid: wait.sid, already: true });
  const ins = await env.DB.prepare('INSERT INTO lost_sends (case_id, mgr_phone, mgr_name, mgr_chat, chat, created) VALUES (?, ?, ?, ?, ?, ?) RETURNING sid')
    .bind(c.id, mgr.phone, mgr.name || '', mgr.chat_id || null, c.fam_chat, Date.now()).first();
  const bin = Uint8Array.from(atob(photo.split(',')[1]), x => x.charCodeAt(0)), fd = new FormData();
  fd.append('chat_id', String(c.fam_chat));
  fd.append('photo', new Blob([bin], { type: 'image/jpeg' }), 'face.jpg');
  fd.append('caption', `🧒 درباره‌ی «${c.name}»\n\nیکی از مدیران کاروان فردی را پیدا کرده که چهره‌اش به عکسی که به ستاد داده‌اید خیلی شبیه است.\n\nلطفاً با دقت نگاه کنید: آیا خودش است؟`);
  fd.append('reply_markup', JSON.stringify({ inline_keyboard: [[{ text: '✅ بله، خودش است', callback_data: `lf:y:${ins.sid}` }, { text: '❌ نه، او نیست', callback_data: `lf:n:${ins.sid}` }]] }));
  const r = await fetch(`https://tapi.bale.ai/bot${env.BALE_TOKEN}/sendPhoto`, { method: 'POST', body: fd }).then(x => x.json()).catch(() => null);
  if (!r || !r.ok) { await env.DB.prepare('DELETE FROM lost_sends WHERE sid = ?').bind(ins.sid).run(); return err('فرستادن در بله ممکن نشد؛ با شماره‌ی پرونده تماس بگیرید.', 502); }
  await env.DB.prepare('UPDATE lost_sends SET msg_id = ? WHERE sid = ?').bind(r.result.message_id, ins.sid).run();
  if (notify) await notify(env, `📤 عکس فرد پیداشده برای تأیید به خانواده‌ی «${c.name}» فرستاده شد.\nپیداکننده: ${mgr.name || 'مدیر کاروان'} — ${mgr.phone}`).catch(() => {});
  return json({ ok: true, sid: ins.sid });
}
const delMsg = (env, send, chat, id) => id ? send(env, 'deleteMessage', { chat_id: chat, message_id: id }).catch(() => {}) : null;

/* ── بازوی بله: وصل شدن خانواده با لینک اختصاصی پرونده ── */
export async function lostBaleHook(env, m, send) {
  const t = String(m.text || '').trim().match(/^\/start\s+f_([a-z0-9]{10})$/);
  if (!t) return false;
  await ensure(env);
  const chat = m.chat.id, say = text => send(env, 'sendMessage', { chat_id: chat, text });
  const c = await env.DB.prepare('SELECT id, name, fam_chat FROM lost_cases WHERE fam_code = ?').bind(t[1]).first();
  if (!c) { await say('این لینک دیگر معتبر نیست (شاید پرونده بسته شده). برای پیگیری با ستاد تماس بگیرید.'); return true; }
  if (c.fam_chat && String(c.fam_chat) !== String(chat)) { await say('این لینک قبلاً با حساب دیگری وصل شده است. اگر اشتباهی شده، با ستاد تماس بگیرید.'); return true; }
  await env.DB.prepare('UPDATE lost_cases SET fam_chat = ? WHERE id = ?').bind(chat, c.id).run();
  await say(`✅ برای پرونده‌ی «${c.name}» وصل شدید.\n\nاگر یکی از مدیران کاروان فردی با چهره‌ی خیلی شبیه پیدا کند، عکس چهره‌اش همین‌جا برایتان فرستاده می‌شود تا تأیید کنید.\n\nان‌شاءالله به‌زودی پیدا می‌شود 🤲`);
  return true;
}
/* ── جواب خانواده: lf:y|n:sid ── */
export async function lostBaleCallback(env, cq, send, notify) {
  const m = String(cq.data || '').match(/^lf:(y|n):(\d+)$/);
  if (!m) return false;
  await ensure(env);
  const chat = cq.message && cq.message.chat ? cq.message.chat.id : null, ack = text => send(env, 'answerCallbackQuery', { callback_query_id: cq.id, text }).catch(() => {});
  const r = await env.DB.prepare('SELECT s.*, c.name, c.contact FROM lost_sends s LEFT JOIN lost_cases c ON c.id = s.case_id WHERE s.sid = ?').bind(+m[2]).first();
  if (!r || String(r.chat) !== String(chat)) { await ack('این پیام دیگر معتبر نیست.'); return true; }
  if (r.ans) { await ack('جواب شما قبلاً ثبت شده است.'); return true; }
  const yes = m[1] === 'y';
  await env.DB.prepare('UPDATE lost_sends SET ans = ?, ans_at = ? WHERE sid = ?').bind(yes ? 'y' : 'n', Date.now(), r.sid).run();
  await ack(yes ? 'ثبت شد ✅' : 'ثبت شد');
  await delMsg(env, send, chat, r.msg_id);
  const say = (c, text) => c ? send(env, 'sendMessage', { chat_id: c, text }).catch(() => {}) : null;
  if (yes) {
    await say(chat, `✅ ثبت شد. مدیر کاروانی که «${r.name || 'او'}» را پیدا کرده:\n${r.mgr_name || 'مدیر کاروان'} — ${r.mgr_phone}\n\nهمین الان با او تماس بگیرید. موقع تحویل، مدیر برای اطمینان چند سؤال ساده از شما می‌پرسد.\nعکس از این گفتگو پاک شد.`);
    await say(r.mgr_chat, `✅ خانواده‌ی «${r.name || ''}» در بله تأیید کردند که خودش است.\nتماس خانواده: ${r.contact || '—'}\n\nقبل از تحویل، با چند سؤال (نام همراهان، کاروان، لباس) هویت را مطمئن شوید. بعد به ستاد خبر دهید تا پرونده بسته شود.`);
    if (notify) await notify(env, `✅ خانواده‌ی «${r.name || ''}» در بله تأیید کردند که فرد پیداشده خودش است.\nپیداکننده: ${r.mgr_name || ''} — ${r.mgr_phone}\nبعد از تحویل، در پنل «پیدا شد» را بزنید.`).catch(() => {});
  } else {
    await say(chat, 'ممنون. ثبت شد که او نیست و عکس از این گفتگو پاک شد. جستجو ادامه دارد 🤲');
    await say(r.mgr_chat, `❌ خانواده‌ی «${r.name || ''}» گفتند فردی که پیدا کرده‌اید او نیست. لطفاً با ستاد تماس بگیرید.`);
    if (notify) await notify(env, `❌ خانواده‌ی «${r.name || ''}» گفتند فرد پیداشده (توسط ${r.mgr_name || ''} — ${r.mgr_phone}) او نیست.`).catch(() => {});
  }
  return true;
}
/* ── هر ۵ دقیقه: عکس‌های بی‌جواب بعد از ۲۴ ساعت، یا پرونده‌ی بسته‌شده ← پیام عکس پاک می‌شود ── */
export async function lostTick(env, send) {
  if (!send) return;
  await ensure(env);
  const rows = (await env.DB.prepare('SELECT s.sid, s.chat, s.msg_id FROM lost_sends s LEFT JOIN lost_cases c ON c.id = s.case_id WHERE s.ans IS NULL AND (s.created < ? OR c.id IS NULL) LIMIT 20').bind(Date.now() - D).all()).results;
  for (const r of rows) {
    await delMsg(env, send, r.chat, r.msg_id);
    await env.DB.prepare("UPDATE lost_sends SET ans = 'x', ans_at = ? WHERE sid = ?").bind(Date.now(), r.sid).run();
  }
}
