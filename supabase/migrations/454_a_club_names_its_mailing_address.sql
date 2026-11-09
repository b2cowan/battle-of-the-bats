-- 454_a_club_names_its_mailing_address.sql
--
-- Signed-in family accounts Stage 4a, Part 5 (build prompt docs/projects/active/SIGNED_IN_FAMILY_STAGE4_BUILD_PROMPT.md, owner
-- ruling O3 2026-11-08, build Session 2). Needs nothing new (org_public_site_content exists since the public site).
--
-- WHY: /legal draft (c) (docs/agents/legal/drafts/GUARDIAN_CONSENT_STAGE4.md) builds the second parent's invitation and the rep
-- coach's invitation to the commercial-message standard: "Sent by {club}, {club's mailing address}, {contact}, through FieldLogicHQ."
-- The product held no club mailing address. The only street address on file is billing_locations (the address a club gave us to
-- pay its plan, possibly a volunteer's home, never promised for family emails), and O3 ruled it is NOT used. So the club types one,
-- beside "Families' questions go to" on the public site's About row; with the guardian tier on, Publish and the rep Send invitation
-- refuse until the club has both (O1 = A extended).
--
-- WHAT CHANGES
--   org_public_site_content.mailing_address   NEW, text, nullable. CHECK 1–300 characters (the editor's cut is the same number,
--                                              MAILING_ADDRESS_MAX in lib/public-site-patch.ts). Shown on no page; read only by the
--                                              invitation's sender line (lib/club-email-context.ts clubMailingAddress).
--   No grant change: the table's existing grants and RLS cover the new column.
--
-- PRE-CHECK (prod): none needed — a nullable column with no default and no backfill.
-- Re-runnable.

begin;

alter table public.org_public_site_content
  add column if not exists mailing_address text;

alter table public.org_public_site_content
  drop constraint if exists org_public_site_content_mailing_address_check;
alter table public.org_public_site_content
  add constraint org_public_site_content_mailing_address_check
  check (mailing_address is null or char_length(btrim(mailing_address)) between 1 and 300);

comment on column public.org_public_site_content.mailing_address is
  'The club''s mailing address as typed on the public site About row (Signed-in family accounts Stage 4a, O3, mig 454). Printed only in the sender line of a family invitation email. Never the billing address.';

commit;
