/* ══════════════════════════════════════════
   🏢 معرفی نماینده‌ی شرکت مجری از طریق بازوی بله — بدون حساب کاربری برای شرکت‌ها
   ۱. لینک عمومی ble.ir/HamyarKaravan_Bot?start=co (یا لینک اختصاصی یک شرکت ?start=c_کد)
   ۲. بازو قدم‌به‌قدم می‌پرسد: شماره‌ی خود فرستنده (تأیید بله)، شرکت، مدیرعامل، نمایندگان، آدرس، تلفن
   ۳. هیچ چیز مستقیم ثبت نمی‌شود: درخواست برای مدیر اصلی در بله (دکمه‌ی تأیید/رد) و در پنل می‌آید
   لایه‌های ضد شیطنت: شماره‌ی تأییدشده‌ی فرستنده، برچسب «درخواست تغییر» با مقایسه‌ی قبلی/جدید،
   خبر به نماینده‌ی قبلی، هر شماره فقط یک شرکت، مقایسه با فهرست مدیران کاروان، مسدود کردن شماره.
   فقط در D1 (هرگز در data.js یا GitHub عمومی نیست).
══════════════════════════════════════════ */
import { mgrPhone } from './mgr.js';

export const CO_LINK = 'https://ble.ir/HamyarKaravan_Bot?start=co';
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS co_reqs (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER NOT NULL, bale_name TEXT, phone TEXT, co_id INTEGER, co_name TEXT,
    inv INTEGER NOT NULL DEFAULT 0, data TEXT, step TEXT, state TEXT NOT NULL, flags TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL, decided INTEGER, by TEXT)`,
  `CREATE INDEX IF NOT EXISTS co_reqs_chat ON co_reqs (chat_id, state)`,
  `CREATE INDEX IF NOT EXISTS co_reqs_state ON co_reqs (state)`,
  `CREATE TABLE IF NOT EXISTS mgr_companies (id INTEGER PRIMARY KEY, name TEXT NOT NULL, ceo TEXT, rep_name TEXT, rep_phone TEXT, phone2 TEXT, note TEXT, updated INTEGER NOT NULL, by TEXT)`,
  `CREATE TABLE IF NOT EXISTS co_blocked (phone TEXT PRIMARY KEY, chat_id INTEGER, t INTEGER NOT NULL)`
];
let ready = false;
export async function coReqEnsure(env) {
  if (ready) return;
  await env.DB.batch(SCHEMA.map(q => env.DB.prepare(q)));
  for (const c of ['address TEXT', 'phone TEXT', 'reps TEXT', 'sub_phone TEXT', 'sub_chat INTEGER', 'inv TEXT']) { try { await env.DB.prepare('ALTER TABLE mgr_companies ADD COLUMN ' + c).run(); } catch (e) {} }
  ready = true;
}

const fa = s => String(s ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const FA = s => String(s ?? '').replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
export const coNorm = s => FA(s).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[ةۀ]/g, 'ه').replace(/[أإآ]/g, 'ا')
  .replace(/شرکت|مجری|خدمات|زیارتی|سیاحتی|گردشگری|جهانگردی|زیارت|سیر|سفر|کاروان|هواپیمایی|موسسه|مؤسسه|موسّسه|تور/g, '').replace(/[\s‌‏‎.,،\-_/()«»"']+/g, '').toLowerCase();
const sameCo = (a, b) => { const x = coNorm(a), y = coNorm(b); return !!x && !!y && (x === y || (Math.min(x.length, y.length) >= 3 && (x.includes(y) || y.includes(x)))); };
const randCode = () => [...crypto.getRandomValues(new Uint8Array(10))].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
const cfgGet = async (env, k) => { const r = await env.DB.prepare('SELECT v FROM config WHERE k = ?').bind(k).first(); return r ? r.v : null; };
const parse = s => { try { return JSON.parse(s || '{}') || {}; } catch (e) { return {}; } };
const coReps = r => { try { return JSON.parse(r.reps || '[]'); } catch (e) { return []; } };
const P = v => v ? fa(String(v).replace(/^00/, '+')) : '—';

/* دکمه‌ها (کیبورد معمولی؛ متن دکمه مثل پیام برمی‌گردد) */
const B = { me: '📱 ارسال شماره من', cancel: '❌ انصراف', skip: '⏭ رد کردن', none: 'ندارد', same: '📱 همان شماره‌ی خودم', more: '➕ نماینده‌ی دیگر', next: '✅ نه، ادامه',
  send: '✅ ارسال برای ستاد', redo: '🔄 از اول', newco: '🆕 شرکت من در فهرست نیست' };
const kb = (...rows) => ({ keyboard: [...rows.map(r => (Array.isArray(r) ? r : [r]).map(text => text === B.me ? { text, request_contact: true } : { text })), [{ text: B.cancel }]], resize_keyboard: true });
const NO_KB = { remove_keyboard: true };

const okName = v => v.length >= 3 && v.length <= 80 && /[آ-یa-z]/i.test(v) && !/\d{4,}/.test(FA(v));
const phNorm = v => mgrPhone(FA(v));
const okIr = v => /^09\d{9}$/.test(v);
const okIq = v => /^(07\d{9}|009647\d{9})$/.test(v);
const okTel = v => /^\d{7,16}$/.test(v);

/* متن خلاصه‌ی یک درخواست */
function sumText(d, coName) {
  return [`🏢 شرکت: ${coName}`, `👔 مدیرعامل: ${d.ceo || '—'}`,
    ...(d.reps || []).map((r, i) => `👤 نماینده ${fa(i + 1)}: ${r.name}\n    ایران: ${P(r.ir)} | عراق: ${P(r.iq)}`),
    `📍 آدرس: ${d.address || '—'}`, `☎️ تلفن شرکت: ${P(d.phone)}`].join('\n');
}

/* ── بازو (true = پیام رسیدگی شد) ── */
export async function coBaleHook(env, m, send) {
  await coReqEnsure(env);
  const chat = m.chat.id, from = m.from || {}, text = String(m.text || '').trim(), now = Date.now();
  const say = (t, k) => send(env, 'sendMessage', { chat_id: chat, text: t, reply_markup: k || NO_KB });
  const st = text.match(/^\/start\s+(co|c_([a-z0-9]{6,20}))$/i);
  let r = await env.DB.prepare("SELECT * FROM co_reqs WHERE chat_id = ? AND state = 'draft' AND updated > ?").bind(chat, now - 2 * 864e5).first();
  if (!st && !r) return false;
  if (st) {
    await env.DB.prepare("DELETE FROM co_reqs WHERE (chat_id = ? AND state = 'draft') OR (state = 'draft' AND updated < ?)").bind(chat, now - 2 * 864e5).run();
    let co = null;
    if (st[2]) {
      co = await env.DB.prepare('SELECT id, name FROM mgr_companies WHERE inv = ?').bind(st[2].toLowerCase()).first();
      if (!co) { await say('این لینک دیگر معتبر نیست. لطفاً از ستاد لینک تازه بگیرید.'); return true; }
    }
    const name = [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 60);
    await env.DB.prepare("INSERT INTO co_reqs (chat_id, bale_name, co_id, co_name, inv, data, step, state, created, updated) VALUES (?, ?, ?, ?, ?, '{}', 'phone', 'draft', ?, ?)")
      .bind(chat, name, co ? co.id : null, co ? co.name : null, co ? 1 : 0, now, now).run();
    await say(`🏢 معرفی نماینده‌ی شرکت مجری${co ? ` «${co.name}»` : ''} به ستاد همیار کاروان\n\nچند سؤال کوتاه می‌پرسم (حدود ۲ دقیقه). اطلاعات بعد از بررسی ستاد ثبت می‌شود و فقط مدیران کاروان آن را می‌بینند.\n\nقدم اول: دکمه‌ی «${B.me}» را در پایین صفحه بزنید.`, kb(B.me));
    return true;
  }
  const d = parse(r.data);
  const save = async (step, extra = {}) => {
    Object.assign(r, extra, { step });
    await env.DB.prepare('UPDATE co_reqs SET step = ?, data = ?, phone = ?, co_id = ?, co_name = ?, updated = ? WHERE id = ?')
      .bind(step, JSON.stringify(d), r.phone || null, r.co_id || null, r.co_name || null, now, r.id).run();
  };
  if (text === B.cancel || text === 'لغو' || text === '/stop') {
    await env.DB.prepare("DELETE FROM co_reqs WHERE id = ?").bind(r.id).run();
    await say('انصراف ثبت شد؛ چیزی فرستاده نشد. هر وقت خواستید دوباره از همان لینک شروع کنید.');
    return true;
  }
  const rep = () => (d.reps = d.reps || [], d.reps[d.reps.length - 1]);
  const ask = {
    co: () => say('نام شرکت مجری خود را بنویسید (بخشی از نام هم کافی است).', kb()),
    coname: () => say('نام کامل و دقیق شرکت مجری را بنویسید.', kb()),
    ceo: () => say(`✅ شرکت: ${r.co_name}\n\nنام و نام خانوادگی مدیرعامل شرکت را بنویسید.`, kb()),
    rname: () => say(`نام و نام خانوادگی نماینده${d.reps && d.reps.length ? ` ${fa(d.reps.length + 1)}` : ''} شرکت در عراق را بنویسید.`, kb()),
    rir: () => say('شماره‌ی موبایل ایرانِ این نماینده؟ (مثلاً ۰۹۱۲۳۴۵۶۷۸۹)', kb(/^09/.test(r.phone || '') ? [B.same, B.none] : [B.none])),
    riq: () => say('شماره‌ی موبایل عراقِ این نماینده؟ (مثلاً ۰۷۷۰۱۲۳۴۵۶۷)', kb(B.none)),
    rmore: () => say('نماینده‌ی دیگری هم دارید؟', kb([B.more, B.next])),
    addr: () => say('آدرس دفتر مرکزی شرکت را بنویسید.', kb(B.skip)),
    tel: () => say('تلفن ثابت دفتر شرکت؟ (با کد شهر، مثلاً ۰۲۱۸۸۸۸۸۸۸۸)', kb(B.skip)),
    confirm: () => say(`لطفاً بررسی کنید:\n\n${sumText(d, r.co_name)}\n\nاگر درست است «${B.send}» را بزنید.`, kb([B.send], [B.redo]))
  };
  const go = async step => { await save(step); await ask[step](); };
  const pickCo = async co => {
    /* هر شماره فقط نماینده‌ی یک شرکت */
    const other = await env.DB.prepare('SELECT name FROM mgr_companies WHERE sub_phone = ? AND id != ?').bind(r.phone, co.id || -1).first()
      || await env.DB.prepare("SELECT COALESCE(co_name, '') AS name FROM co_reqs WHERE phone = ? AND state = 'wait' AND COALESCE(co_id, -1) != ? AND co_name != ?").bind(r.phone, co.id || -1, co.name).first();
    if (other) { await say(`⛔ شماره‌ی شما قبلاً برای شرکت «${other.name}» ثبت شده است و هر شماره فقط می‌تواند اطلاعات یک شرکت را بفرستد.\n\nاگر اشتباهی شده، با ستاد تماس بگیرید.`); await env.DB.prepare('DELETE FROM co_reqs WHERE id = ?').bind(r.id).run(); return; }
    r.co_id = co.id || null; r.co_name = co.name; d.isNew = !co.id;
    await go('ceo');
  };

  if (r.step === 'phone') {
    if (!m.contact) { await say(`لطفاً دکمه‌ی «${B.me}» را در پایین صفحه بزنید.`, kb(B.me)); return true; }
    if (m.contact.user_id && from.id && m.contact.user_id !== from.id) { await say('لطفاً شماره‌ی خودتان را با دکمه‌ی پایین بفرستید.', kb(B.me)); return true; }
    r.phone = phNorm(m.contact.phone_number);
    if (await env.DB.prepare('SELECT 1 FROM co_blocked WHERE phone = ? OR chat_id = ?').bind(r.phone, chat).first()) {
      await env.DB.prepare('DELETE FROM co_reqs WHERE id = ?').bind(r.id).run();
      await say('امکان ثبت اطلاعات با این شماره وجود ندارد. لطفاً با ستاد تماس بگیرید.'); return true;
    }
    if (r.co_id) { await pickCo({ id: r.co_id, name: r.co_name }); return true; }
    await go('co'); return true;
  }
  if (m.contact) { await ask[r.step](); return true; }
  if (!text) { await say('لطفاً پاسخ را به صورت متن بنویسید.'); await ask[r.step](); return true; }

  switch (r.step) {
    case 'co': {
      if (text === B.newco) { await go('coname'); return true; }
      const all = (await env.DB.prepare('SELECT id, name FROM mgr_companies').all()).results;
      const exact = all.find(c => c.name === text);
      if (exact) { await pickCo(exact); return true; }
      const L = s => FA(s).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/شرکت|مجری/g, '').replace(/[\s‌‏‎.,،\-_/()«»"']+/g, '').toLowerCase();
      const q = L(text);
      const hits = q.length >= 2 ? all.filter(c => L(c.name).includes(q) || sameCo(c.name, text)).slice(0, 8) : [];
      if (!hits.length) { await say('شرکتی با این نام در فهرست ستاد پیدا نشد. بخش دیگری از نام را امتحان کنید، یا اگر شرکت شما در فهرست نیست دکمه‌ی پایین را بزنید.', kb(B.newco)); return true; }
      await say('شرکت خود را از دکمه‌های پایین انتخاب کنید:', kb(...hits.map(c => c.name), B.newco));
      return true;
    }
    case 'coname': {
      if (text.length < 3 || text.length > 150) { await say('نام شرکت را کامل بنویسید.', kb()); return true; }
      const all = (await env.DB.prepare('SELECT id, name FROM mgr_companies').all()).results;
      const ex = all.find(c => coNorm(c.name) === coNorm(text));
      await pickCo(ex || { id: null, name: text });
      return true;
    }
    case 'ceo':
      if (!okName(text)) { await say('نام و نام خانوادگی را درست بنویسید (فقط حروف).', kb()); return true; }
      d.ceo = text; d.reps = []; await go('rname'); return true;
    case 'rname':
      if (!okName(text)) { await say('نام و نام خانوادگی نماینده را درست بنویسید (فقط حروف).', kb()); return true; }
      d.reps = d.reps || []; d.reps.push({ name: text, ir: '', iq: '' }); await go('rir'); return true;
    case 'rir': {
      const v = text === B.none ? '' : text === B.same ? r.phone : phNorm(text);
      if (v && !okIr(v)) { await say('شماره‌ی موبایل ایران باید ۱۱ رقم و با ۰۹ شروع شود (مثلاً ۰۹۱۲۳۴۵۶۷۸۹).', kb(/^09/.test(r.phone || '') ? [B.same, B.none] : [B.none])); return true; }
      rep().ir = v; await go('riq'); return true;
    }
    case 'riq': {
      const v = text === B.none ? '' : phNorm(text);
      if (v && !okIq(v)) { await say('شماره‌ی عراق درست نیست؛ مثلاً ۰۷۷۰۱۲۳۴۵۶۷ یا +۹۶۴۷۷۰۱۲۳۴۵۶۷', kb(B.none)); return true; }
      if (!v && !rep().ir) { await say('حداقل یکی از شماره‌های ایران یا عراق لازم است. شماره‌ی عراق را بنویسید:', kb()); return true; }
      rep().iq = v;
      await go(d.reps.length >= 5 ? 'addr' : 'rmore'); return true;
    }
    case 'rmore':
      if (text === B.more) { await go('rname'); return true; }
      await go('addr'); return true;
    case 'addr':
      if (text !== B.skip && (text.length < 6 || text.length > 300)) { await say('آدرس را کامل‌تر بنویسید، یا «رد کردن» را بزنید.', kb(B.skip)); return true; }
      d.address = text === B.skip ? '' : text; await go('tel'); return true;
    case 'tel': {
      const v = text === B.skip ? '' : phNorm(text);
      if (v && !okTel(v)) { await say('شماره تلفن درست نیست؛ با کد شهر بنویسید یا «رد کردن» را بزنید.', kb(B.skip)); return true; }
      d.phone = v; await go('confirm'); return true;
    }
    case 'confirm':
      if (text === B.redo) { delete d.ceo; d.reps = []; delete d.address; delete d.phone; if (r.inv) await go('ceo'); else { r.co_id = null; r.co_name = null; await go('co'); } return true; }
      if (text !== B.send) { await ask.confirm(); return true; }
      await submit(env, r, d, send);
      await say('✅ اطلاعات برای ستاد فرستاده شد. پس از بررسی، نتیجه همین‌جا اعلام می‌شود.\n\nسپاس از همکاری شما 🌷');
      return true;
  }
  if (ask[r.step]) await ask[r.step]();
  return true;
}

/* بررسی‌های ضد شیطنت + خبر به مدیر اصلی و نماینده‌ی قبلی */
async function coFlags(env, r, d) {
  const f = [];
  if (r.inv) f.push({ k: 'inv', t: '🔗 از لینک اختصاصی همین شرکت فرستاده شده' });
  const co = r.co_id ? await env.DB.prepare('SELECT * FROM mgr_companies WHERE id = ?').bind(r.co_id).first() : null;
  if (!co) f.push({ k: 'new', t: '🆕 شرکت جدید (در فهرست ستاد نبود)' });
  else {
    const had = co.ceo || co.address || co.phone || coReps(co).length || co.rep_name || co.rep_phone;
    if (had) {
      if (co.sub_phone && co.sub_phone === r.phone) f.push({ k: 'self', t: '✏️ به‌روزرسانی توسط همان نماینده‌ی قبلی' });
      else f.push({ k: 'change', t: '⚠️ درخواست تغییر: این شرکت از قبل اطلاعات تأییدشده دارد' });
    }
  }
  const mp = await env.DB.prepare('SELECT name, company FROM mgr_people WHERE phone = ?').bind(r.phone).first();
  let trips = [];
  try { trips = (await env.DB.prepare('SELECT DISTINCT company FROM mgr_trips WHERE (phone = ?1 OR phone_fix = ?1) AND company IS NOT NULL LIMIT 10').bind(r.phone).all()).results.map(x => x.company); } catch (e) {}
  const cos = [...new Set([mp && mp.company, ...trips].filter(Boolean))];
  if (cos.length) {
    const mine = cos.some(c => sameCo(c, r.co_name)), others = cos.filter(c => !sameCo(c, r.co_name));
    if (mine) f.push({ k: 'match', t: `✅ فرستنده${mp ? ` (${mp.name})` : ''} در فهرست مدیران کاروانِ همین شرکت است` });
    if (others.length) f.push({ k: 'other', t: `❗ فرستنده${mp ? ` (${mp.name})` : ''} مدیر کاروانِ شرکت دیگری است: ${others.slice(0, 3).join('، ')}` });
  }
  return { f, co };
}
async function submit(env, r, d, send) {
  const now = Date.now();
  const { f, co } = await coFlags(env, r, d);
  /* درخواست قبلیِ همین شماره برای همین شرکت جایگزین می‌شود */
  await env.DB.batch([
    env.DB.prepare("UPDATE co_reqs SET state = 'replaced', decided = ? WHERE phone = ? AND state = 'wait' AND COALESCE(co_name, '') = ?").bind(now, r.phone, r.co_name || ''),
    env.DB.prepare("UPDATE co_reqs SET state = 'wait', step = NULL, flags = ?, data = ?, updated = ? WHERE id = ?").bind(JSON.stringify(f), JSON.stringify(d), now, r.id)
  ]);
  const owner = await cfgGet(env, 'owner_chat');
  if (owner) {
    let old = '';
    if (co && f.some(x => x.k === 'change' || x.k === 'self')) old = `\n\n— اطلاعات فعلی —\n${sumText({ ceo: co.ceo, address: co.address, phone: co.phone, reps: coReps(co) }, co.name)}`;
    const txt = `📥 درخواست ثبت اطلاعات شرکت مجری (شماره ${fa(r.id)})\n\nفرستنده: ${r.bale_name || '—'} — ${P(r.phone)} (تأیید بله)\n${f.map(x => x.t).join('\n')}\n\n— اطلاعات جدید —\n${sumText(d, r.co_name)}${old}`;
    await send(env, 'sendMessage', { chat_id: +owner, text: txt.slice(0, 4000), reply_markup: { inline_keyboard: [[{ text: '✅ تأیید', callback_data: `cr:ok:${r.id}` }, { text: '❌ رد', callback_data: `cr:no:${r.id}` }], [{ text: '🚫 رد و مسدود کردن این شماره', callback_data: `cr:bl:${r.id}` }]] } }).catch(() => {});
  }
  /* نماینده‌ی قبلی (اگر کس دیگری است) باخبر می‌شود */
  if (co && co.sub_chat && co.sub_phone !== r.phone)
    await send(env, 'sendMessage', { chat_id: co.sub_chat, text: `🔔 اطلاع: کسی با شماره‌ی ${P(r.phone)} درخواست تغییر اطلاعات شرکت «${co.name}» را به ستاد همیار کاروان فرستاده است.\n\nاگر این درخواست از طرف شرکت شما نیست، لطفاً همین حالا به ستاد خبر دهید. تا تأیید ستاد چیزی تغییر نمی‌کند.` }).catch(() => {});
}

/* تصمیم مدیر (از دکمه‌ی بله یا پنل): ok | no | bl */
export async function coDecide(env, id, act, who, send) {
  await coReqEnsure(env);
  const now = Date.now();
  const r = await env.DB.prepare('SELECT * FROM co_reqs WHERE id = ?').bind(+id).first();
  if (!r) return { err: 'این درخواست پیدا نشد.' };
  if (r.state !== 'wait') return { err: r.state === 'ok' ? 'این درخواست قبلاً تأیید شده است.' : 'این درخواست قبلاً بررسی شده است.', done: true };
  const d = parse(r.data);
  const q = [];
  if (act === 'ok') {
    const reps = JSON.stringify((d.reps || []).slice(0, 12));
    let co = r.co_id ? await env.DB.prepare('SELECT id FROM mgr_companies WHERE id = ?').bind(r.co_id).first() : null;
    if (!co && r.co_name) co = await env.DB.prepare('SELECT id FROM mgr_companies WHERE name = ?').bind(r.co_name).first();
    const by = 'بله: ' + r.phone + ' / ' + who;
    if (co) q.push(env.DB.prepare(`UPDATE mgr_companies SET ceo = COALESCE(NULLIF(?1, ''), ceo), address = COALESCE(NULLIF(?2, ''), address), phone = COALESCE(NULLIF(?3, ''), phone),
      reps = ?4, rep_name = NULL, rep_phone = NULL, phone2 = NULL, sub_phone = ?5, sub_chat = ?6, updated = ?7, by = ?8 WHERE id = ?9`)
      .bind(d.ceo || '', d.address || '', d.phone || '', reps, r.phone, r.chat_id, now, by, co.id));
    else q.push(env.DB.prepare('INSERT INTO mgr_companies (name, ceo, address, phone, reps, sub_phone, sub_chat, updated, by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(r.co_name, d.ceo || '', d.address || '', d.phone || '', reps, r.phone, r.chat_id, now, by));
    /* این شماره دیگر نماینده‌ی شرکت دیگری نیست */
    q.push(env.DB.prepare('UPDATE mgr_companies SET sub_phone = NULL, sub_chat = NULL WHERE sub_phone = ? AND name != ? AND id != ?').bind(r.phone, r.co_name, co ? co.id : -1));
  }
  if (act === 'bl') q.push(env.DB.prepare('INSERT OR REPLACE INTO co_blocked (phone, chat_id, t) VALUES (?, ?, ?)').bind(r.phone, r.chat_id, now));
  q.push(env.DB.prepare('UPDATE co_reqs SET state = ?, decided = ?, by = ? WHERE id = ?').bind(act === 'ok' ? 'ok' : act === 'bl' ? 'blocked' : 'no', now, who, r.id));
  await env.DB.batch(q);
  if (send) await send(env, 'sendMessage', { chat_id: r.chat_id, reply_markup: NO_KB, text: act === 'ok'
    ? `✅ اطلاعات شرکت «${r.co_name}» توسط ستاد تأیید و ثبت شد. سپاس از همکاری شما 🌷\n\nاگر بعداً نماینده یا شماره‌ها تغییر کرد، دوباره از همان لینک اقدام کنید.`
    : `اطلاعاتی که برای شرکت «${r.co_name}» فرستاده بودید توسط ستاد تأیید نشد. برای پیگیری با ستاد تماس بگیرید.` }).catch(() => {});
  return { ok: true, name: r.co_name };
}

/* دکمه‌های پیام مدیر اصلی در بله */
export async function coBaleCallback(env, cq, send) {
  const m = String(cq.data || '').match(/^cr:(ok|no|bl):(\d+)$/);
  if (!m) return false;
  const owner = await cfgGet(env, 'owner_chat'), chat = cq.message && cq.message.chat ? cq.message.chat.id : null;
  if (!owner || String(chat) !== String(owner) || (cq.from && cq.from.id && String(cq.from.id) !== String(owner))) {
    await send(env, 'answerCallbackQuery', { callback_query_id: cq.id, text: 'دسترسی ندارید.' }).catch(() => {});
    return true;
  }
  const res = await coDecide(env, m[2], m[1], 'مدیر (بله)', send);
  const label = res.err ? res.err : m[1] === 'ok' ? `✅ تأیید و ثبت شد: ${res.name}` : m[1] === 'bl' ? '🚫 رد شد و شماره مسدود شد' : '❌ رد شد';
  await send(env, 'answerCallbackQuery', { callback_query_id: cq.id, text: label }).catch(() => {});
  if (cq.message && cq.message.message_id) {
    const t = String(cq.message.text || '').slice(0, 3800) + '\n\n' + label;
    const e = await send(env, 'editMessageText', { chat_id: chat, message_id: cq.message.message_id, text: t }).catch(() => null);
    if (!e || !e.ok) await send(env, 'sendMessage', { chat_id: chat, text: label }).catch(() => {});
  }
  return true;
}

/* ── پنل (دسترسی «mgrco») ── */
export async function coReqAdmin(p, req, env, body, json, err, who, send) {
  if (!['/admin/mgr/co/req', '/admin/mgr/co/inv', '/admin/mgr/co/unblock'].includes(p)) return null;
  await coReqEnsure(env);
  if (p === '/admin/mgr/co/req' && req.method === 'POST') {
    if (!['ok', 'no', 'bl'].includes(body.act)) return err('درخواست نامعتبر');
    const r = await coDecide(env, body.id, body.act, who, send);
    return r.err ? err(r.err) : json(r);
  }
  if (p === '/admin/mgr/co/inv' && req.method === 'POST') {
    const c = await env.DB.prepare('SELECT id, inv FROM mgr_companies WHERE id = ?').bind(+body.id).first();
    if (!c) return err('این شرکت پیدا نشد.');
    let inv = c.inv;
    if (!inv || body.renew) { inv = randCode(); await env.DB.prepare('UPDATE mgr_companies SET inv = ? WHERE id = ?').bind(inv, c.id).run(); }
    return json({ ok: true, url: `https://ble.ir/HamyarKaravan_Bot?start=c_${inv}` });
  }
  if (p === '/admin/mgr/co/unblock' && req.method === 'POST') {
    await env.DB.prepare('DELETE FROM co_blocked WHERE phone = ?').bind(String(body.phone || '')).run();
    return json({ ok: true });
  }
  return null;
}
/* اطلاعات اضافه برای GET /admin/mgr/co */
export async function coReqInfo(env) {
  await coReqEnsure(env);
  const wait = (await env.DB.prepare("SELECT * FROM co_reqs WHERE state = 'wait' ORDER BY updated DESC LIMIT 200").all()).results;
  const done = (await env.DB.prepare("SELECT id, co_name, phone, bale_name, state, decided, by FROM co_reqs WHERE state IN ('ok','no','blocked') ORDER BY decided DESC LIMIT 30").all()).results;
  const drafts = (await env.DB.prepare("SELECT COUNT(*) AS n FROM co_reqs WHERE state = 'draft' AND updated > ?").bind(Date.now() - 2 * 864e5).first()).n;
  const blocked = (await env.DB.prepare('SELECT phone, t FROM co_blocked ORDER BY t DESC').all()).results;
  const subs = (await env.DB.prepare('SELECT id, sub_phone, inv FROM mgr_companies').all()).results;
  const owner = !!(await cfgGet(env, 'owner_chat'));
  return {
    link: CO_LINK, owner, drafts, blocked, done,
    wait: wait.map(r => ({ id: r.id, co_id: r.co_id, co_name: r.co_name, phone: r.phone, bale_name: r.bale_name || '', data: parse(r.data), flags: (() => { try { return JSON.parse(r.flags || '[]'); } catch (e) { return []; } })(), t: r.updated })),
    subs: Object.fromEntries(subs.map(s => [s.id, { bot: !!s.sub_phone, inv: !!s.inv }]))
  };
}
