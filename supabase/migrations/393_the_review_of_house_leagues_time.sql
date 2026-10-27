-- ---------------------------------------------------------------
-- Migration 393 — Club Tier Stage 11b, the /review of migration 392 (house league holds the club's time).
-- Plan: docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md §9 (the 11b status log).
--
-- WHY (four review lenses, 2026-10-27, on 076d4551d + ac5d68c5e):
--   • A league admin's division of a slot (league_slot_uses) cascaded from the PROGRAM row, so the club's edit took it at
--     once — before Send the changes, and beyond its reach: the carry to where the time moved found nothing.
--   • Send the changes refused for ever over a house-league practice that had already happened on a removed slot.
--   • A practice moved by Send the changes took its facility from the request, could land on time that isn't its
--     division's practice time or overhang its slot, revived a cancelled row and broke on the (slot, team) index.
--   • Practice time trusted the request's facility, read a slot's use from a snapshot taken before the slot's lock (a
--     concurrent change slipped past), let two hand-outs of one division race past "never twice at once", locked slots in
--     the caller's order (a deadlock), refused over a practice booked by hand, and wrote out-of-range settings as raw errors.
--   • division_id led no index on the two new tables.
--
-- WHAT CHANGES:
--   1. league_slot_uses.slot_id now references club_schedule_slots (ON DELETE CASCADE), not the program row: a use waits on
--      a slot house league no longer holds until Send the changes carries it to where the time moved (`p_league.uses`) or
--      clears it. Its check asks that house league holds the slot only when a use is made or moved.
--   2. club_schedule_apply_changes: house league's half carries uses, cancels, then moves practices in place onto the slot's
--      own place — only onto that division's practice time, inside the slot, clearing a cancelled row in the way; then the
--      uses left on time house league no longer holds go; only a practice STILL TO COME on such time refuses `changed`.
--   3. league_slot_uses_set / league_practices_hand_out: each slot locked in id order, then read again; a hand-out holds its
--      season's division for the step; its place is the slot's; "never twice at once" asks only the practices it writes,
--      against the team's other club-time practices; its settings refused in words (`bad_settings`).
--   4. Indexes on league_slot_uses (division_id) and league_practice_time (division_id).
-- Signatures unchanged. Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. A use belongs to the slot; it waits there until Send the changes ───────────────────────────────

alter table public.league_slot_uses drop constraint if exists league_slot_uses_slot_id_fkey;
alter table public.league_slot_uses
  add constraint league_slot_uses_slot_id_fkey foreign key (slot_id) references public.club_schedule_slots(id) on delete cascade;

create or replace function public.league_slot_uses_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- House league holds the slot when a use is made or moved there; a use already on a slot the club has since taken waits
  -- for Send the changes, which carries it on or clears it.
  if (tg_op = 'INSERT' or new.slot_id is distinct from old.slot_id)
     and not exists (select 1 from club_schedule_slot_programs p
                      where p.slot_id = new.slot_id and p.org_id = new.org_id and p.program = 'house_league') then
    raise exception 'use_slot: house league does not hold that slot';
  end if;
  if not exists (select 1 from league_seasons s where s.id = new.season_id and s.org_id = new.org_id) then
    raise exception 'use_season: that season is not this club''s';
  end if;
  if not exists (select 1 from league_divisions d where d.id = new.division_id and d.season_id = new.season_id) then
    raise exception 'use_division: that division is not the season''s';
  end if;
  return new;
end;
$$;

comment on table public.league_slot_uses is
  'How a league admin divided house league''s time (Club Tier Stage 11b, migs 392–393; 9d2·5, 9d2·15): one use per house-league slot — a division''s game time (`games`, which 9d-2a''s Generate games fills) or its practice time (`practices`, which Practice time hands out to its teams). Owned by a SEASON, not the program. A house-league slot with no row is "Not given yet". Cascades from the SLOT (mig 393): when the club takes a slot back, its use waits until Send the changes carries it to where the time moved or clears it. Written only by league_slot_uses_set and club_schedule_apply_changes.';

create index if not exists league_slot_uses_division_idx on public.league_slot_uses (division_id);
create index if not exists league_practice_time_division_idx on public.league_practice_time (division_id);

-- ── 2. Send the changes: house league's half, made whole ──────────────────────────────────────────────

-- 392's step, exactly, with house league's half made whole (uses first, then cancel, then moves checked against the
-- slot's use and place; leftover uses go; only a practice still to come blocks).
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
                            'league', jsonb_build_object('moved', v_hl_moved, 'cancelled', v_hl_cancel, 'uses', v_hl_uses));
end;
$$;

-- ── 3. The league admin's two writes, locked in order and read again ──────────────────────────────────

create or replace function public.league_slot_uses_set(
  p_org uuid, p_season uuid, p_actor uuid, p_slots uuid[], p_division uuid, p_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text;
  v_slot    uuid;
  v_n       integer := 0;
  v_removed integer := 0;
begin
  if p_kind is not null and p_kind not in ('games', 'practices') then
    raise exception 'use_kind: a use is games or practices';
  end if;
  if p_kind is not null and p_division is null then
    raise exception 'use_division: a use names its division';
  end if;
  v_code := league_time_refusal(p_org, p_season, p_division);
  if v_code is not null then return jsonb_build_object('ok', false, 'code', v_code); end if;

  -- Each slot locked in id order (two writers never wait on each other in a circle), THEN read again: a read joined to
  -- the lock would see the program and the use as they were before the wait.
  for v_slot in select distinct s from unnest(coalesce(p_slots, '{}'::uuid[])) s order by 1 loop
    perform 1 from club_schedule_slots where id = v_slot and org_id = p_org for update;
  end loop;
  foreach v_slot in array coalesce(p_slots, '{}'::uuid[]) loop
    if not exists (select 1 from club_schedule_slots sl
                     join club_schedules s on s.id = sl.schedule_id
                     join club_schedule_slot_programs p on p.slot_id = sl.id
                    where sl.id = v_slot and sl.org_id = p_org and sl.removed_at is null and s.state = 'final'
                      and p.program = 'house_league')
       or exists (select 1 from league_slot_uses u where u.slot_id = v_slot and u.season_id <> p_season) then
      return jsonb_build_object('ok', false, 'code', 'changed', 'slotId', v_slot);
    end if;
  end loop;

  foreach v_slot in array coalesce(p_slots, '{}'::uuid[]) loop
    -- Practices that haven't started go when the slot stops being their division's practice time.
    delete from league_practices lp
     where lp.club_schedule_slot_id = v_slot and lp.org_id = p_org and lp.scheduled_at > now()
       and not coalesce(p_kind = 'practices' and lp.division_id is not distinct from p_division, false);
    get diagnostics v_n = row_count;
    v_removed := v_removed + v_n;
    if p_kind is null then
      delete from league_slot_uses where slot_id = v_slot;
    else
      insert into league_slot_uses (slot_id, org_id, season_id, division_id, kind, created_by)
      values (v_slot, p_org, p_season, p_division, p_kind, p_actor)
      on conflict (slot_id) do update set division_id = excluded.division_id, kind = excluded.kind, updated_at = now();
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'slots', coalesce(cardinality(p_slots), 0), 'practicesRemoved', v_removed);
end;
$$;

-- Practice time (frame h1). `p_rows`: [{ slotId, teamId, scheduledAt, endsAt, location }] — the engine's fair share, each
-- inside its slot; its place is the SLOT's (a request never names a facility). `p_settings`: { practiceMinutes 15–240,
-- teamsAtOnce 1–4 } — refused in words (`bad_settings`) out of range. One hand-out of a division at a time.
create or replace function public.league_practices_hand_out(
  p_org uuid, p_season uuid, p_division uuid, p_actor uuid, p_slots uuid[], p_rows jsonb, p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code    text;
  v_slot    uuid;
  v_row     jsonb;
  v_sl      club_schedule_slots%rowtype;
  v_cap     integer;
  v_minutes integer;
  v_written integer := 0;
  v_removed integer := 0;
  v_team    text;
begin
  v_code := league_time_refusal(p_org, p_season, p_division);
  if v_code is not null then return jsonb_build_object('ok', false, 'code', v_code); end if;
  if p_division is null then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if coalesce(p_settings->>'teamsAtOnce', '1') !~ '^[1-4]$'
     or (p_settings ? 'practiceMinutes' and coalesce(p_settings->>'practiceMinutes', '') !~ '^[0-9]{2,3}$') then
    return jsonb_build_object('ok', false, 'code', 'bad_settings');
  end if;
  v_cap := coalesce((p_settings->>'teamsAtOnce')::integer, 1);
  v_minutes := (p_settings->>'practiceMinutes')::integer;
  if v_minutes is not null and (v_minutes < 15 or v_minutes > 240) then
    return jsonb_build_object('ok', false, 'code', 'bad_settings');
  end if;

  -- One hand-out of a division at a time: "never twice at once" reads the other slots' practices, which a concurrent
  -- hand-out on other slots would be writing.
  perform pg_advisory_xact_lock(hashtextextended('league_practices_hand_out:' || p_season::text || ':' || p_division::text, 0));
  for v_slot in select distinct s from unnest(coalesce(p_slots, '{}'::uuid[])) s order by 1 loop
    perform 1 from club_schedule_slots where id = v_slot and org_id = p_org for update;
  end loop;
  foreach v_slot in array coalesce(p_slots, '{}'::uuid[]) loop
    if not exists (select 1 from club_schedule_slots sl
                     join club_schedule_slot_programs p on p.slot_id = sl.id
                     join league_slot_uses u on u.slot_id = sl.id
                    where sl.id = v_slot and sl.org_id = p_org and sl.removed_at is null and p.program = 'house_league'
                      and u.season_id = p_season and u.division_id = p_division and u.kind = 'practices') then
      return jsonb_build_object('ok', false, 'code', 'changed', 'slotId', v_slot);
    end if;
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    if not ((v_row->>'slotId')::uuid = any (coalesce(p_slots, '{}'::uuid[]))) then
      return jsonb_build_object('ok', false, 'code', 'changed', 'slotId', v_row->>'slotId');
    end if;
    if not exists (select 1 from league_teams t where t.id = (v_row->>'teamId')::uuid
                                                  and t.season_id = p_season and t.division_id = p_division) then
      return jsonb_build_object('ok', false, 'code', 'changed', 'teamId', v_row->>'teamId');
    end if;
    if not exists (select 1 from club_schedule_slots sl
                    where sl.id = (v_row->>'slotId')::uuid
                      and (v_row->>'scheduledAt')::timestamptz >= sl.starts_at
                      and (v_row->>'endsAt')::timestamptz <= sl.ends_at
                      and (v_row->>'endsAt')::timestamptz > (v_row->>'scheduledAt')::timestamptz) then
      return jsonb_build_object('ok', false, 'code', 'changed', 'slotId', v_row->>'slotId');
    end if;
  end loop;

  delete from league_practices lp
   where lp.club_schedule_slot_id = any (coalesce(p_slots, '{}'::uuid[])) and lp.org_id = p_org and lp.scheduled_at > now()
     and not exists (select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
                      where (r->>'slotId')::uuid = lp.club_schedule_slot_id and (r->>'teamId')::uuid = lp.team_id);
  get diagnostics v_removed = row_count;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    select * into v_sl from club_schedule_slots where id = (v_row->>'slotId')::uuid;
    insert into league_practices (season_id, division_id, team_id, org_id, scheduled_at, ends_at, location, status,
                                  org_venue_id, org_venue_facility_id, club_schedule_slot_id)
    values (p_season, p_division, (v_row->>'teamId')::uuid, p_org,
            (v_row->>'scheduledAt')::timestamptz, (v_row->>'endsAt')::timestamptz, nullif(v_row->>'location', ''),
            'scheduled', v_sl.org_venue_id, v_sl.facility_id, v_sl.id)
    on conflict (club_schedule_slot_id, team_id) where club_schedule_slot_id is not null
    do update set status = 'scheduled', scheduled_at = excluded.scheduled_at, ends_at = excluded.ends_at,
                  location = excluded.location, org_venue_id = excluded.org_venue_id,
                  org_venue_facility_id = excluded.org_venue_facility_id, division_id = excluded.division_id,
                  updated_at = now();
    v_written := v_written + 1;
  end loop;

  -- Teams at once: no instant on a slot holds more live practices than the setting.
  if exists (select 1 from league_practices a
              where a.club_schedule_slot_id = any (coalesce(p_slots, '{}'::uuid[])) and a.status <> 'cancelled'
                and (select count(*) from league_practices b
                      where b.club_schedule_slot_id = a.club_schedule_slot_id and b.status <> 'cancelled'
                        and b.scheduled_at <= a.scheduled_at and b.ends_at > a.scheduled_at) > v_cap) then
    raise exception 'slot_full: a slot holds % practice(s) at once', v_cap;
  end if;
  -- A team never in two of house league's club-time practices at once — asked of the practices THIS hand-out wrote. A
  -- practice booked by hand is the league admin's own call (the clash read warns of it), never a refusal here.
  select t.name into v_team
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
    join league_practices a on a.club_schedule_slot_id = (r->>'slotId')::uuid and a.team_id = (r->>'teamId')::uuid
    join league_practices b on b.team_id = a.team_id and b.id <> a.id and b.status <> 'cancelled'
                           and b.club_schedule_slot_id is not null
    join league_teams t on t.id = a.team_id
   where a.scheduled_at < b.ends_at and b.scheduled_at < a.ends_at
   limit 1;
  if found then
    raise exception 'team_twice: % has two practices at once', v_team;
  end if;

  if v_minutes is not null then
    insert into league_practice_time (season_id, division_id, org_id, practice_minutes, teams_at_once, updated_by)
    values (p_season, p_division, p_org, v_minutes, v_cap, p_actor)
    on conflict (season_id, division_id) do update set practice_minutes = excluded.practice_minutes,
      teams_at_once = excluded.teams_at_once, updated_by = excluded.updated_by, updated_at = now();
  end if;
  return jsonb_build_object('ok', true, 'written', v_written, 'removed', v_removed);
end;
$$;

revoke all on function
  public.league_slot_uses_check(),
  public.league_slot_uses_set(uuid, uuid, uuid, uuid[], uuid, text),
  public.league_practices_hand_out(uuid, uuid, uuid, uuid, uuid[], jsonb, jsonb),
  public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function
  public.league_slot_uses_set(uuid, uuid, uuid, uuid[], uuid, text),
  public.league_practices_hand_out(uuid, uuid, uuid, uuid, uuid[], jsonb, jsonb),
  public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb, jsonb)
  to service_role;

COMMIT;
