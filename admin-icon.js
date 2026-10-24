/* ══════════════════════════════════════════
   APP ICON — آیکون برنامه روی گوشی
   از یک عکس، چهار اندازه لازم ساخته می‌شود:
   ۵۱۲ و ۱۹۲ (معمولی)، ۵۱۲ maskable (اندروید، با حاشیه امن) و ۱۸۰ (آیفون، بدون شفافیت)
   داده: site.icon = { i192, i512, mask, apple, bg }
══════════════════════════════════════════ */
const DEFAULT_ICON = { i192: 'app-icon-192.png', i512: 'app-icon.png', mask: 'app-icon-maskable.png', apple: 'apple-touch-icon.png' };
let iconState = { paths: null, bg: '#0E5A44', zoom: 100, img: null, pending: null, preview: null };

(function injectIconCSS() {
  document.head.insertAdjacentHTML('beforeend', `<style>
  .icon-prev{display:flex;gap:22px;justify-content:center;align-items:flex-start;padding:16px;border-radius:12px;
    background:linear-gradient(160deg,#3b5b8a,#6a4c8c);margin-bottom:10px}
  .icon-prev figure{display:flex;flex-direction:column;align-items:center;gap:6px;margin:0;width:84px}
  .icon-prev img{width:64px;height:64px;display:block;box-shadow:0 3px 10px rgba(0,0,0,.35)}
  .icon-prev .and img{border-radius:50%}
  .icon-prev .ios img{border-radius:15px}
  .icon-prev figcaption{color:#fff;font-size:11.5px;text-align:center;line-height:1.4;max-width:84px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.5)}
  .icon-prev small{display:block;color:rgba(255,255,255,.75);font-size:10px}
  .icon-ctl{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .icon-ctl input[type=range]{flex:1;min-width:140px}
  .icon-ctl input[type=color]{width:46px;height:36px;border:1px solid var(--border-s);border-radius:8px;padding:2px;background:none}
  </style>`);
})();

function initIcon() {
  const ic = (CARAVAN_DATA.site || {}).icon;
  iconState = { paths: ic && ic.i192 ? { i192: ic.i192, i512: ic.i512, mask: ic.mask, apple: ic.apple } : null,
    bg: (ic && ic.bg) || '#0E5A44', zoom: 100, img: null, pending: null, preview: null };
  renderIconEditor();
}

function iconCurrent() { return iconState.pending || iconState.preview || iconState.paths || DEFAULT_ICON; }

/* fit=1 یعنی عکس کل کادر را پر کند؛ safe<1 یعنی دورش حاشیه رنگی بماند (برای maskable) */
function drawIcon(size, safe) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.fillStyle = iconState.bg;
  g.fillRect(0, 0, size, size);
  const img = iconState.img, box = size * safe;
  const k = box / Math.min(img.width, img.height) * (iconState.zoom / 100);
  const w = img.width * k, h = img.height * k;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return cv.toDataURL('image/png');
}
function iconBuildPending() {
  if (!iconState.img) return;
  iconState.pending = { i512: drawIcon(512, 1), i192: drawIcon(192, 1), apple: drawIcon(180, 1), mask: drawIcon(512, 0.8) };
}

function renderIconEditor() {
  const el = document.getElementById('app-icon-editor');
  if (!el) return;
  const cur = iconCurrent(), name = (siteState.iconName || '').trim() || DEFAULT_SITE.iconName;
  el.innerHTML = `
    <div class="field">
      <div class="icon-prev">
        <figure class="and"><img src="${escH(cur.mask)}" alt=""><figcaption>${escH(name)}<small>اندروید</small></figcaption></figure>
        <figure class="ios"><img src="${escH(cur.apple)}" alt=""><figcaption>${escH(name)}<small>آیفون</small></figcaption></figure>
      </div>
      <div class="hero-btns">
        <label>${iconState.img ? '🔄 عکس دیگر' : '📷 انتخاب عکس آیکون'}<input type="file" accept="image/*" hidden onchange="pickIcon(this)"></label>
        ${iconState.paths || iconState.pending ? `<label style="border-color:rgba(231,76,60,.4);color:var(--red);background:var(--red-bg)" onclick="resetIcon()">↩️ آیکون پیش‌فرض</label>` : ''}
      </div>
    </div>
    ${iconState.img ? `
    <div class="field">
      <div class="field-label">بزرگ‌نمایی عکس داخل آیکون</div>
      <div class="icon-ctl"><input type="range" min="50" max="200" step="5" value="${iconState.zoom}" oninput="iconState.zoom=+this.value;iconBuildPending();iconRefreshPrev()"><b id="iconZoomVal">${iconState.zoom}٪</b></div>
      <div class="field-label" style="margin-top:12px">رنگ زمینه (برای اطراف عکس و عکس‌های بدون زمینه)</div>
      <div class="icon-ctl"><input type="color" value="${escH(iconState.bg)}" oninput="iconState.bg=this.value;iconBuildPending();iconRefreshPrev()">
        <span class="empty-msg" style="padding:0">اندروید گوشه‌های آیکون را گرد یا دایره‌ای می‌بُرد؛ قسمت مهم عکس را وسط بگذارید.</span></div>
    </div>` : ''}
    <div class="empty-msg">بهترین عکس: مربعی، حداقل ۵۱۲×۵۱۲، با طرح ساده و درشت. برای ثبت، «انتشار» را بزنید.<br>
      گوشی‌هایی که برنامه را قبلاً نصب کرده‌اند: اندروید معمولاً تا چند روز بعد آیکون را عوض می‌کند؛ آیفون فقط اگر برنامه را حذف و دوباره نصب کنند.</div>`;
}
function iconRefreshPrev() {
  const cur = iconCurrent();
  const imgs = document.querySelectorAll('#app-icon-editor .icon-prev img');
  if (imgs.length === 2) { imgs[0].src = cur.mask; imgs[1].src = cur.apple; }
  const z = document.getElementById('iconZoomVal');
  if (z) z.textContent = iconState.zoom.toLocaleString('fa') + '٪';
}

function pickIcon(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f), img = new Image();
  img.onload = () => {
    iconState.img = img; iconState.zoom = 100;
    iconBuildPending(); renderIconEditor();
    showToast('آیکون انتخاب شد — برای ثبت، «انتشار» را بزنید');
  };
  img.onerror = () => showToast('❌ تصویر خوانده نشد');
  img.src = url;
}
function resetIcon() {
  if (!confirm('آیکون به حالت پیش‌فرض برگردد؟')) return;
  iconState.paths = null; iconState.pending = null; iconState.preview = null; iconState.img = null;
  renderIconEditor();
}

/* خروجی برای data.js */
function siteIconOut() {
  const p = iconState.paths || (BUILD_PENDING && iconState.pending);
  return p ? { icon: { i192: p.i192, i512: p.i512, mask: p.mask, apple: p.apple, bg: iconState.bg } } : {};
}
function iconManifestList() {
  const p = iconState.paths || DEFAULT_ICON;
  return [
    { src: p.i192, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: p.i512, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: p.mask, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ];
}

async function uploadPendingIcon(token) {
  if (!iconState.pending) return;
  const ts = Date.now(), paths = {};
  for (const k of ['i512', 'i192', 'mask', 'apple']) {
    paths[k] = `icons/${k}-${ts}.png`;
    await putFile(paths[k], '', 'Update app icon', token, iconState.pending[k].split(',')[1]);
  }
  iconState.paths = paths; iconState.preview = iconState.pending; iconState.pending = null; iconState.img = null;
  renderIconEditor();
}
