# Coach Money — one taxonomy, three kinds of entry, two report shapes

**Status:** approved by the owner 2026-08-16 · **BUILT ON DEV 2026-08-16** · migration **243** ·
owner QA **§38**

---

## 0. What was built, and the three things this plan got wrong

Everything in §3 and §4 is implemented, and the money-back plan's §2/§3/§4.3/§6 are inherited whole.
The grouping rule lives in `lib/coach-budget-rollup.ts` (extended, not duplicated) and produces both
shapes from one pass; `lib/coach-money-derived.ts` owns §4.1. New table `rep_team_money_in`, new
column `budget_items.direction`, both documented in the Data Dictionary.

⚠ **Three claims in this plan turned out to be false. They are corrected in place below; recorded
here so a later reader knows the plan was edited after the fact rather than written this way.**

1. **§3.6 said "no new category is required." It was wrong.** *Fundraising* and *Sponsorship* did
   not exist — only *Fundraising Costs*. Migration 243 **renames Fundraising Costs → Fundraising**
   (so the drive's proceeds and the drive's printing share one category, which is what the
   by-activity lens exists to compare) and **adds Sponsorship**. Two seeds referenced the old name
   by string and were updated with it.
2. **The report's view is remembered PER DEVICE, not in the URL.** The build prompt said
   `?view=categories` had to keep working; it is `localStorage`, and what actually had to keep
   working is the stored value — `categories` now resolves to **Statement**. The layout screens
   address `?section=budget-vs-actual`, which is untouched.
3. **The library item ships as "Officials", not "Umpires & officials."** Migrations 241 and 242
   exist because diamond-only words reached basketball clubs; "umpires" is one of them. The name is
   the only deviation — it is still a Tournaments-category cost, which is what lets the
   by-activity lens weigh a hosted event's officials against that event's revenue.

**Two known limits, accepted with reasons (from `/review`, 2026-08-16):**

- **Two coaches, one narrow window.** The "one row, one source" refusal reads the plan and then
  writes. If a second coach changes a budget line's kind to fundraising in the sub-second between,
  a typed income record can still land on a row that is now derived. Nothing in Postgres can
  express the constraint, and the result is visible and deletable on the Money in tab rather than
  silent — so it is accepted rather than papered over with a second read that narrows the window
  without closing it.
- **Two tabs editing one arrival clobber each other.** The last save wins, with no conflict warning.
  This matches what an expense already does, so the fix belongs to both or neither — a money-in-only
  version would be an inconsistency dressed as a safeguard. Worth raising in the Money-tab planning
  session (§10).

**Two things deliberately NOT done, and they are the owner's calls, not oversights:**

- **The screen is still called *Expenses & Payables*** while now holding a *Money in* tab. Renaming
  it reaches the Money hub tab, the money rail, the help guide, the demo tour and the layout
  baseline — a decision worth making on its own rather than folded into a release this size.
- **A money-in record carries no payment method, payee or money tag.** Those describe money going
  out to somebody; inventing money-in equivalents here would have been three fields nothing reads.

---

**Mockup (binding):** https://claude.ai/code/artifact/ee76cc79-ef74-4b78-8b03-5cf28a7f4d37
**PM brief:** `COACH_MONEY_IN_TAXONOMY_PM_BRIEF.md`
**Build prompt:** `COACH_MONEY_IN_AND_BACK_BUILD_PROMPT.md`

⚠⚠ **THIS PLAN ABSORBS `COACH_MONEY_BACK_ON_A_COST_PLAN.md`.** They are one release (§7.1). That
plan remains the **binding detail** for how a refund behaves — do not re-specify its rules here, and
do not build it separately.

⚠ **Two superseded drafts are recorded in §6 and §8 so nobody rebuilds them.** A separate revenue
list (dead) and a direction column on the report (dead).

---

## 1. The rule

**Money arriving is not one thing, and the coach — never the product — says which it is.** A coach
answers *what kind of entry is this*, then the same two questions a cost already asks, and the report
does the rest.

| The coach's answer | Accounting name | Where it lands |
|---|---|---|
| **A cost** | expense | its category → item row, under Expenses |
| **Income** | revenue | its category → item row, under Revenue |
| **Money back on something** | contra-expense / contra-revenue | **nets into the row it repaid** |

⚠ **A refund is NOT income.** A refunded tournament entry means the team spent $150 less, not that it
earned $150. Booking it as income overstates both sides and corrupts every per-item cost figure
downstream. This is standard treatment and it is also the money-back plan's existing rule.

⚠ **Only the coach can tell a grant from a reimbursement** — they arrive as the same amount, from
the same club, on the same day. Nothing in the data distinguishes them.

## 2. What exists and what is missing

| | Money out | Money in |
|---|---|---|
| Budget line | category + item (2026-08-15) | **no category, no item** — a typed description is the row |
| Logged actual | expense / payable: category + item | **no way to log one at all** |
| Money back | **nowhere** | **nowhere** |
| Reported as | grouped by category → item | one total vs one total |

Today's money-in actual is a single derived number — realised fundraiser entries, team share,
receipts only — compared against the sum of every funding line. That is exactly the shape costs were
in before 2026-08-15.

## 3. What gets built

### 3.1 The money form asks what kind of entry it is

**A cost · Income · Money back on something** — replacing the current two-way switch. Everything
below the question is unchanged: category, item, amount, date, optional description.

⚠ **Payable is a timing attribute, not a fourth kind** — decide deliberately how it composes with
this switch and say so in the code. Recommendation: it stays where it is on the cost side; a
scheduled *income* is a budget line, which the plan side already models.

🎯 **"Money back on something" points at ANY item, and that is free correctness.** Point it at a cost
and it reduces the cost; point it at an income item — a registration refunded to a visiting team —
and it reduces the income. No fourth question, and contra-revenue is handled without anyone
designing for it.

### 3.2 Money-in budget lines gain category + item

Through the **same picker**, the same three-tier ownership (mig 240) and the same sport rail
(migs 241/242). Both money-in kinds (`funding`, `sponsorship`) must keep going through
`isFundingKind()` / `normalizeBudgetLineKind()` — the guard test over the whole source tree applies.

⚠ **Do not add a kind for direction.** Direction is `isFundingKind()`; the coach-facing switch is its
name. Sponsorship stays a distinct money-in kind because sponsor records depend on it.

### 3.3 A money-in actual becomes loggable

The genuinely new record. Same shape as an expense, lands in the same reporting path, so an income
row gets an actual the way a cost row does. ⚠ **Except where an actual is already derived** — §4.1.

### 3.4 Money back on a cost

⛔ **Specified in `COACH_MONEY_BACK_ON_A_COST_PLAN.md`. Do not restate it here.** Its rules are
binding and inherited whole: one row never two, dated when it arrived, brackets not a minus sign, no
row labels, an item may go negative, re-filing moves no money, no backfill, and above all
⚠⚠ **its §2 trap — "money back" is NOT "paid out of pocket"**.

### 3.5 The report: two shapes, one dataset

⛔ **NO DIRECTION COLUMN.** §8 records why.

**Shape A — the statement. THE DEFAULT.** `REVENUE` → categories → items → *Total revenue*;
`EXPENSES` → categories → items → *Total expenses*; `SEASON NET`. The shape a treasurer, a board and
a parent already know, and the one that answers *"are we going to be short?"*

**Shape B — by activity. A SECOND LENS.** One section per category, split into *Revenue* and *Costs*
inside it, ending in what that category netted. A recognised standard (program reporting; per-event
P&L), and the one that answers *"did hosting the tournament pay for itself?"* — which shape A
structurally cannot, because a category appears in both its sections.

Both end on the same season net. **Build the grouping rule once and shape both from it** — adding B
later means reopening it.

⚠⚠ **VARIANCE POLARITY IS THE DEFECT THIS SHAPE EXISTS TO FIX.** Over budget is *good* on income and
*bad* on a cost. A section carries that; a column cannot. The wording differs per section by design —
revenue varies **up and down**, costs run **over and under**. ⚠ Colour must never carry it alone
(the overrun and healthy tones are near-identical to a deutan eye — `project_coach_budget_card_plan_vs_actual`).

⚠ **A and B must join the report's EXISTING lens control** (Budget · Actual · Difference · Scheduled,
plus the months view) — not introduce a second idea of switching views beside it. Decide by reading
the built report.

### 3.6 Starting-library additions

Filed into categories that already exist **— except two, which did not** (see §0, correction 1): *Fundraising Costs* is renamed **Fundraising** so one category holds a drive's proceeds and its costs, and **Sponsorship** is added.

| Category | Item | Direction |
|---|---|---|
| Tournaments | Registration revenue | in |
| Tournaments | Concession revenue | in |
| Tournaments | Gate / admission | in |
| Tournaments | Officials | out |

⚠ **"Umpires & officials" ships as "Officials"** — sport-neutral, per the rule migrations 241 and 242 exist to enforce. It coexists with the *Officials* CATEGORY on purpose: this one is for officials paid as part of an event the team hosted, which is what puts it where the by-activity lens can weigh it against that event's revenue.
| Fundraising | Fundraising drive | in |
| Fundraising | Merchandise sales | in |
| Fundraising | Grant | in |
| Sponsorship | Team sponsorship | in |

**The direction tag is a picker hint, not a constraint** — it sorts; everything stays reachable.
**Anything a coach or club creates is untagged** and works both ways: guessing wrong is worse than
not guessing. **Categories are never tagged** — *Tournaments* holding both directions is the point.

### 3.7 Existing money-in lines — the question handed here by the club plan

`COACH_ORG_MONEY_IN_THE_BUDGET_PLAN.md` §3.2b parked two questions for whichever release owns the
shape of a budget line. This is that release.

1. **Lines written before this keep working**, in the *No category / Not itemized* bucket the rollup
   already has — no new mechanism. A coach re-files one by editing it. ⛔ **No backfill:** guessing
   which category a coach's "Riverdale Auto" sponsorship belongs to is confident-and-wrong data.
2. **The `sponsorship` kind survives** (§3.2). Accepted cost, stated so nobody "tidies" it: for at
   least one release the product holds "this is a sponsorship" in two places and they *can* disagree.
   That visible redundancy beats a silent mis-bill — the last change to this enum broke 19 readers
   with no error anywhere and the failure mode was over-billing families. Collapsing them is its own
   scoped follow-up, with a test.

## 4. Correctness rules the build must hold

### 4.1 ⚠⚠ Two sources for one row

Fundraisers and sponsors already report their own actuals, and player rebates depend on them. **A
category whose actual is already derived does not accept a typed one** — and the screen says so.
Every other income row is typed. **One row, one source.**

### 4.2 ⚠⚠ Never both

A given arrival is income **or** money back, never both. Counted twice, a $325 reimbursement makes a
season look $650 better than it is.

### 4.3 ⚠⚠ Nothing here ever changes a payment schedule

Not a dollar of anyone's dues, on any of the three answers. A coach who receives extra money usually
spends it on extra things. The funding ladder already subtracts expected funding from what players
cover and it is a short step from there into the dues screen — **do not take it.**

⚠ Rebates still credit the player who raised them; a team's expected figure stays the team's SHARE
(owner ruling 2026-08-12). Player dues stay out entirely.

### 4.4 ⚠⚠ Money back is not "paid out of pocket"

`COACH_MONEY_BACK_ON_A_COST_PLAN.md` §2. Both are described by a coach as *"a parent paid me back"*,
and merging them either credits a family twice or loses a credit entirely. **Test one of each on the
same item.**

### 4.5 Negatives

An item — and a category subtotal — may go negative. Show it in brackets, never block it: it is
almost always the signal it is filed against the wrong item. ⚠ The over/under styling must cope, or a
negative renders as a triumphant "under budget" (`reference_cascade_collisions_coach_budget` —
assert the computed value).

## 5. Out of scope for v1

**Reading a hosted tournament's real entry fees.** Owner ruling: manual entry only. It stays the most
valuable idea here, but it crosses from the coaches' side into tournament data — a boundary this
codebase has kept clean — and it is not worth holding up a vocabulary that works without it. **The
row does not change shape to receive it later.**

Also retired: *"whose money is it when the club hosts and the budget is a team's."* With manual entry
the coach decides by choosing where to log it. Nothing needs to model a split.

## 6. ⛔ Superseded draft #1 — a separate revenue list

The 2026-08-13 ruling — *a spending taxonomy has nothing sensible to say about a bottle drive* — was
read as "money in needs its own list". It does not. A coach can already **create categories and
items**, so that flexibility exists without a parallel system. A second list would have meant two
pickers, two ownership models, two sport rails, two rollups — and it still could not have put a
hosted tournament's revenue next to its costs, which is what a treasurer wants to see.

## 7. Sequencing

### 7.1 Why this and "money back on a cost" are ONE release

They are two halves of one question, which the money-back plan's own decision log states outright:
*"money arriving is NOT one thing, and the coach — never the product — says which it is."*

**Same form, same picker, same record shape, same report arithmetic.** Built separately, the money
form's kind switch gets designed twice — the second design forces the first open, because a switch
reading *Expense · Payable · Money back* has to be reopened the moment *Income* arrives. The report's
signed arithmetic would also be built twice, and §3.5 makes it exist at two levels.

### 7.2 The queue

1. **category + item** — built, on dev (migs 238/240/241/242). ⚠ **Reaches production first**; owner
   QA ledger §29. It owns the picker everything below points with.
2. **this + money back**, as one release.
3. **`COACH_ORG_MONEY_IN_THE_BUDGET_PLAN.md`** — by then mostly wiring club allocations and requests
   into two mechanisms that already exist. ⚠ Its §5 rule 5 carried a now-dead paragraph
   ("money-in lines have no category and no item"); corrected 2026-08-16.

⚠ **Do not build any two of these in parallel** — same form, same picker, same report.

### 7.3 Within this release

§3.2 + §3.6 are small. §3.1 + §3.3 + §3.5 are the substance. §4.1 must land with §3.3 — a
double-count shipped without its guard is a wrong number, not a missing feature.

## 8. ⛔ Superseded draft #2 — a direction column on the report

The first version of §3.5 put an `IN`/`OUT` column on a single mixed table. **It was already running
two different formulas behind one column heading**: registration revenue showed `+$400` meaning
*actual − budget*, and entry fees showed `+$150` meaning *budget − actual*, both green, both
positive, the only distinguisher a two-letter tag in a column the eye skips. Sections carry polarity;
a column cannot. **Do not reintroduce it in any form** — including as a chip, an icon or a sign
prefix on a mixed table.

## 9. Follow-through

All three done in the same unit of work (2026-08-16):

- ✅ **Help docs** — the money form's third answer, a new *Money coming in, and money back* topic
  carrying the *money back vs paid out of pocket* FAQ, and Budget vs. Actual split into a
  report-shapes topic and the month grid.
- ✅ **Demo sandboxes** — the 14U off-season world gained one income entry and one refund, the
  refund against the same item its two summed budget lines name; `check-demo-coach.mjs` asserts both
  kinds, that the refund lands on something the team really paid for, and that no typed income sits
  on a row the fundraisers already answer for.
- ✅ **Owner QA ledger** — §38.

## 10. ⏭ NEXT: a planning session on the Money tab's screens

**Owner, 2026-08-16, at the close of this release:** *get the new functionality in and usable
first, then plan how to make the Money screens more efficient.*

This release **added** to a hub that already had seven tabs, and it is the right moment to ask
whether the shape is still right rather than to keep adding. Nothing here is a defect list — it is
the agenda that this build put on the table:

1. **The screen named *Expenses & Payables* now holds a *Money in* tab.** The naming is the visible
   symptom; the question underneath is whether money out and money in belong on one screen with
   four sub-tabs, or whether the hub's own tabs should carry them.
2. **Two levels of tabs.** A coach crosses the hub's tab bar and then a sub-tab row before reaching
   a row of money — the merge of sub-tabs and toolbar (2026-08-15) fixed a third strip, not the
   second.
3. **Where a coach lands.** Overview, Budget Plan, Budget vs. Actual and Money in all now answer
   overlapping questions; Budget vs. Actual alone has three views.
4. **What the money form has grown into.** Three kinds, a timing question, a picker, an optional
   schedule and two disclosures — worth re-reading whole now that it serves every kind of money.

⚠ **Plan it before building it.** This is an information-architecture question about screens that
several releases have each extended by one tab; the failure mode is another increment.
