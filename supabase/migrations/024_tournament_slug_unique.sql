-- Prevent duplicate public tournament URLs inside an organization while allowing archived history.
--
-- Production preflight before applying:
-- SELECT organization_id, slug, COUNT(*)
-- FROM tournaments
-- WHERE status <> 'archived'
-- GROUP BY organization_id, slug
-- HAVING COUNT(*) > 1;
--
-- If this returns rows, resolve duplicates before running the migration.
CREATE UNIQUE INDEX IF NOT EXISTS tournaments_organization_slug_live_unique
  ON tournaments (organization_id, slug)
  WHERE status <> 'archived';
