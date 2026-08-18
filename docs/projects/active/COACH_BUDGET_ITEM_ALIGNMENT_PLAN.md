# Coach Money — the budget speaks in category + item, and so does spending

**Status:** **ON PROD 2026-08-17, Amplify job 257** · owner QA = ledger **§29**, still OWED and now
run against the live site.
**Migration:** **240 applied to production 2026-08-17** (with 236–250 as one sequence). The queue is
empty through 250 and both schemas are byte-identical — the "must reach production first" step is
DONE. Deployment state's single home stays the release history + the Owner QA Ledger.
**Raised by:** the owner, 2026-08-15 — *"the budget should only group by 2 levels, category and item.
The description should just be a note on the row and not show up on the budget report… the reason we
have these items as selectable is to make sure we can line up across budget and actual reports,
description messes that up."*
**Mockups:** https://claude.ai/code/artifact/945391e9-3c17-46ff-b855-8c67fcd5f117
**Decision that preceded it:** https://claude.ai/code/artifact/d59557d4-a469-45a3-a100-c5cb68e9ca43
**PM brief:** [COACH_BUDGET_ITEM_ALIGNMENT_PM_BRIEF.md](COACH_BUDGET_ITEM_ALIGNMENT_PM_BRIEF.md)
**Supersedes:** the expense→budget-line link in
[COACH_BUDGET_LINE_ALIGNMENT_PLAN.md](COACH_BUDGET_LINE_ALIGNMENT_PLAN.md) — see §2, which is the
first thing to read.

---

## 1. The ruling, in the owner's words

Four sentences, and everything below follows from them:

1. **A budget groups two levels and no further: category, then item.**
2. **The item names the row.** The description is a note, and never appears on the report.
3. **Two lines on the same item sum together** into one row.
4. **Actuals carry the item too**, so a coach can see *"any item that was charged but not budgeted
   for"*.

The screen that proved the point: a coach picks the item **Entry Fees**, and the plan shows a row
called **"test"** — the taxonomy they chose is invisible, the free text they typed is the identity,
and nothing downstream can line up on it.

## 2. ⚠ This supersedes the expense→line link built on 2026-08-15

**Read this before the rest.** The sibling plan's §3 chose to link spending to a **budget line**
rather than to a category+item pair, and its whole argument was:

> Two lines that share a pair — "Tournament entry" under Tournaments, twice, for two different
> tournaments — are **ambiguous**. Actuals can't be split.

**Ruling 3 above dissolves that argument.** If two lines on one item are *summed into one row*, there
is nothing to split and nothing to be ambiguous about. The pair is then a complete answer, and the
line pointer becomes a second classification on the same record that can only ever agree or drift.

So the expense→line link is **retired and replaced by category + item on the expense**, and with it
goes the whole "What is this against? / Not in the budget" control. **Planned-ness stops being
something a coach declares and becomes something the product works out**: a budget line exists for
this category+item, or it doesn't.

**What survives from that work, unchanged and load-bearing:**

- **The arithmetic that places spending into a row's payment periods.** It moved into the rollup
  module and now works on a MERGED schedule (two lines on one item), which is why
  `lib/coach-budget-line-actuals.ts` and its tests were deleted rather than kept: nothing imported
  them, and an unused module with thirty passing tests reads as live code.
- **The report's category totals, the export, and the demo's linked seeding**, which all move from
  a line key to an item key without changing shape.
- **The ownership check** — the team/season/cost-kind refusal — which became the same check against
  an item id, in `lib/coach-budget-items.ts`.

**What is thrown away:** the picker on the money form, the two link columns on the expense row
(migration 238), and the "Not in the budget" escape. Migration 238 is **on dev only and has never
reached production**, so this is a dev-only reversal with no customer impact — which is the argument
for folding the two plans into one release rather than shipping 238 first. See §8.

## 3. Item vs. description, settled

The confusion the owner named — *"I am still not sure the difference between the description and the
item"* — was real, and it was the product's fault: the form asked for both and then displayed the
wrong one.

| | On a **budget line** | On an **expense** |
|---|---|---|
| **Category + item** | **The name.** Required. | **The classification.** Required. |
| **Description** | **Retired** — Notes carries anything worth saying | **Kept, required** — one real transaction needs its own name |
| **Notes** | Optional, private, never on a report | Optional, unchanged |

The principle, stated once so it stops being re-litigated: **a budget line is an account, an expense
is a transaction.** Accounts are named by the chart they belong to; transactions are named by what
happened. Six entry fees share an item; no two of them share a description.

⚠ **The one exception is money coming IN, and it is the owner's own prior ruling** (2026-08-13):
a `funding` or `sponsorship` line gets **no category and no item**, because a spending taxonomy has
nothing sensible to say about a bottle drive. Those lines are named by their **description**, which
therefore stays and stays required *for them*. One free-text field per line either way; which field
it is depends on the kind — which is exactly how that form already behaves, since the kind is asked
first and changes everything under it.

## 4. What the numbers say about today

Measured against the live dev database, 2026-08-15:

| | |
|---|---|
| Cost lines | **40** |
| …carrying an item | **3** |
| …carrying **no** item | **37** |
| Item library | 42 entries, **all platform defaults** |
| Items ever created by a club | **0** |
| "Misc" entries in the library | **9** |

**The item exists and nobody uses it**, because nothing has ever depended on it. That is the whole
reason the description became the identity by default. Two consequences for this plan:

- **The picker must stop being skippable.** It currently defaults to "Misc" the moment a category is
  chosen. If the item names the row, a lazily-picked line reports as *"Tournaments / Misc"* — worse
  than today. **Misc is retired as a choosable item** (§6.2).
- **The library has to be worth picking from.** 42 platform defaults are about to become the only
  vocabulary a season can be planned in. They need a review pass against a real season, and the
  team tier in §5 is what makes the gaps survivable.

**The 37 item-less lines are all seeded test data** (owner, 2026-08-15) — re-seeded, not migrated.
No customer plan is rewritten and nothing is guessed.

## 5. Three tiers of item, and none of them leak sideways

Owner ruling 2026-08-15: *"custom items are team wide but should be viewable by the club, we
shouldn't populate 1 team's list with another team. Perhaps we can have an org create ones that they
want to send to all teams but not from team to team."*

| Tier | Who owns it | Who sees it in their picker |
|---|---|---|
| **Platform** | us | everyone |
| **Club** | an org admin | every team in the club |
| **Team** | a coach | **that team only** |

- **One direction only.** A team's item never appears in another team's picker on its own. The club
  can **see every team's items** on an admin screen and **publish** one to all teams — which is how a
  club standardises when it notices the same thing invented twice.
- Publishing is a promotion, not a copy: the item becomes club-owned and every team gets it. Lines
  already pointing at it keep pointing at it.
- ⚠ **The reverse is deliberately impossible.** There is no "unpublish to one team" — an item in use
  by a team's plan cannot be taken away from it.

Categories already carry a scope (`org` / `team` / `both`); items carry none, so this is where the
migration goes.

## 6. Build

### 6.1 Migration — the item's owner

`budget_items` gains **`team_id`** (nullable, FK → `rep_teams`, **ON DELETE CASCADE**).

- `org_id NULL` = platform default (unchanged). `org_id` set + `team_id NULL` = club-published.
  `org_id` + `team_id` set = that team's own.
- **CASCADE, not SET NULL**: a deleted team's private vocabulary must not silently become the club's.
  ⚠ Budget lines pointing at it keep their own copy of the name (§6.3), so a plan never loses its
  row label to a team deletion.
- Same unit of work: `DATA_DICTIONARY.md` + `npm run refresh:snapshots`.

### 6.2 The budget line form

- **Category and item become required on a cost line.** The save path's "fall back to the item name
  when description is blank" rule goes away with the description itself.
- **"Misc" retires from the coach picker.** It stays in the database for historic rows; it is no
  longer offered. A coach who genuinely has a small uncategorised cost creates an item for it or
  files it under one that fits — a report row called "Misc" answers nothing.
- **Description is removed from cost lines.** Notes stays, optional, labelled as the note it is.
- Money-in lines are **untouched** (§3).
- ⚠ **The inline "+ add custom item" now creates a TEAM item**, not an org one. The helper text under
  it changes accordingly — today it promises the item is "saved to your org's library and become
  selectable for all coaches", which becomes false the moment §5 lands. That sentence is the
  single most likely thing to be missed in this build.

### 6.3 The plan, the report, and everything that reads a line

- **The plan list groups category → item**, summing lines that share an item, with the line count as
  a quiet caption (`Entry fees · 2 lines`). Expanding shows the individual lines with their notes and
  amounts, so a coach can still edit one of them.
- **Budget vs. Actual groups category → item.** An item with a plan compares against it; **an item
  with spending and no plan is its own flagged row** with a dash where the budget would be — the
  "charged but not budgeted" view that started this.
- The month grid, all three exports, and the importer move from a line-name key to a **category+item**
  key. ⚠ The importer currently matches an incoming row to an existing line **on category and line
  name**; it matches on category + item after this, and its template's "Line" column becomes "Item".
- ⚠ **A row's period schedule is the union of its lines' periods**, summed by date. Two lines on one
  item with different schedules is a real shape and the grid must not double-count it.

### 6.4 Spending carries the item

- The expense/payable form asks **category + item** (both required) and keeps **description**
  (required — §3).
- **The budget-line picker and "Not in the budget" are removed.** Planned-ness is derived.
- An item that has no budget line shows an honest entry-time note — *"not in your budget; this will
  show on the report as spending you didn't plan for"* — which is today's warning, one level finer.
- The server validates the item against the team's visible library (platform + club + own team), by
  the same rule `coach-budget-line-link.ts` applies today, and **derives the text category from the
  item** so the two can never disagree.
- ⛔ **Migration 238's two columns are dropped** in the same migration that adds the item columns.
  They are dev-only (§2) and carrying two classifications on one record is the drift this plan
  exists to remove.

### 6.5 Tests

- Two lines on one item **sum into one row**, and their periods merge by date without double-counting.
- An item with spending and **no** budget line appears as a flagged row, not in a loose list.
- An item from **another team**, or one a team can't see, is **refused** on both the line and the
  expense write paths.
- A **club-published** item is visible to every team; a **team** item is visible to one.
- The period-placement rules carry over to item rows and to a merged schedule (see §10.1).

## 7. What this costs, honestly

- **Every coach's plan changes shape on the day it ships.** Rows they knew by their own words are
  renamed to their item. With 37 seeded lines and no real customer plans in play this is free *now*
  and gets expensive fast — which is the argument for doing it before the coach portal has real
  budgets in it, not after.
- **The library becomes load-bearing.** If the 42 defaults don't cover a season, every coach's first
  action is inventing items. §5's team tier makes that safe rather than pleasant; a defaults review
  is a real task inside this build, not a follow-up.
- **A second dev-only migration is discarded** (238). Cheap, and cheaper than shipping a
  classification we are about to replace.

## 8. Sequencing

**Recommended: fold the two into one release.** The line-link work is on dev, uncommitted, and its
migration has never reached production. Shipping it and then replacing it in the next release would
put a control in front of coaches — *"What is this against?"* — and take it away again.

Order inside the build: **§6.1 → §6.2 → §6.3 → §6.4 → §6.5**, because the library's tiers have to
exist before the picker can be made required, and the picker has to be required before the report can
trust the item.

## 9. Follow-through

- **Help docs** (`/docs`): the budget and expenses guides both describe the category picker and, as of
  this week, the budget-line picker. Both change.
- **Demo sandbox** (`riverdale-ridge`): every seeded budget line needs an item, and every seeded cost
  needs a matching one — including **one item deliberately spent on and never budgeted**, so the new
  flagged row is visible on the screen a prospect opens.
- **Owner QA:** the two-lines-one-item sum, the not-budgeted row, and the team/club item boundary are
  the three that matter.

## 10. As built (2026-08-15)

Everything in §6 landed. Five things are worth recording because they were decided during the build,
not before it.

### 10.1 One rule module, two screens

`lib/coach-budget-rollup.ts` owns the category → item grouping for the report route **and** the plan
list. The plan page used to group by category and list lines by description; it now calls the same
function the report does, so the two cannot group one plan two different ways — which is the entire
point of making the item the key.

### 10.2 The Unbudgeted section is gone, not moved

§6.3 said unplanned spending gets its own flagged row. As built, that **replaced** the separate
"Unbudgeted Expenses" block at the foot of the report rather than sitting beside it — otherwise the
same dollars would be listed twice, once in place and once below. The season total is now simply the
sum of the categories, and `unbudgeted` is reported as a figure to NAME rather than a second addend.
⚠ That is a genuine arithmetic change: the old total added the unbudgeted list on top, because those
rows were outside the categories. QA §29 Part C checks it reconciles.

The **Recategorize** modal went with it. It existed to move an expense onto a real category so it
would leave that list; there is no list, and the fix is now picking the item on the cost itself —
the same control that files it correctly in the first place, rather than a second half-strength
editor that could only ever set the coarser of the two levels.

### 10.3 The importer creates the item it needs

§6.3 said the importer moves to a category+item key. As built it goes further: **a sheet row whose
name is not in the library creates a TEAM item from it.** Without that, an imported line would
arrive with no item, be named "Not itemized", and be invisible to the very report it was imported
for. It is the same thing a coach does in the picker, done by the door they actually used.

### 10.4 Publishing absorbs the twins

§5 said a club admin can publish a team's item to everyone. As built, publishing also **repoints
every other team's identically-named item in that category onto the published one and deletes the
duplicates** — repointing first, because the FK is ON DELETE SET NULL and deleting first would strip
the item off a coach's budget line. Without this, publishing "Provincials entry" while two teams
kept their own would leave three identical names in one category and split one item's spending
across three report rows: the exact fragmentation the tiers exist to prevent, arriving through the
door meant to fix it. The confirmation says how many were absorbed and how many lines moved.

### 10.5 The demo shows the team tier, deliberately

The 12U's "Practice Gear" is **not** a platform default. The seed creates it as a team item, so the
sandbox demonstrates the tier a coach actually reaches for when their season needs a word we did not
think of — and shows it belonging to one team rather than to the whole club. The 14U's team-photo
cost now lands as its own flagged **Events / Photo Day — not budgeted** row, which tells that beat
better than the loose list it used to fall into.

### 10.6 ⛔ Still open — the platform library

§4 called for a review pass against a real season. **It has not been done.** The library is 24
choosable items across 7 team-visible categories, which is serviceable, but two placements look
wrong now that these names are budget row headings: **"Uniforms" and "Travel" sit under
Tournaments** while Team Gear separately offers Jerseys, Hats, Balls, Bats and Bags. That is a
shared taxonomy every club sees, so it is flagged for the owner rather than restructured quietly.
The team tier makes the gaps survivable in the meantime: a coach adds what they need and it stays
theirs.

### 10.7 ⚠ Caught by `/simplify` — the Months view was grouping the plan differently

The altitude pass found the one real miss: **Budget vs. Actual's Months view was still built from
raw budget lines**, so a team with two lines on one item read as ONE row under Categories and TWO
under Months, on the same screen, for the same plan. §6.3 asked for exactly this and it had not been
carried through — the category table, the exports and the importer all moved to the item key; the
month grid did not.

**The fix is structural rather than a second implementation of the rule:** the grid's rows are now
derived from the rollup's own output, so the SUM ruling, the merged payment periods and the
"not budgeted" rows all arrive already applied, by the one module that owns them. Unplanned items
are included with a zero budget on purpose — their category exists on that screen and their spending
needs a row to land in. QA §29 Part C now has a step that flips between the two views and compares
the row counts.

Also applied from the same pass: the report stops resolving each cost's taxonomy twice; the item
list ranks tiers through the shared predicate rather than a local copy; the plan list and the money
form stopped recomputing their grouping on every keystroke while a form is open; the report's
payload no longer ships the raw lines and costs behind every row (only the plan page reads those,
and it computes them locally); ~110 lines of CSS orphaned by the deleted Unbudgeted section were
removed; and the publish confirmation now names the recorded costs it moved, not just the budget
lines.

## 11. What `/review` found, and what was fixed (2026-08-15)

Five adversarial lenses over the diff. **Twelve findings survived triage; all twelve are fixed.**
Security came back clean — no cross-team or cross-club leak, no bypassed gate, and the publish
action verifies ownership before it writes.

### 11.1 ⚠⚠ Publishing an item could silently strip other teams' classifications

The publish action repointed other teams' budget lines and costs onto the surviving item and then
deleted the duplicates — **without checking whether the repoint had succeeded.** Both link columns
are `ON DELETE SET NULL`, so one failed repoint followed by the delete quietly emptied the item off
those rows and dropped them into "Not itemized", while the admin read a success message. A single
failed request did it; no concurrency needed. **Now: the destructive half only runs when the
repoint is confirmed, and each failure mode reports exactly what did and did not happen.**

### 11.2 ⚠⚠ A club admin could delete a team's own item

The PATCH beside it was hardened during the build; the DELETE was not — the textbook half-applied
rule. Same blast radius as 11.1, reached from the screen that lists every team's items. **Now
refused, pointing at publishing as the sanctioned action.**

### 11.3 A category nobody budgeted for could split into two identical rows

Category id↔name pairings were learned only from budget LINES, so a category with no line had no
pairing: a cost carrying its id bucketed one way, a sibling carrying only the typed text bucketed
the other, and "Officials" appeared twice — $2,000 and $600 — for one $2,600 category. The season
total stayed right; the breakdown a coach reads did not. The two rows also shared one expand
toggle. **Now pairings are learned from the spending as well; regression-tested both ways (it must
still keep two genuinely different categories apart).**

### 11.4 The description went stale when the category changed

Pick a category and item → the description pre-fills with the item's name. Change the **category**
→ the item clears but the description does not → pick a new item → the control can no longer
recognise the text as its own pre-fill, so it leaves it. "Entry fees" saved against "Umpire fees" —
the exact name/thing mismatch this whole plan exists to remove, reintroduced through a path §6.4
never considered. **Now clearing the item clears an untouched pre-fill with it; words the coach
typed are still never touched.**

### 11.5 "What is this? *" was drawn required and enforced nowhere

The asterisk was there, the comment above the field asserted it, and neither the form nor the
server checked. A coach could save a cost with no category and no item at all, landing in the very
bucket this change exists to empty. **Now enforced on both, and on CREATE only** — an edit may
legitimately clear it, and every pre-240 row has no item, so refusing them retroactively would lock
coaches out of their own history.

### 11.6 An import could silently drop an item link

The auto-create insert discarded its error, so losing a race (a second tab, or a coach adding the
same item mid-import) left the row written with **no** item and reported as a clean import. **Now
it takes the winner, and refuses the row rather than importing something nameless.**

### 11.7 The picker still promised a coach's item would go club-wide

The copy two separate code comments predicted would be missed, missed. **Now says the item stays
with this team unless the club shares it** — and says the opposite, correctly, in the admin's own
picker.

### 11.8 Smaller, all fixed
- A stale tab could PATCH a **cost** line back to no category at all — a state the create path
  refuses. Now guarded on the kind the line will HAVE after the patch.
- The losing side of a racing "add custom item" got a dead-end 409 instead of the existing item the
  code's own comment promises. Now handed the winner.
- A club admin renaming a shared item left **three surfaces** printing the name captured when the
  line was written (the period grid, the budget-lines export, the plan's expanded lines). The first
  two now read the live item name.
- The month grid's "this category was never budgeted" flag had silently become always-false, because
  every spending category now arrives with a row. Latent (nothing renders it yet) but a promise the
  module still made. Now carried explicitly.

### 11.9 The UAT fixture was seeding pre-240 data

The rendered layout sweep was reading a plan of **"Not itemized"** rows, so those screens were not
exercising the design at all. The fixture assigned categories *by position*, which also meant a dome
block sat under Tournaments. **Now both category and item resolve BY NAME, and the fixture repairs
old rows rather than skipping them** — it is what `check:layout` self-heals with, and a half-old
fixture reporting green is the silent half-truth that file exists to end.
