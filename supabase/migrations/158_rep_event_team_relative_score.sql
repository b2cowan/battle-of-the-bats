-- 158_rep_event_team_relative_score.sql
-- Rep game scoring is team-relative in practice (the app derives result as if the coach's
-- team is always "home"), but the columns were labelled home/away — ambiguous, and away
-- games could record backwards. Rename to make the semantics explicit and enable reliable
-- home/away record splits via the separate `home_away` context tag.
-- See docs/agents/db/DB_ARCHITECTURE_REVIEW.md Finding #27.
-- A column RENAME preserves existing values + nullability (no backfill). Scoped to
-- rep_team_events ONLY — tournament `games` and `league_games` keep true home/away scoring.

ALTER TABLE rep_team_events RENAME COLUMN home_score TO team_score;
ALTER TABLE rep_team_events RENAME COLUMN away_score TO opponent_score;
