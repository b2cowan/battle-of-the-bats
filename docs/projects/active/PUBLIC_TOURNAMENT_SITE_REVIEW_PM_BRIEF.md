# PM brief — Public tournament pages: easy to read in a parking lot, and a door to the club

**Status:** drawings ruled 2026-10-27; Stages 1 and 2 built and owner-walked (plan §9). Stage 3 Part 2 implements the
phone Schedule behind the preview switch (committed `68acfe331`, 2026-10-29); Part 3 adds the game page and desktop
arrangement on the same date. Owner visual checks are recorded separately. Priority: the next public-page stage.
Plan: `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md`. Mockups: the review hub (Claude Artifact).

## Compact Schedule — owner approved (2026-10-29)

The owner’s Schedule screenshot shows too few games per screen, frequent wrapping and scores drifting away from their
teams. The owner approved the revised drawing and asked for the build: time top left, division and pool directly underneath, and the status tag at the
top right (Final, Live now, Unofficial or Cancelled). The list has no location or maps action; families open a game for
its field, address and Directions. Each full-width team line contains its own score, so a wrapped name cannot move a
score onto the other team. Keep 16 px names, complete team names and thin separators in one white list. Live games use
the green rule and Live now; no score yet is written once.

Drawing: `PUBLIC_TOURNAMENT_COMPACT_GAME_ROWS_DRAWINGS.html` (360/390 selector, results, mixed states and long-name test).
The revised drawing's normal sample measures 107–108 px per game and fits five complete games at the screenshot’s scrolled position;
these are prototype measurements using font fallbacks. Implementation checks are recorded in the Stage 3 build prompt. Priority: resolve before approving
the Schedule in owner walk §426. Success: real long names remain complete, every score stays with its team, more games
fit without smaller text, and opening a game clearly leads to its location. Access and preview rules do not change.
The preview Schedule implements this recipe for regular and live games. Desktop keeps its one-line arrangement, with
location/maps removed there too. The Overview, game-page Directions, admin-preview access rules and switch-off Schedule
retain their existing behaviour. The owner’s visual check is separate from accepting the drawing.

## Stage 3 Part 2 — the phone Schedule (2026-10-29)

Families choose a division and stage in two rows, land on today's games and open earlier confirmed results when needed.
Live games show their scores and Directions in their time slot. Search still finds teams and public coach names. The
Playoffs list keeps placement standings above its games and ends with a bracket door to Standings until Stage 4 moves it.
Cancelled games have no Directions; unconfirmed scores read Unofficial. A held-back division reveals no games.

My games and the followed team's calendar are installed-app controls only. Following is done on a team's own page;
the old follow strip, scorebug, year picker, alerts, My Team rail, repeated heading and List/Bracket switch do not appear
in this Schedule. The admin preview has plain rows with no game or maps links. The preview switch preserves the current
customer-facing Schedule until Stage 8.

Success: a family can find when and where without passing the old control stack; hidden games stay hidden, deep links
open the right game, and live updates preserve each game's place. The owner checks the fixtures at 360 and 390 px;
Part 3 adds the game page and the full desktop arrangement.

## Stage 3 Part 3 — where and when first (2026-10-29)

A family opening a game sees its time, field, address and a full Directions button before the score. The next card
shows both teams, the round and the game's state; the last card holds the division, round, game length and any notes.
Championship names the round; Final describes a confirmed result. A cancelled game keeps its address with no Directions,
scores or share action. An unofficial result keeps the scores and share action and says it awaits confirmation.

On a desktop, Schedule controls and rows use the available width; the game's facts sit beside its location and score.
My games and calendar remain exclusive to the installed app. The admin preview keeps plain Schedule rows and has no
separate game-page destination. The preview switch preserves the existing public pages until Stage 8.

Success: Directions is on the first phone screen; the desktop adds room without changing the task; scores update as
before, a game enters/leaves Live now at the correct time, and a newly withheld game disappears from an open page.

## What changes for a family
- **The phone home answers "where is my next game" on the first screen.** On game day it opens with your team (if you
  follow one), the games being played now, and the next games with their field and directions. Today the next
  scheduled game is about two phone screens down, under repeated summaries.
- **Calmer to read.** Tournament pages move to the same light ground, type and white tab row as the club's own site.
  The capitals in a typewriter face go. The organizer's colour stays the first thing you see, as a band across the
  top.
- **Nothing is taken away.** Parts with nothing in them no longer show as big empty boxes; everything that has
  content is still there, a tap away at most.
- **One word for each state**, matching the club's Tournaments tab: Live now, This weekend, Registration open, Finished.
- **The pay link is a focused page** with no tournament menus beside it.
- **Every page leads with its job** (round 2): the Schedule opens on today's live and next games; a game's page opens
  with when, where and Directions; Standings opens with the table (the bracket moves to Playoffs); a team's page opens
  with its next game. Tabs with nothing in them (News, Rules) hide; Register and Champions become tabs while they
  have something to show.
- **In a phone browser these are web pages** (no app bar, Sign in at the top, as on club pages); inside the installed
  app the app bar is there.

## What changes for a club
- **The club gets advertised, not just linked.** A card on the tournament's home shows the club and what is open
  there right now (a tryout, a house-league sign-up), with a "Visit the club" button. Every tournament page's footer
  says who hosts it.
- **Sponsors on tournaments.** The club keeps one sponsor list and picks which tournaments each sponsor appears on.

- **The club decides how its tournaments look.** One new setting on the club's public site: "Club's look by default"
  (a tournament can be given its own) or "Always the club's look". A tournament's own
  settings show "The club's colours" as a real choice, with a preview. Switching the rule never erases a tournament's
  own look.

## What changes for a standalone organizer (not a club)
- The same calmer pages in the organizer's colour if their plan includes branding, or a neutral dark band if it is a
  free event. No club card. Nothing depends on a club existing.

## Found along the way (fix first)
- **A schedule the organizer has not published can still reach families**: the tournament home lists its games while
  the schedule page says "coming soon" and team pages say no games. This is a real defect, not demo data, and it is
  worth fixing before any redesign.
- **A club's tournaments lose the club's colours without anyone choosing that**: the first time anyone saves a
  tournament's settings page, even to turn a page on or off, it switches to the FieldLogicHQ default look.
- A few small wording bugs: a game in play with no score shows a lone dash; the club home calls a tournament three
  weeks away "Live"; the countdown says "First pitch", which is one sport's word.

## Why it matters
- A tournament is the moment strangers see a club. Today that moment is a dark, dense page with a small name link.
- Families read these pages outdoors on a phone; daylight-readable pages are the job.
- Clubs and their tournaments should feel like one product.

## The trade
- The dark game-day look and the organizer's dark/light switch go away (a fallback keeps dark as an option).
- Two older design rulings are reversed knowingly: tournament pages "stay the venue" in their own dark look, and the
  uppercase typewriter labels. The venue idea survives as the organizer's colour band.

## Success looks like
- On a 390px phone on game day, the first "Up next" game is on the first screen.
- No empty boxes on any tournament page.
- A visiting parent reaches the club in one tap, and sees something to sign up for.
- A club and its tournament side by side read as the same site in two colours of the same frame.

## Owner decisions needed (in the hub's Asks tab)
The ground, the type, the home's order, the club card, sponsors (and their plan gate, via `/strategy`), the pay page,
fixing the defects now, and the state words.

## Stage 4 · Standings and Playoffs (Part 1, 2026-10-29)

The owner confirmed Stage 3's walk is done and asked for Part 1. All five build-prompt recommendations were accepted:
one remembered division at a time on both pages; the bracket stays on Standings through Part 2 and moves with both
doors in Part 3; followed-team row marks appear only in the installed app; Playoffs keeps a quiet Share icon; the new
pages say offence and defence while the old page retains its words until Stage 8.

Families will see the standings table first, with Team and PTS staying visible while the middle scrolls. One tap opens
the column meanings and ranking rules. Playoffs will show the chosen division's next game, then its bracket, with
seeding behind a tap. These are the next preview-only improvements; Part 1 adds their foundations and leaves the
current pages visually unchanged. This follows Ask 15 and D5, with the results line retained under Ask 17.

Priority: Stage 4, before Teams and the remaining tournament pages. Success means a parent can read their team's
position and find the next playoff game on a phone without passing a poster or a seed list. The bracket appears on
exactly one of the two pages; a held-back division supplies no preview table, seed, bracket or next game. The organizer's
preview gets Standings only, with no active door, links or follow mark. Public access and standings calculations do not change.

The missing states are drawn in [PUBLIC_TOURNAMENT_STAGE4_STATES_DRAWINGS.html](PUBLIC_TOURNAMENT_STAGE4_STATES_DRAWINGS.html)
at 360 and 390 px, revised with Claude and approved by the owner on 2026-10-29 for Part 2. Desktop follows the Overview's two-column arrangement from
1,024 px and will be shown in Part 3. The temporary spelling difference between the two preview states is accepted,
not a new global spelling policy. Part 1's checks and the next-session instructions live in the Stage 4 build prompt.

## Stage 4 · Part 2, the standings table first (2026-10-29)

The owner approved the drawings after revising them with Claude and asked for the build. The preview Standings now
opens with one remembered division, a quiet line of pool-game counts and its tables. Team stays 150 px wide on phones
and pinned left; PTS stays pinned right while the middle scrolls. Numbers align right, and the true RD keeps its capped
seeding value in brackets, wrapping together when needed. Pools keep separate tables and their existing public names.

The column meanings, ranking order and score notes open under “How the table is ranked”. The team-cell marks remain
quiet: first place, movement in rank, a playoff spot and an unofficial score. A stored follow adds its colour mark
only in the installed app. There is no year selector, My team strip, result-pill row or Recent Scores block in this
preview body; the Overview and Schedule still carry results, and the results line stays on Standings.

At this intermediate checkpoint the bracket stays below the tables and ranking explainer. The door is added in Part 3
when the bracket and both links move together, so the public never encounters a door whose destination has no bracket.
The organizer's preview uses the new table with no working links, bracket or followed-team mark. Held-back divisions
have no names, tables, counts, plans, seeds or games in the new body's server payload. The current pages and their
original feed keep their existing behaviour when the preview is off. Access and standings calculations do not change.

Success checks: the phone's middle columns scroll while both ends stay visible; the first table row comes before the
ranking explanation and bracket; the counts agree with the games used by the standings engine; and a division held
back disappears from both the initial payload and live replacements. Verification and the owner’s 360/390 px fixture
check are recorded in the Stage 4 build prompt. Part 3 remains the next session.

## Stage 4 · Part 3, Playoffs holds the bracket (2026-10-30)

The owner asked to proceed with Part 3. In the preview, Playoffs now leads with the remembered division's live or
upcoming game: its teams, score when available, time, field and Directions. A completed division gets its champion
first. The bracket follows, and “How seeding works” opens the format, team highlights and seed list. Share stays a
quiet symbol beside the division. The same public game words are used in the card and bracket.

The bracket moves out of the preview Standings body in the same change that adds its Playoffs door and repoints the
Schedule's bracket door. A bracket-only event can reach Playoffs even though it has no Standings page. Held-back
divisions supply no bracket, next game or seed list. Score changes update the card and bracket together; a newly
crowned champion also updates the event band. No role gains access: the organizer's preview still has Standings only,
without a working door or follow mark. The preview-off pages keep their current content and bracket renderer.

The existing bracket's Fit control was not a full-screen view and its phone-sized names were truncated and shrunk.
The preview presentation instead wraps full names at a readable size, retaining the existing round/group rules. Four
teams fit without zoom controls; bigger brackets keep zoom and fit and gain a full-screen view with a close control
and Escape support. Text stays readable when fitting a bigger diagram. This changes presentation, not standings,
seeding or bracket generation.

From 1,024 px, the next game sits beside the bracket, with seeding below the game; the phone order stays through
1,023 px. That derived desktop arrangement is ready for the owner's review with the phone version. Dedicated,
reversible development fixtures cover a live championship, seeded and eight-team bracket-only events, mid-pool
standings and an event without playoffs. Existing fixtures and demo seeds are preserved. Verification and fixture
state are recorded in the Stage 4 build prompt. Part 4 remains cleanup, review, the owner walk and final records.

Part 3 verification: 448 focused tests and 27 phone/desktop layout measurements pass. On the 390 px live fixture,
the next game begins 248 px down. Real score, cancellation, crown and withholding changes update the open page
correctly. The owner still reviews the appearance, including the derived desktop arrangement. The existing demo
checker import failure prevents a demo verdict, and the full-project typecheck exhausted its heap; strict focused
types pass. These limits and the fixture review paths are recorded in the build prompt, Part 3 execution.

## Stage 4 · Part 4, review and owner walk (2026-10-30)

The complete Standings/Playoffs change has had a manual cleanup and adversarial review. One customer-visible defect
was corrected: Fit bracket now actually fits an eight-team diagram inside a phone, with full names still readable.
The unused publication-filter wrapper was removed; the existing server filter remains the single boundary. No role
or public access changed. A reversible all-divisions-held-back fixture mode makes both empty pages walkable.

The owner walk is prepared as `PUBLIC_TOURNAMENT_STAGE4_WALK.html`, ledger §428: 14 parts and 59 steps, two optional
for the installed app. It asks the owner to judge the phone and derived desktop layouts, and records read-backs for
every fixture change. It is not marked walked. The HTML source is ready for Claude Artifact publication; this
environment has no publishing surface or connected document session, so no published link is claimed.

Final validation: 452 focused tests, complete Stage 4 lint and the standard full-project TypeScript check pass.
The latter passes after a cache-clean restart, resolving the prior verification limit. Focused browser assertions
verify Fit/full-screen/readable names at 360/390/1280 and both completely held-back bodies/feeds. The existing demo
gate still cannot start because of its unrelated import error; that limitation remains explicit in the walk.
Fixtures are left published and live for the owner, and the dev server is running. Stage 4 implementation/review is
complete; the owner walk and Artifact publication are the handoff before choosing Stage 5 or Stage 1a.

## Stage 5 · Part 1, Teams and a team's page (2026-10-30)

Families will scan teams grouped by division, with a record, place and next-game line, then open a team for its next
game, results and record. All divisions is the first view, independent of the Schedule's remembered division.
Inside the installed app, stars and Calendar remain available; a browser has Share, with no follow controls, alerts
or My-team dock/cards. Coach names continue to follow the club's privacy rule. There is no team-page admin preview;
the admin Teams preview adopts the new list without links or stars.

The owner accepted all six Part 1 recommendations. A held-back division contributes no team, count, dropdown choice
or search result to Teams. An existing direct team link keeps only the name, division and “The schedule isn't
published yet”. Results leads when a team has finished playing; champions have a Champion line first. Games after
tomorrow name the weekday and date as well as the time.

Priority: Stage 5, following the completed Stage 4 owner walk (§428). Part 1 establishes the preview-only readers,
shared game/place wording and regression guards. The redesigned bodies are drawn in Parts 2–3 after the owner
approves `PUBLIC_TOURNAMENT_STAGE5_STATES_DRAWINGS.html`. During this foundation checkpoint the new bodies are empty,
apart from the held-back-link message; switch-off bodies retain their original source and styles. Nothing is
enabled for customers by this stage. Success means the list answers who is playing and where each stands, the team
page answers when the team plays next and how it has done, and held-back information never reaches either new body.

## Stage 5 · Part 2, the Teams list (2026-10-30)

The owner approved the revised drawing and requested Part 2. With the preview on, families now see all published
divisions together, each with its team count and any pool groups. Search covers the team name, its qualifier and
coach names only when the club permits them. Each row gives the record, meaningful place and next game; full names
wrap and qualifiers get their own quiet line. Empty pages have no filters. A search without a match explains the
publication rule without identifying a held-back division or showing a count.

The revised ruling removes the pin: a followed team stays in its standings or alphabetical position. Installed-app
stars are separate 44 px targets, keep a stable accessible name and use the existing confirmation sheet to unfollow.
A follow never moves the division filter. Browsers retain their stored follow without using it to reorder or select
the list. The admin preview has the same readable list without links or stars. The switch-off pages retain their
original bodies and styles. The team-page redesign and browser My-team suppression are Part 3.

Priority remains Stage 5. Success means a parent can find a team and read its next game with one scan, then open it
with one tap. The desktop proposal keeps each division together in the Overview's 1.35:1 two-column rhythm from
1,024 px; the owner judges that arrangement in Part 3. A live refresh replaces the list, including removals: an
unpublished selected division disappears and selection falls back to All divisions. Failed refreshes stay silent,
as ruled; a visible refresh-failure sign is a follow-up in the plan's Stage 5 row.

Focused tests, full TypeScript and lint pass. Measured at 360/390/1280: no sideways scroll or Teams control below
44 px, names 16 px, division headings 18 px. On the current Metro fixture the first row starts at 253/253/236 px.
Browser-only long-name/live/final/removal cases pass without changing database fixtures. Real installed-app
interaction remains optional owner verification because the browser could not emulate standalone display mode.
The standard layout check records five issues in the existing shared free-plan promotions (small controls and
overlapping badge); the global selector gate also records unrelated findings. Neither check is reported as passed.

## Stage 5 · Part 3, a team's page (2026-10-30)

Families can now open a team to see its next game first: Live now with the score, or Up next with time, field and
Directions. The team they are reading is first and bold. Later games follow, then newest-first Results, the record
list and one door to that division's standings. A winner has Champion first; a results-only team says No more games.
The runner-up keeps the drawn chip without that extra line, for the walk's remaining wording decision.

The browser has Share this team, distinct from the band's tournament Share. Follow and Calendar are inside the
installed app only; no bell is drawn. Browser My-team docks, rail cards and follow prompts no longer mount. Stored
follows are retained. Coach names and record visibility keep the existing public rules. An existing held-back team
link shows only name, division and the approved sentence; a wrong link and a connection/server failure have distinct
messages, and a failed first load offers Try again. Background connection failures remain silent as ruled.

The owner approved a narrow preview-only API addition after inspection found the old response lacked group size,
venue addresses and visibility flags. These public facts now arrive with the same profile request; no standings
table or roster is sent. Legacy callers receive their original response. The new page and its results line also
remove held-back team names and private score-submission details before data reaches the browser.

Priority remains Stage 5. Success means the next game is visible on the first phone screen, names wrap, actions reach
44 px, and a score/final/withholding change updates the open page without duplicate rows. The two-column desktop
proposal follows the Overview from 1,024 px, main then side in one reading order; the owner judges it in the walk.

293 focused tests, full TypeScript, lint and the typography/token/contrast checks pass. Twelve fixture/width pairs
pass focused geometry checks; on the long-name live fixture the next card starts at 444/415/346 px at 360/390/1280.
The team page passes the standard layout check at 361 and 1440. The combined check still records the five shared
free-plan promotion findings on Teams, and the global selector gate retains unrelated findings. Seven marked
development clones are prepared for review; live refresh, final, withholding, retry and browser follow preservation
passed automated assertions. Real installed-app interaction is optional owner verification. Part 4 is cleanup,
adversarial review and the owner walk; the build prompt has the fixture links and validation details.

## Stage 5 · Accepted walk and review corrections (2026-10-31)

The owner returned §432 PASS, 60 of 60 checked, with the three optional installed-app checks skipped. Both desktop
layouts are approved as built. The separate team Share remains removed; the runner-up keeps its drawn state.

The requested corrections make unusual states reliable: a game without a start time stays readable, playoff spots
agree with Standings, and a family is not told its tournament is over while a playoff slot remains unfilled.
When the organizer hides Standings, Teams hides records and places too. Pool labels describe the groups actually
displayed. Browsers keep their visitor experience even if the device has a stored follow; the installed app retains
following. Held-back opponents cannot supply team links or promotional share images through the new pages, while
the approved minimal direct-link message remains. Kickoff and the live-window end update without a successful refresh.

Priority is closing Stage 5's eight review findings before Stage 6. Success is regression coverage of each boundary,
passing type-aware verification, and preserving the owner-approved layouts. The original walk acceptance and the
corrections' verification are recorded separately in the ledger; browser verification remains owner-owned.
