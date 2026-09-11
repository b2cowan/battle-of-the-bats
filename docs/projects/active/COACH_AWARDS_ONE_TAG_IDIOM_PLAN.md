# Awards Join the One Tag Idiom — Implementation Plan

> **Status:** Part A + Part B Phases 2–3 BUILT on `dev`, uncommitted 2026-09-11 (typecheck clean; 22 + 27 new unit tests passing; `verify:changed` clean except two pre-existing unrelated failures from concurrent sessions — `lib/assistant-invites.ts` and a syntax error in `development/sessions/[sessionId]/page.tsx`, neither touched by this work). Migration 289 applied to **dev only** — declared PROD-OWED in `MANUAL_PROD_STEPS.json`; both dev and prod queried directly before writing it and found ZERO existing award doubles on either database. Owner ruled the open question: the starter award seed moves to team creation rather than being dropped. **Remaining (Phase 4, not done this session): rendered layout sweep, owner QA walk on the hub's QA tab, marketing shot `coach-awards` re-photograph** — help content (`faq-manage-awards`, the Give-window topic, the Team-settings Tags subtopic, the finished-season paragraph) already swept. Kickoff prompt: `COACH_AWARDS_ONE_TAG_IDIOM_PART_B_BUILD_PROMPT.md`.
> **Created:** 2026-09-11
> **Branch:** dev
> **PM brief:** `COACH_AWARDS_ONE_TAG_IDIOM_PM_BRIEF.md` (same folder)
> **Project hub (mockup · brief · plan · decisions, one URL):** https://claude.ai/code/artifact/630ebe17-e71d-4917-b49c-3d7398eb14d0 — source `COACH_AWARDS_ONE_TAG_IDIOM_HUB.html`
> **Parent ruling it applies:** ONE TAG IDIOM, 2026-09-01 (`memory/design_decisions.md`; plan `COACH_TAGGING_PLAN.md`, complete, committed `4485bcce`)

## Goal

Two things a coach calls "awards" are stuck, and both get unstuck the way every other tag in the
portal already works.

- **Part A — a given award** (the record: *Blake got MVP for Apr 16*). Today it can be given from
  the game drawer and never touched there again; it can be removed only from the season report page,
  and it can never be edited anywhere. After: the award row where it was given carries **Edit** and
  **Remove**; Edit opens the Give form pre-filled; the report page gains the same Edit beside its
  existing Remove.
- **Part B — the award chips** (the type library: *MVP, Best Hitter, Hustle Award, big bat*). Today
  "+ New" mints one inside the Give window, but the only manager is a separate modal reached from a
  text link on the report page, and it can only rename or retire — never delete, never merge, no
  usage counts. After: the Award field gains the idiom's door (**Manage awards…**), which opens the
  ratified **drawer** with counts and rename / merge / remove; **Remove on a used award offers merge
  or retire** (never orphans, never cascades); the **Tags shelf** under Team settings gains an
  **Awards** row; the report page's "Manage award types" link retires.

The chip row stays as the picker. What changes is what sits beside it and where managing lives.

## Owner rulings (2026-09-11 — binding; logged on the hub's Decisions tab and in `memory/design_decisions.md`)

| # | Ruling |
|---|---|
| R1 | **Award chips join the One Tag Idiom** — door in the Give window, the drawer with counts + rename/merge/remove, an Awards row on the Tags shelf; the report page's "Manage award types" link retires. Same treatment as every other tag. |
| R2 | **Remove on a used award chip offers merge or retire.** The dialog states how many times it has been given and offers *Merge instead* (records keep an award under the other name) and *Retire* (leaves the picker, stays on the record). A chip never given deletes outright. Cascade-delete and retire-only both refused. |
| R3 | **The chip row stays as the picker** — tap-a-chip, with "Manage awards…" beside "+ New". The search combobox is not adopted for awards: the library caps at 30 and seeds at 3, and a chip with an icon is the right shape for that. Budget items and test types kept their own shape under the parent ruling; this is the same precedent. |
| R4 | **One plan, both parts; Part A builds first** as a contained phase, Part B follows. |
| R0 | *(from the mockup round, 2026-09-11)* **The edit form carries no "Remove this award" link** — delete is the row's trash icon with its own confirm, one job per control, matching Manage Award Types' separate Edit/Retire icons. |
| R5 | **A player holds a given award ONCE PER OCCASION** (owner, 2026-09-11, on the merge dialog: *"if a player was given 2 awards and you merge, we don't want them to have the same award twice"*). The occasion is the GAME for a game award; for a general award it is the DATE + the occasion label. **Give and Edit refuse** a second copy with one sentence ("Blake already has MVP for this game"); **merge collapses** collisions to the award given FIRST (carrying the dropped one's note only if the survivor has none) and the confirm states the count before the tap ("4 awards become MVP. 1 is dropped — Blake would hold MVP twice for the Apr 16 game"). Same award on a different game stays legitimate ("2× MVP this season"). ⚠ The hole exists TODAY without any merge — nothing stops a coach saving MVP for the same player on the same game twice; the merge would only have been the most visible way to hit it. Tags cannot double (the link table's PK) and their merge collapses collisions by construction — this is the same rule, made explicit because awards are rows, not links. |

Standing rulings this build must honour: the parent ONE TAG IDIOM rulings (door where minting
lives, never on a filter; counts in the manager only; the drawer is the portal's ONLY working-surface
side sheet; olive = yours / blue = the club's; delete/merge confirms stay dialogs); a modal is for a
question (2026-08-26); one word everywhere a customer reads (2026-08-24); form selects are dropdowns;
44px tap floor ≤768 (rendered check); a season is live until closed and a closed season is ONE PAGE —
every instrument here is live-season-only and nothing reaches the closed-season page; help + demo
swept in the same unit of work.

## Code facts the phases build on (verified 2026-09-11)

- **Award types** live in `rep_team_award_types` (mig 182; `team_id` NULL = org-shared, mig 184).
  Unique on `(team_id, lower(btrim(name))) WHERE is_active` — a retired name can be reused; a
  duplicate *active* name 409s ("An award named X already exists"). Cap 30 active per team.
  `ensureRepTeamAwardTypesSeeded` seeds MVP / Best Hitter / Hustle Award on a team's first read.
- **Given awards** live in `rep_player_awards` — `award_type_id` is `NOT NULL … ON DELETE RESTRICT`
  (the DB backstops "never orphan an award"); `event_id` and `tournament_label` are mutually
  exclusive by construction (`createRepPlayerAward` enforces it); no `program_year_id` — season
  scoping rides the roster row (`scopeAwardsToSeasonRoster`). `updated_at` exists and is never
  written today. **No uniqueness on (player, type, occasion)** — the same award can be saved for
  the same player on the same game any number of times (R5 closes this). Contrast
  `rep_team_event_tags`' PK `(event_id, tag_id)`, which is why `merge_rep_team_tags` (mig 221)
  can collapse collisions with `INSERT … ON CONFLICT DO NOTHING` then delete the loser's links.
- **Routes today** (all hand-rolled, none on the shared factory):
  `award-types/route.ts` GET (seeds, returns own + shared incl. retired) + POST;
  `award-types/[typeId]/route.ts` PATCH only (name / emoji / isActive) — **no DELETE, no merge**;
  `awards/route.ts` GET (season-scoped, hydrated) + POST; `awards/[awardId]/route.ts` DELETE only —
  **no PATCH**. Each declares its own `resolveAwardContext` copy of the live-season coach guard
  that `lib/coach-route-context.ts:resolveLiveCoachTeamContext` already provides.
- **No usage counts exist for award types** — `getRepTeamAwardTypeLibrary` returns the rows only.
  Counts are the honesty prerequisite for the remove dialog (same as tagging Phase 0).
- **The ratified manager is one list, two frames:** `components/coaches/TagManagerList.tsx`
  (rename / merge / delete, counts, shared rows read-only, Esc peels one layer, self-fetches
  `basePath` for counts) inside `TagManagerDrawer.tsx` (chrome + scrim + focus trap) and inside
  `TeamTagShelf.tsx` (a `LIBRARIES` array: key · segment · title · noun; one row per library the
  server lets the coach READ). Its row shape is `ComboTag { id, name, teamId, count? }` — no icon,
  and its in-use delete policy is *orphan with the count*.
- **Doors** are declared once as word-consts (`GAME_TAG_MANAGE`, `MONEY_TAG_MANAGE`, …; grammar
  "Manage {what the field holds}…") and passed as `manage={…}` + `onManageChanged` (a DIRECT prop —
  the react-hooks refs lint flags a ref-reading loader inside an object member).
- **Surfaces that render awards:** the schedule drawer's "Awards given" list
  (`schedule/page.tsx` ~L2530–2561, plain text, no controls; `awardCountByEventId` trophy badge is
  set by `fetchEvents` and NOT refreshed by `fetchAwardData`, so giving an award leaves the badge
  stale until the next events fetch); `GiveAwardModal.tsx` (chip row + "+ New" inline mint, POST
  only); the report panel `history/awards/panel.tsx` (leaderboard, full history with Print +
  Remove, Give, "Manage award types" link → `AwardTypeManagerModal.tsx`, certificate links);
  READ-ONLY resolvers — player profile summary (`roster/[playerId]/route.ts` →
  `getRepPlayerAwardsSummary`), Season Wrapped (`lib/rep-season-wrapped.ts`), player season recap
  / family recap (`lib/rep-player-season-recap.ts`), certificates. All resolve name/emoji through
  the type at render time, so rename and merge propagate with no work.
- **Org admin Shared Library** (`admin/rep-teams/shared-library/page.tsx`) manages org-shared
  award types — unchanged; the drawer's "ask your club admin" sentence points there.
- **Capability:** every award read and write gates on `canManageAwards` (staff-access pass 1).
  The drawer/door/shelf row gate on the same — the shelf shows a row only when the library GET
  answers 200.
- **Help:** `lib/help-content/coaches.tsx` — the "give an award" answer (~L2564), FAQ
  `faq-manage-awards` (~L2621–2626), the "Who's earning it?" answer (~L4875, 4882) all name
  **Manage award types** on the report page and describe Retire/Restore as the only exits;
  keywords already include "manage awards", "delete award".
- **Demo:** `lib/demo-coach.ts` `MIDSEASON_AWARD_TYPES` / `MIDSEASON_AWARDS` (12U) and
  `SEASONS_END_*` (13U, closed); `check-demo-coach.mjs` asserts the invented types and that
  awards exist; the reconcile shifts `awarded_at`. `lib/sandbox-chrome.ts` narrates NO award door
  (grep: zero hits) — no narration change expected; verify at P4.
- **Marketing shot** `coach-awards` (`lib/marketing-shots.ts` ~L429) waits on `text=Give an award`
  and crops the report's history table (thead + 4 rows) — an added Edit icon in the last column
  changes the crop's pixels but not its anchor; re-photograph at P4.
- **`.tagChip` / `.tagChips` / `.tagChipActive` / `.tagChipCreate`** are GiveAwardModal's
  (tagging P2 renamed the picker's collision to `.tagPickChip`); `.tagManagerRow/Name/Actions`,
  `.tagManageLink`, `.tagPickerRow` are shared by AwardTypeManagerModal, BudgetItemManagerModal
  and the awards panel — deleting the modal must leave every other consumer (css-selectors gate).

## Phases

### Phase 1 — Part A: a given award can be fixed or taken back where it was given
*(no migration; contained; ships on its own)*

- [ ] `lib/db.ts` — `updateRepPlayerAward(id, teamId, fields: { playerId?, awardTypeId?, note?, tournamentLabel? })`: scoped by `team_id`; writes `updated_at = now()`; `tournament_label` only settable when `event_id IS NULL` (mirror the create-time exclusivity — never both); returns the mapped row or null on a scoped no-op.
- [ ] `app/api/coaches/[orgSlug]/teams/[teamId]/awards/[awardId]/route.ts` — add **PATCH**. Same live-season guard as DELETE (`canManageAwards`). Validation mirrors POST: player must be on the ACTIVE roster of the live year; award type must be in the team's library (own OR shared) and either active or *the award's current type* (editing the note on an award whose type was retired must not be refused); note ≤200; label ≤80 and only for a general award. `eventId` is NOT editable (a wrong-game award is removed and re-given, the same as a tag on the wrong event). **R5:** refuse when the new (player, type, occasion) already exists on ANOTHER award — 409 `{ error: "Blake already has MVP for this game" }` (general: "…for Jun 2" / "…for the Milton Classic"). Return `{ award }` hydrated the way GET hydrates rows (type + playerName + eventOpponent) so the client can paint without a refetch.
- [ ] `awards/route.ts` POST — **R5 on the give path too** (Phase 1, because it is the hole that exists today): same 409 sentence when the player already holds that award for that occasion. App-level check-then-act in Phase 1; the DB rule that closes the race arrives with migration 289 in Phase 2 (the route keeps its friendly sentence; the DB's 23505 maps to the same words).
- [ ] `GiveAwardModal.tsx` — surface the 409 as the form's error line (it already renders `error`); no client-side pre-check (the server sentence is the truth).
- [ ] Collapse the three hand-rolled `resolveAwardContext` / `resolveTeamCoachContext` copies in the award routes onto `resolveLiveCoachTeamContext` + the one `denyUnless(canManageAwards…)` line (the shared-file rule: one auth chain, not four). Keep GET on `resolveCoachTeamRead` (it admits a finished working season by design).
- [ ] `components/coaches/GiveAwardModal.tsx` — **edit mode** via an optional `editing?: RepPlayerAward` prop: title "Edit award"; pre-fill player / type / note (and the occasion label when it is a general award); the type chip row includes the award's current type even if retired (rendered with the retired treatment, selectable only as "keep"); "+ New" stays; primary reads **Save changes**; PATCH instead of POST; `onChanged` + `onClose` on success. **No "Remove this award" link in the footer (R0).**
- [ ] `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` — "Awards given" list (~L2544–2550): each row gains **Edit** (Pencil → opens GiveAwardModal in edit mode) and **Remove** (Trash2 → `useConfirm` "Remove this award?" → DELETE), using the `.tagManagerActions` icon-button recipe AwardTypeManagerModal already uses. Same `drawerDoors.awards` gate as the Give button. Import `Pencil`/`Trash2` from the existing lucide line.
- [ ] Same file — **the trophy badge tells the truth after a write**: derive `awardCountByEventId` from `teamAwards` on the client (one reduce) OR call `fetchEvents` after every award write; either way the schedule chip's 🏆 count matches the drawer the moment an award is given, edited or removed. (Pre-existing staleness; fixed here because this phase is the first to make it visible twice per visit.)
- [ ] `app/[orgSlug]/coaches/teams/[teamId]/history/awards/panel.tsx` — Full history rows gain **Edit** (Pencil) between Print and Remove; opens the same modal in edit mode with `eventContext` derived from the row (event-linked → fixed label; general → editable occasion).
- [ ] Unit tests: `tests/unit/coach-award-edit.test.ts` — PATCH refuses a cross-team id (scoped no-op → 404), refuses an inactive-roster player, refuses a type outside the library, ACCEPTS the award's own retired type, never sets a label on an event-linked award, writes `updated_at`; **R5:** POST and PATCH refuse a second (player, type, game) and a second (player, type, date, label) general award, ACCEPT the same award on a different game and a different award on the same game, and PATCH does not refuse an award against ITSELF; source-scan that `GiveAwardModal` has no remove control (R0). Extend `coach-history-endpoint-guard.test.ts` only if the guard's route list needs the PATCH registered (it should not — no year is read).
- [ ] `lib/help-content/coaches.tsx` — the "give an award" answer and the "Who's earning it?" answer gain one sentence each: an award can be edited or removed from the game it was given on, and from the report's history rows.
- [ ] Rendered layout check on `coach-schedule` (drawer open) at 361 / 390 / 768 — the two new icon buttons inside the drawer are under `.tagManagerActions`, which the tag-types modal already ships in a sheet; confirm the 44px floor is not violated on the row (pad the button, not the row, if it is).
- [ ] `/simplify` (the modal grows a mode; the resolver collapse touches three routes) then `/review`. Owner QA section appended to `OWNER_QA_LEDGER.md`; walk added to the hub's QA tab.

### Phase 2 — Part B, step 1: award-type counts + delete + merge on the server
*(**migration first**; the honesty prerequisite and the two verbs the drawer needs)*

- [ ] **⚠ BEFORE the migration is written: ask BOTH databases whether any award is already doubled** — `SELECT player_id, award_type_id, event_id, count(*) FROM rep_player_awards WHERE event_id IS NOT NULL GROUP BY 1,2,3 HAVING count(*) > 1` and the general-award twin on `(player_id, award_type_id, awarded_at, coalesce(tournament_label,''))`. The R5 index below cannot be created over existing doubles; the migration's dedupe step keeps the EARLIEST (`created_at`) and drops the rest, carrying a note forward only when the survivor has none. **A data-only step is invisible to every schema gate** (the mig-264 lesson) — record the row counts it touched, on dev and on prod, in this plan's ledger.
- [ ] **Migration `289_award_types_merge_delete_and_once_per_occasion.sql`** — (a) **R5 rule:** dedupe as above, then two partial unique indexes on `rep_player_awards`: `(player_id, award_type_id, event_id) WHERE event_id IS NOT NULL` and `(player_id, award_type_id, awarded_at, coalesce(tournament_label, '')) WHERE event_id IS NULL`. This is what lets the give/edit refusal be a real 23505 instead of a check-then-act race, and what makes the merge's collapse safe. (b) `merge_rep_team_award_types(p_winner uuid, p_loser uuid, p_team uuid)`: in one transaction — prove both ids are the team's own and not equal (shared types are never merged from a team route); **collapse collisions first**: for every loser award whose (player, occasion) already holds the winner, drop the LATER-created of the pair, copying its note onto the survivor when the survivor's is NULL; then re-point the remaining loser awards to the winner **WHERE team_id = p_team**; then delete the loser type. Returns `{ moved int, dropped int }` so the route can answer with the numbers. Modelled on `merge_rep_team_tags` (mig 221) — which collapses with `ON CONFLICT DO NOTHING` because its link table has a PK; awards are rows with notes, so the collapse is explicit and keeps the first-given. (c) A DELETE RLS policy on `rep_team_award_types` for coaches of the team and org admins — parity with the tags table; the routes use the service role, but the policy documents that delete is now an app-side verb. The RESTRICT FK stays: a used type cannot be hard-deleted by any path.
- [ ] A **preview** read for the merge confirm: `GET award-types/merge?winner=&loser=` (or a `dryRun` body flag on POST) answering `{ moved, dropped, collisions: [{ playerName, occasionLabel }] }` so the dialog can say *"4 awards become MVP. 1 is dropped — Blake would hold MVP twice for the Apr 16 game"* BEFORE the tap. Derived by the same query the RPC runs, not a second hand-written one (the export-shape rule: one derivation, two readers).
- [ ] Update `docs/agents/db/DATA_DICTIONARY.md` (`rep_team_award_types` gotcha 3 — "Delete is never exposed app-side" is no longer true; state the rule: delete only when unused, merge re-points and collapses, retire hides; **`rep_player_awards` gains the once-per-occasion gotcha** with the two indexes and what "occasion" means for a general award) + `npm run refresh:snapshots` (dev; prod at release). `npm run check:dictionary` green.
- [ ] `lib/db.ts` — `getRepTeamAwardTypeUsageCounts(teamId, typeIds)` (all-time, team-scoped count of `rep_player_awards` per type — **all-time, not season**, because the remove dialog's honesty is about whether ANY record depends on the type); `deleteRepTeamAwardType(id, teamId)` (scoped; returns false on no-op; the FK RESTRICT surfaces as a 23503 the route turns into the in-use sentence); `mergeRepTeamAwardTypes(winnerId, loserId, teamId)` — proves ownership of BOTH ids first, then calls the RPC (the check-then-act rule).
- [ ] `award-types/route.ts` GET — return `count` per type (own + shared; a shared type's count is re-asserted to THIS team's awards, as the tags counter does with its inner join). Manager-only by ruling; the Give picker ignores it.
- [ ] `award-types/[typeId]/route.ts` — add **DELETE**: live-season guard; refuses a shared id (404, honest); on 23503 answer `{ error: "It's been given N times — merge it into another award or retire it instead." }` with 409 so the client never has to guess.
- [ ] `award-types/merge/route.ts` — **POST** `{ winnerTypeId, loserTypeId }`, same shape and guards as `coachTagMergeRoute`. Consider putting all three award-type verbs on a descriptor in `lib/coach-tag-routes.ts` (`AWARD_TYPE_LIBRARY`) if the factory can carry `emoji` + `isActive` + the in-use policy without forking — decide during build with `/simplify`; a hand-rolled trio that mirrors the factory's guards is acceptable if the generalisation costs the factory clarity.
- [ ] **Close the re-seed trap that delete opens.** `ensureRepTeamAwardTypesSeeded` (`lib/db.ts:7052`) seeds the three starters whenever the team has ZERO types (retired included) — safe today only because nothing deletes. Once delete is real, a coach who removes all three unused starters gets them back on the next read. Fix: the read-time seed goes. Either (A, recommended) seed ONCE at team creation (`createRepTeam` and the workspace-claim path — existing teams were seeded on their first read and are unaffected), or (B) drop the seed entirely (the open question below decides B). Pin with a test: a team with zero types and one deleted starter reads an EMPTY library.
- [ ] Unit tests: merge refuses cross-team / equal / shared ids before touching the RPC; delete-in-use answers 409 with the count sentence; delete-unused 200; counts are all-time and team-scoped; no re-seed after delete (above); **R5 merge semantics** (pure-function level where possible): a loser award colliding with a winner on the same game is dropped and the EARLIER survives; the survivor takes the dropped note only when its own is NULL; a loser award on a different game moves; two general awards on the same date with different labels both survive; the preview's `{ moved, dropped }` equals what the RPC then does. ⚠ The SQL itself is typecheck-blind — a live-DB proof on the dev fixture (seed the double, merge, read back) goes in the owner walk, not in a unit test that cannot run it.

### Phase 3 — Part B, step 2: the door, the drawer, the dialog, the shelf
*(no migration)*

- [ ] `components/coaches/TagManagerList.tsx` — generalise the ONE list rather than fork a sibling: an optional per-library **policy** `{ icon?: boolean; inUseRemove: 'orphan' | 'merge-or-retire'; countNoun; itemNoun }`. With `icon`, the row shows the emoji, and Rename edits **name + icon together** (the `AwardIconPicker` mounts inside the rename row, the same way AwardTypeManagerModal does it). With `'merge-or-retire'`, the delete confirm becomes the R2 dialog: *"Remove 'X'? It's been given N times, and an award can't be taken off a player without a name. Merge it into another award and that player keeps their award under the other name. Or retire it — it leaves the picker but stays on the record."* → **Cancel · Retire · Merge instead**; count 0 → *"It hasn't been given yet, so nothing else changes."* → **Cancel · Delete**; count unknown → no claim, offer Merge/Retire. Retire is `PATCH { isActive:false }`; a **Retired** group lists under the own rows with **Restore** (the manager keeps AwardTypeManagerModal's one feature the tag list lacks). **The MERGE confirm states the consequence from the preview (R5):** *"4 awards become MVP."* — and when there are collisions, a second sentence: *"1 is dropped — Blake would hold MVP twice for the Apr 16 game."* (list up to three by name + occasion, then "and N more"); the primary reads **Merge**. The behaviour must not fork between the drawer and the shelf — same rule as the parent build.
- [ ] `components/coaches/GiveAwardModal.tsx` — the Award field gains the door: **"Manage awards…"** as a quiet link beside "+ New" (word-const `AWARD_MANAGE` following the "Manage {what the field holds}…" grammar; `TagManageConfig` shape: `teamId`, `basePath = …/award-types`, `title: 'Awards'`, `itemNoun: 'award'`, `countNoun: n => 'given N time(s)'`, `door`). Opens `TagManagerDrawer` with the awards policy; the Give form dims and goes inert behind it; closing returns focus to the chip row with the coach's selections kept; on ≤640 the drawer is the standard full-screen sheet. `onManageChanged` refetches the library (a DIRECT prop — the refs-lint pattern).
- [ ] `components/coaches/TeamTagShelf.tsx` — add an **Awards** row to `LIBRARIES` (`seg: 'award-types'`, title "Awards", noun "award", the awards policy). Row appears only when the award-types GET answers 200 (the existing gating). Counts line "N yours · M shared by your club". The section's cap sentence gains nothing (awards' 30 is stated on the route's refusal; leave the shelf's one sentence about the 50-per-kind cap as is — it names tags).
- [ ] `app/[orgSlug]/coaches/teams/[teamId]/history/awards/panel.tsx` — **retire the "Manage award types" link** (doors live where minting lives; the Give window on this page carries the door now). Delete `components/coaches/AwardTypeManagerModal.tsx` and its mount; css-selectors gate must stay green (`.tagManagerRow/Name/Actions`, `.tagManageLink`, `.tagPickerRow`, `.awardEmojiPickBtn` keep their other consumers — verify each; delete any that go orphan).
- [ ] `TagSearchCombobox` — untouched (awards do not adopt it, R3). Confirm `TagManagerDrawer` can be hosted by a component that is not the combobox (it already is by the shelf; the modal host is the new one — the z-index tier 500/510/520 already sits above the @640 overlay tier because the parent build opened it over the Add-a-bill modal).
- [ ] Colour law: own award rows carry the olive dot, shared ones the blue dot; the Give window's selected chip is already olive (tagging P2 restored it) — verify in the browser.
- [ ] Unit tests: the policy switch (orphan vs merge-or-retire) renders the right dialog copy (source-scan or RTL); `GiveAwardModal` has the door and NO remove link; the shelf lists Awards only when the GET is 200; source-scan that no file still mounts `AwardTypeManagerModal` and that the report panel has no "Manage award types" string.
- [ ] `npm run check:spelling` — "award" copy is one spelling already; the new door and dialog sentences go through the gate.
- [ ] Rendered layout sweep: `coach-schedule` (drawer over the Give modal), `coach-settings-tags` (`?section=tags`, Awards row expanded — a collapsed shelf is invisible to the sweep), the awards report panel, at 361 / 390 / 768 / 1440.
- [ ] `/simplify` (the list grows a policy — exactly the shape that invites over-generalisation) then `/review`.

### Phase 4 — Words, help, demo, marketing, walk

- [ ] `lib/help-content/coaches.tsx` — rewrite `faq-manage-awards` ("Can I rename or retire an award?" → the drawer: rename name + icon, merge duplicates, remove/retire with the rule stated in the coach's words, the Tags shelf as the second home, shared awards still the club admin's); the "give an award" answer's "open Insights → Who's earning it? and tap Manage award types" sentence → "tap **Manage awards…** under the award chips"; the Who's-earning-it answer and its finished-season paragraph ("no Manage award types") → "no way to give, edit, remove or manage awards"; the Team-settings Tags subtopic gains the Awards row. Keywords keep "manage award types" for search (prod coaches know it) and gain "merge awards", "duplicate award".
- [ ] `/docs` pass to true the article set; `npm run check:spelling` green.
- [ ] Demo: no narration names a door (verified at plan time — re-verify at build); `check:demos` green on dev. **Consider seeding one duplicate-then-merged moment?** No — a merge leaves no trace; the demo's job is the give-award beat, which is unchanged. Record the decision in the plan's ledger.
- [ ] Marketing shot `coach-awards`: re-photograph (an Edit icon now sits in the history table's last column); alt text gains "edit".
- [ ] Owner QA walk: one hub QA tab covering Parts A and B — steps pinned to identities (the seeded "MVP (2)" duplicate the fixture will carry; Blake's award on the Northgate game), never to figures; the walk asks the R2 dialog question on a used and an unused chip; a step reads one ROW of the drawer for the count noun.
- [ ] `OWNER_QA_LEDGER.md` § appended; TODO line trued to the anchored facts; this plan's status line updated; hub stage strip advanced with anchors (commit hash + date, § + date).

## Architectural decisions

- **One list, a declared policy — not a sibling component.** The parent ruling's load-bearing sentence is *"one manager, two frames; the behaviour must never fork."* Awards differ from tags in exactly three declarable ways (an icon; "given N times" as the count noun; merge-or-retire instead of orphan on remove). Declaring those on a policy keeps the drawer and the shelf rendering one component for every library, which is the property the ruling bought. A forked `AwardManagerList` would be the fourth hand-copy of a manager in this portal, the same failure mode the tag route factory was written to end. `/simplify` judges the shape at P3.
- **Remove on a used award = merge or retire, never orphan, never cascade (R2).** A tag is a label; a game with one label fewer is still a game. An award is a record key — `rep_player_awards.award_type_id` is NOT NULL + RESTRICT, and "Blake got ___" is not an award. Cascade would erase recognition players received; orphaning is impossible by schema. Budget items keep their refusal under the parent ruling for the same reason ("a filing key with history is not a label"); awards get the softer pair because retire already exists and is the honest "stop using it" answer.
- **Counts are all-time, not season.** The dialog's claim is "does anything depend on this chip" — a type retired last year with ten records must still refuse delete. The report page's "this season" scoping is a different question and stays where it is.
- **Once per occasion is a DB rule, not only a form rule (R5).** The refusal on Give/Edit could be check-then-act in the route alone, but the merge's collapse needs the invariant to be TRUE of the data, and a form check cannot promise that (two tabs, a retry, an import). The partial unique indexes make the sentence on the form the same fact the merge relies on. "Occasion" for a general award = date + label because that is the only identity a general award carries; a coach who genuinely gives the same recognition twice on one day with the same label has entered it twice.
- **A collapse keeps the FIRST-given award.** Not the one with the longer note, not the loser's — the earlier `created_at`. It is the record the coach made at the time; the later one is the duplicate by definition. The dropped note is carried only into an empty slot so nothing a coach wrote is silently lost, and nothing they wrote is silently overwritten either.
- **The chip row stays (R3).** The combobox's grammar (search → "+ Create" → the door as the last row) exists because a 50-item vocabulary is searched; a ≤30-item curated list with icons is tapped. The door adopts the idiom's *grammar* ("Manage awards…", where minting lives) in chip form: "+ New" is the explicit minting act, the door sits beside it.
- **`eventId` is not editable on a given award.** The Give form was designed around "the coach is already looking at the game"; moving an award between games is remove-and-re-give, the same gesture as a tag on the wrong event. Player, award, note and (general only) occasion are the fields a mis-tap actually gets wrong.
- **Retire survives, inside the remove dialog and as a Retired group with Restore.** It is the one thing AwardTypeManagerModal did that the tag list does not, and it is a legitimate award-specific state (a mid-season award falls out of use; its history stays). Folding it into the remove dialog is what ends the "I can't remove it from the system" dead end — the dialog says exactly why and offers it.
- **The seed moves to team creation (or goes).** `ensureRepTeamAwardTypesSeeded` conflicts in spirit with the parent ruling's "nothing is ever seeded from a fixed list" — that ruling was about *tags*, and mig 182 calls the three awards "an editable starting point," so keeping a starter set is defensible. But the seed fires on READ whenever the team has zero types, which delete turns into a trap (remove all three → they come back). So the read-time seed goes either way; whether a one-time seed at team creation replaces it is the open question below.

## Out of scope

- The org admin **Shared Library** screen (its own manager for org-shared award types) — unchanged; the drawer lists shared awards read-only with the standing sentence.
- The **closed-season page** and every READ surface (player profile, Season Wrapped, recaps, certificates) — records, untouched; they resolve names through the chip so rename/merge propagate for free. No thirtieth finished-season branch.
- Moving a given award to a **different game** (remove and re-give).
- Adopting the **search combobox** for the award picker (R3).
- A **history of edits** on a given award (`updated_at` is written; nothing reads it yet).

## Open questions

- [ ] **Keep a starter set of three awards for a NEW team?** The read-time seed goes regardless (P2). Recommendation: keep a one-time seed at team creation — a brand-new coach opening Give an award to an empty chip row and "+ New" is a colder first moment than tags' "type a word" (a chip is tapped, not typed). If the owner would rather every award be one the coach made — as with tags — the seed goes entirely and help ~L2564 ("seeded with MVP, Best Hitter, and Hustle Award") is swept with it.
- [ ] **Count noun wording in the drawer:** "given 4 times" (proposed) vs "on 4 awards". Decide on the built screen; one word-const either way.
- [ ] **Does the org admin's Shared Library get the same merge/remove verbs for shared types?** Not in this plan (a different screen, a different actor); note for that stream.

## Rollout

- **Phase 1 ships alone** (no migration) — dev, `/simplify`, `/review`, owner QA, commit.
- **Phase 2's migration 289 is prod-owed at the release that carries Phase 3** — it is rule-ADDING (two unique indexes, an RPC, a policy); `check-schema-parity` runs on master, so the migration must be applied to prod BEFORE the master build goes green (standing rule from the 09-10 release). Refresh both snapshots the day it is applied. **⚠ It also carries a DATA step (the dedupe) that no gate can see** — query prod for doubles before applying, record the count touched in the ledger, and never assume zero because dev had zero.
- Demo sandbox: no seeded change expected; `check:demos` proves both worlds still present after each phase. If a seeded duplicate-then-merged moment is ever wanted, it is a separate owner call.
- Help + marketing shot at Phase 4, in the same unit of work as the door lands (the help-docs rule).

## Ledger

| Date | Event |
|---|---|
| 2026-09-11 | Debug session found both gaps; mockup round 1 (Part A) → owner ruled R0 (no remove link in the edit form); round 2 added Part B; owner ruled R1–R4. Plan + brief + hub written. Nothing built. |
| 2026-09-11 | Owner, reading the remove dialog: *"if a player was given 2 awards and you merge, we don't want them to have the same award twice"* → **R5 once per occasion**, and it widened the plan: the double is possible TODAY on the give path (no uniqueness on the award row). Give/Edit refuse (P1, app-level; DB rule in P2), merge collapses to the first-given with a preview sentence (P2/P3), mig 289 gains two partial unique indexes + a dedupe data step that must be counted on prod. |
| 2026-09-11 | Owner ruled the open question: keep the starter award seed, moved to team creation (not dropped). Phase 2 built: mig 289 (dedupe DO block — 0 rows touched on dev AND prod, verified by direct query; two partial unique indexes; `merge_rep_team_award_types` RPC; DELETE RLS policy) applied to dev; `getRepTeamAwardTypeUsageCounts`/`deleteRepTeamAwardType`/`mergeRepTeamAwardTypes`/`previewMergeRepTeamAwardTypes` in `lib/db.ts`; award-types GET now returns `{ tags }` (not `{ awardTypes }`) with counts, matching every other tag library's wire shape; DELETE + `/merge` (GET preview, POST) routes added; read-time re-seed removed, `createRepTeam` seeds once. Phase 3 built: `TagManagerList` generalized with a `policy` prop (`icon`, `inUseRemove: 'orphan' \| 'merge-or-retire'`) rather than a forked component; `TagManagerDrawer` threads it through; `GiveAwardModal` gained the "Manage awards…" door; `TeamTagShelf` gained the Awards row; `AwardTypeManagerModal.tsx` deleted, its report-page link retired. `resolveAwardTypeMergeCollisions` extracted as a pure, unit-tested helper in `lib/rep-award-occasion.ts`, shared by the merge preview. Help content swept (`faq-manage-awards` rewritten, the Give-window topic, the Team-settings Tags subtopic, the finished-season paragraph). `check:demos` green, no seeded-moment change needed (confirmed, not assumed). Not done: rendered layout sweep, owner QA walk, marketing shot re-photograph. |
