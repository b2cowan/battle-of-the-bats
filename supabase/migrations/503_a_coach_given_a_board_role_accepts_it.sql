-- Board Ready trust close-out 13, the last branch (owner ruling 2026-11-18; queue prompt P2b in
-- docs/projects/active/BOARD_READY_TRUST_FIX_PROMPTS.md).
--
-- A person who already COACHES in a club holds that club's capability-less `role = 'coach'` row (one row per person per
-- club, UNIQUE (organization_id, user_id)). Inviting them to a board role used to rewrite that row on the spot. Now the
-- board role WAITS on the row, beside their coaching, until they accept it on Home:
--
--   pending_role          the board role offered (an OrgRole other than coach/owner); NULL = nothing waiting
--   pending_capabilities  the access that comes with it (a volunteer's job; null for every other role)
--   pending_invited_at    when it was sent (refreshed by a resend)
--
-- Accept moves the three onto the row (role, capabilities) and clears them; decline and Cancel clear them and never
-- delete the coach row. A waiting board role holds its seat, as every pending invitation does.
--
-- Additive: three nullable columns and one CHECK; no data change. Idempotent.

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS pending_role text,
  ADD COLUMN IF NOT EXISTS pending_capabilities jsonb,
  ADD COLUMN IF NOT EXISTS pending_invited_at timestamptz;

-- Only a coach's row can hold a waiting board role, the role is never coach or owner, and it always has its date.
ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_pending_role_check;
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_pending_role_check CHECK (
    pending_role IS NULL
    OR (role = 'coach' AND pending_role NOT IN ('coach', 'owner') AND pending_invited_at IS NOT NULL)
  );

COMMENT ON COLUMN public.organization_members.pending_role IS
  'A board role offered to a club''s own coach, waiting for their yes on Home (trust close-out 13, P2b). NULL = none. Only on a role=coach row.';
COMMENT ON COLUMN public.organization_members.pending_capabilities IS
  'The access that comes with pending_role (a volunteer''s job keys; null otherwise). Moved onto capabilities on accept.';
COMMENT ON COLUMN public.organization_members.pending_invited_at IS
  'When pending_role was offered (refreshed by a resend). Set whenever pending_role is.';
