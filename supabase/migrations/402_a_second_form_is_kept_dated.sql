-- ---------------------------------------------------------------
-- Migration 402 — Support console Stage 7 Part 8: a second form from a known address is kept, dated.
-- Plan: docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md ("Frame J rulings 2026-10-27"); drawing J, questions 12-16.
--
-- WHAT CHANGES:
--   1. early_access_lead_submissions (new): one row per REFILL of the public form (or a coach team's interest button) from
--      an address that is already a lead. Until now only the latest refill was dated (last_submitted_at) and the earlier
--      ones were a count; the timeline could not say when each one came. A lead's FIRST form stays on the lead itself
--      (created_at, source_path, features_interested) and is not copied here.
--        • submitted_at, kind (form | coach_button), source_path (the page the refill sat on, as the form sent it);
--        • their_words (what the visitor wrote this time, plain text, kept as given), heard_from (their answer, a code from
--          the list in lib/lead-form-answers.ts, format-checked here);
--        • yes_not_applied (they ticked release emails over a lead that said no: nothing was changed, the timeline says so);
--        • withdrew_consent (they unticked it: the lead now says no).
--      Nothing about the visitor's device, address or browser is kept here.
--   2. Grants: the server's own access, explicit (Supabase stops auto-granting 2026-10-30); RLS on, no policies, so the
--      browser roles can never read or write it. As early_access_lead_notes (398).
--   early_access_leads.heard_from and .ref_tag already exist (398), format-checked; no column changes here.
--   Rows on dev this migration moves: 0 (a new, empty table).
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.early_access_lead_submissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES public.early_access_leads(id) ON DELETE CASCADE,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  kind             text NOT NULL DEFAULT 'form' CHECK (kind IN ('form', 'coach_button')),
  source_path      text CHECK (source_path IS NULL OR length(source_path) <= 240),
  their_words      text CHECK (their_words IS NULL OR length(their_words) BETWEEN 1 AND 1200),
  heard_from       text CHECK (heard_from IS NULL OR heard_from ~ '^[a-z][a-z_]{1,39}$'),
  yes_not_applied  boolean NOT NULL DEFAULT false,
  withdrew_consent boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS early_access_lead_submissions_lead_idx
  ON public.early_access_lead_submissions (lead_id, submitted_at DESC);

ALTER TABLE public.early_access_lead_submissions ENABLE ROW LEVEL SECURITY;
-- No policies: nothing but the service role reads or writes it (migration-table-grants-guard.test.ts).
REVOKE ALL ON TABLE public.early_access_lead_submissions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.early_access_lead_submissions TO service_role;

COMMIT;
