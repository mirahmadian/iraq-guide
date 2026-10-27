/* ══════════════════════════════════════════
   همکاران پنل مدیریت — ورود با نام کاربری/رمز و دسترسی جزءبه‌جزء (perms.json)
   همکار هیچ‌وقت کلید GitHub را نمی‌بیند: پنل، data.js کامل را می‌فرستد و این‌جا فقط
   بخش‌هایی که اجازه دارد روی آخرین نسخه data.js گذاشته می‌شود؛ بقیه دست‌نخورده می‌ماند.
   کلید GitHub را پنل مدیر اصلی خودکار (رمزگذاری‌شده) این‌جا ثبت می‌کند.
══════════════════════════════════════════ */
import PERMS from '../perms.json';

const REPO = 'mirahmadian/iraq-guide';
const SESSION_DAYS = 30;

/* همه کلیدهای دسترسی معتبر: «notices»، «city.najaf.hotels» و ... */
export function permDefs(cities) {
  const out = [];
  for (const g of PERMS.groups) for (const it of g.items) {
    if (g.perCity) cities.forEach(c => { if (!(it.noSamarra && c === 'samarra')) out.push({ ...it, key: `city.${c}.${it.k}`, city: c }); });
    else out.push({ ...it, key: it.k });
  }
  return out;
}

/* کد ملی ایران: ۱۰ رقم، رقم آخر رقم کنترل است */
export function nidValid(c) {
  if (!/^\d{10}$/.test(c) || /^(\d)\1{9}$/.test(c)) return false;
  const r = [...c.slice(0, 9)].reduce((a, d, i) => a + +d * (10 - i), 0) % 11;
  return +c[9] === (r < 2 ? r : 11 - r);
}

const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
async function sha(s) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
function randHex(n) { return hex(crypto.getRandomValues(new Uint8Array(n))); }

/* ── کلید GitHub (رمزگذاری‌شده با SALT) ── */
async function aesKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('gh-key:' + env.SALT));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const toB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
export async function saveGhToken(env, tok) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env), new TextEncoder().encode(tok)));
  await env.DB.prepare('INSERT OR REPLACE INTO config (k, v) VALUES (?, ?)').bind('gh', JSON.stringify({ iv: toB64(iv), d: toB64(data), h: await sha(env.SALT + tok) })).run();
}
export async function ghTokenHash(env) {
  const r = await env.DB.prepare('SELECT v FROM config WHERE k = ?').bind('gh').first();
  return r ? JSON.parse(r.v).h : '';
}
async function ghToken(env) {
  const r = await env.DB.prepare('SELECT v FROM config WHERE k = ?').bind('gh').first();
  if (!r) throw new Error('مدیر اصلی هنوز یک بار وارد پنل نشده است؛ بعد از ورود او، انتشار همکاران فعال می‌شود.');
  const v = JSON.parse(r.v);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(v.iv) }, await aesKey(env), fromB64(v.d)));
}
async function gh(env, path, opts = {}) {
  return fetch(`https://api.github.com/repos/${REPO}${path}`, { ...opts, headers: { Authorization: 'Bearer ' + await ghToken(env), Accept: 'application/vnd.github+json', 'User-Agent': 'hamyar-staff', ...(opts.headers || {}) } });
}
async function ghGetText(env, path) {
  const r = await gh(env, `/contents/${path}?ref=main&t=${Date.now()}`);
  if (!r.ok) throw new Error('خواندن ' + path + ' از GitHub ناموفق بود (' + r.status + ')');
  const j = await r.json();
  return { sha: j.sha, text: new TextDecoder().decode(fromB64(j.content.replace(/\s/g, ''))) };
}
async function ghPut(env, path, b64, message, sha) {
  const r = await gh(env, '/contents/' + path, { method: 'PUT', body: JSON.stringify({ message, content: b64, ...(sha ? { sha } : {}) }) });
  if (!r.ok) { const e = new Error('ذخیره در GitHub ناموفق بود (' + r.status + ')'); e.status = r.status; throw e; }
  return r.json();
}

/* ── ورود همکار ── */
export async function staffSession(env, tok) {
  if (!/^[0-9a-f]{64}$/.test(tok)) return null;
  const s = await env.DB.prepare('SELECT s.user, s.exp, u.name, u.perms, u.active FROM sessions s JOIN staff u ON u.user = s.user WHERE s.tok = ?').bind(await sha(env.SALT + tok)).first();
  if (!s || s.exp < Date.now() || !s.active) return null;
  return { user: s.user, name: s.name, perms: new Set(JSON.parse(s.perms || '[]')) };
}

const dataObj = text => JSON.parse(text.slice(text.indexOf('{', text.indexOf('CARAVAN_DATA')), text.lastIndexOf('}') + 1));
const dataText = D => `/**
 * =====================================================
 *  فایل داده‌های راهنمای کاروان عراق
 *  آخرین بروزرسانی: ${D.lastUpdate || ''}
 * =====================================================
 */

const CARAVAN_DATA = ${JSON.stringify(D, null, 2)};
`;
function getP(o, path) { return path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o); }
function setP(o, path, v) {
  const ks = path.split('.'), last = ks.pop();
  const t = ks.reduce((a, k) => (a[k] && typeof a[k] === 'object' ? a[k] : (a[k] = {})), o);
  if (v === undefined) delete t[last]; else t[last] = v;
}
/* فقط بخش‌های مجاز از نسخه همکار روی آخرین نسخه گذاشته می‌شود */
function mergeAllowed(cur, sub, defs, perms) {
  const changed = [];
  for (const d of defs) {
    if (!perms.has(d.key) || !d.p.length) continue;
    let a = cur, b = sub;
    if (d.city) {
      a = (cur.cities || []).find(c => c.id === d.city);
      b = (sub.cities || []).find(c => c.id === d.city);
      if (!a || !b) continue;
    }
    for (const p of d.p) {
      const nv = getP(b, p);
      if (JSON.stringify(getP(a, p)) !== JSON.stringify(nv)) { setP(a, p, nv === undefined ? undefined : JSON.parse(JSON.stringify(nv))); changed.push(d.label + (d.city ? ' — ' + d.city : '')); }
    }
  }
  return [...new Set(changed)];
}

const FILE_RE = /^(hotels|people|cities|maps|banners|besat|slides|icons)\/[\w.-]{1,100}\.(jpg|jpeg|png|webp|pdf)$/;

export async function handleStaff(p, req, env, body, json, err, limited, ip) {
  const cities = ['najaf', 'karbala', 'kadhimiya', 'samarra'];
  const defs = permDefs(cities);

  if (p === '/staff/login' && req.method === 'POST') {
    const user = String(body.user || '').trim().toLowerCase(), key = String(body.key || '');
    if (!nidValid(user)) return err('کد ملی یا رمز اشتباه است.', 401);
    if (await limited(env, 'login:' + await sha(env.SALT + ip), 20, 900)) return err('تعداد تلاش‌ها زیاد است. ۱۵ دقیقه دیگر دوباره امتحان کنید.', 429);
    const u = await env.DB.prepare('SELECT * FROM staff WHERE user = ?').bind(user).first();
    if (!u || !/^[0-9a-f]{64}$/.test(key) || await sha(u.salt + key) !== u.hash) return err('کد ملی یا رمز اشتباه است.', 401);
    if (!u.active) return err('دسترسی این کاربر غیرفعال شده است.', 403);
    const tok = randHex(32);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO sessions (tok, user, exp) VALUES (?, ?, ?)').bind(await sha(env.SALT + tok), user, Date.now() + SESSION_DAYS * 864e5),
      env.DB.prepare('UPDATE staff SET last_login = ? WHERE user = ?').bind(Date.now(), user),
      env.DB.prepare('DELETE FROM sessions WHERE exp < ?').bind(Date.now())
    ]);
    return json({ token: tok, name: u.name, user, perms: JSON.parse(u.perms || '[]') });
  }

  const auth = (req.headers.get('Authorization') || '').match(/^staff\s+(\S+)$/i);
  const s = auth && await staffSession(env, auth[1]);
  if (!s) return err('نشست شما تمام شده است. دوباره وارد شوید.', 401);

  if (p === '/staff/me') return json({ name: s.name, user: s.user, perms: [...s.perms] });
  if (p === '/staff/logout') {
    await env.DB.prepare('DELETE FROM sessions WHERE tok = ?').bind(await sha(env.SALT + auth[1])).run();
    return json({ ok: true });
  }
  if (p === '/staff/data') {
    const { sha: fsha, text } = await ghGetText(env, 'data.js');
    return json({ sha: fsha, text });
  }
  if (p === '/staff/file' && req.method === 'POST') {
    const path = String(body.path || ''), b64 = String(body.b64 || '');
    if (!FILE_RE.test(path)) return err('مسیر فایل مجاز نیست.');
    if (b64.length > 8e6) return err('فایل خیلی بزرگ است.');
    const ok = defs.some(d => s.perms.has(d.key) && (d.files || []).some(f => path.startsWith(f)));
    if (!ok) return err('شما اجازه گذاشتن این فایل را ندارید.', 403);
    try { await ghPut(env, path, b64, 'Add file from admin panel (' + s.user + ')'); }
    catch (e) { return err(e.status === 422 ? 'فایلی با این نام از قبل هست.' : e.message, 400); }
    return json({ ok: true });
  }
  if (p === '/staff/publish' && req.method === 'POST') {
    if (!body.data || typeof body.data !== 'object') return err('داده نامعتبر');
    for (let tries = 0; tries < 3; tries++) {
      const { sha: fsha, text } = await ghGetText(env, 'data.js');
      const cur = dataObj(text);
      const changed = mergeAllowed(cur, body.data, defs, s.perms);
      if (!changed.length) return json({ ok: true, changed: [], text });
      const out = dataText(cur);
      try {
        await ghPut(env, 'data.js', toB64(new TextEncoder().encode(out)), `Update data.js (${s.user}): ${changed.join('، ')}`.slice(0, 200), fsha);
      } catch (e) { if (e.status === 409 && tries < 2) continue; throw e; }
      /* نام و آیکون برنامه در manifest.json */
      const m = body.manifest || {};
      const canTitle = s.perms.has('title'), canIcon = s.perms.has('icon');
      if ((canTitle || canIcon) && m && typeof m === 'object') {
        const mf = await ghGetText(env, 'manifest.json'), j = JSON.parse(mf.text), before = JSON.stringify(j);
        if (canTitle && typeof m.name === 'string' && m.name) { j.name = m.name.slice(0, 60); j.short_name = String(m.short_name || m.name).slice(0, 30); }
        if (canIcon && Array.isArray(m.icons) && m.icons.every(i => i && /^icons\/[\w.-]+\.png$/.test(i.src))) j.icons = m.icons;
        if (JSON.stringify(j) !== before) await ghPut(env, 'manifest.json', toB64(new TextEncoder().encode(JSON.stringify(j, null, 2) + '\n')), 'Update app name/icon (' + s.user + ')', mf.sha);
      }
      return json({ ok: true, changed, text: out });
    }
    return err('همزمان تغییر دیگری منتشر شد؛ دوباره «انتشار» را بزنید.', 409);
  }
  return err('یافت نشد', 404);
}

/* ── مدیریت کاربران (فقط مدیر اصلی) ── */
export async function handleUsers(p, req, env, body, json, err) {
  const defs = permDefs(['najaf', 'karbala', 'kadhimiya', 'samarra']), valid = new Set(defs.map(d => d.key));
  if (p === '/admin/users' && req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT user, name, perms, active, created, last_login FROM staff ORDER BY created').all();
    return json({ users: results.map(u => ({ ...u, perms: JSON.parse(u.perms || '[]') })) });
  }
  if (p === '/admin/users' && req.method === 'POST') {
    const user = String(body.user || '').trim().toLowerCase();
    if (!nidValid(user)) return err('کد ملی معتبر نیست.');
    const name = String(body.name || '').trim().slice(0, 60) || user;
    const perms = (Array.isArray(body.perms) ? body.perms : []).filter(k => valid.has(k));
    const active = body.active === false ? 0 : 1;
    const ex = await env.DB.prepare('SELECT user FROM staff WHERE user = ?').bind(user).first();
    if (body.key != null && !/^[0-9a-f]{64}$/.test(body.key)) return err('رمز نامعتبر');
    if (!ex && !body.key) return err('برای کاربر جدید رمز بگذارید.');
    if (ex && body.isNew) return err('این نام کاربری قبلاً ساخته شده است.');
    const salt = body.key ? randHex(16) : null, hash = body.key ? await sha(salt + body.key) : null;
    if (ex) {
      await env.DB.prepare('UPDATE staff SET name = ?, perms = ?, active = ?' + (hash ? ', salt = ?, hash = ?' : '') + ' WHERE user = ?')
        .bind(...[name, JSON.stringify(perms), active, ...(hash ? [salt, hash] : []), user]).run();
      /* با تغییر رمز یا غیرفعال شدن، همه ورودهای قبلی باطل می‌شود */
      if (hash || !active) await env.DB.prepare('DELETE FROM sessions WHERE user = ?').bind(user).run();
    } else {
      await env.DB.prepare('INSERT INTO staff (user, name, salt, hash, perms, active, created) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(user, name, salt, hash, JSON.stringify(perms), active, Date.now()).run();
    }
    return json({ ok: true });
  }
  if (p === '/admin/users/delete' && req.method === 'POST') {
    const user = String(body.user || '').toLowerCase();
    await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE user = ?').bind(user), env.DB.prepare('DELETE FROM staff WHERE user = ?').bind(user)]);
    return json({ ok: true });
  }
  return null;
}
