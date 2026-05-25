-- Migration 092: Basic coach team access is explicit only
-- Product is not live yet, so keep Basic Coaches Portal access tied to the
-- link table created in migration 091 rather than email-derived fallback.

alter table public.basic_coach_team_registrations
  drop constraint if exists basic_coach_team_registrations_source_check;

alter table public.basic_coach_team_registrations
  add constraint basic_coach_team_registrations_source_check
  check (link_source in ('explicit', 'registration_flow', 'backfill'));
