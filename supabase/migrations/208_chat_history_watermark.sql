-- Migration 208: per-member chat history watermark (staff rooms / Coach Chat Project 2A)
--
-- Owner ruling CH-5 (amended 2026-07-29): in a team STAFF room, nobody inherits history — every
-- member (a replacement head coach included) sees messages only from the moment they were seated.
--
-- Mechanism: chat_room_members.history_visible_from (timestamptz, nullable).
--   • NULL  → full history (every existing row; tournament rooms NEVER set it — their shipped
--             full-history-on-join behaviour is unchanged).
--   • set   → the member's messages view starts at that instant. The staff-room membership sync
--             stamps it when a seat is created or re-activated (a returning member sees from the
--             most recent join, not the first).
--
-- Enforced IN RLS, not just app code: the app's history fetch runs service-role (and filters in
-- code), but a browser can also query chat_messages directly with its own JWT and subscribes to the
-- realtime feed — without the predicate here, either path would leak pre-join messages. Realtime
-- INSERT events are unaffected in practice (a new message's sent_at is always >= any live member's
-- watermark).
--
-- The moderator UPDATE policy gets the same predicate: a new head coach moderates only what they
-- can see (approved spec: "moderates only what they can see").
--
-- Re-runnable (IF NOT EXISTS / DROP POLICY IF EXISTS). DEPLOY: dev-first; apply to prod BEFORE
-- promoting the staff-room code (check:migrations gates the release).

ALTER TABLE public.chat_room_members
  ADD COLUMN IF NOT EXISTS history_visible_from timestamptz;

-- ── chat_messages SELECT: membership + watermark ────────────────────────────
DROP POLICY IF EXISTS chat_messages_select_member ON public.chat_messages;
CREATE POLICY chat_messages_select_member ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.room_id = chat_messages.room_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND (m.history_visible_from IS NULL OR chat_messages.sent_at >= m.history_visible_from)
    )
  );

-- ── chat_messages moderator UPDATE: same visibility bound ───────────────────
DROP POLICY IF EXISTS chat_messages_update_moderator ON public.chat_messages;
CREATE POLICY chat_messages_update_moderator ON public.chat_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.room_id = chat_messages.room_id
        AND m.user_id = auth.uid()
        AND m.member_role = 'moderator'
        AND m.status = 'active'
        AND (m.history_visible_from IS NULL OR chat_messages.sent_at >= m.history_visible_from)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_room_members m
      WHERE m.room_id = chat_messages.room_id
        AND m.user_id = auth.uid()
        AND m.member_role = 'moderator'
        AND m.status = 'active'
        AND (m.history_visible_from IS NULL OR chat_messages.sent_at >= m.history_visible_from)
    )
  );
