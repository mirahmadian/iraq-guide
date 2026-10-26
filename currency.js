/* ══════════════════════════════════════════
   CURRENCY — مبدل دینار عراق ↔ تومان ↔ دلار
   نرخ خودکار: rate.json (هر ۳ ساعت با GitHub Actions از tgju.org — .github/workflows/rate.yml)
   نرخ بازار عراق: rate-market.json (ثبت‌کننده نرخ از صفحه nerkh.html می‌فرستد) — تا ۳۶ ساعت بعد از ثبت معتبر است.
   اولویت: نرخ دستی مدیر (site.rate.manual = تومان برای هر ۱۰۰۰ دینار) ← نرخ بازار عراق ← tgju.
   آخرین نرخ روی گوشی هم ذخیره می‌شود تا بدون اینترنت کار کند.
══════════════════════════════════════════ */
(function injectCurrencyCSS() {
  const css = `
  .cx-rate{padding:14px 16px;border-radius:16px;background:var(--gold-dim);border:1px solid var(--gold);font-size:calc(14px * var(--fs,1));line-height:1.9;color:var(--text)}
  .cx-rate b{font-size:calc(18px * var(--fs,1));font-weight:900;color:var(--pri-ink)}
  .cx-rate small{display:block;font-size:calc(12px * var(--fs,1));color:var(--muted)}
  .cx-box{margin-top:12px;padding:14px;border-radius:16px;background:var(--card);border:1px solid var(--border-s)}
  .cx-box label{display:flex;justify-content:space-between;font-size:calc(13px * var(--fs,1));font-weight:800;color:var(--brass);margin:10px 0 4px}
  .cx-box label:first-child{margin-top:0}
  .cx-box input{width:100%;min-height:54px;padding:0 14px;border-radius:12px;border:1px solid var(--border-s);background:var(--card2);color:var(--text);box-sizing:border-box;
    font-family:var(--font);font-size:calc(22px * var(--fs,1));font-weight:900;text-align:left;direction:ltr}
  .cx-box input:focus{outline:2px solid var(--gold);border-color:var(--gold)}
  .cx-notes{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
  .cx-notes button{padding:10px 8px;border-radius:12px;border:1px solid var(--border-s);background:var(--card);color:var(--text);cursor:pointer;font-family:var(--font);text-align:center;line-height:1.7}
  .cx-notes b{display:block;font-size:calc(15px * var(--fs,1));font-weight:900}
  .cx-notes span{font-size:calc(12.5px * var(--fs,1));color:var(--pri-ink);font-weight:800}
  .cx-note{font-size:calc(12px * var(--fs,1));color:var(--dim);line-height:1.9;margin:12px 4px 0}
  `;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');
})();

const CX_KEY = 'caravan-rate', CX_MKEY = 'caravan-rate-market', CX_MARKET_TTL = 36 * 36e5;
const CX_NOTES = [250, 500, 1000, 5000, 10000, 25000, 50000];
let cxAuto = null, cxMarket = null;
try { cxAuto = JSON.parse(localStorage.getItem(CX_KEY) || 'null'); cxMarket = JSON.parse(localStorage.getItem(CX_MKEY) || 'null'); } catch (e) {}

function cxLoad() {
  const m = fetch('rate-market.json?t=' + Date.now(), { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(j => {
    if (j && j.ts) { cxMarket = j; try { localStorage.setItem(CX_MKEY, JSON.stringify(j)); } catch (e) {} }
  }).catch(() => {});
  return Promise.all([m, fetch('rate.json?t=' + Math.floor(Date.now() / 6e5), { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(j => {
    if (j && j.iqd_rial > 0) { cxAuto = j; try { localStorage.setItem(CX_KEY, JSON.stringify(j)); } catch (e) {} }
  }).catch(() => {})]);
}
cxLoad();

/* تومان برای ۱ دینار، تومان برای ۱ دلار، توضیح منبع */
function cxRate() {
  const m = +(((CARAVAN_DATA.site || {}).rate || {}).manual) || 0;
  const usd = cxAuto && cxAuto.usd_rial ? cxAuto.usd_rial / 10 : 0;
  if (m > 0) return { iqd: m / 1000, usd, src: 'نرخ اعلام‌شده ستاد' };
  const k = cxMarket;
  if (k && k.ts && Date.now() - k.ts < CX_MARKET_TTL) {
    const iqd = k.toman_per_1000_iqd ? k.toman_per_1000_iqd / 1000 : k.toman_per_usd && k.iqd_per_usd ? k.toman_per_usd / k.iqd_per_usd : 0;
    if (iqd > 0) {
      const mu = k.toman_per_usd || (k.iqd_per_usd ? k.iqd_per_usd * iqd : 0) || usd;
      const ni = iraqNow(new Date(k.ts)), today = iraqNow().d === ni.d;
      return { iqd, usd: mu, src: `نرخ بازار عراق، ثبت‌شده ${today ? 'امروز' : 'دیروز'} ساعت ${faDigits(prayerHM(ni.min))}` };
    }
  }
  if (cxAuto && cxAuto.iqd_rial > 0) return { iqd: cxAuto.iqd_rial / 10, usd, src: 'نرخ بازار آزاد' + (cxAuto.date_fa ? '، ' + cxAuto.date_fa : '') + ' (tgju.org)' };
  return null;
}
const cxFa = (n, dec = 0) => (+n || 0).toLocaleString('fa', { maximumFractionDigits: dec });
const cxNum = s => +toEnDigits(String(s)).replace(/[^\d.]/g, '') || 0;
const cxRound = t => t >= 1e5 ? Math.round(t / 100) * 100 : t >= 1000 ? Math.round(t / 10) * 10 : Math.round(t);

function openCurrency() {
  const r = cxRate();
  if (!r) {
    openPage('💱 تبدیل ارز', '<div class="sr-empty">نرخ ارز هنوز دریافت نشده است. یک بار با اینترنت برنامه را باز کنید.</div>');
    cxLoad().then(() => cxRate() && openCurrency());
    return;
  }
  openPage('💱 تبدیل دینار و تومان', `
    <div class="cx-rate">هر ۱٬۰۰۰ دینار عراق ≈ <b>${cxFa(cxRound(r.iqd * 1000))} تومان</b>
      ${r.usd ? `<small>هر ۱ دلار ≈ ${cxFa(cxRound(r.usd))} تومان ≈ ${cxFa(Math.round(r.usd / r.iqd))} دینار</small>` : ''}
      <small>${escHtml(r.src)}</small></div>
    <div class="cx-box">
      <label for="cxD"><span>${flagSVG('iq', 13)} دینار عراق</span></label><input id="cxD" inputmode="decimal" autocomplete="off" placeholder="۰" oninput="cxIn('D')">
      <label for="cxT"><span>${flagSVG('ir', 13)} تومان ایران</span></label><input id="cxT" inputmode="decimal" autocomplete="off" placeholder="۰" oninput="cxIn('T')">
      ${r.usd ? `<label for="cxU"><span>${flagSVG('us', 13)} دلار آمریکا</span></label><input id="cxU" inputmode="decimal" autocomplete="off" placeholder="۰" oninput="cxIn('U')">` : ''}
    </div>
    <div class="sec-lbl">اسکناس‌های عراق به تومان</div>
    <div class="cx-notes">${CX_NOTES.map(d => `<button onclick="cxSet(${d})"><b>${cxFa(d)} دینار</b><span>≈ ${cxFa(cxRound(d * r.iqd))} تومان</span></button>`).join('')}</div>
    <p class="cx-note">این نرخ تقریبی است. صرافی‌ها و فروشنده‌ها معمولاً کمی متفاوت حساب می‌کنند. بدون اینترنت، آخرین نرخ دریافت‌شده استفاده می‌شود.</p>`);
}
function cxIn(src) {
  const r = cxRate(), el = id => document.getElementById('cx' + id);
  if (!r) return;
  const v = cxNum(el(src).value);
  const toman = src === 'D' ? v * r.iqd : src === 'T' ? v : v * r.usd;
  const vals = { D: Math.round(toman / r.iqd), T: cxRound(toman), U: r.usd ? Math.round(toman / r.usd * 100) / 100 : 0 };
  ['D', 'T', 'U'].forEach(k => { if (k !== src && el(k)) el(k).value = v ? cxFa(vals[k], k === 'U' ? 2 : 0) : ''; });
  /* عدد تایپ‌شده هم با جداکننده هزارگان نوشته شود */
  const raw = toEnDigits(el(src).value).replace(/[^\d.]/g, '');
  if (raw && !raw.endsWith('.')) el(src).value = cxFa(+raw, src === 'U' ? 2 : 0);
}
function cxSet(d) {
  const el = document.getElementById('cxD');
  el.value = cxFa(d); cxIn('D');
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
