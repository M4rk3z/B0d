CREATE TABLE schedules (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 80),
    mark_breaks INTEGER NOT NULL CHECK(mark_breaks IN (0,1)),
    zone_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE TABLE schedule_days (
    schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT,
    weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7),
    start_minute INTEGER NOT NULL CHECK(start_minute BETWEEN 0 AND 1439),
    end_minute INTEGER NOT NULL CHECK(end_minute > start_minute AND end_minute < start_minute + 1440),
    PRIMARY KEY(schedule_id, weekday)
);
CREATE TABLE schedule_breaks (
    schedule_id TEXT NOT NULL,
    weekday INTEGER NOT NULL,
    start_offset INTEGER NOT NULL CHECK(start_offset >= 0),
    end_offset INTEGER NOT NULL CHECK(end_offset > start_offset),
    PRIMARY KEY(schedule_id, weekday, start_offset),
    FOREIGN KEY(schedule_id, weekday) REFERENCES schedule_days(schedule_id, weekday) ON DELETE RESTRICT
);
CREATE TABLE schedule_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE RESTRICT,
    schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT,
    effective_date TEXT NOT NULL CHECK(length(effective_date) = 10),
    created_at INTEGER NOT NULL,
    UNIQUE(worker_id, effective_date)
);
CREATE INDEX assignments_worker_date ON schedule_assignments(worker_id, effective_date);
