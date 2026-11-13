/* ══════════════════════════════════════════
   🏨 پیشنهادهای مدیران ثابت برای تکمیل اطلاعات هتل‌های اپ (عکس، آدرس، تلفن، موقعیت، نام انگلیسی، اصلاح، هتل تازه)
   مدیران ثابت در سامانه پایش خدمات می‌فرستند (worker/team-api ← پایگاه HDB)؛ این‌جا در بخش هتل‌های پنل مدیریت
   بررسی می‌شود: مدیر اصلی همه‌ی شهرها، همکار پنل فقط شهرهایی که دسترسی «هتل‌های همان شهر» دارد.
   «تأیید» در پنل، مورد را در ویرایشگر هتل می‌گذارد و بعد از «انتشار» اینجا approved ثبت می‌شود.
══════════════════════════════════════════ */
const CITIES = ['najaf', 'karbala', 'kadhimiya', 'samarra'];
export const hsugCities = staff => staff ? CITIES.filter(c => staff.perms.has(`city.${c}.hotels`)) : CITIES;

export async function handleHsugAdmin(p, req, env, url, body, json, err, staff) {
  if (!p.startsWith('/admin/hsug/')) return null;
  const C = hsugCities(staff), who = staff ? (staff.name || staff.user) : 'مدیر اصلی';
  if (!C.length) return err('شما به هتل‌های هیچ شهری دسترسی ندارید.', 403);
  const inC = `city IN (${C.map(() => '?').join(',')})`;
  if (p === '/admin/hsug/list' && req.method === 'GET') {
    const rows = (await env.HDB.prepare(`SELECT id, hotel_id, city, hotel_name, field, value, note, user_name, t FROM hotel_sug WHERE status = 'pending' AND ${inC} ORDER BY city, hotel_id, t LIMIT 1000`).bind(...C).all()).results;
    const done = (await env.HDB.prepare(`SELECT status, COUNT(*) AS n FROM hotel_sug WHERE status != 'pending' AND ${inC} GROUP BY status`).bind(...C).all()).results;
    return json({ rows: rows.map(r => ({ ...r, value: JSON.parse(r.value || 'null') })), done });
  }
  if (p === '/admin/hsug/photo' && req.method === 'GET') {
    const r = await env.HDB.prepare(`SELECT p.data FROM hsug_photo p JOIN hotel_sug s ON s.id = p.sug_id WHERE p.sug_id = ? AND s.${inC}`).bind(+url.searchParams.get('id'), ...C).first();
    return r ? json({ data: r.data }) : err('عکس پیدا نشد', 404);
  }
  if (p === '/admin/hsug/set' && req.method === 'POST') {
    const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Boolean).slice(0, 500), st = body.status === 'approved' ? 'approved' : body.status === 'rejected' ? 'rejected' : null;
    if (!ids.length || !st) return err('درخواست نامعتبر');
    const reason = String(body.reason || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 300);
    if (st === 'rejected' && !reason) return err('دلیل رد را بنویسید تا مدیر ثابت بداند چه کند.');
    const q = ids.map(() => '?').join(',');
    await env.HDB.batch([
      env.HDB.prepare(`UPDATE hotel_sug SET status = ?, reason = ?, reviewer = ?, rt = ? WHERE status = 'pending' AND id IN (${q}) AND ${inC}`).bind(st, st === 'rejected' ? reason : null, who, Date.now(), ...ids, ...C),
      /* عکس‌ها بعد از بررسی لازم نیستند (عکس تأییدشده در مخزن سایت منتشر شده است) */
      env.HDB.prepare(`DELETE FROM hsug_photo WHERE sug_id IN (${q}) AND sug_id IN (SELECT id FROM hotel_sug WHERE status != 'pending')`).bind(...ids)
    ]);
    return json({ ok: true });
  }
  return null;
}
