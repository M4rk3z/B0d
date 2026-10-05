CREATE TABLE IF NOT EXISTS b0d_devices (
 id UUID PRIMARY KEY,
 name VARCHAR(80) NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 last_seen TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS b0d_device_workers (
 device_id UUID NOT NULL REFERENCES b0d_devices(id),
 local_id UUID NOT NULL,
 worker_id UUID NOT NULL REFERENCES b0d_workers(id),
 PRIMARY KEY(device_id,local_id)
);
CREATE TABLE IF NOT EXISTS b0d_punches (
 event_id UUID PRIMARY KEY,
 worker_id UUID NOT NULL REFERENCES b0d_workers(id),
 device_id UUID NOT NULL REFERENCES b0d_devices(id),
 worker_code VARCHAR(20) NOT NULL,
 worker_name VARCHAR(100) NOT NULL,
 kind VARCHAR(16) NOT NULL CHECK(kind IN ('IN','OUT','BREAK_START','BREAK_END')),
 occurred_at BIGINT NOT NULL,
 zone_id VARCHAR(100) NOT NULL,
 method VARCHAR(10) NOT NULL CHECK(method IN ('manual','facial')),
 action VARCHAR(8) CHECK(action IN ('IN','OUT','MEAL','REST')),
 received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS b0d_punches_time ON b0d_punches(occurred_at,event_id);
INSERT INTO b0d_schema_version VALUES(3) ON CONFLICT DO NOTHING;
