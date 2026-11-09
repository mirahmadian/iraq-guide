/* ══════════════════════════════════════════
   📦 بکاپ کامل نزد خود مدیر — تب آمار (فقط مدیر اصلی)
   کد برنامه (ZIP از GitHub) + همه‌ی دیتابیس‌های Cloudflare به صورت SQL + راهنمای بازگردانی
   همه در یک ZIP با رمز AES-256 که همین‌جا در مرورگر ساخته می‌شود؛ رمز به هیچ سروری فرستاده نمی‌شود.
══════════════════════════════════════════ */
let bkBusy = false, bkLast = null;
function bkInfo() {
  if (STAFF) return;
  adminFetch('/admin/backup/list', null, adminAuth()).then(d => { bkLast = d.last; bkRender(); }).catch(() => {});
}
function bkRender(msg) {
  const el = document.getElementById('backup-admin'); if (!el) return;
  if (STAFF) { el.closest('.sec-card').style.display = 'none'; return; }
  if (bkBusy && msg) { const m = document.getElementById('bkMsg'); if (m) m.innerHTML = msg; return; }
  const days = bkLast ? Math.floor((Date.now() - bkLast) / 864e5) : null;
  el.innerHTML = `
  <div class="gd-sum" style="margin-top:0">
    <div>📦 <b>آخرین بکاپ کامل که دانلود کرده‌اید:</b> ${bkLast ? (days ? gFa(days) + ' روز پیش' : 'امروز') : '<span style="color:#B3261E">هنوز گرفته نشده</span>'}${days >= 7 ? ' <span style="color:#B3261E">— وقت بکاپ تازه است</span>' : ''}</div>
    <div style="line-height:2">همه‌ی <b>کد برنامه و پنل</b> و همه‌ی <b>دیتابیس‌ها</b> (نظرات، مدیران کاروان، شرکت‌ها، سفرها، همکاران، سامانه‌ی نواقص و پشتیبان‌های سرور) در یک فایل ZIP <b>رمزدار</b> (حدود ۳۰ مگ). هفته‌ای یک بار بگیرید و روی کامپیوتر یا فلش نگه دارید.</div>
  </div>
  <div class="mga-form" style="margin-top:8px">
    <input id="bkP1" type="password" class="input-full" placeholder="یک رمز برای فایل (دست‌کم ۸ حرف)" autocomplete="new-password" dir="ltr">
    <input id="bkP2" type="password" class="input-full" placeholder="تکرار رمز" autocomplete="new-password" dir="ltr">
  </div>
  <button class="pub-btn" style="margin-top:8px" onclick="bkRun(this)" ${bkBusy ? 'disabled' : ''}>📦 دانلود بکاپ کامل</button>
  <div id="bkMsg" class="empty-msg" style="padding:8px 0 0;line-height:2"></div>
  <details class="gd-det"><summary>❓ رمز را کجا بنویسم؟ چطور باز کنم؟</summary><div style="padding:8px 0;line-height:2">
    <ul>
      <li><b>رمز را گم نکنید</b>؛ بدون آن هیچ‌کس، حتی خودتان، فایل را باز نمی‌کند. آن را روی کاغذ یا جایی جدا از خود فایل نگه دارید.</li>
      <li>برای باز کردن در کامپیوتر از <b>WinRAR</b> یا <b>7-Zip</b> استفاده کنید (بازکننده‌ی خود ویندوز این نوع رمز را نمی‌شناسد). در گوشی اندروید: برنامه‌ی <b>ZArchiver</b>.</li>
      <li>داخل فایل یک <b>راهنمای بازگردانی</b> (README-RESTORE.txt) هست که می‌توانید عیناً به برنامه‌نویس یا Claude بدهید.</li>
      <li>کلیدها و رمزهای سرویس‌ها (Cloudflare، GitHub، بازوی بله و …) <b>داخل بکاپ نیستند</b>؛ فهرستشان در همان راهنما هست و باید جدا نگه‌داری شوند.</li>
    </ul></div></details>`;
}
function bkZipLib() {
  if (window.zip && zip.ZipWriter) return Promise.resolve();
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.52/dist/zip-full.min.js';
    s.onload = ok; s.onerror = () => no(new Error('بارگذاری سازنده‌ی ZIP ممکن نشد (اینترنت؟)')); document.head.appendChild(s); });
}
const bkQ = s => "'" + String(s).replace(/'/g, "''") + "'";
function bkVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'object' && v.$b !== undefined) { const b = atob(v.$b); let h = ''; for (let i = 0; i < b.length; i++) h += b.charCodeAt(i).toString(16).padStart(2, '0'); return `X'${h}'`; }
  return bkQ(typeof v === 'object' ? JSON.stringify(v) : v);
}
function bkJDate() {
  const p = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const g = t => (p.find(x => x.type === t) || {}).value || '';
  return `${g('year').replace(/\D/g, '')}-${g('month')}-${g('day')}`;
}
async function bkRun(btn) {
  const p1 = document.getElementById('bkP1').value, p2 = document.getElementById('bkP2').value;
  if (p1.length < 8) return showToast('رمز دست‌کم ۸ حرف باشد');
  if (p1 !== p2) return showToast('رمز و تکرارش یکی نیست');
  bkBusy = true; btn.disabled = true;
  const say = t => bkRender(t);
  try {
    say('⏳ آماده‌سازی…');
    await bkZipLib();
    zip.configure({ useWebWorkers: false });
    const date = bkJDate(), list = await adminFetch('/admin/backup/list', null, adminAuth());
    const zw = new zip.ZipWriter(new zip.BlobWriter('application/zip'), { password: p1, encryptionStrength: 3 });
    const info = { app: 'همیار کاروان', date, created: new Date().toISOString(), repo: 'mirahmadian/iraq-guide', databases: {} };
    for (const d of list.dbs) {
      const parts = [`-- همیار کاروان — بکاپ دیتابیس ${d.name} — ${date}\n-- بازگردانی: npx wrangler d1 execute ${d.name} --remote --file=${d.name}.sql (روی دیتابیس خالی)\nPRAGMA foreign_keys=OFF;\n`];
      info.databases[d.name] = {};
      for (const t of d.tables) parts.push(t.sql.replace(/^CREATE TABLE\s+(?!IF NOT EXISTS)/i, 'CREATE TABLE IF NOT EXISTS ') + ';\n');
      for (const t of d.tables) {
        const lim = t.blob ? 4 : 1000;
        let got = 0;
        for (let off = 0; off < t.n; off += lim) {
          say(`⏳ دیتابیس <b>${escH(d.name)}</b> — جدول ${escH(t.t)} (${gFa(Math.min(off + lim, t.n))} از ${gFa(t.n)})`);
          const r = await adminFetch(`/admin/backup/rows?db=${d.k}&t=${encodeURIComponent(t.t)}&off=${off}&lim=${lim}`, null, adminAuth());
          for (const row of r.rows) { const c = Object.keys(row); parts.push(`INSERT INTO "${t.t}" (${c.map(x => `"${x}"`).join(', ')}) VALUES (${c.map(x => bkVal(row[x])).join(', ')});\n`); }
          got += r.rows.length;
          if (r.rows.length < lim) break;
        }
        info.databases[d.name][t.t] = got;
      }
      for (const x of d.extra) parts.push(x.replace(/^CREATE (UNIQUE )?INDEX\s+(?!IF NOT EXISTS)/i, 'CREATE $1INDEX IF NOT EXISTS ') + ';\n');
      await zw.add(`2-databases/${d.name}.sql`, new zip.BlobReader(new Blob(parts, { type: 'text/plain' })));
    }
    say('⏳ دریافت کد برنامه از GitHub (حدود ۳۰ مگ)…');
    const sr = await fetch(RV_API + '/admin/backup/src', { headers: { Authorization: adminAuth() }, cache: 'no-store' });
    if (!sr.ok) throw new Error((await sr.json().catch(() => ({}))).error || 'دریافت کد برنامه ممکن نشد');
    const src = await sr.blob();
    info.source_bytes = src.size;
    say('⏳ رمزگذاری و ساخت فایل…');
    await zw.add('1-source-code/iraq-guide-source.zip', new zip.BlobReader(src), { level: 0 });
    await zw.add('README-RESTORE.txt', new zip.TextReader(BK_README(date, info)));
    await zw.add('info.json', new zip.TextReader(JSON.stringify(info, null, 2)));
    const blob = await zw.close();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hamyar-backup-${date}.zip`; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
    await adminFetch('/admin/backup/done', {}, adminAuth()).catch(() => {});
    bkBusy = false; bkLast = Date.now(); bkRender();
    document.getElementById('bkMsg').innerHTML = `✅ فایل <b>hamyar-backup-${date}.zip</b> (${gKb(blob.size)}) ساخته شد و دانلود شروع شد. آن را از پوشه‌ی دانلودها به جای امن (فلش یا کامپیوتر) منتقل کنید.`;
    showToast('بکاپ کامل ساخته شد ✅');
  } catch (e) {
    bkBusy = false; bkRender();
    document.getElementById('bkMsg').innerHTML = `<span style="color:#B3261E">❌ ${escH(e.message || String(e))}</span>`;
  }
}
function BK_README(date, info) {
  const db = Object.entries(info.databases).map(([n, t]) => `  - ${n}.sql  (${Object.values(t).reduce((a, b) => a + b, 0)} ردیف در ${Object.keys(t).length} جدول)`).join('\n');
  return `همیار کاروان — بکاپ کامل — ${date}
=====================================================

محتوا
-----
1-source-code/iraq-guide-source.zip
  کد کامل برنامه‌ی زائر، پنل مدیریت، سامانه‌ی نواقص هتل‌ها و Workerهای Cloudflare
  (همان مخزن GitHub: mirahmadian/iraq-guide، شاخه‌ی main، بدون تاریخچه‌ی تغییرات).

2-databases/
${db}
  هر فایل SQL شامل ساختار جدول‌ها و همه‌ی ردیف‌هاست.
  - hamyar-reviews       : نظرات، کاربران و همکاران پنل، مدیران کاروان، شرکت‌های مجری، سفرها، مشترکان بله، تنظیمات
  - hamyar-hotels        : سامانه‌ی نواقص هتل‌ها (کاربران تیم، گزارش‌ها، هتل‌ها، عوامل)
  - hamyar-hotels-media  : عکس و فیلم‌های سامانه‌ی نواقص
  - hamyar-backups       : پشتیبان‌های سرور ۱۸۸ و حافظه‌ی Claude

info.json : تاریخ و تعداد ردیف‌های هر جدول (برای بررسی کامل بودن بکاپ).

این فایل اطلاعات خصوصی دارد (شماره‌ی مدیران، اطلاعات شرکت‌ها، کد ملی همکاران).
آن را هرگز در GitHub عمومی یا جای عمومی نگذارید.

بازگردانی (برای برنامه‌نویس یا Claude)
-------------------------------------
۱. کد: محتوای iraq-guide-source.zip را در یک مخزن GitHub جدید بگذارید و GitHub Pages را روشن کنید
   (سایت از شاخه‌ی main و پوشه‌ی ریشه منتشر می‌شود).
۲. دیتابیس‌ها: در Cloudflare چهار D1 خالی با همین نام‌ها بسازید:
     npx wrangler d1 create hamyar-reviews   (و بقیه)
   شناسه‌ی هر کدام را در worker/wrangler.toml و worker/team-api/wrangler.toml بگذارید، بعد:
     npx wrangler d1 execute hamyar-reviews --remote --file=hamyar-reviews.sql
   (برای سه فایل دیگر هم همین‌طور).
۳. Workerها: در پوشه‌ی worker و worker/team-api و worker/team-proxy دستور  npx wrangler deploy
۴. رمزهای Workerها را دوباره بگذارید (npx wrangler secret put NAME) — پایین را ببینید.
۵. اگر نشانی Worker عوض شد، نشانی‌ها را در کد (RV_API و نشانی team) به‌روز کنید.
۶. بازوی بله: نشانی webhook را دوباره معرفی کنید (درخواست POST به ‎/admin/bale/setup با کلید GitHub مدیر).

کلیدها و رمزهایی که داخل این بکاپ نیستند (جدا و امن نگه دارید)
-----------------------------------------------------------------
- رمز ورود به حساب Cloudflare و کلید API آن
- رمز حساب GitHub و کلید GitHub که با آن وارد پنل می‌شوید
- رمزهای Worker «hamyar-reviews»:
    SALT          (مهم: کلید GitHub ذخیره‌شده و جلسه‌های ورود همکاران با همین مقدار کار می‌کنند)
    BALE_TOKEN    (توکن بازوی بله @HamyarKaravan_Bot — از BotFather بله هم دوباره گرفتنی است)
    BALE_HOOK     (یک مسیر مخفی دلخواه؛ می‌شود تازه ساخت)
    BACKUP_KEY    (همان کلید پشتیبان سرور ۱۸۸)
    VAPID_JWK     (کلید اعلان‌ها؛ اگر عوض شود گوشی‌ها باید دوباره اعلان را روشن کنند)
- رمز سرور 188.121.118.223
- افزونه‌ی کروم عتبات (خارج از GitHub نگه‌داری می‌شود)

نکته: خود Cloudflare هم تا ۳۰ روز گذشته‌ی هر دیتابیس را نگه می‌دارد
(npx wrangler d1 time-travel restore <نام> --timestamp=...)؛ این بکاپ برای وقتی است که دسترسی به حساب‌ها از دست برود.
`;
}
