# Payables → One Money Book — fold the Payables face into Transactions, retire the tab

**Status: ✅ APPROVED AND BUILT ON DEV 2026-08-28 (same session as the planning rounds). Owner QA
§118 owed. NOT committed at write time — commit awaiting owner confirmation.** The owner approved
all recommendations ("ok, I agree with your recommendations. do you want to start the build
here?"), which closed every decision: **(1) GO** on retiring the tab · **(2) Add a bill in all
three views** (in the Ledger's toolbar actions — see deviations) · **(3) the view is remembered
per team per device** · **(4) the tab is "Ledger"** (ruled earlier that round) · **(5) the
refusal sentence** as drawn · **(6) option A — the object is a "bill"** everywhere a coach reads.
Mockup artifact (the approved spec): "One Money Book". PM brief:
`COACH_PAYABLES_LEDGER_FOLD_PM_BRIEF.md`.

## 0. Recorded deviations from the approved mockups (each with the ruling that forced it)

1. **"Add a bill" renders in the LEDGER'S TOOLBAR ACTIONS, not the page-title row the mockup
   drew.** The 2026-08-13 page-actions ruling: a hub header carries only hub-wide doors; a
   tab-scoped action lives in its tab's own toolbar — and a header placement would render it on
   Dues/Fundraising/BvA too. A standing ruling outranks a mockup detail (the Insights precedent).
   One row lower than drawn, visible in every view exactly as decision 2 asks.
2. **The save button stays "Save", not "Add bill".** The mockup's finding 8 was made in ignorance
   of the 2026-08-16 ruling that retired outcome-named buttons on this form — the consequence
   line names the outcome in dollars, "so the button can go back to being a button".
3. **The bill form keeps picker-before-description order** (mockup drew Name first). The
   2026-08-15 ruling: choosing the budget line PRE-FILLS the description, and "asked the other way
   round, the pre-fill would land on a field they had just finished filling in". The label fixes
   survive in full ("What is this?" → "Filed under"); only the order stays.
4. **The empty book's two-door cards are realized as the empty state's Record / Add a bill actions
   plus the reworded compare panels** (the existing teaching block), not a bespoke card layout.
5. **The Timeline keeps its shipped description sentence** with the mockup's "two ways" line
   folded in, rather than replacing it.

⚖ **Standing-ruling context, stated so no session mis-reads this plan's existence.** Money
centralization ruling 2 (owner, 2026-08-21) said Payables STAYS and the ledger fold is **deferred,
owner-led, after living with the new forms — never taken by a build session in passing.** This plan
IS that owner-led re-exploration: the owner opened it on 2026-08-28, explicitly so that a decision
lands before the money **forms-review** planning session (one less face to evaluate). If approved,
this plan supersedes ruling 2's "stays for now"; until then nothing changes.

⚠ **A code comment in the shared panel sketches the OPPOSITE fold** ("P3 replaces the Transactions
face wholesale with the register, at which point the shared body shrinks to Payables' own",
`app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx:30-35`). That comment predates
this session and loses to it; the build must rewrite it rather than obey it.

## 1. Ground truth the proposal stands on (code-verified 2026-08-28)

- **The two faces are already ONE component.** `TransactionsPanel` and `PayablesPanel` are thin
  exports over `MoneyRecordsPanel({ face })` (~6,100 lines); nearly everything branches on one
  boolean. The fold deletes a face, not a page.
- **The commitment page needs NO rework.** It is addressed purely by `?bill=` layered on the
  section, suppresses the whole list chrome when set, and the register already opens it directly
  with a working back-arrow (`from=transactions`). Retiring the Payables LIST orphans nothing on
  the record page.
- **Payables' unique capabilities** (the keep-list — anything not carried is silently lost):
  1. Unwindowed owed-money view — no date pill; a bill due in four months is always visible.
     The register's default view hides it (Scheduled off + 30-day window).
  2. `Group by` **Commitment** (bill headers: next due, N of M left, owing + total, fold) and
     **Due date** (Overdue/month bands with owing totals).
  3. Status taxonomy **Outstanding / Overdue / Partly paid / Paid** (vs the register's
     Actual / Overdue / Scheduled).
  4. **Fold all / Open all** + per-group fold (flip-from-default memory, per visit).
  5. **Add a commitment** — the ONLY door to a payment schedule in the product (ruling B,
     2026-08-23: Record is for money that MOVED; do not finish the per-tab-Add retirement).
  6. Club lane: org allocations rendered "From your club", not openable, `Club →` link only.
     (⚠ The one-tap "Record as paid" for club installments lives on the CLUB tab, not Payables —
     an earlier session note claimed otherwise; nothing about it changes here.)
  7. Two filter-honouring exports: **Commitments** (by-commitment) and **Payment Schedule**
     (by-due-date), each with its own column set.
  8. Live URL contracts: `?section=payables` (+ `&tab=schedule|commitments`), fed by the
     setup-stage Overview's "See the full payment schedule", BvA Months' Scheduled drill-in,
     `legacyMoneyAddress`, the UAT smoke spec, and two layout-sweep screen ids
     (`coach-payables` folded / `coach-payables-schedule` open — BOTH required or half the
     screen goes unmeasured).

## 2. The proposal — one book, three arrangements

The **Payables tab retires**. The Transactions page becomes the whole Money book, with the
arrangement concept Payables already proved (`Group by`) promoted to a page-level **View** control,
first in the control strip:

| View | What it is | Controls shown |
|---|---|---|
| **Timeline** (default) | Today's register, unchanged | Show · Status (Actual/Overdue/Scheduled) · Item · Date · Tags · Cash on hand · Export "Register" |
| **By bill** | Payables' Group-by-commitment, unchanged rows | Status (Outstanding/Overdue/Partly paid/Paid) · Item · Tags · Fold/Open all · Export "Commitments" |
| **By due date** | Payables' schedule arrangement, unchanged rows | same as By bill · Export "Payment Schedule" |

Rules the shipped product already established, kept verbatim: the band totals what the list shows
in that view's own unit (`faceAmount` on due-date, never `owing`); tag/status counts are promises
about the list; fold memory is a flip-from-default, per visit; owed views have **no date pill**
(unchanged — the schedule is always whole); Timeline's Scheduled stays **off by default**; the
toolbar controls **swap** per view (never stack), so the phone toolbar's row count does not grow.

**Doors:** *Add a commitment* moves to the page's toolbar-actions row and renders in **all three
views** (a door that appears only in some arrangements is a door a coach can't find — decision
point 2 below). The hub **Record** button is untouched (tab-aware `spend` pre-answer; future-dated
refusal still hands the coach to the schedule — its sentence now names the view instead of the
tab). Club installments keep their one-tap on the Club tab; club rows in owed views keep `Club →`.

**Addresses:** the commitment page becomes `?section=transactions&bill=…` (same one-shot `from`).
`legacyMoneyAddress` — which already exists for exactly this kind of retirement — gains:
`?section=payables` → `transactions?view=bills`; `&tab=schedule` → `view=due`;
`&tab=commitments` → `view=bills`; `&bill=X` carries through. The two in-product deep links
(setup Overview, BvA Months drill-in) are re-pointed at source. `?tab=` dies as a public contract;
`?view=` replaces it.

**Sweep + tests:** re-point, never drop — `coach-payables` → the folded By-bill view,
`coach-payables-schedule` → the open By-due-date view, `coach-commitment` keeps its
`data-commitment="loaded"` ready-gate; UAT smoke spec URLs updated in the same change.

**Help + demo (same unit of work, per CLAUDE.md):** the Transactions and Payables help sections
merge into one Money-book article (three views, one book); the Club and Money-hub cross-references
re-worded; the coach demo tour has **no Payables stop** (verified — step 5 narrates the register
and reaches the bill page through it), so the tour needs a re-read, not a rebuild.

## 3. What is genuinely lost, said out loud

- **One nav certainty:** today "Payables" in the tab bar IS the owed-money door. After the fold a
  coach lands on Timeline and switches views. Mitigation options in decision point 3.
- **A tab-bar word:** the tab count drops 8 → 7 (with Club). The forms review still evaluates the
  Add-a-commitment FORM — the fold removes a face from its scope, not that form.
- Nothing else — §2 carries the keep-list control-for-control.

## 4. Decision points for the owner (asked in the mockup artifact)

1. **Go / no-go** on retiring the Payables tab at all. *(Round 2: owner "likes the proposals";
   formal go still open.)*
2. **Where does *Add a commitment* live** — all three views (recommended) or owed views only?
3. **Is the View remembered?** Recommended: per team per device (exactly like the Date preset).
4. ✅ **RULED 2026-08-28: the tab becomes "Ledger"** (owner, overriding the keep-"Transactions"
   recommendation). Section id `transactions` → `ledger` with the legacy rewrite carrying the old
   id; the coach-facing word now matches the org accounting module and house league, which already
   use "Ledger" for the same concept — treated as harmony (one word, one idea), verified not a
   two-meanings collision.
5. **Record-refusal wording** — sentence in the mockup (written assuming decision 6).
6. **NEW — one word for the object: "bill" vs "commitment"** (owner question round 2). The product
   uses both today ("Bills you owe" in the Record picker vs "Add a commitment"/"Commitments"
   export). Recommendation: **bill** — treasurer vocabulary, and the two doors become a clean
   opposition (*Add a bill — nothing moves · Record — money moved*). Sweep rides the fold release
   (door label, By-bill view labels, export title, help, tour). If "commitment" is kept instead,
   "Bills you owe" converges the other way.

## 4b. Round 2 (owner questions 2026-08-28) — answers now part of this plan

- **Two doors — the owner's real question was whether the NAMES communicate the split (future
  scheduled payables vs actual transactions), and the honest answer is NO, today.** "Add" vs
  "Record" are interchangeable verbs to a lay reader; "commitment" is learned vocabulary that does
  not say future-with-due-dates; "Record" leans on a bookkeeping connotation — and the future-date
  refusal inside Record is standing evidence the label routes people wrong. The split lives in
  subtitles + consequence lines + the refusal, i.e. learned by use. Decision 6 became a three-way
  naming choice (artifact table): **A "Add a bill"/"Record" (recommended — the object carries the
  future-ness the verb can't)**, B "Schedule a payment"/"Record" (says future loudest; loses the
  object, makes "payment" mean two records), C keep "commitment" (converge "Bills you owe" the
  other way). Whichever wins, the pair explains itself at the three moments it faces a coach with
  room for a sentence: the bill door's subtitle, a NEW empty-book state showing both doors with
  one line each (drawn), and the refusal hand-off. Structure stays two doors regardless (ruling B).
- **Fold scope vs the other tabs: FOLD PAYABLES ONLY.** Full transaction-type inventory + treasurer
  workflow read done (artifact carries the table). The model the product already implements is a
  treasurer's books: ONE general ledger (every dollar lands once — the register's one-row-one-source
  rule) + sub-ledgers by relationship (Player Dues = who owes us, by family; Fundraising = drives +
  sponsors; Club = the account with the club) + the plan (Budget) + the verdict (BvA, which reads
  the ledger and never re-derives). Dues/Fundraising/Club stay separate because their WORK is
  relationship-shaped (schedules, credits, reminders, approvals), not transaction-shaped; their
  dollars already report into the ledger as derived rows. Payables is the one tab with no
  relationship behind it — a bill's whole workflow is its own record page, which survives — so it
  folds without burying anything.
- **Reporting observations, noted NOT proposed:** no bank-reconciliation aid (tick rows against a
  bank statement); no single "season statement for the board" beyond BvA + exports. Ideas-backlog
  material; deliberately outside fold scope.
- **Add-a-commitment modal redesign — IN SCOPE for the fold build** (owner asked; design-agent
  review run against the standing rulings, 9 findings, before/after drawn in the artifact).
  Highlights: the triple-told intro collapses into the consequence line; "What is this?" →
  **"Filed under"** (kills the known two-questions collision and the circular placeholder);
  **"(optional)" removed** (violates the 08-26 required-marker ruling) — the fold names its
  contents ("+ Payee, tags, notes", the Record form's own pattern); "ONE PAYMENT"/"#1" noise
  drops (a control with one answer hides); Repeat monthly gets button chrome; schedule rows gain
  Due/Amount microlabels; the consequence line pins with the footer; the save button names what
  it creates. ⚠ This narrows the 08-24 "setup forms stay as-is" reaffirmation for THIS form only,
  owner-directed; the forms review keeps the rest.

## 5. What was built (2026-08-28, one pass — engineering record)

- **One panel instance** (`LedgerPanel`): the `face` prop and both wrapper exports retired; `view`
  state (`timeline`/`bills`/`due`) seeded from `localStorage` per team, persisted on change;
  `onPayables` survives as a derived "an owed view is on screen" flag (35 sites, deliberately not
  renamed); `groupBy` derives from `view`. The double-mount hazards (two `?bill=` editors, two
  record-signal listeners, doubled fetches) retired structurally with the second instance —
  guards' headstones updated to say so.
- **Addresses:** `CoachMoneySection` union: `transactions`/`payables` → `ledger` (compiler found
  every caller); `legacyMoneyAddress` maps all three generations of address (pre-split `expenses`,
  split-era tabs, rebuild-era `?tab=`) onto `ledger` + `?view=`; hub rewriter emits `?view=` and
  strips `?tab=`; `?filter`/`?scheduled` deep links force the Timeline view; `?from=` retired
  (the view memory answers where the back arrow lands); `view` joined ONE_SHOT_KEYS.
- **Controls:** the View pill (SingleSelectDropdown, lead slot, three options) replaces Group by
  and heads the Timeline strip too; controls swap per view; Add a bill in the toolbar actions of
  every view; export title "Bills" (dataset/filename stays `payables` — folder continuity);
  Timeline empty state offers Record (opens the conversation cold) + Add a bill; owed empty state
  reworded ("Nothing owed yet").
- **Bill form redesign** (per mockups minus deviations above): title "Add a bill", subtitle
  carries the teaching, intro paragraph deleted, "Filed under *" label (kills the "What is this?"
  collision), fold renamed "More — payee, tags, notes" (the "(optional)" marker violated the
  08-26 ruling), consequence line pinned in the sticky footer for the bill form only, refusal
  reworded to decision 5's sentence with "Make it a bill instead".
- **InstallmentPlanEditor:** "One payment" heading and "#1" suppressed on a single row; Repeat
  monthly moved beside + Add wearing button chrome.
- **Word sweep (6A):** copy map (`Edit bill`/`bill`/statedFact), tag-band noun, due-view caption,
  CommitmentView strings, MoneyMonthGrid notes, club panel cross-ref, MoneyRail rows
  ("Ledger"/"Bills" — two rows one tab, the Fundraisers/Sponsorships precedent), Import menu
  "Bills" + "bills schedule" shape (BudgetImportSheet title too), Upcoming Payables panel title →
  "Upcoming Bills", error strings. Identifiers/datasets/columns untouched by rule.
- **Sweeps and tests:** layout-screens re-pointed to `?section=ledger&view=…` with IDS KEPT (the
  baseline is keyed on them); UAT money smoke + membership smoke re-pointed (labels View/By bill/
  By due date, heading Ledger; one legacy `?tab=schedule` address deliberately kept as the
  rewrite-proof); `coach-budget-months` door expectations → "Open the Ledger";
  `dues-definition-guard`: `lib/insights-digest.ts` removed with a headstone (it stopped quoting
  dues — same session, unrelated change).
- **Help:** the two tab articles merged into one `premium-money-ledger` subtopic (three views, one
  book); nav/Record/club/tags/import/phone sections and FAQs re-worded; keywords + searchText
  gained the ledger/bill vocabulary while keeping the old words as search routes. ⚠ The stale
  "Leaving it blank records the cost as unpaid" help def was FALSE since ruling B (08-23) and was
  removed on the way past.
- **Demo:** tour step 5 re-pointed to `ledger` + `view=timeline` (stated explicitly so a
  prospect's remembered view can't re-aim the stop); full narration re-read per CLAUDE.md — all
  three sentences still true, no Payables stop existed, nothing added.
- **Verified:** typecheck ✓ (after typegen) · **2,679/2,679 unit tests** ✓ · check:spelling ✓ ·
  lint 0 errors (2 new warnings are the file's standing URL-reactive-effect pattern). ⚠ OWED to a
  dev-server session: `check:layout` (3 money screens + commitment page), `check:register`,
  `check:money-report`, `check:demos`, and a UAT money-smoke re-run (⚠ its "defect 3" drawer test
  looked stale from Part B BEFORE this change — expects a modal with Edit that Part B replaced
  with the page). Dev server must be RESTARTED before browser testing (shared modules changed).

## 6. Sequencing (as executed)

No migration. Built in one pass, not in parallel with any other session editing the shared panel.
The dead-columns cleanup prompt remains a separate session and does not touch these files' scope.

## 7. ✅ Round 3 (mid-§119-walk, owner-ruled AND BUILT 2026-08-28): A′ + C, word stays "bill"

The owner's walk raised the management question (with no Payables tab, where is owed money
*managed*?) and re-opened the word. Ruling: **"I kind of like A and C. I am fine to keep bills as
the name."** Both built the same day:

- **A′ — the views are PLACE-NAMES:** `Timeline · Bills · Payment schedule` (were "By bill" /
  "By due date"). "Bills" names the management home it already was; "Payment schedule" matches
  that view's own export title — the view and its file are one name. The honest diagnosis behind
  it: the fold lost no capability, only the name on the door — the surviving tabs (Dues,
  Fundraising, Club) each manage a RELATIONSHIP, and owed money's home wore a sort-order's label.
- **C — the Record picker gains a third group, "Not paid yet",** with one row ("We'll owe this
  later — set up a bill · Nothing moves today"). ⚖⚖ **RULING B STANDS AMENDED, NOT REVERSED:**
  the conversation still never CREATES unpaid money (no fork, no in-modal schedule editor); what
  it may do is HAND OFF, visibly — the row calls the same path as the future-date refusal
  (extracted to one shared function), the modal retitles to "Add a bill", and the coach's typing
  travels (amount/description/payee/tags; a typed date becomes the due date). The row is
  deliberately NOT a `ConversationBranch` — it answers no "What happened?".
- **The direct Add-a-bill door STAYS** through the walk (the invoice-in-hand moment); retiring it
  later is a one-line follow-up if the walk shows the row is where everyone goes.
- Swept with it: help (view names, the Record tip teaches both doors), UAT spec selectors
  (⚠ "Payment schedule" appears twice on the due view — the pill and the Export button, same
  name on purpose — so the spec asserts `.first()`), hub comments, both artifacts (mockup
  decision 7 marked ruled; walkthrough steps renamed + new step F4).
- **Rejected namings recorded** so they are not re-litigated: payable (treasurer-true but stiff),
  commitment (must be taught), the act-named no-noun package (runner-up), invoice / obligation /
  IOU / upcoming payment.

## 7b. ✅ The Add-a-bill design pass (owner-approved mockup + built, 2026-08-29)

The walk's Part E verdict on the form's presentation ("this still looks pretty awful") got its
dedicated pass (`COACH_ADD_A_BILL_FORM_DESIGN_PASS_PROMPT.md`). Mockup gate ran first — three
rounds on one artifact (`claude.ai/code/artifact/299f6bbc-4a6e-4cde-ba89-b85016676f0b`), approved
round 3. Structure and words untouched; three presentation decisions built exactly as drawn:

- **D1 — one surface, one header line.** The schedule's white inner card dissolved; rows sit on
  the tinted section. Header is one line (title left, Repeat monthly + Add right, both in button
  chrome — finding 5's target was the LINK dressing, not the row), count beneath only when >1.
  Phone: per-installment cards go white-on-tint; the repeat tray loses its white fill.
- **D2 — a real column-headings row** (Due date / Amount ($)) at desktop, the budget sheet's own
  idiom; hidden ≤640 where the stacked labels already serve. The reverted label-force headstone
  in the stylesheet now points at it. **Single payment renders no number gutter** — the lone row
  fills the section edge to edge (owner, round 3); the gutter appears with the #s.
- **D3 — one grounds story.** The picker (new per-caller `paperGround` opt-in, bill branch only)
  and the date fields wear the portal's standard paper ground/6px radius beside Description and
  Amount. §119's "deliberately NOT done" finding-9 entry is now done.
- Rider: the editor's controls meet the 44px tap floor ≤768 (were ~25px; the 2026-08-27
  touch-band ruling outranks the mockup's drawn size).

Playwright-verified live at 1440/390 (identical computed grounds across all four fields,
pixel-aligned headings both states, no inner-card paint, zero overflow, phone labels intact);
budget line editor re-rendered untouched; dues Generate Installments classes never edited. Gates
all green (typecheck · 2,692 unit · css-purity · spelling · lint). **§119 Part E's
structure/words-only caveat is lifted** — the full record is the rider in the QA ledger §119.

## 7c. ✅ The hand-off becomes reversible, and its row becomes an answer (owner-ruled + built 2026-08-29)

Using the live form, the owner found the asymmetry §7's option C had left: every "What happened?"
answer was revisable in place except the bill row — the one choice with no way back short of
Cancel discarding the typing. Ruled and built the same day (full record: QA ledger §119 rider 2;
binding entry in `memory/design_decisions.md`):

- **The row's words are an ANSWER now:** "We agreed to pay something later" (the agreement is a
  real event — the refusal's own grammar), replacing "We'll owe this later — set up a bill".
- **The hand-off mirrors both ways:** a coach handed into the bill form from the conversation
  keeps the "What happened?" control standing on the bill row; any other answer hands back with
  typing carried (a future schedule date deliberately stays behind). Ruling B2 untouched: the
  toolbar's Add a bill still asks nothing; ruling B still forbids a fork — both directions are
  announced hand-offs.
- ⚠⚠ **Fixed with it: the forward carry had been silently dropping the amount and date since the
  fold shipped** — written into the `dueDate` field P4 deleted. The typed figures now seed the
  schedule's first row, as the hand-off always claimed.
- Help's Record tip re-taught; Playwright-verified end to end on the live form.
