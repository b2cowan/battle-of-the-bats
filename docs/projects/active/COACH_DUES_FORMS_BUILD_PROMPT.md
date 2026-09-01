# Build prompt — The dues forms (owner-ruled 2026-08-30, Owner QA §123)

**Paste into a fresh chat:** `execute docs/projects/active/COACH_DUES_FORMS_BUILD_PROMPT.md`

**Plan + PM brief:** `docs/projects/active/COACH_DUES_FORMS_PLAN.md` · `…_PM_BRIEF.md`
**Approved mockups (the spec — but THE CODE OUTRANKS THE PICTURE):**
https://claude.ai/code/artifact/b0038f4f-411b-4ffe-99c6-9a32794b3b57

**All six questions are ruled — every one option A, no amendments (Owner QA Ledger §123). Do not
re-litigate them.** Present the blocking PM UX summary, then build.

**No migration. Nothing in this project changes the schema.** If you find yourself writing one,
stop — you have misread something.

---

## Do not start until

1. **§122's build is committed.** The fundraising guarded-deletes work landed on dev 2026-08-30 and
   touches `lib/db.ts`, the dues drawer and the shared money chrome. Racing it re-creates the
   file-modified collisions of 2026-08-29. Check the ledger's §122 entry and `git log`.
2. ⚠ **The working copy is shared and was hot on 08-29 and 08-30.** A concurrent club-money refactor
   turned `typecheck` and `verify:changed` red on files that work never touched.
   **Attribute a red gate to a FILE and an mtime before believing it is yours.**
3. `git rev-parse --abbrev-ref HEAD` is `dev`. Stage explicit pathspecs only — never `git add -A`.

Migrations **268, 269 and 270 are prod-owed** from the sponsorship work. Not yours; just do not
promote ahead of them.

---

## The state of the world (verified 2026-08-30 — RE-VERIFY, files move)

**The five forms.** The bulk generator is `accounting/GenerateInstallmentsModal.tsx` (shared by the
Dues and Budget tabs). The other four live in `accounting/dues/panel.tsx`: `ScheduleForm` at the
foot of the file, the Add-credit form and the payment-correction form inside the player drawer, and
the Set-refund sheet (`choiceFor`) at the end of the render.

**What is already right, and must not move:**
- The generator sends the **previewed rows back as the payload verbatim**. That is the fix for the
  08-13 deferred defect. Do not "simplify" it into a client recomputation.
- The generator's replace step names the hand-set families and offers **"Keep the N I set by hand"**
  as the PRIMARY button. Owner-accepted shape.
- `closeMoneySheets()` is the one reset for every way the drawer's sheets can be dismissed. It exists
  because a stale id silently PATCHed a family's first receipt (2026-08-14 Critical). **Every new
  entry and exit goes through it.**
- The one-taps (`Record as paid` / `Record rest as paid`) and their dollar-quoting confirm.
- The credit type picker: locked once set (the type is provenance), and always showing the real kind
  even when it is not a manual one.
- The forgiveness path: derived not typed, one per family, and **excluded from the payout ceiling** —
  a forgiven balance was never the family's money to be handed back. Do not touch that exclusion.

---

## Phase A · The floor — build and commit this FIRST, alone

Two write-path defects. Neither is visible on screen; both were found by executing the arithmetic.
**Phase A is its own commit and its own green gate.** Nothing else starts until it is done.

### A1 · The reconcile must count the credits it writes

`reconcileOverpaymentCredits` in `lib/db.ts` selects the player's credits with
`.not('payment_id', 'is', null)` — so it counts only credits riding a payment. The credits it writes
on a schedule change carry `payment_id: null` (deliberately: they are standalone and manually
deletable). **It therefore cannot see its own work.**

Executed consequences, both reachable from either door:

```
family paid $1,200 in full
  lower the total to $800   → credits [$400]
  lower the total to $600   → credits [$400, $600]   true excess $600  → over by $400
  (or) restore to $1,200    → credits [$400]         true excess   $0  → stale $400 stands
```

**The fix is which credits it counts, not the arithmetic.** It must total every `overpayment` credit
for that player in that season, however born, and reduce newest-first across that whole set.

- ⚠ **Counting them all is not treating them all the same.** A credit riding a payment is removed by
  DB CASCADE with that payment; a schedule-change credit is standalone. Preserve that.
- ⚠ **`tests/unit/dues-payments-allocation.test.ts` passes straight through this defect** — it
  exercises `strandedExcess` with the stale total handed in by hand, so the pure function is right
  and the test proves nothing about the seam. **The regression test must cover the query plus the
  function**, with both sequences above.

### A2 · Both schedule doors ask the payout floor

`lib/dues-credit-guards.ts` holds the shared floor — the sentence, the code (`CREDIT_HAS_PAYOUT`) and
the projection helpers. Three doors call it. **Neither dues-schedule route reads the payouts table
at all.**

The reachable harm: a family overpays → the coach hands the money back in cash → the coach corrects
the total upward → the reconcile deletes the credit that payout was standing on, and the books say
the family was owed nothing.

**Add a projection for the schedule case** beside the existing sponsor one. It is computable
pre-flight and composes with A1:

> after this write, total `overpayment` credit will equal `strandedExcess(paymentsTotal,
> newScheduleTotal, 0)` — so the projected set is the family's non-overpayment credits plus one
> overpayment credit of that value. Hand that to `payoutFloorViolation` with the family's payouts.

- ⚠ **PRE-FLIGHT, NEVER POST-WRITE.** This is the P4 lesson and it is binding: *a guard that refuses
  after an irreversible write strands the record forever.* Ask before the upsert, not after.
- The refusal speaks `payoutFloorMessage` verbatim with an action reading like
  **"raising this player's dues total"**, and **carries a door** — *"Open Riley's payouts"*, landing
  on that player's record. (This is the review's Q8 pattern arriving early; this refusal has nowhere
  else to send anyone.)
- **The bulk door needs a PER-FAMILY answer.** A roster-wide re-run must refuse the affected families
  **by name**, complete for everyone else, and report them in the shape the existing
  `playersFailed` / `playersSkipped` buckets already use. Never fail the whole run; never write past
  a family it cannot safely write. The route's own invariant —
  `playersProcessed + playersSkipped + playersFailed.length === players.length` — must still hold.
- The generator's success state currently announces the doubled credit as though correct. Once A1
  lands it reports what is actually created; check that sentence still reads true.

**Phase A gate:** unit suite green · the new seam test · the money-lifecycle UAT spec gains both
sequences and is **RUN**, not merely written (the unexecuted-test lesson). Then commit.

---

## Phase B · Truth and safety, small

- **The refund sheet's failure is invisible.** `saveRowChoice` writes to `settlementError`, which
  renders inside the settlement window — *behind* the open sheet. On screen the Save button just
  stops spinning. Render the message **inside the sheet**, and keep the settlement window's own copy
  for its own failures.
- **A blank "set amount" saves as $0.** `parseFloat(choiceAmount) || 0` turns an empty or garbled box
  into zero, which on this sheet means a family takes nothing home. Refuse, naming the alternative:
  *"Pick 'No share' if that is what you mean."*
- **Gate the read-only doors.** Exactly three clusters in the player drawer render for a view-only
  money assistant, all missing `moneyCanWrite`:
  1. **Edit schedule** in the drawer's actions row;
  2. **Set dues schedule** in the no-schedule empty state;
  3. the whole credit cluster — **+ Add Credit**, the edit pencil, the delete.

  The payments and payouts lists beside them already gate correctly — copy those, do not invent a
  pattern. ⚠ A read-only assistant must be offered **no door the server will refuse**.

---

## Phase C · One grammar — the future-date rule (Q18)

"Record is for money that has already moved" is enforced on money out and, since 2026-08-29, on
sponsor arrivals. **It does not exist on any dues door.**

The sentence to reuse is live in `…/fundraisers/[fundraiserId]/arrivals/route.ts`:

> **That hasn't happened yet — an arrival is money that has already come in.**

Three doors and both servers:

1. the recording conversation's **dues branch** (`accounting/expenses/panel.tsx`) — the branch
   validates only that a date exists, and its `Date received` picker carries no `max`. ⚠ Note the
   existing future-date refusal checks `form.paidDate`; the dues branch uses `form.receivedDate`,
   which is why it was never covered.
2. the drawer's **payment-correction** form — picker `max` plus the client sentence.
3. the payment **POST and PATCH** routes — the refusal that actually binds.

⚠ **Unlike the spend branch there is no door to hand the coach to.** A future dues payment is not a
bill — the family's installment schedule *is* the promise. The sentence names that and stops.
**Do not invent a hand-off.**

Why it matters beyond tidiness: the books entry is dated `receivedDate`, so a future-dated receipt
drops the family's bill today and lands the money in a later month's income and Budget vs. Actual,
while the consequence line promises "shows on the ledger right away".

**Scope note:** the drive branch's `Date received` shares the field and the same absence, and its
entries route has no check either. That is the fundraisers walk's row, but it is one line in this
pass — **do it, and say so**, rather than leaving the third money-in door out of step for a third
release.

---

## Phase D · The words commit — one pass, one review

**One name for the bulk act: "Set dues for all players"** (Q20). It wins on:

- the modal title (`GenerateInstallmentsModal` — retiring the last Title-Cased window in money) and
  its confirm button (`Confirm & Generate for N Players`);
- the Budget tab's door, `OverviewDashboard`, `SetupOverview`;
- **four strings in `lib/help-content/coaches.tsx`**.

⚠ **One spelling, everywhere a customer can read it.** The help articles' `keywords` / `searchText`
arrays move with the prose, or search stops finding the article that describes the screen. True up
the internal comments quoting the old name while the files are open — they are not the product, but
a stale name in a comment is how the next reader learns the wrong one.

Also in this commit:

- **The correction form names the receipt it replaces** — *"Correct a receipt — $120.00, Aug 12"*.
  ⚠ **Not the player's name**: the drawer's title bar already carries it. The code's own comment
  names this as the residual risk left when the August Critical was fixed structurally.
- **Capitalization**: `+ Add Credit`, `Save Credit`, `Send Due Reminders` → sentence case, beside
  their neighbours. One button currently changes scheme with its own state (`Save Credit` when
  adding, `Save changes` when editing).
- **The credit form's default date** is evaluated at module load, so a tab left open overnight
  pre-fills yesterday. Compute it when the form opens.

---

## Phase E · The consequence sweep (Q4 — ruled ALL SEVEN, review-wide)

Three of the seven are here. Reuse the shared arithmetic — a sentence that does its own sums is a
sentence that can disagree with the write.

- **Add a credit** gains its landing sentence, quoting the team's own credits-reduce setting:
  *"When you save: nothing changes hands — Riley's family owes $60.00 less, taken off their last
  payment first."*
- **The schedule editor** gains the live reconcile its bulk sibling already runs, in the sibling's
  words: *"3 installments, $1,200 — matches the total."* Today that comparison arrives only after
  Save, as *"Installments sum ($800.00) must equal total ($1,200.00)"*.
- **The refund sheet's three options each state what they produce**, chosen or not. Today only the
  already-saved option shows dollars and it loses them the moment the coach picks another — the
  figure disappears exactly when they start comparing.

The other four (sponsor consequence, the fundraiser edit twins, the budget line's "nothing moves")
belong to their own walks. **Do not build them here** — but they are ruled, so do not re-ask.

---

## Phase F · Shape (Q19 "all of it", Q21)

**F1 · Move `ScheduleForm` onto the shared row component.** It is hand-rolled inline layout today —
a pinned `width: '7rem'` amount box and a date told to `flex: 1`, which measures **112px beside
809px** on a 1040px drawer. The generator already solves this with the `periodInputRow` family in
`accounting/budget/budget.module.css`, which becomes a labelled card below 640.

- ⚠ **A SCOPED VARIANT, never an edit to the shared classes.** Those classes are shared with the
  budget sheet and the bill editor. **`.planEditor` is the precedent to copy**: a surface prefix
  class, its own card treatment in the `≤640` block, its own 44px floor in the `≤768` block through
  `var(--tap-min, 44px)`.
- **Before/after proof that the budget sheet and the bill editor did not move is part of the
  deliverable**, not a courtesy.
- Desktop: amount and date share the row equally, labelled once at the head.

**F2 · Tap floor.** The remove-installment `×` measures **21×21px with no accessible name**;
`+ Add installment` is **119×25px**. Both are under the 44px floor that holds to 768.
⚠ **They survived because `check:layout` cannot open a drawer** — the same blind spot §122 recorded
for the unbaselined fundraising screens. Sweep the other controls in these five forms while you are
there; the pencil and trash icon buttons are a deliberate 28px owner call from 2026-08-14 (the
confirm dialog is what makes them honest) — **leave those alone**.

**F3 · The heading**: *"Dues schedule"* + *"Just this family. Everyone else keeps theirs."*
⚠ **Not the player's name** — the drawer's title bar carries it in both states, and repeating it an
inch below is the restatement §121 deleted from the sponsorship expansion (owner, during this walk).
**A heading in that drawer earns its line by saying what the title bar cannot** — which form this is,
and what it does not touch.

**F4 · Discard guard (Q21).** The schedule form and the credit form get the generator's guard
(`useDiscardGuard` + `UnsavedChangesGuard`). Measured today: typing a total and clicking the
backdrop closes the drawer with no confirmation and the typing is gone. ⚠ The generator's
`tabActive` lesson applies — a guard armed on a background tab intercepts clicks across the whole
app.

**F5 · Stack the two-column rows** in the credit and correction forms.
⚠ **These are NOT defects.** Measured at 360px: 133 / 157 / 300 / 145 / 145px, **nothing clips** —
the first pass overstated it and the register downgraded it. They ride along because the pass is
open. **If the pass gets cut, these come off first.**

**F6 · The refund options expose their selected state** to assistive tech — they are plain buttons
today, so a screen reader hears three buttons and no answer to "which is chosen".

---

## Out of scope — do not take these on the way past

- The one-taps. Question-free, forever.
- Recording a dues payment cold — the one conversation owns it. Only its **date** is in scope.
- Team settings → Money · the club tab's installments · phone money **tables**.
- **SP-8** — a sponsorship credit's chip and hover still read "Fundraiser" on the dues drawer's
  credit row. Real, visible here, and **booked to the sponsorship package's words commit**. Leave it.
- Absorbing any of these forms into the conversation (charter §2, reaffirmed 2026-08-24).
- ⚠ **Never a new credit kind.** A third enum member broke nineteen readers in August. Everything
  here is a label, a guard or a query.

---

## House rules that WILL bite

- Re-assert `pending + org + team` in every WHERE (`reference_coach_money_check_then_act`).
- Pre-flight guards, never post-write (the P4 lesson — it is the reason Phase A exists).
- `formatStoredDate()` / `formatTime()` only; **"8:00 a.m."** is build-gated; `installment`
  (two Ls) is build-gated.
- A CSS-module file may hold no global rule — it hard-fails the production webpack build.
- The token ratchet holds new files to zero hex, **including inside `var()` fallbacks**.
- A row component defined inside `render` remounts its manager — it presents as focus loss per
  keystroke. Relevant to F1.

## Verification

- `npm run verify:changed` · `npm run typecheck` (shared modules are touched).
- The **money-lifecycle UAT spec** extended for Phase A and **RUN**.
- `check:layout` after F — and read the fundraising note in §122 before treating a pre-existing
  finding as yours.
- ⚠ `check:layout` **cannot open a drawer**, so it cannot see F2's fix. Prove the tap floor with a
  throwaway Playwright measurement at 360px and 768px against the live dev server on the UAT coach
  fixture (`UAT_COACH_EMAIL` / `UAT_COACH_PASSWORD`, org `uat-test-org`; the drawer opens from a
  player card's **"Full record ›"**). Delete the script afterwards.
- One `/review` at the end of the whole build, not many small ones. Offer `/simplify` after F1 —
  it deletes hand-rolled layout in favour of an existing component, which is that pass's shape.

## After the build

- **Help docs**: Phases C and D change a user-facing flow and a name a customer reads — offer
  `/docs`.
- **Demo sandboxes**: the coach demo's money narration has gone stale across three consecutive
  releases. Phase D renames a door the tour may name; Phase C changes what the money form accepts.
  **Re-read the coach-money dock lines and tour steps in the same unit of work.**
- **No commit or push without the owner's confirmation.**
- Owner QA gets a **new ledger section** on completion, with a checkable walkthrough artifact
  (real checkboxes + localStorage + paste-back — never the artifact capability).
