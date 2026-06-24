-- Migration 152: per-tournament APP-ICON background colour override.
-- The installed home-screen (PWA) icon for a Tournament Plus event composites the
-- tournament/org logo onto a tile. As of the icon redesign the tile is painted the
-- logo's OWN background colour, auto-sampled from its edge pixels, so the logo reads
-- as one seamless field. This column lets an organizer OVERRIDE that auto-detected
-- colour from Public Site → Advanced Branding → App Icon (force white, dark, their
-- brand colour, or any custom hex — a contrasting colour reads as a deliberate border).
--
-- icon_bg_color → '#rrggbb' (validated app-side) to force the icon tile colour, or
--                 NULL = auto-detect from the logo (the default). Only the apple-touch
--                 + Android maskable icon routes read it; everything else ignores it.
--                 Plus-gated at the API like the rest of advanced branding.
--
-- Additive / non-destructive, nullable, no default. Apply to dev + prod together.

alter table public.tournaments
  add column if not exists icon_bg_color text;
