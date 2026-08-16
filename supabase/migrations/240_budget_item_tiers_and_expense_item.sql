-- 240 — The budget speaks in CATEGORY + ITEM, and so does spending
-- (COACH_BUDGET_ITEM_ALIGNMENT_PLAN — owner-approved from mockup, 2026-08-15).
--
-- Owner ruling, four sentences: a budget groups two levels and no further (category, then item);
-- the ITEM names the row; two lines on the same item SUM into one row; and actuals carry the item
-- too, so the report can answer "what item was charged but never budgeted?".
--
-- The screen that proved it: a coach picks the item "Entry Fees" and their plan renders a row called
-- "test" — the shared taxonomy invisible, the typed text the identity, and nothing downstream able
-- to match on it. Two reports cannot line up on words somebody typed.
--
-- ⚠⚠ THIS RETIRES MIGRATION 238'S EXPENSE→LINE LINK, ONE DAY OLD AND DEV-ONLY. That design linked
-- spending to a budget LINE rather than to a category+item pair, and its whole argument was that two
-- lines sharing a pair are AMBIGUOUS so actuals could not be split between them. The SUM ruling
-- dissolves exactly that argument: summed lines are one row, so there is nothing to split. The pair
-- becomes a complete answer and the line pointer becomes a second classification on the same record
-- that can only agree or drift. 238 never reached production; no coach ever saw it.
--
-- ⚠ PLANNED-NESS IS NOW DERIVED, NOT DECLARED. There is no "Not in the budget" choice any more: a
-- budget line exists for this category+item, or it does not. The coach says what a cost IS.

-- ── 1. The item library gets a TEAM tier ────────────────────────────────────────────────────
--
-- Owner ruling 2026-08-15: "custom items are team wide but should be viewable by the club, we
-- shouldn't populate 1 team's list with another team. Perhaps we can have an org create ones that
-- they want to send to all teams but not from team to team."
--
--   org_id NULL                  → PLATFORM default. Everyone sees it. Nobody can edit it.
--   org_id set, team_id NULL     → CLUB-published. Every team in the org sees it.
--   org_id set, team_id set      → THAT TEAM'S OWN. Only that team's picker offers it.
--
-- One direction only: a team's item never reaches another team's picker by itself. A club admin can
-- SEE every team's items and PUBLISH one to all teams, which is how a club standardises when it
-- notices the same thing invented twice.
--
-- ⚠ CASCADE, NOT SET NULL. A deleted team's private vocabulary must not silently become the club's.
-- Budget lines and expenses pointing at it are protected separately: rep_budget_lines.item_id is
-- already ON DELETE SET NULL, and a line that loses its item falls back to its category (the app
-- renders it under a "Not itemized" row rather than losing it).
alter table budget_items
  add column if not exists team_id uuid references rep_teams(id) on delete cascade;

comment on column budget_items.team_id is
  'WHO OWNS THIS ITEM (mig 240). NULL with org_id NULL = platform default, visible to everyone. '
  'NULL with org_id set = CLUB-published, visible to every team in that org. Set = that TEAM''S own, '
  'visible in that team''s picker ONLY. ⚠ A team item never appears in another team''s list — a club '
  'admin must publish it, which clears team_id and hands it to everyone. There is deliberately no '
  'reverse: an item a team is already planning against cannot be taken back.';

create index if not exists budget_items_team_idx
  on budget_items (team_id) where team_id is not null;

-- ⚠ THE OLD UNIQUENESS WAS PER ORG, WHICH THE TEAM TIER BREAKS. Two teams in one club must both be
-- able to invent "Provincials entry" under Tournaments without one refusing the other. A plain
-- multi-column unique index cannot express this — NULL never equals NULL in Postgres, so every
-- club-published row would escape the constraint entirely. Coalescing to a zero uuid gives the
-- club level one shared slot and each team its own.
drop index if exists budget_items_unique_org_name;

create unique index if not exists budget_items_unique_scope_name
  on budget_items (
    category_id,
    org_id,
    coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  )
  where org_id is not null;

-- ── 2. Spending records the ITEM, not the line ──────────────────────────────────────────────
--
-- One column carries both levels: an item belongs to exactly one category (budget_items.category_id
-- is NOT NULL), so storing the item states the category too. budget_category_id (mig 238) STAYS for
-- the row that names a category but no item — an import, or a cost recorded before the item was
-- added to the library.
alter table rep_team_expenses
  drop column if exists budget_line_id;

alter table rep_team_expenses
  add column if not exists budget_item_id uuid references budget_items(id) on delete set null;

comment on column rep_team_expenses.budget_item_id is
  'WHAT THIS COST IS, in the same words the budget uses (mig 240) — the key Budget vs. Actual groups '
  'on. Implies the category, since an item belongs to exactly one. NULL for a row recorded before '
  'this shipped, an imported row, or one whose item was later deleted; those fall back to '
  'budget_category_id and then to the free-text `category`. ⚠ ON DELETE SET NULL: removing an item '
  'from the library must never delete or orphan a record of money. ⚠ Whether the cost was BUDGETED '
  'is not stored — it is derived, by asking whether a budget line exists for the same category+item.';

comment on column rep_team_expenses.budget_category_id is
  'The category this cost is against (mig 238, kept by mig 240). Normally derived from '
  'budget_item_id; carried on its own for a row that names a category but no item, and the '
  'surviving link if that item is later deleted. Does NOT replace the free-text `category`.';

create index if not exists idx_rep_team_expenses_budget_item
  on rep_team_expenses (budget_item_id) where budget_item_id is not null;

-- ⚠ NO CHECK CONSTRAINT REQUIRING AN ITEM ON A COST LINE, deliberately. The item is required by the
-- API and by the form from today, but BOTH databases are full of rows written before it mattered —
-- 37 cost lines on dev and 19 on production, every one of them with item_id NULL, because nothing
-- had ever depended on the column. A CHECK could not be applied without rewriting them first, and
-- guessing an item from a coach's free text is exactly the confident-and-wrong data the 236/237/238
-- comments all refused to write. They render under a "Not itemized" row in their category — visible,
-- honest, and one click from being fixed by the person who knows the answer.
