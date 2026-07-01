-- Migration 164: tryout-registration CONSENT capture (PIPEDA/CASL) + org PRIVACY-POLICY pipe.
-- Backs Coaches Portal Tryouts & Evaluation Phase 1.1 (consent gate). The public tryout
-- registration form collects a minor's personal information; this records the guardian's
-- explicit, timestamped consent at submit time so the org has a defensible record.
--
-- rep_tryout_registrations:
--   consent_data_collection → boolean, nullable. PIPEDA consent to collect/use the player's
--                             info. Captured at submit; all three consent booleans are
--                             REQUIRED by the app to submit, so a non-NULL consent_at means
--                             all three were ticked. Nullable (no backfill) → pre-gate rows
--                             stay NULL = honest "no consent on record".
--   consent_email_comms     → boolean, nullable. CASL consent to receive tryout/team email.
--   consent_eligibility     → boolean, nullable. Guardian + player-eligibility confirmation.
--   consent_at              → timestamptz, nullable. When consent was given (server clock).
--   consent_ip              → text, nullable. Best-effort client IP at consent time, captured
--                             SERVER-SIDE only (never from the request body). For audit only.
--
-- organizations:
--   privacy_policy_url → text, nullable. Optional external URL for the org's privacy policy.
--                        The forward-compatible "pipe" the consent gate links to when set;
--                        NULL = no policy yet → the consent renders without a link. The richer
--                        in-platform org privacy page (League/Club public site) integrates
--                        through the same getOrgPrivacyPolicyHref() seam later.
--
-- Additive / non-destructive, IF NOT EXISTS, no data change, no backfill.
-- Apply to dev + prod together before promoting any consent-reading code.

alter table public.rep_tryout_registrations
  add column if not exists consent_data_collection boolean;

alter table public.rep_tryout_registrations
  add column if not exists consent_email_comms boolean;

alter table public.rep_tryout_registrations
  add column if not exists consent_eligibility boolean;

alter table public.rep_tryout_registrations
  add column if not exists consent_at timestamptz;

alter table public.rep_tryout_registrations
  add column if not exists consent_ip text;

alter table public.organizations
  add column if not exists privacy_policy_url text;
