-- =============================================================================
-- Migration 002: Row Level Security
-- Run in Supabase SQL Editor
-- =============================================================================

-- Helper function: is the current JWT user a member of the org that owns this tournament?
CREATE OR REPLACE FUNCTION is_org_member_for_tournament(tid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tournaments t
    JOIN organization_members om ON om.organization_id = t.organization_id
    WHERE t.id = tid AND om.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: is the current JWT user a member of the org that owns this age group?
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

-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================

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

-- =============================================================================
-- organizations
-- =============================================================================

-- Anyone can read org info (needed for public org pages in Phase 3)
CREATE POLICY "anon_read_organizations"
  ON organizations FOR SELECT USING (true);

-- Org members can update their own org settings
CREATE POLICY "org_members_update_own_org"
  ON organizations FOR UPDATE
  USING (id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- =============================================================================
-- organization_members
-- =============================================================================

-- Members can see who else is in their org
CREATE POLICY "org_members_read_own"
  ON organization_members FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Only owners can add/remove/change members
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
-- tournaments
-- =============================================================================

-- Public read — all tournaments visible (tighten to is_public orgs in Phase 3)
CREATE POLICY "anon_read_tournaments"
  ON tournaments FOR SELECT USING (true);

-- Org members can create/update/delete their own tournaments
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

-- =============================================================================
-- age_groups
-- =============================================================================

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

-- =============================================================================
-- pools
-- =============================================================================

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

-- =============================================================================
-- teams
-- =============================================================================

CREATE POLICY "anon_read_teams"
  ON teams FOR SELECT USING (true);

-- Public can register (insert) teams — the /register page
CREATE POLICY "anon_insert_teams"
  ON teams FOR INSERT WITH CHECK (true);

CREATE POLICY "org_members_update_teams"
  ON teams FOR UPDATE
  USING (is_org_member_for_tournament(tournament_id));

CREATE POLICY "org_members_delete_teams"
  ON teams FOR DELETE
  USING (is_org_member_for_tournament(tournament_id));

-- =============================================================================
-- games
-- =============================================================================

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

-- =============================================================================
-- diamonds
-- =============================================================================

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

-- =============================================================================
-- contacts
-- =============================================================================

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

-- =============================================================================
-- announcements
-- =============================================================================

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

-- =============================================================================
-- rules
-- =============================================================================

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

-- =============================================================================
-- rule_items (chained through rules → tournament)
-- =============================================================================

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

-- =============================================================================
-- resources
-- =============================================================================

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
