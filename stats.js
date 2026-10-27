/* ══════════════════════════════════════════
   STATS — شمارش کاربران برای پنل مدیر (چند نفر نصب کرده‌اند، چند نفر الان آنلاین‌اند)
   فقط یک شناسه تصادفی گوشی (همان شناسه نظرها، روی سرور هش می‌شود)، نوع گوشی و شهر انتخاب‌شده فرستاده می‌شود؛ هیچ اطلاعات شخصی نه.
   تا وقتی برنامه باز و جلوی چشم است، هر ۲ دقیقه یک بار خبر می‌دهد.
══════════════════════════════════════════ */
const ST_PING_MS = 2 * 6e4;
let stLastPing = 0;

function stPlat() {
  const u = navigator.userAgent;
  return /android/i.test(u) ? 'android' : /iphone|ipad|ipod/i.test(u) || (/macintosh/i.test(u) && navigator.maxTouchPoints > 1) ? 'ios'
    : /windows|macintosh|linux|cros/i.test(u) ? 'desktop' : 'other';
}
function stPing() {
  if (typeof PREVIEW !== 'undefined' && PREVIEW) return;
  if (/^(localhost|127\.)/.test(location.hostname) || document.visibilityState !== 'visible' || navigator.onLine === false) return;
  if (Date.now() - stLastPing < ST_PING_MS - 5000) return;
  stLastPing = Date.now();
  const inst = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let city = '';
  try { city = (homeCity() || {}).id || ''; } catch (e) {}
  fetch(RV_API + '/ping', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dev': rvDev() }, body: JSON.stringify({ inst: inst ? 1 : 0, plat: stPlat(), city }), keepalive: true }).catch(() => {});
}
setTimeout(stPing, 3000);
setInterval(stPing, ST_PING_MS);
document.addEventListener('visibilitychange', () => setTimeout(stPing, 1000));
