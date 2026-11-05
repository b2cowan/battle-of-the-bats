# Public page layout standard — build prompt (six sessions)

> Written 2026-11-04, the day the owner ruled every ask on the drawings: **A1–A9** ("I agree with your recommendations"),
> **A10** (left to the assessment, resolved on the recommendation), **A11–A14** ("I agree with your recommendations, go
> ahead and make the build prompt"). Plan: `PUBLIC_PAGE_LAYOUT_STANDARD_PLAN.md` (§2 the eleven rules, §3 every ask and
> its reason, §5 notes, §6 log). Brief: `PUBLIC_PAGE_LAYOUT_STANDARD_PM_BRIEF.md`. Design log: in-repo
> `memory/design_decisions.md`, entry 2026-11-04 "PUBLIC TOURNAMENT PAGES: ONE LAYOUT STANDARD".
> **The drawings are the approved mockup, and they are the spec:** https://claude.ai/artifact/NC6Y7ijjYtd3Kr4cGPgbep
> (source `PUBLIC_PAGE_LAYOUT_STANDARD_DRAWINGS.html`, same folder, v4). Tab 2 holds R1–R11 word for word, tab 3 every
> game-row state and every state of a game's page, tab 4 every page today vs proposed (with a per-page change list tagged
> RESTYLED / NEW / UNCHANGED). The product frames are rendered by the file's inline script: read `BODY.next.<page>` and
> the `.tf` CSS for exact values. Never re-derive a value the drawing already states.
> You are the build agent (Claude Code or Codex). Read `AGENTS.md` and `AGENCY_RULES.md` first: this repo's Next.js is not
> the one you know; one shared branch `dev`; stage explicit paths only; **commit only when the owner says**.

## What this is (one paragraph, so every part shares it)

Every public tournament page gets the same frame and the same parts, so a visitor clicking from page to page sees the
content start, stop and space itself the same way, and a game, a list, a link, a heading and "live" look the same
everywhere. **The frame:** one content column at most **960 px**, left-aligned **32 px** right of the menu, starting
**28 px** under the band (or the today's-games line), **24 px** between sections; the Overview, a game's page and a team's
page split the 960 into about 540 + 392 and stack below a **1,200 px** window. **The parts:** one game in two forms (stacked
in a narrow column and on every phone = the phone recipe ruled 2026-10-29; one line on a wide desk list = the desktop
Schedule row kept 2026-10-29, on ONE 104 · rest · 104 grid for every state, live included); one **link row** (the club
kit's list row); three heading levels (division 18, section 16, pool band 12); one toolbar order and widths; live = green
everywhere; 8 px corners; text 12 · 14 · 16 · 18 · 20 · 24 (+28 on a game's page); a filled button only for a page's main
job. Then the page-by-page changes in plan §3. **Nothing here changes what data a page shows or who can see it**; it
changes layout, recipes, a few words (named below) and the two back links.

## Where this sits (dependency, not timing)

Public tournament pages **Stage 8** (the new look on for everyone, the preview switch deleted) is committed on `dev` and
waits for its promote (`/release`, 6b). There is **no preview switch any more**: every change here lands on the live
public pages on `dev` and ships with whatever release next takes `dev`. **Tell the owner before Part 1's commit** that the
Stage 8 promote can either take Stage 8 alone (released at its own commit) or take this work with it; it is his call
and the `/release` session's, not this prompt's. Do not hold or reorder anything on that account.

## How this runs: six sessions, a `/clear` between them

| Part | Covers | Ends with |
|---|---|---|
| **1** | The written standard + exceptions (A9); the one page wrapper on every public tournament page (R1–R3); the 1,200 px stack; the guard that keeps every page on the wrapper | Committed; every page's edges, top and gaps match |
| **2a** | The game row: the stacked form's shared part, the one-line grid fix (A2), names/bold/soft rules, the pills (Final neutral), live green incl. the today's-games line (A4) | Committed |
| **2b** | The link row (R7) replacing the door and disclosure looks; the three heading levels + pool band (R4); the toolbar (R8); the corner/border/type sweep (R10); "The playoff bracket" everywhere (A5) | Committed |
| **3** | Page passes: Overview (A3, A6, A7, A10), Schedule, Standings, Playoffs, Teams + Rules (A8) | Committed; owner check on a desk (not the walk) |
| **4** | A game's page (A11, A12), a team's page (A13, A14), News + Register onto the column | Committed |
| **5** | `/simplify`, `/review`, layout check, the walk, the records, `/docs` + `/demos` | Committed, walk published |

At the end of each part tell the owner in one line that it is a good place to `/clear`, and where the next part starts.

**Token discipline (owner, standing).** Nearly all of a session's cost is re-reading its own history.
- Read this prompt and plan §2–§3. Read the drawing file **only by slicing it** (a short node script that prints the
  `BODY.next.<page>` function, a `CH.<page>` list or a CSS block you need); it is ~70 KB.
- Delegate wide searches ("every file that renders a door row") to a helper; a helper's summary is a lead, so open the
  cited lines before relying on them. The census below was taken 2026-11-04 by helpers and spot-checked; lines move.
- `npm run verify:changed` for routine checks; `npm run typecheck` once per part (shared parts are touched); `check:layout
  --changed` only on the screens a part touched. **No whole-product sweep on the dev server** (AGENTS.md): Part 5's sweep
  runs against a local production build or staging via `UAT_BASE_URL`. New or deleted files mean a dev-server restart
  (stop it, clear `.next`, `npm run dev` with network access) before handing the owner a check.

**Every part:** work on `dev`; stage explicit paths only (other sessions share this working copy and the tree holds their
uncommitted files: never stage them); present the product-owner summary **before** writing code (AGENCY_RULES: what the
visitor sees, plain language); write to the owner as to a product owner. For a partial commit out of a file another
session has also edited, build the blob from HEAD plus your own lines and diff it against HEAD before committing. **The
owner does the browser testing**; you verify with tests, the type check and the layout check.

### Rulings this build stands on (do not re-open them; cite them)
- **A1–A14 and A10 as resolved** (plan §3). The ones most likely to be "corrected" by accident:
  - **A2:** wide desk lists KEEP the one-line row. Do not stack the Schedule. The fix is the live game's grid only.
  - **A11:** on a phone a game's page keeps the Stage 3 order (**when and where first**, Directions near the top —
    `PUBLIC_TOURNAMENT_STAGE3_BUILD_PROMPT.md:44-46`). Only the desk puts the score card left and when-and-where right.
    Build it with one DOM order (when-and-where first) and place the columns with CSS.
  - **A13:** a team's Results keep their own team-view row (ruled 2026-10-30) — a registered exception, not a game row.
  - **A14:** "‹ Schedule" and "‹ All Teams" go (the club pages' 2026-10-20 rule: a back link stays only when it goes
    somewhere the tab row does not). The browser's Back is the way back.
  - **A10:** the host card renders only when the club has something open now; with nothing open, no card.
- **2026-10-29:** no location on the all-games list (Schedule, Playoffs); the Overview's Live now + Up next keep the field,
  Live now keeps Directions; a game's page keeps its prominent location and Directions.
- **2026-10-30:** division headings 18 px; a team's page puts that team first and bold; "No more games"; the record keeps
  its pool-play figures **with no new label** (so the record card gets no heading — the drawing pads the column instead).
- **2026-10-28:** the today's-games line says Live / Final / start time (A4 changes only its colour, red → green).
  Following and alerts are installed-app only; nothing here adds a browser control for either.
- **2026-10-27 Ask 17:** which pages carry the today's-games line is unchanged (`lib/public-ticker-pages.ts`).
- **Table standard:** tables keep their darker frame and shipped 52 px rows (R10 exempts them); figures tabular; K-11.
- **One spelling; the clock is "8:00 a.m."** Times only through `formatTime()`; grep before writing a word with a variant.

## What the code does today (helper census 2026-11-04; re-check before you rely on a line)

**Frame:** `components/public/TournamentFrame.module.css:98-111` — desk grid `248px minmax(0,1fr)` (rail + main); the band
and footer reuse `ClubFrame.module.css` parts; tokens = the club `.tokens` block. The today's-games line is the first child
of `.main` (`app/[orgSlug]/[tournamentSlug]/layout.tsx` ~:350), 44 + 2 px, on the pages listed in `lib/public-ticker-pages.ts`.

**Page containers (desk ≥1,024):**
| Page | Container | Padding | Width cap |
|---|---|---|---|
| Overview | `PublicParts.module.css` `.overview` ~:227; columns `.cols` :215-234 (1.35:1, gap 28, from 1,024) | 28/32 | none |
| Schedule | `PublicSchedule.module.css` `.schedule` :2 (no desk override) | 16 | `.schedule > *` 860 (:83) |
| Standings | `PublicStandings.module.css` `.standings` ~:56 | 24 | children 720, select 360 |
| Playoffs | `PublicPlayoffs.module.css` `.playoffs` ~:44 | 28/32 | none; select 360 |
| Teams | `PublicTeams.module.css` `.teams` ~:56 | 28/32 | filters 640, groups 860 |
| Rules | `PublicRules.module.css` `.rules` ~:34 | 28/32 | 860 |
| Champions | `PublicChampionsPage` `.page` ~:12 | 28/32 | `.content` 860 |
| Game page | `PublicGameDetails.module.css` `.page` :2 (no desk override; top 0) | 0/16/16 | none; `.columns` 1.45:1 gap 24 |
| Team page | `PublicTeamPage.module.css` `.page` :1, desk :41 | 28/32 | none; `.columns` 1.35:1 gap 28; `.sideBelowHeading` :44 |
| News, Register | old globals `.page-content > .section > .container` (`app/globals.css` ~:1653) | 24 | 1,200 centred |

**Game recipes (eight):** Overview live card `PublicLiveCard`/`.live` (`PublicParts.module.css` ~:114); Overview rows
`.rows/.row` (~:46-111, a 72 px time column); Schedule row `.matchLink` (`PublicSchedule.module.css` :97, grid 104 / 1fr / 104)
and its **live override** `.matchLink[data-state='live']` (~:126, `minmax(0,1fr) minmax(0,2.2fr) minmax(0,1fr)` — the cause
of the long-name wrap, A2); `.liveCard` (:66, `border-left` 3px); Playoffs `.gameCard`; bracket `.match`
(`PublicBracket.module.css` ~:12, radius 6, field border, 14 px score); team results `.result` (`PublicTeamPage.module.css`);
game page `.scoreCard`. Shared logic: `components/public/PublicGameRow.tsx` (`ScheduleMatchup`), `lib/public-game-row.ts`
(bold only for a final winner, :101-109), `lib/public-game-detail.ts`, `lib/public-team-profile.ts` (:95-110, day leads time).

**Links/doors:** `PublicDoorRow` (`PublicParts.module.css` :158-190, 56 tall, `›` dim); `PublicDisclosure` (52 tall, opens a
640 modal radius 12) for Rules rows, "How seeding works", "How the table is ranked"; Teams rows 72 tall. Club kit `.row`
(`ClubKit.module.css` :207-253: 60 tall, padding 12/40/12/16, drawn chevron, 16/600 name, 12 px dim sub) and `.listBand`
(:196-205). Bracket door label: `lib/public-schedule.ts:12`, `PublicStandings.tsx` ~:192, Overview `TournamentOverview.tsx:131`
("Playoff picture").

**Live looks (nine):** band dot `TournamentFrame.module.css` ~:231; today's-games line red `TodaysResultsLine.module.css`
:52-59; Schedule pill + edge; Playoffs `.liveWord`; bracket edge; Teams summary text; team page h3; game page `chipOk`
(`lib/public-game-detail.ts` ~:73 — **Final also renders green there**; R9 makes Final the neutral pill).

**Host card:** `lib/public-host-card.ts` `hostCardView` returns a card whenever `openNow` is an array, so `[]` (nothing open)
renders the fallback "runs teams and programs all year". A10 makes `[]` return null. Card + button: `PublicHostCard.tsx`
("Visit the club" :57), `.host` :447, `.hostBtn` :521 (filled, club colour).

**Off-scale today:** game time 32 px; team name 22 px; host name 22; ticker 13; Teams h2 18 (ruled: keep 18 as the division
heading); radii 6 (selects/search on Standings, Playoffs, Teams; team page icon + Retry buttons), 9 (switch track — keep, it
is 3 + 6 nested), 10 (logos — keep), 12 (the disclosure modal).

## Part 1 · The standard, the page wrapper, the guard

1. **Write `docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md`** (a living reference: never archived). R1–R11 exactly as the
   drawing's tab 2 states them, each with its "Keeps" line (the earlier ruling it stands on), then an **Exceptions** section:
   the game row's three lines and no chevron (R5); a team's Results row (A13 / 10-30); the team name 24 px title face (R4);
   the switch track's 9 px corner; tables' darker frame and 52 px rows; frame chrome sizes (band, menu, today's-games line);
   a 3+ round bracket scrolling in its box (R1); the game page's 28 px time and score (R10). Close with "how to check a new
   page" (five lines). Link it from `TABLE_AND_LIST_STANDARD.md`'s head and from plan §2. In
   `TABLE_EXCEPTION_REGISTER.md`: reconcile **K-16** (says 16 px public cell padding; Standings ships 8/6) and **K-28**
   (says the tournament Schedule fills the screen; it now stops at 960) — update their text to the shipped/now-ruled fact.
2. **One page wrapper** for every public tournament page body (all ten in the census table): padding 28/32 desk, 16 phone;
   content max 960 left-aligned; first child at the top padding; 24 px between direct sections (phone 24 too, R3 says same).
   Prefer one shared class in `PublicParts.module.css` (or a tiny wrapper component) that each page's root uses, and delete
   each page's own padding / cap / gap rules — do not stack a second padding on top. Single-list pages lose their 720/860
   child caps (the 960 replaces them); the Schedule's day chips keep their own 560 cap (shipped, unchanged).
3. **The two-column pages** (Overview, game page, team page) share one column rule: `minmax(0,1.35fr) minmax(0,1fr)`, gap
   28, **from a 1,200 px window** (today 1,024; between 1,024 and 1,199 they stack: main then side). The game page moves off
   its own 1.45:1 / 24.
4. **News and Register** leave the old centred `.container` for the wrapper (their own markup only; the globals stay for
   whatever else still uses them — grep before deleting a global).
5. **The guard:** a unit test that every public tournament page body renders inside the wrapper and that no public CSS
   module sets its own desk page padding or a page-level `max-width` other than the wrapper's (a list of allowed
   exceptions in the test, each with its reason). Model it on the existing public guard tests (grep `tests/unit` for
   `public-` guards; the Stage 1 frame guard is the closest shape).
6. Checks: `verify:changed`, `typecheck`, `check:layout --changed` on the ten pages at 360 / 1,024 / 1,280 / 1,536.
   **Owner summary, then commit on his word.** Records: plan header + §6 log line, TODO line (one line).

## Part 2a · The game row and "live"

1. **The stacked form as one shared part** (extend `PublicGameRow` / `ScheduleMatchup` rather than adding a ninth recipe):
   head line = time (+ day when not today) and context (division · round) left, status pill right; then each team on its
   own line owning its score (20 px title face; compact 14/16 for the bracket; large 28 for a game's page); names full ink,
   **winner bold and loser soft only once final** (unchanged logic in `lib/public-game-row.ts`); placeholder teams dim;
   optional lines under the teams: "No score yet", the countdown ("Starts in …"), the stakes line (gold for the title,
   as shipped), and on the Overview only the place strip with Directions. Phone Schedule rows already are this recipe: do
   not change them (drawing tab 3, "Phone, 360 px · unchanged").
2. **The one-line form:** delete the live override's `1fr 2.2fr 1fr` grid so a live game uses the same 104 · rest · 104
   grid (pill top right, division under it, "No score yet" in the middle cell as today). Prove it with a test or the layout
   check: "Milton Bats U11 Purple (Jackson)" on one line at a 960 px column.
3. **Pills (R9):** Live now (green, the edge), Final (neutral), Unofficial (amber), Cancelled (danger text, row dimmed) —
   the Schedule's pill set, used everywhere including a game's page (its Final stops being green). Said once: a row under a
   "Live now" heading shows the edge but no pill. Inside a sentence (a Teams row's line) "Live now" stays green text.
4. **The today's-games line:** "Live" and its dot go green (`--club-ok`), words unchanged.
5. **The 3 px edge** is one shape: inset on a row inside a list; `border-left` + radius `0 8 8 0` on a standalone card.
6. Checks as Part 1, plus the contrast checks (`check:contrast`, `check:text-contrast` run in `verify:changed`). Commit on
   the owner's word; records.

## Part 2b · Link row, headings, toolbar, the sweep, one name

1. **The link row (R7):** `PublicDoorRow` and `PublicDisclosure`'s row take the club kit `.row` look (60 tall, 16/600 title,
   optional 12 px dim line, drawn chevron). Keep each component's behaviour (a link vs. opening its window) — only the look
   is shared. Rows of the same kind sit in one framed list (R5); a lone link row is its own framed list of one.
2. **Headings (R4):** section headings everywhere through `PublicSectionHead` (16/700, count pill, right link); division
   headings 18 px (Teams "U11"); pool groups inside a list = the club kit `.listBand`; a pool with its own table (Standings)
   = a section heading reading just "A Pool".
3. **Toolbar (R8):** Division 200 · Pool 160 · view switch · Search (fills, max 320) · calendar; 44 tall, radius 8, field
   border; a page shows only the controls it has; phone layout unchanged. Placeholders: "Search teams", or "Search teams or
   coaches" where coaches are searchable — grep both pages' current words and the help content first.
4. **Sweep (R10)** across `components/public/*.module.css` used by tournament pages: radius 6 → 8 (selects, search, the team
   page's icon and Retry buttons; the disclosure modal 12 → 8); box borders `--club-line-2` → `--club-line` **except
   tables**; 13 / 15 / 22 / 32 px text onto the scale (ticker text 13 stays: frame chrome; host name 22 → 20; game time 32 →
   28 in Part 4). Do not touch the club pages' CSS (the club round decides it) — if a rule is shared with club pages, scope
   the change to the tournament pages and say so.
5. **One name (A5):** "Playoff picture" → **"The playoff bracket"**, line "See who plays who", everywhere it links the
   bracket (Overview, Schedule, Standings). Grep `lib/help-content`, the demo tour copy and tests for the old words.
6. **The band at 72 (club round C1, ruled 2026-11-05).** The tournament's desk band (≥1,024) drops from 88 to the club's
   ruled **72 px** + its 3 px rule (`TournamentFrame.module.css` ~:113-116, `--club-band-h: 88px` → remove the override so
   the shared 72 applies). It is a minimum: a two-line name plus the dates line grows the band rather than clipping —
   check "Greater Hamilton-Wentworth Girls Fastpitch Spring Invitational" (`scripts/seed-public-frame-fixtures.mjs:65`)
   at 1,024 and 1,280, the doors staying on the band. Update any test or sticky offset that reads 88 (grep `88px` and
   `--club-band-h` under `components/public` and `tests/unit`). Plan §5b; the standard's R10 says it.
7. Checks; commit on the owner's word; records.

## Part 3 · The page passes

Build each page to `BODY.next.<page>` and its `CH.<page>` list in the drawing.
- **Overview:** Live now / Up next / Latest results on the stacked form (A3); Live now keeps the place strip + Directions,
  edge, no pill; the bracket link row moves to the side column under Latest results (A6); the host card renders only when
  something is open (A10, `hostCardView` returns null for `[]` — update `tests/unit/public-host-card.test.ts`) and its button
  is the outlined one (A7). Keep `data-sandbox-tour="latest-results"` on Latest results (the demo build fails without it).
- **Schedule:** the wrapper and toolbar only; rows stay one line (A2). Bracket link row at the foot, unchanged place.
- **Standings:** division select 200; "A Pool" headings; tables unchanged except width; "How the table is ranked" and the
  bracket link as one list of link rows.
- **Playoffs:** Live now on the fixed one-line grid; "How seeding works" link row; the bracket's matches on the compact
  stacked form, 8 px corners, light edge.
- **Teams:** division heading 18 + count pill; one list per division with pool bands; rows = link rows, two lines: the name,
  then "{coach} · {record} · {place} · {next}" (A8) — the coach still only where the club's coach-names rule allows.
- **Rules:** one framed list of link rows with their icons (A8); each still opens its window.
- Checks at 360 / 390 / 1,024 / 1,280 / 1,536; **owner check on a desk** (a one-line ask: click through the six pages, does
  anything move?), then commit on his word; records.

## Part 4 · A game's page, a team's page, News and Register

- **A game's page (A11, A12):** no back link (A14). One DOM order: the when-and-where card first (time 28 px title face as
  the page's `h1`, "date · field", the venue address, Directions on the title line right, "Game length {n} min" folded in;
  Cancelled pill in Directions' place when cancelled; "Time TBD" / "Date TBD" / "Location TBD" with no address or Directions
  as shipped), then the score card (the stacked form, large: "{round} · {division}" + pill, team names still links to their
  pages, 28 px scores, the foot line as shipped — countdown, "No score yet", stakes, "Not yet confirmed by the organizer",
  "This game will not be played."; Share stays in the foot on a phone, hidden at a desk as today). On a desk (≥1,200) the
  score card sits in the main column and when-and-where in the side column; below that they stack in DOM order. The facts
  list goes (division and round are in the score card's top line). Draw-check every state against tab 3's last block.
- **A team's page (A13, A14):** no back link — **including the schedule-withheld state**, which today has none anyway; make
  all states consistent. Name 24 px title face (the registered exception), chip and subtitle unchanged; Live now / Up next /
  Next games on the stacked form with this team first and bold and the day leading the time ("Thu, Nov 5 · 6:00 p.m.") on
  the head line, context "{division} · {round or pool}"; section headings via `PublicSectionHead` (Results gets its count);
  Results keep their row on the light hairline; the record card with no heading, aligned to the first card by padding the
  side column by one section-heading height (44 px) instead of today's 1rem×1.3+8 calc; the standings link as a link row;
  the champion banner, "No more games", "No games scheduled yet", loading / not found / couldn't load restyled to the
  standard (8 px corners, the outlined button). Following and calendar stay app-only.
- **News and Register:** confirm Part 1 put them on the wrapper; their headings onto R4. **The Register form's column
  goes 680 → 640** (club round C2, ruled 2026-11-05: one form width on both sites; `app/[orgSlug]/register/register.module.css:2`,
  which the team pay page also imports — check it there too) and correct the comment at `PublicParts.module.css` ~:212
  ("which club forms share": they don't; club forms are their own 640 sheets).
- Checks; restart the dev server if files were added or deleted; commit on the owner's word; records.

## Part 5 · Review, layout check, the walk, the records

1. `/simplify` then `/review` (Claude Code) on the whole range of this build's commits; apply what holds; if you are Codex,
   do the adversarial read by hand across the lenses below and tell the owner to run the two commands.
   - **Rulings reversed by accident:** the Schedule stacked (A2); a phone game page with the score first (A11); a field on
     the all-games list; a heading on the record card; a back link back; the host card with nothing open.
   - **Every state:** each game state on each surface (tab 3); a held-back division still appearing nowhere (Stage 0 D1);
     long names at 397 px; 1,024–1,199 px stacking.
   - **Shared CSS reaching club pages** (`ClubKit`, `ClubFrame`): nothing on a club page may move in this build.
   - **Demo + help:** tour anchors present; help articles' words and screenshots ("Playoff picture", "‹ Schedule").
2. **Layout check:** the ten pages via `check:layout` against a local production build or staging (`UAT_BASE_URL`), never a
   whole-product sweep on the dev server.
3. **The walk:** one purpose — *"clicking through every public tournament page on a desk, the content starts, stops and
   spaces itself the same way, and a game, a list, a link, a heading and 'live' look the same on every page; a phone keeps
   its ruled layouts."* A checkable Artifact in the house style (parts, a fixture step, stop checks, a verdict control the
   owner must set on every part, Copy summary, Reset). **Grep `OWNER_QA_LEDGER.md` for the next free §** (§457 was the last
   seen on 11-04; other sessions add §s). Fixtures: `scripts/seed-public-stage3-fixtures.mjs` (`prepare` re-anchors the
   game times; note it can put the final past midnight — the "12:00 a.m." the owner saw) and the Stage 2 fixtures (Cedar
   Valley before, Pinecrest crowned) for the host card with and without open items.
4. **Records:** plan header + §6 log, `TODO.md` line, the ledger §, the design log only if the owner rules something new,
   memory status. Offer `/docs` (the help shows these pages) and `/demos` (the shop window shows them) — run them if the
   owner says yes.
5. Tell the owner the tournament side is done and a good place to `/clear`. **Next is the club build**
   (`PUBLIC_CLUB_PAGE_LAYOUT_BUILD_PROMPT.md`; the club round was drawn and ruled C1–C7 on 2026-11-05, plan §5b). Its
   Part 1 may start once this build's Parts 1, 2a and 2b are committed.

## Not in this build (say so if a step drifts toward one)
The club's public pages (their own build: `PUBLIC_CLUB_PAGE_LAYOUT_BUILD_PROMPT.md`, which also builds C6, the link
between a team's club page and its tournament team page — do not build it here). The tournament's menu moving into the
band (answered in the club round: it stays). Any band change beyond Part 2b step 6 (C1). Any change
to what a page shows (data, privacy, who sees a coach name), to standings maths, or to which pages carry the today's-games
line. The admin's own screens. The installed app's own pages (Discover, Scores, Following, Account). Following and alerts
in a browser.
