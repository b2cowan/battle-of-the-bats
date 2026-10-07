# Tournament admin redesign — implementation plan

**On production 2026-10-07** (Stage 4, after the event, and D7, one Tournaments list) — Amplify job 277 (prod HEAD `17e069b8`, tag `release/2026-10-07`); the release record holds the detail.

> **Status:** BUILD — **Stage 2 (Teams and Communications) COMMITTED 2026-09-30: `f4a4cc79` (Part 0, migration 314 applied to prod the same day) · `12aee778` (Part 1) · `aab3a3f4` (Parts 2–3, after /simplify + /review)** — §6b "Stage 2 — as built"; the §252-walk follow-ups committed `4db0faab` 2026-10-01 (§6b). **Every owner walk
> so far is closed — §251 and §253 passed; §252 and §254 (with the follow-ups' own walk) closed by the owner
> 2026-10-01** (ledger §254 records what that walk's ticks did and did not cover). **The defects pass, F40 (`dbc55916`) and Stage 1 (game day) are on prod
> 2026-09-30 (Amplify job 274, prod HEAD `3ec661b5`)**. The measured walk, the stage ladder and Stage 1 (game day) were drawn on
> 2026-09-28 and published on the project hub (https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM); Stage 1 was redrawn on
> 2026-09-29 (hub v3–v5) after a formatting check against the portal's written rules (§11). **Stage 1, asks
> A1–A11 and the walk's shape questions RULED 2026-09-29, all as recommended** (owner: "I agree with your
> recommendations"). Build prompts: `TOURNAMENT_ADMIN_REDESIGN_DEFECTS_PROMPT.md` (run first) and
> `TOURNAMENT_ADMIN_REDESIGN_STAGE1_BUILD_PROMPT.md`. **The defects pass (§5 row D) COMMITTED `936655a9` 2026-09-29 (/simplify + /review first);
> owner walk §251 ✅ PASSED 2026-09-29, 24 of 24.** F40 (Teams' pool board off the white card) fixed the same
> day, walk §252. **Stage 1 (game day) COMMITTED `890d0aac` 2026-09-30** (/simplify + /review first) — §6 "Stage 1 — as built"; owner walk §253 ✅ PASSED 2026-09-30, 31 of 31.
> ⚠ Part B was RE-SCOPED the same day (`ADMIN_DESIGN_CONTINUITY_PLAN.md`
> §3a "PART B RE-SCOPED"): it no longer covers the screens this redesign rebuilds, and each stage retires its own
> screens' old look as it builds — so "after Part B's cleanup" below is superseded (§8). Each stage is built only
> after the owner rules it and Part B's cleanup has passed its screens; the next stage is drawn only after the
> owner rules on the one before.
> **Stage 2 (Teams and registration, Communications) DRAWN 2026-09-30** on the hub's Stage 2 tab (§6b), from
> `TOURNAMENT_ADMIN_REDESIGN_STAGE2_DESIGN_PROMPT.md`: T1–T7, C1–C2 and asks A13–A17; the `/design` review's twelve
> changes applied the same day (hub v15, editable title corrected v16). **RULED 2026-09-30, all as recommended**
> (owner: "I agree with your recommendations, go ahead with the build prompt"). Build prompt
> `TOURNAMENT_ADMIN_REDESIGN_STAGE2_BUILD_PROMPT.md`: Part 0 the A15 email defect (own commit, first) · Part 1 the
> form window's named Previous / Next and editable title (own commit — Club Tier 3a's screens start after it) ·
> Parts 2–3 Teams and Communications. Sequencing beside Club Tier 3a: §8.
> **Stage 4 (after the event) DRAWN 2026-10-05** on the hub's Stage 4 tab (hub v21, §6d), from
> `TOURNAMENT_ADMIN_REDESIGN_STAGE4_DESIGN_PROMPT.md`: D1–D6, findings F47–F55 (§3), asks A18–A24. **A18 RULED the same
> day** (owner, as recommended: Stage 5 owns the dashboard's before-event view). **The `/design` review's thirteen
> changes (+1 found re-checking) applied the same day on the owner's "go ahead"** (hub v22, §6d); the tab split into
> parts 2026-10-06 (v23). **⚖ STAGE 4 RULED 2026-10-06** (owner's paste-back): D1, D2, D3 and D5 as drawn, A19–A24
> as recommended. **Build prompt `TOURNAMENT_ADMIN_REDESIGN_STAGE4_BUILD_PROMPT.md`** — P1 (a tiered division) and P2 (a final never scored) go to the owner at
> its start.
> **✅ STAGE 4 BUILT and COMMITTED 2026-10-06** (after /simplify + /review): `8bdecc9f` (Part 0) · `e1d6e021`
> (Part 1) · `8237fb15` (Parts 2–3) · `211fcb1d` (Part 4); help and records in the docs commit after them; P1–P5 ruled
> at its start, all as recommended — §6d "Stage 4 — as built". **Owner walks §275 (the morning after, from a phone)
> and §276 (statuses and the way back, at a desk) owed** — the hub's QA tab (v25).
> **Created:** 2026-09-28 · **Branch:** dev · **Companions:** `TOURNAMENT_ADMIN_REDESIGN_PM_BRIEF.md` ·
> hub `TOURNAMENT_ADMIN_REDESIGN_HUB.html` (republish the same path for the project's life).
> **Origin:** Phase 3 of `ADMIN_DESIGN_CONTINUITY_PLAN.md` ("Tournament screens — its own project when it
> opens"), opened the day the foundation released (`74f45113`, master job 273). Kickoff prompt:
> `TOURNAMENT_ADMIN_REDESIGN_DESIGN_PROMPT.md`.

---

## 0. Goal

The foundation **restyled** every tournament screen: same layout, same words, the coaches portal's look,
Warm and Dark. This project **redesigns** them: what each screen shows first, how a job gets done in the
fewest taps, and what can go. Its measure is the organizer's weekend. The first real director should be
able to run game day from a phone without hunting for the game they came to score.

## 1. Evidence, and what it can and cannot tell us

The platform has **zero customers** (`PROGRAM_TOURNAMENTS.md` §1.1), and its Stage 4 says the first real
tournament should choose what comes after it. The owner chose to redesign now, before a first director
learns these screens. That is defensible, because relearning is expensive, and it raises the bar for
evidence. This plan argues only from four sources:

1. **A measured walk** (2026-09-28): a read-only Playwright probe signed in as the `org-owner` UAT session
   on `uat-plus-org`'s *UAT Phase 2C Plus Championship 2026* (3 divisions · 22 teams · 11 games, June
   2026), the same account on `uat-test-org`'s free Tournament plan, the `plus-official` volunteer, and the
   public demo through its door (`riverdale-minor-ball`: the Summer Classic on game day, the Season
   Opener finished, the Invitational taking registrations). Widths 390×844 and 360×780 (touch),
   768×1024 (touch), 1440×900; Warm and Dark. **Every number comes from the browser's geometry.** The
   probe refused every write. Results: `.probe/tar/walk-*.json` (local, gitignored).
2. **The June persona walks, re-verified against today's code.** J1 (*Dana*, one weekend event, run from
   her phone): of 76 organizer-screen findings, **26 fixed, 9 partly, 6 changed, 32 still open** (2
   routed elsewhere, 1 not code-checkable). J8 (the scorekeeper and the gate volunteer): **14 fixed, 4
   partly, 1 changed, 3 open.** A row counts as open only where the code still does it today.
3. **The foundation's "found, not fixed" list**, each re-checked (§3, F01, F15–F16, F17, F21, F27, F28, F37).
4. **The code**, read for every station (render order, save model, plan gates, live updates, format
   branches, tour anchors).

**What the fixture cannot show.** It is small: 22 teams, 11 games, 4 venues, one game day already past.
A real weekend (30 teams, 60 games, three diamonds) makes every "first thing below the fold" finding
**worse**, never better: the board's Needs-a-score list, Results' per-division list and Check-in's rows
all grow with the event. Where a recommendation rests on how a director will behave rather than on a
measurement, the walk says **"a guess — a first director would tell us"**, and the shape question
recommends *Not yet* unless waiting costs something real. Nothing was seeded.

## 2. Rulings built on, not reopened

- **The foundation as released** (R0–R5, F1–F4): one Warm/Dark setting; the organization's colour stays
  off working screens and on public pages and their previews; scorekeeper and gate fixed Warm; help follows
  the theme; no subtitle under a page title; type and card style follow the kit. **Build-time calls kept on
  walk §245:** Finalize lime, Revert and Forfeit red, Cancel amber; the stacked game row; every chosen
  filter olive; "Pending Review" as the product spells it; the score sheet keeps Cancel and never closes on
  an outside tap (owner, 2026-08-08). A drawing that amends one says so with a reason. **Stage 1 amends one
  (A12, owner 2026-09-29):** a row's worded action (Finalize, Check in) is olive on white; the lime is kept
  for one main action per screen (the score editor's Save, the team sheet's Check in).
- **The formatting standard's first rulings** (Club Ask 8, 2026-09-28) and the portal benchmark: display
  face for page titles, column headings and band rows; admin figures in the body face, tabular; a right
  chevron opens, a down chevron expands; the phone card's corner chevron shown; a table's link is the
  name, a row list's link is the whole row; phone row cards white; one uppercase mono chip; eyebrow ink in
  two named roles; the save word fades ~2.5 s, a sentence notice ~8 s. No links or buttons inside table
  cells; delete never a row action; a status said once; tinted panels retired to a white callout with a
  coloured edge.
- **The admin's 38px control height (K-18, owner A-08 2026-09-07)** is an owner-ruled exception to the
  44px floor for HEIGHT inside the admin at touch widths. It never excuses width, and it does not cover a
  22px or 25px control. Every "under 44" count below says which side of 38 it falls on.
- **Standing rules:** a form covers the nav, a menu sits on top of it; edit autosaves, create asks; form
  selects are dropdowns; icon-only actions on a phone admin; back goes up one level inside a sheet; the
  transient "Saved"; every delete asks first; "8:00 a.m."; one spelling everywhere a customer reads it;
  a row list is a table when a column answers the question; every highlight on a drawing is clickable.
- **Storm Mode and the Big Board** are their own projects (`PROGRAM_TOURNAMENTS.md` Stages 5–6). Not
  designed here. Stage 1 leaves them a visible place (§6 G8).
- **Club Tier owns:** Stage 6 — the one venue book, the cross-module clash check, the club calendar;
  Stage 7 — tournaments inside a club (hub banner, "Add my team" for a club, fees to the club ledger).
  **The admin frame** (rail, phone bar, More) is the foundation's and the Club program's. A change wanted
  there is a finding for them (§3 F39), not a drawing here.
- **Public pages** are out of scope; the organizer's preview of them is in scope only as a door.
- **The demo's tour anchors must survive** (`now-playing`, `schedule-health` ×2, `registration-health`,
  `post-event-summary`). Stage 1 moves none; §6 says where each lands.

## 3. Findings

Measured at 390×844 unless a width is named. "Code" = read in today's source. "J1-NNN" / "J8-NNN" =
the June finding it confirms. **Bold** in the first column = drawn in Stage 1.

### Game day

**F01 — The event is named twice on every tournament screen, and the dashboard says its status four
ways.** The event header (org · dates · name · one phase chip · the public-site pill) is pinned at the
top: **113px at rest, 70px once scrolled** on a phone, 68px under the 48px strip on a desk. Directly under
it, 16 of the 23 tournament screens repeat the tournament's name as their page eyebrow. The dashboard
alone draws a second full header: the name again as its title, an ACTIVE badge and a LIVE label, while the
event header's chip says OPEN or LIVE and the guidance card says "It's game day". Two rules decide the
phase: the event header uses the event dates only; the dashboard uses the dates *or* the first game
having started. So on the days after an event, while the organizer finalizes scores, the header says
Open and the board says game day. Code: `AdminEventHeader.tsx` (date-only `isWithinEventDates`),
`dashboard/page.tsx:2338-2370` (bypasses `TournamentAdminHeader`), `tournament-dashboard/route.ts:273`.

**F02 — A game on the board opens Results, not the game.** Every row on the game-day board and every
"Enter scores →" link goes to the Results list with no game named (`dashboard/page.tsx:1947-2077`;
no `gameId=` anywhere in the file), although Results already opens a named game, snaps its division and
stage filters, and scrolls it into view (`results/page.tsx:219-236`). **From the board to typing a score
today: 5 taps** (the row → the division menu → the division → the game's pencil → the score box), and
on a real weekend a search or a scroll on top. With the link it is **1**. J1-096.

**F03 — The board opens on scores waiting for the organizer, filed under "Now playing", and the overdue
games carry a time but no day.** On the fixture the first panel, NOW PLAYING, holds two IN REVIEW games
(scores submitted, nobody playing). NEEDS A SCORE lists six June games as "1:00 p.m.", "6:00 p.m." with
no date, so a phone reader takes them for today. Code: in-review games join `liveGames`;
`renderNeedsScorePanel` prints the clock only.

**F04 — The board is three phone screens long and its next step is at the bottom.** 2,502px at 390
(3.0 screens), 1,357px at 1440. The line that says what to do next ("The tournament dates have passed…
you can mark this tournament as complete") sits at **2,187px**, below the schedule-health panel and the
division gauges, while the guidance card at the top still says "It's game day". An empty bordered box
(the activity feed with nothing in it) closes the page (J1-099, still drawn).

**F05 — The board's doors are 17px tall.** "Enter scores →" ×3 (77×17), "Open board →" (73×17) and
"Review ->" (49×17 — and the only arrow on the page typed as two characters) on a phone; the guidance
card's primary button is 162×29.

**F06 — Results opens on the first division, so most of the day is hidden.** At both widths it opens on
U11 Girls: 2 of the 10 games show; the other 8, including all six that need a score, are behind the
division menu. `results/page.tsx:96,159`. A guess to confirm with a first director: on a busy weekend
the organizer wants "what needs me, anywhere" before "one division".

**F07 — Results' score controls are the smallest controls on game day.** On a phone the pencil that opens
a game's score is **22×22** and Finalize is an icon-only tick at **35×25**; at 1440 Finalize has its word
and the pencil is still 22px. Both sit well under K-18's 38px. The row around them is 83px tall and does
nothing when tapped.

**F08 — Results and Check-in never update themselves; the dashboard does.** The dashboard refreshes every
30 s while visible (`dashboard/page.tsx:912-928`); Results and the check-in board fetch once, so a
scorekeeper's submission or a second gate volunteer's check-in appears only after a reload. Results'
empty state still promises "no refresh needed" (J1-086, J1-087 half-open). The scorekeeper already
subscribes to games.

**F09 — A tie looks like a game nobody has won.** On a tie both scores take the "didn't win" ink and no
word says Tie (`GameList.tsx:386-387,498,534`). J1-094's old notation is gone; nothing replaced it.

**F10 — One game state has four names.** Submitted and waiting: IN REVIEW (dashboard), Pending Review
(the status tag, the product's name, kept on §245), Reviewing (Results' filter), Review (scorekeeper's
filter). Not scored yet: NEEDS SCORE, Unscored, To Score. On a phone, Results shows the waiting count as a
bare coloured dot and number that screen readers skip (`results/page.tsx:698-703`, `aria-hidden`). The
one-spelling rule is a product rule, not a style preference.

**F11 — Check-in's row puts two person icons side by side.** On a phone each row ends in No-show
(38×38, a person with an ×) and Check in (34×38, a person with a tick), both without words (the label
hides under 640px). One mis-tap marks a team a no-show (J1-092, J8-012 partly fixed: the icons grew from
28px and gained names). The desk row shows "Check in" with its word. Tapping the row opens the team sheet,
which is right already: No-show a third, Check in two thirds, both 48px (J8-013 fixed).

**F12 — Check-in's filters are 24px tall, and the counts above them don't filter.** All · Not arrived ·
Checked in · No-show measure 24px on a phone; the three gauges above (0/18 checked in · 0 no-shows · 13
unpaid) are figures you cannot tap (J1-095 changed, not closed). First team row at 490px.

**F13 — The organizer's Check-in is the gate volunteer's board.** Same component, two shells. Any change
to the organizer's board reaches the gate on the next build. Not a defect; a constraint every Check-in
drawing honours (the volunteer walk W5 passed on 2026-09-28).

**F14 — Staff kit works; Chat has no page title.** The staff kit's QR codes and copy links need nothing.
Chat draws no heading at all (no `h1`), and its Rooms and Manage buttons are 36×26.

### Registration and teams

**F15 — On a phone, no team is on Teams' first screen.** First team row at **864px**: the page header
(99), the toolbar (81), Registration health (51, closed), the capacity strip (36) and the Payments panel,
**open by default on a phone at 287px**. At 1440 the first row is at 699px.

**F16 — The pools view pushes each row's button off the screen.** At 390 each slot row's status badges
end 52–139px past the right edge and the row's own open button 152–179px past it (182–209px at 360),
hidden by the card, so it cannot be reached. Two fixed-width columns (130px + 160px) and no phone rule
(`teams-admin.module.css:1799-1850`). J1-071. A layout defect on a live screen.

**F17 — "Accepted" wears three colours.** Green in the flat list, grey on the slot board, lime on the phone
marker; waitlisted shares pending's amber except on the phone marker (blue). On a phone, status and
payment are single-letter glyphs (J1-073, open).

**F18 — Communications tells a Plus organizer that Plus unlocks targeting, and has no targeting.** The hint
shows on every plan and the composer has no audience picker (J1-070, open).

**F40 — The pool board's rows sit on the paper (found 2026-09-29, after the walk; FIXED the same day, §252).** The
owner's screenshot: each pool's heading was white and its team rows showed the paper and the grid through them;
the Waitlist and "needs a spot" sections the same. The admin look repainted the three section headings and not
their frames, so nothing painted the card behind the rows — the table standard's one-painter rule (§3.3 / §3.10.1,
the portal's F-24) had never reached this board. The flat list on the same page was right (its frame paints the
card). Fix: the two frame classes paint `--card-bg` in the kit layer; nothing moves. Probe
`.probe/ground/slot-ground.mjs` reads the first painted ground behind every heading and row (Warm + Dark, 390 +
1440): all on the card after, all 15 rows on the paper with the rule removed. ⚠ Stage 2 still owns the board's
SHAPE: each pool is its own card with a gap between, where the phone ruling (v4, S.7) is one frame with the pools
as band rows.

**Re-measured 2026-09-30 for Stage 2** (after Stage 1 and the defects pass; probe `.probe/s2/probe.mjs`, the
`org-owner` session, the Championship and the demo's Invitational, 390 · 360 · 768 · 1440, Warm and Dark, read-only):
F15's first team is at **783px** on a 390 phone (U11 Girls; 761 U13 Boys, 801 U15 Open; 817 at 360) — the header
change bought 81px, and the tab bar still starts at 772, so no team is on screen one. At 1440: 687px. On the demo's
Invitational (15 teams, registration open) **1,277px** on a phone and **1,052px** at a desk. F17 measured: Accepted is
green in the desk list, warm grey (Dark: white-70 on navy) on the pool board, an olive "A" 18×18 at 9.28px on a
phone; payment on a phone is "$" glyphs 7×12. Nothing spills sideways at any width since F16's restack. Controls
under 44 on a phone: 13 on U11 Girls below 38px (row chevrons 24×24, Close Registration 122×20, the three tools
32 wide, the waitlist's "No Slots" 69×25).

**F41 — A team waiting for a decision is not on the pool board (found 2026-09-30, the Stage 2 walk).** On a division
with pool slots the board draws slots, the waitlist and "Accepted — needs a spot"; a pending team is on no row. A
counts card says "1 pending review" and cannot be tapped. The context strip ("2 teams to review") and the rail's
Teams badge open Teams on the first division, not the one with the work. The way in is Registration health → "2
teams waiting for review", which shows **"Showing: Pending review (2)" over one row** (the list is the selected
division's; the other team is in U15 Open); the "Needs action · 12" figure beside it jumps to missing information,
not review. **Accepting a pending team: 5 taps** (health → the line → a 24×24 chevron → a 62×25 Accept → the
confirm), probed. Code: `registrations/page.tsx` — the slot board renders `slotsByPool`, `waitlistTeams`,
`unplacedTeams` only; `AdminContextStrip.tsx:104` links `/registrations` with no division; `focusAttentionBucket`
keeps the selected division when it has a match.

**F42 — "All accepted teams · 18 recipients" emails every registered team (found 2026-09-30).** The composer's
email line counts accepted teams; the send (`api/admin/communications` `resolveRecipients(tournamentId, null)`)
reads every team in the tournament with no status filter: **22 addresses on the test event**, including Freeze U15
Open (rejected), Titans U11 Girls (waitlisted), Blaze U11 Girls and Cyclones U15 Open (pending) — read-only
probe `.probe/s2/recipients.mjs`. The email's record ("Recipients") then lists the accepted teams only, and the free
plan's 100-recipient cap counts every team. The client's own comment says "always send to all accepted teams". A
say-the-true-thing defect with a privacy edge: the first "Welcome and info" would reach the team the organizer
rejected. Ask A15.

**F43 — The Tournament plan is offered a division choice it cannot send (code, 2026-09-30).** A site post's
"Division visibility" renders whenever the event has divisions, on every plan; the send refuses a division filter
without `targeted_tournament_announcements` (Tournament Plus) with a 403 after the message is written. Not rendered:
the free fixture's tournament has no divisions. A6 says a plan lock is shown with the plan's name. Ask A15.

**F44 — Communications' formatting (2026-09-30).** Two sets of tabs (Site Posts · Emails, Active · Deleted), four
28px buttons in two shapes; a message sent both ways is two records in two lists with different columns; the empty
state adds a second lime under the header's +; the composer is a centred window at every width with a tinted
Channels panel, 16px checkboxes on 23px lines and mono template chips 24px tall. **Drift for `/strategy` (report
only):** `PLAN_PRICING_FACTS.md`'s email table lists templates and delivery tracking as Tournament Plus; the product
gives both to every plan (`QUICK_TEMPLATES`, "free for all plans"; the per-recipient Email Details), and the Facts
doc's own change-log note says templates "don't exist yet".

**F45 — The team record folds open with small controls, and Delete is a row action (2026-09-30).** A 24×24 down
chevron folds the record open inside the list: Accept 62×25 (lime), Reject 59×27, three 28×24 icons (resend access,
edit, delete). Details save in a separate Edit window with a button while payment and notes save when the field is
left. The registration date prints in the device's format ("22/05/2026", `toLocaleDateString()`), not the
product's. The standard: delete is never a row action; a row that opens a form opens it full screen on a phone
(§3.10.8); edit autosaves (owner 2026-09-24).

**F46 — The demo force-opens Registration health (2026-09-30, for `/demos`).** The tour's "Go back three weeks"
opens the health panel (342px on a phone) and Payments opens by default (287px), so the Invitational's first team is
at 1,277px on a phone. The anchor `registration-health` stays on the health row in Stage 2; whether the tour should
still open it is `/demos`' call.

**F18, re-read 2026-09-30.** The hint shows only when Email is ticked, on every plan including Tournament Plus. The
send already accepts `targeting` (divisions, registration statuses, payment states, team ids) and gates it on
`targeted_tournament_announcements` (Tournament Plus, League Plus, Club); the composer always sends `targeting:
null`. So "build targeting" is a picker and a true count on a send that exists (ask A14).

### The schedule

**F19 — The schedule opens on an empty list once a division has played.** At both widths it opens on U11
Girls' round robin with "No games match your filters. Clear filters". It shows only unplayed games by
default (`schedule/page.tsx:140`), and U11 Girls' two games are played. A guess: mid-weekend, an organizer
opening the schedule wants the day, played or not.

**F20 — The bracket never shows a score or a winner.** Names, time and field only, in the live bracket and
the generator preview (`BracketColumns.tsx`). The champion appears on the dashboard's wrap-up card, never
in the bracket.

**F21 — One generator, two names** ("Round-Robin Generator" on every door, "Schedule Generator" inside it).

**F22 — A drag on the timeline moves a published game at once, with no undo** (J1-079, open).

**F23 — The coin toss is recorded on the public-page preview only**; nothing on the schedule's playoff view,
the bracket builder or Results says a toss is pending (J1-090, open).

**F24 — The rain-delay tool is three taps from the board, behind Schedule → Tools** (Tournament Plus). It
is the natural home for Storm Mode (§6 G8).

### Create and set up

**F25 — Two ways to create a tournament ask different questions.** The first-run setup asks how many
fields or diamonds each park has and creates Diamond 1…N (J1-028's fix lives there). The New tournament
wizard (every tournament after the first, from the rail's + or the Tournaments list) asks only a street
address, so a three-diamond park schedules as one lane again. Neither asks for fees (ruled optional,
owner 2026-06-16).

**F26 — The wizard's Tournament Plus notice renders as plain text.** Its classes are defined nowhere; the
dashboard's reuse notice has the same bug (`TournamentSetupWizard.tsx:1211`, `dashboard/page.tsx:2715`).

**F27 — Event settings is seven closed cards, and one control spills at 360.** The cards carry value
summaries and open from a link (J1-029's two halves fixed), and they fit one phone screen. The Fee model's
four buttons end 15px past the edge at 360.

**F28 — Divisions paints a full division red and gives Delete the same weight as Edit.** "FULL" in the
danger colour; Edit and Delete are twin 35×25 icons on every card, live event or not; validation uses the
browser's alert box (J1-033, J1-034, J1-041 open).

**F29 — Public site never links to the site it edits, and its one Save is at the bottom** (1,255px on a
phone). The theme preview is a drawn mock (J1-046, J1-058 partly, J1-064 open).

**F30 — Four setup screens, four save models.** Event settings autosaves; Divisions and Venues save in a
window; Rules saves per section with a leave-guard and a three-way leave dialog; Public site has one
bottom Save.

**F31 — The setup screens' small controls.** Registration questions' Move up / Move down / Save / Archive
36×27 on every question; notification switches 36×20; Rules' Browse samples and Add section 36×26; Venues'
export 32×32. These are desk-first screens (A3); the phone floor still applies wherever a phone reaches them.

### After the event

**F32 — The dashboard's archive confirm promises a restore that doesn't exist.** "You can restore it later
from Past Tournaments", but Past tournaments has only Seal and View; restoring is the Tournaments list's
status menu, and the plan's slot limit can block it. It also never says the public site goes offline, which
the Tournaments list's own confirm does say (`dashboard/page.tsx:2791`). J1-103 partly, J1-104 regressed.
A copy defect about a destructive action.

**F33 — Two "reuse this setup" flows.** The wizard's reuse step (from the Tournaments list, one tap per
row) and Summary's own window (in "What's next", closed, 1,713px down on a phone) call the same clone with
different options; the completed dashboard offers neither (J1-107).

**F34 — Summary on a phone.** One figure per 143px card; "0 champions detected"; Share links the standings
but not the champions page (J1-112); Print prints the admin chrome (J1-110); and the "Leader" line sorts
differently from the published standings, so it can name the wrong team (J1-109, a correctness defect).

**F35 — The Tournaments list sets status from a menu that writes on change** (Draft with no confirm), under
a subtitle that says "set which one is live" above several live rows (J1-037).

**Re-checked and re-measured 2026-10-05 for Stage 4** (probe `.probe/s4/probe.mjs`, read-only — every non-GET refused;
390 · 360 · 768 · 1440, Warm and Dark). The only finished event in any test data is the local demo's **Riverdale Season
Opener** (Tournament Plus, completed: U11 decided by a final, Cedar Hollow Cyclones 5–4 over Riverdale Rapids; U13 round
robin only, Riverdale Thunder 3–0); the Tournament plan's finished board was pictured by a probe that showed the free
club's live event as completed in the read (nothing written). Positions are from the top of an organizer's screen,
without the demo's own bar (135px on a phone, 143 at a desk). **State of the five:** F26 (after-event half) open — the
notices draw as callouts since `936655a9` but still can't render on a one-slot plan; F32 fixed `936655a9`; F33 open (and
a third flow exists, the draft board's copy-into-this-draft — Stage 5's, A18); F34 partly fixed `936655a9` (leader sort,
"0 champions") — the 143px cards, Share and Print open; F35 partly — the subtitle no longer renders (the foundation's
header drops it), the menu still writes on change. **Measured, phone:** the board's champion at 547px under a 311px
guidance card, "Reuse this setup →" 137×18 and "Dismiss" 62×14, the board 924px; Summary's first figure at 257px in
four 143px cards, Share at 1,276, Print at 1,421, "What's next" closed at 1,553, the page 1,755px; the Tournaments list's
first event at 379px (the demo; 313 on the free club) as a 222px card of labelled lines, three 192×27 status menus.
**At a desk:** champion 507, Archive 602, the board one screen; Summary's "What's next" at 882. No sideways spill at any
width or theme.

**F47 — The finished board says "complete" twice and offers no next year.** A guidance card ("Tournament complete — nice
work", 311px on a phone, a lime to Summary, a dismissible "Did you know?" link to reuse that opens Summary) above a tinted
wrap-up card ("Tournament Complete", the champion as a chip, a second lime to Summary), plus the context strip to
Summary: three doors to one page, two lime. On the Tournament plan, two limes again (View final results, Review
Tournament Plus) and the old gauges. Code: `dashboard/page.tsx` completed branch + `GuidanceRail` stage `done`.

**F48 — No door to the Tournaments list from inside an event.** Probed on the Plus fixture (1440, 390): the rail, the
phone's More sheet and the account menu link every tournament page but not the list; the rail's "Tournaments" row (shown
only off the tournament pages, for a tournament-only club) goes through `admin/tournaments/page.tsx`, which sends you to
the dashboard when an event is selected. The list is reached by a typed address, a club's Organization page, or the
draft board's "Set up fees" (F55) — yet status, reuse, seal, edit details and delete live there, and F32's archive
sentence sends people to it. For the frame's owners (Stage 8 nav review); ask A22.

**F49 — On a one-slot plan, next year costs this year's public site.** The Tournament plan and the Premium Coaches
Portal's included tournament have one slot (`getEffectiveTournamentLimit`); a completed event holds it (occupied =
not archived); New tournament and the clone route refuse at the limit; archived is not a public status, so archiving
takes the site and every shared link offline. A free organizer opening next year's registration takes last year's
results down, and nothing says so until New tournament refuses. A packaging question for `/strategy` (ask A23); no
gate change here.

**F50 — A division with no final reads "Leader" on a finished event.** The Season Opener's U13 played six round-robin
games: Summary says "Leader: Riverdale Thunder" under "Until then, the team leading the standings is shown"; the board
lists champions only, so U13 is missing. Champions come only from a decided final (`lib/champions.ts`), which can be
true of one division and not another in the same completed event.

**F51 — An Exhibition's public Champions page promises playoff finals.** An Exhibition has standings ("Standings still
run", `lib/tournament-phase.ts` — the Stage 4 prompt said it has none) and no bracket; its public Champions page says
"No champions crowned yet — once the playoff finals are decided…". Public pages are out of scope: for their owner.

**F52 — The demo: an unused anchor and a one-slot Plus club (for `/demos`).** `post-event-summary` (Summary's header) is
rung by no tour step — the "morning after" moment opens Summary by its address, and the anchor guard checks only steps.
The demo club stores `tournament_limit = 1` on Tournament Plus, so its list reads "3 / 1 slots" under "Tournament slots
full… review the plan override", the list's Reuse setup is refused ("Tournament Limit Reached"), and the moment's
"Next year starts from one button" can't be kept.

**F53 — Summary says the public results are a Plus feature.** Shown to a Tournament Plus organizer: "Your saved summary,
shareable public results, and reusing this setup next year all come with Tournament Plus"; the free board's upsell
lists "public results links". The public site and its results are on every plan; only Summary's copy buttons are Plus.
Words for `/marketing`, a note for `/strategy` (report only).

**F54 — Past tournaments has three names, the club's name above its title, and no way back.** Rail "Past tournaments",
tab "Past Tournaments", title "Archives"; the club's name as its eyebrow (against the 2026-10-01 ruling), a plan fact
under the title, its Plus lock as a dashed box (against 2026-09-30), and "Seal Now" as an archived event's only action.

**F55 — The pre-event board's "Set up fees →" opens the Tournaments list** (`dashboard/page.tsx` payments panel), which
sets no fees (Event settings does). Stage 5's (A18).

### The volunteers

**F36 — The volunteer screens are the strongest in the tournament product, with four open items.** Since
June: sign-out works, an expired session recovers, a lime "Up next" card, one large score box (steppers were
tried and removed because they left 29px for the numeral), a coloured policy note, reversible payment, a
non-destructive roster. Open: the "Install this app" banner can sit on top of the filter and tab bars (it
positions itself from variables the volunteer shells never set); Cancel and Submit are 42px; the Review
filter doesn't signal waiting scores; a `staff` member lands on the full dashboard (J8-021).

### Across the product

**F37 — Controls under 44px, by screen (390, touch).** Game day: Results 16, Check-in 65 (every row's
pair), dashboard 13. Teams 25, Schedule 19, Event settings 71, Registration questions 30. Many are the
admin's ruled 38px height (K-18); the ones that matter are **below 38** (the 22px pencil, the 25px
Finalize, the 17px board links, the 24px filters, the 24px pool-row buttons, the 20px switches).

**F38 — A plan lock is shown with a padlock and no words.** On the free Tournament plan, the schedule's
Tools menu shows the generators with a bare padlock; Chat is a full-page Plus wall; Summary is a full-page
upsell; Public site shows six "Locked" cards. The product's rule holds (a plan lock is shown, a format that
doesn't apply is absent), but what a padlock means is unexplained where it sits. Words → `/marketing` (A6).

**F39 — For the frame's owners, not drawn here:** on the free plan the game-day phone bar gives one of its
four tabs to Chat, a Plus feature that opens a paywall; the context strip over the phone bar says "2 games
to finalize" on the dashboard and "2 teams to review" on Results (by design, it skips the screen you're on),
which reads as the product changing its mind. Routed to the foundation / Club Stage 8 nav review.

## 4. Standing back — rules across the stations

1. **Name the event once.** The pinned event header is the event's identity; a page names only itself.
2. **One status, one rule, one word.** A phase and a game state are computed once and spelled once.
3. **A row opens its own record.** A game opens that game; a team opens that team. Never a list you
   search again.
4. **Open on what needs you.** A working screen opens on the work (unscored, waiting, not arrived), in
   every division, and one tap shows the rest.
5. **Game day stays current by itself.** Every screen an organizer watches on the weekend refreshes on
   its own, the way the dashboard does.
6. **The control you use most is the biggest.** The daily job gets the full row or a worded 44px button;
   a rare or destructive one moves into the record's sheet.
7. **A phone row fits the phone.** Nothing ends past the right edge; a row that can't fit becomes a card.
8. **One way to do one thing.** One creation question set, one reuse flow, one archive sentence, one name
   per tool.
9. **Say the true thing.** No restore that isn't there, no "no refresh needed", no "email will be sent"
   when it won't be.

## 5. The stage ladder

| Stage | Covers | Asks | Width it is FOR (A3) |
|---|---|---|---|
| **1 · Game day** | The dashboard's game-day board, Results, Check-in; the one-event-identity rule (A2) first applied here; one word per game state | A2, A4, A6, A7, A9, A10 | Phone first, desk second |
| 2 · Teams and registration — **DRAWN + RULED 2026-09-30 (§6b); build prompt written** | Teams (first team on screen one, the pools row, one colour per status, words not glyphs, a row opens the team), registration health, Communications; + the pending team on the board (F41), the email that reaches every team (F42, F43), Communications' formatting (F44), the record (F45) | Q 6.1 (ruled) · T1 T3 · A13–A17 | Both |
| 3 · The schedule | Opens on the day; the bracket shows scores and winners; one generator name; drag with undo; the coin toss where seeding happens; the rain delay as Storm Mode's home | Q 8.1 | Both |
| 4 · After the event — **DRAWN 2026-10-05, RULED 2026-10-06 (§6d); build prompt written** | The finished board says how each division finished and offers Reuse this setup (its one lime); one reuse flow (the wizard's step, every door); Summary on a phone, the champions page shared, a clean printout; Past tournaments as every finished event's list; the Tournaments list (what's ahead) with its statuses as bands and the event's record, every change asking first; the Exhibition; + no door to the list (F48), the one-slot next year (F49) | Q 13.1 (ruled) · A18 (ruled: Stage 5 owns the before-event view) · A19–A24 | Desk first |
| 5 · Create and set up | One set of creation questions (diamonds in both wizards); Event settings; Divisions; Venues; Rules; Public site (a door to the site, a save that follows the rule); the settings screens | Q 1.1, 2.1, 3.1, 4.1 | Desk first, phone usable |
| 6 · The volunteers | Scorekeeper and gate: the install banner, 44px buttons, a waiting-score signal, the staff landing; the gate inherits Stage 1's check-in board | — | Phone only |
| D · Defects now | Not a stage: F32 archive promise, F16 pools button, F26 bare Plus notice, F08's "no refresh needed", J1-075 "email will be sent", F34's leader sort, F04's empty box, J1-116 the strip on its own page, "0 champions detected" — **COMMITTED `936655a9` 2026-09-29** (record below; walk §251) | A8 | — |

**D · the defects pass — COMMITTED `936655a9` 2026-09-29** (prompt `TOURNAMENT_ADMIN_REDESIGN_DEFECTS_PROMPT.md`;
owner walk **§251 ✅ PASSED 2026-09-29, 24 of 24**, the hub's QA tab; F40 followed the same day as its own small
fix, walk §252). The nine, plus five the code showed were the same defects, accepted by
the owner before the build (the Decisions tab): (a) the bulk Accept / Reject confirm; (b) the waitlist and "needs a
spot" rows (same fixed coach column — the waitlist's button ended 2px past its card at 360); (c) no Leader before a
division has a result; (d) the strip skips its own page on every destination; (e) three more boxes with the same
undefined `alert` classes (Summary's load error, the reuse window's error, the payment-reminder note). Words by
`/marketing` the same day. What changed, in one line each:
- **F32** — one archive sentence for both doors (`lib/tournament-archive-words.ts`): the public site goes offline,
  the slot is freed, the way back is the Tournaments list's status menu and needs a free slot.
- **F16** — at ≤768 a slot row restacks (slot name · team + open arrow · coach + badges); the waitlist's coach drops
  below. Measured: 168–225px past the card at 360/390 before, inside with every button tappable after.
- **F26** — the two plan notices draw as the kit's `Callout` (reused from the club kit). ⚠ **Neither can be reached
  today:** every plan without reuse has one tournament slot, so both New tournament doors refuse at the limit before
  the wizard opens, and the draft dashboard sends a free organizer to plans instead of the reuse window. Reported,
  not changed (Stage 5 owns creation; Stage 4 the reuse flow).
- **F08** — Results' empty state says what the page is for, nothing about timing.
- **J1-075** — the confirms read the route's own rule (`lib/coach-email-rules.ts`, re-exported by `lib/email.ts`):
  "An email will go to {address}", or "No email will go out — {why}".
- **F34 leader** — the Summary route ranks with `computeTournamentStandings` on `getTeams` / `getGames` /
  `getDivisions`, the published standings' reads (head-to-head, run-diff cap, coin tosses, a null status counted as
  accepted). Probe: every fixture division agrees; a synthetic head-to-head tie shows the old sort named the wrong team.
- **"0 champions detected"** — no line at zero; "{n} champions crowned" otherwise; the recap subtitle rewritten.
- **F04** — the activity frame is not drawn while the feed is empty.
- **J1-116** — the strip's candidates skip any whose destination is this page (Results had the rule alone). For
  the frame's owners (the foundation, Club Stage 8's nav review): nothing else about the strip changed; F39's
  "the strip changes its mind between pages" is still theirs.
- **/simplify + /review + /docs (2026-09-29, before the commit).** /simplify: `pluralize`; the sending routes gate on
  `coachEmailBlock` too (one predicate, behaviour-identical); the Teams page reads the held tournament's settings
  (Event settings' save refreshes it); the Summary's standings reads start beside its own reads; `LiveEventLog` owns
  its frame (`className`). /review (high-risk tier, 4 lenses): **the archive sentence's coach clause was FALSE** —
  the coach side has no archived gate (a coach still opens their registration's record), so "coaches can no longer
  open it from their Coaches Portal" is gone (the Tournaments list's old sentence carried the same error); callouts
  in gap-spaced window bodies take `flush` (the reminder note had dropped its `margin: 0`); the strip's self-skip
  matches the page part only (the org context can lag a cross-org navigation); the early-started reads carry a
  no-op catch. Refuted: a NULL `teams.status` leader (both snapshots NOT NULL). /docs: the closeout article says
  archiving takes the public site offline, + FAQs "Can I bring an archived tournament back?" and "Does accepting or
  rejecting a team email the coach?". The layout sweep's baseline dropped 15 fixed pools-view entries.
  **Found, not fixed (reported):** `DATA_DICTIONARY.md` still says `teams.status` is nullable on prod (stale — both
  snapshots NOT NULL); `api/registrations/[id]` sends accept/reject/payment emails with no address check; a shared
  "standings for every division" reader (three copies now) and a neutral home for `Callout` are follow-ups; help and
  the tab title still call the Tournaments list "Manage Tournaments".

**Why game day first (A1).** It is the weekend a director is judged on (`PROGRAM_TOURNAMENTS.md` Stage 5's
own argument), it is the one moment the product is used from a phone under time pressure, and it is where
the June walk and the foundation both found friction: F02's five taps to a score, F06's hidden divisions,
F07's 22px pencil, F08's stale screens, F11's twin icons. Teams (Stage 2) has the worst single measurement
(F15, F16), but registration happens over weeks at a desk; game day happens in one afternoon on a phone.
The alternative worth arguing, **Stage 2 first**, is right only if the first real director's registration
opens before their game day is designed, which the calendar decides and a ruling can move.

## 6. Stage 1 — game day, as drawn

Drawn at true size on the hub's **Stage 1** tab, phone and desk, before (today's captures) and after
(drawn Warm; a Dark copy is cloned at load).

- **G1 · One event, named once (A2).** The event header keeps the name, org, dates and switcher, and
  carries ONE status chip from ONE rule (the dashboard's: dates or first game, so "Game day" on the day and
  after it until the event is marked complete). On a phone the chip joins the dates line and the org
  name stays on the desk header only, so the phone header is two lines (≈88px at rest in the drawing).
  Pages below name only themselves: the eyebrow's tournament name goes, and on a phone a title's icon
  actions join its line. **The dashboard keeps a "Dashboard" title band** (v3: every portal screen keeps
  its title band, and the portal's no-title home was rejected on sight), with no status tags: its second
  copy of the event name, ACTIVE badge and LIVE label go, and Customize moves to the foot of the board. *Where it lives in code:* the event header is tournament
  chrome mounted by the admin shell; the change is its phase rule and layout, not the rail or the bar.
- **G2 · The board opens on what needs you.** Four row lists in the order of the organizer's day, each
  hidden when empty: **To finalize** (scores submitted, waiting for the organizer), **Needs a score**
  (overdue; the day shows when it isn't today, in the caption's own ink: "Sat, Jun 13 · 1:00 p.m."),
  **Playing now** (live only), **Up next**. Each list's heading carries its count, once. Below them the
  "Running late?" door card (G8), one summary card (games final · teams arrived · by division; figures at
  the kit's 24px) and Schedule health as a row that expands in place (down chevron). A note with the kit's
  accent edge appears at the top **only** for a step the lists can't say ("Once every score is in, you can
  mark it complete"): no counts, no button, absent on a live afternoon. **On a phone the lists are ONE white
  frame** with their headings as band rows inside it and a hairline between rows, as at a desk and as the
  portal's own lists draw when their rows fit a phone (S.7: the Overview board, owner B5 2026-09-20; the
  Schedule's list) — not a stack of separate cards (the owner's question, 2026-09-29). On the fixture, read
  from the drawing: the board goes from 2,502px to ≈1,373px on a phone; the first row is the organizer's
  work at ≈250px (today a waiting score at 347px, filed under Now playing); the six unscored games start at
  ≈399px (today 623px). At a desk the lists are one row list (date lead · game with its field · score ·
  chevron; no heading row, because no data columns). A second drawing shows the same board on the demo's live
  afternoon.
- **G3 · A game opens that game.** Every board row opens Results with that game open for scoring (the
  existing deep link). 1 tap to the score box instead of 5.
- **G4 · Results opens on the work, and the whole row is the target (A10).** It opens on **Needs you** —
  unscored and waiting games, **every division** — with a one-tap **All games** (the stage's one filter
  pill). Each row is a button that opens the game and ends in its chevron; a waiting row keeps one worded
  **Finalize** beside the chevron (olive on white by A12, 44px on a phone, 38px at a desk). The 22px pencil
  and the icon-only tick go. A tie reads **Tie**. The waiting count has words. One frame on a phone, as the
  board; the score editor opens in its row's place inside it. First waiting game ≈247px
  (today 483px, one division). At a desk, a row list with Finalize only in the To finalize band. Where a
  worded action sits on a phone card is A11.
- **G5 · One word per game state (A7).** Needs a score · Pending Review · Final · Forfeit · Tie, on the
  board, Results, the schedule's tags and the scorekeeper's filters. Words tagged for `/marketing`.
- **G6 · Game day stays current (A9).** Results and Check-in refresh on their own like the dashboard;
  "no refresh needed" goes. No new indicator on the screen.
- **G7 · Check-in: the word on the button you use most.** On a phone each row carries one worded
  **Check in** (44px, olive on white; the lime stays on the sheet's big Check in) and ends in its chevron,
  which opens the team sheet; No-show moves into that sheet (which already asks it well). A checked-in row
  shows "In · 10:42 a.m." and a worded Undo (44px). **The filter is the gate volunteer's own bucket bar**
  (owner 2026-09-29, "I agree"; the gate's pinned bar, owner 2026-08-07 Option C): four equal single-choice
  buttons — **All** (first, and the default, as today) · Not arrived · Checked in · No-show — the count on top
  on a phone, 46px, one line at 390; at a desk "Not arrived 16" on one line at 38px. Not a multi-select
  dropdown: the counts are the gate's scoreboard and a dropdown hides them; the four exclude each other;
  one tap, not a sheet. **Payment is not a bucket** (it is a different question from arrival, and v4 wrongly
  mixed "Unpaid" into the row): "13 of 18 teams still owe" is a count under the bar and each row says what it
  owes; a separate "owes money" switch is deferred until a director asks. The 24px segmented filter and
  the count tiles go. "Owes" keeps its amber (money owed); "Paid" is plain. First team ≈321px (today 490). At a desk Check-in is a **table**
  with its heading row (Team · Roster · Payment), the divisions as band rows. The gate volunteer's board
  changes the same way (F13).
- **G8 · A place for Storm Mode and the Big Board (A4).** The board gains one door, **Running late?**,
  drawn as the kit's door card (a lift, the arrow in its eyebrow), that opens today's rain-delay tool (the
  schedule's Tools menu today). That door is where Storm Mode's
  "Declare a delay" will land. A reserved place beside "Public site" in the desk header marks where the Big Board's "Show on a
  screen" would go; nothing is built for either. For a Tournament-plan organizer the door shows the plan
  lock with the plan's name (A6).

**Tour anchors:** `now-playing` stays on the Playing-now list (it still renders only while a game is live;
recorded for `/demos`, as the release found). `schedule-health` stays on the board's health row and on the
schedule's panel. `registration-health` and `post-event-summary` are untouched by Stage 1.

**Stage 1 taps (organizer, phone):** score a game from the board **5 → 1** (plus typing); finalize a
waiting score from the board **3–5 → 2** (the row, then Finalize in the open game); check a team in **1 → 1**,
now a worded 44px target instead of a 34px icon beside a 38px no-show.

### Stage 1 — as built (2026-09-29; committed `890d0aac` 2026-09-30; prompt `TOURNAMENT_ADMIN_REDESIGN_STAGE1_BUILD_PROMPT.md`; owner walk §253 ✅ PASSED 2026-09-30, 31 of 31 — the three build-time calls stand)

Owner at the start (2026-09-29, all as recommended): a tied playoff score — **say the true thing** (it SAVES and
the bracket waits; the drawing's "can't be saved tied" was false, `lib/db.ts` `advancePlayoffs`); Customize on
the game-day board — **show/hide the parts**, no reorder; Results' **All games — the same bands, every state**;
the dev server quiet. Words by `/marketing` the same day (all in `lib/game-day-words.ts`, one home).

- **G1.** THE rule is `isGameDay()` / `hasFirstGameStarted()` in `lib/tournament-phase.ts`, read by the
  dashboard's API and by the admin tournaments list, which now sends `first_game_started` for ACTIVE events
  (one games read) → `Tournament.firstGameStarted` → the event header. The chip reads **Game day** (was "Live",
  /marketing: the phase now runs past the last date), sits on the dates line; the organization's name hides at
  ≤900; condensed on a phone, a second (aria-hidden) chip sits beside the one-line name. Dates via
  `formatEventDateRange` (the header had hand-rolled `toLocaleDateString`). At ≤900 the ⇄ pill is 44×44 and the
  name's link box 38px+ (measured 41×30 and 19px). Pages name only themselves: `TournamentAdminHeader` and the six
  pages that passed `useTournamentCrumb()` (deleted) drop the event eyebrow; `AdminPageHeader` gained
  `inlineActions` (tournament screens only — other areas keep the row) so a phone's icons join the title line. The
  dashboard's header is `title="Dashboard"` — no chips, no actions, no `legacy`.
- **G2 · G3.** `dashboard/GameDayBoard.tsx` (+ a born-clean sheet). The API splits **To finalize** (submitted)
  out of Now playing, gives each row its `date` and `round` (`bracketRoundLabel`), each division its
  `nextRoundLabel` / `nextRoundLive`, and `hasGamesToShift`; a forfeit now counts as final in the division line (it
  used to leave a round "to play" and drop out of the pool count). Rows are the kit row with a date lead; every row
  links `results?gameId=`. The top note is `CoachCard accent`; the live "It's game day" rail card is retired on game
  day, the **ready** card stays (it holds the one button the day needs next). Summary = `CoachCard` +
  `CoachFigure`; the division line reads the pools while any pool game is open, then the round to play / in
  progress, then the champion (the drawing's fixture read "Semifinal to play" with pool games still open — kept the
  pools first; build-time call). Health = one row that opens the shared panel body (`renderScheduleHealthBody`;
  "Review ->" typed as two characters fixed to "→"). **Customize** = a foot link on an active board; on game day a
  checkbox per part (layout v4 `gameDayParts`; a v1–v3 layout's hidden panels carry over); a completed dashboard
  offers none (it customized nothing). The coin-toss box → `Callout tone="warn"`. The activity feed is off the
  game-day board (not drawn); it stays before/after the event.
- **G4.** `results/ResultsList.tsx` (bands, rows, the editor in a row's place) + the page rewritten: the lens (the
  admin's `filterChip`), division / stage ("Both stages") / search as dropdowns at a desk and in the view sheet on a
  phone; the old status chips and legend gone; filters no longer restored per tournament (it opens on the ruled
  view). `?gameId=` opens THAT game's editor once per id (All games when its band isn't Needs you's); `?view=all`.
  **Build-time call:** on a Pending Review score the organizer hasn't changed, the editor's lime reads **Finalize**
  (the board's two taps: the row, then Finalize); once a number changes it reads **Save score**. The export's
  Status column says the G5 words. **GameList's scoring mode is deleted** (its rules in
  `schedule-admin.module.css`, and `admin-common`'s orphaned `chip_info/warning/success` + `gameStatusSlot`).
- **G5.** Board, Results, the schedule's tags (`GameList`; `ScheduleTimeline` names no state — nothing to change)
  and the scorekeeper's labels say Needs a score · Pending Review · Final · Forfeit · Tie; a pending forfeit is
  "Forfeit · Pending Review". Two forfeit bugs found on the way: the scorekeeper labelled a forfeit "To Score" and
  the schedule's phone tag labelled it "Cancelled". **/marketing kept the scorekeeper's four-button bar on short
  forms** ("To score · Review · Final · All", width at 360) — against G5's placement; an owner question.
- **G6.** Results and the check-in board refresh every 30 s while visible, silently, never while an editor, the view
  sheet, a confirm or a team's sheet is open or an action is in flight. Results' "no refresh needed" was already gone.
- **G7.** `CheckInBoard` rebuilt: the gate's bar (`DayOfFilterBar inline` — new variant, the gate's pinned bar
  untouched) + "N of M teams still owe" / "All teams are paid."; phone rows = the kit row with `beside` (Check in ·
  Undo); desk = the kit table (Team · Roster · Payment, division bands); No-show only in the sheet; the sheet
  unchanged (its layers folded). The check-in time now reads the org's zone in the house clock (it printed the
  device's "9:58 AM"). The Gate view icon is 44px wide.
- **G8.** The door (`CoachDoorCard`) → `schedule?tool=rain-delay`, which the schedule reads once (as Results reads
  `gameId`); locked → `settings/subscription?plan=tournament_plus`, which Plan & billing now reads to open that
  plan's panel. **The door shows only while the event has unplayed games from today on** (the tool's own condition —
  the Tools menu hides Rain delay the same way), so on the test event (every game past) it is absent; pictured by a
  probe that flips the flag.
- **One row recipe, extended — not a second one.** The admin already restates the portal's `CoachRowList` for its
  shell (`ClubRow*` in `components/admin/kit/club/RepKit`, Club Tier Stage 2; the portal's own imports the 16,000-line
  stylesheet). It gained `lead` (+ the portal's phone order), `captionFirst`, `beside` (A11 Option 1, with a
  stretched row cover so the targets touch and never overlap), `RowAction` (olive on white, A12), `ClubRowFrame`,
  a band `count`, and the tour anchor. The cards are the coach kit's (as the Club hub renders them). A neutral home
  for these parts (they are admin-wide now, still named "Club") is a follow-up, like `Callout`'s.
- **Retired with the build:** Results' and Check-in's sheets carry no old-look rule (Results rewritten whole — its
  dead venue filter too; Check-in's 72 kit rules folded into one layer); the dashboard's live strip and title-chip
  rules (17 kit rules, 16 `kx`/`legacy` uses); GameList's scoring half (10 kit rules, 7 `kx`). `KIT_FILES` += the
  board's, Results', Check-in's and the check-in page's sheets. **Left for their stages:** the dashboard's
  before/after-event views (207 kit rules, 36 `kx` — Stage 4), GameList's planning half and the game list's kit block
  (Stage 3), `TournamentAdminUI`'s legacy branch (never fold), the `legacy=` props on the settings, communication and
  summary pages (Stages 4–5).
- **Measured** (390 × 844, the test event; drawn in brackets): event header 87 (≈88); board's first row 247
  (≈250), Needs a score from 386 (≈399), board 1,474 (≈1,373 — the three semifinal rows' captions wrap to two
  lines, and the door is absent); Results' first waiting game 248 (≈247), Needs you spans all three divisions;
  Check-in's first team 327 (≈321), 6 teams above the bar (6); the desk board 852 (fits 900). Probes
  `.probe/stage1/probe.mjs` (A board → editor 1 tap · B finalize 2 taps · C Results' first screen · D check-in 1 tap
  · E a second browser's check-in in 29.5 s, no reload — a real write, undone · F tap sizes · G figures).
- **Verified** (2026-09-29): typecheck and `verify:changed` clean. Layout sweep of the 41 `admin-t-*` / `guest-*`
  screens at 361 / 390 / 768 / 1440: the warm baseline re-recorded with a scoped `--init` (395 entries fixed and
  dropped; 5 re-keyed, the same finding under a new name — the bracket editor's 4px spill, the scorekeeper's 42px
  "To score" at 768, the preview schedule's two pre-existing contrast pairs; nothing outside those screens
  touched); the Dark pass (`--theme=dark --dump`) adds nothing on a Stage 1 screen. The volunteer walk (Admin Design
  Continuity W5) as the gate account on a phone set to Dark, `.probe/stage1/volunteer.mjs`: 10 of 10 — warm screens,
  one "Up next", the G5 words, a score sheet that covers the bar and ignores a tap outside it, the gate's pinned
  bucket bar unchanged (46px, fixed, never the inline form), a team opening as a sheet. Hub v10 carries the built
  pictures and walk W3.
- **/simplify + /review (2026-09-29, before the commit).** /simplify: one poll hook for the three game-day
  screens (`lib/hooks/useVisiblePoll.ts` — the board's J1-086 poll moved onto it too); Results judges each game's
  band once per read (not four times per keystroke) and `tzOffsetMinutes` keeps one formatter per zone; a
  refresh reads only what game day changes (Results: games + teams; Check-in: the board) — the divisions and
  venues once per tournament; the timeless-game rule lives once, in `gameWindowState` (`lib/game-live-state.ts`),
  read by the dashboard API and Results; the context strip and the help drawer read `isGameDay` (the plumbing was
  already on the tournament); the inline bucket bar wins by weight, not file order; unused RepKit props dropped.
  Skipped, on purpose: `NumberStepper` (its box, numeral and a11y names differ from the ruled editor), one
  select/search recipe for Results and Check-in (alike, not copies — different paddings and phone behaviour), and
  a grid for RepKit's caption-first + beside row (the caption must stay inside the row's one button; its 7.5rem
  reserve fits "Finalize" — a longer word or a second caller needs the recipe's own rework). /review (high-risk
  tier, five lenses): **a pending forfeit opened in the editor offered only Save score, which would record the
  nominal margin as a played result and lose the forfeit** — the editor now offers Finalize on every unchanged
  waiting score (finalize promotes a pending forfeit to a forfeit); **stale reads could paint** — a slow refresh
  landing after a tournament switch, a newer read or a write (Results), or after a volunteer's optimistic check-in
  (Check-in) — both now drop any read that is not the newest, a write supersedes reads in flight, and Results'
  poll also pauses under a row's Finalize; the scorekeeper said "Needs a score" on games not yet played — it now
  says "Scheduled" until the game's time has passed (the board's rule); the rain-delay link waits for the org
  before reading the plan; a switch of tournament resets Results to Needs you; Playing now's "more" opens Needs
  you; a division whose next-round game is played and waiting reads "in progress", not "to play". Security,
  data-contract and blast-radius lenses: clean (every new query org-scoped; the dashboard response's one consumer
  merges onto `EMPTY_GAME_DAY`; every removed export has no importer; RepKit and the page header changes are
  opt-in). Reported, not fixed (pre-existing): a game's LENGTH has three readings — the dashboard API takes the
  game's own, else the tournament's, else 60 (it skips the division's); Results and the Schedule take
  `resolveGameTiming` (game → division → tournament → 90); the scorekeeper, which holds no tournament settings,
  game → division → 90. A scheduler-built game carries its own length, so they agree on it; a game with none can
  move between "Playing now" and "Needs a score" at different minutes on the three screens. The division line's plural round name comes from the route's old `roundLabel` (a double-elimination
  "Winners Bracket" reads "Playoffs"); `hasGamesToShift` (API) and `hasUpcomingGames` (schedule) are two copies
  of one rule.
- **Found, not fixed:** `ExportMenu`'s buttons are 32px on a phone (29px wide at 768) — shared by 47 screens, the
  admin's recorded convention; the context strip and the help drawer still read the date-only phase (the frame's
  and help's); the strip's "2 games to finalize" repeats the list heading (F39); the shared table recipe's chevron
  cell (`.go` / `.goLink`) sits 3px above the row's centre on every RepKit table (Check-in's desk table, and the
  Club's rep-team tables) — the recipe's fix, with its own pixel proof; Teams' "Past Due" badge fails Dark contrast
  (4.41:1) on another session's uncommitted `teams-admin.module.css` change — theirs.

## 6b. Stage 2 — Teams and registration, as drawn (2026-09-30)

Drawn at true size on the hub's **Stage 2** tab, phone and desk, before (captured 2026-09-30 on the test event,
after Stage 1 and the defects pass) and after (drawn Warm; a Dark copy cloned at load). Prompt
`TOURNAMENT_ADMIN_REDESIGN_STAGE2_DESIGN_PROMPT.md`. Measured figures below are read from the drawing
(`.probe/s2/measure2.mjs` → the hub's `{{M:s2-*}}` keys), re-measured at build as Stage 1 was.

- **T1 · Teams opens on the teams (Q 6.1, ruled 2026-09-29).** The title band as Stage 1 built it (Export ·
  Registration questions · Add team, the screen's one lime · Help). One toolbar line: the division dropdown (its
  options say "· 1 to review") and the board's three tools at 44×44 (today 32 wide; Randomize wears the shuffle
  mark, not today's "reload" arrows). Then **one section card, "At a glance"** (heading inside, 16/700 — words for
  `/marketing`), **of three closed rows**: Registration health (score with its scale as the lead mark, "78/100";
  "Every division · 10 missing info" — only what no neighbour says; down chevron, keeps the `registration-health`
  anchor), **Payments** (this division, "$1,025 of $2,850 in", one figure in three states: "past due" in the danger
  ink only once a due date has passed, "to collect" in plain ink before, "All collected"; down chevron; opens to
  today's panel; **closed by default** — today open at 287px and remembered), **Registration open** ("6 of 6 spots ·
  full", down chevron; it **expands in place** like its neighbours, and opened it holds Close registration under one
  sentence, "New teams can't sign up for U11 Girls. You can reopen it any time."; Reopen keeps today's
  published-schedule warning). The counts card goes (each fact is said once elsewhere). Then the division's teams
  in **one frame**. **First team ≈469px on a phone (today 783, behind the bar), 3 teams above the strip (today
  none); desk ≈519px (today 687).** (The "At a glance" heading costs 32px and the fourth team on screen one; the
  first draft, without it, measured 437 / 4 / 487.) At a desk Teams is a **table** — Team · Coach · Slot · Payment, the pools,
  the review queue and the waitlist as band rows, heading row in the display face — because Payment is read down
  the column; status is not a column (the band says it).
- **T2 · A pending team is on the screen (F41).** The division's pending teams are the **first band, "To
  review"**, each row "Coach Blaze · registered May 8" with a worded **Accept** beside the chevron (olive, A12;
  44px on a phone, 38 at a desk, where it appears in that band only — G4's desk rule). Teams opens on the first
  division with a team to review, else the remembered one. **Accept: 5 taps → 2** (the row's Accept, the confirm
  that says whether an email goes). Where the band lives is ask A16.
- **T3 · A row opens the team (rule 3, F45).** The whole row opens the team's record in the admin kit's **form
  window** (KitDialog form: full screen with ← on a phone, the phone's Back closes it; a window at a desk).
  Title = the team's name, **and the title is the name's one editor** (the bill room's title slot, 2026-09-04: no
  required marker; an empty name is refused in words), one status chip + "Red Team 2 · Red Pool · U11 Girls".
  Payment first (facts, not narration: "Owes $475 · deposit due May 28 · balance due Jun 7 · past due";
  **"Mark paid · $475"** — Check-in's own sheet button — and the two amounts, saving as they change); Coach (house
  dates; "Resend the access link" worded, still asks); **Team details save as you go** (coach, email, seed — the
  name is edited in the title, so not asked twice; the Edit window retires, edit autosaves 2026-09-24; **Seed absent
  for an Exhibition**); notes; answers; Registration (Reject for an accepted team — "Rejecting it frees Red Team 2",
  true: `api/admin/teams` releases the slot); **Delete ends the body**, alone, asking first (today's two-step for a
  team with games kept). **The foot is named Previous / Next with the position** ("‹ Falcons U11 Girls · 3 of 8 ·
  Ravens U11 Girls ›"; at a desk "3 of 8 in U11 Girls"), in the list's order (review band, pools, waitlist) — the
  portal's form for a record opened full screen from a list (the depth chart's player, F-43), so a payment run is
  Mark paid → Next per team. A pending team's record opens on the decision: Accept (the record's one lime) · Reject, and a sentence
  that says the truth about a full division ("Accepting puts Blaze on the list of teams that need a spot" —
  `claimNextOpenSlot` returns null when full). Nothing new is offered (no single-team "Move to waitlist").
- **T4 · The pool board's shape (F16, F40).** One frame per division, a band per pool with its fill ("Red Pool 3
  of 3"), the waitlist and "Accepted — needs a spot" as bands in the same frame; each team one row (the name, then
  "Red Team 2 · Coach Storm · Owes $475"). No status badge under a pool band. Swap mode drawn: a note with the
  accent edge ("Tap two teams to swap their places" + Done), a 44px swap mark per row, the first choice shown by
  its mark turning olive (the row is not tinted). **Move a team to the other pool: 4 taps → 4** (a swap is two teams and a confirm), every target 44px.
  Waitlist without an open spot: no button, the caption says "waits for an open spot" (today a lime "No Slots"
  button that does nothing).
- **T5 · One colour per status, words not glyphs (F17).** The band a team sits under says its status once. Where a
  chip shows (the record; a row whose status differs from its band) it uses **the club tryouts' tone map**
  (`TRYOUT_STATUS_TONE`: pending warn · accepted good · waitlisted and declined neutral) — no new tone. Rejected is
  neutral (a decision, not a problem). Payment reads as Check-in does: "Paid" plain, "Owes $475" amber; "past due"
  is said once, on the Payments row and in the record. The 9px letters and 7px "$" glyphs go. Words to `/marketing`,
  with a flag: the game state is "Pending Review" (§245) and the club's tryouts say "Pending review" — one spelling.
- **T6 · A division without pool slots, and Exhibition.** Bands are statuses (To review · Accepted · Waitlist; Rejected
  only when chosen in the view). **What does not apply is absent:** no Pools grouping where a division has no pools,
  no "Pools aren't turned on" note, no Randomize (today it answers "needs at least 2 pools"). A division with pools
  but no slots keeps the grouping (bands = pools + "No pool yet"); its in-row pool dropdown moves into the record
  and the bulk "Move to pool" (the standard: no controls in a row) — **+1 tap for one team**, bulk unchanged.
  **Exhibition changes one thing on Teams: Seed is absent.** It keeps its pools: the prompt's "an Exhibition has no
  pools" is not what the code does (`lib/public-pages.ts`: "An Exhibition HAS a round robin"; nothing in
  `registrations/page.tsx` branches on format).
- **T7 · The Club seams (A5), drawn as today.** Payments (the second closed row; Club Stage 7 — fees to the club
  ledger), "Add my team" (a star in the title's icon line while it applies; the "Your team" chip in the record's
  identity line), "Link to a rep team" (a line in the record's Coach block opening today's picker). The demo's
  `registration-health` anchor stays on the health row (F46 for `/demos`).
- **C1 · Communications is one list (F44).** A message per row (title; "Jun 13 · On the site, pinned · Emailed to
  18"; a failed send the one coloured word), one filter pill (All · On the site · Emailed), "Removed from the site"
  as a band at the foot (the record is kept, so "removed", not "deleted"), every row opening today's Edit Post or
  Email Details. The empty state keeps one sentence; the header's + is its one action (no second lime). At a desk a
  table: Date · Message · Where it went · Reached.
- **C2 · The composer says the true thing (F18, F42, F43).** The kit's form window (full screen on a phone),
  the five templates as one **"Start from" dropdown** ("A blank message" first — a form choice is a dropdown, the
  pill stays the filter's shape, and it returns ≈130px above the Title on a phone), the tinted Channels panel → a plain "Where it goes" block with 22px boxes on
  44px lines. **Drawn as A14 option 1:** under "Email the teams", three dropdowns — Teams (Accepted · Waitlisted ·
  Waiting for a decision · Every registered team), Division, Payment (Any · Owes · Paid) — and a live count from
  the send's own rule; the send button says the same number ("Post and email 18"). The email's Division is one
  division or all (the send accepts several — one is drawn as the common case, a guess a first director would
  correct). A site post keeps today's multi-division checklist, renamed "Show under", at 44px lines. The Tournament plan sees each Plus choice as one plain 44px line — a padlock, the
  words and the plan's name (A6), Stage 1's "Running late?" form, **no dashed box** (a dashed edge means a record
  that has left a list, K-24) — opening the `?plan=` door; no price, no gate change. Option 2 (no picker, hint gone) is drawn beside it.
  **Message every team: 3 taps → 3.**

**The formatting check** (the hub's Stage 2 tab, last section) ran Stage 1's sixteen departures, §3.6 as amended,
§3.10.7–8, K-08, one lime, tinted panels and the required marker against the drawing before the owner saw it. One
named question is left to A13: at a desk Accept appears only in the To review band, against K-08's "nothing
conditional beside the chevron" in a table — the band is the condition, as G4's desk drew Finalize. **A second,
independent reviewer** then checked the drawing and its rendered pictures against the same written rules and
found two departures, both fixed before publishing: the required asterisk was drawn red (the owner ruling of
2026-08-26 and the kit's `.req` make it the label's own ink) and swap mode tinted the chosen row (§3.3: an item row
is never tinted; selection mode marks a row by its box alone). It confirmed the three closed rows, the record's
16/700 block headings, the composer's checkbox rows, the lens and "Removed" band, and the swap note's accent edge
(the kit's own `Callout`) as the standard's forms.

**The `/design` review (2026-09-30), twelve changes, all applied to the drawing on the owner's "go ahead"** (each
is a row in the tab's formatting check, D1–D12): the record gets named Previous / Next at its foot and Delete ends
its body (D1); the Registration row expands like its neighbours and Close moves inside it under its consequence
sentence (D2 — a lone "Close" read as "close this panel", and closing asked nothing); the health caption says only
what no neighbour says (D3); the readouts become an "At a glance" section card (D4 — without a heading they read as
a second list of records); Randomize wears the shuffle mark (D5); templates become a "Start from" dropdown (D6);
plan locks lose their dashed boxes (D7); selection mode's bar docks above the phone bar, two lines, decisions first
with Reject set apart, money second (D8); the record's name is its editable title and the Team name field goes
(D9); the payment line states facts (D10); the health score shows its scale, "78/100" (D11 — Stage 1's
schedule-health row takes the same form when next touched); the Payments figure has three states (D12).

**Stage 2 taps (organizer, phone):** accept a pending team **5 → 2**; open a team's record **1 → 1** (a 24px chevron →
the whole row); record full payments team after team **per team: a chevron + typing the amount → Mark paid + Next,
no typing** (the record's named Next); move a team to the other pool **4 → 4** (every target 44px); message every
team **3 → 3** (to the teams it names — today 22 while it says 18).

**The asks (A13–A17), each on the Stage 2 tab with options, a recommendation, the tradeoff and a checkbox per option:**
A13 which Teams rows earn a worded action (rec.: Accept on To review; Promote / Place only when a spot is open; none
on placed rows) · A14 Communications' targeting (rec.: build the picker in Stage 2 for Tournament Plus; the
Tournament plan sees it locked) · A15 the email that reaches every team (rec.: fix now as a defect, like A8/F40) ·
A16 where a pending team shows (rec.: first band of its division; alt. a "Needs you" lens across divisions, A10's
shape) · A17 the bulk-select row (rec.: Teams keeps its own until a second screen needs a shared one — tagged
"shared — Club Tier's money tables draw tables too"; drawn with its bar docked above the phone bar). T1 and T3 carry a ruling each.
**⚖ ALL RULED 2026-09-30 AS RECOMMENDED** (owner: "I agree with your recommendations, go ahead with the build
prompt"), T1 and T3 as drawn, including the "At a glance" heading's cost (first team ≈469px, 3 on screen one).
The build prompt (`TOURNAMENT_ADMIN_REDESIGN_STAGE2_BUILD_PROMPT.md`) carries **P1**, one placement the drawing
does not show — Promote / Place on the Tournament plan (recommended: no button on the row; the record's
Registration block carries the lock line) — to the owner at the build's start.

**Stage 2's build prompt's definition of done** includes retiring the old look of every file it
rebuilds (the Teams page and `teams-admin.module.css`, `RegistrationHealthPanel`, Communications and
`communication.module.css`), held by `npm run check:old-look` and the strict admin colour gate (Admin Design
Continuity's closing step made them this program's).

### Stage 2 — as built (2026-09-30; prompt `TOURNAMENT_ADMIN_REDESIGN_STAGE2_BUILD_PROMPT.md`; owner walk §254 closed 2026-10-01)

**Owner calls at the build's start (2026-09-30, all as recommended):** **P1** — on the Tournament plan Promote /
Place is a lock line in the record's Decision / Registration block, no row button. **P2** — a pending team that
already holds a slot stays on its slot row with a PENDING chip and Accept; "To review" holds pending teams without
a slot. **P3** — add a migration so an email keeps who it reached.

**Three commits, in the prompt's order:**

- **Part 0 — `f4a4cc79`** (F42, F43). Migration **314** (`announcements.email_recipients jsonb`) applied to dev and
  **prod 2026-09-30**, snapshots and dictionary refreshed. `lib/announcement-recipients.ts` is the one recipient
  rule: an untargeted send reaches **accepted** teams only (it reached every team, rejected included — "22 while it
  says 18"); anything else is advanced targeting (Tournament Plus). The send stores who it reached; the free cap
  counts recipients; on the Tournament plan division visibility is a lock line (`PlanLockLine`).
- **Part 1 — `12aee778`**. `KitDialog` learns a record's two parts: `steps` (named Previous / Next with the
  position — "3 of 8", at a desk "3 of 8 in U11 Girls"; 48px on a phone), `KitTitleField` (the record's name as its
  editable title: dashed rule, pencil, no marker), a `status` slot in the head, and `ariaLabel`; `SavePill inline`.
  Club Tier 3a's screens were free to start after it.
- **Parts 2–3 — `aab3a3f4`** (Teams T1–T7, Communications C1–C2), after `/simplify` and `/review`.
  - **Teams.** One frame per division in `ClubRow` (the admin's one row recipe): To review · each pool with its
    fill and every slot (an open slot is a row) · Waitlist · "Accepted — needs a spot" (`lib/tournament-teams.ts`
    `buildSlotBands`; a division without slots: `buildListBands`, by status or, with pools, by pool with "No pool
    yet"). At a desk a table (Team · Coach · Slot · Payment). One worded action per row (A13): Accept · Promote ·
    Place, olive on white. The whole row opens `TeamRecord` in the kit form window: Decision or Payment first,
    Coach (with the rep-team line for League / Club, T7), Team details that autosave (Coach, Email, Seed, Pool),
    Admin notes, Registration answers, Delete at the end. Teams lands on the first division with a team to review
    (once per event, never over a link naming its own division or bucket). "At a glance": Registration health
    (`78/100`, caption from the counts, opens today's panel; the tour anchor `registration-health` kept as a
    literal), Payments (three-state figure, closed by default, Tournament Plus), Registration open / closed (close
    and reopen in place). Teams keeps its own selection row (A17): 22px boxes, a bar docked above the phone bar.
    Swap marks the chevron olive and never tints the row. The F41 attention banner says "N in this division · M
    more in other divisions". Words: `lib/registration-words.ts`.
  - **Communications.** One list (All · On the site · Emailed), removed posts in a foot band; desk table (Date ·
    Message · Where it went · Reached). A message sent both ways is one record with its email's delivery inside
    ("See who it reached", "Copy failed"; an email from before migration 314 says its list wasn't kept).
    `MessageComposer` in the kit form window: Start from (a dropdown), Title, Message, Where it goes; the Plus
    picker (Teams · Division · Payment) with a live count from the route's new **`preview-recipients`** action (the
    send's own rule, same scope and plan gate) that the send button repeats ("Post and email 18"). Words:
    `lib/communication-words.ts`.
  - **Shared, small:** `components/admin/tournament/ScreenParts` (RecordSection, joinDots, a plain record button, a
    22px checkbox, the title band's worded button). No new kit part.
  - **Old look retired** in every rebuilt file: the old-look baseline re-recorded with `--init`; both sheets off the
    strict admin colour debt list; `admin-common`'s `.rowSelected` and notifications' `.channelRow` (dead) removed;
    55 layout-baseline entries pruned, all on these two screens.

**Build-time calls (on walk §254):** the save word sits in the record's head (the form window's status slot);
confirms are kit question windows on top of the record; an open slot is a row (a swap target); an email's
recipients open in place inside its record; the payment-reminder window moved onto the kit form window, words
unchanged; "Every registered team" reads **All except rejected** (`/marketing`) and never reaches a rejected team;
on a phone the view settings are a `BottomSheet`.

**Measured (the test event):** first team at 390 **478px** (drawn ≈469; the three glance rows are the kit row's
59px), 3 teams on screen one; at 1440 **516px** (≈519). Accept 2 taps, open a record 1, Mark paid 1. Text contrast
0 findings, Warm and Dark. Scoped layout sweep (361 / 390 / 768 / 1440): no new findings.

**/simplify, then /review (high-risk tier, five lenses) before `aab3a3f4`.** Fixed: the record could send two saves
at once while stepping teams (and re-base the next team's form) — it now saves one change at a time on a chain;
a Mark paid could be overwritten by a typed figure's pending autosave — every record action saves first; half an
email autosaved into `teams.email` (the claim key) — held, never sent (**new word "Enter a full email address to
save it." — owed to `/marketing`**); a stale first `load()` could flip the chosen division, and every division
change re-read the whole event — functional setters, `load` no longer depends on the division; an older slot read
could paint over a newer one — a per-read sequence; a team on a slot in a pool missing from the read vanished —
`placed` counts only drawn slots (test); Communications blanked after every send — only an event's first read
blanks; a template counted as unsaved — the composer re-bases the guard; push no longer said it posts to the site;
the locked attention banner lost Upgrade. Refuted: the bulk bar's old email hint (the Accept / Reject question
names the email), the "Your team" chip on the row (T7 puts it in the record), a double Next skipping teams.
**Reported, not fixed:** a single waitlisted team accepted by hand keeps its `waitlist_position` (server); the
shared export menu is 32px on a phone (47 screens); two quick actions on different rows share one `working` key
(as before); the communications GET has no capability check beyond the org (house pattern); Send can be pressed in
the 250ms before the count shows (the send applies the same rule).

**Not walkable, probed instead** (`.probe/s2b/openspot.mjs`, read-only): Promote / Place on rows and the P1 lock
line in the record — no division on either test event has an open slot, and the free club's Classic is archived.
The probe empties one slot in the reads; the Tournament plan run is the free club's own event shown the
Championship's U11 Girls. Captures on the hub's Stage 2 tab ("Built").

**Help:** `/docs` 2026-09-30 — the tournaments guide's registration, review, pools and Communications sections and
FAQs rewritten for the new screens; two new FAQs (a team's record; who an email reached); a stale "League Plus" plan
name removed.

### Stage 2 follow-ups from the §252 walk (owner, 2026-10-01; committed `4db0faab` + record `974c9293` 2026-10-01, after /review and /marketing)

Raised by the owner while walking §252, each ruled in the conversation and built the same day:

- **Export is one button** — no chevron; it opens the formats, Excel first (every export menu, platform-wide).
- **A waiting count is the amber pill** — the division picker is a menu, not a `<select>`: each division with teams
  to review wears the rail's amber count, and the closed box an amber dot when another division has some. "· 1 to
  review" is gone from the name.
- **The kit header's Help is the bare "?"**, 44px on a touch width (≤768).
- **A team's record reads first and edits whole** — the header pencil turns the WHOLE record into fields and ✓ turns
  it back (the practice plan's format, owner: "it should be our standard"). Team merges the old Coach and Team
  details sections; Placement holds Seed and Pool; reading shows the saved values. The save word is the portal's
  floating pill at the window's foot, not a word in the head.
- **The Teams toolbar is one line in every division (TB1–TB4, hub tab "Teams toolbar", ruled "A, as drawn" without
  the note under a search).** The division, Search, Filter and Tools — on a pool board too. Tools holds Select many
  (Teams), Swap and Randomize (Pools) and Registration questions (Setup), each only where it applies: Swap needs the
  whole board, so a search or a filter takes it away; Randomize acts on the division and stays. A search or a filter
  on a pool board lists the matches under their own pools, open spots gone (`narrowSlotBands`); the dashboard's
  bucket links narrow the board the same way (they used to fall back to a status list). At a desk one Filter menu
  holds Status, Payment and Group by, and counts the filters on; on a phone the Filter square opens the same sheet.
  Tools is the coaches portal's `CoachToolbarMenu` (a menu at a desk, a sheet over the bar's top on a phone); the
  page declares `--coach-foot-clear` as the admin's bar + context strip + home indicator for it. Registration
  questions left the title band. **Two build-time calls, put to the owner:** a filter is no longer remembered
  between visits (one left on would open a board as a list with nothing saying why — the division and grouping
  still are), and a payment filter lists only accepted teams (Unpaid listed teams still to review, whose Payment
  reads "—"). Proven by `.probe/teams-toolbar.mjs` (read-only; 390, 360, 1440; Warm and Dark): four 44px controls
  on a phone, the division box 207px at 390 and 177px at 360; "storm" on U11 Girls lists Storm under Red Pool;
  Payment · Unpaid lists Storm, Ravens, Comets and Royals under their pools. The scoped layout sweep adds nothing
  (three touch-floor findings it raised at 768 — the Filter button's floor cancelled by its own base rule, the
  search input 2px short inside its field, the kit "?" floored only to 760 — fixed).
- **Walk: closed by the owner 2026-10-01 without one of its own** ("close it all, they are all complete"), together
  with §252 and §254. §254's W4 as ticked described the screen before these follow-ups in steps 1, 4, 6–10 and 13
  (the "· 1 to review" name, the title's pencil, the head's "Saved", the Team details section, the separate Swap /
  Select many / Randomize buttons) — the ledger records it.
- **Words — `/marketing` 2026-10-01: every new word kept as built** — Tools (the Schedule's menu already wears it)
  and its groups Teams · Pools · Setup; Filter, Status, Payment, Group by, Reset filters, "Filter, N on";
  Registration questions (sentence case, as every menu item; its destination page's Title Case heading is older);
  "Teams waiting in another division", "N to review"; Team, Placement, Coach's email, Edit this team / Done
  editing, "No notes yet."; and the two held-save words owed since Stage 2's review, "Enter a full email address to
  save it." and "Give the team a name to save it.". Two help sentences warmed ("when you're done"; "Swap comes back
  when every spot is showing again").

## 6d. Stage 4 — After the event, as drawn (2026-10-05)

Drawn at true size on the hub's **Stage 4** tab, phone and desk, before (captured 2026-10-05 on the demo's finished
Season Opener, the free and Plus test clubs) and after (drawn Warm; a Dark copy cloned at load). Prompt
`TOURNAMENT_ADMIN_REDESIGN_STAGE4_DESIGN_PROMPT.md`. Drawn figures are read from the drawing (`.probe/s4/measure4.mjs` →
the hub's `{{M:s4-*}}` keys). §6c is left for Stage 3. **A18 ruled at the start (owner, 2026-10-05, as recommended):
Stage 5 owns the dashboard's before-event view** (the checklist and guidance card, with their share of the 207 kit
rules), so Stage 4 draws and retires the after-event view only; Stage 5 also takes the draft board's copy-into-this-draft
reuse and F55.

- **D1 · The finished board.** Title band as Stage 1 built it (+ the bare "?", which now holds the guidance card's task
  list — the help drawer already reads the same list). **"How it finished"** (words for `/marketing`): one section card,
  a row per division — a champion with a trophy and the final it won ("U11 champion · beat Riverdale Rapids 5–4 in the
  final"; the runner-up and scores are already computed by `deriveTierChampions`, the board's read passes the name only
  today), a division without a final with its top team, record and "no final", no trophy (F50); a foot line, the
  weekend (teams · games played · money in three states). Head action **Copy champions link** (the public page, every
  plan; absent when Standings is hidden; on a phone the boxed 44px icon, an action). **Next year**: one sentence and the
  board's one lime, **Reuse this setup**. Summary as one door card, named "Summary" ("The weekend's recap — a champions
  link to share, and a printed page for your records"). The strip above the phone bar ("Review event summary", shown on
  every page of a finished or archived event) **gives way on the board** — the page already carries the door — and is
  not offered on a plan without Summary; it stays on the event's other pages. "Teams" in the foot line counts the
  teams that **played** (8 in the demo; today's 9 is the registrations). The guidance card and the wrap-up card go (F47). **Archive** leaves the board on unlimited
  plans (into the event's record, A20) and stays on the Tournament plan as next year's path, beside the one-slot
  sentence (F49, A23); there Summary and Reuse are lock lines (Summary's in the door card's own place, after Next
  year) and the board has no lime. A win–loss record takes a hyphen ("3-0-0"); the final's score keeps its dash. Phone: result ≈196px (today 547),
  Reuse ≈513px (today no action). Desk: result ≈195px, Reuse ≈345px; one screen.
- **D2 · Reuse this setup — the one flow.** Every door opens the wizard's reuse step with the event chosen (no source
  pick; Cancel + the lime): the board's lime, Summary's Next year, the Completed rows of the Tournaments list and Past
  tournaments, every event's record. Summary's own window goes (F33). Content restyled: the five areas as the composer's
  checkbox rows (title + one caption), "Never copied" as one sentence, the warnings as a white callout with an amber
  edge; fields and rules unchanged (both dates required, from today). **Full screen on a phone** — a change to the
  wizard's frame, tagged "shared, Stage 5", its own choice in D2's ruling. It lands on the new draft's board (Stage 5's
  checklist) with a toast. Taps from the board: 4 + typing, in a different window → 2 + the dates.
- **D3 · Summary.** One name, **"Summary"** (the rail's word) for the title, the board's door, the lock lines and the
  printout — today "Post-event summary", the strip's "event summary" and Plan & billing's "post-tournament summaries"
  (words for `/marketing`). Title band with Copy champions link and Print (44px icons on a phone, white 34px buttons at a desk);
  How it finished (the board's card); **the weekend** as one card of four figures (24px, 2×2; "8 teams", the teams that
  played — not "9 · 8 accepted"); **Next year** open, a white
  button (the board keeps the lime). The division recap's registration counts, "Leader", the Plus line (F53) and the
  four 143px cards go; the League Plus / Club line kept word for word for `/marketing`. The `post-event-summary` anchor
  stays on the title band. Phone: figures card ≈343px, Next year ≈548px (today closed at 1,553), the page ≈875px (today
  1,755). **The printed page** (Letter, drawn true size): the club, event and dates; How it finished as Division · Team · How it
  finished (a column heading true for a division with no final); the weekend; each division's final standings (W-L-T,
  hyphenated); a footer — no admin frame (J1-110). The Tournament plan: the title, one sentence, one lock
  line (no full-page upsell, F38).
- **D4 · Past tournaments.** **Every finished event's one list** (the `/design` review): Completed · Archived · Sealed
  records; the Tournaments list holds what's ahead. One name (title and tab "Past tournaments"); no eyebrow; Public ledger a door (icon on a
  phone, white button at a desk). One frame, bands **Completed · Archived · Sealed records**; a row (name; dates · public
  site live/offline) opens **the event's record** (D5). Sealed records on the Tournament plan: one lock line (today a
  dashed box). The archived record on a full one-slot plan says "Bringing it back needs a free slot. Your plan has one, and ‹the
  event› holds it." before any tap, with the lock line (today the list's menu fails after the tap). A record's line says
  its dates once; its Status opens with the day the event finished ("Finished Jun 14. Its public site is offline…") and
  never repeats the chip — no archive DATE is drawn, because the product stores none. Desk: a table, Tournament · Dates · Public
  site, Reuse setup in the Completed band.
- **D5 · The Tournaments list.** One name, "Tournaments" (tab and help say "Manage Tournaments" — `/marketing`); no
  "Organization" eyebrow; New tournament the one lime. Statuses as bands, **Live · Draft only** — Mark complete moves an event to Past tournaments, and an olive door at the
  list's foot says "Finished events are in Past tournaments" (the `/design` review; A22); the status word for a running
  event "Live" vs the help grid's "Active" flagged for `/marketing`; a 60px row per event in one frame (today a 222px
  card); no row action.
  The callouts and "How statuses work" go (Seal's warning into its confirm). **The event's record** (the kit's form
  window; reads first, the pencil edits Details whole; named Previous / Next): Status in words with the changes that
  state allows, each a white button that **asks first** naming the public site and the slot (Activate · Mark complete ·
  Move back to draft · Reopen · Archive · Bring back); Next year; Permanent record (Seal); Details; Delete at the end.
  Drawn confirm: "Move Riverdale Invitational back to draft?" with **Move back to draft** (the verb of the button that
  opened it; today written in silence, F35). The desk record is drawn opened from Past tournaments ("1 of 1 in
  Completed"); its window buttons are 34px. Desk: a table, Tournament · Dates · Teams.
- **D6 · The Exhibition** (illustrative; no test data holds one). No winner rows, no champions link; the weekend's
  figures, Copy the **Standings** link, Next year (A24, F51).

**The formatting check** (the tab's last section) ran Stage 1's sixteen departures, §3.5–3.7, §3.10, K-08 and every
ruling since Stage 2 (one control height 34px, the white action button, door vs window-opening action, no dashed lock,
record reads first + names its neighbours, no club name above a title, one spelling). One named exception: Reuse setup
in Past tournaments' Completed band only (K-08, as Teams' Accept). Flagged for `/marketing`: four one-spelling pairs. **A second,
independent reviewer** then read the drawing and its rendered pictures against the same rules: one departure (the phone
record drawn without its named Previous / Next foot — fixed, "1 of 1" on the free club's one-event list) and three check
rows that claimed more than the pictures showed (Records; "Summary's door once" while the frame's strip still offers it,
F39; the type ladder stated short) — reworded. It confirmed the button roles, every lock a plain line, the required
asterisk's ink, 34px desk / 44px phone, no tinted rows, and the Exhibition's standings link.

**The `/design` review (2026-10-05), thirteen changes, all applied to the drawing on the owner's "go ahead"** (each is
a row or a note in the tab's formatting check): (1) "Teams" counts the teams that played (8), not today's 9
registrations — on the board, Summary, the print and the record; (2) one name, **Summary**; (3) the strip above the phone
bar gives way where the page carries the same door, and is never offered without Summary (it appears only after an
event, so it is Stage 4's, not the frame's — the first draft left it as F39); (4) Copy on a phone is the boxed 44px icon
(an action), never a bare olive glyph (a door's look); (5) **each event lives in one list by its phase** — the
Tournaments list holds what's ahead, Past tournaments every finished event (A22 sharpened: the first draft had a
Completed band on both lists, same rows and record); (6) a win–loss record with a hyphen, one format (3-0-0); (7) the
print's How it finished columns true for every row; (8) a record's line says the year once; (9) Status opens with the day
it finished, never repeating its chip (the review proposed "Archived Jun 15"; no archive date is stored, so the event's
end date is used); (10) a full plan names the event holding the slot; (11) the confirm says "Move back to draft"; (12) the
free board's Summary lock in the door card's place; (13) the door card says the link is to share and the printed page is
for your records (the printout carries the money). **+1 found re-checking the pictures:** the desk record and its
confirm drew 44px buttons; 34 on a computer (3 Oct).

**The asks — ⚖ ALL RULED as recommended** (A18 on 2026-10-05; A19–A24 on 2026-10-06 from the owner's paste-back, which
also ruled D1, D2 — the reuse step full screen on a phone included — D3 and D5 as drawn): **A18** before-event view → Stage 5 (**ruled 2026-10-05**) ·
**A19** which doors open Reuse this setup and where it lands (rec.: four doors, one step — the board, Summary, Past
tournaments' Completed rows, every record; Summary's window goes; lands on the new draft's board) · **A20** a status change asks first and lives in the event's record (rec.; Archive leaves the
board on unlimited plans) · **A21** what the Tournament plan sees (rec.: an honest lock line at each Plus door; the
champions link on every plan) · **A22** the list has no door (rec., sharpened by the `/design` review: each event in one list by its phase — the
Tournaments list what's ahead, Past tournaments every finished event, the same record; the list's own door to the
frame's owners) · **A23** one-slot next year costs this year's site (rec.: say it on
the board, route to `/strategy`) · **A24** the Exhibition names no winner (rec.). Rulings per drawing: D1, D2, D3, D5 — all as drawn.

**The build prompt** is `TOURNAMENT_ADMIN_REDESIGN_STAGE4_BUILD_PROMPT.md` (written 2026-10-06). It orders the work Part 0 (one read and one definition per
figure for "How it finished" and the weekend — today the board's and Summary's routes each build their own) · Part 1
(one reuse opener, every door) · Parts 2–3 (the board, Summary and its print) · Part 4 (the event's record and the two
lists), and puts two placements the drawing does not show to the owner at its start: **P1** a division with tiers
(rec.: its top tier's champion, today's admin rule, the tier named when there are tiers; the public page keeps every
tier) and **P2** a bracket whose final was never scored (rec.: where its top team finished, "final not scored", no
trophy). It also carries three facts the drawing could not: Mark complete emails the teams when the event's setting is
on, so its confirm must say so; the archive sentence's "change its status on the Tournaments list" stops being true
and is rewritten; and each new reuse door must join the clone route's analytics allow-list.

**At the build's start (owner, 2026-10-06, all five as recommended):** **P1** a division with tiers = one row, its
top tier's champion, the tier named only when the division has tiers (the public page keeps every tier) · **P2** a
final never scored = where its top team finished, "final not scored", no trophy; a division where no game has a
result has no row · **P3** (found at the start) the copy action follows what the public champions page will show —
it names champions only once EVERY playoff game in the event has a result and a top-tier final is decided, and an
event with no playoffs never names any — so the champions link when it names one, otherwise the Standings link
(the Exhibition's form) · **P4** (the drawing's note disagreed with) "teams" = the teams that played, but the money
counts every accepted team, as Teams' payments do · **P5** (found at the start: Event Settings has its own Draft /
Active / Completed switch and the game-day board its own Mark complete wording) all three doors read the record's
sentences from one home now; whether Event Settings keeps a status switch goes to **Stage 5**.

**The definitions (Part 0, written before any code — one sentence each, one helper computes them all,
`lib/event-recap.ts`):**
- **A division's finish.** Its top tier's decided final (the champions rule, `decidedFinalFor`: GF2 → GF → FIN of the
  first bracket group, scored with a winner, forfeits included) → the **champion**, the runner-up, both scores, whether
  it was won by forfeit, the final's date, and the tier's name when the division has more than one bracket; otherwise
  the team **first in the published standings** (`computeTournamentStandings`, the read Summary's ranking uses since
  `936655a9`) with its W-L-T, marked **final not scored** when the division has playoff games but no decided top-tier
  final and **no final** when it has none; **no row** when no game in the division has a final result, or when only
  playoff games were played and none decided (a bracket-only division with nothing to rank). Rows in the event's
  division order. **An Exhibition has no finishes** (A24).
- **Teams** — the teams that played: every team on either side of at least one game with a final result.
- **Games played** — games with a final result (status completed or forfeit), playoffs included; of them, **in the
  playoffs** = the playoff games.
- **Collected** — what every accepted team has paid (`total_paid`), with or without a fee schedule.
- **Still owed** — the sum of every accepted team's unpaid balance against its own fee (division fee in division
  mode, else the event's: `getEffectiveFee` / `owedAmount` from Teams' model), and **by how many teams**; the event
  **charged fees** when any accepted team has one.
- **The link to share** (P3) — `champions` when the public champions page will name a champion
  (`isTournamentPlayoffsComplete` + a top-tier champion among the accepted teams, the page's own reads); `standings`
  otherwise and for an Exhibition; **none** when the Standings page is hidden or the event isn't public (draft,
  archived).

**Not drawn — the build's work:** the print stylesheet; the clone route's options (unchanged); the confirms' one home
beside `lib/tournament-archive-words.ts`; the board's champion read (runner-up, scores, a no-final division's top);
**the old look's retirement** in every file Stage 4 rebuilds — the dashboard's after-event rules only (A18), Summary's
and Past tournaments' `legacy=` props and stylesheets, the Tournaments list's — held by `npm run check:old-look` and the
strict admin colour gate. "One control height" is in the tree (`d9302f6f`).

**Stage 4 taps:** run a finished event back **4 + typing → 2 + dates**; reuse from a list **2 → 2** (Past tournaments'
Completed row, in the rail); share the champions page **not offered → 1**; print the summary **2 → 2**, recap only; bring an archived event
back **no reachable door → 3 + the confirm**, a full plan said before the tap.

### Stage 4 — as built (2026-10-06; prompt `TOURNAMENT_ADMIN_REDESIGN_STAGE4_BUILD_PROMPT.md`; owner walks §275 + §276 owed)

**Committed on dev 2026-10-06, after `/simplify` and `/review`:** `8bdecc9f` Part 0 (one read and one definition
per figure — `lib/event-recap.ts`, `lib/event-recap-read.ts`, the words in `lib/after-event-words.ts`) · `e1d6e021`
Part 1 (one reuse opener for every door — `SetupWizardProvider` in the admin frame; `NoticePill`; `ClubRow`
`mark`/`external`; `CheckChoice` and the record styles in ScreenParts; `lib/tournament-status-words.ts`) ·
`8237fb15` Parts 2–3 (the finished board, `FinishedBoard.tsx` + `AfterEventParts.tsx`; Summary and its printed page;
the strip's summary door; P5 in Event Settings) · `211fcb1d` Part 4 (the event's record `TournamentRecord.tsx`, the
two lists, the set-status rules, the locked-results sentence, the ratchets locked). Help (`lib/help-content/tournaments.tsx`)
in the docs commit after them. No migration.

**Calls made while building** (each on the hub's Built part, for the walk to question):
- A **sealed** event never goes back to Active or Draft, from any status (the server holds it; the record offers no
  Reopen). Archive and Bring back stay open to it.
- **Bring back** is refused in words, before any tap, when the plan's slots are full (the holder named, the *More
  tournament slots* lock) or another live event took its public link (change it in Details first); a race on the
  link is a 409 in the same words, never a 500. Bring back is a change TO Completed, so its question says the
  results email when the route will send it.
- **Changing a public link asks first** ("Change the public link?"); name, year and dates autosave.
- At the slot limit **New tournament becomes the *More tournament slots* lock line**; a blank new tournament lands on
  its board; reuse lands on the new draft's board with "Draft created from …".
- The help **"?"** shows on the finished board only (Stage 5 owns the live board's header); the **Mark complete
  question stays open** until the change lands and says a refusal in place; "Leave setup?" asks only after a change.
- An event nobody played in, and an Exhibition, show **The event in numbers** instead of an empty How it finished
  (with the share note when Standings is hidden); the **money pair shows whenever fees were charged or anything was
  collected** (the definitions' "collected, with or without a fee schedule"); a division's row needs a game with a
  **final** result — a submitted score ranks no one; "Finished Jul 3" is said only once the last day has come.
- Summary's closing link is 44px tall at touch widths (the layout sweep's tap floor), in its sentence.
- The four screens' help "?" open their own sub-topic of the close-out article (`closeout-finished-board`,
  `closeout-summary`, `closeout-two-lists`).

**/review (high-risk, five lenses) fixed before the commit:** the board stayed blank after Mark complete until a
reload (its poll is off once finished — now it reads again); a sealed event could be reopened through Draft or
Archive first; the lists' counts read only the first 1,000 rows (now paged, `lib/supabase-paging`); Bring back's
unannounced email; a division of unfinalized scores got a row; two import UAT specs matched the old locked wording;
and four Low (the link race, money without fees, the empty finished board, the context's read race). Refuted or
left: a half-typed name is dropped on leaving the record — the walked Teams record does the same (one decision for
both, not taken here); a tied final reads "final not scored" (the public champions rule — routed); a board read that
fails shows its error and Retry rather than a partial board (kept: honest).

**Verified 2026-10-06:** typecheck clean; unit 5,807 / 5,807 (`event-recap.test.ts` 23, `tournament-lists.test.ts`
10); every gate in `verify:changed` green (schema parity red only on another session's dev-only migration). Read-only
probes (`.probe/s4b/probe2.mjs`, every write refused by a stub and recorded): share **1 tap**, the clipboard holds the
champions link · print **1 tap + the browser's**, one Letter page, only the summary on the paper · reuse **1 tap + the
dates + 1**, nothing written before Create, a refusal said in the window · Bring back **3 taps + its confirm**,
exactly one change sent, at the confirm; a full plan said before any tap · nothing a thumb taps under the floor at
390 / 360 (the strip's own link and Dismiss are older) · the Tournament plan's lock lines on the board, Past
tournaments and the list. Layout sweep (`--only` the four screens + the org list; 361 / 390 / 768 / 1440; Warm, then
Dark with `--dump`): no new findings; 44 entries the old list and old Summary held pruned.
**Gaps against the drawings:** the board's Reuse button at 390 sits ~43px lower than drawn (the champion's caption
wraps; /marketing's Next year sentence is longer than the placeholder); the first finish row ~8px.

**Routed, not built:** A23 (the one-slot packaging question) → `/strategy` · F51 (an Exhibition's public champions
page) and **F56** (a bracket-only event's public champions page always says its results are hidden) and a tied final
reading "final not scored" → the public pages' owner · F52 (the demo club's one slot refuses its own Reuse) →
`/demos`. **Follow-ups:** one lock helper across the routes; one champions-page predicate shared with the public
page; a shared print portal (the certificate's and Summary's); a record-form hook shared with Teams; the counts read
could become one grouped query.

### D7 · One Tournaments list — drawn 2026-10-06, after the build (hub v26, Stage 4 tab, part "D7 One list") — ⚖ RULED 2026-10-06 (hub v27)

**⚖ Ruled (owner's paste-back, 2026-10-06):** **D7 as drawn** · **D7b as recommended** (every band open) · **D7a NOT as
first recommended — the door takes Past tournaments' place inside the Admin group**, at a desk and on a phone. The
owner asked whether the top of the menu was more than the list needs; agreed on merit: an occasional destination
whose everyday jobs have other doors (switching = the picker, creating = the "+", Mark complete and Reuse = the
board); on a phone More shows every group open, so it costs nothing there. Accepted cost: at a desk Admin starts
folded at the rail's foot (a scroll and a click). Fallback if a walk shows people still can't find it: an "All
tournaments" line in the tournament picker, not the top of the rail. The row wears a list mark (Results already wears
the trophy). Hub v27 redraws the More sheet and the desk rail with it in Admin. Supersedes A22's two lists; fixes F48
and F57. **Built the same day (below); walk §276 rewritten for one list (hub v28).**

**D7 — as built (2026-10-06, hub v28 "Built" block; committed `47efa6c3`; owner walk §276 ✅ PASSED 2026-10-07, 26/26 — on the owner's word for steps 9–12, whose writes are not on dev).** `lib/tournament-lists.ts`
holds ONE model: `listBands()` (Active · Draft soonest first, Completed · Archived latest first, an empty band
absent), `walkOrder()`, `isFinished()`; `aheadBands` / `pastBands` / `listOf` are gone. The Tournaments page
(`admin/org/tournaments/page.tsx`, re-exported at `tournaments/manage`) draws every band, each band's site note
once (`LIST_WORDS.bandSite`), Reuse setup on Completed rows (the clone analytics surface
`manage_tournaments_row`), and the Sealed records band with the Public ledger door only when a sealed record
exists (a row on a phone, the band row's right edge at a desk). `tournaments/archives/page.tsx` is now a server
redirect to `tournaments/manage`; its stylesheet is gone. The rail's Admin group item `archives` / Past Tournaments
became `manage` / Tournaments (a list icon; Results wears the trophy) — the phone's More reads the same groups; the
tournament-only club's off-tournament "Tournaments" row now links `tournaments/manage`. A status change keeps the
record open (the event stays in the one list and moves band). Words: Mark complete's question drops "moves to Past
tournaments" and ends "You can reopen it from the Tournaments list." (/marketing 2026-10-07: the same question
opens from the record, the game-day board and Event settings); `LOCKED_RESULTS` / `LOCKED_IMPORTS` and both archive
sentences point at the Tournaments list (the slot-plan one reads "…and you can bring it back from the Tournaments list
if a tournament slot is free." — /marketing 2026-10-07, parallel to the unlimited one); `LIST_WORDS.teams(n, finished)` says "no teams" on a finished event
(the record too); the help's closeout subtopic `closeout-two-lists` (id kept, two pages link it) is now "The
Tournaments list", every "reopen / bring back from Past tournaments" says the Tournaments list, keywords keep the old
names for search. The Organization page tile reads "Tournaments". Sweep: `admin-t-archives` left the layout
screens and its 10 baseline entries (frame-strip findings, the same as `admin-t-manage`'s) were pruned. Found and
fixed on the way: the desk table's Teams heading sat left of its right-aligned figures (a local `.num` lost to the
kit's `.table th`); the page now uses the kit's `repKit.num`. Proven read-only (`.probe/s4c/built.mjs`); typecheck,
5,813/5,813 unit tests, the changed-files gate (one failure: another session's dev-only migration 317).
**/review (2026-10-06, high-risk tier, three lenses — correctness + security, regression / blast radius, state):**
nothing Critical, High or Medium. Fixed (Low): the slot line and New tournament now wait for the first read (before
it, a full plan flashed "0 of 1 in use" and a New tournament that then became the lock line); a club's own sealed
records list on ANY plan, the lock line following them where sealing isn't on the plan (a club that sealed on
Tournament Plus and moved plans saw only the lock line); the public sealed-record pages' admin links point at the
Tournaments list ("← Tournaments", was "← Past Tournaments" via the redirect). Accepted: edit mode now survives a
status change (no stale state — the form excludes status); a re-read that fails after a change leaves the record on
the old status with the error unshown (as before); a superseded read can let a busy button re-enable a moment early
(the server refuses a duplicate); reuse from a Completed row reports `manage_tournaments_row` (the clone event also
records the source's status, so finished-event reuse is still countable); the redirect drops a query string or
sub-path (nothing links one); the Sealed records band has no site note (a different kind of band, as drawn);
`check-public-tokens` and `admin-old-look` still name the archives folder (inert — both gates pass). Rendered check
`admin-t-manage` + `admin-t-dashboard` at 361 / 390 / 768 / 1440: no new findings.


**Why it reopens A22.** Walking §276 step 1 at a desk the owner could not find the list (F48 is still true as built:
inside an event the rail, More and the account menu have no Tournaments row; Past tournaments has no door back) and
asked: *"why don't we just make one Tournaments and put past tournaments under active tournaments on the list of
tournaments? do we need 2 nav buttons?"* A22's recorded tradeoff for the two lists was scope ("changes the rail, which
this stage doesn't draw"); the `/design` review's actual point — no event on both lists — holds with one list, since
each event still sits in exactly one band. Built, the split costs three things: no door (F48); **F57** (new, below);
Mark complete sending an event to another page.

**F57 — On the one-slot plan the morning after, the list says the slot is full and shows no event.** Every status but
Archived holds a slot (`lib/tournament-status-words.ts`), so a finished event still holds the Tournament plan's one
slot; the Tournaments list counts it (`used` = every non-archived event) but lists only Active · Draft
(`aheadBands`). Captured on the free club at 390 with two statuses changed in the read only (`.probe/s4c/capture.mjs`):
"1 of 1 tournament slot in use", the More tournament slots lock in New tournament's place, "No tournaments ahead
yet." — the holder, and the Archive that frees it, are on Past tournaments.

**Drawn (before = captures of the built screens, 6 Oct; after = drawn, Warm + Dark):** one page, "Tournaments", bands
Active · Draft · Completed · Archived · Sealed records, what's ahead on top; one row shape in every band (name; dates ·
teams; "no teams", never "no teams yet", on a finished event); each band says once what it means for the public site
(Active / Completed "public site online", Draft "private", Archived "public site offline"), replacing Past
tournaments' Public site column; Reuse setup stays the Completed rows' one worded action; the foot door goes; Public
ledger moves into the Sealed records band (shown when a sealed record exists). **One door** (as first drawn, v26;
ruled into Admin, above): a "Tournaments" row at the top of the rail above the event picker on every page (lit on
the list), and the first row of the phone's More under Notifications; Past tournaments leaves Admin; its address
opens the list. The one-slot morning after: the
holder is the first row under the slot line (≈271px at 390, read from the drawing). Desk: one table, Tournament ·
Dates · Teams · the row action · the door.

**Asks (hub checkboxes, in the Stage 4 paste-back):** D7 one list as drawn (rec.) / keep two lists and only add the
door · D7a the door at the top of the rail and of More (rec.) / in Admin (folded by default at a desk) · D7b every
band open (rec.; I first suggested folding Archived and Sealed, then found no foldable band in the kit and that
history only ever adds rows below) / fold Archived and Sealed with a count.

**What else changes, not drawn:** the sentences that send people to Past tournaments (Mark complete's question, the
two locked-results lines, both archive questions — words for `/marketing`); the help's Past tournaments article folds
into Tournaments with its keywords; the Organization page's "Manage Tournaments" tile → "Tournaments"; walk §276 (W6)
is **on hold** and is rewritten for one list (eight of its thirteen steps walk the two lists); §275 stays as passed.
No data change.

## 7. The asks

A1 · which stage first · A2 · one event identity · A3 · phone or desk per station · A4 · Storm Mode and
the Big Board stay their own projects with a place left · A5 · the Club seams · A6 · plan gating on
redesigned screens · A7 · one word per game state · A8 · the defects list now or with their stages · A9 ·
game-day screens refresh themselves · A10 · Results opens on "needs you, every division". Each is on the
hub's Walk tab with options, a recommendation, the tradeoff and a checkbox per option; the Stage 1 tab
carries a ruling per drawn change (G1–G8).

The formatting check (§11) added two, both on the Stage 1 tab:

- **A11 · a worded action on a phone list — OPEN.** The portal has two phone forms: a list whose rows fit
  a phone stays ONE frame (S.7) and a row's one worded action sits beside its chevron (the 2026-09-04
  decision); a list that doesn't fit breaks into row-cards, where K-09 puts a worded action on a full-width
  44px row at the card's foot. Check-in's and Results' rows fit, so Option 1 (one frame, the button in the
  row, a 61px row) is the portal's own form and shows **6** teams on Check-in's screen one; Option 2
  (row-cards with K-09's foot button, a 102px card) shows **4** and would be the exception (read from the
  drawing after the bucket bar went in). Recommended:
  Option 1; the risk is a thumb meant for the button opening the sheet (the targets touch, they don't
  overlap). A third option splits it: Option 2 for Check-in, Option 1 for Results. (The first v3 draft drew
  Option 1 as separate cards and called it the exception — a misreading of the standard, corrected when
  the owner asked why the phone had gaps the desk didn't.)
- **A12 · lime per row — RULED 2026-09-29** (owner: "for B I agree with your recommendation"). A row's
  Finalize or Check in is olive on white; lime for one main action per screen. Amends §245's kept
  "Finalize lime" for row buttons (§2).

**A5 — where each Club seam shows:** Venues & facilities ("Import from library", Club and League only —
Stage 6's venue book); the schedule's field picker and any clash warning (Stage 6's clash check and
calendar); Teams' "Add my team" and the Payments panel (Stage 7's club tournaments and fees to the club
ledger); the dashboard's future club banner (Stage 7). Drawn as today's behaviour, tagged "owned by Club
Stage 6/7".

## 8. Build order against the foundation's cleanup (Part B)

Part B deletes the old look from the tournament screens' code area by area, proven pixel for pixel
against the release's reference pictures (local, `.admin-identity/before-{warm,dark}/`). **Every build
stage here waits for Part B's pass on its area**, because a redesign on top of two stacked looks makes
both jobs harder and breaks Part B's pixel proof. The drawings don't wait.

- **Recommend Part B take the tournament areas early, game day first** (the dashboard, Results, the game
  list, Check-in and the shared check-in board), so Stage 1 can build as soon as it is ruled.
- The defects list (A8) touches pixels on six screens. Recommended: fix now, and Part B re-captures those
  screens' reference as its first step (minutes), rather than holding a misleading archive sentence and an
  unreachable button until each area's pass.
- Stage 1's build prompt, written only after Stage 1 is ruled, settles the exact order against Part B's
  tournament passes.
- **Amended 2026-09-29, when the prompts were written (owner to confirm at the build's first step).** Club
  Tier Stage 2 has since set a better precedent: build on the released look once the owner confirms it is
  staying, and **Part B skips the screens a redesign replaces** (the redesign removes their old look as it
  rebuilds them, so cleaning them first would do the work twice). Waiting for Part B's game-day pass would
  tie Stage 1 to a "settling tournament weekend" that, with no customers, has no date. The Stage 1 prompt's
  first precondition asks; if the owner says the release is not yet staying, the build waits for Part B as
  first written above.
- **Stage 2 beside Club Tier Stage 3a (2026-09-30, owner asked "parallel or sequenced?").** Staggered, not
  start-to-start. 3a (club money) was drawn the same day with five asks open, so it cannot build yet; Stage 2 is
  ruled and can. What the two share is small but real: the admin row recipe (`RepKit`), the form window
  (`KitDialog`), the old-look baseline, the one dev server and UAT sessions, and the owner's walks. So: Stage 2
  builds now and lands its one shared-kit change (the form window's named Previous / Next and editable title) as
  its own early commit; 3a's asks are ruled meanwhile; 3a's **server** session may run beside Stage 2 at any time
  (no shared files); 3a's **screens** session starts after Stage 2's shared-kit commit and reuses it. ⚠ 3a's
  drawing (its hub v20) predates the 2026-09-30 "a record names its neighbours" decision; its allocation record
  should be read against it when its asks are ruled. The build prompt's "Running beside Club Tier Stage 3a"
  section holds the working rules.

## 9. Verification at build (for each stage's build prompt)

- The layout sweep's `admin-t-*` and `guest-*` entries at 390 / 360 / 768 / 1440, both themes, one runner
  at a time, scoped with `--only=` (never a full sweep beside another session).
- A probe per ruled tap count (the board to a score box; Results' first waiting game; a check-in), read
  from the product's own signals, never a guessed delay.
- The tour-anchor guard stays green; `now-playing` checked while a demo game is live.
- Contrast 0/0 in both themes on the redesigned screens; the one-spelling gate for G5's words.
- An owner § walk per stage, one purpose per walk.

## 10. Migrations

None expected. Stage 1 changes what screens show and how they refresh; it adds no column and no gate
value. If a later stage needs one (a tie flag, a "delay" state for Storm Mode), it is that stage's call
and gets the data dictionary in the same unit of work.

## 11. The formatting check (2026-09-29)

Stage 1's v1 drawings were checked against the portal's written rules (`TABLE_AND_LIST_STANDARD.md`,
`TABLE_EXCEPTION_REGISTER.md`, the kit, the page-header and section rules, the `--type-*` ladder, Club
Ask 8's nine rulings), with every drawn size read in a browser and a second, independent reviewer. Fifteen
departures, all fixed in v3 (the Stage 1 tab's last section lists each with its rule):

1. The dashboard lost its title band (**high**) — restored as "Dashboard", no tags.
2. "2 to finalize" said four times on the phone board — the count lives on the list heading only.
3. Rows with a worded button had no chevron — every row ends in one.
4. Status colour in row words (the overdue day amber, "Paid" green) — plain ink; "Owes" stays amber as
   money owed. The winner's green score (today's) is kept and flagged for the exception register.
5. Desk rows laid out as columns without a heading row — the board and Results are row lists, Check-in a
   table with headings.
6. Two filter shapes on one stage — one pill with its count everywhere.
7. Schedule health's right chevron on an expanding row — the down chevron.
8. Nine text sizes off the eight-step ladder — mapped to 12 · 14 · 16 · 20 · 24.
9. The eyebrow's weight and tracking — the kit's, at both widths.
10. The editor's 12px corners — the row card's 10px.
11. Two band-row shapes — one.
12. Desk row buttons at 36px — the admin's 38px (K-18).
13. "Running late?" drawn as a record row — the kit's door card.
14. "Fri Jun 12" — the product's "Fri, Jun 12".
15. The check-in time chip at 12.5px — 10px.
16. **Found by the owner's question, missed by both reviewers:** the phone lists were drawn as separate cards
    with gaps and a heading on the paper over each stack. A list whose rows fit a phone stays one frame with
    band rows (S.7, §3.10.5) — now one white frame per screen, as at a desk.

Two questions the rules leave to the owner came out of it: **A11** (open) and **A12** (ruled), §7. Already
settled by Ask 8, no change: a table's link is the name and a row list's is the whole row; phone cards are
white (the standard's sentence about a tinted card is stale and should be updated by whoever next edits
it); admin figures take the body face, tabular.
