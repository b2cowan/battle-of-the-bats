-- ---------------------------------------------------------------
-- Migration 248 — a word's SIDE is part of what identifies it
--
-- Owner ruling 2026-08-17: uniqueness is "source + item type (expense/income) +
-- category + item name". Three of those four are already in the key that
-- migration 240 built; this adds the fourth.
--
-- ⚠ WHY IT MATTERS NOW. Migration 246 made `direction` mandatory and the picker
-- FILTERS by it, so a team can legitimately want "Grant" as income (a cheque
-- that arrived) and "Grant" as an expense (the fee to apply for one). Under the
-- 240 key those two collide, and the coach create path answered with a 409 that
-- had no good remedy — the words are genuinely different things that happen to
-- share a name, and the picker shows only one side at a time, so the pair can
-- never be ambiguous at the point of choice.
--
-- ⚠ NO BACKFILL, AND NO ROW CAN FAIL. The new key is strictly WEAKER than the
-- one it replaces: every pair that was unique on (category, org, team, name)
-- remains unique when `direction` joins them. Dropping and recreating is safe
-- in either order for existing data; recreating first would simply be
-- redundant.
--
-- ⚠ `org_id IS NOT NULL` IS PRESERVED. Platform rows (org_id null) sit outside
-- this constraint exactly as they did — they are ours, seeded, and the partial
-- index is what lets a club invent a word we already ship.
--
-- ⚠ THE COALESCE STAYS, AND SO DOES ITS REASON. NULL never equals NULL in
-- Postgres, so a plain multi-column index would let every club-published row
-- (team_id null) escape the constraint entirely. Coalescing to a zero uuid
-- gives the club tier one shared slot and each team its own.
-- ---------------------------------------------------------------

drop index if exists budget_items_unique_scope_name;

create unique index if not exists budget_items_unique_scope_side_name
  on budget_items (
    category_id,
    org_id,
    coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid),
    direction,
    lower(name)
  )
  where org_id is not null;

COMMENT ON INDEX budget_items_unique_scope_side_name IS
  'What makes two budget words the same word (owner ruling 2026-08-17): source '
  '(org + team) + side + category + lower(name). Replaces '
  'budget_items_unique_scope_name (mig 240), which omitted the side and so '
  'refused a team that wanted "Grant" as both an income word and an expense one. '
  'Partial on org_id so a club may invent a name the platform library already '
  'ships; coalesced team_id so club-published rows share one slot instead of '
  'escaping the index on NULL.';
