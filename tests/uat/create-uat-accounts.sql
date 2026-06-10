-- UAT Test Account + Org Setup -- FieldLogicHQ
-- Pure SQL -- no DO blocks. Run each statement in order.
-- Safe to re-run: every insert uses ON CONFLICT or WHERE NOT EXISTS.
--
-- EDIT BEFORE RUNNING: change the password on the crypt() calls below.
-- Use the same password for all UAT_*_PASSWORD vars in .env.local.
--
-- Default values match the UAT_SETUP.md .env.local block exactly.
-- ---------------------------------------------------------------


-- ================================================================
-- STEP 1: Orgs
-- ================================================================

INSERT INTO organizations (
  id, name, slug,
  plan_id, subscription_status,
  tournament_limit, is_public,
  internal_notes, created_at
)
SELECT
  gen_random_uuid(), 'UAT Test Org', 'uat-test-org',
  'tournament', 'active',
  1, false,
  '[UAT_PROTECTED] UAT test org - tournament plan. Do not wipe.',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE slug = 'uat-test-org'
);

-- Enforce canonical plan/status on every (re)provision: UAT orgs are mutated by
-- billing/checkout specs, so re-running this script must reset them to a known state.
UPDATE organizations
SET internal_notes = '[UAT_PROTECTED] UAT test org - tournament plan. Do not wipe.',
    plan_id = 'tournament',
    subscription_status = 'active'
WHERE slug = 'uat-test-org';

INSERT INTO organizations (
  id, name, slug,
  plan_id, subscription_status,
  tournament_limit, is_public,
  internal_notes, created_at
)
SELECT
  gen_random_uuid(), 'UAT Plus Org', 'uat-plus-org',
  'tournament_plus', 'active',
  10, false,
  '[UAT_PROTECTED] UAT test org - tournament_plus plan. Do not wipe.',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE slug = 'uat-plus-org'
);

UPDATE organizations
SET internal_notes = '[UAT_PROTECTED] UAT test org - tournament_plus plan. Do not wipe.',
    plan_id = 'tournament_plus',
    subscription_status = 'active'
WHERE slug = 'uat-plus-org';

-- Club-tier org: a non-tournament tier so /admin/org/* (billing, coaches-portal-links,
-- module pages) is reachable for plan-gating + standalone-team-org-link UAT.
INSERT INTO organizations (
  id, name, slug,
  plan_id, subscription_status,
  tournament_limit, is_public, is_discoverable,
  internal_notes, created_at
)
SELECT
  gen_random_uuid(), 'UAT Club Org', 'uat-club-org',
  'club', 'active',
  10, false, true,
  '[UAT_PROTECTED] UAT test org - club plan. Do not wipe.',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE slug = 'uat-club-org'
);

UPDATE organizations
SET internal_notes = '[UAT_PROTECTED] UAT test org - club plan. Do not wipe.',
    is_discoverable = true,
    plan_id = 'club',
    subscription_status = 'active'
WHERE slug = 'uat-club-org';


-- ================================================================
-- STEP 2: Auth users
-- Change 'UATPassword2026!' to your chosen password in all rows.
-- ================================================================

INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'uat-platform@fieldlogichq.ca',
  crypt('UATPassword2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}', '{}',
  now(), now(), '', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'uat-platform@fieldlogichq.ca'
);

INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'uat-owner@uat-test-org.local',
  crypt('UATPassword2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}', '{}',
  now(), now(), '', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'uat-owner@uat-test-org.local'
);

INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'uat-admin@uat-test-org.local',
  crypt('UATPassword2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}', '{}',
  now(), now(), '', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'uat-admin@uat-test-org.local'
);

INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'uat-coach@uat-test-org.local',
  crypt('UATPassword2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}', '{}',
  now(), now(), '', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'uat-coach@uat-test-org.local'
);

INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'uat-scorekeeper@uat-test-org.local',
  crypt('UATPassword2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}', '{}',
  now(), now(), '', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'uat-scorekeeper@uat-test-org.local'
);

INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change_token_new, email_change
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'uat-plus-scorekeeper@uat-plus-org.local',
  crypt('UATPassword2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}', '{}',
  now(), now(), '', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'uat-plus-scorekeeper@uat-plus-org.local'
);


-- ================================================================
-- STEP 3: Auth identities (links email provider to each user)
-- ================================================================

INSERT INTO auth.identities (
  id, provider_id, user_id, provider,
  identity_data, last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  u.email,
  u.id,
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  now(), now(), now()
FROM auth.users u
WHERE u.email IN (
  'uat-platform@fieldlogichq.ca',
  'uat-owner@uat-test-org.local',
  'uat-admin@uat-test-org.local',
  'uat-coach@uat-test-org.local',
  'uat-scorekeeper@uat-test-org.local',
  'uat-plus-scorekeeper@uat-plus-org.local'
)
AND NOT EXISTS (
  SELECT 1 FROM auth.identities i
  WHERE i.provider = 'email' AND i.provider_id = u.email
);


-- ================================================================
-- STEP 4: platform_users row for platform admin
-- ================================================================

INSERT INTO platform_users (
  id, email, display_name, role, is_active, created_at, updated_at
)
SELECT
  u.id, u.email, 'UAT Platform Admin', 'super_admin', true, now(), now()
FROM auth.users u
WHERE u.email = 'uat-platform@fieldlogichq.ca'
ON CONFLICT (id) DO UPDATE
  SET is_active = true, updated_at = now();


-- ================================================================
-- STEP 5: organization_members
-- ================================================================

-- Owner on uat-test-org
INSERT INTO organization_members (
  id, organization_id, user_id, role,
  invited_at, accepted_at, status, display_name
)
SELECT gen_random_uuid(), o.id, u.id, 'owner', now(), now(), 'active', 'UAT Org Owner'
FROM organizations o, auth.users u
WHERE o.slug = 'uat-test-org'
  AND u.email = 'uat-owner@uat-test-org.local'
ON CONFLICT (organization_id, user_id)
DO UPDATE SET role = 'owner', status = 'active', display_name = 'UAT Org Owner';

-- Admin on uat-test-org
INSERT INTO organization_members (
  id, organization_id, user_id, role,
  invited_at, accepted_at, status, display_name
)
SELECT gen_random_uuid(), o.id, u.id, 'admin', now(), now(), 'active', 'UAT Org Admin'
FROM organizations o, auth.users u
WHERE o.slug = 'uat-test-org'
  AND u.email = 'uat-admin@uat-test-org.local'
ON CONFLICT (organization_id, user_id)
DO UPDATE SET role = 'admin', status = 'active', display_name = 'UAT Org Admin';

-- Owner also on uat-plus-org (for plan-gating tests)
INSERT INTO organization_members (
  id, organization_id, user_id, role,
  invited_at, accepted_at, status, display_name
)
SELECT gen_random_uuid(), o.id, u.id, 'owner', now(), now(), 'active', 'UAT Org Owner'
FROM organizations o, auth.users u
WHERE o.slug = 'uat-plus-org'
  AND u.email = 'uat-owner@uat-test-org.local'
ON CONFLICT (organization_id, user_id)
DO UPDATE SET role = 'owner', status = 'active', display_name = 'UAT Org Owner';

-- Owner on uat-club-org (billing / coaches-portal-links / org-link owner-side tests)
INSERT INTO organization_members (
  id, organization_id, user_id, role,
  invited_at, accepted_at, status, display_name
)
SELECT gen_random_uuid(), o.id, u.id, 'owner', now(), now(), 'active', 'UAT Org Owner'
FROM organizations o, auth.users u
WHERE o.slug = 'uat-club-org'
  AND u.email = 'uat-owner@uat-test-org.local'
ON CONFLICT (organization_id, user_id)
DO UPDATE SET role = 'owner', status = 'active', display_name = 'UAT Org Owner';

-- Admin on uat-club-org (module-capability denial + read-only-billing tests)
INSERT INTO organization_members (
  id, organization_id, user_id, role,
  invited_at, accepted_at, status, display_name
)
SELECT gen_random_uuid(), o.id, u.id, 'admin', now(), now(), 'active', 'UAT Org Admin'
FROM organizations o, auth.users u
WHERE o.slug = 'uat-club-org'
  AND u.email = 'uat-admin@uat-test-org.local'
ON CONFLICT (organization_id, user_id)
DO UPDATE SET role = 'admin', status = 'active', display_name = 'UAT Org Admin';

-- Scorekeeper on uat-test-org
INSERT INTO organization_members (
  id, organization_id, user_id, role,
  invited_at, accepted_at, status, display_name
)
SELECT gen_random_uuid(), o.id, u.id, 'official', now(), now(), 'active', 'UAT Free Scorekeeper'
FROM organizations o, auth.users u
WHERE o.slug = 'uat-test-org'
  AND u.email = 'uat-scorekeeper@uat-test-org.local'
ON CONFLICT (organization_id, user_id)
DO UPDATE SET role = 'official', status = 'active', display_name = 'UAT Free Scorekeeper';

-- Scorekeeper on uat-plus-org
INSERT INTO organization_members (
  id, organization_id, user_id, role,
  invited_at, accepted_at, status, display_name
)
SELECT gen_random_uuid(), o.id, u.id, 'official', now(), now(), 'active', 'UAT Plus Scorekeeper'
FROM organizations o, auth.users u
WHERE o.slug = 'uat-plus-org'
  AND u.email = 'uat-plus-scorekeeper@uat-plus-org.local'
ON CONFLICT (organization_id, user_id)
DO UPDATE SET role = 'official', status = 'active', display_name = 'UAT Plus Scorekeeper';

-- Assign persistent scorekeepers to all currently active tournaments in their UAT orgs.
-- If no active tournaments exist yet, absence of assignment rows means the scorekeeper
-- can still see active tournaments created later under the current assignment semantics.
INSERT INTO org_member_tournament_assignments (
  id, org_member_id, tournament_id, created_at
)
SELECT gen_random_uuid(), om.id, t.id, now()
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
JOIN tournaments t ON t.org_id = o.id
JOIN auth.users u ON u.id = om.user_id
WHERE o.slug = 'uat-test-org'
  AND u.email = 'uat-scorekeeper@uat-test-org.local'
  AND t.status = 'active'
ON CONFLICT (org_member_id, tournament_id) DO NOTHING;

INSERT INTO org_member_tournament_assignments (
  id, org_member_id, tournament_id, created_at
)
SELECT gen_random_uuid(), om.id, t.id, now()
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
JOIN tournaments t ON t.org_id = o.id
JOIN auth.users u ON u.id = om.user_id
WHERE o.slug = 'uat-plus-org'
  AND u.email = 'uat-plus-scorekeeper@uat-plus-org.local'
  AND t.status = 'active'
ON CONFLICT (org_member_id, tournament_id) DO NOTHING;


-- ================================================================
-- STEP 6: Rep team (creates only if uat-test-org has no active team)
-- ================================================================

INSERT INTO rep_teams (
  id, org_id, name, slug, sport, division, is_archived, created_at, updated_at
)
SELECT gen_random_uuid(), o.id, 'UAT Test Team', 'uat-test-team', 'Baseball', 'U14', false, now(), now()
FROM organizations o
WHERE o.slug = 'uat-test-org'
  AND NOT EXISTS (
    SELECT 1 FROM rep_teams rt
    WHERE rt.org_id = o.id AND rt.is_archived = false
  );


-- ================================================================
-- STEP 7: Program year (creates only if the team has none)
-- ================================================================

INSERT INTO rep_program_years (
  id, team_id, org_id, name, year, status, created_at, updated_at
)
SELECT gen_random_uuid(), rt.id, rt.org_id, '2026 Season', 2026, 'active', now(), now()
FROM rep_teams rt
JOIN organizations o ON o.id = rt.org_id
WHERE o.slug = 'uat-test-org'
  AND rt.is_archived = false
  AND NOT EXISTS (
    SELECT 1 FROM rep_program_years py WHERE py.team_id = rt.id
  )
ORDER BY rt.created_at
LIMIT 1;


-- ================================================================
-- STEP 8: Coach membership
-- ================================================================

INSERT INTO rep_team_coaches (
  id, program_year_id, team_id, org_id, user_id, coach_role, created_at
)
SELECT
  gen_random_uuid(), py.id, rt.id, rt.org_id, u.id, 'head_coach', now()
FROM auth.users u
CROSS JOIN organizations o
JOIN rep_teams rt ON rt.org_id = o.id AND rt.is_archived = false
JOIN rep_program_years py ON py.team_id = rt.id
WHERE u.email = 'uat-coach@uat-test-org.local'
  AND o.slug = 'uat-test-org'
ORDER BY rt.created_at, py.created_at
LIMIT 1
ON CONFLICT (program_year_id, user_id) DO UPDATE SET coach_role = 'head_coach';


-- ================================================================
-- DONE -- verify with these queries
-- ================================================================

SELECT
  'orgs'     AS entity,
  slug       AS identifier,
  left(internal_notes, 40) AS notes
FROM organizations
WHERE slug IN ('uat-test-org', 'uat-plus-org', 'uat-club-org')

UNION ALL

SELECT
  'auth_user' AS entity,
  email       AS identifier,
  'confirmed' AS notes
FROM auth.users
WHERE email IN (
  'uat-platform@fieldlogichq.ca',
  'uat-owner@uat-test-org.local',
  'uat-admin@uat-test-org.local',
  'uat-coach@uat-test-org.local',
  'uat-scorekeeper@uat-test-org.local',
  'uat-plus-scorekeeper@uat-plus-org.local'
)

UNION ALL

SELECT
  'platform_user' AS entity,
  email           AS identifier,
  role            AS notes
FROM platform_users
WHERE email = 'uat-platform@fieldlogichq.ca'

ORDER BY entity, identifier;
