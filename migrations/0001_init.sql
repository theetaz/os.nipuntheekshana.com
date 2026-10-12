CREATE TABLE postcards (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 300),
  email TEXT,
  color TEXT NOT NULL CHECK (color IN ('paper', 'thambili', 'lagoon', 'lotus', 'tea')),
  font TEXT NOT NULL CHECK (font IN ('sans', 'serif', 'handwriting')),
  rotation REAL NOT NULL CHECK (rotation BETWEEN -4 AND 4),
  country TEXT,
  ip_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('published', 'pending', 'hidden'))
);
CREATE INDEX postcards_by_status_time ON postcards (status, created_at DESC, id DESC);
CREATE INDEX postcards_by_ip_day ON postcards (ip_hash, created_at);
CREATE TABLE ai_usage (
  day TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, ip_hash)
);
