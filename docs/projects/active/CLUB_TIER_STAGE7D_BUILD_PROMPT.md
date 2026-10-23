# Club Tier Stage 7d: the coach's Tournaments (build prompt)

> **Written 2026-10-22** after Stage 7c's walk §359 passed 40/40 (HEAD `e3bc3dae3`). Ruling: Stage 7 round 1, **Asks 8-12, option A
> each**, plus **Ask 13 A** (design log `memory/design_decisions.md`, 2026-10-20 "STAGE 7 ... THE COACH'S TOURNAMENTS AS A ROW LIST
> AND ONE PAGE", "Decision (7d ...)" ~L190; the asks themselves are in `docs/projects/active/CLUB_TIER_STAGE7_DRAWINGS.html`
> ~L1163-1218). **Paste this into a new chat on `dev`.** This prompt is **7d only**; 7a, 7b and 7c are built and walked. Ask 13: **7d
> gets its own checkable walk page**, one purpose per walk, a § in the Owner QA Ledger (**§359 was the last on 2026-10-22**; other
> sessions take numbers, so check the ledger's last § right before you write the entry).
>
> **No new design session is needed.** Drawings 6 (the list), 7 (the page) and 8 (the road back from the Schedule) are drawn,
> design-checked and ruled. Build to them. Where this prompt says a drawing is silent, wrong or in conflict with the code, build to
> the prompt and say so in the hand-off. **Four items below (Put to the owner 1-4) are decisions the drawings did not make. Ask
> them first, and do not build the part one touches until it is answered.**

## What 7d makes true

A coach opens **Tournaments** and sees a **row list**, not a stack of cards: **Coming up** and **Finished** bands, the date in
front, the tournament's name with a chip only where the chip says something ("Waiting on them", "Accepted"), the host under it, a
chevron last, "Fan view of every tournament" under the list. It no longer runs off a phone.

A coach opens one tournament and the page is **titled by the tournament**, not the team: one status chip, **Games on your
Schedule** (a door that opens the Schedule on the tournament's first day), **Your games**, **Standings**, one **Registration**
card (Fee, Check-in, Questions, Registered), **Head coach for this event**, **From the organizer** as rows, and a help door.
About 1,350 px tall on a phone instead of 2,175, every control 44 px or more, two columns on a computer. From the Schedule, a
tournament game's sheet has a row that **leads back into the tournament page inside the portal**; the public page stays one tap
further as Fan view.

**The head coach for an event autosaves on the page.** The head coach and the team manager see the form; an assistant reads a
line; **the server refuses everyone else** (today it refuses nobody: see Corrections 1).

**Game rows read the booking's clock and say "6:00 p.m."**, "Playing now" uses the one shared rule, "vs" is home and "at" is away
everywhere, and the page's breakpoints join the product's (640 / 768 / 900).

**Every one of these lands in the free portal too** (Ask 12): one page, two shells. The free shell's header names the tournament,
the team under it.

## Read first

- **Drawings and rulings:** https://claude.ai/artifact/MLqvD7TXbLM5QX8H9mmapZ (source `CLUB_TIER_STAGE7_DRAWINGS.html`).
  Read, in this order: "Today" stations 5, 6, 7 (~L472-515); drawing 6 `#e-list` (~L838); drawing 7 `#e-rec` (~L887, 390 and 1440,
  with its role notes ~L944-946); drawing 8 `#e-road` (~L1008); "The build carries" under 7d (~L1037-1038); the design-check
  changes that touch 7d (~L1062-1074); the flagged findings T1-T12 (~L1277-1299); Asks 8-13.
- **The row-list recipe:** `docs/projects/active/COACH_ROW_LIST_RECIPE_PLAN.md` (§3 the recipe, §4.1 `CoachRowList`, §10 the B1
  build record and its traps) and the portal formatting standard §3.10. **The list uses `components/coaches/CoachRowList.tsx`
  (`CoachRowList`, `CoachRowBand`, `CoachRow`). Never a second row class** (recipe rule 9; `table-recipe-guard.test.ts` and
  `check:layout`'s `list-ground` rule enforce the ground). Ask 8 also means the recipe's B2 session drops this list from its list:
  record that.
- **7b's hand-offs** (`CLUB_TIER_STAGE7B_BUILD_PROMPT.md` ~L51, L142, L159-161): the club's own team gets no email, so the coach
  learns of its entry **from this list**; "c2, the stamped paid figure on a bulk-marked own team, stays 7d"; 7b made the record and
  the Schedule mirror show the entry for the working-season team and said "7d reworks those screens". Plan §6 Stage 7 "7b BUILT"
  has its found-not-fixed (the coaches-portal "Add my team" window still offers Paid/Unpaid on a plan with payment tracking though
  the database refuses a fee for that team; the bulk Mark paid email path for our team untraced; **games reaching the coach's
  Schedule not exercised: the fixture has no games set, so give it some**).
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **CLAUDE.md binds you: broad reading goes to a helper agent, and a helper's summary
  is a lead, not evidence.** The leads below were gathered 2026-10-22 at HEAD `e3bc3dae3`; the load-bearing ones (marked
  **verified**) were re-opened by the main session. Re-read before you rely on any other.
- **Binding from CLAUDE.md, the Coaches Portal ruling:** a team with no live season has **one door** (the closed-season page);
  the Tournaments list and record are live tools and stay **this season only**. **Do not add a year parameter to any route or
  page** (`HISTORY_ENDPOINTS` in `tests/unit/coach-history-endpoint-guard.test.ts` fails the build). The free portal's team list
  is lifetime today; leave that as it is and do not widen the paid one.
- `docs/agents/db/DATA_DICTIONARY.md` and `npm run refresh:snapshots` if (and only if) you add a migration. **None is expected.**
  If you find you need one, say so before writing it.

## The ruled spec

| Part | Ruled | Drawn |
|---|---|---|
| The list | A row list in the recipe: banded **Coming up / Finished**; on a phone the name with its chip beside it and the date riding the caption line ("Nov 6-8 · Guelph Minor Ball"); on a computer the date is a plain leading column, the name and chip, then the host, chevron last; rows 56 px or more; a long name wraps inside its row; the intro line gone; **Fan view of every tournament** under the list; **Tournaments you run** stays below for those who can run tournaments. | drawing 6 |
| The chips | A chip **only where it says something**: Waiting on them, Accepted (and the lifecycle chips the list has today where they say something). A finished row has none; its caption ends "2nd of 4" (Put to the owner 2). Chips in typewriter capitals as the recipe's chip, never sentence-case pills. | drawing 6, design-check |
| The page | Titled by the tournament; meta line = team · dates · host; tab title "Invitational 2026 · 15U AAA"; one status chip under the title (plus the countdown "In 10 days", or "Finished · 2nd of 4", or "Playing now"); no tinted hero; no second "Accepted". | drawing 7, T1, T4 |
| Door rows | **Games on your Schedule · 4 games · opens on Sat Oct 17** is a **plain door row** (recipe 3.10.7), not a coloured-rail row; it opens the team's Schedule on the tournament's first day. **Your games** and **Standings** side by side on a phone (Standings in a 44 px box). | drawing 7, T6 |
| Registration | One card: Fee ("No fee · your club's team" for our team; "$475.00 · paid Sep 12" or "Deposit paid · $375.00 owing" for a visiting entry), Check-in, Questions (the organizer's contact), Registered (one short date form, on the club's clock). **No Status row** (it left for the chip). An assistant without money access sees no Fee row, as today. | drawing 7, T4 |
| Head coach for this event | Name \* and "Email the organizer uses" (placeholder "Your sign-in email"; hint "Acceptance, payment and schedule updates go here. Blank uses your sign-in email."); **autosaves**, a transient "Saved" pill; a form only for those who may (Put to the owner 1); everyone else reads "Head coach for this event: Jordan Lee". | drawing 7, Ask 10, T5 |
| From the organizer | Rows: Tournament home, Rules, Share this tournament; "No announcements from the organizer."; three rows on a computer. | drawing 7 |
| One help door | In the top bar; opens the Tournaments help. | drawing 7, T3 |
| Two columns on a computer | Inside the 960 reading column: games left; Registration and the event's head coach right. The date leads each game row ("Oct 17 · 6:00 p.m."). | drawing 7 |
| The road back | On a mirrored game's sheet, one row: "<Tournament name> · The organizer sets the time, place and score". It opens the **portal's** tournament page. Organizer-owned fields (time, place, opponent, score) read as theirs; the coach's own stay editable (arrival, uniform, attendance, lineup). The public page stays one tap further. | drawing 8, T6 |
| Clocks and words | Game rows on the booking's clock and "6:00 p.m." (`formatTime()`, never a hand-built label); Registered and announcement dates on the club's clock; "Playing now" by the shared game-status rule; "vs" home / "at" away in rows, the change notice and the calendar file; breakpoints 640 / 768 / 900. | Ask 11, T7-T10 |
| Both portals | Every change above lands in the free portal's list, record and Schedule sheet; the free shell's header names the tournament with the team under it. | Ask 12 |
| Help | The Tournaments article gains the page's help door and the road to the games. | `/docs` |

The words are `/marketing`'s: build the placements, flag every sentence. Copy the drawings use that the build keeps verbatim is
listed under "Words" in the drawings' notes (~L1049); "Waiting on them", "Our team", "No fee" and "Games on your Schedule" are
placements, not final copy.

## Put to the owner at the start (do not guess)

1. **⚠ The rule for who may edit the head coach is not a role, and in a club it does not reach the team manager.** Ask 10 says
   "a form only for the head coach and the team manager". But the code's standing rule (`lib/coach-capabilities.ts` ~L418) is that
   **nothing is gated on the staff label** ("Team manager" is a preset, not a role): access is one grant at a time. The grant
   the owner already ruled for "enter the team in someone else's tournament" is **`registerTournaments`**: always true for a head
   coach, **on in the Team manager preset** (and backfilled to existing managers, mig 329), off for an assistant by default.
   That is exactly "head coach and team manager". **But** the grant is written off for a **club's** teams
   (`applyOrgGrantPolicy`, a club's entries being the club admin's, 7b), so in a club the form would show for the head coach only.
   Options: **(a, recommended)** the head coach and anyone holding `registerTournaments` may edit; **in a club, only the head
   coach**, and the page's line says who to ask ("Ask the head coach to change this"); a standalone Premium team gets head coach
   + manager as ruled. **(b)** a new grant for this one field (a new switch on every staff screen; heavy for one text field).
   **(c)** the head coach plus anyone holding Manage staff (a master key the manager preset has; reads wider than the field
   deserves). **A free team (not Premium) has no staff grants:** its signed-in member is the owner and counts as the head coach
   (verify `userOwnsBasicCoachTeam`, `lib/basic-coach-teams.ts`, and say what a second member of a free team can do).
2. **"2nd of 4" on a finished row.** Drawing 6 captions a finished row "Oct 17-19 · Your club's tournament · 2nd of 4". The
   record already computes a division standings snapshot (`getStandings`, `CoachTournamentRecord.tsx` ~L528, skipped when the
   organizer hides standings, and for a bracket-only event). The **list** has no such read, and doing it per finished row is a
   standings computation per row. **(a, recommended)** the finished row shows it only when the standings are public and the
   division has a round robin, computed once per tournament and cached per list load, and **absent otherwise** (no placeholder,
   no "-"); **(b)** the list never shows it (the page does); **(c)** as drawn, always. Say what a long list costs.
3. **The free portal has two lists.** The team's list (`app/coaches/team/[basicTeamId]/tournaments/page.tsx`, lifetime) and the
   **account hub** (`app/coaches/tournaments/page.tsx`, grouped by team, its own "Active & Upcoming / Past Tournaments" bands and
   its own CSS). Ask 12 says "the same row". **(a, recommended)** both use the recipe row; the team's list gets the two bands; the
   hub keeps one list per team under the team's name, each with the same two bands (the hub's bespoke CSS retires). Say if you
   would rather the hub flatten to one list with the team as a caption.
4. **A required field that autosaves.** The event's head-coach name may not be blank (the route rejects it, and the
   edit-autosaves rule ruled 2026-09-24 is "edit autosaves"). Recommended: **a blank name is not sent**; the field shows "Enter a
   head coach name." in place and keeps the last saved name; the "Saved" pill appears only after a real save; **clearing the email
   is a save** (blank reverts routing to the sign-in email, as today, and the hint says so).

## Corrections to what the drawings and plan said (verified in code 2026-10-22)

1. **Verified: the head-coach save checks no role.** `PATCH /api/coaches/tournaments/[teamId]`
   (`app/api/coaches/tournaments/[teamId]/route.ts`) authorizes through `requireCoachRegistrationAccess`
   (`lib/coach-team-guard.ts` ~L53), which passes **free-team membership** or **any rep-team assignment that passes
   `canOpenTournaments`** (`lib/coach-registration-access.ts` ~L99-122; `canOpenTournaments = canConfigureTeam || registerTournaments`,
   `lib/coach-capabilities.ts` ~L707). An assistant with schedule editing, who opens the page, can rewrite the head coach. The
   roster-submit route (`.../roster/route.ts`) uses the same guard: **say whether it needs the same rule** (it commits the roster
   to the organizer; recommended: yes, the same predicate, but put it to the owner in the hand-off, do not silently widen).
   The server fix is one predicate used by the page (to draw the form or the line) and the route (to refuse), so the screen and the
   server cannot disagree (as `buildRegistrableTeams` does). A test fails if they can.
2. **Verified: the Schedule's only road is to the PUBLIC page, in a new tab, and only for an active or completed event**
   (`components/coaches/ScheduleEventSheet.tsx` ~L724-739, "View on the tournament page"). There is no link to the coach's own
   record (`.../tournaments/{registrationId}`). 7d adds it; the club-linked team may have **no free-team shadow**
   (`basicCoachTeamId` null), so find the registration through the mirror's source game, not through the shadow
   (`lib/coach-registration-access.ts`, `lib/rep-tournament-game-mirror`).
3. **Verified: "Playing now" has two rules.** `CoachLiveSchedule.tsx` (~L276-309) calls a game LIVE when `status === 'submitted'
   && date === today` (a score entered today); the shared rule is `isGameLive` in `lib/game-status.ts` (~L52, a time window from the
   game's start and length). **A second copy of the narrower rule sits in `lib/basic-coach-teams.ts` ~L1213** (`liveGame`):
   find what reads it (the free portal's hero or overview) and move it too, or say why not.
4. **Verified: game dates and times are spelled by the device, not the product.** `CoachLiveSchedule.tsx` ~L107-122 are "client
   twins" calling `toLocaleDateString('en-CA')` / `toLocaleTimeString('en-CA')` on the device's clock; and ~L367 draws "vs"/"@"
   where ~L447 draws "vs"/"at". Use `formatTime()` (`lib/utils.ts`), the org-zone helpers in `lib/timezone.ts`
   (`formatInOrgZone`, `tournamentNow`, `tournamentToday`, `orgDayKey`) and the booking's own zone, never a new formatter.
   The clock gate (`check:spelling`) matches "8:00 a.m." and the narrow no-break space; `en-CA` returns the right token natively,
   which is why only hand-rolled builders were wrong before.
5. **The record's "Registered" date and the announcement dates format on the server's clock** (`CoachTournamentRecord.tsx`
   ~L884), so an evening entry can read as the next day. Move to the club's clock (the one helper above).
6. **The calendar file ("Add the games to a calendar") says "@"** where the notice says "at". Find the builder
   (`lib/calendar-feed-response.ts`, the record's .ics route) and make it one word with the rows.
7. **Verified: the paid list is this season only; the free team list is lifetime.** Keep both; the "Finished" band means finished
   *within what the list reads*. Never imply a lifetime history on the paid list.
8. **The record has no tests at all** (none on the list page, on `HeadCoachEditor` or on the record's structure). 7d adds them
   (Definition of done 6).
9. **`CoachTournamentRecord` is one 958-line server component shared by both portals through flag props**
   (`hideHeader`, `suppressUpsell`, `moneyRedacted`, `allowAssignmentAccess`, `backHref`). The free route
   (`app/coaches/tournaments/[teamId]/page.tsx`, where `[teamId]` is the **registration** id) also redirects a standalone Premium
   entry to the paid record. Do not fork it: **one page, two shells**. The defaults of the free flags must not move.

## Leads (all under the repo root; line numbers approximate)

| Need | Where |
|---|---|
| The paid list (a client page; gate `canOpenTournaments`; loads `tournament-history`, then `hosted-tournaments`; five empty states) | `app/[orgSlug]/coaches/teams/[teamId]/tournaments/page.tsx` (330 lines); API `app/api/coaches/[orgSlug]/teams/[teamId]/tournament-history/route.ts` (redacts `amountDue` when money is hidden) |
| The row card today (title, meta [org, entry name, dates], lifecycle chip, Fan view) | `components/coaches/CoachRegistrationCard.tsx` (+ `.module.css`); lifecycle `lib/coach-tournament-lifecycle.ts` (`sortByCoachLifecycle`); Fan view `lib/coach-alert-registration.ts` (`resolveRowFanView`) |
| The data shape (add any new list column HERE, with the matching money redaction in the history route) | `getBasicCoachTournamentHistoryForRegistrationIds` (the one assembler), `getBasicCoachTournamentHistoryForTeam`, `getMergedTournamentHistoryForRepTeam` (the two bridges), `getBasicCoachTournamentTeamsForUser`, `getRegistrationGamesForTeam` (all `lib/basic-coach-teams.ts` ~L706-1530); `lib/rep-tournament-season-scope.ts`, `lib/coach-registration-access.ts`, `lib/rep-team-tournament-links.ts`, `lib/coach-tournament-games.ts` |
| The free lists | `app/coaches/team/[basicTeamId]/tournaments/page.tsx` (96 lines, a server page, shows an "N entries" count and a ScopeShelf at 2+ live entries); `app/coaches/tournaments/page.tsx` (237 lines, its own CSS, its own `RegistrationCard` wrapper) |
| The record | `components/coaches/CoachTournamentRecord.tsx` (+ `.module.css`: breakpoints 600 / 901 today); zones `TournamentStatusBlock`, `CoachLiveSchedule` (polls every 30 s on game day, 120 s before), `TournamentRosterSubmit`, `HeadCoachEditor` (143 lines; explicit Save, "Head coach updated."); the paid route `app/[orgSlug]/coaches/teams/[teamId]/tournaments/[registrationId]/page.tsx`, the free route above |
| The head coach's storage | `teams.coach` (nullable) and `teams.coach_email` (mig 124) on the registration row; `teams.email` is the claim key and **never touched**; the route rejects an empty name, caps 120, validates the email, refuses platform-admin addresses, and a cleared email reverts routing to `teams.email` (`resolveCoachRecipient`, `lib/email.ts`). **Keep every one of those rules** |
| Our team owes no fee | `lib/club-own-tournament-team.ts` (`isOurTournamentTeam`, called ~L210 in the record); `tests/unit/our-team-one-answer-guard.test.ts`. Fee signals are flattened for `moneyRedacted`, for a tournament that does not track payments, and for `clubOwnTeam` |
| The Schedule sheet and its mirror | `components/coaches/ScheduleEventSheet.tsx` (~L724 `sourceBlock`, `mirroredGameHref`); `app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx` ~L1011 (`tournament-games` API); `lib/rep-tournament-game-mirror`; `lib/basic-coach-teams.ts` ~L1330 (the public game URL) |
| Nav (sidebar and More sheet are pinned equal by a test; a label is keyed in `coach-nav-visibility`) | `components/coaches/CoachesSidebar.tsx` ~L96; `CoachesBottomNav.tsx` ~L80 (a More-sheet row, **not** a bar tab; the owner chose Lineups, Skills and Money for the hot row); `lib/coach-nav-visibility.ts` ~L273; the free portal's `CoachFreeBottomNav.tsx` ~L84, `CoachPortalShell.tsx` ~L68, `lib/coach-free-nav.ts` ~L77. **A new door label must be mirrored in every one** |
| The page header and the help door | `tests/unit/coach-page-actions-guard.test.ts` ~L333-338 (page header and help host); the coach's help `lib/help-content/coaches.tsx` (section `tournaments` ~L833-940, `faq-premium-tournaments-where` ~L941, `faq-premium-run-tournaments` ~L960, `faq-overview-one-tournament` ~L73). `lib/help-content/tournaments.tsx` is the organizer's, not this |
| Guards to read first | `coach-own-team-entry-guard`, `coach-read-gates-guard` (~L53), `coach-nav-groups` (~L136), `coach-free-bar-guard`, `coach-tournament-games`, `coach-tournament-grant`, `tournament-game-mirror`, `coach-history-endpoint-guard`, `table-recipe-guard`, `chat-pause-guard`, `our-team-one-answer-guard`, `kit-dialog-foot-text-guard` if a window changes (all `tests/unit/`) |

## Hard parts (design these before you write)

1. **One edit predicate, two readers.** Decide it once (Put to the owner 1), in one function the page and the route both call.
   The page draws the form or the line from it; the route refuses with it. A test enumerates head coach, manager, assistant,
   helper, a club's head coach, a club's manager, a free team's member and a stranger, and fails if the page and the route ever
   disagree. `staffKindLabel` is **never** the input.
2. **Autosave on a record that routes mail.** The head coach's name and the contact email drive acceptance, payment and schedule
   emails. An autosave that fires per keystroke can send a half-typed address to the organizer's mail. Save on blur or after a
   short pause with validation first (the email must pass the route's own check), never on every keystroke; the "Saved" pill is
   transient (decision `decision_autosave_word_is_transient`: "Saved" fades, only an error persists). Two tabs open: the last
   write wins, as today; say so.
3. **One row, two lists, both portals.** The paid list is a client page that fetches; the free lists are server pages that read.
   The recipe's `CoachRow` is the one row; the data shape comes from the one assembler. Put the caption/chip/lead decisions in
   **one mapping function** both lists call (a record in, `{lead, title, caption, trail}` out), tested, so the phone and computer
   faces and the two portals cannot drift (a `table-recipe-guard` family test for the new rows). The lifecycle chip, the status
   badge and the "Waiting on them" word come from one place.
4. **The page's order is the story, and two columns are a layout, not a second page.** Build the phone order first (drawing 7,
   top to bottom), then place the same sections into two columns at the computer width. No section exists in only one layout.
   The page is **~1,350 px on a phone and every control is 44 px or more**: measure both, in `check:layout` and by eye, against
   the 12 under-44 px controls the page has today (back link 22, ⇄ 31, View final standings 19, Share your team 29, organizer
   email 38, See all 19, two inputs 42, four pill links 32-36).
5. **The road back must find the entry.** From a mirrored game to the registration: through the mirror's source game and the
   team's link (both bridges: the workspace's `basic_coach_team_registrations`, or the club's `rep_team_tournament_registrations`;
   a club-linked team may have neither shadow nor workspace). A game whose entry the coach can no longer open (a team moved,
   a season closed) must **not show a dead row**: absent, not disabled, per "hide the entry point rather than dead-end".
6. **"Games on your Schedule" opens the Schedule on the tournament's first day.** Decide how the Schedule takes a day in its
   link (it may already: look before adding a parameter) and what it shows when the tournament's first day is in a different
   season than the working one. A year parameter is a decision (CLAUDE.md); a **day** is not, but say which you used.
7. **The clock is one helper, the live rule is one function.** Replace the device-clock twins and the second live rule rather
   than adding a third; delete what they retire (the dead-selector gate and the CSS-module checks will demand it). A test that a
   game at 6:00 p.m. on a booking in another zone reads "6:00 p.m." from a device in a third, and one for an evening
   "Registered" date that must not read as the next day.
8. **The free shell's header names the tournament, the team under it.** The free route passes `hideHeader` today and the paid
   shell supplies its own header: decide where the title lives once, in the shared record, and make both shells show it.
   The tab title ("Invitational 2026 · 15U AAA") must read the same in both. Check the free portal's phone bar (Overview ·
   Tournaments · Chat · More, at 900 and below) still marks Tournaments active on the record and the list
   (`coach-free-bar-guard`).
9. **Chat is paused.** `CHAT_PAUSED` strips chat wording from the list's empty states; keep that conditional in any copy you
   touch (`chat-pause-guard`). The list's five empty states (loading, merged choice card, "No tournaments yet this season",
   standalone "Your tournament season lives here", club "No tournaments linked yet") **were not drawn**: keep their meaning, move
   them into the recipe's empty-state shape, and show them to the owner before the walk.
10. **Money display stays redacted.** Hidden money must stay hidden in the list's caption and in the page's Registration card for an
    assistant without money access (the history route redacts `amountDue`; add any new figure to the same redaction and a test).

## Definition of done

1. **The list** (paid, both portals' lists) at 390 and 1440: the recipe's bands and rows, chips only where they say something,
   a long name wrapping inside its row, Fan view under the list, Tournaments you run below, every empty state kept in meaning.
   `check:layout --changed` on the touched screens (`--workers=1`; **do not run the whole-product sweep on dev**).
2. **The page** at 390 and 1440: titled by the tournament, one chip, the door row, Your games and Standings, one Registration
   card, the head coach block, From the organizer as rows, a help door; ~1,350 px on a phone, every control 44 px or more; two
   columns on a computer. Warm and dark.
3. **The head coach**: autosave with the transient pill; the form for those the rule names; the line for an assistant; the route
   refuses a non-entitled caller with a plain sentence (the page never offers what the server refuses); every existing rule kept.
4. **The road back**: the sheet's row on a mirrored game (paid and free Schedules), the "Games on your Schedule" door, and the
   absent-not-dead rule for an entry the coach cannot open.
5. **The clock and the words**: no hand-built or device-locale time or date label on the touched screens; "6:00 p.m."; "Playing
   now" by the shared rule in both portals' readers; "vs" and "at" in rows, the notice and the calendar file; breakpoints on
   640 / 768 / 900 in the touched stylesheets only (do not sweep other screens' CSS).
6. **Tests** (the record had none): the edit predicate matrix and the page/route agreement; the list mapping (phone and
   computer faces, both portals); the redaction; the live rule; the clock cases; the autosave's validation (a blank name is not
   sent, a bad email is not sent, a cleared email is); the road back's lookup and its absent case; `HISTORY_ENDPOINTS` unchanged
   (**no year parameter added**); the nav pins unchanged; `check:spelling` green.
7. **Access and data**: a head coach, a manager (standalone), an assistant with schedule editing, a helper, a club's head
   coach, a free team's member and a stranger, on the UAT coach fixtures (`uat-rep-club` and a standalone), read and write as
   Ask 10 and Put to the owner 1 settle, the route proven on dev. The fixture needs **games** on a tournament entry (7b found
   none): add them to the fixture and record that.
8. **Gates**: `npx next typegen` then `npm run typecheck` (shared modules); `npm run verify:changed`; the guards listed above;
   `check:layout --changed` at 390, 768 and 1440 on the touched screens; `check:css-selectors` after the retirements;
   `check:demos` (the coach demo's tour may anchor on these screens; the build fails if an anchor stops existing).
9. **Records**: plan §6 Stage 7 "7d BUILT" (departures, found-not-fixed), the plan's open 7d checklist item (~L2450), TODO, the
   design log for each new ruling (Put to the owner 1-4), the recipe plan (B2 drops this list), the Owner QA Ledger § (check the
   last number), the project index (`ArtifactData`, artifact `MBKRySURVFu3V9cZJvmjVr`, `stages/s7` + a log row; **read first and
   pin `if_version`**), and **the 7d walk page** (Ask 13): setup, the list (both portals, phone and computer), the page, the head
   coach (each role), the road back from the Schedule, the clocks and "Playing now", the free portal. **One purpose per walk.**
   Offer `/simplify` (a shared row mapping and a shared edit predicate are new abstractions), `/review` (this changes who may
   write to a record that routes mail), `/design` (390 and 1440, both portals), `/marketing` for every sentence, `/docs`
   (the Tournaments article: the help door and the road to the games), and `/strategy` (a plan-inclusion check only; no price,
   no new gate), per CLAUDE.md. **Commit only when the owner says**, through a private index (the tree holds other sessions'
   edits in TODO, plan, ledger and design log).

## Not in 7d

- Online payment from a coach's page (Stage 12c) and refunds; the payment figure on a team stays what the organizer marks.
- Messages and the chat pause's E2/E3; the phone bar's "Messages" label is not touched.
- A parent's view of a tournament (parents have no such page and none was drawn).
- A tournament history by year, a year picker, or a lifetime list on the paid portal.
- The admin side's Teams page and the club's Add our teams window (7b, built).
- The house-league season email and the registration-closed "this season" rule (7c's follow-ups).
- Other screens' stylesheet breakpoints; only the 7d screens move to 640 / 768 / 900.
- A new grant or a role on the staff screens, unless the owner picks Put to the owner 1 (b).
