# Public page layout standard

**Status: RULED by the owner 2026-11-04.** A1–A9 ("I agree with your recommendations"), A10 (resolved on the
recommendation), A11–A14 ("I agree with your recommendations, go ahead and make the build prompt"). **The club round
C1–C7 RULED as recommended 2026-11-05** ("i agree with your recommendations, go ahead and write the build prompt"): the
club's public pages follow this standard with the amendments marked *Club round* below (drawings
https://claude.ai/artifact/96Jaq1JZNr8EgGaV3dxmLt; build `docs/projects/active/PUBLIC_CLUB_PAGE_LAYOUT_BUILD_PROMPT.md`). A living reference:
it evolves in place and is never archived. Part 1 of the build (the page wrapper, the 1,200 px stack, the guard) landed
2026-11-05; the recipes (R4–R11) land in Parts 2a–4 of
`docs/projects/active/PUBLIC_PAGE_LAYOUT_STANDARD_BUILD_PROMPT.md`.

- **The drawings are the spec:** https://claude.ai/artifact/NC6Y7ijjYtd3Kr4cGPgbep (source
  `docs/projects/active/PUBLIC_PAGE_LAYOUT_STANDARD_DRAWINGS.html`; tab 2 holds these rules, tab 3 every game state,
  tab 4 every page today vs. proposed).
- **Plan and every ask's reason:** `docs/projects/active/PUBLIC_PAGE_LAYOUT_STANDARD_PLAN.md` §2–§3. Design log: in-repo
  `memory/design_decisions.md`, 2026-11-04 "PUBLIC TOURNAMENT PAGES: ONE LAYOUT STANDARD".
- **Scope today:** the public tournament pages (Overview, Schedule, Standings, Playoffs, Teams, Rules, Champions, a
  game's page, a team's page, News, Register) and, from the club round (ruled 2026-11-05), the club's public pages: the
  home, Teams, a team's page, Tryouts, a tryout page and its sign-up, House league, a season page, its sign-up, Your
  sign-up, Tournaments, a past tournament's record, About and the in-club not-found page. Tables also follow `TABLE_AND_LIST_STANDARD.md`; their departures live in `TABLE_EXCEPTION_REGISTER.md`.
- **Build-enforced:** `tests/unit/public-page-layout-guard.test.ts` (every page renders in `PublicPage`; no page sheet
  sets its own page padding, page-level width cap or two-column grid).

> **The governing rule** (the table standard's, borrowed): a page may depart from this standard on a *named* axis, for a
> *stated* reason, recorded under **Exceptions** below. Everything it did not claim an exception on follows the
> standard exactly. A difference between two pages is either an exception here or it is a bug.

---

## The eleven rules

Word for word from the drawing's tab 2. "Keeps" names the earlier ruling a rule stands on; where the drawing names
none, the rule is new with this standard and the line says which ask ruled it.

### R1 · One page width
Every page’s content is one column, **960 px** wide at most, left-aligned to its frame’s own edge: on a tournament,
**32 px** right of the menu. A two-column page (the Overview, a game’s page, a team’s page) splits the 960 into about
540 + 392 and stacks into one column below a **1,200 px** window.
Phone: full width, 16 px sides. Exception: a bracket with three or more rounds scrolls sideways inside its own box.
**Forms** (a sign-up, a register form, a pay page) are **640 px** on both sites. Prose inside a box holds to **720 px**.
*Club round (C2, 2026-11-05):* a club page’s content is the same one **960 px** column, starting on the club’s logo edge
(the left edge of the frame’s centred 1,200 px column), never centred. The club home and a team’s page split it like the
tournament’s two-column pages (about 540 + 392, 28 between) from a 1,024 px window, where the 960 fits; below that they
stack. This replaces the per-page reading widths (744, 760, 1,152, 560) the 2026-08-01 repair ruling allowed.
*Keeps:* nothing earlier — new with this standard (A1, 2026-11-04); the 2026-08-01 repair ruling’s "a heading lands
directly under the club’s logo" (`TOP_NAV_REPAIR_PLAN.md` R6) for club pages.
*Built:* `components/public/PublicPage.tsx` → `PublicParts.module.css` `.page`; the two columns are `.cols`.

### R2 · One page top
Content starts **28 px** below the band, or below the today’s-games line where a page carries it. A page opens with its
toolbar if it has one, otherwise its first heading. No page title: the menu already names the page. No back link where
the menu (or the phone’s tab row) already goes: a game’s page and a team’s page open with their content.
Phone: 16 px; the white tab row names the page.
*Club round (C3, C4, 2026-11-05):* on a club page the lit tab in the band (or the phone’s tab row) names the page, so
Teams, Tryouts, House league and Tournaments carry no title; the line that sat under the title (Teams’ count, Tryouts’
season) stays, under the toolbar. A page about **one thing** — a team, a tryout, a season, a form, About, and Tryouts out
of season when its tab is gone — keeps its name as the page’s heading, **24 px** in the title face, on both sites.
*Keeps:* "a back link stays only when it goes somewhere the tab row does not" (club pages, 10-20), now on both sites
(A14).

### R3 · One rhythm
**24 px** between sections everywhere. **12 px** between toolbar rows. A heading sits directly on what it heads. Rows
inside a list have no gap; a hairline separates them.
Same on a phone.
*Keeps:* nothing earlier — new with this standard (A1–A9, 2026-11-04).
*Built:* the wrapper's 24 px gap; a page's toolbar rows are one section through `PublicParts.module.css` `.tools` (12 px).

### R4 · Three heading levels, no others
A **division heading** (18 px). A **section heading** (16 px bold, an optional count pill, an optional link on the right
such as "Full schedule"). A **pool band** inside a list (12 px uppercase on the ground colour, the club kit’s band row).
A pool with its own table takes a section heading. Registered exception: a page’s own name — a team’s on its page, and
on a club page a tryout’s, a season’s, a form’s and About’s — is **24 px** in the title face (A13; C4).
Same on a phone.
*Keeps:* division headings 18 px (ruled 10-30).
*Built (Part 2b, 2026-11-05):* every section heading is `PublicSectionHead`; `division` makes it the 18 px division
heading. A pool band is the club kit's `.listBand` inside the kit's `.list` (Teams). Standings' pools read "A Pool".
*Built (Part 4, 2026-11-05):* a team's page (Live now / Up next / Next games / Results, with its count) and News
("Pinned announcements", "Recent announcements" — sentence case like every other) head their sections with
`PublicSectionHead`; the team's own name is 24 px in the title face (the registered exception).

### R5 · Same kind, one list
Rows of the same kind are **one framed list** with hairlines between them. Separate boxes only for different kinds of
thing (a live game, a link row on its own, the host card). A list row is two lines at most.
Registered exception: a game row is a head line plus two teams, and it opens its game with no chevron (the whole row is
the link, as shipped).
*Keeps:* nothing earlier — new with this standard (A8, 2026-11-04).
*Built (Part 3, 2026-11-05):* Rules' rules and Standings' "How the table is ranked" + the bracket link are each ONE
`PublicLinkList`; a `PublicDisclosure` joins one as an item (`joined`) beside `PublicDoorRow`s. Teams is one list per
division of link rows, its pools band rows. The Overview's three game lists are framed lists of stacked rows.

### R6 · One game, two forms
Read in one order, **when · who · status**. **Stacked** in any column under 600 px: time and context top left, status
pill top right, then each team on its own line owning its score. **One line** in a wide list on a desk: time and round |
away score – score home | status and division, on one 104 · rest · 104 grid for every state, live included. Names in full
ink; the winner bold and the loser soft only once a game is final. A bracket uses the stacked form, compact.
Phone: always stacked. The all-games list carries no field; the Overview’s Live now and Up next keep the field, and Live
now keeps Directions. A team’s page puts that team first, in bold, and its Results keep their own team-view row ("vs Bears
U11 · W 7–2", ruled 10-30, a registered exception). A game’s own page: its score card is the stacked form, large (28 px
scores), and its when-and-where card leads on a phone.
*Keeps:* the phone recipe, the desktop one-line Schedule row and "no location on the all-games list" (10-29); the team
being read first and bold (10-30). (A2, A3, A11, A13.)
*Built (Part 2a, 2026-11-05):* both forms are ONE part, `ScheduleMatchup` in `components/public/PublicGameRow.tsx` —
`form="wide"` (the default: the Schedule and Playoffs) or `form="stacked"`; `size="compact"` (a bracket match) or
`"large"` (a game's page); `pill={false}` under a "Live now" heading; `place` for the field, with Directions as a strip
outside the row's link; a side's `placeholder` draws a bracket slot dim. Its status pill is `GameStatusPill` (R9). A new
page draws a game with these, never its own recipe.
*Built (Part 3, 2026-11-05):* the Overview's Live now / Up next / Latest results and the bracket's matches (compact) are
the stacked form; Playoffs' game still to play is the one-line row with its field centred under the teams (the only
one-line row that shows a field: it is one game, not the all-games list). The old Overview row and card, and Playoffs'
own card, are deleted.
*Built (Part 4, 2026-11-05):* a game's page's score card is the stacked form, large — "{round} · {division}" and the pill
on its head line (Cancelled rides the when-and-where card instead), a side's `href` makes its name the link to its
team's page (a row that is not itself a link), and `footAction` puts Share at the right end of the foot line (a foot
holding only Share is a phone's alone). A team's page draws every game still to finish on the stacked form: the day
leading the time ("Thu, Nov 5 · 6:00 p.m."), "{division} · {round or pool}", a side's `own` making that team bold in
every state. The standalone live card is now the Schedule's and Playoffs' only.

### R7 · One link row
One link row, the club kit’s list row: a 16 px title, an optional 12 px line under it, a drawn chevron, **60 px** tall. A
row that opens a window (a rule, "How seeding works") looks the same. A row that opens another site in a new tab (a
club’s document) shows the open-in-a-new-tab symbol where the chevron would be. One name per destination.
Same on a phone.
*Keeps:* nothing earlier — new with this standard (A5, A8, 2026-11-04). Named "link row" because the club kit's `.door`
is a different part.
*Built (Part 2b, 2026-11-05):* `PublicDoorRow` renders the club kit's own `.row` (imported from `ClubKit.module.css`,
not copied), inside `PublicLinkList` (the kit's `.list`). `PublicDisclosure`'s row is the same row; a row that drops
open in place points its chevron down, up while open.
*Built (Part 3, 2026-11-05):* a row that opens in place (every phone; a desk without a window) drops its content INSIDE
its own list, directly under the row, between hairlines — the list's frame stays whole and no second box is drawn in it;
the content is plain and the panel (or the window) pads it. "How the table is ranked" opens a window on a desk, as Rules
and "How seeding works" do.
*Built (Part 4, 2026-11-05):* a team's page's standings link is a link row with its second line ("Halton Hawks U11 Jr is
1st of 3", where the team has a place).

### R8 · One toolbar
One row, always in this order: **Division** (200) · **Pool** (160) · view switch · **Search** (fills what is left, up to
320) · calendar. 44 px tall, 8 px corners. A page shows only the controls it has. Day chips get their own row under it.
Search says "Search teams", or "Search teams or coaches" where coaches are searchable.
Phone: as shipped (Division and the switch share a row, Search gets its own).
*Keeps:* nothing earlier — new with this standard (2026-11-04).
*Built (Part 2b, 2026-11-05):* Schedule, Standings, Playoffs and Teams at a desk; the words follow what the search
matches (coaches only where a team carries one).

### R9 · One look for "live"
A game row shows live with the green **Live now** pill and a **3 px green edge**. Said once: under a "Live now" heading
the pill is left off and the edge stays. Inside a sentence (a team’s line), "Live now" is green text. The band keeps its
own dot. The today’s-games line keeps its word "Live", in green instead of red.
A 3 px left edge always marks a state: green is live; on club pages the club’s colour is "open".
*Keeps:* the line’s words Live / Final / start time (10-28). (A4.)
*Built (Part 2a, 2026-11-05):* one pill set, `GameStatusPill` — Live now green, Final neutral, Unofficial amber,
Cancelled in the danger colour — on the Schedule, Playoffs and a game's page. The edge has one shape: a standalone card's
3 px left border with square left corners (`.liveCard`), or inset on a row inside a list (`.edge`).
*Built (Part 5, 2026-11-05):* Playoffs' "Live now" game is the standalone live card drawn without the pill (owner
2026-11-05: "said once"; `PublicLiveCard` takes `pill`). The Schedule's live card has no heading, so it keeps the pill.

### R10 · One box, one type scale
**8 px** corners on every box and control. Pills stay round, the logo keeps 10, and the view switch’s track is 9 (its
3 px padding around 6 px buttons). Boxes use the light hairline. Tables keep the table standard’s darker frame. The
darker field edge is for inputs. No shadows. Text: **12 · 14 · 16 · 18 · 20 · 24**, plus 28 for a game page’s time and
score.
The band, the menu and the today’s-games line are the frame and keep their own sizes. **One band height on both sites:
72 px** plus its 3 px rule, as a minimum — a two-line name grows it (C1, 2026-11-05: the club’s ruled 72 replaces the
tournament’s desk 88).
*Keeps:* the table standard's darker table frame and the shipped 52 px Standings rows (Stage 4; `TABLE_EXCEPTION_REGISTER.md`
K-16).
*Built (Part 2b, 2026-11-05):* the tournament sheets' corners, hairlines and text sizes swept; the desk band's 88 px
override removed. Still off the scale on purpose until Part 4: a game page's 32 px time.
*Built (Part 4, 2026-11-05):* a game's page's time is 28 px, the same as its score (the registered exception).
*Built (Part 3, 2026-11-05):* the empty-state card (`PublicTournamentState`) under the frame is the Schedule's own
empty state: a white card, light hairline, 8 px corners, left-aligned, a 20 px title, the line in dim ink, the symbol
plain — no glow, shadow, medallion or sliding title. Every public tournament page that shows it takes the one look.
*Built (club build Part 3, 2026-11-05):* the club pages' strays on the scale (early-bird price 16, the fit line 14 at 8 px,
Your sign-up's weights 600 / 700 and its total 20 in the title face, Subscribe's popover); the shared pay block's headings
are section headings (16/700, text face) on both sites, its field takes the field edge at 8 px, its receipts 8 px;
Tournaments' table cells in the text ink.

### R11 · Weight follows purpose
A filled button only for the page’s main job (Register, Pay). A choice inside a control (the chosen day, the chosen side
of the switch) is a fill, not a button. Everything else, "Visit the club" included, is the white outlined button.
Same on a phone.
*Keeps:* nothing earlier — new with this standard (A7, 2026-11-04).
*Built (Part 3, 2026-11-05):* "Visit the club" is outlined, and the host card renders only when the club has something
open now (A10: `hostCardView` returns no card for an empty open-now list).
*Built (Part 4, 2026-11-05):* a team's page's "Try again" is the outlined button inside the shared empty card.
*Built (club build Part 3, 2026-11-05):* the pay buttons are 44 at 8 px on both sites, full width on a phone at 640 (and
"Email me my link" with them); Subscribe at a desk and Follow are the club kit's small buttons; "Sign up for tryouts" takes
its own width at a desk, the full width on a phone.

---

## Exceptions

Each is a departure on ONE named axis, for the stated reason. A page follows every rule it is not excepted from.

| Departs from | Where | What it does instead | Reason |
|---|---|---|---|
| R5 (one-line, chevron rows) | **A game row**, every surface | a head line plus two teams (three lines); no chevron — the whole row is the link (`PublicGameRow.tsx`) | a game is read as when · who · status; the row is the door |
| R6 (the stacked game form) | **A team's page, Results** | its own team-view row: "vs Bears U11 · W 7–2", on the light hairline | ruled 2026-10-30 (A13): the team is the subject, so the result reads from its side |
| R4 (three heading levels) | **A team's own name on its page** | 24 px in the title face | the page's subject; ruled with A13 |
| R10 (8 px corners) | **The view switch's track** | 9 px | its 3 px padding around 6 px buttons — nested corners, not a different box |
| R10 (light hairline, row heights) | **Tables** (Standings) | the table standard's darker frame; the shipped 52 px rows | the table standard; `TABLE_EXCEPTION_REGISTER.md` K-16 |
| R10 (type scale, corners) | **The frame chrome**: the band, the menu, the today's-games line | their own sizes (the ticker's 13 px included) | they are the frame, not a page's content |
| R1 (one 960 column) | **A bracket of three or more rounds** | scrolls sideways inside its own box | its rounds cannot fold into 960 without losing the pairing lines |
| R10 (type scale) | **A game's page: the time and the score** | 28 px | the one page about one game; ruled with A11 |
| R1 (the frame and its rail) | **The team pay page** (`/pay/[token]`, a focused page) | no rail; its own 640 px column centred under the slim band | Public tournament pages Stage 7 Ask 6: one job, nothing else on the screen |
| R1 (left-aligned) | **The register form** | its own 640 px reading column (C2, 2026-11-05: was 680; the club's forms were already 640 — they never shared the 680 sheet), placed on the page's left edge | a form reads best narrower than a list; it stays inside the 960 |
| R5 (one list) | **The club home's team grid** | tiles in a grid inside one frame | DC-01, ruled 2026-10-19: the home's team finder |
| R5 (two lines) | **A house-league season row** | a third line of links (Sign up, Schedule, Standings) | Stage 9a frame E: the row is the season's door and its shortcuts |
| R6 (the game forms) | **A club team page's schedule** | the club calendar row: date and time in a 96 px column, Up next by the club's edge | ruled 2026-10-19 / 10-20: a team's season calendar, not a tournament scoreboard |
| R8 (the toolbar's select) | **Born in** (club Teams, Tryouts) | the house pick-one pill (`BornInPill` → `SingleSelectDropdown`), its menu floating as shipped | ruled 2026-10-22 (Stage 4 Ask 15): "the house single-select dropdown pill, NOT ViewPills" |
| R9 (green only for live) | **The pay block's "clearing" heading** | the information blue | ruled with Stage 12c's words: money that is moving, not a state edge |
| R11 (outlined button) | **A phone's secondary action** (Subscribe, Directions, Copy) | the bare symbol, 44 px target, no border, no fill, no word | ruled 2026-10-20 (guard `phone-secondary-actions-guard.test.ts`) |

**Held for a later part of the build** (they break a rule today and the named part fixes them; the guard lists them so
they cannot become permanent by accident): none left on the tournament pages. The Teams toolbar's 640 px cap went in
Part 2b; the shared state card's centred 620 px box applies only outside the frame since Part 3, and a team's page's
loading / not-found / couldn't-load states wear the shared card unaltered since Part 4.

---

## How to check a new page

1. Its body renders in `<PublicPage>` — every branch, loading and not-found included — and its sheet sets no padding,
   page width or section gap of its own (the guard fails the build if it does).
2. At a desk the first thing sits 28 px under the band (or the today's-games line), 32 px right of the menu, and nothing
   runs past 960 px; on a phone, 16 px all round.
3. Sections are 24 px apart, toolbar rows 12, list rows touch with a hairline; headings are one of the three levels.
4. Every game is the game row (stacked or one-line), every link a link row, "live" is green, every box 8 px with the
   light hairline, every size on the 12 · 14 · 16 · 18 · 20 · 24 scale.
5. Anything it cannot do is a row in **Exceptions** above, with its reason, before it ships.
