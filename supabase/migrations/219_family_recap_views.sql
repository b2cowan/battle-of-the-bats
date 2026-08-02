-- ---------------------------------------------------------------
-- Migration 219 — "did anyone actually read it?" (Chunk D slice 3, item 3.5)
--
-- (Numbered 219, not 218: a concurrent session took 218 for the drills/focus-category change
--  while this was in flight. Same schema either way — the file number is the release runbook's
--  handle, and two files sharing one is how a migration gets silently skipped at promotion.)
--
-- The coach's byproducts are only worth the build if families open them. This table is the
-- ONLY thing in the chunk that records a family ACTION, and its shape is chosen so it cannot
-- become something else:
--
--   • ONE ROW PER (link, season). Not per open. There is no counter, no last-seen timestamp
--     that ticks, no session log. "This family has opened this season's recap" is a boolean
--     fact stamped once, and re-reading it a hundred times writes nothing further.
--
--   • COUNTS ONLY, BY CONSTRUCTION OF THE READER. Owner ruling for this item is explicit:
--     aggregates, never per-person read receipts. A per-person receipt on a child's recap is
--     a different product and a worse one. De-duplicating "12 of 15 families" unavoidably
--     requires knowing WHICH families, so the identity is stored — and the only exported
--     reader (`countRecapViewers` in lib/family-engagement.ts) returns integers. No route
--     returns rows from this table; the family-access boundary probe asserts it.
--
--   • RLS: service-role only, the mig-212 posture. The browser never queries this table, on
--     either side of the product.
--
-- Cascades: deleting a family link or a season removes its engagement rows with it. This is
-- derived, disposable telemetry about a minor's family — nothing here is a record worth
-- outliving the thing it describes.
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS family_recap_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rep_team_id uuid NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  program_year_id uuid NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES family_links(id) ON DELETE CASCADE,
  -- Stamped ONCE, on the first open. Never updated — see the header.
  first_viewed_at timestamptz NOT NULL DEFAULT now()
);

-- The dedupe key AND the insert's conflict target: one row per family per season.
CREATE UNIQUE INDEX IF NOT EXISTS family_recap_views_link_season_uniq
  ON family_recap_views (link_id, program_year_id);

-- The coach's count is "how many of this season's guardians opened it", so the read is keyed
-- on the season; the team column carries the org-side rollup without a join.
CREATE INDEX IF NOT EXISTS family_recap_views_season_idx
  ON family_recap_views (program_year_id);
CREATE INDEX IF NOT EXISTS family_recap_views_team_idx
  ON family_recap_views (rep_team_id);

-- Service-role only. RLS ON with NO policies = the anon/authenticated roles can read nothing,
-- which is the posture mig 212 established for every family-layer table.
ALTER TABLE family_recap_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON family_recap_views FROM anon, authenticated;
