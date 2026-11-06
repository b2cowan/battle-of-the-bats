-- 445_a_parent_is_connected_to_the_child.sql
--
-- Club Tier Stage 14 S6 · "Joining records + the parent link" (14d part 2, Ask 11 + Ask 13). Owner rulings 2026-11-04
-- (plan docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md, Stage 14; build prompt
-- docs/projects/active/CLUB_TIER_STAGE14_BUILD_PROMPT.md, S6) and "go with your recommendations" 2026-11-05. Needs 435, 438, 441.
--
-- WHAT THIS ADDS
--   family_links.child_id        Ask 13: the parent link points at the CHILD. `player_id` stays, as "the entry this link was
--                                made on" (still NOT NULL by family_links_role_player_ck, still the cascade the roster-delete
--                                guard relies on); `child_id` is what ACCESS reads. Backfilled from each link's entry, then
--                                NOT NULL. A BEFORE INSERT trigger fills it from the entry when a writer sends only
--                                `player_id` (the UAT specs and any older writer), so no writer has to change to stay valid.
--   family_links_live_child_uniq The live-unique rule moves from (team, address, role) to (child, team, address, role). Same
--                                address on two children of one team is now legal (a parent with two children on a team could
--                                not be connected for both); the same address twice on ONE child on one team is still
--                                refused. A roll no longer needs a new invite: the link is on the child.
--   enforce_guardian_cap         Two live guardians per CHILD per team (was: per entry), read from child_id.
--   org_children_join(keep, absorb, keep_identity)
--                                Re-created from 441 EXACTLY, plus (a) the parent links of the absorbed child move to the kept
--                                one — a live link that repeats one the kept child already has (same team, same address) is
--                                ended, the more connected one surviving; (b) a third argument, default false: the Children
--                                queue passes TRUE so the record the reviewer chose to keep keeps its name and birth date
--                                ("Keep this record" decides them); every older caller (the confirmed-link trigger) keeps
--                                the newest-entry rule. The 2-argument form is dropped (the default covers every caller).
--   org_children_split(child, rosters, leagues, actor)
--                                Split records, generic: the chosen roster entries and house-league sign-ups (and the tryout
--                                sign-ups those roster entries were accepted from) move to a NEW child; everything else stays.
--                                Nothing is deleted, so a split is exact. The new child is named from its newest entry (a
--                                house-league-only child keeps the old name), both children re-read their health, and the
--                                pair is stored as a "no" (door 'split') so the Children queue never proposes it again. Parent
--                                links stay with the kept child (drawn: "Grace stays linked to the record you keep").
--   child_match_rejections.door  accepts 'children_queue' (Not the same child) and 'split'.
--
-- PROD PRE-CHECK: none needed (the new unique index is looser than the one it replaces; every link has an entry with a child).
--   select count(*) from public.family_links;   -- the guardian tier is off; expect a handful at most
--
-- The old FK and CHECK names are kept (family_links_player_id_fkey, family_links_role_player_ck).

begin;

set local lock_timeout = '15s';

-- ── 1. family_links.child_id ──────────────────────────────────────────────────────────────────────────────────────────
alter table public.family_links add column if not exists child_id uuid;

lock table public.family_links in share row exclusive mode;

update public.family_links l
   set child_id = r.child_id
  from public.rep_roster_players r
 where r.id = l.player_id and l.child_id is null;

alter table public.family_links alter column child_id set not null;

alter table public.family_links drop constraint if exists family_links_child_id_fkey;
alter table public.family_links
  add constraint family_links_child_id_fkey foreign key (child_id) references public.org_children(id)
    on delete cascade deferrable initially deferred;

create index if not exists family_links_child_id_idx on public.family_links (child_id);

-- The live-unique rule, per child.
drop index if exists public.family_links_live_uniq;
create unique index if not exists family_links_live_child_uniq
  on public.family_links (child_id, rep_team_id, invited_email, role)
  where status not in ('declined', 'revoked');

-- A writer that sends only the entry (inviteGuardian before this change, the UAT specs) still gets a valid link: the child is
-- the entry's. Named so it fires BEFORE family_links_guardian_cap (trigger names fire in order). The organization is checked
-- only when the child is set or changed — a team moving into its club updates org_id and org_children together.
create or replace function public.family_link_child_fills()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.child_id is null and new.player_id is not null then
    select r.child_id into new.child_id from public.rep_roster_players r where r.id = new.player_id;
  end if;
  if new.child_id is not null and (tg_op = 'INSERT' or new.child_id is distinct from old.child_id) and not exists (
    select 1 from public.org_children c where c.id = new.child_id and c.org_id = new.org_id
  ) then
    raise exception 'org_child_other_org: a parent link''s child must belong to the link''s organization'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists family_links_a_child_fills on public.family_links;
create trigger family_links_a_child_fills
  before insert or update of child_id, player_id on public.family_links
  for each row execute function public.family_link_child_fills();

revoke all on function public.family_link_child_fills() from public, anon, authenticated;

-- ── 2. Two guardians per child (per team) ─────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_guardian_cap()
returns trigger
language plpgsql
as $$
declare
  v_live integer;
begin
  -- Only guardian rows that are LIVE and attached to a child consume a seat. `declined` and `revoked` never count, so a
  -- coach's mistake is recoverable rather than permanently burning one of the two slots.
  if new.role <> 'guardian' or new.child_id is null then
    return new;
  end if;
  if new.status in ('declined', 'revoked') then
    return new;
  end if;

  -- (review 2026-11-05) Serialize on the child: a join holds this row, so an invite waits for it and counts AFTER the join; two
  -- invites for one child count one after the other, not both before either commits.
  perform 1 from public.org_children where id = new.child_id for update;

  select count(*) into v_live
    from public.family_links
   where child_id = new.child_id
     and rep_team_id = new.rep_team_id
     and role = 'guardian'
     and status in ('requested', 'invited', 'pending_approval', 'verified')
     and id <> new.id;

  if v_live >= 2 then
    raise exception 'guardian_cap_reached: child % already has 2 live guardians on this team', new.child_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ── 3. The stored "no" learns two more doors ──────────────────────────────────────────────────────────────────────────
alter table public.child_match_rejections drop constraint if exists child_match_rejections_door_check;
alter table public.child_match_rejections
  add constraint child_match_rejections_door_check
  check (door in ('single_add', 'paste_list', 'tryout_accept', 'children_queue', 'split'));

-- ── 4. Join: re-created from 441, plus the parent links and the keep-identity choice ───────────────────────────────────
drop function if exists public.org_children_join(uuid, uuid);

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

  -- (445) The parent links ride with the entries. Two live links for one address on one team (one from each child) would
  -- collide with the live-unique rule, and the person is the same: the more connected one stays (verified over waiting over
  -- invited over requested; on a tie the kept child's), the other is ended. Then every remaining link of the absorbed child
  -- becomes the kept child's. (The two-guardian cap still applies: a join that would give one child a third live guardian on
  -- a team raises guardian_cap_reached and nothing moves.)
  update public.family_links l
     set status = 'revoked', revoked_at = now(), updated_at = now()
   where l.child_id in (p_keep, p_absorb)
     and l.status not in ('declined', 'revoked')
     and exists (
       select 1 from public.family_links o
        where o.id <> l.id
          and o.child_id in (p_keep, p_absorb) and o.child_id <> l.child_id
          and o.rep_team_id = l.rep_team_id and o.invited_email = l.invited_email and o.role = l.role
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

-- ── 5. Split records: move chosen entries to a new child ──────────────────────────────────────────────────────────────
create or replace function public.org_children_split(p_child uuid, p_rosters uuid[], p_leagues uuid[], p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old       public.org_children%rowtype;
  v_new       uuid;
  v_rosters   uuid[] := coalesce(p_rosters, '{}');
  v_leagues   uuid[] := coalesce(p_leagues, '{}');
  v_regs      uuid[];
  v_moved     int;
  v_total     int;
begin
  select * into v_old from public.org_children where id = p_child for update;
  if not found then
    raise exception 'org_child_gone: that child no longer exists' using errcode = 'P0002';
  end if;

  -- Every chosen entry must be this child's (a crafted request cannot move another child's seasons).
  if (select count(*) from public.rep_roster_players where id = any (v_rosters) and child_id = p_child)
       <> cardinality(array(select distinct x from unnest(v_rosters) x))
     or (select count(*) from public.league_registrations where id = any (v_leagues) and child_id = p_child)
       <> cardinality(array(select distinct x from unnest(v_leagues) x)) then
    raise exception 'org_child_split_foreign: an entry named for the split is not this child''s' using errcode = '23514';
  end if;

  -- The sign-ups those roster entries were accepted from travel with them (an entry and its sign-up are one season).
  v_regs := array(
    select t.id from public.rep_tryout_registrations t
     where t.child_id = p_child
       and t.id in (select r.tryout_registration_id from public.rep_roster_players r where r.id = any (v_rosters) and r.tryout_registration_id is not null));

  v_moved := cardinality(array(select distinct x from unnest(v_rosters) x))
           + cardinality(array(select distinct x from unnest(v_leagues) x))
           + cardinality(v_regs);
  v_total := (select count(*) from public.rep_roster_players where child_id = p_child)
           + (select count(*) from public.league_registrations where child_id = p_child)
           + (select count(*) from public.rep_tryout_registrations where child_id = p_child);
  if v_moved = 0 or v_moved >= v_total then
    raise exception 'org_child_split_all_or_none: a split moves some of the seasons, not none and not all' using errcode = '23514';
  end if;

  v_new := gen_random_uuid();
  insert into public.org_children (id, org_id, first_name, last_name, date_of_birth)
  values (v_new, v_old.org_id, v_old.first_name, v_old.last_name, v_old.date_of_birth);

  update public.rep_roster_players       set child_id = v_new where id = any (v_rosters);
  update public.league_registrations     set child_id = v_new where id = any (v_leagues);
  update public.rep_tryout_registrations set child_id = v_new where id = any (v_regs);

  -- Names (rep entries name a child; a house-league-only child keeps the copy above) and health, both sides re-read.
  perform public.org_child_rename_from_entries(v_new);
  perform public.org_child_rename_from_entries(p_child);
  perform public.org_child_health_from_entries(v_new);
  perform public.org_child_health_from_entries(p_child);

  -- The person who split them said these are two children: never propose the pair again.
  insert into public.child_match_rejections (child_a_id, child_b_id, door, rejected_by)
  values (least(p_child, v_new), greatest(p_child, v_new), 'split', p_actor)
  on conflict (child_a_id, child_b_id) do nothing;

  return v_new;
end;
$$;

revoke all on function public.org_children_split(uuid, uuid[], uuid[], uuid) from public, anon, authenticated;
grant execute on function public.org_children_split(uuid, uuid[], uuid[], uuid) to service_role;

commit;
