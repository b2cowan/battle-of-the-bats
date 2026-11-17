-- ---------------------------------------------------------------
-- Migration 490 — GST/HST Stage 6, the two 6.6 fixes, Part A (build prompt
-- docs/projects/active/GST_HST_STAGE6_6_FIXES_BUILD_PROMPT.md §4; plan GST_HST_STAGE6_TERMS_PLAN.md §5 "6.6", owner ruling 1,
-- 2026-11-16).
--
-- WHY: the Terms draft §8 promises a yearly plan's owners an email at least 30 days before it renews "with the renewal date
-- and the amount, plus applicable taxes". Mig 478 seeded the `yearly_renewal_reminder` template with that sentence, the
-- cancel sentence and the billing button IN ITS EDITABLE BODY, so an operator customising it could delete them and break the
-- promise silently. The code (lib/renewal-reminder.ts) now renders them as a FIXED block after the operator's words, the way
-- the purchase email's figures already are, and a customised row's own button gives way to it (one button). Nothing a
-- customer receives changes while nobody customises the template (the built-in email is byte-for-byte as before).
--
--   1. yearly_renewal_reminder, ONLY where is_customised = false: the body becomes one opening line (what an operator starts
--      from, and what is sent only once they customise it); cta_label / cta_url_pattern go NULL (the fixed block carries the
--      button). subject, heading and variables are unchanged ({{lead}} stays insertable; it is harmless twice).
--      A row an operator has customised keeps its words: the fixed block follows them at send time regardless.
--   2. Both billing templates (purchase_details, yearly_renewal_reminder), unconditionally (an operator cannot edit a
--      description): the whole description is SET (478's words, plus the keep-transactional line (CASL); for the reminder, the
--      {{lead}} sentence now says the app adds it anyway, so an operator does not insert it twice). /legal 6.6 fixes review
--      2026-11-16 (CASL_PURCHASE_DETAILS_EMAIL.md, RENEWAL_REMINDER_AND_QUEBEC_GATE.md). Set, not appended, so a re-run is exact.
--
-- Data only: no column, constraint or function change. Re-runnable.
-- Prod order: with the code that renders the fixed block (it rides 6.7 with 478's siblings). Applied before that code, an
-- uncustomised row is never read (the built-in email goes), so the order does not change any email; applied after it, the
-- same.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. the reminder's seeded body and button ──────────────────────────────────────────────────────────────────────────
update platform_email_templates
   set body = $k$A note about the yearly plan for {{orgName}}.$k$,
       cta_label = NULL,
       cta_url_pattern = NULL
 where key = 'yearly_renewal_reminder'
   and is_customised = false;

-- ── 2. the descriptions (staff only) ──────────────────────────────────────────────────────────────────────────────────
update platform_email_templates
   set description = $k$Sent by the daily job to every owner 30 to 37 days before a yearly plan's next charge (a renewal, a yearly trial ending, or a yearly next-season choice's first charge), once per charge date. The amount and its tax are Stripe's forecast of that charge. {{lead}} repeats the app's sentence with the date, the price and the tax, which the app adds below your text anyway; {{moveDownLine}} is empty unless the plan moves down on that date. Keep this email transactional: no offers, no other plans’ prices, and no links. The app adds the figures, the cancel line and the billing button after your text, so they cannot be removed.$k$
 where key = 'yearly_renewal_reminder';

update platform_email_templates
   set description = $k$Sent to every owner a minute or so after a plan's invoice is paid: a first plan, a free trial starting, an upgrade, a next-season choice, or coming back after a cancel. Never for a renewal, a fee invoice, a comp or a demo. The figures, the dates, the cancel and refund lines, the seller and the Terms line are added by the app below these words and cannot be changed here. {{opening}} is the app's opening for the case. Keep this email transactional: no offers, no other plans’ prices, and no links.$k$
 where key = 'purchase_details';

COMMIT;
