-- 232_rep_dues_payments.sql
-- Coach Dues Payment Record, Pass 1 (COACH_DUES_PAYMENT_RECORD_PLAN.md — all six owner rulings
-- 2026-08-13). An installment is a PLAN (what is due, when); a payment is a FACT (what arrived,
-- when, how much). Until now the installment row was both the bill and the receipt: `paid_at`
-- was a stamp with no amount, so a family paying $100/month against $300 quarterly installments
-- could not be recorded at all, and the only field that accepted a partial dollar figure
-- (rep_dues_credits) posts nothing to the team ledger.
--
-- ⚠ WHAT `paid_at` MEANS AFTER THIS MIGRATION: it stays on rep_player_dues_installments and every
-- existing reader keeps working, but it becomes a PROJECTION maintained by the app — set when
-- recorded payments fully cover an installment (coverage runs already-stamped-first, then by
-- installment number), cleared if a payment is removed and coverage shrinks. It is no longer an
-- input anywhere; payments are. The 1:1 backfill below means the stamped set is IDENTICAL before
-- and after this migration — sums match per player, so nothing visible moves.
--
-- ⚠ LEDGER: one income entry per payment, dated the day the money ARRIVED (owner ruling 3), via
-- the app. This migration does NOT touch accounting_entries — the backfill ADOPTS each stamped
-- installment's existing entry (ruling 2: no dual read path, no deleted rows, no re-posting).
--
-- ⚠ OVERPAYMENT (ruling 5): an amount beyond everything left on the schedule auto-creates an
-- 'overpayment' rep_dues_credits row. `payment_id` below is what ties that credit to its payment
-- so removing the payment removes the credit with it (ON DELETE CASCADE) — a credit that outlives
-- the money that created it would be a phantom refund at season's end.
--
-- ⚠ Service-role only (coach API): RLS ENABLED with NO policies, so prod's default anon SELECT
-- grant cannot reach it (memory: reference_supabase_rls_grants) — same treatment as migs 225/228/231.
-- (rep_dues_credits, from mig 029, carries its own legacy auth-based policies; untouched here.)

CREATE TABLE IF NOT EXISTS rep_dues_payments (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id uuid          NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  player_id       uuid          NOT NULL REFERENCES rep_roster_players(id) ON DELETE CASCADE,
  -- Denormalized scope, same lesson as the installments table (mig fix 2026-06-09): org_id is
  -- NOT NULL from birth; team_id is the same convenience copy installments carry.
  org_id          uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id         uuid          REFERENCES rep_teams(id) ON DELETE CASCADE,
  amount          numeric(10,2) NOT NULL CHECK (amount > 0),
  -- The day the money ARRIVED (org-timezone date, coach-typed, defaults to today in the UI).
  -- This is the fact the whole project exists to record; the row's created_at is merely when it
  -- was typed in.
  received_date   date          NOT NULL,
  method          text          NOT NULL DEFAULT 'other'
                                CHECK (method IN ('etransfer', 'cash', 'cheque', 'other')),
  note            text,
  -- One income entry per payment. SET NULL (not CASCADE): a voided/removed ledger entry must
  -- never delete the receipt row — the app voids the entry then deletes the payment explicitly.
  accounting_entry_id uuid      REFERENCES accounting_entries(id) ON DELETE SET NULL,
  -- 'migrated_mark_paid' rows are the ruling-2 backfill: one synthetic payment per installment
  -- that was stamped paid before this table existed, adopting its ledger entry. Never written by
  -- the app after this migration.
  source          text          NOT NULL DEFAULT 'recorded'
                                CHECK (source IN ('recorded', 'migrated_mark_paid')),
  created_by      uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

-- The one read shape: a season's payments, grouped by player in the app (same access pattern as
-- rep_dues_credits). received_date is not indexed — every reader loads the season and sorts.
CREATE INDEX IF NOT EXISTS idx_rep_dues_payments_year_player
  ON rep_dues_payments(program_year_id, player_id);

COMMENT ON TABLE rep_dues_payments IS
  'A dues payment FACT: what arrived, when, how much (coach rep dues). Installments are the plan; '
  'coverage is derived oldest-first (stamped-first) and projected onto installments.paid_at. One '
  'team-ledger income entry per payment, dated received_date. source=migrated_mark_paid rows are '
  'the one-time backfill of pre-payment-record paid stamps, adopting their existing ledger entries.';

ALTER TABLE rep_dues_payments ENABLE ROW LEVEL SECURITY;

-- ── Overpayment credit back-link ─────────────────────────────────────────────────────────────
-- Auto-created 'overpayment' credits ride their payment. Manual credits leave this NULL.
ALTER TABLE rep_dues_credits
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES rep_dues_payments(id) ON DELETE CASCADE;

COMMENT ON COLUMN rep_dues_credits.payment_id IS
  'Set only on overpayment credits auto-created by recording a dues payment larger than what was '
  'left on the schedule (owner ruling 2026-08-13: automatic, no prompt). CASCADE: removing the '
  'payment removes the credit it created. Manual credits: NULL.';

-- ── Backfill (ruling 2): every stamped installment becomes ONE payment ───────────────────────
-- amount = the installment's own amount (that is what the stamp meant), received on the org-local
-- day of the stamp (all current orgs are America/Toronto — same clock tournamentToday() used when
-- the stamp was written), adopting the installment's ledger entry. created_at preserves the stamp
-- instant so "recorded on" history reads true. Idempotent: an entry-linked row is keyed by its
-- adopted entry; an entry-less stamp (pre-ledger data, if any) by its exact fact tuple.
INSERT INTO rep_dues_payments
  (program_year_id, player_id, org_id, team_id, amount, received_date, method, note,
   accounting_entry_id, source, created_by, created_at)
SELECT
  s.program_year_id,
  i.player_id,
  i.org_id,
  i.team_id,
  i.amount,
  (i.paid_at AT TIME ZONE 'America/Toronto')::date,
  'other',
  'Migrated from installment #' || i.installment_number || ' marked paid',
  i.accounting_entry_id,
  'migrated_mark_paid',
  NULL,
  i.paid_at
FROM rep_player_dues_installments i
JOIN rep_player_dues_schedules s ON s.id = i.schedule_id
WHERE i.paid_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM rep_dues_payments p
    WHERE p.source = 'migrated_mark_paid'
      AND (
        (i.accounting_entry_id IS NOT NULL AND p.accounting_entry_id = i.accounting_entry_id)
        OR (i.accounting_entry_id IS NULL
            AND p.player_id = i.player_id
            AND p.program_year_id = s.program_year_id
            AND p.amount = i.amount
            AND p.created_at = i.paid_at)
      )
  );
