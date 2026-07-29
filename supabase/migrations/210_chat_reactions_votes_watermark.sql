-- Migration 209: extend the mig-208 history watermark to reaction + poll-vote reads
--
-- Review finding (2026-07-29, staff-room adversarial review): mig 208 watermarked chat_messages
-- SELECT, but chat_message_reactions / chat_poll_votes kept membership-only SELECT policies — so a
-- watermarked staff-room member could read every reaction/vote row for PRE-JOIN messages (who
-- reacted what, who voted what) via a direct PostgREST query or the live realtime feed on those
-- tables, defeating CH-5 ("nobody inherits history") at the metadata layer.
--
-- Fix: a reaction/vote row is visible only if its TARGET MESSAGE is visible to the member — the
-- same membership + watermark predicate as chat_messages, joined through the target's sent_at.
-- For every NULL-watermark member (all tournament rooms, all pre-existing members) the added
-- clause is a tautology: behavior unchanged. Realtime events on both tables are gated by these
-- SELECT policies, so the live feed is covered too.
--
-- (Deliberately restated as an explicit join rather than subquerying chat_messages under its own
-- policy — same predicate, no nested policy evaluation, and immune to future chat_messages policy
-- reshuffles.) Re-runnable. DEPLOY: dev-first; prod with migs 205–208 before the code promotes.

DROP POLICY IF EXISTS chat_message_reactions_select_member ON public.chat_message_reactions;
CREATE POLICY chat_message_reactions_select_member ON public.chat_message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.chat_room_members m
      JOIN public.chat_messages msg ON msg.id = chat_message_reactions.message_id
      WHERE m.room_id = chat_message_reactions.room_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND msg.room_id = chat_message_reactions.room_id
        AND (m.history_visible_from IS NULL OR msg.sent_at >= m.history_visible_from)
    )
  );

DROP POLICY IF EXISTS chat_poll_votes_select_member ON public.chat_poll_votes;
CREATE POLICY chat_poll_votes_select_member ON public.chat_poll_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.chat_room_members m
      JOIN public.chat_messages msg ON msg.id = chat_poll_votes.message_id
      WHERE m.room_id = chat_poll_votes.room_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND msg.room_id = chat_poll_votes.room_id
        AND (m.history_visible_from IS NULL OR msg.sent_at >= m.history_visible_from)
    )
  );
