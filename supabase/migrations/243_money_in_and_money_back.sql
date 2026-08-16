-- 243 — Money in, money out, money back
-- (COACH_MONEY_IN_TAXONOMY_PLAN.md, which absorbed COACH_MONEY_BACK_ON_A_COST_PLAN.md —
--  owner-approved 2026-08-16, one release.)
--
-- Money going OUT has had a shared vocabulary since mig 240: a plan and a set of books line up row
-- for row on category → item. Money coming IN was still whatever a coach typed, there was no way to
-- record an arrival at all unless it came through a fundraiser, and there was no way at all to say
-- "we spent this and some of it came back."
--
-- ⚠⚠ WHY MONEY BACK IS ITS OWN RECORD AND NOT A NEGATIVE EXPENSE (money-back plan §6.4). Making it
-- a negative rep_team_expenses row would put a negative amount inside a table that ~20 readers sum
-- as spending — the exact failure the third `line_kind` member caused in 2026-08-15, where nineteen
-- readers kept compiling and quietly filed every sponsorship as a cost. A separate table cannot do
-- that: every existing sum keeps its sign because no existing reader can see these rows at all.
--
-- ⚠⚠ AND IT IS NOT "PAID OUT OF POCKET" (money-back plan §2). A coach describes both as "a parent
-- paid me back". Out of pocket means the team's cash never moved and the team now OWES that family
-- a credit (rep_team_expenses.paid_by_player_id, mig 234). Money back means the team's cash went
-- out and some returned, and the team owes nobody anything. Merging them credits a family twice or
-- loses a credit entirely. They are deliberately two tables apart.
--
-- ⚠ NO BACKFILL, anywhere. Money-in budget lines written before this keep working in the
-- "No category / Not itemized" bucket the rollup already has. Guessing which category a coach's
-- "Riverdale Auto" sponsorship belongs to is confident-and-wrong data.

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- 1. THE RECORD — one table, two kinds of arrival
-- ══════════════════════════════════════════════════════════════════════════════════════════════
--
-- Both kinds are money landing in the team's account on a given day, against a category and item.
-- What differs is what the report does with them, and that is `entry_kind`:
--
--   income     → revenue. Its own row under REVENUE.
--   money_back → contra. NETS into the row it repaid, and never appears as revenue.
--
-- ⚠ THE COACH DECIDES, AND ONLY THE COACH CAN. A club grant and a club reimbursement arrive as the
-- same amount, from the same club, on the same day. Nothing in this row's data distinguishes them,
-- which is exactly why the kind is asked outright on the form rather than inferred.
--
-- ⚠ Service-role only (coach API): RLS ENABLED with NO policies, so prod's default anon SELECT
-- grant cannot reach it (memory: reference_supabase_rls_grants) — the migs 225/228/231/232
-- treatment.

CREATE TABLE IF NOT EXISTS rep_team_money_in (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id uuid          NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  -- Denormalized scope, the same convenience copies every rep money table carries. org_id is
  -- NOT NULL from birth (the lesson from the installments table, 2026-06-09).
  org_id          uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id         uuid          REFERENCES rep_teams(id) ON DELETE CASCADE,

  entry_kind      text          NOT NULL
                                CHECK (entry_kind IN ('income', 'money_back')),

  -- ⚠ ALWAYS POSITIVE, both kinds. The kind carries the sign, never the amount — migration 230's
  -- rule, restated because this is the table most tempting to break it in.
  amount          numeric(10,2) NOT NULL CHECK (amount > 0),

  -- The day the money ARRIVED (org-timezone date, coach-typed, defaults to today in the UI).
  -- ⚠ A `date`, not a timestamptz, and the difference has bitten three screens: read it with
  -- formatStoredDate() (memory: reference_stored_date_formatting), never with a hand-rolled
  -- new Date(), or it prints a day early for half the country.
  received_date   date          NOT NULL,

  -- ⚠ WHAT THIS IS, in the vocabulary both reports group on (mig 240). SET NULL, never CASCADE:
  -- deleting a plan row or retiring an item must NEVER delete a record of money that moved. The
  -- row then reads in the "No category / Not itemized" bucket, which is honest.
  budget_category_id uuid       REFERENCES budget_categories(id) ON DELETE SET NULL,
  budget_item_id     uuid       REFERENCES budget_items(id) ON DELETE SET NULL,

  -- A note. ⚠ NEVER a grouping key — the ITEM names the row (owner ruling 2026-08-15). Optional
  -- on purpose: unlike an expense, nothing writes this onto a ledger entry as its only identity,
  -- because the entry is described from the item.
  description     text,
  notes           text,

  -- Who paid it back — a LABEL on the record, never a behaviour and never required (money-back
  -- plan §4.1). Meaningful only on money_back; the form does not offer it on income.
  received_from   text          CHECK (received_from IN ('club', 'vendor', 'sponsor', 'family', 'other')),

  -- One team-ledger income entry per record, dated received_date, so Cash on hand goes up on the
  -- day it arrived (money-back plan §4.4). SET NULL, not CASCADE: a voided ledger entry must never
  -- delete the record of the money — the app voids the entry, then deletes the row explicitly
  -- (the mig 236 lesson, applied from birth this time instead of six months late).
  accounting_entry_id uuid      REFERENCES accounting_entries(id) ON DELETE SET NULL,

  created_by      uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

-- The one read shape: a season's arrivals, grouped in the app. Same access pattern as
-- rep_team_expenses — load the year, group in memory.
CREATE INDEX IF NOT EXISTS idx_rep_team_money_in_year
  ON rep_team_money_in(program_year_id);
CREATE INDEX IF NOT EXISTS idx_rep_team_money_in_item
  ON rep_team_money_in(budget_item_id) WHERE budget_item_id IS NOT NULL;

COMMENT ON TABLE rep_team_money_in IS
  'Money ARRIVING on a rep team, in the same category+item vocabulary as spending (mig 243). '
  'entry_kind=income is revenue and gets its own report row; entry_kind=money_back is a refund, '
  'credit or reimbursement that NETS into the row it repaid and is never counted as income '
  '(counted twice, a $325 reimbursement makes a season look $650 better than it is). '
  'ISOLATED FROM rep_team_expenses ON PURPOSE: a refund is not a negative expense, so every '
  'existing sum over that table keeps its sign. NOT the out-of-pocket mechanism — that is '
  'rep_team_expenses.paid_by_player_id and it creates a credit the team OWES a family.';

COMMENT ON COLUMN rep_team_money_in.entry_kind IS
  'income = the team earned or was given this. money_back = it is returning what the team already '
  'spent (or, against an income item, reversing what it took). Only the coach can tell a grant '
  'from a reimbursement — they arrive as the same amount, from the same club, on the same day.';

COMMENT ON COLUMN rep_team_money_in.received_date IS
  'The day the money arrived, org-local. A refund is dated when it ARRIVED, never back-dated into '
  'the month the original cost was paid — that would rewrite a month already reported on and '
  'reconciled. A `date`: format with formatStoredDate(), not new Date().';

COMMENT ON COLUMN rep_team_money_in.budget_item_id IS
  'What this is, in the shared taxonomy (mig 240). On money_back it is what the money is paying '
  'you back FOR, and it may point at a cost item (reducing the cost) or an income item (reducing '
  'the income) — the report takes the direction from the row it lands on. ON DELETE SET NULL: '
  'retiring an item must never delete a record of money.';

COMMENT ON COLUMN rep_team_money_in.received_from IS
  'Optional label on a money_back record: club / vendor / sponsor / family / other. Never required '
  'and never a behaviour — in particular "family" here does NOT create or settle any dues credit.';

COMMENT ON COLUMN rep_team_money_in.accounting_entry_id IS
  'The team-ledger income entry this record posted, so a delete can void it. Cash on hand rises on '
  'received_date. ⚠ This is NOT Collections (player dues) and NOT funding in the plan.';

ALTER TABLE rep_team_money_in ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- 2. THE LIBRARY LEARNS WHICH WAY A WORD USUALLY POINTS
-- ══════════════════════════════════════════════════════════════════════════════════════════════
--
-- ⚠ A HINT THAT SORTS, NEVER A CONSTRAINT (plan §3.6). It groups the picker so a coach recording
-- income meets income words first — and everything stays reachable, because guessing wrong is
-- worse than not guessing. NULL is the default and the common case: anything a coach or a club
-- creates is untagged and works both ways.
--
-- ⚠ CATEGORIES ARE NEVER TAGGED. "Tournaments" holding both its revenue and its costs is the whole
-- point of the by-activity report — a direction on the category would make that shape impossible.

ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS direction text
    CHECK (direction IN ('in', 'out'));

COMMENT ON COLUMN budget_items.direction IS
  'Which way this word usually points: in = revenue, out = a cost, NULL = either (mig 243). A '
  'PICKER HINT that sorts and groups the list — never a constraint, and never consulted by the '
  'report, which takes a row''s direction from what was actually filed against it. NULL on every '
  'coach-created and club-created item by design.';

-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- 3. THE STARTING WORDS FOR MONEY IN (plan §3.6)
-- ══════════════════════════════════════════════════════════════════════════════════════════════

-- ── 3a. "Fundraising Costs" becomes "Fundraising" ────────────────────────────────────────────
--
-- ⚠ THE PLAN SAID NO NEW CATEGORY WAS NEEDED AND THAT WAS WRONG — there is no "Fundraising"
-- category, only "Fundraising Costs", and no "Sponsorship" at all. Renaming rather than adding a
-- second one is the correct fix and not merely the cheap one: a coach who runs a bottle drive
-- needs its revenue and its supplies in the SAME category, or the by-activity lens cannot answer
-- "did the drive pay for itself?" — which is the question that lens exists for. Ids are unchanged,
-- so every existing budget line and cost keeps pointing at the same row and simply reads better.
update budget_categories
   set name = 'Fundraising'
 where org_id is null
   and name = 'Fundraising Costs'
   and not exists (
     select 1 from budget_categories other
      where other.org_id is null and other.name = 'Fundraising'
   );

-- ── 3b. Sponsorship is a category of its own ─────────────────────────────────────────────────
-- It could have gone under Fundraising, but a sponsorship is a distinct budget line kind AND a
-- distinct record (rep_fundraisers.kind = 'sponsor'), and the plan's whole reason for splitting
-- it out in mig 237 was so a coach can ask "did our sponsorship hit the number?" separately.
-- Revenue-only is a perfectly good block in the by-activity lens.
insert into budget_categories (org_id, name, scope, sort_order, is_default, sports)
select null, 'Sponsorship', 'both', 10, true, null
 where not exists (
   select 1 from budget_categories where org_id is null and name = 'Sponsorship'
 );

-- ── 3c. The eight words ──────────────────────────────────────────────────────────────────────
--
-- ⚠ "Umpires & officials" SHIPS AS "Officials". The plan's table named it the first way; migrations
-- 241 and 242 exist precisely because diamond-only vocabulary reached basketball clubs, and 242's
-- own note says the check that caught it was reading what a basketball team would SEE. "Umpires" is
-- one of those words. Sport-neutral, sports = null, and the Officials CATEGORY keeps its
-- sport-tagged "Umpire Fees" / "Referee fees" for a team's own season officiating — this item is
-- for officials paid AS PART OF an event the team hosted, which is what puts it under Tournaments
-- where the by-activity lens can weigh it against that event's revenue.
insert into budget_items (category_id, org_id, name, sort_order, is_default, is_misc, sports, direction)
select c.id, null, v.name, v.sort_order, true, false, null, v.direction
  from (values
    ('Tournaments', 'Registration revenue', 10, 'in'),
    ('Tournaments', 'Concession revenue',   11, 'in'),
    ('Tournaments', 'Gate / admission',     12, 'in'),
    ('Tournaments', 'Officials',            13, 'out'),
    ('Fundraising', 'Fundraising drive',    10, 'in'),
    ('Fundraising', 'Merchandise sales',    11, 'in'),
    ('Fundraising', 'Grant',                12, 'in'),
    ('Sponsorship', 'Team sponsorship',     10, 'in')
  ) as v(category_name, name, sort_order, direction)
  join budget_categories c on c.org_id is null and c.name = v.category_name
 where not exists (
   select 1 from budget_items existing
    where existing.category_id = c.id and existing.org_id is null
      and lower(existing.name) = lower(v.name)
 );

-- ── 3d. The cost words already in the library point OUT ──────────────────────────────────────
-- Every platform default that existed before this migration is a spending word — the library was
-- built for a spending plan. Saying so is what makes the picker's income group meaningful; leaving
-- them NULL would put "Bats" and "Insurance" in the same undifferentiated list as "Grant".
-- ⚠ Only platform rows. A club's or a coach's own items stay untagged (plan §3.6).
update budget_items
   set direction = 'out'
 where org_id is null
   and direction is null
   and name not in ('Registration revenue', 'Concession revenue', 'Gate / admission',
                    'Fundraising drive', 'Merchandise sales', 'Grant', 'Team sponsorship');
