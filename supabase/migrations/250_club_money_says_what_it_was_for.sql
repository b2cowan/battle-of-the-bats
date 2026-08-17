-- ---------------------------------------------------------------
-- Migration 250 — club money says what it was for (Money redesign, P4)
--
-- Owner ruling 2026-08-17, and the owner asked the question that found this:
-- *"shouldn't the request [name] which budget category/item each request should
-- be tied to so it will be mapped properly?"*
--
-- ⚠⚠ WHAT WAS ACTUALLY WRONG — AND IT IS NOT A MISSING NICETY, IT IS A WHOLE
-- CLASS OF MONEY ABSENT FROM THE COACH'S REPORT.
--
-- `budget-vs-actual/route.ts` reads: the budget plan, `rep_team_expenses`,
-- `rep_team_money_in`, realised fundraiser entries and dues. It does NOT read
-- `rep_allocation_installments` and it does NOT read `rep_team_payment_requests`
-- — grep either name in that file and there is not one hit. So on a club-run
-- team:
--
--   * every dollar of the club's bill the team pays  → absent from the report
--   * every cost the club agrees to cover            → absent from the report
--
-- On a club-run team the club's allocation is frequently the single largest
-- line of the season, and the screen whose entire job is "how did we do against
-- plan?" has never seen it. The same shape as the three Cash-on-hand defects P3
-- found: a figure a coach reasonably trusts, quietly missing an input.
--
-- The CAUSE is this migration's subject. Club money carries no team-side
-- classification at all, so even a report that went looking for it would have
-- nothing to file it under:
--
--   * `rep_allocation_splits`        — no category, no item, nothing.
--   * `rep_team_payment_requests`    — has `budget_line_id`, and it is a TRAP:
--     that FK points at `org_budget_lines`, the CLUB's accounting budget, not
--     the team's `rep_budget_lines` (the dual-budget-line trap, DATA_DICTIONARY
--     "money traps" §3). No coach-facing surface has ever written it, and it
--     could not carry a team's own vocabulary if one did.
--
-- ⚠ THE FILING GOES ON THE SPLIT, NOT ON `rep_cost_allocations`. The allocation
-- is the CLUB's object, spanning every team it was divided across; the split is
-- THIS team's share. The club cannot file it — they do not know this team's
-- vocabulary, and two teams may legitimately file one shared cost under
-- different words. So the coach files their own share, once per split rather
-- than once per instalment: the instalments are a payment schedule for one
-- thing, and asking a coach the same question four times would invite four
-- answers.
--
-- ⚠⚠ BOTH COLUMNS, ALWAYS, ON BOTH TABLES — and this is not belt-and-braces.
-- Budget vs. Actual reads the two levels in DIFFERENT ORDERS: month attribution
-- takes the stored category first and falls back to the item's; cost placement
-- derives from the item first and falls back to the stored one. A row carrying
-- only one of them reports under two different headings depending on which part
-- of the page is asking. The rule is already written down in
-- `lib/coach-budget-item-usage.ts` (`categoryColumn`) — this migration is the
-- fifth and sixth tables to obey it.
--
-- ⚠⚠ THESE TWO TABLES MUST BE REGISTERED IN `BUDGET_ITEM_REFERENCES`
-- (lib/coach-budget-item-usage.ts) IN THE SAME COMMIT. That list is what the
-- delete/fold/publish guards count from, and
-- `tests/unit/budget-item-references-guard.test.ts` reads the committed schema
-- snapshot and FAILS THE BUILD on a foreign key to `budget_items` the list does
-- not cover. That guard belongs to the concurrent budget-item-integrity
-- project; adding rows to its list is the whole point of it existing, and
-- shipping this migration without them would re-create — on two new tables —
-- the exact defect that project was opened to fix.
--
-- ⚠ NULLABLE, DELIBERATELY, AND NO BACKFILL IS POSSIBLE. Unlike migration 247's
-- season (which is derivable from a date), only a coach can say what a club
-- bill was FOR. Guessing would put invented classifications into a report a
-- treasurer reconciles. Existing club money therefore reads in the report's
-- existing "Not itemized" bucket — the honest answer — and a coach can file it
-- at any time, because nothing on a saved record is read-only (owner,
-- 2026-08-16).
--
-- ⚠ SET NULL, NEVER CASCADE, on both FKs — migration 243's rule, restated
-- because it is the one that matters: retiring a budget word must never delete
-- the record of money that moved.
--
-- ⚠ THE PICKER OFFERS THE MONEY-**OUT** SIDE ON ALL THREE KINDS, including a
-- request where the money comes IN. That is not an oversight, it is the refund
-- rule (mig 246 + P2): the tick box flips the money, never the list, because
-- what a reimbursement is FOR is a cost. A club covering a $325 entry fee is a
-- reimbursement against `Tournaments · Entry fees`; it is not a new kind of
-- revenue and it must not be filed as one. `rep_team_money_in`'s own table
-- comment already spells out the consequence of getting this backwards —
-- "counted twice, a $325 reimbursement makes a season look $650 better than it
-- is". No enum, no CHECK, no column enforces the side here; the write paths
-- and the picker do, exactly as they do for `rep_team_money_in`.
--
-- ⚠ NOTHING ABOUT APPROVAL, SETTLEMENT OR A DOLLAR CHANGES. This adds a
-- classification to two records. It does not touch status, the transfer RPC,
-- an amount, a due date or a payment schedule.
--
-- Safety: additive only, both columns nullable with no default. Every statement
-- is IF NOT EXISTS, so re-running is a no-op.
--
-- Applies to: DEV. Production is a separate, explicit owner step.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. What the team asked the club for ─────────────────────────────────────
ALTER TABLE rep_team_payment_requests
  ADD COLUMN IF NOT EXISTS budget_category_id uuid REFERENCES budget_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS budget_item_id     uuid REFERENCES budget_items(id)      ON DELETE SET NULL;

-- ── 2. What the club billed this team for ───────────────────────────────────
ALTER TABLE rep_allocation_splits
  ADD COLUMN IF NOT EXISTS budget_category_id uuid REFERENCES budget_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS budget_item_id     uuid REFERENCES budget_items(id)      ON DELETE SET NULL;

-- ── 3. Every new foreign key followable backwards ───────────────────────────
-- Migration 249's rule, applied at birth rather than in a later sweep: a column
-- counts as covered only when it LEADS a usable index. Partial on the item
-- columns (mig 243's convention on the same shape) — the reverse lookup that
-- matters is "which club records point at this word", and a NULL never answers
-- it. The category columns take plain indexes: the report groups by category
-- across every row, NULLs included.
CREATE INDEX IF NOT EXISTS rep_team_payment_requests_budget_item_idx
  ON rep_team_payment_requests (budget_item_id) WHERE budget_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rep_team_payment_requests_budget_category_idx
  ON rep_team_payment_requests (budget_category_id);

CREATE INDEX IF NOT EXISTS rep_allocation_splits_budget_item_idx
  ON rep_allocation_splits (budget_item_id) WHERE budget_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rep_allocation_splits_budget_category_idx
  ON rep_allocation_splits (budget_category_id);

-- ── 4. Say what they are, on the columns themselves ─────────────────────────
COMMENT ON COLUMN rep_team_payment_requests.budget_item_id IS
  'What this request is FOR, in the team''s own shared taxonomy (mig 250). Chosen from the '
  'money-OUT side of the library on BOTH request directions: a request where the club covers a '
  'cost is a reimbursement against that cost, not a new kind of revenue — the same rule that makes '
  'a refund choose from the expense list. Without this column, approved club money reached no part '
  'of Budget vs. Actual at all. ⚠ NOT the same thing as budget_line_id, which points at the CLUB''s '
  'org_budget_lines and is written by no coach-facing surface.';

COMMENT ON COLUMN rep_team_payment_requests.budget_category_id IS
  'The category of budget_item_id, stored beside it because Budget vs. Actual reads the two levels '
  'in different orders (month attribution prefers the stored category; cost placement derives from '
  'the item). Derived from the chosen item by the write path, never trusted from the caller.';

COMMENT ON COLUMN rep_allocation_splits.budget_item_id IS
  'What the club''s bill to THIS team was for, in the team''s own taxonomy (mig 250). Filed by the '
  'COACH, not the club: the parent rep_cost_allocations row spans every team it was divided across '
  'and the club does not know any one team''s vocabulary. One filing per split, not per instalment — '
  'the instalments are a payment schedule for a single thing. NULL until a coach files it, which '
  'reads as the report''s existing "Not itemized" bucket.';

COMMENT ON COLUMN rep_allocation_splits.budget_category_id IS
  'The category of budget_item_id — see the matching column on rep_team_payment_requests for why '
  'both levels are stored on every row that carries one.';

COMMIT;
