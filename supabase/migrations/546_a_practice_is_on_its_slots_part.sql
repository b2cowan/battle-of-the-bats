-- 546_a_practice_is_on_its_slots_part.sql
--
-- Club schedules Stage 2, Session 2C: a part travels with the practice (plan
-- docs/projects/active/SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md §5, /dba Finding #55; build prompt
-- SCHEDULE_PARTS_STAGE2_BUILD_PROMPT.md, Session 2C item 1; mig 541 made rep_team_events.section_mask, mig 544 taught the
-- save to store a slot's part). Until this, Finalize and Send the changes wrote a practice on side A as the whole field:
-- every coach, family and calendar read "Field 1" where the club booked "Field 1, side A".
--
-- WHAT CHANGES (both bodies are the live ones EXACTLY — md5-equal on dev and prod 2026-11-26 — plus the part):
--   club_practices_write(p_org, p_rows) — Finalize's and Send the changes' inserts: section_mask is the SLOT's, read from
--     club_schedule_slots by the row's slotId (never from the payload: a practice can't name a part its slot doesn't), and
--     the reinstate (ON CONFLICT) carries it too. A part its field no longer offers (re-split after the schedule ended)
--     is written as the whole field, so a late Finalize is not refused (/review).
--   club_schedule_apply_changes(…) — a moved practice takes its new slot's part (the update already proved the slot the
--     schedule's and live); a house-league practice or game the send moves takes its slot's part too (round 2 Ask 1 A:
--     house league gets parts only through club time — the rest of house league's writers are Session 2E's). A game whose
--     time only changed part (same time, same field) is not in the plan's moves: it takes its slot's part too (/review).
--   A whole-field slot's mask is 0, so with no split field every row is written exactly as before.
--   541's trigger (section_mask_check, before insert or update of section_mask) still refuses a part its field doesn't
--   offer; a field gone clears the part.
--   THE CATCH-UP: practices already written on a part slot before this (none on dev or prod at writing: 0 and 0 — prod has
--   no part slot until 541 and 2B ship) take their slot's part, so the order of the 2B and 2C promotes can't leave one.
--   Signatures unchanged: grants as live (service_role only). Function-only, so check:migrations can't see it
--   (MANUAL_PROD_STEPS.json).
--
-- Idempotent (create or replace; the catch-up touches only rows that differ).

begin;
set local lock_timeout = '15s';

-- ── 1. Finalize's and Send the changes' inserts: the live club_practices_write, plus the slot's part ─────────────────
CREATE OR REPLACE FUNCTION public.club_practices_write(p_org uuid, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row jsonb;
  v_n   integer := 0;
begin
  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    insert into rep_team_events (program_year_id, team_id, org_id, event_type, name, starts_at, ends_at, location,
                                 location_address, field_number, org_venue_id, org_venue_facility_id, section_mask,
                                 status, club_schedule_slot_id)
    values ((v_row->>'programYearId')::uuid, (v_row->>'teamId')::uuid, p_org, 'practice',
            coalesce(nullif(btrim(v_row->>'name'), ''), 'Practice'),
            (v_row->>'startsAt')::timestamptz, (v_row->>'endsAt')::timestamptz,
            nullif(v_row->>'location', ''), nullif(v_row->>'locationAddress', ''), nullif(v_row->>'fieldNumber', ''),
            (v_row->>'venueId')::uuid, nullif(v_row->>'facilityId', '')::uuid,
            -- Stage 2 (mig 546): the slot's part, read from the slot itself (never the payload), 0 for the whole field or a row off its slot's field.
            -- A part its field no longer offers (re-split after the schedule ended) is the whole field, never a refusal.
            coalesce((select sl.section_mask from club_schedule_slots sl
                        left join org_venue_facilities f on f.id = sl.facility_id
                       where sl.id = (v_row->>'slotId')::uuid
                         and sl.facility_id is not distinct from nullif(v_row->>'facilityId', '')::uuid
                         and section_mask_legal(sl.section_mask, coalesce(f.sections, 1::smallint))), 0),
            'scheduled',
            (v_row->>'slotId')::uuid)
    on conflict (program_year_id, club_schedule_slot_id) where club_schedule_slot_id is not null
    do update set status = 'scheduled', starts_at = excluded.starts_at, ends_at = excluded.ends_at,
                  location = excluded.location, location_address = excluded.location_address,
                  field_number = excluded.field_number, org_venue_id = excluded.org_venue_id,
                  org_venue_facility_id = excluded.org_venue_facility_id, section_mask = excluded.section_mask,
                  updated_at = now();
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$function$;

-- ── 2. Send the changes: the live club_schedule_apply_changes, plus each moved row's slot part ───────────────────────
CREATE OR REPLACE FUNCTION public.club_schedule_apply_changes(p_org uuid, p_schedule uuid, p_actor uuid, p_version integer, p_inserts jsonb, p_updates jsonb, p_retire uuid[], p_bill jsonb, p_send uuid, p_log jsonb, p_losses jsonb, p_league jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_s        club_schedules%rowtype;
  v_team     uuid;
  v_res      jsonb;
  v_alloc    uuid;
  v_u        jsonb;
  v_id       uuid;
  v_fate     text;
  v_ins      integer := 0;
  v_upd      integer := 0;
  v_cancel   integer := 0;
  v_delete   integer := 0;
  v_loss     jsonb;
  v_pool     uuid[];
  v_credit   bigint;
  v_rest     bigint;
  v_settled  jsonb := '{}'::jsonb;
  v_hl_moved    integer := 0;
  v_hl_cancel   integer := 0;
  v_hl_uses     integer := 0;
  v_to          club_schedule_slots%rowtype;
  v_lp          league_practices%rowtype;
  v_lg          league_games%rowtype;
  v_published   timestamptz;
  v_g_moved     integer := 0;
  v_g_postponed integer := 0;
  v_g_removed   integer := 0;
begin
  select * into v_s from club_schedules where id = p_schedule and org_id = p_org for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_s.state <> 'final' then return jsonb_build_object('ok', false, 'code', 'not_final'); end if;
  if v_s.version <> p_version then return jsonb_build_object('ok', false, 'code', 'changed', 'version', v_s.version); end if;
  v_team := club_practices_season_refusal(p_org, p_inserts);
  if v_team is not null then return jsonb_build_object('ok', false, 'code', 'season_closed', 'teamId', v_team); end if;

  -- The losses settle against the bills the teams already had — before this step's correction joins the pool.
  v_pool := club_schedule_bill_pool(p_schedule);

  if p_bill is not null then
    v_res := club_allocation_create(p_org, p_actor, p_bill->>'description', nullif(p_bill->>'lineId', '')::uuid, 'time',
                                    p_bill->'splits', p_bill->>'notes');
    if not coalesce((v_res->>'ok')::boolean, false) then return v_res; end if;
    v_alloc := (v_res->>'allocationId')::uuid;
    perform club_bill_file_shares(v_alloc);
  end if;

  if jsonb_array_length(coalesce(p_losses, '[]'::jsonb)) > 0 then
    perform set_config('app.club_money_step', 'on', true);
    for v_loss in select * from jsonb_array_elements(p_losses) loop
      if coalesce((v_loss->>'cents')::bigint, 0) <= 0 then continue; end if;
      if not exists (select 1 from rep_teams where id = (v_loss->>'teamId')::uuid and org_id = p_org) then
        raise exception 'changed: a team of the changes is not this club''s';
      end if;
      -- Dated the club's day the app sends (`p_log.today` — lib/timezone tournamentToday), as Accept's p_on.
      v_credit := club_credit_apply(p_org, (v_loss->>'teamId')::uuid, v_pool, (v_loss->>'cents')::bigint, p_actor,
                                    coalesce((p_log->>'today')::date, current_date), v_loss->>'reason', null, p_send);
      v_rest := (v_loss->>'cents')::bigint - v_credit;
      -- Paid since the preview (or no season to carry it): the send is read again, never a request on no season.
      if v_rest > 0 and not exists (select 1 from rep_program_years where id = nullif(v_loss->'request'->>'programYearId', '')::uuid
                                                                       and team_id = (v_loss->>'teamId')::uuid and org_id = p_org) then
        raise exception 'changed: what the club owes a team that lost time has no season of that team''s to land on';
      end if;
      if v_rest > 0 then
        insert into rep_team_payment_requests (org_id, team_id, program_year_id, request_type, amount, description, status,
                                               money_in_meaning, budget_item_id, budget_category_id, budget_line_id,
                                               created_by, reviewed_by, reviewed_at, club_schedule_send_id)
        values (p_org, (v_loss->>'teamId')::uuid, (v_loss->'request'->>'programYearId')::uuid, 'charge_to_org',
                v_rest / 100.0, left(btrim(v_loss->'request'->>'description'), 500), 'accepted', 'reimbursement',
                nullif(v_loss->'request'->>'budgetItemId', '')::uuid, nullif(v_loss->'request'->>'budgetCategoryId', '')::uuid,
                nullif(v_loss->'request'->>'budgetLineId', '')::uuid, p_actor, p_actor, now(), p_send);
      end if;
      v_settled := v_settled || jsonb_build_object(v_loss->>'teamId', jsonb_build_object('credited', v_credit, 'toPay', v_rest));
    end loop;
  end if;

  -- Retire first, so a slot that moves from one team to another frees its season's index before the new practice lands.
  foreach v_id in array coalesce(p_retire, '{}'::uuid[]) loop
    if not exists (select 1 from rep_team_events e
                    where e.id = v_id and e.org_id = p_org
                      and e.club_schedule_slot_id in (select id from club_schedule_slots where schedule_id = p_schedule)) then
      continue;
    end if;
    v_fate := club_practice_retire(v_id);
    if v_fate = 'cancelled' then v_cancel := v_cancel + 1; elsif v_fate = 'deleted' then v_delete := v_delete + 1; end if;
  end loop;

  for v_u in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) loop
    if not exists (select 1 from club_schedule_slots sl
                    where sl.id = (v_u->>'slotId')::uuid and sl.schedule_id = p_schedule and sl.removed_at is null) then
      raise exception 'changed: a slot of the changes is no longer the schedule''s';
    end if;
    update rep_team_events e set
      club_schedule_slot_id = (v_u->>'slotId')::uuid,
      starts_at = (v_u->>'startsAt')::timestamptz, ends_at = (v_u->>'endsAt')::timestamptz,
      org_venue_id = (v_u->>'venueId')::uuid, org_venue_facility_id = nullif(v_u->>'facilityId', '')::uuid,
      location = nullif(v_u->>'location', ''), location_address = nullif(v_u->>'locationAddress', ''),
      field_number = nullif(v_u->>'fieldNumber', ''),
      -- Stage 2 (mig 546): the slot's part, from the slot (the update's slot was just proved the schedule's and live).
      section_mask = coalesce((select sl.section_mask from club_schedule_slots sl
                                 left join org_venue_facilities f on f.id = sl.facility_id
                                where sl.id = (v_u->>'slotId')::uuid
                                  and sl.facility_id is not distinct from nullif(v_u->>'facilityId', '')::uuid
                                  and section_mask_legal(sl.section_mask, coalesce(f.sections, 1::smallint))), 0),
      updated_at = now()
    where e.id = (v_u->>'eventId')::uuid and e.org_id = p_org
      and e.club_schedule_slot_id in (select id from club_schedule_slots where schedule_id = p_schedule);
    if found then v_upd := v_upd + 1; end if;
  end loop;

  if exists (select 1 from jsonb_array_elements(coalesce(p_inserts, '[]'::jsonb)) r
              where not exists (select 1 from club_schedule_slots sl
                                 where sl.id = (r->>'slotId')::uuid and sl.schedule_id = p_schedule and sl.removed_at is null)) then
    raise exception 'changed: a slot of the changes is no longer the schedule''s';
  end if;
  v_ins := club_practices_write(p_org, p_inserts);

  -- ── House league's half (11b; made whole by mig 393) ──
  -- 1 · Uses follow their time first, so a moved practice lands on its division's practice time.
  for v_u in select * from jsonb_array_elements(coalesce(p_league->'uses', '[]'::jsonb)) loop
    if not exists (select 1 from club_schedule_slots sl join club_schedule_slot_programs p on p.slot_id = sl.id
                    where sl.id = (v_u->>'to')::uuid and sl.schedule_id = p_schedule and sl.removed_at is null
                      and p.program = 'house_league') then
      raise exception 'changed: house league no longer holds the time a use moves to';
    end if;
    if exists (select 1 from league_slot_uses where slot_id = (v_u->>'to')::uuid) then continue; end if;
    update league_slot_uses u set slot_id = (v_u->>'to')::uuid, updated_at = now()
     where u.slot_id = (v_u->>'from')::uuid and u.org_id = p_org
       and u.slot_id in (select id from club_schedule_slots where schedule_id = p_schedule);
    if found then v_hl_uses := v_hl_uses + 1; end if;
  end loop;

  -- 2 · Cancel, so a moved practice never meets one the time no longer has on the same (slot, team).
  for v_u in select * from jsonb_array_elements(coalesce(p_league->'cancel', '[]'::jsonb)) loop
    update league_practices lp set status = 'cancelled', updated_at = now()
     where lp.id = (v_u #>> '{}')::uuid and lp.org_id = p_org and lp.status <> 'cancelled'
       and lp.club_schedule_slot_id in (select id from club_schedule_slots where schedule_id = p_schedule);
    if found then v_hl_cancel := v_hl_cancel + 1; end if;
  end loop;

  -- 3 · Move in place: onto a live house-league slot that is the practice's division's practice time, inside the slot, at
  -- the slot's own place. A cancelled row of the same team already on that slot gives way.
  for v_u in select * from jsonb_array_elements(coalesce(p_league->'updates', '[]'::jsonb)) loop
    select sl.* into v_to from club_schedule_slots sl join club_schedule_slot_programs p on p.slot_id = sl.id
     where sl.id = (v_u->>'slotId')::uuid and sl.schedule_id = p_schedule and sl.removed_at is null and p.program = 'house_league';
    if not found then raise exception 'changed: house league no longer holds the time a practice moves to'; end if;
    select lp.* into v_lp from league_practices lp
     where lp.id = (v_u->>'practiceId')::uuid and lp.org_id = p_org
       and lp.club_schedule_slot_id in (select id from club_schedule_slots where schedule_id = p_schedule)
     for update;
    if not found then continue; end if;
    if not exists (select 1 from league_slot_uses u where u.slot_id = v_to.id and u.kind = 'practices'
                     and u.season_id = v_lp.season_id and u.division_id is not distinct from v_lp.division_id)
       or (v_u->>'scheduledAt')::timestamptz < v_to.starts_at or (v_u->>'endsAt')::timestamptz > v_to.ends_at
       or (v_u->>'endsAt')::timestamptz <= (v_u->>'scheduledAt')::timestamptz then
      raise exception 'changed: a house-league practice no longer fits the time it moves to';
    end if;
    delete from league_practices where club_schedule_slot_id = v_to.id and team_id = v_lp.team_id and id <> v_lp.id and status = 'cancelled';
    update league_practices set
      club_schedule_slot_id = v_to.id,
      scheduled_at = (v_u->>'scheduledAt')::timestamptz, ends_at = (v_u->>'endsAt')::timestamptz,
      org_venue_id = v_to.org_venue_id, org_venue_facility_id = v_to.facility_id, section_mask = v_to.section_mask,
      location = coalesce(nullif(v_u->>'location', ''), location), status = 'scheduled', updated_at = now()
    where id = v_lp.id;
    v_hl_moved := v_hl_moved + 1;
  end loop;

  -- 3b · Games follow their division's game time (House League 9d-2b Part 5, mig 411; 9d2·13, 9d2·16). The uses moved
  -- first (1), so a carried game's link (league_games.slot_use_id, ON UPDATE CASCADE) already names its new slot. Every
  -- change the trigger records here (a published division's) is the CLUB's: the tray's "The club moved …" line, and no
  -- Undo back onto time the club gave away. Each division touched is locked with Publish and Changes to send, in one
  -- order, before any game is read.
  perform set_config('league.change_source', 'club', true);
  for v_id in
    select distinct g.division_id from league_games g
     where g.org_id = p_org and g.id in (
       select (m->>'gameId')::uuid from jsonb_array_elements(coalesce(p_league #> '{games,move}', '[]'::jsonb)) m
       union all select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p_league #> '{games,postpone}', '[]'::jsonb)) x
       union all select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p_league #> '{games,remove}', '[]'::jsonb)) x)
     order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended('league_schedule:' || v_id::text, 0));
  end loop;

  -- Moved with the time, by the slot's shift, at the slot's own place: onto the division's game time, inside the slot.
  for v_u in select * from jsonb_array_elements(coalesce(p_league #> '{games,move}', '[]'::jsonb)) loop
    select sl.* into v_to from club_schedule_slots sl join club_schedule_slot_programs p on p.slot_id = sl.id
     where sl.id = (v_u->>'slotId')::uuid and sl.schedule_id = p_schedule and sl.removed_at is null and p.program = 'house_league';
    if not found then raise exception 'changed: house league no longer holds the time a game moves to'; end if;
    select g.* into v_lg from league_games g where g.id = (v_u->>'gameId')::uuid and g.org_id = p_org for update;
    if not found then continue; end if;
    if v_lg.status <> 'scheduled' or v_lg.slot_use_id is distinct from v_to.id
       or not exists (select 1 from league_slot_uses u where u.slot_id = v_to.id and u.kind = 'games'
                        and u.season_id = v_lg.season_id and u.division_id is not distinct from v_lg.division_id)
       or (v_u->>'scheduledAt')::timestamptz < v_to.starts_at or (v_u->>'scheduledAt')::timestamptz >= v_to.ends_at
       or coalesce(nullif(v_u->>'endsAt', '')::timestamptz, (v_u->>'scheduledAt')::timestamptz) > v_to.ends_at then
      raise exception 'changed: a house-league game no longer fits the time it moves to';
    end if;
    update league_games set
      scheduled_at = (v_u->>'scheduledAt')::timestamptz, ends_at = nullif(v_u->>'endsAt', '')::timestamptz,
      org_venue_id = v_to.org_venue_id, org_venue_facility_id = v_to.facility_id, section_mask = v_to.section_mask,
      location = coalesce(nullif(v_u->>'location', ''), location), updated_at = now()
    where id = v_lg.id;
    v_g_moved := v_g_moved + 1;
  end loop;

  -- Stage 2 (mig 546): a game the time CARRIED without moving it — the same time and field, another part, so the plan
  -- writes nothing and only the use's key moved (1) — takes its slot's part. Never a change families are told of here.
  update league_games g set section_mask = sl.section_mask, updated_at = now()
    from club_schedule_slots sl
   where sl.id = g.slot_use_id and sl.schedule_id = p_schedule and sl.removed_at is null
     and g.org_id = p_org and g.status = 'scheduled' and g.scheduled_at > now()
     and g.org_venue_facility_id is not distinct from sl.facility_id and g.section_mask <> sl.section_mask;

  -- A published division's game on time that went: Needs a new date (postponed; Postpone's own write, its date kept as
  -- the "Was"), waiting in the division's Changes to send. Families hear once, from the league admin (9d2·16).
  for v_u in select * from jsonb_array_elements(coalesce(p_league #> '{games,postpone}', '[]'::jsonb)) loop
    select g.* into v_lg from league_games g
     where g.id = (v_u #>> '{}')::uuid and g.org_id = p_org
       and g.slot_use_id in (select id from club_schedule_slots where schedule_id = p_schedule)
     for update;
    if not found or v_lg.status <> 'scheduled' then continue; end if;
    update league_games set status = 'postponed', slot_use_id = null, updated_at = now() where id = v_lg.id;
    v_g_postponed := v_g_postponed + 1;
  end loop;

  -- A draft's game on time that went comes off the draft: nobody was told of it. A division published since the
  -- preview is refused, never a game families were told of deleted.
  for v_u in select * from jsonb_array_elements(coalesce(p_league #> '{games,remove}', '[]'::jsonb)) loop
    select g.* into v_lg from league_games g
     where g.id = (v_u #>> '{}')::uuid and g.org_id = p_org
       and g.slot_use_id in (select id from club_schedule_slots where schedule_id = p_schedule)
     for update;
    if not found or v_lg.status <> 'scheduled' then continue; end if;
    select d.schedule_published_at into v_published from league_divisions d where d.id = v_lg.division_id;
    if v_published is not null then
      raise exception 'changed: a house-league division''s schedule was published since';
    end if;
    delete from league_games where id = v_lg.id;
    v_g_removed := v_g_removed + 1;
  end loop;

  -- Only a game STILL TO COME and on refuses: a played, cancelled or postponed one keeps its record (its link clears).
  if exists (select 1 from league_games g join club_schedule_slots sl on sl.id = g.slot_use_id
              where sl.schedule_id = p_schedule and g.status = 'scheduled' and g.scheduled_at > now()
                and (sl.removed_at is not null
                     or not exists (select 1 from club_schedule_slot_programs p where p.slot_id = sl.id and p.program = 'house_league'))) then
    raise exception 'changed: a house-league game is still on time house league no longer has';
  end if;
  perform set_config('league.change_source', '', true);

  -- 4 · A use left on time house league no longer holds goes (a removed slot's goes with the slot, below). Only a practice
  -- STILL TO COME on such time refuses: one already held is history, kept, its link to a removed slot cleared.
  delete from league_slot_uses u
   where u.slot_id in (select sl.id from club_schedule_slots sl where sl.schedule_id = p_schedule and sl.removed_at is null
                         and not exists (select 1 from club_schedule_slot_programs p where p.slot_id = sl.id));
  if exists (select 1 from league_practices lp join club_schedule_slots sl on sl.id = lp.club_schedule_slot_id
              where sl.schedule_id = p_schedule and lp.status <> 'cancelled' and lp.scheduled_at > now()
                and (sl.removed_at is not null
                     or not exists (select 1 from club_schedule_slot_programs p where p.slot_id = sl.id))) then
    raise exception 'changed: a house-league practice is still on time house league no longer has';
  end if;
  update league_practices set club_schedule_slot_id = null, updated_at = now()
   where club_schedule_slot_id in (select id from club_schedule_slots where schedule_id = p_schedule and removed_at is not null);

  if exists (select 1 from rep_team_events e join club_schedule_slots sl on sl.id = e.club_schedule_slot_id
              where sl.schedule_id = p_schedule and sl.removed_at is not null and e.status <> 'cancelled') then
    raise exception 'changed: a practice is still on a removed slot';
  end if;
  update rep_team_events set club_schedule_slot_id = null, updated_at = now()
   where club_schedule_slot_id in (select id from club_schedule_slots where schedule_id = p_schedule and removed_at is not null);
  delete from club_schedule_slots where schedule_id = p_schedule and removed_at is not null;

  update club_schedules set
    version = version + 1, changed_since_sent = false, sent_at = now(), sent_by = p_actor,
    updated_by = p_actor, updated_at = now()
  where id = p_schedule;
  update club_schedule_sends set
    landed_at = now(), team_values = coalesce(p_log->'teamValues', '{}'::jsonb),
    billed = coalesce(p_log->'billed', '{}'::jsonb), settled = v_settled, allocation_id = v_alloc
   where id = p_send and schedule_id = p_schedule and org_id = p_org;
  if not found then raise exception 'changed: the send''s claim is gone'; end if;
  perform set_config('app.club_money_step', '', true);
  return jsonb_build_object('ok', true, 'allocationId', v_alloc, 'inserted', v_ins, 'updated', v_upd,
                            'cancelled', v_cancel, 'deleted', v_delete, 'settled', v_settled,
                            'league', jsonb_build_object('moved', v_hl_moved, 'cancelled', v_hl_cancel, 'uses', v_hl_uses,
                                                         'gamesMoved', v_g_moved, 'gamesPostponed', v_g_postponed,
                                                         'gamesRemoved', v_g_removed));
end;
$function$;

revoke all on function public.club_practices_write(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.club_practices_write(uuid, jsonb) to service_role;
revoke all on function public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb, jsonb) to service_role;

-- ── 3. The catch-up: a practice written on a part slot before this build takes its slot's part ──────────────────────
-- Only where the practice is still on its slot's field (a coach can't move a club practice; this keeps it to the slot's),
-- and only a part that field still offers: a field split anew after a schedule ended leaves its old practices as they are,
-- rather than 541's trigger refusing the whole migration (/dba 2026-11-26).
update public.rep_team_events e
   set section_mask = sl.section_mask
  from public.club_schedule_slots sl
  left join public.org_venue_facilities f on f.id = sl.facility_id
 where sl.id = e.club_schedule_slot_id
   and e.org_venue_facility_id is not distinct from sl.facility_id
   and e.section_mask <> sl.section_mask
   and public.section_mask_legal(sl.section_mask, coalesce(f.sections, 1::smallint));

notify pgrst, 'reload schema';

commit;
