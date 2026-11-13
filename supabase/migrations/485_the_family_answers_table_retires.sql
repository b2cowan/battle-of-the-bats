-- 485_the_family_answers_table_retires.sql
--
-- One attendance record, Session 1 (plan docs/projects/active/ONE_ATTENDANCE_RECORD_PLAN.md §2, §3 C1, §4). Needs 483 and 484
-- (484 rewrote the nightly purge so it no longer reads the table this drops). ORDER on prod: … → 483 → 484 → 485.
--
-- WHAT CHANGES
--   1. C1 = NOTHING is cleared on a new day (owner 2026-11-13, reverses Stage 4b ask 10): mig 480's new-day trigger and its
--      function are DROPPED, not retargeted. Answers and the Remind log carry over; families and the coach update them by hand.
--   2. A deleted rep event's Remind log still goes with it (mig 476's delete trigger, body now the log only; the event's
--      attendance rows go by their own FK cascade, mig 069).
--   3. A parent's connection ends (mig 480 §2's rule, unchanged doors): that parent's FAMILY NOTES on that child's attendance rows
--      are blanked. The answers stay. Not on a merge of two child records, and not while the same account still holds another
--      verified link to the child.
--   4. The family note's writer account is deleted (the FK sets family_note_by_user_id to null): the note's words and time go too,
--      so a deleted account never leaves words behind that no "by this user" lookup can find.
--   5. org_children_join re-created from 482 WITHOUT its "(482)" answers step: the attendance record is keyed by the roster
--      entry (player_id), which the join already re-points, so a merged child keeps every answer with nothing to move.
--   6. event_availability_answers is DROPPED (dev only: it never reached prod). Its writer-gone trigger and function go with it.
--
-- Re-runnable.

begin;

set local lock_timeout = '15s';

-- ── 1. A new day clears nothing (C1) ────────────────────────────────────────────────────────────────────────────────────────────
drop trigger if exists rep_team_events_new_day_clears_availability on public.rep_team_events;
drop function if exists public.rep_team_events_new_day_clears_availability();

-- ── 2. A deleted event takes its Remind log ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rep_team_events_drop_availability() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.event_availability_reminders where event_kind = 'rep_event' and event_id = old.id;
  return old;
end $$;
revoke all on function public.rep_team_events_drop_availability() from public, anon, authenticated;

-- ── 3. A parent's connection ends: their family notes on that child go ──────────────────────────────────────────────────────────
create or replace function public.family_links_end_clears_answer_notes() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.status is distinct from 'verified' or old.user_id is null then return null; end if;
  if tg_op = 'UPDATE' then
    -- Still the same connected account: nothing ended.
    if new.status = 'verified' and new.user_id is not distinct from old.user_id then return null; end if;
    -- Two records of one child joined: the same parent stays connected to the kept child.
    if new.ended_by is not distinct from 'merged' then return null; end if;
  end if;
  -- The same account still holds another verified link to this child (a second team's): still connected.
  if exists (
    select 1 from public.family_links l
     where l.user_id = old.user_id and l.child_id = old.child_id and l.status = 'verified' and l.id <> old.id
  ) then return null; end if;
  update public.rep_team_event_attendance a
     set family_note = null, family_note_by_user_id = null, family_note_at = null
    from public.rep_roster_players r
   where r.child_id = old.child_id and a.player_id = r.id and a.family_note_by_user_id = old.user_id;
  return null;
end $$;
revoke all on function public.family_links_end_clears_answer_notes() from public, anon, authenticated;
-- (The trigger itself, mig 480 §2, is unchanged: after update of status, user_id or delete on family_links.)

-- ── 4. A deleted account's family notes go with it ──────────────────────────────────────────────────────────────────────────────
create or replace function public.rep_team_event_attendance_family_note_writer_gone() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.family_note_by_user_id is not null and new.family_note_by_user_id is null then
    new.family_note := null;
    new.family_note_at := null;
  end if;
  return new;
end $$;
revoke all on function public.rep_team_event_attendance_family_note_writer_gone() from public, anon, authenticated;

drop trigger if exists rep_team_event_attendance_family_note_writer_gone on public.rep_team_event_attendance;
create trigger rep_team_event_attendance_family_note_writer_gone
  before update of family_note_by_user_id on public.rep_team_event_attendance
  for each row execute function public.rep_team_event_attendance_family_note_writer_gone();

-- ── 5. The child join, without the answers step ─────────────────────────────────────────────────────────────────────────────────
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

-- ── 6. The family-answers table retires ─────────────────────────────────────────────────────────────────────────────────────────
drop table if exists public.event_availability_answers;
drop function if exists public.event_availability_answers_writer_gone();

commit;

notify pgrst, 'reload schema';
