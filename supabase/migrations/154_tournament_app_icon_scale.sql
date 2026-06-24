-- Migration 154: per-tournament APP-ICON logo SIZE (zoom).
-- The installed home-screen (PWA) icon for a Tournament Plus event composites the
-- tournament/org logo onto a tile at a fixed box size (iOS ~87% of the canvas,
-- Android ~55% inside the maskable safe circle). This column lets an organizer
-- make their logo sit larger or smaller in that tile from Public Site → Advanced
-- Branding → App Icon (a single "Logo size" slider with a live preview).
--
-- app_icon_scale → smallint, a RELATIVE size where 100 = the current tuned default.
--                  App-side range 70–125 (clamped). NULL = default (the 100 look),
--                  so unset behaviour is unchanged. Only the apple-touch + Android
--                  maskable icon routes read it; each clamps to its own safe ceiling
--                  (iOS up to ~95%; Android capped at the maskable safe circle so a
--                  square logo's corners are never clipped). Plus-gated at the API.
--
-- Additive / non-destructive, nullable, no default. Apply to dev + prod together.

alter table public.tournaments
  add column if not exists app_icon_scale smallint;
