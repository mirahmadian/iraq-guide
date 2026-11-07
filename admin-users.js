/* ══════════════════════════════════════════
   USERS — همکاران پنل مدیریت با دسترسی جزءبه‌جزء
   مدیر اصلی (رمز مدیریت / کلید GitHub) در تب «👥 کاربران» همکار می‌سازد و بخش‌های مجاز را تیک می‌زند.
   همکار با نام کاربری و رمز وارد می‌شود، فقط بخش‌های مجازش را می‌بیند، و انتشارش از راه سرور
   (worker/staff.js) انجام می‌شود که فقط همان بخش‌ها را روی data.js می‌گذارد.
   فهرست دسترسی‌ها: perms.json
══════════════════════════════════════════ */
const STAFF_KEY = 'caravan-staff', STAFF_CITIES = ['najaf', 'karbala', 'kadhimiya', 'samarra'];
let STAFF = null, PERMS = null;
try { STAFF = JSON.parse(localStorage.getItem(STAFF_KEY) || 'null'); } catch (e) {}
if (STAFF) STAFF.perms = new Set(STAFF.perms || []);

/* کد ملی: ۱۰ رقم با رقم کنترل (الگوریتم رسمی کد ملی ایران) */
const nidDigits = v => String(v || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
function nidValid(c) {
  if (!/^\d{10}$/.test(c) || /^(\d)\1{9}$/.test(c)) return false;
  const r = [...c.slice(0, 9)].reduce((a, d, i) => a + +d * (10 - i), 0) % 11;
  return +c[9] === (r < 2 ? r : 11 - r);
}
function nidHint(el) {
  const c = nidDigits(el.value), h = el.parentElement.querySelector('.nid-hint');
  if (h) h.innerHTML = !c ? '' : c.length < 10 ? `<span style="color:#888">${c.length.toLocaleString('fa')} از ۱۰ رقم</span>`
    : nidValid(c) ? '<span style="color:#1a9a4a">✅ کد ملی معتبر است</span>' : '<span style="color:#c0392b">❌ این کد ملی معتبر نیست</span>';
  return c;
}
function adminAuth() { return STAFF ? 'staff ' + STAFF.token : 'token ' + ghToken; }
async function loadPerms() {
  if (!PERMS) PERMS = await (await fetch('perms.json?t=' + Date.now(), { cache: 'no-store' })).json();
  return PERMS;
}
/* همه کلیدهای دسترسی، مثل «notices» یا «city.najaf.hotels» */
function permKeys() {
  const out = [];
  PERMS.groups.forEach(g => g.items.forEach(it => {
    if (g.perCity) STAFF_CITIES.forEach(c => { if (!(it.noSamarra && c === 'samarra')) out.push(`city.${c}.${it.k}`); });
    else out.push(it.k);
  }));
  return out;
}
/* رمز روی همین دستگاه به کلید تبدیل می‌شود؛ خود رمز هیچ‌وقت به سرور نمی‌رود */
async function staffKey(user, pass) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode('hamyar-staff:' + user.trim().toLowerCase()), iterations: 150000, hash: 'SHA-256' }, base, 256);
  return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function adminFetch(path, body, auth) {
  return fetch(RV_API + path, { method: body ? 'POST' : 'GET', cache: 'no-store',
    headers: { ...(auth ? { Authorization: auth } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
    .then(r => r.json().catch(() => ({})).then(j => { if (!r.ok) { const e = new Error(j.error || 'خطا در ارتباط با سرور'); e.status = r.status; throw e; } return j; }));
}
function staffApi(path, body) {
  return adminFetch(path, body, adminAuth()).catch(e => {
    if (e.status === 401 && STAFF) { staffLogout(); lockShow('lockStaff'); document.getElementById('staffErr').textContent = e.message; }
    throw e;
  });
}

/* ── ورود و خروج همکار ── */
async function staffLogin() {
  const err = document.getElementById('staffErr'), btn = document.getElementById('staffBtn');
  const user = nidDigits(document.getElementById('staffUser').value), pass = document.getElementById('staffPass').value;
  err.textContent = '';
  if (!user || !pass) { err.textContent = 'کد ملی و رمز را بنویسید.'; return; }
  if (!nidValid(user)) { err.textContent = 'کد ملی را درست و کامل (۱۰ رقم) بنویسید.'; return; }
  btn.disabled = true; btn.textContent = '... در حال ورود';
  try {
    const r = await adminFetch('/staff/login', { user, key: await staffKey(user, pass) });
    STAFF = { token: r.token, name: r.name, user: r.user, perms: new Set(r.perms), mustChange: r.mustChange };
    staffSave();
    document.getElementById('staffPass').value = '';
    staffResume();
  } catch (e) { err.textContent = e.message; }
  finally { btn.disabled = false; btn.textContent = 'ورود'; }
}
function staffSave() {
  try { localStorage.setItem(STAFF_KEY, JSON.stringify({ ...STAFF, perms: [...STAFF.perms] })); } catch (e) {}
}
function staffLogout() {
  if (STAFF) adminFetch('/staff/logout', {}, 'staff ' + STAFF.token).catch(() => {});
  STAFF = null;
  try { localStorage.removeItem(STAFF_KEY); } catch (e) {}
  const st = document.getElementById('staff-perm-css');
  if (st) st.remove();
  const pb = document.getElementById('staffPassBtn');
  if (pb) pb.style.display = 'none';
}
async function staffResume() {
  lockShow('lockLoading');
  try {
    await loadPerms();
    const me = await staffApi('/staff/me');
    STAFF.name = me.name; STAFF.perms = new Set(me.perms); STAFF.mustChange = me.mustChange; staffSave();
  } catch (e) {
    if (!STAFF) return;
    showToast('⚠️ ارتباط با سرور برقرار نشد — اینترنت را بررسی کنید');
  }
  applyStaffPerms();
  if (STAFF.mustChange) { staffChangeOpen(true); return; }
  syncLatestData();
}

/* ── فراموشی و تغییر رمز همکار ── */
async function staffForgot() {
  const err = document.getElementById('forgotErr'), ok = document.getElementById('forgotOk'), btn = document.getElementById('forgotBtn');
  const user = nidDigits(document.getElementById('forgotUser').value);
  err.textContent = ''; ok.style.display = 'none';
  if (!nidValid(user)) { err.textContent = 'کد ملی را درست و کامل (۱۰ رقم) بنویسید.'; return; }
  btn.disabled = true;
  try {
    await adminFetch('/staff/forgot', { user });
    ok.innerHTML = '✅ درخواست ثبت شد. به مدیر خبر دهید تا در «👥 کاربران» برایتان رمز موقت بسازد و آن را به شما بدهد.';
    ok.style.display = 'block';
  } catch (e) { err.textContent = e.message; }
  finally { btn.disabled = false; }
}
function staffChangeOpen(forced) {
  ['chOld', 'chNew', 'chNew2'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('changeErr').textContent = '';
  document.getElementById('changeWhy').textContent = forced ? 'رمزی که با آن وارد شدید موقت است. برای ادامه، یک رمز تازه که فقط خودتان می‌دانید بگذارید.' : 'رمز فعلی و رمز تازه را بنویسید.';
  document.getElementById('changeCancel').style.display = forced ? 'none' : '';
  lockShow('lockChange');
}
async function staffChangePass() {
  const v = id => document.getElementById(id).value, err = document.getElementById('changeErr'), btn = document.getElementById('changeBtn');
  err.textContent = '';
  if (v('chNew').length < 8) { err.textContent = 'رمز تازه حداقل ۸ حرف باشد.'; return; }
  if (v('chNew') !== v('chNew2')) { err.textContent = 'رمز تازه و تکرارش یکی نیستند.'; return; }
  btn.disabled = true; btn.textContent = '... در حال ذخیره';
  try {
    await staffApi('/staff/password', { old: await staffKey(STAFF.user, v('chOld')), key: await staffKey(STAFF.user, v('chNew')) });
    const was = STAFF.mustChange;
    STAFF.mustChange = false; staffSave();
    showToast('رمز تازه ذخیره شد ✅');
    if (was) syncLatestData(); else lockHide();
  } catch (e) { err.textContent = e.message; }
  finally { btn.disabled = false; btn.textContent = 'ذخیره رمز تازه'; }
}

/* فقط بخش‌های مجاز نمایش داده می‌شود (بقیه را سرور هم قبول نمی‌کند) */
function applyStaffPerms() {
  const P = STAFF.perms, has = k => P.has(k);
  const css = permKeys().filter(k => !has(k)).map(k => `[data-perm="${k}"]`).concat('[data-perm="owner"]');
  STAFF_CITIES.forEach(c => { if (!['info', 'map', 'hqBanner'].some(k => has(`city.${c}.${k}`))) css.push('#citymeta-' + c); });
  let st = document.getElementById('staff-perm-css');
  if (!st) { st = document.createElement('style'); st.id = 'staff-perm-css'; document.head.appendChild(st); }
  st.textContent = css.join(',') + '{display:none!important}';

  const GEN = ['notices', 'rate', 'bale', 'layout', 'title', 'icon', 'banner', 'footer', 'insurance', 'transport', 'emergency'];
  const tabOk = id => id === 'general' ? GEN.some(has) : STAFF_CITIES.includes(id) ? [...P].some(k => k.startsWith(`city.${id}.`)) : id === 'users' ? false : has(id);
  let first = null;
  document.querySelectorAll('.tab-btn').forEach(b => {
    const id = ((b.getAttribute('onclick') || '').match(/switchTab\('(\w+)'/) || [])[1];
    const ok = tabOk(id);
    b.style.display = ok ? '' : 'none';
    if (ok && !first) first = b;
  });
  document.querySelectorAll('.grp-bar button').forEach(b => {
    b.style.display = [...document.querySelectorAll(`#tab-general [data-grp="${b.dataset.g}"][data-perm]`)].some(c => has(c.dataset.perm)) ? '' : 'none';
  });
  const g = [...document.querySelectorAll('.grp-bar button')].find(b => b.style.display !== 'none');
  if (g && document.querySelector(`.grp-bar button.on`) && document.querySelector('.grp-bar button.on').style.display === 'none') showGrp(g.dataset.g);
  const act = document.querySelector('.tab-btn.active');
  if (first && (!act || act.style.display === 'none')) first.click();
  const sub = document.querySelector('.topbar-sub');
  if (sub) sub.textContent = '👤 ' + STAFF.name + ' (همکار)';
  document.getElementById('staffPassBtn').style.display = '';
  if (!first) showToast('هنوز هیچ دسترسی‌ای به شما داده نشده است. با مدیر تماس بگیرید.');
}

async function staffPublish() {
  const btn = document.getElementById('pubBtn');
  btn.disabled = true; btn.textContent = '... آپلود تصاویر';
  try {
    await uploadPendingPhotos(null);
    btn.textContent = '... در حال انتشار';
    const r = await staffApi('/staff/publish', { data: buildData(false),
      manifest: { name: siteState.appTitle.trim() || DEFAULT_SITE.appTitle, short_name: siteState.iconName.trim() || DEFAULT_SITE.iconName, icons: iconManifestList() } });
    if (!r.changed.length) { adminDirty = false; showToast('در بخش‌های شما تغییری برای انتشار نبود'); return; }
    adminDirty = false;
    showToast('ذخیره شد ✅ — ' + r.changed.join('، '));
    watchDeploy(r.text);
  } catch (e) {
    showToast('❌ ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '🚀 انتشار برای کاربران';
  }
}

/* مدیر اصلی: کلید GitHub برای انتشار همکاران روی سرور ثبت می‌شود (هر بار ورود، اگر عوض شده باشد) */
function ownerRegister() {
  if (!ghToken || sessionStorage.getItem('admin-gh-reg')) return;
  adminFetch('/admin/gh-register', {}, 'token ' + ghToken).then(() => sessionStorage.setItem('admin-gh-reg', '1')).catch(() => {});
}

/* ══════════════════════════════════════════
   تب «👥 کاربران» (فقط مدیر اصلی)
══════════════════════════════════════════ */
let usersList = null, usersErr = '', uEdit = null, uTemp = null;
/* رمز موقت خوانا (بدون حروف شبیه هم مثل l/1 و O/0) */
function tempPass() {
  const A = 'abcdefghjkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(8));
  return [...r].map(x => A[x % A.length]).join('');
}
async function userTempPass(u) {
  const x = usersList.find(y => y.user === u);
  if (!confirm(`برای «${x.name}» رمز موقت ساخته شود؟ رمز قبلی‌اش دیگر کار نمی‌کند.`)) return;
  const pass = tempPass();
  try {
    await adminFetch('/admin/users', { user: x.user, name: x.name, active: !!x.active, perms: x.perms, key: await staffKey(x.user, pass), mustChange: true }, adminAuth());
    uTemp = { user: x.user, name: x.name, pass };
    usersLoad();
  } catch (e) { alert(e.message); }
}
async function usersLoad() {
  usersErr = ''; usersList = null; renderUsers();
  try {
    await loadPerms();
    usersList = (await adminFetch('/admin/users', null, adminAuth())).users;
  } catch (e) { usersErr = e.message; }
  renderUsers();
}
const uCityName = c => (cityMeta[c] && cityMeta[c].name) || DEFAULT_CITY[c] || c;
function uPermLabel(k) {
  const m = k.match(/^city\.(\w+)\.(\w+)$/);
  for (const g of PERMS.groups) for (const it of g.items) {
    if (m && g.perCity && it.k === m[2]) return it.label + ' ' + uCityName(m[1]);
    if (!m && !g.perCity && it.k === k) return it.label;
  }
  return k;
}
function userNew() { uEdit = { isNew: true, user: '', name: '', pass: '', active: true, perms: new Set() }; renderUsers(); }
function userEdit(u) {
  const x = usersList.find(y => y.user === u);
  uEdit = { isNew: false, user: x.user, name: x.name, pass: '', active: !!x.active, perms: new Set(x.perms) };
  renderUsers();
}
/* با نوشتن اولین حرف رمز، گزینه «تغییر رمز در اولین ورود» ظاهر می‌شود */
function uPassIn(el) {
  const toggled = !uEdit.pass !== !el.value;
  uEdit.pass = el.value;
  if (!toggled) return;
  renderUsers();
  const i = document.getElementById('uPass');
  i.focus(); i.setSelectionRange(i.value.length, i.value.length);
}
function uSet(keys, on) { keys.forEach(k => on ? uEdit.perms.add(k) : uEdit.perms.delete(k)); renderUsers(); }
/* چک‌باکس «همه»: تیک (همه)، خالی (هیچ)، نیمه (بعضی) */
function uAllBox(keys, label) {
  const n = keys.filter(k => uEdit.perms.has(k)).length;
  const id = 'ua' + Math.random().toString(36).slice(2, 8);
  setTimeout(() => { const el = document.getElementById(id); if (el) el.indeterminate = n > 0 && n < keys.length; });
  return `<label class="fchk" style="padding:0;font-weight:800"><input type="checkbox" id="${id}" ${n === keys.length ? 'checked' : ''} onchange='uSet(${JSON.stringify(keys)},this.checked)'> ${label}</label>`;
}
function uBox(k, label) {
  return `<label class="fchk" style="padding:2px 0"><input type="checkbox" ${uEdit.perms.has(k) ? 'checked' : ''} onchange="uSet(['${k}'],this.checked)"> ${label}</label>`;
}
function userEditorHTML() {
  const e = uEdit, all = permKeys();
  const groups = PERMS.groups.map(g => {
    if (g.perCity) {
      const cell = (it, c) => it.noSamarra && c === 'samarra' ? '<td style="text-align:center;color:#bbb">—</td>'
        : `<td style="text-align:center"><input type="checkbox" style="width:20px;height:20px" ${e.perms.has(`city.${c}.${it.k}`) ? 'checked' : ''} onchange="uSet(['city.${c}.${it.k}'],this.checked)" aria-label="${escH(it.label)} ${escH(uCityName(c))}"></td>`;
      const colKeys = c => g.items.filter(it => !(it.noSamarra && c === 'samarra')).map(it => `city.${c}.${it.k}`);
      const rowKeys = it => STAFF_CITIES.filter(c => !(it.noSamarra && c === 'samarra')).map(c => `city.${c}.${it.k}`);
      return `<div class="lay-slide"><div style="font-weight:900">🕌 شهرها</div>
        <div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;min-width:520px;font-size:13px">
          <tr><th></th>${STAFF_CITIES.map(c => `<th style="padding:4px">${uAllBox(colKeys(c), escH(uCityName(c)))}</th>`).join('')}</tr>
          ${g.items.map(it => `<tr style="border-top:1px solid #e3ebe6"><td style="padding:4px 0">${uAllBox(rowKeys(it), escH(it.label))}</td>${STAFF_CITIES.map(c => cell(it, c)).join('')}</tr>`).join('')}
        </table></div></div>`;
    }
    const keys = g.items.map(it => it.k);
    return `<div class="lay-slide">${uAllBox(keys, escH(g.label))}
      <div style="display:flex;flex-direction:column;padding-inline-start:22px">${g.items.map(it => uBox(it.k, escH(it.label))).join('')}</div></div>`;
  }).join('');
  return `<div class="sec-card open"><div class="sec-body" style="display:block">
    <h3 style="margin:4px 0 10px">${e.isNew ? '➕ همکار جدید' : '✏️ ویرایش ' + escH(e.name)}</h3>
    <div class="field"><div class="field-label">نام (برای خودتان، مثلاً: علی رضایی — ستاد کربلا)</div>
      <input type="text" class="input-full" value="${escH(e.name)}" oninput="uEdit.name=this.value"></div>
    <div class="field"><div class="field-label">کد ملی همکار (نام کاربری او برای ورود)</div>
      <input type="text" class="input-full" dir="ltr" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="۱۰ رقم" value="${escH(e.user)}" ${e.isNew ? '' : 'disabled'} oninput="uEdit.user=nidHint(this)">
      <div class="nid-hint" style="font-size:12.5px;margin-top:4px"></div></div>
    <div class="field"><div class="field-label">${e.isNew ? 'رمز (حداقل ۸ حرف)' : 'رمز جدید (فقط اگر می‌خواهید عوض شود؛ با عوض شدن رمز، همکار از همه دستگاه‌ها خارج می‌شود)'}</div>
      <input type="text" class="input-full" dir="ltr" autocomplete="off" value="${escH(e.pass)}" id="uPass" oninput="uPassIn(this)"></div>
    ${e.pass ? `<div class="field"><label class="fchk" style="padding:0"><input type="checkbox" ${e.mustChange !== false ? 'checked' : ''} onchange="uEdit.mustChange=this.checked">
      همکار در اولین ورود این رمز را به رمز دلخواه خودش تغییر دهد (پیشنهاد می‌شود)</label></div>` : ''}
    <div class="field"><label class="fchk" style="padding:0"><input type="checkbox" ${e.active ? 'checked' : ''} onchange="uEdit.active=this.checked;renderUsers()">
      <b>${e.active ? '✅ فعال — می‌تواند وارد شود' : '⛔ غیرفعال — نمی‌تواند وارد شود'}</b></label></div>
    <div class="field-label" style="padding:0 16px">دسترسی‌ها — ${e.perms.size.toLocaleString('fa')} از ${all.length.toLocaleString('fa')} مورد</div>
    <div style="display:flex;gap:8px;padding:0 16px;flex-wrap:wrap">
      <button class="add-row-btn" style="margin:0;width:auto;flex:1" onclick='uSet(${JSON.stringify(all)},true)'>همه دسترسی‌ها</button>
      <button class="add-row-btn" style="margin:0;width:auto;flex:1" onclick='uSet(${JSON.stringify(all)},false)'>هیچ دسترسی</button>
    </div>
    <div style="padding:0 16px">${groups}</div>
    <div class="empty-msg" style="padding:4px 16px">همکار فقط بخش‌های تیک‌خورده را در پنل می‌بیند و فقط همان‌ها را می‌تواند منتشر کند. «👥 کاربران»، کلید ثبت‌کننده نرخ و متن data.js فقط برای شماست.</div>
    <div class="lock-err" id="userErr" style="padding:0 16px"></div>
    <div style="display:flex;gap:8px;padding:8px 16px 16px;flex-wrap:wrap">
      <button class="pub-btn" style="flex:2" id="userSaveBtn" onclick="userSave()">💾 ذخیره همکار</button>
      <button class="add-row-btn" style="margin:0;flex:1" onclick="uEdit=null;renderUsers()">انصراف</button>
    </div>
  </div></div>`;
}
function renderUsers() {
  const el = document.getElementById('users-admin');
  if (!el) return;
  if (!ghToken) { el.innerHTML = '<div class="empty-msg">این بخش فقط برای مدیر اصلی است.</div>'; return; }
  const ago = t => t ? new Date(t).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }) : 'هنوز وارد پنل ادمین نشده';
  el.innerHTML = `
  <div class="info-box"><strong>👥 همکاران پنل مدیریت</strong>
    برای هر همکار کد ملی (به‌عنوان نام کاربری) و رمز بگذارید و بخش‌هایی را که اجازه دارد ویرایش کند تیک بزنید — مثلاً فقط «هتل‌های کربلا» یا فقط «اطلاعیه‌ها».
    همکار از همین صفحه (admin.html) با «👥 ورود همکاران» وارد می‌شود. رمز مدیریت شما و کلید GitHub هیچ‌وقت به همکار داده نمی‌شود.</div>
  ${uEdit ? userEditorHTML() : `
  ${ownerCardHTML()}
  ${uTemp ? `<div class="lay-slide" style="border:2px solid #2e8b63;background:#eef8f2">
    <b>🔑 رمز موقت «${escH(uTemp.name)}»</b>
    <div style="font-size:26px;font-weight:900;letter-spacing:3px;direction:ltr;text-align:center;padding:8px;background:#fff;border-radius:10px;user-select:all">${escH(uTemp.pass)}</div>
    <div style="font-size:13px;line-height:1.9">این رمز را به همکار بدهید. او با کد ملی <b dir="ltr">${escH(uTemp.user)}</b> و این رمز وارد می‌شود و برنامه از او می‌خواهد رمز تازه‌ای بگذارد. این رمز فقط همین‌جا نمایش داده می‌شود.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="add-row-btn" style="margin:0;flex:1" onclick="navigator.clipboard.writeText('${escH(uTemp.pass)}').then(()=>showToast('کپی شد 📋'))">📋 کپی رمز</button>
      <button class="add-row-btn" style="margin:0;flex:1" onclick="uTemp=null;renderUsers()">بستن</button>
    </div></div>` : ''}
  <button class="add-row-btn" onclick="userNew()">➕ همکار جدید</button>
  ${usersErr ? `<div class="empty-msg" style="color:var(--red)">${escH(usersErr)}</div>` : !usersList ? '<div class="empty-msg">در حال دریافت…</div>'
    : !usersList.length ? '<div class="empty-msg">هنوز همکاری نساخته‌اید.</div>'
    : `<div class="u-list">${usersList.map(u => userRowHTML(u, ago)).join('')}</div>`}`}`;
}
const U_CSS = `<style>
  .u-list{display:flex;flex-direction:column;gap:6px;margin-top:10px}
  .u-row{border:1px solid #d7e2dc;border-radius:12px;background:#fff;overflow:hidden}
  .u-head{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;flex-wrap:wrap}
  .u-head:hover{background:#f6faf8}
  .u-name{font-weight:900;flex:1;min-width:140px}
  .u-meta{font-size:12px;color:#777}
  .u-pill{font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:99px;white-space:nowrap}
  .u-ok{background:#e3f4ea;color:#1f8a55}.u-warn{background:#fff4e0;color:#8a5a00}.u-bad{background:#fde8e6;color:#c0392b}
  .u-body{border-top:1px solid #e3ebe6;padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:#fbfdfc}
  .u-perms{font-size:12.5px;color:#444;line-height:1.9}
  .u-perms b{color:#1f6f50}
</style>`;
let uOpen = '';
/* خلاصه دسترسی‌ها، گروه به گروه (به‌جای فهرست بلند همه موارد) */
function uPermSummary(perms) {
  const has = new Set(perms), all = permKeys();
  if (all.every(k => has.has(k))) return '<b>همه دسترسی‌ها</b>';
  return PERMS.groups.map(g => {
    if (g.perCity) {
      const rows = g.items.map(it => {
        const cs = STAFF_CITIES.filter(c => !(it.noSamarra && c === 'samarra'));
        const on = cs.filter(c => has.has(`city.${c}.${it.k}`));
        return !on.length ? '' : escH(it.label) + ' (' + (on.length === cs.length ? 'همه شهرها' : on.map(uCityName).map(escH).join('، ')) + ')';
      }).filter(Boolean);
      return rows.length ? `<div><b>${escH(g.label)}:</b> ${rows.join(' · ')}</div>` : '';
    }
    const on = g.items.filter(it => has.has(it.k));
    return on.length ? `<div><b>${escH(g.label)}:</b> ${on.length === g.items.length ? 'همه' : on.map(it => escH(it.label)).join('، ')}</div>` : '';
  }).join('') || '<i>بدون دسترسی</i>';
}
function userRowHTML(u, ago) {
  const open = uOpen === u.user, n = u.perms.length, tot = permKeys().length;
  const pill = !u.active ? '<span class="u-pill u-bad">⛔ غیرفعال</span>' : u.reset_req ? '<span class="u-pill u-warn">🔑 رمز را فراموش کرده</span>'
    : !u.last_login ? '<span class="u-pill u-warn">هنوز وارد نشده</span>' : '<span class="u-pill u-ok">فعال</span>';
  return `<div class="u-row" style="${u.active ? '' : 'opacity:.65'}">
    <div class="u-head" onclick="uOpen=uOpen==='${escH(u.user)}'?'':'${escH(u.user)}';renderUsers()" role="button" aria-expanded="${open}">
      <span class="u-name">👤 ${escH(u.name)}</span>
      ${pill}
      <span class="u-meta">${n === tot ? 'همه دسترسی‌ها' : n.toLocaleString('fa') + ' دسترسی'}</span>
      <span class="u-meta" dir="ltr">${escH(u.user)}</span>
      <span class="u-meta">${open ? '▴' : '▾'}</span>
    </div>
    ${!open ? '' : `<div class="u-body">
      <div class="u-perms">${uPermSummary(u.perms)}</div>
      <div class="u-meta">آخرین ورود به پنل ادمین: ${ago(u.last_login)}${u.must_change ? ' · ⏳ هنوز رمز موقت را عوض نکرده' : ''}</div>
      ${u.reset_req ? `<div style="padding:8px 10px;border-radius:10px;background:#fff4e0;color:#8a5a00;font-size:13px;font-weight:800">🔑 درخواست فراموشی رمز — ${ago(u.reset_req)}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="add-row-btn" style="margin:0;width:auto;flex:1" onclick="userEdit('${escH(u.user)}')">✏️ ویرایش دسترسی‌ها</button>
        <button class="add-row-btn" style="margin:0;width:auto;${u.reset_req ? 'background:#2e8b63;color:#fff' : ''}" onclick="userTempPass('${escH(u.user)}')">🔑 رمز موقت</button>
        <button class="del-btn" style="width:auto;height:auto;min-height:40px;padding:0 12px" onclick="userDelete('${escH(u.user)}')">🗑 حذف</button>
      </div></div>`}
  </div>`;
}

/* ── مدیر اصلی (شما): ورود فقط با «رمز مدیریت»، دسترسی کامل؛ جزو همکاران نیست ── */
let ownerPwOpen = false;
function ownerCardHTML() {
  return U_CSS + `<div class="lay-slide" style="border:2px solid #b7791f;background:#fffaf0">
    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
      <b>👑 مدیر اصلی (شما)</b><span class="u-pill u-ok">دسترسی کامل</span></div>
    <div style="font-size:13px;line-height:1.9;color:#555">با «رمز مدیریت» وارد می‌شود (بدون کد ملی). این حساب فقط دست خودتان باشد؛ برای دیگران «همکار» بسازید.</div>
    ${!ownerPwOpen ? `<button class="add-row-btn" style="margin:0" onclick="ownerPwOpen=true;renderUsers()">🔐 تغییر رمز مدیریت</button>` : `
    <div class="field" style="margin:0"><input type="password" class="input-full" id="opOld" autocomplete="current-password" placeholder="رمز مدیریت فعلی"></div>
    <div class="field" style="margin:0"><input type="password" class="input-full" id="opNew" autocomplete="new-password" placeholder="رمز مدیریت تازه (حداقل ۱۰ حرف)"></div>
    <div class="field" style="margin:0"><input type="password" class="input-full" id="opNew2" autocomplete="new-password" placeholder="تکرار رمز تازه"></div>
    <div class="lock-err" id="opErr"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="pub-btn" style="flex:2" id="opBtn" onclick="ownerChangePass()">ذخیره رمز تازه</button>
      <button class="add-row-btn" style="margin:0;flex:1" onclick="ownerPwOpen=false;renderUsers()">انصراف</button>
    </div>
    <div style="font-size:12.5px;line-height:1.9;color:#8a5a00;background:#fff4e0;border-radius:10px;padding:8px 10px">
      ⚠️ دستگاه‌هایی که قبلاً با رمز مدیریت وارد شده‌اند، با عوض شدن رمز بیرون نمی‌روند. برای بیرون کردن <b>همه</b> آن‌ها باید کلید GitHub را عوض کنید:
      <button class="lock-link" style="display:inline;padding:0" onclick="if(confirm('کلید GitHub تازه می‌سازید؟ بعد از ثبت کلید تازه، کلید قبلی را در GitHub حذف (Delete) کنید تا همه دستگاه‌های دیگر بیرون بروند.'))showSetup()">تنظیم کلید GitHub تازه</button></div>`}
  </div>`;
}
async function ownerChangePass() {
  const v = id => document.getElementById(id).value, err = document.getElementById('opErr'), btn = document.getElementById('opBtn');
  err.textContent = '';
  if (v('opNew').length < 10) { err.textContent = 'رمز تازه حداقل ۱۰ حرف باشد.'; return; }
  if (v('opNew') !== v('opNew2')) { err.textContent = 'رمز تازه و تکرارش یکی نیستند.'; return; }
  btn.disabled = true; btn.textContent = '... در حال ذخیره';
  try {
    /* رمز فعلی را با باز کردن admin-key.json (آخرین نسخه، از GitHub) می‌سنجیم */
    const r = await gh('/contents/' + KEY_FILE + '?ref=main&t=' + Date.now(), ghToken, { cache: 'no-store' });
    if (!r.ok) throw new Error('خواندن کلید از GitHub ناموفق بود (' + r.status + ')');
    const blob = JSON.parse(new TextDecoder().decode(unb64((await r.json()).content.replace(/\s/g, ''))));
    let tok;
    try { tok = await decryptToken(blob, v('opOld')); } catch (e) { throw new Error('رمز مدیریت فعلی اشتباه است.'); }
    await putFile(KEY_FILE, await encryptToken(tok, v('opNew')), 'Update admin key', ghToken);
    ownerPwOpen = false; renderUsers();
    showToast('رمز مدیریت عوض شد ✅ — از این به بعد با رمز تازه وارد شوید');
  } catch (e) { err.textContent = e.message; btn.disabled = false; btn.textContent = 'ذخیره رمز تازه'; }
}
async function userSave() {
  const e = uEdit, err = document.getElementById('userErr'), btn = document.getElementById('userSaveBtn');
  err.textContent = '';
  if (!nidValid(e.user)) { err.textContent = 'کد ملی معتبر نیست. ۱۰ رقم کد ملی همکار را درست بنویسید.'; return; }
  if ((e.isNew || e.pass) && e.pass.length < 8) { err.textContent = 'رمز حداقل ۸ حرف باشد.'; return; }
  btn.disabled = true; btn.textContent = '... در حال ذخیره';
  try {
    await adminFetch('/admin/users', { isNew: e.isNew, user: e.user, name: e.name.trim(), active: e.active, perms: [...e.perms],
      ...(e.pass ? { key: await staffKey(e.user, e.pass), mustChange: e.mustChange !== false } : {}) }, adminAuth());
    showToast(e.pass ? `ذخیره شد ✅ — همکار با کد ملی «${e.user}» و همین رمز وارد می‌شود` : 'ذخیره شد ✅');
    uEdit = null; usersLoad();
  } catch (x) { err.textContent = x.message; btn.disabled = false; btn.textContent = '💾 ذخیره همکار'; }
}
async function userDelete(u) {
  if (!confirm(`همکار «${u}» حذف شود؟ دیگر نمی‌تواند وارد پنل شود.`)) return;
  try { await adminFetch('/admin/users/delete', { user: u }, adminAuth()); showToast('حذف شد'); usersLoad(); }
  catch (e) { alert(e.message); }
}

/* ══════════════════════════════════════════
   CODESPACE — خاموش کردن Codespace (محیط توسعه) با یک دکمه، تا ساعت رایگان GitHub مصرف نشود
   با همان کلید GitHub پنل؛ کلید باید اجازه Codespaces را داشته باشد (اگر نداشت، راهنما نشان داده می‌شود)
══════════════════════════════════════════ */
async function csApi(path, opts = {}) {
  return fetch('https://api.github.com' + path, { ...opts, headers: { 'Authorization': 'Bearer ' + ghToken, 'Accept': 'application/vnd.github+json', ...(opts.headers || {}) } });
}
function csHelp() {
  const fine = String(ghToken || '').startsWith('github_pat_');
  return `<div style="font-size:13px;line-height:2;text-align:right">برای اینکه این دکمه کار کند، یک بار به کلید GitHub پنل اجازه Codespace بدهید:<br>
    ${fine ? `۱. این صفحه را باز کنید: <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">github.com/settings/personal-access-tokens</a><br>
    ۲. روی کلید پنل بزنید ← <b>Edit</b><br>
    ۳. در <b>Repository permissions</b>: <b>Codespaces</b> = Read-only و <b>Codespaces lifecycle admin</b> = Read and write<br>
    ۴. پایین صفحه <b>Update</b> را بزنید و دوباره این دکمه را امتحان کنید.`
    : `۱. این صفحه را باز کنید: <a href="https://github.com/settings/tokens" target="_blank" rel="noopener">github.com/settings/tokens</a><br>
    ۲. روی کلید پنل بزنید، تیک <b>codespace</b> را بزنید و <b>Update token</b> را بزنید.<br>
    ۳. دوباره این دکمه را امتحان کنید.`}<br>
    راه دستی: <a href="https://github.com/codespaces" target="_blank" rel="noopener">github.com/codespaces</a> ← سه‌نقطه کنار Codespace ← <b>Stop codespace</b></div>`;
}
function csDialog(html) {
  let d = document.getElementById('csDlg');
  if (!d) {
    document.body.insertAdjacentHTML('beforeend', `<div id="csDlg" style="position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px">
      <div style="background:#fff;color:#222;border-radius:16px;max-width:460px;width:100%;padding:18px;max-height:90vh;overflow:auto">
      <b style="font-size:16px">💻 Codespace (محیط توسعه)</b><div id="csBody" style="margin-top:10px"></div>
      <button class="add-row-btn" style="margin:12px 0 0;width:100%" onclick="document.getElementById('csDlg').remove()">بستن</button></div></div>`);
  }
  document.getElementById('csBody').innerHTML = html;
}
/* ── ساعت‌های رایگان Codespace در این ماه (API صورت‌حساب GitHub؛ کلید پنل باید اجازه‌ی «Plan» داشته باشد) ──
   سهم رایگان ماهانه بر حسب «ساعت هسته» است: حساب رایگان ۱۲۰، Pro ۱۸۰ (یک ساعت کار با دستگاه ۲ هسته‌ای = ۲ ساعت هسته)؛ فضا ۱۵ / ۲۰ گیگ‌ماه. اول هر ماه (UTC) صفر می‌شود. */
const CS_FREE = { free: [120, 15], pro: [180, 20] };
let csUse = null;
async function csUsage(force) {
  if (csUse && !force && Date.now() - csUse.at < 5 * 60e3) return csUse;
  const me = await (await csApi('/user')).json();
  const plan = String(me.plan && me.plan.name || '').toLowerCase(), [incl, inclGb] = CS_FREE[plan] || CS_FREE.free;
  const now = new Date(), y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  let items = null, denied = false;
  for (const path of [`/users/${me.login}/settings/billing/usage/summary?year=${y}&month=${m}&product=codespaces`, `/users/${me.login}/settings/billing/usage?year=${y}&month=${m}`]) {
    const r = await csApi(path);
    if (r.status === 401 || r.status === 403 || r.status === 404) { denied = true; continue; }
    if (!r.ok) continue;
    items = ((await r.json()).usageItems || []).filter(i => /codespace/i.test(i.product || '') && (!i.date || String(i.date).startsWith(`${y}-${String(m).padStart(2, '0')}`)));
    break;
  }
  if (!items) return csUse = { denied, at: Date.now() };
  let core = 0, gb = 0, paid = 0;
  for (const i of items) {
    const q = +(i.grossQuantity ?? i.quantity ?? 0), sku = String(i.sku || '') + ' ' + String(i.unitType || '');
    paid += +(i.netAmount || 0);
    if (/storage|gb/i.test(sku)) gb += q;
    else { const c = /(\d+)\s*-?\s*core/i.exec(sku); core += q * (c ? +c[1] : 2); }
  }
  const reset = new Date(Date.UTC(y, m, 1)), days = Math.ceil((reset - now) / 864e5);
  return csUse = { at: Date.now(), plan: plan || 'free', incl, inclGb, core, gb, paid, left: Math.max(0, incl - core), days };
}
const csN = (n, d = 0) => (+n).toLocaleString('fa', { maximumFractionDigits: d });
function csUsageHTML(u) {
  if (!u) return '';
  if (u.denied || u.core == null) return `<div style="font-size:13px;line-height:2;background:#FBF3D6;border-radius:12px;padding:10px 12px;margin-bottom:10px"><b>⏱️ ساعت‌های باقی‌مانده دیده نشد.</b><br>
    برای دیدنش یک بار به کلید GitHub پنل اجازه‌ی «Plan» بدهید:<br>
    ${String(ghToken || '').startsWith('github_pat_') ? `۱. <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener">github.com/settings/personal-access-tokens</a> ← روی کلید پنل ← <b>Edit</b><br>۲. در بخش Permissions تب <b>Account</b> را بزنید ← <b>+ Add permissions</b> ← <b>Plan</b> را انتخاب کنید<br>۳. کنار Plan را روی <b>Read-only</b> بگذارید ← پایین صفحه <b>Update</b>`
      : `۱. <a href="https://github.com/settings/tokens" target="_blank" rel="noopener">github.com/settings/tokens</a> ← روی کلید پنل ← تیک <b>user</b> (یا read:user) ← <b>Update token</b>`}<br>
    راه دستی: <a href="https://github.com/settings/billing/usage" target="_blank" rel="noopener">github.com/settings/billing/usage</a></div>`;
  const pct = Math.min(100, u.core / u.incl * 100), col = u.left < u.incl * .15 ? '#B3261E' : u.left < u.incl * .4 ? '#B25B12' : '#1E7D4F';
  return `<div style="border:1px solid #e5dccb;border-radius:12px;padding:12px;margin-bottom:12px;font-size:13px;line-height:2">
    <b style="font-size:15px">⏱️ ساعت‌های رایگان این ماه</b>
    <div style="font-size:26px;font-weight:800;color:${col};margin-top:4px">${csN(u.left, 1)} <span style="font-size:14px">ساعت هسته مانده</span></div>
    <div>یعنی حدود <b>${csN(u.left / 2, 1)} ساعت</b> کار با Codespace معمولی (۲ هسته‌ای)</div>
    <div style="height:10px;border-radius:6px;background:#eee;overflow:hidden;margin:6px 0"><i style="display:block;height:100%;width:${pct}%;background:${col}"></i></div>
    <div>مصرف‌شده: ${csN(u.core, 1)} از ${csN(u.incl)} ساعت هسته${u.plan === 'pro' ? ' (حساب Pro)' : ''} · فضای ذخیره: ${csN(u.gb, 1)} از ${csN(u.inclGb)} گیگ‌ماه</div>
    <div>${csN(u.days)} روز دیگر (اول ماه میلادی) دوباره پر می‌شود.</div>
    ${u.paid > 0.009 ? `<div style="color:#B3261E"><b>⚠️ این ماه ${csN(u.paid, 2)} دلار هزینه‌ی اضافه ثبت شده است.</b></div>` : ''}
    <div style="color:#777;font-size:12px">عدد GitHub ممکن است تا چند ساعت عقب‌تر از مصرف واقعی باشد.</div></div>`;
}
/* برچسب دکمه‌ی بالای پنل: «⏻ Codespace · ۴۲ ساعت مانده» */
async function csBadge() {
  const b = document.querySelector('[onclick="csOpen()"]');
  if (!b || STAFF || !ghToken) return;
  try { const u = await csUsage(); if (u.core != null) { b.textContent = `⏻ Codespace · ${csN(u.left / 2)} ساعت مانده`; b.title = `${csN(u.left, 1)} ساعت هسته از ${csN(u.incl)} ساعت رایگان این ماه مانده (حدود ${csN(u.left / 2, 1)} ساعت با دستگاه ۲ هسته‌ای) — برای جزئیات یا خاموش کردن بزنید`; if (u.left < u.incl * .15) b.style.color = '#B3261E'; } } catch (e) {}
}
const CS_STATE = { Available: '🟢 روشن', Starting: '🟡 در حال روشن شدن', ShuttingDown: '🟠 در حال خاموش شدن', Shutdown: '⚪ خاموش', Rebuilding: '🟡 در حال ساخت' };
async function csOpen() {
  if (STAFF || !ghToken) return showToast('این کار فقط برای مدیر اصلی است');
  csDialog('در حال بررسی…');
  let use = ''; try { use = csUsageHTML(await csUsage(true)); csBadge(); } catch (e) {}
  try {
    /* کلید بدون اجازه Codespaces گاهی خطا نمی‌دهد و فقط فهرست خالی برمی‌گرداند؛ پس هر دو مسیر امتحان می‌شود */
    let list = [], denied = false;
    for (const path of [`/repos/${GH.owner}/${GH.repo}/codespaces`, '/user/codespaces']) {
      const r = await csApi(path);
      if (r.status === 401 || r.status === 403 || r.status === 404) { denied = true; continue; }
      if (!r.ok) continue;
      list = (await r.json()).codespaces || [];
      if (list.length) break;
    }
    if (!list.length) return csDialog(use + `<div style="font-size:13px;line-height:2;margin-bottom:8px"><b>GitHub هیچ Codespaceی به این کلید نشان نداد.</b>${denied ? '' : ' معمولاً یعنی کلید پنل هنوز اجازه دیدن Codespaceها را ندارد.'}</div>` + csHelp());
    csDialog(use + list.map(c => `<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #eee">
      <div style="flex:1;font-size:13px;line-height:1.8"><b>${escH(c.display_name || c.name)}</b><br>${CS_STATE[c.state] || escH(c.state)}
        ${c.idle_timeout_minutes ? ` · خاموشی خودکار بعد از ${c.idle_timeout_minutes.toLocaleString('fa')} دقیقه بیکاری` : ''}</div>
      ${c.state === 'Available' || c.state === 'Starting' ? `<button class="pub-btn" style="background:#B3261E" onclick="csStop('${escH(c.name)}',this)">⏻ خاموش کن</button>` : ''}
    </div>`).join('') + `<div style="font-size:12px;color:#666;line-height:1.9;margin-top:8px">خاموش کردن چیزی را پاک نمی‌کند؛ هر وقت لازم شد از github.com/codespaces دوباره روشنش کنید. اگر الان با Claude در حال کار هستید، آن کار قطع می‌شود.</div>`);
  } catch (e) { csDialog(use + '❌ ' + escH(e.message) + '<br><br>' + csHelp()); }
}
async function csStop(name, btn) {
  if (!confirm('Codespace خاموش شود؟ اگر کار توسعه‌ای در جریان است، قطع می‌شود.')) return;
  btn.disabled = true; btn.textContent = '... در حال خاموش کردن';
  try {
    const r = await csApi('/user/codespaces/' + encodeURIComponent(name) + '/stop', { method: 'POST' });
    if (r.status === 401 || r.status === 403 || r.status === 404) return csDialog(csHelp());
    if (!r.ok) throw new Error('پاسخ GitHub: ' + r.status);
    btn.outerHTML = '<b style="color:#0E5A44">✅ خاموش شد</b>';
    showToast('✅ Codespace خاموش شد — ساعت شما دیگر مصرف نمی‌شود');
  } catch (e) { btn.disabled = false; btn.textContent = '⏻ خاموش کن'; showToast('❌ ' + e.message); }
}
