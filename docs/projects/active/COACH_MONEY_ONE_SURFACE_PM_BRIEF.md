# PM Brief — Coach Money: the list reports become one surface

**Plan:** `COACH_MONEY_ONE_SURFACE_PLAN.md`
**Mockup:** `docs/projects/active/COACH_MONEY_REPORT_ONE_SURFACE_MOCKUP.html`
(published `dde45c3f-7faf-4d5c-869f-627c0c52fb8b`, round 2 = approved shape)
**Status:** approved on mockup, not built.

---

## What a coach sees differently

Three money screens — the **Statement**, **By activity** and the Budget tab's **List** — are
redrawn to read like the **Months** grid, which is the screen coaches already find easiest.

Today each category on those screens is its own bordered card floating on the page, with a gap
under it, and a row that nobody budgeted for wears an amber background. The result is four
different row colours on one screen and no clear sense of what is grouped with what.

After this change:

- The whole report is **one clean table**, with a faint line under every row, the way a bank
  statement or an accounting package looks.
- **Colour means one thing only: structure.** A shaded row is a category heading. Nothing else is
  shaded.
- **A line nobody planned shows an amber dash** in the Plan column instead of an amber row. The
  fact is still there; it stops looking like a grouping.
- **By activity gets shorter.** An activity's bottom line now sits on the activity's own heading
  row instead of in an extra closing row underneath its lines. Roughly a third more of the report
  fits on a screen, and the report reaches its Season net without scrolling on a laptop.
- **Player dues** becomes an ordinary row rather than a card of its own.
- The table **spans the full width** of the page, matching the summary tiles and the toolbar above
  it.

## What does not change

- Every figure that opens a detail panel still opens it.
- Tapping a report row still folds it; tapping a budget line still opens its editor.
- The Compare control, Expand all, the exported PDF/Excel/CSV files and the footnotes under each
  table are all untouched.
- The Months view itself is the reference and is not redrawn.
- Over/under still says the word, so the meaning never depends on colour.
- On a phone the table scrolls sideways with the first column pinned — the same behaviour Months
  already has, so the phone experience gets simpler, not harder.

## Why it matters

Coaches read these screens in front of a board or a parent group. The Statement is the one that
gets exported to a meeting. A report where the eye cannot tell what belongs to what is a report the
coach has to defend line by line from memory.

There is a second, quieter payoff. The Money hub has been maintaining **two parallel ways of
drawing the same thing** — a card-stack and a table — and they have drifted apart repeatedly, each
time being fixed only on the half someone happened to be looking at. This change retires the
card-stack entirely. One way to draw a money hierarchy means one place for the next fix.

## Customer impact and risk

- **Impact:** every coach on a paid plan who opens Budget vs. Actual or the Budget tab. No data,
  permissions or plan gating change.
- **Risk:** low and cosmetic. The reports' numbers, doors and exports are untouched; this is a
  drawing change. The main risk is a missed spot on a phone, which the rendered layout check at
  four widths is there to catch.
- **No migration.** No database change of any kind.

## Priority

Medium-high. It is the owner's own reading complaint on the screens that get shown to boards, the
shape is already approved on a mockup, and doing it now avoids adding a third variation later.

## Success criteria

1. All three reports render as a single table with a hairline between rows, spanning the page.
2. Only two tints remain: a band heading and a category row.
3. No row wears a status colour; an unplanned line shows an amber dash in the Plan column.
4. By activity reaches Season net inside a laptop screen with categories collapsed.
5. Every figure that opened a panel before still opens it; exports are byte-identical.
6. The rendered layout check passes at 361, 390, 768 and 1440 with no sideways page scroll.
7. Owner QA walk signed off.

## Open question for the owner

**Should an unplanned line keep the amber dash, or a plain one?** The mockup keeps amber. A plain
dash is also defensible because the Off-plan tile at the top already totals what nobody budgeted.
Either way the amber row background goes.

---

## Follow-on, 2026-09-06 — **By activity folds**

**What the coach sees.** By activity now opens as a short list: one row per activity — Player dues,
Tournaments, Fundraising, Facilities and so on — each stating its own bottom line, with Season net
reachable without scrolling. Click any activity (the row or its chevron) to open its revenue and
cost lines underneath; click again to close. **Expand all / Collapse all** now appears on this tab
too, where before it silently disappeared when you switched to it.

**Why it matters.** The owner's own reading, on sight: *"why aren't the items grouped in the
categories? the categories are just headers."* The numbers were grouped — an activity's row has
always been its own revenue less its own costs — but the screen didn't draw it that way. A category
was a fold on the Statement and a dead heading here, so one report taught two different gestures for
the same object, and every item of every category sat on screen at once with nothing marking where
one activity ended and the next began.

**What it costs.** Detail is now one click away instead of always visible. That is the trade this
change exists to make: this view answers *"did each activity pay for itself?"*, and that question is
answered by the list of bottom lines, not by the lines underneath them.

**What did not move.** Every figure, every door behind a figure, both downloads, and the footnotes.
Player dues stays a plain row — it has no lines to hold, so it opens nothing, exactly as on the
Statement.

**Also fixed on the way:** Collapse all used to clear the whole report's open/closed state. With two
folding shapes that would have meant collapsing on one tab silently shutting rows you had opened on
the other; it now acts only on the view you are reading.

**Success criteria.** Success criterion 4 above — *"By activity reaches Season net inside a laptop
screen with categories collapsed"* — is now actually reachable. It was not before, because there
were no categories to collapse.
