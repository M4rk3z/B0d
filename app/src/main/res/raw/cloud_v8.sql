CREATE TABLE cloud_assignments (remote_id TEXT PRIMARY KEY NOT NULL, local_date TEXT NOT NULL);
CREATE TABLE cloud_schedule_names (local_id TEXT PRIMARY KEY NOT NULL REFERENCES schedules(id), display_name TEXT NOT NULL);
