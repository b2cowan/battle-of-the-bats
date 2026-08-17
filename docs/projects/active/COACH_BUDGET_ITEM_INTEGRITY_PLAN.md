# Budget items — what a word IS, and who may take it away

**Status: DESIGN RULED by the owner 2026-08-16/17 (in conversation), not built.**
Mockup (binding): https://claude.ai/code/artifact/484b5971-5f79-42a4-9c1e-e5165bfaf15a
**PM brief:** [COACH_BUDGET_ITEM_INTEGRITY_PM_BRIEF.md](COACH_BUDGET_ITEM_INTEGRITY_PM_BRIEF.md)

Found by `/review` on the money-form P2 build (`91d1c2c8`), then widened by reading the code around
it. **Three live doors delete a word out from under records that point at it**, and every link into a
budget item is `ON DELETE SET NULL` — so nothing fails, the money stays, and its classification
silently disappears from the report.

---

## 0. ⚖ The ruling log

**Ruled by the owner, 2026-08-16/17:**

1. **Clubs never absorb teams.** A club may create *Grant* while two teams already have their own.
   Publishing promotes a word and does nothing else.
2. **Merging goes team → club only, and the team initiates it.** A coach folds one or more of their
   own words into a shared one; their records repoint and their words are removed.
3. **Many onto one**, within the same income/expense side, **any category**. A coach who invented
   *Public grants* and *Company grants* may fold both into the club's *Grants*.
4. **A club may not delete a word any team is using.**
5. **A team's own word may be renamed or removed — never moved between income and expenses.**
   Categories can belong to one side, so a moved word can land somewhere meaningless. The case is
   rare; delete and re-create is the honest answer.
6. **A word's identity is source + side + category + name.** Change any one and it is a different
   word that may sit beside the other.
7. **Folding onto a STANDARD word is allowed too**, not only a club word (owner 2026-08-17). Same
   mechanics, same position for the coach.
8. **Folding across categories is allowed**, and the confirmation must say so — it re-files those
   records under a different heading on the report (owner 2026-08-17).

**Nothing is open.**

---

## 1. ⚠⚠ The three doors, as the code actually stands

| # | Door | What it does | State |
|---|---|---|---|
| 1 | **Publish absorbs twins** — `team-budget-items/[itemId]/publish` | Finds every same-named word on other teams, repoints `rep_budget_lines` + `rep_team_expenses`, deletes the twins. **Never repoints `rep_team_money_in`** (that table arrived with mig 243, after this code). | LIVE |
| 2 | **Club delete has no usage guard** — `budget-categories/[catId]/items/[itemId]` DELETE | Refuses platform words, refuses a team's word, refuses Misc. Says **nothing** about a club-published word six teams have filed against. One click blanks every link org-wide. | LIVE — widest blast radius, least protected |
| 3 | **The merge matches on name alone** | Since mig 246 every word has a side. The twin query still compares `lower(name)` only, so *Grant* (income, 12U) and *Grant* (expense, 14U) are treated as one word — absorbed, and the survivor's side wins. | LIVE — **introduced by P2** |

**Four tables point at `budget_items.id`, all `ON DELETE SET NULL`** (verified against the committed
dev snapshot 2026-08-16): `rep_budget_lines.item_id`, `rep_team_expenses.budget_item_id`,
`rep_team_money_in.budget_item_id`, `org_budget_lines.item_id`.

⚠ **`org_budget_lines` is safe today by ACCIDENT, not by design.** Publish only ever absorbs
team-owned rows, and the Org Budget can only choose club/standard words — so an org line can never
point at a row publish deletes. Nothing states or enforces that. It is the fourth table nobody
counted, and it is exactly the shape of the third one that broke.

⚠ **Publishing is the ONLY code path in the product that deletes a budget item** (grepped
repo-wide). One door to guard — which is what makes §4 cheap.

---

## 2. The model — one direction of travel

**A word belongs to whoever made it, and only they can remove it.** Everything else follows:

- The **club** adds words freely. Teams see them, tagged. No team's vocabulary is read or touched.
- **Publishing** promotes one team's word to the club tier. It deletes nothing, scans nothing.
- A **team** folds its own words into a shared one when it chooses to, and the confirmation states
  what moves before it moves.
- **Nobody deletes a word that has history behind it** — team or club. Rename reaches every record
  and loses nothing; that is the offered alternative.

**Why this is simpler than what it replaces:** the deletion existed only to stop two identical rows
in one coach's list. Tag the rows apart and the reason evaporates. No text matching across teams, no
guessing, and the person pressing the button is always the one whose records move.

---

## 3. Identity — the uniqueness rule

Today: `category_id + org_id + coalesce(team_id, zero-uuid) + lower(name)`, where `org_id is not
null` (`budget_items_unique_scope_name`, mig 240). **Source, category and name are already in the
key; the side is not.**

Ruled: **source + side + category + name.** So the index gains `direction`. One migration, no
backfill — the new key is strictly weaker than the old one, so every existing row still satisfies it.

⚠ **This is what lets a team keep *Grant* as income and *Grant* as an expense.** The picker filters
by side, so only one is ever offered at a time — the pair can never be ambiguous at the point of
choice.

⚠ **It also retires the 409 P2 added** ("that name already exists on your list as an expense"). That
refusal existed only because the index could not tell the two apart.

---

## 4. What gets built

### P1 — Stop the bleeding (small, before anything promotes)

1. **Publishing promotes and nothing else.** Delete the twin scan, the repoint and the delete. Doors
   1 and 3 close together. The response reports the promotion; the admin list keeps its "also added
   by another team" note as *information*, no longer a prompt to merge.
2. **Guard the club's delete** — refuse while any record anywhere in the org points at the word, and
   say which teams and how many. Door 2.
3. **The side joins the identity** — the uniqueness index gains `direction`; the P2 same-name 409 is
   removed.
4. **Drop "move to the other side"** — the button in *Manage our items* and the `direction` branch of
   the coach item PATCH. Ruling 5. ⚠ **This retracts something already on dev** (P2, `91d1c2c8`).

### P2 — Tell the rows apart

5. **Tags in the picker and the manager**: `Standard` · `Club` · `Our own`, on every surface a word is
   listed. Never colour alone — this list renders in a warm theme and a dark one.

### P3 — The team-chosen merge

6. **"Use a shared word instead"** on *Manage our items*: multi-select the team's own words, choose one
   standard or club word **on the same side**, confirm, done. The confirmation names the counts by
   record type and **warns when the category changes**. Repoints all four tables, then removes the
   folded words.

### P4 — Make forgetting impossible

7. **One named list of everything that points at a budget word**, in `lib/coach-budget-items.ts`,
   driving every guard and the fold. Plus a unit test that reads the committed schema snapshot and
   **fails the build when a foreign key to `budget_items` exists that the list does not cover** — the
   shape `budget-line-kind-guard` and `coach-history-endpoint-guard` already set. This is the step
   that stops the fifth table repeating the third one's story.

---

## 5. 🔒 Constraints

- **Every guard counts all four tables.** A guard that counts three is the bug, restated.
- **Renaming stays retroactive and always allowed** — it is the escape hatch every refusal offers.
- **Folding moves no money.** Only what a record is filed under. The report takes a row's direction
  from what was actually filed, never from the word (mig 246's own note), so a fold across sides is
  impossible by construction — the target list is same-side only.
- **No unpublish.** Unchanged: a word a team is already planning against cannot be taken back.
- **Working season only.** Words are cross-season vocabulary and carry no program year; nothing here
  reads a `?year=`.
- **Sport-neutral vocabulary** throughout.

---

## 6. ⚖ Can this run beside the money project's P3? **Yes — verified by file, not by optimism**

The money plan says *"P1–P3 all touch one form and one tab bar — run them serially."* That rule was
about the money form and the money tab bar. **This work touches neither.**

| This work owns | The register (money P3) owns |
|---|---|
| the two admin item routes (publish, club delete) | the Transactions face of the money panel |
| `BudgetItemManagerModal` (Budget Plan) | the Overview's next-30-days panel |
| `BudgetItemPicker` internals (tags) | the money exports |
| `lib/coach-budget-items.ts` + the guard test | `lib/coach-money-*` readers |
| the uniqueness migration | — |

**The only file both could want is `BudgetItemPicker.tsx`** — this work adds tags inside it; the
register does not reshape it, because a register is a list, not a form. **Neither edits the money
panel's `budgetItemField`**, and the picker's props do not change.

⚠ **The real risk is not the code, it is the shared working copy.** Both sessions commit to one `dev`
branch, and this project has already had one session commit another's in-flight work twice in two
days. **Stage explicit pathspecs, and run `git show --stat HEAD` after every commit.**

⚠ **One ordering constraint that IS real, and it is about RELEASE, not build:** §4's P1 must reach
production **with or before** money-P2, because migration 246 is already in the dev queue and doors 1
and 3 are live. Do not promote the money work past this.

---

## 7. Owner QA

New ledger section per phase; annotate §43 (the money form) where it describes *move to the other
side*, never renumber. ⚠ **The fixture is thin: dev holds 2 team-owned words and 0 club-published**
(live probe 2026-08-16) — every walk here must create its own words first, or it proves nothing.
