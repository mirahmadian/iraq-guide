/* ══════════════════════════════════════════
   ZYARAT — زیارت‌نامه هر مکان (متن عربی + ترجمه فارسی)
   CARAVAN_DATA.zyarat = { note, places:[{ id, city, name, lat, lng, r(متر), hidden, items:[{ title, rows:[{a, f} | {n}] }] }] }
   a = متن عربی، f = ترجمه، n = توضیح. مکان‌ها و متن‌ها از پنل مدیریت ← تب زیارت‌نامه‌ها.
   اگر زائر نزدیک یکی از مکان‌ها باشد، بالای صفحه اول کارت «شما در … هستید» نمایش داده می‌شود.
   موقعیت فقط روی خود گوشی بررسی می‌شود و جایی فرستاده نمی‌شود.
══════════════════════════════════════════ */
const ZY_FA_KEY = 'caravan-zy-fa';
let zyHere = null, zyLast = null, zyTimer = null;

function zyData() { return CARAVAN_DATA.zyarat || {}; }
function zyPlaces() { return (zyData().places || []).filter(p => (!p.hidden || SHOW_HIDDEN) && (p.items || []).some(i => (i.rows || []).length)); }
function zyVisible() { return zyPlaces().length > 0; }
function zyPlace(id) { return zyPlaces().find(p => p.id === id); }

/* فاصله به متر */
function zyDist(lat1, lng1, lat2, lng2) {
  const dy = (lat2 - lat1) * 111320, dx = (lng2 - lng1) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.hypot(dx, dy);
}
/* نزدیک‌ترین مکانی که زائر داخل محدوده‌اش است (با کمی چشم‌پوشی از خطای GPS) */
function zyNearest(lat, lng, acc) {
  let best = null, bd = Infinity;
  zyPlaces().forEach(p => {
    if (p.lat == null || p.lng == null) return;
    const d = zyDist(lat, lng, +p.lat, +p.lng);
    if (d <= (+p.r || 250) + Math.min(acc || 0, 120) && d < bd) { bd = d; best = p; }
  });
  return best;
}
function zyLocate(ask) {
  if (!navigator.geolocation || !zyVisible()) return;
  const go = () => navigator.geolocation.getCurrentPosition(pos => {
    zyLast = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, at: Date.now() };
    const p = zyNearest(zyLast.lat, zyLast.lng, zyLast.acc), id = p ? p.id : null;
    if (id !== zyHere) { zyHere = id; zyStripRefresh(); }
    if (ask) { const v = document.getElementById('zyList'); if (v) v.outerHTML = zyListHTML(); }
  }, () => { if (ask) showToast('موقعیت پیدا نشد — مکان‌یاب (GPS) گوشی را روشن کنید'); },
  { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  if (ask || !navigator.permissions || !navigator.permissions.query) return go();
  navigator.permissions.query({ name: 'geolocation' }).then(r => { if (r.state !== 'denied') go(); }, go);
}
/* هر ۲ دقیقه وقتی برنامه باز است دوباره بررسی شود */
function zyWatch() {
  clearInterval(zyTimer);
  if (!zyVisible()) return;
  zyLocate(false);
  zyTimer = setInterval(() => { if (!document.hidden) zyLocate(false); }, 120000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && zyLast && Date.now() - zyLast.at > 90000) zyLocate(false); });

/* ── کارت صفحه اول ── */
function zyStripHTML() {
  const p = zyHere && zyPlace(zyHere);
  if (!p) return '<div id="zyStrip"></div>';
  return `<div id="zyStrip" class="zy-strip">
    <span class="zy-sic">${ico('mosque')}</span>
    <div class="zy-sb"><small>شما در ${escHtml(p.name)} هستید</small>
      <div class="zy-sbtn">${p.items.filter(i => (i.rows || []).length).map((it, k) => `<button onclick="openZyItem('${escHtml(p.id)}',${p.items.indexOf(it)})">${ico('quran')}${escHtml(it.title)}</button>`).join('')}</div></div>
  </div>`;
}
function zyStripRefresh() { const el = document.getElementById('zyStrip'); if (el) el.outerHTML = zyStripHTML(); }

/* ── فهرست همه مکان‌ها ── */
function zyListHTML() {
  const c = typeof homeCity === 'function' ? homeCity() : null, cities = CARAVAN_DATA.cities;
  const order = [c && c.id, ...cities.map(x => x.id)].filter((v, i, a) => v && a.indexOf(v) === i);
  const groups = order.map(cid => [cid, zyPlaces().filter(p => p.city === cid)]).concat([['', zyPlaces().filter(p => !cities.some(x => x.id === p.city))]]).filter(g => g[1].length);
  const dist = p => zyLast && p.lat != null ? zyDist(zyLast.lat, zyLast.lng, +p.lat, +p.lng) : null;
  const fmtD = d => d < 1000 ? faDigits(Math.round(d / 10) * 10) + ' متر' : faDigits((d / 1000).toFixed(d < 10000 ? 1 : 0)) + ' کیلومتر';
  return `<div id="zyList">${groups.map(([cid, ps]) => {
    const cn = (cities.find(x => x.id === cid) || {}).name || 'سایر';
    return `<div class="sec-lbl">${escHtml(cn)}</div>${ps.map(p => {
      const d = dist(p), here = p.id === zyHere;
      return `<div class="zy-pl ${here ? 'here' : ''}">
        <div class="zy-plh"><span class="zy-plic">${ico('mosque')}</span><b>${escHtml(p.name)}</b>
          ${here ? '<span class="zy-here">شما اینجا هستید</span>' : d != null ? `<small>${fmtD(d)}</small>` : ''}${p.hidden ? '<span class="zy-hid">پنهان از کاربران</span>' : ''}</div>
        ${p.items.map((it, k) => (it.rows || []).length ? `<button class="zy-it" onclick="openZyItem('${escHtml(p.id)}',${k})">${ico('quran')}<span>${escHtml(it.title)}</span>${CHEV_FWD}</button>` : '').join('')}
      </div>`;
    }).join('')}`;
  }).join('')}
  <button class="zy-loc" onclick="zyLocate(true)">${ico('navigation')} پیدا کردن مکان من</button>
  <p class="zy-note">وقتی نزدیک یکی از این مکان‌ها باشید، زیارت‌نامه‌اش بالای صفحه اول نمایش داده می‌شود. موقعیت شما فقط روی گوشی خودتان بررسی می‌شود.</p></div>`;
}
function openZyarat() {
  if (typeof closeMore === 'function') closeMore();
  openPage('زیارت‌نامه‌ها', zyListHTML());
  if (!zyLast || Date.now() - zyLast.at > 60000) zyLocate(false);
}

/* ── متن زیارت‌نامه ── */
function zyFaOn() { try { return localStorage.getItem(ZY_FA_KEY) !== '0'; } catch (e) { return true; } }
function zyToggleFa() {
  const on = !zyFaOn();
  try { localStorage.setItem(ZY_FA_KEY, on ? '1' : '0'); } catch (e) {}
  const b = document.getElementById('zyText');
  if (b) b.classList.toggle('nofa', !on);
  const t = document.getElementById('zyFaBtn');
  if (t) t.classList.toggle('on', on);
}
function openZyItem(pid, k) {
  const p = (zyData().places || []).find(x => x.id === pid), it = p && p.items[k];
  if (!it) return;
  const note = zyData().note;
  openPage(it.title, `
    <div class="zy-bar"><span>${ico('mosque')}${escHtml(p.name)}</span>
      <button id="zyFaBtn" class="${zyFaOn() ? 'on' : ''}" onclick="zyToggleFa()" aria-label="نمایش ترجمه فارسی">ترجمه فارسی</button></div>
    <div id="zyText" class="zy-text ${zyFaOn() ? '' : 'nofa'}">${(it.rows || []).map(r => r.n
      ? `<p class="zy-n">${escHtml(r.n)}</p>`
      : `<div class="zy-r"><p class="zy-a" lang="ar">${escHtml(r.a || '')}</p>${r.f ? `<p class="zy-f">${escHtml(r.f)}</p>` : ''}</div>`).join('')}</div>
    ${note ? `<p class="zy-note">${escHtml(note)}</p>` : ''}`);
}

(function injectZyCSS() {
  document.head.insertAdjacentHTML('beforeend', `<style>
  .zy-strip{display:flex;gap:12px;align-items:flex-start;margin-top:12px;padding:12px 14px;border-radius:var(--r);background:var(--card);border:1px solid var(--brass-l)}
  .zy-sic{width:44px;height:44px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--i-ziyarat);
    background:rgba(var(--rgb-ziyarat),.12);box-shadow:0 0 0 2px var(--card),0 0 0 3px var(--brass-l)}
  .zy-sic .ico{width:24px;height:24px}
  .zy-sb{flex:1;min-width:0}
  .zy-sb small{display:block;font-size:calc(13px * var(--fs,1));font-weight:800;color:var(--brass);line-height:1.6}
  .zy-sbtn{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
  .zy-sbtn button{display:inline-flex;align-items:center;gap:6px;min-height:42px;padding:0 14px;border-radius:12px;border:none;cursor:pointer;
    background:var(--gold);color:#fff;font-family:var(--font);font-size:calc(13.5px * var(--fs,1));font-weight:800}
  .zy-sbtn .ico{width:18px;height:18px}
  .zy-pl{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:10px 12px;margin-bottom:10px}
  .zy-pl.here{border-color:var(--brass-l);box-shadow:0 0 0 1px var(--brass-l)}
  .zy-plh{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:2px 0 6px}
  .zy-plh b{font-size:calc(15px * var(--fs,1));font-weight:900;flex:1}
  .zy-plh small{font-size:calc(12px * var(--fs,1));color:var(--dim);font-weight:700}
  .zy-plic{width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;color:var(--i-ziyarat);background:rgba(var(--rgb-ziyarat),.12)}
  .zy-plic .ico{width:20px;height:20px}
  .zy-here{font-size:calc(11.5px * var(--fs,1));font-weight:800;color:#fff;background:var(--gold);border-radius:100px;padding:0 10px}
  .zy-hid{font-size:calc(11px * var(--fs,1));font-weight:800;color:var(--c-clinic)}
  .zy-it{display:flex;align-items:center;gap:10px;width:100%;min-height:50px;padding:0 4px;border:none;border-top:1px solid var(--border);background:none;cursor:pointer;
    font-family:var(--font);font-size:calc(14px * var(--fs,1));font-weight:800;color:var(--text);text-align:right}
  .zy-it span{flex:1}
  .zy-it .ico{width:20px;height:20px;color:var(--brass)}
  .zy-it .chev{width:16px;height:16px;color:var(--dim)}
  .zy-loc{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:50px;margin-top:6px;border-radius:14px;border:1px solid var(--border-s);background:var(--card);cursor:pointer;
    font-family:var(--font);font-size:calc(14px * var(--fs,1));font-weight:800;color:var(--pri-ink)}
  .zy-loc .ico{width:20px;height:20px}
  .zy-note{font-size:calc(12px * var(--fs,1));color:var(--dim);line-height:1.9;margin:12px 4px 0}
  .zy-bar{position:sticky;top:62px;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-14px -14px 12px;padding:8px 14px;
    background:var(--bg);border-bottom:1px solid var(--border);font-size:calc(13px * var(--fs,1));font-weight:800;color:var(--muted)}
  .zy-bar span{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .zy-bar .ico{width:18px;height:18px;color:var(--brass)}
  .zy-bar button{flex-shrink:0;min-height:38px;padding:0 14px;border-radius:100px;border:1px solid var(--border-s);background:var(--card);color:var(--muted);cursor:pointer;
    font-family:var(--font);font-size:calc(12.5px * var(--fs,1));font-weight:800}
  .zy-bar button.on{background:var(--gold);border-color:var(--gold);color:#fff}
  .zy-text{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:6px 16px}
  .zy-r{padding:14px 0;border-bottom:1px solid var(--border)}
  .zy-r:last-child{border-bottom:none}
  .zy-a{font-size:calc(21px * var(--fs,1));line-height:2.25;font-weight:600;color:var(--text);text-align:justify}
  .zy-f{font-size:calc(14px * var(--fs,1));line-height:2;color:var(--muted);margin-top:6px}
  .zy-text.nofa .zy-f{display:none}
  .zy-n{font-size:calc(13.5px * var(--fs,1));line-height:2;color:var(--brass);background:rgba(201,162,75,.10);border-radius:12px;padding:10px 12px;margin:12px 0}
  </style>`);
})();
