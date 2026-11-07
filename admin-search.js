/* ══════════════════════════════════════════
   ADMIN SEARCH — «🔎 جستجو در پنل» (دکمه‌ی بالای پنل یا Ctrl+K)
   فهرست از خود صفحه ساخته می‌شود (تب‌ها، دسته‌ها، کارت‌ها، عنوان فیلدها و دکمه‌ها)، پس هر بخش تازه خودش پیدا می‌شود.
   با زدن نتیجه: تب و دسته باز می‌شود، کارت باز و به آن اسکرول می‌شود و چند ثانیه پررنگ می‌ماند.
══════════════════════════════════════════ */
const AS_NORM = s => String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[‌‏‎ً-ْ]/g, '').replace(/[ـ]/g, '')
  .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\s+/g, ' ').trim().toLowerCase();
/* کلمه‌های هم‌معنی تا با هر کلمه‌ای که یادتان مانده پیدا شود */
const AS_SYN = {
  'رمز': 'کاربران همکار ورود کلید', 'همکار': 'کاربران دسترسی', 'دسترسی': 'کاربران همکار', 'پشتیبان': 'سلامت سرور نگهبان بسته نجات',
  'بکاپ': 'پشتیبان', 'سرور': 'سلامت سرور Cloudflare', 'کلودفلر': 'Cloudflare', 'cloudflare': 'کلودفلر', 'کداسپیس': 'Codespace', 'codespace': 'کداسپیس',
  'پیامک': 'بله', 'پیام': 'بله اطلاعیه', 'اطلاعیه': 'بله پیام', 'دلار': 'دینار نرخ', 'ارز': 'دینار نرخ', 'نرخ': 'دینار',
  'آیکون': 'چیدمان صفحه اول', 'اسلاید': 'اسلایدر چیدمان', 'لوگو': 'آیکون برنامه', 'بنر': 'تصویر', 'عکس': 'تصویر بنر',
  'پرواز': 'فرودگاه حرکت', 'فرودگاه': 'پرواز', 'مدیر': 'مدیران کاروان', 'مجری': 'شرکت‌های مجری', 'نظر': 'نظرها ارزیابی', 'آمار': 'کاربران آمار',
  'غذا': 'برنامه غذایی', 'زیارت': 'زیارت‌نامه‌ها', 'هتل': 'هتل‌ها', 'تلفن': 'شماره', 'شماره': 'تلفن تماس', 'اورژانس': 'اضطراری'
};
const AS_EXTRA = [   /* دکمه‌های بالای پنل که داخل تب‌ها نیستند */
  { t: '🚀 انتشار برای کاربران', d: 'دکمه‌ی بالای پنل — تغییرها را برای همه منتشر می‌کند', sel: '#pubBtn' },
  { t: '👁 پیش‌نمایش', d: 'دکمه‌ی بالای پنل — دیدن تغییرها قبل از انتشار', sel: '[onclick="openPreview()"]' },
  { t: '⏻ خاموشی Codespace', d: 'دکمه‌ی بالای پنل — ساعت‌های باقی‌مانده و خاموش کردن محیط توسعه', sel: '[onclick="csOpen()"]' },
  { t: '🏨 گزارشات مدیران ثابت', d: 'دکمه‌ی بالای پنل — سامانه‌ی نواقص هتل‌ها (team)', sel: 'a[href^="team.html"]' },
  { t: '🔒 خروج از این دستگاه', d: 'دکمه‌ی قفل بالای پنل', sel: '[onclick="forgetDevice()"]' }
];
/* کلمه‌های هر تب (محتوای بعضی تب‌ها تا باز نشوند ساخته نمی‌شود) */
const AS_TABKEYS = {
  users: 'همکاران رمز دسترسی کاربران پنل کد ملی ورود همکار کلید GitHub', stats: 'آمار نصب کاربران سلامت سرور پشتیبان Cloudflare کلودفلر فضا بسته نجات Codespace',
  reviews: 'نظرها ستاره امتیاز زائران گزارش تخلف پنهان حذف', mgr: 'مدیران کاروان شماره موبایل بله ورود بخش ویژه شرکت‌های مجری مدیرعامل نماینده',
  food: 'غذا وعده صبحانه ناهار شام منو', besat: 'بعثه برنامه فرهنگی سخنران مراسم', guide: 'راهنمای زائر سوال پرسش', zyarat: 'زیارت‌نامه دعا متن زیارت'
};
let asIdx = [], asSel = 0, asRes = [];
/* کارتی که این همکار اجازه‌اش را ندارد در نتایج نیاید (کارت‌های دسته‌ی پنهان تب عمومی می‌آیند) */
function asAllowed(el) {
  if (typeof STAFF === 'undefined' || !STAFF) return true;
  const k = el.dataset.perm; if (!k) return true;
  return k !== 'owner' && STAFF.perms && STAFF.perms.has(k);
}

function asTabs() {
  const m = {};
  document.querySelectorAll('.tab-btn').forEach(b => { const id = ((b.getAttribute('onclick') || '').match(/switchTab\('(\w+)'/) || [])[1]; if (id && b.style.display !== 'none') m[id] = { btn: b, name: b.textContent.trim() }; });
  return m;
}
const asVisible = el => getComputedStyle(el).display !== 'none';
function asBuild() {
  const tabs = asTabs(), grp = {}, out = [];
  document.querySelectorAll('.grp-bar button').forEach(b => grp[b.dataset.g] = b.firstChild ? b.firstChild.textContent.trim() : b.textContent.trim());
  const texts = el => [...el.querySelectorAll('.field-label,.sec-head-sub,h2,h3,h4,label,summary,.empty-msg b,button,.add-row-btn,.lock-link,th')]
    .map(x => x.textContent.replace(/\s+/g, ' ').trim()).filter(t => t && t.length < 140);
  Object.entries(tabs).forEach(([id, T]) => {
    const page = document.getElementById('tab-' + id); if (!page) return;
    out.push({ kind: 'tab', tab: id, t: T.name, d: 'تب', hT: AS_NORM(T.name), hM: AS_NORM(AS_TABKEYS[id] || ''), hI: '', el: null });
    const cards = [...page.querySelectorAll('.sec-card')].filter(c => asAllowed(c) && !c.parentElement.closest('.sec-card'));
    cards.forEach(c => {
      const title = (c.querySelector('.sec-head-title') || {}).textContent || '', sub = (c.querySelector('.sec-head-sub') || {}).textContent || '';
      if (!title.trim()) return;
      const g = c.dataset.grp, inner = texts(c);
      out.push({ kind: 'card', tab: id, grp: g, el: c, t: title.trim(), d: [T.name, g ? grp[g] : ''].filter(Boolean).join(' › '), sub: sub.trim(), inner,
        hT: AS_NORM(title), hM: AS_NORM([sub, T.name, g ? grp[g] : ''].join(' | ')), hI: AS_NORM(inner.join(' | ')) });
    });
    /* تبی که کارت ندارد: محتوایش به همان ردیف تب اضافه می‌شود (دوبار نیاید) */
    if (!cards.length) { const tabIt = out.find(x => x.kind === 'tab' && x.tab === id), inner = texts(page); tabIt.inner = inner; tabIt.hI = AS_NORM(inner.join(' | ')); }
  });
  AS_EXTRA.forEach(x => { const el = document.querySelector(x.sel); if (el && asVisible(el)) out.push({ kind: 'btn', el, t: x.t, d: x.d, hT: AS_NORM(x.t), hM: AS_NORM(x.d), hI: '' }); });
  return out;
}
function asSearch(q) {
  const words = AS_NORM(q).split(' ').filter(Boolean);
  if (!words.length) return [];
  const alt = w => [w, ...AS_NORM(AS_SYN[w] || '').split(' ').filter(Boolean)];
  return asIdx.map(it => {
    let score = 0;
    for (const w of words) {
      /* هر کلمه: در عنوان ۱۰، در توضیح/تب/دسته ۴، در فیلدهای داخل کارت ۲؛ هم‌معنی‌ها کمی کمتر */
      let best = 0;
      alt(w).forEach((o, k) => { const b = it.hT.includes(o) ? 10 : it.hM.includes(o) ? 4 : it.hI.includes(o) ? 2 : 0, v = k ? b * 0.5 : b ? b + 3 : 0; if (v > best) best = v; });   /* خود کلمه بر هم‌معنی مقدم است */
      if (best <= 0) return null;
      score += best;
    }
    const snip = it.inner && words.length ? it.inner.find(x => words.some(w => alt(w).some(o => AS_NORM(x).includes(o))) && AS_NORM(x) !== AS_NORM(it.t)) : '';
    return { it, score: score + (it.kind === 'card' ? 1 : 0), snip };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 30);
}
function adSearchOpen() {
  asIdx = asBuild();
  let ov = document.getElementById('asOv');
  if (!ov) {
    document.body.insertAdjacentHTML('beforeend', `<div id="asOv" class="as-ov" role="dialog" aria-modal="true" aria-label="جستجو در پنل">
      <div class="as-box"><div class="as-top"><input id="asQ" type="search" placeholder="🔎 چه چیزی را پیدا کنم؟ مثلاً: بله، پشتیبان، فرودگاه، رمز همکار، نرخ دینار" autocomplete="off">
        <button class="as-x" onclick="adSearchClose()" aria-label="بستن">✕</button></div>
        <div id="asList" class="as-list" role="listbox"></div>
        <div class="as-help">↑↓ برای انتخاب، Enter برای رفتن، Esc برای بستن · میان‌بر: <b>Ctrl+K</b></div></div></div>`);
    ov = document.getElementById('asOv');
    ov.addEventListener('click', e => { if (e.target === ov) adSearchClose(); });
    const q = document.getElementById('asQ');
    q.addEventListener('input', () => { asSel = 0; asDraw(); });
    q.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { asSel = Math.min(asRes.length - 1, asSel + 1); asDraw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { asSel = Math.max(0, asSel - 1); asDraw(); e.preventDefault(); }
      else if (e.key === 'Enter' && asRes[asSel]) asGo(asSel);
      else if (e.key === 'Escape') adSearchClose();
    });
  }
  ov.classList.add('open');
  const q = document.getElementById('asQ'); q.value = ''; asSel = 0; asDraw(); setTimeout(() => q.focus(), 30);
}
function adSearchClose() { const ov = document.getElementById('asOv'); if (ov) ov.classList.remove('open'); }
function asDraw() {
  const q = document.getElementById('asQ').value, el = document.getElementById('asList');
  asRes = asSearch(q);
  if (!q.trim()) {
    const tabs = asIdx.filter(x => x.kind === 'tab');
    el.innerHTML = `<div class="as-hint">بخش‌های پنل:</div>${tabs.map(x => `<button class="as-chip" onclick="asGoItem(asIdx[${asIdx.indexOf(x)}])">${escH(x.t)}</button>`).join('')}`;
    return;
  }
  el.innerHTML = asRes.length ? asRes.map((r, i) => `<button class="as-item ${i === asSel ? 'on' : ''}" role="option" aria-selected="${i === asSel}" onclick="asGo(${i})" onmouseenter="asSel=${i};document.querySelectorAll('.as-item').forEach((b,j)=>b.classList.toggle('on',j===${i}))">
      <b>${escH(r.it.t)}</b><span>${escH(r.it.d || '')}</span>${r.snip ? `<small>… ${escH(r.snip)} …</small>` : r.it.sub ? `<small>${escH(r.it.sub)}</small>` : ''}</button>`).join('')
    : '<div class="as-hint">چیزی پیدا نشد. کلمه‌ی دیگری امتحان کنید (مثلاً «شماره» به‌جای «تلفن»).</div>';
  const on = el.querySelector('.as-item.on'); if (on) on.scrollIntoView({ block: 'nearest' });
}
function asGo(i) { asGoItem(asRes[i].it); }
function asGoItem(it) {
  adSearchClose();
  if (it.kind === 'btn') { it.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); asFlash(it.el); return; }
  const T = asTabs()[it.tab]; if (T) switchTab(it.tab, T.btn);
  if (it.grp && typeof showGrp === 'function') showGrp(it.grp);
  if (it.el && it.el.classList.contains('sec-card')) it.el.classList.add('open');
  const target = it.el || document.getElementById('tab-' + it.tab);
  setTimeout(() => { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (it.el) asFlash(it.el); }, 80);
}
function asFlash(el) { el.classList.remove('as-flash'); void el.offsetWidth; el.classList.add('as-flash'); setTimeout(() => el.classList.remove('as-flash'), 2600); }
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.key === 'ن')) {
    if (document.getElementById('lockOverlay') && document.getElementById('lockOverlay').classList.contains('show')) return;
    e.preventDefault(); adSearchOpen();
  }
});
document.head.insertAdjacentHTML('beforeend', `<style>
  .as-ov{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.45);display:none;align-items:flex-start;justify-content:center;padding:8vh 12px 12px}
  .as-ov.open{display:flex}
  .as-box{background:#fff;color:#1a1a1a;border-radius:18px;width:100%;max-width:640px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)}
  .as-top{display:flex;gap:6px;padding:12px;border-bottom:1px solid #eee}
  .as-top input{flex:1;min-width:0;border:1px solid #cfd8d3;border-radius:12px;padding:12px 14px;font-family:inherit;font-size:15px;outline:none}
  .as-top input:focus{border-color:var(--gold,#B8860B)}
  .as-x{border:0;background:#f2f2f2;border-radius:10px;width:42px;cursor:pointer;font-size:16px}
  .as-list{overflow:auto;padding:6px}
  .as-item{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;text-align:right;border:0;background:none;border-radius:12px;padding:10px 12px;cursor:pointer;font-family:inherit}
  .as-item b{font-size:14.5px}.as-item span{font-size:12px;color:#7a6a45}.as-item small{font-size:12px;color:#777;line-height:1.7}
  .as-item.on{background:#F6EFDD}
  .as-hint{padding:10px 12px;color:#777;font-size:13px}
  .as-chip{border:1px solid #e5dccb;background:#fff;border-radius:999px;padding:7px 12px;margin:4px;cursor:pointer;font-family:inherit;font-size:13px}
  .as-help{padding:8px 12px;border-top:1px solid #eee;color:#888;font-size:11.5px}
  .as-flash{outline:3px solid #E0A400!important;outline-offset:3px;border-radius:14px;animation:asPulse 1.2s ease 2}
  @keyframes asPulse{50%{outline-color:rgba(224,164,0,.25)}}
</style>`);
