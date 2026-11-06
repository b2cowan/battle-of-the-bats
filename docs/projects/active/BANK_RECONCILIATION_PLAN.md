# Bank reconciliation — both portals — THE BALANCE CHECK — Implementation Plan

> **Status:** Re-planned 2026-11-05 as **the balance check** (owner rulings 1 and 3 + drawing asks 1–10, all as
> recommended, 2026-11-05). Plan rewritten 2026-11-05 from `BANK_BALANCE_CHECK_REPLAN_PROMPT.md`. **Three new owner asks
> (Q1–Q3) RULED 2026-11-05, all A (as recommended), pasted back with no notes (§0, §8)** on `BANK_BALANCE_CHECK_ASKS.html`, https://claude.ai/artifact/E1Fy1qtppmJeEXMw3qVvKH (paste-back). **Next: BC1** (the engine, the migration and the
> club's server), build prompt `BANK_BALANCE_CHECK_BC1_BUILD_PROMPT.md`, written 2026-11-05. BC1 does not wait on Q1–Q3
> (§7 says which stage each ask feeds).
> **Created:** 2026-11-04 (tick-off planning session) · **Rewritten:** 2026-11-05 · **Branch:** dev
> **PM brief:** `BANK_RECONCILIATION_PM_BRIEF.md` (rewritten 2026-11-05)
> **Drawings of record:** `BANK_BALANCE_CHECK_DRAWINGS.html`, https://claude.ai/artifact/XdxsbzGpGwyDvWttJcjFeN (tabs 2–6
> the screens, tab 7 the asks). R0 `BANK_RECONCILIATION_DRAWINGS.html` (https://claude.ai/artifact/6s8iTzaxGQDfAqugrSMbmZ)
> still holds for **tab 7** (where the mark shows), **tab 8** (a second account, books between accounts) and **tab 9**
> (the report), re-worded by asks 4 and 9 (§6 here).
> **Plan-of-record slot:** `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` § "Bank reconciliation — both portals"
> **History:** the tick-off plan (asks B1–B12, R0 drawing asks 1–14, R1–R2 build records) is **Appendix A**, verbatim.
> R1–R2 are committed on dev (`502a69d39` … `d4ca80052`, 2026-11-04/05); the owner stopped their walk (§461) 2026-11-05.

## Goal

A club treasurer, or a team's coach or team treasurer, types a bank statement's **date** and **balance**. Every book line
on or before that date counts by itself. The screen shows **The bank says · Should be in the bank · Difference**, and when
the two don't agree it helps find what's missing. A check saves whether it matches or reads **"Off by $X"**. Nobody ticks
lines. One model, both portals. The club and the team each carry a quiet "Bank checked through {date}", and the club can
see it for each of its teams. This is the customer's own money; it does not touch what FieldLogicHQ charges.

---

## 0. What is ruled (do not reopen), recorded as ruled, nothing added

### Standing rulings (still hold)

| # | Ruling | Source |
|---|---|---|
| R-a | **Both portals:** the club's Accounting and the coach's team Ledger. | owner 2026-10-06 |
| R-b | **Planned and drawn before Stage 8; inside the Club release.** | owner 2026-10-06, 2026-10-12; `BUSINESS_DECISIONS.md` 2026-10-16 |
| R-c | **Marketing claims only what ships:** "payment reconciliation" stays out of every Club page until this ships. | `BUSINESS_DECISIONS.md` 2026-10-19 |
| R-d | **D1:** the coach's records are the source of truth for team money; the club reads them. | Club Tier plan D1 |
| R-e | **Coaches Portal rules bind the coach half:** a season is live until closed; a closed season is one page; unsettled money warns, never blocks; a history shelf needs its own owner mockup session. | `CLAUDE.md` (2026-08-18) |
| R-f | **Club fiscal year:** a closed fiscal year is read in place on the club's money tabs, locked. | owner 2026-10-07 |

### The balance-check rulings (owner, 2026-11-05)

The owner's reason, in chat: coaches and treasurers are not accountants. They log transactions from their bank, and they
need to type a statement balance, see the difference from the books on that date, and use it to find what's missing.

| # | Ruling |
|---|---|
| 1 | **One model for BOTH portals.** |
| 3 | **A check SAVES while off** and reads "Off by $X" (replaces B5's $0.00 rule). |
| Ask 1 | **Cash:** ONE optional "Cash not deposited yet" figure on the check; no money form changes. (The drawing labels this option **C**, listed first as recommended; "all A" on the ruling card means "as recommended". A cash box is a later second account.) |
| Ask 2 | **"Not in the bank yet"** lasts for that check only; the next check asks "Still waiting?" once. |
| Ask 3 | **Suspects** = every line since the last check that MATCHED (every line, on a first check). |
| Ask 4 | **The "checked through" line** moves to the latest check and shows an amber "Off by $X" chip when off. |
| Ask 5 | **Any saved check can be deleted**, after one question, who and when recorded. |
| Ask 6 | **Books changed after a save:** the saved row adds "Books now say $X"; no warning on money forms. |
| Ask 7 | **A club's first check** on an account asks one statement (date + balance) to start from, no outstanding picker; a **coach's** season opening balance is the start, no question. |
| Ask 8 | **Club online payments not yet paid out** are worked out from Stripe and shown as one line. |
| Ask 9 | **The association report stays**, built from a saved check. |
| Ask 10 | **The check sits on the Bank tab / the Ledger's Bank view itself**, above the saved checks. |
| Walk | **Owner walk §461 STOPPED** 2026-11-05 (R2 as built is superseded). |
| Ship | **Don't hide the built Bank tab;** the next promote will not come before this project is complete (owner 2026-11-05). |
| Q1 | **A cheque across a coach's rollover:** the coach's Find also searches last season's lines dated after its last matched check, read by the bank route itself (no year parameter from the page), under a divider "From the {2025 Season}"; such a line can be marked Not in the bank yet. (Asks page, ruled A 2026-11-05.) |
| Q2 | **A cheque written before the club's starting statement:** while no check since the start has matched, Find also searches the 60 days before the start; a line found there offers "Waiting at the start", which attaches it to the starting statement and fixes every later check. (Ruled A 2026-11-05.) |
| Q3 | **A book moved between accounts:** each saved check keeps the books it counted, so a move changes nothing earlier and "Books now say" means only that a line changed; the next check of each account counts the book where it is now; the move window says so in one sentence. (Ruled A 2026-11-05.) |
| Q2 + ask 6 | **A line marked Waiting at the start leaves saved checks' figures as they were:** saved later checks show "Books now say $X"; the next check, and "Check this statement again" on any of them, figure from the corrected start. (Owner, 2026-11-06, BC3.) |
| M3 | **A check's Not in the bank yet line may not be dated on or before the starting statement:** the save refuses it. (Owner, 2026-11-06, BC3.) |

### Tick-off rulings that still stand (Appendix A §4)

- **B1 (P1): the unit is a bank account, not a book.** Every club book belongs to the club's first account by default; a
  club may add a second account and move a book to it (gaming funds). A team has exactly one account, its own.
- **B7:** club: whoever can move club money may check; anyone who can open Accounting reads (on the club side today these
  are one permission, Appendix A §7 R2c). Coach: money write may check; money read sees the checks and the mark. Each
  check records who and when. No second approver.
- **B8:** club: an Accounting tab **Bank** after Ledger (built). Coach: a fourth Ledger view **Bank** in the View pill.
  Stage 13 re-checks these doors.
- **B9 (re-worded by asks 4 and 9):** one line on the club Accounting Overview and the coach Money Overview; each linked
  team's mark on the club's Teams tab, read-only (D1-safe, no standalone team is read by any club); a printable one-page
  report; warnings, never blocks, on the fiscal-year close and on Close the season / Start next season; nothing on Budget
  vs. Actual, the Statement, exports or the closed-season page.
- **B11 (logged Decided in `BUSINESS_DECISIONS.md` 2026-11-04):** club: part of Accounting (Club and Club · Association),
  no new key. Coach: Premium Coaches Portal, riding the Ledger; Basic gets no tease. No price or plan change.
- **B12 (still out of the first release):** statement upload, a live bank feed, preparer/reviewer sign-off,
  submit-to-club and the club returning a team's check, a closed-season shelf, a per-line matched mark in the Ledger, the
  Basic portal, coach-side Stripe, storing account numbers. ("Undo of any check but the latest" is moot: ask 5.)
- **P3:** associations read a team's check; the club reads the coach's fact (D1).

### Superseded (history in Appendix A, one line each)

- **B2:** typing the statement then **ticking each line** → gone; every line on or before the date counts by itself.
- **B3:** the statement chain and the **starting-point picks** (outstanding items at setup) → gone; ask 7.
- **B4:** **"Changed since it was checked"** and **undo-latest with a reason** → gone; asks 6 and 5.
- **B5:** the **$0.00 rule** (and its fee-to-a-book helper) → gone; ruling 3, "Add the missing line".
- **B6:** the **per-line "Didn't go through the bank"** keep-out → gone; ask 1 (one cash figure).
- **B10:** the **carried snapshot** at rollover → gone; the coach reads the working season (Q1 for the one gap).
- **R0 drawing asks 3–13** (opening picks, one ticked list, the pinned strip and dock, keep-out placement, the payout gap
  tick, the re-dated fee, step-back undo, the edit warning, Look again / Mark checked again, rollover carry, a moved book
  taking its unticked lines) → served the tick model, gone. Ask 1 (a fee or interest goes to the account's own book)
  survives as the default book of "Add the missing line"; ask 14 (two signature lines) survives on the report; ask 2
  (coach fee category) survives because "Add the missing line" opens the ordinary coach form.

---

## 1. Premises (said before the work)

**P1. The unit is a bank account.** Unchanged (Appendix A §1 P1).

**P2'. A coach's books are Cash on hand on a date.** The coach's "Your books on {date}" is the season's opening balance
plus every settled movement that moves cash, dated on or before the statement date: the same rule as Cash on hand
(`cashOnHandCents`, `lib/coach-register.ts:297`), with a date cutoff. Money that never went through the bank shows up as
the difference and is answered by one figure, "Cash not deposited yet" (ask 1). A family-paid vendor row is already left
out (it doesn't move cash).

**P3. Associations read a team's check; the club reads the coach's fact.** Unchanged.

**P4. Stripe deposits are net; the books are gross.** Measured in R1/R2a (Appendix A §7): family-pays payouts sum to the
cent; club-pays holds on Stripe's side (book income − the booked processing line = net). "On its way" is therefore the
book side of the online lines not yet paid out, processing lines included, so it equals what will land.

**P5. A club book has no opening balance, so the starting statement IS the club account's opening.** The club's "Your
books on {date}" = the starting statement's balance + the account's book movement after the starting date, through the
statement date. Books placed in the account count from the start; a transfer between two books in the same account nets
to nothing; a transfer to another account counts in each.

**Disagreements with the rulings, said out loud (each is an owner ask, §8):**

- **Q1, a cheque across a coach's rollover.** Written in the closing season, cashed in the new one. The new season's
  opening balance already counts it, so the arithmetic is right. But on the first check of the new season the bank shows
  $X more than the books, and Find (ask 3: this season's lines) can't name the cheque. The coach is left with an
  unexplained "Off by" until it clears.
- **Q2, a cheque written before the club's starting statement and cashed after it.** The drawing (tab 6) says Find names
  it. **Naming it does not fix it.** The bank at the start was $X higher than the books, so once the cheque clears every
  later check reads "Off by $X" for good. "Not in the bank yet" can't help, because it has cleared. "Add the missing line"
  would double-count it. Ask 7's "no outstanding picker" needs an after-the-fact way to tell the start about that line.
- **Q3, moving a book between accounts after checks exist.** If "Books now say" re-figures a saved check from today's
  placement, one move flags every earlier check on both accounts, though nothing in them changed. The next check of each
  account comes out the same either way. Only the earlier checks differ, and nobody has ruled it.

**Not a disagreement:** dropping the tick-off is right. The code agrees. The whole "which lines are in the account up to
D" question collapses to one SQL sum the club already has (`club_book_totals`, mig 317:557, posted in − posted out with
`entry_date <= p_to`, pending and void excluded). On the coach side, Cash on hand plus a date cutoff answers it. Most of
R1–R2's cost was the tick bookkeeping that ruling 1 removes.

---

## 2. What is true today (re-verified 2026-11-05 where the build changed it)

Appendix A §2 still holds for the books themselves (club `accounting_entries` / `accounting_ledgers`; the fiscal lock;
`canMoveClubMoney`; the coach register as a view over ~8 tables in cents; the season-scoped register; no year parameter;
the Payouts tab reading Stripe live). What R1–R2 added on dev:

- **Tables (mig 436, on prod 2026-11-04/05, service role only, RLS on with no policies):** `bank_accounts` (club|team,
  name only, `opening_date` / `opening_balance_cents`, one live per team, unique club names), `bank_account_books` (club
  book → account, guard refuses team books and other clubs' books), `bank_checks` (statement date + balance, `status`
  open|checked, `outstanding_snapshot`), and six tick-era tables: `bank_check_events`, `bank_check_marks`,
  `bank_check_added_lines`, `bank_check_changes`, `bank_line_exclusions`, `bank_saved_lines`.
- **Mig 437 (on prod):** `move_team_into_club` carries `bank_accounts`. Keep; any re-create starts from 437
  (`tests/unit/team-move-coverage.test.ts`).
- **Mig 439 (on prod):** nine step functions. **Migs 440 and 442 (dev only, `pending` in `MANUAL_PROD_STEPS.json`):** tick
  locks, keep-out locks, the book-move lock order, `bank_club_account_of_book`, `bank_club_line_left`. Because 440/442 are
  `pending`, they block a promote today.
- **Server:** `lib/bank-check.ts` (tick engine), `lib/bank-club-map.ts` (book reader, placement), `lib/bank-club-read.ts`
  (accounts + books + the club Payouts read, `unavailable` when Stripe doesn't answer, `bank-club-read.ts:91-103`),
  `lib/bank-club-rules.ts`, `lib/bank-club-steps.ts`, `lib/bank-check-fee.ts` (the only bank code that writes a real book
  line), `lib/bank-check-words.ts`, `lib/bank-tab-words.ts`; 12 route files under `app/api/admin/accounting/bank/**`.
- **Screen:** Accounting → Bank after Ledger (`lib/admin-kit-nav.ts:369,388`), no flag; components in
  `components/admin/kit/club/money/bank/`; layout screen id `admin-accounting-bank`.
- **Coach:** no bank code. `carriedAtRollover` (`lib/bank-check.ts:554`) is defined and never called.
- **Season start:** the rollover (`lib/rep-season-rollover.ts:127`, Stage 14's file) writes the new season's
  `opening_balance` from `seasonClosingCashCents`. Which date a season's books "start" on is not one stored column (open
  question O5).

---

## 3. Research

Appendix A §3 stands. The association form the report serves is the balance check's own formula: *bank balance + deposits
not yet in the bank − cheques not yet cashed = books* (MoneyMinder, Keiter; Cochrane, North Durham, Nanaimo, Kitchener,
Chilliwack). The balance check is the form the associations already ask for, which the tick-off was not.

---

## 4. The arithmetic (one engine, two sources)

For one account and one statement date **D**:

```
The bank says          = the typed statement balance on D
Your books on D        = club:  start balance + Σ(posted in − posted out) of the account's books, start < entry_date ≤ D
                         coach: season opening balance + Σ settled, cash-moving rows with date ≤ D
On its way (club only) = Σ book lines of online payments landed ≤ D whose payout had not arrived by D
                         (processing lines included, so it is the net that will land)
Not in the bank yet    = Σ lines marked on THIS check: a money-out line adds its amount, a money-in line subtracts it
Cash not deposited yet = the one optional typed figure (subtracts)
Should be in the bank  = books − on its way + not in the bank yet − cash
Difference             = bank − should be  →  0: "Matches" · else "Off by $|d|" + a sentence giving the direction
```

- **Starting statement (club):** saved as a check of kind `start`, result always "Starting point" (no result shown). Its
  books figure = its bank balance, adjusted by its waiting items (the Not-in-the-bank-yet rule solved for the books: a
  money-out line waiting at the start subtracts). With Q2-A, a line found later and marked "Waiting at the start" joins
  those items and moves every later check by its amount.
- **Coach:** no `start` row. The season opening balance is the start; a statement dated before the season's start is
  refused with a sentence saying why.
- **Saved figures:** each check saves the bank figure, the books figure, the on-its-way figure (or *not counted*, when
  Stripe didn't answer), each Not-in-the-bank-yet item (line key, date, label, amount, direction), the cash figure, and
  who/when.
- **"Books now say $X" (ask 6) = recompute on read.** The list re-figures *Your books on D* for every saved check from the
  books as they stand now, and adds the chip where it differs from the saved books figure. X is that books figure.
  Saved results never change. With Q3-A (recommended) each club check saves the books it counted, and the re-figure uses
  that list. Club cost: one SQL call per list (`bank_books_through(ledgers, dates[])`, one pass over the account's
  posted lines). Coach cost: none extra; the register rows are already loaded for the view, and the re-figure is
  a pure pass with a date cutoff.
- **"Matched" for ask 3** means *matched when saved*. A later "Books now say" doesn't un-match it.

### The hints (drawing tab 3), bounded

Candidates are the suspects (lines since the last matched check, or since the start), minus lines already marked Not in
the bank yet, **capped at the most recent 400 lines**:

1. **Exact:** one line whose amount is |difference|, either direction. The callout names the first one found; every match
   gets the "Exactly $X" chip.
2. **Half:** one line of |difference| ÷ 2, worded "entered the wrong way round?" (money in entered as money out, or the
   reverse). Only when the difference is an even number of cents.
3. **Two or three lines that add up to it,** same direction. Pairs and triples by sort + two pointers, O(n²) on the
   capped 400 (~160k steps, well under 50 ms). Show at most **3** combinations, nearest-dated first.
4. With none of those, the callout drops away and the list stays (as drawn).

Pure, client-safe, no IO; tests pin the cap, the cents parity and the ordering.

### Stripe "on its way" (ask 8, club only)

- **Definition:** online-payment book lines (the same sources the Payouts reader indexes: team payments, payment items,
  refunds, disputes) dated on or before D, **minus** every line inside a payout whose `arrival_date` ≤ D. A line in a
  payout arriving after D, or in no payout yet, is on its way. Lines landed more than **30 days** before D are taken as
  paid out (Stripe's schedules are daily to weekly). The "Stripe pays them out {date}" footer is the arrival date of the
  payout holding them, when there is one.
- **Read:** `readPayouts({…, from: D − 30 days, to: today, withEntries: true})` (`lib/online-payouts.ts:250`), the same
  3-minute cache.
- **Stripe can't be reached, or a payout lists no lines (manual / matching payouts):** the line reads *not counted* with a
  quiet notice (words §5). The check still figures and saves (drawing tab 6: "the line is left out and the check reads
  off"), and the saved check records *on its way: not counted*. A club with online payments off or no Stripe account has
  no line at all.

### Cash (ask 1)

One optional figure on the check, saved with that check only, empty on the next one. **Nothing reaches a money form, a
money table or a book line.** A guard test pins this: no bank code writes `accounting_entries` or any rep money table.

---

## 5. Words for /marketing

> Customer-visible wording written during the build, settled in ONE `/marketing` pass per stage, before the walk. Drafts
> below are the drawings' words unless marked *new*.

- [ ] "Bank" — the club Accounting tab and the coach Ledger view — club treasurer, coach
- [x] "Check a statement" · "Statement date" · "Bank balance on that date" (phone: "Bank balance") — the check form (settled, BC2 `/marketing` 2026-11-06; the phone word is BC4's)
- [x] "The bank says" · "Should be in the bank" (phone band: "Should be there") · "Difference" — the band (settled, BC2 `/marketing` 2026-11-06; the phone word is BC4's)
- [x] "Matches" · "Off by $X" + "The bank shows $X more than your books." / *new* "The bank shows $X less than your
  books." — band, saved list, Overview line, Teams view (settled, BC2 `/marketing` 2026-11-06 for the band and list; the Overview line and Teams view are BC5's)
- [x] "Your books on {date}" · "Online payments on their way to your bank · {n}" · "Stripe pays them out {date}" — sums (settled, BC2 `/marketing` 2026-11-06)
- [x] *new* "Couldn't reach Stripe, so online payments on their way aren't counted. Try again in a few minutes." — the
  Stripe line when it can't be read (settled, BC2 `/marketing` 2026-11-06)
- [ ] "Not in the bank yet" · "Undo" · *new* "Still waiting on {line}?" · "Yes" · "No" — Find and the next check
- [ ] "Cash not deposited yet" — the cash figure, the saved check, the report
- [ ] "Find the $X" · "Lines since your last match · {date}" · "Exactly $X" · *new* "Half of $X. Entered the wrong way
  round?" · *new* "These {2|3} add up to $X" — Find
- [ ] "Add the missing line" — opens the ordinary add form
- [x] "Save this check" · "It saves as off by $X. You can check this statement again later." — save (settled, BC2 `/marketing` 2026-11-06)
- [x] "Checked statements" · "The bank said" · "Should have been" · "Result" · "Checked by" · "Starting point" — list (settled, BC2 `/marketing` 2026-11-06)
- [x] "Books now say $X" — saved row chip (settled, BC2 `/marketing` 2026-11-06)
- [x] "Delete this check" · *new* "Delete the check for {date}? Its figures go; who deleted it and when is kept." ·
  "Check this statement again" — the opened check (settled, BC2 `/marketing` 2026-11-06)
- [x] "Start checking {account}" · "Pick a bank statement you already have and type its date and ending balance. Checks
  start from there." · "Start here" — club first check (settled, BC2 `/marketing` 2026-11-06)
  (BC3a 2026-11-06: built as drafts in `lib/bank-tab-words.ts`, with the undrawn *new* ones: the bank-less exact "If the
  bank hasn’t received it yet, that’s the gap." / "Or the bank took out $X your books don’t have: a fee or a payment you
  haven’t entered.", "These {2|3} add up to $X:" + "If the bank hasn’t cashed/received them yet, that’s the gap.", chips
  "Half of $X" · "Part of $X", "Next possibility", "Online payments · n · on their way, counted above", "not in the bank
  yet, counted above", "Show {n} more", the Still waiting Yes/No spoken names, and the `bad_item` refusal's M3 sentence.
  BC3b's `/marketing` pass settles all of them.)
- [ ] *new, Q2-A* "Waiting at the start" · "This was written before your starting statement and cashed after it." — Find
- [ ] *new, Q1-A* "From the {2025 Season}" — the divider above last season's lines in the coach's Find
- [ ] *new* "Statements from this season only, since {date}." (drawn) · *new* refusal "This statement is before the
  {2026 Season} started on {date}. Check it from last season before you start a new one." — coach
- [ ] "Bank: {account} checked through {date} ›" · "Bank: not checked yet ›" · coach "Bank checked through {date} ›" ·
  Teams "bank checked through {date} · Matches" — the mark (ask 4)
- [x] *new, Q3-A* "Saved checks keep the books they counted. The next check of each account counts this book where it
  is now." — Add an account / Name and books (settled, BC2 `/marketing` 2026-11-06)
- [x] *new, BC2a/BC2b, settled 2026-11-06* — the start and the opened check (`lib/bank-tab-words.ts`, `lib/bank-check-words.ts`):
  "Stripe didn't answer, so online payments on their way aren't counted yet." / "One of Stripe's payouts doesn't list what's
  in it, so online payments on their way aren't counted yet." + "Checks after this one may be off by those payments. You can
  try again in a few minutes, or start anyway." · "Try again" · "Start anyway" — the Start warning; "Checked through {date}"
  · "Not checked yet" — the top line; "Off by $X. Open the check for {date}" — the chip's spoken name; "online payments on
  their way weren't counted" — a start's row; "{account} · saved check" · "Statement ending {date}" · "Should have been in
  the bank" · "Not in the bank yet · {line}" · "Stripe didn't answer when this was saved, so online payments on their way
  weren't counted." — the opened check; "Books now say $X. A line dated on or before {date} changed after this check was
  saved. This check's figures stay as they were."; "Checked by {name} on {date} at {clock}"; "Delete this check?" · "Keep
  it" · "Delete" · "The check for {date} is deleted."; "{account} · starting point" · "Starting statement · {date}" · "Checks
  start from this balance" · "Started by {name} on {date} at {clock}" · "Delete the starting statement" / "?" · "Delete the
  starting statement for {date}? Checking this account starts again from a statement you pick. Who deleted it and when is
  kept." · "The starting statement for {date} is deleted. Start again from a statement." · "Open the starting statement
  for {date}" — the start's window; refusals *new, BC2 review, written AFTER the pass — BC3's `/marketing` pass settles
  them* "Stripe didn't answer just now, so online payments on their
  way can't be counted. Look over the figures again, then save." / "One of Stripe's payouts doesn't list what's in it, so
  online payments on their way can't be counted. Look over the figures again, then save." — a check whose save can't count
  Stripe. "Cash not deposited yet" stays in the module for the coach (BC6): the club desk has no cash field (owner).
- [ ] Report words (§6) — the printable page
- [ ] Help search words carry "reconcile / reconciliation"; the collision with the coach's "reconcile the estimate" and
  the export's "RECONCILIATION — SPENDING TO CASH" (Appendix A §5) goes to the same pass.
- [ ] R-c marketing truth: "bank reconciliation" returns to Club copy only after BC9's walk (pricing, Club plan article,
  homepage, in-app plan list, `PRICING_PAGE_COPY.md`). The three overclaims (onboarding, email defaults, module catalog)
  are still routed to `/marketing`, open.

---

## 6. Build notes from the drawings

**Tab 2, a check that matches.** One page: the check on top, saved checks below (ask 10). Club desk: Account pill ·
"Checked through {date}" · "Name and books"; "Check a statement" with Statement date and Bank balance, lime "Save this
check" inline; the shipped money band, three tiles joined (house rule), updating as you type (debounced server figure);
sums always open: Your books (with the book names), Online payments on their way (· n · Show), total; hint "Lines since
your last check ({date}): n · Show them". Coach phone: no Account pill; "Team bank account · checked through {date}";
Statement date, Bank balance, the wide optional Cash not deposited yet; band captions "your books, less $X cash"; full-width
Save; "Statements from this season only, since {date}." The middle tile is "Should be in the bank" everywhere ("Should be
there" on a phone band). ⚠ The tab-2 hint says "since your last **check**" and the suspects say "since your last
**match**". Ask 3 rules *match*; build both as *match*.

**Tab 3, Off by $75.00.** Amber, never red; direction in words, never a minus sign. "Find the $75.00" callout with the
first hint, the second sentence, buttons "Not in the bank yet" and "Add the missing line". Suspects toolbar "Lines since
your last match · {date}" + search "Find an amount or a name…"; table Date | What | Book | Money out | Money in | action;
the matching row tinted amber with the chip; "Not in the bank yet" on hover for any row; online-payment lines greyed
"counted above". Phone: signed amounts on row cards, "Show 10 more", full-width buttons. After "Not in the bank yet": the
item joins the sums (+ $75.00, "Undo"), tiles re-figure, the list closes. "Add the missing line" opens the ordinary add
form for that portal with amount, date and direction filled (club: the account's own first book, R0 ask 1; coach: the
ordinary Ledger add, fee category required, R0 ask 2). No separate bank-fee button. **"Still waiting?" (ask 2) is not
drawn:** build it as rows in the next check's sums, one per item of the latest earlier check, each with Yes (carries the
item onto this check) and No (drops it); once answered it stops asking.

**Tab 4, cash.** Option C only.

**Tab 5, saved checks.** Table: Statement date (link) | The bank said | Should have been | Result | Checked by | ›. Result:
"Matches", "Matches · n cheque(s) not in the bank yet", amber chip "Off by $X", amber chip "Books now say $X"; the starting
statement row greyed, "Starting point", no chevron (Q2 may add a "Correct the start" door). The opened check is a form
window 520: eyebrow "{account} · saved check", "Statement ending {date}", the three tiles, the saved sums, "Checked by
{name} on {date}.", footer red ghost "Delete this check" · "Close" · "Check this statement again" (opens the check with
the date filled; saving replaces the old one). Phone: white row cards, the window full screen.

**Tab 6, club only.** First check: "Start checking {account}" + the two fields + lime "Start here" + "Books in this
account: … · Change". Stripe line opened: child rows (date · what · who · card/bank · book · amount), footer "Stripe pays
these out on {date} · Payouts tab". Account pill options carry "{date} · Matches|Off by $X"; "Add an account" and "Name
and books" stay as built.

**R0 tab 7, where the mark shows (re-worded by ask 4).** Club Overview: the line right of "Where the club stands", no new
row. Coach Money Overview: in the Cash on hand card's foot, right of "Ledger", linking to Ledger → View: Bank. Teams tab:
column "Bank checked" ("Not checked yet" · "Through {date}" + "Matches" or amber "Off by $X"). "Changed since" chips
become "Off by $X". Fiscal-year close "Still open" row: "{account} last checked {date} · {Matches | Off by $X}", and
"not checked in the last month of {year}" when the latest check is before the year's last month (no statement count).
Coach Start next season / Close the season: "The bank is checked through {date}. Check the season's last statement
before you {start the new season | close}: the new season's Bank view starts from its own opening balance." Then "You
can still …". Warn, never block. K7 read-only coach: the same view without the form, Find buttons or Delete.

**R0 tab 8, a second account.** As built ("Add an account", "Name and books", a name only, never the number). The
tick-era hints ("Its lines not yet ticked move with it") are replaced by the Q3 sentence. A transfer between two books in
one account nets out by itself. A team keeps one account (a team gaming account is out of the first release).

**R0 tab 9, the report (re-worded by ask 9).** One printable US Letter page from a saved check, no phone version.
Eyebrow "{club} · Bank check"; "{account} · statement ending {date}"; "Books in this account: …". Lines, the association
formula top to bottom: Bank balance on the statement · + Not in the bank yet (table: Date | What | Book | Amount) · −
Online payments on their way (or "not counted") · − Cash not deposited yet · = Should be in the bank · Your books on {date}
(club: "Starting point {date} {balance} + book movement since") · Result Matches / Off by $X · "Checked by {name}
({role}), {date} at {time}" (formatTime) · "Books now say $X" when it applies · signature lines "Prepared by · date" and
"Reviewed by · date" · footer "Printed {date} from FieldLogicHQ · {club} · Accounting → Bank" (coach "… · Money → Ledger →
Bank"). The team report drops R0's "Against the team's Ledger" line (the books ARE the Ledger now) and "Not counted".
Doesn't carry: an account number, a line listing, Budget vs. Actual figures.

---

## 7. Reuse map (census 2026-11-05; cited lines opened)

| Piece | Carries | Rewritten | Deleted |
|---|---|---|---|
| **Tables** | `bank_accounts` (its `opening_*` pair dropped, the start is a `start` check), `bank_account_books` + guard | `bank_checks`: drop `status`, `checked_by/at`, `outstanding_snapshot`, the two tick constraints; add `kind` start\|check, books / on-its-way / cash figures, books list, `deleted_by/at` with the one-per-date unique made partial on live rows | `bank_check_marks`, `bank_check_added_lines`, `bank_check_changes`, `bank_line_exclusions`, `bank_saved_lines`, `bank_check_events` (who/when lives on the check) |
| **New table** | | | → `bank_check_waiting` (check, line key, date, label, amount, direction; also the start's Q2 items) |
| **Functions** | `bank_first_club_account`, `bank_club_account_of_book`, the 437 team move | `bank_book_move`, `bank_account_add` (keep the lock order: own advisory lock → accounts in id order → book; strip exclusion / opening-pick work); new `bank_check_save` (one step: replace a live same-date check, write items), `bank_check_delete`, `bank_books_through(ledgers, dates[])` | `bank_account_set_up`, `bank_check_start`, `_refigure`, `_mark`, `_undo`, `_add_line`, `bank_tick_rows`, `bank_keep_out_rows`, `bank_check_tick`, `bank_check_keep_out`, `bank_club_line_left` |
| **Engine** `lib/bank-check.ts` | `BankDirection`, `BankLine`, `signed`, `toCents` | `figureCheck`, `findHints`, `suspectsSince`, `booksNowSay`, the coach date cutoff | `evaluateCheck`, marks / saved / opening / snapshot types, `canMark*`, `canUndo`, `snapshotForMarking`, `payoutTickMarks`, `carriedAtRollover` |
| **Club reader** | `bank-club-map.ts` placement + entry mapping (`liveClubAccounts`, `placeBooks`, `ENTRY_SELECT`, `directionOfEntry`, `entryToBankLine`); `readClubBankAccounts`; `readClubPayouts` | `readClubBankAccount` → account + saved checks + figure for D + suspects + on its way | `checkRecords`, `marksOf`, `savedOf`, `stampsOf`, `payoutFloor`, `withAddedMembers`, `assembleAccount`, `accountOfPayout`, `nameGap` |
| **Rules / steps** | the Decision / refusal pattern, `readCents`, `readDay`, `readText`, `pickerSearch`; `step()`, `bankOverview`, `addAccount`, `renameAccount`, `moveBook`, `clubToday` | `startCheck` → save; `bankAccountView` | `openingPlan`, `tickPlan`, `keptOutPlan`, `markPlan`, `undoPlan`, `payoutGapViews`, `tickRow`, `keepOut`, `markCheck`, `undoCheck`, `refigureCheck`, `setUpAccount`, `linesBefore`; **`lib/bank-check-fee.ts` whole** (drawing: no separate bank-fee button) |
| **Words** | `bank-check-words.ts` refusal shape (trimmed to surviving codes); `bank-tab-words.ts` loading / failure / account words | the band, sums, Find, save words (§5) | tick, picker, gap, undo words |
| **Routes** `app/api/admin/accounting/bank/**` | `GET/POST /`, `PATCH accounts/[id]`, `POST accounts/[id]/books` | `GET accounts/[id]` (+ `?date=` figure), `PUT accounts/[id]/setup` → the starting statement, `POST accounts/[id]/checks` → save | `checks/[id]` PATCH, `ticks`, `kept-out`, `mark`, `undo`, `lines`, `lines-before`; new `DELETE checks/[id]` |
| **Screens** `components/admin/kit/club/money/bank/` | `BankTab` shell + account switching, `AccountWindow`, `MoneyField`, `BankPhone` row, `BankShared` helpers (not `isStuck`), most of `Bank.module.css`; wiring `admin-kit-nav.ts:369,388`, page, layout id | `BankStatements` → saved checks; `BankSetup` → "Start checking" (name/books/date/balance fields carry) | `BankCheck.tsx` (tick screen), `FeeWindow`, `UndoWindow` (its frame may become the delete confirm), the pinned strip and dock |
| **Tests** | `bank-club-read.test.ts` accounts / book lines / transfer pair / moved book / no-year guards; `admin-kit-nav.test.ts:228`; `team-move-coverage` | `bank-r2-server-guard.test.ts` §0–§6 (it pins the function list, the route list and live definitions; it **must** change with BC1); `bank-r2c-screens-guard.test.ts` keeps §1, §4, generic §3 | engine tick tests, route tick plans, dock / strip pins |

**Untouched:** `lib/bank-debit*.ts` (online bank debits), `lib/demo-*reconcile*` (demo reseed), the Payouts tab.

---

## 8. Owner asks (on `BANK_BALANCE_CHECK_ASKS.html`, https://claude.ai/artifact/E1Fy1qtppmJeEXMw3qVvKH, paste-back)

> **RULED 2026-11-05: Q1 A, Q2 A, Q3 A** (all as recommended, no notes). Recorded in §0. The options below are kept as
> asked.

- **Q1, a cheque across a coach's rollover (feeds BC6).** **A (recommended):** the coach's Find also searches last
  season's lines dated after its last matched check, read by the bank route itself (no year parameter from the page),
  under a divider "From the {2025 Season}"; such a line can be marked Not in the bank yet. B: the closing season's last
  check hands its Not-in-the-bank-yet items to the new season's first check (misses a cheque written after that check).
  C: nothing; the coach sees "Off by" until it clears.
- **Q2, a cheque written before the club's starting statement (feeds BC3).** **A (recommended):** when the account's checks
  since the start have never matched, Find also searches the 60 days before the start. A line found there offers
  "Waiting at the start", which attaches it to the starting statement and fixes every later check. B: the starting row
  opens and its date and balance can be corrected (no line named). C: as ruled, Find names it and the user deals with
  it outside.
- **Q3, a book moved between accounts after checks exist (feeds BC1's columns and BC2).** **A (recommended):** each saved
  check keeps the books it counted, so a move changes nothing earlier and "Books now say" means only that a line changed;
  the next check of each account counts the book where it is now; the move window says so in one sentence. B: every check
  is re-figured with today's placement, so a move flags every earlier check on both accounts with "Books now say".
  (Either way, the next check after a move can be off until the bank moves the money too. That is the bank's real state.)

---

## 9. Stages (each one build session; sequenced by dependency and rework risk)

**Why this order.** The migration first, because every later screen reads the new shape and the old tick tables would
otherwise keep being written. Then the club, because its tab exists and its reader exists. Find gets its own session
because the hints, suspects, waiting items and "Still waiting?" are the riskiest logic. The coach follows the club,
reusing the engine whole. The coach touchpoints wait for Stage 14 (it owns the rollover modal's file). No "hide the old
tab" stage: the owner ruled no promote before this completes (2026-11-05), and the BC1 migration is `pending` in
`MANUAL_PROD_STEPS.json`, so a promote is refused until it is applied on prod.

**Between BC1 and BC2 the dev Bank tab shows the account pill, Name and books, and the saved-checks list only** (the tick
screen is deleted in BC1). That is a dev-only gap and is said in BC1's hand-off.

### BC1 — The engine, the migration and the club's server (no new screens)
- [x] Read-only count on prod of every bank table before writing the migration (expected 0 rows; if not, stop and ask).
  **Done 2026-11-05 (owner yes): 0 rows in all nine** (`.probe/bank-bc1/prod-count.mjs`). Dev held 1 account (uat-rep-club
  "Walk chequing", start 2026-09-30 $5,000.00) and the stopped walk's one tick statement.
- [x] Migration **`447_the_bank_check_is_a_balance.sql`** (446 was taken by GST Part 6b the same day). **`/dba` reviewed the
  draft 2026-11-05** (Finding #47 in `DB_ARCHITECTURE_REVIEW.md`: `bank_books_through`'s CTEs `MATERIALIZED`, a non-partial
  `bank_checks_account_idx`, a waiting item's key validated, a prod PRE-CHECK); **applied to dev 2026-11-05 and re-run once
  (no-op)**; end shape on dev = 4 bank tables, 8 bank functions; the walk account's starting point became its `start`
  check, the tick statement was deleted. **Proved by `.probe/bank-bc1/functions.sql`** (rolled back, `BANK_BC1_SQL_PASSED`:
  every refusal of save/delete, the replace-same-date soft delete, a move keeping earlier `book_ids`, `bank_books_through`
  against a plain sum, a transfer pair and a pending line moving nothing, grants and RLS).
  ⚠ **Until BC1's server code lands (steps below), dev's Bank tab and its routes 500**: they still read the dropped tables.
- [x] `MANUAL_PROD_STEPS.json`: 440 and 442 → `held` (never apply, superseded by 447), 447 `pending` with the PRE-CHECK
  (2026-11-05; `check-manual-prod-migrations` lists 447 as blocking a promote). **Commit these with the migration.**

**BC1 build calls made 2026-11-05 (for the next session; said to the owner):**
- **The start counts Stripe on its way.** The start's books = its bank balance − Σ money-out waiting + Σ money-in waiting
  **+ on its way at the start** (the §4 formula solved for the books, whole). Without it, any club taking card payments
  starts with its in-transit payments missing and every later check reads "Off by" that amount for good. Owner may flip
  it (one line); not ruled.
- **An online-payment book line** = a posted `accounting_entries` line with `payment_method IN ('online_card',
  'online_bank')` (verified on dev: every receipt, processing cost and refund line Stripe moves carries it). On its way on
  D = those lines in the account's books dated in (D − 30, D], minus every line inside a payout with
  `arrives <= D` that did not fail. *Not counted* when Stripe throws, or when any non-failed payout arriving in
  [D − 30, D] is `manual` / `matching` (O6, as recommended). Only payouts arriving ≤ D need reading to subtract; reading
  a little past D gives the "Stripe pays them out {date}" footer.
- **Saved figures** are `statement_ending_balance_cents` (the bank says), `books_cents`, `on_its_way_cents` (NULL = not
  counted, 0 = none), `cash_not_deposited_cents`, the waiting items; **the difference is never stored**: the engine
  figures it from those (one home of the arithmetic). "Matched when saved" = that figure is 0.
- **"Books now say"** for a club check = the start's books **as they read now** (its waiting items now, so Q2 items
  attached later move every later check) + `bank_books_through(check.book_ids, [D, start date])` difference.
- **O2 closed as recommended:** the start owns its date; a check must be after it (`before_start`). A second start on
  another date is `start_exists`; a start re-saved on its own date replaces it even with later checks standing.
- **Refusal codes the step returns:** `bad_kind`, `bad_figures`, `bad_amount`, `account_not_found`, `ends_in_future`,
  `changed` (book list not the account's now), `start_exists`, `start_after_checks`, `no_start`, `before_start`; delete:
  `check_not_found`, `start_has_checks`; raised `bank_step_refused:bad_item`; 23505 on `bank_check_waiting_once` → `bad_item`.
- [x] `DATA_DICTIONARY.md` bank section rewritten 2026-11-05 (tables, columns, the 7 functions, gotchas, §4's sign rules;
  a short "tick-era tables, dropped by 447, still on prod until it is applied" stub keeps `check:dictionary` honest while
  prod holds 436's shape — delete it after the prod apply); `refresh:snapshots` run (watermark 447).
- [x] Engine `lib/bank-check.ts` rewritten 2026-11-05: `figureCheck`, `startBooks` (the start's books solved, with Stripe
  on its way), `figureOfSaved` / `matchedWhenSaved`, `booksNowSay`, `latestBefore`, `suspectsSince` (a same-account
  transfer pair drops out), `findHints` (cap 400, ≤3 combinations, nearest-dated first, a 200k-step stop so identical
  amounts can't run away), `coachBooksOnDate` (Cash on hand's own arithmetic with a cutoff). 21 tests in
  `tests/unit/bank-check.test.ts`, the drawing examples to the cent.
- [x] Club reader 2026-11-05: `lib/bank-club-map.ts` (pure: placement, entry lines, saved checks, `clubBooksOnDate`, the
  on-its-way rule `onItsWay`) and `lib/bank-club-read.ts` (`booksThrough` → `bank_books_through`, `readOnItsWay`,
  `figureForDate`, "Books now say" grouped by each check's own `book_ids`). 26 tests in `bank-club-read.test.ts`.
- [x] Routes 2026-11-05: six files (`GET/POST /`, `GET ?date=` / `PATCH accounts/[id]`, `PUT …/setup` = the start,
  `POST …/books`, `POST …/checks` = save, `DELETE …/checks/[checkId]`); the six tick routes deleted. Rules in
  `lib/bank-club-rules.ts` (`savePlan`, `checkView`, `checkedThrough`; 18 tests in `bank-club-routes.test.ts`), steps in
  `lib/bank-club-steps.ts`, refusal words trimmed to mig 447's codes.
- [x] Deleted 2026-11-05: `lib/bank-check-fee.ts`, `BankCheck.tsx`, `BankPhone.tsx` (a tick-checkbox row; §7 listed it
  as carried, but nothing renders it and its CSS failed `check-css-selectors`; BC4 builds the Find cards fresh), the
  Statement / Fee / Undo windows, `isStuck`, the dead words and CSS. `BankTab` = account pill + Name and books + the
  saved-checks list (`BankStatements`, tab 5's columns, read-only); `BankSetup` = "Start checking" (name, books, statement
  date and balance, no picker).
- [x] Guards 2026-11-05: `bank-r2-server-guard.test.ts` rewritten (66 tests: the live function set, every earlier bank
  function re-made or dropped by 447, the route list, rule 6, the steps, ⚖ §5 "no bank code writes money" over every bank
  lib, route and screen and every live bank function, R2b-3's lock order); `bank-r2c-screens-guard.test.ts` trimmed to
  §1, §3, §4 (8 tests); `team-move-coverage` passes.
- [x] Probed on dev 2026-11-05 as the uat-rep-club treasurer: `.probe/bank-bc1/routes.mjs` → `BANK_BC1_ROUTES_PASSED`
  (41 checks: add an account with a book, every save refusal, start, a matching check, an off check that saves, a cheque
  marked Not in the bank yet replacing the date's check (old row soft-deleted), Still waiting read, a line added after the
  save → "Books now say", the book moved back with `book_ids` and the earlier figure unchanged, delete soft, the reader
  refused). Every probe row removed (`.probe/bank-bc1/leftovers.mjs`: the walk account and its start only).
- [x] `/simplify` 2026-11-05 (4 angles): the save's date rules now live in ONE pure `saveRefusal` (the step's order),
  asked by both the save and the screen's figure; the club's live checks are one query (items embedded) read beside the
  accounts; the name lookup runs beside the slow reads; a save reads no suspects and a refused save reads no figure; no
  online-lines read with online payments off; one `booksOnDates`; the engine's `suspectsStart` + a generic
  `suspectsSince`; one waiting-item shape; the overview trimmed to what the screen reads; a guard pins the save step's
  club-book kinds to `CLUB_OWNED_BOOK_KINDS`. Fixed on the way: with Stripe down a line is no longer refused as Not in
  the bank yet (nothing is counted on its way then). Skipped: merging the two parallel `bank_books_through` calls,
  slimming a write's re-read, `jsonInit` learning PUT (outside the bank files), a SQL rewrite of applied mig 447. Re-proved:
  161 bank tests, typecheck, lint, the dev probe `BANK_BC1_ROUTES_PASSED`.
- [x] `/review` (high) 2026-11-06 — no Critical, no High; NO code changed by the review (so no probe re-run). Gate: tsc clean,
  161 bank tests, lint clean. Four lenses (arithmetic and signs, write path, SQL and lock order, screens and blast radius);
  mig 447 reaches ONE end shape from dev and prod, R2b-3's lock order holds in move / add / save / delete, every route keeps
  `resolveClubMoney` scope 'books', no bank code writes money. **Open, all Medium or Low, none blocks the commit:**
  (M1) a START saved while Stripe is down or a manual / matching payout falls in the window books on-its-way as 0, so every
  later check reads "Off by" that amount for good: owner call (refuse the start, or warn); (M2) "Books now say" uses the start's
  saved books, not the start's waiting items as they read now (plan build call): latent until BC3 attaches a Q2 item, fix in
  `withBooksNow` then; (M3) a check's waiting item has no lower date bound, so a line the start already proved was in the bank
  can be marked Not in the bank yet: decide in BC3; (L) a JSON `null` body gives a 500 not a coded refusal on the five write
  routes; no lower bound on a statement date (0202-10-31 is accepted as a start); a >200-char description cut mid-emoji;
  a same-account transfer half is accepted as a waiting item; a payout still in transit on D counts as landed; the screens'
  `changed` / `account_not_found` words don't re-read the view (BC2 rebuilds these); apply 447 on a quiet moment (it drops
  foreign keys). Dev's saved start-time items were dropped by the backfill (dev only). Commit on owner yes.

### BC2 — Club: the Bank tab on a desk (tabs 2, 5, 6; R0 tab 8)
Build prompt written 2026-11-06: `BANK_BALANCE_CHECK_BC2_BUILD_PROMPT.md` (two sessions: BC2a the form, the live band and
Start; BC2b the saved checks, Delete, the pill; one owner question first: a start saved while Stripe is down).
- [x] **BC2a built 2026-11-06** (owner said yes to the UX summary and to **warn, never block** for a start saved while Stripe
  doesn't answer): the Bank tab has "Check a statement" above the saved checks, for a writer only. Anchors:
  - **The form** (`components/admin/kit/club/money/bank/BankCheckForm.tsx`): Statement date (today) · Bank balance on that date
    · lime Save this check; the band and sums read from `GET accounts/[id]?date=&asked=check` (debounced 350 ms on the date;
    typing the balance re-figures at once with the engine's `figureCheck`, no round trip); Save sends only `{ date, bankCents }`;
    the saved check's own band comes back with the account (rule 6). Save works while off (ruling 3): "It saves as off by $X…".
    A day the server won't take (before the start, the start's own day, after today) says its own sentence; a day already
    checked says "Saving replaces that check".
  - **The band and sums** (`BankFigure.tsx`): the shipped joined band (`MoneySummaryBand`), "Matches" green, "Off by $X" amber,
    direction in words; the sums always open (Your books with the book names · Online payments on their way · n · Stripe pays
    them out {date} · Show/Hide, child rows, footer "Stripe pays these out on {date} · Payouts tab" · Should be in the bank);
    *not counted* shows the notice with Try again. Hint "Lines since your last match ({date}): n" is plain text (its Show is BC3).
  - **Start** (`BankSetup.tsx`): *not counted* shows the warning (two wordings: Stripe down, a payout that lists no lines) with
    **Try again** and **Start anyway**; the saved start keeps NULL. **Since the BC2 review (2026-11-06) the SERVER decides:**
    `saveCheck` reads Stripe to save and refuses `not_counted_down` / `not_counted_unlisted` (409) unless the body carries
    `anyway: true`; the card turns that refusal into its warning and has no pre-read of its own (BC2a's GET-then-PUT could
    save an unwarned NULL when Stripe failed between the two reads).
  - **Server asked-for changes** (BC1 loose ends, `lib/bank-club-steps.ts` / `-rules.ts` / `-read.ts` + the five write routes):
    `bankBody` (a JSON `null`/array body is a coded refusal, not a 500); `EARLIEST_STATEMENT_DAY` 2000-01-01 in `readDay`;
    `cutText` (a waiting label cut by characters); `?asked=start|check` on the figure GET (so the check form's own start day reads
    `before_start`). `typedCents` in the engine reads "($50.00)" as well as a minus sign.
  - **Stale view:** `changed`, `account_not_found`, `start_exists`, `start_after_checks`, `no_start`, `check_not_found` →
    `staleRefresh` in `BankTab` re-reads the overview and the account, THEN says the sentence (Start, the form and the account
    window all use it); the first Start flips `never` off locally while the overview re-reads (BC1 review findings 1–3).
  - **Proved 2026-11-06:** 21 new/extended tests (typedCents 4, loose ends 3, screens guard §5–§7 as 11); tsc, eslint, spelling
    clean; `check:layout --only=admin-accounting-bank` clean at 361/390/768/1440 (the text-button tap floor now reaches 768);
    dev probes `.probe/bank-bc2/routes.mjs` → `BANK_BC2_ROUTES_PASSED` (null bodies, date floor, `asked`, an overdrawn start,
    off then matching check replacing the day, **Stripe forced down**: figure `not_counted`, Start anyway saved NULL) and
    `.probe/bank-bc2/ui.mjs` → `BANK_BC2_UI_PASSED` (a real browser: band reads Matches, Save, the row in the list, a second
    account's Start warning → Try again → Start anyway). Every probe row removed; Stripe id restored.
  - **Open for the owner (not built, undrawn):** the club desk drawing has no "Cash not deposited yet" field (the coach phone
    drawing does); the server already takes it. Say yes and it is one field.
  - **Reader note:** a club member who can open Accounting but not move club money gets 403 on the Bank routes today (club read
    = write, B7), so the reader's "same screen without the form" branch is built but unreachable until that permission splits.
- [x] **BC2b built 2026-11-06, committed `d93b79055` 2026-11-06 (with the finishing passes and the review fixes) — saved checks: the table, the opened window, Delete (one question, who/when), Check this
  statement again (replace), "Books now say".** Owner rulings that session (all as recommended): no cash field on the club
  desk (build to the drawing); the starting statement opens and can be deleted while no later check stands; "line", not
  "cheque"; "Checked by" carries the clock; yes to the UX summary; and (after `/design`) **keep** no Close button in a record
  window and the medium (640) width for a check's window (the shipped band wrapped "Off by $12.40" at 520). Anchors:
  - **The list** (`BankStatements.tsx`): every row opens its check (the kit's `rowOpens`, the date a `nameButton`/`nameLink`
    door, the `go` chevron; phone rows `ClubRow as="button"`, named by their own date, balance and result). Result: Matches ·
    "Matches · n lines not in the bank yet" · amber "Off by $X" · amber "Books now say $X". Top line "Checked through {date}"
    with the amber chip when the latest is off, the chip a door to that check ("Off by $X. Open the check for {date}"). The
    starting statement opens too and, saved with Stripe not counted, says "online payments on their way weren't counted".
  - **The opened check** (`BankCheckWindow.tsx`): "{account} · saved check" / "Statement ending {date}", medium, the shipped
    band in past tense (`BankBand saved`), the saved sums line by line from the engine's `savedTerms` (`lib/bank-check.ts`:
    the lines, their signs and the total; the screen formats only), "Books now say $X." with why, "Checked by {name} on {date}
    at {clock}"; Delete is RepKit's `RecordDelete` ending the body, one question first, soft (who/when kept); the foot is
    "Check this statement again" (a writer's). The start's window (520, no band, no foot): its balance, on its way, "Checks
    start from this balance", "Started by …", and while later checks stand the server's `start_has_checks` sentence in place
    of Delete; deleting it puts the account back on its Start card, under the Account pill when there are two.
  - **Check this statement again:** the tab re-keys the form on that date and focuses the balance; saving replaces the check.
- [x] Account pill with "{date} · Matches|Off by" (`throughWords` on each option) and Add an account / Name and books with
  the Q3 sentence: built in BC1/BC2a; BC2b keeps the pill on a not-started account's Start card (BC2 review).
- [x] **Proved 2026-11-06:** `/design` (delete door → `RecordDelete`, no Close, medium width, the chip made a door, phone sums
  keep amounts right); `/marketing` (6 changes: "online payments" everywhere the start said "card", "Delete the starting
  statement", "Checks start from this balance", "This check's figures stay as they were", the start's door named for the
  starting statement; §5 below); `/simplify` (the sums' signs moved into the engine's `savedTerms` + `onItsWayOnCheck`
  with 4 tests that the lines add to the saved total, one `SumRow`/`SumTotal`, one signed-amount formatter, a dead word
  removed); `/review` high (4 lenses) — fixed: **the Stripe warning is the server's** (see Start above; a check shown counted
  that the save can't count is refused and re-read, one shown not counted saves with `anyway`), the Start card keeps the
  Account pill, the club's Delete reaches a club account only (`deleteCheck` reads the club's accounts first; a team's
  account sits in the same org from BC6), the chip and phone rows keep their words for a screen reader, "check again" is
  cleared on a delete, a net-zero line reads "$0.00". 232 bank tests; tsc, eslint, spelling, money arithmetic clean;
  `check:layout --only=admin-accounting-bank` clean at 361/390/768/1440; dev walks `.probe/bank-bc2/routes.mjs` (now also
  the server's `not_counted_down` refusal) → `BANK_BC2_ROUTES_PASSED`, `.probe/bank-bc2/ui.mjs` → `BANK_BC2_UI_PASSED`,
  `.probe/bank-bc2b/ui.mjs` → `BANK_BC2B_UI_PASSED` (32 checks). Every probe row removed; Stripe id restored.
  - **Review findings recorded, not fixed (Low unless marked):** (Low–Medium) a check saved in the instant its start is
    re-saved on its own date carries the old start's books (`saveCheck` reads the books outside the account lock; pass the
    start's id/books as an expected value to `bank_check_save`) — decide with BC3's M2; "Checked by" falls back to a removed
    member's email (`resolvePersonNamer`, shared); a refused date's figure GET still reads Stripe; `staleRefresh` skips the
    account re-read when the overview read was superseded, and a write's `setView` doesn't bump the view sequence; the Start
    card's fields stay editable mid-save; two treasurers starting the very first account at once make two accounts (BC1's
    `bank_account_add`); "Check this statement again" clears a typed balance (as designed: the form starts on that day,
    empty).

### BC3 — Club: Find (tab 3)
Build prompt written 2026-11-06: `BANK_BALANCE_CHECK_BC3_BUILD_PROMPT.md` (two sessions: BC3a Find on a check; BC3b Add the
missing line, Waiting at the start, M2, the finishing passes; two owner questions first: Q2 vs ask 6, and M3).
- [x] **BC3a built 2026-11-06** (owner: Q2 vs ask 6 and M3 ruled as recommended, §0; yes to the UX summary). Anchors:
  - **Find** (`components/admin/kit/club/money/bank/BankFind.tsx`, mounted by `BankCheckForm` under the sums, so behind
    `canMove`): while the check is off, "Find the $X", an amber `Callout` naming ONE possibility (exact · half · 2–3 lines),
    "{i} of {n} · Next possibility" when there are more, and "Not in the bank yet" on an exact one; then "Lines since your
    last match · {date}" (or since the starting statement) with the product's `SearchField`, the kit's table (Date · What
    with how it came · Book · Money out · Money in green · the action), newest first, 50 at a time ("Show {n} more"). A
    hinted row is amber-soft with its chip ("Exactly $X" · "Half of $X" · "Part of $X"); the chip is a button that brings its
    possibility into the callout. "Not in the bank yet" on every row: shown on a hinted row, on hover, on keyboard focus,
    always on a touch screen. Online payments on their way: one greyed row "Online payments · n · on their way, counted
    above", no action. A marked line stays in the list, greyed, with Undo. While the check matches or before a balance is
    typed, the tab-2 hint "Lines since your last match ({date}): n" carries **Show them** / Hide them (the same list, no
    callout).
  - **The hints are the engine's:** `hintsFor` (`lib/bank-check.ts`) = `findHints` over the candidates in the
    `closingDirection` only (the bank showing more → money-out lines; less → money-in lines), as one list exact → half →
    combinations. **Build call said to the owner and accepted with the UX summary:** §4's "either direction" was wrong — a
    line the other way, marked, doubles the gap (pinned by a test). Candidates = suspects − marked − on its way.
  - **Not in the bank yet + Undo** (ask 2): marking adds "Not in the bank yet · {line}" + Undo + the engine's sign
    (`waitingOnCheck`: + for money out, − for money in; `savedTerms` now uses it too) to the sums; the band is `figureCheck`
    with the marked items; Find closes when it matches. Save sends `waiting` = the marked KEYS (with `anyway` as before). A
    new date clears the marks and the answers.
  - **Still waiting?** (ask 2, not drawn): one sums row per item of the latest earlier check (`stillWaiting`), "Still waiting
    on {line}?" with Yes (marks it) and No (drops it for this check); Undo on a carried item asks again.
  - **M3** (`savePlan`, `lib/bank-club-rules.ts`): a check's line dated on or before the start → `bad_item` (`SaveFacts.startDate`,
    read by `saveCheck`); the `bad_item` sentence now says "dated after your starting statement and on or before this one".
  - **Search:** `pickerSearch` also reads a statement's thousands comma ("$1,250.00", "1,250") as an amount; "12,50" stays
    words (O4 stays BC3b's). `lineMatches` = an amount to the cent either direction, or words in the line or how it came.
    The day's figure's suspects carry `method` (worded by `paymentMethodWord`).
  - **Not built here (BC3b):** "Add the missing line" (absent, not a dead button), Waiting at the start, M2, O4's "12,50",
    the drawing's "Online payments paid out {date} · n" grouping (paid-out lines show one by one: the read doesn't know a
    line's payout).
  - **Proved 2026-11-06:** 241 bank tests pass (new: `hintsFor` 5, M3 1, search 2, screens guard §9 as 7; moved pins: the Save
    body, Show them, the form's imports); tsc and eslint clean on the bank files; `check:spelling`, `check:tokens`,
    `check:css-purity`, `check:club-money-arithmetic` clean, no new bank CSS selector finding; `check:layout
    --only=admin-accounting-bank` clean at 1440/768/390/361. Dev walk `.probe/bank-bc3/walk.mjs` (run with the ts resolver) →
    `BANK_BC3A_WALK_PASSED` at 1440 and at 390 (47 checks): five lines added as the treasurer through the Ledger route; Show
    them; off by $75.13 → callout, chip, one tap → Matches and Find closes, Undo; half; two lines; the bank showing less names
    the deposit; search by amount and name; the row button on keyboard focus; mark from the row, Save, the list says
    "Matches · 1 line not in the bank yet"; the server refuses M3, a line outside the books and a line on its way; Nov 5
    asks Still waiting? (Yes, Undo, No, a new date asks again, Yes + Save carries it); no sideways scroll at 390. Every probe
    check and line removed (voided through the Ledger route, then deleted); the walk account holds its Sep 30 start only.
- [ ] BC3b: "Add the missing line" (the ordinary Ledger add form, prefilled, the account's first book), Waiting at the start
  (Q2, as ruled §0), M2, O4, the BC2 review's start-under-lock finding; `/design`, `/marketing` (Find's words, drafts in
  `lib/bank-tab-words.ts`), `/simplify`, `/review`.

### BC4 — Club: the Bank tab on a phone (390)
- [ ] The phone frames of tabs 1–6: band, sums, Find cards with signed amounts and "Show 10 more", full-width buttons, the
  saved-check cards, the window full screen. No pinned strip or dock (gone with the tick-off).
- [ ] Phone walk probe; `/review`.

### BC5 — Club: the touchpoints and the club half's words
- [ ] The Overview line (ask 4), the fiscal-year close "Still open" row (`lib/club-fiscal-year-moves.ts`), the report
  (club, ask 9), help in `lib/help-content/accounting.tsx` (`/docs`), the `/marketing` pass on §5's club words.

### BC6 — Coach: the source and the routes (no screen)
- [ ] The team account, created at the first save (no setup question; name "Team bank account").
- [ ] The coach figure: opening balance + settled cash-moving register rows ≤ D (`coach-register-book.ts` rows, pure
  cutoff); a date before the season start refused (O5 decides the date); Find per Q1.
- [ ] Routes `app/api/coaches/[orgSlug]/teams/[teamId]/bank/**` with `canWriteMoney` / `canViewMoney`; the statement date
  is not a year; confirm the `HISTORY_ENDPOINTS` guard stays unchanged (and, with Q1-A, record the previous-season read
  as the decision it is, answering the three questions in `CLAUDE.md`).
- [ ] Saved checks and the mark read the working season only; the closed-season page shows nothing (B9).

### BC7 — Coach: the Ledger's Bank view (desk + phone)
- [ ] The fourth View pill option; the check with Cash not deposited yet; Find; saved checks; the read-only form for money
  read (K7). Walk probes both widths.

### BC8 — Coach touchpoints and the club's read (after Stage 14)
- [ ] The Money Overview line; the Start next season / Close the season warnings (the modal's list only, never
  `rep-season-rollover.ts`); the team report; the club Teams tab "Bank checked" column through a team-scoped reader
  (like `teamCashHeld`); help in `coaches.tsx`; `/marketing` on the coach words.

### BC9 — The walk and marketing truth
- [ ] Owner walk, both portals, desk and phone (a checkable page, a § in the Owner QA Ledger). `/marketing` puts "bank
  reconciliation" back (R-c) and settles the collisions; `/demos` decides on sandbox seeds.

### Neighbours
- **Stage 12:** reuses the Payouts reader (P4 proved). An app-landed club-pays payout seen in a browser is still owed
  (Appendix A §7 R2a); BC2's walk covers it.
- **Stage 13:** re-checks the B8 doors.
- **Stage 14:** BC8 waits for it; nothing here touches family, roster or rollover code.
- **Stage 8:** BC9's walk is one of its §7 items.

---

## Architectural decisions

- **The mark sits beside the money, never on it.** No column on `accounting_entries` or a rep money table; the fiscal lock
  is untouched; no bank code writes a book line (cash is a figure on the check; "Add the missing line" opens the
  ordinary form, which writes through its own route).
- **One engine, two sources.** `lib/bank-check.ts` is pure; the club source is a SQL sum over the account's books, the coach
  source the season's register rows.
- **Recompute on read, save figures once.** A saved check's figures never change; "Books now say" is derived each read.
- **The starting statement is a check of kind `start`** (not account columns), so its Q2 items hang off it like any
  check's.
- **Delete is soft** (`deleted_by/at`); the one-per-date unique holds for live rows; re-checking a statement soft-deletes
  the old row and saves a new one in one step, so the record of who checked it before survives.
- **Tables stay service-role only** (dictionary rule 7); routes decide with existing permissions.
- **Lock order carried from R2b-3:** an account-add advisory lock → accounts in id order → book. Never book before account.

## Open questions (build-time, not owner asks)

- [x] **O1 (BC1):** `bank_checks.book_ids` (the books a club check counted) is added in BC1, and the re-figure for
  "Books now say" reads it. Closed by Q3 = A (2026-11-05).
- [x] **O2 (BC1):** one live check per date, or allow a check dated on the start date? Closed as recommended 2026-11-05
  in mig 447: the start owns its date; a check must be after it.
- [ ] **O3 (BC2):** the band "as you type": debounce the server figure (~400 ms) and show the previous figure while
  waiting, or figure only on blur? (Recommend debounce.)
- [ ] **O4 (BC3):** Find's search field: amounts in either direction (as built, `pickerSearch`), "12,50" parse finding
  from R2c fixed in the shared cents parser.
- [ ] **O5 (BC6):** the season's start date for "statements from this season only, since {date}": the earliest of the
  season's own start field if one exists, else the date the season was created / rolled into. Verify against
  `rep_program_years` before building.
- [x] **O6 (BC1):** whether a payout that lists no lines (manual / matching) should make the whole on-its-way line *not
  counted*, or count everything since the last listed payout. Taken as recommended 2026-11-05 (*not counted*); the rule
  is in §9 BC1's build calls.
- [ ] **Carried findings (not this project's; already recorded in Appendix A §7):** club admin pages 72px taller than a
  phone screen; `--admin-header-h` re-publish; `joinSub` duplicates `subLine`; a refunded house-league payment with no
  income entry (Stage 12).

---

# Appendix A — the tick-off plan (SUPERSEDED 2026-11-05), verbatim

> Kept for its rulings that still stand (§0 R-a…R-f, P1, P3, §2, §3, B1, B7, B8, B9, B11, B12), its research, and the
> R1–R2 build record (§7). Everything about ticking, statement windows, starting-point picks, carried lists, keep-outs,
> "changed since", Mark checked again and undo-latest is history. Line numbers cited elsewhere as
> `BANK_RECONCILIATION_PLAN.md:NNN` before 2026-11-05 now sit inside this appendix.

## (A) Bank reconciliation — both portals — Implementation Plan

> ⚠⚠ **RE-PLANNED 2026-11-05 (owner): THE BALANCE CHECK replaces the tick-off. This file is being rewritten; until then,
> read everything below about ticking, statement windows, starting-point picks, carried lists, keep-outs, "changed
> since", Mark checked again and undo-latest as SUPERSEDED. Do not build R3+ from it.** Owner, in chat: coaches and
> treasurers are not accountants; they log transactions from their bank and need to type a statement balance, see the
> difference from the books on that date, and use it to find what's missing. Ruled the same day: **(1)** one model for
> BOTH portals; **(3)** a check SAVES while off and reads "Off by $X" (replaces B5's $0.00 rule). Drawings round 1
> (after /design): `BANK_BALANCE_CHECK_DRAWINGS.html`, https://claude.ai/artifact/XdxsbzGpGwyDvWttJcjFeN. **Drawing asks
> 1–10 RULED 2026-11-05, all A (as recommended), no notes:** 1 cash = ONE optional "Cash not deposited yet" figure on the
> check, no money form changes (option C; a cash box is a later second account) · 2 "Not in the bank yet" lasts for that
> check only, the next check asks "Still waiting?" once · 3 suspects = every line since the last check that MATCHED · 4 the
> "checked through" line moves to the latest check and shows an amber "Off by $X" chip when off · 5 any saved check can be
> deleted (who/when recorded) · 6 books changed after a save → the saved row adds "Books now say $X", no warning on money
> forms · 7 a club's first check on an account asks one statement (date + balance) to start from, no outstanding picker; a
> coach's season opening balance is the start, no question · 8 club online payments not yet paid out are worked out from
> Stripe as one line · 9 the association report stays, built from a saved check · 10 the check sits on the Bank tab /
> Ledger Bank view itself, above the saved checks. **Owner walk §461 STOPPED 2026-11-05** (R2 as built is superseded).
> ⚠ **Prod:** migs 436/437/439 are on prod (2026-11-05); 440/442 must NOT be applied as "owed" without the rewrite's
> migration decision. The built R2 Bank tab has no flag; **owner ruled 2026-11-05: don't hide it, the next promote
> will not come before this project is complete.**

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
> **R2c (desk) committed `7d7b79cdb` 2026-11-05; R2d (the phone, R2's close) committed `d4ca80052` 2026-11-05 after
> /simplify + /review (high); R2 COMPLETE 2026-11-05** (record under §7 R2; owed before the promote: migs 436/437/439/440/442 to prod).
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
> committed `d4ca80052` 2026-11-05** (screens only; no server file touched):
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
> - **R2 COMPLETE 2026-11-05** (R2a `af458c945`, R2b `01c533436`, R2b-2 `9a25464ea`, R2b-3 `c99e8e764`, R2c
>   `7d7b79cdb`, the payout fix `aa106bac8`, R2d `d4ca80052`). **Owed before R2 is promoted:** migrations 436, 437, 439,
>   440, 442 applied to prod (`MANUAL_PROD_STEPS.json`; applied to dev); a club-pays payout seen in a browser; Stage 13
>   re-checks the Accounting tab row now that Bank sits in it (B8). *R2b-3's route proofs re-run 2026-11-05 after R2d's
>   commit: `.probe/bank-r2b3-all.mjs` six of six PASS, `BANK_R2B3_PASSED`; the club left with no bank account.*
> - **Owner walk §461 published 2026-11-05** (https://claude.ai/artifact/8iE1yhY8wiv8myhE9Pgnsn, source
>   `BANK_RECONCILIATION_R2_WALK.html`): the club half of R7's walk, moved up so R3 builds on walked screens (owner yes
>   2026-11-05). R7 keeps the coach side and a short club re-check.
> - **⚖ Found writing the walk (B7, not a defect of R2):** on the club side, "who reads" and "who moves money" are ONE
>   rule today: `canMoveClubMoney` is `canOpenModule(…, 'module_accounting')` (`lib/member-access.ts:76`), and the
>   books gate reads with the same check (`lib/club-money-route.ts:30-32`). So no club member can open the Bank tab
>   without being able to work in it; the read-only form (every write control absent) is built and guarded but
>   unreachable from a club login. B7 A's "two money permissions" are two only on the coach side (money read vs write),
>   where R5 will exercise it. Nothing to change unless the owner wants a club "reads the books, can't move money" grant.

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
