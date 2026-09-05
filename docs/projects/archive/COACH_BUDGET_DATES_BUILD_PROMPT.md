# Build prompt — Budget dates, and the “to date” reading

**Paste this into a fresh chat.** It is the whole brief; everything it depends on is either linked or
restated here, so the new session does not need this one's context.

---

## The ask, in one line

**Every budget line must answer “when does this money move?” — in MONTHS, with “Not yet known” as a
real third answer — and the Budget vs Actual statement gains a second comparison basis, “To date”,
that the answer makes possible.**

These two ship together. The date requirement has almost no payoff alone: the reason to ask a coach
for a month is so a report can compare like with like. Shipping the ask without the payoff is asking
coaches to do work with nothing to show for it.

**Approved mockup (owner-reviewed 2026-09-04, three rounds of amendments already applied):**
`https://claude.ai/code/artifact/9bc53080-ba3c-4856-891e-aef63e51bd7d`

---

## 1. THE MOCKUP GATE — DO THIS FIRST, BEFORE ANY CODE

The artifact above covers the *line form* and the *statement*. It does **not** yet show two surfaces
you must mock and get approved before building:

1. **The Budget plan list with its new “When” column, at TRUE SIZE** — a whole-screen before/after,
   desktop and 361px. This is where a coach clears a season's unknowns in one sitting, so it is the
   screen that decides whether the requirement is a chore or a tool. Show the column populated with
   the real mix: a single month, a multi-month split, a “Not yet known”, and a partly-dated split.
2. **The Statement's control row at 361px and in the 641–768 tablet band.** It already carries
   **View** and **Showing**; **Compare** makes three selectors on one row. Show what it does when it
   wraps. If it does not fit, propose the fix in the mockup rather than discovering it in code.

Publish as a Claude Artifact, present it, and **wait for the owner's approval before writing code.**
Include a whole-screen before/after for each — not component crops.

---

## 2. Owner rulings this build must honour

These are settled. Do not re-open them; if you think one is wrong, say so before building.

| Ruling | The reasoning, which matters more than the rule |
|---|---|
| **Ask for a MONTH, never a day.** | A coach in January knows the tournament is in July but not that it is due the 14th. A guessed day is indistinguishable from a known one, so forcing precision makes the to-date report *confidently wrong* instead of honestly incomplete. A day stays available inside the existing split editor for coaches who want it — it is simply never required. |
| **“Not yet known” is an explicit answer, not a blank.** | It is what lets a report tell an unknown apart from an oversight. Today undated is the path of least resistance, which is why everything ends up undated. |
| **It blocks the save**, exactly as category and item already do. | One rule, three parts: a line says what it is and when it happens. |
| **The basis is a DROPDOWN beside View and Showing** — never a pill row. | Standing house rule: form selects are dropdowns. The statement already wears this shape twice. |
| **The disclosure sentence CHANGES with the basis.** | Whole season *counts* undated money in full, so there it reads “…sits in the season total but in no month” and points at the Months view. Only **To date** can exclude it, so only there is “not compared” honest. Getting this wrong was a real defect in the first mockup — the owner caught it. |
| **Whole season stays the DEFAULT.** | Headroom is quoted on five surfaces and pinned by a build gate. Flipping the default is its own decision, taken deliberately after the owner has seen To date working — not as a side effect of adding it. |

---

## 3. Load-bearing facts — get these wrong and the build is wrong

- **⚠⚠ THE UNDATED BUCKET CAN NEVER BE ELIMINATED, so do not build as if it can.** A coach who sets a
  season *estimated total* before itemising anything has plan money with **no lines underneath it** —
  there is nothing to attach a date to. That money is fully counted in the whole-season plan and can
  never join a to-date comparison. Consequences: the disclosure sentence outlives the date
  requirement, the excluded figure under **To date** can never reach zero however diligently a coach
  works, and “Not yet known” must stay a legitimate answer rather than something the form nags about.
- **⚠ REVENUE PLAN IS MOSTLY NOT BUDGET LINES.** What a season plans to collect in dues is its **dues
  instalment schedule**, set on the Player Dues tab — never a row in the budget planner. A date
  requirement on budget lines therefore does not touch dues at all. Fundraising / sponsorship /
  other-income lines **are** budget lines and **are** in scope.
- **⚠ THE “No date yet” COLUMN ALSO HOLDS THINGS THIS BUILD MUST NOT TOUCH.** A sponsor's **pledge**
  and a **club ask** live entirely in that column, in the Total and in no month (owner ruling
  2026-08-23). They are Scheduled/actual money, not plan. Dating budget lines must not sweep them up
  or empty that column of them.
- **No customer coach teams exist on production** (owner, 2026-09-04), so there is no customer data to
  migrate and no backwards-compatibility burden on existing lines. **But the public coach demo
  (`riverdale-ridge`) is on prod and 13 of its 20 budget lines are undated** — it needs dating in the
  same unit of work, or the shop window demonstrates the problem rather than the fix.
- The **month grid's “No date yet” cell** is currently the only route out of undated budget. The new
  **When** column on the plan list becomes a second, better one. Do not remove the first.

---

## 4. The four screens

1. **Money › Budget › the line form.** The new required question. Three answers: one month · split
   across months (opens the existing split editor, each chunk answering the same question) · not yet
   known. Applies in **both directions** — a fundraising line answers it too.
2. **Money › Budget › the plan list.** A **When** column. Must be scannable and fixable without
   opening each line; sorting or filtering to the unknowns is the point.
3. **Money › Budget vs Actual › Months.** “No date yet” stops being a dumping ground. Verify the
   column still renders correctly when it holds *only* pledges and club asks.
4. **Money › Budget vs Actual › Statement.** The **Compare** dropdown (Whole season · To date,
   remembered per device like View/Showing), the basis-dependent disclosure sentence, and a to-date
   variance that only counts plan money dated on or before today.

---

## 5. Explicitly OUT of scope

- **The Months/Statement revenue disagreement.** Months·Budget puts Player dues in its revenue band
  ($13,258 budgeted revenue); the Statement excludes dues entirely ($1,950) and closes on “Funded by
  players” instead. One report, two views, $11,308 apart. **This is a separate owner mockup session
  with its own question — do not touch it here, and do not “tidy” either view toward the other.**
- **Flipping the default basis.** Add To date; leave Whole season selected.
- **Reopening the family-paid or plan-panel rulings** made in the §132 walk (see the ledger).

---

## 6. Process this repo requires

- Work on **`dev`**. Stage explicit paths only, never `git add -A`; a second session shares this
  working copy. Confirm with the owner before committing.
- **Plan + PM brief pair** in `docs/projects/active/` (`COACH_BUDGET_DATES_PLAN.md` +
  `_PM_BRIEF.md`), plus a one-line summary in `TODO.md` linking to the plan. Write these after the
  mockup gate passes and before building.
- Any schema change updates `docs/agents/db/DATA_DICTIONARY.md` and refreshes snapshots in the same
  unit of work.
- **⚠ A data-only migration is invisible to `check:migrations`** — it compares schema, so inserts and
  deletes report “in sync” while outstanding. If you write one, record it as prod-owed in the release
  history rather than trusting the gate. (Migration 276 is already in that state.)
- Verification: `npm test` · `npx tsc --noEmit` · `npm run check:money-report` · `npm run
  verify:changed` · `npm run check:layout -- --changed` **with a dev server up and the UAT fixture
  seeded** (`node scripts/seed-uat-coach-fixture.mjs`). A skipped rendered check must be *stated*,
  never left to read as a pass.
- **Help content is code-time, not later:** `lib/help-content/coaches.tsx` teaches the five Months
  readings and the statement; a new basis and a new required question both belong there, including
  the article's `searchText`.
- **The demo tells a story over the top of the product and it goes stale silently.** Ask both
  questions in the same breath: *should a demo moment show this?* and *are the demo's existing
  sentences about these screens still true?* This surface has gone stale across three consecutive
  releases.

---

## 7. How you'll know it worked

A coach opens Budget vs Actual in September, switches **Compare** to **To date**, and the variance
column answers *“are we on track right now?”* instead of *“has the season finished yet?”* — and the
sentence underneath tells them, honestly, how much plan that answer had to leave out.

Sign in for QA: `uat-coach@uat-test-org.local` / `UATPassword2026!` on `localhost:3000`
(org `uat-test-org`, team **UAT Test Team** → Money).

Owner QA for this work will be **§142** (§141 is taken — check the ledger tail before claiming a number; sections are never renumbered) in `docs/projects/active/OWNER_QA_LEDGER.md`; the §132
entry there carries the findings this build came out of.
