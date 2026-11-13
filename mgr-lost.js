/* ══════════════════════════════════════════
   🧒 بخش مدیران کاروان: پیدا کردن گمشده با عکس (فقط جستجو؛ ثبت پرونده با ستاد است)
   عکس روی همین گوشی تحلیل می‌شود (face.js، بار اول حدود ۱۲ مگ) و فقط امضای عددی چهره به سرور می‌رود؛
   سرور فقط ۳ پرونده‌ی شبیه‌تر را برمی‌گرداند. شباهت زیاد ← خبر فوری به ستاد در بله.
══════════════════════════════════════════ */
let mlState = '', mlQ = null, mlBusy = false, mlLast = null, mlRun = 0;
/* ── پنجره‌ی «در حال جستجو» با ساعت شنی، مرحله‌ی کار و زمان؛ اگر خیلی طول کشید یا اینترنت قطع شد، پیام روشن و «دوباره امتحان کنید» ── */
const ML_SLOW = 20, ML_LIMIT = { tool: 150, face: 60, match: 40 };   /* ثانیه */
function mlWait(stage) {
  let w = document.getElementById('ml-wait');
  if (!w) {
    document.body.insertAdjacentHTML('beforeend', `<div id="ml-wait" class="mlw" role="alertdialog" aria-modal="true" aria-live="assertive" aria-labelledby="mlw-t"><div class="mlw-box">
      <div class="mlw-ic" aria-hidden="true">⏳</div><div class="mlw-t" id="mlw-t"></div><div class="mlw-s"></div><div class="mlw-bar"><i></i></div><div class="mlw-time"></div><div class="mlw-act"></div></div></div>`);
    w = document.getElementById('ml-wait');
  }
  const T = { tool: ['در حال آماده‌سازی ابزار تشخیص چهره…', 'بار اول حدود ۱۲ مگابایت دانلود می‌شود؛ لطفاً صبر کنید.'],
    face: ['در حال پیدا کردن چهره در عکس…', 'لطفاً صبر کنید و صفحه را نبندید.'], match: ['در حال جستجو در پرونده‌های گمشده…', 'لطفاً صبر کنید و صفحه را نبندید.'] }[stage];
  w.className = 'mlw'; w.querySelector('.mlw-ic').textContent = '⏳';
  w.querySelector('.mlw-t').textContent = T[0]; w.querySelector('.mlw-s').textContent = T[1]; w.querySelector('.mlw-act').innerHTML = '';
  w.dataset.t0 = Date.now(); w.dataset.stage = stage;
  clearInterval(mlWait.iv);
  const tick = () => { if (!document.getElementById('mlBody')) { mlRun++; mlBusy = false; return mlWaitClose(); }   /* صفحه بسته شد */
    const sec = Math.floor((Date.now() - +w.dataset.t0) / 1000);
    w.querySelector('.mlw-time').textContent = sec >= 3 ? `${sec.toLocaleString('fa-IR')} ثانیه` : '';
    if (sec >= ML_SLOW) w.querySelector('.mlw-s').textContent = navigator.onLine === false ? '⚠️ اینترنت گوشی قطع است؛ اتصال را بررسی کنید.' : 'کمی بیشتر از معمول طول کشیده (احتمالاً اینترنت کند است)؛ لطفاً کمی دیگر صبر کنید…'; };
  tick(); mlWait.iv = setInterval(tick, 1000);
}
function mlWaitClose() { clearInterval(mlWait.iv); const w = document.getElementById('ml-wait'); if (w) w.remove(); }
function mlWaitError(msg, retry) {
  mlWait('face'); clearInterval(mlWait.iv);
  const w = document.getElementById('ml-wait'); w.className = 'mlw err';
  w.querySelector('.mlw-ic').textContent = '⚠️'; w.querySelector('.mlw-t').textContent = 'جستجو انجام نشد';
  w.querySelector('.mlw-s').textContent = msg; w.querySelector('.mlw-time').textContent = '';
  w.querySelector('.mlw-act').innerHTML = `${retry ? '<button class="mlw-b" id="mlw-r">🔁 دوباره امتحان کنید</button>' : ''}<button class="mlw-b alt" id="mlw-x">بستن</button>`;
  const r = w.querySelector('#mlw-r'); if (r) { r.onclick = () => { mlWaitClose(); retry(); }; r.focus(); } else w.querySelector('#mlw-x').focus();
  w.querySelector('#mlw-x').onclick = mlWaitClose;
}
/* هر مرحله با سقف زمان؛ خطاهای شبکه به زبان ساده */
function mlLimit(p, stage) {
  return Promise.race([p, new Promise((_, no) => setTimeout(() => { const e = new Error('timeout'); e.timeout = stage; no(e); }, ML_LIMIT[stage] * 1000))]);
}
function mlErrText(e) {
  if (navigator.onLine === false) return 'اینترنت گوشی قطع است. اتصال را بررسی کنید و دوباره امتحان کنید.';
  if (e && e.timeout === 'tool') return 'آماده‌سازی ابزار خیلی طول کشید (احتمالاً اینترنت کند یا قطع است). اتصال را بررسی کنید و دوباره امتحان کنید.';
  if (e && e.timeout) return 'جستجو خیلی طول کشید و پاسخی از سامانه نرسید (احتمالاً اینترنت کند یا قطع است). لطفاً دوباره امتحان کنید.';
  if (e && (e.name === 'TypeError' || /fetch|network|load failed/i.test(e.message || ''))) return 'ارتباط با سامانه برقرار نشد (اینترنت قطع یا ضعیف است). لطفاً دوباره امتحان کنید.';
  if (e && e.status >= 500) return 'سامانه موقتاً پاسخ نمی‌دهد. چند لحظه بعد دوباره امتحان کنید.';
  return (e && e.message) || 'خطای ناشناخته؛ لطفاً دوباره امتحان کنید.';
}
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
  mlLast = f; return mlSearch(f);
}
async function mlSearch(f) {
  const run = ++mlRun;
  mlBusy = true; mlQ = null; mlRender();
  try {
    if (mlState !== 'ok') { mlWait('tool'); await mlLimit(mlFace(), 'tool'); mlState = 'ok'; }
    if (run !== mlRun) return;
    mlWait('face');
    const faces = await mlLimit(faceFromFile(f), 'face');
    if (!faces.length) { const e = new Error('در این عکس چهره‌ای پیدا نشد. از نزدیک‌تر و روبه‌رو، در نور کافی عکس بگیرید و دوباره امتحان کنید.'); e.noRetry = true; throw e; }
    mlQ = { faces: faces.map(x => ({ thumb: lostThumb(x.crop, 110), img: lostImg(x.crop), desc: x.desc, px: x.px })), sel: 0, M: {}, sent: {} };
    mlWait('match');
    await mlPick(0, true);
    if (run !== mlRun) return;
    mlWaitClose();
  } catch (e) {
    if (run !== mlRun) return;
    if (e.status === 401) { mlWaitClose(); mgrSave(null); showToast('دسترسی بخش مدیران شما فعال نیست.'); mlBusy = false; return openMgr(); }
    mlQ = null; mlWaitError(mlErrText(e), e.noRetry ? null : () => mlSearch(f));
  }
  mlBusy = false; mlRender();
}
async function mlPick(i, quiet) {
  if (!mlQ) return;
  mlQ.sel = i;
  if (!mlQ.M[i]) {
    if (!quiet) { mlBusy = true; mlRender(); mlWait('match'); }
    try { mlQ.M[i] = (await mlLimit(mgrFetch('/mgr/lost/match', { desc: mlQ.faces[i].desc }), 'match')).matches; if (!quiet) mlWaitClose(); }
    catch (e) { if (quiet) throw e; mlWaitError(mlErrText(e), () => mlPick(i)); }
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
  const st = mlState === 'load' ? '<div class="ml-st big">⏳ در حال آماده‌سازی ابزار تشخیص چهره… <small>(بار اول حدود ۱۲ مگ دانلود می‌شود)</small></div>'
    : mlState.startsWith('err:') ? `<div class="ml-st big err">⚠️ ${escHtml(mlState.slice(4))}<br><small>اتصال اینترنت را بررسی کنید؛ با گرفتن یا انتخاب عکس، دوباره امتحان می‌شود.</small></div>` : '';
  const q = mlQ, face = q && q.faces[q.sel];
  box.innerHTML = `<div class="ml-hero">زائری پیدا کرده‌اید که نمی‌تواند خودش را معرفی کند؟ از چهره‌اش عکس بگیرید تا با پرونده‌های گمشده‌ای که خانواده‌ها به ستاد داده‌اند مقایسه شود.</div>
    ${st}
    <label class="lost-btn ml-cam">📷 گرفتن عکس از فرد پیداشده<input type="file" accept="image/*" capture="environment" hidden onchange="mlFind(this)"></label>
    <label class="lost-btn alt ml-cam">🖼 انتخاب عکس از گالری<input type="file" accept="image/*" hidden onchange="mlFind(this)"></label>
    ${mlBusy ? '<div class="ml-st big">⏳ در حال جستجو… لطفاً صبر کنید</div>' : ''}
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
  .ml-st.big{font-size:calc(17px * var(--fs,1));font-weight:800;color:var(--text,#222);background:var(--card2,#f6f1e7);border-radius:12px;padding:12px 14px;text-align:center}
  .ml-st.big small{display:block;font-size:.75em;font-weight:500;color:var(--muted,#666)}
  .mlw{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:16px}
  .mlw-box{background:var(--card,#fff);color:var(--text,#222);border-radius:22px;padding:26px 22px 20px;width:min(360px,100%);text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.35)}
  .mlw-ic{font-size:64px;line-height:1;display:inline-block;animation:mlw-flip 2s ease-in-out infinite}
  .mlw.err .mlw-ic{animation:none}
  @keyframes mlw-flip{0%,40%{transform:rotate(0)}50%,90%{transform:rotate(180deg)}100%{transform:rotate(360deg)}}
  .mlw-t{font-size:calc(20px * var(--fs,1));font-weight:900;margin:14px 0 6px;line-height:1.7}
  .mlw-s{font-size:calc(15px * var(--fs,1));line-height:1.9;color:var(--muted,#555)}
  .mlw.err .mlw-s{color:var(--text,#222);font-weight:700}
  .mlw-bar{height:6px;border-radius:6px;background:var(--card2,#eee);overflow:hidden;margin:14px 0 6px}
  .mlw-bar i{display:block;height:100%;width:40%;border-radius:6px;background:var(--gold,#C9A24B);animation:mlw-run 1.4s ease-in-out infinite}
  .mlw.err .mlw-bar{display:none}
  @keyframes mlw-run{0%{transform:translateX(160%)}100%{transform:translateX(-260%)}}
  .mlw-time{font-size:13px;color:var(--muted,#777);min-height:18px}
  .mlw-act{display:flex;flex-direction:column;gap:8px;margin-top:8px}.mlw-act:empty{display:none}
  .mlw-b{font:inherit;font-size:calc(16px * var(--fs,1));font-weight:800;border:0;border-radius:14px;padding:13px;background:var(--gold,#C9A24B);color:#fff;cursor:pointer}
  .mlw-b.alt{background:var(--card2,#eee);color:var(--text,#222)}
  @media (prefers-reduced-motion:reduce){.mlw-ic,.mlw-bar i{animation:none}}
</style>`);
