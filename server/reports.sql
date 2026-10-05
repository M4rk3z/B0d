CREATE TABLE IF NOT EXISTS b0d_shift_contexts (
 event_id UUID PRIMARY KEY REFERENCES b0d_punches(event_id),
 context JSONB NOT NULL
);
INSERT INTO b0d_schema_version VALUES(9) ON CONFLICT DO NOTHING;
