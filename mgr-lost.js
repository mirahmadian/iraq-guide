/* ══════════════════════════════════════════
   🧒 بخش مدیران کاروان: پیدا کردن گمشده با عکس (فقط جستجو؛ ثبت پرونده با ستاد است)
   عکس روی همین گوشی تحلیل می‌شود (face.js، بار اول حدود ۱۲ مگ) و فقط امضای عددی چهره به سرور می‌رود؛
   سرور فقط ۳ پرونده‌ی شبیه‌تر را برمی‌گرداند. شباهت زیاد ← خبر فوری به ستاد در بله.
══════════════════════════════════════════ */
let mlState = '', mlQ = null, mlBusy = false;
function mlFace() {
  if (typeof faceReady === 'function') return faceReady();
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'face.js'; s.onload = ok; s.onerror = () => no(new Error('بارگذاری ابزار ممکن نشد؛ اینترنت را بررسی کنید.')); document.head.appendChild(s); }).then(() => faceReady());
}
function mgrLostOpen() {
  if (!isMgr()) return openMgr();
  mlQ = null; mlBusy = false;
  openPage('🧒 پیدا کردن گمشده با عکس', '<div id="mlBody"></div>');
  mlRender();
  if (mlState !== 'ok') { mlState = 'load'; mlRender(); mlFace().then(() => { mlState = 'ok'; mlRender(); }, e => { mlState = 'err:' + e.message; mlRender(); }); }
}
async function mlFind(inp) {
  const f = inp.files[0]; inp.value = ''; if (!f) return;
  mlBusy = true; mlQ = null; mlRender();
  try {
    await mlFace(); mlState = 'ok';
    const faces = await faceFromFile(f);
    if (!faces.length) throw new Error('در این عکس چهره‌ای پیدا نشد. از نزدیک‌تر و روبه‌رو، در نور کافی عکس بگیرید.');
    mlQ = { faces: faces.map(x => ({ thumb: lostThumb(x.crop, 110), img: lostImg(x.crop), desc: x.desc, px: x.px })), sel: 0, M: {}, sent: {} };
    await mlPick(0, true);
  } catch (e) {
    if (e.status === 401) { mgrSave(null); showToast('دسترسی بخش مدیران شما فعال نیست.'); mlBusy = false; return openMgr(); }
    showToast(e.message);
  }
  mlBusy = false; mlRender();
}
async function mlPick(i, quiet) {
  if (!mlQ) return;
  mlQ.sel = i;
  if (!mlQ.M[i]) {
    if (!quiet) { mlBusy = true; mlRender(); }
    try { mlQ.M[i] = (await mgrFetch('/mgr/lost/match', { desc: mlQ.faces[i].desc })).matches; }
    catch (e) { if (quiet) throw e; showToast(e.message); }
    finally { if (!quiet) mlBusy = false; }
  }
  mlRender();
}
/* ── تأیید خانواده در بله (فقط شباهت زیاد و فقط اگر خانواده با لینک پرونده در بله وصل شده باشد) ── */
function mlFamHTML(i, m) {
  const st = mlQ.sent[m.id];
  if (st) return `<div class="fm-fam fm-fs ${st.ans === 'y' ? 'ok' : st.ans === 'n' ? 'no' : ''}">${st.ans === 'y' ? '✅ خانواده در بله تأیید کردند که خودش است. شماره‌ی شما برایشان فرستاده شد؛ قبل از تحویل با چند سؤال مطمئن شوید.' : st.ans === 'n' ? '❌ خانواده گفتند او نیست. با ستاد تماس بگیرید.' : st.ans === 'x' ? 'خانواده در ۲۴ ساعت جواب ندادند؛ با شماره‌ی پرونده تماس بگیرید.' : '⏳ عکس برای خانواده فرستاده شد؛ منتظر جواب… (جواب در بله هم برایتان می‌آید)'}</div>`;
  if (!m.fam) return '<div class="fm-info">خانواده‌ی این پرونده در بله وصل نیست؛ با شماره‌ی بالا تماس بگیرید.</div>';
  return `<div class="fm-fam"><button onclick="mlSend(${i})">📤 فرستادن عکس برای خانواده جهت تأیید</button></div>`;
}
async function mlSend(i) {
  const q = mlQ, m = q && q.M[q.sel] && q.M[q.sel][i]; if (!m) return;
  if (!confirm(`فقط برشِ چهره‌ی این فرد، در بله برای خانواده‌ی «${m.name}» فرستاده می‌شود تا بگویند خودش است یا نه.\n\nبفرستم؟`)) return;
  const face = q.faces[q.sel];
  try {
    const r = await mgrFetch('/mgr/lost/send', { id: m.id, desc: face.desc, photo: face.img });
    q.sent[m.id] = { sid: r.sid, ans: '' }; showToast(r.already ? 'عکس قبلاً فرستاده شده؛ منتظر جواب خانواده' : 'برای خانواده فرستاده شد ✅'); mlRender(); mlPoll(m.id);
  } catch (e) { showToast(e.message); }
}
function mlPoll(id, n = 0) {
  const st = mlQ && mlQ.sent[id]; if (!st || st.ans || n > 360 || !document.getElementById('mlBody')) return;
  setTimeout(async () => {
    try { const r = await mgrFetch('/mgr/lost/sent?sid=' + st.sid); if (r.ans) { st.ans = r.ans; mlRender(); return; } } catch (e) {}
    mlPoll(id, n + 1);
  }, 5000);
}
function mlRender() {
  const box = document.getElementById('mlBody'); if (!box) return;
  const st = mlState === 'load' ? '<div class="ml-st">⏳ آماده‌سازی ابزار تشخیص چهره… (بار اول حدود ۱۲ مگ دانلود می‌شود)</div>'
    : mlState.startsWith('err:') ? `<div class="ml-st err">❌ ${escHtml(mlState.slice(4))}</div>` : '';
  const q = mlQ, face = q && q.faces[q.sel];
  box.innerHTML = `<div class="ml-hero">زائری پیدا کرده‌اید که نمی‌تواند خودش را معرفی کند؟ از چهره‌اش عکس بگیرید تا با پرونده‌های گمشده‌ای که خانواده‌ها به ستاد داده‌اند مقایسه شود.</div>
    ${st}
    <label class="lost-btn ml-cam">📷 گرفتن عکس از فرد پیداشده<input type="file" accept="image/*" capture="environment" hidden onchange="mlFind(this)"></label>
    <label class="lost-btn alt ml-cam">🖼 انتخاب عکس از گالری<input type="file" accept="image/*" hidden onchange="mlFind(this)"></label>
    ${mlBusy ? '<div class="ml-st">⏳ در حال پیدا کردن چهره و مقایسه…</div>' : ''}
    ${q && !mlBusy ? `<div class="ml-res">${facePickHTML(q.faces, q.sel, 'mlPick')}<div class="fm-lbl">شبیه‌ترین پرونده‌ها</div>${q.M[q.sel] ? faceMatchHTML(face, q.M[q.sel], { fam: mlFamHTML }) : ''}</div>` : ''}
    <ul class="st-tips"><li>از <b>روبه‌رو، از نزدیک و در نور کافی</b> عکس بگیرید؛ عینک آفتابی و ماسک را اگر ممکن است بردارید.</li>
      <li>خود عکس روی گوشی شما می‌ماند و به سرور نمی‌رود؛ فقط برای مقایسه از آن عدد ساخته می‌شود. تنها استثنا: اگر شباهت «زیاد» بود و خودتان «📤 فرستادن برای خانواده» را زدید، فقط برش چهره برای همان خانواده در بله فرستاده می‌شود و بعد از جواب یا ۲۴ ساعت پاک می‌شود.</li>
      <li>اگر شباهت «زیاد» باشد، ستاد همان لحظه با نام و شماره‌ی شما خبردار می‌شود.</li>
      <li>نتیجه فقط پیشنهاد است؛ قبل از سپردن فرد، با شماره‌ی پرونده تماس بگیرید و هویت را تأیید کنید.</li>
      <li>اگر پرونده‌ای پیدا نشد، با ستاد تماس بگیرید؛ شاید خانواده هنوز گم شدن را اعلام نکرده‌اند.</li></ul>`;
}
document.head.insertAdjacentHTML('beforeend', `<style>
  .ml-hero{background:var(--card2,#f6f1e7);border-radius:14px;padding:12px 14px;line-height:2;font-size:calc(14px * var(--fs,1));margin-bottom:12px}
  .ml-cam{display:flex;align-items:center;justify-content:center;text-align:center;cursor:pointer;margin-bottom:8px}
  .ml-st{font-size:calc(13.5px * var(--fs,1));margin:8px 0;color:var(--muted,#666);line-height:1.9}.ml-st.err{color:#B3261E}
  .ml-res{margin:10px 0}
</style>`);
