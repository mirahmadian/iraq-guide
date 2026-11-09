'use strict';
(() => {
/* مدیر سامانه: همه‌ی مناطق، مدیران منطقه و همه‌ی کاربرانی که ساخته‌اند */
let app;
const U = { me: null, tab: 'regions', O: null, users: null, region: 0, temp: null };
const TABS = [['regions', '🗺️ مناطق'], ['quality', '⭐ کیفیت هتل‌ها'], ['cos', '🏢 شرکت‌ها'], ['users', '👥 همه‌ی کاربران'], ['account', '🔐 حساب من']];
/* سرپرستی که خودش هم هتل دارد (منطقه و شیت روی حسابش)، تب «هتل‌های من» هم دارد */
const tabs = () => { const T = U.me.owner ? TABS.filter(t => t[0] !== 'account') : TABS.slice(); if (U.me.lead && U.me.region_id) T.splice(T.length - 1, 0, ['mine', '🏨 هتل‌های من']); return T; };

window.startSuper = me => { app = document.getElementById('app'); U.me = me; HR.viewRegion = 0; shell(); go(U.tab); };
function shell() {
  app.innerHTML = `<header class="top"><div class="in"><div class="brand"><a class="btn small ghost" href="${U.me.owner ? 'admin.html' : './'}" style="text-decoration:none">${U.me.owner ? '→ پنل مدیریت' : '→ برنامه'}</a><div><h1>${esc(U.me.lead ? U.me.leadLabel : 'مدیر سامانه')} · پایش خدمات هتل‌ها</h1><p>${esc(U.me.name)}</p></div><button class="btn small ghost" data-logout title="خروج از این حساب، برای ورود با حساب دیگر">🚪 خروج</button></div>
    <nav class="tabs" role="tablist">${tabs().map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="false">${l}</button>`).join('')}</nav></div></header><main class="wrap" id="main"></main>`;
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
}
const main = () => document.getElementById('main');
function go(tab) {
  if (tab === 'mine') { const me = U.me; return startFM(me, { onBack: () => { U.tab = 'regions'; startSuper(me); } }); }
  U.tab = tab;
  app.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  main().innerHTML = '<div class="empty"><span class="spin"></span>در حال بارگذاری…</div>';
  ({ quality: () => loadQuality(), cos: () => loadCompanies(), regions: loadRegions, users: loadUsers, account: () => renderAccount(main(), U.me, () => go('regions')) })[tab]();
}
const leadL = () => (U.O && U.O.leadLabel) || U.me.leadLabel || 'سرپرست مناطق';
const full = () => !U.me.lead;
const roleName = (r, lead) => r === 'region' ? 'مدیر منطقه' : r === 'fm' ? 'مدیر ثابت' : r === 'super' ? (lead ? leadL() : 'مدیر سامانه') : r;
/* نام منطقه همراه شهرش (هر شهر یک یا چند منطقه) */
const regLabel = r => r.city && r.city !== r.name ? `${r.city} · ${r.name}` : r.name;
const regOptions = (R, sel) => [...new Set(R.map(r => r.city || ''))].map(c => `<optgroup label="${esc(c || 'بدون شهر')}">${R.filter(r => (r.city || '') === c).map(r => `<option value="${r.id}" ${sel === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</optgroup>`).join('');
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
/* هر شهر یک رنگ ثابت (در همه‌ی صفحه‌ها یکسان) */
const cityCls = c => 'cc' + Math.max(0, (U.O ? U.O.cities : []).indexOf(c));
const cityTag = c => c ? `<span class="ctag ${cityCls(c)}"><i></i>${esc(c)}</span>` : '<span class="dim">—</span>';
/* نشان نقش: سرپرست طلایی، مدیر منطقه آبی، مدیر ثابت سبز */
const roleTag = (r, lead) => lead ? `<span class="rb lead">⭐ ${esc(leadL())}</span>` : r === 'region' ? '<span class="rb reg">👔 مدیر منطقه</span>' : r === 'fm' ? '<span class="rb fm">🏨 مدیر ثابت</span>' : `<span class="rb sys">${esc(roleName(r, lead))}</span>`;
const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
function personRow(x, extra) {
  return `<li><span class="pn"><b>${esc(x.name)}</b> ${extra || ''}</span><span class="pm">${x.hotels ? `<span class="num">${fa(x.hotels)}</span> هتل` : ''} ${statusPill(x)}</span></li>`;
}
function regionCard(r) {
  const P = r.people || [], mgr = P.filter(x => x.role === 'region'), hot = P.filter(x => x.role === 'fm' || x.sheet);
  const st = r.staff || [], stN = st.reduce((a, x) => a + x.n, 0), stSoon = st.reduce((a, x) => a + x.soon, 0);
  return `<div class="card rg ${cityCls(r.city)}"><div class="card-h"><h2>🗺️ ${esc(r.name)} ${r.city !== r.name ? cityTag(r.city) : ''}</h2>
      <div class="row"><button class="btn small" data-open="${r.id}">ورود به پنل این منطقه ←</button><button class="btn small ghost" data-users="${r.id}">👥 کاربران</button></div></div>
    <div class="rg-stats"><span>هفته‌ی واردشده <b class="num">${fa(r.weeks)}</b></span><span>گزارش <b class="num">${fa(r.reports)}</b></span><span>نقص <b class="num">${fa(r.defects)}</b></span>
      <span class="${r.open ? 'bad' : ''}">نقص باز <b class="num">${fa(r.open || 0)}</b></span><span class="dim">آخرین گزارش: ${r.last_report ? fmtTs(r.last_report) : '—'}</span></div>
    <div class="rg-grid">
      <section class="rg-sec reg"><h3>👔 مدیر منطقه <span class="dim">(${fa(mgr.length)})</span></h3><ul>${mgr.map(x => personRow(x, x.sheet ? '<span class="rb fm sm">+ مدیر ثابت</span>' : '')).join('') || '<li class="dim">هنوز مدیر منطقه ندارد.</li>'}</ul></section>
      <section class="rg-sec fm"><h3>🏨 مدیران ثابت <span class="dim">(${fa(hot.length)})</span></h3><ul>${hot.map(x => personRow(x, x.lead ? `<span class="rb lead sm">⭐ ${esc(leadL())}</span>` : x.role === 'region' ? '<span class="rb reg sm">مدیر منطقه</span>' : '')).join('') || '<li class="dim">هنوز مدیر ثابتی ندارد.</li>'}</ul></section>
      <section class="rg-sec st"><h3>👷 عوامل <span class="dim">(${fa(stN)})</span></h3><ul>${st.map(x => `<li><span class="pn"><b>${esc(x.role)}</b></span><span class="pm"><span class="num">${fa(x.n)}</span> نفر ${x.soon ? `<span class="pill bad">${fa(x.soon)} نزدیک خروج</span>` : ''}</span></li>`).join('') || '<li class="dim">هنوز ثبت نشده (در پنل منطقه، تب «👷 عوامل»).</li>'}</ul>
        ${stSoon ? `<p class="hint" style="color:var(--bad)">⚠️ ${fa(stSoon)} نفر تا ۵ روز دیگر باید از عراق خارج شوند.</p>` : ''}</section>
    </div>
    ${full() ? `<details class="rg-edit"><summary>✏️ تغییر نام یا شهر این منطقه</summary><div class="row"><select class="sel" data-rcity="${r.id}" aria-label="شهر">${U.O.cities.map(x => `<option ${x === r.city ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><input class="inp" style="max-width:220px" data-rname="${r.id}" value="${esc(r.name)}" maxlength="80" aria-label="نام منطقه"><button class="btn small ghost" data-rsave="${r.id}">ذخیره</button></div></details>` : ''}</div>`;
}
function renderRegions() {
  const m = main(), RA = U.O.regions, L = U.O.leads || [];
  const cities = U.O.cities.filter(c => RA.some(r => r.city === c)).concat(RA.some(r => !U.O.cities.includes(r.city)) ? [''] : []);
  if (U.city === undefined) U.city = lsGet('team-city');
  if (U.city && !cities.includes(U.city)) U.city = '';
  const inCity = (r, c) => c === '' ? !U.O.cities.includes(r.city) : r.city === c;
  const R = U.city ? RA.filter(r => inCity(r, U.city)) : RA;
  const tot = k => R.reduce((a, r) => a + (r[k] || 0), 0), cnt = f => R.reduce((a, r) => a + (r.people || []).filter(f).length, 0);
  const openOf = c => RA.filter(r => inCity(r, c)).reduce((a, r) => a + (r.open || 0), 0);
  m.innerHTML = `${U.temp ? tempHTML(U.temp) : ''}
    ${L.length ? `<div class="card leads"><div class="card-h"><h2>⭐ ${esc(leadL())} <span class="dim" style="font-size:12.5px;font-weight:500">(همه‌ی شهرها)</span></h2></div>
      <ul class="lead-list">${L.map(x => `<li><b>${esc(x.name)}</b> ${statusPill(x)}${x.region_id ? ` <span class="dim">· خودش مدیر ثابت در</span> ${cityTag(x.city)} ${x.city !== x.region ? `<span class="dim">${esc(x.region)}</span>` : ''}` : ''}</li>`).join('')}</ul></div>` : ''}
    <nav class="city-tabs" aria-label="شهرها"><button data-city="__all" aria-pressed="${!U.city}">همه‌ی شهرها <span class="n">${fa(RA.length)} منطقه</span></button>
      ${cities.map(c => { const o = openOf(c); return `<button class="${cityCls(c)}" data-city="${esc(c)}" aria-pressed="${U.city === c}"><i></i>${esc(c || 'بدون شهر')} <span class="n">${fa(RA.filter(r => inCity(r, c)).length)} منطقه</span>${o ? `<span class="ob" title="نقص باز">${fa(o)}</span>` : ''}</button>`; }).join('')}</nav>
    <div class="kpis k6">
      <div class="kpi"><span class="v num">${fa(R.length)}</span><span class="k">منطقه</span></div>
      <div class="kpi"><span class="v num">${fa(cnt(x => x.role === 'region'))}</span><span class="k">👔 مدیر منطقه</span></div>
      <div class="kpi"><span class="v num">${fa(cnt(x => x.role === 'fm' || x.sheet))}</span><span class="k">🏨 مدیر ثابت</span></div>
      <div class="kpi"><span class="v num">${fa(R.reduce((a, r) => a + (r.staff || []).reduce((b, x) => b + x.n, 0), 0))}</span><span class="k">👷 عوامل</span></div>
      <div class="kpi"><span class="v num">${fa(tot('reports'))}</span><span class="k">گزارش ثبت‌شده</span></div>
      <div class="kpi"><span class="v num" style="${tot('open') ? 'color:var(--bad)' : ''}">${fa(tot('open'))}</span><span class="k">نقص باز (از ${fa(tot('defects'))})</span></div>
    </div>
    ${(U.city ? [U.city] : cities).map(c => `<h2 class="city-h ${cityCls(c)}"><i></i>🕌 ${esc(c || 'بدون شهر')} <span class="dim" style="font-size:13px;font-weight:500">(${fa(RA.filter(r => inCity(r, c)).length)} منطقه)</span></h2>
      ${RA.filter(r => inCity(r, c)).map(regionCard).join('')}`).join('') || '<div class="empty">هنوز منطقه‌ای ساخته نشده.</div>'}
    <details class="card setx" ${U.setOpen ? 'open' : ''}><summary><h2>⚙️ تنظیمات و افزودن</h2><span class="dim">کاربر جدید${full() ? '، منطقه‌ی جدید، عنوان نقش' : ''}</span></summary>
    ${newUserForm(RA, 'region')}
    ${full() ? `<form class="card" id="nr" novalidate><div class="card-h"><h2>➕ منطقه‌ی جدید</h2></div>
      <div class="row" style="align-items:flex-end"><div class="field" style="flex:1 1 160px"><label class="label" for="nr-city">شهر</label><select id="nr-city">${U.O.cities.map(x => `<option ${x === U.city ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
        <div class="field" style="flex:1 1 220px"><label class="label" for="nr-name">نام منطقه</label><input id="nr-name" maxlength="80" placeholder="مثلاً کربلا ۲ (بین‌الحرمین)"></div><button class="btn" type="submit">ساختن</button></div>
      <p class="hint">هر شهر می‌تواند یک یا چند منطقه داشته باشد. نام منطقه باید یکتا باشد.</p><span class="err" id="nr-err"></span></form>
    <form class="card" id="ll" novalidate><div class="card-h"><h2>🏷️ عنوان نقش «${esc(leadL())}»</h2></div>
      <p class="hint">نقشی یک سطح بالاتر از مدیر منطقه: پنل همه‌ی شهرها و مناطق را می‌بیند (داشبورد، کیفیت، اکسل هفتگی، عوامل) و مدیر منطقه و مدیر ثابت می‌سازد؛ ولی منطقه نمی‌سازد و به حساب شما و هم‌سطح‌هایش دسترسی ندارد.</p>
      <div class="row" style="align-items:flex-end"><div class="field" style="flex:1 1 220px"><label class="label" for="ll-v">عنوان</label><input id="ll-v" maxlength="40" value="${esc(leadL())}"></div><button class="btn ghost" type="submit">ذخیره</button></div></form>` : ''}
    </details>`;
  wireTemp(m);
  m.querySelector('.setx').ontoggle = e => U.setOpen = e.target.open;
  m.querySelectorAll('[data-city]').forEach(b => b.onclick = () => { U.city = b.dataset.city === '__all' ? '' : b.dataset.city; lsSet('team-city', U.city); renderRegions(); });
  m.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const r = RA.find(x => x.id === +b.dataset.open); startRegion(U.me, { region: r.id, regionName: regLabel(r), onBack: () => startSuper(U.me) }); });
  m.querySelectorAll('[data-users]').forEach(b => b.onclick = () => { U.region = +b.dataset.users; go('users'); });
  m.querySelectorAll('[data-rsave]').forEach(b => b.onclick = async () => { try { await api('/api/super/regions/' + b.dataset.rsave, { body: { name: m.querySelector(`[data-rname="${b.dataset.rsave}"]`).value, city: m.querySelector(`[data-rcity="${b.dataset.rsave}"]`).value } }); toast('ذخیره شد.'); loadRegions(); } catch (e) { toast(e.message, true); } });
  const nr = m.querySelector('#nr'); if (nr) nr.onsubmit = async e => { e.preventDefault(); try { await api('/api/super/regions', { body: { city: m.querySelector('#nr-city').value, name: m.querySelector('#nr-name').value } }); toast('منطقه ساخته شد.'); loadRegions(); } catch (x) { m.querySelector('#nr-err').textContent = x.message; } };
  const ll = m.querySelector('#ll'); if (ll) ll.onsubmit = async e => { e.preventDefault(); try { await api('/api/super/cfg', { body: { leadLabel: m.querySelector('#ll-v').value } }); toast('ذخیره شد.'); U.O = null; loadRegions(); } catch (x) { toast(x.message, true); } };
  wireNewUser(m);
}
function newUserForm(R, role) {
  return `<form class="card" id="nu" novalidate><div class="card-h"><h2>➕ کاربر جدید</h2></div>
    <div class="row" style="align-items:flex-end">
      <div class="field" style="flex:1 1 140px"><label class="label" for="nu-role">نقش</label><select id="nu-role"><option value="region" ${role === 'region' ? 'selected' : ''}>مدیر منطقه</option><option value="fm" ${role === 'fm' ? 'selected' : ''}>مدیر ثابت</option>${full() ? `<option value="lead">${esc(leadL())} (همه‌ی شهرها)</option>` : ''}</select></div>
      <div class="field nu-reg" style="flex:1 1 140px"><label class="label" for="nu-city">شهر</label><select id="nu-city">${U.O.cities.filter(c => R.some(r => r.city === c)).map(c => `<option ${(U.region ? (R.find(r => r.id === U.region) || {}).city : U.city || (R[0] || {}).city) === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="field nu-reg" style="flex:1 1 160px"><label class="label" for="nu-region">منطقه</label><select id="nu-region"></select></div>
      <div class="field" style="flex:1 1 200px"><label class="label" for="nu-name">نام و نام خانوادگی</label><input id="nu-name" maxlength="80"></div>
      <div class="field" style="flex:1 1 150px"><label class="label" for="nu-nid">کد ملی</label><input id="nu-nid" inputmode="numeric" maxlength="12"></div>
      <div class="field" style="flex:1 1 150px"><label class="label" for="nu-pw">رمز (خالی = موقت)</label><input id="nu-pw" maxlength="60" autocomplete="new-password"></div>
      <button class="btn" type="submit">ساختن</button></div><span class="err" id="nu-err"></span></form>`;
}
function wireNewUser(m) {
  const f = m.querySelector('#nu'); if (!f) return;
  const R = U.O.regions, role = f.querySelector('#nu-role'), city = f.querySelector('#nu-city'), reg = f.querySelector('#nu-region');
  const fillReg = () => { const L = R.filter(r => r.city === city.value); reg.innerHTML = L.map(r => `<option value="${r.id}" ${U.region === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join(''); };
  const syncRole = () => f.querySelectorAll('.nu-reg').forEach(x => x.hidden = role.value === 'lead');
  city.onchange = fillReg; role.onchange = syncRole; fillReg(); syncRole();
  f.onsubmit = async e => { e.preventDefault(); const err = m.querySelector('#nu-err'), sb = f.querySelector('[type=submit]'); err.textContent = '';
    if (sb.disabled) return; sb.disabled = true;
    try { U.temp = [await api('/api/super/users', { body: { role: m.querySelector('#nu-role').value, region_id: m.querySelector('#nu-role').value === 'lead' ? 0 : +m.querySelector('#nu-region').value, name: m.querySelector('#nu-name').value, nid: m.querySelector('#nu-nid').value, password: m.querySelector('#nu-pw').value } })]; go(U.tab); }
    catch (x) { sb.disabled = false; err.textContent = x.message; } };
}

/* ═════════ hotel quality, every region (team-quality.js) ═════════ */
async function loadCompanies(week) {
  let d; try { d = await api('/api/super/quality' + (week === 'all' ? '?week=all' : '')); } catch (e) { return toast(e.message, true); }
  if (U.tab !== 'cos') return;
  renderCompanies(main(), d, { showRegion: true, weeks: [{ id: 'latest', title: 'آخرین هفته‌ی هر منطقه' }], week: d.week, onWeek: w => { main().innerHTML = '<div class="empty"><span class="spin"></span>در حال بارگذاری…</div>'; loadCompanies(w); } });
}
async function loadQuality(week) {
  let d; try { d = await api('/api/super/quality' + (week === 'all' ? '?week=all' : '')); } catch (e) { return toast(e.message, true); }
  if (U.tab !== 'quality') return;
  renderQuality(main(), d, { showRegion: true, weeks: [{ id: 'latest', title: 'آخرین هفته‌ی هر منطقه' }], week: d.week, onWeek: w => { main().innerHTML = '<div class="empty"><span class="spin"></span>در حال بارگذاری…</div>'; loadQuality(w); } });
}

/* ═════════ all users ═════════ */
async function loadUsers() {
  try { if (!U.O) U.O = await api('/api/super/overview'); U.users = await api('/api/super/users' + (U.region ? '?region=' + U.region : '')); } catch (e) { return toast(e.message, true); }
  if (U.tab !== 'users') return;
  renderUsers();
}
/* ردیف ویرایش یک کاربر: نام، کد ملی (نام کاربری)، منطقه و شیت */
function editRowHTML(x, R) {
  const sup = x.role === 'super' && !x.lead, lead = !!x.lead;
  return `<tr class="edit-row"><td colspan="11"><div class="row" style="align-items:flex-end">
    <div class="field" style="flex:1 1 200px"><label class="label" for="ed-name">نام و نام خانوادگی</label><input id="ed-name" value="${esc(x.name)}" maxlength="80"></div>
    <div class="field" style="flex:1 1 150px"><label class="label" for="ed-nid">کد ملی (نام کاربری)</label><input id="ed-nid" value="${esc(x.nid)}" inputmode="numeric" maxlength="12" dir="ltr"></div>
    ${sup ? '' : `<div class="field" style="flex:1 1 150px"><label class="label" for="ed-region">${lead ? 'منطقه‌ی هتل‌های خودش (اختیاری)' : 'منطقه'}</label><select id="ed-region">${lead ? '<option value="0">— ندارد —</option>' : ''}${regOptions(R, x.region_id)}</select></div>
    <div class="field" style="flex:1 1 120px"><label class="label" for="ed-sheet">نام شیت در اکسل</label><input id="ed-sheet" value="${esc(x.sheet || '')}" maxlength="60" dir="ltr"></div>`}
    <button class="btn" id="ed-save">ذخیره</button><button class="btn ghost" id="ed-cancel">انصراف</button></div>
    <p class="hint">${roleName(x.role, x.lead)} · اگر کد ملی را عوض کنید، این نفر از این به بعد با کد ملی تازه وارد می‌شود (رمزش همان قبلی است).</p><span class="err" id="ed-err"></span></td></tr>`;
}
function renderUsers() {
  const m = main(), R = U.O.regions, list = U.users;
  m.innerHTML = `${U.temp ? tempHTML(U.temp) : ''}
    <div class="card"><div class="card-h"><h2>همه‌ی کاربران (${fa(list.length)})</h2>
      <div class="filters"><select id="fr" aria-label="منطقه"><option value="0">همه‌ی شهرها و مناطق</option>${regOptions(R, U.region)}</select></div></div>
      <p class="hint">«سازنده» نشان می‌دهد هر حساب را چه کسی ساخته است. کسی که گزارش یا پیام ثبت کرده حذف نمی‌شود تا سابقه بماند؛ او را غیرفعال کنید.</p>
      <div class="tbl-wrap"><table><thead><tr><th>نام</th><th>نقش</th><th>شهر</th><th>منطقه</th><th>کد ملی</th><th>سازنده</th><th>وضعیت</th><th>گزارش</th><th>آخرین ورود</th><th>رمز</th><th></th></tr></thead><tbody>
      ${list.map(x => U.edit === x.id ? editRowHTML(x, R) : `<tr><td><b>${esc(x.name)}</b>${x.sheet ? `<br><span class="dim" dir="ltr">${esc(x.sheet)}</span>` : ''}</td><td>${roleTag(x.role, x.lead)}${x.role !== 'fm' && x.sheet ? ' <span class="rb fm sm">+ مدیر ثابت</span>' : ''}</td><td>${x.city ? cityTag(x.city) : x.role === 'super' ? 'همه' : '—'}</td><td>${esc(x.region || '—')}</td><td class="num">${faS(x.nid)}</td>
        <td class="dim">${x.creator ? esc(x.creator) + (x.creator_role === 'region' ? ' (مدیر منطقه)' : x.creator_lead ? ` (${esc(leadL())})` : '') : 'اکسل یا سامانه'}</td><td>${statusPill(x)}</td><td class="num">${fa(x.reports)}</td><td class="dim">${x.last_login ? fmtTs(x.last_login) : '—'}</td>
        <td><div class="row" style="flex-wrap:nowrap"><input data-pw="${x.id}" placeholder="خالی=تصادفی" style="min-width:110px" autocomplete="new-password"><button class="btn small ghost" data-reset="${x.id}">تعیین</button></div></td>
        <td><div class="row" style="flex-wrap:nowrap"><button class="btn small ghost" data-edit="${x.id}">✏️ ویرایش</button>${full() && x.role !== 'super' ? `<button class="btn small ghost" data-lead="${x.id}" data-v="1" title="همین حساب ${esc(leadL())} شود؛ رمز، گزارش‌ها و هتل‌هایش می‌ماند">⬆️ ${esc(leadL())}</button>` : ''}${full() && x.lead ? `<button class="btn small ghost" data-lead="${x.id}" data-v="0" title="برگرداندن به مدیر منطقه">⬇️ مدیر منطقه</button>` : ''}<button class="btn small ${x.active ? 'danger' : 'okb'}" data-act="${x.id}" data-v="${x.active ? 0 : 1}">${x.active ? 'غیرفعال' : 'فعال'}</button>
          ${x.passkeys ? `<button class="btn small ghost" data-pk="${x.id}" title="حذف اثر انگشت‌های ثبت‌شده">☝️ ${fa(x.passkeys)}</button>` : ''}
          ${x.reports ? '' : `<button class="btn small danger" data-del="${x.id}">حذف</button>`}</div></td></tr>`).join('') || '<tr><td colspan="11" class="empty">کاربری نیست.</td></tr>'}</tbody></table></div></div>
    ${newUserForm(R, 'fm')}`;
  wireTemp(m); wireNewUser(m);
  m.querySelector('#fr').onchange = e => { U.region = +e.target.value; loadUsers(); };
  const sure = b => { if (b.dataset.sure === '1') return true; b.dataset.sure = '1'; b.textContent = 'مطمئنید؟'; return false; };
  m.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { U.edit = +b.dataset.edit; renderUsers(); const i = m.querySelector('#ed-name'); if (i) i.focus(); });
  const ec = m.querySelector('#ed-cancel'); if (ec) ec.onclick = () => { U.edit = 0; renderUsers(); };
  const es = m.querySelector('#ed-save'); if (es) es.onclick = async () => {
    const x = list.find(u => u.id === U.edit), err = m.querySelector('#ed-err'), body = { name: m.querySelector('#ed-name').value, nid: m.querySelector('#ed-nid').value };
    if (!(x.role === 'super' && !x.lead)) { body.region_id = +m.querySelector('#ed-region').value; body.sheet = m.querySelector('#ed-sheet').value; }
    es.disabled = true; err.textContent = '';
    try {
      const r = await api(`/api/super/users/${x.id}/edit`, { body });
      U.edit = 0; U.O = null;
      toast(r.entries !== undefined && body.sheet && body.sheet.trim() ? (r.entries ? `ذخیره شد؛ ${fa(r.entries)} ورودی به او سپرده شد.` : `ذخیره شد، ولی در اکسل‌های واردشده شیتی به نام «${body.sheet.trim()}» پیدا نشد.`) : 'ذخیره شد.', r.entries === 0 && !!(body.sheet || '').trim());
      loadUsers();
    } catch (e) { es.disabled = false; err.textContent = e.message; }
  };
  m.querySelectorAll('[data-lead]').forEach(b => b.onclick = async () => { if (!sure(b)) return; try { await api(`/api/super/users/${b.dataset.lead}/lead`, { body: { on: b.dataset.v === '1' } }); toast(b.dataset.v === '1' ? `حساب به ${leadL()} ارتقا یافت؛ با ورود دوباره، پنل تازه را می‌بیند.` : 'به مدیر منطقه برگشت.'); U.O = null; loadUsers(); } catch (e) { toast(e.message, true); } });
  m.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => { try { await api(`/api/super/users/${b.dataset.act}/active`, { body: { active: b.dataset.v === '1' } }); loadUsers(); } catch (e) { toast(e.message, true); } });
  m.querySelectorAll('[data-reset]').forEach(b => b.onclick = async () => { if (!sure(b)) return; b.disabled = true; try { U.temp = [await api(`/api/super/users/${b.dataset.reset}/reset`, { body: { password: m.querySelector(`[data-pw="${b.dataset.reset}"]`).value } })]; loadUsers(); } catch (e) { b.disabled = false; toast(e.message, true); } });
  m.querySelectorAll('[data-pk]').forEach(b => b.onclick = async () => { if (!sure(b)) return; try { await api(`/api/super/users/${b.dataset.pk}/passkeys`, { body: {} }); loadUsers(); } catch (e) { toast(e.message, true); } });
  m.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!sure(b)) return; try { await api(`/api/super/users/${b.dataset.del}/delete`, { body: {} }); toast('حذف شد.'); loadUsers(); } catch (e) { toast(e.message, true); } });
}
})();
