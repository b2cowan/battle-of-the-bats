-- 282 — A grant moves to the sponsorship shelf
-- (Owner ruling 2026-09-07, relayed with the §152 walk: the question migration 280 deliberately
--  left open is now answered — Grant belongs under Sponsorship.)
--
-- WHY THE OPEN QUESTION CLOSED. Migration 280 made *Grant* sponsor-sourced but left it under
-- FUNDRAISING, on the reasoning that a category is the report's shelf and a club may reasonably
-- want grants shelved with its fundraising. Building the source tags surfaced a concrete reporting
-- failure that reasoning had not accounted for.
--
-- Sponsor money is placed on Budget vs. Actual by `placeDerivedActual` (lib/coach-money-derived.ts),
-- which files the whole sponsor pool as deep in the taxonomy as the CLAIMING budget lines agree,
-- and no deeper. With Grant sponsor-sourced but shelved under Fundraising:
--
--   · a team that budgets ONLY a Grant line has one sponsor claim, under Fundraising — so every
--     sponsor dollar it receives, Team sponsorship cheques included, reports under FUNDRAISING;
--   · a team that budgets BOTH a Grant line and a Team sponsorship line has sponsor claims spanning
--     TWO categories, so `placeDerivedActual` refuses to guess and the WHOLE sponsor pool lands in
--     the no-category bucket.
--
-- ⚠ THE SECOND CASE IS THE ONE THAT DECIDED IT: budgeting sponsorship *properly* gave the coach a
-- WORSE report than budgeting it carelessly. With Grant on the Sponsorship shelf both cases place
-- correctly — one line lands on its own row, two lines land on the Sponsorship category's own
-- "Not itemized" bucket, which is the honest answer `placeDerivedActual` exists to give.
--
-- ⚠⚠ THIS IS THE EXCEPTION TO MIGRATION 276'S "NO RE-FILING" NOTE, AND IT PAYS THE PRICE 276 NAMED.
-- 276 warned that moving an item "silently renames rows a treasurer has already read and exported".
-- That is exactly right, and it is why part 2 below exists: an item is stored on a record ALONGSIDE
-- its category, and Budget vs. Actual reads the two in DIFFERENT orders (month attribution prefers
-- the stored category; cost placement derives from the item), so moving the word without moving the
-- stored category leaves a row that reports under two different headings depending which half of
-- the page is asking. `repointBudgetItemReferences` already establishes the rule for a fold — when
-- an item moves, every referencing table's category column moves with it. This does the same.
--
-- ⚠ WHAT IS ACTUALLY OUT THERE, measured on BOTH databases 2026-09-07 before writing this:
--   · exactly ONE `Grant` row exists per database, PLATFORM-owned (org_id and team_id both null) —
--     no club or team override exists, and none can: a club that wants its own "Grant" creates a
--     separate row with its own category, which this migration does not touch.
--   · ZERO budget lines, recorded costs, money-in records, club budget lines and club bills point
--     at it.
--   · ONE club payment request points at it, on dev AND on production: the coach demo's
--     $250 "Association development grant" (riverdale-ridge). ⚠ THAT ROW IS IN THE SHOP WINDOW,
--     which is precisely why part 2 is not optional.
--   · no `Grant` already exists under Sponsorship, so the platform unique index cannot collide.

-- ── 1. The word moves ───────────────────────────────────────────────────────────────────────────
--
-- PLATFORM rows only (org_id is null on both the item and both categories). A club's own word is
-- its own business and is deliberately untouched.
update budget_items i
   set category_id = (
     select c2.id from budget_categories c2
      where c2.org_id is null and lower(c2.name) = 'sponsorship'
      limit 1
   )
  from budget_categories c
 where c.id = i.category_id
   and i.org_id is null and c.org_id is null
   and i.direction = 'in'
   and lower(c.name) = 'fundraising'
   and lower(i.name) = 'grant'
   and exists (
     select 1 from budget_categories c2
      where c2.org_id is null and lower(c2.name) = 'sponsorship'
   );

-- ── 2. Every record filed against it follows ────────────────────────────────────────────────────
--
-- ⚠ THE TWO LEVELS MUST NOT DISAGREE. Each of these tables stores the category ALONGSIDE the item
-- because the report reads them in different orders; a row keeping "Fundraising" while its word now
-- lives under "Sponsorship" is the two-headings-for-one-row state the Data Dictionary warns about,
-- and on the demo it would be visible to a prospect. Same shape and same reason as
-- `repointBudgetItemReferences` in lib/coach-budget-items.ts, which is the fold's version of this.
--
-- ⚠ ALL SIX REFERENCING TABLES, not just the one with a row today. The 2026-08-17 defect this
-- reference list exists to prevent was a table left out of exactly such a loop; writing only the
-- statement that currently matches would re-teach that lesson to whoever copies this migration.
do $$
declare
  grant_item uuid;
  sponsorship_cat uuid;
begin
  select i.id into grant_item
    from budget_items i
    join budget_categories c on c.id = i.category_id
   where i.org_id is null and c.org_id is null
     and lower(c.name) = 'sponsorship' and lower(i.name) = 'grant'
   limit 1;

  select id into sponsorship_cat
    from budget_categories
   where org_id is null and lower(name) = 'sponsorship'
   limit 1;

  if grant_item is null or sponsorship_cat is null then
    raise notice '282: no platform Grant under Sponsorship — nothing to re-point.';
    return;
  end if;

  update rep_budget_lines           set category_id        = sponsorship_cat where item_id        = grant_item;
  update org_budget_lines           set category_id        = sponsorship_cat where item_id        = grant_item;
  update rep_team_money_in          set budget_category_id = sponsorship_cat where budget_item_id = grant_item;
  update rep_team_payment_requests  set budget_category_id = sponsorship_cat where budget_item_id = grant_item;
  update rep_allocation_splits      set budget_category_id = sponsorship_cat where budget_item_id = grant_item;
  -- ⚠ This one also carries a FREE-TEXT category name that legacy readers still fall back to, so it
  -- moves too — a stale 'Fundraising' string there would outlive the id and surface on the older
  -- surfaces that read it.
  update rep_team_expenses
     set budget_category_id = sponsorship_cat,
         category = (select name from budget_categories where id = sponsorship_cat)
   where budget_item_id = grant_item;
end $$;

comment on table budget_items is
  'Shared budget taxonomy: named words inside a budget_category. org_id IS NULL = the platform '
  'library. ⚠ MOVING A PLATFORM WORD BETWEEN CATEGORIES IS A RE-FILING, NOT A RENAME (mig 282): '
  'every referencing table stores the category ALONGSIDE the item and Budget vs. Actual reads the '
  'two in different orders, so the word and all six reference tables move in one migration or the '
  'same row reports under two headings. Migration 276''s "no re-filing" note still stands as the '
  'default — 282 is the exception, taken because leaving Grant on the Fundraising shelf while it '
  'was sponsor-sourced made a team that budgeted its sponsorship properly read WORSE than one that '
  'did not (placeDerivedActual cannot place a pool whose claims span two categories).';
