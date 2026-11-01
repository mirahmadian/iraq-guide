'use strict';
/* ورود همکاران — مشترک بین صفحه مدیر ثابت، مدیر منطقه و مدیر سامانه (team.html)
   داده‌ها روی سرور «نواقص هتل‌ها» است و با توکن (Authorization) صدا زده می‌شود.
   همکاران پنل ادمین برنامه (Cloudflare) هم از همین فرم وارد می‌شوند و به admin.html می‌روند. */
const HR_API = 'https://188-121-118-223.nip.io';
const RV_API = 'https://hamyar-reviews.hamyar-karevan.workers.dev';
const HR = { token: '', viewRegion: 0 };
try { HR.token = localStorage.getItem('hr-token') || ''; } catch (e) {}
function setToken(t) { HR.token = t || ''; try { t ? localStorage.setItem('hr-token', t) : localStorage.removeItem('hr-token'); } catch (e) {} }
const fa = n => Number(n || 0).toLocaleString('fa-IR');
const faS = s => String(s ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = d => faS(String(d || '').slice(5));
const MONTHS = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const dayName = d => { const [, m, dd] = String(d).split('/').map(Number); return m ? fa(dd) + ' ' + MONTHS[m] : ''; };
function nextDay(d) { let [y, m, dd] = d.split('/').map(Number); const len = m <= 6 ? 31 : m <= 11 ? 30 : 29; if (++dd > len) { dd = 1; if (++m > 12) { m = 1; y++; } } return `${y}/${String(m).padStart(2, '0')}/${String(dd).padStart(2, '0')}`; }
function daysOf(a, b) { if (!/^\d{4}\/\d{2}\/\d{2}$/.test(a || '') || !/^\d{4}\/\d{2}\/\d{2}$/.test(b || '')) return []; const out = [a]; let d = a, g = 0; while (d < b && g++ < 40) { d = nextDay(d); out.push(d); } return out; }
const fmtTs = ts => ts ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Baghdad' }).format(ts) : '';
const shortCo = n => String(n || '').replace('شرکت مرکزی دفاتر خدمات زیارتی سراسر ایران (شمسا)', 'شمسا').replace('شرکت مرکزی کارگزاران امور زیارتی استان ', 'کارگزاران ').replace('شرکت مرکزی ', '');
const kb = b => b > 1048576 ? faS((b / 1048576).toFixed(1)) + ' مگ' : fa(Math.round(b / 1024)) + ' کیلو';
const RESULT = { fixed: ['رفع شد', '✅', 'ok'], follow: ['در حال پیگیری', '⏳', 'warn'], open: ['رفع نشد', '❌', 'bad'] };
const RATING = [{ v: 'great', l: 'عالی', em: '😍', c: 'g' }, { v: 'good', l: 'خوب', em: '🙂', c: 'g' }, { v: 'mid', l: 'متوسط', em: '😐', c: 'm' }, { v: 'poor', l: 'ضعیف', em: '☹️', c: 'b' }];

/* اینترنت عراق تا سرور گاهی بسته‌ها را گم می‌کند و یک درخواست گیر می‌کند:
   هر درخواست مهلت دارد و دوباره (با اتصال تازه) فرستاده می‌شود؛ خواندنی‌ها یک دقیقه نگه داشته می‌شوند تا جابه‌جایی بین تب‌ها فوری باشد. */
const GETC = new Map(), INFLIGHT = new Map();
async function api(path, opt = {}) {
  if (HR.viewRegion && path.startsWith('/api/admin/')) path += (path.includes('?') ? '&' : '?') + 'region=' + HR.viewRegion;
  const h = { ...(HR.token ? { Authorization: 'Bearer ' + HR.token } : {}), ...(opt.headers || {}) };
  let body = opt.body;
  if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) { body = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
  const method = opt.method || (body !== undefined ? 'POST' : 'GET'), get = method === 'GET' && !opt.raw;
  if (method !== 'GET') GETC.clear();
  if (get && !opt.fresh) { const c = GETC.get(path); if (c && Date.now() - c.t < 60000) return JSON.parse(c.text); }
  const tries = get || opt.retry ? 3 : 1, wait = opt.timeout || (get ? 20000 : 45000);
  let run = get && !opt.fresh && INFLIGHT.get(path);
  if (!run) run = (async () => {
    let r;
    for (let i = 1; ; i++) {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), wait * i);
      try { r = await fetch(HR_API + path, { method, headers: h, body, cache: 'no-store', signal: ac.signal }); if (!opt.raw) r = { ok: r.ok, status: r.status, text: await r.text() }; clearTimeout(t); break; }
      catch (e) {
        clearTimeout(t);
        if (i >= tries) throw Object.assign(new Error(e.name === 'AbortError' ? 'ارتباط با سرور خیلی کند است. چند لحظه بعد دوباره امتحان کنید.' : 'اینترنت وصل نیست یا سرور در دسترس نیست.'), { offline: true });
      }
    }
    return r;
  })();
  if (get && !INFLIGHT.has(path)) { INFLIGHT.set(path, run); run.catch(() => {}).finally(() => INFLIGHT.delete(path)); }
  const r = await run;
  if (opt.raw && r.ok) return r;
  let j = {}; try { j = JSON.parse(opt.raw ? await r.text() : r.text); } catch (e) {}
  if (!r.ok) throw Object.assign(new Error(j.error || 'خطا ' + r.status), { status: r.status });
  if (get) GETC.set(path, { t: Date.now(), text: r.text });
  return j;
}
async function download(path, fallbackName) {
  const r = await api(path, { raw: true });
  const cd = r.headers.get('Content-Disposition') || '', m = /filename\*=UTF-8''([^;]+)/.exec(cd);
  const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = m ? decodeURIComponent(m[1]) : fallbackName;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

let toastT;
function toast(msg, bad) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.className = 'toast' + (bad ? ' bad' : ''); el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, bad ? 6000 : 3200);
}

/* ── fingerprint / face (WebAuthn passkeys) ── */
const b2u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const u2b = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const bioSupported = () => !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
async function bioAvailable() { try { return bioSupported() && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (e) { return false; } }
function bioErr(e) {
  if (e && e.name === 'NotAllowedError') return 'تأیید لغو شد یا زمانش تمام شد.';
  if (e && e.name === 'InvalidStateError') return 'اثر انگشت این گوشی قبلاً ثبت شده است.';
  return e && e.message || 'ورود با اثر انگشت ناموفق بود.';
}
async function bioRegister() {
  const o = await api('/api/passkey/reg-options', { body: {} });
  const cred = await navigator.credentials.create({ publicKey: { ...o, challenge: u2b(o.challenge), user: { ...o.user, id: u2b(o.user.id) },
    excludeCredentials: (o.excludeCredentials || []).map(c => ({ ...c, id: u2b(c.id) })) } });
  const r = cred.response;
  if (!r.getPublicKey || !r.getAuthenticatorData) throw new Error('مرورگر این گوشی قدیمی است. Chrome یا Safari را به‌روز کنید.');
  const ua = navigator.userAgent, label = /iPhone|iPad/.test(ua) ? 'آیفون' : /Android/.test(ua) ? 'اندروید' : /Mac/.test(ua) ? 'مک' : /Windows/.test(ua) ? 'ویندوز' : 'دستگاه';
  await api('/api/passkey/register', { body: { id: cred.id, clientDataJSON: b2u(r.clientDataJSON), authenticatorData: b2u(r.getAuthenticatorData()), publicKey: b2u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm(), label } });
  try { localStorage.setItem('hr-bio', '1'); } catch (e) {}
}
async function bioLogin(nid) {
  const o = await api('/api/passkey/login-options', { body: { nid: nid || '' } });
  const cred = await navigator.credentials.get({ publicKey: { ...o, challenge: u2b(o.challenge), allowCredentials: (o.allowCredentials || []).map(c => ({ ...c, id: u2b(c.id) })) } });
  const r = cred.response;
  const j = await api('/api/passkey/login', { body: { id: cred.id, clientDataJSON: b2u(r.clientDataJSON), authenticatorData: b2u(r.authenticatorData), signature: b2u(r.signature) } });
  setToken(j.token);
}

/* ── voice typing (Persian) ── */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let srActive = null;
function voiceInto(input, btn) {
  if (!SR) { toast('تایپ صوتی در این مرورگر نیست. از میکروفون صفحه‌کلید گوشی استفاده کنید.', true); input.focus(); return; }
  if (srActive) { srActive.stop(); return; }
  const rec = new SR(); rec.lang = 'fa-IR'; rec.interimResults = true; rec.continuous = true;
  const base = input.value ? input.value.trim() + ' ' : ''; let finalText = '';
  rec.onresult = e => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += t + ' '; else interim += t; }
    input.value = (base + finalText + interim).trim(); input.dispatchEvent(new Event('input')); };
  rec.onerror = e => { if (e.error === 'not-allowed') toast('اجازه‌ی میکروفون داده نشده است.', true); else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('تایپ صوتی قطع شد. دوباره امتحان کنید.', true); };
  rec.onend = () => { srActive = null; btn.classList.remove('on'); btn.textContent = '🎤'; };
  srActive = rec; btn.classList.add('on'); btn.textContent = '■';
  try { rec.start(); } catch (e) { rec.onend(); }
}

/* ── images are shrunk on the phone before upload (max 2560px, WebP/JPEG) ── */
async function compressImage(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('این عکس باز نشد.')); i.src = URL.createObjectURL(file); }); }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, k = Math.min(1, 2560 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let blob = await new Promise(r => c.toBlob(r, 'image/webp', .82));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
  if (!blob) throw new Error('این عکس باز نشد.');
  if (blob.size >= file.size && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  return blob;
}
function upload(url, blob, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(); x.open('PUT', HR_API + url); x.setRequestHeader('Authorization', 'Bearer ' + HR.token);
    Object.entries(headers || {}).forEach(([k, v]) => x.setRequestHeader(k, v));
    x.upload.onprogress = e => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
    x.onload = () => { GETC.clear(); let j = {}; try { j = JSON.parse(x.responseText); } catch (e) {} x.status < 300 ? resolve(j) : reject(new Error(j.error || 'ارسال ناموفق بود.')); };
    x.onerror = () => reject(new Error('اینترنت قطع شد. دوباره امتحان کنید.'));
    x.send(blob);
  });
}

/* ── login / password screens ── */
function lastNid() { try { return localStorage.getItem('hr-nid') || ''; } catch (e) { return ''; } }
/* رمز همکار پنل ادمین روی همین دستگاه به کلید تبدیل می‌شود (همان روش admin-users.js) */
async function staffKey(user, pass) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode('hamyar-staff:' + user.trim().toLowerCase()), iterations: 150000, hash: 'SHA-256' }, base, 256);
  return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function staffLoginTry(nid, pass) {
  const r = await fetch(RV_API + '/staff/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: nid, key: await staffKey(nid, pass) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'ورود ناموفق'), { status: r.status });
  return j;
}
function openStaffPanel(j) {
  try { localStorage.setItem('caravan-staff', JSON.stringify({ token: j.token, name: j.name, user: j.user, perms: j.perms || [], mustChange: j.mustChange })); } catch (e) {}
  location.href = 'admin.html';
}
const nidLatin = v => String(v || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
async function renderLogin(root, onDone) {
  const nid = lastNid(), bio = await bioAvailable();
  let hasBio = false; try { hasBio = localStorage.getItem('hr-bio') === '1'; } catch (e) {}
  root.innerHTML = `<div class="login-wrap"><form class="login-card" id="lg" novalidate>
    <div class="login-head"><a class="hbtn" href="./" style="float:left;text-decoration:none">→ برنامه</a><div class="hi">همیار کاروان</div><h1>👥 ورود همکاران</h1></div>
    <div class="login-body">
      ${bio && hasBio ? `<button type="button" class="bio" id="lg-bio">☝️ ورود با اثر انگشت</button><div class="or">یا با رمز</div>` : ''}
      <div class="field"><label class="label" for="lg-nid">کد ملی</label><input id="lg-nid" inputmode="numeric" autocomplete="username" maxlength="12" value="${esc(nid)}" placeholder="۱۰ رقم"></div>
      <div class="field"><label class="label" for="lg-pw">رمز</label><input id="lg-pw" type="password" autocomplete="current-password" placeholder="رمزی که مدیرتان داده است"></div>
      <span class="err" id="lg-err" role="alert"></span>
      <div id="lg-pick" hidden class="block"><span class="label">با این کد ملی به دو بخش دسترسی دارید. کدام را باز کنم؟</span>
        <button type="button" class="btn" id="lg-hr">🏨 گزارشات مدیران ثابت</button><button type="button" class="btn ghost" id="lg-st">⚙️ پنل ادمین برنامه</button></div>
      <button class="btn" id="lg-go" type="submit">ورود</button>
      <p class="hint">سامانه خودش تشخیص می‌دهد شما مدیر ثابت، مدیر منطقه، مدیر سامانه یا همکار پنل ادمین هستید.<br>رمز را فراموش کرده‌اید؟ به مدیرتان بگویید تا رمز تازه بدهد.</p>
      <a class="hint" href="admin.html" style="text-align:center">ورود مدیر اصلی برنامه (با رمز مدیریت)</a>
    </div></form></div>`;
  const err = root.querySelector('#lg-err'), nidEl = root.querySelector('#lg-nid');
  const remember = () => { try { localStorage.setItem('hr-nid', nidEl.value.trim()); } catch (e) {} };
  root.querySelector('#lg').onsubmit = async e => {
    e.preventDefault(); err.textContent = '';
    const nid = nidLatin(nidEl.value), pw = root.querySelector('#lg-pw').value;
    if (!nid || !pw) { err.textContent = 'کد ملی و رمز را بنویسید.'; return; }
    const b = root.querySelector('#lg-go'); b.disabled = true; b.textContent = 'در حال ورود…';
    /* هر دو سامانه هم‌زمان امتحان می‌شوند؛ هر کدام پذیرفت، همان باز می‌شود */
    const [hr, st] = await Promise.allSettled([api('/api/login', { body: { nid, password: pw } }), staffLoginTry(nid, pw)]);
    b.disabled = false; b.textContent = 'ورود'; remember();
    if (hr.status === 'fulfilled' && st.status === 'fulfilled') {
      root.querySelector('#lg-pick').hidden = false; b.hidden = true;
      root.querySelector('#lg-hr').onclick = () => { setToken(hr.value.token); onDone(); };
      root.querySelector('#lg-st').onclick = () => openStaffPanel(st.value);
      return;
    }
    if (hr.status === 'fulfilled') { setToken(hr.value.token); return onDone(); }
    if (st.status === 'fulfilled') return openStaffPanel(st.value);
    const why = [hr.reason, st.reason].find(x => x && x.status === 429) || (hr.reason && hr.reason.offline && !(st.reason && st.reason.status) ? hr.reason : null);
    err.textContent = why ? why.message : 'کد ملی یا رمز درست نیست.';
  };
  const bb = root.querySelector('#lg-bio');
  if (bb) bb.onclick = async () => { err.textContent = ''; try { await bioLogin(nidLatin(nidEl.value)); remember(); onDone(); } catch (x) { err.textContent = bioErr(x); } };
}
function renderChangePw(root, me, onDone) {
  root.innerHTML = `<div class="login-wrap"><form class="login-card" id="cp" novalidate>
    <div class="login-head"><div class="hi">${esc(me.name)}</div><h1>رمز موقت را عوض کنید</h1></div>
    <div class="login-body">
      <p class="hint">این رمز را مدیر منطقه داده است. یک رمز تازه بگذارید که فقط خودتان بدانید (دست‌کم ۶ کاراکتر).</p>
      <div class="field"><label class="label" for="cp-old">رمز موقت</label><input id="cp-old" type="password" autocomplete="current-password"></div>
      <div class="field"><label class="label" for="cp-new">رمز جدید</label><input id="cp-new" type="password" autocomplete="new-password"></div>
      <div class="field"><label class="label" for="cp-new2">تکرار رمز جدید</label><input id="cp-new2" type="password" autocomplete="new-password"></div>
      <span class="err" id="cp-err" role="alert"></span>
      <button class="btn" type="submit">ذخیره‌ی رمز</button>
      <button class="btn ghost" type="button" id="cp-out">خروج</button>
    </div></form></div>`;
  root.querySelector('#cp').onsubmit = async e => {
    e.preventDefault(); const err = root.querySelector('#cp-err'); err.textContent = '';
    const n = root.querySelector('#cp-new').value;
    if (n !== root.querySelector('#cp-new2').value) { err.textContent = 'رمز جدید و تکرارش یکی نیستند.'; return; }
    try { await api('/api/password', { body: { old: root.querySelector('#cp-old').value, new: n } }); onDone(); } catch (x) { err.textContent = x.message; }
  };
  root.querySelector('#cp-out').onclick = logout;
}
async function logout() { try { await api('/api/logout', { body: {} }); } catch (e) {} setToken(''); location.hash = ''; location.reload(); }

/* ── settings: password + fingerprint ── */
async function renderAccount(root, me, onBack) {
  const bio = await bioAvailable();
  root.innerHTML = `<div class="card"><div class="card-h"><h2>☝️ ورود با اثر انگشت</h2></div>
      ${bio ? `<p class="hint">با روشن کردن این گزینه، روی همین گوشی بدون رمز و با اثر انگشت یا تشخیص چهره وارد می‌شوید. اثر انگشت شما از گوشی خارج نمی‌شود.</p>
        <div class="block">${me.passkeys.map(k => `<div class="row" style="justify-content:space-between"><span>📱 ${esc(k.label || 'دستگاه')} <span class="dim" style="font-size:12px">· ثبت ${fmtTs(k.created)}${k.last_used ? ' · آخرین ورود ' + fmtTs(k.last_used) : ''}</span></span><button class="btn small danger" data-pk="${esc(k.id)}">حذف</button></div>`).join('') || '<span class="dim">هنوز برای هیچ دستگاهی روشن نشده است.</span>'}</div>
        <button class="btn" id="ac-bio">روشن کردن برای این گوشی</button>` : '<p class="hint">این گوشی یا مرورگر ورود با اثر انگشت را پشتیبانی نمی‌کند. Chrome یا Safari به‌روز لازم است و گوشی باید قفل صفحه (اثر انگشت، چهره یا رمز) داشته باشد.</p>'}</div>
    <form class="card" id="ac-pw" novalidate><div class="card-h"><h2>🔑 تغییر رمز</h2></div>
      <div class="field"><label class="label" for="ac-old">رمز فعلی</label><input id="ac-old" type="password" autocomplete="current-password"></div>
      <div class="field"><label class="label" for="ac-new">رمز جدید</label><input id="ac-new" type="password" autocomplete="new-password"></div>
      <span class="err" id="ac-err" role="alert"></span><button class="btn" type="submit">ذخیره‌ی رمز</button></form>
    <div class="row"><button class="btn ghost" id="ac-back">بازگشت</button><button class="btn danger" id="ac-out">خروج از حساب</button></div>`;
  root.querySelector('#ac-back').onclick = onBack;
  root.querySelector('#ac-out').onclick = logout;
  const b = root.querySelector('#ac-bio');
  if (b) b.onclick = async () => { try { await bioRegister(); toast('ورود با اثر انگشت روشن شد.'); const me2 = await api('/api/me'); Object.assign(me, me2); renderAccount(root, me, onBack); } catch (e) { toast(bioErr(e), true); } };
  root.querySelectorAll('[data-pk]').forEach(x => x.onclick = async () => { await api('/api/passkeys/' + x.dataset.pk, { method: 'DELETE' }); me.passkeys = me.passkeys.filter(k => k.id !== x.dataset.pk); renderAccount(root, me, onBack); });
  root.querySelector('#ac-pw').onsubmit = async e => {
    e.preventDefault(); const err = root.querySelector('#ac-err'); err.textContent = '';
    try { await api('/api/password', { body: { old: root.querySelector('#ac-old').value, new: root.querySelector('#ac-new').value } }); toast('رمز عوض شد.'); root.querySelector('#ac-pw').reset(); } catch (x) { err.textContent = x.message; }
  };
}

/* ── zoomable image viewer (pinch, wheel, double tap, drag) ── */
const Z = { s: 1, x: 0, y: 0, min: 1, iw: 0, ih: 0, pts: new Map(), last: null, pinch: null, tap: 0 };
function zoomInit() {
  if (document.getElementById('zv')) return;
  document.body.insertAdjacentHTML('beforeend', `<div class="zv" id="zv" hidden role="dialog" aria-modal="true" aria-label="نمایش تصویر">
    <div class="zv-top"><span id="zv-cap"></span><div class="tools"><button id="zv-out" aria-label="کوچک‌نمایی">−</button><button id="zv-pct" aria-label="اندازه‌ی اصلی" style="font-size:12.5px">۱۰۰٪</button><button id="zv-in" aria-label="بزرگ‌نمایی">+</button><button id="zv-close" aria-label="بستن">✕</button></div></div>
    <div class="zv-stage" id="zv-stage"><img id="zv-img" alt=""></div><div class="zv-hint">بزرگ‌نمایی: دو انگشت، چرخ موس یا دو بار ضربه · جابه‌جایی: بکشید</div></div>`);
  const zv = document.getElementById('zv'), st = document.getElementById('zv-stage'), im = document.getElementById('zv-img');
  const apply = () => { const W = st.clientWidth, H = st.clientHeight, w = Z.iw * Z.s, h = Z.ih * Z.s;
    Z.x = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, Z.x)); Z.y = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, Z.y));
    im.style.transform = `translate(${Z.x}px,${Z.y}px) scale(${Z.s})`; document.getElementById('zv-pct').textContent = fa(Math.round(Z.s * 100)) + '٪'; };
  const at = (ns, cx, cy) => { ns = Math.max(Z.min, Math.min(Math.max(4, Z.min * 8), ns)); Z.x = cx - (cx - Z.x) * ns / Z.s; Z.y = cy - (cy - Z.y) * ns / Z.s; Z.s = ns; apply(); };
  const fit = () => { Z.min = Math.min(1, st.clientWidth / Z.iw, st.clientHeight / Z.ih); };
  im.onload = () => { Z.iw = im.naturalWidth; Z.ih = im.naturalHeight; fit(); Z.s = Z.min; Z.x = Z.y = 0; apply(); };
  const close = () => { zv.hidden = true; document.body.style.overflow = ''; };
  document.getElementById('zv-close').onclick = close;
  document.getElementById('zv-in').onclick = () => at(Z.s * 1.6, st.clientWidth / 2, st.clientHeight / 2);
  document.getElementById('zv-out').onclick = () => at(Z.s / 1.6, st.clientWidth / 2, st.clientHeight / 2);
  document.getElementById('zv-pct').onclick = () => at(1, st.clientWidth / 2, st.clientHeight / 2);
  document.addEventListener('keydown', e => { if (!zv.hidden && e.key === 'Escape') close(); });
  st.addEventListener('wheel', e => { e.preventDefault(); const b = st.getBoundingClientRect(); at(Z.s * Math.exp(-e.deltaY * 0.0018), e.clientX - b.left, e.clientY - b.top); }, { passive: false });
  st.addEventListener('pointerdown', e => { st.setPointerCapture(e.pointerId); Z.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); st.classList.add('drag');
    if (Z.pts.size === 1) { const now = Date.now(), b = st.getBoundingClientRect(); if (now - Z.tap < 300) at(Z.s > Z.min * 1.2 ? Z.min : Math.max(1, Z.min * 3), e.clientX - b.left, e.clientY - b.top); Z.tap = now; Z.last = { x: e.clientX, y: e.clientY }; }
    else if (Z.pts.size === 2) { const [a, c] = [...Z.pts.values()]; Z.pinch = { d: Math.hypot(a.x - c.x, a.y - c.y), s: Z.s }; } });
  st.addEventListener('pointermove', e => { if (!Z.pts.has(e.pointerId)) return; Z.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const b = st.getBoundingClientRect();
    if (Z.pts.size === 2 && Z.pinch) { const [a, c] = [...Z.pts.values()]; at(Z.pinch.s * Math.hypot(a.x - c.x, a.y - c.y) / Z.pinch.d, (a.x + c.x) / 2 - b.left, (a.y + c.y) / 2 - b.top); }
    else if (Z.pts.size === 1 && Z.last) { Z.x += e.clientX - Z.last.x; Z.y += e.clientY - Z.last.y; Z.last = { x: e.clientX, y: e.clientY }; apply(); } });
  const up = e => { Z.pts.delete(e.pointerId); if (Z.pts.size < 2) Z.pinch = null; if (!Z.pts.size) { Z.last = null; st.classList.remove('drag'); } else { const p = [...Z.pts.values()][0]; Z.last = { x: p.x, y: p.y }; } };
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  window.addEventListener('resize', () => { if (!zv.hidden && Z.iw) { fit(); if (Z.s < Z.min) Z.s = Z.min; apply(); } });
}
function openZoom(src, cap) {
  zoomInit();
  document.getElementById('zv-cap').textContent = cap || ''; document.getElementById('zv').hidden = false; document.body.style.overflow = 'hidden';
  document.getElementById('zv-img').src = src; document.getElementById('zv-close').focus();
}

/* ── boot: who is this? ── */
async function teamBoot() {
  const app = document.getElementById('app');
  HR.viewRegion = 0;
  if (location.hash === '#owner') {
    /* from admin.html: the main owner's unlocked GitHub key makes them a system manager */
    history.replaceState(null, '', location.pathname);
    let gh = ''; try { gh = localStorage.getItem('caravan-admin-token') || ''; } catch (e) {}
    if (gh) try { setToken((await api('/api/owner-login', { body: { gh } })).token); } catch (e) { toast(e.message, true); }
  }
  if (!HR.token) return renderLogin(app, teamBoot);
  let me;
  try { me = await api('/api/me'); }
  catch (e) {
    if (e.status === 401) { setToken(''); return renderLogin(app, teamBoot); }
    app.innerHTML = `<div class="login-wrap"><div class="card" style="max-width:420px"><b>سامانه در دسترس نیست</b><span class="muted">${esc(e.message)}</span><button class="btn" id="retry">دوباره امتحان کنید</button><a class="btn ghost" href="./" style="text-align:center;text-decoration:none">بازگشت به برنامه</a></div></div>`;
    app.querySelector('#retry').onclick = teamBoot; return;
  }
  if (me.mustChange) return renderChangePw(app, me, teamBoot);
  if (me.role === 'fm') return startFM(me);
  if (me.role === 'region') return startRegion(me, {});
  if (me.role === 'super') return startSuper(me);
}
