/* ══════════════════════════════════════════
   🍽️ «امروز چی داریم؟» — کارت صفحه‌ی اول، پاپ‌آپ سر وقت هر وعده، ساعت سرو، عکس غذا و نظرسنجی بعد از وعده
   ساعت‌ها به وقت عراق (Asia/Baghdad). ساعت سرو از پنل (food.times)؛ اگر تعریف نشده باشد، فقط برای زمان‌بندی پاپ‌آپ
   از ساعت‌های پیش‌فرض استفاده می‌شود و ساعتی به زائر نشان داده نمی‌شود.
   نظر زائر: POST /food/vote (شهر و آشپزخانه را خودش انتخاب می‌کند؛ مدیر آشپزخانه در گزارش از روی تاریخ پیدا می‌شود).
══════════════════════════════════════════ */
const FT_MEALS = ['breakfast', 'lunch', 'dinner'];
const FT_FA = { breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام' }, FT_ICO = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' };
const FT_DEF = { breakfast: { from: '07:00', to: '09:00' }, lunch: { from: '13:00', to: '14:30' }, dinner: { from: '20:00', to: '21:30' } };
const FT_POP = 'caravan-food-pop', FT_VOTED = 'caravan-food-voted', FT_KIT = 'caravan-food-kitchens', FT_CITY = 'caravan-food-city';
const ftJ = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
const ftS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const ftMin = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };

/* اکنون به وقت عراق */
function ftNow() {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
    return { iso: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
  } catch (e) { const d = new Date(Date.now() + 3 * 36e5); return { iso: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; }
}
const ftTimes = () => (food() || {}).times || {};
const ftWin = m => { const t = ftTimes()[m]; return t && ftMin(t.from) != null && ftMin(t.to) != null ? t : FT_DEF[m]; };
const ftHas = m => { const t = ftTimes()[m]; return !!(t && ftMin(t.from) != null && ftMin(t.to) != null); };
/* «۷:۳۰» و «۱۳» */
const ftT = s => { const [h, m] = s.split(':').map(Number); return faNum(h) + (m ? ':' + faDigits(String(m).padStart(2, '0')) : ''); };
const ftRange = m => { const t = ftTimes()[m]; return ftHas(m) ? `ساعت ${ftT(t.from)} تا ${ftT(t.to)}` : ''; };

/* روز برنامه برای امروز (+فردا) — فقط وقتی روز ورود تنظیم شده و سفر در جریان است */
function ftDayOf(offset = 0) {
  const ti = tripInfo(); if (!ti) return null;
  const diff = ti.diff + offset; if (diff < 0 || diff > 45) return null;
  const plan = findPlan(); if (!plan) return null;
  return { plan, n: diff + 1, d: (plan.days || [])[diff % 6] || {} };
}
const ftDish = (m, d) => (d && d[m] ? (m === 'breakfast' ? d[m].hot : d[m].main) : '') || '';
/* وعده‌ی جاری یا بعدی: بعد از پایان شام ← صبحانه‌ی فردا */
function ftNext() {
  const now = ftNow();
  for (const m of FT_MEALS) { const w = ftWin(m); if (now.min < ftMin(w.to)) return { meal: m, off: 0, live: now.min >= ftMin(w.from), now }; }
  return { meal: 'breakfast', off: 1, live: false, now };
}
function ftPhoto(name) {
  const P = (food() || {}).photos || {}; if (!name) return '';
  if (P[name]) return P[name];
  const n = normName(name), k = Object.keys(P).find(x => normName(x) === n);
  return k ? P[k] : '';
}

/* ── کارت صفحه‌ی اول ── */
/* آخرین کارتی که روی صفحه‌ی اول چیده شده؛ اگر با حالت فعلی فرق کند (روز سفر عوض شد، وعده عوض شد، …) صفحه‌ی اول دوباره چیده می‌شود */
let ftShown = null;
function foodTodayHTML() { ftShown = ftCardHTML(); return ftShown; }
function ftSync() {
  if (document.getElementById('foodView')?.classList.contains('open') || document.querySelector('.overlay.open')) return;
  if (typeof renderHome !== 'function' || !document.querySelector('.home')) return;
  if (ftCardHTML() !== ftShown) { try { renderHome(); } catch (e) {} }
}
setInterval(ftSync, 60000);
function ftCardHTML() {
  if (typeof foodVisible !== 'function' || !foodVisible()) return '';
  if (!findPlan()) return typeof needsGrade === 'function' && needsGrade() ? `<button class="ft-card soft" onclick="ftSetup()"><span class="ft-ic" aria-hidden="true">🍽️</span><span class="ft-tx"><b>امروز چی داریم؟</b>
    <small>درجه‌ی هتل محل اسکان را انتخاب کنید تا منوی شما را همین‌جا ببینید</small></span><span class="ft-go" aria-hidden="true">‹</span></button>` : '';
  const ti = tripInfo();
  if (!ti) return `<button class="ft-card soft" onclick="ftSetup()"><span class="ft-ic" aria-hidden="true">🍽️</span><span class="ft-tx"><b>امروز چی داریم؟</b>
    <small>روز ورود کاروان را انتخاب کنید تا منوی هر وعده را همین‌جا ببینید</small></span><span class="ft-go" aria-hidden="true">‹</span></button>`;
  const x = ftNext(), day = ftDayOf(x.off); if (!day) return '';
  const m = day.d[x.meal] || {}, dish = ftDish(x.meal, day.d), ph = ftPhoto(dish), rng = ftRange(x.meal);
  const when = x.off ? `${FT_FA[x.meal]} فردا` : x.live ? `الان: ${FT_FA[x.meal]}` : `${FT_FA[x.meal]} امروز`;
  return `<button class="ft-card" onclick="ftOpen()">${ph ? `<img class="ft-ph" src="${escHtml(ph)}" alt="">` : `<span class="ft-ic" aria-hidden="true">${FT_ICO[x.meal]}</span>`}
    <span class="ft-tx"><small class="ft-when">${FT_ICO[x.meal]} ${when}${rng ? ' · ' + rng : ''}</small><b>${escHtml(dish || 'منوی امروز')}</b>
    ${m.fruit ? `<small>🍎 ${escHtml(m.fruit)}</small>` : ''}</span><span class="ft-go" aria-hidden="true">‹</span></button>`;
}
function ftOpen() { foodPrefs.tab = 'daily'; saveFoodPrefs(); openFood(); }
function ftSetup() { foodPrefs.setup = true; foodPrefs.tab = 'daily'; saveFoodPrefs(); openFood(); }

/* ── خط «ساعت سرو» بالای منو و در هر کارت وعده ── */
function foodNowHTML() {
  if (!FT_MEALS.some(ftHas)) return '';
  const x = ftNext(), r = ftRange(x.meal);
  if (!r) return '';
  return `<div class="ft-now">⏰ ${x.live ? `${FT_FA[x.meal]} الان در حال سرو است — تا ${ftT(ftTimes()[x.meal].to)}` : `${FT_FA[x.meal]} ${x.off ? 'فردا' : 'امروز'} ${r}`}</div>`;
}
/* افزوده‌های هر کارت وعده (از food.js): ساعت، عکس، دکمه‌ی نظر */
function ftMealExtra(kind, dish, dayNo) {
  const ph = ftPhoto(dish), rng = ftRange(kind);
  let h = '';
  if (ph) h += `<button class="ft-mph has-photo" data-photo="${escHtml(ph)}" data-cap="${escHtml(dish)}" aria-label="بزرگ کردن عکس ${escHtml(dish)}"><img src="${escHtml(ph)}" alt="" loading="lazy"><span>🔍</span></button>`;
  if (rng) h += `<div class="ft-mt">🕖 ${rng}</div>`;
  const today = ftDayOf(0), now = ftNow();
  if (today && dayNo === (today.n - 1) % 6 + 1 && now.min >= ftMin(ftWin(kind).from)) {
    const v = ftJ(FT_VOTED, {})[now.iso + kind];
    h += v ? `<div class="ft-mt">✅ نظر شما ثبت شد ${['', '😞', '😐', '😋'][v]} <button class="ft-lnk" onclick="ftVote('${kind}')">تغییر</button></div>`
      : `<button class="ft-vbtn" onclick="ftVote('${kind}')">⭐ ${FT_FA[kind]} امروز چطور بود؟</button>`;
  }
  return h;
}

/* ── پاپ‌آپ‌ها: سر وقت وعده (از ۶۰ دقیقه قبل تا پایان سرو) و بعد از وعده (تا ۵ ساعت) برای نظر ── */
function ftModal(id, inner) {
  document.body.insertAdjacentHTML('beforeend', `<div class="overlay open" id="${id}" role="dialog" aria-modal="true" onclick="if(event.target===this)ftClose('${id}')"><div class="modal ft-pop"><div class="modal-handle" aria-hidden="true"></div>${inner}</div></div>`);
}
function ftClose(id) { const v = document.getElementById(id); if (v) v.remove(); }
function ftPopCheck() {
  if (document.querySelector('.overlay.open') || window.__swUpdating || document.getElementById('foodView')?.classList.contains('open')) return false;
  if (typeof foodVisible !== 'function' || !foodVisible() || !findPlan() || SHOW_HIDDEN && !/[?&]test=food/.test(location.search)) return false;
  const st = ftJ(FT_POP, {}), now = ftNow();
  const shown = k => st[k], mark = k => { st[k] = Date.now(); for (const x of Object.keys(st)) if (Date.now() - st[x] > 3 * 864e5) delete st[x]; ftS(FT_POP, st); };
  /* ۱. روز ورود تنظیم نشده: روزی یک بار */
  if (!tripInfo()) {
    if (shown('setup' + now.iso)) return false;
    mark('setup' + now.iso);
    ftModal('ftPop', `<div class="ft-pic" aria-hidden="true">🍽️</div><div class="modal-title">منوی غذای هر روز سفرتان را ببینید</div>
      <p class="ft-p">فقط یک بار <b>روز ورود کاروان</b> را انتخاب کنید؛ از آن به بعد هر وعده، منو و ساعت سرو همان روز را به شما نشان می‌دهیم.</p>
      <button class="rv-btn" style="min-height:52px;width:100%" onclick="ftClose('ftPop');ftSetup()">📅 انتخاب روز ورود</button>
      <button class="modal-close" style="margin-top:10px" onclick="ftClose('ftPop')">بعداً</button>`);
    return true;
  }
  const today = ftDayOf(0); if (!today) return false;
  /* ۲. سر وقت وعده (اولویت دارد) */
  for (const m of FT_MEALS) {
    const w = ftWin(m), a = ftMin(w.from), b = ftMin(w.to);
    if (now.min >= a - 60 && now.min < b && !shown('m' + now.iso + m)) {
      mark('m' + now.iso + m);
      const meal = today.d[m] || {}, dish = ftDish(m, today.d), ph = ftPhoto(dish), sides = (meal.sides || []).map(s => s.name).filter(Boolean);
      ftModal('ftPop', `${ph ? `<img class="ft-pimg" src="${escHtml(ph)}" alt="">` : `<div class="ft-pic" aria-hidden="true">${FT_ICO[m]}</div>`}
        <div class="ft-pk">${FT_ICO[m]} ${FT_FA[m]} امروز${ftHas(m) ? ` · ${ftRange(m)}` : ''}</div>
        <div class="modal-title">${escHtml(dish || FT_FA[m])}</div>
        ${meal.fruit ? `<div class="ft-p">🍎 میوه: ${escHtml(meal.fruit)}</div>` : ''}
        ${sides.length ? `<div class="ft-p ft-sides">${sides.slice(0, 8).map(escHtml).join(' · ')}</div>` : ''}
        <button class="rv-btn" style="min-height:52px;width:100%" onclick="ftClose('ftPop');ftOpen()">🍽️ دیدن منوی کامل امروز</button>
        <button class="modal-close" style="margin-top:10px" onclick="ftClose('ftPop')">بستن</button>`);
      return true;
    }
  }
  /* ۳. نظر درباره‌ی آخرین وعده‌ای که تمام شده (تا ۵ ساعت بعد) */
  const last = [...FT_MEALS].reverse().find(m => now.min >= ftMin(ftWin(m).to));
  if (last && now.min < ftMin(ftWin(last).to) + 300 && !ftJ(FT_VOTED, {})[now.iso + last] && !shown('v' + now.iso + last)) { mark('v' + now.iso + last); ftVote(last); return true; }
  return false;
}

/* ── نظرسنجی ── */
let ftV = null;
async function ftKitchens() {
  const c = ftJ(FT_KIT, null);
  if (c && Date.now() - c.t < 6 * 36e5) return c.k;
  try { const r = await fetch(RV_API + '/food/kitchens', { cache: 'no-store' }).then(x => x.json()); ftS(FT_KIT, { t: Date.now(), k: r.kitchens || [] }); return r.kitchens || []; }
  catch (e) { return c ? c.k : []; }
}
async function ftVote(m) {
  const today = ftDayOf(0); if (!today) return;
  ftClose('ftVote');
  const cities = (CARAVAN_DATA.cities || []).filter(c => ['najaf', 'karbala', 'kadhimiya', 'samarra'].includes(c.id));
  let city = ftJ(FT_CITY, null); try { city = city || sessionStorage.getItem('caravan-city'); } catch (e) {}
  ftV = { m, dish: ftDish(m, today.d), city: cities.some(c => c.id === city) ? city : '', kitchen: '', vote: ftJ(FT_VOTED, {})[ftNow().iso + m] || 0, kits: [] };
  ftModal('ftVote', '<div id="ftVB"></div>');
  ftVRender();
  ftV.kits = await ftKitchens(); ftVRender();
}
function ftVRender() {
  const b = document.getElementById('ftVB'); if (!b || !ftV) return;
  const cities = (CARAVAN_DATA.cities || []).filter(c => ['najaf', 'karbala', 'kadhimiya', 'samarra'].includes(c.id));
  const ks = ftV.kits.filter(k => k.city === ftV.city);
  if (ks.length === 1) ftV.kitchen = ks[0].id; else if (!ks.some(k => k.id === +ftV.kitchen)) ftV.kitchen = '';
  b.innerHTML = `<div class="ft-pk">${FT_ICO[ftV.m]} ${FT_FA[ftV.m]} امروز</div><div class="modal-title">${escHtml(ftV.dish || FT_FA[ftV.m])} چطور بود؟</div>
    <div class="ft-votes">${[[3, '😋', 'خوب'], [2, '😐', 'متوسط'], [1, '😞', 'ضعیف']].map(([v, e, t]) => `<button class="${ftV.vote === v ? 'on' : ''}" onclick="ftV.vote=${v};ftVRender()"><span>${e}</span>${t}</button>`).join('')}</div>
    <div class="ft-lbl">الان در کدام شهر هستید؟</div>
    <div class="ft-chips">${cities.map(c => `<button class="${ftV.city === c.id ? 'on' : ''}" onclick="ftV.city='${c.id}';ftVRender()">${escHtml(c.name)}</button>`).join('')}</div>
    ${ks.length > 1 ? `<div class="ft-lbl">غذا از کدام آشپزخانه بود؟</div><div class="ft-chips">${ks.map(k => `<button class="${+ftV.kitchen === k.id ? 'on' : ''}" onclick="ftV.kitchen=${k.id};ftVRender()">${escHtml(k.name)}</button>`).join('')}</div>` : ''}
    ${ftV.vote && ftV.vote < 3 ? `<textarea id="ftNote" class="ft-note" maxlength="300" oninput="ftV.note=this.value" placeholder="اگر دوست دارید بنویسید چه چیزی خوب نبود (اختیاری)">${escHtml(ftV.note || '')}</textarea>` : ''}
    <button class="rv-btn" style="min-height:50px;width:100%;margin-top:10px" ${ftV.vote && ftV.city && (ks.length < 2 || ftV.kitchen) ? '' : 'disabled'} onclick="ftVSend(this)">ثبت نظر</button>
    <button class="modal-close" style="margin-top:8px" onclick="ftClose('ftVote')">بعداً</button>
    <p class="ft-p" style="font-size:.85em;margin-top:6px">نظر شما بی‌نام به ستاد می‌رسد تا کیفیت غذا بهتر شود.</p>`;
}
async function ftVSend(btn) {
  const n = document.getElementById('ftNote'); if (n) ftV.note = n.value.trim();
  btn.disabled = true; btn.textContent = '⏳';
  const now = ftNow();
  try {
    const r = await fetch(RV_API + '/food/vote', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dev': rvDev() },
      body: JSON.stringify({ day: now.iso, meal: ftV.m, city: ftV.city, kitchen: ftV.kitchen || null, vote: ftV.vote, note: ftV.vote < 3 ? ftV.note || '' : '', dish: ftV.dish, ctype: foodPrefs.type, grade: foodPrefs.grade }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'ثبت نشد');
    const v = ftJ(FT_VOTED, {}); v[now.iso + ftV.m] = ftV.vote; for (const k of Object.keys(v)) if (k.slice(0, 10) < new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10)) delete v[k]; ftS(FT_VOTED, v);
    ftS(FT_CITY, ftV.city);
    ftClose('ftVote'); showToast('ممنون! نظر شما ثبت شد 🌱');
    if (document.getElementById('foodView')?.classList.contains('open') && typeof renderFood === 'function') renderFood();
  } catch (e) { showToast(navigator.onLine === false ? 'اینترنت وصل نیست؛ بعداً دوباره امتحان کنید' : e.message); btn.disabled = false; btn.textContent = 'ثبت نظر'; }
}

/* زمان‌بندی: بعد از صفحه‌ی خوش‌آمد و پنجره‌ی بله؛ هر بار که برنامه دوباره باز/دیده شود */
(function ftWait(t0) {
  let tries = 0;
  const run = () => { if (document.getElementById('splash') && Date.now() - t0 < 9000) return setTimeout(run, 400); if (!ftPopCheck() && document.querySelector('.overlay.open') && tries++ < 30) setTimeout(run, 2000); };
  const go = () => setTimeout(run, 3500);
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tries = 0; setTimeout(run, 1200); ftSync(); } });
})(Date.now());

document.head.insertAdjacentHTML('beforeend', `<style>
  .ft-card{display:flex;gap:12px;align-items:center;width:100%;margin-top:12px;padding:10px 12px;border-radius:var(--r);border:1px solid var(--border-s);background:var(--card);color:var(--text);text-align:right;font-family:var(--font);cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.05)}
  .ft-card.soft{border-style:dashed;border-color:var(--gold);background:var(--gold-dim)}
  .ft-ph{width:64px;height:64px;border-radius:12px;object-fit:cover;flex:none}.ft-ic{font-size:30px;width:52px;text-align:center;flex:none}
  .ft-tx{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.7}.ft-tx b{font-size:calc(15.5px * var(--fs,1));font-weight:900}
  .ft-tx small{font-size:calc(12.5px * var(--fs,1));color:var(--muted);font-weight:700}.ft-when{color:var(--gold)!important}
  .ft-go{font-size:22px;color:var(--muted)}
  .ft-now{margin:0 0 10px;padding:9px 12px;border-radius:12px;background:var(--gold-dim);color:var(--text);font-weight:800;font-size:calc(13.5px * var(--fs,1));line-height:1.8}
  .ft-mph{display:block;position:relative;width:100%;border:0;padding:0;margin:8px 0 4px;border-radius:12px;overflow:hidden;cursor:zoom-in;background:var(--card2)}
  .ft-mph img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}.ft-mph span{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.55);color:#fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px}
  .ft-mt{font-size:calc(12.5px * var(--fs,1));color:var(--muted);font-weight:700;margin:4px 0}
  .ft-vbtn{display:block;width:100%;margin:8px 0 2px;padding:10px;border-radius:12px;border:1px dashed var(--gold);background:var(--gold-dim);color:var(--text);font-family:var(--font);font-weight:800;font-size:calc(13.5px * var(--fs,1));cursor:pointer}
  .ft-lnk{background:none;border:0;color:var(--gold);font-family:var(--font);font-weight:800;text-decoration:underline;cursor:pointer}
  .ft-pop{text-align:center}.ft-pic{font-size:44px;margin:0 0 6px}.ft-pimg{width:100%;max-height:200px;object-fit:cover;border-radius:14px;margin-bottom:10px}
  .ft-pk{color:var(--gold);font-weight:800;font-size:calc(13px * var(--fs,1));margin-bottom:2px}
  .ft-p{color:var(--muted);line-height:1.9;font-size:calc(13.5px * var(--fs,1));margin:4px 0 12px}.ft-sides{font-size:calc(12.5px * var(--fs,1))}
  .ft-votes{display:flex;gap:8px;margin:10px 0}.ft-votes button{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;border-radius:14px;border:2px solid var(--border-s);background:var(--card);color:var(--text);font-family:var(--font);font-weight:800;font-size:calc(13px * var(--fs,1));cursor:pointer}
  .ft-votes button span{font-size:32px}.ft-votes button.on{border-color:var(--gold);background:var(--gold-dim)}
  .ft-lbl{font-size:calc(12.5px * var(--fs,1));font-weight:800;color:var(--muted);margin:10px 0 6px;text-align:right}
  .ft-chips{display:flex;flex-wrap:wrap;gap:6px}.ft-chips button{padding:8px 12px;border-radius:100px;border:1px solid var(--border-s);background:var(--card);color:var(--text);font-family:var(--font);font-weight:700;font-size:calc(13px * var(--fs,1));cursor:pointer}
  .ft-chips button.on{border-color:var(--gold);background:var(--gold);color:#fff}
  .ft-note{width:100%;margin-top:10px;min-height:70px;padding:10px;border-radius:12px;border:1px solid var(--border-s);background:var(--card);color:var(--text);font-family:var(--font);font-size:calc(13.5px * var(--fs,1));box-sizing:border-box}
  .ft-pop .rv-btn[disabled]{opacity:.45}
</style>`);
