-- 276: OTHER INCOME GETS A HOME IN THE LIBRARY
-- (Owner QA §132, ruling 2026-09-04.)
--
-- THE CASE. Migration 274 added `other_income` as a fourth line kind — "interest, a facility
-- rebate, a plain donation" — and mig 243 had already made a category AND an item REQUIRED on
-- every budget line in BOTH directions. Those two rulings are fine apart and broken together:
-- every money-in item in the shared library sits under Fundraising, Sponsorship or Tournaments,
-- and none of them is where a coach files bank interest. `Admin` looks like the answer and is
-- not — it is `scope = 'org'`, so it never appears in a coach's picker at all.
--
-- The result a coach met: a kind the product offers them, which they cannot save without first
-- inventing their own category and item from inside the form. Found when the UAT fixture had to
-- reproduce "what a coach experiences today" and could not do it with anything in the library.
--
-- ⚠ THE CATEGORY IS TEAM-SCOPED, deliberately. `scope = 'org'` is what put Admin out of reach;
-- a category a coach cannot pick is not a home. See lib/coach-budget-items.ts for the scope rule.
--
-- ⚠ NO BACKFILL AND NO RE-FILING. Lines already sitting on a coach-created "Other Income" of
-- their own stay exactly where they are — an item is what NAMES a row on the report, so moving
-- one silently renames rows a treasurer has already read and exported.
insert into budget_categories (org_id, name, scope, sort_order)
select null, 'Other Income', 'team', 70
where not exists (
  select 1 from budget_categories where org_id is null and lower(name) = 'other income'
);

-- The items. `direction = 'in'` keeps them off the expense side of the picker, which is the same
-- filter that keeps "Entry Fees" out of an income line's list.
--
-- ⚠⚠ NO 'Grant' HERE, DELIBERATELY (adversarial review, 2026-09-04). Migration 243 already ships
-- `Fundraising → Grant` at this same tier and direction, and the unique index on budget_items is
-- PARTIAL (`where org_id is not null`, mig 248) — so the database would have accepted a second
-- platform-library "Grant" happily and the coach's picker would have listed the word twice with
-- nothing to tell the two apart. Two coaches filing one real grant could then land it in different
-- categories, and the by-activity lens nets revenue against costs PER CATEGORY, so the same money
-- would report two ways. A grant is fundraising; it keeps its existing home.
insert into budget_items (category_id, org_id, name, direction, sort_order, is_default)
select c.id, null, v.name, 'in', v.sort_order, false
from budget_categories c
cross join (values
  ('Interest',        0),
  ('Rebate',          1),
  ('Donation',        2),
  ('Other income',    3)
) as v(name, sort_order)
where c.org_id is null and lower(c.name) = 'other income'
  and not exists (
    select 1 from budget_items i
    where i.category_id = c.id and i.org_id is null and lower(i.name) = lower(v.name)
  );

comment on table budget_categories is
  'Shared budget taxonomy. Categories with org_id IS NULL are the platform library; scope '
  'controls who can pick one (''team'' = a coach''s picker, ''org'' = club-side only, ''both'' = '
  'either). ⚠ A library category a coach must be able to file against MUST be ''team'' or '
  '''both'' — mig 276 exists because ''Admin'' was ''org'' and left the other_income line kind '
  'with nowhere to go.';
