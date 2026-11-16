-- 489_a_bill_keeps_each_permits_rate.sql
--
-- A schedule on several permits, Session C (build prompt docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_BUILD_PROMPT.md;
-- plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §4e and §8 Phase 3; /dba Finding #50 "Mig 3 (C)" and Finding #51, 2026-11-15).
-- The bill prices each slot at its own permit's price, or every slot at one rate for all (owner rulings P1–P3 A), and a
-- permit added after the bill is its own small bill at its own price (P9 B). The bill's terms never change once made, so the
-- rate each permit was billed at is KEPT, here, at the moment of the bill.
--
-- WHAT CHANGES
--   1. club_schedules.bill_price_mode (NEW, not null, default 'each_permit'): how the draft's bill prices the time —
--      'each_permit' (a slot costs what its permit charges for that field) or 'one_rate' (the same total, re-shared at one
--      rate per full-field hour). Only matters when the time has more than one price. Frozen once the bill is made
--      (trigger club_schedules_bill_price_mode_frozen: refused once allocation_id is set).
--   2. club_schedule_bill_rates (NEW): the rate each permit behind the bill was billed at, in cents per full-field minute
--      (bill_scale's unit). ONE ROW PER PERMIT, IN BOTH MODES (/dba #51 R1): a one-rate bill's rows all carry the one rate,
--      so "was this permit behind the bill?" is a stored fact (P9 B). Each-permit rows are the permit's price × (the total ÷
--      the time's price), so a typed part scales every row alike and Σ priced minutes × the row's rate = the bill.
--        first_billed_send_id: null = written at the bill's making (Finalize, Send the bill); set = the Send the changes that
--        first billed time on a permit that was not behind the bill (P9 B: its own price, kept from then on).
--        permit_id → org_permits ON DELETE SET NULL with permit_name kept, so a deleted permit's rate and name outlive it.
--      bill_scale STAYS with today's meaning (the bill's total ÷ its priced minutes): the rate of a slot with no permit, and
--      a bill with NO rate rows (made before this, or by the old code between the apply and the promote) prices EVERY slot
--      at it (/dba #51 R2 — never "never billed, so its own price").
--   3. club_schedule_bill_rates_put(...): the one writer (insert, on conflict do nothing). No role may call it; only the
--      three definer wrappers below reach it.
--   4. club_schedule_finalize_priced / club_schedule_bill_late_priced / club_schedule_apply_changes_priced (NEW): the inner
--      function's exact arguments plus (p_mode, p_rates); they call it and write the rates only when it returned ok — one
--      RPC, one transaction. The inner three are untouched and stay callable (old prod code calls them until the promote).
--      The late-bill wrapper sets the mode before the inner runs (the row is unbilled then) and puts it back on a refusal.
--   5. Backfill (re-runnable): a billed schedule with no rate rows gets one per permit behind it — its rows' permits, its
--      bill permit and the permit it started from — at bill_scale, so every number a sent schedule shows stays the same.
--
-- Idempotent.

begin;

set local lock_timeout = '15s';

-- ── 1. The mode ──────────────────────────────────────────────────────────────────────────────────────────────────────
alter table public.club_schedules add column if not exists bill_price_mode text not null default 'each_permit';
alter table public.club_schedules drop constraint if exists club_schedules_bill_price_mode_check;
alter table public.club_schedules
  add constraint club_schedules_bill_price_mode_check check (bill_price_mode in ('each_permit', 'one_rate'));
comment on column public.club_schedules.bill_price_mode is
  'How the bill prices the time when it has more than one price (mig 489, P2 A): each_permit (default; a slot costs what its permit charges for that field) or one_rate (the same total ÷ all priced minutes, every team at one rate). A bill term: frozen once allocation_id is set (trigger club_schedules_bill_price_mode_frozen).';

create or replace function public.club_schedules_bill_price_mode_frozen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.allocation_id is not null and new.bill_price_mode is distinct from old.bill_price_mode then
    raise exception 'bill_terms: a bill''s terms never change once it is made';
  end if;
  return new;
end;
$$;

drop trigger if exists club_schedules_bill_price_mode_frozen on public.club_schedules;
create trigger club_schedules_bill_price_mode_frozen
  before update of bill_price_mode on public.club_schedules
  for each row execute function public.club_schedules_bill_price_mode_frozen();
revoke all on function public.club_schedules_bill_price_mode_frozen() from public, anon, authenticated;

-- ── 2. The rates ─────────────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.club_schedule_bill_rates (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id) on delete cascade,
  schedule_id          uuid not null references public.club_schedules(id) on delete cascade,
  permit_id            uuid references public.org_permits(id) on delete set null,
  permit_name          text not null,
  scale                numeric(14,10) not null,
  first_billed_send_id uuid references public.club_schedule_sends(id) on delete set null,
  created_at           timestamptz not null default now(),
  constraint club_schedule_bill_rates_scale_check check (scale > 0),
  constraint club_schedule_bill_rates_schedule_permit_key unique (schedule_id, permit_id)
);

create index if not exists club_schedule_bill_rates_org_idx on public.club_schedule_bill_rates (org_id);
create index if not exists club_schedule_bill_rates_permit_idx on public.club_schedule_bill_rates (permit_id) where permit_id is not null;
create index if not exists club_schedule_bill_rates_send_idx on public.club_schedule_bill_rates (first_billed_send_id) where first_billed_send_id is not null;

comment on table public.club_schedule_bill_rates is
  'The rate each permit behind a schedule''s bill was billed at (mig 489, P1–P3 A, P9 B): scale = cents per full-field minute (club_schedules.bill_scale''s unit). One row per permit in BOTH modes (a one-rate bill''s rows all carry the one rate). Written at the bill''s making (first_billed_send_id null) and, for a permit that was not behind the bill, at the Send the changes that first bills its time (its own price, kept from then on). Never updated: a bill''s terms never change. A billed schedule with NO rows prices every slot at bill_scale. Written only by club_schedule_bill_rates_put via the _priced bill functions.';
comment on column public.club_schedule_bill_rates.permit_name is
  'The permit''s name when its rate was kept, so a deleted permit''s rate can still be named on the bill''s read-only view.';
comment on column public.club_schedule_bill_rates.first_billed_send_id is
  'Null = kept at the bill''s making (Finalize or Send the bill). Set = the Send the changes that first billed time on this permit, which was not behind the bill (P9 B).';

create or replace function public.club_schedule_bill_rates_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from club_schedules where id = new.schedule_id and org_id = new.org_id) then
    raise exception 'bill_rate: the schedule is not this club''s';
  end if;
  if new.permit_id is not null and not exists (select 1 from org_permits where id = new.permit_id and org_id = new.org_id) then
    raise exception 'bill_rate: the permit is not this club''s';
  end if;
  if new.first_billed_send_id is not null
     and not exists (select 1 from club_schedule_sends where id = new.first_billed_send_id and schedule_id = new.schedule_id) then
    raise exception 'bill_rate: the send is not this schedule''s';
  end if;
  return new;
end;
$$;

drop trigger if exists club_schedule_bill_rates_check on public.club_schedule_bill_rates;
create trigger club_schedule_bill_rates_check
  before insert or update on public.club_schedule_bill_rates
  for each row execute function public.club_schedule_bill_rates_check();
revoke all on function public.club_schedule_bill_rates_check() from public, anon, authenticated;

alter table public.club_schedule_bill_rates enable row level security;
revoke all on public.club_schedule_bill_rates from anon, authenticated;
grant select, insert, update, delete on public.club_schedule_bill_rates to service_role;

-- ── 3. The one writer ────────────────────────────────────────────────────────────────────────────────────────────────
-- p_rates: [{ permitId, permitName, scale }]. A permit already kept keeps its rate (on conflict do nothing).
create or replace function public.club_schedule_bill_rates_put(p_org uuid, p_schedule uuid, p_rates jsonb, p_send uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  insert into club_schedule_bill_rates (org_id, schedule_id, permit_id, permit_name, scale, first_billed_send_id)
  select p_org, p_schedule, (r->>'permitId')::uuid, r->>'permitName', (r->>'scale')::numeric, p_send
    from jsonb_array_elements(coalesce(p_rates, '[]'::jsonb)) r
  on conflict (schedule_id, permit_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.club_schedule_bill_rates_put(uuid, uuid, jsonb, uuid) from public, anon, authenticated, service_role;

-- ── 4. The bill functions, priced ────────────────────────────────────────────────────────────────────────────────────
create or replace function public.club_schedule_finalize_priced(
  p_org uuid, p_schedule uuid, p_actor uuid, p_version integer, p_rows jsonb, p_bill jsonb, p_scale numeric,
  p_send uuid, p_log jsonb, p_rates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res jsonb;
begin
  v_res := club_schedule_finalize(p_org, p_schedule, p_actor, p_version, p_rows, p_bill, p_scale, p_send, p_log);
  if coalesce((v_res->>'ok')::boolean, false) and p_bill is not null then
    perform club_schedule_bill_rates_put(p_org, p_schedule, p_rates, null);
  end if;
  return v_res;
end;
$$;

create or replace function public.club_schedule_bill_late_priced(
  p_org uuid, p_schedule uuid, p_actor uuid, p_version integer,
  p_terms jsonb, p_bill jsonb, p_scale numeric, p_send uuid, p_log jsonb, p_mode text, p_rates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res jsonb;
  v_was text;
begin
  -- The mode is a bill term: set while the row is unbilled (the freeze trigger refuses it after), put back on a refusal.
  select bill_price_mode into v_was from club_schedules where id = p_schedule and org_id = p_org for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if p_mode is not null and p_mode is distinct from v_was then
    update club_schedules set bill_price_mode = p_mode where id = p_schedule and allocation_id is null;
  end if;
  v_res := club_schedule_bill_late(p_org, p_schedule, p_actor, p_version, p_terms, p_bill, p_scale, p_send, p_log);
  if coalesce((v_res->>'ok')::boolean, false) then
    perform club_schedule_bill_rates_put(p_org, p_schedule, p_rates, null);
  elsif p_mode is not null and p_mode is distinct from v_was then
    update club_schedules set bill_price_mode = v_was where id = p_schedule and allocation_id is null;
  end if;
  return v_res;
end;
$$;

create or replace function public.club_schedule_apply_changes_priced(
  p_org uuid, p_schedule uuid, p_actor uuid, p_version integer,
  p_inserts jsonb, p_updates jsonb, p_retire uuid[], p_bill jsonb, p_send uuid, p_log jsonb, p_losses jsonb,
  p_league jsonb, p_rates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res jsonb;
begin
  v_res := club_schedule_apply_changes(p_org, p_schedule, p_actor, p_version, p_inserts, p_updates, p_retire, p_bill, p_send,
                                       p_log, p_losses, p_league);
  if coalesce((v_res->>'ok')::boolean, false) and jsonb_array_length(coalesce(p_rates, '[]'::jsonb)) > 0 then
    perform club_schedule_bill_rates_put(p_org, p_schedule, p_rates, p_send);
  end if;
  return v_res;
end;
$$;

revoke all on function
  public.club_schedule_finalize_priced(uuid, uuid, uuid, integer, jsonb, jsonb, numeric, uuid, jsonb, jsonb),
  public.club_schedule_bill_late_priced(uuid, uuid, uuid, integer, jsonb, jsonb, numeric, uuid, jsonb, text, jsonb),
  public.club_schedule_apply_changes_priced(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function
  public.club_schedule_finalize_priced(uuid, uuid, uuid, integer, jsonb, jsonb, numeric, uuid, jsonb, jsonb),
  public.club_schedule_bill_late_priced(uuid, uuid, uuid, integer, jsonb, jsonb, numeric, uuid, jsonb, text, jsonb),
  public.club_schedule_apply_changes_priced(uuid, uuid, uuid, integer, jsonb, jsonb, uuid[], jsonb, uuid, jsonb, jsonb, jsonb, jsonb)
  to service_role;

-- ── 5. Backfill: the bills already made keep their one rate, permit by permit ────────────────────────────────────────
do $$
declare
  v_schedules integer;
  v_rows integer;
begin
  with billed as (
    select s.id, s.org_id, s.bill_scale, s.bill_permit_id, s.started_from_permit_id
      from club_schedules s
     where s.allocation_id is not null and s.bill_scale is not null
       and not exists (select 1 from club_schedule_bill_rates r where r.schedule_id = s.id)
  ), behind as (
    select b.id as schedule_id, b.org_id, b.bill_scale, t.from_permit_id as permit_id
      from billed b join org_time_blocks t on t.schedule_id = b.id and t.from_permit_id is not null
    union
    select b.id, b.org_id, b.bill_scale, b.bill_permit_id from billed b where b.bill_permit_id is not null
    union
    select b.id, b.org_id, b.bill_scale, b.started_from_permit_id from billed b where b.started_from_permit_id is not null
  ), put as (
    insert into club_schedule_bill_rates (org_id, schedule_id, permit_id, permit_name, scale)
    select x.org_id, x.schedule_id, x.permit_id, p.name, x.bill_scale
      from behind x join org_permits p on p.id = x.permit_id and p.org_id = x.org_id
    on conflict (schedule_id, permit_id) do nothing
    returning schedule_id
  )
  select count(distinct schedule_id), count(*) into v_schedules, v_rows from put;
  raise notice 'mig 489 backfill: % billed schedules kept their rate on % permit rows', v_schedules, v_rows;
end $$;

notify pgrst, 'reload schema';

commit;
