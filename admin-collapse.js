/* ══════════════════════════════════════════
   📂 بخش‌های جمع‌شونده‌ی پنل مدیریت
   • هر کارت (sec-card) که دکمه‌ی باز/بسته نداشت یا با toggleCard باز و بسته می‌شد، با زدن سرتیترش باز و بسته می‌شود
   • حالت باز/بسته هر کارت روی همین دستگاه به یاد می‌ماند (localStorage: admin-cards-v1)؛ اگر هنوز انتخابی نشده،
     فقط اولین کارت هر تب (در تب «عمومی»: اولین کارت هر دسته) باز است
   • بالای هر تبی که ۳ کارت یا بیشتر دارد دکمه‌ی «جمع کردن همه / باز کردن همه» هست
   • کارت‌هایی که خودشان حالتشان را نگه می‌دارند (غذا، راهنما، زیارت‌نامه…) دست نمی‌خورند؛ فقط دکمه‌ی «همه» با زدن سرتیترشان کار می‌کند
   • برای کارت‌هایی که بعداً با جاوااسکریپت ساخته یا دوباره ساخته می‌شوند هم خودکار اعمال می‌شود (MutationObserver)
   • ccGet(key, پیش‌فرض) / ccSet(key, مقدار): همان حافظه برای بخش‌های داخل کارت‌ها (مثل نمودارهای آمار)
══════════════════════════════════════════ */
const CC_KEY = 'admin-cards-v1';
let ccS = {};
try { ccS = JSON.parse(localStorage.getItem(CC_KEY) || '{}') || {}; } catch (e) { ccS = {}; }
const ccSave = () => { try { localStorage.setItem(CC_KEY, JSON.stringify(ccS)); } catch (e) {} };
window.ccGet = (k, d) => (k in ccS ? !!ccS[k] : d);
window.ccSet = (k, v) => { ccS[k] = v ? 1 : 0; ccSave(); };

/* 'nt' = بدون دکمه، 'tc' = با toggleCard؛ بقیه (کارت‌های خودمدیریت) null */
function ccKind(c) {
  if (c.tagName === 'DETAILS') return null;
  const h = c.querySelector(':scope > .sec-card-head'); if (!h) return null;
  if (h.classList.contains('no-toggle')) return 'nt';
  return /^\s*toggleCard\(/.test(h.getAttribute('onclick') || '') ? 'tc' : null;
}
const ccTitle = c => ((c.querySelector(':scope > .sec-card-head .sec-head-title') || c).textContent || '').trim().slice(0, 60);
const ccId = c => c.dataset.cc || c.id || ccTitle(c);
function ccFirst(c) {
  const page = c.closest('.page'), grp = c.dataset.grp || '';
  if (!page) return false;
  return [...page.querySelectorAll('.sec-card')].find(x => (x.dataset.cc || ccKind(x)) && (x.dataset.grp || '') === grp) === c;
}
function ccSync(c) {
  const h = c.querySelector(':scope > .sec-card-head'); if (h) h.setAttribute('aria-expanded', c.classList.contains('open') ? 'true' : 'false');
}
function ccToggle(c) {
  c.classList.toggle('open'); ccSet(c.dataset.cc, c.classList.contains('open')); ccSync(c);
}
function ccEnhance(c) {
  if (c.dataset.cc) return;
  const kind = ccKind(c); if (!kind) return;
  const h = c.querySelector(':scope > .sec-card-head'), body = c.querySelector(':scope > .sec-body'), page = c.closest('.page');
  c.dataset.cc = c.id || ((page && page.id || '') + ':' + ccTitle(c));
  if (kind === 'nt') {
    h.classList.remove('no-toggle');
    if (!h.querySelector('.sec-chevron')) h.insertAdjacentHTML('beforeend', '<span class="sec-chevron">▼</span>');
    if (body) body.style.removeProperty('display');
    h.onclick = () => ccToggle(c);
  }
  h.setAttribute('role', 'button'); h.setAttribute('tabindex', '0');
  h.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === h) { e.preventDefault(); h.click(); } });
  const open = c.dataset.cc in ccS ? !!ccS[c.dataset.cc] : ccFirst(c);
  c.classList.toggle('open', open); ccSync(c);
}
/* همان تابع قدیمی که کارت‌های استاتیک با onclick صدا می‌زنند */
const ccToggleCard = key => {
  const c = document.getElementById('card-' + key); if (!c) return;
  if (c.dataset.cc) ccToggle(c); else c.classList.toggle('open');
};

/* دکمه‌ی «همه» بالای تب‌ها */
const CC_SKIP = new Set(['tab-help', 'tab-users', 'tab-reviews']);
function ccBars() {
  document.querySelectorAll('.page').forEach(p => {
    const n = [...p.querySelectorAll('.sec-card')].filter(c => c.tagName !== 'DETAILS' && c.querySelector(':scope > .sec-card-head')).length;
    let bar = p.querySelector(':scope > .cc-bar');
    if (n < 3 || CC_SKIP.has(p.id)) { if (bar) bar.remove(); return; }
    if (bar) return;
    p.insertAdjacentHTML('afterbegin', '<div class="cc-bar"><button type="button" onclick="ccAll(this,false)">▲ جمع کردن همه</button><button type="button" onclick="ccAll(this,true)">▼ باز کردن همه</button></div>');
  });
}
function ccAll(btn, open) {
  const page = btn.closest('.page'), tried = new Set();
  for (let i = 0; i < 80; i++) {
    const c = [...page.querySelectorAll('.sec-card')].find(x => x.tagName !== 'DETAILS' && x.offsetParent && x.querySelector(':scope > .sec-card-head') && x.classList.contains('open') !== open && !tried.has(ccId(x)));
    if (!c) break;
    tried.add(ccId(c));
    c.querySelector(':scope > .sec-card-head').click();   /* کارت‌های خودمدیریت هم با همان کلیک خودشان تغییر می‌کنند */
  }
}

function ccInit() {
  window.toggleCard = ccToggleCard;   /* بعد از اجرای همه‌ی اسکریپت‌ها، تا تعریف قدیمی صفحه را جایگزین کند */
  document.querySelectorAll('.sec-card').forEach(ccEnhance);
  ccBars();
  new MutationObserver(ms => {
    let any = false;
    for (const m of ms) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches && n.matches('.sec-card')) { ccEnhance(n); any = true; }
      if (n.querySelectorAll) n.querySelectorAll('.sec-card').forEach(c => { ccEnhance(c); any = true; });
    }
    if (any) ccBars();
  }).observe(document.body, { childList: true, subtree: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ccInit); else ccInit();

document.head.insertAdjacentHTML('beforeend', `<style>
  .cc-bar{display:flex;gap:8px;justify-content:flex-end;margin:0 0 10px}
  .cc-bar button{padding:6px 12px;border-radius:100px;border:1px solid var(--border);background:var(--card);color:var(--dim);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}
  .cc-bar button:hover{background:var(--card2);color:var(--text)}
  .sec-card-head[role=button]:focus-visible{outline:2px solid var(--gold,#C9A24B);outline-offset:-2px}
  .sec-card:not(.open) > .sec-card-head{border-bottom-color:transparent}
  .sec-head-sub{line-height:1.6}
</style>`);
