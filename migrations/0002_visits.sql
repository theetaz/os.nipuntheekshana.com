CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
INSERT INTO counters (name, value) VALUES ('visits', 0);
CREATE TABLE visit_seen (day TEXT NOT NULL, ip_hash TEXT NOT NULL, PRIMARY KEY (day, ip_hash));
