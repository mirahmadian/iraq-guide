'use strict';
/* اکسل سامانه نواقص هتل‌ها روی دستگاه خود کاربر خوانده و ساخته می‌شود (سرور Cloudflare فقط داده‌ی آماده می‌گیرد و می‌دهد).
   کتابخانه‌ی SheetJS فقط وقتی لازم شد بار می‌شود. همان قواعد excel.js سرور قدیم (188). */
const XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let xlsxP = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return xlsxP = xlsxP || new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = XLSX_SRC; s.crossOrigin = 'anonymous';
    s.onload = () => window.XLSX ? res(window.XLSX) : rej(new Error('ابزار اکسل بار نشد.'));
    s.onerror = () => { xlsxP = null; s.remove(); rej(new Error('ابزار خواندن اکسل بار نشد. اینترنت را بررسی کنید و دوباره امتحان کنید.')); };
    document.head.appendChild(s);
  });
}
const xNorm = s => String(s ?? '').replace(/\s+/g, '');
const xClean = s => String(s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const xLatin = s => String(s ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const xFa = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
function xNidValid(c) { if (!/^\d{10}$/.test(c) || /^(\d)\1{9}$/.test(c)) return false; const r = [...c.slice(0, 9)].reduce((a, d, i) => a + +d * (10 - i), 0) % 11; return +c[9] === (r < 2 ? r : 11 - r); }
function xNid(v) { const d = xLatin(v).replace(/\D/g, ''); return d.length >= 8 && d.length < 10 && xNidValid(d.padStart(10, '0')) ? d.padStart(10, '0') : d; }

/* a table sheet is any sheet whose header row has «هتل» and «شرکت مجری» */
function xTable(X, ws) {
  const a = X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  const h = a.findIndex(r => r.some(c => xClean(c) === 'هتل') && r.some(c => xNorm(c).includes('شرکتمجری')));
  if (h < 0) return null;
  const col = t => a[h].findIndex(c => xNorm(c).includes(t));
  return { a, h, c: { id: col('ردیف'), hotel: a[h].findIndex(c => xClean(c) === 'هتل'), mgr: col('مدیرثابت'), cook: col('آشپز'), car: col('تعدادکاروان'),
    din: col('تاریخورود'), dout: col('تاریخخروج'), pil: col('تعدادزائر'), co: col('شرکتمجری'), si: col('شرکتسیاحه'), room: col('تعداداتاق') >= 0 ? col('تعداداتاق') : col('اتاق'), bed: col('تعدادتخت') >= 0 ? col('تعدادتخت') : col('تخت') } };
}
const xDate = v => xLatin(xClean(v)).replace(/-/g, '/');
const xInt = v => parseInt(xLatin(String(v)).replace(/\D/g, ''), 10) || 0;
/* codes sheet: any row holding a national code; name = longest other text cell; sheet = a cell equal to a person-sheet name */
function xCodes(X, ws, sheetNames) {
  const a = X.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }), out = [];
  const lower = new Map(sheetNames.map(s => [s.toLowerCase().trim(), s]));
  for (const r of a) {
    let nid = '', raw = '', name = '', sheet = '';
    for (const c of r) {
      const t = xClean(c); if (!t) continue;
      const d = xLatin(t).replace(/\D/g, '');
      if (!nid && d.length >= 8 && d.length <= 10 && /^[\d\s۰-۹٠-٩-]+$/.test(t)) { nid = xNid(t); raw = t; continue; }
      if (lower.has(t.toLowerCase())) { sheet = lower.get(t.toLowerCase()); continue; }
      if (/[؀-ۿ]/.test(t) && t.length > name.length && !/کد|ملی|نام|ردیف/.test(t)) name = t;
    }
    if (nid) out.push({ nid, raw, name, sheet, valid: xNidValid(nid) });
  }
  return out;
}
async function parseWeeklyFile(file) {
  const X = await loadXlsx();
  const wb = X.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
  let main = null, mainName = '';
  for (const n of wb.SheetNames) { const t = xTable(X, wb.Sheets[n]); if (t && (!main || t.a.length > main.a.length)) { main = t; mainName = n; } }
  if (!main) throw new Error('در این فایل جدولی با ستون‌های «هتل» و «شرکت مجری» پیدا نشد.');
  const C = main.c;
  if (C.id < 0 || C.din < 0 || C.dout < 0) throw new Error('ستون‌های «ردیف»، «تاریخ ورود کاروان» یا «تاریخ خروج کاروان» پیدا نشد.');
  const rows = [], problems = [];
  for (const r of main.a.slice(main.h + 1)) {
    const id = xInt(r[C.id]); if (!id || !xClean(r[C.hotel])) continue;
    const e = { row_no: id, hotel: xClean(r[C.hotel]), home_mgr: xClean(r[C.mgr]), cook: xClean(r[C.cook]), caravans: xInt(r[C.car]),
      d_in: xDate(r[C.din]), d_out: xDate(r[C.dout]), pilgrims: xInt(r[C.pil]), company: xClean(r[C.co]), siyahe: xClean(r[C.si]), rooms: C.room >= 0 ? xInt(r[C.room]) || null : null, beds: C.bed >= 0 ? xInt(r[C.bed]) || null : null };
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(e.d_in) || !/^\d{4}\/\d{2}\/\d{2}$/.test(e.d_out)) problems.push(`ردیف ${id}: تاریخ ورود یا خروج قابل خواندن نیست.`);
    rows.push(e);
  }
  const ids = new Set(rows.map(r => r.row_no));
  let title = '';
  const head = X.utils.sheet_to_json(wb.Sheets[mainName], { header: 1, defval: '', raw: false }).slice(0, main.h).flat().map(xClean);
  const wk = head.find(c => c.includes('هفته'));
  if (wk) title = xFa(wk.replace(/^هفته\s*:?\s*/, 'هفته‌ی ').replace('از تاریخ', '').replace('الی', 'تا').replace(/\s+/g, ' ').trim());
  if (!title && rows.length) { const ins = rows.map(r => r.d_in).sort(); title = xFa(`ورودی‌های ${ins[0]} تا ${ins[ins.length - 1]}`); }
  const sheets = [], others = [];
  for (const n of wb.SheetNames) {
    if (n === mainName) continue;
    const t = xTable(X, wb.Sheets[n]);
    if (!t) { others.push(n); continue; }
    const list = t.c.id < 0 ? [] : [...new Set(t.a.slice(t.h + 1).map(r => xInt(r[t.c.id])).filter(x => ids.has(x)))];
    sheets.push({ sheet: n, ids: list });
  }
  let codes = [];
  for (const n of others) codes = codes.concat(xCodes(X, wb.Sheets[n], sheets.map(s => s.sheet)));
  return { title, mainName, rows, sheets, codes, problems };
}

/* Excel of a week from what the server sends: { title, file, rows (defects), reports: { title, head, rows } (every report) } */
async function saveDefectsBook(d) {
  const X = await loadXlsx();
  const head = ['ردیف', 'مدیر ثابت', 'کد ملی', 'هتل', 'شرکت مجری', 'شرکت سیاحه', 'ورود کاروان', 'خروج کاروان', 'تعداد زائر', 'حوزه', 'اشکال مشاهده‌شده', 'پاسخ', 'جزئیات اشکال',
    'روز وقوع', 'اقدام انجام‌شده', 'نتیجه', 'توضیح نتیجه', 'پیگیری مدیر منطقه', 'گفتگوی مدیر ثابت', 'عکس و فیلم', 'آخرین به‌روزرسانی'];
  const aoa = [[d.title], head, ...d.rows.map((r, i) => [i + 1, ...r])];
  const ws = X.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: head.length - 1 } }];
  ws['!cols'] = [5, 20, 12, 18, 30, 14, 11, 11, 8, 18, 34, 10, 30, 11, 36, 13, 34, 34, 30, 9, 16].map(w => ({ wch: w }));
  ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: Math.max(1, aoa.length - 1), c: head.length - 1 } }) };
  const wb = X.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  /* برگه‌ی «همه‌ی گزارش‌ها» (با نقص و بی‌نقص) اول می‌آید؛ برگه‌ی «نواقص» بعد از آن */
  if (d.reports) {
    const R = d.reports, ra = [[R.title], R.head, ...R.rows.map((r, i) => [i + 1, ...r])];
    const rs = X.utils.aoa_to_sheet(ra);
    rs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(R.head.length - 1, 12) } }];
    rs['!cols'] = R.head.map((h, i) => ({ wch: i === 0 ? 5 : i < 12 ? [5, 20, 12, 18, 30, 14, 11, 11, 8, 12, 11, 30][i] : i === R.head.length - 1 ? 16 : 18 }));
    rs['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: Math.max(1, ra.length - 1), c: R.head.length - 1 } }) };
    X.utils.book_append_sheet(wb, rs, 'همه گزارش‌ها');
  }
  X.utils.book_append_sheet(wb, ws, 'نواقص');
  const blob = new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = String(d.file || 'naghayes.xlsx').replace(/[\\/:*?"<>|]/g, '-').replace(/\u200c/g, ' ');   /* مرورگر نیم‌فاصله را «_» می‌کرد */
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

/* یک فایل اکسل راست‌به‌چپ با چند برگه: [{ name, title, head, rows, widths, text: [شماره‌ی ستون‌هایی که متن بمانند، مثل کد ملی] }] */
const xDT = t => t ? new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Baghdad' }).format(t).replace(/[،,]/g, '') : '';
async function saveBook(file, sheets) {
  const X = await loadXlsx(), wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
  for (const sh of sheets) {
    const rows = sh.rows.map((r, i) => [i + 1, ...r]), head = ['ردیف', ...sh.head];
    const aoa = [[sh.title], head, ...rows], ws = X.utils.aoa_to_sheet(aoa);
    (sh.text || []).forEach(c => rows.forEach((r, i) => { const cell = ws[X.utils.encode_cell({ r: i + 2, c: c + 1 })]; if (cell) { cell.t = 's'; cell.v = String(cell.v); cell.z = '@'; } }));
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(head.length - 1, 8) } }];
    ws['!cols'] = [{ wch: 6 }, ...sh.head.map((h, i) => ({ wch: (sh.widths || [])[i] || Math.max(10, Math.min(30, h.length + 4)) }))];
    if (rows.length) ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: aoa.length - 1, c: head.length - 1 } }) };
    X.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  }
  X.writeFile(wb, file.replace(/[\\/:*?"<>|]/g, '-'));
}
