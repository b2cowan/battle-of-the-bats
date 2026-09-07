-- 280 — A word says who reports its money
-- (COACH_BUDGET_LINE_ONE_QUESTION_PLAN — owner-approved from mockup 3913e207, 2026-09-07.)
--
-- Owner, in his words: "when selecting a budget for sponsorship, why are we offering all of these
-- other items? does selecting sponsorship and then selecting concession revenue make sense? …
-- does the line item just need to be split into expense and revenue at the top and then based on
-- what the user picks as the category item we bucket appropriately?"
--
-- ⚠⚠ WHAT WAS BROKEN. Adding a budget line asked TWO questions — "This line is: Expense /
-- Expected fundraising / Expected sponsorship / Expected other income", and then "Category &
-- Item". The item picker filters by DIRECTION and never by the kind just chosen, so
-- *Expected sponsorship* + *Tournaments → Concession revenue* was offerable. That pairing is not
-- untidy, it is a trap: the kind decides where the row's ACTUAL comes from, a sponsorship line
-- takes its actual from sponsor arrivals and CLOSES the row to typed income (deliberately, so the
-- same dollar is never counted twice) — so the coach ends up with a budget line they can never
-- record their concession takings against, and nothing on screen says why.
--
-- THE FIX IS TO MOVE WHERE THE ANSWER IS DECLARED, not to delete it. The form now asks one
-- question — money out or money in — and the ITEM carries who reports its actual. The stored
-- `rep_budget_lines.line_kind` is unchanged and still written on every row; it is now DERIVED from
-- the chosen item instead of typed by the coach, so the plan list, the summary ladder, the period
-- grid, both report shapes, the exports and the whole-source-tree kind guard all keep working
-- untouched.
--
-- ⚠⚠ THIS DOES NOT REVERSE THE 2026-08-16 RULING that sponsorship stays a distinct money-in kind
-- BECAUSE SPONSOR RECORDS DEPEND ON IT. The three sources — a drive reports it, a sponsor reports
-- it, the coach types it — are load-bearing: player rebates, the derived pools and the never-both
-- rule are all computed from them. All three survive. Only the question a coach is asked changes.
--
-- ⚠ NO BUDGET LINE IS RE-FILED AND NO FIGURE MOVES. Measured on BOTH databases 2026-09-07,
-- immediately before writing this: every money-in budget line in existence (5 on dev, 1 on prod)
-- points at a PLATFORM library item and already uses the obvious pairing, so every one derives to
-- exactly the kind it already stores. There are no club- or coach-created money-in items anywhere.
-- (This migration DOES backfill `budget_items.actual_source` itself, on four platform words — see
-- part 2. What does not move is any figure on any screen.)
--
-- ⚠⚠⚠ RELEASE ORDER: THIS CODE CANNOT REACH PRODUCTION AHEAD OF MIGRATION 274 (/review, data lens,
-- 2026-09-07). Production's `rep_budget_lines_line_kind_check` still admits only
-- ('cost','funding','sponsorship') — `other_income` arrived in migration 274 and is prod-owed with
-- this one. And `other_income` is what a TYPED money-in word derives, which after this migration is
-- the ordinary case rather than a rare one: every word a coach invents is born typed, and so are
-- Tournaments' three revenue words and the whole Other Income library. On a database missing 274 a
-- coach would meet a raw constraint error on one of the commonest money actions there is — and
-- because the edit door re-derives on EVERY save, an ordinary amount or notes edit to an existing
-- money-in line would fail the same way. The dependency pre-dates this change (the old form offered
-- "Expected other income" as one of four answers), but this migration turns it from a choice a coach
-- rarely made into the default path, so it is written down here rather than left to be rediscovered.

-- ── 1. The column ───────────────────────────────────────────────────────────────────────────────
--
-- ⚠ A COLUMN, NOT A LOOKUP KEYED BY NAME (owner ruling 2026-09-07). The alternative was a
-- hardcoded list of the eleven standard words. It is cheaper and it is wrong the day a club renames
-- a word or invents one that happens to share a standard name — and mig 248's key deliberately
-- allows exactly that (a club's *Grant* and a team's own *Grant* are two legitimate rows). This is
-- the same shape `direction` already has, for the same reason: it is part of what an item IS.
--
-- ⚠ THE DEFAULT IS THE LOAD-BEARING HALF. A word a coach or a club invents has no machinery behind
-- it by definition, so it is born 'typed'. Defaulting it to a derived source would close its rows
-- to the only way their money can be recorded — the same failure described above, reached from the
-- other side.
alter table budget_items
  add column if not exists actual_source text not null default 'typed';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'budget_items'::regclass and conname = 'budget_items_actual_source_check'
  ) then
    alter table budget_items
      add constraint budget_items_actual_source_check
      check (actual_source in ('typed', 'fundraiser', 'sponsor'));
  end if;
end $$;

-- ⚠ A SPENDING WORD IS ALWAYS TYPED, as a database fact rather than a convention. Every cost's
-- actual is recorded by the coach; there is no machinery that reports one. Safe to enforce because
-- a word NEVER CHANGES SIDES (owner ruling 2026-08-17, enforced by the coach item PATCH, which
-- refuses a `direction` in the body outright) — so no edit can drive an existing row through it.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'budget_items'::regclass and conname = 'budget_items_out_is_typed_check'
  ) then
    alter table budget_items
      add constraint budget_items_out_is_typed_check
      check (direction = 'in' or actual_source = 'typed');
  end if;
end $$;

-- ── 2. The platform library's own answers ───────────────────────────────────────────────────────
--
-- Only PLATFORM rows (org_id is null) are touched. A club's or a team's word stays 'typed', which
-- is both the default and the truth about it.
update budget_items i
   set actual_source = 'fundraiser'
  from budget_categories c
 where c.id = i.category_id
   and i.org_id is null and c.org_id is null
   and i.direction = 'in'
   and lower(c.name) = 'fundraising'
   and lower(i.name) in ('fundraising drive', 'merchandise sales');

update budget_items i
   set actual_source = 'sponsor'
  from budget_categories c
 where c.id = i.category_id
   and i.org_id is null and c.org_id is null
   and i.direction = 'in'
   and lower(c.name) = 'sponsorship'
   and lower(i.name) = 'team sponsorship';

-- ⚠⚠ GRANT IS SPONSOR MONEY, AND THIS RESOLVES A CONTRADICTION THE PRODUCT ALREADY HAD. *Grant*
-- ships under the FUNDRAISING category (mig 243), while the sponsorship option's own help text
-- reads "a business sponsor, A GRANT, anything given directly rather than raised by selling". So
-- the two halves of the product have disagreed about what a grant is since the day both shipped,
-- and a coach budgeting one had to choose which way to be wrong: file it as fundraising and its
-- actual is sought in bottle-drive receipts, or file it as sponsorship and it reads under
-- Fundraising on the report. Once the ITEM decides, that choice cannot be handed to the coach any
-- more. A grant is given directly and arrives as a cheque, which is exactly what the sponsor
-- machinery models.
--
-- ⚠ ITS CATEGORY IS DELIBERATELY NOT MOVED. The category is the REPORT'S SHELF and a club may
-- reasonably want grants shelved with fundraising; that is its own smaller question, left open on
-- purpose (plan §3.3, build prompt "what NOT to build"). Moving an item renames rows a treasurer
-- has already read and exported — see mig 276's own no-re-filing note.
--
-- ⚠ NO LINE IS RE-FILED BY THIS. Verified 2026-09-07: zero budget lines on either database point
-- at Grant, so nothing changes kind and no figure moves.
update budget_items i
   set actual_source = 'sponsor'
  from budget_categories c
 where c.id = i.category_id
   and i.org_id is null and c.org_id is null
   and i.direction = 'in'
   and lower(c.name) = 'fundraising'
   and lower(i.name) = 'grant';

-- ⚠⚠ CHANGING A PLATFORM WORD'S SOURCE LATER RE-FILES EVERY LINE ALREADY ON IT — deliberately,
-- and worth knowing before doing it again (/review, money lens, 2026-09-07). The kind follows the
-- word on every save, so after a reclassification the next time a coach saves an affected line for
-- ANY reason (an amount, a note) it moves to the section its word now implies. That is the point —
-- a line that disagreed with its word forever is the defect this exists to remove — but it means a
-- future reclassification is a decision about other people's plans, not a tidy-up. Only a migration
-- can make one: no coach or club write path accepts this column.
--
-- ⚠ AND IT CAN CHANGE WHERE A DERIVED POOL LANDS. `placeDerivedActual` puts a sponsor or drive
-- total as deep in the taxonomy as the claiming lines agree and no deeper, so a team that budgets
-- BOTH `Sponsorship → Team sponsorship` and `Fundraising → Grant` now has two sponsor claims in two
-- different CATEGORIES, and the pooled figure lands with no category at all rather than against
-- either line. That was already reachable before this migration (a coach could file a grant as
-- sponsorship); what changed is that it is now the only way a grant can be filed. It is the
-- strongest argument yet for the deferred question of whether Grant should also MOVE to the
-- Sponsorship category — where both claims would share one category and the pool would place there.
-- No existing team is affected: there are no Grant lines on either database.
comment on column budget_items.actual_source is
  'WHO REPORTS THIS WORD''S ACTUAL FIGURE (mig 280): ''typed'' = the coach records each arrival '
  'themselves, ''fundraiser'' = the team''s drives report it, ''sponsor'' = the team''s sponsors '
  'report it. ⚠ THIS IS WHAT A BUDGET LINE''S line_kind IS DERIVED FROM, so the add-a-line form '
  'asks ONE question (money out / money in) instead of two: direction ''out'' is always a cost, and '
  'on the ''in'' side fundraiser→funding, sponsor→sponsorship, typed→other_income. The mapping is '
  'the exact inverse of LINE_KIND_ACTUAL_SOURCE in lib/coach-budget-totals.ts and a unit test pins '
  'the two in step. ⚠ NOT NULL, default ''typed'' — a club- or coach-created word has no machinery '
  'behind it, and defaulting it to a derived source would CLOSE its rows to typed income records, '
  'which is the only way their money can be recorded (lib/coach-money-derived.ts: one row, one '
  'source). ⚠ Money-OUT words are ALWAYS ''typed'', enforced by budget_items_out_is_typed_check; '
  'safe because a word never changes sides (owner ruling 2026-08-17). ⚠ Coaches and club admins '
  'cannot edit it — no write path accepts it, so every word they create is ''typed''. ⚠ Grant is '
  '''sponsor'' while KEEPING its Fundraising category: a grant arrives as a cheque, but the '
  'category is the report''s shelf and moving it is a separate decision.';
