CREATE TABLE IF NOT EXISTS b0d_schedules (
 id UUID PRIMARY KEY,
 revision INTEGER NOT NULL CHECK(revision>0),
 definition JSONB NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS b0d_schedule_versions (
 schedule_id UUID NOT NULL REFERENCES b0d_schedules(id),
 revision INTEGER NOT NULL,
 definition JSONB NOT NULL,
 actor_id UUID NOT NULL REFERENCES b0d_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(schedule_id,revision)
);
INSERT INTO b0d_schema_version VALUES(6) ON CONFLICT DO NOTHING;
