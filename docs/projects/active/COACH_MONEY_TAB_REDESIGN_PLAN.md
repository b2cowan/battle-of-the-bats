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

- **The club tab's name** — *Club* (warm, what coaches say) vs *Org* (what the product's own
  badges already say: "From Org"). §6. Gets settled in the P4 mockup pass.
- **The register's default for the scheduled overlay** — recommendation: **on**, with the Today
  rule separating settled from projected (§4.4).
- **Payables opens on the Schedule view** — recommended yes; mild, reversible.

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
3. **P3 — The Register.** The date-sorted book with running balance; derived rows from Dues /
   Fundraising / Club; balance ≡ Cash on hand (build-blocking test); filter strip; scheduled
   overlay with projected balances and Mark paid; Overview's panel becomes its window; exports
   move; **the arrivals list finally retires the name "Money in"** (the rename P1 deliberately
   deferred until the register's separate Income and Refunds filters make the word true).
   *Owner QA: the balance reconciliation and the overlay.*
   **Build prompt:** `COACH_MONEY_SPLIT_P3_BUILD_PROMPT.md` (fresh chat).
4. **P4 — Club.** Its own short mockup pass (name settled: Club vs Org), then the merge; demo seed
   gains club money. *Owner QA: the combined story + the register's club rows.*

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
