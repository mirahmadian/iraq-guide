/* ══════════════════════════════════════════
   سامانه «نواقص هتل‌ها» (team.html) روی Cloudflare — جایگزین سرور 188 (/opt/hotel-reports)
   همان API قبلی، با D1 به‌جای sqlite. چون سرور داخل ایران از عراق و بیرون ایران مدام قطع می‌شد، به اینجا منتقل شد.
   تفاوت‌ها با سرور قدیم:
   - اکسل روی گوشی/رایانه‌ی خود کاربر خوانده و ساخته می‌شود (team-xlsx.js)؛ اینجا فقط JSON می‌آید و می‌رود
   - فیلم فشرده نمی‌شود (ffmpeg نیست) و همان فایل گوشی نگه داشته می‌شود؛ تکه‌های عکس و فیلم در D1 جدا (MDB)
   - رمزهای قدیمی (scrypt) در اولین ورود به PBKDF2 تبدیل می‌شوند
══════════════════════════════════════════ */
import { scrypt } from './scrypt.js';
import { logError } from '../errlog.js';

const RP_ID = 'mirahmadian.github.io', ORIGIN = 'https://' + RP_ID;
const SESSION_DAYS = 30, KEEP_DAYS = 7;
const MAX_IMAGE = 12 << 20, MAX_VIDEO = 60 << 20, PART_MAX = 256 << 10;
const OWNER_REPO = 'mirahmadian/iraq-guide';

/* ── helpers ── */
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const te = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = s => Uint8Array.from(String(s).match(/../g) || [], h => parseInt(h, 16));
const b64u = b => { let s = ''; for (const x of new Uint8Array(b)) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = s => { s = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const sha = async b => new Uint8Array(await crypto.subtle.digest('SHA-256', typeof b === 'string' ? te.encode(b) : b));
const rand = n => crypto.getRandomValues(new Uint8Array(n));
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const json = s => { try { return JSON.parse(s || '[]'); } catch (e) { return []; } };
const nul = v => v === undefined ? null : v;

let DB, MDB, ENV;
const prep = (sql, ...a) => DB.prepare(sql).bind(...a.map(nul));
const one = (sql, ...a) => prep(sql, ...a).first();
const all = async (sql, ...a) => (await prep(sql, ...a).all()).results;
const run = (sql, ...a) => prep(sql, ...a).run();

/* ── national code ── */
const toLatin = s => String(s ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
function nidValid(c) {
  if (!/^\d{10}$/.test(c) || /^(\d)\1{9}$/.test(c)) return false;
  const r = [...c.slice(0, 9)].reduce((a, d, i) => a + +d * (10 - i), 0) % 11;
  return +c[9] === (r < 2 ? r : 11 - r);
}
function nidNormalize(v) {
  const d = toLatin(v).replace(/\D/g, '');
  if (d.length >= 8 && d.length < 10 && nidValid(d.padStart(10, '0'))) return d.padStart(10, '0');
  return d;
}

/* ── passwords: new = PBKDF2 (salt starts «p2$»), old = scrypt from server 188 ── */
const pwNorm = pw => toLatin(String(pw).trim());
async function pbkdf2(pw, salt) {
  const k = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: te.encode(salt), iterations: 100000 }, k, 256));
}
async function hashPassword(pw) { const salt = 'p2$' + hex(rand(16)); return { salt, hash: await pbkdf2(pwNorm(pw), salt) }; }
async function checkPassword(u, pw) {
  if (!u.hash) return false;
  if (String(u.salt).startsWith('p2$')) return await pbkdf2(pwNorm(pw), u.salt) === u.hash;
  for (const x of [...new Set([pwNorm(pw), String(pw)])]) {
    if (hex(await scrypt(x, u.salt)) === u.hash) {
      const h = await hashPassword(pw); await run('UPDATE users SET salt = ?, hash = ? WHERE id = ?', h.salt, h.hash, u.id);
      return true;
    }
  }
  return false;
}
const tempPassword = () => String(100000 + (new Uint32Array(rand(4).buffer)[0] % 900000));

/* ── sessions (the app keeps the token, the DB keeps its hash) ── */
async function createSession(userId) {
  const tok = hex(rand(32)), now = Date.now();
  await DB.batch([prep('INSERT INTO sessions (tok, user_id, exp) VALUES (?, ?, ?)', hex(await sha(tok)), userId, now + SESSION_DAYS * 864e5),
    prep('UPDATE users SET last_login = ? WHERE id = ?', now, userId)]);
  return tok;
}
async function sessionUser(tok) {
  if (!/^[0-9a-f]{64}$/.test(tok || '')) return null;
  const u = await one('SELECT u.*, s.exp FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.tok = ?', hex(await sha(tok)));
  return !u || u.exp < Date.now() || !u.active ? null : u;
}
const endSession = async tok => { if (tok) await run('DELETE FROM sessions WHERE tok = ?', hex(await sha(tok))); };
const endAll = userId => prep('DELETE FROM sessions WHERE user_id = ?', userId);

/* ── login throttling (key = hash of ip|nid; raw IPs are not stored) ── */
/* سقف تعداد در یک بازه (برای پیشنهادهای اطلاعات هتل) */
async function limited(key, max, win) {
  const now = Date.now(), t = await one('SELECT * FROM tries WHERE k = ?', 'L:' + key);
  if (!t || t.first + win * 1000 < now) { await run('INSERT OR REPLACE INTO tries (k, n, until, first) VALUES (?, 1, 0, ?)', 'L:' + key, now); return false; }
  if (t.n >= max) return true;
  await run('UPDATE tries SET n = n + 1 WHERE k = ?', 'L:' + key); return false;
}
const HCITY = { 'نجف اشرف': 'najaf', 'کربلای معلی': 'karbala', 'کاظمین': 'kadhimiya', 'سامراء': 'samarra' };
async function throttled(key) { const t = await one('SELECT * FROM tries WHERE k = ?', key); return !!(t && t.until > Date.now()); }
async function failed(key) {
  const now = Date.now(); let t = await one('SELECT * FROM tries WHERE k = ?', key);
  if (!t || now - t.first > 15 * 60e3) t = { n: 0, until: 0, first: now };
  t.n++; if (t.n >= 8) { t.until = now + 15 * 60e3; t.n = 0; t.first = now; }
  await run('INSERT OR REPLACE INTO tries (k, n, until, first) VALUES (?, ?, ?, ?)', key, t.n, t.until, t.first);
}
const tryKey = async (req, who) => hex(await sha((req.headers.get('cf-connecting-ip') || '') + '|' + who)).slice(0, 32);

/* ── WebAuthn (fingerprint / face / screen lock); the browser sends the public key as SPKI ── */
async function newChallenge(kind, userId = null) {
  const c = b64u(rand(32)), now = Date.now();
  await DB.batch([prep('INSERT INTO challenges (c, kind, user_id, exp) VALUES (?, ?, ?, ?)', c, kind, userId, now + 5 * 60e3), prep('DELETE FROM challenges WHERE exp < ?', now)]);
  return c;
}
async function takeChallenge(c, kind) {
  const v = await one('DELETE FROM challenges WHERE c = ? RETURNING *', String(c || ''));
  if (!v || v.kind !== kind || v.exp < Date.now()) throw new Error('زمان تأیید تمام شد. دوباره امتحان کنید.');
  return v;
}
async function checkClientAndAuth(clientDataJSON, authData, type, kind) {
  const cd = JSON.parse(new TextDecoder().decode(unb64u(clientDataJSON)));
  if (cd.type !== type) throw new Error('نوع درخواست نامعتبر');
  if (cd.origin !== ORIGIN) throw new Error('آدرس صفحه نامعتبر');
  const ch = await takeChallenge(cd.challenge, kind);
  const ad = unb64u(authData);
  if (ad.length < 37 || !eq(ad.subarray(0, 32), await sha(RP_ID))) throw new Error('شناسه‌ی سامانه نامعتبر');
  if (!(ad[32] & 0x01) || !(ad[32] & 0x04)) throw new Error('اثر انگشت یا قفل گوشی تأیید نشد');
  return { ch, ad, counter: new DataView(ad.buffer, ad.byteOffset).getUint32(33) };
}
const ALG = { '-7': { name: 'ECDSA', namedCurve: 'P-256' }, '-257': { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } };
const importPk = (spki, alg) => crypto.subtle.importKey('spki', spki, ALG[alg], false, ['verify']);
/* WebAuthn ES256 signatures are DER; WebCrypto wants r||s */
function derToRaw(der) {
  let p = 2; if (der[1] & 0x80) p += der[1] & 0x7f;
  const int = () => { p++; const n = der[p++]; let v = der.subarray(p, p + n); p += n; while (v.length > 32 && v[0] === 0) v = v.subarray(1); const o = new Uint8Array(32); o.set(v, 32 - v.length); return o; };
  const r = int(), s = int(), out = new Uint8Array(64); out.set(r); out.set(s, 32); return out;
}
async function registerOptions(u) {
  const exclude = (await all('SELECT id FROM passkeys WHERE user_id = ?', u.id)).map(r => ({ type: 'public-key', id: r.id }));
  return {
    challenge: await newChallenge('reg', u.id), rp: { id: RP_ID, name: 'پایش خدمات هتل‌ها' },
    user: { id: b64u(te.encode('u' + u.id)), name: u.nid, displayName: u.name },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged', requireResidentKey: false },
    hints: ['client-device'], timeout: 60000, attestation: 'none', excludeCredentials: exclude
  };
}
async function registerVerify(u, b) {
  const { ch, counter } = await checkClientAndAuth(b.clientDataJSON, b.authenticatorData, 'webauthn.create', 'reg');
  if (ch.user_id !== u.id) throw new Error('درخواست نامعتبر');
  if (![-7, -257].includes(+b.alg)) throw new Error('این روش امضا پشتیبانی نمی‌شود');
  const key = unb64u(b.publicKey);
  try { await importPk(key, +b.alg); } catch (e) { throw new Error('کلید نامعتبر'); }
  const id = String(b.id || '');
  if (!/^[A-Za-z0-9_-]{16,512}$/.test(id)) throw new Error('شناسه‌ی کلید نامعتبر');
  await run('INSERT OR REPLACE INTO passkeys (id, user_id, pubkey, alg, counter, label, created) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, u.id, btoa(String.fromCharCode(...key)), +b.alg, counter, String(b.label || '').slice(0, 60), Date.now());
}
async function loginOptions(nid) {
  let allow = [];
  if (nid) { const u = await one('SELECT id FROM users WHERE nid = ? AND active = 1', nid); if (u) allow = (await all('SELECT id FROM passkeys WHERE user_id = ?', u.id)).map(r => ({ type: 'public-key', id: r.id })); }
  return { challenge: await newChallenge('login'), rpId: RP_ID, allowCredentials: allow, userVerification: 'required', hints: ['client-device'], timeout: 60000 };
}
async function loginVerify(b) {
  const pk = await one('SELECT * FROM passkeys WHERE id = ?', String(b.id || ''));
  if (!pk) throw new Error('این اثر انگشت در سامانه ثبت نشده است. یک بار با رمز وارد شوید و آن را فعال کنید.');
  const { ad, counter } = await checkClientAndAuth(b.clientDataJSON, b.authenticatorData, 'webauthn.get', 'login');
  const cdh = await sha(unb64u(b.clientDataJSON)), data = new Uint8Array(ad.length + 32); data.set(ad); data.set(cdh, ad.length);
  const key = await importPk(Uint8Array.from(atob(pk.pubkey), c => c.charCodeAt(0)), pk.alg);
  let sig = unb64u(b.signature); if (pk.alg === -7) sig = derToRaw(sig);
  const ok = await crypto.subtle.verify(pk.alg === -7 ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5', key, sig, data);
  if (!ok) throw new Error('امضای اثر انگشت نامعتبر است.');
  if (counter && pk.counter && counter <= pk.counter) throw new Error('این کلید مشکوک به کپی است. با رمز وارد شوید.');
  await run('UPDATE passkeys SET counter = ?, last_used = ? WHERE id = ?', counter, Date.now(), pk.id);
  const u = await one('SELECT * FROM users WHERE id = ? AND active = 1', pk.user_id);
  if (!u) throw new Error('حساب کاربری غیرفعال است.');
  return u;
}

/* ── form ── */
const DEFAULT_FORM = (() => {
  const HK = ['به سرپرست خانه‌داری اطلاع داده شد', 'اتاق دوباره نظافت شد', 'ملحفه و حوله تعویض شد', 'با مدیر هتل هماهنگ شد'];
  const TK = ['به تأسیسات هتل اطلاع داده شد', 'تعمیرکار آمد و تعمیر کرد', 'اتاق زائر عوض شد', 'با مدیر هتل هماهنگ شد'];
  const FD = ['با مدیر رستوران صحبت شد', 'غذا جایگزین شد', 'به شرکت مجری اطلاع داده شد', 'به ناظر تغذیه گزارش شد'];
  const TR = ['با شرکت سیاحه تماس گرفته شد', 'اتوبوس جایگزین آمد', 'به ناظر نقل گزارش شد'];
  return { title: 'گزارش هفتگی نواقص', sections: [
    { id: 'hk', title: 'اسکان — خانه‌داری', emoji: '🧹', questions: [
      { id: 'q1', emoji: '🛏️', text: 'نظافت اتاق‌ها و تعویض ملحفه و حوله', type: 'rating', reasons: ['اتاق نظافت نشد', 'ملحفه یا حوله تعویض نشد', 'زباله تخلیه نشد', 'بوی نامطبوع'], actions: HK },
      { id: 'q2', emoji: '🚽', text: 'نظافت سرویس‌های بهداشتی و فضاهای عمومی', type: 'rating', reasons: ['سرویس کثیف بود', 'لابی و راهرو کثیف بود', 'نمازخانه نامرتب بود'], actions: HK },
      { id: 'q3', emoji: '🧴', text: 'لوازم مصرفی اتاق کامل بود؟', type: 'yesno', good: 'yes', reasons: ['صابون و شامپو نبود', 'دستمال کاغذی نبود', 'آب معدنی نبود'], actions: HK }]},
    { id: 'tk', title: 'اسکان — تأسیسات', emoji: '🔧', questions: [
      { id: 'q4', emoji: '🚿', text: 'آب گرم و لوله‌کشی', type: 'rating', reasons: ['آب گرم قطع شد', 'نشتی آب', 'گرفتگی فاضلاب', 'فشار آب کم'], actions: TK },
      { id: 'q5', emoji: '❄️', text: 'سرمایش و گرمایش', type: 'rating', reasons: ['کولر خراب', 'صدای زیاد', 'دما تنظیم نمی‌شد'], actions: TK },
      { id: 'q6', emoji: '🛗', text: 'آسانسورها سالم بودند؟', type: 'yesno', good: 'yes', reasons: ['یک آسانسور خراب بود', 'معطلی طولانی'], actions: TK, na: 'آسانسور ندارد' },
      { id: 'q7', emoji: '💡', text: 'برق و روشنایی', type: 'choice', options: [{ l: 'بدون مشکل', bad: false }, { l: 'قطعی کوتاه', bad: true }, { l: 'قطعی طولانی', bad: true }], reasons: ['لامپ اتاق سوخته بود', 'پریز خراب'], actions: TK }]},
    { id: 'fd', title: 'تغذیه', emoji: '🍽️', questions: [
      { id: 'q8', emoji: '🍲', text: 'کیفیت و طبخ غذا', type: 'rating', reasons: ['خام یا بیش از حد پخته', 'طعم نامناسب', 'غذا سرد بود', 'تکراری'], actions: FD },
      { id: 'q9', emoji: '⚖️', text: 'مقدار غذا و سهمیه', type: 'rating', reasons: ['سهمیه کم', 'کمبود نان', 'کمبود برنج'], actions: FD },
      { id: 'q10', emoji: '⏰', text: 'وعده‌ها سر وقت سرو شد؟', type: 'yesno', good: 'yes', reasons: ['کمتر از نیم ساعت تأخیر', 'نیم تا یک ساعت تأخیر', 'بیش از یک ساعت تأخیر'], actions: FD },
      { id: 'q11', emoji: '📋', text: 'غذا مطابق برنامه‌ی غذایی بود؟', type: 'yesno', good: 'yes', reasons: ['غذای دیگری سرو شد', 'مخلفات کامل نبود'], actions: FD },
      { id: 'q12', emoji: '💧', text: 'آب آشامیدنی', type: 'choice', options: [{ l: 'کافی', bad: false }, { l: 'کمبود جزئی', bad: true }, { l: 'کمبود شدید', bad: true }], reasons: ['آب خنک نبود', 'تاریخ انقضا گذشته بود'], actions: FD }]},
    { id: 'tr', title: 'نقل', emoji: '🚌', questions: [
      { id: 'q13', emoji: '🕒', text: 'اتوبوس‌ها سر وقت حاضر شدند؟', type: 'yesno', good: 'yes', reasons: ['تأخیر کمتر از نیم ساعت', 'تأخیر بیش از نیم ساعت', 'اتوبوس نیامد'], actions: TR, na: 'جابه‌جایی نداشتیم' },
      { id: 'q14', emoji: '🚍', text: 'وضعیت اتوبوس‌ها', type: 'rating', reasons: ['کولر خراب', 'اتوبوس کثیف', 'صندلی خراب'], actions: TR, na: 'جابه‌جایی نداشتیم' }]}]};
})();
const pickOf = (qn, a) => qn.pick && a && String(a.v) === qn.pick.on ? String(a.pick || '').replace(/\s+/g, ' ').trim().slice(0, 100) : '';
/* فهرست نام‌ها برای سؤال‌هایی که نام نفر می‌پرسند: اول نام‌های اکسل همین ورودی (ستون آشپز/مدیر ثابت)، بعد عوامل فعال همان هتل، بعد بقیه‌ی منطقه */
async function pickPeople(form, e) {
  const roles = [...new Set(form.sections.flatMap(s => s.questions).filter(q => q.pick).map(q => q.pick.role))];
  const out = {};
  if (!roles.length) return out;
  const rows = await all(`SELECT first, last, role, hotel FROM staff WHERE region_id = ? AND status = 'active' AND role IN (${roles.map(() => '?').join(',')}) ORDER BY last, first`, e.region_id, ...roles);
  const H = normName(e.hotel);
  for (const role of roles) {
    const seen = new Set(), list = [];
    const add = (name, tag) => { const n = normName(name).slice(0, 80); if (n.length > 2 && !seen.has(n)) { seen.add(n); list.push({ n, tag }); } };
    const xl = role === 'آشپز' ? e.cook : role === 'مدیر ثابت' ? e.home_mgr : '';
    for (const n of String(xl || '').split(/[،,\/\n]+|\s-\s/)) add(n, 'xl');
    const mine = rows.filter(r => r.role === role);
    for (const r of mine.filter(r => normName(r.hotel) === H)) add(`${r.first} ${r.last}`, 'hotel');
    for (const r of mine) add(`${r.first} ${r.last}`, '');
    out[role] = list.slice(0, 300);
  }
  return out;
}
/* یک فرم واحد برای همه‌ی شهرها و مناطق (team_cfg.form) که سرپرست مناطق می‌سازد؛ فرم‌های قدیمیِ جدا برای هر منطقه فقط پشتیبان‌اند */
async function formOf() {
  const g = await one("SELECT v FROM team_cfg WHERE k = 'form'");
  if (g) return JSON.parse(g.v);
  const r = await one('SELECT json FROM forms ORDER BY updated DESC LIMIT 1');
  return r ? JSON.parse(r.json) : DEFAULT_FORM;
}
/* نقش‌های عوامل در همه‌ی مناطق (برای «نام نفر را هم بپرس») */
async function allStaffRoles() {
  const set = new Set(STAFF_ROLES);
  for (const c of await all('SELECT roles FROM staff_cfg')) for (const r of json(c.roles) || []) set.add(r);
  return [...set];
}
const RATING = { great: 'عالی', good: 'خوب', mid: 'متوسط', poor: 'ضعیف' };
function verdict(qn, v) {
  if (v == null || v === '') return null;
  if (v === 'na') return 'na';
  if (qn.type === 'rating') return v === 'mid' || v === 'poor' ? 'bad' : RATING[v] ? 'good' : null;
  if (qn.type === 'yesno') return v === qn.good ? 'good' : v === 'yes' || v === 'no' ? 'bad' : null;
  const o = (qn.options || []).find(o => o.l === v); return o ? (o.bad ? 'bad' : 'good') : null;
}
const answerLabel = (qn, v) => v === 'na' ? (qn.na || 'موضوعیت ندارد') : qn.type === 'rating' ? RATING[v] : qn.type === 'yesno' ? (v === 'yes' ? 'بله' : 'خیر') : v;
function validForm(f) {
  if (!f || typeof f !== 'object' || !Array.isArray(f.sections) || !f.sections.length) fail(400, 'فرم باید دست‌کم یک بخش داشته باشد.');
  const ids = new Set(), str = (s, n) => String(s ?? '').slice(0, n), rid = n => hex(rand(n));
  const out = { title: str(f.title, 120) || 'گزارش نواقص', sections: [] };
  for (const s of f.sections) {
    const sec = { id: str(s.id, 40) || 's' + rid(3), title: str(s.title, 80) || 'بخش', emoji: str(s.emoji, 8), questions: [] };
    for (const qn of s.questions || []) {
      let id = str(qn.id, 40); if (!id || ids.has(id)) id = 'q' + rid(4); ids.add(id);
      const type = ['rating', 'yesno', 'choice'].includes(qn.type) ? qn.type : 'rating';
      const o = { id, emoji: str(qn.emoji, 8), text: str(qn.text, 200) || 'سؤال', type,
        reasons: (qn.reasons || []).map(x => str(x, 120)).filter(Boolean).slice(0, 30), actions: (qn.actions || []).map(x => str(x, 120)).filter(Boolean).slice(0, 30) };
      if (type === 'yesno') o.good = qn.good === 'no' ? 'no' : 'yes';
      if (type === 'choice') { o.options = (qn.options || []).map(x => ({ l: str(x.l, 80), bad: !!x.bad })).filter(x => x.l).slice(0, 12); if (o.options.length < 2) fail(400, `سؤال «${o.text}» دست‌کم دو پاسخ آماده لازم دارد.`); }
      if (qn.na) o.na = str(qn.na, 60);
      /* بعد از یک پاسخ مشخص، نام نفر پرسیده می‌شود (از فهرست عوامل همان نقش، یا نوشتن دستی) */
      if (qn.pick && (type === 'yesno' || type === 'choice')) {
        const role = str(qn.pick.role, 40).trim(), on = str(qn.pick.on, 80);
        const okOn = type === 'yesno' ? ['yes', 'no'].includes(on) : o.options.some(x => x.l === on);
        if (role && okOn) o.pick = { role, on, label: str(qn.pick.label, 80).trim() };
      }
      sec.questions.push(o);
    }
    out.sections.push(sec);
  }
  return out;
}

/* ── access helpers ── */
async function fmEntry(u, entryId) {
  const e = await one('SELECT e.*, w.title AS week, w.region_id FROM entries e JOIN weeks w ON w.id = e.week_id JOIN assign a ON a.entry_id = e.id WHERE e.id = ? AND a.user_id = ?', entryId, u.id);
  if (!e) fail(404, 'این ورودی به شما سپرده نشده است.');
  return e;
}
async function canSeeReport(u, reportId) {
  const r = await one('SELECT r.*, u.region_id FROM reports r JOIN users u ON u.id = r.user_id WHERE r.id = ?', reportId);
  if (!r) fail(404, 'گزارش پیدا نشد.');
  if (u.role === 'fm' ? r.user_id !== u.id : u.role === 'region' && r.region_id !== u.region_id) fail(403, 'دسترسی ندارید.');
  return r;
}
const notesOf = reportId => all('SELECT n.id, n.qid, n.role, n.text, n.ts, u.name FROM notes n JOIN users u ON u.id = n.user_id WHERE n.report_id = ? ORDER BY n.ts', reportId);
const mediaOf = async (entryId, userId) => Promise.all((await all('SELECT * FROM media WHERE entry_id = ? AND user_id = ? ORDER BY id', entryId, userId)).map(pubMedia));

async function defectRows(regionId, weekId, f = {}) {
  const rows = await all(`SELECT i.*, r.id AS rid, r.descr, r.updated AS rupdated, r.entry_id, u.id AS uid, u.name AS person, u.nid, e.hotel, e.company, e.siyahe, e.d_in, e.d_out, e.pilgrims
    FROM items i JOIN reports r ON r.id = i.report_id JOIN users u ON u.id = r.user_id JOIN entries e ON e.id = r.entry_id
    WHERE e.week_id = ? AND u.region_id = ? AND i.is_defect = 1 ORDER BY i.updated DESC`, weekId, regionId);
  return rows.filter(r => (!f.person || r.uid === +f.person) && (!f.section || r.section === f.section) && (!f.result || (r.result || 'open') === f.result));
}
const RESULT = { fixed: 'رفع شد', follow: 'در حال پیگیری', open: 'رفع نشد' };
const persianDigits = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const faDate = ts => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Baghdad' }).format(ts);

async function newPassword(given, role) {
  const pw = String(given || '').trim();
  if (pw && pw.length < 6) fail(400, 'رمز دست‌کم ۶ کاراکتر باشد.');
  if (pw) return { pw, must: 0, ...await hashPassword(pw) };
  const x = tempPassword(); return { pw: x, must: role === 'fm' ? 0 : 1, ...await hashPassword(x) };
}
async function ownerToken(tok) {
  if (!/^[A-Za-z0-9_]{20,255}$/.test(tok)) return false;
  try {
    const r = await fetch('https://api.github.com/repos/' + OWNER_REPO, { headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'User-Agent': 'hamyar-team' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return false;
    const d = await r.json();
    return d.full_name?.toLowerCase() === OWNER_REPO.toLowerCase() && !!(d.permissions?.admin || d.permissions?.push);
  } catch { return false; }
}
/* شهرها (هر شهر یک یا چند منطقه) و «سرپرست مناطق»: یک سطح بالاتر از مدیر منطقه — در پایگاه role = 'super' و lead = 1؛
   همه‌ی مناطق را می‌بیند و مدیر منطقه/مدیر ثابت می‌سازد، ولی منطقه نمی‌سازد و به حساب مدیر سامانه و سرپرست‌های دیگر دست نمی‌زند */
const CITIES = ['نجف اشرف', 'کربلای معلی', 'کاظمین', 'سامراء'];
const LEAD_LABEL = 'سرپرست مناطق';
async function leadLabel() { try { const r = await one("SELECT v FROM team_cfg WHERE k = 'lead_label'"); return r && r.v || LEAD_LABEL; } catch (e) { return LEAD_LABEL; } }
const isFull = u => u.role === 'super' && !u.lead;
/* دسترسی‌های مدیر منطقه که سرپرست مناطق می‌دهد (users.perms؛ خالی = همه):
   fm = تعریف و مدیریت مدیران ثابت (و ساختن حساب از اکسل هفتگی)، staff = تعریف آشپزها و دیگر عوامل هتل‌ها */
const PERMS = ['fm', 'staff'];
const permsOf = u => { const s = u.perms == null ? PERMS.join(',') : String(u.perms); return Object.fromEntries(PERMS.map(k => [k, s.split(',').includes(k)])); };
const can = (u, k) => u.role !== 'region' || permsOf(u)[k];
const permStr = b => PERMS.filter(k => !b || b[k] !== false).join(',');
/* دوره‌های مدیریت هر منطقه (مدیران منطقه هر دوره عوض می‌شوند؛ سابقه می‌ماند) */
const termOpen = (rid, uid, name, by) => prep('INSERT INTO region_terms (region_id, user_id, name, start, end, by) VALUES (?, ?, ?, ?, NULL, ?)', rid, uid, name, Date.now(), by || null);
/* هر منطقه فقط یک مدیر منطقه‌ی فعال */
async function mgrTaken(rid, exceptId) {
  /* مدیر منطقه = حساب «مدیر منطقه»، یا سرپرست مناطقی که خودش مدیر همین منطقه است */
  const x = rid && await one("SELECT name FROM users WHERE region_id = ? AND (role = 'region' OR lead = 1) AND active = 1 AND id != ?", rid, exceptId || 0);
  if (x) fail(400, `این منطقه مدیر منطقه دارد (${x.name}). هر منطقه فقط یک مدیر منطقه دارد؛ برای عوض کردن، در کارت همان منطقه «🔁 تعویض مدیر منطقه» را بزنید.`);
}
const termClose = uid => prep('UPDATE region_terms SET end = ? WHERE user_id = ? AND end IS NULL', Date.now(), uid);
/* ── گزارش روزانه‌ی حوزه‌ها، فرم‌های ارزشیابی (تنظیم سرپرست مناطق در team_cfg) ── */
/* سؤال ارزشیابی: { q, type: 'rate' (۱ تا ۵) | 'yesno' (good = پاسخ مطلوب) | 'choice' (options: [{ l, s = امتیاز ۰ تا ۱۰۰ }]) }؛ فهرست قدیمی (فقط متن) = rate */
const OPS_DEF = {
  domains: ['اسکان', 'تغذیه', 'نقل و انتقال', 'مدیران راهنما', 'بیمه و درمان', 'خدمات ستادی', 'سایر'],
  evalStaff: ['نظم و حضور به‌موقع', 'انجام کامل وظایف', 'برخورد با زائران', 'همکاری با مدیر و همکاران', 'رعایت بهداشت و ضوابط', 'گزارش‌دهی و پاسخ‌گویی'],
  evalFm: ['نظم و حضور به‌موقع', 'ثبت به‌موقع گزارش روزانه‌ی هتل‌ها', 'پیگیری و رفع نواقص', 'برخورد با زائران و مدیران کاروان', 'همکاری با مدیر منطقه', 'رعایت ضوابط'],
  evalRegion: ['مدیریت و هماهنگی نیروها', 'پیگیری و رفع نواقص هتل‌ها', 'گزارش‌دهی منظم و به‌موقع', 'برخورد با زائران و مدیران کاروان', 'همکاری با ستاد', 'انضباط و حضور']
};
const OPS_KEY = { domains: 'ops_domains', evalStaff: 'eval_staff', evalFm: 'eval_fm', evalRegion: 'eval_region' };
const EVAL_KEYS = ['evalStaff', 'evalFm', 'evalRegion'];
function cleanQs(a) {
  return (Array.isArray(a) ? a : []).slice(0, 30).map(x => {
    if (typeof x === 'string') x = { q: x };
    const q = stS(x && x.q, 200); if (!q) return null;
    const type = ['rate', 'yesno', 'choice'].includes(x.type) ? x.type : 'rate';
    if (type === 'yesno') return { q, type, good: x.good === 'خیر' ? 'خیر' : 'بله' };
    if (type === 'choice') {
      const options = (Array.isArray(x.options) ? x.options : []).slice(0, 10).map(o => ({ l: stS(o && o.l, 80), s: Math.max(0, Math.min(100, Math.round(+(o && o.s) || 0))) })).filter(o => o.l);
      if (options.length < 2) fail(400, `سؤال «${q}»: دست‌کم دو گزینه لازم است.`);
      return { q, type, options };
    }
    return { q, type };
  }).filter(Boolean);
}
async function opsCfg() {
  const rows = await all(`SELECT k, v FROM team_cfg WHERE k IN (${Object.values(OPS_KEY).map(k => `'${k}'`).join(', ')})`), o = {};
  for (const [k, key] of Object.entries(OPS_KEY)) { const r = rows.find(x => x.k === key); let v = null; try { v = r && JSON.parse(r.v); } catch (e) {} v = Array.isArray(v) && v.length ? v : OPS_DEF[k]; o[k] = EVAL_KEYS.includes(k) ? cleanQs(v) : v; }
  return o;
}
const cleanList = (a, n = 20) => [...new Set((Array.isArray(a) ? a : []).map(x => stS(x, 60)).filter(Boolean))].slice(0, n);
const scopeOf = (u, D) => u.role !== 'region' || u.scope == null ? D : D.filter(d => String(u.scope).split('|').includes(d));
/* فرم ارزشیابی هر نفر: مدیر ثابت فرم خودش را دارد، بقیه‌ی عوامل (آشپز و …) فرم عوامل */
const staffQs = (C, role) => role === 'مدیر ثابت' ? C.evalFm : C.evalStaff;
/* پاسخ‌ها ← امتیاز هر سؤال (۰ تا ۱۰۰) ← نمره = میانگین */
function evalOf(b, qs) {
  const A = b.answers || [];
  const ans = qs.map((q, i) => {
    const raw = (A[i] || {}).v;
    if (q.type === 'yesno') { if (raw !== 'بله' && raw !== 'خیر') return null; return { q: q.q, type: q.type, v: raw, s: raw === q.good ? 100 : 0 }; }
    if (q.type === 'choice') { const o = q.options.find(o => o.l === raw); return o ? { q: q.q, type: q.type, v: o.l, s: o.s } : null; }
    const v = Math.round(+raw || 0); return v >= 1 && v <= 5 ? { q: q.q, type: 'rate', v, s: v * 20 } : null;
  });
  if (ans.some(a => !a)) fail(400, 'به همه‌ی سؤال‌های ارزشیابی پاسخ دهید.');
  return { answers: JSON.stringify(ans), score: ans.length ? Math.round(ans.reduce((a, x) => a + x.s, 0) / ans.length) : 0, note: stS(b.note, 1000) };
}
const evalIns = (kind, ref, rid, name, e, by) => prep('INSERT INTO evals (kind, ref_id, region_id, name, answers, score, note, by, t) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', kind, ref, rid, name, e.answers, e.score, e.note, by, Date.now());
const MEALS_ = ['breakfast', 'lunch', 'dinner'], DST = ['ok', 'minor', 'major', 'na'];
/* وضعیت اطلاعات هتل‌های اپ برای هتل‌های سه هفته‌ی آخر هر منطقه: پیوند به هتل اپ، مدیران ثابت، پیشنهادهای در انتظار، آخرین تأیید */
async function hinfoOf(rids) {
  if (!rids.length) return { hotels: [] };
  const q = rids.map(() => '?').join(',');
  const hotels = await all(`SELECT w.region_id, e.hotel, group_concat(DISTINCT x.name) AS fms, l.hotel_id, r.city
      FROM entries e JOIN weeks w ON w.id = e.week_id JOIN regions r ON r.id = w.region_id
      LEFT JOIN assign a ON a.entry_id = e.id LEFT JOIN users x ON x.id = a.user_id LEFT JOIN hotel_link l ON l.region_id = w.region_id AND l.hotel = e.hotel
      WHERE w.region_id IN (${q}) AND w.id IN (SELECT w2.id FROM weeks w2 WHERE w2.region_id = w.region_id ORDER BY w2.imported DESC LIMIT 3)
      GROUP BY w.region_id, e.hotel ORDER BY w.region_id, e.hotel`, ...rids);
  const pend = await all("SELECT hotel_id, COUNT(*) AS n FROM hotel_sug WHERE status = 'pending' GROUP BY hotel_id");
  const conf = await all('SELECT hotel_id, MAX(t) AS t FROM hotel_confirm WHERE ok = 1 GROUP BY hotel_id');
  return { hotels: hotels.map(h => ({ ...h, cityId: HCITY[h.city] || '', pending: (pend.find(p => p.hotel_id === h.hotel_id) || {}).n || 0, confirmed: (conf.find(c => c.hotel_id === h.hotel_id) || {}).t || null })) };
}
async function meOf(u) {
  const region = await one('SELECT name, city FROM regions WHERE id = ?', u.region_id);
  return { id: u.id, name: u.name, nid: u.nid, role: u.role, lead: !!u.lead, leadLabel: await leadLabel(), owner: u.nid === 'owner', region_id: u.region_id || null, perms: u.role === 'region' ? permsOf(u) : null, scope: u.role === 'region' && u.scope != null ? String(u.scope).split('|').filter(Boolean) : null, mustChange: !!u.must_change, region: region?.name || (u.role === 'super' ? 'همه‌ی مناطق' : ''), city: region?.city || '',
    passkeys: await all('SELECT id, label, created, last_used FROM passkeys WHERE user_id = ? ORDER BY created', u.id) };
}
/* a fixed manager gets the hotels of the sheet named on their account (every week of the region) */
function syncSheetStmts(userId) {
  return [
    prep(`DELETE FROM assign WHERE user_id = ?1 AND entry_id NOT IN (SELECT entry_id FROM reports WHERE user_id = ?1)
      AND entry_id IN (SELECT id FROM entries WHERE week_id IN (SELECT DISTINCT week_id FROM sheet_rows))
      AND entry_id NOT IN (SELECT e.id FROM entries e JOIN sheet_rows s ON s.week_id = e.week_id AND s.row_no = e.row_no WHERE s.sheet = IFNULL((SELECT sheet FROM users WHERE id = ?1), ''))`, userId),
    prep(`INSERT OR IGNORE INTO assign (entry_id, user_id) SELECT e.id, u.id FROM users u JOIN weeks w ON w.region_id = u.region_id JOIN entries e ON e.week_id = w.id
      JOIN sheet_rows s ON s.week_id = e.week_id AND s.row_no = e.row_no WHERE u.id = ? AND u.sheet IS NOT NULL AND s.sheet = u.sheet`, userId)];
}
async function syncSheet(userId) {
  await DB.batch(syncSheetStmts(userId));
  return (await one('SELECT COUNT(*) AS n FROM assign WHERE user_id = ?', userId)).n;
}

/* ── media (chunks in MDB, signed short-lived links for <img>/<video>) ── */
const IMG = { 'image/jpeg': 1, 'image/webp': 1, 'image/png': 1 };
function sniff(b, kind) {
  const s = (a, z) => String.fromCharCode(...b.subarray(a, z));
  if (kind === 'image') {
    if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
    if (s(0, 4) === 'RIFF' && s(8, 12) === 'WEBP') return 'image/webp';
    if (b[0] === 0x89 && s(1, 4) === 'PNG') return 'image/png';
    return null;
  }
  if (s(4, 8) === 'ftyp') return s(8, 12) === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  if (s(0, 4) === 'RIFF' && s(8, 11) === 'AVI') return 'video/x-msvideo';
  if (s(0, 4) === '\x00\x00\x00\x14' || s(4, 8) === 'moov' || s(4, 8) === 'mdat' || s(4, 8) === 'wide') return 'video/quicktime';
  return null;
}
async function hmac(msg) {
  const k = await crypto.subtle.importKey('raw', te.encode(ENV.MEDIA_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, te.encode(msg))).slice(0, 32);
}
async function signedUrl(id, base) { const exp = Math.floor(Date.now() / 1000) + 12 * 3600; return `${base}/media/${id}?e=${exp}&s=${await hmac(`${id}.${exp}`)}`; }
async function checkSigned(id, e, s) { return /^\d+$/.test(e || '') && +e >= Date.now() / 1000 && await hmac(`${id}.${+e}`) === String(s || ''); }
let BASE = '';
const pubMedia = async m => m && ({ id: m.id, qid: m.qid, kind: m.kind, status: m.status, size: m.size, orig: m.orig_size, created: m.created, url: m.status === 'ready' ? await signedUrl(m.id, BASE) : null });
async function removeMedia(id) {
  const m = await one('SELECT * FROM media WHERE id = ?', id); if (!m) return;
  if (m.file) await MDB.prepare('DELETE FROM chunks WHERE k = ?').bind(m.file).run();
  await run('DELETE FROM media WHERE id = ?', id);
}
/* pieces arrive in order (up = upload id, i of n); a resent piece is ignored and a resent last piece gets the same answer */
async function savePart(req, u, { entryId, qid, kind }, { up, i, of }, orig) {
  const key = u.id + ':' + up, now = Date.now(), max = kind === 'image' ? MAX_IMAGE : MAX_VIDEO;
  if (!(of >= 1 && of <= 4000 && i >= 0 && i < of)) fail(400, 'قطعه‌ی نامعتبر');
  let P = await one('SELECT * FROM uploads WHERE k = ?', key);
  if (P && P.res) return JSON.parse(P.res);
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length > PART_MAX || !buf.length) fail(400, 'قطعه‌ی نامعتبر');
  if (!P) { if (i !== 0) fail(409, 'ارسال از اول شروع شود.'); P = { next: 0, size: 0, of, psize: buf.length }; }
  if (i < P.next) return { part: i };
  if (i > P.next || P.of !== of || (i < of - 1 && buf.length !== P.psize) || buf.length > P.psize) fail(409, 'ارسال از اول شروع شود.');
  if (i === 0 && !sniff(buf, kind)) fail(415, kind === 'image' ? 'این فایل عکس نیست.' : 'این فایل فیلم نیست یا این نوع فیلم پشتیبانی نمی‌شود.');
  P.size += buf.length;
  if (P.size > max) { await DB.batch([prep('DELETE FROM uploads WHERE k = ?', key)]); await MDB.prepare('DELETE FROM chunks WHERE k = ?').bind(key).run(); fail(413, kind === 'image' ? 'حجم عکس بیشتر از حد مجاز است.' : 'حجم فیلم بیشتر از ۶۰ مگ است. فیلم کوتاه‌تری بگیرید.'); }
  await MDB.prepare('INSERT OR REPLACE INTO chunks (k, i, data) VALUES (?, ?, ?)').bind(key, i, buf).run();
  P.next = i + 1;
  if (P.next < of) {
    await run('INSERT OR REPLACE INTO uploads (k, user_id, next, size, psize, of, exp, res) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)', key, u.id, P.next, P.size, P.psize, of, now + 30 * 60e3);
    return { part: i };
  }
  const head = i === 0 ? buf : new Uint8Array((await MDB.prepare('SELECT data FROM chunks WHERE k = ? AND i = 0').bind(key).first()).data);
  const mime = sniff(head, kind);
  const r = await one(`INSERT INTO media (entry_id, user_id, qid, kind, file, mime, size, orig_size, status, created, psize) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?) RETURNING *`,
    entryId, u.id, qid, kind, key, mime, P.size, +orig || P.size, now, P.psize);
  const res = await pubMedia(r);
  await run('INSERT OR REPLACE INTO uploads (k, user_id, next, size, psize, of, exp, res) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', key, u.id, P.next, P.size, P.psize, of, now + 30 * 60e3, JSON.stringify(res));
  return res;
}
async function serveMedia(req, id, url, cors) {
  const H = { ...cors, 'X-Content-Type-Options': 'nosniff' };
  if (!await checkSigned(id, url.searchParams.get('e'), url.searchParams.get('s'))) return jres(403, { error: 'این پیوند منقضی شده است. صفحه را دوباره باز کنید.' }, H);
  const md = await one('SELECT * FROM media WHERE id = ?', id);
  if (!md) return jres(404, { error: 'پیدا نشد' }, H);
  if (md.status !== 'ready' || !md.file) return jres(410, { error: 'این فایل بعد از ۷ روز پاک شده است.' }, H);
  const size = md.size, P = md.psize, range = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  let s = 0, e = size - 1, status = 200;
  if (range) {
    s = range[1] === '' ? size - +range[2] : +range[1]; e = range[1] !== '' && range[2] !== '' ? +range[2] : size - 1;
    if (s < 0 || s >= size || e < s) return new Response(null, { status: 416, headers: { ...H, 'Content-Range': `bytes */${size}` } });
    e = Math.min(e, size - 1, s + (8 << 20) - 1);   /* at most 8MB per answer; the player asks for the rest */
    status = 206;
  }
  const first = Math.floor(s / P), last = Math.floor(e / P), key = md.file;
  let k = first;
  const body = new ReadableStream({
    async pull(ctl) {
      if (k > last) return ctl.close();
      const to = Math.min(last, k + 7);
      const rows = (await MDB.prepare('SELECT i, data FROM chunks WHERE k = ? AND i BETWEEN ? AND ? ORDER BY i').bind(key, k, to).all()).results;
      if (rows.length !== to - k + 1) return ctl.error(new Error('missing chunk'));
      for (const r of rows) {
        const d = new Uint8Array(r.data), off = r.i * P;
        ctl.enqueue(d.subarray(Math.max(0, s - off), Math.min(d.length, e - off + 1)));
      }
      k = to + 1;
    }
  });
  return new Response(body, { status, headers: { ...H, 'Content-Type': md.mime || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=86400',
    'Content-Length': String(e - s + 1), ...(status === 206 ? { 'Content-Range': `bytes ${s}-${e}/${size}` } : {}) } });
}

/* ── weekly Excel: the page reads the file and sends what it found; checked again here ── */
const S = (v, n) => String(v ?? '').slice(0, n);
function cleanParsed(p) {
  if (!p || !Array.isArray(p.rows) || !p.rows.length) fail(400, 'در این فایل جدولی با ستون‌های «هتل» و «شرکت مجری» پیدا نشد.');
  if (p.rows.length > 3000) fail(400, 'فایل خیلی بزرگ است.');
  const int = v => Math.max(0, Math.min(1e7, parseInt(v, 10) || 0));
  const rows = [], seen = new Set();
  for (const r of p.rows) {
    const no = int(r.row_no); if (!no || seen.has(no) || !String(r.hotel || '').trim()) continue; seen.add(no);
    rows.push({ row_no: no, hotel: S(r.hotel, 200), home_mgr: S(r.home_mgr, 200), cook: S(r.cook, 200), caravans: int(r.caravans), d_in: S(r.d_in, 10), d_out: S(r.d_out, 10),
      pilgrims: int(r.pilgrims), company: S(r.company, 300), siyahe: S(r.siyahe, 300), rooms: r.rooms ? int(r.rooms) : null, beds: r.beds ? int(r.beds) : null });
  }
  if (!rows.length) fail(400, 'در فایل ردیفی با شماره و نام هتل پیدا نشد.');
  const sheets = (p.sheets || []).slice(0, 100).map(s => ({ sheet: S(s.sheet, 60), ids: [...new Set((s.ids || []).map(int))].filter(x => seen.has(x)) })).filter(s => s.sheet);
  const codes = (p.codes || []).slice(0, 500).map(c => { const nid = nidNormalize(c.nid); return { nid, raw: S(c.raw, 30), name: S(c.name, 80), sheet: S(c.sheet, 60), valid: nidValid(nid) }; });
  return { title: S(p.title, 120), mainName: S(p.mainName, 60), rows, sheets, codes, problems: (p.problems || []).slice(0, 50).map(x => S(x, 200)) };
}

/* ── کیفیت هتل‌ها و شرکت‌ها (نمره از ۱۰۰) ──
   هر پاسخ نمره دارد (عالی ۱۰۰، خوب ۸۰، متوسط ۵۰، ضعیف ۲۰؛ بله/خیرِ درست ۱۰۰ و نقص ۰؛ گزینه‌ی سالم ۱۰۰ و گزینه‌های نقص ۴۰ تا ۱۰)، «موضوعیت ندارد» حساب نمی‌شود.
   نمره‌ی هر گزارش = میانگین پاسخ‌هایش؛ بخش «نقل» جداست (کار شرکت نقلِ سیاحه است، نه هتل).
   نمره‌ی هتل = میانگین گزارش‌ها. نمره‌ی شرکت سیاحه = میانگین نمره‌ی هتل‌هایش (هر هتل یک سهم)، فقط از گزارش کاروان‌های خود همان شرکت در آن هتل. */
const SC_RATING = { great: 100, good: 80, mid: 50, poor: 20 };
const isTransport = sec => sec && (sec.id === 'tr' || /نقل|اتوبوس|ترابری|حمل/.test(sec.title || ''));
const normName = s => String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[‌‏‎]/g, '').replace(/[ـ]/g, '').replace(/\s+/g, ' ').trim();
function itemScore(q, it) {
  if (it.answer === 'na') return null;
  if (!q) return it.is_defect ? 30 : 100;
  if (q.type === 'rating') return SC_RATING[it.answer] ?? null;
  if (q.type === 'yesno') return it.answer === q.good ? 100 : it.answer === 'yes' || it.answer === 'no' ? 0 : null;
  const o = (q.options || []).find(x => x.l === it.answer); if (!o) return it.is_defect ? 30 : 100;
  if (!o.bad) return 100;
  const bads = q.options.filter(x => x.bad), k = bads.indexOf(o);
  return bads.length > 1 ? Math.round(40 - 30 * k / (bads.length - 1)) : 30;
}
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const r1 = v => v == null ? null : Math.round(v * 10) / 10;
/* فهرست شرکت‌ها از روی ردیف‌های اکسل هفتگی (همه‌ی کاروان‌ها، چه گزارش داشته باشند چه نه):
   هر شرکت سیاحه ← هتل‌هایش و شرکت‌های مجری طرف قراردادش، با تعداد کاروان و زائر */
async function dirOf(weekIds) {
  if (!weekIds.length) return [];
  const rows = await all(`SELECT e.hotel, e.company, e.siyahe, e.caravans, e.pilgrims, w.region_id, g.name AS region
    FROM entries e JOIN weeks w ON w.id = e.week_id JOIN regions g ON g.id = w.region_id WHERE e.week_id IN (SELECT value FROM json_each(?))`, JSON.stringify(weekIds));
  const S = new Map(), add = (m, k, v, r) => { let x = m.get(k); if (!x) m.set(k, x = { ...v, caravans: 0, pilgrims: 0 }); x.caravans += r.caravans > 0 ? r.caravans : 1; x.pilgrims += r.pilgrims || 0; };
  for (const r of rows) {
    const sk = normName(r.siyahe) || '—';
    let C = S.get(sk); if (!C) S.set(sk, C = { name: sk, hotels: new Map(), mojri: new Map(), caravans: 0, pilgrims: 0 });
    C.caravans += r.caravans > 0 ? r.caravans : 1; C.pilgrims += r.pilgrims || 0;
    const h = normName(r.hotel); if (h) add(C.hotels, r.region_id + '|' + h, { key: r.region_id + '|' + h, name: h, region: r.region }, r);
    const c = normName(r.company); if (c) add(C.mojri, c, { name: c }, r);
  }
  const srt = m => [...m.values()].sort((a, b) => b.caravans - a.caravans || a.name.localeCompare(b.name, 'fa'));
  return [...S.values()].map(C => ({ ...C, hotels: srt(C.hotels), mojri: srt(C.mojri) })).sort((a, b) => (a.name === '—') - (b.name === '—') || b.caravans - a.caravans);
}
/* ── ارزیابی خود مدیر منطقه از هتل (هر هفته جدا؛ جدا از نمره‌ی گزارش مدیران ثابت و بی‌اثر روی نمره‌ی شرکت‌ها) ── */
const RR_TAGS = ['نظافت', 'غذا', 'برخورد کارکنان', 'آسانسور', 'سرمایش و گرمایش', 'سرویس بهداشتی', 'امنیت', 'آب و برق'];
async function ratingsOf(weekIds) {
  const M = new Map();
  if (!weekIds.length) return M;
  const rows = await all(`SELECT r.*, w.title AS wtitle, u.name AS by_name FROM region_ratings r JOIN weeks w ON w.id = r.week_id LEFT JOIN users u ON u.id = r.user_id
    WHERE r.week_id IN (SELECT value FROM json_each(?)) ORDER BY w.imported DESC`, JSON.stringify(weekIds));
  for (const r of rows) {
    const k = r.region_id + '|' + r.hotel; let x = M.get(k);
    if (!x) M.set(k, x = { list: [] });
    x.list.push({ week: r.week_id, wtitle: r.wtitle, stars: r.stars, tags: JSON.parse(r.tags || '[]'), note: r.note || '', by: r.by_name || '', updated: r.updated });
  }
  for (const x of M.values()) { x.stars = r1(avg(x.list.map(i => i.stars))); x.n = x.list.length; }
  return M;
}
/* ارزیابی‌ها + هتل‌هایی که در اکسل هفته هستند ولی هنوز گزارشی ندارند (تا مدیر منطقه بتواند به آن‌ها هم امتیاز بدهد) */
async function withRatings(Q, weekIds) {
  const M = await ratingsOf(weekIds), have = new Set(Q.hotels.map(h => h.key));
  if (weekIds.length) {
    const ents = await all(`SELECT e.hotel, e.siyahe, e.pilgrims, w.region_id, g.name AS region FROM entries e JOIN weeks w ON w.id = e.week_id JOIN regions g ON g.id = w.region_id
      WHERE e.week_id IN (SELECT value FROM json_each(?))`, JSON.stringify(weekIds));
    const extra = new Map();
    for (const e of ents) {
      const name = normName(e.hotel), k = e.region_id + '|' + name;
      if (!name || have.has(k)) continue;
      let H = extra.get(k);
      if (!H) extra.set(k, H = { key: k, name, region: e.region, score: null, n: 0, pilgrims: 0, secs: {}, defects: 0, fixed: 0, companies: new Set() });
      H.pilgrims += e.pilgrims || 0; if (e.siyahe) H.companies.add(normName(e.siyahe));
    }
    for (const H of extra.values()) Q.hotels.push({ ...H, companies: [...H.companies] });
  }
  Q.hotels.forEach(h => h.rr = M.get(h.key) || null);
  Q.rrTags = RR_TAGS;
  return Q;
}
async function qualityOf(weekIds) {
  if (!weekIds.length) return { hotels: [], companies: [], transport: [], sections: [], avg: null };
  const W = JSON.stringify(weekIds);
  const rows = await all(`SELECT i.report_id, i.qid, i.section, i.answer, i.is_defect, i.result, r.entry_id, e.hotel, e.siyahe, e.pilgrims, w.region_id, g.name AS region
    FROM items i JOIN reports r ON r.id = i.report_id JOIN entries e ON e.id = r.entry_id JOIN weeks w ON w.id = e.week_id JOIN regions g ON g.id = w.region_id
    WHERE e.week_id IN (SELECT value FROM json_each(?))`, W);
  const forms = new Map();
  for (const rid of new Set(rows.map(r => r.region_id))) {
    const f = await formOf(rid), qs = new Map(), tr = new Set(), secs = [];
    for (const sec of f.sections) { if (isTransport(sec)) tr.add(sec.title); else secs.push(sec.title); for (const q of sec.questions) qs.set(q.id, { ...q, sec: sec.title }); }
    forms.set(rid, { qs, tr, secs });
  }
  /* per report: hotel score, section scores, transport score */
  const reps = new Map();
  for (const it of rows) {
    const F = forms.get(it.region_id), q = F.qs.get(it.qid), sec = q ? q.sec : it.section, tr = F.tr.has(sec) || (!q && /نقل|اتوبوس/.test(it.section || ''));
    let R = reps.get(it.report_id);
    if (!R) reps.set(it.report_id, R = { entry: it.entry_id, hotel: it.hotel, siyahe: it.siyahe, pilgrims: it.pilgrims, region_id: it.region_id, region: it.region, h: [], t: [], secs: {}, defects: 0, fixed: 0, tdef: 0, tfix: 0 });
    const v = itemScore(q, it);
    if (tr) { if (v != null) R.t.push(v); if (it.is_defect) { R.tdef++; if (it.result === 'fixed') R.tfix++; } continue; }
    if (v != null) { R.h.push(v); (R.secs[sec] = R.secs[sec] || []).push(v); }
    if (it.is_defect) { R.defects++; if (it.result === 'fixed') R.fixed++; }
  }
  /* hotels (same name in the same region = one hotel) */
  const hotels = new Map();
  for (const R of reps.values()) {
    const s = avg(R.h); if (s == null) continue;
    const k = R.region_id + '|' + normName(R.hotel);
    let H = hotels.get(k);
    if (!H) hotels.set(k, H = { key: k, name: normName(R.hotel), region: R.region, region_id: R.region_id, scores: [], secs: {}, defects: 0, fixed: 0, entries: new Set(), pilgrims: 0, companies: new Set() });
    H.scores.push(s); H.defects += R.defects; H.fixed += R.fixed;
    if (!H.entries.has(R.entry)) { H.entries.add(R.entry); H.pilgrims += R.pilgrims || 0; }
    if (R.siyahe) H.companies.add(normName(R.siyahe));
    for (const [sec, v] of Object.entries(R.secs)) (H.secs[sec] = H.secs[sec] || []).push(avg(v));
  }
  const hotelList = [...hotels.values()].map(H => ({ key: H.key, name: H.name, region: H.region, score: r1(avg(H.scores)), n: H.scores.length, pilgrims: H.pilgrims,
    secs: Object.fromEntries(Object.entries(H.secs).map(([k, v]) => [k, r1(avg(v))])), defects: H.defects, fixed: H.fixed, companies: [...H.companies] }));
  /* siyahe companies: average of their hotels, each hotel counted once, from their own caravans' reports only */
  const comp = new Map();
  for (const R of reps.values()) {
    if (!R.siyahe) continue;
    const c = normName(R.siyahe); let C = comp.get(c);
    if (!C) comp.set(c, C = { name: c, hotels: new Map(), n: 0, defects: 0, fixed: 0, t: [], tn: 0, tdef: 0, tfix: 0 });
    const s = avg(R.h);
    if (s != null) {
      const hk = R.region_id + '|' + normName(R.hotel);
      if (!C.hotels.has(hk)) C.hotels.set(hk, { name: normName(R.hotel), region: R.region, s: [] });
      C.hotels.get(hk).s.push(s); C.n++; C.defects += R.defects; C.fixed += R.fixed;
    }
    const t = avg(R.t); if (t != null) { C.t.push(t); C.tn++; } C.tdef += R.tdef; C.tfix += R.tfix;
  }
  const companies = [], transport = [];
  for (const C of comp.values()) {
    const hs = [...C.hotels.values()].map(h => ({ name: h.name, region: h.region, score: r1(avg(h.s)), n: h.s.length }));
    if (hs.length) companies.push({ name: C.name, score: r1(avg(hs.map(h => h.score))), n: C.n, hotels: hs.sort((a, b) => a.score - b.score), defects: C.defects, fixed: C.fixed });
    if (C.tn) transport.push({ name: C.name, score: r1(avg(C.t)), n: C.tn, defects: C.tdef, fixed: C.tfix });
  }
  const secs = [...new Set([...forms.values()].flatMap(F => F.secs))];
  return { hotels: hotelList, companies, transport, sections: secs, avg: r1(avg(hotelList.map(h => h.score))) };
}

/* تاریخ شمسی «۱۴۰۵/۰۸/۱۷» ⇄ شماره‌ی روز (برای فاصله‌ی روزها) — الگوریتم jalaali */
const JD = (() => {
  const div = (a, b) => ~~(a / b), mod = (a, b) => a - ~~(a / b) * b;
  const BR = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function cal(jy) {
    let gy = jy + 621, leapJ = -14, jp = BR[0], jm, jump = 0, n, i;
    for (i = 1; i < BR.length; i++) { jm = BR[i]; jump = jm - jp; if (jy < jm) break; leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm; }
    n = jy - jp; leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4;
    return { gy, march: 20 + leapJ - leapG, leap };
  }
  const g2d = (gy, gm, gd) => { let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408; return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752; };
  const d2g = jdn => { let j = 4 * jdn + 139361631; j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908; const i = div(mod(j, 1461), 4) * 5 + 308, gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1; return { gy: div(j, 1461) - 100100 + div(8 - gm, 6), gm, gd }; };
  const j2d = (jy, jm, jd) => { const r = cal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; };
  const d2j = jdn => { const g = d2g(jdn); let jy = g.gy - 621; const r = cal(jy); let k = jdn - g2d(g.gy, 3, r.march), jm, jd;
    if (k >= 0) { if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }; k -= 186; } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
    return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 }; };
  const p2 = n => String(n).padStart(2, '0');
  const num = s => { const m = String(s || '').replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).match(/^\s*(1[34]\d\d)\D(\d{1,2})\D(\d{1,2})\s*$/);
    if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return null; const d = j2d(+m[1], +m[2], +m[3]), b = d2j(d); return b.jm === +m[2] && b.jd === +m[3] ? d : null; };
  const str = d => { const j = d2j(d); return `${j.jy}/${p2(j.jm)}/${p2(j.jd)}`; };
  const today = (tz = 'Asia/Baghdad') => { const o = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(new Date()).forEach(p => o[p.type] = +p.value); return g2d(o.year, o.month, o.day); };
  return { num, str, today, g2d, d2g };
})();

/* ── عوامل منطقه ── */
const STAFF_ROLES = ['مدیر ثابت', 'آشپز'], STAFF_MAX_DAYS = 30;
const stS = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
async function staffRoles(R) { const c = await one('SELECT roles FROM staff_cfg WHERE region_id = ?', R); const r = c ? json(c.roles) : []; return r.length ? r : STAFF_ROLES; }
function staffRow(b, roles) {
  const x = { first: stS(b.first, 40), last: stS(b.last, 60), nid: nidNormalize(b.nid), role: stS(b.role, 30), hotel: normName(stS(b.hotel, 120)), note: stS(b.note, 300) };
  const ds = JD.num(b.d_start), de = JD.num(b.d_end);
  if (!x.first || !x.last) return { err: 'نام و نام خانوادگی را بنویسید.' };
  if (!nidValid(x.nid)) return { err: `کد ملی «${x.first} ${x.last}» درست نیست.` };
  if (!roles.includes(x.role)) return { err: `نقش «${x.role || '—'}» تعریف نشده است.` };
  if (ds == null) return { err: `تاریخ شروع «${x.first} ${x.last}» درست نیست (مثلاً ۱۴۰۵/۰۸/۱۷).` };
  if (de == null) return { err: `تاریخ خروج «${x.first} ${x.last}» درست نیست.` };
  if (de < ds) return { err: `تاریخ خروج «${x.first} ${x.last}» قبل از تاریخ شروع است.` };
  return { x: { ...x, d_start: JD.str(ds), d_end: JD.str(de) } };
}

/* ── routes ── */
async function api(req, url, u) {
  const p = url.pathname, m = req.method === 'POST' && ['PUT', 'DELETE'].includes(url.searchParams.get('_m')) ? url.searchParams.get('_m') : req.method;
  const body = async (max = 1 << 20) => {
    const t = await req.text(); if (t.length > max) fail(413, 'درخواست خیلی بزرگ است.');
    try { return t ? JSON.parse(t) : {}; } catch (e) { fail(400, 'درخواست نامعتبر'); }
  };
  let mm;

  /* auth */
  if (p === '/api/login' && m === 'POST') {
    const b = await body(), nid = nidNormalize(b.nid), key = await tryKey(req, nid);
    if (await throttled(key)) fail(429, 'تعداد تلاش‌ها زیاد بود. ۱۵ دقیقه‌ی دیگر امتحان کنید.');
    const usr = await one('SELECT * FROM users WHERE nid = ?', nid);
    if (!usr || !usr.active || !await checkPassword(usr, String(b.password || ''))) { await failed(key); fail(401, 'کد ملی یا رمز درست نیست.'); }
    return { ok: true, token: await createSession(usr.id), me: await meOf(usr) };
  }
  if (p === '/api/passkey/login-options' && m === 'POST') { const b = await body(); return loginOptions(nidNormalize(b.nid)); }
  if (p === '/api/passkey/login' && m === 'POST') {
    const b = await body(); let usr;
    try { usr = await loginVerify(b); } catch (e) { fail(401, e.message); }
    return { ok: true, token: await createSession(usr.id), me: await meOf(usr) };
  }
  if (p === '/api/owner-login' && m === 'POST') {
    const b = await body(), key = await tryKey(req, 'owner');
    if (await throttled(key)) fail(429, 'تعداد تلاش‌ها زیاد بود. ۱۵ دقیقه‌ی دیگر امتحان کنید.');
    if (!await ownerToken(String(b.gh || ''))) { await failed(key); fail(401, 'کلید مدیر اصلی تأیید نشد. دوباره وارد پنل مدیریت شوید.'); }
    let usr = await one("SELECT * FROM users WHERE nid = 'owner'");
    if (!usr) usr = await one("INSERT INTO users (region_id, role, nid, name, must_change, created) VALUES (NULL, 'super', 'owner', 'مدیر اصلی برنامه', 0, ?) RETURNING *", Date.now());
    return { ok: true, token: await createSession(usr.id), me: await meOf(usr) };
  }
  if (p === '/api/logout' && m === 'POST') { await endSession(bearer(req, url)); return { ok: true }; }

  if (!u) fail(401, 'ابتدا وارد شوید.');
  if (p === '/api/me' && m === 'GET') return meOf(u);
  if (p === '/api/opscfg' && m === 'GET') return opsCfg();
  if (p === '/api/password' && m === 'POST') {
    const b = await body();
    if (!await checkPassword(u, String(b.old || ''))) fail(400, 'رمز فعلی درست نیست.');
    const pw = String(b.new || '');
    if (pw.length < 6) fail(400, 'رمز جدید دست‌کم ۶ کاراکتر باشد.');
    if (pw === b.old) fail(400, 'رمز جدید باید با رمز فعلی فرق کند.');
    const h = await hashPassword(pw);
    await run('UPDATE users SET salt = ?, hash = ?, must_change = 0 WHERE id = ?', h.salt, h.hash, u.id);
    return { ok: true };
  }
  if (u.must_change) fail(403, 'ابتدا رمز موقت را عوض کنید.');
  if (p === '/api/passkey/reg-options' && m === 'POST') return registerOptions(u);
  if (p === '/api/passkey/register' && m === 'POST') { const b = await body(); try { await registerVerify(u, b); } catch (e) { fail(400, e.message); } return { ok: true }; }
  if ((mm = p.match(/^\/api\/passkeys\/([A-Za-z0-9_-]+)$/)) && m === 'DELETE') { await run('DELETE FROM passkeys WHERE id = ? AND user_id = ?', mm[1], u.id); return { ok: true }; }

  /* notes: both roles */
  if (p === '/api/notes' && m === 'POST') {
    const b = await body(), r = await canSeeReport(u, +b.report_id), text = String(b.text || '').trim().slice(0, 1000);
    if (!text) fail(400, 'متن خالی است.');
    await run('INSERT INTO notes (report_id, qid, user_id, role, text, ts) VALUES (?, ?, ?, ?, ?, ?)', r.id, b.qid ? String(b.qid).slice(0, 40) : null, u.id, r.user_id === u.id ? 'fm' : u.role, text, Date.now());
    return { notes: await notesOf(r.id) };
  }

  /* ── fixed manager ── */
  if (p.startsWith('/api/fm/')) {
    /* مدیر منطقه هم می‌تواند خودش هتل داشته باشد (تب «هتل‌های من») */
    if (u.role !== 'fm' && u.role !== 'region' && !(u.lead && u.region_id)) fail(403, 'این بخش مخصوص مدیران ثابت است.');
    if (p === '/api/fm/home' && m === 'GET') {
      const weeks = await all('SELECT DISTINCT w.id, w.title, w.imported FROM weeks w JOIN entries e ON e.week_id = w.id JOIN assign a ON a.entry_id = e.id WHERE a.user_id = ? ORDER BY w.imported DESC', u.id);
      const wid = +url.searchParams.get('week') || weeks[0]?.id || 0;
      const entries = await all(`SELECT e.*, r.id AS rid, r.updated,
          (SELECT COUNT(*) FROM items i WHERE i.report_id = r.id AND i.is_defect = 1) AS defects,
          (SELECT COUNT(*) FROM items i WHERE i.report_id = r.id AND i.is_defect = 1 AND IFNULL(i.result, '') != 'fixed') AS open,
          (SELECT COUNT(*) FROM notes n WHERE n.report_id = r.id AND n.role = 'region') AS feedback
        FROM entries e JOIN assign a ON a.entry_id = e.id LEFT JOIN reports r ON r.entry_id = e.id AND r.user_id = a.user_id
        WHERE a.user_id = ? AND e.week_id = ? ORDER BY e.hotel, e.d_in, e.row_no`, u.id, wid);
      return { weeks, week: wid, entries };
    }
    /* ── تکمیل اطلاعات هتل در اپ (پیشنهاد مدیر ثابت ← تأیید در بخش هتل‌های پنل مدیریت) ── */
    if (p.startsWith('/api/fm/hinfo')) {
      const b = m === 'POST' ? await body(1 << 20) : {}, hotel = stS(m === 'POST' ? b.hotel : url.searchParams.get('hotel'), 200);
      if (!hotel || !await one('SELECT 1 FROM assign a JOIN entries e ON e.id = a.entry_id WHERE a.user_id = ? AND e.hotel = ?', u.id, hotel)) fail(403, 'این هتل به شما سپرده نشده است.');
      const reg = await one('SELECT id, city FROM regions WHERE id = ?', u.region_id) || {}, city = HCITY[reg.city] || '';
      const link = await one('SELECT hotel_id FROM hotel_link WHERE region_id = ? AND hotel = ?', reg.id || 0, hotel);
      if (p === '/api/fm/hinfo' && m === 'GET') {
        const hid = link && link.hotel_id;
        return { city, cityName: reg.city || '', link: hid || null,
          sugs: hid ? await all(`SELECT id, field, value, note, status, reason, user_name, t, rt, user_id = ? AS mine FROM hotel_sug WHERE hotel_id = ? AND (status = 'pending' OR (status = 'rejected' AND t > ?)) ORDER BY t DESC`, u.id, hid, Date.now() - 60 * 864e5) : [],
          confirm: hid ? await one('SELECT ok, user_name, t FROM hotel_confirm WHERE hotel_id = ? ORDER BY t DESC LIMIT 1', hid) : null };
      }
      if (p === '/api/fm/hinfo/link' && m === 'POST') {
        const hid = String(b.hotel_id || '');
        if (hid && !/^hotel-[\w-]{1,60}$/.test(hid)) fail(400, 'هتل نامعتبر است.');
        if (!hid) await run('DELETE FROM hotel_link WHERE region_id = ? AND hotel = ?', reg.id, hotel);
        else await run('INSERT OR REPLACE INTO hotel_link (region_id, hotel, hotel_id, user_id, t) VALUES (?, ?, ?, ?, ?)', reg.id, hotel, hid, u.id, Date.now());
        return { ok: true };
      }
      if (await limited('hsug:' + u.id, 80, 86400)) fail(429, 'امروز موارد زیادی فرستاده‌اید؛ فردا ادامه دهید.');
      if (p === '/api/fm/hinfo/new' && m === 'POST') {
        /* هتلی که در فهرست اپ نیست: پیشنهاد افزودن */
        if (await one("SELECT 1 FROM hotel_sug WHERE field = 'new' AND hotel_name = ? AND city = ? AND status = 'pending'", hotel, city)) fail(400, 'افزودن این هتل قبلاً پیشنهاد شده و در انتظار تأیید است.');
        await run("INSERT INTO hotel_sug (hotel_id, city, hotel_name, field, value, note, user_id, user_name, region_id, t) VALUES ('new', ?, ?, 'new', ?, ?, ?, ?, ?, ?)", city, hotel, JSON.stringify({ name: hotel }), stS(b.note, 300), u.id, u.name, reg.id, Date.now());
        return { ok: true };
      }
      if (!link) fail(400, 'اول مشخص کنید این هتل در اپ کدام است.');
      const hid = link.hotel_id;
      if (p === '/api/fm/hinfo/confirm' && m === 'POST') {
        await run('INSERT INTO hotel_confirm (hotel_id, ok, note, user_id, user_name, t) VALUES (?, ?, ?, ?, ?, ?)', hid, b.ok ? 1 : 0, stS(b.note, 500), u.id, u.name, Date.now()); return { ok: true };
      }
      if (p === '/api/fm/hinfo/sug' && m === 'POST') {
        const f = String(b.field || ''), now = Date.now();
        let value;
        if (f === 'address' || f === 'addressAr' || f === 'nameEn') { value = stS(b.value, f === 'nameEn' ? 100 : 400); if (value.length < 3) fail(400, 'متن را کامل بنویسید.'); }
        else if (f === 'phone') { const ph = String(b.value && b.value.phone || '').replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[^\d+]/g, ''); if (ph.replace(/\D/g, '').length < 8) fail(400, 'شماره‌ی تلفن را کامل بنویسید.'); value = { phone: ph, role: stS(b.value.role, 40) }; }
        else if (f === 'geo') { const la = +b.value?.lat, lo = +b.value?.lng, acc = +b.value?.acc || 0; if (!(la > 29 && la < 38 && lo > 38 && lo < 49)) fail(400, 'موقعیت در عراق نیست.'); if (acc > 150) fail(400, 'دقت موقعیت کم است؛ کنار پنجره یا جلوی در هتل دوباره امتحان کنید.'); value = { lat: Math.round(la * 1e6) / 1e6, lng: Math.round(lo * 1e6) / 1e6, acc: Math.round(acc) }; }
        else if (f === 'fix') { const ff = String(b.value?.field || ''); if (!['address', 'addressAr', 'nameEn', 'phone', 'geo', 'photo'].includes(ff)) fail(400, 'مورد نامعتبر'); if (stS(b.note, 500).length < 3) fail(400, 'بنویسید چه چیزی اشتباه است.'); value = { field: ff, value: stS(b.value?.value, 400) }; }
        else if (f === 'photo') { if (!/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(String(b.photo || '')) || b.photo.length > 900000) fail(400, 'عکس نامعتبر یا خیلی بزرگ است.'); value = { cat: stS(b.value?.cat, 30) || 'سایر' };
          if ((await one("SELECT COUNT(*) AS n FROM hotel_sug WHERE hotel_id = ? AND field = 'photo' AND status = 'pending'", hid)).n >= 12) fail(400, 'برای این هتل ۱۲ عکس در انتظار تأیید است؛ بعد از بررسی، عکس‌های بیشتری بفرستید.'); }
        else fail(400, 'مورد نامعتبر');
        if (f !== 'photo' && f !== 'fix' && f !== 'phone' && await one("SELECT 1 FROM hotel_sug WHERE hotel_id = ? AND field = ? AND status = 'pending'", hid, f)) fail(400, 'برای این مورد قبلاً پیشنهادی فرستاده شده و در انتظار تأیید است.');
        const r = await one('INSERT INTO hotel_sug (hotel_id, city, hotel_name, field, value, note, user_id, user_name, region_id, t) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id', hid, city, hotel, f, JSON.stringify(value), stS(b.note, 500), u.id, u.name, reg.id, now);
        if (f === 'photo') await run('INSERT INTO hsug_photo (sug_id, data) VALUES (?, ?)', r.id, b.photo);
        return { ok: true, id: r.id };
      }
      if (p === '/api/fm/hinfo/cancel' && m === 'POST') {
        const x = await one("SELECT id FROM hotel_sug WHERE id = ? AND user_id = ? AND status = 'pending'", +b.id, u.id); if (!x) fail(404, 'پیدا نشد');
        await DB.batch([prep('DELETE FROM hsug_photo WHERE sug_id = ?', x.id), prep('DELETE FROM hotel_sug WHERE id = ?', x.id)]); return { ok: true };
      }
      fail(404, 'پیدا نشد');
    }
    /* آمار لحظه‌ای (زائر/اتاق/تخت) و اجرای برنامه‌ی غذایی یک ورودی */
    if ((mm = p.match(/^\/api\/fm\/ops\/(\d+)$/)) && m === 'GET') {
      const e = await fmEntry(u, +mm[1]), day = JD.num(url.searchParams.get('day')) ?? JD.today();
      return { entry: e, day: JD.str(day), today: JD.str(JD.today()), occ: await one('SELECT * FROM entry_occ WHERE entry_id = ?', e.id),
        log: await all('SELECT l.pilgrims, l.rooms, l.beds, l.note, l.t, x.name AS by FROM occ_log l LEFT JOIN users x ON x.id = l.user_id WHERE l.entry_id = ? ORDER BY l.t DESC LIMIT 15', e.id),
        plan: (await one('SELECT plan_id FROM entry_food WHERE entry_id = ?', e.id))?.plan_id
          || (await one('SELECT f.plan_id FROM entry_food f JOIN entries x ON x.id = f.entry_id JOIN assign a ON a.entry_id = x.id AND a.user_id = ? WHERE x.hotel = ? ORDER BY f.updated DESC LIMIT 1', u.id, e.hotel))?.plan_id || null,
        planSet: !!(await one('SELECT 1 FROM entry_food WHERE entry_id = ?', e.id)),
        checks: (await all('SELECT meal, items, note, updated FROM meal_checks WHERE entry_id = ? AND day = ?', e.id, JD.str(day))).map(c => ({ ...c, items: json(c.items) || {} })) };
    }
    if (p === '/api/fm/occ' && m === 'POST') {
      const b = await body(), e = await fmEntry(u, +b.entry_id), n = v => v === '' || v == null ? null : Math.max(0, Math.min(100000, parseInt(v, 10) || 0));
      const x = { p: n(b.pilgrims), r: n(b.rooms), bd: n(b.beds), note: stS(b.note, 500) }, now = Date.now();
      if (x.p == null && x.r == null && x.bd == null) fail(400, 'دست‌کم یکی از تعداد زائر، اتاق یا تخت را بنویسید.');
      await DB.batch([prep('INSERT OR REPLACE INTO entry_occ (entry_id, pilgrims, rooms, beds, note, user_id, updated) VALUES (?, ?, ?, ?, ?, ?, ?)', e.id, x.p, x.r, x.bd, x.note, u.id, now),
        prep('INSERT INTO occ_log (entry_id, pilgrims, rooms, beds, note, user_id, t) VALUES (?, ?, ?, ?, ?, ?, ?)', e.id, x.p, x.r, x.bd, x.note, u.id, now)]);
      return { ok: true };
    }
    if (p === '/api/fm/food-plan' && m === 'POST') {
      const b = await body(), e = await fmEntry(u, +b.entry_id);
      await run('INSERT OR REPLACE INTO entry_food (entry_id, plan_id, user_id, updated) VALUES (?, ?, ?, ?)', e.id, stS(b.plan_id, 40) || null, u.id, Date.now()); return { ok: true };
    }
    if (p === '/api/fm/meal' && m === 'POST') {
      const b = await body(), e = await fmEntry(u, +b.entry_id), d = JD.num(b.day), meal = MEALS_.includes(b.meal) ? b.meal : null;
      if (d == null || !meal) fail(400, 'روز یا وعده نامعتبر است.');
      if (d > JD.today() || d < JD.today() - 3) fail(400, 'فقط برای امروز و سه روز گذشته می‌شود ثبت کرد.');
      const items = {}; for (const [k, v] of Object.entries(b.items || {}).slice(0, 40)) { const kk = stS(k, 60); if (kk && (v === 1 || v === 0)) items[kk] = v; }
      if (!Object.keys(items).length) fail(400, 'دست‌کم برای یک قلم «بله» یا «خیر» بزنید.');
      await run('INSERT OR REPLACE INTO meal_checks (entry_id, day, meal, items, note, user_id, updated) VALUES (?, ?, ?, ?, ?, ?, ?)', e.id, JD.str(d), meal, JSON.stringify(items), stS(b.note, 500), u.id, Date.now());
      return { ok: true };
    }
    if ((mm = p.match(/^\/api\/fm\/entry\/(\d+)$/))) {
      const e = await fmEntry(u, +mm[1]), form = await formOf(u.region_id);
      if (m === 'GET') {
        const r = await one('SELECT * FROM reports WHERE entry_id = ? AND user_id = ?', e.id, u.id);
        const items = r ? (await all('SELECT * FROM items WHERE report_id = ?', r.id)).map(i => ({ qid: i.qid, v: i.answer, reasons: json(i.reasons), day: i.day, actions: json(i.actions), actionText: i.action_text, result: i.result, resultNote: i.result_note, pick: i.pick || '' })) : [];
        return { entry: e, form, report: r ? { id: r.id, descr: r.descr, updated: r.updated } : null, items, media: await mediaOf(e.id, u.id), notes: r ? await notesOf(r.id) : [], people: await pickPeople(form, e) };
      }
      if (m === 'PUT') {
        const b = await body(), now = Date.now(), qs = new Map(form.sections.flatMap(s => s.questions.map(x => [x.id, { ...x, sec: s.title }])));
        const items = b.items && typeof b.items === 'object' ? b.items : {};
        const r = await one(`INSERT INTO reports (entry_id, user_id, descr, created, updated) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (entry_id, user_id) DO UPDATE SET descr = excluded.descr, updated = excluded.updated RETURNING id`, e.id, u.id, String(b.descr || '').slice(0, 3000), now, now);
        const st = [];
        for (const [qid, qn] of qs) {
          const a = items[qid]; const vd = a ? verdict(qn, a.v) : null;
          if (!vd) { st.push(prep('DELETE FROM items WHERE report_id = ? AND qid = ?', r.id, qid)); continue; }
          const arr = (x, n) => JSON.stringify((Array.isArray(x) ? x : []).map(s => String(s).slice(0, 160)).slice(0, n));
          const def = vd === 'bad';
          st.push(prep(`INSERT INTO items (report_id, qid, section, question, answer, answer_label, is_defect, reasons, day, actions, action_text, result, result_note, updated)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (report_id, qid) DO UPDATE SET section = excluded.section, question = excluded.question,
             answer = excluded.answer, answer_label = excluded.answer_label, is_defect = excluded.is_defect, reasons = excluded.reasons, day = excluded.day,
             actions = excluded.actions, action_text = excluded.action_text, result = excluded.result, result_note = excluded.result_note, updated = excluded.updated`,
            r.id, qid, qn.sec, qn.text, String(a.v), pickOf(qn, a) ? `${answerLabel(qn, a.v)} · ${qn.pick.role}: ${pickOf(qn, a)}` : answerLabel(qn, a.v), def ? 1 : 0, def ? arr(a.reasons, 20) : '[]', def && /^\d{4}\/\d{2}\/\d{2}$/.test(a.day || '') ? a.day : null,
            def ? arr(a.actions, 20) : '[]', def ? String(a.actionText || '').slice(0, 1000) : '', def && RESULT[a.result] ? a.result : null, def ? String(a.resultNote || '').slice(0, 1000) : '', now));
        }
        for (const [qid, qn] of qs) { const a = items[qid]; if (a && verdict(qn, a.v)) st.push(prep('UPDATE items SET pick = ? WHERE report_id = ? AND qid = ?', pickOf(qn, a) || null, r.id, qid)); }
        if (st.length) await DB.batch(st);
        return { ok: true, report_id: r.id };
      }
    }
    if (p === '/api/fm/bulk-clean' && m === 'POST') {
      const b = await body(), form = await formOf(u.region_id), now = Date.now();
      const ids = [...new Set((b.entry_ids || []).slice(0, 300).map(Number))];
      const mine = new Set((await all(`SELECT a.entry_id AS id FROM assign a WHERE a.user_id = ? AND a.entry_id IN (SELECT value FROM json_each(?))
        AND a.entry_id NOT IN (SELECT entry_id FROM reports WHERE user_id = ?)`, u.id, JSON.stringify(ids), u.id)).map(r => r.id));
      const good = qn => qn.type === 'rating' ? 'good' : qn.type === 'yesno' ? qn.good : (qn.options || []).find(o => !o.bad)?.l;
      const tmpl = form.sections.flatMap(s => s.questions.map(qn => { const v = good(qn); return v ? { qid: qn.id, sec: s.title, q: qn.text, v, l: answerLabel(qn, v) } : null; })).filter(Boolean);
      const list = ids.filter(id => mine.has(id));
      if (list.length) await DB.batch([
        prep("INSERT OR IGNORE INTO reports (entry_id, user_id, descr, created, updated) SELECT value, ?, '', ?, ? FROM json_each(?)", u.id, now, now, JSON.stringify(list)),
        prep(`INSERT OR IGNORE INTO items (report_id, qid, section, question, answer, answer_label, is_defect, reasons, actions, updated)
          SELECT r.id, json_extract(t.value, '$.qid'), json_extract(t.value, '$.sec'), json_extract(t.value, '$.q'), json_extract(t.value, '$.v'), json_extract(t.value, '$.l'), 0, '[]', '[]', ?
          FROM reports r, json_each(?) t WHERE r.user_id = ? AND r.entry_id IN (SELECT value FROM json_each(?)) AND r.created = ?`, now, JSON.stringify(tmpl), u.id, JSON.stringify(list), now)]);
      return { ok: true, count: list.length };
    }
    if (p === '/api/fm/media' && m === 'PUT') {
      const e = await fmEntry(u, +url.searchParams.get('entry')), qid = String(url.searchParams.get('qid') || '').slice(0, 40), kind = url.searchParams.get('kind') === 'video' ? 'video' : 'image';
      if (!qid) fail(400, 'سؤال مشخص نیست.');
      const up = String(url.searchParams.get('up') || '').slice(0, 32), i = +url.searchParams.get('i'), of = +url.searchParams.get('of') || 1;
      if (i === 0 && (await one("SELECT COUNT(*) AS n FROM media WHERE entry_id = ? AND user_id = ? AND qid = ? AND status != 'expired'", e.id, u.id, qid)).n >= 6) fail(400, 'برای هر مورد حداکثر ۶ عکس یا فیلم می‌شود فرستاد.');
      return savePart(req, u, { entryId: e.id, qid, kind }, { up: up || hex(rand(6)), i: i || 0, of }, url.searchParams.get('orig'));
    }
    if ((mm = p.match(/^\/api\/fm\/media\/(\d+)$/)) && m === 'GET') {
      const md = await one('SELECT * FROM media WHERE id = ? AND user_id = ?', +mm[1], u.id); if (!md) fail(404, 'پیدا نشد');
      return pubMedia(md);
    }
    if ((mm = p.match(/^\/api\/fm\/media\/(\d+)$/)) && m === 'DELETE') {
      const md = await one('SELECT * FROM media WHERE id = ? AND user_id = ?', +mm[1], u.id); if (!md) fail(404, 'پیدا نشد');
      await removeMedia(md.id); return { ok: true };
    }
    fail(404, 'پیدا نشد');
  }

  /* ── system manager: every region, every account ── */
  if (p.startsWith('/api/super/')) {
    if (u.role !== 'super') fail(403, 'این بخش مخصوص مدیر سامانه است.');
    if (p === '/api/super/overview' && m === 'GET') {
      const regions = await all(`SELECT r.id, r.name, r.city,
          (SELECT COUNT(*) FROM users x WHERE x.region_id = r.id AND x.role = 'fm') AS fm,
          (SELECT COUNT(*) FROM users x WHERE x.region_id = r.id AND x.role = 'fm' AND x.active = 1) AS fm_active,
          (SELECT COUNT(*) FROM users x JOIN users c ON c.id = x.created_by WHERE x.region_id = r.id AND x.role = 'fm' AND c.role = 'region') AS fm_by_region,
          (SELECT COUNT(*) FROM weeks w WHERE w.region_id = r.id) AS weeks,
          (SELECT COUNT(*) FROM reports rp JOIN users x ON x.id = rp.user_id WHERE x.region_id = r.id) AS reports,
          (SELECT COUNT(*) FROM items i JOIN reports rp ON rp.id = i.report_id JOIN users x ON x.id = rp.user_id WHERE x.region_id = r.id AND i.is_defect = 1) AS defects,
          (SELECT MAX(rp.updated) FROM reports rp JOIN users x ON x.id = rp.user_id WHERE x.region_id = r.id) AS last_report
        FROM regions r ORDER BY r.city, r.name`);
      await run(`INSERT INTO region_terms (region_id, user_id, name, start, end) SELECT region_id, id, name, created, CASE WHEN active = 1 THEN NULL ELSE COALESCE(last_login, created) END
        FROM users WHERE (role = 'region' OR lead = 1) AND region_id IS NOT NULL AND id NOT IN (SELECT user_id FROM region_terms)`);
      const managers = await all("SELECT id, region_id, name, nid, active, must_change, last_login, perms, scope FROM users WHERE role = 'region' ORDER BY name");
      managers.forEach(x => { x.perms = permsOf(x); x.scope = x.scope == null ? null : String(x.scope).split('|'); });
      const terms = await all("SELECT t.region_id, t.user_id, t.name, t.start, t.end, (SELECT e.score FROM evals e WHERE e.kind = 'region' AND e.ref_id = t.user_id ORDER BY e.t DESC LIMIT 1) AS score FROM region_terms t ORDER BY t.start DESC");
      /* نمای شهرها: افراد هر منطقه با نقششان، تعداد هتل هفته‌ی آخر، نقص باز و عوامل نزدیک خروج */
      const people = await all(`SELECT x.id, x.region_id, x.name, x.nid, x.role, x.lead, x.sheet, x.active, x.last_login, x.perms,
          (SELECT COUNT(*) FROM assign a JOIN entries e ON e.id = a.entry_id WHERE a.user_id = x.id
            AND e.week_id = (SELECT w.id FROM weeks w WHERE w.region_id = x.region_id ORDER BY w.imported DESC LIMIT 1)) AS hotels
        FROM users x WHERE x.region_id IS NOT NULL AND (x.role IN ('fm', 'region') OR x.lead = 1) ORDER BY x.lead DESC, x.role DESC, x.name`);
      const open = await all(`SELECT x.region_id, COUNT(*) AS n FROM items i JOIN reports rp ON rp.id = i.report_id JOIN users x ON x.id = rp.user_id
        WHERE i.is_defect = 1 AND IFNULL(i.result, '') != 'fixed' GROUP BY x.region_id`);
      const today = JD.str(JD.today()), soon = JD.str(JD.today() + 5);
      const staff = await all("SELECT region_id, role, COUNT(*) AS n, SUM(d_end <= ?) AS soon FROM staff WHERE status = 'active' GROUP BY region_id, role", soon);
      people.forEach(x => { x.perms = x.role === 'region' ? permsOf(x) : null; });
      regions.forEach(r => {
        r.managers = managers.filter(x => x.region_id === r.id);
        r.terms = terms.filter(x => x.region_id === r.id).slice(0, 12);
        r.people = people.filter(x => x.region_id === r.id);
        r.open = open.find(x => x.region_id === r.id)?.n || 0;
        r.staff = staff.filter(x => x.region_id === r.id).map(x => ({ role: x.role, n: x.n, soon: x.soon || 0 }));
      });
      const leads = await all("SELECT x.id, x.name, x.nid, x.region_id, x.sheet, x.active, x.last_login, r.name AS region, r.city FROM users x LEFT JOIN regions r ON r.id = x.region_id WHERE x.role = 'super' AND x.lead = 1 ORDER BY x.name");
      return { regions, leads, today, cities: CITIES, leadLabel: await leadLabel(), full: isFull(u), ops: await opsCfg() };
    }
    /* کیفیت در همه‌ی مناطق: آخرین هفته‌ی هر منطقه (یا week=all برای همه‌ی هفته‌ها) */
    if (p === '/api/super/quality' && m === 'GET') {
      const isAll = url.searchParams.get('week') === 'all';
      const ws = await all(isAll ? 'SELECT id FROM weeks' : 'SELECT w.id FROM weeks w WHERE w.imported = (SELECT MAX(x.imported) FROM weeks x WHERE x.region_id = w.region_id)');
      const ids = ws.map(w => w.id);
      return { week: isAll ? 'all' : 'latest', ...await withRatings(await qualityOf(ids), ids), dir: await dirOf(ids) };
    }
    if (p === '/api/super/users' && m === 'GET') {
      const rid = +url.searchParams.get('region') || 0;
      return all(`SELECT x.id, x.role, x.lead, x.nid, x.name, x.sheet, x.active, x.must_change, x.last_login, x.created, x.region_id, x.perms, x.scope, r.name AS region, r.city, c.name AS creator, c.role AS creator_role, c.lead AS creator_lead,
          (SELECT COUNT(*) FROM reports rp WHERE rp.user_id = x.id) AS reports, (SELECT COUNT(*) FROM passkeys k WHERE k.user_id = x.id) AS passkeys
        FROM users x LEFT JOIN regions r ON r.id = x.region_id LEFT JOIN users c ON c.id = x.created_by
        WHERE x.id != ?1 AND x.nid != 'owner' AND (?2 = 0 OR x.region_id = ?2) AND (?3 = 1 OR x.role != 'super') ORDER BY x.role = 'super' DESC, r.city, r.name, x.role DESC, x.name`, u.id, rid, isFull(u) ? 1 : 0);
    }
    if (p === '/api/super/form') {
      if (m === 'GET') return { ...(await formOf()), _roles: await allStaffRoles() };
      if (m === 'PUT') { const f = validForm(await body(512 * 1024)); await run("INSERT OR REPLACE INTO team_cfg (k, v) VALUES ('form', ?)", JSON.stringify(f)); return { ...f, _roles: await allStaffRoles() }; }
    }
    if (p === '/api/super/cfg' && m === 'POST') {
      if (!isFull(u)) fail(403, 'این تنظیم فقط برای مدیر سامانه است.');
      const b = await body(), v = String(b.leadLabel || '').trim().slice(0, 40);
      await run("INSERT OR REPLACE INTO team_cfg (k, v) VALUES ('lead_label', ?)", v || LEAD_LABEL); return { ok: true, leadLabel: v || LEAD_LABEL };
    }
    /* منطقه را مدیر سامانه و سرپرست مناطق می‌سازند، تغییر می‌دهند و (اگر خالی باشد) حذف می‌کنند */
    if ((mm = p.match(/^\/api\/super\/regions\/(\d+)\/delete$/)) && m === 'POST') {
      const r = await one('SELECT * FROM regions WHERE id = ?', +mm[1]); if (!r) fail(404, 'پیدا نشد');
      const n = await one('SELECT (SELECT COUNT(*) FROM users WHERE region_id = ?1) AS u, (SELECT COUNT(*) FROM weeks WHERE region_id = ?1) AS w, (SELECT COUNT(*) FROM staff WHERE region_id = ?1) AS s', r.id);
      if (n.u || n.w || n.s) fail(400, 'این منطقه کاربر، هفته یا عوامل دارد و حذف نمی‌شود. فقط منطقه‌ی خالی (مثلاً اشتباه ساخته‌شده) حذف می‌شود.');
      await DB.batch([prep('DELETE FROM region_terms WHERE region_id = ?', r.id), prep('DELETE FROM regions WHERE id = ?', r.id)]); return { ok: true };
    }
    /* تعویض مدیر منطقه برای دوره‌ی تازه: مدیر(ان) فعلی غیرفعال می‌شوند (سابقه و گزارش‌هایشان می‌ماند) و نفر تازه مدیر منطقه می‌شود.
       نفر تازه: کد ملی جدید = حساب تازه؛ مدیر ثابتِ همین منطقه = همان حساب ارتقا می‌یابد؛ مدیر منطقه‌ی قبلی همین منطقه = دوباره فعال می‌شود */
    if ((mm = p.match(/^\/api\/super\/regions\/(\d+)\/handover$/)) && m === 'POST') {
      const r = await one('SELECT * FROM regions WHERE id = ?', +mm[1]); if (!r) fail(404, 'منطقه پیدا نشد');
      const b = await body(), nid = nidNormalize(b.nid), name = String(b.name || '').trim().slice(0, 80), perms = permStr(b.perms);
      if (!nidValid(nid)) fail(400, 'کد ملی معتبر نیست.');
      const ex = await one('SELECT * FROM users WHERE nid = ?', nid);
      /* منطقه‌ای که چند مدیر منطقه دارد: body.replace = همان یک نفری که عوض می‌شود (بقیه می‌مانند) */
      b.keepOld = false;   /* هر منطقه فقط یک مدیر منطقه: مدیر فعلی همیشه کنار می‌رود */
      const olds = (await all("SELECT id, lead FROM users WHERE region_id = ? AND (role = 'region' OR lead = 1) AND active = 1", r.id)).filter(x => !ex || x.id !== ex.id);
      if (olds.length > 1) fail(400, 'این منطقه بیش از یک مدیر منطقه‌ی فعال دارد؛ اول مدیر اضافه را به منطقه‌ی خودش منتقل یا غیرفعال کنید.');
      /* سرپرست مناطقی که مدیر این منطقه بود غیرفعال نمی‌شود؛ فقط از این منطقه کنار می‌رود */
      const st = olds.flatMap(x => x.lead ? [prep('UPDATE users SET region_id = NULL, sheet = NULL WHERE id = ?', x.id), termClose(x.id)] : [prep('UPDATE users SET active = 0 WHERE id = ?', x.id), endAll(x.id), termClose(x.id)]);
      /* فرم پایان مأموریت مدیر قبلی (اگر یک نفر است و فعال نمی‌ماند) */
      if (!b.keepOld && olds.length === 1 && !b.skipEval) { const o = await one('SELECT * FROM users WHERE id = ?', olds[0].id); st.push(evalIns('region', o.id, r.id, o.name, evalOf(b.eval || {}, (await opsCfg()).evalRegion), u.id)); }
      let out = { name: name || ex?.name, nid };
      if (ex && ex.lead) {
        /* سرپرست مناطق خودش مدیر این منطقه می‌شود (نقش سرپرستی‌اش می‌ماند) */
        if (ex.id !== u.id && !isFull(u)) fail(403, 'فقط خود همان سرپرست یا مدیر سامانه.');
        if (ex.region_id && ex.region_id !== r.id && await one('SELECT 1 FROM assign WHERE user_id = ?', ex.id)) { /* ورودی‌های قبلی سر جایشان می‌مانند */ }
        st.push(prep('UPDATE users SET region_id = ? WHERE id = ?', r.id, ex.id), termClose(ex.id), termOpen(r.id, ex.id, ex.name, u.id));
        await DB.batch(st);
        return { name: ex.name, nid, kept: true, ended: olds.length };
      }
      if (ex) {
        if (ex.region_id !== r.id || !['fm', 'region'].includes(ex.role)) fail(400, `این کد ملی مال «${ex.name}» در جای دیگری از سامانه است. فقط مدیر ثابت یا مدیر منطقه‌ی قبلیِ همین منطقه را می‌شود مدیر منطقه کرد.`);
        if (ex.role === 'region' && ex.active) fail(400, 'این نفر همین الان مدیر منطقه‌ی همین منطقه است.');
        st.push(prep("UPDATE users SET role = 'region', active = 1, perms = ?, name = ? WHERE id = ?", perms, name || ex.name, ex.id), termOpen(r.id, ex.id, name || ex.name, u.id));
        if (b.password) { const h = await newPassword(b.password, 'region'); st.push(prep('UPDATE users SET salt = ?, hash = ?, must_change = ? WHERE id = ?', h.salt, h.hash, h.must, ex.id), endAll(ex.id)); out = { ...out, password: h.pw, temporary: !!h.must }; }
        else out.kept = true;
        await DB.batch(st);
      } else {
        if (!name) fail(400, 'نام مدیر منطقه‌ی تازه را بنویسید.');
        const h = await newPassword(b.password, 'region');
        const nu = await one("INSERT INTO users (region_id, role, nid, name, perms, salt, hash, must_change, created, created_by) VALUES (?, 'region', ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id", r.id, nid, name, perms, h.salt, h.hash, h.must, Date.now(), u.id);
        st.push(termOpen(r.id, nu.id, name, u.id));
        await DB.batch(st);
        out = { ...out, password: h.pw, temporary: !!h.must };
      }
      return { ...out, ended: b.keepOld ? 0 : olds.length };
    }
    /* برای هر شهر تا ۴ منطقه‌ی پیش‌فرض (منطقه‌های موجود حساب می‌شوند؛ چیزی پاک یا عوض نمی‌شود) */
    if (p === '/api/super/regions/defaults' && m === 'POST') {
      const R0 = await all('SELECT name, city FROM regions'), names = new Set(R0.map(r => r.name)), add = [];
      for (const c of CITIES) { let n = R0.filter(r => r.city === c).length, k = 1; while (n < 4) { const nm = `${c} - منطقه‌ی ${'۰۱۲۳۴۵۶۷۸۹'[k] || k}`; k++; if (names.has(nm)) continue; names.add(nm); add.push([nm, c]); n++; } }
      if (add.length) await DB.batch(add.map(([nm, c]) => prep('INSERT INTO regions (name, city) VALUES (?, ?)', nm, c)));
      return { ok: true, created: add.map(a => a[0]) };
    }
    /* محدوده‌ی فعالیت مدیر منطقه: حوزه‌هایی که هر روز گزارش می‌دهد */
    if ((mm = p.match(/^\/api\/super\/users\/(\d+)\/scope$/)) && m === 'POST') {
      const t = await one("SELECT * FROM users WHERE id = ? AND role = 'region'", +mm[1]); if (!t) fail(404, 'مدیر منطقه پیدا نشد');
      const b = await body(), D = (await opsCfg()).domains, sc = cleanList(b.scope).filter(d => D.includes(d));
      await run('UPDATE users SET scope = ? WHERE id = ?', sc.length === D.length ? null : sc.join('|'), t.id); return { ok: true };
    }
    /* ارزشیابی مدیر منطقه (پایان مأموریت یا هر زمان) */
    if ((mm = p.match(/^\/api\/super\/users\/(\d+)\/eval$/)) && m === 'POST') {
      const t = await one("SELECT * FROM users WHERE id = ? AND role = 'region'", +mm[1]); if (!t) fail(404, 'مدیر منطقه پیدا نشد');
      const e = evalOf(await body(), (await opsCfg()).evalRegion); await evalIns('region', t.id, t.region_id, t.name, e, u.id).run(); return { ok: true, score: e.score };
    }
    /* خروجی یکجای همه‌ی شهرها: همه‌ی دوره‌های عوامل (برای آغاز مأموریت و آخرین تمدید) + نمره‌ها + دوره‌ی مدیران منطقه */
    if (p === '/api/super/allstaff' && m === 'GET') {
      const staff = await all('SELECT s.id, s.region_id, s.first, s.last, s.nid, s.role, s.hotel, s.d_start, s.d_end, s.status, s.left_at, s.prev_id, s.note, r.name AS region, r.city FROM staff s JOIN regions r ON r.id = s.region_id ORDER BY r.city, r.name, s.role, s.last LIMIT 20000');
      const evals = await all("SELECT kind, ref_id, score, t FROM evals ORDER BY t");
      const terms = await all('SELECT user_id, start, end FROM region_terms ORDER BY start');
      const asg = await all(`SELECT a.user_id, COUNT(*) AS n, group_concat(DISTINCT e.hotel) AS hotels FROM assign a JOIN entries e ON e.id = a.entry_id
        WHERE e.week_id IN (SELECT w.id FROM weeks w WHERE w.imported = (SELECT MAX(x.imported) FROM weeks x WHERE x.region_id = w.region_id)) GROUP BY a.user_id`);
      return { staff, evals, terms, asg, today: JD.str(JD.today()) };
    }
    if (p === '/api/super/evals' && m === 'GET') {
      return all("SELECT e.id, e.kind, e.ref_id, e.region_id, e.name, e.answers, e.score, e.note, e.t, x.name AS by, r.name AS region, r.city FROM evals e LEFT JOIN users x ON x.id = e.by LEFT JOIN regions r ON r.id = e.region_id WHERE (?1 = '' OR e.kind = ?1) ORDER BY e.t DESC LIMIT 2000", url.searchParams.get('kind') || '');
    }
    if (p === '/api/super/opscfg' && m === 'POST') {
      const b = await body(), st = [];
      for (const [k, key] of Object.entries(OPS_KEY)) if (b[k] !== undefined) { const L = EVAL_KEYS.includes(k) ? cleanQs(b[k]) : cleanList(b[k]); if (!L.length) fail(400, 'فهرست نباید خالی باشد.'); st.push(prep('INSERT OR REPLACE INTO team_cfg (k, v) VALUES (?, ?)', key, JSON.stringify(L))); }
      if (st.length) await DB.batch(st); return { ok: true, ...(await opsCfg()) };
    }
    if (p === '/api/super/hinfo' && m === 'GET') return hinfoOf((await all('SELECT id FROM regions')).map(r => r.id));
    /* گزارش روزانه‌ی همه‌ی مناطق برای یک روز */
    if (p === '/api/super/daily' && m === 'GET') {
      const d = JD.num(url.searchParams.get('day')) ?? JD.today();
      const rows = await all('SELECT d.region_id, d.domain, d.status, d.text, d.updated, x.name AS by FROM daily_reports d LEFT JOIN users x ON x.id = d.user_id WHERE d.day = ?', JD.str(d));
      const mgrs = await all("SELECT id, region_id, name, scope FROM users WHERE (role = 'region' OR lead = 1) AND region_id IS NOT NULL AND active = 1");
      return { day: JD.str(d), today: JD.str(JD.today()), rows, mgrs: mgrs.map(x => ({ ...x, scope: x.scope == null ? null : String(x.scope).split('|') })), ...(await opsCfg()) };
    }
    /* جابجایی مدیر منطقه (یا سرپرستی که خودش مدیر یک منطقه است) به منطقه‌ی دیگر؛ دوره‌ی قبلی بسته و دوره‌ی تازه باز می‌شود (سابقه می‌ماند).
       ورودی‌ها و گزارش‌های هفته‌های قبل سر جایشان می‌مانند؛ از این به بعد اکسل هفتگی او در منطقه‌ی تازه وارد می‌شود. */
    if ((mm = p.match(/^\/api\/super\/users\/(\d+)\/move$/)) && m === 'POST') {
      const t = await one("SELECT * FROM users WHERE id = ? AND nid != 'owner' AND (role = 'region' OR lead = 1)", +mm[1]); if (!t) fail(404, 'مدیر منطقه پیدا نشد');
      if (t.lead && t.id !== u.id && !isFull(u)) fail(403, `جابجایی ${await leadLabel()} دیگر فقط با مدیر سامانه است.`);
      const b = await body(), to = +b.region_id || null;
      if (to && !await one('SELECT 1 FROM regions WHERE id = ?', to)) fail(400, 'منطقه پیدا نشد.');
      if (!to && !t.lead) fail(400, 'منطقه‌ی مقصد را انتخاب کنید.');
      if (to === t.region_id) fail(400, 'همین الان در همین منطقه است.');
      if (to) await mgrTaken(to, t.id);
      await DB.batch([prep('UPDATE users SET region_id = ? WHERE id = ?', to, t.id), termClose(t.id), ...(to && t.active ? [termOpen(to, t.id, t.name, u.id)] : [])]);
      return { ok: true };
    }
    /* سابقه‌ی یک نفر: از چه تاریخی تا چه تاریخی مدیر کدام منطقه بوده */
    if ((mm = p.match(/^\/api\/super\/users\/(\d+)\/terms$/)) && m === 'GET') {
      return all('SELECT t.region_id, r.name AS region, r.city, t.start, t.end, x.name AS by FROM region_terms t LEFT JOIN regions r ON r.id = t.region_id LEFT JOIN users x ON x.id = t.by WHERE t.user_id = ? ORDER BY t.start DESC', +mm[1]);
    }
    /* دسترسی‌های یک مدیر منطقه */
    if ((mm = p.match(/^\/api\/super\/users\/(\d+)\/perms$/)) && m === 'POST') {
      const t = await one("SELECT * FROM users WHERE id = ? AND role = 'region'", +mm[1]); if (!t) fail(404, 'مدیر منطقه پیدا نشد');
      const b = await body(); await run('UPDATE users SET perms = ? WHERE id = ?', permStr(b), t.id); return { ok: true, perms: permsOf({ perms: permStr(b) }) };
    }
    if (p === '/api/super/regions' && m === 'POST') {
      const b = await body(), name = String(b.name || '').trim().slice(0, 80), city = CITIES.includes(b.city) ? b.city : '';
      if (!city) fail(400, 'شهر را انتخاب کنید.');
      if (!name) fail(400, 'نام منطقه را بنویسید.');
      if (await one('SELECT 1 FROM regions WHERE name = ? AND city = ?', name, city)) fail(400, 'این منطقه در همین شهر قبلاً ساخته شده است.');
      return { id: (await one('INSERT INTO regions (name, city) VALUES (?, ?) RETURNING id', name, city)).id, name };
    }
    if ((mm = p.match(/^\/api\/super\/regions\/(\d+)$/)) && m === 'POST') {
      const b = await body(), name = String(b.name || '').trim().slice(0, 80);
      if (!name) fail(400, 'نام منطقه را بنویسید.');
      const city = CITIES.includes(b.city) ? b.city : null;
      if (await one('SELECT 1 FROM regions WHERE name = ? AND city = COALESCE(?, (SELECT city FROM regions WHERE id = ?)) AND id != ?', name, city, +mm[1], +mm[1])) fail(400, 'در همین شهر منطقه‌ای با همین نام هست.');
      await run('UPDATE regions SET name = ?, city = COALESCE(?, city) WHERE id = ?', name, city, +mm[1]); return { ok: true };
    }
    if (p === '/api/super/users' && m === 'POST') {
      const b = await body(), nid = nidNormalize(b.nid), name = String(b.name || '').trim().slice(0, 80), lead = b.role === 'lead' ? 1 : 0, role = lead || b.role === 'super' ? 'super' : b.role === 'fm' ? 'fm' : 'region';
      if (role === 'super' && !isFull(u)) fail(403, 'فقط مدیر سامانه می‌تواند این نقش را بدهد.');
      if (!nidValid(nid)) fail(400, 'کد ملی معتبر نیست.');
      if (!name) fail(400, 'نام را بنویسید.');
      if (role !== 'super' && !await one('SELECT 1 FROM regions WHERE id = ?', +b.region_id)) fail(400, 'منطقه را انتخاب کنید.');
      if (role === 'region') await mgrTaken(+b.region_id);
      if (await one('SELECT 1 FROM users WHERE nid = ?', nid)) fail(400, 'این کد ملی قبلاً ثبت شده است.');
      const h = await newPassword(b.password, role);
      const nu = await one('INSERT INTO users (region_id, role, lead, nid, name, perms, salt, hash, must_change, created, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id', role === 'super' ? null : +b.region_id, role, lead, nid, name, role === 'region' ? permStr(b.perms) : null, h.salt, h.hash, h.must, Date.now(), u.id);
      if (role === 'region') await termOpen(+b.region_id, nu.id, name, u.id).run();
      return { name, nid, password: h.pw, temporary: !!h.must };
    }
    /* ارتقای همان حساب (مدیر منطقه یا مدیر ثابت) به سرپرست مناطق، یا برگرداندن؛ رمز، گزارش‌ها و هتل‌هایش می‌ماند */
    if ((mm = p.match(/^\/api\/super\/users\/(\d+)\/lead$/)) && m === 'POST') {
      if (!isFull(u)) fail(403, 'فقط مدیر سامانه نقش را تغییر می‌دهد.');
      const t = await one("SELECT * FROM users WHERE id = ? AND nid != 'owner'", +mm[1]); if (!t) fail(404, 'پیدا نشد');
      const b = await body();
      if (b.on) { if (t.role === 'super') fail(400, 'این حساب همین الان در این سطح است.'); await DB.batch([prep("UPDATE users SET role = 'super', lead = 1 WHERE id = ?", t.id), endAll(t.id)]); return { ok: true }; }
      if (!t.lead) fail(400, 'این حساب سرپرست مناطق نیست.');
      if (!t.region_id) fail(400, 'برای برگرداندن به مدیر منطقه، اول در ویرایش برایش منطقه بگذارید.');
      await mgrTaken(t.region_id, t.id);
      await DB.batch([prep("UPDATE users SET role = 'region', lead = 0 WHERE id = ?", t.id), endAll(t.id)]); return { ok: true };
    }
    if ((mm = p.match(/^\/api\/super\/users\/(\d+)\/(reset|active|passkeys|delete|edit)$/)) && m === 'POST') {
      const t = await one("SELECT * FROM users WHERE id = ? AND id != ? AND nid != 'owner'", +mm[1], u.id); if (!t) fail(404, 'پیدا نشد');
      if (t.role === 'super' && !isFull(u)) fail(403, 'حساب‌های هم‌سطح یا بالاتر را فقط مدیر سامانه تغییر می‌دهد.');
      const b = await body();
      if (mm[2] === 'reset') { const h = await newPassword(b.password, t.role); await DB.batch([prep('UPDATE users SET salt = ?, hash = ?, must_change = ? WHERE id = ?', h.salt, h.hash, h.must, t.id), endAll(t.id)]); return { name: t.name, nid: t.nid, password: h.pw, temporary: !!h.must }; }
      if (mm[2] === 'active') {
        if (b.active && t.role === 'region') await mgrTaken(t.region_id, t.id);
        const tm = t.role === 'region' && t.region_id && !!b.active !== !!t.active ? [b.active ? termOpen(t.region_id, t.id, t.name, u.id) : termClose(t.id)] : [];
        await DB.batch([prep('UPDATE users SET active = ? WHERE id = ?', b.active ? 1 : 0, t.id), ...(b.active ? [] : [endAll(t.id)]), ...tm]); return { ok: true };
      }
      if (mm[2] === 'passkeys') { await run('DELETE FROM passkeys WHERE user_id = ?', t.id); return { ok: true }; }
      /* ویرایش: نام، کد ملی (= نام کاربری)، منطقه و نام شیت */
      if (mm[2] === 'edit') {
        const name = String(b.name || '').trim().slice(0, 80); if (!name) fail(400, 'نام را بنویسید.');
        const nid = b.nid !== undefined ? nidNormalize(b.nid) : t.nid;
        if (nid !== t.nid) {
          if (!nidValid(nid)) fail(400, 'کد ملی معتبر نیست.');
          if (await one('SELECT 1 FROM users WHERE nid = ? AND id != ?', nid, t.id)) fail(400, 'این کد ملی مال کاربر دیگری است.');
        }
        if (t.role === 'super' && !t.lead) { await run('UPDATE users SET name = ?, nid = ? WHERE id = ?', name, nid, t.id); return { ok: true }; }
        /* سرپرست مناطق: منطقه‌ی «هتل‌های من» اختیاری است (برای کسی که خودش هم هتل دارد) */
        if (t.lead) {
          const region = +b.region_id || null; if (region && !await one('SELECT 1 FROM regions WHERE id = ?', region)) fail(400, 'منطقه نامعتبر');
          const sheet = region ? (b.sheet !== undefined ? String(b.sheet || '').trim().slice(0, 60) || null : t.sheet) : null;
          if (region !== t.region_id && await one('SELECT 1 FROM assign WHERE user_id = ?', t.id) && t.region_id) fail(400, 'این نفر در هفته‌های منطقه‌ی فعلی ورودی دارد؛ برای جابجایی، «🔀 جابجایی» را بزنید.');
          if (region && region !== t.region_id) await mgrTaken(region, t.id);
          await DB.batch([prep('UPDATE users SET name = ?, nid = ?, region_id = ?, sheet = ? WHERE id = ?', name, nid, region, sheet, t.id),
            ...(region !== t.region_id ? [termClose(t.id), ...(region ? [termOpen(region, t.id, name, u.id)] : [])] : [])]);
          return { ok: true, entries: sheet !== t.sheet || region !== t.region_id ? await syncSheet(t.id) : undefined };
        }
        const region = b.region_id ? +b.region_id : t.region_id; if (!await one('SELECT 1 FROM regions WHERE id = ?', region)) fail(400, 'منطقه نامعتبر');
        if (t.role === 'region' && t.active && region !== t.region_id) await mgrTaken(region, t.id);
        if (region !== t.region_id && await one('SELECT 1 FROM assign WHERE user_id = ?', t.id)) fail(400, 'این نفر در هفته‌های منطقه‌ی فعلی ورودی دارد و جابه‌جا نمی‌شود.');
        const sheet = b.sheet !== undefined ? String(b.sheet || '').trim().slice(0, 60) || null : t.sheet;
        await run('UPDATE users SET name = ?, nid = ?, region_id = ?, sheet = ? WHERE id = ?', name, nid, region, sheet, t.id);
        return { ok: true, entries: sheet !== t.sheet || region !== t.region_id ? await syncSheet(t.id) : undefined };
      }
      if (mm[2] === 'delete') {
        const used = (await one('SELECT (SELECT COUNT(*) FROM reports WHERE user_id = ?1) + (SELECT COUNT(*) FROM notes WHERE user_id = ?1) + (SELECT COUNT(*) FROM media WHERE user_id = ?1) AS n', t.id)).n;
        if (used) fail(400, 'این نفر گزارش یا پیام ثبت کرده و حذفش سابقه را خراب می‌کند. به‌جای حذف، غیرفعالش کنید.');
        await DB.batch([prep('UPDATE users SET created_by = NULL WHERE created_by = ?', t.id), prep('DELETE FROM users WHERE id = ?', t.id)]);
        return { ok: true };
      }
    }
    fail(404, 'پیدا نشد');
  }

  /* ── region manager ── */
  if (p.startsWith('/api/admin/')) {
    if (u.role !== 'region' && u.role !== 'super') fail(403, 'این بخش مخصوص مدیر منطقه است.');
    const R = u.role === 'super' ? +url.searchParams.get('region') : u.region_id;
    if (!await one('SELECT 1 FROM regions WHERE id = ?', R)) fail(400, 'منطقه را انتخاب کنید.');
    const need = k => { if (!can(u, k)) fail(403, k === 'fm' ? 'سرپرست مناطق هنوز دسترسی «تعریف مدیران ثابت» را به شما نداده است.' : 'سرپرست مناطق هنوز دسترسی «تعریف آشپزها و عوامل» را به شما نداده است.'); };
    if (m === 'POST' && p.startsWith('/api/admin/staff')) need('staff');
    if (p === '/api/admin/users' && m === 'POST') need('fm');
    /* گزارش روزانه‌ی حوزه‌ها (اسکان، تغذیه، …) — هر حوزه وضعیت + شرح */
    if (p === '/api/admin/daily') {
      /* مدیر منطقه: محدوده‌ی خودش؛ سرپرست/مدیر سامانه: همه‌ی حوزه‌های مدیران منطقه‌ی این منطقه (اگر چند نفرند، اجتماع) */
      const C = await opsCfg(), MG = u.role === 'region' ? [u] : await all("SELECT * FROM users WHERE region_id = ? AND (role = 'region' OR lead = 1) AND active = 1", R);
      const D = MG.length ? C.domains.filter(d => MG.some(x => scopeOf(x, C.domains).includes(d))) : C.domains;
      if (m === 'GET') {
        const d = JD.num(url.searchParams.get('day')) ?? JD.today();
        const rows = await all('SELECT d.domain, d.status, d.text, d.updated, x.name AS by FROM daily_reports d LEFT JOIN users x ON x.id = d.user_id WHERE d.region_id = ? AND d.day = ?', R, JD.str(d));
        const recent = await all('SELECT day, COUNT(*) AS n, SUM(status = \'major\') AS major, SUM(status = \'minor\') AS minor FROM daily_reports WHERE region_id = ? GROUP BY day ORDER BY day DESC LIMIT 14', R);
        return { day: JD.str(d), today: JD.str(JD.today()), domains: D, rows, recent };
      }
      if (m === 'POST') {
        const b = await body(), d = JD.num(b.day); if (d == null) fail(400, 'روز نامعتبر است.');
        if (d > JD.today() || d < JD.today() - 3) fail(400, 'فقط برای امروز و سه روز گذشته می‌شود ثبت کرد.');
        const items = (Array.isArray(b.items) ? b.items : []).filter(x => D.includes(x.domain) && DST.includes(x.status)), now = Date.now();
        if (!items.length) fail(400, 'برای دست‌کم یک حوزه وضعیت را انتخاب کنید.');
        if (items.some(x => (x.status === 'minor' || x.status === 'major') && !stS(x.text, 10))) fail(400, 'برای حوزه‌ای که مشکل دارد، شرح را بنویسید.');
        await DB.batch(items.map(x => prep('INSERT OR REPLACE INTO daily_reports (region_id, day, domain, status, text, user_id, updated) VALUES (?, ?, ?, ?, ?, ?, ?)', R, JD.str(d), x.domain, x.status, stS(x.text, 3000), u.id, now)));
        return { ok: true, n: items.length };
      }
    }
    if (p === '/api/admin/hinfo' && m === 'GET') return hinfoOf([R]);
    /* اسکان و غذا: ورودی‌های حاضر در یک روز با آمار لحظه‌ای و اجرای وعده‌ها */
    if (p === '/api/admin/ops' && m === 'GET') {
      const d = JD.num(url.searchParams.get('day')) ?? JD.today(), ds = JD.str(d);
      const ents = await all(`SELECT e.id, e.hotel, e.company, e.caravans, e.pilgrims, e.rooms, e.beds, e.d_in, e.d_out, w.title AS week,
          o.pilgrims AS a_pil, o.rooms AS a_rooms, o.beds AS a_beds, o.note AS a_note, o.updated AS a_t, f.plan_id,
          (SELECT group_concat(x.name, '، ') FROM assign a JOIN users x ON x.id = a.user_id WHERE a.entry_id = e.id) AS fm
        FROM entries e JOIN weeks w ON w.id = e.week_id LEFT JOIN entry_occ o ON o.entry_id = e.id LEFT JOIN entry_food f ON f.entry_id = e.id
        WHERE w.region_id = ? AND w.id IN (SELECT id FROM weeks WHERE region_id = ? ORDER BY imported DESC LIMIT 3) ORDER BY e.hotel, e.d_in`, R, R);
      const here = ents.filter(e => { const a = JD.num(e.d_in), z = JD.num(e.d_out); return a != null && z != null && a <= d && d <= z; });
      const seen = new Set(), list = here.filter(e => { const k = e.hotel + '|' + e.company + '|' + e.d_in; if (seen.has(k)) return false; seen.add(k); return true; });
      const checks = list.length ? await all(`SELECT entry_id, meal, items, note, updated FROM meal_checks WHERE day = ? AND entry_id IN (SELECT value FROM json_each(?))`, ds, JSON.stringify(list.map(e => e.id))) : [];
      return { day: ds, today: JD.str(JD.today()), entries: list.map(e => ({ ...e, day_no: d - JD.num(e.d_in) + 1, meals: checks.filter(c => c.entry_id === e.id).map(c => ({ meal: c.meal, items: json(c.items) || {}, note: c.note, updated: c.updated })) })) };
    }
    if (p === '/api/admin/staff/eval' && m === 'POST') {
      need('staff');
      const b = await body(), s0 = await one('SELECT * FROM staff WHERE id = ? AND region_id = ?', +b.id, R); if (!s0) fail(404, 'پیدا نشد');
      const e = evalOf(b, staffQs(await opsCfg(), s0.role)); await evalIns('staff', s0.id, R, s0.first + ' ' + s0.last, e, u.id).run(); return { ok: true, score: e.score };
    }
    if (p === '/api/admin/form') {
      if (m === 'GET') return formOf(R);
      fail(403, 'فرم برای همه‌ی مناطق یکی است و فقط سرپرست مناطق آن را در تب «🧩 فرم‌ساز» پنل خودش تغییر می‌دهد.');
    }
    if (p === '/api/admin/weeks' && m === 'GET') {
      return all(`SELECT w.id, w.title, w.file, w.imported, (SELECT COUNT(*) FROM entries e WHERE e.week_id = w.id) AS entries,
        (SELECT COUNT(*) FROM reports r JOIN entries e ON e.id = r.entry_id WHERE e.week_id = w.id) AS reports FROM weeks w WHERE w.region_id = ? ORDER BY w.imported DESC`, R);
    }
    if ((mm = p.match(/^\/api\/admin\/weeks\/(\d+)$/)) && m === 'DELETE') {
      const w = await one('SELECT * FROM weeks WHERE id = ? AND region_id = ?', +mm[1], R); if (!w) fail(404, 'پیدا نشد');
      const n = (await one('SELECT COUNT(*) AS n FROM reports r JOIN entries e ON e.id = r.entry_id WHERE e.week_id = ?', w.id)).n;
      if (n) fail(400, `برای این هفته ${n} گزارش ثبت شده و حذف نمی‌شود.`);
      await run('DELETE FROM weeks WHERE id = ?', w.id); console.log(`week deleted: «${w.title}» (region ${R}) by ${u.name} [${u.id}]`); return { ok: true };
    }
    /* the page read the Excel file itself (team-xlsx.js) and sends { name, parsed } */
    if (p === '/api/admin/import' && m === 'POST') {
      const b = await body(4 << 20), parsed = cleanParsed(b.parsed);
      const token = hex(rand(16)), now = Date.now();
      const users = await all("SELECT id, nid, name, sheet FROM users WHERE region_id = ? AND (role IN ('fm', 'region') OR lead = 1)", R);
      const sheets = parsed.sheets.map(s => {
        const c = parsed.codes.find(c => c.sheet === s.sheet), old = users.find(x => x.sheet === s.sheet);
        const guess = c ? { nid: c.nid, name: c.name || old?.name || '', from: 'codes' } : old ? { nid: old.nid, name: old.name, from: 'before' } : null;
        return { sheet: s.sheet, count: s.ids.length, hotels: [...new Set(s.ids.map(id => parsed.rows.find(r => r.row_no === id)?.hotel))], guess };
      });
      const same = await one('SELECT id FROM weeks WHERE region_id = ? AND title = ?', R, parsed.title);
      await DB.batch([prep('DELETE FROM previews WHERE exp < ?', now),
        prep('INSERT INTO previews (token, user_id, file, json, exp) VALUES (?, ?, ?, ?, ?)', token, u.id, S(b.name, 120), JSON.stringify(parsed), now + 30 * 60e3)]);
      return { token, title: parsed.title, main: parsed.mainName, rows: parsed.rows.length, hotels: new Set(parsed.rows.map(r => r.hotel)).size,
        problems: parsed.problems.slice(0, 20), sheets, codes: parsed.codes, users, replaces: !!same };
    }
    if (p === '/api/admin/import/commit' && m === 'POST') {
      const b = await body(), pv = await one('SELECT * FROM previews WHERE token = ?', String(b.token || ''));
      if (!pv || pv.user_id !== u.id || pv.exp < Date.now()) fail(400, 'پیش‌نمایش منقضی شد. فایل را دوباره بارگذاری کنید.');
      const parsed = JSON.parse(pv.json), title = String(b.title || parsed.title || 'هفته').slice(0, 120), map = b.map || {}, now = Date.now(), created = [], skipped = [];
      /* check every sheet owner before writing anything */
      const owners = [];
      for (const s of parsed.sheets) {
        const v = map[s.sheet]; if (!v || !v.nid) continue;
        const nid = nidNormalize(v.nid), name = String(v.name || '').trim().slice(0, 80);
        if (!nidValid(nid)) fail(400, `کد ملی شیت «${s.sheet}» (${v.nid}) معتبر نیست.`);
        if (!name) fail(400, `نام صاحب شیت «${s.sheet}» را بنویسید.`);
        owners.push({ s, nid, name });
      }
      const known = new Map((await all('SELECT * FROM users WHERE nid IN (SELECT value FROM json_each(?))', JSON.stringify(owners.map(o => o.nid)))).map(x => [x.nid, x]));
      for (const o of owners) {
        const x = known.get(o.nid);
        if (x && x.region_id !== R) fail(400, `کد ملی ${o.nid} در منطقه‌ی دیگری ثبت شده است.`);
        if (x && x.role === 'super') fail(400, `کد ملی ${o.nid} مال مدیر سامانه است.`);
      }
      let w = await one('SELECT * FROM weeks WHERE region_id = ? AND title = ?', R, title);
      if (w) await run('UPDATE weeks SET file = ?, imported = ?, imported_by = ? WHERE id = ?', pv.file, now, u.id, w.id);
      else w = await one('INSERT INTO weeks (region_id, title, file, imported, imported_by) VALUES (?, ?, ?, ?, ?) RETURNING id', R, title, pv.file, now, u.id);
      const J = 'json_extract(value, ', keep = JSON.stringify(parsed.rows.map(r => r.row_no));
      const st = [
        prep(`INSERT INTO entries (week_id, row_no, hotel, home_mgr, cook, caravans, d_in, d_out, pilgrims, company, siyahe, rooms, beds)
          SELECT ?, ${J}'$.row_no'), ${J}'$.hotel'), ${J}'$.home_mgr'), ${J}'$.cook'), ${J}'$.caravans'), ${J}'$.d_in'), ${J}'$.d_out'), ${J}'$.pilgrims'), ${J}'$.company'), ${J}'$.siyahe'), ${J}'$.rooms'), ${J}'$.beds') FROM json_each(?) WHERE true
          ON CONFLICT (week_id, row_no) DO UPDATE SET hotel = excluded.hotel, home_mgr = excluded.home_mgr, cook = excluded.cook, caravans = excluded.caravans, d_in = excluded.d_in,
          d_out = excluded.d_out, pilgrims = excluded.pilgrims, company = excluded.company, siyahe = excluded.siyahe, rooms = excluded.rooms, beds = excluded.beds`, w.id, JSON.stringify(parsed.rows)),
        prep('DELETE FROM entries WHERE week_id = ? AND row_no NOT IN (SELECT value FROM json_each(?)) AND id NOT IN (SELECT entry_id FROM reports) AND id NOT IN (SELECT entry_id FROM meal_checks) AND id NOT IN (SELECT entry_id FROM entry_occ)', w.id, keep),
        prep('DELETE FROM assign WHERE entry_id IN (SELECT id FROM entries WHERE week_id = ?)', w.id),
        prep('DELETE FROM sheet_rows WHERE week_id = ?', w.id),
        prep(`INSERT OR IGNORE INTO sheet_rows (week_id, sheet, row_no) SELECT ?, ${J}'$.s'), ${J}'$.r') FROM json_each(?)`, w.id, JSON.stringify(parsed.sheets.flatMap(s => s.ids.map(r => ({ s: s.sheet, r })))))];
      for (const o of owners) {
        const x = known.get(o.nid);
        if (!x && !can(u, 'fm')) { skipped.push(o.name); continue; }
        if (x) st.push(x.role === 'fm' ? prep('UPDATE users SET name = ?, sheet = ? WHERE id = ?', o.name, o.s.sheet, x.id) : prep('UPDATE users SET sheet = ? WHERE id = ?', o.s.sheet, x.id));
        else {
          const pw = tempPassword(), h = await hashPassword(pw);
          st.push(prep("INSERT INTO users (region_id, role, nid, name, sheet, salt, hash, must_change, created, created_by) VALUES (?, 'fm', ?, ?, ?, ?, ?, 0, ?, ?)", R, o.nid, o.name, o.s.sheet, h.salt, h.hash, now, u.id));
          created.push({ name: o.name, nid: o.nid, password: pw, temporary: false });
        }
        st.push(prep(`INSERT OR IGNORE INTO assign (entry_id, user_id) SELECT e.id, (SELECT id FROM users WHERE nid = ?) FROM entries e WHERE e.week_id = ? AND e.row_no IN (SELECT value FROM json_each(?))`,
          o.nid, w.id, JSON.stringify(o.s.ids)));
      }
      st.push(prep('DELETE FROM previews WHERE token = ?', pv.token));
      await DB.batch(st);
      /* sheets left without a national code still reach whoever already has that sheet name on their account */
      const fms = await all("SELECT id FROM users WHERE region_id = ? AND (role IN ('fm', 'region') OR lead = 1) AND sheet IS NOT NULL", R);
      if (fms.length) await DB.batch(fms.flatMap(x => syncSheetStmts(x.id)));
      const assigned = (await one('SELECT COUNT(*) AS n FROM assign a JOIN entries e ON e.id = a.entry_id WHERE e.week_id = ?', w.id)).n;
      return { week: w.id, assigned, created, skipped, title };
    }
    if (p === '/api/admin/users' && m === 'GET') {
      return all(`SELECT u.id, u.role, u.nid, u.name, u.sheet, u.active, u.must_change, u.last_login, u.created,
        (SELECT COUNT(*) FROM passkeys k WHERE k.user_id = u.id) AS passkeys, (SELECT COUNT(*) FROM reports r WHERE r.user_id = u.id) AS reports,
        (SELECT COUNT(*) FROM assign a WHERE a.user_id = u.id) AS entries
        FROM users u WHERE u.region_id = ? AND u.role IN ('fm', 'region') ORDER BY u.role = 'region' DESC, u.name`, R);
    }
    if (p === '/api/admin/users' && m === 'POST') {
      const b = await body(), nid = nidNormalize(b.nid), name = String(b.name || '').trim().slice(0, 80);
      if (!nidValid(nid)) fail(400, 'کد ملی معتبر نیست.');
      if (!name) fail(400, 'نام را بنویسید.');
      if (await one('SELECT 1 FROM users WHERE nid = ?', nid)) fail(400, 'این کد ملی قبلاً ثبت شده است.');
      const h = await newPassword(b.password, 'fm');
      const nu = await one("INSERT INTO users (region_id, role, nid, name, sheet, salt, hash, must_change, created, created_by) VALUES (?, 'fm', ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
        R, nid, name, String(b.sheet || '').trim().slice(0, 60) || null, h.salt, h.hash, h.must, Date.now(), u.id);
      return { name, nid, password: h.pw, temporary: !!h.must, entries: await syncSheet(nu.id) };
    }
    if ((mm = p.match(/^\/api\/admin\/users\/(\d+)\/(reset|active|passkeys|edit)$/)) && m === 'POST') {
      const t = await one("SELECT * FROM users WHERE id = ? AND region_id = ? AND role IN ('fm', 'region')", +mm[1], R); if (!t) fail(404, 'پیدا نشد');
      /* حساب مدیر منطقه را این‌جا فقط خودش (یا مدیر سامانه) ویرایش می‌کند و فقط نام و شیت؛ رمز و فعال/غیرفعال در پنل مدیر سامانه است */
      if (t.role === 'region' && (mm[2] !== 'edit' || (u.role !== 'super' && t.id !== u.id))) fail(403, 'حساب مدیر منطقه را فقط سرپرست مناطق یا مدیر سامانه تغییر می‌دهد.');
      if (t.role === 'fm') need('fm');
      const b = await body();
      if (mm[2] === 'reset') { const h = await newPassword(b.password, 'fm'); await DB.batch([prep('UPDATE users SET salt = ?, hash = ?, must_change = ? WHERE id = ?', h.salt, h.hash, h.must, t.id), endAll(t.id)]); return { name: t.name, nid: t.nid, password: h.pw, temporary: !!h.must }; }
      if (mm[2] === 'active') { await DB.batch([prep('UPDATE users SET active = ? WHERE id = ?', b.active ? 1 : 0, t.id), ...(b.active ? [] : [endAll(t.id)])]); return { ok: true }; }
      if (mm[2] === 'passkeys') { await run('DELETE FROM passkeys WHERE user_id = ?', t.id); return { ok: true }; }
      if (mm[2] === 'edit') { const name = String(b.name || '').trim().slice(0, 80); if (!name) fail(400, 'نام را بنویسید.'); await run('UPDATE users SET name = ?, sheet = ? WHERE id = ?', name, String(b.sheet || '').trim().slice(0, 60) || null, t.id); return { ok: true, entries: await syncSheet(t.id) }; }
    }
    if (p === '/api/admin/dashboard' && m === 'GET') {
      const weeks = await all('SELECT id, title, imported FROM weeks WHERE region_id = ? ORDER BY imported DESC', R);
      const wid = +url.searchParams.get('week') || weeks[0]?.id || 0;
      if (wid && !weeks.find(w => w.id === wid)) fail(404, 'هفته پیدا نشد');
      const people = await all(`SELECT u.id, u.name, u.nid, COUNT(a.entry_id) AS entries, COUNT(r.id) AS reported, MAX(r.updated) AS last,
          GROUP_CONCAT(DISTINCT e.hotel) AS hotels, SUM(e.pilgrims) AS pilgrims
        FROM users u JOIN assign a ON a.user_id = u.id JOIN entries e ON e.id = a.entry_id AND e.week_id = ? LEFT JOIN reports r ON r.entry_id = e.id AND r.user_id = u.id
        WHERE u.region_id = ? GROUP BY u.id ORDER BY u.name`, wid, R);
      const defects = (await defectRows(R, wid)).map(d => ({ key: d.rid + '|' + d.qid, report_id: d.rid, qid: d.qid, uid: d.uid, person: d.person, hotel: d.hotel, company: d.company, siyahe: d.siyahe,
        d_in: d.d_in, d_out: d.d_out, pilgrims: d.pilgrims, section: d.section, question: d.question, answer: d.answer_label, reasons: json(d.reasons), day: d.day,
        actions: json(d.actions), actionText: d.action_text, result: d.result, resultNote: d.result_note, updated: d.updated, descr: d.descr, entry_id: d.entry_id }));
      const entries = await one('SELECT COUNT(*) AS n, SUM(pilgrims) AS p, COUNT(DISTINCT hotel) AS h FROM entries WHERE week_id = ?', wid);
      return { weeks, week: wid, people, defects, entries, sections: (await formOf(R)).sections.map(s => ({ title: s.title, emoji: s.emoji })) };
    }
    /* کیفیت هتل‌ها و شرکت‌ها؛ week=all یعنی همه‌ی هفته‌ها، وگرنه یک هفته با مقایسه با هفته‌ی قبل */
    if (p === '/api/admin/quality' && m === 'GET') {
      const weeks = await all('SELECT id, title, imported FROM weeks WHERE region_id = ? ORDER BY imported DESC', R);
      const wq = url.searchParams.get('week'), isAll = wq === 'all', wid = isAll ? 0 : +wq || weeks[0]?.id || 0;
      if (wid && !weeks.find(w => w.id === wid)) fail(404, 'هفته پیدا نشد');
      const ids = isAll ? weeks.map(w => w.id) : wid ? [wid] : [], Q = await qualityOf(ids);
      Q.dir = await dirOf(ids);
      await withRatings(Q, ids);
      const prevW = isAll ? null : weeks[weeks.findIndex(w => w.id === wid) + 1];
      if (prevW) { const P = await qualityOf([prevW.id]), pm = new Map(P.hotels.map(h => [h.key, h.score])); Q.hotels.forEach(h => h.prev = pm.get(h.key) ?? null); Q.prevTitle = prevW.title; }
      return { weeks, week: isAll ? 'all' : wid, ...Q };
    }
    /* ارزیابی مدیر منطقه: stars ۱ تا ۵ (۰ = پاک کردن)، برچسب‌ها و ملاحظات؛ برای یک هفته‌ی مشخص */
    if (p === '/api/admin/rating' && m === 'POST') {
      const b = await body(), wid = +b.week, hotel = normName(b.hotel), stars = Math.round(+b.stars || 0);
      if (!await one('SELECT 1 FROM weeks WHERE id = ? AND region_id = ?', wid, R)) fail(404, 'هفته پیدا نشد');
      const names = new Set((await all('SELECT DISTINCT hotel FROM entries WHERE week_id = ?', wid)).map(e => normName(e.hotel)));
      if (!hotel || !names.has(hotel)) fail(404, 'این هتل در اکسل این هفته نیست.');
      if (stars < 0 || stars > 5) fail(400, 'امتیاز باید بین ۱ تا ۵ باشد.');
      if (!stars) await run('DELETE FROM region_ratings WHERE week_id = ? AND hotel = ?', wid, hotel);
      else {
        const tags = (Array.isArray(b.tags) ? b.tags : []).filter(t => RR_TAGS.includes(t)), note = String(b.note || '').trim().slice(0, 1500);
        await run(`INSERT INTO region_ratings (week_id, hotel, region_id, stars, tags, note, user_id, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
          ON CONFLICT(week_id, hotel) DO UPDATE SET stars = ?4, tags = ?5, note = ?6, user_id = ?7, updated = ?8`, wid, hotel, R, stars, JSON.stringify(tags), note, u.id, Date.now());
      }
      return { rr: (await ratingsOf([wid])).get(R + '|' + hotel) || null };
    }
    /* ═════ عوامل منطقه ═════ */
    if (p === '/api/admin/staff' && m === 'GET') {
      const rows = await all('SELECT * FROM staff WHERE region_id = ? ORDER BY status = \'active\' DESC, d_end, last LIMIT 5000', R);
      const moves = await all('SELECT m.staff_id, m.from_hotel, m.to_hotel, m.ts, u2.name AS by FROM staff_moves m JOIN staff s ON s.id = m.staff_id LEFT JOIN users u2 ON u2.id = m.by WHERE s.region_id = ? ORDER BY m.ts DESC LIMIT 3000', R);
      const wk = await all('SELECT id FROM weeks WHERE region_id = ? ORDER BY imported DESC LIMIT 4', R);
      const ent = wk.length ? await all(`SELECT hotel, home_mgr, cook FROM entries WHERE week_id IN (${wk.map(() => '?').join(',')})`, ...wk.map(w => w.id)) : [];
      const hotels = [...new Set([...ent.map(e => normName(e.hotel)), ...rows.map(r => r.hotel)].filter(Boolean))];
      const names = new Map();
      for (const e of ent) { for (const [k, role] of [['home_mgr', 'مدیر ثابت'], ['cook', 'آشپز']]) for (const n of String(e[k] || '').split(/[،,\/\n]+|\s-\s/)) { const t = stS(n, 80); if (t && t.length > 3) names.set(t + '|' + role, { name: t, role, hotel: normName(e.hotel) }); } }
      /* مدیران ثابتِ همین منطقه که در سامانه حساب دارند (با کد ملی و هتل‌های آخرین هفته) — برای ثبت سریع در عوامل */
      const fms = await all(`SELECT u.name, u.nid, (SELECT group_concat(e.hotel, '|') FROM assign a JOIN entries e ON e.id = a.entry_id WHERE a.user_id = u.id AND e.week_id = ?) AS hotels
        FROM users u WHERE u.region_id = ? AND u.role = 'fm' AND u.active = 1 ORDER BY u.name`, wk[0] ? wk[0].id : 0, R);
      const geo = await all('SELECT hotel, lat, lng FROM hotel_geo WHERE region_id = ?', R);
      const tb = await one('SELECT linked FROM team_bale WHERE user_id = ?', u.id);
      const region = await one('SELECT name, city FROM regions WHERE id = ?', R);
      const evals = await all("SELECT ref_id, score, answers, note, t FROM evals WHERE kind = 'staff' AND region_id = ? ORDER BY t", R);
      return { regionCity: region.city || '', rows, moves, evals: evals.map(e => ({ ...e, answers: json(e.answers) || [] })), evalQs: (await opsCfg()).evalStaff, evalFmQs: (await opsCfg()).evalFm, roles: await staffRoles(R), hotels, suggest: [...names.values()], fms: fms.map(x => ({ name: x.name, nid: x.nid, hotels: [...new Set(String(x.hotels || '').split('|').map(normName).filter(Boolean))] })), geo, bale: !!tb, region: region.name, today: JD.str(JD.today()), maxDays: STAFF_MAX_DAYS };
    }
    if (p === '/api/admin/staff' && m === 'POST') {
      const b = await body(), roles = await staffRoles(R), v = staffRow(b, roles); if (v.err) fail(400, v.err);
      const x = v.x, id = +b.id || 0, now = Date.now();
      const dup = await one("SELECT id FROM staff WHERE region_id = ? AND nid = ? AND status = 'active' AND id != ?", R, x.nid, id);
      if (dup) fail(400, `«${x.first} ${x.last}» با همین کد ملی الان یک دوره‌ی فعال دارد؛ همان را ویرایش یا تمدید کنید.`);
      if (id) {
        const old = await one('SELECT * FROM staff WHERE id = ? AND region_id = ?', id, R); if (!old) fail(404, 'پیدا نشد');
        await run('UPDATE staff SET first = ?, last = ?, nid = ?, role = ?, hotel = ?, d_start = ?, d_end = ?, note = ?, updated = ?, by = ? WHERE id = ?', x.first, x.last, x.nid, x.role, x.hotel, x.d_start, x.d_end, x.note, now, u.id, id);
        if ((old.hotel || '') !== (x.hotel || '')) await run('INSERT INTO staff_moves (staff_id, from_hotel, to_hotel, ts, by) VALUES (?, ?, ?, ?, ?)', id, old.hotel, x.hotel, now, u.id);
        return { ok: true, id };
      }
      const r = await one('INSERT INTO staff (region_id, first, last, nid, role, hotel, d_start, d_end, note, created, updated, by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
        R, x.first, x.last, x.nid, x.role, x.hotel, x.d_start, x.d_end, x.note, now, now, u.id);
      return { ok: true, id: r.id };
    }
    /* اکسل: ردیف‌ها در مرورگر خوانده می‌شود؛ کسی که دوره‌ی فعال دارد به‌روز می‌شود، بقیه اضافه */
    if (p === '/api/admin/staff/import' && m === 'POST') {
      const b = await body(2 << 20), roles = await staffRoles(R), now = Date.now(), errs = [], ok = [];
      for (const [i, r] of (Array.isArray(b.rows) ? b.rows : []).slice(0, 2000).entries()) { const v = staffRow(r, roles); if (v.err) errs.push(`ردیف ${i + 2}: ${v.err}`); else ok.push(v.x); }
      if (errs.length && !b.skipBad) return { ok: false, errors: errs.slice(0, 50), nErr: errs.length, nOk: ok.length };
      const act = new Map((await all("SELECT id, nid, hotel FROM staff WHERE region_id = ? AND status = 'active'", R)).map(r => [r.nid, r]));
      const q = []; let added = 0, updated = 0;
      for (const x of ok) {
        const a = act.get(x.nid);
        if (a) { updated++; q.push(prep('UPDATE staff SET first = ?, last = ?, role = ?, hotel = ?, d_start = ?, d_end = ?, note = COALESCE(NULLIF(?, \'\'), note), updated = ?, by = ? WHERE id = ?', x.first, x.last, x.role, x.hotel, x.d_start, x.d_end, x.note, now, u.id, a.id));
          if ((a.hotel || '') !== (x.hotel || '')) q.push(prep('INSERT INTO staff_moves (staff_id, from_hotel, to_hotel, ts, by) VALUES (?, ?, ?, ?, ?)', a.id, a.hotel, x.hotel, now, u.id)); }
        else { added++; act.set(x.nid, { id: -1 }); q.push(prep('INSERT INTO staff (region_id, first, last, nid, role, hotel, d_start, d_end, note, created, updated, by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', R, x.first, x.last, x.nid, x.role, x.hotel, x.d_start, x.d_end, x.note, now, now, u.id)); }
      }
      for (let i = 0; i < q.length; i += 90) await DB.batch(q.slice(i, i + 90));
      return { ok: true, added, updated, nErr: errs.length };
    }
    /* جابجایی یک یا چند نفر به هتل دیگر (سابقه در staff_moves) */
    if (p === '/api/admin/staff/move' && m === 'POST') {
      const b = await body(), hotel = normName(stS(b.hotel, 120)), ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Boolean).slice(0, 200), now = Date.now();
      if (!ids.length) fail(400, 'کسی انتخاب نشده است.');
      const rows = await all(`SELECT id, hotel FROM staff WHERE region_id = ? AND status = 'active' AND id IN (${ids.map(() => '?').join(',')})`, R, ...ids);
      const ch = rows.filter(r => (r.hotel || '') !== hotel);
      if (ch.length) await DB.batch(ch.flatMap(r => [prep('UPDATE staff SET hotel = ?, updated = ?, by = ? WHERE id = ?', hotel, now, u.id, r.id), prep('INSERT INTO staff_moves (staff_id, from_hotel, to_hotel, ts, by) VALUES (?, ?, ?, ?, ?)', r.id, r.hotel, hotel, now, u.id)]));
      return { ok: true, moved: ch.map(r => ({ id: r.id, from: r.hotel || '' })) };
    }
    /* تمدید: دوره‌ی فعلی «تمدیدشده» می‌شود و دوره‌ی تازه با همان مشخصات و تاریخ‌های تازه ساخته می‌شود */
    if (p === '/api/admin/staff/extend' && m === 'POST') {
      const b = await body(), old = await one("SELECT * FROM staff WHERE id = ? AND region_id = ? AND status = 'active'", +b.id, R); if (!old) fail(404, 'این دوره پیدا نشد یا دیگر فعال نیست.');
      const ds = JD.num(b.d_start), de = JD.num(b.d_end); if (ds == null || de == null || de < ds) fail(400, 'تاریخ‌های دوره‌ی تازه درست نیست.');
      const now = Date.now();
      const r = await DB.batch([prep("UPDATE staff SET status = 'extended', updated = ?, by = ? WHERE id = ?", now, u.id, old.id),
        prep('INSERT INTO staff (region_id, first, last, nid, role, hotel, d_start, d_end, note, prev_id, created, updated, by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
          R, old.first, old.last, old.nid, old.role, old.hotel, JD.str(ds), JD.str(de), old.note, old.id, now, now, u.id)]);
      return { ok: true, id: r[1].results[0].id };
    }
    /* خروج: دوره بسته می‌شود (پاک نمی‌شود)؛ undo=1 برمی‌گرداند */
    if (p === '/api/admin/staff/leave' && m === 'POST') {
      const b = await body(), s0 = await one('SELECT * FROM staff WHERE id = ? AND region_id = ?', +b.id, R); if (!s0) fail(404, 'پیدا نشد');
      if (b.undo) {
        if (s0.status !== 'left') fail(400, 'این دوره بسته نشده است.');
        if (await one("SELECT 1 FROM staff WHERE region_id = ? AND nid = ? AND status = 'active'", R, s0.nid)) fail(400, 'این نفر الان دوره‌ی فعال دیگری دارد.');
        await run("UPDATE staff SET status = 'active', left_at = NULL, updated = ?, by = ? WHERE id = ?", Date.now(), u.id, s0.id); return { ok: true };
      }
      if (s0.status !== 'active') fail(400, 'این دوره فعال نیست.');
      const d = b.date ? JD.num(b.date) : JD.today(); if (d == null) fail(400, 'تاریخ خروج درست نیست.');
      const q = [prep("UPDATE staff SET status = 'left', left_at = ?, updated = ?, by = ? WHERE id = ?", JD.str(d), Date.now(), u.id, s0.id)];
      if (b.eval) q.push(evalIns('staff', s0.id, R, s0.first + ' ' + s0.last, evalOf(b.eval, staffQs(await opsCfg(), s0.role)), u.id));
      await DB.batch(q); return { ok: true };
    }
    if (p === '/api/admin/staff/del' && m === 'POST') {
      const b = await body(), s0 = await one('SELECT * FROM staff WHERE id = ? AND region_id = ?', +b.id, R); if (!s0) fail(404, 'پیدا نشد');
      const q = [prep('DELETE FROM staff_moves WHERE staff_id = ?', s0.id), prep('DELETE FROM staff WHERE id = ?', s0.id)];
      /* اگر دوره‌ی تمدیدشده‌ی قبلی دارد، همان دوباره فعال می‌شود */
      if (s0.prev_id && s0.status === 'active') q.push(prep("UPDATE staff SET status = 'active' WHERE id = ? AND status = 'extended'", s0.prev_id));
      q.push(prep('UPDATE staff SET prev_id = ? WHERE prev_id = ?', s0.prev_id, s0.id));
      await DB.batch(q); return { ok: true };
    }
    if (p === '/api/admin/staff/roles' && m === 'POST') {
      const b = await body(), roles = [...new Set((Array.isArray(b.roles) ? b.roles : []).map(r => stS(r, 30)).filter(Boolean))].slice(0, 20);
      if (!roles.length) fail(400, 'دست‌کم یک نقش لازم است.');
      const used = (await all("SELECT DISTINCT role FROM staff WHERE region_id = ? AND status = 'active'", R)).map(r => r.role).filter(r => !roles.includes(r));
      if (used.length) fail(400, `نقش «${used[0]}» هنوز برای نیروهای فعال استفاده می‌شود و حذف نمی‌شود.`);
      await run('INSERT OR REPLACE INTO staff_cfg (region_id, roles, updated) VALUES (?, ?, ?)', R, JSON.stringify(roles), Date.now());
      return { ok: true, roles };
    }
    if (p === '/api/admin/hotel-geo' && m === 'POST') {
      const b = await body(), hotel = normName(stS(b.hotel, 120)), lat = +b.lat, lng = +b.lng;
      if (!hotel) fail(400, 'نام هتل لازم است.');
      if (b.clear) { await run('DELETE FROM hotel_geo WHERE region_id = ? AND hotel = ?', R, hotel); return { ok: true }; }
      if (!(lat > 29 && lat < 38 && lng > 38 && lng < 49)) fail(400, 'این نقطه داخل عراق نیست.');
      await run('INSERT OR REPLACE INTO hotel_geo (region_id, hotel, lat, lng) VALUES (?, ?, ?, ?)', R, hotel, lat, lng);
      return { ok: true };
    }
    /* اتصال به بله: کد یک‌بارمصرف → ble.ir/HamyarKaravan_Bot?start=t_کد (بازو در worker hamyar-reviews) */
    if (p === '/api/admin/bale/link' && m === 'POST') {
      const code = hex(rand(8));
      await run('DELETE FROM team_bale_links WHERE exp < ? OR user_id = ?', Date.now(), u.id);
      await run('INSERT INTO team_bale_links (code, user_id, exp) VALUES (?, ?, ?)', code, u.id, Date.now() + 15 * 6e4);
      return { url: 'https://ble.ir/HamyarKaravan_Bot?start=t_' + code };
    }
    if (p === '/api/admin/bale' && m === 'GET') return { linked: !!await one('SELECT 1 FROM team_bale WHERE user_id = ?', u.id) };
    if (p === '/api/admin/bale/off' && m === 'POST') { await run('DELETE FROM team_bale WHERE user_id = ?', u.id); return { ok: true }; }
    if ((mm = p.match(/^\/api\/admin\/defect\/(\d+)$/)) && m === 'GET') {
      const r = await canSeeReport(u, +mm[1]);
      return { notes: await notesOf(r.id), media: await mediaOf(r.entry_id, r.user_id) };
    }
    /* rows of the defects Excel; the page builds the .xlsx file itself */
    if (p === '/api/admin/export' && m === 'GET') {
      const wid = +url.searchParams.get('week'), w = await one('SELECT * FROM weeks WHERE id = ? AND region_id = ?', wid, R); if (!w) fail(404, 'هفته پیدا نشد');
      const rows = await defectRows(R, wid, { person: url.searchParams.get('person'), section: url.searchParams.get('section'), result: url.searchParams.get('result') });
      const rids = [...new Set(rows.map(d => d.rid))];
      const notes = await all('SELECT n.report_id, n.qid, n.role, n.text FROM notes n WHERE n.report_id IN (SELECT value FROM json_each(?)) ORDER BY n.ts', JSON.stringify(rids));
      const mc = new Map((await all(`SELECT m.entry_id || '|' || m.user_id || '|' || m.qid AS k, COUNT(*) AS n FROM media m JOIN entries e ON e.id = m.entry_id WHERE e.week_id = ? GROUP BY k`, wid)).map(x => [x.k, x.n]));
      const data = rows.map(d => {
        const ns = notes.filter(n => n.report_id === d.rid && (!n.qid || n.qid === d.qid));
        return [d.person, d.nid, d.hotel, d.company, d.siyahe, persianDigits(d.d_in), persianDigits(d.d_out), d.pilgrims, d.section, d.question, d.answer_label,
          json(d.reasons).join('، '), d.day ? persianDigits(d.day) : '', [...json(d.actions), d.action_text].filter(Boolean).join('، '), d.result ? RESULT[d.result] : 'ثبت نشده', d.result_note || '',
          ns.filter(n => n.role === 'region').map(n => n.text).join(' / '), ns.filter(n => n.role === 'fm').map(n => n.text).join(' / '), mc.get(d.entry_id + '|' + d.uid + '|' + d.qid) || 0, faDate(d.updated)];
      });
      /* برگه‌ی دوم: همه‌ی گزارش‌های ثبت‌شده (با نقص و بی‌نقص)، هر گزارش یک ردیف و پاسخ هر سؤال یک ستون؛ فقط فیلتر «فرد» روی آن اثر دارد */
      const person = +url.searchParams.get('person') || 0;
      const reps = await all(`SELECT r.id AS rid, r.descr, r.updated, u.name AS person, u.nid, e.hotel, e.company, e.siyahe, e.d_in, e.d_out, e.pilgrims
        FROM reports r JOIN users u ON u.id = r.user_id JOIN entries e ON e.id = r.entry_id
        WHERE e.week_id = ?1 AND u.region_id = ?2 AND (?3 = 0 OR u.id = ?3) ORDER BY u.name, e.hotel, e.d_in, e.row_no`, wid, R, person);
      const its = await all(`SELECT i.report_id, i.qid, i.question, i.answer_label, i.is_defect, i.result FROM items i JOIN reports r ON r.id = i.report_id JOIN entries e ON e.id = r.entry_id
        WHERE e.week_id = ? AND r.id IN (SELECT value FROM json_each(?))`, wid, JSON.stringify(reps.map(r => r.rid)));
      const cols = (await formOf(R)).sections.flatMap(sec => sec.questions.map(q => ({ id: q.id, t: q.text })));
      for (const i of its) if (!cols.find(c => c.id === i.qid)) cols.push({ id: i.qid, t: i.question || i.qid });   /* سؤالی که بعداً از فرم حذف شده */
      const byRep = new Map(); for (const i of its) { if (!byRep.has(i.report_id)) byRep.set(i.report_id, new Map()); byRep.get(i.report_id).set(i.qid, i); }
      const RRm = await ratingsOf([wid]);
      const rrOf = h => { const x = RRm.get(R + '|' + normName(h)), i = x && x.list[0]; return i ? [persianDigits(i.stars) + ' از ۵', [i.tags.join('، '), i.note].filter(Boolean).join(' — ')] : ['', '']; };
      const all_ = reps.map(r => {
        const m = byRep.get(r.rid) || new Map(), defs = [...m.values()].filter(i => i.is_defect), open = defs.filter(i => i.result !== 'fixed').length;
        return [r.person, r.nid, r.hotel, r.company, r.siyahe, persianDigits(r.d_in), persianDigits(r.d_out), r.pilgrims,
          defs.length ? `${persianDigits(defs.length)} نقص` : 'بدون نقص', defs.length ? (open ? `${persianDigits(open)} باز` : 'همه رفع شد') : '', r.descr || '',
          ...cols.map(c => { const i = m.get(c.id); return !i ? '' : i.is_defect ? `${i.answer_label} ⚠ (${RESULT[i.result] || 'ثبت نشده'})` : i.answer_label; }), faDate(r.updated), ...rrOf(r.hotel)];
      });
      return { title: `نواقص گزارش‌شده · ${w.title}`, file: 'گزارش‌ها-' + w.title + '.xlsx', rows: data,
        reports: { title: `همه‌ی گزارش‌های ثبت‌شده · ${w.title}`, head: ['ردیف', 'مدیر ثابت', 'کد ملی', 'هتل', 'شرکت مجری', 'شرکت سیاحه', 'ورود کاروان', 'خروج کاروان', 'تعداد زائر', 'نتیجه گزارش', 'نقص‌های باز', 'توضیح کلی', ...cols.map(c => c.t), 'آخرین به‌روزرسانی', 'امتیاز مدیر منطقه به هتل', 'ملاحظات مدیر منطقه'], rows: all_ } };
    }
    fail(404, 'پیدا نشد');
  }
  fail(404, 'پیدا نشد');
}

const bearer = (req, url) => (/^Bearer ([0-9a-f]{64})$/.exec(req.headers.get('authorization') || '') || [])[1] || (/^[0-9a-f]{64}$/.test(url.searchParams.get('_t') || '') ? url.searchParams.get('_t') : '');
function jres(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...headers } });
}

/* hourly: media older than 7 days, finished/abandoned uploads, old sessions and helpers */
async function cleanup() {
  const now = Date.now();
  const old = await all("SELECT id, file FROM media WHERE created < ? AND status != 'expired' LIMIT 40", now - KEEP_DAYS * 864e5);
  for (const m of old) if (m.file) await MDB.prepare('DELETE FROM chunks WHERE k = ?').bind(m.file).run();
  const stale = await all('SELECT k FROM uploads WHERE exp < ? AND res IS NULL LIMIT 20', now);
  for (const x of stale) await MDB.prepare('DELETE FROM chunks WHERE k = ?').bind(x.k).run();
  await DB.batch([
    ...old.map(m => prep("UPDATE media SET status = 'expired', file = NULL WHERE id = ?", m.id)),
    prep('DELETE FROM uploads WHERE exp < ?', now), prep('DELETE FROM sessions WHERE exp < ?', now), prep('DELETE FROM previews WHERE exp < ?', now),
    prep('DELETE FROM challenges WHERE exp < ?', now), prep('DELETE FROM tries WHERE first < ? AND until < ?', now - 864e5, now)]);
}

export default {
  async fetch(req, env, ctx) {
    DB = env.DB; MDB = env.MDB; ENV = env;
    const url = new URL(req.url); BASE = url.origin;
    const origin = req.headers.get('origin'), allowed = (env.ALLOWED_ORIGINS || 'https://mirahmadian.github.io').split(',');
    const cors = origin && allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Expose-Headers': 'Content-Disposition' } : {};
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Orig-Size', 'Access-Control-Max-Age': '86400' } });
    /* باز کردن سامانه از پنل مدیریت در «تب» مرورگر: team.html در محدوده‌ی برنامه‌ی نصب‌شده‌ی همیار کاروان است و Chrome آن را در پنجره‌ی جدای برنامه باز می‌کند؛
       لینک اول به این نشانیِ بیرون از محدوده می‌آید (پس تب معمولی باز می‌شود) و همین‌جا به سامانه برمی‌گردد. مقصد ثابت است (تغییرمسیر باز نیست). */
    if (url.pathname === '/go/team' || url.pathname === '/go/team-owner') {
      const to = 'https://mirahmadian.github.io/iraq-guide/team.html' + (url.pathname === '/go/team-owner' ? '#owner' : '');
      /* تغییرمسیر 302 هم جزو همان باز شدن حساب می‌شود و Chrome باز آن را به پنجره‌ی برنامه می‌برد؛ پس صفحه اول در همین تب کامل باز می‌شود
         و بعد خودش در همین تب به سامانه می‌رود (رفتن در همان تب را Chrome به برنامه نمی‌برد) */
      const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>سامانه پایش خدمات</title>
<style>body{font-family:Tahoma,sans-serif;background:#FAF6EE;color:#2A2116;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#1f6b4f;font-weight:700}</style></head>
<body><p>در حال باز کردن سامانه پایش خدمات… <a href="${to}">اگر باز نشد این‌جا را بزنید</a></p>
<script>setTimeout(function(){location.replace(${JSON.stringify(to)});},150);</script></body></html>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    try {
      if (url.pathname.startsWith('/api/')) {
        const out = await api(req, url, await sessionUser(bearer(req, url)));
        return jres(200, out, cors);
      }
      const mm = url.pathname.match(/^\/media\/(\d+)$/);
      if (mm) return await serveMedia(req, +mm[1], url, cors);
      if (url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/admin/') return Response.redirect('https://mirahmadian.github.io/iraq-guide/team.html', 302);
      return jres(404, { error: 'پیدا نشد' }, cors);
    } catch (e) {
      if (!(e instanceof HttpError)) { console.error(req.method, url.pathname, e && e.stack || e); ctx.waitUntil(logError(env.DB, 'hamyar-team', req, e)); }
      return jres(e.status || 500, { error: e instanceof HttpError ? e.message : 'خطای سرور. دوباره امتحان کنید.' }, cors);
    }
  },
  async scheduled(ev, env, ctx) { DB = env.DB; MDB = env.MDB; ENV = env; ctx.waitUntil(cleanup()); }
};
