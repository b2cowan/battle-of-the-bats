# Prompt: get the unit tests green again

Paste this into a new session.

---

The full check run (`npm run verify:changed`) stops at `npm test`: on 2026-11-26, at commit `836968e67`, 38 tests
in 29 files failed. Sort them out so the checks after the tests run again (`check:dot-joins` is last in the chain and
is not reached today).

**What is already known** (a helper's sorting; treat every verdict below as a lead and open the code before acting).
35 failed on the last commit, 3 only on a Windows checkout, none because of anyone's uncommitted work. No money
defect was found. Re-run first: the list will have moved.

Since that run: the venue possessive is fixed (`af05df911`), the one real security gap
(`app/api/auth/password-reset-notice`, which skipped the two-step check) is fixed and reviewed (`e1020fe0f`), and the
type error another session carried in is fixed (`ea0ce27d3`). Leave that route alone.

## Work, in this order

**1 · Safety lists (6 tests + 1).** While red, new offenders pile up unnoticed.
- `team-move-coverage` (2): about nine tables with `org_id`, added 2026-11-13 to 11-26, have no recorded answer for
  what happens when a team moves between workspaces. **That is the owner's decision, one plain question per table
  with your recommendation. Do not classify them to turn the test green.** The second failure lists two fee tables
  that were dropped.
- `workspace-flip-guard` (portal-tag readers: about 6 to add, 2 to remove), `support-console-stage4b-inforce-guard`
  (a billing-sharing filter, not a liveness read), `team-coach-notices` (a one-off catch-up read),
  `club-scheduler-guard` (a manual seed script calls finalize). Each allow-list entry needs its reason in the file.
- `two-step-server-check-guard`: `app/api/platform-admin/prospect-clubs/route.ts` matches `const { auth } = gate`,
  reported as a false match. Confirm it reads no session before changing either side.

**2 · Real, small (1 + 3).**
- `possessive-guard`: `lib/org-deletion-words.ts` (two lines), `components/coaches/PlayerGuardiansCard.tsx`,
  `app/platform-admin/prospect-clubs/ProspectClubsScreen.tsx`. Use `possessive()` from `lib/utils.ts`. The deletion
  wording was reviewed by `/legal`: an apostrophe-only change, say so.
- `online-payments-profile` (3): a regex expects `\n}\n` and the file is CRLF on Windows. Make the test tolerate both.

**3 · Tests behind deliberate changes (about 27).** Confirm each product change was intended (find the commit) before
updating the assertion. Keep what the test protects; never delete an assertion just to pass.
`coach-schedule-phone-guard`, `coach-schedule-sheet-guard`, `coach-practice-plans-phone-guard`,
`coach-semantic-ink` (2, a deliberate warm panel that needs an exemption), `club-stage13d-time-handoff` (2),
`club-stage13a-doors-guard`, `club-accounting-teams-guard`, `kit-dialog-floor-guard`,
`notification-open-in-place-guard` (reported false alarm through an `import type` chain: prove it),
`support-console-stage3-guard`, `support-console-stage4b-coach-guard` (check the owner gate really is intact),
`plan-ending-screens`, `account-first-signup` (3), `chat-pause-guard`, `workspace-move-money`,
`public-face-s3a-emails`, `public-tournament-stage6-rules`, `tournament-stage5-event-settings`,
`series-date-groups`, `billing-plus-tax-words`, `public-tournament-stage6-walk` (3: it reads an old walk-file shape;
retire or repoint it).

Some later checks sit behind these first failures (the stage 13d test, the flip guard, the console footer test and
the walk tests), so expect a few more.

## Rules
- Shared working copy on `dev`: other sessions may have unfinished edits. Stage explicit paths only.
- A product defect found on the way is a finding to bring to the owner, unless it is one of the small ones above.
- Database checks, hooks and automation change only if the owner asks for that change (`AGENCY_RULES.md`).
- Use `/review` before offering to commit. Commit only on the owner's word.
- Report to the owner as a product owner: what was really wrong, what was only a stale test, and what needs their call.
