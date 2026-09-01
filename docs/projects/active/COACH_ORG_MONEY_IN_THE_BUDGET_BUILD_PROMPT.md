# Build prompt — Club money in the team's plan (the money-in ask + the three report gaps)

**Owner ratified D1–D5 as recommended, 2026-08-30.** Plan of record:
`COACH_ORG_MONEY_IN_THE_BUDGET_PLAN.md` (§0 drift register · §3.2/§3.2c the ask · §4 Scheduled ·
§5 what a coach sees · §6 the rules · §7 the ratified decisions). PM brief beside it. This is a
BUILD session: full scope in one pass, per the standing first-pass rule.

---

## 1 · ⚠⚠ THE MOCKUP-FIDELITY GATE — ITEM ONE, BEFORE ANY CODE

The approved mockups are **binding**:
https://claude.ai/code/artifact/7edf39c2-f2f8-4a3c-8b5f-ec9e4ca57389 ("New Money, or Money Back").
Open it, walk every frame, and build TO it. The approved specimens, by frame:

1. **Frame 1** — the request window's *From the club* branch: the required
   **"New money, or money back?"** dropdown (two sub-lined options, exact copy as drawn), then the
   **same shared category+item search box** with its list switched by the answer (in-side words for
   new money, spending words for money back), create door = the picker's own inline
   `+ Add "…" to your list`. Plus the **phone version** (two stacked fields, closed dropdowns).
2. **Frame 2** — the request list: meaning + filing printed on each row's sub-line
   ("New money · Grants · Association support"), **"File it" / "Change"** on approved rows opening
   a small filing dialog (the ask + the picker, NOTHING else); the record window itself stays
   locked once answered (pencil/eye unchanged).
3. **Frames 3 & 4** — the **whole-screen before/after** of Budget vs. Actual (Statement): a
   new-money arrival becomes its own revenue row with a **dash** in Budget (no budget line is ever
   created); a money-back arrival keeps today's netting with brackets; season net identical across
   the pair. This before/after is a specimen, not an illustration — the built report must produce
   the AFTER frame's behavior.
4. **Frame 5** — Months, Scheduled lens: the unpaid club installment in its due month,
   **remainder-only**, under its bill's own filing; pending *From club* stays exactly as shipped
   ("Asked of the club", No date yet).
5. **Frame 6** — the Money hub's Budget card adopting the report's headroom arithmetic.

⚠ One vocabulary correction to the frames, superseded by the One-Ledger fold (owner QA §119,
2026-08-29, AFTER the mockups were drawn): the money hub's tab is now **Ledger** — the frames'
incidental mentions of "Transactions"/"Payables" read as Ledger. The frames' substance is
unaffected. Any other divergence you believe necessary gets argued in the summary BEFORE building
it differently, not discovered after.

## 2 · The ratified decisions (owner 2026-08-30) — build all five

- **D1** — build the ask. Required on create for *From the club* requests; the meaning is the
  coach's, never derived. Existing approved requests keep the reimbursement reading they report
  under today (NULL meaning = legacy = today's behavior); **no backfill, no report restatement.**
- **D2** — NO named "Club costs"/"Club funding" synthetic rows. Unfiled club money keeps landing
  in the existing "Not itemized"/"No category" rows.
- **D3** — the classification (meaning + filing) stays editable after the club answers, via the
  row's own small dialog; the record window stays read-only once reviewed.
- **D4** — Months vocabulary as drawn: a new-money arrival joins the revenue band under its filed
  name (its own subject; "the club" named on the row); **"Repaid by the club" keeps meaning only
  money back; "Asked of the club" stays pending-only.**
- **D5** — the hub Budget card's headroom adopts the report's arithmetic **in this build** (club
  costs subtract, netted money-back returns; new money is revenue and never enters the cost
  figure). Its fine print says what it counts.

## 3 · Scope, precisely

1. **Schema:** one new nullable meaning column on the org payment-requests table
   (`funding` | `reimbursement`; NULL = legacy). ⚠ Data dictionary + `npm run refresh:snapshots`
   in the SAME unit of work (`check:dictionary` gates it). No other schema change — the filing
   columns (mig 250) already exist and are reused.
2. **The Club tab:** the ask on the request window's *From the club* branch (Frame 1); the
   side-switching picker; the meaning printed on rows; File it/Change on approved rows (Frame 2).
3. **Budget vs. Actual route:** an approved *From club* request routes by its meaning — funding →
   the revenue side (category+item, in-side), reimbursement (and NULL) → today's netting,
   unchanged. Months revenue-band placement per D4. **The whole-screen AFTER frame is the spec.**
4. **Scheduled:** unpaid club allocation installments join the expense-band Scheduled feed,
   remainder-only, same category identity as their bill's filing (plan §4). Pending behavior
   unchanged.
5. **Hub headroom** (D5): the Money hub summary's headroom includes club money exactly as the
   report's own headroom does — one arithmetic, not a third. ⚠ Do NOT route club records through
   the settlement math (`expenseTotals` reads neither club table; keep it that way — it sets every
   family's refund).
6. **Help docs, in scope:** the Club-screen guide's paragraph teaching the forced-reimbursement
   design ("Both pick from your spending words even when the money is coming in") is rewritten for
   the ask; the Months guide's "Money back & reimbursements" / "Asked of the club" copy gains the
   new-money case. Keywords/searchText updated.
7. **Demo, in scope (not a footnote):** the coach demo's club money is entirely unfiled and the
   tour lost its club sentence in the prose-trim. Seed: the $900 allocation FILED, the $180
   *From club* request answered **money back** (filed against the permit cost), and one new-money
   arrival (a modest club grant, filed in-side) — then **re-read the whole coach-money narration**
   (dock lines + tour steps) per the CLAUDE.md demo rule; it is three-plus releases stale and this
   build changes the story again. Assert the seeded states in `check-demo-coach.mjs`. ⚠ The demo's
   club money is credited to nobody and touches no family's bill — keep it that way.

## 4 · The rules — by pointer, verbatim, no restating

- **Plan §6, all eight** — never both · **NOTHING EVER TOUCHES A PAYMENT SCHEDULE OR ANYONE'S
  DUES** · never guess a reversal (the ask satisfies it; NULL = legacy) · negatives shown in
  brackets and never "under budget" (already guarded — do not regress it) · cost-side-only picker
  except this one case · `ON DELETE SET NULL` · re-filing moves no money · no backfill.
- **The refund mechanics belong to `COACH_MONEY_BACK_ON_A_COST_PLAN.md`** — inherited, never
  re-specified. The money-back answer changes NOTHING about how a reimbursement behaves.
- **Untouched, on purpose:** the `sponsorship` kind (its own TODO), the Record conversation's
  sentences (the ask lives on the Club tab records — boundary argued in plan §0), the club
  installment's one-tap "Record as paid" (ruling R-D), season-scoping/close-out blocking/request
  locking, phone money TABLES (forms only), the Categories view's committed-vs-paid gap (out of
  scope), and money tags on club records (there are none).

## 5 · The ground moved after the mockups — re-read before touching

This build goes AFTER the One-Ledger fold (§119, complete) and DURING the forms-review walk
(started 08-28; sponsorships ruled). Before editing the Club tab or the BvA/Ledger surfaces,
**re-read them as they are** — commits `f819e869` and `48f5c8a5` touched this build's files
(Payables tab retired, object = BILL, dead columns dropped in mig 270). Plans have been wrong
here before; the code outranks every document including this one. ⚠ The forms review knows this
build reworks the request window's money-in half (its §5 carries the hand-off) — check its gap
register for rulings landed since, and leave its items (the "New" title, the "What is this?"
collision, the false unfiled-bill sentence, the two-label split) to it unless a ruling says
otherwise.

## 6 · Verification & closure

- `npm run verify:changed` (spelling gate: **installment**, two Ls, everywhere) · `npm run
  typecheck` (shared modules move) · the money guards: `check:money-report`, the register-balance
  identity if the register wording changes, `check:budget-item-fold` untouched-to-the-cent.
- Re-measure the QA fixture (`qa-money-lab` / QA Mid Season U14, `scripts/db-query.mjs --dev`):
  after the build, the hub card and the report agree; the plan's §1 table gets today's figures.
- Migration applies to DEV only; prod rides the release queue (264 held + 268–270 already owed —
  note it in the release record, do not promote).
- New Owner QA ledger section (note it sits on top of unwalked §49); TODO.md entry updated;
  the plan's status line stamped BUILT-on-dev with the commit hash; memory updated.
- Dev server restart before handoff (new column + shared modules).
