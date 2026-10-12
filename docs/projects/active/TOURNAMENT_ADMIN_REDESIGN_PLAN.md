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
> **Stage 6 (the volunteers) DRAWN 2026-10-07** on the hub's Stage 6 tab (hub v31, §6f), from
> `TOURNAMENT_ADMIN_REDESIGN_STAGE6_DESIGN_PROMPT.md`: V1–V7, findings F58–F65 (§3), asks A25–A32. **⚖ RULED 2026-10-07**
> (owner's paste-back): **V1–V7 as drawn, A25–A32 as recommended** (hub v32). Build prompt
> `TOURNAMENT_ADMIN_REDESIGN_STAGE6_BUILD_PROMPT.md` — P1 (who may change a volunteer's jobs after the invite) and P2 (a
> volunteer with neither job) go to the owner at its start.
> **✅ STAGE 6 BUILT and COMMITTED 2026-10-07** (after /simplify + /review): `df49408a` (Part 0, the landing rule and
> "Helping with") · `1b1546b9` (Parts 1–4, the shells, the sheets, the banner and the Staff kit) · `d5df5e7b` (the
> pricing pages say "volunteers"); P1 and P2 ruled at its start, both as recommended — §6f "Stage 6 — as built".
> **Owner walk §282 (a volunteer's game day, from a phone) ✅ PASSED 2026-10-08, 19/19** (step 9 on the owner's word) — the hub's QA tab, walk 7.
> **Stage 3 (the schedule) DRAWN 2026-10-09** on the hub's Stage 3 tab (hub v35, §6c), from
> `TOURNAMENT_ADMIN_REDESIGN_STAGE3_DESIGN_PROMPT.md`, measured on the demo's live Summer Classic and the UAT clubs: S1–S8,
> findings F66–F76 (§3), asks A33–A46 (two departed from the prompt's framing: A39 and A45). **⚖ RULED 2026-10-09**
> (owner's paste-back): **S1–S8 as drawn, A33–A46 as recommended** (hub v36). Two prompts, in order: the defects pass
> (A45) `TOURNAMENT_ADMIN_REDESIGN_STAGE3_DEFECTS_PROMPT.md` first, its own commit (P1 to the owner at its start), then
> `TOURNAMENT_ADMIN_REDESIGN_STAGE3_BUILD_PROMPT.md`. Drawn before Club Tier Stages 10 + 11, whose scheduler starts from
> the parts tagged "shared candidate" (A40).
> **✅ The Stage 3 defects pass (A45) COMMITTED `279f1e5d` 2026-10-09** (P1 ruled: a database function — mig 320, dev only, prod BEFORE the code; /simplify + /review first) — §6c "Defects pass — as built"; **owner walk §286 (hub walk 8) ✅ PASSED 2026-10-09, 15 of 15**, read back on dev (nothing saved by the generator, the Keep released, the demo unpublished).
> **Stage 5 (create and set up — the last stage) DRAWN 2026-10-10** on the hub's Stage 5 tab (hub v39, §6e), from
> `TOURNAMENT_ADMIN_REDESIGN_STAGE5_DESIGN_PROMPT.md`: E1–E9, findings F77–F91 (§3), asks A47–A58 (two depart from the
> prompt: A51 and A57). **A23 RULED at its start (owner, 2026-10-10): B, one at a time** — logged Decided, not built, by
> /strategy. **⚖ RULED the same day** (owner's paste-back): **E1–E7 as drawn, A47–A58 as recommended**; A56 with a note
> (the "?" in the other portals' one format — the bare glyph, the same size, no box or circle; the drawings fixed). Next:
> the A57 addendum (Chat and Data tools) on the Stage 5 tab, then the build prompt — the redesign's last build.
> **The same day:** the `/design` review's eleven changes applied (owner: "All 11"; desk drawings at true size first); the
> addendum drawn and ruled — **Data tools retires** (the owner's question; imports live with their data: Teams' Export and
> the schedule's Tools, one import sheet in the coach budget's shape), **Chat gets its title**, its free wall as today.
> **Build prompt `TOURNAMENT_ADMIN_REDESIGN_STAGE5_BUILD_PROMPT.md` written 2026-10-10** — the redesign's last build.
> **Stage 3 (the schedule) BUILT and COMMITTED 2026-10-09** (`baf4b0f3` … `c554fde8`, /simplify + /review `e1d40e40`,
> help `dcb013ba`) — its §6c "as built" record written 2026-10-11 (the build session left none; walk 8 / §286 was the
> defects pass before it). **Owner walks §294–§295 owed** (hub walks 13–14: the desk the week before · the Saturday,
> from a phone), on a throwaway event seeded for them.
> **✅ STAGE 5 BUILT and COMMITTED 2026-10-10/11** (one commit per part, /review on each, then /simplify + /review over the
> whole build): `c482932f` (Part 0, one at a time) · `9ef4c5a0` · `43678430` · `1925b5ce` · `745f928d` · `9c9cf8ad` ·
> `af69644f` · `33cfb50f` · `e8b869ca` · `de57b895` (Parts 1–8b) · `99283591` (/simplify) · `f93b6808` (P1 as ruled:
> Teams' import a Tools row) · `43a1ffae` (Event settings' choices at the tap floor) — §6e "Stage 5 — as built".
> **Owner walks §290–§293 owed** (hub QA tab, walks 9–12: a first tournament at a desk · next year · setting up from a
> phone · imports); then the project's close-out.
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
  **Club Stage 6 was RATIFIED 2026-10-08 (all thirteen asks) and 6a is building** (the venue book, the clash
  check, the one Where field): this redesign's **Stages 3 and 5 can draw now** against the club hub's Stage 6
  specimens 4 (the amber line under Diamond on Add Game, the drop, the shift, the generator, the import) and 7
  (Venue, then the sport's word, on every form), and wire to 6a's server check and shared field when it lands.
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

**Re-measured 2026-10-09 for Stage 3** (probes `.probe/s3/demo.mjs` and `.probe/s3/owner.mjs`, read-only — every non-GET
refused and recorded, nothing seeded; a "rewrite" altered a GET's JSON in the probe's own read only). Two events: the
demo's **Riverdale Summer Classic**, live that day (Oct 7–9; on Friday both U11 semifinals played 14–6 and 10–8, the final
at 4:00 p.m., U13's last round-robin game at 5:00 p.m.), entered once through the demo door and the session reused (the
door allows ten entries per ten minutes per address); and the **UAT Plus Championship** (June) as the organizer, plus the
free club's Import Smoke event for the plan locks. 390 · 360 · 768 · 1440, Warm and Dark. **State of the six:** F19 open
and wider (on the demo's Friday it opens on U11's played-out round robin; on a phone the empty state's words sit behind
the bottom bar; the Plus event's U11 Girls now holds one unplayed game, so it no longer opens empty there); F20 open and
wider (F68); F21 open and wider (thirteen names, §6c, and more found 2026-10-09); F22 open and wider (F71, F72); F23 open (no test event uses the
coin-toss tie-breaker: read from code); **F24 partly fixed `890d0aac`** — Stage 1's "Running late?" door opens the window
from the board in 1 tap (measured), but a phone's timeline view draws no Tools at all. **Measured, phone (390):** today's
four games sit on three screens (one division, one stage, unplayed only): **8 taps** from the board to see them (6 at a
desk); the title at 87px, a three-row toolbar card 163px, the view strip 27px, the first row at 474px on the Plus event;
**12 controls under 44, 11 of them under 38** (the page's own 9: the division box, the two stage buttons, Tools and
Unpublish at 34, the view strip 27, the health rules button 26, the team detail 16, every row's chevron 24); nothing
spills sideways at any width or theme. **At 768** both stage switches draw at once and Publish is an unlabelled globe;
**at 1440** two limes (Add Game, Publish). The inline edit (Plus event, 390): fields 28px, five buttons 32px. June's 16
schedule rows (J1): **8 fixed · 6 partly · 2 open** (§6c). Captures `.probe/s3/shots/` (published as `shots/s3-*`).

**F66 — The schedule shows one division, one stage and only unplayed games at a time.** The division box has no "All"
(the page picks the first division as soon as they load; its all-divisions branch can't be reached); the Round Robin |
Playoffs switch puts today's semifinals and final on a different screen from U13's game; the status filter opens on
Scheduled. Today's four games on the demo's Friday: 8 taps on a phone, 6 at a desk.

**F67 — A score waiting for review, and a forfeit, are hidden by every filter.** Three chips (Scheduled, Cancelled,
Final); Pending Review and Forfeit belong to none, so "Clear filters" (all three on) still hides them. Probed by flipping a
game in the read: in no list.

**F68 — The organizer's bracket names no team and hides what has been played.** Every card prints the slot's words
("Seed #4", "Winner SF2") even after the game is decided — no team, no score, no winner, no champion — and the bracket
follows the list's status filter: the demo's U11 bracket shows only its final; the Plus event's U11 Girls reads "No
playoff bracket yet" though its semifinal is played. `BracketColumns.tsx` reads only the placeholders.

**F69 — The generators double-book the tournament's own diamonds** (read from code; not reproduced — a save is a write).
The round-robin generator builds its slots from every chosen diamond at every time and reads only the division being
built (`Generator.tsx` `buildTimeSlots`, `existingGames` filtered to the division); the playoff generator likewise. The
schedule's health score is per division and can't see it either.

**F70 — "Replace all" deletes the division's played games and their scores.** It is the default once a division has
games (`generationScope` starts `'replace'`); the server's `delete-division-games` removes every round-robin game in the
division, any state, then the draft is saved — two calls, so a failed save leaves the division empty. Its question says
"permanently clear any existing games" without naming the played ones (the playoff generator's says "delete all existing
playoff games and scores").

**F71 — A refused save is silent; a played game moves; the timeline can't change a day.** `handleSaveGame` never reads the
reply (a 400/403/409 just reloads; the drop's optimistic move snaps back with no word), nor do Cancel and Reinstate; a
final game's block drags and its new time saves (the server refuses only changing a played game's teams); the drag and the
phone's sheet move a game only inside the day on screen. **S6-03 confirmed and mapped:** the same-event overlap is refused
in the browser by the Add window and the inline edit (the inline edit against the games on screen only — one division, the
ticked states, the search), coloured by the drop, warned and allowed by the phone sheet, unchecked by Reinstate, the
generators, the rain delay and the bracket editor, and refused on the server only by the import (§6c's writer table).

**F72 — The bracket editor moves published games and tells nobody.** Its save rewrites existing games' day, time and
diamond and queues no "your game moved" alert; every other move of a published game does.

**F73 — The Publish window promises a reminder it doesn't send.** "Publishing also schedules a game-day reminder … sent even
if the box above is left unchecked": the publish route returns before scheduling any reminder unless the email box is
ticked, and the email is Tournament Plus — on the free plan the reminder never goes. A say-the-true-thing defect (rule 9).

**F74 — The Edit Game window can't be opened; the inline edit is the only edit.** `openEdit` is defined and never called.
A played game's row does nothing; the schedule shows no score anywhere (the list says "✓ Final", the timeline and bracket
show none).

**F75 — Three widths, three toolbars.** 768: both stage switches, an unlabelled Publish. Phone: the timeline view draws no
Publish and no Tools (the rain delay with it). Desk: two limes. Title "Schedule management" (desk) vs "Schedule" (phone).
The timeline's day and the generator's dates print in the device's own words ("Fri 9 Oct", "7 Oct").

**F76 — Three lengths for one game (Club 6a's F1, widened).** The round-robin generator spaces games by its length box and
saves none on them; the playoff generator saves its own; the dashboard reads game → tournament → 60 (skipping the
division); the schedule, Results and the clash check read game → division → tournament → 90; the scorekeeper game →
division → 90. Stage 1's review note "a scheduler-built game carries its own length, so they agree on it" holds for the
playoff generator only.

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

**Re-measured for Stage 5 (2026-10-10, read-only, the Plus club, the free club at its slot limit, the club fixture and
the demo's Invitational; no draft exists on any test club, so the draft board and the first run were read from the code,
owner ruling the same day).** F25 is wider (the copy paths lose a park's diamonds: the demo's Invitational, copied from
the Season Opener, holds Riverdale Community Park with none). F26 was fixed in the defects pass (`936655a9`) and stays
unreachable until one at a time (A23). F27 holds: Free ends at 375 on a 360 screen. F28 is partly fixed (a non-empty
division's delete asks again with counts, `719d84c4`). F29 is partly fixed (a header pill reaches the site at a desk).
F30 is six save models once Registration questions and Notifications are counted. F55 sits on the weeks-before board,
not the draft (F81).

**F77 — The first run's diamonds are named after the park.** It makes N lanes named "Lions Park — Diamond 1…N", so the
schedule's Venue field reads "Lions Park · Lions Park — Diamond 2"; a one-diamond park's only lane is named "Lions Park".
Its screen promises "Diamond 1…N" (the venues route's legacy `save` action).

**F78 — The tournament's style can silently fail to save.** Both wizards save the tournament, then the style in a second
call whose failure is swallowed; an Exhibition can quietly become round robin + playoffs.

**F79 — The wizard's venue search lists every copy and drops diamonds.** New tournament searches every tournament's
venue copies (archived events included, duplicates unmerged: "Ma" on the Plus club lists Maple Field 1 twice, Maple
Field 2 twice), with no diamonds; a pick keeps name and address and saves one lane named after the venue. Neither wizard
reaches the club's Venue library (S6-04's wizard half).

**F80 — Copy into this draft replaces the draft's setup wholesale.** The draft board's populate-from deletes the draft's
venues, rules, resources, questions and welcome before copying, offers no areas, has no rollback if it stops halfway,
needs only the module (not `create_tournaments`), and ends in its own window. Its banner says "Manage Tournaments".

**F81 — "No fee schedule configured" before the first accepted team.** The weeks-before board's Payments panel says it
whenever no team is accepted (fees set or not), and "Set up fees →" (17px) opens the Tournaments list (F55).

**F82 — The board's "ready" is not Activate's.** The board's ready = dates + a division; Activate also requires a public
contact (usually the club's email). The board's own Activate question says it "opens registration to teams" even with
no division open; the record says "in its open divisions".

**F83 — ?create=1 at the slot limit opens the whole wizard.** The rail's + and the list refuse before anything opens; the
address (the first run's League path, the coach portal's hosted section) opens every step and refuses at Save setup.

**F84 — The clone checks neither the name nor a past date** (New tournament refuses both).

**F85 — No "?" on most boards and setup screens.** Only the finished board and Divisions have one; the help drawer counts
days with a different clock from the board's.

**F86 — Chat and Data tools were never drawn by any stage.** Chat: no title (F14), a full-page Plus wall (F38); its old look
is "named by no stage". Data tools: imports and exports in Admin, 1,462px on a phone. Stage 5 is the last stage.

**F87 — Venues & facilities: silent failures and a split address.** Facility saves have no error path; editing a venue puts
the whole address in Street; Add Venue's result is unchecked; a repeat library import says nothing; its hint "e.g. Lions
Park — Field 1" teaches one venue per field (the Plus club's venues show it).

**F88 — An Exhibition's divisions still speak of playoffs** ("standings and playoff seeding", a playoff setting saved).

**F89 — Registration questions has no door from the rail or the settings hub** (the frame's; routed).

**F90 — No door to the public site on a phone or a tablet.** The event header's pill is desk-only and 119×25.

**F91 — The first run asks a question nothing reads** ("how many tournaments a year"), and shows a Tournament Plus
Founding Season offer to an organizer who just chose free (J1-019).

**F92 — "No fees set up" is called Free, and teams told they aren't charged** (found with the owner, 2026-10-10, on the
drawn draft board). Event settings' Fee model offers "Free"; the card's summary then says "Free" and its line says "teams
are not charged a registration fee for this tournament". It only means no fees are set up or tracked in the product: the
event may charge, collected outside it. **Owner ruling the same day:** never tell anyone the event or registering is free
when it is a matter of tracking — say the payments aren't tracked here (the public registration form already does:
"Payment handled by organizer … outside the platform"). Stage 5's build changes the choice, its summary and its line;
the drawing's draft Fees row and weeks-before Payments card say it that way (words for `/marketing`).

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

**Re-measured 2026-10-07 for Stage 6** (probe `.probe/s6/probe.mjs`, read-only — every non-GET refused and recorded;
the `plus-official` session on `uat-plus-org`, the free club's scorekeeper signed in once in the probe's own browser,
the owner signed in the same way for the Staff kit; 390 · 360 · 768 touch, 1440 for the kit; an iPhone user agent for
the banner). The Plus event's games are in June, so the scorekeeper was read on Jun 14 (4 to score, 1 final, 1
cancelled) and Jun 12 (1 waiting for review). **Fixed Warm, confirmed:** both shells wrap `GuestKitRoot`, whose
marker pins the warm palette with no theme attribute in the selector (`app/globals.css` `:root [data-guest-kit]`), and a
portal opened inside carries the same marker; on a phone set to Dark the gate and its team sheet read white
(`html[data-user-theme=dark]`). **Measured, 390:** fixed chrome 172px (header 52, buckets 58, tabs 62 — Option C's
"~110" at the foot is 120 since the kit's 46px buckets); the scorekeeper's first game at 191px, cards 160px, 3 whole on
screen one (2 at 360); the gate's first team at 226px, 6 whole rows; nothing spills sideways at any width. **Taps:**
first score from a signed-out link 3 + typing (sign-in → the game → Submit; the sign-in returned to the scorekeeper);
the next score 2 + typing; check-in 1; switch jobs 1 (2.9 s to the gate's board on dev); copy a link from the board on a
phone 3 (More → Staff kit → Copy). **F36's four items:** the banner is open and worse (F58); the buttons still 42px
(F60); the Review count still plain; the staff landing true, read from code — no test club has a staff member, nothing
was added — and re-framed (A25, A26). **June's J8, re-checked: 16 fixed · 3 partly · 2 changed · 2 open** — fixed:
001–002 `99e06b26`, 003 and 019 `e567124d`, 004 (the one-app start page opens the volunteer's own screen), 005
(migration 130), 006–007 `70ce26c9`, 010–011 `a1eafe36`, 012 `890d0aac` (Stage 1 G7), 013 (the sheet's third/two-thirds
foot), 014 · 016 · 017 `01243f51`, 018 `a0a61835`; partly: 008 (a coloured note under the boxes, covered by the banner on
an iPhone), 015 ("(completed)" lowercase in a 40px box; a volunteer sees only assigned events), 020 (Home's one card
opens the scorekeeper, the gate one tap from there); changed: 009 (the tiles became the bucket bar), 023 (the Account
sheet names who and the duties); open: 021 (staff), 022 (the public home — the public pages' owner). **Exhibition:**
neither shell reads the format; nothing a volunteer sees changes.

**F58 — The install banner sits on the volunteer's buckets and over an open score sheet.** On an iPhone the banner shows
on the first visit (the engagement delay applies only on a fan's event page) and positions itself from
`--bottom-nav-height` — the public site's 72px at ≤900, which the shells never set — so it sits at 681–772px over the
bucket bar (724–782px): a tap on "To score" hits the banner (`elementFromPoint`). The 2026-10-06 fix put it at layer 255,
under every portal sheet; the shells' own sheets sit lower (the score sheet's backdrop 100, Account 90), so it floats
undimmed over an open score sheet, covering the bottom of the boxes and the whole policy note, and over the Account
sheet. The gate's team sheet (`BottomSheet`, 600) covers it. `tests/unit/install-banner-layer-guard.test.ts` names these
sheets as not covered. Code: `InstallAppPrompt.module.css` `.banner`, `DayOfShell.module.css`, `scorekeeper.module.css`
`.sheetBackdrop`. Ask A31.

**F59 — The volunteer bars are see-through.** The bucket bar (`rgba(--home-paper-rgb, .97)`) and the tab bar (`.92`) copy
the coaches portal bar's ground without its 20px backdrop blur, so the page reads through them under the thumb ("Comets
U11 Girls … Owes $525" legible behind the gate's tabs at 390). `DayOfShell.module.css` kit block.

**F60 — Controls under 44px on the volunteer screens.** Phone (390 and 360): Cancel 72×42 and Submit 244×42, Refresh
42×42, Today 56×42, Filters 77×42, the ⇄ pill 41×30, the Account sheet's × 38×38; the gate team sheet's × 32×32 and Mark
paid 136×35; the gate's event picker 40px tall (only with two or more assigned events). Tablet (768 — no tab bar above
640px): the header's "Check-in →" 90×19 and "Sign out" 48×15, the four buckets 42. These screens have no computer case:
the admin's 34px rule does not apply. Ask A27.

**F61 — The clock reads "A.M." in capitals on both volunteer screens.** The scorekeeper card's time line (`.gameMeta`,
console face, `text-transform: uppercase`) and the gate's arrival chip ("IN · 8:59 A.M.") draw `formatTime()`'s
"11:30 a.m." in capitals. The clock ruling (2026-08-26: "8:00 a.m.", lowercase, no carve-out) is broken by a style
the spelling gate cannot see — it reads source text, not rendered text. Stage 1's own drawing carried the same chip.

**F62 — A volunteer invited for the gate lands on the scorekeeper.** Read from code (walking it sends an email). The
invite's "Helping with" (Both · Scorekeeping · Gate / check-in) is used once: an EXISTING account's "added" email links
`/auth/login?next=/{org}/check-in`. A new volunteer's invite link goes through `/auth/accept-invite`, which lands where
the server's resolver says, and `getDestinationForMembership` sends every `official` to `/{org}/scorekeeper`; so do every
later bare sign-in, the installed app (`/?source=pwa`) and any `/{org}/admin` address (the J8-019 redirect). The choice is
stored nowhere (only the audit log). The invite dialog's hint ("Opens the gate board to check teams in.") and the Staff
kit's note ("the invite email links them straight to the right screen") promise otherwise. The role is labelled
"Scorekeeper" (`ROLE_LABEL.official`), and the invite opens on Staff ("Staff was today's default"). The gate is one tap
away on the tab bar. Ask A26.

**F63 — A score sent back returns silently; a forfeit sits in no bucket but All.** Results' Revert sets the game back to
`scheduled` with its scores and submitter cleared (`revertTournamentScore`); the scorekeeper's live update moves it back
to To score with no word, and after a reload nothing can say it was sent back. A finalized forfeit arriving by live update
keeps Pending Review until a refresh (`statusFromRealtime` doesn't accept `forfeit`), and the bucket counts read
`scheduled` / `submitted` / `completed` only, so a forfeit is in All alone. Ask A32.

**F64 — The after-submit notice talks to the organizer and never leaves.** After Submit for Review the list drops about 104px (the notice is 88px tall)
under "Score sent for review — An admin can now review and finalize this result from Results & Scoring." (88px; the admin
page is "Results"), which stays until the next action; "Score finalized — This result is now final." 68px. The standing
rule: the save word fades ~2.5 s, a sentence notice ~8 s, only an error persists.

**F65 — The Staff kit fails the formatting check.** Measured as the owner on the Plus club (390; 1440 with print media):
its "printable one-pager" prints the rail, the top strip, the event header and the grid ground around the two codes (its
print rule hides only Copy and Open — Summary's J1-110 again); Print (81×44), Copy (84×38) and Open (85×38) are the
retired grey `btn-ghost` (every admin action is the white button, 2026-10-01; a door is olive text); on a phone each link
breaks mid-word ("…/scorekeep / er"); the closing note sends the organizer to "Settings & Access → Members … as a
Volunteer" (the rail spells "Settings & access"; the role is "Scorekeeper") and promises the invite links them "straight
to the right screen" (F62); the browser tab says "Staff Kit". Its old look (10 kit-scoped rules in
`staff-kit.module.css`) was named by no stage in `check:old-look:report`. Phone: 3 taps from the board to copy a link.
F14's "works" stands for the codes and links.

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
| 3 · The schedule — **DRAWN + RULED 2026-10-09 (§6c); defects pass COMMITTED `279f1e5d` 2026-10-09 (mig 320 dev only — prod before the code; walk §286); BUILT + COMMITTED 2026-10-09 (`baf4b0f3` … `e1d40e40`, §6c "as built"); owner walks §294–§295 owed** (`TOURNAMENT_ADMIN_REDESIGN_STAGE3_DESIGN_PROMPT.md`; unblocked by Club Tier Stage 6a; drawn before Club Stages 10 + 11, whose scheduler copies this generator) | Opens on the day; a game opens that game; one generator name; drag with undo; the bracket shows scores and winners; the coin toss where seeding happens; the rain delay as Storm Mode's home; publishing says who is told; + one division/stage at a time (F66), the hidden waiting score (F67), the nameless bracket (F68), the generators' double-booking and score-deleting replace (F69, F70), silent refusals (F71), the bracket editor's silent moves (F72), the false reminder (F73), the dead Edit window (F74), three toolbars (F75), three game lengths (F76) | Q 8.1 · S1–S8 · A33–A46 | Both (the desk first for building, the phone first for fixing) |
| 4 · After the event — **DRAWN 2026-10-05, RULED 2026-10-06 (§6d); build prompt written** | The finished board says how each division finished and offers Reuse this setup (its one lime); one reuse flow (the wizard's step, every door); Summary on a phone, the champions page shared, a clean printout; Past tournaments as every finished event's list; the Tournaments list (what's ahead) with its statuses as bands and the event's record, every change asking first; the Exhibition; + no door to the list (F48), the one-slot next year (F49) | Q 13.1 (ruled) · A18 (ruled: Stage 5 owns the before-event view) · A19–A24 | Desk first |
| 5 · Create and set up — **DRAWN + RULED 2026-10-10 (§6e) with its addendum (Data tools retires, Chat titled); BUILT + COMMITTED 2026-10-10/11 (`c482932f` … `43a1ffae`, §6e "as built"); owner walks §290–§293 owed** (`TOURNAMENT_ADMIN_REDESIGN_STAGE5_DESIGN_PROMPT.md`; the last stage; Q 1.1–4.1 ruled on the walk; A23 ruled one at a time at its start) | One set of creation questions (diamonds in both wizards); the board before the event (A18); Event settings; Divisions; Venues; Rules; Public site (a door to the site, a save that follows the rule); the settings screens; next year on a one-slot plan; + the first run's misnamed lanes (F77), the silent style save (F78), the venue search (F79), copy-into-draft (F80), the untrue fees sentence (F81), the board's ready (F82), ?create=1 (F83), the clone's checks (F84), the "?" (F85), two screens no stage drew (F86), Venues' silent failures (F87), the Exhibition's divisions (F88), two frame findings (F89, F90), the unread question (F91) | Q 1.1, 2.1, 3.1, 4.1 · E1–E9 · A47–A58 | Desk first, phone usable |
| 6 · The volunteers — **DRAWN + RULED 2026-10-07 (§6f); build prompt written** | Scorekeeper and gate: the install banner, 44px buttons, a waiting-score signal, the staff landing; the gate inherits Stage 1's check-in board; + the see-through bars (F59), the clock in capitals (F61), the gate volunteer's landing (F62), a sent-back score (F63), the after-submit notice (F64), the Staff kit (F65) | V1–V7 · A25–A32 | Phone only (a scoring-table tablet measured) |
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

## 6c. Stage 3 — The schedule, as drawn (2026-10-09)

Drawn at true size on the hub's **Stage 3** tab (hub v35), both widths — the desk first for building, the phone first for
fixing — from `TOURNAMENT_ADMIN_REDESIGN_STAGE3_DESIGN_PROMPT.md`. Before = captures of 9 October (§3 "Re-measured
2026-10-09"); after = drawn on the demo's real Friday at 4:20 p.m., Warm, with Dark copies at load. Drawn figures read
from the drawing (`.probe/s3/measure3.mjs` → the hub's `{{M:s3-*}}`). Assembled by `.probe/s3/hub-assemble.cjs` from
`git show HEAD:` of the hub and the parts in `.probe/s3/parts/`. The demo's divisions are unpublished; the game-day
drawings show U11 and U13 as published (S8 draws the unpublished note), and the club-booking amber lines are illustrative
(the demo club has no venue library).

- **S1 · The schedule opens on the day.** Today's games in time order — every division, both stages, played (with scores),
  waiting, playing and still to play — the day on its own row with arrows (the club calendar's week arrows), the event's
  first day before it and its last after it. One toolbar line in every view (1 October): the view (Day · All games ·
  Timeline · Bracket, the olive pill) · Search · Filter (Division · Stage · State · Field, quiet until it filters) · Tools.
  The row is Results' row (Stage 1 G4); it opens the game. Schedule health is one closed row at the foot (the tour anchor
  stays on it). Title "Schedule" at both widths; Add game the one lime; Publish moves into Tools and a note (S8). Measured
  from the drawing: the first game at 250px on a 390 phone, all 4 of the day's games on
  screen one (today: an empty list, its words behind the bar).
- **S2 · A game opens that game.** One window (a form window: full screen with ← on a phone, 640 at a desk) from the
  day, the timeline and the bracket. It reads first — when and where, the score (its door opens Results' editor: one
  editor in the product), the bracket slots with their teams, who sees it — and one pencil edits the whole game (1
  October). Venue + Diamond is Club Stage 6's field, drawn as built; the tournament's own overlap is refused in red under
  Diamond before Save (house league's shape), a club booking is the amber line. An unpublished game autosaves; a published
  game's change to when or where is held until ✓, which asks first (the coaches portal keeps that save for the same reason). Cancel game (amber),
  Delete (the 9 October look), Previous · Next.
- **S3 · The generator, one name.** "Round-robin generator", two steps: settings (What it pairs · When · Where · Rules —
  today's content, plain headings; the other divisions' saved games shown as taken; the length saved on every game) →
  drafts (three ranked cards that name their measures, clashes inside the tournament and club bookings; the chosen draft's
  games by day; one statement of what saving does). The Replace all | Build from current switch goes: a draft replaces
  only games still to play and not kept (a replace asks once). Generic parts tagged **"Shared candidate · Club Stage 11"**
  (When, Where, Rules, the drafts, the statement, adjust with Undo, publish saying who is told); "The tournament's own"
  (pairing, games per team, pools, slots, bracket order). The playoff generator and the free Build bracket: names only.
- **S4 · Moving a game by hand.** The timeline shows every division's games on every diamond of the day; a drop that would
  overlap another game in the tournament turns the band red with its reason and springs back; a published game asks once
  before it moves; every move ends in the notice with **Undo** (about 8 seconds); a club booking drops with the amber line;
  played games don't drag. The phone's move sheet moves onto the Sheet Frame's form (A29) with a **Day** field, Venue +
  Diamond and the line; its lime names who it tells.
- **S5 · The rain-delay tool in its home.** Today's tool on the kit's form window: one ×, a row's "Cancel game" (today two
  "Cancel"s with two meanings), a check of every moved game, Undo after, **Storm Mode's place reserved at the window's top**
  (not designed). Board → window 1 tap (Stage 1's door, kept); Tools → Rain delay 2 taps in every view.
- **S6 · The bracket.** The public bracket's reading on the organizer's page: the team with its seed or slot under it,
  the score, the winner bold with a check, the champion where it ends (the finished board's sentence); every game whatever
  the filter; a card opens the game; Edit bracket a white button above it. On a phone the rounds as bands in one frame (the
  diagram one tap away). The finished Season Opener drawn from its real games.
- **S7 · The coin toss.** A pending toss is the amber waiting count on the Bracket view (and Results), a note on the bracket
  names the tie and what waits, and "Record the toss" opens today's recorder as a form sheet — from the bracket, Results and
  the dashboard's nudge. Illustrative (no test event uses the coin-toss tie-breaker).
- **S8 · Publishing.** A note on the day while divisions are unpublished; one Publish window that says what shows (public
  site and app), that registration closes, what reaches the linked coach teams ("From {tournament}"), what a later move
  does, and the reminder's true rule (with the Tournament Plus email). One lime that counts what it publishes.

**The asks — ⚖ ALL RULED 2026-10-09 as recommended** (the owner's paste-back, which also ruled S1–S8 as drawn): **A33** what it opens on (rec. the day) · **A34** one verb, two names (rec.;
/marketing; **⚖ amended the same day — the doors carry the names**, below) · **A35** one game window, the inline edit retires, the score through Results (rec.) · **A36** Undo after every
move and a published game asks once (rec. "both") · **A37** every door and the server refuse an overlap inside the
tournament, the club's line stays amber (rec.; the demo tour's step 4 sentence becomes false → /demos) · **A38** the public
bracket's reading (rec.) · **A39** one game length everywhere, the generators save it (rec.; **departs from 6a's framing**
that the board's 60 is a different question — read in the code, it decides when a game stops being "Playing now") · **A40**
name the generator's frame for Club Stage 11, draw the tournament's only (rec.) · **A41** one shape where the Day and the
club calendar answer the same question; the timeline stays its own (rec.) · **A42** the board's door + Tools in every view,
the check, Undo, Storm Mode's place (rec.) · **A43** the coin toss where seeding happens (rec.) · **A44** 44px for the
phone's daily job, locks in words, one toolbar at every width (rec.) · **A45** the generators' two defects (F69, F70) with
F71–F73 and the gate key as **a defects pass now**, its own prompt (rec.; **departs from the prompt**, which put the server
refusal with the build) · **A46** the reminder: say the true thing now, the packaging question to /strategy (rec.). Per
drawing: S1–S8.

**Every writer** (S6-03 and 6a, read from code, two passes): Add window — refuses in the browser · Edit window — nothing
opens it · inline edit — refuses in the browser against the games on screen · timeline drop — colours, never refuses ·
phone sheet — warns, saves · Reinstate — nothing · round-robin and playoff generators — nothing (other divisions unread) ·
bracket editor — bracket order only, **no alert for a published game** · rain delay — bracket order only · typed locations
resolved (+ the only undo) and temporary lanes — nothing · import — **refuses on the server, the only door that does**.
Every writer runs 6a's cross-program check on the server and returns `crossProgram`; no tournament screen reads it; the
only pre-save checks are house league's and the coach's (`useClashCheck` / `WhereField` on three non-tournament screens).
The 6a guard's "ask where" not-yet list names Add Game and the inline edit (this stage) and the setup wizard (Stage 5).

**Every name for generating** (F21): thirteen — Round-Robin Generator · Schedule Generator · Generate Round Robin Draft ·
Commit Schedule · Confirm & Save · Auto-Generate Bracket · Playoff Bracket Builder · Preview Bracket · Generate Playoff
Bracket · Auto-generate instead · the board's "Build schedule →" · help's "Auto-Generate" · the marketing page's "Schedule
Generator" — plus the free hand-built Build / Edit / Save Bracket.

**The census missed some (found 2026-10-09, after the ruling, by a grep of the customer-visible copy):** help's
**"Playoff Wizard"** (six passages in the tournaments help, and the sales walkthrough's bracket line) · the upgrade
message's **"playoff bracket generator"** · the platform page's **"Bracket Generator"** (beside its "Schedule Generator")
· "Playoff Bracket Builder" again in the **bracket-only format's description** (setup and settings) · a bracket game
row's **"Edit in bracket builder"** · help's **"schedule builder"**. The marketing surfaces' feature lines (home page,
pricing section, plan article, billing page, the plan emails' "What you've unlocked") say "schedule generation" /
"bracket builder" and go to `/marketing` with the rest.

**⚖ A34 amended by the owner, 2026-10-09 (after the paste-back):** asked whether the Tools rows should read "round
robin generator" and "playoff bracket generator", the owner took the recommendation: **a door names the tool it opens —
the Tools rows read *Round-robin generator* and *Playoff generator*, the same words as their windows** — replacing the
ruled "one verb on every door" (*Generate round robin…* / *Generate playoffs…*). **The reason:** the menu row and the
window then say one name, and Tools names its three tools (with *Rain delay*) and puts a verb on its two acts
(*Publish…*, *Unpublish a division…*). **"Playoff bracket generator" was not taken:** "bracket" stays the free tool's
word, so a free organizer's locked row never reads as a second Build bracket. The Stage 3 tab still draws the verbs;
the build prompt carries the amendment and names where.

**Plan gating (A6):** the generators, the rain delay, the "schedule is live" email and phone alerts on a move are
Tournament Plus; hand scheduling, the timeline and the hand-built bracket are free. A free organizer meets a bare padlock
in Tools (the plan named only in a hover title); the playoff generator is gated on the round-robin generator's feature
(`auto_schedule`, not `playoff_generator` — both on Tournament Plus today, so latent). **The Exhibition:** no stage filter,
no Bracket view, no playoff generator — each absent; otherwise the same, so not drawn separately. **Storm Mode and the Big
Board:** nothing built (the program plan only).

**June's J1 schedule rows: 8 fixed · 6 partly · 2 open** — open: J1-079 (the drag), J1-090 (the coin toss); partly: J1-081
(names), J1-082 (styles, hover), J1-097 (no game-day view), J1-098 (the health card), J1-028 (diamonds in the wizard), J1-112
(no champion on the organizer's bracket); fixed: J1-076 (`bc743762`, but the phone's timeline view hides Publish), J1-083 /
084 / 091 (`d9aee6cb`), J1-088 (`82cb34cb`, `8564624c`), J1-089 (`82cb34cb`), J1-054 (`39a12876`), J1-056 (`66e5ee37`).
**Correction found re-reading:** the hub's Stage 1 tab says "playoff games already refuse a tie (June's J1-083 fix)" — the
code saves a tie and the bracket waits (Stage 1's build already said so; the tab line is stale).

**Ruled 2026-10-09, and what the two prompts add.** The owner's paste-back ruled S1–S8 as drawn and A33–A46 as
recommended; nothing else was ruled (the paste-back's older sections are unticked browser state for stages ruled
before, not a reopening). Two prompts, in order: **the defects pass** (A45, `TOURNAMENT_ADMIN_REDESIGN_STAGE3_DEFECTS_PROMPT.md`,
its own commit, first) and **the build** (`TOURNAMENT_ADMIN_REDESIGN_STAGE3_BUILD_PROMPT.md`). Writing them re-read the
code each rests on:
- **F70 is today's "Build from current" made the only behaviour.** That scope already replaces only round-robin games
  still to play and not kept, and fixes everything else (played, waiting, forfeited, cancelled, kept, the playoff games)
  as taken assignments; "Replace all" (the window's default) sends the division delete, which takes every round-robin
  game in the division whatever its state (`lib/game-delete-policy.ts`). So the defects pass removes the switch, as S3
  drew, and narrows the server's division delete to the same rule for any caller. The delete runs before the save, in
  two requests; **P1** (to the owner at the pass's start): one server action that writes the new games first and then
  removes the ones they replace, taking its own new games back out if the removal fails (rec., no migration; the worst
  case is a visible duplicate, never a lost game), or a database function that does both at once (a migration).
- **F69:** both generators read only the chosen division's games — the round-robin generator filters what the page
  hands it, the playoff generator fetches the tournament's games and keeps only its division's.
- **The bracket save already keeps played and submitted games**; only the alert is missing for a game it moves (F72) —
  the single-game edit is the only writer that records the move today.
- **F71:** the page's save handler never reads the reply, so a refused drop or inline save snaps back without a word.
- **F73:** the publish route returns before the reminders when Notify is unticked, and again on a plan without the
  schedule email.
- **The gate key:** the playoff generator and the round-robin generator both sit at Tournament Plus, so the playoff
  window reading its own key changes no one's access; the server already gates the bracket on its own key.
- **A39 overturns a shared note:** Club 6a's one-booking-length file says the board's 60 minutes is "a different
  question"; the build corrects that note in the same commit, and the board starts reading the division's length (today
  game → tournament → 60). A game whose length is set nowhere reads Playing now for 90 minutes, not 60.
- **A41 meets Club 6b:** 6b's prompt builds the club calendar on the admin team schedule's and the coach schedule's
  parts ("a second week grid is drift"). The Day wears the same booking row; whichever builds first makes it the shared
  part, and the other wears it.

**Stage 3 taps (organizer):** today's games from the board, phone **8 → 1** (desk 6 → 1); a game's score from the schedule
**not on the schedule → 0** (on the row); move a game and take it back **a drag, back by hand → a drag + Undo** (a published
game +1 for its question); a round robin generated and chosen **6 → 5** (6 when it replaces games); a rained-out afternoon
from the board **2–3 → 2–3**, then Undo; a bracket game's winner **not on the organizer's bracket → 1** (View → Bracket).

**The formatting check** (the tab's last section, before the owner saw anything): Stage 1's sixteen rows, §3.5–3.7 and
§3.10, and every ruling to 2026-10-09. A second, independent reviewer then read every drawn frame's rendered picture against the same rules: fourteen departures, all fixed but one kept and flagged (Results' winner green on the day's rows, built in Stage 1, not yet in the exception register — A38): a red rail on the playing row (no rail in a list, §3.10.7); a ✓ and a foot Save on one form (now ✓ only, asking first for a published game); Venue drawn as a dropdown (it is a search box); two choice rows the 22 August dropdown rule covers (the generator's Pair, the rain delay's shift — the latter costs one tap over today's buttons); coloured words in rows; an unruled third "free" line; Delete beside Cancel game at a desk; the bracket's division as a second olive pill and the phone bracket without Filter (the scope now sits beside the line with arrows, as the day does); the drag over the playing game's words; the seed spelled three ways; the retired olive outline on two buttons (1 October retired it for the white button); two wraps — and four over-claims. Seven places where written rules pull apart are listed on the tab for the owner (edit-autosaves vs a when/where change that tells families; dropdowns vs Venue's search box; scope-first vs one line in every view; the whole-row target vs a selection list; no rail vs Stage 1's marking of the live game; the clock vs a range; the 3 October heights).

**Not drawn — the build's work:** the page split first, measured identical (3,529 lines); the old look's retirement in every
file Stage 3 rebuilds (held by `check:old-look` and the strict colour gate); the server refusal for every writer and a
tournament pre-save check (A37); Undo for every move (the session's, no new data, resting on today's rule that a move and
its move-back inside the quiet window send nothing — proved by a test); every tournament screen reading 6a's `crossProgram`;
the game window replacing the inline edit, the Add window and the dead Edit window (the 6a guard's not-yet list shrinks);
the game-length answer (A39); health across every division; the defects (A45) if not fixed first; the tour anchors
(`schedule-health` stays on the health row at the day's foot; step 4's sentence → /demos; the demo's unpublished divisions
→ /demos). **Routed:** help's "no separate schedule publish step" and "Auto-Generate" → /docs after the ruling; A46's
packaging question → /strategy. No migration expected.

**Defects pass (A45) — as built 2026-10-09, committed `279f1e5d`** (prompt `TOURNAMENT_ADMIN_REDESIGN_STAGE3_DEFECTS_PROMPT.md`;
/simplify + /review at the high-risk tier first; owner walk §286, hub walk 8 — ✅ passed 15 of 15 on 2026-10-09). **P1 ruled: a database function** (owner, at
the start), and both widenings proposed in the UX summary ruled in.
- **F70 + P1:** the switch is gone; a draft keeps results, cancelled, kept and playoff games and replaces only round-robin
  games still to play and not kept. The save is one request to a new route action, `replace-division-round-robin`, which
  runs migration 320's `replace_division_round_robin_games` in one transaction: it locks the division (one save at a
  time), refuses a team, pool slot or temporary facility from another tournament, locks the division's games still to
  play and refuses unless they are **exactly** the ones the draft replaces (so a double submit or a second organizer's save
  is refused, never doubled — /review), removes them, and inserts the draft. A failure after the removal rolls it back;
  proved on dev in a rolled-back block with four mutated copies all failing it. The route's `delete-division-games` is
  narrowed to the same rule for every caller. **Mig 320 is on dev only and ORDER-CRITICAL** (`MANUAL_PROD_STEPS.json`,
  pending): apply to prod before promoting this.
- **F69, widened:** both generators drop every draft slot a kept game holds, in any division, by the Add window's overlap
  rule (`slotsClearOfTakenGames`). Widened because the division's OWN kept games were not blocked either: a stored
  "10:00:00" never matched a draft's "10:00" slot key (now normalised in `slotKey` too). This division's temporary
  facilities are matched by label (another division's "Facility 2" is its own lane).
- **Found building and reviewing, all reachable only once the switch went:** a venue-reference-only game (the demo's all)
  and an undated kept playoff game crashed the draft's sort; two teams who also meet in a playoff lost their round-robin
  game (the playoff counted as the matchup, the round-robin game was replaced and never redrawn). All fixed, each with a
  test that fails without it.
- **F71, widened:** a refused drag, inline save or phone move shows the server's reason (`refusedWrite`; our words when
  it has none — /marketing), the game re-reads quietly so the list shows the truth, and the inline row stays open. Cancel
  Game, Reinstate, Unpublish, Unpublish all (it showed a division unpublished when refused) and the Publish window's
  close step now report refusals too. The demo sandbox's by-design refusal is unchanged (probed).
- **F72:** `save-bracket` records the games it moved through the single-game path's recorder (one call; publish gate,
  quiet window, reminder re-sync); the recorder's pure half moved to `lib/schedule-change-classify.ts` and is tested.
- **F73:** the reminder sentence shows only when the reminder will be scheduled (`willScheduleGameDayReminder`, the
  route's own two checks); /marketing's sentence. The route is unchanged (A46 stays /strategy's).
- **Item 7:** the playoff generator's doors read `playoff_generator`; no one's access changed.
- **Help (/docs):** the "no separate schedule publish step" sentence corrected (each division is published), a tip and an
  FAQ that a new draft keeps what was played.
- **Measured on the demo (read-only, every write stubbed):** U11 (all played) — "There is nothing to save.", no request; U13
  squeezed onto Friday's Diamonds 1–2 — the draft took exactly the two slots U11's games leave free, zero overlaps, and the
  save named only U13's two games still to play.
- **Found, not fixed (the build's):** the playoff window's "Replace bracket" still deletes before it saves (it warns in red);
  a refused inline save also keeps the row's old "Save failed — please try again." line; the save-bracket loop is not one
  transaction (a mid-loop failure leaves earlier moves unannounced, as before); DATA_DICTIONARY `games` gotcha 6 still
  says prod `location` is NOT NULL (the snapshot says nullable).

### Stage 3 — as built (2026-10-09; prompt `TOURNAMENT_ADMIN_REDESIGN_STAGE3_BUILD_PROMPT.md`; owner walks §294–§295 owed)

**Written 2026-10-11, two days after the build** — the build session committed its code and help but never this record or
its walks; the owner's §286 pass (walk 8) was the defects pass before it. From the commits:

| Part | Commit | What an organizer sees |
|---|---|---|
| 0 · the split | `baf4b0f3` | Nothing: the 3,529-line page split into its parts (the game form, the Bracket view, the Publish window, the toolbar menus, the reads and exports) before any screen changed. |
| 1 · one game length (A39) | `f5c3bbe3` | The board's "playing now", the clash check, the scorekeeper and the health figures read one chain — the game's own length, else its division's, else the event's; the generators and the bracket editor save the length they schedule by. |
| 2 · the day (S1, A33, A44) | `76fe08b3` | The schedule opens on the day (today while the event is on, its first day before it, its last after it): every division, both stages, every state, in time order. One toolbar line at every width (Day · All games · Timeline · Bracket, the day's arrows, Search, Filter, Tools); Add game the one lime; Publish into Tools; Results' row recipe; schedule health one closed row at the day's foot; a free plan's paid tools in words. |
| 3 · the game window (S2, A35) | `187fd532` | One game window from every view: it reads first and the pencil edits the whole game; an unpublished game autosaves, a published game's move is held until ✓ and asks ("Move it? Its teams are told."); "Enter the score" opens Results' editor; Club 6a's Venue + Diamond field. The inline edit, the old modal and the field picker retired. |
| 4 · moves, Undo, one overlap rule (S4, A36, A37) | `0d5d0b41` | Two games in this tournament on one known diamond at once are refused at every door, in the browser and on the server (every games writer); the timeline's drop shows a red band and springs back; played games don't drag; the phone's Move sheet; every move ends in a notice with Undo, and an Undo inside the 10-minute quiet window tells nobody. |
| 5 · the round-robin generator (S3, A34, A40) | `5e3d04ad` | One two-step window (What it pairs · When · Where · Rules, then three drafts as cards with their measures, Three more drafts, one statement of what saving adds, replaces and keeps); a replaced game is told as a move, a dropped pairing as cancelled, nothing while unpublished; one name per tool everywhere (Round-robin generator, Playoff generator, Build / Edit / Save bracket). |
| 6 · the rain delay (S5, A42) | `35544e0f` | A kit form window (the day, a division and a diamond, "Push the games later by", each game's row with its new time, the red refusal and the club's amber line); the announcement step kept; a notice with Undo for the whole batch. Storm Mode's place reserved. |
| 7 · bracket, coin toss, Publish (S6–S8, A38, A43, A46) | `c554fde8` | The Bracket view reads like the public bracket (seeds or "Semifinal 1 winner", scores, the winner bold with a check, the champion card); a phone reads rounds as bands with Show as diagram. A coin toss still owed is one amber count and one note (bracket, Results' Needs you, the board's nudge) with Record the toss. Publish says what it does, and the lime counts what it publishes. |
| /simplify + /review | `e1d40e40` | One overlap walk; Undo puts a game back only while it is still where the move left it; the rain delay's Undo all or nothing; a slot draft matched by its slots; publishing a completed event refused; the layout sweep's schedule screens re-pointed (they had measured the plain day since Part 2). |
| help | `dcb013ba` | The schedule and playoffs guides follow Stage 3. |

**After it, from later work:** Stage 5 added "Import games from a spreadsheet" to Tools (`e8b869ca`) and the shared
locked Tools row (`f93b6808`). **Owed:** the owner's two walks — hub walks 13–14, §294 "the desk the week before"
(generate, adjust, publish) and §295 "the Saturday, from a phone" (the day, a game moved and taken back, a rained-out
afternoon, the bracket), on a throwaway event seeded for them (`scripts/seed-stage3-walk-fixture.mjs`: "UAT Stage 3 Walk"
on uat-plus-org, next weekend, no games; removed with `--remove` after sign-off). Routed at the build (its prompt):
A46's packaging question to `/strategy`; the club plan's Stage 11 line ("Stage 3 built") is the club session's to write.

**Found writing its walks (2026-10-11).** Fixed: the Playoff generator's "Earliest playoff start" printed the browser's
clock ("5:45 PM"); now the house's ("5:45 p.m."), `fa951dbd`. **For the owner:** (1) **a published game's move and
every rain delay re-time the coaches' game-day reminder emails** — even for a division published with "Email the teams"
unticked (which schedules none), and the rain delay for unpublished divisions too; older than this redesign (the rain
delay's reminder re-sync), and it reaches real coaches on a real event · (2) the first bracket saved posts a "Playoffs
are set" bell and push to the club's other staff before anything is published — intended? **For the follow-ups group:**
a venue whose one diamond shares its name reads twice ("Lions Diamond · Lions Diamond") in the Timeline's + Field menu,
its column heads and the Playoff generator's preview · the Playoff generator's "Standard (Pool A vs. Pool B Crossover)"
names pools the division may not have · the Playoff generator saves the games, never the division's playoff settings, so
the Bracket view's caption loses "· the top N of the round robin" · a coin toss still owed cannot be walked on any dev
data (the unit test holds it).

**The drafts step, changed during walk 13 (owner, 2026-10-12; committed `e9557b99` 2026-10-12).** Walking step 12 the owner found
no "See its 12 games" — it is the phone's door; at a desk the games are always open (the walk was wrong, steps 5 and 12
reworded, hub v50). Behind it, three places the build had left the approved drawing, all ruled back to it: (1) **the
statement reads first**, at the top of the chosen draft's column — under the games, a 12-game draft carried it off the
screen while Save stayed in view at the foot, so the one sentence saying what Save replaces could go unread; (2) **the
games are the schedule's own row** — the two teams stacked, away on top (the drawing's note: "as the schedule's own day
list draws them"), and the time column narrows to a clock's width wherever the lead is a time alone (`ClubRow`
`leadTime`: the drafts and the schedule's Day / All games; the Bracket view's "Fri 2:00 p.m." keeps the wide one); (3)
**a long day is capped** — more than 12 games on a day shows its first 10, then one closing row "38 more · 12:00–8:15 p.m.
· 9 diamonds" (three or fewer named), pressing it shows the rest; any held-back game on a club booking is said on that
row in amber, so a cap never hides a warning; a new set of drafts starts the days closed. **Ruled against:** a By team /
By diamond view inside the window — the window chooses between drafts (the cards compare them); the schedule after Save is
the review (Timeline, Filter, Search), and an unpublished save is safe. The club scheduler's drafts step went the other
way (By team · By day, Club Stage 11 Ask 19) — a months-long club schedule sent to coaches, not one unpublished weekend.
/review (standard tier; correctness, blast radius, UX/a11y): nothing High or Medium left — fixed the closing row's spoken
name ("Show 38 more games on Sat, Oct 17, …"), its fields named in number order (so "Diamonds 1–3") and counted in the
facilities' own word (`facilityWordAt`: "5 facilities" where kinds differ), the amber at the draft rows' weight, and an
empty caption on a game with no field. Accepted: the closing row unmounts on press, so focus returns to the page (as
every other "show all" in the product). **Not walkable on the walk's event:** no division there reaches 13 games in a
day, so the cap row has no walk step yet.

**Walk 13's other findings, fixed as the owner walked (2026-10-12, a second session).** (1) the Filter menu ran off the
window's foot — it now takes the room actually under it (`useViewportFit`, the season-setup popover's measure) and scrolls
inside; (2) the generator's Where put a one-diamond venue's chip on a line of its own — a run of those shares one row,
a park with named diamonds keeps its heading; (3) Generate drafts opened step 2 at the settings' scroll — each step starts
at its top (`KitDialog levelKey`); (4) a note's one action sits at the card's right end beside its words, under them on a
phone (`Callout action`, every one-action note: Publish…, Record the toss, the rep team's two-season notes, Try again);
(5) a game's Cancel (or Reinstate) and Delete share one row ending the body, and a record window's last section adds no
foot room of its own; (6) the Timeline ignored Search and the Filter (its focus list never re-ran) — the rest now turn
grey busy blocks; (7) the generator's "has no games yet" note sits at the foot's left end. **Walk step text, not the
screen:** steps 6 and the U13 save quote the day's count ("6 games · U11 Girls"), which a desk does not show (drawn so,
S1); the phone walk has it right.

**Conflicts in every view — drawn, ruled and built 2026-10-12** (sheet `TOURNAMENT_SCHEDULE_CONFLICTS_OPTIONS.html` =
https://claude.ai/artifact/Nn96wzMshrPXKrhUyQDNrb; owner: "looks good, build as mocked", all five asks as recommended).
The owner asked why only the Timeline had a Conflicts pill, and whether it needed its own row. It was a show/hide switch
for the warning colours, left from the old Timeline's control bar (the drawing has no such row). Built: **the row is gone**
(colours always on, the one-line legend only while a clash shows; "travel buffer" — another rule's name, a team's time
between venues — now "turnover"); **one clash map on the page** (`buildConflictMap`, which flags BOTH games of a tight
pair) feeds the Timeline, **a chip on a game still to play** (`toPlayConflict`: amber "Tight turnover", red
"Double-booked" for an older pair; RepChip text only, the state chip's place — Day, All games, the Bracket's rows and
cards), **a Conflicts group first in the Filter** (a row per kind on the view, absent on a clean one; a ticked kind keeps
its row at 0), **the game's read view says why** (the edit form's line, on the saved place, for a game still to play;
each game of the pair told about the OTHER side — **fixed on the way:** the earlier game was told the later game's end),
**Schedule health's "Show them"** on Tight turnovers / Venue or facility overlaps (ticks the row alone, closes the panel;
health counts the event, so a day with none moves to the first that has one; the Bracket hands over to All games; the
door shows only while a game still to play is one) and **one word, "turnover"** (the window's line, health's issue —
"Tight turnovers · 1 pair of games is closer than the turnover between games" — and its "1 tight pair", Event settings'
label, the help). **Ask 5, the wider one:** every state chip on a phone sat at the end of the when line and wrapped onto a
line of its own (measured 103px a row against 78); `ClubRow`'s caption-first phone row now lets the trail share the
title's line, so a chip sits beside the two teams next to the corner chevron (79px) — the schedule's rows and Results'
(Forfeit, Tie). **Differences from the sheet, said:** Event settings' label keeps its form's Title Case ("Turnover Between
Games (minutes)"); health's issue names no minutes (the turnover can differ by division); its example line printed the
24-hour "09:45" — now the house clock. **Through /simplify and /review the same day** (high-risk, four lenses; 7 confirmed, all fixed): one rule for the side of a tight gap and its turnover — the EARLIER game's (`turnoverSide`, shared by the Timeline's hover and the window); the page's one clash map holds only games still to play, so the Timeline no longer flags played games the Filter cannot find; "Show them" ticks Conflicts alone and clears Search; health measures a pair by the earlier game's division turnover (it used a flat 15); the help says what wears Double-booked truly (an older pair, or two games on one typed place); a Results row awaiting Finalize keeps its Tie / Forfeit chip clear of the button on a phone; the import's warning and a division's own field say "turnover" (the import printed a 24-hour time); the Timeline's hidden day controls and their effects removed. Walk §301 (on the sheet).

### Findings handed over by Club Tier Stage 6c "One calendar" (ruled 2026-10-10; not this plan's rulings until drawn here)

> Club Tier Stage 6c compared every calendar in the product and the owner ratified one calendar recipe on 2026-10-10
> (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 6c; the club hub https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9 →
> Mockups → Stage 6c → specimen 3 and "Not drawn"). 6c rebuilds nobody else's screen: these are findings for this
> redesign, each with the recipe line it breaks, to draw or decline in its own session. Stage 3 as built is the input, not
> something 6c overwrote. **A41, answered from the code:** the Day wears the admin kit's row (`ClubRow`), and the recipe's
> one booking row IS that row — the club calendar's List moves onto it (6c's build), so the Day needs no change for A41.
- **The Day's toolbar (C4):** Export and Add game move from the title band to the toolbar line's right end (one Export and
  one create above what they act on); the title band keeps the title and help; their 44 px icons on a phone unchanged.
- **A clash on a Day row (C5, finding C6-06):** a game whose field another club program holds says it under its
  where-line in 6a's amber words — the line the game window and the timeline's cross note already show.
- **Live (C9):** the row chip "Playing now" becomes "Live" (every public screen and Scores say Live); the game-day board may
  keep "Playing now" as a band heading. Also one spelling for "Pending Review" / "Pending review" (the printed schedule).
- **Calendar in Export (C11):** the schedule's Export gains Calendar (.ics) for the games in view.
- **The phone row (found 2026-10-10 on a capture):** at 390 the state chip floats in the middle of the row (CANCELLED,
  NEEDS A SCORE).
- **The public schedule (`ScheduleContent`):** the day divider reads "Sun, Jun 14" (capitals by its style), never
  "SUNDAY · JUN 14", and a row never "Jun 14 - 11:30 a.m." with a hyphen (C8); the where-line on a computer's row too
  (today the phone's only); "Times in Eastern time." replaces "All times are local." (C10); the jump list's weeks start
  on Monday, "Jun 8 – 14, 2026" (C2); a forfeit gets its chip and score (C6-07); "Add My Games to Calendar" writes the
  event's own clock, not the device's (C6-07, with Club 6d); the tournament home's "Unofficial" follows the schedule's rule.
- **The scorekeeper (C6-08):** it opens on the event's day (`tournamentToday`), not the device's; and one matchup order
  (the board's "away @ home" vs the scorekeeper's "home vs away").
- **The Timeline (C10):** its empty-day line and header format on the device's locale ("No games scheduled on …") — the
  recipe's words, "No games on Fri, Oct 9."

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

**Routed, not built:** A23 (the one-slot packaging question) → `/strategy` (logged 2026-10-07 in `BUSINESS_DECISIONS.md`: the board's sentence Decided; whether a finished event keeps holding the slot Proposed — recommended "one at a time", the owner to rule; a ruling lands in Stage 5) · F51 (an Exhibition's public champions
page) and **F56** (a bracket-only event's public champions page always says its results are hidden) and a tied final
reading "final not scored" → the public pages' owner · F52 (the demo club's one slot refuses its own Reuse) →
`/demos` (the slot FIXED 2026-10-07 in the demo seed + a checker assertion; the unrung anchor left for the next full pass). **Follow-ups:** one lock helper across the routes; one champions-page predicate shared with the public
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

## 6e. Stage 5 — Create and set up, as drawn (2026-10-10)

Drawn at true size on the hub's **Stage 5** tab (hub v39), desk first with every screen at 390, from
`TOURNAMENT_ADMIN_REDESIGN_STAGE5_DESIGN_PROMPT.md`. **The redesign's last stage.** Before = captures of 10 October,
read-only (`.probe/s5/before.mjs`; every non-GET refused and recorded, nothing created, seeded or moved) on the Plus
club's Championship, the free club at its slot limit, the club fixture (a Venue library) and the demo's Invitational 21
days out. **No draft exists on any test club; the owner ruled the draft's board and the first run be drawn from the code**
(marked "not captured"). After = drawn Warm, a Dark copy of each main drawing cloned at load. Drawn figures are read from
the rendered drawing (`.probe/s5/measure5.mjs` → `{{M:s5-*}}`).

**Ruled at the start (owner, 2026-10-10):** **A23 → B, one at a time** — on the one-slot plans only Draft and Active
events hold the slot; a finished event no longer does. Logged Decided (not built) by `/strategy` in
`BUSINESS_DECISIONS.md` (2026-10-10) and the Facts doc. Found while logging it: last year's finished event keeps its name
and public link (both unique among non-archived events), so the creation path must answer it (A55).

- **E1 · One set of creation questions** (F25, F77–F79, F83, F91; Q 1.1). One window for both doors (the kit's form window:
  full screen on a phone, 640 at a desk with the live preview at 1280+): the tournament (name, dates, style, link — each
  marked required, the style saved with it) · divisions (each a labelled card on a phone) · venues (the one Venue field,
  shared Club Stage 6: the club's library for a club; "your venues" — each past venue once, with its diamonds — for
  everyone else; or a new venue with the four things the library asks plus How many and the sport's word → Diamond 1…N) ·
  review (the welcome message a switch). Fees not asked. "How many tournaments a year" leaves the flow. Taps to a draft:
  first run 7 → 5, New tournament 6 → 5 (7 → 6 with past events), plus typing.
- **E2 · The board before the event** (A18, F33, F55, F80–F82, F85). The draft: one card "Before you activate" — dates, a
  division and the contact Activate requires, then the rest quiet in one band, every row a door to the exact place; one
  preview door; Activate the board's one lime once it can work, asking in the event record's words with the link and Copy;
  the guidance card, "What everyone else sees" and the reuse banner go. "Copy into this draft" becomes Stage 4's reuse step
  filling this draft (areas to choose, nothing replaced unasked, all-or-nothing). The weeks before: the guidance as a
  one-line note, five kit cards each one row a door, Payments saying the true thing and opening Fees & Payments; the
  `schedule-health` anchor kept on its card. First card ≈232px (today 593).
- **E3 · Event settings stays the model** (F27, F30, P5; Q 2.1). Cards unchanged; status said once with Change opening the
  event's record (A49); the Fee model a dropdown at every width (the 2026-08-22 convention — Q 2.1 said "on a phone");
  which divisions set their own fee said in the card (J1-042); the save word the floating pill.
- **E4 · Divisions** (F28, F88; Q 3.1). A row per division ("6 of 6 · Full" in the row's ink, registration in words), the
  record drawn both ways for A50 (A: reads first, the pencil edits whole; B: straight into the form), Delete at its end
  asking once with the counts, no alert box; a desk table.
- **E5 · Venues & facilities** (F87, 6a's F2, S6-04). A venue is a record with its diamonds inside it (the Venue library's
  window, shared Club Stage 6); one form edits the venue and its diamonds; the in-use guard said before the tap; Add a venue
  = the club's library first, "your venues" for the rest, a new venue with its count; every copy path keeps diamonds and the
  library link (A51).
- **E6 · Rules & resources and the settings screens** (F30, F31). Rules' sections and resources as records (no per-section
  Save, no three-way leave dialog); Registration questions as rows with Reorder behind Tools; Notifications as 52px rows
  with the pill; no browser alert or confirm anywhere; the settings hub kept.
- **E7 · Public site** (F29, F38, F90; Q 4.1). "See your public site" in the title band at every width (a door: a boxed
  icon on a phone, a white button at a desk); Pages first, the six branding parts as closed cards that save themselves; the
  Tournament plan's view left as today (free tier review); the drawn theme mock gone. **E8:** every board and setup screen ends its title band
  with the "?" (A56).
- **E9 · Next year on a one-slot plan, one at a time** (A23 as ruled, F83). The Tournaments list the week after: 0 of 1 slot
  in use, New tournament its lime, last year online; while last year is still live, the list says why in words (mark it
  complete; it stays online); the name field offers "…2027" when last year's holds the name; the record says Reopen and Move
  back to draft need a free slot; the sentences that change with the rule listed. The free wizard's first step is left as today.
- **⚠ The prompt changed mid-session (2026-10-10):** a free tournament tier review (`FREE_TOURNAMENT_TIER_REVIEW_PLAN.md`,
  queued after this redesign) decides what a free organizer gets, shows locked or hides. So every free-plan lock and hidden
  part on Stage 5's screens is left as it is today, tagged "free tier review", and listed on the tab's overview for that
  project to start from. The first draft had redrawn several (Public site's six Locked cards as one line, the free
  wizard's first step, three lock lines); those were put back before the owner saw the tab.

**⚖ RULED 2026-10-10** (the owner's paste-back): **E1–E7 as drawn, A47–A58 all as recommended.** One note, on A56: *"make
sure its in the same format as the the other portals (same size, no additional circle border around it, etc.)"* — the
drawings had boxed the "?"; every one is now the portals' bare circled-question glyph (`HelpButton iconOnly`: no box, no
fill, a 44px tap area on a touch width, 34px at a desk), which the admin's title bands already build (2026-10-01). Also
ruled on the drawing the same day: **F92** — no fees set up means "not tracked here", never "free" (owner; design log
2026-10-10). **A57 means an addendum before the build prompt:** Chat and Data tools drawn on this tab (title band, one
toolbar, 44px controls, a lock line for Chat on the free plan — that lock is the free tier review's, so left as today and
listed), then the build prompt. **The `/design` review of the same day** offered eleven changes, two of them High (desk
drawings at true size, not half; true-size desk drawings for the desk-first screens it lacks) — not ruled in the
paste-back; put to the owner with the addendum.

**The `/design` review (2026-10-10), eleven changes — ALL APPLIED on the owner's word ("All 11"), hub v43:** (1) every
desk drawing at TRUE size in the hub's sideways frame, today's desk captures beside them with the 900px fold (they had
been drawn at half size — missed by the formatting check and the second reviewer); (2) true-size desk drawings added for
the board three weeks out, Event settings, Divisions and Venues with their record window open over the table, Rules and
Public site; (3) a ready draft's Activate ABOVE the checklist on a phone; (4) Event settings' summaries under their
titles on a phone, never cut off; (5) ONE way to pick venues — a ticked list from the start (the club's library, or "your
venues"), no second "this tournament's venues" list; (6) "See your public site" as a door card, not an anonymous ↗ icon;
(7) Reorder as a mode of the same list; (8) the review step's rows as doors; (9) the venue's edit view keeps Previous ·
Next; (10) "How many" on its own row; (11) the delete button names the games and the teams; "18 of 18 spots taken" in the
frame's foot.

**The A57 addendum (E10–E11), drawn 2026-10-10 on the Stage 5 tab.** **E11 · Chat** gets its title band (F14), the room
as the olive pill, Manage room restyled, a docked rooms column at a desk — **ruled as drawn** (owner, 10 Oct); **A60 ruled**:
its free-plan wall stays as today for the free tier review. **E10 · Data tools** was first drawn as an imports-only page
(its two unique jobs: import teams, import a schedule). The owner then asked whether it should exist at all — *"does it
make sense to do something like what we have for the coaches budget, where we can provide an import on the schedule page
(and any other imports in data tools) and offer templates … then we can remove the whole data tools section"* — agreed on
merit and **redrawn: no Data tools.** Teams' one Export menu (which already lists an import row, today opening Data tools)
imports teams; the schedule's Tools imports games; both open **one import sheet in the coach budget's shape**
(`BudgetImportSheet`: start from a template — this event's rows to update or an empty one, Excel or CSV — choose the file,
a preview saying what each row will do, Apply; a blocked row is fixed in the file; the earlier imports inside it). The
registration workbook stays on Teams' Export. Data tools' rail row and page go (its address opens Teams; help and the
guidance shortcut re-pointed; its old look retires with it). **⚖ A59 and E10 RULED 2026-10-10 (owner): Data tools retires, as drawn.**

**The asks:** A47 one question set · A48 the board before the event · A49 the status switch and the
Fee model · A50 Q 3.1 × the record standard · A51 venues and the copy paths (**departs from the prompt**: keep
import-from-past and give it a door — it is the only route that brings a past venue's diamonds to an organizer without a
library, and one at a time makes that the free organizer's yearly path) · A52 Divisions · A53 Public site · A54 the small
controls · A55 next year on a one-slot plan · A56 the "?" · A57 **Chat and Data tools, the two screens no stage drew**
(found by the measuring: the prompt's "every tournament screen redrawn" is not true without them; recommended: a short
addendum on the Stage 5 tab before the build prompt) · A58 what else the measuring found. Per drawing: E1–E7.

**The formatting check** (the tab's last part, before the owner saw anything): the written rules, Stage 1's sixteen
departures and every ruling through 9 October. Fixed by it: "See your public site" and "Message teams" were drawn as
outlined buttons (they are doors); the lock line at 13px and the style rows at 41px; the before-board's off-ladder sizes.
**A second, independent reviewer** then read every rendered picture against the same rules (its result on the tab).
Flagged for `/marketing`: the rail's Title Case labels vs the pages' sentence case; "Manage Tournaments" in the draft
board and help.

**Not drawn — the build's work:** the old look's retirement in every file Stage 5 rebuilds (the board's before-event share
— about 184 of the dashboard sheet's 192 rules, its owner label moving from "Stage 4" to Stage 5 — the wizard, the first
run, Divisions, Public site, Rules, the settings screens, Venues); the copy paths keeping diamonds (A51); the wizard off
the 6a guard's not-yet list; one at a time at every limit check and the downgrade (with `/billing`, `/marketing`, `/docs`);
the style saved with the tournament; the clone's checks; layout-sweep ids for the wizard and a draft board (a draft
fixture: `/uat`, the owner's word); the help drawer's day count; the demo's tour anchors (`schedule-health` kept). The
shared tournament header (47 rules) waits for Schedule and Results; `admin-common` is the club's too. **The project's
close-out:** the final walk, the plan and brief archived, the follow-ups as one TODO group. No migration expected.

**Stage 5 taps:** a first tournament to a draft ready to open registration **8 → 7** + typing (Diamond 1…N, not one lane
or "Park — Diamond 1") · next year from last year on Tournament Plus **2 + dates, then 6 to re-add a four-diamond park →
2 + dates** · next year on the Tournament plan **9 + typing, last year taken offline → 6 + typing, last year online** · a
venue with three diamonds **6 + four typings → 2 + typing** · the game length **3 → 3** on a phone · the public site from
its editor **desk 1, phone none → 1 at every width**.

### Stage 5 — as built (2026-10-10/11; prompt `TOURNAMENT_ADMIN_REDESIGN_STAGE5_BUILD_PROMPT.md`; owner walks §290–§293 owed)

**At the start (owner):** P1 **Teams' Tools** (the import's door) · P2 **leave old "Park — Diamond N" names** · measuring
cleared · **a draft fixture seeded** (`scripts/seed-stage5-draft-fixture.mjs`: "UAT Stage 5 Draft" on uat-plus-org,
refuses production) · every part reviewed and committed on its own, /simplify once over the whole build. `/marketing`
settled the words before the build (`.probe/s5b/words-final.md`).

| Part | Commit | What an organizer sees |
|---|---|---|
| 0 · one at a time (A23, with /billing) | `c482932f` | On the one-slot plans only a Draft or an Active event holds the slot; a finished one stays online and frees it. Every limit check reads one rule; the refusal names the event that holds the slot and says what frees it. Reopen and Move back to draft need a free slot; Bring back doesn't; the downgrade never archives a finished event. Facts doc trued to "built". |
| 1 · one set of creation questions (E1) | `9ef4c5a0` | The first run and New tournament ask the same three steps and a review in one window (a preview beside it at 1280+). Venues: one ticked list — the club's library, or "your venues" with their diamonds — and *A new venue* with a count; diamonds named "Diamond 1…N". The style saved with the event; one request that takes everything back if a part fails. A name a finished event holds is said as it is typed, with next year's name one tap away (A55). The clone copies diamonds and refuses a live name twice or a past start date. |
| 2 · the board before the event (E2, A56) | `43678430` | The draft's one checklist (*Before you activate*, *The rest, when you're ready*), every row a door; one ready rule for the board, Activate and the record; *Ready to activate* only when Activate can work; *Start from a past tournament* into a draft (nothing replaced unasked, all-or-nothing); the weeks-before board's cards; the bare "?" on every board. |
| 3 · Event settings (E3) | `1925b5ce` | The status said once (Change opens the event's record); the Fee model a dropdown whose fourth choice reads "Not tracked here", never "Free"; the floating save pill; summaries under their titles on a phone. |
| 4 · Divisions (E4) | `745f928d` | "6 of 6 · full" in the row's own ink; each division a record that reads first and edits whole; Delete asks once naming its games and teams; no browser alert boxes. |
| 5 · Venues & facilities (E5) | `9c9cf8ad` | Each venue a record with its diamonds inside it; one *Add a venue* window; every write says when it fails. |
| 6 · Rules, Registration questions, Notifications, the hub (E6) | `af69644f` | Sections, links and questions as records; Reorder as a mode of the same list; 52px switch rows; no per-section Save, no leave dialogs, no browser boxes. |
| 7 · Public site (E7) | `33cfb50f` | A door card *See your public site* ("Preview" for a draft, "Online" once active, "Offline" when archived — never "Live", the word for a game in progress); Pages first; six parts that save themselves; a colour typed as a hex code. |
| 8a · imports; Data tools retires (E10) | `e8b869ca` | One import sheet in the coach budget's shape (a template, the file, a preview that says what each row will do, "Import N rows"); Teams' and the schedule's doors; Data tools' page, rail row and help article gone (its address opens Teams). |
| 8b · Chat (E11) | `de57b895` | A title band; the room chosen by the olive pill on a phone, a docked rooms column at a desk; its questions in the product's windows. |
| /simplify + /review | `99283591` | One leaving rule for the record windows (a held edit is held once on every one), one page save queue, one record door style. Review found one: Notifications' Retry could have written the event on screen's switches onto another event — fixed. |
| P1 as ruled | `f93b6808` | **A departure caught writing the walks:** Part 8a built the drawing's placement (Teams' import in the Export menu), not P1's ruling. Now a Tools row under "Teams"; one shared locked Tools row (the padlock, the tool's name, the plan's chip) on Teams and the schedule; the Export menu only exports. |
| tap floor | `43a1ffae` | Found writing the phone walk: Event settings' two- and three-way choices were 38px on a phone and ≈28px on a tablet — now 44 at touch widths. |

**Old look retired** with each part (the dashboard sheet's before-event share, the wizards and the first run, the
settings screens, Divisions, Venues, Rules and TieBreakerEditor, Public site and the shared settings sheet, Chat's page
and panels; Data tools deleted); the baseline re-locked in each commit.

**Free-plan locks met in the build** (left as today for the free tournament tier review; one moved with its door): the
New tournament window's reuse box ("Tournament Plus" badge) · the draft board's *Start from a past tournament* ("Review
Tournament Plus") · the finished board's *Reuse this setup for next year* and *Summary* lock lines · the Tournaments
list's *More tournament slots* · Registration questions' lock card · Public site's locked view · Chat's full-page wall ·
**moved:** the team and game imports, now Tools rows in Stage 3's lock words (A44).

**Left for the follow-ups group** (by name; none has a later stage to land in):
- *The frame's:* F39 · F89 the Registration questions door · F90 the header pill on phones · the "2 teams to review" link
  (22px, every admin screen) and the "Editing tournament" picker spilling 111px at a desk (the layout sweep's two
  standing items).
- *The public pages':* F51 · F56 · a tied final. *`/strategy`'s:* J1-053 the free logo. *`/billing`'s:* J1-020 the
  dropped plan choice.
- *Shared parts:* one import shell for the coach's and the admin's sheets · the record-window hook shared with Teams'
  and the division's records · the frame publishing its header height (Chat measures it) · the form window portaling
  itself · a nowrap section-head option · the autosave hook's flush on leave · batch inserts in the setup copier ·
  Divisions' counts as head counts · the switch rows in one kit part · one venue-book loader (the wizard and *Add a
  venue* read it twice).
- *Found writing the walks:* (1) **an event that never chose its game-timing or tie-breaker scope** — Event settings
  reads it as "the same for every division" and writes that on any save, while a division's form reads it as "may set
  their own"; pre-existing (the old Divisions page read it the same way), so it needs one reading agreed with the
  scheduler's, not a patch · (2) **the Reuse window** gives no as-you-type line when its suggested name or link is taken
  (New tournament does, A55); it is refused at Create · (3) Event settings' choices are 24px tall at a desk (under the
  admin's 34) · (4) over the limit (two live events on one slot, a downgrade) the list's sentence names no holder; only
  the rail's + does.

**Verification:** a test file per part (`tests/unit/tournament-one-at-a-time.test.ts`, `tournament-stage5-*.test.ts`),
`npm test` and typecheck green at every commit; the layout sweep scoped to each part's screens at 361/390/768/1440 (only
the frame's two standing items left); read-only probes per part (`.probe/s5b/p*-probe.mjs`, every write refused).

**Owner walks:** hub QA tab walks 9–12 — §290 a first tournament, at a desk (sign-up to a draft ready to activate) ·
§291 next year (Tournament Plus reuse; one at a time on the free plan, in walk 9's club) · §292 setting up from a phone ·
§293 imports (teams and games, a blocked row, Data tools gone).

### §290 walk finding: the Divisions step (ruled 2026-10-11, built `129de440` · `481d99ea` · `e39d942a`)

**Found on walk §290:** step 2 of New tournament opened six always-open youth cards (1,520px of form in a 707px window
at 1400 × 900; 2,140 on a phone) and the count of divisions couldn't be read. The six-card start was never a ruling (the
old wizard's); **E1's "each a labelled card on a phone" is superseded for step 2.** Drawn in two rounds on a standalone
sheet (https://claude.ai/artifact/L7ddaLNLxucvkZN1vgCLBz, source `TOURNAMENT_DIVISIONS_STEP_OPTIONS.src.html`), each
through the `/design` review; **ruled 2026-10-11, all seven asks as recommended** (build prompt
`TOURNAMENT_ADMIN_REDESIGN_DIVISIONS_STEP_BUILD_PROMPT.md`).

**⚖ Changed by the owner at the build's review (2026-10-11), superseding Ask 5:** *"lets stop grouping under youth and
adult, we can display those as examples and a tournament should be alllowed to have open, U11, U21, mixed, etc. without
our app finding arbitrary groups for them."* The build had shown why: the ruled rule (an oldest age under 18 is Youth)
put a "U19 Girls" under Other, apart from the U19 preset. **One flat list:** the nine common divisions are ready-made
rows, a division you add goes at the end in the order added, and nothing moves a row. The cost, said at the time: an
all-youth event is six ticks, not the Youth heading's one.

| Part | Commit | What an organizer sees |
|---|---|---|
| 1 · the form table's one full-screen row (Ask 6) | `129de440` | The shared form table's option `phoneRowWindows`: on a phone a ticked row is its box (which alone unticks it) and one door — its name, "8 teams · up to age 11" and the › — to its own full-screen window; an unticked row ticks wherever it is tapped. At a desk nothing changes. The standard (§3.6) names it "the form table's one full-screen row"; New allocation does not pass it. Also for every form table: the arrow shows only while a row is ticked, the rows are one keyed list (a moved row keeps its element), a landed row's wash, the boxes written once. |
| mixed box | `481d99ea` | The product's one checkbox had no "some ticked" look, so a mixed heading box read as empty — New allocation's groups and the practice plan's master box now show a dash (owner: "fix it, own commit"). |
| 2–3 · the step and its window (Asks 1–4, 7) | `e39d942a` | Nothing ticked; one flat list (Division · Ages · Teams it holds, the arrow on ticked rows opening name, ages and pools in place at a desk); the closing row "3 divisions · 24" (phone band "3 divisions · 24 team spots"; none: "No divisions yet"); *Add a division* (34px at a desk, the house button — owner, over the prompt's 40) opens "New division" with the whole division; a phone's division window has no foot and is a record (no keyboard on its name); a cleared name holds it or the arrow ("Give the division a name."); Next or Create opens the division a mistake belongs to. *Start from*, the add-a-name field and its 12U example, the cards and their ✕ are gone. |

**Words:** `/marketing`'s, accepted (ages through the Divisions page's `agesLine` — "Ages 9–11", "Ages 18 and up", "Any
age"; "No divisions yet" where the drawing said "No divisions ticked"; "Added to this tournament" under "New division";
the accessible names). **U12 for a tournament division** (Ask 7): the only "12U" was the retired example.

**Departures, each said at build time:** the Add button 34px (§262's control height); the arrow shown only while a row is
ticked (so the column never jumps); a ticked nameless division refused in words (it was dropped silently); Ask 5
superseded as above; the form table's figure input lifted to the tap floor in the 641–768 touch band.

**Findings for later (report-only):** New allocation's money inputs (`.shareInput`, 32px) sit under the tap floor at
touch widths — the same defect this step guards locally (a fix there changes New allocation, so it is its owner's call);
the Divisions page's add form is titled "Add division" where Venues says "New venue" and the step now says "New
division"; the Divisions page shows "—" for an open division's ages where the step says "Any age".

**Verification:** `tests/unit/tournament-divisions-step.test.ts` (109 with the 3c, Stage 5 create and board files);
read-only probes `.probe/divstep/` (50/50 desk and phone, every write refused; the step at 360 · 390 · 768 · 1440 in
Warm and Dark); `/simplify` and `/review` (four lenses each; five review findings fixed); each commit's tree typechecked
in an isolated copy (the shared tree was red from another session's open work). Built at three ticked: 570px at a desk
(fits; the drawing's 675 had headings), 673 on a phone.

**Owner walk:** §297 (hub QA walk 15) — divisions, at a desk and on a phone. It changes three steps of the open walks:
§290's "Custom divisions" is now "tick nothing, Next"; §291's step 13 (one division) is one tick; §292 meets the new
phone rows.

## 6f. Stage 6 — The volunteers, as drawn (2026-10-07)

Drawn at true size on the hub's **Stage 6** tab (hub v31), phone first, a 768 tablet where it differs, from
`TOURNAMENT_ADMIN_REDESIGN_STAGE6_DESIGN_PROMPT.md`. Before = captures of 7 October (§3 "Re-measured 2026-10-07");
after = drawn **Warm only**: both volunteer shells ignore the Warm/Dark setting by ruling R3 (confirmed in code and on a
phone set to Dark, §3), so a Dark copy would draw a screen that cannot exist — only the Staff kit, an admin page, has
one. Drawn figures are read from the drawing (`.probe/s6/measure6.mjs` → the hub's `{{M:s6-*}}`). §6c and §6e stay for
Stages 3 and 5. **The shapes the owner ruled stay** (the cards and the score sheet's flow, ADC specimen 7; the buckets
under the thumb and the jobs as tabs, Option C 2026-08-07; Cancel as the way out, 2026-08-08; the inert wordmark; the
⇄ door on the scorekeeper only, 2026-07-24 and 2026-08-07); the gate's board is Stage 1's and drawn UNCHANGED.

- **V1 · The scorekeeper's list.** Today's cards (the whole card the tap, Up next with the olive edge), two changes on
  each: the state chips take the kit's one chip (10px capitals; today mixed case) and the time line leaves the
  capitals — "11:30 a.m." in the body face (F61). Refresh, Today, Filters and the ⇄ pill at 44px. The "SCOREKEEPER"
  eyebrow goes (an eyebrow is a trail or nothing; the tab and the title already name the job) and "Field scores" takes
  the 20px of every title (today 27, off the ladder). **The Review count wears the amber pill while above zero**
  (2026-10-01; ask A28) — on the count itself, outlined amber as the rail's. Both bars opaque (F59). Measured from the
  drawing: first game ≈187px (today 191), 3 whole games, 172px fixed chrome (unchanged).
- **V2 · The score sheet and what follows it.** The Sheet Frame's form (it covers the bars, as today): edge to edge at
  the foot, 18px corners, the grab line every sheet carries, the portal's dim; a sentence head ("Enter the score", /marketing) with the game's line (time ·
  field · division) under it; the boxes unchanged (64px on a phone, 72 wider); the policy note a white callout with an
  amber (review) or olive (final) edge — both drawn — kept directly above the button; Cancel and the one lime at 44px, the lime's words
  in sentence case (/marketing). **No ×** — Cancel stays the way out (2026-08-08), a named exception to the form head
  (ask A30). After Submit, a sentence notice floats above the bars and fades (~8 s): "Sent for review · Wolves 7, Royals 4"
  (/marketing); the list no longer drops (today about 104px, under a box that stays, F64). A sent-back score: the same
  notice names the game while the screen is open, back under To score (ask A32).
- **V3 · The gate, around Stage 1's board.** The page head names the event under "Check-in" (today beside it, where a
  long name wraps the title — costs ≈11px: first team ≈237px, 6 whole rows as today); with two or more assigned events a
  44px dropdown whose options say each status in the product's words ("Spring Classic 2026 · Completed", J8-015); the
  finished-event line a white callout with an amber edge in a volunteer's words (today an amber-tinted box). The arrival
  chip keeps "IN" and the time leaves it ("8:59 a.m.", F61). Bars opaque. **The team sheet** (shared, ask A29): D4's
  18px corners and the portal dim; a record head (the team, and "U11 Girls · Not arrived" or "In · 8:59 a.m. · by …");
  the plain 44px × (2026-10-07); Mark paid · $475 and Add roster as 44px white buttons (today a 35px amber-tinted box and
  an olive-tinted panel); the foot unchanged (No-show a third, the lime Check in two thirds, 48px).
- **V4 · One volunteer, two jobs.** Measured at 1 tap and kept: the duties as tabs; one duty = two tabs (the bar's own
  flagged "weakest case", unchanged — the bar comment's fallback is offered as a ruling option). **The tablet** (no
  tab bar above 640px): the header's "Check-in →" / "Scorekeeper →" and Sign out at 44px (today 19 and 15), the buckets at
  44 (today 42); the page under it drawn whole at 768 (title band, filters, buckets, cards). **The Account sheet** (ask A30): the frame's menu — on top of the tab bar with the bar live (today its
  dim covers the tabs it was opened from), its small-capitals label, no × (today an outlined 38px square); contents
  unchanged (who, the duties and the club, Install this app, Sign out), now as the menu's head and two rows in one
  ink treatment (today a bordered card and two outlined buttons, Sign out olive).
- **V5 · Where each volunteer lands** — a flow, with the sign-in a volunteer meets (walked) and the board a staff sign-in
  lands on (Stage 1's built capture; read from code). The link or QR always lands right and is unchanged. Without a link
  (the accept, the next morning, the app, a guessed /admin) every official lands on the scorekeeper (F62): drawn, they
  land on the job they hold (ask A26). Staff: unchanged (ask A25). The public home's missing door (J8-022) is the public
  pages' owner's, not drawn. The Members invite's volunteer part drawn as A26 would change it (shared, Club Tier roles):
  a role named for both jobs, "Helping with" as what they can do, its hint true.
- **V6 · The install banner** (ask A31): above the bars — the shells declare their bottom height (buckets + tabs + the
  home bar; 0 above 640px) and the banner stands on it — and under every sheet (the score sheet, Account and the team
  sheet cover it). The warm look on the warm shells (today the dark product's blue edge and console capitals, because its
  warm skin is gated on the user's theme). When it shows and the 90-day dismissal unchanged. Costs ≈66px with the drawn
  words (91 with today's two-line instruction): 2 whole games on screen one until dismissed.
- **V7 · The Staff kit** (it fails the check, F65): the title band with Print (the boxed 44px icon on a phone, a white
  34px button at a desk), one sentence (/marketing), two cards — the QR (dark on a fixed white square, both themes), the
  link breaking only at a slash, Copy link (white, an action) and Open (olive text with its arrow, a door) — and "Invite a
  volunteer" as a door to Members' invite with the volunteer role chosen. **A printed page of its own** (Letter, drawn
  true size): the club, the event and its dates, the two codes at 210px, three numbered steps, a footer — nothing of the
  admin. A Dark copy (an admin page).

**The asks — ⚖ ALL RULED 2026-10-07 as recommended** (the owner's paste-back, which also ruled V1–V7 as drawn): **A25** where a `staff` member lands
(rec.: keep it — staff by default runs the schedule and the posts, so its landing is the board, and a gate-only landing
rule would never fire on the defaults; fix the volunteer's door instead) · **A26** a volunteer lands on the job they
were given (rec.: "Helping with" becomes what they can do, through the per-member access that exists, every landing
follows it, the role named for both jobs, the invite no longer defaults to Staff for a volunteer — shared, Club Tier
roles; no new data) · **A27** the 44px floor (rec.: phone and tablet) · **A28** the Review count (rec.: the amber pill) ·
**A29** the gate's team sheet on the frame (rec.: once, for the organizer and the gate together — it also serves the
schedule's reschedule sheet and two public follow sheets) · **A30** the shells' own sheets (rec.: onto the frame's
layers, the score sheet without a × as a named exception) · **A31** the banner (rec.: above the bars, under every sheet)
· **A32** a finalized or sent-back score (rec.: the counts for a finalize; a live notice for a send-back; nothing
stored). Per drawing: V1–V7.

**Why A25 is not the prompt's recommendation.** The prompt recommended that "someone whose only tournament job is the
gate lands on the gate". `ROLE_DEFAULTS.staff` holds `update_schedule`, `post_announcements`, `submit_scores`,
`check_in_teams` and `module_tournaments`, so no default staff member is ever "gate only": the rule fires only when an
organizer has narrowed a staff member's access by hand, and then the right role was the volunteer one. The wrong landing
J8-021 describes comes from the invite (it defaults to Staff, and the volunteer role is called Scorekeeper) and from the
volunteer role forgetting its job (F62) — so the fix is A26, and staff's landing is right for what staff is.

**The formatting check** (the tab's last section, before the owner saw anything): Stage 1's sixteen rows, §3.5–3.7 and
§3.10, and every ruling since (to 2026-10-07: a close × is a plain glyph; a filter is quiet until it filters; the olive
pill; a row's flags under the name on a phone). Two named keeps, the owner's to overrule: the scorekeeper's game cards
stay cards with gaps and no chevron (a whole-card 160px button, the volunteer register — not S.7's one frame), and the
score numeral at 38px is the one size off the ladder (a field's figure). Flagged for `/marketing`: the score sheet's
Title Case buttons and "Enter Score"; "admin review"; "Results & Scoring"; "Staff Kit" vs "Staff kit"; "Settings &
Access" vs the rail's "Settings & access"; the role "Scorekeeper" for a gate volunteer; "Un-pay"; the banner's "Add to
Home Screen" (Apple's own button name). **A second, independent reviewer** then read the drawing and its rendered
pictures against the same rules: eight departures, all fixed (type off the ladder in five places — callouts and the
tablet doors 13, the Account rows 15, two labels 10.5; the Account sheet's contents tagged Unchanged though their shape
changes; its two rows in two treatments; the tablet drawn as a header strip only; the olive "final" note claimed and not
drawn; the banner's icon reading as a bug — it is the app's real F-over-L icon, now drawn as itself; the team sheet's
44px × not stated; the score sheet without the frame's grab line), and four claims that said more than the pictures —
**"the list drops 208px" had been read off a 2× picture: the notice is 88px and the list drops about 104** (corrected in
F64, V2 and the taps); "stays put" → "doesn't drop" (the list moves up a card); Mark paid under tinted panels (it is a
button); a team's arrival said "once" (once per surface). Two points stand, with the reason: the 768 "before" capture is
clean (the tab bar the reviewer saw came from a screenshot of the hub page), and the after-submit notice is the
product's toast, the dark pill every stage has drawn.

**Not drawn — the build's work:** any change to a landing or a role's capabilities (A25, A26: shared — the roles and the
invite are Club Tier's, the resolver the platform's); the banner's position contract and the guard test's new rows; a
rendered check that no clock sits inside a capitals style; the live update's forfeit and the buckets' forfeit count;
**the old look's retirement** in every file Stage 6 rebuilds — `scorekeeper.module.css` (58 kit-scoped rules),
`DayOfShell.module.css` (25), `check-in-volunteer.module.css` (6), `ShellSignOutButton`'s inline patch, the
`day-of-kit.ts` patches file, `staff-kit.module.css` (10), and the admin `BottomSheet`'s old layer if A29 moves it —
held by `npm run check:old-look` and the strict admin colour gate.

**Ruled 2026-10-07, and what the build prompt adds.** The owner's paste-back ruled V1–V7 as drawn and A25–A32 as
recommended; nothing else was ruled. Writing the build prompt (`TOURNAMENT_ADMIN_REDESIGN_STAGE6_BUILD_PROMPT.md`)
re-read the code A26 rests on and found it holds with **no new data**: `organization_members.capabilities` is the
per-member override, the shells already show a tab per job held, both screens and both routes already check the job,
and Members' Manage window already switches the two jobs. What is missing is the invite writing the job (the data
dictionary says capabilities are *not written at invite time*) and the three landings that send every official to the
scorekeeper — which today also sends an official an owner has narrowed to the gate onto the scorekeeper's *no access*
wall. Two placements the drawing does not show go to the owner at the build's start: **P1** who may change a
volunteer's jobs after the invite (today access changes are owner-only; rec.: whoever may invite may switch an
`official`'s two jobs, nothing else) and **P2** a volunteer with neither job (rec.: Members refuses switching off the
last one). Found at writing: the admin bottom sheet A29 moves has **five** users, not four — Teams' phone view
settings too; the ruling covers the sheet as one component. And the drawing's after-Submit notice reads ~8 s where the
product's one-off notice (`NoticePill`) lingers ~2.5 s; the prompt keeps 2.5 s for the volunteer's own action and the
sentence notice's ~8 s for a send-back.

**Stage 6 taps (volunteer, phone):** first score from a signed-out link **3 + typing → 3 + typing** (nothing over the
buckets or the sheet); the next score **2 → 2**, the list no longer jumps; check a team in **1 → 1**; switch jobs **1 → 1**
(a tablet's door 19px → 44px); a gate volunteer's next-morning sign-in **lands on the scorekeeper, +1 → lands on the
gate** (A26); the organizer copying a link from a phone **3 → 3**, the printout the sheet alone.

### Stage 6 — as built (2026-10-07; prompt `TOURNAMENT_ADMIN_REDESIGN_STAGE6_BUILD_PROMPT.md`; owner walk §282 ✅ 2026-10-08)

**Committed on dev 2026-10-07, after `/simplify` and `/review`:** `df49408a` Part 0 (shared with Club Tier's Members
and roles — the one landing rule `lib/volunteer-jobs.ts`, the words `lib/volunteer-words.ts`, the invite writing the
job, P1 and P2 in the member route, the role named "Volunteer", the data dictionary's note on
`organization_members.capabilities`) · `1b1546b9` Parts 1–4 (the two shells, the score sheet and the Account sheet on
the Sheet Frame, the admin bottom sheet for its five users, the install banner above the bars, the Staff kit and its
printed page on the shared `PrintedPage`, Summary moved onto it; the old look retired in every rebuilt file) ·
`d5df5e7b` the pricing pages' "volunteers" (words only — the seat rule is untouched). No migration.

**Rulings at the build's start** (owner, 2026-10-07): **P1** — "Helping with" sits in Members' Manage for a volunteer,
in place of the program table, and anyone who may invite may change it (the server allows a non-owner a change to the
two job keys of a volunteer, and nothing else) · **P2** — a volunteer left with neither job is refused, in words
("A volunteer needs at least one job. To end their access, remove them."). Also on the owner's word: probes allowed on
the dev server; the gate-only proof (the Plus volunteer narrowed to the gate, proven, restored and read back); the
pricing pages' word as its own commit.

**Calls made while building** (each on the hub's Built part, for the walk to question):
- A role change away from Volunteer drops the two job keys with the role; an owner's other overrides are kept.
- "Helping with" reads the two JOB keys only. An owner can also grant a volunteer `manage_registrations`, which opens
  the gate, but it is not a job — counting it made "Helping with" read "Both" for a scoring volunteer (/review).
- The wrong-job wall (one component, both shells) offers the job the volunteer does hold, as a door.
- The score sheet's **Cancel** stays the way out (A30's named exception) and a tap on the dim does nothing — the
  Sheet Frame gained `holdDim` for it, and `keypad` so the sheet rides the visible screen above a phone's number pad.
  Above 900px the sheet is a centred card.
- After a save the product's `NoticePill` (~2.5 s — the volunteer's own action); a send-back while the screen is open
  is the same pill as news (~8 s, an info mark), and if that game's sheet is open it stops being a correction.
- The install banner publishes its height, so the product's notice stands on it instead of under it.
- The Staff kit's tab and title say "Staff kit"; the rail already did.

**Review** (/simplify, then /review at the high-risk tier, five lenses): fixed before the commits — "Helping with"
counted an owner's `manage_registrations` grant as a job (Medium); two mounted install prompts could clear each
other's published height (Medium); the public tournament page's role link still sent every volunteer to the
scorekeeper (Low); a send-back of the open game left its sheet saying "correction" (Low). Left, stated: the member
route's capabilities write is read-then-write (as every PATCH there already was; the job path only subtracts); an
owner's extra overrides on a volunteer don't show in Manage (a read-only "also has…" line is offered); the admin's
save word sits a safe-area higher than the banner on an iPhone (cosmetic).

**Measured** (read-only probes, 2026-10-07, at 390 / 360 / 768 and 1180): the scorekeeper's first game at 186px from
the top (drawn ≈187), three whole games; nothing a volunteer taps under 44px on a phone or a tablet; no rendered time
in capitals in either shell; the score sheet edge to edge, 18px corners, the dim inert, the first card not moving after
Submit, the notice above the buckets; the Account sheet on a live tab bar, closed by a second tap; the gate's band at
212px (drawn ≈237), six whole rows, the arrival chip "IN" with "8:59 a.m." beside it; the team sheet's head, plain 44px ×
and white 44px buttons; the iPhone banner 66px tall, its bottom on the buckets' top edge, under every sheet; the Staff
kit printing one Letter page with nothing of the admin; Summary's print unchanged; the gate-only volunteer landing on
the gate from every door, two tabs, the score refused (403), restored to Both. Typecheck ✓, 869 unit tests by file ✓,
the token, old-look, selector, spelling, contrast and date gates ✓.

**Gaps against the drawings:** the gate's band sits ~25px higher than drawn (212 vs ≈237 — more of the list shows,
not less); the scorekeeper's first game ~1px.

**Not run, stated:** the scoped layout sweep (`check:layout --changed`) could not start — the Club fixture's budget
lookup ("Diamond permits — city fields") returns more than one row, from another session's fiscal-year data; not
reseeded from here.

**Found, routed (not built here):** **J8-022** (the public home has no door back for a signed-in volunteer) → the
public pages' owner · the help articles still say "Staff Kit" (5)
and "Scorekeeper View" (~22), and the demo's narration and a marketing caption say "Staff Kit" → `/docs` and `/demos`
(the product's own two buttons were fixed after the build: "See Staff kit →", "Open Staff kit").

**`/docs` done 2026-10-08** (uncommitted when written): the tournaments guide's "Hand scoring to scorekeepers" is now
"Hand scoring and check-in to volunteers" (anchor `scores-and-results` kept), five sub-topics (invite and choose a job ·
the Staff kit · Field scores · Check-in · Account, installing, the wrong code) and a new FAQ for "No access"; Results'
"Scorekeeper View" became Field scores and its "Scorekeeper" button; the org guide's role is Volunteer in the table,
the list, the invite steps (Helping with), Manage, the one-home-organization line and the seats line; the help hub card
and quick links (the volunteers' topic gets its own link). No help screenshot showed these screens. **Found while
writing, not fixed (owner calls):** (1) **a volunteer can't be limited to specific tournaments — and couldn't before
Stage 6.** First written here as a Stage 6 regression; **corrected the same day:** Manage's tournament list sits under
the Tournaments program row and shows only for a member who opens Tournaments, which a volunteer's role never does
(`ROLE_DEFAULTS.official` = the two job keys), so it never showed for one. The help's old "staff and scorekeepers"
line was stale and is gone. Not a defect; a possible feature if a multi-event club asks. (2) **four refusal messages
still say "scorekeeper"** (`lib/org-membership-policy.ts` — the invite and accept refusals for one home
organization; one reads "This person keeps score for another organization", wrong for a gate volunteer). (3) the
demo's narration (`lib/walkthrough-content.ts`) and the marketing shot caption (`lib/marketing-shots.ts`) still say
"Scorekeeper View" / "Staff Kit" → `/demos`.

**Owner walk:** the QA tab's walk 7 (Owner QA Ledger §282) — a volunteer's game day, from a phone.

## 7. The asks

A1 · which stage first · A2 · one event identity · A3 · phone or desk per station · A4 · Storm Mode and
the Big Board stay their own projects with a place left · A5 · the Club seams · A6 · plan gating on
redesigned screens · A7 · one word per game state · A8 · the defects list now or with their stages · A9 ·
game-day screens refresh themselves · A10 · Results opens on "needs you, every division". Each is on the
hub's Walk tab with options, a recommendation, the tradeoff and a checkbox per option; the Stage 1 tab
carries a ruling per drawn change (G1–G8). Later stages' asks live with their drawings: A13–A17 (§6b), A18–A24 (§6d),
**A25–A32 (§6f, ruled 2026-10-07)**, **A33–A46 (§6c, ruled 2026-10-09)**, **A47–A58 (§6e, ruled 2026-10-10)**.

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
