# Kickoff prompt — Budget item integrity, Phase 3: the team-chosen merge

*(paste into a fresh chat)*

**Build Phase 3 of the budget-item integrity work, and ONLY Phase 3.** The design was ruled by the
owner on 2026-08-16/17 and is recorded in `COACH_BUDGET_ITEM_INTEGRITY_PLAN.md` §0 and §4 —
**carried verbatim, not re-litigated**. P1 (`d17f6add`) and P2 (`f27f0189`) are on dev and are what
you are building on.

---

## Read first, in this order

1. **`COACH_BUDGET_ITEM_INTEGRITY_PLAN.md`** — §0 (the eight rulings), §1 (the three doors and what
   the code actually did), §2 (the model), §4 P1/P2/P4 (what shipped, and the judgement calls each
   took), §5 (constraints), §6 (the parallel-session boundary).
2. **The binding mockup:** https://claude.ai/code/artifact/484b5971-5f79-42a4-9c1e-e5165bfaf15a —
   §4 is your feature, in three panels.
3. **`OWNER_QA_LEDGER.md` §44 and §45** — what the screens do today. **Both are built and unwalked.**

## ⚠ Verify before building — the working copy is shared

- ⚠⚠ **A PARALLEL SESSION IS BUILDING THE MONEY REGISTER** in this same working copy, on this same
  `dev` branch. During P1/P2 sessions committed each other's in-flight work **twice**, and a staging
  check caught a third near-miss (~880 lines of theirs about to ride into a ten-file commit).
  **Stage explicit pathspecs, ALWAYS run `git diff --cached --stat` before committing, and treat any
  file with a surprising line count as theirs until proven otherwise.**
  ⚠ Bracket directories (`[teamId]`, `[orgSlug]`) need `:(literal)` pathspecs or they stage nothing.
- ⚠ **Check `ls supabase/migrations | tail` before naming a migration.** Both sessions created a
  `247` on 2026-08-17 and one had to be renumbered after the fact.
- ⚠ **The whole-project typecheck may be red from their in-flight files.** Confirm every error names
  a file you did not touch before assuming you broke something — and never "fix" their file to make
  a number go green.
- ⚠ **Nothing in this area has been owner-QA'd.** §41, §43, §44 and §45 are all owed. If a walk turns
  up a design problem it is under your feet; ask before building on anything that looks like it may
  move.

---

## What Phase 3 builds

**One flow, on `Manage our items` (Budget Plan):** a coach folds one or more of their team's own
words into a shared one. Mockup §4, three steps.

### The rules, from §0

1. **The team initiates it. Always.** A club creating a word does nothing to anyone's vocabulary;
   publishing promotes and deletes nothing (P1). This is the *only* way words merge, and the person
   pressing the button is the one whose records move.
2. **Many onto one.** Multi-select the team's own words, choose one target, confirm once.
3. **The target may be any STANDARD or CLUB word on the same side.** Owner confirmed standard words
   count, 2026-08-17 — identical mechanics, identical position for the coach.
4. **Any category.** Folding across categories is allowed **and the confirmation must say so** — it
   re-files those records under a different heading on the report. Owner confirmed 2026-08-17.
5. **Same side only.** The target list is filtered to the source words' direction. A cross-side fold
   is impossible by construction, which is what keeps "no money moves" true.
6. **The folded words are removed afterwards** — that is the point of folding rather than keeping both.

### What must move

⚠⚠ **ALL FOUR tables, through `BUDGET_ITEM_REFERENCES`** in `lib/coach-budget-items.ts`. Do **not**
hand-list tables. That list exists because the publish route named two of them in a careful comment,
was never revisited when a third arrived, and silently blanked the item on every income and refund
filed against an absorbed word. `tests/unit/budget-item-references-guard.test.ts` fails the build if
the list misses a foreign key; your fold must read the list, not repeat it.

⚠ **RE-POINT BEFORE DELETE, AND ONLY DELETE IF THE RE-POINT SUCCEEDED.** Every link is
`ON DELETE SET NULL`, so a delete after a failed re-point does not error — it quietly unclassifies
the records. P1's publish route has the shape to copy: on a partial failure, stop and say exactly
what did and did not happen rather than reporting success.

### The confirmation, before anything moves

Names the counts **by record type** ("2 budget lines, 3 recorded costs and 1 money in"), says the
folded words are removed, says **no money changes** — and carries the category warning when the
target sits under a different heading. `describeBudgetItemUsage` already writes that phrase; use it
so the four kinds are never named four different ways.

---

## ⚠⚠ The trap this feature is most likely to fall into

**`BudgetItemPicker` keeps its OWN copy of the word list** (`localCategories`) and the panels behind
it hold theirs. In money-form P2 that produced a **Critical**: the parent re-derived an item's name
from its own copy, which had not learned about a word created seconds earlier in the picker — so the
box rendered a blank half and, worse, a later selection kept the *first* word's name on the record.
The fix was to stop re-deriving and remember what the control reported.

**A merge screen is the same shape:** after a fold, several words no longer exist and one has gained
records. Anything reading a stale copy will show removed words as still pickable, or fail to name
the survivor. **Refresh from the server after the fold rather than patching local state**, and
**bump the shared money revision** — P1's item manager shipped without that and a rename stayed
invisible on the money form's picker for the rest of the session.

---

## 🔒 Constraints (plan §5 — none open)

Every guard counts all four tables · renaming stays retroactive and is the remedy every refusal
offers · folding moves no money, only what a record is filed under · a word with history cannot be
removed, so the fold is the *only* way a used word disappears — its guard is the re-point, not a
refusal · a team's own words only, never another team's or the club's · no unpublish · working
season only, no `?year=` (`coach-history-endpoint-guard` is the contract) · sport-neutral vocabulary.

⚠ **A word stays on the side it was made on** (ruling 5, retracted from P2). Do not reintroduce a
direction change as a side effect of folding — the target's side always equals the sources' side, so
the question never arises.

---

## Done means

- **A fixture walk you build yourself.** ⚠⚠ Dev holds almost no team-created vocabulary — 2 words at
  last count and 0 club-published. **Create the world first**: a club word, two of the team's own on
  the same side, records of all three kinds filed against them. A green walk over a thin fixture
  proves nothing, and this project has been caught by that before.
- Prove the counts: fold two words into one, then confirm the survivor carries every record and
  **Budget vs. Actual totals are unchanged**. That is the "no money moves" claim, and it is the one
  worth checking rather than trusting.
- `verify:changed` and `typecheck`. ⚠ `verify:changed` fails on a **pre-existing** schema-parity gap
  (236–248 are dev-only), and the dictionary gate may fail on the register session's column — run
  the checks after those gates directly, and do not document another change's schema.
- `npm run check:layout --only=coach-budget` — and **run `--only=coach-roster` first**: the portal's
  notification badge emits six findings on every screen, and two sessions have now lost time
  reporting them as new. ⚠ The fold UI lives in a modal, so the sweep measures it closed and proves
  nothing about it; say so plainly.
- `/docs` for the help guide — *Categories, items & money tags* and the Budget Plan topic both
  describe what a coach can do with their own words. ⚠ That section is already ~466 words against a
  ~350 standard; trim as you add rather than growing it further.
- Demo copy re-read, then `npm run check:demos`.
- Offer `/simplify`, then `/review`, before handing off. **Every review pass on this money area has
  found a real defect** — P1 of the money form a Critical, P2 another Critical plus two pre-existing
  security holes, and this project's own P1 was itself a review finding. Budget for it.
- A **new Owner QA Ledger section** (annotate §44/§45, never renumber), the plan's §4 P3 line, the PM
  brief and `TODO.md` per the anti-drift rule — positive facts with anchors.

## ⚖ Disagree out loud, before the work

If the ruled design is wrong, say so **before** building it, arguing from what the code does rather
than what the plan claims. This project exists *because* that happened: the money form's "the item
list follows the pill" turned out to be unbuildable as written — the data would have hidden every
word a club had ever invented — and saying so produced a migration and a better rule. The owner then
re-framed a bug fix into a whole model ("clubs never absorb teams"), which deleted the guesswork
instead of patching it. Re-frame the question if it is the wrong one. Do not manufacture disagreement.
