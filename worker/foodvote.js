/* ══════════════════════════════════════════
   🍽️ نظر زائران درباره‌ی غذا + آشپزخانه‌ها و دوره‌ی مدیران آشپزخانه
   زائر بعد از هر وعده یک‌لمسی نظر می‌دهد (خوب/متوسط/ضعیف + توضیح اختیاری) و شهر/آشپزخانه را انتخاب می‌کند.
   مدیرِ آشپزخانه در زمان گزارش از روی «تاریخ وعده» و دوره‌های ثبت‌شده پیدا می‌شود (اگر دوره‌ها بعداً اصلاح شود، گزارش هم درست می‌شود).
   عمومی: GET /food/kitchens ، POST /food/vote   ·   پنل (دسترسی food): /admin/food/*
══════════════════════════════════════════ */
const MEALS = ['breakfast', 'lunch', 'dinner'], CITIES = ['najaf', 'karbala', 'kadhimiya', 'samarra'];
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS food_kitchens (id INTEGER PRIMARY KEY AUTOINCREMENT, city TEXT NOT NULL, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created INTEGER)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS food_kmgrs (id INTEGER PRIMARY KEY AUTOINCREMENT, kitchen_id INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT, d_from TEXT NOT NULL, d_to TEXT, created INTEGER, by TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS food_votes (dev TEXT NOT NULL, day TEXT NOT NULL, meal TEXT NOT NULL, city TEXT, kitchen_id INTEGER, dish TEXT, ctype TEXT, grade TEXT,
      vote INTEGER NOT NULL, note TEXT, t INTEGER NOT NULL, PRIMARY KEY (dev, day, meal))`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS food_votes_day ON food_votes (day)')
  ]);
  ready = true;
}

export async function handleFoodPublic(p, req, env, body, dev, json, err, limited) {
  if (p === '/food/kitchens' && req.method === 'GET') {
    await ensure(env);
    const rows = (await env.DB.prepare('SELECT id, city, name FROM food_kitchens WHERE active = 1 ORDER BY city, name').all()).results;
    return json({ kitchens: rows });
  }
  if (p === '/food/vote' && req.method === 'POST') {
    if (!dev) return err('شناسه‌ی دستگاه نامعتبر است.');
    if (await limited(env, 'fvote:' + dev, 20, 86400)) return err('امروز نظرهای زیادی ثبت کرده‌اید.', 429);
    const meal = MEALS.includes(body.meal) ? body.meal : null, vote = [1, 2, 3].includes(+body.vote) ? +body.vote : null;
    if (!meal || !vote || !isDay(body.day)) return err('درخواست نامعتبر');
    /* فقط امروز یا دیروز (به وقت عراق) */
    const today = new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10), yday = new Date(Date.now() + 3 * 36e5 - 864e5).toISOString().slice(0, 10);
    if (body.day !== today && body.day !== yday) return err('فقط برای وعده‌های امروز و دیروز می‌شود نظر داد.');
    await ensure(env);
    const city = CITIES.includes(body.city) ? body.city : null;
    let kid = +body.kitchen || null;
    if (kid && !(await env.DB.prepare('SELECT 1 FROM food_kitchens WHERE id = ? AND active = 1').bind(kid).first())) kid = null;
    await env.DB.prepare(`INSERT INTO food_votes (dev, day, meal, city, kitchen_id, dish, ctype, grade, vote, note, t) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (dev, day, meal) DO UPDATE SET city = excluded.city, kitchen_id = excluded.kitchen_id, dish = excluded.dish, vote = excluded.vote, note = excluded.note, t = excluded.t`)
      .bind(dev, body.day, meal, city, kid, clip(body.dish, 80), body.ctype === 'economic' ? 'economic' : 'normal', clip(body.grade, 8), vote, clip(body.note, 300), Date.now()).run();
    return json({ ok: true });
  }
  return null;
}

/* دوره‌ی مدیر برای (آشپزخانه، روز) */
const mgrOf = (mgrs, kid, day) => mgrs.find(m => m.kitchen_id === kid && m.d_from <= day && (!m.d_to || m.d_to >= day)) || null;

export async function handleFoodAdmin(p, req, env, url, body, json, err, who) {
  if (!p.startsWith('/admin/food/')) return null;
  await ensure(env);
  if (p === '/admin/food/kitchens' && req.method === 'GET') {
    const k = (await env.DB.prepare('SELECT * FROM food_kitchens ORDER BY city, name').all()).results;
    const m = (await env.DB.prepare('SELECT * FROM food_kmgrs ORDER BY d_from DESC').all()).results;
    return json({ kitchens: k, mgrs: m });
  }
  if (p === '/admin/food/kitchen' && req.method === 'POST') {
    const name = clip(body.name, 80), city = CITIES.includes(body.city) ? body.city : null;
    if (!name || !city) return err('شهر و نام آشپزخانه را وارد کنید.');
    if (body.id) await env.DB.prepare('UPDATE food_kitchens SET name = ?, city = ?, active = ? WHERE id = ?').bind(name, city, body.active === false ? 0 : 1, +body.id).run();
    else await env.DB.prepare('INSERT INTO food_kitchens (city, name, created) VALUES (?, ?, ?)').bind(city, name, Date.now()).run();
    return json({ ok: true });
  }
  if (p === '/admin/food/kitchen/del' && req.method === 'POST') {
    const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM food_votes WHERE kitchen_id = ?').bind(+body.id).first();
    if (used.n) { await env.DB.prepare('UPDATE food_kitchens SET active = 0 WHERE id = ?').bind(+body.id).run(); return json({ ok: true, hidden: true }); }
    await env.DB.batch([env.DB.prepare('DELETE FROM food_kmgrs WHERE kitchen_id = ?').bind(+body.id), env.DB.prepare('DELETE FROM food_kitchens WHERE id = ?').bind(+body.id)]);
    return json({ ok: true });
  }
  if (p === '/admin/food/mgr' && req.method === 'POST') {
    const name = clip(body.name, 80), kid = +body.kitchen_id, from = body.d_from, to = body.d_to || null;
    if (!name || !kid || !isDay(from) || (to && (!isDay(to) || to < from))) return err('نام، آشپزخانه و تاریخ شروع (و پایان بعد از شروع) لازم است.');
    if (!(await env.DB.prepare('SELECT 1 FROM food_kitchens WHERE id = ?').bind(kid).first())) return err('آشپزخانه پیدا نشد.');
    /* دوره‌ها در یک آشپزخانه نباید روی هم بیفتند */
    const clash = await env.DB.prepare(`SELECT name FROM food_kmgrs WHERE kitchen_id = ?1 AND id != ?2 AND d_from <= COALESCE(?4, '9999-12-31') AND COALESCE(d_to, '9999-12-31') >= ?3`)
      .bind(kid, +body.id || 0, from, to).first();
    if (clash) return err(`این بازه با دوره‌ی «${clash.name}» در همین آشپزخانه هم‌پوشانی دارد.`);
    if (body.id) await env.DB.prepare('UPDATE food_kmgrs SET kitchen_id = ?, name = ?, phone = ?, d_from = ?, d_to = ? WHERE id = ?').bind(kid, name, clip(body.phone, 20), from, to, +body.id).run();
    else await env.DB.prepare('INSERT INTO food_kmgrs (kitchen_id, name, phone, d_from, d_to, created, by) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(kid, name, clip(body.phone, 20), from, to, Date.now(), who).run();
    return json({ ok: true });
  }
  if (p === '/admin/food/mgr/del' && req.method === 'POST') {
    await env.DB.prepare('DELETE FROM food_kmgrs WHERE id = ?').bind(+body.id).run();
    return json({ ok: true });
  }
  /* گزارش: بازه‌ی تاریخ (میلادی YYYY-MM-DD) و شهر اختیاری */
  if (p === '/admin/food/report' && req.method === 'GET') {
    const from = url.searchParams.get('from'), to = url.searchParams.get('to'), city = url.searchParams.get('city') || '';
    if (!isDay(from) || !isDay(to)) return err('بازه‌ی تاریخ نامعتبر');
    const votes = (await env.DB.prepare(`SELECT day, meal, city, kitchen_id, dish, ctype, vote, note, t FROM food_votes WHERE day BETWEEN ? AND ? ${city ? 'AND city = ?' : ''} ORDER BY t DESC LIMIT 20000`)
      .bind(...(city ? [from, to, city] : [from, to])).all()).results;
    const K = (await env.DB.prepare('SELECT * FROM food_kitchens').all()).results, M = (await env.DB.prepare('SELECT * FROM food_kmgrs').all()).results;
    const kname = id => (K.find(k => k.id === id) || {}).name || '';
    const groups = new Map(), dishes = new Map(), notes = [];
    const add = (map, key, base, v) => { const g = map.get(key) || { ...base, n: 0, v1: 0, v2: 0, v3: 0 }; g.n++; g['v' + v]++; map.set(key, g); return g; };
    for (const v of votes) {
      const m = v.kitchen_id ? mgrOf(M, v.kitchen_id, v.day) : null;
      const key = `${v.city || ''}|${v.kitchen_id || 0}|${m ? m.id : 0}`;
      const g = add(groups, key, { city: v.city, kitchen: kname(v.kitchen_id), mgr: m ? m.name : '', mgr_from: m ? m.d_from : '', mgr_to: m ? m.d_to : '', meals: {} }, v.vote);
      const mm = g.meals[v.meal] || (g.meals[v.meal] = { n: 0, v1: 0, v2: 0, v3: 0 }); mm.n++; mm['v' + v.vote]++;
      if (v.dish) add(dishes, v.dish, { dish: v.dish }, v.vote);
      if (v.note && notes.length < 100) notes.push({ day: v.day, meal: v.meal, city: v.city, kitchen: kname(v.kitchen_id), mgr: m ? m.name : '', dish: v.dish, vote: v.vote, note: v.note });
    }
    return json({ total: votes.length, groups: [...groups.values()].sort((a, b) => b.n - a.n), dishes: [...dishes.values()].sort((a, b) => b.n - a.n), notes });
  }
  return null;
}
