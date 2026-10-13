# Tournament admin redesign · Stage 3 addendum: the Playoff generator, rebuilt — and the portal's reorder everywhere in the admin

> **Where it comes from.** Stage 3 (the schedule) ruled the Playoff generator "names only", so it kept the old modal
> beside the rebuilt Round-robin generator. The owner, on a screenshot of it (2026-10-12): *"have we not updated the
> formatting of the playoff generator yet?"*, then *"expand that to examine the user experience and flow of the forms …
> do we have the right options available, are we grouping them in a way that makes sense, is the sequence logical …"*.
> Walked, measured and redrawn the same day on a standalone sheet, put through `/design` (18 findings, 15 applied).
>
> **The spec is the sheet:** https://claude.ai/artifact/WKa3jbJUWC1ACSbpGFMwsU (v2 or later; source
> `.probe/pg/sheet.src.html`, built by `.probe/pg/build.cjs` to `docs/projects/archive/TOURNAMENT_PLAYOFF_GENERATOR_SHEET.html`).
> Its drawings PG1–PG7 are the visual spec (the settings drawing works: change it and its lines recompute from the real
> bracket engine), its Today part holds findings **F93–F106**, its Notes part the design review. Plan of record:
> `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` §6c **"The Playoff generator — drawn 2026-10-12"**.
>
> **⚖ The ruling (owner, 2026-10-12): "I agree with all of your recommendations, you are good to build"** — A61–A70 all
> as recommended, **plus**, in the same message: *"lets just update those 3 lists during this change given how small it
> is"* — Stage 5's three Order lists move to the portal's reorder standard (Part 1). And, earlier the same day, on the
> sheet's phone seed list: *"on mobile for this screen we can also use the hold and drag to reorder rather than the
> up/down arrows. more consistent with our portal standard"* (sheet v2).
>
> - **A61** the Round-robin generator's two-step window (settings → drafts), its frame and its When / Where parts.
> - **A62** Who plays first: Brackets (One bracket · One per pool [2+ pools] · Tiers [4+ teams]) → Teams that advance →
>   Seeding only with exactly two pools, naming them; formats in the public pages' words.
> - **A63** the division's playoff plan is **saved with the bracket**, and **a new division carries no plan** until one
>   is saved.
> - **A64** Rules keeps "Rest between a team's games" only; Max per day, Avoid back-to-back, Reduce facility moves,
>   Balance early/late and Effort retire; **new: Final played on**.
> - **A65** the fit check: nothing while it fits; when it can't, the foot's left end says so in amber; it never refuses.
> - **A66** only drafts that differ get a card (one to three), named by what they win, **no score**, the same lines on
>   every card; one draft = no card column — **and "only drafts that differ" on the Round-robin generator too** (its
>   cards keep their score).
> - **A67** the chosen draft reads by round as the schedule's rows, with Show as diagram.
> - **A68** a played game is never deleted: Replace bracket / Build from current go; saving replaces playoff games still
>   to play and asks once; a bracket with a played game keeps its shape (Who plays + How it's played held).
> - **A69** "Playoffs are set" goes **when a published division's playoff teams are filled in from the final
>   standings, once per division**, to staff and followers — never on a save.
> - **A70** "Leave times and fields for later" stays, as the first line of When.
>
> **The unchosen options are not built:** the four rules made path-aware (A64 b), a check shown in both cases (A65 b),
> three cards always (A66 c), the diagram first (A67 b), Replace bracket kept (A68 b), the announcement on publish or as
> today (A69 b, c), "leave for later" moved to How it's played (A70 b).

## Read first

- **The sheet, whole** — every drawing, every tag note (they say what is NEW / RESTYLED / UNCHANGED and why), the
  findings, the asks' "what rides on it", the Notes part (build notes, not-drawn, the formatting check, the design
  review). Then **plan §6c "The Playoff generator — drawn"** and **§6c "Stage 3 — as built"** (the defects pass and the
  sibling's build: mig 320, `slotsClearOfTakenGames`, `refusedWrite`, `tellTheReplace`).
- **The window today:** `app/[orgSlug]/admin/tournaments/schedule/PlayoffWizard.tsx` (≈2,050 lines; read it whole — the
  build is a rewrite, and its engine calls, seed labels, tier/pool bracket ids and the playoffs-only seed resolution
  are kept). Opened from `schedule/page.tsx` (`openAutoGenerator`, `showPlayoffWizard`; the window opens only with
  `playoff_generator`).
- **The sibling, as built and walked (§294):** `schedule/Generator.tsx` + `Generator.module.css` (two steps on
  `KitDialog kind="form" wide`, `levelKey`, `footerStart`, the drafts cards, the statement first, `ClubRowFrame` day
  bands, `moreRow`, the club-clash line); words `GENERATOR_WORDS` in `lib/schedule-words.ts`.
- **The engine:** `lib/playoff-bracket.ts` (`generateBracket`, `bracketRoundLabel`, `suggestDefaultTiers`,
  `validateTierRanges`, `remapTierSeed`), `lib/schedule-generator.ts` (`generateScoredSchedule`,
  `generateScoredScheduleDrafts`, `defaultSchedulePriorities`), `lib/bracket-schedule-metrics.ts`,
  `lib/schedule-conflict.ts` (`slotsClearOfTakenGames`), `lib/playoff-scheduling-guard.ts`.
- **The plan families read (A63):** `components/public/StandingsContent.tsx` (the cut line, "Top N advance"),
  `app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx` + `lib/playoff-picture.ts` (`playoffFormatLabel`, the format and
  "top N advancing"), `app/api/public/team-profile/route.ts`, `schedule/components/PlayoffBracketView.tsx`
  (`BRACKET_WORDS.caption`), `GameWindow.tsx` (seedCount), `lib/schedule-metrics.ts` (seed count). Writers today:
  `app/[orgSlug]/admin/tournaments/divisions/DivisionRecord.tsx` (`playoffDefaults`), **`lib/db.ts` ≈ line 684** (the
  insert default `{ type: 'single', crossover: 'standard', hasThirdPlace: false, teamsQualifying: 4 }`), the divisions
  route (merges `playoff_config`, keeps `coinTossResults`).
- **The announcement (A69):** `app/api/admin/games/route.ts` `announcePlayoffsIfFirstTime` (claims
  `tournaments.playoffs_published_at` on bulk-save / save-bracket), `lib/fan-notify.ts` `notifyFansForPlayoff`, and
  **`lib/db.ts` `resolveAndFillPlayoffSeeds`** (≈ line 1171: fills "Seed #N" / "Nth Pool X" once pool play is decided —
  the moment "the seeding is locked" becomes true; also re-run by the coin toss).
- **The portal's reorder standard (Part 1):** `lib/hooks/useReorderSensors.ts` (its header is the rule), the lineup
  builder's D8 (`COACH_LINEUPS_DEEP_DIVE_PLAN.md` §10 D8: the number is a 44px handle, hold 250 ms to drag, a tap opens
  Move up · Move down · Cancel), **`components/coaches/PositionProfileEditor.tsx` `BestOrderList`** (Best positions' D3,
  2026-09-29: the same, a popover at a desk and the portal's sheet on a phone, in the MENU layer). **Today's admin
  pattern to retire:** `components/admin/tournament/OrderParts.tsx` (`SortableRows`, `SortableRow`, `MoveButtons`,
  Tools → Reorder) used by `rules/RulesAdmin.tsx`, `rules/RuleSectionRecord.tsx`,
  `settings/registration-fields/page.tsx`; words `ORDER_WORDS` in `lib/tournament-settings-words.ts`.
- **Memory:** `project_tournament_playoff_generator_redraw`, `decision_reorder_is_hold_and_drag`,
  `project_tournament_admin_redesign` (Stage 3 build lessons: a sweep opener that can't find its door measures the page
  behind it; private-index commits leave the shared index holding old blobs), `feedback_build_to_approved_mockups`,
  `decision_edit_autosaves_create_asks`, `decision_drawer_layers_form_vs_menu`, `feedback_shared_component_over_shared_class`,
  `reference_code_gotchas_index` (dates: `formatStoredDate` / `formatTime` only; one period after "p.m.").

## Preconditions (check before code)

1. **The walk-13 session's schedule work is committed.** On 2026-10-12 another session held uncommitted edits in
   `schedule/Generator.tsx`, `Generator.module.css`, `page.tsx`, `components/GameWindow*`, `ScheduleDay*`,
   `ScheduleTimeline*`, `BracketColumns.tsx`, `PlayoffBracketView.tsx`, `ScheduleHealthPanel.tsx`, `useOverlapLine.tsx`,
   `schedule-admin.module.css`, `components/admin/kit/club/ClubHubKit.tsx`, the redesign's plan, hub and PM brief.
   `git status -- 'app/[orgSlug]/admin/tournaments/schedule/'` must be clean (or hold only your own work). **If it isn't,
   stop and tell the owner** — Parts 2–3 rewrite files in that tree.
2. **Migrations:** take the next free number at build time (327 was free on 2026-10-12; Club Tier may take it). Read
   `supabase/migrations/MANUAL_PROD_STEPS.json` and the release record first: mig 320 (the round robin's one-step save)
   and the Club migrations may still be dev-only; your migration's prod step goes in the same file with its order.
3. **`/marketing` confirms the words before you build them** (the list below). The placements are ruled; the words are
   `/marketing`'s.
4. **The UX summary for the owner comes first** (AGENCY_RULES), short: the window's two steps; what an organizer stops
   seeing (the six rules, Replace bracket, the health panels, the Reorder mode in three lists); what families stop
   reading (a "Top 4" nobody chose; a "bracket is set" push on a draft).
5. **Ask the owner whether another session is measuring** before any probe or sweep. One browser tester at a time.
6. **Settle P1–P3 with the owner at the start** (below), each with its recommendation.
7. **Open walks:** read the Owner QA Ledger. If §294 / §295 (hub walks 13–14, Stage 3's build) or §290–§293 (Stage 5)
   are still open, tell the owner which of their steps this build changes (any step in the Playoff generator; any
   Reorder step on Rules or Registration questions).

## Build-start questions (ask, with the recommendation)

- **P1 · Divisions that already carry the silent default plan.** Every division made through New tournament / the
  Divisions page holds "top 4, single elimination" that nobody chose, and the public standings draw a cut line from it.
  *Rec.:* in the same migration, clear the plan keys (`teamsQualifying`, `format`, `type`, `crossover`, `hasThirdPlace`,
  `grandFinalReset`, `splitConfigs`, `tierConfigs`) from divisions **with no playoff games**, on dev and prod, keeping
  `tieBreakers`, `maxRunDiffPerGame` and `coinTossResults`. A division with a bracket keeps its plan; its next save
  corrects it. *Alt.:* leave existing data; only new divisions start empty.
- **P2 · Final played on, when there is more than one bracket.** One per pool and Tiers each have their own final.
  *Rec.:* the field shows for **One bracket only**; absent for pools and tiers. *Alt.:* it applies to every bracket's
  final.
- **P3 · Who the per-division "Playoffs are set" push reaches.** *Rec.:* staff, and followers of **that division's
  teams** (a U11 parent isn't told U13's bracket is set). *Alt.:* every follower of the tournament, as today's push.

## ⚠ Running beside other work (as of 2026-10-12)

- **The schedule tree** is the walk-13 session's until Precondition 1 holds. After it: neither session edits the other's
  files; if a file you must touch has someone else's uncommitted edits, stop and tell the owner.
- **Shared with Club Tier:** `KitDialog`, `RepKit`, `ClubKit`, the sibling's When / Where (tagged "Shared candidate ·
  Club Stage 11" — the club scheduler reads them). Nothing here changes how they look in Club.
- **Shared with the coaches portal:** `useReorderSensors`, `SheetFrame`, `BestOrderList`. Part 1 may extract a shared
  reorder part; the lineup builder and Best positions must render exactly as today (their guards stay green
  untouched).
- Typecheck your commit's own tree in an isolated copy when the whole tree is red from other work; stage by explicit
  pathspecs from a private index; reset the shared index's paths after (`git reset -q -- <paths>`); commit only your
  hunks of shared docs; take the next free Ledger § after re-reading the ledger.

## What to build (ruled 2026-10-12)

### Part 0 · The server: one-step save, the plan, the announcement (own commit, migration on dev)

1. **One step (A68, F101).** A database function in the shape of mig 320's `replace_division_round_robin_games`, for a
   division's playoff games: lock the division row; refuse a foreign reference; lock the division's `is_playoff` games
   that are `status='scheduled'` and not `generator_locked`, and refuse (`schedule_changed`) unless they are **exactly**
   the ids the client says it replaces; delete those, insert the draft (with `bracket_id`, `bracket_label`,
   `bracket_code`, placeholders, `duration_minutes`, lanes); **and write the division's playoff plan in the same
   transaction** (A63: merge into `playoff_config` — `teamsQualifying`, `format`, `type`, `crossover`, `hasThirdPlace`,
   `grandFinalReset`, `splitConfigs`, `tierConfigs` — keeping `tieBreakers`, `maxRunDiffPerGame`, `coinTossResults`).
   A played game (`submitted` / `completed` / `forfeit`) is never removed; a draft that would add a game whose bracket
   code already belongs to a kept played game in the same bracket is refused (`shape_held`) — the held shape is enforced
   on the server, not only in the window. Service-role EXECUTE only; a games-route action calls it; the old
   `delete-division-playoff-games` → `bulk-save` pair is no longer the generator's path (keep `delete-playoff-games` only
   if another caller needs it — grep). The route keeps the `playoff_generator` gate and the `autoScheduled` rule.
2. **No silent plan (A63, F97).** `DivisionRecord`'s `playoffDefaults` and `lib/db.ts`'s insert default stop writing
   plan keys (tie-breakers stay). Every reader already treats an absent `teamsQualifying` as "no cut line"; prove it
   with a test per reader. P1's cleanup in the migration if ruled.
3. **The announcement (A69, F102).** Remove `announcePlayoffsIfFirstTime` from bulk-save and save-bracket. Fire it from
   `resolveAndFillPlayoffSeeds` when it fills a division's first-round seeds **for the first time** and the division is
   **published** (`schedule_visibility = 'published'`), **once per division**: a new `divisions.playoffs_announced_at`
   (timestamptz, nullable) claimed atomically NULL → now(), as `playoffs_published_at` is. Backfill it to now() for
   divisions whose tournament already announced and whose playoff games exist (no false announcement after deploy).
   Staff words name the division ("U13 Boys' playoffs are set"); the fan push goes per P3. Keep
   `tournaments.playoffs_published_at` (other readers?) — grep; if nothing else reads it after this, say so in the
   dictionary rather than dropping it here. **Schema = dictionary, same unit of work:** `DATA_DICTIONARY.md` (the new
   column, the function, `playoff_config`'s keys and that they are written by the generator only), `npm run
   refresh:snapshots`, MANUAL_PROD_STEPS (prod BEFORE the code).
4. **Tests:** the function's refusals (foreign, schedule_changed, shape_held) and its one transaction (a rolled-back SQL
   proof like `.probe/s3d/atomicity.sql`); the plan merge keeps the three kept keys; the announcement fires once per
   published division, never on a save, never for an unpublished division.

### Part 1 · The portal's reorder standard in the admin (own commit; the owner's 2026-10-12 note)

One reorder part for the admin, on the portal's standard — `useReorderSensors` (mouse after 6px, a finger after a
250 ms hold, the keyboard with Space), **a handle that is the row's number where the list has one, else its grip, 44px
at touch widths**, and **a tap on the handle opens Move up · Move down · Cancel** — a popover at a desk, the portal's
sheet on a phone in the MENU layer (`BestOrderList` is the model; extract a shared component if that keeps one copy,
`feedback_shared_component_over_shared_class`). **No Reorder mode, no Done, no arrow buttons on every row, no hint
line.** Each move saves, as today.

- Move **Rules' sections, a section's links and files (`RuleSectionRecord`), and Registration questions** onto it.
  Retire `MoveButtons`, Tools → Reorder and its note (`ORDER_WORDS.reorder`, `reorderNote`, the Done swap) — grep for
  every user first, and for help articles and guard tests that name "Reorder".
- The lineup builder and Best positions render and behave exactly as today.
- The Playoff generator's seed list (Part 2) uses this part.

### Part 2 · The Playoff generator window (PG1–PG7), on the sibling's frame

Build it to the sheet. The points the drawings can't show, and the rules behind them:

- **Frame:** `KitDialog kind="form" wide`, title "Playoff generator", the caption "<event> · step 1 of 2 · settings" /
  "· step 2 of 2 · drafts for <division>", `levelKey` per step, `footerStart` = the division's note (or the fit warning),
  the lime alone at the foot's right; full screen with ← on a phone. One lime per step.
- **When / Where:** reuse the sibling's parts — extract them so both windows render one copy (and Club Stage 11 can read
  it), the Round-robin generator unchanged on screen (its guards green). Day in the house format (F105), a one-diamond
  venue read once (F106), other divisions' kept games named in the taken line and left free (F69, already in both
  engines), temporary facilities when none chosen.
- **Who plays:** the shapes as drawn; the seeding sentence is the engine's real first-round pairing (seed i meets P+1−i;
  crossing pools interleaves the pools' places as `buildSeedLabels` does) — a pure, tested function; Seeding absent
  unless exactly two pools; Teams that advance steps by 2 while crossing; One per pool absent under 2 pools; Tiers
  absent under 4 teams; tiers keep today's contiguity and validation; **a playoffs-only event's seed list** on Part 1,
  with By seed number and Shuffle ("Protect top N" and "BYE R1" retire; "Skips round 1").
- **How it's played:** Format in `playoffFormatLabel`'s words (one spelling, the public Playoffs page's); "Play a
  3rd-place game" only when every bracket has 4+ teams; "Play a second final if it's needed" for double; tiers as a block
  per tier; **the "what you get" line** from `generateBracket` (games, rounds, the rounds in words) — pure, tested.
- **Rules:** "Rest between a team's games" (the dependency rest). The retired rules stop being passed as choices; pass
  the engine settings that make them inert for a bracket (`balanceTimeSlots` false — it was the one that still nudged
  slots), candidate count fixed.
- **Final played on (A64, P2):** restrict the final's matchup (FIN; GF and GF2 for double) to the chosen field in both
  draft generators' slot assignment; no slot there → the error band says so in the sibling's words.
- **The fit check (A65):** a pure function — the bracket's levels laid into the chosen day windows in order (a level's
  games run in waves over the chosen fields with the turnover between, a rest between levels, overnight counts as rest),
  "about"; amber foot line only when it can't fit, with single elimination's span when that would fit. Tested on the
  sheet's two cases (U11 top 4 single: fits; U13 all 8 double: 16 h 30 min against 11 h 30 min).
- **Drafts (A66, A67):** `generateScoredScheduleDrafts`; a draft "differs" when its measures differ — shortest rest,
  rest before the final, when the last game ends, most games in a day for one team (from
  `buildBracketScheduleMetrics` + the final's slot); one to three cards named by what they win (Most rest · Finishes
  earliest · Most rest before the final · Fewest games in a day), the engine's best first, the same lines in the same
  order, the clash line ("No clashes with …") and the club-booking amber as the sibling's; no score; "Only N drafts
  differ: every other draft it tried matched one of these."; **one draft → no card column**, its measures as one line
  over the games. The statement first: adds / replaces / keeps, then the plan line ("It also saves U11 Girls' playoff
  plan, which its standings and Playoffs page show: top 4 advance · single elimination"). Games banded by round
  (`slotWords`, `bracketWhen`), Show as diagram (the Bracket view's read-only columns, white ground). Phone: "See its N
  games". Leave for later → one bracket, rows "No time yet", no cards.
- **Saving (A68):** "Save this bracket" / "Save and replace N games" → "Replace N games still to play?" asked once
  (published / unpublished words, the sibling's); Part 0's function; a refused save keeps the draft on screen with the
  reason (`DRAFT_SAVE_FAILED`); once seeds are filled, a replaced game is told as a move (`tellTheReplace`'s rule).
  **Held shape:** a division with a played playoff game opens with Who plays + How it's played as one held sentence and
  "To change a matchup, use Edit bracket"; the generator re-places the games still to play.
- **Removed (F103, F104):** the free-plan lock and its sentence, the `initialConfig` / "Start from standings" plumbing,
  "Missing Information · Continue Anyway", "Regeneration Scope", the health panels and both info banners; Generate drafts
  waits for the window's reads. Retire the old window's styles in `schedule-admin.module.css` that nothing else uses
  (grep each class).
- **The layout sweep:** `scripts/layout-screens.mjs` `admin-t-schedule-playoff-wizard` opens with `'.modal'` — re-point it
  to the kit window and make it FAIL if the door is missing (Stage 3's lesson); add a drafts-step id if the sibling has
  one.

### Part 3 · The Round-robin generator: only drafts that differ (A66)

Its cards keep their score; drafts whose measures are all equal collapse to one card; one draft → no card column and its
measures as one line, as the playoff window. "Three more drafts" shows only while three cards show. Its walked look
otherwise unchanged.

## The words for `/marketing` (Precondition 3)

**New:** Who plays · Brackets · One bracket · One per pool · Tiers (Gold, Silver …) · Teams that advance · "Top 4 of 6" /
"All 6" · Seeding · Pools cross over · By the standings · the seeding sentence ("1st Pool Red plays 2nd Pool Blue and 1st
Pool Blue plays 2nd Pool Red. The places come from U11 Girls' round-robin standings and its tie-breakers.") · From Pool
<name> · Tier name · Seeds · Add a tier · the tiers' coverage sentence · How it's played · Format · the four formats'
sentences · Play a 3rd-place game (in each pool) · Play a second final if it's needed + its caption · the "what you get"
line · Leave times and fields for later + caption · "U11 Girls' round robin ends Sat, Oct 17, 9:30 p.m. Its playoff
games start after that." · Final played on · Any of these · its hint · Rest between a team's games' playoff hint · the
fit warning · the card names and measure lines · "Only N drafts differ …" · the one-draft line · the plan line · the held
sentence · Seeds, in the order you set · By seed number · Shuffle · Skips round 1 · the per-division "Playoffs are set"
staff and fan words.

**Kept (the sibling's, one spelling):** When · Where · Rules · Day · From · Until · Add a day · Game length · Turnover ·
Generate drafts · Back to settings · Save this bracket · Replace N games still to play? · Show as diagram · Move up ·
Move down · Cancel.

**Retiring:** Crossover Rules and its four options · Bracket Format's option labels · Teams advancing · Include 3rd
Place / Consolidation Game · Play if-necessary grand final (reset) · Regeneration Scope · Replace bracket · Build from
current · Playoff Timing · Auto-schedule dates & times · Bracket structure only · Playoff Dates · Add Date · Earliest
playoff start · Game Duration (min) · Turnover Time (min) · Scheduling Priorities · Best of N · Advanced Settings ·
Limits · Max / day · Min rest · Preferences · Effort · Fast / Balanced / Deep · Avoid back-to-back · Reduce facility
moves · Balance early/late · Available Facilities · Generate a draft (panel) · Game Slots & Scheduling · No Matches
Generated · Playoff Draft Health · both info banners · Missing Information · Replace Existing Bracket? · Build From
Current Bracket? · Delete and replace · Randomize · Protect top · By Seed # · BYE R1 · Split into tiers / Single bracket ·
**Reorder · the reorder note · Done (the three Stage 5 lists)** · the old "Playoffs are set … seeding is locked" first-save
words. Grep help (`lib/help-content/tournaments.tsx` — the playoff articles say "crossover", "how many teams qualify",
"Generate a draft"), the demo narration and the pricing / plan copy for each.

## Don't

- Change the Bracket view, the coin toss, Build bracket or Edit bracket (names only, Stage 3).
- Make the four retired rules path-aware, add reseeding after each round, or move the tie-breakers off the division.
- Show "Final played on" for pools or tiers unless P2 rules it.
- Leave a Reorder mode, a row of arrows, or a "hold to move" hint anywhere in the admin.
- Change how the lineup builder or Best positions look or behave.
- Touch the free tier's locks (the free tournament tier review owns them).

## Verification

- `npm run verify:changed`, `npm run typecheck` (`npx next typegen` first), the unit suite for the touched areas.
- **Pure-function tests:** seeding pairs (2, 3, 4, 6, 8 teams; crossing and not); the "what you get" line for every
  format at 2–8 teams against `generateBracket`; the fit function (the two sheet cases; a two-day window; fields as
  waves); draft distinctness and naming (U11: two cards; U13 around U11's saved games: one); the plan payload; the held
  shape; the announcement's once-per-published-division rule.
- **Guards:** the Stage 3 defects guard (it names the Playoff generator) and the Stage 5 Order guards updated, never
  deleted; a new guard that no admin file renders `MoveButtons` / a Reorder mode; the lineup builder's and Best
  positions' guards untouched and green.
- **Probes** (in `.probe/`, read-only — every write fulfilled locally, as `.probe/pg/before.mjs`; the walk event
  "UAT Stage 3 Walk" on uat-plus-org, `scripts/seed-stage3-walk-fixture.mjs` re-dates it): Generate drafts always on
  screen at 1440 × 900 and 390 × 844; one lime per step; no control under 34px at a desk, 44 at touch widths; the fit
  line on U13 all-8 double; U11's draft with real diamonds only; the seed list's hold-to-drag and tap menu on a phone
  (touch emulation); the three Stage 5 lists the same. Re-measure against the sheet and report gaps.
- **The layout sweep:** `--only=` the playoff ids and the three Stage 5 screens, 390 / 360 / 768 / 1440, both themes.

## Close-out

- **Offer `/simplify`, then `/review`** (high-risk: a migration, a transaction, a notification, shared parts) before
  the commits.
- **Commit only when the owner says**, on `dev`, from a private index: Part 0 (server + migration) · Part 1 (reorder) ·
  Parts 2–3 (the windows) · records. Migration on dev only; prod BEFORE the code at the promote (MANUAL_PROD_STEPS).
- **Records:** plan §6c "The Playoff generator — as built"; PM brief; TODO; Owner QA Ledger walk(s); an in-repo
  `memory/design_decisions.md` check that the 2026-10-12 entries match what was built; the sheet's banner "Built
  `<hash>`"; **the sheet folded into the hub as a Stage 3 addendum** (as the Divisions step was in hub v48) — read the
  live hub copy whole before publishing; another session may be publishing it.
- **Help (`/docs`):** the playoff articles (the window's sections and words, "Teams that advance", leaving times for
  later, the fit warning, when the standings' cut line appears, when "Playoffs are set" goes) and the Rules /
  Registration questions reorder. Check the file for another session's edits first.
- **Demos (`/demos`):** grep the tour narration for the retired words; say what you found.
- **The owner's walk:** one purpose per walk — "playoffs, at a desk and on a phone" (generate, the fit warning, the
  drafts, save, replace, a held bracket, a playoffs-only seed list) and "reorder by hold and drag" (Rules' sections,
  links, Registration questions, the seed list) — each its own Ledger §, the next free ones; every write's email check
  stated (dev email is live: no step may publish a division with real coaches' addresses).
