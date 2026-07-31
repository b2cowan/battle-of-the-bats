-- ---------------------------------------------------------------
-- Migration 212 — close the PostgREST door on roster PII + player documents
--
-- WHY (verified against LIVE prod 2026-07-31, not migration files):
--
--   * `anon` and `authenticated` both hold the default SELECT grant on public
--     tables in PROD — `has_table_privilege('authenticated', 'public.rep_roster_players',
--     'SELECT') = true`. (In DEV they do NOT, which is why dev structurally cannot
--     reproduce this: impersonation there returns "permission denied". Read this
--     posture from live prod, never from dev and never from a migration comment.
--     See memory/reference_supabase_rls_grants.md.)
--
--   * These four permissive SELECT policies (migration 021/022) key on ASSIGNMENT,
--     never on capability:
--       rep_roster_players    "coaches can read assigned team roster"
--       rep_roster_players    "org members can read rep_roster_players"
--       rep_player_documents  "coaches can read assigned team player documents"
--       rep_player_documents  "org members can read player documents"
--
--   * The browser ships an anon-key Supabase client holding the coach's own
--     session (lib/supabase-browser.ts). So any assigned assistant coach could
--     query PostgREST directly and read guardian_email, guardian_phone,
--     player_date_of_birth, medical_notes, emergency_contact_*, notes and
--     admin_notes — every column `redactRosterPlayer` nulls — plus every
--     player-document row. The entire `rosterPii` capability was bypassable from
--     the browser console, which would have left the app-layer fix in the same
--     change set closing the door but not the window.
--
-- SAFE TO DROP: nothing reads these tables with an anon/authenticated client.
-- Every caller in the app goes through `supabaseAdmin` (service_role, BYPASSRLS),
-- and the coach portal's own header states RLS is NOT its enforcement layer.
-- Dropping these leaves RLS ENABLED with no policies — the platform's standard
-- service-role posture — so anon/authenticated resolve to zero rows.
--
-- Exposure at time of writing: zero. Prod has 0 rep_teams, 0 rep_team_coaches,
-- 0 rep_roster_players, 0 rep_player_documents. This lands before the first
-- customer builds a rep team, not after.
-- ---------------------------------------------------------------

DROP POLICY IF EXISTS "coaches can read assigned team roster"           ON rep_roster_players;
DROP POLICY IF EXISTS "org members can read rep_roster_players"         ON rep_roster_players;
DROP POLICY IF EXISTS "coaches can read assigned team player documents" ON rep_player_documents;
DROP POLICY IF EXISTS "org members can read player documents"           ON rep_player_documents;

-- Belt-and-braces: RLS must stay ON, or the default SELECT grant alone exposes
-- both tables through the auto-generated REST API.
ALTER TABLE rep_roster_players   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_player_documents ENABLE ROW LEVEL SECURITY;

-- Post-apply proof (run against prod once a roster row exists):
--   begin;
--     set local role authenticated;
--     set local request.jwt.claims = '{"sub":"<a real assigned coach user_id>"}';
--     select count(*) from rep_roster_players;    -- must be 0
--     select count(*) from rep_player_documents;  -- must be 0
--   rollback;
