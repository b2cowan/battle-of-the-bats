# Build prompt — Money centralization P2: the doors re-point

**Written 2026-08-23, the day P1's owner QA (§80) PASSED after a live walk that amended the spec
seven times. Open this in a fresh session. P1 is on dev and owner-walked; P2 is APPROVED IN
SHAPE by the plan but NOT yet given a go — this prompt is context, not approval.**

**Read first:**
1. `COACH_MONEY_CENTRALIZATION_PLAN.md` — framework §2, rulings §5, P2 shape §8.
2. `COACH_MONEY_CENTRALIZATION_BUILD_PROMPT.md` — P1's prompt, INCLUDING its amendment blocks:
   the spec drifted from the drawings in owner-ruled ways and that file records each one.
3. Owner QA Ledger **§80** (PASSED) — the walk's rulings are P2's inputs, restated in §1 below.
4. The spec artifacts: `claude.ai/code/artifact/783efa1e-…` (mockups; frame 03 = the pre-answered
   door) and `claude.ai/code/artifact/e5936cd3-…` (frames A–D, as amended — see §1).

## HOW P2 BEGINS — BLOCKING, NO CODE BEFORE IT

Present in the conversation: (1) a PM-voice summary of what each door's coach sees differently;
(2) the exact door inventory you will re-point (verified against the tree, not this prompt);
(3) the three reserved decisions, argued in words: the face-aware pre-answer mechanism (§2.2),
the edit-vs-record boundary for "Edit amount", and the final converged verb labels;
(4) any place the code forces a deviation from frames 03/04's grammar — raised, never quietly
resolved. ⚠ **If any door turns out to need a GENUINELY NEW screen state the approved frames do
not cover, DRAW it (small supplementary artifact, house style) and get a yes before building it**
— the same rule P1 ran under, and the §80 walk showed why (three of its rulings reversed drawn
or built shapes on sight). **Then WAIT for the owner's explicit go.**

## 1 · The §80-era spec amendments BINDING on P2 (do not "correct" any of these back)

- **Record lives in the Money page header** beside Import ▾ and the "?" (bare aria-labelled "+"
  in the title row's corner on phones — `CoachPageHeader actionsPhoneInTitleRow` +
  `headerActionWideOnly`). CoachTabBar has NO action slot; do not re-add one.
- **The "What happened?" dropdown defaults CLOSED** everywhere, including cold opens. Its open
  list is a viewport-FIXED anchored dropdown (absolute was clipped; in-flow resized the modal —
  both owner-rejected). No modal ancestor may gain a transform.
- **The sponsor branch is INLINE** (name · amount · brought-in-by · per-sponsor Credit-to-that-
  family $/% prefilled from the team default · note), submitting the same fundraisers POST the
  door uses. Pledges stay on Fundraising. There is NO hand-off and no `?newSponsor=` key.
- **The drive branch has a Date received field** (mig 261 `rep_fundraiser_entries.received_date`;
  writer takes `receivedDate`; register prefers it, `created_at` fallback).
- **Refusals are per-attempt**: any edit clears a stale save error (the snapshot pattern in the
  panel). Every new door must inherit this, not re-introduce sticky errors.
- **One method list** (E-Transfer · Cash · Cheque · Card · Other): dues/payout selects render via
  `DuesMethodSelect`; free-text surfaces keep `PaymentMethodCombobox` with the five as seeds.
- Vocabulary: **"player"**, never "child".

## 2 · P2 scope (plan §8, adjusted for what P1 already absorbed)

1. **Every context door opens the conversation pre-answered** (frame D: the first field arrives
   filled and closed, changeable like any field): dues drawer "Record payment" + "Pay out" ·
   drive leaderboard "Log amount" (⚠ "Edit amount" stays an EDIT of an entry — editing is not
   recording; verify what the conversation can honestly host before moving it) · payables
   bill/piece/drawer "Record a payment" (⚠ this is the PAYMENT modal, a different act than the
   record form — decide deliberately whether it becomes a conversation branch ("we paid down a
   commitment") or keeps its own door; the plan's R3 lists it as a door to re-point) ·
   Transactions scheduled-row "Record a payment" · club installment "Mark paid".
   **Pre-answering includes the branch DATA**: a door that knows the player/drive/installment
   seeds `conv` and skips its picker load where the row already supplied the answer.
2. **Per-tab toolbar Adds retire** (Transactions "Add", Payables "Add a commitment") — the owner
   confirmed the redundancy on 2026-08-23 and HELD them only until this phase pre-answers:
   ⚠ **exit criterion: context entry is not one tap slower than today**, so opening Record from
   the Payables face must pre-answer spend+owed (and Transactions face spend+paid) — decide the
   mechanism (face-aware Record, or a slim per-face door that calls `openAdd` as today's doors
   do) and state it at the gate. **Empty-state Adds STAY** (standing rule — an empty screen keeps
   its primary action and its import/paste offers). **Dues one-tap quick actions STAY, forever.**
3. **The verbs converge** — every surviving door says one thing ("Record…"), killing the
   Add / Record a payment / Record payment / Log amount / Mark paid dialects (labels are
   permission-gate keys in nav tests — run the nav-group tests).
4. **The label-only "Who paid it back" select on refunds is REMOVED** (its "A family" writes
   nothing; the real mechanism is whole-cost fronting + P4's payer-on-payment).
5. **The drive's own door gains the date** it now supports (parity with the conversation) —
   until it re-points entirely, whichever comes first per your door decision in (1).

## 3 · Traps

- The conversation lives IN `accounting/expenses/panel.tsx` and portals into the warm marker
  (`[data-coach-warm-enabled]`), never `<body>` — theme tokens inherit through the DOM.
- Doors on OTHER panels (dues, fundraisers, club) cannot call the expenses panel's functions —
  the hub's `RecordMoneyProvider` nonce is the existing wire; extend the SIGNAL (e.g. a
  pre-answer payload with branch + ids) rather than inventing a second channel. Only the
  transactions face listens today; a pre-answer payload changes who should listen — design it
  once, in the plan you present at the gate.
- Branch loaders are generation-guarded (`convLoadGen`, bumped on close via effect — never write
  refs from render-reachable functions; two eslint react-hooks/refs suppressions exist and are
  documented false positives).
- `check:layout` cannot see modals; §-ledger owner QA is the coverage — say so in the new ledger
  section. Run per phase: typecheck · focused lint · unit tests · `check:register` ·
  `check:money-report` · `check:demos` · help + demo copy re-read (the help guide's money section
  was updated for P1 on 2026-08-23 and describes the per-tab doors as still-working — P2 makes
  parts of that stale AGAIN; the coach demo tour's money steps still don't name the Record button
  — decide with the owner whether P2's release note carries that).
- Concurrent sessions: the BvA income-truth session may be editing `budget-vs-actual/` and the
  register checker; money-centralization P3 (tags) has NOT started. Shared branch `dev`; explicit
  pathspecs; re-verify everything cited here against the tree.

---

## ⚖ THE GATE OUTCOME — OWNER RULINGS 2026-08-23, BINDING ON THE BUILD

**The gate above was run 2026-08-23. Four things were raised; all four were ruled, and two of the
rulings CHANGE THE SPEC rather than confirming it.** The drawings the rulings were taken from:
`https://claude.ai/code/artifact/d92be400-1d53-4a34-91c5-6c93afc5178d` (questions A, B, C — the
approved shapes for this phase). ⚠ Where this section and §1–§3 above disagree, THIS SECTION WINS;
where this section and the P1 artifacts disagree, this section wins for P2 surfaces only.

### R-A · Context doors re-point, and their pre-answers are LOCKED (supersedes frame D)

Frame D said the pre-filled first field arrives "changeable like any field". **That was written for
the cold open and is WRONG at a context door** — the owner's case: open Jenny's row, switch the
question to "we paid for something", save, and the coach lands back on Jenny's page having filed
money against dome rentals while nothing on the screen in front of them changed. A ghost save.

**The rule, in the owner's distinction: a door that names one RECORD locks; a door that names a
SCREEN only suggests.**

- Jenny's row / a drive row / a bill's row → the identity answers are **stated, not offered**.
- The hub Record button pressed while standing on a tab → pre-answered and **still changeable**
  (a tab is a guess).

**Rendering: TREATMENT ii** (owner, against his own dropdown convention, reasoned: *"the items are
read only anyway"* — a dropdown that cannot be opened is a control lying about itself). The locked
answers collapse into ONE stated band at the top of the modal — **mockup 02's who-line returns, in
the one place it makes sense, WITHOUT its "Change" hatch.** Two lines: the answer, then the context
("Owes $252 · opened from her record"). The cold open keeps the field-as-control; it does not gain
a band. Escape from a wrong door = Cancel and reopen.

⚠ **Identity locks; ALLOCATION does not.** On a bill's Record, *which commitment* is locked and
*which installment the money lands on* stays editable ("wherever it's owed (oldest first)") — the
existing payment window's behaviour, kept.

### R-B · Record is money that MOVED. Commitments are created on Payables, and only there.

**Owner-initiated, and it reverses a piece of P1 that passed §80 on 2026-08-23.** The paid/owed
fork and its in-modal schedule editor are DELETED from the conversation. Supporting evidence, all
verified in the tree at the gate:

1. The approved framework's own list of *expectations that stay on their own screens* reads
   "budgets, **commitment schedules**, dues schedules, fundraiser definitions, the club's bills".
   Mockup 02's fork contradicted the framework text; the text is the stronger of the two because it
   is the rule the other four screens already obey.
2. The built form had **THREE** overlapping ways to produce something unpaid — the *Not yet* radio,
   clearing Date paid, and typing a future date (refuse + hop). Not one honest question.
3. It could not do the thing a Sunday-night pile most needs: **pay down a commitment that already
   exists**. From the hub's Record button that was simply unavailable.

Consequences, all ruled IN:

- **Date paid is REQUIRED** in the conversation. The "clear it and it waits as an unpaid cost" hint
  goes with it, and **the undated-unpaid cost object is abolished** — it showed as owed, never went
  overdue, never reached the next-30-days view.
- **A future date is refused** and the refusal carries the door, as it does today, except the link
  now lands on **Payables' own commitment form** with the amount, item, description, payee and tags
  carried across. ⚠ The carry-across is load-bearing — /review has already caught payee+tags being
  dropped from it once.
- **Payables KEEPS "Add a commitment".** It stops being a duplicate door and becomes a SETUP form,
  the same standing as *New Fundraiser*, *Generate installments* and *Add budget line* — none of
  which the conversation ever absorbed. ⚠ This **reverses half of §2.2 above**: only Transactions'
  plain **Add** retires. Do not "finish the job" by removing Payables' Add.
- The shared form therefore keeps its commitment mode; what is deleted is the *conversation's*
  route into it.

### R-C · One field, not a fork: "Bills you owe" is the first group in the picker that exists

The "we paid for something" branch already opens a **grouped, searchable picker** listing budget
items under their categories. Three shapes were drawn (checkbox / one field / radio fork). **RULED:
the one field (C2).** The picker gains a first group — **"Bills you owe"**, each row carrying what
is still owing — above Tournaments, Facilities and the rest.

- **Nobody classifies anything before typing.** This is R2 applied to the branch body: asking "is
  this a payable?" is asking which of OUR concepts it is, which is the habit the project exists to
  break. Owner: *"pretty clear, and given it is a search dropdown I am not very concerned with how
  long it can become as the user can type to filter it down."*
- **Picking a bill visibly changes the form** — three signals, all required: Description disappears
  (the bill has one), the installment row appears, and the consequence line names the bill and its
  new balance.
- **The accepted risk, recorded:** one field, two outcomes. A coach meaning to log a new cost can
  pick the bill above it. Mitigation is the consequence line plus undo; C1 (the checkbox) stays the
  fallback if the QA walk shows it biting.
- A bill's own **Record** button opens this same field, **locked** to that bill (R-A).
- Commitments with nothing owing are not offered.

### R-D · Everything else settled at the gate

- **The club installment keeps its ONE TAP** and does not open the conversation — §2.1 above was
  wrong to list it. The build prompt's own §2.2 already ruled club settle must not get slower, and
  it is fieldless by design. **It converges by NAME only: "Mark paid" → "Record as paid"**, the
  words the dues one-tap already uses, because it genuinely records a payment.
- **No ninth sentence in the chooser.** R-C carries the case instead. The eight stay eight.
- **The hub Record button is TAB-AWARE ON EVERY TAB** (owner ruling): Player Dues → *a family paid
  their dues*; Fundraising → *fundraiser money came in*; Club → *we settled up with the club*;
  Transactions → *we paid for something*; Payables → *we paid for something*, bill-picker open;
  Overview → unanswered. All changeable, per R-A's suggests-vs-locks rule.
- **Verbs:** every door that opens the conversation says **"Record"**. Acts that ask nothing keep a
  longer name that says why — **Record as paid** / **Record rest as paid** (dues, club). Edits say
  **Edit**. The modal stays *Record money*; the save button stays **Save** (2026-08-16 ruling).
- **Edit forms stay in place and become edit-only** — the dues drawer panel and the drive row
  editor lose their add entry point and are titled as corrections. The drive's editor **gains Date
  received**, so the two doors can express the same facts.
- **"Who paid it back" is removed** from the refund branch (label-only field; the column and the
  API keep accepting it so existing values survive).
- **Nav-group tests do NOT key off these labels** — verified at the gate; they guard nav item names
  only. The mobile money UAT scenario DOES drive Transactions' "Add" twice and must be re-pointed
  at the header's "+".
- **Rider found at the gate, fix it in this pass:** a back-dated drive entry that later gains a
  family credit through an edit stamps that credit with TODAY rather than the day the money
  arrived — a mig-261 loose end.
- **Help docs are already stale from P1** and the docs pass fixes both faults: two sentences still
  say Record sits "at the end of the Money tab row" (it moved to the page header mid-walk), and the
  "nothing old went away" notes list per-tab doors this phase retires or renames.
