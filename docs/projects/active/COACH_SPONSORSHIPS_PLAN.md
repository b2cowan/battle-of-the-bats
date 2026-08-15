# Coach Money — sponsorships beside fundraisers

**Status:** approved from mockup, build in progress (2026-08-15) · **migration 237**
**Binding mockup:** Claude Artifact "Fundraisers & Sponsors" (revision 3c) —
https://claude.ai/code/artifact/47fdb6e1-dab4-4f4e-876c-558e190a9711
**PM brief:** [COACH_SPONSORSHIPS_PM_BRIEF.md](COACH_SPONSORSHIPS_PM_BRIEF.md)
**Builds on:** [COACH_FUNDRAISER_DRILL_IN_PLAN.md](COACH_FUNDRAISER_DRILL_IN_PLAN.md) (the drill-in this
sits inside).

---

## 1. Why

Owner-raised 2026-08-15: *"for teams there is the concept of sponsorships, which is like a fundraiser
but typically only brought in by 1 or 2 individuals at a time."*

Today the portal has one shape for money-in and it is the drive's: **"what did each player raise?"**
A sponsorship has no answer to that question, so recording one $500 sponsor means creating a
"fundraiser" and logging an amount against a single player while the other fourteen roster rows sit
at "—" forever. And the budget cannot tell the two apart at all — a budget line is either a cost or
*Expected fundraising*, and that one label was deliberately written to cover sponsors and grants
too, so **sponsorship money is already in every plan, invisible**.

## 2. The idea

A record gets a **kind**, and the kind decides *what a row is*:

| | Fundraiser | Sponsor |
|---|---|---|
| The question | What did each player raise? | What came in, and who brought it? |
| The rows | The whole roster, one per player | It **is** the row — one arrival |
| Where it opens | Its own leaderboard (the drill-in) | An edit sheet, like an expense |
| The credit | One % applied evenly across families | A single negotiated figure, $ or % |

**Owner rulings taken during design (2026-08-15):**
1. **One sponsor per row** — no campaign grouping, no second table. This *removed* work: sponsors
   need no drill-in screen at all.
2. **The tab becomes "Fundraising"** — "Fundraisers" would name half its contents; the longer
   "Fundraisers & Sponsors" is what the tab bar has already run out of room for once.
3. **The budget splits** — "Expected fundraising" gains a sibling, "Expected sponsorship". This
   reopens the 2026-08-13 naming ruling knowingly; it is the half of the question the tab cannot
   answer.
4. **No tag filter bar on this screen** — tags stay on the record and still reach exports and the
   money-tag report. The filter returns the day a team has thirty rows, not five.
5. **The kind is create-time only.** A drive's rows are players and a sponsor is a single arrival, so
   switching afterwards has nothing sensible to do with what is already recorded.

## 3. Row density — the rule this settled

The owner's note was *"this looks like a lot of text on the main table"*. The finding worth keeping:
**the numbers were never the problem.** Right-aligned tabular columns are what a table is *for*; it
was three stacked lines of prose in the name cell. The test applied to every fact:

> Would a coach scanning this list to answer *"how are we doing?"* need it — or are they only asking
> it about one record?

**On the row:** name + kind chip · amount · team keeps · credits · status · the way in. Plus one
exception — a sponsor's attribution ("· Blair Ledger"), two muted words, because it is the fact a
sponsor list is scanned *for*, and it is **absent** rather than "—" when there isn't one.

**Inside the record:** rebate % and dates · "4 of 15 players logged" · notes · money tags.

### 3b. Status column alignment — and why right was wrong

Right-alignment earns its place on money because it lines up decimals. **A status chip is an object,
not a number** — there is no decimal to align, so right-aligning only moved the ragged edge to the
left, where it read as a mistake. Centring would have shared the raggedness rather than removing the
cause, which is a column far wider than the chip in it.

**Ruling: the status column shrinks to its widest chip and the chips sit left inside it.** The dead
space goes to the name column, the chips form one clean left edge, and the screen stays
recognisably the same table as Player Dues (which already puts its status left in a tight column —
coloured text there, a chip here).

## 4. The model

A sponsor reuses the entry machinery rather than growing a parallel one:

- **`rep_fundraisers.kind`** — `'fundraiser' | 'sponsor'`, default `'fundraiser'` (every existing row
  IS a drive, so the default states the truth rather than guessing).
- **`rep_fundraisers.sponsor_status`** — `'pledged' | 'received'`, null for a drive.
- **`rep_fundraiser_entries.player_id` becomes NULLABLE** — a club-wide sponsor belongs to no family.
  This is the one change that reaches existing code: every reader must stop assuming a player.
- A **sponsor = one record + exactly one entry.** The entry carries the amount, the credit, the
  income-entry link and the credit link, so totals, exports, the archive and deletion all work
  unchanged.
- **Pledged means no money yet:** the entry exists (it records the arrangement) but no accounting
  income entry and no dues credit are created until the status flips to received.
- **The credit stores DOLLARS.** A percentage is how it was *entered* — `rebate_percent` records
  that, `rebate_amount` is authoritative. Correcting a sponsor's total later must never silently
  revalue a credit already sitting on a family's bill.
- **`rep_program_years.default_player_credit_percent`** — the team-wide default that pre-fills both
  forms. It fills in, it does not govern: every record can differ, and changing it touches nothing
  already recorded (the same rule the per-drive rebate already follows).
- **`rep_budget_lines.line_kind` gains `'sponsorship'`** — sibling of `funding`, same maths (both
  subtract from what the season costs, so dues generation is untouched).

## 5. Build order

**Phase 1 — the Fundraising tab.** Migration · tab rename · condensed list · create fork · sponsor
edit sheet with the $/% credit · the team default setting.

**Phase 2 — the budget half.** `Expected sponsorship` through the Budget Plan, Budget vs. Actual, the
month grid, and imports/exports.

Sequenced rather than scoped down — both are approved. Phase 1 is verifiable on its own; Phase 2
changes a label that four screens read, so it wants its own pass.

## 6. What shipped (both phases, 2026-08-15)

**Phase 1 — the Fundraising tab.** Tab renamed; the list condensed to one line per row with a kind
chip, the shrink-to-content status column and the quiet chevron; a kind filter and a split summary
(pledges carried beside received money, never inside it); `＋ New` forks on kind with the $/%
credit, pledged/received and optional attribution; a sponsor opens its own one-row record rather
than a roster leaderboard, and is fully editable; the team's default player credit lives in
**Team settings → Money** and pre-fills both forms.

**Phase 2 — the budget.** `Expected sponsorship` is a sibling section in the Season Budget Plan,
its own group in the period grid, and its own comparison in Budget vs. Actual. Exports gained a
**Kind** and a **Status** column.

### ⚠ The dangerous part, and what now guards it

Adding a third budget-line kind broke **nineteen readers** written as
`row.line_kind === 'funding' ? 'funding' : 'cost'`. That shorthand was correct with two kinds and
became silently wrong with three: every sponsorship line lands in the **cost** bucket. It does not
throw and TypeScript cannot see it — both sides are strings. The only symptom is that a team which
budgeted $2,000 of sponsorship is asked for **more** from families rather than less, and the error
is twice the amount because the sign flips.

All nineteen now go through `normalizeBudgetLineKind` / `isFundingKind`, and
`tests/unit/budget-sponsorship-kind.test.ts` states it as arithmetic rather than as a convention —
a $2,000 sponsorship must take per-player dues from $800 to $600. **Verified by breaking it:**
reverting the predicate to `=== 'funding'` fails 5 of its 6 assertions.

## 7. Owner QA

Ledger §24.

## 8. Not built

- **Money tags on a fundraiser or sponsor.** The mockup showed them and the owner cut the tag
  *filter*; the tag field itself is still to come. Nothing depends on it.
- **The demo world** has no sponsor seeded, so the coach sandbox shows the tab with drives only.
