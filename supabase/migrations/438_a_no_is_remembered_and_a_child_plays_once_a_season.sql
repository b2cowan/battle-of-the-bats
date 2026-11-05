-- 438_a_no_is_remembered_and_a_child_plays_once_a_season.sql
--
-- Club Tier Stage 14 S3 · "Bring back a past player" and "Same child?" (14b screens). Owner rulings 2026-11-04 (plan
-- docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md, Stage 14; build prompt
-- docs/projects/active/CLUB_TIER_STAGE14_BUILD_PROMPT.md, S3). Needs 435.
--
-- WHAT THIS ADDS
--   child_match_rejections        Ask 4: "A 'no' is stored and never asked again, anywhere." One row per pair of children a
--                                 person said are NOT the same child (single add, paste a list, a tryout accept). Stored
--                                 ORDERED (child_a_id < child_b_id) so one row covers both directions and the unique index
--                                 cannot be dodged by swapping (mig 253's discipline for parents). Keyed by the two
--                                 children, deliberately WITHOUT an org_id: the tenancy is the children's, so a team move
--                                 (which moves org_children) carries the "no" with it and move_team_into_club is not
--                                 touched. Separate from rep_player_continuity_links' rejected tombstones (those are about
--                                 two ENTRIES, for the development board's suggestions). Service role only.
--   rep_roster_players_one_child_per_season
--                                 Owner ruling 2026-11-04 (S3 Part 0, "yes on the lock"): a child is on a season's roster
--                                 ONCE — every status, call-ups included (a call-up is always its own child, so it never
--                                 collides). Before S3 only the roll's picker enforced it; S3 adds two more writers (the
--                                 past-player picker, a "Same child? Yes") and every door's check-first can still race.
--                                 It also closes a door nobody listed: confirming a returning-player link whose two
--                                 children are BOTH on this season's roster used to merge them into one child on the
--                                 roster twice — that confirm is now refused (23505 on this index; the decide route says
--                                 the Ask 11 words). Dev had 0 such pairs on 2026-11-04 (any status).
--   org_children_join             re-created from 435 EXACTLY, plus the rejection carry-over: the absorbed child's "no"s
--                                 move to the kept child (a "no" between the two being joined is dropped — they are one
--                                 now), so a join never forgets an answer.
--
-- PROD PRE-CHECK (must return 0 rows, else the index fails and the whole file rolls back):
--   select child_id, program_year_id, count(*) from public.rep_roster_players group by 1, 2 having count(*) > 1;

begin;

set local lock_timeout = '15s';

-- ── 1. The stored "no" ───────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.child_match_rejections (
  id           uuid        primary key default gen_random_uuid(),
  child_a_id   uuid        not null references public.org_children(id) on delete cascade,
  child_b_id   uuid        not null references public.org_children(id) on delete cascade,
  -- Where the answer was given: the add door it came from (audit only; the rule reads the pair).
  door         text        not null check (door in ('single_add', 'paste_list', 'tryout_accept')),
  rejected_by  uuid        references auth.users(id) on delete set null,
  rejected_at  timestamptz not null default now(),
  constraint child_match_rejections_ordered check (child_a_id < child_b_id)
);
create unique index if not exists child_match_rejections_pair_uniq
  on public.child_match_rejections (child_a_id, child_b_id);
create index if not exists child_match_rejections_child_b_idx
  on public.child_match_rejections (child_b_id);

alter table public.child_match_rejections enable row level security;
revoke all on table public.child_match_rejections from anon, authenticated;
grant select, insert, update, delete on public.child_match_rejections to service_role;

-- ── 2. One child, once a season ──────────────────────────────────────────────────────────────────────────────────────
lock table public.rep_roster_players in share mode;
create unique index if not exists rep_roster_players_one_child_per_season
  on public.rep_roster_players (child_id, program_year_id);

-- ── 3. A join carries the "no"s ──────────────────────────────────────────────────────────────────────────────────────
create or replace function public.org_children_join(p_keep uuid, p_absorb uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_keep is null or p_absorb is null or p_keep = p_absorb then return; end if;
  perform 1 from public.org_children where id in (p_keep, p_absorb) order by id for update;
  if (select count(*) from public.org_children where id in (p_keep, p_absorb)) < 2 then return; end if;
  if (select org_id from public.org_children where id = p_keep)
     is distinct from (select org_id from public.org_children where id = p_absorb) then
    raise exception 'org_child_other_org: two children of different organizations cannot be joined' using errcode = '23514';
  end if;
  update public.rep_roster_players       set child_id = p_keep where child_id = p_absorb;
  update public.rep_tryout_registrations set child_id = p_keep where child_id = p_absorb;
  update public.league_registrations     set child_id = p_keep where child_id = p_absorb;
  -- (438) The absorbed child's answers move to the kept one; the absorbed rows go with the delete (cascade).
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
  delete from public.org_children where id = p_absorb;
  perform public.org_child_rename_from_entries(p_keep);
end;
$$;

revoke all on function public.org_children_join(uuid, uuid) from public, anon, authenticated;
grant execute on function public.org_children_join(uuid, uuid) to service_role;

commit;
