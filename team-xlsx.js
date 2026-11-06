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
    din: col('تاریخورود'), dout: col('تاریخخروج'), pil: col('تعدادزائر'), co: col('شرکتمجری'), si: col('شرکتسیاحه') } };
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
      d_in: xDate(r[C.din]), d_out: xDate(r[C.dout]), pilgrims: xInt(r[C.pil]), company: xClean(r[C.co]), siyahe: xClean(r[C.si]) };
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

/* defects Excel from the rows the server sends ({ title, file, rows }) */
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
  X.utils.book_append_sheet(wb, ws, 'نواقص');
  const blob = new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = String(d.file || 'naghayes.xlsx').replace(/[\\/:*?"<>|]/g, '-');
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
