# Coach Dues Payment Record — Plan

**Status: ALL THREE PASSES + /simplify + /review BUILT AND RUN 2026-08-13 · ON PROD 2026-08-14 (Amplify job 256, mig 232 applied to prod) (one day:
Phase A inventory → Phase B mockups → six owner rulings → Passes 1/2/3 → reminders-row follow-up
→ /simplify (8 fixes) → /review high-risk (5 lenses; 2 Critical + 1 High + 5 Medium confirmed
AND FIXED)) — mig 232 dev-only · owner QA = ledger §13 · awaiting commit approval · refund
credit provenance deliberately descoped (Pass 3 log).**
Kickoff: `COACH_DUES_PAYMENT_RECORD_BUILD_PROMPT.md` (same folder). PM brief:
`COACH_DUES_PAYMENT_RECORD_PM_BRIEF.md`. Mockup: `COACH_DUES_PAYMENT_RECORD_MOCKUP.html` /
https://claude.ai/code/artifact/ccc923b8-e6f3-4a1e-b972-95fc2b809185

**The proposition:** an installment is a plan (what is due, when); a payment is a fact (what
arrived, when, how much). Today the installment row is both the bill and the receipt (`paid_at`
stamp, no amount, no partial state), which is the root of everything in the inventory below.

---

## Phase A — inventory (verified against live code 2026-08-13)

Scenario column: dues $300/quarter; the family sends $100/month. Variant (a): coach records nothing
(there is nowhere to put it). Variant (b): coach logs the $100s as dues credits — the only field
that accepts a partial dollar figure.

### Canonical definitions — `lib/dues-status.ts`

- `outstandingForSchedule` (:82-89): schedule total − Σ(fully-paid installment amounts). Credits
  excluded by design.
- `isNeverPaidPlayer` (:41-46): has dues AND no installment has `paidAt`. **Ignores credits.**
- `duesStatusLabel` (:58-69): Not set / In credit / Fully paid / Partial / Unpaid off
  `rollingBalance`/`paidAmount`/`totalCredits`.
- `isInstallmentOverdue` (:26-29): unpaid + due date past, org timezone.

### The write paths

- **Mark-paid** `app/api/coaches/[orgSlug]/teams/[teamId]/dues/[scheduleId]/installments/[installId]/route.ts`
  — PATCH, request body **ignored** (`_req`, :38). Amount always `installment.amount` (:65). Refuses
  404 unknown, **409 already-paid** (:53-55); no un-mark path. Posts income entry (:57-70):
  `entryDate: tournamentToday()` (click day, not arrival day), description
  `Player dues installment #N` (no player name), category `'Player Dues'`, then
  `markRepPlayerDuesInstallmentPaid(installId, entry.id)` (`lib/db.ts:8760-8772`) sets `paid_at` +
  `accounting_entry_id`. Back-link is **one-directional** (installment → entry; the entry knows
  nothing).
- **Bulk generate** `app/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/generate-installments/route.ts`
  — `paidPlayerIds` guard (:85-98) is built **from `paid_at` only**; on `replace:true` a
  credits-only payer (variant b) is NOT protected — schedule deleted+recreated (:159, :171-219)
  while their credits (separate table) survive against the new total.
- **Credits CRUD** `.../players/[playerId]/dues-credits/route.ts` — arbitrary amount/date/type
  (`contribution|fundraiser|overpayment|other`), validates only amount>0. Posts nothing to ledger.

### The surface table

| # | Surface (source) | Figure quoted | $100-a-month player today |
|---|---|---|---|
| 1 | Player Dues roster table + drawer (`accounting/dues/panel.tsx:663-711, 939-970`; data `dues/route.ts:70-108`) | Total / Credits / Paid / Balance(rolling) / Status. **No Outstanding column.** | (a) Paid $0, Balance full, Unpaid. (b) Paid $0, Credits $300, Balance $0, **Status "Fully paid" with Paid $0** |
| 2 | Dues rail "Outstanding" (`panel.tsx:484`) | **Mislabeled** — sums positive `rollingBalance`, not canonical outstanding. Canonical `p.outstanding` fetched (panel.tsx:32) and **never rendered anywhere in the file** | (b) rail drops with credits while digest/Ask "outstanding" doesn't — same word, two numbers, drift = workaround amount |
| 3 | Rail overdue count (`panel.tsx:485-495`) + per-row installment badges (:1006-1057) | `isInstallmentOverdue` | Overdue ⚠ once due date passes regardless of credits/partial cash |
| 4 | "Who to chase" banner + Remind-all (`panel.tsx:470, 607-656`; `remind-unpaid/route.ts`) | `isNeverPaidPlayer`; email quotes full schedule `outstanding` (`lib/db.ts:9197-9253`) | Counted + emailed "Our records show no dues payments yet… $300.00 outstanding" in both variants |
| 5 | Team Overview unpaid badge + dues tile (`coaches/teams/[teamId]/page.tsx:406-419, 1214`) | `isNeverPaidPlayer` count + Σ outstanding | Counted; tile carries their full amount |
| 6 | 3 proximity reminder paths (`dues/send-reminders/route.ts:98`; sweep `lib/dues-reminders.ts:100,186-226`; candidates `lib/db.ts:9093-9178`) | Raw installment `amount` where `paid_at` null, due-date window 3/9/32d, 7-day cooldown. Org-admin byte-identical copy: `admin/rep-teams/dues/send-automated-reminders/route.ts` | Family emailed the **full $300** as coming due, both variants |
| 7 | Weekly insights digest (`lib/insights-digest.ts:166-175`; `lib/insight-findings.ts:186-217, 407-426`) | `outstandingForSchedule` + `isNeverPaidPlayer` (shared helpers ✓) | In both the "N unpaid ($X)" proximity line and "haven't paid anything yet — $X" line |
| 8 | Ask the Front Office (`ask/route.ts:190-233`; `lib/coach-family-dues.ts:116-192`; `lib/coach-ask-questions.ts:426,452`) | Same shared helpers | Family named as owing $300, "nothing recorded" |
| 9 | Budget vs. Actual dues card (`budget-vs-actual/route.ts:217-248`, panel :583-617) | **Inline** expected/collected/outstanding (not helpers) | $0 collected; collection-rate dragged down |
| 10 | Month grid cash-flow "Money in" (`budget-vs-actual/route.ts:457-466`; `lib/coach-budget-months.ts:481-499`) | Scheduled by `due_date`, actual by `paid_at` | Actual = **$0 every month**; Scheduled shows $300 unmet |
| 11 | Money hub Collections tile (`money-summary/route.ts:94-117`; `OverviewDashboard.tsx:47-94`) | **Inline duplicates** of outstanding AND never-paid (":111 Mirror lib/dues-status") | $0 collected; "N overdue" chip for a current family; counted never-paid |
| 12 | Upcoming payables "Dues Coming Due" (`upcoming-payables/route.ts:76-119`) | `paid_at is null` + `due_date` window; credits never enter query | Next $300 listed as owed even at rolling balance $0 |
| 13 | Player dues export (`lib/coach-money-exports.ts:77-116`) | Same row as table + `duesStatusLabel` | (b) **"Paid $0.00 · Balance $0.00 · Status Fully paid"** in one row |
| 14 | Season Refund Calculator (`season-surplus/route.ts:31-104`; panel :756-905) | **Inline** re-copy of outstanding/rolling (:89-90 — 4th hand-copy of the pattern dues-status.ts consolidated); refund = credits + even share, credit types not distinguished | (b) family scheduled to be **refunded $300** the ledger never received — double-payout, checked only by the coach's hand-typed surplus figure |
| 15 | Team ledger (`accounting_entries`; rendered only in org-admin ledger detail `admin/accounting/ledger/[ledgerId]/page.tsx:465-533`) | Income entries only from mark-paid; dated click-day; no player name, no reverse link | **Zero rows ever** — team income short $300 with no trace, both variants |
| 16 | Family-facing | **Nothing, structurally** (`lib/family-guardian-view.ts:22-24,113-121`, `lib/family-view.ts:18-21`, `lib/rep-player-season-recap.ts:29-33` — dues excluded from the shapes) | The reminder emails (#4, #6) are the family's ONLY dues surface — and they're the wrong ones |

### Findings beyond the kickoff prompt's map

1. **"Outstanding" rail mislabel** (row 2) — fix belongs to this project regardless of model choice.
2. **Bulk-regenerate hole for credits-only payers** (write paths above).
3. **Refund double-payout** (row 14) — the workaround's sharpest consequence.
4. **Two more inline re-implementations** of shared definitions (rows 9, 11, 14) beyond the three
   the dues-status.ts docstring says it consolidated — consolidation is part of Phase C.
5. **Overdue ignores credits** (rows 3, 11).
6. Dues income entries carry no `source_module` provenance and no player name (row 15).
7. Doc-drift: the kickoff prompt points at `memory/design_decisions.md` for the 2026-08-12 funding
   ruling; it actually lives in `docs/projects/archive/COACH_BUDGET_TOTALS_FUNDING_PLAN.md:38-40,92-96`
   (the Chunk-H "money in is player dues ONLY" rule is `memory/design_decisions.md:1723`, dated 07-30).

### Data-model notes that bind the design (from `docs/agents/db/DATA_DICTIONARY.md`)

- `rep_player_dues_installments.paid_at` is the paid source of truth, NOT `accounting_entry_id`
  (dict :3342 gotcha 1). Three reminder columns, window-specific + 7-day cooldown (gotcha 2).
- `rep_player_dues_schedules.budget_line_id` is dead (never written) — the budget-line delete guard
  that queries it always finds zero (dict :3314 gotcha 2). Don't build on it.
- `total_amount` reconciled to installments only on the manual POST path; nothing keeps them in
  sync after (gotcha 3).
- `rep_dues_credits`: circular FK with `rep_fundraiser_entries` (durable direction:
  `fundraiser_entry_id`); balance clamping differs by reader (dues GET/season-surplus don't clamp,
  fundraiser GET does) — normalize while we're here (dict :3387 gotchas 1, 3).
- `accounting_entries`: soft-void only, category is free text, no cross-module provenance for dues.

---

## Phase B — the model (as drawn)

New table `rep_dues_payments` (per player per program year): amount, **date received** (org-tz
date, coach-typed, default today), method (`etransfer|cash|cheque|other`), optional note,
`accounting_entry_id` (one income entry per payment, dated the received date), created_by.
Allocation to installments is **derived oldest-first at read time** (or maintained as a projection)
— never hand-allocated, so a schedule rewrite re-derives coverage with no data loss.

- Installment "paid" becomes a derived state: covered when Σ allocated ≥ amount. `paid_at` retired
  as an input (see Decision 2 for the migration of existing stamps).
- "Mark paid" survives as a one-tap shortcut = record payment for the installment's remaining
  amount, dated today.
- `isNeverPaidPlayer` → "no payments recorded" (and stops firing for anyone with a payment; whether
  credits also clear it is part of Decision 6's wording — mockup §5 proposes payments only).
- Reminders quote the unpaid remainder of the windowed installment + received-so-far line.
- Overpayment beyond the whole schedule → coach-confirmed `overpayment` credit (mockup §3).
- Bulk re-run: keep payments (they're independent rows), rewrite unpaid remainder across surviving
  dates (mockup §4); player paid beyond new total lands in the overpayment choice.

## Blocking decisions — ALL SIX RULED (owner, 2026-08-13)

1. ✅ **Payment record** (not part-paid-amount-on-installment). Two payments on one installment;
   reversibility; per-payment ledger lines.
2. ✅ **Migrate existing paid installments to one synthetic payment each** (full amount, dated
   `paid_at`, adopting the existing `accounting_entry_id`) — no dual read path. Both DBs (dev now,
   prod via the release migration).
3. ✅ **Ledger entry dated the arrival date** (coach-typed, default today). No backfill of old
   entries.
4. ✅ **Credits stay credits.**
5. ✅ **Overpayment beyond the schedule becomes an overpayment credit AUTOMATICALLY** — owner
   simplified away the recommended confirm prompt. The record sheet's strip states what will
   happen; the correction path is removing the payment (which removes the credit it created).
6. ✅ **Reminders chase the remaining balance** of the windowed installment, with received-so-far
   acknowledgement.

## Phase C — build passes (each shippable; sliced layout sweep between)

1. **Pass 1 — the record + the write paths.** Migration (payments table; dict + `refresh:snapshots`
   same unit of work), record-payment sheet, mark-paid becomes shortcut, drawer Payments section +
   coverage chips, migration of existing stamps per Decision 2. Money panels stay mounted; the new
   sheet takes the caller's `tabActive`.
2. **Pass 2 — every reader tells the truth.** Consolidate the inline copies (rows 9/11/14) into
   `lib/dues-status.ts` (+ a shared rolling-balance helper), fix the rail "Outstanding" mislabel
   (row 2), never-paid + overdue predicates read payments, tiles/BvA/month-grid/upcoming-payables/
   digest/Ask/export on the new figures. Kind-guard-style test pinning one definition.
3. **Pass 3 — the edges.** Reminder copy (all three paths + remind-unpaid), bulk re-run
   keep-paid-rewrite-rest (coordinate the paid-player rule with the basis-picker project — the ONE
   shared edge), refund calculator reads payments and separates credit provenance, overpayment flow.
4. Same-unit follow-through: `/docs` (premium-money guide), demo check (riverdale-ridge seeds/tour —
   should the demo show a part-paid player?), `/simplify` → `/review`, typecheck + tests +
   `verify:changed` (schema-parity failure pre-existing while prod lags migs 230/231),
   `check:layout --only=coach-accounting,coach-dues,coach-budget-vs-actual` (read output, not exit
   code), QA ledger §12 Group 1C entries.

## Pass 1 build log (2026-08-13)

**Delivered** (mig `232_rep_dues_payments.sql`, applied dev; backfill verified 159 stamps → 159
payments, sums equal to the cent):
- `rep_dues_payments` + `rep_dues_credits.payment_id` (CASCADE); RLS-enabled-no-policies.
- `lib/dues-payments.ts` — pure allocation (integer cents), **stamped-first coverage order** so the
  backfill was a zero-visible-change event; pinned by
  `tests/unit/dues-payments-allocation.test.ts` (13 tests, incl. the out-of-order-stamp case).
- `paid_at` is now a projection (`syncDuesPaidProjection`, db.ts): set to **noon UTC** of the
  completing payment's received day (midnight would read as the previous Toronto evening in
  month-bucket readers), cleared when a removed payment un-covers; `accounting_entry_id` never
  touched in either direction.
- `recordRepDuesPayment` (db.ts) — the ONE write path: ledger entry FIRST (dated received day,
  description `Player dues — {name}`, method as payment_method), then the payment row, then the
  auto-overpayment credit (`description 'Overpayment'`, `payment_id` set), then the projection.
  `removeRepDuesPayment` voids the entry, deletes (credit cascades), re-projects.
- Routes: POST/DELETE `players/[playerId]/dues-payments[/paymentId]`; mark-paid PATCH reimplemented
  as the shortcut (records the installment's uncovered remainder, dated today, method `other`).
  **⚠ semantics note:** allocation stays oldest-first even from the shortcut — "mark #3 paid while
  #1 is short" books the dollars against #1's remainder first; coverage after reload is the truth.
- Dues GET: `payments` + `coverage` in the payload; `paidAmount` = payments capped at schedule
  total; `outstandingForSchedule` **signature changed** to (schedule, paidAmount) — compiler drove
  the digest + Ask route onto payment facts in the same pass. `isNeverPaidPlayer` prefers
  `paidAmount` when present (installment fallback kept for old callers/tests).
- `getUnpaidDuesReminderTargets` (remind-unpaid SQL) also excludes players with any payment — else
  the banner count and "Remind all" recipients would disagree.
- Panel UI: Record payment form (amount/date/method/note + inline landing/overpayment preview),
  Payments list with per-row remove, part-paid amber "$X of $Y" chips, "Mark rest paid" label on
  part-covered rows, `auto` badge (no delete) on payment-linked credits.
- **Disclosed behaviour fix:** the drawer's Mark Paid button previously rendered for read-only
  money assistants (server refused; button shouldn't exist) — now gated on `moneyCanWrite`.

**Gates:** typecheck ✓ · 1702/1702 unit tests ✓ · `verify:changed` green except **schema parity**
(prod behind dev on migs 230/231/**232** — pre-existing condition, extended knowingly; release
applies all three to prod first) · sliced `check:layout` (accounting/dues/BvA × 4 widths) ran to
completion, **no new findings** (2 stale baseline entries flagged are unrelated BvA `Recategorize`
tap-floor rows; deliberately not pruned — the empty-fixture lesson) · dev server restarted fresh.

**Known interim states (by design, closed by Pass 2/3):** ~~Overview dues tile, money-summary,
BvA/month-grid, upcoming payables still read stamps/inline copies; proximity reminder emails still
quote the full installment amount; the rail "Outstanding" mislabel stands.~~ **Pass 2 closed all
of these except the reminder email copy (Pass 3).**

## Pass 2 build log (2026-08-13) — every reader tells the truth

- **money-summary** (Collections tile): collected = payments capped per player; **overdue counts
  the missing remainder of a late installment, not its face value** (a family $200 into a late
  $300 installment is $100 overdue); the inline never-paid MIRROR replaced with the real
  `isNeverPaidPlayer` — **the mirror had drifted**: it subtracted credits inside "has dues" where
  the shared predicate deliberately doesn't.
- **budget-vs-actual**: dues-collection card collected = payments capped per player; **month-grid
  cash-flow ACTUAL now buckets payments by `received_date` month** (was: full installment amounts
  in the month the stamp was clicked; part-payments appeared in no month at all).
- **upcoming-payables**: coverage derived over the WHOLE schedule then window-filtered; an open
  installment quotes its remainder; fully-covered-by-remainder rows drop out. ⚠ A part-paid row
  deliberately leaves the "Installment #N — X players" merge group via its smaller amount (comment
  updated in place — the grouping key warning survives).
- **season-surplus**: the 4th hand-copy replaced with `outstandingForSchedule` + `duesPaidAmount`;
  paid = payments (was stamps). Credit PROVENANCE in refunds (workaround-vs-real credits) stays
  Pass 3.
- **budget route + `getRepPlayerDuesSummary`** (roster player profile): stamp-sums → payments
  capped. Both found by the new guard, not the inventory.
- **Dues rail**: footer cell renamed **"Outstanding" → "Balance owing"** (it sums positive rolling
  balances and sits under the Balance column; "Outstanding" is the credits-excluded figure the
  digest quotes — same word, two numbers, inventory row 2).
- **`tests/unit/dues-definition-guard.test.ts`**: every dues-quoting surface must import the
  shared definitions; stamp-sum "paid" derivations banned outside them (org-ALLOCATION surfaces
  explicitly exempt — different domain, no payment record). **Proven by failing**: its first run
  caught `budget/route.ts` and `getRepPlayerDuesSummary` — two real stamp-sum readers the Phase A
  inventory had missed — plus the legitimate allocation panel it now exempts by name.

**Gates:** typecheck ✓ · 1704/1704 tests ✓ · sliced `check:layout` (3 screens × 4 widths) no new
findings ✓ · dev server restarted fresh. Schema-parity failure unchanged (migs 230/231/232
dev-only — pre-existing condition, resolves at release).

## Pass 3 build log (2026-08-13) — the edges

- **Reminders chase the remainder (ruling 6).** `getDueReminderCandidates` allocates payments over
  each player's whole schedule and each candidate carries `remainingAmount`; zero-remainder
  installments are never candidates. All THREE templates (coach send-now route, org-admin route,
  `lib/dues-reminders.ts` sweep — kept byte-identical) quote the remainder, append "thank you,
  $X of $Y has been received" on part-paid rows, and the closing line becomes "If you've already
  sent a payment, it may not be recorded yet — just let your coach know." Sweep previews total
  remainders, not face values.
- **Bulk re-run keeps money, rewrites the plan.** generate-installments no longer skips paying
  players: schedules rewrite for everyone, payments re-allocate, `syncDuesPaidProjection` re-stamps
  coverage, and payments beyond a player's NEW total become an automatic overpayment credit
  (`'Overpayment (dues changed)'`, `payment_id` NULL so it is manually deletable; the stranded
  amount nets out record-time payment-linked credits). Response: `playersSkipped` pinned to 0 for
  old clients + new `playersWithPaymentsKept` / `overpaymentCreditsCreated`; modal copy updated at
  all three touchpoints (advisory line, confirm step, success state).
- **Digest/dashboard proximity line quotes remainders.** `/dues` payload installments now carry
  `remainingAmount`; `summarizeDuesForFindings` prefers it; the digest computes its own (synthetic
  single-payment allocation — dates decide nothing about coverage totals).
- **Demo/fixture worlds keep their story true (the CLAUDE.md demo-drift rule).** The coach-demo
  seeder wipes `rep_dues_payments` and writes one e-transfer payment per stamped installment; the
  nightly re-anchor shifts `received_date` with everything else (a stamp is only a projection —
  unshifted payments would strand the demo's cash a re-anchor behind its books). Same
  stamp-backing added to `seed-qa-day-fixtures.mjs` and `seed-uat-coach-fixture.mjs`.
- **`/docs` run:** premium-money gains a "Recording the money families send" passage + a popular
  FAQ ("A family pays in different amounts than the installments…"), the redo-dues FAQ rewritten
  to payments-kept, the who-hasn't-paid FAQ notes part-payers never appear, keywords/searchText
  updated (stale "players were skipped" search phrases replaced).
- **DESCOPED, deliberately — refund credit provenance.** The double-payout hazard was workaround
  credits standing in for unbookable cash; payments close it at the source and Pass 2 put the
  refund calculator's balances on payment facts. What remains — whether fundraiser rebates belong
  in the refund's credit portion at all — is the standing mig-029 product design, an owner product
  call, not a defect. Raise via `/plan` if wanted; nothing here blocks it.

**Gates:** typecheck ✓ · 1705/1705 tests ✓ (one transient failure was a CONCURRENT session's
in-flight import, fixed by them mid-run — not this project) · sliced `check:layout` no new
findings ✓ · `check:demos` ✓ · help-module lint ✓ · dev server restarted fresh (supervisor
restored). Schema parity: still the known dev-only 230/231/232 failure, resolves at release.

## Owner-directed follow-up (2026-08-13, same day)

The Automatic Dues Reminders card compacted to one row (~200px → ~56px: bell · title · short
status · **"See an example"** ghost button · toggle), and the example button opens a read-only
modal: when the waves fire (30/7 days, once per family per wave), what the send-now button and
the separate paid-nothing nudge each do, and a **rendered sample of the real email** — built by
the actual template. That forced the template into ONE shared module
(`lib/dues-reminder-email.ts`), consumed by the coach route, the org-admin route, the nightly
sweep AND the preview — the three byte-identical copies are gone, and the sample cannot drift
from the send. (Pure string module on purpose: the client imports it; nothing server-only may
ever be added to it.) The example button carries the 44px tap floor (its first render was 21px
and the sweep caught it — fixed, re-swept clean). Sample uses fictional names, one untouched row
+ one part-paid row so the thank-you line is visible.

## /simplify + /review log (2026-08-13)

**/simplify (4 lenses, 8 fixes applied):** `InstallmentCoverage.remaining` becomes THE remainder
(6 hand-copies deleted, one of which had already dropped its clamp); `paymentsTotalByPlayer` +
cents-safe sums (5 hand-copied reduces gone; BvA + season-surplus moved off raw queries onto the
shared fetch); panel overshoot preview imports `overpaymentExcess` (was a re-implementation);
`isNeverPaidPlayer.paidAmount` REQUIRED (installment-stamp fallback deleted — the Overview badge
was one untyped payload edit away from silently reverting; now a compile error); batched
projection writes + preloaded-rows variants (`syncDuesPaidProjection`/`recordRepDuesPayment`) —
the full-roster bulk replace drops from ~340 sequential round-trips to ~4 per player; dues GET
installments N+1 → one batched query; `strandedExcess` cent-safe helper; seeder `keys()` idiom.
Skipped with reasons: dropping payload `remainingAmount` (FALSE POSITIVE — the Insights dashboard
reads it), cap-inside-outstanding (convention documented instead), broader guard regex (source
duplication removed instead), digest's synthetic payment (equivalent + cheaper), cross-player
write parallelization (ordering is load-bearing).

**/review (high-risk, 5 lenses → 21 findings → 11 confirmed, all FIXED):**
- **Critical 1 — stale automatic credit when dues RISE.** Record-time overpayment credits were
  never clawed back when a later schedule change re-absorbed the excess → balance under-billed
  by the credit, uncorrectable (auto credits have no delete button). **Fix:**
  `reconcileOverpaymentCredits` (db.ts) — ONE symmetric mechanism: payment-linked credits always
  reconcile to `max(0, paymentsTotal − scheduleTotal)`; creates when dues drop below money
  received, shrinks/deletes (newest-first) when they rise past it. Manual/fundraiser credits
  never touched. Called from: record payment, remove payment, bulk re-run, per-player edit.
- **Critical 2 — per-player "Edit schedule" vanished overpaid money** (capped out of Paid, no
  credit, a REGRESSION vs the pre-232 negative-balance display) and **never re-projected
  coverage** onto the rewritten rows. **Fix:** dues POST now syncs projection + reconciles.
- **High — the Basic→Premium upgrade migration still stamped `paid_at` with no payment row**
  (third write path): family showed owing everything while BOTH reminder paths skipped them.
  **Fix:** `stampInstallmentPaidWithPayment` writes the stamp + its payment fact (received on the
  Basic ledger's org-local paid day) at both call sites; the guard test gained a WRITE-side rule
  banning direct `paid_at` updates outside four sanctioned files.
- **Medium — Mark Paid lost its idempotency under concurrency** (old flow's stamp check was
  removed): two sessions could both record the remainder. **Fix:** atomic claim
  (`paid_at IS NULL → stamp`, loser 409s), claim travels into the preloaded projection rows —
  which also makes the new dollars cover THE CLICKED installment (truer to the button) and
  clears the claim if they somehow don't — best-effort revert + NO_SCHEDULE→400 on failure.
- **Medium — record-time credit raced its own read** (double-click overshoot mis-credited):
  closed by the reconcile-to-true-state mechanism above.
- **Medium — mark-paid route trusted caller's scheduleId** (saved only by a downstream
  coincidence): explicit schedule→program-year ownership check added (404).
- **Medium — `voidEntry` swallowed its error** (a failed void let the delete erase the receipt
  while the income entry stayed posted): now throws.
- **Low — first-ever-payment ledger-creation race** crashed the loser on a null: re-select on
  unique-violation added to `getOrCreateRepTeamLedger`.
- **Medium-Low — Ask's family answer quoted face values** on part-paid installments (the one
  surface left off the remainder ruling): rows carry remainders; fully-covered rows drop out.
- **Hardening — the shared email template now HTML-escapes** names/team (people-entered text in
  a third party's inbox + the preview's innerHTML).
- **Refuted/false-positive (dropped):** money-summary "covered-but-unstamped counts 0" (correct
  behavior), MoneyNextThirtyDays group-total risk (amount is part of the key — impossible),
  digest synthetic-payment equivalence (proven), migration entry-less backfill branch
  (unreachable for app-written rows).

**Report-only residuals (owner-visible, deliberately not fixed here):**
1. **No transactions** → two narrow infra-failure windows remain in record-payment (entry posted
   but payment insert fails → orphaned income entry; payment inserted but credit write fails).
   Mitigation would need a Postgres function/RPC — noted as accepted risk at roster scale.
2. **Pre-existing, outside this diff:** the coach Overview's budget tile counts UNPAID expense
   face values as "spent" (contradicts the paid-only doctrine everywhere else) — owner call.
3. **Pre-existing:** season-surplus refunds can promise more than the hand-typed pool when
   credits exceed it; "On Hand" understates cash by auto-credited excess (intentional cap) —
   both fold into the descoped refund-provenance owner discussion.
4. **payment.note** is visible to money-view coaches without the roster-PII grant (mirrors other
   money free-text fields) — owner call whether notes join the PII contract.
5. QA/UAT fixture seeders' coarse idempotency guard can strand a fixture-only ghost stamp on a
   partially failed run (manual re-seed repairs).

**Post-fix gates:** typecheck ✓ · 1710/1710 tests ✓ (4 new: remainder-in-coverage, symmetric
stranded math incl. Critical 1's worked example, cents grouping, write-side stamp guard) ·
lint 0 errors · guard test's new rule verified against the tree.

## Follow-on rulings (owner, 2026-08-13 — decision sheet artifact `942aa951`) — BUILT same day

- **1A — Overview budget tile is PAID-ONLY** (`budget/route.ts` settled-legs semantics matching
  money-summary/BvA; "spent" finally means spent). Behavior change is owner-ruled.
- **2 — NOT built.** No warning strip: the owner is revamping the whole refund section. Built
  instead: **the season's-end review portal** — `QA Season End U15` (`qa-season-end-u15`) in the
  money-lab org (`seed-qa-day-fixtures.mjs money`): 10 players · dues $600 (3×$200, all past,
  all paid, payments behind every stamp) · one $50 overpayment credit (Umar) · Cookie Dough Drive
  closed, raised $0–$680/player at 25% back → fundraiser credits $0–$170 (total $625), entries
  and credits linked the authoritative FK direction · budget $7,000, paid spending $6,350.
  The owner reviews these numbers, then specifies the new refund model.
- **3A — payment-note example neutralized** ("paid at practice") — the old example taught coaches
  to write guardian names where money-view/no-PII assistants read them. Notes stay visible
  (consistent with all money free-text); the fence question is deferred with the provenance talk.
- **4A — the coach demo shows a part-paid family**: mid-season 12U roster index 3, FUTURE
  instalment #4 at $90 of $120 via three e-transfers (`MIDSEASON_DUES.partPaid`; seeder
  `partPaid` support; re-anchor shifts the split dates). ⚠ Deliberately the future instalment —
  on a past-due one the family reads as a third overdue household and breaks the "two families
  behind" story the tour narrates and `check-demo-coach` pins ($240 across exactly two; the
  first seed attempt failed exactly that check and was corrected). Tour step 4's narration gains
  the sentence; `check:demos` green; demo re-seeded on dev.

## Pass 4 build log (2026-08-14) — the ledger says where the money went, and the re-run stops flattening people

Owner-approved mockup (binding): `claude.ai/code/artifact/e73e9842-300d-484c-808e-f3c76bacf780`
(source `COACH_PLAYER_LEDGER_COLUMNS_MOCKUP.html`). Triggered by an owner screenshot sent about
row height, which also carried a live production defect (below).

**1 — Four money columns per installment.** `installment − credit applied = after fundraising`;
`after fundraising − cash = owing`. Derived ONCE (`ledgerRowFor`) and handed to both renderers, so
the desktop table and the phone cards cannot disagree about what a family owes. `owing` stays the
SERVER's net remainder — never re-derived here, because credit allocation across installments is
the server's model.

⚠ **THE FOUR TILES ARE THE FOUR COLUMNS TOTALLED, WHICH IS WHY THERE IS NO TOTALS ROW.** The table
carries none: it would be the same four figures a second time, forty millimetres down. The tiles
won over the row because the phone collapses every installment — the season answer must stay at
the top, not sit under eight closed cards.

⚠ **`Credits −$250` became `After fundraising $550`** — the RESULT, not the deduction. A negative
in a row of positives was the one tile a treasurer had to decode; as a result every neighbouring
pair relates ($800 → $550 → $400 → $150). The credit is still named by the strip below, with its
payout door.

**2 — The Note column.** "Paid May 20" and "$50.00 covered — Bottle Drive" are the same kind of
thing (both explain the row rather than measure it) and a row is almost never both, so one column
carries whichever applies. That is what lets every row stay a single line at eight columns. Dollars
stay on a PART-covered row and go on a FULLY covered one, where `After fundraising $0.00` already
states the figure and only the source is left to say.

**3 — Phone: one collapsible card per installment**, closed on `date + owing / Paid / Covered`.
Reuses the By-installment lens's `.duesCard*` idiom — one collapsible-card language in this hub.
⚠ `tableAsCards` was REMOVED from this frame: right for four columns, catastrophic at eight (a
12-installment season became ~100 stacked lines). Hiding the table under 640 is only safe BECAUSE
the collapsible list exists. Drawer widened to `.slideOverLedger` (1040px) — 720 sideways-scrolled
the eight columns at every width.

**4 — "Mark Paid" → "Record as paid" / "Record rest as paid"** (dues only; expenses, payables and
allocations keep theirs — those really are flags with no receipt book behind them). Owner asked why
both existed: they are the same act, and the old word described the pre-232 world where it stamped
a row rather than writing a receipt.

**5 — The re-run guard (the real defect in the set).** `Set dues for all players` gave EVERY player
the identical schedule, flattening every per-player arrangement in silence — a hardship plan, a
deposit-then-balance schedule, a mid-season joiner's prorated dates. The confirm screen said
"payments are kept", which is true and was the ONLY consequence named, so it read as "nothing of
value is at risk". Money was never what was at risk.
- `source = 'manual'` is the only record that a human chose a schedule for one family (it defaults
  to `manual`; only the generator writes `budget_generated`). The 409 now returns those players
  **by name**, plus a count of families whose **due dates would move**.
- New `skipPlayerIds` leaves them completely alone — no upsert, no delete, no re-projection.
- **"Keep the N I set by hand" is the PRIMARY button; "Apply to everyone" is the quieter one.**
  The destructive answer is one click away for the coach who means it, and is no longer the default.
- `playersSkipped` is a real figure again (hard-coded 0 since mig 232) and the success screen
  reports the kept arrangements, so "dues set for 12 players" on a 15-player roster never reads as
  three failures.

⚠ **Deliberately NOT a mid-season lock** (the owner's own question). Re-running mid-season is
legitimate and common, the help guide promises it works, and a date-based lock would block the
honest case while missing the damaging one — the damage lands the first time anyone re-runs after
hand-adjusting a family, which can happen in week one.

**6 — A live PRODUCTION defect, found in the same screenshot and fixed.** Paid rows read the literal
words **"Paid Invalid Date"**. `paid_at` is a timestamp and the drawer's date formatter was written
for a date-only column. Three screens had hand-rolled a formatter and all three were wrong: the
ledger drawer and the By-installment grid printed "Invalid Date"; the admin rep-team allocation
schedule read a bare date as UTC midnight and showed every due date **one day early**. One shared
`formatStoredDate()` now takes both shapes, resolves timestamps through the org zone, and returns
`—` rather than ever emitting "Invalid Date". Regression tests join the date-correctness suite.

**7 — The record control became a 28px tick, and then grew a confirm** (owner, same day). Filled
three-word button → banknote icon; the glyph is deliberately NOT a checkmark, because the Note
column beside it uses ✓ for *settled* and the same mark in a button reads as a state. Icon-only
obliges a real name: `aria-label` + `title` both quote the amount. Phone keeps the words and keeps
the control **inside the open card, never on the collapsed bar** — that bar is itself the toggle
target, and the two mis-taps cost wildly different things (open a card vs. record a payment).
⚠ **The confirm is what makes an icon-only money button honest**: it states how much, what day, and
that the receipt can be edited or removed. It costs a click on the hub's fastest path, deliberately.

**8 — Payments and credits stopped being dead ends** (owner: *"add edit buttons… so we don't only
have the delete option"*).
- **Payment edit = `PATCH` that REMOVES and RE-RECORDS.** A posted ledger entry is never rewritten
  here (the trap carried from kickoff), so an edit voids the old entry and posts a fresh one; the
  coach experiences an edit, the books keep the correction trail. ⚠ **Order is remove-then-record,
  chosen on which failure is safer**: record-then-remove fails into a DUPLICATE (books overstate
  cash, and nothing says which row is real); remove-then-record fails into a MISSING receipt (books
  understate, the row visibly vanishes, and the coach still holds every value in the form). The
  failure message says outright that the original has already gone.
- The overpayment PREVIEW subtracts the row being replaced from the running total first — otherwise
  it counts the old receipt and the new one together and warns about an overpayment that cannot
  happen.
- **Credit edit is COACH-AUTHORED ONLY.** `DuesCredit` now carries `fundraiserEntryId` and
  `expenseId` alongside `paymentId` (all three were already columns; only `payment_id` was mapped).
  A credit with any of the three set was CREATED BY another record which states its amount —
  editing it here would leave two disagreeing numbers and the next reconcile would overwrite the
  coach's fix. Those rows now say *from fundraiser* / *from expense* / *auto* instead of offering a
  pencil. ⚠ **Credit TYPE is locked while editing** — it is provenance, not a label.
- ⚠ **The credit PATCH repeats the DELETE's payout guard**: lowering a credit below what has
  already been handed to the family is refused with the same `CREDIT_HAS_PAYOUT` 409. Same hazard,
  same rule — a lowered credit strands paid-out cash exactly as a deleted one does.

**9 — The status column learned to see time** (owner: *"I don't like partial… those that are past
due should clearly say so instead of just '3 overdue' at the bottom"*).

⚠ **THE LABEL GRADED SEASON COMPLETION WHILE THE COACH WAS ASKING ABOUT LATENESS.** A family paying
every installment on the day it fell due read `Partial`; so did a family a month behind. One word
for the model family and the delinquent one, with the only lateness signal being a nameless
"3 overdue" footer count.

`Partial` and `Unpaid` retired. Six labels, each answering *does this family owe us anything right
now?* — `Not set` · `In credit` · `Fully paid` · `Settled` · **`Past due`** · **`Up to date`**.
- ⚠ **`Up to date` deliberately covers a family who has paid NOTHING** when their first bill has not
  come due. They owe nothing today; "Unpaid" cried wolf on families who had done nothing wrong.
  Progress through the season is the Paid/Balance columns' job.
- ⚠ **The column is quiet except where action is needed**: `Up to date` takes ordinary ink, not
  green — a mostly-green column has no colour left for the row that matters. `Past due` is danger
  + a ⚠ glyph (colour never carries a verdict alone).
- ⚠ **`hasPastDueInstallment` is ONE predicate** shared by the row's word and the footer's count.
  They were two calculations; the footer counted late players while the status column could not see
  time at all.
- ⚠ Lateness judged on the REMAINDER, never the paid stamp — credits settle bills and `paid_at`
  never stamps a credit-covered row.
- **The mode-blind fallback branch was REMOVED** (it graded off `rollingBalance` alone and once read
  a keep_separate team's unapplied credit as "Settled" — a /review Critical). The derived figures
  are required now; a compile error is the right answer for any caller that cannot supply them.
- The export takes `installments` so the spreadsheet says `Past due` wherever the screen does.

Help docs updated in the same unit of work (the re-run FAQ, the record-control paragraph, the
credit walk-through, a "Fixing a credit" note, and a plain-language **"What each status means"**
list). No migration. `verify:changed` green; 111 dues + date unit tests pass.

## /simplify + /review log (2026-08-14, Pass 4)

**`/simplify` — 4 lenses, 6 applied, 2 skipped.** The one that mattered was a real disagreement:
`lib/insight-findings.ts` counted a bill past its date **even when credits had settled it**, so
Insights could say "2 dues installments overdue" while Player Dues showed one Past due row. Now on
the shared `pastDueInstallments`. Also: `DUES_PAYMENT_METHODS` promoted to `lib/types.ts` (the two
doors each had a copy, with a comment promising parity and nothing enforcing it); the credit
PATCH/DELETE payout guard extracted to one `payoutCeilingRefusal`; `dues-reminder-email.ts`'s
hand-rolled `fmtDate` converted to `formatStoredDate` (**byte-identical output**, verified — it is
the one dues surface a FAMILY reads); `ledgerRowFor` hoisted into one `useMemo` (both renderers are
always in the DOM, so it ran twice per render); a dead `? 'them' : 'them'` ternary; two response
fields the modal stored and never showed.
- **Skipped:** threading `preloaded*` through remove→record (halves the round-trips on a rare
  action, but widens a shared money function's contract and a stale payment set fed into a
  projection is a real bug); extracting a shared icon-button CSS base (three per-feature variants
  already exist — a fourth is in-pattern; unifying touches three unrelated features).

**`/review` — high-risk tier, 5 lenses. 2 Criticals + 2 Highs + 1 Medium, ALL FIXED.**

⚠ **CRITICAL 1 — `source = 'manual'` IS NOT PROVENANCE, and the re-run guard was reading it.**
The column DEFAULTS to `manual`, and `replaceRepDuesInstallments` (which never sets it) is called by
**two automated paths** as well as the per-player editor: **season rollover's carry-fees step, which
is ON BY DEFAULT**, and the free→Premium upgrade migration. So the morning after a routine rollover
every player reads `manual`, the confirm screen would have named the WHOLE ROSTER as "schedules you
set by hand", and one click of "Keep the N I set by hand" would have applied the coach's team-wide
fix to **nobody** — the exact all-or-nothing failure Pass 4 existed to end, inverted. Worse, a list
that is usually noise stops being read, which is when it finally names a real hardship arrangement.
**Fix: hand-set is decided by comparing players to EACH OTHER** — a player whose amounts/dates
differ from the roster's most common shape. No column, no migration, no backfill; works on existing
data; a uniform roster (carried forward, migrated or generated) correctly flags nobody.

⚠ **CRITICAL 2 — a stale edit target could silently destroy a receipt.** The payment sheet is shared
between add and edit (a boolean opens it, an id points it at a row). The payment **Add** button
cleared the boolean and not the id — the credit one cleared both, and that asymmetry is what gave it
away — and no drawer-close path cleared either. Pencil a payment → close the drawer with X → reopen
→ "Record payment" → fill in what you believe is a second payment → save: it sent a PATCH and
replaced the family's original receipt, the only tell being the footer button reading "Save
correction". **Fix: one `closeMoneySheets()` through which every entry and exit passes** — no caller
is trusted to remember two pieces of state.

⚠ **HIGH — the correction door was not idempotent.** `removeRepDuesPayment` is a deliberate no-op on
an already-removed row (right for delete, fatal here): the LOSER of two racing corrections removed
nothing and recorded anyway, leaving two payments and two ledger entries for one correction.
**Fix: the DELETE is the only atomic point, so it is the claim** — `removeRepDuesPayment` now returns
whether *it* removed the row, and only the winner may write a replacement (409 otherwise).

⚠ **HIGH — the credit edit had no post-write re-check.** Its sibling `recordRepDuesPayout` has one
precisely because a pre-write ceiling read races; lowering a credit is the same hazard from the other
side. **Fix: re-read credits+payouts after the update and self-undo the loser**, restoring the
original amount.

⚠ **MEDIUM — an error message that could manufacture a duplicate.** `recordRepDuesPayment` commits
the payment row and only *then* reconciles credits and re-projects, so a throw from those last steps
means the replacement **already exists** — while the copy said "re-enter it to restore the record".
**Fix: never instruct a re-entry.** The message now states only what is certain and sends the coach
to LOOK at the Payments list before recording anything.

**Residual, reported not fixed (owner call):** `recordRepDuesPayout`'s own post-write re-check
recomputes its ceiling from the **stale** `credits` snapshot it read at the top, so a credit lowered
concurrently is still invisible to it. Pre-existing, outside this diff; the credit side of that race
is now closed, which is the direction Pass 4 opened.

Security lens: **clean** — both new PATCH doors prove org/team/program-year ownership before writing,
carry `canWriteMoney`, and `skipPlayerIds` cannot address another team's roster. Regression lens:
**clean** — 1827/1827 tests, no consumer of the retired `Partial`/`Unpaid`/`Mark Paid` strings
anywhere (UAT specs, demo checkers, seeders all verified). Rendered layout check: **no new findings**.

## Traps carried forward (from kickoff + inventory)

- Never delete/rewrite a posted ledger entry; corrections void + re-post.
- Org-timezone for "today"/overdue/month buckets (`lib/timezone.ts`).
- Live-season only; nothing joins the archive allow-lists.
- Columns exist per snapshots/live information_schema, never migration files.
- Per-row controls multiply by roster × installments — the drawer, not the row, carries actions.
- §12 (Money hub buttons, dev, unreviewed) owns the control-row/Export chrome this touches; land on
  top of it, don't fork it.
- Scope: coach rep dues only. Org allocations/payment requests and free-coach fees have the same
  shape — design the payment record liftable, land it here.
