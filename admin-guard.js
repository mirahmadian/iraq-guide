/* ══════════════════════════════════════════
   GUARD ADMIN — تب آمار ← «🛡️ سلامت سرور و پشتیبان‌ها» (فقط مدیر اصلی)
   داده از worker/guard.js: وضعیت سامانه‌های سرور 188، فهرست پشتیبان‌ها در Cloudflare و دانلود آن‌ها
══════════════════════════════════════════ */
let guardData = null, guardErr = '';
function guardLoad() {
  if (STAFF) return;
  guardErr = ''; renderGuard();
  adminFetch('/admin/guard', null, adminAuth()).then(d => { guardData = d; renderGuard(); renderRescue(); }).catch(e => { guardErr = e.message; renderGuard(); });
  cfLoad();
}
const gFa = n => (+n || 0).toLocaleString('fa');
const gAgo = t => { if (!t) return '—'; const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'همین الان' : m < 60 ? gFa(m) + ' دقیقه پیش' : m < 1440 ? gFa(Math.round(m / 60)) + ' ساعت پیش' : gFa(Math.round(m / 1440)) + ' روز پیش'; };
const gTs = ts => { const d = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)/.exec(ts || ''); if (!d) return ts || ''; const t = Date.UTC(+d[1], d[2] - 1, +d[3], +d[4], +d[5]);
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(t); };
const gKb = b => b > 1048576 ? (b / 1048576).toFixed(1).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]) + ' مگ' : gFa(Math.round(b / 1024)) + ' کیلو';
function renderGuard() {
  const el = document.getElementById('guard-admin');
  if (!el) return;
  if (STAFF) { el.closest('.sec-card').style.display = 'none'; return; }
  const d = guardData;
  if (guardErr) { el.innerHTML = `<div class="empty-msg" style="color:#B3261E">${escH(guardErr)}</div><button class="add-row-btn" onclick="guardLoad()">🔄 دوباره</button>`; return; }
  if (!d) { el.innerHTML = '<div class="empty-msg">در حال دریافت…</div>'; return; }
  const by = k => d.backups.filter(b => b.kind === k);
  const row = b => `<div class="gd-b"><span>${gTs(b.ts)}</span><span class="gd-s">${gKb(b.bytes)}</span><button class="add-row-btn" style="margin:0;width:auto;min-height:32px;padding:0 10px" onclick="guardGet('${escH(b.k)}',this)">⬇️ دانلود</button></div>`;
  const last = by('data')[0], full = by('full')[0], team = by('team')[0];
  el.innerHTML = `
  <div class="gd-checks">${d.checks.map(c => `<div class="gd-c ${c.up === false ? 'down' : 'up'}"><b>${c.up === false ? '🔴' : '🟢'} ${escH(c.name)}</b>
    <small>${c.up === false ? `قطع از ${gAgo(c.since)}` : c.last ? `سالم · آخرین بررسی ${gAgo(c.last)}${c.ms ? ` · پاسخ در ${gFa(Math.round(c.ms / 100) / 10)} ثانیه` : ''}` : 'هنوز بررسی نشده'}</small></div>`).join('')}</div>
  <div class="gd-sum">
    <div>💾 <b>آخرین پشتیبان ساعتی:</b> ${last ? gTs(last.ts) : 'هنوز گرفته نشده'}</div>
    <div>📦 <b>آخرین پشتیبان کامل (با کد برنامه‌ها):</b> ${full ? gTs(full.ts) : 'هنوز گرفته نشده'}</div>
    <div>🏨 <b>آخرین پشتیبان سامانه نواقص هتل‌ها (Cloudflare):</b> ${team ? gTs(team.ts) : 'هنوز گرفته نشده'}</div>
    <div>🧠 <b>آخرین پشتیبان حافظه Claude:</b> ${by('memory')[0] ? gTs(by('memory')[0].ts) : 'هنوز گرفته نشده'}</div>
    ${d.cs && d.cs.at ? (() => { const days = Math.floor((Date.now() - d.cs.at) / 864e5); return `<div style="${days >= 25 ? 'color:#B3261E' : ''}">💻 <b>آخرین استفاده از Codespace:</b> ${gAgo(d.cs.at)}${days >= 20 ? ` — <b>${gFa(Math.max(0, 30 - days))} روز</b> تا پاک شدن خودکار؛ روشنش کنید.` : ''}</div>`; })() : ''}
    <div>🔔 <b>هشدار در بله:</b> ${d.alerts ? 'فعال است ✅ <button class="lock-link" onclick="guardTest(this)">فرستادن پیام آزمایشی</button>' : '<span style="color:#B3261E">هنوز فعال نشده</span> — کد فعال‌سازی را از Claude بگیرید و برای بازوی @HamyarKaravan_Bot بفرستید.'}</div>
  </div>
  <details class="gd-det"><summary>همه نسخه‌های پشتیبان (${gFa(d.backups.length)})</summary>
    ${[['team', '🏨 سامانه نواقص هتل‌ها — روزانه، ۳۵ روز'], ['memory', '🧠 حافظه Claude — ۲۰ نسخه آخر (برای Codespace تازه)'], ['full', '📦 کامل سرور — هر شب، ۳۵ روز نگه داشته می‌شود'], ['daily', '📅 روزانه — ۳۵ روز'], ['data', '🕐 ساعتی — ۳ روز']].map(([k, t]) => by(k).length ? `<div class="field-label" style="margin-top:10px">${t}</div>${by(k).map(row).join('')}` : '').join('')}
  </details>
  <div class="empty-msg" style="padding:8px 0 0">سرور هر ساعت از داده‌های چاپ و بسته‌بندی و بیمه نسخه پشتیبان می‌سازد و Cloudflare آن را بیرون از ایران نگه می‌دارد. از سامانه نواقص هتل‌ها (که خودش روی Cloudflare است) هم هر روز یک نسخه جدا گرفته می‌شود. اگر سرور از دست برود، Claude با همین نسخه‌ها همه چیز را روی سرور تازه برمی‌گرداند.</div>
  <button class="add-row-btn" onclick="guardLoad()">🔄 به‌روزرسانی</button>`;
}
/* ── بسته نجات: راهنمای ساده + کپی/دانلود گزارش کامل (/admin/guard/report) ── */
const mdLite = t => escH(t).replace(/^## (.+)$/gm, '<div class="field-label" style="margin-top:4px">$1</div>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/^ {3}- (.+)$/gm, '<div style="padding-right:22px">• $1</div>').replace(/^(\d)\. (.+)$/gm, '<div class="rs-step"><span>$1</span><div>$2</div></div>').replace(/\n{2,}/g, '<br>').replace(/\n/g, '');
function renderRescue() {
  const el = document.getElementById('rescue-admin');
  if (!el || STAFF) return;
  const d = guardData;
  el.innerHTML = `${d && d.steps ? `<div class="rs-steps">${mdLite(d.steps.trim())}</div>` : '<div class="empty-msg">در حال دریافت…</div>'}
    ${d && d.errors ? `<div class="rs-warn">⚠️ در ۷ روز گذشته ${gFa(d.errors)} خطای فنی ثبت شده؛ جزئیاتش داخل گزارش است.</div>` : ''}
    <div class="rs-btns"><button class="add-row-btn" onclick="rescueCopy(this)">📋 کپی گزارش برای کمک</button>
    <button class="add-row-btn" onclick="rescueDownload(this)">⬇️ دانلود پرونده کامل (برای نگهداری)</button></div>
    <details class="gd-det" style="margin-top:8px"><summary>اگر دکمه‌ی «🚀 انتشار برای کاربران» کار نکرد</summary>
      <div class="empty-msg" style="padding:6px 0">فایل داده‌های برنامه (data.js) را با همین تغییرات دانلود کنید و به برنامه‌نویس بدهید تا دستی در GitHub بگذارد.</div>
      <button class="add-row-btn" onclick="downloadDataJs()">⬇️ دانلود فایل data.js</button></details>
    <div class="empty-msg" style="padding:6px 0 0">گزارش شامل وضعیت همین لحظه سامانه‌ها، خطاهای اخیر و نقشه فنی کامل است. <b>هیچ رمز یا کلیدی در آن نیست</b> و فرستادنش بی‌خطر است.</div>`;
}
async function rescueText() {
  const r = await fetch(RV_API + '/admin/guard/report', { headers: { Authorization: adminAuth() } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'خطا ' + r.status);
  return r.text();
}
async function rescueCopy(b) {
  const t0 = b.textContent; b.disabled = true; b.textContent = '⏳';
  try {
    const t = await rescueText();
    try { await navigator.clipboard.writeText(t); showToast('✅ گزارش کپی شد. آن را در گفتگو با برنامه‌نویس یا هوش مصنوعی بچسبانید.'); }
    catch (e) { rescueSave(t); showToast('کپی نشد؛ به‌جایش فایل گزارش دانلود شد.'); }
  } catch (e) { showToast('❌ ' + e.message); }
  b.disabled = false; b.textContent = t0;
}
function rescueSave(t) {
  const d = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + t], { type: 'text/markdown;charset=utf-8' })); a.download = `hamyar-rescue-${d}.md`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
async function rescueDownload(b) {
  const t0 = b.textContent; b.disabled = true; b.textContent = '⏳';
  try { rescueSave(await rescueText()); showToast('✅ دانلود شد. یک نسخه در گوشی، رایانه و ایمیل خودتان نگه دارید.'); } catch (e) { showToast('❌ ' + e.message); }
  b.disabled = false; b.textContent = t0;
}
async function guardGet(k, b) {
  b.disabled = true; const t = b.textContent; b.textContent = '⏳';
  try {
    const r = await fetch(RV_API + '/admin/guard/get?k=' + encodeURIComponent(k), { headers: { Authorization: adminAuth() } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'خطا ' + r.status);
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = 'hamyar-' + k.replace('/', '-') + (/^(team|memory)\//.test(k) ? '.json.gz' : '.tar.gz');
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  } catch (e) { showToast('❌ ' + e.message); }
  b.disabled = false; b.textContent = t;
}
async function guardTest(b) {
  b.disabled = true;
  try { const r = await adminFetch('/admin/guard/test', {}, adminAuth()); showToast(r.sent ? '✅ پیام آزمایشی در بله فرستاده شد' : '❌ فرستاده نشد'); } catch (e) { showToast('❌ ' + e.message); }
  b.disabled = false;
}
(function () {
  document.head.insertAdjacentHTML('beforeend', `<style>
  .gd-checks{display:grid;gap:8px}
  .gd-c{padding:10px 12px;border-radius:12px;border:1px solid #cfe3d8;background:#f2faf5}
  .gd-c.down{border-color:#f0b7b2;background:#fdf0ef}
  .gd-c b{display:block;font-size:14px}
  .gd-c small{color:#555;font-size:12.5px}
  .gd-sum{margin-top:12px;display:grid;gap:6px;font-size:13.5px;line-height:1.9}
  .gd-det{margin-top:10px;font-size:13px}
  .gd-det summary{cursor:pointer;font-weight:800}
  .gd-b{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #eee}
  .gd-b span:first-child{flex:1}
  .gd-s{color:#777;font-size:12px}
  .rs-steps{font-size:14px;line-height:2}
  .rs-step{display:flex;gap:8px;align-items:flex-start;margin:4px 0}
  .rs-step>span{flex:0 0 24px;height:24px;border-radius:50%;background:#B8892B;color:#fff;font-weight:800;display:grid;place-items:center;font-size:13px;margin-top:4px}
  .rs-warn{margin-top:10px;padding:8px 12px;border-radius:10px;background:#fdf0ef;border:1px solid #f0b7b2;font-size:13.5px}
  .rs-btns{display:grid;gap:8px;margin-top:12px}
  </style>`);
})();

/* ══ ☁️ Cloudflare: حجم پایگاه‌ها از /admin/guard/cf + راهنمای ساده‌ی دسترسی ══ */
let cfData = null;
function cfLoad() {
  const el = document.getElementById('cf-admin'); if (!el) return;
  if (STAFF) { el.closest('.sec-card').style.display = 'none'; return; }
  el.innerHTML = '<div class="empty-msg">در حال دریافت…</div>';
  adminFetch('/admin/guard/cf', null, adminAuth()).then(d => { cfData = d; cfRender(); }).catch(e => { el.innerHTML = `<div class="empty-msg" style="color:#B3261E">${escH(e.message)}</div><button class="add-row-btn" onclick="cfLoad()">🔄 دوباره</button>`; });
}
const cfBar = (pct, col) => `<div style="height:10px;border-radius:6px;background:#eee;overflow:hidden;margin:4px 0"><i style="display:block;height:100%;width:${Math.max(1, Math.min(100, pct))}%;background:${col}"></i></div>`;
const cfCol = pct => pct > 85 ? '#B3261E' : pct > 60 ? '#B25B12' : '#1E7D4F';
const cfPct = x => (x < 1 ? x.toFixed(2) : x < 10 ? x.toFixed(1) : Math.round(x)).toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]).replace('.', '٫');
/* 💾 نگهبان فضا: پیش‌بینی، نمودار رشد، آخرین پاک‌سازی خودکار، پرجمعیت‌ترین جدول‌ها */
function cfSpaceHTML(d) {
  const sp = d.space; if (!sp) return '';
  const H = sp.hist || [], tot = h => Object.values(h.s || {}).reduce((a, b) => a + b, 0), mx = Math.max(1, ...H.map(tot));
  const f = sp.forecast && sp.forecast.worst, yrs = f ? f.left / 365 : 0;
  const proj = !f ? 'از فردا اندازه‌گیری روزانه شروع می‌شود.' : !sp.forecast.sample ? 'روند رشد از چند روز دیگر محاسبه می‌شود.' : f.left === Infinity ? 'در ۳۰ روز اخیر رشدی نداشته است.'
    : yrs >= 10 ? 'با روند فعلی <b>بیش از ۱۰ سال</b> جا داریم.' : yrs >= 1 ? `با روند فعلی حدود <b>${gFa(Math.floor(yrs))} سال</b> دیگر پر می‌شود.` : `<b style="color:#B3261E">با روند فعلی حدود ${gFa(Math.ceil(f.left))} روز دیگر پر می‌شود.</b>`;
  const bars = H.length > 1 ? `<svg viewBox="0 0 ${H.length * 6} 40" preserveAspectRatio="none" style="width:100%;height:46px;display:block;margin:6px 0" aria-label="رشد حجم در روزهای اخیر">${H.map((h, i) => { const v = Math.max(1, tot(h) / mx * 38); return `<rect x="${i * 6 + 1}" y="${40 - v}" width="4" height="${v}" rx="1" fill="#1E7D4F"><title>${h.d}: ${gKb(tot(h))}</title></rect>`; }).join('')}</svg>
    <div dir="ltr" style="display:flex;justify-content:space-between;font-size:11px;color:#888"><span>${escH(H[0].d)}</span><span>${escH(H[H.length - 1].d)}</span></div>` : '';
  const L = sp.last;
  return `<div style="border:1px solid #e5dccb;border-radius:12px;padding:12px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b style="font-size:15px">🛡️ نگهبان فضا (خودکار، روزی یک بار)</b>
      <button class="lock-link" onclick="cfSpaceRun(this)">🧹 همین الان اجرا شود</button></div>
    <div>${proj}${f ? ` <span style="color:#666">(پرترین: ${escH(f.what)}، ${f.pct < 1 ? 'کمتر از ۱' : gFa(Math.round(f.pct))}٪)</span>` : ''}</div>
    ${bars}
    <div>🧹 <b>آخرین پاک‌سازی:</b> ${L ? `${gAgo(L.at)} — ${L.removed && L.removed.length ? L.removed.map(r => `${escH(r.label)}: ${gFa(r.n)}`).join('، ') : 'چیز کهنه‌ای برای پاک کردن نبود'}` : 'هنوز اجرا نشده'}</div>
    <div style="color:#666;font-size:12px">در بله: هشدار وقتی هر پایگاه به ۶۰٪ و ۸۰٪ برسد یا در یک روز بیش از ۲۰ مگ بزرگ شود؛ و یک خط «💾 فضا» در گزارش صبح.</div>
    ${sp.tables && sp.tables.length ? `<details class="gd-det"><summary>پرجمعیت‌ترین جدول‌های پایگاه اصلی</summary><div style="padding:6px 2px;font-size:12.5px">${sp.tables.map(t => `<div style="display:flex;justify-content:space-between"><span dir="ltr">${escH(t.t)}</span><span>${gFa(t.n)} ردیف</span></div>`).join('')}</div></details>` : ''}
    <details class="gd-det"><summary>چه چیزهایی خودکار پاک می‌شود؟</summary><div style="padding:6px 2px;line-height:2">
      سوابق محدودیت تلاش و لینک‌ها و کدهای منقضی (فوراً)، پیش‌نویس‌های نیمه‌کاره‌ی ربات شرکت‌ها (۲ روز)، درخواست‌های بررسی‌شده‌ی ربات شرکت‌ها (۱ سال)، سفرهای عتبات (۱ سال بعد از سفر)، مدیرانی که از عتبات آمده‌اند (۶ ماه بعد از پایان دسترسی)، عکس و فیلم نواقص (۷ روز)، خطاهای ثبت‌شده (۳۰ روز) و پشتیبان‌های قدیمی سرور.<br>
      <b>هرگز خودکار پاک نمی‌شود:</b> نظرات زائران، مدیرانی که دستی ثبت شده‌اند، شرکت‌ها، کاربران و همکاران، گزارش‌های نواقص و آمار.</div></details>
  </div>`;
}
async function cfSpaceRun(btn) {
  btn.disabled = true; btn.textContent = '⏳ در حال اجرا…';
  try { await adminFetch('/admin/guard/space', {}, adminAuth()); showToast('نگهبان فضا اجرا شد ✅'); cfLoad(); } catch (e) { showToast(e.message); btn.disabled = false; }
}
function cfRender() {
  const el = document.getElementById('cf-admin'), d = cfData; if (!el || !d) return;
  const used = d.dbs.reduce((a, x) => a + (x.bytes || 0), 0), tp = used / d.limits.total * 100;
  el.innerHTML = `
  <div style="font-size:13px;line-height:2">
    <div style="border:1px solid #e5dccb;border-radius:12px;padding:12px;margin-bottom:10px">
      <b style="font-size:15px">💾 فضای رایگان پایگاه داده</b>
      <div style="font-size:22px;font-weight:800;color:${cfCol(tp)}">${tp < 1 ? 'کمتر از ۱٪' : cfPct(tp) + '٪'} <span style="font-size:14px">پر شده</span></div>
      ${cfBar(tp, cfCol(tp))}
      <div>مصرف‌شده: <b>${gKb(used)}</b> از <b>۵ گیگ</b> رایگان (هر پایگاه حداکثر ۵۰۰ مگ)</div>
    </div>
    ${cfSpaceHTML(d)}
    ${d.dbs.map(x => { const p = (x.bytes || 0) / d.limits.db * 100; return `<div style="padding:8px 0;border-bottom:1px solid #eee">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b dir="ltr">${escH(x.name)}</b><span>${x.error ? '<span style="color:#B3261E">خوانده نشد</span>' : `${gKb(x.bytes)} از ۵۰۰ مگ، ${gFa(x.tables)} جدول`}</span></div>
      <div style="color:#666;font-size:12px">${escH(x.what)}</div>${x.error ? '' : cfBar(p, cfCol(p))}</div>`; }).join('')}
    <details class="gd-det" style="margin-top:10px"><summary><b>📘 راهنما: Cloudflare چیست و چطور داده‌ها را ببینم؟</b></summary>
      <div style="padding:6px 2px">
      <div class="field-label">Cloudflare چیست؟</div>
      یک شرکت بزرگ اینترنتی است که برنامه‌های کوچک (Worker) و پایگاه داده (D1) را روی سرورهای خودش در سراسر دنیا اجرا می‌کند. سرور مشخصی با یک آدرس IP ندارید که خودتان نگهداری کنید؛ Cloudflare خودش روشن نگهش می‌دارد. برای همین از ایران و بیرون ایران در دسترس است.
      <div class="field-label">آدرس‌های سامانه شما</div>
      <div dir="ltr" style="text-align:left;font-size:12px">hamyar-team.hamyar-karevan.workers.dev<br>hamyar-reviews.hamyar-karevan.workers.dev</div>
      اولی برای سامانه نواقص هتل‌ها و دومی برای نظرات، پنل مدیریت، نگهبان و پشتیبان‌هاست. این‌ها فقط «در» ورود برنامه‌اند؛ باز کردنشان در مرورگر چیز دیدنی ندارد.
      <div class="field-label">دیدن جدول‌ها در پنل Cloudflare</div>
      <div class="rs-step"><span>۱</span><div>بروید به <a href="https://dash.cloudflare.com" target="_blank" rel="noopener">dash.cloudflare.com</a> و با ایمیل و رمز حساب Cloudflare وارد شوید.</div></div>
      <div class="rs-step"><span>۲</span><div>از منوی سمت چپ: <b>Storage &amp; databases</b> ← <b>D1 SQL database</b>.</div></div>
      <div class="rs-step"><span>۳</span><div>روی نام پایگاه بزنید (مثلاً <b dir="ltr">hamyar-hotels</b>) ← تب <b>Explore data</b> (یا Tables). فهرست جدول‌ها می‌آید و با زدن روی هر جدول ردیف‌هایش را می‌بینید.</div></div>
      <div class="rs-step"><span>۴</span><div>برنامه‌ها (Worker) در منوی <b>Compute (Workers)</b> ← <b>Workers &amp; Pages</b> هستند؛ تب <b>Metrics</b> هر کدام تعداد درخواست‌ها و خطاها را نشان می‌دهد.</div></div>
      <div style="background:#FBE3E1;border-radius:10px;padding:8px 10px;margin-top:6px">⚠️ در پنل Cloudflare فقط <b>نگاه کنید</b>. ویرایش یا پاک کردن ردیف و جدول در آنجا مستقیم روی داده‌ی واقعی اثر می‌گذارد و برگشت ندارد (جز از پشتیبان). برای تغییر، از خود سامانه یا Claude کمک بگیرید.</div>
      <div class="field-label">سهمیه‌ی رایگان (بدون هزینه)</div>
      • فضای پایگاه داده: ۵ گیگ در کل، هر پایگاه ۵۰۰ مگ (عدد بالای همین کارت)<br>
      • خواندن: ۵ میلیون ردیف در روز، نوشتن: ۱۰۰ هزار ردیف در روز<br>
      • درخواست به برنامه‌ها: ۱۰۰ هزار در روز<br>
      سهمیه‌های روزانه هر شب ساعت ۳:۳۰ بامداد به وقت ایران صفر می‌شوند. اگر روزی تمام شود سامانه تا آن ساعت خطا می‌دهد ولی <b>داده‌ای پاک نمی‌شود</b> و پولی هم کم نمی‌شود (حساب رایگان است). مصرف روزانه را در پنل Cloudflare، صفحه‌ی هر پایگاه، تب <b>Metrics</b> ببینید.
      <div class="field-label">حجم فعلی یعنی چه؟</div>
      متن گزارش‌ها خیلی کم‌حجم است؛ بیشترین فضا را عکس و فیلم‌ها می‌گیرند که بعد از ۷ روز خودکار پاک می‌شوند. پس با این روند، فضا سال‌ها کافی است. اگر نوار یک پایگاه زرد یا قرمز شد، به Claude یا برنامه‌نویس خبر دهید.
      </div></details>
    <button class="add-row-btn" onclick="cfLoad()">🔄 به‌روزرسانی</button>
  </div>`;
}
