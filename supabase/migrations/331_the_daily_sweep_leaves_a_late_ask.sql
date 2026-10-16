-- 331 — The daily sweep leaves a late ask alone (Club Tier Stage 11d, part C — Ask 12: a late ask never lapses by date
-- and keeps its figure). ⚖ THE OWNER'S CALL IN THE BUILD SESSION (2026-10-16, AGENCY_RULES 2026-09-26 — the sweep runs
-- by itself, so it changes only when the owner asked in the conversation): "Skip late asks", option (a) of three.
--
-- WHAT CHANGES: club_hand_back_sweep (the daily scheduled step in the dues-reminders route) no longer selects an ask with
-- `late_for` set (mig 330). Before this, such an ask — over Sundays already handed back, their practices cancelled —
-- would have been trued to $0.00 on its first night (none of its Sundays is still the team's) and lapsed once its Sundays
-- passed. Every other waiting ask is swept exactly as before (328's body, one condition added).
--
-- Order: after 330 (the column). Its own commit.

begin;

create or replace function public.club_hand_back_sweep()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hb       record;
  v_left     integer;
  v_all      integer;
  v_cents    bigint;
  v_lapsed   jsonb := '[]'::jsonb;
  v_trued    integer := 0;
begin
  perform set_config('app.club_money_step', 'on', true);
  -- ⚖ A late ask (mig 330) is never swept: its Sundays left the team at the hand-back, so neither its figure nor its date
  -- moves it. It waits until the club answers or the coach withdraws it.
  for v_hb in select h.* from club_schedule_hand_backs h where h.state = 'waiting' and h.late_for is null order by h.asked_at for update skip locked loop
    -- One read of its Sundays, as Accept reads them: how many are still to come (the slot as it stands — a removed or
    -- deleted one never comes), the figure of those Accept would hand back, and how many it asked about.
    select count(*) filter (where sl.id is not null and sl.removed_at is null and sl.starts_at > now()),
           coalesce(sum(hs.cents) filter (where sl.id is not null and sl.removed_at is null and sl.starts_at > now()
             and exists (select 1 from club_schedule_slot_teams st where st.slot_id = sl.id and st.team_id = v_hb.team_id)
             and exists (select 1 from rep_team_events e where e.team_id = v_hb.team_id and e.club_schedule_slot_id = sl.id
                                                           and e.status <> 'cancelled')), 0),
           count(*)
      into v_left, v_cents, v_all
      from club_schedule_hand_back_slots hs left join club_schedule_slots sl on sl.id = hs.slot_id
     where hs.hand_back_id = v_hb.id;
    if v_left = 0 then
      update club_schedule_hand_backs set state = 'lapsed', closed_at = now() where id = v_hb.id;
      update club_schedule_hand_back_slots set waiting = false where hand_back_id = v_hb.id;
      delete from rep_team_payment_requests where club_hand_back_id = v_hb.id;
      v_lapsed := v_lapsed || jsonb_build_array(jsonb_build_object('handBackId', v_hb.id, 'orgId', v_hb.org_id,
                    'teamId', v_hb.team_id, 'scheduleId', v_hb.schedule_id, 'askedCents', v_hb.asked_cents, 'count', v_all));
      continue;
    end if;
    if v_cents > 0 then
      update rep_team_payment_requests set amount = v_cents / 100.0, updated_at = now()
       where club_hand_back_id = v_hb.id and status = 'pending' and round(amount * 100)::bigint <> v_cents;
      if found then v_trued := v_trued + 1; end if;
    end if;
  end loop;
  perform set_config('app.club_money_step', '', true);
  return jsonb_build_object('lapsed', v_lapsed, 'trued', v_trued);
end;
$$;

revoke all on function public.club_hand_back_sweep() from public, anon, authenticated;
grant execute on function public.club_hand_back_sweep() to service_role;

commit;
