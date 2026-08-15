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

## 6b. `/review` — high-risk funnel, what it found

Four lenses (correctness · money-integrity · security/tenancy · regression). **Nine confirmed
findings, all fixed.** Two classes, and both are the same mistake in different clothes: *a new
state was enforced where the data is WRITTEN and not where it is READ.*

### ⚠⚠ A PLEDGE COUNTED AS MONEY IN THREE PLACES (Critical ×3)

Two lenses found this independently. A sponsor's entry is written the moment the sponsor is
recorded — it holds the arrangement — but while `pledged`, no income has posted and no credit
exists. Three season-wide readers summed entries without asking:

- the **Money hub's headline "Money in"** and its fundraising card;
- **Budget vs. Actual's funding ACTUAL**, so a $2,000 pledge read as 100% of a $2,000 sponsorship
  target already collected;
- ⚠ **the season settlement pot** — the one families are PAID OUT OF. A promise could have funded a
  real refund of money the team never received.

Migration 237's own comment states the rule ("a pledge that counted as actual would flatter the
season"). It was never wired into the readers. Now one predicate (`isRealisedRecord`) and one query
(`getRealisedFundraiserEntries`) carry it, with the rule pinned as a test.

### ⚠ THE OLD DRIVE ENDPOINTS DID NOT REFUSE A SPONSOR (High ×2)

Also found by two lenses. The per-player "log an amount" and "edit an amount" routes predate
sponsors and enforce a drive's rules only. Pointed at a sponsor by a coach who already holds
money-write, they would **post real income and write a real dues credit for a sponsorship still
marked pledged**, and add a second entry to a record every sponsor read assumes has exactly one.
Both now refuse a sponsor and say where to edit it instead.

### THREE MORE MISSED `=== 'funding'` READERS (High ×2, Low ×1)

⚠ **And a lesson about how I missed them:** my own sweep for this pattern was truncated at 20
results and I read it as complete. The money lens found the tail — the budget **import preview**
(both entry points) told a coach it would *update* a sponsorship line while the server, correctly
filtered, inserted a duplicate **cost** line instead: previewed $550/player, actual $850/player.
Plus a stale `.neq('line_kind','funding')` write guard whose own comment had stopped being true.
The demo-world check script had it too.

### Also fixed

Non-atomic sponsor create (income posted, entry insert fails → real money on the books belonging to
a record no screen can explain — now rolled back); a swallowed credit-insert failure that left the
screen and the export both claiming a family had been credited while their dues were untouched.

### Verified clean rather than assumed

Org/team/season scoping on every new write; the archive write-guard contract; capability gating on
every new field; the roster fetch behind the "brought in by" picker; season rollover carrying the
line kind; the installment generator and dues preview; every `RepProgramYear` literal; every caller
of the accounting-settings helpers; the export column contract.

### Noted, not fixed

`budget-line-kind-guard.test.ts` proves every reader *mentions* the kind column, not that it handles
every VALUE — which is why it passed while five readers were wrong. Strengthening it is its own
piece of work; the one file it failed to catch is fixed.

## 7. Owner QA

Ledger §24.

## 8. Not built — the seven follow-ups

**Owner-reviewed and approved 2026-08-15**, proposal + mockups:
https://claude.ai/code/artifact/50fe3e42-0071-41e3-bbde-a2064f854608
None is a correction to what shipped; all seven sit on top of it, and none blocks QA §23/§24.

**What a coach would notice**

1. **Two labels still say "Fundraisers"** — the Money hub's own list of screens, and one help
   passage walking the tab bar. The tab was renamed; these were missed, so the product disagrees
   with itself one click apart. (The kind FILTER's "Fundraisers" chip is correct and stays — it
   names a kind, not the tab.)
2. **Money tags were never built.** The owner cut the tag *filter*; the *field* was in the approved
   mockup and does not exist, so nothing can be tagged and the money-tag report still has no
   money-in side. ⚠ **OPEN QUESTION** — confirm the field was wanted, since the cut may have been
   read too broadly.
3. **The Money overview gets TWO rows, not one** (owner ruling 2026-08-15, revising the single
   combined row first proposed). One for Fundraisers, one for Sponsorships, each opening the tab
   **already filtered to its kind** — which is what earns a second row, since a rail row is a door
   and two doors to an identical view would be a second navigation system.
   - ⚠ **This forces the kind filter into the ADDRESS** rather than component state — a bonus, not
     a cost: the filtered view becomes shareable and Back works across it, matching `section` and
     `fundraiser`. It must join the hub's `ONE_SHOT_KEYS` or it will ride to other tabs.
   - The Sponsorships row **shows at zero** ("None yet · add one"), the way the drives row already
     introduces itself. Blue dot for sponsorships, green for drives, matching the tab's chips.
4. **No sponsor in the demo world.** ⚠ **The demo fundraiser carries three pins the guided tour
   narrates BY NAME** — $240 overdue across exactly two families, no rebate able to cascade
   backwards, one deliberately part-paid instalment. **A sponsor attributed to a family would
   credit their dues and could clear a debt the tour talks about.** So the demo sponsor is
   **club-wide, credited to nobody**: it adds money to the team and touches no family's bill, and
   all three pins survive by construction. One sentence joins the money tour step; the demo health
   check gains the sponsor so a reseed cannot drop it.

**What stops the next defect** — take these FIRST (this project produced two defects of exactly the
kind they would have caught, and a human reading a report caught both)

5. **Nothing automated ever opens a sponsor.** The rendered sweep opens a *fundraiser*; a sponsor
   draws a different screen. Add it as its own swept screen, and add an end-to-end test that walks
   the MONEY, not the markup: create a **pledged** sponsor → assert it adds nothing to the hub's
   money-in, nothing to Budget vs. Actual's actual, nothing to any family's dues → flip to
   **received** → assert all three move → flip back → assert they unwind. **That test is the one
   that would have caught the review's worst finding before a human looked.**
6. **The budget-line guard does not prove what it claims** (§6b). It checks whether a file
   *mentions* the kind column, so it stayed green while five readers were wrong. Replace the
   substring check with one that flags **the banned shape** — a line kind compared to a literal
   anywhere outside the shared reader. That catches all five, and makes a fourth kind safe to add
   later.
7. **Three siblings share the wrong-season assumption** — tryout evaluations, lineup templates and
   the practice recap still look a record up by id + team on season-scoped data. Narrower exposure
   (all live-season-only, no archive door hands out a past id), but it is the same reasoning that
   already failed once. Move them to a season-scoped lookup and add a guard for the shape. **Its
   own unit of work** — three unrelated features, and a shared fix that breaks one is worse than
   the hole.
