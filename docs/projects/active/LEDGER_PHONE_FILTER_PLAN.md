# Ledger Phone Filter — plan

**On production 2026-10-02** — Amplify job 275 (prod HEAD `5070661d`, tag `release/2026-10-02`); the release record holds the detail.

**Hub (mockup · decisions · brief):** https://claude.ai/artifact/9MkS5tTMA7RvytnUXCsVdx — source
`LEDGER_PHONE_FILTER_HUB.html`, frames in `ledger-phone-filter/` (captured on the live Ledgers by
`.probe/lf/shots.mjs`). PM brief: `LEDGER_PHONE_FILTER_PM_BRIEF.md`.

**Ruled 2026-10-02:** the owner accepted D1–D7 as recommended ("I agree with your recommendations, go ahead").

## Problem

On a phone the coach's Ledger shows its five filter pills (Type, Status, Item, Date, Tags) on two lines and Cash
on hand on a third, inside a toolbar that is sticky at every width. At 390px with Date on Whole season it pins 207px
of the screen (179px at rest) while the coach scrolls; the list gets 520px between it and the phone bar. The club's
Ledger has four pills that fit one line, but its Balance drops to a line of its own by a phone rule.

A single Filters button was drawn for this Ledger on 2026-09-02 (Option C, `LEDGER_TOOLBAR_ROW_MOCKUP.html`) and
declined at desktop size: it puts a tap between the coach and every filter and hides their state behind a count. On a
desktop that still holds. On a phone, three pinned lines cost more than the extra tap, and tournament Teams already
puts its filters behind one button (`decision_one_toolbar_rare_tools_behind_tools`, 2026-10-01).

## The decisions (all accepted)

| # | Ruling |
|---|---|
| D1 | At ≤640px the strip's narrowing pills go behind ONE Filter button; above 640 nothing changes on either Ledger. |
| D2 | The button opens a bottom sheet (the Tools sheet's form): one row per filter with what it is set to; tapping a row opens its choices in place, one at a time. |
| D3 | The button lights up and counts only filters away from their RESTING state (Status rests on Actual + Overdue; the date rests on Around today / This month). |
| D4 | A chosen date preset stays remembered per team, as today. |
| D5 | The club's Ledger gets the same, in the same change; its Balance joins the Filter line. |
| D6 | "Reset filters" closes the sheet's list, only while something is on; it puts every filter back to REST, not to "All". |
| D7 | No Done button: the list updates behind the sheet; the sheet closes by tapping outside it, like Tools. |

## Design

- **`components/coaches/FilterGroup.tsx`** (new, shared) wraps a strip's narrowing pills. It renders the pills TWICE
  in structure and lets the stylesheet decide (the `useIsPhone` rule for anything server-rendered): a `display:
  contents` box holding the pills as today (hidden ≤640), and a phone root holding the Filter trigger and, while open,
  the sheet (hidden >640). No flash, no hydration branch.
- **Context, two modes.** Inside the desk box a pill is a pill and REGISTERS with the group: whether it is narrowed
  (off its rest) and how to reset itself. Inside the sheet the same pill renders as a sheet ROW (`FilterSheetRow`):
  its name, its value always shown, its choices (the pill's own panel content) under it when open. Outside any group
  a pill is exactly what it was — the Budget, BvA, Dues, Awards and practice-library strips are untouched.
- **The pills** (`MultiSelectDropdown`, `DateRangeDropdown`) each gain the row form and the registration; their panel
  content is built once and used in both forms. A row's value lists the chosen options without their counts
  ("Actual, Overdue"); more than three reads "N selected". A preset picked in a row closes that row, as a pick closes
  the pill's panel.
- **The sheet** reuses `CoachToolbarMenu`'s drawer classes (panel, drawer, title, item, separator) and
  `LineupSheetScrim`, rendered inside the dismiss boundary (the touch fall-through lesson). `role="dialog"`, not
  `menu`: it holds checkboxes and date fields. Escape and click-away close it (`useDismissable`); focus moves to the
  first row on open and leaving the sheet by Tab closes it. It closes when the width leaves the phone band.
- **Coach Ledger:** the Timeline strip becomes `FilterGroup(Type, Status, Item, Date, Tags)` + Cash on hand; the
  Bills / Payment schedule strip becomes `FilterGroup(Status, Item, Tags)` + Open all / Fold all.
- **Club Ledger:** `FilterGroup(Type, Status, Category, Date)` + Balance; the ≤640 `flex-basis: 100%` on Balance goes.

## Build record (built on dev 2026-10-02)

- **New:** `components/coaches/FilterGroup.tsx` + `.module.css` — the group, its context (`useFilterGroupMember`,
  `FilterSheetRow`), the trigger (the pill's own face, `.multiSelectActive` while anything is on, the count in the
  data face), the sheet (`CoachToolbarMenu.module.css` panel/drawer/title/item/separator + `LineupSheetScrim`
  inside the dismiss root, `role="dialog"`, `data-escape-owner` while open, focus to the first row, a Tab out
  closes it, a width leaving ≤640 closes it).
- **`MultiSelectDropdown`:** one rest test (`narrowed`) now feeds both the tint (`atRest = restQuiet && !narrowed`)
  and the group; the choices are built once for the panel and the row; a row's value lists up to three chosen
  options with any "(n)" count stripped, else "N selected". **`DateRangeDropdown`:** `narrowed` = off its
  `restSelectionId` preset; a preset picked in the sheet folds its row; the custom-range hint drops the word "pill"
  in the sheet.
- **Coach Ledger** (`expenses/panel.tsx`): `<FilterGroup key="timeline">` (Type, Status, Item, Date, Tags) and
  `<FilterGroup key="bills">` (Status, Item, Tags; Open all / Fold all after it). The old `display: contents`
  wrapper for Item/Date/Tags is gone. **Club Ledger** (`admin/accounting/ledger/page.tsx`): `<FilterGroup>` (Type,
  Status, Category, Date); `Money.module.css` loses `.balance`'s ≤640 `flex-basis: 100%`.
- **Departure:** `.moneyFilterBar` deleted from `coaches.module.css` — no element had worn it for months; the only
  "use" `check:css-selectors` saw was a comment this change removed, so the gate (rightly) called it newly dead.
- **Guard:** `tests/unit/ledger-phone-filter-guard.test.ts` (six checks, one per ruling).
- **Proof:** `npm run typecheck` clean; eslint clean on every new and changed component (the coach panel's 25
  warnings are pre-existing, none in the strip); the new guard + `ledger-parity-screens-guard` +
  `club-stage3a-screens-guard` 42/42; `npm run verify:changed` exit 0 (5,556 unit tests); `.probe/lf/verify.mjs`
  on dev, touch at 390 and 360, desk at 1280, **13/13**: pills hidden and one button shown; Cash on hand and Open
  all on the button's line; the five rows and values; Whole season folds its row, lights it, counts 1; Scheduled
  keeps the sheet open and counts 2; Reset → rest and closed; a tap on the dim closes and presses nothing; Escape
  returns focus to the button; By bill lists Status and Tags; 360 toolbar 128px, no sideways scroll; both desks
  show their pills and no button (coach desk toolbar 104px).
- **Probe lesson:** a probe context that refreshes the coach's Supabase session leaves `tests/uat/.auth/coach.json`
  stale for the NEXT context (it landed on /auth/login); re-signed with the auth-setup project.
- **/simplify 2026-10-02** (four lenses). Fixed: the sheet's focus return now shares `CoachToolbarMenu`'s
  hardened rescue, moved to `rescueFocusTo` in `lib/overlay-hooks.ts` (one copy); Escape uses `useDismissable`'s own
  focus return (the custom handler went); the unused `title` prop went (one `FILTER` word); `DateRangeDropdown`
  reads one rest test for its tint and its count; a sheet-row pill asks `useDetailsOutsideClick(false)` (no document
  listener, no panel fit); `CoachToolbarMenu.module.css` names the filter sheet as the drawer's second consumer.
  Skipped: the `wasPhone` adjust-during-render → an effect (the repo's lint flags setState-in-effect; React's
  documented pattern kept); `bareLabel` → passing `count` at the call sites (changes the DESK pill's wording,
  "Actual (23)" → "Actual" — not ruled); promoting the drawer to one shared class (touches the lineup builder's
  `.lineupAutoMenu`, which another session was editing — the CSS comment now says the promotion is due).
- **/review 2026-10-02** (high-risk tier: lib/ shared module; lenses correctness, state/timing, blast radius,
  a11y/touch; security skipped — no data, auth or permission path). Gate: typecheck ✓, lint ✓, guards ✓,
  `check:layout --only=` the 10 reachable screens × 4 widths ✓ no new findings (23 baseline entries no longer
  reproduce, mostly the phone pills' checkboxes now inside the sheet — not pruned: some are date-dependent).
  Fixed (5): **[Medium]** the sheet is `aria-modal="true"`, as every scrim-backed dialog in the portal is;
  **[Medium]** `rescueFocusTo` takes the REF and reads it inside the frame (it had captured the node at call time,
  a contract change for every Tools menu); **[Low]** a selection holding an option no longer offered reads in the
  pill's own words; **[Low]** the trigger's visible count is `aria-hidden`; **[Low]** `disabled` is tested on any
  element, not only a <button>. Advisory, not fixed: a `DateRangeDropdown` given no preset `restSelectionId` reads
  at rest (no caller does); two date pills in one group would share the key "Date"; a pill's label is its key.
  Pre-existing: no live announcement when a value changes (the desk pills have none either).
  Probe re-run on a fresh dev server (restarted 2026-10-02: its render worker had crashed, 500s on unrelated
  routes too): 13/13, plus focus back on the button after Reset and `aria-modal` on the sheet.
- **/docs 2026-10-02:** the coach's Ledger answer (*The Ledger: one book, three views*) and the club's *Reading the
  Ledger, and correcting a line* each gained one phone paragraph; both sections' search terms gained filter button /
  reset filters / where did the filters go. `check:spelling` ✓. `measure:help`: the club section stays under 350
  words. Found, not fixed: the coach Ledger answer is 2,763 words — long before this change, a restructure not a sync.
  No help screenshot shows the Ledger, so none was re-taken.
- **Committed `687187cf` 2026-10-02** from a private index (the coach panel's "Next due" hunk and other sessions'
  TODO / QA-ledger lines stayed in the tree). Next: owner QA §261.

## Verification

- Focused lint on the touched files; `npm run typecheck` (shared components); `npm test` with a new guard
  `tests/unit/ledger-phone-filter-guard.test.ts`; `npm run check:spelling`.
- A probe on both Ledgers at 390 and 360 (dark + warm): the toolbar is two lines; the count, the row values, Reset and
  a filter changed from the sheet behave; 1280 shows the pills exactly as before.

## QA

Owner QA walk in the Owner QA Ledger after the build (phone: both Ledgers, every view; desk: unchanged).
