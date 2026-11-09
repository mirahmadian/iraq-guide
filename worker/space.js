/* ══════════════════════════════════════════
   💾 نگهبان فضا — هر روز یک بار (از guardRun، بعد از ساعت ۳ بامداد تهران):
   ۱. پاک‌سازی داده‌های موقت و کهنه با قاعده‌ی مشخص (هرگز نظرات، مدیران دستی، شرکت‌ها، کاربران، گزارش‌ها و آمار)
   ۲. اندازه‌گیری حجم چهار پایگاه و نگه‌داشتن تاریخچه (config space:hist)
   ۳. هشدار بله: ۶۰٪ و ۸۰٪ سقف هر پایگاه، و رشد غیرعادی بیش از ۲۰ مگ در یک روز
══════════════════════════════════════════ */
import { JD } from './jdate.js';

export const SPACE_DBS = [['DB', 'hamyar-reviews', 'اصلی'], ['HDB', 'hamyar-hotels', 'نواقص هتل‌ها'], ['MDB', 'hamyar-hotels-media', 'عکس و فیلم نواقص'], ['BKDB', 'hamyar-backups', 'پشتیبان‌ها']];
export const DB_LIMIT = 500 * 1048576;
const D = 864e5, JUMP = 20 * 1048576, KEEP_DAYS = 400;
const cfgGet = async (env, k) => { const r = await env.DB.prepare('SELECT v FROM config WHERE k = ?').bind(k).first(); return r ? r.v : null; };
const cfgSet = (env, k, v) => env.DB.prepare('INSERT INTO config (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, String(v)).run();
const cfgJson = async (env, k, d) => { try { return JSON.parse(await cfgGet(env, k)) || d; } catch (e) { return d; } };
const fa = n => Number(n).toLocaleString('fa');
const mb = b => (b / 1048576).toFixed(b < 10 * 1048576 ? 1 : 0).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]) + ' مگ';

/* قاعده‌های پاک‌سازی: [برچسب برای گزارش، SQL، پارامترها] — هر کدام جدا اجرا می‌شود تا نبودِ یک جدول بقیه را متوقف نکند */
function rules() {
  const now = Date.now(), sec = Math.floor(now / 1000), oldTrip = JD.str(JD.now() - 365);
  return [
    ['سوابق محدودیت تلاش (ضد حمله)', 'DELETE FROM hits WHERE exp < ?', [sec - 86400]],
    ['لینک‌های منقضی ورود زائران به بله', 'DELETE FROM bale_links WHERE exp < ?', [now]],
    ['درخواست‌های نیمه‌کاره‌ی عضویت بله', 'DELETE FROM bale_pending WHERE t < ?', [now - 2 * D]],
    ['لینک‌ها و کدهای منقضی ورود مدیران', 'DELETE FROM mgr_links WHERE exp < ?', [now]],
    ['درخواست‌های نیمه‌کاره‌ی ورود مدیران', 'DELETE FROM mgr_pending WHERE t < ?', [now - D]],
    ['ورودهای منقضی همکاران پنل', 'DELETE FROM sessions WHERE exp < ?', [now]],
    ['پیش‌نویس‌های نیمه‌کاره‌ی ربات شرکت‌ها (۲ روز)', "DELETE FROM co_reqs WHERE state = 'draft' AND updated < ?", [now - 2 * D]],
    ['درخواست‌های بررسی‌شده‌ی ربات شرکت‌ها (۱ سال)', "DELETE FROM co_reqs WHERE state IN ('ok', 'no', 'blocked', 'replaced') AND COALESCE(decided, updated) < ?", [now - 365 * D]],
    ['سفرهای عتبات قدیمی‌تر از ۱ سال', 'DELETE FROM mgr_trips WHERE entry < ?', [oldTrip]],
    ['مدیران «عتبات» با ۶ ماه پایان دسترسی', "DELETE FROM mgr_people WHERE src = 'atabat' AND until IS NOT NULL AND until < ?", [now - 182 * D]],
    ['گوشی‌های مدیرانِ حذف‌شده', 'DELETE FROM mgr_devices WHERE phone NOT IN (SELECT phone FROM mgr_people)', []]
  ];
}
export async function spaceCleanup(env) {
  const removed = [];
  for (const [label, sql, args] of rules()) {
    try { const r = await env.DB.prepare(sql).bind(...args).run(); const n = (r.meta && r.meta.changes) || 0; if (n) removed.push({ label, n }); } catch (e) {}
  }
  return removed;
}
export async function spaceMeasure(env) {
  const s = {};
  for (const [b, name] of SPACE_DBS) {
    if (!env[b]) continue;
    try { const r = await env[b].prepare('SELECT 1').run(); s[name] = (r.meta && r.meta.size_after) || 0; } catch (e) {}
  }
  return s;
}
const tehranDay = () => new Date(Date.now() + 3.5 * 36e5).toISOString().slice(0, 10);
const tehranHour = () => new Date(Date.now() + 3.5 * 36e5).getUTCHours();

/* هر ۵ دقیقه صدا زده می‌شود؛ فقط روزی یک بار (از ساعت ۳ بامداد تهران) کار می‌کند */
export async function spaceTick(env, notify, force) {
  const day = tehranDay();
  if (!force && (tehranHour() < 3 || (await cfgGet(env, 'space:day')) === day)) return null;
  await cfgSet(env, 'space:day', day);
  const removed = await spaceCleanup(env), size = await spaceMeasure(env);
  const hist = (await cfgJson(env, 'space:hist', [])).filter(h => h.d !== day);
  const prev = hist[hist.length - 1];
  hist.push({ d: day, s: size });
  await cfgSet(env, 'space:hist', JSON.stringify(hist.slice(-KEEP_DAYS)));
  await cfgSet(env, 'space:last', JSON.stringify({ at: Date.now(), removed }));
  /* هشدارها: هر سطح فقط یک بار (تا وقتی که دوباره پایین‌تر برود) */
  const warn = await cfgJson(env, 'space:warn', {}), msgs = [];
  for (const [, name, what] of SPACE_DBS) {
    const b = size[name]; if (b == null) continue;
    const pct = b / DB_LIMIT * 100, lvl = pct >= 80 ? 2 : pct >= 60 ? 1 : 0;
    if (lvl > (warn[name] || 0)) msgs.push(`${lvl === 2 ? '🔴' : '🟡'} پایگاه «${what}» (${name}) ${fa(Math.round(pct))}٪ پر شده (${mb(b)} از ۵۰۰ مگ).`);
    warn[name] = lvl;
    const gap = prev ? Math.max(1, Math.round((Date.parse(day) - Date.parse(prev.d)) / D)) : 0;
    if (prev && prev.s[name] != null && (b - prev.s[name]) / gap > JUMP) msgs.push(`⚠️ پایگاه «${what}» ${gap > 1 ? `در ${fa(gap)} روز` : 'در یک روز'} ${mb(b - prev.s[name])} بزرگ‌تر شده است؛ این رشد غیرعادی است.`);
  }
  await cfgSet(env, 'space:warn', JSON.stringify(warn));
  if (msgs.length && notify) await notify(env, `💾 نگهبان فضای پایگاه داده\n\n${msgs.join('\n')}\n\nفعلاً چیزی از کار نیفتاده؛ به Claude بگویید تا بررسی کند چه چیزی فضا را پر می‌کند.`);
  return { day, size, removed };
}

/* رشد روزانه‌ی میانگین ۳۰ روز اخیر و روزهای مانده تا پر شدن پرمصرف‌ترین پایگاه */
export function spaceForecast(hist) {
  if (!hist.length) return null;
  const last = hist[hist.length - 1];
  let base = hist.find(h => (Date.parse(last.d) - Date.parse(h.d)) / D <= 30) || hist[0];
  if (base === last && hist.length > 1) base = hist[hist.length - 2];
  const days = Math.max(1, (Date.parse(last.d) - Date.parse(base.d)) / D);
  let worst = null;
  for (const [, name, what] of SPACE_DBS) {
    const b = last.s[name]; if (b == null) continue;
    const grow = base !== last && base.s[name] != null ? Math.max(0, (b - base.s[name]) / days) : 0, pct = b / DB_LIMIT * 100;
    const left = grow > 0 ? (DB_LIMIT - b) / grow : Infinity;
    if (!worst || pct > worst.pct || left < worst.left) worst = { name, what, pct, bytes: b, grow, left };
  }
  return { worst, sample: base === last ? 0 : days };
}
/* یک خط برای گزارش صبح بله */
export async function spaceLine(env) {
  const f = spaceForecast(await cfgJson(env, 'space:hist', []));
  if (!f || !f.worst) return '';
  const w = f.worst, yrs = w.left / 365;
  const proj = !f.sample ? 'روند رشد از چند روز دیگر محاسبه می‌شود' : w.left === Infinity ? 'رشدی ندارد' : yrs >= 10 ? 'با روند فعلی بیش از ۱۰ سال جا داریم' : yrs >= 1 ? `با روند فعلی حدود ${fa(Math.floor(yrs))} سال دیگر پر می‌شود` : w.left >= 60 ? `⚠️ با روند فعلی حدود ${fa(Math.round(w.left / 30))} ماه دیگر پر می‌شود` : `🔴 با روند فعلی حدود ${fa(Math.ceil(w.left))} روز دیگر پر می‌شود`;
  return `\n💾 فضا: پرترین پایگاه ${w.pct < 1 ? 'کمتر از ۱' : fa(Math.round(w.pct))}٪ — ${proj}`;
}
/* برای کارت پنل */
export async function spaceInfo(env) {
  const hist = await cfgJson(env, 'space:hist', []), last = await cfgJson(env, 'space:last', null);
  const tables = [];
  try {
    const names = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite%' AND name NOT LIKE '_cf%'").all()).results.map(r => r.name);
    const res = await env.DB.batch(names.map(n => env.DB.prepare(`SELECT COUNT(*) AS n FROM "${n.replace(/"/g, '""')}"`)));
    names.forEach((n, i) => tables.push({ t: n, n: res[i].results[0].n }));
  } catch (e) {}
  return { hist: hist.slice(-90), last, forecast: spaceForecast(hist), tables: tables.sort((a, b) => b.n - a.n).slice(0, 8) };
}
