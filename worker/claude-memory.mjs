#!/usr/bin/env node
/* حافظه‌ی Claude (پوشه‌ی memory در Codespace) ← پشتیبان در Cloudflare D1 (hamyar-backups، نام memory/<زمان>) + «Codespace روشن است» برای یادآوری بله
   - backup [--quiet]: اگر حافظه عوض شده باشد یک نسخه‌ی تازه می‌فرستد (۲۰ نسخه‌ی آخر نگه داشته می‌شود)؛ هر ۶ ساعت هم زمان استفاده از Codespace را ثبت می‌کند (config cs:seen در hamyar-reviews).
     هوک Stop در .claude/settings.local.json آن را بعد از هر پاسخ Claude در پس‌زمینه اجرا می‌کند.
   - restore <file.json.gz> [--force]: فایل دانلودشده از پنل مدیریت (آمار ← «🧠 حافظه Claude») را در پوشه‌ی memory برمی‌گرداند.
   هیچ رمزی در این فایل نیست؛ توکن Cloudflare از ~/.cloudflare-token خوانده می‌شود. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MEM = join(homedir(), '.claude/projects/-workspaces-iraq-guide/memory');
const STATE = join(homedir(), '.cache/hamyar-memory.json');
const WORKER = dirname(fileURLToPath(import.meta.url));
const [cmd, arg] = process.argv.slice(2), quiet = process.argv.includes('--quiet'), force = process.argv.includes('--force');
const log = (...a) => { if (!quiet) console.log(...a); };

function d1(db, sql) {
  const f = join(tmpdir(), `hamyar-mem-${process.pid}.sql`);
  writeFileSync(f, sql);
  const env = { ...process.env, CLOUDFLARE_API_TOKEN: readFileSync(join(homedir(), '.cloudflare-token'), 'utf8').trim() };
  return execFileSync('npx', ['-y', 'wrangler@3', 'd1', 'execute', db, '--remote', '--file', f], { cwd: WORKER, env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 }).toString();
}
const q = s => "'" + String(s).replace(/'/g, "''") + "'";

if (cmd === 'backup') {
  let st = {}; try { st = JSON.parse(readFileSync(STATE, 'utf8')); } catch (e) {}
  const now = Date.now();
  const files = existsSync(MEM) ? Object.fromEntries(readdirSync(MEM).filter(n => n.endsWith('.md')).sort().map(n => [n, readFileSync(join(MEM, n), 'utf8')])) : {};
  const hash = createHash('sha256').update(JSON.stringify(files)).digest('hex');
  const sql = [];
  if (Object.keys(files).length && hash !== st.hash) {
    const ts = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'), name = 'memory/' + ts;
    const gz = gzipSync(Buffer.from(JSON.stringify({ kind: 'claude-memory', ts, dir: MEM, files })));
    sql.push(`INSERT OR REPLACE INTO chunks (name, i, data) VALUES (${q(name)}, 0, X'${gz.toString('hex')}');`,
      `INSERT OR REPLACE INTO files (name, kind, ts, bytes, sha256, n, got, exp) VALUES (${q(name)}, 'memory', ${q(ts)}, ${gz.length}, ${q(createHash('sha256').update(gz).digest('hex'))}, 1, ${now}, ${now + 400 * 864e5});`,
      `DELETE FROM chunks WHERE name IN (SELECT name FROM files WHERE kind = 'memory' ORDER BY ts DESC LIMIT -1 OFFSET 20);`,
      `DELETE FROM files WHERE kind = 'memory' AND name NOT IN (SELECT name FROM files WHERE kind = 'memory' ORDER BY ts DESC LIMIT 20);`);
  }
  try {
    if (sql.length) { d1('hamyar-backups', sql.join('\n')); st.hash = hash; st.at = now; log('memory backed up', Object.keys(files).length, 'files'); }
    if (!st.hb || now - st.hb > 6 * 36e5) { d1('hamyar-reviews', `INSERT INTO config (k, v) VALUES ('cs:seen', '${now}') ON CONFLICT(k) DO UPDATE SET v = excluded.v;`); st.hb = now; log('heartbeat sent'); }
    mkdirSync(dirname(STATE), { recursive: true }); writeFileSync(STATE, JSON.stringify(st));
  } catch (e) { if (!quiet) console.error('failed:', String(e.stderr || e.message).slice(0, 400)); process.exitCode = quiet ? 0 : 1; }
} else if (cmd === 'restore' && arg) {
  const d = JSON.parse(gunzipSync(readFileSync(arg)).toString('utf8'));
  if (d.kind !== 'claude-memory') { console.error('not a Claude memory backup'); process.exit(1); }
  mkdirSync(MEM, { recursive: true });
  for (const [n, c] of Object.entries(d.files)) {
    if (!/^[\w.-]+\.md$/.test(n)) continue;
    const p = join(MEM, n);
    if (existsSync(p) && !force) { console.log('skip (exists, use --force):', n); continue; }
    writeFileSync(p, c); console.log('restored', n);
  }
  console.log(`backup ${d.ts} → ${MEM}`);
} else {
  console.log('usage: node claude-memory.mjs backup [--quiet] | restore <file.json.gz> [--force]');
}
