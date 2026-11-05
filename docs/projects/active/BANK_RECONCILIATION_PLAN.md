# Bank reconciliation — both portals — Implementation Plan

> **Status:** Planned; **asks B1–B12 RULED 2026-11-04, all twelve A (as recommended)**, pasted back from the review page with
> no notes. Next: R0, the owner mockup session (`BANK_RECONCILIATION_DRAWING_PROMPT.md`).
> **Created:** 2026-11-04 (planning session, from `BANK_RECONCILIATION_PLANNING_PROMPT.md`)
> **Branch:** dev
> **PM brief:** `BANK_RECONCILIATION_PM_BRIEF.md` · **Owner review page (asks + paste-back):**
> `BANK_RECONCILIATION_ASKS.html`, published https://claude.ai/artifact/R8b4LM7LEUTgeCgJtTm1Jh
> **Plan-of-record slot:** `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` § "Bank reconciliation — both portals"
> **Drawings (R0 round 1, 2026-11-04, after /design):** `BANK_RECONCILIATION_DRAWINGS.html`, published
> https://claude.ai/artifact/6s8iTzaxGQDfAqugrSMbmZ. **Drawing asks 1–14 RULED 2026-11-04, all A (as recommended),
> pasted back with no notes.** Asks 12 and 1 amend B10 and B5 (recorded under each). §6 records what was drawn and the
> rulings. **Drawings approved by the owner 2026-11-04 (R0 closed).**
> **R1 built and committed `502a69d39` 2026-11-04** (migs 436 + 437 applied to dev; prod owed before the promote that
> ships R2, recorded in `MANUAL_PROD_STEPS.json`; engine `lib/bank-check.ts` + 26 tests; P4 measured; /simplify and
> /review done and fixed in that commit; schema snapshots left out of it, they also carry other sessions' tables).
> **R2a built and committed `af458c945` 2026-11-04** (the club's reader, server only; /simplify + /review done; record under §7 R2). P4
> club-pays measured on Stripe's side (holds).
> **R2b built 2026-11-04** (the routes, server only; mig 439 applied to dev, prod owed with 436 + 437; record under §7 R2).
> /simplify then /review (high tier) offered before the commit. **Next:** R2c (the Bank tab, desk).
> **R2b-3 built and committed 2026-11-05** (a book move can't race a tick, a keep-out or a fee; mig 442 applied to dev,
> prod owed with 436 + 437 + 439 + 440; /simplify + /review (high) done; record under §7 R2).
> **R2c (desk) committed `7d7b79cdb` 2026-11-05; R2d (the phone, R2's close) built 2026-11-05, /simplify + /review (high)
> done; R2 COMPLETE at R2d's commit** (record under §7 R2; owed before the promote: migs 436/437/439/440/442 to prod).
> **Next:** R3 (club touchpoints).

## Goal

A club treasurer and a team's coach (or team treasurer) can sit down with a bank statement, tick off what the bank shows
against what their FieldLogicHQ book shows, see a difference of $0.00, and mark that statement checked. The club and the
team then each carry a quiet "bank checked through {date}" fact, and the club can see that fact for every team. This is
the customer's own money. It does not touch what FieldLogicHQ charges.

---

## 0. What is ruled (do not reopen) — recorded as ruled, nothing added

| # | Ruling | Source |
|---|---|---|
| R-a | **Both portals:** the club's Accounting and the coach's team Ledger. | owner 2026-10-06 |
| R-b | **Planned and drawn before Stage 8; inside the Club release.** | owner 2026-10-06, 2026-10-12; `BUSINESS_DECISIONS.md` 2026-10-16 |
| R-c | **Marketing claims only what ships:** "payment reconciliation" stays out of every Club page until this ships. | `BUSINESS_DECISIONS.md` 2026-10-19 (:904–914) |
| R-d | **D1:** the coach's records are the source of truth for team money; the club reads them. | Club Tier plan D1 (:465) |
| R-e | **Coaches Portal rules bind the coach half:** a season is live until closed; a closed season is one page; unsettled money warns, never blocks; a history shelf needs its own owner mockup session. | `CLAUDE.md` (2026-08-18) |
| R-f | **Club fiscal year:** a closed fiscal year is read in place on the club's money tabs, locked. | owner 2026-10-07 (Stage 3c) |

Everything else in this file is a recommendation awaiting a ruling.

---

## 1. Premises — where the one-line definition is wrong (said before the work)

**P1. The unit is a bank account, not a book.** The project index says *"a treasurer checks each club book against the
bank statement."* A club's books are its General book (`accounting_ledgers.entity_type='org'`), one per tournament, and
one per house-league season (`isClubBook`, `lib/club-money-figures.ts:639`). They almost always share **one** chequing
account. Stage 12 proves it: one Stripe payout can carry tournament and house-league payments at once
(`lib/online-payouts.ts:104-171`), so a book-by-book check can never balance. Transfers between two books in the same
account never reach the bank at all. **The check is per bank account; each club book belongs to one account.** (Ask B1.)

**P2. A coach's Cash on hand is not a bank balance.** `cashOnHandCents` (`lib/coach-register.ts:297`) is the opening
balance plus every settled movement: cash in an envelope, a cheque not yet deposited, and the bank. Checked straight
against a statement, it differs by exactly the money that never went through the bank. A row a family paid straight to a
vendor (`rep_payable_payments.paid_by_player_id`) never touched the team's account either. **The coach check needs a way
to say "this didn't go through the bank."** (Ask B6.)

**P3. The coach half has a reader the definition doesn't name: the club.** Canadian minor-hockey associations commonly
require every team to send in a monthly bank reconciliation (sourced, §3). Cochrane: "bank reconciliations must be
performed on a monthly basis". North Durham: emailed to the Director of Finance by the 10th. Kitchener: a final
reconciliation at season end. So a coach's "checked through {date}" that the club can read is the half's real payoff, and
it sits inside D1: the club reads the coach's fact; there is no second team number. (Ask B9.) A full "submit to the club
for review" flow is a bigger thing and is recommended **out** of the first release (B12).

**P4. Stripe deposits are net; the books are gross.** A landed online payment posts its full amount to a club book
(`online_card`/`online_bank`, migs 358/374/390). The bank receives one payout, net of Stripe's fee, grouping many
payments. Where the club pays the fee, a "Payment processing" cost line is also booked (mig 358:363-366). **Whether a
payout's book side sums exactly to the deposit, in both who-pays-the-fee cases, is unverified.** Stage R1 must prove it
with real test-mode payouts before the grouped tick is built. If it doesn't sum, the tick shows the gap as a named
line, never a silent difference.

**Not a disagreement:** both portals is right, and one engine should serve both. The arithmetic (statement balance vs
ticked balance, outstanding list) is identical; only where the lines come from differs.

---

## 2. What is true today (verified against the code; helper censuses 2026-11-04, cited lines opened)

### Club Accounting
- **Lines:** `accounting_entries` (amount numeric dollars > 0; direction from `entry_type` income/expense/transfer_in/
  transfer_out; `status` pending|posted|void; free-text `payment_method`; `linked_entry_id` pairs transfer halves).
  Books: `accounting_ledgers`. Source: dev snapshot (watermark mig 434) and `DATA_DICTIONARY.md` :8412–8515.
- **No bank account, statement, cleared, matched or reconciled concept exists anywhere** on club or team money. The near
  hits (`online_payments.bank_last4`, `org_payment_accounts.bank_debit_status`, `notifications.cleared_at`) are unrelated.
- **The only period lock is the fiscal-year close:** trigger `accounting_entries_fiscal_lock` (mig 318:594–666) refuses
  any insert/edit/void of a club-book line dated on or before `club_books_closed_through(org)`. Route pre-check
  `refuseIfClosed` (`lib/club-fiscal-year-server.ts:129-167`). Close warns on open money, never blocks. Reopen is the
  latest year only, with a reason (`org_fiscal_year_reopenings`). **Team books are exempt from the lock** (dict gotcha 10).
- **Tabs** (`accountingTabs`, `lib/admin-kit-nav.ts:368-384`): Overview · Budget · Teams* · Ledger · Allocations* ·
  Payment requests* · Budget vs. Actual · Payouts† (*rep teams only, †only if payouts were ever connected). "The
  Statement" is Budget vs. Actual's main view, a budget report, not a bank statement.
- **Who writes club money:** `canMoveClubMoney` (`lib/member-access.ts:76`): owner always; `admin` and `treasurer` by
  default; `league_registrar` and `coach` never; per-member overrides apply.
- **The club reads team cash** read-only through `teamCashHeld` (`lib/club-team-cash.ts`), never summed into club
  figures. Club write routes refuse team books (403 `team_book`).
- **No money audit table.** `org_audit_log` is member/billing only. History lives on rows (void, undone, reversed,
  fiscal-year close/reopen).
- **Payouts tab** (12d-2): reads Stripe live, 3-minute cache, **stores nothing** (`lib/online-payouts.ts:12-27, 47`).
  An automatic payout lists its payments, refunds, disputes and fee lines and ties each to our record. A manual payout
  (`reconciliation_status = not_applicable`) shows only its total. The tab's own comment: "the treasurer matches a Stripe
  payout to the bank statement here" (`lib/admin-kit-nav.ts:380`).
- **Matched by hand today:** everything else: cash, cheques, e-transfers, desk payments, tournament team payments.

### Coach Ledger
- **The Ledger is a view** assembled from ~8 tables (`lib/coach-register.ts:31`: "NOTHING IS EVER CREATED IN THE
  REGISTER"; `lib/coach-register-book.ts:80-150`): `rep_payable_payments`, `rep_team_money_in` (**no method column**),
  `rep_dues_payments` and `rep_dues_payouts` (method etransfer|cash|cheque|card|other), `rep_fundraiser_entries`,
  allocation installments and payment requests. Each row has a unique `id` (`lib/coach-register.ts:132`). Integer cents.
- **Everything is per season** (`program_year_id`); the register route answers for the working season only, with no
  year parameter. Opening balance is per season (`rep_program_years.opening_balance`), carried once at rollover
  (`lib/rep-season-rollover.ts:249-293`, **Stage 14's file: not touched by this plan**).
- **Who writes:** money access off|read|write (`lib/coach-capabilities.ts:551,567`); head coach write; manager and
  treasurer write by default; assistant and helper off by default; the head coach can change any of these.
- **Online family payments do not reach the coach Ledger.** `online_payments.flow` is tournament_team|league_signup
  only; rep-team dues online are out of Stage 12 (A5). The coach check therefore has no payout grouping.
- **Doors:** Money hub tabs Overview · Budget · Player dues · Fundraising · **Ledger** · Club* · Budget vs. Actual; the
  Ledger has views Timeline · Bills · Payment schedule (`expenses/panel.tsx:355-370`). Desktop sidebar "Money"; phone
  More sheet "Money" (not on the phone bar). Premium portal only; the free Basic portal has no Ledger.
- **Closed season page** money shelf shows Budget vs. Actual by category and one Money-in line; no register.

### "Reconcile" already in customer-facing words
- **True and kept:** help "Matching a payout to your bank statement" (`lib/help-content/accounting.tsx:607-610`), about
  Stripe payouts, plus payout search keywords (`org.tsx:1127`, `tournaments.tsx:984-985`).
- **A different sense (budget to cash), coach side:** `coaches.tsx:1962-1963, 2464, 2502, 2529`; Budget panel copy
  ("reconcile the estimate", `budget/panel.tsx:2288`); Budget vs. Actual export header "RECONCILIATION — SPENDING TO
  CASH" (`budget-vs-actual/panel.tsx:1587`). **Collision risk:** once a coach Bank check exists, "reconciliation" means
  two things on one Money hub. Routed to `/marketing` in §5 (rename the export header, or keep and accept).
- **Overclaims found that break R-c's rule, not this project's to fix** (handed to `/marketing`):
  `app/[orgSlug]/admin/onboarding/page.tsx:1532` "…track invoices"; `lib/marketing-email-defaults.ts:388` "team
  invoicing"; `lib/plan-module-entitlements.ts:38` "…reconciliation workflows" (admin catalog text, read by the feature
  matrix publish route; check whether that matrix is public).
- C19/F10's removals (retention copy, pricing rows) are confirmed gone.

---

## 3. How clubs actually do this (research 2026-11-04; sourced unless marked)

- **Mechanics (sourced: MoneyMinder nonprofit guide, Keiter CPA):** statement ending balance, plus deposits not yet on
  the statement, minus cheques not yet cashed, equals the book balance. Bank fees and interest go into the book as
  adjusting entries (*inference: standard practice, no specific source found*). Reviewers look for stale outstanding
  items.
- **Separation of duties (sourced: SectorSource, Canadian):** the preparer and the reviewer should be different people.
- **Canadian minor hockey (sourced):** monthly team reconciliations are required and submitted to the association
  (Cochrane, North Durham by the 10th, Nanaimo by the 15th, Kitchener final rec + account-closure proof by June 30,
  Chilliwack 7-day records review, BC Hockey's finance coordinator audits them). The deliverable is a dated, signed
  package with the statement attached.
- **Comparable tools:** QuickBooks Online (statement date + ending balance, tick, Difference must reach 0, can finish with
  an adjustment, undoing is discouraged), Wave (tick-off, OFX/QFX/CSV upload, OFX recommended), Xero (bank feeds + suggested
  matches, CSV/OFX import). MoneyMinder is a volunteer-treasurer tool with a reconciliation wizard; bank feed is an
  add-on. **TeamSnap and Jersey Watch show no evidence of bank-statement reconciliation**; SportsEngine, TeamLinkt, Spond
  and Heja were not found to offer it. *Inference:* a sports platform with a real tick-off is a genuine gap.
- **Live bank connection in Canada:** Plaid (99%+ of deposit accounts, Big 5) and Flinks (~98%, vendor claim); pricing
  unpublished, likely per connected account per month. Canada's Consumer-Driven Banking Act framework got Royal Assent
  2026-03-26 (Bill C-15); regulations were proposed 2026-06-27; accreditation guideline consultation opened 2026-11-02.
  **No live date.** *Inference:* a feed means a vendor contract, PIPEDA + Quebec Law 25 consent work, and breakage support.
- **Statement files:** Scotiabank and RBC business accounts export CSV/QFX (third-party sources); BMO/TD/CIBC business
  undocumented; Desjardins is PDF-first. *Inference:* CSV layouts vary bank by bank and need per-bank mapping plus
  duplicate detection.

---

## 4. The asks

> **⚖ RULED 2026-11-04 (owner, paste-back from the review page): B1 A · B2 A · B3 A · B4 A · B5 A · B6 A · B7 A · B8 A ·
> B9 A · B10 A · B11 A · B12 A.** No notes. Each ruling is option A exactly as written below; nothing beyond it is ruled.
> Follow-through from B11 **done 2026-11-04**: `/strategy` logged the gating in `BUSINESS_DECISIONS.md` (Decided), and the
> Facts doc gained the coach Ledger inclusions bullet and a change-log line. Three live overclaims (§5 "Found, not this
> project's") are routed to `/marketing` in that entry.

Ordered so the ones that decide the others come first.

### B1 — What is being checked: a bank account, or each book? *(decides B3, B8, B9)*
- **A (recommended).** A **bank account** the club names ("Club chequing"). Every club book belongs to the club's first
  account by default. A club can add a second account and move a book to it (some clubs keep a separate account for
  gaming or casino funds; *inference: BC and Alberta gaming-grant rules commonly require one, to confirm*). A team has
  exactly **one** account, its own.
- B. Each book checked on its own against the statement (the stub's words). Breaks on any shared account, and a Stripe
  payout spanning two books can never be ticked.
- C. A only, but exactly one account per club, no second account. Smaller; fails the gaming-account club.
- *Why A:* it is the shape of the bank. *If B:* the grouped payout tick (B2) is impossible and same-account transfers show
  as false outstanding items. *If C:* R2 loses the account-setup screen's second half, and the build is ~10% smaller.

### B2 — What do you check against? *(the size of the whole project)*
- **A (recommended).** **The statement, typed:** the treasurer types the statement's end date and ending balance, then
  ticks lines off. An automatic Stripe payout appears as **one row** ("Stripe payout · arrives Mar 14 · $1,284.50") that
  ticks all its payments, refunds and fees at once. A manual payout's lines are ticked by hand.
- B. **Upload the statement** (CSV/OFX) and match lines automatically. Needs per-bank column mapping, duplicate
  detection, and a "this upload doesn't match" path; Desjardins is PDF-first. Roughly doubles the project.
- C. **Stripe payouts only.** Honest but tiny: it covers the one deposit the product already itemises and nothing a
  volunteer actually struggles with (cash, cheques, e-transfers).
- D. **Live bank connection** (Plaid/Flinks). A vendor contract and per-account cost, consent and privacy work, connection
  breakage support, and a regime with no live date. Not a first-release thing.
- *Why A:* it's what QuickBooks and Wave do at their core, it needs no vendor and no bank cooperation, and the grouped
  payout is a real improvement on both. *If B:* add two stages (import + mapping, matching) and an owner mockup for the
  importer. *If D:* a scoping plan of its own, with `/accounting`-style privacy review and a vendor decision first.

### B3 — What is "the period"?
- **A (recommended).** **A statement:** whatever the bank's statement covers. Each check starts where the last checked
  one ended (its ending balance becomes the next check's starting balance). The **first** check on an account asks for a
  starting date, the bank balance on that date, and any items still outstanding then (one line each).
- B. A fixed calendar month. Matches most statements but fails a bank whose cycle ends on the 20th.
- C. A custom date range. Flexible, but invites gaps and overlaps that A rules out by construction.
- D. The fiscal year (club) or season (coach). Too coarse; associations want monthly.
- *How it meets the year:* a statement may straddle a fiscal year end or a season's rollover. Nothing about a check is
  keyed to a year (see B4, B10). *If B/C:* the starting-balance chain becomes a reconciliation of its own.

### B4 — What does "checked" do?
- **A (recommended).** It **records the check and locks nothing.** Editing the amount or date of a ticked line, or voiding
  it, shows a warning ("This line was matched to the statement ending Mar 31"). If it goes ahead, the done check shows
  **"Changed since it was checked: 1 line"**, with the line, until the treasurer re-checks. A new line back-dated into a
  checked period is simply outstanding on the next check (that's what it is). **Undo:** only the latest checked statement,
  by anyone who may check, with a reason; recorded with who and when (like the fiscal-year reopen).
- B. Ticked lines lock: no edit or void without undoing the check first.
- C. The whole period locks: no line may be added, edited or voided on or before the checked date.
- *Why A:* the club already has a lock, the fiscal year (R-f), and a second lock with different edges would be a
  second set of rules a volunteer has to learn. The coach half is bound by "warns, never blocks" (R-e). Volunteers
  back-date constantly. *If B:* edit/void routes on both portals learn a new refusal (≈ +1 session). *If C:* it collides
  with the fiscal-year lock and creates a coach lock the Portal rules forbid in spirit.
- *Fiscal-year fit:* ticking a line in a **closed** fiscal year is allowed, because a tick is a mark, not money. A March
  cheque cashed in April must be tickable. The fiscal lock is untouched. A bank-fee line added from a check dated in a
  closed year is refused by the lock as today, and the helper says so and offers today's date.

### B5 — Must the difference be $0.00 to mark a statement checked?
- **A (recommended).** Yes. Beside a non-zero difference, three plain helpers: **Add a bank fee or interest** (writes a
  real line: club General book; coach a cost or income record), **Find by amount** (the Payouts tab's existing pattern),
  and **Finish later** (the check keeps its ticks).
- B. Allow "checked with a difference" with a required note; the mark then reads "checked through Mar 31 · $12.40
  unexplained".
- *Why A:* a "checked" mark that isn't balanced is the one thing an association auditor would reject, and the club reads
  the coach's mark (B9). *If B:* the mark grows a second state everywhere it shows.
- **⚖ Amended 2026-11-04 by drawing Ask 1 (A):** the club's bank-fee/interest line is written to **the account's own
  first book** (General for Club chequing; the Gaming book for a Gaming account), as a dropdown of that account's books
  only, not always the General book.

### B6 — Money that never goes through the bank *(decides the coach screen)*
- **A (recommended).** A line can be marked **"Didn't go through the bank"** (one tap; it leaves the tick list for good
  and shows in a small "Kept out of the bank" total). Excluded automatically, no tap needed: a transfer between two books
  in the same account (club), a bill a family paid straight to the vendor (coach), and void and pending lines.
- B. No mark: everything is assumed to go through the bank; cash kept in hand shows as outstanding forever.
- *Why A:* P2. Without it, any team that pays a ref in cash can never reach $0.00, and B5-A would trap them. *If B:*
  B5 must become B (done with a difference), or coaches will stop using it.
- *Note:* `rep_team_money_in` has no method column, so the product cannot guess cash from the record; the coach marks it.

### B7 — Who may check, and who only reads
- **A (recommended).** Club: whoever can move club money (owner; admin and treasurer by default; per-member overrides).
  Anyone who can open Accounting reads the checks. Coach: anyone with money **write**; money **read** sees the checks
  and the mark. Every check records who checked it and when. No second approver in the first release.
- B. Club: treasurer and owner only (admin excluded).
- C. A preparer and a separate reviewer (the separation-of-duties practice, §3).
- *Why A:* it reuses the two money permissions as they are, with no new role and no new override. *If C:* a review
  state, a second person's sign-off screen and a notification, ≈ +1 stage. Recommended for a later release (B12).

### B8 — Where does it live? *(names the doors for Stage 13)*
- **A (recommended).** **Club:** a new Accounting tab, **"Bank"**, placed after Ledger (desk tab row; the phone's tab row
  is the same row, scrolling). **Coach:** a fourth **Ledger view, "Bank"** beside Timeline · Bills · Payment schedule.
  It's the same team book arranged against the statement, so the Money hub's tab row stays as it is.
- B. Both as a tab named "Bank" (coach: a new Money hub tab).
- C. Club: inside Payouts (renamed). Payouts only shows when payouts were connected; most clubs would never see it.
- *Why A:* the club's Ledger tab shows one book at a time, so it can't host an account-wide check; the coach's Ledger is
  the whole team book already. *The cost:* the two portals put the same feature at different depths. Stage 13 should
  re-check this crossing. *If B:* the coach tab row grows to 8 (7 standalone) on a phone.
- **Doors Stage 13 must re-check:** club: the Accounting tab row (desk + phone), the Overview's new line linking to the
  tab; coach: the Ledger view switch (desk + phone), the Money Overview line, the club's Teams tab mark.

### B9 — What shows elsewhere? *(quietest answer)*
- **A (recommended).**
  - **One line** on the club Accounting Overview and on the coach Money Overview: "Bank checked through Mar 31". It
    links to the check, and goes amber only when the latest check has "changed since".
  - **The club's Teams tab** shows each team's coach mark, read-only ("checked through Feb 28" / "not checked yet").
    That's the coach's fact read by the club, D1-safe, no second number. Only for a team linked to that club,
    and only to people who can already open the club's Teams tab (which today shows that team's cash held). A
    standalone Premium team's mark is read by no club. *(`/strategy` flagged this as a data-sharing question; the
    answer is that it shares nothing the Teams tab does not already share at a coarser grain.)*
  - **A printable one-page report** of a checked statement: statement and book balances, outstanding lines, who checked
    it and when, with signature lines. It's what an association asks for.
  - **Warnings added to the existing close lists** (warn, never block): the fiscal-year close ("the bank is checked
    through Feb 28, a month before this year ends") and the coach's Close the season / Start next season.
  - **Nothing** on Budget vs. Actual, the Statement, the money exports, or the closed-season page.
- B. A only, without the club's Teams tab mark.
- C. A, plus a per-line "✓ matched" tick in the Ledger itself.
- *Why A:* the overview line and the team mark are what a treasurer and a club need; the report is what an association
  asks for. *If C:* every Ledger row grows a state; the Ledger is the most-used money screen and doesn't need to be
  noisier.

### B10 — Across a coach's seasons
- **A (recommended).** The team's bank account belongs to the **team**, not the season. A checked statement keeps its own
  list of what was still outstanding. The next check, even in the next season, shows **"Still outstanding from your last
  check"** from that list, without reading last season's records. The Bank view shows this season's checks and "last
  checked through {date}". **The closed-season page gets nothing in the first release** (a shelf there needs its own owner
  mockup session, R-e).
- B. The check is per season: each season starts fresh with a new starting point.
- *Why A:* a cheque written in August cashes in September after the rollover; a per-season check would lose it. A's
  snapshot means **no year parameter** reaches a route and nothing in Stage 14's rollover is touched (the
  `HISTORY_ENDPOINTS` guard's three questions: it's a record, the subtree reads no year, each check is titled by its
  statement date). *If B:* simpler, but every September's first check starts wrong.
- **⚖ Amended 2026-11-04 by drawing Ask 12 (A):** when Start next season runs, the team account also saves every
  unticked line of the closing season dated after the last check, and the next check lists them under "Still
  outstanding from your last check". Still no year parameter; nothing reads last season later. The warning line in
  Start next season stays.

### B11 — Gating (packaging: `/strategy`'s answer recorded as **Proposed**, owner rules)
- **A (Proposed by `/strategy` 2026-11-04, not logged):** **Club:** part of Accounting (Club and Club · Association,
  `module_accounting`), with no new feature key, no add-on, and the same per-person Accounting access. **Coach:** the
  **Premium Coaches Portal everywhere**, standalone Premium and Club-included alike, riding the Ledger with no new key.
  Basic stays on its fee list, with no tease. The Club plan's difference is the **club-wide view** of every team's mark
  (B9), not whether a team can check.
- B. Coach side only for Club-included teams. The steward advises against: it strips a core money job from the paid
  standalone portal after the Ledger was sold on money, and sharpens the open Premium → Club price-step concern
  (2026-10-30).
- C. A paid add-on. Against the standing no-new-SKU posture.
- No price, plan name or `lib/plan-config.ts` change. When ruled: `/strategy` logs it, and the Facts doc gains a coach
  Ledger inclusions bullet (a gap the steward found, not drift).

### B12 — What stays out of the first release (written down so it's a decision, not a gap)
- **A (recommended):** out: statement upload (CSV/OFX/PDF); a live bank feed; a preparer/reviewer sign-off; a "submit to the
  club" flow and the club returning a team's check; a closed-season shelf for checks; a per-line matched mark in the
  Ledger; undoing any check but the latest; the Basic (free) portal; Stripe on the coach side (rep dues online is out of
  Stage 12); storing bank account numbers (an account is a name, never a number).
- B. Pull one of these in: name it.

---

## 5. Words for /marketing
> Customer-visible wording, settled in ONE `/marketing` pass per stage before the walk. These are drafts for the
> drawing; none is ruled.
- [ ] "Bank" — the club tab and the coach Ledger view — treasurer, coach
- [ ] "Check a statement" / "Statement ends" / "Ending balance on the statement" — the start of a check
- [ ] "Difference" (must read $0.00) — the check's band
- [ ] "Didn't go through the bank" / "Kept out of the bank" — B6
- [ ] "Mark this statement checked" / "Checked through {date}" — done, and every place the mark shows
- [ ] "Changed since it was checked" — B4
- [ ] "Still outstanding from your last check" — B10
- [ ] "Add a bank fee or interest" / "Find by amount" / "Finish later" — B5
- **As built for the club desk (R2c, 2026-11-05):** every string the Bank tab shows lives in `lib/bank-tab-words.ts`
  (one home; its keys follow the screens C1–C5, C10), the refusals in `lib/bank-check-words.ts`. The drafts above are used
  as written; added by the build: "Save and check a statement", "Start checking", "Add and tick", "Add and set it up",
  "Name and books", "Keep it checked" / "Undo the check", "Ticked now", "Look again", "Mark checked again", "Not from
  FieldLogicHQ", "Dispute held", "Add it as payment processing", "Left out automatically", "Put it back". R3's `/marketing`
  pass settles them all.
- **As built for the club phone (R2d, 2026-11-05):** same home, `lib/bank-tab-words.ts`, under its phone keys
  (`markCheckedShort` "Mark checked", the pinned strip's count, the signed amount, the statement card's title and lines,
  and the list hint for a treasurer and for a reader). R3's `/marketing` pass settles them with the rest.
- [ ] Help search words must carry **reconcile / reconciliation** even if the screens say "check", because that is what
  a treasurer types.
- [ ] **Collision:** the coach Budget vs. Actual export header "RECONCILIATION — SPENDING TO CASH" and the Budget panel's
  "reconcile the estimate". Rename them, or accept two senses on one hub.
- [ ] **Marketing truth (R-c):** "payment reconciliation" / "bank reconciliation" returns to the Club copy only after R7's
  walk passes: pricing section, Club plan article, homepage, in-app plan list, `PRICING_PAGE_COPY.md`.
- [ ] **Found, not this project's:** onboarding "track invoices" (`admin/onboarding/page.tsx:1532`), marketing email
  "team invoicing" (`lib/marketing-email-defaults.ts:388`), `plan-module-entitlements.ts:38` "reconciliation workflows"
  (check whether the feature matrix is public). Each breaks R-c's rule today.

---

## 6. Screens the owner mockup session must draw (desk 1440 and phone 390; do not draw them here)

Each is named by the question it answers. The phone version of every one except C9 and K8 is required.

**Club (Accounting → Bank)**
- **C1 · "I've never done this here. Where do I start?"** The empty Bank tab: name the account, starting date, bank balance
  on that date, items outstanding then; which books belong to it (all, by default).
- **C2 · "Does my book agree with this statement?"** An open check: statement end date and ending balance typed; the tick
  list (money in, money out); the joined band "Statement · Ticked · Difference"; a Stripe payout as one grouped row,
  closed and opened.
- **C3 · "It's $12.40 off. Now what?"** The non-zero difference with its three helpers, and the Add a bank fee or interest
  sheet.
- **C4 · "What have I checked?"** The list of checked statements, "checked through", undo on the latest with its reason
  window.
- **C5 · "Someone changed a line I'd checked."** A checked statement showing "Changed since it was checked".
- **C6 · "Am I about to break a check?"** The Ledger's edit/void window with the matched-line warning.
- **C7 · Where the mark shows:** the Accounting Overview line; the fiscal-year close list with the bank warning.
- **C8 · "Is every team keeping up?"** The Teams tab with each team's coach mark.
- **C9 · "What do I hand the board?"** The printable report (one page).
- **C10 · "We keep gaming money in a second account."** Adding a second account and moving a book to it (only if B1 = A).

**Coach (Money → Ledger → Bank view)**
- **K1 · First check:** starting date, bank balance, outstanding items. A team with a carried opening balance, and one
  without.
- **K2 · An open check:** tick list with "Didn't go through the bank" on a line, the "Kept out of the bank" total, the
  band.
- **K3 · Off by an amount:** helpers; Add a bank fee or interest as a cost record.
- **K4 · Checked statements:** this season's list, "last checked through", undo the latest.
- **K5 · Matched-line warning** on a Ledger record's edit window, and on its delete.
- **K6 · Across the rollover:** "Still outstanding from your last check" in the first check of a new season; the bank
  warning in Start next season and Close the season.
- **K7 · Where the mark shows:** the Money Overview line; read-only for a money-read helper.
- **K8 · The printable report.**

**Drawn 2026-11-04 (R0 round 1, `BANK_RECONCILIATION_DRAWINGS.html`; owner approval owed, R0 stays open).** Every screen
above, desk 1440 and phone 390 (no phone for C9/K8), from today's captures (`.probe/bank-r0/`, dev fixtures
`uat-rep-club` and `uat-standalone`). Figures come from one example statement per portal (club: Oct 31, 2026, $8,400.50,
off $12.40 until the bank fee; coach: Sep 30, 2026, $2,504.20, two cash lines kept out).
- **Added screens:** tab 1 whole screen before/after (club Overview, coach Money Overview, coach Ledger View dropdown),
  drawn as overlays on the captures; the "Check a statement" window (end date + ending balance, both portals); the
  Account pill (appears at a second account) and "Add an account"; the payout's gap state (P4 unproven); the list after
  an undo; "Look again" on a changed check; the closed-year variant of the bank-fee window.
- **Corrections to this plan and the drawing prompt, found in the code/captures:** the coach Ledger's view control is
  the **View pill dropdown**, not a white track, so "Bank" is a fourth dropdown option; "Find by amount" is the Payouts
  tab's search field ("Find an amount, a name or a receipt"), pointed at the tick list; **Start next season has no
  warning list today** (it says settling happens before), so the bank warning there is a new amber block (the window's
  tryout-warning recipe), while Close the season's "Before you do" gains a row; the club Overview line sits on the right
  of the existing "Where the club stands · today" eyebrow, and the coach line in the empty foot of the Cash on hand card
  (no added height on desktop; one line on the club phone).
- **⚖ Drawing asks 1–14 RULED 2026-11-04, all A (as recommended), no notes.** Each is option A as written on the page.
- **New asks raised by the drawing (page tab 10, 14 asks, paste-back form).** Two push back on a ruling once drawn:
  **Ask 12 (B10)**: the last check's outstanding snapshot does not hold a season's lines dated *after* that check, so a
  coach who rolls over before checking the last month can never balance the new season's first check; recommended A:
  Start next season also saves the closing season's unticked lines for the next check. **Ask 1 (B5)**: a bank fee or
  interest written to the General book breaks a gaming account (BC counts its interest as gaming funds); recommended A:
  the account's own first book. Others: outstanding-then lines picked from the books (3), one date-ordered list (4),
  pinned band + dock on phone (5), "Didn't go through the bank" placement, both portals, "Put it back" (6), the payout
  gap line (7), a re-dated fee ticks on its own statement (8), undo keeps ticks and steps back one at a time (9), the
  warning at the top of an autosaving window (10), "Look again" → "Mark checked again" at $0.00 (11), moving a book takes
  its unticked lines (13), coach fee category required (2), two signature lines (14).

---

## 7. Stages (each one build session; asks ruled 2026-11-04, build starts once the drawing is approved)

Every stage: migration first where there is one, then the `DATA_DICTIONARY.md` update and `npm run refresh:snapshots`
(dev + prod) in the same unit of work; `/simplify` and `/review` offered; `/docs` and `/marketing` at the stage's end.

### R0 — Owner mockup session (separate session; prompt `BANK_RECONCILIATION_DRAWING_PROMPT.md`, written 2026-11-04)
- [x] Draw §6 (C1–C10, K1–K8) through `/design`; owner approves. *(Drawn and published 2026-11-04; drawing asks 1–14
  ruled A the same day; **drawings approved by the owner 2026-11-04**.)*

### R1 — The account, the check, and the engine (no screens; prompt `BANK_RECONCILIATION_R1_BUILD_PROMPT.md`, written 2026-11-04)
> **✅ Built 2026-11-04, committed `502a69d39` 2026-11-04.** What landed, and where it differs from the sketch below (the sketch is kept as written):
> - **Mig 436 `436_bank_checks.sql`**, nine tables: `bank_accounts` (holds the first check's `opening_date` +
>   `opening_balance_cents`), `bank_account_books` (+ trigger `bank_account_books_guard`: club account, own club, never a
>   team book), `bank_checks` (status `open|checked` only; **no starting-balance column**, it is derived from the previous
>   statement; Undo is an event, Ask 9), `bank_check_events` (checked / undone + reason / checked_again), `bank_check_marks`
>   (keeps the line **as checked**: date, direction, amount), `bank_check_added_lines` (fee / interest /
>   payment-processing added from a statement, Ask 8), `bank_check_changes` (as checked / as now / who / when / cleared,
>   Ask 11), `bank_line_exclusions` (B6; delete = Put it back), `bank_saved_lines` (`opening_picked` / `opening_typed`
>   Ask 3, and `carried` Ask 12: one table, not a jsonb on the account). No bank or account number column.
> - **⚖ Access deviates from the sketch, on the house rule.** The sketch said "RLS: club rows by membership with
>   Accounting; team rows by team money access". `DATA_DICTIONARY.md` maintenance rule 7 (migs 310/311) says every
>   product table is **service role only, no policies**, and no money table has a policy today. So: RLS on, no policies,
>   grants revoked; the R2/R4 routes decide access with the existing permissions (club read `canOpenModule(…,
>   'module_accounting')`, write `canMoveClubMoney`; team `canViewMoney` / money write), which is B7 exactly.
> - **Mig 437** re-creates `move_team_into_club` from 435 exactly, with `bank_accounts` in `c_moves`: a standalone team's
>   account (and every statement and tick under it) moves with the team into a club. Caught by
>   `tests/unit/team-move-coverage.test.ts`; B10's "belongs to the team" decides it. ⚠ A later re-creation of the move
>   must start from 437.
> - **Proved on dev** (`.probe/bank-r1-guard-check.sql`, rolled back, `BANK_R1_GUARD_PASSED`): the guard's three
>   refusals, one team account, the opening pair, one tick per line, checked needs when + snapshot, undo needs a reason,
>   typed lines need a `typed:` key, no anon/authenticated grant.
> - **Engine `lib/bank-check.ts`** (pure, integer cents): `evaluateCheck` (band, ticked/outstanding, kept out,
>   auto-excluded, waiting, payout gaps, changed since), `canStartCheck` / `canMarkChecked` / `canUndo` /
>   `canMarkCheckedAgain`, `snapshotForMarking`, `payoutTickMarks`, `carriedAtRollover`, `bankFeeDate`. Tests
>   `tests/unit/bank-check.test.ts` (21): both tab-2 statements to the cent, Ask 3, the fiscal-year straddle + closed-year
>   tick + re-dated fee (Ask 8), rollover (Ask 12), moved book (Ask 13), undo + step back (Ask 9), changed since + checked
>   again (Ask 11).
> - **Engine choices R2/R4 build on** (none adds to a ruling except the first, said out loud):
>   - **Ask 12, one step wider:** `carriedAtRollover` carries every unticked line no saved list holds, including one
>     back-dated INTO an already-checked month after that check. The ruling named "dated after the last check"; a
>     back-dated line is the same case (otherwise it is in nobody's list). Narrow it in one line if the owner says so.
>   - A **stamped** change stays listed until "Mark checked again", even if the line is put back (Ask 11 A: only Mark
>     checked again clears the amber). A line a coach's rolled-over season no longer reads is **not** a change.
>   - A new statement can start only when every statement is checked; after stepping back (Ask 9), they re-check oldest
>     first.
>   - A ticked payout counts its **book** side in the band; its gap is added as a named amount, so the Difference never
>     carries it (Ask 7).
>   - If the Stripe read fails, a payout's member lines fall back to ordinary rows (ticked ones stay ticked by their
>     stamped marks).
> - **/simplify + /review before the commit (2026-11-04), fixed in the same commit** (engine tests now 26):
>   - *Engine:* re-marking while the Stripe read is down keeps the payout tick and each member's link to it; a member
>     ticked on its own (a plain mark) is no longer folded under a payout that reappears; `snapshotForMarking` drops a
>     line voided after it was ticked, so "Mark checked again" can clear its amber; a ticked line the book deleted
>     (stamped `removed`) counts for nothing; a picked opening item the book still reads stays outstanding on later
>     statements without the caller re-passing the opening items (the engine keeps every key a saved list has placed).
>   - *Mig 436 (dev dropped and re-applied, all nine tables were empty):* a tick can only point at a statement of its own
>     account (`bank_checks_id_account` + composite FK on the marks); a typed opening line's key must equal its own id.
>     Mig 437 diffed against 435: identical except `bank_accounts` in `c_moves` and the comment line.
>   - *Recorded for R2/R4, not built into the database:* a club's "first account" is the oldest live **club-kind**
>     account (a team account moved in by 437 can be older); statement figures and `opening_*` are the route's to
>     protect once statements exist (no trigger); a payout tick and its members' ticks are written and removed together
>     by the route; team delete cascades a team's checked history (consistent with "belongs to the team").

- [x] **Migration** `supabase/migrations/4xx_bank_checks.sql` (number taken at build time; Stage 14 and others are
  allocating). Sketch, final shape set at build:
  - `bank_accounts` (id, org_id, `owner_kind` club|team, team_id NULL for club, name, created_by/at, archived_at).
    **No bank or account number column, ever.**
  - `bank_account_books` (bank_account_id, ledger_id UNIQUE): club only; an unmapped club book belongs to the club's
    first account. A mapping table, not a column on `accounting_ledgers`, so the fiscal-year lock's ledger trigger never
    refuses a move.
  - `bank_checks` (id, bank_account_id, statement_end_date, statement_ending_balance_cents, starting_balance_cents,
    status open|checked|undone, checked_by/at, undone_by/at/reason, `outstanding_snapshot` jsonb, changed_since_at).
  - `bank_check_marks` (bank_account_id, `line_key` text, check_id, by/at; UNIQUE(bank_account_id, line_key)).
    `line_key` = `entry:{uuid}` (club) or the register row's source key (coach); `payout:{po_id}` stamps its members at
    tick time, because payouts are not stored.
  - `bank_line_exclusions` (bank_account_id, line_key, by/at): B6.
  - RLS: club rows by org membership with Accounting; team rows by team money access. Writes only through routes.
- [x] `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots` (dev+prod). *(Nine table entries after
  `org_fiscal_year_reopenings`; `accounting_entries` gotcha 11; the team-move entry names `bank_accounts`.)*
- [x] Pure engine `lib/bank-check.ts`, integer cents, no IO: lines in → ticked balance, difference, outstanding list,
  changed-since detection, the B6 exclusions. Unit tests including straddling a fiscal year end and a rollover.
- [x] **Prove P4:** in test mode, sum each automatic payout's book side vs its amount, in both fee cases. Record the
  result in this plan; if it doesn't sum, R2 shows the gap as a named line. *(Answered under Open questions: holds for
  family-pays, measured; club-pays has no dev data.)*
- [x] Confirm the coach register row `id` is stable across reads (derived from source table + id); if not, add a stable
  source key the engine can mark. *(Answered under Open questions: stable for every settled row; no new key needed.)*

### R2 — Club: the Bank tab (desk + phone) (prompt `BANK_RECONCILIATION_R2_BUILD_PROMPT.md`, written 2026-11-04; one-session chunks: R2a reader + P4 club-pays, R2b routes + atomic functions, R2b-2 the tick lock (added 11-04), R2b-3 the book-move lock (added 11-05; may run beside R2c), R2c the tab on desk, R2d phone + close)
- [x] Routes under `app/api/admin/accounting/bank/**` via `resolveClubMoney({write})`; lines from posted club-book
  entries (`isClubBook`) in the account's books, minus same-account transfer pairs, void and pending. *(R2b, 2026-11-04.)*
- [x] `accountingTabs` gains "Bank" (B8); page `app/[orgSlug]/admin/accounting/bank/page.tsx`; C1–C5, C10. *(Desk built
  in R2c, committed `7d7b79cdb` 2026-11-05; the phone built in R2d 2026-11-05.)*
- [x] The grouped Stripe payout reuses `lib/online-payouts.ts` (no second Stripe reader). *(Reader half in R2a:
  `readPayouts({ withEntries })`; the grouped row on desk R2c, on a phone R2d.)*

> **R2a — the club's reader ✅ built and committed `af458c945` 2026-11-04** (no routes, no screens):
> - **`lib/bank-club-read.ts`** (server): `readClubBankAccounts(orgId)` lists the live **club** accounts oldest first
>   (rule 1: `owner_kind='club'`), which books each holds (`bank_account_books`, else the first account), and the "never
>   done this" state (no account: every club book unplaced, C1). `readClubBankAccount(orgId, accountId, { today })`
>   returns the engine's whole `BankAccountState` (rule 6: every input the server's) plus `payoutsUnavailable` and the
>   per-payout gap reasons; null for an account that is not this club's (R2b answers 404).
> - **`lib/bank-club-map.ts`** (pure, client-safe): rows → engine types (`entry:{id}`, direction from `entry_type`,
>   `transferPairKey`, `opening_*` → `picked`/`typed`, a snapshot read only from a CHECKED statement, open changes
>   only), `assembleAccount` (which lines and payouts are this account's), `payoutsForBank`, `nameGap`.
> - **⚖ Disagreed with the prompt, said before building:** the line read starts at the account's **starting date**, not
>   "the last checked end". Reading from the last checked end would miss a line back-dated into a checked month (B4: it
>   is outstanding on the next check) and a moved-in book's older unticked lines (Ask 13); `accounting_entries.updated_at`
>   has no trigger, so no "changed since" stamp can find them another way. Still bounded (the account's life), never a
>   year. Stripe is read from the last **checked** statement's end (an older unticked payout is kept line by line in that
>   statement's saved list, `snapshotForMarking`). Plus, by id, every key a mark, a checked list, an opening item, the
>   carried list, an added line or an open change names, and every payout member line.
> - **Payout members (the Payouts reader extended, not forked):** `readPayouts({ withEntries: true })` names the
>   club-book lines behind each Stripe line (`PayoutLine.entryIds`; census of the writers at their latest definitions):
>   payment = `tournament_team_payments.entry_id` / `online_payment_items.entry_id` + `online_payments.processing_cost_entry_id`
>   (both flows); refund = `online_payment_refunds.refund_entry_id` + `processing_cost_entry_id`; card dispute lost =
>   `taken_back.entryId` / `children[].entryId`, won after a loss = `won_back.back[].entryId`; a **bank debit reversed
>   after it landed is not stored by its writer** (`reverseDebit` drops the RPC's result), so it is found by source
>   (team: `source_module='online_payment'` on the payment's id, "Returned by the bank · …"; child: `registration_returned`
>   on the registration). Never a book line: a Stripe fee, a fee given back, a refund that bounced, a failed payout
>   carried back. The Payouts tab's read is unchanged (no `entryIds` without the flag; its tests green). Only automatic
>   payouts Stripe finished matching that did not fail are passed; an entry belongs to one payout.
> - **Gap reasons (P4), per payout:** `disputesHeld` (an open card dispute, from OUR stored `amount` + `stripe_fee`),
>   `disputeReturnedCents` (won before any loss was booked), `notOursCents`, `stripeFeeCents` (a Stripe fee from the
>   club's balance that no line records), remainder `otherCents`. **"Add it as payment processing" is offered for the
>   Stripe fees + remainder only, and only when that is money out** (a held dispute and "not ours" never are). *Naming a
>   Stripe fee on its own is one step past the P4 note, said out loud: the dev probe's −$5.00 standalone `stripe_fee`
>   would otherwise read as unexplained.*
> - **Which account a payout is on:** the account its book lines sit in (the first account when it holds any of them,
>   or when none is in a club book); a payout ticked on an account stays there.
> - **A moved book (Ask 13):** a line read by id whose book now sits in another account is claimed elsewhere (no saved
>   copy lingers); keys ticked on the club's other accounts are `claimedElsewhere` too (only those this account could
>   show are asked for).
> - **For R2b (found here):** the move route must also move a moved book's `opening_picked` rows, or the new account
>   loses them (the old account drops them as claimed elsewhere, so nothing double-counts).
> - **Tests** `tests/unit/bank-club-read.test.ts` (33): rule 1, book placement, a transfer pair (same account vs another
>   account), a moved book on both accounts, the by-id read (every key kind) and the floors, an opening cheque, a payout
>   with every member kind, the Payouts tab unchanged, passed vs not-passed payouts, an open dispute, a Stripe fee, a
>   dispute won unbooked, a payout's account, end to end through the engine (a payout ticked to $0.00; a failed Stripe
>   read falling back with a ticked member kept), and a source guard (no year, no write, `owner_kind='club'`, no second
>   Stripe reader).
> - **Dev probe** (`.probe/bank-r2a-reader.cjs`, not committed; a temporary account + statement on `uat-rep-club`, deleted
>   after): 4 books, 70 lines (62 posted, 7 void, 1 pending), 4 automatic payouts, read in 3.3 s, `evaluateCheck` with no
>   throw: 41 outstanding (4 as payout rows), 10 left out automatically (7 void, 2 same-account transfer halves, 1
>   pending). Two payouts sum to the cent; po_1UX9RW… gap +$281.50 = all "not ours" (the 12d probe charges);
>   po_1UVKmq… gap +$193.25 = dispute held −$171.75 + not ours +$370.00 + Stripe fee −$5.00, remainder $0.00.
> - **/simplify + /review (high) done 2026-11-04, applied in `af458c945`.** /simplify: one `toCents` (the codebase's), the new
>   Payouts-side lookups paged and in parallel (a plain `.in()` read stops silently at 1,000 rows), the identity
>   `lineFloor`, `firstClubAccount` and the `'another account'` sentinel removed, the window read and the Stripe read
>   started in the first batch, one "ticked on another account" helper. /review: **a bank read no longer serves the book
>   lines from the 3-minute Stripe hold** (only Stripe's half is held; our side is read fresh); a registration paid twice
>   and returned is matched to a payment only when unambiguous; stable tiebreakers on every paged read; `today` documented
>   as server-derived. **Left for R2b, deliberately:** (1) `nameGap` treats a Stripe line with book lines as booked even if
>   those lines are void or sit in a moved book, so "Add as payment processing" could be offered for a voided lost
>   dispute: decide the offer in R2b against the engine's own book side; (2) a held dispute is named from OUR stored amount
>   and fee as the P4 ruling says, not from the line's `net`: R2b compares the two and refuses the offer if they differ;
>   (3) a transfer half whose partner is dated before the starting date is not fetched by id (not checked whether a
>   hand-edit can split the two halves' dates; the engine's own transfer tests assume they sit together); (4) the team-side reversal line is found by its fixed wording (migs 387/388), as the
>   12c SQL check does; (5) no test fakes the database for `entryIndex`: the dev probe is its only end-to-end check.

> **R2b — the routes ✅ built 2026-11-04** (server only, no screens; /simplify then /review offered before the commit):
> - **Twelve route files under `app/api/admin/accounting/bank/**`**, each `resolveClubMoney(req, { scope: 'books', write })`
>   inside `withObservability` (read = whoever opens Accounting, write = `canMoveClubMoney`, B7): `GET/POST /bank` (the
>   club's accounts, "never done this", each one's "checked through"; name an account, a later one taking the books it
>   names), `GET /bank/lines-before` (C1's picker: posted lines on or before the starting DAY, newest first, by words or an
>   amount, 50 a page), `GET/PATCH /bank/accounts/{id}` (one account's view; rename), `PUT …/setup`, `POST …/books`
>   (move a book), `POST …/checks` (start), `PATCH …/checks/{checkId}` (correct an open statement's figures), and
>   `…/ticks`, `…/kept-out`, `…/mark` (`again` for Mark checked again), `…/undo`, `…/lines` (fee, interest, payment
>   processing). Every write answers with the account read again (the server's numbers, rule 6); every refusal is a code
>   plus one sentence from `lib/bank-check-words.ts` (drafts for R3's `/marketing` pass).
> - **`lib/bank-club-rules.ts`** (pure, the decisions): `tickPlan` (rule 3: a payout with its members, unticked as a group,
>   also from a stamped member while Stripe is down), `keptOutPlan`, `markPlan` (rules 4 and 6: the Difference recomputed,
>   the complete set of ticks, what was seen), `undoPlan`, `openingPlan` (a picked item's figures from the book; a typed
>   item never carries a key, rule 5), `payoutGapViews`, `checkSummaries` (the list after an undo shows who and why; the one
>   before gains the Undo). **`lib/bank-club-steps.ts`** (server) and **`lib/bank-check-fee.ts`** (thin).
> - **Mig 439 `439_a_bank_check_moves_in_one_step.sql`** (functions only, service role only; dev 2026-11-04, prod owed with
>   436 + 437 in `MANUAL_PROD_STEPS.json`): `bank_account_add`, `bank_book_move`, `bank_account_set_up`, `bank_check_start`,
>   `bank_check_refigure`, `bank_check_mark`, `bank_check_undo`, `bank_check_add_line`, `bank_first_club_account`. Proved
>   on dev by `.probe/bank-r2b-functions.sql` (rolled back, `BANK_R2B_FUNCTIONS_PASSED`).
> - **⚖ Where this went past the prompt's letter, said before the work:**
>   1. **"Undo, then re-enter" has a door:** an OPEN statement's end date and ending balance can be corrected while every
>      later statement is open (`bank_check_refigure`); a checked statement's never (`checked_figures_fixed`), nor one a
>      later checked statement starts from (`later_checked`). Nothing drawn let a treasurer re-enter a mistyped balance.
>   2. **The payout gap's "Payment processing" line is filed under "Bank & payment fees"** (the platform word, or the
>      club's own copy): the club's "Payment processing" words each belong to one program, so none fits a General-book line.
>   3. **Six steps are database functions, not three:** setting up, adding an account and moving a book, starting and
>      correcting a statement each write several rows or must hold an order under a lock. **The fee line is ONE step** (the
>      line, its added-line row and its tick together) instead of "write it, then void it if the tick fails": no orphan can
>      exist, and the fiscal-year lock still refuses a closed day inside it.
>   4. **A statement can't end, and an account can't start, after the club's today** (`ends_in_future`,
>      `starts_in_future`): found by the route probe, where a Dec 31 statement dated its fee line in the future.
> - **R2a's items left for R2b, decided:** (1) "Add it as payment processing" is offered only when every book line Stripe
>   names is in the engine's own book side for that payout (none void, none in another account's book): `missingMembers`;
>   (2) a held dispute's stored amount + fee must equal Stripe's own net for it (`disputeNetCents`, added to the reader's
>   gap facts), or nothing is offered. (3)–(5) unchanged.
> - **A moved book** (Ask 13, and R2a's finding): `bank_book_move` moves the old account's `opening_picked` rows and
>   `bank_line_exclusions` for the book's unticked lines; ticked lines and their decisions stay. A book moved back keeps a
>   row naming the first account.
> - **Tests:** `tests/unit/bank-club-routes.test.ts` (30: each refusal the prompt names — statement figures after a statement
>   exists is SQL, held by the guard and the probe; start out of order; undo of a non-latest; mark at a non-zero Difference
>   (422); a typed key the request tries to send — plus rule 3, rule 4, the gap offer, the codes);
>   `tests/unit/bank-r2-server-guard.test.ts` (every route's gate and `write`, no year or season parameter, no coach reader,
>   intent only, awaited writes, mig 439's functions, grants and refusals, never in the future). Bank tests 166/166 with R1's
>   and R2a's; the Payouts tab's tests unchanged and green.
> - **End to end on the dev server** as `uat-rep-club`'s treasurer (`.probe/bank-r2b-routes.mjs` and
>   `.probe/bank-r2b-processing.mjs`, not committed; every row they made deleted after): never-done-this → name → set up (a
>   picked and a typed item) → check a statement → tick all 7 → 422 at −$5,880.00 → a bank fee balances it → Mark checked →
>   figures and starting point refused → Undo (who and why) → re-enter → Mark checked → next statement, kept out and put
>   back, a payout refused as kept out → step back → a second account takes a book, a team book refused → rename; the
>   registrar reads 403 and can't write; a fee in the closed 2025–26 year refused in words with the next open day; "payment
>   processing" for po_1UVKmq… at the server's $5.00 (the request's 1 cent ignored), refused for a gap that is all "not
>   ours" and for a payout that sums.
> - **Checks:** typecheck and focused lint clean; `npm test` 14,079/14,086 (the 7 known failures elsewhere:
>   coach-practice-plans-phone-guard, plan-billing-usage, public-tournament-stage6-walk ×3, series-date-groups,
>   support-console-stage3-guard; reported, not fixed); spelling, dictionary coverage, date correctness, snapshot
>   freshness, manual-prod-migrations clean; the known eslint react-hooks plugin message and other tables' index coverage.
>   Schema snapshots refreshed by the migration hook but **left out of the commit**: they also carry other sessions' dev
>   tables.
> - **`/simplify` + `/review` (high) DONE 2026-11-04** (four lenses; security found no cross-club path). **Fixed before the
>   commit:** (1) ⚠ **"Add it as payment processing" counted the fee twice** and the offer never went away — the new line was
>   ticked beside the payout, whose gap stayed. Now the line's tick names the payout it closes (mig 439 `bank_check_add_line`
>   takes `p_payout_key`, the 12-argument form is dropped, a second line for the same payout on a statement is refused) and
>   the reader joins it to that payout's members (`withAddedMembers`), so the gap closes and the Difference stays $0.00
>   (tests pin both the broken and the fixed sums; the dev proof asserts the tick, the refusal and the bad kind). (2) "Didn't
>   go through the bank" is refused for a line outside the statement's window (it vanished from every list). (3) A payout tick
>   refused by a unique clash is `changed`, not a silent success (a twin double tap still is). (4) A body id that is not a
>   uuid (move book, new account, fee book, setup picks) is a clean refusal, not a 500; a fee date in the future is refused.
>   **The review's owner call (a tick landing on a statement just checked): owner said YES 2026-11-04, built as R2b-2
>   below.** Still noted, not fixed (R3): Mark checked compares the ticks only, not the book lines behind the $0.00 (R3's
>   "changed since" stamps are the backstop).

> **R2b-2 — a tick can't land on a checked statement ✅ built 2026-11-04** (server only; /simplify then /review offered before
> the commit):
> - **The finding it closes (R2b's /review):** a tick, an untick, a "Didn't go through the bank" or a "Put it back" sent a
>   moment after someone else's Mark checked commits could land on the statement that is now checked (`tickRow` / `keepOut`
>   wrote plain rows from a read taken before the write, no lock, no database guard), and the statement quietly stopped
>   summing to $0.00.
> - **Mig 440 `440_a_tick_waits_for_mark_checked.sql`** (functions only, service role only; dev 2026-11-04, prod owed with 436 +
>   437 + 439 in `MANUAL_PROD_STEPS.json`): the club steps `bank_check_tick` and `bank_check_keep_out` lock the org's own live
>   club account `FOR UPDATE` (the same lock `bank_check_mark` and `bank_check_undo` take, so a tick and a Mark checked run one
>   after the other), then hand to owner-agnostic halves `bank_tick_rows` / `bank_keep_out_rows`, which lock the account and
>   then the check `FOR UPDATE` and refuse `not_open` unless `status = 'open'`. **The coach portal's step (R4+) is one more
>   wrapper over the same halves**, not a copy. A tick's unique clash is decided inside the step: a row already ticked on THIS
>   statement is a double tap's twin (success); a row ticked on another statement of the account is `changed`, nothing
>   written (checked under the lock before anything is written; past that, a clash can only be the twin, `ON CONFLICT DO
>   NOTHING`). Two refusals
>   past the prompt's letter, cheap and under the same lock: a keep-out of a line ticked since the route read it is `changed`
>   (a ticked line went through the bank), and a payout key is `not_a_line` at the step too.
> - **`tickRow` and `keepOut` rewired** to call the steps through the bank-step wrapper; `tickPlan` / `keptOutPlan` unchanged.
> - **Checked before building, as the prompt asked: a keep-out CANNOT change the $0.00 Mark checked rests on.** `evaluateCheck`
>   builds the Difference from the starting balance, the ticks and the ticked payouts' gaps only; a kept-out line moves between
>   "outstanding" and "kept out", neither of which is in the sum, and a ticked line is never kept out (a mark wins over an
>   exclusion, and `keptOutPlan` takes only an outstanding line). So `bank_check_mark`'s seen-set stays the ticks alone; mig
>   439 is unchanged. (A keep-out landing between the server's evaluation and the step can leave the saved outstanding list one
>   line stale; harmless, because the next statement re-reads the line from the book and applies the exclusion again.)
> - **The two small leftovers, done:** (1) **the picker's search** (`pickerSearch`, pure): all digits ("1234") searches the
>   amount OR the description, so a cheque number finds its line; `$12` and `12.50` stay amount-only. (2) **the withheld
>   offer names its own reason:** `payoutGapViews` puts `withheld` on each view (no gap → `no_processing_gap`; a payout line
>   missing from this account's books → `payout_line_missing`; a held dispute whose figure disagrees with Stripe's net →
>   `dispute_figure_differs`; else `gap_not_a_fee`), and the add-line route answers that same reason. R2c's screen reads it
>   to explain a missing button. The two new codes have draft words in `lib/bank-check-words.ts` (R3 settles them).
>   **The status table now names every refusal code** (`STATUS_OF` is a full record, so a new code without a status is a
>   type error, and a test pins it to the words list).
> - **Tests:** `bank-club-routes` (+10: the four withheld reasons, the picker's three shapes, `not_open` and `changed` as
>   codes, every code has a status); `bank-r2-server-guard` §5 (+7: no route or bank library writes `bank_check_marks` or
>   `bank_line_exclusions` directly; `tickRow`/`keepOut` call their steps; mig 440's four functions, grants, plpgsql +
>   `search_path`, no `SECURITY DEFINER`, no table change; the account lock → check lock → `open` → write order; the club step
>   locks the org's own club account first; the clash decided in the step; every code has words and a status). The four bank
>   test files (`bank-check`, `bank-club-read`, `bank-club-routes`, `bank-r2-server-guard`) 165/165 as first built (the
>   grants and codes checks moved to a §0 over both migrations in /simplify; the final count is in the /review line).
> - **Dev proof** (not committed; every row deleted): `.probe/bank-r2b2-steps.sql` in one rolled-back block (tick, twin double
>   tap, keep out / put back, a ticked line and a payout refused as kept out, Mark checked, then tick / untick / keep out / put
>   back all `not_open`, a row ticked on the checked statement refused `changed` on the next one with nothing written, another
>   club `account_not_found`, grants) → `BANK_R2B2_SQL_PASSED`; `.probe/bank-r2b2-routes.mjs` through the real routes as
>   `uat-rep-club`'s treasurer (tick, $0.00, Mark checked, untick / tick / keep out refused 409 `not_open`, the checked
>   statement keeps exactly its tick, a plan read before the mark refused by the step itself, an all-digits picker search
>   answers) → `BANK_R2B2_PASSED`. R2b's own routes probe re-run green (`BANK_R2B_ROUTES_PASSED`).
> - **Checks:** typecheck, focused lint, spelling and dictionary coverage clean. Dictionary: the gotchas on
>   `bank_check_marks` (5) and `bank_line_exclusions` (1, 2) now say every write goes through a locked step. Snapshots
>   refreshed (function-only migration: no table change in them).
> - **`/simplify` done 2026-11-04 (four lenses), applied:** (1) **a refusal's status is named once** — `no(code)` and
>   `bankRefusedAs(code)` read `STATUS_OF`; the hand-typed statuses went, and with them a drift they had already made (a
>   malformed book id on Add an account / Move a book answered "not found" at 400; now 404, like every other "not found");
>   (2) **`withheld` is THE decision** and `offerPaymentProcessing` follows from it (`withheld === null`), so the two can't
>   disagree; (3) the tick step's after-insert count went (it could not fire: under the lock, the check before the write
>   already rules out a row ticked elsewhere); (4) **the "no direct write" guard covers all of `lib/` and `app/`**, so the
>   coach side (R4+) is held too, not only the club's bank files; (5) the guard's slicers use the shared throwing `between`,
>   and one §0 server-only floor (grants, `search_path`, no `SECURITY DEFINER`, every code with words and a status) now runs
>   over BOTH mig 439 and 440. Mig 440 re-applied to dev; both dev proofs re-run green; bank tests 167/167.
>   **Skipped, said so:** one `bank_lock_club_account` primitive shared by all nine steps (439's six repeat the same lock
>   too) — a convention change across 439 and 440 for R4 to take whole, not half here; the account locked again inside the
>   shared halves (kept: it keeps each half safe on its own for the coach wrapper, one index probe); the picker reading
>   "$1,234.50" (commas) as an amount like the Payouts search does — a behaviour change, not a cleanup.
> - **`/review` (high) done 2026-11-04** (four lenses: concurrency, correctness, security, regression; security found no
>   cross-club path and no filter injection; the race R2b-2 closes was confirmed closed under READ COMMITTED, with no lock-order
>   inversion). **Fixed before the commit:** (1) ⚠ **a tick could land on a line someone had just kept out** — the keep-out
>   step refused a line ticked since its read, but the tick step never looked at exclusions, so the line ended up ticked AND
>   kept out, and unticking it later dropped it into "kept out" instead of back to the list. `bank_tick_rows` now refuses
>   `changed` for a plain line kept out since the read (a payout's member, which rides its payout whatever a Stripe-outage
>   exclusion says, is not asked); the dev proof asserts both. (2) The withheld reason's order: a payout line missing is named
>   first (even when the gap reads $0.00), and "a dispute's figures disagree" only when a fee would otherwise be offered;
>   the two new sentences shortened (drafts for R3). (3) A guard that the owner-agnostic halves are called from no file in
>   `lib/` or `app/` (they skip the org check; only a migration's wrapper may call them). (4) The dictionary's
>   `bank_check_marks` gotcha 2 (a payout and its members are now tied by the step) and `bank_line_exclusions` gotcha 1
>   (names the one writer outside the account lock). (5) The R2b processing probe's two stale checks (the reason is now the
>   view's own; a processing line rides its payout since R2b's review fix) — probe only, not committed. Mig 440 re-applied to
>   dev; `BANK_R2B2_SQL_PASSED`, `BANK_R2B2_PASSED`, `BANK_R2B_PROCESSING_PASSED`; bank tests 171/171; typecheck + lint clean.
>   **⚠ LEFT OPEN, pre-existing (not made by R2b-2) → owner said YES 2026-11-05: chunk R2b-3 in the R2 build prompt,
>   before R2c's Move a book window (R2b-3 and R2c may run at the same time; R2b-3 owns the server):** **moving a book
>   races a keep-out or a tick.**
>   `bank_book_move` (mig 439) moves a book's exclusions and opening items holding only the BOOK's lock, not the accounts'.
>   So a "Didn't go through the bank" sent while someone else moves that line's book can stay behind on the old account (the
>   keep-out is silently lost; it reappears if the book moves back), a "Put it back" can miss and leave the line kept out on
>   the new account, and a tick can land on the old account's statement for a line whose book just moved (a bank fee added
>   during a move: the same). Two people, one moving a book while the other works on a line in it. **Fix is not a one-liner:**
>   making the move also lock both accounts would deadlock against a bank fee being added (that step holds the account, then
>   needs the book); the safe shape is the move taking both accounts' locks FIRST (in id order), then the book, re-reading
>   where the book sits, or the tick and keep-out steps checking the line's book still maps to their account. Recommended
>   before R2c builds the Move a book window (C10), as a small step of its own. **✅ BUILT 2026-11-05 as R2b-3 (both
>   halves of that shape; record below).**

> **R2b-3 — a book move can't race a tick, a keep-out or a fee ✅ built and committed 2026-11-05** (server only;
> /simplify then /review (high) done, below). **Mig 442** `442_a_book_move_waits_for_the_accounts.sql` (functions only, `CREATE OR REPLACE`
> with the SAME signatures, so every route's request and answer is unchanged and R2c builds against them as they are);
> applied to dev 2026-11-05, prod owed with 436 + 437 + 439 + 440 (`MANUAL_PROD_STEPS.json`).
> - **One lock order for every bank step:** Add an account's own lock (only Add an account) → the account(s), in id
>   order → the statement → the book; no bank step locks the club row while it waits for an account (/review, below). `bank_book_move` now reads where the book sits (unlocked), locks the from and to accounts `FOR
>   UPDATE` in id order, then the book, then reads again (moved meanwhile → `changed`, the route reads again). The account
>   locks are not simply added after the book's: the fee step holds the account and then needs the book, so that would
>   deadlock.
> - **One home for "which account holds this book":** `bank_club_account_of_book(org, ledger)` (its mapping row to a live
>   club account, else the club's first account; NULL for a team book or another club's) and `bank_club_line_left`
>   for an `entry:` key (after /review: true only when the line exists in a book this account doesn't hold). The move, the fee step (`bank_check_add_line`, same `book_not_in_account`) and the club tick /
>   keep-out steps ask it; the guard fails a second live copy of the predicate. (Named `…_of_book` rather than the prompt's
>   example `…_holds`: returning the account lets the move use it for "where is it now" too, so there is one predicate,
>   not two.) The owner-agnostic halves do not carry it (a coach account's keys are register rows; R4 wraps its own).
> - **The club tick and keep-out refuse a line that isn't the account's any more** (`changed`, nothing written): every
>   `entry:` line a tick would write (a plain line and each payout member) and a keep-out's or put-back's line, checked
>   under the account lock before anything is written. A `payout:` or `typed:` key is not asked; an untick never is (it
>   removes this account's own tick); nor is a saved copy of a line the books deleted outright (/review). **A put-back that removes nothing is `changed`, not ok** (in the owner-agnostic half).
> - **No new refusal code.** `changed` and `book_not_in_account` exist with words and statuses; `moveBook` already maps a
>   step's `changed` to the coded refusal (confirmed, no TypeScript change). For R2c's screens: a Move a book can now be
>   refused `changed` (read the account again), and so can a "Put it back" a second tab got to first.
> - **Checked before building (the prompt's two questions):** (1) every writer of `bank_saved_lines`,
>   `bank_line_exclusions` and `bank_check_marks` is a mig 439 / 440 / 442 step under the account lock (lib/ and app/ only
>   read them; guard §5, and §6 now fails a migration outside those three that writes them). (2) The mig 436 guard trigger
>   on `bank_account_books` only SELECTs (no lock). Also checked: no bank step locks or key-shares `organizations` after an
>   account (a book line has no org key; its two triggers take only a SHARED advisory lock on the club's books and read),
>   and nothing else in the migrations locks a book or a bank account row. **Add an account had one exception, found and
>   fixed here (and a second found by /review, below):** with two or more books its moves locked (A, new) → book 1 →
>   (B, new), a book before an account, which could deadlock against a single move of book 1 from B. It now locks every
>   live club account in id order before its first move.
> - **Tests:** `bank-r2-server-guard` §0 holds mig 442 (grants, search_path, codes with words); §4 and §5 now read each
>   function's LIVE definition (the latest migration that makes it), so the re-made steps keep R2b's and R2b-2's rules; new
>   §6 (lock order and re-read in the function text, the all-accounts lock before Add's moves, the club steps ask before
>   handing to the shared half, no second copy of the predicate, the key's shape checked before its cast, the empty
>   put-back, the writers census). Bank tests 223/223. `bank-club-routes` unchanged (no pure rule changed).
> - **Dev proof:** `.probe/bank-r2b3-steps.sql` (rolled back, `BANK_R2B3_SQL_PASSED`): two accounts on `uat-rep-club`, a
>   book with a kept-out line moved A → B (the keep-out goes with it); then on A a tick, a payout tick with a member from
>   the moved book, a keep-out and a put-back of the carried row are each `changed` with nothing written; A's own payout
>   still ticks; the same keys on B are fine; a put-back of a line not kept out is `changed`; a fee on A naming the moved
>   book is `book_not_in_account`, on B it books and ticks; a team book is `team_book`; a third account taking two books at
>   once; grants. `.probe/bank-r2b3-all.mjs` runs it with R2b-2's and R2b's SQL proofs and the three route proofs:
>   **`BANK_R2B3_PASSED`**. R2b-2's SQL proof ticked made-up keys, which a club tick now refuses as not this account's;
>   it now ticks three real lines of the first account's book (probe only, not committed). A true two-session race was not
>   staged (the dev SQL runner is one statement per request); the order is held by the function text (guard §6).
> - `typecheck` and focused lint clean; dictionary (`bank_account_books` gotchas 4–5, `bank_check_marks` gotcha 5,
>   `bank_line_exclusions` gotcha 1) updated; `check:dictionary` clean. Snapshots refreshed but **left out of the commit**:
>   442 changes no table, and the refresh also carries other sessions' changes.
> - **`/simplify` done 2026-11-05** (reuse, simplification, efficiency, altitude). **Applied:** the move locks both
>   accounts in ONE statement (`IN (v_from, p_to) ORDER BY id FOR UPDATE`, the idiom Add an account uses; mig 442
>   re-applied to dev, the prod verify query follows it); the guard now FAILS when a migration makes a bank function its
>   list doesn't name (before, a later migration re-making a step would have been silently ignored by `live()`, the very
>   drift §4–§6 exist to stop); §6 no longer repeats §0's search_path check; mig 439's path named once. **Probe fix:** R2b's
>   function proof (and the add-with-two-books step of R2b-3's) made several accounts in one transaction, so "the first
>   account" was a coin flip on ids; each probe's first account is now an hour older (probe only; a real account is added
>   in its own request). `BANK_R2B3_PASSED` three runs in a row; bank tests 224/224; typecheck + lint clean.
> - **`/review` (high) done 2026-11-05** (four lenses: concurrency, correctness, security, regression/test strength; security
>   found no cross-club path, grants verified on dev's live catalogue). **Fixed before the commit (mig 442 re-applied to
>   dev):** (1) ⚠ **a three-way deadlock 442 itself had made:** Add an account held the club ROW and then waited for an
>   account; the fee step holds an account and its book-line insert then waits on the fiscal-year trigger's shared lock
>   on the club's books; changing the club's first fiscal month (mig 318) holds that lock exclusive and then the club row.
>   Add an account now serializes on its own advisory lock (`bank_accounts_add:{org}`), locks the accounts BEFORE its insert
>   (which key-shares the club row) and never locks the club row. (2) ⚠ **a deleted line looped `changed` for ever:** a
>   saved copy (a checked statement's outstanding list, the carried list, a starting-point item) of a line the books
>   deleted outright is still offered as outstanding; the first version refused it as "not this account's". The helper is
>   now `bank_club_line_left`: refused only when the line EXISTS in a book this account doesn't hold (it also folds the
>   `entry:` prefix the two wrappers repeated, and its case). (3) **The starting point had the same stale-plan race**:
>   `bank_account_set_up` (re-made) refuses `changed` for a picked item whose book moved away since the route read it.
>   (4) **"The first account" could flip:** two adds racing on an empty club, the slower-to-commit stamped earlier
>   (`now()` is the transaction's start); the add now stamps `clock_timestamp()` under its lock. (5) Guard holes: the
>   no-second-copy check is alias-proof and also catches a hand-rolled "first account holds it"; mig 439's refusal codes are
>   read from the LIVE definitions; the add's lock order uses positions that can't pass on a missing anchor; the move's
>   re-check of the target under the lock is pinned; the function finder reads any spelling of CREATE FUNCTION. The earlier
>   draft's `bank_club_account_of_line` was dropped from dev by hand (never on prod). **Proofs:** the three rolled-back SQL
>   proofs green after the fixes (R2b-3's now also: a deleted line's saved copy ticks, keeps out and puts back; a starting
>   point picked from a moved book is refused with nothing saved). They now set aside, inside their own rolled-back block,
>   a real account the R2c chat made on `uat-rep-club` ("R2c walk chequing", untouched). **The three ROUTE proofs were not
>   re-run after the fixes**: they write and delete real accounts on that same club, which would appear in the middle of
>   R2c's walk; re-run them (`.probe/bank-r2b3-all.mjs`) once R2c's walk is done. Bank tests 237/237; typecheck + lint clean.
>   **Left, recorded:** Mark checked can save an outstanding list a moment stale after a book move (the $0.00 is
>   unaffected: ticks only) — R3's "changed since" stamps; a second "Put it back" (double tap, second tab) answers
>   `changed` as ruled (item 4), the screen reads again; Add an account with a book that moved meanwhile refuses the whole
>   add `changed` (the screen reads again and the treasurer adds it once more); an `unchanged` move answer is from an
>   unlocked read (nothing written; R2c should not treat it as proof).
>   **Skipped:** one shared SQL-function extractor for the four guards that each copy one (touches other sessions'
>   guards); a boolean "line left this account" helper to fold the `entry:` prefix guard the two club wrappers repeat
>   (worth it when R4 adds the coach wrapper, not before); a set-based tick check (a few ms on a 300-line payout); the
>   header's function list (439 and 440 carry the same).

> **R2c — the Bank tab, desk ✅ built 2026-11-05, committed `7d7b79cdb` 2026-11-05** (screens only, against R2b's routes as they are; no server file touched;
> /simplify + /review (high) done 2026-11-05, last bullet):
> - **The tab:** `accountingTabs` gains **Bank** right after Ledger (B8), for everyone who can open Accounting, always (no
>   flag, unlike Payouts); the page `app/[orgSlug]/admin/accounting/bank/page.tsx` adds no gate (the layout's, as the Ledger
>   tab); **the frame forces no Year pill** (checked: the pill is each tab's own), so none here, and no year anywhere.
>   `admin-kit-nav.test.ts` pins the new row; the hub's Accounting line names Bank by itself (it reads the list).
> - **Screens** (`components/admin/kit/club/money/bank/`): `BankTab` (which state shows), `BankSetup` (C1, and a second
>   account's setup), `BankCheck` (C2, C3, C5's Look again; a payout as one grouped row with its gap by reason),
>   `BankStatements` (C4, C5's list), `BankWindows` (Check a statement + correcting an open one, the bank fee and its
>   closed-year variant, Undo's reason, Add an account / Name and books). Types are the routes' own return types; every
>   figure is the server's answer; ticks go one write at a time so each answer holds every earlier tick.
> - **⚖ Where the build went past the drawing, said here (none reopens a ruling):**
>   1. **When the C3 callout and the amber appear.** The drawing says "once the treasurer has stopped ticking", but C3 itself
>      shows a line still outstanding. Built rule: the Difference isn't $0.00 **and no unticked line would bring it
>      closer** (matches both C2, no callout, and C3, callout). A screen decision from the server's figures, not a figure.
>   2. **"Didn't go through the bank" shows on every unticked line, not only cash / no-method ones** (Ask 6): the routes
>      do not carry a line's payment method. **Follow-up for the server (R3 or a small step): add the method to the tick
>      list's lines**, then narrow the button. Until then a treasurer can keep a cheque out by mistake ("Put it back" undoes it).
>   3. **C1's books list shows no balances** (the overview carries none) and, for the FIRST account, is a list, not
>      checkboxes: every club book in no account belongs to the first one (rule 1), so unticking would put it nowhere.
>   4. **C1's picker keeps Ask 3's 30 days on the screen**: the route reads every line on or before the day; the screen
>      shows the ones in the 30 days before and stops paging there.
>   5. **"Add an account" with one account** is a quiet link beside the list (the pill, where it is drawn, only exists from
>      a second account). **Moving a book** is the books list in "Name and books" (and in Add an account), as drawn: there
>      is no Move window; a book leaves an account by being ticked in the one it should be in.
>   6. **The closed-year fee window** says "{day} is in a closed fiscal year" (the view carries no year name) and holds
>      Add and tick until the date moves; "Use {today}" moves it.
>   7. **The Report link** (C4) is R3's (C9); "Open the line" in Look again opens the Ledger (no line address exists).
> - **Words:** every customer-visible string is in **`lib/bank-tab-words.ts`** (the screens' own; R2b's refusal sentences stay
>   in `lib/bank-check-words.ts`, read, not restated). Recorded under §5 below by pointer, not by copy (one home).
> - **Tests:** `tests/unit/bank-r2c-screens-guard.test.ts` (12: the tab's place, no gate, no year; intent-only writes and the
>   route's own types; no sum on the screen; every write control behind `canMove`; LoadingState labels, tokens, type ladder,
>   the symbol-only remove with its label and 44px phone floor). `admin-kit-nav`, `club-accounting-teams-guard`,
>   `online-payouts-list`, `notification-open-in-place-guard`, loading-state, table-recipe, phone-secondary-actions,
>   one-definition and type-scale guards green (310/310). Layout: `admin-accounting-bank` added to `scripts/layout-screens.mjs`.
> - **⚖ One engine change, with a test (said, as the prompt allows):** a typed opening line (or any line the book no
>   longer reads) lost its words once ticked — its mark carries figures only, and the mark wins the line's place — so
>   "Cheque #188" read "a line". `evaluateCheck` now gives a mark-sourced line its words from the list that placed it
>   (opening items, carried, the last check's saved list). Figures and the sum are untouched. `bank-check.test.ts` +1.
> - **Dev proof** (`.probe/bank-r2c/walk.mjs`, not committed; as `uat-rep-club`'s treasurer at 1440, every row it made
>   deleted; it refuses to start while another session's account is on the club): C1 empty and filled (8 lines in the 30
>   days, a picked line, a typed line) → Save opens Check a statement → C2 open, three ticks from the screen saved → a
>   payout opened with its gap by reason → C3 at $12.40 off (callout, Find by amount, the fee window) → Add and tick →
>   $0.00 → Mark checked → C4 "checked through" → Undo with a reason → the list after an undo (who, when, why) → C5 with a
>   stamped change → Look again → C10 Add an account moving a book → the second account's setup card → the Account pill
>   → a statement in the closed 2025–26 year → the closed-year fee window offers today. **`BANK_R2C_WALK_PASSED`**, no
>   page errors. `check:layout --only=admin-accounting-bank,admin-accounting,admin-accounting-ledger --width=1440`: no new
>   findings (`--changed` swept 348 screens because other sessions' shared files are in the tree, which the dev server
>   does not take; the Bank screen measured in its first-visit state).
> - **✅ FIXED 2026-11-05 (owner asked; engine only, no migration, no screen change; see the last bullet of this block):**
>   found by R2c's walk, **a ticked Stripe payout dropped out of its own statement once that statement was checked.** The reader asks Stripe only from the last CHECKED statement's end, and a
>   payout's tick is not a line the engine can read alone, so the checked Oct 31 statement on dev read **$193.25 off**
>   with the payout gone (probe: `difference=19325 payoutTicked=false`). On screen that is the C5 band ("Ticked now")
>   and, worse, **"Mark checked again" can never reach $0.00** on a statement holding a payout.
> - **✅ The payout fix, 2026-11-05, committed `aa106bac8` 2026-11-05 (said out loud):** the cause was wider than the reader's start date. A book line carries no
>   payout link for a payout Stripe was not asked about, so a ticked payout's members counted as plain lines and its gap
>   (deposit minus book side) fell out of the Difference; the same happened on ANY statement while Stripe's read failed. Fix
>   in the engine, not the reader: `evaluateCheck` rebuilds a ticked payout from its own tick (the deposit and day it was
>   ticked at; its members' ticks name it) when Stripe's list lacks it, flagged `fromMark`. So a checked statement reads
>   the same with Stripe asked or not, no extra Stripe read, nothing new to fail. A rebuilt payout counts its gap but names
>   no reason and offers no payment-processing line (`payoutGapViews` skips it: no Stripe facts behind it); its members now
>   ride it as they do when Stripe lists it, and Mark checked again keeps their link to it (it used to drop it). One earlier
>   test said a stamped member could be unticked alone while Stripe was down; now the payout is the row, so that test
>   unticks the payout and a stray member-only untick is a no-op. Proof: `bank-check.test.ts` (+4), `bank-club-routes.test.ts`
>   (+1, one reworded), the dev walk's checked statement went from `difference=19325 payoutTicked=false` to
>   **`difference=0 payoutTicked=true`**, `BANK_R2C_WALK_PASSED`.
> - **/review (high) of the payout fix, 2026-11-05** (three lenses: engine correctness, callers and blast radius, money
>   integrity and tests; none found a way to reach $0.00 on figures that do not reconcile, because the Difference is still
>   anchored on the bank's own ending balance). *Fixed:* a ticked line now follows the payout ITS TICK names (the book may
>   name another payout once the first is no longer read, and the line was counted twice); a member the book has since
>   deleted is not counted inside a rebuilt payout (its gap absorbs it, "changed since" still lists it, re-marking drops
>   its tick); three tests strengthened or added (Stripe's figure wins when Stripe lists the payout, a payout ticked on
>   another statement shows nothing here, a debit payout). Bank tests 203/203, walk passed again, no page errors.
>   *Left as findings (owner calls or small follow-ups):* (a) **marking is no longer blocked while Stripe is down and a
>   ticked payout is on the statement** (the old code blocked it by accident: the payout's gap fell out and the
>   Difference was off); the stored deposit is Stripe's figure at tick time and still has to match the bank's ending
>   balance, so this loosens a guard rather than opening a hole, but a refusal or a notice while Stripe is down would say
>   so; (b) **the "Stripe didn’t answer" callout is now out of date for ticked payouts** (they show grouped, held at
>   the figures they were ticked at; its words are in `lib/bank-tab-words.ts`, so a wording change is an owner ask under §5);
>   (c) a payment-processing POST for a rebuilt payout answers `not_outstanding` (nothing is written; only a stale page
>   can send it); (d) a stale member-only untick is a silent no-op that answers ok; (e) a rebuilt payout can never read as
>   changed (it is compared with its own tick); the bank pays a payout once, so this is the same blind spot the old code had.
> - **Checks:** typecheck and focused lint clean; `npm test` 14,201/14,209 at first run, the one Bank failure (the
>   possessive guard on "{account}'s checks") fixed with the shared `possessive`; the 7 left are the known ones elsewhere
>   (coach-practice-plans-phone-guard, plan-billing-usage ×2, public-tournament-stage6-walk ×3, series-date-groups,
>   support-console-stage3-guard ×2 — reported, not fixed). Spelling, contrast, dates, dictionary, org context,
>   observability, demos, public tokens (one `#188` placeholder read as a hex, reworded) clean for the Bank files; the
>   known react-hooks plugin message in `verify:changed`; old-look, admin-type, org-slug, CSS selectors and export
>   catalog fail on other sessions' files only.
> - **/simplify + /review (high) done 2026-11-05** (R2c's files only; walk re-run after the fixes, `BANK_R2C_WALK_PASSED`).
>   *Simplify:* the screens' own plural helper, a money-field copy, three "a line" fallbacks and a clock built by hand now
>   use the shared ones; the screens' last six inline sentences moved into `lib/bank-tab-words.ts` (same words, no new
>   wording); the Bank tab no longer reads an account twice after a write or on landing with a statement open.
>   *Review fixes:* the screen only draws a statement once it holds that statement (a late answer could leave one
>   statement's ticks under another's click); Mark checked now blocks ticks queued behind it (a refused late tick buried
>   the green "marked" notice in a red one) and waits for a keep-out in flight; an edit of an account that saved part of what
>   was asked and then refused keeps the window open on the refusal (it closed on a green "Saved"); an Undo refused because
>   the statement changed now says so and reads the account again (it closed silently); a refresh of the overview after a save
>   that fails no longer turns the working screen into a load failure; a picked starting line that moves out of the 30-day
>   window is dropped (it could not be unticked and was still sent); a typed line's label precedence in `evaluateCheck` now
>   matches the order the lines are placed in. *Left as findings (none made worse by R2c):* tick-all sends one write per line
>   (a bulk route would be R3 or later); Add an account / Start checking are two or three writes in a row (the server could
>   take the name in the setup step and the books in the rename); the view/edit gates `canMove &&` could be folded into the
>   server's own `can` flags; `isStuck` only sees one line at a time (two lines that together close the gap read as
>   stuck); a typed amount "12,50" reads as $1,250.00; the in-app help (`lib/help-content/accounting.tsx`) does not name Bank
>   yet (`/docs`); the layout sweep covers only the treasurer, not a read-only member; a write's answer and a refused-write
>   re-read are not ordered against each other across an account switch (narrow). One page error on the walk right after the
>   dev server was restarted (`No link element found for chunk …css`) is a hot-reload artifact of the restart.

> **R2d — the Bank tab on a phone, and R2's close ✅ built 2026-11-05; /simplify + /review (high) done 2026-11-05;
> commit hash: owed at the owner's "commit"** (screens only; no server file touched):
> - **Built (390; `useIsPhone` picks the phone form where the structure differs, the hook's own rule):**
>   - **C2:** a one-line strip (Difference + "n of N ticked") pins under the club header (`top: var(--admin-header-h)`;
>     `aria-hidden`, it restates the band), painted with an upward reach that covers the gap the condensing header leaves.
>     A **dock** (sticky above the phone bar) holds Finish later + "Mark checked" (shortened), with "The difference must be
>     $0.00 first." under it while the Difference isn't $0.00; on C5 it holds Close + Mark checked again. Each lime is built
>     once and placed at the desk's top line / under the list, or in the dock. The list is **`PhoneRow`**
>     (`components/admin/kit/club/money/bank/BankPhone.tsx`) inside the kit's `ClubRowList`: the whole row ticks, a 44px
>     tick cell, the direction as a sign on the amount, "Didn't go through the bank" under each unticked line. A payout is
>     one row with a 44px named opener; its lines and gap open full width below the row. The payout's parts (members,
>     total, gap line, the payment-processing offer) are one build shared by desk and phone.
>   - **C3:** the helpers stack full width; Finish later is left out of the callout (the dock carries it).
>   - **C4:** statements are kit `ClubRow as="button"` cards with a chevron (no label override, so the chips are read).
>     **Undo moved to the foot of the latest checked statement** on a phone (`BankCheck` gained `onUndo` from `BankTab`).
>   - **C1:** the starting-point picker is phone rows; a typed line keeps its 44px named remove.
>   - **C10:** the Account pill's shipped phone sheet and the full-screen `KitDialog`, as they ship.
>   - **Desk unchanged** (desk walk re-run passed) except one thing: "Close" in the dock is outlined; it stays ghost at a desk.
> - **⚖ Where the build went past the drawing (said to the owner before building; none reopens a ruling):**
>   1. "Didn't go through the bank" shows under **every** unticked line, not only cash ones: the routes carry no payment
>      method (R2c deviation 2). On a phone it is always visible, so it is louder and easier to mis-tap than at a desk.
>      The fix is R2c's logged server follow-up (the method on the tick list's lines).
>   2. C3's Finish later is not drawn in the callout on a phone (the dock has it).
>   3. The books stay a short list in C1 and Add an account, not the drawn pick-many dropdown: a first account's books
>      can't be chosen (rule 1), and a moving book's row says "moves from …".
> - **Words:** the phone's strings are in `lib/bank-tab-words.ts` (`markCheckedShort`, `pinTicked`, `tickedShort`,
>   `signed`, `cardTitle`, `cardLines`, `cardOutstanding`, `cardNothingOut`, `phoneListHint`, `phoneListHintRead`).
>   Recorded under §5 by pointer.
> - **Findings, recorded, not fixed here (none are the Bank tab's to fix):**
>   1. **Every club admin page on a phone is 72px taller than the screen:** the root `<main>` has 72px of bottom padding
>      under the 100dvh shell, so the whole document can be nudged up 72px. The shell's, not the Bank tab's.
>   2. **The admin header re-publishes `--admin-header-h` only when its content box resizes** (`AdminEventHeader`'s
>      ResizeObserver; the figure is `offsetHeight`), so after it condenses the published height can stay taller than the
>      painted header. The Bank strip covers the gap with its own paint; any other sticky layer on that variable shows it.
>   3. **Fixed chrome while ticking on a phone** is header + strip + dock + bottom bar, roughly 280px of 844. The drawing
>      warned about this; Ask 5 A was ruled anyway.
>   4. `joinSub` (`lib/club-born-public.ts`) duplicates `subLine`; hoisting one into `lib/utils.ts` is a follow-up.
>   5. The layout sweep measures only the first-visit state, as the treasurer (R2c's finding, unchanged).
>   6. The dock's full-bleed margin (`-1rem`) matches the admin shell's phone side padding by number; a shell with less
>      padding would scroll sideways. Fine where the tab lives today.
> - **Carried from R2c, owner calls (proposed, not shipped):**
>   - **The "Stripe didn’t answer" callout's words are stale for ticked payouts.** Proposed: "Stripe didn't answer, so new
>     payouts can't be grouped right now: their lines show one by one until it does. A payout you already ticked stays as
>     you ticked it." Not changed without the owner's yes.
>   - **Marking while Stripe is down with a ticked payout (R2c finding a): the phone makes it LESS visible.** The Stripe
>     callout scrolls away under the pinned strip while the dock's Mark checked stays in reach. The rule is unchanged.
> - **/simplify (2026-11-05, before /review):** the two limes and C5's pair built once and placed by width (no second
>   copy of either), the payout's parts shared by desk and phone, one phone row (`PhoneRow` + `subLine`) for C1, C2 and the
>   payout's lines.
> - **/review (high) 2026-11-05** (R2d's files only; three lenses: correctness, client state and B7, regression and
>   layout; no Critical or High, no desk regression, every write control absent for a reader). *Fixed:* the dock's "must be
>   $0.00" showed under a green $0.00 when the lime was held for an earlier open statement (two Undos), now only while the
>   Difference isn't $0.00; a keep-out or the payment-processing offer tapped while Mark checked is in flight now waits as
>   a tick does (on a phone the dock and every row's keep-out share the screen); the phone's Undo (beside Mark checked
>   again on a changed latest statement) waits for a mark in flight; a reader's phone list hint no longer points at an
>   Undo they never get; an opened payout's book total carries its sign like its lines; long unbroken bank descriptions
>   wrap instead of pushing the amount; an empty top-right box no longer leaves a blank row over the strip; the screens
>   guard now pins each lime to exactly two gated placements. *Left as findings:* the whole-row tick is a pointer extra
>   (the named checkbox is the keyboard path, as the desk row); the pinned count follows the server's answer, not the
>   tap (as the desk band); a refused write's re-read is not ordered against a later write's answer (R2c's finding, more
>   reachable with fast phone ticking); no tick-all on a phone (none drawn); a starting balance shows unsigned (a balance,
>   not a movement).
> - **Checks (after the review fixes):** `.probe/bank-r2d/walk.mjs` (not committed; as the treasurer at 390, every row
>   deleted) **`BANK_R2D_WALK_PASSED`**, no page errors; desk `.probe/bank-r2c/walk.mjs` **`BANK_R2C_WALK_PASSED`**;
>   `check:layout --only=admin-accounting-bank` at 361 and at 1440: no new findings; typecheck and `check:spelling` clean;
>   eslint clean on R2d's files; bank-r2c-screens-guard, bank-check, bank-club-routes, bank-club-read, bank-r2-server-guard,
>   admin-kit-nav, loading-state, table-recipe, phone-secondary-actions, one-definition **430/430**.
> - **R2 COMPLETE** at R2d's commit (R2a `af458c945`, R2b `01c533436`, R2b-2 `9a25464ea`, R2b-3 `c99e8e764`, R2c
>   `7d7b79cdb`, the payout fix `aa106bac8`, R2d: hash owed). **Owed before R2 is promoted:** migrations 436, 437, 439,
>   440, 442 applied to prod (`MANUAL_PROD_STEPS.json`; applied to dev); a club-pays payout seen in a browser; Stage 13
>   re-checks the Accounting tab row now that Bank sits in it (B8); R2b-3's three route proofs
>   (`.probe/bank-r2b3-all.mjs`) re-run.

### R3 — Club: the touchpoints
- [ ] Matched-line warning on the club entry edit/void routes and windows (C6); changed-since stamp.
- [ ] Fiscal-year close warning (`lib/club-fiscal-year-moves.ts` close preview), warns only (C7).
- [ ] Overview line (C7); printable report (C9).
- [ ] Help article (`/docs`, `lib/help-content/accounting.tsx`), words pass (`/marketing`).

### R4 — Coach: the source and the routes (no screen)
- [ ] Coach line source from the register (`lib/coach-register-book.ts` inputs), the working season plus the last checked
  statement's outstanding snapshot (B10, **no year parameter**; `HISTORY_ENDPOINTS` unchanged).
- [ ] Routes under `app/api/coaches/[orgSlug]/teams/[teamId]/bank/**` with `canWriteMoney` / `canViewMoney`.
- [ ] Automatic exclusion of family-paid-vendor rows; B6 marks.
- [ ] Drawing Ask 12 (A): at Start next season, save the closing season's unticked lines dated after the last check
  into the account's carried list, read by the next check. Hooked from the bank side; Stage 14's rollover file stays
  untouched as R6 already requires. If that proves impossible without editing it, stop and raise it.

### R5 — Coach: the Ledger's Bank view (desk + phone)
- [ ] Fourth `LedgerView` "bank" (`expenses/panel.tsx`, B8); K1–K4, K7. Read-only for money-read.

### R6 — Coach: the touchpoints, and the club's read
- [ ] Matched-line warning on coach record edit/delete windows (K5).
- [ ] The bank line in Start next season and Close the season (K6), warns only. **⚠ Sequenced after Stage 14 lands**
  (it owns the rollover modal's neighbourhood); edits the modal's warning list only, never `lib/rep-season-rollover.ts`.
- [ ] Money Overview line (K7); printable report (K8).
- [ ] The club's Teams tab mark (C8), read through a team-scoped reader like `teamCashHeld`.
- [ ] Help (`/docs`, `lib/help-content/coaches.tsx`), words pass (`/marketing`).

### R7 — Walk and marketing truth
- [ ] Owner walk (its own checkable page, a § in the Owner QA Ledger), both portals, desk and phone.
- [ ] `/marketing`: "bank reconciliation" back into the Club copy (R-c), and the §5 collisions.
- [ ] `/demos` decides whether the sandboxes show a checked statement (a number in a demo sentence is computed from the
  seed).

### What each stage needs from the neighbours
- **Stage 12 (payments):** R2 reuses the Payouts reader; P4 is proved in R1.
- **Stage 13 (navigation):** re-checks the B8 doors once R2 and R5 have placed them.
- **Stage 14 (one player across seasons):** R6 waits for it; this plan touches no family, roster, children, season-window
  or rollover code.
- **Stage 8 (go/no-go):** this project's walk is one of its §7 "inside, by name" items.

## Architectural decisions (proposed, follow the asks)
- **The tick is a mark beside the money, never on it.** No column on `accounting_entries` or any rep table. This keeps the
  fiscal lock untouched (ticking a closed-year line is not an edit), keeps the coach register a view, and lets one table
  serve both portals.
- **One engine, two sources.** `lib/bank-check.ts` takes lines; the club and the coach each supply theirs.
- **A checked statement keeps its outstanding list,** so nothing ever reads another season or another year.
- **No money audit table is introduced;** a check carries its own who/when/undo/reason, like the fiscal-year reopen.

## Open questions (build-time, not owner asks)
- [x] P4: does a payout's book side sum to its deposit in both fee cases? (R1) **Answered 2026-11-04, measured in Stripe
  test mode on `uat-rep-club` (`acct_1UUWAvFuSuqPawyy`, 4 automatic payouts; read-only scripts
  `.probe/bank-r1-p4-{cols,main,detail}.cjs`, re-run and read line by line in the main session):**
  - **Family pays: P4 HOLDS, to the cent.** Every app charge's balance transaction carries only an `application_fee`
    (no `stripe_fee`: on these direct charges Stripe takes no processing fee from the club's balance), so its net is the
    base, which is exactly the income booked (e.g. 156.75 charged, fee 6.75, net 150.00 = income 150.00). Refunds:
    fee 0, amount = the refund's own entries (156.75 = 150 + 6.75). Book side = Σ net on all app items, every payout.
  - **Club pays: Stripe's side MEASURED 2026-11-04 (R2a), holds to the cent.** One test charge on `acct_1UUWAvFuSuqPawyy`
    with the app's club-pays parameters (`onlineFee(10000,'club')`: total 100.00 = base, application fee 5.00;
    `.probe/bank-r2a-p4-club-pays.cjs`, charge `ch_3UYDEEFuSuqPawyy0Lvcv6DE`): its balance transaction carries only the
    `application_fee` (no `stripe_fee`), net **95.00** = income 100.00 − "Payment processing" 5.00, the book side the
    landings write (`online_payment_land` / `online_payment_league_land`). **Not measured: an APP-LANDED club-pays
    payment inside a payout.** A Checkout cannot be completed without a browser, and a landing forged by hand would
    measure the forgery. Owed once, in a browser on the dev server with the Stripe CLI forwarding (R2c's real-data pass
    or the owner): switch `uat-rep-club` to "The club pays it", pay one, and read its payout in the Bank tab. ⚠ The probe
    charge has no row of ours: it rides the account's next automatic payout (daily, 7-day delay) as a "Not from
    FieldLogicHQ" line.
  - **⚠ Where a payout does NOT sum, and R2 must say so by name (not "payment processing"):**
    1. **An open dispute.** Stripe withdraws the amount + its $15.00 dispute fee at once (po_1UVKmq…: −171.75), but the
       book records a dispute only when it is lost (`online_payment_disputes.lost_booked_at`). Gap until it resolves; both
       figures are stored on our side (`amount`, `stripe_fee`), so R2 can name it "Dispute held: $171.75" without reading
       Stripe. **Ask 7's "Add it as payment processing" is wrong for this gap** — R2 offers it only when the gap is not
       explained by an open dispute.
    2. **Stripe activity with no record of ours** (the 12d-1/12d-2 probe charges, debits and a standalone −5.00
       `stripe_fee`): dev-only in practice, but R2 needs a quiet "Not from FieldLogicHQ" line inside the payout rather than
       a silent gap.
  - **Side finding (not this project's; routed to the owner):** on dev, a refunded house-league payment (charge in
    po_1UWmVf…) has **no income entry** (`online_payment_items.entry_id` null) and its refund booked only the 6.75 fee.
    The payout still sums because the missing +150 and −150 cancel, but the book omits a payment and its refund. Worth a
    look by the Stage 12 owner (it may be a probe-era row).
- [x] Is the coach register row id a stable source key? (R1) **Yes, for every SETTLED row (verified 2026-11-04 in
  `lib/coach-register-book.ts`):** each id is a fixed source prefix plus the record's own uuid, minted once
  (`money-in-{id}` :368, `dues-payment-{id}` :436, `dues-payout-{id}` :446, `fundraiser-{id}` :522, `allocation-{id}` :595,
  `request-{id}` :659, `expense-{expenseId}-payment-{paymentId}` :292); nothing uses an index, a clock or read order, and
  one record never makes two rows. **Scheduled rows are NOT stable** (an installment row vanishes when paid; the grouped
  dues row `dues-installment-group-{n}-{date}` is rebuilt per read) — and never tick, because they have not moved. So the
  coach `line_key` is the register row id of a settled row; no new source key. R4 must pass only `!scheduled` rows, and
  `movesCash: false` → `familyPaidVendor`. ⚠ An `allocation-{id}` row's amount is "still due after credit", so a credit
  applied after a tick shows as "changed since" (correct: the money changed).
- [x] Pending club lines: excluded from ticking (recommended: they haven't moved). Confirm with the 12c bank-debit
  "still clearing" state. **Confirmed 2026-11-04 (R2a):** the online-payment writers never write a `pending` line; a
  bank debit that is still clearing has **no book line at all** (`online_payment_clearing` and a return before landing
  touch only `online_payments`), and its receipt line appears, posted, when it lands. So the only pending club lines
  are ones a person entered, and the engine leaves them out (`pending`, B6); the dev probe shows the one there left out.
- [x] Gaming-account requirement in BC/AB: confirm before C10 is drawn (B1). **Confirmed 2026-11-04, read in the
  sources:** BC Community Gaming Grants *Conditions for a Program Grant and Capital Project Grant* (eff. 2026-02-01)
  cond. 19(a) "a separate Gaming Account … for the exclusive purpose of receiving, holding and disbursing gaming funds";
  cond. 18 counts its interest as gaming funds; cond. 20 no cash. AGLC *Charitable Gaming Policies Handbook*
  (2026-03-13) 4.1.7 a designated gaming account, "Separate bank accounts must be established for each gaming type";
  4.1.9(a) pay vendors from it; 4.1.10 transfers out only for approved wages. Ontario's designated lottery trust account
  is similar (search summaries only, not read in the manual). Consequence: drawing Ask 1 (B5's General-book fee line).
