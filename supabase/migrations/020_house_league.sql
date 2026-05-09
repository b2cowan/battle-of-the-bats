-- ---------------------------------------------------------------
-- league_seasons: one row per age-group season.
-- Each age group runs as its own season entity (e.g., "U11 Summer 2025").
-- status lifecycle: draft → registration_open → registration_closed
--                   → active → completed → archived
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS league_seasons (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                   text        NOT NULL,
  slug                   text        NOT NULL,
  sport                  text        NOT NULL DEFAULT 'softball',
  age_group              text,                           -- e.g. 'U11', 'U13', 'Adult'
  status                 text        NOT NULL DEFAULT 'draft'
                                     CHECK (status IN (
                                       'draft','registration_open','registration_closed',
                                       'active','completed','archived'
                                     )),
  description            text,
  registration_fee       numeric(8,2),                  -- display-only on registration form; not collected here
  auto_generate_fees     boolean     NOT NULL DEFAULT false,  -- auto-create accounting entries on approval
  auto_approve_under_capacity boolean NOT NULL DEFAULT false, -- auto-approve submissions while division has capacity
  auto_promote_waitlist  boolean     NOT NULL DEFAULT false,  -- auto-promote next waitlisted player when a spot opens
  registration_open_at   timestamptz,
  registration_close_at  timestamptz,
  season_start_date      date,
  season_end_date        date,
  waiver_text            text,                           -- optional waiver shown on public registration form
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

-- ---------------------------------------------------------------
-- league_divisions: optional sub-groups within a season.
-- Small leagues may have one division (e.g., "Division A").
-- Large leagues split into multiple divisions with independent
-- schedules and standings.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS league_divisions (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id   uuid    NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  name        text    NOT NULL,           -- e.g. 'Division A', 'Division 1'
  capacity    int,                        -- max active registrations; NULL = unlimited
  sort_order  int     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- league_teams: named teams within a division.
-- Created by the admin before or during the draft/placement phase.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS league_teams (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id    uuid    NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  division_id  uuid    NOT NULL REFERENCES league_divisions(id) ON DELETE CASCADE,
  name         text    NOT NULL,
  color        text,               -- optional hex colour for display (e.g. '#E03030')
  coach_name   text,               -- optional free text; not linked to an org member in Phase 5
  sort_order   int     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- league_registrations: one row per player registration submission.
-- status flow:
--   pending_review → active (approved by admin)
--   pending_review → waitlisted (division full; manual admin review)
--   pending_review → declined
--   active | waitlisted → withdrawn (player/guardian cancels)
-- waitlist_position: set when status = 'waitlisted'; NULL otherwise.
-- team_id: set after draft/placement phase; NULL until then.
-- fee_entry_id: set when auto_generate_fees=true and registration is approved.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS league_registrations (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id             uuid        NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  division_id           uuid        REFERENCES league_divisions(id) ON DELETE SET NULL,
  -- Player info
  player_first_name     text        NOT NULL,
  player_last_name      text        NOT NULL,
  player_date_of_birth  date,
  player_jersey_pref    text,
  player_position_pref  text,
  player_notes          text,               -- experience, medical notes etc. (public form, guardian-supplied)
  -- Guardian info
  guardian_first_name   text        NOT NULL,
  guardian_last_name    text        NOT NULL,
  guardian_email        text        NOT NULL,
  guardian_phone        text,
  -- Administrative
  status                text        NOT NULL DEFAULT 'pending_review'
                                    CHECK (status IN (
                                      'pending_review','active','waitlisted','declined','withdrawn'
                                    )),
  waitlist_position     int,
  team_id               uuid        REFERENCES league_teams(id) ON DELETE SET NULL,
  registration_fee_paid boolean     NOT NULL DEFAULT false,
  fee_entry_id          uuid,               -- FK to accounting_entries.id (nullable; set by Phase 5K)
  admin_notes           text,               -- internal admin-only notes; never shown on public form
  source                text        NOT NULL DEFAULT 'public_form'
                                    CHECK (source IN ('public_form','admin_manual')),
  registered_at         timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS league_registrations_season_idx    ON league_registrations(season_id);
CREATE INDEX IF NOT EXISTS league_registrations_division_idx  ON league_registrations(division_id);
CREATE INDEX IF NOT EXISTS league_registrations_status_idx    ON league_registrations(season_id, status);
CREATE INDEX IF NOT EXISTS league_registrations_guardian_idx  ON league_registrations(guardian_email);

-- ---------------------------------------------------------------
-- league_games: scheduled games between two teams in a division.
-- status: scheduled → completed | cancelled | postponed
-- home_score / away_score: NULL until game is completed.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS league_games (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       uuid    NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  division_id     uuid    NOT NULL REFERENCES league_divisions(id) ON DELETE CASCADE,
  home_team_id    uuid    NOT NULL REFERENCES league_teams(id) ON DELETE CASCADE,
  away_team_id    uuid    NOT NULL REFERENCES league_teams(id) ON DELETE CASCADE,
  scheduled_at    timestamptz,
  location        text,                       -- diamond name / field number / address
  home_score      int,
  away_score      int,
  status          text    NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled','completed','cancelled','postponed')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS league_games_season_idx      ON league_games(season_id);
CREATE INDEX IF NOT EXISTS league_games_division_idx    ON league_games(division_id);
CREATE INDEX IF NOT EXISTS league_games_schedule_idx    ON league_games(season_id, scheduled_at);

-- ---------------------------------------------------------------
-- league_notification_log: records each bulk email dispatch.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS league_notification_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id      uuid        NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  sent_by        uuid        REFERENCES auth.users(id),
  audience_type  text        NOT NULL,
  audience_label text,                    -- human-readable e.g. "U11 Division A"
  subject        text        NOT NULL,
  recipient_count int        NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
ALTER TABLE league_seasons           ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_divisions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_registrations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_games             ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_notification_log  ENABLE ROW LEVEL SECURITY;

-- Org members: read their org's seasons
CREATE POLICY "org members can read seasons"
  ON league_seasons FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Public: read seasons that are open or later (for the registration form and public schedule/standings)
CREATE POLICY "public can read non-draft seasons"
  ON league_seasons FOR SELECT
  USING (status IN ('registration_open','registration_closed','active','completed'));

-- Divisions: org member read
CREATE POLICY "org members can read divisions"
  ON league_divisions FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

-- Divisions: public read for non-draft seasons
CREATE POLICY "public can read divisions of non-draft seasons"
  ON league_divisions FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE status IN ('registration_open','registration_closed','active','completed')
  ));

-- Teams: org member read
CREATE POLICY "org members can read teams"
  ON league_teams FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

-- Teams: public read for active/completed seasons only (not during registration)
CREATE POLICY "public can read teams of active seasons"
  ON league_teams FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons WHERE status IN ('active','completed')
  ));

-- Registrations: org members only (guardian contact info is private)
CREATE POLICY "org members can read registrations"
  ON league_registrations FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

-- Public insert: allowed only for registration_open seasons (no auth required)
CREATE POLICY "public can submit registrations"
  ON league_registrations FOR INSERT
  WITH CHECK (
    season_id IN (SELECT id FROM league_seasons WHERE status = 'registration_open')
  );

-- Games: org member read
CREATE POLICY "org members can read games"
  ON league_games FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

-- Games: public read for active/completed seasons
CREATE POLICY "public can read games of active seasons"
  ON league_games FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons WHERE status IN ('active','completed')
  ));

-- Notification log: org members only
CREATE POLICY "org members can read notification log"
  ON league_notification_log FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));
