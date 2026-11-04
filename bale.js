/* ══════════════════════════════════════════
   BALE — «اطلاعیه‌ها در بله»: زائر با رضایت خودش در بازوی @HamyarKaravan_Bot شماره‌اش را می‌فرستد
   (سرور: worker/bale.js). برنامه فقط یک کد یک‌بارمصرف می‌گیرد و بازو را باز می‌کند؛ شماره را خود بله تأیید می‌کند.
══════════════════════════════════════════ */
const BALE_KEY = 'caravan-bale';  /* '1' = عضو شده، 'no' = نوار صفحه اول را بسته */
let baleTimer = null;
const baleState = () => { try { return localStorage.getItem(BALE_KEY) || ''; } catch (e) { return ''; } };
const baleSet = v => { try { localStorage.setItem(BALE_KEY, v); } catch (e) {} };

/* نوار کوچک صفحه اول (فقط برای کسی که هنوز عضو نشده و نبسته؛ از روز دوم استفاده) */
function baleStripHTML() {
  if (baleState() || SHOW_HIDDEN) return '';
  let first = 0; try { first = +localStorage.getItem('caravan-first-open') || 0; if (!first) localStorage.setItem('caravan-first-open', Date.now()); } catch (e) {}
  if (!first || Date.now() - first < 864e5) return '';
  return `<div class="notices"><div class="ntc" role="button" style="cursor:pointer" onclick="openBale()">
    <span class="ntc-ic" aria-hidden="true">${ico('bell')}</span>
    <div class="ntc-body"><b>اطلاعیه‌های فوری را در «بله» بگیرید</b><div class="ntc-meta"><span>هشدارها، تغییر ساعت‌ها و یادآوری‌های سفر</span></div></div>
    <button class="ntc-x" onclick="event.stopPropagation();baleSet('no');this.closest('.notices').remove()" aria-label="بستن">${ico('x')}</button></div></div>`;
}
function openBale() {
  if (typeof closeMore === 'function') closeMore();
  const on = baleState() === '1';
  openPage('اطلاعیه‌ها در بله', `
    <div class="cx-rate" style="line-height:2">
      ${on ? '✅ <b>شما عضو هستید.</b> اطلاعیه‌های مهم همیار کاروان را در بله دریافت می‌کنید.' : `با عضویت در بازوی بله <b dir="ltr">@HamyarKaravan_Bot</b>، اطلاعیه‌های مهم سفر را مستقیم در پیام‌رسان بله می‌گیرید:
      <br>• هشدارها و بسته شدن مسیرها و ورودی‌ها
      <br>• تغییر ساعت‌ها و برنامه‌ها
      <br>• یادآوری‌های مهم سفر`}</div>
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
      <button class="rv-btn" style="min-height:52px" id="baleGo" onclick="baleJoin()">${on ? 'باز کردن بازو در بله' : '📩 عضویت در بله'}</button>
      <div id="baleMsg" class="rv-note" style="text-align:center"></div>
    </div>
    <p class="cx-note">در بله، دکمه «📱 ارسال شماره من» را بزنید. شماره شما فقط برای اطلاع‌رسانی همیار کاروان استفاده می‌شود و هر وقت بخواهید با نوشتن «لغو» در بازو، اشتراکتان لغو می‌شود.</p>`);
}
async function baleJoin() {
  const btn = document.getElementById('baleGo'), msg = document.getElementById('baleMsg');
  btn.disabled = true; msg.textContent = 'در حال آماده‌سازی…';
  try {
    const r = await rvFetch('/bale/link', {});
    window.open(r.url, '_blank', 'noopener');
    msg.textContent = 'در بله، «شروع» و بعد «📱 ارسال شماره من» را بزنید؛ سپس به همین‌جا برگردید.';
    clearInterval(baleTimer);
    let n = 0;
    baleTimer = setInterval(async () => {
      if (++n > 60 || !document.getElementById('baleMsg')) return clearInterval(baleTimer);
      if (document.visibilityState !== 'visible') return;
      const s = await rvFetch('/bale/status').catch(() => null);
      if (s && s.linked) { clearInterval(baleTimer); baleSet('1'); openBale(); showToast('✅ عضویت در بله ثبت شد'); }
    }, 4000);
  } catch (e) { msg.textContent = navigator.onLine === false ? 'اینترنت وصل نیست.' : e.message; }
  btn.disabled = false;
}
/* اگر از راه دیگری عضو شده باشد (یا لغو کرده) وضعیت را یک بار در روز تازه می‌کنیم */
setTimeout(() => {
  let t = 0; try { t = +localStorage.getItem('caravan-bale-chk') || 0; } catch (e) {}
  if (Date.now() - t < 864e5 || navigator.onLine === false) return;
  rvFetch('/bale/status').then(s => { try { localStorage.setItem('caravan-bale-chk', Date.now()); } catch (e) {} if (s.linked) baleSet('1'); else if (baleState() === '1') baleSet(''); }).catch(() => {});
}, 5000);
