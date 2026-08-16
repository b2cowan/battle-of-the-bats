-- 244 — The "Fundraising Costs" rename carries the free-text snapshots with it
--
-- ⚠ FOUND BY /review ON MIGRATION 243, WITH A REAL ROW BEHIND IT (1 on dev, 0 on prod at the time
-- of writing). 243 renamed the platform category "Fundraising Costs" → "Fundraising" so one
-- category could hold a bottle drive's proceeds AND its printing. Renaming the row is safe for
-- anything pointing at it BY ID — but Budget vs. Actual does not only match by id.
--
-- THE MECHANISM, precisely. That report resolves a cost to its category three ways, in order of
-- trust (see the header of app/api/coaches/.../budget-vs-actual/route.ts):
--   1. its ITEM (mig 240), 2. its `budget_category_id` (mig 238), 3. its free-text `category`,
--   matched BY NAME against the categories the plan uses.
-- Path 3 exists because migration 238 deliberately shipped without a backfill, so every cost
-- written before it carries text and no ids at all. The name it is matched against is the CURRENT
-- one — so the instant 243 renamed the row, a legacy cost whose snapshot reads 'Fundraising Costs'
-- stopped matching, fell through to "no category id", and became its OWN bucket.
--
-- The result a coach would have seen: the category split in two on the report — the real
-- "Fundraising" beside an orphaned, un-expandable "Fundraising Costs" that can never be matched to
-- a plan line. The season total stays right; the breakdown they actually read does not. That is
-- the identical shape as the "Officials twice" defect the same route already carries a fix for.
--
-- ⚠ ITS OWN MIGRATION RATHER THAN AN EDIT TO 243, for the reason 242's header states about 241:
-- 243 is already applied, and editing an applied migration is the drift the dictionary rules exist
-- to stop.
--
-- ⚠ THE TEXT IS A SNAPSHOT, NOT A POINTER, so updating it is a data correction and not a
-- denormalization fix. It records what the category was CALLED when the cost was written; after
-- the rename, the true answer to "what is this cost's category called" is "Fundraising".

update rep_team_expenses
   set category = 'Fundraising'
 where category = 'Fundraising Costs';

-- ⚠ `rep_team_expenses.category` IS THE ONLY SNAPSHOT OF A CATEGORY NAME IN THE SCHEMA — checked,
-- rather than assumed. The org planner's lines (`org_budget_lines`) carry no such column and point
-- by id alone, and money-in records (mig 243) were born pointing by id, so neither can drift this
-- way. If a future table ever snapshots a category name, it belongs in this statement's company.
