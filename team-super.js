'use strict';
(() => {
/* مدیر سامانه: همه‌ی مناطق، مدیران منطقه و همه‌ی کاربرانی که ساخته‌اند */
let app;
const U = { me: null, tab: 'regions', O: null, users: null, region: 0, temp: null };
const TABS = [['regions', '🗺️ مناطق'], ['quality', '⭐ کیفیت هتل‌ها'], ['cos', '🏢 شرکت‌ها'], ['form', '🧩 فرم‌ساز'], ['users', '👥 همه‌ی کاربران'], ['daily', '📝 گزارش روزانه'], ['evals', '⭐ ارزشیابی‌ها'], ['hinfo', '🏨 اطلاعات هتل‌ها'], ['guide', '📘 راهنما'], ['account', '🔐 حساب من']];
/* سرپرستی که خودش هم هتل دارد (منطقه و شیت روی حسابش)، تب «هتل‌های من» هم دارد */
const tabs = () => { const T = U.me.owner ? TABS.filter(t => t[0] !== 'account') : TABS.slice(); if (U.me.lead && U.me.region_id) T.splice(T.length - 1, 0, ['mine', '🏨 هتل‌های من']); return T; };

window.startSuper = me => { app = document.getElementById('app'); U.me = me; HR.viewRegion = 0; shell(); go(U.tab); };
function shell() {
  app.innerHTML = `<header class="top"><div class="in"><div class="brand"><a class="btn small ghost" href="${U.me.owner ? 'admin.html' : './'}" ${U.me.owner ? 'onclick="return hrBackAdmin()"' : ''} style="text-decoration:none">${U.me.owner ? (hrFromAdmin() ? '✕ بستن (پنل مدیریت باز است)' : '→ پنل مدیریت') : '→ برنامه'}</a><div><h1>${esc(U.me.lead ? U.me.leadLabel : 'مدیر سامانه')} · پایش خدمات هتل‌ها</h1><p>${esc(U.me.name)}</p></div><button class="btn small ghost" data-logout title="خروج از این حساب، برای ورود با حساب دیگر">🚪 خروج</button></div>
    <nav class="tabs" role="tablist">${tabs().map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="false">${l}</button>`).join('')}</nav></div></header><main class="wrap" id="main"></main>`;
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
}
const main = () => document.getElementById('main');
function go(tab) {
  if (U.tab === 'form' && tab !== 'form' && ((window.leaveFormBuilder && !window.leaveFormBuilder()) || !fbLeave())) return;
  if (tab === 'mine') { const me = U.me; return startFM(me, { onBack: () => { U.tab = 'regions'; startSuper(me); } }); }
  U.tab = tab;
  app.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  main().innerHTML = '<div class="empty"><span class="spin"></span>در حال بارگذاری…</div>';
  ({ quality: () => loadQuality(), cos: () => loadCompanies(), regions: loadRegions, users: loadUsers, daily: async () => { try { if (!U.O) U.O = await api('/api/super/overview'); } catch (e) { return toast(e.message, true); } renderDailyAll(main(), U.O.regions); }, evals: () => renderEvals(main()), hinfo: async () => { try { if (!U.O) U.O = await api('/api/super/overview'); } catch (e) { return toast(e.message, true); } renderHinfoAll(main(), '/api/super/hinfo', U.O.regions); }, guide: () => renderGuide(main(), 'lead', leadL()), form: () => fbStart(U.me), account: () => renderAccount(main(), U.me, () => go('regions')) })[tab]();
}
const leadL = () => (U.O && U.O.leadLabel) || U.me.leadLabel || 'سرپرست مناطق';
setLeadLabelFn(() => leadL());
const full = () => !U.me.lead;
const roleName = (r, lead) => r === 'region' ? 'مدیر منطقه' : r === 'fm' ? 'مدیر ثابت' : r === 'super' ? (lead ? leadL() : 'مدیر سامانه') : r;
/* نام منطقه همراه شهرش (هر شهر یک یا چند منطقه) */
const regLabel = r => r.city && !r.name.includes(r.city) ? `${r.city} · ${r.name}` : r.name;
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
/* دسترسی‌های مدیر منطقه */
const PERM_L = { fm: '🏨 تعریف مدیران ثابت', staff: '👷 تعریف آشپزها و عوامل' };
const permChips = p => p ? Object.keys(PERM_L).map(k => `<span class="pc ${p[k] ? 'on' : 'off'}" title="${p[k] ? 'دارد' : 'ندارد'}">${p[k] ? '✓' : '✕'} ${PERM_L[k].slice(3)}</span>`).join('') : '';
const permBoxes = (id, p) => Object.keys(PERM_L).map(k => `<label class="pchk"><input type="checkbox" data-perm="${k}" ${!p || p[k] ? 'checked' : ''}${id ? ` data-pu="${id}"` : ''}> ${PERM_L[k]}</label>`).join('');
const readPerms = box => Object.fromEntries([...box.querySelectorAll('[data-perm]')].map(i => [i.dataset.perm, i.checked]));
const fmtD = t => t ? new Date(t).toLocaleDateString('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
/* مدیر یک منطقه: حساب «مدیر منطقه» یا سرپرست مناطقی که خودش مدیر همین منطقه است */
const isMgrOf = x => x.active && (x.role === 'region' || x.lead);
/* جابجایی مدیر به منطقه‌ی دیگر (فقط منطقه‌هایی که مدیر ندارند) */
function moveHTML(x, r) {
  const taken = new Set(U.O.regions.filter(g => (g.people || []).some(isMgrOf)).map(g => g.id));
  const free = U.O.regions.filter(g => g.id !== r.id && !taken.has(g.id));
  return `<details class="mg-mv"><summary class="dim" style="cursor:pointer">🔀 جابجایی ${esc(x.name)} به منطقه‌ی دیگر</summary>
    ${free.length ? `<div class="row" style="margin-top:6px"><select class="inp" data-mvsel="${x.id}" style="max-width:260px"><option value="">— منطقه‌ی مقصد —</option>${free.map(g => `<option value="${g.id}">${esc(regLabel(g))}</option>`).join('')}</select><button class="btn small" data-mvgo="${x.id}">انتقال</button></div>
    <p class="hint">فقط منطقه‌هایی که مدیر ندارند آمده‌اند. دوره‌ی او در «${esc(regLabel(r))}» امروز بسته و دوره‌ی تازه در منطقه‌ی مقصد باز می‌شود (سابقه می‌ماند). ورودی‌ها و گزارش‌های هفته‌های قبل سر جایشان می‌مانند و از این به بعد اکسل هفتگی او در منطقه‌ی تازه وارد می‌شود.</p>`
    : '<p class="hint">منطقه‌ی خالی (بدون مدیر) نیست؛ اول منطقه‌ی تازه بسازید.</p>'}</details>`;
}
function mgrBlock(r) {
  const act = (r.people || []).filter(isMgrOf), T = r.terms || [], D = U.O.ops.domains, EQ = U.O.ops.evalRegion;
  return `<details class="rg-mg"><summary>👔 مدیر منطقه: دسترسی‌ها، تعویض برای دوره‌ی تازه، سابقه</summary>
    ${act.map(x => `<div class="mg-row" data-pbox="${x.id}"><b>${esc(x.name)}</b> <span class="dim num">${faS(x.nid)}</span>${x.lead ? ` <span class="rb lead sm">⭐ ${esc(leadL())}</span>` : ''}
      ${moveHTML(x, r)}
      ${x.lead ? `<p class="hint">${esc(leadL())} است و همه‌ی دسترسی‌ها را دارد.</p>` : `<div class="row" style="margin-top:6px">${permBoxes(x.id, x.perms)}<button class="btn small ghost" data-psave="${x.id}">ذخیره‌ی دسترسی</button></div>
      <div class="row" data-sbox="${x.id}" style="margin-top:6px"><span class="dim">📝 محدوده‌ی فعالیت (حوزه‌های گزارش روزانه):</span> ${D.map(d => `<label class="pchk"><input type="checkbox" data-sc="${esc(d)}" ${!x.scope || x.scope.includes(d) ? 'checked' : ''}> ${esc(d)}</label>`).join('')}<button class="btn small ghost" data-ssave="${x.id}">ذخیره‌ی محدوده</button></div>
      <details class="mg-ev" style="margin-top:6px"><summary class="dim" style="cursor:pointer">✍️ ارزشیابی ${esc(x.name)} (بدون تعویض)</summary><div data-evbox="${x.id}">${evalFormHTML(EQ)}</div><button class="btn small" data-evsave="${x.id}">ثبت ارزشیابی</button></details>`}</div>`).join('') || '<p class="hint">این منطقه الان مدیر منطقه‌ی فعال ندارد.</p>'}
    <form class="mg-new" data-ho="${r.id}" novalidate><h4>🔁 ${act.length ? 'تعویض مدیر منطقه (دوره‌ی تازه)' : 'تعیین مدیر منطقه'}</h4>
      <div class="row" style="align-items:flex-end">
        <div class="field" style="flex:1 1 180px"><label class="label">نام و نام خانوادگی</label><input data-hn maxlength="80"></div>
        <div class="field" style="flex:1 1 140px"><label class="label">کد ملی (نام کاربری)</label><input data-hi inputmode="numeric" maxlength="12" dir="ltr"></div>
        <div class="field" style="flex:1 1 140px"><label class="label">رمز (خالی = موقت)</label><input data-hp maxlength="60" autocomplete="new-password"></div></div>
      <div class="row mg-perms" style="margin-top:6px">${permBoxes(0, null)}</div>
      ${act.length > 1 ? `<p class="err">⚠️ این منطقه ${fa(act.length)} مدیر منطقه‌ی فعال دارد، ولی هر منطقه فقط یک مدیر منطقه دارد. اول مدیر اضافه را به منطقه‌ی خودش منتقل یا غیرفعال کنید.</p>` : ''}
      ${act.length === 1 ? `<div class="mg-out" data-hev><h4>📋 فرم پایان مأموریت ${esc(act[0].name)}</h4><p class="hint">هر منطقه فقط یک مدیر منطقه دارد؛ با ثبت، ${esc(act[0].name)} کنار می‌رود. پیش از آن عملکردش را ارزشیابی کنید.</p>${evalFormHTML(EQ)}</div>` : ''}
      <p class="hint">با «ثبت»، ${act.length ? 'مدیر فعلی غیرفعال می‌شود (گزارش‌ها، مدیران ثابت و عواملی که ساخته سر جایشان می‌مانند) و ' : ''}نفر تازه مدیر این منطقه می‌شود. اگر کد ملی مال یکی از مدیران ثابت همین منطقه یا مدیر منطقه‌ی قبلی همین منطقه باشد، همان حساب (با همان رمز) مدیر منطقه می‌شود و لازم نیست نام را بنویسید. ${esc(leadL())} هم اگر کد ملی خودش را بنویسد، خودش مدیر این منطقه می‌شود.</p>
      <button class="btn" type="submit">ثبت</button> <span class="err" data-he></span></form>
    ${T.length ? `<h4>🕘 سابقه‌ی مدیران این منطقه</h4><ul class="terms">${T.map(t => `<li><b>${esc(t.name || '')}</b> <span class="dim">از ${fmtD(t.start)} ${t.end ? 'تا ' + fmtD(t.end) : '<span class="pill ok">تا امروز</span>'}</span> ${t.score != null ? scoreTag(t.score) : ''}</li>`).join('')}</ul>` : ''}
  </details>`;
}
function regionCard(r) {
  const P = r.people || [], mgr = P.filter(isMgrOf), hot = P.filter(x => x.role === 'fm' || x.sheet);
  const st = r.staff || [], stN = st.reduce((a, x) => a + x.n, 0), stSoon = st.reduce((a, x) => a + x.soon, 0);
  return `<div class="card rg ${cityCls(r.city)}"><div class="card-h"><h2>🗺️ ${esc(r.name)} ${!r.name.includes(r.city || '-') ? cityTag(r.city) : ''}</h2>
      <div class="row"><button class="btn small" data-open="${r.id}">ورود به پنل این منطقه ←</button><button class="btn small ghost" data-users="${r.id}">👥 کاربران</button></div></div>
    <div class="rg-stats"><span>هفته‌ی واردشده <b class="num">${fa(r.weeks)}</b></span><span>گزارش <b class="num">${fa(r.reports)}</b></span><span>نقص <b class="num">${fa(r.defects)}</b></span>
      <span class="${r.open ? 'bad' : ''}">نقص باز <b class="num">${fa(r.open || 0)}</b></span><span class="dim">آخرین گزارش: ${r.last_report ? fmtTs(r.last_report) : '—'}</span></div>
    <div class="rg-grid">
      <section class="rg-sec reg"><h3>👔 مدیر منطقه <span class="dim">(${fa(mgr.length)})</span></h3><ul>${mgr.map(x => personRow(x, (x.lead ? `<span class="rb lead sm">⭐ ${esc(leadL())}</span>` : '') + (x.sheet ? '<span class="rb fm sm">+ مدیر ثابت</span>' : '') + (x.active ? `<span class="pcs">${permChips(x.perms)}</span>` : ''))).join('') || '<li class="dim">هنوز مدیر منطقه ندارد.</li>'}</ul></section>
      <section class="rg-sec fm"><h3>🏨 مدیران ثابت <span class="dim">(${fa(hot.length)})</span></h3><ul>${hot.map(x => personRow(x, x.lead ? `<span class="rb lead sm">⭐ ${esc(leadL())}</span>` : x.role === 'region' ? '<span class="rb reg sm">مدیر منطقه</span>' : '')).join('') || '<li class="dim">هنوز مدیر ثابتی ندارد.</li>'}</ul></section>
      <section class="rg-sec st"><h3>👷 عوامل <span class="dim">(${fa(stN)})</span></h3><ul>${st.map(x => `<li><span class="pn"><b>${esc(x.role)}</b></span><span class="pm"><span class="num">${fa(x.n)}</span> نفر ${x.soon ? `<span class="pill bad">${fa(x.soon)} نزدیک خروج</span>` : ''}</span></li>`).join('') || '<li class="dim">هنوز ثبت نشده (در پنل منطقه، تب «👷 عوامل»).</li>'}</ul>
        ${stSoon ? `<p class="hint" style="color:var(--bad)">⚠️ ${fa(stSoon)} نفر تا ۵ روز دیگر باید از عراق خارج شوند.</p>` : ''}</section>
    </div>
    ${mgrBlock(r)}
    <details class="rg-edit"><summary>✏️ تغییر نام یا شهر این منطقه</summary><div class="row"><select class="sel" data-rcity="${r.id}" aria-label="شهر">${U.O.cities.map(x => `<option ${x === r.city ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><input class="inp" style="max-width:220px" data-rname="${r.id}" value="${esc(r.name)}" maxlength="80" aria-label="نام منطقه"><button class="btn small ghost" data-rsave="${r.id}">ذخیره</button>${!(r.people || []).length && !r.weeks && !(r.staff || []).length ? `<button class="btn small danger" data-rdel="${r.id}">🗑️ حذف این منطقه‌ی خالی</button>` : ''}</div></details></div>`;
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
      <ul class="lead-list">${L.map(x => `<li><b>${esc(x.name)}</b> ${statusPill(x)}${x.region_id ? ` <span class="dim">· مدیر</span> ${cityTag(x.city)} ${x.city !== x.region ? `<span class="dim">${esc(x.region)}</span>` : ''}` : ''}</li>`).join('')}</ul></div>` : ''}
    <div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn small ghost" data-allx title="یک فایل اکسل: مدیران منطقه، مدیران ثابت، آشپزها و سایر عوامل همه‌ی شهرها">📦 خروجی یکجای همه‌ی شهرها</button></div>
    <nav class="city-tabs" aria-label="شهرها"><button data-city="__all" aria-pressed="${!U.city}">همه‌ی شهرها <span class="n">${fa(RA.length)} منطقه</span></button>
      ${cities.map(c => { const o = openOf(c); return `<button class="${cityCls(c)}" data-city="${esc(c)}" aria-pressed="${U.city === c}"><i></i>${esc(c || 'بدون شهر')} <span class="n">${fa(RA.filter(r => inCity(r, c)).length)} منطقه</span>${o ? `<span class="ob" title="نقص باز">${fa(o)}</span>` : ''}</button>`; }).join('')}</nav>
    <div class="kpis k6">
      <div class="kpi"><span class="v num">${fa(R.length)}</span><span class="k">منطقه</span></div>
      <div class="kpi"><span class="v num">${fa(cnt(isMgrOf))}</span><span class="k">👔 مدیر منطقه</span></div>
      <div class="kpi"><span class="v num">${fa(cnt(x => x.role === 'fm' || x.sheet))}</span><span class="k">🏨 مدیر ثابت</span></div>
      <div class="kpi"><span class="v num">${fa(R.reduce((a, r) => a + (r.staff || []).reduce((b, x) => b + x.n, 0), 0))}</span><span class="k">👷 عوامل</span></div>
      <div class="kpi"><span class="v num">${fa(tot('reports'))}</span><span class="k">گزارش ثبت‌شده</span></div>
      <div class="kpi"><span class="v num" style="${tot('open') ? 'color:var(--bad)' : ''}">${fa(tot('open'))}</span><span class="k">نقص باز (از ${fa(tot('defects'))})</span></div>
    </div>
    ${(U.city ? [U.city] : cities).map(c => `<h2 class="city-h ${cityCls(c)}"><i></i>🕌 ${esc(c || 'بدون شهر')} <span class="dim" style="font-size:13px;font-weight:500">(${fa(RA.filter(r => inCity(r, c)).length)} منطقه)</span></h2>
      ${RA.filter(r => inCity(r, c)).map(regionCard).join('')}`).join('') || '<div class="empty">هنوز منطقه‌ای ساخته نشده.</div>'}
    <details class="card setx" ${U.setOpen ? 'open' : ''}><summary><h2>⚙️ تنظیمات و افزودن</h2><span class="dim">منطقه‌ی جدید، منطقه‌های پیش‌فرض، حوزه‌ها و ارزشیابی، کاربر جدید${full() ? '، عنوان نقش' : ''}</span></summary>
    <form class="card" id="nr" novalidate><div class="card-h"><h2>➕ منطقه‌ی جدید</h2></div>
      <div class="row" style="align-items:flex-end"><div class="field" style="flex:1 1 160px"><label class="label" for="nr-city">شهر</label><select id="nr-city">${U.O.cities.map(x => `<option ${x === U.city ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
        <div class="field" style="flex:1 1 220px"><label class="label" for="nr-name">نام منطقه</label><input id="nr-name" maxlength="80" placeholder="مثلاً کربلا ۲ (بین‌الحرمین)"></div><button class="btn" type="submit">ساختن</button></div>
      <p class="hint">هر شهر می‌تواند یک یا چند منطقه داشته باشد. نام منطقه باید یکتا باشد. بعد از ساختن، در کارت همان منطقه با «👔 مدیر منطقه ← تعیین مدیر منطقه» مدیرش را بگذارید.</p><span class="err" id="nr-err"></span></form>
    <div class="card"><div class="card-h"><h2>🏙️ منطقه‌های پیش‌فرض</h2></div><p class="hint">برای هر شهر (نجف، کربلا، کاظمین، سامراء) آن‌قدر منطقه ساخته می‌شود که هر شهر دست‌کم ۴ منطقه داشته باشد (مثلاً «کاظمین - منطقه‌ی ۱»). منطقه‌های موجود حساب می‌شوند و چیزی پاک یا عوض نمی‌شود؛ نام‌ها را بعداً می‌توانید عوض کنید.</p><button class="btn ghost" id="rdef">🏙️ ساختن منطقه‌های پیش‌فرض</button></div>
    ${opsCfgCardHTML(U.O.ops)}
    ${newUserForm(RA, 'region')}
    ${full() ? `<form class="card" id="ll" novalidate><div class="card-h"><h2>🏷️ عنوان نقش «${esc(leadL())}»</h2></div>
      <p class="hint">نقشی یک سطح بالاتر از مدیر منطقه: پنل همه‌ی شهرها و مناطق را می‌بیند (داشبورد، کیفیت، اکسل هفتگی، عوامل) و منطقه و مدیر منطقه می‌سازد، مدیران منطقه را هر دوره عوض می‌کند و به آن‌ها دسترسی می‌دهد؛ ولی به حساب شما و هم‌سطح‌هایش دسترسی ندارد.</p>
      <div class="row" style="align-items:flex-end"><div class="field" style="flex:1 1 220px"><label class="label" for="ll-v">عنوان</label><input id="ll-v" maxlength="40" value="${esc(leadL())}"></div><button class="btn ghost" type="submit">ذخیره</button></div></form>` : ''}
    </details>`;
  wireTemp(m);
  m.querySelector('.setx').ontoggle = e => U.setOpen = e.target.open;
  m.querySelectorAll('[data-city]').forEach(b => b.onclick = () => { U.city = b.dataset.city === '__all' ? '' : b.dataset.city; lsSet('team-city', U.city); renderRegions(); });
  m.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const r = RA.find(x => x.id === +b.dataset.open); startRegion(U.me, { region: r.id, regionName: regLabel(r), onBack: () => startSuper(U.me) }); });
  m.querySelectorAll('[data-users]').forEach(b => b.onclick = () => { U.region = +b.dataset.users; go('users'); });
  m.querySelectorAll('[data-rsave]').forEach(b => b.onclick = async () => { try { await api('/api/super/regions/' + b.dataset.rsave, { body: { name: m.querySelector(`[data-rname="${b.dataset.rsave}"]`).value, city: m.querySelector(`[data-rcity="${b.dataset.rsave}"]`).value } }); toast('ذخیره شد.'); loadRegions(); } catch (e) { toast(e.message, true); } });
  m.querySelectorAll('[data-rdel]').forEach(b => b.onclick = async () => { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'مطمئنید؟'; return; } try { await api(`/api/super/regions/${b.dataset.rdel}/delete`, { body: {} }); toast('منطقه حذف شد.'); loadRegions(); } catch (e) { toast(e.message, true); } });
  m.querySelectorAll('[data-psave]').forEach(b => b.onclick = async () => { try { await api(`/api/super/users/${b.dataset.psave}/perms`, { body: readPerms(m.querySelector(`[data-pbox="${b.dataset.psave}"]`)) }); toast('دسترسی‌ها ذخیره شد؛ از درخواست بعدی مدیر منطقه اعمال می‌شود.'); loadRegions(); } catch (e) { toast(e.message, true); } });
  m.querySelectorAll('[data-evbox]').forEach(b => wireEval(b, U.O.ops.evalRegion));
  m.querySelectorAll('[data-mvgo]').forEach(b => b.onclick = async () => { const sel = m.querySelector(`[data-mvsel="${b.dataset.mvgo}"]`); if (!sel.value) return toast('منطقه‌ی مقصد را انتخاب کنید.', true);
    if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'مطمئنید؟'; return; }
    try { await api(`/api/super/users/${b.dataset.mvgo}/move`, { body: { region_id: +sel.value } }); toast(`منتقل شد به «${sel.selectedOptions[0].textContent}».`); loadRegions(); } catch (e) { toast(e.message, true); } });
  m.querySelectorAll('[data-hev]').forEach(b => wireEval(b, U.O.ops.evalRegion));
  m.querySelectorAll('[data-ssave]').forEach(b => b.onclick = async () => { const box = m.querySelector(`[data-sbox="${b.dataset.ssave}"]`), sc = [...box.querySelectorAll('[data-sc]:checked')].map(i => i.dataset.sc);
    if (!sc.length) return toast('دست‌کم یک حوزه را انتخاب کنید.', true);
    try { await api(`/api/super/users/${b.dataset.ssave}/scope`, { body: { scope: sc } }); toast('محدوده‌ی فعالیت ذخیره شد.'); loadRegions(); } catch (e) { toast(e.message, true); } });
  m.querySelectorAll('[data-evsave]').forEach(b => b.onclick = async () => { const ev = readEval(m.querySelector(`[data-evbox="${b.dataset.evsave}"]`), U.O.ops.evalRegion);
    if (!ev.done) return toast(`${fa(ev.left)} سؤال بی‌پاسخ مانده است.`, true);
    try { const r = await api(`/api/super/users/${b.dataset.evsave}/eval`, { body: ev }); toast(`ارزشیابی ثبت شد: ${fa(r.score)} از ۱۰۰`); loadRegions(); } catch (e) { toast(e.message, true); } });
  m.querySelectorAll('[data-ho]').forEach(f => f.onsubmit = async e => {
    e.preventDefault(); const sb = f.querySelector('[type=submit]'), er = f.querySelector('[data-he]'); er.textContent = ''; if (sb.disabled) return;
    const k = null, hev = f.querySelector('[data-hev]'), ev = hev ? readEval(hev, U.O.ops.evalRegion) : null;
    if (ev && !ev.done) { er.textContent = `فرم پایان مأموریت مدیر فعلی: ${fa(ev.left)} سؤال بی‌پاسخ مانده است.`; return; }
    if (sb.dataset.sure !== '1' && !(k && k.checked) && f.closest('.rg-mg').querySelector('.mg-row')) { sb.dataset.sure = '1'; sb.textContent = 'مطمئنید؟ مدیر فعلی غیرفعال می‌شود'; return; }
    sb.disabled = true;
    try {
      const r = await api(`/api/super/regions/${f.dataset.ho}/handover`, { body: { name: f.querySelector('[data-hn]').value, nid: f.querySelector('[data-hi]').value, password: f.querySelector('[data-hp]').value, perms: readPerms(f.querySelector('.mg-perms')), eval: ev || undefined } });
      if (r.password) U.temp = [r];
      toast(`«${r.name}» مدیر منطقه شد${r.ended ? `؛ ${fa(r.ended)} مدیر قبلی غیرفعال شد` : ''}${r.kept ? ' (با همان رمز قبلی خودش وارد می‌شود)' : ''}.`);
      loadRegions();
    } catch (x) { sb.disabled = false; sb.dataset.sure = ''; sb.textContent = 'ثبت'; er.textContent = x.message; }
  });
  m.querySelector('[data-allx]').onclick = e => allXlsx(e.target);
  m.querySelector('#rdef').onclick = async ev => { const b = ev.target; if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'مطمئنید؟ دوباره بزنید'; return; }
    try { const r = await api('/api/super/regions/defaults', { body: {} }); toast(r.created.length ? `${fa(r.created.length)} منطقه ساخته شد.` : 'همه‌ی شهرها همین حالا دست‌کم ۴ منطقه دارند.'); loadRegions(); } catch (e) { toast(e.message, true); } };
  wireOpsCfg(m, () => loadRegions());
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
      <button class="btn" type="submit">ساختن</button></div>
    <div class="row nu-perms" style="margin-top:6px"><span class="dim">دسترسی‌های مدیر منطقه:</span> ${permBoxes(0, null)}</div><span class="err" id="nu-err"></span></form>`;
}
function wireNewUser(m) {
  const f = m.querySelector('#nu'); if (!f) return;
  const R = U.O.regions, role = f.querySelector('#nu-role'), city = f.querySelector('#nu-city'), reg = f.querySelector('#nu-region');
  const fillReg = () => { const L = R.filter(r => r.city === city.value); reg.innerHTML = L.map(r => `<option value="${r.id}" ${U.region === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join(''); };
  const syncRole = () => { f.querySelectorAll('.nu-reg').forEach(x => x.hidden = role.value === 'lead'); f.querySelector('.nu-perms').hidden = role.value !== 'region'; };
  city.onchange = fillReg; role.onchange = syncRole; fillReg(); syncRole();
  f.onsubmit = async e => { e.preventDefault(); const err = m.querySelector('#nu-err'), sb = f.querySelector('[type=submit]'); err.textContent = '';
    if (sb.disabled) return; sb.disabled = true;
    try { U.temp = [await api('/api/super/users', { body: { role: m.querySelector('#nu-role').value, region_id: m.querySelector('#nu-role').value === 'lead' ? 0 : +m.querySelector('#nu-region').value, name: m.querySelector('#nu-name').value, nid: m.querySelector('#nu-nid').value, password: m.querySelector('#nu-pw').value, perms: readPerms(f.querySelector('.nu-perms')) } })]; U.O = null; go(U.tab); }
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
/* خروجی یکجای همه‌ی شهرها: مدیران منطقه، مدیران ثابت، آشپزها، سایر عوامل و خلاصه‌ی هر منطقه (یک فایل) */
async function allXlsx(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳ در حال ساختن…'; }
  try {
    const [users, d, O] = await Promise.all([api('/api/super/users'), api('/api/super/allstaff'), U.O ? U.O : api('/api/super/overview')]);
    U.O = O;
    const R = O.regions, rg = id => R.find(r => r.id === id) || {}, rName = id => rg(id).name || '', rCity = id => rg(id).city || '';
    const st = u => !u.active ? 'غیرفعال' : !u.last_login ? 'هنوز وارد نشده' : 'فعال';
    const lastEval = (kind, ids) => { const L = d.evals.filter(e => e.kind === kind && ids.includes(e.ref_id)); return L.length ? L[L.length - 1] : null; };
    const term = id => { const L = d.terms.filter(t => t.user_id === id); return L.length ? L[L.length - 1] : null; };
    const asg = id => d.asg.find(a => a.user_id === id) || { n: 0, hotels: '' };
    const dJ = t => t ? xDT(t).slice(0, 10) : '';
    const perms = u => { const p = u.perms == null ? ['fm', 'staff'] : String(u.perms).split(','); return [p.includes('fm') ? 'تعریف مدیران ثابت' : '', p.includes('staff') ? 'تعریف آشپزها و عوامل' : ''].filter(Boolean).join('، ') || 'هیچ'; };
    /* عوامل: آخرین دوره‌ی هر نفر + آغاز اولین دوره + آخرین تمدید */
    const byId = new Map(d.staff.map(x => [x.id, x])), first = x => { let y = x, n = 0; while (y.prev_id && byId.has(y.prev_id) && n++ < 50) y = byId.get(y.prev_id); return y.d_start; };
    const cur = d.staff.filter(x => x.status !== 'extended'), today = JDP.num(d.today);
    const sRow = x => { const ids = d.staff.filter(y => y.region_id === x.region_id && y.nid === x.nid).map(y => y.id), e = lastEval('staff', ids);
      return [x.city, x.region, x.first, x.last, x.nid, x.role, x.hotel || '', first(x), x.prev_id ? x.d_start : '', x.d_end, x.status === 'active' ? JDP.num(x.d_end) - today : '', x.status === 'active' ? 'فعال' : 'پایان مأموریت', x.left_at || '', e ? e.score : '']; };
    const sHead = ['شهر', 'منطقه', 'نام', 'نام خانوادگی', 'کد ملی', 'سمت', 'هتل محل خدمت', 'آغاز مأموریت', 'آخرین تمدید', 'پایان مأموریت', 'روز مانده', 'وضعیت', 'تاریخ خروج واقعی', 'نمره‌ی ارزیابی'];
    const sW = [12, 22, 12, 16, 13, 12, 22, 12, 12, 12, 9, 13, 13, 11];
    const order = (a, b) => (a[0] || '').localeCompare(b[0] || '', 'fa') || (a[1] || '').localeCompare(b[1] || '', 'fa');
    const mgrs = users.filter(u => u.role === 'region' || u.lead);
    const fms = users.filter(u => u.role === 'fm' || ((u.role === 'region' || u.lead) && u.sheet));
    const cooks = cur.filter(x => x.role === 'آشپز'), others = cur.filter(x => x.role !== 'آشپز');
    const now = xDT(Date.now()), sum = R.map(r => [r.city, r.name, users.filter(u => u.region_id === r.id && u.role === 'region' && u.active).map(u => u.name).join('، '),
      fms.filter(u => u.region_id === r.id && u.active).length, cur.filter(x => x.region_id === r.id && x.status === 'active' && x.role === 'آشپز').length,
      cur.filter(x => x.region_id === r.id && x.status === 'active' && x.role !== 'آشپز').length, r.open || 0]);
    await saveBook(`عوامل-همه-شهرها-${now.slice(0, 10).replace(/\//g, '-')}.xlsx`, [
      { name: 'خلاصه', title: `خلاصه‌ی همه‌ی شهرها و مناطق · ${now}`, head: ['شهر', 'منطقه', 'مدیر منطقه', 'مدیر ثابت فعال', 'آشپز فعال', 'سایر عوامل فعال', 'نقص باز'], widths: [12, 24, 26, 12, 10, 12, 9], rows: sum.sort(order) },
      { name: 'مدیران منطقه', title: `مدیران منطقه‌ی همه‌ی شهرها · ${now}`, head: ['شهر', 'منطقه', 'نام و نام خانوادگی', 'نقش', 'کد ملی', 'وضعیت', 'آغاز دوره', 'پایان دوره', 'نمره‌ی پایان مأموریت', 'دسترسی‌ها', 'محدوده‌ی فعالیت', 'هم مدیر ثابت (نام شیت)', 'آخرین ورود'],
        widths: [12, 22, 26, 16, 13, 13, 12, 12, 12, 34, 40, 14, 17], text: [4],
        rows: mgrs.map(u => { const t = term(u.id), e = lastEval('region', [u.id]); return [u.city || (u.lead ? 'همه' : ''), u.region || '', u.name, u.lead ? leadL() : 'مدیر منطقه', u.nid, st(u), t ? dJ(t.start) : dJ(u.created), t && t.end ? dJ(t.end) : '', e ? e.score : '',
          u.role === 'region' ? perms(u) : 'همه', u.role === 'region' ? (u.scope == null ? 'همه‌ی حوزه‌ها' : String(u.scope).split('|').join('، ')) : '', u.sheet || '', xDT(u.last_login)]; }).sort(order) },
      { name: 'مدیران ثابت', title: `مدیران ثابت همه‌ی شهرها (حساب‌های سامانه) · ${now}`, head: ['شهر', 'منطقه', 'نام و نام خانوادگی', 'نقش اصلی', 'کد ملی', 'نام شیت', 'هتل‌های هفته‌ی آخر', 'تعداد ورودی هفته‌ی آخر', 'تعداد گزارش', 'وضعیت', 'آغاز مأموریت', 'پایان مأموریت', 'نمره‌ی ارزیابی', 'آخرین ورود'],
        widths: [12, 22, 26, 14, 13, 12, 40, 10, 10, 13, 12, 12, 11, 17], text: [4],
        rows: fms.map(u => { const a = asg(u.id), sr = cur.filter(x => x.nid === u.nid).pop(), ids = d.staff.filter(y => y.nid === u.nid).map(y => y.id), e = lastEval('staff', ids);
          return [u.city || '', u.region || '', u.name, u.role === 'fm' ? 'مدیر ثابت' : u.lead ? leadL() : 'مدیر منطقه', u.nid, u.sheet || '', String(a.hotels || '').split(',').join('، '), a.n, +u.reports || 0, st(u), sr ? first(sr) : '', sr ? sr.d_end : '', e ? e.score : '', xDT(u.last_login)]; }).sort(order) },
      { name: 'آشپزها', title: `آشپزهای همه‌ی شهرها (از «👷 عوامل» هر منطقه، آخرین دوره‌ی هر نفر) · ${now}`, head: sHead, widths: sW, text: [4], rows: cooks.map(sRow).sort(order) },
      { name: 'سایر عوامل', title: `سایر عوامل همه‌ی شهرها (مدیر ثابت، مدیر منطقه و نقش‌های دیگر در «👷 عوامل») · ${now}`, head: sHead, widths: sW, text: [4], rows: others.map(sRow).sort(order) },
    ]);
    toast(`فایل ساخته شد: ${fa(mgrs.length)} مدیر منطقه، ${fa(fms.length)} مدیر ثابت، ${fa(cooks.length)} آشپز، ${fa(others.length)} عامل دیگر.`);
  } catch (e) { toast(e.message, true); }
  if (btn) { btn.disabled = false; btn.textContent = '📦 خروجی یکجای همه‌ی شهرها'; }
}
/* خروجی اکسل «همه‌ی کاربران»: همه‌ی ستون‌های جدول + دسترسی‌ها و محدوده‌ی فعالیت (همان فیلتر منطقه‌ی صفحه) */
async function usersXlsx(list, R) {
  const X = await loadXlsx();
  const dt = t => t ? new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Baghdad' }).format(t).replace('،', '').replace(',', '') : '';
  const st = u => !u.active ? 'غیرفعال' : !u.last_login ? 'هنوز وارد نشده' : 'فعال';
  const perms = u => { if (u.role !== 'region') return ''; const p = u.perms == null ? ['fm', 'staff'] : String(u.perms).split(','); return [p.includes('fm') ? 'تعریف مدیران ثابت' : '', p.includes('staff') ? 'تعریف آشپزها و عوامل' : ''].filter(Boolean).join('، ') || 'هیچ'; };
  const scope = u => u.role !== 'region' ? '' : u.scope == null ? 'همه‌ی حوزه‌ها' : String(u.scope).split('|').join('، ');
  const creator = x => x.creator ? x.creator + (x.creator_role === 'region' ? ' (مدیر منطقه)' : x.creator_lead ? ` (${leadL()})` : '') : 'اکسل یا سامانه';
  const head = ['ردیف', 'نام و نام خانوادگی', 'نقش', 'نقش دوم', 'شهر', 'منطقه', 'کد ملی (نام کاربری)', 'نام شیت در اکسل', 'وضعیت', 'رمز موقت (باید عوض شود)', 'تعداد گزارش', 'اثر انگشت (دستگاه)', 'آخرین ورود', 'تاریخ ساخت حساب', 'سازنده', 'دسترسی‌ها (مدیر منطقه)', 'محدوده‌ی فعالیت (مدیر منطقه)', 'شناسه'];
  const rows = list.map((x, i) => [i + 1, x.name, roleName(x.role, x.lead), x.role !== 'fm' && x.sheet ? 'مدیر ثابت' : '', x.city || (x.role === 'super' ? 'همه' : ''), x.region || '', x.nid, x.sheet || '', st(x), x.must_change ? 'بله' : 'خیر',
    +x.reports || 0, +x.passkeys || 0, dt(x.last_login), dt(x.created), creator(x), perms(x), scope(x), x.id]);
  const rn = U.region ? (R.find(r => r.id === U.region) || {}) : null;
  const title = `همه‌ی کاربران سامانه‌ی پایش خدمات هتل‌ها · ${rn ? regLabel(rn) : 'همه‌ی شهرها و مناطق'} · ${dt(Date.now())}`;
  const aoa = [[title], head, ...rows], ws = X.utils.aoa_to_sheet(aoa);
  rows.forEach((r, i) => { const c = ws[X.utils.encode_cell({ r: i + 2, c: 6 })]; if (c) { c.t = 's'; c.z = '@'; } });   /* کد ملی با صفرهای اول */
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
  ws['!cols'] = [6, 26, 16, 11, 13, 24, 15, 14, 14, 12, 10, 10, 18, 18, 24, 32, 40, 8].map(w => ({ wch: w }));
  ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: Math.max(1, aoa.length - 1), c: head.length - 1 } }) };
  const wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] }; X.utils.book_append_sheet(wb, ws, 'کاربران');
  const by = {}; list.forEach(x => { const k = roleName(x.role, x.lead); by[k] = by[k] || { n: 0, a: 0 }; by[k].n++; if (x.active) by[k].a++; });
  const ss = X.utils.aoa_to_sheet([['خلاصه'], ['نقش', 'تعداد', 'فعال', 'غیرفعال'], ...Object.entries(by).map(([k, v]) => [k, v.n, v.a, v.n - v.a]), ['جمع', list.length, list.filter(x => x.active).length, list.filter(x => !x.active).length]]);
  ss['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]; X.utils.book_append_sheet(wb, ss, 'خلاصه');
  X.writeFile(wb, `کاربران-${rn ? regLabel(rn).replace(/[\\/:*?"<>|]/g, '-') : 'همه'}-${dt(Date.now()).slice(0, 10).replace(/\//g, '-')}.xlsx`);
  toast(`فایل اکسل ${fa(list.length)} کاربر ساخته شد.`);
}
function renderUsers() {
  const m = main(), R = U.O.regions, list = U.users;
  m.innerHTML = `${U.temp ? tempHTML(U.temp) : ''}
    <div class="card"><div class="card-h"><h2>همه‌ی کاربران (${fa(list.length)})</h2>
      <div class="filters"><button class="btn small ghost" id="ux">📥 خروجی اکسل</button><button class="btn small ghost" data-allx>📦 خروجی یکجای همه‌ی شهرها</button><select id="fr" aria-label="منطقه"><option value="0">همه‌ی شهرها و مناطق</option>${regOptions(R, U.region)}</select></div></div>
      <div id="th-box"></div>
      <p class="hint">«سازنده» نشان می‌دهد هر حساب را چه کسی ساخته است. کسی که گزارش یا پیام ثبت کرده حذف نمی‌شود تا سابقه بماند؛ او را غیرفعال کنید.</p>
      <div class="tbl-wrap"><table><thead><tr><th>نام</th><th>نقش</th><th>شهر</th><th>منطقه</th><th>کد ملی</th><th>سازنده</th><th>وضعیت</th><th>گزارش</th><th>آخرین ورود</th><th>رمز</th><th></th></tr></thead><tbody>
      ${list.map(x => U.edit === x.id ? editRowHTML(x, R) : `<tr><td><b>${esc(x.name)}</b>${x.sheet ? `<br><span class="dim" dir="ltr">${esc(x.sheet)}</span>` : ''}</td><td>${roleTag(x.role, x.lead)}${x.role !== 'fm' && x.sheet ? ' <span class="rb fm sm">+ مدیر ثابت</span>' : ''}</td><td>${x.city ? cityTag(x.city) : x.role === 'super' ? 'همه' : '—'}</td><td>${esc(x.region || '—')}</td><td class="num">${faS(x.nid)}</td>
        <td class="dim">${x.creator ? esc(x.creator) + (x.creator_role === 'region' ? ' (مدیر منطقه)' : x.creator_lead ? ` (${esc(leadL())})` : '') : 'اکسل یا سامانه'}</td><td>${statusPill(x)}</td><td class="num">${fa(x.reports)}</td><td class="dim">${x.last_login ? fmtTs(x.last_login) : '—'}</td>
        <td><div class="row u-pw"><input data-pw="${x.id}" placeholder="خالی=تصادفی" autocomplete="new-password"><button class="btn small ghost" data-reset="${x.id}">تعیین</button></div></td>
        <td><div class="row u-act"><button class="btn small ghost" data-edit="${x.id}">✏️ ویرایش</button>${x.role === 'region' || x.lead ? `<button class="btn small ghost" data-th="${x.id}" title="سابقه‌ی منطقه‌ها: از چه تاریخی تا چه تاریخی کجا بوده">🕘 سابقه</button>` : ''}${full() && x.role !== 'super' ? `<button class="btn small ghost" data-lead="${x.id}" data-v="1" title="همین حساب ${esc(leadL())} شود؛ رمز، گزارش‌ها و هتل‌هایش می‌ماند">⬆️ ${esc(leadL())}</button>` : ''}${full() && x.lead ? `<button class="btn small ghost" data-lead="${x.id}" data-v="0" title="برگرداندن به مدیر منطقه">⬇️ مدیر منطقه</button>` : ''}<button class="btn small ${x.active ? 'danger' : 'okb'}" data-act="${x.id}" data-v="${x.active ? 0 : 1}">${x.active ? 'غیرفعال' : 'فعال'}</button>
          ${x.passkeys ? `<button class="btn small ghost" data-pk="${x.id}" title="حذف اثر انگشت‌های ثبت‌شده">☝️ ${fa(x.passkeys)}</button>` : ''}
          ${x.reports ? '' : `<button class="btn small danger" data-del="${x.id}">حذف</button>`}</div></td></tr>`).join('') || '<tr><td colspan="11" class="empty">کاربری نیست.</td></tr>'}</tbody></table></div></div>
    ${newUserForm(R, 'fm')}`;
  wireTemp(m); wireNewUser(m);
  m.querySelector('#fr').onchange = e => { U.region = +e.target.value; loadUsers(); };
  m.querySelector('#ux').onclick = () => usersXlsx(list, R).catch(e => toast(e.message, true));
  m.querySelector('[data-allx]').onclick = e => allXlsx(e.target);
  const sure = b => { if (b.dataset.sure === '1') return true; b.dataset.sure = '1'; b.textContent = 'مطمئنید؟'; return false; };
  m.querySelectorAll('[data-th]').forEach(b => b.onclick = async () => { const x = list.find(u => u.id === +b.dataset.th);
    try { const T = await api(`/api/super/users/${x.id}/terms`);
      m.querySelector('#th-box').innerHTML = `<div class="mg-row" style="margin:8px 0"><div class="row" style="justify-content:space-between"><b>🕘 سابقه‌ی منطقه‌های ${esc(x.name)}</b><button class="btn small ghost" id="th-x">بستن</button></div>
        <ul class="terms">${T.map(t => `<li><b>${esc(regLabel({ name: t.region || 'منطقه‌ی حذف‌شده', city: t.city }))}</b> <span class="dim">از ${fmtD(t.start)} ${t.end ? 'تا ' + fmtD(t.end) : '<span class="pill ok">تا امروز</span>'}${t.by ? ' · ثبت: ' + esc(t.by) : ''}</span></li>`).join('') || '<li class="dim">سابقه‌ای ثبت نشده.</li>'}</ul></div>`;
      m.querySelector('#th-x').onclick = () => { m.querySelector('#th-box').innerHTML = ''; }; m.querySelector('#th-box').scrollIntoView({ block: 'nearest' });
    } catch (e) { toast(e.message, true); } });
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
