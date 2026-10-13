-- 328 — A hand-back may ask for money back: the ask, the request it carries, the credit, and the club's own changes
-- settling the same way (Club Tier Stage 11d, part A. Owner direction 2026-10-12 from walk §300 W10; ratified the same
-- day — all nine asks and the /design review's D1–D7 as recommended. Plan: docs/projects/active/
-- CLUB_PERMITS_AND_SCHEDULER_PLAN.md §6d; hub K4MPu4ni53Ct7yrDcmWJd9 → Stage 11d; build prompt
-- CLUB_SCHEDULER_11D_A_BUILD_PROMPT.md)
--
-- The owner: "for handing back, can we give the option to include money back … so then the club confirms the hand back,
-- thus opening the time slot and also making a 'payment request' that they later have to action as 'paid' once they do
-- it. if the money is still owing from the team the amount they owe just goes down by that amount and there is nothing
-- for the club to further action."
--
--   club_schedule_hand_backs        EVERY hand-back (Ask 17 as built, and Ask 1–7's ask): who, which schedule, the scope
--                                   picked, its state. `landed` = without money, landed at once (as built). An ask:
--                                   waiting → accepted · declined · withdrawn · lapsed. Its figure (the slots at the rate
--                                   the club billed, worked out when asked) and, at Accept, what was credited and what
--                                   the club owes back.
--   club_schedule_hand_back_slots   the slots it reached, each with its own priced minutes and figure (a shared slot is
--                                   the team's half), and whether that slot actually left the team by it. A plain
--                                   hand-back's and an accepted ask's slots are what Send the changes adds back to the
--                                   team's measure, so a hand-back is never read as the club taking the team's time.
--   rep_allocation_credits          A CREDIT (Ask 6): a row on the club↔team account, against ONE bill, dated the day the
--                                   club wrote it. It lowers a debt the club wrote and gives no money. The bill never
--                                   changes (3d Ask 7b).
--   rep_allocation_credit_parts     how each credit was applied — STORED when written, latest unpaid payment first (Ask 5),
--                                   never re-derived on read, so a later payment or take-back can't move it.
--   rep_allocation_installments.credited_amount
--                                   the sum of a payment's parts, written in the same step. Its DUE is amount − credited
--                                   (lib/club-money-figures.ts `clubInstallmentDue`); every figure that reads a bill reads it.
--   rep_team_payment_requests.club_hand_back_id / .club_schedule_send_id
--                                   the request an ask carries (charge_to_org, 'reimbursement' — set by the ask, never asked
--                                   of the coach) and the request to pay a club move at Send the changes raises for a team
--                                   that had paid. Status gains `accepted` (the club accepted; it owes the money until Record
--                                   paying approves it) and `credited` (closed: settled by a credit, no money moved).
--
-- ⚖ A SENT INSTALLMENT COUNTS AS PAID FOR A CREDIT (the build's reading — the drawing never said; said in the hand-off):
-- the coach says the money is on its way, so crediting it would leave the club receiving more than is owed; what the
-- credit would have taken off it becomes the request to pay.
-- ⚖ A HAND-BACK NEVER MAKES THE SCHEDULE CHANGED SINCE SENT (Ask 9): the hand-back step stops setting the flag.
-- ⚖ BUILD QUESTION B'S OWED-BACK GOES (Ask 8): Send the changes credits the team that lost time (or raises an accepted
-- request to pay for what it had paid) in its own step, under the Bill the corrections switch; `owed_back` is no longer
-- written (dictionary: drop at the next schema tidy).
-- ⚖ AN ASK'S REQUEST MOVES ONLY WITH ITS ASK: every step below that writes one sets `app.club_money_step` and switches
-- it off again before it returns (a step that raises takes its transaction with it), and a trigger refuses any other
-- write to the linked request's money (amount, status, direction, meaning, words) or its removal — the floor under the
-- routes' own refusals.
--
-- ⚖ SERVER-ONLY (mig 318 / 326's shape): RLS on, no policies, nothing to anon/authenticated; every write a SECURITY
-- DEFINER step scoped by org, locking in one order — the schedule, the hand-back, its request, the installments.
--
-- Order: after 326 (club_schedules, its steps — dev only, prod `pending`): this migration REPLACES club_schedule_hand_back,
-- club_schedule_apply_changes and club_practices_carry. Same promote as 326, right after it.

begin;

-- ── 1. What a credit took off a payment ───────────────────────────────────────────────────────────────

alter table public.rep_allocation_installments
  add column if not exists credited_amount numeric(12,2) not null default 0;
alter table public.rep_allocation_installments drop constraint if exists rep_allocation_installments_credited_check;
alter table public.rep_allocation_installments
  add constraint rep_allocation_installments_credited_check check (credited_amount >= 0 and credited_amount <= amount);
-- A payment a credit covers whole has nothing left to send or receive.
alter table public.rep_allocation_installments drop constraint if exists rep_allocation_installments_credit_leaves_nothing_check;
alter table public.rep_allocation_installments
  add constraint rep_allocation_installments_credit_leaves_nothing_check
  check (credited_amount < amount or (paid_at is null and sent_at is null));

comment on column public.rep_allocation_installments.credited_amount is
  'What credits took off this payment (Club Tier Stage 11d, mig 328): the sum of its rep_allocation_credit_parts, written in the same step by club_credit_apply — never by hand, never re-derived on read. Its DUE is amount − credited_amount (lib/club-money-figures.ts clubInstallmentDue): what the team still has to pay on it, what a received payment writes to the ledger, what reminders ask for. The bill never changes: amount stays as billed. A payment covered whole can''t be sent or received (rep_allocation_installments_credit_leaves_nothing_check).';

-- The bill's fiscal lock reaches the credit: a closed year refuses one (Ask 6, "a closed fiscal year refusing a credit").
drop trigger if exists rep_allocation_installments_fiscal_lock on public.rep_allocation_installments;
create trigger rep_allocation_installments_fiscal_lock
  before insert or delete or update of amount, due_date, installment_number, split_id, credited_amount
  on public.rep_allocation_installments
  for each row execute function public.rep_allocation_installments_fiscal_lock();

-- ── 2. Every hand-back, and the ask ───────────────────────────────────────────────────────────────────

create table if not exists public.club_schedule_hand_backs (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  schedule_id       uuid not null references public.club_schedules(id) on delete cascade,
  team_id           uuid not null references public.rep_teams(id) on delete cascade,
  -- The coach's pick (the series question): this practice · this & future · all practices.
  scope             text not null check (scope in ('one', 'remaining', 'all')),
  -- landed = handed back without money, at once (Ask 17 as built). An ask (with money): waiting until the club answers,
  -- then accepted · declined; withdrawn by the coach; lapsed when every Sunday in it has started (Ask 7).
  state             text not null check (state in ('landed', 'waiting', 'accepted', 'declined', 'withdrawn', 'lapsed')),
  -- The figure when asked, in cents: the slots at what the club billed the team for them (Ask 1). Null on a landed one.
  asked_cents       bigint check (asked_cents is null or asked_cents > 0),
  -- At Accept (Ask 5): the figure then (Sundays started since drop out — Ask 7), what came off what the team owed, and
  -- what the club owes it back (its request's amount).
  accepted_cents    bigint check (accepted_cents is null or accepted_cents > 0),
  credited_cents    bigint check (credited_cents is null or credited_cents >= 0),
  to_pay_cents      bigint check (to_pay_cents is null or to_pay_cents >= 0),
  asked_by          uuid references auth.users(id) on delete set null,
  asked_at          timestamptz not null default now(),
  -- Who ended it and when: the club (accept · decline), the coach (withdraw), the daily sweep (lapse: null).
  closed_by         uuid references auth.users(id) on delete set null,
  closed_at         timestamptz,
  -- Decline's optional reason, which the coach reads.
  decline_reason    text check (decline_reason is null or length(decline_reason) <= 500),
  constraint club_schedule_hand_backs_whole check (
    (state = 'landed' and asked_cents is null and closed_at is null)
    or (state = 'waiting' and asked_cents is not null and closed_at is null)
    or (state = 'accepted' and asked_cents is not null and closed_at is not null and accepted_cents is not null
        and credited_cents is not null and to_pay_cents is not null and credited_cents + to_pay_cents = accepted_cents)
    or (state in ('declined', 'withdrawn', 'lapsed') and asked_cents is not null and closed_at is not null)
  )
);

create index if not exists club_schedule_hand_backs_schedule_idx on public.club_schedule_hand_backs (schedule_id, state);
create index if not exists club_schedule_hand_backs_team_idx on public.club_schedule_hand_backs (team_id, state);
create index if not exists club_schedule_hand_backs_org_idx on public.club_schedule_hand_backs (org_id, state);
create index if not exists club_schedule_hand_backs_asked_by_idx on public.club_schedule_hand_backs (asked_by) where asked_by is not null;
create index if not exists club_schedule_hand_backs_closed_by_idx on public.club_schedule_hand_backs (closed_by) where closed_by is not null;
-- The daily sweep reads only the waiting asks (every landed hand-back stays forever; this keeps the sweep off them).
create index if not exists club_schedule_hand_backs_waiting_idx on public.club_schedule_hand_backs (asked_at) where state = 'waiting';

comment on table public.club_schedule_hand_backs is
  'Every hand-back of a club schedule''s practices (Club Tier Stage 11d, mig 328): landed (no money, at once — Ask 17 as built) or an ASK for money back (Asks 1–7): waiting until the club answers (its practices stay the team''s), then accepted (the slots open; the money settles as a credit and/or an accepted request to pay), declined (with an optional reason the coach reads), withdrawn by the coach, or lapsed (every Sunday in it started unanswered — the daily sweep closes it and tells the coach). Written only by its steps. Server-only.';

create table if not exists public.club_schedule_hand_back_slots (
  id              uuid primary key default gen_random_uuid(),
  hand_back_id    uuid not null references public.club_schedule_hand_backs(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  -- SET NULL: a removed slot goes at Send the changes; its hand-back keeps the time and the figure it was.
  slot_id         uuid references public.club_schedule_slots(id) on delete set null,
  -- The practice it was (NOT a foreign key — the mirror's reason, mig 207: a retired practice may be deleted).
  event_id        uuid,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  -- The team's priced minutes for the slot when it was handed back (minutes × the field's price share ÷ the teams on it).
  priced_minutes  numeric(10,4) not null check (priced_minutes >= 0),
  -- Those minutes at the rate the club billed (club_schedules.bill_scale), in cents; 0 when the schedule billed nothing.
  cents           bigint not null check (cents >= 0),
  -- The ask is waiting (a slot is in at most one waiting ask — the unique index below is the floor).
  waiting         boolean not null default false,
  -- The slot left the team by this hand-back (a landed one at once; an ask's live slots at Accept).
  handed_back     boolean not null default false
);

create unique index if not exists club_schedule_hand_back_slots_one_waiting on public.club_schedule_hand_back_slots (slot_id) where waiting;
create index if not exists club_schedule_hand_back_slots_hand_back_idx on public.club_schedule_hand_back_slots (hand_back_id);
create index if not exists club_schedule_hand_back_slots_slot_idx on public.club_schedule_hand_back_slots (slot_id) where slot_id is not null;
create index if not exists club_schedule_hand_back_slots_org_idx on public.club_schedule_hand_back_slots (org_id);

comment on table public.club_schedule_hand_back_slots is
  'The slots a hand-back reached (Club Tier Stage 11d, mig 328), each with the team''s priced minutes and its figure in cents (the slot at club_schedules.bill_scale). `waiting`: its ask is unanswered — one waiting ask per slot (club_schedule_hand_back_slots_one_waiting). `handed_back`: the slot left the team by it — Send the changes adds those minutes back to the team''s measure (lib/club-schedule-send.ts), so a hand-back is never read as the club taking time (the hidden owed-back of S11D-03).';

-- A hand-back made before this migration (mig 326's step) kept no record — only the slot's handed_back_* columns — so the
-- next Send the changes would read that time as the club's change and settle it. Give each its landed record: one per
-- team per moment handed back, each slot at the team's priced minutes then (minutes × the facility's share ÷ the teams on
-- it, the team included) and the schedule's rate. On production there is none (326 and 328 ship together); on dev, §300
-- W10's four Sundays. Idempotent: a slot that already has a handed-back record is skipped.
insert into public.club_schedule_hand_backs (org_id, schedule_id, team_id, scope, state, asked_by, asked_at)
select distinct sl.org_id, sl.schedule_id, sl.handed_back_team_id, 'remaining', 'landed', sl.handed_back_by, sl.handed_back_at
  from public.club_schedule_slots sl
 where sl.handed_back_team_id is not null and sl.handed_back_at is not null
   and not exists (select 1 from public.club_schedule_hand_back_slots hs where hs.slot_id = sl.id and hs.handed_back);

insert into public.club_schedule_hand_back_slots (hand_back_id, org_id, slot_id, starts_at, ends_at, priced_minutes, cents, handed_back)
select h.id, sl.org_id, sl.id, sl.starts_at, sl.ends_at, f.minutes, round(f.minutes * coalesce(s.bill_scale, 0))::bigint, true
  from public.club_schedule_slots sl
  join public.club_schedules s on s.id = sl.schedule_id
  join public.club_schedule_hand_backs h
    on h.schedule_id = sl.schedule_id and h.team_id = sl.handed_back_team_id and h.asked_at = sl.handed_back_at and h.state = 'landed'
  cross join lateral (
    select round((extract(epoch from (sl.ends_at - sl.starts_at)) / 60.0)
                 * coalesce((select fs.share from public.org_permit_facility_shares fs
                              where fs.permit_id = coalesce(s.bill_permit_id, s.started_from_permit_id) and fs.facility_id = sl.facility_id), 1)
                 / (1 + (select count(*) from public.club_schedule_slot_teams st where st.slot_id = sl.id)), 4) as minutes
  ) f
 where sl.handed_back_team_id is not null and sl.handed_back_at is not null
   and not exists (select 1 from public.club_schedule_hand_back_slots hs where hs.slot_id = sl.id and hs.handed_back);

-- ── 3. The credit ─────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.rep_allocation_credits (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  team_id          uuid not null references public.rep_teams(id) on delete cascade,
  -- ONE bill: the team's share it lowers, its allocation, and the bill's season (the season the bill reads on).
  split_id         uuid not null references public.rep_allocation_splits(id) on delete cascade,
  allocation_id    uuid not null references public.rep_cost_allocations(id) on delete cascade,
  program_year_id  uuid not null references public.rep_program_years(id) on delete cascade,
  amount           numeric(12,2) not null check (amount > 0),
  -- The day the club wrote it, in the club's day (the statement's date). It counts in its BILL's fiscal year.
  credited_on      date not null,
  -- Why, as the statement's second line reads it: "4 Sundays handed back" / "Time moved at Send the changes".
  reason           text not null check (length(btrim(reason)) between 1 and 200),
  -- What wrote it: an accepted hand-back, or a Send the changes (one of them).
  hand_back_id     uuid references public.club_schedule_hand_backs(id) on delete set null,
  send_id          uuid references public.club_schedule_sends(id) on delete set null,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists rep_allocation_credits_split_idx on public.rep_allocation_credits (split_id);
create index if not exists rep_allocation_credits_allocation_idx on public.rep_allocation_credits (allocation_id);
create index if not exists rep_allocation_credits_team_idx on public.rep_allocation_credits (team_id, program_year_id);
create index if not exists rep_allocation_credits_org_idx on public.rep_allocation_credits (org_id);
create index if not exists rep_allocation_credits_program_year_idx on public.rep_allocation_credits (program_year_id);
create index if not exists rep_allocation_credits_hand_back_idx on public.rep_allocation_credits (hand_back_id) where hand_back_id is not null;
create index if not exists rep_allocation_credits_send_idx on public.rep_allocation_credits (send_id) where send_id is not null;
create index if not exists rep_allocation_credits_created_by_idx on public.rep_allocation_credits (created_by) where created_by is not null;

comment on table public.rep_allocation_credits is
  'A CREDIT on the club↔team account (Club Tier Stage 11d, Ask 6; mig 328): money the club took off what a team still owes on ONE bill — a hand-back it accepted, or time it moved off the team at Send the changes. It lowers a debt the club wrote and gives no money; the bill itself never changes (3d Ask 7b). Applied to the bill''s payments when written (rep_allocation_credit_parts, latest unpaid first, never more than what is left) and summed onto rep_allocation_installments.credited_amount in the same step. Its own statement row, dated credited_on; counts in its bill''s fiscal year (a closed one refuses it — rep_allocation_credits_fiscal_lock). Written only by club_credit_apply. Server-only.';

create table if not exists public.rep_allocation_credit_parts (
  credit_id       uuid not null references public.rep_allocation_credits(id) on delete cascade,
  installment_id  uuid not null references public.rep_allocation_installments(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  amount          numeric(12,2) not null check (amount > 0),
  primary key (credit_id, installment_id)
);

create index if not exists rep_allocation_credit_parts_installment_idx on public.rep_allocation_credit_parts (installment_id);
create index if not exists rep_allocation_credit_parts_org_idx on public.rep_allocation_credit_parts (org_id);

comment on table public.rep_allocation_credit_parts is
  'How a credit was applied (Club Tier Stage 11d, mig 328): the part of it each payment took, STORED when the credit was written (latest unpaid payment first — Ask 5; a sent one counts as paid) so a later payment or a take-back can''t move it. The bill''s window reads "$864.00 less a $432.00 credit · Credit Oct 14: 4 Sundays handed back" from it. Σ parts of an installment = its credited_amount (check:club-money-arithmetic recomputes it).';

-- A credit counts in its bill's fiscal year: a closed one refuses it (and a delete, unless the org is going).
create or replace function public.rep_allocation_credits_fiscal_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock_shared(hashtextextended('club_books:' || (case when tg_op = 'DELETE' then old.org_id else new.org_id end)::text, 0));
  if tg_op = 'DELETE' then
    if club_allocation_locked(old.allocation_id) and exists (select 1 from organizations where id = old.org_id) then
      raise exception 'year_closed: a credit on a bill that counts in a closed fiscal year';
    end if;
    return old;
  end if;
  if club_allocation_locked(new.allocation_id) or (tg_op = 'UPDATE' and club_allocation_locked(old.allocation_id)) then
    raise exception 'year_closed: a credit on a bill that counts in a closed fiscal year';
  end if;
  return new;
end;
$$;

drop trigger if exists rep_allocation_credits_fiscal_lock on public.rep_allocation_credits;
create trigger rep_allocation_credits_fiscal_lock
  before insert or delete or update of amount, split_id, allocation_id, team_id on public.rep_allocation_credits
  for each row execute function public.rep_allocation_credits_fiscal_lock();

-- ── 4. The request an ask carries; the request a club move raises ─────────────────────────────────────

alter table public.rep_team_payment_requests drop constraint if exists rep_team_payment_requests_status_check;
alter table public.rep_team_payment_requests
  add constraint rep_team_payment_requests_status_check
  check (status in ('pending', 'approved', 'denied', 'reversed', 'accepted', 'credited'));

alter table public.rep_team_payment_requests
  add column if not exists club_hand_back_id uuid references public.club_schedule_hand_backs(id) on delete set null;
alter table public.rep_team_payment_requests
  add column if not exists club_schedule_send_id uuid references public.club_schedule_sends(id) on delete set null;
alter table public.rep_team_payment_requests drop constraint if exists rep_team_payment_requests_one_club_source_check;
alter table public.rep_team_payment_requests
  add constraint rep_team_payment_requests_one_club_source_check check (num_nonnulls(club_hand_back_id, club_schedule_send_id) <= 1);

create unique index if not exists rep_team_payment_requests_hand_back_uq
  on public.rep_team_payment_requests (club_hand_back_id) where club_hand_back_id is not null;
create index if not exists rep_team_payment_requests_send_idx
  on public.rep_team_payment_requests (club_schedule_send_id) where club_schedule_send_id is not null;

comment on column public.rep_team_payment_requests.status is
  'pending (waiting for the club''s answer) · approved (money moved: two ledger lines) · denied (the product says Declined) · reversed (an approval taken back, mig 315) · accepted (Club Tier Stage 11d, mig 328: the club accepted a hand-back, or moved a team''s time at Send the changes, after the team had paid — it owes this amount until Record paying approves it) · credited (11d: an accepted hand-back settled whole by a credit — closed, no money moved). Waiting on the club = pending or accepted (lib/club-money-figures.ts requestWaitsOnClub).';
comment on column public.rep_team_payment_requests.club_hand_back_id is
  'The hand-back ask this request carries (Club Tier Stage 11d, mig 328): charge_to_org, money_in_meaning ''reimbursement'' (set by the ask, never asked of the coach), its amount the ask''s figure (trued at Accept, and daily while it waits — a Sunday that starts unanswered leaves it). It moves only with its ask: withdrawn with it (deleted), declined with it (denied), accepted with it (credited, or accepted with what the club owes back). A trigger (rep_team_payment_requests_club_guard) refuses any other write to its money or its removal.';
comment on column public.rep_team_payment_requests.club_schedule_send_id is
  'The Send the changes that raised this request (Club Tier Stage 11d, Ask 8; mig 328): time the club moved off a team that had already paid — an accepted request to pay, written in the send''s own step. The club records paying it with the request''s Approve window ("Record paying").';

-- The floor: an ask's request (or a send's) changes only inside its own step.
create or replace function public.rep_team_payment_requests_club_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.club_money_step', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    if (old.club_hand_back_id is not null or old.club_schedule_send_id is not null)
       and exists (select 1 from organizations where id = old.org_id)
       and exists (select 1 from rep_teams where id = old.team_id)
       and exists (select 1 from rep_program_years where id = old.program_year_id) then
      raise exception 'club_request: a request a hand-back or a schedule send carries is removed only with its ask';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.club_hand_back_id is not null or new.club_schedule_send_id is not null or new.status in ('accepted', 'credited') then
      raise exception 'club_request: only a hand-back or a schedule send raises this request';
    end if;
    return new;
  end if;
  -- UPDATE of a linked request: its money, its state, its words and its record (team, club, paid, reviewed, reversed) are
  -- the step's. A schedule's removal nulling the link (ON DELETE SET NULL), a person's or a ledger line's removal nulling
  -- theirs, the season roll's carry (program_year_id), the coach's own filing (budget item / category) and the payout-hold
  -- stamp stay free.
  if old.club_hand_back_id is null and old.club_schedule_send_id is null then
    if new.club_hand_back_id is not null or new.club_schedule_send_id is not null or new.status in ('accepted', 'credited') then
      raise exception 'club_request: only a hand-back or a schedule send links a request';
    end if;
    return new;
  end if;
  if new.request_type is distinct from old.request_type or new.amount is distinct from old.amount
     or new.description is distinct from old.description or new.money_in_meaning is distinct from old.money_in_meaning
     or new.status is distinct from old.status or new.denial_reason is distinct from old.denial_reason
     or new.team_id is distinct from old.team_id or new.org_id is distinct from old.org_id
     or new.paid_on is distinct from old.paid_on or new.paid_method is distinct from old.paid_method
     or new.paid_reference is distinct from old.paid_reference or new.reviewed_at is distinct from old.reviewed_at
     or new.reversed_at is distinct from old.reversed_at or new.reversed_reason is distinct from old.reversed_reason
     or (new.club_hand_back_id is not null and new.club_hand_back_id is distinct from old.club_hand_back_id)
     or (new.club_schedule_send_id is not null and new.club_schedule_send_id is distinct from old.club_schedule_send_id) then
    raise exception 'club_request: a request a hand-back or a schedule send carries changes only with it';
  end if;
  return new;
end;
$$;

drop trigger if exists rep_team_payment_requests_club_guard on public.rep_team_payment_requests;
create trigger rep_team_payment_requests_club_guard
  before insert or update or delete on public.rep_team_payment_requests
  for each row execute function public.rep_team_payment_requests_club_guard();

-- The send log says what each team's lost time settled as (Ask 8): { teamId: { credited, toPay } } in cents.
alter table public.club_schedule_sends add column if not exists settled jsonb not null default '{}'::jsonb;
comment on column public.club_schedule_sends.settled is
  'Ask 8 (Club Tier Stage 11d, mig 328): what each team that LOST time at this Send the changes had settled, in cents — { teamId: { credited, toPay } }: taken off what it owed (rep_allocation_credits.send_id = this row), and what the club owes it back (an accepted request, rep_team_payment_requests.club_schedule_send_id). Written in the send''s own step. Replaces owed_back (no longer written — drop it at the next schema tidy, as bookings_email).';
comment on column public.club_schedule_sends.owed_back is
  'RETIRED by Club Tier Stage 11d (mig 328, Ask 8): build question B''s "owed back — told, its coach asks for it". No longer written (a loss is credited, or raises an accepted request to pay — `settled`). Old rows keep what they said. Drop at the next schema tidy.';

-- ── 5. Allocated, net of credits (the one definition: lib/club-money-figures.ts lineAllocated) ────────
-- (The four steps below keep their migrations' own casing and layout — 317's, 315's — so the atomicity check's
-- mutations read the live shape: scripts/check-club-money-atomicity.mjs.)

CREATE OR REPLACE FUNCTION public.club_line_allocated(p_line uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce((SELECT sum(s.amount)
                     FROM rep_allocation_splits s
                     JOIN rep_cost_allocations a ON a.id = s.allocation_id
                    WHERE a.source_budget_line_id = p_line), 0)
       - coalesce((SELECT sum(c.amount)
                     FROM rep_allocation_credits c
                     JOIN rep_cost_allocations a ON a.id = c.allocation_id
                    WHERE a.source_budget_line_id = p_line), 0);
$$;

-- ── 6. A received payment writes what is due on it ────────────────────────────────────────────────────
-- mig 315's step, exactly, except: the two ledger lines carry the payment's DUE (amount − credited_amount), and a
-- payment a credit covers whole is refused (state 'credited') — it has nothing left to receive.

CREATE OR REPLACE FUNCTION public.club_installment_receive(
  p_installment uuid,
  p_org         uuid,
  p_actor       uuid,
  p_expect      text,
  p_on          date,
  p_method      text,
  p_method_word text,
  p_reference   text,
  p_club_words  text,
  p_team_words  text,
  p_category    text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_inst        rep_allocation_installments%ROWTYPE;
  v_team        uuid;
  v_general     uuid;
  v_team_ledger uuid;
  v_due         numeric;
  v_out         uuid := gen_random_uuid();
  v_in          uuid := gen_random_uuid();
BEGIN
  IF p_expect NOT IN ('unpaid', 'sent') THEN
    RAISE EXCEPTION 'club_installment_receive: p_expect must be unpaid or sent';
  END IF;

  SELECT * INTO v_inst FROM rep_allocation_installments
   WHERE id = p_installment AND org_id = p_org
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;

  IF v_inst.paid_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_changed', 'state', 'received');
  END IF;
  v_due := v_inst.amount - v_inst.credited_amount;
  IF v_due <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_changed', 'state', 'credited');
  END IF;
  IF p_expect = 'unpaid' AND v_inst.sent_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_changed', 'state', 'sent');
  END IF;
  IF p_expect = 'sent' AND v_inst.sent_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_changed', 'state', 'unpaid');
  END IF;

  SELECT team_id INTO v_team FROM rep_allocation_splits WHERE id = v_inst.split_id AND org_id = p_org;
  IF v_team IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;

  v_general     := club_general_ledger(p_org);
  v_team_ledger := club_team_ledger(p_org, v_team);

  -- The team pays, the club receives — what is DUE on the payment (Stage 11d). The payer's half is the one kept.
  INSERT INTO accounting_entries
    (id, ledger_id, entry_date, description, amount, entry_type, status, category, linked_entry_id,
     source_module, source_entity_id, payment_method, created_by)
  VALUES
    (v_out, v_team_ledger, p_on, p_team_words, v_due, 'transfer_out', 'posted', p_category, v_in,
     'rep_allocation_installment', p_installment, p_method_word, p_actor),
    (v_in,  v_general,     p_on, p_club_words, v_due, 'transfer_in',  'posted', p_category, v_out,
     'rep_allocation_installment', p_installment, p_method_word, p_actor);

  UPDATE rep_allocation_installments
     SET paid_at = now(), paid_by = p_actor, paid_on = p_on, paid_method = p_method,
         paid_reference = p_reference, accounting_entry_id = v_out,
         undone_at = NULL, undone_by = NULL, undone_reason = NULL
   WHERE id = p_installment;

  RETURN jsonb_build_object('ok', true, 'entryId', v_out, 'teamId', v_team);
END;
$$;

-- ── 7. Approve: an ask's request is answered by the ask; an accepted one is paid here (Record paying) ─
-- mig 315's step, except: a WAITING request an ask carries is refused (state 'asked' — the club answers the ask, Answer's
-- Accept or Decline, never the request apart from it); an ACCEPTED request (the club owes it) is approved here — the
-- Approve window titled "Record paying" (D6) — writing the same two lines.

CREATE OR REPLACE FUNCTION public.club_request_approve(
  p_request     uuid,
  p_org         uuid,
  p_actor       uuid,
  p_on          date,
  p_method      text,
  p_method_word text,
  p_reference   text,
  p_club_words  text,
  p_team_words  text,
  p_category    text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_req         rep_team_payment_requests%ROWTYPE;
  v_general     uuid;
  v_team_ledger uuid;
  v_from        uuid;
  v_to          uuid;
  v_from_words  text;
  v_to_words    text;
  v_out         uuid := gen_random_uuid();
  v_in          uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_req FROM rep_team_payment_requests
   WHERE id = p_request AND org_id = p_org
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;
  IF v_req.status = 'pending' AND v_req.club_hand_back_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_changed', 'state', 'asked');
  END IF;
  IF v_req.status NOT IN ('pending', 'accepted') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_changed', 'state', v_req.status);
  END IF;
  PERFORM set_config('app.club_money_step', 'on', true);

  v_general     := club_general_ledger(p_org);
  v_team_ledger := club_team_ledger(p_org, v_req.team_id);

  IF v_req.request_type = 'payment_to_org' THEN
    -- To club: the team pays the club.
    v_from := v_team_ledger; v_from_words := p_team_words;
    v_to   := v_general;     v_to_words   := p_club_words;
  ELSE
    -- From club: the club pays the team.
    v_from := v_general;     v_from_words := p_club_words;
    v_to   := v_team_ledger; v_to_words   := p_team_words;
  END IF;

  INSERT INTO accounting_entries
    (id, ledger_id, entry_date, description, amount, entry_type, status, category, linked_entry_id,
     source_module, source_entity_id, payment_method, created_by)
  VALUES
    (v_out, v_from, p_on, v_from_words, v_req.amount, 'transfer_out', 'posted', p_category, v_in,
     'rep_payment_request', p_request, p_method_word, p_actor),
    (v_in,  v_to,   p_on, v_to_words,   v_req.amount, 'transfer_in',  'posted', p_category, v_out,
     'rep_payment_request', p_request, p_method_word, p_actor);

  UPDATE rep_team_payment_requests
     SET status = 'approved', reviewed_by = p_actor, reviewed_at = now(), updated_at = now(),
         paid_on = p_on, paid_method = p_method, paid_reference = p_reference,
         accounting_entry_id = v_out
   WHERE id = p_request;

  PERFORM set_config('app.club_money_step', '', true);
  RETURN jsonb_build_object('ok', true, 'entryId', v_out, 'teamId', v_req.team_id);
END;
$$;

-- mig 315's reverse, exactly, except for a request a hand-back or a send raised (Record paying taken back, /review
-- 2026-10-13): its lines are voided as ever, and it goes back to ACCEPTED — the club still owes it, so the room and every
-- "waiting on the club" reader see it again — never 'reversed', which would drop the debt.
CREATE OR REPLACE FUNCTION public.club_request_reverse(
  p_request uuid,
  p_org     uuid,
  p_actor   uuid,
  p_reason  text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_req rep_team_payment_requests%ROWTYPE;
  v_ids uuid[];
BEGIN
  SELECT * INTO v_req FROM rep_team_payment_requests
   WHERE id = p_request AND org_id = p_org
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;
  IF v_req.status <> 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_changed', 'state', v_req.status);
  END IF;
  -- Approved before 3a: the approval threw its entry id away. Refuse; never guess the pair.
  IF v_req.accounting_entry_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unlinked');
  END IF;
  PERFORM set_config('app.club_money_step', 'on', true);

  v_ids := club_void_entry_pair(v_req.accounting_entry_id, p_reason, p_actor);

  UPDATE rep_team_payment_requests
     SET status = CASE WHEN v_req.club_hand_back_id IS NOT NULL OR v_req.club_schedule_send_id IS NOT NULL
                       THEN 'accepted' ELSE 'reversed' END,
         -- (the reversal record goes with a reversed request only — rep_team_payment_requests_reversal_is_whole_check; a
         -- linked one's taking-back keeps its who and why on the voided lines, club_void_entry_pair)
         reversed_at = CASE WHEN v_req.club_hand_back_id IS NOT NULL OR v_req.club_schedule_send_id IS NOT NULL THEN NULL ELSE now() END,
         reversed_by = CASE WHEN v_req.club_hand_back_id IS NOT NULL OR v_req.club_schedule_send_id IS NOT NULL THEN NULL ELSE p_actor END,
         reversed_reason = CASE WHEN v_req.club_hand_back_id IS NOT NULL OR v_req.club_schedule_send_id IS NOT NULL THEN NULL ELSE p_reason END,
         paid_on = CASE WHEN v_req.club_hand_back_id IS NOT NULL OR v_req.club_schedule_send_id IS NOT NULL THEN NULL ELSE paid_on END,
         paid_method = CASE WHEN v_req.club_hand_back_id IS NOT NULL OR v_req.club_schedule_send_id IS NOT NULL THEN NULL ELSE paid_method END,
         paid_reference = CASE WHEN v_req.club_hand_back_id IS NOT NULL OR v_req.club_schedule_send_id IS NOT NULL THEN NULL ELSE paid_reference END,
         accounting_entry_id = CASE WHEN v_req.club_hand_back_id IS NOT NULL OR v_req.club_schedule_send_id IS NOT NULL THEN NULL ELSE accounting_entry_id END,
         updated_at = now()
   WHERE id = p_request;

  PERFORM set_config('app.club_money_step', '', true);
  RETURN jsonb_build_object('ok', true, 'voided', to_jsonb(v_ids), 'teamId', v_req.team_id);
END;
$$;

-- ── 8. The credit, applied ────────────────────────────────────────────────────────────────────────────
-- Take p_cents off what the team still owes on the bills in p_allocations (the team's bills from one schedule: its
-- first bill and its corrections — one pool, Ask 6): the payments it has neither PAID nor SENT, latest due first, each
-- never below zero. One credit row per bill touched (a credit is against ONE bill), its parts stored, each payment's
-- credited_amount raised by its part. Returns the cents credited; the caller makes the rest a request to pay.
-- A bill that counts in a closed fiscal year refuses: RAISES 'year_closed: …' (the whole step rolls back, and the app
-- answers it in words — the triggers on the rows say the same).

create or replace function public.club_credit_apply(
  p_org uuid, p_team uuid, p_allocations uuid[], p_cents bigint, p_actor uuid, p_on date, p_reason text,
  p_hand_back uuid, p_send uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  v_left     bigint := p_cents;
  v_take     bigint;
  v_credit   uuid;
  v_map      jsonb := '{}'::jsonb;
begin
  if coalesce(p_cents, 0) <= 0 or cardinality(coalesce(p_allocations, '{}'::uuid[])) = 0 then return 0; end if;
  for r in
    select i.id, i.split_id, s.allocation_id, s.program_year_id,
           round((i.amount - i.credited_amount) * 100)::bigint as due_cents
      from rep_allocation_installments i
      join rep_allocation_splits s on s.id = i.split_id
     where s.team_id = p_team and s.org_id = p_org and s.allocation_id = any (p_allocations)
       and i.paid_at is null and i.sent_at is null and i.amount > i.credited_amount
     order by i.due_date desc, i.installment_number desc, i.id desc
     for update of i
  loop
    exit when v_left <= 0;
    v_take := least(v_left, r.due_cents);
    if v_take <= 0 then continue; end if;
    if club_allocation_locked(r.allocation_id) then
      raise exception 'year_closed: a credit on a bill that counts in a closed fiscal year';
    end if;
    if v_map ? r.split_id::text then
      v_credit := (v_map->>r.split_id::text)::uuid;
      update rep_allocation_credits set amount = amount + v_take / 100.0 where id = v_credit;
    else
      insert into rep_allocation_credits (org_id, team_id, split_id, allocation_id, program_year_id, amount, credited_on,
                                          reason, hand_back_id, send_id, created_by)
      values (p_org, p_team, r.split_id, r.allocation_id, r.program_year_id, v_take / 100.0, p_on,
              left(btrim(p_reason), 200), p_hand_back, p_send, p_actor)
      returning id into v_credit;
      v_map := v_map || jsonb_build_object(r.split_id::text, v_credit);
    end if;
    insert into rep_allocation_credit_parts (credit_id, installment_id, org_id, amount)
    values (v_credit, r.id, p_org, v_take / 100.0);
    update rep_allocation_installments set credited_amount = credited_amount + v_take / 100.0 where id = r.id;
    v_left := v_left - v_take;
  end loop;
  return p_cents - v_left;
end;
$$;

-- The team's bills from one schedule: its first bill and every landed correction (one pool for a credit).
create or replace function public.club_schedule_bill_pool(p_schedule uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct a), '{}'::uuid[]) from (
    select allocation_id a from club_schedules where id = p_schedule and allocation_id is not null
    union
    select allocation_id from club_schedule_sends where schedule_id = p_schedule and landed_at is not null and allocation_id is not null
  ) x;
$$;

-- ROOM: what a team may still ask back from one schedule, in cents — its bills from the schedule, less the credits
-- against them, less what the club already owes or paid it back for the schedule (accepted / approved requests a
-- hand-back or a send raised), less every other ask of the team on it still waiting (`p_except`: the ask being
-- answered). Never more than the team was billed (Ask 1: "never more than the team's bills from this schedule less the
-- credits already given").
create or replace function public.club_hand_back_room(p_org uuid, p_schedule uuid, p_team uuid, p_except uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  with pool as (select unnest(club_schedule_bill_pool(p_schedule)) a)
  select greatest(0,
      coalesce((select round(sum(s.amount) * 100)::bigint from rep_allocation_splits s
                 where s.org_id = p_org and s.team_id = p_team and s.allocation_id in (select a from pool)), 0)
    - coalesce((select round(sum(c.amount) * 100)::bigint from rep_allocation_credits c
                 where c.org_id = p_org and c.team_id = p_team and c.allocation_id in (select a from pool)), 0)
    - coalesce((select round(sum(q.amount) * 100)::bigint from rep_team_payment_requests q
                 where q.org_id = p_org and q.team_id = p_team and q.status in ('accepted', 'approved')
                   and (q.club_hand_back_id in (select id from club_schedule_hand_backs where schedule_id = p_schedule)
                        or q.club_schedule_send_id in (select id from club_schedule_sends where schedule_id = p_schedule))), 0)
    - coalesce((select sum(h.asked_cents) from club_schedule_hand_backs h
                 where h.org_id = p_org and h.schedule_id = p_schedule and h.team_id = p_team and h.state = 'waiting'
                   and h.id is distinct from p_except), 0));
$$;

-- ── 9. Handing practices back (the shared part of a plain hand-back and an accepted ask) ──────────────
-- For each practice: the team leaves the slot (it reads "Open · handed back by {team}"), the practice goes the mirror's
-- way (cancelled when worked on, deleted when untouched). The CALLER holds the schedule's lock and has checked each
-- practice is the team's live club practice on a standing slot. ⚖ Never sets Changed since sent (Ask 9).

create or replace function public.club_hand_back_events(p_org uuid, p_team uuid, p_actor uuid, p_slots uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot    uuid;
  v_event   uuid;
  v_fate    text;
  v_done    uuid[] := '{}';
  v_cancel  integer := 0;
  v_delete  integer := 0;
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
    v_fate := club_practice_retire(v_event);
    if v_fate = 'cancelled' then v_cancel := v_cancel + 1; elsif v_fate = 'deleted' then v_delete := v_delete + 1; end if;
    v_done := v_done || v_slot;
  end loop;
  return jsonb_build_object('slots', to_jsonb(v_done), 'cancelled', v_cancel, 'deleted', v_delete);
end;
$$;

-- ── 10. Hand back without money (Ask 17 as built; Ask 9) ──────────────────────────────────────────────
-- `p_slots`: [{ eventId, slotId, startsAt, endsAt, pricedMinutes, cents }] — the practices the route worked out (this ·
-- this & future · all), each with its slot's figure. Lands at once; writes the hand-back's record (landed) with the
-- slots that actually left the team. A practice whose slot is in a waiting ask is left alone (its ask answers for it).
-- ⚖ It no longer marks the schedule Changed since sent (Ask 9, S11D-02): the team already has the change.

drop function if exists public.club_schedule_hand_back(uuid, uuid, uuid, uuid[]);
create or replace function public.club_schedule_hand_back(p_org uuid, p_team uuid, p_actor uuid, p_schedule uuid, p_scope text, p_slots jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s        club_schedules%rowtype;
  v_row      jsonb;
  v_keep     jsonb := '[]'::jsonb;
  v_slots    uuid[] := '{}';
  v_res      jsonb;
  v_hb       uuid;
begin
  select * into v_s from club_schedules where id = p_schedule and org_id = p_org for update;
  if not found or v_s.state <> 'final' then return jsonb_build_object('ok', false, 'code', 'not_the_clubs'); end if;
  -- Read again under the schedule's lock: a send or an edit that held it may have moved the practice, removed its slot
  -- or retired it while this waited (/review 2026-10-11).
  for v_row in select * from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb)) loop
    if exists (select 1 from rep_team_events e join club_schedule_slots sl on sl.id = e.club_schedule_slot_id
                where e.id = (v_row->>'eventId')::uuid and e.org_id = p_org and e.team_id = p_team and e.status <> 'cancelled'
                  and sl.id = (v_row->>'slotId')::uuid and sl.schedule_id = p_schedule and sl.removed_at is null
                  and sl.starts_at > now()
                  and exists (select 1 from club_schedule_slot_teams st where st.slot_id = sl.id and st.team_id = p_team))
       and not exists (select 1 from club_schedule_hand_back_slots w where w.slot_id = (v_row->>'slotId')::uuid and w.waiting) then
      v_keep := v_keep || jsonb_build_array(v_row);
      v_slots := v_slots || (v_row->>'slotId')::uuid;
    end if;
  end loop;
  if cardinality(v_slots) = 0 then
    return jsonb_build_object('ok', true, 'slots', '[]'::jsonb, 'cancelled', 0, 'deleted', 0, 'handBackId', null);
  end if;

  v_res := club_hand_back_events(p_org, p_team, p_actor, v_slots);
  insert into club_schedule_hand_backs (org_id, schedule_id, team_id, scope, state, asked_by)
  values (p_org, p_schedule, p_team, p_scope, 'landed', p_actor)
  returning id into v_hb;
  insert into club_schedule_hand_back_slots (hand_back_id, org_id, slot_id, event_id, starts_at, ends_at, priced_minutes, cents, handed_back)
  select v_hb, p_org, (k->>'slotId')::uuid, (k->>'eventId')::uuid, (k->>'startsAt')::timestamptz, (k->>'endsAt')::timestamptz,
         coalesce((k->>'pricedMinutes')::numeric, 0), coalesce((k->>'cents')::bigint, 0),
         (k->>'slotId')::uuid = any (select jsonb_array_elements_text(v_res->'slots')::uuid)
    from jsonb_array_elements(v_keep) k;
  -- The page's edits act on the version they read; the slots changed. Never Changed since sent (Ask 9).
  update club_schedules set version = version + 1, updated_at = now() where id = p_schedule;
  return jsonb_build_object('ok', true, 'slots', v_res->'slots', 'cancelled', v_res->'cancelled', 'deleted', v_res->'deleted',
                            'handBackId', v_hb);
end;
$$;

-- ── 11. Ask for money back (Asks 1, 2, 4) ─────────────────────────────────────────────────────────────
-- `p_slots`: as the plain hand-back's — each the team's live club practice on a standing slot of this FINAL schedule that
-- hasn't started, none already in a waiting ask. Nothing is handed back yet (Ask 2: the practices stay the team's until
-- the club answers). The request it carries: `p_request` { programYearId, description, budgetItemId, budgetCategoryId,
-- budgetLineId } — charge_to_org, 'reimbursement', pending, the figure. Refusals before any write: not_final · changed
-- (a practice moved, went, started or is already asked) · nothing (no figure) · over_room (more than the team can still
-- ask back from this schedule).

create or replace function public.club_hand_back_ask(
  p_org uuid, p_schedule uuid, p_team uuid, p_actor uuid, p_scope text, p_slots jsonb, p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s      club_schedules%rowtype;
  v_row    jsonb;
  v_cents  bigint := 0;
  v_room   bigint;
  v_hb     uuid;
  v_req    uuid;
begin
  select * into v_s from club_schedules where id = p_schedule and org_id = p_org for update;
  if not found or v_s.state <> 'final' then return jsonb_build_object('ok', false, 'code', 'not_final'); end if;
  if jsonb_array_length(coalesce(p_slots, '[]'::jsonb)) = 0 then return jsonb_build_object('ok', false, 'code', 'nothing'); end if;
  for v_row in select * from jsonb_array_elements(p_slots) loop
    if not exists (select 1 from rep_team_events e
                     join club_schedule_slots sl on sl.id = e.club_schedule_slot_id
                     join club_schedule_slot_teams st on st.slot_id = sl.id and st.team_id = p_team
                    where e.id = (v_row->>'eventId')::uuid and e.org_id = p_org and e.team_id = p_team and e.status <> 'cancelled'
                      and sl.id = (v_row->>'slotId')::uuid and sl.schedule_id = p_schedule and sl.removed_at is null
                      and sl.starts_at > now())
       or exists (select 1 from club_schedule_hand_back_slots w where w.slot_id = (v_row->>'slotId')::uuid and w.waiting) then
      return jsonb_build_object('ok', false, 'code', 'changed');
    end if;
    v_cents := v_cents + coalesce((v_row->>'cents')::bigint, 0);
  end loop;
  if v_cents <= 0 then return jsonb_build_object('ok', false, 'code', 'nothing'); end if;
  v_room := club_hand_back_room(p_org, p_schedule, p_team, null);
  if v_cents > v_room then return jsonb_build_object('ok', false, 'code', 'over_room', 'room', v_room); end if;
  if not exists (select 1 from rep_program_years where id = nullif(p_request->>'programYearId', '')::uuid
                                                  and team_id = p_team and org_id = p_org) then
    return jsonb_build_object('ok', false, 'code', 'changed');
  end if;

  perform set_config('app.club_money_step', 'on', true);
  insert into club_schedule_hand_backs (org_id, schedule_id, team_id, scope, state, asked_cents, asked_by)
  values (p_org, p_schedule, p_team, p_scope, 'waiting', v_cents, p_actor)
  returning id into v_hb;
  insert into club_schedule_hand_back_slots (hand_back_id, org_id, slot_id, event_id, starts_at, ends_at, priced_minutes, cents, waiting)
  select v_hb, p_org, (k->>'slotId')::uuid, (k->>'eventId')::uuid, (k->>'startsAt')::timestamptz, (k->>'endsAt')::timestamptz,
         coalesce((k->>'pricedMinutes')::numeric, 0), coalesce((k->>'cents')::bigint, 0), true
    from jsonb_array_elements(p_slots) k;
  insert into rep_team_payment_requests (org_id, team_id, program_year_id, request_type, amount, description, status,
                                         money_in_meaning, budget_item_id, budget_category_id, budget_line_id, created_by,
                                         club_hand_back_id)
  values (p_org, p_team, (p_request->>'programYearId')::uuid, 'charge_to_org', v_cents / 100.0,
          left(btrim(p_request->>'description'), 500), 'pending', 'reimbursement',
          nullif(p_request->>'budgetItemId', '')::uuid, nullif(p_request->>'budgetCategoryId', '')::uuid,
          nullif(p_request->>'budgetLineId', '')::uuid, p_actor, v_hb)
  returning id into v_req;
  perform set_config('app.club_money_step', '', true);
  return jsonb_build_object('ok', true, 'handBackId', v_hb, 'requestId', v_req, 'cents', v_cents);
end;
$$;

-- ── 12. Withdraw (Ask 3): the ask and its request go together; nothing else changed ───────────────────

create or replace function public.club_hand_back_withdraw(p_org uuid, p_team uuid, p_actor uuid, p_hand_back uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hb club_schedule_hand_backs%rowtype;
begin
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back and org_id = p_org and team_id = p_team;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  perform 1 from club_schedules where id = v_hb.schedule_id for update;
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back for update;
  if v_hb.state <> 'waiting' then return jsonb_build_object('ok', false, 'code', 'answered', 'state', v_hb.state); end if;
  perform set_config('app.club_money_step', 'on', true);
  update club_schedule_hand_backs set state = 'withdrawn', closed_by = p_actor, closed_at = now() where id = p_hand_back;
  update club_schedule_hand_back_slots set waiting = false where hand_back_id = p_hand_back;
  delete from rep_team_payment_requests where club_hand_back_id = p_hand_back;
  perform set_config('app.club_money_step', '', true);
  return jsonb_build_object('ok', true, 'scheduleId', v_hb.schedule_id);
end;
$$;

-- ── 13. Decline (Ask 3): the Sundays stay the team's; the coach reads the reason ──────────────────────

create or replace function public.club_hand_back_decline(p_org uuid, p_actor uuid, p_hand_back uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hb club_schedule_hand_backs%rowtype;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
begin
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back and org_id = p_org;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  perform 1 from club_schedules where id = v_hb.schedule_id for update;
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back for update;
  if v_hb.state <> 'waiting' then return jsonb_build_object('ok', false, 'code', 'answered', 'state', v_hb.state); end if;
  perform set_config('app.club_money_step', 'on', true);
  update club_schedule_hand_backs set state = 'declined', closed_by = p_actor, closed_at = now(), decline_reason = v_reason
   where id = p_hand_back;
  update club_schedule_hand_back_slots set waiting = false where hand_back_id = p_hand_back;
  update rep_team_payment_requests set status = 'denied', denial_reason = v_reason, reviewed_by = p_actor,
                                       reviewed_at = now(), updated_at = now()
   where club_hand_back_id = p_hand_back;
  perform set_config('app.club_money_step', '', true);
  return jsonb_build_object('ok', true, 'teamId', v_hb.team_id, 'scheduleId', v_hb.schedule_id);
end;
$$;

-- ── 14. Accept (Asks 3, 5, 6, 7, 9): one step ─────────────────────────────────────────────────────────
-- Under the schedule's lock: the ask's LIVE slots — still the team's, its practice still on it, not started at this
-- moment (Ask 7: a Sunday that started drops out, and its figure with it); the figure, never more than the room; the
-- credit off what the team still owes (club_credit_apply — a closed year RAISES and nothing lands); the slots handed
-- back; the request trued: `credited` (the whole figure came off what it owed) or `accepted` carrying what the club owes
-- it back (Record paying approves it). Never Changed since sent (Ask 9).
-- Refusals before any write: not_found · answered (+ state) · lapsed (every Sunday started) · stale (nothing of it is
-- still the team's to hand back).

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
begin
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back and org_id = p_org;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  perform 1 from club_schedules where id = v_hb.schedule_id for update;
  select * into v_hb from club_schedule_hand_backs where id = p_hand_back for update;
  if v_hb.state <> 'waiting' then return jsonb_build_object('ok', false, 'code', 'answered', 'state', v_hb.state); end if;

  select coalesce(array_agg(hs.slot_id order by hs.starts_at), '{}'), coalesce(sum(hs.cents), 0)
    into v_live, v_cents
    from club_schedule_hand_back_slots hs
    join club_schedule_slots sl on sl.id = hs.slot_id and sl.removed_at is null
    join club_schedule_slot_teams st on st.slot_id = sl.id and st.team_id = v_hb.team_id
   where hs.hand_back_id = p_hand_back and sl.starts_at > now()
     and exists (select 1 from rep_team_events e where e.team_id = v_hb.team_id and e.club_schedule_slot_id = sl.id
                                                   and e.status <> 'cancelled');
  if cardinality(v_live) = 0 then
    if not exists (select 1 from club_schedule_hand_back_slots hs
                     join club_schedule_slots sl on sl.id = hs.slot_id and sl.removed_at is null
                    where hs.hand_back_id = p_hand_back and sl.starts_at > now()) then
      return jsonb_build_object('ok', false, 'code', 'lapsed');
    end if;
    return jsonb_build_object('ok', false, 'code', 'stale');
  end if;
  v_room := club_hand_back_room(p_org, v_hb.schedule_id, v_hb.team_id, p_hand_back);
  v_cents := least(v_cents, v_room);
  if v_cents <= 0 then return jsonb_build_object('ok', false, 'code', 'stale'); end if;

  perform set_config('app.club_money_step', 'on', true);
  -- The money first: a closed year raises here, before a single practice moves.
  v_credit := club_credit_apply(p_org, v_hb.team_id, club_schedule_bill_pool(v_hb.schedule_id), v_cents, p_actor, p_on,
                                p_reason, p_hand_back, null);
  v_rest := v_cents - v_credit;
  v_res := club_hand_back_events(p_org, v_hb.team_id, p_actor, v_live);

  update club_schedule_hand_back_slots set waiting = false,
         handed_back = coalesce(slot_id = any (select jsonb_array_elements_text(v_res->'slots')::uuid), false)
   where hand_back_id = p_hand_back;
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
                            'cents', v_cents, 'credited', v_credit, 'toPay', v_rest,
                            'slots', v_res->'slots', 'cancelled', v_res->'cancelled', 'deleted', v_res->'deleted');
end;
$$;

-- ── 15. The daily sweep (Ask 7; owner 2026-10-12: "a step in the existing daily scheduled sweep") ──────
-- Every waiting ask with no Sunday still to come (each slot, as it stands, has started or is gone) closes (lapsed), its
-- request with it (deleted — nothing was decided), and is returned for the coach's notice; every other waiting ask's
-- request is trued to the figure Accept would settle (a Sunday that started, or left the team, left it). Read exactly as
-- Accept reads it (/review 2026-10-13). Safe to run any time: a second run finds nothing to change.

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
  for v_hb in select h.* from club_schedule_hand_backs h where h.state = 'waiting' order by h.asked_at for update skip locked loop
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

-- ── 16. Send the changes settles a lost Sunday as a hand-back does (Ask 8) ─────────────────────────────
-- 326's step, exactly, except: `p_losses` [{ teamId, cents, reason, request: { programYearId, description, budgetItemId,
-- budgetCategoryId, budgetLineId } }] — each team that LOST time (Bill the corrections on) is credited off what it still
-- owes on the schedule's bills, and what it had already paid becomes an ACCEPTED request to pay (the club made the
-- change, so there is nothing to confirm). Written in this step with its baseline (11a's High: never after the emails).
-- `owed_back` is no longer written; `settled` says it. A closed year RAISES ('year_closed: …') and nothing lands.

drop function if exists public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb);
create or replace function public.club_schedule_apply_changes(
  p_org uuid, p_schedule uuid, p_actor uuid, p_version integer,
  p_inserts jsonb, p_updates jsonb, p_retire uuid[], p_bill jsonb, p_send uuid, p_log jsonb, p_losses jsonb
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
                            'cancelled', v_cancel, 'deleted', v_delete, 'settled', v_settled);
end;
$$;

-- ── 17. The season roll carries a waiting ask's request with its practices ────────────────────────────
-- 326's step, exactly, plus: the request a WAITING ask carries moves to the new season with the practices it is about, so
-- the old season closes clear of it and the coach reads it where the practices now are.

create or replace function public.club_practices_carry(p_org uuid, p_team uuid, p_from uuid, p_to uuid, p_after timestamptz, p_players jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_events uuid[];
begin
  if not exists (select 1 from rep_program_years where id = p_to and team_id = p_team and org_id = p_org) then
    raise exception 'carry_season: the new season is not the team''s';
  end if;
  select coalesce(array_agg(id), '{}') into v_events from rep_team_events
   where team_id = p_team and org_id = p_org and program_year_id = p_from
     and club_schedule_slot_id is not null and starts_at >= p_after;
  if cardinality(v_events) = 0 then return 0; end if;
  update rep_team_events set program_year_id = p_to, updated_at = now() where id = any (v_events);
  delete from rep_team_event_attendance
   where event_id = any (v_events) and not (coalesce(p_players, '{}'::jsonb) ? player_id::text);
  update rep_team_event_attendance
     set program_year_id = p_to, player_id = (p_players->>player_id::text)::uuid, updated_at = now()
   where event_id = any (v_events);
  update rep_team_lineups set program_year_id = p_to, updated_at = now() where event_id = any (v_events);
  update rep_team_payment_requests set program_year_id = p_to, updated_at = now()
   where org_id = p_org and team_id = p_team and program_year_id = p_from and status = 'pending'
     and club_hand_back_id in (select id from club_schedule_hand_backs where team_id = p_team and state = 'waiting');
  return cardinality(v_events);
end;
$$;

-- ── 18. Server-only ──────────────────────────────────────────────────────────────────────────────────

alter table public.club_schedule_hand_backs enable row level security;
alter table public.club_schedule_hand_back_slots enable row level security;
alter table public.rep_allocation_credits enable row level security;
alter table public.rep_allocation_credit_parts enable row level security;

revoke all on public.club_schedule_hand_backs, public.club_schedule_hand_back_slots,
              public.rep_allocation_credits, public.rep_allocation_credit_parts from anon, authenticated;
grant select, insert, update, delete on public.club_schedule_hand_backs, public.club_schedule_hand_back_slots,
                                        public.rep_allocation_credits, public.rep_allocation_credit_parts to service_role;

revoke all on function
  public.rep_allocation_credits_fiscal_lock(),
  public.rep_team_payment_requests_club_guard(),
  public.club_credit_apply(uuid, uuid, uuid[], bigint, uuid, date, text, uuid, uuid),
  public.club_schedule_bill_pool(uuid),
  public.club_hand_back_room(uuid, uuid, uuid, uuid),
  public.club_hand_back_events(uuid, uuid, uuid, uuid[]),
  public.club_schedule_hand_back(uuid, uuid, uuid, uuid, text, jsonb),
  public.club_hand_back_ask(uuid, uuid, uuid, uuid, text, jsonb, jsonb),
  public.club_hand_back_withdraw(uuid, uuid, uuid, uuid),
  public.club_hand_back_decline(uuid, uuid, uuid, text),
  public.club_hand_back_accept(uuid, uuid, uuid, date, text),
  public.club_hand_back_sweep(),
  public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb),
  public.club_practices_carry(uuid, uuid, uuid, uuid, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function
  public.club_hand_back_room(uuid, uuid, uuid, uuid),
  public.club_schedule_hand_back(uuid, uuid, uuid, uuid, text, jsonb),
  public.club_hand_back_ask(uuid, uuid, uuid, uuid, text, jsonb, jsonb),
  public.club_hand_back_withdraw(uuid, uuid, uuid, uuid),
  public.club_hand_back_decline(uuid, uuid, uuid, text),
  public.club_hand_back_accept(uuid, uuid, uuid, date, text),
  public.club_hand_back_sweep(),
  public.club_schedule_apply_changes(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb),
  public.club_practices_carry(uuid, uuid, uuid, uuid, timestamptz, jsonb)
  to service_role;

commit;
