-- ---------------------------------------------------------------
-- Migration 397 — Club Tier Stage 11b Part 3, the /review of migration 394 (a division's piece saves whole).
-- Plan: docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md §9 (the 11b status log).
--
-- WHY (/review 2026-10-27, the data-and-concurrency lens):
--   • The step locked slots but never the schedule: Send the changes (club_schedule_apply_changes), a save and a hand edit
--     each take the SCHEDULE first and move or clear uses without the slot locks. A Save could read a slot that a Send in
--     flight was moving a use onto, and overwrite the moved use when the Send committed.
--   • The season's state was read without a lock: a Save could land on a season being finished at that moment.
--   • The shape check let a change with no `from` or no `to` key through (only TypeScript required them); a missing `to`
--     read as "give it back" and removed the slot's practices still to come.
--   • A no-op change (`from` equal to `to`) still ran the practices' removal.
--   • `now()` is the transaction's start: after a wait on a lock, a slot that had started in the meantime still read as
--     still to come.
--
-- WHAT CHANGES: league_slot_uses_apply REPLACED (same signature):
--   1. the schedules of the named slots are locked FOR SHARE in id order BEFORE the slots (the other writers' order), so
--      a Save waits out a Send, a save or a hand edit of the same schedule; the season row FOR SHARE before its state is
--      read;
--   2. every change must carry both keys, `from` and `to` (JSON null for Not given yet);
--   3. a change whose `from` is `to` is checked (it must still hold `from`) and then changes nothing;
--   4. "still to come" is read on the clock after the locks (clock_timestamp()).
-- Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

create or replace function public.league_slot_uses_apply(p_org uuid, p_season uuid, p_actor uuid, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text;
  v_c       jsonb;
  v_slot    uuid;
  v_n       integer := 0;
  v_removed integer := 0;
  v_count   integer := 0;
  v_slots   uuid[] := '{}';
  v_now     timestamptz;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) = 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  -- Each change's shape: a slot id, and BOTH `from` and `to`, each JSON null or a division and a kind.
  for v_c in select * from jsonb_array_elements(p_changes) loop
    if jsonb_typeof(v_c) <> 'object' or not (v_c ? 'from') or not (v_c ? 'to')
       or coalesce(v_c->>'slotId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or exists (select 1 from (values (v_c->'from'), (v_c->'to')) u(x)
                   where jsonb_typeof(x) <> 'null'
                     and (jsonb_typeof(x) <> 'object'
                          or coalesce(x->>'kind', '') not in ('games', 'practices')
                          or coalesce(x->>'divisionId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')) then
      return jsonb_build_object('ok', false, 'code', 'bad_request');
    end if;
    v_slots := v_slots || (v_c->>'slotId')::uuid;
  end loop;
  -- One change per slot.
  if (select count(distinct s) from unnest(v_slots) s) <> cardinality(v_slots) then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;

  -- The season, held while its state is read: a Save never lands on a season being finished.
  perform 1 from league_seasons where id = p_season and org_id = p_org for share;
  v_code := league_time_refusal(p_org, p_season, null);
  if v_code is not null then return jsonb_build_object('ok', false, 'code', v_code); end if;
  -- Every division a change gives to is the season's.
  if exists (select 1 from jsonb_array_elements(p_changes) c
              where jsonb_typeof(c->'to') = 'object'
                and not exists (select 1 from league_divisions d
                                 where d.id = (c->'to'->>'divisionId')::uuid and d.season_id = p_season)) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- The schedules first, in id order — the order Send the changes, a save and a hand edit take them — so a Save waits
  -- out any of them; then each slot in id order; THEN read again (a read joined to the lock would see the program and
  -- the use as they were before the wait).
  perform 1 from club_schedules s
   where s.org_id = p_org and s.id in (select sl.schedule_id from club_schedule_slots sl where sl.id = any (v_slots))
   order by s.id for share;
  for v_slot in select distinct s from unnest(v_slots) s order by 1 loop
    perform 1 from club_schedule_slots where id = v_slot and org_id = p_org for update;
  end loop;
  v_now := clock_timestamp();
  for v_c in select * from jsonb_array_elements(p_changes) loop
    v_slot := (v_c->>'slotId')::uuid;
    if not exists (select 1 from club_schedule_slots sl
                     join club_schedules s on s.id = sl.schedule_id
                     join club_schedule_slot_programs p on p.slot_id = sl.id
                    where sl.id = v_slot and sl.org_id = p_org and sl.removed_at is null and s.state = 'final'
                      and p.program = 'house_league' and sl.starts_at > v_now)
       or exists (select 1 from league_slot_uses u where u.slot_id = v_slot and u.season_id <> p_season)
       -- It still holds what the window saw: `from`, or nothing when `from` is null.
       or (select case when u.slot_id is null then 'open' else u.division_id::text || ':' || u.kind end
             from (select 1) one left join league_slot_uses u on u.slot_id = v_slot)
          is distinct from
          (case when jsonb_typeof(v_c->'from') = 'object'
                then lower(v_c->'from'->>'divisionId') || ':' || (v_c->'from'->>'kind') else 'open' end) then
      return jsonb_build_object('ok', false, 'code', 'changed', 'slotId', v_slot);
    end if;
  end loop;

  for v_c in select * from jsonb_array_elements(p_changes) loop
    v_slot := (v_c->>'slotId')::uuid;
    v_count := v_count + 1;
    -- A change to what the slot already holds changes nothing (checked above, like every other).
    continue when (case when jsonb_typeof(v_c->'from') = 'object' then lower(v_c->'from'->>'divisionId') || ':' || (v_c->'from'->>'kind') else 'open' end)
                = (case when jsonb_typeof(v_c->'to') = 'object' then lower(v_c->'to'->>'divisionId') || ':' || (v_c->'to'->>'kind') else 'open' end);
    -- Practices that haven't started go when the slot stops being their division's practice time.
    delete from league_practices lp
     where lp.club_schedule_slot_id = v_slot and lp.org_id = p_org and lp.scheduled_at > v_now
       and not coalesce(v_c->'to'->>'kind' = 'practices'
                        and lp.division_id = (v_c->'to'->>'divisionId')::uuid, false);
    get diagnostics v_n = row_count;
    v_removed := v_removed + v_n;
    if jsonb_typeof(v_c->'to') = 'object' then
      insert into league_slot_uses (slot_id, org_id, season_id, division_id, kind, created_by)
      values (v_slot, p_org, p_season, (v_c->'to'->>'divisionId')::uuid, v_c->'to'->>'kind', p_actor)
      on conflict (slot_id) do update set division_id = excluded.division_id, kind = excluded.kind, updated_at = now();
    else
      delete from league_slot_uses where slot_id = v_slot;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'slots', v_count, 'practicesRemoved', v_removed);
end;
$$;

revoke all on function public.league_slot_uses_apply(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.league_slot_uses_apply(uuid, uuid, uuid, jsonb) to service_role;

COMMIT;
