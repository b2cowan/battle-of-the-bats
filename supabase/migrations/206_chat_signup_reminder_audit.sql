-- 206 — Chat sign-up reminder: cooldown + audit trail
--
-- The tournament dashboard's "Coach Sign-ups & Chat" panel can batch-email every not-yet-joined
-- team's coach with one click. Until now that send had NO brake and left NO record: an organizer
-- could click four times and mail the same coaches four identical access links, and nothing
-- anywhere recorded that a reminder had ever been sent, by anyone, for any event.
--
-- Owner decisions 2026-07-29 (Coach Chat program, Step 1):
--   S1-A — the button stands down for 24h, counted PER TOURNAMENT (not per coach, not per sender)
--          so two co-organizers on the same event cannot double up on each other.
--   S1-B — persist when the last reminder went out, who sent it, and how many teams it reached.
--
-- Deliberately on `tournaments` rather than a new table: the cooldown is a per-event scalar and
-- the "last send" is the only state either the gate or the panel needs. A full per-recipient send
-- log is a different (heavier) feature — see the plan's per-coach alternative, not built.
--
-- Mirrors the existing reminder-tracking shape already used for rep dues installments
-- (`reminder_sent_at`), so the pattern stays recognizable.

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS chat_reminder_last_sent_at    timestamptz,
  ADD COLUMN IF NOT EXISTS chat_reminder_last_sent_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chat_reminder_last_sent_count integer;

COMMENT ON COLUMN public.tournaments.chat_reminder_last_sent_at IS
  'When the chat sign-up reminder was last batch-sent for this tournament. Drives the 24h per-tournament cooldown on the dashboard Coach Sign-ups & Chat panel (owner decision S1-A, 2026-07-29). NULL = never sent.';

COMMENT ON COLUMN public.tournaments.chat_reminder_last_sent_by IS
  'auth.users id of the organizer who last batch-sent the chat sign-up reminder. Audit only — the cooldown is per tournament, not per sender. ON DELETE SET NULL so removing a staff account never blocks the gate.';

COMMENT ON COLUMN public.tournaments.chat_reminder_last_sent_count IS
  'How many teams the last chat sign-up reminder batch actually reached (successful sends only). Audit context for "you reminded 6 teams 3 hours ago".';
