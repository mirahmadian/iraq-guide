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
    STAFF = { token: r.token, name: r.name, user: r.user, perms: new Set(r.perms) };
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
}
async function staffResume() {
  lockShow('lockLoading');
  try {
    await loadPerms();
    const me = await staffApi('/staff/me');
    STAFF.name = me.name; STAFF.perms = new Set(me.perms); staffSave();
  } catch (e) {
    if (!STAFF) return;
    showToast('⚠️ ارتباط با سرور برقرار نشد — اینترنت را بررسی کنید');
  }
  applyStaffPerms();
  syncLatestData();
}

/* فقط بخش‌های مجاز نمایش داده می‌شود (بقیه را سرور هم قبول نمی‌کند) */
function applyStaffPerms() {
  const P = STAFF.perms, has = k => P.has(k);
  const css = permKeys().filter(k => !has(k)).map(k => `[data-perm="${k}"]`).concat('[data-perm="owner"]');
  STAFF_CITIES.forEach(c => { if (!['info', 'map', 'hqBanner'].some(k => has(`city.${c}.${k}`))) css.push('#citymeta-' + c); });
  let st = document.getElementById('staff-perm-css');
  if (!st) { st = document.createElement('style'); st.id = 'staff-perm-css'; document.head.appendChild(st); }
  st.textContent = css.join(',') + '{display:none!important}';

  const GEN = ['date', 'notices', 'rate', 'layout', 'title', 'icon', 'banner', 'footer', 'insurance', 'transport'];
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
    if (!r.changed.length) { showToast('در بخش‌های شما تغییری برای انتشار نبود'); return; }
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
let usersList = null, usersErr = '', uEdit = null;
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
      <input type="text" class="input-full" dir="ltr" autocomplete="off" value="${escH(e.pass)}" oninput="uEdit.pass=this.value"></div>
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
  const ago = t => t ? new Date(t).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }) : 'هنوز وارد نشده';
  el.innerHTML = `
  <div class="info-box"><strong>👥 همکاران پنل مدیریت</strong>
    برای هر همکار کد ملی (به‌عنوان نام کاربری) و رمز بگذارید و بخش‌هایی را که اجازه دارد ویرایش کند تیک بزنید — مثلاً فقط «هتل‌های کربلا» یا فقط «اطلاعیه‌ها».
    همکار از همین صفحه (admin.html) با «👥 ورود همکاران» وارد می‌شود. رمز مدیریت شما و کلید GitHub هیچ‌وقت به همکار داده نمی‌شود.</div>
  ${uEdit ? userEditorHTML() : `
  <button class="add-row-btn" onclick="userNew()">➕ همکار جدید</button>
  ${usersErr ? `<div class="empty-msg" style="color:var(--red)">${escH(usersErr)}</div>` : !usersList ? '<div class="empty-msg">در حال دریافت…</div>'
    : !usersList.length ? '<div class="empty-msg">هنوز همکاری نساخته‌اید.</div>'
    : usersList.map(u => `<div class="lay-slide" style="${u.active ? '' : 'opacity:.6'}">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${u.active ? '👤' : '⛔'} ${escH(u.name)}</b><span dir="ltr" style="color:#666">🪪 ${escH(u.user)}</span></div>
      <div style="font-size:12.5px;color:#555;line-height:1.9">${u.perms.length ? u.perms.map(k => escH(uPermLabel(k))).join(' · ') : '<i>بدون دسترسی</i>'}</div>
      <div style="font-size:12px;color:#888">آخرین ورود: ${ago(u.last_login)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="add-row-btn" style="margin:0;width:auto;flex:1" onclick="userEdit('${escH(u.user)}')">✏️ ویرایش دسترسی‌ها / رمز</button>
        <button class="del-btn" style="width:auto;height:auto;min-height:40px;padding:0 12px" onclick="userDelete('${escH(u.user)}')">🗑 حذف</button>
      </div></div>`).join('')}`}`;
}
async function userSave() {
  const e = uEdit, err = document.getElementById('userErr'), btn = document.getElementById('userSaveBtn');
  err.textContent = '';
  if (!nidValid(e.user)) { err.textContent = 'کد ملی معتبر نیست. ۱۰ رقم کد ملی همکار را درست بنویسید.'; return; }
  if ((e.isNew || e.pass) && e.pass.length < 8) { err.textContent = 'رمز حداقل ۸ حرف باشد.'; return; }
  btn.disabled = true; btn.textContent = '... در حال ذخیره';
  try {
    await adminFetch('/admin/users', { isNew: e.isNew, user: e.user, name: e.name.trim(), active: e.active, perms: [...e.perms],
      ...(e.pass ? { key: await staffKey(e.user, e.pass) } : {}) }, adminAuth());
    showToast(e.pass ? `ذخیره شد ✅ — همکار با کد ملی «${e.user}» و همین رمز وارد می‌شود` : 'ذخیره شد ✅');
    uEdit = null; usersLoad();
  } catch (x) { err.textContent = x.message; btn.disabled = false; btn.textContent = '💾 ذخیره همکار'; }
}
async function userDelete(u) {
  if (!confirm(`همکار «${u}» حذف شود؟ دیگر نمی‌تواند وارد پنل شود.`)) return;
  try { await adminFetch('/admin/users/delete', { user: u }, adminAuth()); showToast('حذف شد'); usersLoad(); }
  catch (e) { alert(e.message); }
}
