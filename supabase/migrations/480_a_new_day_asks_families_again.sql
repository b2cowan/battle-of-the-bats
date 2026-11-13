-- 480_a_new_day_asks_families_again.sql
--
-- Signed-in family accounts Stage 4b, Session 3 (Part 6; build prompt docs/projects/active/SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md,
-- asks 10 and 15). Needs 476.
--
-- WHY THESE ARE TRIGGERS, NOT APP CODE: an event's day moves through more than the coach's event PATCH (a tournament reschedules a
-- mirrored game; the club's schedule tool moves practices in SQL), and a parent's connection ends through four doors (their own
-- leave, a club removal, a rep coach's removal, the Stage 3b stop, which is SQL) plus account deletion. One rule each, at the table,
-- so no door can miss it.
--
-- WHAT CHANGES (no table or column; three functions + three triggers)
--   1. rep_team_events: when an event's DAY changes (the org day, America/Toronto: lib/timezone.ts ORG_TIME_ZONE), its family answers
--      and its Remind log go (ask 10: families answer again; the 24-hour Remind clock starts over for the new day). A new time on the
--      same day keeps them. A cancel / reinstate never touches them (kept and hidden, then back). Fires whether or not the team's
--      switch is on, so a switch turned on later never brings back an answer about the old day.
--   2. family_links: when a VERIFIED link with an account ends (revoked, declined, deleted, or its account cleared), that parent's
--      notes on THAT child's answers are nulled (ask 15). The answers stay. Not when the link ended as a merge of two child records
--      (the same parent stays on the kept child), and not while the same account still holds another verified link to the child.
--   3. event_availability_answers: when the answering account is deleted (the FK sets answered_by_user_id to null), the note goes
--      with it, so a deleted account never leaves words behind that no "by this user" lookup can find again.
--
-- Nothing here reads or writes the coach's attendance book. Re-runnable.

begin;

set local lock_timeout = '15s';

-- ── 1. A new day clears the answers (ask 10) ────────────────────────────────────────────────────────────────────────────────────
create or replace function public.rep_team_events_new_day_clears_availability() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (old.starts_at at time zone 'America/Toronto')::date is distinct from (new.starts_at at time zone 'America/Toronto')::date then
    delete from public.event_availability_answers where event_kind = 'rep_event' and event_id = new.id;
    delete from public.event_availability_reminders where event_kind = 'rep_event' and event_id = new.id;
  end if;
  return new;
end $$;
revoke all on function public.rep_team_events_new_day_clears_availability() from public, anon, authenticated;

drop trigger if exists rep_team_events_new_day_clears_availability on public.rep_team_events;
create trigger rep_team_events_new_day_clears_availability
  after update of starts_at on public.rep_team_events
  for each row when (old.starts_at is distinct from new.starts_at)
  execute function public.rep_team_events_new_day_clears_availability();

-- ── 2. A parent's connection ends: their notes on that child go (ask 15) ────────────────────────────────────────────────────────
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
  update public.event_availability_answers
     set note = null, updated_at = now()
   where answered_by_user_id = old.user_id and child_id = old.child_id and note is not null;
  return null;
end $$;
revoke all on function public.family_links_end_clears_answer_notes() from public, anon, authenticated;

drop trigger if exists family_links_end_clears_answer_notes on public.family_links;
create trigger family_links_end_clears_answer_notes
  after update of status, user_id or delete on public.family_links
  for each row execute function public.family_links_end_clears_answer_notes();

-- ── 3. A deleted account's notes go with it ─────────────────────────────────────────────────────────────────────────────────────
create or replace function public.event_availability_answers_writer_gone() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.answered_by_user_id is not null and new.answered_by_user_id is null then
    new.note := null;
  end if;
  return new;
end $$;
revoke all on function public.event_availability_answers_writer_gone() from public, anon, authenticated;

drop trigger if exists event_availability_answers_writer_gone on public.event_availability_answers;
create trigger event_availability_answers_writer_gone
  before update of answered_by_user_id on public.event_availability_answers
  for each row execute function public.event_availability_answers_writer_gone();

commit;

notify pgrst, 'reload schema';
