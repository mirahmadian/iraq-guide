/* ══════════════════════════════════════════
   EMERGENCY ADMIN — شماره‌های اضطراری عراق (پلیس، اورژانس، ...)
   خروجی: emergency = { list:[{name, ar, phone, icon}] } — پیش‌فرض‌ها در emergency.js برنامه
══════════════════════════════════════════ */
const EMERG_ADMIN_DEFAULT = [
  { name: 'پلیس عراق', ar: 'الشرطة', phone: '104', icon: 'police' },
  { name: 'اورژانس (آمبولانس)', ar: 'الإسعاف · الطوارئ', phone: '122', icon: 'ambulance' },
  { name: 'هلال احمر عراق', ar: 'الهلال الأحمر', phone: '112', icon: 'clinic' },
  { name: 'آتش‌نشانی', ar: 'الدفاع المدني', phone: '911', icon: 'flame' }
];
const EMERG_ADMIN_ICONS = { police: 'پلیس', ambulance: 'آمبولانس', clinic: 'هلال احمر', flame: 'آتش‌نشانی', siren: 'آژیر', phone: 'تلفن', alert: 'هشدار', car: 'خودرو' };
let emergState = [];

function initEmerg() {
  const e = CARAVAN_DATA.emergency;
  emergState = (e && Array.isArray(e.list) ? e.list : EMERG_ADMIN_DEFAULT).map(x => ({ name: x.name || '', ar: x.ar || '', phone: x.phone || '', icon: x.icon || 'phone' }));
  renderEmerg();
}
function renderEmerg() {
  const el = document.getElementById('emerg-editor');
  if (!el) return;
  el.innerHTML = emergState.map((x, i) => `<div class="em-row">
      <span class="em-aic">${ico(x.icon)}</span>
      <div class="em-f">
        <input type="text" class="input-full" placeholder="نام (مثلاً: پلیس عراق)" value="${escH(x.name)}" oninput="emergState[${i}].name=this.value">
        <input type="text" class="input-full" placeholder="نام عربی (اختیاری) — مثلاً: الشرطة" value="${escH(x.ar)}" oninput="emergState[${i}].ar=this.value">
        <div style="display:flex;gap:6px">
          <input type="tel" class="input-full" dir="ltr" placeholder="شماره" value="${escH(x.phone)}" oninput="emergState[${i}].phone=this.value" style="flex:1;font-weight:800">
          <select class="fsel-a" onchange="emergState[${i}].icon=this.value;renderEmerg()" style="width:110px">${Object.entries(EMERG_ADMIN_ICONS).map(([k, n]) => `<option value="${k}" ${x.icon === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </div>
      </div>
      <span class="lay-mv" style="flex-direction:column">
        <button onclick="emergMove(${i},-1)" title="بالاتر">▲</button><button onclick="emergMove(${i},1)" title="پایین‌تر">▼</button>
        <button class="del-btn" onclick="if(confirm('این شماره حذف شود؟')){emergState.splice(${i},1);renderEmerg()}" title="حذف">🗑</button>
      </span>
    </div>`).join('') || '<div class="empty-msg">هیچ شماره‌ای نیست — این بخش در برنامه نمایش داده نمی‌شود.</div>';
}
function emergMove(i, d) {
  const j = i + d;
  if (j < 0 || j >= emergState.length) return;
  [emergState[i], emergState[j]] = [emergState[j], emergState[i]];
  renderEmerg();
}
function emergAdd() { emergState.push({ name: '', ar: '', phone: '', icon: 'phone' }); renderEmerg(); }
function emergReset() {
  if (!confirm('فهرست به چهار شماره پیش‌فرض (پلیس ۱۰۴، اورژانس ۱۲۲، هلال احمر ۱۱۲، آتش‌نشانی ۹۱۱) برگردد؟')) return;
  emergState = EMERG_ADMIN_DEFAULT.map(x => ({ ...x })); renderEmerg();
}
const emergDigits = s => String(s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d+]/g, '');
function emergOut() {
  return { emergency: { list: emergState.map(x => ({ name: x.name.trim(), ...(x.ar.trim() ? { ar: x.ar.trim() } : {}), phone: emergDigits(x.phone), icon: x.icon }))
    .filter(x => x.name && x.phone) } };
}

(function injectEmergAdminCSS() {
  document.head.insertAdjacentHTML('beforeend', `<style>
  .em-row{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)}
  .em-aic{width:40px;height:40px;border-radius:12px;background:#B3261E;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .em-aic svg{width:22px;height:22px}
  .em-f{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
  </style>`);
})();
