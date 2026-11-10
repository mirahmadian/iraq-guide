/* ══════════════════════════════════════════
   📅 تقویم شمسی (Jalali date picker) — مشترک بین اپ، پنل مدیریت و سامانه‌ی نواقص
   جمعه‌ها قرمز، امروز با حلقه، روز انتخاب‌شده پررنگ؛ ماه و سال با زدن عنوان انتخاب می‌شود.
   ۱) هر <input data-jdp> با لمس، تقویم را باز می‌کند و مقدار «۱۴۰۵/۰۸/۱۵» (رقم فارسی) را می‌نویسد
      و رویدادهای input و change را می‌فرستد (کدهای قبلی بدون تغییر کار می‌کنند).
      ویژگی‌های اختیاری: data-jdp-min / data-jdp-max (مثل 1405/08/01)، data-jdp-clear (دکمه‌ی پاک کردن)
   ۲) JDP.open({ value, min, max, title, clear, onPick(jdn|null) }) برای جاهایی که به‌جای input دکمه دارند.
   تاریخ داخلی = شماره‌ی روز ژولینی (jdn)؛ JDP.num('1405/08/15') ⇄ JDP.str(jdn)؛ JDP.today() به وقت ایران/عراق.
══════════════════════════════════════════ */
const JDP = (() => {
  const div = (a, b) => ~~(a / b), mod = (a, b) => a - ~~(a / b) * b;
  const BR = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function cal(jy) {
    let gy = jy + 621, leapJ = -14, jp = BR[0], jm, jump = 0, n, i;
    for (i = 1; i < BR.length; i++) { jm = BR[i]; jump = jm - jp; if (jy < jm) break; leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm; }
    n = jy - jp; leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4;
    return { gy, march: 20 + leapJ - leapG, leap };
  }
  const g2d = (gy, gm, gd) => { const d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408; return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752; };
  const d2g = jdn => { let j = 4 * jdn + 139361631; j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908; const i = div(mod(j, 1461), 4) * 5 + 308, gd = div(mod(i, 153), 5) + 1, gm = mod(div(i, 153), 12) + 1; return { gy: div(j, 1461) - 100100 + div(8 - gm, 6), gm, gd }; };
  const j2d = (jy, jm, jd) => { const r = cal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; };
  const d2j = jdn => { const g = d2g(jdn); let jy = g.gy - 621; const r = cal(jy); let k = jdn - g2d(g.gy, 3, r.march);
    if (k >= 0) { if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }; k -= 186; } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; }
    return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 }; };
  const mlen = (jy, jm) => jm <= 6 ? 31 : jm <= 11 ? 30 : (j2d(jy + 1, 1, 1) - j2d(jy, 12, 1));
  const fa = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const en = s => String(s || '').replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
  const p2 = n => String(n).padStart(2, '0');
  const num = s => { const m = en(s).match(/^\s*(1[34]\d\d)\D(\d{1,2})\D(\d{1,2})\s*$/); if (!m) return null; const y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > mlen(y, mo)) return null; return j2d(y, mo, d); };
  const str = (d, faDigits = true) => { const j = d2j(d), s = `${j.jy}/${p2(j.jm)}/${p2(j.jd)}`; return faDigits ? fa(s) : s; };
  /* امروز به وقت ایران (+۳:۳۰)؛ اختلاف با عراق فقط نیم‌ساعتِ بعد از نیمه‌شب است */
  const today = () => Math.floor((Date.now() + 3.5 * 36e5) / 864e5) + 2440588;
  const fromDate = dt => g2d(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  const toDate = d => { const g = d2g(d); return new Date(g.gy, g.gm - 1, g.gd); };
  const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const WD = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  /* jdn ← ستون هفته (شنبه = ۰ … جمعه = ۶) */
  const wcol = d => mod(d + 2, 7);
  const long = d => { const j = d2j(d); return `${['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'][wcol(d)]} ${fa(j.jd)} ${MONTHS[j.jm - 1]} ${fa(j.jy)}`; };

  /* فلش‌ها SVG هستند تا در صفحه‌ی راست‌به‌چپ وارونه نشوند (نویسه‌های ‹ › خودکار آینه می‌شوند و رو به داخل می‌افتند).
     قبلی (راست) فلش رو به راست، بعدی (چپ) فلش رو به چپ: هر دو رو به بیرون */
  const arr = d => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const ARR_R = arr('M9 5l7 7-7 7'), ARR_L = arr('M15 5l-7 7 7 7');
  let st = null;
  function render() {
    const box = document.getElementById('jdpBox'); if (!box || !st) return;
    const { y, m, mode } = st, t = today();
    let body;
    if (mode === 'months') {
      body = `<div class="jdp-ms">${MONTHS.map((n, i) => `<button type="button" data-m="${i + 1}" class="${i + 1 === m ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    } else {
      const first = j2d(y, m, 1), n = mlen(y, m), pad = wcol(first);
      let cells = '';
      for (let i = 0; i < pad; i++) cells += '<span></span>';
      for (let d = 1; d <= n; d++) {
        const jd = first + d - 1, off = (st.min != null && jd < st.min) || (st.max != null && jd > st.max);
        cells += `<button type="button" data-d="${jd}" class="${wcol(jd) === 6 ? 'fri ' : ''}${jd === t ? 'today ' : ''}${jd === st.val ? 'on' : ''}" ${off ? 'disabled' : ''}>${fa(d)}</button>`;
      }
      body = `<div class="jdp-wd">${WD.map((w, i) => `<span class="${i === 6 ? 'fri' : ''}">${w}</span>`).join('')}</div><div class="jdp-grid">${cells}</div>`;
    }
    box.innerHTML = `<div class="jdp-h">${st.title ? `<div class="jdp-t">${st.title}</div>` : ''}
        <div class="jdp-sel">${st.val != null ? long(st.val) : 'تاریخی انتخاب نشده'}</div></div>
      <div class="jdp-nav"><button type="button" data-a="${mode === 'months' ? 'py' : 'pm'}" aria-label="${mode === 'months' ? 'سال قبل' : 'ماه قبل'}">${ARR_R}</button>
        <button type="button" class="jdp-mt" data-a="mode">${mode === 'months' ? 'سال ' + fa(y) : MONTHS[m - 1] + ' ' + fa(y)} <small>${mode === 'months' ? '▴' : '▾'}</small></button>
        <button type="button" data-a="${mode === 'months' ? 'ny' : 'nm'}" aria-label="${mode === 'months' ? 'سال بعد' : 'ماه بعد'}">${ARR_L}</button></div>
      ${body}
      <div class="jdp-f"><button type="button" data-a="today" ${(st.min != null && t < st.min) || (st.max != null && t > st.max) ? 'disabled' : ''}>امروز</button>
        ${st.clear ? '<button type="button" data-a="clear">پاک کردن</button>' : ''}<button type="button" data-a="close">بستن</button></div>`;
  }
  function onClick(e) {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (b.dataset.d) return pick(+b.dataset.d);
    if (b.dataset.m) { st.m = +b.dataset.m; st.mode = 'days'; return render(); }
    if (a === 'pm' || a === 'nm') { st.m += a === 'pm' ? -1 : 1; if (st.m < 1) { st.m = 12; st.y--; } if (st.m > 12) { st.m = 1; st.y++; } return render(); }
    if (a === 'py' || a === 'ny') { st.y += a === 'py' ? -1 : 1; return render(); }
    if (a === 'mode') { st.mode = st.mode === 'months' ? 'days' : 'months'; return render(); }
    if (a === 'today') return pick(today());
    if (a === 'clear') return pick(null);
    if (a === 'close') return close();
  }
  function pick(d) { const cb = st.onPick; close(); cb && cb(d); }
  function close() { const o = document.getElementById('jdpOv'); if (o) o.remove(); document.removeEventListener('keydown', onKey); st = null; }
  const onKey = e => { if (e.key === 'Escape') close(); };
  function open(o) {
    close();
    const v = typeof o.value === 'string' ? num(o.value) : o.value;
    const base = v != null ? v : Math.min(Math.max(today(), o.min ?? -Infinity), o.max ?? Infinity), j = d2j(base);
    st = { y: j.jy, m: j.jm, val: v, min: o.min ?? null, max: o.max ?? null, title: o.title || '', clear: !!o.clear, onPick: o.onPick, mode: 'days' };
    document.body.insertAdjacentHTML('beforeend', `<div class="jdp-ov" id="jdpOv" role="dialog" aria-modal="true" aria-label="انتخاب تاریخ"><div class="jdp" id="jdpBox" dir="rtl"></div></div>`);
    const ov = document.getElementById('jdpOv');
    ov.addEventListener('click', e => { if (e.target === ov) close(); else onClick(e); });
    document.addEventListener('keydown', onKey);
    render();
  }
  /* هر input[data-jdp] */
  const bound = el => {
    const lim = k => { const s = el.getAttribute(k); return s ? num(s) : null; };
    open({ value: el.value, min: lim('data-jdp-min'), max: lim('data-jdp-max'), clear: el.hasAttribute('data-jdp-clear'), title: el.getAttribute('data-jdp-title') || el.getAttribute('placeholder') || '',
      onPick: d => { el.value = d == null ? '' : str(d); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } });
  };
  document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('input[data-jdp]'); if (el && !el.disabled) { e.preventDefault(); el.blur(); bound(el); } });
  /* گوشی: کیبورد باز نشود؛ کامپیوتر: تایپ هم ممکن است (Enter / فاصله = تقویم) */
  const touch = matchMedia('(pointer:coarse)').matches;
  const prep = root => (root.querySelectorAll ? root.querySelectorAll('input[data-jdp]:not([data-jdp-ok])') : []).forEach(el => {
    el.setAttribute('data-jdp-ok', ''); el.setAttribute('autocomplete', 'off'); if (touch) el.setAttribute('inputmode', 'none'); el.classList.add('jdp-in');
  });
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && (n.matches && n.matches('input[data-jdp]') ? prep(n.parentNode || n) : prep(n))))).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('keydown', e => { const el = e.target; if (el && el.matches && el.matches('input[data-jdp]') && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) { e.preventDefault(); bound(el); } });
  document.addEventListener('DOMContentLoaded', () => prep(document));

  document.head.insertAdjacentHTML('beforeend', `<style>
    .jdp-ov{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;animation:jdpF .15s}
    @keyframes jdpF{from{opacity:0}}
    .jdp{width:100%;max-width:340px;background:var(--card,#fff);color:var(--text,var(--ink,#222));border-radius:20px;box-shadow:0 12px 40px rgba(0,0,0,.3);padding:14px;font-family:var(--font,Vazirmatn,Tahoma,sans-serif);user-select:none;animation:jdpU .18s ease-out}
    @keyframes jdpU{from{transform:translateY(12px) scale(.98);opacity:0}}
    .jdp button{font-family:inherit;color:inherit;cursor:pointer}
    .jdp-h{text-align:center;padding:2px 4px 10px;border-bottom:1px solid var(--border-s,var(--line,#eee));margin-bottom:8px}
    .jdp-t{font-size:12px;color:var(--muted,#777);margin-bottom:2px}.jdp-sel{font-weight:900;font-size:15px;color:var(--pri-ink,var(--pri,#0E5A44))}
    .jdp-nav{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px}
    .jdp-nav>button:not(.jdp-mt) svg{display:block;margin:auto}
    .jdp-nav>button:not(.jdp-mt),.jdp-yr button{width:38px;height:38px;border-radius:12px;border:1px solid var(--border-s,var(--line,#e5e5e5));background:var(--card2,#f6f6f6);font-size:20px;line-height:1}
    .jdp-mt{flex:1;border:0;background:none;font-weight:900;font-size:16px;padding:8px;border-radius:12px}.jdp-mt:hover{background:var(--card2,#f3f3f3)}.jdp-mt small{font-size:11px;color:var(--muted,#888)}
    .jdp-wd,.jdp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center}
    .jdp-wd span{font-size:12px;font-weight:800;color:var(--muted,#888);padding:6px 0}
    .jdp-grid button,.jdp-grid span{aspect-ratio:1;border-radius:50%;border:0;background:none;font-size:14.5px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0}
    .jdp-grid button:hover:not(:disabled){background:var(--card2,#f1f1f1)}
    .jdp .fri{color:var(--bad,var(--red,#D32F2F))!important}
    .jdp-grid button.today{box-shadow:inset 0 0 0 2px var(--pri,#0E5A44)}
    .jdp-grid button.on{background:var(--pri,#0E5A44)!important;color:#fff!important;box-shadow:none}
    .jdp-grid button:disabled{opacity:.25;cursor:default}
    .jdp-yr{display:flex;align-items:center;justify-content:space-between;margin:4px 0 10px}.jdp-yr b{font-size:18px}
    .jdp-ms{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
    .jdp-ms button{padding:12px 4px;border-radius:12px;border:1px solid var(--border-s,var(--line,#e5e5e5));background:var(--card2,#f7f7f7);font-weight:800;font-size:13.5px}
    .jdp-ms button.on{background:var(--pri,#0E5A44);color:#fff;border-color:transparent}
    .jdp-f{display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border-s,var(--line,#eee))}
    .jdp-f button{flex:1;padding:10px;border-radius:12px;border:1px solid var(--border-s,var(--line,#e5e5e5));background:var(--card2,#f6f6f6);font-weight:800;font-size:13.5px}
    .jdp-f button:first-child{background:var(--pri,#0E5A44);color:#fff;border-color:transparent}.jdp-f button:disabled{opacity:.4}
    .jdp-btn{display:flex;align-items:center;width:100%;min-height:48px;padding:10px 14px 10px 40px;border-radius:12px;border:1px solid var(--border-s,var(--line,#ddd));background-color:var(--card,#fff);color:var(--text,var(--ink,#222));font-family:var(--font,inherit);font-weight:800;font-size:calc(14.5px * var(--fs,1));text-align:right;cursor:pointer;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%230E5A44' stroke-width='2' stroke-linecap='round'%3E%3Crect x='3' y='5' width='18' height='16' rx='2'/%3E%3Cpath d='M3 10h18M8 3v4M16 3v4'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:left 12px center}
    input.jdp-in{cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round'%3E%3Crect x='3' y='5' width='18' height='16' rx='2'/%3E%3Cpath d='M3 10h18M8 3v4M16 3v4'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:left 10px center;padding-left:34px!important}
  </style>`);
  return { open, close, num, str, today, long, fromDate, toDate, fa, MONTHS };
})();
