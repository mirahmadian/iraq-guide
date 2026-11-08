/* ══════════════════════════════════════════
   👷 هشدار تاریخ خروج عوامل منطقه (سامانه‌ی نواقص، پایگاه hamyar-hotels = HDB) در بازوی بله
   ۱. مدیر منطقه در پنلش «اتصال به بله» را می‌زند ← ble.ir/HamyarKaravan_Bot?start=t_کد ← این‌جا chat_id ذخیره می‌شود
   ۲. هر صبح ساعت ۸ عراق یک پیام خلاصه: کسانی که ۵ روز، ۱ روز یا امروز باید خارج شوند، و کسانی که تاریخشان گذشته
   (اتباع خارجی بیش از ۳۰ روز نمی‌توانند در عراق بمانند)
══════════════════════════════════════════ */
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

export async function teamBaleHook(env, m, send) {
  if (!env.HDB) return false;
  const text = String(m.text || '').trim(), st = text.match(/^\/start\s+t_([0-9a-f]{16})$/i);
  if (!st) return false;
  const chat = m.chat.id, say = t => send(env, 'sendMessage', { chat_id: chat, text: t, reply_markup: { remove_keyboard: true } });
  const l = await env.HDB.prepare('SELECT * FROM team_bale_links WHERE code = ? AND exp > ?').bind(st[1].toLowerCase(), Date.now()).first();
  if (!l) { await say('این لینک منقضی شده است. در پنل مدیر منطقه دوباره «اتصال به بله» را بزنید.'); return true; }
  const u = await env.HDB.prepare('SELECT name FROM users WHERE id = ? AND active = 1').bind(l.user_id).first();
  await env.HDB.batch([
    env.HDB.prepare('DELETE FROM team_bale_links WHERE code = ?').bind(l.code),
    env.HDB.prepare('INSERT OR REPLACE INTO team_bale (user_id, chat_id, linked, last_sent) VALUES (?, ?, ?, NULL)').bind(l.user_id, chat, Date.now())
  ]);
  await say(`✅ ${u ? u.name + ' عزیز، ' : ''}اتصال برقرار شد.\n\nاز این به بعد هر صبح، اگر یکی از عوامل منطقه (مدیران ثابت، آشپزها و …) نزدیک تاریخ خروجش باشد، همین‌جا خبرتان می‌کنیم:\n• ۵ روز مانده\n• ۱ روز مانده\n• روز خروج\n• و اگر تاریخ خروج گذشته و هنوز «خارج شد» ثبت نشده`);
  return true;
}

const fa = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const nm = r => `${r.first} ${r.last}${r.role ? ' (' + r.role + ')' : ''}${r.hotel ? '، ' + r.hotel : ''}`;
/* هر ۵ دقیقه صدا زده می‌شود؛ فقط یک بار در روز، از ساعت ۸ صبح عراق به بعد، برای هر مدیر منطقه */
export async function teamStaffTick(env, send, force) {
  if (!env.HDB || !send) return;
  const hour = +new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Baghdad', hour: 'numeric', hour12: false }).format(new Date());
  if (!force && (hour < 8 || hour >= 22)) return;
  const today = JD.today(), tstr = JD.str(today);
  const subs = (await env.HDB.prepare("SELECT b.user_id, b.chat_id, u.role, u.region_id, u.name FROM team_bale b JOIN users u ON u.id = b.user_id WHERE u.active = 1 AND u.role IN ('region', 'super') AND (b.last_sent IS NULL OR b.last_sent != ?)").bind(tstr).all()).results;
  if (!subs.length) return;
  const rows = (await env.HDB.prepare("SELECT s.*, r.name AS region FROM staff s JOIN regions r ON r.id = s.region_id WHERE s.status = 'active'").all()).results;
  for (const s of subs) {
    const mine = rows.filter(r => s.role === 'super' || r.region_id === s.region_id).map(r => ({ ...r, left: JD.num(r.d_end) - today }));
    const g = { over: mine.filter(r => r.left < 0), d0: mine.filter(r => r.left === 0), d1: mine.filter(r => r.left === 1), d5: mine.filter(r => r.left === 5) };
    await env.HDB.prepare('UPDATE team_bale SET last_sent = ? WHERE user_id = ?').bind(tstr, s.user_id).run();
    if (!g.over.length && !g.d0.length && !g.d1.length && !g.d5.length) continue;
    const reg = s.role === 'super' ? r => ` [${r.region}]` : () => '';
    const part = (title, L, extra) => L.length ? `${title}\n${L.map(r => '• ' + nm(r) + reg(r) + (extra ? extra(r) : '')).join('\n')}` : '';
    const msg = [`⏰ هشدار تاریخ خروج عوامل (${fa(tstr)})`,
      part('⛔ تاریخ خروجشان گذشته و هنوز «خارج شد» ثبت نشده:', g.over, r => ` (${fa(-r.left)} روز گذشته)`),
      part('🔴 امروز باید خارج شوند:', g.d0), part('🟠 فردا باید خارج شوند:', g.d1), part('🟡 ۵ روز دیگر باید خارج شوند:', g.d5),
      'برای تمدید، جابجایی یا ثبت خروج: پنل مدیر منطقه ← 👷 عوامل\nhttps://mirahmadian.github.io/iraq-guide/team.html#staff'].filter(Boolean).join('\n\n');
    try { await send(env, 'sendMessage', { chat_id: s.chat_id, text: msg }); } catch (e) { console.log('staff alert', e && e.message); }
  }
}
