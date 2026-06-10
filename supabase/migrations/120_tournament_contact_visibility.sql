-- Migration 120: per-audience visibility toggles for the tournament contact email.
-- Until now the tournament's "Public Contact" member was an all-or-nothing control: the copy
-- in Settings → Notifications & Contact promised that member's email "appears in coach-facing
-- registration emails AND on the public tournament page" — with no way to publish it in one
-- surface but not the other. Since the default contact is the org owner's personal email, that
-- forced organizers to expose a personal address on a public web page (spam-harvesting risk)
-- just to have it appear in transactional emails coaches receive.
--
-- The contact reaches TWO audiences, each now independently controllable:
--   contact_show_to_coaches → show the contact email to registered coaches:
--                             coach-facing emails (registration / acceptance / decline / payment)
--                             AND the in-app Coaches Portal (status banner + fee line)
--   contact_show_on_public  → show the contact email on public (anonymous) tournament pages
-- Both default TRUE so every existing tournament keeps its current behavior unchanged.
-- Additive / non-destructive; applied to dev + prod together to keep them in sync.
--
-- NOTE: an earlier draft of this migration named the coach column `contact_show_in_emails`.
-- It only ever shipped to dev; the DROP below renames it cleanly before it reaches prod.

alter table public.tournaments
  add column if not exists contact_show_to_coaches boolean not null default true,
  add column if not exists contact_show_on_public  boolean not null default true;

alter table public.tournaments
  drop column if exists contact_show_in_emails;
