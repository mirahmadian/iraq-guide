/* ══════════════════════════════════════════
   GUARD ADMIN — تب آمار ← «🛡️ سلامت سرور و پشتیبان‌ها» (فقط مدیر اصلی)
   داده از worker/guard.js: وضعیت سامانه‌های سرور 188، فهرست پشتیبان‌ها در Cloudflare و دانلود آن‌ها
══════════════════════════════════════════ */
let guardData = null, guardErr = '';
function guardLoad() {
  if (STAFF) return;
  guardErr = ''; renderGuard();
  adminFetch('/admin/guard', null, adminAuth()).then(d => { guardData = d; renderGuard(); renderRescue(); }).catch(e => { guardErr = e.message; renderGuard(); });
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
