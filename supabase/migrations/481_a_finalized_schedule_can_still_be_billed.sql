-- 481_a_finalized_schedule_can_still_be_billed.sql
--
-- Club Tier Stage 13c (the Fair shares window's Bill door). A schedule finalized WITHOUT a bill could never be billed:
-- the bill rode with the schedule and became one allocation at Finalize only. A club that finalizes first and learns
-- what the permit costs afterwards (or decides to bill later) was stuck. This adds the missing step, and nothing else.
--
-- WHAT CHANGES (no table or column; one CHECK widened, one function)
--   1. club_schedule_sends.kind gains 'bill' — "Send the bill", the late bill's own row in the send log (it claims, emails and
--      logs exactly as Finalize and Send the changes do).
--   2. club_schedule_bill_late(...): on a FINAL schedule with no bill, in ONE step: the allocation (club_allocation_create,
--      split `time`, as Finalize makes it) filed as Finalize files it (club_bill_file_shares), the bill's terms written to the
--      schedule (`bill_*`, `allocation_id`, `bill_scale`) and the send row landed with the NEXT SEND THE CHANGES' BASELINE
--      (`team_values`) — written here, in the same step, for the reason Finalize writes its own there: a baseline left `{}`
--      makes the next Send the changes bill every team its whole share again.
--      It never touches state, version-visible schedule facts or `sent_at`/`finalized_at`: the schedule stays final, exactly as
--      it was sent. A bill's terms still never change once made (3d Ask 7b) — this only makes the FIRST bill, later.
--      Refusals come back before anything is written: not_found · not_final · already_billed · changed · changes_waiting
--      (edits wait to be sent: the bill would price time the teams were never told of) · asks_waiting (a hand-back ask
--      waits: its figure was worked out with no bill) · the allocation's own (season_closed · year_closed · over_line ·
--      line_not_found · not_a_cost_line).
--
-- Re-runnable.

begin;

set local lock_timeout = '15s';

alter table public.club_schedule_sends drop constraint if exists club_schedule_sends_kind_check;
alter table public.club_schedule_sends
  add constraint club_schedule_sends_kind_check check (kind in ('review', 'final', 'changes', 'bill'));

comment on table public.club_schedule_sends is
  'The schedule''s send log (Club Tier Stage 11a, Ask 9 — one log shape for every club send): review · final · changes · bill (a final schedule''s first bill, made later — mig 481), when, by whom, the teams and people told, the bookings contact, and the money each send settled (team_values: each team''s billed value in cents, the next send''s baseline; billed / owed_back: build question B). A row is CLAIMED before any email goes (club_schedule_send_claim) and completed with what actually went.';

create or replace function public.club_schedule_bill_late(
  p_org uuid, p_schedule uuid, p_actor uuid, p_version integer,
  p_terms jsonb, p_bill jsonb, p_scale numeric, p_send uuid, p_log jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s     club_schedules%rowtype;
  v_res   jsonb;
  v_alloc uuid;
  v_filed integer;
begin
  select * into v_s from club_schedules where id = p_schedule and org_id = p_org for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v_s.state <> 'final' then return jsonb_build_object('ok', false, 'code', 'not_final'); end if;
  if v_s.allocation_id is not null or v_s.bill_plan is not null then return jsonb_build_object('ok', false, 'code', 'already_billed'); end if;
  if v_s.version <> p_version then return jsonb_build_object('ok', false, 'code', 'changed', 'version', v_s.version); end if;
  if v_s.changed_since_sent then return jsonb_build_object('ok', false, 'code', 'changes_waiting'); end if;
  if exists (select 1 from club_schedule_hand_backs h where h.schedule_id = p_schedule and h.org_id = p_org and h.state = 'waiting') then
    return jsonb_build_object('ok', false, 'code', 'asks_waiting');
  end if;
  if p_bill is null or p_terms is null then raise exception 'club_schedule_bill_late: a bill and its terms'; end if;

  v_res := club_allocation_create(p_org, p_actor, p_bill->>'description', nullif(p_bill->>'lineId', '')::uuid, 'time',
                                  p_bill->'splits', p_bill->>'notes');
  if not coalesce((v_res->>'ok')::boolean, false) then return v_res; end if;
  v_alloc := (v_res->>'allocationId')::uuid;
  v_filed := club_bill_file_shares(v_alloc);

  update club_schedules set
    bill_line_id   = nullif(p_terms->>'lineId', '')::uuid,
    bill_permit_id = nullif(p_terms->>'permitId', '')::uuid,
    bill_amount    = nullif(p_terms->>'amount', '')::numeric,
    bill_plan      = p_terms->>'plan',
    bill_first_due = nullif(p_terms->>'firstDue', '')::date,
    bill_dates     = case when jsonb_typeof(p_terms->'dates') = 'array'
                          then (select array_agg(x::date order by x::date) from jsonb_array_elements_text(p_terms->'dates') x)
                          else null end,
    allocation_id  = v_alloc,
    bill_scale     = p_scale,
    version = version + 1, updated_by = p_actor, updated_at = now()
  where id = p_schedule;
  update club_schedule_sends set landed_at = now(), team_values = coalesce(p_log->'teamValues', '{}'::jsonb)
   where id = p_send and schedule_id = p_schedule and org_id = p_org;
  if not found then raise exception 'changed: the send''s claim is gone'; end if;
  return jsonb_build_object('ok', true, 'allocationId', v_alloc, 'filed', v_filed, 'version', v_s.version + 1);
end;
$$;

revoke all on function public.club_schedule_bill_late(uuid, uuid, uuid, integer, jsonb, jsonb, numeric, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.club_schedule_bill_late(uuid, uuid, uuid, integer, jsonb, jsonb, numeric, uuid, jsonb) to service_role;

notify pgrst, 'reload schema';

commit;
