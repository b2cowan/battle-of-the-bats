# Build prompt — Dues join the Statement, and the shortfall says itself

**Paste this into a fresh chat.** It is the whole brief; nothing from the originating session is
needed.

⚠ **SEQUENCING — READ FIRST.** Two things gate the start of this work:
1. **A concurrent session has uncommitted work in the exact file this build edits**
   (`app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx` — the QA §132
   round-two and round-three changes). **Do not start until that has been committed to `dev`.**
   Check with `git log --oneline -5` and `git status` before touching anything.
2. **This build goes BEFORE `COACH_BUDGET_DATES_BUILD_PROMPT.md`** (budget dates + the “To date”
   basis), which edits the same screen. This one changes what the statement's rows *are*; that one
   adds a comparison basis over them. Building the basis first would mean building it over rows
   whose meaning is about to change.

---

## The ruling (owner, 2026-09-04)

**Player dues join the Budget vs Actual Statement's revenue band, and “Funded by players” becomes a
comparison instead of a restatement.**

Design session artifact, owner-approved:
`https://claude.ai/code/artifact/245b6498-b7ff-412f-8062-a47eec82e8fa`

### The problem it solves

One report, two views, answering “what is revenue?” **$11,308 apart** — with nothing on either
screen explaining why:

| | Total revenue (budgeted) |
|---|---|
| Months · Budget | **$13,258.30** — dues $11,308.30 + fundraising $1,800 + other income $150 |
| Statement | **$1,950.00** — fundraising + other income; dues excluded entirely |

And two things that disagreement was hiding, both of which matter more than the label:

- **The plan needs $11,650.00 from families; dues actually bill $11,308.30 — a $341.70 shortfall**
  that appears on no screen. The Statement shows the plan figure, Months shows the billed figure,
  and nothing subtracts one from the other.
- **“Season net” today ignores the largest money movement of the season.** It reads
  **($11,650.00)** budgeted / **($1,645.63)** actual — a season apparently deep under water —
  because dues are absent from the revenue half while every cost sits in the other.

### What to build (figures are live from the UAT test team, 2026 season)

| Statement row | Budgeted | Actual |
|---|---|---|
| **Player dues** *(new row in the revenue band)* | 11,308.30 | 3,075.00 |
| Fundraising · Other income | 1,950.00 | 3,264.35 |
| **Total revenue** | **13,258.30** | **6,339.35** |
| Total expenses | 13,600.00 | 4,909.98 |
| **Season net** | **(341.70)** | **1,429.37** |
| **Funded by players** | plan needs **11,650.00** · billed **11,308.30** · **341.70 short** | |

Total revenue must then equal the Months view's Budgeted revenue **to the cent** — that identity is
the point of the change and belongs in `check:money-report`.

---

## Owner rulings — settled, do not re-open

| Ruling | Why |
|---|---|
| **Budgeted dues = what is actually BILLED** ($11,308.30, the dues instalment schedule) — never the plan residual ($11,650.00). | Showing the residual as revenue would report money nobody has been asked for. The gap between the two is the finding, not a rounding. |
| **“Season net” survives and keeps its name.** | Under this change it finally earns it: ($341.70) is a fact a coach can act on; ($11,650.00) was an artefact of an incomplete revenue half. |
| **The $341.70 shortfall line ships.** | It was the most useful thing the design session found, and it is independent of everything else here. |
| **⚠ THIS DISTURBS NO STANDING RULING — and a first draft of the design page wrongly said it did.** The 2026-08-26 decision deleted a four-tile *Dues Collection* summary CARD from the top of this report because its figures were already told on the Money hub and the Player Dues footer. **Do not restore that card.** This build adds one ROW to a band that already exists — and that ruling's own closing line ("the report states dues month by month in its own income band besides") already accepted dues belong on this report's income side. | The expenses half is untouched; the report goes on measuring spending against plan exactly as before. What changes is that the money-in half stops being incomplete, which is the only reason the net at the bottom was wrong. |

---

## 1. Mockup gate — before any code

The artifact covers the statement's desktop table. It does **not** cover three things you must mock
and get approved first:

1. **The empty state.** A team with no dues schedule set. A `$0.00` dues row would read as “nothing
   owed” when the truth is “not set yet” — and every new team is in that state on day one. Show it.
2. **The phone rendering (361px)** of the new closing block. “Funded by players” now carries a
   three-part sentence (plan needs · billed · short by) where it used to carry one figure in the
   budgeted column. Show how that wraps, and what the shortfall looks like when it is **zero** and
   when the team has **over-billed** (dues above the residual — a real state, and “$0.00 short” or a
   negative are both wrong words for it).
3. **The exported statement** (Excel/CSV/PDF). These rows travel into the files; show the new shape.

Publish as a Claude Artifact, present it, and wait for approval before writing code.

---

## 2. Load-bearing facts

- **⚠⚠ DUES ARE NOT BUDGET LINES.** What a season plans to collect in dues is its **instalment
  schedule**, set on the Player Dues tab — never a row in the budget planner. The Months view
  already feeds it into its revenue band as dated events; the Statement's rollup groups by
  category+item and has no home for it. **That is the actual work of this build** — do not solve it
  by inventing a synthetic budget line, which would double-count the moment anyone totals the
  planner.
- **“Funded by players” is quoted on other surfaces** (the Budget plan page's summary ladder, the
  money summary). Its *figure* is unchanged by this build — only its sentence on this one screen
  changes. Do not alter the shared derivation.
- **The Budget plan page already prefers assessed dues over the residual** when a schedule exists.
  Use the same source, so the two pages cannot disagree.
- **Over-billing is a real state.** Dues above the plan residual is legitimate (a coach collecting a
  buffer). The shortfall line needs words for it that are not “−$341.70 short”.
- The **actual** dues figure is money collected, and it must reconcile with what the cash bands and
  Cash on hand already say — those readings are held equal by `check:money-report`.

---

## 3. Explicitly out of scope

- **The “To date” comparison basis and required budget dates** — its own project, and it comes
  *after* this one. See `COACH_BUDGET_DATES_BUILD_PROMPT.md`.
- **Restoring the Dues Collection card** (deleted 2026-08-26, and this build is not a route back).
- **Changing the Months view.** It is already right; the Statement moves toward it.

---

## 4. Process this repo requires

- Work on **`dev`**. Stage explicit paths only, never `git add -A`. Confirm before committing.
- **Plan + PM brief pair** in `docs/projects/active/` (`COACH_BVA_REVENUE_RECONCILE_PLAN.md` +
  `_PM_BRIEF.md`), plus a one-line summary in `TODO.md` linking to the plan. Write these after the
  mockup gate and before building.
- Verification: `npm test` · `npx tsc --noEmit` · **`npm run check:money-report`** (extend it — the
  Statement-equals-Months revenue identity is the guard this change exists to earn) ·
  `npm run verify:changed` · `npm run check:layout -- --changed` with a dev server up and the
  fixture seeded (`node scripts/seed-uat-coach-fixture.mjs`). State any skipped check; never let an
  unrun one read as a pass.
- **Help is code-time:** `lib/help-content/coaches.tsx` teaches this report's bands and closing
  rows, including the article's `searchText`.
- **The demos tell a story over the top of the product and go stale silently.** Ask both questions
  in the same unit of work: *should a demo moment show this?* and *are the demo's existing sentences
  about this screen still true?* Coach money has gone stale across three consecutive releases.
- ⚠ **A data-only migration is invisible to `check:migrations`.** If you write one, record it as
  prod-owed in the release history rather than trusting the gate.

---

## 5. How you'll know it worked

A coach opens the Statement and sees the same revenue total the Months view shows them. The bottom
of the report tells them their plan needs $11,650 from families, that they have billed $11,308, and
that they are **$341.70 short** — a sentence that exists on no screen today and is the reason this
change is worth making.

Sign in for QA: `uat-coach@uat-test-org.local` / `UATPassword2026!` on `localhost:3000`
(org `uat-test-org`, team **UAT Test Team** → Money → Budget vs Actual).

Owner QA will be its own ledger section — **check the ledger tail for the next free number before
claiming one; sections are never renumbered.** The §132 entry carries the finding this came from.
