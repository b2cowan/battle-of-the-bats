-- Migration 124: teams.coach_email (free-tier Coaches Phase 5l)
-- A SEPARATE, optional contact email for the team's head coach, distinct from teams.email.
--
-- WHY a new column instead of overwriting teams.email: teams.email is the portal ACCESS / claim
-- key — the registrant (account holder) reaches and claims the registration by matching it
-- (claim-by-email, mig 092 / Phase 5c). Overwriting it would orphan the registrant's access.
-- So 5l adds coach_email as a reroute target ONLY: coach-facing automatic emails (acceptance,
-- rejection, payment, schedule-published, payment-reminder) send to coach_email ?? email, while
-- teams.email stays untouched as the claim/access key. teams.coach (a NAME, not an email) remains
-- the head-coach display name; 5l makes both editable per-tournament from the Coaches Portal.
--
-- Nullable, no default: absent (null) means "no separate coach contact — route to teams.email".
-- The registrant sets/clears it in the portal (PATCH /api/coaches/tournaments/[teamId]).
--
-- DEPLOY GATE: dev-only today. Joins migrations 114–117 + 123 in the Phase-5 prod deploy gate
-- (npm run check:migrations) — all must reach prod before any Phase-5 prod deploy.

alter table public.teams
  add column if not exists coach_email text;

comment on column public.teams.coach_email is
  'OPTIONAL head-coach contact email, set per-tournament from the Coaches Portal (Phase 5l). DISTINCT from teams.email, which stays the portal access/claim key. Coach-facing automatic emails resolve the recipient as coach_email ?? email; teams.email is never overwritten. Null = no separate coach contact (route to teams.email). teams.coach holds the head-coach display NAME.';
