# Kickoff prompt — spending points at a budget line, not just a category (paste into a fresh chat)

Build `docs/projects/active/COACH_BUDGET_LINE_ALIGNMENT_PLAN.md`. It is **approved by the owner**
(2026-08-15) and its mockup is binding: https://claude.ai/code/artifact/dffa11b7-14a1-4182-afb7-e327985d7443

Everything the plan asserts about the codebase was true when written, but **the screen has moved
since** — §"What changed under this plan" below is the delta. Read the plan first, then that section,
then the code.

## Read first, in this order

1. `docs/projects/active/COACH_BUDGET_LINE_ALIGNMENT_PLAN.md` — the whole thing. §2 records a defect
   whose *display* half already shipped; §3 is the settled line-vs-item decision (**do not
   re-litigate**); §6 is the build.
2. `docs/projects/active/COACH_BUDGET_LINE_ALIGNMENT_PM_BRIEF.md` — the coach-facing story and the
   three success criteria.
3. The mockup above — §3 is the field, §4 is the report it makes possible, §5 is the edge cases.
4. `lib/coach-budget-line-actuals.ts` (committed `ee41a269`) — the pure rule the report already uses.
   **`lineActualsKnowable()` is the single predicate this work changes.** The arithmetic under it is
   correct and tested; do not rewrite it.
5. `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx` — the merged money form as it
   now stands (commit `cfb66a84`).

## What changed under this plan since it was written

The plan was written against the pre-`cfb66a84` screen. Four things are different, and two of them
make the work **smaller** than the plan describes:

1. **There is now ONE modal, not two.** Add Expense and Add Payable merged into a single form with a
   kind switch, and the same modal does **Edit**. So the plan's "both forms" is a single call site —
   `categoryField(form.category, …)` around L1325. Replace that one function and both kinds, add and
   edit, get the field. **Do not re-split the forms.**
2. **A budget line now has THREE kinds: `cost`, `funding`, `sponsorship`** (migration 237). The last
   two are money **IN** — see `FUNDING_LINE_KINDS` / `isFundingKind()` in `lib/coach-budget-totals.ts`.
   ⚠ **The picker must offer COST lines only.** A coach cannot spend against a sponsorship line, and
   the report already carries a warning about what happens when money-in lines enter the cost
   machinery — they sit waiting to absorb a real expense and inflate the budget they exist to offset.
   The plan predates sponsorships and does not mention this.
3. **The latest migration is 237.** Yours is **238** — confirm at the moment you write it; other
   chats are active.
4. **Paid records now have locked fields** (`lockedFields()` / `locks.amount`), shown with their
   value and the reason rather than greyed into silence. **Decide deliberately whether the budget
   line is locked on a paid record and say why in the code.** Recommendation: **leave it editable** —
   re-filing a past cost against the right line is ordinary bookkeeping, moves no money, and touches
   no ledger entry (migration 236's links are to the amount, not the classification). If you disagree
   after reading `lockedFields`, argue it rather than following this.

## The work

Follow plan §6. In short:

- **§6.1 Migration 238** — two nullable link columns on the expense row, both `ON DELETE SET NULL`.
  The existing free-text `category` column **stays and stays populated**. ⛔ **No backfill** — the
  plan says why, and it is not negotiable. Same unit of work: `DATA_DICTIONARY.md` +
  `npm run refresh:snapshots`.
- **§6.2 The picker** — replaces `categoryField`. Cost lines grouped by category, each showing
  **what is left on it**, plus **"Not in the budget"** at the foot revealing today's category picker
  and today's Unbudgeted warning. A team with no plan sees exactly today's field. The panel
  **already fetches the budget plan** (it powers the current budgeted-category warning), so the lines
  are in hand — do not add a request.
- **§6.3 The server** — accept the link, **validate the line belongs to this team and this program
  year** (`budget-plan/lines` performs the equivalent check on category and item; its comment records
  that this was a pre-existing gap hardened during the Chunk G review), and derive the text category
  from the line so the two can never disagree.
- **§6.3 The report's remaining half** — a line's actual is the sum of expenses linked to it; a
  category's actual stays the sum of everything in that category, so both levels reconcile through
  the mixed-record window. **`lineActualsKnowable()` is what changes**, plus the category's
  explanatory sentence retiring when a real figure exists. The export gains line actuals (its comment
  currently records the limitation as a fact of life).
- **§6.5 Tests** — the three named cases. The multi-line-category regression in
  `tests/unit/coach-budget-line-actuals.test.ts` must still pass.

## Scope boundaries

- ⛔ **No recurring-payables work.** The sibling plan is approved but not started, and its engine
  (`lib/coach-monthly-recurrence.ts`, committed `c404bd4b`) is deliberately callerless. Leave it.
- ⛔ **The spreadsheet importer stays category-level** (plan §6.4). Flag it as follow-up; do not
  extend the template.
- ⛔ Do not re-open line-vs-item (§3), and do not hide "Not in the budget" — unbudgeted spending is a
  real thing, not a mistake to design out.

## Finishing — all in this unit of work

- `npm run typecheck` (shared modules + API contracts change) and `npm run verify:changed`.
- **`/docs`** — the budget and expenses guides describe category-level matching; a coach-visible
  field changes on the most-used money form.
- **Demo** — Riverdale Ridge has a budget plan *and* seeded spending. Once linking exists its
  Budget vs. Actual can show real per-line actuals instead of dashes, on the screen a prospect is
  most likely to open. Plan §8 flags this as exactly the CLAUDE.md case where the product gains
  something and the demo does not follow unless someone decides it should. Seed the links.
- **Owner QA ledger** — new section; the multi-line category case and the no-plan/legacy-record cases
  are the ones that matter.
- Offer **`/simplify`** (a new picker component beside the existing `BudgetItemPicker` is exactly the
  diff shape that rule names) **then `/review`**.
- Update the plan header with the commit anchor, and TODO.md.

## Working rules — four chats share this working copy

- Branch is **`dev`**. Check `git rev-parse --abbrev-ref HEAD` before committing.
- Stage **explicit pathspecs only**, never `git add -A` — and note that `[orgSlug]` / `[teamId]`
  paths need `:(literal)` or they stage nothing.
- ⚠ **Another chat staged files mid-commit during this session and they were swept into an unrelated
  commit.** After every commit run `git show --stat HEAD` and confirm only your files landed; if not,
  `git reset --soft HEAD~1`, unstage the foreign files, re-commit.
- **Do not commit or push without explicit confirmation from the owner.**
