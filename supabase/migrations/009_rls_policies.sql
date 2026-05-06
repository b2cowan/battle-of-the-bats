-- =============================================================================
-- Migration 009: RLS Policies — Phase 2
--
-- Activates row-level security across all tables with tournament-assignment-
-- aware policies. Browser-client (anon key) reads remain permissive for public
-- pages; writes require a user JWT and org membership (via authClient() in
-- lib/db.ts which sends the session cookie).
--
-- The Supabase service-role key (supabaseAdmin) bypasses RLS entirely.
-- All /api/admin/* routes use supabaseAdmin and are unaffected.
--
-- Safe to run even if migrations 002 / 003 were previously applied:
--   - Functions use CREATE OR REPLACE
--   - Policies use DROP IF EXISTS before CREATE
--   - ALTER TABLE ENABLE ROW LEVEL SECURITY is idempotent
-- =============================================================================


-- =============================================================================
-- Helper functions (all SECURITY DEFINER to avoid RLS recursion)
-- =============================================================================

-- Returns the set of org IDs where the caller is a member.
-- Used in policies to avoid self-referential recursion on organization_members.
CREATE OR REPLACE FUNCTION get_my_org_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid();
$$;

-- Returns true if the caller is a member of the given org.
CREATE OR REPLACE FUNCTION is_org_member(org_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
  );
$$;

-- Returns true if the caller is an owner of the given org.
CREATE OR REPLACE FUNCTION is_org_owner(org_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

-- Core enforcement: caller is an org member AND either has no tournament
-- assignment rows (absence = unrestricted) OR has this specific tournament
-- explicitly assigned.
CREATE OR REPLACE FUNCTION can_access_tournament(t_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members om
    JOIN tournaments t ON t.organization_id = om.organization_id
    WHERE om.user_id = auth.uid()
      AND t.id = t_id
      AND (
        -- No assignments = unrestricted (absence-means-unrestricted semantics)
        NOT EXISTS (
          SELECT 1 FROM org_member_tournament_assignments
          WHERE org_member_id = om.id
        )
        OR
        -- Has an explicit assignment for this tournament
        EXISTS (
          SELECT 1 FROM org_member_tournament_assignments
          WHERE org_member_id = om.id
            AND tournament_id = t_id
        )
      )
  );
$$;

-- Chained helper for pools: pools have no tournament_id column directly;
-- resolve through age_groups.
CREATE OR REPLACE FUNCTION can_access_tournament_for_pool(pool_age_group_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT can_access_tournament(
    (SELECT tournament_id FROM age_groups WHERE id = pool_age_group_id)
  );
$$;

-- Chained helper for rule_items: resolve through rules.
CREATE OR REPLACE FUNCTION can_access_tournament_for_rule_item(item_rule_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT can_access_tournament(
    (SELECT tournament_id FROM rules WHERE id = item_rule_id)
  );
$$;

-- Legacy helper retained for backwards compatibility with any surviving
-- migration 002 / 003 code paths.
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


-- =============================================================================
-- Enable RLS (idempotent)
-- =============================================================================

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


-- =============================================================================
-- Drop existing policies (from migrations 002 / 003 if previously applied)
-- =============================================================================

-- organizations
DROP POLICY IF EXISTS "anon_read_organizations"    ON organizations;
DROP POLICY IF EXISTS "org_members_update_own_org" ON organizations;
DROP POLICY IF EXISTS "org_members_read_own"       ON organizations;

-- organization_members
DROP POLICY IF EXISTS "org_members_read_own"    ON organization_members;
DROP POLICY IF EXISTS "owners_manage_members"   ON organization_members;
DROP POLICY IF EXISTS "org_members_read_peers"  ON organization_members;

-- tournaments
DROP POLICY IF EXISTS "anon_read_tournaments"           ON tournaments;
DROP POLICY IF EXISTS "org_members_write_tournaments"   ON tournaments;
DROP POLICY IF EXISTS "org_members_update_tournaments"  ON tournaments;
DROP POLICY IF EXISTS "org_members_delete_tournaments"  ON tournaments;
DROP POLICY IF EXISTS "tournaments_org_member_read"     ON tournaments;
DROP POLICY IF EXISTS "tournaments_org_member_write"    ON tournaments;
DROP POLICY IF EXISTS "tournaments_public_active"       ON tournaments;

-- age_groups
DROP POLICY IF EXISTS "anon_read_age_groups"         ON age_groups;
DROP POLICY IF EXISTS "org_members_write_age_groups"  ON age_groups;
DROP POLICY IF EXISTS "org_members_update_age_groups" ON age_groups;
DROP POLICY IF EXISTS "org_members_delete_age_groups" ON age_groups;

-- pools
DROP POLICY IF EXISTS "anon_read_pools"         ON pools;
DROP POLICY IF EXISTS "org_members_write_pools"  ON pools;
DROP POLICY IF EXISTS "org_members_update_pools" ON pools;
DROP POLICY IF EXISTS "org_members_delete_pools" ON pools;

-- teams
DROP POLICY IF EXISTS "anon_read_teams"         ON teams;
DROP POLICY IF EXISTS "anon_insert_teams"        ON teams;
DROP POLICY IF EXISTS "org_members_update_teams" ON teams;
DROP POLICY IF EXISTS "org_members_delete_teams" ON teams;

-- games
DROP POLICY IF EXISTS "anon_read_games"         ON games;
DROP POLICY IF EXISTS "org_members_write_games"  ON games;
DROP POLICY IF EXISTS "org_members_update_games" ON games;
DROP POLICY IF EXISTS "org_members_delete_games" ON games;

-- diamonds
DROP POLICY IF EXISTS "anon_read_diamonds"         ON diamonds;
DROP POLICY IF EXISTS "org_members_write_diamonds"  ON diamonds;
DROP POLICY IF EXISTS "org_members_update_diamonds" ON diamonds;
DROP POLICY IF EXISTS "org_members_delete_diamonds" ON diamonds;

-- contacts
DROP POLICY IF EXISTS "anon_read_contacts"         ON contacts;
DROP POLICY IF EXISTS "org_members_write_contacts"  ON contacts;
DROP POLICY IF EXISTS "org_members_update_contacts" ON contacts;
DROP POLICY IF EXISTS "org_members_delete_contacts" ON contacts;

-- announcements
DROP POLICY IF EXISTS "anon_read_announcements"         ON announcements;
DROP POLICY IF EXISTS "org_members_write_announcements"  ON announcements;
DROP POLICY IF EXISTS "org_members_update_announcements" ON announcements;
DROP POLICY IF EXISTS "org_members_delete_announcements" ON announcements;

-- rules
DROP POLICY IF EXISTS "anon_read_rules"         ON rules;
DROP POLICY IF EXISTS "org_members_write_rules"  ON rules;
DROP POLICY IF EXISTS "org_members_update_rules" ON rules;
DROP POLICY IF EXISTS "org_members_delete_rules" ON rules;

-- rule_items
DROP POLICY IF EXISTS "anon_read_rule_items"         ON rule_items;
DROP POLICY IF EXISTS "org_members_write_rule_items"  ON rule_items;
DROP POLICY IF EXISTS "org_members_update_rule_items" ON rule_items;
DROP POLICY IF EXISTS "org_members_delete_rule_items" ON rule_items;

-- resources
DROP POLICY IF EXISTS "anon_read_resources"         ON resources;
DROP POLICY IF EXISTS "org_members_write_resources"  ON resources;
DROP POLICY IF EXISTS "org_members_update_resources" ON resources;
DROP POLICY IF EXISTS "org_members_delete_resources" ON resources;


-- =============================================================================
-- organizations
-- SELECT: own org (member) or any public org (needed for public tournament pages)
-- UPDATE: any org member (logo, settings — capability check at API layer)
-- INSERT / DELETE: service role only (org creation is server-side only)
-- =============================================================================

CREATE POLICY "org_read"
  ON organizations FOR SELECT
  USING (is_org_member(id) OR is_public = true);

CREATE POLICY "org_member_update"
  ON organizations FOR UPDATE
  USING (is_org_member(id));


-- =============================================================================
-- organization_members
-- SELECT: any member of the same org can see the full member list
-- ALL (write): owners only from browser; all admin writes use supabaseAdmin
-- =============================================================================

CREATE POLICY "org_members_read_peers"
  ON organization_members FOR SELECT
  USING (organization_id IN (SELECT get_my_org_ids()));

CREATE POLICY "owners_manage_members"
  ON organization_members FOR ALL
  USING (is_org_owner(organization_id))
  WITH CHECK (is_org_owner(organization_id));


-- =============================================================================
-- tournaments
-- SELECT: open read (anon) — needed for public schedule / results pages
-- INSERT: any org member (scope enforcement at API layer via requireCapability)
-- UPDATE / DELETE: org member who can access the tournament
-- =============================================================================

CREATE POLICY "tournaments_anon_read"
  ON tournaments FOR SELECT
  USING (true);

CREATE POLICY "tournaments_member_insert"
  ON tournaments FOR INSERT
  WITH CHECK (organization_id IN (SELECT get_my_org_ids()));

CREATE POLICY "tournaments_member_update"
  ON tournaments FOR UPDATE
  USING (can_access_tournament(id));

CREATE POLICY "tournaments_member_delete"
  ON tournaments FOR DELETE
  USING (can_access_tournament(id));


-- =============================================================================
-- org_member_tournament_assignments
-- SELECT: org members can see assignments for members within their org
-- INSERT / UPDATE / DELETE: all writes go through supabaseAdmin; no browser
--   write policy so direct browser writes are blocked by default
-- =============================================================================

CREATE POLICY "assignments_org_members_read"
  ON org_member_tournament_assignments FOR SELECT
  USING (
    org_member_id IN (
      SELECT id FROM organization_members
      WHERE organization_id IN (SELECT get_my_org_ids())
    )
  );


-- =============================================================================
-- age_groups
-- SELECT: open read (anon) — public schedule pages need division names
-- INSERT / UPDATE / DELETE: must be able to access the parent tournament
-- =============================================================================

CREATE POLICY "age_groups_anon_read"
  ON age_groups FOR SELECT
  USING (true);

CREATE POLICY "age_groups_member_insert"
  ON age_groups FOR INSERT
  WITH CHECK (can_access_tournament(tournament_id));

CREATE POLICY "age_groups_member_update"
  ON age_groups FOR UPDATE
  USING (can_access_tournament(tournament_id));

CREATE POLICY "age_groups_member_delete"
  ON age_groups FOR DELETE
  USING (can_access_tournament(tournament_id));


-- =============================================================================
-- pools
-- SELECT: open read (anon)
-- Writes chain through age_groups to reach the tournament check
-- =============================================================================

CREATE POLICY "pools_anon_read"
  ON pools FOR SELECT
  USING (true);

CREATE POLICY "pools_member_insert"
  ON pools FOR INSERT
  WITH CHECK (can_access_tournament_for_pool(age_group_id));

CREATE POLICY "pools_member_update"
  ON pools FOR UPDATE
  USING (can_access_tournament_for_pool(age_group_id));

CREATE POLICY "pools_member_delete"
  ON pools FOR DELETE
  USING (can_access_tournament_for_pool(age_group_id));


-- =============================================================================
-- teams
-- SELECT: open read (anon) — public teams / standings pages
-- INSERT: open (true) — public /register page allows anon team registration;
--   admin creates via authClient() also pass this policy
-- UPDATE / DELETE: org member who can access the tournament
-- =============================================================================

CREATE POLICY "teams_anon_read"
  ON teams FOR SELECT
  USING (true);

CREATE POLICY "teams_anon_insert"
  ON teams FOR INSERT
  WITH CHECK (true);

CREATE POLICY "teams_member_update"
  ON teams FOR UPDATE
  USING (can_access_tournament(tournament_id));

CREATE POLICY "teams_member_delete"
  ON teams FOR DELETE
  USING (can_access_tournament(tournament_id));


-- =============================================================================
-- games
-- SELECT: open read (anon) — public schedule pages
-- INSERT / UPDATE / DELETE: org member who can access the tournament
-- =============================================================================

CREATE POLICY "games_anon_read"
  ON games FOR SELECT
  USING (true);

CREATE POLICY "games_member_insert"
  ON games FOR INSERT
  WITH CHECK (can_access_tournament(tournament_id));

CREATE POLICY "games_member_update"
  ON games FOR UPDATE
  USING (can_access_tournament(tournament_id));

CREATE POLICY "games_member_delete"
  ON games FOR DELETE
  USING (can_access_tournament(tournament_id));


-- =============================================================================
-- diamonds
-- SELECT: open read (anon) — public schedule pages show diamond names
-- INSERT / UPDATE / DELETE: org member who can access the tournament
-- =============================================================================

CREATE POLICY "diamonds_anon_read"
  ON diamonds FOR SELECT
  USING (true);

CREATE POLICY "diamonds_member_insert"
  ON diamonds FOR INSERT
  WITH CHECK (can_access_tournament(tournament_id));

CREATE POLICY "diamonds_member_update"
  ON diamonds FOR UPDATE
  USING (can_access_tournament(tournament_id));

CREATE POLICY "diamonds_member_delete"
  ON diamonds FOR DELETE
  USING (can_access_tournament(tournament_id));


-- =============================================================================
-- contacts
-- SELECT: open read (anon) — public contact pages
-- INSERT / UPDATE / DELETE: org member who can access the tournament
-- =============================================================================

CREATE POLICY "contacts_anon_read"
  ON contacts FOR SELECT
  USING (true);

CREATE POLICY "contacts_member_insert"
  ON contacts FOR INSERT
  WITH CHECK (can_access_tournament(tournament_id));

CREATE POLICY "contacts_member_update"
  ON contacts FOR UPDATE
  USING (can_access_tournament(tournament_id));

CREATE POLICY "contacts_member_delete"
  ON contacts FOR DELETE
  USING (can_access_tournament(tournament_id));


-- =============================================================================
-- announcements
-- SELECT: open read (anon) — public news pages
-- INSERT / UPDATE / DELETE: org member who can access the tournament
-- =============================================================================

CREATE POLICY "announcements_anon_read"
  ON announcements FOR SELECT
  USING (true);

CREATE POLICY "announcements_member_insert"
  ON announcements FOR INSERT
  WITH CHECK (can_access_tournament(tournament_id));

CREATE POLICY "announcements_member_update"
  ON announcements FOR UPDATE
  USING (can_access_tournament(tournament_id));

CREATE POLICY "announcements_member_delete"
  ON announcements FOR DELETE
  USING (can_access_tournament(tournament_id));


-- =============================================================================
-- rules
-- SELECT: open read (anon) — public rules pages
-- INSERT / UPDATE / DELETE: org member who can access the tournament
-- =============================================================================

CREATE POLICY "rules_anon_read"
  ON rules FOR SELECT
  USING (true);

CREATE POLICY "rules_member_insert"
  ON rules FOR INSERT
  WITH CHECK (can_access_tournament(tournament_id));

CREATE POLICY "rules_member_update"
  ON rules FOR UPDATE
  USING (can_access_tournament(tournament_id));

CREATE POLICY "rules_member_delete"
  ON rules FOR DELETE
  USING (can_access_tournament(tournament_id));


-- =============================================================================
-- rule_items
-- SELECT: open read (anon)
-- Writes chain through rules to reach the tournament check
-- =============================================================================

CREATE POLICY "rule_items_anon_read"
  ON rule_items FOR SELECT
  USING (true);

CREATE POLICY "rule_items_member_insert"
  ON rule_items FOR INSERT
  WITH CHECK (can_access_tournament_for_rule_item(rule_id));

CREATE POLICY "rule_items_member_update"
  ON rule_items FOR UPDATE
  USING (can_access_tournament_for_rule_item(rule_id));

CREATE POLICY "rule_items_member_delete"
  ON rule_items FOR DELETE
  USING (can_access_tournament_for_rule_item(rule_id));


-- =============================================================================
-- resources
-- SELECT: open read (anon) — public rules / resources pages
-- INSERT / UPDATE / DELETE: org member who can access the tournament
-- =============================================================================

CREATE POLICY "resources_anon_read"
  ON resources FOR SELECT
  USING (true);

CREATE POLICY "resources_member_insert"
  ON resources FOR INSERT
  WITH CHECK (can_access_tournament(tournament_id));

CREATE POLICY "resources_member_update"
  ON resources FOR UPDATE
  USING (can_access_tournament(tournament_id));

CREATE POLICY "resources_member_delete"
  ON resources FOR DELETE
  USING (can_access_tournament(tournament_id));


-- =============================================================================
-- tournament_archives
-- SELECT: open read (anon) — public historical records
-- INSERT / UPDATE / DELETE: service role only (seal-tournament API route uses
--   supabaseAdmin); no browser write policy needed
-- =============================================================================

CREATE POLICY "archives_anon_read"
  ON tournament_archives FOR SELECT
  USING (true);
