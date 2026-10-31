# Public tournament pages — Stage 5, Teams + a team's page (build prompt, four sessions, for Codex)

> Written 2026-10-30, the day the Stage 4 walk (§428) passed 59/59. Stage 5 of `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md`
> (§9, the "5 · Teams + a team's page" row). **Ruled already:** the Teams and team-page drawings (hub frames `#f-teams`,
> `#f-team`), following = installed app only (2026-10-28), alerts = installed app only (2026-10-27), D1 (a held-back
> division appears nowhere), Ask 8 (one set of state words), Ask 17 (the results line stays on Teams and team pages).
> Stages 1 (frame), 2 (Overview), 3 (Schedule, a game's page) and 4 (Standings, Playoffs) are built; this stage
> **reuses the parts they built**.
> **Everything here is built behind the preview switch**: with it off, customers and the public demo see today's Teams
> list and team page, unchanged. Stage 8 turns it on for everyone, once.
> You are Codex. Read `AGENTS.md` and `AGENCY_RULES.md` first (this repo's Next.js is not the one you know; one shared
> branch `dev`; stage explicit paths only; commit only when the owner says). `/simplify` and `/review` are Claude Code
> commands you do not have: Part 4 says what to do instead.

## What Stage 5 is (one paragraph, so every part shares it)

**Teams** becomes: a search box and a division dropdown that starts on **"All divisions"** (new first choice), then
**the teams grouped by division**, a division with pools keeping its pool groups inside it. **One row per team**: the name
(it wraps, as today), then one quiet line, **record · place · what is next** ("3-0-0 · 1st · Live now vs Cedar Hollow",
"2-1-0 · 2nd · next 12:00 p.m. vs Silver Creek Storm", "1-2-0 · 3rd · no more games"). The row opens the team's page. **The
follow star is the symbol alone, 44 px, and exists only inside the installed app.** What moves, nothing deleted: the
initials tile and the coach line go to the team's own page; points ("6 PTS") live on Standings and the team page; "Pool play
complete" becomes "no more games". **A team's page** becomes: the team's name with its division (and the coach, only where
the club's coach-names rule allows), **the next game first** (time, field, Directions; a **Live now** card with the score
while it is played, **Up next** between games), then **Results** newest first, then **Record · Place in division · Points ·
Run difference** as a list (the four-figure strip moves down), then that division's standings. Later upcoming games list
under the next one as "Next games". Calendar and Share are symbols in one row under the name (44 px each); Follow joins them
**in the app only**; **the alerts bell is app-only and not drawn**. The "Division Champion / Runner-up / In playoff spot"
chip moves onto the name's line. The team-colour wash and the uppercase name go (initials tile, title face, no tints on the
club frame). The drawings: hub `PUBLIC_TOURNAMENT_SITE_REVIEW_HUB.html` (185 KB, **never read it whole**), frame
`#f-teams` (about lines 935–979, with its "What changed" list) and `#f-team` (about 980–1027). Slice them with a short node
script; they are HTML and CSS. Plan §5's "Every page" bullets (lines ~180–220) hold the words.

## How this runs: four sessions, a `/clear` between them

| Part | Covers | Ends with |
|---|---|---|
| **1** | The owner's questions (below) and a small drawing of the states the hub skipped; **the switch plumbing** for both pages and the admin preview decision; the guard test; the held-back division rule (D1) on both pages | Committed; nothing visible with the switch on |
| **2** | **Teams list**, phone and desk: search, division dropdown, grouped rows, the record · place · next line, the app-only star | Committed; owner check at 360/390 (not the walk) |
| **3** | **A team's page**, phone and desk: next game / Live now, Results, the record list, the division standings, the symbol row, the chip; live refresh; the My-team dock decision (question 5) | Committed |
| **4** | Cleanup and review of Stage 5's diff, the QA walk (next free §: grep `OWNER_QA_LEDGER.md`, §428 is Stage 4's, other sessions add §s), the records | Committed, walk written and published |

At the end of each part, tell the owner in one line that it is a good place to `/clear`, and where the next part starts.

**Token discipline (owner, unchanged).** Nearly all of a session's cost is re-reading its own history.
- Read this prompt, plan §5 ("Every page" bullets) and §10a, and the **Stage 4 build prompt's "Part 1 execution" and "Part 4
  execution" notes** (they hold what the owner ruled about one-division-vs-all, the held-back rule's wording and the walk
  shell). Nothing else of the plan unless a step names it.
- **Build to the drawing, but the Stage 1 band, tab row, footer and tokens, and Stages 2–4's shared parts, already exist:
  reuse them, don't redraw them.**
- Delegate wide searches if you have helpers; a summary is a lead, so open the cited lines before you rely on it. (The
  census below was taken 2026-10-30 and two claims were opened and confirmed; line numbers will have moved.)
- Prefer `npm run verify:changed`; `npm run typecheck` once per part (`NODE_OPTIONS=--max-old-space-size=8192` if the
  default heap runs out). `check:layout --changed` only on the screens a part touched, **with the switch on**. Leave the
  dev server running unless AGENTS.md's restart rule applies; new files mean a restart (stop it, then clear `.next`, then
  `npm run dev` with network access) before handing the owner a check.

**Every part:** work on `dev`; stage explicit paths only (other sessions share this working copy, and the tree already
holds uncommitted Stage 4 files: do not stage them); present the product-owner summary **before** writing code (AGENCY_RULES:
plain language, what the family sees, role differences); write to the owner as to a product owner, not an engineer. For a
partial commit out of a file another session has also edited, build the blob from HEAD plus your own lines and diff it
against HEAD before committing. **The owner does the browser testing**; you verify with tests, the type check and the
layout check.

### Rulings this stage stands on (do not re-open them; cite them)
- **Following is installed-app only** (owner 2026-10-28: "follow a team can be on the specific team pages only. We don't
  need too many stars scattered around our app"). In a browser the Teams-list star, the team page's follow control and the
  My-team bar go (plan §10a, "carried to Stage 5"). A stored follow is **never deleted**; the page just does not use it in
  a browser. The `.appOnly` class in `PublicParts.module.css` is the existing mechanism.
- **Alerts only inside the installed app** (owner 2026-10-27): no bell on a team page in a browser, phone or desk.
- **Ask 17:** the results line stays on Teams and team pages (their layout keeps it; do not touch the list in
  `lib/public-ticker-pages.ts` except to prove the test still passes).
- **Ask 8 / D2 / D4:** the moment names are **Live now** and **Up next** only; "No score yet", never a lone dash or 0–0.
- **D1:** a held-back division's games, teams, seeds and bracket appear nowhere. **Stage 4 applied it to Standings and
  Playoffs; Stage 5 must apply it to Teams and the team page, and today neither does** (see "What the code does today").
- **Stage 3 ruled the Schedule's calendar symbol app-only.** See question 3 for the team page's calendar.
- **Stage 1's frame is the frame:** light ground, club type, 12 px minimum, tabular figures, 4.5:1 text and 3:1 edges, 44 px
  taps. `check:contrast`, `check:text-contrast` and `check:public-tokens` run in `verify:changed`.
- **Nothing here reaches a customer before Stage 8.** With the switch off the old pages are byte-for-byte what they were.
- **One spelling, and the clock is "8:00 a.m."** Build times only with `formatTime()`. Grep for the other spelling before
  you write a word with a variant.

## What the code does today (a 2026-10-30 census; re-check before you rely on a line)

**Teams list.** `app/[orgSlug]/[tournamentSlug]/teams/page.tsx` (server; forwards to the org's own address, then renders)
→ `TeamsPageClient.tsx` (13-line wrapper) → `components/public/TeamsContent.tsx` (~550 lines, the real list). **Neither asks
for `frameOn`**; the layout already applies the frame to everything, and today's frame look on these pages is pure CSS keyed
to `[data-public-frame='light']` (about 13 lines in `app/[orgSlug]/teams/teams.module.css`, 19 in `team-profile.module.css`;
the Stage 1 guard test pins that, `tests/unit/public-tournament-stage1-frame-guard.test.ts` ~360–403, and says the
monogram uses `teamInk` only under the frame).
- Today it shows **one division at a time** from a `<select>` that appears only with two or more divisions, remembered with
  `getDivisionPref`/`setDivisionPref`; with two or more pools the rows split under "X Pool" headings; teams with no pool go
  under "Awaiting Assignment". Sorting: by standings rank once a group has played, else alphabetical; **a followed team is
  pinned first in its pool**. Search covers team name and coach.
- A row is a card: 48 px colour avatar, base name, record, a chevron, `· pool`, `rank · pts`, a coach or qualifier line
  (`splitTeamQualifier` moves a trailing "(…)" to the quiet line), a status line, and a **"☆ Follow" button 30 px tall
  (under the tap floor)**. Following jumps the division filter to the team's division; unfollowing opens
  `UnfollowConfirmSheet` and calls `unfollowTeamEverywhere`.
- **No bell and no My-team bar on this page.** The My-team surfaces are `MyTeamDock` (in the tournament layout, mobile, game
  day only), `MyTeamCard` and `DesktopMyTeamRailCard`.
- Visibility: only `isPublicPageEnabled(tournament,'teams')` ("Teams unavailable").
- ⚠ **D1 gap, confirmed by reading `lib/public-tournament-data.ts` (section `'teams'`):** it returns **all divisions and every
  accepted team** and filters only the games (`onlyPublishedGames`). A division whose schedule is held back still shows its
  teams on the Teams list, at 0-0-0 with no games.
- The admin preview (`app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx`, ~123–150) renders the
  same `TeamsContent` with `isPreview` (no star, no link, no chevron). `VALID_SECTIONS` includes `teams`.
- Live refresh: `usePublicTournamentLive` (section `'teams'`), only while the tournament is in progress.

**A team's page.** `app/[orgSlug]/[tournamentSlug]/teams/[id]/page.tsx` (~500 lines, a client component) fetches
`/api/public/team-profile` on load and every 30 s while visible. Siblings: `layout.tsx` (club forward), `opengraph-image.tsx`
(share image, do not change), `team-profile.module.css`. **No admin preview twin** exists for it.
- Order today: back link "All Teams", champion banner, hero (watermark, avatar, uppercase name, division · pool · coach,
  Runner-up / In playoff spot chip), a 4-figure strip (record, pool rank, points, run difference), a form card, then
  "Schedule & Results" (next/live row, last five as W/L/T pips, then live, upcoming soonest-first, finished newest-first,
  each linking to `/schedule/{gameId}`). **No roster, no standings row.**
- Actions (~296–335): follow star, calendar (`downloadTeamScheduleICS`), the bell (`FollowAlertsToggle`, shown when
  `fanAlertsEnabled && !tournamentFinished`), `SharePageButton` (adds `?follow=id`).
- **The API route holds the privacy rules, and they stay exactly as they are:** an accepted team only (404 otherwise);
  games through `onlyPublishedGames`; `scheduleShown` needs the Schedule page on **and** the division not `unpublished`
  (else games `[]`, "No games scheduled yet"); `standingsShown` needs `scheduleShown` and the Standings page on (else the
  record is zeroed); notes stripped; coach name follows `coachNamesShowOnPublic`; cancelled games removed. **A hidden Teams
  page does not hide the team page** (route comment, lines ~32–35).
- ⚠ **D1 gap, confirmed:** a team in a held-back division still loads its own page (name, zeroed record, "No games
  scheduled yet"). The route does not 404 it.

**The switch and the parts to reuse.** Cookie `flhq_public_frame` (default on in development only), read on the server by
`isPublicFrameOn()` (`lib/public-frame-server.ts`). The pattern to copy: `schedule/page.tsx` passes `frameOn` to
`SchedulePageClient`, which returns `PublicSchedule` or `ScheduleContent`; Standings does the same with
`PublicStandings`; the admin preview branches at `[section]/page.tsx` ~76–77 and ~111–112. Shared parts:
`PublicGameRow` / `ScheduleMatchup` / `PublicGameRows`, `PublicLiveCard`, `PublicSectionHead`, `PublicDoorRow`,
`PublicDisclosure`, `TodaysResultsLine`, `lib/tournament-moment.ts` (`tournamentMoment`), `lib/public-schedule.ts`
(`visibleScheduleGames`, `scheduleGames` with `myTeamId`, `selectTeamGames` if present, `divisionPools`),
`TeamFollowStar.tsx`, `FollowAlertsToggle.tsx`, `UnfollowConfirmSheet.tsx`. Follow state is per device
(`lib/follow.ts`: key `fl_follow_team_<tournament>`, one team per tournament; signed-in follows mirror server-side).
Hooks: `useFollowedTeam`, `useAllFollowedTeams`, `useAccountFollowedTeamIds`, `unfollowTeamEverywhere`.

**Tests and screens that pin these pages today.** No file is named after either page. They are held by the Stage 1 frame
guard (Part 4 block), `tests/unit/team-reads-guard.test.ts` (the profile API's hidden pages and unpublished schedules) and
`tests/unit/public-games-guard.test.ts` (the Teams list reads games through `onlyPublishedGames`).
`scripts/layout-screens.mjs` has `pubt-teams-free` and `pubt-team-own` (anon, wait for the band); neither covers game day,
a followed team or a held-back division.

## Part 1 · The owner's questions, the states the hub skipped, the plumbing

0. **Ask the owner (one `AskUserQuestion`, recommendations first; these are the real open ones):**
   1. **A held-back division on the Teams list, and on a team's page** (the D1 gap). *Recommended:* with the switch on, the
      Teams list **omits** a division whose schedule is held back (and its teams, and its place in the dropdown and search);
      a team's own page in a held-back division, reached by a link that already exists, shows **the team's name and division
      and one sentence ("The schedule isn't published yet") and nothing else**, because a team's registered parents already
      hold the link and a "not found" page reads as a broken site. Alternative: the team page also says not found. Read
      Stage 4's execution notes first and **match what Part 1 of Stage 4 did for a direct visit**, so the four pages agree.
      The old pages are not touched either way (tell the owner this fixes the new pages only; the same gap exists today).
   2. **"All divisions" first, or one division at a time.** The drawing shows "All divisions" first. Stage 3 ruled it for the
      Schedule; Stage 4 asked its own version. *Recommended:* **All divisions first, the family's remembered division
      (the same pick the Schedule uses) ignored on Teams unless they set one here**, search always across what is shown.
      Alternative: the remembered pick, else the first division.
   3. **The team page's calendar symbol in a browser.** Stage 3 made the Schedule's calendar app-only; the team page's
      downloads one team's games to the phone's calendar and works in any browser. *Recommended:* **app-only, same as the
      Schedule**, so there is one rule. Alternative: keep it in a browser (the drawing shows three symbols: Follow, Calendar,
      Share, and says only Follow and the bell move to the app).
   4. **Where "what is next" comes from on a Teams row** when a team has no game today but has one later: "next Sat 9:00 a.m.
      vs …" (the weekday when it is not today or tomorrow). *Recommended:* the drawing's wording, plus the weekday and date
      for a game later than tomorrow, built with the shared date helpers, never a hand-typed format.
   5. **The My-team dock and cards in a browser.** `MyTeamDock` (phone, game day) and the desk rail card show a followed
      team's next game from a stored follow. Following is app-only, so in a browser they have nothing honest to show.
      *Recommended:* **frame on: hidden in a browser, kept inside the installed app**, done where the layout mounts them and
      pinned by the guard; the old frame-off behaviour is untouched. Alternative: leave them for Stage 8 (a browser family
      with an old stored follow would still see a dock, which contradicts the ruling).
   6. **What a team that is out of the tournament shows where "next game" was.** *Recommended:* nothing in that slot (absent
      beats empty), the Results list leads, and the name's chip says what happened ("Eliminated" is **not** a word in the
      product today: grep first; if it is not there, say nothing and do not invent it). A champion team shows a
      "Champion" line first, as the Overview and Playoffs do after the final.
   Also tell the owner (do not ask): the **desk** layouts for both pages have no drawing and are derived from the phone
   cards in the Overview's two columns from 1,024 px (shown for his yes at Part 3, in a ruling step of the walk, as I2 was
   in Stage 4); the admin preview adopts the new Teams body with no star and no links, and **there is no team-page
   preview twin** (not asked for); the coach line keeps today's coach-names rule exactly.
1. **Draw the states the hub skipped, as one small page, before building them** (CLAUDE.md: mockups are Claude Artifacts,
   whole-screen, true size; if you cannot publish an Artifact, write the page as HTML in `docs/projects/active/` and tell the
   owner so he can have it published and run through `/design`). The drawings are silent on:
   - **Teams:** the empty state ("No teams yet" and "Teams unavailable"), a **search with no match**, a division with
     **pools** and one with **no pool assigned** ("Awaiting assignment"), a **very long name** at 360 px (the drawing has one),
     a team **with no games published**, a row **in the app with the star** (filled and empty) next to the same row in a
     browser, and the sort order (rank when played, else A to Z).
   - **A team's page:** a team **with no games** (before the event or held back: question 1), a team **between games** (Up
     next), **live with no score yet**, a team **with only results** (out of it or finished), the **champion** and
     **runner-up** chips, a **pool** team's place wording ("1st of 4 in Pool A"), a **playoff game** row (the Playoff tag), a
     **TBD opponent** ("Semifinal 1 winner"), the app's symbol row (Follow filled, Calendar, Share) next to the browser's
     (Share only, or Share and Calendar per question 3).
   Present it, get the owner's yes, then build Part 2 to it.
2. **The switch plumbing, for both pages.** Teams: `teams/page.tsx` asks `isPublicFrameOn()` and passes `frameOn` to
   `TeamsPageClient`, which renders the new body (name it e.g. `PublicTeams`) or today's `TeamsContent`, **left
   byte-for-byte**. The team page is a client component under a `[id]` route: pass the switch down from its server layout or
   a thin server `page.tsx`, **without changing what today's page renders**; branch to a new body (e.g. `PublicTeamPage`)
   and leave today's JSX untouched below. Add the **guard test** now, in the Stage 4 guard's style
   (`tests/unit/_source-code.ts`), and extend the Stage 2 `FRAME_ONLY_USERS` list: switch off = the old bodies byte-for-byte;
   switch on = the new ones.
3. **The admin preview.** The Teams preview branch (`isPreview`) adopts the new body: no star, no link that acts, no follow
   mark. No team-page preview.
4. **Extract, don't fork.** (a) One helper "a team's next game and what to call it" (live / up next / TBD teams / nothing
   left / champion) for both new bodies, with its unit tests, reusing `selectTeamGames` / `scheduleGames` rather than the old
   pages' duplicate logic. (b) One helper for the Teams row's third line (record · place · next / no more games). (c) The
   place wording ("1st", "1st of 4 in Pool A"), shared by the row and the page.
5. **The D1 rule, server-side, for the new bodies.** Teams: filter the held-back divisions' teams **in the data the new body
   is given** (a frame-on branch in the Teams section of the public-data reader, or a filter the new body's server wrapper
   applies; never client-side hiding of data already shipped, which is exactly D1's original defect). Team page: the API
   route already withholds games and the record; add the rule the owner picks in question 1 **only for the frame-on caller**,
   without altering what the old page receives. Pin it with a test, the way `team-reads-guard.test.ts` pins the route.
6. **Live refresh.** Check the Teams payload carries what the new row needs (next game per team, standings place, published
   games only). Reuse `usePublicTournamentLive` and say how a live game or a final score changes a row while the page is
   open. The team page keeps its 30-second poll; do not add a second one.
7. Verify, then the `/clear` note. Say that nothing is visible yet with the switch on.

## Part 2 · Teams list, phone and desk

1. Build to the drawing and the owner's yes on the states: the search box and the division dropdown (first choice "All
   divisions"), division groups with a quiet heading and a team count, pool groups inside, one row per team, the row's third
   line, and the **star as a 44 px symbol alone, `.appOnly`**. The row is one tap target to the team's page; the star is a
   separate tap target that does not navigate. Reuse the Stage 2–4 row and heading parts where they fit.
2. **Sorting:** by standings place once the group has played, else A to Z on the base name. ~~The followed team's pin to the
   top~~ **No pin (ruled 2026-10-30, see "Part 1 revision")**: a followed team keeps its place; the star alone marks it.
3. **Long names** wrap, they are never cut with an ellipsis; the qualifier "(…)" goes to the quiet second line as today.
   Check the drawing's long U13 name at 360 and 390.
4. **Search** covers name and, only where coach names are public, coach (today's rule); a no-match state per the drawing.
5. **Desk:** from 1,024 px, rows in two columns by division, or the Overview's two-column recipe; whichever the drawing for
   the Overview used, so a family sees one desk rhythm. Say which, for his yes at Part 3.
6. Keep: the results line (Ask 17), the "Teams unavailable" state, the year selector staying off, the admin preview.
7. **Measure** at 360, 390 and 1,280: first team row top (the drawing prints 4 of 8 teams on the first screen at 360, 3 at
   390), no sideways scroll, no tap under 44 px. `check:layout --changed` with the switch on. Verify; commit only on the
   owner's word after his phone check.

## Part 3 · A team's page, phone and desk; live; the dock

1. Build to the drawing: name + division (+ coach where allowed), the chip on the name's line, the symbol row, **next game
   first** (Live now card with the score, or Up next with time, field and Directions; the card reuses `PublicLiveCard` and
   the shared row), **Results** newest first (each row opens the game's page, like today), the **record list** (Record, Place in
   division, Points, Run difference), the **division's standings as ONE DOOR, "U11 standings ›", not an embedded table (ruled 2026-10-30, see "Part 1 revision")** and
   "Next games" when more than one is left. Nothing in the old strip or form card is deleted from the data: the pips go, the
   figures become the list.
2. **The symbol row** per questions 3: Follow (filled when followed, with the existing unfollow sheet), Calendar and the bell
   exactly as ruled, Share (adds `?follow=id` as today). **44 px each, one row.** App-only ones are `.appOnly`.
3. **The dock and My-team cards** per question 5, wherever the layout mounts them, pinned by the guard.
4. **Live:** a game going live, a score arriving and a final landing change the card and the list while the page is open,
   without a duplicate row; use the existing 30-second poll. A champion crowned while open updates the first block.
5. **Desk:** two columns from 1,024 px, main then side, one DOM order (the Stage 2 desk rule).
6. Keep: the share image, the club forward, "All Teams" back link (restyled), the privacy rules in the API route unchanged.
7. **Measure** at 360, 390 and 1,280: the next game's top (the drawing prints 352 px at 360), no sideways scroll, no tap under
   44 px. **Fixtures:** extend the reserved, marked Stage 4 fixture set (`scripts/seed-public-stage4-fixtures.mjs`, modes
   include prepare | score | final | withhold | withhold-all | undo) or add a sibling script with the same safety rules (only
   marked clones, refuses other databases, every write read back); Stage 5 needs at least: a team playing now, a team between
   games, a team with only results, the champion, a held-back division's team, and a pool team. Say which you did.
   Verify; commit only on the owner's word after his check.

## Part 4 · Cleanup, review, the walk, the records

1. **Cleanup pass** on Stage 5's own files only (duplication, unused code, one next-game rule and one place wording across
   both bodies). **Then an adversarial read of the whole Stage 5 diff.** If you have no review command, do it by hand across
   these lenses, or stop and tell the owner to run Claude Code's `/simplify` and `/review` on the committed range:
   - **D1:** a held-back division's team in the Teams list, the dropdown, search, a count, the team page, the standings on
     the team page, or the share image.
   - **The switch-off pages** changing by one word or pixel (old Teams, old team page, the Stage 1 frame guard's Part 4
     block, `team-reads-guard`, `public-games-guard`).
   - **Following:** a star, a follow control, a pinned row, the dock or the bell showing **in a browser** with the switch
     on; a stored follow lost or rewritten; the follow jumping the division filter wrongly.
   - **Shared CSS** changed under the old pages: `teams.module.css` and `team-profile.module.css` outside frame-keyed rules.
   - **Live state:** a score arriving, a game going live, a champion crowned; a stale "Up next".
   - **Privacy:** notes, email, payment status or admin notes reaching the new page; per-user data in cached HTML.
   - **The admin preview** showing a star or a link that acts.
2. **The QA walk**: one purpose, *"with the preview on, Teams answers which teams are in and where each stands, and a team's
   page answers when my team plays next and how it has done; following and alerts are in the app only; a held-back division
   appears nowhere; with the preview off, nothing changed"*. A checkable Artifact in §428's style
   (`PUBLIC_TOURNAMENT_STAGE4_WALK.html` is the shell: parts, fixtures, stop checks, a read-back on every step that writes,
   the Copy summary, Reset, a ruling step for the desk). **Grep `OWNER_QA_LEDGER.md` for the next free §.** Parts to cover:
   the Teams list on a phone (grouping, the third line, long name, search, no match); All divisions and the dropdown; sorting;
   the row's two taps (page, star), the star absent in a browser; a team's page in each state (live, between games, results
   only, champion, no games); the symbol row in a browser; held-back division on Teams and on a team's page; the dock gone in
   a browser; the desk and 901–1,023 px; the results line still on both; the admin preview (Teams only); the preview off is
   today's pages; the demo. **Keep installed-app steps optional (they were skipped in Stages 1, 3 and 4).** ⚠ §407's lesson:
   the walk is the only rendered check; ask a read-back on every step that writes, **and give every part a verdict control the
   owner must set (§428's Part K came back ticked with no verdict)**. Leave the fixture prepared or undone and say which.
3. **Records:** plan §9's Stage 5 row (commit hashes, walk §), the `TODO.md` line (one line; detail in the plan), the ledger
   entry, `memory`'s status line. `/docs` and `/demos` wait for Stage 8.
4. **Then tell the owner Stage 5 is done and a good place to `/clear`.** Next is Stage 6 (tabs follow what there is: News,
   Rules, Register, Champions) or Stage 1a (who owns the look); name both and let him choose.

## Not in Stage 5 (say so if a step drifts toward one)
Tabs following what there is, the tab order, News, Rules as tap-open sections, Register and Champions tabs (Stage 6). The pay
page (Stage 7). The sponsors strip (side track). The club's rule for its tournaments' look (Stage 1a). Retiring the old
bodies and turning the switch on (Stage 8). **The app's own pages** (Discover, Scores, Following, Account: a separate
follow-on, plan §10a). A team-page preview in the admin. A roster on the public team page (none exists; not asked for). Any
change to how standings are computed or to the team-profile API's privacy rules: those are not touched, only where their
words are shown. **The database-level public read on games** (separate follow-up with `/db`).

## Part 1 execution · 2026-10-30

**Owner direction:** execute this prompt; the owner then accepted all six recommendations in the question form.
Teams starts on All divisions, independent of Schedule's remembered pick. Held-back divisions and their teams stay
out of the new Teams list, counts, dropdown and search. An existing direct team link gets only name, division and
“The schedule isn't published yet”. Calendar is app-only, like Schedule. Games after tomorrow name the weekday and
date. Browser My-team docks/cards will be hidden at their mounts in Part 3, retaining installed-app behaviour and
the old frame-off behaviour. A team with only results leads with Results; a winner has Champion first. Desktop
follows the Overview's two columns from 1,024 px, for the owner's Part 3 decision. Coach-name privacy is unchanged.

**Drawing:** `PUBLIC_TOURNAMENT_STAGE5_STATES_DRAWINGS.html`, 21 whole-screen specimens, with 360/390 px controls.
It covers browser/app rows and actions, long name and qualifier, rank/A-to-Z order, pools and awaiting assignment,
empty/unavailable/no-match/all-held-back Teams, the admin preview, and team pages between games, live, scoreless live,
results-only, champion, runner-up, pool place, TBD opponent, later games, no games and a direct held-back link.
Pool labels reuse today's `formatPoolName` wording (“A Pool”); this stage introduces no second pool-name convention.
The HTML script's syntax was checked. This environment has no Claude Artifact publisher: the local source is ready
for the owner to have published and reviewed through `/design`. **Owner drawing approval precedes Part 2.**

**Preview foundations implemented:** both server pages ask `isPublicFrameOn()`. Teams selects `PublicTeams` or the
unchanged `TeamsContent`. The team route is a thin server page selecting `PublicTeamPage` or `LegacyTeamProfile`;
the latter is the entire previous client page copied byte-for-byte beside its original stylesheet. The existing
server layout still forwards to the club's own address. Hash guards pin both legacy bodies and both stylesheets.
Stage 2's frame-only consumer list includes the two new bodies. No product CSS or ticker page list changed.

At this Part 1 checkpoint **neither new body draws its list/game/results layout**: these render `null` until Parts
2–3, apart from the approved direct-link message and a not-found state. This avoids mounting the old Teams reader
inside the new body: that reader has its own legacy live poll and would bring held-back teams back into the browser.
The old pages still render as before with the switch off. No stored follow is read, deleted or rewritten by the new
bodies. No follow, calendar or alert controls are drawn yet.

**Server boundaries:** the separate `teams-preview` section keeps the old `teams` contract intact. Both initial
loads and live replacements call `publicTeamsData`, reusing Stage 4's `publishedCompetitionData` to remove held-back
divisions, teams, games and standings/seeds before the response. Game notes are removed from this new payload too.
The admin Teams preview uses that same boundary and, in its frame-on branch only, reads the published games and
canonical standings the new rows will need. It has no polling, links or stars; no team-page preview was added.

The profile API's direct-link exception requires **both** `publicFrame=1` and the server preview switch. It runs
after the existing club/tournament/accepted-team checks and before standings/game shaping, returning an explicit
identity whitelist. Without that opt-in, including when the cookie is off, the existing API response and its
Schedule/Standings/coach-name/privacy rules are unchanged. The share-image route is unchanged.

**Shared rules:** `lib/public-teams.ts` selects a team's live/next/empty/results-only/champion moment through the
existing `scheduleGames`, `selectTeamGames` and tier-aware playoff completion rule. It resolves duration in the
existing game → division → tournament → default order, keeps TBD opponents readable and excludes cancelled games.
One helper supplies meaningful division/pool places, suppressing arbitrary ranks before that group has played;
unassigned teams do not borrow a pool's rank. Another builds record · place · next using the shared clock and date
helpers. The old bodies retain their existing calculations; no standings engine changed.

**Live hand-off:** `PublicTeams` uses `usePublicTournamentLive` on `teams-preview`, replacing the authoritative
payload rather than merging stale rows. Part 2 will recompute each quiet line on those replacements, so a live
start, entered score or final changes the row without restoring removed divisions. `PublicTeamPage` owns one
non-overlapping 30-second profile poll, paused while hidden with catch-up on visibility. It replaces the response,
including a newly held-back identity; Part 3 draws the card/results/crown from it and must not add a second poll.
Part 3 will extend the reserved marked-clone fixture script; no Stage 5 fixture script was needed in Part 1.

**Verification tier: type-aware, with explicit limits.**

- 245 focused tests pass: the new moment/place/summary/server-boundary tests and Stage 1/2/4, team-read and public-game
  guards. Both legacy source hashes and both original stylesheet hashes pass.
- Full `npm run typecheck` passed. A repeat after the final note-stripping/admin-preview refinements was stopped
  when free memory fell too low during other sessions' TypeScript work. The final focused suites pass.
- Focused lint passed; the profile API retains its existing unused `_notes` warning. Spelling, palette contrast,
  text contrast and all public-token scopes pass. The drawing's inline script parses successfully.
- `verify:changed` ran all 12,578 unit tests: 12,575 passed, three unrelated failures stopped the chain before its
  later gates. Findings: `free-time-story.test.ts:99` (stale-end/write ordering), `plan-billing-usage.test.ts:112`
  (503 instead of 200), and `support-console-stage3-guard.test.ts:564` (the bookkeeping expense window's foot).
  Those concurrent feature files and shared checks were left alone. Log: `.probe/stage5/verify-changed.log`.
- The requested focused layout command targeted only `pubt-teams-free,pubt-team-own`, with the development preview
  default on. Its memory preflight refused to start at 179 MB free against the unchanged 1,536 MB floor. **No layout
  measurement or baseline was produced; this is a failed check.** Its bootstrap reported re-anchoring its standard
  probe game before preflight. Product body measurements remain for Parts 2–3; `pubt-team-own` currently reaches a
  team through Teams, so it cannot measure a team body while Part 1 intentionally draws no list. Log:
  `.probe/stage5/layout.log`. Do not represent the empty shell as a measured team page.
- The workspace dev supervisor and verified descendants were stopped before deleting the verified workspace `.next`
  cache. Restarted through `npm run dev` with network access; Ready confirmed, the required platform-admin login
  returned HTTP 200, and neither server log contains a Supabase `EACCES` fetch failure. The server is running.
- Read-only requests against the existing Metro fixture confirm `teams-preview` filters divisions, teams, games,
  standings and notes at the API boundary. That fixture currently has no held-back team, so the direct-link exception
  is covered by the whitelist unit test and route guards, without claiming a live held-back-fixture verdict.

The drawing and foundations are ready for owner review. No commit was made: this prompt reserves commits for the
owner's explicit word. After approval, Part 2 starts at the Teams list; the drawing can be published and reviewed
without loading the unfinished product bodies. This is a good place to `/clear`, carrying this execution note forward.

## Part 1 revision · 2026-10-30 (owner: "mark off your recommendations", after a /design review of the drawing)

**The drawing was revised and its six open calls were ruled as recommended.** Build to the revised
`PUBLIC_TOURNAMENT_STAGE5_STATES_DRAWINGS.html` (26 specimens); where it and an earlier line of this prompt disagree,
**the drawing and this section win.** Part 2 may start; the drawing approval this prompt reserved is given by these
rulings plus the owner's "mark off your recommendations".

**Ruled (as recommended):**
1. **No pin.** A followed team keeps its standings place in the Teams list; only its filled star (app only) marks it.
   Replaces Part 2 item 2's pin.
2. **A team that is out says "No more games"** in one quiet 14 px line under its name, above Results (results-only state).
   The words already exist on the Teams row; no new status word. The runner-up specimen is drawn without the line:
   build it only for the drawn state and ask in the walk's ruling step whether a runner-up wants it too.
3. **Search with no match** reads "No teams match" + "Try another team name or choose All divisions. Teams appear once their
   division's schedule is published." In that state only. It must never name a division or reveal a count.
4. **Standings on a team page are one door**, "U11 standings ›" ("U11 standings · A Pool" for a pool team), 56 px tall, opening
   the Standings tab. **No embedded table, so the new team page does not need the standings payload** (leave the profile API
   as it is). Supersedes "the division's standings (the shared Standings table, the team's row marked)".
5. **A failed refresh stays silent**, as today. Not built in Stage 5; record it as a follow-up in the plan's §9 row.
6. **The record keeps today's pool-play figures**, no new label.
Also ruled as drawn: the proposed loading / not-found / couldn't-load wording (below); the team being read first and bold on a
game card; division headings at 18 px.

**What the drawing now says that a build would miss:**
- **Place wording is within the group:** the record list's label is "Place in U11" or **"Place in A Pool"** with "1st of 3";
  the Teams row says "1st of 3 in A Pool". One helper, both places.
- **Team page order:** identity (+ chip) → symbol row → [Live now / Up next] → [Next games] → Results → record list → standings
  door. A champion's gold-edged "Champion · U11" card comes first (after identity). The chip stays on the name's line and wraps
  under the name when the name is long; test long names with a chip at 360.
- **A game card puts the team being read first and bold**, the opponent plain (a pending opponent, e.g. "Quarterfinal 2
  winner", plain). The card's round reads "Playoff · Championship", and **Results uses the same round label, placed under the
  opponent** ("vs Cedar Hollow Cyclones" / "Playoff · Championship"), never in the date column. The date column is 56 px.
- **Later games:** tomorrow's says "Tomorrow", anything later names the weekday and date ("Sun, Nov 1"), via the shared date helpers.
- **The star keeps one accessible name** ("Follow Riverdale Rapids") and says on/off through its pressed state only; never swap the
  label. **Unfollowing opens the existing UnfollowConfirmSheet** (its words are in the drawing); following is one tap.
- **New team-page states, built in `PublicTeamPage` (it owns its fetch):** loading = a quiet line "Loading team…" under the back
  link; **not found** (a 404: team not accepted or wrong link) = "Team not found" / "This team isn't in this tournament."; **couldn't
  load** (a network or server failure on the first load) = "Couldn't load this team" / "Check your connection and try again." +
  a Try again button. Today both failures read "Team not found."; the new body must tell them apart. Back link "‹ All Teams" on all three.
- **Teams empty and every-division-held-back:** no search box and no division selector, only the state card. "Teams unavailable" unchanged.
- **Teams row copy:** lowercase after the dot ("no games scheduled yet", "no more games", "next …"). The held-back direct link's one
  sentence is body size (16 px) and ink colour, not 14 px grey.
- **Headings:** a team page's section headings are h3 under the team name's h2.
- **Verify before building the symbol row:** the Stage 1 band may already carry a Share icon on every page (design log 2026-10-28,
  Q2 "Share once"). Read the band's code. If it does, the team page's Share needs a label that says it shares **the team**
  ("Share this team") and the walk should check the two cannot be confused; do not drop the team Share without asking.

**Measurements this drawing prints (360 px, for Part 2 and 3's checks):** first team row top 285 px; first next game top 375 px
(the earlier hub frame printed 352 and the symbol row costs the difference); no sideways scroll at 360 or 390; no tap under 44 px.

**Still not decided, and not Stage 5:** the desk layouts (Part 3's ruling step), a failed-refresh sign, a pool-play label on the record.

## Part 2 execution · 2026-10-30

**Owner direction:** “drawings have been reviewed and updated, go ahead with part 2”. Built to the revised 26-state
drawing and Part 1 revision above: **no followed-team pin**, 18 px division headings, stable star names, lowercase
row copy, the expanded no-match sentence, and no filters on empty/all-held-back pages. Part 3's revised team-page
door, wording, game order and Share ruling remain its build target; no team-page body was built in Part 2.

**Implemented:** `PublicTeams` now draws the division dropdown (All divisions first), search, division headings and
counts, named pool groups and Awaiting assignment, and wrapping team rows. The qualifier gets its own quiet line.
`teamsGroups` sorts a played group by its canonical standings order and an unplayed group A to Z on the base name;
whether a group has played is assessed before search narrows it. Neither sorting nor the initial/filter selection
reads a saved division or uses a follow. Search reads only the public team's name and already-permitted coach name.

Each row is a link to that team's existing route. Its 44 px star is a separate target, wrapped in the existing
`.appOnly` class, with a stable “Follow {team}” name and `aria-pressed`. Device/account follow state uses the existing
hooks; unfollow opens `UnfollowConfirmSheet` and confirms through `unfollowTeamEverywhere`. Both write handlers also
check installed display mode. Following changes neither the row order nor the division pick. The admin preview
renders plain rows with no links, stars or confirmation sheet and makes no preference writes.

The row reuses `teamMoment`, `teamPlace` and `teamRowLine`. A team's live game reads Live now; a final changes the
record/place and next-game wording on the same authoritative refresh. Full names wrap, never ellipsize. No avatar,
coach line, points label, year selector, alerts control or new ticker is introduced. The existing results-line
placement/page list is unchanged. Empty, unavailable and no-match states reuse `PublicTournamentState`, locally
styled to the approved cards; the old state/body styles are untouched. Initial fetch failures offer Try again;
failed background refreshes remain silent as ruled.

**Held-back data:** the existing server filter remains the boundary on both initial load and replacement feeds.
`teamsWithheld` is a preview-only yes/no derived on the server, so all-divisions-held-back can use its approved
sentence without shipping a hidden name or count. The legacy `teams` response does not gain this field. Withdrawn
divisions fall back to All divisions, and a removed team's pending unfollow confirmation disappears. The admin
preview receives one serialized clock value with its filtered data to keep its first render consistent.

**Desktop proposal:** division groups use the Overview's 1.35:1 columns, 28 px gap and 28/32 px page padding from
1,024 px. Each division keeps its pool groups together. One DOM order serves phone and desktop; 901–1,023 px stays
one column. The desktop arrangement is presented for the owner's Part 3 ruling, not recorded as approved here.

**Verification tier: type-aware, with focused rendered and geometry assertions.**

- 261 focused tests pass: the Stage 5 helpers/real rendered body/guards plus Stage 1/2/4, team-read and public-game
  guards. Coverage includes rank versus alphabetic order per pool, qualifier/coach search, no pin with a followed last
  team, stable pressed-state stars, full names, preview without links/stars, empty/all-held-back with no filters,
  preserved legacy source/styles, and server-only filtering. Focused lint and full `npm run typecheck` pass.
- Tokens, public lettering, CSS-module purity, spelling, palette contrast and text contrast pass. The global CSS
  selector check reports four orphan references and ten dead classes in other areas; none is in a Stage 5 file.
  No baseline or shared check was changed to silence them. The full-project unit suite was not repeated after
  Part 1's unrelated failures; the focused suite covers this part and the public visibility/privacy guards.
- Headless geometry assertions at 360, 390 and 1,280 pass: no sideways scroll, no visible Teams control below 44 px,
  full 16 px names and 18 px division headings, no uppercase names/headings. The first row begins at **253 / 253 /
  236 px** on the Metro fixture; desktop columns measure 540 / 400 px. These are product measurements on the current
  fixture, not the drawing's 285 px. The drawing includes a results line; the fixture's existing ticker follows its
  own public game data. Evidence: `.probe/stage5/part2-measure.json` and `part2-measure.mjs`.
- Automated control assertions pass: All divisions ignores a remembered Schedule pick; division filtering; full
  name/qualifier/permitted-coach search; no match with no group count; stars absent in a browser; stored follow
  unchanged; a live row becoming final updates its record and “no more games” once; a selected division and its rows
  disappearing on authoritative refresh. Long-name/live/final/removal data are browser-only response overrides of
  the marked Metro fixture: no database fixture was changed by these assertions.
- Chromium's media emulation did **not** enable installed display mode. Real installed-app star/sheet interactions
  are therefore optional owner verification, not claimed tested. Markup, stable labels, sizing rules and canonical
  confirmation handlers are covered by the rendered/source guards. No fake CSS override was used as an app verdict.
- `check:layout --changed --only=pubt-teams-free` completed its two pairs (361/1440), with the development preview on.
  Desktop passes; phone reports **five findings in the shared free-plan promotions**: attribution link 19 px high,
  setup link 34 px high, Dismiss 30 px high/wide, and the attribution badge overlapped by the setup banner. The shared
  source `components/marketing/tournament-growth.module.css` declares those existing 34/30 px controls and fixed
  offsets. These components are outside the new Teams body and remain unchanged, preserving the old pages. The
  layout gate is **not a pass**; no baseline was rewritten. Evidence: `.probe/stage5/part2-layout.json` and `.log`.
  The untouched team-page placeholder was excluded from this part's layout target.
- After the new stylesheet/shared-module changes, the verified workspace dev process tree was stopped, its verified
  `.next` cache cleared, and `npm run dev` restarted with network access. Ready and the required platform-admin login
  HTTP 200 confirmed; neither server log contains a Supabase `EACCES` fetch failure. The server stays running.

**Owner phone check:** preview on, `/stage1-metro-sports/stage4-live/teams` at 360 and 390; the long-name fixture is
`/stage1-metro-sports/stage4-eight/teams`. Review the list, search and division/pool groups; the destination team page
remains Part 3's placeholder. Free-plan promotion findings can be seen at `/stage1-northfield/fall-ball/teams`.
Commit only on the owner's explicit word after the phone check. This is a good place to `/clear`; Part 3 starts with
the revised team-page drawing, the one existing poll, the standings door and browser My-team suppression.

## Part 3 execution · 2026-10-30

**Owner direction:** “go ahead with part 3”. After inspection showed the old response had no group size, venue
addresses or visibility flags, the owner explicitly approved **“Add preview-only metadata to the existing response”**.
This is the narrow exception to Part 1 revision's “leave the profile API as it is”: legacy callers and privacy gates
stay as they were; the new caller gains public presentation metadata, **not a standings table or roster**.

**Built to the revised drawing:** back link; initials/name/division/pool and permitted coach; chip on the name line
wrapping underneath when long; one 44 px symbol row; the next game first (Live now or Up next); Next games when any;
Results newest first; record list; one 56 px division-standings door. Section headings are h3 under the team's h2.
The team's side leads the shared game card in bold, the opponent plain, independent of home/away or score lead.
The card and result row share “Playoff · Championship” wording; Results puts it under the opponent, with a 56 px
date column and no year. The record retains the existing pool-play figures. Place wording is the same helper as
Teams, exposing “Place in A Pool · 1st of 3” here and “1st of 3 in A Pool” there. No embedded table or form pips.

`PublicLiveCard` has an explicit team-page variant reusing its existing card branch; existing Playoffs/default
rendering stays intact and its real-rendered tests pass. Later-game dates and all times use the shared helpers.
The champion card is first after identity; a results-only team has the quiet No more games line. Runner-up omits
that line as drawn; the walk still asks whether the owner wants it there too. With no games the page keeps identity
and Share, then the approved empty card, without an empty record or standings door.

**Actions and privacy:** Calendar and Follow use `.appOnly`; following uses the existing device/account hooks and
the existing unfollow confirmation. Both write handlers check installed display mode. The bell is not drawn.
The band already has Share, confirmed in its code: the team action is explicitly **Share this team**, retaining
`?follow=id` and the current-address/club-forward behaviour. `SharePageButton`'s new optional accessible label keeps
its original default for other callers. The original share image and legacy team body/styles are unchanged.

**One profile request/poll:** the API's `publicFrame=1` caller plus server switch receive the extra `preview` facts:
meaningful group place, record visibility, finalization rule, canonical completed-division crown/runner-up, public
division durations, crown stamp and each shown game's field/venue/Directions. Existing reads and the existing
standings engine supply them; no additional database round-trips or client metadata reader. Record and crown obey
the existing Schedule/Standings gates, and coach-name sanitizing remains at `toPublicTeam`.

`teamProfilePreview` strips held-back opponents from the name map and replaces their display names with fan-worded
placeholders. `publicFrameGame` strips notes and score-submission identity/source/timestamp from new-frame games;
legacy DTOs keep their original shape. Crossover selection uses all relevant published divisions and each game's
own duration before that division and the tournament default. These rules have focused regression coverage.

The page retains one non-overlapping 30-second poll, hidden-tab pause and visibility catch-up. It distinguishes an
initial 404 from a network/server failure, offers Try again for the latter, and keeps the last good view through a
failed background connection/server refresh. An authoritative 404 clears removed-team data; a held-back response
replaces the body with the exact identity exception. State is keyed to the route to prevent showing the previous
team while the next loads. Scores, finals, chips, next game and lists update from one authoritative replacement.
A changed crown stamp refreshes the shell. No second profile timer or separate metadata poll was introduced.

**Browser My-team/follow surfaces:** `PublicAppOnly` combines the existing CSS display-mode class with an actual
installed-only mount, so a browser does not fetch a hidden card's legacy data or open its portal. The frame-on layout
uses it for the dock, deep-link prompt, account-follow nudge and account-follow hydration; the frame-on rail uses it
for the desk card. The server passes the rail its frame flag explicitly, avoiding an initial context-default mount.
Frame-off branches retain their old mounts/props. `MyTeamCard` occurs only in legacy bodies; new bodies mount none.

Installed-app dock/rail reads use the new `schedule-preview` feed, gated on Schedule and filtered at the server by
the same published-division boundary; the follow-link prompt uses `teams-preview`. Legacy readers default to their
original sections. The network check found the **results line also fetched the old Schedule payload**, including
held-back team names. Its frame-only caller now opts into `schedule-preview` through the existing shared hook;
`ScoreTicker` keeps the default legacy feed. No results-line placement, behaviour, style or page list changed.

**Desktop proposal:** the Overview's 1.35:1 columns from 1,024 px, main (game/later games/results) then side
(record/standings door), with one DOM order. From 901–1,023 px the phone arrangement remains. This is implemented
for the owner's ruling in the walk, not recorded as approved by this session.

**Fixtures:** added the sibling `scripts/seed-public-stage5-fixtures.mjs`. It refuses every database except the known
development project, verifies the marked Stage 4 source and fixture organization, reserves new identities before
inserting, and writes only marked Stage 5 clones. Updates check the target's parent against the owned clone and use
that parent in the write; undo deletes only owned clones in dependency order. Every insert/update/delete is read
back; timestamp comparisons normalize equivalent UTC spellings. A partial preparation was safely undone before a
successful preparation. The results-only link selects a real participant with results; a separate no-games fixture
covers an accepted team without games. Original Stage 4 fixtures and demo records were not changed.

Modes: `prepare | show | refresh | score | no-score | between | final | withhold | publish | undo`.
`refresh` re-anchors the prepared states; score/final/publication modes act only on the reserved live clone and read
back every changed field. Use `publish` before `refresh` to reverse a live-clone withholding test. The separately held
clone stays held back. Identities live in `.probe/stage5-fixtures.json` so the owner/Part 4 can resume safely.

Prepared review links (prefix `http://localhost:3000`):

| State | Path |
|---|---|
| Live | `/stage1-metro-sports/stage5-live/teams/05b9fe07-2d9f-4d6b-9955-a4198f096ea0` |
| Between games | `/stage1-metro-sports/stage5-between/teams/25c27e68-e784-472f-9fab-96114634781f` |
| Results only | `/stage1-metro-sports/stage5-results/teams/0a8913e4-cf8e-49e5-8146-f8b41b7c9b3c` |
| Champion | `/stage1-metro-sports/stage5-champion/teams/0683fd3b-14d5-497b-be60-604e25a33774` |
| Held back | `/stage1-metro-sports/stage5-held/teams/493679cd-bbee-4093-a0c3-6b4870b17a95` |
| Pool | `/stage1-metro-sports/stage5-pool/teams/61b2071a-2090-43d9-8411-00304ef93c79` |
| No games | `/stage1-metro-sports/stage5-empty/teams/f351b737-2678-4296-bed8-0aaf2e511ffc` |

The runner-up is the champion fixture's final opponent (derived and verified by the API/render probe, without an
eighth clone). Final fixture state is **prepared**, refreshed after testing: live 5–3, between-games future, champion
crowned, held division unpublished, pool and no-games examples available. Source fixtures retain their own state.

**Verification tier: type-aware, plus focused API/rendered/live/geometry assertions.**

- **293 focused tests pass**, including profile metadata and real rendered body, shared moment/place/search, Stage
  1/2/4/5 guards, existing Playoffs renderer, public team privacy/publication and ticker page list. Both legacy source
  and both original stylesheet hashes pass. Full TypeScript and focused lint pass; the route retains its existing
  unused `_notes` warning. Public tokens/type, CSS purity, spelling, palette contrast and text contrast pass.
- API checks cover all seven clones plus runner-up, no game notes/scorekeeper identity/team private fields, exact
  held-back identity whitelist, and **identical legacy responses** for published and held-back teams with the switch
  off versus an old caller with the switch on. Preview metadata is absent from those legacy responses.
- **Twelve state/width pairs** pass focused geometry checks: 360/390/1280 for live and between-games, plus 390 for
  results, champion, held-back, pool, no games and runner-up. No sideways scroll or visible team-page tap below
  44 px; own side bold/opponent plain; held-back sentence 16 px. Long names and chips wrap. Next-card tops on the
  long-name live/between fixtures: **444 / 415 / 346 px**. A separate check after fonts/results line settled confirms
  the same positions. The shorter-name drawing target is 375 px. Evidence: `.probe/stage5/part3-measure.json`,
  `part3-stable-geometry.json` and `part3-measure.mjs`.
- Real reserved-clone writes and the open page verify scoreless live → score → final/crown (one result row) →
  withheld identity → republished/live. One profile request occurs per 30-second tick. A background 503 leaves the
  live view intact; hidden-tab simulation makes no request; visibility catches up. Initial 404 and initial 503/retry
  display their distinct approved states. Browser `?follow=id` opens no follow prompt, no dock/rail card mounts, and
  stored follows remain unchanged. Browser requests contain no legacy `schedule`/`teams` feed. Real installed-app
  interaction is **optional owner verification**, not claimed tested.
- `check:layout --changed --only=pubt-team-own,pubt-teams-free --workers=1` completes all four pairs. **Team page
  passes at 361 and 1440.** The combined gate still fails on the same five free-plan promotion findings on Teams
  recorded in Part 2; no baseline was changed. The global CSS selector gate still reports four orphan references
  and ten dead classes outside Stage 5; none is in this part's files. Logs: `.probe/stage5/part3-layout.log`,
  `part3-layout.json`, `part3-css-selectors.log`. Full repository unit verification was not repeated over those
  concurrent feature changes; this part's focused suites and full types are the verification anchor.
- The final shared-reader/privacy changes were followed by the required stopped-server/cache-clear/restart through
  `npm run dev` with network access. Ready and the required platform-admin login HTTP 200 confirmed; no Supabase
  `EACCES` appears in the server logs. The completed focused run did not abort; the server remains running.

The team page and fixtures are ready for the owner's phone/desktop check. Commit only on the owner's explicit word
after that check. This is a good place to `/clear`; Part 4 starts with Stage 5-only cleanup/adversarial review, then
the owner walk (grep the ledger for its next free section) and final records.

## Part 4 · Owner acceptance and review follow-up · 2026-10-31

The owner returned walk §432 PASS with 60 of 60 checked; O1–O3 were optional and skipped. Teams desktop and
team-page desktop are explicitly approved as built. The separate team Share was removed on the owner's direction;
the runner-up retains its drawn chip without an additional No more games line.

The owner then requested correction of the eight review findings. All eight corrections are implemented; the
resolution table is `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` §13. Verification: 680 tournament-focused tests pass,
full TypeScript passes, focused lint has no errors (one existing `_notes` warning in the profile API), and the public
token/type, CSS purity, spelling, contrast and date gates pass. §432 records the exact scope, logs and owner rechecks.
The required dev restart through `npm run dev` with network access completed; login HTTP 200 and no Supabase
`EACCES` confirmed. Read-only API checks pass; development fixtures remain as the owner left them.

The original owner walk acceptance and the subsequent fixes' automated checks are separate records. Browser
verification of the corrections is owner-owned. Next is Stage 6, or Stage 1a as the plan permits.
