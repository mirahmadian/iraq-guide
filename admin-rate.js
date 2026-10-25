/* ══════════════════════════════════════════
   RATE — نرخ دینار برای مبدل ارز برنامه
   نرخ خودکار هر ۳ ساعت از tgju.org در rate.json ذخیره می‌شود (GitHub Actions)؛
   مدیر فقط در صورت نیاز نرخ دستی وارد می‌کند (تومان برای هر ۱۰۰۰ دینار).
══════════════════════════════════════════ */
let rateManual = '';
function initRate() {
  rateManual = String((((CARAVAN_DATA.site || {}).rate) || {}).manual || '');
  renderRate();
  fetch('rate.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => renderRate(j)).catch(() => renderRate(null));
}
function renderRate(auto) {
  const el = document.getElementById('rate-editor');
  if (!el) return;
  const fa = n => (+n || 0).toLocaleString('fa', { maximumFractionDigits: 0 });
  el.innerHTML = `
    <div class="field"><div class="field-label">نرخ خودکار (بازار آزاد، از سایت tgju.org — هر ۳ ساعت به‌روز می‌شود)</div>
      <div class="empty-msg" style="padding:0;font-style:normal">${auto === undefined ? '…' : auto && auto.iqd_rial
        ? `هر ۱٬۰۰۰ دینار ≈ <b>${fa(auto.iqd_rial * 100)} تومان</b> — تاریخ نرخ: ${escH(auto.date_fa || auto.date || '')}`
        : '⚠️ نرخ خودکار در دسترس نیست — نرخ دستی را وارد کنید'}</div></div>
    <div class="field"><div class="field-label">نرخ دستی (اختیاری) — تومان برای هر ۱٬۰۰۰ دینار</div>
      <input type="text" class="input-full" inputmode="numeric" dir="ltr" style="max-width:220px" placeholder="خالی = نرخ خودکار" value="${escH(rateManual)}"
        oninput="rateManual=this.value">
      <div class="empty-msg" style="padding:6px 0 0">فقط اگر می‌خواهید نرخ دیگری (مثلاً نرخ صرافی‌های عراق) نشان داده شود پر کنید. تا وقتی پر باشد، نرخ خودکار استفاده نمی‌شود.</div></div>`;
}
function rateOut() {
  const m = +toEnA(rateManual).replace(/[^\d.]/g, '') || 0;
  return m > 0 ? { rate: { manual: m } } : {};
}
