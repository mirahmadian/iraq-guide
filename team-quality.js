'use strict';
/* «⭐ کیفیت هتل‌ها»: نمره‌ی هتل‌ها، شرکت‌های سیاحه و نقل از روی گزارش مدیران ثابت (محاسبه در worker/team-api: qualityOf)
   مشترک بین پنل مدیر منطقه و مدیر سامانه. renderQuality(el, data, { onWeek, weeks, week, showRegion }) */
const QL = [[85, 'عالی', 'q-a'], [70, 'قابل قبول', 'q-b'], [50, 'نیاز به توجه', 'q-c'], [0, 'ضعیف', 'q-d']];
const qLevel = s => s == null ? null : QL.find(l => s >= l[0]);
const qBadge = (s, low) => { const l = qLevel(s); return l ? `<span class="q-badge ${l[2]}${low ? ' low' : ''}" title="${l[1]}${low ? ' — داده کم' : ''}">${faS(Math.round(s))}</span>` : '<span class="dim">—</span>'; };
const qCell = s => { const l = qLevel(s); return l ? `<td class="q-cell ${l[2]}" title="${l[1]}">${faS(Math.round(s))}</td>` : '<td class="q-cell q-na">—</td>'; };
const qFix = (d, f) => d ? `${faS(Math.round(f / d * 100))}٪ <span class="dim">(${fa(f)} از ${fa(d)})</span>` : '<span class="dim">نقصی نبود</span>';
const LOW_H = 2, LOW_C = 3;   /* کمتر از این تعداد گزارش = «داده کم» */

function renderQuality(el, d, o = {}) {
  const H = [...d.hotels].sort((a, b) => (a.n < LOW_H) - (b.n < LOW_H) || a.score - b.score);
  const cnt = QL.map(l => H.filter(h => h.n >= LOW_H && qLevel(h.score) === l).length);
  const C = [...d.companies].sort((a, b) => (a.n < LOW_C) - (b.n < LOW_C) || a.score - b.score);
  const T = [...d.transport].sort((a, b) => (a.n < LOW_C) - (b.n < LOW_C) || a.score - b.score);
  const trend = h => h.prev == null ? '' : h.score - h.prev >= 3 ? `<span class="q-up" title="هفته‌ی قبل: ${faS(Math.round(h.prev))}">▲ ${faS(Math.round(h.score - h.prev))}</span>` : h.prev - h.score >= 3 ? `<span class="q-down" title="هفته‌ی قبل: ${faS(Math.round(h.prev))}">▼ ${faS(Math.round(h.prev - h.score))}</span>` : `<span class="dim" title="هفته‌ی قبل: ${faS(Math.round(h.prev))}">＝</span>`;
  el.innerHTML = `
  <div class="card"><div class="card-h"><h2>⭐ کیفیت هتل‌ها</h2>
    ${o.weeks ? `<select class="sel" id="q-week" aria-label="دوره">${o.weeks.map(w => `<option value="${w.id}" ${String(w.id) === String(o.week) ? 'selected' : ''}>${esc(w.title)}</option>`).join('')}<option value="all" ${o.week === 'all' ? 'selected' : ''}>همه‌ی هفته‌ها روی هم</option></select>` : ''}</div>
    ${!H.length ? '<div class="empty">برای این دوره هنوز گزارشی ثبت نشده است.</div>' : `
    <div class="q-sum"><div><b class="num">${d.avg == null ? '—' : faS(Math.round(d.avg))}</b><span>میانگین نمره‌ی هتل‌ها</span></div>
      ${QL.map((l, i) => `<div class="${l[2]}"><b class="num">${fa(cnt[i])}</b><span>${l[1]}</span></div>`).join('')}</div>
    <p class="hint">مرتب از ضعیف‌ترین به بهترین. رنگ هر خانه وضع هتل در آن بخش است. ${d.prevTitle ? `▲▼ تغییر نسبت به «${esc(d.prevTitle)}».` : ''} هتلی که کمتر از ${fa(LOW_H)} گزارش دارد کم‌رنگ و پایین فهرست است (داده کم).</p>
    <div class="tbl-wrap"><table class="q-tbl"><thead><tr><th>هتل</th>${o.showRegion ? '<th>منطقه</th>' : ''}<th>نمره</th>${d.sections.map(s => `<th class="q-sec">${esc(s)}</th>`).join('')}<th>گزارش</th><th>رفع نقص</th><th>شرکت سیاحه</th></tr></thead><tbody>
    ${H.map(h => `<tr class="${h.n < LOW_H ? 'q-low' : ''}"><td><b>${esc(h.name)}</b> ${trend(h)}</td>${o.showRegion ? `<td class="dim">${esc(h.region)}</td>` : ''}<td>${qBadge(h.score, h.n < LOW_H)}</td>
      ${d.sections.map(s => qCell(h.secs[s])).join('')}<td class="num">${fa(h.n)}${h.n < LOW_H ? ' <span class="dim">(داده کم)</span>' : ''}</td><td>${qFix(h.defects, h.fixed)}</td><td class="dim" style="font-size:12px">${esc(h.companies.map(shortCo).join('، '))}</td></tr>`).join('')}
    </tbody></table></div>`}
    <div class="q-legend">${QL.map(l => `<span><i class="${l[2]}"></i>${l[1]} ${l[0] ? `(${faS(l[0])} به بالا)` : `(زیر ${faS(50)})`}</span>`).join('')}</div>
  </div>

  ${C.length ? `<div class="card"><div class="card-h"><h2>🏢 شرکت‌های سیاحه — کیفیت هتل‌های طرف قرارداد</h2></div>
    <p class="hint">این نمره <b>عملکرد مستقیم شرکت نیست</b>؛ میانگین کیفیت هتل‌هایی است که کاروان‌های این شرکت در آن‌ها بوده‌اند. فقط گزارش کاروان‌های خود همین شرکت حساب می‌شود و هر هتل یک سهم دارد (هتل پرگزارش وزن بیشتری ندارد).
      «رفع نقص» نشان می‌دهد چند درصد از نقص‌های گزارش‌شده برطرف شده است. شرکتی که کمتر از ${fa(LOW_C)} گزارش دارد رتبه‌بندی نمی‌شود.</p>
    <div class="q-comp">${C.map(c => { const low = c.n < LOW_C, l = qLevel(c.score); return `<details class="q-co ${low ? 'q-low' : ''}"><summary>
      <span class="q-co-n"><b>${esc(shortCo(c.name))}</b><span class="dim">${fa(c.hotels.length)} هتل · ${fa(c.n)} گزارش${low ? ' · داده کم' : ''}</span></span>
      <span class="q-bar"><i class="${l ? l[2] : ''}" style="width:${Math.max(4, c.score)}%"></i></span>${qBadge(c.score, low)}</summary>
      <div class="q-co-b"><div>رفع نقص: ${qFix(c.defects, c.fixed)}</div>${d.avg != null ? `<div>نسبت به میانگین همه‌ی هتل‌ها (${faS(Math.round(d.avg))}): <b>${c.score >= d.avg ? 'بالاتر' : 'پایین‌تر'}</b></div>` : ''}
        ${c.hotels.map(h => `<div class="q-co-h">${qBadge(h.score, h.n < LOW_H)} ${esc(h.name)}${o.showRegion ? ` <span class="dim">(${esc(h.region)})</span>` : ''} <span class="dim">· ${fa(h.n)} گزارش</span></div>`).join('')}</div></details>`; }).join('')}</div></div>` : ''}

  ${T.length ? `<div class="card"><div class="card-h"><h2>🚌 نقل (اتوبوس) — به تفکیک شرکت</h2></div>
    <p class="hint">جدا از نمره‌ی هتل؛ از سؤال‌های بخش نقل گزارش‌ها. شرکت نقلِ هر کاروان معمولاً همان شرکت سیاحه است.</p>
    <div class="q-comp">${T.map(t => { const low = t.n < LOW_C, l = qLevel(t.score); return `<div class="q-co ${low ? 'q-low' : ''}"><div class="q-sumrow">
      <span class="q-co-n"><b>${esc(shortCo(t.name))}</b><span class="dim">${fa(t.n)} گزارش${low ? ' · داده کم' : ''} · رفع نقص: ${qFix(t.defects, t.fixed)}</span></span>
      <span class="q-bar"><i class="${l ? l[2] : ''}" style="width:${Math.max(4, t.score)}%"></i></span>${qBadge(t.score, low)}</div></div>`; }).join('')}</div></div>` : ''}

  <details class="card q-how"><summary><b>نمره چطور حساب می‌شود؟</b></summary>
    <p>هر پاسخ مدیر ثابت نمره دارد: عالی ۱۰۰، خوب ۸۰، متوسط ۵۰، ضعیف ۲۰. در سؤال‌های بله/خیر پاسخ درست ۱۰۰ و پاسخ نقص صفر است؛ در پاسخ‌های آماده، گزینه‌ی سالم ۱۰۰ و گزینه‌های نقص بین ۴۰ تا ۱۰ (هرچه شدیدتر، کمتر). «موضوعیت ندارد» حساب نمی‌شود.</p>
    <p>نمره‌ی هر گزارش میانگین پاسخ‌های آن است و نمره‌ی هتل میانگین گزارش‌هایش. پاسخ‌های بخش «نقل» در نمره‌ی هتل نیست و جدا برای شرکت‌ها حساب می‌شود.</p>
    <p>این نمره‌ها فقط برای مدیران است و در برنامه‌ی زائران نمایش داده نمی‌شود.</p></details>`;
  const ws = el.querySelector('#q-week'); if (ws && o.onWeek) ws.onchange = () => o.onWeek(ws.value);
}

(function () {
  const st = document.createElement('style');
  st.textContent = `
  .q-a{--q:#1E7D4F;--qb:#E3F4EA}.q-b{--q:#8A6D0B;--qb:#FBF3D6}.q-c{--q:#B25B12;--qb:#FCE9D9}.q-d{--q:#B3261E;--qb:#FBE3E1}
  :root[data-theme="dark"] .q-a{--q:#7FD3A4;--qb:#173326}:root[data-theme="dark"] .q-b{--q:#E6C65C;--qb:#352C10}:root[data-theme="dark"] .q-c{--q:#F0A868;--qb:#3A2414}:root[data-theme="dark"] .q-d{--q:#F28B82;--qb:#3B1A18}
  .q-badge{display:inline-grid;place-items:center;min-width:38px;height:28px;padding:0 6px;border-radius:9px;font-weight:800;color:var(--q);background:var(--qb);border:1px solid color-mix(in srgb,var(--q) 35%,transparent)}
  .q-badge.low{opacity:.55;border-style:dashed}
  .q-cell{text-align:center;font-weight:700;color:var(--q);background:var(--qb)}
  .q-na{color:var(--muted,#999)}
  .q-sec{font-size:12px;text-align:center;white-space:normal;min-width:70px}
  .q-low{opacity:.6}
  .q-up{color:#1E7D4F;font-size:12px;font-weight:700}.q-down{color:#B3261E;font-size:12px;font-weight:700}
  .q-sum{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
  .q-sum>div{padding:10px;border-radius:12px;background:var(--qb,var(--pri-soft,#f3efe6));text-align:center;display:flex;flex-direction:column;gap:2px}
  .q-sum b{font-size:22px;color:var(--q,inherit)}.q-sum span{font-size:12px}
  @media (max-width:560px){.q-sum{grid-template-columns:repeat(3,1fr)}.q-sum>div:first-child{grid-column:1/-1}}
  .q-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;margin-top:6px}.q-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;background:var(--qb);border:1px solid var(--q);margin-left:4px;vertical-align:-2px}
  .q-comp{display:grid;gap:8px}
  .q-co{border:1px solid var(--border,#e5dccb);border-radius:12px;padding:8px 10px}
  .q-co summary,.q-sumrow{display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none}
  .q-co summary::-webkit-details-marker{display:none}
  .q-co-n{flex:1 1 40%;display:flex;flex-direction:column;min-width:0}.q-co-n .dim{font-size:12px}
  .q-bar{flex:1 1 40%;height:10px;border-radius:6px;background:color-mix(in srgb,currentColor 8%,transparent);overflow:hidden}.q-bar i{display:block;height:100%;background:var(--q,#999);border-radius:6px}
  .q-co-b{padding:8px 4px 2px;font-size:13px;display:grid;gap:6px}.q-co-h{display:flex;align-items:center;gap:6px}
  .q-how p{font-size:13px;line-height:1.9;margin:6px 0 0}`;
  document.head.appendChild(st);
})();
