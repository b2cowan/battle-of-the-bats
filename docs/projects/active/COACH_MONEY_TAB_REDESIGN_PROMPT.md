# Kickoff prompt — the Money tab redesign: the form, the payables split, and the name
*(paste into a fresh chat)*

**This one prompt covers three things the owner grouped together on 2026-08-16**, because they are
one decision wearing three hats: **what belongs on the money form**, **whether a commitment belongs
on it at all** (§B — answer first), and **what the screen should be called** (§A.1 — propose
alternatives, do not just rule on one). ⚠ Do not split them across sessions; §B decides the shape
the other two are designed around.


⚠⚠ **THIS IS A PLANNING SESSION FIRST. Do not write code until the owner has approved a UX plan.**
The failure mode this session exists to avoid is *another increment*: the Money hub has been extended
by one tab per release for several releases, and the last one (`COACH_MONEY_IN_TAXONOMY_PLAN.md` §10)
closed by asking for exactly this pause. Produce the plan file + PM brief pair, publish mockups as
Claude Artifacts, get the owner's OK, and only then build.

**Trigger:** owner, 2026-08-16, at the close of the money-in release — *"get the new functionality in
and usable first, then plan how to make the Money screens more efficient."* A design conversation on
2026-08-16 then settled a large part of the money **form** in advance; that is recorded below as
decided, and it is the starting point rather than the output.

---

## Read first, in this order

1. **`COACH_MONEY_IN_TAXONOMY_PLAN.md` §10** — the four-point agenda this session was created by.
   §0 also lists three things that plan got wrong; read it so you do not repeat the corrections.
2. **The design proposal, 2026-08-16 (binding for the form):**
   https://claude.ai/code/artifact/b618c784-c050-4003-833b-b87d3cb708f7
   It carries the four states of the proposed form, the create-an-item flow, the payables split, and
   the reasoning for each. Everything in §"Decided" below comes from it.
3. **`COACH_MONEY_BACK_ON_A_COST_PLAN.md` §2 and §6** — ⚠⚠ the out-of-pocket trap and the seven rules
   a refund must keep obeying. **Not up for redesign.** §4.3's report rules are inherited whole.
4. **`COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md` §5, §10 and §11** — the three tiers of item, what was built,
   and the twelve findings `/review` caught. §11.1, §11.2 and §11.7 are the ones a picker change can
   reintroduce.
5. **`OWNER_QA_LEDGER.md` §29 and §38** — what a coach is supposed to be able to do today.
6. **The earlier binding mockups**, so the set stays coherent: `945391e9` (category + item),
   `ee76cc79` (money in, money out), `27d6d2df` (money back).

---

## ✅ DECIDED 2026-08-16 — do not re-litigate, do not redesign

The owner walked the form screen by screen and settled these. They are inputs.

| | |
|---|---|
| **The save button says `Save`** | One modal serves add *and* edit; three kind-named buttons were labelling a choice already visible two fields above. |
| **“Expense” replaces “A cost”** | On the money form **and** on the Budget Plan form — one word, one meaning. The tab is already *Expenses & Payables*. |
| **A refund is a tick box, not a third kind** | Two pills — **Expense** / **Income** — with **“This is a refund”** beside them. It flips the direction of the money and **never changes the list you choose from**: a refund on an expense still points at an expense item. That is what lets both lists be filtered. |
| **The item list follows the pill** | Expense shows money-out items; Income shows money-in items. **Categories are never filtered** — *Tournaments* deliberately holds both directions and that is what the by-activity lens exists for. |
| **A created item carries a direction** | An item a coach or club creates takes its direction from the control it was created under, and appears under that direction **only** — never in both. Owner ruling, and it overturns the earlier "leave it untagged" line in `COACH_MONEY_IN_TAXONOMY_PLAN.md` §3.6. Editable afterwards. |
| **One searchable picker** | `Category · Item` in one control, type-ahead, grouped by category, replacing the two dropdowns and the “What is this?” label. |
| **`Paid by` folds under `More`** | Rare, and the consequence line is what makes hiding it safe. |
| **The consequence line** | One line above the buttons stating what the record will do, in dollars — *“When you save: Facilities · Dome Time goes up $325.00 and cash on hand goes down $325.00.”* On an out-of-pocket cost it names the family and the credit. This is the replacement for the paragraphs of definitions, and it is the highest-value item in the proposal. |
| **The teaching copy moves out of the form** | Both comparison panels live on the tab empty states and in the help guide only. Twelve lines of explanation before the first input become about three. |
| **The date fix ships separately, FIRST** | See §"Not in this session". |
| ⚖ **NOTHING ON A SAVED RECORD IS READ-ONLY** | Owner ruling 2026-08-16, *reversing* the ruling of 08-15. Every figure and the paid date are editable after they have posted, and the team's books follow the correction — including what a family is owed on an out-of-pocket cost. **Do not design a lock back in.** Two refusals survive and are not locks: a pre-migration-236 record whose ledger entry cannot be matched unambiguously, and changing WHO paid a cost out of pocket. |
| **The form already has a `Date paid` field** | Landed with the date fix. The redesign inherits it — it is not something to add. |

---

## ⛔ SUPERSEDED DRAFTS — recorded so nobody rebuilds them

Four now. The first two are from earlier releases; the last two were drafted and killed inside the
2026-08-16 conversation itself.

1. **A separate revenue list** (`COACH_MONEY_IN_TAXONOMY_PLAN.md` §6). Dead.
2. **A direction column on the report** (`…` §8). Dead in every form — column, chip, icon or sign
   prefix on a mixed table. Sections carry polarity; a column cannot.
3. ⛔ **“Direction first” — a three-row switch.** *Out / In*, then *Expense / Refund*, then
   *Already paid / Not paid yet*. It filtered the lists correctly and it was **three stacked slabs of
   equal weight for three decisions of very unequal frequency**. The tick box reaches the same place
   with one control. Do not reinstate a direction question above the kind.
4. ⛔ **“Not paid yet” as a tick box on the date field.** Killed by the owner's own question — *what
   is the behavioural difference between ticking it and typing a future date?* There is none. Two
   controls expressing one fact is the same "asked twice" fault it was meant to remove. The answer is
   the payables split below, **not** a better toggle.

---

## The agenda — what this session must actually decide

### A · The four questions the money-in release put on the table (§10)

1. **The screen named *Expenses & Payables* now holds a *Money in* tab.** The name is the symptom;
   the question is whether money out and money in belong on one screen with four sub-tabs, or whether
   the hub's own tabs should carry them.

   ⚠ **THE RENAME IS IN SCOPE, AND IT IS NOT A ONE-OPTION DECISION.** The owner offered
   **“Transactions”** as *a* candidate (2026-08-16) and asked explicitly for **other recommendations
   alongside it** rather than a yes/no on that one word. So:
   - **Propose at least three names**, each with what it includes and — more revealing — what it
     implies is *excluded*. Test each against the four things the screen actually holds today: costs,
     commitments, arrivals, and a payment schedule. A name that quietly excludes one of them is the
     same defect *Expenses & Payables* already has.
   - ⚠ **Test the names against the answer to §B first.** If commitments move to their own door, this
     screen holds only things that HAPPENED — which makes “Transactions” much stronger than it is
     today, when the screen also holds things that have not happened yet.
   - **Say what each name costs.** A rename reaches the hub's tab, the money rail, the help guide,
     the demo tour and the rendered layout baseline. Name the surfaces, and whether any deep link or
     saved URL changes.
   - **Recommend one**, and say what would change your mind.
2. **Two levels of tabs.** A coach crosses the hub's tab bar and then a sub-tab row before reaching a
   row of money.
3. **Where a coach lands.** Overview, Budget Plan, Budget vs. Actual and Money in now answer
   overlapping questions; Budget vs. Actual alone has three views.
4. **What the money form has grown into** — largely answered by the proposal above; carry it in.

### B · ⚠⚠ ANSWER THIS ONE FIRST — the payables split, which decides the form's shape

⚠ **SEQUENCING, RULED 2026-08-16.** The form redesign (§C and the decided table above) and this
question are **one piece of work, not two that can run side by side** — and this half comes first.
The form's shape *depends* on the answer: if a commitment gets its own door, the money form loses
the deposit/balance pair, the due dates, the whole timing question and a branch of its consequence
wording. Design them in parallel and the form is designed twice, with the second design forcing the
first open — which is exactly the argument that merged the money-in and money-back plans into one
release (`COACH_MONEY_IN_TAXONOMY_PLAN.md` §7.1: *same form, same picker, same record shape*).
**Settle this, then design the form once, knowing the answer.**


**Proposed:** *Add money* records only what has already happened. A commitment gets its own door on
**Payables** — what, how much, due when, deposit/balance split — and **Mark paid opens *Add money*
pre-filled and asks when**, so money still has exactly one door and a promise becomes a transaction
through it.

**Why it is worth it:** the transaction form loses its last ambiguous control, a future date becomes a
plain error with a plain answer, both screens finally mean their names, and it fixes the date defect
from both ends at once.

⚠ **It re-opens “one Add door”**, settled deliberately when expense edit/delete shipped
(`COACH_EXPENSES_EDIT_DELETE`). The distinction worth putting to the owner: that ruling removed **two
doors to the same object**, which was duplication; this adds **one door per object**, and money itself
still has one. **Get the ruling re-made explicitly — do not assume it.**

### C · Smaller, but they need answers before build

- **Does the Budget Plan form follow the “Expense” rename?** (Recommendation: yes.)
- **Is a tick box safe enough for something that reverses money?** The mitigations are: the
  consequence line rewrites itself, the hint line changes, and the saved row states its kind in the
  list. ⚠ **None of them may rely on colour** — the overrun and healthy tones are near-identical to a
  deutan eye. If it still feels thin at build time the fallback is a two-pill version of the same
  choice, **never** a third kind.
- **Where does an income *reversal* list?** Money-out on an income row is a real event with an
  unobvious home — the *Money in* tab lists arrivals. Tidy it here rather than discovering it later.
- **The picker is shared by three surfaces** — the money form, the Budget Plan form and the club admin
  budget screen. A searchable control and an inline create flow reach all three; scope accordingly.

---

## 🔒 Constraints that survive the redesign — none of these are open

- ⚠⚠ **Money back is NOT “paid out of pocket.”** A coach says *"a parent paid me back"* for both and
  they are opposites: one returns the team's cash and owes nobody, the other means a family paid the
  vendor and **the team owes them a credit**. Any build must test one of each on the same item and
  count the credits — expect exactly one.
- ⚠⚠ **Nothing here ever changes a payment schedule.** Not a dollar of anyone's dues, on any kind.
- **A refund's report rules**: one row never two · dated when it arrived · brackets never a minus
  sign · **no row labels** (no "refund" chip, no "not budgeted") · an item may go negative and must
  not read as "under budget" · re-filing moves no money · no backfill.
- **One row, one source.** A row whose actual is derived from fundraisers/sponsors refuses a typed
  income record — warning on the form *and* refusal from the server. Money back stays allowed there.
- **Variance polarity**: revenue varies **up and down** (`+$480` / `−$160`), costs run **over and
  under** (`$150 under` / `$160 over`). Colour never carries it alone.
- **The item tiers**: platform → club → team, one direction only. A team's item never reaches another
  team's picker; publishing is a promotion that absorbs duplicates and repoints their lines.
- **The archive is opt-in** (see `CLAUDE.md`). Any new route serving a past season must be added to
  the allow-list deliberately, and every page below the door must carry the season.
- **Sport-neutral vocabulary** — the reason the library ships "Officials" and not "Umpires".

---

## The fixture — already prepared, do not rebuild it

**`qa-money-lab`** (`node --env-file=.env.local scripts/seed-qa-day-fixtures.mjs money`) was upgraded
on 2026-08-16 to carry the category+item shape, and it **repairs an existing lab in place**:

- **QA Money U13** — 7 cost lines / **$8,500** (two of them on one item, so the summing rule is
  visible) + a **$2,000 expected-fundraising line** whose actual is derived from the Spring Bottle
  Drive (**$374.40**, the team's 60% share of $624 raised). Spending **$4,380**, including **$180 on
  Events · Photo Day that nobody budgeted**. A **completed prior season** sits behind it with
  deliberately unlike figures — the archive leak check.
- **QA Mid Season U14** — Gio's family holds one **$120 reimbursement credit** from a seeded
  out-of-pocket cost; Hal and Cam hold none. This is the fixture for the credit-count test.
- **QA Money U11** — deliberately empty.
- **Logins** — `qa-money-head@dev.local` and three capability variants, plus
  **`qa-money-admin@dev.local`** (org admin, on no team — added 2026-08-16 so the club half of the
  item ruling is walkable). All `devpass123`.

The **owner QA walk** for §29 and §38 is published and current:
https://claude.ai/code/artifact/25b91df9-f8ef-47f5-9ed8-8683e914abf5

---

## ⛔ Not in this session

- **The date defect fix, and the editability change that followed it.** Both were built on
  2026-08-16 and are landing ahead of this session. Between them the form gained a **Date paid**
  field, **Mark Paid** on all three buttons asks *when* instead of stamping today, a future date is
  refused, and **every figure on a saved record became editable with the team's books following the
  correction** (the 08-15 figure lock is retired). ⚠ **The redesign inherits all of that** — none of
  it is yours to add, and the lock is not yours to reinstate. Read the "decided" table above.
- **Changing WHO paid a cost out of pocket.** Still refused, deliberately: it moves a debt between
  households rather than restating a figure. It is a live open question, and its own decision.
- **Running the owner QA** for §29/§38. Separate track, separate artifact.

---

## What “done” looks like

- A **plan file + PM brief pair** in `docs/projects/active/`, one summary line in `TODO.md` linking to
  the plan.
- **Mockups published as Claude Artifacts** — matching the token set of the existing four so the
  series reads as one body of work.
- A **plain-language UX summary presented in the conversation before any code**, per
  `AGENCY_RULES.md`. This is blocking.
- The **decided** table above carried in verbatim, and the **superseded** list carried in with it so
  the next reader does not rebuild a dead draft.
- Follow-through named, not assumed: **help docs** (`/docs`), the **demo sandboxes** (a form this
  central appears in the coach tour), and the **layout baseline** if any screen name or route moves.

## Environment notes (verified 2026-08-16, re-check before relying on them)

- §29 and §38 are **on dev only**. §29 carries migrations 238/240/241/242; §38 carries 243 and 244.
  All of them must reach production **before** this code promotes.
- ⚠ **Other chats work in this same working copy.** Re-check the branch before committing, stage
  explicit paths only, and expect files you did not touch to be modified.
