# A budget line asks one question, not two

**Status:** ✅ **BUILT 2026-09-07** — migration 280 applied to dev · **PM brief:** `COACH_BUDGET_LINE_ONE_QUESTION_PM_BRIEF.md`

## What shipped (2026-09-07)

Everything in §3 and §5, plus the three questions §4 and the build prompt left open, answered by the
owner on the day:

- **The question is a DROPDOWN, not the mockup's two radio rows.** The 2026-08-22 convention says a
  field picking one value is a dropdown and radio-rows-with-sub-lines are reserved for a choice that
  cannot be changed afterwards; a budget line's direction is correctable forever, so it does not
  qualify. Owner rulings outrank approved mockups, and the owner confirmed this one.
- **The item rows carry the TAG ALONE**, without the mockup's sub-line saying the same thing in
  other words — the 2026-09-04 ruling that cut the three describing captions under *"When does this
  money move?"*, applied one screen over. Real rows also carry the Standard/Club/Our own chip the
  mockup omitted, so a sub-line would have made three labels per row.
- **The source is a COLUMN on the word** (`budget_items.actual_source`), not a name-keyed lookup of
  the eleven standard words. It survives a club renaming a word, and migration 248 deliberately
  allows a club's *Grant* and a team's own *Grant* to coexist — a name-keyed lookup would have made
  a coach-invented "Grant" sponsor-sourced, breaking §3.1's own default.
- **§4's prod question is answered: NO disagreement exists.** Every money-in budget line on dev (5)
  and on prod (1) points at a **platform** word and already used the obvious pairing, and there are
  no club- or coach-created money-in words on either database. All 48 dev lines derive exactly the
  kind they already store. Nothing needed surfacing and nothing was migrated over quietly.
- **The kind is derived on the SERVER and neither write door accepts one any more**, so §5's
  "impossible pairing" gate is met by unexpressibility rather than by refusal. A guard test holds
  that rule over both routes, with a self-proof that it can still see the three shapes it retired.

⚠ **One accepted narrowing, ruled rather than discovered.** A word a coach or club invents is born
*typed* (§3.1), so a coach can no longer have the drive machinery report against their own invented
income word — they use the standard *Fundraising drive*. Nothing on either database used that.

## What `/simplify` and `/review` changed (2026-09-07)

**`/simplify`, four lenses.** Reuse and efficiency came back clean. Two real findings, and a third
fell out of the same reading:

- **The shared item picker was being taught a money vocabulary** — a boolean flag plus the tags’
  English and CSS classes keyed to money values, inside a control the Budget Plan, the Club tab and
  the Org Budget all render, and directly against that component’s own header rule (*“THE CONTROL
  LEARNS A GROUP, NOT A DOMAIN”*), which already records a near-miss on the identical mistake one
  prop earlier. It now takes a domain-blind row-tag hook and this screen owns the words.
- **Three seed scripts could still write a kind that disagreed with its word**, including the one
  that builds the public demo. Every pairing happened to be right; nothing enforced it. ⚠ Migration
  246 made exactly this point about `direction` — *“every insert path is updated in the same unit of
  work”* — and named the demo seed among them; this change had done that audit for the two API
  doors only. All three now derive, and the owner-QA fixture hard-stops on a disagreement.
- **The budget importer’s guard** against overwriting a money-in line named only two of the three
  money-in kinds — its comment claimed “both kinds” while a third had existed since 2026-09-02 — so
  an `other_income` line was open to being overwritten with a cost row’s word and amount, which is
  this project’s own defect arriving through the one door that does not go through the derivation.

**`/review`, high-risk tier, five lenses.** Security/tenancy and regression/blast-radius came back
clean (the change removes a client-trusted field and replaces it with a server derivation off an
already-authorised lookup; the new column has no reachable write path for any coach or club).

- **A real defect on a door this plan never looked at.** *What am I forgetting?* — the checklist of
  standard words under the plan list — is not filtered by direction, and should not be. But its chips
  handed the form only a category and an item, so a money-IN word opened the form on the SPENDING
  side with that word already chosen. ⚠ **It was worse before this change, which is why it
  survived:** the server then trusted the client’s kind, so the line was STORED as a cost — money
  coming in filed as spending, inflating what every family is asked to pay. Fixed.
- **The derivation now throws on a source it has never heard of.** It returned `undefined`, which
  `JSON.stringify` drops from the write, so Postgres substituted the column default and the row
  would have been stored as a cost — silently. A loud failure on a developer’s own mistake is the
  cheaper of the two.
- **Two guards that disarmed themselves** — the demo seed’s kind lookup falling back to ‘cost’, and
  the fixture’s guard passing through when its own query failed — both now stop.

⚠⚠⚠ **RELEASE ORDER, and it is the one thing on this page no gate reports as a blocker.**
Production’s `rep_budget_lines_line_kind_check` still admits only `(’cost’,’funding’,’sponsorship’)`;
`other_income` arrived in migration 274 and is prod-owed alongside 280. And `other_income` is what a
TYPED money-in word derives — now the ordinary case, not a rare one. **274 and 280 must ride the same
promote as this code.** The dependency pre-dates this change (the old form offered “Expected other
income” as one of four answers); what changed is that it went from a rarely-chosen answer to the
default path.

⚠ **Two consequences recorded rather than changed.** (1) The kind follows the word on every save, so
a future reclassification of a platform word re-files every line already on it at the coach’s next
save of that line, for any reason. That is the design — a line permanently disagreeing with its word
is the defect being removed — and only a migration can trigger it, but it makes a future
reclassification a decision about other people’s plans. (2) A team budgeting BOTH *Sponsorship → Team
sponsorship* and *Fundraising → Grant* now has two sponsor claims in two CATEGORIES, so the sponsor
pool places with no category at all rather than against either line. Already reachable before this
change; now the only way a grant can be filed — **the strongest argument yet for §3.3’s open question
of whether Grant should also MOVE to the Sponsorship category**, where both claims would share one
category. No team is affected today: there are no Grant lines on either database.
**Raised by:** the owner, 2026-09-07 — *"when selecting a budget for sponsorship, why are we
offering all of these other items? does selecting sponsorship and then selecting concession revenue
make sense? … does the line item just need to be split into expense and revenue at the top and then
based on what the user picks as the category item we bucket appropriately?"*
**Mockup (owner-approved):** https://claude.ai/code/artifact/3913e207-d697-402b-b6eb-0468d38fd3cb
**Build prompt:** `COACH_BUDGET_LINE_ONE_QUESTION_BUILD_PROMPT.md`
**Parent:** `COACH_MONEY_IN_TAXONOMY_PLAN.md` built this shape (mig 243). This refines it.

---

## 1. What is wrong today, measured

Adding a budget line asks **two** questions. First *"This line is…"* — **Expense · Expected
fundraising · Expected sponsorship · Expected other income**. Then *"Category & Item"* — the whole
money-in library.

### 1.1 ⚠⚠ The two questions can contradict each other, and the picker allows it

The item picker filters by **direction** (money-in kinds see money-in items) and **not by the kind
just chosen**. So *Expected sponsorship* + *Tournaments → Concession revenue* is offerable.

**That is a trap, not untidiness.** The kind decides where the row's ACTUAL comes from
(`LINE_KIND_ACTUAL_SOURCE`): a sponsorship line takes its actual from sponsor arrivals **and closes
the row to typed income**, deliberately, so the same dollar is not counted twice (§4.1 of the parent
plan). A coach who makes that pairing gets a budget line they can never record their concession
takings against, with nothing on screen explaining why.

### 1.2 In practice nobody has ever used the second question

Measured across **every** money-in budget line on dev, 2026-09-07:

| Stored kind | Category → Item | Lines |
|---|---|---|
| `funding` | Fundraising → Fundraising drive | 3 |
| `sponsorship` | Sponsorship → Team sponsorship | 1 |
| `other_income` | Other Income → Interest | 1 |

**Every row already uses the obvious pairing.** The second question has never carried information;
it has only ever carried risk.

### 1.3 And the two questions are two names for one thing

The kind drives the section headings on the plan list, the summary ladder, the period grid and
Budget vs. Actual (`LINE_KIND_SECTION`: *Costs · Expected fundraising · Expected sponsorship ·
Expected other income*). The **category** drives the grouping on the Statement (*Fundraising ·
Sponsorship · Other Income · Tournaments*). **Two parallel vocabularies for the same shelf**, kept in
step by the coach answering both questions consistently.

## 2. ⚠⚠ WHAT THIS DOES NOT REVERSE — read before designing

`COACH_MONEY_IN_TAXONOMY_PLAN.md` §3.2 ruled: *"**Do not add a kind for direction.** … Sponsorship
stays a distinct money-in kind **because sponsor records depend on it**."*

**That ruling stands and this plan depends on it.** The distinction between *"you type this actual"*,
*"a drive reports it"* and *"a sponsor reports it"* is load-bearing — remove it and player rebates,
the derived pools and the never-both rule all break at once.

**This plan does not delete the distinction. It moves where the distinction is DECLARED** — from a
question the coach answers to a property of the item they pick. One question, same three sources.

## 3. The design

### 3.1 One question, then the item

> **This line is:** ◯ Money the team spends  ◯ Money coming in
>
> **Category & Item \*** — filtered to that direction, exactly as today.

The item then says where its actual comes from:

| Item | Actual comes from |
|---|---|
| Fundraising → Fundraising drive, Merchandise sales | **a drive** |
| Sponsorship → Team sponsorship | **a sponsor** |
| Fundraising → Grant | **a sponsor** — see §3.3 |
| Other Income → *, Tournaments → * | **the coach types it** |
| Every cost | **the coach types it** |

⚠ **A COACH-CREATED ITEM DEFAULTS TO "THE COACH TYPES IT".** A custom item has no machinery behind
it by definition, and defaulting it to a derived source would close the row to the only way its
money can be recorded — the exact failure §1.1 describes, arrived at from the other side.

### 3.2 The stored kind survives, derived rather than asked

Nothing about the stored enum has to change on day one. The form computes it from the item and
saves it exactly as today, so every reader — the guard test over the whole source tree, the section
headings, the derived pools, `expectedFunding` — keeps working untouched.

⚠ **RESIST COLLAPSING THE ENUM IN THE SAME CHANGE.** It is reachable from the plan list, the ladder,
the period grid, the report, the exports and a guard test. Removing the second QUESTION is a form
change; removing the KIND is a migration across six readers, and bundling them makes the first
impossible to review.

### 3.3 ⚠ "Grant" is filed wrong, and this change surfaces it

**Grant sits under the Fundraising category.** But the sponsorship option's own description reads
*"a business sponsor, **a grant**, anything given directly rather than raised by selling"* — so the
product's two halves already disagree about what a grant is.

Today a coach budgeting a grant must either:
- pick **Expected fundraising** → its actual is pulled from bottle-drive entries, which will never
  contain it; or
- pick **Expected sponsorship** → the row reads under *Fundraising* on the Statement.

Neither is right, and today the coach must choose which way to be wrong. **Under §3.1 the item
decides, so the contradiction has to be resolved rather than passed to the coach.**

**Recommendation: a grant is sponsor-sourced.** It is given directly, it arrives as a cheque, and
the sponsor machinery already models exactly that. Whether it also MOVES to the Sponsorship category
is a second, smaller question — the category is the report's shelf, and a club may reasonably want
grants shelved with fundraising.

⚠ **This is a library change and library items are shared.** Migration 240's three-tier ownership
means a standard item is not any one club's to redefine — check what an org-level override does to
a source before writing one.

### 3.4 What a coach stops seeing

The words *Expected fundraising*, *Expected sponsorship* and *Expected other income* stop being
things a coach **picks**. They remain what the plan and the report **call** those sections, because
they come from the stored kind, which §3.2 keeps.

## 4. Data: what exists and what has to move

- **No line needs re-filing.** §1.2 measured every money-in line and all agree with their item.
- **A mismatch is possible in principle and must be checked on prod before the form changes** — a
  line whose stored kind disagrees with its item's source is a row whose actual is being sought in
  the wrong place, and it is invisible today.
- ⚠ **Where the item's source lives is the one real schema question.** Options: a column on
  `budget_items`; or a lookup keyed by the standard item, with custom items defaulting to typed.
  **The lookup is cheaper and reversible; the column is honest and survives a coach renaming an
  item.** Decide it in the build, do not inherit this sentence as a decision.

## 5. Gates

- **No money figure moves.** Every total on the plan, the ladder, the grid and both report shapes is
  identical before and after — asserted, not eyeballed. This change is about a question, not an
  amount.
- **The impossible pairing is impossible** — a test that tries to save *sponsorship + Concession
  revenue* and is refused, or cannot express it.
- Every existing line round-trips: open it, save it unchanged, the stored kind is what it was.
- The whole-source-tree kind guard still passes untouched (§3.2).
- A coach-created item saves as typed and can take a typed actual.

## 6. Out of scope

- Collapsing the stored enum (§3.2).
- Whether Grant also moves category (§3.3).
- **The report-side naming — *"No category → Not itemized"* becoming *"Not in the plan → Sponsor
  money"*.** That belongs to `COACH_MONEY_CREDITS_AND_PAYBACKS_PLAN.md`, which is already touching
  those rows. Doing it here would collide.

## 7. Why this is its own project

It touches the budget form, the item library, the plan's section headings and possibly a migration.
**Nothing in the credits-and-paybacks work depends on it, and it depends on nothing there** — the
only overlap is the report-side rename in §6, which is assigned. Kept apart so neither review has to
carry the other.
