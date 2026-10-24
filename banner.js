/* ══════════════════════════════════════════
   BANNERS — صفحه خوش‌آمد، بنر بالای صفحه، بنر ستاد هر شهر
   داده: site.banner = { image, title, splash, top }   ·   city.hqBanner = path
══════════════════════════════════════════ */
(function injectBannerCSS() {
  const css = `
  .site-banner{display:flex;align-items:center;gap:12px;width:calc(100% - 28px);margin:12px 14px 0;padding:8px;text-align:right;
    border-radius:var(--r);background:var(--card);border:1px solid var(--border);box-shadow:var(--shadow);cursor:zoom-in;font-family:var(--font);color:var(--text)}
  .site-banner img{width:58px;height:58px;border-radius:calc(var(--r) - 6px);object-fit:cover;object-position:50% 45%;flex-shrink:0;display:block}
  .site-banner b{display:block;font-size:calc(14px * var(--fs,1));font-weight:800;line-height:1.5}
  .site-banner small{display:block;font-size:calc(12px * var(--fs,1));color:var(--dim);line-height:1.5}
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
/* بالای صفحه فقط یک نوار کوچک است؛ با لمس، بنر کامل باز می‌شود */
function siteBannerHTML() {
  const b = siteBannerData();
  if (!b || !b.top) return '';
  const title = b.title || (CARAVAN_DATA.site || {}).appTitle || '';
  return `<button type="button" class="site-banner" onclick="openPhoto('${escHtml(b.image)}','')" aria-label="نمایش بنر ${escHtml(title)}">
    <img src="${escHtml(b.image)}" alt="">
    <span><b>${escHtml(title)}</b><small>برای دیدن بنر لمس کنید</small></span>
  </button>`;
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
