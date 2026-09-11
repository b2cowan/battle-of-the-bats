-- 288 — A staff member's kind is a stored LABEL, and it gates nothing
-- (COACH_STAFF_ACCESS_PLAN §2.1 — approved by the owner 2026-09-10 on review + mockup
-- `c8982bc5`, round 2; built 2026-09-11 as pass 2 of that plan.)
--
-- THE RULING: a team's staff comes in four kinds — assistant coach, team manager, team treasurer,
-- helper — and the word a head coach chose when they invited someone is a FACT worth keeping,
-- not a shape to be re-derived from their switches every time the page renders. Until now
-- "Helper" was worked out from the bundle (`staffKindLabel`), so granting a helper attendance —
-- the single most likely extra — silently relabelled them "Assistant". The manager and the
-- treasurer had no word at all and were invited as coaches.
--
-- ⚠⚠ THIS COLUMN NEVER DECIDES ACCESS. Every nav door and every route keeps deciding on the
-- individual grant in `capabilities`, exactly as before — that is the property the 2026-08-03
-- "a helper is a preset, never a third role" ruling existed to protect, and it is unchanged. What
-- the kind chooses: the starting bundle at invite time, the word on the staff row, the invite
-- email's wording, and the club admin's approval notification. Read `staffKindLabel()` in
-- `lib/coach-capabilities.ts` for the display rule; no route may call it.
--
-- NULL = "no label stored". The resolver falls back to today's derived answer for a NULL, so
-- nothing changes for a row written before this migration except the backfill below.
-- Head-coach rows never carry a kind: promotion nulls it, demotion writes 'assistant'.
--
-- ⚠ PART 2 IS DATA-ONLY AND INVISIBLE TO EVERY DRIFT CHECK. `check:migrations` compares
-- tables, columns and CHECK constraints; an UPDATE adds none of those, so it reports "in sync"
-- whether or not the backfill ever ran on prod. Its prod state is knowable only by asking the
-- database for the rows: `select count(*) from rep_team_staff_memberships where staff_kind =
-- 'helper'` should equal the number of helper-shaped assistant bundles there. Recorded in
-- MANUAL_PROD_STEPS.json for that reason.
--
-- ⚠ THE BACKFILL RECOGNISES A HELPER BY THE WHOLE SHAPE `staffKindLabel()` DERIVED — the resolved
-- bundle holds `schedule` and NOTHING ELSE: no schedule editing, no staff chat, no attendance, no
-- lineups, documents off, and none of the sensitive grants (money, notes, tryouts, contacts, email
-- families). The keys whose assistant DEFAULT is on must be explicitly false/off; the keys whose
-- default is already off may be absent. ⚠ A first draft tested only the first four keys and would
-- have stamped "helper" on a hand-built manager (schedule view + money + contacts) — caught by
-- /review before this reached prod; the two rows dev labelled under the draft match the whole
-- shape, verified by query. Every other assistant stays NULL and keeps reading "Assistant coach"
-- through the fallback, which is what they were called yesterday. Nobody is relabelled by this.
--
-- ⚠ IDEMPOTENT ON PURPOSE, because it was re-applied to dev after the correction above: the columns
-- are `if not exists`, the head-coach rule is added only when absent, and the backfill touches only
-- rows still NULL.
--
-- ⚠ NOT touched, deliberately: `rep_team_coaches` (the per-season record + live projection). The
-- kind is not projected — a season records head/assistant, and the projection invariant in
-- `lib/coach-membership.ts` is about ROLE + CAPABILITIES, which are what the write routes gate on.

begin;

-- ── 1. The column, on the membership and on the invite that seeds it ─────────────────────────
alter table rep_team_staff_memberships
  add column if not exists staff_kind text
  constraint rep_team_staff_memberships_staff_kind_check
  check (staff_kind in ('assistant', 'manager', 'treasurer', 'helper'));

alter table assistant_invite_tokens
  add column if not exists staff_kind text
  constraint assistant_invite_tokens_staff_kind_check
  check (staff_kind in ('assistant', 'manager', 'treasurer', 'helper'));

-- A head coach never carries a kind — a RULE, not a promise the two write paths keep between them
-- (/review, 2026-09-11). Added only when absent so the file re-applies cleanly.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'rep_team_staff_memberships_head_coach_has_no_kind'
       and conrelid = 'public.rep_team_staff_memberships'::regclass
  ) then
    alter table rep_team_staff_memberships
      add constraint rep_team_staff_memberships_head_coach_has_no_kind
      check (coach_role <> 'head_coach' or staff_kind is null);
  end if;
end $$;

comment on column rep_team_staff_memberships.staff_kind is
  'DISPLAY + DEFAULTS ONLY — the kind the head coach chose (assistant | manager | treasurer | '
  'helper). NEVER a gate: every route decides on capabilities. NULL = no label stored, the app '
  'derives one from the bundle (rows written before mig 288). Always NULL on a head_coach row '
  '(CHECK rep_team_staff_memberships_head_coach_has_no_kind).';

comment on column assistant_invite_tokens.staff_kind is
  'The kind this invite offers (assistant | manager | treasurer | helper); copied onto the '
  'membership on accept and chooses the invite email''s wording. Invites written before mig 288 '
  'are NULL and accept as an assistant.';

-- ── 2. DATA-ONLY backfill: the helpers that already exist keep their word ─────────────────────
update rep_team_staff_memberships
   set staff_kind = 'helper'
 where coach_role = 'assistant_coach'
   and staff_kind is null
   -- on by default, so must be explicitly off:
   and coalesce(capabilities->>'schedule', 'true') = 'true'
   and capabilities->>'scheduleManage' = 'false'
   and capabilities->>'staffChat' = 'false'
   and capabilities->>'attendance' = 'false'
   and capabilities->>'lineups' = 'false'
   and capabilities->>'documents' = 'off'
   -- off by default, so absent is off:
   and coalesce(capabilities->>'money', 'off') = 'off'
   and coalesce(capabilities->>'notes', 'false') = 'false'
   and coalesce(capabilities->>'tryouts', 'false') = 'false'
   and coalesce(capabilities->>'rosterPii', 'false') = 'false'
   and coalesce(capabilities->>'announcementsSend', 'false') = 'false';

commit;
