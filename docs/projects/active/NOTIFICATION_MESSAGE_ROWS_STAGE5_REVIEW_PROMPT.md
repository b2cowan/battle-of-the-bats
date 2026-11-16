# Review prompt — Notifications that read at a glance, Stage 5: simplify, review, docs, commit

Paste into a fresh session: **"Run the review prompt in docs/projects/active/NOTIFICATION_MESSAGE_ROWS_STAGE5_REVIEW_PROMPT.md"**

---

## Your job

Stage 5 of `NOTIFICATION_MESSAGE_ROWS_PLAN.md` is RULED (Q1–Q7, owner "as recommended", 2026-11-15) and BUILT, uncommitted. Read
the plan's "Stage 5 as built", "Stage 5 rulings" and "Stage 5 owner questions" first; they are binding, do not re-open them. Then,
in this order: **`/simplify` → `/review` → `/docs` → commit.** The owner has said to commit at the end of this prompt (2026-11-15);
that covers this work only.

## The files of this work

- New: `lib/score-notice.ts` (the words, pure), `lib/score-notice-server.ts` (the read before the save, the send).
- Changed: `lib/notification-facts.ts` (five labels), `lib/notify-recipients.ts` (`resultsUserIds`),
  `app/api/scorekeeper/[orgSlug]/score/route.ts`, `app/api/admin/games/route.ts` (the score entry and the forfeit),
  `tests/unit/notification-facts.test.ts` (the Stage 5 block).
- Docs: `docs/projects/active/NOTIFICATION_MESSAGE_ROWS_PLAN.md`, this prompt file.
- **Shared files, ONLY this work's hunk** (other sessions had uncommitted edits in each before Stage 5 started):
  - `TODO.md` — the 🔔 Notifications line only.
  - `docs/agents/db/DATA_DICTIONARY.md` — the `notifications.event_type` paragraph only (the dead list now names six; `score_submitted`'s audience).
  - `docs/agents/legal/CASL_LATE_BILL_EMAIL.md` — the "Reviewed 2026-11-15 — Stage 5 as built" section only.
  - `docs/agents/legal/LEGAL_INDEX.md` — the tail of the CASL row ("Stage 5 as built … 27 → 28") only.
  - `docs/agents/legal/drafts/PRIVACY_POLICY.md` — finding 11's "about 28 kinds … and a scorekeeper's email address" only.

## 1. `/simplify`

Look at, in particular: whether `readScoreNoticeGame` + `sendScoreNotice` should be one call or stay two (the read must happen BEFORE
the save so a correction can name the old result: keep that); whether `resultsUserIds` duplicates `checkInUserIds` /
`tournamentTeamAdderUserIds` enough to share a member read (they share `scopedToTournament` already); whether `fanPlaceholder` is
the right reuse for slot words; the `UNREAD` fallback. Keep: `lib/notification-facts.ts` imports nothing; the pure/server split
(the test imports the words without the server client); the empty-list stop before `notify()`.

## 2. `/review`

Argue from the code. Check at least:
- Every sender: the read is after the scope guards and before the save; a failed read never stops a score; a refused save sends no
  notice; `held` comes from the save's own answer on all three paths.
- `readScoreNoticeGame`'s embedded select (`teams!games_home_team_id_fkey`, `divisions` via `games_age_group_id_fkey` on
  `division_id`) actually returns names against the dev database — run one read through a probe in `.probe/`, don't trust it.
- A correction: "Was" only when the game was final before (completed or forfeit); a pending re-entry has no Was row.
- Audience: owner, admin, staff (assigned), an official only on a plan with volunteers, a coach granted the score tool; never a
  league role, treasurer or plain coach; never the actor; nothing when the list is empty.
- Every blank input still opens as rows (the test reads them back; add any it misses).
- Nothing else in the repo reads the old bodies ("Submitted by scorekeeper", "needs admin approval", "team advances").

Fix what is real, add a test for each fix, and record the outcome as a "Stage 5 review" section in the plan.

## 3. `/docs`

`lib/help-content/tournaments.tsx` ~2101–2110, FAQ "Where does a 'score submitted' notification take me?" (and its keywords /
searchText ~2032–2033, 2104): it says the notice goes to admins when a scorekeeper submits. Now it goes to everyone who can open
Results (not the person who entered it), for every entry including an admin's, and says the game, the score, whether it is final or
waiting for approval, and who entered it. Search the other help files for any sentence about this notice. Record what changed in the
plan's review section.

## 4. Verify, one at a time

`node --import ./tests/ts-resolver.mjs --test tests/unit/notification-facts.test.ts`, then `club-stage2-server-guard`,
`club-stage2-screens-guard`, `notification-feed-grouping`, and the tests of anything you touched; `npm run check:spelling`;
`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` (only the untracked `tests/unit/layout-run-journal.test.ts` may fail);
`npm run verify:changed`. It already failed on 2026-11-15 for other sessions' files (workspace-flip, possessive guard, one door for
the plan, the coach-stylesheet chain, billing rail, schedule sheet guards, dispute screens, Stage 6 owner-walk summary and more,
none in a file of this work); a NEW failure in a file of this work is yours.

## 5. Commit

- `git rev-parse --abbrev-ref HEAD` must be `dev`. Stage **explicit pathspecs only**, never `git add -A` / `.`.
- For the five shared files, commit only this work's hunk: use a temporary index (`GIT_INDEX_FILE`), apply the exact hunk, and commit
  without touching the other sessions' edits (the auto-memory note "Partial commit out of shared files" has the recipe). Re-read each
  shared file's diff first; another session may have moved it since.
- One commit for the build and its review fixes and docs, message in the plan's style, e.g. "Notifications read at a glance, Stage 5:
  'Score submitted' names the game, the score, final or waiting, and who entered it, and reaches only the people who can open Results;
  the six never-sent kinds kept on purpose". **No Co-Authored-By footer** (owner rule).
- `git show --stat HEAD`: only this work's files. If anything foreign landed, `git reset --soft HEAD~1`, unstage it, re-commit.
- A second, hash-only commit: the hash in the plan's status line and "Stage 5 as built", the `TODO.md` line (its hunk only), and the
  auto-memory note `project_notification_message_rows.md` and its `MEMORY.md` line (outside the repo, not committed).
- Do not push.

## Hand-off

- **Dev server:** shared modules changed, so it needs a restart before the owner's browser check. First check no other session is
  mid-sweep (a `check-layout-invariants.mjs` or `.layout-check-head.mjs` process, or `next start` servers on ports 3046+; one was running
  on 2026-11-15). If one is, report and ask; do not restart under it.
- Tell the owner, in product-owner words, what review and docs changed, and how to test (plan "Stage 5 as built").
- Next: the owner's browser check of Stages 2–5, then the one walk (plan Stage 6).
