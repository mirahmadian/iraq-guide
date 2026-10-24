/* ══════════════════════════════════════════
   BESAT — برنامه‌های فرهنگی بعثه (برنامه ثابت روزانه هر شهر)
   نوار «برنامه بعدی» در صفحه هر شهر + صفحه کامل برنامه‌ها
   داده: CARAVAN_DATA.besat = { enabled, title, logo, emblem, cities: { najaf: [program] } }
══════════════════════════════════════════ */
(function injectBesatCSS() {
  const css = `
  .besat-strip{display:flex;align-items:center;gap:12px;width:100%;margin:0 0 14px;padding:10px 12px;border-radius:var(--r);
    border:1px solid var(--brass-l,#C9A24B);background:var(--card);box-shadow:var(--shadow);cursor:pointer;font-family:var(--font);color:var(--text);text-align:right}
  .besat-strip .bs-logo{width:46px;height:46px;border-radius:12px;background:#fff center/72% no-repeat;flex-shrink:0;border:1px solid var(--border)}
  .besat-strip .bs-txt{flex:1;min-width:0}
  .besat-strip .bs-when{display:flex;align-items:center;gap:6px;font-size:calc(12px * var(--fs,1));font-weight:800;color:var(--brass);line-height:1.6}
  .besat-strip .bs-title{display:block;font-size:calc(14.5px * var(--fs,1));font-weight:900;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .besat-strip .bs-place{display:block;font-size:calc(12px * var(--fs,1));color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .besat-strip .bs-all{display:flex;align-items:center;gap:2px;flex-shrink:0;font-size:calc(11.5px * var(--fs,1));font-weight:800;color:var(--pri-ink)}
  .besat-strip .chev{width:15px;height:15px}
  .bs-live{display:inline-flex;align-items:center;gap:5px;padding:0 8px;border-radius:100px;background:var(--c-clinic);color:#fff;font-size:calc(11px * var(--fs,1))}
  .bs-live::before{content:'';width:7px;height:7px;border-radius:50%;background:#fff;animation:bsPulse 1.4s infinite}
  @keyframes bsPulse{50%{opacity:.3}}
  .bs-hidden{font-size:calc(10.5px * var(--fs,1));color:var(--c-clinic);font-weight:800;margin-inline-start:6px}

  .besat-view{position:fixed;inset:0;z-index:240;background:var(--bg);display:none;overflow-y:auto;overscroll-behavior:contain}
  .besat-view.open{display:block}
  .bv-inner{max-width:480px;margin:0 auto;min-height:100%;padding-bottom:40px}
  .bv-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--hdr-bg,#0E5A44) var(--pat);background-size:48px;color:#fff}
  .bv-head button{width:42px;height:42px;border-radius:12px;border:1px solid rgba(201,162,75,.55);background:rgba(255,255,255,.08);color:#fff;font-size:16px;cursor:pointer;flex-shrink:0}
  .bv-head .bv-t{flex:1;font-size:calc(15px * var(--fs,1));font-weight:900;line-height:1.5}
  .bv-logo{margin:14px 14px 0;padding:12px;border-radius:var(--r);background:#fff;border:1px solid var(--brass-l,#C9A24B);display:flex;justify-content:center}
  .bv-logo img{max-width:100%;max-height:84px;display:block}
  .bv-tabs{display:flex;gap:6px;padding:12px 14px 4px;overflow-x:auto;scrollbar-width:none}
  .bv-tabs button{flex:1 0 auto;min-height:46px;padding:0 16px;border-radius:12px;border:1px solid var(--border-s);background:var(--card);color:var(--muted);
    font-family:var(--font);font-size:calc(13.5px * var(--fs,1));font-weight:800;cursor:pointer}
  .bv-tabs button.on{background:var(--gold);border-color:var(--gold);color:#fff;box-shadow:inset 0 -3px 0 var(--brass-l)}
  .bv-note{margin:8px 16px 4px;font-size:calc(12px * var(--fs,1));color:var(--dim);text-align:center}
  .bv-list{padding:6px 14px}
  .bp{display:flex;gap:12px;margin-top:12px;padding:14px;border-radius:var(--r);background:var(--card);border:1px solid var(--border);box-shadow:var(--shadow)}
  .bp.now{border:2px solid var(--c-clinic)}
  .bp.next{border:2px solid var(--brass-l)}
  .bp.off{opacity:.62}
  .bp-time{flex-shrink:0;width:68px;text-align:center;padding:8px 4px;border-radius:12px;background:var(--gold-dim);color:var(--pri-ink);align-self:flex-start}
  .bp-time b{display:block;font-size:calc(18px * var(--fs,1));font-weight:900;line-height:1.3}
  .bp-time small{display:block;font-size:calc(11px * var(--fs,1));color:var(--dim);line-height:1.5}
  .bp-body{flex:1;min-width:0}
  .bp-badge{display:inline-block;margin-bottom:4px;padding:0 9px;border-radius:100px;font-size:calc(11px * var(--fs,1));font-weight:800;border:1px solid var(--brass-l);color:var(--brass)}
  .bp.now .bp-badge{background:var(--c-clinic);border-color:var(--c-clinic);color:#fff}
  .bp-title{font-size:calc(15.5px * var(--fs,1));font-weight:900;line-height:1.55}
  .bp-row{font-size:calc(13px * var(--fs,1));color:var(--muted);line-height:1.8;margin-top:2px}
  .bp-desc{font-size:calc(13px * var(--fs,1));color:var(--text);line-height:1.9;margin-top:6px}
  .bp-poster{display:block;margin-top:10px;max-width:100%;max-height:240px;border-radius:12px;cursor:zoom-in;border:1px solid var(--border)}
  .bp .map-row{padding:10px 0 0;border:none}
  .bv-empty{padding:30px 16px;text-align:center;color:var(--dim)}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

const BESAT_DAY_NAMES = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const BESAT_WEEK = [6, 0, 1, 2, 3, 4, 5];

function besat() { return CARAVAN_DATA.besat || null; }
function besatList(cityId) { const b = besat(); return (b && b.cities && b.cities[cityId]) || []; }
function besatVisible(cityId) { const b = besat(); return !!b && (b.enabled || SHOW_HIDDEN) && besatList(cityId).length > 0; }
const besatMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : -1; };
const besatOnDay = (p, d) => !p.days || !p.days.length || p.days.includes(d);
const besatSorted = list => list.slice().sort((a, b) => besatMin(a.start) - besatMin(b.start));
function besatEnd(p) { const e = besatMin(p.end); return e > 0 ? e : besatMin(p.start) + 60; }
function besatDays(p) {
  if (!p.days || !p.days.length || p.days.length === 7) return 'هر روز';
  return BESAT_WEEK.filter(d => p.days.includes(d)).map(d => BESAT_DAY_NAMES[d]).join('، ');
}

/* وضعیت برنامه‌ها نسبت به ساعت گوشی */
function besatNext(cityId, now = new Date()) {
  const list = besatSorted(besatList(cityId)), day = now.getDay(), m = now.getHours() * 60 + now.getMinutes();
  const today = list.filter(p => besatOnDay(p, day));
  const live = today.find(p => besatMin(p.start) <= m && m < besatEnd(p));
  if (live) return { p: live, when: 'now' };
  const later = today.find(p => besatMin(p.start) > m);
  if (later) return { p: later, when: 'today' };
  for (let k = 1; k <= 7; k++) {
    const d = (day + k) % 7, p = list.find(x => besatOnDay(x, d));
    if (p) return { p, when: k === 1 ? 'tomorrow' : BESAT_DAY_NAMES[d] };
  }
  return null;
}
function besatWhenHTML(n) {
  const t = faDigits(n.p.start || '');
  if (n.when === 'now') return `<span class="bs-live">هم‌اکنون</span>`;
  if (n.when === 'today') return `امروز ساعت ${t}`;
  if (n.when === 'tomorrow') return `فردا ساعت ${t}`;
  return `${n.when} ساعت ${t}`;
}
function besatEmblem() { const b = besat(); return (b && b.emblem) || 'besat-emblem.png'; }

function besatStripHTML(city) {
  if (!besatVisible(city.id)) return '';
  const n = besatNext(city.id);
  if (!n) return '';
  return `<button class="besat-strip" data-city="${city.id}" onclick="openBesat('${city.id}')" aria-label="برنامه‌های فرهنگی بعثه">
    <span class="bs-logo" style="background-image:url('${escHtml(besatEmblem())}')" aria-hidden="true"></span>
    <span class="bs-txt">
      <span class="bs-when">${besatWhenHTML(n)}${besat().enabled ? '' : '<span class="bs-hidden">پنهان از کاربران</span>'}</span>
      <span class="bs-title">${escHtml(n.p.title)}</span>
      ${n.p.place ? `<span class="bs-place">📍 ${escHtml(n.p.place)}</span>` : ''}
    </span>
    <span class="bs-all">همه برنامه‌ها${CHEV_FWD}</span>
  </button>`;
}
/* هر دقیقه «هم‌اکنون / بعدی» به‌روز شود */
setInterval(() => {
  document.querySelectorAll('.besat-strip').forEach(el => {
    const city = CARAVAN_DATA.cities.find(c => c.id === el.dataset.city);
    if (city) el.outerHTML = besatStripHTML(city) || '<span></span>';
  });
  const v = document.getElementById('besatView');
  if (v && v.classList.contains('open')) renderBesatView();
}, 60000);

/* ── صفحه کامل ── */
let besatCity = null;
function openBesat(cityId) {
  besatCity = cityId;
  let v = document.getElementById('besatView');
  if (!v) {
    document.body.insertAdjacentHTML('beforeend', `<div class="besat-view" id="besatView" role="dialog" aria-modal="true" aria-label="برنامه‌های فرهنگی بعثه"></div>`);
    v = document.getElementById('besatView');
  }
  renderBesatView();
  v.scrollTop = 0;
  v.classList.add('open');
  document.documentElement.style.overflow = 'hidden';
  if (!(history.state && history.state.besat)) history.pushState({ besat: 1 }, '');
}
function hideBesat() {
  const v = document.getElementById('besatView');
  if (v) v.classList.remove('open');
  document.documentElement.style.overflow = '';
}
function closeBesat() { if (history.state && history.state.besat) history.back(); else hideBesat(); }
window.addEventListener('popstate', () => {
  const v = document.getElementById('besatView');
  if (v && v.classList.contains('open')) hideBesat();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeBesat(); });

function renderBesatView() {
  const b = besat(), v = document.getElementById('besatView');
  if (!b || !v) return;
  const cities = CARAVAN_DATA.cities.filter(c => (!c.hidden || SHOW_HIDDEN) && besatVisible(c.id));
  if (!cities.some(c => c.id === besatCity) && cities.length) besatCity = cities[0].id;
  const now = new Date(), day = now.getDay(), m = now.getHours() * 60 + now.getMinutes();
  const n = besatNext(besatCity, now);
  const list = besatSorted(besatList(besatCity));
  v.innerHTML = `<div class="bv-inner">
    <div class="bv-head"><button onclick="closeBesat()" aria-label="بستن">✕</button><div class="bv-t">${escHtml(b.title || 'برنامه‌های فرهنگی بعثه')}</div></div>
    <div class="bv-logo"><img src="${escHtml(b.logo || 'besat-logo.png')}" alt="${escHtml(b.title || '')}"></div>
    ${cities.length > 1 ? `<div class="bv-tabs" role="tablist">${cities.map(c =>
      `<button class="${c.id === besatCity ? 'on' : ''}" role="tab" aria-selected="${c.id === besatCity}" onclick="besatCity='${c.id}';renderBesatView()">${escHtml(c.name)}</button>`).join('')}</div>` : ''}
    <div class="bv-note">برنامه ثابت روزانه · امروز ${BESAT_DAY_NAMES[day]}</div>
    <div class="bv-list">${list.length ? list.map(p => {
      const onToday = besatOnDay(p, day), s = besatMin(p.start);
      const live = onToday && s <= m && m < besatEnd(p), isNext = !live && n && n.p === p;
      const done = onToday && !live && besatEnd(p) <= m;
      const badge = live ? 'هم‌اکنون در حال اجرا' : isNext ? (n.when === 'today' ? 'برنامه بعدی' : 'برنامه بعدی · ' + (n.when === 'tomorrow' ? 'فردا' : n.when))
        : !onToday ? 'امروز برگزار نمی‌شود' : done ? 'برنامه امروز تمام شده' : '';
      return `<div class="bp ${live ? 'now' : isNext ? 'next' : (!onToday || done) ? 'off' : ''}">
        <div class="bp-time"><b dir="ltr">${faDigits(p.start || '')}</b>${p.end ? `<small>تا ${faDigits(p.end)}</small>` : ''}<small>${besatDays(p)}</small></div>
        <div class="bp-body">
          ${badge ? `<span class="bp-badge">${badge}</span>` : ''}
          <div class="bp-title">${escHtml(p.title)}</div>
          ${p.speaker ? `<div class="bp-row">🎤 ${escHtml(p.speaker)}</div>` : ''}
          ${p.place ? `<div class="bp-row">📍 ${escHtml(p.place)}</div>` : ''}
          ${p.desc ? `<div class="bp-desc">${richText(p.desc)}</div>` : ''}
          ${p.poster ? `<img class="bp-poster" src="${escHtml(p.poster)}" alt="پوستر ${escHtml(p.title)}" loading="lazy" onclick="openPhoto(this.src,'')">` : ''}
          ${mapRowHTML(p.mapNeshanUrl, p.mapGoogleUrl)}
        </div>
      </div>`;
    }).join('') : '<div class="bv-empty">برنامه‌ای برای این شهر ثبت نشده است</div>'}</div>
  </div>`;
}
