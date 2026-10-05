CREATE TABLE punches (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
    worker_code TEXT NOT NULL,
    worker_name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('IN', 'OUT')),
    occurred_at INTEGER NOT NULL,
    zone_id TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'manual' CHECK(method = 'manual')
);
CREATE INDEX punches_worker ON punches(worker_id, seq);
CREATE TABLE deleted_workers (
    worker_id TEXT PRIMARY KEY NOT NULL,
    worker_code TEXT NOT NULL,
    deleted_at INTEGER NOT NULL,
    actor TEXT NOT NULL
);
