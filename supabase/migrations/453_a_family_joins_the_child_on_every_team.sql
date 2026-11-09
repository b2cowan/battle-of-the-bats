-- 453_a_family_joins_the_child_on_every_team.sql
--
-- Signed-in family accounts Stage 4a, Part 1 (plan docs/projects/active/SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md, Stage 4, RULED 2026-11-08,
-- all 15 asks A, + O1/O2 ruled in build Session 1; build prompt SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md, Part 1). Needs 435, 441, 445, 448.
--
-- WHY: a parent's connection is to the CHILD, on every team in the club, house league and rep (ruling 3). Before this, family_links
-- needed a rep team and a roster entry, so a house-league child could not be connected at all, and the live key was per team.
--
-- WHAT CHANGES
--   family_links
--     rep_team_id, player_id     NULLABLE. Both are now "where the link was made" (a rep coach's invitation), never what it reaches;
--                                a house-league link has neither. The cascades stay (deleting a rep entry still removes a link made on it).
--     family_links_role_player_ck  keeps its name; now `role = 'guardian' AND child_id IS NOT NULL`.
--     family_links_live_child_uniq re-keyed to (child_id, invited_email, role) where live: one live link per child per address.
--     invited_as                 NEW, NOT NULL, default 'rep_coach': how the connection was made (first_parent | second_parent | rep_coach
--                                | requested). Only `second_parent` is ever ended by a stop (ruling 8; CASL flag d). The default exists for
--                                the older rep-side writers (UAT specs, seeds, the join fixture) and is the SAFE direction for flag d; a
--                                house-league link cannot take it silently: family_links_made_on_entry_ck makes rep_coach/requested need
--                                an entry.
--     ended_by                   NEW: parent | club | coach | stop | merged. Set with revoked/declined. A link ended by anyone but a merge
--                                blocks the automatic invitation (a parent who left or was removed is invited again only by Send again).
--     enforce_guardian_cap       two live guardians per CHILD (was: per child per team). An update that leaves a live row live on the
--                                same child is not re-counted (so a row of an over-cap child written before this stays editable).
--   family_invitations           NEW. One invitation, possibly covering several children (ruling 3). Token hash only; 30 days; Send again
--                                replaces (`replaced_by`, deferred FK). Issued only by family_invitation_issue().
--   family_calendar_feeds        NEW. One calendar address per parent (ruling 6). family_links.calendar_token_hash stays, unread once
--                                Part 7 lands; drop it in a later migration.
--   family_invite_stops          NEW. "Don't send me invitations" from a rep coach's invitation email (/legal draft c). Not
--                                second_parent_stops, not family_email_optouts.
--   Stop race closed in the database (CASL flag c):
--     league_registrations_second_parent_not_stopped  refuses guardian_email_2 = an address in second_parent_stops for the org.
--     family_invitations_not_stopped                  refuses an invitation to a stopped address unless that address is the FIRST parent
--                                                     on a sign-up of the org (O2), and a rep_coach invitation to an address in
--                                                     family_invite_stops. ⚠ These two triggers are the ONE sanctioned database read of
--                                                     second_parent_stops outside the stop itself (the 3b guard is over TypeScript).
--   second_parent_stop()         extended: in its one transaction it also cancels the address's open PLACEMENT invitations in the org (unless
--                                it is a first parent there, O2) and ends its `second_parent` links in the org (ended_by 'stop'). Never a
--                                link it holds as first parent (flag d).
--   org_children_join()          re-created from 445 with one change: two live links of one address are duplicates per CHILD now (the team
--                                drops out of the match) and the loser is ended_by 'merged'. A third live guardian still refuses the join.
--
-- PROD PRE-CHECK (prod has none of 445's columns as of the 2026-11-06 snapshot: apply 435, 441, 445 and 448 first):
--   select count(*) from public.family_links;                       -- the guardian tier is off; expect a handful at most
--   select child_id, invited_email, count(*) from public.family_links
--    where status not in ('declined','revoked') group by 1,2 having count(*) > 1;   -- merged below; the NOTICE says how many
--   select child_id, count(*) from public.family_links
--    where status in ('requested','invited','pending_approval','verified') group by 1 having count(*) > 2;  -- left as they are; NOTICE
-- Dev 2026-11-08: 14 links, all live, 0 colliding, 0 over the cap.
--
-- Re-runnable.

begin;

set local lock_timeout = '15s';

lock table public.family_links in share row exclusive mode;

-- ── 1. family_links: the new columns, backfilled UNDER THE OLD CAP (every existing row already satisfies it) ─────────────────
alter table public.family_links add column if not exists invited_as text;
alter table public.family_links add column if not exists ended_by text;

update public.family_links
   set invited_as = case when claim_token_hash is not null or invited_by_user_id is not null then 'rep_coach' else 'requested' end
 where invited_as is null;
-- Before this migration only a coach ended a link (revokeFamilyLink, declineFamilyLink) or a join (445, indistinguishable now).
update public.family_links set ended_by = 'coach' where ended_by is null and status in ('revoked', 'declined');

alter table public.family_links alter column invited_as set default 'rep_coach';
alter table public.family_links alter column invited_as set not null;

alter table public.family_links drop constraint if exists family_links_invited_as_check;
alter table public.family_links add constraint family_links_invited_as_check
  check (invited_as in ('first_parent', 'second_parent', 'rep_coach', 'requested'));
alter table public.family_links drop constraint if exists family_links_ended_by_check;
alter table public.family_links add constraint family_links_ended_by_check
  check (ended_by is null or (ended_by in ('parent', 'club', 'coach', 'stop', 'merged') and status in ('revoked', 'declined')));

-- ── 2. Merge the links that collide under the new per-child key (still under the old cap; revoked rows are never counted) ─────
do $$
declare v_n int;
begin
  with ranked as (
    select id, row_number() over (
             partition by child_id, invited_email, role
             order by (case status when 'verified' then 3 when 'pending_approval' then 2 when 'invited' then 1 else 0 end) desc,
                      created_at, id) as rn
      from public.family_links
     where status not in ('declined', 'revoked')
  ), ended as (
    update public.family_links l
       set status = 'revoked', revoked_at = now(), ended_by = 'merged', calendar_token_hash = null, updated_at = now()
      from ranked r
     where r.id = l.id and r.rn > 1
    returning l.id
  )
  select count(*) into v_n from ended;
  raise notice '453: % live link(s) ended as duplicates of one child and address on another team', v_n;

  select count(*) into v_n from (
    select child_id from public.family_links
     where status in ('requested', 'invited', 'pending_approval', 'verified') group by 1 having count(*) > 2) o;
  raise notice '453: % child(ren) hold more than two live guardians across teams (left as they are; a new one is refused)', v_n;
end $$;

-- ── 3. Not per team any more ──────────────────────────────────────────────────────────────────────────────────────────────────
alter table public.family_links alter column rep_team_id drop not null;
alter table public.family_links alter column player_id drop not null;

alter table public.family_links drop constraint if exists family_links_role_player_ck;
alter table public.family_links add constraint family_links_role_player_ck
  check (role = 'guardian' and child_id is not null);

-- A rep coach's invitation and the old ask path were made on a roster entry; only a house-league invitation is not.
alter table public.family_links drop constraint if exists family_links_made_on_entry_ck;
alter table public.family_links add constraint family_links_made_on_entry_ck
  check (invited_as in ('first_parent', 'second_parent') or player_id is not null);

drop index if exists public.family_links_live_child_uniq;
create unique index if not exists family_links_live_child_uniq
  on public.family_links (child_id, invited_email, role)
  where status not in ('declined', 'revoked');

-- ── 4. Two guardians per child ────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_guardian_cap()
returns trigger
language plpgsql
as $$
declare
  v_live integer;
begin
  -- Only guardian rows that are LIVE and attached to a child consume a seat. `declined` and `revoked` never count, so a
  -- mistake is recoverable rather than permanently burning one of the two slots.
  if new.role <> 'guardian' or new.child_id is null then
    return new;
  end if;
  if new.status in ('declined', 'revoked') then
    return new;
  end if;
  -- (453) A row that was already live on this child takes no new seat (accepting, a new account, a calendar mint).
  if tg_op = 'UPDATE' and old.child_id = new.child_id and old.status not in ('declined', 'revoked') then
    return new;
  end if;

  -- (review 2026-11-05) Serialize on the child: a join holds this row, so an invite waits for it and counts AFTER the join; two
  -- invites for one child count one after the other, not both before either commits.
  perform 1 from public.org_children where id = new.child_id for update;

  -- (453) Per CHILD, on every team in the club (Stage 4 ruling 3): the team no longer narrows the count.
  select count(*) into v_live
    from public.family_links
   where child_id = new.child_id
     and role = 'guardian'
     and status in ('requested', 'invited', 'pending_approval', 'verified')
     and id <> new.id;

  if v_live >= 2 then
    raise exception 'guardian_cap_reached: child % already has 2 live guardians', new.child_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ── 5. Invitations ────────────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.family_invitations (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  -- Lowercased and trimmed, as every guardian address is stored (lib/guardian-email.ts).
  email            text not null,
  token_hash       text not null unique,
  -- placement: the house-league placement email (and its second-parent copy); what an acceptance connects is worked out THEN, from
  --            every placed sign-up of the org carrying this address (ruling 3).
  -- rep_coach: the coach's Send invitation, for one roster entry.
  source           text not null,
  rep_player_id    uuid references public.rep_roster_players(id) on delete cascade,
  child_id         uuid references public.org_children(id) on delete cascade,
  sent_by_user_id  uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  used_at          timestamptz,
  used_by_user_id  uuid references auth.users(id) on delete set null,
  cancelled_at     timestamptz,
  replaced_by      uuid,
  -- The club's Send again (ruling 9): only this lets an address back onto a child it left or was removed from.
  reconnects       boolean not null default false,
  constraint family_invitations_email_check check (email = lower(btrim(email)) and email <> '' and char_length(email) <= 320),
  constraint family_invitations_source_check check (
    (source = 'placement' and rep_player_id is null and child_id is null)
    or (source = 'rep_coach' and rep_player_id is not null and child_id is not null)
  )
);

alter table public.family_invitations add column if not exists reconnects boolean not null default false;

alter table public.family_invitations drop constraint if exists family_invitations_replaced_by_fkey;
alter table public.family_invitations
  add constraint family_invitations_replaced_by_fkey foreign key (replaced_by) references public.family_invitations(id)
    on delete set null deferrable initially deferred;

-- One OPEN invitation per address: per org for placement, per roster entry for a rep coach's.
create unique index if not exists family_invitations_open_placement_uniq
  on public.family_invitations (org_id, email)
  where source = 'placement' and used_at is null and cancelled_at is null and replaced_by is null;
create unique index if not exists family_invitations_open_rep_uniq
  on public.family_invitations (rep_player_id, email)
  where source = 'rep_coach' and used_at is null and cancelled_at is null and replaced_by is null;
create index if not exists family_invitations_org_email_idx on public.family_invitations (org_id, email);
create index if not exists family_invitations_rep_player_idx on public.family_invitations (rep_player_id) where rep_player_id is not null;
create index if not exists family_invitations_child_idx on public.family_invitations (child_id) where child_id is not null;
create index if not exists family_invitations_replaced_by_idx on public.family_invitations (replaced_by) where replaced_by is not null;
create index if not exists family_invitations_sent_by_idx on public.family_invitations (sent_by_user_id) where sent_by_user_id is not null;
create index if not exists family_invitations_used_by_idx on public.family_invitations (used_by_user_id) where used_by_user_id is not null;

alter table public.family_invitations enable row level security;
-- No policies: service-role only. It holds an address and a token hash; nothing in the browser reads it.
grant select, insert, update, delete on public.family_invitations to service_role;

-- ── 6. One calendar address per parent ────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.family_calendar_feeds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  stopped_at  timestamptz
);
create unique index if not exists family_calendar_feeds_live_user_uniq
  on public.family_calendar_feeds (user_id) where stopped_at is null;
create index if not exists family_calendar_feeds_user_idx on public.family_calendar_feeds (user_id);

alter table public.family_calendar_feeds enable row level security;
grant select, insert, update, delete on public.family_calendar_feeds to service_role;

-- ── 7. "Don't send me invitations" (a rep coach's invitation email) ───────────────────────────────────────────────────────────
create table if not exists public.family_invite_stops (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now(),
  constraint family_invite_stops_email_check check (email = lower(btrim(email)) and email <> '' and char_length(email) <= 320)
);
create unique index if not exists family_invite_stops_org_email_uniq on public.family_invite_stops (org_id, email);

alter table public.family_invite_stops enable row level security;
grant select, insert, update, delete on public.family_invite_stops to service_role;

-- ── 8. The stop race, closed in the database (CASL flag c) ────────────────────────────────────────────────────────────────────
create or replace function public.league_registration_second_parent_not_stopped()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.guardian_email_2 is not null
     and (tg_op = 'INSERT' or new.guardian_email_2 is distinct from old.guardian_email_2)
     and exists (
       select 1 from public.second_parent_stops s
        where s.org_id = new.org_id and s.email = lower(btrim(new.guardian_email_2))
     ) then
    raise exception 'second_parent_stopped: that address asked this club to stop its sign-up emails' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.league_registration_second_parent_not_stopped() from public, anon, authenticated;

drop trigger if exists league_registrations_second_parent_not_stopped on public.league_registrations;
create trigger league_registrations_second_parent_not_stopped
  before insert or update of guardian_email_2 on public.league_registrations
  for each row execute function public.league_registration_second_parent_not_stopped();

create or replace function public.family_invitation_not_stopped()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- O2 (owner 2026-11-08): a stop is on the second-parent copies, so an address that is the FIRST parent on a sign-up of this club
  -- is still invited for its own child; an acceptance then connects it only where it is the first parent (the stop cleared the rest).
  if exists (select 1 from public.second_parent_stops s where s.org_id = new.org_id and s.email = new.email)
     and not exists (
       select 1 from public.league_registrations r
        where r.org_id = new.org_id and lower(btrim(r.guardian_email)) = new.email
     ) then
    raise exception 'second_parent_stopped: that address asked this club to stop its sign-up emails' using errcode = '23514';
  end if;
  if new.source = 'rep_coach'
     and exists (select 1 from public.family_invite_stops s where s.org_id = new.org_id and s.email = new.email) then
    raise exception 'family_invite_stopped: that address asked not to get invitations from this club' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.family_invitation_not_stopped() from public, anon, authenticated;

drop trigger if exists family_invitations_not_stopped on public.family_invitations;
create trigger family_invitations_not_stopped
  before insert on public.family_invitations
  for each row execute function public.family_invitation_not_stopped();

-- ── 9. Issue (and re-issue) an invitation in one statement ────────────────────────────────────────────────────────────────────
-- Send again / Email me a new invitation replace the open one (ruling 9): the old answers "expired, or replaced" (drawing state D).
drop function if exists public.family_invitation_issue(uuid, text, text, uuid, uuid, uuid, text, integer);
create or replace function public.family_invitation_issue(
  p_org uuid, p_email text, p_source text, p_rep_player uuid, p_child uuid, p_sent_by uuid, p_token_hash text, p_days integer default 30,
  p_reconnects boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_new   uuid := gen_random_uuid();
begin
  if p_org is null or v_email = '' or p_token_hash is null then
    raise exception 'family_invitation_issue needs an org, an address and a token';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('family_invitation:' || p_org::text || ':' || v_email, 0));

  update public.family_invitations
     set replaced_by = v_new
   where org_id = p_org and email = v_email and source = p_source
     and (p_source <> 'rep_coach' or rep_player_id = p_rep_player)
     and used_at is null and cancelled_at is null and replaced_by is null;

  insert into public.family_invitations (id, org_id, email, token_hash, source, rep_player_id, child_id, sent_by_user_id, expires_at,
                                         reconnects)
  values (v_new, p_org, v_email, p_token_hash, p_source, p_rep_player, p_child, p_sent_by,
          now() + make_interval(days => greatest(1, coalesce(p_days, 30))), coalesce(p_reconnects, false));
  return v_new;
end;
$$;
revoke all on function public.family_invitation_issue(uuid, text, text, uuid, uuid, uuid, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.family_invitation_issue(uuid, text, text, uuid, uuid, uuid, text, integer, boolean) to service_role;

-- ── 10. The stop also ends a second-parent connection (ruling 8; /legal flag d) ───────────────────────────────────────────────
create or replace function public.second_parent_stop(p_org uuid, p_email text, p_source text default 'stop_page')
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_ids uuid[];
begin
  if p_org is null or v_email = '' then
    raise exception 'second_parent_stop needs an org and an address';
  end if;

  -- Only THIS org's sign-ups; the match is on the lowercased trimmed value, as the column is stored.
  with cleared as (
    update public.league_registrations
       set guardian_email_2 = null
     where org_id = p_org
       and guardian_email_2 is not null
       and lower(btrim(guardian_email_2)) = v_email
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from cleared;

  insert into public.second_parent_stops (org_id, email, source, registration_ids)
  values (p_org, v_email, coalesce(nullif(btrim(p_source), ''), 'stop_page'), v_ids)
  on conflict (org_id, email) do update
     set registration_ids = array(
       select distinct x from unnest(public.second_parent_stops.registration_ids || excluded.registration_ids) as x
     );

  -- (453) An open placement invitation to this address: cancelled, unless the address is the first parent on a sign-up of this
  -- club (O2) — then it stays, and its acceptance can only reach the children it is the first parent of.
  if not exists (
    select 1 from public.league_registrations r where r.org_id = p_org and lower(btrim(r.guardian_email)) = v_email
  ) then
    update public.family_invitations
       set cancelled_at = now()
     where org_id = p_org and email = v_email and source = 'placement'
       and used_at is null and cancelled_at is null and replaced_by is null;
  end if;

  -- (453) Its SECOND-PARENT connections in this club end. Never one it holds as first parent, a rep coach's, or an old request.
  update public.family_links
     set status = 'revoked', revoked_at = now(), ended_by = 'stop', calendar_token_hash = null, updated_at = now()
   where org_id = p_org
     and invited_email = v_email
     and invited_as = 'second_parent'
     and status not in ('declined', 'revoked');

  return coalesce(array_length(v_ids, 1), 0);
end;
$function$;

revoke all on function public.second_parent_stop(uuid, text, text) from public, anon, authenticated;
grant execute on function public.second_parent_stop(uuid, text, text) to service_role;

-- ── 11. Join: re-created from 445, duplicates per child ───────────────────────────────────────────────────────────────────────
create or replace function public.org_children_join(p_keep uuid, p_absorb uuid, p_keep_identity boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep_year   int;
  v_absorb_year int;
  k record;
  a record;
begin
  if p_keep is null or p_absorb is null or p_keep = p_absorb then return; end if;
  perform 1 from public.org_children where id in (p_keep, p_absorb) order by id for update;
  if (select count(*) from public.org_children where id in (p_keep, p_absorb)) < 2 then return; end if;
  if (select org_id from public.org_children where id = p_keep)
     is distinct from (select org_id from public.org_children where id = p_absorb) then
    raise exception 'org_child_other_org: two children of different organizations cannot be joined' using errcode = '23514';
  end if;
  select max(y.year) into v_keep_year
    from public.rep_roster_players r join public.rep_program_years y on y.id = r.program_year_id where r.child_id = p_keep;
  select max(y.year) into v_absorb_year
    from public.rep_roster_players r join public.rep_program_years y on y.id = r.program_year_id where r.child_id = p_absorb;
  select medical_notes, emergency_contact_name, emergency_contact_phone, date_of_birth into k from public.org_children where id = p_keep;
  select medical_notes, emergency_contact_name, emergency_contact_phone, date_of_birth into a from public.org_children where id = p_absorb;

  update public.rep_roster_players       set child_id = p_keep where child_id = p_absorb;
  update public.rep_tryout_registrations set child_id = p_keep where child_id = p_absorb;
  update public.league_registrations     set child_id = p_keep where child_id = p_absorb;

  -- (445, re-keyed by 453) The parent links ride with the entries. Two live links for one address (one from each child) would
  -- collide with the live-unique rule, and the person is the same: the more connected one stays (verified over waiting over
  -- invited over requested; on a tie the kept child's), the other is ended ('merged'). Then every remaining link of the absorbed
  -- child becomes the kept child's. (The two-guardian cap still applies: a join that would give one child a third live guardian
  -- raises guardian_cap_reached and nothing moves.)
  update public.family_links l
     set status = 'revoked', revoked_at = now(), ended_by = 'merged', calendar_token_hash = null, updated_at = now()
   where l.child_id in (p_keep, p_absorb)
     and l.status not in ('declined', 'revoked')
     and exists (
       select 1 from public.family_links o
        where o.id <> l.id
          and o.child_id in (p_keep, p_absorb) and o.child_id <> l.child_id
          and o.invited_email = l.invited_email and o.role = l.role
          and o.status not in ('declined', 'revoked')
          and (
            (case o.status when 'verified' then 3 when 'pending_approval' then 2 when 'invited' then 1 else 0 end)
              > (case l.status when 'verified' then 3 when 'pending_approval' then 2 when 'invited' then 1 else 0 end)
            or (
              (case o.status when 'verified' then 3 when 'pending_approval' then 2 when 'invited' then 1 else 0 end)
                = (case l.status when 'verified' then 3 when 'pending_approval' then 2 when 'invited' then 1 else 0 end)
              and o.child_id = p_keep
            )
          )
     );
  update public.family_links set child_id = p_keep where child_id = p_absorb;
  -- (453) A rep coach's open invitation names the child too: it follows, rather than cascading away with the absorbed record.
  update public.family_invitations set child_id = p_keep where child_id = p_absorb;

  insert into public.child_match_rejections (child_a_id, child_b_id, door, rejected_by, rejected_at)
  select least(p_keep, x.other), greatest(p_keep, x.other), x.door, x.rejected_by, x.rejected_at
    from (
      select case when r.child_a_id = p_absorb then r.child_b_id else r.child_a_id end as other,
             r.door, r.rejected_by, r.rejected_at
        from public.child_match_rejections r
       where p_absorb in (r.child_a_id, r.child_b_id)
    ) x
   where x.other <> p_keep
  on conflict (child_a_id, child_b_id) do nothing;

  if coalesce(v_absorb_year, -1) > coalesce(v_keep_year, -1) then
    update public.org_children
       set medical_notes           = coalesce(a.medical_notes, k.medical_notes),
           emergency_contact_name  = coalesce(a.emergency_contact_name, k.emergency_contact_name),
           emergency_contact_phone = coalesce(a.emergency_contact_phone, k.emergency_contact_phone),
           date_of_birth           = coalesce(k.date_of_birth, a.date_of_birth), -- (review) a keeper with none takes the other's
           updated_at = now()
     where id = p_keep;
  else
    update public.org_children
       set medical_notes           = coalesce(k.medical_notes, a.medical_notes),
           emergency_contact_name  = coalesce(k.emergency_contact_name, a.emergency_contact_name),
           emergency_contact_phone = coalesce(k.emergency_contact_phone, a.emergency_contact_phone),
           date_of_birth           = coalesce(k.date_of_birth, a.date_of_birth), -- (review) a keeper with none takes the other's
           updated_at = now()
     where id = p_keep;
  end if;
  update public.rep_roster_players r
     set medical_notes = c.medical_notes,
         emergency_contact_name = c.emergency_contact_name,
         emergency_contact_phone = c.emergency_contact_phone
    from public.org_children c, public.rep_program_years y
   where c.id = p_keep
     and r.child_id = p_keep
     and y.id = r.program_year_id
     and y.status in ('draft', 'active')
     and (nullif(btrim(r.medical_notes), ''), nullif(btrim(r.emergency_contact_name), ''),
          nullif(btrim(r.emergency_contact_phone), ''))
         is distinct from (c.medical_notes, c.emergency_contact_name, c.emergency_contact_phone);
  delete from public.org_children where id = p_absorb;
  -- (445) The Children queue keeps the record the reviewer chose, name and birth date included.
  if not p_keep_identity then
    perform public.org_child_rename_from_entries(p_keep);
  end if;
end;
$$;

revoke all on function public.org_children_join(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.org_children_join(uuid, uuid, boolean) to service_role;

comment on column public.family_links.rep_team_id is
  'The rep team a coach''s invitation was made on (453: nullable; NULL on a house-league link). Never what the link reaches: that is '
  'every team the child is live on in the org (lib/family-link-reach.ts).';
comment on column public.family_links.player_id is
  'The roster entry a coach''s invitation was made on (453: nullable; NULL on a house-league link). History, not access.';
comment on column public.family_links.invited_as is
  '453: how the connection was made. Only second_parent is ever ended by a second-parent stop (CASL flag d).';
comment on column public.family_links.ended_by is
  '453: who ended the link. Any value but merged blocks the automatic house-league invitation.';

commit;
