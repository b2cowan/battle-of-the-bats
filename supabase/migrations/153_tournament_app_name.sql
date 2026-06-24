-- Migration 153: per-tournament custom home-screen APP NAME (the short label under
-- the installed PWA icon). The launcher label has always been derived from the
-- tournament name (truncated to ~12 chars for the manifest short_name + used as the
-- iOS apple-mobile-web-app-title). Long names get cut off on the home screen
-- ("Battle of the Ba…"), so this lets an organizer set a short label (e.g. "BoB")
-- from Public Site → Advanced Branding → App Icon.
--
-- app_name → free text (trimmed, ≤30 chars app-side) used as the manifest short_name
--            and the iOS home-screen title; NULL/blank = derive from the tournament
--            name as before (the default). The full tournament name still drives the
--            install-prompt title + browser <title>. Plus-gated at the API.
--
-- Additive / non-destructive, nullable, no default. Apply to dev + prod together.

alter table public.tournaments
  add column if not exists app_name text;
