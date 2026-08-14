# Player Dues — "By installment" lens

**Status: ON PROD 2026-08-14 (Amplify job 256) · no migration · owner QA = ledger §17, still owed.**
Owner-approved mockup: artifact `d7162867` (two rounds — round 2 added the collapsible phone
cards and the "due next" headline at the owner's request). PM brief:
`DUES_BY_INSTALLMENT_PM_BRIEF.md`.

## What it is

A second, read-only lens on the Player Dues tab answering "how is installment 2 going?" and
"what does this family owe me right now?" — questions the totals table (whole-season figures
only) couldn't. Toggle on the dues toolbar: **Season totals** (existing table, untouched,
default) | **By installment**. The choice rides the URL as `?duesView=installments`
(`router.replace`, other params preserved). Toggle hidden until any schedule exists; a
bookmarked lens URL with no schedules falls back to totals.

## Pieces

1. **`lib/dues-installment-view.ts`** — the pure derivations, unit-tested
   (`tests/unit/dues-installment-view.test.ts`, 16 tests, coverage built through the REAL
   allocator, never hand-made):
   - `buildInstallmentColumns(players, today)` — joins on installment NUMBER (schedules are
     per-player editable, so columns are derived, never assumed). Header date = the date most
     players share (tie → earliest); `dueDateVaries` flags hand-edits; `behindCount` uses each
     player's OWN date. Integer-cents arithmetic throughout.
   - `dueNextForPlayer(installments, coverage, today)` — past-due remainders + the NEXT
     not-yet-due remainder (due **today counts as next**, matching `isInstallmentOverdue`'s
     strictly-before rule). **Credits deliberately excluded** — the figure must equal what
     reminder emails chase. Remainders come from `InstallmentCoverage.remaining` only (the
     dues-definition guard bans re-derivation).
   - `daysUntil` — calendar-day diff for the band's "due in N days" captions.
2. **`app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/InstallmentBreakdown.tsx`** —
   Collection schedule band (Budget plan-card language) + desktop player × installment grid +
   phone collapsible cards (native `<details>`). Declares its own structural `BreakdownPlayer`
   type (no value-cycle back into the panel). **`balanceColor` moved here and is exported** —
   the panel imports it, so the two lenses can never colour one balance differently.
3. **Panel wiring** (`dues/panel.tsx`) — toggle in `panelToolbar`'s left slot (`segChoice`),
   conditional render around the existing table (which is byte-for-byte unchanged), drawer
   opens from either lens.
4. **Styles** — `coaches.module.css`, `dues*` classes at the file's tail. **The band's type
   recipe is the Budget plan card's byte-for-byte** (cap/key/value/caption sizes, hairline
   separators, ≤900 stacking — reconciled 2026-08-14 after the owner's consistency check
   caught five near-miss values; the comment block on `.duesBandCap` records which remaining
   differences are decisions). The matrix is the shared LIST treatment
   (`.th/.td/.thNum/.tdNum` + `.tableFoot/.footValue` on the `--money-cat-*` tokens) — the
   same job as the totals table one toggle away, deliberately NOT `.moneyGrid*` (no
   category→line hierarchy; two lenses of one list must not read as two products). Phone
   (≤640): `.duesMatrixWrap` hides, `.duesCards` shows — the grid never sideways-scrolls on a
   phone (Money-hub table rule).

## Rulings honoured

- **Settled is quiet** (2026-08-13): $0 due-next / balance draws muted, never green.
- **Colour never alone** (deutan, budget-card pass): every amber/red state pairs icon + words.
- **No false alarm before the due date** (chase-card ruling 2026-08-03): a future installment
  nobody has paid is neutral, "paid early" is stated positively.
- **One definition of paid/remaining**: everything reads `InstallmentCoverage`; the guard tests
  passed untouched.

## Verification (2026-08-14)

Full unit suite 1,726 pass · `lint:focused` clean on the new files (2 pre-existing warnings in
panel.tsx untouched) · `npx next typegen` + `tsc --noEmit` clean · `verify:changed` exit 0
(schema-parity notes = the known dev-only migs 230–232 awaiting release).

## Round 2 (owner feedback on the first render, 2026-08-14)

1. **Heading recipe unified portal-wide.** The shared list-table heading (`.th`,
   0.72rem/`--white-35`) never got reconciled with the grid heading
   (`.moneyGrid thead th`, 0.78rem/`--white-60`) in the 08-13 table pass — the owner asked why
   headers read so much smaller than data rows. `.th` now carries the grid heading's
   size/spacing/ink. ⚠ This resizes the header row of EVERY coach-portal list table (desktop
   only — `.tableAsCards` hides headers ≤640). Disclosed in QA §17.
2. **Phone band bug:** `.duesTerm { flex: 1 1 170px }` — in the ≤900 stacked (column-direction)
   band the 170px basis became a min-HEIGHT per term. Reset to `flex: 0 0 auto` in the media
   block; the comment records the trap.
3. **Send Due Reminders confirms first** (modal states scope: past due + next 3 days,
   remainders only, one email per family, 7-day no-repeat), and **the manual send now includes
   past-due installments**: `getDueReminderCandidates` drops the lower date bound only when
   `window === undefined` (the automated 30/7 waves stay forward-looking — proximity notices,
   not dunning). Candidates carry `overdue`; the shared email template words past-due rows
   "was due {date}", switches its intro off "coming due", and the ad-hoc subject becomes
   "Player dues outstanding" when anything is late. The on-screen "See an example" copy and
   the no-op status line state the widened scope.

## Round 3 (owner feedback 2026-08-14)

1. **Headers spell out "Installment N"** (grid + phone card rows).
2. **Many installments = the CoachScrollX answer, no threshold logic.** The matrix swapped its
   `.tableWrap` for `<CoachScrollX sticky>` (the BvA month-grid pattern): ≤~5 columns nothing
   changes; beyond, sideways scroll + mandatory swipe hint + pinned Player column. ⚠ The
   primitive's table pin is UNGATED (always sticky/opaque — fine for BvA which always
   overflows); `.duesMatrixScroller:not(.scrollXOverflowing)` un-pins it here so a
   3-installment table never shows a white Player stripe, and the overflowing header/foot pins
   repaint the heading tint over the opaque ground (`background-image` longhand technique).
   The band wraps (`flex: 1 1 170px` terms) at any count.
3. **No lens toggle on phones.** `InstallmentBreakdown` gained `desktopActive`; when the
   desktop lens is Season totals the whole breakdown renders inside `.duesPhoneLens`
   (visible ≤640 only) and the totals table + toggle carry `.duesDesktopOnly` (hidden ≤640).
   Phones always get band + collapsible cards; desktop keeps both lenses.
4. **Toolbar secondaries icon-only on phones** via the existing `.headerBtnLabel` mechanism +
   aria-labels — including the shared `MoneyExportButton` trigger (all seven Money tabs).

## /review run (2026-08-14, high-risk tier, 4 lenses + rendered gate) — all confirmed findings FIXED

1. **[High, fixed]** Neither reminder modal registered with the overlay system — on a phone the
   bottom nav stayed visible/tappable and the page scrolled under the confirm dialog. One
   `useOverlayOpen(confirmRemindersOpen || reminderPreviewOpen)` registration added.
2. **[Medium, fixed]** `duesView` leaked onto every other Money tab's URL via `sectionHref`
   (it was missing from the hub's cross-tab param cleanup). Joined `ONE_SHOT_KEYS` — switching
   tabs now drops the lens; a bookmarked dues URL still opens it.
3. **[Gate, fixed]** The new toggle buttons were 29px tall against the 44px rendered-gate
   floor — `.duesViewSeg .segBtn` min-height added; re-run clean.
4. **[Low, fixed + test]** Two installments due the SAME day: due-next counted only the first.
   Now sums every remainder sharing the earliest upcoming date (suite 1,727).
5. **[Low, fixed]** Stale "~5 columns" comment → the scroller measures, it doesn't count.

**Refuted (1):** "stamped-but-unfunded installment renders unwarned" — unreachable: the paid
stamp is a bidirectional projection (`applyDuesPaidProjection` clears stamps when coverage
disappears), verified in code.

**Advisory, accepted:** matrix footer sums use the same float arithmetic as the totals footer
(consistent by construction); idle-tab "today" staleness across midnight (portal-wide known
class); confirm modal's Send has no pending state (modal closes synchronously — double-fire
unreachable); mixed overdue+upcoming email takes the "outstanding" subject (accurate); modal
copy doesn't state that past-due has no age ceiling (bounded to the active season).

**Out of scope, reported to their owners:** credit/payment form date pre-fill frozen at first
chunk load (module-scope `tournamentToday()` — payment-record project's file); the two
documents-screen tables still have no phone reflow/swipe hint (pre-existing, marginally
amplified by the wider `.th`); 4 rendered-gate tap-floor findings on overview/team-hub/
schedule/history screens (other sessions' uncommitted work).

## Open / follow-ups

- Owner QA = ledger §17 (walk written).
- Demos: default view unchanged so existing demo copy stays true; **a coach-demo moment could
  showcase the lens later** — flagged, not built.
- Help docs (`premium-money` section) mention dues but not the lens yet — offer `/docs` after
  owner QA.
- Export is unchanged (season-shape rows). A per-installment export sheet was deliberately NOT
  added — revisit only if asked.
