CREATE TABLE cloud_receipts (event_id TEXT PRIMARY KEY NOT NULL REFERENCES punches(event_id), confirmed_at INTEGER NOT NULL);
CREATE TABLE cloud_workers (local_id TEXT PRIMARY KEY NOT NULL REFERENCES workers(id), remote_id TEXT NOT NULL UNIQUE);
