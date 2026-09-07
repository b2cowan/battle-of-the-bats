-- 281 — A payback says which debts it settles
-- (COACH_MONEY_CREDITS_AND_PAYBACKS_PLAN §3, owner ruling R5 — approved from mockup 3ac033cd,
-- 2026-09-07.)
--
-- Owner ruling, in his words: "what if we enforce actual money back on selecting transactions? …
-- if we don't let reimbursements be free to select their amounts but actually make them select the
-- ones we owe and calculate the sum ourselves, we can ensure that link exists and that should allow
-- us to flow this much more effectively through our reporting." And on the shape: "they could not
-- partially pay back 1 debt, they can wholely pay back 1 or more than 1 debt."
--
-- ⚠⚠ WHAT IS BROKEN TODAY. A payout carries NO link to the credit it refunded — this table is the
-- column that never existed — so which credit a coach handed back is decided by an ASSUMPTION, and
-- the product holds two of them. `splitFamilyOwnMoney` assumes a refund lands on the family's own
-- money first, and says so at the line. `lib/coach-dues-actual.ts` had to adopt the same assumption
-- on 2026-09-07 after the first cut walked the credits oldest-first — and on the UAT fixture that
-- difference sent $37.50 of Casey's cash into the fundraising line of a panel a coach can open,
-- while the dues screen told them the reverse. **The totals agreed either way. Only the story
-- differed, and only where a coach could read it.**
--
-- ⚠⚠ AND THIS IS THE CHEAPEST HOUR THIS CHANGE WILL EVER HAVE. Measured 2026-09-07: PRODUCTION HAS
-- ZERO ROWS IN `rep_dues_payouts`. Not few — none. Every payout in existence is on a dev fixture, so
-- there is no history to backfill and not one guessed link to write. Every real coach who hands
-- money back from here adds a record whose meaning would have to be inferred forever.
--
-- ⚠ SCOPED TO THE PAY OUT SHEET, AND THE PRODUCT ALREADY SAYS WHY. Money reaches a family through
-- two doors. `source = 'recorded'` is a coach handing back a specific thing, and every one of those
-- reverses a credit. `source = 'season_settlement'` is the year-end cheque, and the settlement route
-- states its own reason this table cannot serve it: "a settlement cheque covers a family's owed-back
-- money AND their share of the surplus, **and a share is not a credit**." Nothing here is required
-- of a settlement payout, and nothing here refuses one.
--
-- ⚠ `amount` EXISTS THOUGH THE RULING IS WHOLE-DEBTS-ONLY, deliberately (owner agreed 2026-09-07).
-- The form will never write a partial. But recording "this payout reverses this credit, FOR THIS
-- MUCH" makes a future partial a screen change; a bare link makes it a second migration. The
-- work is identical today, so the cheaper future is free.

create table if not exists rep_dues_payout_credits (
  id          uuid primary key default gen_random_uuid(),

  -- ⚠ CASCADE ON THE PAYOUT. Undoing a payback removes its links with it: a link to a payout that
  -- no longer exists is not history, it is a dangling claim on a credit that is standing again.
  payout_id   uuid not null references rep_dues_payouts(id) on delete cascade,

  -- ⚠⚠ RESTRICT ON THE CREDIT, AND IT IS THE POINT OF THE TABLE. A credit that has been handed back
  -- may not be deleted out from under the cash that left the account — that is the payout floor
  -- (`lib/dues-credit-guards.ts`), which six separate doors have to remember to ask. Once the link
  -- exists the database refuses it too, so a seventh door cannot forget. The guard stays: it gives
  -- the coach a sentence, where this gives them an error.
  credit_id   uuid not null references rep_dues_credits(id) on delete restrict,

  -- Positive, always. A payback that settles nothing is not a row.
  amount      numeric(12,2) not null check (amount > 0),

  -- ⚠ CARRIED FOR THE TENANT RAIL, not for convenience. Every coach-money read re-asserts org and
  -- team in its own WHERE rather than trusting a join to have done it.
  org_id      uuid not null references organizations(id) on delete cascade,
  team_id     uuid not null references rep_teams(id) on delete cascade,

  created_at  timestamptz not null default now(),

  -- ⚠⚠ UNIQUE ON THE CREDIT ALONE, NOT ON (payout, credit) — the true invariant under R5, and a
  -- review caught the weaker one before it left dev. "Whole credits only" means a credit is settled
  -- ONCE, EVER; a per-payout key would happily let TWO different payouts each claim the whole of one
  -- credit. That is not hypothetical: two coaches (or one double-click) both read "nothing paid back
  -- yet" before either writes, both pass the family-level cash ceiling because a SIBLING credit
  -- covers the total, and both link rows land. Cash stays correctly capped — but the credit now
  -- reads as settled twice over while its sibling reads untouched, which is precisely the
  -- misattribution this table exists to abolish.
  --
  -- ⚠ A CREDIT PART-SETTLED BY A PRE-281 PAYOUT STILL GETS ITS FIRST LINK. Legacy payouts carry no
  -- links at all, so they do not consume this key; the remainder is paid back once and recorded once.
  unique (credit_id)
);

-- ⚠⚠ RLS ENABLED WITH NO POLICIES — SERVICE-ROLE ONLY, the treatment every sibling gets.
-- `rep_dues_payouts`, `rep_dues_payments` and `rep_dues_credits` are all RLS-enabled; the first two
-- carry no policies at all, which is the deliberate shape for a table only the server may touch.
--
-- ⚠ IT IS THE SECOND LOCK, AND THAT IS WHY IT MATTERS EVEN THOUGH NOTHING IS EXPOSED TODAY. `anon`
-- and `authenticated` hold no SELECT on this table, so it is unreachable from a client right now —
-- this was measured, not assumed. But the grant is the first lock and grants get widened by accident;
-- RLS with no policies means a mistaken grant still denies instead of silently publishing every
-- family's refund history. The sibling tables have both locks; this one was shipped with one, and a
-- review caught it before it left dev.
alter table rep_dues_payout_credits enable row level security;

-- The two directions every reader actually asks: "what did this payback settle?" and — the hot one,
-- asked per family on every report build — "has this credit been handed back?"
create index if not exists idx_dues_payout_credits_payout on rep_dues_payout_credits (payout_id);
create index if not exists idx_dues_payout_credits_credit on rep_dues_payout_credits (credit_id);

-- ⚠ ORG LEADS ITS OWN INDEX (the repo's index-coverage ratchet asks this of every org_id column).
create index if not exists idx_dues_payout_credits_org_team on rep_dues_payout_credits (org_id, team_id);

comment on table rep_dues_payout_credits is
  'Which credits a payback settled, and for how much. Written by the Pay out sheet only '
  '(rep_dues_payouts.source = ''recorded''); a season-settlement cheque covers a share of the '
  'surplus as well as owed-back money, and a share is not a credit. Before mig 281 the link did '
  'not exist and readers assumed the allocation — see COACH_MONEY_CREDITS_AND_PAYBACKS_PLAN §3.';

comment on column rep_dues_payout_credits.amount is
  'What this payback took off this credit. Whole credits only today (owner ruling R5, 2026-09-07); '
  'the column exists so a partial is a screen change rather than a migration.';
