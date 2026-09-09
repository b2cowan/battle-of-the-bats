# Coach fundraising — one way in

**Status:** **committed `1b06f9e7` 2026-09-08 on `dev`**, migration **285**
(`285_a_shelf_says_who_fills_it_in.sql`) — on prod 2026-09-08 (job 262), promoted in order behind 274/276/277/280–284.
Owner QA **§157** written, walk artifact
[`f8e843e3`](https://claude.ai/code/artifact/f8e843e3-8be2-48d6-bb55-4f93cee0abec) (78 checks, eight
parts) — **awaiting the owner's walk, and one ruling: F4, whether a whole-team entry is allowed on a
drive that pays a family share (built ALLOWED).** Model owner-approved 2026-09-08 on mockup artifact
https://claude.ai/code/artifact/8aa1e633-af41-47af-b312-d852aae462a3 (source copy:
`COACH_FUNDRAISING_ONE_WAY_IN_MOCKUP.html`, final version "Sponsorship words symmetric"). Build
prompt: `COACH_FUNDRAISING_ONE_WAY_IN_BUILD_PROMPT.md`. PM brief:
`COACH_FUNDRAISING_ONE_WAY_IN_PM_BRIEF.md`.

⚠ **Two DEVIATIONS from the mockup, both put to the owner before any code and both answered:** the
create panel's new sentence reads "Will report under **Other income**." (not the drawn "Expected other
income" — §156 removed "Expected" from every section heading the same day), and **"Who raised it" is a
dropdown** with a Players group rather than the drawn open list with a chip (every sibling identity
question on that form is a dropdown; the chip's fact moved to a hint under the field).

⚠ **Three things THIS PLAN got wrong, corrected in the build:** §3.5's reader list sends a reader to
`lib/db.ts`'s `playerCount` (that is the EVALUATION-SESSIONS aggregation) and to the register book's
row detail (which never names a player); the reader that actually needed fixing was
`lib/coach-cash-strip.ts`. And §3.4's "refuse unconditionally on POST **and PATCH**" would have frozen
every legacy record — the money-in form resends the item on every save — so the edit door refuses only
a record being moved ONTO a derived word.

⚠ Do not re-word this status as "uncommitted"/"not on prod" — record the positive fact with its anchor
when it changes (commit hash, ledger §, Amplify job).

**Raised:** the owner asked why the Budget Plan's money-in picker says "From a drive" under a heading
that already says FUNDRAISING. Chasing it found that a drive is not attached to a budget line at all,
that "Other money in" claims grants in its own sub-line while the sponsor answer claims them too, and
that team-raised money (a hoodie table, a car wash) has no way in. The owner's simplification is the
model below; everything drawn before it (blocked rows, "carry me there" switches, a separate door
three) is retired.

---

## 1. The model — owner ruling 2026-09-08, binding

**The category a word sits in decides who fills its number in and where it reports.**

1. The budget library's money-in shelves are **Fundraising** (Fundraising drive, Merchandise sales),
   **Sponsorship** (Grant, Team sponsorship — Grant moved shelves in mig 282), **Tournaments**
   (Registration revenue, Concession revenue, Gate / admission) and **Other Income** (Interest,
   Rebate, Donation, Other income). A coach or club can add words to any shelf. That is already true.
2. **Fundraising and Sponsorship words are always filled in from the Fundraising tab.** A
   fundraiser names which Fundraising line it is *raising for* (pre-filled *Fundraising drive*); a
   sponsor names which Sponsorship line (pre-filled *Team sponsorship*). Each picker is filtered to
   its own shelf — the standard words and the team's/club's own, nothing from the other shelf.
3. **"Other money in" holds only what is typed.** The four Fundraising/Sponsorship words are
   **removed** from its picker, not blocked. Tournaments, Other Income and any coach-made category
   remain; all typed. The first question of Record money ("What happened?") already routes
   fundraising and sponsor money to their own answers.
4. **Tournaments reports as other income**, grouped as its own category inside Expected other
   income beside Other Income. Settled, not assumed (the owner was asked because hosting a
   tournament is a classic team fundraiser).
5. **A line reports under its category's shelf.** Fundraising → Expected fundraising; Sponsorship →
   Expected sponsorship; everything else → Expected other income. A word a coach adds to Fundraising
   is a fundraising word from birth — never typed, reported under that heading.
6. **Team-raised money is a drive entry for "the whole team"** — no player, no family share. This is
   the only way hoodie-table money gets in once the typed path closes, so it ships in the same
   release or the model is not honest.

**What a coach can no longer do, said plainly:** fundraising or sponsorship money cannot be recorded
without a fundraiser or sponsor record. One more step than typing it in; in return the money lands
on the line they planned, they get a record with a board and a date, and the product has exactly one
way for fundraising money to exist. The owner accepted the trade.

### Decisions settled on the way (all owner, 2026-09-08)

| Question | Ruling |
|---|---|
| Should the budget picker's "From a drive" note be reworded? | **Removed, nothing replaces it.** A coach choosing a budget word is choosing a kind of money, not a room. |
| Remove the four words from "Other money in", or block them with a "Record it there" link? | **Remove.** The first question already routes; a blocked row was keeping a door open the model says should not exist. Optional: one sentence on the existing empty state for the coach who types "merch" before reading. |
| How does a coach tell a grant from a sponsor? | **No sponsor-or-grant switch.** The two behave identically (a promise, then arrivals, optionally crediting families). The only consequence of the difference is which Sponsorship line it reports against, and "Raising for" is that. Three labels say "grant": *Which sponsor or grant?*, *A new sponsor or grant…*, *Sponsor or grant* (placeholder "e.g. Riverdale Dental, or Community Sport Grant"). |
| Is "Raising for" required or nudged? | **Neither — pre-filled** with the shelf's standard word, changeable. |
| Where does a coach-invented *category*'s money-in line report? | **Expected other income**, never asked as a question (a category is not one side of the books; most coach categories are cost categories). Stated at the moment a word is created: the create panel's existing sentence "Saved as money coming in — because that is what you are recording" gains "Will report under Expected other income." Changeable on the category, not locked at birth. |
| Tournament revenue — fundraising or other income? | **Other income.** |
| Whole-team entry on a drive that has a family-share percentage set? | **Assumed allowed** (recommended; the board shows a dash where a share would be and the facts line counts team entries separately). ⚠ The owner has not said the word — confirm at §157. |

---

## 2. What is true today — verified in code 2026-09-08

1. **The money form claims grants twice.** `CONV_BRANCH` in
   `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx`: `sponsor.sub` = "A business
   or grant gave directly"; `'other-in'.sub` = "Interest, **a grant**, anything else". The budget word
   Grant is sponsor-sourced (mig 280) so the second sends a coach to the answer that refuses it.
   Creating a sponsor from inside Record already works ("A new sponsor…" is the second option of
   "Which sponsor?", `sponsorPicker` ~line 4946) — the barrier is vocabulary only.
2. **Team-raised money cannot be entered.** The drive entries POST
   (`…/fundraisers/[fundraiserId]/entries/route.ts` ~line 331) requires `playerId`. ⚠ The column is
   already **nullable** (mig 237) and `UNIQUE (fundraiser_id, player_id)` does not cap NULLs (mig
   268 relies on this for sponsor arrivals) — so the whole-team entry is a write-path and reader
   change, **not a schema change**. Readers must stop inferring "arrival" from a null player; the
   register book already keys on `parent.kind === 'sponsor'` (`lib/coach-register-book.ts:406`),
   which is the pattern.
3. **The warning is not a warning.** The other-in branch shows `fieldWarning` when the row is in
   `derivedKeys` (panel ~5709–5811) but Save stays live; the money-in POST then refuses with 409 via
   `whyIncomeIsRefused` (`money-in/route.ts:141`) — the same sentence. And it is conditional: the
   refusal keys on `getDerivedIncomeClaims` (budget LINES of kind funding/sponsorship), so a team
   with no such line records the same money without complaint.
4. **A drive is not attached to a budget line.** `rep_fundraisers` has no item/category column
   (DATA_DICTIONARY §`rep_fundraisers`). `placeDerivedActual` (`lib/coach-money-derived.ts`) places
   the whole per-source pool by the claiming lines: one line → that item; two items in one category
   → the category's "Not itemized"; across categories or none → no category ("Not in the plan ·
   Fundraising money"). **Budgeting two fundraising lines blanks both.** Same for Grant + Team
   sponsorship.
5. **A coach's own word reports under the wrong heading.** Coach/club item creation never sets
   `actual_source` (default `'typed'`, mig 280), `budgetLineKindForItem` → `other_income` →
   `LINE_KIND_SECTION` "Expected other income", while the row reads "Fundraising · …". The coach
   POST (`app/api/coaches/[orgSlug]/budget-items/route.ts` ~line 109) explicitly allows a platform
   category, so this is reachable today. **Blast radius today: zero** — mig 280's measurement
   (2026-09-07, both databases): no club- or coach-created money-in items exist. Tournaments' three
   revenue words already report as other income, which is where rule 5 keeps them; **the section
   rule moves nothing on either database.**

---

## 3. Build — in order

### 3.1 Migration 285 — the shelf knows its source; a drive knows its line

- `budget_categories.income_source text NOT NULL DEFAULT 'typed' CHECK IN ('typed','fundraiser','sponsor')`.
  Set `'fundraiser'` on the platform Fundraising category and `'sponsor'` on platform Sponsorship
  (`org_id IS NULL`, matched by name **once, in the migration**). Every other category — platform
  Tournaments/Other Income and every club/coach category, including a club's own category that
  happens to be named "Fundraising" — is `'typed'`. Comment on the column says what it decides.
  - Considered and rejected: deriving at item-create time from the platform category's NAME. Mig
    280's own reasoning against a name-keyed lookup applies; a column is what the category IS.
- `rep_fundraisers.budget_item_id uuid NULL REFERENCES budget_items(id)` and
  `budget_category_id uuid NULL REFERENCES budget_categories(id)`; index on `budget_item_id`.
  Category is stored **alongside** the item and re-derived from it on every write (the mig 282 part-2
  rule: a record carries both, and readers read them in different orders).
- **Backfill preserves today's report exactly.** For each `kind='fundraiser'` record: if its program
  year has exactly one `rep_budget_lines` row with `line_kind='funding'`, link to that line's
  item+category; otherwise leave NULL. Same for `kind='sponsor'` against `'sponsorship'`. A NULL
  record keeps today's pool placement (§3.6) with a nudge in its room. ⚠ Do **not** blanket-default
  to the standard word: a team that budgeted only *Merchandise sales* would see its drive money jump
  to an unplanned *Fundraising drive* row while Merchandise went blank (mockup, "what ships with it"
  §3). Expected volume: mig 280 counted 5 money-in lines on dev, 1 on prod.
- No change to `rep_fundraiser_entries`.
- `DATA_DICTIONARY.md` for both tables + `npm run refresh:snapshots` in the same unit of work;
  `check:dictionary` must pass.

### 3.2 A word is born on its shelf

- Coach POST `app/api/coaches/[orgSlug]/budget-items/route.ts` (~line 333) and the club's
  `app/api/admin/accounting/budget-categories/[catId]/items/route.ts`: for `direction='in'`,
  `actual_source = category.income_source`; for `'out'`, `'typed'` (the `out_is_typed` CHECK).
  **Never from the request body.** The category is already loaded for the visibility check.
- Unit test: an item created under a `fundraiser`-source category derives kind `funding`; under
  `typed`, `other_income`; a money-out word is always `typed`.
- **The section rule needs no new mechanism.** `budgetLineKindForItem` → `LINE_KIND_SECTION` already
  produces Expected fundraising / sponsorship for the derived sources. Finding 5 is fixed by this
  alone.
- The create panel's footer sentence (`components/accounting/BudgetItemPicker.tsx` ~line 135, "Saved
  as **money coming in** — because that is what you are recording.") gains "Will report under
  Expected other income." **only** when the chosen category's source is `typed` and the direction is
  `in`. Categories reach the picker with `incomeSource` on `BudgetCategoryWithItems`.

### 3.3 The budget picker loses its note

- Delete `ACTUAL_SOURCE_TAG` and the `rowTag={…}` pass in `accounting/budget/panel.tsx`. If no other
  caller uses `rowTag`, delete the prop and `.optSource*` from the shared picker (`/simplify` decides;
  the prop was added for this one caller on 2026-09-07).
- Delete any test asserting "From a drive" / "From a sponsor" copy.

### 3.4 Record money

- `CONV_BRANCH` sub-lines: `drive` → "Logged to a drive — the whole team, or one player";
  `sponsor` → "A business or a grant gave directly"; `'other-in'` → "Interest, a facility rebate, a
  plain donation" (the product's own words for other income, `KIND_HINT_LONG.other_income`).
- **Other-in branch picker:** filter `categories` (loaded at panel ~2668 from `/budget-items`) to
  items with `actualSource === 'typed'`, dropping categories left empty, before passing to
  `BudgetItemPicker` (~line 5750). Placeholder for this branch: `Search what this is — e.g.
  “interest”, “rebate”`. Empty state (`Nothing on this side matches “…”.`) gains: "Fundraising and
  sponsor money is recorded under “Fundraiser money came in” or “A sponsor came through”, above."
- Delete the `derived` warning, `derivedKeys` state and its load (`inData.derivedKeys`, ~2713).
- **Server refusal becomes structural:** `whyIncomeIsRefused` refuses a typed `income` record against
  any item whose `actual_source !== 'typed'`, unconditionally, on POST and PATCH; `money_back` stays
  exempt. The claims read leaves the money-in routes. (`derivedIncomeKeys` survives only for §3.6's
  fallback.) The GET stops returning `derivedKeys`.
- **Sponsor labels** (two sites, ~4658 and ~5036, plus the picker ~4946): "Which sponsor or grant? *",
  option "A new sponsor or grant…", field "Sponsor or grant *", placeholder "e.g. Riverdale Dental,
  or Community Sport Grant". Same in `SponsorRoom.tsx`'s edit sheet (~710).
- **Sponsor cold branch gains "Raising for"** under the name: `BudgetItemPicker` with `direction="in"`
  and categories filtered to `incomeSource === 'sponsor'`; pre-filled *Team sponsorship*; posted with
  the sponsor create. The `sponsor` branch is a direct writer through the fundraisers POST.
- **Drive branch's "Which player *" becomes "Who raised it *"** with **"The whole team"** as the first
  option (tag "No family share"), then the roster under a "Players" heading. Posts `playerId: null`.

### 3.5 Fundraiser rooms and the drive's board

- **New-fundraiser form** (`fundraisers/panel.tsx` ~957) and **Edit fundraiser** (`DriveRoom.tsx`
  ~455): "Raising for" as the second field under Name, filtered to `incomeSource === 'fundraiser'`,
  pre-filled *Fundraising drive* on create. **Edit sponsor** (`SponsorRoom.tsx` ~710): same, the
  Sponsorship shelf, pre-filled *Team sponsorship*.
- Fundraisers POST/PATCH accept `budgetItemId`; the server resolves it with `resolveBudgetItem`
  (team-visible, `direction='in'`, **and the item's category `income_source` must match the record's
  kind** — a drive cannot raise for a sponsorship word by API either), stores item + category. The
  `Fundraiser` row type (`fundraisers/types.ts`) and GET carry `budgetItemId/Name`,
  `budgetCategoryId/Name`.
- Room facts line: "Raising for **X**". A NULL (legacy) record shows a quiet nudge "Pick the budget
  line this drive is raising for" — the only place a coach meets the legacy state.
- **Entries POST** allows `playerId: null` when `fundraiser.kind === 'fundraiser'`: rebate 0, no
  `rep_dues_credits` row, the `accounting_entries` income row still written (the ledger sees the
  money). `receivedDate` optional as now. Several team entries per drive are legal (the unique index
  permits NULLs, exactly as arrivals).
- **Entries GET** maps a null-player drive row to `playerName: 'The whole team'`, `playerActive:
  true`, `rebateAmount: 0`.
- **Board** (`DriveRoom.tsx` entries table): team rows show a dash in Credit; Edit and Remove work on
  them; the delete confirm reads "the $400.00 logged for the whole team".
- **`driveFacts`**: "**N of M** players logged · plus **K** team entries" — a team entry never counts
  as a player.
- **Readers to audit for a null player on a `fundraiser`-kind record** (grep `rep_fundraiser_entries`
  2026-09-08): the four fundraiser routes; `lib/db.ts` (`playerCount: a?.players.size` at ~8302 must
  exclude null; `totalRaised`/`teamNet` include the amount); `lib/coach-register-book.ts` (keys on
  kind — the row's detail must read "The whole team", never blank); `lib/sponsor-arrivals.ts` and
  `-server.ts` (sponsor-only — confirm they filter by kind, not by null player); the season
  settlement pot and dues credits (nothing to credit); exports; `scripts/seed-demo-coach.mjs`,
  `check-demo-coach.mjs`, `seed-qa-day-fixtures.mjs`, `seed-uat-coach-fixture.mjs`; UAT specs
  `coach-membership-smoke`, `coach-money-mobile-smoke`, `coach-sponsor-money-lifecycle`.

### 3.6 Placement on Budget vs. Actual

- `budget-vs-actual/route.ts` (~1345–1352): each fundraiser/sponsor **with** a `budget_item_id`
  lands its realised total on that item's row (category from the record). Records **without** one
  fall back to today's `placeDerivedActual` over the NULL subset only, per source;
  `UNPLANNED_DERIVED_CATEGORY` / `unplannedDerivedItemName` stay for the none case.
- `getDerivedIncomeClaims` (`lib/db.ts` ~11914) is read only for that fallback.
- `lib/coach-budget-rollup.ts` (~385, ~557) reads placement output — verify, don't change.
- `tests/unit/coach-money-derived.test.ts` gains per-record placement cases; the pool cases stay,
  re-titled as the legacy fallback.
- "Not itemized" survives for the honest cases: a legacy record with no line, or money nobody
  planned for. It stops being the default.

### 3.7 Demo, help, docs

- **Demo seed (`scripts/seed-demo-coach.mjs`, `lib/demo-coach.ts`):** `OFFSEASON_MONEY_IN`'s
  `OS-IN-MERCH` is a **typed** $480 income record on *Fundraising · Merchandise sales* ("Team hoodie
  order — margin") — exactly the state the model removes, and it is seeded on **production**. It
  becomes a fundraiser "Team hoodie order" raising for *Merchandise sales* with ONE whole-team entry
  of $480 — the demo's showing of the new feature. The bottle drive raises for *Fundraising drive*;
  the sponsor raises for *Team sponsorship*. `OFFSEASON_FUNDING_LINES` stays. Re-read every dock
  line and tour step that mentions recording money, "Other money in", the hoodie order or the bottle
  drive (`lib/demo-coach.ts` ~460–570, ~1180–1230) and true them up. `check-demo-coach.mjs:338`'s
  "no typed income sits on a row whose actual comes from a fundraiser" widens to every
  fundraiser/sponsor word; pin the hoodie drive and its team entry. `npm run check:demos` green.
  ⚠ Prod's demo re-anchors by cron but is **reseeded only by hand** — the release runbook must reseed
  `riverdale-ridge` after the deploy or the prod demo holds a typed record the product no longer
  offers.
- **Help (`lib/help-content/coaches.tsx` ~1620–1680, ~1880–1900, ~2185):** the Record money and
  fundraising articles describe "Other money in" taking fundraising words and "Which player" on a
  drive. `/docs` in the same unit of work; keywords gain "whole team", "raising for", "sponsor or
  grant".
- `TODO.md` line; `OWNER_QA_LEDGER.md` **§157** with a checkable walk artifact (Sign-in-as card,
  pinned identities, the §3.8 count as a precondition); this plan's status line; auto-memory.

### 3.8 Production data check — gates §3.4's removal

Before the words leave the picker, count on **prod** (read-only) and dev: `rep_team_money_in` rows
with `entry_kind='income'` whose `budget_item_id` points at an item with `actual_source <> 'typed'`,
and — after 285 — any `budget_items` with `direction='in'` under a fundraiser/sponsor-source category
that a coach/club created (expected: none). **Expected finding: the demo's $480 hoodie record on both
databases; nothing else.** Anything else is listed for the owner. Rule: **legacy typed rows stay
readable and counted exactly as today** — the door closes, history does not — unless the owner asks
for a re-file. Mig 280's budget-line count is not evidence about typed *arrivals*.

---

## 4. What is deliberately NOT built

- No sponsor-or-grant type on the sponsor record.
- No question at category creation; no per-category section override UI beyond what "changeable on
  the category" needs (the source column is platform-set; a coach category is `typed`, full stop —
  "changeable" here means the coach can move the word to a different shelf, which already exists).
- No automatic re-pointing when the budget line a drive raises for is deleted — the drive keeps its
  word; the report shows it as income not in the plan, which is honest.
- No hand-typed "drive result" separate from the whole-team entry.
- No undo of a "Raising for" change; the board re-reads and the report follows.
- Undoing an accidental rollover, season history, the closed-season page: untouched. A drive's
  "Raising for" is read by the closed-season money shelf like any other field; no year parameter
  is added anywhere (`HISTORY_ENDPOINTS` guard stands).

## 5. Verification

- `npm run typecheck` (shared modules + API contracts change); `npm run verify:changed` including
  `check:dictionary`, `check:spelling`, `check:demos`; unit suites touched:
  `coach-money-derived`, `budget-line-kind-from-item`, `coach-budget-totals`, `dues-definition-guard`
  (untouched but run), any picker copy test; `npx next typegen` before typecheck (Next 16.3).
- Layout sweep for the New/Edit fundraiser forms (a new field) and the drive Record window (a new
  option) — `--only=` the affected screens; reseed first.
- UAT: `coach-sponsor-money-lifecycle` (new label + Raising for), a new whole-team entry scenario
  through the entries route asserting rebate 0 / no credit / ledger row present / board label.
- `/simplify` then `/review` on the working tree, naming the migration body explicitly.
- Dev server restart before hand-off (new files, shared modules, migration).

## 6. Order of work, restated

1. §3.8 count (read-only) → 2. migration 285 + dictionary + snapshots → 3. §3.2 words born on their
shelf → 4. §3.5 rooms + whole-team entry + reader audit → 5. §3.6 placement → 6. §3.4 Record money
(the removal ships last inside the build, after the paths that replace it exist) → 7. §3.3 note off
→ 8. §3.7 demo, help, docs, §157 walk.
