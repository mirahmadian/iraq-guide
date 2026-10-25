/* ══════════════════════════════════════════
   HOME LAYOUT ADMIN — چیدمان صفحه اول: آیکون‌ها، نوار پایین، اسلایدر
   خروجی: site.layout = { tiles:[{id,on,label?,color?}], nav:[id], autoSlides, slides:[...] }
   فهرست شناسه‌ها باید با TILE_DEFS و NAV_DEFS در home.js یکی باشد
══════════════════════════════════════════ */
const LAYOUT_TILES = {
  lost: ['گم شده‌ام', 'clinic', '🆘'], stay: ['تاریخ خروج', 'consulate', '📅'], hq: ['ستاد', 'hq', '🏢'], clinic: ['درمانگاه', 'clinic', '☾'], consulate: ['کنسولگری', 'consulate', '🏛️'],
  besat: ['برنامه‌های بعثه', 'ziyarat', '📜'], hotel: ['هتل‌ها', 'hotel', '🏨'], map: ['نقشه شهر', 'parking', '🗺️'],
  ins: ['بیمه معلم', 'ins', '📋'], transport: ['ناظر نقل', 'transport', '🚌'], food: ['برنامه غذایی', 'restaurant', '🍽️'], currency: ['تبدیل ارز', 'ins', '💱'],
  ziyarat: ['اماکن زیارتی', 'ziyarat', '🕌'], restaurant: ['رستوران', 'restaurant', '🍴'], parking: ['پارکینگ', 'parking', '🅿️'], other: ['سایر مکان‌ها', 'other', '📍']
};
const LAYOUT_COLORS = { hq: ['سبز', '#0E5A44'], clinic: ['قرمز', '#B3261E'], consulate: ['سرمه‌ای', '#3B4592'], hotel: ['قهوه‌ای', '#7E5610'],
  ins: ['آبی', '#1C5C9E'], parking: ['آبی روشن', '#17609E'], transport: ['نارنجی', '#944A04'], ziyarat: ['فیروزه‌ای', '#00695C'], other: ['خاکستری', '#55636B'] };
const LAYOUT_NAV = { home: '🏠 خانه', lost: '🆘 گم شده‌ام', stay: '📅 تاریخ خروج', search: '🔍 جستجو', besat: '📜 بعثه', more: '⋯ بیشتر', map: '🗺️ نقشه', hotel: '🏨 هتل‌ها', currency: '💱 ارز', food: '🍽️ غذا', hq: '🏢 ستاد' };
const LAYOUT_NAV_DEFAULT = ['home', 'search', 'besat', 'more'];
const SLIDE_ACTIONS = { '': 'فقط بزرگ‌نمایی عکس', lost: 'گم شده‌ام', stay: 'تاریخ خروج از عراق', besat: 'برنامه‌های بعثه', hq: 'ستاد', clinic: 'درمانگاه', consulate: 'کنسولگری', hotel: 'هتل‌ها',
  map: 'نقشه شهر', ins: 'بیمه معلم', transport: 'ناظر نقل', food: 'برنامه غذایی', currency: 'تبدیل ارز', ziyarat: 'اماکن زیارتی', url: 'باز کردن یک لینک' };
let layoutState = { tiles: [], nav: [], autoSlides: true, slides: [] };

function initLayout() {
  const L = (CARAVAN_DATA.site || {}).layout || {};
  const saved = (L.tiles || []).filter(t => LAYOUT_TILES[t.id]);
  layoutState = {
    tiles: Object.keys(LAYOUT_TILES).reduce((a, id, i) => { if (!saved.some(t => t.id === id)) a.splice(Math.min(i, a.length), 0, { id, on: true }); return a; }, saved.slice())
      .map(t => ({ id: t.id, on: t.on !== false, label: t.label || '', color: t.color || '' })),
    nav: Object.keys(LAYOUT_NAV).map(id => ({ id, on: (L.nav && L.nav.length ? L.nav : LAYOUT_NAV_DEFAULT).includes(id) }))
      .sort((a, b) => { const o = L.nav && L.nav.length ? L.nav : LAYOUT_NAV_DEFAULT; return (o.indexOf(a.id) + 1 || 99) - (o.indexOf(b.id) + 1 || 99); }),
    autoSlides: L.autoSlides !== false,
    prayer: L.prayer !== false,
    slides: (L.slides || []).map(s => ({ image: s.image || '', title: s.title || '', tag: s.tag || '', action: s.action || '', url: s.url || '', cities: (s.cities || []).slice() }))
  };
  renderLayout();
}

function renderLayout() {
  const el = document.getElementById('layout-editor');
  if (!el) return;
  const mv = (kind, i, d) => `<button onclick="layoutMove('${kind}',${i},${d})" title="${d < 0 ? 'جلوتر' : 'عقب‌تر'}">${d < 0 ? '▲' : '▼'}</button>`;
  const navOn = layoutState.nav.filter(n => n.on).length;
  el.innerHTML = `
  <div class="field">
    <div class="field-label">🔲 آیکون‌های صفحه اول — ترتیب، نمایش، نام و رنگ</div>
    <div class="empty-msg" style="padding:0 0 8px">هر آیکون فقط در شهری دیده می‌شود که برایش اطلاعات ثبت شده باشد.</div>
    ${layoutState.tiles.map((t, i) => {
      const [def, defColor, emo] = LAYOUT_TILES[t.id], col = LAYOUT_COLORS[t.color || defColor] || LAYOUT_COLORS.other;
      return `<div class="lay-row ${t.on ? '' : 'off'}">
        <span class="lay-ic" style="background:${col[1]}">${emo}</span>
        <label class="lay-chk"><input type="checkbox" ${t.on ? 'checked' : ''} onchange="layoutState.tiles[${i}].on=this.checked;renderLayout()"></label>
        <input type="text" class="input-full lay-name" placeholder="${def}" value="${escH(t.label)}" oninput="layoutState.tiles[${i}].label=this.value">
        <select class="fsel-a lay-col" onchange="layoutState.tiles[${i}].color=this.value===('${defColor}')?'':this.value;renderLayout()">
          ${Object.entries(LAYOUT_COLORS).map(([k, [n]]) => `<option value="${k}" ${(t.color || defColor) === k ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
        <span class="lay-mv">${mv('tiles', i, -1)}${mv('tiles', i, 1)}</span>
      </div>`;
    }).join('')}
  </div>
  <div class="field">
    <label class="fchk" style="padding:0"><input type="checkbox" ${layoutState.prayer ? 'checked' : ''} onchange="layoutState.prayer=this.checked">
      <b>🕌 کارت اوقات شرعی (اذان بعدی و شمارش معکوس) در صفحه اول نمایش داده شود</b></label>
  </div>
  <div class="field">
    <div class="field-label">⬇️ دکمه‌های نوار پایین — حداکثر ۴ دکمه (${navOn.toLocaleString('fa')} از ۴ انتخاب شده)</div>
    <div class="empty-msg" style="padding:0 0 8px">دکمه قرمز وسط «شماره‌های ضروری» همیشه ثابت است. نیمی از دکمه‌ها سمت راست آن و نیمی سمت چپ قرار می‌گیرند.</div>
    ${layoutState.nav.map((n, i) => `<div class="lay-row ${n.on ? '' : 'off'}">
      <label class="lay-chk"><input type="checkbox" ${n.on ? 'checked' : ''} ${!n.on && navOn >= 4 ? 'disabled' : ''} onchange="layoutState.nav[${i}].on=this.checked;renderLayout()"></label>
      <b style="flex:1">${LAYOUT_NAV[n.id]}</b><span class="lay-mv">${mv('nav', i, -1)}${mv('nav', i, 1)}</span></div>`).join('')}
    <div class="lay-navprev">${layoutNavPreview()}</div>
  </div>
  <div class="field">
    <div class="field-label">🖼️ اسلایدر بالای صفحه</div>
    <label class="fchk" style="padding:0 0 10px"><input type="checkbox" ${layoutState.autoSlides ? 'checked' : ''} onchange="layoutState.autoSlides=this.checked">
      <b>اسلایدهای خودکار هم نمایش داده شود (بنر اصلی، پوستر بعثه هر شهر، عکس حرم هر شهر)</b></label>
    ${layoutState.slides.map((s, i) => layoutSlideHTML(s, i)).join('')}
    <button class="add-row-btn" onclick="layoutState.slides.push({image:'',title:'',tag:'اطلاعیه',action:'',url:'',cities:[]});renderLayout()">+ اسلاید جدید (اطلاعیه، خبر، ...)</button>
    <div class="empty-msg" style="padding:6px 0 0">اسلایدهای شما قبل از اسلایدهای خودکار نمایش داده می‌شوند. بهترین اندازه عکس: افقی (مثلاً ۱۶۰۰×۹۰۰)؛ عکس‌های دیگر هم کامل و بدون بریدگی نمایش داده می‌شوند.</div>
  </div>`;
}
function layoutNavPreview() {
  const on = layoutState.nav.filter(n => n.on).map(n => LAYOUT_NAV[n.id]), half = Math.ceil(on.length / 2);
  return [...on.slice(0, half), '<b style="color:#B3261E">📞 شماره‌های ضروری</b>', ...on.slice(half)].map(x => `<span>${x}</span>`).join('');
}
function layoutSlideHTML(s, i) {
  const src = s.imageData || s.imagePreview || s.image, cityIds = ALL_CITIES;
  return `<div class="lay-slide">
    <div style="display:flex;gap:10px;align-items:flex-start">
      <div class="lay-thumb" style="${src ? `background-image:url('${escH(src)}')` : ''}">${src ? '' : '🖼️'}</div>
      <div style="flex:1;display:flex;flex-direction:column;gap:6px">
        <label class="add-row-btn" style="margin:0;text-align:center;cursor:pointer">${src ? '🔄 تغییر عکس' : '📷 انتخاب عکس'}<input type="file" accept="image/*" hidden onchange="pickSlide(${i},this)"></label>
        <span class="lay-mv">${['▲', '▼'].map((a, k) => `<button onclick="layoutMove('slides',${i},${k ? 1 : -1})">${a}</button>`).join('')}
          <button class="del-btn" onclick="if(confirm('این اسلاید حذف شود؟')){layoutState.slides.splice(${i},1);renderLayout()}">🗑</button></span>
      </div>
    </div>
    <input type="text" class="input-full" placeholder="عنوان (روی عکس نوشته می‌شود)" value="${escH(s.title)}" oninput="layoutState.slides[${i}].title=this.value">
    <input type="text" class="input-full" placeholder="برچسب کوچک — مثلاً: اطلاعیه، خبر، مهم" value="${escH(s.tag)}" oninput="layoutState.slides[${i}].tag=this.value">
    <div class="field-label" style="margin:4px 0 0">با لمس اسلاید چه اتفاقی بیفتد؟</div>
    <select class="fsel-a" onchange="layoutState.slides[${i}].action=this.value;renderLayout()">${Object.entries(SLIDE_ACTIONS).map(([k, l]) => `<option value="${k}" ${s.action === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    ${s.action === 'url' ? `<input type="text" class="input-full" dir="ltr" placeholder="https://..." value="${escH(s.url)}" oninput="layoutState.slides[${i}].url=this.value">` : ''}
    <div class="field-label" style="margin:4px 0 0">در کدام شهرها نمایش داده شود؟ (هیچ‌کدام = همه شهرها)</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${cityIds.map(c => `<label class="fchk" style="padding:0"><input type="checkbox" ${s.cities.includes(c) ? 'checked' : ''}
      onchange="const a=layoutState.slides[${i}].cities,k=a.indexOf('${c}');if(this.checked&&k<0)a.push('${c}');if(!this.checked&&k>=0)a.splice(k,1)"> ${escH((cityMeta[c] && cityMeta[c].name) || DEFAULT_CITY[c])}</label>`).join('')}</div>
  </div>`;
}
function layoutMove(kind, i, d) {
  const a = layoutState[kind], j = i + d;
  if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  renderLayout();
}
async function pickSlide(i, input) {
  const f = input.files && input.files[0];
  if (!f) return;
  try { layoutState.slides[i].imageData = await resizeMax(f, 1600); renderLayout(); showToast('عکس انتخاب شد — برای ثبت، «انتشار» را بزنید'); }
  catch (e) { showToast('❌ ' + e.message); }
}

/* خروجی برای data.js */
function layoutOut() {
  const tiles = layoutState.tiles.map(t => ({ id: t.id, on: t.on, ...(t.label.trim() ? { label: t.label.trim() } : {}), ...(t.color ? { color: t.color } : {}) }));
  const slides = layoutState.slides.map(s => ({ image: s.image || (BUILD_PENDING && s.imageData) || '', title: s.title.trim(), tag: s.tag.trim(),
    action: s.action, ...(s.action === 'url' ? { url: s.url.trim() } : {}), cities: s.cities.slice() })).filter(s => s.image);
  return { layout: { tiles, nav: layoutState.nav.filter(n => n.on).map(n => n.id).slice(0, 4), autoSlides: layoutState.autoSlides, prayer: layoutState.prayer, slides } };
}
async function uploadPendingSlides(token) {
  let any = false;
  for (const s of layoutState.slides) {
    if (!s.imageData) continue;
    const path = 'slides/s-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.jpg';
    await putFile(path, '', 'Add slide image', token, s.imageData.split(',')[1]);
    s.image = path; s.imagePreview = s.imageData; delete s.imageData; any = true;
  }
  if (any) renderLayout();
}

(function injectLayoutCSS() {
  document.head.insertAdjacentHTML('beforeend', `<style>
  .lay-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)}
  .lay-row.off{opacity:.5}
  .lay-ic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;color:#fff}
  .lay-chk input{width:20px;height:20px}
  .lay-name{flex:1;min-width:0}
  .lay-col{width:92px;flex-shrink:0}
  .lay-mv{display:flex;gap:4px;flex-shrink:0}
  .lay-mv button{width:32px;height:32px;border:1px solid var(--border-s);border-radius:8px;background:var(--card);cursor:pointer;font-size:11px}
  .lay-navprev{display:flex;justify-content:space-around;align-items:center;gap:4px;margin-top:10px;padding:10px 6px;border-radius:12px;background:var(--bg);border:1px dashed var(--border-s);font-size:12px;text-align:center}
  .lay-slide{display:flex;flex-direction:column;gap:6px;padding:10px;margin-bottom:10px;border:1px solid var(--border-s);border-radius:12px;background:var(--bg)}
  .lay-thumb{width:120px;aspect-ratio:16/9;border-radius:10px;background:#ddd center/cover;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
  </style>`);
})();
