'use strict';
/* ══════════════════════════════════════════
   🏨 تکمیل اطلاعات هتل‌های اپ توسط مدیران ثابت
   • هر هتلِ اکسل هفتگی یک بار به هتلِ اپ (data.js) وصل می‌شود؛ وصل بودن برای مدیر ثابت بعدی هم می‌ماند
   • مورد ثبت‌شده در اپ «✓» است و فقط «🔧 اشتباه است» دارد؛ مورد خالی باز است؛ مورد فرستاده‌شده «⏳ در انتظار تأیید»
   • تأیید در بخش هتل‌های پنل مدیریت (admin-hotelsug.js)؛ سرپرست و مدیر منطقه درصد تکمیل را می‌بینند
══════════════════════════════════════════ */
let APP_P = null;
function loadAppHotels() {
  if (!APP_P) APP_P = fetch('data.js', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('اطلاعات اپ بار نشد.'); return r.text(); })
    .then(t => new Function(t + ';return CARAVAN_DATA.cities;')()).catch(e => { APP_P = null; throw e; });
  return APP_P;
}
const HI_ITEMS = [['photos', '📸 عکس‌ها'], ['address', '📍 آدرس فارسی'], ['addressAr', '📍 آدرس عربی'], ['phone', '☎️ تلفن هتل'], ['geo', '🗺️ موقعیت دقیق روی نقشه'], ['nameEn', '🔤 نام انگلیسی']];
const HI_PHOTO_MIN = 4, PHOTO_CATS = ['نما', 'لابی', 'اتاق', 'رستوران', 'سرویس بهداشتی', 'سایر'];
/* کدام موردها در خود اپ ثبت شده است */
function hiDone(h) {
  if (!h) return {};
  return { photos: (h.images || []).length >= HI_PHOTO_MIN, address: !!(h.address || '').trim(), addressAr: !!(h.addressAr || '').trim(), phone: (h.contacts || []).some(c => c.phone), geo: !!h.geoOk, nameEn: !!(h.nameEn || '').trim() };
}
const hiPct = h => { const d = hiDone(h); return Math.round(HI_ITEMS.filter(([k]) => d[k]).length / HI_ITEMS.length * 100); };
const hiNorm = s => String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه').replace(/[أإآ]/g, 'ا').replace(/(فندق|هتل|hotel|مهمانسرا|زائرسرای|زائر سرای)/gi, '').replace(/[\s‌\-_.,،()]+/g, '').toLowerCase();
function hiCandidates(name, hotels) {
  const n = hiNorm(name);
  return hotels.map(h => { const a = hiNorm(h.name), b = hiNorm(h.nameEn);
    const s = a === n ? 100 : (a && n && (a.includes(n) || n.includes(a))) ? 80 : (b && n && (b.includes(n) || n.includes(b))) ? 70 : [...n].filter((c, i) => a.includes(n.slice(i, i + 3))).length / Math.max(3, n.length) * 60;
    return { h, s }; }).filter(x => x.s >= 35).sort((x, y) => y.s - x.s).slice(0, 5);
}
/* عکس ← حداکثر ۱۲۸۰ پیکسل JPEG (اطلاعات مکانی داخل فایل با کشیدن روی بوم پاک می‌شود) */
function hiShrink(file) {
  return new Promise((ok, no) => { const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); let q = 0.82, d = c.toDataURL('image/jpeg', q); while (d.length > 850000 && q > 0.4) { q -= 0.1; d = c.toDataURL('image/jpeg', q); } ok(d); };
    img.onerror = () => { URL.revokeObjectURL(u); no(new Error('این فایل عکس قابل خواندن نیست.')); }; img.src = u; });
}
const hiFmtPhone = c => `${c.countryCode && c.countryCode !== '964' ? '+' + c.countryCode + ' ' : ''}${c.phone}`;

window.openHotelInfo = async (hotel, back) => {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="empty"><span class="spin"></span>در حال بارگذاری…</div>';
  let r, cities; try { [r, cities] = await Promise.all([api('/api/fm/hinfo?hotel=' + encodeURIComponent(hotel)), loadAppHotels()]); } catch (e) { toast(e.message, true); return back(); }
  const city = cities.find(c => c.id === r.city) || { hotels: [] }, list = city.hotels || [];
  const H = r.link && list.find(h => h.id === r.link);
  const head = `<header class="app-head"><div class="in"><button class="hbtn" id="hb">→</button><div class="t"><div class="hi">${esc(r.cityName)} · اطلاعات هتل در اپ همیار کاروان</div><h1>🏨 ${esc(hotel)}</h1></div></div></header>`;
  const go = () => openHotelInfo(hotel, back);
  /* ── ۱. وصل کردن به هتل اپ ── */
  if (!H) {
    const C = hiCandidates(hotel, list), pendNew = r.sugs.some(s => s.field === 'new');
    app.innerHTML = head + `<main class="page"><section class="card"><h2 style="font-size:16px;margin:0">این هتل در اپ کدام است؟</h2>
      <p class="hint">یک بار مشخص کنید «${esc(hotel)}» در فهرست هتل‌های ${esc(r.cityName)} در اپ کدام است. این انتخاب برای مدیران ثابت بعدی هم می‌ماند.</p>
      ${C.length ? `<div class="hi-cands">${C.map(x => `<button class="btn ghost" data-pick="${esc(x.h.id)}">✓ ${esc(x.h.name)}${x.h.nameEn ? ` <span class="dim" dir="ltr">${esc(x.h.nameEn)}</span>` : ''}</button>`).join('')}</div>` : '<p class="hint">هتل مشابهی پیدا نشد.</p>'}
      <div class="field" style="margin-top:10px"><label class="label" for="hs">جستجو در همه‌ی هتل‌های ${esc(r.cityName)} (${fa(list.length)} هتل)</label><input id="hs" class="inp" placeholder="بخشی از نام هتل…"></div><div id="hl" class="hi-cands"></div>
      <div class="hi-new">${pendNew ? '<span class="pill warn">⏳ افزودن این هتل به اپ پیشنهاد شده و در انتظار تأیید است</span>' : '<button class="btn small ghost" id="hn">➕ این هتل در فهرست اپ نیست؛ پیشنهاد افزودن</button>'}</div></section></main>`;
    app.querySelector('#hb').onclick = back;
    const pick = async id => { try { await api('/api/fm/hinfo/link', { body: { hotel, hotel_id: id } }); toast('وصل شد ✅'); go(); } catch (e) { toast(e.message, true); } };
    const bind = () => app.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => pick(b.dataset.pick));
    app.querySelector('#hs').oninput = e => { const q = hiNorm(e.target.value); app.querySelector('#hl').innerHTML = q.length < 2 ? '' : list.filter(h => hiNorm(h.name).includes(q) || hiNorm(h.nameEn).includes(q)).slice(0, 12).map(h => `<button class="btn ghost small" data-pick="${esc(h.id)}">${esc(h.name)}</button>`).join('') || '<span class="dim">پیدا نشد.</span>'; bind(); };
    bind();
    const hn = app.querySelector('#hn'); if (hn) hn.onclick = async () => { const note = prompt('اگر توضیحی دارید بنویسید (مثلاً نام عربی یا نشانی). بعد «تأیید» را بزنید:', ''); if (note === null) return; try { await api('/api/fm/hinfo/new', { body: { hotel, note } }); toast('پیشنهاد افزودن هتل فرستاده شد ✅'); go(); } catch (e) { toast(e.message, true); } };
    return;
  }
  /* ── ۲. موردها ── */
  const D = hiDone(H), P = f => r.sugs.filter(s => s.status === 'pending' && s.field === f), RJ = f => r.sugs.find(s => s.status === 'rejected' && s.mine && s.field === f);
  const val = s => { try { return JSON.parse(s.value); } catch (e) { return s.value; } };
  const pct = hiPct(H), oldConf = !r.confirm || Date.now() - r.confirm.t > 90 * 864e5;
  const pendLine = f => P(f).map(s => { const v = val(s); return `<div class="hi-pend">⏳ در انتظار تأیید: <b>${esc(f === 'phone' ? v.phone : f === 'geo' ? `${v.lat}, ${v.lng}` : f === 'photo' ? v.cat : v)}</b> <span class="dim">(${esc(s.user_name || '')} · ${fmtTs(s.t)})</span>${s.mine ? ` <button class="linkish" data-cancel="${s.id}">لغو</button>` : ''}</div>`; }).join('');
  const rejLine = f => { const s = RJ(f); return s && !P(f).length ? `<div class="hi-rej">❌ پیشنهاد قبلی شما رد شد: ${esc(s.reason || '')}</div>` : ''; };
  const fixBtn = f => `<button class="btn small ghost" data-fix="${f}">🔧 اشتباه است</button>`;
  const textItem = (f, cur, ph) => D[f] ? `<div class="hi-ok">✓ ${esc(cur)} ${fixBtn(f)}</div>${pendLine('fix')}` : P(f).length ? pendLine(f) : `${rejLine(f)}<div class="row"><input class="inp" data-in="${f}" placeholder="${ph}" ${f === 'nameEn' ? 'dir="ltr"' : ''} style="flex:1 1 220px"><button class="btn small" data-send="${f}">ارسال</button></div>`;
  const imgs = H.images || [], pPh = P('photo');
  app.innerHTML = head + `<main class="page">
    <section class="card"><div class="row" style="justify-content:space-between"><div><b>${esc(H.name)}</b>${H.nameEn ? ` <span class="dim" dir="ltr">${esc(H.nameEn)}</span>` : ''}<div class="dim" style="font-size:12px">هتل وصل‌شده در اپ · <button class="linkish" id="relink">تغییر</button></div></div>
      <div class="hi-pct"><b class="num">${fa(pct)}٪</b><span>تکمیل</span></div></div>
      <div class="hi-bar"><i style="width:${pct}%"></i></div>
      <p class="hint">مواردی که «✓» دارند در اپ ثبت شده‌اند و لازم نیست دوباره بفرستید؛ اگر چیزی عوض شده، «🔧 اشتباه است» را بزنید. فرستاده‌ها بعد از تأیید ستاد در اپ دیده می‌شوند.</p>
      <div class="hi-conf ${oldConf && pct >= 50 ? 'warn' : ''}">${r.confirm ? `آخرین بررسی: ${esc(r.confirm.user_name || '')} · ${fmtTs(r.confirm.t)} (${r.confirm.ok ? 'درست بود' : 'اشکال داشت'})` : 'هنوز کسی اطلاعات این هتل را بررسی نکرده است.'}
        <button class="btn small okb" id="conf">✅ اطلاعات این هتل در اپ درست است</button></div></section>
    <section class="card hi-it"><h3>📸 عکس‌ها <span class="dim">— ${fa(imgs.length)} عکس در اپ${pPh.length ? `، ${fa(pPh.length)} عکس در انتظار تأیید` : ''}</span>${D.photos ? ' <span class="pill ok">✓</span>' : ''}</h3>
      ${imgs.length ? `<div class="hi-imgs">${imgs.slice(0, 12).map(p => `<img src="${esc(p)}" alt="" loading="lazy">`).join('')}</div>` : ''}
      ${pendLine('photo')}${rejLine('photo')}
      <p class="hint">${D.photos ? 'این هتل عکس کافی دارد؛ فقط اگر عکس‌ها قدیمی است (مثلاً بعد از بازسازی) عکس تازه‌تر بفرستید.' : `دست‌کم ${fa(HI_PHOTO_MIN)} عکس روشن و افقی: نما، لابی، اتاق، رستوران.`} از زائران و افراد عکس نگیرید.</p>
      <div class="hi-cats">${PHOTO_CATS.map(c => `<label class="btn small ghost">📷 ${c}<input type="file" accept="image/*" hidden data-ph="${c}"></label>`).join('')}</div></section>
    <section class="card hi-it"><h3>📍 آدرس فارسی ${D.address ? '<span class="pill ok">✓</span>' : ''}</h3>${textItem('address', H.address, 'مثلاً: خیابان باب بغداد، روبروی …')}</section>
    <section class="card hi-it"><h3>📍 آدرس عربی (برای راننده) ${D.addressAr ? '<span class="pill ok">✓</span>' : ''}</h3>${textItem('addressAr', H.addressAr, 'مثلاً: كربلاء، باب بغداد، مقابل …')}</section>
    <section class="card hi-it"><h3>☎️ تلفن هتل ${D.phone ? '<span class="pill ok">✓</span>' : ''}</h3>
      ${D.phone ? `<div class="hi-ok">✓ <span dir="ltr">${(H.contacts || []).filter(c => c.phone).map(c => esc(hiFmtPhone(c))).join(' · ')}</span> ${fixBtn('phone')}</div>` : ''}${pendLine('phone')}${rejLine('phone')}
      <div class="row"><input class="inp" data-in="phone" inputmode="tel" dir="ltr" placeholder="مثلاً 07801234567" style="flex:1 1 160px"><input class="inp" data-in="phrole" placeholder="عنوان (پذیرش، مدیر هتل…)" style="flex:1 1 140px"><button class="btn small" data-send="phone">${D.phone ? 'افزودن شماره‌ی دیگر' : 'ارسال'}</button></div></section>
    <section class="card hi-it"><h3>🗺️ موقعیت دقیق ${D.geo ? '<span class="pill ok">✓ تأییدشده</span>' : ''}</h3>
      ${D.geo ? `<div class="hi-ok">✓ موقعیت تأیید شده است. ${fixBtn('geo')}</div>` : P('geo').length ? pendLine('geo') : `${rejLine('geo')}<p class="hint">وقتی <b>داخل یا جلوی در همین هتل</b> هستید دکمه را بزنید تا موقعیت از GPS گوشی ثبت شود.</p><button class="btn" id="geo">📍 الان در همین هتل هستم</button><span class="dim" id="geo-st" style="font-size:12.5px"></span>`}</section>
    <section class="card hi-it"><h3>🔤 نام انگلیسی هتل ${D.nameEn ? '<span class="pill ok">✓</span>' : ''}</h3>${textItem('nameEn', H.nameEn, 'مثلاً: ESHTAR HOTEL')}</section>
    <div id="hi-fix"></div>
  </main>`;
  app.querySelector('#hb').onclick = back;
  app.querySelector('#relink').onclick = async () => { if (!confirm('وصل این هتل به هتل اپ برداشته شود تا دوباره انتخاب کنید؟')) return; try { await api('/api/fm/hinfo/link', { body: { hotel, hotel_id: '' } }); go(); } catch (e) { toast(e.message, true); } };
  const send = async (field, value, extra) => { try { await api('/api/fm/hinfo/sug', { body: { hotel, field, value, ...(extra || {}) }, timeout: 60000 }); toast('فرستاده شد ✅ بعد از تأیید ستاد در اپ دیده می‌شود.'); go(); } catch (e) { toast(e.message, true); } };
  app.querySelector('#conf').onclick = async () => { try { await api('/api/fm/hinfo/confirm', { body: { hotel, ok: true } }); toast('ممنون ✅ ثبت شد.'); go(); } catch (e) { toast(e.message, true); } };
  app.querySelectorAll('[data-send]').forEach(b => b.onclick = () => { const f = b.dataset.send, v = app.querySelector(`[data-in="${f}"]`).value.trim();
    if (!v) return toast('اول بنویسید.', true);
    send(f, f === 'phone' ? { phone: v, role: app.querySelector('[data-in="phrole"]').value } : v); });
  app.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => { try { await api('/api/fm/hinfo/cancel', { body: { hotel, id: +b.dataset.cancel } }); go(); } catch (e) { toast(e.message, true); } });
  app.querySelectorAll('[data-ph]').forEach(i => i.onchange = async () => { const f = i.files[0]; i.value = ''; if (!f) return;
    try { toast('در حال آماده‌سازی و فرستادن عکس…'); const d = await hiShrink(f); await send('photo', { cat: i.dataset.ph }, { photo: d }); } catch (e) { toast(e.message, true); } });
  const gb = app.querySelector('#geo'); if (gb) gb.onclick = () => {
    const st = app.querySelector('#geo-st'); if (!navigator.geolocation) return toast('این گوشی موقعیت‌یابی ندارد.', true);
    gb.disabled = true; st.textContent = ' در حال گرفتن موقعیت… (چند ثانیه)';
    navigator.geolocation.getCurrentPosition(pos => { gb.disabled = false; const c = pos.coords;
      if (c.accuracy > 150) { st.textContent = ` دقت فعلاً ${fa(Math.round(c.accuracy))} متر است؛ کنار پنجره یا جلوی در هتل دوباره بزنید.`; return; }
      if (!confirm(`موقعیت با دقت حدود ${fa(Math.round(c.accuracy))} متر گرفته شد. شما الان داخل یا جلوی «${H.name}» هستید؟`)) { st.textContent = ''; return; }
      send('geo', { lat: c.latitude, lng: c.longitude, acc: c.accuracy }); },
    e => { gb.disabled = false; st.textContent = e.code === 1 ? ' اجازه‌ی موقعیت داده نشد؛ در تنظیمات مرورگر اجازه دهید.' : ' موقعیت گرفته نشد؛ دوباره امتحان کنید.'; }, { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }); };
  app.querySelectorAll('[data-fix]').forEach(b => b.onclick = () => { const f = b.dataset.fix, L = Object.fromEntries(HI_ITEMS), box = app.querySelector('#hi-fix');
    box.innerHTML = `<section class="card"><h3>🔧 گزارش اشتباه: ${esc(L[f === 'phone' ? 'phone' : f] || f)}</h3><div class="field"><label class="label">چه چیزی اشتباه است؟</label><textarea class="inp" id="fx-n" rows="2" maxlength="500" placeholder="مثلاً: تلفن عوض شده است"></textarea></div>
      ${f === 'geo' ? '' : '<div class="field"><label class="label">مقدار درست (اگر می‌دانید)</label><input class="inp" id="fx-v" maxlength="400"></div>'}<div class="row"><button class="btn" id="fx-s">ارسال</button><button class="btn ghost" id="fx-x">انصراف</button></div></section>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.querySelector('#fx-x').onclick = () => box.innerHTML = '';
    box.querySelector('#fx-s').onclick = () => send('fix', { field: f, value: (box.querySelector('#fx-v') || {}).value || '' }, { note: box.querySelector('#fx-n').value }); });
  window.scrollTo(0, 0);
};

/* ═════ سرپرست مناطق و مدیر منطقه: درصد تکمیل اطلاعات هتل‌ها ═════ */
window.renderHinfoAll = async (m, path, regions) => {
  let r, cities; try { [r, cities] = await Promise.all([api(path), loadAppHotels()]); } catch (e) { return toast(e.message, true); }
  const byId = new Map(cities.flatMap(c => (c.hotels || []).map(h => [h.id, h])));
  const rn = id => { const g = (regions || []).find(x => x.id === id); return g ? (g.city && !g.name.includes(g.city) ? g.city + ' · ' : '') + g.name : ''; };
  const rows = r.hotels.map(x => { const H = x.hotel_id && byId.get(x.hotel_id), d = hiDone(H); return { ...x, H, pct: H ? hiPct(H) : 0, miss: H ? HI_ITEMS.filter(([k]) => !d[k]).map(([, l]) => l) : [] }; });
  const groups = [...new Set(rows.map(x => x.region_id))];
  const avg = L => L.length ? Math.round(L.reduce((a, x) => a + x.pct, 0) / L.length) : 0;
  m.innerHTML = `<div class="card"><div class="card-h"><h2>🏨 تکمیل اطلاعات هتل‌ها در اپ</h2>${rows.length ? xlBtn('hi-x') : ''}</div>
    <p class="hint">هتل‌های اکسل سه هفته‌ی آخر. مدیر ثابت هر هتل از صفحه‌ی خودش ← «🏨 اطلاعات هتل در اپ» عکس، آدرس، تلفن و موقعیت را می‌فرستد و ستاد در پنل مدیریت تأیید می‌کند. «وصل نشده» یعنی مدیر ثابت هنوز مشخص نکرده این هتل در اپ کدام است.</p>
    <div class="kpis k6"><div class="kpi"><span class="v num">${fa(rows.length)}</span><span class="k">هتل</span></div><div class="kpi"><span class="v num">${fa(avg(rows))}٪</span><span class="k">میانگین تکمیل</span></div>
      <div class="kpi"><span class="v num">${fa(rows.filter(x => x.pct === 100).length)}</span><span class="k">کامل</span></div><div class="kpi"><span class="v num">${fa(rows.filter(x => !x.H).length)}</span><span class="k">وصل نشده</span></div>
      <div class="kpi"><span class="v num">${fa(rows.reduce((a, x) => a + x.pending, 0))}</span><span class="k">در انتظار تأیید ستاد</span></div><div class="kpi"><span class="v num">${fa(rows.filter(x => x.confirmed && Date.now() - x.confirmed < 90 * 864e5).length)}</span><span class="k">بررسی‌شده در ۳ ماه اخیر</span></div></div></div>
    ${groups.map(g => { const L = rows.filter(x => x.region_id === g); return `<div class="card"><div class="card-h"><h2>${esc(rn(g) || 'منطقه')} <span class="dim" style="font-size:13px">· ${fa(avg(L))}٪ تکمیل</span></h2></div>
      <div class="tbl-wrap"><table><thead><tr><th>هتل (اکسل)</th><th>هتل در اپ</th><th>تکمیل</th><th>کمبودها</th><th>در انتظار</th><th>مدیر ثابت</th><th>آخرین بررسی</th></tr></thead><tbody>
      ${L.sort((a, b) => a.pct - b.pct).map(x => `<tr><td><b>${esc(x.hotel)}</b></td><td>${x.H ? esc(x.H.name) : '<span class="pill warn">وصل نشده</span>'}</td><td><div class="hi-bar sm"><i style="width:${x.pct}%"></i></div><span class="num">${fa(x.pct)}٪</span></td>
        <td class="dim" style="font-size:12px">${esc(x.miss.join('، ') || (x.H ? '—' : ''))}</td><td class="num">${x.pending ? fa(x.pending) : '—'}</td><td class="dim">${esc(String(x.fms || '').split(',').join('، ') || '—')}</td><td class="dim">${x.confirmed ? fmtTs(x.confirmed) : '—'}</td></tr>`).join('')}</tbody></table></div></div>`; }).join('') || '<div class="empty">هنوز اکسل هفتگی وارد نشده است.</div>'}`;
  const xb = m.querySelector('#hi-x'); if (xb) xb.onclick = () => xlRun(xb, () => saveBook(`اطلاعات هتل ها ${xlDay(JDP.today())}.xlsx`, [{ name: 'اطلاعات هتل‌ها', title: `تکمیل اطلاعات هتل‌ها در اپ — ${fa(rows.length)} هتل`,
    head: ['منطقه', 'هتل (اکسل)', 'هتل در اپ', 'درصد تکمیل', 'کمبودها', 'در انتظار تأیید', 'مدیر ثابت', 'آخرین بررسی'], widths: [24, 26, 26, 11, 40, 12, 26, 18],
    rows: [...rows].sort((a, b) => rn(a.region_id).localeCompare(rn(b.region_id), 'fa') || a.pct - b.pct).map(x => [rn(x.region_id), x.hotel, x.H ? x.H.name : 'وصل نشده', x.pct, x.miss.join('، '), x.pending || '', String(x.fms || '').split(',').join('، '), xDT(x.confirmed)]) }]));
};

document.head.insertAdjacentHTML('beforeend', `<style>
.hi-cands{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.hi-new{margin-top:12px}
.hi-pct{display:flex;flex-direction:column;align-items:center;font-size:12px;color:var(--dim)}.hi-pct b{font-size:22px;color:var(--ink)}
.hi-bar{height:8px;border-radius:8px;background:var(--card2);overflow:hidden;margin:8px 0}.hi-bar i{display:block;height:100%;background:var(--ok);border-radius:8px}
.hi-bar.sm{height:6px;width:70px;display:inline-block;vertical-align:middle;margin:0 0 0 6px}
.hi-it h3{font-size:15px;margin:0 0 8px}
.hi-ok{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13.5px}
.hi-pend{font-size:13px;margin:4px 0;color:var(--warn)}
.hi-rej{font-size:13px;margin:4px 0;color:var(--bad)}
.hi-imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px;margin-bottom:8px}.hi-imgs img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px}
.hi-cats{display:flex;flex-wrap:wrap;gap:6px}
.hi-conf{font-size:12.5px;color:var(--dim);display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px}.hi-conf.warn{color:var(--warn);font-weight:700}
.hb-hi{font-size:12px}
</style>`);
