# Sponsorship Applies To — a sponsorship that names the family's payments it covers

**Status:** ruled 2026-09-21 (D1–D8 as drawn — “looks good”; D3 + D4 on the recommended side) · BUILT ON DEV the same day (hub v2) · **mig 308 applied to dev 2026-09-21, PROD-OWED before the promote** (parity baseline carries its 5 in-flight items; lower to zero at the promote) · owner QA walk owed · uncommitted
**Hub (mockup · brief · plan · decisions on ONE URL):** https://claude.ai/artifact/JhhkcVbSpNQycMRCBYzepR
— source `docs/projects/active/COACH_SPONSORSHIP_APPLIES_TO_HUB.html` (republish the SAME path to stack a round).
**PM brief:** `COACH_SPONSORSHIP_APPLIES_TO_PM_BRIEF.md`.

## 1. How it started

Owner, 2026-09-21: *"investigate what it would take and what the best option would be to allow users to
select when a parent gets a sponsorship, that we select which installments get deducted by sponsorship?
we can maintain our account default but just want to see if we could add this customization option (in
case a parent makes a special arrangement with a coach)."* The investigation re-framed the ask: "select
which installments get deducted" collides with a standing engine rule only if it means **storing the
deduction**; storing the **agreement** and keeping the dollars derived does not. Mockup round 1
published the same day; rulings owed.

## 2. What the code does (verified 2026-09-21) — the facts the proposal rests on

- **One dial, team-wide.** `rep_program_years.credit_application` (mig 233) — `last_first` (default) ·
  `next_first` · `keep_separate`. Edited in Team settings → Money; stated under the Player Dues table
  (`CREDIT_MODE_SENTENCES`). Labels/hints/sentences all live in `lib/dues-credits.ts`.
- **Application is derived on every read.** `applyCreditsToBills` (`lib/dues-credits.ts`) walks the
  payment-coverage remainders (`allocateDuesPayments`, cash first, oldest-first) in the team direction
  with the family's WHOLE credit queue: forgiveness first, then non-forgiven by age, payouts skimmed
  from the front. `deriveDuesPosition` is THE assembly seam — 6 call sites (`dues/route.ts`,
  `installments/[installId]/route.ts`, `money-summary/route.ts`, `lib/coach-dues-remaining.ts`,
  `lib/coach-season-settlement.ts`, `lib/db.ts` ×2). Reminders, statements, exports, settlement and the
  Money Overview all read it. **Header rule:** "credit application is derived, never stored — no
  installment id ever lands on a credit row" (pinned by `tests/unit/dues-definition-guard.test.ts`).
- **A sponsorship's credit is a set of rows.** `rep_fundraiser_credit_plan` (mig 268) = the agreed split,
  one row per (sponsor × family), `$` or `%`. Each cheque (`rep_fundraiser_entries` arrival) accrues one
  `rep_dues_credits` row per family via `lib/sponsor-arrivals.ts` (`accrueArrival` /
  `deriveAllArrivalCredits`), pointing at the arrival through `fundraiser_entry_id`. **Editing the plan
  re-derives every arrival's credits from scratch** behind the payout floor (`lib/dues-credit-guards.ts`).
- **Installment ids are recycled.** `replaceRepDuesInstallments` (`lib/db.ts`) deletes and reinserts;
  `installment_number` is UNIQUE per schedule and survives a same-count re-run. Regeneration is
  all-or-nothing per season. This is WHY the header rule forbids ids — and why an arrangement must key
  on position, not id.
- **The share editor is ONE component** — `components/coaches/SponsorCreditPlanEditor.tsx`, drawn by the
  pledge branch of Record money (`expenses/panel.tsx`, `pledgeHandOff`), the sponsor room's live split
  (`fundraisers/SponsorRoom.tsx` → `CreditPlanZone`), and Edit sponsorship. A line added to it appears
  at every door.
- **The drawer's Note grammar** (`dues/panel.tsx` `ledgerRowFor` / `LedgerNote`): "Covered by
  fundraising — {description}" when `creditSources` are all `fundraiser`; "$X covered — {description}"
  on a part-covered row; `sources[]` per installment comes from the engine's `CreditApplicationSlice`.
  The Fundraising section lists each credit as `−$amount · description · date` with a hover title for
  sourced credits.
- **The "Where it lands" preview was RETIRED from the pledge form** (owner ruling 2026-08-31,
  `previewCreditLanding` headstone in `lib/dues-credits.ts`): the form states the credit, not the
  landing arithmetic. A choice about landing on that form must not reintroduce arithmetic.
- `check:layout` has never baselined the fundraising screens — every finding there reads as NEW; do not
  `--init` them (sponsorship-lifecycle memory).

## 3. Findings

- **F01 — One dial, every family.** No per-family / per-sponsorship / per-credit exception exists. No
  honest workaround: recording the sponsor's cheque as a *payment* misreports its source and changes
  dues-actual (`lib/coach-dues-actual.ts` counts money-backed credits, not payments, as sponsor income);
  switching the team mode moves every family.
- **F02 — The drawer cannot explain a landing.** The Note prints "Covered by fundraising — {sponsor}"
  wherever the direction reached. With arrangements possible it needs "as arranged" and "followed the
  team default", and the credit row needs to name its payments.

## 4. Decisions (D-ledger — ruled 2026-09-21 as drawn; the hub's Decisions tab is the readable copy)

**Build note on D2 (found by the engine tests):** among its named payments a credit lands EARLIEST first whatever the team direction — the drawing (December covered before February) is the rule. Walking the named payments in the team direction would have covered February first on a last-first team and contradicted the approved mockup.

| # | Question | Proposed | Alternative considered |
|---|----------|----------|------------------------|
| D1 | Where does the arrangement live? | On the (sponsor × family) share — `rep_fundraiser_credit_plan` — reached from both doors via the shared editor | A team setting (that IS the default); on the family's dues (agreement is about THIS sponsor's money) |
| D2 | What does it name? | Specific payments (checkboxes of the family's dated schedule); default stated as one quiet line in the team setting's words + Change | A per-family direction override (Option A) — cannot say "these payments"; subsumed |
| D3 | Named payment paid in cash first — where does the money go? | Next named payment, then team default; drawer says so | Hold as owed back — stricter, worse for the parent. **Owner's call** |
| D4 | Schedule re-run after an arrangement | Named by position (#n) + snapshot of date/amount; any re-run after `arranged_at` raises a "check the payments" cue (sponsor row + family credit row) until Keep these / Change; a missing position follows the default | Drop to the team default until confirmed — quieter for the coach, louder for the parent. **Owner's call** |
| D5 | `keep_separate` team | An arrangement lands on its named payments (explicit per-family decision); leftover waits | Refuse arrangements on such teams |
| D6 | Family has no schedule yet | No Change door; the line points at Player Dues; coach returns via Edit sponsorship | Name by ordinal without a schedule — nothing to show |
| D7 | Sponsorships only, or every credit? | Mechanism generic (a credit row can carry `applies_to`), door on the sponsorship share only | Drives and Adjustments too — not asked for |
| D8 | The "derived, never stored" rule | Reword to "no COMPUTED landing is stored; an arrangement may be" — engine header + dictionary purpose line, by owner ruling | Treat the ask as blocked by the rule |

## 5. Build — DONE on dev 2026-09-21

**What landed (every step below built as written unless noted):** engine three-pass walk + 11 new unit tests (43/43 in the file; the 500-scenario identity storm now seeds random arrangements) · mig 308 (three nullable columns, two array CHECKs; dictionary + snapshots refreshed, coverage ✓) · accrual + replay copy positions onto credit rows · `resolveArrangements` (server-side validation against the CURRENT schedule, snapshot fill, stamp carry/renew) inside `applySponsorAgreement` and on the create POST · both plan parsers accept `appliesTo` + `keepArrangement` · new light GET `dues/schedules` (positions/dates/amounts + `creditApplication`) · the record GET serves `appliesTo` / `arrangedAt` / `needsCheck` per share · `SponsorCreditPlanEditor` draws the line, the in-place picker, the D6 sentence and the D4 cue (both doors inherit; the room and the conversation fetch the schedules) · `planRows` carries positions so Edit sponsorship can never wipe an arrangement · the dues GET computes `arrangementNeedsCheck` per credit (two small reads, only when any credit is arranged) · the drawer: Note clauses, the credit row's own line with the fallback reason, the policy line's exception · help: the fundraising answer + the credit-application FAQ, with search terms · UAT: two scenarios appended to the sponsorship lifecycle spec, **RUN 2/2 against the dev server 2026-09-21**. **Not run:** `check:layout` on the sponsor room / pledge form (the shared server was hot and a peer's in-flight rename had the accounting page failing to compile) — residual: the picker rows carry a 44px floor at ≤768 by CSS but are unmeasured.

### 5b. /simplify · /review · /docs — all run 2026-09-21 on the built tree

**/simplify (4 lenses, 11 of 12 findings applied):** positions are the CHOICE (`CreditPlanShare.appliesTo: number[]`), the snapshot is a separate read-side field (`arrangedPayments: ArrangedPayment[]`, non-null halves), the confirm flag lives on `CreditPlanShareInput` so it cannot reach a row; ONE parser for both plan doors (`parseCreditPlanRows`), ONE JSON reader (`positionsFromJson`), ONE cue definition (`arrangementNeedsCheck` + `scheduleLastRunAt`), ONE roster-name lookup (`rosterFamilyNames` on `formatPlayerFirstLast`), ONE client fetch (`lib/coach-family-schedules.ts`); `getFamilyPaymentSchedules` composes the dues GET's own helpers; the engine's pass 3 is one batched call again (flag derived per item); the stored-plan read is skipped when nothing is arranged; `ArrangementLine` is its own component; `creditModeMidSentence` beside the sentences. **Kept on purpose:** the room re-reads the schedules on every record reload (a re-run schedule must show its new dates).

**/review (high-risk tier, 5 lenses, 14 → 11 → 5 confirmed+fixed, 3 accepted residuals, 1 advisory, 2 refuted):** [High] Keep these + Save split never settled and every further save restamped the arrangement — the save now spends the flag (draft + settle target) · [Medium] the drawer's fallback line lacked the "already covered by another credit" reason · [Medium] the picker's open state was a row INDEX and could reopen on the wrong family after Cancel — keyed by family now · [Low] caps: 60 positions, 200 rows · [Low] a double-submit's UNIQUE collision is a 409 with a coach sentence. **Accepted residuals (the module's documented no-transaction posture):** two coaches saving one sponsor's split in the same second can revert a Keep-these stamp; a split save racing a dues re-run's delete+insert can see zero installments for an instant and refuse; the cue compares the app clock (stamp) with the DB clock (installments). **check:layout:** `--changed` widened to the whole coach list and ABORTED at the memory floor; scoped to the four screens it found the Change link under the 44px floor and the "·" separator failing contrast — both fixed, re-run clean; four pre-existing chrome findings on the never-baselined sponsors list left un-baselined.

**/docs:** the fundraising article's paragraph became a two-sentence lead + three definition rows (Applies to · Change, on Applies to · Keep these); the credit-application FAQ keeps its "one exception" paragraph; search terms widened. ⚠ Pre-existing debt noted, not taken: the "Fundraisers and sponsors" sub-topic measures 2,311 words against the 350 standard — a /docs project of its own.

### 5a. The plan as written before the build

**Order is load-bearing — engine first, doors last.**

1. **Engine** (`lib/dues-credits.ts`): `ApplicableCredit` gains `appliesTo?: number[] | null`
   (installment positions). `applyCreditsToBills`: after forgiveness + payout skim, pass A runs arranged
   credits over `coverage` rows whose `installmentNumber ∈ appliesTo` (team direction among them);
   pass B runs the ordinary walk with unarranged credits AND arranged leftovers, by age. On
   `keep_separate`, arranged credits are spendable in pass A only. `CreditApplicationSlice` gains
   `arranged: boolean` (landed in pass A) and `fallback: boolean` (an arranged credit's dollars landed
   in pass B). Tests: identity holds; cash-first holds; forgiveness-first holds; two arranged credits on
   one bill order by age; a position absent from coverage is skipped; `keep_separate` leftover → owedBack.
2. **Schema (ONE migration, dictionary + snapshots same unit):** `rep_fundraiser_credit_plan.applies_to
   jsonb NULL` (`[{n, due_date, amount}]`), `rep_fundraiser_credit_plan.arranged_at timestamptz NULL`,
   `rep_dues_credits.applies_to jsonb NULL` (positions only — the copy the engine reads). NULL = team
   default; no backfill. Reword the `rep_dues_credits` purpose line per D8.
3. **Accrual** (`lib/sponsor-arrivals.ts` + the arrivals writer in `fundraisers/[fundraiserId]/…`):
   each accrued credit copies its share's positions. Plan edits already rebuild all credits → the copy
   cannot drift.
4. **Readers**: `mapRepDuesCredit` (`lib/db.ts`) + the in-line credit mappers in `dues/route.ts`,
   `fundraisers/[fundraiserId]/entries/route.ts`, `players/[playerId]/dues-credits/route.ts` pass
   `appliesTo` through. The dues GET serializes `arranged`/`fallback` on `creditSources`.
5. **Share editor** (`SponsorCreditPlanEditor.tsx`): the `applies` line under a row with a family;
   the picker (that family's installments — the editor needs `schedules` per family from the caller;
   the pledge branch and the room both already hold `roster` and can fetch the dues book); the
   no-schedule sentence (D6). The plan PATCH body carries `appliesTo` per share; the route validates
   positions exist on the family's current schedule. `arranged_at` stamps on save when positions change.
6. **Drawer** (`dues/panel.tsx`): `LedgerNote` adds " · as arranged" / " · followed the team default"
   from the slice flags; the Fundraising credit row gains `line2` from `appliesTo` (+ the fallback
   sentence when any slice is `fallback`). Policy line: "… — except where a sponsorship names its
   payments" when any credit on the page carries `appliesTo`.
7. **Re-run cue** (D4): the dues schedule's replaced-at (does `rep_player_dues_schedules` carry
   `updated_at`? — verify against the snapshot; add if not, same migration) vs `arranged_at`. "Keep
   these" restamps and re-snapshots. Drawn on the sponsor share row and the family credit row.
8. **Help** (`lib/help-content/coaches.tsx`): the fundraising answer + the "how credits meet bills"
   answer; keywords `arranged`, `applies to`, `which payment`. Offer `/docs`.
9. **UAT**: extend the sponsorship lifecycle spec — arranged → cash-first → re-run cue → Keep these.
10. **check:layout** on the sponsor room + pledge form at 390/768; do NOT `--init` the fundraising
    screens.

**Out of scope:** the drive leaderboard and the Adjustment form (D7); undo of an arrangement's history;
any change to the three team modes; the closed-season page (a finished season reads the computed
position as it does today — nothing new to shelve).

**Effort:** medium — a few days (actual: one session, 2026-09-21). The engine is the risk and the best-tested part.

## 6. Traps carried in

- **"A guard read from a filtered list is not a guard"** (sponsorship memory): the picker's positions
  must validate against the family's CURRENT schedule server-side, not the list the client drew.
- **Two doors, one verb**: the plan PATCH is the only writer of `applies_to`; the pledge form writes
  through the same route. Do not grow a second writer on the create path.
- **`replaceRepDuesInstallments` recycles ids** — never store one. Positions only.
- **The retired preview**: the picker shows amounts as FACTS of the schedule, never a computed split.
- **check:layout has never baselined fundraising** — findings there are pre-existing.
