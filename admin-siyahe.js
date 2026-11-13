/* ══ 🤝 شرکت‌های سیاحه (طرف عراقی) — در تب «شرکت‌های مجری و سیاحه» ══
   فقط روی سرور (جدول siyahe_cos)؛ در اپلیکیشن نیست. سرپرست مناطق در سامانه پایش خدمات (تب 🏢 شرکت‌ها) می‌بیند و تماس می‌گیرد. */
let sycData = null, sycErr = '', sycEdit = null, sycQ = '';
const SYC_CITIES = ['نجف اشرف', 'کربلای معلی', 'کاظمین', 'سامراء', 'بغداد'];
const sycBlank = () => ({ name: '', cities: '', ceo: '', address: '', phone: '', note: '', reps: [{ name: '', ir: '', iq: '' }] });
function sycLoad() {
  sycErr = ''; sycRender();
  adminFetch('/admin/mgr/co/sy', null, adminAuth()).then(d => { sycData = d; sycRender(); }).catch(e => { sycErr = e.message; sycRender(); });
}
function sycRead() {
  const box = document.getElementById('sycForm'); if (!box || !sycEdit) return;
  ['name', 'ceo', 'address', 'phone', 'note'].forEach(k => { const el = box.querySelector(`[data-f="${k}"]`); if (el) sycEdit[k] = el.value.trim(); });
  sycEdit.cities = [...box.querySelectorAll('[data-city]:checked')].map(x => x.value).join('، ');
  sycEdit.reps = [...box.querySelectorAll('.mco-rep')].map(r => ({ name: r.querySelector('[data-r="name"]').value.trim(), ir: r.querySelector('[data-r="ir"]').value.trim(), iq: r.querySelector('[data-r="iq"]').value.trim() }));
}
function sycRender() {
  const el = document.getElementById('siyahe-admin'); if (!el) return;
  if (sycErr) { el.innerHTML = `<div class="empty-msg" style="color:#B3261E">${escH(sycErr)}</div><button class="add-row-btn" onclick="sycLoad()">🔄 دوباره</button>`; return; }
  if (!sycData) { el.innerHTML = '<div class="empty-msg">در حال دریافت…</div>'; return; }
  if (!sycEdit) sycEdit = sycBlank();
  const e = sycEdit, inp = (k, ph, x = '') => `<input data-f="${k}" class="input-full" placeholder="${ph}" value="${escH(e[k] || '')}" ${x}>`;
  const cs = String(e.cities || '').split(/[،,]\s*/).filter(Boolean);
  el.innerHTML = `
  <details class="mga-sec" id="sycForm" ${e.id || e.name ? 'open' : ''}><summary>${e.id ? `✏️ ویرایش «${escH(e.name)}»` : '➕ افزودن شرکت سیاحه'}</summary><div style="padding:0 0 12px">
    <div class="mga-form">
      ${inp('name', 'نام شرکت سیاحه')}
      ${inp('ceo', 'نام مدیر شرکت')}
      ${inp('phone', 'تلفن شرکت (عراق: 07… یا +964…)', 'dir="ltr" inputmode="tel"')}
      ${inp('note', 'توضیح کوتاه (مثلاً طرف قرارداد کدام شرکت‌های مجری)')}
    </div>
    <div class="field-label" style="margin-top:8px">شهرهای فعالیت</div>
    <div class="syc-cities">${SYC_CITIES.map(c => `<label><input type="checkbox" data-city value="${c}" ${cs.includes(c) ? 'checked' : ''}> ${c}</label>`).join('')}</div>
    <textarea data-f="address" class="input-full mco-addr" rows="2" placeholder="آدرس دفتر در عراق">${escH(e.address || '')}</textarea>
    <div class="field-label" style="margin-top:10px">👤 نماینده یا رابط‌های شرکت</div>
    ${e.reps.map((r, i) => `<div class="mco-rep"><span class="mco-n">${mgaN(i + 1)}</span>
      <input data-r="name" class="input-full" placeholder="نام نماینده" value="${escH(r.name)}">
      <input data-r="iq" class="input-full" dir="ltr" inputmode="tel" placeholder="موبایل عراق 07… یا +964…" value="${escH(r.iq)}">
      <input data-r="ir" class="input-full" dir="ltr" inputmode="tel" placeholder="موبایل ایران 09… (اگر دارد)" value="${escH(r.ir)}">
      <button class="del-btn" title="حذف این نماینده" onclick="sycRead();sycEdit.reps.splice(${i},1);if(!sycEdit.reps.length)sycEdit.reps.push({name:'',ir:'',iq:''});sycRender()">🗑</button></div>`).join('')}
    <button class="add-row-btn" onclick="sycRead();sycEdit.reps.push({name:'',ir:'',iq:''});sycRender()">＋ نماینده‌ی دیگر</button>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="pub-btn" onclick="sycSave(this)">${e.id ? '💾 ذخیره' : '➕ افزودن شرکت'}</button><button class="lock-link" onclick="sycEdit=null;sycRender()">${e.id ? 'انصراف' : 'پاک کردن فرم'}</button></div>
    <div class="empty-msg" style="padding:6px 0 0">این اطلاعات در اپلیکیشن زائران و مدیران کاروان نمایش داده نمی‌شود؛ فقط سرپرست مناطق در «سامانه پایش خدمات» می‌بیند و با دکمه‌ی تماس یا واتس‌اپ تماس می‌گیرد.</div></div></details>
  ${(sycData.suggest || []).length ? `<details class="gd-det"><summary><b>💡 ${mgaN(sycData.suggest.length)} شرکت سیاحه در اکسل‌های هفتگی هست که هنوز این‌جا ثبت نشده</b></summary>
    <div class="mco-sug">${sycData.suggest.slice(0, 150).map((x, i) => `<button onclick="sycEdit={...sycBlank(),name:sycData.suggest[${i}].name};sycRender();document.querySelector('#sycForm [data-f=ceo]').focus()">＋ ${escH(x.name)} <span>(${mgaN(x.n)} ردیف)</span></button>`).join('')}</div></details>` : ''}
  <div class="field-label" style="margin-top:14px">🤝 شرکت‌های سیاحه‌ی ثبت‌شده (${mgaN(sycData.list.length)})</div>
  ${sycData.list.length > 5 ? `<input type="search" class="input-full" placeholder="🔎 جستجو…" value="${escH(sycQ)}" oninput="sycQ=this.value;sycList()" style="margin:6px 0 8px">` : ''}
  <div id="sycList"></div>`;
  sycList();
}
function sycList() {
  const el = document.getElementById('sycList'); if (!el || !sycData) return;
  const q = sycQ.trim().replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const L = q ? sycData.list.filter(c => [c.name, c.ceo, c.cities, c.address, c.phone, c.note, ...c.reps.flatMap(r => [r.name, r.ir, r.iq])].join(' ').includes(q)) : sycData.list;
  const P = v => v ? `<span dir="ltr">${escH(mgaFaPhone(v.replace(/^00/, '+')))}</span>` : '';
  el.innerHTML = L.length ? L.map(c => `<div class="mga-row"><div class="mga-main"><b>${escH(c.name)}</b>${c.cities ? ` <span class="mco-bb">${escH(c.cities)}</span>` : ''}
      <div class="mga-sub">${c.ceo ? `مدیر: ${escH(c.ceo)}` : '<span style="color:#B25B12">مدیر ثبت نشده</span>'}${c.phone ? `، تلفن: ${P(c.phone)}` : ''}</div>
      ${c.address ? `<div class="mga-sub">📍 ${escH(c.address)}</div>` : ''}
      ${c.reps.map(r => `<div class="mga-sub">👤 ${escH(r.name || 'نماینده')}${r.iq ? `، عراق: ${P(r.iq)}` : ''}${r.ir ? `، ایران: ${P(r.ir)}` : ''}</div>`).join('')}
      ${c.note ? `<div class="mga-sub">${escH(c.note)}</div>` : ''}</div>
    <div class="mga-act"><button onclick="sycEdit=JSON.parse(JSON.stringify(sycData.list.find(x=>x.id===${c.id})));if(!sycEdit.reps.length)sycEdit.reps.push({name:'',ir:'',iq:''});sycRender();document.getElementById('sycForm').scrollIntoView({behavior:'smooth'})" title="ویرایش">✏️</button>
      <button onclick="sycDel(${c.id})" title="حذف">🗑</button></div></div>`).join('')
    : `<div class="empty-msg">${sycData.list.length ? 'با این جستجو پیدا نشد.' : 'هنوز شرکت سیاحه‌ای ثبت نشده است.'}</div>`;
}
async function sycSave(btn) {
  sycRead();
  const body = { ...sycEdit, reps: sycEdit.reps.filter(r => r.name || r.ir || r.iq) };
  if (!body.name) return showToast('نام شرکت را بنویسید');
  btn.disabled = true;
  try { await adminFetch('/admin/mgr/co/sy/save', body, adminAuth()); showToast('ذخیره شد ✅ — سرپرست مناطق در سامانه پایش خدمات می‌بیند'); sycEdit = null; sycLoad(); }
  catch (e) { showToast(e.message); btn.disabled = false; }
}
async function sycDel(id) {
  const c = sycData.list.find(x => x.id === id);
  if (!confirm(`«${c.name}» حذف شود؟`)) return;
  try { await adminFetch('/admin/mgr/co/sy/del', { id }, adminAuth()); showToast('حذف شد'); sycLoad(); } catch (e) { showToast(e.message); }
}
document.head.insertAdjacentHTML('beforeend', `<style>
  .syc-cities{display:flex;flex-wrap:wrap;gap:6px 14px;margin:4px 0 8px;font-size:13.5px}
  .syc-cities label{display:inline-flex;align-items:center;gap:5px;cursor:pointer}
</style>`);
