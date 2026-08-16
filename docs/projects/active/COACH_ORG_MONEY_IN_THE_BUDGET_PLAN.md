# Club money belongs in the team's plan

**Status:** approved by the owner 2026-08-15, **not started**. Build in a fresh chat *after* the
budget-line alignment work lands (§7).

**Mockup (binding):** https://claude.ai/code/artifact/069a4d63-d00a-4277-9888-4e2cb08f2778

**PM brief:** `COACH_ORG_MONEY_IN_THE_BUDGET_PM_BRIEF.md`

**Trigger:** owner, 2026-08-15 — *"why aren't the allocations showing up anywhere on the budget or
actual reports?"*

---

## 1. The observation, and what it turned out to be

Not a filter, not a bug in the report. **The connection was never built.** Budget vs. Actual is
assembled from the team's budget lines and what has been filed against them, and only an expense or
a payable can be filed against a budget line. A club allocation has nowhere to attach — no link
exists between a club bill and a team's plan — so it was never eligible to appear.

The result is a portal that reports club money in its **cash** surfaces and ignores it in its
**plan** surfaces:

| Surface | Club money today |
|---|---|
| Cash on hand (In / Out) | ✅ paid instalments out, approved *Request from Org* in |
| Next 30 days | ✅ instalments coming due |
| Budget headroom | ❌ nothing |
| Budget vs. Actual (both views) | ❌ nothing |

**Measured on the QA fixture (2026-08-15):** the team plans $5,000, has $3,070 of spending against
it, and the Budget card reads **$1,930 of headroom**. The club has billed the same team **$2,120**
($550 paid, $1,570 ahead). A coach asking Budget vs. Actual "can we afford another tournament?" is
reading a number that ignores a fifth of the season's costs — while Cash on hand, correctly, does
not. The two cards appear to disagree, and the plan is the one that is wrong.

**The same hole runs the other way.** An approved *Request from Org* is money the club has agreed to
put in, and the plan cannot see that either — so a season that the club has partly paid for reads
exactly like one it hasn't.

---

## 2. Why it happened

The org-money screens were built as their own thing — the club-billing relationship — before the
budget plan grew the idea of a cost being *against* a line. Nobody joined them up afterwards, and
nothing since has had cause to: the in-flight budget-line alignment work makes **expenses** point at
a line and does not mention allocations at all.

---

## 3. The model

Three kinds of club money, two destinations.

### 3.1 Club money OUT → a cost, against a cost line

**Org allocations** (each instalment) and **approved *Pay Org* requests** are costs. They file
against one of the team's own cost lines, exactly the way an expense does, and default to a
**"Club costs"** bucket when nothing is chosen.

The club decides *what the team is billed* — that is not the coach's to change. Deciding which of
**their own** budget lines that bill counts against is entirely the coach's call, and is the same
judgement they already make on every expense.

### 3.2 Club money IN → the coach chooses what it *is* (owner ruling 2026-08-15)

An approved **Request from Org** is filed as **either**:

| Choice | What it means | What it does to the plan |
|---|---|---|
| **A funding line** (default: a **"Club funding"** bucket) | New money from the club — a grant, a subsidy, a cost the club simply agreed to carry | The season has more money to work with |
| **A cost line, as a reversal** | The club returning money the team fronted | That line's spending drops |

⚠⚠ **NEITHER CHOICE TOUCHES ANYBODY'S DUES** (owner correction 2026-08-15, and the first draft of this
plan got it wrong twice in one sentence). **A coach who receives extra funding usually spends it on
extra things** — more equipment, another tournament — so the product must never decide on their
behalf that families should now pay less. If they want to pass it on, they change the payment
schedule themselves, deliberately, on the screen that owns it.

### 3.2a Unbudgeted money in gets its own named row (owner 2026-08-15)

Club money often arrives against nothing the team planned — an org-wide sponsorship this team never
forecast. Leaving it in the default bucket would hide a real, named thing behind a generic label.

### 3.2c The meaning is asked FIRST, then a short list (owner 2026-08-16)

The filing control is **two steps, not one long dropdown**:

1. **"What is this?" — New money · Reimbursement.**
2. Then the list that answer needs: **funding lines** (ending in *+ New funding…*) or **expense items**
   (ending in *+ New expense item…*).

⚠ **THIS IS NOT A LENGTH FIX.** A single grouped dropdown asked the coach to hold the whole
new-money-vs-money-back distinction in their head *while scanning*, and to work out which half they
were in from a group heading. Asking it outright puts the one real decision where decisions belong —
and the lists are then short enough to read as a bonus. It is also the shape this form already uses:
Expenses & Payables opens with its own what-is-this switch before the fields that kind needs.

⚠ **THE REIMBURSEMENT BRANCH IS THE GENERAL REFUND MECHANISM**, not a club-specific one — see §3.2d.
Its list and its create option must be the same control a coach uses to log a vendor refund with no
club involved.

**Within the new-money branch, ONE door — "+ New funding…"** — which then asks the same
two questions the cost side asks: **a funding category** (Sponsorship, Fundraising, Grants… or a new
one the coach names) and then **an item**. A money-in line is created with **no budgeted amount**, and
the report shows it as its own row with **a dash in the Budget column** and the money in Actual.

⚠ **ONE DOOR, NEVER ONE PER KIND** (owner correction 2026-08-15, rejecting this plan's first draft).
An earlier version listed "+ New sponsorship…" and "+ New funding line…" side by side. **Money in will
grow more categories, and a menu that enumerates them goes stale the day it does.** The category
picker behind the single door is what scales; the door itself never changes.

⚠ **THIS IS PARITY, NOT A NEW IDEA.** The category+item ruling already does exactly this on the cost
side — *"an item charged but never budgeted becomes its own flagged row with a dash where the budget
would be"*. Money in had no equivalent, which is the only reason it needed saying.

⚠ **THE DEFAULT BUCKET IS A REPORT ROW, NOT A LINE.** "Club funding" and "Club costs" are synthetic
rows, the same shape as the cost side's unbudgeted row — nothing auto-creates a budget line on the
coach's behalf. Building one is the coach's deliberate upgrade out of the bucket.

---

### 3.2b ⚠⚠ THIS SUPERSEDED THE MONEY-IN EXCEPTION — AND THE DECISION HAS SINCE BEEN MADE ELSEWHERE

⚖ **CLOSED 2026-08-16 by `COACH_MONEY_IN_TAXONOMY_PLAN.md`.** This section was right that the
decision was not this plan's to make; it has now been made in the plan that owns the shape of a
budget line. **Money in carries category + item, both directions share one taxonomy, and a category
may hold both.** Item 1 below (existing money-in lines) is answered there — they keep working, in
the same *No category / Not itemized* bucket the cost side already uses, and no backfill guesses a
category on a coach's behalf. Item 2 below (the `sponsorship` kind) is confirmed as recorded: the
kind is left alone. **The rest of this section is retained as the reasoning, not as open work.**

`COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md` — **already built on dev, migration 240** — records the owner's
2026-08-13 ruling that **money-in lines are the exception: no category, no item, description IS the
name.** §3.2a above asks for exactly the opposite. Both are the owner's words, two days apart, and the
newer one wins — but the older one is **already in the database and in the report**.

**Do not resolve this inside this plan.** It belongs to the category+item work, which owns the shape
of a budget line, and it must be folded into that release rather than bolted on afterwards. Two
things need deciding there:

1. **What happens to existing money-in lines.** Sponsorships and fundraisers today are named by
   description and carry no category. ⛔ **No backfill** — guessing which category a coach's
   "Riverdale Auto" sponsorship belongs to is confident-and-wrong data. They either keep working
   uncategorised alongside categorised ones, or the coach re-files them; pick one and say so.
   **Still open** — it belongs to the category+item release, not here.

2. ⚠⚠ **WHETHER THE `sponsorship` KIND SURVIVES AT ALL.** If "Sponsorship" becomes a *category*, the
   product will hold the same fact in two places — a `sponsorship` **kind** and a Sponsorship
   **category** — which is precisely how they drift apart. Collapsing money in to a single `funding`
   kind is the tidier answer, **but it touches 12+ modules that read the kind**, and this repo has
   already been bitten once here: adding the third kind broke 19 `=== 'funding'` readers **silently**,
   and the failure mode was over-billing families. If it collapses, it collapses deliberately, with a
   test, in the release that makes the change — never as a side effect of this feature.

⚖ **DECIDED (owner, 2026-08-16): the kind is left alone.** Money in keeps `funding` | `sponsorship`
on the ledger side, category + item is added **on top**, and the collapse is opened as its own scoped
follow-up with a test — never as a side effect of a feature.

**What that costs, stated plainly so nobody "tidies" it later:** for at least one release the product
holds "this is a sponsorship" in two places, and they *can* disagree — a line whose kind is
`sponsorship` sitting in a Fundraising category, or the reverse. That is a known, accepted
redundancy, and it is accepted because the alternative risks a **silent** mis-bill: the last change
to this enum broke 19 `=== 'funding'` readers with no error anywhere, and the failure mode was
over-billing families. A visible inconsistency beats an invisible one that takes money.

⚠ **Anyone who finds the redundancy and is tempted to fix it in passing: don't.** It has its own
TODO entry. Collapse it there, with the test, or leave it.

⚠ **AND IT IS NOT "LIKE A SPONSORSHIP" — never describe it that way.** A sponsorship's player credit
lowers the dues of the **one family who brought it in**. Club funding belongs to the whole team and
is credited to nobody. The two are different mechanisms and pairing them in a sentence teaches a
coach something false about both.

⚠ **THIS IS THE WHOLE POINT OF THE CHOICE AND THE REASON THE FORK WAS NOT DECIDED FOR THE COACH.**
A grant and a reimbursement are different events that happen to arrive as the same transaction. Only
the coach knows which one it was, and the difference is **which line's story comes out true**.

Both readings net out at the season level, so the harm is not in the total — it is in the report a
coach actually uses. Read a reimbursed permit as funding and Facilities still claims $325 of spending
the club ultimately carried, so next season's plan is built off an inflated line. Read a genuine club
grant as a reversal and it disappears into a cost line it was never about, understating that line and
hiding the fact the club contributed at all. Forcing either reading would be wrong about half the
money.

### 3.2d ⚠ THE REIMBURSEMENT HALF IS NOT THIS PLAN'S — IT IS `COACH_MONEY_BACK_ON_A_COST_PLAN.md`

Owner ruling 2026-08-16: *"I should be able to apply reimbursements/reversals to any expense item,
whether the reimbursement came from the club or not… even if my club is not on the platform."*

**A club reimbursement is one SOURCE of a general refund, not a mechanism of its own.** Everything
about how money back behaves — a third kind on the money form, netting into the item's existing row,
one row never two, dated when it arrived, brackets for negatives, no row labels, an item allowed to go
negative, the "paid out of pocket" trap — **lives in that plan and is inherited here.**

This plan therefore owns only:
- club **costs** (allocations, approved *Pay Org*) filing against a cost item, default **Club costs**;
- club **new money** filing against a funding line, default **Club funding**, with the create door
  described in §3.2a;
- the **two-step ask** (§3.2c), whose *Reimbursement* branch simply hands off to the general control.

⛔ **DO NOT RE-SPECIFY THE REFUND RULES HERE.** Two plans describing one mechanism is how they drift,
and this one has already had to be corrected three times in two days.

If the team paid $100 in July and the club reimbursed it in September, the month grid shows **$100
in July and ($100) in September**, and the season nets to zero. Back-dating the credit into July
would rewrite a month that has already been reported on and reconciled.

⚠ **BRACKETS, NOT A MINUS SIGN.** `lib/coach-budget-import.ts` already *reads* `(450)` as a negative
when importing a budget, so brackets are this product's existing notation for money going the other
way. Reuse it on the way out; do not introduce a second convention.

### 3.4 What stays OUT of the plan

**A pending payment request never appears in any budget surface.** "Unpaid allocation" means the
club has billed the team and it is owed. "Pending request" means the club has not agreed and may
decline. Putting an unapproved ask into a report people budget against would be the worst kind of
optimism. Pending requests stay on the Payments tab, which is their home.

---

## 4. Committed-but-not-paid uses the lens that already exists

The owner asked for an **"include pending"** toggle so unpaid allocation instalments could be seen.
The report already has this control, and it is better named: the **Scheduled** lens — *"what you've
actually committed to pay, by its due date"* — which sits alongside Budget, Actual and Difference in
the Months view. Payables already feed it; `MonthGridInput.scheduled` is documented as *"Commitments,
by the date they fall due (paid or not — a commitment is scheduled either way)"*.

**An unpaid allocation instalment is precisely that animal.** It flows into Scheduled. No new
control, no second vocabulary for one idea.

⚠ **THE REAL GAP IS THE CATEGORIES VIEW**, which has no committed-vs-paid distinction at all. That
is worth closing, and it must be closed using the same **Scheduled** word — a toggle labelled
"include pending" beside a lens labelled "Scheduled" would be the sixth-idiom problem the 2026-08-13
table pass exists to prevent.

---

## 5. What a coach sees

1. **Org Allocations** gains a *"What is this against?"* field per allocation — **whatever control
   the expense form carries at build time** (see §7: as of 2026-08-15 that is moving from a
   line picker to **category + item**). Unfiled allocations sit in **Club costs**.
2. **Payments** gains the same field on an approved request, offering **both** the funding side and
   the cost side, with the two groups labelled so the choice reads as *new money* vs *money back*.
3. **Budget vs. Actual** shows club money in both views, in the lens the coach is reading:
   - *Actual* — paid instalments, approved *Pay Org*, and reversals as bracketed negatives.
   - *Scheduled* — unpaid instalments, by due date.
   - *Budget* — unchanged. A club bill is not a thing the coach planned; it is a thing that happened.
4. **Budget headroom** on the Money hub falls by club costs and rises by club funding, so it stops
   disagreeing with Cash on hand.
5. **Nothing is filed for the coach.** Every club amount is visible from day one in its default
   bucket; filing is a refinement, not a prerequisite.

---

## 6. Rules the build must hold

1. ⚠ **NEVER BOTH.** Club money already counts as cash in/out. Whether the *plan* reads an arrival
   as funding **or** as a reversal must be strictly one or the other. A $325 reimbursement counted
   twice makes a season look $650 better than it is.
2. ⚠⚠ **NOTHING HERE EVER CHANGES A PAYMENT SCHEDULE** — not a dollar of anyone's dues, on either
   choice, ever. See §3.2. This is the rule most likely to be broken by accident, because the
   budget's funding ladder already subtracts expected funding from what players cover, and it is
   tempting to reach from there into the dues screen. **Do not.** The ladder is a planning view; the
   dues schedule is a set of real obligations to real families, and only the coach edits it.
3. ⚠ **DEFAULT TO THE BUCKET; NEVER GUESS A REVERSAL.** An unfiled amount in a labelled "Club
   funding" bucket is easy to find and re-file. A silently guessed reversal quietly reduces one
   specific line's spending, which is a far worse thing to discover in March.
4. ⚠ **A LINE'S ACTUAL MAY GO NEGATIVE** — a $325 reimbursement filed against a line carrying $200
   reads `($125)`. **Show it, don't block it**: it is usually the signal that it is filed against
   the wrong line. But the over/under-budget styling must cope, or a negative renders as a
   triumphant "under budget" (see `reference_cascade_collisions_coach_budget` — assert the computed
   value).
5. ⚠ **THE PICKER OFFERS THE COST SIDE ONLY, FOR COSTS.** The budget-line alignment work already
   established that a funding line absorbing an expense inflates the budget it exists to offset, and
   that the server refuses it with a sentence the coach can act on. Club costs obey the same rule;
   club money in is the one case that may address both sides.

   ⛔ **THE PARAGRAPH THAT WAS HERE IS DEAD — owner ruling 2026-08-16 reversed it.** It read: *"money-in
   lines have no category and no item; the funding half of this picker cannot be a category+item
   control; the two halves are shaped differently and that is correct."* **Both halves are now the
   same control.** Money in carries category + item exactly as costs do, through the same picker,
   the same three-tier ownership and the same sport rail — see
   `COACH_MONEY_IN_TAXONOMY_PLAN.md`, which is where §3.2b handed this decision and where it was
   made. Building the funding half as a name list would ship a retired control.
6. ⚠ **DELETING A PLAN ROW MUST NEVER DELETE A RECORD OF MONEY** — the same `ON DELETE SET NULL`
   rule the expense link uses.
7. ⚠ **RE-FILING MOVES NO MONEY.** The budget line stays editable on a paid record, exactly as it is
   for expenses; locking it would make delete-and-re-enter the only way to fix a label.
8. **No backfill.** Historic allocations land in "Club costs" and stay there until a coach says
   otherwise. Guessing which line a past club bill paid for is confident-and-wrong data.

---

## 7. Sequencing — why this waits

This rides on the work that decides **how any money record points at the plan**. ⚠ That target moved
on 2026-08-15 and this plan must not be built against the older half of it:

- `COACH_BUDGET_LINE_ALIGNMENT_PLAN.md` — expense → **budget line** (migration 238, dev only).
- `COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md` — **supersedes it**: the plan groups by **category → item**,
  two lines on one item sum into one row, and actuals carry the item too (migration 240, dev only).
  Its own TODO entry recommends folding both into **one release**, since 238 has never reached prod.

⚠⚠ **BUILD AGAINST CATEGORY + ITEM, NOT THE LINE PICKER.** Writing this against the retired control
would ship a third mechanism for one job in the same fortnight the other two were being reconciled.

⚠ **DO NOT BUILD IN PARALLEL WITH EITHER.** All three edit the same rule, the same report and the
same picker. Start once the folded release has passed owner QA (ledger §29) and its migrations have
reached production.

**And this plan is now THIRD in the queue, not second** (2026-08-16). The order is:

1. **category + item** — owns the picker everything else points with.
2. **`COACH_MONEY_BACK_ON_A_COST_PLAN.md`** — owns the refund mechanism this plan's *Reimbursement*
   branch hands off to, and is worth shipping on its own for standalone teams with no club anywhere
   near them.
3. **this plan** — club money, which by then is mostly wiring two existing mechanisms to a third
   source.

**The one thing to re-verify first:** whether "unbudgeted" spending having become its own flagged row
inside its own category changes where a **Club costs** bucket should live. It may be that club money
with no item is exactly the same shape as that flagged row, and should reuse it rather than add a
parallel bucket — decide by reading the built report, not this paragraph.

---

## 8. Open questions

None blocking. The reimbursement-vs-funding fork — the one genuine design decision — was **closed by
the owner on 2026-08-15** in favour of letting the coach choose (§3.2).

---

## 9. Follow-through

- **Help docs** — the Money guide's `premium-money-org` sub-topic states today that allocations show
  on the Payment schedule and Next 30 days. It will need the plan surfaces added, and
  `premium-money-months` will need the Scheduled lens described as carrying club commitments.
- **Demo sandboxes** — the coach sandbox's club-run team should have at least one filed allocation
  and one reimbursement-as-reversal, or a prospect opening Budget vs. Actual sees the feature's
  default bucket and nothing of the choice. Assert it in `check-demo-coach.mjs`.
- **Owner QA ledger** — new section on completion.
