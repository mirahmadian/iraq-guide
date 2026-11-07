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
  return x.devices ? ['🟢 وارد شده', '#1E7D4F'] : ['⚪ هنوز وارد نشده', '#777'];
}
function mgaRender() {
  const el = document.getElementById('mgr-admin'); if (!el) return;
  if (mgaErr) { el.innerHTML = `<div class="empty-msg" style="color:#B3261E">${escH(mgaErr)}</div><button class="add-row-btn" onclick="mgaLoad()">🔄 دوباره</button>`; return; }
  if (!mgaData) { el.innerHTML = '<div class="empty-msg">در حال دریافت…</div>'; return; }
  const P = mgaData.people, q = mgaQ.trim().replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const L = q ? P.filter(x => [x.name, x.phone, x.role, x.company].some(v => String(v || '').includes(q))) : P;
  const on = P.filter(x => x.devices).length;
  el.innerHTML = `
  <div class="mga-sum"><div><b>${mgaN(P.length)}</b><span>نفر در فهرست</span></div><div><b>${mgaN(on)}</b><span>وارد شده‌اند</span></div><div><b>${mgaN(P.filter(x => !x.active || (x.until && x.until < Date.now())).length)}</b><span>غیرفعال / تمام‌شده</span></div></div>
  <details class="gd-det"><summary><b>📘 مدیران چطور وارد می‌شوند؟</b></summary><div class="empty-msg" style="line-height:2;padding:6px 0">
    ۱. شماره‌ی موبایل مدیر را این‌جا ثبت کنید (همان شماره‌ای که با آن در بله است).<br>
    ۲. مدیر در برنامه: منوی «بیشتر» ← <b>«🔐 ورود مدیران کاروان»</b> ← «ورود با بازوی بله» ← در بله «📱 ارسال شماره من».<br>
    ۳. اگر شماره در فهرست باشد، بخش ویژه روی گوشی‌اش باز می‌شود (حداکثر ${mgaN(mgaData.max || 2)} گوشی برای هر شماره).<br>
    اگر کسی بله ندارد، کنار نامش «🔑 کد یک‌بارمصرف» را بزنید و کد را تلفنی به او بگویید (۲۴ ساعت اعتبار دارد).<br>
    با «غیرفعال کردن» یا حذف، دسترسی در اولین اتصال گوشی به اینترنت قطع می‌شود.</div></details>

  <div class="mga-box">${mgaFormHTML()}</div>

  <details class="gd-det" ${mgaImp ? 'open' : ''}><summary><b>📄 ورود یک‌جا از اکسل</b></summary><div style="padding:8px 0">
    <div class="empty-msg" style="padding:0 0 8px;line-height:2">فایل اکسل (xlsx) یا CSV با ستون‌های <b>نام</b> و <b>موبایل</b> (و اگر دارید: سمت، شرکت، شهر). ردیف اول باید عنوان ستون‌ها باشد. شماره‌ای که از قبل هست، به‌روز می‌شود.</div>
    <input type="file" id="mgaFile" accept=".xlsx,.xls,.csv" onchange="mgaFile(this)">
    ${mgaImp ? `<div class="mga-imp">${mgaImp.err ? `<span style="color:#B3261E">${escH(mgaImp.err)}</span>` : `<b>${mgaN(mgaImp.rows.length)}</b> ردیف درست پیدا شد${mgaImp.bad ? `؛ ${mgaN(mgaImp.bad)} ردیف بدون نام یا شماره‌ی درست کنار گذاشته شد` : ''}.
      <div style="max-height:160px;overflow:auto;margin:6px 0;font-size:12.5px">${mgaImp.rows.slice(0, 50).map(r => `<div>${escH(r.name)} — <span dir="ltr">${escH(mgaFaPhone(r.phone))}</span> ${escH([r.role, r.company, MGA_CITIES[r.city]].filter(Boolean).join('، '))}</div>`).join('')}${mgaImp.rows.length > 50 ? '<div>…</div>' : ''}</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">اعتبار: <select id="mgaImpUntil" class="fsel-a">${MGA_UNTIL.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      <button class="pub-btn" onclick="mgaImport(this)">✅ افزودن ${mgaN(mgaImp.rows.length)} نفر</button><button class="lock-link" onclick="mgaImp=null;mgaRender()">انصراف</button></div>`}</div>` : ''}
  </div></details>

  <input type="search" class="input-full" placeholder="🔎 جستجوی نام، شماره، سمت یا شرکت…" value="${escH(mgaQ)}" oninput="mgaQ=this.value;mgaRenderList()" style="margin:12px 0 8px">
  <div id="mgaList"></div>`;
  mgaRenderList();
}
function mgaRenderList() {
  const el = document.getElementById('mgaList'); if (!el || !mgaData) return;
  const q = mgaQ.trim().replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const L = q ? mgaData.people.filter(x => [x.name, x.phone, x.role, x.company].some(v => String(v || '').includes(q))) : mgaData.people;
  el.innerHTML = L.length ? L.slice(0, 300).map(x => { const [st, col] = mgaStatus(x); return `<div class="mga-row">
    <div class="mga-main"><b>${escH(x.name)}</b> <span dir="ltr" class="mga-ph">${escH(mgaFaPhone(x.phone))}</span>
      <div class="mga-sub">${escH([x.role, x.company, MGA_CITIES[x.city] || x.city].filter(Boolean).join(' · ') || '—')}</div>
      <div class="mga-sub"><span style="color:${col};font-weight:800">${st}</span>${x.devices ? `، روی ${mgaN(x.devices)} گوشی` : ''}، آخرین ورود: ${mgaAgo(x.last_login)}${x.until ? `، تا ${mgaDate(x.until)}` : ''}</div></div>
    <div class="mga-act"><button onclick="mgaEditOpen('${escH(x.phone)}')" title="ویرایش">✏️</button><button onclick="mgaOtp('${escH(x.phone)}')" title="کد یک‌بارمصرف برای کسی که بله ندارد">🔑</button>
      ${x.devices ? `<button onclick="mgaRevoke('${escH(x.phone)}')" title="خروج از همه‌ی گوشی‌ها">⏏️</button>` : ''}<button onclick="mgaDel('${escH(x.phone)}')" title="حذف از فهرست">🗑</button></div></div>`; }).join('') + (L.length > 300 ? `<div class="empty-msg">${mgaN(L.length - 300)} نفر دیگر — برای دیدن، جستجو کنید.</div>` : '')
    : `<div class="empty-msg">${mgaData.people.length ? 'کسی با این جستجو پیدا نشد.' : 'هنوز کسی ثبت نشده است. از فرم بالا یا «ورود یک‌جا از اکسل» شروع کنید.'}</div>`;
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
function mgaEditOpen(phone) { mgaEdit = mgaData.people.find(x => x.phone === phone) || null; mgaRender(); document.querySelector('.mga-box').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
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
  .mga-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
  .mga-sum>div{background:var(--card2,#f6f1e7);border-radius:12px;padding:10px;text-align:center;display:flex;flex-direction:column}
  .mga-sum b{font-size:22px}.mga-sum span{font-size:12px;color:var(--dim,#777)}
  .mga-box{border:1px solid var(--border-s);border-radius:14px;padding:12px;margin:12px 0}
  .mga-form{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  @media(max-width:560px){.mga-form{grid-template-columns:1fr}}
  .mga-imp{margin-top:8px;padding:10px;border-radius:10px;background:var(--card2,#f6f1e7);font-size:13px;line-height:1.9}
  .mga-row{display:flex;gap:8px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)}
  .mga-main{flex:1;min-width:0;font-size:14px}.mga-ph{color:var(--dim,#777);font-size:13px}
  .mga-sub{font-size:12px;color:var(--dim,#777);line-height:1.8}
  .mga-act{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
  .mga-act button{border:1px solid var(--border-s);background:var(--card);border-radius:8px;min-width:36px;min-height:34px;cursor:pointer;font-size:15px}
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
  el.innerHTML = `
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
  el.innerHTML = L.length ? L.map(c => `<div class="mga-row"><div class="mga-main"><b>${escH(c.name)}</b>
      <div class="mga-sub">${c.ceo ? `مدیرعامل: ${escH(c.ceo)}` : '<span style="color:#B25B12">مدیرعامل ثبت نشده</span>'}${c.phone ? `، تلفن شرکت: ${P(c.phone)}` : ''}</div>
      ${c.address ? `<div class="mga-sub">📍 ${escH(c.address)}</div>` : ''}
      ${c.reps.length ? c.reps.map(r => `<div class="mga-sub">👤 ${escH(r.name || 'نماینده')}${r.ir ? `، ایران: ${P(r.ir)}` : ''}${r.iq ? `، عراق: ${P(r.iq)}` : ''}</div>`).join('') : '<div class="mga-sub" style="color:#B25B12">نماینده ثبت نشده</div>'}</div>
    <div class="mga-act"><button onclick="mcoEdit=JSON.parse(JSON.stringify(mcoData.list.find(x=>x.id===${c.id})));if(!mcoEdit.reps.length)mcoEdit.reps.push({name:'',ir:'',iq:''});mcoRender();document.getElementById('mcoForm').scrollIntoView({behavior:'smooth'})" title="ویرایش">✏️</button>
      <button onclick="mcoDel(${c.id})" title="حذف">🗑</button></div></div>`).join('')
    : `<div class="empty-msg">${mcoData.list.length ? 'شرکتی با این جستجو پیدا نشد.' : 'هنوز شرکتی ثبت نشده است. از فرم بالا یا «ورود یک‌جا از اکسل» شروع کنید.'}</div>`;
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
  .mco-sug{display:flex;flex-wrap:wrap;gap:6px;padding:8px 0}
  .mco-sug button{border:1px dashed var(--border-s);background:var(--card);border-radius:999px;padding:6px 10px;cursor:pointer;font-family:var(--font);font-size:12.5px}
  .mco-sug button span{color:var(--dim,#888)}
  textarea.mco-addr{margin-top:8px;height:auto;min-height:56px;background:#fff;color:var(--text);direction:rtl;font-size:13.5px;border:1px solid var(--border-s)}
  .mco-rep{display:grid;grid-template-columns:28px 1.3fr 1fr 1fr 40px;gap:6px;align-items:center;margin-bottom:6px}
  .mco-n{width:26px;height:26px;border-radius:50%;background:var(--card2,#f6f1e7);display:grid;place-items:center;font-size:12px;font-weight:800}
  @media(max-width:620px){.mco-rep{grid-template-columns:28px 1fr 40px}.mco-rep [data-r="ir"],.mco-rep [data-r="iq"]{grid-column:2/3}}
</style>`);
