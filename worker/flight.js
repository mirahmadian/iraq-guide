/* ══════════════════════════════════════════
   ✈️ هشدار ساعت حرکت به فرودگاه (برنامه: flight.js)
   گوشی برنامه‌ی هشدارها را (زمان + متن) می‌فرستد؛ نگهبان هر ۵ دقیقه هشدارهای رسیده را می‌فرستد:
   - اعلان روی صفحه‌ی گوشی (Web Push بدون محتوا؛ خود برنامه‌ی گوشی متن را از حافظه‌اش نشان می‌دهد)
   - و اگر کاربر خواسته و عضو بازوی بله است، همان متن در بله
   هیچ اطلاعات شخصی ذخیره نمی‌شود؛ ردیف بعد از زمان پرواز پاک می‌شود.
   راز: VAPID_JWK (کلید خصوصی اعلان‌ها، با wrangler secret put)
══════════════════════════════════════════ */
export const VAPID_PUB = 'BBB3huPc-duqsm_MRzkmn5MWbbtWCnzu6cRu-JaBE2mIiJqiiLHRpIBxz8cww2XxFXzqdPDDD2fuSfHd8IE8bAs';
const SCHEMA = `CREATE TABLE IF NOT EXISTS flights (dev TEXT PRIMARY KEY, sub TEXT, steps TEXT NOT NULL, nxt INTEGER, fl INTEGER NOT NULL, bale INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)`;
/* فقط سرویس‌های اعلان شناخته‌شده‌ی مرورگرها */
const PUSH_HOSTS = /^https:\/\/([\w-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|notify\.windows\.com|push\.apple\.com)\//;
const LATE = 40 * 6e4;   /* هشداری که بیش از ۴۰ دقیقه از وقتش گذشته دیگر فرستاده نمی‌شود */

const nextOf = steps => { const s = steps.find(x => !x.sent); return s ? s.t : null; };

export async function handleFlight(p, req, env, body, dev, json, err, limited) {
  if (!dev) return err('شناسه گوشی نامعتبر');
  await env.DB.prepare(SCHEMA).run();
  if (p === '/flight/set' && req.method === 'POST') {
    if (await limited(env, 'fset:' + dev, 30, 3600)) return err('کمی بعد دوباره امتحان کنید.', 429);
    const now = Date.now(), fl = +body.fl;
    if (!(fl > now && fl < now + 45 * 864e5)) return err('ساعت پرواز نامعتبر است.');
    const steps = (Array.isArray(body.steps) ? body.steps : []).slice(0, 10)
      .map(s => ({ k: String(s.k || '').slice(0, 10), t: +s.t, title: String(s.title || '').slice(0, 80), body: String(s.body || '').slice(0, 400) }))
      .filter(s => s.t > now - 6e4 && s.t <= fl && s.title).sort((a, b) => a.t - b.t);
    if (!steps.length) return err('زمان هشدارها گذشته است.');
    let sub = null;
    if (body.sub && typeof body.sub.endpoint === 'string' && PUSH_HOSTS.test(body.sub.endpoint)) sub = JSON.stringify({ endpoint: body.sub.endpoint.slice(0, 800) });
    const bale = body.bale ? 1 : 0;
    await env.DB.prepare(`INSERT OR REPLACE INTO flights (dev, sub, steps, nxt, fl, bale, created) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(dev, sub, JSON.stringify(steps), nextOf(steps), fl, bale, now).run();
    let baleOk = false;
    if (bale) baleOk = !!(await env.DB.prepare('SELECT 1 FROM bale_users WHERE dev = ? AND active = 1').bind(dev).first());
    return json({ ok: true, push: !!sub, bale: baleOk, n: steps.length });
  }
  if (p === '/flight/del' && req.method === 'POST') {
    await env.DB.prepare('DELETE FROM flights WHERE dev = ?').bind(dev).run();
    return json({ ok: true });
  }
  return null;
}

/* ── هر ۵ دقیقه (cron) ── */
export async function flightTick(env, bale) {
  await env.DB.prepare(SCHEMA).run();
  const now = Date.now();
  await env.DB.prepare('DELETE FROM flights WHERE fl < ? OR (nxt IS NULL AND created < ?)').bind(now - 6 * 36e5, now - 864e5).run();
  const rows = (await env.DB.prepare('SELECT * FROM flights WHERE nxt IS NOT NULL AND nxt <= ? LIMIT 40').bind(now + 60e3).all()).results;
  for (const r of rows) {
    const steps = JSON.parse(r.steps);
    const due = steps.filter(s => !s.sent && s.t <= now + 60e3);
    due.forEach(s => s.sent = 1);
    const last = due[due.length - 1];
    let sub = r.sub;
    if (last && now - last.t < LATE) {
      if (sub) { const st = await webPush(env, JSON.parse(sub).endpoint).catch(() => 0); if (st === 404 || st === 410) sub = null; }
      if (r.bale && bale) {
        const u = await env.DB.prepare('SELECT chat_id FROM bale_users WHERE dev = ? AND active = 1').bind(r.dev).first();
        if (u) await bale(env, 'sendMessage', { chat_id: u.chat_id, text: `${last.title}\n\n${last.body}\n\n— همیار کاروان` }).catch(() => {});
      }
    }
    await env.DB.prepare('UPDATE flights SET steps = ?, nxt = ?, sub = ? WHERE dev = ?').bind(JSON.stringify(steps), nextOf(steps), sub, r.dev).run();
  }
}

/* ── Web Push بدون محتوا: فقط امضای VAPID (RFC 8292) ── */
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
let vapidKey = null;
export async function vapidJwt(env, aud) {
  if (!env.VAPID_JWK) throw new Error('VAPID_JWK not set');
  vapidKey = vapidKey || await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = o => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const data = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://mirahmadian.github.io/iraq-guide/' });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapidKey, new TextEncoder().encode(data));
  return data + '.' + b64u(sig);
}
async function webPush(env, endpoint) {
  const jwt = await vapidJwt(env, new URL(endpoint).origin);
  const r = await fetch(endpoint, { method: 'POST', headers: { Authorization: `vapid t=${jwt}, k=${VAPID_PUB}`, TTL: '1800', Urgency: 'high', 'Content-Length': '0' } });
  return r.status;
}
