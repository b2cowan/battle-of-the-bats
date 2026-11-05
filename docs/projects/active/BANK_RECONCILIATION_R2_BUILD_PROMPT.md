# Bank reconciliation R2: the club's Bank tab (build prompt, four one-session chunks)

> **Written 2026-11-04**, after R1 (`502a69d39`, record `6f0182147`). **Paste ONE of these into a new chat on `dev`, one
> chunk per session** (R2 is too big for one, and the later chunks are better for starting clean):
>
> - `execute @docs/projects/active/BANK_RECONCILIATION_R2_BUILD_PROMPT.md, chunk R2a only`
> - then `… chunk R2b only`, `… chunk R2b-2 only`, `… chunk R2b-3 only`, `… chunk R2c only`, `… chunk R2d only`.
>   (R2b-2 was added 2026-11-04 after R2b's review: owner said yes to closing the tick race before any screen is built.
>   R2b-3 was added 2026-11-05 after R2b-2's review: owner said yes to closing the book-move race before the Move a book
>   window is built. **R2b-3 and R2c may run at the same time, in two chats** — see "Running alongside" in each.)
>
> Other sessions share this working copy: stage explicit paths only, never `git add -A`, commit only your own hunks
> (temp index, HEAD guard: memory `reference_partial_commit_shared_tree`), and only when the owner says. A chunk ends
> with `/simplify` then `/review` offered, then its record.
>
> **Do not reopen** B1–B12 or drawing asks 1–14: all ruled A on 2026-11-04. If one can't be built as written, say so
> before working around it.

## What R2 is

A club treasurer opens **Accounting → Bank**, names the club's bank account, enters where the books stood on a starting
day, then checks statements: types the statement's end date and ending balance, ticks the book lines the statement shows,
reaches a **Difference of $0.00** and marks it checked. Desk and phone. **Club only** (the coach half is R4/R5). Nothing
here changes what FieldLogicHQ charges. No year pill, no year parameter anywhere (B3, B10): a statement may straddle a
fiscal year.

R1 already built the storage (nine `bank_*` tables, mig 436) and the arithmetic (`lib/bank-check.ts`, 26 tests). **R2 must
not redo or fork either.** If the engine can't express something R2 needs, change the engine with a test and say so.

## Read first

1. `BANK_RECONCILIATION_PLAN.md`: §0, §1 (P1–P4), §4 (B1–B12 and the amendments under B5/B10), §6 (C1–C10 and the
   drawing asks 1–14), §7 R1 (the "Built" block: **read all of it**, it lists the engine's choices) and R2, Open
   questions (P4 findings are binding below).
2. The approved drawings `BANK_RECONCILIATION_DRAWINGS.html` (https://claude.ai/artifact/6s8iTzaxGQDfAqugrSMbmZ):
   C1–C5 and C10, desk 1440 and phone 390, plus tab 1 (whole-screen before/after), the "Check a statement" window, the
   Account pill, the payout gap state, the list after an undo, "Look again", and the closed-year fee window.
   **Build to the drawings** (memory: build to approved mockups). C6–C9 are R3.
3. `lib/bank-check.ts` and `tests/unit/bank-check.test.ts`: the whole engine surface. `DATA_DICTIONARY.md` on the nine
   `bank_*` tables (the **Gotchas** are rules), `accounting_entries` gotchas 10–11, `accounting_ledgers`.
4. The code to copy (all verified 2026-11-04):
   - Gate: `lib/club-money-route.ts:21` `resolveClubMoney(req, { scope: 'books', write })`. Read = `canOpenModule(…
     'module_accounting')`, write = `canMoveClubMoney` (B7 exactly). Pattern routes: `app/api/admin/accounting/payees/route.ts`,
     `…/summary/route.ts`. **The older `…/ledgers/[ledgerId]/entries/route.ts` hand-rolls its gate: do not copy it.**
     Wrap routes in `withObservability`. Await every write (`no-unsent-db-writes`).
   - Tabs: `lib/admin-kit-nav.ts:358-` (`AccountingTabId`, `accountingTabs`), `components/admin/kit/club/money/AccountingFrame.tsx`,
     `app/[orgSlug]/admin/accounting/layout.tsx` (the server gate). Smallest tab to copy: `payouts/page.tsx` +
     `components/admin/kit/club/money/PayoutsList.tsx` (`useLatestRead`, `LoadingState`, `LoadFailed`, `useIsPhone`).
     The Bank tab shows for **everyone who can open Accounting, always** (it is where a club starts), unlike Payouts,
     which hides until payouts were connected. Follow the Ledger tab's page gate, not Payouts' `allowSuspendedOrg`.
   - Lines: `lib/db.ts` `getClubOwnedLedgers`, `lib/club-money-figures.ts` `isClubBook`, `lib/club-budget-read.ts`
     `loadBookLines`, `lib/club-ledger-read.ts` `readBook`. A transfer is two rows (`transfer_out`/`transfer_in`)
     linked both ways by `accounting_entries.linked_entry_id`; `amount` is positive and direction comes from `entry_type`.
   - Payouts: `lib/online-payouts.ts` `readPayouts` (Stripe is read live, never stored; a failed read **throws**, the
     list route answers 502) and `lib/online-payouts-map.ts`. **Do not write a second Stripe reader (plan R2).**
   - Writing a line: `lib/db.ts` `createEntry`, `lib/club-budget-writes.ts` `readFiledUnder` (a new line needs a budget
     word: "Bank & payment fees" out, "Interest" in; look in `budget_items` for the platform library row and any org copy),
     `lib/club-fiscal-year-server.ts` `refuseIfClosedFor` / `isClosedYearError` / `closedYearFromError`,
     `lib/club-fiscal-year.ts` `closedThrough(setting)` feeding the engine's `bankFeeDate`.
5. Guards a new tab/route family must satisfy: `admin-kit-nav.test.ts` (tab ids, labels, one real page per tab),
   `club-accounting-teams-guard.test.ts` (tab order), `online-payouts-list.test.ts`, `notification-open-in-place-guard.test.ts`
   (it reads `accountingTabs`), `club-stage3a-server-guard.test.ts` (each money-write route names `resolveClubMoney(req,
   { scope: 'books', write: true })`; **write a `bank-r2-server-guard` from the 3b/3c templates**),
   `club-money-one-definition-guard.test.ts` (a Bank tab that shows a book balance reads `lib/club-money-figures.ts`),
   `loading-state-guard.test.ts` (`LoadingState`, label ≤40 chars, "Loading…"), `table-recipe-guard.test.ts` (`--type-*`
   ladder), `phone-secondary-actions-guard.test.ts` (44px tap, symbol-only secondary action with `aria-label`).

## The seven rules R1's review left for R2 (binding; the database does NOT enforce them)

1. **A club's "first account" is its oldest live `owner_kind='club'` account.** Never "oldest live account": a team
   account moved in by mig 437 can be older. Every club book not in `bank_account_books` belongs to it.
2. **Statement figures and the account's starting point are immutable once statements exist.** Refuse an edit to a
   statement's end date or ending balance, and to the account's `opening_date`/`opening_balance_cents` once any statement
   exists. The way is **Undo, then re-enter**. There is no trigger; the route is the only guard. The same goes for order:
   `canStartCheck` (every earlier statement checked, new one ends after the last) is enforced in the route.
3. **A payout tick and its members' ticks are written and removed together, by the route.** `payoutTickMarks` builds
   them. Un-ticking the payout removes all of them.
4. **`snapshotForMarking(...).marks` is the COMPLETE set a statement keeps.** Marking checked, and marking checked
   again, **replace** the statement's marks with it (delete the others), so a line voided after it was ticked drops off and
   its amber clears.
5. **A typed opening line: the route generates the uuid first and sets `line_key = 'typed:' || id`** (mig 436 CHECK
   `bank_saved_lines_typed_shape`); no other kind may use a `typed:` key. Map the engine's `picked`/`typed` to the table's
   `opening_picked`/`opening_typed`.
6. **Every engine call is given its inputs by the server**, never the client: the account's lines, `payouts` (when
   readable), `openingItems`, `carried`, the statement's `addedLineKeys`, the exclusions, `stampedChanges`, and
   **`claimedElsewhere`** (keys marked on another account of the same club, Ask 13). The client sends only intent (tick
   this key); the server re-evaluates and **recomputes the Difference itself** before it marks anything checked.
7. **The carried-at-rollover insert uses `ON CONFLICT DO NOTHING`** (R4 wires the trigger; R2 only provides the club-side
   conflict-safe writer if it writes any `carried` row at all: it should not).

Also binding from the P4 measurement (plan Open questions): a payout that does not sum is **named by its reason**, never
"payment processing" by default:
- **Open dispute:** Stripe withdrew the amount + its $15.00 fee at once; the book records it only when lost
  (`online_payment_disputes.lost_booked_at`). Name it "Dispute held: $X" from our own stored `amount` and `stripe_fee`.
  Ask 7's "Add it as payment processing" is **not offered** for a gap an open dispute explains.
- **Stripe activity with no record of ours** (`not_ours` lines): a quiet "Not from FieldLogicHQ" line inside the payout.
- **Club-pays has never been measured.** One club-pays test payment through to a payout is owed before the grouped tick
  ships (chunk R2a does it; record the result in the plan).

---

## Chunk R2a: the club's reader (server only, no routes, no screens)

**Goal:** one server function that turns "this club's bank account" into the engine's `BankAccountState`, plus the payout
mapping the engine needs. Everything R2b and R2c stand on.

1. **Account resolution:** list the club's live accounts; the first account per rule 1; which books each holds
   (`bank_account_books`, the default rule); a book that belongs to no account yet. A club with no account at all returns
   the "never done this" state (C1).
2. **Lines → `BankLine[]`:** for the account's books, posted/pending/void club-book entries, `entry:{id}`, direction from
   `entry_type`, `transferPairKey = entry:{linked_entry_id}` (both halves in this account is the engine's automatic
   exclusion), `payoutKey` from the payout mapping below. **Bounded reads:** entries dated after the account's start (or the
   last checked end), **plus by id** every key a mark, a checked statement's snapshot, the carried list or an opening item
   names (so "changed since" and a line the book still reads are seen even if old). Chunk big `in` lists. Never an
   unbounded all-time read; never a year parameter.
3. **Everything else on the state:** marks, exclusions, saved lines (`opening_*` → `openingItems`, `carried`), checks +
   `outstanding_snapshot`, `bank_check_added_lines` → `addedLineKeys`, open `bank_check_changes` → `stampedChanges`,
   `claimedElsewhere` (keys ticked on the club's OTHER accounts).
4. **Payouts → `BankPayout[]` with member lines.** Extend the Payouts reader's mapping (not a second reader) so a payout's
   member lines carry the club-book **entry ids**: house league `online_payment_items.entry_id`; tournament
   `tournament_team_payments.entry_id` through `online_payment_id`; the club-pays fee line
   `online_payments.processing_cost_entry_id`; refunds `online_payment_refunds.refund_entry_id` and
   `processing_cost_entry_id`. The existing Payouts tab must not change (its tests stay green). Only **automatic** payouts
   with finished matching are passed; a manual one's lines tick by hand. **If the Stripe read fails** the reader returns
   no payouts plus a flag (`payoutsUnavailable`), so the screen can say so, and the engine's fallback applies (plan R1
   block). Per payout, compute **gap reasons** (open dispute amount, `not_ours` total, remainder).
5. **Measure P4 club-pays:** one test payment with `fee_payer='club'` through to a payout on `uat-rep-club` (Stripe test
   mode), read line by line, and record whether book side = deposit. If not, record the gap and why. (Probe scripts in
   `.probe/bank-r1-p4-*.cjs` are the model; read-only.)
6. **Pending lines:** the engine already leaves them out (they have not moved). Confirm against the 12c bank-debit
   "still clearing" state and close the plan's open question.
7. **Tests:** pure fixtures through the reader's mapping (no network): a moved book, a transfer pair, a payout with all
   member kinds, an open dispute, a failed Stripe read, a line old enough to need the by-id read. Plus a dev-data probe in
   `.probe/` (not committed) feeding `uat-rep-club` through `evaluateCheck` end to end without a throw.

**Done:** reader + mapping + tests green, P4 club-pays recorded, `npm run typecheck` (use `NODE_OPTIONS=--max-old-space-size=6144`)
and focused lint clean, plan R2 boxes ticked for R2a. No `/docs`, no `/marketing`.

---

## Chunk R2b: the routes (server only, no screens)

All under `app/api/admin/accounting/bank/**`, `resolveClubMoney(req, { scope: 'books', write: false|true })`, org from the
query, `withObservability`. The client sends intent; the server re-evaluates with the R2a reader and returns the engine's
numbers. Refusals are coded (`refused()`), never prose-parsed.

- **Read:** the Bank state for an account (accounts list, checks list, one check's evaluation: band, ticked, outstanding,
  kept out, auto-excluded, waiting count, payout gaps and reasons, changed-since, `canMarkChecked`/`canUndo`/…); the lines
  dated before a starting date for C1's "still outstanding then" picker (newest first, searchable, paged).
- **Write (`write: true`):** set up the account (name, starting date, balance, picked + typed items; rule 5) · add a second
  account and move a book to it (C10; the guard trigger's three refusals surface as coded refusals; **moving a book moves
  its unticked lines, ticked ones stay on the old account's checks**, Ask 13) · start a check (`canStartCheck`) · tick/untick a
  line or a payout (rule 3) · kept out / put it back (B6) · mark checked · undo with a required reason (latest checked
  only; reopens with ticks kept) · mark checked again at $0.00 (clears `bank_check_changes`, records who/when) · add a
  bank fee, interest or payment-processing line from a check (below) · rename an account.
- **Atomicity:** mark checked, mark checked again and undo each change several rows (status, snapshot, marks, event, cleared
  changes). **Do each as ONE database function** (a new migration, next free number at build time; the repo's pattern is
  `club_league_money`/`club-money-atomicity`), so the whole lands or none of it does. Single tick/untick/exclude rows
  are plain writes; treat a duplicate tick (`23505`) as "already ticked", idempotent. Disagree out loud if you see a
  better shape. The migration needs the dictionary + `npm run refresh:snapshots`; applied to dev only, prod recorded as owed.
- **The bank-fee writer** (`lib/bank-check-fee.ts`, thin): writes ONE real club-book line to **the account's own first
  book** (Ask 1; the dropdown lists that account's books only), expense "Bank & payment fees" / income "Interest" /
  expense "Payment processing" for a P4 gap that isn't a dispute. Date by `bankFeeDate({ statementEndDate,
  booksClosedThrough: closedThrough(setting), today })`; still run `refuseIfClosedFor`/`isClosedYearError` as the floor.
  Then record it in `bank_check_added_lines` and tick it on that statement (Ask 8: a re-dated fee still ticks on its own
  statement). If the second step fails, void the line with a reason and return the failure: no orphan line. Refuse a
  team book (`TEAM_BOOK_READ_ONLY`).
- **Rules 2, 3, 4, 6 live here.** Add a test for each refusal (statement figures after a statement exists; start out of
  order; undo of a non-latest; mark checked at a non-zero Difference; a typed key that isn't its own id).
- **`bank-r2-server-guard.test.ts`:** every route file names `resolveClubMoney` with the right `write`; none reads a year
  or season parameter; no route imports a coach reader.

**Done:** routes + tests + guard + migration (dev) green; dictionary + snapshots refreshed (commit only the bank hunks of
shared files); `typecheck`, focused lint. Offer `/simplify` then `/review` (it is a money write path: **high tier**).

---

## Chunk R2b-2: a tick can't land on a checked statement (server only, before R2c)

**Why (owner yes, 2026-11-04).** R2b's `/review` (record: plan §7 R2, "Left open (owner call, bigger change)") found that a
tick, an untick, or a "Didn't go through the bank" / "Put it back" sent a moment after someone else's **Mark checked**
commits can still land on the statement that is now checked. `tickRow` and `keepOut` in `lib/bank-club-steps.ts` are
plain-row writes (`bank_check_marks`, `bank_line_exclusions`): they decide "is this check open?" from a read taken
before the write, take no lock, and the database has no guard. The statement then quietly stops summing to $0.00. Close
it now, while nothing but the routes depend on these writes.

**Build.**
- **A new migration** (take the next free number when you start: `ls supabase/migrations`, since other sessions add them;
  dev only, prod owed with 436 + 437 + 439, entry in `MANUAL_PROD_STEPS.json`). Add the tick and keep-out writes as
  steps written the same way as mig 439's: plpgsql with `SET search_path = public` (no `SECURITY DEFINER`), `REVOKE … FROM PUBLIC, anon, authenticated`
  + `GRANT EXECUTE … TO service_role`, returns `{ok, code}`. Each step **locks the account row `FOR UPDATE` first**
  (the same lock `bank_check_mark` and `bank_check_undo` take, so a tick and a Mark checked run one after the other, not
  together), then the check `FOR UPDATE`, and refuses with `not_open` unless `status = 'open'`.
  - **Tick / untick:** removes and adds the rows `tickPlan` decided in one step. Keep R2b's two outcomes for a unique
    clash: a double tap racing its own twin (every row now ticked on THIS statement) is a success; a row ticked on
    another statement a moment ago is `changed`. Do it inside the step (`ON CONFLICT DO NOTHING` + count, then decide),
    not by catching `23505` in TypeScript.
  - **Kept out / put back:** the same lock and `status = 'open'` check, then the insert or delete.
- **Rewire `tickRow` and `keepOut`** to call the steps through the existing `bankStep` wrapper. The pure planning stays
  in `lib/bank-club-rules.ts`, unchanged; the step only adds what a read taken earlier can't promise.
- **Check before you build, and say what you found:** whether a keep-out can change what Mark checked's $0.00 rests on
  (read `evaluateCheck` in `lib/bank-check.ts`). If it can, `bank_check_mark`'s seen-set must include the kept-out keys as
  well as the ticks, so a keep-out landing between the server's evaluation and the step is `changed`. That change goes in
  the new migration (`CREATE OR REPLACE`), not by editing 439. If it can't, say so in the record.
- **Two small leftovers from the same review, same files (do them here):**
  1. **The starting-point picker's search** (`linesBefore`): an all-digits search ("1234") is read only as an amount, so a
     cheque number never finds its line. All digits with no `$` and no decimal searches the amount **or** the
     description; `$12` or `12.50` stays amount-only.
  2. **The withheld payment-processing offer can name the wrong reason.** `payoutGapViews` withholds the offer for four
     reasons (no gap · the gap isn't a fee · a book line of the payout is missing from this account's books · a held
     dispute's figure disagrees with Stripe's net) but `addBankLine` can only answer two of them. Put the reason on the
     view (R2c's screen needs it to explain a missing button anyway), give the two new reasons refusal codes and
     sentences in `lib/bank-check-words.ts` and statuses in `STATUS_OF`, and answer the right one.
- **Out of scope, say so if asked:** Mark checked comparing the book lines behind the $0.00, not only the ticks, is R3's
  "changed since" stamps. The coach portal's side (R4+) will need the same steps; do not build it here, but write the steps
  so the coach chunk can extend them rather than copy them.

**Tests.**
- Unit: the rewired `tickRow` / `keepOut` paths, each refusal (`not_open` on a checked statement, `changed` on a row
  ticked elsewhere, the twin double tap is a success), the picker's three search shapes, all four withheld reasons.
- Extend `tests/unit/bank-r2-server-guard.test.ts`: no route or step writes `bank_check_marks` or `bank_line_exclusions`
  directly (only through a step); the new functions lock the account then the check `FOR UPDATE`, refuse on
  `status <> 'open'`, and carry the grants; every new refusal code has words and a status.
- **Dev proof (a probe in `.probe/`, never committed, every row it makes deleted):** in one rolled-back SQL block, mark a
  statement checked and then call the tick and keep-out steps against it, which must be refused `not_open`. Then through
  the real routes signed in as the dev club's treasurer (the R2b probe in `.probe/bank-r2b-routes.mjs` shows the
  sign-in): tick, mark checked, try to untick, get refused. Print a `BANK_R2B2_PASSED` line.

**Done:** migration applied to dev; tests + guard + probe green; dictionary (the gotchas on `bank_check_marks` and
`bank_line_exclusions` now say every write goes through a locked step) + snapshots refreshed under the "Every chunk"
rule; `typecheck`, focused lint. Record it under plan §7 R2 (replace "Left open (owner call…)" with what was built, and
mark the two small leftovers done), the TODO bank line and memory. Offer `/simplify` then `/review` (**high tier**, money
write path) before asking the owner to commit.

---

## Chunk R2b-3: a book move can't race a tick or a keep-out (server only, before R2c's Move a book window)

**Why (owner yes, 2026-11-05).** R2b-2's `/review` (record: plan §7 R2 under R2b-2, "LEFT OPEN, pre-existing, owner
call") found that `bank_book_move` (mig 439) moves a book's `bank_line_exclusions` and `opening_picked` rows holding only
the BOOK's lock (`accounting_ledgers … FOR UPDATE`), never the accounts'. So, with two people at once (the window is
seconds, not milliseconds: the route's read includes a Stripe read before the step runs):
- a "Didn't go through the bank" sent while someone moves that line's book can stay behind on the OLD account: the
  keep-out is silently lost on the new one, and reappears if the book is ever moved back;
- a "Put it back" can miss (the move already carried the row to the new account): the step deletes 0 rows, answers ok,
  and the line stays kept out on the new account;
- a tick planned before the move can land on the OLD account's statement for a line whose book just moved (and a key
  ticked on the other account is then hidden there as claimed elsewhere), and a bank fee added from the old account can
  pass its "is this book the account's?" check just before the move and book into a book that is no longer its.
Nothing on screen can move a book yet; R2c's Move a book window (C10) makes it reachable. Close it first.

**Read first:** plan §7 R2 (the R2b-2 block, its /review record and the open item); mig 439 (`bank_book_move`,
`bank_account_add`, `bank_check_add_line`'s "the book must be THIS account's" predicate); mig 440 (the club steps and
their owner-agnostic halves; the header's "NOT CLOSED HERE"); mig 436 (the `bank_account_books` guard trigger);
`lib/bank-club-steps.ts` (`moveBook`, `tickRow`, `keepOut`); `tests/unit/bank-r2-server-guard.test.ts` (§0, §4, §5);
`DATA_DICTIONARY.md` `bank_account_books`, `bank_check_marks` gotcha 5, `bank_line_exclusions` gotcha 1.

**Build** (a new migration, the next free number when you start: `ls supabase/migrations`, other sessions add them;
functions only, `CREATE OR REPLACE` with the SAME signatures so no route changes; dev only, prod owed with 436 + 437 +
439 + 440, entry in `MANUAL_PROD_STEPS.json`; the R2b-2 house rules: plpgsql, `SET search_path = public`, no
`SECURITY DEFINER`, revoked from PUBLIC/anon/authenticated, EXECUTE to service_role, `{ok, code}`):
1. **One home for "this account holds this book"**: a helper (e.g. `bank_club_account_holds(p_org, p_account, p_ledger)`)
   with exactly the predicate `bank_check_add_line` has inline today (its mapping row, or no club mapping row and this is
   the club's first account). `bank_check_add_line` calls it instead of its inline copy (same behaviour, same refusal).
2. **The move takes the accounts' locks FIRST**, the same lock every tick, keep-out, Mark checked, Undo and fee step takes:
   read where the book sits now (unlocked), lock BOTH accounts (from and to) `FOR UPDATE` **in id order**, then the book
   row, then re-read where the book sits; if it moved meanwhile, answer `changed` (the route reads again). ⚠ **Do NOT
   simply add the account locks after the book lock:** `bank_check_add_line` holds the account and then needs the book
   (its insert into `accounting_entries` takes a key-share on the ledger), so book→account in the move and account→book in
   the fee step is a deadlock. Account(s)→book in both is one order. `bank_account_add` (org lock, then the move) stays
   consistent: nothing takes the org lock after an account lock — check that, and say so in the record.
3. **The club tick and keep-out steps refuse a line that isn't the account's any more** (`changed`): for every `entry:` key
   a tick would write (a plain line, and each payout member) and for a keep-out's key, the entry's book must be held by this
   account (the helper), checked under the account lock before anything is written. This goes in the CLUB wrappers
   (`bank_check_tick`, `bank_check_keep_out`), not the owner-agnostic halves: a coach account's keys are register rows,
   not `entry:` keys, and R4's wrapper will have its own rule. A `payout:` key is the payout's own (its members carry the
   check); a `typed:` key is the account's own saved line.
4. **A put-back that removes nothing is `changed`**, not ok: the route's read saw the exclusion, so if the step deletes 0
   rows, something moved it (a book move, or a second tab). Same in the owner-agnostic half (it is owner-neutral).
5. Keep every route's request and answer as they are (R2c builds against them, possibly at the same time). `moveBook`
   already maps a step's `changed` to the coded refusal; confirm, no new code needed. If a new refusal code turns out to
   be needed, it gets words in `lib/bank-check-words.ts` and a status in `STATUS_OF` (a type error otherwise) and is named
   in the record for R2c's screens.

**Check before you build, and say what you found:** whether anything else writes `bank_saved_lines`,
`bank_line_exclusions` or `bank_check_marks` without the account lock once the move takes it (grep migrations, lib/, app/);
and whether the 436 guard trigger on `bank_account_books` reads or locks anything that changes the lock order.

**Tests.**
- `tests/unit/bank-r2-server-guard.test.ts`: the move locks the accounts before the book (`FOR UPDATE` order in the
  function text) and re-reads the mapping; the club tick and keep-out steps call the holds-book helper before any write;
  `bank_check_add_line` uses the helper (no second copy of the predicate in any migration's live definition); a put-back
  deleting nothing answers `changed`; the §0 floor covers the new migration's functions (add it to `BANK_FN_MIGS`).
- `tests/unit/bank-club-routes.test.ts` only if a pure rule changes (it shouldn't).
- **Dev proof** (a probe in `.probe/`, never committed, everything rolled back or deleted): a two-account club on
  `uat-rep-club` in one rolled-back block: move a book from account A to B, then call A's tick and keep-out steps with a
  key from that book (the stale plan the race leaves behind) → `changed`, nothing written; a put-back on A of an exclusion
  the move carried to B → `changed`; a tick and a keep-out on B for the same key → ok; a fee on A naming the moved book →
  `book_not_in_account`; a payout member from the moved book in a tick on A → `changed`. Then re-run R2b-2's and R2b's dev
  probes (`.probe/bank-r2b2-steps.sql`, `bank-r2b2-routes.mjs`, `bank-r2b-routes.mjs`, `bank-r2b-processing.mjs`): all
  green. Print a `BANK_R2B3_PASSED` line.

**Running alongside R2c (owner, 2026-11-05).** This chunk owns the server: `supabase/migrations/**`,
`lib/bank-club-steps.ts`, `lib/bank-club-rules.ts`, `lib/bank-check-fee.ts`, `lib/bank-club-read.ts`,
`lib/bank-club-map.ts`, `tests/unit/bank-r2-server-guard.test.ts`, the dictionary's bank sections. It does not touch
screens, `lib/admin-kit-nav.ts`, `components/**` or `app/[orgSlug]/**`. Both chunks write the plan's §7 R2 and the TODO
bank line: commit only your own hunks (memory `reference_partial_commit_shared_tree`).

**Done:** migration applied to dev; guard + bank tests + probes green; dictionary (`bank_account_books`: the move now takes
both accounts' locks first; `bank_line_exclusions` gotcha 1: drop the "one writer NOT under the account lock" warning, say
what replaced it) + snapshots under the "Every chunk" rule; `typecheck`, focused lint. Record under plan §7 R2 (an R2b-3
block; mark the R2b-2 "LEFT OPEN" item built), the TODO bank line and memory. Offer `/simplify` then `/review` (**high
tier**, money write path) before asking the owner to commit.

---

## Chunk R2c: the Bank tab, desk

Build to the approved drawings, desk 1440. **Accounting gains "Bank" after Ledger (B8).**

**Running alongside R2b-3 (owner, 2026-11-05).** R2b-3 may be building in another chat at the same time. It owns the
server side (`supabase/migrations/**`, `lib/bank-club-*.ts`, `lib/bank-check-fee.ts`, the bank server guard) and keeps
every route's request and answer unchanged, so build the screens against the routes as they are. **Do not edit those
files here**; if a screen needs a server change, stop and say so (it goes to R2b-3 or a follow-up). Adding refusal WORDS
the screens need is fine only through the owner: ask first, since `lib/bank-check-words.ts` is shared. Both chunks write
the plan's §7 R2 and the TODO bank line: commit only your own hunks. What the server already gives the screens (built in
R2b-2): each payout gap's `withheld` reason (`no_processing_gap` · `payout_line_missing` · `dispute_figure_differs` ·
`gap_not_a_fee`) to explain a missing "Add it as payment processing"; a tick or keep-out on a statement just checked is
refused `not_open`, and a stale one `changed` — both mean "read again", and the answer already carries the fresh view
only on success, so re-read the account on a refusal. A malformed id is a 404.

- Registry: `AccountingTabId` + `accountingTabs` + the page `app/[orgSlug]/admin/accounting/bank/page.tsx`; update the
  five tests that pin the tab list (`admin-kit-nav`, `club-accounting-teams-guard`, `online-payouts-list`,
  `notification-open-in-place-guard`, the program-line builder in `ClubHubKit.tsx`). The tab is title "Bank" in the
  frame; **no Year pill** on this tab. Check whether the Accounting frame forces one; if so, say so before working around it.
- Screens: **C1** first-time setup (name, starting date, balance then, still-outstanding-then picked from the books plus
  typed lines; which books belong); **C2** an open check (the "Check a statement" window, the joined band **Statement ·
  Ticked · Difference**, the tick list ordered by date in two columns of money in/out per Ask 4, a payout as one grouped row
  closed and open, the gap line, the "Kept out of the bank" total, "Didn't go through the bank"/"Put it back"); **C3** the
  non-zero Difference with its three helpers (Add a bank fee or interest sheet incl. the closed-year variant · Find by
  amount, the Payouts tab's search pattern pointed at the tick list · Finish later); **C4** the list of checked statements,
  "checked through", Undo on the latest with its reason window, the list after an undo; **C5** "Changed since it was
  checked" with the line as checked and as now, "Look again" → "Mark checked again" at $0.00; **C10** the Account pill (only at
  a second account), Add an account, Move a book.
- Rules: every write control is **absent** (not disabled) for a member who can open Accounting but not move club money
  (B7); the tab reads the same for them. The Difference is shown, never edited. Autosave: a tick is saved as it is made;
  the draft keeps its ticks (Finish later). Use `components/shared/LoadingState`; a failed read is `LoadFailed` with a retry;
  a failed Stripe read shows the payouts-unavailable state from R2a, never a silent gap.
- Words: customer-visible wording follows plan §5 drafts; **record every string you write** under plan §5 as built.
  The `/marketing` pass is R3, not R2. Spell "cheque", "chequing", "installment" as the product does (`check:spelling`);
  the clock is `formatTime()`.
- Tests: component-level guards (tap floor and `aria-label` on symbol-only actions, tokens only, no hand-typed Loading).

**Done:** the tab renders every drawn desk state on the dev club (`uat-rep-club`) with real data; `check:layout --changed`
at 1440 clean; `verify:changed` + `typecheck` clean (known non-R1 failures: see the R1 record, report don't fix).

---

## Chunk R2d: the phone, and R2's close

- Phone 390 for C1–C5 and C10: the **band pinned and a dock** for the primary action (Ask 5), one-hand ticking, 44px
  targets, symbol-only secondary actions with an `aria-label`, windows as sheets. Tables get `data-label` or the Payouts
  list's `phoneList` shape; follow the drawings.
- `npm run check:layout -- --changed` at 361 and 1440 (add the Bank screen to `scripts/layout-screens.mjs` if screens are
  registered there; ask the script with `--list`).
- A short **owner check list** (not the R7 walk): open an account, tick a statement to $0.00 including a payout, add the
  fee, mark checked, undo, move a book. In the closing message, in product-owner voice, say what to try and where.
- Record R2 complete in the plan, TODO and memory (positively: commit hashes and dates); update the PM brief's status.
- **Owed before R2 is promoted:** migs 436 + 437 (and R2b's migration) applied to prod; the club-pays measurement recorded;
  Stage 13 re-checks the Accounting tab row once the Bank tab sits in it (plan B8).

---

## Every chunk

- Migration first where there is one; dictionary + `npm run refresh:snapshots` in the same unit of work. Commit snapshots only
  if every change belongs to this chunk's tables; otherwise leave them out and say so.
- `/simplify` then `/review` offered before the owner is asked to commit. `/docs` and `/marketing` are **R3**, not here.
- Resource-aware checks: `npm run lint:focused`, `npm run typecheck` (with a larger heap), `npm run verify:changed`. The
  known non-R1 failures (7 other unit tests, `check-root-files`, the eslint react-hooks plugin error in `verify:changed`,
  `check-index-coverage` on other tables, `check-schema-parity`) are reported, not fixed; `check-schema-parity`'s baseline
  is watched automation and is not edited.
- Close in product-owner voice: what now exists, what the owner can try, what is owed.
- Disagree out loud, before the work, if a ruling can't be built as written.
