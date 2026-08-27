# Build prompt — Part B: the commitment page edits itself

**Written 2026-08-26, while Part A was still under review. Open this in a FRESH session, and only
once Part A has landed** — B builds directly on the door count A closed, and starting early means
re-deriving it.

**Read first:**
1. The drawn options and the door count that produced them —
   `https://claude.ai/code/artifact/86bd02fc-79b5-4d52-8d2f-e2cecb1b811b`. **Option B is the spec.**
   ⚠ Mockups are the spec in this repo, *but the code outranks the mockup* — see §3.
2. Owner QA **§104 Part A3** — the commitment sub-view as it was walked, including what Part A did.
3. `docs/projects/active/COACH_PAYABLES_REBUILD_PLAN.md` — the schedule's own rules.
4. `memory/design_decisions.md` — the 2026-07-09 binding layout rule, and the 2026-08-22 convention
   that a form field choosing one value is a **dropdown**.

---

## 1 · HOW THIS BEGINS — BLOCKING, NO CODE BEFORE IT

Present, then WAIT for the owner's go:

1. A **PM-voice summary** of what a coach does differently.
2. The **verified inventory** — from the tree, not from this prompt.
3. **§3's question, answered with a recommendation.** It is the one thing that must be settled
   before a line is written, and it is not a detail.
4. Anywhere the code forces a deviation — raised, never quietly resolved.

---

## 2 · WHAT B IS

Part A closed the duplicate doors. **B answers the owner's original question — *"if we are making
this a screen, why do we need Edit to open a modal?"***

- **Everything readable becomes editable in place**: the bill's name, its filing (category · item),
  **payee**, **tags**, **how**, **notes**. Tap the value, it becomes a control, it saves.
- **The header loses its last button.** `Edit details` goes; the header carries only the way back.
- **Empty fields become invitations** — *"Add a note"* rather than a row that isn't drawn. Today an
  unset field is omitted entirely, so a coach cannot tell a bill *has* no note from the product not
  offering one.
- **Delete moves to the foot of the page**, quiet and destructive-styled.
- **What KEEPS its dialog, and this is the line the whole phase draws:**
  > **A modal is for a QUESTION, not for a field.**
  `Change` and `Remove` on an installment ask a real one — *this payment, this and the later ones,
  or all unpaid?* Recording money keeps the one conversation (standing ruling; a payment touches the
  books, the schedule and sometimes a family's credit). Typing a payee asks nothing.

---

## 3 · ⚠⚠ THE BLOCKING QUESTION — TWO EDITORS FOR ONE RECORD

**Verified in the tree 2026-08-26.** The shared money form is still reachable for a commitment from
somewhere else entirely: **a commitment's row in the Transactions register opens it in edit mode**
(`RegisterOpen.kind === 'expense'` → `openEdit(record)`). It edits the same payee, tags, method and
notes this phase is about to make inline.

So the moment B ships, the same fields have **two editors** — which is precisely the disease the
money-centralization project exists to cure, arriving through the back door.

**Three ways out. Recommend one, do not pick silently:**

- **(a) The register re-points.** A commitment row in Transactions opens the commitment sub-view
  instead of the form; the shared form keeps ordinary costs and arrivals. **Recommended** — one
  record, one editor, and it matches what tapping the same bill on Payables already does.
  ⚠ Check what else depends on that row opening the form before committing to it.
- **(b) Keep both, deliberately.** Only defensible if written down with a reason, and it should be
  argued against.
- **(c) Narrow the form.** On an existing commitment the form drops the fields the page now owns.
  ⚠ Risky: the same form is the CREATE door (`Add a commitment`) and needs every field there.

⚠ Whatever is chosen, **the create path must keep working in full**. `Add a commitment` is a setup
form of the same standing as *New Fundraiser* — that is a standing owner ruling from P2, not a
detail to trade away.

---

## 4 · REUSE, DO NOT INVENT — the portal already saves in place twice

There is no generic inline-edit primitive, and **this phase should not be the one to invent a third
save idiom**. Two precedents exist and both are ratified:

- **The plan-template editor** — debounced autosave with a status pill, and one rule worth copying
  verbatim: *"an explicit submit rejects an empty name; autosave must NOT, because the coach is
  mid-typing"* — so a blank value simply doesn't save yet, nothing is discarded, and the status says
  why.
- **The development session run screen** — *per-cell autosave with the quiet ✓ idiom*, ratified in
  the design log.

Pick one, say which and why, and use it for every field on the page. ⚠ Six fields with five save
behaviours is worse than a modal.

---

## 5 · THE FIELDS ARE NOT ALL TEXT — size this honestly

Only **notes** is a plain box. The rest are compound controls that already exist and must be reused
rather than re-skinned:

| Field | What it really is |
|---|---|
| Name | text |
| Filing | the grouped category · item **picker** |
| Payee | the payee **search combobox** |
| Tags | the tag **combobox** (with the org/team swatch) |
| How | the **free-text method combobox** that learns a team's own words |
| Notes | textarea |

⚠ **The amount is NOT a field.** A commitment's total is the sum of its installments — it is edited
on the schedule, by the row controls, and nowhere else. Do not add an amount field.

⚠ **Form selects are DROPDOWNS**, never segmented pill rows (owner convention, 2026-08-22).

---

## 6 · TRAPS

- ⚠⚠ **THE CONSEQUENCE LINE IS LOST IF NOBODY CARRIES IT.** The form tells a coach what a save will
  do — *"$X of this has been paid… changing a figure that has already been paid updates the team's
  books too"*. Payee, tags, how and notes move no money, so inline saving them is safe — **say so in
  the plan rather than discovering it late**, and make sure nothing that DOES move money became
  inline by accident.
- **Delete must not get weaker on the way down the page.** The form's delete reverses what the bill
  posted and states it **in dollars first**. The page's delete is the same act and needs the same
  confirmation — one delete path, not a quieter second one.
- **Read-only money coaches see VALUES, not editors.** Everything on this page is already readable
  for them; nothing may become a control.
- ⚠ **The unsaved-changes story changes shape.** The form has a discard guard; six independent
  fields do not. Decide what happens when a coach edits a value and navigates away — and note that
  leaving the page is now an ordinary Back, which is *easier* than closing a modal was.
- **The page-actions guard will fail, and it should.** Its `SITES` row for this header says the
  actions slot holds `Edit details`; if the header ends with no actions, that row becomes
  `actions: null`. Update the guard, do not weaken it.
- **The tap floor comes from the SURFACE a control sits on.** Every new editable slot is a new
  surface and inherits no floor. Verify at 390px.
- **`check:layout` CAN see this page** — it is a sub-view, not a modal. There is no excuse for an
  unswept state here. ⚠ But it cannot *type*, so the editing states themselves are owner-QA
  coverage only.
- **Concurrent sessions on `dev`** — explicit pathspecs, `git show --stat HEAD` after every commit.

---

## 7 · EVERY PHASE CARRIES THESE

Typecheck · focused lint · unit tests (**the page-actions guard especially**) · `check:register` ·
`check:money-report` · `check:layout` on the money faces at 361/390/768/1440 · `check:demos` ·
**help docs re-read** (any guide describing how a commitment is edited) · **both demo sandboxes
re-read** · a new **Owner QA ledger section** · TODO + the Payables plan updated in the same unit
of work.

---

## 8 · WHAT B MUST NOT DO

- **Do not make recording money inline.** One conversation, standing ruling.
- **Do not inline the installment rows.** Change and Remove ask a scope question and keep their
  dialog — that is the phase's own principle, not an exception to it.
- **Do not add an amount field.**
- **Do not touch Part A's door count.** Record stays on the rows and the hub; `Add an installment`
  stays under the schedule.
- **Do not spread inline editing to other screens on the way past.** This is one record's page.
