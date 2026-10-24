/* ══════════════════════════════════════════
   PRAYER TIMES — وقت عراق و اوقات شرعی (مشترک بین برنامه و پنل ادمین)
══════════════════════════════════════════ */
/* همه ساعت‌ها به وقت عراق حساب می‌شوند، حتی اگر ساعت گوشی روی وقت ایران مانده باشد */
const IRAQ_TZ = 3;
function iraqNow(d = new Date()) {
  const t = new Date(d.getTime() + IRAQ_TZ * 3600e3);
  return { day: t.getUTCDay(), min: t.getUTCHours() * 60 + t.getUTCMinutes(), y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: t.getUTCDate() };
}

/* اوقات شرعی به روش مؤسسه ژئوفیزیک دانشگاه تهران (فجر ۱۷٫۷ درجه، مغرب ۴٫۵ درجه زیر افق)
   — همان روش «باد صبا» و بیشتر برنامه‌های ایرانی؛ بدون اینترنت محاسبه می‌شود
   خروجی: دقیقه از نیمه‌شب به وقت عراق. adjust = تنظیم دستی مدیر به دقیقه، مثل { fajr: 2, maghrib: -1 } */
const PRAYER_COORDS = { najaf: [31.996, 44.3148], karbala: [32.6165, 44.0325], kadhimiya: [33.3798, 44.3379], samarra: [34.1987, 43.8738] };
const prayerCache = {};
function prayerTimes(cityId, y, mo, d, adjust) {
  const key = [cityId, y, mo, d].join('-');
  const r = prayerCache[key] || (prayerCache[key] = prayerRaw(cityId, y, mo, d));
  const a = adjust || {};
  return { fajr: r.fajr + (+a.fajr || 0), sunrise: r.sunrise, dhuhr: r.dhuhr + (+a.dhuhr || 0), maghrib: r.maghrib + (+a.maghrib || 0) };
}
function prayerRaw(cityId, y, mo, d) {
  const [lat, lng] = PRAYER_COORDS[cityId] || PRAYER_COORDS.najaf;
  const rad = Math.PI / 180, sin = x => Math.sin(x * rad), cos = x => Math.cos(x * rad);
  const fixH = h => ((h % 24) + 24) % 24;
  const jd0 = Date.UTC(y, mo, d) / 864e5 + 2440587.5 - lng / 360;
  const sun = jd => {
    const D = jd - 2451545, g = (357.529 + 0.98560028 * D) % 360, q = (280.459 + 0.98564736 * D) % 360;
    const L = (q + 1.915 * sin(g) + 0.020 * sin(2 * g)) % 360, e = 23.439 - 0.00000036 * D;
    const RA = Math.atan2(cos(e) * sin(L), cos(L)) / rad / 15;
    return { decl: Math.asin(sin(e) * sin(L)) / rad, eqt: q / 15 - fixH(RA) };
  };
  const mid = t => fixH(12 - sun(jd0 + t).eqt);
  const angleTime = (angle, t, before) => {
    const { decl } = sun(jd0 + t);
    const v = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
    const T = Math.acos(Math.max(-1, Math.min(1, v))) / rad / 15;
    return mid(t) + (before ? -T : T);
  };
  const toMin = h => Math.round((h + IRAQ_TZ - lng / 15) * 60);
  return {
    fajr: toMin(angleTime(17.7, 5 / 24, true)), sunrise: toMin(angleTime(0.833, 6 / 24, true)),
    dhuhr: toMin(mid(12 / 24)), maghrib: toMin(angleTime(4.5, 18 / 24, false))
  };
}
const prayerHM = m => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
