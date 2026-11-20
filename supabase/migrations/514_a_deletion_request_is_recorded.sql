-- ---------------------------------------------------------------
-- Migration 514 — Settings in both workspaces, Session 1: a deletion request is recorded (ruling A10, /legal
-- ORG_DELETION_REQUEST_WINDOW.md finding 9; build prompt docs/projects/active/SETTINGS_BOTH_WORKSPACES_BUILD_PROMPT.md
-- Session 1, gate item 1 "as recommended", owner 2026-11-20).
--
-- WHY: an owner's "Ask us to delete {name}" request was an email and nothing else — the "Request sent" line vanished on
-- reload, the owner could send it again, and we could not show we replied within the promised 30 days.
--
-- WHAT CHANGES: org_deletion_requests — one row per request.
--   * The organization is held twice: org_id (SET NULL when the organization is deleted, so the row OUTLIVES it) and its
--     name and web address as TEXT at the time of asking. After deletion the row is part of "our record that the deletion
--     happened (the organization's name and web address, who deleted it, when and why)" — Privacy Policy §9.
--   * Who asked: the account id (no foreign key: an account closed later must not take the record) and its email as text.
--   * status: sent (open) · answered · withdrawn (staff close it on the organization's platform-admin page) · deleted
--     (the platform-admin deletion marks it). closed_at / closed_by (a staff email) say when and by whom.
--   * ONE OPEN REQUEST per organization (partial unique index): the route returns the open one instead of a second.
--   * Holds no more than the request email held (finding 9), plus its status and when it was closed.
--
-- ACCESS: SERVICE ROLE ONLY (dictionary rule 7: browser roles hold nothing unless a migration grants it). The owner reads
-- their organization's open request through the owner-only request route; staff through platform admin.
--
-- Re-runnable. check:migrations sees the table; the partial index is invisible to it.
-- Apply BEFORE promoting the code.
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_deletion_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  org_name         text NOT NULL,
  org_slug         text NOT NULL,
  requested_by     uuid,
  requester_email  text NOT NULL,
  reason           text CHECK (reason IS NULL OR char_length(reason) <= 1000),
  status           text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'answered', 'withdrawn', 'deleted')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  closed_at        timestamptz,
  closed_by        text,
  CONSTRAINT org_deletion_requests_closed_chk CHECK ((status = 'sent') = (closed_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS org_deletion_requests_one_open
  ON public.org_deletion_requests (org_id) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS org_deletion_requests_org_idx ON public.org_deletion_requests (org_id, created_at DESC);

ALTER TABLE public.org_deletion_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.org_deletion_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_deletion_requests TO service_role;

COMMENT ON TABLE public.org_deletion_requests IS
  'An owner''s request to delete their organization (A10). Outlives the organization (org_id SET NULL; name and web address kept as text). One open (sent) request per organization.';

COMMIT;
