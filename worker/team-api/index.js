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
async function formOf(regionId) { const r = await one('SELECT json FROM forms WHERE region_id = ?', regionId); return r ? JSON.parse(r.json) : DEFAULT_FORM; }
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
async function meOf(u) {
  const region = await one('SELECT name FROM regions WHERE id = ?', u.region_id);
  return { id: u.id, name: u.name, nid: u.nid, role: u.role, lead: !!u.lead, leadLabel: await leadLabel(), owner: u.nid === 'owner', mustChange: !!u.must_change, region: region?.name || (u.role === 'super' ? 'همه‌ی مناطق' : ''),
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
      pilgrims: int(r.pilgrims), company: S(r.company, 300), siyahe: S(r.siyahe, 300) });
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
    if (u.role !== 'fm' && u.role !== 'region') fail(403, 'این بخش مخصوص مدیران ثابت است.');
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
    if ((mm = p.match(/^\/api\/fm\/entry\/(\d+)$/))) {
      const e = await fmEntry(u, +mm[1]), form = await formOf(u.region_id);
      if (m === 'GET') {
        const r = await one('SELECT * FROM reports WHERE entry_id = ? AND user_id = ?', e.id, u.id);
        const items = r ? (await all('SELECT * FROM items WHERE report_id = ?', r.id)).map(i => ({ qid: i.qid, v: i.answer, reasons: json(i.reasons), day: i.day, actions: json(i.actions), actionText: i.action_text, result: i.result, resultNote: i.result_note })) : [];
        return { entry: e, form, report: r ? { id: r.id, descr: r.descr, updated: r.updated } : null, items, media: await mediaOf(e.id, u.id), notes: r ? await notesOf(r.id) : [] };
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
            r.id, qid, qn.sec, qn.text, String(a.v), answerLabel(qn, a.v), def ? 1 : 0, def ? arr(a.reasons, 20) : '[]', def && /^\d{4}\/\d{2}\/\d{2}$/.test(a.day || '') ? a.day : null,
            def ? arr(a.actions, 20) : '[]', def ? String(a.actionText || '').slice(0, 1000) : '', def && RESULT[a.result] ? a.result : null, def ? String(a.resultNote || '').slice(0, 1000) : '', now));
        }
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
      const managers = await all("SELECT id, region_id, name, nid, active, must_change, last_login FROM users WHERE role = 'region' ORDER BY name");
      regions.forEach(r => r.managers = managers.filter(x => x.region_id === r.id));
      return { regions, cities: CITIES, leadLabel: await leadLabel(), full: isFull(u) };
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
      return all(`SELECT x.id, x.role, x.lead, x.nid, x.name, x.sheet, x.active, x.must_change, x.last_login, x.created, x.region_id, r.name AS region, r.city, c.name AS creator, c.role AS creator_role, c.lead AS creator_lead,
          (SELECT COUNT(*) FROM reports rp WHERE rp.user_id = x.id) AS reports, (SELECT COUNT(*) FROM passkeys k WHERE k.user_id = x.id) AS passkeys
        FROM users x LEFT JOIN regions r ON r.id = x.region_id LEFT JOIN users c ON c.id = x.created_by
        WHERE x.id != ?1 AND x.nid != 'owner' AND (?2 = 0 OR x.region_id = ?2) AND (?3 = 1 OR x.role != 'super') ORDER BY x.role = 'super' DESC, r.city, r.name, x.role DESC, x.name`, u.id, rid, isFull(u) ? 1 : 0);
    }
    if (p === '/api/super/cfg' && m === 'POST') {
      if (!isFull(u)) fail(403, 'این تنظیم فقط برای مدیر سامانه است.');
      const b = await body(), v = String(b.leadLabel || '').trim().slice(0, 40);
      await run("INSERT OR REPLACE INTO team_cfg (k, v) VALUES ('lead_label', ?)", v || LEAD_LABEL); return { ok: true, leadLabel: v || LEAD_LABEL };
    }
    if (p.startsWith('/api/super/regions') && !isFull(u)) fail(403, 'ساختن و تغییر منطقه فقط با مدیر سامانه است.');
    if (p === '/api/super/regions' && m === 'POST') {
      const b = await body(), name = String(b.name || '').trim().slice(0, 80), city = CITIES.includes(b.city) ? b.city : '';
      if (!city) fail(400, 'شهر را انتخاب کنید.');
      if (!name) fail(400, 'نام منطقه را بنویسید.');
      if (await one('SELECT 1 FROM regions WHERE name = ?', name)) fail(400, 'این منطقه قبلاً ساخته شده است.');
      return { id: (await one('INSERT INTO regions (name, city) VALUES (?, ?) RETURNING id', name, city)).id, name };
    }
    if ((mm = p.match(/^\/api\/super\/regions\/(\d+)$/)) && m === 'POST') {
      const b = await body(), name = String(b.name || '').trim().slice(0, 80);
      if (!name) fail(400, 'نام منطقه را بنویسید.');
      if (await one('SELECT 1 FROM regions WHERE name = ? AND id != ?', name, +mm[1])) fail(400, 'منطقه‌ای با همین نام هست.');
      const city = CITIES.includes(b.city) ? b.city : null;
      await run('UPDATE regions SET name = ?, city = COALESCE(?, city) WHERE id = ?', name, city, +mm[1]); return { ok: true };
    }
    if (p === '/api/super/users' && m === 'POST') {
      const b = await body(), nid = nidNormalize(b.nid), name = String(b.name || '').trim().slice(0, 80), lead = b.role === 'lead' ? 1 : 0, role = lead || b.role === 'super' ? 'super' : b.role === 'fm' ? 'fm' : 'region';
      if (role === 'super' && !isFull(u)) fail(403, 'فقط مدیر سامانه می‌تواند این نقش را بدهد.');
      if (!nidValid(nid)) fail(400, 'کد ملی معتبر نیست.');
      if (!name) fail(400, 'نام را بنویسید.');
      if (role !== 'super' && !await one('SELECT 1 FROM regions WHERE id = ?', +b.region_id)) fail(400, 'منطقه را انتخاب کنید.');
      if (await one('SELECT 1 FROM users WHERE nid = ?', nid)) fail(400, 'این کد ملی قبلاً ثبت شده است.');
      const h = await newPassword(b.password, role);
      await run('INSERT INTO users (region_id, role, lead, nid, name, salt, hash, must_change, created, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', role === 'super' ? null : +b.region_id, role, lead, nid, name, h.salt, h.hash, h.must, Date.now(), u.id);
      return { name, nid, password: h.pw, temporary: !!h.must };
    }
    if ((mm = p.match(/^\/api\/super\/users\/(\d+)\/(reset|active|passkeys|delete|edit)$/)) && m === 'POST') {
      const t = await one("SELECT * FROM users WHERE id = ? AND id != ? AND nid != 'owner'", +mm[1], u.id); if (!t) fail(404, 'پیدا نشد');
      if (t.role === 'super' && !isFull(u)) fail(403, 'حساب‌های هم‌سطح یا بالاتر را فقط مدیر سامانه تغییر می‌دهد.');
      const b = await body();
      if (mm[2] === 'reset') { const h = await newPassword(b.password, t.role); await DB.batch([prep('UPDATE users SET salt = ?, hash = ?, must_change = ? WHERE id = ?', h.salt, h.hash, h.must, t.id), endAll(t.id)]); return { name: t.name, nid: t.nid, password: h.pw, temporary: !!h.must }; }
      if (mm[2] === 'active') { await DB.batch([prep('UPDATE users SET active = ? WHERE id = ?', b.active ? 1 : 0, t.id), ...(b.active ? [] : [endAll(t.id)])]); return { ok: true }; }
      if (mm[2] === 'passkeys') { await run('DELETE FROM passkeys WHERE user_id = ?', t.id); return { ok: true }; }
      /* ویرایش: نام، کد ملی (= نام کاربری)، منطقه و نام شیت */
      if (mm[2] === 'edit') {
        const name = String(b.name || '').trim().slice(0, 80); if (!name) fail(400, 'نام را بنویسید.');
        const nid = b.nid !== undefined ? nidNormalize(b.nid) : t.nid;
        if (nid !== t.nid) {
          if (!nidValid(nid)) fail(400, 'کد ملی معتبر نیست.');
          if (await one('SELECT 1 FROM users WHERE nid = ? AND id != ?', nid, t.id)) fail(400, 'این کد ملی مال کاربر دیگری است.');
        }
        if (t.role === 'super') { await run('UPDATE users SET name = ?, nid = ? WHERE id = ?', name, nid, t.id); return { ok: true }; }
        const region = b.region_id ? +b.region_id : t.region_id; if (!await one('SELECT 1 FROM regions WHERE id = ?', region)) fail(400, 'منطقه نامعتبر');
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
    if (p === '/api/admin/form') {
      if (m === 'GET') return formOf(R);
      if (m === 'PUT') { const f = validForm(await body(512 * 1024)); await run('INSERT OR REPLACE INTO forms (region_id, json, updated) VALUES (?, ?, ?)', R, JSON.stringify(f), Date.now()); return f; }
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
      const users = await all("SELECT id, nid, name, sheet FROM users WHERE region_id = ? AND role IN ('fm', 'region')", R);
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
      const parsed = JSON.parse(pv.json), title = String(b.title || parsed.title || 'هفته').slice(0, 120), map = b.map || {}, now = Date.now(), created = [];
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
        prep(`INSERT INTO entries (week_id, row_no, hotel, home_mgr, cook, caravans, d_in, d_out, pilgrims, company, siyahe)
          SELECT ?, ${J}'$.row_no'), ${J}'$.hotel'), ${J}'$.home_mgr'), ${J}'$.cook'), ${J}'$.caravans'), ${J}'$.d_in'), ${J}'$.d_out'), ${J}'$.pilgrims'), ${J}'$.company'), ${J}'$.siyahe') FROM json_each(?) WHERE true
          ON CONFLICT (week_id, row_no) DO UPDATE SET hotel = excluded.hotel, home_mgr = excluded.home_mgr, cook = excluded.cook, caravans = excluded.caravans, d_in = excluded.d_in,
          d_out = excluded.d_out, pilgrims = excluded.pilgrims, company = excluded.company, siyahe = excluded.siyahe`, w.id, JSON.stringify(parsed.rows)),
        prep('DELETE FROM entries WHERE week_id = ? AND row_no NOT IN (SELECT value FROM json_each(?)) AND id NOT IN (SELECT entry_id FROM reports)', w.id, keep),
        prep('DELETE FROM assign WHERE entry_id IN (SELECT id FROM entries WHERE week_id = ?)', w.id),
        prep('DELETE FROM sheet_rows WHERE week_id = ?', w.id),
        prep(`INSERT OR IGNORE INTO sheet_rows (week_id, sheet, row_no) SELECT ?, ${J}'$.s'), ${J}'$.r') FROM json_each(?)`, w.id, JSON.stringify(parsed.sheets.flatMap(s => s.ids.map(r => ({ s: s.sheet, r })))))];
      for (const o of owners) {
        const x = known.get(o.nid);
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
      const fms = await all("SELECT id FROM users WHERE region_id = ? AND role IN ('fm', 'region') AND sheet IS NOT NULL", R);
      if (fms.length) await DB.batch(fms.flatMap(x => syncSheetStmts(x.id)));
      const assigned = (await one('SELECT COUNT(*) AS n FROM assign a JOIN entries e ON e.id = a.entry_id WHERE e.week_id = ?', w.id)).n;
      return { week: w.id, assigned, created, title };
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
      if (t.role === 'region' && (mm[2] !== 'edit' || (u.role !== 'super' && t.id !== u.id))) fail(403, 'حساب مدیر منطقه را فقط مدیر سامانه تغییر می‌دهد.');
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
      const region = await one('SELECT name FROM regions WHERE id = ?', R);
      return { rows, moves, roles: await staffRoles(R), hotels, suggest: [...names.values()], fms: fms.map(x => ({ name: x.name, nid: x.nid, hotels: [...new Set(String(x.hotels || '').split('|').map(normName).filter(Boolean))] })), geo, bale: !!tb, region: region.name, today: JD.str(JD.today()), maxDays: STAFF_MAX_DAYS };
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
      await run("UPDATE staff SET status = 'left', left_at = ?, updated = ?, by = ? WHERE id = ?", JD.str(d), Date.now(), u.id, s0.id);
      return { ok: true };
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
