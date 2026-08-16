# Money back on a cost

**Status:** approved by the owner 2026-08-16, **not started**. Build after the category+item release
(§8).

**Mockup (binding):** https://claude.ai/code/artifact/27d6d2df-dc39-4c12-abd2-6fcf26826d52

**PM brief:** `COACH_MONEY_BACK_ON_A_COST_PM_BRIEF.md`

**Trigger:** owner, 2026-08-16 — *"this speaks to a general rule, I should be able to apply
reimbursements/reversals to any expense item, whether the reimbursement came from the club or not.
or even if it came from the club but I'm on a stand alone coaches portal and my club is not on the
platform, I should be able to log that reimbursement."*

---

## 1. What this is

**Money coming back on something the team already paid for.** A tournament refunds a cancelled
entry. A vendor credits a short shipment. A sponsor covers one specific cost after the fact. A club
reimburses a permit the coach fronted. A parent pays the team back for gear.

Today the portal can record money going **out** (expense, payable) and money coming **in as funding**
(fundraising, sponsorship) — but it has no way to say *"we spent this and some of it came back."* The
only workarounds are both wrong: delete the expense (which erases that the team ever paid, and
reverses the wrong month), or log the refund as funding (which says families need to fund less when
nothing of the sort happened).

⚠ **THIS IS NOT A CLUB FEATURE.** It began as one — the club-money plan was going to own it — and the
owner cut it loose on 2026-08-16 precisely because the club is only ever one **source**. It must work
for a standalone premium team with no club on the platform at all, which is why it lives on
**Expenses & Payables** and not on any org-money screen.

---

## 2. ⚠⚠ THE TRAP: this is NOT "paid out of pocket"

The product already has a mechanism that sounds identical in plain English and means the opposite.

| | Team's cash | What the team owes | Exists today? |
|---|---|---|---|
| **Paid out of pocket** — a family pays the vendor directly | never moved | the team **owes that family a credit** | ✅ yes |
| **Money back** — the team paid, then some came back | went out, some returned | **nothing**; the cash is simply back | ❌ this plan |

Both are described by a coach as *"a parent paid me back"*. **Merging them either credits a family
twice or loses a credit entirely** — real money, in a real family's ledger. Any build must keep them
separate records with separate wording, and the tests must include one of each on the same expense.

---

## 3. ⚖ DECISION LOG — new money vs money back (owner, 2026-08-15, reaffirmed 2026-08-16)

**Decided: money arriving is NOT one thing, and the coach — never the product — says which it is.**

| | **New money** | **Money back** |
|---|---|---|
| What happened | Someone is contributing: a grant, a sponsorship, a subsidy, a cost a club simply agreed to carry | Someone is returning what the team already spent from its own account |
| Files against | a **funding line** | the **cost item it repaid** |
| Effect on the plan | the season has more money to work with | that item's spending drops |
| Effect on dues | **none** | **none** |

**Why the coach decides, and not the product:** a grant and a reimbursement frequently arrive as the
*same transaction* — the same amount, from the same club, on the same day. Nothing in the data
distinguishes them. Only the person who knows what it was for can say.

**Why it matters — and note the harm is NOT in the season total.** Both readings net out at the season
level. The damage is to **the row a coach actually reads**:

- Read a reimbursed permit as *new money* and Facilities still claims $325 of spending the club
  ultimately carried, so next season's plan is built off an inflated line.
- Read a genuine grant as *money back* and it vanishes into a cost item it was never about,
  understating that item and hiding that anyone contributed at all.

⚠⚠ **NEITHER ONE EVER CHANGES A PAYMENT SCHEDULE** (owner correction 2026-08-15, after the first draft
of the club plan got this wrong twice in one sentence). **A coach who receives extra money usually
spends it on extra things** — more equipment, another tournament. The product must never decide on
their behalf that families should now pay less. Passing it on is a deliberate edit to the dues
schedule, made by the coach, on the screen that owns it.

⚠ **AND IT IS NOT "LIKE A SPONSORSHIP" — never write that sentence.** A sponsorship's player credit
lowers the dues of the **one family who brought it in**. General funding belongs to the whole team and
is credited to nobody. Pairing them teaches something false about both.

---

## 4. What a coach sees

### 4.1 A third kind on the money form

Expenses & Payables opens **one** form with a kind switch. It gains a third: **Expense · Payable ·
Money back**.

⚠ **A KIND, NOT AN ACTION ON ONE EXPENSE RECORD** (decided 2026-08-16). Attaching a refund to a single
expense record was the alternative and it fails the common cases: a tournament refunds an entry that
was logged as a deposit *and* a balance; a club reimburses "the permits" generally; a refund arrives
for something never logged at all. Pointing at the **item** is also what makes it net into the right
row, which is the whole objective.

**Its fields:** amount, date received, **what it is paying you back for** (category + item, the same
control an expense uses, ending in *+ New expense item…*), an optional **source** (Club · Vendor ·
Sponsor · Family · Other — a label on the record, never a required field and never a behaviour), and
notes.

### 4.2 The two-step ask, where the direction is in question

On a surface where money in could be either kind — the club's approved *Request from Org* is the first
— the control asks the meaning **first**, then shows the one short list that answer needs:

1. **"What is this?" — New money · Reimbursement**
2. then **funding lines** (ending *+ New funding…*) or **expense items** (ending *+ New expense item…*)

⚠ **NOT A LENGTH FIX.** One grouped dropdown made the coach hold the whole distinction in their head
while scanning and infer which half they were in from a group heading. Asking outright puts the one
real decision where decisions belong; the short lists are a consequence, not the point.

### 4.3 On the report

- **One row, never two.** A refund nets into the item's existing row. Permits billed $600 across July
  and August with $325 back in September reads **$275 for the season, on one line**. Two rows would
  make a coach add figures in their head to answer the one question the row exists for.
- **Dated when it arrived.** $600 across July–August, $(325) in September. Back-dating the credit into
  July rewrites a month already reported on and reconciled.
- **Brackets, never a minus sign.** The budget importer already *reads* `(450)` as a negative, so the
  notation exists; do not introduce a second one.
- **No row labels.** No "money back" chip, no "refund" tag — consistent with the 2026-08-15 ruling
  that retired `not budgeted` / `not in your plan` from both views. The figures and the blanks between
  them are the whole story.
- **An item may go negative** — money back against an item carrying less spending reads `($125)`.
  **Show it, don't block it**: it is nearly always the signal it is filed against the wrong item. ⚠ The
  over/under-budget styling must cope, or a negative renders as a triumphant "under budget".

### 4.4 Cash

A refund is **money in** on Cash on hand, dated when it arrived. It does **not** appear in Collections
(that is player dues) and does **not** count as funding in the plan.

---

## 5. Who gets it

**Every team with Expenses & Payables** — club-run or standalone, club on the platform or not. There
is no org dependency anywhere in this feature. That is the entire reason it was lifted out of the club
plan.

---

## 6. Rules the build must hold

1. ⚠⚠ **NEVER BOTH.** A given arrival is *new money* or *money back*, never both. Counted twice, a
   $325 reimbursement makes a season look $650 better than it is.
2. ⚠⚠ **NOTHING HERE EVER CHANGES A PAYMENT SCHEDULE.** Not a dollar of anyone's dues. The budget's
   funding ladder already subtracts expected funding from what players cover, and it is a short step
   from there into the dues screen. **Do not take it.** The ladder is a planning view; the dues
   schedule is a set of real obligations to real families.
3. ⚠⚠ **KEEP IT SEPARATE FROM "PAID OUT OF POCKET"** — §2. Test both on one expense.
4. **A refund is not a negative expense record.** It is its own kind, so a list of expenses never
   shows negative amounts and every existing sum keeps its sign.
5. **Deleting a refund puts the money back** and says the amount first, exactly as deleting a paid
   expense does.
6. **Re-filing moves no money.** Which item a refund points at stays editable after the fact, like an
   expense's line — locking it would make delete-and-re-enter the only way to fix a label.
7. **No backfill.** Nothing existing becomes a refund retroactively.

---

## 7. What this unlocks elsewhere

- **`COACH_ORG_MONEY_IN_THE_BUDGET_PLAN.md`** shrinks to a dependency: an approved *Request from Org*
  recorded as a reimbursement simply **is** one of these, with source = Club. All the netting,
  bracket, dating and no-label rules move here.
- A standalone coach with no club gets the feature outright — the case that motivated it.

---

## 8. Sequencing

Builds on **category + item** (`COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md`, dev, migration 240), which owns
the picker this feature points with. ⚠ **Do not build in parallel** — same form, same picker, same
report.

**Order:** category+item release → **this** → club money in the budget.

---

## 9. Follow-through

- **Help docs** — Expenses & Payables' guide describes two kinds; it will need the third, and the FAQ
  distinguishing it from "paid out of pocket" is the one most worth writing.
- **Demo sandboxes** — one refund in the coach sandbox (a cancelled tournament entry reads well), or a
  prospect never meets the feature.
- **Owner QA ledger** — new section on completion.
