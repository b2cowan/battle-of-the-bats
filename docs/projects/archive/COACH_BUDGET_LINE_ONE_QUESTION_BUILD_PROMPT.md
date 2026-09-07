# Build prompt — A budget line asks one question, not two

*Paste the block below into a fresh chat. It is written to be self-contained.*

---

Work on the `dev` branch. **Do not commit or push without my explicit confirmation.**

## The job

Adding a line to a coach's season budget currently asks **two** questions — *"This line is…"*
(Expense · Expected fundraising · Expected sponsorship · Expected other income) and then
*"Category & Item"*. The two answers can contradict each other, the form allows it, and the
contradiction **silently breaks the row**. Replace them with one question.

**Plan:** `docs/projects/active/COACH_BUDGET_LINE_ONE_QUESTION_PLAN.md`
**PM brief:** `docs/projects/active/COACH_BUDGET_LINE_ONE_QUESTION_PM_BRIEF.md`
**Owner-approved mockup:** https://claude.ai/code/artifact/3913e207-d697-402b-b6eb-0468d38fd3cb
**Parent plan (what built today's shape, mig 243):** `docs/projects/active/COACH_MONEY_IN_TAXONOMY_PLAN.md`

## Before you write any code — in this order

1. **Read the plan and the mockup.** The mockup is owner-approved and outranks anything you would
   otherwise design. If the code contradicts the mockup, the CODE is the truth about what exists —
   say so rather than building to a drawing of something that is not there.
2. **Read §2 of the plan.** There is a standing owner ruling (2026-08-16) that sponsorship stays a
   distinct money-in kind *because sponsor records depend on it*. **This work does not reverse it.**
   It keeps the three sources and moves where the source is DECLARED — from a question the coach
   answers to a property of the item they pick. If your design deletes the distinction, it is wrong.
3. **Re-measure before you trust any figure in the plan.** Every number in it was read on
   2026-09-07 and the fixture drifts. `node scripts/db-query.mjs --dev -q "…"` is the tool.
4. **Present a plain-language UX summary before implementing** (AGENCY_RULES). Blocking step.

## What to build

- **One question** — *"Money the team spends"* / *"Money coming in"* — then category and item,
  filtered to that direction exactly as today.
- **The item carries where its actual comes from**: a drive, a sponsor, or the coach types it. The
  mockup shows this as a tag on each option so a coach can see, before saving, whether the row will
  fill itself in.
- **A coach-created item defaults to "the coach types it."** There is no machinery behind a name
  someone just invented, and defaulting it to a derived source would close the row to the only way
  its money can be recorded.
- **Grant becomes sponsor-sourced.** It is given directly and arrives as a cheque; the sponsorship
  option's own help text already calls a grant a sponsorship. ⚠ Library items are shared under
  migration 240's three-tier ownership — check what an org-level override does before writing one.
- **A guard** so the impossible pairing cannot be expressed.

## What NOT to build

- **Do not collapse the stored line-kind enum.** It is read by the plan list, the summary ladder,
  the period grid, both report shapes, the exports and a whole-source-tree guard test. Removing the
  QUESTION is a form change; removing the CONCEPT is a migration across six readers. Bundling them
  makes the first impossible to review. Compute the kind from the item and store it as today.
- **Do not touch the report-side naming** ("No category → Not itemized" becoming "Not in the plan →
  Sponsor money"). That is assigned to `COACH_MONEY_CREDITS_AND_PAYBACKS_PLAN.md`, which is in
  flight and touching those rows. You would collide.
- **Do not decide whether Grant also moves category.** Its own question, deliberately left open.

## Gates — all of these

- **No money figure moves anywhere.** Plan, ladder, month grid, Statement, By activity, exports.
  Assert it; do not eyeball it. This change is about a question, not an amount.
- A test that the impossible pairing is refused or unexpressible.
- Every existing budget line opens and saves unchanged, with the same stored kind.
- The whole-source-tree line-kind guard still passes untouched.
- A coach-created item saves as typed and accepts a typed actual.
- `npm run typecheck` · `npm test` · `npm run verify:changed` · `npm run lint:focused -- <files>`.
- `npm run check:layout -- --changed` with the dev server up (this touches a coach-portal screen).

## House rules that will bite you here

- ⚠ **This repo is Next.js 16 with a `proxy.ts` convention.** Read `AGENTS.md` first; do not
  recreate `middleware.ts`.
- ⚠ **Decide whether a column exists from the schema snapshots or live `information_schema`, never
  from migration files** — they mislead in a drifted database.
- ⚠ **Any migration updates `docs/agents/db/DATA_DICTIONARY.md` in the same unit of work**, and
  `npm run refresh:snapshots` runs with it.
- ⚠ **One spelling everywhere a customer can read a word**, including `data-label` values and help
  `keywords` arrays. `npm run check:spelling` gates it.
- ⚠ **The working copy is shared with other agents.** Stage explicit pathspecs only — never
  `git add -A`. Run `git show --stat HEAD` after any commit and confirm only your files landed.
- **Update `TODO.md`** and move the plan pair to `docs/projects/archive/` when it is done and
  verified.

## Two questions worth asking the owner rather than deciding

1. **Where the item's source lives** — a column on `budget_items`, or a lookup keyed by the standard
   item with custom items defaulting to typed. The lookup is cheaper and reversible; the column is
   honest and survives a coach renaming an item. The plan deliberately does not decide this.
2. **Whether any budget line on PRODUCTION has a kind that disagrees with its item.** Dev has none.
   Prod was not checked. A disagreement there is a row whose actual is being sought in the wrong
   place, invisible today, and it should be surfaced before the form changes rather than migrated
   over quietly.

Offer `/review` when the change is substantive and `/docs` if a coach-visible flow changed.
