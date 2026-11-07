'use strict';
/* «⭐ کیفیت هتل‌ها»: نمره‌ی هتل‌ها، شرکت‌های سیاحه و نقل از روی گزارش مدیران ثابت (محاسبه در worker/team-api: qualityOf)
   مشترک بین پنل مدیر منطقه و مدیر سامانه. renderQuality(el, data, { onWeek, weeks, week, showRegion }) */
const QL = [[85, 'عالی', 'q-a'], [70, 'قابل قبول', 'q-b'], [50, 'نیاز به توجه', 'q-c'], [0, 'ضعیف', 'q-d']];
/* مقیاس نمایش: ۱۰۰ (پیش‌فرض) یا ۵ سطحی (۱ تا ۵ با یک رقم اعشار)؛ انتخاب هر کاربر در همان مرورگر می‌ماند. محاسبه همیشه روی ۱۰۰ است. */
let Q_SCALE = (() => { try { return localStorage.getItem('q-scale') === '5' ? 5 : 100; } catch (e) { return 100; } })();
const q5 = s => (Math.round((1 + s * 0.04) * 10) / 10).toFixed(1);
const qN = s => Q_SCALE === 5 ? faS(q5(s)).replace('.', '٫') : faS(Math.round(s));
const qD = x => Q_SCALE === 5 ? faS((Math.round(x * 0.4) / 10).toFixed(1)).replace('.', '٫') : faS(Math.round(x));
const qLevel = s => s == null ? null : QL.find(l => s >= l[0]);
const qBadge = (s, low) => { const l = qLevel(s); return l ? `<span class="q-badge ${l[2]}${low ? ' low' : ''}" title="${l[1]}${low ? ' — داده کم' : ''}">${qN(s)}</span>` : '<span class="dim">—</span>'; };
const qCell = s => { const l = qLevel(s); return l ? `<td class="q-cell ${l[2]}" title="${l[1]}">${qN(s)}</td>` : '<td class="q-cell q-na">—</td>'; };
const qFix = (d, f) => d ? `${faS(Math.round(f / d * 100))}٪ <span class="dim">(${fa(f)} از ${fa(d)})</span>` : '<span class="dim">نقصی نبود</span>';
const LOW_H = 2, LOW_C = 3;   /* کمتر از این تعداد گزارش = «داده کم» */

/* مرتب‌سازی جدول با زدن روی عنوان ستون (بار اول کم به زیاد، بار دوم برعکس)؛ خانه‌های خالی همیشه آخر */
const Q_SORT = {
  name: h => h.name, region: h => h.region, score: h => h.score, rr: h => h.rr ? h.rr.stars : null, n: h => h.n,
  fix: h => h.defects ? h.fixed / h.defects : null, co: h => h.companies.map(shortCo).join('، ') || null
};
function qSortVal(h, k) { return k.startsWith('sec:') ? h.secs[k.slice(4)] ?? null : Q_SORT[k](h); }
function qSorted(list, s) {
  if (!s) return [...list].sort((a, b) => (a.n < LOW_H) - (b.n < LOW_H) || (a.score ?? 1e9) - (b.score ?? 1e9));
  return [...list].sort((a, b) => {
    const x = qSortVal(a, s.k), y = qSortVal(b, s.k);
    if (x == null || y == null) return (x == null) - (y == null);
    return (typeof x === 'string' ? x.localeCompare(y, 'fa') : x - y) * s.dir;
  });
}
/* ── ارزیابی خود مدیر منطقه (ستاره ۱ تا ۵ + ملاحظات؛ هر هفته جدا، کنار نمره‌ی گزارش‌ها و بی‌اثر بر آن) ── */
const rrStars = v => { const f = Math.max(0, Math.min(5, Math.round(v))); return '★'.repeat(f) + '☆'.repeat(5 - f); };
const rrNum = v => faS(String(v)).replace('.', '٫');
const RR_CAP = ['روی ستاره‌ها بزنید', 'خیلی ضعیف', 'ضعیف', 'متوسط', 'خوب', 'عالی'];
/* اختلاف زیاد: نمره‌ی گزارش‌ها (برده به ۱ تا ۵) و ستاره‌های مدیر منطقه دست‌کم ۱٫۵ فاصله دارند */
function rrGap(h) { if (!h.rr || h.score == null || h.n < LOW_H) return null; const f = 1 + h.score * 0.04; return Math.abs(f - h.rr.stars) >= 1.5 ? f : null; }
function rrCell(h, i, o) {
  const r = h.rr, g = rrGap(h), note = r && r.list.some(x => x.note || x.tags.length);
  const inner = r ? `<span class="rr-st" title="${rrNum(r.stars)} از ۵ — ${RR_CAP[Math.round(r.stars)]}">${rrStars(r.stars)}</span>${r.n > 1 ? ` <span class="dim">(${rrNum(r.stars)}، ${fa(r.n)} هفته)</span>` : ''}${note ? ' <span title="ملاحظات دارد">💬</span>' : ''}${g != null ? ` <span class="rr-gap" title="اختلاف زیاد: گزارش مدیران ثابت حدود ${rrNum(q5(h.score))} از ۵، ارزیابی مدیر منطقه ${rrNum(r.stars)} از ۵">⚠️</span>` : ''}`
    : o.canRate ? '<span class="rr-add">✍️ ارزیابی</span>' : '<span class="dim">—</span>';
  return `<td class="rr-td">${r || o.canRate ? `<button type="button" class="rr-btn" data-rr="${i}" title="${o.canRate ? 'ثبت یا ویرایش ارزیابی شما' : 'دیدن ارزیابی و ملاحظات'}">${inner}</button>` : inner}</td>`;
}
function rrOpen(h, o, done) {
  const cur = h.rr && o.canRate ? h.rr.list.find(x => String(x.week) === String(o.week)) || null : null;
  let st = cur ? cur.stars : 0;
  const tags = new Set(cur ? cur.tags : []), past = h.rr ? h.rr.list.filter(x => x !== cur) : [];
  const ov = document.createElement('div'); ov.className = 'rr-ov';
  ov.innerHTML = `<div class="rr-box" role="dialog" aria-modal="true" aria-label="ارزیابی ${esc(h.name)}">
    <div class="rr-h"><b>🏨 ${esc(h.name)}</b>${o.showRegion ? ` <span class="dim">(${esc(h.region)})</span>` : ''}<button type="button" class="rr-x" aria-label="بستن">✕</button></div>
    <div class="dim" style="font-size:13px">${h.score != null ? `نمره‌ی گزارش مدیران ثابت: <b>${qN(h.score)}</b>${Q_SCALE === 5 ? ' از ۵' : ' از ۱۰۰'} (${fa(h.n)} گزارش)` : 'برای این هتل هنوز گزارشی از مدیران ثابت ثبت نشده است.'}</div>
    ${o.canRate ? `<div class="rr-lbl">امتیاز شما به این هتل در «${esc(o.weekTitle || '')}»</div>
      <div class="rr-stars">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-s="${n}" aria-label="${fa(n)} ستاره">★</button>`).join('')}</div><div class="rr-cap"></div>
      <div class="rr-lbl">موضوع‌ها <span class="dim">(اختیاری)</span></div>
      <div class="rr-tags">${(o.tags || []).map(t => `<button type="button" data-t="${esc(t)}" class="${tags.has(t) ? 'on' : ''}">${esc(t)}</button>`).join('')}</div>
      <div class="rr-lbl">ملاحظات <span class="dim">(اختیاری)</span></div>
      <textarea class="rr-note" rows="4" maxlength="1500" placeholder="مثلاً: سرویس بهداشتی طبقه‌ی سوم مشکل دائمی دارد؛ با مدیر هتل صحبت شد.">${esc(cur ? cur.note : '')}</textarea>
      <div class="rr-act"><button type="button" class="btn" data-a="save">💾 ذخیره</button>${cur ? '<button type="button" class="btn danger" data-a="del">پاک کردن ارزیابی</button>' : ''}<button type="button" class="btn ghost" data-a="close">انصراف</button></div>
      <p class="dim" style="font-size:12px;margin:8px 0 0">این امتیاز جدا از نمره‌ی گزارش‌های مدیران ثابت نمایش داده می‌شود و در نمره‌ی هتل و شرکت‌های سیاحه حساب نمی‌شود. مدیران ثابت آن را نمی‌بینند.</p>` : ''}
    ${past.length ? `<div class="rr-lbl">${o.canRate ? 'ارزیابی‌های هفته‌های دیگر' : 'ارزیابی‌های مدیر منطقه'}</div>${past.map(x => `<div class="rr-item"><span class="rr-st">${rrStars(x.stars)}</span> <b>${esc(x.wtitle)}</b> <span class="dim">— ${esc(x.by)}</span>
      ${x.tags.length ? `<div class="rr-it-t">${x.tags.map(esc).join('، ')}</div>` : ''}${x.note ? `<div class="rr-it-n">${esc(x.note)}</div>` : ''}</div>`).join('')}` : ''}
  </div>`;
  document.body.appendChild(ov);
  const close = () => { ov.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc_);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.querySelector('.rr-x').onclick = close;
  const paint = () => { ov.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', +b.dataset.s <= st)); const c = ov.querySelector('.rr-cap'); if (c) c.textContent = RR_CAP[st]; };
  ov.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { st = +b.dataset.s; paint(); });
  ov.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const t = b.dataset.t; tags.has(t) ? tags.delete(t) : tags.add(t); b.classList.toggle('on', tags.has(t)); });
  const send = async (stars, btn) => {
    btn.disabled = true;
    try { const r = await o.onRate(h, { stars, tags: [...tags], note: ov.querySelector('.rr-note').value }); h.rr = r.rr; close(); done(); toast(stars ? 'ارزیابی ثبت شد' : 'ارزیابی پاک شد'); }
    catch (e) { btn.disabled = false; toast(e.message, true); }
  };
  ov.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    if (b.dataset.a === 'close') return close();
    if (b.dataset.a === 'del') { if (confirm('ارزیابی این هفته پاک شود؟')) send(0, b); return; }
    if (!st) return toast('اول امتیاز (تعداد ستاره) را انتخاب کنید.', true);
    send(st, b);
  });
  paint();
  const first = ov.querySelector('[data-s]') || ov.querySelector('.rr-x'); if (first) first.focus();
}
/* ── خروجی اکسل همین صفحه: هتل‌ها (به همان ترتیب جدول)، شرکت‌های سیاحه، نقل، و راهنمای محاسبه ── */
async function saveQualityBook(d, o, H) {
  const X = await loadXlsx(), five = Q_SCALE === 5;
  const sc = s => s == null ? '' : five ? +q5(s) : Math.round(s * 10) / 10, lvl = s => { const l = qLevel(s); return l ? l[1] : ''; };
  const pct = (df, fx) => df ? Math.round(fx / df * 100) : '';
  const period = o.week === 'all' ? 'همه‌ی هفته‌ها' : o.weekTitle || ((o.weeks || []).find(w => String(w.id) === String(o.week)) || {}).title || '';
  const unit = five ? 'از ۵' : 'از ۱۰۰', wb = X.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const sheet = (name, title, head, rows, widths) => {
    const aoa = [[title], head, ...rows.map((r, i) => [i + 1, ...r])], ws = X.utils.aoa_to_sheet(aoa);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(head.length - 1, 10) } }];
    ws['!cols'] = head.map((h, i) => ({ wch: widths[i] || 14 }));
    ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: Math.max(1, aoa.length - 1), c: head.length - 1 } }) };
    X.utils.book_append_sheet(wb, ws, name);
  };
  const rrText = h => h.rr ? h.rr.list.map(x => { const t = [x.tags.join('، '), x.note].filter(Boolean).join(' — '); return t && o.week === 'all' ? `${x.wtitle}: ${t}` : t; }).filter(Boolean).join(' | ') : '';
  sheet('هتل‌ها', `کیفیت هتل‌ها · ${period} · نمره ${unit}`,
    ['ردیف', 'هتل', ...(o.showRegion ? ['منطقه'] : []), `نمره (${unit})`, 'وضعیت', ...d.sections.map(x => `${x} (${unit})`), 'تعداد گزارش', 'نقص', 'رفع‌شده', 'رفع نقص ٪',
      'ستاره‌ی مدیر منطقه (از ۵)', 'ملاحظات مدیر منطقه', 'اختلاف با گزارش‌ها', ...(d.prevTitle ? [`تغییر نسبت به «${d.prevTitle}»`] : []), 'شرکت سیاحه'],
    H.map(h => [h.name, ...(o.showRegion ? [h.region] : []), sc(h.score), h.n ? lvl(h.score) + (h.n < LOW_H ? ' (داده کم)' : '') : 'بدون گزارش', ...d.sections.map(x => sc(h.secs[x])),
      h.n, h.n ? h.defects : '', h.n ? h.fixed : '', h.n ? pct(h.defects, h.fixed) : '', h.rr ? h.rr.stars : '', rrText(h), rrGap(h) != null ? '⚠️ اختلاف زیاد' : '',
      ...(d.prevTitle ? [h.prev == null || h.score == null ? '' : five ? Math.round((h.score - h.prev) * 0.4) / 10 : Math.round(h.score - h.prev)] : []), h.companies.map(shortCo).join('، ')]),
    [5, 24, ...(o.showRegion ? [12] : []), 11, 14, ...d.sections.map(() => 12), 9, 7, 8, 9, 12, 40, 14, ...(d.prevTitle ? [14] : []), 30]);
  const C = [...d.companies].sort((a, b) => (a.n < LOW_C) - (b.n < LOW_C) || a.score - b.score);
  if (C.length) sheet('شرکت‌های سیاحه', `شرکت‌های سیاحه — میانگین کیفیت هتل‌های طرف قرارداد · ${period}`,
    ['ردیف', 'شرکت سیاحه', `نمره (${unit})`, 'وضعیت', 'تعداد هتل', 'تعداد گزارش', 'رفع نقص ٪', 'هتل‌ها و نمره‌شان'],
    C.map(c => [c.name, sc(c.score), lvl(c.score) + (c.n < LOW_C ? ' (داده کم)' : ''), c.hotels.length, c.n, pct(c.defects, c.fixed), c.hotels.map(h => `${h.name}${o.showRegion ? ` (${h.region})` : ''}: ${sc(h.score)}`).join(' | ')]),
    [5, 34, 11, 16, 9, 10, 10, 70]);
  const T = [...d.transport].sort((a, b) => (a.n < LOW_C) - (b.n < LOW_C) || a.score - b.score);
  if (T.length) sheet('نقل', `نقل (اتوبوس) به تفکیک شرکت · ${period}`, ['ردیف', 'شرکت', `نمره (${unit})`, 'وضعیت', 'تعداد گزارش', 'نقص', 'رفع‌شده', 'رفع نقص ٪'],
    T.map(t => [t.name, sc(t.score), lvl(t.score) + (t.n < LOW_C ? ' (داده کم)' : ''), t.n, t.defects, t.fixed, pct(t.defects, t.fixed)]), [5, 34, 11, 16, 10, 7, 8, 10]);
  const help = [['نمره چطور حساب می‌شود؟'], [''],
    ['هر پاسخ مدیر ثابت نمره دارد: عالی ۱۰۰، خوب ۸۰، متوسط ۵۰، ضعیف ۲۰؛ بله/خیر: پاسخ درست ۱۰۰ و نقص صفر؛ گزینه‌های نقص بین ۴۰ تا ۱۰. «موضوعیت ندارد» حساب نمی‌شود.'],
    ['نمره‌ی هر گزارش میانگین پاسخ‌های آن است و نمره‌ی هتل میانگین گزارش‌هایش. پاسخ‌های بخش «نقل» در نمره‌ی هتل نیست و جدا آمده است.'],
    ['در حالت ۵ سطحی: صفر = ۱ و ۱۰۰ = ۵ (مثلاً ۸۰ = ۴٫۲).'],
    [`وضعیت: ${QL.map(l => `${l[1]} ${l[0] ? `از ${l[0]} به بالا` : 'زیر ۵۰'}`).join('، ')} (از ۱۰۰).`],
    [`هتل با کمتر از ${LOW_H} گزارش و شرکت با کمتر از ${LOW_C} گزارش «داده کم» است.`],
    ['نمره‌ی شرکت سیاحه = میانگین هتل‌هایش (هر هتل یک سهم)، فقط از گزارش کاروان‌های خود همان شرکت؛ عملکرد مستقیم شرکت نیست.'],
    ['ستاره‌ی مدیر منطقه ارزیابی جداگانه‌ی خود اوست و در هیچ نمره‌ای حساب نمی‌شود. «اختلاف زیاد» یعنی دست‌کم ۱٫۵ ستاره فاصله با نمره‌ی گزارش‌ها.']];
  const hs = X.utils.aoa_to_sheet(help); hs['!cols'] = [{ wch: 120 }]; X.utils.book_append_sheet(wb, hs, 'راهنما');
  const blob = new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `کیفیت هتل‌ها - ${period}.xlsx`.replace(/[\\/:*?"<>|]/g, '-').replace(/\u200c/g, ' ');
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function renderQuality(el, d, o = {}) {
  const H = qSorted(d.hotels, o.sort);
  const cnt = QL.map(l => H.filter(h => h.n >= LOW_H && qLevel(h.score) === l).length);
  const C = [...d.companies].sort((a, b) => (a.n < LOW_C) - (b.n < LOW_C) || a.score - b.score);
  const T = [...d.transport].sort((a, b) => (a.n < LOW_C) - (b.n < LOW_C) || a.score - b.score);
  const trend = h => h.prev == null ? '' : h.score - h.prev >= 3 ? `<span class="q-up" title="هفته‌ی قبل: ${qN(h.prev)}">▲ ${qD(h.score - h.prev)}</span>` : h.prev - h.score >= 3 ? `<span class="q-down" title="هفته‌ی قبل: ${qN(h.prev)}">▼ ${qD(h.prev - h.score)}</span>` : `<span class="dim" title="هفته‌ی قبل: ${qN(h.prev)}">＝</span>`;
  el.innerHTML = `
  <div class="card"><div class="card-h"><h2>⭐ کیفیت هتل‌ها</h2>
    ${o.weeks ? `<select class="sel" id="q-week" aria-label="دوره">${o.weeks.map(w => `<option value="${w.id}" ${String(w.id) === String(o.week) ? 'selected' : ''}>${esc(w.title)}</option>`).join('')}<option value="all" ${o.week === 'all' ? 'selected' : ''}>همه‌ی هفته‌ها روی هم</option></select>` : ''}
    ${H.length ? '<button type="button" class="btn small ghost" id="q-xlsx" title="جدول همین صفحه به ترتیب فعلی، با شرکت‌ها و نقل">📥 خروجی اکسل</button>' : ''}
    <div class="q-scale" role="group" aria-label="مقیاس نمره"><span>نمره از</span>${[100, 5].map(v => `<button type="button" data-qs="${v}" aria-pressed="${Q_SCALE === v}" class="${Q_SCALE === v ? 'on' : ''}">${v === 5 ? '۵ سطحی' : '۱۰۰'}</button>`).join('')}</div></div>
    ${!H.length ? '<div class="empty">برای این دوره هنوز گزارشی ثبت نشده است.</div>' : `
    <div class="q-sum"><div><b class="num">${d.avg == null ? '—' : qN(d.avg)}</b><span>میانگین نمره‌ی هتل‌ها</span></div>
      ${QL.map((l, i) => `<div class="${l[2]}"><b class="num">${fa(cnt[i])}</b><span>${l[1]}</span></div>`).join('')}</div>
    <p class="hint">${o.sort ? `مرتب بر اساس ستون انتخاب‌شده. <button type="button" class="q-reset" id="q-reset">برگشت به ترتیب پیش‌فرض</button>` : 'مرتب از ضعیف‌ترین به بهترین؛ برای مرتب‌سازی دیگر روی عنوان هر ستون بزنید.'} رنگ هر خانه وضع هتل در آن بخش است. ${d.prevTitle ? `▲▼ تغییر نسبت به «${esc(d.prevTitle)}».` : ''} هتلی که کمتر از ${fa(LOW_H)} گزارش دارد کم‌رنگ است${o.sort ? '' : ' و پایین فهرست می‌آید'} (داده کم).
      <br>«نظر مدیر منطقه» ارزیابی جداگانه‌ی خود مدیر منطقه است (۱ تا ۵ ستاره)${o.canRate ? '؛ برای ثبت، روی «✍️ ارزیابی» کنار هر هتل بزنید' : o.week === 'all' && o.rateHint ? '؛ برای ثبت ارزیابی، یک هفته را انتخاب کنید' : ''}. ⚠️ یعنی این ارزیابی با نمره‌ی گزارش‌های مدیران ثابت اختلاف زیادی دارد و بهتر است بررسی شود.</p>
    <div class="tbl-wrap"><table class="q-tbl"><thead><tr>${[['name', 'هتل'], ...(o.showRegion ? [['region', 'منطقه']] : []), ['score', 'نمره'], ['rr', 'نظر مدیر منطقه'], ...d.sections.map(x => ['sec:' + x, x, 'q-sec']), ['n', 'گزارش'], ['fix', 'رفع نقص'], ['co', 'شرکت سیاحه']]
      .map(([k, t, c]) => { const on = o.sort && o.sort.k === k; return `<th class="${c || ''}" aria-sort="${on ? (o.sort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="q-sort${on ? ' on' : ''}" data-sk="${esc(k)}" title="مرتب‌سازی بر اساس «${esc(t)}»">${esc(t)} <span aria-hidden="true">${on ? (o.sort.dir > 0 ? '▲' : '▼') : '⇅'}</span></button></th>`; }).join('')}</tr></thead><tbody>
    ${H.map((h, i) => `<tr class="${h.n < LOW_H ? 'q-low' : ''}"><td><b>${esc(h.name)}</b> ${trend(h)}</td>${o.showRegion ? `<td class="dim">${esc(h.region)}</td>` : ''}<td>${qBadge(h.score, h.n < LOW_H)}</td>${rrCell(h, i, o)}
      ${d.sections.map(s => qCell(h.secs[s])).join('')}<td class="num">${h.n ? fa(h.n) + (h.n < LOW_H ? ' <span class="dim">(داده کم)</span>' : '') : '<span class="dim">بدون گزارش</span>'}</td><td>${h.n ? qFix(h.defects, h.fixed) : '<span class="dim">—</span>'}</td><td class="dim" style="font-size:12px">${esc(h.companies.map(shortCo).join('، '))}</td></tr>`).join('')}
    </tbody></table></div>`}
    <div class="q-legend">${QL.map(l => `<span><i class="${l[2]}"></i>${l[1]} ${l[0] ? `(${qN(l[0])} به بالا)` : `(زیر ${qN(50)})`}</span>`).join('')}</div>
  </div>

  ${C.length ? `<div class="card"><div class="card-h"><h2>🏢 شرکت‌های سیاحه — کیفیت هتل‌های طرف قرارداد</h2></div>
    <p class="hint">این نمره <b>عملکرد مستقیم شرکت نیست</b>؛ میانگین کیفیت هتل‌هایی است که کاروان‌های این شرکت در آن‌ها بوده‌اند. فقط گزارش کاروان‌های خود همین شرکت حساب می‌شود و هر هتل یک سهم دارد (هتل پرگزارش وزن بیشتری ندارد).
      «رفع نقص» نشان می‌دهد چند درصد از نقص‌های گزارش‌شده برطرف شده است. شرکتی که کمتر از ${fa(LOW_C)} گزارش دارد رتبه‌بندی نمی‌شود.</p>
    <div class="q-comp">${C.map(c => { const low = c.n < LOW_C, l = qLevel(c.score); return `<details class="q-co ${low ? 'q-low' : ''}"><summary>
      <span class="q-co-n"><b>${esc(shortCo(c.name))}</b><span class="dim">${fa(c.hotels.length)} هتل · ${fa(c.n)} گزارش${low ? ' · داده کم' : ''}</span></span>
      <span class="q-bar"><i class="${l ? l[2] : ''}" style="width:${Math.max(4, c.score)}%"></i></span>${qBadge(c.score, low)}</summary>
      <div class="q-co-b"><div>رفع نقص: ${qFix(c.defects, c.fixed)}</div>${d.avg != null ? `<div>نسبت به میانگین همه‌ی هتل‌ها (${qN(d.avg)}): <b>${c.score >= d.avg ? 'بالاتر' : 'پایین‌تر'}</b></div>` : ''}
        ${c.hotels.map(h => `<div class="q-co-h">${qBadge(h.score, h.n < LOW_H)} ${esc(h.name)}${o.showRegion ? ` <span class="dim">(${esc(h.region)})</span>` : ''} <span class="dim">· ${fa(h.n)} گزارش</span></div>`).join('')}</div></details>`; }).join('')}</div></div>` : ''}

  ${T.length ? `<div class="card"><div class="card-h"><h2>🚌 نقل (اتوبوس) — به تفکیک شرکت</h2></div>
    <p class="hint">جدا از نمره‌ی هتل؛ از سؤال‌های بخش نقل گزارش‌ها. شرکت نقلِ هر کاروان معمولاً همان شرکت سیاحه است.</p>
    <div class="q-comp">${T.map(t => { const low = t.n < LOW_C, l = qLevel(t.score); return `<div class="q-co ${low ? 'q-low' : ''}"><div class="q-sumrow">
      <span class="q-co-n"><b>${esc(shortCo(t.name))}</b><span class="dim">${fa(t.n)} گزارش${low ? ' · داده کم' : ''} · رفع نقص: ${qFix(t.defects, t.fixed)}</span></span>
      <span class="q-bar"><i class="${l ? l[2] : ''}" style="width:${Math.max(4, t.score)}%"></i></span>${qBadge(t.score, low)}</div></div>`; }).join('')}</div></div>` : ''}

  <details class="card q-how"><summary><b>نمره چطور حساب می‌شود؟</b></summary>
    <p>هر پاسخ مدیر ثابت نمره دارد: عالی ۱۰۰، خوب ۸۰، متوسط ۵۰، ضعیف ۲۰. در سؤال‌های بله/خیر پاسخ درست ۱۰۰ و پاسخ نقص صفر است؛ در پاسخ‌های آماده، گزینه‌ی سالم ۱۰۰ و گزینه‌های نقص بین ۴۰ تا ۱۰ (هرچه شدیدتر، کمتر). «موضوعیت ندارد» حساب نمی‌شود.</p>
    <p>در حالت «۵ سطحی» همین نمره به بازه‌ی ۱ تا ۵ برده می‌شود (صفر = ۱، ۱۰۰ = ۵، با یک رقم اعشار؛ مثلاً ۸۰ می‌شود ۴٫۲). ترتیب و رنگ‌ها در هر دو حالت یکی است.</p>
    <p>نمره‌ی هر گزارش میانگین پاسخ‌های آن است و نمره‌ی هتل میانگین گزارش‌هایش. پاسخ‌های بخش «نقل» در نمره‌ی هتل نیست و جدا برای شرکت‌ها حساب می‌شود.</p>
    <p>این نمره‌ها فقط برای مدیران است و در برنامه‌ی زائران نمایش داده نمی‌شود.</p></details>`;
  const ws = el.querySelector('#q-week'); if (ws && o.onWeek) ws.onchange = () => o.onWeek(ws.value);
  const wrap = el.querySelector('.q-tbl') && el.querySelector('.q-tbl').parentElement, sx = wrap ? wrap.scrollLeft : 0;
  el.querySelectorAll('[data-sk]').forEach(b => b.onclick = () => {
    const k = b.dataset.sk, dir = o.sort && o.sort.k === k ? -o.sort.dir : 1;
    const y = window.scrollY; renderQuality(el, d, { ...o, sort: { k, dir } }); window.scrollTo(0, y);
    const w2 = el.querySelector('.q-tbl').parentElement; w2.scrollLeft = sx; const f = el.querySelector(`[data-sk="${CSS.escape(k)}"]`); if (f) f.focus({ preventScroll: true });
  });
  el.querySelectorAll('[data-qs]').forEach(b => b.onclick = () => {
    Q_SCALE = +b.dataset.qs; try { localStorage.setItem('q-scale', String(Q_SCALE)); } catch (e) {}
    const y = window.scrollY; renderQuality(el, d, o); window.scrollTo(0, y);
  });
  const xb = el.querySelector('#q-xlsx');
  if (xb) xb.onclick = async () => { xb.disabled = true; try { await saveQualityBook(d, o, H); } catch (e) { toast('ساختن فایل اکسل ممکن نشد: ' + e.message, true); } xb.disabled = false; };
  el.querySelectorAll('[data-rr]').forEach(b => b.onclick = () => rrOpen(H[+b.dataset.rr], o, () => { const y = window.scrollY; renderQuality(el, d, o); window.scrollTo(0, y); }));
  const rs = el.querySelector('#q-reset'); if (rs) rs.onclick = () => { const y = window.scrollY; renderQuality(el, d, { ...o, sort: null }); window.scrollTo(0, y); };
}

/* «🏢 شرکت‌ها»: هر شرکت سیاحه با کدام شرکت‌های مجری کار می‌کند و هتل‌هایش کدام است (از ردیف‌های اکسل هفتگی؛ d.dir از همان API کیفیت) */
function renderCompanies(el, d, o = {}) {
  const view = o.view || 'siyahe', term = normQ(o.q || '');
  const hs = new Map(d.hotels.map(h => [h.key, h])), cs = new Map(d.companies.map(c => [c.name, c]));
  const dir = d.dir || [], moj = new Map();
  dir.forEach(S => S.mojri.forEach(m => { let x = moj.get(m.name); if (!x) moj.set(m.name, x = { name: m.name, siyahe: [], caravans: 0, pilgrims: 0 }); x.siyahe.push({ name: S.name, caravans: m.caravans, pilgrims: m.pilgrims }); x.caravans += m.caravans; x.pilgrims += m.pilgrims; }));
  const M = [...moj.values()].sort((a, b) => b.caravans - a.caravans).map(x => (x.siyahe.sort((a, b) => b.caravans - a.caravans), x));
  const hit = (...names) => !term || names.some(n => normQ(n).includes(term));
  const SL = dir.filter(S => hit(S.name, ...S.hotels.map(h => h.name), ...S.mojri.map(m => m.name)));
  const ML = M.filter(x => hit(x.name, ...x.siyahe.map(y => y.name)));
  const hotelN = new Set(dir.flatMap(S => S.hotels.map(h => h.key))).size;
  const cnt = x => `${fa(x.caravans)} کاروان${x.pilgrims ? ` · ${fa(x.pilgrims)} زائر` : ''}`;
  const mark = n => term && normQ(n).includes(term) ? ' q-hit' : '';
  el.innerHTML = `<div class="card"><div class="card-h"><h2>🏢 شرکت‌های سیاحه، هتل‌ها و شرکت‌های مجری</h2>
    ${o.weeks ? `<select class="sel" id="q-week" aria-label="دوره">${o.weeks.map(w => `<option value="${w.id}" ${String(w.id) === String(o.week) ? 'selected' : ''}>${esc(w.title)}</option>`).join('')}<option value="all" ${o.week === 'all' ? 'selected' : ''}>همه‌ی هفته‌ها روی هم</option></select>` : ''}</div>
    ${!dir.length ? '<div class="empty">برای این دوره هنوز اکسل هفتگی وارد نشده است.</div>' : `
    <div class="q-sum q-sum3"><div><b class="num">${fa(dir.filter(S => S.name !== '—').length)}</b><span>شرکت سیاحه</span></div><div><b class="num">${fa(M.length)}</b><span>شرکت مجری</span></div><div><b class="num">${fa(hotelN)}</b><span>هتل</span></div></div>
    <p class="hint">از روی ردیف‌های اکسل هفتگی (همه‌ی کاروان‌ها، چه گزارش داشته باشند چه نه). روی هر شرکت بزنید تا جزئیاتش باز شود.${d.hotels.length ? ' نمره‌ی کنار هتل‌ها از تب «کیفیت هتل‌ها» است.' : ''}</p>
    <div class="q-tools"><input type="search" class="inp" id="co-q" placeholder="جستجوی نام شرکت یا هتل…" value="${esc(o.q || '')}" aria-label="جستجو">
      <div class="q-scale" role="group" aria-label="نمایش">${[['siyahe', 'بر اساس سیاحه'], ['mojri', 'بر اساس مجری']].map(([k, t]) => `<button type="button" data-cv="${k}" aria-pressed="${view === k}" class="${view === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    <div class="q-comp" id="co-list">${view === 'siyahe' ? (SL.length ? SL.map(S => { const c = cs.get(S.name); return `<details class="q-co"${term ? ' open' : ''}><summary>
      <span class="q-co-n"><b class="${mark(S.name)}">${S.name === '—' ? 'بدون نام شرکت سیاحه در اکسل' : esc(shortCo(S.name))}</b><span class="dim">${fa(S.hotels.length)} هتل · ${fa(S.mojri.length)} شرکت مجری · ${cnt(S)}</span></span>${c ? qBadge(c.score, c.n < LOW_C) : ''}</summary>
      <div class="co-grid"><div><h4>🏨 هتل‌ها</h4>${S.hotels.map(h => { const q = hs.get(h.key); return `<div class="q-co-h">${q ? qBadge(q.score, q.n < LOW_H) : '<span class="q-badge q-none" title="هنوز گزارشی ندارد">—</span>'} <span class="${mark(h.name)}">${esc(h.name)}</span>${o.showRegion ? ` <span class="dim">(${esc(h.region)})</span>` : ''}</div>`; }).join('') || '<div class="dim">—</div>'}</div>
        <div><h4>🤝 شرکت‌های مجری طرف قرارداد</h4>${S.mojri.map(m => `<div class="co-m"><span class="${mark(m.name)}">${esc(shortCo(m.name))}</span></div>`).join('') || '<div class="dim">در اکسل نام شرکت مجری نیامده است.</div>'}</div></div></details>`; }).join('') : '<div class="empty">چیزی پیدا نشد.</div>')
      : (ML.length ? ML.map(x => `<details class="q-co"${term ? ' open' : ''}><summary><span class="q-co-n"><b class="${mark(x.name)}">${esc(shortCo(x.name))}</b><span class="dim">${fa(x.siyahe.length)} شرکت سیاحه · ${cnt(x)}</span></span></summary>
      <div class="co-grid"><div><h4>🏢 شرکت‌های سیاحه</h4>${x.siyahe.map(y => { const c = cs.get(y.name); return `<div class="q-co-h">${c ? qBadge(c.score, c.n < LOW_C) : ''} <span class="${mark(y.name)}">${y.name === '—' ? 'بدون نام' : esc(shortCo(y.name))}</span> <span class="dim">· ${cnt(y)}</span></div>`; }).join('')}</div></div></details>`).join('') : '<div class="empty">چیزی پیدا نشد.</div>')}</div>`}</div>`;
  const ws = el.querySelector('#q-week'); if (ws && o.onWeek) ws.onchange = () => o.onWeek(ws.value);
  el.querySelectorAll('[data-cv]').forEach(b => b.onclick = () => renderCompanies(el, d, { ...o, view: b.dataset.cv }));
  const qi = el.querySelector('#co-q'); if (qi) qi.oninput = () => { const v = qi.value, pos = qi.selectionStart; renderCompanies(el, d, { ...o, q: v }); const n = el.querySelector('#co-q'); n.focus(); n.setSelectionRange(pos, pos); };
}
const normQ = s => String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[‌‏‎]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

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
  .q-sort{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font:inherit;font-weight:700;padding:4px 2px;border-radius:6px;white-space:normal}
  .q-sort span{font-size:11px;opacity:.45}.q-sort.on{color:var(--pri,#0F5A43)}.q-sort.on span{opacity:1}
  .q-sort:hover span{opacity:.9}.q-sort:focus-visible{outline:2px solid var(--pri,#0F5A43);outline-offset:2px}
  .q-reset{all:unset;cursor:pointer;color:var(--pri,#0F5A43);font-weight:700;text-decoration:underline}
  .q-scale{display:inline-flex;align-items:center;gap:4px;font-size:12px;margin-inline-start:auto}
  .q-scale button{all:unset;cursor:pointer;padding:5px 10px;border-radius:8px;border:1px solid var(--border,#e5dccb);font-weight:700}
  .q-scale button.on{background:var(--pri,#0F5A43);color:#fff;border-color:transparent}
  .q-scale button:focus-visible{outline:2px solid var(--pri,#0F5A43);outline-offset:2px}
  .q-sum3{grid-template-columns:repeat(3,1fr)!important}.q-sum3>div{grid-column:auto!important}
  .q-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.q-tools .inp{flex:1 1 220px;min-width:0}
  .co-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:10px 4px 4px;font-size:13px}.co-grid>div{display:grid;gap:6px;align-content:start}
  .co-grid h4{margin:0 0 2px;font-size:13px}.co-m{padding:4px 0;border-bottom:1px dashed var(--border,#e5dccb)}
  @media (max-width:560px){.co-grid{grid-template-columns:1fr}}
  .q-none{--q:#888;--qb:transparent;opacity:.6}.q-hit{background:#FFE58A;color:#000;border-radius:4px;padding:0 2px}
  .rr-td{white-space:nowrap}
  .rr-btn{all:unset;cursor:pointer;padding:4px 6px;border-radius:8px;display:inline-flex;align-items:center;gap:2px}
  .rr-btn:hover{background:color-mix(in srgb,currentColor 7%,transparent)}.rr-btn:focus-visible{outline:2px solid var(--pri,#0F5A43)}
  .rr-st{color:#C08A00;letter-spacing:1px;font-size:15px}
  .rr-add{color:var(--pri,#0F5A43);font-weight:700;font-size:13px;border:1px dashed currentColor;border-radius:8px;padding:2px 8px}
  .rr-gap{cursor:help}
  .rr-ov{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}
  .rr-box{background:var(--surface,#fff);color:var(--ink,#222);border-radius:18px;max-width:460px;width:100%;max-height:90vh;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:6px}
  .rr-h{display:flex;align-items:center;gap:6px}.rr-h b{flex:1;font-size:16px}
  .rr-x{all:unset;cursor:pointer;width:34px;height:34px;display:grid;place-items:center;border-radius:50%;font-size:16px}
  .rr-lbl{font-weight:800;font-size:13.5px;margin-top:10px}
  .rr-stars{display:flex;gap:6px}
  .rr-stars button{all:unset;cursor:pointer;font-size:34px;line-height:1;color:#CFC8B8;padding:2px}
  .rr-stars button.on{color:#E0A400}.rr-stars button:focus-visible{outline:2px solid var(--pri,#0F5A43);border-radius:6px}
  .rr-cap{font-size:13px;font-weight:700;color:var(--muted,#777);min-height:18px}
  .rr-tags{display:flex;flex-wrap:wrap;gap:6px}
  .rr-tags button{all:unset;cursor:pointer;padding:6px 12px;border-radius:999px;border:1px solid var(--line,#ddd);font-size:13px}
  .rr-tags button.on{background:var(--pri,#0F5A43);color:#fff;border-color:transparent}
  .rr-note{width:100%;box-sizing:border-box;border:1px solid var(--line,#ddd);border-radius:12px;padding:10px;font:inherit;background:var(--surface2,var(--surface,#fff));color:inherit;resize:vertical}
  .rr-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
  .rr-item{padding:8px 0;border-top:1px dashed var(--line,#ddd);font-size:13px;line-height:1.8}
  .rr-it-t{color:var(--muted,#777)}.rr-it-n{white-space:pre-wrap}
  .q-how p{font-size:13px;line-height:1.9;margin:6px 0 0}`;
  document.head.appendChild(st);
})();
