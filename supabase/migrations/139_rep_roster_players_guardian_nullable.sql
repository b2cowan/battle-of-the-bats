-- 139: make rep_roster_players guardian fields nullable (Coach Premium Upgrade — Phase 3c).
--
-- The free Basic roster allows a player with no guardian name/email (basic_coach_team_players:
-- guardian_name + contact_email are nullable). Premium required all three (guardian_first_name,
-- guardian_last_name, guardian_email NOT NULL). To carry a free team's roster over on upgrade
-- WITHOUT fabricating guardian data, Premium must accept the gap. This drops NOT NULL on the three
-- guardian columns; the post-upgrade "check these" summary surfaces players missing the info so the
-- coach can complete it. App readers are already null-safe (the TS type was already `string | null`,
-- and every reader coalesces / skips / guards on null).
--
-- Relaxing + reversible. The non-unique rep_roster_players_email_idx on guardian_email is unaffected
-- (NULLs simply aren't indexed). Manual roster add still requires guardian (app-layer); only
-- migrated rows (and edits that clear the field) may be null.

alter table public.rep_roster_players
  alter column guardian_first_name drop not null,
  alter column guardian_last_name  drop not null,
  alter column guardian_email      drop not null;
