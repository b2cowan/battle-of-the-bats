# Tournament admin redesign — implementation plan

> **Status:** DESIGN. The measured walk, the stage ladder and Stage 1 (game day) were drawn on
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
| 2 · Teams and registration | Teams (first team on screen one, the pools row, one colour per status, words not glyphs, a row opens the team), registration health, Communications | Q 6.1 | Both |
| 3 · The schedule | Opens on the day; the bracket shows scores and winners; one generator name; drag with undo; the coin toss where seeding happens; the rain delay as Storm Mode's home | Q 8.1 | Both |
| 4 · After the event | The completed board celebrates and offers "Run it back"; one reuse flow; Summary on a phone; the champions page shared; Past tournaments and the Tournaments list | Q 13.1 | Desk first |
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
