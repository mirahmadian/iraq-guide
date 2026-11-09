/* ══════════════════════════════════════════
   🧒 گمشده‌ها — پنل ستاد (دسترسی lost)
   ثبت پرونده با عکسی که خانواده داده (روی سرور، مشترک بین همه؛ فقط تصویر کوچک چهره + امضای عددی)،
   «پیدا شد» = پاک شدن فوری، و پاک شدن خودکار بعد از ۱۵ روز. مدیران کاروان در اپ فقط جستجو می‌کنند (mgr-lost.js).
   تشخیص چهره روی همین دستگاه با face.js؛ عکس فرد پیداشده به سرور نمی‌رود.
══════════════════════════════════════════ */
let lostData = null, lostErr = '', lostState = '', lostQuery = null, lostBusy = false;
try { localStorage.removeItem('hamyar-lost-test'); } catch (e) {} /* پرونده‌های آزمایشیِ نسخه‌ی قبل روی دستگاه */

function lostModels() {
  if (lostState === 'ok') return Promise.resolve();
  lostState = 'load'; lostRender();
  return faceReady().then(() => { lostState = 'ok'; lostRender(); }, e => { lostState = 'err:' + e.message; lostRender(); throw e; });
}
function lostList() {
  adminFetch('/admin/lost/list', null, adminAuth()).then(d => { lostData = d; lostErr = ''; lostRender(); }).catch(e => { lostErr = e.message; lostRender(); });
}
async function lostAdd(btn) {
  const v = id => document.getElementById(id).value.trim(), name = v('lostName'), f = document.getElementById('lostFile').files[0];
  if (!name) return showToast('نام فرد را بنویسید');
  if (!f) return showToast('عکس را انتخاب کنید');
  btn.disabled = true; btn.textContent = '⏳ در حال بررسی عکس…';
  try {
    await lostModels();
    const faces = await faceFromFile(f);
    if (!faces.length) throw new Error('در این عکس چهره‌ای پیدا نشد. عکسی واضح‌تر و از روبه‌رو انتخاب کنید.');
    const F = faces[0];
    await adminFetch('/admin/lost/add', { name, info: v('lostInfo'), contact: v('lostContact'), thumb: lostThumb(F.crop), desc: F.desc }, adminAuth());
    showToast(F.px < 90 ? 'ثبت شد، ولی چهره در این عکس کوچک است؛ اگر عکس نزدیک‌تری دارید با «➕ عکس دیگر» اضافه کنید.' : faces.length > 1 ? `${lostFa(faces.length)} چهره در عکس بود؛ بزرگ‌ترین چهره ثبت شد. اگر نفر دیگری منظور بود، عکس را برش بزنید.` : 'پرونده ثبت شد ✅ — مدیران کاروان از همین الان می‌توانند جستجو کنند');
    ['lostName', 'lostInfo', 'lostContact', 'lostFile'].forEach(id => { document.getElementById(id).value = ''; });
    lostList();
  } catch (e) { showToast(e.message); }
  btn.disabled = false; btn.textContent = '➕ ثبت پرونده';
}
async function lostPhoto(inp, id) {
  const f = inp.files[0]; inp.value = ''; if (!f) return;
  showToast('⏳ در حال بررسی عکس…');
  try {
    await lostModels();
    const faces = await faceFromFile(f);
    if (!faces.length) throw new Error('در این عکس چهره‌ای پیدا نشد.');
    const r = await adminFetch('/admin/lost/photo', { id, desc: faces[0].desc }, adminAuth());
    showToast(`عکس اضافه شد ✅ (${lostFa(r.n)} عکس)`); lostList();
  } catch (e) { showToast(e.message); }
}
async function lostDone(id, found) {
  const c = lostData && lostData.cases.find(x => x.id === id); if (!c) return;
  if (!confirm(found ? `«${c.name}» پیدا شد؟ پرونده و عکسش از سرور پاک می‌شود.` : `پرونده‌ی «${c.name}» بدون «پیدا شد» حذف شود؟`)) return;
  try { await adminFetch(found ? '/admin/lost/found' : '/admin/lost/del', { id }, adminAuth()); showToast(found ? 'خدا را شکر 🌱 پرونده بسته شد' : 'حذف شد'); lostQuery = null; lostList(); }
  catch (e) { showToast(e.message); }
}
async function lostFind(inp) {
  const f = inp.files[0]; inp.value = ''; if (!f) return;
  lostBusy = true; lostQuery = null; lostRender();
  try {
    await lostModels();
    const faces = await faceFromFile(f);
    if (!faces.length) throw new Error('در این عکس چهره‌ای پیدا نشد. از نزدیک‌تر و روبه‌رو، در نور کافی عکس بگیرید.');
    lostQuery = { faces: faces.map(x => ({ thumb: lostThumb(x.crop, 110), desc: x.desc, px: x.px })), sel: 0, M: {} };
    await lostPick(0);
  } catch (e) { showToast(e.message); }
  lostBusy = false; lostRender();
}
async function lostPick(i) {
  const q = lostQuery; if (!q) return;
  q.sel = i;
  if (!q.M[i]) { try { q.M[i] = (await adminFetch('/admin/lost/match', { desc: q.faces[i].desc }, adminAuth())).matches; } catch (e) { showToast(e.message); q.M[i] = []; } }
  lostRender();
}
const lostAgo = t => { const h = Math.floor((Date.now() - t) / 36e5); return h < 1 ? 'کمتر از یک ساعت پیش' : h < 24 ? `${lostFa(h)} ساعت پیش` : `${lostFa(Math.floor(h / 24))} روز پیش`; };
function lostResultHTML() {
  if (lostBusy) return '<div class="empty-msg">⏳ در حال پیدا کردن چهره و مقایسه…</div>';
  const q = lostQuery; if (!q) return '';
  const face = q.faces[q.sel], M = q.M[q.sel];
  return `<div class="lost-res">${facePickHTML(q.faces, q.sel, 'lostPick')}<div class="field-label">شبیه‌ترین پرونده‌ها</div>${M ? faceMatchHTML(face, M) : '<div class="empty-msg">⏳</div>'}</div>`;
}
function lostCasesHTML() {
  if (lostErr) return `<div class="mg-err" style="color:#B3261E">${escH(lostErr)} <button class="lock-link" onclick="lostList()">دوباره</button></div>`;
  if (!lostData) return '<div class="empty-msg">⏳ بارگذاری پرونده‌ها…</div>';
  const C = lostData.cases;
  if (!C.length) return `<div class="empty-msg">پرونده‌ی بازی نیست.${lostData.found ? ` تا حالا ${lostFa(lostData.found)} نفر با «پیدا شد» بسته شده‌اند.` : ''}</div>`;
  return `<div class="lost-cases">${C.map(c => `<div class="lost-c">
      <img src="${escH(c.thumb)}" alt="">
      <div class="lost-ct"><b>${escH(c.name)}</b>${c.info ? `<small>${escH(c.info)}</small>` : ''}${c.contact ? `<small>📞 ${escH(c.contact)}</small>` : ''}
        <small class="dim">${escH(c.by || '')} · ${lostAgo(c.created)} · ${lostFa(c.n)} عکس · ${c.left <= 2 ? '<b style="color:#B3261E">' : ''}${lostFa(c.left)} روز تا پاک شدن${c.left <= 2 ? '</b>' : ''}${c.hits ? ` · ${lostFa(c.hits)} بار شبیه‌ترین نتیجه` : ''}</small>
        <div class="lost-cb"><button class="pub-btn" onclick="lostDone('${c.id}',1)">✅ پیدا شد</button>
          ${c.n < 3 ? `<label class="lock-link">➕ عکس دیگر<input type="file" accept="image/*" hidden onchange="lostPhoto(this,'${c.id}')"></label>` : ''}
          <button class="lock-link" style="color:#B3261E" onclick="lostDone('${c.id}',0)">🗑 حذف</button></div></div></div>`).join('')}</div>`;
}
function lostRender() {
  const el = document.getElementById('lost-admin'); if (!el) return;
  const st = lostState === 'load' ? '<div class="lost-st">⏳ بارگذاری مدل تشخیص چهره (حدود ۱۲ مگ؛ فقط بار اول)…</div>'
    : lostState.startsWith('err:') ? `<div class="lost-st err">❌ ${escH(lostState.slice(4))} <button class="lock-link" onclick="lostModels()">دوباره</button></div>`
    : lostState === 'ok' ? '<div class="lost-st ok">✅ مدل تشخیص چهره آماده است.</div>' : '';
  const n = lostData ? lostData.cases.length : 0;
  el.innerHTML = `
  <div class="lost-test">🔒 پرونده‌ها روی سرور و <b>مشترک بین ستاد و مدیران کاروان</b> است. مدیران فقط می‌توانند با عکس <b>جستجو</b> کنند و فقط ۳ نتیجه‌ی شبیه‌تر را می‌بینند، نه فهرست کامل. هر پرونده با «پیدا شد» یا بعد از <b>${lostFa(lostData ? lostData.days : 15)} روز</b> خودکار پاک می‌شود. اگر مدیری شباهت زیاد پیدا کند، فوراً در بله خبر می‌رسد.</div>
  ${st}
  <div class="mga-box"><div class="field-label">۱. ثبت پرونده — عکسی که خانواده به ستاد داده</div>
    <div class="mga-form"><input id="lostName" class="input-full" placeholder="نام و نام خانوادگی" maxlength="80">
      <input id="lostInfo" class="input-full" placeholder="مشخصات: سن، کاروان، لباس، کجا گم شد…" maxlength="200">
      <input id="lostContact" class="input-full" placeholder="شماره‌ی تماس (خانواده یا ستاد) — به مدیرِ پیداکننده نشان داده می‌شود" maxlength="80">
      <input id="lostFile" type="file" accept="image/*" class="input-full"></div>
    <button class="pub-btn" style="margin-top:8px" onclick="lostAdd(this)">➕ ثبت پرونده</button>
    <div class="empty-msg" style="padding:6px 0 0">عکس روشن و از روبه‌رو بهتر است. بعد از ثبت، با «➕ عکس دیگر» تا ۳ عکس برای هر نفر بگذارید تا دقت بیشتر شود.</div></div>
  <div class="mga-box"><div class="field-label">پرونده‌های باز (${lostFa(n)})</div>${lostCasesHTML()}</div>
  <div class="mga-box"><div class="field-label">۲. 📷 پیدا کردم — عکس فردی که پیدا شده</div>
    <div class="lost-btns"><label class="pub-btn">📷 گرفتن عکس<input type="file" accept="image/*" capture="environment" onchange="lostFind(this)" hidden></label>
      <label class="lock-link lost-gal">🖼 انتخاب از گالری<input type="file" accept="image/*" onchange="lostFind(this)" hidden></label></div>
    ${lostResultHTML()}</div>
  <details class="gd-det"><summary>❓ این ابزار چطور کار می‌کند؟</summary><div style="padding:8px 0;line-height:2">
    مدل متن‌باز و رایگان <b>face-api</b> روی همین گوشی یا کامپیوتر، چهره را در عکس پیدا می‌کند و از آن ۱۲۸ عدد می‌سازد (امضای چهره). روی سرور فقط <b>تصویر کوچک چهره و همین اعداد</b> نگه داشته می‌شود؛ عکس فرد پیداشده اصلاً به سرور نمی‌رود و فقط اعدادش مقایسه می‌شود.
    در آزمون روی ۱۱۰۰ جفت عکس استاندارد، درستی حدود ٪۹۹ بود و «شباهت زیاد» برای هیچ دو نفرِ متفاوتی پیش نیامد. ولی برای <b>کودکان خردسال، عکس قدیمی، نور کم یا نیم‌رخ</b> دقت پایین‌تر است. پس نتیجه همیشه پیشنهاد است و تصمیم با انسان.
    مدیران کاروان در اپ: «بیشتر ← بخش ویژه‌ی مدیران ← 🧒 پیدا کردن گمشده با عکس».
  </div></details>`;
}
function lostLoad() { lostRender(); lostList(); lostModels().catch(() => {}); }
document.head.insertAdjacentHTML('beforeend', `<style>
  .lost-test{background:#E8F3EC;color:#14532D;border-radius:10px;padding:8px 12px;font-size:13px;line-height:1.9;margin-bottom:10px}
  .lost-st{font-size:13px;margin:4px 0 10px;color:var(--dim,#666)}.lost-st.ok{color:#1E7D4F}.lost-st.err{color:#B3261E}
  .lost-cases{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;margin:8px 0 4px}
  .lost-c{display:flex;gap:10px;border:1px solid var(--border-s);border-radius:12px;padding:8px;background:var(--card)}
  .lost-c img{width:72px;height:72px;border-radius:10px;object-fit:cover;flex:none}
  .lost-ct{min-width:0;line-height:1.7;font-size:13.5px}.lost-ct small{display:block;font-size:12px}.lost-ct small.dim{color:var(--dim,#888)}
  .lost-cb{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:4px}.lost-cb .pub-btn{padding:4px 12px;font-size:12.5px}.lost-cb label{cursor:pointer}
  .lost-btns{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0}.lost-btns label{cursor:pointer;display:inline-flex;align-items:center}
  .lost-res{margin-top:10px}
</style>`);
