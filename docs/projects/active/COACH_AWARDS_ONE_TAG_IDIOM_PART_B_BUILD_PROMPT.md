# Kickoff prompt — Awards join the One Tag Idiom, Part B: the door, the drawer, merge, and an honest remove

*(paste into a fresh chat)*

**Build Part B of `COACH_AWARDS_ONE_TAG_IDIOM_PLAN.md` (Phases 2–4), and only that.** Part A (edit
and remove a *given* award where it was given) is **built on `dev`, uncommitted** — typecheck
clean, `verify:changed` clean except one unrelated pre-existing failure (below), 22 new unit tests
passing. Part B is the bigger move: the award-*type* library (MVP, Best Hitter, the chips a coach
invents) joins the same door/drawer/merge/shelf pattern every other tag vocabulary in the portal
already has. Carry the plan and its rulings verbatim; do not re-litigate R0–R5.

---

## Read first, in this order

1. **The project hub** (mockup · PM brief · full plan · rulings, one URL, tabs):
   https://claude.ai/code/artifact/630ebe17-e71d-4917-b49c-3d7398eb14d0 — screens 05–08 are Part B
   (the door, the drawer holding awards, the merge-or-retire remove dialog, the Tags shelf row).
   Source: `docs/projects/active/COACH_AWARDS_ONE_TAG_IDIOM_HUB.html`. **Where this prompt and the
   mockup disagree, the mockup wins** — republish the same file path if a deviation is needed and
   say so before building it, never after.
2. **`COACH_AWARDS_ONE_TAG_IDIOM_PLAN.md`** — Phase 2 (migration, counts, delete, merge with
   collision collapse), Phase 3 (the door, the generalized manager, the shelf row, retiring the old
   modal), Phase 4 (help, demo, marketing shot, walk), the Architectural Decisions section, and the
   Open Questions.
3. **`COACH_AWARDS_ONE_TAG_IDIOM_PM_BRIEF.md`** — the trade-offs in the owner's terms.
4. **The five rulings**, logged in `memory/design_decisions.md` under
   "2026-09-11 — AWARDS JOIN THE ONE TAG IDIOM…" — R1 (join the idiom), R2 (remove-in-use = merge or
   retire, never orphan/cascade), R3 (chip row stays the picker, not the search combobox), R4
   (sequencing — already satisfied, Part A shipped first), R5 (once per occasion — **already built
   in Part A**; Part B's job is only to add the DB-level partial unique indexes and make the merge's
   collapse honor the same rule).

---

## ⚠ Verify before building — Part A changed the code the plan describes, and the working copy is shared and dirty

- **Part A already exists. Read it before assuming the plan's "code facts" section is still
  current.** It added: `updateRepPlayerAward`, `getRepPlayerAwardById`, `findRepPlayerAwardCollision`
  in `lib/db.ts`; a `PATCH` on `awards/[awardId]/route.ts`; the R5 collision check on both routes'
  POST/PATCH; `lib/rep-award-occasion.ts` (`sameAwardOccasion` / `describeAwardOccasion` — the pure
  R5 predicate, already tested in `tests/unit/rep-award-occasion.test.ts`); an `editing` prop on
  `GiveAwardModal.tsx` (edit mode, no remove control per R0); Edit/Remove icons on the schedule
  drawer's award rows and the report page's history rows; the schedule's trophy badge now derives
  from `teamAwards` instead of a stale server snapshot. **Do not re-build any of this** — Part B
  extends it (the door and drawer go on the *type* picker, which is a different table).
- **The plan's `findRepPlayerAwardCollision` is a DB *query*, not a row-fetch-then-JS-filter** — if
  the merge's collision collapse needs the same rule in JS (to decide which loser awards to drop
  before re-pointing), reuse `sameAwardOccasion` from `lib/rep-award-occasion.ts` rather than
  re-deriving the comparison a third time.
- **Establish what else is already modified before touching anything**: `git status --porcelain`
  — at last check the tree carried **~126 changed files** across several concurrent sessions
  (staff access pass 2, budget import, dues adjustments, and others). **Stage explicit pathspecs
  only** when the owner says to commit; never `git add -A`. Bracket directories (`[teamId]`,
  `[orgSlug]`) need `:(literal)` pathspecs or they stage nothing.
- **One pre-existing, unrelated test failure**: `tests/unit/family-email-guard.test.ts` fails on
  `lib/assistant-invites.ts` (another session's in-progress work on invite emails, ~165 changed
  lines, not this plan's file). **Not yours. Report, do not fix.**
- **Migration numbering**: `288_staff_kind_is_a_label.sql` is the highest migration file present at
  last check. **Check `supabase/migrations/` again before naming yours** — another concurrent
  session may have already claimed 289. Dictionary update + `npm run refresh:snapshots` (dev; prod
  at release) in the same unit of work; `check:dictionary` must be green.
- **The migration carries a DATA step no schema gate can see** (plan §Phase 2, first bullet): query
  both databases for any award already doubled on `(player, type, occasion)` *before* writing the
  partial unique indexes — they cannot be created over existing collisions. Record the row count
  touched, on dev *and* on prod, in the ledger entry. Never assume zero because dev had none.

---

## What this builds (the plan's words, condensed)

- **Migration**: the dedupe data step above, then two partial unique indexes on
  `rep_player_awards` (one for event-linked, one for general-by-date+label) — the DB-level half of
  R5, which Part A's app-level check already enforces without them. A `merge_rep_team_award_types`
  RPC: proves both ids are the caller's own team and not equal, **collapses collisions first**
  (keeps the earlier-created award, carries a note only into an empty slot), re-points the rest,
  deletes the loser type. A DELETE RLS policy on `rep_team_award_types`, parity with the tags table
  — the RESTRICT FK stays as the backstop against a used type ever being hard-deleted by any path.
- **Server**: usage counts per type (all-time, team-scoped, re-asserting team_id for a shared
  type's count) on the `award-types` GET; `DELETE` on `award-types/[typeId]` (409 with the count on
  an in-use type); `POST` on a new `award-types/merge` route; a preview read (`{moved, dropped,
  collisions}`) the merge confirm dialog reads before the tap, derived from the same query the RPC
  runs — not a second hand-written one.
- **Client**: generalize `TagManagerList.tsx` with a per-library **policy** (icon on the row and in
  rename; a custom count noun; `inUseRemove: 'orphan' | 'merge-or-retire'` — awards get the second,
  with the merge confirm stating the moved/dropped preview and a Retired group with Restore). The
  behaviour must not fork between the drawer and the shelf frames — that is the property the parent
  ruling bought; a sibling `AwardManagerList` would be the fourth hand-copy this portal's tag work
  already spent effort collapsing once. `GiveAwardModal.tsx`'s Award field gains **"Manage
  awards…"** beside "+ New" (word-const, the "Manage {what the field holds}…" grammar), opening
  `TagManagerDrawer` with the awards policy. `TeamTagShelf.tsx` gains an **Awards** row. The report
  panel's "Manage award types" link and `AwardTypeManagerModal.tsx` are retired — **check every
  other consumer of the shared classes it uses first** (`.tagManagerRow/Name/Actions`,
  `.tagManageLink`, `.tagPickerRow`, `.awardEmojiPickBtn` — BudgetItemManagerModal and the awards
  panel share some of these; the css-selectors gate must stay green after the delete).
- **Words**: `faq-manage-awards` and the two other help answers naming "Manage award types" get
  rewritten for the drawer; keywords keep the old phrase for search. Marketing shot `coach-awards`
  re-photographed (an Edit icon now sits in the report table's last column, from Part A). Demo:
  verify no narration names an award door (true at plan time); no seeded moment expected — a merge
  leaves no trace.

## The one open question this build should surface, not silently resolve

**Does a brand-new team still get three starter award types (MVP / Best Hitter / Hustle Award)?**
The plan recommends **yes, seeded once at team creation** rather than the current read-time seed
(`ensureRepTeamAwardTypesSeeded`), which must be removed regardless — it re-seeds whenever a team
has zero types, which is a live trap the moment delete exists (remove all three, they silently come
back). If the owner would rather every award be one the coach made, drop the seed entirely and
sweep the help line that names the seeded three (`lib/help-content/coaches.tsx`, "give an award"
answer). **Ask before building either way** — it changes what a first-time coach sees.

---

## Blocking gate, in order

1. **No new mockup unless you deviate.** Screens 05–08 on the hub are approved. Republish the same
   file to the same URL if a deviation is needed, tagged, before building it.
2. **Read the current award code** (`lib/db.ts`'s award-type functions, both `award-types` routes,
   `GiveAwardModal.tsx`, `TagManagerList.tsx` / `TagManagerDrawer.tsx` / `TeamTagShelf.tsx`,
   `AwardTypeManagerModal.tsx`, the awards report panel) and list, in one message to the owner,
   anything the plan gets wrong about them — Part A already changed some of this once.
3. **Tests**: the migration's collapse logic (pure-function level where the SQL allows extracting
   one — reuse `sameAwardOccasion`); the policy switch renders the right dialog copy; the door and
   the no-remove-link-in-the-form rule (mirror Part A's `coach-award-edit.test.ts` pattern);
   source-scan that nothing still mounts `AwardTypeManagerModal` or strings "Manage award types" on
   the report page. `verify:changed` + `typecheck` green (excepting the pre-existing
   `assistant-invites` failure, confirmed still not yours). **`/simplify`** (the list grows a policy
   — exactly the shape that invites over-generalization) **then `/review`**.
4. **Rendered layout sweep**: `coach-schedule` (drawer over the Give modal), `coach-settings-tags`
   with `?section=tags` (a collapsed shelf is invisible to the sweep — open it), the awards report
   panel, at 361 / 390 / 768 / 1440.
5. **Owner QA walk** on the hub's QA tab (fill `QA_PARTS`, unhide the tab) — checkboxes +
   localStorage + paste-back, identities pinned (a seeded duplicate chip, a specific player's
   award), never figures. Steps: mint a duplicate on purpose, merge it into the original and read
   the confirm's preview sentence before confirming, verify the survivor is the earlier-given award
   and the note landed only if it was empty; retire and Restore a type; delete an unused type;
   attempt delete on a used type and take the "Merge instead" exit from inside that dialog; confirm
   the shelf's Awards row and the report page's missing link; the whole drawer at 390px.
6. **`/docs`** for the rewritten help answers; **check the demo** (`npm run check:demos` on dev) —
   no change expected, confirm rather than assume.
7. **Do not commit without the owner's word.** When told to, stage by pathspec in a private index
   (`GIT_INDEX_FILE`), verify the candidate tree in a throwaway worktree (typecheck + the new tests)
   before moving `dev`, then `git show --stat HEAD` and confirm only this phase's files landed.

## Out of scope — do not build on the way past

The org admin's Shared Library screen (its own manager for org-shared award types — unchanged) ·
the closed-season page and every read surface (profile, Season Wrapped, recaps, certificates —
records, untouched, resolve names through the type at render time) · moving a given award to a
different game · adopting the search combobox for the award picker (R3) · an edit history on a
given award · whether the org admin's Shared Library should get merge/remove for shared types
(a different screen, a different actor — note it, don't build it).
