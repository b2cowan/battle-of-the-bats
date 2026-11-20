-- 510 — The Founding Season holders move onto ordinary free time (owner ruling 2026-11-19, BUSINESS_DECISIONS.md top
-- entry; plan docs/projects/active/FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md Stage 2a).
--
-- DATA ONLY. Today a Founding holder's access is its STORED plan (organizations.plan_id, subscription_status 'active',
-- current_period_end 2027-10-01, no Stripe subscription) and, for a coach, a staff-billed workspace with an open
-- team entitlement. Its `org_overrides` 'comp_period' row is only a cohort mark and gives no access. Nothing ever ends it.
-- After this migration each holder holds exactly what a staff give of free time writes, ending at the same instant the
-- Founding Season stored (2027-10-01 04:00 UTC = midnight Eastern going into October 1, so the last free day is
-- September 30, 2027), and its comp row is REVOKED (kept, never deleted):
--
--   CLUB holder (account_kind 'organization', plan tournament or tournament_plus):
--     organizations: plan_id 'tournament', tournament_limit 1, subscription_status 'active', no period, no period end
--       (a free Tournament club's own plan; free time lifts it, as `foldGrants` reads a plan grant above the own plan).
--     org_overrides: a 'plan_tier' grant, target {"plan":"tournament_plus"}, starts now, expires 2027-10-01 04:00 UTC.
--       The free Tournament holder gets Tournament Plus free time too (the ruling).
--     platform_audit_log: 'create_override', the row the staff give writes (`giveFreeTime`).
--   COACH holder (account_kind 'team_workspace', plan team, one workspace):
--     organizations: subscription_status 'canceled', no period, no period end (stored ended; the grant holds it open).
--     org_overrides: a 'subscription_status' grant, value 'active', starts now, expires 2027-10-01 04:00 UTC.
--     team_workspaces: subscription_status 'canceled', no period end, free_time_given_at now (the free-time mark;
--       the 14- and 3-day reminder emails and the ended wall read it). billing_mode stays 'platform_override'.
--     team_entitlements: the one running row becomes source 'platform_override', status 'active', ends 2027-10-01 04:00
--       UTC (production holds it as 'team_plan' with no end).
--     platform_audit_log: 'give_portal_free_time' with mode 'moved' (NOT 'first': the Story would say the portal was
--       created from a free team, which it was not).
--   EVERY holder: its comp row(s) revoked (revoked_at, revoked_by) with a 'revoke_override' audit row naming the row,
--     so the free-time Story says why (the row `endClubOverride` writes).
--
-- Holders are chosen BY THE COMP MARK, never by name: an unrevoked 'comp_period' row whose expires_at is one of
-- FOUNDING_SEASON_COMP_EXPIRIES (lib/plan-config.ts: 2027-10-01 04:00 UTC and the legacy 2027-01-01 00:00 UTC). Every
-- holder gets September 30, 2027 — the ruling's date — whichever of the two its mark carries (production has none on
-- the legacy instant; dev has one fixture).
--
-- ALL OR NOTHING: one DO block. It REFUSES, changing nothing, if any holder pays through Stripe, is on a plan free time
-- cannot carry the way above, is not active or is suspended, already has a running plan or billing-status grant, is a
-- coach with no single workspace or no single running entitlement, is a coach whose portal is not an independent
-- staff-billed one free of Stripe ids, or is a coach who already has (or whose team already has) a free-time portal.
-- (The active/suspended and portal-state refusals were added after the dev rehearsal, from /review; production held 0
-- holders in any of those states on 2026-11-19, counts only. Dev's one suspended fixture, dev-tplus-org, had already moved.)
-- RE-RUNNABLE: once revoked a holder carries no live mark, so a second run finds nothing and changes nothing.
--
-- Counts before (2026-11-19, counts only): production 3 holders (one Tournament Plus club, one free Tournament club, one
-- Premium coach), all on 2027-10-01 04:00 UTC, none with a Stripe subscription, a running grant or a free-time
-- collision; dev 5 holders (three Tournament Plus clubs, one free Tournament club, one coach).
--
-- PRODUCTION: owner-run release step, BEFORE the Stage 2b code (which removes the Founding code) reaches production —
-- otherwise a holder is left on a stored plan with nothing to end it. Safe with the code production serves today (its
-- billing page already lets free time win over the Founding card). Needs ENTITLEMENT_GRANTS_ENABLED=true on the server
-- (confirmed 2026-10-25): with it off, a grant does nothing and the clubs would read as their own plan at once.
-- Data only, so INVISIBLE to check:migrations; declared in MANUAL_PROD_STEPS.json with its verify queries.

do $$
declare
  c_end    constant timestamptz := '2027-10-01T04:00:00Z';
  c_reason constant text := 'Founding Season promise kept as free time through September 30, 2027 (owner ruling 2026-11-19)';
  c_actor  constant text := 'system';
  holder_ids uuid[];
  bad text;
  h record;
  ws record;
  gid uuid;
  ent_count int;
  n_club int := 0;
  n_coach int := 0;
  n_revoked int := 0;
begin
  select coalesce(array_agg(distinct o.org_id), '{}') into holder_ids
  from public.org_overrides o
  where o.type = 'comp_period'
    and o.revoked_at is null
    and o.expires_at in ('2027-10-01T04:00:00Z'::timestamptz, '2027-01-01T00:00:00Z'::timestamptz);

  raise notice 'Founding holders before: % (clubs %, coaches %)',
    cardinality(holder_ids),
    (select count(*) from public.organizations g where g.id = any(holder_ids) and g.account_kind = 'organization'),
    (select count(*) from public.organizations g where g.id = any(holder_ids) and g.account_kind = 'team_workspace');

  if cardinality(holder_ids) = 0 then
    raise notice 'Nothing to move: no unrevoked Founding mark.';
    return;
  end if;

  -- Refusals. Each names the holder by id only.
  select string_agg(g.id::text || ' (' || coalesce(g.account_kind, 'null') || '/' || coalesce(g.plan_id, 'null') || ')', ', ') into bad
  from public.organizations g
  where g.id = any(holder_ids)
    and (
      g.stripe_subscription_id is not null
      or not (
        (g.account_kind = 'organization' and g.plan_id in ('tournament', 'tournament_plus'))
        or (g.account_kind = 'team_workspace' and g.plan_id = 'team')
      )
    );
  if bad is not null then
    raise exception 'Refused, nothing changed: holder(s) pay through Stripe or are on a plan this move cannot carry: %', bad;
  end if;

  -- The stored state the move overwrites must be the Founding one (/review 2026-11-19): an active, unsuspended account,
  -- and for a coach an independent, staff-billed workspace with no Stripe ids. Anything else is a case to look at first
  -- (a suspended club would be half-reopened; a club-owned or archived portal is not this move's to make).
  select string_agg(g.id::text, ', ') into bad
  from public.organizations g
  where g.id = any(holder_ids)
    and (g.subscription_status is distinct from 'active' or g.billing_suspended_at is not null);
  if bad is not null then
    raise exception 'Refused, nothing changed: holder(s) not active, or suspended: %', bad;
  end if;

  select string_agg(w.workspace_org_id::text, ', ') into bad
  from public.team_workspaces w
  where w.workspace_org_id = any(holder_ids)
    and (w.billing_mode is distinct from 'platform_override'
      or w.workspace_state is distinct from 'independent'
      or w.stripe_subscription_id is not null
      or exists (select 1 from public.team_entitlements e
                 where e.team_workspace_id = w.id and e.stripe_subscription_item_id is not null));
  if bad is not null then
    raise exception 'Refused, nothing changed: coach holder(s) not an independent staff-billed portal free of Stripe ids: %', bad;
  end if;

  select string_agg(distinct x.org_id::text, ', ') into bad
  from public.org_overrides x
  where x.org_id = any(holder_ids)
    and x.type in ('plan_tier', 'subscription_status')
    and x.revoked_at is null
    and (x.expires_at is null or x.expires_at > now());
  if bad is not null then
    raise exception 'Refused, nothing changed: holder(s) already have a running plan or billing-status grant: %', bad;
  end if;

  select string_agg(g.id::text, ', ') into bad
  from public.organizations g
  where g.id = any(holder_ids) and g.account_kind = 'team_workspace'
    and (select count(*) from public.team_workspaces w where w.workspace_org_id = g.id) <> 1;
  if bad is not null then
    raise exception 'Refused, nothing changed: coach holder(s) without exactly one workspace: %', bad;
  end if;

  select string_agg(w.workspace_org_id::text, ', ') into bad
  from public.team_workspaces w
  where w.workspace_org_id = any(holder_ids)
    and (
      w.free_time_given_at is not null
      or exists (
        select 1 from public.team_workspaces w2
        where w2.id <> w.id and w2.free_time_given_at is not null
          and ((w.primary_owner_user_id is not null and w2.primary_owner_user_id = w.primary_owner_user_id)
            or (w.basic_coach_team_id is not null and w2.basic_coach_team_id = w.basic_coach_team_id))
      )
    );
  if bad is not null then
    raise exception 'Refused, nothing changed: coach holder(s) already marked free time, or the coach/team already has a free-time portal: %', bad;
  end if;

  -- Clubs.
  for h in
    select g.id from public.organizations g
    where g.id = any(holder_ids) and g.account_kind = 'organization'
    order by g.id
  loop
    gid := gen_random_uuid();
    insert into public.platform_audit_log (actor_email, org_id, action, field, old_value, new_value, reason)
    values (c_actor, h.id, 'create_override', 'type', null,
      jsonb_build_object('type', 'plan_tier', 'value', null, 'target', jsonb_build_object('plan', 'tournament_plus'),
        'expires_at', c_end, 'last_day', '2027-09-30', 'override_id', gid, 'moved_from', 'founding_season'),
      c_reason);
    update public.organizations
      set plan_id = 'tournament', tournament_limit = 1, subscription_status = 'active',
          subscription_period = null, current_period_end = null
      where id = h.id;
    insert into public.org_overrides (id, org_id, type, value, target, starts_at, expires_at, reason, created_by)
    values (gid, h.id, 'plan_tier', null, jsonb_build_object('plan', 'tournament_plus'), now(), c_end, c_reason, c_actor);
    n_club := n_club + 1;
  end loop;

  -- Coaches.
  for h in
    select g.id from public.organizations g
    where g.id = any(holder_ids) and g.account_kind = 'team_workspace'
    order by g.id
  loop
    select w.* into ws from public.team_workspaces w where w.workspace_org_id = h.id;
    select count(*) into ent_count from public.team_entitlements e
    where e.org_id = h.id and e.team_workspace_id = ws.id
      and e.status in ('active', 'trialing', 'past_due')
      and (e.starts_at is null or e.starts_at <= now())
      and (e.ends_at is null or e.ends_at > now());
    if ent_count <> 1 then
      raise exception 'Refused, nothing changed: coach holder % has % running team entitlements (expected 1)', h.id, ent_count;
    end if;

    gid := gen_random_uuid();
    insert into public.org_overrides (id, org_id, type, value, target, starts_at, expires_at, reason, created_by)
    values (gid, h.id, 'subscription_status', 'active', null, now(), c_end, c_reason, c_actor);
    update public.organizations
      set subscription_status = 'canceled', subscription_period = null, current_period_end = null
      where id = h.id;
    update public.team_workspaces
      set subscription_status = 'canceled', current_period_end = null, free_time_given_at = now(),
          free_time_reminded_14_for = null, free_time_reminded_3_for = null, updated_at = now()
      where id = ws.id;
    update public.team_entitlements e
      set source = 'platform_override', status = 'active', ends_at = c_end, updated_at = now()
      where e.org_id = h.id and e.team_workspace_id = ws.id
        and e.status in ('active', 'trialing', 'past_due')
        and (e.starts_at is null or e.starts_at <= now())
        and (e.ends_at is null or e.ends_at > now());
    insert into public.platform_audit_log (actor_email, org_id, action, field, old_value, new_value, reason)
    values (c_actor, h.id, 'give_portal_free_time', 'type', null,
      jsonb_build_object('mode', 'moved', 'override_id', gid, 'last_day', '2027-09-30',
        'coach_user_id', ws.primary_owner_user_id, 'moved_from', 'founding_season'),
      c_reason);
    n_coach := n_coach + 1;
  end loop;

  -- The Founding marks: revoked, kept.
  for h in
    select o.id, o.org_id from public.org_overrides o
    where o.org_id = any(holder_ids) and o.type = 'comp_period' and o.revoked_at is null
      and o.expires_at in ('2027-10-01T04:00:00Z'::timestamptz, '2027-01-01T00:00:00Z'::timestamptz)
    order by o.id
  loop
    insert into public.platform_audit_log (actor_email, org_id, action, field, old_value, new_value, reason)
    values (c_actor, h.org_id, 'revoke_override', 'id', to_jsonb(h.id::text), null, c_reason);
    update public.org_overrides set revoked_at = now(), revoked_by = c_actor where id = h.id;
    n_revoked := n_revoked + 1;
  end loop;

  raise notice 'Moved to free time: % clubs, % coaches; Founding marks revoked: %', n_club, n_coach, n_revoked;
end $$;

-- Counts after (the same on every run once the move is made).
select
  (select count(distinct org_id) from public.org_overrides
    where type = 'comp_period' and revoked_at is null
      and expires_at in ('2027-10-01T04:00:00Z'::timestamptz, '2027-01-01T00:00:00Z'::timestamptz)) as founding_holders_left,
  (select count(*) from public.org_overrides
    where reason = 'Founding Season promise kept as free time through September 30, 2027 (owner ruling 2026-11-19)'
      and type = 'plan_tier' and revoked_at is null) as club_free_time_grants,
  (select count(*) from public.org_overrides
    where reason = 'Founding Season promise kept as free time through September 30, 2027 (owner ruling 2026-11-19)'
      and type = 'subscription_status' and revoked_at is null) as coach_free_time_grants,
  (select count(*) from public.platform_audit_log
    where action = 'revoke_override'
      and reason = 'Founding Season promise kept as free time through September 30, 2027 (owner ruling 2026-11-19)') as founding_marks_revoked;
