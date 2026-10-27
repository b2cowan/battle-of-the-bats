-- ---------------------------------------------------------------
-- Migration 394 — Club Tier Stage 11b Part 3: a division's piece saves whole.
-- Plan: docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md §9 (the 11b status log); drawings
-- HOUSE_LEAGUE_STAGE11B_PART3_DRAWINGS.html ("A piece's window"), ruled 2026-10-27 (card 1: one Save).
--
-- WHY: a division's piece stages its ticks and saves them with ONE Save, and one Save can give new parts AND give others
-- back. league_slot_uses_set takes one use per call, so two calls could half-apply. And the stale-give check ("each slot
-- still holds what the window saw") ran in TypeScript before the step, outside its lock.
--
-- WHAT CHANGES:
--   1. league_slot_uses_apply(p_org, p_season, p_actor, p_changes jsonb) — every change in one step, or none of them.
--      p_changes: [{ slotId, from: {divisionId, kind} | null, to: {divisionId, kind} | null }] (null = Not given yet).
--      Refusals before any write: bad_request · not_found · season_closed · changed (+ slotId). Each slot is locked in id
--      order, THEN read again: a live slot of a FINAL schedule house league holds, still to come, not another season's,
--      and holding exactly `from`. Practices that haven't started go where a slot stops being their division's practice
--      time (league_slot_uses_set's rule). Returns { ok, slots, practicesRemoved }.
--   2. league_slot_uses_set stays, unchanged: the SQL checks call it; the league admin's window now writes only through
--      league_slot_uses_apply. The table's comment names it among its writers.
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
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) = 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  -- Each change's shape: a slot id, and `from` / `to` each null or a division and a kind.
  for v_c in select * from jsonb_array_elements(p_changes) loop
    if jsonb_typeof(v_c) <> 'object'
       or coalesce(v_c->>'slotId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or exists (select 1 from (values (v_c->'from'), (v_c->'to')) u(x)
                   where x is not null and jsonb_typeof(x) <> 'null'
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

  v_code := league_time_refusal(p_org, p_season, null);
  if v_code is not null then return jsonb_build_object('ok', false, 'code', v_code); end if;
  -- Every division a change gives to is the season's.
  if exists (select 1 from jsonb_array_elements(p_changes) c
              where jsonb_typeof(c->'to') = 'object'
                and not exists (select 1 from league_divisions d
                                 where d.id = (c->'to'->>'divisionId')::uuid and d.season_id = p_season)) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- Each slot locked in id order (two writers never wait on each other in a circle), THEN read again: a read joined to
  -- the lock would see the program and the use as they were before the wait.
  for v_slot in select distinct s from unnest(v_slots) s order by 1 loop
    perform 1 from club_schedule_slots where id = v_slot and org_id = p_org for update;
  end loop;
  for v_c in select * from jsonb_array_elements(p_changes) loop
    v_slot := (v_c->>'slotId')::uuid;
    if not exists (select 1 from club_schedule_slots sl
                     join club_schedules s on s.id = sl.schedule_id
                     join club_schedule_slot_programs p on p.slot_id = sl.id
                    where sl.id = v_slot and sl.org_id = p_org and sl.removed_at is null and s.state = 'final'
                      and p.program = 'house_league' and sl.starts_at > now())
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
    -- Practices that haven't started go when the slot stops being their division's practice time.
    delete from league_practices lp
     where lp.club_schedule_slot_id = v_slot and lp.org_id = p_org and lp.scheduled_at > now()
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
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('ok', true, 'slots', v_count, 'practicesRemoved', v_removed);
end;
$$;

comment on table public.league_slot_uses is
  'How a league admin divided house league''s time (Club Tier Stage 11b, migs 392–394; 9d2·5, 9d2·15): one use per house-league slot — a division''s game time (`games`, which 9d-2a''s Generate games fills) or its practice time (`practices`, which Practice time hands out to its teams). Owned by a SEASON, not the program. A house-league slot with no row is "Not given yet". Cascades from the SLOT (mig 393): when the club takes a slot back, its use waits until Send the changes carries it to where the time moved or clears it. Written only by league_slot_uses_apply (the league admin''s Save, mig 394), league_slot_uses_set and club_schedule_apply_changes.';

revoke all on function public.league_slot_uses_apply(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.league_slot_uses_apply(uuid, uuid, uuid, jsonb) to service_role;

COMMIT;
