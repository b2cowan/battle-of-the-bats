# Public tournament pages — Stage 4, Standings + Playoffs (build prompt, four sessions, for Codex)

> Written 2026-10-29, while the Stage 3 walk (§426) was still owed. **Start only after the owner says the Stage 3 walk
> is done** (or says to go ahead anyway). Stage 4 of `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` (§9; row ~276). **Ruled
> already:** Ask 15 (the bracket moves to Playoffs; Standings ends with a door to it), D5 (Team left and PTS right
> pinned), Ask 17 (the results line stays on Standings and Playoffs), Ask 8 (one set of state words), D1 (a held-back
> division appears nowhere), the installed-app-only rulings for following and alerts. Stage 1 (frame), Stage 2 (Overview)
> and Stage 3 (Schedule, a game's page) are built; this stage **reuses the parts they built**.
> **Everything here is built behind the preview switch**: with it off, customers and the public demo see today's Standings
> and Playoffs, unchanged. Stage 8 turns it on for everyone, once.
> You are Codex. Read `AGENTS.md` and `AGENCY_RULES.md` first (this repo's Next.js is not the one you know; one shared
> branch `dev`; stage explicit paths only; commit only when the owner says). `/simplify` and `/review` are Claude Code
> commands you do not have: Part 4 says what to do instead.

## What Stage 4 is (one paragraph, so every part shares it)

**Standings** becomes: the division, one quiet line of counts ("Top 4 advance · 8 games final · 1 left to play"; a count
of zero is absent), **the table first**, with **Team pinned left and PTS pinned right** and the middle columns scrolling
between them (D5; today only Team is pinned), **the legend, the column meanings and the tie-breaker order behind one tap**
("How the table is ranked"), and, instead of the bracket, **a door to Playoffs** ("The playoff bracket · Top 4 advance ·
the championship is live now"). **Playoffs** becomes: **the next game first** (a Live now card while it is played, "Up
next" with time, field and Directions before it), then **the bracket**, moved here from Standings, then **"How seeding
works" behind one tap** (the format line, the top seed / best offence / stingiest defence / best differential panels,
and the seed list with its playoff cut line). **The bracket is on exactly one page**: with the switch on it is on
Playoffs and not on Standings; with it off, today's pages. Also in this stage: **the Schedule's door is re-pointed** to
Playoffs in the same edit that lands the bracket there. The drawings are in the hub (`PUBLIC_TOURNAMENT_SITE_REVIEW_HUB.html`,
185 KB: **never read it whole**), frames `#f-stand` (about lines 836–884, with its "What changed" list) and `#f-play`
(about 885–927). Slice them with a short node script; they are HTML and CSS, so sizes, colours and words are readable.
Plan §5's "Every page" bullets (lines ~186–210) hold the words.

## How this runs: four sessions, a `/clear` between them

| Part | Covers | Ends with |
|---|---|---|
| **1** | The owner's questions (below) and a small drawing of the states the hub skipped; **the switch plumbing** for both pages and the admin preview decision; shared pieces extracted (legend, next-game rule); the guard test | Committed; nothing visible with the switch on |
| **2** | **Standings**, phone: the counts line, the table with Team + PTS pinned, the tap-open ranking explainer, the door to Playoffs (pointing at a Playoffs that still has no bracket is not allowed: see "never on both or neither") | Committed; owner check at 360/390 (not the walk) |
| **3** | **Playoffs**, phone: next game first, the bracket moved here, seeding behind a tap; **the Schedule door re-pointed in the same commit**; the desk for both; live refresh; preview and demo | Committed |
| **4** | Cleanup and review of Stage 4's diff, the QA walk (next free §: grep `OWNER_QA_LEDGER.md`, §426 is the Stage 3 walk), the records | Committed, walk written and published |

**Parts 2 and 3 share one rule: the bracket is never on both pages and never on neither.** Part 2 may build Standings
without the door's destination being live only if the door is **absent** until Part 3 lands the bracket on Playoffs; the
simplest safe order is to build Standings' new body in Part 2 **keeping the bracket on it**, and let Part 3 move it
(remove it from the new Standings body, add it to the new Playoffs body, add the door, re-point the Schedule door) in
**one commit**. Decide this in Part 1 and say which. Either way a guard test holds "switch on: exactly one of the two
frame-on bodies renders the bracket; switch off: today's pages".

At the end of each part, tell the owner in one line that it is a good place to `/clear`, and where the next part starts.

**Token discipline (owner, unchanged).** Nearly all of a session's cost is re-reading its own history.
- Read this prompt, plan §5 ("Every page" bullets) and §10a, and nothing else of the plan unless a step names it.
- **Build to the drawing, but the Stage 1 band, tab row, footer and tokens, and Stage 2/3's shared parts, already exist:
  reuse them, don't redraw them.**
- Delegate wide searches if you have helpers; a summary is a lead, so open the cited lines before you rely on it. (The
  census below was spot-checked on 2026-10-29; line numbers will have moved.)
- Prefer `npm run verify:changed`; `npm run typecheck` once per part (`NODE_OPTIONS=--max-old-space-size=8192` if the
  default heap runs out). `check:layout --changed` only on the screens a part touched, **with the switch on**. Leave the
  dev server running unless AGENTS.md's restart rule applies; new files mean a restart (stop it, then clear `.next`, then
  `npm run dev` with network access) before handing the owner a check.

**Every part:** work on `dev`; stage explicit paths only (other sessions share this working copy); present the
product-owner summary **before** writing code (AGENCY_RULES: plain language, what the family sees, role differences);
write to the owner as to a product owner, not an engineer. For a partial commit out of a file another session has also
edited, build the blob from HEAD plus your own lines and diff it against HEAD before committing. **The owner does the
browser testing**; you verify with tests, the type check and the layout check.

### Rulings this stage stands on (do not re-open them; cite them)
- **Ask 15 / D5 (plan):** the bracket moves to Playoffs; Standings ends with a door to it; the table pins Team (left) and
  PTS (right). Nothing is deleted: "Recent Scores" at Standings' foot is replaced by the Overview's Latest results and the
  Schedule; the result pills and "Top N to playoffs" become the one counts line; the Team cell's marks (trophy, rank
  arrows, playoff-spot tick, pending clock) are kept, quieter.
- **Ask 17:** the results line stays on Standings and Playoffs (their layout keeps it; do not touch the list in
  `lib/public-ticker-pages.ts` except to prove the test still passes).
- **Ask 8 / D2 / D4:** the moment names are **Live now** and **Up next** only; "No score yet", never a lone dash or 0–0.
  **D1:** a held-back division's games, teams, seeds and bracket appear nowhere (server-side gate; the Playoffs page has
  a test that pins the published-games filter).
- **Following is installed-app only** (2026-10-28) and **My games / calendar are app-only** (Stage 3). A stored follow is
  not deleted. See open question 3 for the followed row's mark.
- **Slot words:** "Semifinal 1 winner" (fan wording) on every new page; the old pages keep theirs until Stage 8.
- **Stage 1's frame is the frame:** light ground, club type, 12 px minimum, tabular figures, 4.5:1 text and 3:1 edges,
  44 px taps. `check:contrast`, `check:text-contrast` and `check:public-tokens` run in `verify:changed`.
- **Nothing here reaches a customer before Stage 8.** With the switch off the old pages are byte-for-byte what they were.
- **One spelling:** grep for the other spelling before you write a word with a variant (AGENCY_RULES). See question 5.

## What the code does today (a 2026-10-29 census; re-check before you rely on a line)

- **Standings:** `app/[orgSlug]/[tournamentSlug]/standings/page.tsx` (12 lines, server) → `StandingsPageClient.tsx` (13
  lines, client, no `frameOn` prop) → `components/public/StandingsContent.tsx` (858 lines, client; fetches its own data
  unless `initialData` is given; live-refreshes while the event is in progress). CSS: **one module under the org route**,
  `app/[orgSlug]/standings/standings.module.css` (1,621 lines); Stage 1's frame rules sit at its foot, all keyed
  `:global([data-public-frame='light'])` (a Stage 1 guard enforces this; a comment there says pinning is Stage 4).
- **Section order today:** header ("Results & Standings"), year selector (not in preview), division select, `MyTeamCard`
  strip, result chips (N final / pending / remaining), empty state, then the stack: the bracket on top **when
  `bracketOnTop = hasPlayoffGames && (isCompletedTournament || playoffsUnderway)`** (about line 222), else the
  "Top N advance" note; one summary section per pool with its table and a **footer holding the always-visible `STAT_LEGEND`
  `<dl>` (constant at about line 66), the tie-breaker line, the run-differential-cap note and the pending-scores note**;
  the **collapsed bracket `<details>`** after the tables during pool play; "No standings yet"; "Recent scores".
- **Columns:** two sets in one DOM, toggled `mobileOnly` / `desktopOnly`. Phone: Team, REC, RD, PTS, then RF, RA behind the
  swipe. Desktop: Team, W, L, T, RF, RA, RD, PTS. RD shows the true value with a capped value in brackets when a cap is
  on. **Only Team is sticky** (`.stickyCol`, about css line 728); `.ptsCol` is not (its one rule is the followed-row
  background); row-state backgrounds (`.topRow`, `.followedTeamRow`) depend on `.stickyCol`, so a pinned PTS needs the
  same. **The drawing's phone order is Team, REC, RD, RF, RA, PTS** (PTS last, so it can pin at the right edge).
- **Playoffs:** `app/[orgSlug]/[tournamentSlug]/playoffs/page.tsx` (316 lines), a **server-only** page (`force-dynamic`,
  **no client component, no live refresh, no frame branch**). It loads games, teams, divisions and venues, builds
  `buildPlayoffPicture` (`lib/playoff-picture.ts`, via `getPublicStandingsByDivision`) and renders a hero ("The Bracket Is
  Set"), per-division narrative, callouts (top seed, best offense, stingiest defense), a seed list with a cut line, and
  matchup + Pending cards, with "Full Bracket" / "See the full bracket" links **to Standings** and a "Playoff schedule"
  link. CSS `components/public/PlayoffPicture.module.css` (536 lines; it imports the LIVE badge from
  `schedule.module.css`, which the Playoffs page and a team's page share: do not restyle it globally). **Verified: it has
  no bracket drawing** (no `TieredBracket`).
- **The bracket component:** `components/bracket/TieredBracket.tsx` (93 lines, client) wrapping `LogicSyncBracket.tsx`
  (1,013 lines). Importers: `StandingsContent.tsx` and the **old** `ScheduleContent.tsx` (still the switch-off page). Props:
  `games, teams, pools, tournamentId, orgSlug, tournamentSlug, venues, highlightTeamId, requireFinalization`.
  **`TieredBracket` is a client component; the Playoffs page is server-only, so landing the bracket there needs a client
  body or a client island fed the data.** Standings' bracket section carries `data-sandbox-tour="playoff-bracket"`,
  which the demo tour rings (see "The demo").
- **Gates:** the layout's `hasPublicBracket` = `isPublicBracketVisible(tournament)` AND (a division has a saved playoff
  plan OR a published playoff game exists) (`lib/public-pages.ts`, `lib/tournament-page-tabs.ts` `PLAYOFFS_TAB`, placed
  after Standings; pinned by `tests/unit/public-bracket-visibility.test.ts`). **A bracket-only event hides Standings by
  format yet still has Playoffs; an event with Standings but no bracket has no Playoffs tab.** So a door from Standings
  must appear only where the Playoffs tab does, and the Schedule's door must be gated on the Playoffs tab, not Standings.
- **The Schedule door (Stage 3):** `lib/public-schedule.ts` `SCHEDULE_BRACKET_DOOR = { path: 'standings', label: 'The
  bracket', sub: 'On the Standings tab' }` (about line 10, with a comment saying Stage 4 changes destination and
  description together). Its only reader is `components/public/PublicSchedule.tsx` (about line 267), **gated on
  `isPublicPageEnabled(tournament, 'standings')`: that gate must change with the destination** (a bracket-only event
  would otherwise lose the door). The only test pin is the layout screen `pubt-schedule-playoffs` (waits for a link
  named "The bracket"; keep the label).
- **The switch:** `lib/public-frame.ts` and `lib/public-frame-server.ts` (`isPublicFrameOn()`, server). **Neither page has a
  frame-on branch.** The Schedule is the model: server `schedule/page.tsx` awaits `isPublicFrameOn()` and passes `frameOn`
  to `SchedulePageClient`, which returns `<PublicSchedule/>` or `<ScheduleContent/>`; the admin preview does the same; the
  Stage 3 guard (`tests/unit/public-tournament-stage3-guard.test.ts`) asserts those patterns by regex, and the Stage 2
  guard holds a `FRAME_ONLY_USERS` list of files allowed to reference the frame.
- **The admin preview:** `app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx`. `VALID_SECTIONS`
  is `news, schedule, standings, teams, rules, register` (**no `playoffs`**), and `TournamentTopTabs` deliberately sets
  `hasBracket = false` whenever `basePath` is set (preview). The preview's Standings passes `games: []` and `teams: []`,
  so **today's preview Standings never shows a bracket**.
- **Reusable parts (all `components/public`):** `PublicGameRow` / `PublicGameRows`, `PublicLiveCard`, `PublicSectionHead`,
  `PublicDoorRow`, `PublicDisclosure` (the real tap-open row: `aria-expanded`, 44 px, closed on a phone), `DirectionsLink`,
  `PublicTournamentState` (empty-state card); view builders in `lib/public-game-row.ts` (`gameRowView`, `liveCardView`,
  `gameSideNames`, `fanPlaceholder`); `gameDirections` and `publicGameState` for Directions and live/upcoming; shared CSS
  `PublicParts.module.css`, `PublicDisclosure.module.css`, `PublicSchedule.module.css`.
- **Next-game data:** `lib/game-status.ts` `selectTeamGames(games, teamId, today, now)` returns `{ live, next, lastResult }`
  for one team (`StandingsContent` has a duplicate of this logic at about lines 265–295 with a TODO). For "the tournament's
  next playoff game", `scheduleGames({ stage: 'playoff' })` in `lib/public-schedule.ts` gives sorted playoff games and
  `publicGameState` / `gameStartMs` say live or upcoming; `buildPlayoffPicture` already carries per-division `matchups` and
  `pending` with date, time and venue label.
- **Tie-breaker, legend and seeding words:** `lib/tie-breakers.ts` (`BREAKER_LABELS` ~29, `BREAKER_DESCRIPTIONS` ~38,
  `resolveTieBreakers(playoffConfig, tournament.settings)` ~60, `DEFAULT_TIE_BREAKERS`); the legend is the inline
  `STAT_LEGEND` constant in `StandingsContent` (not shared); `advanceCaption` is computed inline (~230). **"How seeding
  works" has no component or constant**: the drawing's content is today's per-division `narrative` and the callout panels
  from `buildPlayoffPicture`, behind a tap. Words must not change (the drawing says so), only move.
- **Tests that touch these pages (do not break):** `public-tournament-stage1-frame-guard.test.ts` (every frame rule in the
  Standings, Playoffs and bracket sheets keyed to the marker), `public-games-guard.test.ts` (Playoffs must use the
  published-games filter), `playoff-plan.test.ts` (it greps `playoffs/page.tsx` and `StandingsContent.tsx` for the
  `teamsQualifying` / `advanceCaption` / `gamesStarted` lines: **do not reword those lines in the old bodies**; grep it
  before you touch either file), `tournament-stage3-part7-guard.test.ts`, `public-bracket-visibility.test.ts`,
  `tie-breakers.test.ts`, `playoff-bracket.test.ts`, and the Stage 2/3 guards. Layout screens in
  `scripts/layout-screens.mjs` (about lines 1860–1930): `pubt-standings-own` (a Metro Sports standings page),
  `pubt-playoffs-pale` (Lakeshore's playoffs), `pubt-schedule-playoffs`, `pubt-schedule-live`.

---

## Part 1 · The owner's questions, the states the hub skipped, the plumbing

0. **Ask the owner (one `AskUserQuestion`, recommendations first; these are the real open ones):**
   1. **One division at a time, or all divisions, on these two pages.** The drawings show a division dropdown on each. The
      Schedule defaults to "All divisions". A Playoffs page with every division's bracket stacked is very long; a table
      stack for every division on Standings already is today. *Recommended:* **one division at a time on both, defaulting
      to the family's remembered pick (the same remembered pick the Schedule uses), else the first division**, with the
      "next game first" being that division's. Alternative: "All divisions" first, as on the Schedule.
   2. **Order of work for the bracket's move.** *Recommended:* Part 2 builds Standings with the bracket still on it; Part 3
      moves it, adds the door and re-points the Schedule door in one commit, so no committed state has the bracket on
      neither page. Alternative: do Playoffs first (the bracket lands there while Standings still shows it too, which
      violates "one page" for a commit).
   3. **A followed team's mark on the Standings row** (the drawing gives it a left edge in the organizer's colour). Following
      is installed-app only. *Recommended:* show the mark **only inside the installed app**, as My games is; in a browser a
      stored follow stays on the device but the page does not use it. Alternatives: show it wherever a follow is stored;
      drop it.
   4. **The Playoffs page's Share button** (today's hero has `SharePageButton`; the drawing does not show it).
      *Recommended:* keep it as a quiet symbol in the page header row. Alternative: drop it.
   5. **"offence" vs "offense".** The drawing says "best offence / stingiest defence"; today's page says "Best offense /
      Stingiest defense". `defence` is a permanent exception in the spelling gate; `offence` is the matching Canadian
      form, but the old page's `offense` would then disagree on a customer-visible word. *Recommended:* the new pages
      say **offence** and **defence**, and the old Playoffs body is **not touched** (it keeps `offense` until Stage 8
      retires it; tell the owner this is a known, temporary mismatch between the two switch states, not a drift). Check
      `npm run check:spelling` and grep both spellings across `lib/` and `components/public/` before deciding.
   Also tell the owner (do not ask): the **desk** layouts for both pages have no drawing and are derived from the phone
   cards in the Overview's two columns from 1,024 px (shown for his yes at Part 3); and that the admin preview gets no
   Playoffs page (see step 3).
1. **Draw the states the hub skipped, as one small page, before building them** (CLAUDE.md: mockups are Claude Artifacts,
   whole-screen, true size; if you cannot publish an Artifact, write the page as HTML in `docs/projects/active/` and tell
   the owner so he can have it published and run through `/design`). The drawings are silent on:
   - **Playoffs with nothing set** ("The bracket isn't set yet"), **unavailable** ("Playoff Picture unavailable": the
     bracket page is hidden for this format) and **a held-back division** (D1).
   - **The next-game block's states**: a Live now card with no score yet, a game with TBD teams ("Semifinal 1 winner"),
     the last game played and a champion crowned (what replaces "next game"? *Recommended:* a "Champion" line first, as the
     Overview does after the event).
   - **A big bracket** (8+ teams): the shipped zoom and full-screen controls stay; show the closed state and what a phone
     sees first.
   - **Standings with two pools**, a **no-playoffs event** (no door, no "Top N advance"), a **bracket-only event**, and the
     **empty "No standings yet"** state restyled.
   - **The door row on Standings**: its sub-line in each state ("Top 4 advance · the championship is live now",
     "Top 4 advance · starts Sat", none when the bracket is not set).
   Present it, get the owner's yes, then build Part 2 to it.
2. **The switch plumbing, for both pages.** Standings: `standings/page.tsx` (server) asks `isPublicFrameOn()` and passes
   `frameOn` to `StandingsPageClient`, which renders the new body (name it, e.g. `PublicStandings`) or today's
   `StandingsContent`, **left byte-for-byte**. Playoffs: it is a server page, so the branch is an `if (frameOn)` inside it,
   handing a new client body (e.g. `PublicPlayoffs`) the data it needs (see Part 3), with today's JSX untouched below.
   Add the **guard test** now (switch off = the old bodies; switch on = exactly one frame-on body renders the bracket),
   in the Stage 3 guard's style (`tests/unit/_source-code.ts`), and extend the Stage 2 `FRAME_ONLY_USERS` list.
3. **The admin preview.** Standings' preview branch (`isPreview`, empty games and teams) must adopt the new body or keep
   the old one: *recommended:* adopt the new body with no door (the preview has no Playoffs tab), no links that act, and
   no follow mark. **Do not add a Playoffs preview twin** (`VALID_SECTIONS` has no `playoffs`; `hasBracket` is forced off
   in preview; the preview Standings has no game data to draw a bracket from); say so, as Stage 3 said it for the game
   page. If the owner wants a Playoffs preview, that is a separate decision.
4. **Extract, don't fork.** (a) Move the legend (`STAT_LEGEND`) and the "How the table is ranked" lines (tie-breaker order,
   run-differential-cap note, pending-scores note) into one shared module the new body takes; the old body keeps its own
   copy (it is untouched). (b) Replace the duplicate next-game logic for the **new** bodies with `selectTeamGames` /
   `scheduleGames`; leave the old body's TODO alone. (c) One helper "what is the tournament's next playoff game for this
   division" with its unit tests (live, upcoming, TBD teams, nothing left, champion crowned).
5. **Check what live refresh needs on Playoffs.** Today the page has none. A family on the Playoffs page during the
   championship must see the score and the bracket move. Decide with the code: a client body fed by the same fetch and
   live hook as Standings (`fetchPublicTournamentData(…, 'standings')` and `usePublicTournamentLive`; check that payload
   carries the playoff plan, pools and published games the bracket needs) **or** a small refresher like the game page's
   (compare a signature, `router.refresh()` only on change). Say which, and why. Constraints: D1 gates stay server-side,
   no per-user data in HTML a service worker caches.
6. Verify, then the `/clear` note. Say that nothing is visible yet with the switch on.

## Part 2 · Standings, phone

Build `PublicStandings` to the `#f-stand` drawing, in the frame-on branch only. Reuse `PublicSectionHead`,
`PublicDisclosure`, `PublicDoorRow`, `PublicTournamentState`.
1. **Controls and counts:** the division dropdown (full width, 44 px, 16 px text), then **one quiet line** of counts
   ("Top 4 advance · 8 games final · 1 left to play"; "Submitted" only when non-zero; a zero is absent).
2. **The table first.** Phone columns **Team | REC | RD | RF | RA | PTS**, **Team pinned left and PTS pinned right**, the
   middle scrolling between them. Row-state backgrounds (top row, followed row, advancing) must cover both pinned cells
   (today's `.topRow .stickyCol`, `.followedTeamRow .stickyCol` rules need a PTS twin, or the pinned cells show the wrong
   background while scrolling). Keep: the capped RD in brackets, the trophy / rank arrows / playoff-spot tick / pending
   clock (quieter, as drawn), the pool sections ("Standings · Pool A") for pooled divisions. A followed team's row mark per
   question 3. **Measure and say** the drawing's number: the first table row about **310 px** down (today about 735).
3. **"How the table is ranked"** as one `PublicDisclosure` below the table: the legend, the tie-breaker order, and the
   run-differential-cap and pending-scores notes, **in today's words** (shared module from Part 1). Closed on a phone.
4. **The door to Playoffs** at the foot ("The playoff bracket", with its state line), shown only where the Playoffs tab
   exists (`hasPublicBracket`) and, per question 2, **only once the bracket has moved** (until then Part 2 keeps the
   bracket on the page and shows no door).
5. **Gone, with a note to the owner:** "Recent Scores" (the Overview and Schedule carry results), the result pills and the
   always-visible legend. Nothing is deleted from the data.
6. **States:** from the Part 1 drawing. Held-back divisions: the table and counts for a withheld division appear nowhere.
7. **Owner check on fixtures** at 360 and 390: a pooled division mid-pool-play, one with playoffs underway, a finished
   event, a no-playoffs event. Fixtures: `scripts/seed-public-frame-fixtures.mjs` (Lakeshore, Metro, Northfield, Cedar
   Valley, Pinecrest), `scripts/seed-public-stage3-fixtures.mjs prepare | final | undo` (moves Lakeshore's live semifinal,
   reversible, dev only) and `.probe/stage2walk/walk.mjs withhold | unwithhold`. Extend them minimally if a state is
   missing, keeping every change reversible and dev-only.

## Part 3 · Playoffs, phone; the bracket moves; the Schedule door; the desk

Build `PublicPlayoffs` to the `#f-play` drawing.
1. **Next game first.** The division's live game as a **Live now card** ("Championship · 4:00 p.m. · Diamond 2", teams
   with scores, "The winner takes the title" in gold for the championship only), or **"Up next"** with time, field and a
   Directions symbol before it; TBD slots in fan words ("Semifinal 1 winner"). **Measure and say:** the drawing puts the
   next playoff game about **270 px** down (today about 1,190).
2. **The bracket**, moved here: `TieredBracket` for the division, every name readable without zooming at four teams, the
   shipped zoom and full-screen controls kept for bigger brackets. **The Pending matchup cards fold into the bracket**
   (it shows which games feed them); each game opens its own page. Carry `data-sandbox-tour="playoff-bracket"` to the new
   bracket section (see "The demo").
3. **"How seeding works"** as one `PublicDisclosure`: the format line ("Single elimination, top 4 advance"), the panels
   (top seed, best offence, stingiest defence, best differential) and the seed list with its playoff cut line, from
   `buildPlayoffPicture`, in today's words (spelling per question 5). Closed on a phone.
4. **Remove from the new body:** the hero, the "See the full bracket" and "Full Bracket" links (the bracket is here), the
   "Playoff schedule" button (the Schedule's Playoffs half is one tap away through the tab row; *add a door row to it only
   if the drawing's states need one*, and say so).
5. **Land the move in one commit:** the new Playoffs body has the bracket; **remove the bracket section and disclosure from
   the frame-on Standings body**; **add Standings' door**; and **re-point `SCHEDULE_BRACKET_DOOR`** to `playoffs` with the
   sub-line "On the Playoffs tab", **changing the gate at `PublicSchedule.tsx` (~267) from the Standings page key to the
   bracket's own visibility** (`hasPublicBracket` or `isPublicBracketVisible`; a bracket-only event hides Standings). Update
   the Stage 3 guard if it pins the old target, and the layout screen `pubt-schedule-playoffs` if it needs the destination.
   Tell the owner the Stage 3 walk's door steps (§426 D4 and D5, "On the Standings tab") describe the old target: they were
   true when walked and are history.
6. **Live refresh** as decided in Part 1 step 5; prove it with the fixture (score moves, the card becomes the result, the
   bracket updates, no duplicate row) the way Stage 3 proved the Schedule.
7. **The desk (1,024 px and up)** for both pages: Standings the table full width with the explainer beside or below;
   Playoffs next game and bracket in the Overview's two-column recipe. Check 901–1,023 px, where Stage 1 kept the phone
   frame. Derived (no drawing): show the owner for his yes.
8. **The admin preview** per Part 1 step 3. **The demo:** with the switch on, check the demo tournament's Standings and
   Playoffs read sensibly; **do not edit the demo seed** (CLAUDE.md: demos follow the product). The build fails if a demo
   tour destination or anchor stops existing: with the switch off the old Standings keeps its anchor, so this should pass;
   if the gate does fail, stop and tell the owner rather than editing the demo files.
9. **Layout screens:** add screens for Standings (mid-pool, playoffs underway, finished), Playoffs (live championship,
   bracket set with nothing played, a bigger bracket) and the Schedule's playoff half with the new door; each waits for its
   state so a missing fixture fails instead of measuring another page. Run `check:layout --changed` with the switch on.
10. Owner check at 360 / 390 / 1280.

## Part 4 · Cleanup, review, the walk, the records

1. **Cleanup pass** on Stage 4's own files only (duplication, unused code, one status/next-game rule everywhere in the
   frame-on bodies). **Then an adversarial read of the whole Stage 4 diff.** If you have no review command, do it by hand
   across these lenses, or stop and tell the owner to run Claude Code's `/simplify` and `/review` on the committed range:
   - **The bracket on both or neither:** any switch state, any event shape (pooled, bracket-only, no playoffs, placement
     format) with the bracket on zero or two pages, or a door to a tab that does not exist.
   - **A held-back division** in a table, a seed list, a bracket node, a counts line or the next-game card.
   - **The switch-off pages** changing by one word or pixel (the old Standings, Playoffs, Schedule door text with the
     switch off, the `playoff-plan.test.ts` greps).
   - **Shared CSS** changed under the old pages: `.liveBadge` / `.liveDot`, `TieredBracket` / `LogicSyncBracket` sheets,
     `standings.module.css` outside frame-keyed rules.
   - **Pinned columns:** wrong background under a pinned cell; PTS hidden at 360; RD capped values clipped.
   - **Live state:** a champion crowned while the page is open; a score arriving; a stale "Up next".
   - **The admin preview** showing a door or link that acts; **per-user data in cached HTML**.
2. **The QA walk**: one purpose, *"with the preview on, Standings answers where my team stands and Playoffs answers who
   plays next and how the bracket looks; the bracket is on exactly one page; with the preview off, nothing changed"*. A
   checkable Artifact in §426's style (`PUBLIC_TOURNAMENT_STAGE3_WALK.html` is the shell: parts, fixtures, stop checks,
   a read-back on every step that writes). **Grep `OWNER_QA_LEDGER.md` for the next free §; other sessions add §s.**
   Parts to cover: the table and its pins on a phone; the ranking explainer; counts line states; the door and where it
   lands; the next-game card in each state; the bracket and its zoom; seeding behind a tap; the Schedule's door now
   pointing at Playoffs (incl. a bracket-only event); held-back and empty states; the desk and 901–1,023 px; the results
   line still on both pages; the admin preview (Standings only, no door); the preview off is today's pages; the demo.
   Keep installed-app steps optional. ⚠ §407's lesson: the walk is the only rendered check; ask for a read-back on every
   step that writes and compare the server log with what the owner ticked before recording a pass. Leave the fixture
   prepared or undone and say which.
3. **Records:** plan §9's Stage 4 row (commit hashes, walk §), the `TODO.md` line (one line; detail in the plan), the
   ledger entry. `/docs` and `/demos` wait for Stage 8.
4. **Then tell the owner Stage 4 is done and a good place to `/clear`.** Next is Stage 5 (Teams + a team's page, where
   following lives) or Stage 1a (who owns the look); name both and let him choose.

## Not in Stage 4 (say so if a step drifts toward one)
Teams and a team's page, and where following lives (Stage 5). Tabs following what there is, the tab order, Rules as
tap-open sections, the Register and Champions tabs (Stage 6). The pay page (Stage 7). Sponsors strip (side track). The
club's rule for its tournaments' look (Stage 1a). Retiring the old bodies and turning the switch on (Stage 8). A
Playoffs preview twin in the admin preview (not asked for). Any change to how standings are computed, tie-breakers are
resolved or brackets are generated: those libraries are not touched, only where their words are shown.

---

## Part 1 execution · 2026-10-29

**Owner direction in this session:** “Stage 3 walk is done; start Part 1” and “Use all five recommendations”.
That resolves questions 1–5 above: one division at a time, remembered by the existing division preference; Part 2 keeps
the bracket on Standings, then Part 3 moves it and both doors together; installed-app-only followed-row marks; quiet
Share symbol; offence/defence in the preview with the old spelling preserved until Stage 8. Desktop follows the
Overview from 1,024 px. The admin preview adopts Standings, without a Playoffs twin, working links, a door or follow mark.

**Part 1 foundations implemented:** both server pages ask `isPublicFrameOn`; Standings' client and the admin Standings
preview select `PublicStandings`; Playoffs selects `PublicPlayoffs`. These new bodies deliberately delegate to the
current content at this checkpoint. `StandingsContent.tsx` and the Playoffs JSX are preserved byte-for-byte (guarded
by SHA-256 after normalizing line endings). No product CSS or Schedule destination changes in Part 1. The bracket
remains on Standings, the Schedule still points there, and the results-line page list is untouched.

`lib/public-standings.ts` holds the legend and the existing ranking/cap/pending words for Part 2 to consume, resolving
tie-breaker order through the existing settings rule. The old body keeps its copy. `lib/public-playoffs.ts` reuses
`scheduleGames`, `publicGameState`, kickoff time and the tier-aware champion rules for the chosen division's next
game. Its server hand-off filter removes held-back divisions' plans, games, teams and standings together. Neither
helper changes how a table or bracket is calculated. Team-specific selection in the new body must use `selectTeamGames`;
the old body's TODO stays untouched.

**Live refresh decision for Part 3:** use a client body and `usePublicTournamentLive` with authoritative replacement of
the public payload. The existing standings payload already has plans, pools, venues and published games, but it is
gated on Standings, which is deliberately absent for bracket-only events. It also carries held-back divisions and teams.
Therefore extend the public data endpoint with a `playoffs` section in Part 3, gated on `isPublicBracketVisible`, and
apply the server-side published-division hand-off filter there. Do not poll `standings` unchanged or use the Schedule
visibility as a substitute. Continue the shared hook's hidden-tab pause/catch-up behaviour, and keep selection/follows
on the device. Handle kickoff/end and a crown arriving while open, including authoritative removal of games or divisions.
No new polling runs during Part 1.

**Drawing:** [PUBLIC_TOURNAMENT_STAGE4_STATES_DRAWINGS.html](PUBLIC_TOURNAMENT_STAGE4_STATES_DRAWINGS.html), a local,
whole-screen HTML prototype with 360/390 px controls. It covers the unset/unavailable/held-back states, live with no
score, TBD sides, champion, no remaining game without a final, eight-team bracket, two pools, no playoffs,
bracket-only, empty standings, the followed row inside the app, and door sub-lines. It is ready for the owner to have
published as an Artifact and reviewed through `/design`; this environment has no Claude Artifact publishing tool.
The owner approved the drawing after revising it with Claude; see Part 2 execution below.

**Checks:** focused Stage 4, Stage 2, plan and publication/visibility suites: 202 passing; full TypeScript and focused
lint passed. Browser and
visual checks belong to the owner. The instruction to commit only on the owner's word remains in force.

**Broader verification and hand-off:** all 12,251 unit tests pass. `npm.cmd run verify:changed -- <explicit paths>`
ran that full suite, then its internal focused-lint stage inspected the wider working tree and failed on the existing
ESLint configuration (`react-hooks/set-state-in-effect` cannot find plugin `react-hooks`). The explicit-path
`npm.cmd run lint:focused -- …` passed on all eleven Stage 4 code/test files. Spelling, palette contrast, text contrast
and CSS-module purity pass. The public-token gate flags an existing colour literal in the admin tournament Schedule;
no Stage 4 product CSS was added. The demo gate stops on `ERR_MODULE_NOT_FOUND` for the extensionless
`lib/tournament-teams` import in `lib/registration-attention.ts`; it did not reach a tour-anchor verdict. No demo seed,
tour, shared check or automation file was changed to resolve these unrelated failures. Logs: `.probe/stage4/`.

The dev supervisor and its children were stopped, the verified workspace `.next` cache removed, and `npm run dev`
restarted with network access (using `npm.cmd` because this shell blocks `npm.ps1`). Ready confirmed; the required
platform-admin login URL returned HTTP 200, with no Supabase `EACCES` in either server log. The server stays running.
Other work is actively browsing the shared server (league/team and admin requests), so the layout sweep was deferred
under AGENTS.md's “Do not launch a sweep against a server that is also being used for something else” rule. On a quiet
server, finish Part 1's owed check with `npm.cmd run check:layout -- --changed --only=pubt-standings-own,pubt-playoffs-pale`
(development turns the preview on; the ready selectors require the new frame). Do not broaden to the other dirty files.
This is a verification limit, not a layout pass. The drawing script parses and renders all fifteen specimens in a static
DOM stub; its visual appearance awaits the owner. No additional browser verification was performed.

**Next session starts at Part 2**, after drawing approval: consume the ranking helper, build the phone table/counts,
pin Team and PTS, keep the bracket on Standings and show no playoff door until Part 3. Replace the transitional delegation
without weakening the single-bracket guard. Keep preview-off content unchanged. Part 3 must replace the legacy children
in `PublicPlayoffs`, wire the dedicated feed, move the bracket and both doors atomically, then check desktop and live states.

## Part 2 execution · 2026-10-29

**Owner direction:** “claude and I have made some updates to your drawing, go ahead and build based on the updated
drawings”. This approves the revised `PUBLIC_TOURNAMENT_STAGE4_STATES_DRAWINGS.html` for this build. Its 150 px phone
Team column, right-aligned figures, pinned PTS and readable capped differential are the implementation target. The
drawing's final Playoffs door stays deferred until Part 3, per the already-accepted atomic move.

**Implemented:** `PublicStandings` now renders its own frame-only body with the remembered division, counts, pooled
tables and one `PublicDisclosure` for ranking. Phone columns are Team / REC / RD / RF / RA / PTS; Team is 150 px and
PTS 52 px, both sticky. The middle scrolls inside the table's box. Run columns take spare width on larger frames while
the pinned ends keep their width. True RD and the capped seeding value remain, with wrapping between the values when
needed. First-place trophies, transient pool-rank arrows, playoff-spot ticks and unofficial-score clocks are kept small.
The followed row's colour mark is CSS-gated to standalone display mode; a browser's stored follow does not change the
division selection or bracket. Preferences hydrate after paint, outside cached HTML.

The counts describe **pool games only**, matching the revised drawing and the existing engine's table inputs. They
use the shared public game state/finalization rule, omit zeros, include forfeits as finals, omit cancelled games, and
say “per pool” where that is the saved qualification rule. The body does not recalculate or reorder standings. Pool
headings keep the existing `formatPoolName` wording (for example “A Pool”, rather than inventing a second naming rule).
There is no new year selector, My team strip, result-pill row or Recent Scores block; the Overview and Schedule carry
results and Ask 17's results line remains untouched.

**The bracket stays on Standings:** the shipped `TieredBracket` is below the table and ranking explainer, with its
tour anchor retained. There is no new Playoffs door. The Playoffs body and `SCHEDULE_BRACKET_DOOR` still show Part 1's
content and destination. The bracket also follows `isPublicBracketVisible`, so stale playoff games in an exhibition
cannot create a bracket. Part 3 must move it and both doors in one edit, retaining the single-owner guard.

**D1 and live replacement:** a new `standings-preview` public data section uses the Standings visibility gate, then
filters published divisions, accepted teams, games and seed/table rows on the server. The original `standings` feed
returns its original payload. The shared `publishedCompetitionData` filter also serves Part 1's Playoffs hand-off and
the admin Standings preview. The body uses `usePublicTournamentLive` for authoritative replacements, so a removed or
withdrawn division drops out with its counts and bracket, and the chosen division falls back to the first published
one. The admin preview has no polling, bracket, active links, preference writes or followed-row mark. No Playoffs
preview section was added. The old Standings source, old Playoffs JSX and shared legacy styles remain hash-guarded.

**Focused checks:** 269 tests pass across Stage 1/2/3/4, standings, publication, visibility and playoff-plan suites.
Additional React server-render checks exercise the actual body: table order, capped RD and marks, two pools, the
retained bracket, preview/exhibition suppression and hidden/empty states. Public tokens, spelling, palette/text
contrast, public lettering and CSS-module purity pass. CSS selector checking reports existing orphan/dead classes in
other admin, coach and platform files, with no Stage 4 selectors among them. No shared gate or baseline was changed.

**Layout measured:** the owner granted a quiet-server window. A temporary wrapper around the repository's real
`check:layout --changed --only=pubt-standings-own` requires the new table to be ready, checks both pinned cells while
scrolling, then opens the ranking disclosure before the normal layout rules run. Final runs at **360, 390 and 901 px
all pass with no findings**: Team exactly 150 px, PTS exactly 52 px, both shifts 0 px, no page overflow. The wrapper
adds 360 to its in-memory width list only, with no tracked screen/guard changes or baseline writes. Three pairs are
measured serially. The pooled Metro fixture's first table row is **372 px** down at all three widths; the hub's
single-table target is about 310 px, so the pool heading and longer counts line matter to the owner's phone check.
An earlier check caught and corrected table-width distribution stretching Team to 182 px. One later attempt was
refused before starting at the memory floor; the server was restarted, memory recovered, and all final pairs passed.

Logs and measurement dumps: `.probe/stage4-part2/`. The builder did not perform visual browser review. Final full-suite,
TypeScript and server hand-off results follow below. No Stage 4 fixture data was changed; the layout checker's existing
UAT probe may re-anchor its own live fixture as part of its normal setup.

**Final verification:** the full suite ran **12,267 tests: 12,266 pass, one unrelated failure** in
`club-stage1-server-guard.test.ts` (“only the standalone owner billing address passes the zero-team wall”), against the
coaches layout being changed in another session. All Stage 4 tests pass. An earlier full run caught this new table's
literal header size; it was changed to the existing `--type-support` token (same rendered size), and the table-recipe
guard plus focused tests pass. No gate was weakened or baseline updated.

`npm run typecheck` passed during implementation. A later final run was blocked by malformed generated
`.next/dev/types/routes.d.ts` / `validator.ts`. The server was stopped before clearing `.next`, then restarted through
`npm run dev` with network access; the generated validator still failed syntax checking. A broad diagnostic source-only
run was stopped when it consumed excessive memory. **The final strict focused typecheck passed**, using the repository's
compiler options on all changed source/test files and their transitive imports, excluding the generated validator;
its temporary config and log are `.probe/stage4-part2/tsconfig.focused.json` and `typecheck-focused.log`. The tracked
`tsconfig.json` and check scripts are unchanged. Do not report the final standard full-project typecheck as passing.

The last cache-clean restart is logged in `dev-clean.stdout.log` / `dev-clean.stderr.log`. Ready and the required
platform-admin login HTTP 200 are verified, with no Supabase `EACCES`. The server remains running for the owner's phone
check. The final layout measurements precede that restart; no product source changed after those measurements.

**Owner phone check (360 / 390):** Metro `/stage1-metro-sports/spring-showcase/standings` for pooled tables; Lakeshore
`/stage1-lakeshore-lightning/fall-classic/standings` for game day; Northfield
`/stage1-northfield/fall-ball/standings` or Pinecrest `/stage2-pinecrest/harvest-cup/standings` for finished results.
Confirm the two pins, full capped RD after swiping, quiet row marks and ranking disclosure. The no-playoffs and empty
states are rendered/unit tested; no new dedicated dev exhibition fixture was prepared in this part. The preview-off
body remains covered by the source hashes. The full owner walk stays Part 4's.

**Next session starts at Part 3:** build Playoffs from the revised states, add the dedicated bracket-visible feed
(bracket-only events cannot poll the Standings feed), and move the bracket/tour anchor plus both doors atomically.
Then finish the derived desktop layouts, state-specific layout screens and live/crown checks. Part 2 is a good `/clear`
point after the owner's phone check. Commits remain governed by the build prompt's owner-word rule.

## Part 3 execution · 2026-10-30

**Owner direction:** “go ahead with part 3”, then “continue”. The revised drawing remains the build target. The
frame-on Playoffs now starts with the remembered division's live or upcoming game, including its time, venue,
Directions, fan-word TBD sides and honest “No score yet”. A decided division shows its champion instead. The bracket
follows; “How seeding works” opens the existing format/narrative, highlights and seed list. It starts closed. Only
the new presentation changes offense/defense to offence/defence. Per-pool qualification is stated explicitly in the
caption and narrative. No standings, tie-breaker or bracket-generation engine was changed.

**The move is one reviewable unit:** the frame-on Standings bracket and tour anchor are removed; its Playoffs door
is added; the frame-on Schedule door now opens Playoffs with “On the Playoffs tab”. Both doors use bracket visibility
and structure, independently of the Standings page, so the eight-team bracket-only fixture has a working door.
Playoffs owns `data-sandbox-tour="playoff-bracket"`. **Stage 3 walk §426 D4/D5 describe the former Standings destination**;
those steps were true when walked and remain historical. The switch-off Standings source and Playoffs body retain
their hash guards and original content. No extra Schedule door was needed on Playoffs.

**Readable bracket:** `TieredBracket` has an opt-in `publicFrame` presentation; its existing renderer and default
branch stay intact. Inspection found that the old “Maximize” icon only fits the diagram, and four-team SVG names
were truncated and scaled down on a phone. The new presentation uses the canonical column/group helpers, wraps full
team names and keeps their physical text size when zooming. Four teams need no controls. Bigger brackets scroll
inside their own box, with zoom/reset/fit and an actual full-screen view, keyboard close and focus restoration.
Measured SVG connectors join saved feeder references without changing advancement. Independent tiers remain
separate; cross-pool finals stay with both feeder sources; the if-needed double-elimination reset keeps its own
column. The default legacy `TieredBracket` body is preserved below the opt-in branch.

**Feed and desktop:** the dedicated `playoffs` feed follows `isPublicBracketVisible`. Before sending either the
initial body or a live replacement, the server filters held-back divisions, their plans, games, team names and
standings/seeds together. Replacements are authoritative. Scores update locally; crown/status/page-visibility
changes also refresh the server frame. Polling uses the existing shared hook, including hidden-tab pause/catch-up.
The admin preview remains Standings only, with no working door or follow mark. At 1,024 px, Playoffs places next
game beside the bracket and seeding below the game. Standings keeps its full-width table; phone order and widths
continue through 1,023 px. The derived desktop layout awaits the owner's visual approval.

**Reversible development fixtures:** `scripts/seed-public-stage4-fixtures.mjs` reserves and marks its own clones
inside the existing marked Metro fixture organization. It refuses every database except the known development
project. Source fixtures and demo rows are never changed. Every mode reads its writes back; `undo` was exercised
and verified before preparing a fresh set. Commands use `node --env-file=.env.local scripts/seed-public-stage4-fixtures.mjs`
followed by `prepare`, `show`, `score`, `no-score`, `soon`, `waiting`, `final`, `cancelled`, `withhold`, `publish` or
`undo`. Do not run `prepare` over an existing saved set. The final proof restores publication and the live 4–2 score.
Identifiers are reserved in `.probe/stage4-fixtures.json`; dates are anchored when prepared, so re-prepare for a later
day. `score` re-anchors the live final for a same-set owner check.

Owner review paths (preview on), at **360 / 390 / 1280**:

- `/stage1-metro-sports/stage4-live/playoffs` and `/standings`: live championship and the new door.
- `/stage1-metro-sports/stage4-mid-pool/standings`: two pools with results and games remaining.
- `/stage1-metro-sports/stage4-seeded/playoffs`: published bracket with no playoff result.
- `/stage1-metro-sports/stage4-eight/playoffs` and `/schedule`: eight teams, long name, controls and bracket-only door.
- `/stage1-metro-sports/stage4-no-playoffs/standings`: exhibition without a playoff promise or door.
- `/stage2-pinecrest/harvest-cup/standings` and `/playoffs`: actual finished/crowned fixture.

**Automated proof:** all **448 tests pass** across the focused Stage 1–4 guards, actual React body renders,
Standings/Playoffs/Schedule, public-game visibility, canonical bracket/plan, tie-breaker and table-recipe suites.
Focused lint and the final strict focused TypeScript check pass, using the repository compiler options and all
changed files' transitive imports. The required standard `npm run typecheck` was attempted but exhausted its heap;
it is **not** reported as passing. Its log and the successful temporary focused configuration live under
`.probe/stage4-part3/`; no tracked compiler configuration was changed.

The live proof uses real database changes on the marked clones and the existing polling cadence. It confirms score
changes in both card and bracket, no duplicate game and no server refresh for an unchanged score poll, honest
missing scores, unresolved semifinal winners, cancellation without a stale card or invented champion, a final
becoming Champion with the band's Finished word, and withheld names/games/seeds disappearing from feed and DOM.
It also verifies the preview-off Standings anchor and original Playoffs body. Final measurement before scrolling:
the next-game card starts **248 px down at 390 px**, versus the drawing's approximately 270 px and the old page's
approximately 1,190 px. The final run supersedes an earlier 294 px measurement.

**Layout:** the seven state-specific screens pass at 360, 390 and 1280 px; mid-pool Standings plus live and eight-team
Playoffs also pass at 901 and 1023 px: **27 screen-width pairs, zero findings**. Team is 150 px and PTS 52 px through
1,023 px, both shifts zero; the desktop Team column is 240 px. No page overflow or duplicate bracket games. The
eight-team interaction checks full screen, Escape, zoom/reset and the open seeding disclosure. An initial connector
overflow finding was fixed in the presentation, then remeasured. A temporary wrapper adds 360 in memory only; no
layout guard or baseline was changed. Logs and dumps are in `.probe/stage4-part3/`. Automated measurements do not
replace the owner's visual review.

Public tokens, spelling, palette/text contrast, public lettering and CSS-module purity all pass. The CSS-selector
gate still reports four orphan references and ten dead classes in other admin/coach/platform files; none belongs
to Stage 4. The read-only tournament **demo gate cannot start**: `ERR_MODULE_NOT_FOUND` for the extensionless
`lib/tournament-teams` import in `lib/registration-attention.ts`, the same failure recorded in Parts 1–2. It never
reaches a demo/tour verdict. Demo work stops at that finding as instructed; no demo seed, tour, shared gate or
automation file was edited. Demo preview compatibility remains unverified until that gate is repaired separately.

**Handoff:** the verified dev supervisor and children were stopped and restarted through `npm run dev` with network
access after the shared changes. Ready and platform-admin login HTTP 200 are verified; no Supabase `EACCES` appears
in the final logs. The server stays running. Build record, parent plan, PM brief and TODO index are updated. The
owner's instruction to commit only on his word still applies. **Part 4 is next:** cleanup/review of the full Stage 4
diff, the owner walk and ledger; the demo verification limit must remain visible. This is a good `/clear` point.

## Part 4 execution · 2026-10-30

**Owner direction:** “go ahead with part 4”. Cleanup and an adversarial manual review covered the whole Stage 4
implementation, including its new files and its additions to shared files. No Claude Code `/simplify` or `/review`
command is available here; this is the prompt's manual-review alternative. The review used the working-tree Stage 4
delta against `2412f13092067404c5e3d1a78260d226c403112a`, with unrelated concurrent edits excluded from cleanup.

**Found and fixed:** the new bracket's Fit control had a 75% floor, so an eight-team bracket could never fit inside
a phone. Fit now uses the scroller's available content width, subtracting its padding, without that floor. Team and
metadata text keep their physical sizes through the existing inverse font scaling. Zoom out can reach 10%; Reset
still returns to 100%. A real interaction assertion was added to the existing eight-team layout screen: Fit must
stay inside its viewport and team text must remain at least 14 px. That assertion also caught the scroller's 4 px
padding during implementation; the final measurements pass at 360, 390 and 1280 px. No layout baseline or shared
check was changed.

**Cleanup:** removed the unused `publishedPlayoffData` wrapper and its oversized hand-off interface. Both new feeds
and the admin Standings preview already call the single `publishedCompetitionData` boundary. The door keeps only
the fields it reads. The regression test now exercises the real shared filter directly. No standings/tie-breaker
or bracket-generation library changed. No general refactor of the shared live hook or status rules was introduced.

Manual review results:

| Lens | Evidence and outcome |
| --- | --- |
| Exactly one bracket and working doors | Source/render guards retain one frame-on owner on Playoffs and both doors point there. Bracket-only and exhibition gates remain distinct. New regression coverage retains every saved game exactly once for single, consolation, double and placement formats at 3, 4, 8 and 16 teams, including byes and classification branches. Independent tiers, cross-pool feeders, the reset final and third-place ordering keep their earlier tests. |
| Held-back data | Initial and replacement feeds filter divisions/plans, teams, games and standings/seeds on the server. The selected division falls back. In addition to Part 3's open-page removal proof, both bodies and both feeds were checked with every clone division held back: no team, game, seed, count or table survived. |
| Preview-off pages | Old Standings source and old Playoffs JSX hashes pass. The legacy Schedule still owns its original link. The old Standings, Playoffs and Schedule styles, `LogicSyncBracket` source/sheet, and the default `TieredBracket` rendering branch retain their content; the new bracket branch is opt-in. |
| Pins and capped RD | Opaque grounds cover both pinned ends, including highlighted rows. Actual/capped values wrap separately; phone widths remain Team 150 and PTS 52. Part 3's measured pins and layout results remain applicable: no table/CSS change in Part 4. |
| Live state | The frame-on bodies use the shared public game state, next-game selector and authoritative replacement. Part 3's real score/no-score/TBD/cancellation/crown proof remains valid; no live-hook behaviour was changed. A crown refreshes the shell while a score alone does not. |
| Admin preview and cached HTML | Admin Standings has no door, link or follow mark and does not write preferences. Division preference and follow state hydrate on the device after paint; the server body receives neither. No Playoffs preview twin was added. |
| Shared CSS and remaining findings | New selectors are confined to their modules and explicit variant props. No new Stage 4 correctness finding remains from this review. The existing shared demo gate and unrelated selector findings remain separate verification limits, below. |

**Fixture coverage for the walk:** added `withhold-all` to the marked-clone script. `withhold` still changes the live
division alone; `publish` restores every division of that owned clone so it also reverses `withhold-all`. Each changed
publication value is read back, and every `show` record now includes division publication and the crown stamp alongside
the games. This closes the walk's empty-state coverage without changing a source fixture, demo or shared database gate.
Final fixture state is **prepared**: both live divisions published, FIN scheduled 4–2, crown null. The other four
marked event clones remain prepared. `undo` retains its ownership/marker checks and the earlier verified cleanup path.

**Owner walk prepared:** [PUBLIC_TOURNAMENT_STAGE4_WALK.html](PUBLIC_TOURNAMENT_STAGE4_WALK.html), **§428**, 14 parts,
59 steps (two installed-app steps optional). It follows §426's checkable shell: stop checks, per-part verdicts/notes,
explicit read-backs on fixture writes, persistent ticks, distinct optional skips, a paste-back summary and reset.
It covers the phone table/pins/RD, ranking, counts, both doors, all next-game states, small/large brackets and controls,
seeding, held-back/empty bodies, desktop and 901/1023 px, results lines, admin preview, preview off, the demo blocker,
installed app and restoration. Links use event paths and game-card navigation rather than expiring game IDs. The
editable target origin supports localhost or the computer's LAN address. The walk's own functionality is checked
automatically, including persistence, notes, mutually exclusive optional choices, links, summary and reset.
The copied shell's Copy action now rebuilds from the current ticks, and Reset clears the previous summary, so a
later paste-back cannot accidentally reuse an earlier result. Both behaviours were exercised on the final HTML.

**Publication limit:** the environment has no Claude Artifact publishing tool and document-session discovery returns
no connected session. The interactive HTML source is ready for publication through Claude; no Artifact URL is invented.
The ledger records it as **prepared, owner walk pending**, not a published or passed walk. Once the owner runs it,
compare the supplied read-backs and server log with each tick before recording a pass. The parent project remains active.

**Final checks:** **452 focused tests pass**, covering the complete Stage 4 change and relevant Stage 1–3, public
visibility, canonical bracket/plan, tie-breaker, table-recipe and results-line guards. Focused lint on every Stage 4
source/test file passes. **The standard full-project `npm.cmd run typecheck` passes** after the cache-clean restart;
this supersedes the earlier heap failure and the first Part 4 attempt blocked by malformed generated route types.
Spelling and CSS-module purity pass. Part 3's public-token, contrast and lettering checks remain applicable; Part 4
adds no product CSS. Its 27 layout pairs remain recorded, plus Part 4's successful focused Fit/full-screen/zoom/name
and overflow checks at 360/390/1280. These are automated assertions, not the owner's visual verdict.

The read-only demo gate was rerun and again stops at `ERR_MODULE_NOT_FOUND` for `lib/tournament-teams` imported by
`lib/registration-attention.ts`. Demo/tour compatibility is not proved; no demo file or shared checker was changed.
The earlier CSS-selector gate's four orphan references and ten dead classes are outside Stage 4. No whole-product
sweep or blind `verify:changed` over the shared dirty tree was run. Logs and read-backs: `.probe/stage4-part4/`.

**Server and records:** stopped the verified dev supervisor/children before removing the verified workspace `.next`
directory, then restarted through `npm run dev` with network access. Ready and the required platform-admin login HTTP
200 are verified; no Supabase `EACCES` appears in the new logs. Routine component fixes used hot reload afterward.
The server stays running for the owner. Plan §9, PM brief, TODO and ledger §428 now point at this review and walk.
The commit-only-on-the-owner's-word instruction remains in force. **Stage 4 implementation and review are complete;
Artifact publication and the owner's walk/desktop verdict remain the handoff.** After that, this is a good `/clear`
point. Next is **Stage 5 (Teams and a team's page, where following lives)** or **Stage 1a (who owns the look)**, the
owner's choice. `/docs`, `/demos` and retirement of the old bodies wait until Stage 8.
