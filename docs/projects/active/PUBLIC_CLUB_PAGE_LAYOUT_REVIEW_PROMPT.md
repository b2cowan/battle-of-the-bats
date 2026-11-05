# Public club pages — layout review and drawings (session prompt, two sessions)

> Written 2026-11-04 at the owner's request ("can you write a prompt to do the same review of all public club pages?"),
> right after the tournament round was ruled and its build prompt written. **This is the club round of the same
> project:** plan `PUBLIC_PAGE_LAYOUT_STANDARD_PLAN.md` (§2 the eleven rules R1–R11, §3 every ask A1–A14 and its reason,
> §3 "Not asked now" = the club round's standing questions, §6 log). The tournament drawings (the house layout to copy, and
> the standard drawn): https://claude.ai/artifact/NC6Y7ijjYtd3Kr4cGPgbep (source `PUBLIC_PAGE_LAYOUT_STANDARD_DRAWINGS.html`).
> The tournament build: `PUBLIC_PAGE_LAYOUT_STANDARD_BUILD_PROMPT.md` (its Part 1 writes the standard to
> `docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md`; if that file exists, it is the standard; if not, plan §2 is).
> You are Claude Code. Read `AGENTS.md`, `AGENCY_RULES.md` and `CLAUDE.md` first. This session **draws and asks; it builds
> nothing and commits nothing** unless the owner says so.

## The owner's ask, in his words

2026-11-04, after the tournament pages: *"once approved and implemented, you can follow up by reviewing the pages on the
club public page and do a similar exercise (users will be toggling between a club page and their tournament so we also
want to make that experience as seemless as possible)."* The tournament complaint it follows: *"the pages are quite
inconsistent, making the browsing experience from page to page not flow as well as I would like … standards and rules
around spacing, tile sizing, formats, etc."*

So the job has **two halves**, and the second is the one only this round can do:
1. **Club page to club page:** the same census → standard → drawings → asks exercise the tournament round did.
2. **Club ↔ tournament:** a family clicks "Hosted by {club} ›" from a tournament, or the club's Tournaments tab into a
   tournament, and back. What jumps on that click (the band, the nav, the content column, the type, the footer) and what
   should not.

## Sequencing (dependency, not timing)

- **Drawing this round is safe now:** it changes no code.
- **Building it waits** on the tournament build's Parts 1 (the standard + page wrapper) and 2a/2b (the shared parts:
  the game row, the link row = the club kit's `.row`, `.listBand`, pills, the sweep). Those parts reach into the club kit
  (`components/public/ClubKit.module.css`) that club pages use. **Any proposal here that changes a shared part is its own
  ask, labelled "touches the tournament build"**, so the two builds never restyle the same thing twice.
- If the tournament build has landed when you run this, measure the club pages against what shipped, not the drawing.

## How this runs: two sessions

| Session | Covers | Ends with |
|---|---|---|
| **1** | Census (helpers, in parallel) → the club pages measured against the standard → the club ↔ tournament toggle measured → drawings in the house layout → `/design` review applied → published → asks | The owner has the drawings link and the asks |
| **2** | After the owner rules: record the rulings (plan, design log, TODO), fold any change to the standard into the standard, write the club build prompt in the tournament build prompt's shape | Build prompt written |

At the end of session 1, tell the owner it is a good place to `/clear` (the census is heavy).

**Token discipline (owner, standing; CLAUDE.md "Broad reading and searching go to a helper agent").** Send the census to
helpers in parallel (Explore to read, general-purpose only if a command must run), each told exactly what to return
(a table of measured values with file:line, short verdicts, no dumps). **A helper's summary is a lead:** open the lines a
decision turns on before you build on them or tell the owner. Read the tournament drawing file only by slicing it.

## Step 1 · Which pages are in scope (decide it from the code, then ask)

- **Enumerate every page a visitor reaches without signing in under the club frame** (`components/public/ClubFrame.tsx`):
  the section list in `lib/org-public-sections.ts` (Home · Teams · Tryouts · House league · Past tournaments, plus any
  Tournaments tab from Club Tier Stage 4f) and every route under `app/[orgSlug]/` that renders in that frame — the club
  home, the Teams list, a team's public page, Tryouts (list, a tryout, its sign-up), House league (the public season page
  ruled 2026-11-04 in `HOUSE_LEAGUE_STAGE9_PLAN.md` §0k, sign-up, the family status / pay page), Past tournaments, About,
  any News / sponsors / contact page, registration forms, and the same pages on a **club's own web address** (Stage 4e).
  Exclude: tournament pages (done), admin, the coaches portal, signed-in family pages, platform pages.
- **Tag each page against the owner's end-state direction** (2026-10-29, recorded as DIRECTION, specifics undecided; memory
  `project_end_state_signed_in_family_app`): *public = tournaments and team public pages*, with the doors a family needs
  **before** it has an account staying public by the 2026-10-31 rulings (signing up never creates an account; the emailed
  pay link and the status/pay page stay; tryout scorers need no sign-in). Tags: **stays public** (team pages, sign-up and
  pay doors, tryouts, the club's front door) / **unclear** (say why). Draw the "stays public" pages in full; for "unclear"
  pages, apply the standard on paper only and put one ask to the owner listing them. **Do not draw a page's retirement** —
  that is not this project.

## Step 2 · The census (helpers in parallel)

Ask for **measured values at 1,536 (the owner's screen, CSS px; his screenshots are ×1.25), 1,280, 1,024 and 390**, per page:
padding, content width and whether centred or left-aligned, the first element's distance from the band, gaps between
sections, heading styles (element, size, weight; which shared part), card / list / row recipes (padding, radius, border
token, min-height, type), buttons (filled vs outlined, sizes), every text size and corner radius used, the states the page
has (empty, closed, full, held back, error), and which shared parts it reuses vs its own recipe. Plus the frame: band,
tabs, footer, the notice row, tokens.

**Leads from the 2026-11-04 club-frame census** (verify, do not trust): the bar is a full-bleed club-colour band, 72 px +
3 px rule, logo 44 r10, name 24 title face, tabs in the band (16/600, 44 tall, inset 3 px underline), no left rail, nothing
pinned on desk (`ClubFrame.module.css` :233-534); bar / footer edge `max(24px, calc((100% − 1200px)/2 + 24px))` = the
global `.container` (`app/globals.css` ~:1653); page columns: Home 1,200 centred (`ClubSiteHome.module.css` :15-18, desk
padding 28/24/40), team page (`TeamPage.module.css` :6, :88), Teams 744+48 left-aligned (`ClubTeams.module.css` :112-114),
Tournaments 960+48 left-aligned (`ClubTournaments.module.css` :113-115), League 760 measure left-aligned in the 1,200
(`league-column.module.css` :9-13 — **the only written width rule for club pages, a code comment**), **About 760 centred at
every width (`ClubAbout.module.css` :3-5), the outlier**. Section gaps 20 (home, team page), 16 (Teams), 24
(Tournaments). Two-column desk = `minmax(0,1fr) 380px`, gap 20/28 (home, team page). Kit: card 1.25rem/1.5rem padding, 1px
`--club-line`, r8, no shadow; door = 3 px `--club-edge` left, r `0 8 8 0`; list + hairline rows, min-height 60, drawn
chevron; band label 12 uppercase; section heading 16/700; page h1 32 title face; card title 20; chip r20; button 44 r8.
Club CSS writes literal type steps 12·14·16·20·24·32 (not the `--type-*` vars) and literal radii 8/10/20; no spacing tokens.

## Step 3 · Measure against the standard, and the toggle

- **Each R1–R11 against each page:** where a club page already meets it, where it breaks it, and where **the rule itself
  does not fit a club page** (the tournament rules were written for a frame with a left menu: R1's "32 px right of the
  menu", R2's "the menu names the page", R8's toolbar). A rule that does not fit is a proposal to amend the standard, not a
  reason to bend the club page — say which, and why.
- **The toggle:** walk the real click paths at 1,536 and 390 — club home → its Tournaments tab → a tournament's Overview;
  a tournament's "Hosted by {club} ›" (band, footer, host card) → the club home; a tournament team page ↔ that team's club
  team page if both exist. For each, list what changes on the click: band height (72 vs 88), nav (tabs in band vs left
  menu), content column (centred 1,200 with a left-aligned measure vs 960 beside the menu), the content's left edge on
  screen, type, headings, footer, the ground. Draw it.
- **The plan's standing questions** (plan §3 "Not asked now"), each needs an answer or an ask: the menu on the left vs tabs
  in the band (recommendation on record: keep the tournament's menu — six to nine tabs plus a long name won't fit a band —
  and match everything else); band height 72 vs 88; the club's three measures (744 / 760 / 960) onto one; the word "door"
  (club kit door = a card with an edge and a button; the standard's plain chevron row = "link row"); About's centring.

## Rulings to respect (do not re-open; cite the reason when one bears on a proposal)

Search **both** the in-repo `memory/design_decisions.md` **and the plans and build prompts** of the club public site
(Club Tier Stage 4 / 4b / 4c / 4e / 4f, `HOUSE_LEAGUE_STAGE9_PLAN.md`, the signed-in family plans) before proposing a
change. ⚠ The tournament round's `/design` reviews caught **five standing rulings the drawings had reversed
unannounced, two of them found only in a build prompt** (the Stage 3 phone order of a game's page; the 10-29 desktop
Schedule row). Known ones: the club site sits on a light ground (design_decisions ~:755); "the branded bar stays 72 px with
a 44 px logo" (~:763); the public nav links are centred with equal flex on both sides (~:1209-1213); **a back link stays only
when it goes somewhere the tab row does not** (2026-10-20, ~:690) — now ruled for the tournament too (A14); the team page's
20 px section gap (~:486); a club's public team page shows games and tournaments only, never practices; the house-league
public season page (§0k, 11-04); the portal is the formatting benchmark (memory
`feedback_portal_is_the_formatting_benchmark`; ⚠ its "every club page centres at 960 / 1,200" line is the coaches-portal /
club-ADMIN rule — check which surface a ruling was made on before applying it to the public site). Past decisions are
reference, not authority: decide on merit, and when a proposal reverses one, make it an ask that names the ruling and its
reason.

## Step 4 · The drawings (house layout; owner rulings on mockups)

- **One HTML Artifact**, never the design canvas; load the `artifact-design` skill first. Source file
  `docs/projects/active/PUBLIC_CLUB_PAGE_LAYOUT_DRAWINGS.html`, published by file path (keep the path and icon for every
  round so the history threads). Sticky numbered tabs, one section at a time, the last tab = Asks. Suggested tabs:
  `1 · Why it jumps` (counters + an edge map of every club page AND the tournament pages on one scale) · `2 · The standard on
  a club page` (R1–R11 with a "club" column: meets / breaks / amend) · `3 · Club ↔ tournament` (the toggle, side by side) ·
  `4 · Every page` (page picker + Today / Proposed + `Everything` / `Show only what differs`, the club tabs inside the
  drawing clickable so the owner can browse; a "Hosted by" link inside a tournament frame that opens the club frame) ·
  `5 · Asks`.
- **Whole screen, before and after, at true size** (1,536 desk scaled to fit with an "Actual size" option; 390 phone for
  every page whose phone layout changes). Draw controls **from the shipped component** (open it; do not paraphrase a rule).
  Real club content from the fixtures (the Lakeshore Lightning dev org, or the Riverdale demo world), never lorem ipsum;
  a number in a sentence is computed or left out. Tag every change NEW / RESTYLED / UNCHANGED, numbered markers that match
  the rules and open them on click. Time words with "8:00 a.m."; one spelling.
- **Every state a page has**, not just the happy one (the tournament round's `/design` passes flagged missing states both
  times): empty, closed sign-up, full, waitlist, held back, nothing open, a long club / team name.
- **Run `/design` on the drawings before the hand-off** (owner, standing): a fresh helper running
  `.claude/commands/design.md` against the written rules and the shipped components, told to flag reversed rulings,
  misdrawn "today" frames, missing states, and rules wrong on merit. Apply what holds, republish, and say what it changed.
- **Asks:** each with the options, the trade-off and a recommendation, numbered **C1, C2 …** (the tournament round used
  A1–A14). Keep the list short: draw the decisions, not every control. Shared-part asks labelled "touches the tournament
  build".

## Step 5 · Records (session 1)

Append a **"Club round"** section to `PUBLIC_PAGE_LAYOUT_STANDARD_PLAN.md` (census table, findings, the toggle, asks,
log line) and a paragraph to its PM brief; update the project's `TODO.md` line (one line, detail in the plan). The design
log gets an entry only after the owner rules. Update memory `project_public_page_layout_standard`. Hand-off message to
the owner in product-owner voice: the link, what to look at first (tab 3, the toggle), the asks, what `/design` changed.

## Session 2 · After the rulings

Record them as ruled (add nothing they did not rule): plan, in-repo design log, TODO, the drawings' Asks tab, memory. If
a ruling amends the standard, edit `docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md` (or plan §2 if Part 1 has not run)
and note it in the tournament build prompt if the tournament build has not reached that part. Then write
`PUBLIC_CLUB_PAGE_LAYOUT_BUILD_PROMPT.md` in the shape of `PUBLIC_PAGE_LAYOUT_STANDARD_BUILD_PROMPT.md`: one paragraph
every part shares, the rulings it stands on, a census with file:line, session-sized parts with a `/clear` between, the
walk (next free § in `OWNER_QA_LEDGER.md`), "not in this build". Its first line states it builds only after the tournament
build's shared parts (Parts 1, 2a, 2b) are committed.

## Not in this round
Tournament pages (done). Club admin and the coaches portal. Signed-in family pages and the future app. Which club pages
retire under the signed-in end state (an owner decision, asked, not drawn). Plan and pricing gates on club pages. Copy
rewrites beyond a word that two pages spell differently.
