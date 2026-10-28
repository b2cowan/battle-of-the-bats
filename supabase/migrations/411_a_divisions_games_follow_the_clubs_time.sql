-- Migration 411 — House League Stage 9d-2b Part 5: a division's games follow the club's time.
--
-- WHY (rulings 9d2·13, 9d2·16; plan HOUSE_LEAGUE_STAGE9_PLAN.md §0h): when the club's Send the changes moves house
-- league's time, mig 393's step re-keys a division's game-time use to its new slot and mig 409's ON UPDATE CASCADE carries
-- each game's link — but nothing moved the game itself. And when the club took the time back, the use went and the games
-- were left on time a rep team now holds, saying nothing. This migration makes the step land the games too, from the
-- plan the owner saw in the preview (`p_league.games`, lib/club-schedule-league-plan.ts):
--   · move     — a game moved by its slot's shift, at the slot's place (refused `changed` if it no longer fits);
--   · postpone — a PUBLISHED division's game on time that went: Needs a new date, waiting in Changes to send;
--   · remove   — a DRAFT division's game on time that went: off the draft (refused `changed` if published since).
-- Played, started, cancelled and already-postponed games stay as they are. The step sets `league.change_source = 'club'`
-- so mig 409's trigger records each published game's change as the club's.
--
-- And league_game_undo refuses a held change the club made ('club'): undoing it would put a game back on time the club
-- gave away (9d2·3's amendment — no house-league screen chooses time the club did not allocate).
--
-- Function-only: INVISIBLE to check:migrations. Re-runnable. Needs 393 and 409 first. club_schedule_apply_changes is
-- mig 393's text exactly, with the games block (3b), five declarations and the games counts in the return added.

BEGIN;

-- ── 1. Send the changes: house league's half, games included ──────────────────────────────────────

create or replace function public.club_schedule_apply_changes(
  p_org uuid, p_schedule uuid, p_actor uuid, p_version integer,
  p_inserts jsonb, p_updates jsonb, p_retire uuid[], p_bill jsonb, p_send uuid, p_log jsonb, p_losses jsonb,
  p_league jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
      field_number = nullif(v_u->>'fieldNumber', ''), updated_at = now()
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
      org_venue_id = v_to.org_venue_id, org_venue_facility_id = v_to.facility_id,
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
      org_venue_id = v_to.org_venue_id, org_venue_facility_id = v_to.facility_id,
      location = coalesce(nullif(v_u->>'location', ''), location), updated_at = now()
    where id = v_lg.id;
    v_g_moved := v_g_moved + 1;
  end loop;

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
$$;

-- ── 2. Undo refuses the club's change ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.league_game_undo(p_org uuid, p_season uuid, p_game uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_game league_games%ROWTYPE; v_first league_game_changes%ROWTYPE; v_b jsonb;
BEGIN
  SELECT * INTO v_game FROM league_games g WHERE g.id = p_game AND g.season_id = p_season AND g.org_id = p_org;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('league_schedule:' || v_game.division_id::text, 0));
  SELECT * INTO v_first FROM league_game_changes c
   WHERE c.game_id = p_game AND c.sent_at IS NULL ORDER BY c.created_at, c.id LIMIT 1;
  IF NOT FOUND THEN RETURN 'nothing'; END IF;
  IF v_game.status = 'completed' THEN RETURN 'played'; END IF;
  -- 9d-2b Part 5: a change the CLUB made (its game time moved or went, 9d2·13 / 9d2·16) is never undone here: the game
  -- would go back onto time the club gave away, which no house-league screen may choose (9d2·3). The league admin gives
  -- it a new date instead.
  IF EXISTS (SELECT 1 FROM league_game_changes c WHERE c.game_id = p_game AND c.sent_at IS NULL AND c.source = 'club') THEN
    RETURN 'club';
  END IF;

  IF v_first.kind = 'added' THEN
    DELETE FROM league_games g WHERE g.id = p_game;
    RETURN NULL;
  END IF;

  v_b := v_first.before;
  UPDATE league_games g SET
    scheduled_at = (v_b->>'scheduledAt')::timestamptz, ends_at = (v_b->>'endsAt')::timestamptz,
    location = v_b->>'location', org_venue_id = (v_b->>'venueId')::uuid,
    org_venue_facility_id = (v_b->>'facilityId')::uuid, status = v_b->>'status',
    moved_from = (v_b->>'movedFrom')::timestamptz, updated_at = now()
   WHERE g.id = p_game;
  -- The put-back recorded itself as one more change; with the rest it goes (the game is as families last heard it).
  DELETE FROM league_game_changes c WHERE c.game_id = p_game AND c.sent_at IS NULL;
  RETURN NULL;
END $$;

revoke all on function
  public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb, jsonb),
  public.league_game_undo(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function
  public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb, jsonb),
  public.league_game_undo(uuid, uuid, uuid)
  to service_role;

COMMIT;
