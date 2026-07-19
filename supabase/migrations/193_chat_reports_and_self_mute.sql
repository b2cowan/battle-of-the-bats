-- Migration 193: Chat moderation — member message reports + per-member self-mute
--
-- Unified Home IA Redesign, Phase 4 (Chat tab member inbox). Ships in the SAME release as the
-- consumer Chat inbox (Round 3 decision R3-2: the safety sheet is the launch bar for making chat
-- permanently discoverable). Two additive changes, no engine change:
--
--   1. chat_message_reports — a member long-presses a message -> "Report to organizers". The report
--      lands as a queue item in the organizers' EXISTING chat "Manage room" panel (moderation lives
--      where the organizer already moderates). Service-role only, same posture as fan_alert_prefs.
--
--   2. chat_room_members.notifications_muted_at — the member's own "Mute this room" toggle. This is
--      DISTINCT from muted_until (the organizer's post-blocking mute): self-mute silences pushes and
--      drops the room out of unread counts, but the member can still read AND post. Kept a separate
--      column precisely so a self-mute never blocks the member's own posting (postChatMessage only
--      checks muted_until). NULL = not self-muted; a timestamp = muted since then.
--
-- DEPLOY: dev-first, by hand via scripts/apply-migration-api.mjs (nothing runs migrations
-- automatically). Promote code that reads these only AFTER this is applied to prod (check:migrations
-- gates it). Same unit of work updates docs/agents/db/DATA_DICTIONARY.md + `npm run refresh:snapshots`.
-- Re-runnable (IF NOT EXISTS / idempotent).

-- ── 1. Self-mute column on the existing membership row ──────────────────────
-- No new grant: the column grant on chat_room_members stays UPDATE(last_read_at) only; self-mute is
-- written by the service role (like markRoomRead), so a member still can't flip it directly.

ALTER TABLE public.chat_room_members
  ADD COLUMN IF NOT EXISTS notifications_muted_at timestamptz;

COMMENT ON COLUMN public.chat_room_members.notifications_muted_at IS
  'The member''s OWN "Mute this room" toggle (Unified Home Phase 4 / R3-2). NULL = not muted; a '
  'timestamp = self-muted since then. Excludes the room from the member''s unread rollup + the Chat '
  'tab badge and suppresses its push fan-out. DISTINCT from muted_until (organizer post-block): a '
  'self-mute never blocks the member''s own posting — they keep read + post access, it just goes quiet.';

-- ── 2. Message reports (organizer moderation queue) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_message_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             uuid NOT NULL REFERENCES public.chat_rooms(id)    ON DELETE CASCADE,
  message_id          uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  -- Denormalized so the organizer queue scopes by org (and per-tournament via the room) without a join.
  org_id              uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reporter_user_id    uuid NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  -- Optional free-text; the R3-2 sheet is one-tap (no reason picker), so this is reserved for a future
  -- reason taxonomy and stays nullable.
  reason              text,
  status              text NOT NULL DEFAULT 'open',
  resolved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_message_reports_status_check CHECK (status IN ('open', 'actioned', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS chat_message_reports_room_status_idx ON public.chat_message_reports (room_id, status);
CREATE INDEX IF NOT EXISTS chat_message_reports_org_status_idx  ON public.chat_message_reports (org_id, status);
CREATE INDEX IF NOT EXISTS chat_message_reports_message_idx     ON public.chat_message_reports (message_id);

-- One OPEN report per member per message — a PARTIAL unique index, NOT a table-wide constraint, so that
-- after a report is resolved (dismissed/actioned) the same member can file a FRESH report on a
-- still-abusive message. A table-wide UNIQUE(message_id, reporter_user_id) would permanently consume the
-- pair and silently swallow every future re-report. createMessageReport relies on the 23505 here meaning
-- "you already have an OPEN report on this" (idempotent no-op). The DROP repairs any dev DB where an
-- earlier apply of this migration created the old table-wide constraint.
ALTER TABLE public.chat_message_reports DROP CONSTRAINT IF EXISTS chat_message_reports_msg_reporter_key;
CREATE UNIQUE INDEX IF NOT EXISTS chat_message_reports_open_uniq
  ON public.chat_message_reports (message_id, reporter_user_id) WHERE status = 'open';

COMMENT ON TABLE public.chat_message_reports IS
  'Member-filed reports on chat messages (Unified Home Phase 4 / R3-2). A member long-presses a '
  'message -> "Report to organizers"; the report surfaces in the organizer''s existing chat Manage '
  'panel (per room). Service-role only. status: open -> actioned (message removed) | dismissed.';

-- Service-role only, same posture as fan_alert_prefs (188) / fan_follows (186). PROD anon/authenticated
-- hold a DEFAULT SELECT grant on public tables, so RLS MUST be enabled to wall this off; enable with
-- ZERO policies — anon/authenticated resolve to 0 rows, supabaseAdmin (service_role) bypasses RLS.
-- Members file reports + organizers read/resolve them exclusively through service-role API routes.
-- Decide RLS state from live pg_class after apply, not from this comment.
ALTER TABLE public.chat_message_reports ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.chat_message_reports TO service_role;
