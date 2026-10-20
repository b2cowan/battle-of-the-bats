# One Window — Stage 2c, parts 3–7 and the close-out (build prompt)

> Paste into a fresh session on `dev`. Written 2026-10-19 by the session that built 2c parts 1 and 2; brought up to
> date by the session that built parts 3–6. **DONE 2026-10-20: part 7 committed `83278609`; the close-out records written (plan "Stage 2c — as built", walk B `ONE_WINDOW_STAGE2C_WALK.html`, ledger §349). Next is 2d (its own prompt).** **This prompt
> continues `ONE_WINDOW_STAGE2C_BUILD_PROMPT.md` — read that one first, whole: its window list, "What exists now",
> "Lessons from 2b", "Carried, still open" and "Verify, records, walk, commit" all still apply.** This file adds what
> parts 1–6 built, what they learned, and the order for the rest.
> **Owner's working rule (unchanged): build part by part, stop after each for the owner's OK and a local commit; never
> push unless the owner says so.** Write to the owner as a product owner (what the coach sees), not in file names.

## Done (verify with `git log` before relying on it)
- **Part 1 — committed `cb83e3b6` 2026-10-19.** Add players (`RosterBulkAddSheet`), Give / Edit an award
  (`GiveAwardModal`), Start next season (`StartNextSeasonModal`) moved onto `QuestionShell`: B3 (they ask when
  `dirty`), B5 (Start next season fills a phone). **Choose an icon (`AwardIconPicker`) was pulled forward from part 3**:
  it opens over Give an award (`picker.overlays`, a sibling AFTER the window), and a `.modalOverlay` window (z 200 on a
  computer) would have opened UNDER the one window (400). Rule for the rest: **a window that opens over a moved window
  moves with it.** Start next season's success view: every way out is `onDone` (`onClose={summary ? onDone : onClose}`).
- **Part 2 — committed `b5758dba` 2026-10-19.** `QuestionShell` takes `kind="question"` (KitDialog's small centred
  question with the coach rules; a question gets no `back`, no `dirty`, no `size`, and stays off the page pill's foot
  stack). Close the season (`CloseSeasonModal`) and Delete a budget line (in `accounting/budget/panel.tsx`) use it. Close
  the season's "Not yet — take me to Money" is now a `<Link onClick={onClose}>`: a button that closed and then
  `router.push`ed had the window's Back step cancel the push (`useBackStep`'s header — a LINK click is recognised as
  leaving, a `router.push` is not). **Any 2c window with a button that closes and navigates: make it a link.**
- **Part 3 — committed `f2ae1d35` 2026-10-19.** Export (`CoachExportButton`, no foot, `busy` holds it, 360 → 520,
  the module's `.dialog` narrowing deleted) and Upload a document (`PlayerDocumentsSection`, `dirty={uploadFile != null}`,
  `closeUpload` resets, the file field unmounts with the window). Probe: openers `export-roster`, `export-budget`,
  `upload-document` (the Family tab, `?tab=family`); `behave-2c3.mjs` 27/27 incl. the Schedule's desk Subscribe hand-off
  (Export → the old Subscribe window, which stays open). Figures `.probe/ow2/{before,after}-2c3.*`. The file input stays
  40px on a phone (Q10's rule skips `type="file"`; reported). Owner open call 1 (the For dropdown) asked again at this
  stop — owner: **fix it**, folded into part 4.
- **Part 4 — committed `0a721d9a` 2026-10-19** (+ the For dropdown: `.windowBody .convWhatField` 36 / 44 floors). Add a
  player (`closeAdd`, its route guard kept, a refused add → `QuestionReason`), the budget line (`wide` 640, footerStart =
  Delete line + period total, footer = fix counter · Cancel · main act; `open={modalOpen && tabActive}`; BOTH
  `useDiscardGuard`s and the panel's `useOverlayOpen` gone — a month-grid link over a dirty form is DROPPED via
  `lineDirtyNow`), Bring in a schedule (dirty now includes an unreviewed paste), Import a spreadsheet, Your starting
  budget (its per-step footer hoisted into a `footer` variable — the foot-text guard reads a ternary's text as a
  sentence). **QuestionShell gained `widest` (800)** for the two imports. **KitDialog: a coach window's `.footEnd`
  buttons floor at 34 on a computer** (a lone Cancel was 26.5). `MoneyImportMenu`'s only window is Recent imports —
  left for part 7. Probe: openers `add-player`, `budget-line-add`, `budget-line-edit`, `schedule-import`,
  `budget-import` (computer only), `budget-starter` (NotReachable: empty budget only); `behave-2c4.mjs` 57/59 (two
  probe artefacts: Tab opens the category list, Esc closes the list first). The money smoke spec restated, not run.
  Commit helper `.probe/ow2s/commit-2c4.cjs` (temp index + `git commit`, so hooks run).
- **Part 5 — committed `24f76335` 2026-10-19.** Add from a past season (`PastSeasonImportDialog`, one piece for drills,
  plan templates, circuits: `busy` while an add is in flight, Done = `QuestionCancel`) and Apply a lineup template
  (`_LineupTemplatesView`, no foot, `busy={!!applyBusyGameId}`, `useOverlayOpen` gone). Neither asks. New coach rule
  `.windowBody > .ppDrillWrite { padding: 0 }` (the practice page's 2d windows use the same column). The `useConfirm`
  window (FeedbackModal, z 1000) stands over the one window and owns Tab, Escape and Back — measured. Probe openers
  `past-season-drills`, `lineup-apply`; `behave-2c5.mjs` 30/30 (wait for the confirm: it arrives after the game's
  lineup loads). Figures `.probe/ow2/{before,after}-2c5.*`. Commit helper `.probe/ow2s/commit-2c5.cjs`. Full `npm test`:
  a third failure, `account-first-signup` "the step line…", is another session's in-flight sign-up work, not 2c's.
- **Part 6 — committed `502d287e` 2026-10-19.** The five tryout windows on `QuestionShell`: Add /
  Edit session (`TryoutDayCard`, `dirty={formDirty}`, 460 → 520), Add an evaluator (`TryoutEvaluatorsCard`, asks only
  for a typed name; the minted-link screen closes silently, Done = `QuestionCancel`), the scorecard (`TryoutRubricCard`,
  `widest` 840 → 800, the running total hoisted to `footSummary` = `footerStart`; `awaitingConfirm` now guards only the
  reset-to-equal confirm), the walk-up Add player (`TryoutCheckIn`, a refused add → `QuestionReason`, no longer the
  page's error pop-up), Which session (`kind="question"`). All four forms' `useDiscardGuard` gone (B1). The tryout
  stylesheets lost their window shape (`.scrim` · `.modal` · `.modalTitle` · `.modalActions` + warm twins, tombstoned);
  the guard's new test fails if a tryout `.scrim` window or those rules come back. ⚠ `TryoutRubricCard.tsx` is CRLF in
  this checkout but LF in git (autocrlf) — edit as LF. Fixture: the UAT tryout had no sessions or candidates;
  `.probe/ow2/tryout-fixture.mjs add|del` (two sessions) and `tryout-candidate.mjs add|del` (one walk-up) make them for
  a run and remove them (removed after this run). Probe: openers `tryout-session`, `tryout-session-edit`,
  `tryout-scorecard`, `tryout-evaluator`, `tryout-walkup`, `tryout-which-session`; `behave-2c6.mjs` 81/85 (the 4: Tab
  ends in the venue search with its list open, and the first Esc closes the list). Figures `before-2c6` / `before-2c6b`
  / `after-2c6`. Open: tryout fields stay 38–41 on a computer (their own module's `.input`; the coach 36 rule keys on
  the coach module's class); the scorecard keeps 24 under-44 body controls on a phone (grips, steppers, the 1–5/1–10
  switch).
- Guard `tests/unit/one-window-stage2-guard.test.ts` has a "2c" describe (B3 asks, Choose an icon's layer, answer D's
  question shape); ALLOWED has shrunk by five. Keep adding to that describe, never loosen.
- Before/after figures for parts 1–2: `.probe/ow2/{before,after}-2c1.*` and `-2c2.*` (gitignored).

## The build order (the 2c prompt's list, minus what moved) — 3–6 DONE (see above), 7 and the close-out are next
3. ✅ **Export** `CoachExportButton` (B5) and **Upload a document** `PlayerDocumentsSection` (B3 — asks with a file
   chosen; B5). Upload opens over the player record: check it stands on top and owns its keys (KitDialog handles a
   nested window's Escape and reason; confirm by measuring, not by reading).
4. ✅ **Add a player** (`roster/page.tsx`, keep its route guard), **Add or edit a budget line** (`budget/panel.tsx`, 720
   today → onto 520 / 640 / 800; its form has side-by-side fields and a period table — likely 800 `wide` or 640, put it
   to the owner if not obvious), **Bring in a schedule** `ScheduleImportSheet`, **Import a spreadsheet**
   `BudgetImportSheet` / `MoneyImportMenu`, **Your starting budget** `BudgetStarterSheet` — they ask today through
   `useDiscardGuard`'s second window: move them to `dirty` (B1, one sentence). Grep the old words ("Discard this …",
   "Keep editing") as each one leaves; update `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts` (~754, ~815 — the
   budget line and imports found by `.modalOverlay` and the old words; ~687 is Record money, which is 2d's).
   ⚠ The budget line form is the one Delete a budget line opens over: after it moves, re-check the question still
   stands on top (410 over 400 — it should).
5. ✅ **Apply a lineup template to…** (`lineups/_LineupTemplatesView.tsx`) and **Add from a past season**
   `PastSeasonImport` — list pickers, forms that fill a phone (B9).
6. ✅ **The five tryout windows** (`components/rep-teams/TryoutCheckIn.tsx`, `TryoutDayCard.tsx`,
   `TryoutEvaluatorsCard.tsx`, `TryoutRubricCard.tsx` — own `.scrim` + module CSS): forms that ask; the session window
   460 → the ladder; **Which session is this sheet for?** (`TryoutCheckIn.tsx` ~688) is a question (`kind="question"`,
   B9). **Teach the stage-2 guard the tryouts' `.scrim` windows** (its ALLOWED scan keys on `.modalOverlay` only).
7. ✅ **Committed `83278609` 2026-10-20 — B6 read and manage windows:** Categories & items `BudgetItemManagerModal` (asks only while a name is being typed,
   B9), Sample season budget `SampleBudgetSheet`, Recent imports (`MoneyImportMenu`). All three are on the guard's
   ALLOWED list as MOVES_2C: take each off as it moves (the list only shrinks), and add a part-7 test to the "2c"
   describe. Check each one's reachability on the UAT team first (Sample season budget may want an empty budget, like
   Your starting budget; Recent imports needs a past import) — a dev-only fixture made and removed by a probe script is
   fine (part 6's `tryout-fixture.mjs` / `tryout-candidate.mjs` are the pattern); otherwise report as checked in code.
- **Close-out after part 7:** `/simplify` then `/review` scoped to 2c's files (the working copy holds other sessions'
  edits); the plan's "Stage 2c — as built" (before/after table, calls, skips with reasons — parts 1 and 2 included);
  the hub (census strip, a QA tab walk B; read the live copy every line first, parse both `<script>` blocks, publish to
  the same file path); the TODO line; the QA ledger's next free § (§346 was the last at the 2c prompt — re-check);
  auto-memory `project_one_window.md` + its `MEMORY.md` line; offer `/docs` (two coach help articles say "Keep
  editing" — `lib/help-content/coaches.tsx`, Money's forms and the discard question) once the last `useDiscardGuard`
  window in 2c has moved, or hold it for 2d if 2d still has callers (say which).
  The as-built record must also carry parts 5–6's facts: B9's list pickers never ask (each tap writes); the confirm
  window (`useConfirm`, z 1000) stands over the one window and owns Tab / Escape / Back (measured in parts 5 and 6); the
  walk-up's refusal moved from the page's error pop-up to the foot; the tryout stylesheets' window shape is tombstoned.
  **Walk B** must name the tryout windows' paths, and the walk needs the owner's test tryout to have two sessions and a
  candidate (the UAT fixture has neither — say so in the walk's setup line, or have the walk create them).

## Learned in parts 1–2 (do not relearn)
- **Probe tooling** (`.probe/ow2/`): openers for `add-players`, `give-award`, `choose-icon`, `start-next-season`,
  `delete-budget-line` exist. **The old hand-built windows carry NO `role="dialog"`**, so `measureWindow` cannot see
  them: call `tagOldModal(p)` (in `openers.mjs`) at the end of an opener; it marks the newest visible `.modal`. New
  helpers: `topat.mjs` (what is on top at a point — use it when a screenshot looks undimmed), `demo-sns.mjs`.
- **Before-figures:** save your edited file to the scratchpad, `git show HEAD:<file> > <file>`, measure, copy yours
  back, check `git diff --stat`. Only for files no other session has modified (check `git status` first).
- **Unreachable on every local account:** Start next season and Close the season (head coach of a STANDALONE team
  only; the UAT team and the coach demo `riverdale-ridge` are both club-managed; the free coach is a different portal).
  Report them as checked in code and guards only; the walk needs the owner's own standalone team. Check the tryout
  windows are reachable (the UAT team must have a tryout) BEFORE building their walk steps.
- **Budget rows on a phone:** the row's edit button is covered by the amount cell — open it with focus + Enter.
- **The roster's Add players** is "Import" on a computer, "Add player" → "Adding several? Paste a list" on a phone.
- **Shell traps:** a heredoc or `node -e` string EATS backslashes in a regex (`/\+ New/` became `/+ New/`) — write
  regex-bearing edits with the Edit tool. Many files here are **CRLF** (`git show HEAD:<f> | grep -c $'\r'`): lines a
  script inserts come out LF — normalise to the file's own endings before committing. Re-indenting a moved body is
  fine but swells the diff; say so in the hand-off.
- **Commit:** other sessions leave files STAGED. `git commit --only -F - -- <your paths>` commits only yours and leaves
  theirs staged; `git show --stat HEAD` after. A shared file with other sessions' hunks still needs the temporary-index
  pattern (`.probe/ow2s/commit-2b.cjs`).
- **Known failures, not 2c's:** `npm test` fails 2 (`coach-semantic-ink` `.occGroupPermit`; `club-stage6c-screens-guard`'s
  admin-rail scrollbar). `verify:changed` stops at them — run its later checks yourself; `check-schema-parity` fails
  on mig 338 (dev only, Club 5c's, due at the promote) and `check-css-selectors` on `GuidanceRail.module.css` — neither
  is 2c's. `check:layout` has no screen that opens these windows; the probe's before/after + screenshots stand in.
- **Parts 5–6 learned:** `TryoutRubricCard.tsx` is CRLF in this checkout and LF in git (core.autocrlf) — read the
  working copy's endings, not `git show`'s, before a scripted edit, and write it back LF. The `useConfirm` window over a
  moved window needs no change (it is z 1000 and a step of its own). A confirm that appears after a fetch needs the probe
  to WAIT for it (`.modal-overlay:visible`), not a fixed sleep. A probe "Esc doesn't close" miss is usually an open list
  inside the window (the venue search, a category select) — check before calling it a bug. `shot.mjs` scrolls the body
  to the end on purpose; a window does open at the top. The coach's error ink for a foot reason is `coach.errorText`
  (the tryout files import the coach stylesheet for it). An expired test sign-in shows as an "Unauthorized" pop-up in
  screenshots: re-run `--project=auth-setup`.
- **Known failures (re-checked after part 6):** only the two above; part 5's third (`account-first-signup`) was another
  session's in-flight work and has cleared.
- **Remaining under-44 controls are body controls** (chips, segmented switches, text links) — report them, don't fix
  them in this stage, as 2a/2b did.

## Open owner calls (ask once, at a natural stop; do not block on them)
1. **The For dropdown in Give an award is 35px on a phone** (the shared `SublinedChoice` trigger; Q10 says a field in a
   window is 44). Fix it inside coach windows during 2c, or leave it for later?
2. **An extra Back press after Start next season** navigates the page (its window's Back step is still in history when
   the page reloads). Low; recorded, not fixed.
3. **Tryout fields are 38–41px on a computer** (their own module's `.input`; the coach window's 36 rule keys on the
   coach module's class). Asked at the part-6 stop; the owner committed without answering — ask once more at the part-7
   stop, never block on it. Q10 says a field in a window is 36 on a computer.
4. **The scorecard keeps 24 under-44 body controls on a phone** (grips, weight steppers, the 1–5 / 1–10 switch) —
   reported, not fixed (the standing rule above).
