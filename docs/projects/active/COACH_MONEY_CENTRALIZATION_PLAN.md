# Coach Money Centralization — One Conversation for Money

**Planning session held 2026-08-21 (owner-called; brief: `COACH_MONEY_CENTRALIZATION_PLANNING_PROMPT.md`
and §9 of `COACH_PAYABLES_REBUILD_PLAN.md`). Output: a decided framework + mockups. NO CODE WAS
WRITTEN. ✅ ALL THREE RULINGS TAKEN BY THE OWNER the same day (§5) — the mockups are now the spec
and the build prompt exists: `COACH_MONEY_CENTRALIZATION_BUILD_PROMPT.md`.**

Mockups (Claude Artifact — **the approved spec**, rulings stamped in place):
`https://claude.ai/code/artifact/783efa1e-98e1-4c36-8083-f3e568f46844`

**⚠ Spec amended at the P1 gate (owner, 2026-08-22, approved with the P1 go "agreed, go for it"):**
1. **Form fields choosing one value are DROPDOWNS**, never segmented pill rows (standing
   convention, `memory/design_decisions.md` 2026-08-22) — supersedes mockup 02's "How" pill row.
2. **The first question is a field on the one form, not a chooser page** — supplementary spec
   artifact, frames A–D: `https://claude.ai/code/artifact/e5936cd3-6028-4e6f-80e2-7c44434493bb`.
   Cold open = the dropdown starts open (mockup 01's content is its open state); the who-line and
   "Change" hatch are superseded by the field itself; switching mid-entry keeps
   amount/date/how/note and resets branch questions; context doors pre-fill the field.
   Mockup 02's branch bodies and mockups 04/05 unaffected.

---

## 1 · The question and how it was answered

The owner: *"I still feel like I have to go to too many places to log different transactions, and as
a user it feels confusing."* Mid-session the owner widened it beyond doors-and-wording to the
framework itself: should Fundraising be where fundraiser money is logged, or should the Transactions
ledger be where **all** actual transactions are recorded, mapped to their context?

Discovery was done from the code, not from plans (12 parallel readers + an adversarial verify pass
over every load-bearing claim, 2026-08-21). Field-by-field findings live in §7. The owner approved
the framework in §2 the same day (*"this sounds like the direction I would like to go, proceed"*).

## 2 · THE DECIDED FRAMEWORK (owner-approved 2026-08-21)

**Two different acts were hiding inside "log money":**

1. **Expectations** — plans about money: budgets, commitment schedules, dues schedules, fundraiser
   definitions and credit %, the club's bills. These genuinely differ from each other and **stay on
   their own screens.**
2. **Events** — money that actually moved: a payment arrived, went out, an amount was raised. These
   are the same act everywhere (amount · date · method · what · one context question) and become
   **ONE recording conversation, product-wide.**

Three rules:

- **R1 — Recording money that moved is one conversation.** One form, one vocabulary, one method
  list, one consequence line. Not a hub over five forms — the five forms BECOME one. (This is the
  opposite of the "sixth door" §3-of-the-brief forbids: fewer things exist afterwards.)
- **R2 — Its first question is "who was the money with?", never "which of our concepts is this?"**
  Eight coach sentences in two groups (money in: a family paid dues · fundraiser money · a sponsor ·
  money back · other in; money out: we paid for something [paid-or-owed fork inside] · we settled
  with the club · we paid a family back). The who routes the record to the right book underneath.
- **R3 — The books keep their doors; every door opens the same conversation pre-answered.**
  Standing on Jenny's dues row, the drive leaderboard, a bill's row or a club installment skips the
  questions that context already answered. Same fields, same order, same words as the cold open.

**What each screen becomes:** Fundraising = define & run the drive (instrument). Payables = where
commitments/schedules live. Dues = schedules, credits, settlement. Club = correspondence + the bill
mirror. Transactions = the whole truth + the one hub-level **Record** button. No screen is deleted
by the framework itself; every screen loses its private form.

**The mental-model principle this was tested against** (owner, from the brief, now binding in
`memory/design_decisions.md`): the measure is what makes sense in a user's mind, not click count.
The two-scenario test the framework passes: *in context* nothing gets slower (the row pre-answers);
*out of context* (Sunday night, four e-transfers) finally has a home — today the register is the one
door that refuses dues and drive money.

## 3 · What gets retired (decided, rides the build)

- **Four verb dialects** — "Add" / "Record a payment" / "Record payment" / "Log amount" / "Mark
  paid" / "New" become one conversation with one name.
- **Two of the three payment-method vocabularies** — free-text (Transactions/Payables) vs 4-option
  enum (Dues) vs 5-option enum incl. Card (Club) → one shared list.
- **The label-only "Who paid it back" field** on refunds (a select whose "A family" creates
  nothing, sitting one fold away from the real out-of-pocket mechanism that moves real money) —
  replaced by the real mechanism inside the one conversation.
- **Per-tab toolbar Add buttons** — replaced by the hub-level Record button + context doors.
- (§5 rulings kept both the Payables tab and money tags — neither retires.)

## 4 · Rejected in this session, and why

- **A sixth door / hub over the five forms** — six things to learn, forbidden by the brief and by
  the framework (the five forms merge instead).
- **The pure bank-statement model** (kill the domain screens, everything a category filter on one
  ledger) — the books are relationships with machinery (a child's bill, a leaderboard row with a
  credit %, club correspondence); a flat ledger can't carry them. Rejected as the whole answer.
- **The pure document model** (status quo: each book owns its logging) — it makes the coach answer
  the filing question before the product asks anything; it is the complaint.
- **Words-only unification** (the conservative alternative, priced in mockup 06) — repaints the five
  doors, leaves "which tab do I open first" and the Sunday-night pile unanswered, five forms keep
  drifting. Rejected as insufficient; its vocabulary half is absorbed into the real build.
- **Moving expectation-setup into the conversation** (drive creation, dues schedule generation,
  budget lines, club requests) — they are campaigns/plans, not events; they stay on their screens.

## 5 · THE THREE RULINGS — ✅ ALL TAKEN BY THE OWNER 2026-08-21

1. **Does a payment learn who paid it? → YES.** (Mockup 04 — the $200-deposit-on-a-$600-entry
   case.) An optional "who actually paid it?" on the payment branch doing exactly what whole-cost
   fronting already does (no team cash; the family's credit grows; consequence stated in dollars).
   ⚠ It reaches `rep_dues_credits` — real money owed to a household; edit/delete must unwind the
   credit correctly. **Its own careful build phase, never in passing.**
2. **Tabs: Payables STAYS, for now.** Owner: *"keep payables for now, once this is done if the new
   forms make me feel like we can retire payables we can re-explore but having a place to log
   planned future expenses still makes some sense to me."* The fold (Option B) is **deferred, not
   rejected** — re-explored OWNER-LED once the new forms have been lived with. ⚠ A build session
   may not take it on the way past.
3. **Tags: KEPT — the retire question is CLOSED.** Owner: *"tags are something I expect coaches can
   add many labels to at least simply to filter by those labels. maybe they have items for
   tournament fees and deposits but want to tag each one with the tournament name, later filter by
   how much they paid for a specific tournament."* **The recorded purpose: a tag is the OCCASION
   label items can't express** (item = what kind of cost; tag = which occasion). Consequences for
   the build: the ledger keeps a real tags filter, converted to the §7 counted pill, and **a
   filtered view must always show its TOTAL** — "what did the Summer Classic cost us?" is the
   answer tags exist to give. My earlier retirement lean is superseded by this ruling.

## 6 · Deliberately NOT built / not this session

- **Phone money tables** — its own TODO entry and session, SEQUENCED AFTER this work (fewer card
  tables left to rework). Do not let it steer this build.
- **Club requests** — correspondence, not recording; unchanged.
- **Undo-rollover** — untouched, its standing rule holds (payables plan §3.4).
- **The model** — unchanged except ruling §5.1 if taken. Installments-and-payments is settled.
- **A tag report** — only if ruling §5.3 ever demands one; do not build on the way past.

## 7 · Discovery record (code-verified 2026-08-21; the evidence the decisions rest on)

- **The nav has exactly ONE Money door** (desktop sidebar item + phone More-sheet item, both
  `/accounting`); the "five places" are tabs of one hub: Overview · Budget Plan · Player Dues ·
  Fundraising · Transactions · Payables · Club (org-linked only) · Budget vs. Actual.
- **Transactions and Payables are already one component** (`accounting/expenses/panel.tsx`, ~4.5k
  lines, two faces) sharing the add modal, Record-a-payment modal, tag library, importer. The
  register already shows scheduled pieces with their own Record-a-payment button, and a future
  "Date paid" already converts the form to a commitment in place.
- **The register already derives dues/fundraising/club rows** ("one row, one source"), read-only
  with links back — recording from the ledger under R1 keeps this rule intact (the record is
  created in its home book; the register derives it).
- **The same act wears five word-sets** (full field-by-field tables in the session transcript):
  verbs Add / Record a payment / Record payment / Record as paid / Log amount / New / Mark paid;
  dates "Date paid" / "Date received" / bare "Date"; methods free-text vs `etransfer|cash|cheque|
  other` vs `Cash|E-Transfer|Cheque|Card|Other`. Each door's one REAL question: which kind /
  which installment / which player / which drive+player / which direction.
- **A payment record carries no payer** — `rep_payable_payments` (amount, paid_date, method, note,
  installment_id) and `rep_dues_payments` (amount, received_date, method, note; player_id = whose
  bill, set from the URL, not a payer). The payer exists only as `rep_team_expenses.
  paid_by_player_id`, creation-only, via the single out-of-pocket door that mints the reimbursement
  credit atomically. Payments against such a commitment already restate the family credit — §5.1
  extends this one level down.
- **Tag reality:** ONE money-tag library (`rep_team_tags` kind='expense', org-shared rows
  read-only), one "Manage tags" button rendered on both faces of the shared panel (seen twice),
  Budget's "Manage our items" is a DIFFERENT library (budget words), the schedule's is game tags.
  Fundraising kept tag FIELDS but its filter was cut 2026-08-15; BvA's filter cut in §64. Dues and
  Club have no tag controls at all.

### Defects/debt found by discovery (fix regardless of direction; none started)

1. **Dues "Add Credit" type picker offers `Forgiven` and `Reimbursement`, which the API refuses**
   (validTypes allow-list) — a coach picking them gets a 400. The picker should not offer them
   (an adjacent comment already claims it doesn't).
2. ✅ **CLOSED 2026-08-25 — DO NOT RE-FIX.** The payout note placeholder that taught guardian
   names ("e.g. sent to Dana") lived on `DuesPayoutSheet`, and **P2 deleted that component**: the
   conversation took over the pay-a-family-back door, leaving the sheet with no callers at all
   (found by P2's /simplify pass). Verified 2026-08-25 — the only surviving hit anywhere is a
   COMMENT recording the 2026-08-13 PII ruling, which is legitimate history, not a defect. Left
   here rather than deleted because a debt list that silently loses rows cannot be audited.
3. **Stale comments** describing the removed BvA tag filter (an orphaned "Phase 3" banner in the
   panel; a "SKIPPED WHEN A TAG IS FILTERING" note in the route).
4. Legacy money routes redirect with **308** (permanentRedirect), not 307 as some docs say —
   cosmetic, noted for accuracy.

## 8 · Build shape (now authorized; the working detail lives in
`COACH_MONEY_CENTRALIZATION_BUILD_PROMPT.md`)

- **P1 — the conversation grows its branches.** The existing shared record form learns: a family
  paid dues (player picker w/ owing figures) · fundraiser amount (drive+player) · sponsor receipt ·
  club settlement (pick owed installment) · payout. Every branch submits through the EXISTING
  route/writer for that record type — no new write paths, no model change. Hub-level Record button.
  **✅ BUILT ON DEV 2026-08-23 (owner QA §80; mig 260 dev-applied).** The §2.1 method decision, as
  taken: ONE five-option list (E-Transfer · Cash · Cheque · Card · Other) — dues/payout CHECKs +
  shared enum gained `card`, the two route-local METHOD copies now import the shared list, ONE
  shared label map, and the free-text combobox's SEEDS converged on the same five ('Credit card' /
  'Debit' / 'Bank transfer' seeds retired; free text still saves, learned values still appear).
  Four deviations raised for ruling in §80 (drive branch date · bill-level dues consequence ·
  unnamed drive hint · Record button in the tab row, where approved mockup 05 draws it, because
  the page header's action row is phone-hidden). Sponsor hand-off = one-shot `?newSponsor=1`;
  hints ride the hub summary, which gained `dues.familiesInCreditCount/familyCreditHeld`; the
  dues panel joined the shared money-revision re-read (it was the one panel not listening).
- **P2 — context doors re-point** (dues drawer, drive rows, bill rows/drawer, payout button) at the
  one form pre-answered; vocabulary lands here. ⚠ Tabs unchanged per §5.2 — Payables stays.
  **⚖ THE P2 GATE WAS RUN 2026-08-23 AND FOUR OWNER RULINGS CHANGED THIS BULLET — read
  `COACH_MONEY_CENTRALIZATION_P2_BUILD_PROMPT.md` §"THE GATE OUTCOME" before touching P2; it wins
  over this line and over the P1 artifacts on every P2 surface.** In brief, and each one reverses
  something written above or drawn in the mockups:
  1. **Pre-answers at a context door are LOCKED, not changeable** (supersedes frame D). *A door
     that names one RECORD locks; a door that names a SCREEN only suggests.* Mockup 02's who-line
     returns for the locked case, minus its "Change" hatch. Identity locks; which installment the
     money lands on does not.
  2. **⚠⚠ Record is money that MOVED — the paid/owed fork and its in-modal schedule editor are
     DELETED, and Date paid becomes required.** Owner-initiated, reversing a piece of P1 that
     passed §80 the same week. It is this plan's own §2 applied honestly: "commitment schedules"
     is on §2's list of EXPECTATIONS that stay on their own screens, and the built form had three
     overlapping ways to make something unpaid while being unable to pay down a commitment at all.
     **Payables therefore KEEPS "Add a commitment"** as a setup form — only Transactions' plain
     "Add" retires, so §3's "per-tab toolbar Add buttons" retirement is HALF-TAKEN by design.
  3. **A payment against an existing commitment is not a ninth sentence** — the "we paid for
     something" picker gains **"Bills you owe"** as its first group, so the coach never classifies
     before typing. The eight sentences stay eight.
  4. **The club installment keeps its ONE TAP** (§2.2 of the build prompt always said settle must
     not get slower); it converges by NAME only — "Mark paid" → "Record as paid". And the hub
     Record button becomes **tab-aware on every tab**, suggestion-only.
- **P3 — tags per §5.3 + the debt**: chip row → §7 counted pill on both faces, filtered TOTAL
  always shown; label-only "Who paid it back" removal; §7's debt items (credit-picker 400, payout
  placeholder PII, stale comments).
  **⊕ ADDED 2026-08-25 (owner): the required-asterisk sweep, and it is PORTAL-WIDE.** A required
  field takes a PLAIN asterisk in the label’s own ink; the dedicated red marker is RETIRED, not
  merely avoided in new code. Ruled because **red in this portal means something has gone wrong**
  — money owed, overdue, a refused save — and a field is not in error for being required; the
  asterisk already carries the meaning, so the colour was only adding volume and spending a signal
  the portal needs for real failures.
  ⚠ **THE STATE IT CORRECTS IS MIXED INSIDE SINGLE FILES, NOT SPLIT BY SCREEN.** Measured
  2026-08-25: 44 required labels across 8 files, 29 red vs 15 plain — with **Player Dues AND the
  money record form each using both**. Anyone scoping this as "money does one thing, roster does
  another" will size it wrong.
  ⚠ **IT REACHES BEYOND MONEY** — roster, schedule, the head-coach editor and the start-interest
  form all carry the red marker. It rides this phase because P3 is already the words-and-leftovers
  pass, not because it belongs to the money project.
  ⚠ Deliberately NOT swept on the day it was ruled: roster and schedule were live in other
  sessions’ working trees, and a 44-site label sweep across files someone else is mid-edit on is
  an expensive merge over something cosmetic. Ruling: `memory/design_decisions.md` 2026-08-25.
- **P4 — payer-on-payment** (ruled YES): its own phase; credit unwind on edit/delete is the
  acceptance test.
- Every phase: **help docs + BOTH demo sandboxes re-read** — the money vocabulary is exactly the
  surface where hand-written demo sentences go stale while pages still render (CLAUDE.md standing
  warning; the §64 release check says the same for the Payables ship).
- The build prompt must re-verify §7 against the tree at build time (this repo's plans have been
  wrong before; this one is no exception by fiat).

## 9 · Aftercare / links

- Binding design principle logged in `memory/design_decisions.md` (2026-08-21, mental model over
  click count) — applied here, outlives this session per the brief.
- PM brief: `COACH_MONEY_CENTRALIZATION_PM_BRIEF.md`.
- TODO entry updated in place (the session's own line).
- Owner QA: nothing to walk yet — planning only. A ledger section arrives with the first build.
