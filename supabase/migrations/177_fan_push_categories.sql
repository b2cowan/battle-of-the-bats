-- Fan push categories + tournament-wide (no-team) opt-in.
--
-- Backs the public "notification bell" (Rain Delay / Day-of Ops Phase A2): an anonymous fan
-- can opt into tournament-wide messages WITHOUT following a team, and can choose which
-- categories they receive. There is already ONE row per (endpoint, tournament_id)
-- (UNIQUE(endpoint, tournament_id)), so these flags live on that shared row — both the bell
-- and the per-team FollowAlertsToggle write the same row.
--
--   notify_messages — organizer announcements / day-of notices (rain delays). Tournament-wide;
--                     a no-team subscriber (team_id NULL) still receives these.
--   notify_scores   — game score alerts (+ the playoff-set / champions moments) for the
--                     followed team.
--
-- team_id becomes NULLABLE so a messages-only subscriber needs no team. Score alerts still
-- require a team: the score fan-out filters team_id IN (game's two teams), which naturally
-- excludes NULL (messages-only) rows.
--
-- Additive + idempotent. fan_push_subscriptions is EMPTY in dev AND prod, so no backfill is
-- needed; DEFAULT true keeps any future row's behavior equal to today's "a follower gets
-- everything". RLS/grants unchanged (RLS-enabled, zero policies — service-role only).
ALTER TABLE fan_push_subscriptions
  ADD COLUMN IF NOT EXISTS notify_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_scores   boolean NOT NULL DEFAULT true;

ALTER TABLE fan_push_subscriptions
  ALTER COLUMN team_id DROP NOT NULL;
