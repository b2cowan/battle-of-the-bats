# Club Website Enhancements — Stage 2 drawing prompt (field status: "Close a place")

> Paste into a FRESH session: *"Read and follow docs/projects/active/CLUB_WEBSITE_STAGE2_DRAWING_PROMPT.md"*. Written
> 2026-11-25, after Stage 1 closed (commits `d574a5f9b`, `da32f2483`). Plan: `CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` (read
> §3, §4 F3, §5 idea 3, §6 Stage 2 and the standing rules under the ladder, §7's Stage 0 rulings A1–A6 and events E7, the
> Progress block's Stage 0 Part 1 census and Part 2 result, the Stage 1 entries, §9, §10). Status lives on the board
> (project `club-website`). Where this prompt and the plan differ, the plan wins; where the plan and the CODE differ, the
> code wins — say so out loud before drawing on it.
>
> **This session can run beside Track P Session P3** (`CLUB_WEBSITE_TRACK_P_BUILD_PROMPT.md`). They share no screens
> except the public club frame. Both edit the plan's Progress block and the board line: re-read them before writing,
> and commit through a private index (`reference_partial_commit_shared_tree.md` in auto-memory), never `git add -A`.

## ✅ Parts 1–3 DONE (2026-11-25): drawn, reviewed and published (https://claude.ai/artifact/N332KzJg8NgFJb4oZvJhwM); the 17 asks K1–K17 wait for the owner. Next is a build prompt, after the rulings.

## ⏩ Part 1 is DONE (2026-11-25). A fresh session starts at Part 2.

Read the plan's Progress entry "Stage 2 Part 1 done" (the last entry before §8) in full before drawing: twelve findings
with file and line, the migration list, the spelling census, and where the captures are
(`docs/projects/active/club-website-stage2/today/`, 41 files, 390 and 1280, DPR 1; the notice-up home is Stage 0's
`club-website-stage0/milton-staging/home.*`). Do NOT redo the census or the counts; open the cited lines only where a
drawing turns on them. Milton's three answers were still not in at Part 1 (re-check the slot; say so on the asks tab if
still empty). A model for the page build: `.probe/club-website-stage1/build.cjs` + `house.css` (Stage 1's drawing page).

**What Part 1 changes in Part 2 (draw these; each is owed on top of the list under Part 2):**
1. **The typed-by-hand group is the main path, not the edge.** Production has no places at all; on dev 5 of 116 typed
   places match a place's name exactly, because people type the diamond in. Draw the window for a club whose games are
   mostly typed: the group matched on the place's name INSIDE the typed text (not equality), its size realistic, "Link
   both" as the way out, and the empty state when nothing at all is linked. Ask where R4 (every schedule uses real
   places) sits against this stage.
2. **No hold.** A held Rainout is invisible to the public, so a strip written at once would contradict the schedule.
   Draw the window sending at once (recommend it), and name the other option (the strip waits for the send) in the ask.
3. **A game being played.** Both tools call off a game mid-play (no live state). Draw how the window shows a game whose
   time has started (recommend: listed unticked, "Started at 11:00 a.m."), and ask.
4. **The strip is not the notice.** The notice holds one line, from now, with no place, and is not on tournament pages.
   Draw the closure strip read from the closure itself (so the club's own notice stays, two places show as two lines or
   one, and the evening-before closure starts at its time), beside the club's notice. Say plainly the strip does not
   reach a tournament's own pages, and ask whether it should.
5. **The tournament hand-off when nothing is linked.** Most tournament diamonds are not tied to a club place. Draw the
   window's tournament row for both cases: linked games counted, and "plays today, its fields are not linked to your
   places" with the same "Open its Rain delay" door. Draw the Rain delay opening on that day and those diamonds (today
   it opens on its first day with every filter on all, and takes one diamond).
6. **The rep mark** borrows the Coaches Portal's shipped idioms (the "Moved" chip, the amber "Hand-back asked" pill,
   `ClubSourceNote`); the coach's email has no shipped pattern for games (the club schedule send is practices only).
7. **Emails:** the Rainout's are service notices with NO unsubscribe (the prompt below wrongly says it carries one).
   `/legal` decides whether the rep coach's email stands on the same ground. Tournament families hear only through
   their Rain delay's pinned post and push.
8. **The gate:** the Rainout is Tournament Plus, the club's places League and up. `/strategy` places Close a place.
9. **Roles:** the four tools have four role sets (Progress item 8). Draw what a house league admin sees of rep and
   tournament rows (a count with no door, the club calendar's and Venue library's shipped pattern) and ask who may close.

## What this session is for

Stage 2 lets a club close a place. Today a house league admin can call off one season's games on one day with the
Rainout, matched on the place's typed name. A club with a soaked park needs one act that closes the place (or one
diamond) for every program that plays there: house league games postponed or cancelled as the Rainout does now, rep
games marked for their coach, tournament games handed to that tournament's own Rain delay, the club's events at that
place listed, a strip on every public page saying so, and Reopen. It sits second on the ladder because the home's games
part (Stage 1) is where families will see it, and the Big Board (Stage 7) needs it.

**Stage 0 already drew the frame** (`CLUB_WEBSITE_STAGE0_DRAWINGS.html`: tab 10 "Admin doors" draws the Close a place
window at phone width, its result and the Closed strip with Reopen; tab 4 the house league schedule with the strip and
"Needs a new date"; tab 2 the closed place in the home's notice slot). **The club events drawing** (tab 6 "Closed place ·
sponsors" of `CLUB_WEBSITE_EVENTS_DRAWINGS.html`) draws E7. **This session finishes them:** true size, from the shipped
components, every state, and the questions the frame left open. Do not redraw what is ruled.

**Already ruled (do not re-open):**
- **A1 = A:** the home's fixed order: notice slot → Open now → the games part → News → the rest.
- **A2 = A:** a closed place rides the notice slot; no closure news post while it is up.
- **A4 = A:** ONE "Close a place" window over today's Rainout (not a third tool), with Reopen, writing the strip and
  marking every game; tournament games handed to their own Rain delay.
- **A5 = A:** rep games are MARKED, not moved; the coach is emailed and moves it.
- **A6 = A:** games whose place was typed by hand are listed unticked, with "Link both to {place}". The owner asked that
  every schedule use real places (recorded against the `real-venues` project as R4, not scoped yet); A6 is the interim.
- **E7 = A:** the window lists the club's events at that place, each opening in Events; nothing moves by itself.
- **C4 = A:** field status is second.
- Stage 0 words: "Close a place", "Lions Park closed · waits for a new date"; Postponed is the shipped pill.

**What Stage 1 shipped that this stage lands on:** the home's "Not being played today" band (never capped) and its
fold of more than three called-off house league games in one season on one day into one row. Draw how a closure reads in
the notice slot AND that band at once, without saying the same thing twice.

**Nothing is built here.** No code, no migration, no gate. The output is one published page and the owner's rulings.

## Milton Bats' answers

Stage 0's prompt (`CLUB_WEBSITE_STAGE0_PROMPT.md`, the feedback slot) holds the three questions the owner asked Milton.
Re-read it. If the answers are in and one bears on who closes a field or how families hear, test the drawing against it.
If not, say so on the asks tab and draw anyway. One club is one data point.

## Read first (delegate the broad reading to helpers; open the lines a conclusion turns on yourself)

- The layout standard (`docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md`), the club-site look rulings (in-repo
  `memory/design_decisions.md`), and the owner's UI conventions (auto-memory index) before drawing any control. Windows
  and toolbars follow the shipped components, not a sketch.
- **Today's Rainout:** `lib/league-rainout.ts` (one season's day, published divisions, scheduled games only; postpone by
  default or cancel; email now or hold in Changes to send), `lib/league-rainout-server.ts` (the place is matched by NAME,
  venue or typed text), the press `league_rainout_press` and the `league_rainouts` table (migration 427: no place column),
  the emails (`lib/league-rainout-send.ts`, one per family per division, coaches copied), the window
  (`components/admin/kit/club/league/schedule/RainoutWindow.tsx`) and its door on the season schedule. **Its plan gate is
  `bulk_reschedule` = Tournament Plus** (`lib/plan-features.ts`).
- **The tournament Rain delay:** `app/[orgSlug]/admin/tournaments/schedule/components/ShiftDayModal.tsx` (a day, narrowed
  by division or field, pushed later or cancelled, an announcement; a Storm Mode slot reserved at its top) and its words
  in `lib/schedule-words.ts`.
- **The club notice:** `org_site_notices` (migration 343: notice, detail, posted, ends; **no place, no start time**),
  `lib/club-notice.ts`, the editor's `ClubNotice.tsx`, and `components/public/ClubNoticeBanner.tsx` on every club and team
  page.
- **Places:** `org_venues` / `org_venue_facilities`; house league `league_games.org_venue_id` + typed `location`
  (`lib/league-venue.ts`); rep `rep_team_events.org_venue_id` + a copy in `location`; tournament `games.diamond_id` →
  `diamonds.source_org_venue_id` (the only link to the club's place); permits `org_time_blocks.org_venue_id` (never null).
  `TOURNAMENT_REAL_VENUES_ONLY_PLAN.md` (R4) for where "every schedule uses real places" stands.
- Stage 1's home: `lib/club-games-home.ts` (the band and the fold) and `components/public/ClubGamesPart.tsx`.

## Part 1 — The walk and the census (answer from code, with file and line)

1. **Capture today at true size** (390 and 1280, DPR 1): the Rainout window and its result on Kestrel Bay (dev), the
   house league public schedule after a rainout, a rep team's public page, the club home with a notice up, and a
   tournament's Rain delay. Stage 0's and Stage 1's captures may be reused where the screens have not changed; say which.
   A handful of screens, not a sweep (AGENTS.md for the dev server).
2. **The typed-only count (owed since Stage 0).** On dev, and on production as COUNTS ONLY (never rows; the AI
   production rule): house league games and rep events with a typed place and no real one, per club, upcoming vs past;
   tournament games whose diamond has no link to a club place. This decides how big A6's "Link both" group really is.
3. **What one Close a place must reach, program by program:** the games at that place on that day (and, for "Until",
   the days after), matched by the place's id where there is one and by name where there is not; what a closure does to a
   game already final, already live, or already postponed; a diamond closed while the rest of the park plays.
4. **Who may do it.** Today the Rainout is the house league admin's, and the Rain delay the tournament admin's; a place is
   the club's. Which roles can close a place, which can Reopen, and what a role sees of the programs it does not run.
5. **What families and coaches hear.** The Rainout's emails today; A5's new email to a rep coach; whether a tournament's
   families hear through its own Rain delay only. Count the sends a busy Saturday closure would make (dev, counts only).
6. **What the notice can and cannot carry:** no start time (closing tomorrow's fields tonight), no place link (Reopen
   ending the right strip), two places closed at once (the slot holds one notice today).
7. **What a build would need that does not exist** (the migration list, for `/db`): a place on a rainout or a closure
   record, the notice's link and start, anything else. Note the §9 item that `DATA_DICTIONARY.md` calls a house league
   "postponed" dead though rainouts write it, and the §9 "Rainout" vs "rain-out" spelling: both are this stage's to settle.

Stop and tell the owner what the walk found before drawing, in a few plain lines. Put the findings in the plan's Progress
block first; a `/clear` between Part 1 and Part 2 is fine.

## Part 2 — The drawing

Whole-screen before (the capture) beside after, true size, phone first, then the computer. Built from the shipped
components and the layout standard. Owed:
- **The window,** phone and computer: the place or one diamond, the day and Until, Postpone or Cancel, the folded counts
  per program (house league, rep, tournament, events), the typed-by-hand group unticked with "Link both", who will be
  emailed ("Email 112 families and 1 coach"), and the button. Its empty state (nothing at that place that day) and what a
  person without some programs sees.
- **The result** and **Reopen:** the result line, the door to each tournament's Rain delay, the Closed strip, and what
  Reopen puts back (the Rainout's put-back) and what it cannot.
- **Every public surface a closure touches:** the home (notice slot + the games part's band and fold), the house league
  schedule (the strip, "Needs a new date"), standings and season page, a rep team's public page and the family schedule
  (a marked game), and a tournament page (its Rain delay, unchanged; draw only the hand-off).
- **The coach's side** (A5): what a rep coach sees in the Coaches Portal for a marked game, and the email.
- **The emails** at true size (house league families as today, the rep coach's), in their fixed words.
- **States:** a diamond closed while the park plays; two places closed; a closure set the evening before; a closure
  ending by itself at Until; a place with typed-only games; Reopen after families were emailed.

Hard limits: no AI-written words (fixed sentence patterns only); no child named; times only "8:00 a.m." through
`formatTime()`; no motion (Stage 6); no follow, alert or share control in a browser; the staff calendar never feeds a
public page; words go to `/marketing` in ONE pass before hand-off.

## Part 3 — Reviews, then hand off

1. `/ux`, then `/design`, on the page before the owner sees it. `/db` reads the closure's writes and the migration list
   (one transaction, no game left half-marked, no unpublished game reaching a public page). **`/legal` is owed:** the
   stage emails families and coaches (CASL: transactional, the sender, the unsubscribe the Rainout already carries).
   **`/strategy` is owed on the gate:** the Rainout is Tournament Plus today; say which plan a club-wide Close a place
   belongs to, against `PLAN_PRICING_FACTS.md`, before the asks.
2. **Publish ONE page** (a Claude Artifact, an HTML page, the house layout; never the canvas): the walk, the census, the
   drawings, and the asks with a paste-back line. Every highlighted thing is clickable to its ask.
3. **The asks,** a recommendation on each, option A first. Expected at least: who may close and who may Reopen; a whole
   place vs one diamond; Until and the evening-before closure (the notice's start time); one strip for two closed places
   or two strips; what a closure does to a live or final game; the rep coach's email words and when it sends; the plan
   gate (with `/strategy`'s answer); "Rainout" or "rain-out". Do not ask what to do first; recommend an order.
4. **The build's shape,** written for the build prompt: the migration first (with `DATA_DICTIONARY.md` and
   `npm run refresh:snapshots` in the same unit), one pass or two, the guard tests, what the help articles gain
   (`/docs`), and what the Kestrel and Milton demos will show (they follow the product; `/demos` curates once per cycle).
5. Records: plan Progress block and §7 (the asks), §10 for the words, the PM brief if scope moved, the board line (phase
   and next). No commit without the owner's word.

## Done means

One published page the owner can rule from; the typed-only count in; every program's reach traced to its code with file
and line; the window, its result, Reopen and every public surface drawn at true size, phone and computer; `/legal` and
`/strategy` heard; the asks waiting; nothing built.
