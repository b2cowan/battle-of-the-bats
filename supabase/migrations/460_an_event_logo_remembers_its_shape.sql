-- 460 — a tournament's logo remembers its shape (navigation Phase 2 Part A, owner gate ruling 2026-11-10).
--
-- The tournament admin's sidebar now heads with the EVENT (its name and the one logo tile, `SidebarLogoTile`). The tile shows
-- the event's own logo only when it is within 1 : 2 … 2 : 1 and the event's initials otherwise (T5: never the organization's
-- logo in its place). As with the organization's logo (mig 458), that decision has to be in the server's first paint, so the
-- shape is stored WITH the logo, written when the logo is written, rather than measured in the browser after it loads.
--
-- `logo_aspect` = width / height of `logo_url`, orientation applied. NULL = no logo, or one nobody has measured yet; the tile
-- reads NULL as "initials" until the one-time pass (scripts/backfill-org-logo-aspect.mjs, which now covers events too) has
-- measured the logos uploaded before this column. The upload route (`/api/admin/tournament-logo`) writes it with every upload
-- and clears it with the logo; the clone and "reuse a setup" copy it with the logo.
--
-- Schema only; additive and nullable, so code that does not know the column is unaffected.

alter table public.tournaments
  add column if not exists logo_aspect real;

comment on column public.tournaments.logo_aspect is
  'Width / height of logo_url, orientation applied. NULL = no logo or not measured yet (the admin sidebar tile then shows the event''s initials).';
