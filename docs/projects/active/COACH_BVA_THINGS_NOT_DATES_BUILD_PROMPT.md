# Kickoff prompt — Things, not dates: the report names what a figure is made of

*(paste into a fresh chat)*

**Build the whole of `COACH_BVA_THINGS_NOT_DATES_PLAN.md`, and only that.** Raised by the owner on the
§157 walk (2026-09-10), drawn as a mockup, and **approved on the mockup the same day with every
ruling settled** — including the two the plan had left open. Carry it verbatim; do not re-litigate.

---

## Read first, in this order

1. **The binding mockup:** https://claude.ai/code/artifact/e2264b06-008b-47aa-ad99-d7ab5cb66aa7 —
   the "where dates live" table, then the Statement before/after, the dues fold, and the moved panel.
   **Where this prompt and the mockup disagree, the mockup wins.**
2. **`COACH_BVA_THINGS_NOT_DATES_PLAN.md`** — §1 (why the fold cannot be repaired), §3 (what changes),
   **§3.0 (the report-wide door rule)**, §4 (the export), §5 (**what is knowingly lost**), §7.
3. **`COACH_BVA_THINGS_NOT_DATES_PM_BRIEF.md`** — the closing section records *why* the owner's dues
   ruling beat the first proposal. Read it before you are tempted to build the rejected version.

---

## ⚠ Verify before building — the working copy is shared, dirty, and being walked

- ⚠⚠ **`budget-vs-actual/panel.tsx` IS ALREADY MODIFIED IN THE WORKING TREE**, along with ~110 other
  uncommitted files from at least two other chunks of work. **Establish what is already changed before
  you edit anything**, and never assume a diff there is yours.
- **Stage explicit pathspecs; always `git diff --cached --stat` before committing.** ⚠ Bracket
  directories (`[teamId]`, `[orgSlug]`) need `:(literal)` pathspecs or they stage **nothing**.
- ⚠ **`npm run verify:changed` is ALREADY FAILING** on the token-debt ratchet (two hardcoded colours
  in the coaches stylesheet, from the Categories & Items work). **Not yours. Do not fix it.**
- ⚠⚠ **OWNER QA §157 MAY STILL BE IN PROGRESS, AND ITS PART G IS THIS REPORT.** Confirm with the owner
  that the walk is finished before you touch the Statement — a screen that changes mid-walk destroys
  the walk's evidence, because a difference can no longer be attributed.
- **No migration is expected.** Everything the dues fold needs already exists. If you find yourself
  reaching for one, stop and say why.

---

## What this builds

### 1 · The item fold goes, from BOTH reports

The Statement and By Activity share one row component. Remove the period sub-rows and the item row's
chevron. **Category rows keep their fold** — that is a fold onto *things*.

After this, **neither report renders a date anywhere.**

⚠ **This removes a display, not a fact.** The plan's schedule is still stored, still returned, and
still drives the **to-date** comparison basis (*plan dated on or before today*). Do not delete the
periods from the payload or the basis silently becomes the season basis.

⚠ **Guard it.** The "N lines" caption changed hands three times in three days before the owner ended
it; this rule will be re-added by a future session with a good local reason unless a test forbids it.
Add one, in the spirit of `tests/unit/bva-figure-doors-guard.test.ts`.

### 2 · Player dues folds to players

**⚖ Owner ruling 2026-09-10** — replaces the first mockup's per-family modal, which would have rebuilt
the Player Dues page inside the report.

- The synthetic dues category stops being a special row and becomes an **ordinary category with
  items** — one per player — carrying **Budgeted / Actual / Variance** in the report's own columns:
  what that family was billed, what has come in from them, what they still owe. **Closed by default**,
  like every category.
- **The category row's figures go plain.** ⚖ **The rule this settles, report-wide: a door lives on an
  ITEM number, never on a CATEGORY number.** Every other category row already renders plain cells;
  Player dues was the only violation.
- **The existing composition panel moves DOWN onto each player's Actual figure** — cash paid, team
  bills that family paid, fundraising credited to them, scoped to that family. Its existing
  "only-when-there-is-something-to-explain" predicate stands: a family whose money all arrived as cash
  gets no door.
- **A player's Budgeted is a plain number, no door.** A family's bill is one assessed figure, not a
  pile of records — which is the report's existing rule, not an exception.
- **Do not build a billed/in/owing panel.** The three figures are the row's own columns now.

**The three wrinkles, named so you don't discover them at the end:**

- The **to-date basis** currently special-cases the dues category and reads a whole-team
  `billedToDate`. With items it needs a per-player equivalent, and the category must still be **the
  sum of its items** — the report's standing rule is that totals re-sum from the items up, never
  scale.
- The dues row today renders through its **own component**, carrying the *"Not set yet · Set player
  dues"* state and a chevron **spacer** where other categories have a control. Folding it into the
  ordinary category group must keep that not-set state — it is a fact a coach may genuinely not know.
- The dues category is addressed **by a sentinel id** in several places (the revenue list, the
  activities list, the exports). Walk every one of them; a category that now has items behaves
  differently at each.

### 3 · The export — ⚖ RULED, and it is a named exception

**The exported Statement keeps its single Player dues row. The per-family rows are SCREEN-ONLY.**
Drives and sponsors stay named in the export — they are businesses and events, not children.

⚠⚠ This **deliberately breaks** the standing `EXPORT SHAPE = SCREEN SHAPE` lesson. **Write the reason
into the export module's own comments**, next to the code that does it. Without that, a later session
will "fix" the divergence with a perfectly good local argument and put twelve families' debts into a
file a treasurer emails to a board.

---

## What must NOT change

- **No figure moves**, on any row, on any team, on either basis. Prove it against a real fixture.
- The **Months view**, in any respect.
- Fundraising and Sponsorship rows — already correct, already naming their drives and sponsors.
- The plan's stored schedule and the to-date basis it feeds.

## Knowingly lost — do not try to preserve it

*"We're over on ice time — which month?"* leaves the product. Months answers by category, not by line.
**The owner accepted this explicitly.** If you find yourself building a replacement, you are
re-opening a settled trade.

---

## Verification before hand-off

- **No date renders on either report**, at any width, on any fixture — the new guard, plus eyes.
- Item rows have no expander; **category rows still do**.
- Dues: families paid in full, part-paid, and untouched; a team with dues **not set**; a read-only
  coach (no door that dead-ends).
- Both bases (season and to-date) agree: category total = sum of its player rows.
- **Export:** no family named; the file's Player dues figure matches the screen's.
- `npm run typecheck`, `npm test`, `npm run verify:changed` — the token ratchet is red before you
  start and is not yours.
- ⚠ **Run any UAT spec you rely on rather than trusting it runs.** `coach-sponsor-money-lifecycle` has
  had 3 of 17 failing since 2026-09-04 against a deleted block, unnoticed through two releases.
- Restart the dev server before hand-off.

## After the build

`/simplify` first (the dues category stops being special — that is a deletion of a special case, and
worth checking it actually deleted), then `/review`, then `/docs` — the money help guide describes
what the report shows. Then the owner QA walk as a checkable artifact, added to the run order.
