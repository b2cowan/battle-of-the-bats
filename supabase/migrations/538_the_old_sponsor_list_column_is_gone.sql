-- 538 — The old sponsor list column is gone (Board Ready Stage 6 Part 4b).
--
-- ⚠⚠ HELD. NOT APPLIED to dev or production when written (2026-11-25). Apply it to BOTH, together, only AFTER the
-- production release that carries the code which no longer reads the column is serving. The earlier code writes it by
-- name when a sponsor list is saved, and applying it to dev alone would leave dev short of a column production has.
--
-- `org_public_site_content.sponsors` (mig 353) was the club's sponsor list as a jsonb array. Board Ready Stage 6 moved
-- every sponsor in it into club_sponsors + club_sponsor_places (mig 525, applied to production 2026-11-23), and Part 4b
-- removed every reader and writer. The column and its cap CHECK are dead.
--
-- Counts 2026-11-25 (counts only): production 0 public-site rows, so 0 entries; dev 6 rows, 2 with an old list (6
-- entries, already moved by mig 525). No function, view or policy reads the column on either database.
--
-- ⚠ Once this has run, mig 525 can no longer be re-run as written: its move of the old entries reads this column.
--
-- A dropped column is INVISIBLE to check:migrations; it is declared in MANUAL_PROD_STEPS.json. When applied: update
-- docs/agents/db/DATA_DICTIONARY.md (remove the column's entry) and run `npm run refresh:snapshots`. Idempotent.

ALTER TABLE public.org_public_site_content DROP CONSTRAINT IF EXISTS org_public_site_content_sponsors_cap;
ALTER TABLE public.org_public_site_content DROP COLUMN IF EXISTS sponsors;
