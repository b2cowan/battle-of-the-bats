# Kickoff prompt — Money redesign Phase 3: the Register

*(paste into a fresh chat)*

**Build Phase 3 of the Money screens redesign, and ONLY Phase 3.** The register's design was ruled by
the owner on 2026-08-16 and is recorded in `COACH_MONEY_TAB_REDESIGN_PLAN.md` §4 — **carried
verbatim, not re-litigated**. Do not reach into P4 (the club tab merge). P1 (`b3d9694b`) and P2
(`91d1c2c8`) are on dev and are what you are building on.

---

## Read first, in this order

1. **`COACH_MONEY_TAB_REDESIGN_PLAN.md`** — §4 in full (the register: columns, the balance rule, the
   filter strip, the scheduled overlay), §8 (constraints, none open), §10 P1 and P2 (what shipped,
   and the decisions each took that you inherit).
2. **`OWNER_QA_LEDGER.md` §38, §41 and §43** — what the screens do today. All three are **built and
   unwalked**; their wording predates the release after them, so read §43's annotations first or
   §38's walk will read as describing a different product.
3. **`COACH_BUDGET_ITEM_INTEGRITY_PLAN.md` §6** — a second session is working in this area
   concurrently. §6 names exactly which files are theirs and which are yours. **Read it before you
   touch `BudgetItemPicker.tsx` or the two admin item routes — you should not need to.**

## ⚠ Verify before building

- **Both P1 and P2 are committed.** Confirm what the code does before trusting any summary of it —
  the plan has been wrong about this codebase before.
- ⚠⚠ **A PARALLEL SESSION SHARES THIS WORKING COPY**, and during P1/P2 sessions committed each
  other's in-flight work **twice in two days**. Re-check the branch is `dev`, stage **explicit
  pathspecs only** (⚠ bracket directories like `[teamId]` need `:(literal)` or they stage nothing),
  and run `git show --stat HEAD` after every commit. Expect files you never touched to be modified.
- ⚠ **Nothing in the money area has been owner-QA'd yet.** §38, §41 and §43 are all owed, and
  migrations 236–246 are dev-only. If a walk turns up a design problem it is under your feet — ask
  before building on anything that looks like it might move.

---

## What Phase 3 builds

### 1 · One dated book

**Date · What · Category · Item · Money out · Money in · Balance.** Newest first. Each row's balance
is the balance *after* that row. Amounts always in their direction's column — **no signed single
column, ever** (plan §2, superseded draft 2).

### 2 · ⚠⚠ The balance IS Cash on hand, decomposed — this is build-blocking

**The running balance at Today must equal Cash on hand, and every row is one of its movements.** That
is what forces the register to include money the coach did not type here:

- **Recorded rows** — expenses, income, refunds. Tap opens the money form; fully editable.
- **Derived rows, read-only here** — dues payments received, fundraiser proceeds, sponsor receipts,
  settled club amounts. Each carries a chip naming its workspace and **tap navigates there** to act.

**If the balance and Cash on hand can disagree, the register is wrong by construction.** Prove it on
a team with all three derived sources (the demo 14U qualifies) — not by reading the code.

⚠ **Nothing is ever CREATED in the register.** It is a view; "one row, one source" holds because it
cannot grow a create path.

### 3 · Filters, not sub-tabs

One strip: **type** (All · Expenses · Income · Refunds · from Dues · from Fundraising · from Club),
**category/item**, and the **scheduled toggle**. ⚠ **When a filter hides rows, the Balance column
hides with it** — a running balance over a subset is a number that looks like cash and isn't.

### 4 · The scheduled overlay

On (recommended default, plan §0), the book runs past Today into what is scheduled, with **projected
balances visually distinct from settled ones — never by colour alone**. Qualifies: unpaid
commitments, upcoming dues installments, recorded sponsor pledges, approved-but-unsettled club
amounts. ⛔ **Never anything pending a decision** — an unapproved request appears nowhere.
Scheduled money-out rows offer **Mark paid**, which opens the money form pre-filled and asks when.

### 5 · What it replaces and feeds

- The Expenses and Money-in lists retire into it; their exports become filtered exports of the register.
- **The Overview's next-30-days panel becomes a window into it** (deep-link, overlay on).
- ⚖ **The arrivals list finally stops being called "Money in."** P1 kept the name deliberately,
  against §6, because the list held income AND refunds and the empty state taught they are opposites.
  The register's separate **Income** and **Refunds** filters make the word true of the rows under it
  — **this is the release that retires it.** Mockup: artifact `eca99e68`.

---

## 🔒 Constraints (plan §8 — none open)

Money back ≠ paid out of pocket (count credits — exactly one) · nothing ever changes a dues schedule,
and the register *displays* dues movements without touching one · one row, one source · never both ·
brackets never a minus sign **on the report** (the register needs neither — its columns carry
direction) · the register shows **no variance** · working season only, no `?year=` anywhere
(`coach-history-endpoint-guard` is the contract) · sport-neutral vocabulary.

---

## ⚠ What P1 and P2 leave you

- **`formMode` resolves `settle | edit | add` once** — read it, never re-test `settling`/`editing`.
- **The discard guard compares against what the form OPENED with.** Any new opener must set it.
- **The consequence line covers every form state.** A register-opened row must not bypass it.
- **The form's kind is two pills + a refund tick**; a refund sits on the *Expense* side. Do not
  reintroduce a three-way switch in a filter label — the register's **Refunds** filter is a view of
  rows, which is allowed; the *report* still carries no row labels.
- ⚠ **`/simplify` deferred one thing that is now yours:** the two faces do not share a data cache, so
  a coach who opens both fetches the same endpoints twice and every save refetches in both. The fix
  is lifting the shared reads into the existing money-refresh provider — **a sensible P3 job, because
  the register changes what Transactions needs anyway.**

---

## Done means

- `npm run check:layout --only=coach-transactions,coach-payables,coach-budget`. ⚠ **Run one screen
  you did NOT touch first** (`--only=coach-roster`): the portal's notification badge produces 6
  findings on every screen, and P2 lost time reporting them as new. Do not re-baseline them.
- **A fixture walk on `qa-money-lab`**, plus the balance ≡ Cash on hand proof on a team with derived
  rows from all three sources. ⚠ **A green walk over a thin fixture proves nothing** — dev holds very
  little team-created data; create what you need.
- `verify:changed` and `typecheck`. ⚠ `verify:changed` fails on a **pre-existing** schema-parity gap
  (236–246 are dev-only) — run the checks after that gate directly.
- `/docs` for the help guide, then re-read the demo tour and moments copy for sentences about the
  Expenses/Money-in lists, then `npm run check:demos`.
- Offer `/simplify`, then `/review`, before handing off. **P1's review found a Critical; P2's found
  another plus two pre-existing security holes.** The money area has produced a real defect on every
  pass so far — budget for it.
- A **new Owner QA Ledger section** (annotate §38/§41/§43, never renumber), the plan's §10 P3 line,
  the PM brief and `TODO.md` per the anti-drift rule — positive facts with anchors.

## ⚖ Disagree out loud, before the work

If the ruled design is wrong, say so **before** building it, arguing from what the code does rather
than what the plan claims. Both previous phases produced better outcomes that way: P1 kept the
arrivals list's name against the plan's own §6, and P2's "the item list follows the pill" turned out
to be unbuildable as written — the data made it hide every word a club had ever invented, and the
owner re-ruled it into a migration. Re-frame the question if it is the wrong one. Do not manufacture
disagreement.
