/* ══════════════════════════════════════════
   TRIPS ADMIN — بخش «🧭 سفرهای مدیران راهنما» (سرور: worker/trips.js، دسترسی همکاران: «trips»)
   اکسلی که افزونه‌ی «همیار کاروان» از سامانه‌ی عتبات می‌سازد این‌جا بارگذاری می‌شود.
   هر کاروان: تاریخ ورود به عراق، مدیر راهنما و موبایل، شرکت مجری، کارگزار، هتل‌های نجف/کربلا/کاظمین با تاریخ‌ها
   وضعیت: فعال (زائر دارد) | بدون زائر (هنوز ثبت نشده) | لغو شده (در سامانه قرمز، یا لغو دستی)
══════════════════════════════════════════ */
let trData = null, trErr = '', trImp = null, trQ = '', trSt = '', trFrom = '', trTo = '';
const TR_ST = { ok: ['فعال', '#1E7D4F', '#E3F3EA'], empty: ['بدون زائر', '#8A5A00', '#FFF4DC'], cancel: ['لغو شده', '#B3261E', '#FDE8E6'] };
const TR_CITY = [['najaf', 'نجف'], ['karbala', 'کربلا'], ['kadhimiya', 'کاظمین']];
const trFa = s => String(s ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const trEn = s => String(s ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const trJ = (() => { const f = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran' });
  return d => { const o = {}; f.formatToParts(d).forEach(p => o[p.type] = p.value); return `${o.year}/${o.month}/${o.day}`; }; })();
const trNorm = v => { const m = trEn(v).match(/(1[34]\d\d)\D+(\d{1,2})\D+(\d{1,2})/); return m ? `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}` : ''; };

function trLoad() {
  if (!trFrom) { trFrom = trJ(new Date(Date.now() - 3 * 864e5)); trTo = trJ(new Date(Date.now() + 14 * 864e5)); }
  trErr = ''; trRender();
  adminFetch(`/admin/mgr/trips?from=${encodeURIComponent(trNorm(trFrom))}&to=${encodeURIComponent(trNorm(trTo))}`, null, adminAuth())
    .then(d => { trData = d; trRender(); }).catch(e => { trErr = e.message; trRender(); });
}

function trRender() {
  const el = document.getElementById('trips-admin'); if (!el) return;
  const last = trData && trData.last && trData.last.n ? `<div class="mga-sub" style="margin-bottom:8px">آخرین بارگذاری: <b>${mgaAgo(trData.last.t)}</b>؛ در کل ${mgaN(trData.last.n)} کاروان با ورود از ${trFa(trData.last.a)} تا ${trFa(trData.last.b)}</div>` : '';
  el.innerHTML = `${last}

  <details class="gd-det" ${trImp ? 'open' : ''}><summary><b>📄 بارگذاری اکسل افزونه</b></summary><div style="padding:8px 0">
    <input type="file" accept=".xlsx" onchange="trFile(this)">
    ${trImp ? `<div class="mga-imp">${trImp.err ? `<span style="color:#B3261E">${escH(trImp.err)}</span>` : `
      فایل <b>${trFa(trImp.from)}</b> تا <b>${trFa(trImp.to)}</b>: <b>${mgaN(trImp.rows.length)}</b> کاروان؛
      ${['ok', 'empty', 'cancel'].map(s => `${TR_ST[s][0]} ${mgaN(trImp.rows.filter(r => r.status === s).length)}`).join('، ')}؛
      ${(() => { const np = trImp.rows.filter(r => !r.phone && r.status !== 'cancel').length, live = trImp.rows.filter(r => r.status !== 'cancel').length, ph = new Set(trImp.rows.filter(r => /^0?9\d{9}$/.test(r.phone) && r.status !== 'cancel').map(r => r.phone)).size;
        return np && np >= live * 0.5 ? `<div class="tr-warn">⚠️ <b>${mgaN(np)} کاروان از ${mgaN(live)} شماره‌ی مدیر ندارند.</b> این فایل احتمالاً درست ساخته نشده؛ قبل از ثبت، ستون «موبایل مدیر» را در خود فایل نگاه کنید (یا فایل را برای پشتیبانی بفرستید).</div>`
          : `<div class="tr-ok">📱 موبایل <b>${mgaN(ph)}</b> مدیر در فایل هست؛ بعد از ثبت، مدیرهای سفرهای جاری و آینده <b>خودکار</b> در «👥 مدیران و دسترسی» مجاز می‌شوند.${np ? ` (${mgaN(np)} کاروان بدون شماره)` : ''}</div>`; })()}
      <div style="margin-top:8px"><button class="pub-btn" onclick="trImport(this)">✅ ثبت ${mgaN(trImp.rows.length)} کاروان</button> <button class="lock-link" onclick="trImp=null;trRender()">انصراف</button></div>
      <div class="mga-sub">کاروان‌های همین روزها که قبلاً ثبت شده بودند با این فایل جایگزین می‌شوند؛ لغو دستی و شماره‌ای که خودتان اصلاح کرده‌اید می‌ماند.</div>`}</div>` : ''}
  </div></details>

  <div class="tr-flt">
    <label>از ورود<input id="trF" dir="ltr" value="${escH(trFa(trFrom))}" onchange="trFrom=this.value;trLoad()"></label>
    <label>تا<input id="trT" dir="ltr" value="${escH(trFa(trTo))}" onchange="trTo=this.value;trLoad()"></label>
    <input type="search" class="input-full" placeholder="🔎 مدیر، شماره، شرکت، کارگزار یا هتل…" value="${escH(trQ)}" oninput="trQ=this.value;trList()">
  </div>
  <div class="tr-chips" id="trChips"></div>
  <div id="trList"></div>`;
  trList();
}

function trRows() {
  const L = (trData && trData.rows) || [], q = trEn(trQ.trim());
  return L.filter(x => (!trSt || (trSt === 'nophone' ? !x.phone && x.status !== 'cancel' : x.status === trSt))
    && (!q || [x.mgr, x.phone, x.company, x.agent, x.agent_code, x.prov, ...x.hotels.map(h => h.h)].some(v => String(v || '').includes(q))));
}
function trList() {
  const el = document.getElementById('trList'); if (!el) return;
  const chips = document.getElementById('trChips');
  if (trErr) { el.innerHTML = `<div class="empty-msg" style="color:#B3261E">${escH(trErr)}</div><button class="add-row-btn" onclick="trLoad()">🔄 دوباره</button>`; chips.innerHTML = ''; return; }
  if (!trData) { el.innerHTML = '<div class="empty-msg">در حال دریافت…</div>'; chips.innerHTML = ''; return; }
  const A = trData.rows, cnt = s => s === 'nophone' ? A.filter(x => !x.phone && x.status !== 'cancel').length : s ? A.filter(x => x.status === s).length : A.length;
  chips.innerHTML = [['', 'همه'], ['ok', 'فعال'], ['empty', 'بدون زائر'], ['cancel', 'لغو شده'], ['nophone', 'بدون شماره مدیر']]
    .map(([k, t]) => `<button class="${trSt === k ? 'on' : ''}" onclick="trSt='${k}';trList()">${t} <b>${mgaN(cnt(k))}</b></button>`).join('');
  const L = trRows();
  if (!L.length) { el.innerHTML = `<div class="empty-msg">${A.length ? 'با این جستجو کاروانی پیدا نشد.' : 'در این بازه کاروانی ثبت نشده است. اکسل افزونه را بارگذاری کنید یا بازه‌ی تاریخ را عوض کنید.'}</div>`; return; }
  el.innerHTML = L.slice(0, 400).map(x => {
    const [st, fg, bg] = TR_ST[x.status];
    const hotels = TR_CITY.map(([k, fa]) => x.hotels.find(h => h.c === k)).filter(Boolean).map(h => {
      const city = TR_CITY.find(c => c[0] === h.c)[1], pass = !h.h && !(+h.n), unk = !pass && (!h.h || /نامشخص/.test(h.h));
      if (pass) return `<span class="tr-h pass"><b>${city}:</b> عبوری${h.in ? ` <small>${trFa(h.in.slice(5))}</small>` : ''}</span>`;
      return `<span class="tr-h${unk ? ' unk' : ''}"><b>${city}:</b> ${unk ? 'هتل هنوز معلوم نیست' : escH(h.h)}${h.in ? ` <small>${trFa(h.in.slice(5))} تا ${trFa((h.out || '').slice(5))}</small>` : ''}</span>`;
    }).join('');
    const k = escH(JSON.stringify(x.key));
    return `<div class="tr-row" style="${x.status === 'cancel' ? 'opacity:.65' : ''}">
      <div class="tr-top"><span class="tr-pill" style="color:${fg};background:${bg}">${st}${x.manual === 'cancel' ? ' (دستی)' : ''}</span>
        <b>${trFa(x.entry)}</b><span class="mga-sub">${escH(x.border)} · ${mgaN(x.pilgrims)} زائر · ${escH(x.prov)}</span></div>
      <div class="tr-mgr">👤 ${x.mgr ? escH(x.mgr) : '<span style="color:#B25B12">مدیر ثبت نشده</span>'}
        ${x.phone ? `<span dir="ltr" class="tr-ph">${trFa(x.phone)}</span>${x.phone_fixed ? '<small>(اصلاح دستی)</small>' : ''}` : '<span style="color:#B25B12">بدون شماره</span>'}
        <button class="tr-mini" onclick='trPhone(${k})' title="ثبت یا اصلاح شماره‌ی مدیر">✏️ شماره</button></div>
      <div class="mga-sub">🏢 ${escH(x.company)}${x.agent ? ` · کارگزار: ${escH(x.agent)}${x.agent_code ? ` (${trFa(x.agent_code)})` : ''}` : ''}</div>
      <div class="tr-hs">${hotels || '<span class="mga-sub">هتلی ثبت نشده</span>'}</div>
      <div class="tr-act">${x.manual === 'cancel'
        ? `<button class="tr-mini" onclick='trCancel(${k},false)'>↩️ برگرداندن (لغو نشده)</button>`
        : x.status !== 'cancel' ? `<button class="tr-mini" onclick='trCancel(${k},true)'>⛔ لغو شده است</button>` : '<span class="mga-sub">در سامانه‌ی عتبات لغو شده (ردیف قرمز)</span>'}</div>
    </div>`;
  }).join('') + (L.length > 400 ? `<div class="empty-msg">${mgaN(L.length - 400)} کاروان دیگر؛ برای دیدن، جستجو کنید یا بازه را کوچک‌تر کنید.</div>` : '');
}

async function trFile(inp) {
  const f = inp.files[0]; if (!f) return;
  try {
    await mgaSheetJS();
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    const info = wb.Sheets['اطلاعات'] ? Object.fromEntries(XLSX.utils.sheet_to_json(wb.Sheets['اطلاعات'], { header: 1 }).map(r => [String(r[0] || '').trim(), String(r[1] ?? '').trim()])) : {};
    if (info['شناسه'] !== 'hamyar-trips' || !wb.Sheets['کاروان‌ها']) throw new Error('این فایل از افزونه‌ی همیار کاروان نیست. فایلی را بگذارید که افزونه با دکمه‌ی «دریافت فایل اکسل» داده است.');
    const ST = { 'فعال': 'ok', 'بدون زائر': 'empty', 'لغو شده': 'cancel' };
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['کاروان‌ها'], { defval: '', raw: false }).map(r => ({
      status: ST[String(r['وضعیت']).trim()] || 'empty', entry: trNorm(r['تاریخ ورود به عراق']), prov: r['استان'], border: r['مرز'], pkg: r['پکیج'], route: r['مسیر'],
      pilgrims: r['تعداد زائر'], company: r['شرکت مجری'], agent: r['کارگزار'], agent_code: r['کد کارگزار'], mgr: r['مدیر راهنما'], phone: trEn(r['موبایل مدیر']).replace(/\D/g, ''),
      hotels: TR_CITY.map(([c, fa]) => ({ c, h: String(r['هتل ' + fa] || '').trim(), in: trNorm(r['ورود به ' + fa]), out: trNorm(r['خروج از ' + fa]), n: r['شب ' + fa] })).filter(h => h.h || h.in)
    })).filter(r => r.entry);
    if (!rows.length) throw new Error('در فایل کاروانی پیدا نشد.');
    trImp = { rows, from: trNorm(info['از تاریخ']) || rows[0].entry, to: trNorm(info['تا تاریخ']) || rows[rows.length - 1].entry };
  } catch (e) { trImp = { err: e.message }; }
  inp.value = ''; trRender();
}
async function trImport(btn) {
  btn.disabled = true;
  try {
    const r = await adminFetch('/admin/mgr/trips/import', { from: trImp.from, to: trImp.to, rows: trImp.rows }, adminAuth());
    showToast(`✅ ${mgaN(r.n)} کاروان ثبت شد (${trFa(r.from)} تا ${trFa(r.to)})` + (r.sync && r.sync.n ? ` — ${mgaN(r.sync.n)} مدیر با سفر جاری یا آینده در «مدیران و دسترسی» مجاز شد${r.sync.added ? ` (${mgaN(r.sync.added)} نفر تازه)` : ''}` : ' — هیچ موبایل مدیری در فایل نبود'), 9000);
    trImp = null; trFrom = r.from; trTo = r.to; trLoad(); if (typeof mgGuideLoad === 'function') mgGuideLoad();
  } catch (e) { showToast(e.message); btn.disabled = false; }
}
async function trSet(key, body) {
  try { await adminFetch('/admin/mgr/trips/set', { key, ...body }, adminAuth()); showToast('ذخیره شد ✅'); trLoad(); } catch (e) { showToast(e.message); }
}
function trCancel(key, on) {
  if (on && !confirm('این کاروان «لغو شده» علامت بخورد؟ (با بارگذاری‌های بعدی هم لغو می‌ماند تا خودتان برش گردانید)')) return;
  trSet(key, { manual: on ? 'cancel' : '' });
}
function trPhone(key) {
  const x = trData.rows.find(r => r.key === key); if (!x) return;
  const v = prompt(`شماره موبایل مدیر راهنما${x.mgr ? ' «' + x.mgr + '»' : ''} (خالی = همان شماره‌ی سامانه):`, x.phone_fixed ? x.phone : '');
  if (v === null) return;
  trSet(key, { phone: trEn(v).trim() });
}

(function () {
  document.head.insertAdjacentHTML('beforeend', `<style>
  .tr-flt{display:grid;grid-template-columns:130px 130px 1fr;gap:8px;align-items:end;margin:14px 0 8px}
  .tr-flt label{display:flex;flex-direction:column;font-size:12px;color:var(--dim,#777);gap:2px;min-width:0}
  .tr-flt input{min-width:0;width:100%;padding:8px;border:1px solid var(--border-s);border-radius:9px;font-family:var(--font);text-align:center;background:var(--card)}
  @media(max-width:560px){.tr-flt{grid-template-columns:1fr 1fr}.tr-flt>input{grid-column:1/-1}}
  .tr-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
  .tr-chips button{border:1px solid var(--border-s);background:var(--card);border-radius:999px;padding:4px 12px;font-family:var(--font);font-size:12.5px;cursor:pointer;color:var(--text)}
  .tr-chips button.on{background:var(--gold);border-color:var(--gold);color:#fff}
  .tr-row{padding:10px 0;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:3px;font-size:13.5px}
  .tr-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .tr-pill{font-size:11.5px;font-weight:800;border-radius:999px;padding:1px 10px}
  .tr-mgr{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .tr-ph{font-weight:700;color:var(--muted)}
  .tr-hs{display:flex;gap:6px;flex-wrap:wrap}
  .tr-h{background:var(--card2,#f4fbf6);border:1px solid var(--border);border-radius:8px;padding:1px 8px;font-size:12.5px}
  .tr-h.unk{border-style:dashed;color:#8A5A00}
  .tr-h.pass{background:transparent;color:var(--dim,#777)}
  .tr-row,.tr-mgr,.tr-hs{min-width:0;overflow-wrap:anywhere}
  .tr-h small{color:var(--dim,#777)}
  .tr-act{display:flex;gap:6px}
  .tr-mini{border:1px solid var(--border-s);background:var(--card);border-radius:8px;padding:2px 10px;font-family:var(--font);font-size:12px;cursor:pointer;color:var(--text)}
  </style>`);
})();

/* ══ راهنمای سه‌قدمی بالای تب «مدیران کاروان»: دریافت افزونه ← اجرا در عتبات ← بارگذاری فایل ══ */
let mgG = null, mgGOpen = null;
function mgGuideLoad() {
  const el = document.getElementById('mgGuide'); if (!el) return;
  if (typeof STAFF !== 'undefined' && STAFF && !STAFF.perms.has('trips')) { el.innerHTML = ''; return; }
  adminFetch('/admin/mgr/trips?from=1499/12/29&to=1499/12/29', null, adminAuth()).then(d => { mgG = d; mgGuideRender(); }).catch(() => {});
  mgGuideRender();
}
function mgGuideRender() {
  const el = document.getElementById('mgGuide'); if (!el) return;
  const t = mgG && mgG.last && mgG.last.t, days = t ? Math.floor((Date.now() - t) / 864e5) : null, fresh = t && days < 7;
  const open = mgGOpen === null ? !fresh : mgGOpen, ver = mgG && mgG.ext ? mgG.ext.ver : '';
  el.innerHTML = `<div class="mgg ${fresh ? 'ok' : 'due'}">
    <button class="mgg-h" onclick="mgGOpen=!${open};mgGuideRender()" aria-expanded="${open}">
      <span>${!mgG ? '⏳' : fresh ? '✅' : '⏰'}</span>
      <b>${!mgG ? 'کار هفتگی: فهرست مدیران را از سامانه‌ی عتبات به‌روز کنید' : fresh ? `فایل این هفته بارگذاری شده (${mgaAgo(t)})` : t ? `فایل این هفته هنوز بارگذاری نشده (آخرین: ${mgaAgo(t)})` : 'هنوز هیچ فایلی بارگذاری نشده'}</b>
      <span class="mgg-t">${open ? 'بستن ▴' : 'راهنما ▾'}</span></button>
    ${open ? `<div class="mgg-b">
      <p class="mgg-i">هر هفته فقط همین سه قدم: مدیرهای کاروان‌ها <b>خودکار</b> از سامانه‌ی عتبات به فهرست اضافه می‌شوند و دیگر لازم نیست کسی شماره‌ها را دستی وارد کند.</p>
      <div class="mgg-steps">
        <div class="mgg-s"><div class="mgg-n">۱</div><b>دریافت و نصب افزونه</b><small>فقط بار اول، روی کامپیوتر (کروم یا Edge)</small>
          <button class="pub-btn" onclick="mgExtGet(this)">⬇️ دانلود افزونه${ver ? ` (نسخه‌ی ${trFa(ver)})` : ''}</button>
          <details><summary>روش نصب</summary><ol>
            <li>فایل <b>hamyar-atabat-ext.zip</b> را از حالت فشرده خارج کنید (راست‌کلیک ← <b>Extract All</b>) و پوشه را جایی بگذارید که پاکش نکنید، مثلاً «اسناد».</li>
            <li>در کروم بنویسید <b dir="ltr">chrome://extensions</b> (در Edge: <b dir="ltr">edge://extensions</b>) و Enter بزنید.</li>
            <li>بالای صفحه <b>Developer mode</b> را روشن کنید.</li>
            <li>دکمه‌ی <b>Load unpacked</b> را بزنید و پوشه‌ی <b>hamyar-atabat-ext</b> را انتخاب کنید.</li>
            <li>روی آیکون پازل 🧩 کنار نوار آدرس بزنید و کنار «همیار کاروان» سنجاق 📌 را بزنید تا آیکون سبزش همیشه دیده شود.</li>
            <li>برای نسخه‌ی تازه: همین فایل را دوباره دانلود کنید، روی همان پوشه بریزید و در صفحه‌ی extensions دکمه‌ی 🔄 افزونه را بزنید.</li></ol></details></div>
        <div class="mgg-s"><div class="mgg-n">۲</div><b>اجرا در سامانه‌ی عتبات</b><small>هر هفته، حدود ۲ تا ۵ دقیقه</small>
          <ol><li>با کروم وارد <b dir="ltr">atabatorg.haj.ir</b> شوید.</li><li>روی آیکون سبز <b>همیار کاروان</b> بالای مرورگر بزنید.</li>
            <li>بازه‌ی تاریخ خودش پر شده؛ <b>«جمع‌آوری»</b> را بزنید و صبر کنید.</li><li>در آخر <b>«⬇ دریافت فایل اکسل»</b> را بزنید؛ فایلی به اسم <b dir="ltr">hamyar-trips-….xlsx</b> دانلود می‌شود.</li></ol>
          <small>افزونه فقط گزارش‌ها را می‌خواند؛ چیزی در سامانه ثبت یا تأیید نمی‌کند و اطلاعات زائران را برنمی‌دارد.</small></div>
        <div class="mgg-s"><div class="mgg-n">۳</div><b>بارگذاری فایل همین‌جا</b><small>فایل hamyar-trips-….xlsx</small>
          <label class="pub-btn mgg-up">📄 انتخاب فایل اکسل افزونه<input type="file" accept=".xlsx" hidden onchange="mgGuideFile(this)"></label>
          <small>خلاصه‌ی فایل نشان داده می‌شود؛ اگر درست بود «✅ ثبت» را بزنید. بعد از ثبت، تعداد مدیرهایی که مجاز شدند را می‌بینید.</small></div>
      </div></div>` : ''}</div>`;
}
async function mgExtGet(btn) {
  btn.disabled = true;
  try {
    const r = await fetch(RV_API + '/admin/mgr/trips/ext', { headers: { Authorization: adminAuth() }, cache: 'no-store' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'دانلود ممکن نشد');
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = 'hamyar-atabat-ext.zip'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 30000);
    showToast('افزونه دانلود شد ✅ حالا «روش نصب» را باز کنید');
  } catch (e) { showToast(e.message); }
  btn.disabled = false;
}
async function mgGuideFile(inp) {
  if (typeof mgSubShow === 'function') mgSubShow('trips');
  await trFile(inp);
  mgGOpen = false; mgGuideRender();
  setTimeout(() => { const x = document.querySelector('#trips-admin .mga-imp'); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300);
}
document.head.insertAdjacentHTML('beforeend', `<style>
  .mgg{border:1.5px solid #B25B12;border-radius:14px;background:var(--card);margin-bottom:12px;overflow:hidden}.mgg.ok{border-color:#1E7D4F55}
  .mgg-h{width:100%;display:flex;align-items:center;gap:8px;padding:12px 14px;border:0;background:#B25B1210;cursor:pointer;font-family:var(--font);font-size:14px;color:var(--text);text-align:right}
  .mgg.ok .mgg-h{background:#1E7D4F0d}.mgg-h b{flex:1}.mgg-t{font-size:12px;color:var(--dim,#777);white-space:nowrap}
  .mgg-b{padding:4px 14px 14px}.mgg-i{font-size:13px;line-height:2;margin:6px 0 10px}
  .mgg-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
  @media(max-width:760px){.mgg-steps{grid-template-columns:1fr}}
  .mgg-s{border:1px solid var(--border-s);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.9;background:var(--card2,#f6f1e7)}
  .mgg-s small{color:var(--dim,#777);font-size:12px}.mgg-s ol{margin:0;padding-inline-start:18px}.mgg-s details summary{cursor:pointer;font-weight:700;color:#1E5D8C}
  .mgg-n{width:28px;height:28px;border-radius:50%;background:#1E7D4F;color:#fff;display:grid;place-items:center;font-weight:800}
  .mgg-up{cursor:pointer;display:inline-flex;justify-content:center}
  .tr-warn{margin-top:6px;background:#B3261E14;color:#B3261E;border-radius:8px;padding:6px 10px;line-height:1.9}.tr-ok{margin-top:6px;background:#1E7D4F12;color:#1E6B45;border-radius:8px;padding:6px 10px;line-height:1.9}
</style>`);
