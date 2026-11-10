-- 458 — an organization's logo remembers its shape (navigation Phase 1 Part B, owner 2026-11-09, answer 2 = A, B4/B5).
--
-- The admin sidebar's one logo tile shows the logo only when it is within 1 : 2 … 2 : 1 and falls back to the club's
-- initials otherwise (a wordmark is a sliver at 24 and 40 pixels). That decision has to be in the server's first paint —
-- measuring after the image loads would swap logo for initials after the page is shown — so the shape is stored WITH
-- the logo, written when the logo is written, rather than found out in the browser.
--
-- `logo_aspect` = width / height of the stored logo, orientation applied (an EXIF-turned photo is the turned shape).
-- NULL = unknown: no logo, or one nobody has measured yet. The tile reads NULL as "initials" until the one-time pass
-- (scripts/backfill-org-logo-aspect.mjs) has measured logos uploaded before this column; every later upload, stock pick
-- (always 512 x 512 = 1) and removal keeps it true.
--
-- Schema only; additive and nullable, so code that does not know the column is unaffected.

alter table public.organizations
  add column if not exists logo_aspect real;

comment on column public.organizations.logo_aspect is
  'Width / height of logo_url, orientation applied. NULL = no logo or not measured yet (the admin sidebar tile then shows initials).';
