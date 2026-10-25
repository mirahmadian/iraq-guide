/* ══════════════════════════════════════════
   STAY — محاسبه تاریخ خروج از عراق (مهلت اقامت ۳۰ روزه)
   روز ورود = روز اول؛ آخرین روز مجاز = ورود + (مدت − ۱).
   تاریخ ورود روی همین گوشی ذخیره می‌شود تا در صفحه اول «روزهای مانده» و هشدار نزدیک شدن مهلت دیده شود.
   تبدیل تاریخ شمسی/میلادی از ابزار «محاسبه‌گر اقامت» خود مدیر برنامه.
══════════════════════════════════════════ */
(function injectStayCSS() {
  const css = `
  .st-form{padding:14px;border-radius:16px;background:var(--card);border:1px solid var(--border-s)}
  .st-cal{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
  .st-cal button,.st-quick button{min-height:42px;border-radius:12px;border:1px solid var(--border-s);background:var(--card2);color:var(--text);cursor:pointer;
    font-family:var(--font);font-size:calc(13.5px * var(--fs,1));font-weight:800}
  .st-cal button.on{background:var(--gold);border-color:var(--gold);color:#fff}
  .st-lbl{display:block;font-size:calc(12.5px * var(--fs,1));font-weight:800;color:var(--brass);margin:10px 0 4px}
  .st-date{display:grid;grid-template-columns:1fr 1.4fr 1.1fr;gap:6px}
  .st-form select,.st-form input{width:100%;min-height:48px;padding:0 8px;border-radius:12px;border:1px solid var(--border-s);background:var(--card2);color:var(--text);
    font-family:var(--font);font-size:calc(15px * var(--fs,1));font-weight:800;box-sizing:border-box}
  .st-quick{display:flex;gap:6px;margin-top:8px}
  .st-quick button{flex:1;min-height:38px;font-size:calc(12.5px * var(--fs,1))}
  .st-res{margin-top:14px;padding:16px;border-radius:18px;text-align:center;border:2px solid var(--gold);background:var(--gold-dim)}
  .st-res.warn{border-color:#C77700;background:rgba(199,119,0,.10)}
  .st-res.bad{border-color:#B3261E;background:rgba(179,38,30,.10)}
  .st-big{font-size:calc(40px * var(--fs,1));font-weight:900;line-height:1.3;color:var(--pri-ink)}
  .st-res.warn .st-big{color:#9A5C00} .st-res.bad .st-big{color:#B3261E}
  [data-theme="dark"] .st-res.warn .st-big{color:#F0B04A} [data-theme="dark"] .st-res.bad .st-big{color:#FF8A80}
  .st-big small{font-size:calc(16px * var(--fs,1))}
  .st-sub{font-size:calc(14px * var(--fs,1));font-weight:800;line-height:1.8}
  .st-bar{height:10px;border-radius:10px;background:var(--card2);overflow:hidden;margin:12px 0 4px;border:1px solid var(--border)}
  .st-bar i{display:block;height:100%;background:var(--gold);border-radius:10px}
  .st-res.warn .st-bar i{background:#C77700} .st-res.bad .st-bar i{background:#B3261E}
  .st-last{margin-top:12px;padding:12px;border-radius:14px;background:var(--card);border:1px solid var(--border-s);line-height:1.9}
  .st-last small{display:block;font-size:calc(12px * var(--fs,1));color:var(--muted);font-weight:700}
  .st-last b{display:block;font-size:calc(19px * var(--fs,1));font-weight:900;color:var(--text)}
  .st-last .en{direction:ltr;font-size:calc(15px * var(--fs,1));font-weight:800;color:var(--muted)}
  .st-tbl{width:100%;border-collapse:collapse;margin-top:8px;font-size:calc(13px * var(--fs,1))}
  .st-tbl td{padding:8px 4px;border-bottom:1px solid var(--border);text-align:center}
  .st-tbl tr.today td{background:var(--gold-dim);font-weight:900}
  .st-tbl tr.last td{color:#B3261E;font-weight:900}
  .st-more{margin-top:12px;border-radius:14px;background:var(--card);border:1px solid var(--border-s);padding:0 12px}
  .st-more summary{min-height:46px;display:flex;align-items:center;cursor:pointer;font-weight:800;color:var(--pri-ink);font-size:calc(14px * var(--fs,1))}
  .st-tips{font-size:calc(12.5px * var(--fs,1));color:var(--muted);line-height:2;margin:12px 4px 0;padding-inline-start:18px}
  .stay-alert{display:flex;gap:10px;align-items:center;width:100%;margin-top:12px;padding:12px 14px;border-radius:16px;cursor:pointer;text-align:right;font-family:var(--font);
    border:1px solid #C77700;background:rgba(199,119,0,.12);color:var(--text);font-size:calc(14px * var(--fs,1));font-weight:800;line-height:1.8}
  .stay-alert.bad{border-color:#B3261E;background:rgba(179,38,30,.12)}
  .stay-alert span:first-child{font-size:24px}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

/* ── تقویم شمسی ↔ میلادی ── */
function stToGregorian(jy, jm, jd) {
  const sal_a = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], sal_b = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const jdm = [0, 31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  jy += 1595;
  let days = -355668 + 365 * jy + ~~(jy / 33) * 8 + ~~(((jy % 33) + 3) / 4) + jd;
  for (let i = 1; i < jm; i++) days += jdm[i];
  let gy = 400 * ~~(days / 146097);
  days %= 146097;
  if (days > 36524) { gy += 100 * ~~(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * ~~(days / 1461); days %= 1461;
  gy += ~~((days - 1) / 365);
  if (days > 365) days = (days - 1) % 365;
  let gd = days + 1, gm = 0;
  const sal = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? sal_b : sal_a;
  for (let i = 1; i <= 12; i++) { if (gd <= sal[i]) { gm = i; break; } gd -= sal[i]; }
  return { gy, gm, gd };
}
function stToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy > 1600 ? 979 : 0;
  gy -= gy > 1600 ? 1600 : 621;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + ~~((gy2 + 3) / 4) - ~~((gy2 + 99) / 100) + ~~((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * ~~(days / 12053); days %= 12053;
  jy += 4 * ~~(days / 1461); days %= 1461;
  if (days > 365) { jy += ~~((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + ~~(days / 31) : 7 + ~~((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}
const ST_JM = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const ST_GM = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
const ST_WD = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const stJLen = (y, m) => m <= 6 ? 31 : m <= 11 ? 30 : (stToJalali(...Object.values(stToGregorian(y, 12, 30))).jm === 12 ? 30 : 29);
const stGLen = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/* شماره روز (روزهای پس از ۱۹۷۰) — همه حساب‌ها با این عدد انجام می‌شود */
const stDayNo = (gy, gm, gd) => Date.UTC(gy, gm - 1, gd) / 864e5;
const stFromNo = n => { const d = new Date(n * 864e5); return { gy: d.getUTCFullYear(), gm: d.getUTCMonth() + 1, gd: d.getUTCDate(), wd: d.getUTCDay() }; };
const stToday = () => { const n = iraqNow(); return stDayNo(n.y, n.mo + 1, n.d); };
function stJText(n) { const g = stFromNo(n), j = stToJalali(g.gy, g.gm, g.gd); return `${ST_WD[g.wd]} ${faDigits(j.jd)} ${ST_JM[j.jm - 1]} ${faDigits(j.jy)}`; }
function stGText(n) { const g = stFromNo(n); return `${g.gd} ${ST_GM[g.gm - 1]} ${g.gy}`; }
function stGNum(n) { const g = stFromNo(n); return `${g.gy}/${String(g.gm).padStart(2, '0')}/${String(g.gd).padStart(2, '0')}`; }
function stHijri(n) { try { return new Intl.DateTimeFormat('fa-IR-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(n * 864e5)); } catch (e) { return ''; } }

/* ── ذخیره روی گوشی: { entry: شماره روز ورود, days } ── */
const ST_KEY = 'caravan-stay';
function stLoad() { try { const o = JSON.parse(localStorage.getItem(ST_KEY) || 'null'); return o && o.entry ? o : null; } catch (e) { return null; } }
function stSave(o) { try { o ? localStorage.setItem(ST_KEY, JSON.stringify(o)) : localStorage.removeItem(ST_KEY); } catch (e) {} }
/* وضعیت: روز چندم، روزهای مانده (با احتساب امروز)، آخرین روز */
function stStatus(o) {
  const last = o.entry + o.days - 1, today = stToday();
  return { last, today, dayNo: today - o.entry + 1, left: last - today + 1 };
}

/* ── صفحه اول: زیرنویس آیکون و هشدار ── */
function staySub() {
  const o = stLoad(); if (!o) return '';
  const s = stStatus(o);
  if (s.left < -14 || s.dayNo < 1) return '';
  return s.left > 1 ? faDigits(s.left) + ' روز مانده' : s.left === 1 ? 'امروز روز آخر' : 'مهلت تمام شده';
}
function stayAlertHTML() {
  const o = stLoad(); if (!o) return '';
  const s = stStatus(o);
  if (s.left > 5 || s.left < -14 || s.dayNo < 1) return '';
  const bad = s.left <= 1;
  const msg = s.left > 1 ? `فقط <b>${faDigits(s.left)} روز</b> تا پایان مهلت اقامت در عراق مانده — آخرین روز: ${stJText(s.last)}`
    : s.left === 1 ? '<b>امروز آخرین روز مجاز اقامت شما در عراق است.</b>'
    : '<b>مهلت اقامت شما در عراق تمام شده است.</b> هرچه زودتر با ستاد تماس بگیرید.';
  return `<button class="stay-alert ${bad ? 'bad' : ''}" onclick="openStay()"><span aria-hidden="true">⚠️</span><span>${msg}</span></button>`;
}

/* ── صفحه محاسبه ── */
let stForm = null;
function openStay() {
  const o = stLoad(), t = stToday();
  const g = stFromNo(o ? o.entry : t), j = stToJalali(g.gy, g.gm, g.gd);
  stForm = { cal: (stForm && stForm.cal) || 'j', days: o ? o.days : 30, j: { y: j.jy, m: j.jm, d: j.jd }, g: { y: g.gy, m: g.gm, d: g.gd } };
  openPage('📅 تاریخ خروج از عراق', `<div id="stBody"></div>`);
  stRender(!!o);
}
function stEntryNo() {
  const f = stForm;
  if (f.cal === 'g') return stDayNo(f.g.y, f.g.m, f.g.d);
  const g = stToGregorian(f.j.y, f.j.m, f.j.d);
  return stDayNo(g.gy, g.gm, g.gd);
}
function stRender(saved) {
  const f = stForm, box = document.getElementById('stBody');
  if (!box) return;
  const t = stFromNo(stToday()), tj = stToJalali(t.gy, t.gm, t.gd);
  const isJ = f.cal === 'j', D = isJ ? f.j : f.g;
  const len = isJ ? stJLen(D.y, D.m) : stGLen(D.y, D.m);
  if (D.d > len) D.d = len;
  const years = isJ ? [tj.jy - 1, tj.jy] : [t.gy - 1, t.gy];
  const opt = (v, l, on) => `<option value="${v}" ${on ? 'selected' : ''}>${l}</option>`;
  const entry = stEntryNo(), o = { entry, days: Math.max(1, Math.min(365, +f.days || 30)) }, s = stStatus(o);
  const cls = s.dayNo < 1 ? '' : s.left <= 1 ? 'bad' : s.left <= 5 ? 'warn' : '';
  const big = s.dayNo < 1 ? `<div class="st-sub">تاریخ ورود در آینده است</div>`
    : s.left > 1 ? `<div class="st-big">${faDigits(s.left)} <small>روز مانده</small></div><div class="st-sub">امروز روز ${faDigits(s.dayNo)} از ${faDigits(o.days)} روز اقامت شماست</div>`
    : s.left === 1 ? `<div class="st-big">امروز</div><div class="st-sub">آخرین روز مجاز اقامت شماست — امروز باید از عراق خارج شوید</div>`
    : `<div class="st-big">${faDigits(-s.left + 1)} <small>روز گذشته</small></div><div class="st-sub">مهلت اقامت تمام شده است؛ هرچه زودتر با ستاد تماس بگیرید</div>`;
  const pct = Math.max(0, Math.min(100, s.dayNo / o.days * 100));
  let rows = '';
  for (let n = entry; n <= s.last; n++) {
    const g = stFromNo(n), j = stToJalali(g.gy, g.gm, g.gd);
    rows += `<tr class="${n === s.today ? 'today' : ''} ${n === s.last ? 'last' : ''}"><td>${faDigits(n - entry + 1)}</td><td>${ST_WD[g.wd]}</td><td>${faDigits(j.jd)} ${ST_JM[j.jm - 1]}</td><td dir="ltr">${stGNum(n)}</td><td>${n === s.today ? 'امروز' : n === s.last ? 'آخرین روز' : ''}</td></tr>`;
  }
  box.innerHTML = `
    <div class="st-form">
      <div class="st-cal"><button class="${isJ ? 'on' : ''}" onclick="stSet('cal','j')">تاریخ شمسی</button><button class="${isJ ? '' : 'on'}" onclick="stSet('cal','g')">تاریخ میلادی (مُهر گذرنامه)</button></div>
      <label class="st-lbl">📥 تاریخ ورود به عراق</label>
      <div class="st-date">
        <select aria-label="روز" onchange="stSet('d',+this.value)">${Array.from({ length: len }, (_, i) => opt(i + 1, faDigits(i + 1), D.d === i + 1)).join('')}</select>
        <select aria-label="ماه" onchange="stSet('m',+this.value)">${(isJ ? ST_JM : ST_GM).map((n, i) => opt(i + 1, n, D.m === i + 1)).join('')}</select>
        <select aria-label="سال" onchange="stSet('y',+this.value)">${years.map(y => opt(y, faDigits(y), D.y === y)).join('')}</select>
      </div>
      <div class="st-quick"><button onclick="stQuick(0)">امروز وارد شدم</button><button onclick="stQuick(1)">دیروز</button><button onclick="stQuick(2)">پریروز</button></div>
      <label class="st-lbl">⏳ مدت مجاز اقامت (روز)</label>
      <input type="number" inputmode="numeric" min="1" max="365" value="${o.days}" onchange="stSet('days',+this.value)" style="max-width:120px">
    </div>
    ${saved ? '' : '<div class="lost-loc" style="margin-top:12px">👆 تاریخ ورود خود را انتخاب کنید (اگر امروز وارد شده‌اید، «امروز وارد شدم» را بزنید). بعد از انتخاب، روی گوشی ذخیره می‌شود و روزهای مانده در صفحه اول هم دیده می‌شود.</div>'}
    <div class="st-res ${cls}">
      ${big}
      <div class="st-bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <div class="st-last"><small>آخرین روز مجاز اقامت (تا پایان این روز باید خارج شده باشید)</small>
        <b>${stJText(s.last)}</b><span class="en">${stGText(s.last)} · ${stGNum(s.last)}</span>${stHijri(s.last) ? `<small>${stHijri(s.last)}</small>` : ''}</div>
    </div>
    <button class="lost-btn" onclick="stRemind()">⏰ یادآوری در تقویم گوشی (۳ روز و ۱ روز قبل)</button>
    ${saved ? `<button class="lost-btn alt" onclick="stClear()">🗑 پاک کردن تاریخ ورود (سفر تمام شد)</button>` : ''}
    <details class="st-more"><summary>📋 روزشمار کامل (${faDigits(o.days)} روز)</summary>
      <table class="st-tbl"><tbody>${rows}</tbody></table></details>
    <ul class="st-tips">
      <li>طبق قانون عراق، زائر خارجی باید حداکثر تا پایان <b>روز ${faDigits(o.days)}</b> از عراق خارج شود. <b>روز ورود، روز اول حساب می‌شود.</b></li>
      <li>ملاک، تاریخ <b>مُهر ورود در گذرنامه</b> است (میلادی). اگر شک دارید، «تاریخ میلادی» را بزنید و از روی مُهر وارد کنید.</li>
      <li>یکی دو روز زودتر برای خروج برنامه بریزید؛ در روزهای شلوغ، صف مرز ممکن است طولانی شود.</li>
      <li>ماندن بیش از مهلت ممکن است جریمه و مشکل در خروج یا سفرهای بعدی داشته باشد. در صورت هر سؤال با ستاد تماس بگیرید.</li>
      <li>تاریخ ورود فقط روی همین گوشی ذخیره می‌شود و روزهای مانده در صفحه اول هم نشان داده می‌شود.</li>
    </ul>`;
  if (saved) stSave(o);
}
function stSet(k, v) {
  const f = stForm;
  if (k === 'cal') {
    const n = stEntryNo(), g = stFromNo(n), j = stToJalali(g.gy, g.gm, g.gd);
    f.cal = v; f.g = { y: g.gy, m: g.gm, d: g.gd }; f.j = { y: j.jy, m: j.jm, d: j.jd };
  } else if (k === 'days') f.days = v;
  else (f.cal === 'j' ? f.j : f.g)[k] = v;
  stRender(true);
}
function stQuick(back) {
  const g = stFromNo(stToday() - back), j = stToJalali(g.gy, g.gm, g.gd);
  stForm.g = { y: g.gy, m: g.gm, d: g.gd }; stForm.j = { y: j.jy, m: j.jm, d: j.jd };
  stRender(true);
}
function stClear() {
  if (!confirm('تاریخ ورود پاک شود؟')) return;
  stSave(null); stForm = null; closePage();
  showToast('تاریخ ورود پاک شد');
}
/* رویداد تقویم: ساعت ۹ صبح (عراق) روز آخر، با هشدار ۳ روز و ۱ روز قبل و همان صبح */
function stRemind() {
  const o = stLoad();
  if (!o) return showToast('اول تاریخ ورود را انتخاب کنید');
  const s = stStatus(o), start = (s.last * 864e5) + 6 * 36e5, uid = `stay-${o.entry}@iraq-guide`;
  const alarm = tr => ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc('پایان مهلت اقامت در عراق'), 'TRIGGER:' + tr, 'END:VALARM'];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//iraq-guide//stay//FA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + icsTime(Date.now()), 'DTSTART:' + icsTime(start), 'DTEND:' + icsTime(start + 36e5),
    'SUMMARY:' + icsEsc('⚠️ آخرین روز مجاز اقامت در عراق'),
    'DESCRIPTION:' + icsEsc(`تا پایان امروز باید از عراق خارج شوید.\nورود: ${stJText(o.entry)} — مدت: ${o.days} روز`),
    ...alarm('-P3D'), ...alarm('-P1D'), ...alarm('-PT0M'), 'END:VEVENT', 'END:VCALENDAR'];
  remDownload(lines.map(icsFold).join('\r\n') + '\r\n', 'مهلت اقامت عراق.ics');
  showToast(remIsIos() ? 'در پنجره باز شده «افزودن به تقویم» را بزنید' : 'فایل تقویم دانلود شد — بازش کنید تا به تقویم گوشی اضافه شود', 4500);
}
