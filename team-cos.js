/* 🏢 شرکت‌ها در پنل سرپرست مناطق: کیفیت (از گزارش‌ها) + مشخصات و تماس شرکت‌های مجری و سیاحه.
   مشخصات در پنل مدیریت ثبت می‌شود (مجری: تب «شرکت‌های مجری» و بازوی بله؛ سیاحه: همان تب). این‌جا فقط دیدن و تماس. */
const CO = { sub: 'mojri', q: '', d: null };
const CO_SUBS = [['quality', '⭐ کیفیت شرکت‌ها'], ['mojri', '📇 شرکت‌های مجری'], ['siyahe', '🤝 شرکت‌های سیاحه']];
const WA_I = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35M12.05 21.78h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41Z"/></svg>';
/* شماره به قالب بین‌المللی (۹۸ یا ۹۶۴) تا با سیم‌کارت ایرانی در عراق هم وصل شود */
function coIntl(p) {
  let d = String(p || '').replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2); else if (/^09\d{9}$/.test(d)) d = '98' + d.slice(1); else if (/^07\d{9}$/.test(d)) d = '964' + d.slice(1); else if (/^7\d{9}$/.test(d)) d = '964' + d;
  return d.length >= 10 ? d : '';
}
function coCall(ph, label) {
  if (!ph) return '';
  const w = coIntl(ph), shown = String(ph).replace(/^00/, '+');
  return `<span class="co-pair"><a class="btn small ghost" href="tel:${w ? '+' + w : esc(shown)}">📞 ${esc(label)} <span dir="ltr">${faS(shown)}</span></a>${/^(989|9647)\d{8,9}$/.test(w) ? `<a class="btn small co-wa" href="https://wa.me/${w}" target="_blank" rel="noopener" title="واتس‌اپ ${esc(label)}" aria-label="واتس‌اپ ${esc(label)}">${WA_I} واتس‌اپ</a>` : ''}</span>`;
}
const coNorm = s => String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[‌\s]+/g, ' ').replace(/^شرکت\s+/, '').trim();

function cosStart(loadQualityFn) {
  const el = document.getElementById('main');
  el.innerHTML = `<nav class="city-tabs" id="co-sub" aria-label="بخش شرکت‌ها">${CO_SUBS.map(([k, t]) => `<button data-co="${k}" aria-pressed="${CO.sub === k}">${t}</button>`).join('')}</nav><div id="co-box"></div>`;
  el.querySelectorAll('[data-co]').forEach(b => b.onclick = () => { CO.sub = b.dataset.co; CO.q = ''; cosStart(loadQualityFn); });
  if (CO.sub === 'quality') return loadQualityFn();
  cosInfo();
}
async function cosInfo() {
  const box = document.getElementById('co-box'); if (!box) return;
  if (!CO.d) {
    box.innerHTML = '<div class="empty"><span class="spin"></span>در حال بارگذاری…</div>';
    try { CO.d = await api('/api/super/cos-info'); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)} <button class="btn small ghost" id="co-re">🔄 دوباره</button></div>`; box.querySelector('#co-re').onclick = cosInfo; return; }
    if (!document.getElementById('co-box')) return;
  }
  const sy = CO.sub === 'siyahe', L = sy ? CO.d.siyahe : CO.d.mojri;
  const here = new Map(); CO.d.here.forEach(e => { const k = coNorm(sy ? e.siyahe : e.company); if (!k) return; if (!here.has(k)) here.set(k, []); here.get(k).push(e); });
  box.innerHTML = `<div class="card"><div class="card-h"><h2 style="margin:0;font-size:17px">${sy ? '🤝 شرکت‌های سیاحه' : '📇 شرکت‌های مجری و نمایندگانشان'} (${fa(L.length)})</h2>
      <input type="search" id="co-q" placeholder="🔎 نام شرکت، مدیر، نماینده یا شماره…" value="${esc(CO.q)}" style="max-width:320px;flex:1 1 220px"></div>
    <p class="hint">${sy ? 'مشخصات شرکت‌های سیاحه در پنل مدیریت (تب «🏢 شرکت‌های مجری»، بخش «شرکت‌های سیاحه») ثبت و ویرایش می‌شود.' : 'این اطلاعات را شرکت‌ها از راه بازوی بله فرستاده‌اند یا در پنل مدیریت ثبت شده است؛ ویرایش فقط در پنل مدیریت.'} تماس با پیش‌شماره‌ی بین‌المللی است تا با سیم‌کارت ایرانی در عراق هم وصل شود.</p>
    <div id="co-list"></div></div>`;
  const q = box.querySelector('#co-q'); q.oninput = () => { CO.q = q.value; draw(); };
  function draw() {
    const qq = coNorm(CO.q.replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
    const hay = c => coNorm([c.name, c.ceo, c.address, c.phone, c.note, c.cities, ...c.reps.flatMap(r => [r.name, r.ir, r.iq])].join(' '));
    const F = qq ? L.filter(c => hay(c).includes(qq)) : L;
    /* شرکت‌هایی که این هفته هتل دارند بالاتر */
    const H = c => here.get(coNorm(c.name)) || [];
    const S = [...F].sort((a, b) => (H(b).length > 0) - (H(a).length > 0));
    box.querySelector('#co-list').innerHTML = S.length ? S.map(c => { const h = H(c);
      return `<details class="co-d" ${qq && S.length <= 5 ? 'open' : ''}><summary><b>${esc(c.name)}</b>${h.length ? ` <span class="pill ok">این هفته: ${fa(h.length)} هتل</span>` : ''}${sy && c.cities ? ` <span class="pill">${esc(c.cities)}</span>` : ''}
        <small>${c.ceo ? `${sy ? 'مدیر' : 'مدیرعامل'}: ${esc(c.ceo)}` : ''}${c.reps.length ? `${c.ceo ? '، ' : ''}${fa(c.reps.length)} نماینده` : ''}</small></summary>
        <div class="co-b">
          ${c.phone ? `<div class="co-l"><span class="dim">تلفن شرکت</span>${coCall(c.phone, 'شرکت')}</div>` : ''}
          ${c.address ? `<div class="co-l"><span class="dim">📍 آدرس</span><span>${esc(c.address)}</span></div>` : ''}
          ${c.reps.length ? c.reps.map(r => `<div class="co-rep"><b>👤 ${esc(r.name || 'نماینده')}</b><div class="row" style="gap:6px">${coCall(r.iq, 'عراق')}${coCall(r.ir, 'ایران')}${!r.iq && !r.ir ? '<span class="dim">شماره ثبت نشده</span>' : ''}</div></div>`).join('') : '<div class="dim" style="color:var(--warn)">نماینده‌ای ثبت نشده است.</div>'}
          ${c.note ? `<div class="co-l"><span class="dim">توضیح</span><span>${esc(c.note)}</span></div>` : ''}
          ${h.length ? `<div class="co-h"><b>🏨 این هفته</b><ul>${h.map(e => `<li>${esc(e.hotel || '—')} <span class="dim">· ${esc(e.city || '')} · ${esc(e.region || '')}${sy && e.company ? ' · مجری: ' + esc(e.company) : !sy && e.siyahe ? ' · سیاحه: ' + esc(e.siyahe) : ''}${e.pilgrims ? ' · ' + fa(e.pilgrims) + ' زائر' : ''}${e.d_in ? ` · ${faS(e.d_in)} تا ${faS(e.d_out || '')}` : ''}</span></li>`).join('')}</ul></div>` : ''}
        </div></details>`; }).join('')
      : `<div class="empty">${L.length ? 'با این جستجو پیدا نشد.' : sy ? 'هنوز شرکت سیاحه‌ای در پنل مدیریت ثبت نشده است.' : 'هنوز شرکتی ثبت نشده است.'}</div>`;
  }
  draw();
}
document.head.insertAdjacentHTML('beforeend', `<style>
  .co-d{border:1px solid var(--line-s);border-radius:12px;background:var(--card);margin:0 0 8px;overflow:hidden}
  .co-d>summary{cursor:pointer;padding:10px 12px;list-style:none;line-height:1.8}
  .co-d>summary::-webkit-details-marker{display:none}
  .co-d>summary small{display:block;color:var(--dim);font-size:12px}
  .co-d[open]>summary{background:var(--card2);border-bottom:1px solid var(--line-s)}
  .co-b{padding:10px 12px;display:flex;flex-direction:column;gap:8px}
  .co-l{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.co-l>.dim{min-width:70px;font-size:12px}
  .co-rep{border:1px dashed var(--line-s);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px}
  .co-pair{display:inline-flex;gap:4px;flex-wrap:wrap}
  .co-pair a{text-decoration:none}
  .btn.co-wa{background:#1E9E55;color:#fff;display:inline-flex;align-items:center;gap:4px}
  .co-h ul{margin:4px 0 0;padding-inline-start:18px;font-size:13px;line-height:1.9}
</style>`);
