-- ---------------------------------------------------------------
-- Migration 350 — Club Tier Stage 4c-2, Part B: a coach's name on the team's public page, and the head coach's tryout
-- questions address (drawings ruled 2026-10-22; build prompts docs/projects/active/CLUB_TIER_STAGE4C2_BUILD_PROMPT.md and
-- CLUB_TIER_STAGE4C2_PART_B_BUILD_PROMPT.md)
--
-- WHY: the public team page names no coach, and a family with a question about one team's tryouts can only write to the
-- club's general address (Stage 4 Ask 2; Asks 1–3).
--
-- WHAT CHANGES:
--   (1) rep_team_staff_memberships.show_name_public — each coach's own switch, per team, OFF by default. Name and role
--       only. On the MEMBERSHIP, not the person, because a coach on two teams decides per team, and every public reader
--       already filters status='active', so the name leaves the page the moment the seat does. ⚠ The removal write
--       (removeStaffMember) also sets it false (owner ruling 2026-10-22): a revoke keeps the row so a re-add restores the
--       coach's grants, but a re-added coach decides about their public name again. Demotion keeps it.
--   (2) rep_team_tryout_contacts — ONE row per team, carried across seasons (it is not on rep_program_years: a head
--       coach's address outlives a rollover while they hold the role). The address, the membership that set it, when,
--       and the club's reset (when + who) for the coach's row "The club put its own address back on {date}".
--       A SEPARATE TABLE, not columns on rep_teams, deliberately: rep_teams is read whole on public pages (the team page,
--       the tryout page, share cards), and the coach's address may appear on exactly ONE public surface — the team's own
--       tryout page while open or not open yet. Here it can only be read through its own reader, so no `select('*')` on
--       the team can carry it into a page's payload by accident.
--       ⚠ The address ENDS WITH THE SETTER'S HEAD-COACH ROLE, twice over: removeStaffMember and setStaffMemberRole
--       (demotion) clear it in app code, AND every reader shows it only while set_by_membership_id is an active
--       head_coach membership of this team. A NULL setter (the membership deleted with its user) therefore reads as unset.
--       The CHECK is the weak form on purpose: address ⇒ set_at. It cannot also demand a setter, or deleting a user
--       (FK SET NULL) would be refused by this table.
--
-- Service-role only (RLS on, zero policies), like rep_team_staff_memberships: every read and write goes through
-- lib/coach-tryout-contact.ts. Schema-visible only (a column, a table, its constraints and indexes); no MANUAL_PROD_STEPS
-- entry. Safe to run twice. Prod: at or before the promote that carries Stage 4c-2 Part B's code.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.rep_team_staff_memberships
  ADD COLUMN IF NOT EXISTS show_name_public boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.rep_team_tryout_contacts (
  team_id              uuid PRIMARY KEY,
  org_id               uuid NOT NULL,
  email                text,
  set_by_membership_id uuid,
  set_at               timestamptz,
  reset_at             timestamptz,
  reset_by             uuid,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rep_team_tryout_contacts_team_fk FOREIGN KEY (team_id)
    REFERENCES public.rep_teams (id) ON DELETE CASCADE,
  CONSTRAINT rep_team_tryout_contacts_org_fk FOREIGN KEY (org_id)
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  CONSTRAINT rep_team_tryout_contacts_setter_fk FOREIGN KEY (set_by_membership_id)
    REFERENCES public.rep_team_staff_memberships (id) ON DELETE SET NULL,
  CONSTRAINT rep_team_tryout_contacts_reset_by_fk FOREIGN KEY (reset_by)
    REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT rep_team_tryout_contacts_email_check CHECK (
    email IS NULL OR (char_length(email) BETWEEN 3 AND 254 AND position('@' in email) > 1 AND set_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_rep_team_tryout_contacts_org ON public.rep_team_tryout_contacts (org_id);
CREATE INDEX IF NOT EXISTS idx_rep_team_tryout_contacts_setter ON public.rep_team_tryout_contacts (set_by_membership_id);

ALTER TABLE public.rep_team_tryout_contacts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rep_team_tryout_contacts TO service_role;

COMMIT;
