/* ══════════════════════════════════════════
   CITY MAP VIEWER — نقشه شهر با بزرگ‌نمایی دو انگشتی
   داده: city.map = { image, pdf, w, h }
══════════════════════════════════════════ */
(function injectMapCSS() {
  const css = `
  .map-open{display:flex;align-items:center;gap:10px;width:100%;margin:0 0 12px;padding:11px 14px;border-radius:var(--r-sm);
    border:1.5px solid rgba(30,120,200,.35);background:rgba(30,120,200,.07);color:var(--text);cursor:pointer;font-family:var(--font);text-align:right}
  .map-open .mo-ico{font-size:24px;flex-shrink:0}
  .map-open .mo-t{display:block;font-size:calc(13.5px * var(--fs,1));font-weight:800;color:#1E78C8}
  [data-theme="dark"] .map-open .mo-t{color:#6AA9F5}
  .map-open .mo-s{display:block;font-size:calc(10.5px * var(--fs,1));color:var(--dim);margin-top:2px}
  .hcode{display:inline-block;font-size:calc(10px * var(--fs,1));font-weight:800;padding:1px 7px;border-radius:6px;margin-right:6px;
    background:rgba(var(--rgb-hotel),.15);color:var(--c-hotel);vertical-align:middle;white-space:nowrap}
  .hotel-map-btn{display:flex;align-items:center;gap:8px;width:100%;padding:10px 15px;border:none;border-bottom:1px solid var(--border);
    background:none;cursor:pointer;font-family:var(--font);color:#1E78C8;font-size:calc(12px * var(--fs,1));font-weight:700;text-align:right}

  .mapv{position:fixed;inset:0;z-index:250;background:#1b1f1d;display:none;flex-direction:column}
  .mapv.open{display:flex}
  .mapv-bar{display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(0,0,0,.55);color:#fff;z-index:2}
  .mapv-bar button,.mapv-bar a{height:40px;min-width:40px;padding:0 12px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);
    color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:flex;align-items:center;justify-content:center}
  .mapv-title{flex:1;font-weight:800;font-size:calc(14px * var(--fs,1));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mapv-stage{flex:1;position:relative;overflow:hidden;touch-action:none;cursor:grab;background:#e9ecea}
  .mapv-stage img{position:absolute;left:0;top:0;transform-origin:0 0;user-select:none;-webkit-user-drag:none;max-width:none;will-change:transform}
  .mapv-hint{position:absolute;left:50%;transform:translateX(-50%);top:66px;z-index:3;background:rgba(180,140,60,.95);color:#fff;
    padding:8px 16px;border-radius:100px;font-size:calc(12.5px * var(--fs,1));font-weight:800;box-shadow:0 4px 18px rgba(0,0,0,.35);
    white-space:nowrap;pointer-events:none;display:none}
  .mapv-zoom{position:absolute;left:12px;bottom:max(16px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px;z-index:3}
  .mapv-zoom button{width:46px;height:46px;border-radius:12px;border:none;background:rgba(0,0,0,.6);color:#fff;font-size:22px;cursor:pointer;font-family:var(--font)}
  .mapv-tip{position:absolute;right:12px;bottom:max(16px,env(safe-area-inset-bottom));z-index:3;background:rgba(0,0,0,.6);color:#fff;
    font-size:calc(11px * var(--fs,1));padding:7px 12px;border-radius:10px;line-height:1.7;max-width:60%}
  .mapv-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#555;font-size:13px}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

function cityMapButtonHTML(city) {
  if (!city.map || !city.map.image) return '';
  return `<button class="map-open" onclick="openCityMap('${city.id}')">
    <span class="mo-ico" aria-hidden="true">🗺️</span>
    <span style="flex:1"><span class="mo-t">نقشه ${escHtml(city.name)}</span>
    <span class="mo-s">محل هتل‌ها، هلال احمر، اماکن زیارتی و ستاد — با دو انگشت بزرگ کنید</span></span>
  </button>`;
}

const MV = { s: 1, x: 0, y: 0, min: 1, max: 8, w: 0, h: 0, pts: new Map(), last: null, pinch: null, tap: 0 };

function openCityMap(cityId, code) {
  const city = CARAVAN_DATA.cities.find(c => c.id === cityId);
  if (!city || !city.map || !city.map.image) return;
  let v = document.getElementById('mapView');
  if (!v) {
    document.body.insertAdjacentHTML('beforeend', `
    <div class="mapv" id="mapView" role="dialog" aria-modal="true" aria-label="نقشه شهر">
      <div class="mapv-bar">
        <button onclick="closeCityMap()" aria-label="بستن">✕</button>
        <div class="mapv-title" id="mapTitle"></div>
        <a id="mapPdf" target="_blank" rel="noopener" download>📄 PDF</a>
      </div>
      <div class="mapv-hint" id="mapHint"></div>
      <div class="mapv-stage" id="mapStage"><div class="mapv-loading" id="mapLoading">در حال بارگذاری نقشه...</div><img id="mapImg" alt="نقشه شهر" draggable="false"></div>
      <div class="mapv-zoom">
        <button onclick="mapZoomBy(1.6)" aria-label="بزرگ‌نمایی">＋</button>
        <button onclick="mapZoomBy(1/1.6)" aria-label="کوچک‌نمایی">－</button>
        <button onclick="mapFit()" aria-label="اندازه کامل">⤢</button>
      </div>
      <div class="mapv-tip">با دو انگشت بزرگ و کوچک کنید · برای دید بهتر گوشی را افقی بگیرید</div>
    </div>`);
    v = document.getElementById('mapView');
    mapBindGestures(document.getElementById('mapStage'));
    window.addEventListener('resize', () => { if (v.classList.contains('open')) mapFit(); });
  }
  document.getElementById('mapTitle').textContent = 'نقشه ' + city.name;
  const pdf = document.getElementById('mapPdf');
  pdf.style.display = city.map.pdf ? 'flex' : 'none';
  if (city.map.pdf) pdf.href = city.map.pdf;
  const hint = document.getElementById('mapHint');
  if (code) { hint.textContent = `🔎 دنبال شماره ${faDigits(code)} روی نقشه بگردید`; hint.style.display = 'block'; }
  else hint.style.display = 'none';
  const img = document.getElementById('mapImg');
  const loading = document.getElementById('mapLoading');
  img.style.visibility = 'hidden'; loading.style.display = 'flex';
  img.onload = () => { MV.w = img.naturalWidth; MV.h = img.naturalHeight; loading.style.display = 'none'; img.style.visibility = 'visible'; mapFit(); };
  let retried = false;
  img.onerror = () => {
    if (!retried && navigator.onLine) { retried = true; img.src = city.map.image + '?r=' + Date.now(); return; }
    loading.textContent = navigator.onLine
      ? 'نقشه بارگذاری نشد. اگر نقشه تازه منتشر شده، چند دقیقه بعد دوباره امتحان کنید.'
      : 'شما آفلاین هستید و این نقشه هنوز روی گوشی ذخیره نشده است. یک‌بار با اینترنت برنامه را باز کنید تا نقشه برای استفاده آفلاین ذخیره شود.';
  };
  loading.textContent = 'در حال بارگذاری نقشه...';
  if (!img.getAttribute('src') || !img.getAttribute('src').startsWith(city.map.image)) img.src = city.map.image;
  else if (img.complete && img.naturalWidth) img.onload();
  v.classList.add('open');
  document.documentElement.style.overflow = 'hidden';
  if (!(history.state && history.state.map)) history.pushState({ map: 1 }, '');
}
function hideCityMap() {
  const v = document.getElementById('mapView');
  if (v) v.classList.remove('open');
  document.documentElement.style.overflow = '';
}
function closeCityMap() { if (history.state && history.state.map) history.back(); else hideCityMap(); }
window.addEventListener('popstate', () => {
  const v = document.getElementById('mapView');
  if (v && v.classList.contains('open')) hideCityMap();
});

function mapApply() {
  const img = document.getElementById('mapImg');
  img.style.transform = `translate(${MV.x}px,${MV.y}px) scale(${MV.s})`;
}
function mapClamp() {
  const st = document.getElementById('mapStage');
  const W = st.clientWidth, H = st.clientHeight, iw = MV.w * MV.s, ih = MV.h * MV.s;
  MV.x = iw <= W ? (W - iw) / 2 : Math.min(0, Math.max(W - iw, MV.x));
  MV.y = ih <= H ? (H - ih) / 2 : Math.min(0, Math.max(H - ih, MV.y));
}
function mapFit() {
  const st = document.getElementById('mapStage');
  if (!MV.w || !st.clientWidth) return;
  MV.min = Math.min(st.clientWidth / MV.w, st.clientHeight / MV.h);
  MV.max = Math.max(MV.min * 10, 2);
  MV.s = MV.min; MV.x = 0; MV.y = 0;
  mapClamp(); mapApply();
}
function mapZoomAt(f, cx, cy) {
  const ns = Math.min(MV.max, Math.max(MV.min, MV.s * f));
  const k = ns / MV.s;
  MV.x = cx - (cx - MV.x) * k;
  MV.y = cy - (cy - MV.y) * k;
  MV.s = ns;
  mapClamp(); mapApply();
}
function mapZoomBy(f) {
  const st = document.getElementById('mapStage');
  mapZoomAt(f, st.clientWidth / 2, st.clientHeight / 2);
}
function mapBindGestures(st) {
  const local = e => { const r = st.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  st.addEventListener('pointerdown', e => {
    st.setPointerCapture(e.pointerId);
    MV.pts.set(e.pointerId, local(e));
    if (MV.pts.size === 1) {
      const now = Date.now(), p = local(e);
      if (now - MV.tap < 300) mapZoomAt(MV.s > MV.min * 1.5 ? MV.min / MV.s : 2.5, p.x, p.y);
      MV.tap = now;
      MV.last = p;
    }
    if (MV.pts.size === 2) {
      const [a, b] = [...MV.pts.values()];
      MV.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  });
  st.addEventListener('pointermove', e => {
    if (!MV.pts.has(e.pointerId)) return;
    MV.pts.set(e.pointerId, local(e));
    if (MV.pts.size === 2 && MV.pinch) {
      const [a, b] = [...MV.pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      MV.x += m.x - MV.pinch.m.x; MV.y += m.y - MV.pinch.m.y;
      mapZoomAt(d / MV.pinch.d, m.x, m.y);
      MV.pinch = { d, m };
    } else if (MV.pts.size === 1 && MV.last) {
      const p = local(e);
      MV.x += p.x - MV.last.x; MV.y += p.y - MV.last.y;
      MV.last = p;
      mapClamp(); mapApply();
    }
  });
  const end = e => {
    MV.pts.delete(e.pointerId);
    if (MV.pts.size < 2) MV.pinch = null;
    MV.last = MV.pts.size === 1 ? [...MV.pts.values()][0] : null;
  };
  st.addEventListener('pointerup', end);
  st.addEventListener('pointercancel', end);
  st.addEventListener('wheel', e => {
    e.preventDefault();
    const p = local(e);
    mapZoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, p.x, p.y);
  }, { passive: false });
}
