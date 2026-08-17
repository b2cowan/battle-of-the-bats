-- ---------------------------------------------------------------
-- Migration 246 — every budget item points one way (Money form P2)
--
-- Owner ruling 2026-08-16: "the items coaches add need to be tied to income or
-- expense, they cannot be unlinked or untagged to those. So a coach clicking
-- income should not see expense items or vice versa."
--
-- ⚠⚠ THIS REVERSES MIGRATION 243's OWN DESIGN, DELIBERATELY. 243 added
-- `budget_items.direction` as "a PICKER HINT that sorts and groups the list —
-- never a constraint", NULL on everything a coach or a club created, on the
-- reasoning that guessing wrong was worse than not guessing. The form redesign
-- makes the direction the thing the item list is CHOSEN BY, and a hint cannot
-- carry that: with the pill filtering, a NULL row is a word that appears under
-- neither pill — a coach could create an item and immediately be unable to find
-- it. So the column stops being a hint and becomes part of what an item IS.
--
-- Two halves, and the second is what makes the ruling stick:
--   1. backfill every untagged row to 'out'
--   2. SET NOT NULL, so no create path can skip the question again
--
-- ⚠ THE BACKFILL IS A FACT, NOT A GUESS. Money-in items did not exist in this
-- product until migration 243 (2026-08-15) — the whole library was built for a
-- spending plan, which is exactly why 243's own §3d tagged every pre-existing
-- PLATFORM row 'out'. Every club- and coach-created row is older than money-in
-- for the same reason, and there are no production organizations to have made
-- an exception (verified 2026-08-16: the coach world on prod is the two seeded
-- `riverdale-*` demos). What 243 did for our own words, this does for theirs.
--
-- ⚠ CATEGORIES ARE STILL NEVER TAGGED, and that is untouched. "Tournaments"
-- holding both its entry fees and its registration revenue is the whole point
-- of the by-activity report; the ruling is about items, and only items.
--
-- ⚠ THE REPORT STILL DOES NOT READ THIS. A row's direction on Budget vs. Actual
-- comes from what was actually filed against it, exactly as before. This column
-- decides which list a coach CHOOSES from, and nothing else — which is why
-- moving an item to the other side later moves no money.
-- ---------------------------------------------------------------

-- ── 1. Everything untagged is a spending word ────────────────────────────────
UPDATE budget_items
   SET direction = 'out'
 WHERE direction IS NULL;

-- ── 2. The question can never be skipped again ───────────────────────────────
-- Every insert path is updated in the same unit of work: the coach picker, the
-- club-admin picker, the budget-plan importer (which only ever writes cost
-- lines — funding and sponsorship rows are refused at the door) and the demo
-- coach seed. A path that forgets now fails loudly at the write instead of
-- quietly producing an item nobody can select.
ALTER TABLE budget_items
  ALTER COLUMN direction SET NOT NULL;

COMMENT ON COLUMN budget_items.direction IS
  'Which way this word points: in = money the team receives, out = money it spends '
  '(mig 243, made mandatory by mig 246). REQUIRED on every row — the coach picker '
  'FILTERS by it, so the Expense pill offers only ''out'' words and Income only ''in'' '
  'ones (owner ruling 2026-08-16). Never consulted by Budget vs. Actual, which takes a '
  'row''s direction from what was actually filed against it — so moving an item to the '
  'other side re-files nothing and moves no money. Categories are never tagged.';
