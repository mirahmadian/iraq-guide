/* ══════════════════════════════════════════
   🧒 گمشده‌ها (آزمایشی) — تطبیق چهره‌ی فرد پیداشده با عکس‌هایی که خانواده‌ها داده‌اند
   مدل متن‌باز face-api (vladmandic): پیدا کردن چهره (SSD MobileNet) + «اثر انگشت چهره» ۱۲۸ عددی (FaceRecognitionNet)
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
    await Promise.all([faceapi.nets.ssdMobilenetv1.loadFromUri(LOST_MODEL), faceapi.nets.faceLandmark68Net.loadFromUri(LOST_MODEL), faceapi.nets.faceRecognitionNet.loadFromUri(LOST_MODEL)]);
    await faceapi.tf.ready();
    lostState = 'ok'; lostRender();
  })().catch(e => { lostReady = null; lostState = 'err:' + e.message; lostRender(); throw e; });
  return lostReady;
}
/* عکس ← بوم با حداکثر ۱۰۲۴ پیکسل (سریع‌تر، و چرخش عکس گوشی را مرورگر درست می‌کند) */
async function lostCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('این فایل عکس قابل خواندن نیست.')); i.src = url; });
    const k = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}
async function lostFaces(canvas) {
  const r = await faceapi.detectAllFaces(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })).withFaceLandmarks().withFaceDescriptors();
  return r.map(d => ({ box: d.detection.box, score: d.detection.score, desc: Array.from(d.descriptor, v => Math.round(v * 1e4) / 1e4) }))
    .sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
}
function lostThumb(canvas, box, size = 140) {
  const m = Math.max(box.width, box.height) * 0.35, s = Math.max(box.width, box.height) + m * 2;
  const x = box.x + box.width / 2 - s / 2, y = box.y + box.height / 2 - s / 2, t = document.createElement('canvas');
  t.width = t.height = size; t.getContext('2d').drawImage(canvas, x, y, s, s, 0, 0, size, size);
  return t.toDataURL('image/jpeg', 0.8);
}
/* فاصله‌ی اعداد دو چهره ← درصد شباهت تقریبی (۰٫۳ ≈ ٪۹۵، ۰٫۴۵ ≈ ٪۵۰، ۰٫۶ ≈ ٪۵)
   مرزها سخت‌گیرانه است: در آزمایش، دو نفرِ متفاوتِ هم‌سن و هم‌چهره تا فاصله‌ی ۰٫۵ هم پایین آمدند */
const lostPct = d => Math.max(1, Math.min(99, Math.round(95 - (d - 0.3) * 300)));
const lostLevel = d => d < 0.40 ? ['زیاد', 'hi'] : d < 0.48 ? ['احتمالی', 'mid'] : ['کم', 'lo'];

async function lostAdd(btn) {
  const name = document.getElementById('lostName').value.trim(), f = document.getElementById('lostFile').files[0];
  if (!name) return showToast('نام یا مشخصات فرد را بنویسید');
  if (!f) return showToast('عکس را انتخاب کنید');
  btn.disabled = true; btn.textContent = '⏳ در حال بررسی…';
  try {
    await lostModels();
    const c = await lostCanvas(f), faces = await lostFaces(c);
    if (!faces.length) throw new Error('در این عکس چهره‌ای پیدا نشد. عکسی واضح‌تر و از روبه‌رو انتخاب کنید.');
    lostCases.push({ id: Date.now().toString(36), name: name.slice(0, 80), thumb: lostThumb(c, faces[0].box), desc: faces[0].desc, t: Date.now() });
    if (!lostSave()) lostCases.pop();
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
    lostQuery = { faces: faces.slice(0, 6).map(x => ({ thumb: lostThumb(c, x.box, 110), desc: x.desc })), sel: 0 };
  } catch (e) { showToast(e.message); }
  lostBusy = false; lostRender();
}
function lostMatches(desc) {
  const best = new Map();
  for (const c of lostCases) {
    const d = faceapi.euclideanDistance(desc, c.desc), b = best.get(c.name);
    if (!b || d < b.d) best.set(c.name, { name: c.name, thumb: c.thumb, d, n: (b ? b.n : 0) + 1 }); else b.n++;
  }
  return [...best.values()].sort((a, b) => a.d - b.d).slice(0, 3);
}
function lostResultHTML() {
  if (lostBusy) return '<div class="empty-msg">⏳ در حال پیدا کردن چهره و مقایسه…</div>';
  if (!lostQuery) return '';
  const q = lostQuery, face = q.faces[q.sel], M = lostMatches(face.desc);
  return `<div class="lost-res">
    ${q.faces.length > 1 ? `<div class="field-label">در عکس ${lostFa(q.faces.length)} چهره بود؛ کدام نفر؟</div><div class="lost-pick">${q.faces.map((x, i) => `<button class="${i === q.sel ? 'on' : ''}" onclick="lostQuery.sel=${i};lostRender()"><img src="${x.thumb}" alt=""></button>`).join('')}</div>` : ''}
    <div class="field-label">شبیه‌ترین پرونده‌ها</div>
    ${M.map((m, i) => { const [lv, cls] = lostLevel(m.d); return `<div class="lost-m ${cls}"><img src="${face.thumb}" alt="عکس فرد پیداشده"><span class="lost-vs">⟷</span><img src="${m.thumb}" alt="عکس پرونده">
      <div><b>${i + 1 === 1 ? '🥇 ' : ''}${escH(m.name)}</b><div class="lost-pct">شباهت ${lv} — حدود ٪${lostFa(lostPct(m.d))}</div><div class="lost-d">فاصله ${lostFa(m.d.toFixed(2))}${m.n > 1 ? ` · ${lostFa(m.n)} عکس` : ''}</div></div></div>`; }).join('')}
    ${M[1] && M[0].d < 0.48 && M[1].d - M[0].d < 0.05 ? '<div class="lost-note" style="color:#8A4A10">⚠️ دو پرونده‌ی اول خیلی به هم نزدیک‌اند؛ سامانه نمی‌تواند بین آن‌ها تصمیم بگیرد. با هر دو خانواده تماس بگیرید یا عکس واضح‌تری بگیرید.</div>' : ''}
    <div class="lost-note">${M[0] && M[0].d < 0.48 ? '⚠️ این فقط پیشنهاد است. قبل از هر اقدامی، با خانواده‌ی این پرونده تماس بگیرید و هویت را با پرسیدن نشانه‌ها (لباس، نام همراهان، کاروان) تأیید کنید.' : 'هیچ پرونده‌ای شباهت کافی ندارد. شاید خانواده‌ی این نفر هنوز گم شدنش را اعلام نکرده‌اند، یا عکس واضح نیست؛ یک عکس دیگر از روبه‌رو بگیرید.'}</div></div>`;
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
    ${lostCases.length ? `<div class="lost-cases">${lostCases.map(c => `<div><img src="${c.thumb}" alt=""><span>${escH(c.name)}</span><button onclick="lostDel('${c.id}')" title="پاک کردن">✕</button></div>`).join('')}</div>
      <button class="lock-link" style="color:#B3261E" onclick="lostClear()">🗑 پاک کردن همه‌ی پرونده‌های آزمایشی</button>` : ''}</div>
  <div class="mga-box"><div class="field-label">۲. 📷 پیدا کردم — عکس فردی که پیدا شده</div>
    <div class="lost-btns"><label class="pub-btn">📷 گرفتن عکس<input type="file" accept="image/*" capture="environment" onchange="lostFind(this)" hidden></label>
      <label class="lock-link lost-gal">🖼 انتخاب از گالری<input type="file" accept="image/*" onchange="lostFind(this)" hidden></label></div>
    ${lostResultHTML()}</div>
  <details class="gd-det"><summary>❓ این آزمایش چطور کار می‌کند؟</summary><div style="padding:8px 0;line-height:2">
    مدل متن‌باز و رایگان <b>face-api</b> روی همین گوشی یا کامپیوتر، چهره را در عکس پیدا می‌کند و از آن ۱۲۸ عدد می‌سازد (مثل امضای چهره). عکس فرد پیداشده با عکس همه‌ی پرونده‌ها مقایسه می‌شود و سه نفرِ شبیه‌تر با درصد تقریبی نمایش داده می‌شوند.
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
