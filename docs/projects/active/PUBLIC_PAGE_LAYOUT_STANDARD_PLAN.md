# Public page layout standard — plan

**Status:** DRAWN round 1 2026-11-04; **A1–A9 RULED as recommended 2026-11-04** (owner: "I agree with your recommendations"); A10 (ways to the club) resolved the same day on the recommendation (the host card only when something is open); round 2 (game page + team page) DRAWN 2026-11-04 after /design; **A11–A14 RULED as recommended 2026-11-04** ("I agree with your recommendations, go ahead and make the build prompt"). **Build prompt written 2026-11-04:** `PUBLIC_PAGE_LAYOUT_STANDARD_BUILD_PROMPT.md` (six sessions: 1, 2a, 2b, 3, 4, 5). **Club round session prompt written 2026-11-04:** `PUBLIC_CLUB_PAGE_LAYOUT_REVIEW_PROMPT.md` (two sessions: census + drawings + asks, then the build prompt; its build waits on the tournament build's Parts 1–2b, which share the club kit). **Part 1 built 2026-11-05** — the written standard (`docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md`), every page body on one wrapper (`PublicPage`), the two-column pages stacking below 1,200 px, the guard (`tests/unit/public-page-layout-guard.test.ts`), committed `20bb5db54` 2026-11-05. **Part 2a built 2026-11-05** — the game row and "live": a live game on the one 104 · rest · 104 grid, nobody bold or soft until final, one pill set (Final neutral, a game's page included), the today's-games line green, the edge one shape, the stacked form built as one shared part (sizes compact / large, place strip) for Parts 3–4, committed `4a0c04559` 2026-11-05. **Part 2b built 2026-11-05** — the link row (the club kit's list row, shared not copied) for every door and window row, the three heading levels, the toolbar widths, the corner/border/type sweep, "The playoff bracket" everywhere, the desk band at 72 px; committed `78ac67885` 2026-11-05. **Part 3 built 2026-11-05** — the page passes: the Overview's lists on the stacked form, its bracket link in the side column, the host card only when something is open and outlined; Standings' and Rules' rows joined into one list each (a row opens in place inside the list on a phone); Playoffs' bracket matches and its game still to play on the shared game forms; Teams' rows two-line link rows; the old empty-state card on the standard; committed in `f4a62754e` 2026-11-05 (another session's commit, bundled with its own work, before the owner's desk check). **Part 4 built 2026-11-05** — a game's page (no back link; score card left and when-and-where right on a desk, when-and-where first on a phone; time 28 px; the facts list gone, the game length in the when-and-where card; the score card the shared large game card), a team's page (no back link in any state; name 24 px title face; every game still to finish on the stacked card, this team first and bold, the day leading the time; the standard section headings; the standings link a link row with its second line; the states on the shared empty card), News's headings on the standard, the Register form 640; committed `efb77f848` 2026-11-05; **Part 5 (review, layout check, the walk, records) done 2026-11-05** (committed `513ad05a4` 2026-11-05; walk §460 owed); next = the club build (`PUBLIC_CLUB_PAGE_LAYOUT_BUILD_PROMPT.md`). **Club round drawn 2026-11-05** (§5b; drawings https://claude.ai/artifact/96Jaq1JZNr8EgGaV3dxmLt, v2 after /design); **C1–C7 RULED as recommended 2026-11-05** ("i agree with your recommendations, go ahead and write the build prompt"); the standard amended the same day; **club build prompt written 2026-11-05:** `PUBLIC_CLUB_PAGE_LAYOUT_BUILD_PROMPT.md` (five sessions; starts after the tournament build's Parts 1, 2a, 2b; its Part 4 after the tournament Part 4). C1 and C2's Register width were added to the tournament build prompt (Part 2b step 6, Part 4).
**Drawings:** https://claude.ai/artifact/NC6Y7ijjYtd3Kr4cGPgbep (source `PUBLIC_PAGE_LAYOUT_STANDARD_DRAWINGS.html`, same folder).
**PM brief:** `PUBLIC_PAGE_LAYOUT_STANDARD_PM_BRIEF.md`.
**Parent:** the public tournament site review (`PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md`); this pass follows its Stage 8 switch-on and reuses every part it built.

## 1. Why

Owner, 2026-11-04, on the desktop Overview and then every public tournament page: the pages feel jumbled and do not
flow from one to the next — spacing and layout formats differ page to page. After the tournament pass is approved and
built, the same exercise runs on the club's public pages, because families toggle between a club and its tournament.

Each Stage (2–6) built its page on its own, so each picked its own edges and recipes. Measured 2026-11-04 (code census,
desk ≥1,024 px, CSS px):

| Page | Padding | Content width | Starts |
|---|---|---|---|
| Overview | 28/32 | fills the main column | 28 |
| Schedule | 16 | children 860 | 16 |
| Standings | 24 | children 720, division 360 | 24 (+ ticker) |
| Playoffs | 28/32 | fills | 28 (+ ticker) |
| Teams | 28/32 | filters 640, groups 860 | 28 (+ ticker) |
| Rules | 28/32 | 860 | 28 (+ ticker) |
| Game page | 0/16/16 | fills | 0 |
| News / Register | old `.container` | 1,200 centred | 24 |

Also: a game is drawn eight ways (Overview live card, Overview rows, Schedule row, Schedule live card, Playoffs card,
bracket match, team results, game page), "live" is shown nine ways (band black dot, ticker red, Schedule green pill,
Playoffs/Teams green text, bracket green edge, a heading, a chip), corners are 6/8/9/10/12/20, box borders use three
colours, and text uses ten sizes (12, 13, 14, 16, 18, 20, 22, 24, 28, 32).

The club frame (measured the same day) puts tabs in the band, centres one 1,200 column and keeps 744/760/960 reading
measures left-aligned inside it. It shares tokens, band parts, footer and the club kit with the tournament frame.

## 2. The proposed standard (R1–R11, drawn)

**Written up (Part 1, 2026-11-05) as the living reference `docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md`** — the
rules word for word from the drawing, each rule's "Keeps" line, the Exceptions, and how to check a new page. That file
is the standard from now on; the summary below is the plan's record of what was drawn.

1. **Width** — one content column, max 960, left-aligned to the frame's own edge (tournament: 32 px right of the menu); the Overview's two columns split the 960 and stack below a 1,200 px window. Phone: full width, 16 sides. Club pages keep their centred 1,200 column with the 960 on its left edge (club round). Exception: a 3+ round bracket scrolls in its own box.
2. **Top** — content starts 28 below the band or the today's-games line; a page opens with its toolbar or first heading; no page title (phone: the tab row names the page).
3. **Rhythm** — 24 between sections, 12 between toolbar rows, hairlines (no gap) between list rows.
4. **Three heading levels** — division heading 18 px (ruled 2026-10-30); section heading = `PublicSectionHead` (16/700, count pill, right link); pool band = the club kit's `.listBand` inside a list. A pool with its own table takes a section heading.
5. **Lists** — rows of the same kind are one framed list; separate boxes only for different kinds; two lines max. Registered exception: a game row (head + two teams, no chevron, whole row is the link — `PublicGameRow.tsx:47`).
6. **One game, two forms** — order when · who · status. Stacked (any column < 600 px, every phone) = the phone recipe ruled 2026-10-29. One line (wide desk list: Schedule, Playoffs) = the desktop row kept 2026-10-29, on the 104 · rest · 104 grid for EVERY state — the live card's `1fr 2.2fr 1fr` grid (`PublicSchedule.module.css` live override) is what wraps long names and goes. Full-ink names; winner bold / loser soft only when final (`lib/public-game-row.ts:101-109`). No field on the all-games list (ruled 10-29); Overview Live now + Up next keep field, Live now keeps Directions. Team page: that team first and bold (ruled 10-30). Bracket = stacked compact. Game page keeps 28 px.
7. **Link row** — the club kit's `.row` (60 tall, 16/600 title, optional 12 px dim line, drawn chevron) replaces `PublicDoorRow` (56) and `PublicDisclosure` (52); rows that open a window look the same; one name per destination. Named "link row" because the club kit's `.door` is a different part.
8. **Toolbar** — Division 200 · Pool 160 · view switch · Search (fills, max 320) · calendar; 44 tall, radius 8; a page shows only the controls it has; day chips their own row (as shipped); "Search teams" / "Search teams or coaches".
9. **Live** — green pill + 3 px green edge; said once (no pill under a "Live now" heading); green text inside a sentence; band keeps its dot; ticker keeps "Live" (ruled 2026-10-28) in green. A 3 px left edge always marks a state (green live; club colour "open" on club pages).
10. **Boxes and type** — radius 8 (pills round, logo 10, view-switch track 9 = 3 + 6 nested); light hairline on boxes; tables keep the table standard's darker frame and their shipped 52 px rows; field colour on inputs only; no shadows; type 12 · 14 · 16 · 18 · 20 · 24 (+28 game page). Frame chrome (band, menu, ticker) exempt.
11. **Weight** — a filled button only for the page's main job (Register, Pay); a selection inside a control is a fill, not a button; "Visit the club" is outlined.

## 3. Asks (A1–A9, on the drawings' Asks tab)

A1 960 width · A2 wide lists keep the ruled one-line row and the live game moves onto its grid (alternative: stack
everywhere, rows 60 → ~84 px) · A3 Overview lists use the stacked form · A4 live green incl. the ticker · A5 "The
playoff bracket" everywhere · A6 Overview bracket link to the right column · A7 "Visit the club" outlined (its filled
club-colour button was ruled with the host card) · A8 Rules/Teams as joined lists, Teams rows two lines, pools as band
rows · A9 write the standard into `docs/agents/design/` with an exception register. **All nine RULED as recommended
2026-11-04.**

**A10 — RESOLVED 2026-11-04 on the recommendation** (owner: "we can leave it if you don't think its too much" —
he left it to the assessment, and the assessment is that the empty card is too much): band + footer stay; the host
card shows only when the club has something open now. Owner also asked the same day for the game page and the single
team page to be reviewed (missed in round 1) — round 2. **The question as raised:** the Overview shows three ways to the club (the band's "Hosted by ›" from
1,024 px, the host card's Visit the club, the footer's "Hosted by ›"); other pages two. The three were ruled together
on 10-27 (Ask 4: "host card with the club's open-now list + footer line + desk band link"), for the reason "the way
from a tournament back to the club should advertise the club, not just be a back link". Facts: the band link is
desk-only, so a phone has only the card and the footer; the card exists whenever the club has a public site, and with
nothing open it falls back to "runs teams and programs all year" (`lib/public-host-card.ts`) — a third link with
nothing to advertise. Recommendation: band + footer stay (wayfinding, every page); the host card shows only when the
club has something open now.

**Round 2 — a game's page and a team's page (drawn 2026-11-04, after `/design`; A11–A14 RULED as recommended 2026-11-04):**
- Census: game page padding `0 16 16` (top 0, no desk override), fills, time h1 32 px (off-scale), score 28, when/where
  card then score card then a facts list (Division / Round / Game length — division and round said twice), Final chip
  green like Live now. Team page 28/32, fills, name 22 px (off-scale), h3 headings (not `PublicSectionHead`), `line-2`
  boxes, radius-6 icon/retry buttons, Up next on the one-line Schedule row in a ~690 px column with the day inside the
  104 px time slot (time and long names wrap), its own Results row, record card padded to align.
- A11 desk: score card left, when-and-where right (Directions on its title line, game length folded in), time 32 → 28;
  phone keeps the Stage 3 order (when and where first, Directions ~303 px down — `PUBLIC_TOURNAMENT_STAGE3_BUILD_PROMPT.md:44-46`).
  Final pill neutral (R9: green = live only). The time stays the page's h1; team names stay links.
- A12 division and round said once (score card top line); the facts list goes.
- A13 team page Up next / Next games → stacked row, team first and bold, day leading the time on its own line;
  Results keep their team-view row (ruled 10-30) as a registered exception; record card keeps no heading ("no new label",
  10-30). Name 24 px title face = registered exception to R4.
- A14 drop "‹ Schedule" and "‹ All Teams" (the club pages' 10-20 rule: a back link stays only when it goes somewhere the
  tab row does not; both are fixed links to tabs). Also fixes the withheld team state having none.
- Build notes: the shipped two-column breakpoint is 1,024 (R1 says stack below 1,200 — a build change); shipped stakes
  on the team page's Up next row: none (PublicGameRow draws no foot), so none drawn.

**Not asked now (club round):** menu-on-the-left vs tabs-in-the-band; band 88 vs 72; the club's own measures.

## 4. Build shape (after the rulings — sequenced by dependency, not dated)

1. Write the standard (`docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md` + exception register) — A7.
2. Frame layer: one page wrapper (padding, 960 cap, top, gap) used by every public tournament page; News/Register/game page brought onto it.
3. Shared parts: `PublicGameRow` grows the when/who/where anatomy (narrow, wide, compact) and replaces the Overview live card, Schedule row, Playoffs card, bracket match and team results; one door recipe (`PublicDoorRow` + `PublicDisclosure` share it); toolbar widths; live look; radius/type sweep.
4. Page passes: Overview (A5), Schedule (A2), Standings, Playoffs, Teams + Rules (A6).
5. `/simplify`, `/review`, layout check on the touched screens, then one owner walk.
6. Club round: same census + drawings on the club's public pages against this standard.

## 5. Notes

- The "12:00 a.m." championship time on the dev fixture is real seeded data (`scripts/seed-public-stage3-fixtures.mjs`
  places the final three hours after the semifinal), not a missing-time bug; a null time renders "TBD".
- Drift to report in the build (not drawn): the Overview prints the place as "lions park — diamond #2" (organizer
  data, em dash) where the table standard's C5 asks "Venue · Facility"; Standings' table cells ship 8/6 padding while
  register K-16 still says 16 px — reconcile the register.

## 5b. Club round (session 1: census, drawings, asks — 2026-11-05)

**Drawings:** https://claude.ai/artifact/96Jaq1JZNr8EgGaV3dxmLt (source `PUBLIC_CLUB_PAGE_LAYOUT_DRAWINGS.html`, v2 after
`/design`). Session prompt: `PUBLIC_CLUB_PAGE_LAYOUT_REVIEW_PROMPT.md`. Measured against the written standard
(`docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md`, Part 1 landed 2026-11-05). **C1–C7 RULED as recommended
2026-11-05**; the standard carries them (R1, R2, R4, R7, R10 *Club round* lines; club rows in Exceptions); build prompt
`PUBLIC_CLUB_PAGE_LAYOUT_BUILD_PROMPT.md`. Nothing built.

**Scope (end-state tags).** Stays public: club home, Teams, a team's page, Tryouts, a tryout page, tryout sign-up, House
league index, a season page (§0k), league sign-up, Your sign-up (status/pay by emailed link), Tournaments, About, a past
tournament's record, in-club not-found. Unclear: the house league's Schedule and Standings pages (C7; standard applied on
paper, not drawn). Out: the coach's house-league team page (sign-in), tournament pages.

**Census at 1,536 (CSS px; the logo's edge is 192 = `max(24, (100% − 1200)/2 + 24)`).**

| Page | Left | Width | Top | Gap | Title | Source |
|---|---|---|---|---|---|---|
| Home | 192 | 1,152 (744 + 380) | 28 | 20 | none (sr-only) | `ClubSiteHome.module.css:15-22, 110-125` |
| Teams | 192 | 744 | 28 | 16 | 32 + "8 teams" | `app/[orgSlug]/teams/ClubTeams.module.css:6-13, 108-115` |
| A team | 192 | 1,152 (744 + 380) | 20 | 20 | 32 + dot | `TeamPage.module.css:5-11, 86-115` |
| Tryouts | 192 | 1,152 | 28 | 20 | 32 "2027 tryouts" | `components/public/TryoutPage.module.css:6-20` (`.wide`) |
| Tryouts, off-season | **464 (centred)** | 608 | 16 | 20 | 32 | `tryouts/page.tsx:93` (no `.wide`) |
| A tryout | **464 (centred)** | 608 | 16 | 20 | 32 | `TryoutPage.module.css:6-13` |
| Tryout sign-up | **472 (centred)** | 592 | 32 | 24 | 32 | `TryoutRegisterView.tsx:142-148` (inline) |
| House league / a season | 192 | 760 | 32 | 32–40 | 32 | `app/[orgSlug]/league/league-column.module.css:22-33` |
| League sign-up | 192 | 640 | 32 | 24 | 32 | `league/[seasonSlug]/register/page.tsx:78` |
| Your sign-up | 192 | 560 | 32 | 12 | 32 | `status/[token]/page.tsx:121-124` |
| Tournaments | 192 | 960 | 28 | 24 | 32 + count | `app/[orgSlug]/tournaments/ClubTournaments.module.css:5-12, 109-116` |
| About | **404 (centred)** | 728 | 16 | 20 | 32 | `components/public/ClubAbout.module.css:3-10` |

Phone: 16 px sides except the `.container` pages (league, archive record: 24). Type in page bodies: 11, 12, 13, 14, 14.4,
15, 16, 18.4, 19, 20, 32; weights 650/750/800; radii 6, 8, 9, 10, 12, 20.

**Findings.**
- The 08-01 repair ruling (R6, `TOP_NAV_REPAIR_PLAN.md:219-224`, restated in `league-column.module.css:1-15`: a page's
  measure sits left-aligned under the logo) is broken by About, a tryout page, the tryout form and off-season Tryouts.
  Moving them is a repair, not an ask.
- **The hop.** Same tokens, ground, band parts and footer parts on both frames. On the click at 1,536: band 75 → 91 (the
  tournament's 88 is "the drawing's size", `TournamentFrame.module.css:113-116`, never asked), logo 192 → 32, tabs in the
  band → the 248 px menu, content 192 → 280, club 1,152 wide vs tournament 960, 32 px titles vs none. At 1,280 the
  content moves 216 px; at 1,024, 256 px and narrows to 712. A phone is already near-seamless (same 72 band, same white
  tab row, same 16 edge). Menu vs tabs is answered by rulings on both sides (08-01 Stage F "never the tournament's left
  rail"; the tournament redesign's rail), same reason: each nav lines up with its own page.
- A club team page and its tournament team page do not link either way (`PublicTeamPage.tsx:28,70`; the club team page
  has none) — C6.
- Kept as ruled and registered as exceptions: Born in = the house `SingleSelectDropdown` pill (2026-10-22,
  `BornInPill.tsx:9-15`); a phone's secondary action is its bare symbol (2026-10-20); the team page's calendar rows
  (10-19/10-20); the pay page's information blue for "clearing" (12c).
- Defects found, not layout: a failed Tournaments read lands on the platform error page without the club frame (no
  `app/[orgSlug]/error.tsx`); a team with no games yet keeps the desk two-column grid with an empty 744 px column
  (`schedule: !!publicSchedule` true while `RepTeamPublicSchedule` returns null on `entries: []`); `PublicParts.module.css:212`
  says club forms share the 680 px register sheet — they don't (both club forms are 640); `VISUAL_IDENTITY.md:229-231`
  still says scores keep the typewriter face on club pages (DC-03 removed it, 10-19) — for `/design`.

**Asks (on the drawings' tab 5).** C1 one band height: the tournament's desk band to 72 (touches the tournament build) ·
C2 960 for every club page, forms 640 on both sites, the two-column pages split the tournament's way (replaces the 08-01
per-page measures; touches R1's wording and the Register form) · C3 no title where a lit tab names the page · C4 a
one-thing page's name at 24 · C5 24 between sections (reverses the 10-20 team-page 20) · C6 link a team's two pages
(host club's own teams; touches a tournament team page) · C7 the house league's Schedule and Standings stay public for
this build. Recommendation on each: option 1.

**`/design` (v1 → v2, 2026-11-05).** Caught: Born in redrawn as a 44 px select (reversed the 10-22 ruling unannounced);
phone Subscribe/Directions/Copy drawn bordered (reversed 10-20); invented Teams/Tryouts headings; misdrawn Today frames
(season page facts and states, Tournaments' six past columns and Status column, tryout page and both forms' words, the
status page's per-child cards, About's section names, the schedule's fold labels); C2/C3 overstated that no ruling set
the widths and titles; missing states (banner, sponsors, mixed-season Tryouts, finished tryout, closed and finished
season, three league-form closed variants); 1,280 and 1,024 not drawn; PayBlock shared with the tournament pay page. All
applied in v2; C3 split into C3 + C4.

## 6. Log

- 2026-11-04 — census (tournament + club frames), drawings round 1 published (v1), plan + brief written.
- 2026-11-04 — `/design` review of v1 (20 findings; applied before the owner saw it, v2). Must-fixes it caught: v1's
  game row reversed three standing rulings unannounced (no field on the all-games list, the phone recipe, the desktop
  one-line Schedule row — all 2026-10-29) and dropped the 18 px division heading (2026-10-30); it bolded the leader of
  a live game (shipped bolds only a final winner); R5 contradicted the game row; tables were wrongly pulled onto the
  light hairline. Also: missing states (unofficial, cancelled, no score yet, tie, stakes, long name in the 397 column,
  phone 360) now drawn; toolbar now shows Pool + calendar; link row = the club kit row; A5 split into A6 + A7.
  Net change of direction: "one game row" became "one game, two forms" built from the two ruled recipes.
- 2026-11-05 — club round session 1: census (six helpers), drawings v1, `/design` (12 findings, v2), asks C1–C7 (§5b).
- 2026-11-05 — C1–C7 RULED as recommended; standard amended; design log entry; tournament build prompt notes (C1 → Part 2b
  step 6, Register 640 → Part 4); club build prompt written (five sessions).
- 2026-11-05 — **Build Part 1.** `docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md` written (R1–R11 word for word from
  tab 2, each rule's Keeps line, the Exceptions, how to check a new page), linked from `TABLE_AND_LIST_STANDARD.md` and
  §2 here. Every public tournament page body (all eleven: Overview, Schedule, Standings, Playoffs, Teams, Rules,
  Champions, game, team, News, Register — every branch, loading and unavailable included) renders in `PublicPage`
  (`PublicParts.module.css` `.page`: 960 + sides, 28/32 desk, 16 phone, 24 gap); each page's own padding, 720/860/800
  caps and section gaps deleted; a page's toolbar rows are one section (`.tools`, 12 px — the drawing's `.tools`).
  The Overview, game page and team page share `.cols` (1.35 : 1, 28) from 1,200 px; the game page left its 1.45 : 1 / 24.
  News and Register left the old centred `.container`; News lost its desk-only page title for a screen-reader `h1` (R2);
  Register's form sits on the left edge (`.leftEdge`). Guard: `tests/unit/public-page-layout-guard.test.ts`; Stage 2 and
  Stage 5 guards moved to the new frame. Register reconciled: **K-16** now records Standings' shipped 52 px rows / 8 × 6
  cells; **K-28** turned out to be the ORGANIZER's admin Schedule, not the public one — clarified, not rewritten (the build
  prompt's "it now stops at 960" would have mis-recorded an admin page this build does not touch). Registered as held for
  later parts: the Teams toolbar's 640 cap (2b) and the state card's 620 box (4). Also registered: the team pay page
  (focused, own 640 column) — the census table had missed it.
- 2026-11-05 — **Part 1 committed** `20bb5db54` (its own files only; the plan, brief, drawings and build prompt went in
  with it). The club round's prompt and drawings are a separate session's and were left out.
- 2026-11-05 — **Build Part 2a.** One part for both game forms: `ScheduleMatchup` (`components/public/PublicGameRow.tsx`)
  takes `form="wide"` (default, the Schedule/Playoffs row) or `form="stacked"` (any width; `size` compact / large;
  `pill={false}` under a "Live now" heading; `place` with Directions as a strip OUTSIDE the row's link; a side's
  `placeholder` dim; `footTone="plain"` for a game page's sentences). Every desk one-line rule and both phone Schedule
  rules are scoped to `.wideForm`, so the stacked form is the drawing's one layout at every width and the phone Schedule
  is unchanged. **A2:** the live override's `1fr 2.2fr 1fr` grid deleted — measured on the dev server with the Stage 3
  fixture re-anchored (`prepare`): "Milton Bats U11 Purple (Jackson)" on ONE line at the 960 column (1,280 and 1,536 px
  windows; grid 104 · 698 · 104), the time on the rows' 15 px line; at 1,024–1,199 px (712 column) it wraps to two, as
  any row with that name does. **R6 names:** a live game draws neither side bold nor soft (the Schedule's live card had
  bolded the leader; the Overview's card and a game's page softened the trailer — the page now softens only once final).
  **R9:** `GameStatusPill` is the one pill set, used on a game's page too (its Final was green; its Cancelled chip is the
  pill). **A4:** the today's-games line's "Live" and dot `--club-ok`. **Edge:** a standalone card's border with
  `0 8 8 0` corners (Schedule live card, Playoffs card), inset `.edge` on a stacked row in a list. Not adopted by any page
  yet: the stacked form's sizes, place strip and placeholder — Parts 3 (Overview, bracket) and 4 (game page, team page)
  switch onto it. Tests: 9 new in `tests/unit/public-schedule-compact.test.ts`. Layout check: Schedule live, game live,
  team page clean at 361/390/768/1,440; the Overview's findings are the demo tour bar's own buttons (untouched here);
  `pubt-playoffs-live` still does not render (fixture aged out; the Schedule's live screen measured the same card).
  Standard: R6 and R9 gained a "Built" line naming the part.
- 2026-11-05 — **Build Part 2b.** **R7:** `PublicDoorRow` renders the club kit's `.row` (`ClubKit.module.css`, imported,
  not copied; club CSS untouched) inside `PublicLinkList` (the kit's `.list`; a lone row is a list of one); the old
  56 px `.door` / `.doorSub` / `.chevron` / `.doorList` rules deleted. `PublicDisclosure`'s row is the same kit row in a
  list of one; a window row keeps the right chevron, an in-place dropdown points it down (up while open) — a judgement
  call, so the expand signal survives. Window corners 12 → 8. Callers grouped: Overview's after-event doors and the
  Champions page's two are one list each; Schedule's Teams + Register one list. **R4:** `PublicSectionHead` gains
  `division` (18/600); Teams' division heading uses it with the count pill, its pools are ONE kit `.list` per division
  with `.listBand` pool rows (the Teams ROW recipe stays for Part 3); Standings' pool headings read "A Pool" (section
  name kept for screen readers). Team page h3s left for Part 4 (A13 redraws that page). **R8:** desk Division 200, Pool
  160, switch natural (buttons ≥ 136), Search fills to 320 (min 160), gap 12; Standings/Playoffs 360 → 200; Teams 200 +
  320; selects 6 → 8; placeholders "Search teams" / "Search teams or coaches" on Schedule and Teams (the coach words only
  where a team carries a coach — the same rule the search matches on). **R10 sweep:** radius 6 → 8 (selects, Teams star
  + Retry, team page symbol + Retry, Rules close, Playoffs callouts, bracket tools + match); `--club-line-2` → `--club-line`
  on boxes (Playoffs card + seeding, Standings explainer, team page cards, bracket) — table frames and the count pill
  kept; register countdown 32 → 24, state titles 22 → 20, team name 22 → 24 (face in Part 4), the old state card's
  11.2/15.2 → 12/16. Left by design: the game page's 32 px time (Part 4), the switch track 9/6 nested, pills, logos.
  **A5:** `SCHEDULE_BRACKET_DOOR` gains `line: 'See who plays who'` and names every bracket link (Overview, Schedule,
  Standings); Schedule/Standings keep `playoffDoorSub`'s news line when it has one (judgement call, told the owner);
  Champions' empty-state button "Playoff Picture" → "The playoff bracket"; Playoffs' error "Playoffs unavailable". **C1:**
  the desk band's `--club-band-h: 88px` override removed (72 + rule, a minimum). Found, not fixed: the old state card
  (`PublicTournamentState`: glow, shadow, clamp title) is off the standard — Parts 3/4; the help article "What is the
  Playoff Picture page?" names a page that no longer exists — Part 5 `/docs`. Tests: 6 pins updated to the new looks
  (stage 2/4/5 guards, frame guard, Teams + Standings render, layout guard's stale Teams 640 exception). Pre-existing,
  not this part: `public-tournament-stage6-walk.test.ts` fails ("PARTS is not defined" in the Stage 6 walk HTML, unchanged
  since 2026-11-01); `verify-changed.mjs`'s ESLint step fails on its react-hooks plugin config (direct `eslint` on this
  part's files is clean); `check-css-selectors` flags other areas' classes only.
- 2026-11-05 — Part 2b committed `78ac67885` (a partial commit: this build's lines only out of the plan, the standard and
  TODO, which also held the club round's uncommitted records; the payments and support-console test edits in the tree
  were other sessions' and stayed out).
- 2026-11-05 — **Build Part 3 (the page passes).** **Overview (A3, A6, A7, A10):** Live now / Up next / Latest results
  are framed lists of `ScheduleMatchup form="stacked"` rows (PublicParts `.gameList` in the kit `.list`); Live now has
  no pill (the edge says it) and keeps the field + Directions as the place strip; Up next keeps its field; a result has
  no time, the Final pill, the winner first and bold. A game on another day leads its context with the day ("Thu, Nov 5 ·
  U11 · Championship"); today's games don't repeat "Today" (judgement call, told the owner). The bracket link moved to
  the side column after Latest results. `hostCardView` returns null for an empty open-now list (the "runs teams and
  programs all year" fallback deleted, test updated); `.hostBtn` outlined. `data-sandbox-tour="latest-results"` kept.
  **Schedule:** nothing left to change (wrapper, toolbar and the live grid were Parts 1–2b); checked against the drawing.
  **Standings:** "How the table is ranked" + the bracket link are ONE `PublicLinkList`; the explainer now opens a window
  on a desk (the drawing's right chevron; one rule with Rules and seeding — told the owner, his to veto). **Rules (A8):**
  one framed list; each rule a `PublicDisclosure joined` item carrying its own anchor id (deep links still scroll and
  open). **The owner's call left to the build — how a dropdown opens inside a joined list on a phone:** in place, inside
  the list, under its row, between hairlines; the content is plain and the panel or the window pads it (Standings'
  explainer and Playoffs' seeding lost their inner boxes, so no box-in-a-window on a desk either). `PublicDisclosure`'s
  unused `desktopOpen` / `reveal` props deleted. **Playoffs:** Live now count 1; the game still to play (owner
  2026-11-05: "go with your recommendation") is the one-line row in a list, day in the right column (the toolbar names the
  division), the field centred under the teams (`.wideForm .gamePlace`); the bracket's matches are the compact stacked
  form in a light-hairline 8 px frame, the zoom still shrinking the board, not the words (compact sizes divided by
  `--public-bracket-zoom`). Playoffs' own `.gameCard` recipe, `PublicLiveCard`'s playoff and Overview variants, the old
  Overview row (`PublicGameRows`, PublicParts `.row/.when/.teams/…/.liveMeta`) deleted; `PublicGameRow` lost its
  `schedule` prop (always the wide row). **Teams (A8):** each team a `PublicDoorRow` (now `className` + a node `sub`) in a
  `.teamRow` beside the app-only star; two lines: the name, then "{qualifier} · {record · place · next}", Live now green;
  pools are band rows directly in the division's list. **Empty state (found in 2b):** `PublicTournamentState` under the
  frame is the Schedule's empty state (white card, hairline, 8 px, left-aligned, 20 px title, dim line, plain symbol);
  Teams' and Rules' wrappers removed. It reaches the Part 4 pages too (one shared part). Outside the frame untouched.
  **Checks:** typecheck clean; ESLint clean on the changed files; spelling, CSS purity clean; `public-*` + demo guard
  816/819 (the 3 = the Stage 6 walk HTML, pre-existing); 8 test files re-aimed at the new markup (a helper; no regression
  found). **Layout check** (12 Part 3 screens, dev server): Overview's findings are the demo tour bar's buttons only
  (as in 2b); standings-own, playoffs-seeded, teams-free, overview-long/after, rules-pale clean. Did not render:
  `pubt-playoffs-eight` — CAUSED BY THIS PART: its interaction reads the old bracket markup
  (`[data-bracket-game] > span:nth-child(2)`); a one-line selector change in the shared screen list, reported to the
  owner, not changed (his call). `pubt-schedule-live`, `pubt-schedule-playoffs` (waits for the old name "The bracket"),
  `pubt-standings-playoffs`, `pubt-playoffs-live` — the aged fixtures / stale names 2b reported. Seen, not changed: a
  Teams PREVIEW row (no link) still draws the kit chevron (PublicDoorRow's existing behaviour).
- 2026-11-05 — Part 3 found committed in `f4a62754e` ("Public page layout Part 3, online-payments gate wording…"),
  another session's commit that bundled it with its own work while this session was preparing Part 3's partial commit;
  the owner's desk check had not happened (owner, 2026-11-05: "commit then start part 4").
- 2026-11-05 — **Build Part 4 (a game's page, a team's page, News and Register).** **A game's page (A11, A12, A14):** no
  back link; ONE DOM order, when-and-where first (a phone's Stage 3 order), placed by CSS from 1,200 px (score card
  column 1, when-and-where column 2: `PublicGameDetails.module.css` `.cards`); the time 28 px title face, the page's
  `h1`; "Game length {n} min" a dim line in the when-and-where card (`view.length` replaces `view.facts`; the facts
  list gone); Cancelled in Directions' place; TBD as shipped. The score card is `ScheduleMatchup` stacked large in a kit
  `.list`: "{round} · {division}" + the pill (none when cancelled), the names links to their team pages, the winner bold
  and the loser soft once decided (final or unofficial — the drawing's unofficial state), a placeholder dim, the
  countdown / "No score yet" / stakes / "Not yet confirmed by the organizer" / "This game will not be played." as the
  foot strips, Share at the foot's right end on a phone (a Share-only foot hides at a desk, as Share does). The shared
  part gained three props for it: a side's `href` (a name as a link, only on a row that is not itself a link), a side's
  `own` (bold in every state), `footAction`; `noScore` takes a node (the countdown). **A team's page (A13, A14):** no
  back link in any state (loading / not found / couldn't load lost theirs; withheld had none); name 24 px title face;
  Live now / Up next / Next games are stacked cards in a kit `.list` (PublicParts `.gameList`), head line "{day} ·
  {time}" (today's games show the time alone — `gameDayWord` as shipped), context "{division} · {round or pool}", this
  team first and bold (`own`) **including while live** (judgement call, told the owner: the 10-30 ruling over R6's
  "nobody bold until final", which is about winner and loser), no pill (the heading says it), a live game's edge, its
  gold stakes line as shipped, upcoming games no foot (as shipped). Sections via `PublicSectionHead` (Results with its
  count) in PublicParts `.section`; Results keep their row. The record card's pad is the heading's 44 px **plus the
  section's 10 px gap** (judgement call: the drawing's sections have no gap, the shipped section has 10; told the owner).
  The standings link is a link row with "{name} is {1st of 3}" where there is a place. "No games scheduled yet" and the
  error states are the shared empty card unaltered (the page's centring wrapper deleted); Try again the outlined button
  in its actions. `teamProfileView` lost the one-line row it no longer draws (`row`; test re-aimed at `round`). The
  standalone live card is now the Schedule's and Playoffs' only. **News:** "Pinned Announcements" / "Recent
  Announcements" → `PublicSectionHead` "Pinned announcements" / "Recent announcements" (sentence case, icons gone —
  judgement call, told the owner); the old `.sectionLabel` / `.pinnedSection` rules deleted. **Register (C2):**
  `.formWrap` 680 → 640; the team pay page checked — it never used that column (its own 640 `.page`), unaffected;
  the PublicParts `.leftEdge` comment corrected (club forms never shared the sheet). **Checks:** typecheck clean; ESLint
  clean on the changed files; spelling, tokens, public type, CSS purity, contrast, dates, demos clean; CSS selectors
  flag other areas only; `public-*` + demo guard 816/819 (the 3 = the Stage 6 walk HTML, pre-existing); 8 test files
  re-aimed at the new markup (the layout guard's Register exception now 640 and the 620 state card's reason; the stage 2
  guard lists News as a frame-only user — it renders only under the frame). A render probe of the game page in every
  state (live, final, not started with a placeholder, cancelled, TBD) matched tab 3's last block. **Layout check** (the
  six Part 4 screens, dev server): `pubt-game-pale`, `pubt-team-own`, `pubt-pay-focused` clean; `pubt-news-pale` and
  `pubt-register-open` show the same 9 tap-floor findings a dump from before this part recorded (Register's inline
  "schedule" / "standings" links 15 px and the email input 41 px at 768; News's empty-state buttons 36 px at 768) —
  pre-existing, not this part's, reported; `pubt-game-live` did not render — its interaction needs a live playoff game on
  Fall Classic's Schedule (the aged fixture 2b and 3 reported for the Schedule's live screen). Found, not fixed: the
  Register success card's 32 px heading (the club's register sheet, out of bounds here); the Teams PREVIEW row's chevron
  (not touched this part).
- 2026-11-05 — Part 4 committed `efb77f848` (24 files, this build's only; the owner said "commit" at the start of Part 5 after the session found it missing).
- 2026-11-05 — **Build Part 5 (review, layout check, the walk, records).** **/simplify** (four angles: reuse, simplification,
  efficiency, altitude) applied the cleanups that change no visible thing: a team's page uses the shared column rules
  (`parts.colMain` / `parts.colSide`; the local `.main` / `.side` rules deleted), the search box's words come from one helper
  (`teamSearchWords`, Schedule and Teams), the dead `data-face` / `data-cancelled` attributes on the Schedule row went, a
  hoisted tone, four stale comments. Skipped on purpose (a visual or test-pinned change, or older than this build): moving
  the shared card's CSS out of the Schedule's sheet, drawing R11's outlined button once (the stage-2 guard pins `.hostBtn`'s
  own size), one helper for the "slot has no team yet" flag across six callers, the bracket's per-render views and the Teams
  rows' `find` (both older than this build). **/review** (standard tier; three finders: rulings and every state, blast radius
  and club CSS, help/demo words and test honesty): **no ruling reversed, no club page moved, the Part 4 additions stay on the
  game page and the team page, every demo anchor present.** Confirmed and fixed: one guard test checked nothing (`public-schedule-compact`'s
  "every desk rule is scoped to the wide row" sliced from a CSS comment that `readCode` strips, so it read an empty string;
  it now reads 27 rules and passes), plus three small guards (the team page's column parts, `teamSearchWords`, the Playoffs pill).
  **Owner rulings this session (2026-11-05):** a team's own name stays bold while live; the record card starts level with the
  first game card; News headings sentence case, no icons (all as recommended); **Playoffs' "Live now" game has no pill under
  its heading** (R9 "said once"; `PublicLiveCard` takes `pill`; the standard's R9 got a Built line). **Found, not fixed** (reported to the owner): News reads
  every division and announcement with the admin read (`app/[orgSlug]/[tournamentSlug]/news/page.tsx` passes `admin: true`),
  so a held-back division's name and its posts can show (older than this build; its own fix, `/plan`); the search box says "or
  coaches" when only a held-back team has a coach; a team whose every game is cancelled shows an empty body; help copy still
  describing the old look (the playoff-bracket FAQ, the game-page article, "Playoff Picture" in five places, "cards" on Teams;
  `/docs` owns it); the marketing shots `fan-live-score` / `playoff-bracket` point at Standings and wait for an anchor that
  only Playoffs has; the club-home comment and test name that still say the host card "says the club runs programs all year";
  the shared screen list (`pubt-playoffs-eight`'s selector, `pubt-schedule-playoffs` and `pubt-schedule-bracket-only` waiting
  on "The bracket"); Register's 32 px success heading; the Teams preview chevron; the nine tablet tap sizes on News and
  Register. **Gate:** typecheck and ESLint clean on every file touched; `public-*` tests 808/811 (the 3 = the Stage 6 walk HTML,
  pre-existing); `verify:changed`'s test step 14,242/14,249, the other four failures in coach, billing and admin-console tests
  that this build does not touch (not checked against HEAD); spelling, tokens, public type, contrast, dates, CSS purity,
  demos clean; the CSS-selector check flags other areas only. **Layout check** (step 2) on a local production build
  (dev env pre-loaded, port 3100, stopped afterwards): the first two runs **aborted** on the memory floor (two other sessions'
  typechecks were using about 9 GB), an abort being a failure, so it was re-run in chunks of four screens, each waiting for no
  typecheck and 3.5 GB free: **17 of 25 screens measured**, clean apart from the demo tour bar's four small buttons on the Overview
  (5 / 5 / 9 findings at 361 / 390 / 768) and the nine known tablet tap sizes on News (2) and Register (7); **8 did not render**
  (the four aged live screens, `pubt-schedule-playoffs`, `pubt-playoffs-eight`, and newly `pubt-playoffs-seeded` and
  `pubt-schedule-bracket-only`: the Stage 4 events are now live / finished / live, and the last waits on "The bracket"); the
  live game, live Playoffs card and the bracket were therefore not measured and the walk covers them by eye. The shared screen list was not changed.
  **Walk** `PUBLIC_PAGE_LAYOUT_STANDARD_WALK.html` (§460, 9 parts, 48 steps): https://claude.ai/artifact/3gurm6FoyyWmNmKBHVrCaT; fixtures set up
  (Fall Classic's live semifinal, the Stage 5 clones re-dated, the Stage 6 post on); a time-not-set helper in `.probe/` (scratch). The dev server was
  restarted (shared modules changed, the production build had written the cache) and answers on :3000 with no Supabase errors.
- 2026-11-05 — Part 5 committed `513ad05a4` (a partial commit: this build's 19 files; `TODO.md` and the ledger held other sessions' lines, so only this build's TODO line and the §460 block went in, built from HEAD).
- 2026-11-05 — **Club build Part 1 committed `8e24da300`** (`PUBLIC_CLUB_PAGE_LAYOUT_BUILD_PROMPT.md` Part 1; C2 + C5;
  a partial commit: this part's 33 files, its TODO line built from HEAD, the plan log). The wrapper gained the
  club frame: `PublicPage frame="club"` (PublicParts `.page.club`: the logo edge `max(24px, (100% − 1200px)/2 + 24px)` from
  901 px, the frame's own expression; 16 on a phone; 28 / 16 down; 40 / 32 at the foot; 960 at most) and `width="form"` (640);
  `.prose` 720 (and `kit.cardText` / the tryout blurb held to 720 of words); the club's two-column split `.club .cols` from
  1,024 px. Every club public page in the census renders in it, every branch: the home (banner above, sponsors last inside),
  Teams, a team's page, Tryouts (both branches), a tryout page (both addresses), the tryout sign-up (both addresses, 640),
  House league, a season (both shapes), the league sign-up, Email me my link and Your sign-up (640; its parts are now the
  page's own sections), Schedule, Standings, Tournaments, About and a past tournament's record. Each page's own column,
  centring, widths and gaps deleted; `league-column.module.css` header rewritten (the 08-01 left-edge rule stands, its
  per-page measures replaced by C2); its `.column` is kept for the one signed-in page that wears it (the coach's house-league
  team page, out of scope). **The no-games defect fixed:** `teamScheduleShows()` (lib/club-team-page.ts) decides the schedule
  part from what renders; the section asks the same; unit-tested. **Guard:** `public-page-layout-guard.test.ts` gained the
  club round (the frame's numbers, every club route a page or a reasoned exception, every branch `frame="club"`, forms
  `width="form"`, no club sheet with its own padding / width / centring / split, banner and sponsors placed). **Deferred by
  the prompt's own placement:** the in-club not-found (Part 4 step 3). **The admin's "How families see it" tryout preview**
  takes the same column (its 16 px foot is gone — the wrapper's). **Checks:** typecheck clean (8 GB heap; the default ran out
  of memory); the club guards and the full unit suite — 14,284 pass, 7 fail, none reading a file this part touched (coach
  practice plans, plan billing usage, the Stage 6 walk, series dates, support console: other sessions' work); token, type,
  purity, spelling, contrast and demos checks clean; the CSS-selector check flags other areas only; lint clean on this part's
  files. **Layout check** (dev server, the 14 club screens at the standard widths, then 1,024 / 1,280 / 1,536): one sweep
  aborted on the memory floor (another session's load) and was re-run; clean apart from one finding, **found, not caused**:
  the house-league season row's name link measures 21 px tall at phone widths on the home and the House league page
  (`LeagueSeasonRows`, untouched) — its `::after` stretches the link over the whole card, which the tap-floor probe cannot
  see; not baselined. A probe (`.probe/club-column-probe.mjs`) measured nine pages at 390 / 1,024 / 1,536: left 16 / 24 / 192,
  960 wide (640 the form), 16 / 28 / 28 down, 24 between — the drawing's numbers.
- **2026-11-05 · Club build Part 2 (titles, headings, lists, rows) — committed `1bb01b3ee`.** Owner yes on the product-owner summary
  ("go ahead"). **C3:** Teams, Tryouts (in season), House league and Tournaments have no visible title — each keeps an
  `h1` in `kit.srOnly`; Teams' count and Tryouts' season line sit under the Born in pill (kit `.toolLine`, 12 apart; none
  with two seasons, as before); Tournaments' "{n} tournaments" line is gone (each section's count pill says it); the House
  league page's club-name line and hairline header went with its title. The club-name line over the tryout form, the league
  form and both Your sign-up pages is gone (the tryout form's keeps "15U AAA"). **C4:** a new kit class `.pageName` (24 px,
  the club's title face and weight) on a team, a tryout, a season (both shapes), both forms, Your sign-up, About and
  off-season Tryouts. `.title` (32) was NOT changed in place: the coach's signed-in house-league team page imports it and is
  outside the club round, and the archive record, league Schedule and Standings keep 32 until Part 4 (C7) reaches them.
  **R4:** every club section heading is `PublicSectionHead` (it already read the `--club-*` tokens), which gained an
  `action` slot so the team page's Schedule keeps Subscribe on the right; kit `.sectionTitle` deleted, kit `.section` gap
  9.6 → 10 px (the tournament section's); the season page's Divisions (with its count) and Standings / Final standings are
  sections (the age-group cards' names became `h3`); House league and Tournaments sections carry their counts; the home's
  take none (the drawing). Your sign-up's pay heading is the heading row above its card — **the shipped word is "To pay
  now", not the drawing's "Pay online"** (shipped strings win); the sign-up form's centred confirmation keeps the heading
  in its card until Part 3's pay-block pass, which also owns the tournament pay page's copy. **R5:** `LeagueSeasonRows` is
  one framed list (rows on hairlines, whole-row door and links line kept; the name link is 44 px tall in its own right —
  the Part 1 tap-floor finding no longer shows); Your sign-up's children are one framed list (`<ul>` in `kit.list`), **every
  fact a child's card carried kept in its row** (division, team, coach, fee, reference, the waiting/moved/asked notes) —
  the drawing's one-line row would have hidden facts families see today, so the shipped page won (said in the owner
  summary). **R7:** About's documents are kit link rows with a new `kit.rowExternal` (the new-tab symbol where the chevron
  would be, bands kept; the bands are now Fragments, so the first band no longer draws a second hairline under the frame);
  a question is 16/600, its answer 16 held to 720 by `PublicParts .prose`. **Kept, a deviation from the drawing:** the
  replaced-link page keeps "Your sign-up" as its title and "This link no longer works" as its card's heading (the drawing
  makes the latter the title; the words are unchanged either way) — an owner call if he wants it promoted. **Out of scope,
  left:** the fallback home (`app/[orgSlug]/page.tsx`, clubs without the site plan, own `ClubHome.module.css` headings).
  **Guards:** `public-page-layout-guard` gained a "club round Part 2" block (C3 / C4 / R4 / R5 / R7); the Stage 2 guard's
  shared-parts allow-list names the club files that now draw the heading row, with the R4 reason;
  `house-league-public-seasons` pins the new headings. **Checks:** typecheck clean; focused lint clean (two old `<img>`
  warnings); the club/league/public unit groups 4,385 / 4,390 before the test fixes, then all green except the known
  other-session failures (practice plans, plan-billing-usage, stage-6 walk ×3, series-date-groups, support-console-stage3)
  plus a new one, also another session's (`possessive-guard` on `lib/child-page-words.ts`); `check:css-selectors` reports
  only other sessions' classes. **Layout check** (dev server, 14 club screens at 361 / 390 / 768 / 1,440, then eight at
  1,024 / 1,280 / 1,536): no new findings. The season page, both forms and Your sign-up are not in the screen list; each
  renders 200 with its 24 px name. No help or demo-tour anchor sits on these pages.
- **2026-11-05 · Club build Part 3 (the sweep, R10 / R11, and the pay block) — committed `70d65750f`.** Committed on the owner's word ("add the line and commit"); the desk check (Home → … → About: does anything but the content move?) was handed over, no result reported — carry it into Part 5's walk. Product-owner summary
  presented before the code. **The pay block (shared: Your sign-up, the house-league sign-up's confirmation and the
  tournament's team pay page — all three move, said in the summary; not forked):** every heading inside it (the states,
  the receipts, the owing block — "To pay now" in the form's centred card, the tournament's balance heading) is one
  section-heading rule, 16/700 in the text face, where it fell to the global 800-weight condensed title face; the clearing
  blue kept (registered exception). The receipt-email field takes the darker field edge (new `--pay-field`: the club's
  `--club-field`, which the tournament frame also defines) at 8 px; a receipt card is 8 px on its hairline; the pay
  buttons are 44 (was 48) at 8 px on both sites (`.payRow > .payButton`, so it outranks the tournament's global `.btn`
  at 6 without depending on sheet order), full width under 640. "Email me my link" goes full width at 640 too (was 480).
  **R11:** Subscribe at a desk IS the kit's small outlined button (`kit.btn btnSecondary btnSm`; its sheet keeps only the
  symbol's gap and colour, hover and focus; the phone's bare symbol now outranks the kit as `.wrap > .button`); its
  popover on the scale (doors 15/650 → 16/600 at 8 px, note 13 → 12, panel 12 → 8 px, the sheet's title 19 → 18 and its
  context 11 → 12; the panel's shadow and the phone sheet's 16 px top corners kept — a floating panel and a sheet, not page
  parts). Follow is the kit's small buttons (secondary; "Following" the primary) — its sheet's copy of them deleted, the
  look unchanged. "Sign up for tryouts" takes its own width at a desk and the full width on a phone (new kit
  `.btnPhoneFull`; `.btnFull` kept — the team page's tryout door sits in the narrow side column). **R10 strays:** the
  season page's early-bird price 16; the sign-up form's fit line 14 at 0 8 8 0; Your sign-up's Team value 600 and an
  owing Fee 700 (both were 650); its fallback "To pay" total 20 px in the club's title face and weight. **Tournaments:**
  both tables' cells in the text ink (the champion cell's own ink rule deleted with it). A sweep of the club sheets for
  other off-scale sizes, weights and corners found none left on a page part (the checkboxes' 4 px is a checkbox).
  **Guards:** `public-page-layout-guard` gained a "club round Part 3" block (the pay block, the buttons, the strays).
  **Checks:** typecheck clean except another session's untracked `lib/child-page.ts`; focused lint clean; the guards
  that read these files green (layout, phone secondary actions, club frame, Stage 1 / 2 frame, house-league sign-up,
  focused page, 4a / 4b-2a / 4b-2b / 4c-2b, share census, sign-up link); `check:css-selectors` reports only other
  sessions' classes. **Layout check** (dev server: club home, team, tryout, Tournaments ×2, About and the tournament's
  focused pay page at 361 / 390 / 768 / 1,440, then 1,024 / 1,280 / 1,536): no new findings. `pubt-pay-focused` loads a
  not-a-real-link address, so it measures the error state, not the pay block; no fixture has an owing pay link, so the
  pay block's look is pinned by the guard, not measured. A probe on `uat-rep-only` 15U AAA (the club fixture's teams have
  no schedule or open tryout): Subscribe at 1,536 is 44 tall, 8 px, 14/600, the field edge on white; at 390 the bare 44
  symbol; "Sign up for tryouts" 183 px wide at 1,536, the full width at 390.
- **2026-11-05 · Club build Part 4 (C6 the two-way link, C7 the house league's Schedule and Standings, the record, the
  not-found, the in-club error) — built 2026-11-05.** Owner yes on the product-owner summary, with three answers: the
  in-club error page **yes**; a past tournament's results onto the game row too (**yes**, beyond the prompt's "title and
  headings": its rows were held 520–560 px wide and scrolled sideways on a phone); the house league's games **away team
  first** (the standard's order; it read "Home vs Away"). Disagreement said out loud before building: C7 was ruled as "small
  (the phone edge and the top)"; converting the game rows came from the build prompt, not the ruling.
  - **C6:** `lib/team-two-pages.ts` (pure, `tests/unit/team-two-pages.test.ts`, 11 cases: registered + public → link; not
    public → none; another club's → none) and `lib/team-two-pages-server.ts` (the reads). Tournament → club: the team-profile
    route carries `clubTeam` ("{team} at {club}", line "The team’s page at the club" — no existing help phrase), a link row
    in the side column under the record (alone there with no record; under "No games scheduled yet" with no games), through
    `useOrgHref`. The club page is linked only when `publicClubRefusal(org, 'teams')` is null — the check the club team page
    makes. Club → tournament: a schedule entry mirrored from the club's own tournament (`source_tournament_game_id`) opens
    the team's tournament page — the title's link stretched over the row, so Up next's Directions stays its own button;
    only for a tournament running or finished and a registration accepted; through `orgLinks`. **"Our team" is the house's
    one rule** (`rep_team_tournament_registrations`, all three orgs equal): a coach's own workspace registration into the
    club's tournament, with no admin link, gets no link (the mirror reads both sources) — **for Part 5's `/review`**, with
    the new public reads (one per 30 s profile poll; up to three on a club team page with tournament games). **No fixture:
    dev has no registration link**, so the owner cannot see C6 on dev until one is made (Part 5's walk needs one).
  - **C7:** the Schedule's games are `ScheduleMatchup` (wide; time with the day under it, the place kept on every game —
    the house league's own C10 ruling, the standard's all-games list carries none — "Moved · Was …" as the line under
    the teams); each week and "Needs a new date" a heading row; one framed `parts.gameList` per section. The pill set
    gains **Postponed** and **Moved** (amber, `GameRowState`); a row with a field AND a pill keeps the teams on row one (a
    shared rule that also fixes a cancelled Playoffs game with a field). Standings: "Standings"/"Final standings" at 24 with
    the season 8 px under it (`kit.nameBlock`, new); the table unchanged (the table exception). The coach's signed-in league
    page keeps the old row classes and the 32 px `.title` — the guard pins it as `.title`'s only user.
  - **The record:** name at 24 (season over, "Results final" under), each standings and results section a heading row
    ("Pool play standings · U11" with several divisions, the tournament's own Final standings precedent), the results on
    `ScheduleMatchup` (Final, away first, the winner bold). The fixture's archive has no games in its snapshot, so the rows
    were not seen. **The in-club not-found:** on the club column (was a centred 34 rem box), name at 24, the kit's buttons
    (full width on a phone). **The in-club error (`app/[orgSlug]/error.tsx`, new):** the club's face only where
    `wearsClubFrame` holds; every other page under the org renders the platform's `app/error.tsx` unchanged — but note the
    boundary now sits inside the org layout for the admin and coach pages too (same screen, one level lower).
  - **Guards:** a "club round Part 4" block in `public-page-layout-guard.test.ts`; the shared-parts list in
    `public-tournament-stage2-guard.test.ts` gains the Schedule and the record; `league-standings.test.ts`'s title pin moved
    to `kit.pageName`. Checks: typecheck clean; the guards 225/225; `npm test` 14,344 / 14,354 — the ten failures are the
    known other-session ones plus two timing failures that pass alone (`online-payments-pay`); lint clean on the touched
    files (one old warning); spelling clean. Dev server restarted (new files). A probe at 390 / 1,536: Schedule, Standings,
    the record and the not-found each name themselves at 24 on the logo edge (16 / 192), no sideways scroll; the Schedule
    reads as the tournament's row (screenshots looked at).
