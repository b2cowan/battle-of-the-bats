-- migration 116: basic coach team manual fee ledger (free coach floor)
-- phase 4b of the free tier + coaches project. This is coach-self-recorded money tracking only:
-- a coach writes down what a roster player, or the whole team, owes and marks it paid/unpaid.
-- no stripe, no online collection, no installments, no partial payments, no dues automation.

create table if not exists public.basic_coach_team_fees (
  id uuid primary key default gen_random_uuid(),
  basic_coach_team_id uuid not null references public.basic_coach_teams(id) on delete cascade,
  player_id uuid references public.basic_coach_team_players(id) on delete set null,
  label text not null,
  amount numeric(10,2) not null default 0,
  status text not null default 'unpaid',
  marked_paid_at timestamptz,
  notes text,
  display_order integer not null default 0,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint basic_coach_team_fees_amount_check
    check (amount >= 0),
  constraint basic_coach_team_fees_status_check
    check (status in ('unpaid', 'paid')),
  constraint basic_coach_team_fees_paid_at_check
    check (
      (status = 'paid' and marked_paid_at is not null)
      or (status = 'unpaid' and marked_paid_at is null)
    )
);

create index if not exists basic_coach_team_fees_team_idx
  on public.basic_coach_team_fees(basic_coach_team_id, display_order, created_at);

create index if not exists basic_coach_team_fees_player_idx
  on public.basic_coach_team_fees(player_id)
  where player_id is not null;

alter table public.basic_coach_team_fees enable row level security;

comment on table public.basic_coach_team_fees is
  'Manual fee ledger for org-less basic_coach_teams (free coach floor, Phase 4b). Coach-self-recorded tracking only: player-linked or team-wide fee label, amount, paid/unpaid status, paid timestamp, notes, display order. NOT Stripe, online collection, installments, partial payments, dues automation, or accounting. RLS enabled with no policies = service-role-only; ownership enforced in app code via basic_coach_team_users. Keyed on basic_coach_team_id; org-less by design.';
comment on column public.basic_coach_team_fees.player_id is
  'Optional link to basic_coach_team_players. Null means a team-wide/unassigned charge. On player delete the ledger entry is retained and becomes unassigned.';
comment on column public.basic_coach_team_fees.amount is
  'Dollar amount stored as numeric(10,2), matching the existing tournament/league/accounting/rep-dues money convention. Manual tracking only; no processor cents or Stripe amount.';
comment on column public.basic_coach_team_fees.status is
  'unpaid | paid. Binary V1 state only; no partial status. App toggles paid/unpaid and maintains marked_paid_at.';
comment on column public.basic_coach_team_fees.marked_paid_at is
  'Set when status is paid; null when status is unpaid. Maintained in app code by the manual paid/unpaid toggle.';
comment on column public.basic_coach_team_fees.display_order is
  'Coach-controlled ledger order within the team. Lower sorts first; separate from roster order.';
