-- ---------------------------------------------------------------
-- Migration 030 — Fundraiser Module
-- Adds per-player fundraising tracking with automatic dues credits.
-- Income hits the team ledger at gross; the player rebate share is
-- posted as a rep_dues_credits row (credit_type = 'fundraiser').
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- rep_fundraisers: one fundraiser event per team per program year.
-- player_rebate_percent is the share of each player's gross that
-- is credited back to them as a dues reduction.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_fundraisers (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id               uuid          NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  program_year_id       uuid          NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  name                  text          NOT NULL,
  description           text,
  player_rebate_percent numeric(5,2)  NOT NULL DEFAULT 0
                                      CHECK (player_rebate_percent BETWEEN 0 AND 100),
  start_date            date,
  end_date              date,
  is_active             boolean       NOT NULL DEFAULT true,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- rep_fundraiser_entries: one row per player per fundraiser.
-- rebate_percent is snapshotted from the parent fundraiser at
-- entry time so that changing the fundraiser rate later does not
-- retroactively alter already-credited amounts.
-- rebate_amount is computed by the application (amount_raised *
-- rebate_percent / 100) and stored as a plain column.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_fundraiser_entries (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  fundraiser_id       uuid          NOT NULL REFERENCES rep_fundraisers(id) ON DELETE CASCADE,
  org_id              uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id             uuid          NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  player_id           uuid          NOT NULL REFERENCES rep_roster_players(id) ON DELETE CASCADE,
  amount_raised       numeric(10,2) NOT NULL CHECK (amount_raised >= 0),
  rebate_percent      numeric(5,2)  NOT NULL DEFAULT 0,
  rebate_amount       numeric(10,2) NOT NULL DEFAULT 0,
  accounting_entry_id uuid          REFERENCES accounting_entries(id) ON DELETE SET NULL,
  credit_id           uuid,         -- set after rep_dues_credits row is created; FK added below
  notes               text,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (fundraiser_id, player_id)
);

-- ---------------------------------------------------------------
-- Link dues credits back to the fundraiser entry that created them.
-- Also add the forward FK from entries → credits now that both
-- tables exist.
-- ---------------------------------------------------------------
ALTER TABLE rep_dues_credits
  ADD COLUMN IF NOT EXISTS fundraiser_entry_id uuid REFERENCES rep_fundraiser_entries(id) ON DELETE SET NULL;

ALTER TABLE rep_fundraiser_entries
  ADD CONSTRAINT fk_fundraiser_entry_credit
  FOREIGN KEY (credit_id) REFERENCES rep_dues_credits(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS rep_fundraisers_team_year_idx
  ON rep_fundraisers(team_id, program_year_id);

CREATE INDEX IF NOT EXISTS rep_fundraiser_entries_fundraiser_idx
  ON rep_fundraiser_entries(fundraiser_id);

CREATE INDEX IF NOT EXISTS rep_fundraiser_entries_player_idx
  ON rep_fundraiser_entries(player_id);

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
ALTER TABLE rep_fundraisers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_fundraiser_entries ENABLE ROW LEVEL SECURITY;

-- All org members can read fundraisers for their org
CREATE POLICY "read rep_fundraisers"
  ON rep_fundraisers FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Coaches write their own team's fundraisers; admin/owner/treasurer write any
CREATE POLICY "write rep_fundraisers"
  ON rep_fundraisers FOR ALL
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'treasurer')
    )
    OR team_id IN (
      SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
    )
  );

-- All org members can read fundraiser entries for their org
CREATE POLICY "read rep_fundraiser_entries"
  ON rep_fundraiser_entries FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Coaches write entries for their own team; admin/owner/treasurer write any
CREATE POLICY "write rep_fundraiser_entries"
  ON rep_fundraiser_entries FOR ALL
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'treasurer')
    )
    OR team_id IN (
      SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
    )
  );
