CREATE TABLE face_profiles (
    worker_id TEXT NOT NULL PRIMARY KEY REFERENCES workers(id) ON DELETE CASCADE,
    encrypted_photo BLOB NOT NULL,
    captured_at INTEGER NOT NULL,
    format_version INTEGER NOT NULL CHECK (format_version = 1)
);
