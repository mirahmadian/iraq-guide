/* ══════════════════════════════════════════
   CITY MAP (PDF) + HOTEL BULK IMPORT — پنل ادمین
══════════════════════════════════════════ */
(function injectMapAdminCSS() {
  const css = `
  .cmap{display:flex;flex-direction:column;gap:8px}
  .cmap-prev{border:1px solid var(--border-s);border-radius:10px;overflow:hidden;background:#eee;line-height:0}
  .cmap-prev img{width:100%;max-height:260px;object-fit:contain;display:block}
  .cmap-info{font-size:11.5px;color:var(--dim);line-height:1.9}
  .cmap-busy{font-size:12.5px;color:var(--gold);font-weight:700;padding:6px 0}
  .bulk{padding:10px 16px 6px;border-bottom:1px solid var(--border);background:var(--gold-dim2)}
  .bulk-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  .bulk-row .add-row-btn{margin:0;width:auto;flex:1;white-space:nowrap}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

/* ── PDF → تصویر (با pdf.js، فقط در پنل ادمین) ── */
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const MAP_MAX_SIDE = 3600;
const MAP_MAX_PDF_MB = 25;
const cityMapBusy = {};

function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const s = document.createElement('script');
    s.src = PDFJS_URL;
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; resolve(window.pdfjsLib); };
    s.onerror = () => reject(new Error('ابزار خواندن PDF بارگذاری نشد؛ اتصال اینترنت را بررسی کنید'));
    document.head.appendChild(s);
  });
}
function bufToB64(buf) {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
async function pdfToImage(file) {
  const lib = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const page = await pdf.getPage(1);
  const v1 = page.getViewport({ scale: 1 });
  const scale = MAP_MAX_SIDE / Math.max(v1.width, v1.height);
  const vp = page.getViewport({ scale });
  const cv = document.createElement('canvas');
  cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return {
    img: cv.toDataURL('image/jpeg', 0.86), w: cv.width, h: cv.height,
    pdfB64: buf.byteLength <= MAP_MAX_PDF_MB * 1024 * 1024 ? bufToB64(buf) : '',
    pages: pdf.numPages
  };
}
function imageToMap(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, MAP_MAX_SIDE / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve({ img: cv.toDataURL('image/jpeg', 0.86), w: cv.width, h: cv.height, pdfB64: '', pages: 1 });
    };
    img.onerror = () => reject(new Error('تصویر خوانده نشد'));
    img.src = url;
  });
}

function mapPickerHTML(id) {
  const m = cityMeta[id], pend = m.mapData, cur = m.map;
  const src = pend ? pend.img : (cur && cur.image);
  const picker = `<label class="add-row-btn" style="margin:0;text-align:center;cursor:pointer">${src ? '🔄 تغییر نقشه' : '📄 انتخاب فایل نقشه (PDF یا عکس)'}
    <input type="file" accept="application/pdf,image/*" hidden onchange="pickCityMap('${id}',this)"></label>`;
  if (cityMapBusy[id]) return `<div class="cmap-busy">⏳ در حال تبدیل نقشه به تصویر... (چند ثانیه صبر کنید)</div>`;
  if (!src) return `<div class="cmap">${picker}<div class="cmap-info">فایل PDF نقشه رسمی را انتخاب کنید. برنامه صفحه اول آن را به تصویر باکیفیت تبدیل می‌کند تا کاربر روی گوشی با دو انگشت بزرگش کند؛ خود PDF هم برای دانلود ذخیره می‌شود.</div></div>`;
  const info = pend
    ? `✅ نقشه آماده است (${pend.w}×${pend.h} پیکسل${pend.pages > 1 ? '، فقط صفحه اول' : ''}${pend.pdfB64 ? '، همراه فایل PDF' : ''}) — برای ثبت، «انتشار» را بزنید.`
    : `نقشه فعلی منتشر شده است${cur.pdf ? ' (همراه فایل PDF)' : ''}.`;
  return `<div class="cmap">
    <div class="cmap-prev"><img src="${escH(src)}" alt=""></div>
    <div class="cmap-info">${info}</div>
    <div class="bulk-row">${picker}<button class="add-row-btn" style="margin:0;color:var(--red);background:var(--red-bg);border-color:rgba(231,76,60,.4)" onclick="clearCityMap('${id}')">🗑 حذف نقشه</button></div>
  </div>`;
}
async function pickCityMap(id, input) {
  const f = input.files && input.files[0];
  if (!f) return;
  cityMapBusy[id] = true; renderCityMeta(id);
  try {
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    const r = isPdf ? await pdfToImage(f) : await imageToMap(f);
    if (isPdf && !r.pdfB64) showToast(`فایل PDF بزرگ‌تر از ${MAP_MAX_PDF_MB} مگابایت است؛ فقط تصویر نقشه ذخیره می‌شود`);
    cityMeta[id].mapData = r;
    showToast('نقشه آماده شد — برای ثبت، «انتشار» را بزنید');
  } catch (e) {
    showToast('❌ ' + (e.message || 'خطا در خواندن فایل'));
  } finally {
    cityMapBusy[id] = false; renderCityMeta(id);
  }
}
function clearCityMap(id) {
  if (!confirm('نقشه این شهر حذف شود؟')) return;
  delete cityMeta[id].mapData; cityMeta[id].map = null;
  renderCityMeta(id);
}
async function uploadPendingMaps(token) {
  for (const id of Object.keys(cityMeta)) {
    const m = cityMeta[id], p = m.mapData;
    if (!p) continue;
    const base = 'maps/' + id + '-' + Date.now();
    await putFile(base + '.jpg', '', 'Add city map image', token, p.img.split(',')[1]);
    let pdf = '';
    if (p.pdfB64) { await putFile(base + '.pdf', '', 'Add city map PDF', token, p.pdfB64); pdf = base + '.pdf'; }
    m.map = { image: base + '.jpg', pdf, w: p.w, h: p.h };
    delete m.mapData;
    renderCityMeta(id);
  }
}
function cityMapData(id) {
  const m = cityMeta[id];
  if (m.mapData && BUILD_PENDING) return { map: { image: m.mapData.img, pdf: '', w: m.mapData.w, h: m.mapData.h } };
  return m.map && m.map.image ? { map: m.map } : {};
}

/* ══════════ افزودن گروهی هتل‌ها (نام + کد) ══════════ */
const hotelBulkOpen = {}, hotelBulkText = {};

/* از جدول «هتل‌های نجف اشرف» در نقشه رسمی سازمان حج و زیارت (خرداد ۱۴۰۴) */
const HOTEL_SUGGEST = {
  najaf: `# فهرست هتل‌های نجف اشرف از جدول نقشه رسمی (خرداد ۱۴۰۴) — قبل از افزودن با نقشه تطبیق دهید
# توجه: در خود جدول این کدها تکراری‌اند: ۱۳۸ (اعراف و نبأ)، ۲۰۵ (ثقلین و ضیوف القاسم)، ۲۱۴ (ساحل و سامی)
آندلس 110
ابراج السیاحی 239
ارض السهله 240
ارض القداح 233
ارض المعموره 260
اسطوره 108
اعراف 138
اعیان 206
اغنار 105
الماس 242
ام ابیها 1 211
ام ابیها 2 212
ام القری 136
اوروک 227
اهل الجود 112
ایوان 229
بحر النجف 125
برج المولی 106
بستان 234
بلودان 115
بیان 217
بیت الزائر 201
تبوک 140
ثقلین 205
جار الامیر 102
جنه الفائز 238
جوار 209
جوهره العرب 210
خان الذهب 265
خیام 237
دار الخلیل 128
دله 220
ذوالفقار 142
راهب 113
رقیم 120
ریحانه المصطفی 236
زینه الارض 137
ساحل 214
سامی 214
شفاعه 132
صفین 256
ضیوف القاسم 205
ضیوف الامام 2 127
طوی 250
فاطمیون 135
فصول 253
قائم 255
قصر البوادی 252
قصر الدر 101
قصر الذهبی 251
قصر الشفاعه 223
کراون پالاس 130
کریستال 218
کل الاقمار 208
لولوه البحر 44
لیوان 254
محاسن 203
مدینه البشری 216
مدینه العطاء 139
مضیف الجواد 225
مقام 117
میقات 219
نبأ 138
نبع الصافی 144
نبع الکوثر 118
نجمه النجف 228
نخیل 258
نسیم الفرات 143
نسیم النجف 116
نهرین 122
ورده النجف 224
هلال 15
یاقوت 232`
};

const normHotelName = s => String(s || '').replace(/^هتل\s+/, '').replace(/[\s‌()]+/g, '')
  .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ةۀ]/g, 'ه').replace(/[أإآ]/g, 'ا').replace(/ؤ/g, 'و');

function hotelBulkHTML(cityId) {
  if (!hotelBulkOpen[cityId]) return '';
  return `<div class="bulk">
    <div class="field-label" style="line-height:1.9">هر خط یک هتل: نام و بعد کد (مثلاً: <b>نبع الکوثر 118</b>). خطوطی که با # شروع شوند نادیده گرفته می‌شوند.
      اگر هتلی با همین نام از قبل باشد، فقط کدش به‌روز می‌شود.</div>
    <textarea class="fta" rows="9" dir="rtl" oninput="hotelBulkText['${cityId}']=this.value" placeholder="نبع الکوثر 118&#10;قصر الدر 101">${escH(hotelBulkText[cityId] || '')}</textarea>
    <div class="bulk-row" style="margin-bottom:6px">
      ${HOTEL_SUGGEST[cityId] ? `<button class="add-row-btn" onclick="hotelBulkSuggest('${cityId}')">📋 پر کردن از جدول نقشه رسمی</button>` : ''}
      <button class="add-row-btn" style="background:var(--gold);color:#fff" onclick="hotelBulkApply('${cityId}')">✅ افزودن به فهرست هتل‌ها</button>
    </div>
  </div>`;
}
function toggleHotelBulk(cityId) { hotelBulkOpen[cityId] = !hotelBulkOpen[cityId]; renderHotels(cityId); }
function hotelBulkSuggest(cityId) {
  if ((hotelBulkText[cityId] || '').trim() && !confirm('متن فعلی کادر با فهرست نقشه جایگزین شود؟')) return;
  hotelBulkText[cityId] = HOTEL_SUGGEST[cityId];
  renderHotels(cityId);
}
function hotelBulkApply(cityId) {
  const lines = (hotelBulkText[cityId] || '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  if (!lines.length) { showToast('کادر خالی است'); return; }
  let added = 0, updated = 0;
  lines.forEach(line => {
    const t = toEnA(line);
    const m = t.match(/^(.*?)[\s,،:|\-–]*(\d+)\s*$/);
    const name = (m ? m[1] : t).replace(/[\s,،:|\-–]+$/, '').trim();
    const code = m ? m[2] : '';
    if (!name) return;
    const ex = hotelState[cityId].find(h => normHotelName(h.name) === normHotelName(name));
    if (ex) { if (code && ex.code !== code) { ex.code = code; updated++; } return; }
    hotelState[cityId].push({ id: 'hotel-' + cityId + '-' + Date.now() + '-' + added, name, nameEn: '', code, address: '', imgs: [],
      mapNeshanUrl: '', mapGoogleUrl: '', contacts: [] });
    added++;
  });
  hotelBulkOpen[cityId] = false; hotelBulkText[cityId] = '';
  renderHotels(cityId);
  showToast(`${added} هتل اضافه شد${updated ? ` و کد ${updated} هتل به‌روز شد` : ''} — برای ثبت، «انتشار» را بزنید`);
}
