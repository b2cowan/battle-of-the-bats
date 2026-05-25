-- Migration 089: Tournament Contact Model Refactor — Data Backfill
-- Populates the new org-member FK columns introduced in migration 088.
-- Prerequisites: migration 088 must be applied first.
-- See docs/active/TOURNAMENT_CONTACT_REFACTOR_PLAN.md for full context.

-- ============================================================
-- 1. Backfill tournaments.default_contact_member_id
--    Set to the org owner's organization_members record for every
--    tournament that doesn't already have one assigned.
-- ============================================================

UPDATE public.tournaments t
SET default_contact_member_id = om.id
FROM public.organization_members om
WHERE om.organization_id = t.org_id
  AND om.role = 'owner'
  AND t.default_contact_member_id IS NULL;

-- ============================================================
-- 2. Backfill age_groups.contact_member_id from old contacts
--    Match each age group's legacy contact (contacts.email) to
--    an org member with the same email in the tournament's org.
--    Contacts whose email doesn't match any org member are
--    silently dropped — they had no system access and therefore
--    no functional value; the division will fall back to the
--    tournament's default contact (owner).
-- ============================================================

-- PostgreSQL UPDATE…FROM: target table alias (ag) cannot appear in JOIN…ON
-- conditions within the FROM clause. Use comma-separated tables + WHERE instead.
UPDATE public.age_groups ag
SET contact_member_id = om.id
FROM public.contacts c,
     public.tournaments tv,
     public.organization_members om,
     auth.users u
WHERE ag.contact_id = c.id
  AND tv.id = ag.tournament_id
  AND om.organization_id = tv.org_id
  AND u.id = om.user_id
  AND lower(u.email) = lower(c.email)
  AND ag.contact_member_id IS NULL;
