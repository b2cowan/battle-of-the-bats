# Club Tier Stage 7d: the close-out agents (prompt)

> **Written 2026-10-22** after the 7d build (walk §361 published, https://claude.ai/artifact/U5kFSggaVAN2Z1YmVq8o5N; nothing
> committed). **Paste this into a new chat on `dev`.** It runs six agents over the 7d build, in order, and **logs each one the
> moment it finishes**, so any later chat can tell which ran.

## ⚠ The logging rule (why this prompt exists)

Last time the agents ran but no record said so, and the next chat could not tell what was done. So:

1. **The log is the checklist "7d CLOSE-OUT LOG"** in `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`
   (§6 Stage 7, under "7d BUILT"). It has one `[ ]` line per step. **It is the only place a step counts as done.**
2. **After EACH agent finishes, before you start the next one,** tick its line `[x]` and write after the dash: the date, the
   result in one line (e.g. "4 findings, 3 fixed, 1 put to the owner"), and the files it changed (or "no changes"). A step
   that was skipped or blocked gets `[–]` and the reason. **Do not batch the ticks at the end.** If the chat dies halfway,
   the log must already show how far it got.
3. **Read the log first.** If some lines are already ticked, another chat ran those: do not re-run them, start at the
   first `[ ]` line.
4. When all lines are ticked, also: add one sentence to Owner QA Ledger **§361** ("Close-out agents run 2026-10-xx:
   /simplify, /review, /design, /marketing, /docs, /strategy — see the plan's 7d close-out log"); add a row to the project
   index (`ArtifactData`, artifact `MBKRySURVFu3V9cZJvmjVr`, collection `log`, the next free id for the day; **read
   `stages/s7` first and pin `if_version`** when you update its anchor); and update the TODO line "Stage 7d" so it stops
   saying the agents are owed.

## What to run, in this order

Scope is **the 7d change only**. The working tree holds other sessions' uncommitted edits (TODO, the plan, the ledger, the
design log, the admin house-league and rep-teams pages, the public site files and more): **do not review, fix or stage
them.** The 7d files are listed at the bottom.

1. **`/simplify`** first, so review runs on the cleaned-up version. New abstractions to look at: the shared row mapping
   (`lib/coach-tournament-rows.ts`, `CoachTournamentRows`), the head-coach rule (`lib/coach-event-head-coach.ts` +
   `resolveEventHeadCoachAccess`), the clock labels (`lib/game-clock-labels.ts`), the batched finish read
   (`lib/coach-tournament-finish.ts`), the road-back lookup (`tournamentRoadBack`).
2. **`/review`** (high risk: it changes who may write to a record that routes the organizer's mail). Focus on: the edit
   rule (an assignment decides before free-team membership; the route refuses before any write; the page never offers
   what the route refuses); the autosave (a blank name never sent, the email only on leaving the field, a 400 shown at
   the field, the transient pill); money redaction on the list and the Registration card; the finish read (one batch,
   absent on any failure); the road back (absent, never a dead row); the `?day=` read on both Schedules (a day, never a
   year: `HISTORY_ENDPOINTS` unchanged).
3. **`/design`** at 390 and 1440, both portals, warm and dark: the list (paid, free team, free hub), the page, the
   head-coach form and line, the Schedule sheet's new row. Against drawings 6–8 (https://claude.ai/artifact/MLqvD7TXbLM5QX8H9mmapZ).
   Note the build's departures in plan §6 "7d BUILT" before calling them drift.
4. **`/marketing`** on every new or changed sentence: "Waiting on them", "Your club's tournament", "Games on your
   Schedule", "… · opens on …", "Fan view of every tournament", "No fee · your club's team", "Head coach for this event",
   "Email the organizer uses" and its hint, "Enter a head coach name.", "Only the head coach can change who coaches at
   this event.", "Ask the head coach to change this.", "The organizer sets the time, place and score", "Add the games to a
   calendar", "No announcements from the organizer.", the Registration rows ("Not checked in yet", "Marked no-show",
   "Deposit paid · … owing", "… owing · due …"). Placements are ruled; the words are theirs.
5. **`/docs`**: the coach help's Tournaments article (`lib/help-content/coaches.tsx`, section `tournaments` and its FAQs):
   the page's help door, "Games on your Schedule" and the road back from a game's sheet, who may change the event's head
   coach (and that it saves itself), the list's bands and chips. Both portals read the same article.
6. **`/strategy`**: a plan-inclusion check only (no price, no new gate). Confirm nothing here changes what a plan
   includes; log it.
7. **Gates after the fixes:** `npx next typegen` then `npm run typecheck`; the 7d tests
   (`tests/unit/coach-event-head-coach.test.ts`, `coach-tournament-rows.test.ts`, `coach-tournament-clocks.test.ts`) and
   the guards (`coach-page-actions-guard`, `coach-history-endpoint-guard`, `table-recipe-guard`, `coach-free-bar-guard`,
   `our-team-one-answer-guard`, `chat-pause-guard`); `npm run verify:changed`. Known failures that are NOT this work:
   `tournament-stage3-part7-guard` ("one side for search"), and the Schedule page's opponents-book effect lint error.

## Rules that still bind

- **Commit nothing** unless the owner says so in this chat. If they do: a private index, the 7d files and hunks only
  (`memory/reference_partial_commit_shared_tree.md`).
- A fix that changes what the owner will see goes on the walk page (§361) in the same chat: republish the same file
  (`docs/projects/active/CLUB_TIER_STAGE7D_WALK.html`).
- Anything an agent wants that touches an owner ruling (design log 2026-10-20 "STAGE 7", the "7d build" entry) is put to
  the owner, not done.
- Do not restart the dev server unless the owner asks (another session may be walking on it); say a restart is owed
  before the §361 walk.
- Open question already with the owner (walk call c2): roster submission's rule. Do not decide it here.

## The 7d files

New: `lib/coach-event-head-coach.ts`, `lib/game-clock-labels.ts`, `lib/coach-tournament-rows.ts`,
`lib/coach-tournament-finish.ts`, `components/coaches/CoachTournamentRows.tsx`,
`components/coaches/CoachTournamentRecordParts.tsx`, `components/coaches/TournamentRegistrationCard.tsx` (+ `.module.css`),
the three tests above, `docs/projects/active/CLUB_TIER_STAGE7D_WALK.html`.
Changed: `lib/coach-registration-access.ts`, `lib/basic-coach-teams.ts`, `lib/coach-status-model.ts`,
`lib/coach-tournament-games.ts`, `app/api/coaches/tournaments/[teamId]/route.ts`,
`app/api/coaches/[orgSlug]/teams/[teamId]/tournament-history/route.ts`, `app/[orgSlug]/coaches/teams/[teamId]/tournaments/page.tsx`,
`app/[orgSlug]/coaches/teams/[teamId]/tournaments/[registrationId]/page.tsx`, `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx`,
`app/coaches/tournaments/page.tsx` (+ css), `app/coaches/tournaments/[teamId]/page.tsx`,
`app/coaches/team/[basicTeamId]/tournaments/page.tsx` (+ css), `app/coaches/team/[basicTeamId]/team.module.css`,
`app/coaches/coaches-portal.module.css`, `app/[orgSlug]/coaches/coaches.module.css` (only the `.sourceNoteLink` headstone),
`components/coaches/`: `CoachTournamentRecord.tsx` (+ css), `CoachLiveSchedule.tsx` (+ css), `HeadCoachEditor.tsx` (+ css),
`TeamHQ.tsx` (+ css), `CoachPortalShell.tsx`, `ScheduleEventSheet.tsx`, `ScheduleEditor.tsx`, `ScheduleCalendarViews.tsx`,
`useScheduleOpensOnToday.ts`, `CoachScheduleCalendarButton.tsx`; `tests/unit/coach-page-actions-guard.test.ts` (one SITES row);
`scripts/seed-club-fixture.mjs` (`--tournament-games`).
Deleted: `components/coaches/TournamentStatusBlock.tsx` (+ css), `CoachRecordJumpNav.tsx`, `CoachStandingsSnapshot.tsx`.
Records touched by the build (other sessions also edit these files — touch only the 7d lines): the plan §6 Stage 7, the
design log's "7d build" entry, `COACH_ROW_LIST_RECIPE_PLAN.md` (F-30, B2), TODO "Stage 7d", ledger §361.
