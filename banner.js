/* ══════════════════════════════════════════
   BANNERS — صفحه خوش‌آمد، بنر بالای صفحه، بنر ستاد هر شهر
   داده: site.banner = { image, splash, top }   ·   city.hqBanner = path
══════════════════════════════════════════ */
(function injectBannerCSS() {
  const css = `
  .site-banner{position:relative;margin:10px 14px 4px;border-radius:var(--r);overflow:hidden;box-shadow:var(--shadow);
    border:1px solid var(--border);background:var(--card);line-height:0}
  .site-banner img{width:100%;height:auto;display:block;cursor:zoom-in}
  .site-banner .sb-close{position:absolute;top:8px;left:8px;width:30px;height:30px;border-radius:50%;border:none;cursor:pointer;
    background:rgba(0,0,0,.45);color:#fff;font-size:14px;line-height:30px;font-family:var(--font)}
  .site-banner-mini{display:flex;align-items:center;justify-content:center;gap:6px;margin:8px 14px 2px;padding:7px 12px;width:calc(100% - 28px);
    border:1px dashed var(--border-s);border-radius:var(--r-sm);background:none;color:var(--dim);cursor:pointer;
    font-family:var(--font);font-size:calc(11.5px * var(--fs,1));font-weight:700}
  .sec-banner{line-height:0;background:var(--card2);border-bottom:1px solid var(--border)}
  .sec-banner img{width:100%;height:auto;display:block;cursor:zoom-in}

  .splash{position:fixed;inset:0;z-index:400;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
    padding:24px 16px;background:var(--bg);transition:opacity .45s ease;cursor:pointer}
  .splash.hide{opacity:0;pointer-events:none}
  .splash img{width:100%;max-width:520px;max-height:70vh;object-fit:contain;border-radius:var(--r);box-shadow:0 10px 40px rgba(0,0,0,.25);
    opacity:0;transform:scale(.97);transition:opacity .4s ease,transform .6s ease}
  .splash.ready img{opacity:1;transform:none}
  .splash .sp-skip{font-size:calc(11.5px * var(--fs,1));color:var(--dim);font-family:var(--font)}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

function siteBannerData() {
  const b = (CARAVAN_DATA.site || {}).banner;
  return b && b.image ? b : null;
}
function bannerCollapsed() {
  try { return localStorage.getItem('caravan-banner') === (siteBannerData() || {}).image; } catch (e) { return false; }
}
function siteBannerHTML() {
  const b = siteBannerData();
  if (!b || !b.top) return '';
  if (bannerCollapsed())
    return `<button class="site-banner-mini" onclick="setBannerCollapsed(false)">🖼️ نمایش بنر</button>`;
  return `<div class="site-banner">
    <img src="${escHtml(b.image)}" alt="${escHtml(b.alt || 'بنر')}" onclick="openPhoto(this.src,'')">
    <button class="sb-close" onclick="setBannerCollapsed(true)" aria-label="جمع کردن بنر" title="جمع کردن">✕</button>
  </div>`;
}
function setBannerCollapsed(on) {
  try {
    if (on) localStorage.setItem('caravan-banner', siteBannerData().image);
    else localStorage.removeItem('caravan-banner');
  } catch (e) {}
  renderSiteBanner();
}
function renderSiteBanner() {
  const el = document.getElementById('siteBanner');
  if (el) el.innerHTML = siteBannerHTML();
}
function secBannerHTML(src, cap) {
  if (!src) return '';
  return `<div class="sec-banner"><img src="${escHtml(src)}" alt="${escHtml(cap || '')}" loading="lazy" onclick="openPhoto(this.src,'')"></div>`;
}

/* صفحه خوش‌آمد: در هر بار باز شدن برنامه یک‌بار، با لمس رد می‌شود */
function showSplash(force) {
  const b = siteBannerData();
  if (force) try {  // پارامتر را برمی‌داریم تا با تازه‌شدن صفحه پیش‌نمایش، دوباره نمایش داده نشود
    const u = new URL(location.href); u.searchParams.delete('splash'); history.replaceState(history.state, '', u);
  } catch (e) {}
  if (!b || !b.splash) return;
  try { if (sessionStorage.getItem('caravan-splash') && !force) return; sessionStorage.setItem('caravan-splash', '1'); } catch (e) {}
  document.body.insertAdjacentHTML('beforeend', `
    <div class="splash" id="splash" role="dialog" aria-label="خوش آمدید">
      <img alt="${escHtml(b.alt || 'بنر')}">
      <div class="sp-skip">برای ورود لمس کنید</div>
    </div>`);
  const sp = document.getElementById('splash');
  const img = sp.querySelector('img');
  let done = false;
  const close = () => { if (done) return; done = true; sp.classList.add('hide'); setTimeout(() => sp.remove(), 500); };
  sp.addEventListener('click', close);
  // اگر عکس زود آماده نشد (اینترنت ضعیف) منتظر نمی‌مانیم
  const giveUp = setTimeout(close, 1500);
  img.onload = () => { clearTimeout(giveUp); sp.classList.add('ready'); setTimeout(close, 2800); };
  img.onerror = close;
  img.src = b.image;
}
