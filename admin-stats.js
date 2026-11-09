/* ══════════════════════════════════════════
   STATS — آمار کاربران (سرور: worker/reviews.js ← /admin/stats ، برنامه: stats.js)
══════════════════════════════════════════ */
let stData = null, stErr = '', stTimer = null;
const stN = n => (+n || 0).toLocaleString('fa');
let stRegionNames = null;
try { stRegionNames = new Intl.DisplayNames(['fa'], { type: 'region' }); } catch (e) {}
const stCountry = c => !c || c === '?' ? 'نامعلوم' : (stRegionNames ? stRegionNames.of(c) : c);
const stGeo = g => { const [c, r, t] = String(g || '').split('|'); return escH([t, r].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('، ') || '—') + ' — ' + stCountry(c); };
const ST_PLAT = { android: '🤖 اندروید', ios: '🍎 آیفون', desktop: '💻 کامپیوتر', other: '❔ سایر' };

function statsLoad() {
  clearInterval(stTimer);
  if (!ghToken && !STAFF) { stErr = 'اول وارد پنل شوید.'; renderStats(); return; }
  const go = () => {
    if (!document.getElementById('tab-stats').classList.contains('active')) { clearInterval(stTimer); return; }
    rvaApi('/admin/stats').then(d => { stData = d; stErr = ''; renderStats(); }).catch(e => { stErr = e.message; renderStats(); });
  };
  go(); stTimer = setInterval(go, 30000);
}
const stSec = (k, ttl, body, def) => `<details class="gd-det" ${ccGet('st:' + k, def) ? 'open' : ''} ontoggle="ccSet('st:${k}', this.open)"><summary><b>${ttl}</b></summary><div style="padding:4px 0 8px">${body}</div></details>`;
function renderStats() {
  const el = document.getElementById('stats-admin');
  if (!el) return;
  const d = stData, box = (v, l, c = '') => `<div style="flex:1;min-width:130px;padding:14px;border-radius:14px;background:#fff;border:1px solid #d7e2dc;text-align:center">
    <div style="font-size:28px;font-weight:900;color:${c || '#1f6f50'}">${v}</div><div style="font-size:12.5px;color:#666;line-height:1.7">${l}</div></div>`;
  const cityName = id => { const c = (CARAVAN_DATA.cities || []).find(x => x.id === id); return c ? c.name : id; };
  const bars = (rows, f) => { const mx = Math.max(1, ...rows.map(r => r.n)); return rows.map(r => `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13px">
    <span style="min-width:110px">${f(r)}</span><span style="flex:1;height:10px;background:#eef3f0;border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:${Math.round(r.n / mx * 100)}%;background:#2e8b63"></i></span>
    <b style="min-width:44px;text-align:left">${stN(r.n)}</b></div>`).join(''); };
  el.innerHTML = `
  <details class="gd-det"><summary>ℹ️ این عددها یعنی چه؟</summary><div class="empty-msg" style="line-height:2;padding:6px 2px">
    هر گوشی یا رایانه‌ای که برنامه را باز کند یک «بازدیدکننده» حساب می‌شود (بدون نام یا شماره). «نصب‌شده» یعنی برنامه را به صفحه گوشی اضافه کرده و از آنجا باز کرده است.
    «کاربر واقعی» یعنی دست‌کم در دو روز مختلف برنامه را باز کرده — دقیق‌ترین عدد برای کسانی که واقعاً از برنامه استفاده می‌کنند.
    یک نفر با دو دستگاه (یا بعد از پاک کردن حافظه مرورگر) دو بار شمرده می‌شود، و پاک کردن برنامه از گوشی معلوم نمی‌شود.
    «آنلاین» یعنی در ۵ دقیقه اخیر برنامه روی صفحه‌اش باز بوده. این صفحه هر ۳۰ ثانیه خودش به‌روز می‌شود.
    ${d && d.since ? `<br>شمارش از ${new Date(d.since).toLocaleDateString('fa-IR')} شروع شده؛ کاربرانی که قبل از آن برنامه را داشتند، با اولین باز کردن دوباره شمرده می‌شوند.` : ''}</div></details>
  ${stErr ? `<div class="empty-msg" style="color:var(--red)">${escH(stErr)}</div>` : !d ? '<div class="empty-msg">در حال دریافت…</div>' : `
  <div style="display:flex;flex-wrap:wrap;gap:10px;margin:12px 0">
    ${box('🟢 ' + stN(d.online), 'الان آنلاین', '#1a9a4a')}
    ${box(stN(d.real_users), 'کاربر واقعی (دست‌کم ۲ روز مختلف)', '#1f6f50')}
    ${box(stN(d.inst_real), 'نصب کرده و دوباره برگشته')}
    ${box(stN(d.inst), 'نصب‌شده (کل)')}
  </div>
  ${stSec('more', '🔢 عددهای بیشتر (۸ عدد)', `  <div style="display:flex;flex-wrap:wrap;gap:10px;margin:12px 0">
    ${box(stN(d.total), 'همه بازدیدکننده‌ها (نصب‌شده یا از مرورگر)', '#555')}
    ${box(stN(d.inst_active), 'نصب‌شده و فعال در ۳۰ روز اخیر', '#555')}
    ${box(stN(d.inst_once), 'نصب کرده، فقط چند دقیقه همان روز', '#999')}
    ${box(stN(d.real_week), 'کاربر واقعی فعال در ۷ روز اخیر', '#555')}
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:10px;margin:12px 0">
    ${box(stN(d.today), 'کاربر در ۲۴ ساعت اخیر', '#555')}
    ${box(stN(d.week), 'کاربر در ۷ روز اخیر', '#555')}
    ${box(stN(d.new_today), 'کاربر جدید در ۲۴ ساعت اخیر', '#555')}
    ${box(stN(d.inst_today), 'نصب جدید در ۲۴ ساعت اخیر', '#555')}
  </div>`, false)}
  ${d.city.length ? stSec('city', '🕌 شهر انتخاب‌شده کاربران (۲۴ ساعت اخیر)', bars(d.city, r => escH(cityName(r.k)) + (r.online ? ` <small style="color:#1a9a4a">(${stN(r.online)} آنلاین)</small>` : '')), true) : ''}
  ${(d.country || []).length ? stSec('country', '🌍 کشور (از روی اینترنت کاربر)', bars(d.country, r => stCountry(r.k) + ` <small style="color:#1f6f50">(${stN(r.i)} نصب، ${stN(r.r)} کاربر واقعی)</small>`), false) : ''}
  ${(d.instGeo || []).length ? stSec('geo', '📍 محل نصب (تقریبی)', bars(d.instGeo, r => stGeo(r.k))) : ''}
  ${(d.country || []).length ? `<div class="empty-msg" style="padding:4px 0">موقعیت از روی IP و تقریبی است: اینترنت همراه معمولاً شهر مرکز اپراتور (مثلاً تهران یا بغداد) را نشان می‌دهد و با فیلترشکن کشور دیگری دیده می‌شود. خود IP ذخیره نمی‌شود. از امروز ثبت می‌شود.</div>` : ''}
  ${d.plat.length ? stSec('plat', '📱 نوع گوشی (۳۰ روز اخیر)', bars(d.plat, r => ST_PLAT[r.k] || r.k)) : ''}
  ${d.days.length ? stSec('days', '📈 کاربران جدید در ۱۴ روز اخیر', bars(d.days.slice().reverse(), r => new Date(r.d * 864e5).toLocaleDateString('fa-IR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) + ` <small style="color:#1f6f50">(${stN(r.i || 0)} نصب، ${stN(r.back || 0)} برگشته)</small>`), false) : ''}
  ${d.inst_evt ? `<div class="empty-msg" style="padding:6px 0">نصب‌هایی که مرورگر لحظه‌اش را خبر داده (از امروز به بعد): ${stN(d.inst_evt)}</div>` : ''}`}
  <button class="add-row-btn" onclick="statsLoad()">🔄 به‌روزرسانی</button>`;
}
