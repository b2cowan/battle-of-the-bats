/**
 * THE ARCHIVE SENTENCE — one sentence for the one action, whichever door the organizer archives
 * from (the dashboard's "Archive Tournament", the Tournaments list's status menu). Plan rule 8,
 * "one archive sentence" (TOURNAMENT_ADMIN_REDESIGN_PLAN.md F32); words by /marketing 2026-09-29.
 *
 * It must stay TRUE to the code: archived is not a public status (lib/public-tournament-data.ts
 * PUBLIC_STATUSES), so the site and its links go dark at once; an archived tournament does not
 * occupy a slot; and the only way back is the Tournaments list's status menu, which the set-status
 * route refuses when the plan has no free slot. There is no restore on Past tournaments — the
 * sentence it replaces promised one.
 * ⚠ It says nothing about coaches ON PURPOSE: /review 2026-09-29 found the coach side has no
 * archived gate — a coach still opens their registration's record (app/coaches/tournaments), so
 * the Tournaments list's old "coach-portal access … goes offline" was false and was dropped.
 */
export const ARCHIVE_CONFIRM_BODY =
  'Its public site goes offline right away, so every link you’ve shared stops working, and its tournament slot is freed. To bring it back, change its status on the Tournaments list; you’ll need a free tournament slot on your plan.';
