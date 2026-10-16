-- 330 — A hand-back the coach can change: every handed-back practice is kept, the coach can take time back, and the
-- money can be asked for later (Club Tier Stage 11d, part C. The owner after passing §308 W3, 2026-10-16: "if a coach
-- hands back a practice but does not ask for the money, it should still sit in a pending state … it automatically
-- disappearing gives the coach no ability to change the request"; the counter-proposal weighed and drawn; Asks 10–14
-- ratified as recommended the same day. Plan: docs/projects/active/CLUB_PERMITS_AND_SCHEDULER_PLAN.md §6d part C; hub
-- K4MPu4ni53Ct7yrDcmWJd9 → Stage 11d → the "C" links; build prompt CLUB_SCHEDULER_11D_C_BUILD_PROMPT.md)
--
--   KEEP, NEVER DELETE (Ask 10)    club_hand_back_events — the shared part of a plain hand-back and an accepted ask —
--                                  cancels every practice it reaches. It no longer calls club_practice_retire (which
--                                  deletes an untouched practice): that rule stays the club's own moves' (Send the
--                                  changes), unchanged. Families see a cancelled practice as Cancelled on every surface
--                                  they read (C9); no message. Hand-backs made before this keep what they did.
--   TAKE IT BACK (Ask 11)          club_hand_back_take_back — one step, the schedule locked first. Per practice: it hasn't
--                                  started, its slot is still open (no team on it, as the schedule stands, sent or not,
--                                  and not removed), no ask waits on it, no money was settled for it, the practice is
--                                  still there (a deleted one can't come back from the coach's side), and the team holds
--                                  nothing at that time already. The team returns to the slot, the slot forgets who
--                                  handed it back, the practice is back on (status only — notes and attendance never
--                                  moved), and the hand-back's record forgets it (`handed_back` false). ⚖ Never Changed
--                                  since sent (Ask 9, both ways).
--   ASK LATER (Ask 12)             club_hand_back_ask_later — one ask over a LANDED hand-back's practices still handed
--                                  back, when nothing was asked or settled for it. Its figure is what the landed record
--                                  stored for each (Ask 1's: the slot at the schedule's billed rate), never more than the
--                                  room (the latest come down first). It is an ordinary ask (club_schedule_hand_backs,
--                                  waiting) with `late_for` naming the hand-back, and the same From-club, money-back
--                                  request on both lists (Ask 4). Its slot rows are `waiting`, never `handed_back` until
--                                  Accept settles them.
--   ACCEPT, FOR A LATE ASK         club_hand_back_accept — a late ask counts every Sunday it asked about that the team does not
--                                  hold again (the time left at the hand-back: a Sunday that started since still counts; one
--                                  the club gave back to the team is the team's, never paid for), settles the money
--                                  by Ask 5's three ways, and OPENS NOTHING: the opening already happened, and re-running
--                                  it would take back a Sunday the club gave the team again. Its rows become
--                                  `handed_back`, so Send the changes reads those Sundays as an accepted hand-back's (a
--                                  Sunday the club later gives back is time gained, and billed). Decline and Withdraw are
--                                  unchanged: they never touched the time.
--   ⚖ THE DAILY SWEEP is mig 331's, its own commit (the owner's call in the build session: a late ask is never lapsed or
--   trued).
--
-- ⚖ SERVER-ONLY (mig 318 / 326 / 328's shape): every write a SECURITY DEFINER step scoped by org, locking in one order —
-- the schedule, the hand-back, its request.
--
-- Order: after 328 (it replaces 328's club_hand_back_events and club_hand_back_accept). 331 right after it.

begin;

-- ── 1. A late ask names the hand-back it asks money for ───────────────────────────────────────────────

alter table public.club_schedule_hand_backs
  add column if not exists late_for uuid references public.club_schedule_hand_backs(id) on delete cascade;
alter table public.club_schedule_hand_backs drop constraint if exists club_schedule_hand_backs_late_is_an_ask;
alter table public.club_schedule_hand_backs
  add constraint club_schedule_hand_backs_late_is_an_ask check (late_for is null or state <> 'landed');
create index if not exists club_schedule_hand_backs_late_for_idx
  on public.club_schedule_hand_backs (late_for) where late_for is not null;

comment on column public.club_schedule_hand_backs.late_for is
  'A LATE ASK (Club Tier Stage 11d part C, mig 330 — Ask 12): the landed hand-back whose practices this ask asks money back for, after they were handed back without the tick. Null on every other record. A late ask opens nothing at Accept (the time left the team at the hand-back), counts every Sunday it asked about whether or not it has started (never one the club gave back to the team), and is never lapsed or trued by the daily sweep (mig 331). One at a time per hand-back, and none after one was accepted or declined.';

comment on column public.club_schedule_hand_back_slots.handed_back is
  'The slot left the team by this hand-back (a landed one at once; an ask''s live slots at Accept). A late ask''s rows (club_schedule_hand_backs.late_for) become true at Accept: the money they settled — the time had already left by the landed hand-back. TAKEN BACK (mig 330, Ask 11): club_hand_back_take_back sets it false on the landed record''s row — the row stays, with the figure it was, and the slot is the team''s again. Send the changes adds back the minutes of rows still true (lib/club-schedule-send.ts).';

-- ── 2. Handing practices back keeps every one (Ask 10) ────────────────────────────────────────────────
-- 328's step, exactly, except the practice's fate: cancelled, whether or not the coach worked on it. `deleted` stays in
-- the answer (always 0) for its callers.

create or replace function public.club_hand_back_events(p_org uuid, p_team uuid, p_actor uuid, p_slots uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot    uuid;
  v_event   uuid;
  v_done    uuid[] := '{}';
  v_cancel  integer := 0;
begin
  foreach v_slot in array coalesce(p_slots, '{}'::uuid[]) loop
    select e.id into v_event from rep_team_events e
     where e.org_id = p_org and e.team_id = p_team and e.club_schedule_slot_id = v_slot and e.status <> 'cancelled'
     limit 1;
    if not found then continue; end if;
    delete from club_schedule_slot_teams where slot_id = v_slot and team_id = p_team;
    update club_schedule_slots set handed_back_at = now(), handed_back_by = p_actor, handed_back_team_id = p_team,
                                   updated_at = now()
     where id = v_slot;
    -- ⚖ Kept, never deleted (Ask 10): the coach's record of what the team gave back, and where it is taken back from.
    update rep_team_events set status = 'cancelled', updated_at = now() where id = v_event;
    v_cancel := v_cancel + 1;
    v_done := v_done || v_slot;
  end loop;
  return jsonb_build_object('slots', to_jsonb(v_done), 'cancelled', v_cancel, 'deleted', 0);
end;
$$;

-- ── 3. Take it back (Ask 11) ──────────────────────────────────────────────────────────────────────────
-- `p_slots`: the practices the coach chose (this · this & future · all of the hand-back), by slot. Each is read again
-- under the schedule's lock and taken back only while it still can be; the rest are left as they are. Refusals before
-- any write: not_found · not_final · nothing (none of them can come back).

create or replace function public.club_hand_back_take_back(p_org uuid, p_team uuid, p_actor uuid, p_hand_back uuid, p_slots uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hb      club_schedule_hand_backs%rowtype;
  v_state   text;
  v_slot    uuid;
  v_done    uuid[] := '{}';
begin
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back and org_id = p_org and team_id = p_team;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select state into v_state from club_schedules where id = v_hb.schedule_id for update;
  if v_state is distinct from 'final' then return jsonb_build_object('ok', false, 'code', 'not_final'); end if;
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back for update;
  -- Only a hand-back without money: an accepted ask's Sundays were paid for, so taking them back is the club's call.
  if v_hb.state <> 'landed' then return jsonb_build_object('ok', false, 'code', 'nothing'); end if;

  foreach v_slot in array coalesce(p_slots, '{}'::uuid[]) loop
    if not exists (select 1 from club_schedule_hand_back_slots hs
                    where hs.hand_back_id = p_hand_back and hs.slot_id = v_slot and hs.handed_back) then
      continue;
    end if;
    -- It hasn't started, and the club hasn't removed it or given it to another team (sent or not).
    if not exists (select 1 from club_schedule_slots sl
                    where sl.id = v_slot and sl.schedule_id = v_hb.schedule_id and sl.removed_at is null and sl.starts_at > now())
       or exists (select 1 from club_schedule_slot_teams st where st.slot_id = v_slot) then
      continue;
    end if;
    -- No ask waits on it — a late ask over this hand-back, or any other.
    if exists (select 1 from club_schedule_hand_back_slots w where w.slot_id = v_slot and w.waiting) then
      continue;
    end if;
    -- No money was settled for it: a late ask over this hand-back that the club accepted.
    if exists (select 1 from club_schedule_hand_backs l
                 join club_schedule_hand_back_slots ls on ls.hand_back_id = l.id
                where l.late_for = p_hand_back and l.state = 'accepted' and ls.slot_id = v_slot) then
      continue;
    end if;
    -- The practice is still there to come back (a hand-back made before mig 330 may have deleted it).
    if not exists (select 1 from rep_team_events e
                    where e.org_id = p_org and e.team_id = p_team and e.club_schedule_slot_id = v_slot and e.status = 'cancelled') then
      continue;
    end if;
    -- The team holds nothing of the schedule at that time already (the schedule's one rule: never twice at once).
    if exists (select 1 from club_schedule_slot_teams st
                 join club_schedule_slots o on o.id = st.slot_id
                 join club_schedule_slots sl on sl.id = v_slot
                where st.team_id = p_team and o.schedule_id = v_hb.schedule_id and o.id <> v_slot and o.removed_at is null
                  and o.starts_at < sl.ends_at and sl.starts_at < o.ends_at) then
      continue;
    end if;

    insert into club_schedule_slot_teams (slot_id, team_id, org_id) values (v_slot, p_team, p_org);
    update club_schedule_slots set handed_back_at = null, handed_back_by = null, handed_back_team_id = null, updated_at = now()
     where id = v_slot;
    -- Back on, as it was: only the status moves (its notes, attendance and plan never left it).
    update rep_team_events set status = 'scheduled', updated_at = now()
     where org_id = p_org and team_id = p_team and club_schedule_slot_id = v_slot and status = 'cancelled';
    update club_schedule_hand_back_slots set handed_back = false where hand_back_id = p_hand_back and slot_id = v_slot;
    v_done := v_done || v_slot;
  end loop;

  if cardinality(v_done) = 0 then return jsonb_build_object('ok', false, 'code', 'nothing'); end if;
  -- The page's edits act on the version they read; the slots changed. Never Changed since sent (Ask 9, both ways).
  update club_schedules set version = version + 1, updated_at = now() where id = v_hb.schedule_id;
  return jsonb_build_object('ok', true, 'slots', to_jsonb(v_done), 'scheduleId', v_hb.schedule_id);
end;
$$;

-- ── 4. Ask for the money later (Ask 12) ───────────────────────────────────────────────────────────────
-- Over a LANDED hand-back of this team: every practice of it still handed back (and not given back to the team since),
-- each at the figure the hand-back stored,
-- never more than the room (the latest come down first, as Hand back's tick). Nothing about the time changes. The
-- request it carries: `p_request` { programYearId, description, budgetItemId, budgetCategoryId, budgetLineId } — as
-- club_hand_back_ask's. Refusals before any write: not_found · not_final · asked (an ask over this hand-back is waiting,
-- was accepted or was declined, or one of its Sundays is in another waiting ask) · nothing (no figure) · changed (the
-- request's season is not the team's).

create or replace function public.club_hand_back_ask_later(p_org uuid, p_team uuid, p_actor uuid, p_hand_back uuid, p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hb      club_schedule_hand_backs%rowtype;
  v_state   text;
  v_room    bigint;
  v_cents   bigint := 0;
  v_take    bigint;
  v_rows    jsonb := '[]'::jsonb;
  r         record;
  v_ask     uuid;
  v_req     uuid;
begin
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back and org_id = p_org and team_id = p_team;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select state into v_state from club_schedules where id = v_hb.schedule_id for update;
  if v_state is distinct from 'final' then return jsonb_build_object('ok', false, 'code', 'not_final'); end if;
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back for update;
  if v_hb.state <> 'landed' then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  -- One ask over a hand-back: none waiting, and none the club already answered (withdrawn leaves the door open).
  if exists (select 1 from club_schedule_hand_backs l where l.late_for = p_hand_back and l.state in ('waiting', 'accepted', 'declined'))
     or exists (select 1 from club_schedule_hand_back_slots hs join club_schedule_hand_back_slots w on w.slot_id = hs.slot_id and w.waiting
                 where hs.hand_back_id = p_hand_back and hs.handed_back) then
    return jsonb_build_object('ok', false, 'code', 'asked');
  end if;
  if not exists (select 1 from rep_program_years where id = nullif(p_request->>'programYearId', '')::uuid
                                                  and team_id = p_team and org_id = p_org) then
    return jsonb_build_object('ok', false, 'code', 'changed');
  end if;

  -- Each Sunday at its stored figure, capped by the room from the latest back.
  v_room := club_hand_back_room(p_org, v_hb.schedule_id, p_team, null);
  for r in select hs.* from club_schedule_hand_back_slots hs
            where hs.hand_back_id = p_hand_back and hs.handed_back
              -- A Sunday the club has given back to the team is the team's again: never asked for (/review 2026-10-16).
              and not exists (select 1 from club_schedule_slot_teams st where st.slot_id = hs.slot_id and st.team_id = p_team)
            order by hs.starts_at, hs.id loop
    v_rows := v_rows || jsonb_build_array(to_jsonb(r));
    v_cents := v_cents + r.cents;
  end loop;
  if jsonb_array_length(v_rows) = 0 then return jsonb_build_object('ok', false, 'code', 'nothing'); end if;
  v_take := greatest(0, v_cents - v_room);
  v_cents := least(v_cents, greatest(v_room, 0));
  if v_cents <= 0 then return jsonb_build_object('ok', false, 'code', 'nothing'); end if;

  perform set_config('app.club_money_step', 'on', true);
  insert into club_schedule_hand_backs (org_id, schedule_id, team_id, scope, state, asked_cents, asked_by, late_for)
  values (p_org, v_hb.schedule_id, p_team, v_hb.scope, 'waiting', v_cents, p_actor, p_hand_back)
  returning id into v_ask;
  insert into club_schedule_hand_back_slots (hand_back_id, org_id, slot_id, event_id, starts_at, ends_at, priced_minutes, cents, waiting)
  select v_ask, p_org, (k->>'slot_id')::uuid, (k->>'event_id')::uuid, (k->>'starts_at')::timestamptz, (k->>'ends_at')::timestamptz,
         (k->>'priced_minutes')::numeric,
         -- Past the room, the latest Sundays come down first.
         greatest(0, (k->>'cents')::bigint - least((k->>'cents')::bigint,
           greatest(0, v_take - coalesce((select sum((x->>'cents')::bigint) from jsonb_array_elements(v_rows) with ordinality as y(x, n)
                                           where y.n > o.n), 0)))),
         true
    from jsonb_array_elements(v_rows) with ordinality as o(k, n);
  insert into rep_team_payment_requests (org_id, team_id, program_year_id, request_type, amount, description, status,
                                         money_in_meaning, budget_item_id, budget_category_id, budget_line_id, created_by,
                                         club_hand_back_id)
  values (p_org, p_team, (p_request->>'programYearId')::uuid, 'charge_to_org', v_cents / 100.0,
          left(btrim(p_request->>'description'), 500), 'pending', 'reimbursement',
          nullif(p_request->>'budgetItemId', '')::uuid, nullif(p_request->>'budgetCategoryId', '')::uuid,
          nullif(p_request->>'budgetLineId', '')::uuid, p_actor, v_ask)
  returning id into v_req;
  perform set_config('app.club_money_step', '', true);
  return jsonb_build_object('ok', true, 'handBackId', v_ask, 'requestId', v_req, 'cents', v_cents,
                            'count', jsonb_array_length(v_rows), 'scheduleId', v_hb.schedule_id);
end;
$$;

-- ── 5. Accept (Asks 3, 5, 6, 7, 9 — and a late ask, Ask 12): one step ─────────────────────────────────
-- 328's step, exactly, for an ask with its tick. A LATE ask: every Sunday it asked about counts (never by date — the
-- time already left), the figure is what it asked, never more than the room, the money settles the same three ways, and
-- NOTHING is opened (club_hand_back_events is never called). Refusals before any write: not_found · answered (+ state) ·
-- lapsed (every Sunday started — an ask with its tick) · stale (nothing of it is still the team's to hand back).

create or replace function public.club_hand_back_accept(p_org uuid, p_actor uuid, p_hand_back uuid, p_on date, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hb       club_schedule_hand_backs%rowtype;
  v_live     uuid[];
  v_cents    bigint;
  v_room     bigint;
  v_credit   bigint;
  v_rest     bigint;
  v_res      jsonb;
  v_req      uuid;
  v_count    integer;
begin
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back and org_id = p_org;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  perform 1 from club_schedules where id = v_hb.schedule_id for update;
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back for update;
  if v_hb.state <> 'waiting' then return jsonb_build_object('ok', false, 'code', 'answered', 'state', v_hb.state); end if;

  if v_hb.late_for is not null then
    -- A late ask: the Sundays it asked about, at what it asked — never one the club has since given back to the team (it
    -- holds that time again; /review 2026-10-16). Started or given to another team, a Sunday still counts.
    select coalesce(array_agg(hs.slot_id order by hs.starts_at) filter (where hs.slot_id is not null), '{}'), count(*), coalesce(sum(hs.cents), 0)
      into v_live, v_count, v_cents
      from club_schedule_hand_back_slots hs
     where hs.hand_back_id = p_hand_back
       and not exists (select 1 from club_schedule_slot_teams st where st.slot_id = hs.slot_id and st.team_id = v_hb.team_id);
    if v_count = 0 then return jsonb_build_object('ok', false, 'code', 'stale'); end if;
  else
    select coalesce(array_agg(hs.slot_id order by hs.starts_at), '{}'), coalesce(sum(hs.cents), 0)
      into v_live, v_cents
      from club_schedule_hand_back_slots hs
      join club_schedule_slots sl on sl.id = hs.slot_id and sl.removed_at is null
      join club_schedule_slot_teams st on st.slot_id = sl.id and st.team_id = v_hb.team_id
     where hs.hand_back_id = p_hand_back and sl.starts_at > now()
       and exists (select 1 from rep_team_events e where e.team_id = v_hb.team_id and e.club_schedule_slot_id = sl.id
                                                     and e.status <> 'cancelled');
    v_count := cardinality(v_live);
    if cardinality(v_live) = 0 then
      if not exists (select 1 from club_schedule_hand_back_slots hs
                       join club_schedule_slots sl on sl.id = hs.slot_id and sl.removed_at is null
                      where hs.hand_back_id = p_hand_back and sl.starts_at > now()) then
        return jsonb_build_object('ok', false, 'code', 'lapsed');
      end if;
      return jsonb_build_object('ok', false, 'code', 'stale');
    end if;
  end if;
  v_room := club_hand_back_room(p_org, v_hb.schedule_id, v_hb.team_id, p_hand_back);
  v_cents := least(v_cents, v_room);
  if v_cents <= 0 then return jsonb_build_object('ok', false, 'code', 'stale'); end if;

  perform set_config('app.club_money_step', 'on', true);
  -- The money first: a closed year raises here, before a single practice moves.
  v_credit := club_credit_apply(p_org, v_hb.team_id, club_schedule_bill_pool(v_hb.schedule_id), v_cents, p_actor, p_on,
                                p_reason, p_hand_back, null);
  v_rest := v_cents - v_credit;
  if v_hb.late_for is not null then
    -- ⚖ A late ask opens nothing: its Sundays left the team at the hand-back. Its rows counted are what the money settled.
    v_res := jsonb_build_object('slots', to_jsonb(v_live), 'cancelled', 0, 'deleted', 0);
    update club_schedule_hand_back_slots hs set waiting = false,
           handed_back = not exists (select 1 from club_schedule_slot_teams st where st.slot_id = hs.slot_id and st.team_id = v_hb.team_id)
     where hs.hand_back_id = p_hand_back;
  else
    v_res := club_hand_back_events(p_org, v_hb.team_id, p_actor, v_live);
    update club_schedule_hand_back_slots set waiting = false,
           handed_back = coalesce(slot_id = any (select jsonb_array_elements_text(v_res->'slots')::uuid), false)
     where hand_back_id = p_hand_back;
  end if;
  update club_schedule_hand_backs set state = 'accepted', closed_by = p_actor, closed_at = now(),
         accepted_cents = v_cents, credited_cents = v_credit, to_pay_cents = v_rest
   where id = p_hand_back;
  update rep_team_payment_requests
     set status = case when v_rest = 0 then 'credited' else 'accepted' end,
         amount = case when v_rest = 0 then v_cents else v_rest end / 100.0,
         reviewed_by = p_actor, reviewed_at = now(), updated_at = now()
   where club_hand_back_id = p_hand_back
   returning id into v_req;
  update club_schedules set version = version + 1, updated_at = now() where id = v_hb.schedule_id;
  perform set_config('app.club_money_step', '', true);
  return jsonb_build_object('ok', true, 'teamId', v_hb.team_id, 'scheduleId', v_hb.schedule_id, 'requestId', v_req,
                            'cents', v_cents, 'credited', v_credit, 'toPay', v_rest, 'count', v_count, 'late', v_hb.late_for is not null,
                            'slots', v_res->'slots', 'cancelled', v_res->'cancelled', 'deleted', v_res->'deleted');
end;
$$;

-- ── 6. Server-only ───────────────────────────────────────────────────────────────────────────────────

revoke all on function
  public.club_hand_back_events(uuid, uuid, uuid, uuid[]),
  public.club_hand_back_take_back(uuid, uuid, uuid, uuid, uuid[]),
  public.club_hand_back_ask_later(uuid, uuid, uuid, uuid, jsonb),
  public.club_hand_back_accept(uuid, uuid, uuid, date, text)
  from public, anon, authenticated;
grant execute on function
  public.club_hand_back_take_back(uuid, uuid, uuid, uuid, uuid[]),
  public.club_hand_back_ask_later(uuid, uuid, uuid, uuid, jsonb),
  public.club_hand_back_accept(uuid, uuid, uuid, date, text)
  to service_role;

commit;
