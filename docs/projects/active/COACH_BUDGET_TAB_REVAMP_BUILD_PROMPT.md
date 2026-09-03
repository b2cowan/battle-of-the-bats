# Build prompt — Coach Budget Tab Revamp

You are building an approved, owner-ruled project. Read these IN ORDER before any code:

1. **THE MOCKUP GATE IS ITEM ONE.** Open and match the owner-approved whole-screen before/after
   mockups: https://claude.ai/code/artifact/f1bd6e4d-631e-4a82-a10f-a46646b5fb4c
   Both lists and both grids there render from one 32-line dataset. The AFTER states are the spec
   for P1 (one-grain By-period), P3 (density + Schedule column + collapse-all), P4 (View/Columns
   pills), and P2's editor fragments (names-mode optional dates + the rescale banner). If the code
   forces a deviation, STOP and put it to the owner — do not improvise past the mockup.
2. `docs/projects/active/COACH_BUDGET_TAB_REVAMP_PLAN.md` — scope, rulings table (§0), build order
   (§9), verification (§10). All eight owner rulings are Approved as written there, plus the export
   rider: **the plan's exports group exactly like the screen and match Budget vs. Actual's month
   header format.** ⚠ Reuse what is genuinely shared — `formatMonthLabel` + the
   `headerMonth`→Excel-date mechanism — and write a NEW plan-specific row builder; BvA's
   `monthExportColumns`/`buildMonthExportRows` are local, lens-specific closures in its panel and
   are NOT liftable (plan §5 has the corrected detail). Never a second month-label formatter.
3. `docs/projects/active/COACH_BUDGET_TAB_REVAMP_PM_BRIEF.md` — the owner-voice framing for your
   completion summary.

## Ground rules that have bitten before

- Branch `dev` only; stage explicit pathspecs; bracket dirs (`[orgSlug]`, `[teamId]`) need pathspec
  care; `git show --stat HEAD` after each commit (shared worktree — other sessions are mid-flight in
  accounting/).
- Decide schema facts from live `information_schema`/snapshots, never migration files. Migration =
  dictionary + `refresh:snapshots` in the same unit of work. Next free migration number at build
  time (273 existed at planning time).
- `line_kind` consumers are guarded by `tests/unit/budget-line-kind-guard.test.ts` — extend it site
  by site for `other_income`; that test exists because this exact class of change mis-filed money
  three times before. ⚠ AND it exempts `lib/coach-budget-totals.ts` itself: `isFundingKind()` and
  `normalizeBudgetLineKind()` are hardcoded literal comparisons that must be edited BY NAME —
  the unrecognized-kind default is `'cost'`, so a missed edit silently counts the new income as
  spending (plan §6.1).
- The rollover carry's `line_kind` comment (never defaulted — the funding-read-as-cost incident)
  must survive the §6.3 helper extraction verbatim.
- The ledger CSS classes are shared with BvA — density changes are budget-scoped or BvA-verified;
  `money-hierarchy-type-scale.test.ts` must stay green (category > line, no small-caps).
- The UAT fixture must HOLD the failing states before you trust any gate: a 2-line item, a
  quarters split, a names-mode split. A green sweep over a fixture without them is blindness,
  not coverage.
- `check:layout` is blind inside folds; reseed first; `--only` in this shared worktree.
- New copy passes `check:spelling` (installment, two Ls; clock copy "8:00 a.m." via `formatTime()`).
- Help + demo sync are IN scope (plan §7): re-read the whole coach-money demo narration (three
  releases stale by standing note) and the Budget help article before calling any phase done.
- Present the PM UX summary in-conversation before code (AGENCY_RULES blocking step); offer
  `/review` after substantive chunks; QA walkthrough artifact at the end (checkable, UAT sign-in
  card: uat-coach@uat-test-org.local / UATPassword2026!); new Owner QA Ledger § appended, never
  sorted.

## Order

Phase A (P1 grain) → B (exports + PDF) → C (migration + P2 editor/guards) → D (P3+P4 visual) →
E (other_income, category rename [⚠ OWNER CHECKPOINT first — categories are deliberately
org-shared, a rename can relabel another team's screen; plan §6.2 carries the three options and the
recommendation], carry door) → F (P6 quiet fixes, paper truth-ups, help/demo sync, QA walk).
A+B may ship together; C before E.
