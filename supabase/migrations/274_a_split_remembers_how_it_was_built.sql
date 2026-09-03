-- 274: A SPLIT REMEMBERS HOW IT WAS BUILT — AND A FOURTH KIND OF MONEY IN
-- (COACH_BUDGET_TAB_REVAMP_PLAN §3 + §6.1 — owner rulings Q2 and Q5, 2026-09-02.)
--
-- THE CASE, PART ONE. A budget line's period split stored only its dated amounts; how the coach
-- BUILT it (by months, quarters, exact dates, or just names) was re-guessed on every reopen
-- (`inferSplitMode`). The guess was wrong in ways a coach could see: a quarters split whose label
-- was edited reopened as months, and ONE dateless period flipped the whole line into names mode,
-- hiding the date controls on rows with perfectly good dates. One nullable column ends the
-- guessing: the editor writes what the coach chose, and reads it back.
alter table rep_budget_lines
  add column if not exists split_mode text;

alter table rep_budget_lines
  add constraint rep_budget_lines_split_mode_check
  check (split_mode in ('months', 'quarters', 'dates', 'names'));

comment on column rep_budget_lines.split_mode is
  'HOW the period split was entered (months / quarters / dates / names) — owner ruling Q2, '
  '2026-09-02. NULL = written before this column (or no split): readers fall back to '
  'inferSplitMode, the guess this column retires. Written by the budget-line editor on every '
  'save; meaningless when the line has no rep_budget_periods rows. Never read by arithmetic — '
  'the period DATES stay the only thing Budget vs. Actual and the month grids consume.';

-- THE CASE, PART TWO (rides this migration so Phase E needs no second one). Money in that is
-- neither fundraising nor sponsorship — interest, a facility rebate, a plain donation — had no
-- kind, so it was either mis-filed as one of those or left out of the plan entirely. The CHECK
-- widens for 'other_income'; the shared reader (lib/coach-budget-totals.ts) is the one place the
-- vocabulary lives, and `budget-line-kind-guard` holds every consumer to it.
alter table rep_budget_lines
  drop constraint rep_budget_lines_line_kind_check;

alter table rep_budget_lines
  add constraint rep_budget_lines_line_kind_check
  check (line_kind in ('cost', 'funding', 'sponsorship', 'other_income'));

comment on column rep_budget_lines.line_kind is
  'Amount is always stored POSITIVE — the kind carries the sign. Costs less funding less '
  'sponsorship less other income is what players fund. cost = money the team spends; funding = '
  'expected fundraising (drives); sponsorship = a sponsor or grant, given directly (mig 237); '
  'other_income = money in that is neither (interest, a rebate, a plain donation — owner ruling '
  'Q5, 2026-09-02). Consumers must go through lib/coach-budget-totals.ts — never compare this '
  'column to a literal (tests/unit/budget-line-kind-guard.test.ts).';
