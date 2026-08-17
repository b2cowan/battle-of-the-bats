# Coach Money — the screens redesign: the split, the register, and the shape of the middle

**Status: DIRECTION APPROVED by the owner 2026-08-16 (in conversation) — build gated on the
mockup review.** The owner ruled the big questions the same day this plan was first drafted; §0
records exactly what is ruled and what remains open. No code yet.

**Kickoff prompt:** `COACH_MONEY_TAB_REDESIGN_PROMPT.md` (2026-08-16).
**Mockups (this session, updated for the register):**
https://claude.ai/code/artifact/ff5112d8-8e90-40f9-8e67-3aa668b668e2
**Binding form proposal (2026-08-16):** https://claude.ai/code/artifact/b618c784-c050-4003-833b-b87d3cb708f7
**Earlier binding mockups in the series:** `945391e9` (category + item) · `ee76cc79` (money in/out) ·
`27d6d2df` (money back).
**PM brief:** [COACH_MONEY_TAB_REDESIGN_PM_BRIEF.md](COACH_MONEY_TAB_REDESIGN_PM_BRIEF.md)

---

## 0. ⚖ The ruling log — what is decided, what is open

**Ruled by the owner, 2026-08-16 (this session's conversation), on top of the form rulings in §2:**

1. **The payables split is adopted** (§3). *Add money* records only what happened; a commitment
   gets its own door on Payables; **Mark paid opens *Add money* pre-filled and asks when**. This
   deliberately re-makes the "one Add door" ruling as **one door per object — money itself still
   has exactly one**, since Mark paid returns through it.
2. **The hub's tabs carry the halves** (Design A). The *Money in* tab name dies with the old screen.
3. **Transactions is a REGISTER, not a pair of lists.** The owner's own words: a ledger the coach
   reads down — sorted by date, credits and debits, **a running balance updating row by row**,
   categories/items/descriptions on the rows, views by type, an include-scheduled option, and
   rows that open to edit or Mark paid. This **supersedes, before it was built,** this plan's
   earlier recommendation of two single-kind views (Expenses · Income) — recorded in §4 so nobody
   builds the list version.
4. **Allocations + Requests merge into ONE club tab** — two halves of one relationship (money the
   club bills the team; money the team asks of the club). This retires the earlier
   *Payments → Requests* rename question entirely: the tab it renamed no longer exists.
5. **The "forward ledger" instrument is the register's scheduled overlay**, not a separate screen.
   The Overview's next-30-days panel becomes a window into it.

**Still open — confirm at the mockup review, none blocks the direction:**

- ~~**The club tab's name**~~ — **RULED 2026-08-17: `Club`** (see the P4 ruling log below).
- **The register's default for the scheduled overlay** — recommendation: **on**, with the Today
  rule separating settled from projected (§4.4). *(Shipped **on** in P3.)*
- **Payables opens on the Schedule view** — recommended yes; mild, reversible.

---

## 0b. ⚖⚖ The P4 ruling log — owner, 2026-08-17, at the mockup review

**Mockup:** https://claude.ai/code/artifact/43cf2381-74d3-4ada-afd9-461ac51c0d9c (two passes — the
second is the binding one; the owner overturned two of the first pass's recommendations).

**Six rulings. Three of them widened the phase, and two of those came from the owner reading the
first mockup and disagreeing with it.**

1. ⚖ **The tab is named `Club`**, and the name carries through: the request-type badges stop saying
   **Pay Org** / **From Org** and say **To club** / **From club**, on the rows, the type picker and
   the empty-state cards. Argued from the code, not from taste — coach-facing prose in the portal
   already runs 57 uses of *club* to 38 of *org*, the empty states and the help guide say *club*,
   and **the register's own chip and filter on these exact rows already read `Club` / `from Club`**
   (P3). Naming the tab *Org* would have left the book and the workspace calling one relationship
   two things. §6's open row is closed. *(Considered and dismissed: the Club plan tier shares the
   word. A coach inside a team workspace never sees plan names and the two never share a screen.)*

2. ⚖⚖ **SEASONS ARE INDEPENDENT — nothing from a past season, no exception.** Owner, verbatim:
   *"our default for all data is it is independent on each season and only brought into view on a
   case by case basis, so default to not show anything from past seasons."* This **overturned the
   mockup's own recommendation**, which had proposed carrying still-undecided requests across
   season boundaries so a pending one could not vanish. Both club lists are working-season only,
   with no marker and no carry-over.
   - ⚠ **The hole that recommendation existed to plug is real and is closed elsewhere:** a season
     that ends with a request the club never answered leaves it nowhere a coach looks. So an
     unanswered club request becomes a **season close-out blocker**, beside the families who still
     owe — the checklist that already exists, not a window into last year.
   - ⚠⚠ **This also fixes a live defect, and the ask was narrower than the evidence.** The brief
     asked only whether the *request* list should be season-scoped. Reading the code found that
     **neither club list was** — allocations were not either — and that they were the **last two
     surfaces in the money area still reading team-lifetime**. Cash on hand, the register and the
     season close-out pot were all corrected by P3; these two were not, so on any team past its
     first year the Allocations tile and the Money overview already described the same team and
     disagreed. Nothing showed them side by side. The merged tab is exactly the screen that would.

3. ⚖⚖ **A PENDING REQUEST NOW APPEARS IN THE REGISTER'S SCHEDULED OVERLAY.** This **reverses §4.4's
   "⛔ Never qualifies: anything pending a decision"** and §8's "a pending request never enters the
   plan or the register", *for the overlay only*. The owner asked the question the mockup should
   have asked itself: if the switch is called *include what's scheduled*, a coach planning wants to
   see what they have asked for.
   - **What made it right rather than a loosening:** the overlay **already carries a sponsor
     pledge** — money that may never arrive at all — and P3's own review ruled that in. A pledge the
     sponsor may not honour and a request the club may decline are the same species of uncertainty.
     The distinction being drawn was not one the screen could defend.
   - 🔒 **What does NOT change, and is still load-bearing:** a pending request touches **no settled
     balance, no Cash on hand, no Budget Plan and no report**. §4.2's identity is untouched — the
     overlay runs *past* Today with projected balances, so nothing about it can move the figure at
     Today.
   - **Shape:** a request has no due date (nothing records when the club will answer), so it sorts
     to the **end of the scheduled block** and says *No date* — the existing rule for a dateless
     forward row (§46 D). It carries an **Awaiting the club** chip, and the forward total's caption
     states how much of it is still a question rather than folding it in silently.

4. ⚖⚖ **CLUB MONEY GETS A CATEGORY AND ITEM, AND REACHES BUDGET VS. ACTUAL.** The owner's question —
   *"shouldn't the request [name] which budget category/item each request should be tied to so it
   will be mapped properly?"* — found the largest defect in the phase, and it is bigger than the
   question. **`budget-vs-actual/route.ts` reads neither `rep_allocation_installments` nor
   `rep_team_payment_requests`.** Not one hit for either name. So on a club-run team, every dollar
   of the club's bill the team pays and every cost the club agrees to cover are **absent from the
   report entirely** — frequently the season's single largest line, missing from the one screen that
   answers *"how did we do against plan?"*. The same shape as P3's three Cash-on-hand defects.
   - **Cause:** club money carried no team-side classification at all. `rep_allocation_splits` had
     none; `rep_team_payment_requests.budget_line_id` is a **trap** — it points at the CLUB's
     `org_budget_lines`, no coach surface has ever written it, and it could not carry a team's
     vocabulary if one did.
   - **Fix: migration 250** puts `budget_item_id` + `budget_category_id` on both tables, the request
     form gains the shared picker, and a coach files their own share of an allocation when the bill
     arrives (the club cannot — they do not know this team's words, and two teams may file one
     shared cost differently). Nullable, no backfill: only a coach can say what a bill was for, and
     guessing would put invented classifications into a report a treasurer reconciles.
   - ⚠⚠ **The picker offers the money-OUT side on ALL THREE kinds, including a request where money
     comes IN.** That is the refund rule (mig 246 + P2): the direction flips the money, never the
     list, because what a reimbursement is FOR is a cost. `rep_team_money_in`'s own table comment
     already states the consequence of the alternative — *"counted twice, a $325 reimbursement makes
     a season look $650 better than it is."*
   - ⚠ **Two new tables therefore point at `budget_items`,** so both are registered in
     `BUDGET_ITEM_REFERENCES` in the same commit. That list belongs to the concurrent
     `COACH_BUDGET_ITEM_INTEGRITY_PLAN.md`; its guard test fails the build on an unregistered FK,
     which is the guard doing its job. Shipping without them would have re-created that project's
     founding defect on two brand-new tables.

5. ⚖ **The merged tab appears BETWEEN SEASONS, read-only.** Today neither club tab renders at all
   once a season finishes (`showOrgTabs` requires a live season), so a coach between seasons can see
   the club's money on the register but cannot open the tab to see what those instalments were or
   how a request was decided. That predates the history-in-place ruling. These are **records**, not
   instruments — nothing here recomputes — so they render in place with no Make a request, no Mark
   paid and no pencil. ⚠ **Not a conflict with ruling 2:** this is the team's own working season,
   which between seasons *is* the finished one. No `?year=`, nothing cross-season.

6. ⚖ **The demo tour gains a sentence, not a ninth step.** The existing Money step's narration names
   what the club billed this team and what the team asked back.

**⚠ Two claims in `COACH_MONEY_SPLIT_P4_BUILD_PROMPT.md` were FALSE and are recorded here so no
later reader trusts them** (both found by reading the code, per AGENCY_RULES' "argue from what the
code does"):
- **§6 "the coach sandbox seeds NO allocations and NO requests"** — false since commit `13a8ad03`
  (2026-08-16, *"the coach sandbox shows what its club bills it, and what it asks back"*), a day
  before the prompt was written. The 12U team carries an allocation with instalments and a set of
  requests, already season-stamped for mig 247. Only the judgement half was outstanding.
- **§5 / Owner QA §46 §I "between seasons the request form is still offered and the server refuses
  it"** — the 409 is real, but **the UI is unreachable**: the hub drops both org-only tabs when the
  season is finished, and a deep link falls back to the Money overview. There was no button to hide.
  The real defect was the inverse (ruling 5).

---

## 1. The target model — three layers

**The principle the owner and this plan converged on: one place to see, separate doors to act.**
Everything in the middle of the money area is receivables, payables, or settled transactions —
but each tab exists because of a *relationship* (families, donors, the club, vendors) whose
workflow the others don't share, and the isolation between them is load-bearing (§8). So the
workspaces stay; what was missing was the connective tissue — one dated book where all of it
meets.

| Layer | Screens | Job |
|---|---|---|
| **Plan** (beginning) | Budget Plan | what we intend |
| **Workspaces** (middle) | Player Dues · Fundraising · **Club** · **Payables** | one per relationship; where records are created and workflows live |
| **Instruments** (read across everything) | **Transactions (the register)** · Overview · Budget vs. Actual | the register is the dated view of every dollar; Overview is *what needs me now*; Budget vs. Actual is the settled story by category |

**The hub bar, end state:** Overview · Budget Plan · Player Dues · Fundraising · **Transactions** ·
**Payables** · **Club** · Budget vs. Actual — **8 tabs org-linked (today's count), 7 standalone**
(the Club tab only exists org-linked, exactly as Allocations/Payments do today). The split is paid
for by the club merge; the two-level-tab complaint shrinks to at most a two-view row per tab, and
the Transactions tab has **no sub-tabs at all** — filters instead (§4.5).

---

## 2. ✅ The form — decided 2026-08-16, carried verbatim, not re-litigated

| | |
|---|---|
| **The save button says `Save`** | One modal serves add *and* edit. |
| **“Expense” replaces “A cost”** | On the money form **and** the Budget Plan form — one word, one meaning. |
| **A refund is a tick box, not a third kind** | Two pills — **Expense** / **Income** — with **“This is a refund”** beside them. It flips the direction of the money and **never changes the list you choose from**. |
| **The item list follows the pill** | Expense shows money-out items; Income shows money-in items. **Categories are never filtered** — *Tournaments* deliberately holds both directions. |
| **A created item carries a direction** | From the control it was created under; appears under that direction only; editable afterwards. |
| **One searchable picker** | `Category · Item` in one control, type-ahead, grouped by category, shared by the money form, the Budget Plan form and the club admin budget screen. |
| **`Paid by` folds under `More`** | Rare; the consequence line makes hiding it safe. |
| **The consequence line** | One line above the buttons stating what the record will do, in dollars; on an out-of-pocket cost it names the family and the credit. |
| **The teaching copy moves out of the form** | Comparison panels live on empty states and the help guide only. |
| **The date fix ships separately, FIRST** | Built 2026-08-16; the form has **Date paid**, Mark Paid asks *when*, a future date is refused. Inherited, not rebuilt. |
| ⚖ **NOTHING ON A SAVED RECORD IS READ-ONLY** | Owner 2026-08-16, reversing 08-15. The books follow every correction. Two surviving refusals are not locks: an unmatchable pre-mig-236 ledger entry, and changing WHO paid out of pocket. |

### ⛔ Superseded drafts — recorded so nobody rebuilds them

1. **A separate revenue list** (`COACH_MONEY_IN_TAXONOMY_PLAN.md` §6). Dead.
2. **A direction column on the report** (`…` §8) — one signed amount column with an IN/OUT tag on
   a mixed *budget-report* table running two variance formulas behind one heading. Dead. ⚠ **The
   register does NOT rebuild this** (owner-ruled, this session): a register carries direction in
   **two separate Money out / Money in columns with a running balance** — the centuries-old
   standard for mixing directions in one dated book — and never shows a variance. The report
   ruling stands untouched.
3. ⛔ **“Direction first” — a three-row switch.** Dead; the tick box reaches the same place.
4. ⛔ **“Not paid yet” as a tick box on the date field.** Dead; the answer is the split.
5. ⛔ **Transactions as two single-kind lists (Expenses · Income)** — this plan's own first
   recommendation, superseded by the register ruling before build. The "where does an income
   reversal list?" question it existed to answer dissolves: in a register, **everything has one
   home — its date** — and direction is the column the amount sits in.

---

## 3. The split — ruled; the reasoning kept for the record

*Add money* records what happened. A commitment (what, how much, due when, optional
deposit/balance split — expense items only; a scheduled *income* is a budget line) is created on
**Payables** and joins the payment schedule; its consequence line says *"nothing moves."*
**Mark paid opens *Add money* pre-filled and asks when** — one place a transaction is ever born.
A future date typed on *Add money* is refused with *"that hasn't happened yet — add it as a
commitment instead"* and the link.

Why it was right (argued from the code): the old form derived a hidden mode from whichever sub-tab
opened it; the old screen's four sub-tabs already divided cleanly into happened (Expenses, Money
in) vs owed (Payables, Schedule); the date-fix release had already made Mark Paid ask *when*. The
split mostly relocates working machinery — the commitment list, the schedule, the bulk import —
rather than inventing any.

---

## 4. The Register — what the Transactions tab is

**One dated book of every dollar, with the balance beside it.** The bank-app shape a coach already
knows how to read.

### 4.1 Columns and order

**Date · What (description + chips) · Category · Item · Money out · Money in · Balance.**
Newest first, the way a bank app reads; each row's Balance is the balance *after* that row. With
the scheduled overlay on, a **Scheduled** block sits above Today (soonest first, projected
balances), then the settled book runs down from Today. Description is the row's name; category ·
item its filing; amounts always in their direction's column — **no signed single column, ever**
(§2, superseded draft 2).

### 4.2 ⚠⚠ The balance IS Cash on hand, decomposed

The register's headline correctness rule: **the running balance at Today equals Cash on hand, and
every row is one of its movements.** That is what forces the register to include the money the
coach did *not* type here:

- **Recorded rows** — expenses, income, refunds/reversals (the tick box's records). Open the money
  form on tap; fully editable (§2's no-read-only ruling).
- **Derived rows, read-only in the register** — dues payments received (from Player Dues),
  fundraiser proceeds / the team's share (from Fundraising), sponsor receipts, settled club
  amounts (from Club). Each carries a chip naming its workspace and **tap navigates there** to
  act. The register never edits them, so **"one row, one source" is untouched — a view cannot
  double-count, and nothing is ever *created* in the register.**

If the balance and Cash on hand can disagree, the register is wrong by construction — this is a
build-blocking test, not a styling note.

### 4.3 Views and filters — instead of sub-tabs

The Transactions tab has **no second tab row.** One filter strip: **type** (All · Expenses ·
Income · Refunds · from Dues · from Fundraising · from Club), **category/item**, and the
**scheduled toggle**. Filters narrow the book; ⚠ when a filter hides rows, the Balance column
hides with it — a running balance over a filtered subset is a number that looks like cash and
isn't. (Chips on rows state kind — a *list* may label; the *report* still never does.)

### 4.4 The scheduled overlay — the forward ledger

The toggle the owner named ("include pending/unpaid vs. not"). On, the register keeps running past
Today into what is *scheduled to happen*, with **projected balances** visually distinct from
settled ones:

- **Qualifies:** unpaid commitments (deposits/balances by due date), upcoming dues installments,
  recorded sponsor pledges, approved-but-unsettled club amounts.
- ⛔ **Never qualifies: anything pending a decision.** An unapproved request is money the club may
  decline; it appears nowhere on the register (the standing "a pending request never enters the
  plan" ruling, applied here).
- Scheduled money-out rows offer **Mark paid**, which opens *Add money* pre-filled and asks when —
  the same one door.
- **Recommended default: on** (open question, §0) — the Today rule and the projected styling keep
  the two halves unmistakable, and the screen then answers *what happened* and *what's coming* in
  one read. Colour never carries the settled/projected distinction alone.

### 4.5 What the register replaces and feeds

- The old Expenses and Money in lists retire into it (their export datasets survive as filtered
  exports of the register).
- The **Overview's next-30-days panel becomes a window into the register** (its rows deep-link in,
  scheduled overlay on).
- The **Payables tab remains the workspace** for commitments — creation, deposit/balance editing,
  the Schedule view, bulk import. The register is where they appear in context; Payables is where
  they are managed. One place to see, separate doors to act.

---

## 5. The Club tab (merge of Allocations + Payment Requests)

Two tabs today, one relationship: money the club bills the team (allocations), money the club has
given or agreed to (funding), money the team asks of the club (requests). Merged into **one tab
telling the story of where the team stands with the club** — billed, asked, settled — with the two
existing workflows (paying an allocation; making/editing/withdrawing a request) intact inside it.

- Settled club amounts surface in the register as derived rows (§4.2); approved-owed amounts join
  the scheduled overlay (§4.4); pending requests appear **only here**, never on the register.
- The recent §35 work (empty states, request records, pencil-while-pending, the approve/withdraw
  race fixes) **carries in whole** — this merge moves doors, not rules.
- ⚠ **P4 gets its own short mockup pass before build** (the owner sees the combined screen before
  it exists), where the tab's name is settled: **Club** vs **Org** (§0).

---

## 6. Names — ruled, with one open

| Surface | Name | Status |
|---|---|---|
| The register tab | **Transactions** | ruled (the owner's own word for it) |
| The commitments tab | **Payables** | ruled — keeps the established in-product word (*Commitments* considered; breaks continuity with schedule/exports/help/QA for no gain) |
| The merged club tab | **Club** vs **Org** | **open** — settled at the P4 mockup pass |
| The old *Money in* tab | — | dies with the old screen; income lives in the register under the same word the form's pill and the report's section use |
| *Payments → Requests* rename | — | retired — the tab it renamed no longer exists |

Rejected candidates, recorded: **Activity** (collides with the report's *By activity* lens one tab
over), **Ledger** (accurate, but the portal speaks plain words), **Money in & out** (stutters
under a hub already called Money), **The Books** (was the fallback for a one-screen design that is
no longer on the table).

---

## 7. Where a coach lands

**Overview stays the landing tab** — the hub's only *what needs me now* instrument. Every other
tab is a workspace or a book. **Budget vs. Actual's three views stay exactly as they are**
(Statement · By activity · Months — one lens control, three questions of one comparison); said
out loud so nobody manufactures a change. The overlap complaint dissolves into roles:

| Screen | Its one question |
|---|---|
| Overview | *what needs me now?* |
| Budget Plan | *what do we intend?* |
| Transactions | *what happened — and with the overlay, what's coming?* |
| Payables | *manage what we owe* |
| Player Dues | *where do families stand?* |
| Fundraising | *what did drives and sponsors bring?* |
| Club | *where do we stand with the club?* |
| Budget vs. Actual | *how does it compare to the plan?* |

---

## 8. 🔒 Constraints that survive — none are open

- ⚠⚠ **Money back is NOT “paid out of pocket.”** Test one of each on the same item; count credits —
  exactly one.
- ⚠⚠ **Nothing here ever changes a payment schedule.** Not a dollar of anyone's dues, on any kind —
  and the register, which now *displays* dues movements, still never touches one.
- **A refund's report rules** (money-back plan §4.3/§6, inherited whole): one row never two ·
  dated when it arrived · brackets never a minus sign **on the report** · no row labels **on the
  report** · an item may go negative · re-filing moves no money · no backfill. (The register
  needs no brackets — its columns carry direction.)
- **One row, one source** — derived rows refuse typed income at the source; the register, as a
  pure view, cannot violate this and must not grow a create path that could.
- **Never both** — an arrival is income or money back, never both; the register renders each
  record once.
- **Variance polarity** — the report's rule; the register shows no variance.
- **The item tiers** — platform → club → team, one direction; publishing absorbs duplicates.
- **Working season only.** Nothing here reads a `?year=`; the "money book" history shelf is P4 of
  the membership plan and gets its own owner mockup session (`coach-history-endpoint-guard` is the
  contract).
- **Sport-neutral vocabulary** throughout.
- **Nothing on a saved record is read-only** (§2) — and derived rows are not an exception: they
  are edited at their source, not locked.

**Known limit, carried not solved:** two tabs editing one record last-save-wins with no conflict
warning. Stays out; if fixed, one shared guard for all money kinds. Logged as debt.

---

## 9. What the build touches — surfaces and compatibility

- **Section ids:** `expenses` → `transactions`; new `payables`; `allocations` + `payment-requests`
  → the club tab's id. Every mapping is a redirect, not a break: `?section=expenses` →
  transactions; `…&tab=payables|schedule` → payables (matching view); `…&tab=money-in` →
  transactions filtered to income; `?section=allocations` / `?section=payment-requests` → club.
  The legacy standalone-route redirect layer already exists for this class of hop.
- **In-code copy:** hub tab labels, panel headings, the money rail, cross-links between the two
  org panels (already removed once — do not reinstate), export catalog blurbs, Overview's link
  set (the next-30-days window, the two fundraising rows, the schedule link).
- **Exports:** the register's filtered exports replace the Expenses/Money-in datasets by name;
  the schedule export survives on Payables.
- **Rendered layout baseline:** the expenses screen becomes transactions + payables screens (done
  in P1: `coach-expenses` → `coach-transactions` + `coach-payables`); the two org screens become
  the club screen — deliberate baseline edits.
- **Help guide:** the Expenses & Payables topic splits (register / payables); the org-money topic
  merges; run `/docs` in the same unit of work per phase.
- **Demo sandboxes:** the seeded world already carries both kinds and a refund; the register is a
  shop-window screen — the tour should walk it. ⚠ The known gap stands: the coach seed creates no
  allocations/requests, so the Club tab would demo empty — fix the seed in P4 or the merge
  demos worse than the two tabs it replaced. `npm run check:demos` per phase.
- **Owner QA ledger:** new sections per phase; §38's wording references old tab names — annotate,
  never renumber.

---

## 10. Phases — each leaves the product coherent

1. ✅ **P1 — Two doors. BUILT ON DEV 2026-08-16** — Owner QA §41.
   The split: Transactions + Payables tabs (Transactions carries the existing lists as a stepping
   stone), the commitment form, Mark-paid-through-*Add money*, future-date refusal, all URL
   mappings. **Build prompt:** `COACH_MONEY_SPLIT_P1_BUILD_PROMPT.md`.

   **Two decisions taken during the build, both recorded so P2/P3 inherit them rather than
   re-litigate them:**
   - ⚖ **The arrivals list stays *Money in* for P1** (owner call, 2026-08-16), against §6's
     retirement of the name. The list still holds income AND money back, and this screen's own
     empty state teaches in bold that a refund is not income — so "Income" would have put two of
     every four rows under a heading the product contradicts, and carried that into the export
     file a coach hands their club. **P3 retires it properly**, where the register's separate
     *Income* and *Refunds* filters make the word true of the rows under it. Mockup:
     https://claude.ai/code/artifact/eca99e68-b764-48a8-b197-c4f6412871a3
   - ⚠⚠ **The un-split commitment had no due date at all, and the form claimed otherwise.** The
     split group read *"leave this closed to record one amount due on one date"* while offering no
     such date — so the simple case saved with none: status "No schedule", absent from the payment
     schedule and the Overview's next-30 panel, and **no Mark paid button anywhere**. P1 adds the
     field and stores it **as the deposit half**, which is the convention the bulk importer has
     always used for this row — so a typed commitment and an imported one are one record and the
     "not a new object" constraint holds with no migration.

   **Also fixed, being false the moment P1 shipped:** the help guide still described the removed
   *"already paid / promised, not paid yet"* switch and the amount lock that the 2026-08-16
   editability ruling reversed.

   **Deliberately NOT done, and why:** Mark paid on a plain unpaid **expense** keeps its inline
   date prompt. It is not a commitment — it is a happened-list row whose only missing fact is the
   date — and a modal for one field would regress the §38 walk for no ruling. The register absorbs
   that row in P3.

   **`/review` (high-risk tier, 5 lenses) found five real defects, all fixed in the same pass:**
   - ⚠⚠ **Critical — collapsing a settled split moved the books silently.** Closing the
     deposit/balance split rewrites the deposit to the TOTAL, which is right when nothing has moved
     and catastrophic when the deposit has posted: a $600 commitment with a PAID $200 deposit
     restated it as $600 and the ledger followed, **+$400 with no coach-visible cause**, under a
     banner still promising "nothing moves". The mirror case (a paid BALANCE) was safe only by
     accident — it arrives as `null` and the server refuses to clear a paid half, while *changing*
     a paid deposit's figure is an ordinary edit the server has no reason to question. Now refused
     on the shape change, with the reason. Pinned by four checks in the fixture walk.
   - **The consequence line said "nothing moves" even when a half had posted** — contradicting the
     field hint two rows above it. It now says what will actually happen.
   - **The future-date recovery link dropped the payee and the tags.** They live outside the form
     object, so the hop carried the description and amount but silently lost "who we owe" — on a
     commitment, the worst possible field to lose.
   - **The payment schedule went stale after an import.** It refetched only on a view change, so a
     coach parked on Payables' landing view could import a season of commitments and watch the
     table not change.
   - **Every Money form claimed to be dirty the moment it opened** (the pre-filled date never
     matched the baseline), so Cancel on an untouched form asked "Discard?". The guard's reference
     point is now what the form actually opened with — which also fixed it for the pre-existing
     income/refund doors.

   **Also swept: four stale "Expenses & Payables" references** the first pass missed — one live
   comparison card on Allocations and three in the help guide, including the tab-bar FAQ.

   **The settle path itself was traced end-to-end against the server and found sound** — the half's
   amount and only the half's amount, the commitment total untouched, one entry posted, no second
   record, and no double-post from the books-sync running alongside a mark-paid.

   **Two `/simplify` findings deferred rather than applied** (both judged out of P1's scope, both
   cheap later, neither user-visible):
   - **The legacy-address rewrite could live in `proxy.ts` instead of a client effect.** That file
     already owns this exact pattern for legacy PATH redirects, and `legacyMoneyAddress` is pure
     and edge-safe, so a ~10-line block there would correct the URL before hydration and let the
     hub drop the effect entirely. Skipped because it edits a global request chokepoint that no
     other part of P1 touches, and the current behaviour is verified correct (the tab resolves
     synchronously, so there is no flash — only the address-bar tidy is deferred). ⚠ If it moves,
     **keep the client normaliser as well**: a legacy value arriving by soft navigation would
     otherwise resolve to no tab at all and render a blank pane.
   - **The two faces do not share a data cache**, so a coach who opens both tabs fetches the same
     endpoints twice, and thereafter every save refetches in both. Consistent with how every other
     Money tab already works, and the payloads are one team-season. P1 took the free half of the
     win instead: the Payables face no longer fetches the arrivals list, which it never renders.
     A real fix is lifting the shared reads into the existing money-refresh provider — a sensible
     P3 job, since the register changes what Transactions needs anyway.
2. ✅ **P2 — The form. BUILT ON DEV 2026-08-16** — Owner QA **§43**, migration **246** applied to dev.
   Pills + refund tick box, the shared searchable picker + inline create on all three surfaces, the
   consequence line (every state incl. the out-of-pocket sentence naming the family), `More` fold,
   teaching copy to empty states, `Save`, the Budget Plan form's *Expense* rename.
   **Build prompt:** `COACH_MONEY_SPLIT_P2_BUILD_PROMPT.md`.

   **The picker was adoption, as predicted.** `components/accounting/BudgetItemPicker.tsx` already
   served the Budget Plan and the Org Budget; the money form was the odd one out on two plain
   `<select>`s. P2 taught the existing control to search and to follow a direction, then moved the
   money form onto it. No fourth picker.

   **⚖ The one ruling that changed under owner review, and it changed the DATA:**
   §2 said *"the item list follows the pill — Expense shows money-out items; Income shows money-in
   items."* Argued from the code before building: `budget_items.direction` was **NULL on every
   club- and coach-created row by design** (mig 243, and §3.6 of the taxonomy plan explicitly
   *refused* filtering), so a literal filter would have hidden every word an organization ever
   invented. Put to the owner as a live mockup (artifact `9efa055e`) with three options.
   **Owner ruling 2026-08-16:** *"the items coaches add need to be tied to income or expense, they
   cannot be unlinked or untagged to those. So a coach clicking income should not see expense items
   or vice versa."* So the objection was answered rather than accepted:
   - **Migration 246** backfills every untagged item to `out` (money-in items did not exist before
     mig 243, so the whole prior library is a spending vocabulary — the same reasoning 243 §3d used
     for platform rows) and makes the column **NOT NULL**. All four writers now pass a side.
   - **The filter is real**, with two safeguards: a refund chooses from the **expense** list (the
     tick flips the money, never the list), and a saved record's **own** item is always still
     offered even after that word moves sides — a picker that blanked a saved row's item would be a
     worse defect than the one being fixed.

   **⚖ "Editable afterwards" had no editor, so P2 built one.** §2 said a created item's direction is
   *"editable afterwards"*; nothing in the product could rename or re-point a coach's item, and the
   club-admin editor refuses team-owned rows outright. **Owner ruled: build it.** It is
   **Budget Plan → Manage our items** — chosen over Team Settings (budget content a coach writes
   while working, not configuration) and over Transactions (which P3 reshapes into the register),
   and matching the shape Transactions already uses for *Manage tags*. A team's own words only;
   standard and club words are shown read-only with the reason.

   **Also decided during the build, so P3 inherits it:** the refund tick box is **rendered on both
   pills and live on only one**. A refund of money the team *received* is money going out against an
   income word, and no such record exists — so under **Income** the tick is disabled with the reason
   rather than hidden, because the Money-in door is exactly where a coach reaches for a refund.

   **`/simplify` (4 lenses) — 8 applied, 4 skipped.** The mapper from a `budget_items` row to the
   client shape existed in **four** byte-for-byte copies; two carried comments calling `direction` a
   nullable sorting hint, thirty lines above validation in the same file that now requires it. One
   shared mapper, one shared parser, one shared refusal sentence, and `BudgetItem.direction` tightened
   to non-nullable — which is what surfaced the fourth copy (it was inline inside a `.map()` and only
   a type error could find it). Also: one shared "is this description still the item's own name?"
   test (the two copies had already diverged), one shared item lookup replacing three, two
   per-keystroke scans memoised, two dead CSS rules. **Skipped with reasons:** extracting a shared
   combobox hook (a refactor of a shipped component, outside this diff), sharing the rename row with
   the tag manager (the two modals' other actions differ — a worse abstraction), a shared dropdown
   stylesheet (the picker spans two stylesheet worlds and cannot import either), and parallelising
   the item PATCH's ownership read with its auth check (that would run the read for unauthorised
   callers). Both lenses that looked also agreed `direction` does **not** deserve the build-enforced
   literal-ban guard `line_kind` has — that guard exists because line kinds grew 2→3, and direction
   is permanently binary.

   **`/review` (high-risk tier, 5 lenses) — five real defects, all fixed in the same pass:**
   - ⚠⚠ **Critical — an item created inside the form lost its name, and took a description with it.**
     The picker appends an inline-created word to its own copy of the library; this panel does not
     reload until the save, so every reader that looked the name up by id got nothing for exactly the
     word a coach had just invented. The box rendered "Equipment · " with a blank half — and worse,
     the description rule could not recognise its own pre-fill, so choosing a *different* word
     afterwards left the first one's name on the record. **"Bat bag" saved against Umpire fees:** the
     name/thing mismatch this taxonomy exists to prevent, reintroduced through the create path. The
     form now remembers the name the picker handed it rather than asking a list that lags.
   - **High — the roster never loaded, so the family was never named.** The fetch behind *Paid by* was
     gated on the raw kind state, which `resetForm` deliberately never clears — so opening Add Income
     once, cancelling, then editing an out-of-pocket cost starved it for the rest of the session. This
     release is what made it visible: the consequence line reads the roster, so the one sentence built
     to say WHICH household said *"the team owes that family's family"* — wrong name and broken
     grammar in the same line. Gated on the derived kind now, and the fallback is a whole phrase.
   - **Medium-High (pre-existing, fixed) — money access leaked across teams.** Both the item list and
     the item create asked "can this coach see/write money on SOME team?" and then accepted any team
     they were merely assigned to. Assistant money access is three-state and per team precisely so a
     head coach can withhold it — so a head coach on one team could read another team's budget
     vocabulary and add words to it while holding `money: 'off'` there. The PATCH route written in
     this release already scoped it correctly; the older doors now match.
   - **Medium — a rename was invisible one tab over.** The item manager refreshed its own screen but
     never bumped the shared money revision, so the money form's picker kept the old name and the old
     side for the rest of the session — silently suppressing the "on the other side" badge this same
     release built. Every other money write path bumps it; the new modal had not joined them.
   - **Advisory, NOT fixed, out of scope and pre-existing:** publishing a club-wide item absorbs
     same-named duplicates and re-points budget lines and expenses before deleting them — but not
     `rep_team_money_in`, whose FK is `ON DELETE SET NULL`. Any income or refund filed against the
     absorbed twin silently loses its item. It predates this work (it arrived with mig 243), but
     mig 246 makes it *more* reachable, because the uniqueness index does not include direction, so
     two same-named words on opposite sides can now legitimately coexist and be merged. **Logged as
     debt; needs its own fix.**

   **What the checks do and do not prove:** `check:layout` measures the three screens with the modal
   **closed**, so it proves the tab bars and lists still lay out at four widths and proves nothing
   about the form. Its 16 "new" findings were traced to the portal's unread-notification badge —
   `coach-roster`, untouched by P2, produces the identical six — so they are fixture drift in shared
   chrome, deliberately **not** re-baselined.
3. ✅ **P3 — The Register. BUILT ON DEV 2026-08-17** — Owner QA **§46**, migration **247** applied to
   dev. The date-sorted book with running balance; derived rows from Dues / Fundraising / Club;
   filter strip; scheduled overlay with projected balances and Mark paid; Overview's next-30 panel
   becomes its window; the exports move; **the arrivals list finally retires the name "Money in"**.
   **Plan:** `COACH_MONEY_REGISTER_P3_PLAN.md` · **build prompt:** `COACH_MONEY_SPLIT_P3_BUILD_PROMPT.md`.

   **⚖⚖ THE BUILD-BLOCKING TEST WAS UNPASSABLE, AND THE FAULT WAS NOT IN THE REGISTER.** §4.2 says
   the balance at Today must equal Cash on hand. Reading the code before building found that figure
   already wrong in three ways, and all three were put to the owner before a line was written:
   - ⚠⚠ **Recorded income and money back reached NO cash figure in the product.**
     `money-summary/route.ts` never read `rep_team_money_in` (mig 243). A coach recorded $500
     arriving and Cash on hand did not move; it reached Budget vs. Actual as revenue and stopped.
     The writer's own comment said the opposite ("CASH ON HAND, NOT COLLECTIONS") — the reader was
     simply never wired. **A live money defect, independent of this phase.**
   - **The dues input was the CAPPED figure** — capped per schedule so an overpayment cannot
     distort a balance, which is right for the Collections tile and wrong for cash, and computed
     per schedule so a payment against a player without one was invisible to it.
   - **Club money had no season at all.** `rep_team_payment_requests` carried only a team, so
     approved requests were summed **team-lifetime** into a figure whose every other input was
     season-scoped. `lib/coach-season-settlement.ts` had refused to count club money for years for
     exactly this reason, printed a caveat on the close-out card, and named the fix in a comment.

   **Owner rulings, 2026-08-17:** *fix the cash figure AND the close-out pot from one definition*,
   and *give club money a real season now* (migration 247 + backfill) rather than showing
   out-of-season rows or printing a caveat. So the pot now counts recorded arrivals and club money —
   **family refund amounts at season close-out go up**, because the pot had been understating what
   the team held — and `clubMoneyUncounted` retires with the warning line it fed.

   **Three design decisions taken during the build, so P4 inherits them rather than re-litigating:**
   - ⚠⚠ **An out-of-pocket cost sits on the book and does not move the balance.** It is real
     spending on a real record, but no team cash moved (`expenseTotals().cashPaid` has always
     excluded it). The row shows its amount in **Money out**, carries a *No team cash* chip, and
     repeats the previous balance beside it. Hiding it would lose an expense; moving the balance
     would break the identity the whole screen rests on.
   - **Money handed back to families is a derived row.** §4.2's list of derived sources omitted it;
     without it the balance is off by every payout the team has made.
   - **A fundraising row is dated by the day it was recorded**, because `rep_fundraiser_entries` has
     no date column at all. Said on the row rather than guessed at.

   **Also done here, both explicitly deferred to P3 by P1:** the inline "when was this paid?" prompt
   is gone (every Mark paid goes through the money form now — P1 said in as many words that "the
   register absorbs that row in P3"), and the two money faces finally **share one read cache** —
   `/expenses`, `/budget-items` and `/budget-plan` ran twice for a coach who opened both tabs, and
   thereafter on every save. ⚠ The write paths now **bump before they reload**: a cache keyed per
   revision would otherwise replay the pre-save answers into the screen that just saved.

   **The claim has a permanent check:** `npm run check:register` reads `/register` and
   `/money-summary` for one team and fails if the closing balance and Cash on hand disagree, if the
   rows do not sum to it, if a projection leaks into the settled close, or if any row carries both
   directions. It also **exits non-zero when the fixture is too thin to prove anything** — a team
   without all three derived sources cannot fail the way this used to. The UAT fixture gained an
   out-of-pocket cost, an income row and a refund so it can.

   **`/simplify` (4 lenses) — 8 applied, 4 skipped. The most valuable finding was a comment that
   lied:**
   - ⚠⚠ **This file's own header claimed the two cash figures "reconciled to" one shared function,
     and they did not.** `money-summary` hand-rolled `r2(moneyIn − moneyOut)` over nine float totals
     and never imported the register's arithmetic at all — the identity was held together by prose
     and by a check script nobody runs in CI. It now hands its category totals to `cashOnHandCents`
     as movements and takes the answer, so **the two figures are one arithmetic in integer cents**
     and a source added to one and not the other is a visibly missing argument rather than a silent
     penny-drift. ⚠ The season close-out pot remains a third, separate arithmetic — that is now
     *stated* in the header rather than glossed, because folding a pure dependency-free module that
     runs under plain `node --test` into this was a bigger, riskier change than the finding was
     worth.
   - ⚠⚠ **The shared dues-remainder derivation had been extracted for two callers and wired into
     one.** The payment schedule still carried its own hand-written copy of the per-player loop —
     the exact thing the new module's header warns about — so the two screens quoted a family the
     same figure only by two authors agreeing. Wired up; the guard test that polices "dues
     definitions have one home" caught the swap and now names the new home.
   - **"Bump before load" was a comment repeated at three write sites** rather than one function —
     the identical shape this same file's `goToTab` wrapper exists to prevent, and says so. One
     `refreshAfterWrite`, so the fourth write path cannot get the order wrong.
   - **The register route made four sequential round trips where two do.** Three later `await`s
     (item names, club instalments, dues instalments) each sat in their own `if` block and depended
     only on the first wave. One second wave now.
   - **The register's derived view was rebuilt on every keystroke of the money form** — the modal is
     an overlay, so the book beneath it re-filters and re-sorts on every character typed. Memoised.
   - **Three near-identical dues row builders** became one `duesRow` helper: where a dues row links,
     what its chip says, and whether it can be settled here are properties of the workspace, and
     were being restated three times with nothing keeping them in step.
   - **Dead on arrival:** the `money-in` export dataset (split into `income` and `refund` files) and
     the `.inlinePrompt` stylesheet block (its control retired) — both deleted, both leaving a note
     saying what replaced them and, for the CSS, the two specificity lessons that outlive the rules.
   - **Skipped with reasons:** sharing `toCents`/`toDollars` with `season-settlement.ts` (three pure
     modules keep a local copy by existing convention, and this one additionally coerces PostgREST
     strings — "sharing" would smuggle a money-behaviour change into a cleanup); a shared formatter
     between two diagnostic scripts (the twin belongs to the concurrent item-integrity project);
     unifying `RegisterHalf` with the panel's `MarkPaidAction` (three values, more machinery than
     the duplication costs); and merging `/register` with `/money-summary` (the lens agreed two
     routes is right — the summary is on every Money page's critical path and would pay for per-row
     assembly it never renders).

   **`/review` (high-risk tier, 5 lenses) — five real defects, all fixed in the same pass. Notably,
   the money reconciliation itself came back CLEAN:** two lenses independently traced every register
   row producer against every term feeding the cash figure — dues receipts, realised fundraising,
   club funding and payments, recorded income and money back, cash-paid expenses, allocations,
   payouts — and found no double count, nothing missing, and no cross-team or capability hole. The
   defects were all around the edges:
   - ⚠⚠ **High — nothing decided which response won.** Every write on this screen reloads twice (once
     explicitly, once because the revision bump re-fires the load effect) and neither load carried a
     request sequence. That has been true here since long before P3 — but the register turned a
     sub-list refresh into a WHOLE-SCREEN one, so the symptom changed: a coach marking two
     commitments paid a few seconds apart could have the first write's slower response land last and
     **watch the payment they just made revert to Scheduled in front of them.** Both loads now stamp
     each call and discard anything that is no longer the newest — the pattern `MoneyNextThirtyDays`
     one file over has used for exactly this since it shipped. ⚠ The guard sits after every body is
     READ and before anything is WRITTEN; a guard with awaits after it guards only what it precedes.
   - ⚠⚠ **Medium — a comment that lied, again, and this time it was mine.** The new demo tour step
     claimed its "the number at the top is the team's cash" sentence "cannot quietly stop being true
     without that check going red" — but `check:register` needs a dev server and a Playwright
     session, so it is not in `verify:changed` and nothing in the build re-runs it. The narration was
     promising a guarantee nobody had wired up, which is precisely the demo-drift failure CLAUDE.md
     describes. The claim is corrected in place rather than the sentence softened: the identity IS
     exact, and the comment now says where the check actually lives and that it is run by hand.
   - **Medium — the export blanked a balance the screen deliberately shows.** On an out-of-pocket
     row the register repeats the previous figure (the whole point: the column stays readable and the
     chip says why), but the file emptied that cell — a gap in the one place this design says not to
     leave one. The Status column already carries `Settled — no team cash`.
   - **Medium — the Overview's "Money In" caption named three terms for a figure that now holds
     five.** A coach with sponsor income or a refund saw a total larger than the caption beneath it
     explained, on the card whose job is to explain it. Both captions now state the question they
     answer rather than a term list that was already one edit behind. (Its neighbour was wrong the
     same way *before* this release — it never mentioned money handed back to families.)
   - **Medium — the shared read cache evicted by key rather than by identity.** A read orphaned by a
     bump and failing afterwards would delete the healthy replacement a later caller had installed.
     No stale data either way; it simply stopped saving the request it exists to save.

   **Refuted and dropped (2):** a claim that a repeated identical deep link from the Overview window
   would be ignored — reaching a second window row means passing back through Overview, whose address
   carries no filter, so the value round-trips through absent and the effect re-fires; and a
   `?filter=club` deep link on a standalone team, which has no club lane to generate the link.

   **⚖ One finding accepted rather than fixed, and it belongs to P4.** Between seasons, the club
   payment-request form is still offered (that panel's write gate has never been season-aware) and
   the server now refuses the write, because a request must name a season. Before migration 247 it
   *succeeded* and created a seasonless record — which is the bug being fixed — so this is a worse
   message on a safer outcome. Gating that screen properly is P4's, which rebuilds it; recorded in
   Owner QA §46 §I so the walk sees it rather than discovering it.

   **Advisory, not a defect:** a lens asked whether a recorded sponsor **pledge** belongs in the
   scheduled overlay given the "nothing pending a decision" rule. §4.4 lists recorded sponsor pledges
   as qualifying — a pledge is an arrangement the team has, not a decision someone else may refuse —
   so this is ruled, not drift. It never touches the settled balance either way.
4. ✅ **P4 — Club. BUILT ON DEV 2026-08-17** — Owner QA **§49**, migration **250** applied to dev.
   The merge (band + two blocks + one empty state), the name, the filing, the report, the season
   scoping, the between-seasons record and the close-out blocker.
   **Build prompt:** `COACH_MONEY_SPLIT_P4_BUILD_PROMPT.md`. **Rulings: §0b above** — read that
   first; it is the record of what the owner decided and what it overturned.

   **⚖⚖ THE PHASE GREW THREE TIMES, AND EVERY TIME IT WAS THE OWNER PUSHING BACK ON THE MOCKUP.**
   The merge itself is the small half. What the review added:
   - ⚠⚠ **Budget vs. Actual contained NO club money at all** — found by answering the owner's
     question *"shouldn't the request name which budget category/item?"*. The report reads the plan,
     expenses, arrivals, fundraising and dues, and neither `rep_allocation_installments` nor
     `rep_team_payment_requests`. On a club-run team that is frequently the season's largest line,
     missing from the one screen that compares spending to plan. **Migration 250** gives both tables
     a team-side `budget_item_id`/`budget_category_id`, the request form gains the shared picker, a
     coach files their own share of a club bill, and the report reads all three. The same shape as
     P3's three Cash-on-hand defects: a figure a coach trusts, quietly missing an input.
   - ⚠⚠ **Neither club list was season-scoped** — the ask was only about REQUESTS, and the evidence
     was wider: allocations were team-lifetime too, and the pair were the last such readers in the
     money area. On any team past its first year the Allocations tile and the Money overview
     described the same team and disagreed; nothing put them side by side, which is why it survived.
   - ⚠ **The tab vanished between seasons** rather than going read-only, which predates and
     contradicts the history-in-place ruling.

   **Three decisions taken during the build, so anything after this inherits them:**
   - ⚠⚠ **The picker offers the money-OUT side on ALL club money, including a request where the
     money comes IN.** A `charge_to_org` is a reimbursement, and what a reimbursement is FOR is a
     cost — the refund rule (mig 246 + P2): the direction flips the money, never the list. On the
     report it therefore NETS into the item it repaid rather than counting as revenue.
     `rep_team_money_in`'s own table comment already states the consequence of the alternative:
     *"counted twice, a $325 reimbursement makes a season look $650 better than it is."*
   - **The filing lives on the SPLIT, not the allocation, and not the instalment.** The parent is the
     club's object spanning every team; the instalments are one bill's payment schedule. One filing
     per bill, filed by the coach — the club does not know this team's vocabulary, and two teams may
     legitimately file one shared cost differently.
   - **Club money is excluded from a money-tag cut of the report.** Club records carry no tags, so
     folding them in would put the same untagged bill inside every tag's total.

   **⚠⚠ One defect caught during the build, before any review, and it is the shape this file has
   warned about twice:** the report's **month grid is built from the raw expenses array**, not from
   the rollup — so adding club money to the rollup alone put it on the Statement and Categories and
   left it **off Months**. One screen, two different totals for one season. That is the identical
   defect the refund note in that file records having already shipped once. Club COSTS are now
   pushed to the grid explicitly; club REFUNDS need nothing, because they arrive through the
   rollup's own refund loop. ⚠ An UNPAID club instalment is deliberately kept OFF the grid's
   Scheduled row (the Payment schedule and Next-30 already carry it) — stated so the omission reads
   as a decision.

   **⚠ The close-out blocker is a hard block, and it is the one thing in this phase most likely to
   need reversing.** An unanswered club request now refuses the season close, beside the families who
   still owe. It exists because seasons are independent by ruling, so a closed season's open loop
   lands where nobody looks again. The escape is the coach's — chase the club or withdraw — and both
   the checklist line and the server's refusal name it. **If the walk finds it too strict it is a
   one-line change to a warning** (`closeOutBlockers`, `lib/season-settlement.ts`).

   **⚠⚠ Two claims in the build prompt were FALSE**, both found by reading the code (§0b records
   them): the demo world was already seeded with club money a day before the prompt was written, and
   the "between seasons the form is still offered" defect described a screen that could not be
   reached. Owner QA §46 §I is annotated accordingly.

   **Deliberate baseline edit:** `coach-allocations` + `coach-payment-requests` → `coach-club`, the
   mirror of P1's `coach-expenses` → `coach-transactions` + `coach-payables`.
   **`check:register` passes** — the closing balance still equals Cash on hand to the cent with all
   three derived sources present. ⚠ **Budget vs. Actual has no equivalent automated identity**, which
   is why §49 §C is hand-walked.

   **`/simplify` (4 lenses) — 6 applied, 2 skipped.** The valuable half was a duplication three
   lenses landed on independently: the "collect filing ids → select `budget_items` +
   `budget_categories` → build two Maps" block had been hand-written in **three** routes, while the
   register one directory over carries a comment saying exactly why that is a trap (*"two ways of
   turning an item id into a word is how the two halves of a table start disagreeing"*). All three
   now take the names from a PostgREST join, `getRepAllocationSplitsForTeam` returns them, and the
   report **calls that reader instead of re-implementing it** — which also collapsed three
   sequential round trips into one wave on a report screen's critical path. Also: the per-bill
   figures are memoised (the merge put a form in the same component as the bill list, so every
   keystroke was re-scanning every instalment — the identical trap two sibling panels carry warnings
   about), one selection builder replaces two, and `clubRequestReportRole` — which was **dead code
   documenting a rule its own caller re-derived by hand** — became `clubRequestIsReimbursement` and
   is now called. ⚠ The union → predicate change was forced by `budget-line-kind-guard`: the union
   made its caller write `=== 'cost'`, and removing the literal was the honest answer rather than
   claiming an exemption. **Skipped:** a pluralisation helper (the four sentences differ by audience
   on purpose), and enforcing the money-out direction inside `resolveBudgetItem` — no other caller
   passes a direction, and a strict server check would refuse an ordinary edit of a record whose
   word had since moved sides, which the picker deliberately still offers.

   **⚠⚠ `/review` (high-risk tier, 5 lenses) — 8 real defects, all fixed in the same pass. Three of
   them moved or exposed money, and TWO were pre-existing:**
   - ⚠⚠ **High, pre-existing — marking a club instalment paid could post the ledger transfer TWICE.**
     Both doors (the coach's and the club admin's) read the instalment, confirm it is unpaid, post a
     real double-entry transfer, then stamp `paid_at` — and the stamp filtered on `id` alone. A
     double-tap on a slow connection, or the tab open on two devices, and both requests passed the
     check, both posted, both returned 200. The instalment read as paid ONCE while the ledgers had
     moved the money TWICE. Fixed at the writer (`.is('paid_at', null)` + a null return), so both
     callers 409 instead of reporting success. It does **not** unwind the losing request's transfer —
     making the RPC and the stamp atomic is a bigger change than a review carries; what is closed is
     the double post. **This is the same shape the 2026-08-16 review fixed on payment requests; the
     sibling endpoint had simply never been given the same treatment.**
   - ⚠⚠ **High — the report's CUMULATIVE CHART never got club money.** This report renders club costs
     in **three** independent places and the first pass wired two: the statement (rollup) and the
     Months grid. The chart above the statement kept reading raw expenses only, so on a club-run team
     it sat directly above numbers it contradicted — and the club's bill is frequently the season's
     largest line. ⚠ Costs only: this chart has never netted refunds of any kind, so feeding club
     reimbursements in would make club money the one kind that nets there. **That the altitude lens
     had already called the two-feed shape a defect risk, and a third feed then turned up, is the
     finding worth remembering.**
   - ⚠⚠ **High — a finished season's club requests were still writable.** The GET moved to
     `resolveCoachTeamRead` (which admits a finished season so the tab can render it read-only), but
     the edit/withdraw route kept its old hand-rolled chain with no season resolution at all. Since
     `startNextRepSeason` completes a season **without** checking for open club requests — only the
     settlement close-out does — a pending request outlives its season, and a direct PATCH/DELETE
     still rewrote or destroyed a record every screen showed as locked history. The client's
     `isReadOnly` was the only thing in the way, which is not a gate. Both handlers now resolve a
     LIVE season **and** re-assert `program_year_id` in the WHERE clause — "a live season exists" is
     not the same claim as "this record belongs to it".
   - **Medium — the new filing modal had no discard guard.** It looks trivial, but a coach can create
     a brand-new budget word inside it, so tapping the backdrop threw away work that existed nowhere
     else — while its sibling window in the same component prompts.
   - **Medium — a save that lost the race left the row lying.** When the club approves mid-edit the
     server 409s correctly, but the list underneath kept the *Awaiting the club* chip on a request
     already decided. The failure path refreshes now; the window keeps the coach's typing.
   - **Low ×3 — comments that had become false**, including the register overlay's own control still
     saying *"nothing pending a decision is ever in it"* one release after the owner reversed that,
     and `BUDGET_ITEM_REFERENCES`' doc still counting "four tables" at six.
   - **Plus a test gap the regression lens named:** `closeOutBlockers` gained a third condition with
     no case of its own, in a file whose existing cash-shortfall test is literally labelled *"the
     regression case"* from the last time that happened. Three cases added.

   **Not fixed, logged as debt:** `paidDate()` slices a timestamp in UTC while the club feeds use the
   org's day key, so an ordinary expense and a club bill paid the same evening near midnight can land
   in different months. Pre-existing, narrow, and correcting it would move existing expense rows
   between months — a behaviour change beyond this phase. Likewise the report's **three** cost feed
   points (rollup / month grid / cumulative chart): the deep fix is to derive all of them from the
   rollup the way refunds already are, which means re-deriving the pre-existing expenses feed too.

⚠ P1–P3 all touch one form and one tab bar — **run them serially, never as parallel sessions**
(the lesson the taxonomy plan's §7.1 is built on).

⚠ **THAT RULE IS ABOUT THIS PLAN'S OWN PHASES, AND ONE OTHER PROJECT IS DELIBERATELY EXEMPT.**
`COACH_BUDGET_ITEM_INTEGRITY_PLAN.md` (the three doors that delete a budget word out from under the
records pointing at it — found by P2's `/review`) **runs beside P3 on purpose**: it owns the two
admin item routes, the item manager modal, the picker's internals and its own migration, while P3
owns the Transactions face, the Overview panel and the exports. Neither edits the other's files —
the boundary is tabulated in that plan's §6, checked file by file rather than assumed. ⚠ Its first
phase must reach production **with or before** this plan's P2, because two of those doors are live
and migration 246 is already in the queue. Fixture: **`qa-money-lab`** is already prepared
(2026-08-16) — do not rebuild it; P3 will want one team with derived rows from all three sources
(the demo 14U qualifies).

**Environment gates:** §29 (migs 238/240/241/242) and §38 (243/244) must reach production before
any of this promotes; the date-fix + editability release lands ahead and is inherited. Other chats
share this working copy — re-check the branch, stage explicit paths.
