# The dues forms — implementation plan

**Owner-ruled 2026-08-30 (Owner QA Ledger §123, all six questions answered A, no amendments).**
Second project out of the money-forms review, after the sponsorship lifecycle. Evaluation and
approved mockups: `claude.ai/code/artifact/b0038f4f-411b-4ffe-99c6-9a32794b3b57`
(source `docs/projects/active/COACH_MONEY_DUES_FORMS_MOCKUP.html`).

**No migration. Nothing here changes the schema.** Every fix is a guard, a query, a sentence or a
class.

---

## 1 · What this is

Five forms — the bulk generator, the single-player schedule editor, Add a credit, the payment
correction, the season-settlement refund sheet — measured against the grammar the recording
conversation now embodies. Two of the findings are on the write path and are the reason this
project exists; the rest is the same consistency work the sponsorship walk did one tab over.

⚠ **The scope decision is not under review.** These forms stay where they are (charter §2,
reaffirmed by the owner 2026-08-24). Nothing here folds a setup form into the conversation.

---

## 2 · Build order

The phases are ordered by harm, not by convenience. **A must land first** — everything else is
cosmetic beside money that has already left the building.

### Phase A · The floor (Q17) — write path, no design

**A1 · The reconcile counts its own credits.** The overpayment reconcile is shared by both schedule
doors. It reads only credits attached to a payment, so the standalone credits it writes on a
schedule change are invisible to it — they stack on repeated lowerings and never clear when a total
goes back up. The fix is *which credits it counts*, not the arithmetic: it must see every
overpayment credit for that player in that season, however it was born.

- ⚠ **The existing unit test passes straight through this defect.** It exercises the pure function
  with the stale credit handed in by hand, so it is right and useless here. The regression test must
  cover **the seam** — the query plus the function — with the two sequences from §123: lower twice,
  and lower then restore.
- ⚠ The distinction the fix must preserve: a credit riding a payment is removed by CASCADE with that
  payment; a schedule-change credit is standalone and manually deletable. Counting them all is not
  the same as treating them all the same.

**A2 · Both schedule doors ask the payout floor.** The shared floor already exists, already has its
sentence, and is already called by three doors. Neither dues-schedule route reads the payouts table
at all.

- **Pre-flight, never post-write.** This is the P4 lesson and it is binding: a guard that refuses
  after an irreversible write strands the record forever.
- The refusal carries a door — *"Open Riley's payouts"*, landing on that player's record. This is
  the review's Q8 pattern arriving early because this refusal has nowhere else to send anyone.
- **The bulk door needs a per-player answer.** A roster-wide re-run must refuse the affected
  families by name and complete for everyone else, in the shape the replace step already uses —
  never fail the whole run, and never write past a family it cannot safely write.
- The bulk success state currently *reports* the doubled credit as though correct; it must report
  what A1 actually creates.

**Gate:** the money-lifecycle UAT spec gains both sequences and is **RUN**, not just written.

### Phase B · Truth and safety, small (no rulings needed)

- **The refund sheet's invisible failure.** A failed save writes into the settlement window's error
  slot, which is behind the open sheet — the Save button just stops spinning. The message belongs
  inside the sheet the coach is looking at.
- **A blank "set amount" saves as $0.** An empty or unparseable box must refuse, naming the
  alternative: *"Pick 'No share' if that is what you mean."*
- **Gate the two read-only doors.** Exactly two controls in the player drawer render for a
  view-only money assistant — *Edit schedule* in the actions row and *Set dues schedule* in the
  no-schedule empty state. Every payment and payout control beside them already gates correctly;
  the credit cluster (add / pencil / delete) is the third and is fixed here too.

### Phase C · One grammar — the future-date rule (Q18)

"Record is for money that has already moved" is enforced on money out and, since 2026-08-29, on
sponsor arrivals. It does not exist on any dues door.

Three doors and both servers, in the arrival's exact words —
***"That hasn't happened yet — an arrival is money that has already come in."***, adapted only
where the noun demands it:

1. the recording conversation's dues branch (picker ceiling + client sentence);
2. the drawer's payment-correction form (picker ceiling + client sentence);
3. the payment POST and PATCH routes (the refusal that actually binds).

⚠ **Unlike the spend branch there is no door to hand the coach to.** A future dues payment is not a
bill — the family's installment schedule *is* the promise — so the sentence names that and stops.
Do not invent a hand-off.

⚠ **Why this matters beyond tidiness:** a future-dated receipt drops the family's bill today and
posts its books entry on the future date, so the money lands in a later month's income and Budget
vs. Actual while the screen says "shows on the ledger right away".

**Scope note:** the drive branch's *Date received* shares the field and the same absence. It belongs
to the fundraisers walk, but it is one line in the same pass — do it, and say so, rather than
leaving the third door out of step.

### Phase D · The words commit (Q20) — one pass, one review

- **One name for the bulk act: "Set dues for all players".** It wins on the window title (retiring
  the last Title-Cased window in money), on the confirm button, and on every entry point that says
  "Generate installments" today — the budget tab, the money overview, the setup checklist and four
  strings in the help guide.
  - ⚠ **One spelling, everywhere a customer can read it.** The help articles' `keywords` /
    `searchText` move with the prose, or search stops finding the article it describes.
  - The internal comments that quote the old name should be trued up while the file is open; they
    are not the product, but a stale name in a comment is how the next reader learns the wrong one.
- **The correction form names the receipt it is replacing** — *"Correct a receipt — $120.00,
  Aug 12"*. The structural fix for the August Critical landed; the sign never did, and the code's
  own comment says so.
- **Capitalization.** *+ Add Credit*, *Save Credit* and *Send Due Reminders* go to sentence case
  beside their neighbours. One button currently changes scheme with its own state.
- **The credit form's default date** is fixed when the page loads rather than when the form opens —
  a tab left open overnight pre-fills yesterday.

### Phase E · The consequence sweep (Q4 — "all seven")

Q4 is ruled for the **whole review**, not just this cluster. Three of its seven forms are here:

- **Add a credit** gains its landing sentence, computed from the shared arithmetic and quoting the
  team's own credits-reduce setting: *"When you save: nothing changes hands — Riley's family owes
  $60.00 less, taken off their last payment first."*
- **The schedule editor** gains the live reconcile its bulk sibling already runs, in the sibling's
  words: *"3 installments, $1,200 — matches the total."* Today the same comparison arrives only
  after Save, as an error quoting two figures.
- **The refund sheet's three options each state what they produce**, chosen or not. Today only the
  already-saved option shows dollars, and it loses them the moment the coach picks another — the
  figure disappears exactly when they start comparing.

The remaining four (the sponsor consequence, the fundraiser edit twins, the budget line's "nothing
moves") belong to their own walks and inherit Q4 as a decided input.

### Phase F · Shape (Q19 "all of it", Q21)

**F1 · The schedule editor moves onto the shared row component.** It is hand-rolled inline layout
today — a pinned 7rem amount box and a date field told to fill, which measures 112px beside 809px on
a desktop. The generator's row already solves this and already becomes a labelled card below 640.

- ⚠ **Scoped variant, not a shared-class edit.** The row classes are shared with the budget sheet
  and the bill editor. The bill editor's own scope is the precedent to copy: a surface prefix class,
  its own card treatment below 640, its own 44px floor below 768 through the tap token.
- **Before/after proof that the budget sheet and the bill editor did not move** is part of the
  deliverable, not a courtesy.
- Desktop: the amount and date share the row equally, labelled once at the head.

**F2 · Tap floor.** The remove-installment "×" measures 21×21px and carries no accessible name;
"+ Add installment" is 25px tall. Both sit under the 44px floor that holds to 768.
⚠ **They survived because the layout gate cannot open a drawer** — the same blind spot §122 recorded
for the unbaselined fundraising screens. Whatever fixes these should leave a way to see the next one.

**F3 · The heading.** *"Dues schedule"*, with *"Just this family. Everyone else keeps theirs."*
⚠ **Not the player's name.** The drawer's title bar already carries it in both states; repeating it
an inch below is the restatement §121 deleted from the sponsorship expansion (owner, during this
walk). A heading in that drawer earns its line by saying what the title bar cannot — which form
this is, and what it does not touch.

**F4 · Discard guard (Q21).** The schedule form and the credit form get the generator's guard: a
stray click outside the drawer currently throws away a hand-built hardship schedule with no warning,
while the same act for the whole roster refuses to close without asking.

**F5 · Stack the two-column rows** in the credit and correction forms.
⚠ **These are NOT defects.** Measured at 360px they are 133 / 157 / 300 / 145 / 145px with nothing
clipped — the first pass overstated it. They ride along with F1 because the pass is already open;
if the pass gets cut, these come off first.

**F6 · The refund options expose their selected state** to assistive tech.

---

## 3 · Explicitly out of scope

- **The one-taps** — *Record as paid* / *Record rest as paid* stay question-free, forever.
- **Recording a dues payment cold** — the one conversation owns it. Only its *date* is in scope,
  under Phase C.
- **Team settings → Money**, the club tab's installments, phone money tables — other sessions.
- **The relabelling of a sponsorship credit's "Fundraiser" chip (SP-8)** — the sponsorship package's
  words commit. Visible on a dues surface, booked there, not here.
- **The dues drawer's four money tiles** — measured at 360px, they hold. Not a finding.
- Absorbing any of these forms into the conversation.

---

## 4 · Sequencing and traps

- ⚠ **Land after §122's commit.** The guarded-deletes work built on dev 2026-08-30 touches the same
  shared modules, and a concurrent club-money refactor was turning the gates red on files this work
  never touched. **Attribute a red gate to a file and an mtime before believing it is yours.**
- ⚠ **Migrations 268, 269 and 270 are prod-owed** from the sponsorship work. They are not this
  project's, but nothing here should promote ahead of them.
- ⚠ **Phase A changes shared money arithmetic.** The realised-only readers, the settlement pot and
  Budget vs. Actual all sit downstream. Pin behaviour with tests before touching it.
- ⚠ **Never a new credit kind.** A third enum member broke nineteen readers in August. Everything in
  this plan is a label, a guard or a query.
- **Help docs**: Phase C and Phase D change a user-facing flow and a name a customer reads — offer
  `/docs` in the same unit of work.
- **Demo sandboxes**: the coach demo's money narration has gone stale across three consecutive
  releases. Phase D renames a door the tour may name. Re-read it in the same unit of work.
- `/simplify` is worth offering after Phase F — F1 deletes hand-rolled layout in favour of an
  existing component, which is the shape that pass exists for.

---

## 5 · Done means

- Both write-path defects closed, with a regression test on **the seam** and the money-lifecycle UAT
  spec extended and **run**.
- No dues door accepts a receipt dated in the future — client and server.
- One name for the bulk act on every surface a customer reads, search terms included.
- The three consequence sentences live, computed from the shared arithmetic.
- The schedule editor on the shared row component behind its own scope, with before/after proof the
  budget sheet and bill editor are unmoved.
- No control in these forms under 44px below 768.
- Owner QA gets a new ledger section on completion.
