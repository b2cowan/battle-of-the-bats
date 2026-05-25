-- Migration 088: Tournament Contact Model Refactor — Additive Schema Changes
-- Retire the contacts table and replace with direct organization_members references.
-- This migration is purely additive (no drops, no data changes).
-- See docs/active/TOURNAMENT_CONTACT_REFACTOR_PLAN.md for full context.

-- ============================================================
-- 1. Add title to organization_members
--    Separate from display_name — this is a role/position label,
--    e.g. "Tournament Director", "U13 Convenor". Per-org/per-context.
-- ============================================================

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS org_members_title_length;

ALTER TABLE public.organization_members
  ADD CONSTRAINT org_members_title_length CHECK (char_length(title) <= 80);

-- ============================================================
-- 2. Add default_contact_member_id + notify_mode to tournaments
--    - default_contact_member_id: the org member whose email
--      appears in coach-facing emails and public registration pages
--    - notify_mode: 'all' = owner/admins always notified;
--                   'assigned' = only the division contact is notified
-- ============================================================

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS default_contact_member_id uuid
    REFERENCES public.organization_members(id) ON DELETE SET NULL;

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS notify_mode text NOT NULL DEFAULT 'all';

ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_notify_mode_check;

ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_notify_mode_check
    CHECK (notify_mode IN ('all', 'assigned'));

-- ============================================================
-- 3. Add contact_member_id to age_groups
--    Replaces contact_id (FK → contacts).
--    null = inherit from tournaments.default_contact_member_id.
-- ============================================================

ALTER TABLE public.age_groups
  ADD COLUMN IF NOT EXISTS contact_member_id uuid
    REFERENCES public.organization_members(id) ON DELETE SET NULL;
