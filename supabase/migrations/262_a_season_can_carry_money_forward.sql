-- 262: a season can carry money forward (owner ruling 2026-08-23, Option D; built as D-2).
--
-- Until now every season's book started at exactly zero, and that was TRUE rather than a
-- convention: `cashOnHandCents` says so in its own header, because migration 247 season-scoped
-- the last figure that could have leaked across a year boundary. It stops being true the moment a
-- team rolls forward with money in the bank — the closing balance of one season is the opening
-- balance of the next, and without somewhere to put it the new season's register, its Cash on
-- hand and its Budget vs. Actual all report a team that is poorer than it is.
--
-- `opening_balance` is nullable and means "nothing was carried" when NULL — deliberately not a
-- DEFAULT 0, because "we started at zero" and "nobody has said" are the same number and different
-- facts: the report hides the row entirely for the second, and a first season shows no line rather
-- than a line of zeroes.
--
-- `opening_balance_from_year_id` is the PROVENANCE the settings row reads back ("Carried from the
-- 2026 Season when this one was started"). NULL when a coach typed the figure themselves for a
-- team whose first season began mid-stream with money already in the bank. ON DELETE SET NULL: a
-- deleted season must never take a live season's opening balance with it — the money was carried,
-- and the handoff is finished the moment it lands (there is no live link back).

ALTER TABLE rep_program_years
  ADD COLUMN opening_balance numeric(12,2),
  ADD COLUMN opening_balance_from_year_id uuid
    REFERENCES rep_program_years(id) ON DELETE SET NULL;

COMMENT ON COLUMN rep_program_years.opening_balance IS
  'Cash the team was already holding on day one of this season. NULL = nothing carried (the report and the register hide the line entirely). Set at Start next season from the closing season''s own register figure, corrected in Team settings -> Money.';
COMMENT ON COLUMN rep_program_years.opening_balance_from_year_id IS
  'Which season the opening balance was carried FROM. NULL when a coach set it by hand. A handoff, not a live link: nothing reaches back to the source season after the carry.';
