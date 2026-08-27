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

1. ✅ **FIXED 2026-08-25 (P3).** Dues "Add Credit" offered `Forgiven` and `Reimbursement`, which
   the API refused with a 400 — and the comment beside those two labels asserted they were not
   offered, which is why it survived a year of reading. The picker and the route now share ONE
   exported list (`MANUAL_CREDIT_TYPES`, `lib/dues-credits.ts`), so the screen cannot offer a kind
   the server rejects. ⚠ An existing credit of an excluded kind still names itself correctly in the
   disabled select — a `<select>` whose value matches no option renders the FIRST one, so a
   forgiveness opened for a note correction would have sat there calling itself a Contribution.
2. ✅ **CLOSED 2026-08-25 — DO NOT RE-FIX.** The payout note placeholder that taught guardian
   names ("e.g. sent to Dana") lived on `DuesPayoutSheet`, and **P2 deleted that component**: the
   conversation took over the pay-a-family-back door, leaving the sheet with no callers at all
   (found by P2's /simplify pass). Verified 2026-08-25 — the only surviving hit anywhere is a
   COMMENT recording the 2026-08-13 PII ruling, which is legitimate history, not a defect. Left
   here rather than deleted because a debt list that silently loses rows cannot be audited.
3. ✅ **FIXED 2026-08-25 (P3).** Stale comments describing the removed BvA tag filter. ⚠ **BOTH
   sites were still live**, not one: the panel's orphaned "Phase 3" banner AND the route's
   "SKIPPED ENTIRELY WHEN A MONEY TAG IS FILTERING" note — the latter sitting fifty lines above the
   note that says the filter was removed, so the file contradicted itself and compiled perfectly.
   The P3 build prompt claimed the route half was already gone; it was not. The panel now states
   the RULING (why this report has no tag filter) rather than describing a control that isn't there.
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
  **✅ BUILT ON DEV 2026-08-25 (owner QA §104; NO migration).** Gate run first; the owner approved
  every recommendation. Drawing: `claude.ai/code/artifact/ccb5e84e-e25c-4b08-ba12-857735f81351`.
  What landed, and where it deviated from this bullet:
  1. **The pill is MULTI-select** (owner call at the gate) — the chip row was one-at-a-time, and the
     family it joined is a checkbox list; ticking two tags ORs them and a cost carrying both counts
     once. Mockup 05's "Tags · 1 selected" is not what the shared control renders — it shows the
     tag's NAME for one selection, which is better and is what the four pills beside it already do.
  2. **The total's placement was the one undrawn thing** and is now a stated band above the list,
     on BOTH faces, **figure first**. Payables' old band ("vs {tag}: N commitments, $X total") is
     retired: it read back-to-front, and it said "commitments" while the by-due-date arrangement
     showed dated payments. The rule taken: **the band totals whatever the list in front of you is
     showing, in that face's own unit** — costs · commitments · dated payments —
     derived from the rows each face's filters already produced, never a second arithmetic.
  3. **The org/team colour legend is gone.** It rendered on Payables only, so the register showed
     blue-bordered chips and never said why. Blue now rides a swatch inside each dropdown option
     (`MultiSelectDropdown` gained an optional per-option `accent`, documented for that one meaning).
  4. ⚠⚠ **`check:layout` HAD BEEN BLIND TO THIS ENTIRE FEATURE.** The pill and the band self-hide
     when a team has no money tags, and the UAT fixture seeded `kind: 'game'` tags only — so every
     sweep of both money faces walked past an absent control and reported green. The fixture now
     seeds a team-own **Spring classic** and an org-shared **Club permits**. This is the
     empty-fixture trap one screen further along, and it would have survived the phase.
  5. ⚠ **The coach demo could not show tags either** — `resetTeam` deletes the tag table and nothing
     put any back, so no prospect had ever seen the question tags answer. `MIDSEASON_MONEY_TAGS`
     seeds "Spring Classic" (deliberately spanning TWO budget categories, which is the distinction
     tags exist for) and an org-shared "Club permits"; the Transactions tour step gained one closing
     sentence that names **no figures**, so a re-anchor cannot make it wrong. ⚠ **It needs a reseed
     of the coach demo to appear — a nightly tick only re-anchors dates.**
  6. **Help updated in three places** — the filter-strip paragraph, the tags section and the tags
     FAQ all described a one-at-a-time chip row.
  ⚠ Two items on this bullet were **already closed** before P3 began and were re-verified rather
  than re-fixed: the label-only "Who paid it back" select (removed in P1/P2) and the payout
  placeholder PII (its component was deleted by P2's simplify pass).
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
  **✅ SWEPT 2026-08-25 (P3), and the measurement above was UNDERSTATED — verified against the
  tree, not this plan.** The real figures: **32 red markers across 9 FILES, not 29 across 8** (the
  Club tab's own `.req` copy was missed entirely), and **~58 marker sites across 11 files** rather
  than 44 across 8 (the two Fundraising screens were not counted; their asterisks were already
  plain, so they needed no edit — but anyone sizing the sweep from this line would have been wrong
  about where it reaches). Roster and schedule were CLEAN by the time it ran; the two dirty files
  were the money ones.
  ⚠ **The CSS is deleted, not merely unused** — `.labelRequired` and `.req` in the portal
  stylesheet **plus four local copies** (budget, start-interest, head-coach editor, schedule
  editor), each replaced by a headstone naming the ruling, because a rule left in place is a rule
  the next form finds. One of the four was coloured `--home-live` rather than `--danger`, so the
  marker had already drifted into two reds.
  ⚠ **SCOPE RULED (owner, 2026-08-25): the coaches portal only.** Twelve further red markers live
  outside it — the public tryout registration form, the public league registration form and one
  platform-admin screen. The ruling's reasoning is about what red means *in this portal*, and those
  are different surfaces; they were left alone deliberately, not missed.
- **P4 — payer-on-payment** (ruled YES): **⏸ GATE 1 DRAWN 2026-08-27, AWAITING OWNER APPROVAL —
  the working detail is §8c below, which outranks this bullet.** ⚠ Two code-verified findings
  change the phase: the "Paid by" question **already renders on the record-a-payment form and is
  silently discarded** (a live ghost save), and **there is no payment editor at all** (POST +
  DELETE only), so two of the three unwind cases the build prompt names are not reachable.
  Its own phase; credit unwind on edit/delete is the
  acceptance test.
- Every phase: **help docs + BOTH demo sandboxes re-read** — the money vocabulary is exactly the
  surface where hand-written demo sentences go stale while pages still render (CLAUDE.md standing
  warning; the §64 release check says the same for the Payables ship).
- The build prompt must re-verify §7 against the tree at build time (this repo's plans have been
  wrong before; this one is no exception by fiat).

## 8b · P3 follow-on — a filter count is a promise about the list (owner ruling 2026-08-26)

Raised by the owner mid-§104 walk, looking at Transactions filtered to one tag: *"is it accurate in
the transactions screen to show the count as 1 when there are 3 rows?"* It was not. Two numbers
answered one question a few inches apart, and both were true of different things — the **Tags**
option counted tagged **records**, the band beneath counted **rows on screen**. A commitment paid in
three installments is one record and three register lines.

**⚖ THE RULE, in the owner's words:** *"the assumption when filtering a table is how many rows am I
going to see when I filter, so we should show that figure."* The count on a filter option is a
**promise about the list underneath it**, so it counts what ticking it will put there:

| Face | Unit |
|---|---|
| Transactions | register lines |
| Payables · Group by commitment | bills |
| Payables · Group by due date | dated payments |

That is the band's own unit on each face, so the two can no longer disagree — and it is taken over
the rows every **other** control already admits (the same "count before THIS filter narrows" rule
Status follows), so a tag whose rows the Date or Status pill excludes honestly reads **(0)**.

⚠ **The ruling reached one place the owner did not name.** He reasoned that Payables "tags by
group", so (1) is right there — true of *Group by: commitment*, but Payables has a second
arrangement whose rows are dated payments. The band already switches nouns between them, so the
count switches with it. Flipping the arrangement changes the number **by design**.

⚠⚠ **WHICH TAGS ARE OFFERED IS NOT DERIVED FROM THE COUNTS, and that separation is load-bearing.**
Zero is now an ordinary answer, so a list built from the counts would make an option **vanish** as a
coach moved the date pill — the exact trap the tag memo's own header was written against ("the
difference between a control and a trap"). The offer stays *every tag this face's records carry,
plus anything selected*; only the number changed.

⚠ **Structural, not duplicated.** Both faces tally from the row list they already render — the
register extracts its status+date pipeline so it can run once for the book and once with the tag
lifted; Payables tallies during the pass that builds the visible pieces. No second arithmetic, which
is the rule `check:register` and `check:money-report` exist to hold.

**A third defect fell out of the read.** Club bills were pushed onto the Payables list **after** the
tag filter and so bypassed it entirely: filtering by an occasion left every club bill among the
results, while the band counted only tagged team bills and therefore disagreed with the rows above
it. The register's stated rule — *"every other row simply has no such label, which is a match of
zero, not a match of all"* — now holds on both faces.

### The fold toggle — built, then withdrawn at the gate

Raised in the same message: *"can we remove Open all? seems like a button no one will select and is
wasting space."* ⚠ **It is ONE control with two labels** — it reads "Open all" only because bills
arrive folded, and the identical button reads "Fold all" on the due-date arrangement; deleting what
was on screen would delete "Fold all" too, and a mobile UAT check clicks it by name. The complaint
was real but its cause was the fixture: **one** commitment, so the button offered to open a single
row. So it was narrowed rather than deleted — the toggle hidden below two groups, and a lone
commitment arriving open.

**⚠⚠ THAT BUILD WAS WRONG AND THE REVIEW CAUGHT IT — three independent lenses, same defect.**
`flippedFolds` is a **delta, not a state**: it records the keys that differ from the current
default. Making the default depend on the visible group count therefore reversed the meaning of
every entry in it the moment a filter crossed the one-vs-many line. Open a bill among several, tick
a tag that narrows to that bill, and it **re-folded itself** — hiding the very thing the coach had
just narrowed to — with the bulk toggle hidden at the same instant, leaving only the row's own
chevron to recover. The mirror case reopened a deliberately-folded bill when a filter widened.

Both options were drawn (`claude.ai/code/artifact/64d185dd-beb6-45cb-a524-fa38eeb87b92`) — *a lone
bill always open with its chevron removed*, versus *fold behaviour untouched*. The agent recommended
the first; **the owner chose the second and gave the principle that governs it:**

> ⚖ **"it doesn't change the format of the screen just because a user selected a filter."**

That principle also condemns hiding the **button** on the filtered count — a control that vanishes
because a tag was ticked is the same defect wearing a politer face — so that half came out too.
**Net effect on folding: nothing changed.** The default is pinned to the arrangement alone, with a
headstone at the line recording why it may never depend on anything else while the fold memory
stays a delta.

⚠ **OPEN, NOT BUILT.** The original complaint still stands for a team that genuinely has one
commitment. Any future fix must test **the team's list, not the narrowed view**.

**Owner QA §111.** No migration.

## 8c · P4 — A PAYMENT LEARNS WHO PAID IT — ✅ BUILT ON DEV 2026-08-27 (owner QA §116; mig 267)

Ruled YES on 2026-08-21 (§5.1). Gate 1 drawn 2026-08-27; **owner approved the same day** ("agree
with your recommendations, go ahead") and the whole phase was built in one pass.

⚖ **THREE THINGS BELOW WERE CORRECTED BY THE BUILD'S OWN REVIEW GATES — read §8c.11 before
trusting §8c.4/§8c.5.** The floor stopped being a backstop inside the reconciler and became a
pre-flight only; delete gained the gate it never had; and the credit INSERT learned to read a
unique violation as a race.

- **PM brief:** `COACH_MONEY_CENTRALIZATION_P4_PM_BRIEF.md`
- **Drawings (6 named specimens):** `claude.ai/code/artifact/4873ab46-4e1e-4726-b856-d361ecc0e017`
- **Build prompt:** `COACH_MONEY_CENTRALIZATION_P4_BUILD_PROMPT.md`

### 8c.1 · Two code-verified findings that CHANGE the phase (read before anything else)

**⚠⚠ FINDING 1 — THE QUESTION IS ALREADY ON THE SCREEN, WIRED TO NOTHING. A LIVE GHOST SAVE.**
`renderPaidBy()` in `accounting/expenses/panel.tsx` returns null only for `isPayableForm ||
isMoneyInForm`, and is called from inside the shared details fold (`!isMoneyInForm`). A
**bill-payment** form is neither: `payingBill` is add-mode with `formKind === 'expense'`, so the
editable **"Paid by"** select renders, offering every roster family — inside a fold whose own label
reads *"More — paid by, payee, tags, notes"*. `saveBillPayment()` posts `{amount, paidDate, method,
note, installmentId}` and **drops `form.paidByPlayerId` on the floor.** `consequenceLine()` tests
`payingBill` *before* the out-of-pocket branch, so the coach is told the team's cash left.

This is the ghost-save shape of owner ruling A (2026-08-23) — an answered question that changes
nothing while the screen says otherwise. **It ships on dev today, independent of P4.**
Consequence for the phase: P4 does not add a field. **The layout cost is zero**, which is why
specimen 1's before and after are the same shape.

**⚠⚠ FINDING 2 — THERE IS NO PAYMENT EDITOR. The build prompt's §1.5 premise is wrong on two of
three cases.** `payments/[paymentId]/route.ts` exports **DELETE only**; `payments/route.ts` exports
**POST only**. A recorded payment has two operations. Correcting one is undo-and-record-again.
So of the prompt's three unwind cases — change the amount, change the payer, delete — only the
third is reachable, and the second is a refusal rather than an operation.
**Recommendation: P4 does NOT build a payment editor.** It is a larger decision than this phase and
would reopen the paid/owed fork ruling B2 closed.

### 8c.2 · Which mechanism P4 extends, and why the other is wrong

`DATA_DICTIONARY.md` `rep_team_money_in` gotcha 1, honoured: *a coach describes both as "a parent
paid me back", and they are opposites.*

- **Paid out of pocket** — `rep_team_expenses.paid_by_player_id` + a `reimbursement` credit
  (mig 234). Team cash never moved; the team **owes that family**. **P4 extends this, one level
  down: from the cost to the payment.**
- **Money back** — `rep_team_money_in`. Team cash went out and some came back; the team owes
  **nobody**. Gotcha 3 (`NEVER BOTH`) and gotcha 4 (`NOTHING HERE EVER CHANGES A PAYMENT SCHEDULE`)
  both apply. **P4 does not touch this table.**

The $200 deposit is unambiguously the first: the team never paid, the parent did, the team owes
them. Recording it as `money_back` would book $200 of team cash leaving that never left, then $200
arriving that never arrived, and leave the family owed nothing.

**⚠ And nothing in P4 changes a dues SCHEDULE.** The credit lowers what a family is *asked to
send*, which is derived at read time by `lib/dues-credits.ts` — the existing behaviour of every
credit. Gotcha 4 is not bent.

### 8c.3 · The model — ONE arithmetic, generalized, never a second one

**The effective payer of a payment** = `payment.paidByPlayerId ?? expense.paidByPlayerId`.

**The credit set for a cost** = one `reimbursement` credit per **(expense, effective payer)**, whose
amount is the sum of that payer's payments on that cost. The existing whole-cost case is exactly the
one-group case, unchanged.

⚠ **This is why the existing helper must be generalized rather than copied.**
`restateReimbursementCreditFromPayments(expenseId)` today reads
`.eq('expense_id', …).eq('credit_type','reimbursement').maybeSingle()` and sets `amount = Σ ALL
payments on the expense`. Left alone, a second payer on one cost makes `maybeSingle()` throw and
**breaks the existing out-of-pocket path**. It becomes a *reconcile of the whole set*: group live
payments by effective payer, insert missing credits, restate changed ones, delete emptied ones —
each write still under the CAS-on-old-amount + retry loop it already has.

⚠ **No new credit-link column is needed.** The credit's natural key is
`(expense_id, player_id, credit_type='reimbursement')`. Add a **partial UNIQUE index** on that so
the reconcile cannot produce two rows for one household — verify on dev first that no existing rows
violate it (only `createOutOfPocketExpense` writes these, one per expense, so it should hold
trivially).

⚠ **`rep_dues_credits.payment_id` IS ALREADY TAKEN** and means something else — a `rep_dues_payments`
FK on auto-created `overpayment` credits (dictionary gotcha 6). Do not reuse or overload it.

⚠ **The new kind is not a manual kind.** Nothing is added to `MANUAL_CREDIT_TYPES`. The credit is
minted by the act of recording, as `reimbursement` already is. Adding it to the picker would be P3's
400-on-a-refused-kind bug in a mirror.

⚠ **The credit's wording does not change:** `Paid out of pocket — {expense description}`,
`credit_type = 'reimbursement'`. A parent who fronted a whole cost last month and a deposit this
month reads one sentence, not two. One spelling everywhere a customer reads it (AGENCY_RULES).

### 8c.4 · THE UNWIND RULES, stated as rules

| Act | The family's credit | How it is made safe |
|---|---|---|
| **Record** a payment naming a payer | Restated to Σ that payer's payments on the cost | Row first, then reconcile from **live rows** under CAS; on restate failure the payment removes itself (the `recordPayablePayment` out-of-pocket branch's existing shape) |
| **Undo** that payment | Restated down; credit row **deleted** when the group empties | Delete re-asserts `expense_id + org_id + team_id + program_year_id` in its own WHERE; a zero-row delete is reported as "already undone", never as a second reversal. Reconcile runs **after** the delete, from live rows, on **both** outcomes of the race (the lost-update fix of 2026-08-20) |
| **Change the payer** | Nothing — **REFUSED, 409** | Precedent: `expenses/[expenseId]/route.ts` already refuses moving a cost's payer. Sentence: *"Who paid can't be changed after saving — it decides which family the team owes. Undo this payment and record it again."* **There is no move-a-credit-between-households operation to get wrong.** |
| **Edit the commitment's schedule** so a paid figure restates | Restated to match | The existing `updateRepTeamExpense` → `restateReimbursementCreditFromPayments` path, now reconciling the set. `paymentRestatements` (pure, tested) is unchanged |
| **Any act that LOWERS a family's credit** | Checked first (see 8c.5) | Refused if it would drop below what has already been paid out in cash |
| **Delete the cost** | Goes with it | Unchanged — `expense_id` CASCADE; a credit cannot outlive the cost it repays |

⚠ **Check-then-act throughout** (`memory/reference_coach_money_check_then_act.md`): every write
re-asserts team + org + season + the row's expected state in its own WHERE. This codebase has
already shipped an approve path that posted a transfer before marking it approved.

### 8c.5 · ⚠⚠ THE PAID-OUT HAZARD — not in the build prompt, and reachable TODAY

A `reimbursement` credit is payable out in cash: `payoutCeiling()` excludes only `forgiven`. If a
credit is later reduced below what has already been handed over, **the arithmetic does not go
negative — it goes silent.** `applyCreditsToBills` clamps `Math.min(paidOutC, issuedC)`, so
`owedBack` and the ceiling both floor at zero and the team is simply out the money with nothing on
any screen saying so.

**Reachable on the EXISTING whole-cost mechanism right now** (undo the payment on an out-of-pocket
cost whose credit was paid out). P4 makes it far easier to reach.

**Rule:** before any reconcile that lowers a family's non-forgiven credit, re-assert that the
family's remaining non-forgiven credits still cover `Σ rep_dues_payouts` for that player in that
season. If not, refuse — `MoneyEditRefusal`, 409, with a sentence naming the next step:

> *"$200.00 of Avery Test's credit has already been handed back in cash. Undoing this payment would
> take away a credit the team has already paid out. Undo that payout first, then undo this."*

**⚠ The guard goes on the existing path in the same change**, not only the new one. Two arithmetics
for one question is the defect this project exists to remove.

### 8c.6 · The migration

**One column, plus one index.** ⚠ Decide it exists from the snapshots / live `information_schema`,
never from migration files.

- `rep_payable_payments.paid_by_player_id` → `rep_roster_players.id`, **nullable, ON DELETE SET
  NULL** — the same name and the same action as the cost-level column, because it means the same
  thing one level down. Partial index on `(expense_id) WHERE paid_by_player_id IS NOT NULL`.
- Partial **UNIQUE** on `rep_dues_credits (expense_id, player_id) WHERE credit_type =
  'reimbursement'` — the structural guarantee replacing the old `.maybeSingle()`.

**Same unit of work:** `docs/agents/db/DATA_DICTIONARY.md` (both tables, plus the `rep_dues_credits`
gotcha that currently says the reimbursement credit is one-per-expense) and
`npm run refresh:snapshots`. `npm run check:dictionary` fails the build otherwise.

⚠ **A removed roster player (build prompt §4.4).** SET NULL matches the cost-level precedent, but
the real protection is elsewhere: `rep_dues_credits.player_id` is NOT NULL and the roster
undo-guard blocks removing a player who carries credits. So the SET NULL is a backstop for a path
that should not arise; if it ever does, the payment reads *"A family paid direct"* with no name —
exactly the fallback `lib/coach-register-book.ts` already uses.

### 8c.7 · THE WHOLE SUBTREE — every surface, and which change

**⚠⚠ THE THREE EXPENSIVE ONES.** Each asks *"did a family pay this?"* of the **whole cost** today.
After P4 one commitment can have a payment that moved team cash and a payment that did not, so each
must ask it **per payment**.

1. **`lib/coach-register-book.ts`** — `movesCash: !e.paidByPlayerId` on every payment row, and the
   `detail` line likewise. Must become per-payment. Get this wrong and the register's running
   balance stops being cash on hand — the one claim `scripts/check-register-balance.mjs` exists to
   guard.
2. **`expenseTotals()` in `lib/season-settlement.ts`** — `if (!e.paidByPlayerId) cashPaidC += paid`
   excludes the **whole** cost. Must exclude the fronted **payments**. Its signature needs
   per-payment payer data from the standing. ⚠ **Highest-risk reader in the phase: this figure sets
   every family's end-of-season refund.** Its own header notes three readers hand-rolled this branch
   before it existed and had begun to differ — do not add a fourth.
3. **Budget vs. Actual's cash strip** — `familyPaidDirect: !!exp.paid_by_player_id`
   (`budget-vs-actual/route.ts`). Same shape, same fix.

**Also changes:** the commitment page's payment list (specimen 3 — the payer + the `Family paid`
badge); the record-a-payment conversation (the field starts working; locks per 8c.8); Player Dues
(a credit row); the family statement PDF (a credit row — same wording); the money exports (a
*Paid by* column on the commitments/payments sheet); in-app help; both demo sandboxes.

**Deliberately unchanged:** dues schedules (8c.2), `rep_team_money_in`, club requests, fundraisers,
tags, the commitment plan editor, `lib/payable-standing.ts`'s arithmetic (a payer is not an
allocation — R3 is untouched).

**⚠ `lib/payable-standing.ts`'s `owing` is DUAL-PURPOSE** (remaining when unsettled, full face
amount when settled) — P3 shipped a bug on exactly this. Nothing in P4 needs `owing`; if a drawing
seems to, re-read the module first.

**⚠ Reading is not writing (§4.5).** The payer must reach the payment **list** and the register
detail line, not only the record form — a `money: 'read'` assistant never gets an Edit button. A
player *name* is baseline in this portal, not `rosterPii`, so there is no new privacy gate.

**⚠ A payment is money that MOVED** (P2 ruling B). The payer field must not reopen the paid/owed
fork. It answers *whose money*, never *whether it moved*.

### 8c.8 · The collision (build prompt §1.6) — prevented, not resolved

A cost that already names an out-of-pocket payer, receiving a payment that names one.
**Answer: the question is not asked twice.** The form renders `Paid by` as a **locked fact** —
*"A family, out of pocket — Avery Test · Set on the cost"* — with the hint *"This cost says a
family paid it. Every payment against it is theirs."* The payment inherits the cost's payer. The
existing consequence sentence (already in the code, already correct) states the growing credit.

**No double credit, by construction:** each payment's dollars belong to exactly one household under
8c.3's grouping, whether or not the door is opened.

**Rejected — letting the payment override the cost.** The arithmetic would cope. What would not is
a coach reading two answers to one question a few inches apart, which is the §8b defect. A cost
genuinely split between two fronting families is a **third** thing and is recorded as two costs.

**Rejected — refusing the save.** Nothing is wrong with what the coach is doing; refusing would
send them to delete and re-enter a correct record.

### 8c.9 · Help + demos (both standing rules, not optional)

- **Help** (`lib/help-content/coaches.tsx`) — the money guide explains *money back* vs *paid out of
  pocket* at the **cost** level only, and its `keywords` array carries "money back vs paid out of
  pocket" / "a parent paid me back". Both move in the same unit of work, keywords included.
- **Demos** — ask both questions. *Should a demo moment show this?* (a parent fronting a deposit is
  a recognisable, sympathetic moment) and *are the demo's existing money sentences still true?*
  ⚠ `CLAUDE.md` already flags the coach demo's dock lines and most of its money tour as written
  against the pre-centralization world. ⚠ A seed change needs a **reseed**, not a nightly tick.

### 8c.10 · Gate 2 — when the owner approves

Build the whole approved phase in one pass, then: `npm run verify:changed` · `npm run typecheck` ·
`npm run check:layout -- --changed` with a dev server up · `/simplify` then `/review` (that order) ·
`npm run check:demos` · `npm run check:register-balance`. Add an Owner QA Ledger section with a
walkthrough Artifact carrying real checkboxes. **State honestly what was not verified — a gate that
did not run is not a gate that passed.**

⚠ `verify:changed` has died at the parity check before its last six checks ran
(`memory/project_coach_page_actions.md`) — confirm it reached the end.



### 8c.11 · ⚖ WHAT THE BUILD'S OWN GATES CORRECTED — this outranks §8c.4 and §8c.5

`/simplify` (4 lenses) then `/review` (high-risk tier, 5 lenses) ran on the built phase. Between them
they found **five real defects, two of them in the design this plan had written down.** Recorded here
rather than edited silently into the sections above, because two of them reverse a stated rule.

1. ⚠⚠ **THE FLOOR IS A PRE-FLIGHT ONLY. THE RECONCILER DOES NOT REFUSE.** §8c.5 said the check
   inside `reconcileReimbursementCredits` was "the backstop". It was a **liability**: a backstop
   that fires after an irreversible write. `removePayablePayment` deletes the payment row and *then*
   reconciles, so a payout landing in that gap made the reconciler throw with the payment already
   gone — and **every retry recomputed the same lower figure and hit the same refusal**, leaving the
   credit stranded above the payments permanently, with no way to repair it from inside the product.
   The rule now: **the gate belongs at the door** (`assertReimbursementFloor`, before any write), and
   the reconciler's one job is to make the credits agree with the payments — it must always be able
   to finish. The residue of a lost race is a payout exceeding a credit, which the arithmetic already
   tolerates and undoing the payout already repairs. **A wrong number that can be fixed beats a right
   refusal that cannot.**
2. **DELETING A COMMITMENT TAKES A FRONTED HOUSEHOLD'S CREDIT WITH NO CHECK.**
   `deleteRepTeamExpense` now asks the floor first with an empty payment list — after the delete
   nothing remains, so every household's credit goes to zero, and that is the state to ask about.
   ⚠ **Predates P4** for the whole-cost case.
   ⚖ **RE-GRADED HIGH → MEDIUM 2026-08-27 after a peer push-back, and both of us had it partly
   wrong. Read this before quoting the severity anywhere:**
   - **What I got wrong:** I claimed it corrupted the figure that sets every family's refund. **It
     does not.** `lib/coach-season-settlement.ts` deliberately passes the RAW payout total, not the
     credit-clamped one (its own comment explains why), so a household's "already received" figure
     survives the cascade intact. And the CASCADE ITSELF IS DESIGN — mig 234, so a reimbursement
     can never outlive the cost it repaid. "No gate at all" was the wrong description of it.
   - **What the push-back got wrong:** it is not merely "the coach isn't told". A payout stranded
     above a household's credits **silently consumes their FUTURE credits**. Verified against
     `applyCreditsToBills`: $200 paid out with the credit gone, then a $150 fundraiser rebate →
     `applied: 0`, `leftToSend: 150`. The family earned a rebate that lowers nothing.
   - **The best observation is the peer's and outlives the grade:** the roster undo-guard REFUSES to
     remove a player carrying credits; this path TAKES those credits silently. One question, two
     opposite answers. Logged as an owner ruling in §116, not built.
3. **A unique violation on the credit INSERT is a RACE, not a failure.** Mig 267's index exists to
   stop a double-credit; the insert did not read `23505` as "someone else got there first", so a
   genuine race threw a raw Postgres error past `MoneyEditRefusal` and reached the coach as a 500.
   Four other inserts in `lib/db.ts` already handled it by code; this one now does too.
4. ⚠⚠ **`recordRepDuesPayout`'s post-write re-check read STALE credits — AND THIS ONE IS LIVE IN
   PRODUCTION TODAY.** It re-read payouts and reused the credit snapshot from before its own
   insert, so it could see a concurrent *payout* and was blind to a concurrent *credit shrink*: the
   family is handed cash the team no longer says it owes. It re-reads both now.
   ⚖ **I first recorded this as "newly reachable because a fronted payment can now be undone" and
   that was WRONG** — corrected 2026-08-27 after checking `origin/master` rather than assuming.
   Every credit-shrinking path is already on prod and has been since the Payables Rebuild: undoing
   a payment on an out-of-pocket cost, deleting one, editing its schedule down, and the dues
   panel's own credit PATCH and DELETE. The buggy code on prod is byte-identical to what this
   replaced. **P4 neither introduces nor widens the window — it is the change that went looking**,
   and the fix ships whenever P4 does. It is a narrow interleaving (a payout recorded at the same
   moment a credit falls), which is why it has survived, but the money is real.
5. **One arithmetic, asserted but not enforced.** `reimbursementTotalsByPlayer`'s docstring claimed
   to be "the one grouping rule so the two cannot answer differently" while the reconciler quietly
   ran its own copy of the loop. A comment asserting an invariant the code does not enforce is worse
   than no comment. It calls the shared function now, and the money half of it delegates to
   `totalsByPlayer` — the guarded per-player sum, which `tests/unit/dues-definition-guard.test.ts`
   correctly failed the build over on the first attempt.

**Also hardened, none of them defects:** the payer's roster check asserts **team as well as season**
(`rep_roster_players.team_id` is NOT NULL, so nothing legitimate is refused); a roster-name read is
no longer bought and discarded on every guard call; the undo path stopped reading installments it
never used; two hand-rolled `||` copies of `effectivePayerId` and three copies of a name join were
replaced by the shared functions (`formatPlayerFirstLast` is new).

⚠⚠ **AND A GUARD HOLE WAS FOUND AND THE SCANNER WAS FIXED, NOT THE ONE TABLE.**
`tests/unit/roster-delete-guard.test.ts` only scanned `CREATE TABLE` blocks for roster FKs, so a
table that **gains** one through `ALTER TABLE … ADD COLUMN` never entered its completeness check —
its whole guarantee is "a new child table cannot appear without somebody deciding which side it
belongs on", and mig 267 added exactly that shape with nothing noticing. It scans `ALTER TABLE` now,
which would have caught the next one too.

### 8c.12 · What proves it, and what does not

**`scripts/probe-p4-fronted-payment.mjs` (new) — 17 checks, all passing.** It drives the real HTTP
routes with a real coach session: the credit is minted, split per household, removed on undo; a
payer disagreeing with the cost's own is refused; and the floor refuses **before** anything is
written on both the undo path and the delete path.

⚠ **It cannot import `lib/db.ts`,** and that is worth recording rather than working around: the file
uses a TypeScript parameter property, which Node's strip-only TS mode refuses outright — so the money
writers are unreachable from a plain script. The same untestability shape as the `server-only` import
that kept `lib/rep-season-rollover.ts` untested until a real defect shipped through it. Going through
the routes is the honest way in, and it tests more.

⚠ **The probe's FIRST run failed the floor case and the PROBE was wrong, not the code.** It handed a
family $200 and expected a refusal; that household was owed $380 in other credits, so their balance
still covered the payout and letting the undo through was correct. **The guard is per HOUSEHOLD, not
per credit** — payouts carry no `credit_id` and must never carry one — so the only exact question is
"would this household's remaining credits still cover what has already gone out?".

⚠ **Not verified: anything in a browser.** `check:layout` renders pages but cannot open a modal, so
the record form, the payment list and both confirmations are unwalked. That is Owner QA §116.

## 9 · Aftercare / links

- Binding design principle logged in `memory/design_decisions.md` (2026-08-21, mental model over
  click count) — applied here, outlives this session per the brief.
- PM brief: `COACH_MONEY_CENTRALIZATION_PM_BRIEF.md`.
- TODO entry updated in place (the session's own line).
- Owner QA: nothing to walk yet — planning only. A ledger section arrives with the first build.
