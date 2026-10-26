/* ══════════════════════════════════════════
   REVIEWS — نظرهای زائران درباره هتل‌ها (سرور: worker/reviews.js)
   نظرها خودکار کنترل می‌شوند؛ اینجا مدیر نظرهای پنهان‌شده را می‌بیند و می‌تواند برگرداند یا کامل حذف کند.
══════════════════════════════════════════ */
const RV_API = 'https://hamyar-reviews.hamyar-karevan.workers.dev';
let rvaMode = 'hidden', rvaItems = null, rvaErr = '';

function rvaApi(path, body) {
  return fetch(RV_API + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'token ' + ghToken, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
    .then(r => r.json().catch(() => ({})).then(j => { if (!r.ok) throw new Error(j.error || 'خطا در ارتباط با سرور نظرها'); return j; }));
}
function rvaHotel(h) {
  const [c, id] = h.split('/'), city = (CARAVAN_DATA.cities || []).find(x => x.id === c);
  const ho = city && (city.hotels || []).find(x => x.id === id);
  return (ho ? ho.name : id) + ' — ' + ((city && city.name) || c);
}
function rvaLoad(mode) {
  if (mode) rvaMode = mode;
  rvaItems = null; rvaErr = ''; renderReviewsAdmin();
  if (!ghToken) { rvaErr = 'اول وارد پنل شوید.'; renderReviewsAdmin(); return; }
  rvaApi('/admin/list?mode=' + rvaMode).then(d => { rvaItems = d.items || []; renderReviewsAdmin(); })
    .catch(e => { rvaErr = e.message; renderReviewsAdmin(); });
}
function rvaSet(id, action) {
  if (action === 'delete' && !confirm('این نظر برای همیشه حذف شود؟')) return;
  rvaApi('/admin/set', { id, action }).then(() => {
    showToast(action === 'show' ? 'نظر دوباره نمایش داده می‌شود' : action === 'hide' ? 'نظر پنهان شد' : 'نظر حذف شد');
    rvaLoad();
  }).catch(e => alert(e.message));
}
function renderReviewsAdmin() {
  const el = document.getElementById('reviews-admin');
  if (!el) return;
  const tab = (m, l) => `<button class="add-row-btn" style="margin:0;flex:1;${rvaMode === m ? 'background:var(--gold);color:#fff' : ''}" onclick="rvaLoad('${m}')">${l}</button>`;
  const st = n => n ? '★'.repeat(n) + '☆'.repeat(5 - n) : 'بدون امتیاز';
  el.innerHTML = `
  <div class="info-box"><strong>💬 نظر زائران درباره هتل‌ها</strong>
    زائران در صفحه هر هتل ستاره می‌دهند و نظر می‌نویسند. نظرها فوراً نمایش داده می‌شوند و خودکار کنترل می‌شوند:
    نظر دارای کلمه رکیک، لینک یا شماره تلفن اصلاً ثبت نمی‌شود؛ نظر توهین‌آمیز یا نامربوط را هوش مصنوعی پنهان می‌کند؛ نظری که ۳ نفر گزارش کنند پنهان می‌شود.
    لازم نیست هر روز اینجا را ببینید — فقط اگر خواستید، نظرهای پنهان‌شده را بررسی کنید.</div>
  <div style="display:flex;gap:8px;margin:12px 0">${tab('hidden', '🙈 نظرهای پنهان‌شده')}${tab('recent', '🕒 همه نظرهای اخیر')}</div>
  ${rvaErr ? `<div class="empty-msg" style="color:var(--red)">${escH(rvaErr)}</div>`
    : !rvaItems ? '<div class="empty-msg">در حال دریافت…</div>'
    : !rvaItems.length ? `<div class="empty-msg">${rvaMode === 'hidden' ? 'هیچ نظر پنهان‌شده‌ای نیست 👍' : 'هنوز نظری ثبت نشده است.'}</div>`
    : rvaItems.map(r => `<div class="lay-slide" style="${r.hidden && rvaMode === 'recent' ? 'opacity:.6' : ''}">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:13px"><b>🏨 ${escH(rvaHotel(r.h))}${r.name ? ' · 👤 ' + escH(r.name) : ''}</b><span style="color:#e0a100;direction:ltr">${st(r.stars)}</span></div>
      <div style="line-height:1.9;font-size:14px;white-space:pre-wrap">${escH(r.text) || '<i style="color:#999">(فقط امتیاز، بدون متن)</i>'}</div>
      <div style="font-size:12px;color:#888">${new Date(r.ts).toLocaleString('fa-IR')}${r.why ? ' · ' + escH(r.why) : ''}${r.reports > 0 ? ' · ' + r.reports.toLocaleString('fa') + ' گزارش' : ''}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${r.hidden ? `<button class="add-row-btn" style="margin:0;width:auto;flex:1" onclick="rvaSet(${r.id},'show')">👁 نمایش دوباره (نظر سالم است)</button>`
          : `<button class="add-row-btn" style="margin:0;width:auto;flex:1" onclick="rvaSet(${r.id},'hide')">🙈 پنهان کن</button>`}
        <button class="del-btn" style="width:auto;height:auto;min-height:40px;padding:0 12px" onclick="rvaSet(${r.id},'delete')">🗑 حذف کامل</button>
      </div></div>`).join('')}
  <button class="add-row-btn" onclick="rvaLoad()">🔄 به‌روزرسانی</button>`;
}
