-- 441_papers_and_health_follow_the_child.sql
--
-- Club Tier Stage 14 S4 · documents and the health check (14c). Owner rulings 2026-11-04: Ask 10 A (plan
-- docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md, Stage 14; build prompt
-- docs/projects/active/CLUB_TIER_STAGE14_BUILD_PROMPT.md, S4) and the S4 Part 0 calls ("go ahead", 2026-11-04). Needs 435.
--
-- WHAT THIS ADDS
--   rep_document_templates.validity     'signed_each_season' | 'good_until_replaced' — the club decides, per document, whether
--                                       a signed copy answers only the season it was signed for or stays on file until a
--                                       newer one replaces it. Backfilled by type (waiver + code of conduct = each season;
--                                       medical consent + other = until replaced); a new row with no value takes its type's
--                                       default (a BEFORE INSERT trigger, so the seeds and any older writer stay valid).
--   org_children.medical_notes, .emergency_contact_name, .emergency_contact_phone
--                                       the child's ONE current value (Ask 10: "medical note and emergency contact live on
--                                       the child and carry"). Each season's roster entry keeps its own columns as THAT
--                                       season's copy (history); the triggers below keep every LIVE entry and the child the
--                                       same, so no roster reader had to change.
--   rep_roster_players.health_confirmed_at / _by
--                                       the once-a-season "Still right for the {season}?" — set when someone confirms the
--                                       values, or saves them, on that season's entry. Per ENTRY because an entry IS a
--                                       season; the roll and the picker never copy it.
--
-- WHAT DOES NOT CHANGE (S4 Part 0, recommendation 1): documents stay on the season's entry they were signed on. An entry
-- belongs to one child, so "the child's documents" are the documents on that child's entries, and "signed for which
-- season" is that entry's season — nothing to backfill, nothing to keep in step on a join or a split (the papers follow
-- their entries), and no retention change: removing a roster entry that holds a document is already refused
-- (ROSTER_PLAYER_DEPENDENTS in lib/db.ts).
--
-- THE HEALTH RULE
--   · A LIVE entry (its rep season draft or active, as mig 435's name write-through) that is written — insert or edit of
--     the three columns — writes the child. The child, written, writes every LIVE entry of that child. Closed seasons'
--     entries stay as recorded. Both directions compare first, so the loop stops after one hop.
--   · A LIVE entry inserted for a child that already holds a value takes the child's value in any column the writer left
--     blank (the roll and the picker copy from the old entry; this covers an entry whose old copy was blank).
--   · The backfill, a split, and the record a join keeps take each column from the child's NEWEST entry that has a value
--     (newest season, then the newest write) — a blank newer entry never wipes an allergy recorded on an older one. A join
--     keeps the newer child's value per column and the other's when that one is blank (Ask 11: "the newest season's values
--     are kept; older ones stay as history" — the history is the entries' own copies, which a join never touches).
--   · House-league sign-ups carry no medical columns (their consent is family_consents, a separate thing) — rep only.
--
-- A replaced function is invisible to the drift check: declared in MANUAL_PROD_STEPS.json.

begin;

set local lock_timeout = '15s';

-- ── 1. Which documents a season asks for again ─────────────────────────────────────────────────────────────────────────
alter table public.rep_document_templates add column if not exists validity text;
update public.rep_document_templates
   set validity = case when document_type in ('waiver', 'code_of_conduct') then 'signed_each_season'
                       else 'good_until_replaced' end
 where validity is null;
alter table public.rep_document_templates alter column validity set not null;
alter table public.rep_document_templates drop constraint if exists rep_document_templates_validity_check;
alter table public.rep_document_templates
  add constraint rep_document_templates_validity_check
  check (validity in ('signed_each_season', 'good_until_replaced'));

create or replace function public.rep_document_template_default_validity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.validity is null then
    new.validity := case when new.document_type in ('waiver', 'code_of_conduct') then 'signed_each_season'
                         else 'good_until_replaced' end;
  end if;
  return new;
end;
$$;

drop trigger if exists rep_document_templates_default_validity on public.rep_document_templates;
create trigger rep_document_templates_default_validity
  before insert on public.rep_document_templates
  for each row execute function public.rep_document_template_default_validity();

-- ── 2. The child's health, and the season's check ──────────────────────────────────────────────────────────────────────
alter table public.org_children add column if not exists medical_notes text;
alter table public.org_children add column if not exists emergency_contact_name text;
alter table public.org_children add column if not exists emergency_contact_phone text;

alter table public.rep_roster_players add column if not exists health_confirmed_at timestamptz;
alter table public.rep_roster_players
  add column if not exists health_confirmed_by uuid references auth.users(id) on delete set null;

-- Per column, the newest entry of this child that has a value (newest season, then the newest write, then the id — the
-- same order as org_child_newest_entry). A blank is NULL or whitespace.
create or replace function public.org_child_health_from_entries(p_child uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.org_children c
     set medical_notes = h.m, emergency_contact_name = h.en, emergency_contact_phone = h.ep, updated_at = now()
    from (
      select (array_agg(r.medical_notes order by y.year desc, r.created_at desc, r.id desc)
                filter (where nullif(btrim(r.medical_notes), '') is not null))[1] as m,
             (array_agg(r.emergency_contact_name order by y.year desc, r.created_at desc, r.id desc)
                filter (where nullif(btrim(r.emergency_contact_name), '') is not null))[1] as en,
             (array_agg(r.emergency_contact_phone order by y.year desc, r.created_at desc, r.id desc)
                filter (where nullif(btrim(r.emergency_contact_phone), '') is not null))[1] as ep
        from public.rep_roster_players r
        join public.rep_program_years y on y.id = r.program_year_id
       where r.child_id = p_child
    ) h
   where c.id = p_child
     and (c.medical_notes, c.emergency_contact_name, c.emergency_contact_phone) is distinct from (h.m, h.en, h.ep);
end;
$$;

-- A live entry inserted for a child that already holds a value: the CHILD'S value wins, column by column, even over a
-- value the entry carries (the picker and the roll copy from a team's own latest entry, which can be older than what
-- another team's coach has since confirmed on the child — /review F1). Only a column the child has nothing in lets the
-- entry's own value through (the after-insert step then writes it to the child). Fires after rep_roster_players_child
-- (trigger names fire in order), so a child the entry was just given is already set.
create or replace function public.org_child_health_fills_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  if new.child_id is null then return new; end if;
  if not coalesce((select y.status in ('draft', 'active') from public.rep_program_years y
                    where y.id = new.program_year_id), false) then
    return new;
  end if;
  select ch.medical_notes, ch.emergency_contact_name, ch.emergency_contact_phone into c
    from public.org_children ch where ch.id = new.child_id;
  if not found then return new; end if;
  if c.medical_notes is not null then new.medical_notes := c.medical_notes; end if;
  if c.emergency_contact_name is not null then new.emergency_contact_name := c.emergency_contact_name; end if;
  if c.emergency_contact_phone is not null then new.emergency_contact_phone := c.emergency_contact_phone; end if;
  return new;
end;
$$;

drop trigger if exists rep_roster_players_child_health on public.rep_roster_players;
create trigger rep_roster_players_child_health
  before insert on public.rep_roster_players
  for each row execute function public.org_child_health_fills_entry();

-- A live entry written → the child. On an UPDATE only the columns that CHANGED travel (an entry a Reopen made live again
-- can hold older values in its other columns — /review F3); an insert carries all three.
create or replace function public.org_child_health_follows_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  v_m  text;
  v_en text;
  v_ep text;
begin
  if new.child_id is null then return null; end if;
  if not coalesce((select y.status in ('draft', 'active') from public.rep_program_years y
                    where y.id = new.program_year_id), false) then
    return null;
  end if;
  select ch.medical_notes, ch.emergency_contact_name, ch.emergency_contact_phone into c
    from public.org_children ch where ch.id = new.child_id;
  if not found then return null; end if;
  v_m := c.medical_notes; v_en := c.emergency_contact_name; v_ep := c.emergency_contact_phone;
  -- A blank is stored on the child as NULL, so "nothing on file" has one spelling there.
  if tg_op = 'INSERT' then
    v_m := nullif(btrim(new.medical_notes), '');
    v_en := nullif(btrim(new.emergency_contact_name), '');
    v_ep := nullif(btrim(new.emergency_contact_phone), '');
  else
    if new.medical_notes is distinct from old.medical_notes then v_m := nullif(btrim(new.medical_notes), ''); end if;
    if new.emergency_contact_name is distinct from old.emergency_contact_name then v_en := nullif(btrim(new.emergency_contact_name), ''); end if;
    if new.emergency_contact_phone is distinct from old.emergency_contact_phone then v_ep := nullif(btrim(new.emergency_contact_phone), ''); end if;
  end if;
  update public.org_children
     set medical_notes = v_m, emergency_contact_name = v_en, emergency_contact_phone = v_ep, updated_at = now()
   where id = new.child_id
     and (medical_notes, emergency_contact_name, emergency_contact_phone) is distinct from (v_m, v_en, v_ep);
  return null;
end;
$$;

drop trigger if exists rep_roster_players_child_health_follows on public.rep_roster_players;
create trigger rep_roster_players_child_health_follows
  after update of medical_notes, emergency_contact_name, emergency_contact_phone on public.rep_roster_players
  for each row
  when (new.medical_notes is distinct from old.medical_notes
     or new.emergency_contact_name is distinct from old.emergency_contact_name
     or new.emergency_contact_phone is distinct from old.emergency_contact_phone)
  execute function public.org_child_health_follows_entry();

drop trigger if exists rep_roster_players_child_health_inserted on public.rep_roster_players;
create trigger rep_roster_players_child_health_inserted
  after insert on public.rep_roster_players
  for each row execute function public.org_child_health_follows_entry();

-- The child written → every live entry of that child.
create or replace function public.org_child_health_reaches_entries()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rep_roster_players r
     set medical_notes = new.medical_notes,
         emergency_contact_name = new.emergency_contact_name,
         emergency_contact_phone = new.emergency_contact_phone
    from public.rep_program_years y
   where r.child_id = new.id
     and y.id = r.program_year_id
     and y.status in ('draft', 'active')
     and (nullif(btrim(r.medical_notes), ''), nullif(btrim(r.emergency_contact_name), ''),
          nullif(btrim(r.emergency_contact_phone), ''))
         is distinct from (new.medical_notes, new.emergency_contact_name, new.emergency_contact_phone);
  return null;
end;
$$;

drop trigger if exists org_children_health_reaches_entries on public.org_children;
create trigger org_children_health_reaches_entries
  after update of medical_notes, emergency_contact_name, emergency_contact_phone on public.org_children
  for each row
  when (new.medical_notes is distinct from old.medical_notes
     or new.emergency_contact_name is distinct from old.emergency_contact_name
     or new.emergency_contact_phone is distinct from old.emergency_contact_phone)
  execute function public.org_child_health_reaches_entries();

-- ── 3. The backfill: each child's value from its newest entry that has one ─────────────────────────────────────────────
-- (Through the triggers above, a LIVE entry that was blank then takes its child's carried value — the carry the ruling
-- asks for. A live entry with its own value is the newest, so it is the child's value already.)
do $$
declare
  v uuid;
begin
  for v in select distinct r.child_id from public.rep_roster_players r where r.child_id is not null loop
    perform public.org_child_health_from_entries(v);
  end loop;
end;
$$;

-- ── 4. A join keeps the newer child's health; a split re-reads both sides' ─────────────────────────────────────────────
create or replace function public.org_children_join(p_keep uuid, p_absorb uuid)
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
  -- (441) Which side is newer, read BEFORE the entries move: its health wins column by column.
  select max(y.year) into v_keep_year
    from public.rep_roster_players r join public.rep_program_years y on y.id = r.program_year_id where r.child_id = p_keep;
  select max(y.year) into v_absorb_year
    from public.rep_roster_players r join public.rep_program_years y on y.id = r.program_year_id where r.child_id = p_absorb;
  select medical_notes, emergency_contact_name, emergency_contact_phone into k from public.org_children where id = p_keep;
  select medical_notes, emergency_contact_name, emergency_contact_phone into a from public.org_children where id = p_absorb;

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
  -- (441) The health facts, carried BEFORE the absorbed record goes (435's ⚠). Newer side first, the other as fallback.
  if coalesce(v_absorb_year, -1) > coalesce(v_keep_year, -1) then
    update public.org_children
       set medical_notes           = coalesce(a.medical_notes, k.medical_notes),
           emergency_contact_name  = coalesce(a.emergency_contact_name, k.emergency_contact_name),
           emergency_contact_phone = coalesce(a.emergency_contact_phone, k.emergency_contact_phone),
           updated_at = now()
     where id = p_keep;
  else
    update public.org_children
       set medical_notes           = coalesce(k.medical_notes, a.medical_notes),
           emergency_contact_name  = coalesce(k.emergency_contact_name, a.emergency_contact_name),
           emergency_contact_phone = coalesce(k.emergency_contact_phone, a.emergency_contact_phone),
           updated_at = now()
     where id = p_keep;
  end if;
  -- (441, /review F2) When the kept side wins, the child's value does not change and the reach never fires — so the
  -- absorbed side's live entries (now the kept child's) are brought to the child's value here, unconditionally.
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
  perform public.org_child_rename_from_entries(p_keep);
end;
$$;

revoke all on function public.org_children_join(uuid, uuid) from public, anon, authenticated;
grant execute on function public.org_children_join(uuid, uuid) to service_role;

-- Re-created from 435 EXACTLY, plus the two health re-reads: the split-off child takes its entries' values, and the kept
-- child is re-read from what it still holds (it must not keep a value that came only from the entries that left).
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
    -- (441)
    perform public.org_child_health_from_entries(v_new);
    perform public.org_child_health_from_entries(p_child);
  end loop;
end;
$$;

revoke all on function public.org_child_health_from_entries(uuid) from public, anon, authenticated;
grant execute on function public.org_child_health_from_entries(uuid) to service_role;
revoke all on function public.org_child_health_fills_entry() from public, anon, authenticated;
revoke all on function public.org_child_health_follows_entry() from public, anon, authenticated;
revoke all on function public.org_child_health_reaches_entries() from public, anon, authenticated;
revoke all on function public.rep_document_template_default_validity() from public, anon, authenticated;

commit;
