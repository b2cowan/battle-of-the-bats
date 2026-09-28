-- 310 — The tournament tables leave the public key
-- (owner go 2026-09-28: "go ahead with stage 1"; plan docs/projects/active/PROD_DATA_API_EXPOSURE_PLAN.md;
--  finding DB_ARCHITECTURE_REVIEW #44)
--
-- THE PROBLEM. The row-security policies on these tables are identical on dev and prod. The
-- GRANTS are not: prod still carries Supabase's legacy blanket grant (anon + authenticated hold
-- every privilege on 181 of 184 public tables), dev holds only what migrations granted. So on prod
-- every `USING (true)` policy is a live door for the publishable key that ships in every page:
--   · teams_anon_read (mig 009)       every club's registrations — email, coach_email, payment
--                                     status, amounts paid, admin and check-in notes
--   · games_anon_read                 score_submitted_by_email on every scored game, admin notes
--   · tournaments/announcements/...   a contact email the club chose to hide, sender addresses
--   · teams_anon_insert (mig 009)     anyone can insert a registration into any tournament,
--                                     around capacity, fees and a closed registration page
--   · "Allow all for authenticated users on pools"   PROD-ONLY: any signed-in account, any org,
--                                     may write any club's pools. Mig 199 missed it because it is
--                                     spelled `auth.role() = 'authenticated'`, not `USING (true)`.
--
-- WHY THIS IS SAFE. Nothing the product runs uses the public path to these tables:
--   · every read and write goes through the service role (public pages pass { admin: true };
--     registration inserts with supabaseAdmin);
--   · dev has run for months without these grants;
--   · prod edge logs 2026-09-21..27: all 1,928 PostgREST calls to these tables used the SECRET key.
-- The only genuine browser readers are the realtime feeds, and realtime filters both the
-- subscription (subscription_check_filters) and the payload (apply_rls) by COLUMN privilege — so a
-- column grant keeps each feed working and keeps private columns out of what it sends:
--   · public bracket, scorekeeper board, admin live rail   games UPDATE by tournament_id
--   · admin live rail "new team registered"                teams INSERT by tournament_id (name only)
--   · notification bell                                    notifications INSERT by user_id
--
-- AFTERWARDS dev and prod hold IDENTICAL grants on these nine tables — dev becomes a faithful
-- security replica for them, and the live feeds work on dev for the first time.
--
-- ROLLBACK RULE. If a feed turns out to need one more field, grant that ONE column. Never
-- `grant all` back: that reopens every column and every USING (true) policy at once.
--
-- Idempotent: REVOKE of an absent privilege and DROP POLICY IF EXISTS are no-ops, the policy is
-- dropped before it is created, and the publication step checks membership first.

-- 1. Server-only from here: no privilege at all for the public key or a signed-in session.
--    (A table-level REVOKE ALL also clears any column-level grants, so a re-run starts clean.)
revoke all on public.tournaments, public.divisions, public.pools, public.announcements,
              public.diamonds, public.tournament_archives, public.teams, public.games
  from anon, authenticated;

-- 2. teams: the admin live rail's "new team registered" line needs an org member to see a new
--    team's NAME, nothing else. Members only — the public key gets nothing from teams.
grant select (id, tournament_id, name) on public.teams to authenticated;
drop policy if exists "teams_anon_read"     on public.teams;
drop policy if exists "teams_anon_insert"   on public.teams;   -- closes cleanup item T5
drop policy if exists "teams_member_update" on public.teams;
drop policy if exists "teams_member_delete" on public.teams;
drop policy if exists "teams_member_read_for_live_feed" on public.teams;
create policy "teams_member_read_for_live_feed" on public.teams
  for select to authenticated
  using (public.can_access_tournament(tournament_id));

-- 3. games: the public schedule — every column except who scored it and the admin note.
--    ⚠ A column added to games later is NOT readable by the feeds until it is added here; that is
--    the point (it fails closed).
grant select (id, tournament_id, division_id, home_team_id, away_team_id, game_date, game_time,
  location, diamond_id, home_score, away_score, status, is_playoff, bracket_id, bracket_code,
  home_placeholder, away_placeholder, home_slot_id, away_slot_id, score_submitted_at,
  score_submission_source, venue_facility_id, schedule_facility_lane_id, generator_locked,
  duration_minutes, round_label, bracket_label)
  on public.games to anon, authenticated;
drop policy if exists "games_member_insert" on public.games;
drop policy if exists "games_member_update" on public.games;
drop policy if exists "games_member_delete" on public.games;
-- games_anon_read (USING true) stays: it is the public schedule, now limited by the column grant.

-- 4. pools: the prod-only "any signed-in account may write" rule. A no-op on dev.
drop policy if exists "Allow all for authenticated users on pools" on public.pools;

-- 5. notifications: the bell's live unread count (rows limited to the reader's own by the existing
--    "own notifications select" policy). Already held on prod; this turns the bell on for dev.
grant select on public.notifications to authenticated;

-- 6. Publication parity: teams is in prod's realtime publication and not dev's.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teams'
  ) then
    alter publication supabase_realtime add table public.teams;
  end if;
end $$;
