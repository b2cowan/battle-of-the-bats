-- Migration 304: a lineup is Ready only when a coach says so.
-- (Coach Lineups Deep Dive, Phase 2 · D1, owner-approved 2026-09-18.)
--
-- Today "Lineup set" means "at least one saved cell is non-blank" — a one-cell draft and a
-- finished, conflict-free lineup read identically everywhere a coach looks (the games hub, the
-- team Overview, the schedule's lineup peek). This adds the explicit Draft/Ready handoff the plan
-- calls for: a coach marks a lineup Ready once it is actually complete, and the product remembers
-- who did it and when — a real handoff to a co-coach instead of "Saved" standing in for "done".
--
-- `status` defaults 'draft' so every existing row (and every future insert through the ordinary
-- save path) starts there; only the new dedicated "mark ready" write path ever sets 'ready'. The
-- app clears status back to 'draft' on every ordinary lineup save (header or entries), so a stale
-- Ready flag can only survive as long as nothing about the lineup has changed since it was set.
--
-- `ready_by` follows `updated_by`'s existing nullable-on-delete convention (gotcha 3 on this
-- table) — a departed coach's name drops off the record rather than blocking the delete, and nothing
-- reads `ready_by` as proof the lineup is still ready (that's `status` alone).

alter table rep_team_lineups
  add column status text not null default 'draft',
  add column ready_at timestamptz,
  add column ready_by uuid references auth.users(id) on delete set null;

alter table rep_team_lineups
  add constraint rep_team_lineups_status_check check (status in ('draft', 'ready'));

-- A lineup marked ready always carries when — ready_by may later go null (coach account deleted)
-- without status itself needing to change, same as updated_by today.
alter table rep_team_lineups
  add constraint rep_team_lineups_ready_at_check check (status <> 'ready' or ready_at is not null);
