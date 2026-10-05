CREATE TABLE workers (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(code) BETWEEN 1 AND 20),
    name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE worker_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK(action IN ('created', 'activated', 'deactivated')),
    actor TEXT NOT NULL,
    occurred_at INTEGER NOT NULL
);
CREATE INDEX worker_events_worker ON worker_events(worker_id, occurred_at);
