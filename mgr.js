/* ══════════════════════════════════════════
   MGR — «🧳 بخش ویژه‌ی مدیران کاروان»: ورود با تأیید شماره در بازوی بله (سرور: worker/mgr.js)
   زائر عادی چیزی از این بخش نمی‌بیند؛ فقط یک دکمه‌ی «ورود مدیران کاروان» در منوی «بیشتر» هست.
   بعد از ورود، نوار «بخش ویژه» در صفحه‌ی اول می‌آید. هر چند ساعت (اگر اینترنت باشد) اعتبار دوباره بررسی می‌شود.
══════════════════════════════════════════ */
const MGR_KEY = 'caravan-mgr';
let mgrPoll = null, mgrCode = '', mgrErr = '';

(function injectMgrCSS() {
  document.head.insertAdjacentHTML('beforeend', `<style>
  .mg-hero{padding:16px;border-radius:18px;background:var(--card);border:1px solid var(--border-s);line-height:2;font-size:calc(14px * var(--fs,1))}
  .mg-hero h3{margin:0 0 4px;font-size:calc(17px * var(--fs,1))}
  .mg-steps{margin:10px 0 0;padding-inline-start:20px;font-size:calc(13.5px * var(--fs,1));line-height:2.1}
  .mg-otp{display:flex;gap:8px;margin-top:8px}
  .mg-otp input{flex:1;min-width:0;min-height:52px;border-radius:14px;border:1px solid var(--border-s);background:var(--card2);color:var(--text);font-family:var(--font);
    font-size:22px;font-weight:900;text-align:center;letter-spacing:6px;direction:ltr}
  .mg-otp button{min-width:96px;border:none;border-radius:14px;background:var(--gold);color:#fff;font-family:var(--font);font-weight:900;font-size:calc(15px * var(--fs,1));cursor:pointer}
  .mg-wait{margin-top:12px;padding:12px;border-radius:14px;background:var(--gold-dim);border:1px solid var(--gold);text-align:center;font-weight:800;line-height:1.9}
  .mg-err{margin-top:12px;padding:12px;border-radius:14px;background:rgba(179,38,30,.10);border:1px solid rgba(179,38,30,.4);line-height:1.9;font-size:calc(13.5px * var(--fs,1))}
  .mg-me{display:flex;gap:12px;align-items:center;padding:14px;border-radius:18px;background:var(--gold-dim);border:1px solid var(--gold)}
  .mg-me .av{width:48px;height:48px;border-radius:50%;background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
  .mg-me b{display:block;font-size:calc(16px * var(--fs,1))}
  .mg-me small{color:var(--muted);font-size:calc(12.5px * var(--fs,1));line-height:1.8}
  .mg-soon{margin-top:12px;padding:14px;border-radius:16px;border:1px dashed var(--border-s);color:var(--muted);text-align:center;line-height:2;font-size:calc(13.5px * var(--fs,1))}
  .mgr-strip{display:flex;gap:10px;align-items:center;width:100%;margin-top:12px;padding:12px 14px;border-radius:var(--r);cursor:pointer;text-align:right;font-family:var(--font);
    border:1px solid var(--gold);background:var(--gold-dim);color:var(--text);font-size:calc(14px * var(--fs,1));font-weight:800;line-height:1.7}
  .mgr-strip > span:first-child{font-size:22px}
  </style>`);
})();

function mgrLoad() { try { const o = JSON.parse(localStorage.getItem(MGR_KEY) || 'null'); return o && /^[0-9a-f]{64}$/.test(o.token || '') ? o : null; } catch (e) { return null; } }
function mgrSave(o) { try { o ? localStorage.setItem(MGR_KEY, JSON.stringify(o)) : localStorage.removeItem(MGR_KEY); } catch (e) {} }
const isMgr = () => !!mgrLoad();
function mgrFetch(path, body) {
  const o = mgrLoad();
  return fetch(RV_API + path, { method: body ? 'POST' : 'GET', cache: 'no-store',
    headers: { 'X-Dev': rvDev(), ...(o ? { Authorization: 'mgr ' + o.token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
    .then(r => r.json().catch(() => ({})).then(j => { if (!r.ok) { const e = new Error(j.error || 'خطا در ارتباط با سرور'); e.status = r.status; throw e; } return j; }));
}

/* ── منوی «بیشتر» و صفحه‌ی اول ── */
function mgrMenuLabel() { return isMgr() ? '🧳 بخش ویژه‌ی مدیران کاروان' : '🔐 ورود مدیران کاروان'; }
function mgrStripHTML() {
  const o = mgrLoad(); if (!o) return '';
  return `<button class="mgr-strip" onclick="openMgr()"><span aria-hidden="true">🧳</span><span>بخش ویژه‌ی مدیران کاروان<br><small style="font-weight:700;color:var(--muted)">${escHtml(o.me && o.me.name || '')}</small></span></button>`;
}

/* ── صفحه ── */
function openMgr() {
  if (typeof closeMore === 'function') try { closeMore(); } catch (e) {}
  mgrErr = '';
  openPage(isMgr() ? '🧳 بخش ویژه‌ی مدیران کاروان' : '🔐 ورود مدیران کاروان', '<div id="mgBody"></div>');
  mgrRender();
  if (isMgr()) mgrCheck(true);
}
function mgrRender() {
  const box = document.getElementById('mgBody'); if (!box) return;
  const o = mgrLoad();
  if (o) {
    const m = o.me || {};
    box.innerHTML = `<div class="mg-me"><div class="av">🧳</div><div><b>${escHtml(m.name || '')}</b>
        <small>${[m.role, m.company, mgrCity(m.city)].filter(Boolean).map(escHtml).join(' · ') || 'مدیر کاروان'}${m.until ? `<br>دسترسی تا ${escHtml(mgrDate(m.until))}` : ''}</small></div></div>
      <div class="mg-soon">🛠️ بخش‌های ویژه‌ی مدیران (مثل شرکت‌های مجری و شماره‌ی نمایندگانشان) به‌زودی همین‌جا اضافه می‌شود.</div>
      <button class="lost-btn alt" onclick="mgrLogout()">🚪 خروج از بخش مدیران روی این گوشی</button>`;
    return;
  }
  const waiting = !!mgrPoll;
  box.innerHTML = `<div class="mg-hero"><h3>این بخش مخصوص مدیران کاروان و عوامل اجرایی است</h3>
      ورود با شماره‌ی موبایلی است که ستاد برای شما ثبت کرده؛ رمز لازم نیست.
      <ol class="mg-steps"><li>دکمه‌ی زیر را بزنید تا بازوی بله‌ی «همیار کاروان» باز شود.</li>
        <li>در بله دکمه‌ی <b>«📱 ارسال شماره من»</b> را بزنید.</li>
        <li>به همین برنامه برگردید؛ بخش ویژه خودش باز می‌شود. اگر نشد، کد ۶ رقمی بازو را پایین وارد کنید.</li></ol></div>
    <button class="lost-btn" onclick="mgrStart(this)">📩 ورود با بازوی بله</button>
    ${waiting ? '<div class="mg-wait">⏳ منتظر تأیید در بله…<br><small>بعد از فرستادن شماره در بله، به این صفحه برگردید.</small></div>' : ''}
    ${mgrErr ? `<div class="mg-err">${mgrErr}</div>` : ''}
    <div class="st-lbl" style="margin-top:16px">کد ۶ رقمی (اگر بازو کد داد یا ستاد کد به شما گفت)</div>
    <div class="mg-otp"><input id="mgOtp" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="------" onkeydown="if(event.key==='Enter')mgrOtp()"><button onclick="mgrOtp(this)">ورود</button></div>
    <ul class="st-tips"><li>اگر بله ندارید، با ستاد تماس بگیرید تا یک کد یک‌بارمصرف به شما بدهند.</li>
      <li>اگر بازو گفت شماره‌تان در فهرست نیست، از ستاد بخواهید شماره‌تان را ثبت کنند.</li>
      <li>این بخش روی حداکثر ۲ گوشی برای هر شماره فعال می‌شود.</li></ul>`;
}
const mgrCity = id => { const c = id && (CARAVAN_DATA.cities || []).find(x => x.id === id); return c ? c.name : ''; };
const mgrDate = t => { try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Baghdad' }).format(t); } catch (e) { return ''; } };

async function mgrStart(btn) {
  mgrErr = '';
  if (btn) { btn.disabled = true; btn.textContent = 'در حال باز کردن بله…'; }
  try {
    const r = await mgrFetch('/mgr/link', {});
    mgrCode = r.code;
    /* اگر برنامه هنگام رفتن به بله بسته شد، بعد از برگشت انتظار ادامه پیدا کند */
    try { localStorage.setItem('caravan-mgr-wait', JSON.stringify({ code: r.code, exp: Date.now() + 15 * 6e4 })); } catch (e) {}
    window.open(r.url, '_blank', 'noopener');
    mgrWatch();
  } catch (e) { mgrErr = escHtml(navigator.onLine === false ? 'اینترنت وصل نیست؛ برای ورود، اینترنت لازم است.' : e.message || 'اتصال برقرار نشد.'); }
  mgrRender();
}
function mgrWatch() {
  clearInterval(mgrPoll);
  const until = Date.now() + 15 * 6e4;
  mgrPoll = setInterval(async () => {
    if (Date.now() > until || !mgrCode) { mgrStop(); mgrRender(); return; }
    if (document.hidden) return;
    try {
      const r = await mgrFetch('/mgr/status', { code: mgrCode });
      if (r.ok) mgrIn(r);
      else if (r.denied) { mgrStop(); mgrErr = '❌ شماره‌ی شما در فهرست مدیران کاروان نیست. از ستاد بخواهید شماره‌تان را ثبت کنند.'; mgrRender(); }
      else if (r.expired) { mgrStop(); mgrRender(); }
    } catch (e) {}
  }, 3000);
}
function mgrStop() { clearInterval(mgrPoll); mgrPoll = null; mgrCode = ''; try { localStorage.removeItem('caravan-mgr-wait'); } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (!document.hidden && mgrPoll && mgrCode) mgrFetch('/mgr/status', { code: mgrCode }).then(r => r.ok && mgrIn(r)).catch(() => {}); });

async function mgrOtp(btn) {
  const inp = document.getElementById('mgOtp'), v = (inp && inp.value || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '');
  if (v.length !== 6) return showToast('کد ۶ رقمی را کامل وارد کنید');
  if (btn) btn.disabled = true;
  try { mgrIn(await mgrFetch('/mgr/otp', { otp: v })); }
  catch (e) { mgrErr = escHtml(e.message); mgrRender(); }
}
function mgrIn(r) {
  mgrStop();
  mgrSave({ token: r.token, me: r.me, at: Date.now() });
  showToast('✅ وارد بخش ویژه‌ی مدیران شدید', 4000);
  const t = document.getElementById('pvTitle');
  if (t && document.getElementById('mgBody')) t.textContent = '🧳 بخش ویژه‌ی مدیران کاروان';
  mgrRender(); mgrRefreshUI();
}
async function mgrLogout() {
  if (!confirm('بخش مدیران روی این گوشی بسته شود؟ (برای ورود دوباره باید از بله تأیید بگیرید)')) return;
  try { await mgrFetch('/mgr/logout', {}); } catch (e) {}
  mgrSave(null); mgrRender(); mgrRefreshUI();
}
function mgrRefreshUI() {
  const b = document.getElementById('moreMgr'); if (b) b.innerHTML = `<span aria-hidden="true">${isMgr() ? '🧳' : '🔐'}</span>${isMgr() ? 'بخش ویژه‌ی مدیران کاروان' : 'ورود مدیران کاروان'}`;
  if (typeof renderHome === 'function') try { renderHome(); } catch (e) {}
}
/* بررسی اعتبار: اگر شماره از فهرست حذف شده یا تاریخش گذشته، بخش ویژه از این گوشی پاک می‌شود */
async function mgrCheck(force) {
  const o = mgrLoad(); if (!o || !navigator.onLine) return;
  if (!force && Date.now() - (o.checked || 0) < 6 * 36e5) return;
  try {
    const r = await mgrFetch('/mgr/me');
    mgrSave({ ...o, me: r.me, checked: Date.now() });
  } catch (e) {
    if (e.status === 401) { mgrSave(null); showToast('دسترسی بخش مدیران روی این گوشی تمام شده است', 6000); mgrRender(); }
  }
  mgrRefreshUI();
}
setTimeout(() => {
  mgrRefreshUI(); mgrCheck(false);
  /* انتظار نیمه‌کاره (برنامه هنگام رفتن به بله بسته شده بود) */
  try { const w = JSON.parse(localStorage.getItem('caravan-mgr-wait') || 'null'); if (w && w.exp > Date.now() && !isMgr()) { mgrCode = w.code; mgrWatch(); mgrFetch('/mgr/status', { code: mgrCode }).then(r => { if (r.ok) { mgrIn(r); openMgr(); } }).catch(() => {}); } } catch (e) {}
}, 2500);
