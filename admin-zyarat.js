/* ══════════════════════════════════════════
   ZYARAT ADMIN — تب «زیارت‌نامه‌ها»: مکان‌ها (نام، شهر، مختصات، شعاع) و زیارت‌نامه‌های هر مکان
   خروجی: zyarat = { note, places:[{ id, city, name, lat, lng, r, hidden?, items:[{ title, rows }] }] }
   قالب متن در پنل: بندها با یک خط خالی از هم جدا می‌شوند؛ خط اول هر بند عربی و خط‌های بعدی ترجمه فارسی.
   بندی که با # شروع شود «توضیح» است (مثلاً: «سپس دو رکعت نماز بخوان»).
══════════════════════════════════════════ */
let zyState = { note: '', places: [] }, zyOpen = new Set(), zyItemOpen = new Set();

function zyRowsToText(rows) {
  return (rows || []).map(r => r.n ? '# ' + r.n : (r.a || '') + (r.f ? '\n' + r.f : '')).join('\n\n');
}
function zyTextToRows(t) {
  return String(t || '').replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean).map(b => {
    if (b.startsWith('#')) return { n: b.replace(/^#+\s*/, '').replace(/\s*\n\s*/g, ' ') };
    const [a, ...f] = b.split('\n').map(x => x.trim()).filter(Boolean);
    return f.length ? { a, f: f.join(' ') } : { a };
  });
}
function initZyarat() {
  const z = CARAVAN_DATA.zyarat || {};
  zyState = {
    note: z.note || '',
    places: (z.places || []).map(p => ({ id: p.id, city: p.city || '', name: p.name || '', lat: p.lat ?? '', lng: p.lng ?? '', r: p.r || 250, hidden: !!p.hidden,
      items: (p.items || []).map(i => ({ title: i.title || '', text: zyRowsToText(i.rows) })) }))
  };
  renderZyarat();
}
const zyCityName = id => (cityMeta[id] && cityMeta[id].name) || DEFAULT_CITY[id] || id;
function renderZyarat() {
  const el = document.getElementById('zyarat-admin');
  if (!el) return;
  const P = zyState.places, btn = (l, js, cls = 'add-row-btn') => `<button class="${cls}" style="margin:0;width:auto;min-height:36px;padding:0 10px;white-space:nowrap" onclick="${js}">${l}</button>`;
  el.innerHTML = `
  <div class="info-box"><strong>📿 زیارت‌نامه‌ها</strong>
    هر مکان یک محدوده دارد (مختصات مرکز و شعاع به متر). وقتی زائر داخل این محدوده باشد، زیارت‌نامه‌های همان مکان بالای صفحه اول برنامه نمایش داده می‌شود.
    همه مکان‌ها در «زیارت‌نامه‌ها» (آیکون صفحه اول و منوی بیشتر) هم فهرست می‌شوند.</div>
  <div class="field"><div class="field-label">منبع متن و ترجمه (پایین هر زیارت‌نامه نوشته می‌شود)</div>
    <input type="text" class="input-full" value="${escH(zyState.note)}" placeholder="مثلاً: ترجمه فارسی: ..." oninput="zyState.note=this.value"></div>
  ${P.map((p, i) => {
    const open = zyOpen.has(i), n = p.items.length;
    return `<div class="sec-card ${open ? 'open' : ''}" style="margin-bottom:10px">
    <div class="sec-card-head" onclick="zyToggle(${i})" style="cursor:pointer">
      <div class="sec-head-icon ico-gen">🕌</div>
      <div class="sec-head-info"><div class="sec-head-title">${escH(p.name || 'مکان بدون نام')}${p.hidden ? ' <span style="color:#B3261E;font-size:12px">(پنهان)</span>' : ''}</div>
        <div class="sec-head-sub">${escH(zyCityName(p.city) || 'بدون شهر')} · ${n.toLocaleString('fa')} زیارت‌نامه${p.lat === '' || p.lng === '' ? ' · ⚠️ مختصات ندارد' : ''}</div></div>
      <span class="sec-chevron">▼</span>
    </div>
    ${open ? `<div class="sec-body" style="display:block">
      <div class="zy-g2">
        <div><div class="field-label">نام مکان</div><input type="text" class="input-full" value="${escH(p.name)}" placeholder="مثلاً: حرم حضرت عباس (ع)" oninput="zyState.places[${i}].name=this.value"></div>
        <div><div class="field-label">شهر</div><select class="fsel-a" style="width:100%" onchange="zyState.places[${i}].city=this.value">${ALL_CITIES.map(c => `<option value="${c}" ${p.city === c ? 'selected' : ''}>${escH(zyCityName(c))}</option>`).join('')}</select></div>
      </div>
      <div class="zy-g3">
        <div><div class="field-label">عرض جغرافیایی (lat)</div><input type="text" dir="ltr" class="input-full" id="zyLat${i}" value="${escH(String(p.lat))}" placeholder="32.6165" oninput="zyState.places[${i}].lat=this.value"></div>
        <div><div class="field-label">طول جغرافیایی (lng)</div><input type="text" dir="ltr" class="input-full" id="zyLng${i}" value="${escH(String(p.lng))}" placeholder="44.0324" oninput="zyState.places[${i}].lng=this.value"></div>
        <div><div class="field-label">شعاع (متر)</div><input type="number" dir="ltr" class="input-full" value="${escH(String(p.r))}" min="50" max="3000" oninput="zyState.places[${i}].r=+this.value||250"></div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px">
        ${btn('📍 موقعیت فعلی من (وقتی در همان مکان هستید)', `zyHereBtn(${i},this)`)}
        ${p.lat !== '' && p.lng !== '' ? `<a class="add-row-btn" style="margin:0;width:auto;min-height:36px;padding:0 10px;display:inline-flex;align-items:center;text-decoration:none" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.lat + ',' + p.lng)}">🗺️ دیدن روی نقشه</a>` : ''}
      </div>
      <div class="empty-msg" style="padding:0 0 10px">مختصات را می‌توانید از گوگل‌مپ بردارید: روی نقطه نگه دارید تا دو عدد مثل 32.6165, 44.0324 ظاهر شود. شعاع ۲۰۰ تا ۳۰۰ متر برای حرم‌ها مناسب است.</div>
      <label class="fchk" style="padding:0 0 10px"><input type="checkbox" ${p.hidden ? 'checked' : ''} onchange="zyState.places[${i}].hidden=this.checked;renderZyarat()"> <b>پنهان از کاربران (فقط در پیش‌نمایش دیده شود)</b></label>
      ${p.items.map((it, k) => {
        const key = i + ':' + k, o = zyItemOpen.has(key), cnt = zyTextToRows(it.text).length;
        return `<div class="lay-slide">
          <div style="display:flex;gap:6px;align-items:center">
            <input type="text" class="input-full" style="flex:1" value="${escH(it.title)}" placeholder="عنوان — مثلاً: زیارت وارث" oninput="zyState.places[${i}].items[${k}].title=this.value">
            ${btn(o ? '▴ بستن متن' : `▾ متن (${cnt.toLocaleString('fa')} بند)`, `zyItemToggle('${key}')`)}
            <span class="lay-mv">${btn('▲', `zyMoveItem(${i},${k},-1)`, '')}${btn('▼', `zyMoveItem(${i},${k},1)`, '')}${btn('🗑', `if(confirm('این زیارت‌نامه حذف شود؟')){zyState.places[${i}].items.splice(${k},1);renderZyarat()}`, 'del-btn')}</span>
          </div>
          ${o ? `<div class="empty-msg" style="padding:6px 0">هر بند را با <b>یک خط خالی</b> از بند بعد جدا کنید. در هر بند: <b>خط اول متن عربی</b>، خط دوم ترجمه فارسی (اختیاری). بندی که با <b>#</b> شروع شود توضیح است.</div>
          <textarea class="zy-ta" dir="rtl" oninput="zyState.places[${i}].items[${k}].text=this.value" placeholder="اَلسَّلامُ عَلَیْکَ يَا أَمِينَ اللّٰهِ فِي أَرْضِهِ
سلام بر تو ای امین خدا بر روی زمینش

# سپس بگو:">${escH(it.text)}</textarea>` : ''}
        </div>`;
      }).join('')}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${btn('+ زیارت‌نامه / دعای جدید برای این مکان', `zyState.places[${i}].items.push({title:'',text:''});zyItemOpen.add('${i}:'+(zyState.places[${i}].items.length-1));renderZyarat()`)}
        ${btn('▲ بالاتر', `zyMovePlace(${i},-1)`)}${btn('▼ پایین‌تر', `zyMovePlace(${i},1)`)}
        ${btn('🗑 حذف این مکان', `if(confirm('مکان «${escH(p.name).replace(/'/g, '')}» و همه زیارت‌نامه‌هایش حذف شود؟')){zyState.places.splice(${i},1);zyOpen.clear();renderZyarat()}`, 'del-btn')}
      </div>
    </div>` : ''}
  </div>`;
  }).join('')}
  <button class="add-row-btn" onclick="zyAddPlace()">+ افزودن مکان جدید (حرم، مسجد، مقام، ...)</button>`;
}
function zyToggle(i) { zyOpen.has(i) ? zyOpen.delete(i) : zyOpen.add(i); renderZyarat(); }
function zyItemToggle(k) { zyItemOpen.has(k) ? zyItemOpen.delete(k) : zyItemOpen.add(k); renderZyarat(); }
function zyAddPlace() {
  zyState.places.push({ id: 'p' + Date.now().toString(36), city: ALL_CITIES[0], name: '', lat: '', lng: '', r: 250, hidden: false, items: [{ title: '', text: '' }] });
  const i = zyState.places.length - 1;
  zyOpen.add(i); zyItemOpen.add(i + ':0');
  renderZyarat();
}
function zyMovePlace(i, d) {
  const a = zyState.places, j = i + d;
  if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  zyOpen.clear(); zyOpen.add(j); zyItemOpen.clear();
  renderZyarat();
}
function zyMoveItem(i, k, d) {
  const a = zyState.places[i].items, j = k + d;
  if (j < 0 || j >= a.length) return;
  [a[k], a[j]] = [a[j], a[k]];
  zyItemOpen.clear();
  renderZyarat();
}
function zyHereBtn(i, b) {
  if (!navigator.geolocation) return showToast('این مرورگر موقعیت‌یاب ندارد');
  b.disabled = true; b.textContent = '... در حال پیدا کردن موقعیت';
  navigator.geolocation.getCurrentPosition(pos => {
    const p = zyState.places[i];
    p.lat = +pos.coords.latitude.toFixed(5); p.lng = +pos.coords.longitude.toFixed(5);
    renderZyarat();
    showToast(`موقعیت ثبت شد (دقت حدود ${Math.round(pos.coords.accuracy).toLocaleString('fa')} متر)`);
  }, () => { b.disabled = false; b.textContent = '📍 موقعیت فعلی من'; showToast('موقعیت پیدا نشد — اجازه موقعیت را بدهید و GPS را روشن کنید'); },
  { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
}
function zyOut() {
  const num = v => { const n = parseFloat(String(v).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))); return isFinite(n) ? n : null; };
  return { zyarat: { note: zyState.note.trim(), places: zyState.places.filter(p => p.name.trim()).map(p => ({
    id: p.id, city: p.city, name: p.name.trim(), lat: num(p.lat), lng: num(p.lng), r: Math.max(50, Math.min(3000, +p.r || 250)),
    ...(p.hidden ? { hidden: true } : {}),
    items: p.items.filter(it => it.title.trim() || it.text.trim()).map(it => ({ title: it.title.trim() || 'زیارت‌نامه', rows: zyTextToRows(it.text) }))
  })) } };
}

(function injectZyAdminCSS() {
  document.head.insertAdjacentHTML('beforeend', `<style>
  .zy-g2{display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:8px}
  .zy-g3{display:grid;grid-template-columns:1fr 1fr 110px;gap:8px}
  @media(max-width:560px){.zy-g2,.zy-g3{grid-template-columns:1fr}}
  .zy-ta{width:100%;min-height:340px;resize:vertical;background:#fff;color:#1a1a1a;border:1px solid #cfd8d3;border-radius:10px;padding:10px;font-family:inherit;font-size:15px;line-height:2}
  </style>`);
})();
