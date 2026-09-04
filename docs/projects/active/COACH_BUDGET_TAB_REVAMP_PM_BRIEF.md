# Coach Budget Tab Revamp — PM Brief

**Status: built on dev 2026-09-02 — everything below except category rename. Owner QA: ledger
§133, ✅ PASSED 2026-09-04 (28/28). Category rename grew into its own plan, 2026-09-04** —
`COACH_BUDGET_CATEGORY_OWNERSHIP_PLAN.md` (+ PM brief) — categories split into club-wide shared
ones and a coach's own local ones, not just a rename button; not yet approved or built. Companion
to
`COACH_BUDGET_TAB_REVAMP_PLAN.md`.
Mockups (owner-approved): https://claude.ai/code/artifact/f1bd6e4d-631e-4a82-a10f-a46646b5fb4c

## What a coach sees and does differently

- **No more identical twin rows.** Today, two budget lines filed under the same item (say, two
  tournament entries both under "Entry Fees") show up in the By-period view as two rows with the
  exact same name and no way to tell them apart — and the exported spreadsheet has the same problem.
  After: the By-period view shows one summed "Entry Fees" row marked "2 lines" (matching how the
  List view already works), and when a coach adds a second line to an item, the form asks one
  optional question — "What makes this line different?" — so the detailed view and the export always
  have real words on each line.
- **The period editor stops forgetting.** A split built by quarters reopens as quarters. A named
  split ("Registration deposit / Final payment") can now carry optional dates, and the editor says
  plainly that chunks without dates sit in the Unscheduled column. If a coach edits a line's total
  after splitting it, the form catches the mismatch and offers "Rescale the split proportionally" — today it
  silently saves a split that no longer adds up.
- **Thirty lines fit the way they should.** Rows tighten, a quiet Schedule column shows each line's
  phasing at a glance ("Jan–Mar · 3 chunks"), there's a Collapse all button, and the page remembers
  which view and which folds you had open — today everything resets on every reload.
- **The controls match the rest of Money.** The List/By-period switch becomes the same dropdown
  pills Budget vs. Actual already uses one tab over.
- **Exports you can hand to a treasurer.** The file is grouped exactly the way the screen is —
  same categories, same summed items, same month column headers as the Budget vs. Actual export —
  and the plan finally gets a PDF for printing.
- **A few doors that were missing.** Income that isn't fundraising or sponsorship (interest, a
  rebate, a plain donation) gets its own kind instead of being mis-filed; a coach can rename a
  category they created (typos are permanent today); and a coach who skipped the plan carry when
  starting a new season gets a "Bring last season's plan" door on the empty budget.

## Why it matters

The budget is the head of the whole money story — dues are generated from it and Budget vs. Actual
reports against it. Today its two views literally disagree about what a row is, its editor loses
information the coach entered, and its numbers can drift out of agreement in three quiet places
(a line's split vs. its total; the Overview's headroom vs. the report's; the file vs. the screen).
Every fix here either makes two surfaces agree or stops information from being lost.

## Role differences

No new role rules. Read-only assistants keep seeing the plan without edit controls; the new doors
(second-line question, rescale prompt, rename, carry door) appear only for coaches who can already
write the budget.

## Tradeoffs made

- The By-period view gives up per-line rows in exchange for never showing twins — line-level detail
  stays one tap away in the List view, which is where editing lives anyway.
- One small schema addition (remembering how a split was built) buys the end of mode-guessing.
- The platform's default item catalogue question ("Uniforms" and "Travel" filed under Tournaments)
  is deliberately NOT touched here — every club sees that list, so it gets its own session.

## How to test (when built)

A QA walkthrough artifact will be issued with the build (checkable, with the UAT sign-in card).
Headlines to verify: create two lines on one item and check both views and both export formats;
build a quarters split, edit a label, reopen; edit a split line's total and use the rescale prompt;
reload and confirm the view and folds held; export from each view and compare to the screen; print
the PDF; add an "other income" line and confirm dues math and Budget vs. Actual treat it as money in.
