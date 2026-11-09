/* ══════════════════════════════════════════
   MGR ADMIN — تب «🧳 مدیران کاروان»: فهرست شماره‌ی مدیرانی که می‌توانند وارد «بخش ویژه» برنامه شوند (سرور: worker/mgr.js)
   شماره‌ها فقط روی سرور Cloudflare است (نه GitHub). دسترسی همکاران: «mgr»
══════════════════════════════════════════ */
let mgaData = null, mgaErr = '', mgaQ = '', mgaEdit = null, mgaImp = null;
const MGA_ROLES = ['مدیر کاروان', 'معاون کاروان', 'روحانی کاروان', 'مدیر ثابت هتل', 'عوامل ستاد', 'سایر'];
const MGA_CITIES = { najaf: 'نجف', karbala: 'کربلا', kadhimiya: 'کاظمین', samarra: 'سامرا' };
const MGA_UNTIL = [['', 'بدون تاریخ پایان'], ['30', '۱ ماه'], ['60', '۲ ماه'], ['90', '۳ ماه'], ['180', '۶ ماه'], ['365', '۱ سال']];
const mgaN = n => (+n || 0).toLocaleString('fa');
const mgaDate = t => t ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Tehran' }).format(t) : '';
const mgaAgo = t => { if (!t) return 'هنوز وارد نشده'; const m = Math.round((Date.now() - t) / 6e4); return m < 60 ? mgaN(Math.max(1, m)) + ' دقیقه پیش' : m < 1440 ? mgaN(Math.round(m / 60)) + ' ساعت پیش' : mgaN(Math.round(m / 1440)) + ' روز پیش'; };
const mgaFaPhone = p => String(p || '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

function mgaLoad() {
  mgaErr = ''; mgaRender();
  adminFetch('/admin/mgr', null, adminAuth()).then(d => { mgaData = d; mgaRender(); }).catch(e => { mgaErr = e.message; mgaRender(); });
}
function mgaStatus(x) {
  if (!x.active) return ['⛔ غیرفعال', '#B3261E'];
  if (x.until && x.until < Date.now()) return ['⌛ تاریخش گذشته', '#B25B12'];
  if (x.valid_from && x.valid_from > Date.now()) return ['⏳ از ' + mgaDate(x.valid_from) + ' (۱۵ روز مانده به سفر)', '#6B5BA8'];
  return x.devices ? ['🟢 وارد شده', '#1E7D4F'] : ['⚪ هنوز وارد نشده', '#777'];
}
/* حالت نمایش: فیلتر وضعیت، تعداد ردیف نمایش‌داده، ردیف باز */
let mgaF = '', mgaShow = 30, mgaOpen = '';
const MGA_FILTERS = [['all', 'همه', '#555'], ['on', '🟢 وارد شده', '#1E7D4F'], ['wait', '⚪ هنوز وارد نشده', '#777'], ['off', '⛔ غیرفعال / تمام‌شده', '#B3261E']];
const mgaDead = x => !x.active || (x.until && x.until < Date.now());
const mgaFState = x => mgaDead(x) ? 'off' : x.devices ? 'on' : 'wait';
const mgaNorm = s => String(s || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[‌\s]+/g, ' ').trim().toLowerCase();
function mgaFiltered() {
  const q = mgaNorm(mgaQ), qd = q.replace(/\D/g, '');
  return mgaData.people.filter(x => (!mgaF || mgaF === 'all' || mgaFState(x) === mgaF) && (!q || mgaNorm([x.name, x.role, x.company].join(' ')).includes(q) || (qd.length >= 3 && String(x.phone).includes(qd.replace(/^0/, '')))));
}
function mgaRender() {
  const el = document.getElementById('mgr-admin'); if (!el) return;
  if (mgaErr) { el.innerHTML = `<div class="empty-msg" style="color:#B3261E">${escH(mgaErr)}</div><button class="add-row-btn" onclick="mgaLoad()">🔄 دوباره</button>`; return; }
  if (!mgaData) { el.innerHTML = '<div class="empty-msg">در حال دریافت…</div>'; return; }
  const P = mgaData.people, cnt = k => k !== 'all' ? P.filter(x => mgaFState(x) === k).length : P.length;
  el.innerHTML = `
  <div class="mga-sum">${MGA_FILTERS.map(([k, l, c]) => `<button type="button" class="${(mgaF || 'all') === k ? 'on' : ''}" style="--c:${c}" onclick="mgaSetF('${k}')"><b>${mgaN(cnt(k))}</b><span>${l}</span></button>`).join('')}</div>
  <div class="mga-search"><input type="search" id="mgaQ" placeholder="🔎 نام، شماره‌ی موبایل یا شرکت را بنویسید…" value="${escH(mgaQ)}" oninput="mgaQ=this.value;mgaPage=0;mgaRenderList()" autocomplete="off"></div>
  <div id="mgaList"></div>

  <details class="mga-sec" id="mgaAdd" ${mgaEdit ? 'open' : ''}><summary>${mgaEdit ? '✏️ ویرایش مدیر' : '➕ افزودن یک نفر'}</summary><div class="mga-box">${mgaFormHTML()}</div></details>

  <details class="mga-sec" ${mgaImp ? 'open' : ''}><summary>📄 ورود یک‌جا از اکسل</summary><div style="padding:8px 2px">
    <div class="empty-msg" style="padding:0 0 8px;line-height:2;text-align:right">فایل اکسل (xlsx) یا CSV با ستون‌های <b>نام</b> و <b>موبایل</b> (و اگر دارید: سمت، شرکت، شهر). ردیف اول باید عنوان ستون‌ها باشد. شماره‌ای که از قبل هست، به‌روز می‌شود.</div>
    <input type="file" id="mgaFile" accept=".xlsx,.xls,.csv" onchange="mgaFile(this)">
    ${mgaImp ? `<div class="mga-imp">${mgaImp.err ? `<span style="color:#B3261E">${escH(mgaImp.err)}</span>` : `<b>${mgaN(mgaImp.rows.length)}</b> ردیف درست پیدا شد${mgaImp.bad ? `؛ ${mgaN(mgaImp.bad)} ردیف بدون نام یا شماره‌ی درست کنار گذاشته شد` : ''}.
      <div style="max-height:160px;overflow:auto;margin:6px 0;font-size:12.5px">${mgaImp.rows.slice(0, 50).map(r => `<div>${escH(r.name)} — <span dir="ltr">${escH(mgaFaPhone(r.phone))}</span> ${escH([r.role, r.company, MGA_CITIES[r.city]].filter(Boolean).join('، '))}</div>`).join('')}${mgaImp.rows.length > 50 ? '<div>…</div>' : ''}</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">اعتبار: <select id="mgaImpUntil" class="fsel-a">${MGA_UNTIL.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      <button class="pub-btn" onclick="mgaImport(this)">✅ افزودن ${mgaN(mgaImp.rows.length)} نفر</button><button class="lock-link" onclick="mgaImp=null;mgaRender()">انصراف</button></div>`}</div>` : ''}
  </div></details>

  <details class="mga-sec"><summary>📘 مدیران چطور وارد می‌شوند؟</summary><div class="empty-msg" style="line-height:2;padding:6px 2px;text-align:right">
    ۱. شماره‌ی موبایل مدیر را این‌جا ثبت کنید (همان شماره‌ای که با آن در بله است).<br>
    ۲. مدیر در برنامه: منوی «بیشتر» ← <b>«🔐 ورود مدیران کاروان»</b> ← «ورود با بازوی بله» ← در بله «📱 ارسال شماره من».<br>
    ۳. اگر شماره در فهرست باشد، بخش ویژه روی گوشی‌اش باز می‌شود (حداکثر ${mgaN(mgaData.max || 2)} گوشی برای هر شماره).<br>
    اگر کسی بله ندارد، روی نامش بزنید و «🔑 کد یک‌بارمصرف» را بزنید و کد را تلفنی به او بگویید (۲۴ ساعت اعتبار دارد).<br>
    با «غیرفعال کردن» یا حذف، دسترسی در اولین اتصال گوشی به اینترنت قطع می‌شود.</div></details>`;
  mgaRenderList();
}
function mgaSetF(k) { mgaF = mgaF === k || k === 'all' ? '' : k; mgaPage = 0; mgaRender(); }
/* ── جدول مدیران: ۵۰ نفر در هر صفحه، مرتب‌سازی با زدن عنوان ستون، باز شدن جزئیات با زدن ردیف ── */
const MGA_PER = 50;
let mgaPage = 0, mgaSort = { k: 'last', d: -1 };
const mgaDateS = t => t ? new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'short', timeZone: 'Asia/Tehran' }).format(t) : '';
const mgaRank = x => mgaDead(x) ? 4 : x.valid_from && x.valid_from > Date.now() ? 3 : x.devices ? 0 : 1;
function mgaShort(x) {
  if (!x.active) return ['⛔ غیرفعال', '#B3261E'];
  if (x.until && x.until < Date.now()) return ['⌛ تمام‌شده', '#B25B12'];
  if (x.valid_from && x.valid_from > Date.now()) return ['⏳ از ' + mgaDateS(x.valid_from), '#6B5BA8'];
  return x.devices ? ['🟢 وارد شده', '#1E7D4F'] : ['⚪ وارد نشده', '#777'];
}
const MGA_COLS = [
  ['name', 'نام', x => mgaNorm(x.name)], ['phone', 'موبایل', x => x.phone], ['company', 'شرکت', x => mgaNorm(x.company || x.role)],
  ['src', 'منبع', x => x.src === 'atabat' ? 0 : 1], ['st', 'وضعیت', mgaRank], ['until', 'اعتبار تا', x => x.until || 9e15], ['last', 'آخرین ورود', x => x.last_login || 0]];
function mgaSortBy(k) { mgaSort = mgaSort.k === k ? { k, d: -mgaSort.d } : { k, d: k === 'last' ? -1 : 1 }; mgaPage = 0; mgaRenderList(); }
function mgaDetHTML(x) {
  const [st, col] = mgaStatus(x), ph = escH(x.phone);
  return `<div class="mga-sub">${escH([x.role, x.company, MGA_CITIES[x.city] || x.city].filter(Boolean).join(' · ') || '—')}</div>
    ${x.src === 'atabat' ? `<div class="mga-sub">🧭 خودکار از سفرهای عتبات: دسترسی از ${mgaDate(x.valid_from)} تا ${mgaDate(x.until)} (۱۵ روز قبل از ورود تا ۱۰ روز بعد از خروج)</div>` : x.trip_to ? `<div class="mga-sub">🧭 در سفرهای عتبات هم هست (سفر تا ${mgaDate(x.trip_to)})؛ چون دستی ثبت شده، نام و شرکتش دست نمی‌خورد.</div>` : ''}
    <div class="mga-sub"><span style="color:${col};font-weight:800">${st}</span>${x.devices ? `، روی ${mgaN(x.devices)} گوشی` : ''}، آخرین ورود: ${mgaAgo(x.last_login)}${x.until ? `، تا ${mgaDate(x.until)}` : ''}</div>
    <div class="mga-act"><button onclick="mgaEditOpen('${ph}')">✏️ ویرایش</button><button onclick="mgaOtp('${ph}')">🔑 کد یک‌بارمصرف</button>
      ${x.devices ? `<button onclick="mgaRevoke('${ph}')">⏏️ خروج از گوشی‌ها</button>` : ''}<button class="del" onclick="mgaDel('${ph}')">🗑 حذف</button></div>`;
}
function mgaRenderList() {
  const el = document.getElementById('mgaList'); if (!el || !mgaData) return;
  if (!mgaData.people.length) { el.innerHTML = '<div class="empty-msg">هنوز کسی ثبت نشده است. فایل افزونه‌ی عتبات را در کادر بالا بارگذاری کنید، یا از «➕ افزودن یک نفر» و «📄 ورود یک‌جا از اکسل» در پایین شروع کنید.</div>'; return; }
  const c = MGA_COLS.find(x => x[0] === mgaSort.k) || MGA_COLS[6], f = c[2], d = mgaSort.d;
  const L = mgaFiltered().sort((a, b) => { const x = f(a), y = f(b); return (typeof x === 'string' ? x.localeCompare(y, 'fa') : x - y) * d || mgaNorm(a.name).localeCompare(mgaNorm(b.name), 'fa'); });
  if (!L.length) { el.innerHTML = '<div class="empty-msg">کسی با این جستجو پیدا نشد.</div>'; return; }
  const pages = Math.ceil(L.length / MGA_PER); if (mgaPage >= pages) mgaPage = pages - 1;
  const R = L.slice(mgaPage * MGA_PER, (mgaPage + 1) * MGA_PER);
  const pager = pages > 1 ? `<div class="mgt-pg"><button ${mgaPage ? '' : 'disabled'} onclick="mgaPage--;mgaRenderList()">› قبلی</button>
    <span>صفحه‌ی ${mgaN(mgaPage + 1)} از ${mgaN(pages)}</span><button ${mgaPage < pages - 1 ? '' : 'disabled'} onclick="mgaPage++;mgaRenderList()">بعدی ‹</button></div>` : '';
  el.innerHTML = `<div class="mga-cap">${mgaN(L.length)} نفر · ردیف ${mgaN(mgaPage * MGA_PER + 1)} تا ${mgaN(mgaPage * MGA_PER + R.length)}</div>
  <div class="mgt-wrap"><table class="mgt"><thead><tr>${MGA_COLS.map(([k, l]) => `<th class="c-${k}"><button onclick="mgaSortBy('${k}')" class="${mgaSort.k === k ? 'on' : ''}">${l} <span>${mgaSort.k === k ? (mgaSort.d > 0 ? '▲' : '▼') : '⇅'}</span></button></th>`).join('')}<th></th></tr></thead>
  <tbody>${R.map(x => { const [st, col] = mgaShort(x), open = mgaOpen === x.phone, ph = escH(x.phone);
    return `<tr class="mgt-r ${open ? 'open' : ''}" onclick="mgaOpen=mgaOpen==='${ph}'?'':'${ph}';mgaRenderList()">
      <td class="c-name"><b>${escH(x.name)}</b></td><td class="c-phone" dir="ltr">${escH(mgaFaPhone(x.phone))}</td><td class="c-company">${escH(x.company || x.role || '')}</td>
      <td class="c-src">${x.src === 'atabat' ? '<span class="mga-src">🧭 عتبات</span>' : '<span class="mgt-man">دستی</span>'}</td>
      <td class="c-st" style="color:${col}">${st}</td><td class="c-until">${x.until ? mgaDateS(x.until) : '—'}</td><td class="c-last">${x.last_login ? mgaAgo(x.last_login) : '—'}</td><td class="mgt-chev">${open ? '▴' : '▾'}</td></tr>
      ${open ? `<tr class="mgt-d"><td colspan="8">${mgaDetHTML(x)}</td></tr>` : ''}`; }).join('')}</tbody></table></div>${pager}`;
}
function mgaFormHTML() {
  const e = mgaEdit || {}, old = e.phone || '';
  const daysLeft = e.until ? Math.round((e.until - Date.now()) / 864e5) : '';
  return `<div class="field-label">${old ? '✏️ ویرایش' : '➕ افزودن مدیر کاروان'}</div>
    <div class="mga-form">
      <input id="mgaName" class="input-full" placeholder="نام و نام خانوادگی" value="${escH(e.name || '')}">
      <input id="mgaPhone" class="input-full" dir="ltr" inputmode="tel" placeholder="09123456789" value="${escH(e.phone || '')}">
      <select id="mgaRole" class="fsel-a">${MGA_ROLES.map(r => `<option ${(e.role || MGA_ROLES[0]) === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
      <input id="mgaCo" class="input-full" placeholder="شرکت مجری (اختیاری)" value="${escH(e.company || '')}">
      <select id="mgaCity" class="fsel-a"><option value="">شهر (اختیاری)</option>${Object.entries(MGA_CITIES).map(([k, n]) => `<option value="${k}" ${e.city === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select id="mgaUntil" class="fsel-a">${old && e.until ? `<option value="keep" selected>تا ${mgaDate(e.until)} (${mgaN(Math.max(0, daysLeft))} روز مانده)</option>` : ''}${MGA_UNTIL.map(([v, l]) => `<option value="${v}" ${!old || !e.until ? (v === '' ? 'selected' : '') : ''}>${l}</option>`).join('')}</select>
    </div>
    ${old ? `<label style="display:flex;gap:6px;align-items:center;margin-top:8px;font-size:13px"><input type="checkbox" id="mgaActive" ${e.active ? 'checked' : ''}> فعال (اگر بردارید، از همه‌ی گوشی‌ها خارج می‌شود)</label>` : ''}
    <div style="display:flex;gap:8px;margin-top:8px"><button class="pub-btn" onclick="mgaSave(this)">${old ? '💾 ذخیره' : '➕ افزودن'}</button>${old ? '<button class="lock-link" onclick="mgaEdit=null;mgaRender()">انصراف</button>' : ''}</div>`;
}
function mgaEditOpen(phone) { mgaEdit = mgaData.people.find(x => x.phone === phone) || null; mgaRender(); document.getElementById('mgaAdd').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
async function mgaSave(btn) {
  const v = id => document.getElementById(id).value, e = mgaEdit, u = v('mgaUntil');
  const body = { name: v('mgaName').trim(), phone: v('mgaPhone'), role: v('mgaRole'), company: v('mgaCo').trim(), city: v('mgaCity'),
    until: u === 'keep' ? e.until : u ? Date.now() + u * 864e5 : null, old: e ? e.phone : '', active: e ? document.getElementById('mgaActive').checked : true };
  if (!body.name || !body.phone) return showToast('نام و شماره را بنویسید');
  btn.disabled = true;
  try { await adminFetch('/admin/mgr/save', body, adminAuth()); showToast(e ? 'ذخیره شد ✅' : 'اضافه شد ✅'); mgaEdit = null; mgaLoad(); }
  catch (er) { showToast(er.message); btn.disabled = false; }
}
async function mgaDel(phone) {
  const x = mgaData.people.find(p => p.phone === phone);
  if (!confirm(`«${x.name}» از فهرست حذف شود؟ دسترسی‌اش روی همه‌ی گوشی‌ها قطع می‌شود.`)) return;
  try { await adminFetch('/admin/mgr/del', { phone }, adminAuth()); showToast('حذف شد'); mgaLoad(); } catch (e) { showToast(e.message); }
}
async function mgaRevoke(phone) {
  const x = mgaData.people.find(p => p.phone === phone);
  if (!confirm(`«${x.name}» از همه‌ی گوشی‌ها خارج شود؟ (در فهرست می‌ماند و می‌تواند دوباره وارد شود)`)) return;
  try { await adminFetch('/admin/mgr/revoke', { phone }, adminAuth()); showToast('خارج شد'); mgaLoad(); } catch (e) { showToast(e.message); }
}
async function mgaOtp(phone) {
  try {
    const r = await adminFetch('/admin/mgr/otp', { phone }, adminAuth());
    alert(`کد یک‌بارمصرف برای «${r.name}»:\n\n${r.otp}\n\nاین کد را تلفنی به خودش بگویید. در برنامه: بیشتر ← ورود مدیران کاروان ← «کد ۶ رقمی». تا ۲۴ ساعت و فقط یک بار معتبر است.`);
  } catch (e) { showToast(e.message); }
}

/* ── اکسل / CSV ── */
function mgaSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = () => no(new Error('بارگذاری خواننده‌ی اکسل ممکن نشد (اینترنت؟)')); document.head.appendChild(s); });
}
async function mgaFile(inp) {
  const f = inp.files[0]; if (!f) return;
  try {
    await mgaSheetJS();
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });
    const norm = s => String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
    const hi = rows.findIndex(r => r.some(c => /نام/.test(norm(c))) && r.some(c => /موبایل|همراه|تلفن|شماره|mobile|phone/i.test(norm(c))));
    if (hi < 0) throw new Error('ستون‌های «نام» و «موبایل» در فایل پیدا نشد.');
    const H = rows[hi].map(norm), col = re => H.findIndex(h => re.test(h));
    const ci = { name: col(/نام/), phone: col(/موبایل|همراه|تلفن|شماره|mobile|phone/i), role: col(/سمت|نقش/), company: col(/شرکت|مجری/), city: col(/شهر/) };
    const cityKey = c => { c = norm(c); return Object.keys(MGA_CITIES).find(k => MGA_CITIES[k] === c || (k === 'kadhimiya' && /کاظم/.test(c))) || ''; };
    const normP = p => { let d = String(p).replace(/[۰-۹]/g, x => '۰۱۲۳۴۵۶۷۸۹'.indexOf(x)).replace(/[٠-٩]/g, x => '٠١٢٣٤٥٦٧٨٩'.indexOf(x)).replace(/\D/g, '');
      if (/^989\d{9}$/.test(d)) d = '0' + d.slice(2); else if (/^9\d{9}$/.test(d)) d = '0' + d; return d; };
    const okPhone = d => /^09\d{9}$/.test(d) || /^00\d{9,15}$/.test(d);
    const out = [], seen = new Set(); let bad = 0;
    rows.slice(hi + 1).forEach(r => {
      if (!r.some(c => String(c).trim())) return;
      const x = { name: norm(r[ci.name]), phone: normP(r[ci.phone] || ''), role: ci.role >= 0 ? norm(r[ci.role]) : '', company: ci.company >= 0 ? norm(r[ci.company]) : '', city: ci.city >= 0 ? cityKey(r[ci.city]) : '' };
      if (!x.name || !okPhone(x.phone)) { bad++; return; }
      if (seen.has(x.phone)) return; seen.add(x.phone); out.push(x);
    });
    mgaImp = out.length ? { rows: out, bad } : { err: 'هیچ ردیفی با نام و شماره‌ی موبایل درست پیدا نشد.', rows: [] };
  } catch (e) { mgaImp = { err: e.message, rows: [] }; }
  mgaRender();
}
async function mgaImport(btn) {
  const u = document.getElementById('mgaImpUntil').value;
  btn.disabled = true;
  try { const r = await adminFetch('/admin/mgr/import', { rows: mgaImp.rows, until: u ? Date.now() + u * 864e5 : null }, adminAuth()); showToast(`✅ ${mgaN(r.n)} نفر ثبت شد`); mgaImp = null; mgaLoad(); }
  catch (e) { showToast(e.message); btn.disabled = false; }
}

(function injectMgaCSS() {
  document.head.insertAdjacentHTML('beforeend', `<style>
  .mga-sum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}
  @media(max-width:560px){.mga-sum{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .mga-sum>button{background:var(--card2,#f6f1e7);border:1.5px solid transparent;border-radius:12px;padding:9px 6px;text-align:center;display:flex;flex-direction:column;cursor:pointer;font:inherit;color:inherit}
  .mga-sum>button.on{border-color:var(--c);box-shadow:inset 0 -3px 0 var(--c)}
  .mga-sum b{font-size:21px}.mga-sum span{font-size:12px;color:var(--dim,#777)}
  .mga-search input{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:12px 14px;border-radius:12px;border:1.5px solid var(--border-s);background:var(--card)}
  .mga-search input:focus{outline:none;border-color:var(--pri,#0E5A44)}
  .mga-hint{font-size:13px;color:var(--dim,#777);padding:12px 4px;line-height:1.9}
  .mga-cap{font-size:12px;color:var(--dim,#777);margin:12px 2px 4px;font-weight:700}
  .mga-list{border:1px solid var(--border);border-radius:12px;overflow:hidden}
  .mga-row{border-bottom:1px solid var(--border)}.mga-row:last-child{border-bottom:0}
  .mga-row.open{background:var(--card2,#f6f1e7)}
  .mga-line{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;border:0;background:none;font:inherit;color:inherit;text-align:right;cursor:pointer;min-height:44px}
  .mga-line i{width:9px;height:9px;border-radius:50%;flex:none}
  .mga-line b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .mga-ph{color:var(--dim,#777);font-size:12.5px;flex:none}
  .mga-co{flex:1;min-width:0;font-size:12px;color:var(--dim,#777);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mga-chev{margin-inline-start:auto;width:7px;height:7px;border-left:2px solid var(--dim,#777);border-bottom:2px solid var(--dim,#777);transform:rotate(-45deg);flex:none;transition:transform .2s}
  .mga-row.open .mga-chev{transform:rotate(135deg)}
  @media(max-width:560px){.mga-co{display:none}}
  .mga-det{padding:0 12px 10px 12px}
  .mga-sub{font-size:12.5px;color:var(--dim,#777);line-height:1.9}
  .mga-act{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
  .mga-act button{border:1px solid var(--border-s);background:var(--card);border-radius:9px;min-height:36px;padding:0 10px;cursor:pointer;font:inherit;font-size:13px}
  .mga-act button.del{color:#B3261E;border-color:#B3261E55}
  .mga-sec{margin-top:10px;border:1px solid var(--border);border-radius:12px;padding:0 12px}
  .mga-sec>summary{cursor:pointer;padding:12px 0;font-weight:800;font-size:14px}
  .mga-box{padding:4px 0 12px}
  .mga-form{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  @media(max-width:560px){.mga-form{grid-template-columns:1fr}}
  .mgt-wrap{overflow-x:auto;border:1px solid var(--border-s);border-radius:12px;background:var(--card)}
  .mgt{width:100%;border-collapse:collapse;font-size:13px}.mgt th{background:var(--card2,#f6f1e7);position:sticky;top:0;text-align:right;padding:0;white-space:nowrap}
  .mgt th button{border:0;background:none;padding:9px 8px;font-family:var(--font);font-size:12.5px;font-weight:800;cursor:pointer;color:var(--text);width:100%;text-align:right}
  .mgt th button span{color:var(--dim,#999);font-size:11px}.mgt th button.on span{color:#1E7D4F}
  .mgt td{padding:7px 8px;border-top:1px solid var(--border-s);white-space:nowrap;vertical-align:middle}
  .mgt td.c-name{white-space:normal;min-width:120px}.mgt td.c-company{white-space:normal;max-width:180px;color:var(--dim,#666)}
  .mgt-r{cursor:pointer}.mgt-r:hover,.mgt-r.open{background:#1E7D4F0d}.mgt-chev{color:var(--dim,#999);width:20px}
  .mgt-d td{background:#1E7D4F08;white-space:normal;padding:8px 12px}.mgt-man{font-size:11px;color:var(--dim,#888)}
  .mgt-pg{display:flex;align-items:center;justify-content:center;gap:12px;margin:10px 0;font-size:13px}
  .mgt-pg button{border:1px solid var(--border-s);background:var(--card);border-radius:10px;padding:7px 14px;font-family:var(--font);cursor:pointer}.mgt-pg button:disabled{opacity:.4;cursor:default}
  @media(max-width:640px){.mgt .c-src,.mgt .c-until,.mgt .c-company{display:none}}
  .mga-src{font-size:11px;background:#6B5BA81a;color:#5A4A96;border-radius:999px;padding:1px 6px;font-weight:700}
  .mg-sub{display:flex;gap:6px;margin:0 0 12px;flex-wrap:wrap}.mg-sub button{flex:1 1 160px;border:1px solid var(--border-s);background:var(--card);border-radius:12px;padding:10px;font-family:var(--font);font-size:14px;font-weight:700;cursor:pointer;color:var(--text)}
  .mg-sub button.on{background:#1E7D4F;color:#fff;border-color:#1E7D4F}.mg-hide{display:none!important}
  .mga-imp{margin-top:8px;padding:10px;border-radius:10px;background:var(--card2,#f6f1e7);font-size:13px;line-height:1.9}
  </style>`);
})();

/* ══ 🏢 شرکت‌های مجری — تب جدا (محتوای بخش ویژه‌ی مدیران؛ فقط روی سرور، نه data.js) ══
   هر شرکت: نام، مدیرعامل، آدرس، تلفن شرکت، توضیح، و چند نماینده در عراق (نام، موبایل ایران، موبایل عراق) */
let mcoData = null, mcoErr = '', mcoQ = '', mcoEdit = null, mcoImp = null;
function mcoLoad() {
  mcoErr = ''; mcoRender();
  adminFetch('/admin/mgr/co', null, adminAuth()).then(d => { mcoData = d; mcoRender(); }).catch(e => { mcoErr = e.message; mcoRender(); });
}
const mcoBlank = () => ({ name: '', ceo: '', address: '', phone: '', note: '', reps: [{ name: '', ir: '', iq: '' }] });
/* مقدارهای فرم را قبل از هر بازسازی در mcoEdit نگه می‌داریم */
function mcoRead() {
  const box = document.getElementById('mcoForm'); if (!box || !mcoEdit) return;
  ['name', 'ceo', 'address', 'phone', 'note'].forEach(k => { const el = box.querySelector(`[data-f="${k}"]`); if (el) mcoEdit[k] = el.value.trim(); });
  mcoEdit.reps = [...box.querySelectorAll('.mco-rep')].map(r => ({ name: r.querySelector('[data-r="name"]').value.trim(), ir: r.querySelector('[data-r="ir"]').value.trim(), iq: r.querySelector('[data-r="iq"]').value.trim() }));
}
function mcoRender() {
  const el = document.getElementById('mgrco-admin'); if (!el) return;
  if (mcoErr) { el.innerHTML = `<div class="empty-msg" style="color:#B3261E">${escH(mcoErr)}</div><button class="add-row-btn" onclick="mcoLoad()">🔄 دوباره</button>`; return; }
  if (!mcoData) { el.innerHTML = '<div class="empty-msg">در حال دریافت…</div>'; return; }
  if (!mcoEdit) mcoEdit = mcoBlank();
  const e = mcoEdit, inp = (k, ph, x = '') => `<input data-f="${k}" class="input-full" placeholder="${ph}" value="${escH(e[k] || '')}" ${x}>`;
  el.innerHTML = mcoBotHTML() + `
  <div class="mga-box" id="mcoForm"><div class="field-label">${e.id ? `✏️ ویرایش «${escH(e.name)}»` : '➕ افزودن شرکت مجری'}</div>
    <div class="mga-form">
      ${inp('name', 'نام شرکت مجری', 'list="mcoSug"')}
      ${inp('ceo', 'نام و نام خانوادگی مدیرعامل')}
      ${inp('phone', 'تلفن شرکت (دفتر مرکزی)', 'dir="ltr" inputmode="tel"')}
      ${inp('note', 'توضیح کوتاه (اختیاری)')}
    </div>
    <textarea data-f="address" class="input-full mco-addr" rows="2" placeholder="آدرس شرکت">${escH(e.address || '')}</textarea>
    <datalist id="mcoSug">${mcoData.suggest.map(x => `<option value="${escH(x.name)}">`).join('')}</datalist>
    <div class="field-label" style="margin-top:10px">👤 نماینده یا نمایندگان شرکت در عراق</div>
    ${e.reps.map((r, i) => `<div class="mco-rep"><span class="mco-n">${mgaN(i + 1)}</span>
      <input data-r="name" class="input-full" placeholder="نام و نام خانوادگی نماینده" value="${escH(r.name)}">
      <input data-r="ir" class="input-full" dir="ltr" inputmode="tel" placeholder="موبایل ایران 09…" value="${escH(r.ir)}">
      <input data-r="iq" class="input-full" dir="ltr" inputmode="tel" placeholder="موبایل عراق 07… یا +964…" value="${escH(r.iq)}">
      <button class="del-btn" title="حذف این نماینده" onclick="mcoRead();mcoEdit.reps.splice(${i},1);if(!mcoEdit.reps.length)mcoEdit.reps.push({name:'',ir:'',iq:''});mcoRender()">🗑</button></div>`).join('')}
    <button class="add-row-btn" onclick="mcoRead();mcoEdit.reps.push({name:'',ir:'',iq:''});mcoRender()">＋ نماینده‌ی دیگر</button>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="pub-btn" onclick="mcoSave(this)">${e.id ? '💾 ذخیره' : '➕ افزودن شرکت'}</button><button class="lock-link" onclick="mcoEdit=null;mcoRender()">${e.id ? 'انصراف' : 'پاک کردن فرم'}</button></div>
    <div class="empty-msg" style="padding:6px 0 0">در اپلیکیشن کنار هر شماره دکمه‌ی تماس و واتس‌اپ ساخته می‌شود؛ تماس با پیش‌شماره‌ی بین‌المللی است تا با سیم‌کارت ایرانی در عراق هم وصل شود.</div></div>

  ${mcoData.suggest.length ? `<details class="gd-det"><summary><b>💡 ${mgaN(mcoData.suggest.length)} شرکت مجری در اکسل‌های هفتگی سامانه‌ی نواقص هست که هنوز این‌جا ثبت نشده</b></summary>
    <div class="mco-sug">${mcoData.suggest.slice(0, 150).map((x, i) => `<button onclick="mcoEdit={...mcoBlank(),name:mcoData.suggest[${i}].name};mcoRender();document.querySelector('#mcoForm [data-f=ceo]').focus()">＋ ${escH(x.name)} <span>(${mgaN(x.n)} ردیف)</span></button>`).join('')}</div></details>` : ''}

  <details class="gd-det" ${mcoImp ? 'open' : ''}><summary><b>📄 ورود یک‌جا از اکسل</b></summary><div style="padding:8px 0">
    <div class="empty-msg" style="padding:0 0 8px;line-height:2">ستون‌ها: <b>نام شرکت</b>، مدیرعامل، آدرس، تلفن شرکت، <b>نام نماینده</b>، <b>موبایل ایران</b>، <b>موبایل عراق</b>، توضیح. ردیف اول عنوان ستون‌ها.<br>
      اگر شرکتی چند نماینده دارد، برای هر نماینده یک ردیف با <b>همان نام شرکت</b> بنویسید. شرکتی که از قبل هست به‌روز می‌شود.</div>
    <input type="file" accept=".xlsx,.xls,.csv" onchange="mcoFile(this)">
    ${mcoImp ? `<div class="mga-imp">${mcoImp.err ? `<span style="color:#B3261E">${escH(mcoImp.err)}</span>` : `<b>${mgaN(mcoImp.rows.length)}</b> شرکت با ${mgaN(mcoImp.rows.reduce((a, r) => a + r.reps.length, 0))} نماینده پیدا شد.
      <div style="max-height:180px;overflow:auto;margin:6px 0;font-size:12.5px">${mcoImp.rows.slice(0, 60).map(r => `<div><b>${escH(r.name)}</b>${r.ceo ? `، مدیرعامل: ${escH(r.ceo)}` : ''}${r.reps.length ? `، نمایندگان: ${escH(r.reps.map(x => x.name || x.iq || x.ir).join('، '))}` : ''}</div>`).join('')}</div>
      <button class="pub-btn" onclick="mcoImport(this)">✅ ثبت ${mgaN(mcoImp.rows.length)} شرکت</button> <button class="lock-link" onclick="mcoImp=null;mcoRender()">انصراف</button>`}</div>` : ''}
  </div></details>

  <div class="field-label" style="margin-top:14px">🏢 شرکت‌های ثبت‌شده (${mgaN(mcoData.list.length)})</div>
  <input type="search" class="input-full" placeholder="🔎 جستجوی شرکت، مدیرعامل، نماینده یا شماره…" value="${escH(mcoQ)}" oninput="mcoQ=this.value;mcoList()" style="margin:6px 0 8px">
  <div id="mcoList"></div>`;
  mcoList();
}
function mcoList() {
  const el = document.getElementById('mcoList'); if (!el || !mcoData) return;
  const q = mcoQ.trim().replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const hay = c => [c.name, c.ceo, c.address, c.phone, c.note, ...c.reps.flatMap(r => [r.name, r.ir, r.iq])].join(' ');
  const L = q ? mcoData.list.filter(c => hay(c).includes(q)) : mcoData.list;
  const P = v => v ? `<span dir="ltr">${escH(mgaFaPhone(v.replace(/^00/, '+')))}</span>` : '';
  const sb = id => (mcoData.bot && mcoData.bot.subs[id]) || {};
  el.innerHTML = L.length ? L.map(c => `<div class="mga-row"><div class="mga-main"><b>${escH(c.name)}</b>${sb(c.id).bot ? ' <span class="mco-bb">🤖 از بله</span>' : ''}
      <div class="mga-sub">${c.ceo ? `مدیرعامل: ${escH(c.ceo)}` : '<span style="color:#B25B12">مدیرعامل ثبت نشده</span>'}${c.phone ? `، تلفن شرکت: ${P(c.phone)}` : ''}</div>
      ${c.address ? `<div class="mga-sub">📍 ${escH(c.address)}</div>` : ''}
      ${c.reps.length ? c.reps.map(r => `<div class="mga-sub">👤 ${escH(r.name || 'نماینده')}${r.ir ? `، ایران: ${P(r.ir)}` : ''}${r.iq ? `، عراق: ${P(r.iq)}` : ''}</div>`).join('') : '<div class="mga-sub" style="color:#B25B12">نماینده ثبت نشده</div>'}</div>
    <div class="mga-act"><button onclick="mcoEdit=JSON.parse(JSON.stringify(mcoData.list.find(x=>x.id===${c.id})));if(!mcoEdit.reps.length)mcoEdit.reps.push({name:'',ir:'',iq:''});mcoRender();document.getElementById('mcoForm').scrollIntoView({behavior:'smooth'})" title="ویرایش">✏️</button>
      ${mcoData.bot ? `<button onclick="mcoInv(${c.id})" title="لینک اختصاصی این شرکت در بله">🔗</button>` : ''}
      <button onclick="mcoDel(${c.id})" title="حذف">🗑</button></div></div>`).join('')
    : `<div class="empty-msg">${mcoData.list.length ? 'شرکتی با این جستجو پیدا نشد.' : 'هنوز شرکتی ثبت نشده است. از فرم بالا یا «ورود یک‌جا از اکسل» شروع کنید.'}</div>`;
}
/* 🤖 درخواست‌های بازوی بله: شرکت‌ها خودشان نماینده معرفی می‌کنند؛ این‌جا فقط تأیید/رد */
const MCO_MSG = l => `سلام و احترام 🌷\nبرای ثبت اطلاعات مدیرعامل و نمایندگان شرکت در عراق در «همیار کاروان»، لطفاً روی لینک زیر بزنید و به چند سؤال کوتاه در بله پاسخ دهید (حدود ۲ دقیقه):\n${l}\n\nاطلاعات پس از بررسی ستاد ثبت می‌شود و فقط برای مدیران کاروان قابل مشاهده است.`;
function mcoCopy(t, ok) {
  const done = () => showToast(ok || 'کپی شد ✅');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => prompt('کپی کنید:', t));
  else prompt('کپی کنید:', t);
}
function mcoBotHTML() {
  const b = mcoData.bot; if (!b) return '';
  const byId = id => mcoData.list.find(c => c.id === id);
  const P = v => v ? `<span dir="ltr">${escH(mgaFaPhone(String(v).replace(/^00/, '+')))}</span>` : '—';
  const card = (d, name) => `<div class="mco-cd"><div><b>👔 مدیرعامل:</b> ${escH(d.ceo || '—')}</div>
    ${(d.reps || []).map(r => `<div><b>👤 ${escH(r.name || 'نماینده')}</b> — ایران: ${P(r.ir)}، عراق: ${P(r.iq)}</div>`).join('') || '<div>👤 —</div>'}
    <div><b>📍</b> ${escH(d.address || '—')}</div><div><b>☎️</b> ${P(d.phone)}</div></div>`;
  const flagCls = k => k === 'change' || k === 'other' ? 'bad' : k === 'match' || k === 'inv' || k === 'self' ? 'good' : 'mid';
  const missing = mcoData.list.filter(c => !(b.subs[c.id] || {}).bot && !c.reps.length);
  const W = b.wait.map(r => {
    const old = r.co_id && byId(r.co_id), hadOld = old && (old.ceo || old.reps.length || old.address);
    return `<div class="mco-req"><div class="mco-rh"><b>🏢 ${escH(r.co_name || '')}</b><span>${escH(new Date(r.t).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }))}</span></div>
      <div class="mga-sub">فرستنده: ${escH(r.bale_name || '—')} — ${P(r.phone)} <span title="شماره را خود بله تأیید کرده">✔︎ بله</span></div>
      ${r.flags.map(f => `<div class="mco-flag ${flagCls(f.k)}">${escH(f.t)}</div>`).join('')}
      ${hadOld ? `<div class="mco-cmp"><div><div class="mco-cl">اطلاعات فعلی</div>${card(old)}</div><div><div class="mco-cl">اطلاعات جدید</div>${card(r.data)}</div></div>` : card(r.data)}
      <div class="mco-btns"><button class="pub-btn" onclick="mcoDecide(${r.id},'ok',this)">✅ تأیید و ثبت</button>
        <button class="lock-link" onclick="mcoDecide(${r.id},'no',this)">❌ رد</button>
        <button class="lock-link" style="color:#B3261E" onclick="mcoDecide(${r.id},'bl',this)">🚫 رد و مسدود کردن شماره</button></div></div>`;
  }).join('');
  return `<div class="mga-box mco-bot">
    ${b.wait.length ? `<div class="field-label">📥 ${mgaN(b.wait.length)} درخواست از بازوی بله در انتظار تأیید شما</div>${W}`
      : `<div class="field-label">🤖 معرفی نماینده توسط خود شرکت‌ها (بازوی بله)</div><div class="empty-msg" style="padding:2px 0 6px">درخواستی در انتظار تأیید نیست.${b.drafts ? ` ${mgaN(b.drafts)} نفر الان در حال پر کردن هستند.` : ''}</div>`}
    ${b.owner ? '' : '<div class="mco-flag mid">ℹ️ پیام‌های بله‌ی مدیر اصلی هنوز وصل نیست؛ درخواست‌ها فقط همین‌جا دیده می‌شوند (اتصال: پنل ☁️ نگهبان سرور).</div>'}
    <details class="gd-det"><summary><b>🔗 لینک بازو برای فرستادن به شرکت‌ها</b></summary><div style="padding:8px 0;line-height:2">
      این لینک را در گروه شرکت‌ها بگذارید یا برایشان بفرستید. شرکت در بله شماره‌اش را با دکمه می‌فرستد، شرکتش را انتخاب می‌کند، مدیرعامل، نمایندگان، آدرس و تلفن را می‌نویسد. <b>تا شما تأیید نکنید چیزی ثبت نمی‌شود.</b>
      <div class="mco-link" dir="ltr">${escH(b.link)}</div>
      <button class="pub-btn" onclick="mcoCopy(mcoData.bot.link)">📋 کپی لینک</button> <button class="lock-link" onclick="mcoCopy(MCO_MSG(mcoData.bot.link),'متن پیام کپی شد ✅')">📋 کپی متن آماده‌ی پیام</button>
      <div class="empty-msg" style="padding:6px 0 0">برای شرکتی که می‌خواهید خیالتان کاملاً راحت باشد، دکمه‌ی 🔗 کنار همان شرکت (پایین صفحه) یک <b>لینک اختصاصی</b> می‌دهد که فقط به همان شرکت وصل است.</div></div></details>
    ${missing.length ? `<details class="gd-det"><summary><b>⏳ ${mgaN(missing.length)} شرکت هنوز نماینده‌ای ندارند</b></summary><div class="mco-miss">${missing.map(c => `<span>${escH(c.name)} <button onclick="mcoInv(${c.id})" title="کپی لینک اختصاصی">🔗</button></span>`).join('')}</div></details>` : ''}
    ${b.done.length ? `<details class="gd-det"><summary><b>🗂 آخرین بررسی‌ها</b></summary><div style="padding:6px 0;font-size:12.5px;line-height:2">${b.done.map(r => `<div>${r.state === 'ok' ? '✅' : r.state === 'blocked' ? '🚫' : '❌'} ${escH(r.co_name || '')} — ${P(r.phone)} <span style="color:var(--dim,#888)">(${escH(r.by || '')})</span></div>`).join('')}</div></details>` : ''}
    ${b.blocked.length ? `<details class="gd-det"><summary><b>🚫 شماره‌های مسدود (${mgaN(b.blocked.length)})</b></summary><div style="padding:6px 0">${b.blocked.map(x => `<div>${P(x.phone)} <button class="lock-link" onclick="mcoUnblock('${escH(x.phone)}')">رفع مسدودی</button></div>`).join('')}</div></details>` : ''}
  </div>`;
}
async function mcoDecide(id, act, btn) {
  const r = mcoData.bot.wait.find(x => x.id === id);
  if (act === 'bl' && !confirm(`درخواست «${r.co_name}» رد شود و شماره‌ی فرستنده دیگر نتواند از بازو اطلاعات بفرستد؟`)) return;
  btn.disabled = true;
  try { await adminFetch('/admin/mgr/co/req', { id, act }, adminAuth()); showToast(act === 'ok' ? 'تأیید و ثبت شد ✅ — به فرستنده هم در بله خبر داده شد' : 'رد شد'); mcoLoad(); }
  catch (e) { showToast(e.message); btn.disabled = false; mcoLoad(); }
}
async function mcoInv(id) {
  const c = mcoData.list.find(x => x.id === id);
  try { const r = await adminFetch('/admin/mgr/co/inv', { id }, adminAuth()); mcoCopy(MCO_MSG(r.url), `متن و لینک اختصاصی «${c.name}» کپی شد ✅`); }
  catch (e) { showToast(e.message); }
}
async function mcoUnblock(phone) {
  try { await adminFetch('/admin/mgr/co/unblock', { phone }, adminAuth()); showToast('رفع مسدودی شد'); mcoLoad(); } catch (e) { showToast(e.message); }
}
async function mcoSave(btn) {
  mcoRead();
  const body = { ...mcoEdit, reps: mcoEdit.reps.filter(r => r.name || r.ir || r.iq) };
  if (!body.name) return showToast('نام شرکت را بنویسید');
  if (!body.id && mcoData.list.some(c => c.name === body.name)) return showToast('این شرکت قبلاً ثبت شده؛ از ✏️ کنار آن ویرایش کنید');
  btn.disabled = true;
  try { await adminFetch('/admin/mgr/co/save', body, adminAuth()); showToast('ذخیره شد ✅ — مدیران با اتصال بعدی به اینترنت می‌بینند'); mcoEdit = null; mcoLoad(); }
  catch (e) { showToast(e.message); btn.disabled = false; }
}
async function mcoDel(id) {
  const c = mcoData.list.find(x => x.id === id);
  if (!confirm(`«${c.name}» حذف شود؟`)) return;
  try { await adminFetch('/admin/mgr/co/del', { id }, adminAuth()); showToast('حذف شد'); mcoLoad(); } catch (e) { showToast(e.message); }
}
async function mcoFile(inp) {
  const f = inp.files[0]; if (!f) return;
  try {
    await mgaSheetJS();
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });
    const norm = s => String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
    const hi = rows.findIndex(r => r.some(c => /شرکت|مجری/.test(norm(c))));
    if (hi < 0) throw new Error('ستون «نام شرکت» یا «شرکت مجری» پیدا نشد.');
    const H = rows[hi].map(norm), col = test => H.findIndex(test);
    const isPh = h => /شماره|تلفن|موبایل|همراه/.test(h);
    const ci = {
      name: col(h => /شرکت|مجری/.test(h) && !isPh(h) && !/آدرس|نشانی/.test(h)), ceo: col(h => /مدیر ?عامل/.test(h)), address: col(h => /آدرس|نشانی/.test(h)),
      phone: col(h => isPh(h) && /شرکت|دفتر/.test(h)), rep: col(h => /نماینده/.test(h) && !isPh(h)),
      ir: col(h => isPh(h) && /ایران/.test(h)), iq: col(h => isPh(h) && /عراق/.test(h)), note: col(h => /توضیح|ملاحظ/.test(h))
    };
    const g = (r, i) => i >= 0 ? norm(r[i]) : '';
    const by = new Map();
    rows.slice(hi + 1).forEach(r => {
      const name = g(r, ci.name); if (!name) return;
      let c = by.get(name);
      if (!c) by.set(name, c = { name, ceo: '', address: '', phone: '', note: '', reps: [] });
      ['ceo', 'address', 'phone', 'note'].forEach(k => { const v = g(r, ci[k]); if (v && !c[k]) c[k] = v; });
      const rep = { name: g(r, ci.rep), ir: g(r, ci.ir), iq: g(r, ci.iq) };
      if ((rep.name || rep.ir || rep.iq) && !c.reps.some(x => x.name === rep.name && x.ir === rep.ir && x.iq === rep.iq)) c.reps.push(rep);
    });
    const out = [...by.values()];
    mcoImp = out.length ? { rows: out } : { err: 'هیچ ردیفی با نام شرکت پیدا نشد.', rows: [] };
  } catch (e) { mcoImp = { err: e.message, rows: [] }; }
  mcoRender();
}
async function mcoImport(btn) {
  btn.disabled = true;
  try { const r = await adminFetch('/admin/mgr/co/import', { rows: mcoImp.rows }, adminAuth()); showToast(`✅ ${mgaN(r.n)} شرکت ثبت شد`); mcoImp = null; mcoLoad(); }
  catch (e) { showToast(e.message); btn.disabled = false; }
}
document.head.insertAdjacentHTML('beforeend', `<style>
  .mco-bot{border:1.5px solid #1E7D4F55}
  .mco-req{border:1px solid var(--border-s);border-radius:12px;padding:10px;margin:8px 0;background:var(--card)}
  .mco-rh{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.mco-rh span{font-size:12px;color:var(--dim,#888)}
  .mco-flag{font-size:12.5px;border-radius:8px;padding:4px 8px;margin:4px 0}
  .mco-flag.bad{background:#B3261E18;color:#B3261E;font-weight:700}.mco-flag.good{background:#1E7D4F18;color:#1E7D4F}.mco-flag.mid{background:#B25B1218;color:#8A4A10}
  .mco-cd{font-size:13px;line-height:1.9;background:var(--card2,#f6f1e7);border-radius:8px;padding:6px 8px;margin-top:6px;overflow-wrap:anywhere}
  .mco-cmp{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mco-cl{font-size:12px;font-weight:800;margin-top:6px}
  @media(max-width:620px){.mco-cmp{grid-template-columns:1fr}}
  .mco-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  .mco-link{background:var(--card2,#f6f1e7);border-radius:8px;padding:6px 10px;margin:6px 0;font-family:monospace;overflow-wrap:anywhere}
  .mco-miss{display:flex;flex-wrap:wrap;gap:6px;padding:8px 0}.mco-miss span{border:1px dashed var(--border-s);border-radius:999px;padding:3px 4px 3px 10px;font-size:12.5px}
  .mco-miss button{border:0;background:none;cursor:pointer}
  .mco-bb{font-size:11px;background:#1E7D4F18;color:#1E7D4F;border-radius:999px;padding:1px 7px;font-weight:600}
  .mco-sug{display:flex;flex-wrap:wrap;gap:6px;padding:8px 0}
  .mco-sug button{border:1px dashed var(--border-s);background:var(--card);border-radius:999px;padding:6px 10px;cursor:pointer;font-family:var(--font);font-size:12.5px}
  .mco-sug button span{color:var(--dim,#888)}
  textarea.mco-addr{margin-top:8px;height:auto;min-height:56px;background:#fff;color:var(--text);direction:rtl;font-size:13.5px;border:1px solid var(--border-s)}
  .mco-rep{display:grid;grid-template-columns:28px 1.3fr 1fr 1fr 40px;gap:6px;align-items:center;margin-bottom:6px}
  .mco-n{width:26px;height:26px;border-radius:50%;background:var(--card2,#f6f1e7);display:grid;place-items:center;font-size:12px;font-weight:800}
  @media(max-width:620px){.mco-rep{grid-template-columns:28px 1fr 40px}.mco-rep [data-r="ir"],.mco-rep [data-r="iq"]{grid-column:2/3}}
</style>`);

/* ══ تب «مدیران کاروان»: کادر راهنمای هفتگی (admin-trips.js) + جدول مدیران ══ */
function mgSubOpen() { if (typeof STAFF === 'undefined' || !STAFF || STAFF.perms.has('mgr')) mgaLoad(); }
