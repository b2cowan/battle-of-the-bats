-- ---------------------------------------------------------------
-- Migration 247 — club money belongs to a season (Money register, P3)
--
-- Owner ruling 2026-08-17: give club money a real season, now, rather than
-- letting the register show out-of-season rows or print a caveat.
--
-- ⚠⚠ WHAT WAS ACTUALLY WRONG. `rep_team_payment_requests` carried a TEAM and no
-- season. Every other figure behind the coach's "Cash on hand" is scoped to the
-- working program year — dues, fundraising, expenses, allocations — but approved
-- club funding and payments to the club were summed TEAM-LIFETIME and folded in
-- anyway. So a team in its second season read last season's club money into this
-- season's cash, and the register (which is working-season only, by ruling)
-- could never reproduce that figure.
--
-- This was already known and already refused elsewhere: lib/coach-season-
-- settlement.ts deliberately excludes club money from the season close-out pot,
-- says so on the card, and names the fix in a comment —
--   "Answering it properly means a program year on the payment-requests table
--    (a migration + a backfill), which is beyond this pass."
-- This is that migration. With it, club money enters the close-out pot and the
-- apology on the card retires.
--
-- ⚠ THE BACKFILL IS A YEAR MATCH, AND THAT IS THE FINEST GRAIN AVAILABLE.
-- `rep_program_years` carries no date range — only an integer `year` — so a
-- request is attributed by the calendar year it was RAISED in (`created_at`,
-- in the org's own reckoning is unnecessary here: the year boundary is the only
-- resolution being used, and no season is named by a year it does not contain).
-- Two fallbacks follow, in order, so no row is left behind:
--   1. the team's program year whose `year` matches created_at's year
--   2. the team's `active` program year
--   3. the team's newest program year
--
-- ⚠⚠ THE COLUMN ENDS UP NOT NULL, AND THE MIGRATION FAILS LOUDLY IF IT CANNOT.
-- A request that cannot be attributed to a season IS the bug being fixed, so
-- leaving a nullable column the readers assume is populated would ship the same
-- defect wearing a new column name. Every team is created with a program year,
-- so the expected orphan count is ZERO — step 3 reports it before step 4 tries.
-- If it is not zero, stop and look at those rows; do not weaken this.
--
-- ⚠ NOTHING ABOUT APPROVAL CHANGES. This adds a season to a record; it does not
-- touch status, the transfer RPC, or a single dollar.
-- ---------------------------------------------------------------

-- ── 1. The column ────────────────────────────────────────────────────────────
ALTER TABLE rep_team_payment_requests
  ADD COLUMN IF NOT EXISTS program_year_id uuid REFERENCES rep_program_years(id) ON DELETE CASCADE;

-- ── 2. Backfill: year match, then the active year, then the newest ───────────
-- One statement, one pass. The ORDER BY ranks the three rules in order, so a
-- team with several seasons resolves deterministically and a team with one
-- always resolves to it.
--
-- ⚠ A CORRELATED SUBQUERY, NOT `FROM LATERAL`. An UPDATE's target table is not
-- visible inside its own FROM list, so the lateral form is rejected outright
-- (42P10) rather than quietly doing something else.
UPDATE rep_team_payment_requests r
SET program_year_id = (
  SELECT y.id
  FROM rep_program_years y
  WHERE y.team_id = r.team_id
  ORDER BY
    (y.year = EXTRACT(YEAR FROM r.created_at)::int) DESC,
    (y.status = 'active') DESC,
    y.year DESC
  LIMIT 1
)
WHERE r.program_year_id IS NULL;

-- ── 3. Report what could not be attributed, BEFORE trying to constrain it ────
DO $$
DECLARE orphans int;
BEGIN
  SELECT count(*) INTO orphans FROM rep_team_payment_requests WHERE program_year_id IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Migration 247: % payment request(s) belong to a team with no program year and cannot be '
      'attributed to a season. Inspect them before re-running — do NOT make this column nullable.',
      orphans;
  END IF;
  RAISE NOTICE 'Migration 247: every payment request attributed to a season (0 orphans).';
END $$;

-- ── 4. Make it part of what the record IS ────────────────────────────────────
ALTER TABLE rep_team_payment_requests
  ALTER COLUMN program_year_id SET NOT NULL;

-- The read shape every caller now uses: this team, this season, by status.
CREATE INDEX IF NOT EXISTS rep_team_payment_requests_program_year_idx
  ON rep_team_payment_requests (team_id, program_year_id, status);

COMMENT ON COLUMN rep_team_payment_requests.program_year_id IS
  'The season this club request belongs to (mig 247). Before it existed, approved requests were '
  'summed team-LIFETIME into a Cash on hand figure whose every other input was season-scoped, and '
  'the season close-out pot excluded club money entirely because it could not be attributed. Both '
  'read this column now.';
