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
