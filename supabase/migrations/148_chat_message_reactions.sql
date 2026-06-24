-- 148_chat_message_reactions.sql
-- Emoji reactions for Tournament Chat (Phase 3C). A reaction = one (message, user, emoji) tuple from
-- a FIXED seven-emoji set. This is the chat program's SECOND realtime-published table (after
-- chat_messages), so it repeats the make-or-break engine discipline:
--   • REPLICA IDENTITY FULL is set BEFORE the table joins the supabase_realtime publication
--     (the games realtime lesson, migs 130/132).
--   • Membership-based RLS is RE-PROVEN on the live dev DB by scripts/validate-chat-slice.mjs (the
--     "RLS realtime is a silent no-op" risk) BEFORE any reaction UI ships.
--
-- WRITE PATH — deliberately TIGHTER than chat_messages: reactions have NO legitimate direct-client
-- write path, so `authenticated` is granted SELECT ONLY. Every add/remove goes through the audited
-- server route running as the service role (which enforces membership / mute / rate-limit). A browser
-- therefore cannot write this table at all — there is no spoof/escalate surface to column-scope. The
-- RLS SELECT policy (active member of the reaction's room) is what realtime delivery authorization
-- rides, so it is the one rule that must be exactly right; the proving slice hammers it (live delivery
-- to members, silence + zero rows to non-members/removed) and asserts the write-lock.
--
-- room_id is DENORMALIZED onto each reaction (copied from the message at insert time) so the RLS
-- SELECT policy — and thus realtime authorization — gates on room membership DIRECTLY, exactly like
-- chat_messages, with no join back through chat_messages. Cheaper to evaluate and mirrors the proven
-- pattern (chat_messages also carries room_id for precisely this reason).
--
-- SOFT-DELETE, NOT HARD DELETE (a spike finding — see scripts/validate-chat-slice.mjs): un-reacting
-- sets `removed_at`, it does NOT DELETE the row. Supabase Realtime `postgres_changes` does NOT enforce
-- RLS on hard-DELETE events — the old row is PK-only, the membership subquery can't be evaluated, and
-- delivery fails OPEN, so a non-member who knows the room id would receive the DELETE event. That is
-- exactly why the engine soft-deletes messages too (chat_messages never hard-deletes, so it never hit
-- this). Soft-deleting reactions keeps EVERY reaction event an INSERT or UPDATE — both carry the full
-- new row, so the room_id filter + RLS evaluate correctly and non-members get NOTHING. Re-reacting the
-- same (message,user,emoji) revives the row (UPDATE removed_at = NULL) rather than inserting a
-- duplicate, so the UNIQUE constraint holds. The active set is `removed_at IS NULL`.
--
-- REPLICA IDENTITY FULL is still set (kept consistent with chat_messages and safe): with only
-- INSERT/UPDATE events in play, `new` is always complete, so the client always has message_id — it
-- treats any reaction event as a "re-pull this message's reaction summary" SIGNAL (re-queries counts
-- server-side), the same refresh-on-event pattern the pinned banner uses for pin/unpin.
--
-- Idempotent + additive: safe to re-run; no backfill; dormant until the Phase 3C reactions UI ships.

-- ── Table ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES public.chat_rooms(id)    ON DELETE CASCADE,
  message_id  uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  emoji       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  removed_at  timestamptz,  -- soft-delete (un-react); active reaction = removed_at IS NULL
  -- Fixed reaction set (owner decision 2026-06-22). Mirrored by the canonical list in
  -- lib/chat-reactions.ts; this CHECK is the DB backstop against an off-set value.
  CONSTRAINT chat_message_reactions_emoji_check
    CHECK (emoji IN ('👍', '👎', '❤️', '✅', '😂', '🎉', '🙏')),
  -- One physical row per (message,user,emoji) — toggled via removed_at, never duplicated. Supports
  -- both single-choice and multi-emoji reaction models; the server route decides which.
  CONSTRAINT chat_message_reactions_unique UNIQUE (message_id, user_id, emoji)
);

-- Belt-and-suspenders for re-applying over a table that predates removed_at: the dev table was first
-- created without this column (early in the spike), so CREATE TABLE IF NOT EXISTS would skip it there.
-- On a FRESH apply (e.g. prod) the CREATE TABLE above already includes removed_at and this ALTER is a
-- harmless no-op. Keep BOTH — do not drop the column from CREATE TABLE assuming this ALTER covers it.
ALTER TABLE public.chat_message_reactions ADD COLUMN IF NOT EXISTS removed_at timestamptz;

-- ── Indexes ─────────────────────────────────────────────────────────────────
-- Per-message lookup (the reaction-summary query for a loaded window) + per-room (RLS subquery / room
-- teardown). The UNIQUE constraint already indexes (message_id, user_id, emoji).
CREATE INDEX IF NOT EXISTS chat_message_reactions_message_idx
  ON public.chat_message_reactions (message_id);
CREATE INDEX IF NOT EXISTS chat_message_reactions_room_idx
  ON public.chat_message_reactions (room_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- SELECT = active member of the reaction's room (same membership key as chat_messages, evaluated on
-- the denormalized room_id so it does not recurse and so realtime can authorize each row cheaply).
-- No INSERT/UPDATE/DELETE policy: writes are service-role only (the grant below denies them anyway).

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_message_reactions_select_member ON public.chat_message_reactions;
CREATE POLICY chat_message_reactions_select_member ON public.chat_message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.room_id = chat_message_reactions.room_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

-- ── Grants ──────────────────────────────────────────────────────────────────
-- SELECT only for `authenticated` (so the browser can read reactions + receive them live); every
-- write is the service role via the server route. REVOKE makes this safe to re-apply over any earlier
-- blanket grant (REVOKE of an absent priv is a harmless no-op). No grants to `anon`.

REVOKE INSERT, UPDATE, DELETE ON public.chat_message_reactions FROM authenticated;
GRANT  SELECT                  ON public.chat_message_reactions TO   authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────
-- ORDER MATTERS: REPLICA IDENTITY FULL must be set BEFORE adding the table to the publication.

DO $$
BEGIN
  IF (SELECT relreplident FROM pg_class WHERE oid = 'public.chat_message_reactions'::regclass) <> 'f' THEN
    ALTER TABLE public.chat_message_reactions REPLICA IDENTITY FULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
  END IF;
END $$;
