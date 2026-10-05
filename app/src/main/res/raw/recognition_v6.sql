ALTER TABLE face_profiles ADD COLUMN encrypted_template BLOB;
ALTER TABLE face_profiles ADD COLUMN template_model TEXT;
CREATE TEMP TABLE saved_contexts AS SELECT * FROM shift_contexts;
DROP TABLE shift_contexts;
CREATE TABLE punches_v6 (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
    worker_code TEXT NOT NULL,
    worker_name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('IN','OUT','BREAK_START','BREAK_END')),
    occurred_at INTEGER NOT NULL,
    zone_id TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'manual' CHECK(method IN ('manual','facial'))
);
INSERT INTO punches_v6 SELECT * FROM punches;
DROP TABLE punches;
ALTER TABLE punches_v6 RENAME TO punches;
CREATE INDEX punches_worker ON punches(worker_id, seq);
CREATE TABLE shift_contexts (
    entry_seq INTEGER PRIMARY KEY REFERENCES punches(seq) ON DELETE RESTRICT,
    schedule_id TEXT REFERENCES schedules(id) ON DELETE RESTRICT,
    work_date TEXT NOT NULL,
    zone_id TEXT NOT NULL
);
INSERT INTO shift_contexts SELECT * FROM saved_contexts;
DROP TABLE saved_contexts;
CREATE TABLE facial_punch_details (
    seq INTEGER PRIMARY KEY REFERENCES punches(seq) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK(action IN ('IN','OUT','MEAL','REST')),
    score REAL NOT NULL CHECK(score >= 0 AND score <= 1),
    model TEXT NOT NULL
);
