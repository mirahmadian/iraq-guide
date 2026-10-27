CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  h TEXT NOT NULL,            -- cityId/hotelId
  dev TEXT NOT NULL,          -- hash of the device id
  stars INTEGER NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  ts INTEGER NOT NULL,
  hidden TEXT,                -- null = visible; 'ai' | 'reports' | 'admin'
  why TEXT,
  reports INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',  -- optional display name
  UNIQUE (h, dev)
);
CREATE INDEX IF NOT EXISTS reviews_h ON reviews (h, hidden, ts);
CREATE TABLE IF NOT EXISTS reports (rid INTEGER NOT NULL, dev TEXT NOT NULL, PRIMARY KEY (rid, dev));
CREATE TABLE IF NOT EXISTS hits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS devices (
  dev TEXT PRIMARY KEY,       -- hash of the device id
  first INTEGER NOT NULL,     -- first time the app was opened
  last INTEGER NOT NULL,      -- last heartbeat
  inst INTEGER NOT NULL DEFAULT 0,  -- ever opened as an installed app
  inst_first INTEGER,
  plat TEXT, city TEXT
);
CREATE INDEX IF NOT EXISTS devices_last ON devices (last);
CREATE TABLE IF NOT EXISTS staff (
  user TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL,
  perms TEXT NOT NULL DEFAULT '[]', active INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL, last_login INTEGER,
  must_change INTEGER NOT NULL DEFAULT 0,  -- temporary password set by the owner
  reset_req INTEGER                       -- «forgot password» request time
);
CREATE TABLE IF NOT EXISTS sessions (tok TEXT PRIMARY KEY, user TEXT NOT NULL, exp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL);
