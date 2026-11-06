/* واسطه رایگان Cloudflare برای سرور «نواقص هتل‌ها» (team.html)
   وقتی اینترنت کاربر مستقیم به سرور 188.121.118.223 نمی‌رسد (مسدود شدن IP، اختلال مسیر)،
   درخواست‌های /api/ از این‌جا به همان سرور فرستاده می‌شود. داده‌ها روی خود سرور می‌ماند. */
/* نام sslip.io به‌جای nip.io: از ۱۴۰۵/۰۸/۱۵ فیلترینگ ایران اتصال‌های رمزدار خارجی با نام 188-121-118-223.nip.io را قطع می‌کند
   (از Cloudflare ۰ از ۵)، ولی همین سرور با نام sslip.io وصل می‌شود. Cloudflare اجازه اتصال با IP خالی را نمی‌دهد (خطای 1003). */
const UPSTREAM = 'https://188-121-118-223.sslip.io';

export default {
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: {
      'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
    if (!url.pathname.startsWith('/api/')) return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
    const h = new Headers();
    for (const k of ['content-type', 'accept', 'origin', 'referer', 'user-agent']) { const v = req.headers.get(k); if (v) h.set(k, v); }
    const ip = req.headers.get('CF-Connecting-IP');
    if (ip) { h.set('X-Forwarded-For', ip); h.set('X-Real-IP', ip); }
    let r;
    try {
      r = await fetch(UPSTREAM + url.pathname + url.search, { method: req.method, headers: h, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body, redirect: 'manual' });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'سرور اصلی در دسترس نیست.' }), { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });
    }
    const out = new Headers(r.headers);
    if (!out.has('Access-Control-Allow-Origin')) out.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*');
    out.set('Access-Control-Expose-Headers', 'Content-Disposition');
    /* پاسخ‌های معمولی (JSON، فایل اکسل) اول کامل گرفته و بعد فرستاده می‌شوند: عبور جریانی فایل اکسل وسط راه قطع می‌شد
       (responseStreamDisconnected). فقط عکس و فیلم‌های بزرگ جریانی می‌مانند. */
    const ct = r.headers.get('content-type') || '', len = +(r.headers.get('content-length') || 0);
    if (!/^(image|video|audio)\//.test(ct) && len < 20e6) {
      let buf;
      try { buf = await r.arrayBuffer(); }
      catch (e) { return new Response(JSON.stringify({ error: 'ارتباط با سرور اصلی وسط کار قطع شد. دوباره امتحان کنید.' }), { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' } }); }
      out.delete('content-encoding'); out.delete('content-length'); out.delete('transfer-encoding');
      return new Response(buf, { status: r.status, headers: out });
    }
    return new Response(r.body, { status: r.status, headers: out });
  }
};
