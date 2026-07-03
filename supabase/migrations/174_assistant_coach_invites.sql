-- Assistant Coaches Phase 2 — head-coach "invite an assistant" flow.
--
-- assistant_invite_tokens: a team-scoped, single-use invite the head coach mints. The raw token
-- lives ONLY in the emailed URL; we store its SHA-256 hash (same posture as tryout offer/evaluator
-- tokens). On accept the assistant gets a minimal `coach`-role org membership + a rep_team_coaches
-- assistant_coach row. Service-role mediated only (RLS enabled, NO policies — the anon/authenticated
-- client can never read invite tokens directly).
CREATE TABLE IF NOT EXISTS assistant_invite_tokens (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id               uuid NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  program_year_id       uuid NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  invited_by_user_id    uuid NOT NULL,
  invited_email         text NOT NULL,
  token_hash            text NOT NULL,
  -- pending_approval: club requires admin approval before the invite email goes out.
  -- pending: emailed, awaiting the assistant to accept. accepted/expired/revoked: terminal.
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending_approval','pending','accepted','expired','revoked')),
  -- Optional initial duty grants the head coach chose at invite time (null = least-privilege defaults).
  initial_capabilities  jsonb,
  invited_by_name       text,
  team_name             text,
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS assistant_invite_tokens_token_hash_uq
  ON assistant_invite_tokens (token_hash);
-- Look up outstanding invites for a team (manage panel) + by email (dedupe / reconcile).
CREATE INDEX IF NOT EXISTS assistant_invite_tokens_team_idx
  ON assistant_invite_tokens (team_id, status);
CREATE INDEX IF NOT EXISTS assistant_invite_tokens_email_idx
  ON assistant_invite_tokens (lower(invited_email), status);

-- FK on the inviter (auth-schema; matches the rep_* pattern). Idempotent so this migration is safe
-- to re-apply to an already-created table. CASCADE: deleting a coach account drops their stale invites.
ALTER TABLE assistant_invite_tokens
  DROP CONSTRAINT IF EXISTS assistant_invite_tokens_invited_by_fk;
ALTER TABLE assistant_invite_tokens
  ADD CONSTRAINT assistant_invite_tokens_invited_by_fk
  FOREIGN KEY (invited_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE assistant_invite_tokens ENABLE ROW LEVEL SECURITY;

-- Per-org coach settings (jsonb, mirrors organizations.pdf_settings). Currently:
--   require_assistant_approval (bool, default false) — a club admin must approve an assistant
--   before the invite email is sent. Absent/false = head coach invites self-serve.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS coach_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
