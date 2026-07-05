-- Playoff "announcement moment" — home hero takeover + "Playoffs are set" notification.
--
-- playoffs_published_at marks the FIRST time a playoff bracket was materialized for a
-- tournament. It is the one-time idempotency guard for the fan + staff "Playoffs are
-- set" notification, so editing/regenerating an existing bracket never re-blasts. The
-- public home hero takeover derives from the PRESENCE of playoff games (always accurate,
-- no migration needed for the visual) — this column exists only to gate the one-time
-- announcement.
--
-- Additive + idempotent. Backfill stamps every tournament that ALREADY has playoff games
-- so the release can't fire a false "playoffs set" announcement the first time an
-- existing bracket is edited post-deploy.
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS playoffs_published_at timestamptz;

UPDATE tournaments t
   SET playoffs_published_at = now()
 WHERE t.playoffs_published_at IS NULL
   AND EXISTS (
     SELECT 1 FROM games g
      WHERE g.tournament_id = t.id AND g.is_playoff = true
   );
