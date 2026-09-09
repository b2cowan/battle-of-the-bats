# Coach Money — the item names a money-in row too

**Status:** direction approved by the owner **2026-09-09** · **NOT BUILT** · mockups owed before any
code (per the standing mockup gate).
**Raised by:** the owner, 2026-09-09 — opening a seeded fundraising line that read **Chocolate sale**
on the plan while its editor offered no field to name it: *"how did this fundraising item in the
budget get called 'chocolate sale'? I don't see anywhere in the modal where I can select its budget
item name."*
**Owner's ruling, same message:** *"let the item name it everywhere — users can leave the standard
'Fundraising drive' or if they want to create their own 'Chocolate drive' they can create that item
themselves."*

**This FINISHES an existing ruling rather than making a new one.**
[COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md](COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md) (owner, 2026-08-15) already
said it: *"the description should just be a note on the row and not show up on the budget report…
the reason we have these items as selectable is to make sure we can line up across budget and actual
reports, description messes that up."* It was applied to the **cost** side in full and to the
**money-in** side not at all.

**It RETIRES one amendment:** the money-in carve-out in the report rollup (owner, 2026-09-06, QA
§146 — *"a fundraising row should wear the coach's own word"*). See §2, which is the reason it can
go without loss.

**PM brief:** [COACH_MONEY_IN_ITEM_NAMES_THE_ROW_PM_BRIEF.md](COACH_MONEY_IN_ITEM_NAMES_THE_ROW_PM_BRIEF.md)
**Mockups (round 1, 2026-09-09):** https://claude.ai/code/artifact/151bc861-e268-4e06-9236-cf520ece2fc1
— source at [COACH_MONEY_IN_ITEM_NAMES_THE_ROW_MOCKUP.html](COACH_MONEY_IN_ITEM_NAMES_THE_ROW_MOCKUP.html).
**Both rulings given, 2026-09-09** (owner, on the round-1 sheet): **A1** — money-in rows sort
alphabetically once they group by item, one rule for the whole table. **B2** — a merged sub-line with
no note takes its SCHEDULE as its name rather than echoing its parent's word.

⚠ **B2 NEEDS ONE REFINEMENT THE DRAWING COULD NOT SHOW, and it is not a reversal.** Every line row —
sub-lines included — already renders its schedule twice: once in the **When** column and once as a
chip under the name on a phone. Naming a note-less sub-line by its schedule as drawn would print
"Oct" **three times on one row**. So the rule is: *a note-less merged sub-line takes its schedule as
its name, and its When cell and phone chip are suppressed on that row* — the answer has moved into
the name. One appearance, no echo, and on a phone it is where the answer already lived.

⚠ **B2 APPLIES TO COSTS TOO, and the twin is live today.** The note-less fallback is shared, and the
UAT fixture's *Entry Fees* row has **two** note-less cost sub-lines that both currently read
"Entry Fees" under a parent reading "Entry Fees". Fixing only the money-in half would leave the same
defect on the surface the money-in half is being aligned TO. (The round-1 sheet drew the cost
reference with notes on both sub-lines, which is the tidier case and not what the fixture holds.)

## ⛔ BLOCKED — a concurrent session owns these files right now (2026-09-09)

**Do not start this build until the working copy is clear.** A parallel session built
**"The category is the shelf, on both sides, on every surface"** (owner ruling 2026-09-09, mockup
`728dcb1e`; plan `COACH_BUDGET_CATEGORY_IS_THE_SHELF_PLAN.md`) and it is **on dev, uncommitted** —
~1,000 changed lines across the budget panel, this rollup, the plan exports, the periods view, Budget
vs. Actual and their tests, still growing while this was written.

**It overlaps at the same level of the same functions**, so the anti-collision procedure in
`AGENCY_RULES.md` (stage explicit pathspecs, verify with `git show --stat`) **cannot separate the two
changes** — they would land inside one function in one file. One edit was made here and reversed by
hand rather than by `git checkout`, which would have destroyed their work.

**It also changes this plan's own facts**, and both corrections are load-bearing:

1. **§3.1 is out of date.** The money-in sections are no longer grouped by KIND — that session moved
   them to the **CATEGORY** the line was filed under, exactly as costs are. The section headings
   happen to read the same (*Fundraising*, *Sponsorship*), so the round-1 mockup still stands, but
   this work now nests **item rows inside category groups**, not inside kind groups.
2. **§3.4 WAS WRONG about needing an API change.** The cost side does not rely on the stored word
   following the item: it overrides the row's name with the item's name **at render time**. The
   money-in side needs the same treatment and nothing more — **no route change, no migration, and no
   rewrite of any stored word.** Re-filing a line renames its row because the row reads the item, not
   because anything is re-saved.

**Sequencing:** this work goes **after** the category-is-the-shelf change is committed, and starts by
re-reading the funding section as that change leaves it.

### ➕ ADOPTED FROM ANOTHER SESSION'S REVIEW — the round-trip defect

f5's adversarial review (2026-09-09) reported a **pre-existing defect its own change widens, and
declined to fix it inside its diff — correctly**: **funding lines re-import as costs.** A coach who
exports the budget plan and imports it back gets every money-in line silently re-filed as spending,
which inflates planned costs and deletes the funding side of the plan.

**Claimed here** rather than left for f5 to widen its diff over. It belongs to this work: the import
path decides a line's kind from its word, and this change is the one that makes a money-in row's word
the thing every surface reads. Fixing it anywhere else would be a second answer to the same question.

⚠ Verify it against the code before designing a fix — it is reported, not yet reproduced by this
session, and a review finding is a hypothesis until the round trip is actually run.

**The mechanism, as f5 read it (2026-09-09) — two independent faults that compound.** Recorded as
handed over, not as verified here; reproduce before fixing.

1. **The parser mis-reads the band as a category.** `lib/coach-budget-import.ts` treats any
   non-indented row as a category name, so the export's **FUNDING** band heading becomes a category
   literally called *"FUNDING"* and stays the current category until the next real one replaces it.
2. **The route then drops the kind.** `app/api/.../budget-plan/import/route.ts` (~247–268) filters
   `existing` to `!isFundingKind(line_kind)` before matching by description — so each money-in line
   parses correctly and still arrives as a **cost** row.

⚠⚠ **AND THE TEST THAT SHOULD HAVE CAUGHT IT PINS THE WRONG HALF.** `tests/unit/
coach-budget-import.test.ts` — *"reads the plan's own statement export back as lines only"* — asserts
the **parser** (Fundraising → Chocolate Sale comes back correctly) and says nothing about the route.
It is green, and has been. **A round-trip claim needs a round-trip test**: export → import → compare
kinds, not export → parse → compare names. Whatever fix lands here must add that test, or the next
regression is invisible in exactly the same way.

⚠ This defect is **why the mockup's story matters beyond naming**: after this change a money-in row's
identity is entirely its word, so an import that files that word as spending destroys the plan's
funding side rather than merely mislabelling it.

### ✅ SETTLED 2026-09-09 — the report groups by the WORD, and drives are the detail behind it

Verified by a peer session against **committed** code (`git show HEAD`, deliberately not the working
tree, which two sessions are mid-edit in):

- The per-drive loop pushes one derived spend **entry** per drive, each carrying the category and item
  of that drive's own *raising for* line. Those entries enter the rollup with everything else and the
  rollup buckets by **item**. Several drives naming one word produce several entries inside **one
  row**. **Entry ≠ row.**
- **This change's premise holds:** plan side and report side are both grouped by the word, so there
  is no divergence to remove and no shape conflict to design around.

⚠⚠ **THE COMMENT THAT MISLED TWO SESSIONS IS STILL THERE, AND IT READS AS THE OPPOSITE OF THE CODE.**
It is headed *"ONE ROW PER DRIVE OR SPONSOR, NOT ONE POOLED ROW"*; the qualifier is the **next line** —
*"THE TOTAL AND THE PLACEMENT ARE IDENTICAL — these rows carry the same category+item and sum to the
same figure. Only what a coach finds behind it changes."* A heading read without its next line sent
one session to the wrong conclusion and this one to a spurious design worry. **If this work touches
that file, fix the heading.**

**Free coverage this hands the fixture:** on the UAT team **both drives already name the same budget
word**, so the report row that holds Chocolate sale's actual now holds a second record behind it too.
That is the *several records behind one revenue row* case, live today, drawable without constructing
anything. ⚠ It is **not** the same shape as *two budget LINES on one word*, so it does not replace the
plan-side coverage this work still has to add.

### ⚠ A PROCESS FAILURE OF THIS SESSION'S OWN, worth more than the fact

The unverified claim was relayed onward to another session **as fact**, and that session was at its
commit point reasoning about layout. Nothing broke, because the relay was corrected before it acted —
but the correction was luck, not process. **A claim about code that arrives through a third party is
a hypothesis; label it as one when passing it on, or verify it first.** The same standard this plan
already applies to the round-trip import defect, applied one level up: it is easier to hold for code
you are reading than for a sentence someone sent you.

### ⚰ Superseded — the original unverified note

A peer session relayed that *"the report builds one revenue row per drive or sponsor, not one pooled
row"* (citing an owner ruling of 2026-09-07), and concluded the two-lines-on-one-word shape therefore
already has a live example on the revenue side.

**Do not build on that as stated.** Reading `lib/coach-money-derived.ts` gives a different and more
likely picture: since mig 285 *"a drive and a sponsor each name the line they are raising for, so
each record's own total lands on its own row"* — which most plainly means it lands on **the row of
the item it is raising for**, not on a row unique to that drive. That reading is consistent with the
report's row model (`buildCategoryRow` gives one item row that can hold **several** spend entries) and
with the drill-in panel another session is building, whose whole purpose is to show the **records
behind** a row.

**If that reading is right, the visible row is the ITEM and the drives are detail behind it — which
is exactly what this change assumes, and the peer's conclusion does not follow.** But the route that
assembles those entries is mid-edit by two sessions right now, so it cannot be read cleanly.

**Settle it against COMMITTED code before redrawing anything**, and treat neither the relay nor this
note as the answer. A claim about code, passed through a third session, is a hypothesis — the same
standard applied to the round-trip import defect above.

### 🔎 Two tap-target findings, unclaimed by any session

Also surfaced by that review and disclaimed by the session that could have caused them: **Scroll tabs
right** (34px at 390) and **Help: Money** (34px at 768) — both icon-only, both under the 44px floor
the app-wide table standard set. Likely money-hub chrome, possibly pre-existing and merely newly
measured. **Not part of this work**; recorded so they are not baselined as accepted debt by whoever
meets them next (the standing rule: never baseline another session's debt with a null reason).

---

## 0. BUILT ON DEV 2026-09-09 — what actually landed, and where it diverged from the drawing

**Uncommitted at time of writing.** Full suite **3,293 pass / 0 fail**, typecheck clean,
`verify:changed` green end to end, `check:money-report` holds every identity.

Built as planned: money-in rows named by their word and merged when two lines share one; the §146
amendment deleted; both plan exports following (closing the twin-row defect); the editor's false
sentence corrected; **and decision B2 applied to spending as well as money in**, at the owner's
explicit widening.

**Three things differ from the round-3 mockup, all deliberate:**

1. **The fixture's second line is `Spring chocolate round`, not `Bottle drive`.** The drawing put the
   added example on the platform word; the fixture puts **both** lines on the team's own new word
   *Chocolate sale*. That is strictly better coverage — one row exercises the custom word **and** the
   merge **and** both branches of B2 (a noted sub-line, and a note-less one named by its schedule) —
   where the drawn version exercised the merge alone. ⚠ It adds **$600.00** of planned funding to
   that team ($1,950.00 → $2,550.00): a declared coverage change, not housekeeping.
2. **The demo's word is `Raffle proceeds`, seeded as a team-owned Fundraising word.** As drawn, but
   it needed a second fix to work — see §0.1.
3. **No API change, no migration, nothing stored rewritten**, as §3.4's correction predicted.

### 0.1 A latent demo defect this uncovered

The demo seed minted every word it invents with `actual_source: 'typed'`, under a comment reasoning
that "a word this seed invents has no drive or sponsor behind it, exactly as a coach's own word does
not." **True until mig 285 and false after it**: a word filed under Fundraising is a fundraising word
from birth, and the coach's own create panel derives it that way. Left alone, *Raffle proceeds* would
have reported under **Other income** while its row read "Fundraising ·" — the exact live defect the
2026-09-08 ruling names, reproduced in the shop window. The seed now derives the source from the
shelf, which also re-files the hoodie drive's *Merchandise sales*.

### 0.2 Owed

- **`check:layout` has NOT been run** — it needs a dev server and is the heaviest thing in the repo.
  Risk assessed as low rather than dismissed: no baseline key carries any affected row label, and the
  merged money-in row reuses the cost side's already-swept markup (same toggle, same tap floor). **Run
  it before the walk.**
- **Owner QA walk** — the merged money-in row and the schedule-named sub-line are both new shapes.
- **`/simplify` then `/review`**, in that order: this added two new shared rules (`groupByItem`,
  `mergedSubLineName`), which is exactly the diff shape the repo's own rule says to clean first.

## 1. The defect: four surfaces, three answers, one plan

One money-in budget line is read four ways today, and no two of the four agree:

| Surface | Rows keyed on | Row wears |
|---|---|---|
| Budget Plan → **List** | one row per **line** | the stored description — *"Chocolate sale"* |
| Budget Plan → **By period** grid | merged by **item** | the **item** — *"Fundraising drive"* |
| Budget Plan → **export** (CSV/PDF) | one row per **line** | the **item** — so two lines on one item print as **identical twins** |
| **Budget vs. Actual** | merged by **item** | the description when the item holds exactly one line, else the item |

The export's twin rows are a live defect of their own, not merely an inconsistency: a coach with two
fundraising lines on *Fundraising drive* gets two rows that cannot be told apart.

## 2. Why the §146 amendment can go without loss

§146 exists to give a fundraising row the coach's own word. But the field that produced that word —
the money-in **Description** input — was deleted on **2026-08-16** when Category & Item became
required in both directions. §146 was ruled on **2026-09-06**, three weeks later.

**So the amendment has never been reachable for anything a coach can create.** A money-in line saved
through the form today stores the *item's* name as its description; the amendment then reads that
back and prints *"Fundraising drive"* — the exact label the ruling called worse. Only seeded rows and
rows written before 2026-08-16 can show anything else.

The owner's answer restores the intent by a better route: a coach who wants *Chocolate sale* on the
plan **creates that word**, and it then names the row on **every** surface, reports as a fundraising
word from birth, and is available to a drive's *Raising for* field. One record, one name.

## 3. What changes, surface by surface

### 3.1 Budget Plan → List (the only real build)

The money-in sections adopt the cost side's shape, unchanged in every other respect:

- **One row per item**, wearing the item's name.
- **Two or more lines on one item** become an openable group whose total is the sum; the sub-lines
  are named by their **note** ("What makes this line different?"), falling back to the item name.
- Section headings stay as they are — one per money-in kind (Fundraising / Sponsorship / Other
  income). No heading moves.

### 3.2 Budget vs. Actual

Delete the `rowLabel` amendment; a money-in row wears `itemName` like every other row. Row **keys**
already are the item and do not move — the two reports stay lined up.

### 3.3 The plan export (CSV + PDF)

Merge money-in rows by item, matching the List and closing the twin-row defect. The sub-line shape
follows the cost side's, which already exists in this file.

### 3.4 The line editor

- **Save**: a money-in line falls back to the item's name when no description is held, exactly as a
  cost line does — one rule, both directions.
- **Re-filing renames**: changing a money-in line's item renames its row. The client stops sending
  the stale stored word, which lets the server's existing "the item renames the row" branch fire for
  money-in as it already does for costs.
- **The helper text under Category & Item is corrected.** It currently reads *"These name this line
  everywhere"* — false for money-in today, true after this change. It ships **with** the change, not
  before it.

### 3.5 By-period grid

**No change.** It already merges by item and wears the item's name. It is the surface the other three
are being brought into line with.

### 3.6 What a coach uses instead of the deleted field

**Notes.** A note already renders under the row name on the plan, and already names the sub-lines
when two lines share an item. That is the "note on the row" half of the 2026-08-15 ruling, already
built. Nothing new is needed for it.

## 4. What is ALREADY BUILT and must not be re-planned

The owner's second sentence — *"the fundraiser/sponsorship section should allow them to link to the
standard or custom budget items in their respective categories"* — **shipped on 2026-09-08 and is on
production** (migration 285, Amplify job 262; design-decisions entry of 2026-09-08; Owner QA §157).

The shared *Raising for* field serves four doors (New fundraiser, Edit fundraiser, Edit sponsor, and
the recording conversation's new-sponsor branch) and already:

- filters to the record's **own shelf** — a drive sees Fundraising words, a sponsor Sponsorship words;
- offers the shelf's **standard word pre-filled**, never as a question;
- lists the **team's and club's own words** beside the standard ones, each with its tier chip;
- lets a coach **create a new word inline** from the picker (creating a new *category* is
  deliberately refused — a coach-made category reports as other income, so a word filed under one
  would vanish from that very list);
- is re-checked server-side, so the filter is a convenience and not the guard.

**Nothing in this plan touches it.** The only thing this plan adds on that side is that the word a
drive raises for now also names its row on the plan and the report — which is the point.

## 5. Existing stored words

**No backfill, no rewrite.** The stored description column stays as it is and simply stops being read
by any money-in surface. Rewriting it would be a fold rewriting text a coach typed, which the
budget-item machinery explicitly forbids itself elsewhere.

**One exception, and it is not data — it is fiction.** Two seeded worlds show typed money-in words
that would flatten to *"Fundraising drive"* the day this ships:

- **The public coach demo (`riverdale-ridge`, live on production).** Its single funding line reads
  *"Raffle proceeds — team share (estimated)"* on the standard word. After this change a prospect
  reads *"Fundraising drive"* — a real loss of story on a shop-window surface. **Fix in the same unit
  of work:** seed *Raffle proceeds* as a **team-owned Fundraising word** and file the line against it.
  This is strictly better than today: it preserves the sentence **and** demonstrates the custom-word
  path the owner's ruling depends on.
- **The UAT coach fixture.** ⚠ **Corrected 2026-09-09, and the correction is the useful part.** The
  original wording here said "*Chocolate sale* and *Bottle drive* become team-owned Fundraising
  words… several walks and specs open rows by those names." **Only half of that is true, and the
  half that is false is the instructive one.** *Chocolate sale* is a **budget line's** typed
  description ($1,800, noted "Expected team share", split Mar/Apr $900) — it is the row this whole
  change is about. *Bottle drive* is a **fundraising drive record** (20% player rebate); the specs
  that open it by name open the DRIVE, not a budget row. **The team has exactly one money-in
  budget line besides Season interest, and no second fundraising line at all.**

  So the real fixture work is narrower than stated: **create *Chocolate sale* as a team-owned
  Fundraising word and file that line against it**, so the plan keeps reading "Chocolate sale" and
  the fixture demonstrates the custom-word path. Whether to add a **second** fundraising line so the
  merged-row shape has live coverage is a separate, deliberate call — the fixture has no coverage of
  two money-in lines on one word today, which means the shape this change introduces would ship
  unswept. **Recommend adding one** (a *Bottle drive* line is the natural choice, and as of the
  2026-09-09 re-seed that drive now has a real $750 entry behind it). ⚠ Seeding a new record SHAPE
  into the fixture is a coverage change, not test housekeeping — say so when it lands.

  ⚠ **A BOTTLE DRIVE LINE IS NOW TWO-SIDED, WHICH IS BETTER COVERAGE THAN PLANNED.** The 2026-09-09
  re-seed gave that drive a real $750.00 entry at its own 20% rebate, so the team keeps **$600.00**
  and the report counts it. A Bottle drive budget line therefore stops being an inert plan row with
  an empty actual and becomes one with a real actual against it — the merged-row specimen gains a
  variance rather than a blank. **Build and re-draw it against the drive as it now stands**, and
  re-verify the specimen against the fixture before claiming it matches; one round of specimens has
  already been published with invented money and corrected.

  ⚠ **THE SEED FILE IS SHARED BUT NOT BLOCKING — corrected 2026-09-09.** This plan first said the
  work "must not touch it until that lands". That was wrong: the other session's edits sit in the
  credits/drive-entry section and these sit in the budget-plan section, so the file can be staged as
  a reconstructed HEAD+mine blob (the technique in §6) with their working-tree changes untouched.
  **The only true gate on this work is the funding-section rewrite**, where the change edits the same
  functions rather than a different region of the same file.

  Confirmed unaffected by that re-seed: the budget plan itself — no budget line, `line_kind` or
  `FIXTURE_ITEMS` entry changed, so every PLANNED figure the mockup draws still stands. The re-seed
  moved **actuals** (dues +$117.00, fundraising +$600.00), and the plan list draws no actuals column.

Pre-2026-08-16 money-in lines with **no item at all** keep showing their typed word in the
"Not itemized" bucket. They have nothing else to show, and that is already the rule.

## 6. Gates, tests and fixtures

- **Layout invariant sweep** — baseline keys carry an element's **visible label**, so every renamed
  money-in row is a "new" key. Reseed first, then re-baseline; do not `--init` while another session
  is mid-change in that file.
- **Unit tests** — the rollup's §146 tests are deleted with the amendment (they assert the behaviour
  being retired); the periods-view tests already assert the target shape; the export tests gain a
  merged-money-in case that would have caught the twin-row defect.
- **`check:demos`** must stay green, and the demo seed change above is what keeps it honest.
- **Help content** — the Money guide describes what names a budget row. `/docs` after the build.

## 7. Mockups owed before any code (blocking gate, item ONE)

1. **Whole screen, before and after** — Budget Plan → List at desktop width, the money-in band in
   full, so the cumulative effect is judgeable rather than the rows alone.
2. **The ordinary row** — one line on one item, named by the item, with its note beneath.
3. **The merged row** — two lines on one item: the summed head, opened to show its note-named
   sub-lines. This is the shape nobody has seen on the money-in side.
4. **The editor** — Category & Item with its corrected helper sentence, and the Notes field carrying
   the weight the deleted Description field used to.
5. **Phone**, at true viewport width, for 2 and 3 — the money-in band is where the List's name column
   is tightest.

Published as a Claude Artifact, one path across rounds.

## 8. Risks

- **A coach's plan visibly collapses** where two money-in lines share an item — two rows become one
  openable row. Correct, and the same thing costs already do, but it is the change a coach would
  notice first. The mockup's specimen 3 is what settles whether it reads well.
- **Reversing a 3-day-old ruling.** §146 was ruled on 2026-09-06 and is retired here. The reasoning
  is §2, and the design-decisions log records the reversal with it — a ruling that is quietly dropped
  is the thing that comes back as a bug report.
- **The demo's sentence.** Covered in §5 and non-optional; the shop window is the surface where a
  flattened row costs the most.
