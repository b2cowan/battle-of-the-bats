# The category is the shelf — one grouping rule for money in, and the forgetting list indexed by category

**Owner-ruled 2026-09-09** on mockup artifact `728dcb1e` ("The Category Goes Missing", round 1).
**Status: BUILT on dev 2026-09-09, `/simplify` (§7b) and `/review` (§7c) run the same day** —
`npm run typecheck` clean · unit suite 3,268/3,268 ·
`npm run check:money-report` green on the UAT fixture (after the §4.4 change its new claim forced) ·
`npm run verify:changed` green end to end. **Owner QA §158 owed** — walk artifact
https://claude.ai/code/artifact/c8659d30-dc1e-414e-91b8-39c5a548ea9d (source
`COACH_BUDGET_CATEGORY_IS_THE_SHELF_WALK.html`), with three asks on it: **E1** (the Statement's
unclaimed sponsor pool reads *Sponsorship (not budgeted) → Sponsor money*), **F3** (the open category's
chips sit below the button row), **F5** (the open category is not remembered across a reload).
**Direct probe 2026-09-09 (signed in as the UAT coach):** Budget page + strip render as drawn (40 items in 10
categories · money in 5 / spends 35); Budget vs. Actual 200 with Months rows *Player dues · Tournaments ·
Fundraising · Sponsorship · Other Income · Money back* and the Statement's *Sponsorship (not budgeted)*; zero
console errors. ⚠ The mobile-smoke UAT spec is 21/37 red for reasons that pre-date this build (ledger §158,
last paragraph; TODO) — not a verdict on this work.
No migration. PM brief: `COACH_BUDGET_CATEGORY_IS_THE_SHELF_PM_BRIEF.md`.

---

## 1. The rulings, in the owner's words

> "for tournaments the category is the shelf on both sides. it looks like it functions properly only on
> the statement and activity reports in budget vs actual but not on monthly ones. this should be
> consistent across the product, the category is the group and the items underneath, we don't need a
> category within a category, especially if the inputs do not imply this. go with A. for 2 items like
> insurance, it is fine to have 2 rows on the reports if they are legitimately 2 different insurances
> the user wants to track."

**R1 — The category is the group, on both sides of the books, on every surface.** A money-in budget
line reports under the **category it was filed in** — Fundraising, Sponsorship, Tournaments, Other
Income, or a category the coach made — exactly as a cost line does. Items sit beneath. There is no
"kind" shelf above the category and no category nested inside another.

**R2 — The forgetting list is Option A.** Two direction headings in the form's own words (*Money
coming in* · *Money the team spends*), one button per category with its count, chips only inside an
opened category. Drawn with money-in first; built as drawn.

**R3 — Two rows sharing a word are fine when a coach genuinely tracks two things.** The standard
vocabulary offering the same word twice on two shelves is a different matter and gets its own review
(§7). Nothing in this plan merges or renames a standard word.

### 1.1 What R1 supersedes — recorded, not deleted

- **2026-09-08, fundraising one-way-in, rule 4** — *"Tournaments reports as other income, grouped as
  its own category inside other income beside Other Income."* The nesting is replaced by peer status:
  Tournaments is a heading of its own. The half of that rule that shipped (Tournaments is typed
  income) is unchanged; the half that never shipped is now built differently.
- **2026-08-23, Months two bands** — *"Revenue is grouped by WHERE THE MONEY CAME FROM, never by the
  budget category a coach happened to file it under."* Superseded **for the three funding groups
  only** (fundraising · sponsorship · other). The reasoning that motivated it — *a dues payment and a
  bottle drive are two different answers to how a team funds itself* — survives intact, because
  **Player dues was never a category** (it is a schedule) and stays its own row, and **Money back &
  reimbursements** stays its own band (routing it by reason is settled-impossible, 2026-09-02).
- **2026-09-07, an unclaimed derived pool names itself "Not in the plan"** (the Statement) — amended
  at build time, because the new gate (§4.4) caught the two views disagreeing on the fixture the day
  it was written: the pool now takes its **platform shelf** as its category (*Sponsorship* for sponsor
  money, *Fundraising* for drive money) and keeps *Sponsor money* / *Fundraising money* as its row.
  The reason of that day — *the row should say what the money is, not "No category → Not itemized"*
  — is kept and strengthened; the pool still never guesses a LINE, and the not-budgeted flag stays as
  the gap a coach closes by planning one. The old name survives only on a database with no shelf.
- **2026-08-24, "Sponsorships keep their name everywhere"** — amended for the Months revenue row
  only. That ruling was about *lens* renaming (one object must not change its name as a coach flips
  Cash → Scheduled), and it still holds: the row now takes the category's name, **Sponsorship**, under
  every lens. The Fundraising screen's own "Sponsorships" list and the Money overview's row are a
  different object (a list of sponsors, not a budget category) and keep their name.

### 1.2 What does NOT change

- **The stored kind stays a data fact.** `funding` / `sponsorship` / `other_income` still says who
  fills a row's number in (a drive, a sponsor, the coach) and still drives the derived-actuals
  machinery, the sign in every subtotal, and the "one row, one source" rule. Only the **display
  grouping** moves from kind to category. `LINE_KIND_SECTION` stops naming headings on the plan and
  becomes what it is elsewhere: the word for a kind.
- **Player dues** — its own row at the top of Revenue on the Statement and Months, as ruled 2026-09-04.
- **Money back & reimbursements** — its own band, as ruled 2026-09-02.
- **The Statement and By activity** — already category-grouped; they are the model the rest converges on.
- **Colour** — none by direction (2026-09-02, colour is reserved for cash).

---

## 2. What is wrong today — verified in code, not from the plan

The product groups money in **three different ways** on surfaces a coach can open within a minute of
each other:

| Surface | Groups money-in by | Heading for a tournament concession line |
|---|---|---|
| Budget Plan list, By-period grid, both plan exports | **kind** (`LINE_KIND_SECTION`) | *Other income* |
| Budget vs. Actual — Statement, By activity, both exports | **category** (`coach-budget-rollup.ts`) | *Tournaments* |
| Budget vs. Actual — Months (+ its export, the cash strip) | **source** (`REVENUE_GROUPS`, five fixed groups) | *Other income* |

Three consequences a coach meets:

1. **The filing word vanishes.** The picker groups by category (TOURNAMENTS · FUNDRAISING · SPONSORSHIP).
   The plan's money-in row carries the item name alone, under a heading that is not a category. The
   word "Tournaments" never appears on the funding side of the plan a coach just filed under it.
2. **Two spellings of one heading.** Months prints *Sponsorships*; the plan prints *Sponsorship*; the
   category is *Sponsorship*. Months prints *Other income*; the platform category is *Other Income*.
3. **The forgetting list is 57 flat chips** — 50 cost, 7 money-in at positions 2–4 and 46–49 — with the
   category only in a desktop tooltip. On a phone the funding words are a screen and a half down.

Also found on the way, **not fixed here** (§7): the standard vocabulary was seeded twice (mig 027 in
May: nine categories, Title Case; mig 241 in August: Travel, League & Fees, Sponsorship, sentence
case) and never reconciled — four of League & Fees' five words restate Admin's, including *Insurance*
twice, word for word. Grouping by category makes the pair legible (Admin → Insurance · League & Fees →
Insurance) without making the duplication correct.

---

## 3. The one rule, stated once

**A money-in line's group is its category — keyed by category ID, named by the category's name,
ordered by the category's sort order then name.** Same as a cost line. One helper answers it for every
surface so no two of them can disagree:

```
fundingGroupForLine(line) → { key: `id:<categoryId>` | 'none', name, sortOrder }
```

Rules the helper carries, each with its reason:

- **Keyed by ID, never by name.** The Statement's rule (`money-one-arithmetic-guard`: "two categories
  sharing a NAME stay two rows"). A club's own category called "Fundraising" and the platform's are two
  shelves and render as two rows — the same thing already true of two cost categories called Insurance.
- **A line with no category** (pre-mig-243 money-in rows carry only a typed description) → `'none'`,
  named with the rollup's own `NO_CATEGORY_LABEL` ("No category"). One spelling.
- **Cash that reaches Months without a line:**
  - a drive or sponsor whose `budget_item_id` is null (legacy records mig 285 could not re-point) →
    the **platform Fundraising / Sponsorship category** — the shelf its kind was always going to land on;
  - a typed arrival nobody filed → `'none'`, "No category". Today it is a no-item row under *Other
    income*, which is a filing the coach never made.
- **Order:** categories by `sort_order`, then name — the picker's order, so the plan reads in the
  order the coach chose from.

---

## 4. Build — in order

Every step is display-only. **No migration.** Steps 4.1–4.4 share the §3 helper and ship together;
4.5 is independent and can land first or last.

### 4.1 The helper + its guard (`lib/coach-budget-totals.ts`, or a sibling `coach-budget-funding-groups.ts`)

- `fundingGroupForLine` as in §3, pure, unit-tested: id-keyed; name-only fallback; `'none'`; the
  platform-shelf fallback for line-less cash takes the two platform category ids as arguments (the
  route knows them; the module must not query).
- **Guard:** extend `tests/unit/budget-line-kind-guard.test.ts`'s roster so that `LINE_KIND_SECTION`
  is never again used as a **heading** on a plan surface (grep the four files for
  `LINE_KIND_SECTION[` outside the kind-word use-sites and fail). The word survives for `newMoneyInWordNote`
  — "Will report under Other income" — **which must change**: it now reports under the **category's
  name**, so the sentence becomes *"Will report under <category name>."* and the derivation reads the
  category, not the kind (the whole reason that helper takes a category argument already).

### 4.2 Budget Plan — list, grid, exports

- **List** (`accounting/budget/panel.tsx`, the FUNDING band): replace the `FUNDING_LINE_KINDS.map`
  section loop with a group loop over `fundingGroupForLine`; section key `group:<key>` (the closed-
  section memory keeps working per group); heading = group name; per-group subtotal; band and
  "Planned funding" subtotal unchanged. The `.fundingRow` class stays on section and total rows (its
  cascade note is load-bearing — read it before touching).
- **By-period grid** (`lib/coach-budget-periods-view.ts` ~line 360): `groupKey` for a funding line =
  the helper's key, `name` = its name; **sign unchanged** (`isFundingKind` still decides `-1`). Cost
  lines keep their existing name-keyed grouping — converging THAT to id is a separate cleanup, noted
  in §8, not smuggled in here. **One cost-side word did change (built 2026-09-09):** a nameless cost
  category read "Uncategorized" on this grid while the List and the Statement said "No category" for
  the same lines — and the grid's own nameless-last sort rule compared against the latter, so it had
  never fired. It takes the one spelling now.
- **Exports** (`lib/coach-money-exports.ts`: `budgetPlanStatementRows` funding loop, and
  `budgetPeriodGridRows` which reads the view): group rows via the same helper. The re-importer
  (`lib/coach-budget-import.ts`) skips section labels by `PLAN_LADDER_LABEL` and category rows by
  shape, so a category-named funding heading round-trips as a category row. ⚠ **`/review` read the
  round-trip further than the parser test does (§7c):** the parser is right, but the import route
  treats every sheet row as a COST and matches only against cost lines, so each money-in line comes
  back as a NEW cost line under its category. Pre-existing; widened by this build; handed on, not
  folded in.
- `tests/unit/budget-sponsorship-kind.test.ts` §"the period grid keeps a sponsorship on the money-in
  side": the assertion "gives each kind its own group" becomes "gives each **category** its own group,
  and keeps the minus sign" — the sign half is the one that matters and stays.

### 4.3 Budget vs. Actual — Months, the cash strip, the export

- **`lib/coach-budget-months.ts`:** `REVENUE_GROUPS` shrinks to the two fixed, non-category rows —
  `['dues', 'moneyback']`. `revenueCategoryId` / `revenueGroupOf` keep serving those two. A funding
  category row is an ordinary category (`id:<uuid>`) — which is exactly what the one-arithmetic guard
  ("every category it returns is keyed exactly as the statement keys it") has been asking for.
- **`revenueGroupLabel`:** keeps the dues row and the one lens rename (*Asked of the club*); the
  category rows take their own names — a helper `revenueRowLabel(row, lens)` that returns the
  category name when `group === null`.
- **`cellPanelSpec`:** the doors a category row's cell offers are chosen by the **category's
  `income_source`** (fundraiser → the Fundraising screen; sponsor → the sponsors list; typed → the
  Ledger), which is the same fact the group used to encode. The route must carry `incomeSource` on the
  row for this; it already loads the categories.
- **`lib/coach-cash-strip.ts`:** the three `income('other' | 'fundraising' | 'sponsorship', …)` call
  sites emit a **category** (id + name + incomeSource) resolved from the record's item — a movement's
  filing, a drive's / sponsor's `budget_item_id` — with the §3 fallbacks. The `RevenueCashEvent.group`
  field becomes `category` for these and stays `group` for dues/moneyback; the type makes the split
  explicit rather than overloading one field.
- **Route (`budget-vs-actual/route.ts` §8b):** `revenueEvent` / `revenueRow` / `pushRevenueDetail`
  take the resolved category; the BUDGET feed for funding lines uses `fundingGroupForLine` instead of
  `LINE_KIND_ACTUAL_SOURCE → group`. Total revenue is unchanged to the cent by construction — the
  events are the same events under different headings — and `check:money-report` proves it.
- **Screen (`budget-vs-actual/panel.tsx` ~1812):** `revenueGroupOf(cat.categoryKey)` → null for a
  category row → falls through to `cat.categoryName`, which is the behaviour wanted. Verify the
  `subjectRows` branch (rows-are-subjects for revenue) still holds for category rows: a Tournaments
  row's sub-rows are the ITEMS money was filed under (Concession revenue …), which is already what
  the "subject" of a typed arrival is.
- **Help** (`lib/help-content/coaches.tsx` ~2046 "Revenue" def, ~2069 "Sponsorships" def, ~1703
  "Planned funding" def): rewrite to the one rule — *grouped by category, Player dues first, Money
  back its own band*. Keep "Sponsorships" where it names the Fundraising screen's list (1656, 1874).

### 4.4 The Statement and By activity — confirm, and the one change the gate forced

Already category-grouped. Add one claim to `scripts/check-money-report-arithmetic.mjs`: **the set of
revenue category keys on Months equals the set on the Statement** (minus dues/moneyback, minus rows
with only a forward figure, plus nothing). That is the sentence the owner said — "consistent across
the product" — as a gate.

**Built 2026-09-09, and the claim earned its place on its first run:** the fixture failed it in both
directions — *"Sponsorship" on Months and not on the Statement; "Not in the plan" on the Statement
and not on Months.* Same money: a sponsor cheque no plan line claims. The Statement now files an
unclaimed pool under its platform shelf (§1.1, the 2026-09-07 amendment); claim 2c was taught that a
pledge sits on a sponsor-sourced category row. Both claims green on the fixture after the change.

### 4.5 The forgetting list — Option A (`accounting/budget/panel.tsx` ~3028, `budget.module.css`)

Built to the approved mockup, section §04 Option A, with these tags:

- **UNCHANGED:** the ask + count row ("What am I forgetting? · N items"), the write gate, list-view
  only, the derived list itself (`checklistItems`), dismissal per device, `openAddFromChecklist`.
- **NEW:** the count reads *"N items in M categories"*; two direction headings using
  `DIRECTION_OPTIONS[].name` **verbatim** (never retyped); a `<button aria-expanded>` per category
  with its count (≤768: 44px floor, the same reason `.checklistAsk` has one); chips render only inside
  an opened category, in the existing chip treatment; the footer sentence becomes *"Open a category to
  add from it. ✕ hides a word your team doesn't pay for."*
- **Order:** *Money coming in* first (as drawn — the shorter side and the one most often forgotten),
  categories by sort order then name. A category holding both kinds of word appears under both
  headings (Tournaments, Fundraising) — the structure telling the truth.
- **Open state is plain page state** — one category open at a time, nothing open on arrival, not
  remembered across a reload. ⚠ A deviation from this plan's first draft ("per device, in
  localStorage"): the list is a device for one sitting, and remembering which shelf was open adds a
  key with no reader. Named here so it is a decision, not an omission.
- **⚠ Deviation from the drawing, flagged at build time:** the mockup drew the open category's chips
  attached directly beneath its own button, with the other buttons continuing after. The build
  renders the button row intact and the open category's chips in a tinted body **below the row**
  (the open button is tinted to match). Same information, one fewer layout mode; the owner sees it
  on the built screen at QA §158 F.
- The UAT smoke `tests/uat/scenarios/coach-money-mobile-smoke.spec.ts` touches `budget-checklist`;
  re-run it. The layout gate (`check:layout`) opens nothing — see the memory note — so the phone
  frame is walked by hand at QA.

### 4.6 The record

- **Design log** (`memory/design_decisions.md`, in-repo): one entry for R1–R3 naming the three
  superseded/amended rulings (§1.1). `memory/MEMORY.md` unchanged (the log is already indexed).
- **Demo:** re-read the coach sandbox's dock lines and tour steps for Budget Plan and Budget vs.
  Actual before the build is called done (`lib/demo-moments.ts`, `lib/demo-coach.ts`). A grep for
  "Other income" / "By activity" / "Months" in narration finds nothing today, so the expected outcome
  is *nothing to change* — confirm rather than assume; this surface has gone stale three releases running.
- **`npm run verify:changed`** incl. `check:spelling` (no enforced word changes), `check:money-report`
  (extended per 4.4), the unit suite (three tests amended per 4.2/4.3).

---

## 5. Owner QA — §158 (walk artifact written at build time)

- **A · Budget Plan list** — funding band shows *Fundraising · Sponsorship · Tournaments · Other
  Income* (for a team with lines in each) as peers, each with a subtotal; Planned funding unchanged;
  collapsing a section survives reload.
- **B · By-period grid** — the same headings, minus sign kept, Planned funding column-by-column equals
  the list.
- **C · Exports** — Excel and CSV of the plan carry the category headings; re-import the CSV, nothing
  lost, no duplicate rows.
- **D · Months** — Player dues first; then the funding categories with their own names (*Sponsorship*,
  not *Sponsorships*); *Other Income* only if that category has money; a Tournaments row with
  Concession revenue beneath it; Money back band unchanged; **Total revenue equals the Statement to
  the cent** (`check:money-report` green on the fixture).
- **E · Statement + By activity** — unchanged; the same set of revenue categories as Months.
- **F · Forgetting list** — desktop and phone at true size: two headings, category buttons with
  counts, tap opens chips, add from a chip opens the form on the right side with the word chosen (the
  §157 behaviour), dismiss still works, count shrinks as lines are added.
- **G · Help** — search "where does tournament revenue show" → the rewritten Revenue definition.

---

## 6. Risks, and what holds them

- **Four surfaces changing one rule at once** — the risk the owner accepted on the mockup's comparison
  table. Held by: one helper (§3), the extended `check:money-report` claim (4.4), and the one-
  arithmetic guard converging rather than loosening.
- **A sponsor or drive with no line** (legacy `budget_item_id` null) — falls to the platform shelf, so
  no money disappears from Months; stated in §3, tested in 4.1.
- **A club category named like a platform one** — two rows, same name, by the Statement's standing
  rule. Acceptable; the vocabulary review (§7) is where a merge would be decided.
- **The re-importer** — the parser round-trips (unit test); the import ROUTE does not (§7c). Held by:
  the walk's C2 says so in the owner's words, and the fix is queued in a peer session.

---

## 7. Follow-on, separate decision: the standard vocabulary review

The owner asked whether a review of the standard category/item pairings is needed. **Yes.** Two
seed generations (mig 027 May · mig 241 August) were stacked, never merged; the August set's sport-
awareness was the point and the overlap was the side effect. A review is a **product decision sheet**,
not an engineering task:

- **Inputs:** the 57 default words + the 4 *Other Income* words, by category, with sport tags, seed
  generation, and **per-word usage counts on dev and prod** (how many budget lines, expenses and
  fundraisers reference each) — the blast radius of any merge, measured before anyone proposes one.
- **Output:** a proposed vocabulary — merges (Insurance ×2; Association Dues / fees; Software / Software
  & subscriptions; Registration Fees / League registration; Certification(s); Clinics / Coaching
  Clinics; the Coaching → Travel item vs the Travel category), one casing convention, and which
  shelf each merged word lives on — as an Artifact for owner ruling.
- **Then** a data migration re-pointing referencing rows (a merge moves lines), in its own plan.
- **Not this plan.** R3 stands until that sheet is ruled: two same-named rows render as two rows.

---

## 7b. `/simplify` — run 2026-09-09, four cleanup lenses, eight fixes and five skips

**Fixed:** (1) the "bucket by category, sort in the picker's order" shape was hand-rolled three times
(the plan list's funding sections, its forgetting-list index, the plan file) — now ONE `groupByCategory`
in the rollup beside `categoryGroupOf`; (2) `compareCategoryGroups` takes the order map directly, so
the one-line null-guard adapter retyped four times is gone; (3) the Budget-vs-Actual route's second
"learn facts about a category" pass folded into the `learnCategory` it already had (name + sort order +
income source from one loop); (4) the platform-shelf fallback for a drive or sponsor that names no line
was written three times (cash strip, Months pledges, the Statement's unclaimed pool) — now
`incomeCategoryFor` in the cash-strip module, read by all three; (5) the By-period grid keys COST
groups by category identity too (§8's "separate cleanup" turned out to be two lines in a function this
build already touched, and the new unit test proves the same-name collision it closes); (6) the panel's
three new derived values are memoised with their siblings above the early returns; (7) a merge table in
`check:money-report` that could never match after claim 5b's rewrite is deleted; (8) a cash-strip
revenue event carries ONE `where` field — a fixed group key or a category — instead of two nullable
fields and a non-null assertion at the consumer.

**Skipped, with reasons:** three efficiency items measured immaterial at these sizes (a double pass
over ≤57 checklist items; a comparator recomputing a rank; three walks over ≤15 fundraiser rows);
deriving the month grid's band from two other fields instead of carrying it (explicit is safer for a
fourth band); and routing the income-source lookup through a side map instead of the rollup's own
inverse of its key (state added for no behaviour change). **Follow-up, not this ship:** unify "a fixed
row" and "a category" into one shape across the cash strip, the route and the month grid — dues and
money back already have synthetic ids (`revenueCategoryId`, `PAYOUT_CATEGORY_ID`), so the two fixed
rows could carry `incomeSource: 'schedule' | 'payout'` and every consumer read one `{categoryId,
categoryName, incomeSource}`; the cell-panel door rule and the gate's register buckets would collapse
with it. Owner rulings that dues is a schedule and money back is unroutable are untouched by that.

**Gates after the pass:** typecheck clean · 3,268 unit tests · focused lint no errors ·
`check:money-report` green.

## 7c. `/review` — run 2026-09-09, high-risk tier, four finder lenses + main-loop adjudication

**Gates (Stage 0):** typecheck ✓ · unit suite 3,268 ✓ · focused lint ✓ (pre-existing warnings only) ·
`check:money-report` ✓ · `verify:changed` ✓ (re-run after `/simplify` and after the fixes below) ·
`check:layout` scoped to the five money screens: **18 new findings**, all one defect (below).

**Confirmed and fixed in this diff:**
- *Regression* — two help sentences still described the forgetting list as a flat chip wall ("tap +
  on an item… × to hide"): the Budget guide's "Starting from zero" paragraph and the FAQ "What should my
  budget include?" (JSX **and** its plain-text `answerText` mirror). Both now describe the index.
- *Rendered* — the Months grid's heading row declared `position: sticky` inside a scroller with no
  vertical travel (the shared `.moneyGrid thead th` rule), inert since it was written; the new
  revenue rows pushed the UAT fixture's pane to 851px against a 390×844 viewport and the gate reported
  the row trapped. Cancelled the way §156 cancelled the Budget tab's two grids, plus a carve-out that
  keeps the right-pinned Total column pinned. ⚠ A peer (session 7a) rightly noted a fixture row either
  way flips whether the gate *reports* this; the cancellation reason is the pane's construction, not
  the row count.
- *Correctness (Low)* — `cellPanelSpec`'s income-source switch had no exhaustive default; a fourth
  source would have fallen through to the expense doors. It is a compile error now.

**Confirmed, reported, NOT fixed here (handed on):**
- **HIGH · export → import round trip.** `budget-plan/import/route.ts` matches sheet rows against
  **cost** lines only ("an imported sheet row is a cost by definition") and the plan file has no
  column for direction — so every money-in line the plan exports arrives back as a **new cost line**
  under its category. Pre-existing for *Fundraising*/*Sponsorship* headings; this build widens it
  because money-in lines now sit under *Tournaments* and *Other Income*, beside real cost lines, so the
  phantom no longer looks out of place. Two finders disagreed; adjudicated in the main loop from the
  route's own comment and filter. Fix is the importer learning the plan file's two bands (a direction
  per row, or the band heading as the switch) — queued in peer session 7a's work, which owns that
  importer; walk step C2 now tells the owner what the preview will show.

**Accepted:**
- *Medium, self-healing* — plan-list section keys changed from kind (`funding`…) to category
  identity, so a coach's remembered open/closed sections reset once on first load after release.
- Two icon-only buttons under the 44px floor (*Scroll tabs right* @390, *Help: Money* @768) surfaced in
  a **peer's** sweep, not in this diff's scoped run; not attributed, not baselined — recorded in §8.

Findings: 9 → 7 after dedup → 6 confirmed (3 fixed, 1 handed on, 2 accepted), 1 refuted (the
`lib/sandbox-chrome.ts` "Not in the plan" mention is a code comment, not customer copy), 1 advisory
dropped (test fixture wording).

## 8. Noted, not in scope

- ~~The plan's **cost** grouping in the By-period grid is keyed by category **name** while the
  Statement keys by id~~ — **closed by `/simplify` (§7b item 5)**: both bands key by identity now.
- The prod coach demo's 20 "Not itemized" budget rows (QA ledger §132 F7) — unrelated, still pending
  reseed approval.
- **Money-in lines re-import as cost lines** (§7c HIGH) — the importer's fix, queued in peer session
  7a; until it lands, Import's preview shows every money-in line as an add.
- **Two icon-only money-hub buttons under the 44px floor** — *Scroll tabs right* (390) and *Help:
  Money* (768), seen in a peer's rendered sweep; unattributed. Someone should look before any baseline
  accepts them.
- **Remembered section folds reset once** after release (keys moved to category identity) — accepted.
