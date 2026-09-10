# Categories & Items Door — the coach's vocabulary dialog, redrawn by side

> **Status:** BUILT on dev 2026-09-09 (uncommitted; commit held for the owner's word) — gates green, **Owner QA §163 owed** (walk artifact `a4f50a36`)
> **Branch:** dev
> **Mockup (binding, rounds 1–4b on one URL):** https://claude.ai/code/artifact/43698c62-e5db-41c2-a6b3-70735a64e1fd
> · source `docs/projects/active/COACH_BUDGET_WORDS_MANAGER_MOCKUP.html`
> **PM brief:** `docs/projects/active/COACH_BUDGET_CATEGORIES_AND_ITEMS_DOOR_PM_BRIEF.md`
> **Owner QA:** §163 in `OWNER_QA_LEDGER.md` · walk artifact `a4f50a36` · source `COACH_BUDGET_CATEGORIES_AND_ITEMS_DOOR_WALK.html`

## 0. Why this exists — what the owner hit, verified on the live demo world

The owner opened *Manage our words* on a team whose own item (*Chocolate sale*, under Fundraising)
carried the **Our own** chip in the picker, and could not find it in the dialog. It was there, below
a line nothing could scroll past:

| Measured on `riverdale-ridge` mid-season team, desktop 1440×900 | |
|---|---|
| Dialog box | 810 px |
| Content inside it | 4,296 px |
| Rows | 64 (11 headings · 1 own item · 52 shared words) |
| "Our items" heading | 81 px below the box's bottom edge |
| Scroll after a 2,500 px wheel | 0 px (same on the 390 phone sheet: 4,978 px in 844) |

`BudgetItemManagerModal` wraps its frame in `.modalScrollBody` (`overflow: hidden`, expects ONE
scrolling child) and renders its body as `.formBody`, which is not one of the recipe's named shapes.
Third instance of the class recorded in `memory/reference_modal_scroll_body_clips_silently` (the two
Budget-vs-Actual panels were the first two). Even scrolled, the design put the one or two editable
rows under eleven read-only headings and above fifty-two read-only words.

Two drifts on the same door: its tooltip still offers *"or move it to the other side"* (retracted
2026-08-17), and it renders only when `ownItemCount > 0`, so a coach setting vocabulary up before
their first line has no door.

**Found on the way, a live defect:** the picker's inline *"+ Add custom category…"* posts
`{ newCategoryName }` with **no `teamId`**. Since mig 277 (2026-09-04) the route calls
`denyUnlessTeamMoneyWrite(assignments, '')` on that branch and answers **400 "teamId is required and
must be a team you coach"**. A coach has not been able to create a category from any money form for
five days. Fixed here (§4.4).

## 1. Owner rulings (2026-09-09, from mockup rounds 1–4b — all approved as recommended)

| Q | Ruling |
|---|--------|
| Q1 | The door is **"Manage categories & items"**; the dialog is titled **"Categories & items"**; the three group words are the chip words **Our own · Club · Standard**. Help, its search keywords and the three forms' hints move with it — one name, every surface. |
| Q2 | Add from the dialog: one **"+ Item"** per side band. The door is **no longer gated** on owning an item. |
| Q3 | A team's own category **can be removed while it holds nothing** — the same "only while nothing is filed" rule items live by. Standard and club headings stay undeletable. |
| Q4 | Default filter is **Our own**; the shared library sits behind **Club / Standard / Everything**, never as the page. |
| Q5 | A second door as the **picker's last row**, "Manage categories & items…", the idiom "Manage tags…" set. Both doors open the same dialog. |
| Q6 | **Withdrawn.** No side is stored on a category. The side lives on the item; a shelf appears under a band when it holds items on that side (the picker's own rule: *categories are never filtered, only grouped*). |
| Q7 | The add form ends with **one quiet line saying where the money reports** — never a "who reports this?" question. ⚠ **The sentence changed under this plan the same day:** the *category-is-the-shelf* ruling (R1, built 2026-09-09) makes a money-in line report under **its own category's name**, so a coach's *Bake sales* heading reports as **Bake sales**, not *Other income*. The line reuses `newMoneyInWordNote` ("Will report under Bake sales.") plus the half that is still true: only Fundraising and Sponsorship have a drive or a sponsor filling the number in. |
| Q8 | Side order: **Money coming in first** (the shorter side; the "What am I forgetting?" index's order, R2). |
| Q9 | The add form's **Category list is ordered, not filtered**: headings already taking this side first, then every other heading under the label *"Not taking money in yet — pick one and it will"*, then **"+ New category…"** last. |
| Q10 | **Categories are created only from inside the item form.** No "+ Category" button anywhere. A heading is always born with its first item; the two are saved together. |
| Now | The clip is a defect regardless: scrolling pane on the body, the guard widened to every dialog on the recipe, the tooltip corrected. |

## 2. What does NOT change

- The tiers, their predicates and the chips (`lib/coach-budget-item-tiers.ts`). Standard and club rows
  stay read-only here; the club renames its own from Org Budget.
- Rename is retroactive; remove refuses while anything is filed; the fold ("Use a shared item
  instead") and its screen — only the noun changes from *word* to *item*.
- No move between sides (retracted 2026-08-17). A wrong-side item is removed and re-added.
- The item POST's category-only branch (`newCategoryName` alone) keeps working for the picker's
  existing two-step.
- Nothing about totals, reports or the plan.

## 3. Design — as built to the mockup

```
Categories & items                                              ×
What your budget lines are filed under. Yours to change; the rest shown on request.
[🔍 Find a category or item]
(Our own 4) (Club 2) (Standard 61) (Everything)
━ MONEY COMING IN · 1 of yours ·································· + Item
   Fundraising                                        [Standard]
      Chocolate sale — 1 budget line · 3 money in           ✎ 🗑(grey)
━ MONEY THE TEAM SPENDS · 3 of yours ···························· + Item
   Provincials Trip                                   [Our own]  ✎ 🗑(grey: holds 2)
      Hotel block — 2 budget lines · 1 recorded cost         ✎ 🗑(grey)
      Charter bus — Nothing filed yet                        ✎ 🗑
   (Nothing under it yet — own headings with no items, if any)
hint · hint
[Use a shared item instead]                                   [Done]
```

- **Bands** are the two Add Line answers verbatim (`SIDE_OPTIONS` in the budget panel:
  *Money coming in* / *Money the team spends*). No side chip on any row.
- **Filter** is by tier of ITEM (and of heading for the group labels). Under *Our own* a shared
  heading appears only because one of the team's items lives under it; under *Everything* item rows
  wear their tier chip (the three tiers mix), headings always wear theirs.
- **Search** matches category or item name, within the current filter; when nothing matches but
  *Everything* would, a one-line door says so and switches the filter.
- **Rows**: own heading → pencil + bin (bin disabled while it holds any item); own item → usage
  sub-line + pencil + bin (disabled by usage); shared → read-only, no pencil.
- **+ Item** opens an inline form under its band: Category (native `<select>` with two `<optgroup>`s
  and a last "+ New category…" option), New category name (unfolds), Item name, the reporting
  line, Cancel / Add item. Side comes from the band and is stated in the reporting line, never asked.
- **Doors**: the toolbar button (renamed, un-gated, tooltip corrected) and the picker's last row.
  The picker hosts the dialog itself when given `manage={{ orgSlug, onChanged }}` — one prop per
  call site, the shape `TagSearchCombobox` set on 2026-09-01.

## 4. Build — in order

### 4.1 Pure view module — `lib/coach-budget-manager-view.ts` + `tests/unit/coach-budget-manager-view.test.ts`
- `groupBySide(categories, teamId, filter, query)` → `{ in: Shelf[], out: Shelf[], orphans: Category[] , counts }`
  where a Shelf is a category with only that side's items after the tier filter and search.
- `categoryOptionsForSide(categories, side, teamId)` → `{ taking: [], notYet: [] }` — the Q9 order.
- `reportingLine(category | { name, isNew }, side)` — Q7's sentence, built on `newMoneyInWordNote`.
- Tests: Tournaments under both bands with half each; Team Gear never under `in`; an own heading
  with a money-in item joins the `in` band; filter semantics; search fallthrough count; option order.

### 4.2 Server
- **DELETE** `/api/coaches/[orgSlug]/budget-categories/[catId]` (beside PATCH): team money-write on
  the named team; the row must be this team's own; refuse (409, one sentence) if any `budget_items`
  sit under it or any of the seven `categoryColumn`s in `BUDGET_ITEM_REFERENCES` point at it (all
  SET NULL — a delete would silently blank a filing); delete re-asserts `org_id` + `team_id`.
- **POST** `budget-items`: when `newCategoryName` AND `name` (+ `direction`) arrive together, create
  the category then the item; if the item insert fails, delete the just-made category and return
  the item's error. Category-only branch unchanged. Response `{ category, item }`.
- ⚠ No migration. No dictionary change.

### 4.3 The dialog — `components/coaches/BudgetItemManagerModal.tsx`
- Body gets `styles.scrollPane` (the clip fix). Title/subtitle per Q1. Search, filter chips, bands,
  shelves, rows, the inline add form, the fold screen with the new noun.
- Usage stays fetched by the dialog (`usage=1`); own-category "holds N" derives from `categories`.
- Category remove → DELETE; refusal sentence shown as-is.

### 4.4 The picker — `components/accounting/BudgetItemPicker.tsx`
- New optional `manage?: { orgSlug: string; onChanged: () => void }` (coach mode); when present the
  dropdown's last row is the door and the picker mounts the dialog itself.
- **Defect fix:** `handleSaveCustomCategory` sends `teamId` in coach mode.
- `localCategories` re-syncs when the `categories` prop changes identity (the manager renames and
  folds; the host re-reads; the open form must see it).

### 4.5 Doors and hints
- Budget panel: button text, no `ownItemCount` gate, tooltip; the Add Line picker gets `manage`.
- Expenses panel, `CommitmentView`, `RaisingForField`: `manageHint` → new name; `manage` where a
  refresh exists (`bumpMoneyRevision`).
- CSS: bands, filter chips, the door row — in `coaches.module.css` / the picker's module.

### 4.6 Guard — `tests/unit/modal-scroll-recipe-guard.test.ts`
Every `.tsx` under `components/` and `app/[orgSlug]/coaches/` that uses `modalScrollBody` (class or
`scroll` prop) must reference one of the recipe's scrolling children (`scrollPane`, `formGrid`,
`payDrawer`, `ppDrillWrite`, `settlementScroll`). Would have failed on this dialog.

### 4.7 Copy that names the door
- `lib/help-content/coaches.tsx`: the Budget guide paragraph (~1699), the manage article (~2163) and
  the `searchText` at ~1627 ("manage our words manage our items" → the new nouns, keeping the old
  ones as search aliases).
- Demo dock lines / tour steps: **none name the door** (grepped `.mjs/.ts/.tsx`), nothing to true up.
- The mockup's Q7 sentence corrected to the shelf ruling.

### 4.8 Gates, then QA
`npm run typecheck` · `npm test` · `npm run lint:focused -- <files>` · `check:spelling` ·
`check:css-module-purity` · `check:css-selectors` · `check:layout --only=coach-budget` at 390/768/1440
· `check:demos`. Then the checkable walk artifact + a ledger section, `/simplify` (new abstraction:
the pure view module + the picker's `manage` prop), `/review`.

## 5. Risks, and what holds them

1. **Concurrent session in the same working copy** — `budget/panel.tsx` and `lib/help-content/coaches.tsx`
   carry another session's uncommitted hunks. Edits here are surgical and unique-anchored; the
   commit stages explicit paths and is held until those files' foreign hunks are theirs to commit.
2. **The picker's local copy** — resetting it on prop change could drop a just-created item until the
   host re-reads; every coach host re-reads on `onChanged`/`bumpMoneyRevision`, and the selection
   lives on `value`, not the list.
3. **Category delete and legacy rows** — a heading with no items can still be named by a pre-mig-240
   line's `category_id`; the server counts all seven reference tables, not just items.
4. **Fourth vocabulary change in a month** — help is done in the same unit of work; the demo has no
   sentence about this door (verified), so nothing there to go stale.

## 6. Build record (2026-09-09)

Everything in §4 built as written, with three things learned on the way:

1. **Q7's sentence changed under the build.** The category-is-the-shelf ruling (R1) landed the same
   morning, so a coach's own money-in heading reports under **its own name**, not *Other income*. The
   form's line reuses `newMoneyInWordNote` ("Will report under Bake sales.") and adds the half that is
   still true (only Fundraising and Sponsorship have a drive or a sponsor filling the number in). The
   mockup was corrected (round 4c) and the ruling table above records it.
2. **The ownership guard pinned the old rule.** `budget-category-ownership-guard.test.ts` asserted no
   DELETE on either category route; it now asserts the club side has none and the coach side has one
   that counts the items AND walks `BUDGET_ITEM_REFERENCES` before the delete, re-asserting the team.
3. **The un-gated door is a new layout finding at 768** — 33px, the same height as its two toolbar
   siblings (Export 33, Add Line 31), both already in `scripts/.layout-baseline.json` with the standing
   "desktop keeps compact controls; the phone breakpoint enforces 44" reason. Recorded beside them with
   that reason; not re-decided here (the tablet band project owns the toolbar's height).

**Gates:** typecheck ✓ · 3,347 unit tests ✓ · focused lint no errors (pre-existing warnings only in the
two large panels) · spelling ✓ · CSS purity ✓ · dead selectors ✓ · `check:layout --only=coach-budget`
✓ · `check:demos` ✓. **Executed against dev:** the create-with-item, refuse-while-holding, delete-empty,
sideless-400, category-only, no-teamId-400 and standard-403 doors, all cleaned up after. **Playwright on
the demo world:** the new door, no clip, Everything scrolls, usage line, search door, picker last row.

**Noted, not done:** `describeBudgetItemUsage` pluralises "1 budget lines" — the dialog singularises
locally; the shared helper feeds three refusal sentences and should be fixed where it lives.

## 7. `/simplify` — run 2026-09-09, four cleanup lenses

**Fixed (7):** (1) the category DELETE hand-rolled its own walk over `BUDGET_ITEM_REFERENCES` and
joined the refusal with a bare comma — now `countBudgetCategoryUsage`, the item counter's twin over
one shared `countReferences` loop, and the sentence comes from `describeBudgetItemUsage`, so the
category's refusal and the item's read in one grammar; (2) the plural defect ("1 budget lines") is fixed
in `describeBudgetItemUsage` where it lives, with a test — the dialog's local singularising copy is gone
and the row now speaks the shared sentence; (3) the four call sites' hand-typed "rename it later" hint
(already drifted once — one host had dropped the side clause) is synthesised by the picker from `manage`,
and the `manageHint` prop is retired; (4) the heading and item rows shared 45 duplicated lines of inline
rename — one `renameRow`; (5) the add form recomputed the heading name its own memo already held;
(6) a missed search printed "nothing matches" under each band AND above them — once now, and a total
miss also says so; (7) the combined create fetched back the category row it had inserted a moment
before — it reads the insert's row. Plus the guard test's dead regex and a twice-read stylesheet.

**Skipped, with reasons:** the filter chips re-use a pill idiom the stylesheet retired for one old
filter set in favour of dropdowns — the chips are on the mockup the owner approved, and they are a
view filter, not a form select; the layout baseline has no class-level exemption, so the door's entry
stays per-control like its two siblings'; the picker's door-hosting mirrors `TagSearchCombobox` by
design (a shared hook across two comboboxes would be a new abstraction for two users); `codeOnly` is
now in four guard tests — a shared test helper is a wider change than this diff.

⚠ **A collision on the way, recorded because it cost something.** A regex used to replace the item
counter ran past its function (the shell layer strips backslashes from inline scripts — write scripts
to files) and consumed 500 lines of `lib/coach-budget-items.ts`, including three helpers another
session had added uncommitted. The module was rebuilt from HEAD with a brace-counted replacement;
the peer session re-saved its three helpers itself within minutes; `findLineHoldingItem`'s body was
also recovered from the dev server's compiled chunk as a cross-check. Typecheck, 3,363 unit tests (the suite has grown under other sessions since),
lint, the doors script and the dialog probe all green afterwards.

## 8. `/review` — run 2026-09-09, high-risk tier, five finder lenses + main-loop adjudication

**Gates (Stage 0):** typecheck ✓ · 3,363 unit tests ✓ · focused lint ✓ (0 errors) · `verify:changed`
green except `check:schema-parity`, which correctly reports another session's migration 286 index as
dev-only · `check:layout --changed` widened to the whole portal by the shared stylesheet and exited
green (no new findings; no screen failed to render).

**Confirmed and fixed in this diff:**
- **High · the dialog opened from a filtered picker showed a slice of the library.** The fundraising
  form's "Raising for" box and the money form's other-money-in branch hand the picker a filtered
  shelf to pick from, and the picker hosted the dialog on that same list — so from those doors a
  coach saw one or two headings and every spending heading was unreachable. `manage` now carries the
  host's FULL `categories`, named explicitly. Proven on the demo world: opened from the fundraising
  form, thirteen headings, both bands.
- **Medium · an over-long item name after the heading was created left an orphan.** The item branch's
  80-character check sat after the category insert; it is now checked before anything is written.
  Proven against the fixture: an 81-character name answers 400 and leaves no heading.
- **Medium · stale selected label after an in-dialog rename.** The picker's field showed the name
  captured at selection; it now reads the live name from its list by id, snapshot as fallback.
- **Medium-High · double submit could mint two headings with one name** (no database uniqueness on
  category names, by design). Re-entrant guards on add, remove and remove-heading.
- **Low · verb agreement** — the singular sentence met a fixed plural verb at four sites ("1 budget
  line are filed"); the new route, the dialog's tooltip and two pre-existing routes now agree.
- **Low · three dead imports** left by the hint retirement; one stale "Manage our words" comment.

**Adjudicated in the main loop, accepted with reasons:**
- *Category delete's check-then-act window with the CASCADE onto items* (same-team race between the
  count and the delete). Accepted under the house check-then-act posture the sibling item delete
  already carries; the window is one round trip on a door only a money-write coach on that team
  reaches. A conditional delete needs an RPC and is noted, not built.
- *Duplicate category names under a true concurrent race* — client guard closes the double-submit;
  the server's name check remains check-then-act by the existing design (no unique index).
- *autoFocus after switching back from "New category"* — a focus papercut, not data; left.
- *A legacy unfiled expense's client-side category snapshot* — pre-existing, narrow; left.
- *A stale cursor index across blur/refocus in the picker* — pre-existing mechanism; left.

**Refuted / not findings (5):** usage counts going stale after the dialog's own writes (every host
re-reads on the shared revision); the door's mouse-down keeping focus so the blur timer never clears a
typed query; the overlay lock stacking inside the Add Line room (reference-counted by design); the
combined create's rollback racing an outside add (the new id is unknowable until the response); the
guard test's regexes.

**After the fixes:** typecheck ✓ · 3,363 tests ✓ · lint 0 errors · spelling ✓ · the doors script and
the two dialog probes re-run green.
