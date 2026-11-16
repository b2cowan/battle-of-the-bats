-- bill-rates-fixture.sql — A schedule on several permits, Session C (mig 489; plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §8
-- Phase 3; /dba Findings #50 and #51). A bill keeps the rate each permit behind it was billed at, and its pricing mode is frozen
-- once it is made.
--
-- DEV ONLY. Run:  node scripts/db-query.mjs --dev -f tests/sql/bill-rates-fixture.sql
-- ONE DO block that ENDS BY RAISING: 'BILL RATES FIXTURE OK: n/n' on success, 'BILL RATES FIXTURE FAIL …' at the first broken
-- rule. Either way the raise rolls back every row it wrote.
--
--   1. only the definer wrappers can write rates: the service role can run the three _priced functions, not the writer;
--   2. a refused Finalize (a stale version) writes no rates;
--   3. Send the changes (_priced, nothing to change) keeps a new permit's rate with the send that first billed it, and a permit
--      already kept keeps its first rate (on conflict do nothing);
--   4. a rate is refused for another club's permit, for a send of another schedule, and at zero;
--   5. the mode can change while the bill is not made, and is refused once it is (club_schedules_bill_price_mode_frozen);
--   6. a refused late bill puts the mode back (the wrapper set it before the inner function refused).
do $fixture$
declare
  v_org uuid; v_other uuid; p_a uuid; p_b uuid; p_x uuid;
  v_draft uuid; v_final uuid; v_late uuid; v_alloc uuid; v_send uuid; v_send2 uuid;
  v_ver integer; v_res jsonb; v_code text; v_n integer; v_scale numeric;
  v_ok integer := 0;
begin
  insert into organizations(name, slug, plan_id) values ('CHECK rates', 'check-rates-' || substr(md5(random()::text), 1, 10), 'club')
    returning id into v_org;
  insert into organizations(name, slug, plan_id) values ('CHECK rates other', 'check-rates-o-' || substr(md5(random()::text), 1, 10), 'club')
    returning id into v_other;
  insert into org_permits(org_id, name, starts_on, ends_on) values (v_org, 'Town A spring', date '2027-03-02', date '2027-05-29') returning id into p_a;
  insert into org_permits(org_id, name, starts_on, ends_on) values (v_org, 'Town B summer', date '2027-06-01', date '2027-08-29') returning id into p_b;
  insert into org_permits(org_id, name, starts_on, ends_on) values (v_other, 'Not ours', date '2027-03-01', date '2027-06-30') returning id into p_x;

  -- 1. who may write
  if not has_function_privilege('service_role', 'public.club_schedule_finalize_priced(uuid, uuid, uuid, integer, jsonb, jsonb, numeric, uuid, jsonb, jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.club_schedule_bill_late_priced(uuid, uuid, uuid, integer, jsonb, jsonb, numeric, uuid, jsonb, text, jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.club_schedule_apply_changes_priced(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb, jsonb, jsonb)', 'execute')
     or has_function_privilege('service_role', 'public.club_schedule_bill_rates_put(uuid, uuid, jsonb, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.club_schedule_finalize_priced(uuid, uuid, uuid, integer, jsonb, jsonb, numeric, uuid, jsonb, jsonb)', 'execute') then
    raise exception 'BILL RATES FIXTURE FAIL 1: the writer is reachable, or a wrapper is not';
  end if;
  v_ok := v_ok + 1;

  -- 2. a refused Finalize writes nothing
  insert into club_schedules (org_id, name, starts_on, ends_on) values (v_org, 'CHECK draft', date '2027-03-02', date '2027-08-29')
    returning id, version into v_draft, v_ver;
  insert into club_schedule_sends (org_id, schedule_id, kind) values (v_org, v_draft, 'final') returning id into v_send;
  v_res := club_schedule_finalize_priced(v_org, v_draft, null, v_ver + 7, '[]'::jsonb,
    jsonb_build_object('description', 'CHECK bill', 'lineId', null, 'splits', '[]'::jsonb), 2, v_send, '{}'::jsonb,
    jsonb_build_array(jsonb_build_object('permitId', p_a, 'permitName', 'Town A spring', 'scale', 2)));
  if coalesce((v_res->>'ok')::boolean, false) or v_res->>'code' <> 'changed' then
    raise exception 'BILL RATES FIXTURE FAIL 2: a stale Finalize was not refused (%)', v_res; end if;
  if exists (select 1 from club_schedule_bill_rates where schedule_id = v_draft) then
    raise exception 'BILL RATES FIXTURE FAIL 2: a refused Finalize kept rates'; end if;
  v_ok := v_ok + 1;

  -- 3. Send the changes keeps a new permit's rate with its send; a kept permit keeps its first rate
  insert into rep_cost_allocations (org_id, description, total_amount) values (v_org, 'CHECK bill', 100) returning id into v_alloc;
  insert into club_schedules (org_id, name, starts_on, ends_on, state, bill_scale, allocation_id)
    values (v_org, 'CHECK final', date '2027-03-02', date '2027-08-29', 'final', 1.5, v_alloc) returning id, version into v_final, v_ver;
  insert into club_schedule_bill_rates (org_id, schedule_id, permit_id, permit_name, scale) values (v_org, v_final, p_a, 'Town A spring', 1.5);
  insert into club_schedule_sends (org_id, schedule_id, kind) values (v_org, v_final, 'changes') returning id into v_send2;
  v_res := club_schedule_apply_changes_priced(v_org, v_final, null, v_ver, '[]'::jsonb, '[]'::jsonb, '{}'::uuid[], null, v_send2,
    jsonb_build_object('teamValues', '{}'::jsonb), '[]'::jsonb, null,
    jsonb_build_array(jsonb_build_object('permitId', p_a, 'permitName', 'Town A spring', 'scale', 9),
                      jsonb_build_object('permitId', p_b, 'permitName', 'Town B summer', 'scale', 2.25)));
  if not coalesce((v_res->>'ok')::boolean, false) then raise exception 'BILL RATES FIXTURE FAIL 3: the changes refused (%)', v_res; end if;
  select scale into v_scale from club_schedule_bill_rates where schedule_id = v_final and permit_id = p_a;
  if v_scale <> 1.5 then raise exception 'BILL RATES FIXTURE FAIL 3: a kept rate changed (%)', v_scale; end if;
  if not exists (select 1 from club_schedule_bill_rates where schedule_id = v_final and permit_id = p_b and scale = 2.25 and first_billed_send_id = v_send2) then
    raise exception 'BILL RATES FIXTURE FAIL 3: the new permit''s rate was not kept with its send'; end if;
  v_ok := v_ok + 1;

  -- 4. the same-club floor and the scale's floor
  v_code := 'none';
  begin
    insert into club_schedule_bill_rates (org_id, schedule_id, permit_id, permit_name, scale) values (v_org, v_final, p_x, 'Not ours', 1);
  exception when raise_exception then v_code := split_part(SQLERRM, ':', 1); end;
  if v_code <> 'bill_rate' then raise exception 'BILL RATES FIXTURE FAIL 4: another club''s permit was kept (%)', v_code; end if;
  v_code := 'none';
  begin
    insert into club_schedule_bill_rates (org_id, schedule_id, permit_id, permit_name, scale, first_billed_send_id)
      values (v_org, v_final, null, 'Typed', 1, v_send);
  exception when raise_exception then v_code := split_part(SQLERRM, ':', 1); end;
  if v_code <> 'bill_rate' then raise exception 'BILL RATES FIXTURE FAIL 4: another schedule''s send was taken (%)', v_code; end if;
  v_code := 'none';
  begin
    insert into club_schedule_bill_rates (org_id, schedule_id, permit_id, permit_name, scale) values (v_org, v_draft, p_b, 'Town B summer', 0);
  exception when check_violation then v_code := 'refused'; end;
  if v_code <> 'refused' then raise exception 'BILL RATES FIXTURE FAIL 4: a zero rate was kept'; end if;
  v_ok := v_ok + 1;

  -- 5. the mode freezes with the bill
  update club_schedules set bill_price_mode = 'one_rate' where id = v_draft;
  if (select bill_price_mode from club_schedules where id = v_draft) <> 'one_rate' then
    raise exception 'BILL RATES FIXTURE FAIL 5: a draft''s mode did not change'; end if;
  v_code := 'none';
  begin
    update club_schedules set bill_price_mode = 'one_rate' where id = v_final;
  exception when raise_exception then v_code := split_part(SQLERRM, ':', 1); end;
  if v_code <> 'bill_terms' then raise exception 'BILL RATES FIXTURE FAIL 5: a made bill''s mode changed (%)', v_code; end if;
  v_ok := v_ok + 1;

  -- 6. a refused late bill puts the mode back
  insert into club_schedules (org_id, name, starts_on, ends_on, state, changed_since_sent)
    values (v_org, 'CHECK late', date '2027-03-02', date '2027-08-29', 'final', true) returning id, version into v_late, v_ver;
  v_res := club_schedule_bill_late_priced(v_org, v_late, null, v_ver, jsonb_build_object('plan', 'one'),
    jsonb_build_object('description', 'CHECK late bill', 'splits', '[]'::jsonb), 2, null, '{}'::jsonb, 'one_rate',
    jsonb_build_array(jsonb_build_object('permitId', p_a, 'permitName', 'Town A spring', 'scale', 2)));
  if v_res->>'code' <> 'changes_waiting' then raise exception 'BILL RATES FIXTURE FAIL 6: the late bill was not refused (%)', v_res; end if;
  if (select bill_price_mode from club_schedules where id = v_late) <> 'each_permit'
     or exists (select 1 from club_schedule_bill_rates where schedule_id = v_late) then
    raise exception 'BILL RATES FIXTURE FAIL 6: a refused late bill kept its mode or its rates'; end if;
  v_ok := v_ok + 1;

  raise exception 'BILL RATES FIXTURE OK: %/6', v_ok;
end
$fixture$;
