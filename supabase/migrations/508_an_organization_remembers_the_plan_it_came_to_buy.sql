-- 508 — An organization remembers the plan its owner came to buy (On-sale pages S2, owner ruling 2026-11-19: "New field
-- on the organization").
--
-- The Start a club and Start a league season doors (CLUB_ON_SALE_PAGES_PLAN.md S2) make the organization on the free
-- Tournament plan, then send its owner through the plan step, the billing address and Stripe's page. Until the Stripe
-- webhook writes the paid plan, nothing on the organization said which plan it was made for, so the page after Stripe
-- opened "New tournament" for a club buyer, and an abandoned checkout came back to a Tournament-only plan step. The plan
-- named `startup_tasks` for this; that column was never applied to either database (mig 026 exists, the column does
-- not), so the doors keep it here instead.
--
-- `start_plan` steers SCREENS only (which plan step, the wait after Stripe): it never decides an entitlement or a price,
-- which stay the gate, checkout and the webhook's. NULL for every existing organization and every organization a free
-- door makes. It is read only while the organization is still on the free Tournament plan.
--
-- PRODUCTION: before the code that writes it (the doors are closed on production, so nothing writes it until Club or
-- League Plus opens; the readers tolerate the column being absent). Visible to check:migrations. Idempotent.

alter table public.organizations add column if not exists start_plan text;

alter table public.organizations drop constraint if exists organizations_start_plan_check;
alter table public.organizations add constraint organizations_start_plan_check check (
  start_plan is null or start_plan in ('league', 'club', 'club_large')
);

comment on column public.organizations.start_plan is
  'The paid plan a Start a club / Start a league season door made this organization to buy (league, club, club_large); NULL otherwise. Screens only.';
