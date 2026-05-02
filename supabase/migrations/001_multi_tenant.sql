-- ============================================================
-- Migration 001 — Multi-Tenancy Foundation
-- Run this in the Supabase SQL Editor (dashboard.supabase.com)
-- ============================================================

-- 1. Organizations table
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

-- 2. Organization members table
CREATE TABLE IF NOT EXISTS organization_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             text NOT NULL DEFAULT 'admin',   -- 'owner' | 'admin' | 'staff'
  invited_at       timestamptz NOT NULL DEFAULT now(),
  accepted_at      timestamptz,
  UNIQUE(organization_id, user_id)
);

-- 3. Add organization_id to tournaments
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- 4. Seed: create the Milton Softball organization
--    Save the generated ID — you'll need it for the backfill and member insert below.
INSERT INTO organizations (name, slug, plan_id, tournament_limit)
VALUES ('Milton Softball Association', 'milton-softball', 'pro', 5)
RETURNING id;

-- 5. Backfill existing tournaments to the Milton org
--    Replace <MILTON_ORG_ID> with the UUID returned from step 4.
-- UPDATE tournaments SET organization_id = '<MILTON_ORG_ID>' WHERE organization_id IS NULL;

-- 6. Create the owner member record for Robert
--    Replace <MILTON_ORG_ID> with the org UUID, and <ROBERT_USER_ID> with
--    the UUID from auth.users after creating the Supabase Auth account via /auth/signup.
-- INSERT INTO organization_members (organization_id, user_id, role, accepted_at)
-- VALUES ('<MILTON_ORG_ID>', '<ROBERT_USER_ID>', 'owner', now());

-- ============================================================
-- Row Level Security (Phase 2 — enable after Phase 1 is stable)
-- Uncomment when ready to enforce per-org data isolation.
-- ============================================================

-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Org members can see their own org
-- CREATE POLICY "org_members_select_own_org" ON organizations FOR SELECT
--   USING (id IN (
--     SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
--   ));

-- Org members manage their own tournaments
-- CREATE POLICY "org_members_manage_tournaments" ON tournaments FOR ALL
--   USING (organization_id IN (
--     SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
--   ));

-- Public can read active tournaments
-- CREATE POLICY "public_read_active_tournaments" ON tournaments FOR SELECT
--   USING (is_active = true);
