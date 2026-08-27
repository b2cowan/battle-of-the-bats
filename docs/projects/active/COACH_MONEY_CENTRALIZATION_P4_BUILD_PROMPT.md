# P4 — A payment learns who paid it · BUILD PROMPT

**Open this prompt in a fresh session.** It is the entry point for Phase 4 of the coach money
centralization project (`COACH_MONEY_CENTRALIZATION_PLAN.md`).

---

## §0 · STOP — this session has TWO gates, and the first one has no code in it

**GATE 1 — the drawings and the brief. NO CODE MAY BE WRITTEN.** Not a migration, not a component,
not a "small helper while I'm here". You read code, you think, you draw, you write two documents,
and you **stop and wait for the owner**.

**GATE 2 — the build.** Only after the owner has approved the mockups AND the plan, in words.

> Owner instruction, verbatim, 2026-08-27: *"make sure that it produces a PM brief for me along with
> mockups so I can see what P4 plans on building, do not write code until I approve the plan/mockups."*

⚠ **Do not open this prompt until the money release has landed and `git status` is clean of other
sessions' money work.** P4 edits the same component as the commitment-page rebuild; today's session
needed hunk-by-hunk staging surgery to avoid committing another agent's work, and that was with
changes that did **not** overlap. P4's do.

---

## §1 · ITEM ONE — THE MOCKUP GATE

Everything below is subordinate to this. Publish the drawings **as a Claude Artifact** (binding —
`memory/feedback_mockups_as_claude_artifacts.md`), one page, before writing anything else.

**The named specimens. All six, not a representative sample.**

1. **⚠ THE RECORD-A-PAYMENT CONVERSATION — ONE WHOLE SCREEN, BEFORE AND AFTER.** Not a cropped
   field, not a component in isolation: the entire form as a coach meets it, drawn twice, so the
   owner can see what the new question costs the screen it lands on. **At desktop AND at phone
   width, and the phone one TRUE SIZE** (`memory/feedback_mockups_as_claude_artifacts.md` — a sizing
   mockup that isn't true size has told us nothing twice).
2. **The new question in its three states** — nobody named (the default, and it must stay the
   default), a family named, and the **consequence line** that states the credit in words *before*
   the coach saves. The consequence line is the existing convention on this form; match it.
3. **A commitment's payment list, before and after** — a settled payment now says who paid it.
4. **Where the credit lands** — the family's dues screen and the family statement, showing what this
   credit is *called* so a parent reading it recognises their own $200.
5. **⚠⚠ THE UNWIND, DRAWN.** Open a payment that names a payer and (a) change the amount, (b) change
   the payer, (c) delete it. Draw what the coach is told each time. This is the phase's whole risk;
   if it is not in the drawings it will be discovered during QA instead.
6. **The collision.** A cost already marked *paid out of pocket by a family* that then receives a
   payment naming a payer. Draw the answer — refusal, reconciliation, or "both are legitimate and
   here is why" — and argue it.

**Rules for the drawings:** real content from the UAT fixture's vocabulary, never lorem; both themes
(warm is the default a coach meets); and where a drawing deviates from what the code does today,
**say so on the drawing**.

---

## §2 · WHAT P4 IS, AND THE CASE THAT RULED IT IN

**Owner ruling, 2026-08-21 (ruling 1 of 3):** *a payment learns who paid it — **yes**.* Recorded as
"its own careful phase — reaches family credit, edit/delete must unwind it exactly."

**The case:** a tournament deposit of $200 that a parent pays directly. The team's cash never moves;
the team now owes that family $200 against their dues.

**What the product can do today, verified in code (not from a plan):**
- A **cost** can name an out-of-pocket payer — `rep_team_expenses.paid_by_player_id` (mig 234,
  `ON DELETE SET NULL`) — and it is **creation-only**. There is one door and it mints the credit
  atomically.
- A **payment** against a commitment carries **no payer at all** — `rep_payable_payments` has no
  such column. So a parent who pays one installment of an existing commitment cannot be recorded as
  having done so, which is exactly the $200-deposit case.

**So P4 is: the payment gains the payer the cost already has** — with the credit, and the unwind.

---

## §3 · READ THESE BEFORE YOU DRAW (code first; plans in this repo have been wrong)

- `rep_payable_payments` and `rep_payable_installments` — how a payment attaches to a schedule piece.
- `lib/payable-standing.ts` — how a bill's paid/owing/remaining is derived. ⚠ A piece's `owing` is
  **dual-purpose** (remaining when unsettled, full face amount when settled); P3 shipped a bug on
  exactly this. Do not repeat it.
- The record-money conversation inside the money panel, and `lib/coach-record-money`.
- The out-of-pocket credit path — `lib/coach-money-in.ts`, `lib/db.ts`, and the dues credit route.
- `lib/dues-credits.ts` and its exported `MANUAL_CREDIT_TYPES`. ⚠ **A new credit kind is not a
  manual kind.** P3 fixed a 400 caused by a picker offering kinds the server refuses; do not
  reintroduce the mirror of that bug.
- **`docs/agents/db/DATA_DICTIONARY.md`, the `rep_team_money_in` gotchas.** Gotcha 1 is the one that
  matters most here and it is stated in ⚠⚠:

  > *"THIS IS NOT THE OUT-OF-POCKET MECHANISM, and a coach describes both as 'a parent paid me
  > back'."*

  **Two mechanisms, one sentence in a coach's mouth.** Read gotcha 1 and gotcha 3 ("NEVER BOTH") in
  full, and make the brief say which one P4 extends and why the other is wrong for this case.

---

## §4 · THE HARD PARTS — named here so they are designed, not discovered

1. **⚠⚠ THE UNWIND IS THE PHASE.** Editing a payment's amount must move the credit. Editing its
   payer must reverse one family's credit and mint another's. Deleting it must remove the credit.
   Every one of those is a **check-then-act** window — `memory/reference_coach_money_check_then_act.md`:
   re-assert team + org + the row's expected state **in the WHERE of every write**, because this
   codebase has already shipped an approve path that posted a transfer before marking it approved.
2. **The double-credit trap.** A cost may already name an out-of-pocket payer. If a payment against
   that same cost also names one, does the family get credited twice? Answer it explicitly.
3. **⚠ "NOTHING HERE EVER CHANGES A PAYMENT SCHEDULE"** — dictionary gotcha 4 on `rep_team_money_in`.
   Decide whether a P4 credit touches dues **the way the existing out-of-pocket mechanism does**, and
   follow that precedent rather than inventing a second answer. Two arithmetics for one question is
   the defect this project exists to remove.
4. **A removed roster player.** The cost-level column is `ON DELETE SET NULL`. Match it, and say what
   the coach then sees on a payment whose payer is gone.
5. **Reading is not writing.** A read-only money assistant must be able to **see** who paid — the
   §104 walk found details that only existed behind an Edit button that account never gets.
6. **A payment is money that MOVED** (P2's ruling B). Do not let a payer field reopen the paid/owed
   fork that was deleted.

---

## §5 · THE WHOLE SUBTREE, NOT THE DOOR

The unit of work is every surface that shows a payment or a family's balance. Walk them and say in
the brief which change and which do not: the commitment page's payment list, the register, the
dues screens, **the family statement PDF**, the money exports, Budget vs. Actual, the season
settlement sheet, and both demo sandboxes.

**Two standing repo rules apply and are not optional:**
- **Help docs** (`CLAUDE.md`) — this changes a user-facing flow, so `lib/help-content/*.tsx` moves in
  the same unit of work.
- **The demo sandboxes** — ask both questions: *should a demo moment show this?* and *are the demo's
  existing sentences about money still true?* ⚠ The coach demo's dock lines were already written
  against an older money world and are flagged in `CLAUDE.md` as partly stale.

---

## §6 · MIGRATION

Expect one column on `rep_payable_payments` plus its FK. In the **same unit of work**:
`docs/agents/db/DATA_DICTIONARY.md` and `npm run refresh:snapshots` — `npm run check:dictionary`
fails the build otherwise. ⚠ Decide a column exists from the **snapshots or live
`information_schema`**, never from migration files.

---

## §7 · WHAT GATE 1 DELIVERS

1. **`COACH_MONEY_CENTRALIZATION_P4_PM_BRIEF.md`** — plain language, for a product owner. What a
   coach does differently, why it matters, who can see it, what it costs, and **the open questions
   with a recommendation each** — not a survey of options.
2. **The P4 section of `COACH_MONEY_CENTRALIZATION_PLAN.md`** — the engineering plan, including the
   unwind rules stated as rules.
3. **The mockup Artifact** from §1.
4. **A `TODO.md` line** pointing at the plan.

Then **stop.** Present the brief and the drawings in the conversation and wait.

---

## §8 · WHEN THE OWNER APPROVES (gate 2)

Build the **whole** approved phase in one pass (`memory/feedback_build_full_phase_first_pass.md`),
then: `npm run verify:changed` · `npm run typecheck` · `npm run check:layout -- --changed` with a dev
server up · `/simplify` then `/review` (in that order — correctness reviews the cleaned version) ·
`npm run check:demos`. Add an **Owner QA Ledger** section with a walkthrough Artifact carrying real
checkboxes (`memory/feedback_qa_walkthroughs_as_checkable_artifacts.md`).

⚠ **State honestly what was not verified.** A gate that did not run is not a gate that passed.
