# Kickoff — development lifecycle re-evaluation, stage 2 · Session — THE BUILD

Paste everything below the line into a fresh chat. (Written 2026-09-15 by the proposal session after
the owner ruled all ten decisions "Build as drawn". It supersedes
`COACH_DEVELOPMENT_REEVAL_STAGE2_SESSION_PROMPT.md`, whose job — the proposal tab — is done.)

---

You are picking up the **coach development lifecycle re-evaluation** at **stage 2 · Session** — the
**build**. The owner has ruled every decision; you are not re-opening any of them. Your deliverable is
the product as drawn on the artifact's "2 · Session" tab, on dev, verified, with `/simplify`,
`/review` and `/docs` run, the walk written onto the tab, and a private-index commit on the owner's
say-so. Product-owner voice in chat; technical detail in the plan, the commit and the code.

## Read first, in this order

1. Your auto-memory `project_coach_development_lifecycle.md` — the top two blocks are the current state
   (stage 2 ruled; stage 1 committed `210333ae`).
2. **Plan §19** in `docs/projects/active/COACH_DEVELOPMENT_LIFECYCLE_PLAN.md` — the rulings table
   C1–C10 and "expected at build". This is the contract. Plan §18 (Stage 1) for what you inherit.
3. The artifact — **https://claude.ai/code/artifact/0f62f000-5b68-4923-ad00-9f32fb1fe3ad** — read it
   with the Artifact tool (`action: "read"`, that url; the file is
   `docs/projects/active/COACH_DEVELOPMENT_LIFECYCLE_REEVALUATION.html`) **before you edit it**. Read the
   whole "2 · Session" tab: the Before frames say what is wrong today, the After frames are what you
   build (every green marker is a build instruction), "Where else it touches" is the blast radius,
   Decisions C1–C10 carry the owner's rulings and the two revisions he made on his read (C7 phone
   dropdown, C8 not-assessed-with-reason). Build to the frames; where a frame and the plan table
   disagree, the plan table wins and you say so.
4. Ledger §187 (Stage 1's verification pattern) and §185 (Stage 0's). Your ledger entry will be the
   next free § after the tail (§188 is the practices session's; check the tail — never sort the §s).

## The code you are changing (read all of it before the first edit)

- `app/[orgSlug]/coaches/teams/[teamId]/development/page.tsx` — `SessionsView` (the list, C5), `startSession`
  (POSTs the sheet), the scope-dialog host, `OverviewView` (reads `unrecordedCount` — the ONE rule).
- `app/[orgSlug]/coaches/teams/[teamId]/development/sessions/[sessionId]/page.tsx` — `SessionView` (header
  form → when-line, C6; chips, C3; `patchSession` / `saveSessionDate` / `saveSessionEvent` → the sheet,
  C4/C10; `scopeSentence` foot), `SessionReviewDialog` (C8/C9 — rewrite; its `fewer` reads
  `attemptsPerSession` today).
- `components/coaches/SessionScopeDialog.tsx` — becomes the session sheet (C1/C4/C10): `mode: 'start' |
  'change'`; add the When question, the per-test count steppers, "+ New test…" (opens
  `MetricDefinitionSheet` stacked — Stage 1's precedent for a stacked QuestionShell), the two-column
  roster, Delete session in change mode's footer. Keep `QuestionShell`.
- `components/coaches/SessionRecordGrid.tsx` — `attempts` is `max(1, type.attemptsPerSession, saved)` today;
  becomes the session's planned count for that test + the row's own extra (C2 "+", cap 5); saved
  attempts render in the input box style (C7); `describeAttempts(values, def, expected)` in
  `lib/measurable-series.ts` takes the session's count; "entered by" off the row (keep the author in
  Edit + the review); the phone composition (C7) in `DevelopmentSession.module.css`; the tests as a
  native `<select>` at ≤640 (C7) — the desktop chips stay.
- `lib/development-session-view.ts` — `sessionRows`, `sessionScopeCounts`, `scopeSentence`, `rowState`.
  **The ONE counting rule** (C8 housekeeping): a skill's observation is a recorded cell here, the way
  the reader in `lib/db.ts` (~line 8660, `unrecordedCount` / `scopeCellCount`) already counts it. Today
  the grid foot counts entries only and the review maps observations in — that is the live defect.
  Put the rule in this module and make the page, the review, the list and the reader read it.
- `lib/db.ts` — the sessions reader (derived counts; add the practice name for the caption — one more
  read, or ride the events already loaded), `createRepTeamEvaluationSession`, the session update.
  `lib/types.ts` `RepTeamEvaluationSession` (`scopeMetricIds`, `scopePlayerIds`, `eventId`).
- API: `app/api/coaches/[orgSlug]/teams/[teamId]/development/sessions/route.ts` (POST) and
  `sessions/[sessionId]/route.ts` (PATCH scope / date / event; DELETE) — the scope PATCH gains the
  counts; `roster/[playerId]/development/measurables/route.ts` validates `attemptNo` — it must accept
  up to the row's planned count + the "+" (cap 5), never the definition's.
- `components/coaches/MetricDefinitionSheet.tsx` — the Attempts field leaves (C1). `attemptsPerSession`
  is also read in `lib/measurable-definition.ts`, `lib/development-input.ts`,
  `lib/development-report.ts` (Coverage's "(of 2)" → the session's count),
  `history/development/panel.tsx`, `scripts/seed-demo-coach.mjs`, `scripts/check-demo-coach.mjs`,
  `scripts/seed-uat-coach-fixture.mjs`, `tests/unit/development-definitions.test.ts`,
  `tests/unit/development-report.test.ts`. Grep `attemptsPerSession|attempts_per_session` and settle
  every reader. The column may stay in the DB as the seed for "last time's count" when no session
  has run the test yet (C1's pre-fill rule: last session's count → else the definition's stored
  count → else 1); the sheet stops writing it; a new test writes 1.
- **The migration** — the tail is `supabase/migrations/297_…` (PROD-OWED, the tournaments session's);
  yours is 298: a count per test on the session's scope (a jsonb map `metric_id → attempts` beside
  `scope_metric_ids`, or fold both into one jsonb — `/dba` decides; register RLS if a new table).
  Apply to dev with the repo's migration runner, `npm run refresh:snapshots`, and update
  `docs/agents/db/DATA_DICTIONARY.md` in the same unit of work (`check:dictionary` fails otherwise).
  Order-critical after 297. Note it PROD-OWED in the ledger entry with its anchor.
- **C10 on the Practice plans side** — where a practice's date is changed (the schedule's event
  editor; API `events/[eventId]/route.ts`): if a session is linked (`event_id`), confirm with the
  session named and its attempt count, then move the session's date and re-stamp its attempts
  (`saveSessionDate`'s existing two-statement server operation — reuse it, don't re-implement).
  A deleted practice nulls the link and leaves the session's date. ⚠ Another session has been
  building in the practice-plans tree today — `ListAgents` + `SendMessage` before you touch
  `practice/[eventId]/page.tsx` or the events route, with your exact anchors.
- The old "the event pre-fills the date and never owns it" rule (Practice Plans §10.2 ruling 1) is
  **reversed on its reason** by C10 — update the code comments that cite it (the session page header,
  `SessionScopeDialog`, `lib/types.ts`) so the code no longer argues for the old rule.

## The fixture and the demo

- UAT (`tests/uat/.auth/coach.json`, team "UAT Test Team", org from `UAT_ORG_SLUG` in `.env.local`):
  the 10 Jun session "Phase 2 probe — scoped" holds every state — but its **sprint results sit under
  the RETIRED 60-yd sprint** while the live one is in scope with nothing (a successor walk's leftover).
  `node scripts/seed-uat-coach-fixture.mjs` (dev only, idempotent) is the reset; make the seed put the
  results under the live definition if the walk needs them there, and give each seeded session its
  counts per test (sprint 2, changeup 3). The 26 Aug session is linked to "UAT probe practice"
  (event `773afff0…`, dated 14 Sept) — under C10 that is impossible; the seed must either move the
  session to the practice's date or unlink it. Decide in the seed and say which in the ledger.
- Demo (Riverdale Ridge): `scripts/seed-demo-coach.mjs` seeds sessions — give them counts per test;
  the tour's "Find the two blanks" beat lands on the Sessions list — keep
  `data-sandbox-tour="development-sessions"` on the list's wrapper (`check:demos` fails if the anchor
  moves). Do NOT re-seed prod; the master build does (owner ruling 2026-09-13).

## Gates and traps

- `tests/unit/development-vocabulary-guard.test.ts` refuses the old words on every surface it lists —
  add your new surfaces to it (the sheet, the review) and use test · skill · result · observation ·
  attempt. `tests/unit/coach-page-actions-guard.test.ts` and `scripts/layout-screens.mjs` know the
  session page (`coach-development-session`, `-scoped`, `coach-development-sessions`); the title
  changes (C6) and the header form leaves — update the ready selectors; `check:layout --only=` those
  ids at 361/390/768/1440; **never a full sweep or `--prune` on the shared dev server**; prune stale
  baseline rows by hand.
- The table standard is `docs/agents/design/TABLE_AND_LIST_STANDARD.md` — the list (C5) and the
  review table (C8) follow it (comfortable density, heading ink one step below the row, figures
  right with the heading where the figures go, chevron last, no row delete). The shared
  `.tableAsCards` recipe tints item cards on a phone; the standard says an item row is never tinted —
  flag it to the standard, do not fork the recipe inside this list.
- The dev server is shared: no restart for routine edits; a restart before the owner's browser
  testing because you add a migration and touch shared modules; deleting component files crashes the
  compile worker (full restart). Read `AGENTS.md`'s restart and memory rules.
- The working tree is shared; peers may hold uncommitted hunks in `coaches.module.css`, the plan, the
  ledger, `TODO.md`, `layout-screens.mjs`, `.layout-baseline.json`, the help content. Build the commit
  in a **private index** (HEAD + your hunks; the Stage 1 memory block records the exact technique —
  `-U0` hunk filter + `git apply --cached --unidiff-zero`; verify in an isolated worktree). Never
  `git add -A`, never `git stash`, never commit without the owner's say-so. The artifact HTML is LF
  in the working copy now — keep it LF.
- Every figure in a demo or help sentence is computed or absent. `formatTime()` for any clock.

## Verification at hand-off (the pattern §187 set)

typecheck; `verify:changed`; the unit tests you touched + new ones for the counting rule, the
pre-fill rule, the "+" cap, the keep-or-delete path, the When rule; `check:layout --only=` the
session ids; `check:demos`; `check:dictionary`; the metrics probe and a new session probe (Playwright
from `scripts/.tmp-*.mjs`, deleted after) at 1440 and 390 — the first field on screen at load on the
phone is a pass criterion. Then `/simplify` → `/review` → `/docs` (the Skills & Goals guide's
"Recording a session" and "Reviewing a session" sub-topics, Delete's new home, the When question,
the dropdown on a phone; keep old words as search keywords).

## Hand-off

Write the checkable walk onto the "2 · Session" tab (Parts A–F, keys `w-C…`, the Define tab's
pattern: `#session-walk`, a `.wtally` entry, the summary iterating its `.wstep`s), mark the tab
"built · walk owed", republish with the `url` after reading it. Ledger entry (next free §), plan §19
"built as" notes, TODO line, memory top block. Reply in product-owner voice: what changed, what to
click, what is owed. The commit waits for the owner.
