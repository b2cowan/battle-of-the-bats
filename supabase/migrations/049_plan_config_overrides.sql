-- Migration 049: plan_config_overrides
-- Per-plan overrides for numeric limits and trial length.
-- Null in any column means "use the hardcoded default in lib/plan-config.ts".
-- One row per plan. Upsert on conflict plan_id.

create table if not exists plan_config_overrides (
  id                 uuid        primary key default gen_random_uuid(),
  plan_id            text        not null unique,
  tournament_limit   int,
  seat_limit         int,
  trial_days         int,
  updated_at         timestamptz not null default now(),
  updated_by_email   text
);

comment on table plan_config_overrides is
  'Per-plan overrides for numeric limits and Stripe trial length. Null = use PLAN_CONFIG default in lib/plan-config.ts. Managed via Platform Admin → Plans & Pricing.';

comment on column plan_config_overrides.tournament_limit is
  'Max non-archived tournaments for this plan. Null = use PLAN_CONFIG default.';

comment on column plan_config_overrides.seat_limit is
  'Max org staff seats for this plan. Null = use PLAN_CONFIG default.';

comment on column plan_config_overrides.trial_days is
  'Stripe checkout trial period in days. Null = use PLAN_CONFIG default.';