# The Adjustment ceiling is the bill

**Status: RULED and BUILT on dev, 2026-09-12** (F01, F03 (i), F04 and wording all accepted — the
hub's Decisions tab holds the six rows). Reopens the Adjustment ceiling (owner ruling, 2026-09-11)
at the owner's request (2026-09-12), **corrected the same day** by the owner: *"the adjustment is
to the total dues, so we shouldn't be able to total adjustments more than the total dues …
regardless of how much they have paid."* The first draft of this plan bounded the ceiling by
payments; that was wrong and is gone. **Owner QA ✅ §174 PASSED 13/13 2026-09-12; `/review`
run the same day, seven findings fixed (build note below).** Committed `c6b54182` 2026-09-12
with the adjustment-breakdown work, whose ceiling this corrected before it was ever committed.

**Project hub (mockup + PM brief + this plan + decisions, one URL):**
https://claude.ai/code/artifact/4ce67727-c449-41ed-bb78-3da5da22d8c1 — republished to the same
path (`COACH_DUES_ADJUSTMENT_HANDBACK_HUB.html`) at every phase, per
`memory/feedback_project_hub_single_artifact.md`. This file and the PM brief are the source text;
the hub is the reviewable front door and stays in sync with them.

## The problem, in one sentence

The Adjustment ceiling measures what's still *owed*, but an Adjustment lowers the *bill* — so a
family who has paid $500.00 of $900.00 can have at most $400.00 written off, and a family who has
paid in full can have nothing written off, even though the Dues figure drops in every mode.

## Why today's rule exists, and what it gets right

An Adjustment (`credit_type 'other'`) is the one credit a coach types by hand with **no arrived
money behind it**. The ceiling (`lib/dues-credit-guards.ts`, `adjustmentCeiling`) exists so a
hand-typed number can never turn into "the team owes this family cash nobody sent." That goal is
right and survives this plan. The *formula* — `leftToSend`, floored at zero, and a hard 0 on
`keep_separate` — is the wrong quantity for it.

## What the code does today (verified 2026-09-12)

- `adjustmentCeiling()` returns `max(0, leftToSend)`; returns `0` before computing anything on
  `keep_separate` (`dues-credit-guards.ts:65`).
- The Dues figure a coach reads (`splitDuesLadder` → `duesActual`) subtracts standing `other` +
  `forgiven` credits in **every** mode — neither function takes a mode parameter. An Adjustment
  lowers the bill on a hand-back team exactly as it does on a roll-forward one.
- On roll-forward modes, `applyCreditsToBills` lands an `other` credit on installments still owing;
  the leftover flows to `owedBack` (`dues-credits.ts:480`). On `keep_separate`, the spendable queue
  is filtered to `forgiven` only (`~420–423`), so an `other` credit's **whole** amount lands in
  `owedBack` and none of it touches an installment.
- `payoutCeiling` = every standing non-forgiven credit; it knows nothing about unpaid installments.
- The schedule editor's path is different: `strandedExcess` mints an *overpayment* credit against
  the **gross** schedule. An Adjustment never goes through that; the Adjustment credit itself carries
  the owed-back amount — which is why it keeps its own description.

## The proposal

### F01 — The ceiling becomes what's left of the bill (every team, every mode)

Ceiling = original charges − standing write-offs (`other` + `forgiven`). Payments and money-backed
credits (fundraiser, sponsor, reimbursement) don't enter into it. A $900.00 bill can be written down
by up to $900.00 whether the family has paid $0.00, $500.00 or $900.00.

Downstream on roll-forward teams, nothing new is needed: the write-off lands on what's owed first
and only the leftover becomes owed back — which is ≤ what the family sent, because the bill can't go
below zero. Worked: $900.00 bill, $900.00 written off — paid $0.00 → $900.00 clears, $0.00 back;
paid $500.00 → $400.00 clears, $500.00 back; paid $900.00 → $0.00 clears, $900.00 back.

The form states the consequence before Save when the amount exceeds what's still owed:
*"This is more than is currently owed — $17.00 becomes a credit this team can hand back to the
family."* The refusal sentence names what's left of the bill, not what's owed: *"An Adjustment can't
lower this bill by more than what's left of it — $883.00."*

### F02 — The reason survives

Unchanged from the first draft: the Adjustment keeps the coach's own description, in Adjustments &
forgiveness, and the original charge is never rewritten — which neither workaround (Pay out
directly; Edit schedule) gives.

### F04 — The bill can be lowered below its write-offs (a hole TODAY)

Owner question 2026-09-12: *"the total bill is sum of installments, what is the behavior if a user
tries to lower installments lower than the sum of adjustment? do we prevent that too?"* — **No, and
nothing does today.** Verified:

- Both schedule doors — the per-player POST (`dues/route.ts` ~452–465) and the roster re-run
  (`generate-installments/route.ts` ~271–329) — read credits only inside `if (payouts.length > 0)`
  and only for `projectScheduleTotalChange` → `payoutFloorViolation`, whose docstring ("a LOWER total
  only grows the credit") is true of overpayment credits and untrue of write-offs. Nothing compares
  the new total to standing `other` + `forgiven`.
- `splitDuesLadder` clamps `loweredC` against *credits*, not the bill, and has no floor on `dues` —
  $300.00 bill / $600.00 `other` prints **Original charges $300.00 / Adjustments & forgiveness
  −$600.00 / Dues −$300.00**.
- `applyCreditsToBills` treats `other` like a money-backed credit: $300.00 lands, `owedBack =
  $300.00`, and `payoutCeiling` (excludes `forgiven` only) offers it in the Pay out sheet — money
  nobody sent. A `forgiven` excess "evaporates" instead (harmless money-wise, still a negative Dues).
- `planRosterDuesRun` has no `creditType` branch — a $0-paid family with a $600.00 Adjustment gets
  no exception row in the Set-dues-for-all preview.
- No unit test pins the scenario (nearest: `coach-dues-band.test.ts:98` asserts `balance −450`
  without asserting Dues).
- Reachable under the 09-11 ceiling: record an Adjustment ≤ what's owed, then lower the schedule.

**Fix:** the invariant *write-offs ≤ bill* is asked at every door that moves either side. F01 is
the Adjustment side. F04 is the schedule side: a new pure guard in `lib/dues-credit-guards.ts`
(`writeOffCeilingViolation(newScheduleTotal, standingWriteOffs)`) asked PRE-FLIGHT by both schedule
doors, in the payout floor's idiom — refuse with one sentence: *"This family has $600.00 written off
— a $300.00 bill would be less than that. Lower or remove the adjustment first."* The roster-wide
run refuses only the affected families by name and completes for everyone else (its existing
pattern); `planRosterDuesRun` emits them as `blocked` rows. `splitDuesLadder` additionally floors
`dues` at zero for any pre-guard data. **Allow-and-clamp rejected:** it leaves "$300.00 charged,
$600.00 written off" on the record forever and tells the coach nothing.

### F03 — The hand-back payout hole (needs a ruling)

With a bill-sized ceiling, a $900.00 Adjustment on a `keep_separate` family who paid $0.00 lands
entirely in `owedBack` (nothing touches the bill in that mode) and the mid-season Pay out sheet
offers it in full. This — not the ceiling — is the "money nobody ever sent" hole the 09-11 zero was
closing. Two ways to close it:

- **(i) Recommended — an Adjustment lands on the bill immediately on hand-back teams, as
  forgiveness already does there.** Include `other` alongside `forgiven` in `keep_separate`'s
  spendable set. One rule everywhere; the roll-forward arithmetic closes the hole with no extra
  guard. Behavior change on hand-back teams: a mid-season write-off lowers the next installment
  instead of being refunded at settlement. Argument: the product already groups "Adjustments &
  forgiveness" as one kind of thing, and a coach who says "the bill is $883.00" should not have the
  system chase $900.00.
- **(ii) Keep it held until settlement; cap what's refundable at the family's payments in.** A second
  rule on the payout side that only this credit type needs. Preserves the mode's philosophy; leaves
  the Dues figure reading $883.00 while the installments still total $900.00 until settlement.

## What does not change

- Forgiveness as a credit type. Fundraiser / sponsor / reimbursement credits.
- No installment picker — a credit has never been tied to one installment (derived at read time,
  never stored, per the data dictionary), and picking one wouldn't change the question.
- No schema change. No migration.

## Blocking gate

1. **Mockup approved** — Screens 1–5 of the [hub](https://claude.ai/code/artifact/4ce67727-c449-41ed-bb78-3da5da22d8c1)'s
   Mockup tab.
2. **F03 ruled** — (i) or (ii). Recorded on the hub's Decisions tab when it lands.
3. **Wording ruled** — the consequence sentence, the refusal sentence, the owed-back note.

## Work — built 2026-09-12

- [x] `adjustmentCeiling({ installments, credits })`: Σ installments − `standingWriteOffs`
      (`other` + `forgiven`), no mode, no payments, no payouts. Both credit routes (POST, PATCH
      pre-check and post-write re-check) fetch only installments + credits now.
      `tests/unit/dues-credit-guards.test.ts` rewritten: the four flipped cases, cents exactness,
      the exclude-yourself case kept.
- [x] `adjustmentCeilingMessage(ceiling)`: no mode; "can't lower this bill by more than what's left
      of it — $X" / "already been written off in full".
- [x] Add Adjustment form (`dues/panel.tsx`): the foreseeable refusal reads the guard's sentence
      and Save goes dead (`newAdjustmentOverCeiling`, same `adjustmentCeiling` the server runs);
      the "more than is owed" consequence names both halves; the hand-back refusal block is gone
      and the "settled at season's end — installments don't move" clause is kept only for a
      legacy money-backed kind.
- [x] F03 (i): `applyCreditsToBills` — `keep_separate` spendable set is `forgiven` + `other`;
      header and `CreditApplicationMode` doc updated; the picker hint for that mode reads
      "Money credits wait for season's end — a bill the coach lowers is lower now". Two allocation
      tests in `dues-credits.test.ts` (lands next-first like forgiveness; the paid-in-full write-off
      is the owed-back credit that carries the reason).
- [x] F04: `writeOffCeilingViolation` / `writeOffCeilingMessage` / `WRITE_OFFS_EXCEED_BILL` in
      `dues-credit-guards.ts`. Per-player `dues/route.ts` POST asks it before the payout floor
      (409). `generate-installments` reads every family's credits (one season-wide query, no longer
      only the paid-out ones), refuses by name into `writeOffRefusals`, completes the rest.
      `planRosterDuesRun` asks it first and emits a `blocked` row with `writtenOff`; `DuesRunPlan`
      echoes `newScheduleTotal` so the row can name the bill. `GenerateInstallmentsModal` speaks
      the sentence in the preview row and in the result, and excludes the refusals from the
      generic could-not-save list. `splitDuesLadder` takes the bill as a third bound on `loweredC`
      (Dues never negative; same figure off `otherCredits`; the row still closes). Tests: guard
      (7 cases incl. raise-never-trips), planner (2), ladder floor (1).
- [x] Help (`lib/help-content/coaches.tsx`): "The limit is the bill, not the balance" paragraph
      under Adding an adjustment; the three "bills never move" sentences for the hand-back setting
      now say money credits never move a bill but a write-off is lower straight away; the
      Set-dues-for-all refusal paragraph names the write-off refusal; keywords + searchText.
- [x] Gates: 176/176 across the ten dues suites; full unit run 3,587 pass / 37 fail — **every
      failure is in the peer session's in-flight budget periods/exports work** (`coach-budget-
      periods-view`, `coach-money-exports-budget-plan`, `coach-budget-plan-round-trip`,
      `budget-ladder-sign-guard`, `money-summary-band-guard`, `budget-sponsorship-kind`), none in
      dues. `check:money-report` green on the live fixture. Lint 0 errors on the touched files.
      `check:spelling` green. Typecheck clean on every touched file (the tree's remaining errors are
      the peer's `onDraft`/`PeriodView`/`family-guardian` work).
- [x] Demo sandboxes: neither world holds a write-off (ruled §160 F1) and the narration doesn't
      describe the ceiling — nothing moves.
- [x] Owner QA walk — **✅ §174 PASSED 13/13, 2026-09-12, zero defects, all four parts.**
- [x] `/review` 2026-09-12 (high-risk tier, five lenses; 14 → 11 → 8 verified; 1 refuted; 6
      advisory): **seven fixed same day** — (High) the form's refusal banner and dead button ran two
      rules and an edit counted its own amount against itself → one predicate, the edited row
      excluded, raise-only like the route; (Medium) the per-family schedule door refused every save
      on a pre-guard family → asked only on a lower; (Medium, two finders, reaches the family
      statement) `adjustmentsReturned` printed the over-bill excess as "already returned" on legacy
      rows → capped at the bill, test added; (Medium, two finders) `CREDIT_MODE_SENTENCES.
      keep_separate` still read "Credits don't reduce bills" standalone → "Money credits…"; (Low)
      NaN fails the guard open → `cents()` isFinite; the statement's dead no-ladder fallback floored;
      a walkthrough code comment trued up. **Refuted:** the statement's `balance` as a second
      formula — it is the ladder's closing identity. **Advisory, left:** the picker LABEL "They
      don't — settle at season's end" (a help term; renaming is a vocabulary ruling — recommend
      leaving it, the hint beside it carries the exception); oldest-first payout attribution in the
      engine (pre-existing aggregate model); preview/write override parity (dormant); the
      guard-then-write window (documented class); `toFixed` without a thousands separator (mirrors
      the sibling sentence). Rendered check aborted on the shared dev server's memory floor — not
      restarted (peers), so unproven; the only screen-visible change is one caption on the player
      page.
- [x] Commit — **`c6b54182` 2026-09-12**, with the adjustment-breakdown work (§160's 2026-09-12
      follow-up), whose ceiling this corrected before it was committed. Built in a private index
      (CAS on the ref); TODO.md, the QA ledger and the help file went in as reconstructed
      HEAD+this-unit blobs — other sessions' hunks stayed in the working copy.

**Considered and not done:** sorting `other` ahead of money-backed credits in the spendable queue
(so a fundraiser share is never consumed by a bill a write-off would have cancelled). The identity
holds either way and the owed-back total is identical; only which credit the Pay out tick-list
attributes it to differs. Out of the ruled scope — noted for a later pass if a walk shows an
Adjustment being offered as a "debt" where the family's real money should be.
