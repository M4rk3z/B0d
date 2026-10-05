CREATE TABLE punches_v4 (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
    worker_code TEXT NOT NULL,
    worker_name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('IN','OUT','BREAK_START','BREAK_END')),
    occurred_at INTEGER NOT NULL,
    zone_id TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'manual' CHECK(method = 'manual')
);
INSERT INTO punches_v4 SELECT seq,event_id,worker_id,worker_code,worker_name,kind,occurred_at,zone_id,method FROM punches;
DROP TABLE punches;
ALTER TABLE punches_v4 RENAME TO punches;
CREATE INDEX punches_worker ON punches(worker_id, seq);
CREATE TABLE shift_contexts (
    entry_seq INTEGER PRIMARY KEY REFERENCES punches(seq) ON DELETE RESTRICT,
    schedule_id TEXT REFERENCES schedules(id) ON DELETE RESTRICT,
    work_date TEXT NOT NULL,
    zone_id TEXT NOT NULL
);
