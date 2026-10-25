/* ══════════════════════════════════════════
   TODAY — نوار بالای صفحه اول: هوای شهر + ساعت عراق و ایران
   هوا از Open-Meteo (رایگان، بدون کلید)؛ هر ۳۰ دقیقه، و آخرین نتیجه برای حالت بدون اینترنت ذخیره می‌شود.
   ساعت‌ها بدون اینترنت حساب می‌شوند (عراق UTC+3، ایران UTC+3:30 — هیچ‌کدام ساعت تابستانی ندارند).
══════════════════════════════════════════ */
(function injectTodayCSS() {
  const css = `
  .today-bar{display:flex;align-items:center;gap:10px;width:100%;margin-top:10px;padding:9px 14px;border-radius:14px;cursor:pointer;text-align:right;font-family:var(--font);
    background:var(--card);border:1px solid var(--border-s);color:var(--text);font-size:calc(13.5px * var(--fs,1));font-weight:800}
  .today-bar.hot{background:rgba(199,119,0,.12);border-color:#C77700}
  .today-bar.dust{background:rgba(140,100,24,.12);border-color:var(--brass)}
  .tb-w{display:flex;align-items:center;gap:6px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tb-w .ic{font-size:20px}
  .tb-w b{font-size:calc(16px * var(--fs,1));font-weight:900}
  .tb-w small{font-size:calc(12px * var(--fs,1));color:var(--muted);font-weight:700;overflow:hidden;text-overflow:ellipsis}
  .tb-c{display:flex;gap:10px;flex-shrink:0;font-size:calc(13px * var(--fs,1))}
  .tb-c span{white-space:nowrap}
  .tb-c b{font-weight:900;direction:ltr;display:inline-block}
  .tb-alert{display:block;width:100%;font-size:calc(12.5px * var(--fs,1));color:#9A5C00;margin-top:2px}
  [data-theme="dark"] .tb-alert{color:#F0B04A}
  .tw-now{display:flex;align-items:center;gap:14px;padding:16px;border-radius:18px;background:var(--card);border:1px solid var(--border-s)}
  .tw-now .ic{font-size:52px;line-height:1}
  .tw-now b{display:block;font-size:calc(34px * var(--fs,1));font-weight:900;line-height:1.2}
  .tw-now small{display:block;font-size:calc(13px * var(--fs,1));color:var(--muted);font-weight:700;line-height:1.8}
  .tw-days{background:var(--card);border:1px solid var(--border-s);border-radius:16px;overflow:hidden}
  .tw-days div{display:flex;align-items:center;gap:10px;padding:12px 16px;font-size:calc(14.5px * var(--fs,1));font-weight:800}
  .tw-days div + div{border-top:1px solid var(--border)}
  .tw-days .d{flex:1}
  .tw-days .ic{font-size:22px}
  .tw-days .t{direction:ltr;min-width:84px;text-align:left}
  .tw-days .t small{color:var(--muted);font-weight:700}
  .tw-clock{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .tw-clock div{padding:14px;border-radius:16px;background:var(--card);border:1px solid var(--border-s);text-align:center;font-weight:800;font-size:calc(13px * var(--fs,1));color:var(--muted)}
  .tw-clock b{display:block;font-size:calc(28px * var(--fs,1));font-weight:900;color:var(--text);direction:ltr}
  .tw-warn{margin-top:12px;padding:12px 14px;border-radius:14px;background:rgba(199,119,0,.12);border:1px solid #C77700;font-size:calc(13.5px * var(--fs,1));line-height:2}
  .tw-note{font-size:calc(12px * var(--fs,1));color:var(--dim);line-height:1.9;margin:12px 4px 0}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

const TW_KEY = 'caravan-weather', TW_TTL = 30 * 60000, TW_HOT = 45, TW_DUST = 150;
let twCache = {};
try { twCache = JSON.parse(localStorage.getItem(TW_KEY) || '{}'); } catch (e) {}

function todayVisible() { return ((CARAVAN_DATA.site || {}).layout || {}).infobar !== false; }

/* کد وضعیت هوای WMO ← شکلک و نام فارسی */
function twCode(c, day = true) {
  if (c === 0) return [day ? '☀️' : '🌙', 'صاف'];
  if (c === 1) return [day ? '🌤️' : '🌙', 'کمی ابری'];
  if (c === 2) return ['⛅', 'نیمه‌ابری'];
  if (c === 3) return ['☁️', 'ابری'];
  if (c === 45 || c === 48) return ['🌫️', 'مه'];
  if (c >= 51 && c <= 57) return ['🌦️', 'نم‌نم باران'];
  if (c >= 61 && c <= 67) return ['🌧️', 'باران'];
  if (c >= 71 && c <= 77 || c === 85 || c === 86) return ['❄️', 'برف'];
  if (c >= 80 && c <= 82) return ['🌦️', 'رگبار'];
  if (c >= 95) return ['⛈️', 'رعدوبرق'];
  return ['🌡️', ''];
}

/* ساعت به وقت یک منطقه (دقیقه اختلاف با UTC) */
function twClock(offsetMin, now = new Date()) {
  const t = new Date(now.getTime() + offsetMin * 60000);
  return faDigits(String(t.getUTCHours()).padStart(2, '0') + ':' + String(t.getUTCMinutes()).padStart(2, '0'));
}
const twIraq = now => twClock(180, now), twIran = now => twClock(210, now);

function twLoad(cityId, force) {
  const p = PRAYER_COORDS[cityId], c = twCache[cityId];
  if (!p || !navigator.onLine && !force) return Promise.resolve(c);
  if (c && Date.now() - c.at < TW_TTL && !force) return Promise.resolve(c);
  const q = `latitude=${p[0]}&longitude=${p[1]}&timezone=Asia%2FBaghdad`;
  const w = fetch(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=3`).then(r => r.ok ? r.json() : null);
  const a = fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=dust`).then(r => r.ok ? r.json() : null).catch(() => null);
  return Promise.all([w, a]).then(([j, aq]) => {
    if (!j || !j.current) return c;
    const cur = j.current, d = j.daily;
    const out = { at: Date.now(), t: cur.temperature_2m, feel: cur.apparent_temperature, hum: cur.relative_humidity_2m, wind: cur.wind_speed_10m,
      code: cur.weather_code, day: cur.is_day !== 0, dust: aq && aq.current ? aq.current.dust : null,
      days: (d.time || []).map((t, i) => ({ date: t, code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i] })) };
    twCache[cityId] = out;
    try { localStorage.setItem(TW_KEY, JSON.stringify(twCache)); } catch (e) {}
    return out;
  }).catch(() => c);
}

function twAlert(w) {
  if (!w) return '';
  const max = Math.max(w.t, (w.days[0] || {}).max || -99);
  if (max >= TW_HOT) return ['hot', `⚠️ گرمای شدید (تا ${faDigits(Math.round(max))}°) — از ساعت ۱۲ تا ۱۶ بیرون نروید و آب همراه داشته باشید`];
  if (w.dust != null && w.dust >= TW_DUST) return ['dust', '🌪️ گردوغبار — ماسک بزنید؛ بیماران تنفسی کمتر بیرون بروند'];
  return '';
}

function todayBarHTML(c) {
  if (!todayVisible()) return '';
  const w = twCache[c.id], [ic] = w ? twCode(w.code, w.day) : ['🌡️'], al = twAlert(w);
  return `<button class="today-bar ${al ? al[0] : ''}" id="todayBar" data-city="${c.id}" onclick="openToday()" aria-label="هوا و ساعت">
    <span style="flex:1;min-width:0">
      <span style="display:flex;align-items:center;gap:10px">
        <span class="tb-w"><span class="ic" aria-hidden="true">${ic}</span>${w ? `<b>${faDigits(Math.round(w.t))}°</b>` : ''}<small>${escHtml(c.name)}</small></span>
        <span class="tb-c"><span>🇮🇶 <b>${twIraq()}</b></span><span>🇮🇷 <b>${twIran()}</b></span></span>
      </span>
      ${al ? `<span class="tb-alert">${al[1]}</span>` : ''}
    </span>
  </button>`;
}
function todayRefresh() {
  const el = document.getElementById('todayBar');
  if (!el) return;
  const c = CARAVAN_DATA.cities.find(x => x.id === el.dataset.city);
  if (c) el.outerHTML = todayBarHTML(c);
}
/* بعد از هر رندر صفحه اول، هوای شهر انتخاب‌شده (در صورت نیاز) گرفته می‌شود */
function todayFetch(c) { if (c && todayVisible()) twLoad(c.id).then(todayRefresh); }
setInterval(todayRefresh, 30000);

const TW_WD = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
function openToday() {
  const c = homeCity();
  if (!c) return;
  const render = w => {
    const al = twAlert(w), [ic, label] = w ? twCode(w.code, w.day) : ['🌡️', ''];
    const ago = w ? Math.round((Date.now() - w.at) / 60000) : 0;
    const body = `
      <div class="tw-clock"><div>🇮🇶 ساعت عراق<b>${twIraq()}</b></div><div>🇮🇷 ساعت ایران<b>${twIran()}</b></div></div>
      <p class="tw-note" style="margin-top:6px;text-align:center">ساعت ایران <b>۳۰ دقیقه جلوتر</b> از عراق است. برنامه‌ها، اذان و حرکت‌ها در عراق به وقت عراق است.</p>
      <div class="sec-lbl">هوای ${escHtml(c.name)}</div>
      ${w ? `<div class="tw-now"><span class="ic" aria-hidden="true">${ic}</span><span><b>${faDigits(Math.round(w.t))}°</b>
        <small>${label}${w.feel != null ? ` · دمای احساسی ${faDigits(Math.round(w.feel))}°` : ''}</small>
        <small>رطوبت ${faDigits(Math.round(w.hum || 0))}٪ · باد ${faDigits(Math.round(w.wind || 0))} کیلومتر بر ساعت</small></span></div>
      ${al ? `<div class="tw-warn">${al[1]}${al[0] === 'hot' ? '<br>• آب زیاد بنوشید، حتی اگر تشنه نیستید<br>• کلاه یا چتر داشته باشید<br>• اگر سردرد، سرگیجه یا تهوع داشتید، فوراً به سایه بروید و به درمانگاه خبر دهید' : ''}</div>` : ''}
      <div class="sec-lbl">۳ روز آینده</div>
      <div class="tw-days">${w.days.map((d, i) => {
        const [di, dl] = twCode(d.code), wd = TW_WD[new Date(d.date + 'T12:00:00Z').getUTCDay()];
        return `<div><span class="d">${i === 0 ? 'امروز' : i === 1 ? 'فردا' : wd}</span><span class="ic" aria-hidden="true">${di}</span><span style="font-size:calc(12.5px * var(--fs,1));color:var(--muted)">${dl}</span>
          <span class="t">${faDigits(Math.round(d.max))}° <small>/ ${faDigits(Math.round(d.min))}°</small></span></div>`;
      }).join('')}</div>
      <p class="tw-note">منبع: Open-Meteo · به‌روزرسانی ${ago < 2 ? 'همین الان' : faDigits(ago) + ' دقیقه پیش'}${navigator.onLine ? '' : ' (بدون اینترنت — آخرین وضعیت دریافت‌شده)'}</p>`
      : `<div class="sr-empty">${navigator.onLine ? '⏳ در حال دریافت وضعیت هوا…' : 'برای دیدن وضعیت هوا، یک بار با اینترنت برنامه را باز کنید.'}</div>`}`;
    openPage('🌤️ هوا و ساعت — ' + c.name, body);
  };
  render(twCache[c.id]);
  twLoad(c.id).then(w => { if (w && document.getElementById('pvTitle')?.textContent.includes(c.name)) render(w); todayRefresh(); });
}
