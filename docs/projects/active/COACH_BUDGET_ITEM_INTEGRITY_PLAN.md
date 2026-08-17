# Budget items — what a word IS, and who may take it away

**Status: ALL FOUR PHASES BUILT ON DEV 2026-08-17 — Owner QA §44, §45, §47 (all owed).**
Design ruled by the owner 2026-08-16/17 (in conversation); nothing in §0 was re-opened building it.
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

⚠⚠ **`org_budget_lines` WAS NOT SAFE, AND THIS PARAGRAPH USED TO SAY IT WAS** (corrected by
`/review`'s security lens, 2026-08-17). It read: *"safe today by accident — the Org Budget can only
choose club/standard words, so an org line can never point at a row publish deletes."* **The second
half is false.** The club's own budget-line writer
(`app/api/admin/accounting/budget-plan/lines`, POST and PATCH) takes `itemId` straight from the
request body and inserts it with **no validation whatsoever** — no ownership check, no tier check,
not even `resolveBudgetItem`, which every coach-side write path goes through. So an owner or
treasurer in **any** org can point one of their org budget lines at **any** budget item in the
database, including another org's team-owned word.

P3's fold re-points by item id, so an unscoped update would have rewritten that other tenant's row —
its item *and* its category — as a side effect of a coach here tidying their own vocabulary. **The
fold is now scoped to the acting org** (`org_id` is NOT NULL on all four tables, so nothing
legitimate can be skipped, and the re-count before the delete catches it if anything ever is).

✅ **AND THE UNVALIDATED ADMIN WRITER IS NOW FIXED TOO** (owner-directed 2026-08-17, after the
walkthrough at artifact `5f30bad4`). Both club budget-line doors resolve the word through
`resolveOrgBudgetItem`, and the club's taxonomy list reads the same predicate the save does
(`itemOfferedToClub`) so the two cannot drift — a list offering what a write refuses, or a write
accepting what the list hides, is the same defect one tier down. **The category is derived from the
word on both doors as well**, closing the second half nobody had named: the two columns were set
independently, so a club line could sit under one heading with its word living under another.
⚠ Live data checked before tightening: 4 club budget lines on dev, **none** pointing at any word, so
nothing existing could be refused by the new rule.

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

### ✅ P1 — Stop the bleeding. **BUILT ON DEV 2026-08-17** — Owner QA **§44**, migration **248**

All four items below shipped together, plus §4 P4's shared list, which came forward because three
of the four guards needed it on day one rather than as a later tidy-up.

**Proven against the live dev database, not by reading the index:** a team may now hold *Grant* as
income and *Grant* as an expense (both accepted), while a second *Grant* on the same side — differing
only in case — is still refused. Probe rows cleaned up after.

**The line-kind guard caught two things this change made stale**, which is exactly what it is for:
the publish route left `KIND_AGNOSTIC` because it no longer reads budget lines at all, and the new
usage counter joined it with its reason (it counts rows and sums nothing — a funding line and a cost
line count identically when the question is "is anything pointing at this?").

**Deliberately included beyond the four:** a team can now **remove** its own word. It was ruled but
had no numbered step, and removing the move-across button without it would have left the manage
screen offering rename alone — a screen that can create words and never clear them.

1. **Publishing promotes and nothing else.** Delete the twin scan, the repoint and the delete. Doors
   1 and 3 close together. The response reports the promotion; the admin list keeps its "also added
   by another team" note as *information*, no longer a prompt to merge.
2. **Guard the club's delete** — refuse while any record anywhere in the org points at the word, and
   say which teams and how many. Door 2.
3. **The side joins the identity** — the uniqueness index gains `direction`; the P2 same-name 409 is
   removed.
4. **Drop "move to the other side"** — the button in *Manage our items* and the `direction` branch of
   the coach item PATCH. Ruling 5. ⚠ **This retracts something already on dev** (P2, `91d1c2c8`).

### ✅ P2 — Tell the rows apart. **BUILT ON DEV 2026-08-17** — Owner QA **§45**, no migration

5. **Tags in the picker and the manager**: `Standard` · `Club` · `Our own`, never colour alone.
   `ITEM_TIER_LABEL` already existed with exactly these three tiers and had **no caller anywhere** —
   defined for this and never wired up. `team` was reworded *This team* → *Our own* to match the
   mockup and the door it is reached through.

   **Two judgement calls worth knowing:**
   - **The picker tags every row; the manager tags only its read-only section.** The picker mixes all
     three tiers, so every row needs its answer. The manager already separates the team's own words
     under their own heading — a chip on each of those repeats what the heading said — while the
     read-only section is the one place Standard and Club are *mixed*, and "ask your club to change
     one" is wrong advice for a standard word.
   - **The input names the tier only when the name is ambiguous.** At rest the box reads
     "Fundraising · Grant"; a coach re-opening a saved record cannot otherwise see which *Grant* they
     picked. Appending it always would put "(Standard)" on ninety per cent of rows — noise that
     teaches a coach to stop reading the end of the field, which is where the signal would be.

   ⚠⚠ **A SERVER MODULE ALMOST WENT INTO THE CLIENT BUNDLE, AND NOTHING WOULD HAVE REPORTED IT.**
   The tier helpers lived in `lib/coach-budget-items.ts`, which imports `supabase-admin` — the
   service-role client, constructed with an environment assertion **at module load**. The first
   `'use client'` import of `budgetItemTier` would have pulled that whole graph into the browser
   bundle of every screen with an item picker. It would not have thrown (the service key is not a
   `NEXT_PUBLIC_` variable, and the assertion passes in dev and in production), and typecheck is
   blind to it. Split into `lib/coach-budget-item-tiers.ts` — pure, imports nothing but types — and
   re-exported from the server module so there is still one definition of each rule.

   ⚠ **The rendered layout check proves nothing about this phase**: chips live inside a dropdown and
   a modal, and the sweep measures both closed. The warm theme is the real risk and it is owner-QA
   only — §45 says so.

### ✅ P3 — The team-chosen merge. **BUILT ON DEV 2026-08-17** — Owner QA **§47**, no migration
**Build prompt:** `COACH_BUDGET_ITEM_MERGE_BUILD_PROMPT.md`.

6. **"Use a shared word instead"** on *Manage our items*: multi-select the team's own words, choose one
   standard or club word **on the same side**, confirm, done. The confirmation names the counts by
   record type and **warns when the category changes**. Repoints all four tables, then removes the
   folded words.

⚠⚠ **THE REFERENCE LIST WAS ONE COLUMN SHORT, AND IT WAS THE ORIGINAL BUG ONE COLUMN TO THE RIGHT.**
`BUDGET_ITEM_REFERENCES` named only the column pointing at `budget_items.id`. But **all four of those
tables store the CATEGORY beside the item** (`rep_budget_lines.category_id`,
`rep_team_expenses.budget_category_id` *and* its free-text `category`,
`rep_team_money_in.budget_category_id`, `org_budget_lines.category_id`), each derived from the chosen
item at save time precisely so the report's two levels cannot disagree — and **Budget vs. Actual
prefers the stored category over the item's own** when it places a cost. A fold across categories
that moved only the item would have left every one of those records filed under the heading its old
word lived under: the season totals balance perfectly and the costs stop lining up with the plan they
belong to. The columns are in the list now, and the guard test checks them against the committed
schema. **The ruled behaviour never changed** — mockup §4 already promised *"its records will move to
Fundraising, where the club's word lives"*; the list simply could not express it.

**Three further judgement calls worth knowing:**

- **The usage phrasing had to leave the server module.** The confirmation is written in the BROWSER
  as a coach ticks boxes, so `describeBudgetItemUsage` needed a `'use client'` caller — and importing
  it from `lib/coach-budget-items.ts` would have pulled `supabase-admin` and its service-role client
  into the bundle of every screen with an item picker, without throwing and with nothing reporting
  it. Split into `lib/coach-budget-item-usage.ts` (imports nothing), re-exported from the server
  module. Exactly the trap P2 hit with the tier helpers, arriving through a different door.
- **`usage=1` now returns counts per KIND, not a total.** The fold confirms about a *selection*, so
  the browser sums as the coach ticks; asking the server on every tick would be four queries for an
  answer it already had. The delete tooltip gained the better sentence for free.
- **The fold never deletes on a partial re-point, and re-counts before it deletes.** Every link is
  `ON DELETE SET NULL`, so a delete after a failed move does not error — it blanks precisely the
  records that did not make it, on a path that had just promised they were safe. A record filed
  against a source *during* the fold keeps the words alive and says so.

**`/simplify` (2026-08-17) — five fixes applied, two skips worth recording:**

- ✅ **The manage screen was quadratic.** It asked for each of the team's own words separately, and
  each ask fanned out one query per referencing table — **four round trips per word**, forty for a
  team with ten, on every open of the modal and again after every change it made.
  `countBudgetItemUsageByItem` reads each table **once** and tallies in JavaScript: 4N → 4. It walks
  the same reference list, because a per-word counter that hand-picked its tables would be the
  original publish bug in a second place.
- ✅ **The two render trees repeated the whole modal shell** — overlay, frame classes, the
  stop-propagation wiring, header, body, footer. One `frame(...)` helper now. ⚠ **A function
  returning markup, deliberately not a nested component**: a component declared inside another gets
  a fresh identity every render, so React would remount the subtree on each keystroke and the rename
  input would lose focus mid-word.
- ✅ **The guard test's category check was validating, not generative** — it proved the columns named
  in the list still exist, which is precisely what the original bug survived (nobody had written the
  third table down, so nothing checked it). It now asks the SCHEMA the other question: does a
  reference table carry a category link the list has not claimed? With a canary, so an unloaded
  snapshot cannot pass it over nothing.
- ✅ `BudgetItemRepointTarget` is a `Pick<ResolvedBudgetItem, …>` rather than a second declaration of
  "an item plus its derived category". The *validation* stays separate on purpose —
  `resolveBudgetItem` accepts the team's own words, which a fold target may never be.
- ✅ The modal's zero-usage fallback goes through `NO_BUDGET_ITEM_USAGE` instead of re-spelling it.

- ⏭ **SKIPPED — folding the pre-count into the re-point's own affected-row count.** It would save
  four queries on a rare, deliberate action, at the cost of deriving *the one number this whole
  feature is judged on* from a different mechanism than the one the confirmation used. Not worth it.
- ✅ **DONE 2026-08-17, owner-directed** — the coach/team/money-write auth block was spelled a
  FOURTH time by this phase (list POST, item PATCH, item DELETE, fold POST) and the four had already
  drifted: three answered a blocked coach *"You do not have access to team finances. Ask the head
  coach to grant it."*, while the oldest answered *"teamId is required and must be a team whose
  finances you can edit"* — developer wording that **merged two different failures into one
  sentence** and never named the one remedy. One `denyUnlessTeamMoneyWrite` now serves all four.
  ⚠ **The two failures stay two statuses on purpose:** 400 for "no team named, or not one you
  coach" (a caller mistake) and 403 for "you coach it, your money access is off" (a permission fact
  with a remedy worth printing). Collapsing them was the defect, not the fix.
  ⚠ **This deliberately changes a message on a shipped screen** — that was the whole complaint.

**`/review` (2026-08-17, high-risk tier, 5 lenses) — 7 confirmed, all fixed. It found a real defect
again, which every review pass on this money area now has:**

- 🔴 **Cross-tenant write.** The fold re-pointed by item id alone, on the plan's own (wrong) claim
  that no other org could point at these words. See §1 above — **now scoped to the acting org.**
- 🔴 **The Budget Plan would have shown a word that no longer exists.**
  `rep_budget_lines.description` is NOT NULL and the server fills it from the item's name when the
  coach types nothing; the plan renders it raw; and the line editor *already* re-syncs it whenever a
  line's item changes, with a comment saying so. A fold is an item change to the same table and
  skipped it — so an auto-named line would keep reading *Public grants* while filed under *Grants*.
  Fixed, and **only where the text still equals the folded word's name** — anything else the coach
  typed, and no fold rewrites that. The probe now covers both cases.
- 🔴 **The per-word counter could silently undercount.** `/simplify`'s batched counter reads rows
  rather than asking the database to count, and a single read is capped — over the cap a word's
  count reads low, or zero. The manage screen would offer to remove a word with history behind it,
  and the fold's confirmation would understate what moves. Now paged.
- 🟠 **Stale counts survived a background refresh.** `categories` changes whenever any mounted money
  tab writes, and the "counts have arrived" flag was set once and never reset — so a cost filed in
  another tab left the open confirmation showing the old number. The counts are now carried
  *with the list they were read against*, so staleness is not something a flag can miss.
- 🟠 **A failed fold kept its pre-fold promise.** One server refusal leaves the world changed
  (records moved, words not removed); the screen did not re-read, so retrying offered to move records
  that had already moved. It re-reads on failure now.
- 🟡 The backdrop and the ✕ stayed live mid-fold — a coach could click away and never see the
  confirmation of a fold that completed. Both are dead while it runs.
- 🟡 The reply mapped the target through the full item shape from a partial row, leaving four fields
  `undefined`. Nothing reads them today, which is what made it a trap.

**Two narrow races examined and deliberately accepted, documented at the code:** a record filed
between the count and the re-point is carried across but not counted (the reply names the number the
coach consented to, which is the better wrong answer); and one filed between the re-count and the
delete is caught by neither and loses its label. Closing the second properly needs a database
constraint, not more application checks.

⚠ **A comment was corrected, not just the code:** the note justifying the category move claimed
Budget vs. Actual always prefers the stored category. It does not — its month attribution prefers the
stored one, its cost placement prefers the item's. **Two readers, two orders**, which is a stronger
reason the two columns must agree, not a weaker one.

⚠ **Proven, not assumed:** `scripts/check-budget-item-fold.mjs` builds a club word, two team words in
**different categories**, and records of all three kinds; folds through the real HTTP route with a
real coach session; then checks that every record moved, was re-filed under the survivor's heading,
that both words are gone and that **Budget vs. Actual is unchanged to the cent** — with a canary that
fails the run if the report shows zero, because "unchanged" over an empty fixture is true of every
possible bug. Its first run read the wrong response fields and reported `$0.00 → $0.00` against a
season holding $10,650; the canary exists because of that.

### ✅ P4 — Make forgetting impossible. **BUILT WITH P1 2026-08-17**

7. **One named list of everything that points at a budget word** (`BUDGET_ITEM_REFERENCES` in
   `lib/coach-budget-items.ts`) driving every guard and, later, the fold. Plus
   `tests/unit/budget-item-references-guard.test.ts`, which reads the committed schema snapshot and
   **fails the build when a foreign key to `budget_items` exists that the list does not cover** — the
   shape `budget-line-kind-guard` and `coach-history-endpoint-guard` already set.
   ⚠ **Pulled forward from last to first** because three of P1's four guards needed it immediately;
   shipping them against hand-listed tables would have rebuilt the original bug in three new places.
   It also asserts every such key is still `ON DELETE SET NULL` (the premise every guard comment
   rests on) and that at least four exist, so an empty snapshot cannot make the suite pass over
   nothing.

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
