-- Migration 150: per-tournament toggle for showing team COACH NAMES on the public site.
-- The team's coach name (teams.coach) has always rendered on the public tournament pages
-- (Teams listing cards, the team profile header, and the schedule team search). Some
-- organizers consider a coach's name personal information they'd rather not publish, so this
-- adds an explicit opt-in switch on the public-site ("Public Pages") settings.
--
-- coach_names_show_on_public → when TRUE, coach names appear on the anonymous public pages
--                              exactly as before; when FALSE they are stripped from every
--                              public/anonymous payload (toPublicTeam — the J6-001 choke point)
--                              so they never reach the browser, not merely hidden in the UI.
--
-- Defaults to FALSE: coach names are PRIVATE by default. This intentionally changes existing
-- tournaments — any event currently showing coach names publicly will hide them after this
-- ships until an organizer turns the switch back on. Coach names remain fully visible in admin
-- views and the Coaches Portal; this column governs the public site only. Coach EMAILS are not
-- affected (already excluded from public payloads, J6-001).
--
-- Additive / non-destructive. Apply to dev + prod together to keep them in sync.

alter table public.tournaments
  add column if not exists coach_names_show_on_public boolean not null default false;
