-- Migration 128: organization_members.invited_email (invite reconciliation, Phase 0)
--
-- WHY: invites are bonded to the user_id Supabase mints via generateLink({type:'invite'}).
-- Every pending-invite lookup keys on user_id. If the invited person ignores the email
-- link and self-registers (or logs in) instead, they authenticate as a DIFFERENT identity
-- and nothing can connect them back to their pending invite — they hit a dead-end
-- ("incorrect email or password" / a junk org). organization_members has no email column,
-- so there is no way to reconcile by email today.
--
-- This adds invited_email: the email the invite was sent to, persisted on the pending row.
-- Reconciliation (lib/invite-reconciliation.ts) matches a freshly-authenticated user's
-- email against status='invited' rows and re-points them to the real user_id, so the
-- invite surfaces no matter how the user got an account.
--
-- Nullable, no default: null = legacy row (pre-128) or a row created by the existing-user
-- direct-add path (which already has the correct user_id and needs no reconciliation).
-- Match is always case-insensitive on lower(invited_email); the invite route already
-- lowercases the email before insert, but we index lower() to be safe.
--
-- Partial index covers only the rows reconciliation ever scans (status='invited'),
-- keeping it tiny. A backfill script (scripts/backfill-invited-email.mjs) fills existing
-- pending rows from their auth-user email; run it once after applying.
--
-- DEPLOY GATE: dev-only today. Must reach prod (npm run check:migrations) before the
-- reconciliation code that depends on this column ships to prod.

alter table public.organization_members
  add column if not exists invited_email text;

create index if not exists organization_members_invited_email_idx
  on public.organization_members (lower(invited_email))
  where status = 'invited';

comment on column public.organization_members.invited_email is
  'Email the invite was sent to, persisted on pending (status=invited) rows so invite reconciliation can match a freshly-authenticated user by email and re-point the row to their real user_id (mig 128). Null = legacy/pre-128 row or a direct existing-user add (user_id already correct). Matched case-insensitively via lower().';
