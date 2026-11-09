/* ══════════════════════════════════════════
   🍽️ پنل: آشپزخانه‌ها، دوره‌ی مدیران آشپزخانه و گزارش نظر زائران درباره‌ی غذا (داده‌ها در سرور، نه data.js)
   تاریخ‌ها برای مدیر شمسی است؛ در سرور میلادی (YYYY-MM-DD) ذخیره می‌شود.
══════════════════════════════════════════ */
const FJD = (() => {
  const div = (a, b) => ~~(a / b), mod = (a, b) => a - ~~(a / b) * b;
  const BR = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function cal(jy) {
    let gy = jy + 621, leapJ = -14, jp = BR[0], jm, jump = 0, n, i;
    for (i = 1; i < BR.length; i++) { jm = BR[i]; jump = jm - jp; if (jy < jm) break; leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm; }
    n = jy - jp; leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4;
    return { gy, march: 20 + leapJ - leapG, leap };
  }
  const g2d = (gy, gm, gd) => { let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408; return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752; };
  const d2g = jdn => { let j = 4 * jdn + 139361631; j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908; const i = div(mod(j, 1461), 4) * 5 + 308, gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1; return { gy: div(j, 1461) - 100100 + div(8 - gm, 6), gm, gd }; };
  const j2d = (jy, jm, jd) => { const r = cal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; };
  const d2j = jdn => { const g = d2g(jdn); let jy = g.gy - 621; const r = cal(jy); let k = jdn - g2d(g.gy, 3, r.march), jm, jd;
    if (k >= 0) { if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }; k -= 186; } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
    return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 }; };
  const p2 = n => String(n).padStart(2, '0');
  const num = s => { const m = String(s || '').replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).match(/^\s*(1[34]\d\d)\D(\d{1,2})\D(\d{1,2})\s*$/);
    if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return null; const d = j2d(+m[1], +m[2], +m[3]), b = d2j(d); return b.jm === +m[2] && b.jd === +m[3] ? d : null; };
  const str = d => { const j = d2j(d); return `${j.jy}/${p2(j.jm)}/${p2(j.jd)}`; };
  const ms = d => (d - 2440588) * 864e5, now = () => Math.floor(Date.now() / 864e5) + 2440588;
  return { num, str, ms, now };
})();
/* امروز به وقت عراق */
const fvNow = () => Math.floor((Date.now() + 3 * 36e5) / 864e5) + 2440588;
const fvIso = d => new Date(FJD.ms(d)).toISOString().slice(0, 10);
const fvJ = iso => iso ? FJD.str(Math.floor(Date.parse(iso) / 864e5) + 2440588).replace(/\d/g, c => '۰۱۲۳۴۵۶۷۸۹'[c]) : '';
const fvFa = n => String(n).replace(/\d/g, c => '۰۱۲۳۴۵۶۷۸۹'[c]);
const FV_CITY = { najaf: 'نجف', karbala: 'کربلا', kadhimiya: 'کاظمین', samarra: 'سامرا' };
const FV_MEAL = { breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام' };
let fvK = null, fvErr = '', fvRep = null, fvRange = { from: '', to: '', city: '' }, fvEditM = null, fvOpen = new Set(['report']);

function fvLoad() {
  if (!document.getElementById('foodvote-admin')) return;
  fvRender();
  adminFetch('/admin/food/kitchens', null, adminAuth()).then(d => { fvK = d; fvErr = ''; fvRender(); }).catch(e => { fvErr = e.message; fvRender(); });
  if (!fvRange.from) { const t = fvNow(); fvRange.from = FJD.str(t - 6); fvRange.to = FJD.str(t); }
  if (!fvRep) fvReport();
}
async function fvReport() {
  const a = FJD.num(fvRange.from), b = FJD.num(fvRange.to);
  if (a == null || b == null || b < a) return showToast('بازه‌ی تاریخ را مثل ۱۴۰۵/۰۸/۱۵ بنویسید');
  fvRep = 'load'; fvRender();
  try { fvRep = await adminFetch(`/admin/food/report?from=${fvIso(a)}&to=${fvIso(b)}&city=${fvRange.city}`, null, adminAuth()); }
  catch (e) { fvRep = { err: e.message }; }
  fvRender();
}
function fvPreset(days) { const t = fvNow(); fvRange.from = FJD.str(t - days + 1); fvRange.to = FJD.str(t); fvReport(); }
async function fvCall(path, body, ok) {
  try { const r = await adminFetch(path, body, adminAuth()); showToast(ok || (r.hidden ? 'این آشپزخانه نظر ثبت‌شده دارد؛ پنهان شد تا گزارش‌ها بماند' : 'ذخیره شد ✅')); fvEditM = null; fvLoad(); fvRep = null; fvReport(); }
  catch (e) { showToast(e.message); }
}
function fvAddKitchen() {
  const city = document.getElementById('fvKCity').value, name = document.getElementById('fvKName').value.trim();
  if (!name) return showToast('نام آشپزخانه را بنویسید');
  fvCall('/admin/food/kitchen', { city, name });
}
function fvRenameK(id) {
  const k = fvK.kitchens.find(x => x.id === id), n = prompt('نام آشپزخانه:', k.name); if (!n || !n.trim()) return;
  fvCall('/admin/food/kitchen', { id, city: k.city, name: n.trim(), active: !!k.active });
}
function fvDelK(id) { const k = fvK.kitchens.find(x => x.id === id); if (confirm(`آشپزخانه‌ی «${k.name}» حذف شود؟`)) fvCall('/admin/food/kitchen/del', { id }); }
function fvSaveM(kid) {
  const v = n => (document.getElementById('fvM' + n) || {}).value || '';
  const a = FJD.num(v('From')), b = v('To').trim() ? FJD.num(v('To')) : null;
  if (!v('Name').trim()) return showToast('نام مدیر آشپزخانه را بنویسید');
  if (a == null) return showToast('تاریخ شروع را مثل ۱۴۰۵/۰۸/۱۵ بنویسید');
  if (v('To').trim() && b == null) return showToast('تاریخ پایان را درست بنویسید (یا خالی بگذارید)');
  fvCall('/admin/food/mgr', { id: fvEditM && fvEditM.id || undefined, kitchen_id: kid, name: v('Name').trim(), phone: v('Phone').trim(), d_from: fvIso(a), d_to: b == null ? null : fvIso(b) });
}
function fvDelM(id) { if (confirm('این دوره‌ی مدیر حذف شود؟ (نظرهای آن بازه بدون نام مدیر نمایش داده می‌شوند)')) fvCall('/admin/food/mgr/del', { id }); }
const fvTog = k => { fvOpen.has(k) ? fvOpen.delete(k) : fvOpen.add(k); fvRender(); };

function fvMgrForm(kid) {
  const m = fvEditM && fvEditM.kid === kid ? fvEditM : null; if (!m) return '';
  return `<div class="fv-form"><input id="fvMName" placeholder="نام مدیر آشپزخانه" value="${fe(m.name || '')}"><input id="fvMPhone" placeholder="موبایل (اختیاری)" value="${fe(m.phone || '')}" inputmode="tel">
    <input id="fvMFrom" placeholder="از تاریخ ۱۴۰۵/۰۸/۱۵" value="${fe(m.d_from ? fvJ(m.d_from) : '')}"><input id="fvMTo" placeholder="تا تاریخ (خالی = تا الان)" value="${fe(m.d_to ? fvJ(m.d_to) : '')}">
    <button class="pub-btn" onclick="fvSaveM(${kid})">ذخیره</button><button class="lock-link" onclick="fvEditM=null;fvRender()">انصراف</button></div>`;
}
function fvKitchensHTML() {
  if (fvErr) return `<div class="empty-msg" style="color:#B3261E">${fe(fvErr)}</div>`;
  if (!fvK) return '<div class="empty-msg">⏳</div>';
  const today = fvIso(fvNow());
  return `<div class="empty-msg" style="line-height:2">زائر بعد از هر وعده شهر (و اگر شهر چند آشپزخانه دارد، آشپزخانه) را انتخاب می‌کند. برای هر آشپزخانه دوره‌ی هر مدیر را بنویسید تا در گزارش معلوم باشد هر نظر مربوط به دوره‌ی کدام مدیر است. اگر دوره‌ای را بعداً اصلاح کنید، گزارش‌های قبلی هم درست می‌شوند.</div>
    ${Object.keys(FV_CITY).map(c => { const ks = fvK.kitchens.filter(k => k.city === c && k.active); return `<div class="fv-city"><b>🕌 ${FV_CITY[c]}</b>${ks.length ? '' : ' <small class="dim">— هنوز آشپزخانه‌ای ثبت نشده</small>'}
      ${ks.map(k => { const ms = fvK.mgrs.filter(m => m.kitchen_id === k.id); return `<div class="fv-k"><div class="fv-kh">👨‍🍳 <b>${fe(k.name)}</b>
          <button class="lock-link" onclick="fvRenameK(${k.id})">✏️</button><button class="lock-link" style="color:#B3261E" onclick="fvDelK(${k.id})">🗑</button></div>
        ${ms.map(m => { const now = m.d_from <= today && (!m.d_to || m.d_to >= today); return `<div class="fv-m ${now ? 'now' : ''}">${now ? '🟢' : '⚪'} ${fe(m.name)}${m.phone ? ` · <span dir="ltr">${fe(m.phone)}</span>` : ''} — از ${fvJ(m.d_from)} ${m.d_to ? 'تا ' + fvJ(m.d_to) : 'تا الان'}
          <button class="lock-link" onclick='fvEditM=${JSON.stringify({ ...m, kid: k.id })};fvRender()'>✏️</button><button class="lock-link" style="color:#B3261E" onclick="fvDelM(${m.id})">✕</button></div>`; }).join('') || '<div class="fv-m dim">مدیری ثبت نشده</div>'}
        ${fvEditM && fvEditM.kid === k.id ? fvMgrForm(k.id) : `<button class="lock-link" onclick="fvEditM={kid:${k.id}};fvRender()">+ دوره‌ی مدیر</button>`}</div>`; }).join('')}</div>`; }).join('')}
    <div class="fv-form"><select id="fvKCity">${Object.entries(FV_CITY).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <input id="fvKName" placeholder="نام آشپزخانه (مثلاً: آشپزخانه مرکزی کربلا)"><button class="add-row-btn" style="margin:0" onclick="fvAddKitchen()">+ افزودن آشپزخانه</button></div>`;
}
const fvBar = g => { const p = x => g.n ? Math.round(g['v' + x] / g.n * 100) : 0; return `<div class="fv-bar" title="خوب ${p(3)}٪ · متوسط ${p(2)}٪ · ضعیف ${p(1)}٪"><i style="width:${p(3)}%;background:#1E7D4F"></i><i style="width:${p(2)}%;background:#E0A030"></i><i style="width:${p(1)}%;background:#C0392B"></i></div>`; };
const fvScore = g => g.n ? Math.round((g.v3 * 100 + g.v2 * 50) / g.n) : 0;
const fvCnt = g => `😋 ${fvFa(g.v3)} · 😐 ${fvFa(g.v2)} · 😞 ${fvFa(g.v1)}`;
function fvReportHTML() {
  const r = fvRep;
  const form = `<div class="fv-form"><input id="fvFrom" value="${fe(fvRange.from)}" placeholder="از ۱۴۰۵/۰۸/۱۵" onchange="fvRange.from=this.value"><input id="fvTo" value="${fe(fvRange.to)}" placeholder="تا ۱۴۰۵/۰۸/۲۰" onchange="fvRange.to=this.value">
    <select onchange="fvRange.city=this.value"><option value="">همه‌ی شهرها</option>${Object.entries(FV_CITY).map(([k, v]) => `<option value="${k}" ${fvRange.city === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <button class="pub-btn" onclick="fvReport()">نمایش</button></div>
    <div class="fv-pre"><button class="lock-link" onclick="fvPreset(1)">امروز</button><button class="lock-link" onclick="fvPreset(7)">۷ روز</button><button class="lock-link" onclick="fvPreset(30)">۳۰ روز</button><button class="lock-link" onclick="fvPreset(90)">۹۰ روز</button></div>`;
  if (!r || r === 'load') return form + '<div class="empty-msg">⏳</div>';
  if (r.err) return form + `<div class="empty-msg" style="color:#B3261E">${fe(r.err)}</div>`;
  if (!r.total) return form + '<div class="empty-msg">در این بازه هنوز نظری ثبت نشده است.</div>';
  return form + `<div class="fv-sum">${fvFa(r.total)} نظر · رضایت کلی <b>${fvFa(fvScore(r.groups.reduce((a, g) => ({ n: a.n + g.n, v1: a.v1 + g.v1, v2: a.v2 + g.v2, v3: a.v3 + g.v3 }), { n: 0, v1: 0, v2: 0, v3: 0 })))}٪</b></div>
    <div class="field-label">بر اساس آشپزخانه و دوره‌ی مدیر</div>
    <div class="fv-tbl">${r.groups.map(g => `<div class="fv-row"><div><b>${fe(FV_CITY[g.city] || 'شهر نامشخص')} · ${fe(g.kitchen || 'آشپزخانه نامشخص')}</b>
        <small>${g.mgr ? `👨‍🍳 ${fe(g.mgr)} (از ${fvJ(g.mgr_from)} ${g.mgr_to ? 'تا ' + fvJ(g.mgr_to) : 'تا الان'})` : '👨‍🍳 مدیرِ این تاریخ‌ها ثبت نشده'}</small>
        <small>${['breakfast', 'lunch', 'dinner'].filter(m => g.meals[m]).map(m => `${FV_MEAL[m]} ${fvFa(fvScore(g.meals[m]))}٪`).join(' · ')}</small></div>
      <div class="fv-sc"><b>${fvFa(fvScore(g))}٪</b>${fvBar(g)}<small>${fvCnt(g)} · ${fvFa(g.n)} نظر</small></div></div>`).join('')}</div>
    <div class="field-label">بر اساس غذا</div>
    <div class="fv-tbl">${r.dishes.map(g => `<div class="fv-row"><div><b>${fe(g.dish)}</b></div><div class="fv-sc"><b>${fvFa(fvScore(g))}٪</b>${fvBar(g)}<small>${fvCnt(g)}</small></div></div>`).join('')}</div>
    ${r.notes.length ? `<div class="field-label">توضیح‌های زائران (${fvFa(r.notes.length)} مورد آخر)</div><div class="fv-notes">${r.notes.map(n => `<div class="fv-note"><span>${['', '😞', '😐', '😋'][n.vote]}</span><div>${fe(n.note)}<small>${fvJ(n.day)} · ${FV_MEAL[n.meal]} · ${fe(n.dish || '')} · ${fe(FV_CITY[n.city] || '')}${n.kitchen ? ' · ' + fe(n.kitchen) : ''}${n.mgr ? ' · ' + fe(n.mgr) : ''}</small></div></div>`).join('')}</div>` : ''}
    <div class="empty-msg">رضایت = خوب ۱۰۰، متوسط ۵۰، ضعیف ۰ (میانگین).</div>`;
}
function fvCard(k, ico, t, sub, body) {
  const o = fvOpen.has(k);
  return `<div class="sec-card ${o ? 'open' : ''}"><div class="sec-card-head" onclick="fvTog('${k}')"><div class="sec-head-icon ico-gen">${ico}</div>
    <div class="sec-head-info"><div class="sec-head-title">${t}</div><div class="sec-head-sub">${sub}</div></div><span class="sec-chevron">▼</span></div>
    <div class="sec-body">${o ? `<div style="padding:10px 16px 14px">${body()}</div>` : ''}</div></div>`;
}
function fvRender() {
  const el = document.getElementById('foodvote-admin'); if (!el) return;
  el.innerHTML = fvCard('report', '📊', 'نظر زائران درباره‌ی غذا', 'گزارش رضایت به تفکیک شهر، آشپزخانه، دوره‌ی مدیر آشپزخانه و غذا', fvReportHTML)
    + fvCard('kitchens', '👨‍🍳', 'آشپزخانه‌ها و مدیران آشپزخانه', 'هر شهر چه آشپزخانه‌هایی دارد و در هر بازه‌ی تاریخ مدیرش چه کسی بوده', fvKitchensHTML);
}
document.head.insertAdjacentHTML('beforeend', `<style>
  .fv-form{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
  .fv-form input,.fv-form select{padding:7px 10px;border:1px solid var(--border-s);border-radius:9px;font:inherit;font-size:13px;background:var(--card);color:inherit;min-width:0;flex:1 1 140px}
  .fv-pre{display:flex;gap:12px;margin-bottom:8px}
  .fv-city{border-top:1px solid var(--border-s);padding:10px 0}.fv-k{margin:6px 0 4px;padding:8px 10px;border:1px solid var(--border-s);border-radius:10px;background:var(--bg)}
  .fv-kh{display:flex;gap:8px;align-items:center}.fv-m{font-size:13px;padding:3px 0;line-height:1.8}.fv-m.now{font-weight:700}.dim{color:var(--dim,#888)}
  .fv-sum{font-size:14px;margin:6px 0 10px}
  .fv-tbl{display:grid;gap:6px;margin-bottom:12px}.fv-row{display:flex;justify-content:space-between;gap:10px;border:1px solid var(--border-s);border-radius:10px;padding:8px 10px;background:var(--card)}
  .fv-row small{display:block;font-size:12px;color:var(--dim,#777);line-height:1.8}.fv-sc{text-align:left;min-width:120px}.fv-sc b{font-size:16px}
  .fv-bar{display:flex;height:7px;border-radius:5px;overflow:hidden;background:var(--border-s);margin:4px 0}
  .fv-notes{display:grid;gap:6px}.fv-note{display:flex;gap:8px;font-size:13px;line-height:1.8;border-bottom:1px dashed var(--border-s);padding-bottom:6px}.fv-note small{display:block;color:var(--dim,#888);font-size:11.5px}
</style>`);
