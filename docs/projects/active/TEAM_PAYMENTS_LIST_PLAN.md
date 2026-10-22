# Team Payments List — Plan

**Status:** BUILT on dev 2026-10-21 (uncommitted); the four owner calls (§9) were ruled **as recommended** the same day. Mockup
`TEAM_PAYMENTS_LIST_MOCKUP.html`, Artifact https://claude.ai/artifact/2gLQJhYEQgQ4e1doqFJU2T, run through `/design`. See the build
record at the foot. Owed: owner browser walk, `/review`, `/docs`, `/demos`, an Owner QA Ledger §, the prod apply (see `MANUAL_PROD_STEPS.json`). PM brief: `TEAM_PAYMENTS_LIST_PM_BRIEF.md`.
**Origin:** owner, 2026-10-21, from the Teams window on the UAT Rep Club Invitational: typing `109` into *Deposit paid* made three ledger lines
(`$10`, `$90`, `$9`), all dated that day, and asked for "a deposit/fee with a date each" that lines up to the ledger. Then ruled: **the list on every
plan**, and **type each payment's own amount, not a running total**.
**Plan of record for the one it completes:** Club Tier Stage 7a (`CLUB_TIER_STAGE7A_BUILD_PROMPT.md`, "a line per payment, written when paid,
voided with who and when on an undo"). This does not reverse 7a; it moves the write from *a diff of two typed figures* to *an explicit payment*.

## 1. What is wrong today (verified in code 2026-10-21)

1. **Autosave posts to the book.** The Teams window autosaves the two typed figures (`TeamRecord.tsx` → `/api/admin/teams`). An AFTER trigger on
   `teams` (`club_tournament_fee_reconcile`, mig 342) posts one ledger line for every increase of `greatest(total_paid, deposit_paid)`. Typing
   `1`, `10`, `100`, `109` and pausing three times is three receipts. (The edit-autosaves rule of 2026-09-24 is right for name and email; a money
   figure that posts to the book as a side effect is the same class as "a change that tells families", which is held until ✓.)
2. **The date is never the payment's date.** The trigger stamps today in Toronto. Only the multi-team "Record one payment" takes a day.
3. **The two figures are one running total, not two payments.** The trigger and the shared-payment RPC read `greatest(total, deposit)`; the
   dashboard, check-in, attention engine, coach status model and recap read them as *separate* quantities. Verified: the dashboard's "collected"
   adds `total_paid` only (`tournament-dashboard/route.ts:592`), so a deposit-only team is **$0 collected on the dashboard and $150 in the ledger**.
4. **`fee_book_baseline` is a standing hazard.** It is `0` by default and was backfilled once (mig 342). A team marked paid on a plan with no
   Accounting keeps baseline 0; when that club later gains Accounting, the next write to the team posts the **whole** paid figure as a new receipt.
5. **No payment date reaches the coach.** `payment_collected_at` is set only by check-in and the shared-payment RPC; Teams-page Mark paid and bulk
   never set it, so the coach's "Paid · date" is often blank.

## 2. The design (what the owner sees; drawn in the mockup)

The Payment block in the Team window becomes:

- **Summary line** (today's `line`: `Owes $200 · paid $100 of $300`, `Paid in full · $300`, or `$50 over the fee`).
- **Mark paid · $X** stays, one tap: records one payment for what is owed, dated today.
- **Received**: one row per payment: date, label (Deposit / Balance / Entry fee / Payment), method if given, amount, an *In ledger* pill on an
  Accounting plan, a pencil. The pencil opens that row to change amount, date, how it arrived, or **Remove payment**.
- **Still due**: derived from the fee schedule and what is received: `Deposit $50 · due Oct 10 [Record]`, `Balance $200 · due Nov 1 [Record]`.
  Pressing Record opens the form **already filled with that amount and today's date**; the label comes from the row pressed. A part payment
  leaves the remainder due (the label never decides what is owed; the **sum** does).
- **+ Record a different amount** for installments and odd amounts.
- **Record asks.** A payment is a created record: nothing is saved or posted until Record is pressed (create asks, edit autosaves). Paid on is any
  date up to today; the ledger line carries it.
- **The two typed boxes are gone**, in read and in edit.
- **No deposit configured:** one *Entry fee* row instead of Deposit + Balance. Same block.
- **Plans that can only read payments** (no `payment_tracking`) see the list and no Record/pencil, as they see the figures today (R2).
- **No Accounting:** the list is identical; no pill, no ledger line, the hint says it is kept on the team only.
- **Own team** (a club's own linked team): still "No fee", no payments (the existing guard).

## 3. Data model

New table `tournament_team_payments` (migration: next free number, 345 at time of writing; check the ledger's last § and the migrations folder first):

| column | notes |
|---|---|
| `id`, `team_id` (FK `teams` ON DELETE CASCADE), `tournament_id`, `org_id` | |
| `amount numeric(12,2) CHECK (> 0)` | |
| `paid_on date` | nullable **only** for the backfilled "Earlier payment" |
| `label text` | Deposit / Balance / Entry fee / Payment / Earlier payment / Imported payment |
| `method text` | same list as `accounting_entries.payment_method` (etransfer, cash, cheque, card, other); nullable |
| `entry_id uuid NULL` → `accounting_entries` | the ledger line; **several rows may share one** (a transfer for several teams) |
| `status` (`posted`/`removed`), `removed_at`, `removed_by`, `created_by`, `created_at` | audit, never a hard delete |

**Derived cache (this is what keeps the blast radius small).** `teams.total_paid` = sum of posted payments; `teams.deposit_paid` =
`least(sum, the team's deposit fee)` (0 with no deposit); `teams.payment_status` flips to `paid` when the sum reaches the fee and back to
`pending` when it falls under, exactly the rules Mark paid / unmark follow today; `payment_collected_at` = the date of the payment that completed
the fee. A trigger on the payments table keeps them current **inside the same transaction**. Every reader in the census (dashboard, check-in,
attention engine, coach status model, recap, reminders, exports, needs-attention) keeps reading the same two columns and **needs no change**.
This also makes the dashboard and the ledger agree.

**Ledger.** One security-definer function records a payment: inserts the row, posts one `club_fee_post` line dated `paid_on` (Accounting plans
only, never retroactively when Accounting is added later, matching 7a's "existing payments are not backfilled"), updates the cache. Remove =
`club_fee_void`; change amount/date = void + post a corrected line (both stay in the book). The route checks the closed fiscal year for
`paid_on` first (`refuseIfClosed`, as `setLeagueFeePaid` does) and answers with a sentence. A transfer for several teams = several payment rows
sharing one entry, as `club_tournament_shared_payment` does today with receipts and allocations.

**Retired:** triggers `teams_club_fee_before` / `teams_club_fee_reconcile`, `fee_book_baseline` (stop using; drop the column in a later release,
**DROP COLUMN last** per the release history), and `tournament_fee_receipts` / `_allocations` once the backfill is verified (the shared-payment
RPC writes payment rows instead). `fee_changed_by` stays as an audit stamp on the team.

## 4. Writers that must all move (they cannot coexist with the typed figures)

From the census (`teams` is written in ~9 places):

| Writer | After |
|---|---|
| Teams window typed boxes (`TeamRecord.tsx`) + allowlist keys `depositPaid`/`totalPaid` (`lib/team-update-allowlist.ts`) | removed; the window calls the new payment routes |
| Teams window Mark paid / Mark unpaid (`teams/route.ts` ~L531–577, `lib/mark-paid.ts`) | Mark paid = record one payment for what is owed, today; unmark = remove the payments that completed it (who and when kept) |
| Bulk Paid in full / Deposit paid (`bulk/route.ts` ~L298–323) | one payment per team: owed amount (Paid in full) or the deposit shortfall (Deposit paid); own team still skipped |
| Check-in `mark_paid` / `unmark_paid` (`check-in/route.ts` ~L232–279) | same; `unmark` removes the payment it made (replaces the client-supplied prior figures and their `Math.min` guard) |
| Record one payment, several teams (`shared-payment` route + RPC 342) | N payment rows sharing one entry |
| CSV/Excel import (`lib/import/tournament-teams-commit.ts`) | higher figure = one *Imported payment* for the difference (owner call 3); lower = skipped with a preview line |
| Created already paid: Add team, own team, `lib/host-own-team.ts`, public register (always pending), dev seed | status-only creates stay status-only (no fee = no payment rows); a create with an amount makes a payment |
| Stripe/online payment (Stage 12c, future) | will write the same payment; no rework |

Quiet paths stay quiet: **the email, bell and notice fire only when a payment completes the fee** (as `payment_status` going to `paid` does
today); check-in and bulk `mark_deposit_paid` send nothing, as 7a note 5 requires. A part payment sends nothing.

## 5. Backfill (dev first, then prod at promote)

For every team with `greatest(total_paid, deposit_paid) > 0`: one payment per posted receipt allocation (amount, date = the ledger line's date,
`entry_id` linked) plus **one "Earlier payment"** for the remainder (`fee_book_baseline` plus any figure with no receipt), `paid_on` null, no ledger
link, nothing posted. Verify with a query: **for every team, sum of payments = greatest(total_paid, deposit_paid)** before and after, and the cache
columns read back unchanged. A deposit-only team (deposit 150, total 0) becomes one $150 payment; the dashboard's collected for it moves from $0
to $150 (a correction; say so in the release notes). Snapshot first; per-org before/after counts in the PR notes.

## 6. Build order (ships as ONE release; the stages are build order, not release units)

1. **Data**: table, record/remove/change functions, derivation trigger, backfill, `scripts/club-stage7a-atomicity.sql` rewritten for it; the
   failing-first tests below.
2. **The window**: Payment block per the approved drawing, Mark paid, the closed-year sentence, the plan-gated read-only list.
3. **Other writers**: check-in, bulk, shared payment, import (+ its preview line), created-already-paid.
4. **Around it**: the coach's "Paid · date", exports (add *Last payment date*; keep the two columns), demo seeds, help articles, data dictionary,
   QA walk.

## 7. Tests (each fails on today's code first)

One payment = one ledger line, however it is typed · the ledger date is the date chosen · a part payment leaves the remainder due and the summary
says Owes · remove voids with who/when and never revives · change amount voids and posts a corrected line · a transfer for several teams is one line
· derived figures: sum, deposit = least(sum, deposit), status flips both ways · a payment on a no-Accounting org posts nothing and **adding Accounting
later posts nothing retroactively** · a closed fiscal year refuses with a sentence · a future date is refused · own team refused · two simultaneous
Records on one team neither lose nor double · the emails fire only on completion · backfill preserves sum and cache. Update:
`team-update-allowlist-guard`, `club-stage7a-link-refusal`, `tournament-payments-tracked`, `needs-attention-clears-itself`,
`tournament-team-import`, `teams-model`.

## 8. What does not change

Fee schedule, due dates, the Payment filter (Any/Owes/Paid), reminders and their wording, Registration health, the coach's Owed panel, public
pages (payment is never public), plan gating, and every reader of `deposit_paid` / `total_paid` / `payment_status`.

## 9. Owner calls (drawn at the foot of the mockup, each with a recommendation)

1. Payments already on teams: **one "Earlier payment" per team, undated** (alt: ask organizers to date them).
2. Dates: **any date up to today; a closed fiscal year is refused with a sentence** (alt: post into the closed year, breaks the lock).
3. Import: **a higher figure adds an "Imported payment" dated the import day; a lower one is skipped** (alt: import may lower).

4. **Changing a recorded payment asks first** (a Save change button), while the rest of the window autosaves. A change on an Accounting plan voids a
   line and posts a new one, so autosaving it would bring the three-line problem back. This is a deliberate exception to the edit-autosaves rule
   (the same reasoning as the 2026-10-09 "a change that tells families is held"); the Record form itself already asks (create asks).

**Design check (2026-10-21, `/design` over the round-1 drawing)** changed: Received / Still due to sentence-case headings; the In ledger pill
beside the payment's name at every width; Remove this payment as its own line at the end of the change form (trash + red words), asking first;
plain asterisks on Amount and Paid on; 36 px fields at a desk and 44 px on a phone. Left alone: the Record form opens **in place** (no second window
over a window), "Owes" stays amber as the line reads today, dates print "Oct 9" with no year.

**Not drawn, to decide before build:** a *refund* (money back to a team). It is not a negative payment here; for now Remove payment is the only
way down, and a real refund is recorded in the ledger by hand. Recommend a later, separate ask.

## 10. Records and checks owed with the build

`docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots` (new table, retired columns); help articles (`lib/help-content/tournaments.tsx`
~L764, 863–868, 902–909, 1569; `accounting.tsx` ~L64, 269; `coaches.tsx` ~L124–129) via `/docs`; the demo seeds
(`lib/demo-moments.ts`, `scripts/seed-demo-tournament.mjs`, `scripts/seed-fp5-cluster5.mjs`) must create payments with dates, and the demo
tour words are computed from the seed; `/review` before commit; an Owner QA Ledger § walk (check the last § first); TODO line. **No migration
applies to prod outside the release flow**; read the prod release history before the promote.

## 11. Build record (2026-10-21)

**Built:** migration 345 (table, eight functions, backfill, the two old triggers dropped; applied to **dev only**); the payments route and the
Teams record's list; Mark paid, bulk, check-in (its undo removes exactly the payment its own press recorded), Record one payment, add-team-paid,
the spreadsheet import, the export's *Last payment date*, demo and fixture seeds; the data dictionary; tests (`team-payments`,
`team-payments-guard`, the rewritten allowlist, link-refusal, notices and census tests; the database test `scripts/club-stage7a-atomicity.sql`
rewritten for payments and **run on dev: passed**). The routes were probed end to end on the dev server as a signed-in organizer (record,
change, Mark paid, refusals, remove, restore).

**Departures from the plan, each deliberate:**
1. The paid figures are kept current by the **payment functions themselves**, inside the same transaction, not by a trigger on the payments
   table. A build guard (`team-payments-guard.test.ts`) fails if app code writes the two columns, which is the safety a trigger would have given.
2. Taking a team with payments back to **unpaid is refused** on the Teams route ("Remove the team's payments"); the payments are what make it paid.
3. The import: a sheet "paid" on a not-yet-paid team records the rest of the fee even when the sheet's stated money is not above what is
   recorded (the template round-trips Total Paid, so a flipped status would otherwise be ignored); a new team is always inserted pending and the
   payment is applied after; a refused payment is a per-row line in the result and the rest of the import stands.
4. Check-in's undo has no amounts from the browser any more; with no payment id (a no-fee team) it restores the status only.

**Known edge:** a legacy team marked paid with a fee but **no payment rows** (status-only, from before) flips to pending the first time a
partial payment is recorded on it, because the status now follows the sum. Backfill leaves the status alone, so nothing changes until then.

**Not done / owed:** help articles (`/docs`: the six places in §10), the demo tour check (`/demos`), the coach "Owed" panel needs no change but
deserves a walk, refunds (still not built), the Owner QA Ledger §.
