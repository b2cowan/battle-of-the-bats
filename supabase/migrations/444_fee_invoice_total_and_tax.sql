-- 444_fee_invoice_total_and_tax.sql
--
-- Fee invoice alerts, Part 1 (docs/projects/active/FEE_INVOICE_ALERTS_PLAN.md; owner drawings 2026-11-05).
-- A club's own fee invoice is taxed on top (GST/HST Stage 2 Ask 3), so what the owner owes is not the sum of the fee lines.
-- Plan & billing now shows the invoice as one row with its TOTAL and its named tax lines. Both come from Stripe's invoice and
-- are written where the rest of the invoice's state is written (the finalize, the billing webhook, the daily re-read), so a
-- page view never calls Stripe.
--
--   total      Stripe's invoice total, tax included, in dollars (amount_due is what is STILL owed: it drops on a part payment).
--   tax_lines  the named tax lines, [{ "label": "HST (13%)", "cents": 49 }], Stripe's own names; null until first synced.
--
-- Additive and nullable: an invoice written before this migration reads as null until the daily re-read rewrites it, and the
-- page falls back to amount_due. Nothing is dropped or renamed.

alter table public.platform_fee_invoices add column if not exists total numeric(12,2);
alter table public.platform_fee_invoices add column if not exists tax_lines jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'platform_fee_invoices_tax_lines_chk') then
    alter table public.platform_fee_invoices
      add constraint platform_fee_invoices_tax_lines_chk check (tax_lines is null or jsonb_typeof(tax_lines) = 'array');
  end if;
end $$;

comment on column public.platform_fee_invoices.total is 'Stripe''s invoice total, tax included, in dollars. amount_due is what is still owed.';
comment on column public.platform_fee_invoices.tax_lines is 'Named tax lines from Stripe, [{label, cents}]; null until the invoice is first synced after migration 444.';
