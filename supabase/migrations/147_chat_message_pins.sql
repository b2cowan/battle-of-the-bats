-- 146_chat_message_pins.sql
-- Pinned messages for Tournament Chat (Phase 3B). A message is "pinned" when pinned_at IS NOT NULL;
-- multiple messages may be pinned per room. Pinning is a MODERATOR action performed via the service
-- role: the column-scoped `authenticated` UPDATE grant on chat_messages is limited to
-- (deleted_at, deleted_by_user_id), so browsers CANNOT write pinned_* — only the server can.
-- Pin/unpin is an UPDATE on chat_messages, so it propagates live on the existing realtime publication
-- (REPLICA IDENTITY FULL already set in mig 141) — no new published table, no proving-slice change.
--
-- Idempotent + additive: safe to re-run; no data backfill; zero risk to existing code (columns are
-- dormant until the Phase 3B pinned UI ships).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'pinned_at'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD COLUMN pinned_at timestamptz,
      ADD COLUMN pinned_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Fast lookup of a room's current pins (the pinned-banner query).
CREATE INDEX IF NOT EXISTS chat_messages_pinned_idx
  ON public.chat_messages (room_id, pinned_at DESC)
  WHERE pinned_at IS NOT NULL;
