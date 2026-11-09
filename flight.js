/* ══════════════════════════════════════════
   FLIGHT — ساعت حرکت از هتل به فرودگاه (دستورالعمل بعثه) + هشدارهای روز بازگشت
   مدیر کاروان شهر هتل، فرودگاه، تاریخ و ساعت پرواز را می‌دهد؛ ساعت خروج از هتل حساب می‌شود.
   هشدارها: اعلان روی صفحه‌ی گوشی (سرور worker/flight.js هر ۵ دقیقه بیدارش می‌کند؛ sw.js متن را از
   حافظه‌ی گوشی نشان می‌دهد)، پیام بله (اختیاری) و وقتی برنامه باز است، پیام داخل خود برنامه.
   همه‌ی ساعت‌ها به وقت عراق (UTC+3).
══════════════════════════════════════════ */
/* جدول ساعت‌ها و متن هشدارها: flight-def.js (پیش‌فرض) + آنچه مدیر در پنل منتشر کرده (flCfg) */
const FL_KEY = 'caravan-flight', FL_CACHE = 'flight-data';
const FL_VAPID = 'BBB3huPc-duqsm_MRzkmn5MWbbtWCnzu6cRu-JaBE2mIiJqiiLHRpIBxz8cww2XxFXzqdPDDD2fuSfHd8IE8bAs';

(function injectFlightCSS() {
  const css = `
  .fl-chips{display:flex;gap:6px;flex-wrap:wrap}
  .fl-chips button{flex:1;min-width:84px;min-height:46px;border-radius:12px;border:1px solid var(--border-s);background:var(--card2);color:var(--text);cursor:pointer;
    font-family:var(--font);font-size:calc(14px * var(--fs,1));font-weight:800}
  .fl-chips button.on{background:var(--gold);border-color:var(--gold);color:#fff}
  .fl-time{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;direction:ltr}
  .fl-time b{font-size:20px}
  .fl-steps{margin-top:12px;padding:4px 12px;border-radius:14px;background:var(--card);border:1px solid var(--border-s)}
  .fl-step{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px dashed var(--border)}
  .fl-step:last-child{border-bottom:0}
  .fl-step .t{min-width:78px;font-weight:900;color:var(--pri-ink);font-size:calc(13.5px * var(--fs,1));line-height:1.6}
  .fl-step .t small{display:block;font-weight:700;color:var(--muted);font-size:calc(11.5px * var(--fs,1))}
  .fl-step .m{flex:1;font-size:calc(13px * var(--fs,1));line-height:1.8}
  .fl-step.past{opacity:.45}
  .fl-ok{margin-top:12px;padding:12px 14px;border-radius:14px;line-height:1.9;font-size:calc(13.5px * var(--fs,1));background:rgba(30,125,79,.10);border:1px solid rgba(30,125,79,.4)}
  .fl-warn{margin-top:12px;padding:12px 14px;border-radius:14px;line-height:1.9;font-size:calc(13.5px * var(--fs,1));background:rgba(199,119,0,.12);border:1px solid #C77700}
  .fl-cal{margin-top:14px;padding:12px 14px;border-radius:14px;border:2px dashed var(--gold);background:var(--card);font-size:calc(13.5px * var(--fs,1));line-height:1.9}
  .fl-cal > b{font-size:calc(15px * var(--fs,1))}
  .fl-chk{display:flex;gap:10px;align-items:center;margin-top:12px;font-size:calc(13.5px * var(--fs,1));font-weight:700;line-height:1.7}
  .fl-chk input{width:22px;height:22px;accent-color:var(--gold)}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

/* ── ساعت و تاریخ به وقت عراق ── */
const flIraq = ms => new Date(ms + 3 * 36e5);
const flDayNo = ms => Math.floor((ms + 3 * 36e5) / 864e5);
function flHM(ms) {
  const d = flIraq(ms), h = d.getUTCHours(), m = d.getUTCMinutes();
  const part = h < 5 ? 'بامداد' : h < 12 ? 'صبح' : h < 15 ? 'ظهر' : h < 19 ? 'عصر' : 'شب';
  return `${faDigits(h)}:${faDigits(String(m).padStart(2, '0'))} ${part}`;
}
function flDayText(n) { const g = stFromNo(n), j = stToJalali(g.gy, g.gm, g.gd); return `${ST_WD[g.wd]} ${faDigits(j.jd)} ${ST_JM[j.jm - 1]}`; }
function flRelDay(ms) { const k = flDayNo(ms) - stToday(); return k === 0 ? 'امروز' : k === 1 ? 'فردا' : k === -1 ? 'دیروز' : flDayText(flDayNo(ms)); }
function flLeft(ms) {
  const m = Math.round((ms - Date.now()) / 6e4); if (m <= 0) return '';
  const h = Math.floor(m / 60), r = m % 60;
  return h >= 48 ? faDigits(Math.round(h / 24)) + ' روز دیگر' : (h ? faDigits(h) + ' ساعت' : '') + (h && r ? ' و ' : '') + (r ? faDigits(r) + ' دقیقه' : '') + ' دیگر';
}

/* ── ذخیره روی گوشی ── */
function flLoad() { try { const o = JSON.parse(localStorage.getItem(FL_KEY) || 'null'); return o && o.fl > Date.now() - 6 * 36e5 ? o : null; } catch (e) { return null; } }
function flStore(o) {
  try { o ? localStorage.setItem(FL_KEY, JSON.stringify(o)) : localStorage.removeItem(FL_KEY); } catch (e) {}
  /* کپی برای sw.js تا وقتی برنامه بسته است متن اعلان را بداند */
  try { caches.open(FL_CACHE).then(c => o ? c.put('flight.json', new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } })) : c.delete('flight.json')); } catch (e) {}
}

/* ── حساب ── */
function flCalc(f) {
  const hours = (flCfg().rules[f.city] || {})[f.air];
  if (!hours) return null;
  const fl = f.day * 864e5 + (f.h * 60 + f.m) * 6e4 - 3 * 36e5, dep = fl - hours * 36e5;
  return { ...f, hours, fl, dep };
}
function flSteps(c) {
  const depDay = flDayNo(c.dep), d = flIraq(c.dep), depMin = d.getUTCHours() * 60 + d.getUTCMinutes();
  const v = { 'حرکت': flHM(c.dep), 'پرواز': flHM(c.fl), 'فرودگاه': FL_AIR[c.air], 'روز': flDayText(depDay) };
  const fill = x => String(x || '').replace(/\{(حرکت|پرواز|فرودگاه|روز)\}/g, (_, k) => v[k]);
  const at = (day, hh) => day * 864e5 + hh * 36e5 - 3 * 36e5, hr = (x, def) => { const n = +x; return n >= 0 && n < 24 ? n : def; };
  const s = [];
  flCfg().msgs.forEach((m, i) => {
    if (!m || m.on === false || !(m.title || m.body)) return;
    let t;
    if (m.k === 'eve') { if (depMin < 8 * 60) return; t = at(depDay - 1, hr(m.at, 20)); }
    else if (m.k === 'eveN') { if (depMin >= 8 * 60) return; t = at(depDay - 1, hr(m.at, 14)); }
    else if (m.k === 'morn') { const mh = hr(m.at, 8); if (depMin - mh * 60 < 180) return; t = at(depDay, mh); }
    else t = c.dep - Math.max(0, Math.min(24 * 60, +m.min || 0)) * 6e4;
    s.push({ k: String(m.k || 'x' + i).slice(0, 10), t, title: fill(m.title).slice(0, 80) || '✈️ یادآوری حرکت به فرودگاه', body: fill(m.body).slice(0, 400) });
  });
  return s.sort((a, b) => a.t - b.t);
}

/* ── صفحه ── */
let flForm = null, flMsg = '';
function openFlight() {
  const o = flLoad(), t = stToday();
  const cur = typeof homeCity === 'function' && homeCity() ? homeCity().id : '';
  flForm = o ? { city: o.city, air: o.air, day: o.day, h: o.h, m: o.m, bale: o.bale }
    : { city: FL_CITY[cur] ? cur : 'karbala', air: 'najaf', day: t + 1, h: 12, m: 0, bale: typeof baleState === 'function' && baleState() === '1' };
  if (!o && flForm.city === 'kadhimiya') flForm.air = 'baghdad';
  flMsg = '';
  openPage('✈️ ساعت حرکت به فرودگاه', '<div id="flBody"></div>');
  flRender();
}
const flSame = (a, b) => a && b && ['city', 'air', 'day', 'h', 'm'].every(k => a[k] === b[k]);
function flRender() {
  const box = document.getElementById('flBody'); if (!box) return;
  const f = flForm, c = flCalc(f), o = flLoad(), saved = flSame(o, f), t = stToday(), now = Date.now();
  const chip = (k, v, l) => `<button class="${f[k] === v ? 'on' : ''}" onclick="flSet('${k}','${v}')">${l}</button>`;
  const opt = (v, l, on) => `<option value="${v}" ${on ? 'selected' : ''}>${l}</option>`;
  const days = Array.from({ length: 31 }, (_, i) => t + i);
  const prevDay = c && flDayNo(c.dep) < f.day, past = c && c.dep < now;
  const steps = c ? flSteps(c) : [];
  box.innerHTML = `
    <div class="st-form">
      <label class="st-lbl" style="margin-top:0">🏨 هتل شما در کدام شهر است؟</label>
      <div class="fl-chips">${Object.keys(FL_CITY).map(k => chip('city', k, FL_CITY[k])).join('')}</div>
      <label class="st-lbl">✈️ پرواز از کدام فرودگاه است؟</label>
      <div class="fl-chips">${Object.keys(FL_AIR).map(k => chip('air', k, FL_AIR[k])).join('')}</div>
      <label class="st-lbl">📅 تاریخ پرواز</label>
      <button type="button" class="jdp-btn" aria-label="تاریخ پرواز" onclick="JDP.open({ value: ${f.day} + 2440588, min: ${t} + 2440588, max: ${t + 30} + 2440588, title: 'تاریخ پرواز', onPick: d => d != null && flSet('day', d - 2440588) })">${(f.day === t ? 'امروز — ' : f.day === t + 1 ? 'فردا — ' : '') + flDayText(f.day)}</button>
      <label class="st-lbl">🕐 ساعت پرواز <span style="font-weight:700;color:var(--muted)">(به وقت عراق — همان ساعتی که روی بلیت است)</span></label>
      <div class="fl-time"><select aria-label="ساعت" onchange="flSet('h',+this.value)">${Array.from({ length: 24 }, (_, i) => opt(i, faDigits(String(i).padStart(2, '0')), f.h === i)).join('')}</select><b>:</b>
        <select aria-label="دقیقه" onchange="flSet('m',+this.value)">${Array.from({ length: 12 }, (_, i) => opt(i * 5, faDigits(String(i * 5).padStart(2, '0')), f.m === i * 5)).join('')}</select></div>
    </div>
    ${c ? `<div class="st-res ${past ? 'bad' : prevDay ? 'warn' : ''}">
      <div class="st-sub">ساعت خروج از هتل</div>
      <div class="st-big">${flHM(c.dep)}</div>
      <div class="st-sub">${flRelDay(c.dep)}${flRelDay(c.dep) !== flDayText(flDayNo(c.dep)) ? ` · ${flDayText(flDayNo(c.dep))}` : ''}${past ? '' : ` — ${flLeft(c.dep)}`}</div>
      <div style="margin-top:8px;font-size:calc(13px * var(--fs,1));line-height:1.9">طبق دستورالعمل بعثه، از ${FL_CITY[c.city]} به ${FL_AIR[c.air]}: <b>${faDigits(c.hours)} ساعت قبل از پرواز</b> (پرواز ${flHM(c.fl)})</div>
      ${past ? '<div style="margin-top:6px;font-weight:900;color:#B3261E">⚠️ این ساعت گذشته است. تاریخ و ساعت پرواز را بررسی کنید.</div>'
        : prevDay ? '<div style="margin-top:6px;font-weight:900">⚠️ دقت کنید: خروج از هتل <u>یک روز قبل</u> از تاریخ پرواز است.</div>' : ''}
    </div>` : ''}
    ${c && !past ? `
      <label class="fl-chk"><input type="checkbox" ${f.bale ? 'checked' : ''} onchange="flForm.bale=this.checked"> هشدارها در بازوی بله «همیار کاروان» هم فرستاده شود</label>
      ${saved ? `<div class="fl-ok">✅ <b>هشدارها روشن است.</b>${o.push ? ' سر هر زمان، روی صفحه‌ی گوشی اعلان می‌آید' : ' وقتی برنامه باز است هشدار می‌دهد'}${o.baleOk ? ' و در بله هم پیام می‌گیرید' : ''}.${flMsg ? `<br>${flMsg}` : ''}</div>
        ${f.bale !== o.bale ? '<button class="lost-btn" onclick="flEnable(this)">💾 ذخیره‌ی تغییر</button>' : ''}
        <button class="lost-btn alt" onclick="flOff()">🔕 خاموش کردن هشدارها</button>`
      : `<button class="lost-btn" onclick="flEnable(this)">🔔 ${o ? 'ذخیره و روشن کردن هشدارها' : 'روشن کردن هشدارها'}</button>${o ? '<div class="rem-note">هشدارهای قبلی شما برای پرواز دیگری است؛ با این دکمه جایگزین می‌شود.</div>' : ''}${flMsg ? `<div class="fl-warn">${flMsg}</div>` : ''}`}
      <div class="fl-cal"><b>📴 بدون اینترنت هم سر وقت خبر بده</b>
        <div>هشدارها را در <b>تقویم خود گوشی</b> ثبت کنید تا با ساعت گوشی، حتی وقتی اینترنت نیست، سر وقت روی صفحه بیایند.</div>
        <button class="lost-btn" onclick="flIcs()">⏰ ثبت هشدارها در گوشی (بدون اینترنت)</button>
        ${saved && o.ics ? '<div class="fl-ok" style="margin-top:8px">✅ فایل هشدارها ساخته شد. اگر در تقویم «ذخیره» را زده‌اید، کار تمام است.</div>' : ''}
        <div class="rem-note">${typeof remIsIos === 'function' && remIsIos() ? 'بعد از زدن دکمه، در پنجره‌ای که باز می‌شود «Add All» (افزودن همه) را بزنید.' : 'بعد از زدن دکمه، فایل دانلودشده را باز کنید (از نوار اعلان یا پوشه‌ی دانلود)، برنامه‌ی تقویم را انتخاب کنید و «ذخیره» را بزنید.'} به حساب گوگل یا تنظیم خاصی نیاز نیست.</div></div>
      <div class="st-lbl" style="margin-top:16px">🔔 برنامه‌ی هشدارها</div>
      <div class="fl-steps">${steps.map(s => `<div class="fl-step ${s.t < now ? 'past' : ''}"><div class="t">${flHM(s.t)}<small>${flRelDay(s.t)}</small></div><div class="m"><b>${escHtml(s.title)}</b><br>${escHtml(s.body)}</div></div>`).join('')}</div>` : ''}
    <ul class="st-tips">
      <li>ساعت پرواز را <b>به وقت عراق</b> وارد کنید (همان ساعت روی بلیت). ساعت عراق نیم ساعت از ایران عقب‌تر است.</li>
      <li>اعلان روی صفحه‌ی گوشی به <b>اینترنت</b> نیاز دارد. اگر اینترنت گوشی قطع باشد، اعلان بعد از وصل شدن می‌رسد؛ پس ساعت خروج را خودتان هم به خاطر بسپارید.</li>
      <li>روی <b>آیفون</b> اعلان فقط وقتی کار می‌کند که برنامه روی صفحه‌ی اصلی نصب شده باشد (Add to Home Screen).</li>
      <li>این ساعت‌ها طبق دستورالعمل عمومی بعثه است؛ اگر مدیر نقل یا ستاد ساعت دیگری اعلام کرد، همان ملاک است.</li>
    </ul>`;
}
function flSet(k, v) { flForm[k] = v; flMsg = ''; flRender(); }

const flKey = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
async function flEnable(btn) {
  const f = flForm, c = flCalc(f); if (!c) return;
  const steps = flSteps(c).filter(s => s.t > Date.now() + 30e3);
  if (!steps.length) return showToast('زمان حرکت گذشته است');
  if (btn) { btn.disabled = true; btn.textContent = 'در حال روشن کردن…'; }
  let sub = null, why = '';
  if (!('Notification' in window) || !('serviceWorker' in navigator)) why = /iPhone|iPad/i.test(navigator.userAgent) ? 'ios' : 'old';
  else {
    let perm = Notification.permission;
    if (perm === 'default') try { perm = await Notification.requestPermission(); } catch (e) {}
    if (perm !== 'granted') why = 'denied';
    else try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.pushManager) why = /iPhone|iPad/i.test(navigator.userAgent) ? 'ios' : 'old';
      else sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: flKey(FL_VAPID) });
    } catch (e) { why = 'push'; }
  }
  const prev = flLoad();
  const o = { city: c.city, air: c.air, day: c.day, h: c.h, m: c.m, fl: c.fl, dep: c.dep, steps, bale: !!f.bale, push: !!sub, baleOk: false, shown: [],
    ics: flSame(prev, f) && prev.ics, icsSteps: prev && prev.icsSteps };
  let net = true;
  try { const r = await rvFetch('/flight/set', { sub: sub ? sub.toJSON() : null, steps, fl: c.fl, bale: !!f.bale }); o.push = !!sub && r.push; o.baleOk = !!r.bale; }
  catch (e) { net = false; o.push = false; }
  flStore(o);
  const msgs = [];
  if (why === 'denied') msgs.push('🔕 اجازه‌ی اعلان داده نشد. برای اعلان روی صفحه: تنظیمات گوشی ← برنامه‌ها ← مرورگر (یا همیار کاروان) ← اعلان‌ها ← روشن؛ سپس دوباره همین دکمه را بزنید.');
  if (why === 'ios') msgs.push('📲 روی آیفون، اول برنامه را روی صفحه‌ی اصلی نصب کنید (دکمه‌ی اشتراک ← Add to Home Screen) و از همان آیکون باز کنید و دوباره این دکمه را بزنید.');
  if (why === 'old' || why === 'push') msgs.push('این مرورگر اعلان پس‌زمینه را پشتیبانی نکرد. برنامه را با Chrome باز کنید یا هشدار بله را روشن کنید.');
  if (!net) msgs.push('📶 اتصال به سرور برقرار نشد؛ اعلان و پیام بله فعلاً روشن نیست. وقتی اینترنت وصل شد دوباره همین دکمه را بزنید.');
  if (f.bale && net && !o.baleOk) msgs.push('📩 هنوز عضو بازوی بله نشده‌اید؛ برای پیام بله، از منوی «بیشتر» ← «اطلاعیه‌ها در بله» عضو شوید و دوباره همین دکمه را بزنید.');
  flMsg = msgs.join('<br>');
  flRender();
  if (!msgs.length || o.push) showToast('✅ هشدارهای روز بازگشت روشن شد');
  if (typeof renderHome === 'function') try { renderHome(); } catch (e) {}
}
/* ── تقویم خود گوشی (بدون اینترنت): هر هشدار یک رویداد کوتاه با زنگ سر همان لحظه ── */
const flUid = k => `flight-${k}@iraq-guide`;
function flIcsText(steps, cancel) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//iraq-guide//flight//FA', 'CALSCALE:GREGORIAN', cancel ? 'METHOD:CANCEL' : 'METHOD:PUBLISH'], seq = Math.floor(Date.now() / 1000);
  steps.forEach(s => {
    L.push('BEGIN:VEVENT', `UID:${flUid(s.k)}`, `DTSTAMP:${icsTime(Date.now())}`, `SEQUENCE:${seq}`, `DTSTART:${icsTime(s.t)}`, `DTEND:${icsTime(s.t + 10 * 6e4)}`, `SUMMARY:${icsEsc(s.title)}`);
    if (cancel) L.push('STATUS:CANCELLED');
    else L.push(`DESCRIPTION:${icsEsc(s.body + '\n— همیار کاروان')}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(s.title)}`, 'TRIGGER:PT0M', 'END:VALARM');
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n') + '\r\n';
}
function flIcs() {
  const f = flForm, c = flCalc(f); if (!c) return;
  const steps = flSteps(c).filter(s => s.t > Date.now() + 30e3);
  if (!steps.length) return showToast('زمان حرکت گذشته است');
  let o = flLoad();
  if (!flSame(o, f)) o = { city: c.city, air: c.air, day: c.day, h: c.h, m: c.m, fl: c.fl, dep: c.dep, steps, bale: false, push: false, baleOk: false, shown: [] };
  /* رویدادهای پرواز قبلی که در این فایل نیستند، با فایل لغو جدا پاک می‌شوند؛ هم‌نام‌ها خودشان جایگزین می‌شوند */
  o.ics = true; o.icsSteps = steps.map(s => ({ k: s.k, t: s.t, title: s.title }));
  flStore(o);
  remDownload(flIcsText(steps), 'هشدار حرکت به فرودگاه.ics');
  showToast(remIsIos() ? 'در پنجره باز شده «Add All» را بزنید' : 'فایل هشدارها دانلود شد — آن را باز کنید و در تقویم «ذخیره» را بزنید', 9000);
  flRender();
  if (typeof renderHome === 'function') try { renderHome(); } catch (e) {}
}
async function flOff() {
  const old = flLoad();
  if (old && old.ics && old.icsSteps && old.icsSteps.length && confirm('هشدارها از تقویم گوشی هم پاک شود؟ (یک فایل لغو دانلود می‌شود)')) {
    remDownload(flIcsText(old.icsSteps, true), 'لغو هشدار پرواز.ics');
    showToast(remIsIos() ? 'در پنجره باز شده تأیید کنید تا از تقویم حذف شود' : 'فایل لغو دانلود شد — بازش کنید تا از تقویم حذف شود. اگر حذف نشد، رویدادها را در تقویم لمس کنید و «حذف» را بزنید', 9000);
  }
  flStore(null); flMsg = '';
  try { await rvFetch('/flight/del', {}); } catch (e) {}
  if (!(old && old.ics)) showToast('هشدارهای پرواز خاموش شد');
  flRender();
}

/* ── صفحه‌ی اول: زیرنویس آیکون و نوار هشدار ── */
function flightSub() { const o = flLoad(); return o && o.dep > Date.now() - 36e5 ? 'خروج ' + flRelDay(o.dep) : ''; }
function flightAlertHTML() {
  const o = flLoad(); if (!o) return '';
  const left = o.dep - Date.now();
  if (left > 36 * 36e5 || left < -36e5) return '';
  const msg = left > 0 ? `✈️ خروج از هتل به سمت ${FL_AIR[o.air]}: <b>${flRelDay(o.dep)} ساعت ${flHM(o.dep)}</b> — ${flLeft(o.dep)}` : '<b>🚌 زمان حرکت به فرودگاه رسیده است.</b>';
  return `<button class="stay-alert ${left < 3 * 36e5 ? 'bad' : ''}" onclick="openFlight()">${ico('plane')}<span>${msg}</span></button>`;
}

/* ── وقتی برنامه باز است: هشدار داخل برنامه (و اعلان، اگر اجازه هست) ── */
function flTick() {
  const o = flLoad(); if (!o || !o.steps) return;
  const now = Date.now(), due = o.steps.filter(s => s.t <= now && now - s.t < 40 * 6e4 && !(o.shown || []).includes(s.k));
  if (!due.length) return;
  const s = due[due.length - 1];
  o.shown = [...(o.shown || []), ...due.map(x => x.k)]; flStore(o);
  showToast(`${s.title} — ${s.body}`, 15000);
  try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 600]); } catch (e) {}
  if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker)
    navigator.serviceWorker.ready.then(reg => reg.showNotification(s.title, { body: s.body, icon: 'app-icon-192.png', badge: 'app-icon-192.png', lang: 'fa', dir: 'rtl', tag: 'flight-' + s.k, requireInteraction: true })).catch(() => {});
}
setInterval(flTick, 20000);
setTimeout(flTick, 2500);
/* باز شدن از روی اعلان */
try { navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', e => { if (e.data === 'open-flight') openFlight(); }); } catch (e) {}
setTimeout(() => { if (/[#?&]flight\b/.test(location.hash + location.search)) { try { history.replaceState(null, '', location.pathname); } catch (e) {} openFlight(); } }, 900);
