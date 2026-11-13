-- 484_the_nightly_cleanup_never_deletes_an_answer.sql
--
-- ⚠ WATCHED AUTOMATION — the owner's explicit go: call C4, 2026-11-13 (plan docs/projects/active/ONE_ATTENDANCE_RECORD_PLAN.md §3).
-- Its own commit. Needs 483 (the columns). ORDER: before 485, which drops the table the old body deleted from.
--
-- WHAT CHANGES: the BODY of public.event_availability_purge() (mig 476) only. Its name, its grants and mig 477's nightly pg_cron
-- job ('family-answers-purge', 08:35 GMT) are untouched, so the job runs this body from the night it is applied.
--
-- WHAT IT DOES EACH NIGHT, on the one attendance record (ruling 8: the status is kept forever)
--   (a) the family's note — words, writer and time — is blanked 30 days after its event (its end, else its start);
--   (b) who set the answer and the answer before it (set_by_user_id; previous_status / _by_kind / _by_user_id / _at) are blanked
--       60 days after the season's LAST event (the latest of any event's start and end in that season, so adding a game later
--       moves the clock and a mistyped end before the start cannot pull it earlier), whether or not the season is closed (no rep
--       season stores a close date, O4). set_by_kind and set_at stay: "Coach" / "Family" names no person.
--   (c) the Remind log (counts and the coach who pressed; never a child) goes with its season, by the same rule — unchanged.
--
-- ⚠⚠ IT NEVER DELETES AN ATTENDANCE ROW. Statements against rep_team_event_attendance are UPDATEs that touch only the family note
-- and authorship columns, never `status`, never `note` (the coach's), never `updated_by` (the coach's audit). Held by
-- tests/sql/one-attendance-record-fixture.sql, section 6.
--
-- Returns how many attendance rows it blanked anything on (the job's own record; nothing names a child). Idempotent: a blanked
-- row no longer matches. Pure SQL inside the database: no app call, no email.
--
-- Adds NO table and NO column: the check:migrations drift gate cannot see prod missing it; MANUAL_PROD_STEPS.json tracks it (S3).

create or replace function public.event_availability_purge() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_notes integer; v_who integer;
begin
  -- (a) The family's note, 30 days after its event.
  update public.rep_team_event_attendance a
     set family_note = null, family_note_by_user_id = null, family_note_at = null
    from public.rep_team_events e
   where e.id = a.event_id
     and (a.family_note is not null or a.family_note_by_user_id is not null or a.family_note_at is not null)
     and greatest(e.starts_at, coalesce(e.ends_at, e.starts_at)) < now() - interval '30 days';
  get diagnostics v_notes = row_count;

  -- (b) Who set it and the answer before it, 60 days after the season's last event.
  update public.rep_team_event_attendance a
     set set_by_user_id = null,
         previous_status = null, previous_by_kind = null, previous_by_user_id = null, previous_at = null
    from (select program_year_id, max(greatest(starts_at, coalesce(ends_at, starts_at))) as last_at
            from public.rep_team_events group by program_year_id) s
   where s.program_year_id = a.program_year_id
     and s.last_at < now() - interval '60 days'
     and (a.set_by_user_id is not null or a.previous_status is not null or a.previous_by_kind is not null
          or a.previous_by_user_id is not null or a.previous_at is not null);
  get diagnostics v_who = row_count;

  -- (c) The Remind log: first the rows whose event is gone, then a season's rows 60 days after its last event.
  delete from public.event_availability_reminders r
   where r.event_kind = 'rep_event'
     and not exists (select 1 from public.rep_team_events e where e.id = r.event_id);

  delete from public.event_availability_reminders r
   using public.rep_team_events e,
         (select program_year_id, max(greatest(starts_at, coalesce(ends_at, starts_at))) as last_at
            from public.rep_team_events group by program_year_id) s
   where r.event_kind = 'rep_event' and e.id = r.event_id
     and s.program_year_id = e.program_year_id and s.last_at < now() - interval '60 days';

  return v_notes + v_who;
end $$;
revoke all on function public.event_availability_purge() from public, anon, authenticated;
grant execute on function public.event_availability_purge() to service_role;

notify pgrst, 'reload schema';
