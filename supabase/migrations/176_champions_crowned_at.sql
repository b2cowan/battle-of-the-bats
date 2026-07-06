-- Champions "completion moment" — home hero Champions takeover + "Champions crowned" notification.
--
-- champions_crowned_at marks the FIRST time a tournament's playoffs became complete
-- (every playoff game terminal + a decided championship final). It is the one-time
-- idempotency guard for the fan + staff "Champions crowned" notification, so re-scoring
-- or reverting-and-re-completing a finished bracket never re-blasts. The public home
-- hero Champions takeover and the /champions recap page derive from the LIVE game state
-- (always accurate, no migration needed for the visual) — this column exists only to
-- gate the one-time announcement. Mirrors tournaments.playoffs_published_at (mig 175).
--
-- Additive + idempotent. Backfill stamps every tournament whose playoffs are ALREADY
-- complete (has playoff games, none still pending/scheduled) so the release can't fire a
-- false "champions crowned" announcement the first time an existing finished bracket is
-- touched post-deploy. Tournaments still mid-playoffs stay NULL and fire correctly later.
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS champions_crowned_at timestamptz;

UPDATE tournaments t
   SET champions_crowned_at = now()
 WHERE t.champions_crowned_at IS NULL
   AND EXISTS (
     SELECT 1 FROM games g
      WHERE g.tournament_id = t.id AND g.is_playoff = true
   )
   AND NOT EXISTS (
     SELECT 1 FROM games g
      WHERE g.tournament_id = t.id
        AND g.is_playoff = true
        AND g.status NOT IN ('completed', 'forfeit', 'cancelled')
   );
