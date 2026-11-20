-- 511 — The next-season plan choice is gone (owner ruling 2026-11-19, BUSINESS_DECISIONS.md top entry; plan
-- docs/projects/active/FREE_LEAGUE_AND_FOUNDING_REMOVAL_PLAN.md Stage 2b).
--
-- Migration 283 gave `organization_billing_facts` two facts: the card on file, and the plan an account chose for the season
-- after its Founding Season (the 2028 choice, asked from June 1, 2027). Founding Season is removed in Stage 2b, with its
-- choice route, the webhook's next-season arms and every reader of these four columns. The card-on-file columns stay (the
-- webhook's card-saving arm still writes them; nothing reads them today).
--
-- Counts before (2026-11-20, counts only): next-season choices 0 on dev, 0 on production; next-season subscriptions 0 / 0.
-- No view, policy or function reads the columns on either database.
--
-- PRODUCTION: AFTER the Stage 2b code is serving (it ships together with the free-time item, FREE_TIME_SAME_RULES_PLAN.md,
-- and migration 510 runs before that code). The previous build selects these columns by name. A dropped column is
-- INVISIBLE to check:migrations; it is declared in MANUAL_PROD_STEPS.json. Idempotent.

drop index if exists public.idx_org_billing_facts_no_next_season_choice;

alter table public.organization_billing_facts drop constraint if exists organization_billing_facts_next_season_billing_cycle_check;
alter table public.organization_billing_facts drop constraint if exists organization_billing_facts_next_season_plan_id_check;

alter table public.organization_billing_facts drop column if exists next_season_subscription_id;
alter table public.organization_billing_facts drop column if exists next_season_chosen_at;
alter table public.organization_billing_facts drop column if exists next_season_billing_cycle;
alter table public.organization_billing_facts drop column if exists next_season_plan_id;

comment on table public.organization_billing_facts is
  'Per-account billing facts that must NOT be world-readable: whether a card is on file, and which one. Deliberately NOT '
  'columns on `organizations` — that table is anon-readable for every public org (RLS is row-level, and its policy admits '
  'is_public = true), so anything added there is published. Service-role only.';
