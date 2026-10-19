# One Window — Stage 2b to 2e build prompt (the foot, the hand-built windows, the admin's forms)

> Paste into a fresh session on `dev`. Written 2026-10-19 by the session that built 2a. **Precondition:** Stage 2a is
> committed `ada213b3` (records `b2488f34`); the census calls B1–B9 and answers A–D are ruled (hub version 16). No
> migration, no API. **Commit locally after each part, only on the owner's OK; never push unless the owner says so.**
> Owner's working rule for this stage: build part by part (2b, then 2c, 2d, 2e), stop after each for the owner's OK
> and a local commit.

**Read first, in this order.** `docs/projects/active/ONE_WINDOW_PLAN.md`: status header, §3 (Q1–Q16 and the Q7 / Q14
amendments), §4 "Stage 2 · One behaviour", **"Stage 2 gate"** (A–D, B1–B9, the census, the corrections, the before
figures) and **"Stage 2a — as built"** (what exists, the /simplify and /review results, what was left). The hub,
https://claude.ai/artifact/RDo1NhB9QmoMMKWCiADp48 (source `docs/projects/active/ONE_WINDOW_HUB.html`): Proposal ›
"Stage 2 · windows" is THE census — every window, its part and its call. **Read the live copy with the Artifact tool,
every line, before you republish** (memory `reference_artifact_publish_needs_full_read`; publish to the same file
path). `memory/design_decisions.md`, entry "2026-10-19 — ONE WINDOW STAGE 2". The original stage prompt,
`ONE_WINDOW_STAGE2_BUILD_PROMPT.md` (its guards, verify and hand-off sections still apply). Then `AGENTS.md`,
`AGENCY_RULES.md`, `CLAUDE.md` (broad reading goes to a helper; a helper's claim is a lead — open the lines).

## What 2a built (verify in the code before relying on it)
- **`KitDialog`** (`components/admin/kit/club/KitDialog.tsx`) is both portals' window. Props added in 2a: `dirty`
  (the in-foot ask), `discardAsk`, `headerExtra`, `openOn="panel"`, `ownType`, an optional `back.label`. Exports
  `DialogCancel`. One closer `requestClose` for ×, ←, DialogCancel and the floor's Escape / Back; the ask stands down
  when `busy` or `!dirty`. Words: `lib/window-words.ts` (`WINDOW_ASK`). Panel attributes `data-kind`,
  `data-coach-window`, `data-asking`. Inside the coaches portal the provider is the one page lock.
- **`QuestionShell`** (`components/coaches/QuestionShell.tsx`) wraps it for the coach portal (kind "form",
  `openOn="panel"`, `ownType`, the route guard with `leaveGuard.dirty` defaulting to `dirty`) and re-exports
  `DialogCancel` as `QuestionCancel`. Its content sits in `.windowBody` (`coaches.module.css`). **A new coach window
  goes through QuestionShell**, which carries the coach rules (the guard's message says so).
- **The 2a shim** (`coaches.module.css`, the `.windowBody .modalFooter` block, `[data-asking] .windowBody
  .modalFooter`, and the `scroll-margin-bottom` on `.windowBody` controls): a consumer's own `.modalFooter` laid out
  as the window's foot. **2b deletes all of it.**
- `useDialogFloor` now lets a window nested inside another own its keys (the event form's Add a place / Places).
- The guard `tests/unit/one-window-stage2-guard.test.ts` holds two shrinking lists: **SHIM** (shell windows still
  drawing a `.modalFooter` — 2b empties it) and **ALLOWED** (files still building a `.modalOverlay` window, each with
  its reason — 2c/2d shrink it; the Q15 stays-out entries remain).
- Tooling in `.probe/` (gitignored): `.probe/ow2/measure.mjs` (+ `core.mjs`, `openers.mjs`) measures every shell
  window at 390 and 1280 (`--out=`, `--only=`, `--widths=`); `shot.mjs` screenshots one window (`--asking` types and
  presses Escape); `nested.mjs` and `focusclear.mjs` (the review's two checks); `.probe/ow2s/mutate.cjs` (mutation
  check of the guard — extend it); `.probe/ow2s/commit-2a.cjs` (temporary-index partial commit — the pattern to reuse).
  If a probe lands on the login page, refresh the test sessions:
  `npx playwright test --config playwright.config.ts --project=auth-setup`.

## 2b · the 32 shell windows put their buttons in the window's foot (no invented words)
- QuestionShell gains `footer` and `footerStart` passthrough (KitDialog's own; buttons only in `footer`, any sentence
  in `footerStart` — `kit-dialog-foot-text-guard` holds every caller).
- Per window (the SHIM list): buttons into `footer` with `<form id>` + `form=` (the admin idiom,
  `InviteMemberDialog.tsx`); Cancel stays `QuestionCancel`; a sentence already sitting above the buttons moves to
  `footerStart`; a refused Save's reason goes to the reason slot (`KitReasonSlot`; the club's `FormError` in
  `components/admin/kit/club/money/MoneyKit.tsx` portals into it — reuse it or a coach twin on the same context, and
  mention it to /simplify). LineupCheck and LineupInningInspector have no foot.
- Drop the no-op `scroll` prop from QuestionShell and its 10 callers (and RecordObservationDialog's stale comment
  about "the shell's `scroll` variant"); update `modal-scroll-recipe-guard` and `bva-figure-doors-guard` to the new
  meaning, never loosen them.
- Delete the shim block; SHIM empties → the guard asserts no QuestionShell consumer renders a `.modalFooter`.
- The save pill's phone offset (`coaches.module.css`, the §227 rule) was measured on the old 1rem foot; the one
  window's foot is 0.85rem a side and taller while it asks. Re-measure; consider KitDialog publishing its foot height.
- **Walk A after 2b** — "the coach forms behave like the admin's" (the original prompt's Walk A, plus: the event form ›
  Add a place › Escape asks only there; New payee, Change a payment, Start a session ask (B2); a coach's Keep writing
  / Discard in the body face). Next free QA ledger § — re-check `docs/projects/active/OWNER_QA_LEDGER.md` (§343 was the
  last at writing). Checkable walk on the hub's QA tab (paste-back; parse the scripts before publishing).

## 2c · hand-built windows with no Tab trap or phone Back (most dangerous first)
- The census's 2c table on the hub: Add players (paste), Give an award, Start next season first; then Close the
  season and Delete a budget line (**questions** — QuestionShell is kind "form" today: add a `kind` passthrough or a
  coach question wrapper, with the coach rules, Q12 small centred card), Export, Choose an icon, Upload a document,
  Add a player (keep its route guard), the budget line (720 today → the ladder), Bring in a schedule, Import a
  spreadsheet, Your starting budget, Apply a lineup template (a form, B9), Add from a past season, the five tryout
  windows (own `.scrim` + module CSS; Which session is a question, B9), and B6's Categories and items (asks while a
  name is typed, B9), Sample season budget, Recent imports.
- **B3:** the eight hand-built windows that never asked, ask. **B5:** all seven non-question small cards fill a phone.
  Each window's width onto the ladder (520 / 640 / 800): a width call per window on the hub where it is not obvious.
- `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts` (~687, 754, 815) finds hand-built money windows by
  `.modalOverlay` and the old "Discard this … / Keep editing" words: update it as they move.
- Measure before and after each window (extend `openers.mjs`); check:layout on the touched screens (390, 1440).

## 2d · hand-built windows that already have the floor
- The 2d table: Set dues for all players, Record money / Add a bill (**portaled into the warm marker — keep the
  portal**; plan finding 7), New club request, Tell the club you've sent (B3), Set refund (a question, B9), Send due
  reminders?, the drill sheet (**B4: a form that asks**), Reminder preview, Subscribe in your calendar (computer),
  the month grid's two figure windows (B5), **Season settlement moves as an 800 form (B9)**, and the practice page
  last, one window at a time (its sheet-pair CSS is keyed on `.modalOverlay`, `coach-practice-plans-phone-guard`
  :544): Save to my drills / Save as template / Send to staff (B3), Start this plan from… / Groups from another
  practice (forms, B9), Add a block or station, Choose players.
- Stays out (B7): the event slide-over, a day's list, a player's dues drawer (offer the small `drawerFormDirty` fix),
  a staff member, the practice station / block / Groups sheets, the depth chart player, lineup setup on a computer.
- When the last hand-built coach window moves, `.modalOverlay` is only the Q15 stays-out list: the layer split (200 on
  a computer) and the old pill rules can retire with it — say what goes, do not leave dead rules.

## 2e · the admin's forms ask (answer A)
- About 84 club and tournament forms: per form, what counts as typed, `dirty` passed, nothing else changes. New
  tournament's own second-window ask ("Leave setup?" · Keep working · Leave, `lib/tournament-setup-words.ts`) moves to
  the foot (Keep writing, the one word). Walk C after it.

## Carried from 2a's /review (decide where each belongs; do not lose them)
- A window with a level (`back`) does not ask on ← or Back when dirty (no window has both today) — make `back` ask too
  if any 2c/2d window gets both.
- In the admin, BottomSheet / HelpDrawer / PlanArticlePanel each save and restore `body.style.overflow` beside
  KitDialog's own count (true before 2a) — a candidate for one counted lock module shared with the coach provider.
- The page pill can sit over the ask's Discard on a phone while a Retry shows.
- InstallmentScopeSheet counts a scope radio as "typed"; Message a family shows its old send error again after Keep
  writing. Low; fix if you touch them.

## Rules that still hold
Q1–Q16, A–D, B1–B9 as ruled; the S1–S5 widths; "one flow keeps one width". Not this stage: the question window and
notices (Stage 3, which retires `useDiscardGuard`'s "Keep editing" and `FeedbackModal`), House league and the
tournament's old windows (Stage 4). Shared working copy: other sessions edit the same files (Club Tier 5c in the
families and money screens, the coach stylesheet) — `git diff --stat <file>` before editing; small unique hunks; commit
your lines only (memory `reference_partial_commit_shared_tree`; `.probe/ow2s/commit-2a.cjs` is the working pattern:
temporary index from HEAD X, `commit-tree` + compare-and-swap `update-ref`, then `git reset <new> -- <your paths>` in
the main index). Shared modules change: restart the dev server (stop, then `npm run dev`) before handing the owner a
walk, after checking no other session is mid-sweep on it. After each part: /simplify, /review, records (plan "as
built", hub strip with anchored facts, TODO line, QA ledger at walk time, auto-memory `project_one_window.md`).
