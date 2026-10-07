# Filter Counts — plan

**On production 2026-10-07** — Amplify job 277 (prod HEAD `17e069b8`, tag `release/2026-10-07`); the release record holds the detail.

**Status:** D1–D6 accepted 2026-10-05 (owner: "I agree with all of your recommendations"). Hub (Mockup ·
Decisions · PM Brief · Plan notes): https://claude.ai/artifact/EFWMUeiC3sLkn4CQaBqzrw, source
`docs/projects/active/FILTER_COUNTS_HUB.html`. PM brief: `FILTER_COUNTS_PM_BRIEF.md`. Ruling recorded in
`memory/design_decisions.md` (2026-10-05).

## The rulings

| # | Ruling |
|---|---|
| D1 | A multi-choice filter's count is a quiet number at the END of its choice's row (the Awards filter's `count`), on a desk and in the phone sheet; never written into the choice's name. |
| D2 | A narrowed pill names its choices, up to three ("Status · Actual, Scheduled"); four or more read "4 selected". At rest a pill still shows only its name (2026-09-02). |
| D3 | The desk pill and the phone sheet's row use the same words whenever both show a value: one function. |
| D4 | The practice library's Tags (Drills, Templates, Circuits, the picker, the panel beside a plan) and the Awards filter follow. |
| D5 | Every count is what ticking that choice would list, given the other filters — the club Ledger's too (voided lines counted only where Void is shown); "All" on the club's Status means all three. |
| D6 | The coach's Type at rest reads "Every type". |

## Build

1. **One summary rule.** `lib/filter-summary.ts` (pure, unit-tested): `filterSummary(options, selected, allLabel)` —
   empty → the all word; every selected id offered and ≤ 3 → the names in list order, joined ", "; otherwise
   "N selected" (a selection holding an option no longer offered reads "N selected", never the all word).
   `MultiSelectDropdown` uses it for the pill AND the sheet row; `bareLabel` goes.
2. **Counts move out of labels (D1, D4).** Callers pass `count`:
   coach Ledger Timeline Status, Bills/Payment schedule Status, Tags (`tagFacts`) in
   `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx`; club Ledger Type and Status in
   `app/[orgSlug]/admin/accounting/ledger/page.tsx`; the practice library's `LibraryFilterBar` in
   `components/coaches/LibraryRow.tsx`. Awards already passes `count`.
3. **A long value never overflows its row.** The pill's value ellipsises inside the row's width
   (`components/shared/FilterPill.module.css`); the label and chevron do not shrink.
4. **The club's counts (D5).** `lib/club-ledger-read.ts` keeps `counts` as the WINDOW census (the export menu's
   "every entry in the period · N entries" reads it) and adds `optionCounts: { status, type }`, each facet counted
   over the rows the OTHER facets admit — a pure exported function, unit-tested with a voided expense in the window.
   The page reads `optionCounts` for the pills.
5. **"All" means all (D5).** The page stores the picked set; empty = All = posted · pending · void, sent to the route
   explicitly. `statuses` is derived (so `showBalance` and the guard's literal stand).
6. **"Every type" (D6).** The coach's Type pill `allLabel`.
7. **Help.** The coach's Ledger answer and its search terms ("2 selected", the counts) in `lib/help-content/coaches.tsx`.
8. **Guard.** `tests/unit/filter-counts-guard.test.ts`: no caller writes a count into a label; one summary function
   for pill and row; the club page reads `optionCounts`; the coach's Type says "Every type".

## Not touched

Date pills and single-choice pills (View, Book, Group by); the phone sheet's shape (Ledger Phone Filter, ruled
2026-10-02); the count rules themselves on the coach's Ledger (Bills' overlap stays: a late part-paid bill counts under
Overdue and Partly paid).

## Verification

`npm run typecheck`; focused lint; the new guard + `ledger-phone-filter-guard` + `club-stage3a-*` guards;
`npm run verify:changed`; a browser probe (`.probe/fc/`) on both Ledgers at 1280, 1024 and 390, warm and dark: counts
at the row end, pills naming their choices, the club's Expenses count equal to the rows listed, "All" listing voids.
Owner QA walk in the Owner QA Ledger: **§263 ✅ PASSED 2026-10-05, 18/18** (all three walks). **Committed `fda3074d` 2026-10-05** from a private index (the other sessions' hunks in the club help, the design log, TODO and the QA ledger stayed in the tree).

## Build record (built on dev 2026-10-05)

- **New:** `lib/filter-summary.ts` (`filterSummary`, up to three names else "N selected"; an option no longer
  offered reads "N selected", never the all word). `MultiSelectDropdown` reads it for the pill AND the sheet row;
  `bareLabel` deleted. `ledgerOptionCounts` in `lib/club-ledger.ts` (pure, client-safe): each facet counted over the
  rows the other facets admit.
- **Counts out of labels:** coach Ledger Timeline Status, Bills/Payment schedule Status, Tags (`tagFacts`); club Ledger
  Type and Status; the practice library's Tags (`LibraryFilterBar`). Awards unchanged (already `count`).
- **Club:** `readBook` returns `optionCounts` beside `counts` (the window census, still read by the export menu's
  "every entry in the period · N entries" and by which Types are offered). The page keeps the picked set;
  `statuses` is derived (empty = All = posted · pending · void, sent to the route explicitly), so `showBalance` and
  the Stage 3a guard's literal stand.
- **Copy:** coach Type `allLabel="Every type"`; three stale code comments that quoted "2 selected" corrected
  (`panel.tsx` ×2, `lib/payable-standing.ts`); the book route's header comment.
- **CSS:** `FilterPill.module.css` — the pill and its summary `max-width: 100%`, the value ellipsises, the label and
  chevron never shrink (the narrow-row guard for a three-name value).
- **Help:** the coach's Ledger (one sentence on counts and the narrowed wording; Bills' Status line; search terms lose
  "2 selected"); the club's Status definition gains "or All for every line". `measure:help`: the club section stays
  under 350 words (a first draft hit 360 and was trimmed). Found, not fixed: the coach's Ledger sub-topic is 2,803
  words — long before this change (2,763), a restructure not a sync.
- **Ripple:** Ledger Phone Filter's walk (§261, unwalked) quoted "Type All" and "count in brackets" — W1 steps 2 and 4
  reworded in its hub.
- **Guard:** `tests/unit/filter-counts-guard.test.ts` (summary cases; pill + row one function; no "Name (n)" label in
  the four callers; counts via `count`; the club facet counts with voided expenses; All = all; the export census;
  "Every type").
- **Proof:** `npm run typecheck` clean; focused eslint 0 errors (warnings pre-existing); guards 156/156;
  `npm run verify:changed` exit 0 (5,574 unit tests; spelling, contrast, CSS-selector gates clean); browser probe
  `.probe/fc/verify.mjs` on the running dev server **15/15**: coach desk (rest quiet; counts at row end; "Status ·
  Actual"; "Status · Actual, Scheduled"; "Every type"; "Type · Expenses, Refunds"; one filter line at 1280 and 1024;
  Bills counts), practice library counts, coach phone (rows "Every type" / "Actual, Overdue"; counts at row end), club
  desk (Expenses 5 = 5 rows, was "(7)"; Posted + Pending = rows listed with Expenses on; All ticks and lists 7 incl. 2
  voided; the export still "every entry in the period · 17 entries").
- **/simplify 2026-10-05** (four lenses). Fixed: the pill's ellipsis was a second copy of `.multiSelectShrink`'s
  rules — now one `.multiSelectValue` declaration and `.multiSelectShrink` keeps only the flex give (the club Book pill
  re-checked at 360: still ellipsised, no overflow); `LineStatus` moved to `lib/club-ledger.ts` (re-exported by
  `club-ledger-read`), so `ledgerOptionCounts` needs no generic and the test imports the real type; `readBook`'s rows
  carry `status`, so the counts read them without a copying `.map`; the summary's limit is module-private; the guard
  WALKS `app/` + `components/` for every `<MultiSelectDropdown` caller instead of naming four files (it had missed
  payment requests); a note at `readBook`'s status default says it is a separate contract from the page's "All".
  Skipped: building `optionCounts` on the export read (one allocation-free pass; skipping it would make the return
  shape depend on `all`); shrinking `counts.type` to a single house-league boolean (the census is the documented "which
  Types are offered" source, and Stage 7 brings that type in); one shared facet-count helper for both Ledgers (the
  coach's counts differ in shape — Overdue ignores the date window, tags are many-per-row — premature here).
  After: guards 145/145, typecheck clean, CSS gate clean, browser probe 15/15.
- **/review 2026-10-05** (high-risk tier: `lib/` money read path + the shared pill; lenses correctness, data/contract
  + security, regression/blast radius, accessibility/touch). Gate: `verify:changed` exit 0 (5,576 unit tests;
  spelling, contrast, CSS gates), typecheck ✓, focused lint 0 errors, `check:layout --only=` the 9 touched screens ×
  4 widths — 7 NEW findings, all ONE element outside this diff: the header bell's unread badge (white 10px on
  #ef4444, 3.76:1) at 1440, newly visible because the UAT coach now has an unread notification — reported, not fixed.
  Fixed (1): **[Low]** `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts` found Bills' Status checkboxes by
  `/^Paid \(/` — the name is "Paid 7" now; patterns → `/^Paid\s*\d/` etc. (Playwright: new 1 match each, old 0).
  Refuted (2): **[High→refuted]** "the checkbox now announces 'Actual23'" — Chrome's own AX tree reads "Actual 23"
  (the count span is a flex item, so a space is inserted); **[Advisory→refuted]** the count's ink on the admin ground —
  measured 6.78:1 warm, 6.92:1 dark. Advisory, not fixed: ticking all three club statuses one by one reads "Posted,
  Pending, Void" while ticking All reads "All" (the shared pill's long-standing empty-vs-all-ticked split, now in
  names); no hover title on a truncated pill value (no Ledger pill truncates at ≥1024; the phone sheet rows wrap;
  the full value is in the open list and to a screen reader); the export read builds `optionCounts` it does not read.
