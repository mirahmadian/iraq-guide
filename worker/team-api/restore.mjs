/* برگرداندن پشتیبان سامانه نواقص هتل‌ها
   فایل hamyar-team-<ts>.json.gz را از پنل مدیریت ← آمار ← «سلامت سرور و پشتیبان‌ها» بگیرید، بعد:
     node worker/team-api/restore.mjs hamyar-team-XXXX.json.gz > restore.sql
     cd worker/team-api && npx wrangler@3 d1 execute hamyar-hotels --remote --file ../../restore.sql
   restore.sql اول همه‌ی داده‌های فعلی را پاک می‌کند و بعد نسخه‌ی پشتیبان را می‌نشاند. فایل SQL رمزهای هش‌شده دارد؛ بعد از کار پاکش کنید. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const f = process.argv[2];
if (!f) { console.error('usage: node restore.mjs <backup.json.gz>'); process.exit(1); }
const d = JSON.parse(gunzipSync(readFileSync(f)).toString('utf8'));
if (d.kind !== 'hamyar-hotels') { console.error('not a hamyar-hotels backup'); process.exit(1); }
const ORDER = ['regions', 'users', 'sessions', 'passkeys', 'weeks', 'entries', 'assign', 'sheet_rows', 'forms', 'reports', 'items', 'notes', 'media'];
const lit = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : typeof v === 'object' ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
const out = [...ORDER].reverse().map(t => `DELETE FROM ${t};`);
out.push('DELETE FROM previews; DELETE FROM challenges; DELETE FROM uploads;');
for (const t of ORDER) for (const r of d.tables[t] || []) {
  /* media files are not in the backup: their rows come back as expired */
  if (t === 'media') Object.assign(r, { file: null, status: 'expired' });
  const k = Object.keys(r);
  out.push(`INSERT INTO ${t} (${k.join(', ')}) VALUES (${k.map(c => lit(r[c])).join(', ')});`);
}
console.log(out.join('\n'));
console.error(`backup ${d.ts}: ${ORDER.map(t => `${t} ${(d.tables[t] || []).length}`).join(', ')}`);
