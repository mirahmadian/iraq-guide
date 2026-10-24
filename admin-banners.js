/* ══════════════════════════════════════════
   BANNERS — بنر اصلی (صفحه خوش‌آمد / بالای صفحه) و بنر ستاد هر شهر
══════════════════════════════════════════ */
let bannerState = { image: '', title: '', splash: true, top: true };

function initBanners() {
  const b = (CARAVAN_DATA.site || {}).banner || {};
  bannerState = { image: b.image || '', title: b.title || '', splash: b.splash !== false, top: b.top !== false };
  ALL_CITIES.forEach(id => {
    const c = CARAVAN_DATA.cities.find(x => x.id === id) || {};
    cityMeta[id].hqBanner = c.hqBanner || '';
    renderCityMeta(id);
  });
  renderBannerEditor();
}

function bannerSrc(o, k) { return o[k + 'Data'] || o[k + 'Preview'] || o[k] || ''; }

function bannerPickHTML(src, pickJs, clearJs) {
  const picker = `<label>${src ? '🔄 تغییر بنر' : '📷 انتخاب بنر'}<input type="file" accept="image/*" hidden onchange="${pickJs}"></label>`;
  return `<div class="hero-pick">
    ${src ? `<img src="${escH(src)}" alt="" style="width:100%;border-radius:10px;border:1px solid var(--border-s);display:block">` : ''}
    <div class="hero-btns">${picker}${src ? `<label style="border-color:rgba(231,76,60,.4);color:var(--red);background:var(--red-bg)" onclick="${clearJs}">🗑 حذف بنر</label>` : ''}</div>
  </div>`;
}

function renderBannerEditor() {
  const el = document.getElementById('site-banner-editor');
  if (!el) return;
  const src = bannerSrc(bannerState, 'image');
  el.innerHTML = `
    <div class="field">${bannerPickHTML(src, 'pickSiteBanner(this)', 'clearSiteBanner()')}</div>
    ${src ? `
    <div class="field"><div class="field-label">عنوان کوتاه بنر (کنار عکس کوچک بالای برنامه نوشته می‌شود)</div>
      <input type="text" class="input-full" placeholder="مثلاً: دفتر نمایندگی حج و زیارت در عراق" value="${escH(bannerState.title)}" oninput="bannerState.title=this.value"></div>
    <div class="field">
      <label class="fchk" style="padding:0"><input type="checkbox" ${bannerState.splash ? 'checked' : ''} onchange="bannerState.splash=this.checked">
        <b>صفحه خوش‌آمد: هنگام باز کردن برنامه چند ثانیه نمایش داده شود</b></label>
      <label class="fchk" style="padding:0;margin-top:8px"><input type="checkbox" ${bannerState.top ? 'checked' : ''} onchange="bannerState.top=this.checked">
        <b>در اسلایدر صفحه اول نمایش داده شود (اگر «اسلایدهای خودکار» در چیدمان صفحه اول روشن باشد)</b></label>
    </div>
    <div style="padding:0 16px"><button class="add-row-btn" onclick="previewSplash()">▶ دیدن صفحه خوش‌آمد در پیش‌نمایش</button></div>` : ''}
    <div class="empty-msg">بهترین اندازه: عکس افقی (عرض بیشتر از ارتفاع). برای ثبت، «انتشار» را بزنید.</div>`;
}

async function pickSiteBanner(input) {
  const f = input.files && input.files[0];
  if (!f) return;
  try {
    bannerState.imageData = await resizeMax(f, 1600);
    renderBannerEditor();
    showToast('بنر انتخاب شد — برای ثبت، «انتشار» را بزنید');
  } catch (e) { showToast('❌ ' + e.message); }
}
function clearSiteBanner() {
  delete bannerState.imageData; delete bannerState.imagePreview; bannerState.image = '';
  renderBannerEditor();
}
function previewSplash() {
  saveDraft();
  window.open('index.html?preview=1&splash=1', 'caravan-preview');
}

function hqBannerPickerHTML(id) {
  return bannerPickHTML(bannerSrc(cityMeta[id], 'hqBanner'), `pickHqBanner('${id}',this)`, `clearHqBanner('${id}')`);
}
async function pickHqBanner(id, input) {
  const f = input.files && input.files[0];
  if (!f) return;
  try {
    cityMeta[id].hqBannerData = await resizeMax(f, 1600);
    renderCityMeta(id);
    showToast('بنر انتخاب شد — برای ثبت، «انتشار» را بزنید');
  } catch (e) { showToast('❌ ' + e.message); }
}
function clearHqBanner(id) {
  const m = cityMeta[id];
  delete m.hqBannerData; delete m.hqBannerPreview; m.hqBanner = '';
  renderCityMeta(id);
}

/* خروجی برای data.js */
function siteBannerOut() {
  const img = bannerState.image || (BUILD_PENDING && bannerState.imageData) || '';
  return img ? { banner: { image: img, ...(bannerState.title.trim() ? { title: bannerState.title.trim() } : {}), splash: bannerState.splash, top: bannerState.top } } : {};
}
function hqBannerOut(id) {
  const m = cityMeta[id];
  const img = m.hqBanner || (BUILD_PENDING && m.hqBannerData) || '';
  return img ? { hqBanner: img } : {};
}

async function uploadPendingBanners(token) {
  if (bannerState.imageData) {
    const path = 'banners/site-' + Date.now() + '.jpg';
    await putFile(path, '', 'Add banner', token, bannerState.imageData.split(',')[1]);
    bannerState.image = path; bannerState.imagePreview = bannerState.imageData; delete bannerState.imageData;
    renderBannerEditor();
  }
  for (const id of ALL_CITIES) {
    const m = cityMeta[id];
    if (!m.hqBannerData) continue;
    const path = 'banners/hq-' + id + '-' + Date.now() + '.jpg';
    await putFile(path, '', 'Add HQ banner', token, m.hqBannerData.split(',')[1]);
    m.hqBanner = path; m.hqBannerPreview = m.hqBannerData; delete m.hqBannerData;
    renderCityMeta(id);
  }
}
