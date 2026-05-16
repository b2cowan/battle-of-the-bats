-- ---------------------------------------------------------------
-- Migration 032 — Bidirectional Team Payment Requests
-- Coaches submit Pay Org or Charge to Org requests.
-- Admin/treasurer reviews and approves or denies.
-- On approval the matching accounting transfer is created in app code.
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rep_team_payment_requests (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid          NOT NULL REFERENCES organizations(id)   ON DELETE CASCADE,
  team_id             uuid          NOT NULL REFERENCES rep_teams(id)       ON DELETE CASCADE,
  request_type        text          NOT NULL CHECK (request_type IN ('payment_to_org', 'charge_to_org')),
  amount              numeric(10,2) NOT NULL CHECK (amount > 0),
  description         text          NOT NULL,
  payment_method      text,
  notes               text,
  status              text          NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'approved', 'denied')),
  denial_reason       text,
  budget_line_id      uuid          REFERENCES org_budget_lines(id)         ON DELETE SET NULL,
  accounting_entry_id uuid          REFERENCES accounting_entries(id)       ON DELETE SET NULL,
  created_by          uuid          NOT NULL REFERENCES auth.users(id),
  reviewed_by         uuid          REFERENCES auth.users(id),
  reviewed_at         timestamptz,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_team_payment_requests_org_status_idx
  ON rep_team_payment_requests(org_id, status);

CREATE INDEX IF NOT EXISTS rep_team_payment_requests_team_status_idx
  ON rep_team_payment_requests(team_id, status);

-- ---------------------------------------------------------------
-- RLS
-- App routes handle fine-grained access; RLS ensures org isolation.
-- ---------------------------------------------------------------
ALTER TABLE rep_team_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read payment_requests"
  ON rep_team_payment_requests FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org members write payment_requests"
  ON rep_team_payment_requests FOR ALL
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
