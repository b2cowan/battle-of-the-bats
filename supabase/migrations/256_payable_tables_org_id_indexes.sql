-- ---------------------------------------------------------------
-- Migration 256 — the tenancy index migration 255 left off
--
-- Payables Rebuild P1. `rep_payable_installments` and `rep_payable_payments`
-- both carry a denormalised `org_id` for the reason every other rep_* money
-- table does — every read is scoped by org+team before it is scoped by anything
-- else, and a join to reach the scope is a join that can be forgotten. Migration
-- 255 indexed by expense, by team+date and by program year, and missed the
-- tenancy anchor itself.
--
-- `npm run check:index-coverage` (part of `verify:changed`) caught it: org_id is
-- the RLS anchor, so an unindexed one turns every policy evaluation into a scan
-- that grows with the whole platform rather than with one club. Both tables are
-- small today, which is exactly why this is cheap to fix now.
--
-- ⚠ SEPARATE FROM 255 DELIBERATELY. 255 is already applied to dev, so amending
-- it would leave the two environments describing the same number differently —
-- and the schema-parity gate reads the DATABASE, never the migration files.
-- ---------------------------------------------------------------

CREATE INDEX IF NOT EXISTS rep_payable_installments_org_id_idx
  ON public.rep_payable_installments (org_id);

CREATE INDEX IF NOT EXISTS rep_payable_payments_org_id_idx
  ON public.rep_payable_payments (org_id);
