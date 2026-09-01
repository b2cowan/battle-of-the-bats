# Planning prompt — Club money belongs in the team's plan (re-validation session)

**Owner-approved 2026-08-15; prerequisites now met; session authorized 2026-08-28.** This opens the
project recorded in `COACH_ORG_MONEY_IN_THE_BUDGET_PLAN.md` — but ⚠⚠ **read the header of this
prompt before reading that plan, because the plan is thirteen days and six money releases old and
this session's first job is to find out which of its sentences are still true.**

**This is a PLANNING session. Write no product code.** Output is a drift register, an updated plan,
refreshed mockups as a Claude Artifact, and — only after the owner has walked the mockups — a build
prompt for a fresh session.

---

## 1 · What is already DECIDED — do not re-open, do not re-derive

The design was approved by the owner on 2026-08-15/16 and the rulings are binding. They live in
`COACH_ORG_MONEY_IN_THE_BUDGET_PLAN.md`; the short form, so you know what you are guarding:

1. **Club money OUT (allocation installments, approved *Pay Org*) files as a COST** against the
   team's own plan, defaulting to a synthetic **Club costs** report row.
2. **Club money IN (approved *Request from Org*) is the one real decision, and the COACH makes it:**
   new money → a funding line (default **Club funding** row); money back → files against the cost
   line it repaid, as a reversal. A grant and a reimbursement arrive as the same transaction and
   mean opposite things; forcing one reading would be wrong about half the money.
3. **The meaning is asked FIRST, then a short list** (two steps, never one long grouped dropdown),
   and the new-money branch has **ONE "+ New funding…" door, never one per kind**.
4. ⚠⚠ **NEITHER CHOICE EVER TOUCHES ANYBODY'S DUES.** The rule most likely to be broken by
   accident; the plan's §3.2 has the reasoning.
5. **Pending requests never enter any plan surface.** Unpaid-but-billed rides the existing
   **Scheduled** lens — no new toggle, no second vocabulary.
6. The full rule set a build must hold — never-both, default-to-the-bucket-never-guess-a-reversal,
   brackets not minus signs, negative lines shown not blocked, one row never two, no row labels,
   reversals dated when they happened, no backfill, re-filing moves no money, delete never takes a
   money record — is plan §6 and §3.2d. **Point at it; do not restate it** (it has already been
   corrected three times for restating things).

⚠ Also settled elsewhere, and not this session's to touch: the reimbursement mechanism itself
(`COACH_MONEY_BACK_ON_A_COST_PLAN.md` — built; this plan's Reimbursement branch HANDS OFF to it),
the money-in taxonomy (category+item on both sides, one picker), and the `sponsorship`-kind
collapse (its own TODO entry — do not fix in passing, even though this work will stare right at it).

## 2 · Why re-validation and not a straight build — what shipped since approval

The plan was written against the product of 2026-08-15. Since then: the **Club tab merge** (§43 —
Allocations + Payments are now ONE Club tab with a standing band), the **Payables rebuild** (§64 —
every commitment is installments + payments; the legacy paid columns are dead), **money
centralization P1–P4** (§80/§87/§104/§116 — one Record conversation, the tags pill, payer on a
payment), **BvA monthly income truth** (§85/§101 — the Months grid is now the season's cash
statement with opening/closing balance columns), and the **commitment page** (§114 — a bill edits
itself on its own page). Every screen this plan names was rebuilt at least once.

**Treat every concrete claim in the plan as a hypothesis.** Known drift suspects — verify each
against the CODE and the live dev screens, not against any plan:

1. **Plan §5 addresses screens that no longer exist as named.** "Org Allocations gains a field…",
   "Payments gains the same field…" — both are now the one Club tab. Where the filing control
   actually lives is a design question the mockups must answer fresh.
2. **Part of the Club form inventory may already carry a filing question.** The forms-review
   prompt's inventory (2026-08-24) lists a *"What was this bill for?"* control on the Club tab.
   Establish exactly what filing already shipped with the club-money-screens work (§35) and what
   this project still owes — the plan's §1 gap table is a 2026-08-15 measurement and must be
   re-measured before the PM brief repeats it.
3. **BvA already nets club `charge_to_org` refunds into cost cells** (BvA project, code-verified
   08-23), and the Months grid now shows cash on both sides. The plan's "club money appears in
   neither plan surface" table is stale in at least one direction. Re-measure the QA fixture and
   state the CURRENT gap, with figures.
4. **The two-step ask must be re-worded before it is drawn.** The plan's §3.2c titles it **"What is
   this?"** — that phrase was MOVED by centralization P2 onto the recording form's item/bills
   picker, and the forms-review session already carries "two meanings one tab apart" as a defect.
   Do not mint a third instance; choose words that collide with nothing (see §5 below).
5. **The filing control's shape must obey the post-approval conventions:** one-value fields are
   dropdowns (owner 2026-08-22; radio-rows-with-sub-lines exempt — argue which this is, don't
   assume); a door that names one RECORD locks (ruling A); a filter/count is a promise about the
   list (2026-08-26). All three post-date the approved mockup.
6. **The boundary with the Record conversation needs one paragraph of homework.** Centralization's
   line is *money that MOVED = the conversation; expectations stay on their screens*. Filing a club
   bill is CLASSIFICATION of money the club already recorded — argue from the code that it belongs
   on the record (the Club tab / the bill's row), not as a ninth sentence in the conversation, and
   flag it loudly if you conclude otherwise, because that would re-open a settled framework.
7. **The register derives club rows ("one row, one source") and P4 taught three readers to ask
   "did a family pay this?" per payment.** Verify where allocations/requests actually live in the
   data and how they reach the register and settlement BEFORE proposing wiring; the centralization
   memory records `expenseTotals()` as the highest-risk reader (it sets every family's refund).
8. **The plan's §7 open re-verification stands:** now that an unbudgeted cost is its own flagged
   row with a dash, decide from the BUILT report whether **Club costs / Club funding** should BE
   that mechanism rather than a parallel bucket. Decide by reading the screen, not the paragraph.
9. **Scheduled lens claims.** The plan quotes `MonthGridInput.scheduled`'s docstring and asserts
   payables feed it — re-verify against the post-rebuild code, and check what the Categories view's
   committed-vs-paid gap looks like NOW (the BvA work may have moved it).

## 3 · The questions this session must answer (the drift register's spine)

For each: what the plan says → what the product does today → stands / stale / reversed → what the
updated plan should say. At minimum cover: the §1 gap table (re-measured), §3.1 filing mechanics,
§3.2c wording and shape, §3.2a's one-door create flow against the shipped category+item picker,
§4's Scheduled claims, §5's five what-a-coach-sees points (rewritten for the merged Club tab), §7's
bucket-vs-flagged-row question, and the §9 follow-through list (help copy and demo state have both
moved since 08-15 — the demo's club/money narration is flagged as three releases stale; say what
THIS project adds to that debt and what the build must seed, per the CLAUDE.md demo rule).

## 4 · Deliverables, in order

1. **The drift register** — one table, every §3 row, code-verified. This is the session's spine;
   the owner argues with this, not with prose.
2. **The updated plan** — edit `COACH_ORG_MONEY_IN_THE_BUDGET_PLAN.md` in place: rulings stamped
   as standing, stale sections rewritten against today's screens, the 08-15 mockup link demoted to
   "superseded — reasoning of record". Update the PM brief with the re-measured figures.
3. **Fresh mockups, as a Claude Artifact, in the house style** (standing rule — always an
   Artifact). The 2026-08-15 artifact predates the Club tab merge, the category+item picker, and
   the BvA cash statement; treat it as reasoning, not as a spec. Draw at minimum: the filing
   control on the merged Club tab (cost side and the two-step money-in ask, with the "+ New
   funding…" door open), the BvA Categories view showing a Club costs row / a Club funding row /
   a reversal netted into an existing row with brackets, the Months grid with an unpaid
   installment riding Scheduled, and **one whole-screen before/after** of Budget vs. Actual so the
   owner sees the report change in context, not just the new rows. Include a phone frame for the
   filing control. Stamp rulings in place as they are taken.
4. ⚠ **Then STOP and hand it to the owner's walk.** He walks the register and the mockups; his
   amendments are the spec.
5. **After ratification only:** the build prompt (fresh session), with the mockup-fidelity gate as
   its item ONE naming the approved frames — including the whole-screen before/after — per the
   standing mockup rule. The build prompt must also carry: migration expectations (a link from club
   records to the plan is new schema → data dictionary + snapshots same unit of work), the §6 rule
   list verbatim by pointer, and the help/demo follow-through as in-scope work, not a footnote.

## 5 · Coordination with the forms-review session (may run in parallel)

The forms-review planning session (`COACH_MONEY_FORMS_REVIEW_PLANNING_PROMPT.md`) may be running
concurrently. The boundary, so the two do not trade defects:

- **This session designs against the SHIPPED centralization grammar** — the eight-sentence
  conversation, the dropdown convention, the Record vocabulary — never against anything the forms
  review might recommend; its output is not yet ruled.
- **Do not name any new control "What is this?"** — that phrase is the forms review's known
  collision; adding a third meaning while they untangle two makes both sessions wrong.
- **Existing-form defects you find on the Club tab go to the forms review's gap register**, noted
  as found-by-this-session — do not fix or re-design them here. Conversely, expect the forms
  review to evaluate the Club forms AS THEY ARE; mark in your drift register which of those
  surfaces this project will rework, so their recommendations aren't wasted polish.
- **The BUILDS are sequenced even though the planning is parallel:** whichever build goes second
  re-reads the first's changes to the Club tab before touching it.

## 6 · Standing rules this session must not reverse on the way past

- Every rule in plan §6, §3.2, §3.2d, §3.4 — they are owner rulings, not suggestions.
- The `sponsorship` kind is left alone (owner 2026-08-16); the redundancy is accepted and has its
  own TODO entry.
- No backfill of historic allocations, ever.
- Payables' tab fold is deferred and owner-led; phone money TABLES are their own sequenced session
  (the filing control's phone layout is fair game; card-table reflow is not).
- Nothing in this project reaches the dues schedule. If a mockup so much as implies it, redraw it.

## 7 · Links

- The approved plan + brief: `COACH_ORG_MONEY_IN_THE_BUDGET_PLAN.md`,
  `COACH_ORG_MONEY_IN_THE_BUDGET_PM_BRIEF.md`.
- Superseded-suspect mockup (reasoning of record):
  `claude.ai/code/artifact/069a4d63-d00a-4277-9888-4e2cb08f2778`.
- The refund mechanism inherited here: `COACH_MONEY_BACK_ON_A_COST_PLAN.md` (built — verify as
  shipped, not as planned).
- The taxonomy both sides share: `COACH_MONEY_IN_TAXONOMY_PLAN.md`.
- The framework this must fit: `COACH_MONEY_CENTRALIZATION_PLAN.md` (§2 expectations-vs-events,
  §5 the rulings) and the P2 gate outcome in `COACH_MONEY_CENTRALIZATION_P2_BUILD_PROMPT.md`.
- The sibling session: `COACH_MONEY_FORMS_REVIEW_PLANNING_PROMPT.md` (its §4 inventory lists the
  Club forms as of 08-24).
