-- Migration 051: plan/pricing change notes
-- Adds operator-visible notes to high-risk platform-admin plan and pricing edits.

alter table public.plan_gating
  add column if not exists last_change_note text;

alter table public.plan_config_overrides
  add column if not exists last_change_note text;

alter table public.stripe_prices
  add column if not exists last_change_note text,
  add column if not exists updated_by_email text;

comment on column public.plan_gating.last_change_note is
  'Latest platform-admin change note for plan availability.';

comment on column public.plan_config_overrides.last_change_note is
  'Latest platform-admin change note for plan limit or trial overrides.';

comment on column public.stripe_prices.last_change_note is
  'Latest platform-admin change note for this Stripe price ID slot.';

comment on column public.stripe_prices.updated_by_email is
  'Platform admin email that last updated this Stripe price ID slot.';
