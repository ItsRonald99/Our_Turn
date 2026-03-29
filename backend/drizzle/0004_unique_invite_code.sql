-- Enforce uniqueness of invite codes at the DB level.
-- SQLite does not support ADD CONSTRAINT on existing columns, so we use a unique index instead.
-- NULL values are treated as distinct in SQLite unique indexes, so existing rows with no invite
-- code remain valid until they are regenerated.
CREATE UNIQUE INDEX IF NOT EXISTS houses_invite_code_unique ON houses(invite_code);
