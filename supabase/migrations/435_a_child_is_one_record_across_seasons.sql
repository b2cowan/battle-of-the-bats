-- 435_a_child_is_one_record_across_seasons.sql
--
-- Club Tier Stage 14 S2 · the child record underneath (14b data). Owner rulings 2026-11-04, all 14 asks A (plan
-- docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md, Stage 14; build prompt
-- docs/projects/active/CLUB_TIER_STAGE14_BUILD_PROMPT.md, S2). Ask 4: ONE CHILD, NEVER INFERRED — every new entry starts
-- its own child, and two become one only by a FACT (the roll; an accepted tryout; later the S3 picker) or A PERSON'S YES (a
-- head coach's "Confirm — same player"; later "Same child?" and the Children queue). A name and birth date in common join
-- nothing. Ask 5: the record is the ORGANIZATION's; roster entries, tryout sign-ups and house-league sign-ups point at it.
--
-- WHAT THIS ADDS
--   org_children                    one row per child: the key, and that child's name and birth date (S2-1: each entry keeps
--                                   its own name/DOB as that season's copy; the medical note and emergency contact join the
--                                   child in S4, with the screens that read them). Service role only.
--   child_id on rep_roster_players, rep_tryout_registrations, league_registrations   NOT NULL after the backfill.
--   rep_child_components(team, child?)   THE one same-team rule: entries are one child when a CONFIRMED continuity link
--                                   or an accept (a roster row and the sign-up it came from) joins them. Call-ups never
--                                   join (a borrowed player; mig 309). Used by the backfill and by an undone link.
--   org_child_for_entry             BEFORE INSERT (and UPDATE OF child_id): an entry with no child gets one — an accepted
--                                   tryout takes its sign-up's — and an entry's child must be in the entry's organization.
--                                   ONE writer for "a new child" (S2-2), so every door is covered without editing each:
--                                   the house-league placement RPC, accept_tryout_and_create_dues, bulk add, the public
--                                   forms, the seeds. SECURITY DEFINER: two old anon INSERT policies still exist on the
--                                   sign-up tables (mig 020:213, 021:408). It takes no lock the RPCs did not already take
--                                   (one insert into org_children, whose FK reads organizations FOR KEY SHARE) and never
--                                   touches league_is_duplicate's refusal.
--   org_child_follows_entry         AFTER UPDATE OF the name/DOB columns: an edit on a LIVE entry (its rep season draft or
--                                   active; its house-league season not completed or archived) writes through to the child.
--                                   A past season's entry stays as recorded.
--   org_child_follows_link          AFTER INSERT OR UPDATE OF status on rep_player_continuity_links: a link becoming
--                                   CONFIRMED joins the two children (the prior side's record is kept); a confirmed link
--                                   undone ("Not the same player") splits the team's entries of that child again by the
--                                   remaining links. Before this migration the Families book did both at READ time
--                                   (lib/families-read.ts childKeys) — now the database keeps it, and the book reads child_id.
--   move_team_into_club             re-created from 351 EXACTLY, with org_children added to c_moves: a standalone coach's
--                                   team moving into its club takes its children with it (Ask 7).
--
-- THE BACKFILL (Ask 11: "roll-linked and coach-confirmed chains join at first run"; NEVER matcher guesses — the plan's
-- older "merges what the matcher is sure of" line is overruled by Ask 4): one child per same-team component of
-- rep_child_components (the Families book's childKeys union with its registration alias rule, run once; a tryout sign-up
-- confirmed as a returning player before it was accepted joins its prior entry too — a person said yes), one child per
-- remaining entry (call-ups, house-league sign-ups). Deletes nothing.
--
-- ⚠ A removed entry leaves its child behind (hidden: every read goes entry → child). S4-1 rules a child with no entries
-- is kept. A JOIN removes the absorbed record — in S2 it holds only a copy of a name and birth date; S4 must carry its
-- health facts across before that delete once it holds them.
--
-- A replaced function is invisible to the drift check: declared in MANUAL_PROD_STEPS.json.

begin;

-- The first ALTER below would take these locks one table at a time and hold them to the commit; taking all three up front
-- (in one statement, so no sign-up or accept can interleave a deadlock) with a bounded wait means a busy moment makes the
-- apply FAIL CLEANLY and re-runnable instead of hanging sign-ups. Apply in a quiet window.
set local lock_timeout = '15s';
lock table public.rep_roster_players, public.rep_tryout_registrations, public.league_registrations in access exclusive mode;

-- ── 1. The record ─────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.org_children (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        not null references public.organizations(id) on delete cascade,
  first_name    text        not null,
  last_name     text,
  date_of_birth date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists org_children_org_idx on public.org_children (org_id);

alter table public.org_children enable row level security;
revoke all on table public.org_children from anon, authenticated;
-- The server's own access (Supabase stopped auto-granting new tables 2026-10-30; tests/unit/migration-table-grants-guard.test.ts).
grant select, insert, update, delete on public.org_children to service_role;

alter table public.rep_roster_players       add column if not exists child_id uuid;
alter table public.rep_tryout_registrations add column if not exists child_id uuid;
alter table public.league_registrations     add column if not exists child_id uuid;

-- ── 2. The one same-team rule ─────────────────────────────────────────────────────────────────────────────────────────
-- Which of a team's entries are one child: the components of the graph whose nodes are the team's roster rows (never a
-- call-up) and tryout sign-ups — narrowed to those holding p_child when given — and whose edges are (a) a roster row and
-- the sign-up it was accepted from, (b) a CONFIRMED continuity link (either side may name a sign-up; mig 191's composite
-- FKs keep both sides on this team). root = the component's smallest entry id, as text.
create or replace function public.rep_child_components(p_team uuid, p_child uuid default null)
returns table (kind text, entry_id uuid, root text)
language sql
stable
set search_path = public
as $$
  with recursive nodes as (
    select 'roster'::text as kind, r.id
      from public.rep_roster_players r
     where r.team_id = p_team and r.status <> 'callup' and (p_child is null or r.child_id = p_child)
    union all
    select 'registration'::text, t.id
      from public.rep_tryout_registrations t
     where t.team_id = p_team and (p_child is null or t.child_id = p_child)
  ),
  edges as (
    select r.id as a, r.tryout_registration_id as b
      from public.rep_roster_players r
     where r.id in (select id from nodes) and r.tryout_registration_id in (select id from nodes)
    union all
    select coalesce(l.current_roster_id, l.current_registration_id), coalesce(l.prior_roster_id, l.prior_registration_id)
      from public.rep_player_continuity_links l
     where l.team_id = p_team and l.status = 'confirmed'
       and coalesce(l.current_roster_id, l.current_registration_id) in (select id from nodes)
       and coalesce(l.prior_roster_id, l.prior_registration_id) in (select id from nodes)
  ),
  both_ways as (
    select a, b from edges union select b, a from edges
  ),
  reach (src, dst) as (
    select id, id from nodes
    union
    select r.src, w.b from reach r join both_ways w on w.a = r.dst
  )
  select n.kind, n.id, min(r.dst::text)
    from nodes n join reach r on r.src = n.id
   group by n.kind, n.id;
$$;

-- The child's name and birth date: the entry on a group's NEWEST SEASON (the roster entry before a sign-up in the same
-- season), then the newest written, then the id — a total order, so rows written in one moment (a seed, an import) still
-- name the child the same way every time. ONE definition: the backfill below and org_children_split_team both call it.
create or replace function public.org_child_newest_entry(p_rosters uuid[], p_regs uuid[])
returns table (org_id uuid, first_name text, last_name text, date_of_birth date)
language sql
stable
set search_path = public
as $$
  select e.org_id, e.first_name, e.last_name, e.dob
    from (
      select p.org_id, p.player_first_name as first_name, p.player_last_name as last_name,
             p.player_date_of_birth as dob, y.year, 1 as pref, p.created_at as at, p.id
        from public.rep_roster_players p join public.rep_program_years y on y.id = p.program_year_id
       where p.id = any (p_rosters)
      union all
      select t.org_id, t.player_first_name, t.player_last_name, t.player_date_of_birth, y.year, 0, t.submitted_at, t.id
        from public.rep_tryout_registrations t join public.rep_program_years y on y.id = t.program_year_id
       where t.id = any (p_regs)
    ) e
   order by e.year desc, e.pref desc, e.at desc, e.id desc
   limit 1;
$$;

-- Re-name one child from the rep entries it holds (newest first, as above). A join, a split and a write-through all end
-- here, so a child's name never depends on HOW its entries came to share it. No rep entry (a house-league-only child) =
-- nothing to do.
create or replace function public.org_child_rename_from_entries(p_child uuid)
returns void
language sql
set search_path = public
as $$
  update public.org_children c
     set first_name = n.first_name, last_name = n.last_name, date_of_birth = n.date_of_birth, updated_at = now()
    from public.org_child_newest_entry(
           array(select id from public.rep_roster_players where child_id = p_child),
           array(select id from public.rep_tryout_registrations where child_id = p_child)) n
   where c.id = p_child
     and (c.first_name, c.last_name, c.date_of_birth) is distinct from (n.first_name, n.last_name, n.date_of_birth);
$$;

-- ── 3. The backfill (deletes nothing) ─────────────────────────────────────────────────────────────────────────────────
create temporary table s2_comp on commit drop as
  select t.org_id, c.kind, c.entry_id, c.root
    from public.rep_teams t
   cross join lateral public.rep_child_components(t.id, null) c;

create temporary table s2_root on commit drop as
  select d.root, gen_random_uuid() as child_id from (select distinct root from s2_comp) d;

-- Each component's child is named from its newest entry (org_child_newest_entry).
insert into public.org_children (id, org_id, first_name, last_name, date_of_birth)
select r.child_id, n.org_id, n.first_name, n.last_name, n.date_of_birth
  from (
    select root,
           array_agg(entry_id) filter (where kind = 'roster') as rosters,
           array_agg(entry_id) filter (where kind = 'registration') as regs
      from s2_comp group by root
  ) c
  join s2_root r on r.root = c.root
 cross join lateral public.org_child_newest_entry(c.rosters, c.regs) n;

update public.rep_roster_players p set child_id = r.child_id
  from s2_comp c join s2_root r on r.root = c.root
 where c.kind = 'roster' and p.id = c.entry_id and p.child_id is null;

update public.rep_tryout_registrations t set child_id = r.child_id
  from s2_comp c join s2_root r on r.root = c.root
 where c.kind = 'registration' and t.id = c.entry_id and t.child_id is null;

-- Everything the rule did not reach is its own child: call-ups, every house-league sign-up (one child per sign-up, as the
-- Families book read them), and any entry of a team no longer in rep_teams (none expected; the FK cascades).
with minted as (
  update public.rep_roster_players set child_id = gen_random_uuid() where child_id is null
  returning child_id, org_id, player_first_name, player_last_name, player_date_of_birth
)
insert into public.org_children (id, org_id, first_name, last_name, date_of_birth)
select child_id, org_id, player_first_name, player_last_name, player_date_of_birth from minted;

with minted as (
  update public.rep_tryout_registrations set child_id = gen_random_uuid() where child_id is null
  returning child_id, org_id, player_first_name, player_last_name, player_date_of_birth
)
insert into public.org_children (id, org_id, first_name, last_name, date_of_birth)
select child_id, org_id, player_first_name, player_last_name, player_date_of_birth from minted;

with minted as (
  update public.league_registrations set child_id = gen_random_uuid() where child_id is null
  returning child_id, org_id, player_first_name, player_last_name, player_date_of_birth
)
insert into public.org_children (id, org_id, first_name, last_name, date_of_birth)
select child_id, org_id, player_first_name, player_last_name, player_date_of_birth from minted;

-- ── 4. Every entry has a child, in its own organization ──────────────────────────────────────────────────────────────
-- DEFERRABLE INITIALLY DEFERRED (checked at COMMIT): an organization's delete cascades to the entries and to org_children
-- in separate nested statements, fired in trigger-NAME order (a string sort of OIDs, so not something to depend on); an
-- immediate check would refuse the delete whenever org_children happened to go first. Deferred, the check sees the end
-- state. It also lets a join delete the absorbed record in the same transaction that moves its entries.
alter table public.rep_roster_players
  alter column child_id set not null,
  add constraint rep_roster_players_child_id_fkey foreign key (child_id) references public.org_children(id)
    deferrable initially deferred;
alter table public.rep_tryout_registrations
  alter column child_id set not null,
  add constraint rep_tryout_registrations_child_id_fkey foreign key (child_id) references public.org_children(id)
    deferrable initially deferred;
alter table public.league_registrations
  alter column child_id set not null,
  add constraint league_registrations_child_id_fkey foreign key (child_id) references public.org_children(id)
    deferrable initially deferred;

create index if not exists rep_roster_players_child_idx       on public.rep_roster_players (child_id);
create index if not exists rep_tryout_registrations_child_idx on public.rep_tryout_registrations (child_id);
create index if not exists league_registrations_child_idx     on public.league_registrations (child_id);

-- ── 5. One writer for "a new child" ───────────────────────────────────────────────────────────────────────────────────
-- ⚠ Each NEW field is read inside its own table's branch: PL/pgSQL parses an expression when it first runs it, and
-- league_registrations has no tryout_registration_id.
create or replace function public.org_child_for_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Only a child someone SUPPLIED (or an UPDATE of child_id) needs its organization checked: one this trigger just minted
  -- for new.org_id, or took from the same organization's sign-up, cannot be another organization's.
  v_check boolean := tg_op = 'UPDATE' or new.child_id is not null;
begin
  if tg_op = 'INSERT' and new.child_id is null then
    -- An accepted tryout carries its sign-up's child (a FACT, and the returning-player link the head coach confirmed on
    -- that sign-up has already joined it to the prior season's child).
    if tg_table_name = 'rep_roster_players' then
      if new.tryout_registration_id is not null then
        select t.child_id into new.child_id
          from public.rep_tryout_registrations t
         where t.id = new.tryout_registration_id and t.org_id = new.org_id;
      end if;
    end if;
    if new.child_id is null then
      insert into public.org_children (org_id, first_name, last_name, date_of_birth)
      values (new.org_id, new.player_first_name, new.player_last_name, new.player_date_of_birth)
      returning id into new.child_id;
    end if;
  end if;

  if v_check and new.child_id is not null and not exists (
    select 1 from public.org_children c where c.id = new.child_id and c.org_id = new.org_id
  ) then
    raise exception 'org_child_other_org: an entry''s child must belong to the entry''s organization'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger rep_roster_players_child
  before insert or update of child_id on public.rep_roster_players
  for each row execute function public.org_child_for_entry();
create trigger rep_tryout_registrations_child
  before insert or update of child_id on public.rep_tryout_registrations
  for each row execute function public.org_child_for_entry();
create trigger league_registrations_child
  before insert or update of child_id on public.league_registrations
  for each row execute function public.org_child_for_entry();

-- ── 6. A live entry's name and birth date are the child's ─────────────────────────────────────────────────────────────
create or replace function public.org_child_follows_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_live boolean;
begin
  -- (The triggers' WHEN already skips an UPDATE that re-sent the same name and birth date.)
  if tg_table_name = 'league_registrations' then
    select s.status not in ('completed', 'archived') into v_live
      from public.league_seasons s where s.id = new.season_id;
  else
    select y.status in ('draft', 'active') into v_live
      from public.rep_program_years y where y.id = new.program_year_id;
  end if;
  if coalesce(v_live, false) then
    if tg_table_name = 'league_registrations' then
      -- A house-league sign-up is its own child in S2 (nothing newer to defer to).
      update public.org_children
         set first_name = new.player_first_name, last_name = new.player_last_name,
             date_of_birth = new.player_date_of_birth, updated_at = now()
       where id = new.child_id
         and (first_name, last_name, date_of_birth)
             is distinct from (new.player_first_name, new.player_last_name, new.player_date_of_birth);
    else
      -- A rep child is named from its NEWEST season's entry, so a fix to an older entry that is still live (the roll opens
      -- the new season before it closes the old one) never puts the older spelling back over the newer one.
      perform public.org_child_rename_from_entries(new.child_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger rep_roster_players_child_follows
  after update of player_first_name, player_last_name, player_date_of_birth on public.rep_roster_players
  for each row
  when (new.player_first_name is distinct from old.player_first_name
     or new.player_last_name is distinct from old.player_last_name
     or new.player_date_of_birth is distinct from old.player_date_of_birth)
  execute function public.org_child_follows_entry();
create trigger rep_tryout_registrations_child_follows
  after update of player_first_name, player_last_name, player_date_of_birth on public.rep_tryout_registrations
  for each row
  when (new.player_first_name is distinct from old.player_first_name
     or new.player_last_name is distinct from old.player_last_name
     or new.player_date_of_birth is distinct from old.player_date_of_birth)
  execute function public.org_child_follows_entry();
create trigger league_registrations_child_follows
  after update of player_first_name, player_last_name, player_date_of_birth on public.league_registrations
  for each row
  when (new.player_first_name is distinct from old.player_first_name
     or new.player_last_name is distinct from old.player_last_name
     or new.player_date_of_birth is distinct from old.player_date_of_birth)
  execute function public.org_child_follows_entry();

-- ── 7. Joining and splitting ──────────────────────────────────────────────────────────────────────────────────────────
-- Join: every entry of p_absorb becomes p_keep's, and the emptied record goes (S2: it held only a copy of a name; S4 must
-- carry its health facts across BEFORE this delete once it holds any). The kept record is then re-named from its newest
-- entry, so a joined child reads the same as a backfilled or split one.
-- ⚠ Both records are locked FIRST, in id order: a join and a split (or two joins) racing over the same children would
-- otherwise act on ids the other had already moved — a wrong merge. Under READ COMMITTED the statements after the lock see
-- what the winner committed; a record already gone means the work is already done.
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
  delete from public.org_children where id = p_absorb;
  perform public.org_child_rename_from_entries(p_keep);
end;
$$;

-- Split: an undone link separates ITS two sides and nothing else. Of the team's entries of p_child, grouped by the rule,
-- ONLY the group holding p_split_entry (the link's current side) moves — to a new child named from its newest entry —
-- unless it is still joined to p_keep_entry (the prior side) by another confirmed link or an accept; every other entry
-- stays on the kept record, which is re-named from what it still holds. Entries of p_child elsewhere (a call-up, another
-- team, the house league — S6 joins) stay with it.
-- ⚠ Why not regroup everything by the rule (what this did first): two entries can share a child by a FACT that has no link
-- row — the roll sets the child itself and mints its link best-effort — and an unrelated undo then tore them apart.
-- Locks the record first (see org_children_join).
create or replace function public.org_children_split_team(p_team uuid, p_child uuid, p_keep_entry uuid, p_split_entry uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new uuid;
  g record;
begin
  perform 1 from public.org_children where id = p_child for update;
  if not found then return; end if;
  -- The rule is evaluated ONCE (the loop below changes child_id mid-way, so it must not be re-read).
  for g in
    with comp as materialized (select * from public.rep_child_components(p_team, p_child)),
         sides as (select (select k.root from comp k where k.entry_id = p_keep_entry)  as keep_root,
                          (select k.root from comp k where k.entry_id = p_split_entry) as split_root)
    select c.root,
           array_agg(c.entry_id) filter (where c.kind = 'roster') as rosters,
           array_agg(c.entry_id) filter (where c.kind = 'registration') as regs
      from comp c
     group by c.root
    having c.root = (select split_root from sides) and c.root is distinct from (select keep_root from sides)
  loop
    v_new := gen_random_uuid();
    insert into public.org_children (id, org_id, first_name, last_name, date_of_birth)
    select v_new, n.org_id, n.first_name, n.last_name, n.date_of_birth
      from public.org_child_newest_entry(g.rosters, g.regs) n;
    update public.rep_roster_players       set child_id = v_new where id = any (g.rosters);
    update public.rep_tryout_registrations set child_id = v_new where id = any (g.regs);
    perform public.org_child_rename_from_entries(p_child);
  end loop;
end;
$$;

-- A link's decision keeps the children in step. A side that is a call-up is not a node (mirrors the rule).
create or replace function public.org_child_follows_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current uuid;
  v_prior uuid;
begin
  select x.child_id into v_current from (
    select r.child_id from public.rep_roster_players r where r.id = new.current_roster_id and r.status <> 'callup'
    union all
    select t.child_id from public.rep_tryout_registrations t where t.id = new.current_registration_id
  ) x limit 1;
  select x.child_id into v_prior from (
    select r.child_id from public.rep_roster_players r where r.id = new.prior_roster_id and r.status <> 'callup'
    union all
    select t.child_id from public.rep_tryout_registrations t where t.id = new.prior_registration_id
  ) x limit 1;

  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    -- The prior season's record is kept: it is the older one, and the roll and the picker set the new entry to it.
    if v_current is not null and v_prior is not null and v_current <> v_prior then
      perform public.org_children_join(v_prior, v_current);
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'confirmed' and new.status <> 'confirmed' then
    if v_current is not null and v_current = v_prior then
      perform public.org_children_split_team(new.team_id, v_current,
        coalesce(new.prior_roster_id, new.prior_registration_id), coalesce(new.current_roster_id, new.current_registration_id));
    end if;
  end if;
  return null;
end;
$$;

-- Two triggers because an UPDATE's WHEN may read OLD and an INSERT's may not; each fires only when a decision that matters
-- happened (a link becoming confirmed, or leaving confirmed) — a suggested or rejected link costs nothing here.
-- ⚠ The ENTRY's child_id is the fact; the link records who the person said was the same child. The roll sets the new
-- entry's child itself, so the join above is then a no-op, and the link's other readers (Skills & goals history) are unaffected.
create trigger rep_player_continuity_links_child_confirmed
  after insert on public.rep_player_continuity_links
  for each row when (new.status = 'confirmed')
  execute function public.org_child_follows_link();
create trigger rep_player_continuity_links_child_changed
  after update of status on public.rep_player_continuity_links
  for each row when (old.status is distinct from new.status and (new.status = 'confirmed' or old.status = 'confirmed'))
  execute function public.org_child_follows_link();

revoke all on function public.rep_child_components(uuid, uuid) from public, anon, authenticated;
revoke all on function public.org_children_join(uuid, uuid) from public, anon, authenticated;
revoke all on function public.org_children_split_team(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.org_child_rename_from_entries(uuid) from public, anon, authenticated;
revoke all on function public.org_child_newest_entry(uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.org_child_for_entry() from public, anon, authenticated;
revoke all on function public.org_child_follows_entry() from public, anon, authenticated;
revoke all on function public.org_child_follows_link() from public, anon, authenticated;
grant execute on function public.rep_child_components(uuid, uuid) to service_role;
grant execute on function public.org_children_join(uuid, uuid) to service_role;
grant execute on function public.org_children_split_team(uuid, uuid, uuid, uuid) to service_role;

comment on table public.org_children is
  'One row per child of an organization (Club Tier Stage 14 S2, mig 435): roster entries, tryout sign-ups and house-league '
  'sign-ups point at it through child_id. A child is never inferred: two entries share one only by a fact (the roll, an '
  'accepted tryout) or a person''s yes (a confirmed returning-player link). Service role only.';

-- ── 8. The team move takes the children with it (Ask 7) ───────────────────────────────────────────────────────────────
-- 313's two statements, repeated verbatim as 351 did, so the NEWEST definition of the move stands on its own (the coverage
-- test reads only the newest). Both are idempotent.

drop function if exists public.complete_team_workspace_ownership_transfer(uuid, uuid, text, text);

create unique index if not exists team_org_links_one_open_request
  on public.team_org_links (team_workspace_id)
  where status = 'ownership_pending';

create or replace function public.move_team_into_club(
  p_link_id uuid,
  p_approving_side text,
  p_actor_user_id uuid,
  p_actor_email text,
  p_team_cap integer
) returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  -- Every row the coach's org holds in these tables is the team's, and all of it moves.
  c_moves constant text[] := array[
    'assistant_invite_tokens',
    'budget_categories',
    'budget_items',
    'family_links',
    'family_recap_views',
    'org_children',
    'org_payees',
    'rep_allocation_installments',
    'rep_allocation_splits',
    'rep_budget_lines',
    'rep_cost_allocations',
    'rep_development_goal_reviews',
    'rep_document_templates',
    'rep_dues_payments',
    'rep_dues_payout_credits',
    'rep_dues_payouts',
    'rep_evaluation_not_assessed',
    'rep_fundraiser_credit_plan',
    'rep_fundraiser_entries',
    'rep_fundraisers',
    'rep_payable_installments',
    'rep_payable_payments',
    'rep_player_awards',
    'rep_player_continuity_links',
    'rep_player_development_goals',
    'rep_player_documents',
    'rep_player_dues_installments',
    'rep_player_dues_schedules',
    'rep_player_measurables',
    'rep_player_notes',
    'rep_player_observations',
    'rep_player_tryout_baselines',
    'rep_program_years',
    'rep_roster_players',
    'rep_season_refund_adjustments',
    'rep_sponsor_invoices',
    'rep_team_announcements',
    'rep_team_award_types',
    'rep_team_call_up_appearances',
    'rep_team_circuits',
    'rep_team_coaches',
    'rep_team_drills',
    'rep_team_evaluation_sessions',
    'rep_team_event_attendance',
    'rep_team_events',
    'rep_team_expenses',
    'rep_team_game_moments',
    'rep_team_import_events',
    'rep_team_lineup_templates',
    'rep_team_lineups',
    'rep_team_measurable_types',
    'rep_team_money_in',
    'rep_team_opponent_aliases',
    'rep_team_opponent_observations',
    'rep_team_opponents',
    'rep_team_payment_requests',
    'rep_team_places',
    'rep_team_plan_templates',
    'rep_team_staff_memberships',
    'rep_team_tags',
    'rep_team_tryout_contacts',
    'rep_teams',
    'rep_tryout_evaluator_sessions',
    'rep_tryout_registrations',
    'rep_tryout_rubrics',
    'rep_tryout_scores',
    'rep_tryout_sessions',
    'rep_tryouts'
  ];
  -- Only the team's part of these moves (each has its own statement below, with its reason).
  c_moves_some constant text[] := array[
    'accounting_ledgers',
    'chat_message_reports',
    'chat_rooms',
    'family_consents',
    'family_email_optouts'
  ];
  -- Library tables where team_id NULL means "the org's own": in a coach's org that is the team's.
  c_team_library constant text[] := array[
    'budget_categories', 'budget_items', 'org_payees', 'rep_document_templates',
    'rep_team_award_types', 'rep_team_drills', 'rep_team_tags'
  ];
  v_link public.team_org_links%rowtype;
  v_workspace public.team_workspaces%rowtype;
  v_team public.rep_teams%rowtype;
  v_ws public.organizations%rowtype;
  v_club public.organizations%rowtype;
  v_now timestamptz := now();
  v_table text;
  v_rows bigint;
  v_moved jsonb := '{}'::jsonb;
  v_active_teams integer;
  v_slug text;
  v_suffix integer := 1;
  v_staff_seats integer := 0;
begin
  if p_approving_side is null or p_approving_side not in ('club', 'coach') then
    raise exception 'team_move_bad_side';
  end if;

  select * into v_link from public.team_org_links where id = p_link_id for update;
  if not found then
    raise exception 'team_move_not_found';
  end if;

  -- A second click, a second tab, or both sides at once: the move already landed — say so, don't fail.
  if v_link.status = 'org_owned' then
    return jsonb_build_object(
      'ok', true, 'alreadyMoved', true, 'linkId', v_link.id,
      'repTeamId', v_link.rep_team_id, 'linkedOrgId', v_link.linked_org_id
    );
  end if;

  -- Waiting on exactly THIS side: the other side has said yes, this one has not.
  if v_link.status <> 'ownership_pending' or v_link.link_type <> 'ownership' then
    raise exception 'team_move_not_waiting';
  end if;
  if p_approving_side = 'club'
     and (v_link.approved_by_team_user_id is null or v_link.approved_by_org_user_id is not null) then
    raise exception 'team_move_not_waiting';
  end if;
  if p_approving_side = 'coach'
     and (v_link.approved_by_org_user_id is null or v_link.approved_by_team_user_id is not null) then
    raise exception 'team_move_not_waiting';
  end if;

  select * into v_workspace from public.team_workspaces where id = v_link.team_workspace_id for update;
  if not found then
    raise exception 'team_move_workspace_not_found';
  end if;
  if v_workspace.workspace_state = 'archived' then
    raise exception 'team_move_workspace_archived';
  end if;
  if v_workspace.workspace_state = 'org_owned' then
    raise exception 'team_move_already_moved';
  end if;
  if v_workspace.rep_team_id <> v_link.rep_team_id then
    raise exception 'team_move_workspace_team_mismatch';
  end if;

  select * into v_team from public.rep_teams where id = v_link.rep_team_id for update;
  if not found then
    raise exception 'team_move_team_not_found';
  end if;

  -- Lock order: the coach's org, then the club. A coach's org is never a club, so two moves into the
  -- same club share only the club's lock and cannot deadlock.
  select * into v_ws from public.organizations where id = v_workspace.workspace_org_id for update;
  select * into v_club from public.organizations where id = v_link.linked_org_id for update;
  if v_club.id is null then
    raise exception 'team_move_club_not_found';
  end if;
  if v_club.account_kind = 'team_workspace' or v_club.plan_id = 'team' then
    raise exception 'team_move_target_not_a_club';
  end if;
  if v_team.org_id <> v_ws.id then
    raise exception 'team_move_team_not_in_workspace';
  end if;

  -- The rule "every row the coach's org holds is the team's" is true only for a one-team org.
  if (select count(*) from public.rep_teams where org_id = v_ws.id) <> 1 then
    raise exception 'team_move_workspace_holds_other_teams';
  end if;

  -- The coach's own tournament does not move; an open one keeps the coach's org alive until it ends.
  if exists (select 1 from public.tournaments where org_id = v_ws.id and status in ('draft', 'active')) then
    raise exception 'team_move_open_tournament';
  end if;

  -- The team place, counted under the club's lock.
  if p_team_cap is not null and not v_team.is_archived then
    select count(*) into v_active_teams
      from public.rep_teams where org_id = v_club.id and is_archived = false;
    if v_active_teams >= p_team_cap then
      raise exception 'team_move_team_limit';
    end if;
  end if;

  if exists (
    select 1 from public.accounting_ledgers
     where org_id = v_club.id and entity_type = 'team' and entity_id = v_team.id
  ) then
    raise exception 'team_move_team_ledger_conflict';
  end if;

  -- The address: kept when it is free in the club, else the first free "-2", "-3", …
  v_slug := v_team.slug;
  while v_slug is not null and exists (
    select 1 from public.rep_teams where org_id = v_club.id and slug = v_slug and id <> v_team.id
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_team.slug || '-' || v_suffix;
  end loop;

  -- This side's yes — recorded in the same transaction as the move, never on its own.
  if p_approving_side = 'club' then
    update public.team_org_links set approved_by_org_user_id = p_actor_user_id where id = v_link.id;
  else
    update public.team_org_links set approved_by_team_user_id = p_actor_user_id where id = v_link.id;
  end if;

  -- ── The staff come with the team ─────────────────────────────────────────────────────────────
  insert into public.organization_members (organization_id, user_id, role, accepted_at, status)
  select distinct v_club.id, m.user_id, 'coach', v_now, 'active'
    from public.rep_team_staff_memberships m
   where m.team_id = v_team.id and m.status = 'active'
  on conflict (organization_id, user_id) do update
     set accepted_at = case
           when public.organization_members.role = 'coach'
             then coalesce(public.organization_members.accepted_at, v_now)
           else public.organization_members.accepted_at
         end,
         status = case
           when public.organization_members.role = 'coach' and public.organization_members.status <> 'suspended'
             then 'active'
           else public.organization_members.status
         end;
  get diagnostics v_staff_seats = row_count;

  -- ── Re-point what would otherwise point into the coach's org ─────────────────────────────────
  update public.rep_roster_players set person_id = null where org_id = v_ws.id and person_id is not null;
  update public.rep_tryout_registrations set person_id = null where org_id = v_ws.id and person_id is not null;
  update public.family_links set person_id = null where org_id = v_ws.id and person_id is not null;

  update public.rep_team_payment_requests set budget_line_id = null
   where org_id = v_ws.id
     and budget_line_id in (select id from public.org_budget_lines where org_id = v_ws.id);
  update public.rep_cost_allocations set source_budget_line_id = null
   where org_id = v_ws.id
     and source_budget_line_id in (select id from public.org_budget_lines where org_id = v_ws.id);

  foreach v_table in array c_team_library loop
    -- A shared row and a team row with the same name would become two team rows with one name (each
    -- table's team-scoped unique name rule). Refuse in words, naming the table, rather than let the
    -- raw unique violation read as "the move failed" with no way forward (/review 2026-09-29).
    begin
      execute format('update public.%I set team_id = $1 where org_id = $2 and team_id is null', v_table)
        using v_team.id, v_ws.id;
    exception when unique_violation then
      raise exception 'team_move_library_name_clash: %', v_table;
    end;
  end loop;

  update public.rep_teams set group_id = null, slug = v_slug, updated_at = v_now where id = v_team.id;

  -- ── The move: every row of the team tables ───────────────────────────────────────────────────
  foreach v_table in array c_moves loop
    execute format('update public.%I set org_id = $1 where org_id = $2', v_table)
      using v_club.id, v_ws.id;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      v_moved := v_moved || jsonb_build_object(v_table, v_rows);
    end if;
  end loop;

  -- ── The team's part of the shared tables ─────────────────────────────────────────────────────
  -- The team's own ledger. The coach org's general ledger stays (a Coaches Portal never writes it).
  update public.accounting_ledgers set org_id = v_club.id
   where org_id = v_ws.id and entity_type = 'team' and entity_id = v_team.id;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_moved := v_moved || jsonb_build_object('accounting_ledgers', v_rows); end if;

  -- The team's staff room, re-keyed to the club (the club portal finds it by the team's org).
  update public.chat_rooms
     set org_id = v_club.id,
         ref_id = case when ref_id = v_ws.id then v_club.id else ref_id end
   where org_id = v_ws.id and ref_sub_id = v_team.id;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_moved := v_moved || jsonb_build_object('chat_rooms', v_rows); end if;

  update public.chat_message_reports set org_id = v_club.id
   where org_id = v_ws.id
     and room_id in (select id from public.chat_rooms where org_id = v_club.id and ref_sub_id = v_team.id);
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_moved := v_moved || jsonb_build_object('chat_message_reports', v_rows); end if;

  -- A family's "don't email me" goes with the family. Where the club already holds the same one, the
  -- club's covers it and the coach org's copy stays as its record.
  update public.family_email_optouts o set org_id = v_club.id
   where o.org_id = v_ws.id
     and not exists (
       select 1 from public.family_email_optouts c where c.org_id = v_club.id and c.email = o.email
     );
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_moved := v_moved || jsonb_build_object('family_email_optouts', v_rows); end if;

  update public.family_consents f set org_id = v_club.id
   where f.org_id = v_ws.id
     and (
       f.withdrawn_at is not null
       or not exists (
         select 1 from public.family_consents c
          where c.org_id = v_club.id
            and c.withdrawn_at is null
            and c.guardian_email = f.guardian_email
            and c.basis = f.basis
            and c.scope = f.scope
            and coalesce(c.source_id, '00000000-0000-0000-0000-000000000000'::uuid)
              = coalesce(f.source_id, '00000000-0000-0000-0000-000000000000'::uuid)
       )
     );
  get diagnostics v_rows = row_count;
  if v_rows > 0 then v_moved := v_moved || jsonb_build_object('family_consents', v_rows); end if;

  -- The team's guardians become people IN THE CLUB (matched by address to anyone the club knows).
  perform public.families_attach_people(v_club.id);

  -- ── The coach's own portal closes (as 067) ───────────────────────────────────────────────────
  update public.team_entitlements
     set status = 'cancelled', ends_at = coalesce(ends_at, v_now), updated_at = v_now
   where (team_workspace_id = v_workspace.id or rep_team_id = v_team.id)
     and status in ('active', 'trialing', 'past_due');

  update public.team_org_links set status = 'revoked', updated_at = v_now
   where team_workspace_id = v_workspace.id
     and id <> v_link.id
     and status in ('requested', 'invited', 'linked', 'ownership_pending');

  update public.team_org_links
     set status = 'org_owned', link_type = 'ownership', sharing_level = 'full_org_owned',
         billing_mode_after_approval = 'club_included', updated_at = v_now
   where id = v_link.id;

  -- ⚠ The Stripe ids are cleared HERE, before the app cancels the subscription, so the webhook the
  -- cancel triggers finds no workspace and sends no "cancelled" email (see the header).
  update public.team_workspaces
     set workspace_state = 'org_owned', billing_mode = 'club_included',
         billing_owner_org_id = v_club.id, billing_owner_user_id = null,
         stripe_customer_id = null, stripe_subscription_id = null,
         subscription_status = 'active', current_period_end = null, updated_at = v_now
   where id = v_workspace.id;

  update public.organizations
     set team_workspace_status = 'org_owned', subscription_status = 'canceled',
         stripe_customer_id = null, stripe_subscription_id = null,
         subscription_period = null, current_period_end = null
   where id = v_ws.id;

  update public.organization_members set status = 'suspended'
   where organization_id = v_ws.id and status <> 'suspended';

  insert into public.org_audit_log (org_id, actor_id, target_id, action, payload)
  values
    (v_club.id, p_actor_user_id, v_link.id, 'team_moved_into_club',
     jsonb_build_object(
       'approvingSide', p_approving_side, 'actorEmail', p_actor_email,
       'teamWorkspaceId', v_workspace.id, 'workspaceOrgId', v_ws.id, 'repTeamId', v_team.id,
       'teamName', v_team.name, 'slug', v_slug, 'previousSlug', v_team.slug,
       'staffSeats', v_staff_seats, 'moved', v_moved
     )),
    -- ⚠ The coach's subscription id is written HERE, durably, in the move's own transaction: the
    -- move clears it from the workspace and the org, and the app cancels it only after commit. If
    -- the process dies in between, this row is the one place that still names what to cancel.
    (v_ws.id, p_actor_user_id, v_link.id, 'team_moved_into_club',
     jsonb_build_object(
       'approvingSide', p_approving_side, 'actorEmail', p_actor_email,
       'linkedOrgId', v_club.id, 'teamWorkspaceId', v_workspace.id, 'repTeamId', v_team.id,
       'teamName', v_team.name,
       'previousStripeSubscriptionId', coalesce(v_workspace.stripe_subscription_id, v_ws.stripe_subscription_id)
     ));

  return jsonb_build_object(
    'ok', true,
    'alreadyMoved', false,
    'linkId', v_link.id,
    'teamWorkspaceId', v_workspace.id,
    'workspaceOrgId', v_ws.id,
    'linkedOrgId', v_club.id,
    'clubSlug', v_club.slug,
    'repTeamId', v_team.id,
    'teamName', v_team.name,
    'teamSlug', v_slug,
    'slugChanged', v_slug is distinct from v_team.slug,
    'previousBillingMode', v_workspace.billing_mode,
    'previousStripeSubscriptionId', coalesce(v_workspace.stripe_subscription_id, v_ws.stripe_subscription_id),
    'staffSeats', v_staff_seats,
    'moved', v_moved
  );
end;
$$;

comment on function public.move_team_into_club(uuid, text, uuid, text, integer) is
  'Moves a coach''s own (standalone) team into a club, whole, when the second side says yes (mig 313, '
  'replaces 067; mig 340 adds rep_sponsor_invoices, mig 351 rep_team_tryout_contacts, mig 435 org_children). Records that yes and the move in one transaction. Every table '
  'carrying org_id is moved (c_moves / c_moves_some) or stays for a reason held by tests/unit/team-move-coverage.test.ts. '
  'Idempotent (alreadyMoved). Stripe is cancelled by the app after commit. Service role only.';

revoke all on function public.move_team_into_club(uuid, text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.move_team_into_club(uuid, text, uuid, text, integer) to service_role;

commit;
