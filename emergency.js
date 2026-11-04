/* ══════════════════════════════════════════
   EMERGENCY — شماره‌های اضطراری عراق (پلیس، اورژانس، هلال احمر، آتش‌نشانی)
   از پنل مدیریت ← شماره‌های عمومی قابل ویرایش است: CARAVAN_DATA.emergency = { list:[{name, ar, phone, icon}] }
   لمس هر شماره صفحه شماره‌گیر گوشی را با همان شماره باز می‌کند.
══════════════════════════════════════════ */
const EMERG_DEFAULT = [
  { name: 'پلیس عراق', ar: 'الشرطة', phone: '104', icon: 'police' },
  { name: 'اورژانس (آمبولانس)', ar: 'الإسعاف · الطوارئ', phone: '122', icon: 'ambulance' },
  { name: 'هلال احمر عراق', ar: 'الهلال الأحمر', phone: '112', icon: 'clinic' },
  { name: 'آتش‌نشانی', ar: 'الدفاع المدني', phone: '911', icon: 'flame' }
];
const EMERG_ICONS = { police: 'پلیس', ambulance: 'آمبولانس', clinic: 'هلال احمر', flame: 'آتش‌نشانی', siren: 'آژیر', phone: 'تلفن', alert: 'هشدار', car: 'خودرو' };
function emergList() {
  const e = CARAVAN_DATA.emergency;
  return (e && Array.isArray(e.list) ? e.list : EMERG_DEFAULT).filter(x => x && x.phone);
}
const emergTel = p => String(p).replace(/[^\d+]/g, '');
function emergItemHTML(x) {
  return `<a class="em-it" href="tel:${emergTel(x.phone)}" aria-label="تماس با ${escHtml(x.name)} ${escHtml(x.phone)}">
    <span class="em-ic">${ico(ICONS[x.icon] ? x.icon : 'phone')}</span>
    <span class="em-tx"><b>${escHtml(x.name)}</b>${x.ar ? `<small lang="ar">${escHtml(x.ar)}</small>` : ''}</span>
    <span class="em-no" dir="ltr">${faDigits(escHtml(x.phone))}</span></a>`;
}
function emergHTML(title) {
  const l = emergList();
  if (!l.length) return '';
  return `<div class="em-box">${title === false ? '' : `<div class="em-h">${ico('siren')}${escHtml(title || 'شماره‌های اضطراری عراق')}</div>`}
    <div class="em-grid">${l.map(emergItemHTML).join('')}</div></div>`;
}
/* جستجو: «پلیس»، «آمبولانس»، «۱۲۲» و ... */
function emergSearch(q) {
  const n = String(q).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const hit = emergList().filter(x => [x.name, x.ar, x.phone, EMERG_ICONS[x.icon] || '', x.icon === 'ambulance' ? 'آمبولانس اورژانس' : '', x.icon === 'flame' ? 'آتش حریق' : ''].join(' ').includes(n) || x.name.includes(q));
  return hit.length ? `<div class="em-box em-sr"><div class="em-grid">${hit.map(emergItemHTML).join('')}</div></div>` : '';
}

(function injectEmergCSS() {
  document.head.insertAdjacentHTML('beforeend', `<style>
  .em-box{margin-bottom:14px;padding:12px;border-radius:var(--r);background:var(--card);border:1px solid var(--border)}
  .em-sr{margin:0 0 10px}
  .em-h{display:flex;align-items:center;gap:8px;margin:0 2px 10px;font-size:calc(14.5px * var(--fs,1));font-weight:900;color:var(--c-clinic)}
  [data-theme="dark"] .em-h{color:var(--i-clinic)}
  .em-h .ico{width:22px;height:22px}
  .em-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .em-it{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:12px;border-radius:16px;text-decoration:none;color:var(--text);
    background:rgba(var(--rgb-clinic),.06);border:1px solid rgba(var(--rgb-clinic),.22);min-height:96px;position:relative}
  .em-it:active{transform:scale(.97)}
  .em-ic{width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:#fff;background:var(--c-clinic);
    box-shadow:0 0 0 2px var(--card),0 0 0 3px var(--brass-l)}
  .em-ic .ico{width:22px;height:22px}
  .em-tx{display:flex;flex-direction:column;line-height:1.45}
  .em-tx b{font-size:calc(13px * var(--fs,1));font-weight:800}
  .em-tx small{font-size:calc(11.5px * var(--fs,1));color:var(--muted);font-weight:600}
  .em-no{position:absolute;top:10px;left:12px;font-size:calc(24px * var(--fs,1));font-weight:900;color:var(--c-clinic);line-height:1.2;font-variant-numeric:tabular-nums}
  [data-theme="dark"] .em-no{color:var(--i-clinic)}
  </style>`);
})();
