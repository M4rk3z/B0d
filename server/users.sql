CREATE TABLE IF NOT EXISTS b0d_users (
    id UUID PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    role VARCHAR(5) NOT NULL CHECK(role IN ('Admin', 'User')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    salt CHAR(32) NOT NULL,
    password_hash CHAR(64) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS b0d_users_username ON b0d_users(lower(username));
ALTER TABLE b0d_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES b0d_users(id);
DELETE FROM b0d_sessions WHERE user_id IS NULL;
ALTER TABLE b0d_sessions ALTER COLUMN user_id SET NOT NULL;
INSERT INTO b0d_schema_version VALUES (2) ON CONFLICT DO NOTHING;
