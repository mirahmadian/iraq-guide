/* ══════════════════════════════════════════
   همیار کاروان — نظر و امتیاز زائران درباره هتل‌ها (Cloudflare Worker + D1 + Workers AI)
   کنترل خودکار نظرها:
     ۱. فیلتر کلمات رکیک و لینک/شماره تلفن ← نظر اصلاً ثبت نمی‌شود
     ۲. بررسی هوش مصنوعی ← نظر نامناسب پنهان می‌شود (مدیر می‌تواند برگرداند)
     ۳. گزارش کاربران ← با ۳ گزارش از ۳ گوشی مختلف پنهان می‌شود
   مدیر با همان کلید GitHub پنل مدیریت شناسایی می‌شود (دسترسی push به مخزن).
   استقرار: cd worker && npx wrangler deploy
══════════════════════════════════════════ */
const REPO = 'mirahmadian/iraq-guide';
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_LEN = 300, MAX_NAME = 30, REPORTS_TO_HIDE = 3;
const H_RE = /^[\w-]{1,40}\/[\w.-]{1,80}$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Dev, Authorization',
  'Access-Control-Max-Age': '86400'
};
const json = (d, status = 200, extra = {}) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra } });
const err = (msg, status = 400) => json({ error: msg }, status);

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 16).map(x => x.toString(16).padStart(2, '0')).join('');
}

/* ── متن ── */
function cleanText(s) {
  return String(s || '').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
}
function norm0(s) {
  return s.toLowerCase()
    .replace(/[يىئ]/g, 'ی').replace(/ك/g, 'ک').replace(/[ةۀ]/g, 'ه').replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و')
    .replace(/[ً-ٰٟـ​-‏‪-‮⁦-⁩]/g, '')
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}
const norm = s => norm0(s).replace(/(\p{L})\1+/gu, '$1');
/* کلمه‌هایی که خودشان (یا با پسوند ضمیر) رکیک‌اند — به‌صورت کلمه کامل بررسی می‌شوند تا «کسی» و «مسکونی» اشتباه گرفته نشوند */
const BAD_EXACT = norm(`کیر کیرم کیرت کیرش کیری کیرو کیرمو کسم کست کسش کص کصم کصت کصش کون کونم کونت کونش کونی کونده
  کسکش کصکش کسخل کسخول کصخل کسشر کصشر کسشعر کصشعر جنده جندس جنده‌ها جندگی جاکش دیوث قرمساق لاشی گوه گوز
  گاییدم گاییدی گایید گاییدن بگا بگام بگات گاییده سکس سکسی پورن ممه ممه‌هات حشری فاک شاسگول اوبی
  زب طیز منیوک منیوکه شرموط شرموطه قحبه قحاب عاهره کسامک کسختک ابن‌الکلب
  fuck fck fuk fucking fucker shit bitch dick pussy asshole porn sex cunt whore slut`).split(/\s+/);
/* ترکیب‌های بلندی که داخل یک کلمه، یا با دو کلمه پشت سر هم (مادر جنده) رکیک‌اند */
const BAD_PART = norm(`کسکش کصکش مادرجنده خارجنده خارکسده خارکصده کسننت کیرخر حرومزاده حرامزاده حرومزاد بیناموس پدرسگ
  پدرسوخته مادرقحبه کونکش کسخل کسخول`).split(/\s+/);
const BAD_SET = new Set(BAD_EXACT);
const SUFFIX = ['یه', 'ه', 'ی', 'ها', 'های', 'ام', 'ای', 'ات', 'اش', 'م', 'ت', 'ش', 'و'];
const isBad = w => BAD_SET.has(w) || SUFFIX.some(x => w.length > x.length + 1 && w.endsWith(x) && BAD_SET.has(w.slice(0, -x.length)));

function badReason(text) {
  const n0 = norm0(text);
  if (/(https?:|www\.|\.(com|ir|net|org|me|io)\b|t\.me|@[a-z0-9_]{3,})/i.test(n0)) return 'لینک و آدرس اینترنتی در نظر مجاز نیست.';
  if ((n0.match(/\d[\d\s\-–.]{6,}\d/g) || []).some(x => x.replace(/\D/g, '').length >= 8)) return 'شماره تلفن در نظر مجاز نیست.';
  const words = norm(text).split(/[^\p{L}]+/u).filter(Boolean);
  /* حروف جدا از هم (ک ی ر) را به هم بچسبان */
  const tokens = [...words]; let run = '';
  for (const w of [...words, '..']) { if (w.length === 1) run += w; else { if (run.length > 1) tokens.push(norm(run)); run = ''; } }
  if (tokens.some(w => isBad(w) || BAD_PART.some(p => w.includes(p)))) return 1;
  for (let i = 1; i < words.length; i++) if (BAD_PART.includes(norm(words[i - 1] + words[i]))) return 1;
  return '';
}

const AI_SYS = 'You moderate short public reviews of hotels written by Iranian pilgrims in Iraq (mostly Persian, sometimes Arabic or English). ' +
  'Reply with exactly one word: OK or BLOCK. BLOCK if the text contains profanity, vulgar or sexual language (including misspelled, spaced or disguised forms), ' +
  'insults or hate toward a person, people, ethnicity, religion or sect, threats, political propaganda, advertising, phone numbers or links, or text unrelated to the hotel. ' +
  'Honest negative criticism of the hotel, staff service, food, cleanliness or price is OK.';
async function aiBlocks(env, text) {
  try {
    const r = await Promise.race([
      env.AI.run(MODEL, { messages: [{ role: 'system', content: AI_SYS }, { role: 'user', content: text }], max_tokens: 4, temperature: 0 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
    ]);
    return /BLOCK/i.test(String(r && (r.response || '')));
  } catch (e) {
    return null; /* هوش مصنوعی در دسترس نبود */
  }
}

/* ── محدودیت تعداد درخواست ── */
async function limited(env, key, max, sec) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare('INSERT INTO hits (k, n, exp) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN exp < ?3 THEN 1 ELSE n + 1 END, exp = CASE WHEN exp < ?3 THEN ?2 ELSE exp END RETURNING n')
    .bind(key, now + sec, now).first();
  return row.n > max;
}

/* ── مدیر: کلید GitHub با دسترسی push به مخزن ── */
async function isAdmin(env, req) {
  const tok = (req.headers.get('Authorization') || '').replace(/^(token|Bearer)\s+/i, '').trim();
  if (!tok || tok.length < 20) return false;
  const k = 'adm:' + await sha(env.SALT + tok), now = Math.floor(Date.now() / 1000);
  const c = await env.DB.prepare('SELECT exp FROM hits WHERE k = ?').bind(k).first();
  if (c && c.exp > now) return true;
  const r = await fetch('https://api.github.com/repos/' + REPO, { headers: { Authorization: 'token ' + tok, 'User-Agent': 'hamyar-reviews', Accept: 'application/vnd.github+json' } });
  if (!r.ok) return false;
  const d = await r.json();
  if (!(d.permissions && (d.permissions.push || d.permissions.admin))) return false;
  await env.DB.prepare('INSERT OR REPLACE INTO hits (k, n, exp) VALUES (?, 1, ?)').bind(k, now + 600).run();
  return true;
}

const pub = r => ({ id: r.id, name: r.name || '', stars: r.stars, text: r.text, ts: r.ts });

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url), p = url.pathname.replace(/\/+$/, '') || '/';
    const ip = req.headers.get('CF-Connecting-IP') || '';
    const devRaw = req.headers.get('X-Dev') || '';
    const dev = /^[\w-]{16,64}$/.test(devRaw) ? await sha(env.SALT + devRaw) : '';
    let body = {};
    if (req.method === 'POST') { try { body = await req.json(); } catch (e) { return err('درخواست نامعتبر'); } }

    try {
      /* میانگین همه هتل‌ها برای نمایش ستاره در فهرست */
      if (p === '/summary' && req.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT h, ROUND(AVG(stars), 1) AS a, COUNT(*) AS n FROM reviews WHERE hidden IS NULL GROUP BY h').all();
        const out = {}; results.forEach(r => { out[r.h] = [r.a, r.n]; });
        return json(out, 200, { 'Cache-Control': 'public, max-age=60' });
      }

      if (p === '/list' && req.method === 'GET') {
        const h = url.searchParams.get('h') || '';
        if (!H_RE.test(h)) return err('هتل نامعتبر');
        const { results } = await env.DB.prepare('SELECT id, dev, name, stars, text, ts FROM reviews WHERE h = ? AND hidden IS NULL ORDER BY ts DESC LIMIT 200').bind(h).all();
        const dist = [0, 0, 0, 0, 0]; let sum = 0;
        results.forEach(r => { dist[r.stars - 1]++; sum += r.stars; });
        let mine = null;
        if (dev) {
          const m = await env.DB.prepare('SELECT id, name, stars, text, ts, hidden FROM reviews WHERE h = ? AND dev = ?').bind(h, dev).first();
          if (m) mine = { ...pub(m), hidden: !!m.hidden };
        }
        const reported = dev ? (await env.DB.prepare('SELECT rid FROM reports r JOIN reviews v ON v.id = r.rid WHERE v.h = ? AND r.dev = ?').bind(h, dev).all()).results.map(r => r.rid) : [];
        return json({
          n: results.length, avg: results.length ? Math.round(sum / results.length * 10) / 10 : 0, dist, mine, reported,
          items: results.filter(r => r.text && r.dev !== dev).slice(0, 100).map(pub)
        });
      }

      if (p === '/post' && req.method === 'POST') {
        if (!dev) return err('شناسه گوشی نامعتبر');
        const h = String(body.h || ''), stars = Math.round(+body.stars), text = cleanText(body.text), name = cleanText(body.name).slice(0, MAX_NAME);
        if (!H_RE.test(h)) return err('هتل نامعتبر');
        if (!(stars >= 1 && stars <= 5)) return err('امتیاز را با ستاره‌ها انتخاب کنید.');
        if (await limited(env, 'post:' + await sha(env.SALT + ip), 15, 3600)) return err('تعداد نظرهای ارسالی از این اینترنت زیاد است. یک ساعت دیگر دوباره امتحان کنید.', 429);
        if (/[\d۰-۹٠-٩@]/.test(name)) return err('در نام، عدد و علامت @ مجاز نیست.', 422);
        const badName = name && badReason(name);
        if (badName) return err(badName === 1 ? 'نامی که نوشتید کلمه نامناسب دارد.' : badName, 422);
        const bad = text && badReason(text);
        if (bad) return err(bad === 1 ? 'نظر شما کلمه نامناسب دارد و ثبت نشد. لطفاً محترمانه بنویسید.' : bad, 422);
        /* نام و متن با هم به هوش مصنوعی داده می‌شوند */
        const chk = (name ? 'Reviewer name: ' + name + '\nReview: ' : '') + text;
        let hidden = null, why = null;
        if (text || name) {
          const b = await aiBlocks(env, chk);
          if (b) { hidden = 'ai'; why = 'تشخیص هوش مصنوعی'; }
          else if (b === null) why = 'ai-pending';
        }
        const now = Date.now();
        const row = await env.DB.prepare(`INSERT INTO reviews (h, dev, stars, text, ts, hidden, why, name) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
          ON CONFLICT(h, dev) DO UPDATE SET stars = ?3, text = ?4, ts = ?5, hidden = ?6, why = ?7, name = ?8, reports = 0 RETURNING id`)
          .bind(h, dev, stars, text, now, hidden, why, name).first();
        await env.DB.prepare('DELETE FROM reports WHERE rid = ?').bind(row.id).run();
        /* اگر هوش مصنوعی در دسترس نبود، کمی بعد دوباره بررسی شود */
        if (why === 'ai-pending') ctx.waitUntil((async () => {
          await new Promise(r => setTimeout(r, 15000));
          const b2 = await aiBlocks(env, chk);
          if (b2 !== null) await env.DB.prepare('UPDATE reviews SET hidden = ?, why = ? WHERE id = ? AND ts = ?').bind(b2 ? 'ai' : null, b2 ? 'تشخیص هوش مصنوعی' : null, row.id, now).run();
        })());
        return json({ ok: true, id: row.id, hidden: !!hidden });
      }

      if (p === '/report' && req.method === 'POST') {
        if (!dev) return err('شناسه گوشی نامعتبر');
        const id = +body.id;
        if (await limited(env, 'rep:' + await sha(env.SALT + ip), 30, 3600)) return err('تعداد گزارش‌ها زیاد است.', 429);
        const r = await env.DB.prepare('SELECT dev FROM reviews WHERE id = ?').bind(id).first();
        if (!r) return err('نظر پیدا نشد', 404);
        if (r.dev === dev) return err('نمی‌توانید نظر خودتان را گزارش کنید.');
        const ins = await env.DB.prepare('INSERT OR IGNORE INTO reports (rid, dev) VALUES (?, ?)').bind(id, dev).run();
        if (ins.meta.changes) {
          await env.DB.prepare(`UPDATE reviews SET reports = reports + 1,
            hidden = CASE WHEN hidden IS NULL AND reports + 1 >= ?2 THEN 'reports' ELSE hidden END,
            why = CASE WHEN hidden IS NULL AND reports + 1 >= ?2 THEN 'گزارش کاربران' ELSE why END WHERE id = ?1`).bind(id, REPORTS_TO_HIDE).run();
        }
        return json({ ok: true });
      }

      if (p === '/delete' && req.method === 'POST') {
        if (!dev) return err('شناسه گوشی نامعتبر');
        await env.DB.prepare('DELETE FROM reviews WHERE id = ? AND dev = ?').bind(+body.id, dev).run();
        await env.DB.prepare('DELETE FROM reports WHERE rid = ?').bind(+body.id).run();
        return json({ ok: true });
      }

      /* ── مدیر ── */
      if (p.startsWith('/admin/')) {
        if (!await isAdmin(env, req)) return err('دسترسی مدیر تأیید نشد. دوباره وارد پنل شوید.', 401);
        if (p === '/admin/list' && req.method === 'GET') {
          const hiddenOnly = url.searchParams.get('mode') !== 'recent';
          const { results } = await env.DB.prepare(`SELECT id, h, name, stars, text, ts, hidden, why, reports FROM reviews
            WHERE ${hiddenOnly ? 'hidden IS NOT NULL' : "text != ''"} ORDER BY ts DESC LIMIT 300`).all();
          return json({ items: results });
        }
        if (p === '/admin/set' && req.method === 'POST') {
          const id = +body.id, a = body.action;
          if (a === 'delete') {
            await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
            await env.DB.prepare('DELETE FROM reports WHERE rid = ?').bind(id).run();
          } else if (a === 'show') {
            /* نظری که مدیر تأیید کرد دیگر با گزارش پنهان نمی‌شود */
            await env.DB.prepare("UPDATE reviews SET hidden = NULL, why = 'تأیید مدیر', reports = -1000 WHERE id = ?").bind(id).run();
          } else if (a === 'hide') {
            await env.DB.prepare("UPDATE reviews SET hidden = 'admin', why = 'پنهان‌شده توسط مدیر' WHERE id = ?").bind(id).run();
          } else return err('عملیات نامعتبر');
          return json({ ok: true });
        }
      }
      return err('یافت نشد', 404);
    } catch (e) {
      return err('خطای سرور: ' + (e && e.message || e), 500);
    }
  }
};
