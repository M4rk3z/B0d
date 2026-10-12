CREATE TABLE IF NOT EXISTS b0d_face_profiles(
 worker_id UUID PRIMARY KEY REFERENCES b0d_workers(id),revision UUID NOT NULL,
 encrypted_samples TEXT,deleted BOOLEAN NOT NULL DEFAULT FALSE,captured_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS b0d_face_challenges(
 id UUID PRIMARY KEY,worker_id UUID NOT NULL REFERENCES b0d_workers(id),user_id UUID NOT NULL REFERENCES b0d_users(id),
 poses JSONB NOT NULL,expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS b0d_device_faces(
 device_id UUID NOT NULL REFERENCES b0d_devices(id),worker_id UUID NOT NULL REFERENCES b0d_workers(id),
 present BOOLEAN NOT NULL,samples INTEGER NOT NULL,revision UUID,error TEXT,updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(device_id,worker_id));
