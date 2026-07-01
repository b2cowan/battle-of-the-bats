-- Migration 169: atomic accept-to-roster + optional dues (Coaches Portal Tryouts, Phase 2B.4).
--
-- Turns an OFFERED tryout registration into a roster player, flips the registration to 'accepted',
-- and (optionally) creates the player's dues schedule + installments — all in ONE transaction.
--
-- Why an RPC: the pre-existing admin accept ran two separate, non-transactional writes (roster insert
-- then status update); a mid-way failure left a roster row with a stale 'offered' status. Adding money
-- (dues) to that flow makes a half-complete write an unrecoverable integrity problem. This mirrors the
-- codebase's Tier-2 convention for integrity-critical multi-table writes: create_accounting_transfer
-- (mig 016) and complete_team_workspace_ownership_transfer (mig 067).
--
-- Caller-agnostic on purpose: invoked today by the logged-in admin/coach accept paths (via
-- supabaseAdmin.rpc), and reused by 2B.5's token-authenticated guardian email-accept. Auth is enforced
-- by the calling route; this function only guards the state machine (must be 'offered') + dues shape.
--
-- Function-only migration: NO new columns/tables — check:dictionary is unaffected. Snapshots refreshed
-- in the same unit of work per the schema=dictionary guardrail.

create or replace function public.accept_tryout_and_create_dues(
  p_reg_id uuid,
  p_roster jsonb,   -- optional roster fields: { playerNumber?, primaryPosition?, jerseySize? }
  p_dues   jsonb    -- optional dues: { totalAmount, notes?, installments: [{ installmentNumber?, amount, dueDate }] }
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg           public.rep_tryout_registrations%rowtype;
  v_player_id     uuid;
  v_display_order int;
  v_schedule_id   uuid;
  v_total         numeric;  -- unconstrained, matching rep_player_dues_schedules.total_amount (no truncation)
  v_sum           numeric;
  v_min           numeric;
  v_now           timestamptz := now();
begin
  -- Lock the registration row and assert it is still awaiting an accept decision. The FOR UPDATE +
  -- status guard makes a concurrent double-accept safe: the second caller re-reads 'accepted' and
  -- raises, so no duplicate roster row is created.
  select * into v_reg
  from public.rep_tryout_registrations
  where id = p_reg_id
  for update;

  if not found then
    raise exception 'tryout_accept_reg_not_found';
  end if;

  if v_reg.status <> 'offered' then
    raise exception 'tryout_accept_not_offered';
  end if;

  -- Append the new player at the end of the manual roster order (parity with createRepRosterPlayer).
  select coalesce(max(display_order), -1) + 1 into v_display_order
  from public.rep_roster_players
  where program_year_id = v_reg.program_year_id
    and team_id = v_reg.team_id;

  insert into public.rep_roster_players (
    program_year_id, team_id, org_id, source, tryout_registration_id,
    player_first_name, player_last_name, player_date_of_birth,
    player_number, primary_position, jersey_size,
    guardian_first_name, guardian_last_name, guardian_email, guardian_phone,
    display_order
  ) values (
    v_reg.program_year_id, v_reg.team_id, v_reg.org_id, 'tryout', v_reg.id,
    v_reg.player_first_name, v_reg.player_last_name, v_reg.player_date_of_birth,
    nullif(trim(coalesce(p_roster->>'playerNumber', '')), ''),
    nullif(trim(coalesce(p_roster->>'primaryPosition', '')), ''),
    nullif(trim(coalesce(p_roster->>'jerseySize', '')), ''),
    v_reg.guardian_first_name, v_reg.guardian_last_name, v_reg.guardian_email, v_reg.guardian_phone,
    v_display_order
  )
  returning id into v_player_id;

  update public.rep_tryout_registrations
  set status = 'accepted', updated_at = v_now
  where id = v_reg.id;

  -- Optional dues: skip entirely when p_dues is null (accept-without-fees). When present, validate the
  -- shape defensively (the route also validates) so a bad payload rolls back the whole accept rather
  -- than half-landing a player with a broken schedule.
  if p_dues is not null then
    v_total := (p_dues->>'totalAmount')::numeric;
    if v_total is null or v_total <= 0 then
      raise exception 'tryout_accept_dues_invalid';
    end if;
    if jsonb_typeof(p_dues->'installments') <> 'array'
       or jsonb_array_length(p_dues->'installments') < 1 then
      raise exception 'tryout_accept_dues_invalid';
    end if;

    -- Sum must match the total (within a cent) AND every installment must be positive. The route
    -- validates the same rules; this is the transactional backstop so a bad payload rolls back the
    -- whole accept rather than half-landing a player with a broken (e.g. negative) schedule.
    select coalesce(sum(amt), 0), coalesce(min(amt), 0) into v_sum, v_min
    from (select (elem->>'amount')::numeric as amt
          from jsonb_array_elements(p_dues->'installments') elem) s;
    if v_min <= 0 or abs(v_sum - v_total) > 0.01 then
      raise exception 'tryout_accept_dues_invalid';
    end if;

    insert into public.rep_player_dues_schedules (
      program_year_id, player_id, team_id, org_id, total_amount, notes
    ) values (
      v_reg.program_year_id, v_player_id, v_reg.team_id, v_reg.org_id, v_total,
      nullif(trim(coalesce(p_dues->>'notes', '')), '')
    )
    returning id into v_schedule_id;

    insert into public.rep_player_dues_installments (
      schedule_id, player_id, installment_number, amount, due_date, org_id, team_id
    )
    select
      v_schedule_id,
      v_player_id,
      ord::int,   -- positional (1-based array order); ignores any client-supplied installmentNumber
      (elem->>'amount')::numeric,
      (elem->>'dueDate')::date,
      v_reg.org_id,
      v_reg.team_id
    from jsonb_array_elements(p_dues->'installments') with ordinality as t(elem, ord);
  end if;

  return jsonb_build_object(
    'ok', true,
    'playerId', v_player_id,
    'regId', v_reg.id,
    'scheduleId', v_schedule_id
  );
end;
$$;

comment on function public.accept_tryout_and_create_dues(uuid, jsonb, jsonb) is
  'Atomically accepts an offered tryout registration: inserts the roster player, sets status=accepted, '
  'and optionally creates the dues schedule + installments. Guards status=offered under a row lock. '
  'Caller (admin/coach/2B.5 token) enforces auth; this enforces the state machine. Phase 2B.4.';
