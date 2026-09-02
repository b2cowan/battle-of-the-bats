-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 272 — A DRILL NAMES ITS KIT FROM THE LIBRARY (One Tag Idiom P3, owner-ruled 2026-09-01 Q5)
--
-- The drill's Equipment field was the last free-text sibling of the fields mig 266 gave real
-- libraries: a station's kit became `equipmentTagIds` while the drill it was built from kept
-- typing "buckets"/"Buckets" into `equipment`. This adds the id array BESIDE the legacy labels,
-- exactly the station's shape and rules:
--
--   · READ-RESOLVE, WRITE-WHOLE. Old drills pre-select in the picker by case-insensitive NAME
--     match against the team's 'equipment' library (display only, nothing written on open); the
--     coach's first real edit saves the full resolved set as ids. A legacy name with no library
--     match renders an explicit one-press ADOPT row — never a silent import, because an import
--     would mint every old spelling as a tag (the exact split the library exists to prevent).
--   · THE LEGACY COLUMN IS NEVER PARTIALLY REWRITTEN — this migration does not touch it, reads
--     do not touch it, and a save leaves it as it was (`drill.equipment` keeps feeding
--     `drillToStation`'s name snapshot for un-migrated drills).
--   · NO FK, BY THE SAME DECISION AS MIG 266: ids in jsonb, so `merge_rep_team_tags` cannot
--     reach them — the 'equipment' kind's merge/delete hooks in
--     `lib/rep-practice-plan-tag-repoint.ts` now walk `rep_team_drills` alongside plans and
--     templates, in the SAME request as the tag write. A count or a repoint that reads fewer
--     homes than exist is the defect class this project keeps meeting; the unit source-scan
--     (`tests/unit/practice-tag-usage-count.test.ts`) pins all three homes.
--   · ⚠ TEAM VOCABULARY ONLY: an ORG-SHARED drill (team_id IS NULL) must not carry team
--     equipment ids — the write routes refuse ids on shared drills, and every id on a team
--     drill is proved to belong to that team's library (`isTeamTagOfKind`) before it is trusted.
--
-- Cap matches the legacy field's own CHECK (≤ 12 pieces of kit per drill).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.rep_team_drills
  ADD COLUMN IF NOT EXISTS equipment_tag_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.rep_team_drills
    ADD CONSTRAINT rep_team_drills_equipment_tag_ids_check
    CHECK (jsonb_typeof(equipment_tag_ids) = 'array' AND jsonb_array_length(equipment_tag_ids) <= 12);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.rep_team_drills.equipment_tag_ids IS
  'Ids from the team''s ''equipment'' tag library (mig 266 vocabulary). Beside legacy free-text `equipment`: read-resolve, write-whole, never a silent import. No FK — merge/delete re-point via lib/rep-practice-plan-tag-repoint.ts, which walks drills as of mig 272.';
