/* ══════════════════════════════════════════
   PLACES ADMIN — مکان‌های هر شهر (رستوران، پارکینگ، درمانگاه، ...)
══════════════════════════════════════════ */
const PLACE_TYPES = { restaurant: ['🍽️', 'رستوران'], parking: ['🅿️', 'پارکینگ'], clinic: ['🏥', 'درمانگاه'], ziyarat: ['🕌', 'اماکن زیارتی'], other: ['📍', 'سایر'] };

/* مکان‌های پیشنهادی از روی نقشه‌های رسمی سازمان حج و زیارت (خرداد ۱۴۰۴)
   لینک‌ها جستجوی گوگل مپ هستند؛ برای مسیریابی دقیق، لینک کامل با مختصات جایگزین کنید */
const gq = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
const NOTE_MAP = ' (طبق نقشه رسمی)';
const PLACE_SUGGEST = {
  najaf: [
    ['ziyarat', 'مرقد حضرت هود و صالح (ع)', 'قبرستان وادی السلام', gq('مرقد النبي هود والنبي صالح النجف')],
    ['ziyarat', 'مقام امام زمان (عج) و امام صادق (ع)', 'قبرستان وادی السلام', gq('مقام الإمام المهدي وادي السلام النجف')],
    ['ziyarat', 'مقام امام سجاد (ع)', 'غرب حرم، نزدیک مقام صافی صفا' + NOTE_MAP, gq('مقام الإمام زين العابدين النجف')],
    ['ziyarat', 'مقام صافی صفا', 'غرب حرم' + NOTE_MAP, gq('مقام صافي صفا النجف')],
    ['ziyarat', 'مرقد آیت‌الله حکیم', 'میدان ثورة العشرین', gq('مرقد السيد محسن الحكيم النجف')],
    ['ziyarat', 'مرقد آیت‌الله قاضی', 'قبرستان وادی السلام' + NOTE_MAP, gq('مرقد السيد علي القاضي النجف')],
    ['ziyarat', 'مزار علامه امینی', 'نزدیک حرم، کنار کنسولگری ایران' + NOTE_MAP, gq('مرقد العلامة الأميني النجف')],
    ['ziyarat', 'منزل امام خمینی (ره)', 'محله حویش، نزدیک حرم' + NOTE_MAP, gq('بيت الإمام الخميني النجف')],
    ['ziyarat', 'قبرستان وادی السلام', 'شمال حرم', gq('مقبرة وادي السلام النجف')]
  ],
  karbala: [
    ['clinic', 'هلال احمر — مستشفی السفیر', 'خیابان شهداء، نزدیک صحن عقیله' + NOTE_MAP, gq('مستشفى السفير كربلاء')],
    ['clinic', 'هلال احمر — نزدیک هتل ملاک', 'نزدیک هتل ملاک' + NOTE_MAP, ''],
    ['clinic', 'هلال احمر — نزدیک هتل الماس شرق', 'نزدیک هتل الماس شرق، محدوده باب الخان' + NOTE_MAP, ''],
    ['parking', 'گاراژ موحد', 'نزدیک باب طویریج و جسر الحسین' + NOTE_MAP, ''],
    ['ziyarat', 'خیمه‌گاه', 'جنوب غرب حرم امام حسین (ع)', gq('المخيم الحسيني كربلاء')],
    ['ziyarat', 'مقام امام زمان (عج)', 'شمال حرم، خیابان امام مهدی (عج)', gq('مقام الإمام المهدي كربلاء')]
  ]
};
function addSuggestedPlaces(id) {
  const ex = new Set(placeState[id].map(p => p.title.trim()));
  let n = 0;
  (PLACE_SUGGEST[id] || []).forEach(([type, title, address, g]) => {
    if (ex.has(title)) return;
    placeState[id].push({ id: pid(), type, title, address, mapNeshanUrl: '', mapGoogleUrl: g, contacts: [] });
    n++;
  });
  placeOpen[id] = -1;
  renderPlaces(id);
  showToast(n ? `${n} مکان اضافه شد — بررسی کنید و «انتشار» را بزنید` : 'همه مکان‌های پیشنهادی از قبل اضافه شده‌اند');
}
const ALL_CITIES = ['najaf', 'karbala', 'kadhimiya', 'samarra'];
const placeState = {}, placeOpen = {};
const pid = () => 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function initPlaces() {
  ALL_CITIES.forEach(id => {
    const c = CARAVAN_DATA.cities.find(x => x.id === id) || {};
    placeState[id] = (c.places || []).map(p => ({
      id: p.id || pid(), type: PLACE_TYPES[p.type] ? p.type : 'other', title: p.title || '', address: p.address || '',
      mapNeshanUrl: p.mapNeshanUrl || '', mapGoogleUrl: p.mapGoogleUrl || '',
      contacts: (p.contacts || []).map(x => ({ role: x.role || '', phone: x.phone || '', name: x.name || '', countryCode: x.countryCode || '964' }))
    }));
    placeOpen[id] = -1;
    renderPlaces(id);
  });
}

function placesData(id) {
  return (placeState[id] || [])
    .filter(p => [p.title, p.address, p.mapNeshanUrl, p.mapGoogleUrl].some(x => x.trim()) || p.contacts.some(c => c.phone.trim()))
    .map(p => ({
      id: p.id, type: p.type, title: p.title.trim() || PLACE_TYPES[p.type][1], address: p.address.trim(),
      mapNeshanUrl: p.mapNeshanUrl.trim(), mapGoogleUrl: p.mapGoogleUrl.trim(),
      contacts: p.contacts.filter(c => c.phone.trim()).map(c => ({
        role: c.role.trim(), phone: c.phone.trim(), name: c.name.trim() || null, countryCode: c.countryCode || '964'
      }))
    }));
}

function renderPlaces(id) {
  const el = document.getElementById('places-' + id);
  if (!el) return;
  const list = placeState[id], open = placeOpen[id];
  const cnt = document.getElementById('place-count-' + id);
  if (cnt) cnt.textContent = list.length ? list.length + ' مکان' : 'هنوز مکانی ثبت نشده';
  const tools = `<div class="hotel-tools" style="flex-wrap:wrap">${Object.entries(PLACE_TYPES).map(([k, [ico, l]]) =>
    `<button class="add-row-btn" onclick="addPlace('${id}','${k}')">+ ${ico} ${l}</button>`).join('')}
    ${PLACE_SUGGEST[id] ? `<button class="add-row-btn" style="flex-basis:100%" onclick="addSuggestedPlaces('${id}')">📥 افزودن مکان‌های پیشنهادی از نقشه رسمی (هلال احمر، اماکن زیارتی و ...)</button>` : ''}</div>`;
  if (!list.length) { el.innerHTML = tools + '<div class="empty-msg">مکانی ثبت نشده</div>'; return; }
  el.innerHTML = tools + list.map((p, i) => {
    const [ico, label] = PLACE_TYPES[p.type];
    let h = `
    <div class="hotel-entry ${open === i ? 'open' : ''}" id="place-${id}-${i}">
      <div class="hotel-entry-head" onclick="togglePlace('${id}',${i})">
        <div class="hotel-num">${i + 1}</div>
        <div class="hotel-thumb-a">${ico}</div>
        <div style="flex:1;min-width:0">
          <div class="hotel-entry-name" id="pn-${id}-${i}">${escH(p.title) || label + ' جدید'}</div>
          <div class="hotel-meta">${label} · ${p.contacts.length} شماره${p.mapGoogleUrl || p.mapNeshanUrl ? ' · 🗺️ نقشه دارد' : ''}</div>
        </div>
        <div class="hotel-ctl" onclick="event.stopPropagation()">
          <button title="بالاتر" onclick="movePlace('${id}',${i},-1)">▲</button>
          <button title="پایین‌تر" onclick="movePlace('${id}',${i},1)">▼</button>
          <button class="del-btn" title="حذف" onclick="deletePlace('${id}',${i})">🗑</button>
        </div>
        <span class="hotel-chev">▼</span>
      </div>`;
    if (open !== i) return h + '</div>';
    const f = (k, lbl, ph, ltr) => `<div><div class="field-label">${lbl}</div>
      <input type="text" class="input-full" value="${escH(p[k])}" placeholder="${ph}" ${ltr ? 'dir="ltr"' : ''}
             oninput="setPlace('${id}',${i},'${k}',this.value)"></div>`;
    h += `
      <div class="hotel-fields">
        <div><div class="field-label">نوع مکان</div>
          <select class="fsel-a" onchange="setPlace('${id}',${i},'type',this.value,true)">
            ${Object.entries(PLACE_TYPES).map(([k, [ic, l]]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${ic} ${l}</option>`).join('')}
          </select></div>
        ${f('title', 'عنوان', 'مثلاً: رستوران کاروان‌های ایرانی', false)}
        ${f('address', '📍 آدرس', 'آدرس کامل', false)}
        ${f('mapNeshanUrl', '🗺️ لینک نقشه نشان', 'https://nshn.ir/...', true)}
        ${f('mapGoogleUrl', '🌍 لینک گوگل مپ (لینک کامل با مختصات، برای دکمه مسیریابی)', 'https://maps.google.com/...', true)}
      </div>
      <div class="hotel-phones-section">
        <div class="hotel-phones-title">📞 شماره‌های تماس</div>
        ${p.contacts.map((c, k) => `
          <div class="phone-row" style="flex-wrap:wrap">
            <input type="text" class="input-role" style="flex:1" placeholder="نقش (مثلاً مسئول رستوران)" value="${escH(c.role)}" oninput="setPlaceContact('${id}',${i},${k},'role',this.value)">
            <input type="tel" class="input-phone" placeholder="07..." dir="ltr" value="${escH(c.phone)}" oninput="setPlaceContact('${id}',${i},${k},'phone',this.value)">
            <input type="text" class="input-name" placeholder="نام (اختیاری)" value="${escH(c.name)}" oninput="setPlaceContact('${id}',${i},${k},'name',this.value)">
            <button class="del-btn" onclick="delPlaceContact('${id}',${i},${k})">🗑</button>
          </div>`).join('') || '<div class="empty-msg" style="padding:4px 0">شماره‌ای ثبت نشده</div>'}
        <button class="add-row-btn" style="margin-top:6px" onclick="addPlaceContact('${id}',${i})">+ افزودن شماره</button>
      </div>
    </div>`;
    return h;
  }).join('');
}

function togglePlace(id, i) {
  placeOpen[id] = placeOpen[id] === i ? -1 : i;
  renderPlaces(id);
  if (placeOpen[id] === i) setTimeout(() => document.getElementById(`place-${id}-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30);
}
function addPlace(id, type) {
  placeState[id].push({ id: pid(), type, title: '', address: '', mapNeshanUrl: '', mapGoogleUrl: '', contacts: [] });
  const i = placeState[id].length - 1;
  placeOpen[id] = i;
  renderPlaces(id);
  setTimeout(() => {
    const row = document.getElementById(`place-${id}-${i}`);
    if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'start' }); row.querySelectorAll('.hotel-fields input')[0]?.focus(); }
  }, 60);
}
function deletePlace(id, i) {
  if (!confirm('این مکان حذف شود؟')) return;
  placeState[id].splice(i, 1);
  if (placeOpen[id] === i) placeOpen[id] = -1; else if (placeOpen[id] > i) placeOpen[id]--;
  renderPlaces(id);
}
function movePlace(id, i, d) {
  const a = placeState[id], j = i + d;
  if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  if (placeOpen[id] === i) placeOpen[id] = j; else if (placeOpen[id] === j) placeOpen[id] = i;
  renderPlaces(id);
}
function setPlace(id, i, k, v, rerender) {
  placeState[id][i][k] = v;
  if (rerender) { renderPlaces(id); return; }
  if (k === 'title') {
    const el = document.getElementById(`pn-${id}-${i}`);
    if (el) el.textContent = v || PLACE_TYPES[placeState[id][i].type][1] + ' جدید';
  }
}
function addPlaceContact(id, i) { placeState[id][i].contacts.push({ role: '', phone: '', name: '', countryCode: '964' }); renderPlaces(id); }
function delPlaceContact(id, i, k) { placeState[id][i].contacts.splice(k, 1); renderPlaces(id); }
function setPlaceContact(id, i, k, f, v) { placeState[id][i].contacts[k][f] = v; }
