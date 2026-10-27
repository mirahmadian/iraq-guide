/* ══════════════════════════════════════════
   STATS — آمار کاربران (سرور: worker/reviews.js ← /admin/stats ، برنامه: stats.js)
══════════════════════════════════════════ */
let stData = null, stErr = '', stTimer = null;
const stN = n => (+n || 0).toLocaleString('fa');
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
  <div class="info-box"><strong>📊 آمار کاربران</strong>
    هر گوشی که برنامه را باز کند یک کاربر حساب می‌شود (بدون نام یا شماره). «نصب‌شده» یعنی برنامه را به صفحه گوشی اضافه کرده و از آنجا باز کرده است.
    «آنلاین» یعنی در ۵ دقیقه اخیر برنامه روی صفحه‌اش باز بوده. این صفحه هر ۳۰ ثانیه خودش به‌روز می‌شود.
    ${d && d.since ? `<br>شمارش از ${new Date(d.since).toLocaleDateString('fa-IR')} شروع شده؛ کاربرانی که قبل از آن برنامه را داشتند، با اولین باز کردن دوباره شمرده می‌شوند.` : ''}</div>
  ${stErr ? `<div class="empty-msg" style="color:var(--red)">${escH(stErr)}</div>` : !d ? '<div class="empty-msg">در حال دریافت…</div>' : `
  <div style="display:flex;flex-wrap:wrap;gap:10px;margin:12px 0">
    ${box('🟢 ' + stN(d.online), 'الان آنلاین', '#1a9a4a')}
    ${box(stN(d.inst), 'نصب‌شده (کل)')}
    ${box(stN(d.inst_active), 'نصب‌شده و فعال در ۳۰ روز اخیر')}
    ${box(stN(d.total), 'همه کاربران (نصب‌شده یا از مرورگر)')}
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:10px;margin:12px 0">
    ${box(stN(d.today), 'کاربر در ۲۴ ساعت اخیر', '#555')}
    ${box(stN(d.week), 'کاربر در ۷ روز اخیر', '#555')}
    ${box(stN(d.new_today), 'کاربر جدید در ۲۴ ساعت اخیر', '#555')}
    ${box(stN(d.inst_today), 'نصب جدید در ۲۴ ساعت اخیر', '#555')}
  </div>
  ${d.city.length ? `<div class="field-label">شهر انتخاب‌شده کاربران (۲۴ ساعت اخیر)</div>${bars(d.city, r => escH(cityName(r.k)) + (r.online ? ` <small style="color:#1a9a4a">(${stN(r.online)} آنلاین)</small>` : ''))}` : ''}
  ${d.plat.length ? `<div class="field-label" style="margin-top:14px">نوع گوشی (۳۰ روز اخیر)</div>${bars(d.plat, r => ST_PLAT[r.k] || r.k)}` : ''}
  ${d.days.length ? `<div class="field-label" style="margin-top:14px">کاربران جدید در ۱۴ روز اخیر</div>${bars(d.days.slice().reverse(), r => new Date(r.d * 864e5).toLocaleDateString('fa-IR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) + (r.i ? ` <small style="color:#1f6f50">(${stN(r.i)} نصب)</small>` : ''))}` : ''}`}
  <button class="add-row-btn" onclick="statsLoad()">🔄 به‌روزرسانی</button>`;
}
