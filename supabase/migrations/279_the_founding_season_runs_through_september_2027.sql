-- 279 — The Founding Season runs through September 30, 2027 (data-only backfill).
--
-- BUSINESS_DECISIONS 2026-09-07 ("Founding Season 2027"): the free period for every Founding Season
-- account moves from the end of 2026 to the end of September 2027, and the signup window (sign up
-- by December 31, 2026) becomes a SEPARATE date in lib/plan-config.ts. The code writes the new end
-- instant (2027-10-01T04:00:00Z = 2027-09-30 23:59:59 EDT) on every comp it grants from now on; this
-- migration moves the comps ALREADY granted under the old instant (2027-01-01T00:00:00Z) so that:
--   • nobody who joined before this change is worse off than someone who joins after it,
--   • the founding-season status + email-audience queries, which MATCH on the exact expires_at
--     (see the operational caveat on FOUNDING_SEASON_END in lib/plan-config.ts), keep recognising
--     them, and
--   • the comped workspaces' / organizations' current_period_end agrees with their comp row.
--
-- ⚠ Data-only. No schema change, so neither drift check can see whether it has been applied to
-- production — record the prod apply in the release history, as migration 264's note demands.
-- Idempotent: every statement is keyed on the OLD instant and does nothing once it has run.

-- ⚠ Only rows the Founding Season wrote: every one of its writers stamps a reason beginning
-- "Founding Season" (the signup/org-create/league-create routes, ensureFoundingSeasonCompPeriod and
-- the Premium Coaches Portal comp path). A platform admin can grant a comp_period with any expiry
-- and any reason from the org detail page, and a manual grant that happened to end on the same
-- instant must NOT be re-dated into the cohort (/review 2026-09-07).
update public.org_overrides
   set expires_at = '2027-10-01T04:00:00.000Z',
       reason     = regexp_replace(reason, 'December 31, 2026', 'September 30, 2027')
 where type       = 'comp_period'
   and expires_at = '2027-01-01T00:00:00.000Z'
   and revoked_at is null
   and reason ilike 'Founding Season%';

-- Comped Premium Coaches Portal workspaces (platform_override billing, no Stripe subscription).
update public.team_workspaces
   set current_period_end = '2027-10-01T04:00:00.000Z'
 where billing_mode           = 'platform_override'
   and stripe_subscription_id is null
   and current_period_end     = '2027-01-01T00:00:00.000Z';

-- Organizations comped onto Tournament Plus through the Founding Season upgrade path (which stamps
-- the comp end on the org row as current_period_end; no Stripe subscription exists for them).
update public.organizations
   set current_period_end = '2027-10-01T04:00:00.000Z'
 where plan_id                = 'tournament_plus'
   and stripe_subscription_id is null
   and current_period_end     = '2027-01-01T00:00:00.000Z';
