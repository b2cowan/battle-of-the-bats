-- 237: A money-in record is a FUNDRAISER or a SPONSOR
-- (COACH_SPONSORSHIPS_PLAN — owner-approved from mockup, 2026-08-15).
--
-- Until now the portal had one shape for money in, and it was the drive's: "what did each
-- player raise?" A sponsorship has no answer to that question. Recording one $500 sponsor meant
-- creating a "fundraiser" and logging an amount against a single player while the other fourteen
-- roster rows sat at "—" forever, and the sponsor's own name — the important fact — had nowhere
-- to go but a note.
--
-- THE KIND DECIDES WHAT A ROW IS. A fundraiser's rows are players; a sponsor IS one row, one
-- arrival. That is the whole distinction, and everything else follows from it.
--
-- ⚠ A SPONSOR REUSES THE ENTRY MACHINERY rather than growing a parallel one: one record plus
-- exactly ONE entry, which already carries an amount, a credit, the income-entry link and the
-- credit link. Totals, exports, the archive and deletion therefore work unchanged. The price is
-- the third statement below — an entry may now have no player — and that is a real change to a
-- shape ~20 readers assume.

-- ── 1. The kind ─────────────────────────────────────────────────────────────────────────────
-- DEFAULT 'fundraiser' with no backfill: every existing row IS a drive, so the default states
-- the truth rather than guessing at it (the 230 precedent).
alter table rep_fundraisers
  add column kind text not null default 'fundraiser';

alter table rep_fundraisers
  add constraint rep_fundraisers_kind_check
  check (kind in ('fundraiser', 'sponsor'));

comment on column rep_fundraisers.kind is
  'fundraiser = the whole team takes part; its rows are roster players (the default, and what '
  'every pre-2026-08-15 row is). sponsor = one business/grant/arrival; the record IS the row and '
  'carries exactly one entry. Create-time only — a drive''s rows are players and a sponsor is a '
  'single arrival, so switching afterwards has nothing sensible to do with what is recorded.';

-- ── 2. Pledged vs received ──────────────────────────────────────────────────────────────────
-- A promised $300 that has not arrived is real to a treasurer and was invisible. It is NULL on a
-- drive, whose own is_active already says whether it is still running.
--
-- ⚠ PLEDGED MEANS NO MONEY YET. The entry exists (it records the arrangement) but no accounting
-- income row and no dues credit are created until this flips to 'received'. Budget vs. Actual
-- counts receipts only — a pledge that counted as actual would flatter the season.
alter table rep_fundraisers
  add column sponsor_status text;

alter table rep_fundraisers
  add constraint rep_fundraisers_sponsor_status_check
  check (
    (kind = 'sponsor'     and sponsor_status in ('pledged', 'received'))
    or (kind = 'fundraiser' and sponsor_status is null)
  );

comment on column rep_fundraisers.sponsor_status is
  'sponsor only: pledged = promised, not arrived, NO income entry and NO dues credit exist yet; '
  'received = the money is in and both have been written. NULL on a fundraiser.';

-- ── 3. An entry may have no player ──────────────────────────────────────────────────────────
-- ⚠ THIS IS THE STATEMENT THAT REACHES EXISTING CODE. A club-wide sponsor belongs to no family,
-- so the entry that records it has no player. Every reader that assumed a player must now handle
-- its absence — the per-player leaderboard, the credit writer, the exports, the dues joins.
-- A FUNDRAISER's entry still always has one; nothing enforces that in the database because the
-- constraint would have to reach across to the parent's kind on every insert, and the write path
-- that creates them is the single place that knows.
alter table rep_fundraiser_entries
  alter column player_id drop not null;

comment on column rep_fundraiser_entries.player_id is
  'The roster player this amount belongs to. NULL only on a SPONSOR''s entry that no family '
  'brought in (a club-wide sponsor) — a fundraiser entry always names a player. A null player '
  'means no dues credit is possible: there is nobody to credit.';

-- ── 4. The team's standard split ────────────────────────────────────────────────────────────
-- Most teams run one share all year and were retyping it on every drive. It FILLS IN, it does not
-- govern: every record can still differ, and changing it touches nothing already recorded — the
-- same rule the per-drive rebate already follows, where each entry snapshots the rate it was
-- logged at. Per SEASON rather than per team, because a team's standard can change year to year
-- and a finished season must keep the one it ran on.
alter table rep_program_years
  add column default_player_credit_percent numeric not null default 0;

alter table rep_program_years
  add constraint rep_program_years_default_credit_check
  check (default_player_credit_percent >= 0 and default_player_credit_percent <= 100);

comment on column rep_program_years.default_player_credit_percent is
  'Team-wide default share (0-100) a player keeps of what they raise or bring in. Pre-fills the '
  'new-fundraiser and new-sponsor forms only. Never applied retroactively.';

-- ── 5. Sponsorship is its own budget kind ───────────────────────────────────────────────────
-- ⚠ THIS KNOWINGLY REOPENS THE 2026-08-13 NAMING RULING, which made `funding` read as "Expected
-- fundraising" and said in its own comment that it covered sponsors and grants. That was the
-- problem: sponsorship money was already in every plan, invisible, so "did our sponsorship hit
-- the number?" could not be answered. Owner ruling 2026-08-15: split it.
--
-- Same maths as `funding` — both subtract from what the season costs, so per-player dues and the
-- installment generator are untouched. Only the reporting separates.
alter table rep_budget_lines
  drop constraint rep_budget_lines_line_kind_check;

alter table rep_budget_lines
  add constraint rep_budget_lines_line_kind_check
  check (line_kind in ('cost', 'funding', 'sponsorship'));

comment on column rep_budget_lines.line_kind is
  'cost = money the team spends (the default, and what every pre-2026-08 row is); '
  'funding = expected FUNDRAISING (the team selling something); '
  'sponsorship = expected SPONSORSHIP or a grant (money given directly). '
  'Amount is always stored POSITIVE — the kind carries the sign. Costs less funding less '
  'sponsorship is what players fund, which drives per-player dues. funding and sponsorship differ '
  'only in reporting: both reduce what families pay, identically.';

-- A sponsor is found by kind on the team's season, alongside its drives — the existing
-- (team_id, program_year_id) index on rep_fundraisers already serves that. No new index.
