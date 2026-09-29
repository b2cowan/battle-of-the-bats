-- 312 — A club invites its head coach
-- (Club Tier Stage 2, owner rulings 2026-09-28: D10 + Ask 4 "one door" — "Invite a coach" lives on
--  the team's Coaches page, writes the coach membership and the team staff membership, sends the
--  staff-invite email, and works BETWEEN SEASONS because staff belong to the team.
--  Plan: docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md §6 Stage 2;
--  build prompt: docs/projects/active/CLUB_TIER_STAGE2_SERVER_PROMPT.md §2.)
--
-- The club reuses the portal's staff invite (assistant_invite_tokens, mig 174) rather than growing a
-- second invite machine. Three things that invite could not say:
--
--   1. coach_role — WHICH SEAT the invite offers. Every invite so far offered an assistant seat, so
--      acceptance hard-coded `assistant_coach`. A club naming a team's head coach needs the invite to
--      carry the role. ⚠ A ROLE, NOT A FIFTH `staff_kind`: mig 288 made the kind a label that never
--      gates anything, and forbids a head coach from carrying one (rep_team_staff_memberships
--      _head_coach_has_no_kind). A "head coach" kind would have been the first kind that DID gate —
--      the exact thing 288 was written to rule out. The same rule is mirrored here: a head-coach
--      invite carries no kind. The portal's own invite route never sends a role, so its form cannot
--      offer the head seat (default 'assistant_coach' = every invite that exists today).
--   2. sent_by — WHICH DOOR sent it ('portal' = a head coach or a Manage-staff holder; 'club' = the
--      club's owner or admin). It picks the email's words on a resend (a club invite never falls back
--      to "The head coach invited you"), tells the club who to tell when it is accepted, and keeps the
--      portal's staff panel from resending or rewriting the club's head-coach invitation.
--   3. program_year_id loses NOT NULL. It was provenance only (nothing about access reads it; the
--      accept writes TEAM membership), and a brand-new club team has no season at all yet — the club
--      must be able to name its coach before the first season exists. The FK and its CASCADE stay.
--
-- ORDER: apply to prod BEFORE promoting the code that writes these columns (the insert names them).
-- Additive and idempotent; no existing row changes meaning (every row reads 'assistant_coach' /
-- 'portal', which is what it was). Independent of 305–311.

begin;

alter table public.assistant_invite_tokens
  add column if not exists coach_role text not null default 'assistant_coach';

alter table public.assistant_invite_tokens
  add column if not exists sent_by text not null default 'portal';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'assistant_invite_tokens_coach_role_check'
       and conrelid = 'public.assistant_invite_tokens'::regclass
  ) then
    alter table public.assistant_invite_tokens
      add constraint assistant_invite_tokens_coach_role_check
      check (coach_role in ('head_coach', 'assistant_coach'));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'assistant_invite_tokens_sent_by_check'
       and conrelid = 'public.assistant_invite_tokens'::regclass
  ) then
    alter table public.assistant_invite_tokens
      add constraint assistant_invite_tokens_sent_by_check
      check (sent_by in ('portal', 'club'));
  end if;

  -- The membership's own rule (mig 288), on the invite that seeds it.
  if not exists (
    select 1 from pg_constraint
     where conname = 'assistant_invite_tokens_head_coach_has_no_kind'
       and conrelid = 'public.assistant_invite_tokens'::regclass
  ) then
    alter table public.assistant_invite_tokens
      add constraint assistant_invite_tokens_head_coach_has_no_kind
      check (coach_role <> 'head_coach' or staff_kind is null);
  end if;
end $$;

alter table public.assistant_invite_tokens
  alter column program_year_id drop not null;

comment on column public.assistant_invite_tokens.coach_role is
  'The seat this invite offers: head_coach | assistant_coach (mig 312). Written to '
  'rep_team_staff_memberships.coach_role on accept. Only the club''s Invite a coach door '
  '(sent_by = club) offers head_coach; a head-coach invite carries no staff_kind (CHECK).';

comment on column public.assistant_invite_tokens.sent_by is
  'Which door sent the invite: portal (a head coach or Manage-staff holder) | club (the club''s '
  'owner or admin, from the team''s Coaches page) (mig 312). Picks the email''s words, who is told '
  'on accept, and which door may resend, edit or cancel it.';

comment on column public.assistant_invite_tokens.program_year_id is
  'Provenance only — the team''s working season when the invite was sent. NULL when the team had '
  'no season yet (a club naming a new team''s coach, mig 312). Access never reads it.';

commit;
