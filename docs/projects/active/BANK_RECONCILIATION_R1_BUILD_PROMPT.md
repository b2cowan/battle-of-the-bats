# Bank reconciliation R1: the account, the check and the engine (build prompt, no screens)

> **Written 2026-11-04**, after the owner approved the R0 drawings. **Paste
> `execute @docs/projects/active/BANK_RECONCILIATION_R1_BUILD_PROMPT.md` into a new chat on `dev`.** Other sessions share
> this working copy (Stage 14 is being built in one): stage explicit paths only, commit only your own hunks, and only when
> the owner says.
>
> **This stage builds nothing a customer sees.** It builds the tables, the engine that does the arithmetic, and the two
> proofs the screens stand on. R2 (the club's Bank tab) and R5 (the coach's Bank view) build the screens from the
> approved drawings.

## Read first

1. `docs/projects/active/BANK_RECONCILIATION_PLAN.md`: §0, §1 (P1–P4), §4 (B1–B12, **all ruled A**, with the two
   amendments under B5 and B10), §6 (what was drawn, and the drawing asks 1–14, **all ruled A**), §7 R1, the
   Architectural decisions and the Open questions.
2. The approved drawings: `BANK_RECONCILIATION_DRAWINGS.html` (https://claude.ai/artifact/6s8iTzaxGQDfAqugrSMbmZ). Tab
   2 holds the two example statements. Their sums are your engine's first test cases.
3. `docs/agents/db/DATA_DICTIONARY.md` on `accounting_entries`, `accounting_ledgers`, the fiscal-year lock (gotcha 10:
   team books are exempt), and the coach register sources. Decide what exists from the schema snapshots or live
   `information_schema`, never from migration files.
4. `lib/coach-register.ts` and `lib/coach-register-book.ts` (the coach Ledger is a view; nothing is created in it),
   `lib/online-payouts.ts` and `lib/online-payouts-map.ts` (the Payouts reader; store nothing from Stripe).

## What R1 must hold up (the rulings that reach the schema and the engine)

- **B1 + Ask 13:** the unit is a **bank account** (a name, never a number). Club books map to an account; an unmapped
  club book belongs to the club's first account. A team has exactly one account. **Moving a book** moves its unticked
  lines; lines already ticked stay on the old account's checks.
- **B3 + Ask 3:** a check is a statement (end date + ending balance); each starts where the last ended. The **first**
  check stores a starting date, the bank balance then, and the items outstanding then: picked from the books' own
  lines dated before the start, **plus lines typed in that exist only in the check** (never in a book).
- **B4 + Asks 9, 11:** checking locks nothing. A tick on a line whose amount or date changes later stamps the check
  **"changed since"**, with the line as it was checked and as it is now, who changed it and when. Undo is the latest
  check only, with a reason, recorded; **undo reopens the check with its ticks kept**, and the one before then becomes
  the latest. **"Mark checked again"** at $0.00 clears "changed since", recorded with who and when.
- **B5 + Ask 1 + Ask 8:** $0.00 required. A bank fee or interest line goes to **the account's own first book** (club) or
  is a cost/income record (coach; category required, Ask 2). A fee re-dated to today because its statement is in a
  closed fiscal year **still ticks on the statement it was added from**. Every other line dated after a statement's end
  waits for the next statement.
- **B6 + Ask 6:** a line can be marked **"Didn't go through the bank"** (reversible: "Put it back"). Left out
  automatically: same-account transfer pairs (club), family-paid-vendor rows (coach), void and pending lines. The engine
  reports a "kept out" total in and out.
- **B2 + Ask 7:** an automatic Stripe payout is one tickable unit whose tick stamps its member lines. If a payout's book
  side doesn't sum to the deposit, the engine reports the gap as a named amount, never as part of the Difference.
- **B10 + Ask 12:** the account belongs to the team, not the season. A checked statement saves its outstanding list. At
  **Start next season**, the closing season's unticked lines dated after the last check are also saved for the next
  check. The schema must hold that carried list now (R4 wires the trigger). No year parameter reaches any route.

## The work

1. **Migration** `supabase/migrations/436_bank_checks.sql` (or the next free number when you start; Stage 14 and others
   are allocating, so check). Plan §7 R1 sketches the tables. Extend it for: typed opening items (Ask 3), the carried
   list (Ask 12), "changed since" detail and "checked again" (Ask 11), undo history (Ask 9). RLS: club rows by
   membership with Accounting; team rows by team money access; writes only through routes. **No bank or account number
   column, ever.** A tick is a mark beside the money: no column on `accounting_entries` or any rep table.
2. `docs/agents/db/DATA_DICTIONARY.md` in the same unit of work, then `npm run refresh:snapshots` (dev + prod). Apply to
   dev only; record the prod apply as owed in the release record's usual place, positively worded.
3. **The engine** `lib/bank-check.ts`: pure, integer cents, no IO. Lines in → ticked balance, Difference, outstanding
   list, kept-out totals, auto-excluded list, changed-since detection, payout gap. Unit tests:
   - both example statements from the drawings tab 2, to the cent (club: $8,412.90, then $8,400.50 with the $12.40 fee;
     coach: $2,509.15, then $2,504.20, kept out $120.00 in / $120.00 out);
   - a statement straddling a fiscal-year end, a tick in a closed year, and the re-dated fee (Ask 8);
   - a rollover with a carried line (Ask 12), and a moved book (Ask 13);
   - undo then step back (Ask 9); changed since, then checked again (Ask 11).
4. **Prove P4** in Stripe test mode, on the dev club with payouts (`uat-rep-club`, payouts connected, test mode): for
   each automatic payout, sum its lines in the books against the deposit, in both who-pays-the-fee cases. Record the
   result in the plan's Open questions. If it doesn't sum, say by how much and why; R2 then draws the gap line (Ask 7,
   already drawn).
5. **Confirm the coach register row id is stable** across reads (source table + id). If not, add a stable source key
   the engine can mark, and record it.

## Done means

- Migration applied on dev, dictionary + snapshots refreshed, the engine's tests green, `npm run verify:changed` and
  `npm run typecheck` clean.
- P4 and the row-id question answered in the plan (§ Open questions), R1's boxes ticked, the TODO line updated.
- Offer `/simplify` (a new shared module) then `/review` before the owner is asked to commit. No `/docs` or `/marketing`
  this stage: nothing a customer reads changes.
- A closing message in product-owner voice: what now exists behind the scenes, what P4 found, and what R2 can build on.
- Disagree out loud if a ruling can't be built as written. Say so before working around it.
