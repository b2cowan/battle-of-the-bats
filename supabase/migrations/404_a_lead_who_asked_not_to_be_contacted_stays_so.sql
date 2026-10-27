-- ---------------------------------------------------------------
-- Migration 404 — Support console Stage 7 loose ends: "asked not to be contacted" becomes a lasting mark on the lead.
-- Plan: docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md ("Stage 7 loose ends"); owner ruling 2026-10-27
-- (asked "should it become a lasting flag on the person that survives step changes and refills of the form?", answered yes).
--
-- WHAT CHANGES:
--   1. early_access_leads.do_not_contact_at (new, nullable): when the lead asked not to be contacted. Until now this was
--      only the Lost reason `asked_not_to_contact`, so moving the step off Lost, or linking a club, lifted it without
--      anyone meaning to, and the person came back into Copy emails and the export. Now the mark stays until a person
--      with the growth power lifts it on purpose ("Allow contact again"), and only once the lead is no longer Lost for
--      that reason.
--   2. Back-fill: every lead that is Lost · Asked not to be contacted today gets the mark, dated by when its step last moved.
--      A lead moved off that reason before this migration cannot be recovered (migration 398 already folded the old
--      `do_not_contact` step into Lost); nothing in the records says who they were.
--   3. A CHECK pins the one-way rule: a lead Lost for that reason always carries the mark.
--   Rows on dev this migration moves: counted by the dev run (see MANUAL_PROD_STEPS for prod).
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.early_access_leads
  ADD COLUMN IF NOT EXISTS do_not_contact_at timestamptz;

UPDATE public.early_access_leads
   SET do_not_contact_at = COALESCE(step_changed_at, updated_at, now())
 WHERE lost_reason = 'asked_not_to_contact' AND do_not_contact_at IS NULL;

ALTER TABLE public.early_access_leads
  DROP CONSTRAINT IF EXISTS early_access_leads_asked_not_to_contact_sticks;
ALTER TABLE public.early_access_leads
  ADD CONSTRAINT early_access_leads_asked_not_to_contact_sticks
  CHECK (lost_reason IS DISTINCT FROM 'asked_not_to_contact' OR do_not_contact_at IS NOT NULL);

COMMENT ON COLUMN public.early_access_leads.do_not_contact_at IS
  'When this lead asked not to be contacted (Stage 7 loose ends, owner 2026-10-27). Set when staff save the lead as Lost with the reason "Asked not to be contacted"; it then outlives the step and any link, and only an explicit "Allow contact again" clears it. Never in Copy emails, an empty email cell in an export.';

COMMIT;
