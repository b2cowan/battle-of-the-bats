# Public tournament pages — Stage 3, the Schedule and a game's page (build prompt, four sessions)

> Written 2026-10-28. Stage 3 of `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` (§9). **Ruled already:** Ask 17 (the ticker
> leaves the Schedule and a game's page), Ask 15 (the bracket moves to Playoffs, in Stage 4), Ask 8 (one set of state
> words), the installed-app-only rulings for alerts (2026-10-27) and following (2026-10-28, plan §10a), and D1/D2/D4 from
> Stage 0. Stage 2 (the Overview) is built, reviewed and walked-ready (§423); this stage **reuses the parts it built**.
> **Everything here is built behind the preview switch**: with it off, customers and the public demo see today's Schedule
> and game page, unchanged. Stage 8 turns it on for everyone, once.

## Compact Schedule amendment — owner approved 2026-10-29

After reviewing the built list and `PUBLIC_TOURNAMENT_COMPACT_GAME_ROWS_DRAWINGS.html`, the owner approved the revised
mockup and asked to build it. **This amends the Schedule row, location and status-position instructions below.**
The preview Schedule now puts time top left, division/pool (and the playoff round) underneath, and Final / Live now /
Unofficial / Cancelled top right. Each full-width team line owns its score on the first baseline, including wrapped
names. Keep full names and 16 px type. Location and map actions leave the entire Schedule list at every width; opening
a game supplies both. The desktop keeps its one-line arrangement. Regular and live games use the same `ScheduleMatchup`
presenter in `PublicGameRow.tsx`; live retains the green edge, scoreless live games say No score yet once, and the title
game retains its stakes foot. The Overview, game-page Directions, admin-preview lack of links and switch-off body
retain their existing behaviour. The updated §426 walk reflects this recipe; recheck its changed row steps rather
than treating old ticks as a pass on the new layout.

**Validation (2026-10-29):** focused lint, full typecheck and 98 focused unit/render/guard tests pass. The render tests
use the real TSX, pin long names and two-digit scores to the same parent row, preserve all four status words and No
score yet, and confirm that the Overview still has its own Directions while preview rows have no destinations.
Public token, CSS purity, spelling, public lettering, palette and text contrast checks pass. The existing Schedule
layout gate passed the regular/live/many-day/playoff screens at 361, 390 and 1280 px: 12 pairs, zero findings, no baseline
change. A focused geometry check at 360/390 temporarily lengthened a team name in the browser only: it wrapped onto two
lines, its score stayed on the first line, and the row was 131 px; neither width had horizontal overflow or any Schedule
map link. The ordinary 107–108 px figure above remains the prototype measurement, not a claimed app measurement.
The real 30-second refresh hooks were exercised with accelerated browser timers: a score edit updated the compact
Schedule, an unchanged poll skipped the game-page refresh, Final moved into Earlier today once without duplicate ids,
and a finished-game deep link opened its fold. The guarded Lakeshore fixture was read back after writes and left
prepared/live. The dev server was restarted for shared/new files; the required platform-admin login returned HTTP 200
and the fresh log showed no Supabase EACCES errors. This is type-aware/focused validation; the owner visual walk remains
separate. The original ScheduleContent and the game page's location/Directions implementation have no changes here.

## What Stage 3 is (one paragraph, so every part shares it)

The Schedule stops being a stack of five controls above a long list and becomes what the drawing shows: **two control
rows** (a division dropdown with the *My games* pill; the Pool play / Playoffs track with a search symbol and a calendar
symbol), **day chips** that land on today, today's finished games **folded into one "Earlier today" row**, the live game
as a **Live now card in its time slot**, and every other game as a row in the Overview's recipe. The **Playoffs half** lists
the playoff games and ends with a door to the bracket. **A game's page** opens with **when and where**: the time large,
the field and address, and **Directions as a worded button** (about 303 px down; today about 730), then the score card
(with "Starts in…" before the game, "Live now" during), then a short facts card. "Final" stops being a round name (the
round reads "Championship"; "Final" means only a finished game). **Neither page carries the ticker** (the Overview's
Live now and these pages' own live cards already say it). Plan §5's "Every page" bullets (lines ~186–207) hold the words;
the hub's **"Every page" tab**, frames **"Schedule"** (`#f-sched`, with the Playoffs-chosen and 1,280 px desk frames) and
**"A game's page"** (`#p-game`), hold the drawings.

## How this runs: four sessions, a `/clear` between them

| Part | Covers | Ends with |
|---|---|---|
| **1** | The owner's questions (below) and the small drawing of the states the hub skipped; **the switch plumbing** for a client page and for the preview twin; the shared parts **extended** (status faces, pool tag, round label, one status helper); the **ticker off** both pages | Committed; nothing visible except the ticker leaving the two pages under the switch |
| **2** | **The Schedule**, phone: the two control rows, day chips, the fold, the live card, rows, the Playoffs half and its door, the states | Committed; owner check at 360/390 on the fixtures (not the walk) |
| **3** | **A game's page**; the **desk** for both; the admin preview twin; deep links and live refresh proven on the new bodies | Committed |
| **4** | `/simplify`, `/review` of Stage 3's diff, the QA walk (next free §), records | Committed, reviewed, walk written and published |

At the end of each part, tell the owner in one line that it is a good place to `/clear`, and where the next part starts.

**Token discipline (owner, 2026-10-27, unchanged).** Nearly all of a session's cost is re-reading its own history.
- **Read this prompt, plan §5 ("Every page" bullets) and §10a**, and nothing else of the plan unless a step names it.
- **The drawings are the spec and the hub is 185 KB: never read it whole.** Slice the two frames with a short node
  script (`#f-sched` about lines 700–770, `#p-game` about 796–835, plus each frame's "What changed" list). The drawings
  are HTML and CSS, so sizes, colours and words are readable in the markup. **Build to the drawing, but the Stage 1
  band, tab row, footer and tokens, and Stage 2's shared parts, already exist: reuse them, don't redraw them.**
- Send censuses to a helper and ask for path:line plus a verdict. A helper's claim is a lead: open the cited lines before
  you rely on it. (The census this prompt stands on was spot-checked on 2026-10-28; line numbers will have moved.)
- Prefer `npm run verify:changed`; `npm run typecheck` once per part (give `tsc` `NODE_OPTIONS=--max-old-space-size=8192`
  if the default heap runs out while other sessions are working). `check:layout --changed` only on the screens a part
  touched, **with the switch on**. Leave the dev server running unless a restart rule applies (AGENTS.md); new files mean
  a restart before handing the owner a check.

**Every part:** work on `dev`, stage explicit paths only; other sessions share this working copy (AGENCY_RULES). Commit
only after the owner says yes. ⚠ For a partial commit out of a file another session has also edited, build the blob from
HEAD plus your own lines, name the staging copy so it cannot collide with a repo file (Windows paths ignore case), and
diff each blob against HEAD before committing. Present the product-owner summary before writing code (AGENCY_RULES).
This prompt file was committed with Stage 2 Part 4; Part 1 needs no commit for it.

### Rulings this stage stands on (do not re-open them; cite them)
- **Ask 17:** the ticker also leaves the Schedule and a game's page; it stays on Standings, Playoffs, Teams, team pages,
  News and Rules. It is one edit to the list in `lib/public-ticker-pages.ts` (delete `'schedule'`; the match is on the
  first path segment, so a game's page at `/schedule/{id}` goes with it) and its test.
- **Ask 15:** the bracket and the List/Bracket switch leave the Schedule; the bracket's home is Playoffs (Stage 4). The
  Schedule's Playoffs half lists the playoff games and ends with a door. **No options sheet** (plan line ~189): it would
  hold only List/Bracket. The hub still has two stale mentions of an "options sheet"/"Filter sheet" (frame tag and the stage
  table); the plan is authoritative.
- **Alerts only inside the installed app** (owner, 2026-10-27): no Alerts pill on the Schedule, no bell, phone or desk.
- **Following lives in the installed app only** (owner, 2026-10-28, plan §10a): in a browser the Schedule's team picker
  and strip, and a game's ☆ beside Away/Home, go. Families who followed from a browser keep the follow on the device;
  nothing is deleted. A team is followed on its own page (Stage 5).
- **Ask 8 / D4:** the moment names on these pages are **Live now** and **Up next** only (no "Now playing", "Next game",
  "Coming up"); "Starts in" before a game. **D2:** "No score yet", never a lone dash or 0–0. **D1:** a held-back
  division's games appear nowhere (server-side gate). The year picker stays off. No field or team filter is added.
- **Stage 1's frame is the frame:** light ground, the club's type, 12 px minimum, tabular figures for scores and times, 4.5:1
  text and 3:1 edges, 44 px taps. `check:contrast`, `check:text-contrast`, `check:public-tokens` run in `verify:changed`.
- **Nothing here reaches a customer before Stage 8.** With the switch off, today's Schedule and game page are exactly as
  they were. A guard test (the Stage 1/2 guards' style, `tests/unit/_source-code.ts`) holds that every new part renders
  only under the marker or `isPublicFrameOn()`.

## What the code does today (a 2026-10-28 census; re-check before you rely on a line)

- **Neither page knows about the switch.** `ScheduleContent.tsx` (about 1,690 lines, client) and the game page
  (`schedule/[gameId]/page.tsx`, about 480 lines, server) contain no `isPublicFrameOn` and no frame marker. The frame
  reaches them only through the layout (band, tab row, footer), Stage 1's `[data-public-frame='light']` rules in
  `app/[orgSlug]/schedule/schedule.module.css`, and the layout's results line. **A Stage 3 body therefore needs a branch the
  Overview already has the shape of:** a server decision (`schedule/page.tsx` is 12 lines, server; `SchedulePageClient.tsx`
  is 13, client) that hands the client a new body when the switch is on, leaving `ScheduleContent` untouched.
- **The Schedule loads in the browser:** `fetchPublicTournamentData(…,'schedule')` → `/api/public/tournament-data`
  (published divisions only, accepted teams, venues with facilities, divisions, announcements, `fanAlertsEnabled`) and
  re-fetches every 30 s while the event is in progress (`usePublicTournamentLive`, paused on a hidden tab). **The admin
  preview twin** (`app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx`) renders the same
  `ScheduleContent` with `isPreview` and `initialData`: no follow UI, rows are divs not links, no Directions, no game page,
  no ticker. **The new body must work in both.**
- **Section order today** (`ScheduleContent`, from about line 1,020): header ("Tournament Schedule"), pinned
  announcements (inline-styled warning boxes, session-dismissible, game day only), year selector (live only), the
  followed-team strip / scorebug / `FollowTeamPicker`, a **duplicated** mobile and desktop control bar (Division select,
  Pool Play | Playoffs track, List/Bracket, search), the day strip ("All" + weekday chips; past 5 dates a swipeable rail
  with a "⋯" jump sheet; a today dot), the My Team banner, the playoff format badge and "Final Standings" list, then the
  body: unpublished state, skeleton, empty/search state, and one of the bracket diagram (`TieredBracket`), the playoff
  list split by pool, or the date groups. A desktop rail carries `MyTeamCard`, alerts, My Team Games, the calendar and
  Unfollow when a team is followed.
- **A game row today** draws two faces in one function (about 170 lines): a dense desktop VS grid plus a separate mobile
  grid, a "broadcast card" for a live game, badges (Final / Unofficial / Cancelled — **Unofficial depends on
  `requireFinalization`**), W/L/T, a pool tag, the field label, a ★ for a followed team. **There is no Directions link and no
  address anywhere on the Schedule.**
- **The game page today:** header ("Game Details"), a "← Schedule" button, date/time with the type badge, status badge and
  Share (only with a score); the matchup (Away then Home, each with a `TeamFollowStar`), the score band or "No score yet" /
  "Starts in" / "Score TBD"; the playoff stakes strip; then Location (venue, facility, address, "Get Directions"), Game
  (Division, Game length) and **Notes**. Its liveness is `GameDetailLiveRefresher` (30 s, compares `home:away:status`,
  `router.refresh()` only on change). An OG image sits beside it (`opengraph-image.tsx`). **No preview twin exists.**
- **Duplicated with Stage 2's shared parts** (Stage 3 replaces these, in the frame-on body; the old body keeps its copies
  until Stage 8): `getTeamDisplay` (twice), `getWinner` (twice), status-badge logic (**three** versions), the scheduled and
  finished row faces, the live broadcast card, and the game page's own maps URL builder against `directionsHref`.
  ⚠ **The words differ:** the Schedule says "Winner of Semifinal 1" (`fanSlotLabel`); Stage 2 says "Winner of SF2"
  (`friendlyPlaceholder`). Settle one (Part 1, step 0).
- **Stage 2's `gameRowView` is not yet enough for the Schedule:** it treats `completed`/`forfeit` as final and ignores
  `submitted` (the Schedule's "Unofficial"), `cancelled`, the pool tag, the playoff round and the followed marker.
  Replacing the Schedule row as-is would silently change what a family reads.
- **Shared with other pages, so careful:** `schedule.module.css` (2,412 lines) is imported by only five files, but
  `.liveBadge`/`.liveDot` are used by the Playoffs page and a team's page; `TieredBracket` is shared with Playoffs;
  `MyTeamCard`, `FollowTeamPicker`, `FollowAlertsToggle` and the layout's `MyTeamDock`/`DesktopMyTeamRailCard` feed the
  Teams page and the rail. Don't rename or restyle those globally.

---

## Part 1 · The owner's questions, the states the drawings skipped, the plumbing

0. **Ask the owner (one `AskUserQuestion`, recommendations first; these are the real open ones):**
   - **"My games" and the calendar symbol in a browser.** Both need a followed team, and following is installed-app-only.
     *Recommended:* show the pill and the calendar symbol **only when a team is followed on this device** (families who
     followed earlier keep it; the installed app always has it after a follow from a team page), and **absent otherwise**
     (absent beats a dead control). Alternatives: installed-app only; drop both.
   - **"All divisions" as the first choice and the default.** The drawing shows it; today's page shows one division at a
     time (a remembered pick) and no ruling covers it. *Recommended:* follow the drawing: "All divisions" is the first
     choice and the default for a first visit; a remembered pick still wins. With All divisions the rows carry the
     division in their sub-line (as drawn); the Pool play / Playoffs track appears when any division has both. Alternative:
     keep one division at a time.
   - **The bracket door's target.** The Playoffs half ends with "The bracket · On the Playoffs tab", but the bracket
     lives on **Standings** today and moves to Playoffs in Stage 4. *Recommended:* build the door now, pointing where the
     bracket is today (Standings), and let Stage 4 re-point it in one line when the bracket moves, so the door is never a
     dead end. Alternative: the door appears only when Stage 4 lands (the Playoffs half then ends on its last game).
   - **The bracket slot words.** "Winner of Semifinal 1" (the Schedule's) or "Winner of SF2" (Stage 2's). *Recommended:*
     the long form everywhere under the switch (it reads as English), as one shared function the Overview also takes (a
     one-line change plus its test).
   Also tell the owner (do not ask): the **desk game page** has no drawing, so it is derived from the phone's cards in the
   Overview's two columns from 1,024 px (shown for his yes at Part 3); and the hub's stale "options sheet" tags.
1. **Draw the states the hub skipped, as one small page, before building them** (CLAUDE.md: mockups are Claude Artifacts,
   run through `/design` first, whole-screen, true size). The drawings are silent on: **the pinned announcement** (a
   rain-delay or urgent notice sits above the controls today; it must stay: *recommended:* the Overview's note-card
   style, dismissible per session); **a Cancelled game** and **an Unofficial score** (a face for each in the row, the live
   card's neighbour and the game page's score card); **Notes** on a game's page (*recommended:* a "Notes" row in the facts
   card, absent when empty); **the stakes variants** ("Winner advances to the Semifinal", "Battling for 3rd place",
   "Consolation final"; *recommended:* the score card's foot note, as the championship's is drawn); **a venue with no map
   link or an unset field** ("Location TBD", no Directions button); and **the held-back schedule** ("Schedule coming soon",
   restyled). Present it, get the owner's yes, then build Part 2 to it.
2. **The switch plumbing.** `schedule/page.tsx` (server) asks `isPublicFrameOn()` and passes the answer down;
   `SchedulePageClient` renders the new body when it is on and today's `ScheduleContent` when not. Do the same for the
   admin preview route (its server page already builds `initialData`). Name the new client body (e.g. `PublicSchedule`) and
   keep `ScheduleContent` byte-for-byte. The game page is a server component, so its branch is an `if (frameOn)` inside it,
   as the Overview did. Add the **guard test** (switch off = the old body) now, before there is anything behind it.
3. **Extend the shared parts, don't fork them.** Give `gameRowView` / `liveCardView` what the Schedule needs and the
   Overview did not: a **status face** that reproduces the Schedule's rule exactly (Final / **Unofficial** when
   `submitted` or `requireFinalization` says so / Cancelled / Live now; unit-test the table against the old badge logic),
   the **pool tag**, the **playoff round** line ("12:00 p.m." over "Semifinal"), and the settled slot words. **One status
   helper** replaces the three copies in the frame-on bodies (the old body keeps its own). Keep the Stage 0 guard's strings
   (`hasNoScoreYet(` and `NO_SCORE_YET`) in the files that guard reads, or move the guard with them.
4. **The ticker off.** Delete `'schedule'` from `TICKER_PAGES` and change `tests/unit/public-ticker-pages.test.ts` (it asserts
   `schedule` and `schedule/g1` are ON) in the same edit. With the switch off the old strip is unchanged (it is the
   layout's `ScoreTicker`, not this list).
5. **Check what the "Updated 11:52 a.m." line on the live card needs:** no such text exists anywhere in `components/public`
   today. Look in `docs/agents/db/DATA_DICTIONARY.md` for a score-updated time on a game. If none exists, **drop the line
   and tell the owner**; a line that claims freshness must be true, and inventing a column for it is a migration the
   owner has not asked for.
6. Verify, then the `/clear` note. Say that the only visible change so far is the ticker leaving the two pages under the switch.

## Part 2 · The Schedule, phone

Read the hub's `#f-sched` frames and "What changed" list. **Build the frame-on Schedule as a new client body** fed by the
same fetch and live hook, **leaving `ScheduleContent` untouched**. Reuse `PublicGameRow(s)`, `PublicLiveCard`,
`PublicSectionHead` (its link slot for a date heading, `count` for "Live now"), `PublicDoorRow`, `DirectionsLink` and
`directionsHref`; reconcile `resolveGameFieldLabel` with the `resolveGameVenueLabel` the Overview uses.

1. **Controls, two rows.** Row 1: the division dropdown (full width, 44 px, 16 px text, a field edge at 3.4:1) and the *My
   games* pill (per the owner's answer; 44 px, 14 px/600). Row 2: the Pool play / Playoffs track as **one white track with
   the chosen half in the organizer's colour** (each half 44 px), then the **search symbol** and the **calendar symbol**, each
   44×44 with a 22 px icon (a symbol alone, no border, per the phone rule). Search opens in place; it still matches team
   names **and coach names**. The track is absent when the event has only one stage (today's rule).
2. **Day chips**: today's strip recoloured (All, then each game date; 48 px, 14 px/600 label over a 12 px date; chosen =
   the organizer's fill; today carries a 6 px dot). **Lands on today, one day at a time** (unchanged); roomy chips up to
   about five game dates and a swipeable rail beyond (the 2026-07-14 D8 rule; entries are distinct game dates). Hidden
   while a search is active or when there is one date.
3. **The fold.** Games already final today fold into one tap-open row at the top of today, **"Earlier today"** with
   "4 games, all final" under it (52 px, 16 px/600 + 14 px sub, chevron), still in time order. Other days do not fold. On
   a desk they stay open under the label "Earlier today · all final". Build the tap-open row here (the Stage 2 prompt
   left it to the first stage that draws one; this is it): a real button, `aria-expanded`, 44 px, closed by default,
   reusable by Stage 4's tie-breakers and Stage 6's rules.
4. **Live game and rows.** The live game is the **Live now card in its time slot** (3 px green left edge, teams on their
   own lines with scores, "No score yet" before the first, Directions as a symbol), then an "Up next" slot header and rows
   in the Overview recipe (time 14 px tabular | both teams on their own lines 16 px, sub "U13 · Diamond 4" 14 px | a 44 px
   Directions symbol; row min 60 px, time column 84 px). Every row opens the game's page; in the admin preview a row is a
   plain div with no Directions. The **status faces** from Part 1 appear (Unofficial, Cancelled).
5. **The Playoffs half.** The same rows listing the playoff games: the round under the time ("12:00 p.m. / Semifinal"),
   winner bold and loser soft, the score stacked at the right (20 px/700), sub "Diamond 2 · Final"; a live championship as
   a Live now card with "The winner takes the title"; the day chips shrink to All + Today; it **ends with the door**
   ("The bracket · On the Playoffs tab", a 56 px door row) to the target the owner chose. Keep the pool-split headers
   ("Pool A Playoffs") where a division has several pools, and the "Final Standings" placement list where it shows today
   (decide with the code whether it stays above the games or becomes a door; say which).
6. **What is not carried over, said in the PO summary:** the ticker; the options/filter sheet (never built); the year
   picker; the Alerts pill; the follow-a-team strip, scorebug and picker (a team is followed on its own page); the My Team
   rail card, Unfollow and "My Team Games" banner; the sticky day heading and its "3/8" count (replaced by chips and the
   fold); the List/Bracket switch; the header ("Tournament Schedule") and eyebrow.
7. **Kept, and proven by a test or a fixture step, not assumed** (the drawings are silent): the pinned announcement; the
   `?highlightGameId=` deep link (lands on the right division, stage and day, then flashes the row); the followed-team
   auto-jump when one exists; the playoff-day auto-switch of the stage; pool tags per row; the one-stage rule that hides the
   track; the held-back state (D1) and the empty/search states; the score-flip animation and 30 s live merge; the
   per-division remembered pick.
8. Owner check on the fixtures at 360 and 390: game day with a live game (Lakeshore, via `.probe/stage1walk/walk.mjs live`),
   nothing live, a played-out day (the fold), a many-day event (the rail), the Playoffs half, a held-back division,
   Cancelled and Unofficial rows. **Say the measured number**: the drawing puts the first game row at about 394 px.

## Part 3 · A game's page, the desk, the preview, the refresh

1. **When and where first.** The plain "‹ Schedule" back link (20 px chevron, replacing the button and the "Game
   Details" heading), then the card: the time at 32 px/700 in the title face, tabular ("4:00 p.m."), "Tue, Oct 27 · Diamond
   2" (16 px/600), the address (14 px, muted), and **Directions as a full worded button** (48 px, 16 px/600, a 20 px
   icon; the page's primary action). Directions exists only when the venue has a map link; otherwise "Location TBD" and no
   button (the state drawn in Part 1). Use the shared `directionsHref`, not the page's own URL builder.
2. **The score card.** Top line "Championship · U11" with the state chip (Live now); both team names (links to the team
   pages, wrapping to two lines) with their scores; foot: the stakes note and the share symbol (44 px; only once there is
   a score, and the "unofficial" share label stays). Before the game: "Starts in …" (D4). The Away/Home labels and the ☆ are
   gone (the data is kept; the team page shows it); the listed order stays visitor first, home second.
3. **The facts card**: Division, Round, Game length (48 px rows, 16 px), and **Notes** when there are any. **"Final" stops
   being a round name**: the round reads "Championship"; "Final" appears only as a finished game's state. Check the
   OG image and `generateMetadata`, which build their titles from the same helpers.
4. **Liveness.** Keep `GameDetailLiveRefresher` (compare the signature, refresh only on change); do not poll the whole
   payload. A game's page has **no preview twin** and the preview's rows are not links: decide with the code whether the
   admin preview needs a game page at all (today it does not) and say so.
5. **The desk (1,024 px and up)** for both pages: the Schedule per the drawing (one row of controls with nothing hidden:
   "All divisions", a "Search teams" field, *My games*, "Calendar" in words; the side rail stays; rows are one line, the live
   one has the word "Directions"); the game page derived in the Overview's two columns (when/where and score on the left,
   facts on the right) for the owner's yes. Check 901–1,023 px, where Stage 1 kept the phone's white tab row.
6. **Layout screens.** `pubt-schedule-pale` and `pubt-game-pale` exist (the second reaches a game by clicking the first
   `a[href*="/fall-classic/schedule/"]`, so game rows must stay links with that shape). Add screens for the Schedule with a
   live game, a many-day event, the Playoffs half, and a game's page in progress. Run `check:layout --changed` with the
   switch on, on those.
7. **The demo.** With the switch off the demo is today's pages. With it on, check the demo tournament's Schedule and a game
   read sensibly; **do not edit the demo seed in this stage** (CLAUDE.md: the demos follow the product).
8. Owner check on the fixtures at 360 / 390 / 1280. **Say the measured number**: Directions about 303 px down (today about
   730).

## Part 4 · Simplify, review, the walk, the records

1. **`/simplify` first** (Stage 3 adds the status helper, the tap-open row and extends the game row family): scope it to
   Stage 3's own files; the working copy holds other sessions' hunks. Then **`/review` on all of Stage 3's diff**, scoped to
   the committed range plus any uncommitted Stage 3 edits. The places this stage can be wrong: a **status face that reads
   differently from the old Schedule** (Unofficial vs Final, Cancelled) so a family sees a different result; a **withheld
   division's games** appearing in a chip, the fold, a search result or a deep link; the **deep link** landing on the wrong
   day or division; **live merge** dropping or duplicating a row, or the fold swallowing a live game that just finished; the
   **switch-off path changing by one pixel or one word**; the **ticker** gone from a page that should keep it (Standings,
   Playoffs, Teams, team pages, News, Rules) or still on these two; **shared CSS** (`.liveBadge`, `.liveDot`,
   `TieredBracket`) changed under the Playoffs page or a team's page; the admin preview showing a link that acts; a
   client component reading per-user data into HTML the service worker caches.
2. **The QA walk**: one purpose, *"with the preview on, the Schedule and a game's page answer where and when; with it
   off, nothing changed"*. A checkable Artifact in §423's style (`PUBLIC_TOURNAMENT_STAGE2_WALK.html` is the shell:
   parts, fixtures, a stop check, read-backs on every step that writes). **Grep `OWNER_QA_LEDGER.md` for the next free §;
   other sessions add §s.** Parts: the controls and chips on a phone; the fold and the live card (the game script); the
   Playoffs half and its door; the held-back and empty states; Cancelled and Unofficial; a game's page (Directions first,
   no stars, "Championship" not "Final"); the desk; the deep link; the ticker gone from these two and still on the others;
   the switch off is today's pages; the demo. Keep installed-app steps optional. ⚠ §407's lesson: the walk is the only
   rendered check; ask for a read-back on every step that writes and compare the server log with what the owner ticked
   before recording a pass. Fixtures: `scripts/seed-public-frame-fixtures.mjs` and `.probe/stage1walk/walk.mjs` /
   `.probe/stage2walk/walk.mjs` already move Lakeshore through live / soon / new, withhold, crown and club-site off.
3. Records: plan §9's Stage 3 row (commit hashes, walk §), the TODO line, and the ledger entry. `/docs` and `/demos` wait
   for Stage 8.
4. **Then tell the owner Stage 3 is done and a good place to `/clear`.** Next is Stage 4 (Standings + Playoffs, where the
   bracket lands and the door is re-pointed), or Stage 1a (who owns the look). Name both and let him choose.

## Part 1 outcome and rulings (2026-10-29), which AMEND Parts 2 and 3 above

Part 1's owner questions and the states drawing are **done and ruled**. The drawing page is
`docs/projects/active/PUBLIC_TOURNAMENT_STAGE3_STATES_DRAWINGS.html` (published https://claude.ai/artifact/Uva6kyqJLZFzVTwP2GKQwE);
last night's duplicate (`KBXYy3…`) is superseded. Where this section and Parts 1–3 differ, **this section wins**.

**Owner rulings (2026-10-29, "agree with your recommendations"):**
- **My games pill and the calendar symbol: installed app ONLY**, never in a browser, even for a family who followed earlier
  (this overrides Part 1 step 0's recommendation). Hide them with the same display-mode rule Stage 2 used for "Follow this
  tournament" (`.appOnly` in `PublicParts.module.css`, `@media (display-mode: standalone)`), decided as the page first draws,
  never by script after it. In a browser the row-1 pill and the row-2 calendar symbol are absent; the division dropdown
  and the Pool play / Playoffs track keep their full width.
- **"All divisions" is the first choice and the default** on a first visit; a remembered pick still wins. Rows carry the
  division in the sub-line; the Pool play / Playoffs track appears when any division has both.
- **The bracket door is built now and points at Standings**, where the bracket is today. Its sub-line reads **"On the
  Standings tab"** (not the drawn "On the Playoffs tab", which would be untrue). Keep the target and the words in ONE place
  so Stage 4 re-points both in one edit.
- **Slot words: "Semifinal 1 winner"** (the 2026-07-17 fan wording) on every new page. Already built: `fanPlaceholder` in
  `lib/public-game-row.ts`, taken by `TournamentOverview`. The old Overview keeps "Winner of SF2" until Stage 8.
- **The "Updated 11:52 a.m." line is dropped.** No score time reaches the public pages, and `games.score_submitted_at`
  is not proven to move on every in-progress score change. Do not add a payload field for it. A live card ends with its
  Directions symbol (Playoffs half: "The winner takes the title").
- **The states drawing, as recommended:** a pinned notice is a white card with a 3 px amber left edge, a 44 px × dismisses
  it for the visit, game day only. **Cancelled** and **Unofficial** are chips placed **after the field name** in the row's
  sub-line (a cancelled row has no Directions symbol; its names and time are soft; the time is never struck through).
  On a game's page a cancelled game shows the red chip **beside the soft time**, **keeps the address**, has no Directions
  button, no scores, no share symbol, and its score card's foot says **"This game will not be played."** An unofficial game's page
  shows the amber chip in the score card's top line, the scores, the share symbol, and the foot **"Not yet confirmed by the
  organizer"**. Notes are the last row of the facts card, absent when empty. The stakes line is the score card's foot:
  "Winner advances to the Semifinal", "Battling for 3rd place", "Consolation final", "The winner takes the title" (today's words come from `getPlayoffStakes` in the game page, which prints "Championship — winner takes the title"; the new foot says "The winner takes the title", gold for the championship only; move the helper somewhere shared rather than copying it). **"Location TBD" and no Directions button only when
  NO location is set at all**; a venue name alone keeps Directions (the page opens maps on the address, else the name).
  **A whole held-back schedule** shows the card ("Schedule coming soon") with no controls but **keeps today's doors as
  door rows: Teams, and Register only while sign-ups are open** (none in the admin preview); "Tournament Home" goes. **One
  held-back division** keeps the controls and shows "Division schedule coming soon".
- **A forfeit reads Final** on the new pages (today's Schedule drew no word for it). This is the one deliberate difference
  from today's badge table; `tests/unit/public-schedule-status.test.ts` already pins it.
- **The admin preview's switch branch lands with the new body in Part 2**, not before: there is nothing to switch to
  until `PublicSchedule` exists. It passes `isPreview` and `initialData` as `ScheduleContent` does today; rows are plain
  divs, no Directions, no game page, no ticker.

**What Part 1 left in the working copy (uncommitted until the owner says commit):** the switch plumbing (`schedule/page.tsx`
asks `isPublicFrameOn()`; `SchedulePageClient` takes `frameOn` and does not use it yet) with its guard test
(`tests/unit/public-tournament-stage3-guard.test.ts`); `lib/public-game-row.ts` extended (status face from
`publicGameState`, `cancelled`, `poolTag`, `round`, `fanPlaceholder`, a `slot` parameter on `gameSideNames`) with its tests;
`tests/unit/public-schedule-status.test.ts`; `'schedule'` out of `TICKER_PAGES` with its test; the states drawing. Run
`node --import ./tests/ts-resolver.mjs --test tests/unit/public-game-row.test.ts tests/unit/public-ticker-pages.test.ts tests/unit/public-schedule-status.test.ts tests/unit/public-tournament-stage3-guard.test.ts`
(86 pass on 2026-10-29). ⚠ `components/public/TodaysResultsLine.tsx` and `.module.css` also show as modified: that is
**another session's** Stage 1 follow-up (the line scrolls away), not Stage 3's. Never stage it.

### Kick-off for Part 2 (for a fresh Codex or Claude session)

You are building **Stage 3 Part 2: the phone Schedule**, behind the preview switch, to the drawings and the rulings above.
1. Read, in this order and nothing else unless a step names it: this prompt (all of it), plan §5 "Every page" bullets and
   §10a of `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md`, `AGENTS.md`, `AGENCY_RULES.md`. (`CLAUDE.md` is Claude Code's file; the
   rules in it that matter here are restated below.)
2. Slice the hub frames; **never read the 185 KB hub whole**: frames `#f-sched` (about lines 705–770, with its Playoffs-chosen
   and 1,280 px desk frames) and the "What changed" list under them in `docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_HUB.html`.
   The states are in the states drawing file above.
3. Present the **product-owner UX summary** in the conversation before writing code (AGENCY_RULES; plain language, what a
   family sees and does differently, no file paths). Then build **Part 2 steps 1–7** above with the amendments in this
   section. Reuse Stage 2's parts (`PublicGameRow(s)`, `PublicLiveCard`, `PublicSectionHead`, `PublicDoorRow`,
   `DirectionsLink`, `directionsHref`) and `lib/public-game-row.ts`; build the tap-open "Earlier today" row as a real button
   (`aria-expanded`, 44 px, closed by default). Keep `ScheduleContent.tsx` **byte-for-byte**.
4. Every new part renders only when the switch is on; extend the Stage 3 guard test with a line for each new file.
   **Kept features (step 7) each need a test or a fixture step**: the pinned notice, the `?highlightGameId=` deep link, the
   followed-team auto-jump, the playoff-day stage auto-switch, pool tags, the one-stage rule, the held-back and empty/search
   states, the score-flip and 30 s live merge, the per-division remembered pick. A held-back division's games must appear in
   no chip, fold, search result or deep link (D1).
5. Verify: `npm run verify:changed`, `npm run typecheck` once (`NODE_OPTIONS=--max-old-space-size=8192` if the heap runs
   out), `check:layout --changed` on the Schedule screens **with the switch on**. Start the dev server only with `npm run dev`
   (new files mean a restart before the owner checks). Measure and report the first game row's distance from the top at
   360 and 390 px on the fixtures (the drawing says about 394 px). The owner does the browser checks.
6. **Do not commit** until the owner says so. Work on `dev`; stage **explicit paths only**; other sessions share this working
   copy, so run `git show --stat HEAD` after any commit and confirm only your files landed. Do not touch `.claude/` settings,
   hooks, or database checks.
7. End Part 2 with a one-line note that it is a good place to `/clear`, and where Part 3 starts. Part 3's amendments are the
   rulings above (game-page cancelled/unofficial faces, notes, stakes foot, no-location case, the admin preview's branch).

## Part 2 implementation and handoff (2026-10-29)

The phone Schedule is implemented in `components/public/PublicSchedule.tsx`, reached only through the server's preview
switch, including the admin preview's `isPreview` / `initialData` branch. `ScheduleContent.tsx` is byte-for-byte unchanged.
The new body reuses the shared game row, live card, section heading, door and Directions components. Adjacent rows share
one card; live cards break that card at their time slot. `PublicDisclosure` supplies the real tap-open button, closed by
default on a phone, open on the desk; a highlighted folded result is revealed. Placement-format Final standings stay
above the playoff games. The bracket door's destination and description live together in `SCHEDULE_BRACKET_DOOR`.

The selection model (`lib/public-schedule.ts`) tests All divisions, remembered and followed division picks, deep-link
priority, stage selection, smart day landing, public coach-name search, many-day dates, pool attribution, withheld games,
the final fold and authoritative live replacement. The existing live hook supplies the 30-second cadence and hidden-tab
pause. My games and calendar use Stage 2's `appOnly` class; no follow is removed from device storage. Pinned notices keep
visit-only dismissal. Preview rows have no game or maps destinations and do not poll over their supplied data.

**Verification, 2026-10-29:** full typecheck passed; focused lint passed; 85 focused tests passed after the final
deep-link regression fix. The full suite passed 12,150 tests before that final fix; the combined `verify:changed` then
stopped on three unrelated lint errors in `app/dev/crash-test/page.tsx`. Separately, CSS purity, spelling, public
lettering, palette contrast and text contrast passed. The token gate reported an unrelated new colour literal in
`app/[orgSlug]/admin/tournaments/schedule/page.tsx`; Stage 3's new styles introduce no colour literals. Neither unrelated
file was edited. The single-screen `check:layout --changed --only=pubt-schedule-pale` gate passed at 361 and 390 px,
preview on, with zero findings. No baseline was changed.

**Measured on Lakeshore, preview on:** first visible game **367 px** from the top at **360 and 390 px**, no horizontal
overflow (the hub drawing is about 394 px). The existing `.probe/stage1walk/walk.mjs live` fixture command was run and
read back; Bears at Halton Hawks is the live semifinal. A completed-game deep link was exercised at both widths: correct
division and stage, Earlier today expanded, target visible, `highlightGameId` removed while another query parameter and
the hash survived. This caught and fixed a React Strict Mode mount replay erasing the captured id after URL cleanup.
The dev server was restarted after adding the files; its stale cache was cleared while stopped. The required
platform-admin login returned HTTP 200; the fresh log had no Supabase EACCES failures. Server remains at localhost:3000.

**Owner fixture check still owed (360 / 390; this is not the Stage 3 QA walk):**
- On Lakeshore's Schedule, check the two rows, no browser My games/calendar controls, day chips and the live card in its
  time slot. Open a normal row and return; search a team and a public coach name, clear it, and change divisions.
- Open Earlier today, then close it. Use a completed game's `?highlightGameId=` link: the correct division, stage and day
  should open, including the fold. A remembered division should survive a reload.
- Check a played-out day, a many-day rail, the Playoffs list and its Standings door. Placement standings, where the
  fixture has them, stay above the games; pool tags and pool playoff headings keep their meaning.
- For a pinned notice, dismiss it and revisit: it returns for the new visit. A held-back division says its schedule is
  coming soon and reveals no dates or search results. With all divisions held back, controls disappear and the allowed
  Teams/Register doors remain; the admin preview has none of those destinations.
- Check Cancelled (soft time/names, red chip after the field, no Directions) and Unofficial (amber chip, scores retained).
  The status table and hidden-game cases are unit-tested; use the fixture admin to prepare any additional visual states.
- Optional installed app: with a followed team, toggle My games and export that team's calendar. Browser follows stay
  stored but expose neither control. The admin preview has plain rows and no Directions or game links.
- With the preview off, compare today's Schedule; its original component has no changes. Switch back on before continuing.

Owner authorized the Part 2 commit and Part 3 continuation on 2026-10-29; the visual checklist above remains a separate
check, with no owner pass inferred from that authorization. **Good place to `/clear`: Part 3 starts with a
game's page and the desktop layouts**, using Part 1's amended cancelled/unofficial/notes/stakes/no-location rulings. The
admin Schedule preview branch landed in Part 2; Part 3 checks it rather than building a game-page preview.

## Part 3 implementation and handoff (2026-10-29)

**Part 2 committed `68acfe331` 2026-10-29**, on the owner's instruction to commit and continue. Only its 17 files landed;
the shared TODO was staged from HEAD plus this session's line change so the other sessions' records stayed separate.
The owner instruction did not record a visual pass on the Part 2 checklist.

Part 3 implements `PublicGameDetails.tsx` and its stylesheet, behind the server switch after the published-game lookup.
The existing game body from its division lookup through the end of its JSX is byte-for-byte the Part 2 body, pinned by
the Stage 3 guard. `lib/public-game-detail.ts` supplies the new body's state, names, round, Directions, countdown, facts
and share eligibility. The stakes helper moved there: old callers keep today's text and matching; new callers use a
whole Winner-code reference within the same division and bracket, and singular fan round names. The Schedule takes the
same round/stakes helpers. Only preview metadata/OG wording takes the new names and Championship; the share artwork is
not redesigned. Countdown receives the absolute venue-timezone instant rather than a viewer-local wall-clock string.

The game page leads with time, field, address and primary worded Directions, then the visitor/home score card, then
facts (Notes last, absent when empty). Cancelled keeps the address and soft time with its red chip, has no Directions,
scores or share action, and says "This game will not be played." Unofficial keeps scores/share, has its amber chip and
"Not yet confirmed by the organizer" foot. A venue name without an address still has Directions. No location at all
reads Location TBD and has none. `DirectionsLink` and `ShareScoreButton` have optional primary/icon-only variants;
their default variants retain the old callers' presentation.

At 1,024 px the Schedule's division, track and search use one row, followed by the installed-app-only My games and
worded Calendar when a team is followed. Rows use inline matchups/scores with their context on the right; live rows
keep Live now and worded Directions. Below that breakpoint the phone controls remain. A game's page has location and
score in the left column, facts on the right. The admin Schedule preview uses the same body with no destinations;
it has no game page, so no game-page preview was added.

**Live refresh proven:** the existing 30-second hooks are retained. The new game mode compares a signature including
derived public state, so kickoff/end without a score edit also refreshes; missing/withheld games trigger a refresh
instead of leaving the old game up. The old mode remains score/status-only. On the real new bodies, accelerated browser
timers exercised the actual fetch and router-refresh path: score 3 → 4 updated both bodies; another unchanged poll
caused no extra server refresh; Final moved the Schedule game into Earlier today exactly once with no duplicate ids.
A final-game deep link selected its division/stage/day, expanded the fold and revealed it; the other query parameter
and hash survived cleanup. The fixture was read back after each write and left prepared/live again.

**Fixtures:** `node --env-file=.env.local scripts/seed-public-stage3-fixtures.mjs prepare` extends only the existing
marked Lakeshore development fixture: seven pool-play dates and a scored live semifinal. `show` reads it back; `undo`
restores and verifies its saved original game rows/dates. After prepare, `score`, `final`, `unofficial`, `cancelled`,
`no-score` and `soon` change that same saved semifinal and verify each write. The undo record is in
`.probe/stage3-fixture-undo.json`. Production and an unmarked org are refused. Four new layout entries explicitly wait
for live Schedule, many-day rail, Playoffs and a live game; a missing state fails instead of silently measuring another
page. The original game layout entry also now requires reaching the game's body.

**Verification, 2026-10-29:** full typecheck passed; focused lint passed; the full unit suite passed **12,170** tests;
the final focused public/guard suites passed **257** tests. CSS purity, spelling, date correctness, public lettering,
palette and text contrast passed. The public token scope has zero literal debt. The combined `verify:changed` stops
on three unrelated lint errors in `app/dev/crash-test/page.tsx`; the separately run all-scope token check reports the
unrelated admin Schedule colour literal already noted in Part 2. These files and the shared checks were not edited.
The five Schedule/game layout states passed at **361, 390 and 1280 px: 15 pairs, zero findings**, with the preview on,
one worker, and no baseline change. Source/unit guards retain the server-side publish gates and old-body branch.

**Measured on the prepared Lakeshore semifinal:** Directions starts **289 px down at 360 / 390 px**, **260 px at
1280 px** (drawing about 303 px), with its 48 px height. Also checked 901 / 1023 px: Directions 289 px, phone controls
and stacked facts retained. No horizontal overflow at any of those five widths. At 1280 the select/search share a row
and facts are beside the main cards. The dev server was restarted for the new/shared files; the required login returned
HTTP 200 and the log showed no Supabase EACCES failures.

**Preview/demo limits:** the existing org-owner UAT session opened its own tournament preview (HTTP 200), which had
no game or maps destinations; that fixture had no rows to exercise. The platform-admin session correctly returned to
its separate console and no access rule was changed. The Riverdale demo's preview Schedule says Schedule coming soon:
it has no published game rows, so no demo game body could be exercised. The demo seed was not edited. The switch-off
Lakeshore game uses the legacy body; its Game Details heading is attached but intentionally hidden by the old phone
live chrome. These checks are not an owner visual pass.

**Owner check (360 / 390 / 1280):** use the prepared Lakeshore Schedule and the semifinal named in the fixture read-back.
Check Directions first, visitor then home, team links, the round and share symbol, facts and notes. Use the fixture
commands above for Cancelled, Unofficial, no score and before the game, reading each state back before ticking it.
Check the desktop's one-row Schedule and the game's two columns, plus 901–1023 px. Check the preview with a published
game in an org you administer, and revisit the demo game once its schedule is published. The whole Stage 3 walk is Part 4.

**Good place to `/clear`: Part 4 starts with `/simplify`, then `/review` of Stage 3's own diff, then the QA walk and records.**

## Not in Stage 3 (say so if a step drifts toward one)
The bracket's move, Standings pinning (D5) and the tie-breaker rows (Stage 4). Teams and a team's page, where following a
team lives (Stage 5). Tabs following what there is, the tab order, Rules as tap-open sections (Stage 6). The pay page
(Stage 7). Sponsors strip (side track). The club's rule for its tournaments' look (Stage 1a). Rewiring the six other
copies of the finished rule. A whole-tournament calendar file (the calendar symbol is the followed team's, as today; a
division-wide `.ics` would be new). Emails and link previews.

## Part 4 progress (2026-10-29): /simplify and /review DONE, walk and records owed

**Committed `5f2e3a81a` 2026-10-29** (25 files: Part 3 + the Part 4 fixes; the working copy also holds other sessions'
hunks — `TodaysResultsLine.*`, `TournamentBand.tsx`, `TournamentFrame.module.css`, `TournamentTopTabs.tsx`, `ClubFrame`/
`ClubKit`/`MyTeamCard` CSS, the ticker-fade edit in `public-tournament-stage1-frame-guard.test.ts`, the One Window files,
the band-crowding mockup — never stage those). **Walk written 2026-10-29 as §426**
(https://claude.ai/artifact/AsXYKM4Zn7SaquC4UtEo3F, source `PUBLIC_TOURNAMENT_STAGE3_WALK.html`, 75 steps in 13 parts); the
ledger entry, the plan §9 row and the TODO line carry it. **Walked ✅ 74/75 on 2026-10-29 and recorded in all three** (no
defect; A11, L1, L2 optional skipped; E1 stop check unticked). The fixture is left prepared (the semifinal in play, 3–2).

**`/simplify` applied:** one `requireFinalization` prop on the refresher (unset = today's score/status-only signature; the
guard test pins both branches); one `gameDirections` helper shared by the Schedule and the game page; one face-signature
function; team lookups through one `knownTeam`; the live card's foot takes the stakes helper's own text; the tournament's
finalization rule read one way everywhere (the data layer already lays it over the org's). **Skipped on purpose** (say so
if asked): splitting the game row and live card into separate Schedule components and moving their CSS (a larger
restructure; Stage 8 deletes the old paths); the one-DOM live card; a single-game refresh endpoint (the refresher downloads
the event's payload every 30 s per open game page — worth a ticket, not a Stage 3 change); `next/dynamic` for
`PublicSchedule` (vanishes at Stage 8); memoising the per-row team/venue lookups (about 100k comparisons at 300 games).
`isTournamentInProgress` was NOT reused on the server game page: `lib/follow.ts` is a client module.

**`/review` (4 lenses: correctness, held-back data + security, switch-off regression, live state) — Confirmed and fixed:**
1. *Earlier today re-closed itself 2.6 s after a deep link opened it* (found independently by two lenses); the open row now
   latches, and a tap closes it. (Part 2's check looked right after landing, so it never saw this.)
2. *"Up next" printed above the first upcoming game of every date* and above a long-past unscored game; now today only and
   only for a game that has not started (the drawing ties it to game day after Live now).
3. *Pool playoff headers repeated per time slot* (A, B, A, B); `groupPoolPlayoffs` keeps each division's pool together.
4. The day rail's active chip was not centred on a first load when the page was still "Loading" (effect now waits for ready).
5. A misleading comment on the slot-words function.
**Clean:** held-back divisions (D1) in the game page, metadata, OG image, refresher, search, chips, fold and deep link; the
switch-off Schedule (`ScheduleContent`, its CSS, `TieredBracket`, `ScoreTicker` byte-for-byte empty diff) and the old
game-page body (SHA-256 pinned by the guard); ticker lists; shared buttons' default output; admin preview rows are plain
divs. **Known and accepted, put in the PO summary / walk:** the page's clock moves only on the 30 s poll (a kickoff or a
live→final change can show up to 30 s late; with polling off — a preview, or a page left open from before the event — it
never advances until reload); two polls landing out of order can show an older score for up to 30 s (the shared hook, also
the old Schedule's); a deep link whose game is on the other stage in a one-stage event lands without flashing (rare);
the game page is "enabled" for polling on the server at render, so a page opened the day before the event never starts
polling until reload; the Overview preview's section heads are 44 px tall and its row sub-lines 3 px looser since Part 3
(Stage 2 was walked before); the Overview's bracket slots read "Semifinal 2 winner" under the preview (ruled).
**Gate:** typecheck clean; focused lint clean; 145 focused tests pass (incl. new pool-grouping tests); the rendered layout
check on the live Schedule, many-day, Playoffs and live-game screens: 16 pairs, no new findings. `verify:changed` stops at
`npm test` on a plan-billing test (`plan-panel-host`) that is another session's; run on their own, the public-token,
public-type, CSS-purity, spelling, both contrast, date-correctness checks pass; the admin Schedule colour literal, the
platform-admin dead classes and the demos script's `registration-attention` import are other sessions'.

### Kick-off for the Stage 3 walk (a fresh chat; this is what the owner pastes)

Write the **Stage 3 QA walk** for the public tournament pages — Part 4 step 2 and the records of step 3. Code is committed
(`5f2e3a81a`, Part 3 + the `/simplify` and `/review` fixes; Parts 1–2 are `dda844ef3` and `68acfe331`). Read, in order, and
nothing else unless a step names it: this prompt's **"Part 4 · Simplify, review, the walk, the records"** (step 2 and 3),
**"Part 4 progress (2026-10-29)"** and the Part 2 / Part 3 "Owner check" lists; `AGENTS.md`; `AGENCY_RULES.md`.
`PUBLIC_TOURNAMENT_STAGE2_WALK.html` is the shell (parts, fixtures, a stop check, read-backs on every step that writes).
Do not read the 185 KB review hub whole.
1. Present the product-owner summary first (what the walk proves, in plain words), then build the walk as a checkable
   Claude Artifact (mockups/walks rule: HTML page, paste-back, ONE purpose: *with the preview on, the Schedule and a game's
   page answer where and when; with it off, nothing changed*). Grep `OWNER_QA_LEDGER.md` for the next free § (other
   sessions add §s); write the ledger entry in the §423 style.
2. Cover: controls and day chips on a phone; the Earlier today fold and the live card (use
   `node --env-file=.env.local scripts/seed-public-stage3-fixtures.mjs prepare|score|final|unofficial|cancelled|no-score|soon|show|undo`
   and `.probe/stage1walk/walk.mjs live`); the Playoffs half and its door (points at **Standings**, "On the Standings tab");
   pool headings once per pool; **"Up next" only on game day and only above a game that has not started**; held-back and
   empty states; Cancelled and Unofficial on the Schedule AND on a game's page; a game's page (Directions first at about
   289 px, visitor then home, no stars, "Championship" not "Final", Notes last); the desk (1,280 px and 901–1,023 px);
   **the deep link: open `?highlightGameId=` of a finished game today, wait past 3 seconds, and confirm Earlier today is
   still open and a tap closes it**; the ticker gone from the Schedule and a game's page and still on Standings, Playoffs,
   Teams, a team's page, News and Rules; the admin preview (plain rows, no Directions, no links); the switch off = today's
   pages; the demo. Installed-app steps optional.
3. ⚠ §407's lesson: the walk is the only rendered check. Ask for a read-back on every step that writes (the fixture
   commands print one) and compare the server log with what the owner ticked before recording a pass. Leave the fixture
   prepared/live again at the end, or `undo` it, and say which.
4. Records after the walk is written: ledger entry, plan §9 row (add the walk's §), TODO line. `/docs` and `/demos` wait for
   Stage 8. Do not commit until the owner says so; stage explicit paths only (other sessions share this working copy).
5. Then say Stage 3 is walk-ready and a good place to `/clear`; once he has walked it, next is Stage 4 (Standings +
   Playoffs, where the bracket lands and the door is re-pointed to Playoffs in one edit — `SCHEDULE_BRACKET_DOOR` in
   `lib/public-schedule.ts`) or Stage 1a (who owns the look); name both and let him choose.
