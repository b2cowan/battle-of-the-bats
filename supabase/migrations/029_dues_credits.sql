-- Migration 029: Player dues credits and season surplus/refund allocation
-- rep_dues_credits: stores credit events that reduce a player's dues balance
-- rep_season_surplus: stores season-end surplus for refund allocation

-- ── rep_dues_credits ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rep_dues_credits (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id uuid         NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  player_id       uuid         NOT NULL REFERENCES rep_roster_players(id) ON DELETE CASCADE,
  amount          numeric(10,2) NOT NULL CHECK (amount > 0),
  description     text         NOT NULL,
  credit_date     date         NOT NULL DEFAULT CURRENT_DATE,
  credit_type     text         NOT NULL DEFAULT 'contribution'
                               CHECK (credit_type IN ('contribution', 'fundraiser', 'overpayment', 'other')),
  notes           text,
  created_by      uuid         REFERENCES auth.users(id),
  created_at      timestamptz  DEFAULT now()
);

ALTER TABLE rep_dues_credits ENABLE ROW LEVEL SECURITY;

-- Coaches on the team can read, insert, delete
CREATE POLICY "coaches_select_rep_dues_credits" ON rep_dues_credits
  FOR SELECT USING (
    program_year_id IN (
      SELECT py.id FROM rep_program_years py
      JOIN rep_teams t ON t.id = py.team_id
      JOIN rep_team_coaches c ON c.team_id = t.id
      WHERE c.user_id = auth.uid()
    )
    OR program_year_id IN (
      SELECT py.id FROM rep_program_years py
      JOIN rep_teams t ON t.id = py.team_id
      JOIN organization_members om ON om.organization_id = t.org_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'treasurer')
    )
  );

CREATE POLICY "coaches_insert_rep_dues_credits" ON rep_dues_credits
  FOR INSERT WITH CHECK (
    program_year_id IN (
      SELECT py.id FROM rep_program_years py
      JOIN rep_teams t ON t.id = py.team_id
      JOIN rep_team_coaches c ON c.team_id = t.id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "coaches_delete_rep_dues_credits" ON rep_dues_credits
  FOR DELETE USING (
    program_year_id IN (
      SELECT py.id FROM rep_program_years py
      JOIN rep_teams t ON t.id = py.team_id
      JOIN rep_team_coaches c ON c.team_id = t.id
      WHERE c.user_id = auth.uid()
    )
  );

-- ── rep_season_surplus ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rep_season_surplus (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id uuid          NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  UNIQUE (program_year_id),
  total_surplus   numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_surplus >= 0),
  notes           text,
  created_by      uuid          REFERENCES auth.users(id),
  created_at      timestamptz   DEFAULT now(),
  updated_at      timestamptz   DEFAULT now()
);

ALTER TABLE rep_season_surplus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaches_select_rep_season_surplus" ON rep_season_surplus
  FOR SELECT USING (
    program_year_id IN (
      SELECT py.id FROM rep_program_years py
      JOIN rep_teams t ON t.id = py.team_id
      JOIN rep_team_coaches c ON c.team_id = t.id
      WHERE c.user_id = auth.uid()
    )
    OR program_year_id IN (
      SELECT py.id FROM rep_program_years py
      JOIN rep_teams t ON t.id = py.team_id
      JOIN organization_members om ON om.organization_id = t.org_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'treasurer')
    )
  );

CREATE POLICY "coaches_insert_rep_season_surplus" ON rep_season_surplus
  FOR INSERT WITH CHECK (
    program_year_id IN (
      SELECT py.id FROM rep_program_years py
      JOIN rep_teams t ON t.id = py.team_id
      JOIN rep_team_coaches c ON c.team_id = t.id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "coaches_update_rep_season_surplus" ON rep_season_surplus
  FOR UPDATE USING (
    program_year_id IN (
      SELECT py.id FROM rep_program_years py
      JOIN rep_teams t ON t.id = py.team_id
      JOIN rep_team_coaches c ON c.team_id = t.id
      WHERE c.user_id = auth.uid()
    )
  );
