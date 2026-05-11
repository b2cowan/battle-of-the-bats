-- ---------------------------------------------------------------
-- Migration 021 — module_rep_teams
-- Competitive team program management.
--
-- Before running: create the rep-team-documents storage bucket
-- in Supabase Dashboard → Storage → New Bucket:
--   Name: rep-team-documents | Public: false
--   File size limit: 10485760 (10MB)
--   Allowed MIME types: application/pdf, image/jpeg, image/png,
--     application/vnd.openxmlformats-officedocument.wordprocessingml.document
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- rep_teams: persistent team entities.
-- A team like "U13A" exists year-round; program years anchor
-- season-specific data. Teams are never deleted — archive them.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  slug        text        NOT NULL,
  sport       text        NOT NULL DEFAULT 'softball',
  age_group   text,
  description text,
  color       text,
  is_archived boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

-- ---------------------------------------------------------------
-- rep_program_years: one row per team per season year.
-- Anchors that year's roster, coaching staff, schedule, and ledger.
-- status: draft → active → completed → archived
-- tryout_open controls whether the public tryout form is accepting.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_program_years (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id             uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name               text        NOT NULL,
  year               int         NOT NULL,
  status             text        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft','active','completed','archived')),
  tryout_open        boolean     NOT NULL DEFAULT false,
  tryout_description text,
  budget_amount      numeric(10,2),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, year)
);

-- ---------------------------------------------------------------
-- rep_team_coaches: scoped coach assignments per program year.
-- coach_role: head_coach or assistant_coach (display only in Phase 6).
-- UNIQUE (program_year_id, user_id): one assignment per user per year.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_team_coaches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id uuid        NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  team_id         uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_role      text        NOT NULL DEFAULT 'head_coach'
                              CHECK (coach_role IN ('head_coach', 'assistant_coach')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_year_id, user_id)
);

CREATE INDEX IF NOT EXISTS rep_team_coaches_user_idx
  ON rep_team_coaches(org_id, user_id);

-- ---------------------------------------------------------------
-- rep_tryout_registrations: public form submissions.
-- status flow:
--   pending_review → offered → accepted (player added to roster)
--   offered | pending_review → declined
--   accepted | offered → withdrawn
-- roster_player_id removed (Option A): the link is navigable via
--   rep_roster_players.tryout_registration_id — no circular FK needed.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_tryout_registrations (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id       uuid        NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  team_id               uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id                uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_first_name     text        NOT NULL,
  player_last_name      text        NOT NULL,
  player_date_of_birth  date,
  player_notes          text,
  guardian_first_name   text        NOT NULL,
  guardian_last_name    text        NOT NULL,
  guardian_email        text        NOT NULL,
  guardian_phone        text,
  status                text        NOT NULL DEFAULT 'pending_review'
                                    CHECK (status IN (
                                      'pending_review','offered','accepted','declined','withdrawn'
                                    )),
  admin_notes           text,
  submitted_at          timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_tryout_registrations_year_idx
  ON rep_tryout_registrations(program_year_id);
CREATE INDEX IF NOT EXISTS rep_tryout_registrations_status_idx
  ON rep_tryout_registrations(program_year_id, status);
CREATE INDEX IF NOT EXISTS rep_tryout_registrations_email_idx
  ON rep_tryout_registrations(guardian_email);

-- ---------------------------------------------------------------
-- rep_roster_players: active and inactive roster members.
-- source: 'tryout' = promoted from tryout_registrations;
--         'admin_manual' = directly added by admin.
-- tryout_registration_id links back to the originating submission.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_roster_players (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id        uuid        NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  team_id                uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id                 uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_first_name      text        NOT NULL,
  player_last_name       text        NOT NULL,
  player_date_of_birth   date,
  player_number          text,
  guardian_first_name    text        NOT NULL,
  guardian_last_name     text        NOT NULL,
  guardian_email         text        NOT NULL,
  guardian_phone         text,
  status                 text        NOT NULL DEFAULT 'active'
                                     CHECK (status IN ('active','inactive')),
  source                 text        NOT NULL DEFAULT 'admin_manual'
                                     CHECK (source IN ('tryout','admin_manual')),
  tryout_registration_id uuid        REFERENCES rep_tryout_registrations(id) ON DELETE SET NULL,
  notes                  text,
  admin_notes            text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_roster_players_year_idx
  ON rep_roster_players(program_year_id);
CREATE INDEX IF NOT EXISTS rep_roster_players_email_idx
  ON rep_roster_players(guardian_email);

-- ---------------------------------------------------------------
-- rep_team_events: unified team calendar.
-- event_type values:
--   external_tournament — top-level tournament entry (multi-day)
--   tournament_game     — individual game slot inside a tournament;
--                         parent_event_id → the external_tournament row
--   scrimmage           — standalone scrimmage vs. an opponent
--   league_game         — standalone league game (W/L/T tracked)
--   practice            — practice session; supports Phase 5M recurrence
--   team_event          — catch-all (meetings, team dinners, etc.)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_team_events (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id      uuid        NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  team_id              uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id               uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type           text        NOT NULL
                                   CHECK (event_type IN (
                                     'external_tournament','tournament_game',
                                     'scrimmage','league_game','practice','team_event'
                                   )),
  name                 text        NOT NULL,
  description          text,
  starts_at            timestamptz NOT NULL,
  ends_at              timestamptz,
  location             text,
  opponent             text,
  home_away            text        CHECK (home_away IN ('home','away','neutral')),
  home_score           int,
  away_score           int,
  result               text        CHECK (result IN ('win','loss','tie')),
  parent_event_id      uuid        REFERENCES rep_team_events(id) ON DELETE CASCADE,
  is_recurring         boolean     NOT NULL DEFAULT false,
  recurrence_rule      jsonb,
  recurrence_parent_id uuid        REFERENCES rep_team_events(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_team_events_year_idx
  ON rep_team_events(program_year_id, starts_at);
CREATE INDEX IF NOT EXISTS rep_team_events_parent_idx
  ON rep_team_events(parent_event_id);

-- ---------------------------------------------------------------
-- rep_document_templates: blank forms published for download.
-- team_id NULL = org-wide; team_id set = team-specific.
-- Coaches may publish their own team-specific templates.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_document_templates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id       uuid        REFERENCES rep_teams(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  document_type text        NOT NULL
                            CHECK (document_type IN (
                              'waiver','medical_consent','code_of_conduct','other'
                            )),
  storage_path  text        NOT NULL,
  file_name     text        NOT NULL,
  file_size     bigint      NOT NULL,
  is_active     boolean     NOT NULL DEFAULT true,
  published_by  uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- rep_player_documents: signed/completed forms per player.
-- template_id links back to the template this was uploaded against.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_player_documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     uuid        NOT NULL REFERENCES rep_roster_players(id) ON DELETE CASCADE,
  team_id       uuid        NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_type text        NOT NULL
                            CHECK (document_type IN (
                              'waiver','medical_consent','code_of_conduct','other'
                            )),
  storage_path  text        NOT NULL,
  file_name     text        NOT NULL,
  file_size     bigint      NOT NULL,
  template_id   uuid        REFERENCES rep_document_templates(id) ON DELETE SET NULL,
  uploaded_by   uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_player_documents_player_idx
  ON rep_player_documents(player_id);

-- ---------------------------------------------------------------
-- Accounting tables — three-tier model
-- ---------------------------------------------------------------

-- rep_cost_allocations: org admin allocates a shared expense across teams.
-- source_entry_id: FK to the accounting_entries row in the org ledger
-- that represents the shared expense being split.
CREATE TABLE IF NOT EXISTS rep_cost_allocations (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_entry_id uuid          REFERENCES accounting_entries(id) ON DELETE SET NULL,
  description     text          NOT NULL,
  total_amount    numeric(10,2) NOT NULL CHECK (total_amount > 0),
  created_by      uuid          REFERENCES auth.users(id),
  created_at      timestamptz   NOT NULL DEFAULT now()
);

-- rep_allocation_splits: per-team portion of a cost allocation.
-- amount: resolved dollar amount for this team (always stored as final $
--   regardless of split_method used to compute it).
CREATE TABLE IF NOT EXISTS rep_allocation_splits (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id    uuid          NOT NULL REFERENCES rep_cost_allocations(id) ON DELETE CASCADE,
  team_id          uuid          NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  program_year_id  uuid          NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  org_id           uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount           numeric(10,2) NOT NULL CHECK (amount > 0),
  split_method     text          NOT NULL
                                 CHECK (split_method IN ('percentage','sessions','fixed')),
  split_value      numeric(10,4) NOT NULL,
  payment_schedule text          NOT NULL DEFAULT 'standard'
                                 CHECK (payment_schedule IN ('standard','custom')),
  notes            text,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (allocation_id, team_id)
);

CREATE INDEX IF NOT EXISTS rep_allocation_splits_team_idx
  ON rep_allocation_splits(team_id, program_year_id);

-- rep_allocation_installments: per-installment payment schedule for a split.
-- standard schedule: one row with amount = full split amount.
-- custom schedule: multiple rows with specific amounts + dates.
-- accounting_entry_id: set when marked paid (transfer entry in both ledgers).
CREATE TABLE IF NOT EXISTS rep_allocation_installments (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id            uuid          NOT NULL REFERENCES rep_allocation_splits(id) ON DELETE CASCADE,
  installment_number  int           NOT NULL,
  amount              numeric(10,2) NOT NULL CHECK (amount > 0),
  due_date            date          NOT NULL,
  paid_at             timestamptz,
  paid_by             uuid          REFERENCES auth.users(id),
  accounting_entry_id uuid          REFERENCES accounting_entries(id) ON DELETE SET NULL,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (split_id, installment_number)
);

-- rep_player_dues_schedules: coach's dues configuration per player per year.
-- One row per player per program year.
CREATE TABLE IF NOT EXISTS rep_player_dues_schedules (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id uuid          NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  player_id       uuid          NOT NULL REFERENCES rep_roster_players(id) ON DELETE CASCADE,
  team_id         uuid          NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id          uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  total_amount    numeric(10,2) NOT NULL CHECK (total_amount > 0),
  notes           text,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (program_year_id, player_id)
);

-- rep_player_dues_installments: individual due dates + amounts per player.
-- reminder_sent_at: timestamp of the last automated reminder email.
-- accounting_entry_id: set when marked paid (income entry in team ledger).
CREATE TABLE IF NOT EXISTS rep_player_dues_installments (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id         uuid          NOT NULL REFERENCES rep_player_dues_schedules(id) ON DELETE CASCADE,
  player_id           uuid          NOT NULL REFERENCES rep_roster_players(id) ON DELETE CASCADE,
  installment_number  int           NOT NULL,
  amount              numeric(10,2) NOT NULL CHECK (amount > 0),
  due_date            date          NOT NULL,
  paid_at             timestamptz,
  reminder_sent_at    timestamptz,
  accounting_entry_id uuid          REFERENCES accounting_entries(id) ON DELETE SET NULL,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, installment_number)
);

CREATE INDEX IF NOT EXISTS rep_player_dues_installments_due_idx
  ON rep_player_dues_installments(due_date)
  WHERE paid_at IS NULL;

-- rep_team_expenses: coach-logged independent expenses and tournament payables.
-- expense_type='expense': general expense; amount is the total.
-- expense_type='tournament_payable': deposit + balance with separate due dates.
-- event_id: optional link to a rep_team_events row.
-- accounting_entry_id: set when marked paid.
CREATE TABLE IF NOT EXISTS rep_team_expenses (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  program_year_id     uuid          NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  team_id             uuid          NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  org_id              uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expense_type        text          NOT NULL
                                    CHECK (expense_type IN ('expense','tournament_payable')),
  description         text          NOT NULL,
  category            text,
  amount              numeric(10,2) NOT NULL CHECK (amount > 0),
  expense_paid_at     timestamptz,
  deposit_amount      numeric(10,2),
  deposit_due_date    date,
  deposit_paid_at     timestamptz,
  balance_amount      numeric(10,2),
  balance_due_date    date,
  balance_paid_at     timestamptz,
  event_id            uuid          REFERENCES rep_team_events(id) ON DELETE SET NULL,
  accounting_entry_id uuid          REFERENCES accounting_entries(id) ON DELETE SET NULL,
  created_by          uuid          REFERENCES auth.users(id),
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_team_expenses_year_idx
  ON rep_team_expenses(program_year_id);

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
ALTER TABLE rep_teams                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_program_years            ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_team_coaches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_tryout_registrations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_roster_players           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_team_events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_document_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_player_documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_cost_allocations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_allocation_splits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_allocation_installments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_player_dues_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_player_dues_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_team_expenses            ENABLE ROW LEVEL SECURITY;

-- rep_teams
CREATE POLICY "org members can read rep_teams"
  ON rep_teams FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- rep_program_years
CREATE POLICY "org members can read rep_program_years"
  ON rep_program_years FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- rep_team_coaches
CREATE POLICY "org members can read rep_team_coaches"
  ON rep_team_coaches FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- rep_tryout_registrations
CREATE POLICY "org members can read rep_tryout_registrations"
  ON rep_tryout_registrations FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "public can submit tryout registrations"
  ON rep_tryout_registrations FOR INSERT
  WITH CHECK (
    program_year_id IN (
      SELECT id FROM rep_program_years WHERE tryout_open = true
    )
  );

-- rep_roster_players
CREATE POLICY "org members can read rep_roster_players"
  ON rep_roster_players FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team roster"
  ON rep_roster_players FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ));

-- rep_team_events
CREATE POLICY "org members can read rep_team_events"
  ON rep_team_events FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team events"
  ON rep_team_events FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ));

-- rep_document_templates
CREATE POLICY "org members can read document_templates"
  ON rep_document_templates FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team templates"
  ON rep_document_templates FOR SELECT
  USING (
    team_id IN (SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid())
    OR (team_id IS NULL AND org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ))
  );

-- rep_player_documents
CREATE POLICY "org members can read player documents"
  ON rep_player_documents FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read assigned team player documents"
  ON rep_player_documents FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ));

-- rep_cost_allocations
CREATE POLICY "org members can read cost_allocations"
  ON rep_cost_allocations FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- rep_allocation_splits
CREATE POLICY "org members can read allocation_splits"
  ON rep_allocation_splits FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read their team's allocation_splits"
  ON rep_allocation_splits FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ));

-- rep_allocation_installments
CREATE POLICY "org members can read allocation_installments"
  ON rep_allocation_installments FOR SELECT
  USING (split_id IN (
    SELECT id FROM rep_allocation_splits
    WHERE org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "coaches can read their team's allocation_installments"
  ON rep_allocation_installments FOR SELECT
  USING (split_id IN (
    SELECT id FROM rep_allocation_splits
    WHERE team_id IN (SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid())
  ));

-- rep_player_dues_schedules
CREATE POLICY "coaches can read their team's dues_schedules"
  ON rep_player_dues_schedules FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read dues_schedules"
  ON rep_player_dues_schedules FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- rep_player_dues_installments
CREATE POLICY "coaches can read their team's dues_installments"
  ON rep_player_dues_installments FOR SELECT
  USING (schedule_id IN (
    SELECT id FROM rep_player_dues_schedules
    WHERE team_id IN (SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid())
  ));

CREATE POLICY "org members can read dues_installments"
  ON rep_player_dues_installments FOR SELECT
  USING (schedule_id IN (
    SELECT id FROM rep_player_dues_schedules
    WHERE org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  ));

-- rep_team_expenses
CREATE POLICY "org members can read team_expenses"
  ON rep_team_expenses FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "coaches can read their team's expenses"
  ON rep_team_expenses FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
  ));
