/* ══════════════════════════════════════════
   BALE — «اطلاعیه‌ها در بله»: زائر با رضایت خودش در بازوی @HamyarKaravan_Bot شماره‌اش را می‌فرستد
   (سرور: worker/bale.js). برنامه فقط یک کد یک‌بارمصرف می‌گیرد و بازو را باز می‌کند؛ شماره را خود بله تأیید می‌کند.
══════════════════════════════════════════ */
const BALE_KEY = 'caravan-bale';  /* '1' = عضو شده، 'no' = نوار صفحه اول را بسته */
let baleTimer = null;
const baleState = () => { try { return localStorage.getItem(BALE_KEY) || ''; } catch (e) { return ''; } };
const baleSet = v => { try { localStorage.setItem(BALE_KEY, v); } catch (e) {} };

/* نوار کوچک صفحه اول (فقط برای کسی که هنوز عضو نشده و نبسته؛ از روز دوم استفاده) */
/* نمایش آزمایشی برای مدیر (که خودش عضو است): آدرس برنامه با ?test=bale — چیزی ذخیره نمی‌شود */
const BALE_TEST = /[?&]test=bale\b/.test(location.search);
function baleStripHTML() {
  if (BALE_TEST) return baleStrip();
  if (baleState() || SHOW_HIDDEN) return '';
  let first = 0; try { first = +localStorage.getItem('caravan-first-open') || 0; if (!first) localStorage.setItem('caravan-first-open', Date.now()); } catch (e) {}
  if (!first || Date.now() - first < 864e5) return '';
  return baleStrip();
}
function baleStrip() {
  return `<div class="notices"><div class="ntc" role="button" style="cursor:pointer" onclick="openBale()">
    <span class="ntc-ic" aria-hidden="true">${ico('bell')}</span>
    <div class="ntc-body"><b>اطلاعیه‌های فوری را در «بله» بگیرید</b><div class="ntc-meta"><span>هشدارها، تغییر ساعت‌ها و یادآوری‌های سفر</span></div></div>
    <button class="ntc-x" onclick="event.stopPropagation();if(!BALE_TEST)baleSet('no');this.closest('.notices').remove()" aria-label="بستن">${ico('x')}</button></div></div>`;
}
function openBale() {
  if (typeof closeMore === 'function') closeMore();
  const on = baleState() === '1' && !BALE_TEST;
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
      if (s && s.linked) { clearInterval(baleTimer); if (!BALE_TEST) baleSet('1'); openBale(); showToast('✅ عضویت در بله ثبت شد'); }
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

/* ── پنجره‌ی دعوت به بله در شروع برنامه (پاپ‌آپ) ──
   برای کسی که عضو نیست: در شروع یک نوبتِ استفاده، بعد از صفحه‌ی خوش‌آمد. حداکثر ۳ بار؛ «بعداً» = دو روز بعد؛ «دیگر نشان نده» = تمام.
   در پیش‌نمایش/دستگاه مدیر نمی‌آید (مگر با ?test=bale)، بدون اینترنت هم نمی‌آید. */
const BALE_POP = 'caravan-bale-pop', BALE_POP_MAX = 3;
function balePopState() { try { return JSON.parse(localStorage.getItem(BALE_POP) || '{}'); } catch (e) { return {}; } }
function balePopDue() {
  if (BALE_TEST) return true;
  if (baleState() || SHOW_HIDDEN || navigator.onLine === false) return false;
  try { if (sessionStorage.getItem(BALE_POP)) return false; } catch (e) {}
  const s = balePopState();
  return (s.n || 0) < BALE_POP_MAX && Date.now() >= (s.next || 0);
}
function balePopShow() {
  /* اگر نسخه‌ی تازه‌ی برنامه در حال نصب است، صفحه الان یک بار خودش تازه می‌شود؛ بعد از آن نشان می‌دهیم */
  if (!balePopDue() || document.querySelector('.overlay.open') || window.__swUpdating) return;
  document.body.insertAdjacentHTML('beforeend', `<div class="overlay open" id="balePop" role="dialog" aria-modal="true" aria-labelledby="balePopT" onclick="if(event.target===this)balePopClose()">
    <div class="modal bale-pop">
      <div class="modal-handle" aria-hidden="true"></div>
      <div class="bp-ic" aria-hidden="true">${ico('bell')}</div>
      <div class="modal-title" id="balePopT">اطلاعیه‌های فوری سفر را در «بله» بگیرید</div>
      <ul class="bp-list"><li>هشدارها و بسته شدن مسیرها و ورودی‌ها</li><li>تغییر ساعت‌ها و برنامه‌ها</li><li>یادآوری‌های مهم سفر</li></ul>
      <button class="rv-btn" style="min-height:52px;width:100%" onclick="balePopClose();openBale();baleJoin()">📩 عضویت در بله</button>
      <button class="modal-close" style="margin-top:10px" onclick="balePopClose()">بعداً</button>
      <button class="bp-never" onclick="balePopClose(true)">دیگر نشان نده</button>
      <p class="bp-note">رایگان است؛ فقط یک بار در بله «📱 ارسال شماره من» را می‌زنید و هر وقت بخواهید با نوشتن «لغو» خارج می‌شوید.</p>
    </div></div>
  <style>
    .bale-pop{text-align:center}
    .bp-ic{width:56px;height:56px;margin:0 auto 10px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:var(--gold-dim);color:var(--gold)}
    .bp-ic svg{width:28px;height:28px}
    .bp-list{list-style:none;padding:0;margin:0 0 16px;display:flex;flex-direction:column;gap:6px;font-size:calc(14px * var(--fs,1));color:var(--text);line-height:1.8}
    .bp-list li::before{content:'✓ ';color:var(--gold);font-weight:900}
    .bp-never{display:block;margin:8px auto 0;background:none;border:none;color:var(--muted);font-family:var(--font);font-size:calc(12.5px * var(--fs,1));text-decoration:underline;cursor:pointer;padding:8px}
    .bp-note{font-size:calc(12px * var(--fs,1));color:var(--muted);line-height:1.8;margin:6px 0 0}
  </style>`);
}
/* نمایش فقط وقتی شمرده می‌شود که کاربر پنجره را بسته (اگر صفحه وسطش تازه شد، دوباره و درست نشان داده می‌شود) */
function balePopClose(never) {
  const v = document.getElementById('balePop'); if (!v) return;
  v.remove();
  if (BALE_TEST) return;
  try { sessionStorage.setItem(BALE_POP, '1'); } catch (e) {}
  const st = balePopState(); try { localStorage.setItem(BALE_POP, JSON.stringify({ n: (st.n || 0) + 1, next: Date.now() + 2 * 864e5 })); } catch (e) {}
  if (never) baleSet('no');
}
/* بعد از صفحه‌ی خوش‌آمد (اگر هست) و کمی مکث، تا کاربر اول برنامه را ببیند */
(function balePopWait(t0) {
  const go = () => setTimeout(balePopShow, 1200);
  const tick = () => { if (document.getElementById('splash') && Date.now() - t0 < 9000) return setTimeout(tick, 300); go(); };
  if (document.readyState === 'complete') setTimeout(tick, 800); else window.addEventListener('load', () => setTimeout(tick, 800));
})(Date.now());
