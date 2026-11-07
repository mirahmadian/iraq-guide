/* ══════════════════════════════════════════
   HOME — صفحه اول: انتخاب شهر، اسلایدر، نوار بعثه، شبکه آیکون‌ها، نوار پایین
   چیدمان از site.layout می‌آید (پنل ادمین) و اگر نبود، پیش‌فرض‌ها استفاده می‌شوند:
   site.layout = { tiles:[{id,on,label,color}], nav:[id,...], autoSlides, slides:[{image,title,tag,action,url,cities}] }
══════════════════════════════════════════ */
(function injectHomeCSS() {
  const css = `
  .city-chips{display:flex;gap:2px;margin-top:12px;padding:4px;border-radius:16px;background:var(--seg);overflow-x:auto;scrollbar-width:none}
  .city-chips::-webkit-scrollbar{display:none}
  .city-chips button{flex:1 0 auto;min-height:44px;padding:0 12px;border-radius:12px;border:none;background:none;color:var(--muted);
    font-family:var(--font);font-size:calc(13.5px * var(--fs,1));font-weight:800;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.35;transition:background .15s,color .15s}
  .city-chips button.on{background:var(--card);color:var(--text);box-shadow:0 1px 3px rgba(60,40,10,.12),inset 0 -2px 0 var(--brass-l)}
  .city-chips small{font-size:calc(10px * var(--fs,1));color:var(--c-clinic);font-weight:800}
  [data-theme="dark"] .city-chips small{color:var(--i-clinic)}

  .hslider{position:relative;margin-top:12px;border-radius:var(--r);overflow:hidden;background:#0E5A44}
  .hslides{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain}
  .hslides::-webkit-scrollbar{display:none}
  .hslide{flex:0 0 100%;scroll-snap-align:center;aspect-ratio:16/9;position:relative;overflow:hidden;cursor:pointer;border:none;padding:0;background:none;color:#fff;font-family:var(--font);text-align:right}
  .hslide .blur{position:absolute;inset:-20px;background:var(--img) center/cover;filter:blur(16px) brightness(.72)}
  .hslide .fit{position:absolute;inset:0;background:var(--img) center/contain no-repeat}
  .hslide::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(0,0,0,.72))}
  .hslide .cap{position:absolute;right:14px;left:14px;bottom:24px;z-index:1;text-shadow:0 1px 8px rgba(0,0,0,.7)}
  .hslide .cap small{display:inline-block;background:var(--brass-l);color:#2A2116;font-size:calc(11px * var(--fs,1));font-weight:800;padding:0 9px;border-radius:100px;margin-bottom:4px;text-shadow:none}
  .hslide .cap b{display:block;font-size:calc(16px * var(--fs,1));font-weight:900;line-height:1.5}
  .hdots{position:absolute;bottom:8px;left:0;right:0;display:flex;justify-content:center;gap:5px;z-index:2;pointer-events:none}
  .hdots i{width:7px;height:7px;border-radius:100px;background:rgba(255,255,255,.5);transition:width .2s}
  .hdots i.on{width:20px;background:#fff}
  .home .besat-strip{margin:12px 0 0}

  .h-sec{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:22px 4px 10px;font-size:calc(15px * var(--fs,1));font-weight:900;color:var(--text)}
  .h-sec span{font-size:calc(12px * var(--fs,1));color:var(--dim);font-weight:600}
  .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(calc(74px * var(--fs,1)),1fr));gap:18px 4px;padding:18px 8px 16px;
    background:var(--card);border:1px solid var(--border);border-radius:var(--r)}
  .tile{position:relative;display:flex;flex-direction:column;align-items:center;gap:9px;padding:0 2px;border:none;background:none;cursor:pointer;font-family:var(--font);color:var(--text)}
  .tile:active .ti{transform:scale(.94)}
  .tile .ti{width:52px;height:52px;border-radius:17px;display:flex;align-items:center;justify-content:center;color:var(--ti,var(--tc));
    background:var(--card2);background:color-mix(in srgb,var(--tc) 11%,var(--card));
    box-shadow:0 0 0 2px var(--card),0 0 0 3px var(--brass-l);transition:transform .12s}
  .tile .ti .ico{width:26px;height:26px}
  .tile .ti.img{background:#fff}
  .tile .ti.img img{width:36px;height:36px;object-fit:contain;border-radius:8px}
  .tile .ti.img.full img{width:100%;height:100%;border-radius:17px;object-fit:cover}
  .tile .tl{font-size:calc(12px * var(--fs,1));font-weight:700;text-align:center;line-height:1.45}
  .tile .ts{font-size:calc(10.5px * var(--fs,1));color:var(--dim);font-weight:600;margin-top:-7px}
  .tile .thid{position:absolute;top:-6px;left:0;font-size:9.5px;font-weight:800;color:#fff;background:var(--c-clinic);border-radius:100px;padding:0 6px;z-index:1}

  .bot-bar{padding:4px 6px max(6px,env(safe-area-inset-bottom))}
  .nav-row{display:flex;align-items:flex-end;justify-content:space-around}
  .nb{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:54px;padding:0 2px;background:none;border:none;cursor:pointer;
    color:var(--dim);font-family:var(--font);font-size:calc(11px * var(--fs,1));font-weight:800;white-space:nowrap}
  .nb svg,.nb img{width:23px;height:23px;object-fit:contain}
  .nb.on{color:var(--pri-ink)}
  .nb.sos{flex:0 0 auto;padding:0 4px;color:var(--c-clinic)}
  .nb.sos .sb{width:52px;height:52px;margin-top:-20px;border-radius:18px;background:var(--c-clinic);color:#fff;display:flex;align-items:center;justify-content:center;
    box-shadow:0 6px 16px rgba(179,38,30,.35)}
  .nb.sos .sb svg{width:24px;height:24px}
  [data-theme="dark"] .nb.sos{color:var(--i-clinic)}

  .page-view{position:fixed;inset:0;z-index:230;background:var(--bg);display:none;overflow-y:auto;overscroll-behavior:contain}
  .page-view.open{display:block}
  .pv-inner{max-width:480px;margin:0 auto;min-height:100%;padding-bottom:40px}
  .pv-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--hdr-glass,var(--card));-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);color:var(--text)}
  .pv-head button{width:42px;height:42px;border-radius:12px;border:1px solid var(--border-s);background:var(--card);color:var(--text);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center}
  .pv-head .chev{width:20px;height:20px}
  .pv-head b{flex:1;font-size:calc(15.5px * var(--fs,1));font-weight:900;line-height:1.5}
  .pv-body{padding:14px}
  .pv-body .search-wrap{padding:0}
  .pv-body .search-results{margin:12px 0 0}
  .sos-grp{margin-bottom:12px}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

/* آیکون‌های خطی از icons.js */
const HI = new Proxy({}, { get: (_, k) => ico(String(k)) });

const cityClinics = c => [c.clinic, ...(c.places || []).filter(p => p.type === 'clinic')].filter(Boolean);
const placesOf = (c, t) => (c.places || []).filter(p => (PLACE_META[p.type] ? p.type : 'other') === t);
function placeCards(c, t) {
  return (c.places || []).map((p, i) => ({ p, i })).filter(x => (PLACE_META[x.p.type] ? x.p.type : 'other') === t).map(({ p, i }) => sectionCard({
    id: `${c.id}-place-${i}`, kind: t, icoClass: '', icoEmoji: t === 'clinic' ? RC_ICON : PLACE_META[t][0],
    title: p.title, badge: PLACE_META[t][1], badgeClass: 'badge-acc',
    address: p.address, mapNeshan: p.mapNeshanUrl, mapGoogle: p.mapGoogleUrl, contacts: p.contacts
  })).join('');
}
const secOf = (c, k, emoji, badge, extra = {}) => c[k] ? sectionCard({
  id: `${c.id}-${k}`, kind: k, icoClass: 'ico-' + k, icoEmoji: emoji, title: c[k].title, badge, badgeClass: 'badge-acc',
  address: c[k].address || null, mapNeshan: c[k].mapNeshanUrl, mapGoogle: c[k].mapGoogleUrl, contacts: c[k].contacts, ...extra
}) : '';
const hasContacts = g => !!(g && (g.contacts || []).length);

/* همه آیکون‌های ممکن صفحه اول — ترتیب همین فهرست، پیش‌فرض است */
const TILE_DEFS = {
  lost:      { label: 'گم شده‌ام', color: 'clinic', has: () => true, open: () => openLost() },
  stay:      { label: 'تاریخ خروج', color: 'consulate', has: () => typeof openStay === 'function', sub: () => staySub(), open: () => openStay() },
  flight:    { label: 'حرکت به فرودگاه', color: 'transport', has: () => typeof openFlight === 'function', sub: () => flightSub(), open: () => openFlight() },
  guide:     { label: 'راهنمای زائر', color: 'hotel', has: () => typeof guideVisible === 'function' && guideVisible(), hidden: () => !guideSections().some(s => !s.hidden), open: () => openGuide() },
  zyarat:    { label: 'زیارت‌نامه‌ها', color: 'ziyarat', has: () => typeof zyVisible === 'function' && zyVisible(), open: () => openZyarat() },
  hq:        { label: 'ستاد', color: 'hq', has: c => !!c.hq, open: c => openPage(c.hq.title, secOf(c, 'hq', '🏢', 'ستاد', { banner: c.hqBanner })) },
  clinic:    { label: 'درمانگاه', color: 'clinic', has: c => cityClinics(c).length > 0,
               open: c => openPage(cityClinics(c)[0].title, secOf(c, 'clinic', RC_ICON, 'درمانگاه') + placeCards(c, 'clinic')) },
  consulate: { label: 'کنسولگری', color: 'consulate', has: c => !!c.consulate, open: c => openPage(c.consulate.title, secOf(c, 'consulate', '🏛️', 'کنسولگری')) },
  besat:     { label: 'برنامه‌های بعثه', color: 'ziyarat', has: c => besatVisible(c.id), img: () => besatEmblem(),
               hidden: () => !besat().enabled, open: c => openBesat(c.id) },
  hotel:     { label: 'هتل‌ها', color: 'hotel', has: c => (c.hotels || []).length > 0, sub: c => (c.hotels.length).toLocaleString('fa') + ' هتل',
               open: c => { openPage('هتل‌های ' + c.name, hotelSearchSection(c.id, c.hotels)); showDefaultHotels(c.id); } },
  map:       { label: 'نقشه شهر', color: 'parking', has: c => !!(c.map && c.map.image), open: c => openPage('نقشه ' + c.name, cityMapButtonHTML(c)) },
  ins:       { label: 'بیمه معلم', color: 'ins', has: () => hasContacts(CARAVAN_DATA.insurance), img: () => 'ins-logo.png',
               open: () => openPage(CARAVAN_DATA.insurance.title, globalCardHTML(CARAVAN_DATA.insurance, '<img src="ins-logo.png" alt="">', 'ins')) },
  transport: { label: 'ناظر نقل', color: 'transport', has: () => hasContacts(CARAVAN_DATA.transport),
               open: () => openPage(CARAVAN_DATA.transport.title, globalCardHTML(CARAVAN_DATA.transport, '🚌', 'transport')) },
  food:      { label: 'برنامه غذایی', color: 'restaurant', has: () => foodVisible(), hidden: () => !food().enabled, open: () => openFood() },
  currency:  { label: 'تبدیل ارز', color: 'ins', has: () => typeof openCurrency === 'function', open: () => openCurrency() },
  ziyarat:   { label: 'اماکن زیارتی', color: 'ziyarat', has: c => placesOf(c, 'ziyarat').length > 0, open: c => openPage('اماکن زیارتی ' + c.name, placeCards(c, 'ziyarat')) },
  restaurant:{ label: 'رستوران', color: 'restaurant', has: c => placesOf(c, 'restaurant').length > 0, open: c => openPage('رستوران‌ها', placeCards(c, 'restaurant')) },
  parking:   { label: 'پارکینگ', color: 'parking', has: c => placesOf(c, 'parking').length > 0, open: c => openPage('پارکینگ‌ها', placeCards(c, 'parking')) },
  other:     { label: 'سایر مکان‌ها', color: 'other', has: c => placesOf(c, 'other').length > 0, open: c => openPage('سایر مکان‌ها', placeCards(c, 'other')) }
};
/* دکمه‌های قابل انتخاب نوار پایین (دکمه وسط «شماره‌های ضروری» همیشه ثابت است) */
const NAV_DEFS = {
  home:   { label: 'خانه', icon: () => HI.home, act: () => goHome() },
  lost:   { label: 'گم شده‌ام', icon: () => HI.lost, act: () => openLost() },
  stay:   { label: 'تاریخ خروج', icon: () => HI.stay, act: () => openStay() },
  guide:  { label: 'راهنما', icon: () => HI.guide, act: () => openGuide() },
  search: { label: 'جستجو', icon: () => HI.search, act: () => openSearch() },
  besat:  { label: 'بعثه', icon: () => HI.besat, act: () => openBesat(homeCity().id), has: () => CARAVAN_DATA.cities.some(c => besatVisible(c.id)) },
  more:   { label: 'بیشتر', icon: () => HI.more, act: () => openMore() },
  map:    { label: 'نقشه', icon: () => HI.map, act: () => TILE_DEFS.map.has(homeCity()) ? TILE_DEFS.map.open(homeCity()) : showToast('برای این شهر نقشه ثبت نشده'), },
  hotel:  { label: 'هتل‌ها', icon: () => HI.hotel, act: () => TILE_DEFS.hotel.has(homeCity()) ? TILE_DEFS.hotel.open(homeCity()) : showToast('برای این شهر هتلی ثبت نشده') },
  food:   { label: 'غذا', icon: () => HI.food, act: () => openFood(), has: () => foodVisible() },
  currency: { label: 'ارز', icon: () => HI.currency, act: () => openCurrency() },
  hq:     { label: 'ستاد', icon: () => HI.hq, act: () => TILE_DEFS.hq.has(homeCity()) && TILE_DEFS.hq.open(homeCity()) }
};
const DEFAULT_NAV = ['home', 'search', 'besat', 'more'];

function homeLayout() {
  const L = (CARAVAN_DATA.site || {}).layout || {};
  const saved = (L.tiles || []).filter(t => TILE_DEFS[t.id]);
  const tiles = saved.slice();
  /* آیکون تازه‌ای که در چیدمان ذخیره‌شده نیست، سر جای پیش‌فرض خودش اضافه می‌شود */
  Object.keys(TILE_DEFS).forEach((id, i) => { if (!saved.some(t => t.id === id)) tiles.splice(Math.min(i, tiles.length), 0, { id, on: true }); });
  const nav = (L.nav && L.nav.length ? L.nav : DEFAULT_NAV).filter(id => NAV_DEFS[id]).slice(0, 4);
  return { tiles, nav, autoSlides: L.autoSlides !== false, slides: L.slides || [] };
}

let homeCityId = null;
let cityPicked = false;   // کاربر در همین نشست خودش شهر را انتخاب کرده؟

/* شهر پیش‌فرض با موقعیت گوشی: نزدیک‌ترین شهر در شعاع ~۴۰ کیلومتر؛ اگر هیچ‌کدام نبود، همان شهر اول (نجف) می‌ماند */
const CITY_RADIUS_KM = 40;
function nearestCityId(lat, lng) {
  let best = null, bd = CITY_RADIUS_KM;
  homeCities().forEach(c => {
    const p = PRAYER_COORDS[c.id];
    if (!p) return;
    const dy = (lat - p[0]) * 111, dx = (lng - p[1]) * 111 * Math.cos(lat * Math.PI / 180), d = Math.hypot(dx, dy);
    if (d < bd) { bd = d; best = c.id; }
  });
  return best;
}
function cityFromLocation() {
  if (cityPicked || !navigator.geolocation) return;
  const go = () => navigator.geolocation.getCurrentPosition(pos => {
    if (cityPicked) return;
    const id = nearestCityId(pos.coords.latitude, pos.coords.longitude);
    if (!id || id === homeCity().id) return;
    homeCityId = id;
    try { sessionStorage.setItem('caravan-city', id); } catch (e) {}
    renderHome();
    showToast('📍 شهر شما: ' + homeCity().name);
  }, () => {}, { enableHighAccuracy: false, timeout: 20000, maximumAge: 10 * 60000 });
  if (navigator.permissions && navigator.permissions.query)
    navigator.permissions.query({ name: 'geolocation' }).then(r => { if (r.state !== 'denied') go(); }, go);
  else go();
}
function homeCities() { return CARAVAN_DATA.cities.filter(c => !c.hidden || SHOW_HIDDEN); }
function homeCity() { const l = homeCities(); return l.find(c => c.id === homeCityId) || l[0]; }

function homeSlides(c) {
  const L = homeLayout(), s = [];
  L.slides.filter(x => x.image && (!x.cities || !x.cities.length || x.cities.includes(c.id)))
    .forEach(x => s.push({ img: x.image, tag: x.tag || '', t: x.title || '', action: x.action || '', url: x.url || '' }));
  if (L.autoSlides) {
    const b = siteBannerData();
    if (b && b.top) s.push({ img: b.image, tag: 'اطلاعیه', t: b.title || '', action: '' });
    const bp = besatVisible(c.id) && ((besat() || {}).posters || {})[c.id];
    if (bp) s.push({ img: bp, tag: 'بعثه', t: 'برنامه‌های فرهنگی بعثه در ' + c.name, action: 'besat' });
    if (c.heroImage) s.push({ img: c.heroImage, tag: 'خوش آمدید', t: c.name + ((c.arabic || '').split(' · ')[1] ? ' — ' + c.arabic.split(' · ')[1] : ''), action: '' });
  }
  return s;
}
let homeSlideList = [];
function slideTap(i) {
  const x = homeSlideList[i], c = homeCity();
  if (!x) return;
  if (x.action === 'url' && x.url) return window.open(x.url, '_blank', 'noopener');
  if (x.action === 'besat') return besatVisible(c.id) ? openBesat(c.id) : openPhoto(x.img, '');
  if (TILE_DEFS[x.action] && TILE_DEFS[x.action].has(c)) return TILE_DEFS[x.action].open(c);
  openPhoto(x.img, x.t);
}

/* آیکون هر بخش: پیش‌فرض، یا آیکونی که مدیر در پنل انتخاب کرده (نام از کتابخانه icons.js یا عکس آپلودشده) */
function tileIconHTML(t) {
  const v = t.icon || '';
  if (v.includes('/')) return `<span class="ti img ${t.iconFull ? 'full' : ''}" aria-hidden="true"><img src="${escHtml(v)}" alt=""></span>`;
  return `<span class="ti" aria-hidden="true">${ico(ICONS[v] ? v : (ICONS[t.id] ? t.id : 'other'))}</span>`;
}
function tileHTML(t, c) {
  const T = TILE_DEFS[t.id], color = t.color || T.color;
  return `<button class="tile" onclick="openTile('${t.id}')" style="--tc:var(--c-${color});--ti:var(--i-${color})">
    ${T.hidden && T.hidden() ? '<span class="thid">پنهان</span>' : ''}
    ${tileIconHTML(t)}
    <span class="tl">${escHtml(t.label || T.label)}</span>${T.sub ? `<span class="ts">${T.sub(c)}</span>` : ''}
  </button>`;
}
function openTile(id) { const c = homeCity(), T = TILE_DEFS[id]; if (T && T.has(c)) T.open(c); }

function renderHome() {
  const c = homeCity(), main = document.getElementById('mainContent');
  if (!c) { main.innerHTML = footerHTML(); return; }
  homeCityId = c.id;
  const L = homeLayout(), tiles = L.tiles.filter(t => t.on !== false && TILE_DEFS[t.id].has(c));
  homeSlideList = homeSlides(c);
  main.innerHTML = `<div class="home">
    <div class="city-chips" role="tablist" aria-label="انتخاب شهر">${homeCities().map(x =>
      `<button class="${x.id === c.id ? 'on' : ''}" role="tab" aria-selected="${x.id === c.id}" onclick="switchTab('${x.id}')">${escHtml(x.name)}${x.hidden ? '<small>پنهان از کاربران</small>' : ''}</button>`).join('')}</div>
    ${typeof todayBarHTML === 'function' ? todayBarHTML(c) : ''}
    ${typeof noticesHTML === 'function' ? noticesHTML(c) : ''}
    ${typeof zyStripHTML === 'function' ? zyStripHTML() : ''}
    ${typeof stayAlertHTML === 'function' ? stayAlertHTML() : ''}
    ${typeof flightAlertHTML === 'function' ? flightAlertHTML() : ''}
    ${typeof mgrStripHTML === 'function' ? mgrStripHTML() : ''}
    ${typeof baleStripHTML === 'function' ? baleStripHTML() : ''}
    ${homeSlideList.length ? `<div class="hslider"><div class="hslides" id="hslides" onscroll="slideDotsSync()">${homeSlideList.map((x, i) => `
      <button class="hslide" style="--img:url('${escHtml(encodeURI(x.img))}')" onclick="slideTap(${i})" aria-label="${escHtml(x.t || x.tag || 'اسلاید')}">
        <span class="blur"></span><span class="fit"></span>
        ${x.tag || x.t ? `<span class="cap">${x.tag ? `<small>${escHtml(x.tag)}</small>` : ''}${x.t ? `<b>${escHtml(x.t)}</b>` : ''}</span>` : ''}
      </button>`).join('')}</div>
      ${homeSlideList.length > 1 ? `<div class="hdots" id="hdots">${homeSlideList.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}</div>` : ''}
    ${typeof azanStripHTML === 'function' ? azanStripHTML(c) : ''}
    ${besatStripHTML(c)}
    <div class="h-sec">بخش‌های ${escHtml(c.name)}<span>${tiles.length.toLocaleString('fa')} بخش</span></div>
    <div class="tiles">${tiles.map(t => tileHTML(t, c)).join('')}</div>
    ${footerHTML()}
  </div>`;
  renderNav();
  startSlider();
  if (typeof todayFetch === 'function') todayFetch(c);
  if (typeof zyWatch === 'function' && !zyTimer) zyWatch();
}

/* اسلایدر: هر ۵ ثانیه ورق می‌خورد؛ با لمس کاربر چند ثانیه صبر می‌کند */
let sliderTimer = null, sliderHold = 0;
function slideIndex() { const el = document.getElementById('hslides'); return el && el.clientWidth ? Math.round(Math.abs(el.scrollLeft) / el.clientWidth) : 0; }
function slideDotsSync() { const i = slideIndex(); document.querySelectorAll('#hdots i').forEach((d, k) => d.classList.toggle('on', k === i)); }
function startSlider() {
  clearInterval(sliderTimer);
  const el = document.getElementById('hslides');
  if (!el || el.children.length < 2) return;
  el.addEventListener('touchstart', () => { sliderHold = Date.now(); }, { passive: true });
  sliderTimer = setInterval(() => {
    if (Date.now() - sliderHold < 8000 || document.hidden || document.querySelector('.page-view.open,.besat-view.open,.food-view.open,.mapv.open')) return;
    const box = el.getBoundingClientRect();
    if (box.bottom < 0 || box.top > innerHeight) return;   // وقتی اسلایدر دیده نمی‌شود، عوض نشود
    const n = el.children.length, next = el.children[(slideIndex() + 1) % n];
    /* فقط اسلایدر به پهلو می‌رود؛ scrollIntoView کل صفحه را هم بالا می‌برد */
    const r = next.getBoundingClientRect();
    el.scrollBy({ left: r.left - box.left - (box.width - r.width) / 2, behavior: 'smooth' });
  }, 5000);
}

function renderNav() {
  const bar = document.getElementById('sosBar');
  if (!bar) return;
  const L = homeLayout(), ids = L.nav.filter(id => !NAV_DEFS[id].has || NAV_DEFS[id].has());
  const btn = id => `<button class="nb ${id === 'home' ? 'on' : ''}" onclick="NAV_DEFS['${id}'].act()">${NAV_DEFS[id].icon()}<span>${NAV_DEFS[id].label}</span></button>`;
  const half = Math.ceil(ids.length / 2);
  bar.innerHTML = `<div class="nav-row">${ids.slice(0, half).map(btn).join('')}
    <button class="nb sos" onclick="openSos()" aria-label="شماره‌های ضروری"><span class="sb">${HI.phone}</span><span>شماره‌های ضروری</span></button>
    ${ids.slice(half).map(btn).join('')}</div>`;
}

function goHome() {
  if (document.getElementById('pageView') && document.getElementById('pageView').classList.contains('open')) closePage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── صفحه هر بخش ── */
function openPage(title, html) {
  let v = document.getElementById('pageView');
  if (!v) {
    document.body.insertAdjacentHTML('beforeend', `<div class="page-view" id="pageView" role="dialog" aria-modal="true">
      <div class="pv-inner"><div class="pv-head"><button onclick="closePage()" aria-label="بازگشت">${CHEV_BACK}</button><b id="pvTitle"></b></div><div class="pv-body" id="pvBody"></div></div></div>`);
    v = document.getElementById('pageView');
  }
  restoreSearch();
  document.getElementById('pvTitle').textContent = title;
  document.getElementById('pvBody').innerHTML = html;
  v.classList.add('open');
  v.scrollTop = 0;
  document.documentElement.style.overflow = 'hidden';
  if (!(history.state && history.state.page)) history.pushState({ page: 1 }, '');
}
function hidePage() {
  const v = document.getElementById('pageView');
  if (!v) return;
  v.classList.remove('open');
  restoreSearch();
  document.getElementById('pvBody').innerHTML = '';
  document.documentElement.style.overflow = '';
}
function closePage() { if (history.state && history.state.page) history.back(); else hidePage(); }
window.addEventListener('popstate', () => {
  const v = document.getElementById('pageView');
  if (v && v.classList.contains('open') && !(history.state && history.state.page)) hidePage();
});

/* جستجو: همان کادر جستجوی قبلی داخل یک صفحه */
let searchHome = null;
function openSearch() {
  const wrap = document.querySelector('.search-wrap'), res = document.getElementById('searchResults');
  if (!searchHome) searchHome = { parent: wrap.parentNode, next: wrap.nextSibling };
  openPage('جستجوی شماره‌ها', '');
  const body = document.getElementById('pvBody');
  body.appendChild(wrap); body.appendChild(res);
  setTimeout(() => document.getElementById('searchInput').focus(), 150);
}
function restoreSearch() {
  const wrap = document.querySelector('.search-wrap'), res = document.getElementById('searchResults');
  if (!searchHome || !wrap || wrap.parentNode === searchHome.parent) return;
  searchHome.parent.insertBefore(res, searchHome.next);
  searchHome.parent.insertBefore(wrap, res);
}

/* ── شماره‌های ضروری (دکمه وسط) ── */
function openSos() {
  const c = homeCity();
  const grp = (g, kind, title) => hasContacts(g)
    ? `<div class="sos-grp sec-card k-${kind}"><div class="divider-lbl" style="border-top:none">${escHtml(title || g.title)}</div><div class="contacts" role="list">${g.contacts.map(x => contactHTML(x)).join('')}</div></div>` : '';
  let html = `<button class="sos-lost" onclick="openLost()"><span style="font-size:26px" aria-hidden="true">🆘</span><span>گم شده‌ام<small>کارت عربی آدرس هتل · فرستادن موقعیت من</small></span></button>` + (typeof emergHTML === 'function' ? emergHTML() : '') + grp(c && c.hq, 'hq');
  (c ? cityClinics(c) : []).forEach(cl => { html += grp(cl, 'clinic'); });
  html += grp(CARAVAN_DATA.insurance, 'ins') + grp(CARAVAN_DATA.transport, 'transport');
  const bs = besat();
  if (c && bs && (bs.enabled || SHOW_HIDDEN) && ((bs.contacts || {})[c.id] || []).length) html += grp({ contacts: bs.contacts[c.id] }, 'ziyarat', 'بعثه');
  openPage('شماره‌های ضروری' + (c ? ' — ' + c.name : ''), html || '<div class="sr-empty">شماره‌ای ثبت نشده است</div>');
}
