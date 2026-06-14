-- Migration 126: feedback_submissions escalation flag (F3 Support Seam, Phase 4)
-- Lets a support/billing operator FORMALLY hand a feedback item to the product team from
-- inside the console, instead of pinging out-of-band. Two nullable columns record the
-- hand-off; their presence (escalated_at NOT NULL) IS the "escalated" state.
--
-- WHY two plain columns and not a feedback_escalations join table: the MVP is a single
-- boolean-ish flag with provenance (who + when), not a multi-step escalation history. A
-- join table is the right call only if/when a full escalation workflow (reassign, notes,
-- de-escalate trail) is wanted; nullable columns on the main row are simpler and the
-- triage list already selects from this table. De-escalation simply nulls both columns
-- (no history kept by design) — the audit log (platform_audit_log) is the durable trail.
--
--   escalated_at  — timestamptz, null = not escalated; set to now() on escalate, nulled on clear.
--   escalated_by  — text platform-operator email (no FK to auth.users, matching triaged_by);
--                   set with escalated_at, nulled with it.
--
-- Mutated only by app/api/platform-admin/feedback/[id]/escalate/route.ts, gated on the
-- `feedback` area write check (super_admin / product / support / billing). The triage list
-- reads escalated_at to render the "Escalated" badge + the status=escalated filter.
--
-- Non-destructive (additive, nullable, no default). dev-only today; joins the Phase-5/6
-- prod deploy gate (npm run check:migrations).

alter table public.feedback_submissions
  add column if not exists escalated_at timestamptz,
  add column if not exists escalated_by text;

comment on column public.feedback_submissions.escalated_at is
  'Flag-for-product timestamp (F3 Phase 4). NULL = not escalated; set to now() when a write-capable operator escalates, nulled when escalation is cleared. Its presence IS the escalated state; read by the triage list for the Escalated badge + status=escalated filter.';

comment on column public.feedback_submissions.escalated_by is
  'Platform-operator email who escalated the item (no FK, mirrors triaged_by); set with escalated_at, nulled when escalation is cleared. Also written to platform_audit_log as the durable trail.';
