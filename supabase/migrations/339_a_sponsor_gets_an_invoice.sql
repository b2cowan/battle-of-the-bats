-- 339: a sponsor gets an invoice — Coach Sponsor Invoice (owner rulings 2026-10-20).
--
-- Plan: docs/projects/active/COACH_SPONSOR_INVOICE_PLAN.md. A coaches-portal team downloads a numbered invoice for a
-- sponsor, on the team's own paper, to hand the sponsor's accounting department. Always from the TEAM (R1), no tax of
-- any kind (R2). Additive only.
--
-- Two homes, because the facts belong to two different things:
--   • how sponsors pay the team (cheque address, e-transfer email, who answers questions) is the TEAM's, and outlasts a
--     season like pdf_settings does → a jsonb on rep_teams, written from the invoice window (A3: its only home);
--   • the invoice itself — its number, who it is billed to, its dates — is the SPONSOR's → one row per sponsor.

-- ── 1. How sponsors pay the team ────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rep_teams
  ADD COLUMN IF NOT EXISTS sponsor_payment_details jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.rep_teams.sponsor_payment_details IS
  'How sponsors pay this team, printed on every sponsor invoice: { chequeAddress?, etransferEmail?, questionsTo? }. '
  'Payable-to is always the team''s name and is not stored. Written by the sponsor invoice window (mig 339).';

-- ── 2. The invoice ──────────────────────────────────────────────────────────────────────────────────────────────
-- ⚠ THE NUMBER IS NEVER REUSED (A2). It is season_year + seq ("2026-003"), unique per team and year, assigned max+1 on
-- the first download. Deleting the sponsorship therefore must NOT delete the row — a freed 003 would be handed to the
-- next sponsor, and a business would hold two different invoices numbered 003 from one team. The sponsor link goes
-- NULL and the row stays as the number's tombstone.
CREATE TABLE IF NOT EXISTS public.rep_sponsor_invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id)     ON DELETE CASCADE,
  team_id           uuid NOT NULL REFERENCES public.rep_teams(id)         ON DELETE CASCADE,
  program_year_id   uuid NOT NULL REFERENCES public.rep_program_years(id) ON DELETE CASCADE,
  fundraiser_id     uuid          REFERENCES public.rep_fundraisers(id)   ON DELETE SET NULL,
  season_year       integer NOT NULL,
  seq               integer NOT NULL CHECK (seq > 0),
  bill_to_name      text NOT NULL CHECK (length(btrim(bill_to_name)) > 0),
  bill_to_attention text,
  bill_to_email     text,
  bill_to_address   text,
  description       text NOT NULL CHECK (length(btrim(description)) > 0),
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  issued_on         date NOT NULL,
  due_on            date,
  revised_on        date,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rep_sponsor_invoices_number_uniq ON public.rep_sponsor_invoices (team_id, season_year, seq);
-- One invoice per sponsor (A4: a changed amount re-issues the SAME number). NULLs (a deleted sponsor's tombstone) repeat freely.
CREATE UNIQUE INDEX IF NOT EXISTS rep_sponsor_invoices_fundraiser_uniq ON public.rep_sponsor_invoices (fundraiser_id) WHERE fundraiser_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rep_sponsor_invoices_org_idx  ON public.rep_sponsor_invoices (org_id);
CREATE INDEX IF NOT EXISTS rep_sponsor_invoices_year_idx ON public.rep_sponsor_invoices (program_year_id);

ALTER TABLE public.rep_sponsor_invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rep_sponsor_invoices FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_sponsor_invoices TO service_role;

COMMENT ON TABLE public.rep_sponsor_invoices IS
  'Coach Sponsor Invoice (mig 339): the invoice a coaches-portal team issues a sponsor (rep_fundraisers kind=sponsor). '
  'One per sponsor; the number (season_year-seq, e.g. 2026-003) is fixed on the first download and never reused for the '
  'team. Always from the team, no tax. Read and written only through the coach invoice route (service role).';
COMMENT ON COLUMN public.rep_sponsor_invoices.fundraiser_id IS
  'The sponsor. SET NULL when the sponsorship is deleted: the row stays so its number is never handed out again.';
COMMENT ON COLUMN public.rep_sponsor_invoices.seq IS
  'The count within (team_id, season_year), from 1. Printed zero-padded to 3: 2026-003.';
COMMENT ON COLUMN public.rep_sponsor_invoices.amount IS
  'The amount invoiced at the last download: the sponsor''s pledged amount, else what had arrived. Never typed.';
COMMENT ON COLUMN public.rep_sponsor_invoices.revised_on IS
  'Set when a later download found the sponsor''s amount had changed (A4): same number, new amount, "Revised <date>".';
