-- 553_a_part_beside_takes_the_next_team.sql
--
-- Club schedules Stage 2, Session 2E part 2 (owner 2026-11-27, the 2E part 1 review's question B, ruled "one per side,
-- extras unplaced" and "build it now"; plan docs/projects/active/SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md, the "2E part 2"
-- line). Round 2 Ask 5 A: in house league a part holds one team.
--
-- THE GAP: Send the changes carries a house-league use from a lost slot to ONE gained slot. When the club turns a
-- whole-field slot holding two teams at once into sides, both practices were carried onto side A and nothing checked the
-- one-team rule; side B arrived as "not given yet". The plan (lib/club-schedule-league-plan.ts) now puts the first
-- practice on the side its use went to and the next on a free part beside it, and one with no part left is cancelled,
-- as any practice that no longer fits. That second part needs the division's practice time, or step 3 refuses the move.
--
-- WHAT CHANGES (the body is the live one on dev, read with pg_get_functiondef 2026-11-27, equal to mig 546's, plus one
-- loop): club_schedule_apply_changes(…) reads p_league->'copies' ({from, to}, after step 1): each makes a use on `to` the
-- same season, division and kind ('practices' only) as the use now on `from`, when house league holds `to` on this
-- schedule and nothing uses it yet. league_slot_uses_check (its trigger) still proves the slot house league's and the
-- division the season's. A send with no `copies` (every send with no split field) runs exactly as before.
-- Signature unchanged: grants as live (service_role only). Function-only, so check:migrations can't see it
-- (MANUAL_PROD_STEPS.json).
--
-- Idempotent (create or replace).

begin;
set local lock_timeout = '15s';

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

  -- 1b · A part beside (mig 553; owner 2026-11-27, round 2 Ask 5 A: a part holds one team). A whole-field slot holding
  -- two teams at once, carried onto a side by step 1, keeps one team a part: the plan names a free part beside the carried
  -- one (same field, start and end) for the next practice, and it becomes the same division's practice time, copied from
  -- the use step 1 just carried there (`from` is the carried part). Step 3 then proves the practice fits it, as any move.
  for v_u in select * from jsonb_array_elements(coalesce(p_league->'copies', '[]'::jsonb)) loop
    if not exists (select 1 from club_schedule_slots sl join club_schedule_slot_programs p on p.slot_id = sl.id
                    where sl.id = (v_u->>'to')::uuid and sl.schedule_id = p_schedule and sl.removed_at is null
                      and p.program = 'house_league') then
      raise exception 'changed: house league no longer holds the time a use moves to';
    end if;
    if exists (select 1 from league_slot_uses where slot_id = (v_u->>'to')::uuid) then continue; end if;
    insert into league_slot_uses (slot_id, org_id, season_id, division_id, kind, created_by)
    select (v_u->>'to')::uuid, u.org_id, u.season_id, u.division_id, u.kind, p_actor
      from league_slot_uses u
     where u.slot_id = (v_u->>'from')::uuid and u.org_id = p_org and u.kind = 'practices'
       and u.slot_id in (select id from club_schedule_slots where schedule_id = p_schedule)
       -- Beside it: the same field, start and end (step 3 proves the time, not the field) (/dba 2026-11-27).
       and exists (select 1 from club_schedule_slots f join club_schedule_slots t on t.id = (v_u->>'to')::uuid
                    where f.id = u.slot_id and t.facility_id is not distinct from f.facility_id
                      and t.starts_at = f.starts_at and t.ends_at = f.ends_at)
    -- A use given to the part meanwhile (league_slot_uses_apply locks the slot, not the schedule): step 3 judges it.
    on conflict (slot_id) do nothing;
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

revoke all on function public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';

commit;
