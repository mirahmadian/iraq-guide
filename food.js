/* ══════════════════════════════════════════
   FOOD PLAN — برنامه غذایی، دورچین و محاسبه مواد آشپز
   داده از CARAVAN_DATA.food خوانده می‌شود (پنل ادمین ← تب برنامه غذایی)
══════════════════════════════════════════ */
(function injectFoodCSS() {
  const css = `
  .food-entry{display:flex;align-items:center;gap:12px;width:calc(100% - 28px);margin:0 14px 10px;padding:13px 14px;
    border-radius:var(--r-sm);border:1px solid rgba(217,128,26,.35);border-top:3px solid #D9801A;background:var(--card);
    box-shadow:var(--shadow);cursor:pointer;font-family:var(--font);text-align:right;color:var(--text)}
  .fe-ico{width:46px;height:46px;border-radius:12px;background:rgba(217,128,26,.13);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
  .fe-txt{flex:1;min-width:0}
  .fe-t{display:block;font-size:calc(14px * var(--fs,1));font-weight:800}
  .fe-s{display:block;font-size:calc(11px * var(--fs,1));color:var(--dim);margin-top:3px;line-height:1.7}
  .fe-arrow{color:var(--dim);flex-shrink:0;display:flex}
  .food-hidden-badge{display:inline-block;margin-right:6px;font-size:calc(9.5px * var(--fs,1));padding:1px 7px;border-radius:5px;
    background:rgba(183,50,50,.12);color:#c0392b;font-weight:700;vertical-align:middle}

  .food-view{position:fixed;inset:0;z-index:240;background:var(--bg);display:none}
  .food-view.open{display:block}
  .fv-inner{max-width:480px;margin:0 auto;height:100%;display:flex;flex-direction:column}
  .fv-head{display:flex;align-items:center;gap:10px;padding:12px 14px 8px}
  .fv-back{width:42px;height:42px;border-radius:11px;border:1px solid var(--border);background:var(--card);color:var(--muted);font-size:16px;cursor:pointer;font-family:var(--font)}
  .fv-title{flex:1;font-size:calc(17px * var(--fs,1));font-weight:900;color:var(--text)}
  .fv-tabs{display:flex;gap:5px;margin:0 14px 10px;padding:5px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r)}
  .fv-tab{flex:1;padding:10px 4px;min-height:44px;border:none;border-radius:10px;background:transparent;color:var(--muted);
    font-family:var(--font);font-size:calc(12px * var(--fs,1));font-weight:800;cursor:pointer}
  .fv-tab.on{background:linear-gradient(135deg,var(--gold),var(--gold-l));color:#fff;box-shadow:0 2px 10px rgba(46,125,94,.3)}
  .fv-body{flex:1;overflow-y:auto;padding:0 14px 50px;-webkit-overflow-scrolling:touch}

  .fcard{background:var(--card);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow);margin-bottom:12px;overflow:hidden}
  .fpreview{background:rgba(183,50,50,.10);color:#c0392b;font-size:calc(11.5px * var(--fs,1));padding:9px 12px;border-radius:10px;margin-bottom:10px;line-height:1.8;font-weight:700}
  .fset-sum{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer}
  .fset-sum .t{flex:1;font-size:calc(12.5px * var(--fs,1));color:var(--text);font-weight:700;line-height:1.8}
  .fset-sum .e{font-size:calc(11.5px * var(--fs,1));color:var(--gold);font-weight:800;white-space:nowrap}
  .fset{padding:2px 14px 16px;border-top:1px solid var(--border)}
  .flabel{font-size:calc(11px * var(--fs,1));color:var(--dim);font-weight:700;margin:14px 0 7px}
  .fseg{display:flex;gap:6px}
  .fchips{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
  .fseg button,.fchips button{flex:1;padding:10px 4px;min-height:44px;border-radius:10px;border:1.5px solid var(--border-s);background:var(--card2);
    color:var(--muted);font-family:var(--font);font-size:calc(13.5px * var(--fs,1));font-weight:800;cursor:pointer}
  .fseg button.on,.fchips button.on{background:var(--gold);border-color:var(--gold);color:#fff}
  .fsel,.fnum{width:100%;padding:10px 12px;min-height:46px;border-radius:10px;border:1.5px solid var(--border-s);background:var(--card2);
    color:var(--text);font-family:var(--font);font-size:calc(13.5px * var(--fs,1))}
  .fnum{text-align:center;font-weight:900;font-size:calc(17px * var(--fs,1))}

  .fstatus{padding:13px 15px;border-radius:var(--r-sm);background:linear-gradient(135deg,var(--gold),var(--gold-l));color:#fff;margin-bottom:12px;box-shadow:0 4px 16px rgba(46,125,94,.25)}
  .fstatus b{font-size:calc(15px * var(--fs,1));display:block}
  .fstatus small{display:block;opacity:.88;font-size:calc(11px * var(--fs,1));margin-top:4px;line-height:1.8}
  .fstatus.soft{background:var(--card);color:var(--muted);border:1px dashed var(--border-s);box-shadow:none}
  .fstatus.soft b{font-size:calc(12.5px * var(--fs,1));font-weight:700}

  .fdays{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-bottom:12px}
  .fday{padding:6px 2px;min-height:54px;border-radius:11px;border:1.5px solid var(--border-s);background:var(--card);color:var(--muted);
    font-family:var(--font);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
  .fday b{font-size:calc(12.5px * var(--fs,1))}
  .fday small{font-size:calc(9.5px * var(--fs,1));color:var(--gold);font-weight:900;min-height:1em}
  .fday.on{background:var(--gold);border-color:var(--gold);color:#fff}
  .fday.on small{color:#fff}

  .meal{--mc:#C77714;--mrgb:217,128,26;border-top:3px solid var(--mc)}
  .meal.m-lunch{--mc:#2E7D5E;--mrgb:46,125,94}
  .meal.m-dinner{--mc:#4F5BB5;--mrgb:79,91,181}
  [data-theme="dark"] .meal{--mc:#F0A04B}
  [data-theme="dark"] .meal.m-lunch{--mc:#4CAF86}
  [data-theme="dark"] .meal.m-dinner{--mc:#8E9BF0}
  .meal-head{display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(var(--mrgb),.08);border-bottom:1px solid rgba(var(--mrgb),.18)}
  .meal-head .n{flex:1;font-size:calc(13px * var(--fs,1));font-weight:900;color:var(--mc)}
  .meal-main{padding:12px 14px 6px;font-size:calc(17px * var(--fs,1));font-weight:900;color:var(--text);line-height:1.6}
  .meal-tags{display:flex;flex-wrap:wrap;gap:6px;padding:2px 14px 12px}
  .mtag{font-size:calc(11.5px * var(--fs,1));padding:5px 11px;border-radius:100px;background:rgba(var(--mrgb),.11);color:var(--mc);font-weight:800;border:none;font-family:var(--font)}
  button.mtag{cursor:pointer;border:1px dashed rgba(var(--mrgb),.5)}
  .sides-t{padding:8px 14px;font-size:calc(10.5px * var(--fs,1));color:var(--dim);font-weight:800;border-top:1px dashed var(--border);background:var(--card2)}
  .side{display:flex;align-items:center;gap:8px;padding:9px 14px;border-top:1px solid var(--border);font-size:calc(13px * var(--fs,1));color:var(--text)}
  .side .dot{width:6px;height:6px;border-radius:50%;background:var(--mc);flex-shrink:0}
  .side .nm{flex:1;min-width:0}
  .side .q{font-size:calc(11.5px * var(--fs,1));color:var(--dim);white-space:nowrap}
  .side .tot{font-size:calc(13px * var(--fs,1));color:var(--mc);font-weight:900;white-space:nowrap;min-width:64px;text-align:left}
  .rc-b{border:none;background:rgba(var(--mrgb),.1);border-radius:6px;cursor:pointer;font-size:12px;padding:1px 5px;margin-right:4px}
  .fempty{padding:26px 16px;text-align:center;color:var(--dim);font-size:calc(12.5px * var(--fs,1));line-height:2}

  .fgroup{font-size:calc(11px * var(--fs,1));color:var(--dim);font-weight:800;margin:6px 2px 7px}
  .frec-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
  .frec-chips button{padding:9px 14px;min-height:42px;border-radius:100px;border:1.5px solid var(--border-s);background:var(--card);color:var(--muted);
    font-family:var(--font);font-size:calc(12.5px * var(--fs,1));font-weight:800;cursor:pointer}
  .frec-chips button.on{background:var(--gold);color:#fff;border-color:var(--gold)}
  .fcard-h{padding:12px 14px;font-weight:900;font-size:calc(14px * var(--fs,1));color:var(--text);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .fcard-h small{font-weight:600;color:var(--dim);font-size:calc(11px * var(--fs,1))}
  .ftable{width:100%;border-collapse:collapse;font-size:calc(12.5px * var(--fs,1))}
  .ftable th{background:var(--card2);color:var(--dim);font-weight:800;padding:9px 12px;text-align:right;font-size:calc(10.5px * var(--fs,1))}
  .ftable td{padding:10px 12px;border-top:1px solid var(--border);color:var(--text);vertical-align:top}
  .ftable td.per{color:var(--muted);white-space:nowrap}
  .ftable td.tot{font-weight:900;color:var(--gold);white-space:nowrap;font-size:calc(13.5px * var(--fs,1))}
  .ftable .inote{font-size:calc(10.5px * var(--fs,1));color:var(--dim);margin-top:2px}
  .fmethod{padding:12px 14px;font-size:calc(12.5px * var(--fs,1));line-height:2.1;color:var(--muted);border-top:1px solid var(--border)}
  .fmethod b{color:var(--text)}
  .fnote{padding:10px 14px;font-size:calc(11.5px * var(--fs,1));color:#A8650F;background:rgba(217,128,26,.08);border-top:1px solid var(--border);line-height:1.9}
  [data-theme="dark"] .fnote{color:#F0A04B}
  .fn-help{font-size:calc(11.5px * var(--fs,1));color:var(--muted);line-height:2;padding:0 14px 12px}
  .fnotes{margin:0;padding:0}
  .fnotes li{list-style:none;padding:10px 14px;border-top:1px solid var(--border);font-size:calc(12.5px * var(--fs,1));line-height:1.9;color:var(--text)}
  .preview-bar{background:#B83232;color:#fff;font-size:calc(11.5px * var(--fs,1));font-weight:700;text-align:center;padding:7px 10px;line-height:1.8;position:relative;z-index:150}
  .preview-bar a{color:#fff;text-decoration:underline;margin-right:6px}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

const FOOD_PREF_KEY = 'caravan-food';
const FOOD_TYPES = { normal: 'عادی', economic: 'اقتصادی' };
const FOOD_DAY_NAMES = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم'];
const FOOD_MASS_UNITS = ['گرم', 'کیلوگرم', 'میلی‌لیتر', 'میلی لیتر', 'لیتر'];

let foodPrefs = { type: 'normal', grade: '', start: '', n: '', tab: 'daily', recipe: '', setup: true };
try { Object.assign(foodPrefs, JSON.parse(localStorage.getItem(FOOD_PREF_KEY) || '{}')); } catch (e) {}
let foodDaySel = 0;
let fCur = { plan: null, day: 1 };
let fCurRecipe = null;

function saveFoodPrefs() { try { localStorage.setItem(FOOD_PREF_KEY, JSON.stringify(foodPrefs)); } catch (e) {} }
function food() { return CARAVAN_DATA.food || null; }
function foodVisible() { const f = food(); return !!f && (f.enabled || SHOW_HIDDEN); }

const toEnDigits = s => String(s)
  .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/٪/g, '%').replace(/٫/g, '.');
const faNum = (n, max = 2) => Number(n).toLocaleString('fa', { maximumFractionDigits: max });
const faDigits = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const normName = s => String(s || '').replace(/[\s‌]+/g, '');
const pilgrims = () => +toEnDigits(foodPrefs.n || '') || 0;

/* «۱۱۰٪» → ۱٫۱ عدد به ازای هر نفر، «۲ عدد» → ۲ عدد، «۴۰ گرم» → ۴۰ گرم */
function parseQty(q) {
  if (!q) return null;
  const s = toEnDigits(q).trim();
  let m = s.match(/^([\d.]+)\s*%$/);
  if (m) return { per: +m[1] / 100, unit: 'عدد' };
  m = s.match(/^([\d.]+)\s*(.*)$/);
  if (m) return { per: +m[1], unit: m[2].trim() || 'عدد' };
  return null;
}
function fmtAmount(v, unit) {
  unit = unit || '';
  if (!FOOD_MASS_UNITS.includes(unit)) return faNum(Math.ceil(v - 1e-9)) + ' ' + (unit || 'عدد');
  if (unit === 'گرم' && v >= 1000) return faNum(v / 1000) + ' کیلوگرم';
  if ((unit === 'میلی‌لیتر' || unit === 'میلی لیتر') && v >= 1000) return faNum(v / 1000) + ' لیتر';
  return faNum(v) + ' ' + unit;
}
function qtyTotal(q, n) {
  const p = parseQty(q);
  return p && n ? fmtAmount(p.per * n, p.unit) : '';
}

/* ── plan / recipe lookup ── */
function foodPlans() { return ((food() || {}).plans || []).filter(p => p.active !== false); }
function findPlan() {
  const ps = foodPlans().filter(p => p.caravanType === foodPrefs.type);
  const g = foodPrefs.grade;
  return (g && ps.find(p => (p.grades || []).includes(g))) || ps.find(p => !(p.grades || []).length) || null;
}
function needsGrade() {
  return !foodPrefs.grade && !foodPlans().some(p => p.caravanType === foodPrefs.type && !(p.grades || []).length);
}
function findRecipe(name, exact) {
  if (!name) return null;
  const n = normName(name);
  const rs = (food() || {}).recipes || [];
  const hit = rs.find(r => normName(r.name) === n);
  if (hit || exact) return hit || null;
  return rs.filter(r => r.name && (n.includes(normName(r.name)) || normName(r.name).includes(n)))
           .sort((a, b) => b.name.length - a.name.length)[0] || null;
}

/* ── dates ── */
const isoOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dOf = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today0 = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
function faDateLong(d) {
  try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' }).format(d); }
  catch (e) { return d.toLocaleDateString('fa-IR'); }
}
function tripInfo() {
  if (!foodPrefs.start) return null;
  const diff = Math.round((today0() - dOf(foodPrefs.start)) / 864e5);
  return { diff, trip: diff + 1, cycle: diff >= 0 ? (diff % 6) + 1 : 0 };
}
function foodDateOptions() {
  const t = today0(), seen = new Set();
  const opts = ['<option value="">— انتخاب کنید —</option>'];
  for (let i = -3; i <= 30; i++) {
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i);
    const iso = isoOf(d); seen.add(iso);
    const tag = i === 0 ? ' (امروز)' : i === 1 ? ' (دیروز)' : i < 0 ? ' (آینده)' : '';
    opts.push(`<option value="${iso}" ${foodPrefs.start === iso ? 'selected' : ''}>${faDateLong(d)}${tag}</option>`);
  }
  if (foodPrefs.start && !seen.has(foodPrefs.start))
    opts.push(`<option value="${foodPrefs.start}" selected>${faDateLong(dOf(foodPrefs.start))}</option>`);
  return opts.join('');
}

/* ── entry card on main page ── */
function foodEntryHTML() {
  if (!foodVisible()) return '';
  const hidden = !food().enabled;
  return `
  <button class="food-entry" onclick="openFood()">
    <span class="fe-ico" aria-hidden="true">🍽️</span>
    <span class="fe-txt">
      <span class="fe-t">برنامه غذایی و دورچین${hidden ? '<span class="food-hidden-badge">پنهان از کاربران</span>' : ''}</span>
      <span class="fe-s">منوی هر روز بر اساس نوع کاروان و درجه هتل · محاسبه مواد برای آشپز</span>
    </span>
    <span class="fe-arrow" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 5 8 12 15 19"/></svg></span>
  </button>`;
}

/* ── full-screen view ── */
function openFood() {
  let v = document.getElementById('foodView');
  if (!v) {
    document.body.insertAdjacentHTML('beforeend', `
    <div class="food-view" id="foodView" role="dialog" aria-modal="true" aria-label="برنامه غذایی">
      <div class="fv-inner">
        <div class="fv-head">
          <button class="fv-back" onclick="closeFood()" aria-label="بستن">✕</button>
          <div class="fv-title">🍽️ برنامه غذایی</div>
        </div>
        <div class="fv-tabs" id="fvTabs" role="tablist"></div>
        <div class="fv-body" id="fvBody"></div>
      </div>
    </div>`);
    v = document.getElementById('foodView');
  }
  foodDaySel = 0;
  renderFood();
  v.classList.add('open');
  document.documentElement.style.overflow = 'hidden';
  try { sessionStorage.setItem('caravan-food-open', '1'); } catch (e) {}
  if (!(history.state && history.state.food)) history.pushState({ food: 1 }, '');
}
function hideFood() {
  const v = document.getElementById('foodView');
  if (v) v.classList.remove('open');
  document.documentElement.style.overflow = '';
  try { sessionStorage.removeItem('caravan-food-open'); } catch (e) {}
}
function closeFood() {
  if (history.state && history.state.food) history.back(); else hideFood();
}
window.addEventListener('popstate', () => {
  const v = document.getElementById('foodView');
  if (v && v.classList.contains('open')) hideFood();
});

function renderFood() {
  const tabs = [['daily', '📅 برنامه روزانه'], ['cook', '👨‍🍳 محاسبه مواد'], ['notes', '📋 نکات']];
  document.getElementById('fvTabs').innerHTML = tabs.map(([k, l]) =>
    `<button class="fv-tab ${foodPrefs.tab === k ? 'on' : ''}" role="tab" aria-selected="${foodPrefs.tab === k}" onclick="foodTab('${k}')">${l}</button>`).join('');
  const pre = !food().enabled
    ? '<div class="fpreview">👁 این بخش هنوز برای کاربران فعال نیست و فقط شما (مدیر) آن را می‌بینید.</div>' : '';
  const body = foodPrefs.tab === 'cook' ? foodCookHTML() : foodPrefs.tab === 'notes' ? foodNotesHTML() : foodDailyHTML();
  document.getElementById('fvBody').innerHTML = pre + body;
}
function foodTab(k) {
  foodPrefs.tab = k; saveFoodPrefs(); renderFood();
  document.getElementById('fvBody').scrollTop = 0;
}
function foodSet(k, v) {
  foodPrefs[k] = v; saveFoodPrefs(); foodDaySel = 0; renderFood();
}
function foodToggleSetup() { foodPrefs.setup = !foodPrefs.setup; saveFoodPrefs(); renderFood(); }
function foodPickDay(d) { foodDaySel = d; renderFood(); }
function foodSetN(v) {
  foodPrefs.n = v; saveFoodPrefs();
  const m = document.getElementById('fMeals');
  if (m && fCur.plan) m.innerHTML = foodMealsHTML();
  const r = document.getElementById('fRecipe');
  if (r && fCurRecipe) r.innerHTML = foodRecipeHTML();
}
function foodOpenRecipe(id) {
  foodPrefs.tab = 'cook'; foodPrefs.recipe = id; saveFoodPrefs(); renderFood();
  document.getElementById('fvBody').scrollTop = 0;
}
function foodPickRecipe(id) { foodPrefs.recipe = id; saveFoodPrefs(); renderFood(); }

/* ── tab: daily ── */
function foodSetupHTML() {
  const f = food(), plan = findPlan();
  const open = foodPrefs.setup || !plan;
  const sum = [
    'کاروان ' + FOOD_TYPES[foodPrefs.type],
    foodPrefs.grade ? 'هتل ' + faDigits(foodPrefs.grade) : '',
    foodPrefs.start ? 'ورود: ' + faDateLong(dOf(foodPrefs.start)) : '',
    pilgrims() ? faNum(pilgrims()) + ' زائر' : ''
  ].filter(Boolean).join(' · ');
  let h = `<div class="fcard">
    <div class="fset-sum" onclick="foodToggleSetup()">
      <span style="font-size:20px" aria-hidden="true">⚙️</span>
      <div class="t">${sum}</div>
      <span class="e">${open ? 'بستن ▲' : 'تغییر ▼'}</span>
    </div>`;
  if (open) {
    h += `<div class="fset">
      <div class="flabel">نوع کاروان</div>
      <div class="fseg">${Object.entries(FOOD_TYPES).map(([k, l]) =>
        `<button class="${foodPrefs.type === k ? 'on' : ''}" onclick="foodSet('type','${k}')">${l}</button>`).join('')}</div>
      <div class="flabel">درجه هتل محل اسکان</div>
      <div class="fchips">${(f.grades || []).map(g =>
        `<button class="${foodPrefs.grade === g ? 'on' : ''}" onclick="foodSet('grade','${g}')">${faDigits(g)}</button>`).join('')}</div>
      <div class="flabel">روز اول ورود کاروان (برای نمایش خودکار برنامه امروز)</div>
      <select class="fsel" onchange="foodSet('start',this.value)">${foodDateOptions()}</select>
      <div class="flabel">تعداد زائران (اختیاری — برای محاسبه تعداد اقلام دورچین)</div>
      <input class="fnum" type="number" inputmode="numeric" min="1" value="${escHtml(foodPrefs.n || '')}" placeholder="مثلاً ۵۰" oninput="foodSetN(this.value)">
    </div>`;
  }
  return h + '</div>';
}

function foodDailyHTML() {
  const plan = findPlan();
  let h = foodSetupHTML();
  if (!plan) {
    const msg = needsGrade()
      ? '👆 درجه هتل محل اسکان را انتخاب کنید تا برنامه غذایی و دورچین مخصوص آن نمایش داده شود.'
      : `برای کاروان ${FOOD_TYPES[foodPrefs.type]}${foodPrefs.grade ? ' و هتل درجه ' + faDigits(foodPrefs.grade) : ''} هنوز برنامه غذایی ثبت نشده است.`;
    return h + `<div class="fcard fempty">${msg}</div>`;
  }
  const ti = tripInfo();
  const cyc = ti && ti.diff >= 0 ? ti.cycle : 0;
  const sel = foodDaySel || cyc || 1;
  const planLine = escHtml(plan.title) + (plan.period ? ' — ' + escHtml(plan.period) : '');

  if (ti && ti.diff >= 0) {
    h += `<div class="fstatus"><b>امروز روز ${faNum(ti.trip)} سفر است</b>
      <small>${ti.trip > 6 ? `برنامه غذایی امروز = روز ${FOOD_DAY_NAMES[cyc - 1]} (برنامه هر ۶ روز تکرار می‌شود)<br>` : ''}${planLine}</small></div>`;
  } else if (ti) {
    h += `<div class="fstatus soft"><b>کاروان هنوز وارد نشده است؛ روز اول: ${faDateLong(dOf(foodPrefs.start))}</b><small>${planLine}</small></div>`;
  } else {
    h += `<div class="fstatus soft"><b>برای دیدن خودکار برنامه امروز، روز ورود کاروان را در تنظیمات بالا انتخاب کنید.</b><small>${planLine}</small></div>`;
  }

  h += '<div class="fdays" role="tablist" aria-label="روز برنامه">' + FOOD_DAY_NAMES.map((n, k) => {
    const d = k + 1;
    const tag = cyc ? (d === cyc ? 'امروز' : d === (cyc % 6) + 1 ? 'فردا' : '') : '';
    return `<button class="fday ${d === sel ? 'on' : ''}" onclick="foodPickDay(${d})"><b>روز ${n}</b><small>${tag}</small></button>`;
  }).join('') + '</div>';

  fCur = { plan, day: sel };
  return h + `<div id="fMeals">${foodMealsHTML()}</div>`;
}

function foodMealsHTML() {
  const m = ((fCur.plan.days || [])[fCur.day - 1]) || {};
  return mealCardHTML('breakfast', '🌅', 'صبحانه', m.breakfast) +
         mealCardHTML('lunch', '☀️', 'ناهار', m.lunch) +
         mealCardHTML('dinner', '🌙', 'شام', m.dinner);
}

function mealCardHTML(kind, ico, label, m) {
  m = m || {};
  const n = pilgrims();
  const main = kind === 'breakfast' ? m.hot : m.main;
  const rec = main && findRecipe(main);
  let h = `<div class="fcard meal m-${kind}">
    <div class="meal-head"><span aria-hidden="true">${ico}</span><span class="n">${label}</span></div>
    <div class="meal-main">${kind === 'breakfast' && main ? '🍳 ' : ''}${escHtml(main || '—')}</div>`;
  const tags = [];
  if (m.fruit) tags.push(`<span class="mtag">🍎 میوه: ${escHtml(m.fruit)}</span>`);
  if (rec) tags.push(`<button class="mtag" onclick="foodOpenRecipe('${rec.id}')">🧮 مواد لازم برای آشپز</button>`);
  if (tags.length) h += `<div class="meal-tags">${tags.join('')}</div>`;
  const sides = (m.sides || []).filter(s => s.name);
  if (sides.length) {
    h += `<div class="sides-t">دورچین${n ? ' — تعداد لازم برای ' + faNum(n) + ' زائر' : ''}</div>`;
    h += sides.map(s => {
      const r = findRecipe(s.name, true);
      const tot = n ? qtyTotal(s.q, n) : '';
      return `<div class="side"><span class="dot"></span>
        <span class="nm">${escHtml(s.name)}${r ? `<button class="rc-b" onclick="foodOpenRecipe('${r.id}')" aria-label="آنالیز ${escHtml(s.name)}">🧮</button>` : ''}</span>
        ${s.q ? `<span class="q">${escHtml(faDigits(s.q))}</span>` : ''}
        ${tot ? `<span class="tot">${tot}</span>` : ''}
      </div>`;
    }).join('');
  }
  return h + '</div>';
}

/* ── tab: cook calculator ── */
function foodCookHTML() {
  const rs = (food().recipes || []).filter(r => r.name);
  if (!rs.length) return '<div class="fcard fempty">هنوز آنالیزی ثبت نشده است.</div>';
  const cur = rs.find(r => r.id === foodPrefs.recipe) || rs[0];
  fCurRecipe = cur;
  let h = `<div class="fcard" style="padding:12px 14px">
    <div class="flabel" style="margin-top:0">تعداد زائر</div>
    <input class="fnum" type="number" inputmode="numeric" min="1" value="${escHtml(foodPrefs.n || '')}" placeholder="مثلاً ۵۰" oninput="foodSetN(this.value)">
  </div>`;
  [['breakfast', '🍳 صبحانه گرم'], ['salad', '🥗 سالاد و ماست'], ['other', '📦 سایر']].forEach(([k, l]) => {
    const g = rs.filter(r => (r.kind || 'other') === k);
    if (!g.length) return;
    h += `<div class="fgroup">${l}</div><div class="frec-chips">${g.map(r =>
      `<button class="${r === cur ? 'on' : ''}" onclick="foodPickRecipe('${r.id}')">${escHtml(r.name)}</button>`).join('')}</div>`;
  });
  return h + `<div id="fRecipe">${foodRecipeHTML()}</div>`;
}

function foodRecipeHTML() {
  const r = fCurRecipe, n = pilgrims();
  let h = `<div class="fcard"><div class="fcard-h">🧮 ${escHtml(r.name)} <small>${n ? 'برای ' + faNum(n) + ' زائر' : 'سرانه هر نفر'}</small></div>
    <table class="ftable"><thead><tr><th>ماده</th><th>سرانه هر نفر</th>${n ? '<th>مقدار کل</th>' : ''}</tr></thead><tbody>`;
  (r.ingredients || []).forEach(i => {
    const has = i.amount !== null && i.amount !== '' && !isNaN(+i.amount);
    const per = has ? `${faNum(+i.amount)} ${escHtml(i.unit || '')}` : escHtml(i.note || 'به مقدار لازم');
    const tot = has ? fmtAmount(+i.amount * n, i.unit) : `<span style="color:var(--dim);font-weight:500">${escHtml(i.note || 'به مقدار لازم')}</span>`;
    h += `<tr><td>${escHtml(i.name)}${has && i.note ? `<div class="inote">${escHtml(i.note)}</div>` : ''}</td>
      <td class="per">${per}</td>${n ? `<td class="tot">${tot}</td>` : ''}</tr>`;
  });
  h += '</tbody></table>';
  if (!n) h += '<div class="fn-help" style="padding-top:10px">👆 تعداد زائر را وارد کنید تا مقدار کل هر ماده محاسبه شود.</div>';
  if (r.method) h += `<div class="fmethod"><b>طرز تهیه:</b><br>${escHtml(r.method).replace(/\n/g, '<br>')}</div>`;
  if (r.note) h += `<div class="fnote">📌 ${escHtml(r.note).replace(/\n/g, '<br>')}</div>`;
  return h + '</div>';
}

/* ── tab: notes ── */
function foodNotesHTML() {
  let h = `<div class="fcard"><div class="fcard-h">ℹ️ راهنمای سرانه</div>
    <div class="fn-help">درصدها سرانه هر زائر است. مثلاً «نوشابه ۱۱۰٪» یعنی برای ۱۰ زائر باید ۱۱ عدد نوشابه روی میز باشد و «نان ۵۰٪» یعنی برای هر دو زائر یک نان.
    اگر در تنظیمات «برنامه روزانه» تعداد زائران را وارد کنید، تعداد هر قلم دورچین خودکار محاسبه می‌شود.</div></div>`;
  const plan = findPlan();
  if (!plan) return h + '<div class="fcard fempty">برای دیدن نکات، ابتدا نوع کاروان و درجه هتل را در «برنامه روزانه» انتخاب کنید.</div>';
  const lines = (plan.notes || '').split('\n').map(s => s.trim()).filter(Boolean);
  return h + `<div class="fcard"><div class="fcard-h">📋 ${escHtml(plan.title)} <small>${escHtml(plan.period || '')}</small></div>
    ${lines.length ? `<ul class="fnotes">${lines.map(l => `<li>${escHtml(l)}</li>`).join('')}</ul>` : '<div class="fempty">نکته‌ای برای این برنامه ثبت نشده است.</div>'}</div>`;
}

/* بعد از رفرش (مثلاً در پیش‌نمایش زنده) همان صفحه و موقعیت اسکرول برگردد */
function foodRestore() {
  try {
    if (sessionStorage.getItem('caravan-food-open') === '1' && foodVisible()) {
      openFood();
      const st = +sessionStorage.getItem('caravan-food-scroll') || 0;
      if (st) document.getElementById('fvBody').scrollTop = st;
    }
    const y = +sessionStorage.getItem('caravan-scroll') || 0;
    if (y) setTimeout(() => window.scrollTo(0, y), 60);
    sessionStorage.removeItem('caravan-scroll');
    sessionStorage.removeItem('caravan-food-scroll');
  } catch (e) {}
}
