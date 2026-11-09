/* ══════════════════════════════════════════
   GUARD — نگهبان سرور 188.121.118.223 (هر ۵ دقیقه با Cron)
   ۱. سلامت: سامانه نواقص هتل‌ها، چاپ و بسته‌بندی، بیمه — اگر ۳ بار پشت سر هم (۱۵ دقیقه) جواب ندهد، در بله به مدیر اصلی خبر می‌دهد؛ وصل شدن دوباره را هم خبر می‌دهد
   ۲. پشتیبان: نسخه ساعتی (data) و شبانه (full) را که سرور با /usr/local/bin/hamyar-backup می‌سازد تکه‌تکه (Range) برمی‌دارد،
      با sha256 بررسی می‌کند و در پایگاه D1 جداگانه hamyar-backups (BKDB) تکه‌تکه نگه می‌دارد: ساعتی ۳ روز، روزانه و کامل ۳۵ روز
   ۳. گزارش روزانه ساعت ۹ صبح تهران در بله
   اینترنت ایران به خارج گاهی وسط دانلود گیر می‌کند؛ برای همین تکه‌ها کوچک‌اند و هر تکه چند بار امتحان می‌شود.
   رازها: BACKUP_KEY (همان کلید nginx سرور). مدیر اصلی با فرستادن کد owner_code به بازوی بله ثبت می‌شود (config: owner_chat).
══════════════════════════════════════════ */
/* sslip.io نه nip.io: فیلترینگ ایران nip.io را از خارج قطع می‌کند (proxy.js را ببینید) */
import { HANDOVER, OWNER_STEPS } from './handover.js';
import { ERRLOG, logError } from './errlog.js';
import { ghToken } from './staff.js';
export { logError };
const SRV = 'https://188-121-118-223.sslip.io', SRV80 = 'http://188-121-118-223.sslip.io';
const CHECKS = [
  { k: 'team', name: 'سامانه نواقص هتل‌ها (روی Cloudflare)', url: 'https://hamyar-team.hamyar-karevan.workers.dev/api/me', ok: s => s === 401 || s === 200 },
  { k: 'chap', name: 'سامانه چاپ و بسته‌بندی', url: SRV80 + '/chap/login', ok: s => s >= 200 && s < 500 },
  { k: 'bime', name: 'سامانه بیمه', url: SRV80 + '/bime/', ok: s => s < 500 }
];
const FAILS_TO_ALERT = 3, CHUNK = 32 * 1024, H = 36e5, D = 864e5;
const TTL = { data: 3 * D, daily: 35 * D, full: 35 * D, team: 35 * D, memory: 400 * D };
const BK_SCHEMA = ['CREATE TABLE IF NOT EXISTS files (name TEXT PRIMARY KEY, kind TEXT, ts TEXT, bytes INTEGER, sha256 TEXT, n INTEGER, got INTEGER, exp INTEGER)',
  'CREATE TABLE IF NOT EXISTS chunks (name TEXT NOT NULL, i INTEGER NOT NULL, data BLOB, PRIMARY KEY (name, i))'];

const cfgGet = async (env, k) => { const r = await env.DB.prepare('SELECT v FROM config WHERE k = ?').bind(k).first(); return r ? r.v : null; };
const cfgSet = (env, k, v) => env.DB.prepare('INSERT INTO config (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, String(v)).run();
const cfgJson = async (env, k, d) => { try { return JSON.parse(await cfgGet(env, k)) || d; } catch (e) { return d; } };
const tehran = t => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(t);
const dur = ms => { const m = Math.round(ms / 6e4); return m < 60 ? m.toLocaleString('fa') + ' دقیقه' : (Math.round(m / 6) / 10).toLocaleString('fa') + ' ساعت'; };
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

/* ── خطاهای سرور (۵۰۰) در جدول errlog: hamyar-reviews در DB خودش، hamyar-team در hamyar-hotels (HDB) ──
   نشانی بدون پارامتر (توکن‌ها در پارامترند) و پیام کوتاه نگه داشته می‌شود؛ ۳۰ روز. */
async function recentErrors(env, since, limit = 20) {
  const out = [];
  for (const [db, name] of [[env.DB, 'hamyar-reviews'], [env.HDB, 'hamyar-team']]) {
    if (!db) continue;
    try { out.push(...(await db.prepare('SELECT ts, src, method, path, msg FROM errlog WHERE ts > ? ORDER BY ts DESC LIMIT ?').bind(since, limit).all()).results.map(r => ({ ...r, src: r.src || name }))); } catch (e) {}
  }
  return out.sort((a, b) => b.ts - a.ts).slice(0, limit);
}
const utc = t => new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const errText = list => list.map(r => `- ${utc(r.ts)} [${r.src}] ${r.method} ${r.path}\n  ${String(r.msg).split('\n').slice(0, 3).join('\n  ')}`).join('\n');

async function notify(env, text) {
  const chat = await cfgGet(env, 'owner_chat');
  if (!chat || !env.BALE_TOKEN) return false;
  const r = await fetch(`https://tapi.bale.ai/bot${env.BALE_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: +chat, text }) }).catch(() => null);
  return !!(r && r.ok);
}
async function timed(url, init = {}, ms = 20000) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...init, signal: ac.signal }); } finally { clearTimeout(t); }
}

/* ── ۱. سلامت ── */
async function checkAll(env, budget) {
  const now = Date.now(), out = [];
  for (const c of CHECKS) {
    let ok = false, status = 0, ms = 0;
    for (let i = 0; i < 2 && !ok && budget.n > 0; i++) {
      budget.n--;
      const t0 = Date.now();
      try { const r = await timed(c.url, { redirect: 'manual', headers: { 'User-Agent': 'hamyar-guard' } }, 15000); status = r.status; ok = c.ok(r.status); try { await r.body?.cancel(); } catch (e) {} }
      catch (e) { status = 0; }
      ms = Date.now() - t0;
    }
    const st = await cfgJson(env, 'mon:' + c.k, { up: true, fails: 0, since: now });
    if (ok) {
      if (!st.up) await notify(env, `🟢 ${c.name} دوباره وصل شد.\nمدت قطعی: حدود ${dur(now - st.since)}`);
      Object.assign(st, { up: true, fails: 0, last: now, ms, status, ...(st.up ? {} : { since: now }) });
    } else {
      st.fails = (st.fails || 0) + 1; st.status = status; st.lastFail = now;
      if (st.up && st.fails >= FAILS_TO_ALERT) {
        st.up = false; st.since = now - (FAILS_TO_ALERT - 1) * 5 * 6e4;
        await notify(env, `🔴 ${c.name} از حدود ${dur(now - st.since)} پیش جواب نمی‌دهد.\n\nاگر تا نیم ساعت دیگر خودش وصل نشد، Codespace را باز کنید و به Claude بگویید: «سامانه ${c.name} قطع است».\nاگر Claude در دسترس نبود: پنل مدیریت ← آمار ← «🆘 بسته نجات» ← «کپی گزارش برای کمک»، یا همین پیام را برای برنامه‌نویس یا هوش مصنوعی دیگر بفرستید.\n\n— برای برنامه‌نویس —\nسامانه: ${c.k} (${c.name})\nنشانی بررسی: ${c.url}\nپاسخ: ${status ? 'HTTP ' + status : 'وصل نشد / مهلت تمام شد'}\nزمان: ${utc(now)}\nپرونده فنی: worker/handover.js در مخزن mirahmadian/iraq-guide`);
      }
    }
    await cfgSet(env, 'mon:' + c.k, JSON.stringify(st));
    out.push({ k: c.k, name: c.name, ...st });
  }
  return out;
}

/* ── ۲. پشتیبان ── */
async function getRange(env, mode, from, to, budget) {
  for (let i = 0; i < 4 && budget.n > 0; i++) {
    budget.n--;
    try {
      const r = await timed(`${SRV}/_bk/${mode}.tar.gz`, { headers: { 'X-Backup-Key': env.BACKUP_KEY, Range: `bytes=${from}-${to}`, 'User-Agent': 'hamyar-guard' } }, 10000);
      if (r.status !== 206) { try { await r.body?.cancel(); } catch (e) {} continue; }
      const b = await r.arrayBuffer();
      if (b.byteLength === to - from + 1) return b;
    } catch (e) {}
  }
  return null;
}
async function readChunks(env, name, bytes) {
  const { results } = await env.BKDB.prepare('SELECT data FROM chunks WHERE name = ? ORDER BY i').bind(name).all();
  const all = new Uint8Array(bytes); let o = 0;
  for (const r of results) { const u = new Uint8Array(r.data); if (o + u.length > bytes) return null; all.set(u, o); o += u.length; }
  return o === bytes ? all : null;
}
async function cleanup(env) {
  const old = (await env.BKDB.prepare('SELECT name FROM files WHERE exp < ?').bind(Date.now()).all()).results;
  for (const f of old) await env.BKDB.batch([env.BKDB.prepare('DELETE FROM chunks WHERE name = ?').bind(f.name), env.BKDB.prepare('DELETE FROM files WHERE name = ?').bind(f.name)]);
}
/* یک نسخه را (در صورت لزوم در چند نوبت) برمی‌دارد؛ تکه‌ها در KV موقت نگه داشته می‌شوند */
async function pull(env, mode, budget, force) {
  const last = await cfgJson(env, 'bk:' + mode, {});
  const job = await cfgJson(env, 'bkjob:' + mode, null);
  let meta = job;
  if (!meta) {
    if (!force && last.at && Date.now() - last.at < (mode === 'data' ? 50 * 6e4 : 20 * H)) return { mode, skip: true };
    if (budget.n <= 0) return { mode, wait: true };
    budget.n--;
    try {
      const r = await timed(`${SRV}/_bk/${mode}.json?t=${Date.now()}`, { headers: { 'X-Backup-Key': env.BACKUP_KEY, 'User-Agent': 'hamyar-guard' } }, 15000);
      if (!r.ok) return { mode, error: 'meta ' + r.status };
      meta = await r.json();
    } catch (e) { return { mode, error: 'meta network' }; }
    if (meta.ts === last.ts) { await cfgSet(env, 'bk:' + mode, JSON.stringify({ ...last, at: Date.now(), same: true })); return { mode, same: true }; }
    meta = { ts: meta.ts, bytes: meta.bytes, sha256: meta.sha256, next: 0, n: 0, started: Date.now() };
    await env.BKDB.prepare('DELETE FROM chunks WHERE name LIKE ?').bind(`tmp/${mode}/%`).run();
  }
  while (meta.next < meta.bytes && budget.n > 0) {
    const to = Math.min(meta.bytes, meta.next + CHUNK) - 1, b = await getRange(env, mode, meta.next, to, budget);
    if (!b) break;
    await env.BKDB.prepare('INSERT OR REPLACE INTO chunks (name, i, data) VALUES (?, ?, ?)').bind(`tmp/${mode}/${meta.ts}`, meta.n, b).run();
    meta.n++; meta.next = to + 1;
  }
  if (meta.next < meta.bytes) {
    /* اگر نسخه نیمه‌کاره خیلی کهنه شد (سرور نسخه تازه‌تر ساخت)، از نو */
    if (Date.now() - meta.started > (mode === 'data' ? 2 * H : 20 * H)) { await env.DB.prepare('DELETE FROM config WHERE k = ?').bind('bkjob:' + mode).run(); return { mode, error: 'gave up', got: meta.next }; }
    await cfgSet(env, 'bkjob:' + mode, JSON.stringify(meta));
    return { mode, partial: meta.next, of: meta.bytes };
  }
  const tmp = `tmp/${mode}/${meta.ts}`, all = await readChunks(env, tmp, meta.bytes);
  await env.DB.prepare('DELETE FROM config WHERE k = ?').bind('bkjob:' + mode).run();
  if (!all || hex(await crypto.subtle.digest('SHA-256', all)) !== meta.sha256) { await env.BKDB.prepare('DELETE FROM chunks WHERE name = ?').bind(tmp).run(); return { mode, error: 'checksum' }; }
  const now = Date.now(), day = meta.ts.slice(0, 8), name = `${mode}/${meta.ts}`;
  const file = (nm, kind) => env.BKDB.prepare('INSERT OR REPLACE INTO files (name, kind, ts, bytes, sha256, n, got, exp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(nm, kind, meta.ts, meta.bytes, meta.sha256, meta.n, now, now + TTL[kind]);
  const ops = [env.BKDB.prepare('UPDATE chunks SET name = ? WHERE name = ?').bind(name, tmp), file(name, mode)];
  if (mode === 'data' && last.day !== day) ops.push(env.BKDB.prepare('INSERT INTO chunks (name, i, data) SELECT ?, i, data FROM chunks WHERE name = ?').bind(`daily/${meta.ts}`, tmp), file(`daily/${meta.ts}`, 'daily'));
  /* ترتیب: اول کپی روزانه (از tmp)، بعد تغییر نام */
  if (ops.length > 2) await env.BKDB.batch([ops[2], ops[3], ops[0], ops[1]]); else await env.BKDB.batch(ops);
  await cfgSet(env, 'bk:' + mode, JSON.stringify({ ts: meta.ts, at: Date.now(), bytes: meta.bytes, day }));
  return { mode, ok: true, bytes: meta.bytes };
}

/* ── ۳. گزارش روزانه و هشدار پشتیبان ── */
/* پشتیبان روزانه سامانه نواقص هتل‌ها (D1 hamyar-hotels، binding HDB): همه‌ی جدول‌ها به JSON فشرده، در BKDB با نام team/<ts>.
   عکس و فیلم‌ها (۷ روزه) جزو آن نیستند. برگرداندن: worker/team-api/restore.mjs */
const TEAM_TABLES = ['regions', 'users', 'sessions', 'passkeys', 'weeks', 'entries', 'assign', 'sheet_rows', 'forms', 'reports', 'items', 'notes', 'media'];
async function teamBackup(env, force) {
  if (!env.HDB) return { mode: 'team', error: 'HDB not bound' };
  const now = Date.now(), day = new Date(now + 3.5 * H).toISOString().slice(0, 10), last = await cfgJson(env, 'bk:team', {});
  if (!force && last.day === day) return { mode: 'team', skip: true };
  const res = await env.HDB.batch(TEAM_TABLES.map(t => env.HDB.prepare('SELECT * FROM ' + t)));
  const ts = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const body = JSON.stringify({ kind: 'hamyar-hotels', ts, tables: Object.fromEntries(TEAM_TABLES.map((t, i) => [t, res[i].results])) });
  const gz = new Uint8Array(await new Response(new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const sha = hex(await crypto.subtle.digest('SHA-256', gz)), name = 'team/' + ts, P = 512 * 1024, n = Math.ceil(gz.length / P);
  await env.BKDB.batch([...Array(n).keys()].map(i => env.BKDB.prepare('INSERT OR REPLACE INTO chunks (name, i, data) VALUES (?, ?, ?)').bind(name, i, gz.subarray(i * P, (i + 1) * P)))
    .concat(env.BKDB.prepare('INSERT OR REPLACE INTO files (name, kind, ts, bytes, sha256, n, got, exp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(name, 'team', ts, gz.length, sha, n, now, now + TTL.team)));
  await cfgSet(env, 'bk:team', JSON.stringify({ day, at: now, bytes: gz.length, rows: res.reduce((a, r) => a + r.results.length, 0) }));
  return { mode: 'team', ts, bytes: gz.length };
}

/* بکاپ کاملی که مدیر خودش دانلود کرده (پنل ← آمار ← 📦)؛ بعد از ۷ روز یادآوری */
async function localBk(env, now) {
  const t = +(await cfgGet(env, 'bk:local')) || 0, days = t ? Math.floor((now - t) / D) : null;
  return `\n📦 آخرین بکاپ کامل نزد خودتان: ${t ? (days ? days.toLocaleString('fa') + ' روز پیش' : 'امروز') : 'هنوز گرفته نشده'}${!t || days >= 7 ? '\n   ← یادآوری: از پنل، تب آمار، «📦 دانلود بکاپ کامل» را بزنید.' : ''}`;
}
async function daily(env, checks) {
  const now = Date.now(), today = new Date(now + 3.5 * H).toISOString().slice(0, 10), hr = new Date(now + 3.5 * H).getUTCHours();
  const bd = await cfgJson(env, 'bk:data', {}), bf = await cfgJson(env, 'bk:full', {}), bt = await cfgJson(env, 'bk:team', {}), cs = await cfgJson(env, 'cs:last', {});
  const stale = !bd.at || now - bd.at > 3 * H;
  const warned = await cfgGet(env, 'bk:warned');
  if (stale && !warned) { await notify(env, `⚠️ بیش از ۳ ساعت است که نسخه پشتیبان تازه از سرور گرفته نشده (آخرین: ${bd.at ? tehran(bd.at) : 'هیچ‌وقت'}).\nسامانه‌ها ممکن است سالم باشند؛ فقط پشتیبان‌گیری گیر کرده. اگر فردا هم این پیام آمد، به Claude بگویید.`); await cfgSet(env, 'bk:warned', '1'); }
  if (!stale && warned) await env.DB.prepare("DELETE FROM config WHERE k = 'bk:warned'").run();
  /* پشتیبان روزانه سامانه نواقص هتل‌ها بیش از ۳۰ ساعت عقب افتاده */
  const tStale = bt.at && now - bt.at > 30 * H, tWarned = await cfgGet(env, 'bk:team-warned');
  if (tStale && !tWarned) { await notify(env, `⚠️ پشتیبان روزانه سامانه نواقص هتل‌ها از ${tehran(bt.at)} گرفته نشده. سامانه احتمالاً سالم است؛ به Claude بگویید.`); await cfgSet(env, 'bk:team-warned', '1'); }
  if (!tStale && tWarned) await env.DB.prepare("DELETE FROM config WHERE k = 'bk:team-warned'").run();
  if (hr === 9 && (await cfgGet(env, 'daily:sent')) !== today) {
    const down = checks.filter(c => !c.up);
    await notify(env, `☀️ گزارش روزانه سرور\n\n${checks.map(c => `${c.up ? '✅' : '🔴'} ${c.name}`).join('\n')}\n\n💾 آخرین پشتیبان ساعتی: ${bd.at ? tehran(bd.at) : '—'}\n💾 آخرین پشتیبان کامل: ${bf.at ? tehran(bf.at) : '—'}\n🏨 آخرین پشتیبان سامانه نواقص هتل‌ها: ${bt.at ? tehran(bt.at) : '—'}\n💻 آخرین استفاده از Codespace: ${cs.at ? Math.floor((now - cs.at) / D).toLocaleString('fa') + ' روز پیش' : '—'}${await localBk(env, now)}\n\n${down.length ? 'یک یا چند سامانه قطع است؛ به Claude بگویید.' : 'همه چیز مرتب است. 🌷'}`);
    await cfgSet(env, 'daily:sent', today);
  }
}

/* اگر از آخرین هشدار دست‌کم ۳ خطای تازه‌ی سرور ثبت شده باشد (و ۳ ساعت از هشدار قبلی گذشته باشد)، به مدیر خبر بده */
async function errorAlert(env) {
  const now = Date.now(), seen = +(await cfgGet(env, 'err:seen')) || now - H, lastAlert = +(await cfgGet(env, 'err:alert')) || 0;
  const list = await recentErrors(env, seen, 10);
  if (list.length < 3 || now - lastAlert < 3 * H) return;
  await notify(env, `⚠️ در سامانه‌ها ${list.length.toLocaleString('fa')} خطای فنی تازه ثبت شده است. ممکن است کاربران پیام «خطای سرور» دیده باشند.\nبه Claude بگویید؛ اگر در دسترس نبود، این پیام را عیناً برای برنامه‌نویس یا هوش مصنوعی دیگر بفرستید.\n\n— برای برنامه‌نویس —\n${errText(list.slice(0, 4))}\nپرونده فنی: worker/handover.js در مخزن mirahmadian/iraq-guide`);
  await cfgSet(env, 'err:alert', now); await cfgSet(env, 'err:seen', now);
}

/* گزارش کامل برای کمک گرفتن (برنامه‌نویس یا هوش مصنوعی دیگر): وضعیت زنده + خطاهای اخیر + پرونده‌ی فنی */
async function report(env) {
  const now = Date.now(), checks = [];
  for (const c of CHECKS) checks.push({ ...c, ...(await cfgJson(env, 'mon:' + c.k, {})) });
  const bd = await cfgJson(env, 'bk:data', {}), bf = await cfgJson(env, 'bk:full', {}), bt = await cfgJson(env, 'bk:team', {});
  const errs = await recentErrors(env, now - 7 * D, 25);
  return `# گزارش وضعیت سامانه‌های همیار کاروان
زمان گزارش: ${tehran(now)} (${utc(now)})

## وضعیت زنده (نگهبان هر ۵ دقیقه بررسی می‌کند)
${checks.map(c => `- ${c.up === false ? '🔴 قطع' : '🟢 سالم'} — ${c.name} — ${c.url} — آخرین پاسخ: ${c.status ? 'HTTP ' + c.status : '—'}${c.up === false ? ` — قطع از ${utc(c.since)}` : c.last ? ` — آخرین بررسی ${utc(c.last)}` : ''}`).join('\n')}

## پشتیبان‌ها
- سرور، ساعتی (در Cloudflare): ${bd.at ? utc(bd.at) : 'هنوز نه / گیر کرده'}
- سرور، کامل شبانه (در Cloudflare): ${bf.at ? utc(bf.at) : 'هنوز نه / گیر کرده'}
- سامانه نواقص هتل‌ها، روزانه: ${bt.at ? utc(bt.at) : 'هنوز نه'}

## خطاهای سرور در ۷ روز گذشته (${errs.length})
${errs.length ? errText(errs) : 'خطایی ثبت نشده.'}

---
${HANDOVER}`;
}

/* ── یادآوری Codespace: GitHub یک Codespace را بعد از ۳۰ روز خاموش ماندن پاک می‌کند (با حافظه و کلیدهای Claude) ──
   روزی یک بار آخرین زمان استفاده از سه جا خوانده می‌شود: فهرست Codespaceها، گزارش مصرف GitHub (هر دو با کلید GitHub مدیر که پنل رمزگذاری‌شده نگه داشته)،
   و «cs:seen» که Codespace خودش هر چند ساعت می‌فرستد (worker/claude-memory.mjs). روز ۲۵، ۲۸ و ۲۹ در بله یادآوری می‌شود. */
async function csCheck(env, force) {
  const now = Date.now(), day = new Date(now + 3.5 * H).toISOString().slice(0, 10);
  if (!force && (await cfgGet(env, 'cs:checked')) === day) return;
  await cfgSet(env, 'cs:checked', day);
  let last = +(await cfgGet(env, 'cs:seen')) || 0, src = last ? 'codespace' : '';
  try {
    const tok = await ghToken(env), H2 = { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'User-Agent': 'hamyar-guard' };
    const r = await fetch('https://api.github.com/user/codespaces', { headers: H2 });
    if (r.ok) for (const c of (await r.json()).codespaces || []) { const t = Date.parse(c.last_used_at || ''); if (t > last) { last = t; src = 'github'; } }
    const me = await (await fetch('https://api.github.com/user', { headers: H2 })).json();
    const u = await fetch(`https://api.github.com/users/${me.login}/settings/billing/usage`, { headers: H2 });
    if (u.ok) for (const i of (await u.json()).usageItems || []) if (/codespaces_compute/.test(i.sku || '') && +i.quantity > 0) { const t = Date.parse(i.date) + D - 1; if (t > last && t <= now) { last = t; src = 'billing'; } }
  } catch (e) {}
  if (!last) return;
  await cfgSet(env, 'cs:last', JSON.stringify({ at: last, src }));
  const days = Math.floor((now - last) / D), R = await cfgJson(env, 'cs:remind', {});
  if (R.last !== last) { R.last = last; R.steps = []; }
  const step = [29, 28, 25].find(x => days >= x && !R.steps.includes(x));
  if (step) {
    const left = Math.max(1, 30 - days);
    await notify(env, `💻 یادآوری Codespace\n\n${days.toLocaleString('fa')} روز است که Codespace (محیط کار Claude) روشن نشده است. GitHub آن را بعد از ۳۰ روز خاموش ماندن خودکار پاک می‌کند و حافظه و تنظیمات Claude از بین می‌رود — حدود ${left.toLocaleString('fa')} روز دیگر.\n\nلطفاً همین امروز:\n۱. github.com/codespaces را باز کنید\n۲. روی Codespace «iraq-guide» بزنید تا روشن شود (چند دقیقه صبر کنید)\n۳. بعد از پنل مدیریت ← «⏻ خاموشی Codespace» دوباره خاموشش کنید.\n\nهمین چند دقیقه روشن شدن کافی است و ۳۰ روز از نو شروع می‌شود.`);
    R.steps.push(...[25, 28, 29].filter(x => x <= step));
  }
  await cfgSet(env, 'cs:remind', JSON.stringify(R));
}

export async function guardRun(env, force) {
  if (!env.BKDB) return { error: 'BKDB not bound' };
  for (const q of BK_SCHEMA) await env.BKDB.prepare(q).run();
  const budget = { n: 44 };   /* سقف درخواست‌های هر اجرا در پلن رایگان: ۵۰ */
  const checks = await checkAll(env, budget);
  const res = [];
  try { res.push(await teamBackup(env, force)); } catch (e) { res.push({ mode: 'team', error: String(e && e.message || e) }); }
  if (env.BACKUP_KEY && checks.find(c => c.k === 'chap').up) {
    res.push(await pull(env, 'data', budget, force));
    res.push(await pull(env, 'full', budget, force));
  }
  if (new Date().getUTCMinutes() % 15 < 5) await errorAlert(env);   /* هر ربع ساعت */
  try { await csCheck(env, false); } catch (e) {}
  await daily(env, checks);
  if (new Date().getUTCMinutes() < 5) { await cleanup(env); for (const db of [env.DB, env.HDB]) if (db) try { await db.prepare(ERRLOG).run(); await db.prepare('DELETE FROM errlog WHERE ts < ?').bind(Date.now() - 30 * D).run(); } catch (e) {} }
  return { checks, backups: res, budgetLeft: budget.n };
}

/* ثبت مدیر اصلی در بازوی بله با کد یک‌بارمصرف */
export async function guardBaleHook(env, chat, text) {
  const code = await cfgGet(env, 'owner_code');
  if (!code || String(text || '').trim() !== code) return false;
  await cfgSet(env, 'owner_chat', chat);
  await env.DB.prepare("DELETE FROM config WHERE k = 'owner_code'").run();
  await notify(env, '✅ ثبت شد. از این به بعد اگر یکی از سامانه‌های سرور قطع شود یا پشتیبان‌گیری گیر کند، همین‌جا خبر می‌دهم؛ هر روز ساعت ۹ صبح هم یک گزارش کوتاه می‌فرستم.');
  return true;
}

/* ── پنل (فقط مدیر اصلی) ── */
export async function handleGuardAdmin(p, req, env, url, json, err) {
  if (p === '/admin/guard' && req.method === 'GET') {
    const checks = [];
    for (const c of CHECKS) checks.push({ k: c.k, name: c.name, ...(await cfgJson(env, 'mon:' + c.k, {})) });
    for (const q of BK_SCHEMA) await env.BKDB.prepare(q).run();
    const list = (await env.BKDB.prepare('SELECT name AS k, kind, ts, bytes, sha256, got FROM files ORDER BY ts DESC, kind LIMIT 300').all()).results;
    return json({ checks, backups: list, steps: OWNER_STEPS, cs: await cfgJson(env, 'cs:last', null), errors: (await recentErrors(env, Date.now() - 7 * D, 50)).length, alerts: !!(await cfgGet(env, 'owner_chat')), job: { data: await cfgJson(env, 'bkjob:data', null), full: await cfgJson(env, 'bkjob:full', null) } });
  }
  /* ☁️ حجم پایگاه‌های داده در Cloudflare (meta.size_after هر پرس‌وجو = حجم فعلی پایگاه) */
  if (p === '/admin/guard/cf' && req.method === 'GET') {
    const L = [['DB', 'hamyar-reviews', 'نظرات زائران، کاربران پنل، تنظیمات'], ['HDB', 'hamyar-hotels', 'سامانه نواقص هتل‌ها (team)'], ['MDB', 'hamyar-hotels-media', 'عکس و فیلم‌های سامانه نواقص'], ['BKDB', 'hamyar-backups', 'پشتیبان‌ها (سرور ۱۸۸، نواقص، حافظه Claude)']];
    const dbs = [];
    for (const [b, name, what] of L) {
      if (!env[b]) continue;
      try { const r = await env[b].prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite%' AND name NOT LIKE '_cf%'").all();
        dbs.push({ name, what, bytes: r.meta.size_after || 0, tables: r.results[0].n }); } catch (e) { dbs.push({ name, what, error: String(e.message || e).slice(0, 120) }); }
    }
    return json({ dbs, limits: { db: 500 * 1048576, total: 5 * 1073741824 } });
  }
  if (p === '/admin/guard/get' && req.method === 'GET') {
    const k = url.searchParams.get('k') || '';
    if (!/^(data|daily|full|team|memory)\/\d{8}T\d{6}Z$/.test(k)) return err('نام فایل نامعتبر');
    const f = await env.BKDB.prepare('SELECT bytes FROM files WHERE name = ?').bind(k).first();
    const v = f && await readChunks(env, k, f.bytes);
    if (!v) return err('این نسخه پیدا نشد (شاید منقضی شده).', 404);
    return new Response(v, { headers: { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="hamyar-${k.replace('/', '-')}${/^(team|memory)\//.test(k) ? '.json.gz' : '.tar.gz'}"`,
      'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Disposition' } });
  }
  if (p === '/admin/guard/report' && req.method === 'GET') return new Response(await report(env), { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } });
  if (p === '/admin/guard/run' && req.method === 'POST') { try { await csCheck(env, true); } catch (e) {} return json(await guardRun(env, true)); }
  if (p === '/admin/guard/test' && req.method === 'POST') return json({ sent: await notify(env, '🔔 پیام آزمایشی نگهبان سرور همیار — اگر این را می‌بینید، هشدارها درست به شما می‌رسد.') });
  return null;
}
