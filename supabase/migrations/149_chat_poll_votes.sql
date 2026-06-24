-- 148_chat_poll_votes.sql
-- Poll votes for Tournament Chat (Phase 3C). A poll is a CHAT MESSAGE whose metadata carries the
-- question's options + settings (multiple-choice, anonymous, closed_at) — so creating and closing a
-- poll ride the EXISTING chat_messages realtime (INSERT/UPDATE), with NO new table for the poll
-- definition (the same "ride metadata" path reply/mentions already use). The ONLY genuinely new
-- live-updating store is the VOTES — this table — which is the platform's THIRD realtime-published
-- table (after chat_messages and chat_message_reactions).
--
-- This table is a near-twin of chat_message_reactions (mig 147) and follows the same hard-won engine
-- discipline, RE-PROVEN on the live dev DB by scripts/validate-chat-slice.mjs BEFORE any poll UI:
--   • REPLICA IDENTITY FULL is set BEFORE the table joins the supabase_realtime publication
--     (the games realtime lesson, migs 130/132).
--   • Membership-based RLS, and it must not be a silent no-op (live tally to members, silence to
--     non-members/removed).
--
-- WRITE PATH — `authenticated` gets SELECT ONLY. Every cast/change/retract of a vote goes through the
-- audited server route as the service role (membership / mute / poll-open / single-vs-multi enforced
-- in code). A browser cannot write this table at all → no spoof/escalate surface.
--
-- SOFT-DELETE, NOT HARD DELETE (the mig-147 spike finding): changing or retracting a vote sets
-- `removed_at`; the row is never DELETEd. Supabase realtime does NOT RLS-gate hard-DELETE events
-- (PK-only old row → membership check fails OPEN → leaks to non-members). Keeping every vote event an
-- INSERT/UPDATE (full new row) makes the room_id filter + RLS evaluate correctly. Active vote =
-- `removed_at IS NULL`. Re-casting the same (message,option,user) revives the row.
--
-- room_id is DENORMALIZED onto each vote (copied from the poll message) so RLS / realtime gate on
-- membership DIRECTLY, exactly like chat_messages + chat_message_reactions, with no join back.
--
-- option_id references an option id stored in the poll message's metadata (a server-generated uuid);
-- there is intentionally NO FK to an options table (options live in metadata, validated server-side
-- at vote time). UNIQUE(message_id, option_id, user_id) = one vote per option per user; single-choice
-- polls are enforced by the server (it retracts the voter's other option-votes), multiple-choice
-- polls allow several — the schema supports BOTH; the poll's metadata flag decides which.
--
-- Idempotent + additive: safe to re-run; no backfill; dormant until the Phase 3C polls UI ships.

-- ── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_poll_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES public.chat_rooms(id)    ON DELETE CASCADE,
  message_id  uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  option_id   uuid NOT NULL,  -- an option id from the poll message's metadata (validated server-side; no FK)
  user_id     uuid NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  removed_at  timestamptz,    -- soft-delete (revote / un-vote); active vote = removed_at IS NULL
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- One physical row per (poll-message, option, user) — toggled via removed_at, never duplicated.
  CONSTRAINT chat_poll_votes_unique UNIQUE (message_id, option_id, user_id)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
-- Per-poll tally query (by message_id) + per-room (RLS subquery / room teardown).
CREATE INDEX IF NOT EXISTS chat_poll_votes_message_idx ON public.chat_poll_votes (message_id);
CREATE INDEX IF NOT EXISTS chat_poll_votes_room_idx    ON public.chat_poll_votes (room_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- SELECT = active member of the vote's room (same membership key as the rest of chat, evaluated on
-- the denormalized room_id so it does not recurse and realtime can authorize each row cheaply). No
-- INSERT/UPDATE/DELETE policy: writes are service-role only (the grant below denies them anyway).

ALTER TABLE public.chat_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_poll_votes_select_member ON public.chat_poll_votes;
CREATE POLICY chat_poll_votes_select_member ON public.chat_poll_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.room_id = chat_poll_votes.room_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

-- ── Grants ──────────────────────────────────────────────────────────────────
-- SELECT only for `authenticated` (read tallies + receive them live); every write is the service role.
-- REVOKE makes this safe to re-apply over any earlier blanket grant. No grants to `anon`.

REVOKE INSERT, UPDATE, DELETE ON public.chat_poll_votes FROM authenticated;
GRANT  SELECT                  ON public.chat_poll_votes TO   authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────
-- ORDER MATTERS: REPLICA IDENTITY FULL must be set BEFORE adding the table to the publication.

DO $$
BEGIN
  IF (SELECT relreplident FROM pg_class WHERE oid = 'public.chat_poll_votes'::regclass) <> 'f' THEN
    ALTER TABLE public.chat_poll_votes REPLICA IDENTITY FULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_poll_votes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_poll_votes;
  END IF;
END $$;
