/* ══════════════════════════════════════════
   📥 پیشنهادهای مدیران ثابت برای هتل‌های اپ (عکس، آدرس، تلفن، موقعیت، نام انگلیسی، گزارش اشتباه، هتل تازه)
   بالای بخش «هتل‌های …» هر شهر. «✅ تأیید» مورد را در همان ویرایشگر هتل می‌گذارد؛ بعد از «انتشار» در سرور
   تأییدشده ثبت می‌شود (اگر بدون انتشار صفحه بسته شود، پیشنهاد دوباره در صف می‌آید). «❌ رد» با دلیل، فوراً.
══════════════════════════════════════════ */
const HSUG_CITIES = ['najaf', 'karbala', 'kadhimiya'];
let hsugRows = null, hsugErr = '', hsugApplied = new Set(), hsugPhotos = {};
const HSUG_L = { photo: '📸 عکس', address: '📍 آدرس فارسی', addressAr: '📍 آدرس عربی', phone: '☎️ تلفن', geo: '🗺️ موقعیت دقیق', nameEn: '🔤 نام انگلیسی', fix: '🔧 گزارش اشتباه', new: '➕ هتل تازه' };
const hsugEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hsugAge = t => { const d = Math.floor((Date.now() - t) / 864e5); return d < 1 ? 'امروز' : d.toLocaleString('fa-IR') + ' روز پیش'; };

function hsugLoad() {
  if (typeof adminAuth !== 'function') return;
  adminFetch('/admin/hsug/list', null, adminAuth()).then(d => { hsugRows = d.rows; hsugErr = ''; hsugRender(); }).catch(e => { hsugErr = e.status === 403 ? '' : e.message; hsugRows = hsugRows || []; hsugRender(); });
}
function hsugHotel(city, id) { const L = (typeof hotelState !== 'undefined' && hotelState[city]) || []; const i = L.findIndex(h => h.id === id); return i < 0 ? null : { h: L[i], i }; }
function hsugValText(r) {
  const v = r.value || {};
  if (r.field === 'phone') return `<span dir="ltr">${hsugEsc(v.phone)}</span>${v.role ? ' · ' + hsugEsc(v.role) : ''}`;
  if (r.field === 'geo') return `<a href="https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}" target="_blank" rel="noopener" dir="ltr">${v.lat}, ${v.lng}</a> <span class="hs-dim">(دقت ${(+v.acc || 0).toLocaleString('fa-IR')} متر)</span>`;
  if (r.field === 'photo') return `دسته: ${hsugEsc(v.cat)}<div class="hs-ph" id="hsph-${r.id}">${hsugPhotos[r.id] ? `<img src="${hsugPhotos[r.id]}" alt="">` : '<button class="hs-b" onclick="hsugShow(' + r.id + ')">🖼 نمایش عکس</button>'}</div>`;
  if (r.field === 'fix') return `<b>${hsugEsc(HSUG_L[v.field] || v.field)}</b>${v.value ? ': ' + hsugEsc(v.value) : ''}`;
  if (r.field === 'new') return `نام در اکسل: <b>${hsugEsc(v.name)}</b>`;
  return hsugEsc(v);
}
function hsugRender() {
  HSUG_CITIES.forEach(city => {
    const host = document.getElementById('hotels-' + city); if (!host) return;
    let box = document.getElementById('hsug-' + city);
    if (!box) { host.insertAdjacentHTML('beforebegin', `<div id="hsug-${city}" class="hsug"></div>`); box = document.getElementById('hsug-' + city); }
    const rows = (hsugRows || []).filter(r => r.city === city && !hsugApplied.has(r.id));
    const appl = (hsugRows || []).filter(r => r.city === city && hsugApplied.has(r.id)).length;
    if (!rows.length && !appl && !hsugErr) { box.innerHTML = ''; return; }
    const by = new Map(); rows.forEach(r => { const k = r.hotel_id; if (!by.has(k)) by.set(k, []); by.get(k).push(r); });
    box.innerHTML = `<details class="hsug-box" ${rows.length ? 'open' : ''}><summary>📥 پیشنهادهای مدیران ثابت <b>${rows.length.toLocaleString('fa-IR')}</b>${appl ? ` · <span class="hs-ok">${appl.toLocaleString('fa-IR')} تأییدشده، منتظر «انتشار»</span>` : ''}</summary>
      ${hsugErr ? `<div class="hs-err">${hsugEsc(hsugErr)} <button class="hs-b" onclick="hsugLoad()">دوباره</button></div>` : ''}
      <p class="hs-dim">مدیران ثابت از سامانه پایش خدمات فرستاده‌اند. «✅ تأیید» مورد را در اطلاعات همان هتل (پایین) می‌گذارد؛ برای ثبت نهایی «انتشار» را بزنید. «❌ رد» با دلیل، برای فرستنده نشان داده می‌شود.</p>
      ${[...by.entries()].map(([hid, L]) => { const x = hid === 'new' ? null : hsugHotel(city, hid);
        return `<div class="hs-h"><div class="hs-hn">${hid === 'new' ? '➕ هتل‌های تازه' : x ? `🏨 ${hsugEsc(x.h.name)} <button class="hs-b" onclick="hsugOpenHotel('${city}',${x.i})">باز کردن در ویرایشگر</button>` : `🏨 ${hsugEsc(L[0].hotel_name)} <span class="hs-err">(این هتل در فهرست پیدا نشد)</span>`}</div>
          ${L.map(r => `<div class="hs-r"><div><span class="hs-f">${HSUG_L[r.field] || r.field}</span> ${hsugValText(r)}${r.note ? `<div class="hs-dim">💬 ${hsugEsc(r.note)}</div>` : ''}<div class="hs-dim">${hsugEsc(r.user_name || '')} · ${hsugAge(r.t)}${hid !== 'new' ? ' · اکسل: ' + hsugEsc(r.hotel_name) : ''}</div></div>
            <div class="hs-act">${(x || r.field === 'new') ? `<button class="hs-b ok" onclick="hsugApprove(${r.id})">${r.field === 'fix' ? '✓ دیدم و اصلاح کردم' : '✅ تأیید'}</button>` : ''}<button class="hs-b no" onclick="hsugReject(${r.id})">❌ رد</button></div></div>`).join('')}</div>`; }).join('')}
    </details>`;
  });
}
async function hsugShow(id) {
  const el = document.getElementById('hsph-' + id); if (el) el.innerHTML = '…';
  try { hsugPhotos[id] = (await adminFetch('/admin/hsug/photo?id=' + id, null, adminAuth())).data; } catch (e) { showToast(e.message); }
  hsugRender();
}
function hsugOpenHotel(city, i) {
  if (typeof switchTab === 'function') try { const b = document.querySelector(`.tab-btn[onclick*="'${city}'"]`); switchTab(city, b); } catch (e) {}
  const c = document.getElementById('card-hotel-' + city); if (c && !c.classList.contains('open')) c.classList.add('open');
  if (hotelOpen[city] !== i) toggleHotel(city, i);
}
async function hsugApprove(id) {
  const r = (hsugRows || []).find(x => x.id === id); if (!r) return;
  const v = r.value || {};
  if (r.field === 'new') {
    hotelState[r.city].push({ id: 'hotel-' + r.city + '-' + Date.now(), name: v.name || r.hotel_name, nameEn: '', code: '', address: '', addressAr: '', imgs: [], mapNeshanUrl: '', mapGoogleUrl: '', hidden: true, contacts: [] });
  } else {
    const x = hsugHotel(r.city, r.hotel_id); if (!x) return showToast('این هتل در فهرست پیدا نشد.');
    const h = x.h;
    if (r.field === 'address' || r.field === 'addressAr' || r.field === 'nameEn') {
      if (h[r.field] && !confirm(`الان این مقدار ثبت است:\n${h[r.field]}\n\nبا این جایگزین شود؟\n${v}`)) return;
      h[r.field] = String(v);
    } else if (r.field === 'phone') {
      if (h.contacts.some(c => (c.phone || '').replace(/\D/g, '').slice(-9) === String(v.phone).replace(/\D/g, '').slice(-9))) showToast('این شماره از قبل بود.');
      else { let ph = String(v.phone).replace(/[^\d]/g, ''), cc = '964'; if (ph.startsWith('00964')) ph = '0' + ph.slice(5); else if (ph.startsWith('964')) ph = '0' + ph.slice(3); h.contacts.push({ role: v.role || '', phone: ph, name: null, countryCode: cc }); }
    } else if (r.field === 'geo') {
      h.mapGoogleUrl = `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`; h.geoOk = true;
    } else if (r.field === 'photo') {
      if (!hsugPhotos[id]) { try { hsugPhotos[id] = (await adminFetch('/admin/hsug/photo?id=' + id, null, adminAuth())).data; } catch (e) { return showToast(e.message); } }
      h.imgs.push({ path: '', data: hsugPhotos[id] });
    } else if (r.field === 'fix') {
      hsugOpenHotel(r.city, x.i);
      showToast('گزارش را بررسی و در ویرایشگر همین هتل اصلاح کنید؛ بعد «انتشار».');
    }
  }
  hsugApplied.add(id);
  if (typeof adminDirty !== 'undefined') adminDirty = true;
  renderHotels(r.city); hsugRender();
  if (r.field !== 'fix') showToast('✅ در اطلاعات هتل گذاشته شد؛ برای ثبت نهایی «انتشار» را بزنید.');
}
async function hsugReject(id) {
  const reason = prompt('دلیل رد (برای مدیر ثابت نشان داده می‌شود؛ مثلاً «عکس تار است» یا «این آدرس هتل دیگری است»):', ''); if (reason === null) return;
  if (!reason.trim()) return showToast('دلیل را بنویسید.');
  try { await adminFetch('/admin/hsug/set', { ids: [id], status: 'rejected', reason }, adminAuth()); hsugRows = hsugRows.filter(r => r.id !== id); hsugRender(); showToast('رد شد'); } catch (e) { showToast(e.message); }
}
/* بعد از انتشار موفق (publishData / staffPublish) */
async function hsugAfterPublish() {
  if (!hsugApplied.size) return;
  const ids = [...hsugApplied];
  try { await adminFetch('/admin/hsug/set', { ids, status: 'approved' }, adminAuth()); hsugRows = (hsugRows || []).filter(r => !hsugApplied.has(r.id)); hsugApplied = new Set(); hsugRender(); }
  catch (e) { showToast('اطلاعات منتشر شد، ولی ثبت تأیید پیشنهادها انجام نشد: ' + e.message); }
}
/* هر وقت ورود به پنل کامل شد (و هر ۳ دقیقه) صف را بخوان */
(function hsugBoot() {
  let tries = 0;
  const t = setInterval(() => { tries++;
    const ready = typeof hotelState !== 'undefined' && document.getElementById('hotels-najaf') && ((typeof STAFF !== 'undefined' && STAFF) || (typeof ghToken !== 'undefined' && ghToken));
    if (ready) { clearInterval(t); hsugLoad(); setInterval(() => { if (!hsugApplied.size) hsugLoad(); }, 180000); }
    else if (tries > 600) clearInterval(t);
  }, 1000);
})();
document.head.insertAdjacentHTML('beforeend', `<style>
  .hsug-box{border:1px solid var(--gold,#C9A24B);border-radius:12px;padding:10px 12px;margin:0 0 12px;background:var(--card2)}
  .hsug-box summary{cursor:pointer;font-weight:800;font-size:13.5px}
  .hs-h{border-top:1px dashed var(--border);padding:8px 0;margin-top:8px}.hs-hn{font-weight:800;font-size:13px;margin-bottom:4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .hs-r{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:6px 0;font-size:12.5px;flex-wrap:wrap}
  .hs-f{font-weight:800}.hs-dim{color:var(--dim);font-size:11.5px;margin-top:2px}.hs-err{color:#B3261E;font-size:12px}.hs-ok{color:#1e7a46}
  .hs-act{display:flex;gap:6px;flex-shrink:0}
  .hs-b{font:inherit;font-size:12px;font-weight:700;border:1px solid var(--border-s,#ccc);border-radius:8px;padding:5px 10px;background:var(--card);color:var(--text);cursor:pointer}
  .hs-b.ok{background:#1e7a46;color:#fff;border-color:transparent}.hs-b.no{color:#B3261E}
  .hs-ph img{max-width:260px;max-height:200px;border-radius:8px;margin-top:6px;display:block}
</style>`);
