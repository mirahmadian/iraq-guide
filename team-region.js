'use strict';
(() => {
/* پنل مدیر منطقه: داشبورد، اکسل هفتگی، فرم‌ساز، مدیران ثابت، حساب */
let app;
const A = { me: null, tab: 'dash', D: null, f: { person: '', section: '', result: '' }, sel: null, detail: null, imp: null, form: null, formDirty: false, qsel: null, users: null, temp: null };

/* opts.region: مدیر سامانه وارد پنل یک منطقه شده است (همه‌ی درخواست‌ها با ?region=) */
window.startRegion = (me, opts) => {
  app = document.getElementById('app');
  Object.assign(A, { me, opts, tab: 'dash', D: null, f: { person: '', section: '', result: '' }, sel: null, detail: null, imp: null, form: null, formDirty: false, qsel: null, users: null, temp: null });
  HR.viewRegion = opts.region || 0;
  shell(); go((location.hash.slice(1) || 'dash'));
};
const TABS = [['dash', '📊 داشبورد'], ['import', '📄 اکسل هفتگی'], ['form', '🧩 فرم‌ساز'], ['users', '👥 مدیران ثابت'], ['account', '🔐 حساب من']];
const tabs = () => A.opts.region ? TABS.filter(t => t[0] !== 'account') : TABS;
function shell() {
  const sup = !!A.opts.region;
  app.innerHTML = `<header class="top"><div class="in"><div class="brand">${sup ? '<button class="btn small ghost" id="back-super">→ مدیر سامانه</button>' : '<a class="btn small ghost" href="./" style="text-decoration:none">→ برنامه</a>'}<div><h1>پایش خدمات هتل‌ها · ${esc(sup ? A.opts.regionName : A.me.region)}</h1><p>${esc(A.me.name)} · ${sup ? 'مدیر سامانه (نمایش پنل منطقه)' : 'مدیر منطقه'}</p></div></div>
    <nav class="tabs" role="tablist">${tabs().map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="false">${l}</button>`).join('')}</nav></div></header><main class="wrap" id="main"></main>`;
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
  const bs = app.querySelector('#back-super'); if (bs) bs.onclick = () => { if (A.formDirty && !confirmLeave()) return; A.formDirty = false; window.onbeforeunload = null; HR.viewRegion = 0; location.hash = ''; A.opts.onBack(); };
  window.onbeforeunload = e => { if (A.formDirty) { e.preventDefault(); e.returnValue = ''; } };
}
function go(tab) {
  if (!tabs().find(t => t[0] === tab)) tab = 'dash';
  if (A.tab === 'form' && tab !== 'form' && A.formDirty && !confirmLeave()) return;
  A.tab = tab; history.replaceState(null, '', '#' + tab);
  app.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  main().innerHTML = '<div class="empty">در حال بارگذاری…</div>';
  ({ dash: loadDash, import: renderImport, form: loadForm, users: loadUsers, account: () => renderAccount(main(), A.me, () => go('dash')) })[tab]();
}
let leaveSure = false;
function confirmLeave() { if (leaveSure) { leaveSure = false; A.formDirty = false; return true; } leaveSure = true; toast('تغییرهای فرم ذخیره نشده‌اند. برای رها کردن، دوباره روی تب بزنید.', true); setTimeout(() => leaveSure = false, 5000); return false; }
const main = () => document.getElementById('main');

/* ═════════ dashboard ═════════ */
async function loadDash(week) {
  try { A.D = await api('/api/admin/dashboard' + (week ? '?week=' + week : '')); } catch (e) { return toast(e.message, true); }
  if (A.tab !== 'dash') return;
  renderDash();
}
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
function renderDash() {
  const D = A.D, m = main();
  if (!D.weeks.length) { m.innerHTML = `<div class="card"><h2>هنوز اکسل هفتگی وارد نشده است</h2><p class="muted">برای شروع، فایل گزارش هفتگی (مثل RepotShojaV12.xlsx) را در تب «اکسل هفتگی» بارگذاری کنید.</p><button class="btn" id="to-imp" style="align-self:flex-start">رفتن به اکسل هفتگی</button></div>`; m.querySelector('#to-imp').onclick = () => go('import'); return; }
  const rows = D.defects, f = A.f;
  const totalE = D.people.reduce((a, p) => a + p.entries, 0), rep = D.people.reduce((a, p) => a + p.reported, 0);
  const fixed = rows.filter(d => d.result === 'fixed').length, follow = rows.filter(d => d.result === 'follow').length, open = rows.length - fixed - follow;
  const shown = rows.filter(d => (!f.person || d.uid === +f.person) && (!f.section || d.section === f.section) && (!f.result || (d.result || 'open') === f.result));
  if (!shown.find(d => d.key === A.sel)) { A.sel = shown[0]?.key || null; A.detail = null; }
  const sel = shown.find(d => d.key === A.sel);
  const stack = (n, fx, w, max) => `<span class="tr" style="width:${Math.max(4, n / max * 100)}%"><i style="width:${pct(fx, n)}%;background:var(--ok)"></i><i style="width:${pct(w, n)}%;background:var(--warn)"></i><i style="flex:1;background:var(--bad)"></i></span>`;
  const group = key => { const g = {}; rows.forEach(d => { const k = key(d); g[k] = g[k] || { n: 0, f: 0, w: 0 }; g[k].n++; if (d.result === 'fixed') g[k].f++; else if (d.result === 'follow') g[k].w++; }); return Object.entries(g).sort((a, b) => b[1].n - a[1].n); };
  const bySec = group(d => d.section), byCo = group(d => shortCo(d.company)), byHotel = group(d => d.hotel);
  const bars = list => { const max = Math.max(1, ...list.map(x => x[1].n)); return list.map(([k, x]) => `<div class="hb"><span class="lab" title="${esc(k)}">${esc(k)}</span>${stack(x.n, x.f, x.w, max)}<span class="num">${fa(x.n)}</span></div>`).join('') || '<div class="empty">نقصی ثبت نشده است.</div>'; };
  const qs = new URLSearchParams({ week: D.week, ...(f.person ? { person: f.person } : {}), ...(f.section ? { section: f.section } : {}), ...(f.result ? { result: f.result } : {}) });
  m.innerHTML = `
    <div class="row" style="justify-content:space-between"><div class="row"><label class="label" for="wk">هفته</label><select id="wk" class="sel">${D.weeks.map(w => `<option value="${w.id}" ${w.id === D.week ? 'selected' : ''}>${esc(w.title)}</option>`).join('')}</select></div>
      <span class="dim" style="font-size:12px">${fa(D.entries.n)} ورودی · ${fa(D.entries.h)} هتل · ${fa(D.entries.p)} زائر</span></div>
    <div class="kpis">
      <div class="kpi"><span class="v num">${fa(rep)}<span style="font-size:15px;color:var(--dim)"> از ${fa(totalE)}</span></span><span class="k">ورودی گزارش‌شده</span><span class="bar"><i style="width:${pct(rep, totalE)}%"></i></span></div>
      <div class="kpi"><span class="v num">${fa(rows.length)}</span><span class="k">نقص ثبت‌شده</span></div>
      <div class="kpi"><span class="v num" style="color:var(--ok)">${fa(pct(fixed, rows.length))}٪</span><span class="k">رفع شده (${fa(fixed)} مورد)</span></div>
      <div class="kpi"><span class="v num" style="color:var(--warn)">${fa(follow)}</span><span class="k">در حال پیگیری</span></div>
      <div class="kpi"><span class="v num" style="color:var(--bad)">${fa(open)}</span><span class="k">رفع نشده</span></div>
    </div>
    <div class="card"><div class="card-h"><h2>کارکرد مدیران ثابت</h2><span class="dim" style="font-size:12px">روی هر ردیف بزنید تا نواقص همان نفر بیاید</span></div>
      <div class="tbl-wrap"><table><thead><tr><th>نام</th><th>هتل‌ها</th><th>ورودی</th><th>گزارش‌شده</th><th>نقص</th><th>نتیجه‌ی نواقص</th><th>آخرین گزارش</th></tr></thead><tbody>
      ${D.people.map(p => { const d = rows.filter(x => x.uid === p.id), fx = d.filter(x => x.result === 'fixed').length, w = d.filter(x => x.result === 'follow').length;
        return `<tr class="click" data-person="${p.id}" aria-current="${+f.person === p.id}"><td><b>${esc(p.name)}</b></td><td>${esc((p.hotels || '').split(',').join('، '))}</td><td class="num">${fa(p.entries)}</td>
        <td><span class="pill ${p.reported === p.entries ? 'ok' : p.reported ? 'warn' : 'bad'}">${fa(p.reported)} از ${fa(p.entries)}</span></td><td class="num">${fa(d.length)}</td>
        <td>${d.length ? `<span class="mbar"><i style="width:${pct(fx, d.length)}%;background:var(--ok)"></i><i style="width:${pct(w, d.length)}%;background:var(--warn)"></i><i style="flex:1;background:var(--bad)"></i></span>` : '<span class="dim">—</span>'}</td>
        <td class="dim">${p.last ? fmtTs(p.last) : 'هنوز گزارش نداده'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">برای این هفته ورودی‌ای به کسی سپرده نشده است.</td></tr>'}</tbody></table></div>
      <div class="legend"><span><i style="background:var(--ok)"></i>رفع شد</span><span><i style="background:var(--warn)"></i>در حال پیگیری</span><span><i style="background:var(--bad)"></i>رفع نشد</span></div></div>
    <div class="dgrid">
      <div class="card"><div class="card-h"><h2>نواقص گزارش‌شده <span class="dim" style="font-weight:500;font-size:13px">(${fa(shown.length)})</span></h2>
        <div class="filters"><select id="f-p" aria-label="مدیر ثابت"><option value="">همه‌ی افراد</option>${D.people.map(p => `<option value="${p.id}" ${+f.person === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
          <select id="f-s" aria-label="حوزه"><option value="">همه‌ی حوزه‌ها</option>${[...new Set([...D.sections.map(s => s.title), ...rows.map(d => d.section)])].map(s => `<option ${f.section === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
          <select id="f-r" aria-label="نتیجه"><option value="">هر نتیجه</option>${Object.entries(RESULT).map(([k, [l]]) => `<option value="${k}" ${f.result === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <button class="btn small" id="xl-out" data-q="${esc(qs.toString())}">📥 خروجی اکسل</button></div></div>
        <div class="tbl-wrap"><table><thead><tr><th>مدیر ثابت</th><th>هتل · شرکت مجری</th><th>اشکال</th><th>اقدام</th><th>نتیجه</th></tr></thead><tbody>
        ${shown.map(d => `<tr class="click" data-def="${esc(d.key)}" aria-current="${A.sel === d.key}"><td>${esc(d.person)}</td><td>${esc(d.hotel)}<br><span class="dim">${esc(shortCo(d.company))} · ${md(d.d_in)}–${md(d.d_out)}</span></td>
          <td>${esc(d.question)}<br><span class="dim">${esc(d.section)} · ${esc(d.reasons.join('، ') || d.answer)}</span></td>
          <td>${esc([...d.actions, d.actionText].filter(Boolean).join('، ') || '—')}</td><td><span class="pill ${d.result ? RESULT[d.result][2] : 'bad'}">${d.result ? RESULT[d.result][0] : 'ثبت نشده'}</span></td></tr>`).join('') || '<tr><td colspan="5" class="empty">نقصی با این فیلتر نیست.</td></tr>'}</tbody></table></div></div>
      <div class="card detail" id="detail">${sel ? detailHTML(sel) : '<div class="empty">نقصی انتخاب نشده است.</div>'}</div>
    </div>
    <div class="two">
      <div class="card"><div class="card-h"><h2>نواقص به تفکیک حوزه</h2></div><div class="hbars">${bars(bySec)}</div></div>
      <div class="card"><div class="card-h"><h2>نواقص به تفکیک شرکت مجری</h2></div><div class="hbars">${bars(byCo)}</div></div>
    </div>
    <div class="card"><div class="card-h"><h2>نواقص به تفکیک هتل</h2></div><div class="hbars">${bars(byHotel)}</div></div>`;
  m.querySelector('#wk').onchange = e => { A.f = { person: '', section: '', result: '' }; A.sel = null; loadDash(+e.target.value); };
  m.querySelectorAll('[data-person]').forEach(r => r.onclick = () => { A.f.person = A.f.person === r.dataset.person ? '' : r.dataset.person; renderDash(); });
  m.querySelector('#f-p').onchange = e => { A.f.person = e.target.value; renderDash(); };
  m.querySelector('#f-s').onchange = e => { A.f.section = e.target.value; renderDash(); };
  m.querySelector('#f-r').onchange = e => { A.f.result = e.target.value; renderDash(); };
  m.querySelector('#xl-out').onclick = async e => { const b = e.currentTarget; b.disabled = true; try { await download('/api/admin/export?' + b.dataset.q, 'naghayes.xlsx'); } catch (x) { toast(x.message, true); } b.disabled = false; };
  m.querySelectorAll('[data-def]').forEach(r => r.onclick = () => { A.sel = r.dataset.def; A.detail = null; renderDash(); if (innerWidth < 1100) document.getElementById('detail').scrollIntoView({ behavior: 'smooth' }); });
  if (sel) wireDetail(sel);
}
function detailHTML(d) {
  const X = A.detail && A.detail.key === d.key ? A.detail : null;
  const media = X ? X.media.filter(x => x.qid === d.qid) : [], notes = X ? X.notes.filter(n => !n.qid || n.qid === d.qid) : [];
  return `<div class="card-h"><h2>${esc(d.question)}</h2><span class="pill ${d.result ? RESULT[d.result][2] : 'bad'}">${d.result ? RESULT[d.result][0] : 'نتیجه ثبت نشده'}</span></div>
    <dl class="kv"><dt>مدیر ثابت</dt><dd>${esc(d.person)}</dd><dt>هتل</dt><dd>${esc(d.hotel)}</dd><dt>شرکت مجری</dt><dd>${esc(d.company)}</dd>${d.siyahe ? `<dt>شرکت سیاحه</dt><dd>${esc(d.siyahe)}</dd>` : ''}
      <dt>کاروان</dt><dd>ورود ${md(d.d_in)} · خروج ${md(d.d_out)} · ${fa(d.pilgrims)} زائر</dd><dt>حوزه</dt><dd>${esc(d.section)}</dd>
      <dt>پاسخ</dt><dd>${esc(d.answer)}${d.reasons.length ? ' — ' + esc(d.reasons.join('، ')) : ''}</dd><dt>روز وقوع</dt><dd>${d.day ? dayName(d.day) : '—'}</dd>
      <dt>اقدام</dt><dd>${esc([...d.actions, d.actionText].filter(Boolean).join('، ') || '—')}</dd><dt>توضیح نتیجه</dt><dd>${esc(d.resultNote || '—')}</dd>
      ${d.descr ? `<dt>توضیح کلی</dt><dd>${esc(d.descr)}</dd>` : ''}<dt>آخرین تغییر</dt><dd class="dim">${fmtTs(d.updated)}</dd></dl>
    ${!X ? '<div class="dim">در حال بارگذاری عکس‌ها و گفتگو…</div>' : `
    ${media.length ? `<div class="gal">${media.map(x => x.status !== 'ready' ? `<span class="pill mute">${x.kind === 'image' ? '📷' : '🎬'} ${x.status === 'expired' ? 'بعد از ۷ روز پاک شد' : x.status === 'processing' ? 'در حال فشرده‌سازی' : 'پردازش نشد'}</span>`
        : x.kind === 'image' ? `<button data-zoom="${esc(x.url)}" aria-label="بزرگ‌نمایی عکس"><img src="${esc(x.url)}" alt="" loading="lazy"><span class="zoom-ic">🔍 زوم</span></button>` : `<video src="${esc(x.url)}" controls preload="metadata"></video>`).join('')}</div>` : ''}
    <div class="block"><span class="label">پیگیری شما (در خروجی اکسل هم می‌آید)</span>
      <div class="thread">${notes.map(n => `<div class="msg ${n.role === 'region' ? 'me' : 'them'}"><div class="who">${n.role === 'region' ? 'مدیر منطقه' : esc(n.name)} · ${fmtTs(n.ts)}</div>${esc(n.text)}</div>`).join('') || '<span class="dim" style="font-size:12.5px">هنوز پیگیری‌ای ثبت نشده.</span>'}</div>
      <div class="cos">${['پیگیری شد', 'به شرکت مجری اطلاع داده شد', 'لطفاً بعد از رفع عکس بفرستید', 'به ناظر گزارش شد'].map(t => `<button class="chip" data-qr="${esc(t)}">${t}</button>`).join('')}</div>
      <div class="reply"><input id="nt" placeholder="بازخورد یا نتیجه‌ی پیگیری خودتان…" maxlength="1000"><button class="btn small" id="nt-send">ثبت</button></div></div>`}`;
}
async function wireDetail(d) {
  const m = main();
  if (!A.detail || A.detail.key !== d.key) {
    try { const r = await api('/api/admin/defect/' + d.report_id); A.detail = { key: d.key, ...r }; } catch (e) { return toast(e.message, true); }
    if (A.sel !== d.key) return;
    document.getElementById('detail').innerHTML = detailHTML(d);
  }
  m.querySelectorAll('[data-zoom]').forEach(b => b.onclick = () => openZoom(b.dataset.zoom, `${d.hotel} · ${d.question}`));
  const send = async t => { if (!t.trim()) return; try { const r = await api('/api/notes', { body: { report_id: d.report_id, qid: d.qid, text: t.trim() } }); A.detail.notes = r.notes; document.getElementById('detail').innerHTML = detailHTML(d); wireDetail(d); toast('ثبت شد و مدیر ثابت آن را می‌بیند.'); } catch (e) { toast(e.message, true); } };
  m.querySelectorAll('[data-qr]').forEach(c => c.onclick = () => send(c.dataset.qr));
  const nt = m.querySelector('#nt'); if (!nt) return;
  m.querySelector('#nt-send').onclick = () => send(nt.value);
  nt.onkeydown = e => { if (e.key === 'Enter') send(nt.value); };
}

/* ═════════ weekly Excel import ═════════ */
async function renderImport() {
  const m = main(); let weeks = [];
  try { weeks = await api('/api/admin/weeks'); } catch (e) { toast(e.message, true); }
  if (A.tab !== 'import') return;
  const I = A.imp;
  m.innerHTML = `<div class="card"><div class="card-h"><h2>بارگذاری اکسل هفتگی</h2></div>
      <p class="hint">همان فایل گزارش هفتگی را انتخاب کنید. شیت اصلی (جدول همه‌ی ورودی‌ها) و شیت هر مدیر ثابت (Nargesi، Sobhani و …) خودکار پیدا می‌شوند.<br>
      برای کد ملی‌ها یک شیت جدا بگذارید که در هر ردیف <b>نام شیت</b> (مثلاً Nargesi)، <b>نام و نام خانوادگی</b> و <b>کد ملی</b> باشد. ترتیب ستون‌ها مهم نیست.</p>
      <div class="row"><label class="file">📄 انتخاب فایل اکسل<input type="file" accept=".xlsx,.xls" id="xl"></label><span id="xl-msg" class="dim"></span></div></div>
    ${I && I.preview ? importPreviewHTML(I.preview) : ''}
    ${A.temp ? tempHTML(A.temp, 'حساب‌های تازه ساخته شد') : ''}
    <div class="card"><div class="card-h"><h2>هفته‌های واردشده</h2></div><div class="tbl-wrap"><table><thead><tr><th>عنوان</th><th>فایل</th><th>ورودی</th><th>گزارش</th><th>زمان ورود</th><th></th></tr></thead><tbody>
      ${weeks.map(w => `<tr><td><b>${esc(w.title)}</b></td><td class="dim">${esc(w.file || '')}</td><td class="num">${fa(w.entries)}</td><td class="num">${fa(w.reports)}</td><td class="dim">${fmtTs(w.imported)}</td>
        <td>${w.reports ? '' : `<button class="btn small danger" data-wdel="${w.id}">حذف</button>`}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">هنوز هفته‌ای وارد نشده است.</td></tr>'}</tbody></table></div>
      <p class="hint">اگر اکسل همان هفته را دوباره وارد کنید (با همان عنوان)، ورودی‌ها به‌روز می‌شوند و گزارش‌های ثبت‌شده می‌مانند.</p></div>`;
  m.querySelector('#xl').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const msg = m.querySelector('#xl-msg'); msg.textContent = 'در حال خواندن…'; A.temp = null;
    /* in 8KB pieces: on a weak line a lost piece is resent alone instead of the whole file */
    try {
      const PART = 8192, of = Math.max(1, Math.ceil(file.size / PART)), up = Math.random().toString(16).slice(2);
      let r;
      for (let i = 0; i < of; i++) {
        msg.textContent = of > 1 ? `در حال ارسال… ${fa(Math.round(i / of * 100))}٪` : 'در حال ارسال…';
        r = await api(`/api/admin/import?name=${encodeURIComponent(file.name)}&up=${up}&i=${i}&of=${of}`, { method: 'POST', body: file.slice(i * PART, (i + 1) * PART), headers: { 'Content-Type': 'application/octet-stream' }, retry: true, timeout: 15000 });
      }
      if (!r.token) throw new Error('ارسال کامل نشد. دوباره فایل را انتخاب کنید.');
      A.imp = { preview: r }; renderImport();
    }
    catch (x) { msg.textContent = x.message; msg.className = 'err'; }
  };
  m.querySelectorAll('[data-wdel]').forEach(b => b.onclick = async () => { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'مطمئنید؟'; return; } try { await api('/api/admin/weeks/' + b.dataset.wdel, { method: 'DELETE' }); renderImport(); } catch (e) { toast(e.message, true); } });
  if (I && I.preview) wireImport(I.preview);
}
function importPreviewHTML(p) {
  const codeOpts = p.codes.map((c, i) => `<option value="${i}">${esc(c.name || '؟')} · ${faS(c.nid)}${c.valid ? '' : ' ⚠ نامعتبر'}</option>`).join('');
  return `<div class="card"><div class="card-h"><h2>پیش‌نمایش: ${fa(p.rows)} ورودی در ${fa(p.hotels)} هتل</h2><span class="dim">شیت اصلی: ${esc(p.main)}</span></div>
    ${p.replaces ? '<div class="pill warn" style="align-self:flex-start">هفته‌ای با همین عنوان قبلاً وارد شده و به‌روز می‌شود</div>' : ''}
    ${p.problems.length ? `<div class="err">${p.problems.map(esc).join('<br>')}</div>` : ''}
    <div class="field"><label class="label" for="im-title">عنوان هفته</label><input id="im-title" class="inp" value="${esc(p.title)}" maxlength="120"></div>
    ${p.codes.length ? `<span class="dim" style="font-size:12.5px">${fa(p.codes.length)} کد ملی در شیت کد ملی‌ها پیدا شد.</span>` : '<span class="err">شیت کد ملی‌ها پیدا نشد. کد ملی هر نفر را در جدول زیر بنویسید.</span>'}
    <div class="tbl-wrap"><table><thead><tr><th>شیت</th><th>ورودی</th><th>هتل‌ها</th><th>انتخاب از شیت کد ملی</th><th>نام و نام خانوادگی</th><th>کد ملی</th></tr></thead><tbody>
    ${p.sheets.map((s, i) => `<tr><td><b>${esc(s.sheet)}</b></td><td class="num">${fa(s.count)}</td><td class="dim">${esc(s.hotels.join('، '))}</td>
      <td>${p.codes.length ? `<select class="sel" data-pick="${i}"><option value="">—</option>${codeOpts}</select>` : ''}</td>
      <td><input data-name="${i}" value="${esc(s.guess?.name || '')}" placeholder="نام"></td><td><input data-nid="${i}" value="${esc(s.guess?.nid || '')}" inputmode="numeric" placeholder="۱۰ رقم" maxlength="12"></td></tr>`).join('')}
    </tbody></table></div>
    <p class="hint">شیتی که کد ملی ندارد به کسی سپرده نمی‌شود. برای کسی که حساب ندارد، حساب با رمز موقت ساخته می‌شود.</p>
    <span class="err" id="im-err"></span>
    <div class="row"><button class="btn" id="im-go">ثبت این هفته</button><button class="btn ghost" id="im-cancel">انصراف</button></div></div>`;
}
const nidOk = c => { c = String(c).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, ''); if (c.length >= 8 && c.length < 10) c = c.padStart(10, '0'); if (!/^\d{10}$/.test(c) || /^(\d)\1{9}$/.test(c)) return false; const r = [...c.slice(0, 9)].reduce((a, d, i) => a + +d * (10 - i), 0) % 11; return +c[9] === (r < 2 ? r : 11 - r); };
function wireImport(p) {
  const m = main();
  m.querySelectorAll('[data-pick]').forEach(s => s.onchange = () => { const c = p.codes[+s.value]; if (!c) return; m.querySelector(`[data-name="${s.dataset.pick}"]`).value = c.name; m.querySelector(`[data-nid="${s.dataset.pick}"]`).value = c.nid; check(); });
  const check = () => m.querySelectorAll('[data-nid]').forEach(i => { i.style.borderColor = i.value.trim() && !nidOk(i.value) ? 'var(--bad)' : ''; });
  m.querySelectorAll('[data-nid]').forEach(i => i.oninput = check); check();
  m.querySelector('#im-cancel').onclick = () => { A.imp = null; renderImport(); };
  m.querySelector('#im-go').onclick = async () => {
    const err = m.querySelector('#im-err'); err.textContent = '';
    const map = {};
    p.sheets.forEach((s, i) => { const nid = m.querySelector(`[data-nid="${i}"]`).value.trim(), name = m.querySelector(`[data-name="${i}"]`).value.trim(); if (nid) map[s.sheet] = { nid, name }; });
    const bad = Object.entries(map).find(([, v]) => !nidOk(v.nid) || !v.name);
    if (bad) { err.textContent = `شیت «${bad[0]}»: ${!bad[1].name ? 'نام را بنویسید.' : 'کد ملی معتبر نیست.'}`; return; }
    const b = m.querySelector('#im-go'); b.disabled = true; b.textContent = 'در حال ثبت…';
    try {
      const r = await api('/api/admin/import/commit', { body: { token: p.token, title: m.querySelector('#im-title').value, map }, timeout: 90000 });
      A.imp = null; A.temp = r.created.length ? r.created : null;
      toast(`«${r.title}» ثبت شد: ${fa(r.assigned)} ورودی به مدیران ثابت سپرده شد.`); renderImport();
    } catch (e) { err.textContent = e.message; b.disabled = false; b.textContent = 'ثبت این هفته'; }
  };
}
function tempHTML(list, title) {
  return `<div class="card temp-pw"><div class="card-h"><h2>${esc(title)}</h2><button class="btn small ghost" id="tmp-x">بستن</button></div>
    <p class="hint">این رمزها فقط همین یک بار نشان داده می‌شوند؛ برای هر نفر بفرستید. رمز «موقت» با اولین ورود باید عوض شود.</p>
    <div class="tbl-wrap"><table><thead><tr><th>نام</th><th>کد ملی (نام کاربری)</th><th>رمز</th></tr></thead><tbody>${list.map(c => `<tr><td>${esc(c.name)}</td><td class="num">${faS(c.nid)}</td><td><b class="num">${esc(faS(c.password))}</b>${c.temporary === false ? '' : ' <span class="dim">(موقت)</span>'}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint">ورود: در برنامه‌ی همیار کاروان ← «درباره برنامه» ← <b>«👥 ورود همکاران»</b></p></div>`;
}
document.addEventListener('click', e => { if (e.target.id === 'tmp-x') { A.temp = null; A.tab === 'users' ? renderUsers() : renderImport(); } });

/* ═════════ form builder ═════════ */
async function loadForm() {
  if (!A.form || !A.formDirty) { try { A.form = await api('/api/admin/form'); A.formDirty = false; } catch (e) { return toast(e.message, true); } }
  if (A.tab !== 'form') return;
  renderForm();
}
const allQ = () => A.form.sections.flatMap(s => s.questions.map(q => ({ q, s })));
const TYPES = [{ t: 'rating', l: 'امتیاز ۴ سطحی', d: 'عالی تا ضعیف؛ متوسط و ضعیف نقص حساب می‌شوند.' }, { t: 'yesno', l: 'بله / خیر', d: 'جواب خوب را تعیین کنید.' }, { t: 'choice', l: 'پاسخ‌های آماده', d: 'گزینه‌ها را بنویسید و گزینه‌های نقص را علامت بزنید.' }];
function renderForm() {
  const F = A.form, m = main();
  if (!allQ().find(x => x.q.id === A.qsel)) A.qsel = allQ()[0]?.q.id;
  const cur = allQ().find(x => x.q.id === A.qsel);
  m.innerHTML = `<div class="row" style="justify-content:space-between"><div><h2 style="font-size:17px">فرم‌ساز</h2><p class="hint">بخش‌ها و سؤال‌ها، پاسخ‌های آماده، اشکال‌ها و اقدام‌های آماده را خودتان تعیین کنید. «روز وقوع»، «نتیجه» و «عکس و فیلم» برای هر نقص خودکار هست.</p></div>
      <div class="row">${A.formDirty ? '<span class="dirty">● ذخیره نشده</span>' : '<span class="dim" style="font-size:12.5px">ذخیره شده</span>'}<button class="btn" id="fs-save" ${A.formDirty ? '' : 'disabled'}>ذخیره‌ی فرم</button></div></div>
    <div class="bd">
      <div class="card tree-panel"><div class="field"><label class="label" for="ft">نام فرم</label><input id="ft" class="inp" value="${esc(F.title)}" maxlength="120"></div>
        <div class="tree">${F.sections.map((s, si) => `<div class="s"><div class="s-h"><input class="em" data-semoji="${si}" value="${esc(s.emoji)}" aria-label="نماد بخش" maxlength="8"><input data-stitle="${si}" value="${esc(s.title)}" aria-label="نام بخش" maxlength="80">
            <button data-smv="${si}" data-d="-1" aria-label="بخش بالاتر">↑</button><button data-smv="${si}" data-d="1" aria-label="بخش پایین‌تر">↓</button><button data-sdel="${si}" aria-label="حذف بخش">✕</button></div>
          ${s.questions.map(q => `<button class="tq" data-qsel="${esc(q.id)}" aria-current="${q.id === A.qsel}"><span>${esc(q.emoji || '•')}</span><span>${esc(q.text)}</span></button>`).join('')}
          <button class="addq" data-addq="${si}">+ سؤال</button></div>`).join('')}</div>
        <button class="btn ghost small" id="adds">+ بخش جدید (مثلاً «زیارت» یا «درمان»)</button></div>
      <div class="card">${cur ? editorHTML(cur.q, cur.s) : '<div class="empty">یک سؤال اضافه کنید.</div>'}</div>
      <div><div class="label" style="margin-bottom:6px">پیش‌نمایش در گوشی مدیر ثابت</div><div class="preview">${cur ? previewHTML(cur.q) : ''}</div></div>
    </div>`;
  wireForm(cur);
}
function editorHTML(q, s) {
  const chips = (arr, key, ph) => `<div class="chips-edit">${(arr || []).map((r, i) => `<span class="chip">${esc(r)} <button type="button" data-crm="${key}" data-i="${i}" aria-label="حذف">✕</button></span>`).join('')}<input data-cadd="${key}" placeholder="${ph}" maxlength="120"></div>`;
  return `<div class="card-h"><h2>ویرایش سؤال · ${esc(s.title)}</h2></div>
    <div class="f-row"><div class="field"><label class="label" for="e-emoji">نماد</label><input id="e-emoji" class="inp" value="${esc(q.emoji || '')}" maxlength="8"></div>
      <div class="field"><label class="label" for="e-text">متن سؤال</label><input id="e-text" class="inp" value="${esc(q.text)}" maxlength="200"></div></div>
    <div class="field"><span class="label">نوع پاسخ</span><div class="types">${TYPES.map(t => `<button type="button" data-type="${t.t}" aria-pressed="${q.type === t.t}"><b>${t.l}</b><span>${t.d}</span></button>`).join('')}</div></div>
    ${q.type === 'yesno' ? `<div class="field"><span class="label">جواب خوب</span><div class="seg2"><button type="button" data-good="yes" aria-pressed="${q.good === 'yes'}">بله</button><button type="button" data-good="no" aria-pressed="${q.good === 'no'}">خیر</button></div></div>` : ''}
    ${q.type === 'choice' ? `<div class="field"><span class="label">پاسخ‌های آماده (⚠ یعنی این پاسخ نقص است؛ برای تغییر روی علامت بزنید)</span><div class="chips-edit">${(q.options || []).map((o, i) => `<span class="chip">${esc(o.l)} <button type="button" data-obad="${i}" title="نقص هست یا نه">${o.bad ? '⚠️' : '✅'}</button><button type="button" data-orm="${i}" aria-label="حذف">✕</button></span>`).join('')}<input id="e-opt" placeholder="پاسخ جدید + Enter" maxlength="80"></div></div>` : ''}
    <div class="field"><span class="label">اشکال‌های آماده (بعد از جواب بد نشان داده می‌شوند)</span>${chips(q.reasons, 'reasons', 'اشکال جدید + Enter')}</div>
    <div class="field"><span class="label">اقدام‌های آماده</span>${chips(q.actions, 'actions', 'اقدام جدید + Enter')}</div>
    <label class="row" style="font-size:13px"><input type="checkbox" id="e-na" ${q.na ? 'checked' : ''}> گزینه‌ی «موضوعیت ندارد» هم باشد</label>
    ${q.na ? `<div class="field"><label class="label" for="e-nal">متن این گزینه</label><input id="e-nal" class="inp" value="${esc(q.na)}" maxlength="60"></div>` : ''}
    <div class="row"><button class="btn ghost small" data-mv="-1">↑ بالاتر</button><button class="btn ghost small" data-mv="1">↓ پایین‌تر</button><button class="btn small danger" id="e-del">حذف سؤال</button></div>
    <p class="hint">گزارش‌های قبلی با متن همان زمان خودشان نگه داشته می‌شوند؛ تغییر یا حذف سؤال آن‌ها را خراب نمی‌کند.</p>`;
}
function previewHTML(q) {
  let ans;
  if (q.type === 'rating') ans = `<div class="ans">${RATING.map(r => `<button type="button" class="${r.c}" aria-pressed="${r.v === 'poor'}"><span class="em">${r.em}</span>${r.l}</button>`).join('')}${q.na ? '<button type="button" class="n"><span class="em">➖</span>' + esc(q.na) + '</button>' : ''}</div>`;
  else if (q.type === 'yesno') ans = `<div class="ans yn">${['yes', 'no'].map(v => `<button type="button" class="${v === q.good ? 'g' : 'b'}" aria-pressed="${v !== q.good}">${v === 'yes' ? '✔ بله' : '✖ خیر'}</button>`).join('')}${q.na ? '<button type="button" class="n">' + esc(q.na) + '</button>' : ''}</div>`;
  else { const firstBad = (q.options || []).find(o => o.bad); ans = `<div class="ans ch">${(q.options || []).map(o => `<button type="button" class="${o.bad ? 'b' : 'g'}" aria-pressed="${o === firstBad}">${esc(o.l)}</button>`).join('')}</div>`; }
  return `<div class="q isbad"><div class="q-t"><span class="e">${esc(q.emoji || '•')}</span><span>${esc(q.text)}</span></div>${ans}
    <div class="defect">${(q.reasons || []).length ? `<div class="block" style="gap:5px"><span class="label">چه اشکالی بود؟</span><div class="cos">${q.reasons.map(r => `<span class="chip">${esc(r)}</span>`).join('')}</div></div>` : ''}
      <div class="block" style="gap:5px"><span class="label">چه روزی؟</span><div class="cos"><span class="chip">۳ آبان</span><span class="chip">۴ آبان</span><span class="chip">۵ آبان</span></div></div>
      <div class="block" style="gap:5px"><span class="label">چه اقدامی انجام دادید؟</span><div class="cos">${(q.actions || []).map(r => `<span class="chip">${esc(r)}</span>`).join('') || '<span class="dim">فقط متن آزاد</span>'}</div></div>
      <div class="block" style="gap:5px"><span class="label">نتیجه</span><div class="res">${Object.values(RESULT).map(([l, ic, c]) => `<button type="button" class="${c}">${ic} ${l}</button>`).join('')}</div></div>
      <div class="media-row"><span class="add-media">📷 عکس</span><span class="add-media">🎬 فیلم</span></div></div></div>
    <p class="hint">این پیش‌نمایشِ حالتی است که جواب بد داده شده باشد.</p>`;
}
function wireForm(cur) {
  const m = main(), F = A.form, dirty = (full = true) => { A.formDirty = true; if (full) renderForm(); else { m.querySelector('.preview').innerHTML = previewHTML(cur.q); const t = m.querySelector(`[data-qsel="${CSS.escape(cur.q.id)}"]`); if (t) t.innerHTML = `<span>${esc(cur.q.emoji || '•')}</span><span>${esc(cur.q.text)}</span>`;
      const sv = m.querySelector('#fs-save'); sv.disabled = false; sv.previousElementSibling.outerHTML = '<span class="dirty">● ذخیره نشده</span>'; } };
  const nid = () => 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  m.querySelector('#fs-save').onclick = async () => { try { A.form = await api('/api/admin/form', { method: 'PUT', body: A.form }); A.formDirty = false; toast('فرم ذخیره شد. از همین حالا مدیران ثابت فرم تازه را می‌بینند.'); renderForm(); } catch (e) { toast(e.message, true); } };
  m.querySelector('#ft').oninput = e => { F.title = e.target.value; A.formDirty = true; m.querySelector('#fs-save').disabled = false; };
  m.querySelectorAll('[data-stitle]').forEach(i => i.oninput = () => { F.sections[+i.dataset.stitle].title = i.value; A.formDirty = true; m.querySelector('#fs-save').disabled = false; });
  m.querySelectorAll('[data-semoji]').forEach(i => i.oninput = () => { F.sections[+i.dataset.semoji].emoji = i.value; A.formDirty = true; m.querySelector('#fs-save').disabled = false; });
  m.querySelectorAll('[data-smv]').forEach(b => b.onclick = () => { const i = +b.dataset.smv, j = i + +b.dataset.d; if (j < 0 || j >= F.sections.length) return; [F.sections[i], F.sections[j]] = [F.sections[j], F.sections[i]]; dirty(); });
  m.querySelectorAll('[data-sdel]').forEach(b => b.onclick = () => { if (F.sections.length < 2) return toast('فرم دست‌کم یک بخش لازم دارد.', true); if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'حذف؟'; return; } F.sections.splice(+b.dataset.sdel, 1); dirty(); });
  m.querySelectorAll('[data-qsel]').forEach(b => b.onclick = () => { A.qsel = b.dataset.qsel; renderForm(); });
  m.querySelectorAll('[data-addq]').forEach(b => b.onclick = () => { const id = nid(); F.sections[+b.dataset.addq].questions.push({ id, emoji: '❓', text: 'سؤال جدید', type: 'rating', reasons: [], actions: [] }); A.qsel = id; dirty(); setTimeout(() => m.querySelector('#e-text')?.select(), 0); });
  m.querySelector('#adds').onclick = () => { const id = nid(); F.sections.push({ id: 's' + Date.now().toString(36), title: 'بخش جدید', emoji: '📌', questions: [{ id, emoji: '❓', text: 'سؤال جدید', type: 'rating', reasons: [], actions: [] }] }); A.qsel = id; dirty(); };
  if (!cur) return;
  const q = cur.q, s = cur.s;
  m.querySelector('#e-text').oninput = e => { q.text = e.target.value; dirty(false); };
  m.querySelector('#e-emoji').oninput = e => { q.emoji = e.target.value; dirty(false); };
  m.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { q.type = b.dataset.type; if (q.type === 'yesno' && !q.good) q.good = 'yes'; if (q.type === 'choice' && !(q.options || []).length) q.options = [{ l: 'کامل', bad: false }, { l: 'ناقص', bad: true }]; dirty(); });
  m.querySelectorAll('[data-good]').forEach(b => b.onclick = () => { q.good = b.dataset.good; dirty(); });
  m.querySelectorAll('[data-orm]').forEach(b => b.onclick = () => { q.options.splice(+b.dataset.orm, 1); dirty(); });
  m.querySelectorAll('[data-obad]').forEach(b => b.onclick = () => { const o = q.options[+b.dataset.obad]; o.bad = !o.bad; dirty(); });
  m.querySelectorAll('[data-crm]').forEach(b => b.onclick = () => { q[b.dataset.crm].splice(+b.dataset.i, 1); dirty(); });
  const onEnter = (el, sel, fn) => { if (el) el.onkeydown = e => { if (e.key === 'Enter' && el.value.trim()) { e.preventDefault(); fn(el.value.trim()); dirty(); setTimeout(() => m.querySelector(sel)?.focus(), 0); } }; };
  m.querySelectorAll('[data-cadd]').forEach(el => onEnter(el, `[data-cadd="${el.dataset.cadd}"]`, v => (q[el.dataset.cadd] = q[el.dataset.cadd] || []).push(v)));
  onEnter(m.querySelector('#e-opt'), '#e-opt', v => (q.options = q.options || []).push({ l: v, bad: false }));
  m.querySelector('#e-na').onchange = e => { if (e.target.checked) q.na = 'موضوعیت ندارد'; else delete q.na; dirty(); };
  const nal = m.querySelector('#e-nal'); if (nal) nal.oninput = () => { q.na = nal.value || 'موضوعیت ندارد'; dirty(false); };
  m.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { const a = s.questions, i = a.indexOf(q), j = i + +b.dataset.mv; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; dirty(); });
  m.querySelector('#e-del').onclick = e => { const b = e.currentTarget; if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'مطمئنید؟ دوباره بزنید'; return; } const i = s.questions.indexOf(q); s.questions.splice(i, 1); A.qsel = (s.questions[i] || s.questions[i - 1] || {}).id; dirty(); };
}

/* ═════════ fixed managers ═════════ */
async function loadUsers() { try { A.users = await api('/api/admin/users'); } catch (e) { return toast(e.message, true); } if (A.tab === 'users') renderUsers(); }
function renderUsers() {
  const m = main();
  m.innerHTML = `${A.temp ? tempHTML(A.temp, 'رمز موقت') : ''}
    <div class="card"><div class="card-h"><h2>مدیران ثابت (${fa(A.users.length)})</h2></div>
      <p class="hint">حساب‌ها معمولاً هنگام وارد کردن اکسل هفتگی خودکار ساخته می‌شوند. «شیت» همان نام شیت این نفر در اکسل است تا هفته‌های بعد خودکار شناخته شود.</p>
      <div class="tbl-wrap"><table><thead><tr><th>نام</th><th>کد ملی</th><th>شیت</th><th>وضعیت</th><th>اثر انگشت</th><th>گزارش</th><th>آخرین ورود</th><th></th></tr></thead><tbody>
      ${A.users.map(u => `<tr><td><input data-uname="${u.id}" value="${esc(u.name)}" maxlength="80"></td><td class="num">${faS(u.nid)}</td><td><input data-usheet="${u.id}" value="${esc(u.sheet || '')}" maxlength="60" style="min-width:90px"></td>
        <td>${!u.active ? '<span class="pill bad">غیرفعال</span>' : u.must_change ? '<span class="pill warn">هنوز وارد نشده</span>' : '<span class="pill ok">فعال</span>'}</td>
        <td>${u.passkeys ? `${fa(u.passkeys)} دستگاه <button class="btn small ghost" data-uclr="${u.id}">حذف</button>` : '<span class="dim">—</span>'}</td><td class="num">${fa(u.reports)}</td><td class="dim">${u.last_login ? fmtTs(u.last_login) : '—'}</td>
        <td><div class="row" style="flex-wrap:nowrap"><input data-upw="${u.id}" placeholder="رمز تازه (خالی=تصادفی)" style="min-width:150px" autocomplete="new-password"><button class="btn small ghost" data-ureset="${u.id}">تعیین رمز</button><button class="btn small ${u.active ? 'danger' : 'okb'}" data-uact="${u.id}" data-v="${u.active ? 0 : 1}">${u.active ? 'غیرفعال' : 'فعال'}</button></div></td></tr>`).join('') || '<tr><td colspan="8" class="empty">هنوز کسی نیست.</td></tr>'}</tbody></table></div></div>
    <form class="card" id="nu" novalidate><div class="card-h"><h2>افزودن دستی</h2></div>
      <div class="row" style="align-items:flex-end"><div class="field" style="flex:1 1 200px"><label class="label" for="nu-name">نام و نام خانوادگی</label><input id="nu-name" maxlength="80"></div>
        <div class="field" style="flex:1 1 160px"><label class="label" for="nu-nid">کد ملی</label><input id="nu-nid" inputmode="numeric" maxlength="12"></div>
        <div class="field" style="flex:1 1 120px"><label class="label" for="nu-sheet">نام شیت (اختیاری)</label><input id="nu-sheet" maxlength="60" dir="ltr"></div>
        <div class="field" style="flex:1 1 150px"><label class="label" for="nu-pw">رمز (خالی = رمز موقت تصادفی)</label><input id="nu-pw" maxlength="60" autocomplete="new-password"></div><button class="btn" type="submit">افزودن</button></div>
      <p class="hint">نام کاربری هر نفر کد ملی اوست. اگر رمز را خودتان بنویسید (دست‌کم ۶ کاراکتر)، همان می‌ماند؛ اگر خالی بگذارید، رمز موقت ساخته می‌شود و با اولین ورود عوض می‌شود.</p>
      <span class="err" id="nu-err"></span></form>`;
  const saveEdit = async id => { const name = m.querySelector(`[data-uname="${id}"]`).value, sheet = m.querySelector(`[data-usheet="${id}"]`).value; try { await api(`/api/admin/users/${id}/edit`, { body: { name, sheet } }); toast('ذخیره شد.'); } catch (e) { toast(e.message, true); } };
  m.querySelectorAll('[data-uname],[data-usheet]').forEach(i => i.onchange = () => saveEdit(i.dataset.uname || i.dataset.usheet));
  m.querySelectorAll('[data-ureset]').forEach(b => b.onclick = async () => { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'مطمئنید؟'; return; } try { A.temp = [await api(`/api/admin/users/${b.dataset.ureset}/reset`, { body: { password: m.querySelector(`[data-upw="${b.dataset.ureset}"]`).value } })]; loadUsers(); } catch (e) { toast(e.message, true); } });
  m.querySelectorAll('[data-uact]').forEach(b => b.onclick = async () => { try { await api(`/api/admin/users/${b.dataset.uact}/active`, { body: { active: b.dataset.v === '1' } }); loadUsers(); } catch (e) { toast(e.message, true); } });
  m.querySelectorAll('[data-uclr]').forEach(b => b.onclick = async () => { if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'مطمئنید؟'; return; } try { await api(`/api/admin/users/${b.dataset.uclr}/passkeys`, { body: {} }); loadUsers(); } catch (e) { toast(e.message, true); } });
  m.querySelector('#nu').onsubmit = async e => { e.preventDefault(); const err = m.querySelector('#nu-err'); err.textContent = '';
    try { A.temp = [await api('/api/admin/users', { body: { name: m.querySelector('#nu-name').value, nid: m.querySelector('#nu-nid').value, sheet: m.querySelector('#nu-sheet').value, password: m.querySelector('#nu-pw').value } })]; loadUsers(); } catch (x) { err.textContent = x.message; } };
}

})();
