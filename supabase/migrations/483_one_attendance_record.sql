-- 483_one_attendance_record.sql
--
-- One attendance record, Session 1 (plan docs/projects/active/ONE_ATTENDANCE_RECORD_PLAN.md §0, §2, §4; owner ruling 2026-11-13).
-- Needs 069 and 479 (dev). On prod, order 476 → 477 → 479 → 480 → 482 → 483 → 484 → 485 (or folded at the promote; none is on prod).
--
-- WHY: one attendance answer per event + player. A connected parent or an attendance coach sets it; the latest change wins. The
-- coach's book becomes that record; the family-answers table (mig 476) is retired by mig 485.
--
-- WHAT CHANGES on rep_team_event_attendance
--   status                  + 'maybe' (ruling 1). A Maybe still standing counts as Not marked in every stat (ruling 2): the app
--                           decides that, the CHECK only admits the word.
--   set_at                  RENAMED from mig 479's dev-only marked_at: when the current status was set, by anyone.
--   set_by_kind             coach | family | system: who set the current status (ruling 4). Null on a row nobody has set.
--   set_by_user_id          the account that set it (FK, set null). Purged on the season clock (mig 484).
--   previous_status, previous_by_kind, previous_by_user_id, previous_at
--                           the answer before the latest change ("earlier: In (Adasmom, Nov 1)"). Written only when the status
--                           changes. Purged on the season clock.
--   family_note, family_note_by_user_id, family_note_at
--                           the family's note (ruling 3: the coach reads it; blanked 30 days after the event, mig 484). The
--                           coach's private note stays in `note`, staff only.
--   updated_by              UNCHANGED MEANING: the coach's audit column. ⚠ The family writer never writes it, so the purge can
--                           blank family authorship without touching the coach's audit (plan §2).
--
-- THE ONE WRITER: public.rep_attendance_write(...) — SECURITY DEFINER, service role only. Locks the row, moves current → previous
-- only when the status changes, refuses a family after the event's start (ruling 2) or on a cancelled event, and takes two
-- "only if" guards decided INSIDE the row lock: only_if_unknown ("All in" fills only players nobody has answered, ruling 6) and
-- only_if_set_by ("Reset" clears only the coach's answers, call C2). rep_attendance_write_many(...) is the coach's batch, in
-- player order so two coaches saving at once cannot deadlock.
--
-- RLS: mig 069's two SELECT policies are DROPPED and the browser roles lose every grant. Nothing in the browser reads this table
-- (verified 2026-11-13); every server read names its columns, and the family fields reach only the attendance-capability reads.
--
-- BACKFILL: every already-marked row (status ≠ unknown) is coach-set: set_by_user_id = updated_by (the best fact there is: the
-- room saved the whole roster, so it is the coach who saved last), set_at kept (479's backfill) else updated_at. Run AFTER the
-- schema transaction commits, so the table's ACCESS EXCLUSIVE lock is never held across the backfill.
--
-- DEV COPY: dev's family answers (mig 476's table) are copied in, latest wins against the coach's mark. Prod has no such table and
-- copies nothing (the block checks for it).
--
-- Re-runnable.

begin;

set local lock_timeout = '15s';

-- ── 1. Maybe, and who set it when ───────────────────────────────────────────────────────────────────────────────────────────────
alter table public.rep_team_event_attendance drop constraint if exists rep_team_event_attendance_status_check;
alter table public.rep_team_event_attendance add constraint rep_team_event_attendance_status_check
  check (status in ('unknown', 'attending', 'absent', 'late', 'maybe')) not valid;

do $rename$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'rep_team_event_attendance' and column_name = 'marked_at')
     and not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'rep_team_event_attendance' and column_name = 'set_at') then
    alter table public.rep_team_event_attendance rename column marked_at to set_at;
  end if;
end $rename$;

alter table public.rep_team_event_attendance
  add column if not exists set_at                 timestamptz,
  add column if not exists set_by_kind            text,
  add column if not exists set_by_user_id         uuid references auth.users(id) on delete set null,
  add column if not exists previous_status        text,
  add column if not exists previous_by_kind       text,
  add column if not exists previous_by_user_id    uuid references auth.users(id) on delete set null,
  add column if not exists previous_at            timestamptz,
  add column if not exists family_note            text,
  add column if not exists family_note_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists family_note_at         timestamptz;

alter table public.rep_team_event_attendance drop constraint if exists rep_team_event_attendance_set_by_kind_check;
alter table public.rep_team_event_attendance add constraint rep_team_event_attendance_set_by_kind_check
  check (set_by_kind is null or set_by_kind in ('coach', 'family', 'system')) not valid;
alter table public.rep_team_event_attendance drop constraint if exists rep_team_event_attendance_previous_check;
alter table public.rep_team_event_attendance add constraint rep_team_event_attendance_previous_check
  check ((previous_status is null or previous_status in ('unknown', 'attending', 'absent', 'late', 'maybe'))
     and (previous_by_kind is null or previous_by_kind in ('coach', 'family', 'system'))) not valid;
alter table public.rep_team_event_attendance drop constraint if exists rep_team_event_attendance_family_note_check;
alter table public.rep_team_event_attendance add constraint rep_team_event_attendance_family_note_check
  check (family_note is null or char_length(family_note) between 1 and 200) not valid;

-- "Everything this account set or wrote" (a leaving parent's notes, the Leave/Stop confirms) and the FKs' set-null path.
create index if not exists rep_team_event_attendance_set_by_user_idx
  on public.rep_team_event_attendance (set_by_user_id) where set_by_user_id is not null;
create index if not exists rep_team_event_attendance_previous_by_user_idx
  on public.rep_team_event_attendance (previous_by_user_id) where previous_by_user_id is not null;
create index if not exists rep_team_event_attendance_family_note_by_user_idx
  on public.rep_team_event_attendance (family_note_by_user_id) where family_note_by_user_id is not null;

-- ── 2. RLS: no browser reader ───────────────────────────────────────────────────────────────────────────────────────────────────
drop policy if exists "org members can read rep_team_event_attendance" on public.rep_team_event_attendance;
drop policy if exists "coaches can read assigned team attendance" on public.rep_team_event_attendance;
revoke all on public.rep_team_event_attendance from anon, authenticated;
grant select, insert, update, delete on public.rep_team_event_attendance to service_role;

-- ── 3. The one writer ───────────────────────────────────────────────────────────────────────────────────────────────────────────
-- p_status null = the status is not being changed (a note-only write). p_set_note / p_set_family_note say whether that note is
-- being written (null clears it). Returns {row, prior, changed}: `prior` is the status before this write.
create or replace function public.rep_attendance_write(
  p_event            uuid,
  p_player           uuid,
  p_kind             text,
  p_by               uuid,
  p_status           text    default null,
  p_note             text    default null,
  p_set_note         boolean default false,
  p_family_note      text    default null,
  p_set_family_note  boolean default false,
  p_only_if_unknown  boolean default false,
  p_only_if_set_by   text    default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  e       record;
  r       public.rep_team_event_attendance;
  v_now   timestamptz := now();
  v_prior text;
  v_note  text;
  v_fnote text;
  v_move  boolean := false;
  v_dirty boolean := false;
begin
  if p_kind is null or p_kind not in ('coach', 'family', 'system') then
    raise exception 'attendance_bad_kind' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('unknown', 'attending', 'absent', 'late', 'maybe') then
    raise exception 'attendance_bad_status' using errcode = '22023';
  end if;
  -- Each note is its side's alone (ruling 3).
  if p_set_note and p_kind <> 'coach' then raise exception 'attendance_note_is_the_coachs' using errcode = '42501'; end if;
  if p_set_family_note and p_kind <> 'family' then raise exception 'attendance_family_note_is_the_familys' using errcode = '42501'; end if;

  select id, program_year_id, team_id, org_id, status, starts_at into e from public.rep_team_events where id = p_event;
  if not found then raise exception 'attendance_no_event' using errcode = 'P0002'; end if;
  -- Ruling 2: at the event's start families lock (and a cancelled event is closed to them). The server checks first; this is the
  -- second guard, so no door can write a family answer after the start.
  if p_kind = 'family' and (e.status = 'cancelled' or e.starts_at is null or e.starts_at <= v_now) then
    raise exception 'attendance_closed' using errcode = 'P0001';
  end if;

  select * into r from public.rep_team_event_attendance where event_id = p_event and player_id = p_player for update;
  if not found then
    -- Nothing to clear for a player nobody has answered (Reset never makes an empty row).
    if p_only_if_set_by is not null then
      return jsonb_build_object('row', null, 'prior', 'unknown', 'changed', false);
    end if;
    insert into public.rep_team_event_attendance (event_id, player_id, program_year_id, team_id, org_id, status)
      values (p_event, p_player, e.program_year_id, e.team_id, e.org_id, 'unknown')
      on conflict (event_id, player_id) do nothing;
    select * into r from public.rep_team_event_attendance where event_id = p_event and player_id = p_player for update;
  end if;
  v_prior := r.status;

  -- The guards, decided under the row lock (a family answer that landed a moment ago is seen here).
  if (p_only_if_unknown and r.status <> 'unknown')
     or (p_only_if_set_by is not null
         -- A marked row nobody set through the writer (a seeded or fixture row, before mig 483) is the coach's, as the backfill made it.
         and coalesce(r.set_by_kind, case when r.status <> 'unknown' then 'coach' end) is distinct from p_only_if_set_by) then
    return jsonb_build_object('row', to_jsonb(r), 'prior', v_prior, 'changed', false);
  end if;

  v_move := p_status is not null and p_status is distinct from r.status;
  if v_move then
    -- The answer before this one, when it had a setter (a row nobody ever set has no "earlier").
    if r.set_at is not null then
      r.previous_status := r.status;
      r.previous_by_kind := r.set_by_kind;
      r.previous_by_user_id := r.set_by_user_id;
      r.previous_at := r.set_at;
    end if;
    r.status := p_status;
    r.set_by_kind := p_kind;
    r.set_by_user_id := p_by;
    r.set_at := v_now;
    v_dirty := true;
  end if;

  if p_set_note then
    v_note := nullif(btrim(p_note), '');
    if v_note is distinct from r.note then r.note := v_note; v_dirty := true; end if;
  end if;

  if p_set_family_note then
    v_fnote := nullif(btrim(p_family_note), '');
    if v_fnote is distinct from r.family_note or (v_fnote is not null and r.family_note_by_user_id is distinct from p_by) then
      r.family_note := v_fnote;
      r.family_note_by_user_id := case when v_fnote is null then null else p_by end;
      r.family_note_at := case when v_fnote is null then null else v_now end;
      v_dirty := true;
    end if;
  end if;

  if not v_dirty then
    return jsonb_build_object('row', to_jsonb(r), 'prior', v_prior, 'changed', false);
  end if;

  update public.rep_team_event_attendance set
    status                 = r.status,
    set_by_kind            = r.set_by_kind,
    set_by_user_id         = r.set_by_user_id,
    set_at                 = r.set_at,
    previous_status        = r.previous_status,
    previous_by_kind       = r.previous_by_kind,
    previous_by_user_id    = r.previous_by_user_id,
    previous_at            = r.previous_at,
    note                   = r.note,
    family_note            = r.family_note,
    family_note_by_user_id = r.family_note_by_user_id,
    family_note_at         = r.family_note_at,
    -- The coach's audit column: only a coach's write moves it (plan §2).
    updated_by             = case when p_kind = 'coach' then p_by else r.updated_by end,
    updated_at             = v_now
  where id = r.id
  returning * into r;

  return jsonb_build_object('row', to_jsonb(r), 'prior', v_prior, 'changed', v_move);
end $$;
revoke all on function public.rep_attendance_write(uuid, uuid, text, uuid, text, text, boolean, text, boolean, boolean, text)
  from public, anon, authenticated;
grant execute on function public.rep_attendance_write(uuid, uuid, text, uuid, text, text, boolean, text, boolean, boolean, text)
  to service_role;

-- The coach's batch: entries [{player_id, status?, note?}] — a key that is absent is not written. In player order (two coaches
-- saving the same event at once take the row locks in one order). Returns the writer's results, in that order.
create or replace function public.rep_attendance_write_many(
  p_event uuid, p_by uuid, p_entries jsonb, p_only_if_unknown boolean default false, p_only_if_set_by text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare x jsonb; v_out jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_entries) is distinct from 'array' then raise exception 'attendance_bad_entries' using errcode = '22023'; end if;
  for x in select value from jsonb_array_elements(p_entries) order by value->>'player_id' loop
    v_out := v_out || jsonb_build_array(public.rep_attendance_write(
      p_event, (x->>'player_id')::uuid, 'coach', p_by,
      x->>'status', x->>'note', x ? 'note', null, false, p_only_if_unknown, p_only_if_set_by));
  end loop;
  return v_out;
end $$;
revoke all on function public.rep_attendance_write_many(uuid, uuid, jsonb, boolean, text) from public, anon, authenticated;
grant execute on function public.rep_attendance_write_many(uuid, uuid, jsonb, boolean, text) to service_role;

commit;

-- ── 4. Backfill (outside the schema transaction: row locks only) ──────────────────────────────────────────────────────────────
set lock_timeout = '15s';

update public.rep_team_event_attendance
   set set_by_kind = 'coach', set_by_user_id = updated_by, set_at = coalesce(set_at, updated_at)
 where set_by_kind is null and status <> 'unknown';

alter table public.rep_team_event_attendance validate constraint rep_team_event_attendance_status_check;
alter table public.rep_team_event_attendance validate constraint rep_team_event_attendance_set_by_kind_check;
alter table public.rep_team_event_attendance validate constraint rep_team_event_attendance_previous_check;
alter table public.rep_team_event_attendance validate constraint rep_team_event_attendance_family_note_check;

-- ── 5. Dev's family answers, copied in (prod has no such table) ──────────────────────────────────────────────────────────────
-- Latest wins against the coach's mark: the family's answer becomes current when the book row has no setter or was set earlier;
-- else the coach's stays and only the family's note is copied. The family's own "earlier" is kept when the book had nothing to
-- move into it. Idempotent: a row the copy already made carries the same set_at and is not moved again.
do $copy$
declare a record;
begin
  if to_regclass('public.event_availability_answers') is null then return; end if;
  for a in execute $q$
    select ans.answer, ans.note, ans.answered_by_user_id, ans.answered_at,
           ans.previous_answer, ans.previous_by_user_id, ans.previous_at,
           e.id as event_id, r.id as player_id, e.program_year_id, e.team_id, e.org_id
      from public.event_availability_answers ans
      join public.rep_team_events e on e.id = ans.event_id
      join public.rep_roster_players r on r.child_id = ans.child_id and r.program_year_id = e.program_year_id
     where ans.event_kind = 'rep_event'
  $q$ loop
    insert into public.rep_team_event_attendance (event_id, player_id, program_year_id, team_id, org_id, status)
      values (a.event_id, a.player_id, a.program_year_id, a.team_id, a.org_id, 'unknown')
      on conflict (event_id, player_id) do nothing;

    update public.rep_team_event_attendance t set
      previous_status     = case when t.set_at is not null then t.status
                                 else case a.previous_answer when 'in' then 'attending' when 'out' then 'absent' else a.previous_answer end end,
      previous_by_kind    = case when t.set_at is not null then t.set_by_kind when a.previous_answer is not null then 'family' end,
      previous_by_user_id = case when t.set_at is not null then t.set_by_user_id else a.previous_by_user_id end,
      previous_at         = case when t.set_at is not null then t.set_at else a.previous_at end,
      status              = case a.answer when 'in' then 'attending' when 'out' then 'absent' else 'maybe' end,
      set_by_kind         = 'family',
      set_by_user_id      = a.answered_by_user_id,
      set_at              = a.answered_at,
      updated_at          = now()
     where t.event_id = a.event_id and t.player_id = a.player_id
       and (t.set_at is null or t.set_at < a.answered_at);

    update public.rep_team_event_attendance t set
      family_note = a.note, family_note_by_user_id = a.answered_by_user_id, family_note_at = a.answered_at
     where t.event_id = a.event_id and t.player_id = a.player_id and a.note is not null and t.family_note is null;
  end loop;
end $copy$;

notify pgrst, 'reload schema';
