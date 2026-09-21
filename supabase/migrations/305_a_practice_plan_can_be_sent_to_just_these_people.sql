-- Migration 305: a practice plan can be sent to just these people.
-- (Owner ask 2026-09-20: "sometimes they send to one assistant to review and update before
-- sending to the broader group.")
--
-- "Send to staff" (mig 303) offered three GROUPS — named in this plan · coaches and helpers ·
-- everyone on staff — and stamped the practice with which one and how many. A fourth option,
-- "Just these people", lets the coach tick names. Two changes to the stamp:
--
--   1. The audience CHECK admits 'chosen'. The constraint was declared inline in 303, so it
--      carries Postgres's generated name; dropped by that name and re-added with it.
--   2. `practice_plan_sent_to` records WHO the send reached (user ids), for every audience, so a
--      hand-pick's sent line can name them — "Sent to Jen Okafor" — rather than hide one person
--      inside a count. No FK: it is a record of a past act, and a departed account should not
--      block a delete nor rewrite history; the reader resolves ids against the current staff and
--      falls back to the count when one no longer resolves. NULL on every stamp written before
--      this migration (the app reads NULL as an empty list).
--
-- Additive-only; no backfill.

ALTER TABLE public.rep_team_events
  DROP CONSTRAINT IF EXISTS rep_team_events_practice_plan_sent_audience_check;
ALTER TABLE public.rep_team_events
  ADD CONSTRAINT rep_team_events_practice_plan_sent_audience_check
  CHECK (practice_plan_sent_audience IN ('named', 'coaches', 'staff', 'chosen'));

ALTER TABLE public.rep_team_events
  ADD COLUMN IF NOT EXISTS practice_plan_sent_to uuid[];

COMMENT ON COLUMN public.rep_team_events.practice_plan_sent_to IS
  'Who the last Send to staff reached — user ids, every audience (mig 305). No FK: a record of a past act. NULL on stamps from before the column.';
COMMENT ON COLUMN public.rep_team_events.practice_plan_sent_at IS
  'When the practice plan was last sent to the staff (Send to staff) — the last send only, with _by, _audience (named | coaches | staff | chosen), _count, _email and _to beside it.';
