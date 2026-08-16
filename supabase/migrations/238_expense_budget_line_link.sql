-- 238 — Spending can point at a BUDGET LINE, not just at a category name
-- (COACH_BUDGET_LINE_ALIGNMENT_PLAN — owner-approved from mockup, 2026-08-15).
--
-- The budget speaks in category + item: a line carries category_id AND item_id. Spending spoke
-- only in `category`, as free text, matched back to the plan by lowercasing a NAME. So category
-- totals were right and everything finer than a category was blank — and worse than blank, because
-- a category holding three lines had one dollar reported against all three (fixed in the display
-- half on 2026-08-15; this is the half that puts a real number where the dash is).
--
-- ⚠ THE LINE, NOT THE CATEGORY+ITEM PAIR. Two lines can legitimately share a pair — "Tournament
-- entry" under Tournaments, twice, for two different tournaments — and a pair-based link could
-- never split their actuals. The line IS that pair plus the team's own description and amount, so
-- it is the only thing that answers "which row of my budget is this against?" unambiguously.
--
-- ⚠ ON DELETE SET NULL IS LOAD-BEARING. Deleting a budget line must never delete, orphan or block
-- a record of money. The expense survives with its text `category` still populated and goes back to
-- matching by name, exactly as every pre-238 row does.
--
-- ⚠ `category` STAYS, AND STAYS POPULATED. It is what every historic row has, what the importer
-- writes, and the honest fallback for spending that is genuinely not in the plan. This adds a
-- better link BESIDE it; the server derives the text from the line whenever one is chosen, so the
-- two can never disagree.
--
-- ⛔ NO BACKFILL. Guessing which line a historic expense belonged to is precisely the
-- confident-and-wrong data this dictionary's rules exist to stop (the 236 and 237 precedent).
-- Existing rows keep matching by category name; both kinds roll up to the same category totals
-- throughout the mixed window, which is what makes shipping without a backfill safe.

alter table rep_team_expenses
  add column if not exists budget_line_id uuid references rep_budget_lines(id) on delete set null,
  add column if not exists budget_category_id uuid references budget_categories(id) on delete set null;

comment on column rep_team_expenses.budget_line_id is
  'The budget line this spending is against (mig 238), or NULL for unbudgeted spending, for a team '
  'with no plan, and for every row written before 2026-08-15. When set, the server derives the text '
  '`category` from the line, so the two cannot disagree. ⚠ ON DELETE SET NULL: deleting a line must '
  'never touch a record of money — the row falls back to matching by category name. ⚠ COST lines '
  'only; a funding/sponsorship line is money IN and can never absorb an expense (the API refuses '
  'it, and Budget vs. Actual keeps money-in lines out of the cost machinery entirely).';

comment on column rep_team_expenses.budget_category_id is
  'The budget category this spending is against (mig 238) — derived from budget_line_id when a line '
  'is chosen, and the surviving link if that line is later deleted. NULL alongside a NULL '
  'budget_line_id. Does NOT replace the free-text `category`, which stays populated for the '
  'name-matching path every pre-238 row still uses.';

-- The report groups a season's spending by line, so the lookup is "every expense pointing at these
-- lines". Partial: the vast majority of rows carry NULL here for the whole coexistence window.
create index if not exists idx_rep_team_expenses_budget_line
  on rep_team_expenses (budget_line_id) where budget_line_id is not null;
