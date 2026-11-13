/* ══════════════════════════════════════════
   🧒 گمشده‌ها — پنل ستاد (دسترسی lost)
   ثبت پرونده با عکسی که خانواده داده (روی سرور، مشترک بین همه؛ فقط تصویر کوچک چهره + امضای عددی)،
   «پیدا شد» = پاک شدن فوری، و پاک شدن خودکار بعد از ۱۵ روز. مدیران کاروان در اپ فقط جستجو می‌کنند (mgr-lost.js).
   تشخیص چهره روی همین دستگاه با face.js؛ عکس فرد پیداشده به سرور نمی‌رود.
══════════════════════════════════════════ */
let lostData = null, lostErr = '', lostState = '', lostQuery = null, lostBusy = false;
try { localStorage.removeItem('hamyar-lost-test'); } catch (e) {} /* پرونده‌های آزمایشیِ نسخه‌ی قبل روی دستگاه */

/* ── پنجره‌ی «سامانه در حال کار است» با ساعت شنی (مثل اپ)؛ اگر خیلی طول کشید یا اینترنت قطع شد: پیام روشن + «دوباره امتحان کنید» ── */
const LW_LIMIT = { tool: 150, face: 60, save: 40, match: 40 };   /* ثانیه */
const LW_T = { tool: ['در حال آماده‌سازی ابزار تشخیص چهره…', 'بار اول حدود ۱۲ مگابایت دانلود می‌شود؛ لطفاً صبر کنید.'],
  face: ['در حال پیدا کردن چهره در عکس…', 'لطفاً صبر کنید و صفحه را نبندید.'], save: ['در حال ثبت پرونده…', 'لطفاً صبر کنید و صفحه را نبندید.'],
  match: ['در حال جستجو و مقایسه با پرونده‌ها…', 'لطفاً صبر کنید و صفحه را نبندید.'] };
function lostWait(stage) {
  let w = document.getElementById('lw');
  if (!w) {
    document.body.insertAdjacentHTML('beforeend', `<div id="lw" class="lw" role="alertdialog" aria-modal="true" aria-live="assertive" aria-labelledby="lw-t"><div class="lw-box">
      <div class="lw-ic" aria-hidden="true">⏳</div><div class="lw-t" id="lw-t"></div><div class="lw-s"></div><div class="lw-bar"><i></i></div><div class="lw-time"></div><div class="lw-act"></div></div></div>`);
    w = document.getElementById('lw');
  }
  w.className = 'lw'; w.querySelector('.lw-ic').textContent = '⏳';
  w.querySelector('.lw-t').textContent = LW_T[stage][0]; w.querySelector('.lw-s').textContent = LW_T[stage][1]; w.querySelector('.lw-act').innerHTML = '';
  const t0 = Date.now(); clearInterval(lostWait.iv);
  const tick = () => { const sec = Math.floor((Date.now() - t0) / 1000);
    w.querySelector('.lw-time').textContent = sec >= 3 ? `${lostFa(sec)} ثانیه` : '';
    if (sec >= 20) w.querySelector('.lw-s').textContent = navigator.onLine === false ? '⚠️ اینترنت قطع است؛ اتصال را بررسی کنید.' : 'کمی بیشتر از معمول طول کشیده (احتمالاً اینترنت کند است)؛ لطفاً کمی دیگر صبر کنید…'; };
  tick(); lostWait.iv = setInterval(tick, 1000);
}
function lostWaitClose() { clearInterval(lostWait.iv); const w = document.getElementById('lw'); if (w) w.remove(); }
function lostWaitError(title, msg, retry) {
  lostWait('face'); clearInterval(lostWait.iv);
  const w = document.getElementById('lw'); w.className = 'lw err';
  w.querySelector('.lw-ic').textContent = '⚠️'; w.querySelector('.lw-t').textContent = title;
  w.querySelector('.lw-s').textContent = msg; w.querySelector('.lw-time').textContent = '';
  w.querySelector('.lw-act').innerHTML = `${retry ? '<button class="lw-b" id="lw-r">🔁 دوباره امتحان کنید</button>' : ''}<button class="lw-b alt" id="lw-x">بستن</button>`;
  const r = w.querySelector('#lw-r'); if (r) { r.onclick = () => { lostWaitClose(); retry(); }; r.focus(); } else w.querySelector('#lw-x').focus();
  w.querySelector('#lw-x').onclick = lostWaitClose;
}
/* هر مرحله با سقف زمان */
function lostLimit(p, stage) { return Promise.race([p, new Promise((_, no) => setTimeout(() => { const e = new Error('timeout'); e.timeout = stage; no(e); }, LW_LIMIT[stage] * 1000))]); }
function lostErrText(e) {
  if (navigator.onLine === false) return 'اینترنت قطع است. اتصال را بررسی کنید و دوباره امتحان کنید.';
  if (e && e.timeout === 'tool') return 'آماده‌سازی ابزار تشخیص چهره خیلی طول کشید (احتمالاً اینترنت کند یا قطع است). اتصال را بررسی کنید و دوباره امتحان کنید.';
  if (e && e.timeout) return 'کار خیلی طول کشید و پاسخی از سامانه نرسید (احتمالاً اینترنت کند یا قطع است). لطفاً دوباره امتحان کنید.';
  return (e && e.message) || 'خطای ناشناخته';
}
/* ── بزرگ‌نمایی عکس (مثل عکس نماینده‌ی بیمه در اپ): روی هر عکسِ پرونده یا نتیجه بزنید ── */
function lostZoom(src, cap) {
  let z = document.getElementById('lz');
  if (!z) {
    document.body.insertAdjacentHTML('beforeend', '<div id="lz" class="lz" role="dialog" aria-modal="true" aria-label="نمایش بزرگ عکس" onclick="lostZoomClose()"><img alt=""><div class="lz-cap"></div><button class="lz-x" aria-label="بستن">✕ بستن</button></div>');
    z = document.getElementById('lz');
    document.addEventListener('keydown', e => { if (e.key === 'Escape') lostZoomClose(); });
  }
  z.querySelector('img').src = src; z.querySelector('.lz-cap').textContent = cap || ''; z.classList.add('open'); z.querySelector('.lz-x').focus();
}
function lostZoomClose() { const z = document.getElementById('lz'); if (z) z.classList.remove('open'); }
document.addEventListener('click', e => {
  const im = e.target.closest('#lost-admin img'); if (!im || im.closest('button')) return;   /* عکس‌های «کدام نفر؟» دکمه‌ی انتخاب‌اند */
  const card = im.closest('.lost-c, .fm-m'), cap = card ? (card.querySelector('b') || {}).textContent || '' : '';
  lostZoom(im.src, im.alt && im.alt.startsWith('عکس فرد پیداشده') ? 'عکس فرد پیداشده' : cap);
});

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
    if (lostState !== 'ok') { lostWait('tool'); await lostLimit(lostModels(), 'tool'); }
    lostWait('face');
    const faces = await lostLimit(faceFromFile(f), 'face');
    if (!faces.length) { lostWaitClose(); throw new Error('در این عکس چهره‌ای پیدا نشد. عکسی واضح‌تر و از روبه‌رو انتخاب کنید.'); }
    const F = faces[0];
    lostWait('save');
    await lostLimit(adminFetch('/admin/lost/add', { name, info: v('lostInfo'), contact: v('lostContact'), thumb: lostThumb(F.crop, 300), desc: F.desc }, adminAuth()), 'save');
    lostWaitClose();
    showToast(F.px < 90 ? 'ثبت شد، ولی چهره در این عکس کوچک است؛ اگر عکس نزدیک‌تری دارید با «➕ عکس دیگر» اضافه کنید.' : faces.length > 1 ? `${lostFa(faces.length)} چهره در عکس بود؛ بزرگ‌ترین چهره ثبت شد. اگر نفر دیگری منظور بود، عکس را برش بزنید.` : 'پرونده ثبت شد ✅ حالا «کپی لینک بله» را بزنید و برای خانواده بفرستید');
    ['lostName', 'lostInfo', 'lostContact', 'lostFile'].forEach(id => { document.getElementById(id).value = ''; });
    lostList();
  } catch (e) { if (document.getElementById('lw')) lostWaitError('پرونده ثبت نشد', lostErrText(e), () => lostAdd(btn)); else showToast(e.message); }
  btn.disabled = false; btn.textContent = '➕ ثبت پرونده';
}
async function lostPhoto(inp, id) {
  const f = inp.files[0]; inp.value = ''; if (!f) return;
  try {
    if (lostState !== 'ok') { lostWait('tool'); await lostLimit(lostModels(), 'tool'); }
    lostWait('face');
    const faces = await lostLimit(faceFromFile(f), 'face');
    if (!faces.length) { lostWaitClose(); throw new Error('در این عکس چهره‌ای پیدا نشد.'); }
    lostWait('save');
    const r = await lostLimit(adminFetch('/admin/lost/photo', { id, desc: faces[0].desc }, adminAuth()), 'save');
    lostWaitClose(); showToast(`عکس اضافه شد ✅ (${lostFa(r.n)} عکس)`); lostList();
  } catch (e) { if (document.getElementById('lw')) lostWaitError('عکس اضافه نشد', lostErrText(e), null); else showToast(e.message); }
}
async function lostDone(id, found) {
  const c = lostData && lostData.cases.find(x => x.id === id); if (!c) return;
  if (!confirm(found ? `«${c.name}» پیدا شد؟ پرونده و عکسش از سرور پاک می‌شود.` : `پرونده‌ی «${c.name}» بدون «پیدا شد» حذف شود؟`)) return;
  try { await adminFetch(found ? '/admin/lost/found' : '/admin/lost/del', { id }, adminAuth()); showToast(found ? 'خدا را شکر 🌱 پرونده بسته شد' : 'حذف شد'); lostQuery = null; lostList(); }
  catch (e) { showToast(e.message); }
}
async function lostFind(inp) {
  const f = inp.files[0]; inp.value = ''; if (!f) return;
  lostFindRun(f);
}
async function lostFindRun(f) {
  lostBusy = true; lostQuery = null; lostRender();
  try {
    if (lostState !== 'ok') { lostWait('tool'); await lostLimit(lostModels(), 'tool'); }
    lostWait('face');
    const faces = await lostLimit(faceFromFile(f), 'face');
    if (!faces.length) { lostWaitClose(); throw new Error('در این عکس چهره‌ای پیدا نشد. از نزدیک‌تر و روبه‌رو، در نور کافی عکس بگیرید.'); }
    lostQuery = { faces: faces.map(x => ({ thumb: lostThumb(x.crop, 220), desc: x.desc, px: x.px })), sel: 0, M: {} };
    await lostPick(0, true);
    lostWaitClose();
  } catch (e) { if (document.getElementById('lw')) lostWaitError('جستجو انجام نشد', lostErrText(e), () => lostFindRun(f)); else showToast(e.message); }
  lostBusy = false; lostRender();
}
async function lostPick(i, inRun) {
  const q = lostQuery; if (!q) return;
  q.sel = i;
  if (!q.M[i]) {
    lostWait('match');
    try { q.M[i] = (await lostLimit(adminFetch('/admin/lost/match', { desc: q.faces[i].desc }, adminAuth()), 'match')).matches; if (!inRun) lostWaitClose(); }
    catch (e) { if (inRun) throw e; lostWaitError('جستجو انجام نشد', lostErrText(e), () => lostPick(i)); }
  }
  lostRender();
}
function lostCopy(link) {
  const t = `برای اینکه اگر عزیزتان پیدا شد عکسش برای تأیید به شما برسد، این لینک را در بله باز کنید و «شروع» را بزنید:\n${link}`;
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => showToast('متن و لینک کپی شد ✅ برای خانواده بفرستید'), () => prompt('این متن را کپی کنید:', t));
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
        ${c.fam ? '<small style="color:#1E7D4F">👪 خانواده در بله وصل است؛ اگر مدیری شباهت زیاد پیدا کند، می‌تواند عکس را برای تأیید بفرستد.</small>' : c.link ? `<small>👪 خانواده هنوز در بله وصل نیست. <button class="lock-link" onclick="lostCopy('${escH(c.link)}')">📋 کپی لینک بله برای خانواده</button></small>` : ''}
        ${c.last ? `<small>${c.last.ans === 'y' ? '✅ خانواده عکس را تأیید کرد' : c.last.ans === 'n' ? '❌ خانواده گفت او نیست' : c.last.ans === 'x' ? '⌛ خانواده جواب نداد' : '⏳ عکس برای خانواده فرستاده شده، منتظر جواب'} (${escH(c.last.mgr_name || 'مدیر')} · ${lostAgo(c.last.created)})</small>` : ''}
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
  <div class="lost-test">🔒 پرونده‌ها روی سرور و <b>مشترک بین ستاد و مدیران کاروان</b> است. مدیران فقط می‌توانند با عکس <b>جستجو</b> کنند و فقط ۳ نتیجه‌ی شبیه‌تر را می‌بینند، نه فهرست کامل. هر پرونده با «پیدا شد» یا بعد از <b>${lostFa(lostData ? lostData.days : 15)} روز</b> خودکار پاک می‌شود. اگر مدیری شباهت زیاد پیدا کند، فوراً در بله خبر می‌رسد. <b>لینک بله‌ی هر پرونده</b> را برای خانواده بفرستید تا اگر پیدا شد، مدیر بتواند عکس چهره را برای تأیید به خودشان بفرستد.</div>
  ${st}
  <div class="mga-box"><div class="field-label">۱. ثبت پرونده — عکسی که خانواده به ستاد داده</div>
    <div class="mga-form"><input id="lostName" class="input-full" placeholder="نام و نام خانوادگی" maxlength="80">
      <input id="lostInfo" class="input-full" placeholder="مشخصات: سن، کاروان، لباس، کجا گم شد…" maxlength="200">
      <input id="lostContact" class="input-full" placeholder="شماره‌ی تماس (خانواده یا ستاد) — به مدیرِ پیداکننده نشان داده می‌شود" maxlength="80">
      <input id="lostFile" type="file" accept="image/*" class="input-full"></div>
    <button class="pub-btn" style="margin-top:8px" onclick="lostAdd(this)">➕ ثبت پرونده</button>
    <div class="empty-msg" style="padding:6px 0 0">عکس روشن و از روبه‌رو بهتر است. بعد از ثبت، با «➕ عکس دیگر» تا ۳ عکس برای هر نفر بگذارید تا دقت بیشتر شود.</div></div>
  <div class="mga-box"><div class="field-label">پرونده‌های باز (${lostFa(n)}) <small style="font-weight:400;color:var(--dim,#888)">· برای دیدن بزرگ‌تر، روی عکس بزنید</small></div>${lostCasesHTML()}</div>
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
  .lost-c img{width:72px;height:72px;border-radius:10px;object-fit:cover;flex:none;cursor:zoom-in}
  #lost-admin .fm-m img{cursor:zoom-in}
  .lz{position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.88);display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;cursor:zoom-out}
  .lz.open{display:flex}
  .lz img{width:min(92vw,520px);max-height:72vh;aspect-ratio:1;object-fit:contain;border-radius:16px;background:#111}
  .lz-cap{color:#fff;font-weight:800;font-size:17px;text-align:center}
  .lz-x{font:inherit;font-weight:800;border:0;border-radius:12px;padding:10px 22px;background:#fff;color:#222;cursor:pointer}
  .lw{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:16px}
  .lw-box{background:var(--card,#fff);color:var(--text,#222);border-radius:22px;padding:26px 22px 20px;width:min(380px,100%);text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.35)}
  .lw-ic{font-size:64px;line-height:1;display:inline-block;animation:lw-flip 2s ease-in-out infinite}
  .lw.err .lw-ic{animation:none}
  @keyframes lw-flip{0%,40%{transform:rotate(0)}50%,90%{transform:rotate(180deg)}100%{transform:rotate(360deg)}}
  .lw-t{font-size:20px;font-weight:900;margin:14px 0 6px;line-height:1.7}
  .lw-s{font-size:15px;line-height:1.9;color:var(--dim,#555)}
  .lw.err .lw-s{color:var(--text,#222);font-weight:700}
  .lw-bar{height:6px;border-radius:6px;background:var(--card2,#eee);overflow:hidden;margin:14px 0 6px}
  .lw-bar i{display:block;height:100%;width:40%;border-radius:6px;background:#C9A24B;animation:lw-run 1.4s ease-in-out infinite}
  .lw.err .lw-bar{display:none}
  @keyframes lw-run{0%{transform:translateX(160%)}100%{transform:translateX(-260%)}}
  .lw-time{font-size:13px;color:var(--dim,#777);min-height:18px}
  .lw-act{display:flex;flex-direction:column;gap:8px;margin-top:8px}.lw-act:empty{display:none}
  .lw-b{font:inherit;font-size:16px;font-weight:800;border:0;border-radius:14px;padding:13px;background:#C9A24B;color:#fff;cursor:pointer}
  .lw-b.alt{background:transparent;color:var(--text,#222);border:1.5px solid var(--border-s,#ccc)}
  @media (prefers-reduced-motion:reduce){.lw-ic,.lw-bar i{animation:none}}
  .lost-ct{min-width:0;line-height:1.7;font-size:13.5px}.lost-ct small{display:block;font-size:12px}.lost-ct small.dim{color:var(--dim,#888)}
  .lost-cb{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:4px}.lost-cb .pub-btn{padding:4px 12px;font-size:12.5px}.lost-cb label{cursor:pointer}
  .lost-btns{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:6px 0}.lost-btns label{cursor:pointer;display:inline-flex;align-items:center}
  .lost-res{margin-top:10px}
</style>`);
