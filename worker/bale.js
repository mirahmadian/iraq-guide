/* ══════════════════════════════════════════
   بازوی بله @HamyarKaravan_Bot — زائر با رضایت خودش شماره‌اش را برای دریافت اطلاعیه‌ها می‌فرستد
   ۱. برنامه یک کد یک‌بارمصرف می‌گیرد (/bale/link) و بازو را با ?start=کد باز می‌کند
   ۲. بازو دکمه «ارسال شماره من» را نشان می‌دهد؛ شماره تأییدشده از خود بله می‌آید (بدون OTP)
   ۳. شماره به همان گوشی (dev) وصل می‌شود؛ مدیر از پنل به همه یا به زائران یک شهر پیام می‌فرستد
   رازها: BALE_TOKEN (توکن بازو) و BALE_HOOK (مسیر مخفی webhook) — با wrangler secret put
══════════════════════════════════════════ */
const API = t => `https://tapi.bale.ai/bot${t}/`;
export const BOT_USER = 'HamyarKaravan_Bot';
const SEND_BATCH = 35; /* هر درخواست حداکثر ۵۰ زیردرخواست دارد (Workers رایگان) */

async function bale(env, method, body) {
  const r = await fetch(API(env.BALE_TOKEN) + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false }));
}
const randCode = () => [...crypto.getRandomValues(new Uint8Array(9))].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
/* شماره را به شکل ۰۹۱۲… یا +۹۶۴… یکدست می‌کند */
function normPhone(p) {
  let d = String(p || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+98')) d = '0' + d.slice(3); else if (d.startsWith('98') && d.length === 12) d = '0' + d.slice(2);
  else if (d.startsWith('+')) d = '00' + d.slice(1);
  return d;
}
const ASK_KB = { keyboard: [[{ text: '📱 ارسال شماره من', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true };

export async function handleBalePublic(p, req, env, body, dev, json, err, limited, ip, sha) {
  if (!env.BALE_TOKEN) return err('بازوی بله هنوز راه‌اندازی نشده است.', 503);

  /* کد یک‌بارمصرف برای وصل کردن این گوشی به بله */
  if (p === '/bale/link' && req.method === 'POST') {
    if (!dev) return err('شناسه گوشی نامعتبر');
    if (await limited(env, 'blink:' + await sha(env.SALT + ip), 20, 3600)) return err('کمی بعد دوباره امتحان کنید.', 429);
    const code = randCode();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM bale_links WHERE exp < ?').bind(Date.now()),
      env.DB.prepare('INSERT INTO bale_links (code, dev, exp) VALUES (?, ?, ?)').bind(code, dev, Date.now() + 30 * 6e4)
    ]);
    return json({ code, url: `https://ble.ir/${BOT_USER}?start=${code}` });
  }
  if (p === '/bale/status' && req.method === 'GET') {
    if (!dev) return json({ linked: false });
    const r = await env.DB.prepare('SELECT 1 FROM bale_users WHERE dev = ? AND active = 1').bind(dev).first();
    return json({ linked: !!r });
  }

  /* پیام‌های بله (webhook) */
  if (p === '/bale/hook/' + env.BALE_HOOK && req.method === 'POST') {
    const m = body.message;
    if (!m || !m.chat) return json({ ok: true });
    const chat = m.chat.id, from = m.from || {}, text = String(m.text || '').trim();
    const name = [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 60);

    if (m.contact) {
      /* فقط شماره خود فرستنده پذیرفته می‌شود، نه شماره دیگران از دفترچه تلفن */
      if (m.contact.user_id && from.id && m.contact.user_id !== from.id) {
        await bale(env, 'sendMessage', { chat_id: chat, text: 'لطفاً شماره خودتان را با دکمه پایین بفرستید.', reply_markup: ASK_KB });
        return json({ ok: true });
      }
      const pend = await env.DB.prepare('SELECT dev FROM bale_pending WHERE chat_id = ?').bind(chat).first();
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO bale_users (chat_id, phone, name, dev, created, active) VALUES (?1, ?2, ?3, ?4, ?5, 1)
          ON CONFLICT(chat_id) DO UPDATE SET phone = ?2, name = ?3, dev = COALESCE(?4, dev), active = 1`).bind(chat, normPhone(m.contact.phone_number), name, pend ? pend.dev : null, Date.now()),
        env.DB.prepare('DELETE FROM bale_pending WHERE chat_id = ?').bind(chat)
      ]);
      await bale(env, 'sendMessage', { chat_id: chat, reply_markup: { remove_keyboard: true },
        text: '✅ ثبت شد. اطلاعیه‌های مهم همیار کاروان (مثل تغییر ساعت‌ها، هشدارها و یادآوری‌ها) را همین‌جا دریافت می‌کنید.\n\nبرای لغو در هر زمان، بنویسید: لغو' });
      return json({ ok: true });
    }
    if (text === '/stop' || text === 'لغو') {
      await env.DB.prepare('UPDATE bale_users SET active = 0 WHERE chat_id = ?').bind(chat).run();
      await bale(env, 'sendMessage', { chat_id: chat, text: 'اشتراک شما لغو شد و دیگر پیامی نمی‌گیرید. برای عضویت دوباره از برنامه همیار کاروان اقدام کنید.', reply_markup: { remove_keyboard: true } });
      return json({ ok: true });
    }
    /* /start کد  یا خود کد */
    const code = (text.match(/^\/start\s+([a-z0-9]{6,20})$/i) || text.match(/^([a-z0-9]{9})$/i) || [])[1];
    let dev2 = null;
    if (code) {
      const l = await env.DB.prepare('SELECT dev FROM bale_links WHERE code = ? AND exp > ?').bind(code.toLowerCase(), Date.now()).first();
      if (l) {
        dev2 = l.dev;
        await env.DB.batch([
          env.DB.prepare('DELETE FROM bale_links WHERE code = ?').bind(code.toLowerCase()),
          env.DB.prepare('INSERT OR REPLACE INTO bale_pending (chat_id, dev, t) VALUES (?, ?, ?)').bind(chat, dev2, Date.now()),
          /* اگر قبلاً شماره داده، فقط گوشی تازه را وصل کن */
          env.DB.prepare('UPDATE bale_users SET dev = ?, active = 1 WHERE chat_id = ?').bind(dev2, chat)
        ]);
        const ex = await env.DB.prepare('SELECT phone FROM bale_users WHERE chat_id = ?').bind(chat).first();
        if (ex && ex.phone) {
          await bale(env, 'sendMessage', { chat_id: chat, text: '✅ برنامه روی این گوشی هم وصل شد. اطلاعیه‌ها را همین‌جا دریافت می‌کنید.\n\nبرای لغو، بنویسید: لغو' });
          return json({ ok: true });
        }
      }
    }
    await bale(env, 'sendMessage', { chat_id: chat, reply_markup: ASK_KB,
      text: '🕌 به بازوی «همیار کاروان» خوش آمدید.\n\nبرای دریافت اطلاعیه‌های مهم سفر (هشدارها، تغییر ساعت‌ها، یادآوری تاریخ خروج و ...)، دکمه «📱 ارسال شماره من» را در پایین صفحه بزنید.\n\nشماره شما فقط برای اطلاع‌رسانی همیار کاروان استفاده می‌شود.' });
    return json({ ok: true });
  }
  return null;
}

/* ── پنل: آمار مشترکان، فهرست (فقط مدیر اصلی) و ارسال پیام ── */
export async function handleBaleAdmin(p, req, env, body, json, err, owner) {
  if (p === '/admin/bale' && req.method === 'GET') {
    const [t, c] = await env.DB.batch([
      env.DB.prepare('SELECT COUNT(*) total, SUM(active) active FROM bale_users'),
      env.DB.prepare("SELECT COALESCE(d.city, '') k, COUNT(*) n FROM bale_users b LEFT JOIN devices d ON d.dev = b.dev WHERE b.active = 1 GROUP BY k ORDER BY n DESC")
    ]);
    const out = { ...t.results[0], city: c.results, ready: !!env.BALE_TOKEN };
    if (owner) out.list = (await env.DB.prepare("SELECT b.name, b.phone, b.created, b.active, COALESCE(d.city, '') city FROM bale_users b LEFT JOIN devices d ON d.dev = b.dev ORDER BY b.created DESC LIMIT 5000").all()).results;
    return json(out);
  }
  if (p === '/admin/bale/send' && req.method === 'POST') {
    if (!env.BALE_TOKEN) return err('بازوی بله هنوز راه‌اندازی نشده است.', 503);
    const text = String(body.text || '').trim().slice(0, 3500), city = String(body.city || ''), after = +body.after || 0;
    if (!text) return err('متن پیام خالی است.');
    const where = 'b.active = 1 AND b.chat_id > ?' + (city ? ' AND d.city = ?' : '');
    const { results } = await env.DB.prepare(`SELECT b.chat_id FROM bale_users b LEFT JOIN devices d ON d.dev = b.dev WHERE ${where} ORDER BY b.chat_id LIMIT ${SEND_BATCH}`)
      .bind(...(city ? [after, city] : [after])).all();
    let sent = 0, failed = 0;
    for (const r of results) {
      const res = await bale(env, 'sendMessage', { chat_id: r.chat_id, text });
      if (res.ok) sent++;
      else { failed++; if (res.error_code === 403) await env.DB.prepare('UPDATE bale_users SET active = 0 WHERE chat_id = ?').bind(r.chat_id).run(); }
    }
    return json({ sent, failed, next: results.length === SEND_BATCH ? results[results.length - 1].chat_id : null });
  }
  return null;
}

/* یک بار بعد از ذخیره توکن: نشانی webhook را به بله معرفی می‌کند */
export async function baleSetup(env, origin) {
  return bale(env, 'setWebhook', { url: `${origin}/bale/hook/${env.BALE_HOOK}` });
}
