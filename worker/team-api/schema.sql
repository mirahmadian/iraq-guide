-- سامانه نواقص هتل‌ها روی Cloudflare D1 (همان جدول‌های سرور 188 + چند جدول کمکی که آنجا در حافظه بود)
CREATE TABLE IF NOT EXISTS regions (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, region_id INTEGER REFERENCES regions(id),
  role TEXT NOT NULL CHECK (role IN ('super','region','fm')), nid TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  sheet TEXT, salt TEXT, hash TEXT, must_change INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1,
  created INTEGER NOT NULL, last_login INTEGER, created_by INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (tok TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pubkey TEXT NOT NULL, alg INTEGER NOT NULL, counter INTEGER NOT NULL DEFAULT 0, label TEXT, created INTEGER NOT NULL, last_used INTEGER
);
CREATE TABLE IF NOT EXISTS weeks (
  id INTEGER PRIMARY KEY, region_id INTEGER NOT NULL REFERENCES regions(id), title TEXT NOT NULL,
  file TEXT, imported INTEGER NOT NULL, imported_by INTEGER
);
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY, week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE, row_no INTEGER NOT NULL,
  hotel TEXT NOT NULL, home_mgr TEXT, cook TEXT, caravans INTEGER, d_in TEXT, d_out TEXT, pilgrims INTEGER, company TEXT, siyahe TEXT,
  UNIQUE (week_id, row_no)
);
CREATE TABLE IF NOT EXISTS assign (
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, user_id)
);
CREATE TABLE IF NOT EXISTS sheet_rows (
  week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE, sheet TEXT NOT NULL COLLATE NOCASE, row_no INTEGER NOT NULL,
  PRIMARY KEY (week_id, sheet, row_no)
);
CREATE TABLE IF NOT EXISTS forms (region_id INTEGER PRIMARY KEY REFERENCES regions(id), json TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id),
  descr TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, updated INTEGER NOT NULL, UNIQUE (entry_id, user_id)
);
CREATE TABLE IF NOT EXISTS items (
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE, qid TEXT NOT NULL,
  section TEXT, question TEXT, answer TEXT, answer_label TEXT, is_defect INTEGER NOT NULL DEFAULT 0,
  reasons TEXT, day TEXT, actions TEXT, action_text TEXT, result TEXT, result_note TEXT, updated INTEGER NOT NULL,
  PRIMARY KEY (report_id, qid)
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY, report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE, qid TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id), role TEXT NOT NULL, text TEXT NOT NULL, ts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id),
  qid TEXT NOT NULL, kind TEXT NOT NULL, file TEXT, mime TEXT, size INTEGER, orig_size INTEGER,
  status TEXT NOT NULL, created INTEGER NOT NULL, psize INTEGER
);
CREATE INDEX IF NOT EXISTS media_owner ON media (entry_id, user_id, qid);
CREATE INDEX IF NOT EXISTS entries_week ON entries (week_id);
CREATE INDEX IF NOT EXISTS assign_user ON assign (user_id);

-- چیزهایی که سرور قدیم در حافظه نگه می‌داشت
CREATE TABLE IF NOT EXISTS previews (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, file TEXT, json TEXT NOT NULL, exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS challenges (c TEXT PRIMARY KEY, kind TEXT NOT NULL, user_id INTEGER, exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tries (k TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL, first INTEGER NOT NULL);
-- ارسال تکه‌تکه عکس و فیلم (تکه‌ها در پایگاه جدای MDB)
CREATE TABLE IF NOT EXISTS uploads (k TEXT PRIMARY KEY, user_id INTEGER NOT NULL, next INTEGER NOT NULL, size INTEGER NOT NULL, psize INTEGER, of INTEGER NOT NULL, exp INTEGER NOT NULL, res TEXT);
