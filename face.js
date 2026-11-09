/* ══════════════════════════════════════════
   🧒 تشخیص چهره‌ی گمشده‌ها — مشترک بین پنل ستاد (admin-lost.js) و بخش مدیران اپ (mgr-lost.js)
   مدل متن‌باز face-api (vladmandic) روی خود دستگاه: پیدا کردن چهره (SSD MobileNet) + «امضای چهره» ۱۲۸ عددی (FaceRecognitionNet)
   در آزمون، face-api از faceres ،faceres-deep و mobilefacenet کتابخانه‌ی Human دقیق‌تر بود؛ ترکیب دو مدل هم بدتر شد.
   خودِ عکس فرد پیداشده هرگز به سرور نمی‌رود؛ فقط امضای عددی برای مقایسه.
   مرزهای شباهت باید با worker/lostcase.js یکی باشد.
══════════════════════════════════════════ */
const LOST_LIB = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js';
const LOST_MODEL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
const lostFa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
/* بارگذاری کتابخانه و مدل‌ها (یک بار؛ حدود ۱۲ مگ، بعد از بار اول از حافظه‌ی مرورگر) */
let faceReadyP = null;
function faceReady() {
  if (faceReadyP) return faceReadyP;
  faceReadyP = (async () => {
    if (!window.faceapi) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = LOST_LIB; s.onload = ok; s.onerror = () => no(new Error('بارگذاری کتابخانه‌ی تشخیص چهره ممکن نشد (اینترنت؟)')); document.head.appendChild(s); });
    /* گوشی‌هایی که WebGL ندارند: موتور WASM، و در بدترین حالت CPU */
    try { faceapi.tf.setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/'); } catch (e) {}
    let okB = false;
    for (const b of ['webgl', 'wasm', 'cpu']) { try { if (await faceapi.tf.setBackend(b)) { await faceapi.tf.ready(); okB = true; break; } } catch (e) {} }
    if (!okB) throw new Error('این مرورگر از اجرای مدل پشتیبانی نمی‌کند؛ کروم را به‌روز کنید.');
    await Promise.all([faceapi.nets.ssdMobilenetv1.loadFromUri(LOST_MODEL), faceapi.nets.faceLandmark68Net.loadFromUri(LOST_MODEL), faceapi.nets.faceRecognitionNet.loadFromUri(LOST_MODEL)]);
    await faceapi.tf.ready();
  })().catch(e => { faceReadyP = null; throw e; });
  return faceReadyP;
}
/* عکس (فایل) ← امضای بزرگ‌ترین/همه‌ی چهره‌ها */
async function faceFromFile(file) { await faceReady(); return lostFaces(await lostCanvas(file)); }
/* عکس ← بوم با حداکثر ۱۰۲۴ پیکسل (سریع‌تر، و چرخش عکس گوشی را مرورگر درست می‌کند) */
async function lostCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('این فایل عکس قابل خواندن نیست.')); i.src = url; });
    const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    c.src = img; c.k = k;
    return c;
  } finally { URL.revokeObjectURL(url); }
}
/* دقت بیشتر (آزمون روی ۱۱۰۰ جفت عکس استاندارد LFW: درستی ٪۹۴٫۷ ← ٪۹۸):
   ۱. اگر چهره پیدا نشد، دور عکس حاشیه می‌گذاریم و با حساسیت بیشتر دوباره می‌گردیم (چهره‌های نزدیک و بریده)
   ۲. هر چهره از عکس اصلیِ با کیفیت کامل، با حاشیه، در اندازه‌ی ثابت بریده می‌شود و «امضا» از همان ساخته می‌شود
   ۳. امضای عکس و قرینه‌ی آینه‌ای‌اش میانگین گرفته می‌شود و طولش ۱ می‌شود (شباهت کسینوسی) */
const LOST_V = 2, LOST_CROP = 320;
const lostDet = (c, mc) => faceapi.detectAllFaces(c, new faceapi.SsdMobilenetv1Options({ minConfidence: mc }));
function lostPad(c, k) {
  const p = Math.round(Math.max(c.width, c.height) * k), o = document.createElement('canvas'), x = o.getContext('2d');
  o.width = c.width + 2 * p; o.height = c.height + 2 * p; x.fillStyle = '#808080'; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, p, p);
  return { c: o, p };
}
/* برش مربعی دور چهره با ۴۰٪ حاشیه از عکس اصلی (نه نسخه‌ی کوچک‌شده)؛ بیرون از عکس خاکستری */
function lostCrop(canvas, box, size = LOST_CROP, flip) {
  const src = canvas.src || canvas, k = canvas.k || 1, side = Math.max(box.width, box.height) * 1.8 / k;
  const cx = (box.x + box.width / 2) / k, cy = (box.y + box.height / 2) / k, t = document.createElement('canvas'), x = t.getContext('2d');
  t.width = t.height = size; x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
  if (flip) { x.translate(size, 0); x.scale(-1, 1); }
  x.drawImage(src, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size);
  return t;
}
async function lostDesc(crop) {
  let r = await faceapi.detectAllFaces(crop, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 })).withFaceLandmarks().withFaceDescriptors();
  if (!r.length) { const { c } = lostPad(crop, 0.3); r = await faceapi.detectAllFaces(c, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.1 })).withFaceLandmarks().withFaceDescriptors(); }
  if (!r.length) return null;
  const m = r.reduce((a, b) => Math.abs(a.detection.box.x + a.detection.box.width / 2 - crop.width / 2) <= Math.abs(b.detection.box.x + b.detection.box.width / 2 - crop.width / 2) ? a : b);
  return Array.from(m.descriptor);
}
const lostNorm = v => { const n = Math.hypot(...v) || 1; return v.map(x => Math.round(x / n * 1e4) / 1e4); };
async function lostSig(canvas, box) {
  const crop = lostCrop(canvas, box), a = await lostDesc(crop); if (!a) return null;
  const b = await lostDesc(lostCrop(canvas, box, LOST_CROP, true));
  return { desc: lostNorm(b ? a.map((v, i) => v + b[i]) : a), crop };
}
async function lostFaces(canvas) {
  let r = await lostDet(canvas, 0.4), off = 0;
  if (!r.length) r = await lostDet(canvas, 0.25);
  if (!r.length) { const P = lostPad(canvas, 0.3); r = await lostDet(P.c, 0.15); off = P.p; }
  const out = [];
  for (const d of r.sort((a, b) => b.box.area - a.box.area).slice(0, 6)) {
    const bx = d.box, box = { x: bx.x - off, y: bx.y - off, width: bx.width, height: bx.height };
    const s = await lostSig(canvas, box);
    if (s) out.push({ box, score: d.score, desc: s.desc, crop: s.crop, px: Math.round(box.width / (canvas.k || 1)) });
  }
  return out;
}
/* تصویر کوچک از وسط برش (چهره با کمی حاشیه) */
function lostThumb(crop, size = 140) {
  const t = document.createElement('canvas'), m = crop.width * 0.14; t.width = t.height = size;
  t.getContext('2d').drawImage(crop, m, m, crop.width - 2 * m, crop.width - 2 * m, 0, 0, size, size);
  return t.toDataURL('image/jpeg', 0.82);
}
/* مرزها از آزمون ۵۵۰ جفت عکس LFW با همین کد: از ۰٫۹۳۵ به بالا هیچ دو نفرِ متفاوتی نرسید (۹۰٪ جفت‌های یکسان رسیدند)؛
   از ۰٫۹۱ به بالا ۹۸٪ جفت‌های یکسان و حدود ۲٪ غریبه‌ها. نیمه‌ی غریبه‌ها زیر ۰٫۸۴ بودند. */
const LOST_HI = 0.935, LOST_MID = 0.91, LOST_LOW = 0.80;
const lostPct = s => Math.max(1, Math.min(99, Math.round(s >= LOST_HI ? 90 + (s - LOST_HI) / (0.98 - LOST_HI) * 9 : s >= LOST_MID ? 60 + (s - LOST_MID) / (LOST_HI - LOST_MID) * 30 : 60 * Math.max(0, s - LOST_LOW) / (LOST_MID - LOST_LOW))));
const lostLevel = s => s >= LOST_HI ? ['زیاد', 'hi'] : s >= LOST_MID ? ['احتمالی', 'mid'] : ['کم', 'lo'];
const lostImg = crop => { const t = document.createElement('canvas'); t.width = t.height = 224; t.getContext('2d').drawImage(crop, 0, 0, 224, 224); return t.toDataURL('image/jpeg', 0.85); };

/* کارت نتیجه (مشترک): عکس فرد پیداشده ⟷ تصویر پرونده، سطح شباهت، مشخصات و تماس */
const fmEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmTel = s => { const d = String(s || '').replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[^\d+]/g, ''); return d.length >= 8 ? d : ''; };
/* opt.fam(i, m) ← HTML بخش «فرستادن برای خانواده» (فقط اپ مدیران) */
function faceMatchHTML(face, M, opt = {}) {
  if (!M.length) return '<div class="fm-note">هنوز هیچ پرونده‌ی گمشده‌ای ثبت نشده است.</div>';
  return `${M.map((m, i) => { const [lv, cls] = lostLevel(m.s), t = fmTel(m.contact); return `<div class="fm-m ${cls}"><img src="${face.thumb}" alt="عکس فرد پیداشده"><span class="fm-vs">⟷</span><img src="${fmEsc(m.thumb)}" alt="عکس پرونده">
      <div class="fm-tx"><b>${i === 0 && cls !== 'lo' ? '🥇 ' : ''}${fmEsc(m.name)}</b>${m.info ? `<div class="fm-info">${fmEsc(m.info)}</div>` : ''}<div class="fm-pct">شباهت ${lv} — حدود ٪${lostFa(lostPct(m.s))}</div>
      ${cls !== 'lo' && m.contact ? `<div class="fm-info">📞 ${t ? `<a href="tel:${t}" dir="ltr">${fmEsc(m.contact)}</a>` : fmEsc(m.contact)}</div>` : ''}${opt.fam && cls === 'hi' ? opt.fam(i, m) : ''}</div></div>`; }).join('')}
    ${M[1] && M[0].s >= LOST_MID && M[0].s - M[1].s < 0.01 ? '<div class="fm-note warn">⚠️ دو پرونده‌ی اول خیلی به هم نزدیک‌اند؛ سامانه نمی‌تواند بین آن‌ها تصمیم بگیرد. با هر دو تماس بگیرید یا عکس واضح‌تری بگیرید.</div>' : ''}
    ${face.px < 90 ? '<div class="fm-note warn">📏 چهره در این عکس کوچک است (از دور گرفته شده)؛ برای نتیجه‌ی مطمئن‌تر از نزدیک‌تر عکس بگیرید.</div>' : ''}
    <div class="fm-note">${M[0].s >= LOST_MID ? '⚠️ این فقط پیشنهاد است. قبل از سپردن فرد، با شماره‌ی پرونده تماس بگیرید و هویت را با نشانه‌ها (لباس، نام همراهان، کاروان) تأیید کنید.' : 'هیچ پرونده‌ای شباهت کافی ندارد. شاید خانواده‌ی این نفر هنوز گم شدنش را اعلام نکرده‌اند، یا عکس واضح نیست؛ یک عکس دیگر از روبه‌رو و از نزدیک بگیرید.'}</div>`;
}
function facePickHTML(faces, sel, fn) {
  return faces.length > 1 ? `<div class="fm-lbl">در عکس ${lostFa(faces.length)} چهره بود؛ کدام نفر؟</div><div class="fm-pick">${faces.map((x, i) => `<button class="${i === sel ? 'on' : ''}" onclick="${fn}(${i})"><img src="${x.thumb}" alt=""></button>`).join('')}</div>` : '';
}
document.head.insertAdjacentHTML('beforeend', `<style>
  .fm-lbl{font-size:13px;font-weight:700;margin:8px 0 4px}
  .fm-pick{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
  .fm-pick button{border:2px solid transparent;border-radius:10px;padding:0;background:none;cursor:pointer}.fm-pick button.on{border-color:#1E7D4F}
  .fm-pick img{width:56px;height:56px;border-radius:8px;display:block}
  .fm-m{display:flex;align-items:center;gap:8px;border:1px solid var(--border-s,#ddd);border-radius:12px;padding:8px;margin:6px 0;background:var(--card,#fff)}
  .fm-m img{width:64px;height:64px;border-radius:10px;object-fit:cover;flex:none}.fm-vs{color:#888}
  .fm-tx{min-width:0;line-height:1.7}.fm-info{font-size:12.5px;color:var(--muted,#666)}.fm-info a{color:#0E5A44;font-weight:800}
  .fm-m.hi{border-color:#1E7D4F;background:#1E7D4F14}.fm-m.mid{border-color:#B25B12}.fm-m.lo{opacity:.7}
  .fm-pct{font-size:13px;font-weight:700}.fm-m.hi .fm-pct{color:#1E7D4F}.fm-m.mid .fm-pct{color:#B25B12}
  .fm-fam{margin-top:6px}.fm-fam button{border:0;border-radius:10px;padding:7px 12px;background:#0E5A44;color:#fff;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
  .fm-fs{font-size:12.5px;font-weight:700;line-height:1.8}.fm-fs.ok{color:#1E7D4F}.fm-fs.no{color:#B3261E}
  .fm-note{font-size:12.5px;line-height:1.9;background:var(--card2,#f6f1e7);color:var(--text,#222);border-radius:10px;padding:8px 10px;margin-top:6px}.fm-note.warn{color:#8A4A10}
</style>`);
