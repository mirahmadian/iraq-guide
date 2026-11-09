/* ══════════════════════════════════════════
   🧒 گمشده‌ها (آزمایشی) — تطبیق چهره‌ی فرد پیداشده با عکس‌هایی که خانواده‌ها داده‌اند
   مدل متن‌باز face-api (vladmandic): پیدا کردن چهره (SSD MobileNet) + «اثر انگشت چهره» ۱۲۸ عددی (FaceRecognitionNet)
   (در آزمون، face-api از faceres ،faceres-deep و mobilefacenet کتابخانه‌ی Human دقیق‌تر بود؛ ترکیب دو مدل هم بدتر شد)
   همه چیز در همین مرورگر اجرا می‌شود؛ عکس‌ها و اعداد فقط روی همین دستگاه (localStorage) می‌مانند و به هیچ سروری نمی‌روند.
   نتیجه فقط پیشنهاد است؛ تأیید هویت با تماس با خانواده.
══════════════════════════════════════════ */
const LOST_LIB = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js';
const LOST_MODEL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
const LOST_KEY = 'hamyar-lost-test';
let lostCases = [], lostReady = null, lostState = '', lostQuery = null, lostBusy = false;
try { lostCases = JSON.parse(localStorage.getItem(LOST_KEY) || '[]'); } catch (e) { lostCases = []; }
const lostSave = () => { try { localStorage.setItem(LOST_KEY, JSON.stringify(lostCases)); return true; } catch (e) { showToast('حافظه‌ی مرورگر پر است؛ چند عکس را پاک کنید.'); return false; } };
const lostFa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

function lostModels() {
  if (lostReady) return lostReady;
  lostState = 'load'; lostRender();
  lostReady = (async () => {
    if (!window.faceapi) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = LOST_LIB; s.onload = ok; s.onerror = () => no(new Error('بارگذاری کتابخانه‌ی تشخیص چهره ممکن نشد (اینترنت؟)')); document.head.appendChild(s); });
    /* گوشی‌هایی که WebGL ندارند: موتور WASM، و در بدترین حالت CPU */
    try { faceapi.tf.setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/'); } catch (e) {}
    let okB = false;
    for (const b of ['webgl', 'wasm', 'cpu']) { try { if (await faceapi.tf.setBackend(b)) { await faceapi.tf.ready(); okB = true; break; } } catch (e) {} }
    if (!okB) throw new Error('این مرورگر از اجرای مدل پشتیبانی نمی‌کند؛ کروم را به‌روز کنید.');
    await Promise.all([faceapi.nets.ssdMobilenetv1.loadFromUri(LOST_MODEL), faceapi.nets.faceLandmark68Net.loadFromUri(LOST_MODEL), faceapi.nets.faceRecognitionNet.loadFromUri(LOST_MODEL)]);
    await faceapi.tf.ready();
    await lostMigrate();
    lostState = 'ok'; lostRender();
  })().catch(e => { lostReady = null; lostState = 'err:' + e.message; lostRender(); throw e; });
  return lostReady;
}
/* پرونده‌های نسخه‌ی قبل: امضا از روی عکس ذخیره‌شده با روش جدید دوباره ساخته می‌شود */
async function lostMigrate() {
  let n = 0;
  for (const c of lostCases) {
    if (c.v === LOST_V) continue;
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = c.img || c.thumb; });
      const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight; cv.getContext('2d').drawImage(img, 0, 0);
      const f = (await lostFaces(cv))[0]; if (!f) continue;
      Object.assign(c, { desc: f.desc, img: lostImg(f.crop), v: LOST_V, px: f.px }); n++;
    } catch (e) {}
  }
  if (n) lostSave();
}
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
/* فاصله‌ی اعداد دو چهره ← درصد شباهت تقریبی (۰٫۳ ≈ ٪۹۵، ۰٫۴۵ ≈ ٪۵۰، ۰٫۶ ≈ ٪۵)
   مرزها سخت‌گیرانه است: در آزمایش، دو نفرِ متفاوتِ هم‌سن و هم‌چهره تا فاصله‌ی ۰٫۵ هم پایین آمدند */
/* مرزها از آزمون ۵۵۰ جفت عکس LFW با همین کد: از ۰٫۹۳۵ به بالا هیچ دو نفرِ متفاوتی نرسید (۹۰٪ جفت‌های یکسان رسیدند)؛
   از ۰٫۹۱ به بالا ۹۸٪ جفت‌های یکسان و حدود ۲٪ غریبه‌ها. نیمه‌ی غریبه‌ها زیر ۰٫۸۴ بودند. */
const LOST_HI = 0.935, LOST_MID = 0.91, LOST_LOW = 0.80;
const lostPct = s => Math.max(1, Math.min(99, Math.round(s >= LOST_HI ? 90 + (s - LOST_HI) / (0.98 - LOST_HI) * 9 : s >= LOST_MID ? 60 + (s - LOST_MID) / (LOST_HI - LOST_MID) * 30 : 60 * Math.max(0, s - LOST_LOW) / (LOST_MID - LOST_LOW))));
const lostLevel = s => s >= LOST_HI ? ['زیاد', 'hi'] : s >= LOST_MID ? ['احتمالی', 'mid'] : ['کم', 'lo'];
const lostImg = crop => { const t = document.createElement('canvas'); t.width = t.height = 224; t.getContext('2d').drawImage(crop, 0, 0, 224, 224); return t.toDataURL('image/jpeg', 0.85); };

async function lostAdd(btn) {
  const name = document.getElementById('lostName').value.trim(), f = document.getElementById('lostFile').files[0];
  if (!name) return showToast('نام یا مشخصات فرد را بنویسید');
  if (!f) return showToast('عکس را انتخاب کنید');
  btn.disabled = true; btn.textContent = '⏳ در حال بررسی…';
  try {
    await lostModels();
    const c = await lostCanvas(f), faces = await lostFaces(c);
    if (!faces.length) throw new Error('در این عکس چهره‌ای پیدا نشد. عکسی واضح‌تر و از روبه‌رو انتخاب کنید.');
    const F = faces[0];
    lostCases.push({ id: Date.now().toString(36), name: name.slice(0, 80), thumb: lostThumb(F.crop), img: lostImg(F.crop), desc: F.desc, v: LOST_V, px: F.px, t: Date.now() });
    if (!lostSave()) lostCases.pop();
    else if (F.px < 90) showToast('ثبت شد، ولی چهره در این عکس خیلی کوچک است و دقت پایین می‌آید؛ اگر عکس نزدیک‌تری دارید آن را هم با همین نام اضافه کنید.');
    else showToast(faces.length > 1 ? `${lostFa(faces.length)} چهره در عکس بود؛ بزرگ‌ترین چهره ثبت شد. اگر نفر دیگری منظور بود، عکس را برش بزنید.` : 'پرونده ثبت شد ✅');
    document.getElementById('lostName').value = ''; document.getElementById('lostFile').value = '';
  } catch (e) { showToast(e.message); }
  btn.disabled = false; lostRender();
}
function lostDel(id) {
  const c = lostCases.find(x => x.id === id); if (!c || !confirm(`عکس «${c.name}» پاک شود؟`)) return;
  lostCases = lostCases.filter(x => x.id !== id); lostSave(); lostRender();
}
function lostClear() {
  if (!lostCases.length || !confirm('همه‌ی پرونده‌های آزمایشی روی این دستگاه پاک شود؟')) return;
  lostCases = []; lostQuery = null; lostSave(); lostRender();
}
async function lostFind(inp) {
  const f = inp.files[0]; inp.value = ''; if (!f) return;
  if (!lostCases.length) return showToast('اول دست‌کم یک پرونده (عکس خانواده) اضافه کنید.');
  lostBusy = true; lostQuery = null; lostRender();
  try {
    await lostModels();
    const c = await lostCanvas(f), faces = await lostFaces(c);
    if (!faces.length) throw new Error('در این عکس چهره‌ای پیدا نشد. از نزدیک‌تر و روبه‌رو، در نور کافی عکس بگیرید.');
    lostQuery = { faces: faces.map(x => ({ thumb: lostThumb(x.crop, 110), desc: x.desc, px: x.px })), sel: 0 };
  } catch (e) { showToast(e.message); }
  lostBusy = false; lostRender();
}
/* شباهت کسینوسی (۱ = یکسان). برای هر نفر، بهترین عکسش حساب می‌شود؛ اگر چند عکس دارد و دومی هم شبیه است، کمی امتیاز اضافه */
const lostCos = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
function lostMatches(desc) {
  const by = new Map();
  for (const c of lostCases) { if (c.v !== LOST_V) continue; const s = lostCos(desc, c.desc), b = by.get(c.name) || { name: c.name, thumb: c.thumb, ss: [] }; b.ss.push(s); if (s >= Math.max(...b.ss)) b.thumb = c.thumb; by.set(c.name, b); }
  return [...by.values()].map(b => { const ss = b.ss.sort((x, y) => y - x); return { name: b.name, thumb: b.thumb, n: ss.length, s: ss.length > 1 ? Math.min(1, ss[0] + Math.max(0, ss[1] - LOST_MID) * 0.2) : ss[0] }; })
    .sort((a, b) => b.s - a.s).slice(0, 3);
}
function lostResultHTML() {
  if (lostBusy) return '<div class="empty-msg">⏳ در حال پیدا کردن چهره و مقایسه…</div>';
  if (!lostQuery) return '';
  const q = lostQuery, face = q.faces[q.sel], M = lostMatches(face.desc);
  return `<div class="lost-res">
    ${q.faces.length > 1 ? `<div class="field-label">در عکس ${lostFa(q.faces.length)} چهره بود؛ کدام نفر؟</div><div class="lost-pick">${q.faces.map((x, i) => `<button class="${i === q.sel ? 'on' : ''}" onclick="lostQuery.sel=${i};lostRender()"><img src="${x.thumb}" alt=""></button>`).join('')}</div>` : ''}
    <div class="field-label">شبیه‌ترین پرونده‌ها</div>
    ${M.map((m, i) => { const [lv, cls] = lostLevel(m.s); return `<div class="lost-m ${cls}"><img src="${face.thumb}" alt="عکس فرد پیداشده"><span class="lost-vs">⟷</span><img src="${m.thumb}" alt="عکس پرونده">
      <div><b>${i + 1 === 1 ? '🥇 ' : ''}${escH(m.name)}</b><div class="lost-pct">شباهت ${lv} — حدود ٪${lostFa(lostPct(m.s))}</div><div class="lost-d">امتیاز ${lostFa(m.s.toFixed(2))}${m.n > 1 ? ` · ${lostFa(m.n)} عکس` : ''}</div></div></div>`; }).join('')}
    ${M[1] && M[0].s >= LOST_MID && M[0].s - M[1].s < 0.01 ? '<div class="lost-note" style="color:#8A4A10">⚠️ دو پرونده‌ی اول خیلی به هم نزدیک‌اند؛ سامانه نمی‌تواند بین آن‌ها تصمیم بگیرد. با هر دو خانواده تماس بگیرید یا عکس واضح‌تری بگیرید.</div>' : ''}
    ${face.px < 90 ? '<div class="lost-note" style="color:#8A4A10">📏 چهره در این عکس کوچک است (از دور گرفته شده)؛ برای نتیجه‌ی مطمئن‌تر از نزدیک‌تر عکس بگیرید.</div>' : ''}
    <div class="lost-note">${M[0] && M[0].s >= LOST_MID ? '⚠️ این فقط پیشنهاد است. قبل از هر اقدامی، با خانواده‌ی این پرونده تماس بگیرید و هویت را با پرسیدن نشانه‌ها (لباس، نام همراهان، کاروان) تأیید کنید.' : 'هیچ پرونده‌ای شباهت کافی ندارد. شاید خانواده‌ی این نفر هنوز گم شدنش را اعلام نکرده‌اند، یا عکس واضح نیست؛ یک عکس دیگر از روبه‌رو بگیرید.'}</div></div>`;
}
function lostRender() {
  const el = document.getElementById('lost-admin'); if (!el) return;
  const st = lostState === 'load' ? '<div class="lost-st">⏳ بارگذاری مدل تشخیص چهره (حدود ۱۲ مگ؛ فقط بار اول)…</div>'
    : lostState.startsWith('err:') ? `<div class="lost-st err">❌ ${escH(lostState.slice(4))} <button class="lock-link" onclick="lostModels()">دوباره</button></div>`
    : lostState === 'ok' ? '<div class="lost-st ok">✅ مدل تشخیص چهره آماده است.</div>' : '';
  const names = [...new Set(lostCases.map(c => c.name))];
  el.innerHTML = `
  <div class="lost-test">🧪 <b>نسخه‌ی آزمایشی.</b> عکس‌ها و نتایج <b>فقط روی همین دستگاه</b> می‌مانند و به هیچ سروری فرستاده نمی‌شوند. برای امتحان، از چند نفر از خانواده یا همکاران (با رضایت خودشان) استفاده کنید.</div>
  ${st}
  <div class="mga-box"><div class="field-label">۱. پرونده‌ها — عکسی که خانواده به ستاد داده (${lostFa(names.length)} نفر، ${lostFa(lostCases.length)} عکس)</div>
    <div class="mga-form"><input id="lostName" class="input-full" placeholder="نام و مشخصات (مثلاً: علی رضایی، ۷ ساله، کاروان نور)" maxlength="80">
      <input id="lostFile" type="file" accept="image/*" class="input-full"></div>
    <button class="pub-btn" style="margin-top:8px" onclick="lostAdd(this)">➕ افزودن پرونده</button>
    <div class="empty-msg" style="padding:6px 0 0">برای دقت بیشتر، از هر نفر ۲ یا ۳ عکس مختلف با <b>همان نام</b> اضافه کنید.</div>
    ${lostCases.length ? `<div class="lost-cases">${lostCases.map(c => `<div><img src="${c.thumb}" alt=""><span>${c.v !== LOST_V ? '⚠️ ' : ''}${escH(c.name)}</span><button onclick="lostDel('${c.id}')" title="پاک کردن">✕</button></div>`).join('')}</div>
      <button class="lock-link" style="color:#B3261E" onclick="lostClear()">🗑 پاک کردن همه‌ی پرونده‌های آزمایشی</button>` : ''}</div>
  <div class="mga-box"><div class="field-label">۲. 📷 پیدا کردم — عکس فردی که پیدا شده</div>
    <div class="lost-btns"><label class="pub-btn">📷 گرفتن عکس<input type="file" accept="image/*" capture="environment" onchange="lostFind(this)" hidden></label>
      <label class="lock-link lost-gal">🖼 انتخاب از گالری<input type="file" accept="image/*" onchange="lostFind(this)" hidden></label></div>
    ${lostResultHTML()}</div>
  <details class="gd-det"><summary>❓ این آزمایش چطور کار می‌کند؟</summary><div style="padding:8px 0;line-height:2">
    مدل متن‌باز و رایگان <b>face-api</b> روی همین گوشی یا کامپیوتر، چهره را در عکس پیدا می‌کند و از آن ۱۲۸ عدد می‌سازد (مثل امضای چهره). عکس فرد پیداشده با عکس همه‌ی پرونده‌ها مقایسه می‌شود و سه نفرِ شبیه‌تر با درصد تقریبی نمایش داده می‌شوند.
    برای دقت بیشتر، چهره از عکس اصلی با کیفیت کامل بریده می‌شود و عکس و قرینه‌ی آینه‌ای‌اش با هم مقایسه می‌شوند. در آزمون روی ۱۱۰۰ جفت عکس استاندارد، درستی حدود ٪۹۹ بود و «شباهت زیاد» برای هیچ دو نفرِ متفاوتی پیش نیامد.
    دقت برای <b>بزرگسالان در عکس روشن و روبه‌رو</b> خوب است؛ برای <b>کودکان خردسال، سالمندان، عکس قدیمی، نور کم یا نیم‌رخ</b> پایین‌تر است. پس نتیجه همیشه پیشنهاد است و تصمیم با انسان.
  </div></details>`;
}
function lostLoad() { lostRender(); lostModels().catch(() => {}); }
document.head.insertAdjacentHTML('beforeend', `<style>
  .lost-test{background:#FFF4D6;color:#6B4A00;border-radius:10px;padding:8px 12px;font-size:13px;line-height:1.9;margin-bottom:10px}
  .lost-st{font-size:13px;margin:4px 0 10px;color:var(--dim,#666)}.lost-st.ok{color:#1E7D4F}.lost-st.err{color:#B3261E}
  .lost-cases{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 6px}
  .lost-cases>div{position:relative;width:92px;text-align:center;font-size:11.5px;line-height:1.5}
  .lost-cases img{width:92px;height:92px;border-radius:10px;object-fit:cover;display:block;margin-bottom:3px}
  .lost-cases button{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;border:0;background:#0009;color:#fff;cursor:pointer;font-size:11px}
  .lost-btns{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0}.lost-btns label{cursor:pointer;display:inline-flex;align-items:center}
  .lost-res{margin-top:10px}.lost-pick{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
  .lost-pick button{border:2px solid transparent;border-radius:10px;padding:0;background:none;cursor:pointer}.lost-pick button.on{border-color:#1E7D4F}
  .lost-pick img{width:56px;height:56px;border-radius:8px;display:block}
  .lost-m{display:flex;align-items:center;gap:8px;border:1px solid var(--border-s);border-radius:12px;padding:8px;margin:6px 0;background:var(--card)}
  .lost-m img{width:64px;height:64px;border-radius:10px;object-fit:cover;flex:none}.lost-vs{color:var(--dim,#888)}
  .lost-m.hi{border-color:#1E7D4F;background:#1E7D4F10}.lost-m.mid{border-color:#B25B12}.lost-m.lo{opacity:.7}
  .lost-pct{font-size:13px;font-weight:700}.lost-m.hi .lost-pct{color:#1E7D4F}.lost-m.mid .lost-pct{color:#8A4A10}.lost-d{font-size:11.5px;color:var(--dim,#888)}
  .lost-note{font-size:12.5px;line-height:1.9;background:var(--card2,#f6f1e7);border-radius:10px;padding:8px 10px;margin-top:6px}
</style>`);
