-- 323 — A coach subscribes to the team's schedule: the link's generation and the day a calendar last read it
-- (Club Tier Stage 6d — owner ratification 2026-10-11, Asks 1, 8, 9 and the cost row; plan:
--  docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md §6 Stage 6d; hub K4MPu4ni53Ct7yrDcmWJd9 → Stage 6d, v91)
--
-- A COACH'S CALENDAR LINK IS SIGNED, NEVER STORED. The link is the membership's id, this generation and an HMAC of the
-- two under a server secret (CALENDAR_LINK_SECRET, lib/coach-calendar-link.ts), so the server can rebuild it every time
-- the coach opens the Subscribe window — the window shows the same link until Reset — and a database read alone can't.
-- The family feed's links are stored as a fingerprint only, which is why its door could show a link once and made a new
-- one on every press, silently stopping the old (S6D-02). One link per coach per team by construction (Ask 1): the
-- membership is UNIQUE(team_id, user_id).
--
--   calendar_link_generation   bumped by Reset (the old link answers an EMPTY calendar from then on, so its events
--                              leave the subscriber's calendar — S6D-04) and by REMOVAL, in the same write that revokes
--                              (the trigger below): re-adding a coach reactivates the same row, so without the bump a
--                              re-added coach's old link would come back to life.
--   calendar_last_read_on      the club-local day a calendar last read the link — "Read by your calendar today" in the
--                              window. Written AT MOST ONCE A DAY per feed (the owner's cost ruling: a write on every
--                              calendar check would cost more than it tells). NULL = never read.
--
-- ⚖ Service-role only, as the table already is (RLS on, zero policies). Additive: every existing row reads 0 / NULL — no
-- coach has a link yet, so nothing a customer holds changes. The trigger and its function are INVISIBLE to the drift
-- check (MANUAL_PROD_STEPS.json says so). Order: the 6d code reads both columns (the Subscribe window, the feed, Reset)
-- — apply BEFORE promoting it.

begin;

alter table public.rep_team_staff_memberships
  add column if not exists calendar_link_generation integer not null default 0,
  add column if not exists calendar_last_read_on date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rep_team_staff_memberships_calendar_generation_nonneg'
  ) then
    alter table public.rep_team_staff_memberships
      add constraint rep_team_staff_memberships_calendar_generation_nonneg check (calendar_link_generation >= 0);
  end if;
end $$;

-- ⚠ REMOVAL BUMPS THE GENERATION IN THE SAME WRITE THAT REVOKES — a trigger, not the app. Every path that flips a
-- membership from active to revoked (today `removeStaffMember`; tomorrow whatever else learns to revoke) retires the
-- coach's calendar link atomically, so a later reactivation of the same row can never bring an old link back. Doing it
-- in the app would mean reading the generation first, and a Reset racing the removal could then mint a link that
-- survives it.
create or replace function public.rep_team_staff_membership_calendar_on_revoke()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'active' and new.status = 'revoked' then
    new.calendar_link_generation := old.calendar_link_generation + 1;
  end if;
  return new;
end $$;

revoke all on function public.rep_team_staff_membership_calendar_on_revoke() from public, anon, authenticated;

drop trigger if exists rep_team_staff_memberships_calendar_on_revoke on public.rep_team_staff_memberships;
create trigger rep_team_staff_memberships_calendar_on_revoke
  before update of status on public.rep_team_staff_memberships
  for each row execute function public.rep_team_staff_membership_calendar_on_revoke();

comment on column public.rep_team_staff_memberships.calendar_link_generation is
  'Club Tier 6d: the coach''s calendar-feed link generation. The link = membership id + this + an HMAC (never stored). Bumped by Reset and by removal, so an old link answers an empty calendar.';
comment on column public.rep_team_staff_memberships.calendar_last_read_on is
  'Club Tier 6d: the club-local day a calendar last read this coach''s feed ("Read by your calendar today"). Written at most once a day. NULL = never read.';

commit;
