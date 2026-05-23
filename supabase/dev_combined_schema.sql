-- =============================================================================
-- FieldLogicHQ — Combined Dev Schema Bootstrap
-- =============================================================================
-- Run this in one shot in the Supabase SQL Editor on a fresh project.
-- It is safe to run only once on an empty database.
--
-- Structure:
--   Section 0  — Base tables (predated the migrations; created manually originally)
--   Section 001–021 — All migrations in order
-- =============================================================================


-- =============================================================================
-- SECTION 0: Base Schema
-- These tables existed before the numbered migrations were introduced.
-- =============================================================================

CREATE TABLE IF NOT EXISTS tournaments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  year        int         NOT NULL,
  name        text        NOT NULL,
  slug        text,
  status      text        NOT NULL DEFAULT 'draft',
  is_active   boolean     NOT NULL DEFAULT false,
  start_date  date,
  end_date    date,
  contact_email text
);

CREATE TABLE IF NOT EXISTS diamonds (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid  REFERENCES tournaments(id) ON DELETE CASCADE,
  name          text  NOT NULL,
  address       text,
  notes         text
);

CREATE TABLE IF NOT EXISTS contacts (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid  REFERENCES tournaments(id) ON DELETE CASCADE,
  name          text  NOT NULL,
  email         text,
  phone         text,
  role          text,
  is_notification_contact boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS age_groups (
  id                      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id           uuid    REFERENCES tournaments(id) ON DELETE CASCADE,
  name                    text    NOT NULL,
  min_age                 int,
  max_age                 int,
  display_order           int     NOT NULL DEFAULT 0,
  contact_id              uuid    REFERENCES contacts(id) ON DELETE SET NULL,
  is_closed               boolean NOT NULL DEFAULT false,
  capacity                int,
  pool_count              int,
  pool_names              text,
  requires_pool_selection boolean NOT NULL DEFAULT false,
  playoff_config          jsonb,
  schedule_visibility     text    NOT NULL DEFAULT 'unpublished'
                                  CHECK (schedule_visibility IN ('unpublished', 'published_generic', 'published_teams'))
);

CREATE TABLE IF NOT EXISTS pools (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  age_group_id  uuid  NOT NULL REFERENCES age_groups(id) ON DELETE CASCADE,
  name          text  NOT NULL,
  display_order int   NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS teams (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  uuid        REFERENCES tournaments(id) ON DELETE CASCADE,
  age_group_id   uuid        REFERENCES age_groups(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  coach          text,
  email          text,
  players        jsonb       NOT NULL DEFAULT '[]',
  status         text        NOT NULL DEFAULT 'accepted',
  payment_status text        NOT NULL DEFAULT 'paid',
  registered_at  timestamptz NOT NULL DEFAULT now(),
  admin_notes    text,
  pool_id        uuid        REFERENCES pools(id) ON DELETE SET NULL,
  waitlist_position int,
  slot_id        uuid        REFERENCES pool_slots(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS pool_slots (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id        uuid        NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  tournament_id  uuid        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  age_group_id   uuid        NOT NULL REFERENCES age_groups(id) ON DELETE CASCADE,
  slot_number    int         NOT NULL,
  display_name   text        NOT NULL,
  team_id        uuid        REFERENCES teams(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(pool_id, slot_number)
);

CREATE TABLE IF NOT EXISTS games (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id    uuid    REFERENCES tournaments(id) ON DELETE CASCADE,
  age_group_id     uuid    REFERENCES age_groups(id) ON DELETE CASCADE,
  home_team_id     uuid    REFERENCES teams(id) ON DELETE SET NULL,
  away_team_id     uuid    REFERENCES teams(id) ON DELETE SET NULL,
  game_date        date,
  game_time        text,
  location         text,
  diamond_id       uuid    REFERENCES diamonds(id) ON DELETE SET NULL,
  home_score       int,
  away_score       int,
  status           text    NOT NULL DEFAULT 'scheduled',
  is_playoff       boolean NOT NULL DEFAULT false,
  bracket_id       text,
  bracket_code     text,
  home_placeholder text,
  away_placeholder text,
  notes            text,
  home_slot_id     uuid    REFERENCES pool_slots(id) ON DELETE SET NULL,
  away_slot_id     uuid    REFERENCES pool_slots(id) ON DELETE SET NULL,
  score_submitted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  score_submitted_by_email text,
  score_submitted_at timestamptz,
  score_submission_source text CHECK (
    score_submission_source IS NULL
    OR score_submission_source IN ('scorekeeper', 'admin_results', 'system')
  )
);

CREATE TABLE IF NOT EXISTS announcements (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid        REFERENCES tournaments(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  body          text,
  published_at  timestamptz NOT NULL DEFAULT now(),
  pinned        boolean     NOT NULL DEFAULT false,
  age_group_ids uuid[]
);

CREATE TABLE IF NOT EXISTS rules (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid  REFERENCES tournaments(id) ON DELETE CASCADE,
  title         text  NOT NULL,
  display_order int   NOT NULL DEFAULT 0,
  icon          text,
  age_group_ids uuid[]
);

CREATE TABLE IF NOT EXISTS rule_items (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       uuid  NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  content       text  NOT NULL,
  display_order int   NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS resources (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid  REFERENCES tournaments(id) ON DELETE CASCADE,
  label         text  NOT NULL,
  url           text  NOT NULL,
  display_order int   NOT NULL DEFAULT 0
);


-- =============================================================================
-- SECTION 001: Multi-Tenancy Foundation
-- =============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  slug                    text UNIQUE NOT NULL,
  logo_url                text,
  plan_id                 text NOT NULL DEFAULT 'starter',
  stripe_customer_id      text,
  stripe_subscription_id  text,
  subscription_status     text NOT NULL DEFAULT 'active',
  tournament_limit        int  NOT NULL DEFAULT 1,
  is_public               boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             text NOT NULL DEFAULT 'admin',
  invited_at       timestamptz NOT NULL DEFAULT now(),
  accepted_at      timestamptz,
  UNIQUE(organization_id, user_id)
);

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- Dev seed: creates the Milton Softball org. The returned ID is not needed
-- for subsequent steps since no backfill is required on a fresh database.
INSERT INTO organizations (name, slug, plan_id, tournament_limit)
VALUES ('Milton Softball Association', 'milton-softball', 'pro', 5)
ON CONFLICT (slug) DO NOTHING;


-- =============================================================================
-- SECTION 002: Row Level Security (initial — superseded by 009)
-- =============================================================================

CREATE OR REPLACE FUNCTION is_org_member_for_tournament(tid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tournaments t
    JOIN organization_members om ON om.organization_id = t.organization_id
    WHERE t.id = tid AND om.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_org_member_for_age_group(agid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM age_groups ag
    JOIN tournaments t ON t.id = ag.tournament_id
    JOIN organization_members om ON om.organization_id = t.organization_id
    WHERE ag.id = agid AND om.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_groups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools                ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                ENABLE ROW LEVEL SECURITY;
ALTER TABLE games                ENABLE ROW LEVEL SECURITY;
ALTER TABLE diamonds             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules                ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_organizations"
  ON organizations FOR SELECT USING (true);

CREATE POLICY "org_members_update_own_org"
  ON organizations FOR UPDATE
  USING (id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_members_read_own"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION is_org_owner(org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "owners_manage_members"
  ON organization_members FOR ALL
  USING (is_org_owner(organization_id))
  WITH CHECK (is_org_owner(organization_id));

CREATE POLICY "anon_read_tournaments"
  ON tournaments FOR SELECT USING (true);

CREATE POLICY "org_members_write_tournaments"
  ON tournaments FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_members_update_tournaments"
  ON tournaments FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_members_delete_tournaments"
  ON tournaments FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "anon_read_age_groups"
  ON age_groups FOR SELECT USING (true);

CREATE POLICY "org_members_write_age_groups"
  ON age_groups FOR INSERT
  WITH CHECK (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_update_age_groups"
  ON age_groups FOR UPDATE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_delete_age_groups"
  ON age_groups FOR DELETE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "anon_read_pools"
  ON pools FOR SELECT USING (true);

CREATE POLICY "org_members_write_pools"
  ON pools FOR INSERT
  WITH CHECK (is_org_member_for_age_group(age_group_id));

CREATE POLICY "org_members_update_pools"
  ON pools FOR UPDATE
  USING (is_org_member_for_age_group(age_group_id));

CREATE POLICY "org_members_delete_pools"
  ON pools FOR DELETE
  USING (is_org_member_for_age_group(age_group_id));

CREATE POLICY "anon_read_teams"
  ON teams FOR SELECT USING (true);

CREATE POLICY "anon_insert_teams"
  ON teams FOR INSERT WITH CHECK (true);

CREATE POLICY "org_members_update_teams"
  ON teams FOR UPDATE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_delete_teams"
  ON teams FOR DELETE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "anon_read_games"
  ON games FOR SELECT USING (true);

CREATE POLICY "org_members_write_games"
  ON games FOR INSERT
  WITH CHECK (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_update_games"
  ON games FOR UPDATE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_delete_games"
  ON games FOR DELETE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "anon_read_diamonds"
  ON diamonds FOR SELECT USING (true);

CREATE POLICY "org_members_write_diamonds"
  ON diamonds FOR INSERT
  WITH CHECK (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_update_diamonds"
  ON diamonds FOR UPDATE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_delete_diamonds"
  ON diamonds FOR DELETE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "anon_read_contacts"
  ON contacts FOR SELECT USING (true);

CREATE POLICY "org_members_write_contacts"
  ON contacts FOR INSERT
  WITH CHECK (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_update_contacts"
  ON contacts FOR UPDATE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_delete_contacts"
  ON contacts FOR DELETE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "anon_read_announcements"
  ON announcements FOR SELECT USING (true);

CREATE POLICY "org_members_write_announcements"
  ON announcements FOR INSERT
  WITH CHECK (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_update_announcements"
  ON announcements FOR UPDATE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_delete_announcements"
  ON announcements FOR DELETE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "anon_read_rules"
  ON rules FOR SELECT USING (true);

CREATE POLICY "org_members_write_rules"
  ON rules FOR INSERT
  WITH CHECK (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_update_rules"
  ON rules FOR UPDATE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_delete_rules"
  ON rules FOR DELETE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "anon_read_rule_items"
  ON rule_items FOR SELECT USING (true);

CREATE POLICY "org_members_write_rule_items"
  ON rule_items FOR INSERT
  WITH CHECK (rule_id IN (
    SELECT id FROM rules WHERE is_org_member_for_tournament(tournament_id)
  ));

CREATE POLICY "org_members_update_rule_items"
  ON rule_items FOR UPDATE
  USING (rule_id IN (
    SELECT id FROM rules WHERE is_org_member_for_tournament(tournament_id)
  ));

CREATE POLICY "org_members_delete_rule_items"
  ON rule_items FOR DELETE
  USING (rule_id IN (
    SELECT id FROM rules WHERE is_org_member_for_tournament(tournament_id)
  ));

CREATE POLICY "anon_read_resources"
  ON resources FOR SELECT USING (true);

CREATE POLICY "org_members_write_resources"
  ON resources FOR INSERT
  WITH CHECK (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_update_resources"
  ON resources FOR UPDATE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_delete_resources"
  ON resources FOR DELETE
  USING (is_org_member_for_tournament(tournament_id));


-- =============================================================================
-- SECTION 003: Fix RLS Recursion on organization_members
-- =============================================================================

CREATE OR REPLACE FUNCTION get_my_org_ids()
RETURNS SETOF uuid AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "org_members_read_own" ON organization_members;

CREATE POLICY "org_members_read_own"
  ON organization_members FOR SELECT
  USING (organization_id IN (SELECT get_my_org_ids()));

DROP POLICY IF EXISTS "owners_manage_members" ON organization_members;
CREATE POLICY "owners_manage_members"
  ON organization_members FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
  ));


-- =============================================================================
-- SECTION 004: Per-org theme columns
-- =============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS theme_preset  text DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS theme_primary text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS theme_accent  text DEFAULT NULL;

UPDATE organizations
SET theme_preset = 'platform'
WHERE slug = 'milton-softball';


-- =============================================================================
-- SECTION 005: Org customization
-- =============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS hero_banner_url text     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS theme_font       text     DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS theme_card_style text     DEFAULT 'default';


-- =============================================================================
-- SECTION 006: Official Role + Score Finalization Setting
-- =============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS require_score_finalization boolean NOT NULL DEFAULT false;


-- =============================================================================
-- SECTION 007: Tournament Archives
-- =============================================================================

CREATE TABLE IF NOT EXISTS tournament_archives (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id    uuid        REFERENCES tournaments(id) ON DELETE SET NULL,
  org_id           uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tournament_name  text        NOT NULL,
  season           text        NOT NULL,
  division         text,
  final_snapshot   jsonb       NOT NULL,
  winner_team_id   uuid        REFERENCES teams(id) ON DELETE SET NULL,
  winner_team_name text,
  runner_up_name   text,
  total_teams      integer,
  total_games      integer,
  integrity_hash   text        NOT NULL,
  sealed_at        timestamptz NOT NULL DEFAULT now(),
  sealed_by        uuid        REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS tournament_archives_tournament_id_unique
  ON tournament_archives(tournament_id)
  WHERE tournament_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tournament_archives_org_season
  ON tournament_archives(org_id, season DESC, sealed_at DESC);

ALTER TABLE tournament_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_archives"
  ON tournament_archives FOR SELECT USING (true);

CREATE POLICY "org_members_insert_archives"
  ON tournament_archives FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );


-- =============================================================================
-- SECTION 008: Role Capabilities + Tournament Assignments
-- =============================================================================

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS capabilities jsonb;

CREATE TABLE IF NOT EXISTS org_member_tournament_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_member_id   uuid        NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  tournament_id   uuid        NOT NULL REFERENCES tournaments(id)          ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_member_id, tournament_id)
);

CREATE INDEX IF NOT EXISTS idx_omta_org_member ON org_member_tournament_assignments(org_member_id);
CREATE INDEX IF NOT EXISTS idx_omta_tournament  ON org_member_tournament_assignments(tournament_id);


-- =============================================================================
-- SECTION 009: RLS Policies Phase 2 (supersedes 002/003)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_my_org_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_org_member(org_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_org_owner(org_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

CREATE OR REPLACE FUNCTION can_access_tournament(t_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN tournaments t ON t.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND t.id = t_id
      AND (
        NOT EXISTS (
          SELECT 1 FROM org_member_tournament_assignments
          WHERE org_member_id = om.id
        )
        OR
        EXISTS (
          SELECT 1 FROM org_member_tournament_assignments
          WHERE org_member_id = om.id
            AND tournament_id = t_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION can_access_tournament_for_pool(pool_age_group_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT can_access_tournament(
    (SELECT tournament_id FROM age_groups WHERE id = pool_age_group_id)
  );
$$;

CREATE OR REPLACE FUNCTION can_access_tournament_for_rule_item(item_rule_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT can_access_tournament(
    (SELECT tournament_id FROM rules WHERE id = item_rule_id)
  );
$$;

CREATE OR REPLACE FUNCTION is_org_member_for_tournament(tid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT can_access_tournament(tid);
$$;

CREATE OR REPLACE FUNCTION is_org_member_for_age_group(agid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT can_access_tournament(
    (SELECT tournament_id FROM age_groups WHERE id = agid)
  );
$$;

ALTER TABLE organizations                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_member_tournament_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE age_groups                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE games                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE diamonds                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rules                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_items                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_archives             ENABLE ROW LEVEL SECURITY;

-- Drop all prior policies and replace with final versions
DROP POLICY IF EXISTS "anon_read_organizations"    ON organizations;
DROP POLICY IF EXISTS "org_members_update_own_org" ON organizations;
DROP POLICY IF EXISTS "org_members_read_own"       ON organizations;
DROP POLICY IF EXISTS "org_members_read_own"       ON organization_members;
DROP POLICY IF EXISTS "owners_manage_members"      ON organization_members;
DROP POLICY IF EXISTS "org_members_read_peers"     ON organization_members;
DROP POLICY IF EXISTS "anon_read_tournaments"              ON tournaments;
DROP POLICY IF EXISTS "org_members_write_tournaments"      ON tournaments;
DROP POLICY IF EXISTS "org_members_update_tournaments"     ON tournaments;
DROP POLICY IF EXISTS "org_members_delete_tournaments"     ON tournaments;
DROP POLICY IF EXISTS "tournaments_org_member_read"        ON tournaments;
DROP POLICY IF EXISTS "tournaments_org_member_write"       ON tournaments;
DROP POLICY IF EXISTS "tournaments_public_active"          ON tournaments;
DROP POLICY IF EXISTS "anon_read_age_groups"          ON age_groups;
DROP POLICY IF EXISTS "org_members_write_age_groups"  ON age_groups;
DROP POLICY IF EXISTS "org_members_update_age_groups" ON age_groups;
DROP POLICY IF EXISTS "org_members_delete_age_groups" ON age_groups;
DROP POLICY IF EXISTS "anon_read_pools"         ON pools;
DROP POLICY IF EXISTS "org_members_write_pools"  ON pools;
DROP POLICY IF EXISTS "org_members_update_pools" ON pools;
DROP POLICY IF EXISTS "org_members_delete_pools" ON pools;
DROP POLICY IF EXISTS "anon_read_teams"         ON teams;
DROP POLICY IF EXISTS "anon_insert_teams"        ON teams;
DROP POLICY IF EXISTS "org_members_update_teams" ON teams;
DROP POLICY IF EXISTS "org_members_delete_teams" ON teams;
DROP POLICY IF EXISTS "anon_read_games"         ON games;
DROP POLICY IF EXISTS "org_members_write_games"  ON games;
DROP POLICY IF EXISTS "org_members_update_games" ON games;
DROP POLICY IF EXISTS "org_members_delete_games" ON games;
DROP POLICY IF EXISTS "anon_read_diamonds"         ON diamonds;
DROP POLICY IF EXISTS "org_members_write_diamonds"  ON diamonds;
DROP POLICY IF EXISTS "org_members_update_diamonds" ON diamonds;
DROP POLICY IF EXISTS "org_members_delete_diamonds" ON diamonds;
DROP POLICY IF EXISTS "anon_read_contacts"         ON contacts;
DROP POLICY IF EXISTS "org_members_write_contacts"  ON contacts;
DROP POLICY IF EXISTS "org_members_update_contacts" ON contacts;
DROP POLICY IF EXISTS "org_members_delete_contacts" ON contacts;
DROP POLICY IF EXISTS "anon_read_announcements"         ON announcements;
DROP POLICY IF EXISTS "org_members_write_announcements"  ON announcements;
DROP POLICY IF EXISTS "org_members_update_announcements" ON announcements;
DROP POLICY IF EXISTS "org_members_delete_announcements" ON announcements;
DROP POLICY IF EXISTS "anon_read_rules"         ON rules;
DROP POLICY IF EXISTS "org_members_write_rules"  ON rules;
DROP POLICY IF EXISTS "org_members_update_rules" ON rules;
DROP POLICY IF EXISTS "org_members_delete_rules" ON rules;
DROP POLICY IF EXISTS "anon_read_rule_items"         ON rule_items;
DROP POLICY IF EXISTS "org_members_write_rule_items"  ON rule_items;
DROP POLICY IF EXISTS "org_members_update_rule_items" ON rule_items;
DROP POLICY IF EXISTS "org_members_delete_rule_items" ON rule_items;
DROP POLICY IF EXISTS "anon_read_resources"         ON resources;
DROP POLICY IF EXISTS "org_members_write_resources"  ON resources;
DROP POLICY IF EXISTS "org_members_update_resources" ON resources;
DROP POLICY IF EXISTS "org_members_delete_resources" ON resources;

CREATE POLICY "org_read"
  ON organizations FOR SELECT
  USING (is_org_member(id) OR is_public = true);

CREATE POLICY "org_member_update"
  ON organizations FOR UPDATE
  USING (is_org_member(id));

CREATE POLICY "org_members_read_peers"
  ON organization_members FOR SELECT
  USING (organization_id IN (SELECT get_my_org_ids()));

CREATE POLICY "owners_manage_members"
  ON organization_members FOR ALL
  USING (is_org_owner(organization_id))
  WITH CHECK (is_org_owner(organization_id));

CREATE POLICY "tournaments_anon_read"
  ON tournaments FOR SELECT USING (true);

CREATE POLICY "tournaments_member_insert"
  ON tournaments FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_my_org_ids()));

CREATE POLICY "tournaments_member_update"
  ON tournaments FOR UPDATE
  USING (can_access_tournament(id));

CREATE POLICY "tournaments_member_delete"
  ON tournaments FOR DELETE
  USING (can_access_tournament(id));

CREATE POLICY "assignments_org_members_read"
  ON org_member_tournament_assignments FOR SELECT
  USING (
    org_member_id IN (
      SELECT id FROM organization_members
      WHERE organization_id IN (SELECT get_my_org_ids())
    )
  );

CREATE POLICY "age_groups_anon_read"       ON age_groups FOR SELECT USING (true);
CREATE POLICY "age_groups_member_insert"   ON age_groups FOR INSERT WITH CHECK (can_access_tournament(tournament_id));
CREATE POLICY "age_groups_member_update"   ON age_groups FOR UPDATE USING (can_access_tournament(tournament_id));
CREATE POLICY "age_groups_member_delete"   ON age_groups FOR DELETE USING (can_access_tournament(tournament_id));

CREATE POLICY "pools_anon_read"            ON pools FOR SELECT USING (true);
CREATE POLICY "pools_member_insert"        ON pools FOR INSERT WITH CHECK (can_access_tournament_for_pool(age_group_id));
CREATE POLICY "pools_member_update"        ON pools FOR UPDATE USING (can_access_tournament_for_pool(age_group_id));
CREATE POLICY "pools_member_delete"        ON pools FOR DELETE USING (can_access_tournament_for_pool(age_group_id));

CREATE POLICY "teams_anon_read"            ON teams FOR SELECT USING (true);
CREATE POLICY "teams_anon_insert"          ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "teams_member_update"        ON teams FOR UPDATE USING (can_access_tournament(tournament_id));
CREATE POLICY "teams_member_delete"        ON teams FOR DELETE USING (can_access_tournament(tournament_id));

CREATE POLICY "games_anon_read"            ON games FOR SELECT USING (true);
CREATE POLICY "games_member_insert"        ON games FOR INSERT WITH CHECK (can_access_tournament(tournament_id));
CREATE POLICY "games_member_update"        ON games FOR UPDATE USING (can_access_tournament(tournament_id));
CREATE POLICY "games_member_delete"        ON games FOR DELETE USING (can_access_tournament(tournament_id));

CREATE POLICY "diamonds_anon_read"         ON diamonds FOR SELECT USING (true);
CREATE POLICY "diamonds_member_insert"     ON diamonds FOR INSERT WITH CHECK (can_access_tournament(tournament_id));
CREATE POLICY "diamonds_member_update"     ON diamonds FOR UPDATE USING (can_access_tournament(tournament_id));
CREATE POLICY "diamonds_member_delete"     ON diamonds FOR DELETE USING (can_access_tournament(tournament_id));

CREATE POLICY "contacts_anon_read"         ON contacts FOR SELECT USING (true);
CREATE POLICY "contacts_member_insert"     ON contacts FOR INSERT WITH CHECK (can_access_tournament(tournament_id));
CREATE POLICY "contacts_member_update"     ON contacts FOR UPDATE USING (can_access_tournament(tournament_id));
CREATE POLICY "contacts_member_delete"     ON contacts FOR DELETE USING (can_access_tournament(tournament_id));

CREATE POLICY "announcements_anon_read"    ON announcements FOR SELECT USING (true);
CREATE POLICY "announcements_member_insert" ON announcements FOR INSERT WITH CHECK (can_access_tournament(tournament_id));
CREATE POLICY "announcements_member_update" ON announcements FOR UPDATE USING (can_access_tournament(tournament_id));
CREATE POLICY "announcements_member_delete" ON announcements FOR DELETE USING (can_access_tournament(tournament_id));

CREATE POLICY "rules_anon_read"            ON rules FOR SELECT USING (true);
CREATE POLICY "rules_member_insert"        ON rules FOR INSERT WITH CHECK (can_access_tournament(tournament_id));
CREATE POLICY "rules_member_update"        ON rules FOR UPDATE USING (can_access_tournament(tournament_id));
CREATE POLICY "rules_member_delete"        ON rules FOR DELETE USING (can_access_tournament(tournament_id));

CREATE POLICY "rule_items_anon_read"       ON rule_items FOR SELECT USING (true);
CREATE POLICY "rule_items_member_insert"   ON rule_items FOR INSERT WITH CHECK (can_access_tournament_for_rule_item(rule_id));
CREATE POLICY "rule_items_member_update"   ON rule_items FOR UPDATE USING (can_access_tournament_for_rule_item(rule_id));
CREATE POLICY "rule_items_member_delete"   ON rule_items FOR DELETE USING (can_access_tournament_for_rule_item(rule_id));

CREATE POLICY "resources_anon_read"        ON resources FOR SELECT USING (true);
CREATE POLICY "resources_member_insert"    ON resources FOR INSERT WITH CHECK (can_access_tournament(tournament_id));
CREATE POLICY "resources_member_update"    ON resources FOR UPDATE USING (can_access_tournament(tournament_id));
CREATE POLICY "resources_member_delete"    ON resources FOR DELETE USING (can_access_tournament(tournament_id));

CREATE POLICY "archives_anon_read"
  ON tournament_archives FOR SELECT USING (true);


-- =============================================================================
-- SECTION 010: Member Status
-- =============================================================================

ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('invited', 'active', 'suspended'));

UPDATE organization_members SET status = 'invited' WHERE accepted_at IS NULL;


-- =============================================================================
-- SECTION 011: Org Onboarding
-- =============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;


-- =============================================================================
-- SECTION 012: Audit Log
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_audit_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id   uuid,
  target_id  uuid,
  action     text        NOT NULL,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org ON org_audit_log(org_id, created_at DESC);

ALTER TABLE org_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_select_own_org_audit_log" ON org_audit_log;
CREATE POLICY "owners_select_own_org_audit_log"
  ON org_audit_log
  FOR SELECT
  TO authenticated
  USING (is_org_owner(org_id));


-- =============================================================================
-- SECTION 013: Display Names
-- =============================================================================

ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS display_name text CHECK (char_length(display_name) <= 60);


-- =============================================================================
-- SECTION 014: Enabled Add-ons
-- =============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS enabled_addons jsonb NOT NULL DEFAULT '[]';


-- =============================================================================
-- SECTION 015: Public Site Module
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_public_site_content (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tagline                   text,
  description               text,
  contact_email             text,
  social_instagram          text,
  social_facebook           text,
  social_x                  text,
  social_website            text,
  show_upcoming_tournaments boolean     NOT NULL DEFAULT true,
  show_archives_link        boolean     NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS org_public_site_content_org_id_key
  ON org_public_site_content(org_id);

ALTER TABLE org_public_site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read public site content"
  ON org_public_site_content FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "public can read public site content"
  ON org_public_site_content FOR SELECT
  TO anon
  USING (true);


-- =============================================================================
-- SECTION 016: Accounting Module
-- =============================================================================

CREATE TABLE IF NOT EXISTS accounting_ledgers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type  text        NOT NULL
                           CHECK (entity_type IN ('org', 'tournament', 'team', 'league_season')),
  entity_id    uuid,
  name         text        NOT NULL,
  currency     char(3)     NOT NULL DEFAULT 'CAD',
  is_archived  boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS accounting_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id        uuid        NOT NULL REFERENCES accounting_ledgers(id) ON DELETE CASCADE,
  entry_date       date        NOT NULL,
  description      text        NOT NULL,
  amount           numeric(12,2) NOT NULL CHECK (amount > 0),
  entry_type       text        NOT NULL
                               CHECK (entry_type IN ('income', 'expense', 'transfer_in', 'transfer_out')),
  status           text        NOT NULL DEFAULT 'posted'
                               CHECK (status IN ('pending', 'posted', 'void')),
  category         text,
  linked_entry_id  uuid        REFERENCES accounting_entries(id) ON DELETE SET NULL,
  source_module    text,
  source_entity_id uuid,
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounting_entries_ledger_id_idx
  ON accounting_entries(ledger_id);

CREATE INDEX IF NOT EXISTS accounting_entries_entry_date_idx
  ON accounting_entries(ledger_id, entry_date DESC);

ALTER TABLE accounting_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read ledgers"
  ON accounting_ledgers FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org members can read entries"
  ON accounting_entries FOR SELECT
  USING (
    ledger_id IN (
      SELECT al.id FROM accounting_ledgers al
      WHERE al.org_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION create_accounting_transfer(
  p_from_ledger_id  uuid,
  p_to_ledger_id    uuid,
  p_amount          numeric(12,2),
  p_entry_date      date,
  p_description     text,
  p_category        text,
  p_created_by      uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_out_id uuid := gen_random_uuid();
  v_in_id  uuid := gen_random_uuid();
BEGIN
  INSERT INTO accounting_entries
    (id, ledger_id, entry_date, description, amount, entry_type, status, category, linked_entry_id, created_by)
  VALUES
    (v_out_id, p_from_ledger_id, p_entry_date, p_description, p_amount, 'transfer_out', 'posted', p_category, v_in_id,  p_created_by),
    (v_in_id,  p_to_ledger_id,   p_entry_date, p_description, p_amount, 'transfer_in',  'posted', p_category, v_out_id, p_created_by);
END;
$$;


-- =============================================================================
-- SECTION 017: Org Internal Notes
-- =============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS internal_notes text;


-- =============================================================================
-- SECTION 018: Platform Audit Log
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email text        NOT NULL,
  org_id      uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  field       text,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_org   ON platform_audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_actor ON platform_audit_log(actor_email, created_at DESC);


-- =============================================================================
-- SECTION 019: Org Overrides
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_overrides (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('subscription_status', 'comp_period')),
  value       text,
  expires_at  timestamptz,
  reason      text        NOT NULL,
  created_by  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  revoked_by  text
);

CREATE INDEX IF NOT EXISTS idx_org_overrides_org ON org_overrides(org_id, created_at DESC);


-- =============================================================================
-- SECTION 020: House League Module
-- =============================================================================

CREATE TABLE IF NOT EXISTS league_seasons (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                   text        NOT NULL,
  slug                   text        NOT NULL,
  sport                  text        NOT NULL DEFAULT 'softball',
  age_group              text,
  status                 text        NOT NULL DEFAULT 'draft'
                                     CHECK (status IN (
                                       'draft','registration_open','registration_closed',
                                       'active','completed','archived'
                                     )),
  description            text,
  registration_fee       numeric(8,2),
  auto_generate_fees     boolean     NOT NULL DEFAULT false,
  auto_approve_under_capacity boolean NOT NULL DEFAULT false,
  auto_promote_waitlist  boolean     NOT NULL DEFAULT false,
  registration_open_at   timestamptz,
  registration_close_at  timestamptz,
  season_start_date      date,
  season_end_date        date,
  waiver_text            text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE TABLE IF NOT EXISTS league_divisions (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id   uuid    NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  name        text    NOT NULL,
  capacity    int,
  sort_order  int     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_teams (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id    uuid    NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  division_id  uuid    NOT NULL REFERENCES league_divisions(id) ON DELETE CASCADE,
  name         text    NOT NULL,
  color        text,
  coach_name   text,
  sort_order   int     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_registrations (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id             uuid        NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  division_id           uuid        REFERENCES league_divisions(id) ON DELETE SET NULL,
  player_first_name     text        NOT NULL,
  player_last_name      text        NOT NULL,
  player_date_of_birth  date,
  player_jersey_pref    text,
  player_position_pref  text,
  player_notes          text,
  guardian_first_name   text        NOT NULL,
  guardian_last_name    text        NOT NULL,
  guardian_email        text        NOT NULL,
  guardian_phone        text,
  status                text        NOT NULL DEFAULT 'pending_review'
                                    CHECK (status IN (
                                      'pending_review','active','waitlisted','declined','withdrawn'
                                    )),
  waitlist_position     int,
  team_id               uuid        REFERENCES league_teams(id) ON DELETE SET NULL,
  registration_fee_paid boolean     NOT NULL DEFAULT false,
  fee_entry_id          uuid,
  admin_notes           text,
  source                text        NOT NULL DEFAULT 'public_form'
                                    CHECK (source IN ('public_form','admin_manual')),
  registered_at         timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS league_registrations_season_idx    ON league_registrations(season_id);
CREATE INDEX IF NOT EXISTS league_registrations_division_idx  ON league_registrations(division_id);
CREATE INDEX IF NOT EXISTS league_registrations_status_idx    ON league_registrations(season_id, status);
CREATE INDEX IF NOT EXISTS league_registrations_guardian_idx  ON league_registrations(guardian_email);

CREATE TABLE IF NOT EXISTS league_games (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       uuid    NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  division_id     uuid    NOT NULL REFERENCES league_divisions(id) ON DELETE CASCADE,
  home_team_id    uuid    NOT NULL REFERENCES league_teams(id) ON DELETE CASCADE,
  away_team_id    uuid    NOT NULL REFERENCES league_teams(id) ON DELETE CASCADE,
  scheduled_at    timestamptz,
  location        text,
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

CREATE TABLE IF NOT EXISTS league_notification_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id      uuid        NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  sent_by        uuid        REFERENCES auth.users(id),
  audience_type  text        NOT NULL,
  audience_label text,
  subject        text        NOT NULL,
  recipient_count int        NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE league_seasons           ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_divisions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_registrations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_games             ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_notification_log  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read seasons"
  ON league_seasons FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "public can read non-draft seasons"
  ON league_seasons FOR SELECT
  USING (status IN ('registration_open','registration_closed','active','completed'));

CREATE POLICY "org members can read divisions"
  ON league_divisions FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

CREATE POLICY "public can read divisions of non-draft seasons"
  ON league_divisions FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE status IN ('registration_open','registration_closed','active','completed')
  ));

CREATE POLICY "org members can read teams"
  ON league_teams FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

CREATE POLICY "public can read teams of active seasons"
  ON league_teams FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons WHERE status IN ('active','completed')
  ));

CREATE POLICY "org members can read registrations"
  ON league_registrations FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

CREATE POLICY "public can submit registrations"
  ON league_registrations FOR INSERT
  WITH CHECK (
    season_id IN (SELECT id FROM league_seasons WHERE status = 'registration_open')
  );

CREATE POLICY "org members can read games"
  ON league_games FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));

CREATE POLICY "public can read games of active seasons"
  ON league_games FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons WHERE status IN ('active','completed')
  ));

CREATE POLICY "org members can read notification log"
  ON league_notification_log FOR SELECT
  USING (season_id IN (
    SELECT id FROM league_seasons
    WHERE org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  ));


-- =============================================================================
-- SECTION 021: Rep Teams Module
-- NOTE: Before running this section, create the Supabase Storage bucket:
--   Name: rep-team-documents | Public: false | File size limit: 10MB
--   Allowed MIME: application/pdf, image/jpeg, image/png,
--     application/vnd.openxmlformats-officedocument.wordprocessingml.document
-- =============================================================================

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

CREATE TABLE IF NOT EXISTS rep_cost_allocations (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_entry_id uuid          REFERENCES accounting_entries(id) ON DELETE SET NULL,
  description     text          NOT NULL,
  total_amount    numeric(10,2) NOT NULL CHECK (total_amount > 0),
  created_by      uuid          REFERENCES auth.users(id),
  created_at      timestamptz   NOT NULL DEFAULT now()
);

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

CREATE POLICY "org members can read rep_teams"
  ON rep_teams FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read rep_program_years"
  ON rep_program_years FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members can read rep_team_coaches"
  ON rep_team_coaches FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

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

CREATE POLICY "org members can read cost_allocations"
  ON rep_cost_allocations FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

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

-- =============================================================================
-- Migration 043: claim_next_slot function
-- Atomically claims the next available slot using SELECT ... FOR UPDATE SKIP LOCKED.
-- =============================================================================
CREATE OR REPLACE FUNCTION claim_next_slot(p_age_group_id UUID, p_team_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot_id UUID;
BEGIN
  UPDATE pool_slots
  SET    team_id = p_team_id
  WHERE  id = (
    SELECT ps.id
    FROM   pool_slots ps
    JOIN   pools p ON p.id = ps.pool_id
    WHERE  ps.age_group_id = p_age_group_id
      AND  ps.team_id IS NULL
    ORDER  BY p.display_order ASC, ps.slot_number ASC
    LIMIT  1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO v_slot_id;

  RETURN v_slot_id;
END;
$$;
