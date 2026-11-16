# Session D — simplify, review and commit run (ONE chat, resumable across /clear)

Owner prompt to start or continue this run (the same words every time):

> Run the Session D review run: read `docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_SESSION_D_REVIEW_PROMPT.md`
> and do the next unticked stage.

## How this run works (read every time)

- Read **Progress** below and start at the first unticked stage. Do not redo a ticked stage.
- After each stage, tick it here with ONE line: what changed, findings count, owner rulings given. Write the tick
  **before** you pause, so a /clear loses nothing.
- At a **⏸ PAUSE** marker, stop and say to the owner, exactly: *"Pause point — run /clear, then paste:"* followed by
  the owner prompt above in a code block. Also pause early (tick first, note where you stopped inside the stage) if the
  chat has already run two heavy agents or the context is getting deep.
- Owner rulings asked inside a stage are asked in-chat (AskUserQuestion or plain question) — that is not a pause point.
- Product-owner voice to the owner. Never push. Never touch prod. Dev branch only. No commit until Stage 3, and Stage 3
  asks first.
- After any code change in a stage, re-run the **Tests** below and report pass counts. A red result is reported as red.

## What Session D is (context for every agent)

Several-permits build, Session D: **Find the time** — a level inside New schedule that lists every facility the club
holds on any permit, narrowed by dates, days, hours (extra ranges), kind, where, town and shortest useful block; picked
rows become ordinary time rows that remember their permit. Plan `docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md`
§4d + **Phase 4 (the build record and every default chosen — read it first)**; build prompt
`CLUB_SCHEDULE_SEVERAL_PERMITS_BUILD_PROMPT.md` "Session D"; drawing `CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWINGS.html`
tab 2 (`finder`, `finderWin`, `findNotes`, `SCR.find`). Owner rulings N1 A, P4 A, P7 A, P7b A, P12 A. Built 2026-11-16,
uncommitted. **No migration.**

**Invariants (every stage must keep them):**
1. **Free = held − booked − held by a draft**, one place and one club day at a time; a permit's dates off are never held
   (`blockDates` is the only rule). The 14 arithmetic tests are the spec — a cleanup that changes a number is a defect.
2. **One model of taken time:** booked comes from `readClubBookings` (the bookings a permit's Used figure counts), plus
   the schedules' own time (other schedules' FINAL slots, the asking form's rows / the asking schedule's slots). No
   second bookings reader.
3. **Drafts hold time only here:** other schedules' draft and in-review slots are counted apart and NAMED; nothing books
   them, and no other screen starts saying a draft holds time (build prompt ⚠8). The drafts-step warning (P7b A) reads
   the form's own found-row notes, not a new server read.
4. **`lib/permit-free-time.ts` stays pure and standalone** (guard 2): it imports only `./permit-time`; no React, no
   database, no knowledge of New schedule. Turning found time into rows stays in `lib/club-schedule-permit-rows.ts`.
5. **P4 A:** a day two permits hold is listed once; the chosen permit (default: the newer) prices it, settled in the
   rows at the pick so the send's own `settleOverlaps` never undoes it.
6. **A one-permit schedule, and a New schedule that never opens the finder, behaves exactly as before** (same rows, same
   time body, same drafts).
7. The route is a READ behind `resolveScheduler(req)` (owner/admin, the plan carries the scheduler); computer-only (no
   phone message, by ruling).

**D's files:**
- New: `lib/permit-free-time.ts`, `lib/permit-free-time-server.ts`, `app/api/admin/schedules/free-time/route.ts`,
  `components/admin/kit/club/schedules/FindTheTime.tsx`, `tests/unit/permit-free-time.test.ts`, this prompt file.
- Changed: `lib/permit-time.ts` (`Span` + `subtractSpans` exported, nothing else), `lib/club-schedule-permit-rows.ts`
  (`rowsFromFound`, `FoundPlace`, `FoundRow` appended), `lib/club-schedule-words.ts` (the Find-the-time words block +
  the `hoursWords` import + Session C's `billFromMost` possessive), `lib/club-schedule-document.ts` (Session C's one-rate
  note possessive), `components/admin/kit/club/schedules/{NewScheduleWindow.tsx,Schedules.module.css}`,
  `tests/unit/club-scheduler-screens-guard.test.ts` (the Back assertion only).
- Records: `docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md` (Phase 4), `TODO.md` (**the several-permits line
  only**, line ~318).

**NOT D's — never edit, never stage:** the other two hunks in `TODO.md` (the notifications line ~192 and the release
hardening lines ~326), `tests/unit/layout-run-journal.test.ts`, `.probe-edit.cjs`, `debug.log`, `OWNER_QA_LEDGER.md`,
`MANUAL_PROD_STEPS.json`, `.claude/commands/release.md`, `scripts/*`, every `BOARD_READY_*`, `NOTIFICATION_MESSAGE_ROWS_*`
and `RELEASE_PROCESS_HARDENING_*` file, `CLUB_SCHEDULE_SEVERAL_PERMITS_SESSION_B_REVIEW_PROMPT.md`, and any hunk another
session leaves in a shared file. If an agent wants to change one, report it instead.

**Tests** (run after any code change):
```
node --import ./tests/ts-resolver.mjs --test tests/unit/club-schedule-*.test.ts tests/unit/club-scheduler-*.test.ts tests/unit/permit-*.test.ts tests/unit/club-permit*.test.ts tests/unit/possessive-guard.test.ts
npx eslint <changed files>
npm run check:spelling
node scripts/check-css-selectors.mjs     # nothing new under Schedules.module.css
```
Built state: the first line 557/557 (permit-free-time 14/14) except `possessive-guard`'s one hit in
`components/coaches/PlayerGuardiansCard.tsx` (another session's). Whole typecheck when a stage touched lib/route code:
`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false` — clean except
`tests/unit/layout-run-journal.test.ts` (another session's). Known red that is NOT D's: `verify:changed`'s npm test step
(~25 failures across coach portal, billing, tournaments, workspace guards), `check:admin-type` (Billing/KitDialog),
`check:admin-old-look` (tournament schedule), `check:css-selectors` (platform-admin, public-site), `check:org-slug-callers`
(budget-categories).

## Progress

- [x] **Stage 1 · /simplify** — DONE 2026-11-16 (4 cleanup agents; ~40 findings, 12 applied, rest skipped). Applied: one shared span-merge
  (`unionSpans` exported from `permit-time.ts`, `unionMinutes` now sums it — same numbers; the finder's local `union` gone);
  the finder computes each cut's day-windows once per block instead of once per facility, and reads a block's places and
  dates once; `readFreeTime` drops its duplicate place read and reads the issuers beside the rest; route uses
  `FACILITY_TYPES`; two unused words deleted (`findEvery`, `findTickPlace`); `draftDaysSaid` uses `weekdayOf`; `FindOwnTime`
  no longer exported; `useFreeTime`'s counter ref → a closure flag (a closed finder now drops a late answer); `rowsFromFound`
  loses its index callback and uses `permitsSpan`; the window's `addFound` / `togglePermits` share `replacesTime` and
  `typedRowsKept`, `addFound` uses `permitsSpan`, the drafts card computes `foundWarning` once. Skipped on purpose (behavior
  or size): `bucketByDay` vs `permitUse`'s loop (invariant 1 — left with its comment), the seven-ternary "level table" and a
  `useFinder` hook (larger refactors, new Session E will add a level — revisit then), the slots-read embed rewrite and a
  server cache (need an owner ruling on staleness), `chipField`, `daysSaid`↔`overlapDays` (different join). Carried to Stage 2
  as review questions: the route's `own` via `readTimeBody`'s 40-row cap; `addFound` never moves a copy's shared venue the
  way `togglePermits` does; `addFound`'s dates-off use the found range. Tests 559/560 (permit-free-time 14/14; the one red is
  `possessive-guard`'s `PlayerGuardiansCard.tsx`, another session's); eslint, spelling, css-selectors clean; whole typecheck
  clean except `layout-run-journal.test.ts` (another session's). Findings count 0 rulings. — original brief: run `/simplify` scoped to D's files only. New abstractions to look at: `freeTime` and its
  local `union` / `without` / `longest` / `bucketByDay` / `takenAt` (does `permit-time.ts` already have any of them? —
  `unionMinutes` and `clip` are private there; prefer exporting over duplicating, but never change `permitUse`'s
  numbers); `readFreeTime` and `ownBookings`; `rowsFromFound` (its merge loop, its reuse of `settleOverlaps`);
  `useFreeTime` (the debounce + "answered" loading state); `FindTheTime`'s `chips` helper vs. the window's own chip
  markup (shared component?); the window's `addFound` vs. `togglePermits` (duplicated "keep typed rows / move place /
  widen dates / name from first permit" steps — a shared helper if it stays readable); `foundDraftNotes` /
  `foundHeld` / `foundWarning`; `draftDaysSaid` (does `permit-words` already say "4 Thursdays"?). Apply cleanups that
  keep the seven invariants; re-run Tests (+ typecheck if lib/route code moved).
- [x] **Stage 2 · /review** — DONE 2026-11-16 (4 lenses, 0 Critical/High, ~25 findings after triage). Owner picked fixes A–G (all applied): venue-less rows left out of the finder's read; Add found time moves a copy's shared venue; Add only on a current answer and counts pickable rows only; overlapping hour ranges merged (touching stay two) + test; route guards (non-object body, own's foreign/stuffed places) ; >40 rows worded; two-draft plurals; isolation test catches any import form. **Ruling: keep the widening + ONE `/plan` item** (Used figure, the pick, the generator — all blind to other schedules' final slots). Rest recorded in the plan's Phase 4. Tests 560/561 (permit-free-time 15/15; the one red is `possessive-guard`'s `PlayerGuardiansCard.tsx`, another session's); eslint, spelling clean; no `Schedules.module.css` selector finding; whole typecheck clean except `layout-run-journal.test.ts` (another session's). Original brief: run `/review` on D's files (after Stage 1), told to REPORT against the seven invariants
  plus: the slots read in `readFreeTime` (the `club_schedules!inner` embed shape, paging, `removed_at`, the window
  bounds, a schedule's own slots when `scheduleId` is given); the route's validation (`own` via `readTimeBody`'s
  40-row cap — does a big form break the finder?; `scheduleId` org check); DST and past-midnight handling (`windowOn`,
  `bucketByDay`); a booking with no facility; a venue with no facilities; `addFound` on a copied schedule, on a form
  with typed rows, with a permit already ticked, and the dates off it brings; unticking a permit after a find; the
  "Priced by" choice reaching the rows; the drafts-step warning's match by place and day (it can over-count — said in
  the plan); stale ticks after a filter narrows a row away; loading/failed states. Then list the findings to the owner
  in plain words, each with a recommendation (fix / leave), and ask which to apply. Apply the ones he picks, re-run
  Tests + whole typecheck.
  Also put to the owner, as a ruling (recommend; do not build here): the **build's widening** — other schedules' FINAL
  slots count as taken (plan Phase 4 ⚠) — keep (recommended) or drafts-only as the prompt said; and the **finding**
  that the permit's Used figure has the same gap (recommend: a `/plan` item, not this run).
  **⏸ PAUSE**
- [ ] **Stage 3 · commit** — ask the owner first ("Commit Session D now?"). Then, on `dev` (re-check
  `git rev-parse --abbrev-ref HEAD`):
  1. Tick Stages 1–2 here and update the plan's Phase 4 header ("committed `<hash>` 2026-11-1x" goes in a follow-up
     commit, as Sessions A–C did — never "uncommitted").
  2. Stage **explicit pathspecs only** — D's files above (new + changed + records + this prompt). Never `git add -A`.
  3. `TODO.md` carries two other sessions' hunks: stage **only the several-permits line**. Build the staged copy from
     `git show HEAD:TODO.md` with only that line replaced by the working copy's line, then
     `git update-index --add --cacheinfo 100644,$(git hash-object -w <tmp>),TODO.md` (see the auto-memory note
     "Partial commit out of shared files"). Check `git diff --cached TODO.md` shows ONE changed line.
  4. Commit message (no Co-Authored-By footer — owner rule):
     `Several permits, Session D: Find the time across every permit, inside New schedule` + a short body (the finder,
     the reading module and its route, found rows that remember their permit, P4's choice in the rows, P7b's card
     note and drafts warning, other schedules' final slots counted as taken, Session C's two possessives).
  5. `git show --stat HEAD` — confirm only D's files landed; if a foreign file slipped in, `git reset --soft HEAD~1`,
     unstage it, re-commit.
  6. A second small commit: the hash into the plan's Phase 4 header, the `TODO.md` line (same partial-staging method)
     and this prompt's Progress.
  Never push.
- [ ] **Stage 4 · close** — tick Stage 3 with the hashes. Update the auto-memory file
  `project_schedule_several_permits.md` and its `MEMORY.md` index line (D committed `<hash>`; what is still owed). Tell
  the owner, in product-owner voice: what was cleaned up, what was fixed, the rulings he gave, what is still owed —
  **a dev-server restart before the browser pass** (new files; the server may be shared, so ask before restarting),
  the browser pass on New schedule › Find the time, `/docs` and `/marketing` at the project's Close — and that the next
  build is **Session E** (`execute Session E of @docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_BUILD_PROMPT.md`).
