ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN recovery_key_cipher TEXT;
ALTER TABLE users ADD COLUMN recovery_key_iv TEXT;
ALTER TABLE users ADD COLUMN recovery_key_tag TEXT;
ALTER TABLE users ADD COLUMN recovery_key_bound_at TEXT;
ALTER TABLE users ADD COLUMN device_fingerprint TEXT;
