# One Window — Stage 2c build prompt (the hand-built coach windows with no Tab trap or phone Back)

> Paste into a fresh session on `dev`. Written 2026-10-19 by the session that built 2b. **Precondition:** Stage 2a is
> committed `ada213b3`, Stage 2b `74d57373` (walk A ✅ 20/20, QA ledger §346); hub version 20. No migration, no API.
> **Owner's working rule for this stage: build part by part, stop after each for the owner's OK and a local commit; never
> push unless the owner says so.** This prompt is 2c only. 2d and 2e get their own prompts (or follow the 2b prompt's
> sections, `ONE_WINDOW_STAGE2B_BUILD_PROMPT.md`, re-verified).

## Read first, in this order
1. `docs/projects/active/ONE_WINDOW_PLAN.md`: the status header, §3 (Q1–Q16, the Q7 / Q14 amendments), §4 "Stage 2 · One
   behaviour", **"Stage 2 gate"** (A–D, B1–B9, the census, the corrections), **"Stage 2a — as built"** and **"Stage 2b —
   as built"**.
2. The hub, https://claude.ai/artifact/RDo1NhB9QmoMMKWCiADp48 (source `docs/projects/active/ONE_WINDOW_HUB.html`):
   Proposal › "Stage 2 · windows" › the **"Hand-built, no keyboard handling today · 20 windows + 3 read · part 2c"**
   table is THE list, with each window's shape and call. **Read the live copy with the Artifact tool, every line, before
   you republish** (memory `reference_artifact_publish_needs_full_read`), parse its two `<script>` blocks before every
   publish (`reference_hub_script_parse_trap`), and publish to the same file path.
3. `memory/design_decisions.md`, entry "2026-10-19 — ONE WINDOW STAGE 2".
4. `ONE_WINDOW_STAGE2_BUILD_PROMPT.md` (its guards, verify and hand-off sections still apply) and the 2b prompt's
   "Carried from 2a's /review".
5. `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading goes to a helper; a helper's claim is a lead — open the
   lines before you build on it or tell the owner).

## What exists now (verify in the code before relying on it)
- **`KitDialog`** (`components/admin/kit/club/KitDialog.tsx`) is both portals' window: `kind` question | form, `size`
  (520 default / `medium` 640 / `wide` 800), `dirty` + `discardAsk` (the in-foot ask: "Close without saving? What you
  typed won't be kept." · Keep writing (outlined, takes focus) · **Discard (red-tinted `btn btn-danger`, owner 2026-10-19)**),
  `footer` (buttons only) / `footerStart` (a sentence or a door), the reason slot (`DialogReason`, `inPlace`, `icon`),
  `back`, `raised`, `openOn="panel"`, `ownType`, `onFootHeight`. One closer (`requestClose`) for ×, ←, `DialogCancel`,
  Escape and the phone's Back; a tap outside a FORM does nothing, outside a QUESTION it is the "no". A window nested in
  another's body owns its keys (Escape) and its reason (the body's capture ignores a nested window's events).
- **`QuestionShell`** (`components/coaches/QuestionShell.tsx`) wraps it for the coach portal: kind "form" only today,
  `wide` → 640, `onBack`, `raised`, `dirty`, `leaveGuard` (route guard), `footer` / `footerStart`, re-exports
  `QuestionCancel` and `QuestionReason`, and keeps the stack of open coach windows that publishes `--coach-window-foot`
  for the phone save pill. **A new coach window goes through QuestionShell.**
- **The guard** `tests/unit/one-window-stage2-guard.test.ts`: its **ALLOWED** list names every coach file still building
  a `.modalOverlay` window, each with its reason (`MOVES_2C`, `MOVES_2D`, `STAYS`). 2c shrinks it. ⚠ The five tryout
  windows (`components/rep-teams/TryoutCheckIn.tsx`, `TryoutDayCard.tsx`, `TryoutEvaluatorsCard.tsx`,
  `TryoutRubricCard.tsx` — own `.scrim` + module CSS) are NOT in that scan (it keys on `.modalOverlay`); teach the guard
  the tryouts' `.scrim` windows too, or they can drift back unnoticed.
- **Tooling** in `.probe/` (gitignored): `.probe/ow2/measure.mjs` (+ `core.mjs`, `openers.mjs` — extend the openers for
  each 2c window), `shot.mjs <id> <width> [--asking]`, `nested.mjs`, `focusclear.mjs`; `.probe/ow2s/commit-2b.cjs`
  (temporary-index partial commit — reuse it). A probe that lands on the login page: refresh the sessions with
  `npx playwright test --config playwright.config.ts --project=auth-setup`.

## 2c · the windows (most dangerous first — the hub's table and the plan's census are the authority)
1. **Add players (paste a list)** `RosterBulkAddSheet`, **Give or edit an award** `GiveAwardModal`, **Start next season**
   `StartNextSeasonModal` — a stray tap drops typed work today: forms that ask (B3).
2. **Close the season** `CloseSeasonModal` and **Delete a budget line?** (in `accounting/budget/panel.tsx`) — the small
   centred **question** (answer D, Q12). QuestionShell is kind "form" today: add a `kind` passthrough or a coach question
   wrapper on KitDialog kind "question" that keeps the coach rules (the guard's message says so). A question: no ×, a
   tap outside or Escape is the safe answer, centred card on a phone. Keep each one's words.
3. **Export** `CoachExportButton`, **Choose an icon** `AwardIconPicker` (also opens in the club admin's shared library —
   one move serves both), **Upload a document** `PlayerDocumentsSection` (asks with a file chosen, B3) — forms that fill a
   phone (B5).
4. **Add a player** (`roster/page.tsx`; keep its route guard), **Add or edit a budget line** (`budget/panel.tsx`; 720
   today → onto the 520 / 640 / 800 ladder — a width call on the hub if not obvious), **Bring in a schedule**
   `ScheduleImportSheet`, **Import a spreadsheet** `BudgetImportSheet` / `MoneyImportMenu`, **Your starting budget**
   `BudgetStarterSheet` — forms that already ask through `useDiscardGuard`'s second window: move them to `dirty` (B1, the
   one sentence).
5. **Apply a lineup template to…** (`lineups/_LineupTemplatesView.tsx`) and **Add from a past season** `PastSeasonImport`
   — list pickers: forms that fill a phone (B9).
6. **The five tryout windows**: add or edit a session (460 today → the ladder), add an evaluator, add a walk-up player,
   the scorecard — forms that ask; **Which session is this sheet for?** (`TryoutCheckIn.tsx` ~688) — a question (B9).
7. **B6 read and manage windows:** **Categories & items** `BudgetItemManagerModal` (asks only while a name is being
   typed, B9), **Sample season budget** `SampleBudgetSheet`, **Recent imports** (`MoneyImportMenu`).
- **B3:** the eight hand-built windows that never asked, ask (2c holds four of them: Add players, Give an award, Start
  next season, Upload a document). **B5:** the non-question small cards fill a phone. Width per window onto the ladder.
- **No window's words change** except the ask's one sentence (B1). Grep for the old second-window words ("Discard
  this …", "Keep editing") as each window leaves `useDiscardGuard`; the guard's comment counts its callers.
- `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts` (~687, 754, 815) finds the hand-built money windows by
  `.modalOverlay` and the old "Discard this … / Keep editing" words: update it as they move (Delete a budget line, the
  budget line, the imports).
- Guards keyed on `.modalOverlay` beyond the stage-2 guard (plan correction 6): `coach-award-edit`,
  `coach-schedule-phone-guard`, `coach-schedule-sheet-guard`, `one-window-stage1-guard`. Restate each to the new shape;
  never loosen.

## Lessons from 2b (do not relearn them)
- **Measure before and after every window, at 390 and 1280** (extend `openers.mjs`). The after-figures caught what no
  guard did: KitDialog's `.foot button` (a class + an element) silently outranks a single-class button's `min-height` (the
  observation sheet's 56px Save had been 44 since 2a). A coach rule meant to win inside the window's foot needs the weight.
- **A `:has()` rule's weight is its heaviest argument.** `body:has([data-a][data-b]) .x` (2) LOSES to
  `body:has(.modalOverlay:not(.a):not(.b)) .x` (3) when both match — a coach window over a room. As `.modalOverlay`
  windows leave in 2c, re-read the §227 save-pill rules in `coaches.module.css`; when only Q15's stays-out list builds
  `.modalOverlay`, the old pill rules and the 200 layer can retire (2d's job — say what goes, leave no dead rules).
- **Equalising heights by stretch also stretches to a wrapped sibling** (a two-line refusal beside a door). Use a
  min-height floor.
- **A window nested in another's body** needs its own keys and its own reason — both handled in KitDialog now; check
  any 2c window that opens over another (Choose an icon over Give an award; Upload over the player record).
- **Form ids:** a submit in `footer` names its form (`form="…"` + `<form id>`), unique across anything mounted together.
  Enter still submits. The stage-2 guard checks every shell submit.
- **The ask must be noticed** (owner, 2026-10-19): Discard is red-tinted; do not reintroduce two quiet outlines.
- **`check:layout`** on the touched screens only (`--only=` ids, `--workers=1` if another session is on the dev server;
  a memory-floor abort is a re-run with fewer pages, not a pass). The whole-product sweep is staging's.

## Carried, still open (decide where each belongs; do not lose them)
- A window with a level (`back`) does not ask on ← or Back when dirty — make `back` ask too if a 2c window gets both.
- One counted page-lock module for the admin's BottomSheet / HelpDrawer / PlanArticlePanel beside KitDialog's own count.
- From 2b's /review, low: the root is written twice on open (0, then the height); a nested pair mounting in one commit
  would push child-first; a reason re-announces if a foot remounts; Enter in a one-field form while it asks still submits.
- From 2b's /simplify, not done: a shell-made form id (useId through context); a `remove` prop for the sheets' Remove; an
  opt-in for the phone `.footEnd` grow.
- **/docs:** two coach help articles say "Keep editing" (`lib/help-content/coaches.tsx`, Money's forms and the discard
  question). Offer /docs once 2c / 2d have moved the last `useDiscardGuard` windows, so the guides change once.
- InstallmentScopeSheet counts a scope radio as "typed"; Message a family shows its old send error after Keep writing.

## Verify, records, walk, commit
- Focused unit tests + the full `npm test` (two failures are NOT this stage's: `coach-semantic-ink` on `.occGroupPermit`,
  committed 2026-10-11, and `club-stage6c-screens-guard`'s admin-rail scrollbar test — re-check they are still the only
  ones), `npx tsc --noEmit`, focused lint, the `verify:changed` checks after the unit suite.
- `/simplify` then `/review` (scope them to your files: the working copy holds other sessions' edits), then records: the
  plan's "Stage 2c — as built" (before/after table, calls, skips with reasons), the hub (census strip with anchored facts,
  a QA tab walk), the TODO line (one line, no paths), the QA ledger's next free § (re-check: §346 was the last), auto-memory
  `project_one_window.md` + its `MEMORY.md` line. `memory/design_decisions.md` only for a new owner ruling.
- **Walk B (2c's windows):** one purpose — each moved window opens, Tab stays inside, Esc and the phone's Back close only
  the top window, a tap outside a form does nothing (outside a question: the safe answer), typed work asks in the foot,
  the two questions are small centred cards on a phone. Steps name a window on a screen; confirm each path exists on the
  test accounts first (the Premium coach `uat-coach@uat-test-org.local`; tryouts need a team with a tryout).
- Shared modules change: restart the dev server (stop, then `npm run dev`) before handing over a walk, after checking no
  other session is mid-probe on it.
- **Commit** only on the owner's OK: on `dev`, explicit paths, your lines only in shared files (TODO, the ledger, the
  coach stylesheet — check each file's hunks against your own before committing it whole), the temporary-index pattern of
  `.probe/ow2s/commit-2b.cjs`, `git show --stat HEAD` after. One commit for 2c whose message says what changes on screen.
