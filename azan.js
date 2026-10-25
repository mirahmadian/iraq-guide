/* ══════════════════════════════════════════
   AZAN — کارت اوقات شرعی در صفحه اول و صفحه جدول کامل
   محاسبه در prayer.js؛ تنظیم دقیقه‌ای مدیر (تب بعثه ← ساعت اذان) هم اعمال می‌شود.
══════════════════════════════════════════ */
(function injectAzanCSS() {
  const css = `
  .azan-strip{display:block;width:100%;margin:12px 0 0;padding:12px 14px;border-radius:18px;cursor:pointer;text-align:right;font-family:var(--font);color:var(--text);
    background:var(--card);border:1px solid var(--border-s);box-shadow:0 2px 10px rgba(0,0,0,.04)}
  .az-top{display:flex;align-items:center;gap:10px}
  .az-ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;flex-shrink:0;background:rgba(var(--rgb-ziyarat),.12);color:var(--i-ziyarat);font-size:20px}
  .az-next{flex:1;min-width:0}
  .az-next b{display:block;font-size:calc(15px * var(--fs,1));font-weight:900;line-height:1.5}
  .az-next small{display:block;font-size:calc(12.5px * var(--fs,1));color:var(--brass);font-weight:800}
  .az-more{display:flex;align-items:center;gap:2px;flex-shrink:0;font-size:calc(11.5px * var(--fs,1));font-weight:800;color:var(--pri-ink)}
  .az-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}
  .az-row span{border-radius:10px;background:var(--card2);padding:5px 2px;text-align:center;font-size:calc(11px * var(--fs,1));color:var(--muted);font-weight:700;line-height:1.6}
  .az-row span b{display:block;font-size:calc(14px * var(--fs,1));color:var(--text);font-weight:900}
  .az-row span.on{background:var(--gold);color:#fff}
  .az-row span.on b{color:#fff}
  .az-tbl{background:var(--card);border:1px solid var(--border-s);border-radius:16px;overflow:hidden}
  .az-tbl div{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;font-size:calc(15px * var(--fs,1));font-weight:800}
  .az-tbl div + div{border-top:1px solid var(--border)}
  .az-tbl div b{font-size:calc(18px * var(--fs,1));font-weight:900;direction:ltr}
  .az-tbl div.sub{color:var(--muted);font-weight:700}
  .az-tbl div.sub b{font-size:calc(16px * var(--fs,1));font-weight:800}
  .az-tbl div.on{background:var(--gold-dim);color:var(--pri-ink)}
  .az-note{font-size:calc(12px * var(--fs,1));color:var(--dim);line-height:1.9;margin:12px 4px 0}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

const AZAN_ROWS = [['fajr', 'اذان صبح'], ['sunrise', 'طلوع آفتاب', 1], ['dhuhr', 'اذان ظهر'], ['sunset', 'غروب آفتاب', 1], ['maghrib', 'اذان مغرب'], ['midnight', 'نیمه‌شب شرعی', 1]];
const AZAN_MAIN = ['fajr', 'dhuhr', 'maghrib'];

function azanVisible() { return ((CARAVAN_DATA.site || {}).layout || {}).prayer !== false; }
function azanTimes(cityId, ni) { return prayerTimes(cityId, ni.y, ni.mo, ni.d, (((typeof besat === 'function' && besat()) || {}).adjust || {})[cityId]); }
function azanFa(m) { return prayerHM(m).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }
function azanLeft(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (min < 1) return 'هم‌اکنون';
  return (h ? h.toLocaleString('fa') + ' ساعت' + (m ? ' و ' : '') : '') + (m ? m.toLocaleString('fa') + ' دقیقه' : '') + ' دیگر';
}
/* اذان بعدی (صبح/ظهر/مغرب)؛ بعد از مغرب، اذان صبح فردا */
function azanNext(cityId, now = new Date()) {
  const ni = iraqNow(now), t = azanTimes(cityId, ni);
  for (const k of AZAN_MAIN) if (t[k] >= ni.min) return { k, at: t[k], left: t[k] - ni.min, tomorrow: false };
  const tn = azanTimes(cityId, iraqNow(new Date(now.getTime() + 864e5)));
  return { k: 'fajr', at: tn.fajr, left: tn.fajr + 1440 - ni.min, tomorrow: true };
}

function azanStripHTML(c) {
  if (!azanVisible() || !PRAYER_COORDS[c.id]) return '';
  const ni = iraqNow(), t = azanTimes(c.id, ni), n = azanNext(c.id);
  const label = AZAN_ROWS.find(r => r[0] === n.k)[1];
  const cells = [['fajr', 'صبح'], ['dhuhr', 'ظهر'], ['maghrib', 'مغرب'], ['midnight', 'نیمه‌شب']];
  return `<button class="azan-strip" data-city="${c.id}" onclick="openAzan()" aria-label="اوقات شرعی ${escHtml(c.name)}">
    <span class="az-top">
      <span class="az-ic" aria-hidden="true">🕌</span>
      <span class="az-next"><small>${n.left <= 0 ? 'وقت' : 'تا'} ${label}${n.tomorrow ? ' فردا' : ''} · ساعت ${azanFa(n.at)}</small><b>${azanLeft(n.left)}</b></span>
      <span class="az-more">اوقات شرعی${CHEV_FWD}</span>
    </span>
    <span class="az-row">${cells.map(([k, l]) => `<span class="${k === n.k && !n.tomorrow ? 'on' : ''}">${l}<b>${azanFa(t[k])}</b></span>`).join('')}</span>
  </button>`;
}

function openAzan() {
  const c = homeCity();
  if (!c) return;
  const now = new Date(), ni = iraqNow(now), t = azanTimes(c.id, ni), n = azanNext(c.id, now);
  const tm = azanTimes(c.id, iraqNow(new Date(now.getTime() + 864e5)));
  const tbl = (tt, hi) => `<div class="az-tbl">${AZAN_ROWS.map(([k, l, sub]) =>
    `<div class="${sub ? 'sub' : ''} ${hi && k === n.k ? 'on' : ''}"><span>${l}</span><b>${azanFa(tt[k])}</b></div>`).join('')}</div>`;
  openPage('🕌 اوقات شرعی ' + c.name, `
    <div class="sec-lbl">امروز</div>${tbl(t, !n.tomorrow)}
    <div class="sec-lbl">فردا</div>${tbl(tm, false)}
    <p class="az-note">همه ساعت‌ها <b>به وقت عراق</b> است (نیم ساعت عقب‌تر از ساعت ایران). محاسبه به روش مؤسسه ژئوفیزیک دانشگاه تهران و بدون اینترنت انجام می‌شود؛ ممکن است با اذان حرم یکی دو دقیقه فرق داشته باشد.</p>`);
}

/* هر ۳۰ ثانیه شمارش معکوس به‌روز شود */
setInterval(() => {
  document.querySelectorAll('.azan-strip').forEach(el => {
    const c = CARAVAN_DATA.cities.find(x => x.id === el.dataset.city);
    if (c) el.outerHTML = azanStripHTML(c) || '<span></span>';
  });
}, 30000);
