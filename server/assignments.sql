CREATE TABLE IF NOT EXISTS b0d_schedule_assignments (
 id UUID PRIMARY KEY,
 worker_id UUID NOT NULL REFERENCES b0d_workers(id),
 schedule_id UUID NOT NULL,
 revision INTEGER NOT NULL,
 effective_date DATE NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(worker_id,effective_date),
 FOREIGN KEY(schedule_id,revision) REFERENCES b0d_schedule_versions(schedule_id,revision)
);
INSERT INTO b0d_schema_version VALUES(7) ON CONFLICT DO NOTHING;
