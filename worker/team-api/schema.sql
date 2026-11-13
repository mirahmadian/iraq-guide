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
  reasons TEXT, day TEXT, actions TEXT, action_text TEXT, result TEXT, result_note TEXT, updated INTEGER NOT NULL, pick TEXT,
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

-- ارزیابی خود مدیر منطقه از هتل، هر هفته جدا (جدا از نمره‌ی گزارش مدیران ثابت)
CREATE TABLE IF NOT EXISTS region_ratings (
  week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE, hotel TEXT NOT NULL, region_id INTEGER NOT NULL,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5), tags TEXT, note TEXT, user_id INTEGER REFERENCES users(id), updated INTEGER NOT NULL,
  PRIMARY KEY (week_id, hotel)
);

-- عوامل منطقه (مدیران ثابت، آشپزها و هر نقشی که مدیر منطقه تعریف کند): هر رکورد یک «دوره» است؛ تمدید = رکورد تازه با prev_id
CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY, region_id INTEGER NOT NULL REFERENCES regions(id), first TEXT NOT NULL, last TEXT NOT NULL, nid TEXT NOT NULL,
  role TEXT NOT NULL, hotel TEXT, d_start TEXT NOT NULL, d_end TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', left_at TEXT,
  prev_id INTEGER, note TEXT, created INTEGER NOT NULL, updated INTEGER NOT NULL, by INTEGER
);
CREATE INDEX IF NOT EXISTS staff_region ON staff (region_id, status);
CREATE INDEX IF NOT EXISTS staff_nid ON staff (region_id, nid);
CREATE TABLE IF NOT EXISTS staff_moves (id INTEGER PRIMARY KEY, staff_id INTEGER NOT NULL, from_hotel TEXT, to_hotel TEXT, ts INTEGER NOT NULL, by INTEGER);
CREATE INDEX IF NOT EXISTS staff_moves_s ON staff_moves (staff_id);
CREATE TABLE IF NOT EXISTS staff_cfg (region_id INTEGER PRIMARY KEY, roles TEXT NOT NULL, updated INTEGER NOT NULL);
-- موقعیت هتل روی نقشه که مدیر منطقه خودش گذاشته (بقیه از مختصات هتل‌های اپلیکیشن)
CREATE TABLE IF NOT EXISTS hotel_geo (region_id INTEGER NOT NULL, hotel TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, PRIMARY KEY (region_id, hotel));
-- اتصال مدیر منطقه به بازوی بله برای هشدار تاریخ خروج (پیام را worker hamyar-reviews می‌فرستد)
CREATE TABLE IF NOT EXISTS team_bale (user_id INTEGER PRIMARY KEY, chat_id INTEGER NOT NULL, linked INTEGER NOT NULL, last_sent TEXT);
CREATE TABLE IF NOT EXISTS team_bale_links (code TEXT PRIMARY KEY, user_id INTEGER NOT NULL, exp INTEGER NOT NULL);

-- شهرها و «سرپرست مناطق» (role = 'super' با lead = 1)؛ عنوان نقش در team_cfg (lead_label)
ALTER TABLE regions ADD COLUMN city TEXT;
ALTER TABLE users ADD COLUMN lead INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS team_cfg (k TEXT PRIMARY KEY, v TEXT);

-- دسترسی‌های مدیر منطقه که سرپرست مناطق می‌دهد (خالی = همه: fm,staff) و دوره‌های مدیریت هر منطقه
ALTER TABLE users ADD COLUMN perms TEXT;
CREATE TABLE IF NOT EXISTS region_terms (id INTEGER PRIMARY KEY, region_id INTEGER NOT NULL, user_id INTEGER NOT NULL, name TEXT, start INTEGER NOT NULL, end INTEGER, by INTEGER);
CREATE INDEX IF NOT EXISTS region_terms_r ON region_terms (region_id, start);

-- گزارش روزانه‌ی حوزه‌ها، ارزشیابی‌ها، آمار لحظه‌ای ورودی‌ها و اجرای برنامه‌ی غذایی
ALTER TABLE users ADD COLUMN scope TEXT;
ALTER TABLE entries ADD COLUMN rooms INTEGER;
ALTER TABLE entries ADD COLUMN beds INTEGER;
CREATE TABLE IF NOT EXISTS evals (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, ref_id INTEGER NOT NULL, region_id INTEGER, name TEXT, answers TEXT, score INTEGER, note TEXT, by INTEGER, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS evals_ref ON evals (kind, ref_id);
CREATE TABLE IF NOT EXISTS daily_reports (region_id INTEGER NOT NULL, day TEXT NOT NULL, domain TEXT NOT NULL, status TEXT, text TEXT, user_id INTEGER, updated INTEGER NOT NULL, PRIMARY KEY (region_id, day, domain));
CREATE INDEX IF NOT EXISTS daily_day ON daily_reports (day);
CREATE TABLE IF NOT EXISTS entry_occ (entry_id INTEGER PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE, pilgrims INTEGER, rooms INTEGER, beds INTEGER, note TEXT, user_id INTEGER, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS occ_log (id INTEGER PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE, pilgrims INTEGER, rooms INTEGER, beds INTEGER, note TEXT, user_id INTEGER, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS occ_log_e ON occ_log (entry_id, t);
CREATE TABLE IF NOT EXISTS entry_food (entry_id INTEGER PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE, plan_id TEXT, user_id INTEGER, updated INTEGER);
CREATE TABLE IF NOT EXISTS meal_checks (entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE, day TEXT NOT NULL, meal TEXT NOT NULL, items TEXT NOT NULL, note TEXT, user_id INTEGER, updated INTEGER NOT NULL, PRIMARY KEY (entry_id, day, meal));
CREATE INDEX IF NOT EXISTS meal_day ON meal_checks (day);

-- تکمیل اطلاعات هتل‌های اپ توسط مدیران ثابت (پیشنهاد ← تأیید در پنل مدیریت)
CREATE TABLE IF NOT EXISTS hotel_sug (id INTEGER PRIMARY KEY, hotel_id TEXT NOT NULL, city TEXT, hotel_name TEXT, field TEXT NOT NULL, value TEXT, note TEXT, user_id INTEGER, user_name TEXT, region_id INTEGER, status TEXT NOT NULL DEFAULT 'pending', reason TEXT, reviewer TEXT, t INTEGER NOT NULL, rt INTEGER);
CREATE INDEX IF NOT EXISTS hotel_sug_h ON hotel_sug (hotel_id, status);
CREATE INDEX IF NOT EXISTS hotel_sug_s ON hotel_sug (status, t);
CREATE TABLE IF NOT EXISTS hsug_photo (sug_id INTEGER PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hotel_link (region_id INTEGER NOT NULL, hotel TEXT NOT NULL, hotel_id TEXT NOT NULL, user_id INTEGER, t INTEGER, PRIMARY KEY (region_id, hotel));
CREATE TABLE IF NOT EXISTS hotel_confirm (id INTEGER PRIMARY KEY, hotel_id TEXT NOT NULL, ok INTEGER NOT NULL, note TEXT, user_id INTEGER, user_name TEXT, t INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS hotel_confirm_h ON hotel_confirm (hotel_id, t);
