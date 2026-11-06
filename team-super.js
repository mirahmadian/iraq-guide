'use strict';
(() => {
/* مدیر سامانه: همه‌ی مناطق، مدیران منطقه و همه‌ی کاربرانی که ساخته‌اند */
let app;
const U = { me: null, tab: 'regions', O: null, users: null, region: 0, temp: null };
const TABS = [['regions', '🗺️ مناطق'], ['users', '👥 همه‌ی کاربران'], ['account', '🔐 حساب من']];
const tabs = () => U.me.owner ? TABS.filter(t => t[0] !== 'account') : TABS;

window.startSuper = me => { app = document.getElementById('app'); U.me = me; HR.viewRegion = 0; shell(); go(U.tab); };
function shell() {
  app.innerHTML = `<header class="top"><div class="in"><div class="brand"><a class="btn small ghost" href="${U.me.owner ? 'admin.html' : './'}" style="text-decoration:none">${U.me.owner ? '→ پنل مدیریت' : '→ برنامه'}</a><div><h1>مدیر سامانه · پایش خدمات هتل‌ها</h1><p>${esc(U.me.name)}</p></div><button class="btn small ghost" data-logout title="خروج از این حساب، برای ورود با حساب دیگر">🚪 خروج</button></div>
    <nav class="tabs" role="tablist">${tabs().map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="false">${l}</button>`).join('')}</nav></div></header><main class="wrap" id="main"></main>`;
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
}
const main = () => document.getElementById('main');
function go(tab) {
  U.tab = tab;
  app.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  main().innerHTML = '<div class="empty"><span class="spin"></span>در حال بارگذاری…</div>';
  ({ regions: loadRegions, users: loadUsers, account: () => renderAccount(main(), U.me, () => go('regions')) })[tab]();
}
const roleName = r => r === 'region' ? 'مدیر منطقه' : r === 'fm' ? 'مدیر ثابت' : r === 'super' ? 'مدیر سامانه' : r;
/* «هنوز وارد نشده» از روی زمان آخرین ورود (مدیر ثابت رمز موقتش را لازم نیست عوض کند، پس رمز موقت نشانه ورود نکردن نیست) */
const statusPill = u => !u.active ? '<span class="pill bad">غیرفعال</span>' : !u.last_login ? '<span class="pill warn">هنوز وارد نشده</span>' : '<span class="pill ok">فعال</span>';
function tempHTML(list) {
  return `<div class="card temp-pw"><div class="card-h"><h2>رمز ساخته شد</h2><button class="btn small ghost" id="tmp-x">بستن</button></div>
    <p class="hint">این رمز فقط همین یک بار نشان داده می‌شود. رمز «موقت» با اولین ورود باید عوض شود.</p>
    <div class="tbl-wrap"><table><thead><tr><th>نام</th><th>کد ملی (نام کاربری)</th><th>رمز</th></tr></thead><tbody>${list.map(c => `<tr><td>${esc(c.name)}</td><td class="num">${faS(c.nid)}</td><td><b dir="ltr" style="font-family:monospace;font-size:16px;letter-spacing:1px">${esc(c.password)}</b> <button type="button" class="btn small ghost" data-copy="${esc(c.password)}">📋 کپی</button>${c.temporary ? ' <span class="dim">(موقت)</span>' : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
}
const wireTemp = m => { const x = m.querySelector('#tmp-x'); if (x) x.onclick = () => { U.temp = null; go(U.tab); }; };

/* ═════════ regions ═════════ */
async function loadRegions() { try { U.O = await api('/api/super/overview'); } catch (e) { return toast(e.message, true); } if (U.tab === 'regions') renderRegions(); }
function renderRegions() {
  const m = main(), R = U.O.regions;
  const tot = k => R.reduce((a, r) => a + (r[k] || 0), 0);
  m.innerHTML = `${U.temp ? tempHTML(U.temp) : ''}
    <div class="kpis">
      <div class="kpi"><span class="v num">${fa(R.length)}</span><span class="k">منطقه</span></div>
      <div class="kpi"><span class="v num">${fa(R.reduce((a, r) => a + r.managers.length, 0))}</span><span class="k">مدیر منطقه</span></div>
      <div class="kpi"><span class="v num">${fa(tot('fm'))}</span><span class="k">مدیر ثابت (${fa(tot('fm_active'))} فعال)</span></div>
      <div class="kpi"><span class="v num">${fa(tot('reports'))}</span><span class="k">گزارش ثبت‌شده</span></div>
      <div class="kpi"><span class="v num">${fa(tot('defects'))}</span><span class="k">نقص ثبت‌شده</span></div>
    </div>
    ${R.map(r => `<div class="card"><div class="card-h"><h2>🗺️ ${esc(r.name)}</h2><div class="row"><button class="btn small" data-open="${r.id}">ورود به پنل این منطقه</button><button class="btn small ghost" data-users="${r.id}">کاربران</button></div></div>
      <div class="row" style="gap:6px 18px;font-size:13px"><span>مدیر ثابت: <b class="num">${fa(r.fm)}</b> <span class="dim">(${fa(r.fm_active)} فعال · ${fa(r.fm_by_region)} نفر را مدیر منطقه ساخته)</span></span>
        <span>هفته‌ی واردشده: <b class="num">${fa(r.weeks)}</b></span><span>گزارش: <b class="num">${fa(r.reports)}</b></span><span>نقص: <b class="num">${fa(r.defects)}</b></span>
        <span class="dim">آخرین گزارش: ${r.last_report ? fmtTs(r.last_report) : '—'}</span></div>
      <div class="tbl-wrap"><table><thead><tr><th>مدیر منطقه</th><th>کد ملی</th><th>وضعیت</th><th>آخرین ورود</th></tr></thead><tbody>
        ${r.managers.map(x => `<tr><td><b>${esc(x.name)}</b></td><td class="num">${faS(x.nid)}</td><td>${statusPill(x)}</td><td class="dim">${x.last_login ? fmtTs(x.last_login) : '—'}</td></tr>`).join('') || '<tr><td colspan="4" class="dim">هنوز مدیر منطقه ندارد.</td></tr>'}</tbody></table></div>
      <div class="row"><input class="inp" style="max-width:260px" data-rname="${r.id}" value="${esc(r.name)}" maxlength="80" aria-label="نام منطقه"><button class="btn small ghost" data-rsave="${r.id}">تغییر نام</button></div></div>`).join('')}
    <form class="card" id="nr" novalidate><div class="card-h"><h2>➕ منطقه‌ی جدید</h2></div>
      <div class="row" style="align-items:flex-end"><div class="field" style="flex:1 1 220px"><label class="label" for="nr-name">نام منطقه</label><input id="nr-name" maxlength="80" placeholder="مثلاً نجف اشرف"></div><button class="btn" type="submit">ساختن</button></div><span class="err" id="nr-err"></span></form>
    ${newUserForm(R, 'region')}`;
  wireTemp(m);
  m.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const r = R.find(x => x.id === +b.dataset.open); startRegion(U.me, { region: r.id, regionName: r.name, onBack: () => startSuper(U.me) }); });
  m.querySelectorAll('[data-users]').forEach(b => b.onclick = () => { U.region = +b.dataset.users; go('users'); });
  m.querySelectorAll('[data-rsave]').forEach(b => b.onclick = async () => { try { await api('/api/super/regions/' + b.dataset.rsave, { body: { name: m.querySelector(`[data-rname="${b.dataset.rsave}"]`).value } }); toast('ذخیره شد.'); loadRegions(); } catch (e) { toast(e.message, true); } });
  m.querySelector('#nr').onsubmit = async e => { e.preventDefault(); try { await api('/api/super/regions', { body: { name: m.querySelector('#nr-name').value } }); toast('منطقه ساخته شد.'); loadRegions(); } catch (x) { m.querySelector('#nr-err').textContent = x.message; } };
  wireNewUser(m);
}
function newUserForm(R, role) {
  return `<form class="card" id="nu" novalidate><div class="card-h"><h2>➕ کاربر جدید</h2></div>
    <div class="row" style="align-items:flex-end">
      <div class="field" style="flex:1 1 140px"><label class="label" for="nu-role">نقش</label><select id="nu-role"><option value="region" ${role === 'region' ? 'selected' : ''}>مدیر منطقه</option><option value="fm" ${role === 'fm' ? 'selected' : ''}>مدیر ثابت</option><option value="super">مدیر سامانه (همه‌ی مناطق)</option></select></div>
      <div class="field" style="flex:1 1 160px"><label class="label" for="nu-region">منطقه</label><select id="nu-region">${R.map(r => `<option value="${r.id}" ${U.region === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
      <div class="field" style="flex:1 1 200px"><label class="label" for="nu-name">نام و نام خانوادگی</label><input id="nu-name" maxlength="80"></div>
      <div class="field" style="flex:1 1 150px"><label class="label" for="nu-nid">کد ملی</label><input id="nu-nid" inputmode="numeric" maxlength="12"></div>
      <div class="field" style="flex:1 1 150px"><label class="label" for="nu-pw">رمز (خالی = موقت)</label><input id="nu-pw" maxlength="60" autocomplete="new-password"></div>
      <button class="btn" type="submit">ساختن</button></div><span class="err" id="nu-err"></span></form>`;
}
function wireNewUser(m) {
  const f = m.querySelector('#nu'); if (!f) return;
  f.onsubmit = async e => { e.preventDefault(); const err = m.querySelector('#nu-err'), sb = f.querySelector('[type=submit]'); err.textContent = '';
    if (sb.disabled) return; sb.disabled = true;
    try { U.temp = [await api('/api/super/users', { body: { role: m.querySelector('#nu-role').value, region_id: +m.querySelector('#nu-region').value, name: m.querySelector('#nu-name').value, nid: m.querySelector('#nu-nid').value, password: m.querySelector('#nu-pw').value } })]; go(U.tab); }
    catch (x) { sb.disabled = false; err.textContent = x.message; } };
}

/* ═════════ all users ═════════ */
async function loadUsers() {
  try { if (!U.O) U.O = await api('/api/super/overview'); U.users = await api('/api/super/users' + (U.region ? '?region=' + U.region : '')); } catch (e) { return toast(e.message, true); }
  if (U.tab !== 'users') return;
  renderUsers();
}
/* ردیف ویرایش یک کاربر: نام، کد ملی (نام کاربری)، منطقه و شیت */
function editRowHTML(x, R) {
  const sup = x.role === 'super';
  return `<tr class="edit-row"><td colspan="10"><div class="row" style="align-items:flex-end">
    <div class="field" style="flex:1 1 200px"><label class="label" for="ed-name">نام و نام خانوادگی</label><input id="ed-name" value="${esc(x.name)}" maxlength="80"></div>
    <div class="field" style="flex:1 1 150px"><label class="label" for="ed-nid">کد ملی (نام کاربری)</label><input id="ed-nid" value="${esc(x.nid)}" inputmode="numeric" maxlength="12" dir="ltr"></div>
    ${sup ? '' : `<div class="field" style="flex:1 1 150px"><label class="label" for="ed-region">منطقه</label><select id="ed-region">${R.map(r => `<option value="${r.id}" ${x.region_id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
    <div class="field" style="flex:1 1 120px"><label class="label" for="ed-sheet">نام شیت در اکسل</label><input id="ed-sheet" value="${esc(x.sheet || '')}" maxlength="60" dir="ltr"></div>`}
    <button class="btn" id="ed-save">ذخیره</button><button class="btn ghost" id="ed-cancel">انصراف</button></div>
    <p class="hint">${roleName(x.role)} · اگر کد ملی را عوض کنید، این نفر از این به بعد با کد ملی تازه وارد می‌شود (رمزش همان قبلی است).</p><span class="err" id="ed-err"></span></td></tr>`;
}
function renderUsers() {
  const m = main(), R = U.O.regions, list = U.users;
  m.innerHTML = `${U.temp ? tempHTML(U.temp) : ''}
    <div class="card"><div class="card-h"><h2>همه‌ی کاربران (${fa(list.length)})</h2>
      <div class="filters"><select id="fr" aria-label="منطقه"><option value="0">همه‌ی مناطق</option>${R.map(r => `<option value="${r.id}" ${U.region === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div></div>
      <p class="hint">«سازنده» نشان می‌دهد هر حساب را چه کسی ساخته است. کسی که گزارش یا پیام ثبت کرده حذف نمی‌شود تا سابقه بماند؛ او را غیرفعال کنید.</p>
      <div class="tbl-wrap"><table><thead><tr><th>نام</th><th>نقش</th><th>منطقه</th><th>کد ملی</th><th>سازنده</th><th>وضعیت</th><th>گزارش</th><th>آخرین ورود</th><th>رمز</th><th></th></tr></thead><tbody>
      ${list.map(x => U.edit === x.id ? editRowHTML(x, R) : `<tr><td><b>${esc(x.name)}</b>${x.sheet ? `<br><span class="dim" dir="ltr">${esc(x.sheet)}</span>` : ''}</td><td>${roleName(x.role)}</td><td>${esc(x.region || '—')}</td><td class="num">${faS(x.nid)}</td>
        <td class="dim">${x.creator ? esc(x.creator) + (x.creator_role === 'region' ? ' (مدیر منطقه)' : '') : 'اکسل یا سامانه'}</td><td>${statusPill(x)}</td><td class="num">${fa(x.reports)}</td><td class="dim">${x.last_login ? fmtTs(x.last_login) : '—'}</td>
        <td><div class="row" style="flex-wrap:nowrap"><input data-pw="${x.id}" placeholder="خالی=تصادفی" style="min-width:110px" autocomplete="new-password"><button class="btn small ghost" data-reset="${x.id}">تعیین</button></div></td>
        <td><div class="row" style="flex-wrap:nowrap"><button class="btn small ghost" data-edit="${x.id}">✏️ ویرایش</button><button class="btn small ${x.active ? 'danger' : 'okb'}" data-act="${x.id}" data-v="${x.active ? 0 : 1}">${x.active ? 'غیرفعال' : 'فعال'}</button>
          ${x.passkeys ? `<button class="btn small ghost" data-pk="${x.id}" title="حذف اثر انگشت‌های ثبت‌شده">☝️ ${fa(x.passkeys)}</button>` : ''}
          ${x.reports ? '' : `<button class="btn small danger" data-del="${x.id}">حذف</button>`}</div></td></tr>`).join('') || '<tr><td colspan="10" class="empty">کاربری نیست.</td></tr>'}</tbody></table></div></div>
    ${newUserForm(R, 'fm')}`;
  wireTemp(m); wireNewUser(m);
  m.querySelector('#fr').onchange = e => { U.region = +e.target.value; loadUsers(); };
  const sure = b => { if (b.dataset.sure === '1') return true; b.dataset.sure = '1'; b.textContent = 'مطمئنید؟'; return false; };
  m.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { U.edit = +b.dataset.edit; renderUsers(); const i = m.querySelector('#ed-name'); if (i) i.focus(); });
  const ec = m.querySelector('#ed-cancel'); if (ec) ec.onclick = () => { U.edit = 0; renderUsers(); };
  const es = m.querySelector('#ed-save'); if (es) es.onclick = async () => {
    const x = list.find(u => u.id === U.edit), err = m.querySelector('#ed-err'), body = { name: m.querySelector('#ed-name').value, nid: m.querySelector('#ed-nid').value };
    if (x.role !== 'super') { body.region_id = +m.querySelector('#ed-region').value; body.sheet = m.querySelector('#ed-sheet').value; }
    es.disabled = true; err.textContent = '';
    try {
      const r = await api(`/api/super/users/${x.id}/edit`, { body });
      U.edit = 0; U.O = null;
      toast(r.entries !== undefined && body.sheet && body.sheet.trim() ? (r.entries ? `ذخیره شد؛ ${fa(r.entries)} ورودی به او سپرده شد.` : `ذخیره شد، ولی در اکسل‌های واردشده شیتی به نام «${body.sheet.trim()}» پیدا نشد.`) : 'ذخیره شد.', r.entries === 0 && !!(body.sheet || '').trim());
      loadUsers();
    } catch (e) { es.disabled = false; err.textContent = e.message; }
  };
  m.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => { try { await api(`/api/super/users/${b.dataset.act}/active`, { body: { active: b.dataset.v === '1' } }); loadUsers(); } catch (e) { toast(e.message, true); } });
  m.querySelectorAll('[data-reset]').forEach(b => b.onclick = async () => { if (!sure(b)) return; b.disabled = true; try { U.temp = [await api(`/api/super/users/${b.dataset.reset}/reset`, { body: { password: m.querySelector(`[data-pw="${b.dataset.reset}"]`).value } })]; loadUsers(); } catch (e) { b.disabled = false; toast(e.message, true); } });
  m.querySelectorAll('[data-pk]').forEach(b => b.onclick = async () => { if (!sure(b)) return; try { await api(`/api/super/users/${b.dataset.pk}/passkeys`, { body: {} }); loadUsers(); } catch (e) { toast(e.message, true); } });
  m.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!sure(b)) return; try { await api(`/api/super/users/${b.dataset.del}/delete`, { body: {} }); toast('حذف شد.'); loadUsers(); } catch (e) { toast(e.message, true); } });
}
})();
