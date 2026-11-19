-- 505_the_member_test_counts_only_active_members.sql
--
-- Board Ready trust close-out 13, open call (c) (owner ruling 2026-11-18, "as recommended"; queue P2d in
-- docs/projects/active/BOARD_READY_TRUST_FIX_PROMPTS.md). Found by P2's security review: the database's two membership
-- tests ignored organization_members.status, so a PENDING invitee (since P2 that includes an existing account with a live
-- session) and a SUSPENDED member passed them. Through their own browser session they could read the club's venue
-- library (org_venues, org_venue_facilities) and its tournaments' team names (teams, policy
-- teams_member_read_for_live_feed, also over Realtime), and WRITE two tournament tables that hold an authenticated
-- INSERT/UPDATE/DELETE grant gated by can_access_tournament (venue_facilities, schedule_facility_lanes). Proved on dev
-- before and after (.probe/member-test-active-only-prove.mjs).
--
-- The change: both functions also require status = 'active'. Nothing else in them moves (the tournament-assignment rule
-- in can_access_tournament is kept word for word). The four wrappers (is_org_member_for_age_group,
-- is_org_member_for_tournament, can_access_tournament_for_pool, can_access_tournament_for_rule_item) call these and
-- inherit the rule. Who loses access: ONLY 'invited' and 'suspended' rows (the CHECK allows exactly invited/active/
-- suspended). A club coach's row is role 'coach', status 'active' and keeps everything, including while a board role
-- waits on it (P2b keeps the coach row active and puts the offer in pending_role).
--
-- Hardening in the same step: a fixed empty search_path (every name below is schema-qualified), as SECURITY DEFINER
-- functions should carry. CREATE OR REPLACE keeps the owner, the argument names and the EXECUTE grants.
--
-- Function bodies only, no table or column change: INVISIBLE to check:migrations; tracked in MANUAL_PROD_STEPS.json.
-- ORDER: independent of any code (no app code calls either function; the app's own doors already refuse pending and
-- suspended rows). It only narrows reads and writes, so it can go to production before or after the promote.

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and status = 'active'
  );
$function$;

create or replace function public.can_access_tournament(t_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.organization_members om
    join public.tournaments t on t.org_id = om.organization_id
    where om.user_id = auth.uid()
      and om.status = 'active'
      and t.id = t_id
      and (
        -- No assignments = unrestricted (absence-means-unrestricted semantics)
        not exists (
          select 1 from public.org_member_tournament_assignments
          where org_member_id = om.id
        )
        or
        -- Has an explicit assignment for this tournament
        exists (
          select 1 from public.org_member_tournament_assignments
          where org_member_id = om.id
            and tournament_id = t_id
        )
      )
  );
$function$;
