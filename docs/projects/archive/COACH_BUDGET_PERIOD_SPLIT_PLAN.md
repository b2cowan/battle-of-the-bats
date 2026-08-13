# Coach Budget Line — Period Split Rework

**Status:** approved from mockup, building 2026-08-12
**Mockup (binding spec):** https://claude.ai/code/artifact/590648f2-6440-4ae2-a3e1-4f0111805d0c
(source: `docs/projects/active/COACH_BUDGET_PERIOD_SPLIT_MOCKUP.html`)
**PM brief:** `COACH_BUDGET_PERIOD_SPLIT_PM_BRIEF.md`
**Surface:** Coaches → Money → Season Budget Plan → Add / Edit Budget Line modal

---

## Why

Three defects, all found by the owner on the live form, all in the same modal.

1. **A failed save looks like a broken button.** The validation message renders just above the
   footer *inside the scrolling body*. With the period rows on screen it is below the fold, the page
   does not move when Save is pressed, and the first reasonable conclusion is that the button is dead.
2. **Period labels are mandatory for no user-facing reason.** The requirement exists because the
   stored period carries a name — but when the period has a date, the name is derivable. The form was
   asking the coach to do the system's typing.
3. **Only explicit dates were possible.** Expense payables genuinely have due dates; annual budgets
   are broken out by month or quarter. A twelve-month budget cost twelve trips through a date picker
   plus twelve typed labels.

## The shape (as ratified across four mockup rounds)

Inside **Period Breakdown**, two numbered steps:

**1 · Split this line by** — `Months` · `Quarters` · `Specific dates` · `Just names`.

**2 · Add a period …** — the existing "+ Add period" gesture. Each row is
`[ period picker ] [ Label (optional) ] [ Amount ] [ × ]`, with column headings above.

| Mode | Row's picker | Name if label blank | Stored date |
|---|---|---|---|
| Months | month+year select | `Apr 2027` | 1st of the month |
| Quarters | quarter+year select | `Q2 2027` | first day of the quarter |
| Specific dates | date input (today's control) | `Mar 14, 2027`, or `Mar 2027` on the 1st | as picked |
| Just names | none | `Period 1` | none |

Owner rulings baked in:

- **The picker sits FIRST, label second.** Scanning a twelve-row budget gives a clean column of
  months down the left edge. (Round 2 — the identity must never be the thing that gets overwritten.)
- **Changing the mode RESETS the periods to one empty row.** Round 4. Converting shapes only works
  when they correspond; 12 months → 4 quarters piled three rows per quarter and mapping back produced
  three Januaries. Owner: *"keep it consistent and reset across… let's keep it simple."*
  Months→dates is the one lossless conversion and is deliberately NOT carved out.
- **A new split starts with ONE empty period**, not zero and not twelve.
- **No confirmation dialogs. Undo instead.** Fill / clear / mode-reset happen immediately and leave a
  one-click Undo behind. Undoing a mode reset restores the mode *and* its rows.
- **Nothing but amounts can block a save.**

## Data model — no migration, no API change

The period row keeps its existing shape (`label`, `date`, `amount`). **The month/quarter selection IS
the date** — months mode writes `YYYY-MM-01`, quarters mode writes the first day of the quarter — so
the split mode is a client-side entry concept only and nothing downstream learns a new word.

Consequences, deliberately:

- `rep_budget_periods.period_label` stays `NOT NULL`. The client always sends a **resolved** label
  (typed, else derived), so the existing API contract is untouched.
- The periods API keeps rejecting a blank label. That is now unreachable from this form and stays as
  a server-side backstop.
- The client's **date** requirement is dropped (the API already accepted a null date). Only
  "Just names" produces undated periods, and those rows carry a visible advisory that Budget vs.
  Actual cannot place them on a calendar.
- Budget vs. Actual, the month grid, installment generation and the import path all read the same
  columns as before. The month grid *improves*: month mode produces periods that land cleanly in
  month columns by construction.

## Opening an existing line

The mode is **inferred from what is stored**, so a line saved before this change opens sensibly:

1. no periods → the coach's remembered mode, one empty row
2. every period dated, every date the 1st of a quarter-start month, every label matching `Q1`–`Q4` → **quarters**
3. every period dated, every date the 1st of a month → **months**
4. every period dated → **specific dates**
5. otherwise (any period undated) → **just names**

Inference can be wrong; the coach can switch, which resets (with Undo). Not a silent data change —
nothing is rewritten until they save.

## Validation & failure feedback

Blocking, and only these:

- line total present and > 0
- split on → at least one period
- every period amount present and > 0
- period amounts sum to the line total (± $0.02), or shares sum to 100% in `%` mode

On a failed save:

1. the first offending field is **scrolled into view and focused** — the page moves, so the click
   plainly registered
2. that field gets the danger outline; its row gets a specific message naming the period
   (*"Enter an amount for 'Apr 2027'."*)
3. the **footer** — which is sticky, therefore always visible — shows `⚠ N things to fix`, and
   clicking it jumps back to the first one

Explicitly **not** a modal dialog: it stacks a second dialog on a form that already stacks a discard
guard, costs an extra dismissal, and still cannot say which of twelve rows is wrong.

Once a save has been attempted, the marks clear live as each problem is fixed.

## Persistence of the coach's choice

Last split mode used is remembered **per team + season in device storage**, the shipped pattern for
quiet per-coach state (checklist dismissals, winding-down dismiss). Worst case across devices: the
picker defaults to months instead of their usual. Never a server round-trip, never a migration.

## Files

- `lib/coach-budget-period-modes.ts` — **new**, pure: mode type, derived names, anchor dates,
  next-anchor advance, season fill, mode inference. No IO, no React.
- `tests/unit/coach-budget-period-modes.test.ts` — **new**. Covers the inference ladder, the derived
  names, the auto-advance roll into the next year, and the round-trip that produced three Januaries.
- `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx` — the modal.
- `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css` — mode chips, column
  headings, undo strip, wider modal, and the ≤640 reflow for the new picker column.

## Mobile

The existing ≤640 reflow already turns a period row into a labelled group with full-width fields; the
new picker joins it as another labelled field, so phones get `Month / Label (optional) / Amount`
stacked with the remove control at touch size. Column headings are desktop-only (the phone layout
already labels every field).

## Out of scope / follow-ups

- **Spreadsheet import** should land month-shaped budgets in month mode. Not touched here.
- **The org-side budget planner** stores periods the same way and probably carries the same
  required-label friction. Unverified; check before committing to it.
- **Season start month.** The first row defaults to January because the season year is all the
  platform records. Clubs whose seasons run Sep–Aug will correct it every time. Fixing it properly
  means recording a season start, which is a bigger change than this form.
- **Repeat months** (two rows in one month) are allowed and silent. Legitimate for two payments in a
  month; also an easy slip. Left silent per "keep it simple".

## Verification

- `npm run typecheck`
- `npm run verify:changed`
- unit suite (the new pure module is the reason it exists)
- owner browser QA → Owner QA Ledger
