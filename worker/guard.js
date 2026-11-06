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
const SRV = 'https://188-121-118-223.sslip.io', SRV80 = 'http://188-121-118-223.sslip.io';
const CHECKS = [
  { k: 'team', name: 'سامانه نواقص هتل‌ها (مدیران ثابت و منطقه)', url: SRV + '/api/me', ok: s => s === 401 || s === 200 },
  { k: 'chap', name: 'سامانه چاپ و بسته‌بندی', url: SRV80 + '/chap/login', ok: s => s >= 200 && s < 500 },
  { k: 'bime', name: 'سامانه بیمه', url: SRV80 + '/bime/', ok: s => s < 500 }
];
const FAILS_TO_ALERT = 3, CHUNK = 32 * 1024, H = 36e5, D = 864e5;
const TTL = { data: 3 * D, daily: 35 * D, full: 35 * D };
const BK_SCHEMA = ['CREATE TABLE IF NOT EXISTS files (name TEXT PRIMARY KEY, kind TEXT, ts TEXT, bytes INTEGER, sha256 TEXT, n INTEGER, got INTEGER, exp INTEGER)',
  'CREATE TABLE IF NOT EXISTS chunks (name TEXT NOT NULL, i INTEGER NOT NULL, data BLOB, PRIMARY KEY (name, i))'];

const cfgGet = async (env, k) => { const r = await env.DB.prepare('SELECT v FROM config WHERE k = ?').bind(k).first(); return r ? r.v : null; };
const cfgSet = (env, k, v) => env.DB.prepare('INSERT INTO config (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, String(v)).run();
const cfgJson = async (env, k, d) => { try { return JSON.parse(await cfgGet(env, k)) || d; } catch (e) { return d; } };
const tehran = t => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(t);
const dur = ms => { const m = Math.round(ms / 6e4); return m < 60 ? m.toLocaleString('fa') + ' دقیقه' : (Math.round(m / 6) / 10).toLocaleString('fa') + ' ساعت'; };
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

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
        await notify(env, `🔴 ${c.name} از حدود ${dur(now - st.since)} پیش جواب نمی‌دهد.\n\nاگر تا نیم ساعت دیگر خودش وصل نشد، Codespace را باز کنید و به Claude بگویید: «سامانه ${c.name} قطع است».`);
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
async function daily(env, checks) {
  const now = Date.now(), today = new Date(now + 3.5 * H).toISOString().slice(0, 10), hr = new Date(now + 3.5 * H).getUTCHours();
  const bd = await cfgJson(env, 'bk:data', {}), bf = await cfgJson(env, 'bk:full', {});
  const stale = !bd.at || now - bd.at > 3 * H;
  const warned = await cfgGet(env, 'bk:warned');
  if (stale && !warned) { await notify(env, `⚠️ بیش از ۳ ساعت است که نسخه پشتیبان تازه از سرور گرفته نشده (آخرین: ${bd.at ? tehran(bd.at) : 'هیچ‌وقت'}).\nسامانه‌ها ممکن است سالم باشند؛ فقط پشتیبان‌گیری گیر کرده. اگر فردا هم این پیام آمد، به Claude بگویید.`); await cfgSet(env, 'bk:warned', '1'); }
  if (!stale && warned) await env.DB.prepare("DELETE FROM config WHERE k = 'bk:warned'").run();
  if (hr === 9 && (await cfgGet(env, 'daily:sent')) !== today) {
    const down = checks.filter(c => !c.up);
    await notify(env, `☀️ گزارش روزانه سرور\n\n${checks.map(c => `${c.up ? '✅' : '🔴'} ${c.name}`).join('\n')}\n\n💾 آخرین پشتیبان ساعتی: ${bd.at ? tehran(bd.at) : '—'}\n💾 آخرین پشتیبان کامل: ${bf.at ? tehran(bf.at) : '—'}\n\n${down.length ? 'یک یا چند سامانه قطع است؛ به Claude بگویید.' : 'همه چیز مرتب است. 🌷'}`);
    await cfgSet(env, 'daily:sent', today);
  }
}

export async function guardRun(env, force) {
  if (!env.BKDB) return { error: 'BKDB not bound' };
  for (const q of BK_SCHEMA) await env.BKDB.prepare(q).run();
  const budget = { n: 44 };   /* سقف درخواست‌های هر اجرا در پلن رایگان: ۵۰ */
  const checks = await checkAll(env, budget);
  const res = [];
  if (env.BACKUP_KEY && checks.find(c => c.k === 'team').up) {
    res.push(await pull(env, 'data', budget, force));
    res.push(await pull(env, 'full', budget, force));
  }
  await daily(env, checks);
  if (new Date().getUTCMinutes() < 5) await cleanup(env);
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
    return json({ checks, backups: list, alerts: !!(await cfgGet(env, 'owner_chat')), job: { data: await cfgJson(env, 'bkjob:data', null), full: await cfgJson(env, 'bkjob:full', null) } });
  }
  if (p === '/admin/guard/get' && req.method === 'GET') {
    const k = url.searchParams.get('k') || '';
    if (!/^(data|daily|full)\/\d{8}T\d{6}Z$/.test(k)) return err('نام فایل نامعتبر');
    const f = await env.BKDB.prepare('SELECT bytes FROM files WHERE name = ?').bind(k).first();
    const v = f && await readChunks(env, k, f.bytes);
    if (!v) return err('این نسخه پیدا نشد (شاید منقضی شده).', 404);
    return new Response(v, { headers: { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="hamyar-${k.replace('/', '-')}.tar.gz"`,
      'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Disposition' } });
  }
  if (p === '/admin/guard/run' && req.method === 'POST') return json(await guardRun(env, true));
  if (p === '/admin/guard/test' && req.method === 'POST') return json({ sent: await notify(env, '🔔 پیام آزمایشی نگهبان سرور همیار — اگر این را می‌بینید، هشدارها درست به شما می‌رسد.') });
  return null;
}
