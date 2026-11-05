# Public page layout standard

**Status: RULED by the owner 2026-11-04.** A1–A9 ("I agree with your recommendations"), A10 (resolved on the
recommendation), A11–A14 ("I agree with your recommendations, go ahead and make the build prompt"). A living reference:
it evolves in place and is never archived. Part 1 of the build (the page wrapper, the 1,200 px stack, the guard) landed
2026-11-05; the recipes (R4–R11) land in Parts 2a–4 of
`docs/projects/active/PUBLIC_PAGE_LAYOUT_STANDARD_BUILD_PROMPT.md`.

- **The drawings are the spec:** https://claude.ai/artifact/NC6Y7ijjYtd3Kr4cGPgbep (source
  `docs/projects/active/PUBLIC_PAGE_LAYOUT_STANDARD_DRAWINGS.html`; tab 2 holds these rules, tab 3 every game state,
  tab 4 every page today vs. proposed).
- **Plan and every ask's reason:** `docs/projects/active/PUBLIC_PAGE_LAYOUT_STANDARD_PLAN.md` §2–§3. Design log: in-repo
  `memory/design_decisions.md`, 2026-11-04 "PUBLIC TOURNAMENT PAGES: ONE LAYOUT STANDARD".
- **Scope today:** the public tournament pages (Overview, Schedule, Standings, Playoffs, Teams, Rules, Champions, a
  game's page, a team's page, News, Register). The club's public pages are the next round; R1 already says where they
  will land. Tables also follow `TABLE_AND_LIST_STANDARD.md`; their departures live in `TABLE_EXCEPTION_REGISTER.md`.
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
Phone: full width, 16 px sides. A club page keeps its centred 1,200 px column and puts the 960 on that column’s left
edge (the club round). Exception: a bracket with three or more rounds scrolls sideways inside its own box.
*Keeps:* nothing earlier — new with this standard (A1, 2026-11-04).
*Built:* `components/public/PublicPage.tsx` → `PublicParts.module.css` `.page`; the two columns are `.cols`.

### R2 · One page top
Content starts **28 px** below the band, or below the today’s-games line where a page carries it. A page opens with its
toolbar if it has one, otherwise its first heading. No page title: the menu already names the page. No back link where
the menu (or the phone’s tab row) already goes: a game’s page and a team’s page open with their content.
Phone: 16 px; the white tab row names the page.
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
A pool with its own table takes a section heading. Registered exception: a team’s own name on its page is **24 px** in
the title face.
Same on a phone.
*Keeps:* division headings 18 px (ruled 10-30).

### R5 · Same kind, one list
Rows of the same kind are **one framed list** with hairlines between them. Separate boxes only for different kinds of
thing (a live game, a link row on its own, the host card). A list row is two lines at most.
Registered exception: a game row is a head line plus two teams, and it opens its game with no chevron (the whole row is
the link, as shipped).
*Keeps:* nothing earlier — new with this standard (A8, 2026-11-04).

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

### R7 · One link row
One link row, the club kit’s list row: a 16 px title, an optional 12 px line under it, a drawn chevron, **60 px** tall. A
row that opens a window (a rule, "How seeding works") looks the same. One name per destination.
Same on a phone.
*Keeps:* nothing earlier — new with this standard (A5, A8, 2026-11-04). Named "link row" because the club kit's `.door`
is a different part.

### R8 · One toolbar
One row, always in this order: **Division** (200) · **Pool** (160) · view switch · **Search** (fills what is left, up to
320) · calendar. 44 px tall, 8 px corners. A page shows only the controls it has. Day chips get their own row under it.
Search says "Search teams", or "Search teams or coaches" where coaches are searchable.
Phone: as shipped (Division and the switch share a row, Search gets its own).
*Keeps:* nothing earlier — new with this standard (2026-11-04).

### R9 · One look for "live"
A game row shows live with the green **Live now** pill and a **3 px green edge**. Said once: under a "Live now" heading
the pill is left off and the edge stays. Inside a sentence (a team’s line), "Live now" is green text. The band keeps its
own dot. The today’s-games line keeps its word "Live", in green instead of red.
A 3 px left edge always marks a state: green is live; on club pages the club’s colour is "open".
*Keeps:* the line’s words Live / Final / start time (10-28). (A4.)

### R10 · One box, one type scale
**8 px** corners on every box and control. Pills stay round, the logo keeps 10, and the view switch’s track is 9 (its
3 px padding around 6 px buttons). Boxes use the light hairline. Tables keep the table standard’s darker frame. The
darker field edge is for inputs. No shadows. Text: **12 · 14 · 16 · 18 · 20 · 24**, plus 28 for a game page’s time and
score.
The band, the menu and the today’s-games line are the frame and keep their own sizes.
*Keeps:* the table standard's darker table frame and the shipped 52 px Standings rows (Stage 4; `TABLE_EXCEPTION_REGISTER.md`
K-16).

### R11 · Weight follows purpose
A filled button only for the page’s main job (Register, Pay). A choice inside a control (the chosen day, the chosen side
of the switch) is a fill, not a button. Everything else, "Visit the club" included, is the white outlined button.
Same on a phone.
*Keeps:* nothing earlier — new with this standard (A7, 2026-11-04).

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
| R1 (left-aligned) | **The register form** | its own 680 px reading column (a sheet club forms share), placed on the page's left edge | a form reads best narrower than a list; it stays inside the 960 |

**Held for a later part of the build** (they break a rule today and the named part fixes them; the guard lists them so
they cannot become permanent by accident): the Teams toolbar's 640 px cap (R8, Part 2b); the shared state card's
centred 620 px box (Part 4 restyles the loading / unavailable / not-found states).

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
