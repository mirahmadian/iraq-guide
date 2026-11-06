'use strict';
/* ورود همکاران — مشترک بین صفحه مدیر ثابت، مدیر منطقه و مدیر سامانه (team.html)
   داده‌ها روی سرور «نواقص هتل‌ها» است و با توکن (در نشانی، _t) صدا زده می‌شود.
   همکاران پنل ادمین برنامه (Cloudflare) هم از همین فرم وارد می‌شوند و به admin.html می‌روند. */
/* دو راه به سرور: واسطه رایگان Cloudflare (worker/team-proxy — وقتی اینترنت کاربر مستقیم به سرور نمی‌رسد) و نشانی مستقیم.
   اگر یکی وصل نشد، خودکار با دیگری امتحان می‌شود و راهی که جواب داد روی گوشی به خاطر سپرده می‌شود. */
const HR_APIS = ['https://hamyar-team.hamyar-karevan.workers.dev', 'https://188-121-118-223.nip.io'];
let HR_API = HR_APIS[0];
try { const s = localStorage.getItem('hr-api'); if (HR_APIS.includes(s)) HR_API = s; } catch (e) {}
const RV_API = 'https://hamyar-reviews.hamyar-karevan.workers.dev';
const HR = { token: '', viewRegion: 0 };
try { HR.token = localStorage.getItem('hr-token') || ''; } catch (e) {}
function setToken(t, me) {
  HR.token = t || ''; try { t ? localStorage.setItem('hr-token', t) : localStorage.removeItem('hr-token'); } catch (e) {}
  GETC.clear(); if (t && me) GETC.set('/api/me', { t: Date.now(), text: JSON.stringify(me) });  /* ورود، «من کیستم» را هم آورده: یک رفت‌وبرگشت کمتر */
}
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
const teamUrl = (path, method) => path + (path.includes('?') ? '&' : '?') + (HR.token ? '_t=' + HR.token : '') + (method === 'PUT' || method === 'DELETE' ? '&_m=' + method : '');
/* نشانگر «سامانه در حال کار است»: اگر درخواستی بیش از ۰٫۴ ثانیه طول بکشد، نوار متحرک بالای صفحه و ساعت شنی پایین صفحه نمایش داده می‌شود */
let BUSY = 0, busyT = null, busySlowT = null;
function busyEl() {
  let el = document.getElementById('busy');
  if (!el) { el = document.createElement('div'); el.id = 'busy'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="busy-bar"><i></i></div><div class="busy-pill"><span class="busy-hg" aria-hidden="true">⏳</span><span class="busy-t"></span></div>'; el.hidden = true; document.body.appendChild(el); }
  return el;
}
function busy(d, label) {
  BUSY = Math.max(0, BUSY + d);
  if (d > 0 && label) busyEl().dataset.label = label;
  if (BUSY > 0 && !busyT) busyT = setTimeout(() => {
    const el = busyEl(); el.querySelector('.busy-t').textContent = el.dataset.label || 'سامانه در حال کار است… لطفاً صبر کنید';
    el.hidden = false;
    busySlowT = setTimeout(() => { el.querySelector('.busy-t').textContent = 'سرور کند است؛ هنوز در حال تلاش است… لطفاً صفحه را نبندید'; }, 9000);
  }, 400);
  if (BUSY === 0) { clearTimeout(busyT); clearTimeout(busySlowT); busyT = busySlowT = null; const el = document.getElementById('busy'); if (el) { el.hidden = true; delete el.dataset.label; } }
}
async function api(path, opt = {}) {
  if (opt.quiet) return apiRun(path, opt);
  busy(1, opt.busyLabel);
  try { return await apiRun(path, opt); } finally { busy(-1); }
}
async function apiRun(path, opt = {}) {
  if (HR.viewRegion && path.startsWith('/api/admin/')) path += (path.includes('?') ? '&' : '?') + 'region=' + HR.viewRegion;
  let body = opt.body;
  if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) body = JSON.stringify(body);
  const method = opt.method || (body !== undefined ? 'POST' : 'GET'), get = method === 'GET' && !opt.raw;
  /* «ساده» برای مرورگر (بی‌سرآیند، فقط GET/POST): پرسش اجازه‌ی جداگانه (preflight) پیش از هر درخواست حذف می‌شود */
  const h = body !== undefined ? { 'Content-Type': 'text/plain;charset=UTF-8' } : {};
  if (method !== 'GET') GETC.clear();
  if (get && !opt.fresh) { const c = GETC.get(path); if (c && Date.now() - c.t < 60000) return JSON.parse(c.text); }
  const tries = get || opt.retry ? 3 : 1, wait = opt.timeout || (get ? 8000 : 45000);
  let run = get && !opt.fresh && INFLIGHT.get(path);
  if (!run) run = (async () => {
    let r, switched = false;
    for (let i = 1; ; i++) {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), wait * i), href = HR_API + teamUrl(path, method);
      try { r = await fetch(href, { method: method === 'GET' ? 'GET' : 'POST', headers: h, body, cache: 'no-store', signal: ac.signal }); if (!opt.raw) r = { ok: r.ok, status: r.status, text: await r.text() }; clearTimeout(t); break; }
      catch (e) {
        clearTimeout(t);
        /* راه دیگر: برای خواندنی‌ها همیشه؛ برای ثبت‌ها فقط وقتی اصلاً وصل نشده (نه دیر جواب داده) تا چیزی دو بار ثبت نشود */
        if (!switched && (get || e.name !== 'AbortError')) {
          switched = true;
          HR_API = HR_APIS.find(b => b !== HR_API);
          try { localStorage.setItem('hr-api', HR_API); } catch (x) {}
          continue;
        }
        if (i >= tries) throw Object.assign(new Error(e.name === 'AbortError' ? 'ارتباط با سرور خیلی کند است. چند لحظه بعد دوباره امتحان کنید.' : 'اینترنت وصل نیست یا سرور در دسترس نیست.'), { offline: true });
      }
    }
    return r;
  })();
  if (get && !INFLIGHT.has(path)) { INFLIGHT.set(path, run); run.catch(() => {}).finally(() => INFLIGHT.delete(path)); }
  const r = await run;
  if (opt.raw && r.ok) return r;
  let j = {}; try { j = JSON.parse(opt.raw ? await r.text() : r.text); } catch (e) {}
  /* «fetch failed» پیام خام سرور است وقتی خودش به سرویس دیگری وصل نمی‌شود */
  if (!r.ok) throw Object.assign(new Error(j.error === 'fetch failed' ? 'سرور در آماده کردن پاسخ به مشکل خورد (fetch failed). چند دقیقه بعد دوباره امتحان کنید و اگر تکرار شد به مدیر سامانه خبر دهید.' : j.error || 'خطا ' + r.status), { status: r.status });
  if (get) GETC.set(path, { t: Date.now(), text: r.text });
  return j;
}
async function download(path, fallbackName) {
  const r = await api(path, { raw: true, busyLabel: 'در حال ساختن فایل اکسل… ممکن است کمی طول بکشد' });
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
async function bioRegister(me) {
  const o = await api('/api/passkey/reg-options', { body: {} });
  const cred = await navigator.credentials.create({ publicKey: { ...o, challenge: u2b(o.challenge), user: { ...o.user, id: u2b(o.user.id) },
    excludeCredentials: (o.excludeCredentials || []).map(c => ({ ...c, id: u2b(c.id) })) } });
  const r = cred.response;
  if (!r.getPublicKey || !r.getAuthenticatorData) throw new Error('مرورگر این گوشی قدیمی است. Chrome یا Safari را به‌روز کنید.');
  const ua = navigator.userAgent, label = /iPhone|iPad/.test(ua) ? 'آیفون' : /Android/.test(ua) ? 'اندروید' : /Mac/.test(ua) ? 'مک' : /Windows/.test(ua) ? 'ویندوز' : 'دستگاه';
  await api('/api/passkey/register', { body: { id: cred.id, clientDataJSON: b2u(r.clientDataJSON), authenticatorData: b2u(r.getAuthenticatorData()), publicKey: b2u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm(), label } });
  try { localStorage.setItem('hr-bio', '1'); localStorage.setItem('hr-bio-id', cred.id); if (me) { localStorage.setItem('hr-bio-nid', me.nid); localStorage.setItem('hr-bio-name', me.name); } } catch (e) {}
}
async function bioLogin(nid) {
  const o = await api('/api/passkey/login-options', { body: { nid: nid || '' } });
  let mine = ''; try { mine = localStorage.getItem('hr-bio-id') || ''; } catch (e) {}
  let allow = o.allowCredentials || []; if (mine && allow.some(c => c.id === mine)) allow = allow.filter(c => c.id === mine);
  const cred = await navigator.credentials.get({ publicKey: { ...o, challenge: u2b(o.challenge), allowCredentials: allow.map(c => ({ ...c, id: u2b(c.id) })) } });
  const r = cred.response;
  const j = await api('/api/passkey/login', { body: { id: cred.id, clientDataJSON: b2u(r.clientDataJSON), authenticatorData: b2u(r.authenticatorData), signature: b2u(r.signature) } });
  setToken(j.token, j.me);
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
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, k = Math.min(1, 1920 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let blob = await new Promise(r => c.toBlob(r, 'image/webp', .82));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
  if (!blob) throw new Error('این عکس باز نشد.');
  if (blob.size >= file.size && /^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  return blob;
}
/* عکس و فیلم در تکه‌های ۱۲۸ کیلوبایتی و به ترتیب؛ تکه‌ای که گیر کند به‌تنهایی دوباره فرستاده می‌شود */
async function upload(url, blob, opt, onProgress) {
  const PART = 131072, of = Math.max(1, Math.ceil(blob.size / PART)), up = Math.random().toString(16).slice(2);
  const base = url + (url.includes('?') ? '&' : '?') + `orig=${opt && opt.orig || blob.size}&up=${up}&of=${of}`;
  let r;
  for (let i = 0; i < of; i++) {
    r = await api(base + '&i=' + i, { method: 'PUT', body: blob.slice(i * PART, (i + 1) * PART), retry: true, timeout: 30000 });
    onProgress && onProgress((i + 1) / of);
  }
  if (!r || !r.id) throw new Error('ارسال کامل نشد. دوباره امتحان کنید.');
  return r;
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
const FP_SVG = `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
  <path d="M14 26a18 18 0 0 1 36 0"/><path d="M10 38c2-3 3-7 3-12"/><path d="M51 26c0 6-1 12-3 17"/>
  <path d="M20 26a12 12 0 0 1 24 0c0 8-2 16-6 23"/><path d="M18 44c2-5 2-11 2-18"/>
  <path d="M26 26a6 6 0 0 1 12 0c0 10-3 19-8 26"/><path d="M24 50c4-7 6-15 6-24"/><path d="M32 26c0 8-2 16-5 22"/></svg>`;
/* گوشی‌ای که اثر انگشت رویش روشن است: صفحه‌ی ساده با نشان بزرگ اثر انگشت پایین صفحه (همان جای حسگر)، و برگه‌ی تأیید خود گوشی خودکار باز می‌شود */
async function renderBioLogin(root, onDone) {
  let name = '', nid = ''; try { name = localStorage.getItem('hr-bio-name') || ''; nid = localStorage.getItem('hr-bio-nid') || lastNid(); } catch (e) {}
  root.innerHTML = `<div class="fp-wrap">
    <div class="fp-top"><a class="hbtn" href="./" style="text-decoration:none">→ برنامه</a><div class="hi">همیار کاروان · ورود همکاران</div>
      <h1>${name ? 'سلام، ' + esc(name) : 'ورود با اثر انگشت'}</h1><p>برای ورود، انگشتتان را روی حسگر اثر انگشت گوشی بگذارید.</p></div>
    <div class="fp-bottom"><button type="button" class="fp-btn" id="fp-go" aria-label="ورود با اثر انگشت">${FP_SVG}</button>
      <span class="fp-msg" id="fp-msg" role="alert">برای ورود لمس کنید</span>
      <button type="button" class="fp-alt" id="fp-pw">ورود با کد ملی و رمز</button></div></div>`;
  const msg = root.querySelector('#fp-msg'), go = root.querySelector('#fp-go');
  const tryBio = async () => {
    if (go.disabled) return; go.disabled = true; go.classList.add('on'); msg.textContent = 'منتظر تأیید اثر انگشت…';
    try { await bioLogin(nid); onDone(); }
    catch (x) { go.disabled = false; go.classList.remove('on'); msg.textContent = x && x.name === 'NotAllowedError' ? 'برای ورود دوباره لمس کنید' : bioErr(x); }
  };
  go.onclick = tryBio;
  root.querySelector('#fp-pw').onclick = () => renderLogin(root, onDone, true);
  /* right after «خروج» (e.g. to sign in as someone else) the sheet waits for a tap */
  let out = false; try { out = sessionStorage.getItem('hr-out') === '1'; sessionStorage.removeItem('hr-out'); } catch (e) {}
  if (!out) tryBio();
}
async function renderLogin(root, onDone, withPassword) {
  const nid = lastNid(), bio = await bioAvailable();
  let hasBio = false; try { hasBio = localStorage.getItem('hr-bio') === '1'; } catch (e) {}
  if (bio && hasBio && !withPassword) return renderBioLogin(root, onDone);
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
      root.querySelector('#lg-hr').onclick = () => { setToken(hr.value.token, hr.value.me); onDone(); };
      root.querySelector('#lg-st').onclick = () => openStaffPanel(st.value);
      return;
    }
    if (hr.status === 'fulfilled') { setToken(hr.value.token, hr.value.me); return onDone(); }
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
    const sb = root.querySelector('#cp [type=submit]'); if (sb.disabled) return; sb.disabled = true;
    try { await api('/api/password', { body: { old: root.querySelector('#cp-old').value, new: n } }); onDone(); } catch (x) { sb.disabled = false; err.textContent = x.message; }
  };
  root.querySelector('#cp-out').onclick = logout;
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-logout]')) logout();
  const c = e.target.closest('[data-copy]');
  if (c) (navigator.clipboard ? navigator.clipboard.writeText(c.dataset.copy) : Promise.reject()).then(() => toast('کپی شد.'), () => toast('کپی نشد؛ رمز را از روی صفحه بنویسید.', true));
});
async function logout() { try { await api('/api/logout', { body: {} }); } catch (e) {} setToken(''); try { sessionStorage.setItem('hr-out', '1'); } catch (e) {} location.hash = ''; location.reload(); }

/* ── settings: password + fingerprint ── */
async function renderAccount(root, me, onBack) {
  const bio = await bioAvailable();
  /* کدام کلید مال همین گوشی است؟ (گوشی‌هایی که پیش از این نسخه روشن شده‌اند شناسه را نگه نداشته‌اند) */
  let mine = '', flag = false; try { mine = localStorage.getItem('hr-bio-id') || ''; flag = localStorage.getItem('hr-bio') === '1'; } catch (e) {}
  const here = k => k.id === mine || (!mine && flag && me.passkeys.length === 1);
  const onHere = me.passkeys.some(here);
  root.innerHTML = `<div class="card"><div class="card-h"><h2>☝️ ورود با اثر انگشت</h2>${onHere ? '<span class="pill ok">روی این گوشی روشن است</span>' : ''}</div>
      ${!bio ? '<p class="hint">این گوشی یا مرورگر ورود با اثر انگشت را پشتیبانی نمی‌کند. Chrome یا Safari به‌روز لازم است و گوشی باید قفل صفحه (اثر انگشت، چهره یا رمز) داشته باشد.</p>'
        : onHere ? '<p class="hint">روی این گوشی بدون رمز و با اثر انگشت یا تشخیص چهره وارد می‌شوید. اگر گوشی را عوض کردید یا نمی‌خواهید دیگر با اثر انگشت وارد شوید، «خاموش کردن» را بزنید؛ بعد از آن با کد ملی و رمز وارد می‌شوید و هر وقت خواستید دوباره روشنش می‌کنید.</p>'
        : '<p class="hint">با روشن کردن این گزینه، روی همین گوشی بدون رمز و با اثر انگشت یا تشخیص چهره وارد می‌شوید. اثر انگشت شما از گوشی خارج نمی‌شود.</p><button class="btn" id="ac-bio">☝️ روشن کردن برای این گوشی</button>'}
      ${me.passkeys.length ? `<div class="block"><span class="label">دستگاه‌هایی که اثر انگشت رویشان روشن است</span>${me.passkeys.map(k => `<div class="row" style="justify-content:space-between"><span>📱 ${esc(k.label || 'دستگاه')}${here(k) ? ' <b>(همین گوشی)</b>' : ''} <span class="dim" style="font-size:12px">· روشن‌شده ${fmtTs(k.created)}${k.last_used ? ' · آخرین ورود ' + fmtTs(k.last_used) : ''}</span></span><button class="btn small ghost" data-pk="${esc(k.id)}">🚫 خاموش کردن اثر انگشت${here(k) ? '' : ' آن دستگاه'}</button></div>`).join('')}</div>` : ''}</div>
    <form class="card" id="ac-pw" novalidate><div class="card-h"><h2>🔑 تغییر رمز</h2></div>
      <div class="field"><label class="label" for="ac-old">رمز فعلی</label><input id="ac-old" type="password" autocomplete="current-password"></div>
      <div class="field"><label class="label" for="ac-new">رمز جدید</label><input id="ac-new" type="password" autocomplete="new-password"></div>
      <span class="err" id="ac-err" role="alert"></span><button class="btn" type="submit">ذخیره‌ی رمز</button></form>
    <div class="row"><button class="btn ghost" id="ac-back">بازگشت</button><button class="btn danger" id="ac-out">خروج از حساب</button></div>`;
  root.querySelector('#ac-back').onclick = onBack;
  root.querySelector('#ac-out').onclick = logout;
  const b = root.querySelector('#ac-bio');
  if (b) b.onclick = async () => { b.disabled = true; try { await bioRegister(me); toast('ورود با اثر انگشت روشن شد.'); Object.assign(me, await api('/api/me', { fresh: true })); renderAccount(root, me, onBack); } catch (e) { b.disabled = false; toast(bioErr(e), true); } };
  root.querySelectorAll('[data-pk]').forEach(x => x.onclick = async () => {
    const k = me.passkeys.find(k => k.id === x.dataset.pk), mineK = k && here(k);
    if (!confirm(mineK ? 'ورود با اثر انگشت روی این گوشی خاموش شود؟\nاز این به بعد با کد ملی و رمز وارد می‌شوید و هر وقت خواستید دوباره روشنش می‌کنید.' : 'ورود با اثر انگشت روی «' + (k ? k.label : '') + '» خاموش شود؟')) return;
    x.disabled = true;
    try { await api('/api/passkeys/' + x.dataset.pk, { method: 'DELETE' }); } catch (e) { x.disabled = false; return toast(e.message, true); }
    if (mineK) try { ['hr-bio', 'hr-bio-id', 'hr-bio-nid', 'hr-bio-name'].forEach(k => localStorage.removeItem(k)); } catch (e) {}
    me.passkeys = me.passkeys.filter(p => p.id !== x.dataset.pk); toast('ورود با اثر انگشت خاموش شد.'); renderAccount(root, me, onBack);
  });
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
    if (gh) try { { const j = await api('/api/owner-login', { body: { gh } }); setToken(j.token, j.me); } } catch (e) { toast(e.message, true); }
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
