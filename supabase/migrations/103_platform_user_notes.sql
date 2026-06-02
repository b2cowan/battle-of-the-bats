-- Platform-admin support notes attached to a specific auth user.
-- Accessed only via service role in platform-admin API routes.

CREATE TABLE platform_user_notes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body              text        NOT NULL CHECK (char_length(body) <= 4000),
  created_by_email  text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_user_notes_user_idx
  ON platform_user_notes(user_id, created_at DESC);

ALTER TABLE platform_user_notes ENABLE ROW LEVEL SECURITY;
-- No public policies — service role bypasses RLS; no customer-facing access needed.
