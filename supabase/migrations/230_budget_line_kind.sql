-- 230: A team budget line is a COST or EXPECTED FUNDING
-- (COACH_BUDGET_TOTALS_FUNDING_PLAN — owner ruling 2026-08-12).
--
-- Until now every rep_budget_lines row was a cost, so per-player dues were always
-- generated off gross spending. A team planning to raise $4,000 had nowhere to say so
-- and had to either charge families the full amount or do the subtraction in their head.
--
-- `funding` lines are money the team expects to bring IN — fundraising, sponsorship, a
-- club grant. Costs less expected funding is what players fund, and that is the basis
-- for per player and for the installment generator.
--
-- STORED POSITIVE, DISPLAYED NEGATIVE. The existing CHECK `total_amount > 0` stays
-- exactly as it is: the KIND carries the sign, never the amount. That keeps every
-- existing constraint, index and reader honest, and means a funding line's periods
-- reconcile to its total by the same ±$0.02 rule as a cost line.
--
-- DEFAULT 'cost' with no backfill: every existing row IS a cost, so the default states
-- the truth rather than guessing at it.
--
-- ⚠ Consumers must EXCLUDE funding lines from cost paths. Budget vs. Actual matches
-- actual expenses to a line by category NAME; a funding line is not an expense and must
-- never enter that match or the unbudgeted-actuals bucket. Its actual is the team's
-- share of fundraising (raised less what was rebated to the player who raised it).

alter table rep_budget_lines
  add column line_kind text not null default 'cost';

alter table rep_budget_lines
  add constraint rep_budget_lines_line_kind_check
  check (line_kind in ('cost', 'funding'));

comment on column rep_budget_lines.line_kind is
  'cost = money the team spends (the default, and what every pre-2026-08 row is); '
  'funding = money the team expects to bring in (fundraising, sponsorship, grant). '
  'Amount is always stored POSITIVE — the kind carries the sign. Costs less funding is '
  'what players fund, which drives per-player dues.';

-- The plan reads a team's lines by program year and then splits them by kind; the
-- existing (team_id, program_year_id) index already serves that. No new index.
