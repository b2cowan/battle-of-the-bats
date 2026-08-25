# Build prompt — One Conversation for Money (coach money centralization)

**Written 2026-08-21, after the owner approved the framework AND took all three rulings the same
day. Open this in a fresh session. The spec is the mockup artifact; this prompt carries the
rulings, the code map, and the traps discovery found. Re-verify everything against the tree —
this repo's plans have been wrong before and this one claims no exemption.**

**Read first:**
1. `COACH_MONEY_CENTRALIZATION_PLAN.md` — the decided framework (§2), rulings (§5), discovery (§7).
2. The spec artifact: `https://claude.ai/code/artifact/783efa1e-98e1-4c36-8083-f3e568f46844`
   — **an approved mockup is the spec**; where code and mockup disagree, raise it, never quietly
   resolve it. ⚠ Standing owner rule 2026-08-21: a picture owes FUNCTIONALITY, not pixels.
   ⚠ **AMENDED BY THE OWNER 2026-08-22 (P1 gate): the "How" method field is a DROPDOWN, not
   mockup 02's five-segment pill row** — and that is the standing convention going forward for any
   form field choosing one value (logged in `memory/design_decisions.md`). The reporting-filter
   pill convention (Payables rebuild §7) is untouched; radio rows with per-option sub-text (the
   paid/owed fork, "who actually paid it?") are unaffected. Do not "correct" the build back to
   the drawn segmented control.
   ⚠⚠ **AMENDED AGAIN AND APPROVED 2026-08-22 (owner: "agreed, go for it" — this was also the P1
   go): the first question is a FIELD ON THE ONE FORM, not a chooser page.** Supplementary spec
   artifact (frames A–D, approved):
   `https://claude.ai/code/artifact/e5936cd3-6028-4e6f-80e2-7c44434493bb`
   - Frame A: opened cold, the "What happened?" dropdown starts OPEN — the eight sentences, two
     groups and live hints of mockup 01 are its open state. **Mockup 01's chooser-page rendering
     is superseded**; its content (sentences, groups, hints) is binding as drawn in frame A.
     ⚠ **THE AUTO-OPEN HALF OF FRAME A IS SUPERSEDED (owner, §80 walk 2026-08-23): the dropdown
     defaults CLOSED on a cold open** — seen live, eight options bursting open read heavier than
     the drawing. The list's content, groups and hints remain binding. ⚠ And the open list is a
     REAL floating dropdown — viewport-fixed, anchored to the field's measured rect — after two
     rejected shapes the same walk: absolute-positioned it was CLIPPED by the modal's scroll
     region; in-flow it RESIZED the modal ("opening a field must not change the modal's size").
     Fixed positioning escapes the clipping; scroll/resize close it; no modal ancestor may gain
     a transform or it re-clips.
   - Frame B: the chosen sentence sits at top as an ordinary field; **mockup 02's who-line and
     its "Change" escape hatch are superseded** — the field is the change control.
   - Frame C: switching the first field mid-entry KEEPS amount/date/how/note (visibly marked) and
     RESETS the branch's own questions — never pre-fill a branch question across a switch.
   - Frame D: context doors (P2) open the form with the first field pre-filled and closed.
   - Mockup 02's branch bodies, the paid/owed fork, and mockups 04/05 are unaffected.
   ⚠ **AMENDED A THIRD TIME (owner, mid-§80-walk 2026-08-23): the Record button lives in the
   Money PAGE HEADER beside Import ▾ and "?", NOT in the tab row mockup 05 draws.** The tab-row
   build crowded a phone's strip to two visible tabs. On phones Record collapses to a bare "+"
   (aria-labelled — an owner-ruled exception to "the lime primary keeps its words") and the
   header's action row now renders at phone width for it, while Import keeps its rule-11
   wide-only hiding per-action.
3. `COACH_PAYABLES_REBUILD_PLAN.md` §7 — the reporting-filter convention the tag pill must follow.

---

## HOW EVERY PHASE BEGINS — BLOCKING, NO CODE BEFORE IT (owner-set expectation 2026-08-22)

Before writing any code for a phase, present in the conversation:

1. **A plain-language summary of what this phase changes** — what the coach sees and does
   differently, PM voice, per `AGENCY_RULES.md`'s blocking PM-summary rule.
2. **Exactly which spec frames it executes**, by number. The map:
   - **P1** → Mockup **01** (the opening question + Record button) and **02** (the dues branch;
     the paid/owed cost branch).
   - **P2** → Mockup **03** (context doors open the conversation pre-answered) + the verb/label
     convergence named in the plan §3.
   - **P3** → Mockup **05**'s ruled tags frame (counted pill; always-visible filtered total).
   - **P4** → Mockup **04** (payer on a payment, as ruled).
3. **The branches P1 needs that have NO drawn frame** — the club settle confirm, the payout
   branch, and the sponsor hand-off. State in the summary exactly what each will look like,
   following the drawn frames' grammar (who-line · shared fields · consequence line). If any of
   them turns out to need a genuinely new screen state, DRAW it (small supplementary artifact,
   same style) and get a yes before building it.
4. **Any place the code forces a deviation from a frame** — raised for a ruling, never quietly
   resolved. An approved mockup is the spec; it owes functionality, not pixels.

**Then wait for the owner's explicit go.** Repeat this gate at every phase boundary — a go for P1
is not a go for P2.

## 0 · The rulings, binding (owner, 2026-08-21)

1. **A payment learns who paid it — YES** (P4, its own phase, never in passing).
2. **Payables tab STAYS.** *"…once this is done if the new forms make me feel like we can retire
   payables we can re-explore but having a place to log planned future expenses still makes some
   sense to me."* The fold is deferred and OWNER-LED. Do not take it on the way past, and do not
   remove the word "Payables" from anything.
3. **Tags are KEPT — the retire question is closed.** The purpose, in the owner's words: items for
   tournament fees/deposits, **tagged with the tournament name, later filtered for what that
   tournament cost.** A tag is the OCCASION label an item can't express. The filter converts to
   the §7 counted pill and **a tag-filtered view always shows its TOTAL.**

**Standing constraints:** no sixth door; no model change outside P4's one field; "one row, one
source" on the register is untouched; club requests are correspondence and unchanged; drive
creation / dues schedule generation / budget lines stay on their screens; phone table presentation
is a SEPARATE later session — do not fix it here; empty states keep their import/paste offers.

## 1 · The code map (verified 2026-08-21; re-verify)

- **The shared form already exists**: `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx`
  (~4.5k lines) exports BOTH `TransactionsPanel` and `PayablesPanel` — one record modal
  (kind pills + refund tick + schedule editor), one Record-a-payment modal, one importer, one tag
  library. **GROW this form into the conversation; do not fork it.** The future-date → "Add it as
  a commitment instead" behaviour is the paid/owed fork's ancestor — keep its carry-across.
- **Every branch submits through an EXISTING writer** — the conversation adds NO new write paths
  (P1–P3): expenses POST/PATCH (cost/commitment) · `expenses/[expenseId]/payments` (payable
  payment) · `players/[playerId]/dues-payments` (dues receipt) · `players/[playerId]/dues-payouts`
  (payout) · `fundraisers/[fundraiserId]/entries` (drive amount) · `fundraisers` POST (sponsor —
  see §2.4) · `allocations/[splitId]/installments/[installId]` PATCH (club settle).
- The hub: `accounting/page.tsx` (tab bar + header). The Record button lands in the hub header
  beside the existing `Import ▾` menu (the page-actions rule: hub-wide actions in hub chrome).
- Context doors to re-point in P2: dues drawer "Record payment" + "Pay out" + the pencil-edit,
  drive leaderboard "Log amount"/"Edit amount", payables bill/piece/drawer "Record a payment",
  Transactions scheduled-row "Record a payment", club installment "Mark paid".

## 2 · Traps that must be resolved DELIBERATELY (each found in the code, not guessed)

1. **Three method vocabularies, one drawn list.** The spec draws one list (E-transfer · Cash ·
   Cheque · Card · Other). But dues payments validate a server-side enum with **no `card`**
   (a CHECK constraint from mig 232), payables methods are free text, club requests offer Card.
   Recommendation: a small migration adds `card` to the dues CHECK (+ DATA_DICTIONARY + snapshot
   refresh in the same unit of work, per repo rule); payables keeps accepting free text under a
   suggestions combobox only if the shared control still offers the five. Decide once, in P1,
   and state it in the plan.
2. **Club settle must not get slower.** Today it is ONE TAP ("Mark paid" — server derives amount,
   date, description; the write takes no fields, and there is nowhere to store a method or note on
   an allocation installment). The club branch is therefore a pre-answered CONFIRM (pick the owed
   installment when opened cold; confirm when opened from the row) — **fieldless in P1**, no model
   change to store method/note. If that ever changes it is an owner question, not a build call.
3. **Dues quick actions survive.** "Record as paid" / "Record rest as paid" (one-tap, confirm
   dialog) are the fast path beside the full form — the conversation replaces the FORM, not the
   shortcuts.
4. **The sponsor branch is a hybrid.** A sponsor's money is recorded at the sponsor's creation
   (kind=sponsor, status=received, amount) — so "A sponsor came through" opens the existing
   sponsor form pre-set, it does not get a new writer. A PLEDGED sponsor is an expectation and
   stays out of the conversation.
   ⚠⚠ **THE HAND-OFF HALF IS SUPERSEDED (owner UX ruling, §80 walk 2026-08-23):** built as a
   hand-off it navigated the tab underneath, opened a DIFFERENT modal, and re-asked the question
   the coach had just answered. The sponsor now records INLINE in the conversation — name ·
   amount · brought-in-by (team's standard share) · note — through the SAME creation POST the
   Fundraising door submits. "No second sponsor writer" was about writers, not about which form
   calls the one that exists. Pledges still stay on Fundraising, and the branch says so.
5. **Whole-cost fronting stays creation-only until P4.** "Paid by — a family, out of pocket" is
   settable only when a cost is created (the single out-of-pocket door that mints the
   reimbursement credit atomically). P1 keeps that; P4 adds the per-PAYMENT payer.
6. **The label-only "Who paid it back" select on refunds** (its "A family" creates nothing) is
   REMOVED in P2 when the refund branch lands — the real mechanism sits in the same conversation,
   and two fields wearing one sentence where only one moves money is the trap the plan names.
7. **The tag pill uses the shared dropdown family** (`MultiSelectDropdown` et al.) — §7's own
   instruction: one family, one look, do not hand-roll a fourth. Payables' existing
   "vs {tag}: N, $X" summary is the seed of the always-visible filtered TOTAL the ruling requires;
   Transactions' face must gain the same.
8. **The chooser's live hints read from data the hub already loads** (owing counts, club overdue,
   family credit) — check the hub summary/read routes before adding any new probe; a per-open
   fan-out of fresh GETs is a regression.
9. **Guard tests that will notice you:** `coach-history-endpoint-guard` (no coach page/route may
   learn a year), the nav-group tests (labels are permission-gate keys — the Record button is hub
   chrome, NOT a nav item), and the money one-arithmetic guards (`check:register`,
   `check:money-report`). Run them per phase.
10. **The sweep cannot see any of this** — the conversation lives in a modal; `check:layout`
    renders pages. Owner QA is the coverage; say so in the QA ledger entry rather than claiming
    sweep coverage.

## 3 · Phases (each: typecheck · focused lint · unit tests · check:register · check:money-report ·
check:demos · help/demo re-read · QA ledger section)

- **P1 — the conversation.** The opening question (eight sentences, two groups, live hints), the
  dues-receipt / drive-amount / club-settle / payout / sponsor-hand-off branches added to the
  shared form, the hub-level Record button, the method decision (§2.1). Exit: every branch writes
  through its existing writer; a coach can empty the Sunday-night pile from one door; the register
  derives each record exactly as if logged from its home tab.
- **P2 — the doors re-point.** Every context door opens the conversation pre-answered ("Change"
  escape hatch included); per-tab toolbar Adds retire; the verbs converge; "Who paid it back"
  removed; the paid/owed fork replaces the kind-switch nudge. Exit: no money form exists outside
  the conversation except the sponsor/drive/schedule SETUP forms; context logging is not one field
  slower than today.
- **P3 — tags + debt.** Chip rows → counted pill on both faces with the always-visible filtered
  total; the dues Add-Credit picker stops offering the two types the API 400s; the payout sheet's
  placeholder loses the guardian name (08-13 PII ruling, applied to the sheet it missed); the two
  stale BvA tag-filter comments go.
- **P4 — the payment learns its payer (ruled YES).** One nullable `paid_by_player_id` on the
  payables payment record (migration + dictionary + snapshots, same unit of work). When set: no
  ledger entry, the family's reimbursement credit grows — the exact mechanism whole-cost fronting
  already uses (`restateReimbursementCreditFromPayments` restates from payments; extend it to
  per-payment payers). **Acceptance test: edit and delete of such a payment unwind the credit
  exactly, and the consequence line names the family and the dollars before saving.** Undo (P2 of
  the payables rebuild) must fork correctly on these, as it already does for out-of-pocket
  commitments.

## 4 · Aftercare the phases carry

- **Help docs**: the Money guide describes five ways to log money; it will be wrong the day P1
  lands. `/docs` in the same unit of work.
- **Both demo sandboxes are PUBLIC on prod**: the coach demo's money vocabulary changed once
  already this month and the standing CLAUDE.md warning says exactly this surface goes stale
  silently. Re-read dock lines + tour steps each phase; `check:demos` proves rendering only.
- **The Payables rebuild is dev-only** — this stacks on it; the §64 release check (export columns,
  demo story) rides the SAME promote. Coordinate the release notes.
- The owner re-explores the Payables fold after living with the forms — leave the door open in
  code shape (the two faces already share everything; do nothing that makes a later fold harder).
