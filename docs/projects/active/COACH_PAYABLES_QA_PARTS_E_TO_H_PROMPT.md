# Session prompt — Owner QA §64, Parts E → H

**Hand-off written 2026-08-21.** The owner is about to walk **Part E** and will continue through F, G
and H. Your job is to **support the walk**: answer what the owner asks, fix what the walk finds, and
record it. **Not** to build new things.

**The walk:** `claude.ai/code/artifact/5699812b-6e3d-49cb-9bf6-787b6083acb6` (Parts C–H).
**The ledger:** `docs/projects/active/OWNER_QA_LEDGER.md` → **§64**. Parts **A, B, C, D are walked**.
**Plan:** `COACH_PAYABLES_REBUILD_PLAN.md` · **PM brief:** `COACH_PAYABLES_REBUILD_PM_BRIEF.md`.

---

## 1 · First thing you do, before anything else

**Read `git status` and work out what is yours.** At hand-off the tree held **48 modified files** and
**only about a dozen belonged to this work** — the rest are another session's marketing/pricing pass,
live in the same working copy, on the same `dev` branch.

- **Stage explicit pathspecs only.** Never `git add -A` / `git add .`.
- **After any commit run `git show --stat HEAD`** and confirm only your files landed.
- ⚠ Bracket paths (`app/[orgSlug]/…`) need `':(literal)…'` or they stage nothing silently.
- Another agent edited **shared files mid-session** (the layout checker, the nav, `lib/db.ts`). If a
  check fails in a file you never touched, establish ownership before "fixing" it.

**Then confirm to the owner what state the payables work is in** — committed or not — rather than
assuming. A previous session's hand-off note being wrong about this is a recurring cost in this repo.

## 2 · What the owner will be walking

**All five phases are built.** A commitment holds **installments** (the plan) and **payments** (what
happened). Part E is the sharp one — the scope rules for a linked series.

⚠⚠ **The single most valuable step in the entire walk is in Part E:** remove a *paid* installment
from a bill and confirm **cash on hand does not move**. A review found that a positional row key let
that silently rewrite a settled payment to a different amount, taking its ledger entry with it. It is
fixed and verified against a live database, but it is the check that matters most.

## 3 · Four things changed on Budget vs. Actual during the C+D walk — do not re-litigate them

Each was an owner ruling made with the evidence in front of them. **They are settled.**

1. **Money sits on the ITEM row it names.** A category is the sum of its rows. Item-less money lands
   on that category's *Not itemized* row.
2. **The prior-season column is gone** (with its "in last season's plan" list and its query).
   *Budget vs. Actual evaluates THIS season only.* Cross-season wants its own view.
3. **The money-tag filter is gone from this report.** ⚠ It *worked* — the reported reason was wrong.
   It went because it narrowed **spending** while the **plan stayed whole**, so **Headroom rose as
   you filtered** ($8,905 → $10,900 on the fixture). Tag filtering still lives on **Transactions**.
4. **The month grid is windowed:** twelve months at a time, arrows in the same row as View and
   Showing, Export right-most, one month per press, range named, Category pinned left, **Total pinned
   right**, "No date yet" hidden under Actual and Scheduled.

### ⚠⚠ Five standing rules that fell out of those, which a later change must not quietly reverse

- **`Total` is the WHOLE SEASON, never the visible window.** The Total column, the Statement view and
  the chart are held equal by `tests/unit/money-one-arithmetic-guard`. This is why the visible range
  is *named* — a reader adding up what they can see must be able to tell why it does not match.
- **The export carries EVERY month**, never the window. A file leaves the product; a silent slice of
  a season is the worst outcome available here.
- **Do not pin anything else to the grid's edges.** Measured: a month column is 83px at 1440 in a
  1156px area, so twelve months want ~140px more than exists. **Every pinned column costs a visible
  month at every width.**
- **Do not reinstate the prior-season column or the tag filter** in this report.
- **A cap and the editor that forces it lift together** (P4's lesson, still true).

## 4 · Three fixes landed AFTER the step that prompted them — walked but not re-walked

They are listed at the top of §64. **Ask the owner to glance at them before Part E:**

1. **The note under the Months grid** — its wording changed twice on 2026-08-21, the second time
   because it invited a tap that does nothing on an item row (only a **category's** figure opens a
   breakdown).
2. **Undo on a payment** — a double-tap guard was added after a review found a fast second tap on a
   *successful* undo blanked the whole Payables list behind an error.
3. **Undated money on an item row** — was found by luck rather than by rule. Fixed, pinned by a test
   that was confirmed to fail without the fix.

## 5 · Logged, decided, and deliberately NOT to be built in this session

- **The phone-density planning session** (`TODO.md`) — carries a worked candidate: a phone **month
  stepper** for this grid (option P2 in `claude.ai/code/artifact/48647397-7dca-45d0-bec4-f6db8764a2ce`).
  ⚠ **Do not build P2 alone** — if a stepper is right here it is probably right for Payables and
  Transactions too, and three hand-rolled phone layouts is what that session exists to prevent.
- **"Where does a coach log money?"** — the centralization planning session, §9 of the payables plan.
  Owner-called, planning only, opens when this project closes.
- **PDF export quality** (`PDF_EXPORT_QUALITY_PLAN.md`) — proposed, not started. ⚠ Its framing was
  corrected once the code was read: **nine of the fifteen PDFs share one renderer**, and two defects
  in it (the title prints twice by default; orientation is org-wide and no report can override it)
  explain what the owner saw. Do not audit them one by one.

## 6 · How to work, from what this project actually cost

- ⚠⚠ **A behaviour lives in more than the code that computes it.** One stale claim — *"spending is
  matched to a category, so line rows read —"* — was written in **four** places: the arithmetic, the
  grid, the **export**, and the **note under the grid**. Each was fixed and declared done while three
  copies were still live. A **fifth** sat in the help. **After changing what a screen MEANS, sweep the
  user-facing copy, the exports and the help — not just the logic.**
- ⚠⚠ **Measure; do not reason.** Claims about widths, fit and pinning were wrong until rendered and
  measured. "Twelve months fits" was false at every width.
- ⚠⚠ **A green check over an empty fixture proves nothing.** In one session: a probe reported "no
  qualifying team" because its query hit a column that does not exist; another compared `undefined`
  to `undefined` and called it a pass. **The run that finds nothing is the one to distrust.**
- ⚠ **The rendered sweep cannot see everything.** Not modals, and not the month arrows (they need a
  team with 13+ months and the swept fixture has nine). Measure those by hand and **say** you did.
- ⚠ **Probes that create fixture data must clean up even when killed.** One timed out after creating
  a bill and before deleting it. Wrap the cleanup in `finally`, and sweep for `ZZ %` leftovers.
- **Disagree out loud, before the work.** Two owner requests this session rested on a premise that
  was false; in both cases the conclusion survived and the *reason* changed. Say so first.

## 7 · Verification

```
npm run typecheck                                  # shared modules / routes were touched
npm test                                           # the money arithmetic guard lives here
npm run lint:focused -- <changed files>
npm run check:layout -- --only=coach-budget-vs-actual,coach-payables,coach-transactions
```
A dev server must already be running for the rendered check; **if you skip it, say so.**
Schema-parity failures are the known dev-ahead-of-prod gap, not yours.

## 8 · When the walk finishes

Parts E–H closed → **§64 is done** → the payables project can close, which opens the centralization
planning session. Production is still on the **2026-08-17** release; **none of this is on prod**, and
shipping it carries database changes. Offer `/review` after any substantive fix, and follow the
release checklist rather than improvising the promote.
