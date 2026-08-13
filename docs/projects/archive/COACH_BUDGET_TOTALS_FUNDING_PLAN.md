# Coach Budget Plan — Totals, Expected Funding, Period Columns

**Status:** ✅ **COMPLETE — owner QA PASSED 2026-08-13.** Archived same day. Owner elected to commit
it alongside the in-flight Money-hub work.

> ### ⚠ Carried forward out of this plan — read before the next release
>
> 1. **Migration 230 must reach production BEFORE this code does.** It adds a budget line's kind
>    (cost / expected funding). Applied to **dev 2026-08-12**. Until prod has it,
>    `check:migrations` and the schema-parity gate both fail — **that is the guard working; do not
>    re-baseline either.** Promoting the code first means production 500s on every coach money
>    screen (the migration-040 lesson).
> 2. **An access gap is OPEN and needs an owner ruling.** `rep_budget_lines` read access is keyed on
>    **org membership alone** — confirmed against live `pg_policies`, not the migration file — not on
>    team assignment and not on the `money` capability every API route enforces. It pre-dates this
>    work (migration 028); this work raised what sits behind it from cost lines to fundraising and
>    sponsorship targets. Same shape as the `rep_roster_players` gap that migration 212 closed.
> 3. **Three smaller pre-existing defects were reported, not fixed** (deliberately out of blast
>    radius): a slow line-save response can close a newer modal without the discard guard;
>    `setPeriodUndo` is called from inside a `setForm` updater in three places; `expandedLines` is
>    never pruned.
**Mockup (binding spec):** https://claude.ai/code/artifact/30812492-368e-4d2a-93e8-e78601ad5d17
(source: `docs/projects/active/COACH_BUDGET_TOTALS_FUNDING_MOCKUP.html`)
**PM brief:** `COACH_BUDGET_TOTALS_FUNDING_PM_BRIEF.md`
**Surface:** Coaches → Money → Season Budget Plan (+ ripples into Budget vs. Actual, the Money hub
Overview, and the team home card)

---

## Why

Four owner findings on the live screen, 2026-08-12.

1. **Two totals, no stated relationship.** *Total Planned Budget* and *Season Total* sat side by side
   and the headline number was silently `max(itemized, seasonTotal)`. Nothing on screen said what the
   second one was for, and a season total *below* the lines was kept in the database but ignored by
   every display — a typed number that does nothing is worse than a refused one.
2. **Fundraising can't be budgeted.** Every budget line is a cost, so per-player dues are always set
   off gross spending. A team planning to raise $4,000 has no way to say so and no way to charge the
   $400 it actually needs instead of $800.
3. **The plan has no calendar view.** Month columns exist, but only on Budget vs. Actual, blended with
   actuals — so from the plan they look absent. No quarter view anywhere.
4. **A duplicate link.** "View Budget vs. Actual →" at the foot of a page whose tab bar already carries
   Budget vs. Actual.

## The shape

### A · The summary ladder (replaces the tile bar)

The six figures this page can carry are one sum worked downward, not six statistics. The tile row was
the wrong instrument — it presented them as peers and then needed a caption under each explaining its
relationship to its neighbour. Chosen over two side-by-side zones (the left column read as a list, so
*Difference* still leaned on its label) and a hero-plus-strip (hid the reconciliation behind a link).

```
THE PLAN
Line items                    6 lines        $8,000.00
Not itemized yet — from your $10,000.00
  estimate            Edit · Clear           $2,000.00
────────────────────────────────────────────────────────
Total planned budget                        $10,000.00
Expected funding              2 lines       −$4,000.00
────────────────────────────────────────────────────────
$600.00 per player      $6,000.00 funded by players ÷ 10 on the roster
```

Collapse rules — a row that would say nothing is not rendered:

| Team state | What the ladder shows |
|---|---|
| Lines only | `Total planned budget` (the lines, labelled as the total — never the same number twice), a quiet *Set an estimated total*, then per player |
| Lines + estimate | `Line items`, the difference row, `Total planned budget`, per player |
| Lines + funding | `Total planned budget`, `Expected funding`, per player |
| All three | as drawn above |

- **Per player is the outcome and gets the largest type** — it is the number a coach acts on.
- The difference row sits **directly under the line items it is added to**; position is its
  explanation, which is why it needs no caption.
- The foot of the plan list keeps **one** row: the grand total (`Total planned budget`, or
  `Funded by players` when funding exists). The working is stated once, at the top.

### B · Estimated total (was Season Total)

Same stored field, renamed and explained where it is set. Optional; clearable.

- **The difference is calculated, never typed** — always exactly `estimate − itemized`. That is what
  makes the owner's rule ("it shrinks as you itemize, the total holds") automatic: it cannot drift,
  cannot be deleted by accident, and disappears when the estimate is cleared. It is **not** a row among
  the line items — no pencil, no bin; the only control that moves it is *Edit* on the estimate.
- **Negative is allowed and shown in red** ("Over your $6,000.00 estimate"), not blocked and not
  silently overridden.
- **⚠ The effective total changes meaning.** Today `max(itemized, seasonTotal)`; after this,
  **the estimate when one is set, else the itemized sum**. Owner ruling 2026-08-12: *the number you set
  is the number that counts*, including when it is lower than the lines. This flows into per player,
  the installment suggestion, and headroom — and must be applied in **every** place that reconciles
  the two (see Files), or the report and the planner will disagree again.

### C · Expected funding lines

A budget line is now a **cost** or **expected funding** (fundraising, sponsorship, club grant) — a
first-class kind, chosen in the Add/Edit form.

- Costs − expected funding = **Funded by players**; that, ÷ active roster, is per player, and it is
  what the installment generator proposes.
- Funding lines render in **one section at the foot of the plan**, always after the costs, shown
  negative. Section, ladder row, and totals row all appear only once something is budgeted.
- **Stored positive, displayed negative** (`total_amount > 0` CHECK stays); the kind carries the sign.
- **No link to individual campaigns** (owner ruling). One estimated total for fundraising is enough;
  linking would force a campaign to exist before it can be budgeted.
- **The rebate trap, stated in the form**: a campaign that pays part of what a player raises back to
  *that player* already lowers that player's dues via a dues credit. Budgeting the gross here would
  count the same dollar twice. The form's hint says: enter what you expect the **team** to keep.

### D · Budget vs. Actual

Expected funding gets its own row, and per the owner's ruling the actual it is compared against is
**the team's share**: `Σ(amount_raised − rebate_amount)` across this program year's fundraiser entries.
Money rebated to a player is not team funding — it is a transfer of where that player's contribution
comes from.

- The category table gains an `Expected funding` row (budget negative, actual negative) and a closing
  `Funded by players` row.
- Funding lines are **excluded from cost-category matching** — they are not expenses and must never
  fall into the name-matching path or the unbudgeted-actuals bucket.
- The **cash-flow strip stays dues-only** for now (see Out of scope) — mixing planned funding into
  money-in is a bigger change than this, and the strip already says on screen what it is not counting.

### E′ · The period header, reworked (owner, 2026-08-13)

Three faults, all visible in one screenshot of the first build.

1. **The year printed on the column where it CHANGED** (`Jan 2026` · `Feb`), which made one column
   taller than its neighbours — it read as a glitch — and labelled a single column with something
   that describes a *group* of them. Replaced by a **year band** spanning its months, which pays
   for itself on a season crossing New Year: Sep–Dec under one year, Jan–Feb under the next, told
   apart at a glance instead of by reading a suffix. The band shows even for a single-year plan
   (consistent shape, and it dates an archived season). **Unscheduled and Total sit under an empty
   band** — they belong to no year, and a hairline there would imply otherwise.
2. **Headings were smaller than the figures beneath them** (0.66rem). Sized up to 0.78rem.
3. **The coach's own line names were being shouted.** The cells are `<th scope="row">` so a screen
   reader announces which line a figure belongs to — which quietly opted them into the global `th`
   rule in `globals.css` (uppercase, display face, muted colour). "McTavish Arena — winter block"
   came back as "MCTAVISH ARENA — WINTER BLOCK". Semantics kept, styling overridden.

⚠ **Two cascade collisions were created and caught while doing (3).** `.periodGrid tbody th`
(0-2-1) outranks a plain `.periodGridCat th` (0-1-1), so the category and funding rows silently
lost their treatment; both rules are now written with the extra `tr.<class>` to win. This is the
SECOND cascade collision in this file (the first turned the over-plan number warm grey) — in a
module that layers row-level classes over an element selector, specificity is the hazard, not
colour choice.

### E · Period columns on the plan

A `List | By period` toggle on the Budget Plan tab, with `Months | Quarters`.

- Columns are built **client-side from the plan payload already fetched** (each line's period splits) —
  no new endpoint, no refetch, quarters are months grouped.
- Columns cover the months the plan actually touches, not a fixed twelve.
- An **Unscheduled** column carries lines with no period split. Dropping them would make the columns
  quietly disagree with the plan total; naming them is honest and doubles as a nudge to split them.
- Rows group by category exactly as the list does; funding rows show negative; the closing row is
  `Funded by players`.
- The estimate's difference is **not** in this view — it is not a line and has no dates.

### F · Remove the foot link

Delete "View Budget vs. Actual →". Keep "See a sample budget" — it is the only route back to the worked
example once a plan exists.

## Data model

**Migration 230** — `rep_budget_lines.line_kind text NOT NULL DEFAULT 'cost'`, CHECK
`line_kind IN ('cost','funding')`. Existing rows default to `cost`, which is what they are. No backfill.

`rep_program_years.budget_amount` is **unchanged in storage** — it is the estimated total, renamed only
in the UI. No data migration: a team's stored number keeps its value and simply starts being displayed
honestly (a team currently sitting above its own stored total sees a red difference for the first time
instead of having it overridden).

Data Dictionary + snapshots updated in the same unit of work (`npm run refresh:snapshots`,
`npm run check:dictionary`), including the `rep_budget_lines` gotcha list — gotcha 3 ("drives per-player
dues generation") must now say **net of funding lines**.

## Files

- `app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx` — the ladder, the estimate control,
  the funding section, the kind toggle in the Add/Edit modal, the period toggle + grid, the foot link.
- `.../budget/budget.module.css` — ladder, funding section, period grid, ≤640 reflow.
- `lib/coach-budget-totals.ts` — **new**, pure: given lines + estimate + roster, produce every figure the
  ladder and the generator use (itemized, difference, effective total, funding, funded-by-players, per
  player). One place decides the effective-total rule, so planner / report / hub cannot drift.
- `lib/coach-budget-periods-view.ts` — **new**, pure: plan payload → month or quarter columns +
  Unscheduled. (Reuses the month-key helpers in `lib/coach-budget-months.ts`; does not touch them.)
- `tests/unit/coach-budget-totals.test.ts`, `tests/unit/coach-budget-periods-view.test.ts` — **new**.
- `app/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/route.ts` — return `lineKind`; POST/PATCH accept
  it (default `cost`, validated).
- `.../budget-plan/generate-installments/route.ts` — no contract change (amounts are explicit); the
  panel's suggestion basis changes.
- `.../money-summary/route.ts` — effective-total rule, plus `budget.expectedFunding` /
  `fundedByPlayers`.
- `.../budget-vs-actual/route.ts` — effective-total rule, the funding row, team-share actual, funding
  excluded from cost matching and from the month grid's cost rows.
- `app/[orgSlug]/coaches/teams/[teamId]/accounting/SetupOverview.tsx` — the "You've set a … season
  total" sentence.
- `lib/db.ts` — the team-home money milestone currently keys off `budget_amount != null`; it should key
  off "has an estimate **or** any budget line", which is what "money started" actually means.
- `lib/help-content/coaches.tsx` — the premium-money section and the budget FAQs.

## Ripples to check before calling it done

- **Import** (`lib/coach-budget-import.ts`, `BudgetImportSheet`) creates cost lines; confirm the new
  column defaults cleanly and the sheet does not need a kind column yet.
- **Export catalog** — if budget lines are exported, the kind belongs in the export.
- **Season rollover** copies `budget_amount` forward; still correct as an estimate.
- **Archived seasons** — this adds no new door and no new season-aware route, so the opt-in archive
  rails are untouched. Verify the guard test still passes unchanged.
- **Demo sandbox (`riverdale-ridge`)** — the coach demo should show the feature it just gained: seed one
  expected-funding line and an estimated total, and re-read the money-related tour/dock copy for any
  sentence that describes the old two-total screen.

## Verification — what was actually run (2026-08-12)

- `npx next typegen` + `npx tsc --noEmit` — clean.
- Unit suite **1667/1667 green** (49 new: 31 across the two new pure modules, plus the renamed
  month-grid buffer row).
- `npm run verify:changed` — all gates green **except schema parity**, which fails
  *correctly*: dev carries migration 230 and prod does not yet. **Do not re-baseline it** —
  applying 230 to prod at release is what clears it.
- `check:demos` — green after re-seeding the coach sandbox (it now carries the funding line).
- **Rendered layout sweep** on `coach-budget` + `coach-budget-vs-actual`, four widths: no new
  findings, and **12 baseline entries pruned** (the first-run card's quiet links were 21px tall
  against a 44px floor; fixed rather than re-baselined).
- **End-to-end browser probe** reading computed styles (the house rule — never a screenshot):
  add a funding line → the ladder subtracts it and per player halves; set an estimate above the
  lines → the "not itemized yet" row appears; set it below → the row goes red and the total
  follows the estimate; clear it → back to the sum of lines; By period → month and quarter
  columns, an Unscheduled column, no sideways page scroll. 14/14 green.

### What the browser probe caught that nothing else could

**The over-plan number was not red.** `.ladderBad` (specificity 0-1-0) lost to
`.ladderValue.ladderSub` (0-2-0), so the one figure the design relies on being alarming rendered
in warm grey — `rgb(74, 66, 53)` — while carrying the class that says it is red. Typecheck, lint
and the unit suite were all green through it. Fixed with compound selectors; the probe now asserts
the computed colour is unmistakably red rather than merely that the class is present.

## `/simplify` + `/review` (2026-08-12, both run)

`/simplify` (4 lenses) — 12 fixes, 4 skipped with reasons. The **altitude** lens earned the pass on
its own: three EXISTING consumers of `rep_budget_lines` had never heard of the new kind, and this
change had not audited for them.

1. **Season rollover dropped the kind** — carrying a budget forward reclassified every
   expected-funding line as a COST in the new season, doubling the season total and the dues
   generated from it. A write path: permanent, and invisible without a DB audit.
2. **The Generate-Installments preview** summed every line and ignored the estimate — it would
   have offered $800/player on exactly the example the new help copy promises is $400.
3. **The tryout accept-to-roster drawer** prefilled a family's dues the same way.
4. Spreadsheet import could match a sheet row called "Fundraising" against a funding line and
   overwrite it. Fixed at the read, the write, and the client-side match list.

**The guard that closes the class:** `tests/unit/budget-line-kind-guard.test.ts` enumerates every
reader of `rep_budget_lines` across `app/`, `lib/`, `components/` and `scripts/`, and fails the
build unless each either understands the kind or is on an allow-list **with a written reason**
(the archive-door pattern). Proven to fail: a planted kind-blind reader turned it red.

`/review` — high-risk tier, deterministic gate first, 5 lenses, findings adjudicated in the main
loop. Confirmed and fixed:

- **The exported spreadsheet contradicted the screen.** The funding row's variance was
  sign-inverted, so a team that came up $1,350 short of its fundraising target saw red on screen
  and a positive number in the export.
- **Two surfaces disagreed about per-player.** The Money hub re-derived its own null-ness rule on
  top of the shared module, so a team holding only a funding line got "$0.00 per player" on the
  budget page and nothing on the hub. The module now decides it once — and a planned season that
  funding fully covers correctly reads $0.00 each on both.
- **A wrong-cause error message**: a $0 estimate produced "your expected funding covers the whole
  budget" on a plan with no funding lines at all.
- **The estimate editor could be stomped by a stale response** (Cancel stayed enabled mid-save),
  and a cancelled value survived to be offered again on the next Edit — one unnoticed Save from
  overwriting the real estimate with abandoned scratch.
- **Import ordering** measured `MAX(sort_order)` over a cost-only set, so an imported line could
  collide with a funding line's slot.

**Verified by proof, not argument:** the new cross-table fundraiser filter genuinely restricts —
a program year with no fundraisers returns zero rows against the live dev database. Had it not,
one team's report would have summed every org's fundraising.

### ⚠ Pre-existing, NOT fixed here — needs an owner decision

**`rep_budget_lines` read access is keyed on ORG MEMBERSHIP alone** (confirmed against live
`pg_policies`, not the migration file) — not on team assignment and not on the `money` capability
every API route enforces. Any signed-in org member can read every team's budget lines directly.
This predates the change (it dates from migration 028), but the change raises what sits behind it:
expected fundraising and sponsorship targets, where before it was cost lines. Same shape as the
`rep_roster_players` gap that migration 212 closed. Not touched here — changing access posture
deserves its own migration and its own ruling.

Also reported, pre-existing, left alone: a slow line-save response can close a newer modal without
the discard guard (the save path bypasses it); `setPeriodUndo` is called from inside a `setForm`
updater in three places (impure, from the period-split rework); `expandedLines` is never pruned.

## `/docs` (2026-08-12→13, run)

In-app coach help re-synced to the built behaviour, not to the plan:

- The old **"Budget your way"** paragraph (one Season Total, itemize, or both — with the
  "Non-itemized buffer") is gone; four paragraphs replace it: the summary reading as one
  calculation, planning to an **estimated total**, **budgeting money coming in**, and the
  **List / By period** view including the year band.
- Two new FAQs, both aimed at what a coach would actually type into the box: *"Can fundraising
  lower what families pay?"* (marked popular — it is the headline capability, and it states the
  team-share rule so the rebate trap is answered before it is hit) and *"What is the estimated
  total, and why is my budget showing less than my line items?"* (the over-plan case).
- **Corrected an existing FAQ that had quietly become wrong**: "How do I set every player's dues at
  once?" promised the generator starts from the budget. It now starts from what players *fund* —
  net of expected funding, and off the estimate when one is set.
- The **tryout accept-to-roster** step now says where its pre-filled fee comes from (the roster's
  prevailing dues, else the budget's per-player figure net of funding) — it previously said only
  "standard fee schedule", which stopped being a complete answer once funding could move it.
- The **import** section says a sheet row is always a cost and can never match or overwrite an
  expected-funding line — the "why didn't my sheet update that line?" question, answered before
  it's asked.
- Search metadata extended for every new term. ⚠ Help search is a plain **substring** match over
  the whole query against keywords/searchText/answerText — never the rendered prose — so phrasing
  matters. Verified in a browser that `lower dues`, `fundraising`, `sponsorship`,
  `estimated total`, `expected funding`, `not itemized yet`, `funded by players` and
  `plan by quarter` all return results. No anchor was renamed; two were added.

Still owed: owner browser QA → Owner QA Ledger.

## Out of scope / follow-ups

- **Funding in the cash-flow strip.** Planned funding by month would make the Budget lens's money-in
  real rather than dues-only. Deliberately not in this pass.
- **Shaping installments around when funding lands.** The generator still proposes even installments;
  a team whose fundraiser pays out in February may want its dues weighted before then.
- **Org-side budget planner** carries the same one-total confusion. Unverified; check before committing.
