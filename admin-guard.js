/* ══════════════════════════════════════════
   GUARD ADMIN — تب آمار ← «🛡️ سلامت سرور و پشتیبان‌ها» (فقط مدیر اصلی)
   داده از worker/guard.js: وضعیت سامانه‌های سرور 188، فهرست پشتیبان‌ها در Cloudflare و دانلود آن‌ها
══════════════════════════════════════════ */
let guardData = null, guardErr = '';
function guardLoad() {
  if (STAFF) return;
  guardErr = ''; renderGuard();
  adminFetch('/admin/guard', null, adminAuth()).then(d => { guardData = d; renderGuard(); }).catch(e => { guardErr = e.message; renderGuard(); });
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
  const last = by('data')[0], full = by('full')[0];
  el.innerHTML = `
  <div class="gd-checks">${d.checks.map(c => `<div class="gd-c ${c.up === false ? 'down' : 'up'}"><b>${c.up === false ? '🔴' : '🟢'} ${escH(c.name)}</b>
    <small>${c.up === false ? `قطع از ${gAgo(c.since)}` : c.last ? `سالم · آخرین بررسی ${gAgo(c.last)}${c.ms ? ` · پاسخ در ${gFa(Math.round(c.ms / 100) / 10)} ثانیه` : ''}` : 'هنوز بررسی نشده'}</small></div>`).join('')}</div>
  <div class="gd-sum">
    <div>💾 <b>آخرین پشتیبان ساعتی:</b> ${last ? gTs(last.ts) : 'هنوز گرفته نشده'}</div>
    <div>📦 <b>آخرین پشتیبان کامل (با کد برنامه‌ها):</b> ${full ? gTs(full.ts) : 'هنوز گرفته نشده'}</div>
    <div>🔔 <b>هشدار در بله:</b> ${d.alerts ? 'فعال است ✅ <button class="lock-link" onclick="guardTest(this)">فرستادن پیام آزمایشی</button>' : '<span style="color:#B3261E">هنوز فعال نشده</span> — کد فعال‌سازی را از Claude بگیرید و برای بازوی @HamyarKaravan_Bot بفرستید.'}</div>
  </div>
  <details class="gd-det"><summary>همه نسخه‌های پشتیبان (${gFa(d.backups.length)})</summary>
    ${[['full', '📦 کامل — هر شب، ۳۵ روز نگه داشته می‌شود'], ['daily', '📅 روزانه — ۳۵ روز'], ['data', '🕐 ساعتی — ۳ روز']].map(([k, t]) => by(k).length ? `<div class="field-label" style="margin-top:10px">${t}</div>${by(k).map(row).join('')}` : '').join('')}
  </details>
  <div class="empty-msg" style="padding:8px 0 0">سرور هر ساعت از داده‌های سامانه نواقص هتل‌ها، چاپ و بسته‌بندی و بیمه نسخه پشتیبان می‌سازد و Cloudflare آن را بیرون از ایران نگه می‌دارد. اگر سرور از دست برود، Claude با همین نسخه‌ها همه چیز را روی سرور تازه برمی‌گرداند.</div>
  <button class="add-row-btn" onclick="guardLoad()">🔄 به‌روزرسانی</button>`;
}
async function guardGet(k, b) {
  b.disabled = true; const t = b.textContent; b.textContent = '⏳';
  try {
    const r = await fetch(RV_API + '/admin/guard/get?k=' + encodeURIComponent(k), { headers: { Authorization: adminAuth() } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'خطا ' + r.status);
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = 'hamyar-' + k.replace('/', '-') + '.tar.gz';
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
  </style>`);
})();
