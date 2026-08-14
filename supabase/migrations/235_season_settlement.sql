-- 235 — The refund sheet derives (Pass 3 of the season-refund revamp).
--
-- The typed pot dies here. Passes 1 and 2 gave credits a place to land and a way out; this
-- migration carries the last two things the settlement sheet needs to be a SETTLEMENT screen
-- rather than a calculator:
--
--   · rep_season_surplus.hold_back_amount — the ONE control left on the pot card. Not a figure
--     to reconcile: a stated intention ("keep $500 for next year's equipment"). Everything else
--     on that card is derived on read (lib/season-settlement.ts) and shows its work.
--
--   · rep_season_refund_adjustments — a family taking something other than an even share
--     (owner Call 10). Two kinds only, and NEITHER can leave the rows failing to re-add to the
--     pot: 'fixed' replaces that family's SHARE with an amount (never their owed-back money,
--     which is theirs and not a distribution the coach can redirect), and 'no_share' takes them
--     out of the divisor, which RAISES everyone else's share rather than stranding one.
--
-- ⚠ FORGIVENESS IS NOT HERE. It is a CREDIT (credit_type 'forgiven', mig 233) because it
-- genuinely reduces what a family owes — which is precisely what a credit does. One mechanism,
-- per the standing no-parallel-systems constraint; it is excluded from owed-back by type.
--
-- ⚠ NOTHING ABOUT THE DISTRIBUTION IS STORED beyond these choices. Who gets what is derived at
-- read time from cash, credits, payouts and these rows — the same discipline as payment coverage
-- (mig 232) and credit application (mig 233), for the same reason: a stored allocation goes
-- stale the moment a dollar moves.

-- ── The hold-back ────────────────────────────────────────────────────────────────────────────
ALTER TABLE rep_season_surplus
  ADD COLUMN IF NOT EXISTS hold_back_amount numeric(10,2) NOT NULL DEFAULT 0
    CHECK (hold_back_amount >= 0);

COMMENT ON COLUMN rep_season_surplus.hold_back_amount IS
  'What the coach intends to keep for next season (owner ruling 2026-08-14, Pass 3). Comes out '
  'of the SURPLUS only — capped there on write and on read (lib/season-settlement.ts), and '
  'refused against owed-back money: a coach may not hold back what the team owes families.';

-- ⚠ total_surplus is now LEGACY — READ BY NOTHING. It held the number a coach typed into the
-- Season Refund Calculator, which Pass 3 deleted (the typed figure double-subtracted fundraising
-- rebates and could not be reconciled with anything). It is RETAINED rather than dropped because
-- dropping it loses history on both databases; every reader has moved to the derived pot. A live
-- column nothing reads is itself a drift smell, which is why it says so in its own comment and
-- in the dictionary.
COMMENT ON COLUMN rep_season_surplus.total_surplus IS
  'LEGACY, read by nothing since Pass 3 (2026-08-14). The hand-typed season pot from the old '
  'Season Refund Calculator; the pot is now DERIVED (lib/season-settlement.ts) from uncapped '
  'dues receipts, fundraising raised, org funding, cash out and what the team owes families. '
  'Retained for history only — do not read it, do not write it.';

COMMENT ON TABLE rep_season_surplus IS
  'One row per season holding the settlement SETTINGS (hold_back_amount, notes). Since Pass 3 '
  '(2026-08-14) it no longer holds the pot — that derives. total_surplus is legacy.';

-- ── Hand-set distribution choices (owner Call 10) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rep_season_refund_adjustments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id uuid NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  player_id       uuid NOT NULL REFERENCES rep_roster_players(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id         uuid NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  -- 'fixed'    — this family's share is `amount` instead of an even one.
  -- 'no_share' — this family takes no share at all; `amount` is 0 and ignored.
  kind            text NOT NULL CHECK (kind IN ('fixed', 'no_share')),
  amount          numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  note            text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- One choice per family per season. Choosing "an even share" DELETES the row rather than
  -- storing a third kind: the default needs no record, and a stored default is a fact that can
  -- go stale against a rule that later changes.
  UNIQUE (program_year_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_rep_season_refund_adjustments_year
  ON rep_season_refund_adjustments (program_year_id);

-- Service-role only, like rep_dues_payments and rep_dues_payouts: RLS on, no policies. Every
-- reader goes through the coach API's capability checks, never straight from the browser.
ALTER TABLE rep_season_refund_adjustments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE rep_season_refund_adjustments IS
  'A family taking something other than an even share of the season surplus (owner Call 10, '
  '2026-08-14). ''fixed'' replaces the SHARE with an amount; ''no_share'' removes the family '
  'from the divisor, raising everyone else''s share. Never touches owed-back money — that is the '
  'family''s own, not a distribution the coach can redirect. Absence = an even share.';

COMMENT ON COLUMN rep_season_refund_adjustments.amount IS
  'Dollars, meaningful only when kind = ''fixed''. Clamped to the surplus on read '
  '(lib/season-settlement.ts) so the rows can never promise more than the pot holds.';
