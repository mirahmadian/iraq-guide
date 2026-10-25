/* ══════════════════════════════════════════
   RATE — نرخ دینار برای مبدل ارز برنامه
   نرخ خودکار هر ۳ ساعت از tgju.org در rate.json ذخیره می‌شود (GitHub Actions)؛
   مدیر فقط در صورت نیاز نرخ دستی وارد می‌کند (تومان برای هر ۱۰۰۰ دینار).
══════════════════════════════════════════ */
let rateManual = '';
function initRate() {
  rateManual = String((((CARAVAN_DATA.site || {}).rate) || {}).manual || '');
  renderRate();
  fetch('rate.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => renderRate(j)).catch(() => renderRate(null));
  renderReporter();
}
function renderRate(auto) {
  const el = document.getElementById('rate-editor');
  if (!el) return;
  const fa = n => (+n || 0).toLocaleString('fa', { maximumFractionDigits: 0 });
  el.innerHTML = `
    <div class="field"><div class="field-label">نرخ خودکار (بازار آزاد، از سایت tgju.org — هر ۳ ساعت به‌روز می‌شود)</div>
      <div class="empty-msg" style="padding:0;font-style:normal">${auto === undefined ? '…' : auto && auto.iqd_rial
        ? `هر ۱٬۰۰۰ دینار ≈ <b>${fa(auto.iqd_rial * 100)} تومان</b> — تاریخ نرخ: ${escH(auto.date_fa || auto.date || '')}`
        : '⚠️ نرخ خودکار در دسترس نیست — نرخ دستی را وارد کنید'}</div></div>
    <div class="field"><div class="field-label">نرخ دستی (اختیاری) — تومان برای هر ۱٬۰۰۰ دینار</div>
      <input type="text" class="input-full" inputmode="numeric" dir="ltr" style="max-width:220px" placeholder="خالی = نرخ خودکار" value="${escH(rateManual)}"
        oninput="rateManual=this.value">
      <div class="empty-msg" style="padding:6px 0 0">فقط اگر می‌خواهید نرخ دیگری (مثلاً نرخ صرافی‌های عراق) نشان داده شود پر کنید. تا وقتی پر باشد، نرخ خودکار استفاده نمی‌شود.</div></div>`;
}
function rateOut() {
  const m = +toEnA(rateManual).replace(/[^\d.]/g, '') || 0;
  return m > 0 ? { rate: { manual: m } } : {};
}

/* ══ ثبت‌کننده نرخ بازار عراق (صفحه nerkh.html) ══
   توکن محدود (فقط Actions) با رمز جداگانه رمزگذاری و در rate-key.json ذخیره می‌شود. */
const NERKH_URL = location.href.replace(/admin\.html.*$/, 'nerkh.html');
async function renderReporter() {
  const el = document.getElementById('rate-reporter');
  if (!el) return;
  const [key, mk] = await Promise.all([
    /* از خود گیت‌هاب می‌پرسیم (نه سایت)، چون سایت چند دقیقه بعد از ساخت به‌روز می‌شود */
    (ghToken ? gh('/contents/rate-key.json?t=' + Date.now(), ghToken, { cache: 'no-store' }) : fetch('rate-key.json?t=' + Date.now(), { cache: 'no-store' })).then(r => r.ok).catch(() => false),
    fetch('rate-market.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)]);
  const fa = n => (+n || 0).toLocaleString('fa', { maximumFractionDigits: 0 });
  const last = mk && mk.ts ? `آخرین ثبت: <b>${new Date(mk.ts).toLocaleString('fa-IR', { timeZone: 'Asia/Baghdad', dateStyle: 'medium', timeStyle: 'short' })}</b>${mk.by ? ' — ' + escH(mk.by) : ''}
    ${mk.toman_per_1000_iqd ? ` · هر ۱٬۰۰۰ دینار: <b>${fa(mk.toman_per_1000_iqd)} تومان</b>` : ''}${mk.iqd_per_usd ? ` · دلار: ${fa(mk.iqd_per_usd)} دینار` : ''}
    <br>${Date.now() - mk.ts < 36 * 36e5 ? '✅ همین نرخ الان در برنامه نمایش داده می‌شود (تا ۳۶ ساعت بعد از ثبت).' : '⏸ از ثبت گذشته؛ برنامه نرخ خودکار tgju را نشان می‌دهد.'}`
    : 'هنوز نرخی ثبت نشده است.';
  el.innerHTML = `
    <div class="field"><div class="field-label">👤 ثبت‌کننده نرخ بازار عراق</div>
      <div class="empty-msg" style="padding:0;font-style:normal;line-height:1.9">${last}</div></div>
    ${key ? `
    <div class="field"><div class="empty-msg" style="padding:0;font-style:normal;line-height:1.9">✅ دسترسی ثبت نرخ ساخته شده است. این لینک و رمزی که گذاشتید را برای ثبت‌کننده بفرستید:<br>
      <a href="${escH(NERKH_URL)}" target="_blank" rel="noopener" dir="ltr" style="font-weight:800;font-size:15px;user-select:all;word-break:break-all">${escH(NERKH_URL)}</a></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="add-row-btn" style="margin:0;width:auto;flex:1" onclick="navigator.clipboard.writeText('${escH(NERKH_URL)}').then(()=>showToast('لینک کپی شد'))">📋 کپی لینک</button>
        <button class="add-row-btn" style="margin:0;width:auto;flex:1" onclick="document.getElementById('rep-new').style.display='block'">🔑 عوض کردن رمز یا کلید</button>
        <button class="del-btn" style="width:auto;height:auto;min-height:40px;padding:0 12px" onclick="reporterRevoke()">⛔ قطع دسترسی</button>
      </div></div>` : ''}
    <div id="rep-new" style="display:${key ? 'none' : 'block'}">
      <div class="field"><div class="empty-msg" style="padding:0;font-style:normal;line-height:2">
        برای اینکه ثبت‌کننده بدون دسترسی مدیر بتواند نرخ را ثبت کند، یک <b>کلید محدود</b> در گیت‌هاب بسازید:<br>
        ۱. این صفحه را باز کنید: <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener" dir="ltr">github.com/settings/personal-access-tokens/new</a><br>
        ۲. <b>Token name</b>: «ثبت نرخ» — <b>Expiration</b>: مثلاً ۱ سال<br>
        ۳. <b>Repository access</b> ← <b>Only select repositories</b> ← <b>iraq-guide</b><br>
        ۴. <b>Permissions</b> ← <b>Repository permissions</b> ← فقط <b>Actions</b> را روی <b>Read and write</b> بگذارید (به Contents دست نزنید)<br>
        ۵. <b>Generate token</b> را بزنید و کلید (با github_pat_ شروع می‌شود) را اینجا بچسبانید.</div></div>
      <div class="field"><div class="field-label">کلید محدود (توکن)</div>
        <input type="password" class="input-full" dir="ltr" id="rep-token" placeholder="github_pat_..." autocomplete="off"></div>
      <div class="field"><div class="field-label">رمز برای ثبت‌کننده (حداقل ۸ حرف — این را به او بدهید)</div>
        <input type="text" class="input-full" dir="ltr" id="rep-pass" autocomplete="off"></div>
      <div style="padding:0 16px 12px"><button class="add-row-btn" onclick="reporterCreate(this)">🔐 ساخت دسترسی ثبت نرخ</button></div>
    </div>`;
}
async function reporterCreate(btn) {
  const tok = document.getElementById('rep-token').value.trim(), pass = document.getElementById('rep-pass').value;
  if (!ghToken) return showToast('اول وارد پنل مدیریت شوید');
  if (!tok) return showToast('کلید را بچسبانید');
  if (pass.length < 8) return showToast('رمز باید حداقل ۸ حرف باشد');
  btn.disabled = true; btn.textContent = '... در حال بررسی کلید';
  try {
    const w = await gh('/actions/workflows/rate-market.yml', tok);
    if (!w.ok) throw new Error('این کلید به Actions مخزن iraq-guide دسترسی ندارد (' + w.status + '). مرحله ۳ و ۴ را بررسی کنید.');
    /* آزمایش بی‌خطر: نوشتن خالی (بدون محتوا) — کلید بدون دسترسی Contents خطای ۴۰۳ می‌گیرد،
       کلید با دسترسی نوشتن خطای ۴۲۲ (محتوای ناقص)؛ در هر دو حالت چیزی نوشته نمی‌شود.
       (permissions در پاسخ /repos دسترسی خود حساب مدیر است، نه کلید؛ برای بررسی کلید به کار نمی‌آید.) */
    const probe = await gh('/contents/.rate-key-probe', tok, { method: 'PUT', body: '{}' });
    if (probe.status === 422 && !confirm('به نظر می‌رسد این کلید اجازه تغییر فایل‌های برنامه (Contents) را هم دارد.\nبرای امنیت بهتر است کلیدی بسازید که فقط Actions داشته باشد.\n\nبا همین کلید ادامه می‌دهید؟'))
      throw new Error('ساخت دسترسی لغو شد');
    await putFile('rate-key.json', await encryptToken(tok, pass), 'Add rate reporter key', ghToken);
    showToast('✅ دسترسی ساخته شد — لینک و رمز را برای ثبت‌کننده بفرستید', 4000);
    setTimeout(renderReporter, 1500);
  } catch (e) { showToast('❌ ' + e.message, 5000); btn.disabled = false; btn.textContent = '🔐 ساخت دسترسی ثبت نرخ'; }
}
async function reporterRevoke() {
  if (!ghToken) return showToast('اول وارد پنل مدیریت شوید');
  if (!confirm('دسترسی ثبت‌کننده نرخ قطع شود؟\nبرای اطمینان کامل، خود کلید را هم در گیت‌هاب (Settings ← Developer settings ← Fine-grained tokens) حذف کنید.')) return;
  try {
    const cur = await gh('/contents/rate-key.json?t=' + Date.now(), ghToken, { cache: 'no-store' });
    if (cur.ok) {
      const r = await gh('/contents/rate-key.json', ghToken, { method: 'DELETE', body: JSON.stringify({ message: 'Remove rate reporter key', sha: (await cur.json()).sha }) });
      if (!r.ok) throw new Error('(' + r.status + ')');
    }
    showToast('دسترسی قطع شد');
    setTimeout(renderReporter, 1500);
  } catch (e) { showToast('❌ قطع دسترسی ناموفق بود ' + e.message); }
}
