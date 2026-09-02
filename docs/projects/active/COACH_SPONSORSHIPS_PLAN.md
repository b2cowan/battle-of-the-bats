# Coach Money — sponsorships beside fundraisers

**Status:** both phases + all seven follow-ups **ON PROD 2026-08-17, Amplify job 257** ·
**migrations 237 + 239 applied to production** that session (with 236–250) · owner QA **still OWED**,
ledger §24 + §25, now run against the live site
**Binding mockup:** Claude Artifact "Fundraisers & Sponsors" (revision 3c) —
https://claude.ai/code/artifact/47fdb6e1-dab4-4f4e-876c-558e190a9711
**PM brief:** [COACH_SPONSORSHIPS_PM_BRIEF.md](COACH_SPONSORSHIPS_PM_BRIEF.md)
**Builds on:** [COACH_FUNDRAISER_DRILL_IN_PLAN.md](../archive/COACH_FUNDRAISER_DRILL_IN_PLAN.md) —
⚰ **archived 2026-09-01, and the drill-in it describes no longer exists.** A drive opens in place on
its band row now; the plan of record is
[COACH_FUNDRAISER_BAND_PLAN.md](COACH_FUNDRAISER_BAND_PLAN.md).

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

## 8. The seven follow-ups — BUILT 2026-08-15 · **migration 239**

**Owner-reviewed and approved 2026-08-15**, proposal + mockups:
https://claude.ai/code/artifact/50fe3e42-0071-41e3-bbde-a2064f854608
None was a correction to what shipped in §6; all seven sit on top of it. Owner directed a single
pass covering all seven, including item 7 (which the proposal had argued should be its own unit of
work), and confirmed item 2's open question: **the tag field was wanted.**

**What a coach notices**

1. **The two stale "Fundraisers" labels are gone.** The help passage walking the tab bar now says
   *Fundraising*. The Money overview's row was not renamed but SPLIT (see 3) — each row now names a
   kind, which is what the word was always right for. (The kind filter's "Fundraisers" chip is
   correct and stays; both places now carry a comment saying so, because it has been mistaken for a
   stale label once already.)
2. **A fundraiser or sponsor can carry money tags** — the same picker, the same library and the
   same "+ Create" door as an expense, so one label follows a thing in both directions. Tags live
   **on the record**, never on the list row (the row-density ruling stands), and they reach the
   export. This is the first money-IN side the money-tag report has ever had.
3. **The Money overview has two rows** — *Fundraisers* (green) and *Sponsorships* (blue), each
   opening the tab already filtered to its kind. The Sponsorships row shows at zero
   ("None yet · add one"). The kind filter therefore moved into the ADDRESS: a filtered list is
   shareable, Back steps through it, and the **export now follows the view** rather than always
   dumping the season. `kind` joined the hub's `ONE_SHOT_KEYS`, so it cannot ride to another tab.
4. **The demo world has a sponsor** — $750 from Riverdale Dental, **club-wide and credited to
   nobody**, so it adds money to the team and touches no family's bill. That is not a shortcut: the
   12U's bills carry the $240-across-exactly-two-families story and the $90-of-$120 part-paid row,
   both narrated BY NAME in the guided tour, and a credited sponsor could clear either. One
   sentence joined the money tour step; `check-demo-coach` now pins the sponsor's kind, its single
   entry, and — the two that protect the tour — that it names no player and writes no credit.

**What stops the next defect**

5. **A sponsor is opened by something automated, at last.** Two new swept screens (a sponsor
   RECORD, which draws a different shape from a drive's leaderboard, and the kind-filtered list),
   plus `tests/uat/scenarios/coach-sponsor-money-lifecycle.spec.ts` — which walks the MONEY through
   three independent readers: a **pledged** sponsor is visible as a record and adds nothing to the
   hub's money-in, nothing to Budget vs. Actual's actual and nothing to the family's dues; flipping
   to **received** moves all three; flipping BACK unwinds all three, including removing the credit
   row. It also pins that the per-player drive endpoint still refuses a sponsor.
   **RUN AND PASSING against dev (2026-08-15).** ⚠ Its FIRST execution failed twice, on its own
   fixture — a NOT-NULL column the fixture omitted, and a dues row read with the wrong shape
   (`playerId` where the payload nests `player.id`). Both would have been invisible in review, and
   the second is the dangerous kind: a `find` that misses returns `undefined`, and `undefined === 0`
   would have satisfied several "adds nothing to the family's dues" assertions for the wrong
   reason. **A test that has never been executed is not coverage** — it is a plan to have coverage.
6. **The budget-line guard proves what it claims.** The mention check stays (it catches a reader
   that never heard of the column) and a second rule joins it: a kind compared to a LITERAL
   anywhere outside `lib/coach-budget-totals.ts` fails the build, including the database twin
   `.eq('line_kind', …)`. It has a self-test that asserts it still recognises all five shipped
   offences and still passes correct code. **It found two live comparisons on its first run** —
   both in the budget form, now routed through the shared reader (the long kind hint became an
   exhaustive `Record`, so a fourth kind is a compile error rather than a copy gap).
7. **Five siblings, not three, now state their season.** `tests/unit/season-scoped-lookup-guard.test.ts`
   flags any season-keyed table addressed by `id + team_id` without `program_year_id`. The three
   the review listed by hand are fixed (evaluation sessions, lineup templates, the practice recap)
   — and the guard immediately found **two more nobody had listed**: the practice PLAN writer and
   the per-event session read.

## 8b. `/review` on the follow-ups — what it found

High-risk funnel, four lenses (correctness · security/tenancy · data & contract · regression).
**Seven confirmed, six fixed.** The two that matter both have the same shape as the defects §6b
recorded, which is the point worth keeping.

### ⚠⚠ A `CREATE OR REPLACE` BUILT FROM THE WRONG ANCESTOR (Critical — fixed)

Migration 239 extended `merge_rep_team_tags` to re-point the new fundraiser links, and built its
replacement from **migration 184**. But **migration 221** had already replaced that function since,
adding three more lanes — drills, plan templates, focus-area goals — and an **org-mismatch guard**.
`CREATE OR REPLACE` swaps the whole body, so 239 silently deleted all four.

The blast radius, had it shipped: merging two tags would CASCADE-delete every drill link and every
plan-template link on the loser, NULL every player's focus-area grouping, and let two org-shared
tags from **different organizations** merge cleanly — while reporting success. That is verbatim the
failure this migration's own comment warns about for the money-in lane. It was applied to dev before
review; **the dev function has been repaired and verified live** (all six lanes + the org guard).
The rule now sits in the migration: take the HIGHEST-numbered definition, never an older one.

### ⚠ THE NEW GUARD'S COVERAGE WAS ITSELF A HAND-KEPT LIST (High — fixed)

`season-scoped-lookup-guard` shipped with eight table names typed from memory. The live schema has
far more carrying a program year — and one of the omitted ones, **game moments**, held a live
instance of exactly the defect the guard exists to catch. It reported "no offenders" over a set that
excluded the offender: the same decay as the convention it replaced, wearing a test's clothes.

It now **derives its table set from the committed schema snapshot**, so a table gains protection the
moment a migration gives it a season. On the first run of the widened version it found a **seventh**
case (the moments list read). Both are fixed; **five siblings became seven.**

### Also fixed

The budget-line guard missed `switch (kind) { case 'funding': … }` and `{ funding: … }[kind]` — the
two shapes `=== 'funding'` becomes when someone tidies it up, both carrying the identical defect;
both are now banned shapes with self-tests, and the correct *named* exhaustive `Record` is pinned as
a must-pass so the guard cannot push authors back to the ternary. Plus a PATCH response that carried
`tagIds` only when the request happened to edit tags (a sometimes-present field is worse than an
absent one), and a prod guard on the new money-writing UAT spec.

### ⚠ THE SPONSOR CHIP WAS NEVER BLUE (Medium — fixed via `/design`, decision logged)

The rendered sweep, able to see a sponsor for the first time because this pass put one in the
fixture, reported the **Sponsor chip at 4.18:1 against the card ground at 361/390** — under the
4.5:1 AA floor. One line explained both halves: the coach warm gate remaps
`--blueprint-blue → --home-olive`, so the "blue" chip rendered **olive**, on an **olive-tinted**
ground — an AA miss *and* the reason the owner's "blue for sponsorships, green for drives" ruling
was silently not delivered (the sponsorship rail dot was the same olive as Budget vs. Actual's).

Fixed by moving the chip and the rail dot to **`--info`** — the warm palette's real blue — rather
than by touching `--blueprint-blue`, whose warm mapping carries the whole portal. **Re-measured on
the served page: gone at 361 and 390.** Full reasoning and the standing rule
(`--blueprint-blue` / `--logic-lime` / `--primary-light` all mean OLIVE in this portal; a surface
that means blue must say `--info`) are in `memory/design_decisions.md`, 2026-08-15.

**Owner ruling 2026-08-15, taken with that fix: a dot is the colour of the chip you'll see when you
arrive.** Sponsorships and Allocations therefore share blue, adjacent in the in-season rail, and
that is accepted rather than worked around — the row NAME is the information and colour is already
forbidden from being the sole carrier. The rail's old "money-direction lane" comment is superseded
(it would have made Sponsorships green and identical to the Fundraisers row above it, which is the
one thing the split exists to prevent).

**Also refuted and dropped:** an "empty season shows a pointless Show-everything link" (that branch
cannot render — the empty state owns the zero case), and `CREATE POLICY` non-idempotency (matches
181/184 convention exactly).

**Noted, pre-existing, its own work:** `merge_rep_team_tags` is `SECURITY DEFINER` and granted to
`authenticated` with no ownership check inside it (migration 221). Practically bounded by RLS —
another org's tag ids cannot be enumerated — but the guard belongs in the function, not in the
callers.

### Verified on dev (2026-08-15)

`typecheck` ✓ · **1954/1954 unit tests** ✓ (both new guards among them) · `check:demos` ✓ on every
sponsorship assertion, including the three tour pins · dictionary + snapshots refreshed for mig 239 ·
**`coach-sponsor-money-lifecycle.spec.ts` RUN AND PASSING** · rendered sweep clean on
`coach-sponsor`, `coach-sponsors-list`, `coach-fundraisers` and `coach-accounting` at 361/390/1440,
with the one remaining finding a **known-accepted pattern under a new label** (see below).

### What is left

- **Nothing is committed.** The tree also carries two other sessions' work; every file here is
  staged-clean and separable.
- **Migration 239 is DEV-ONLY** (applied to dev 2026-08-15, and its merge-function block re-applied
  after review). It must reach prod BEFORE the code that reads `rep_team_fundraiser_tags` is
  promoted, or prod 500s.
- **Owner QA** — ledger **§30** (walk §24 first if it is still owed; §30 assumes a team that
  already has both a drive and a sponsor).
- **The layout baseline needs one re-init, later.** Seeding a sponsor produced a new
  `a·Northside Physio` tap-floor entry that is the SAME accepted decision as the baselined
  `a·Chocolate sale` / `a·Bottle drive` (24px name links at 361) — the baseline is keyed on an
  element's visible LABEL, so new fixture data reads as a new finding. Deliberately NOT re-inited
  here: `--init` rewrites the whole file, a concurrent session is mid-change in it, and doing it now
  would bake that session's sidebar tap-floor regressions in as "accepted".
- **A full-suite `check:layout` has not been run** — an earlier attempt aborted on the memory floor
  (a real abort, not a pass). The sponsorship screens were swept scoped instead and are clean; the
  full sweep wants a restarted dev server.
- **Its own work:** `merge_rep_team_tags` should carry its own ownership check (see above).
