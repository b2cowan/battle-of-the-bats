# Public tournament pages: deep design review and proposals

> **Written 2026-10-27 for Codex.** The owner wants a deep, independent design review of the public tournament pages, and
> proposals he can look at as mockups. This is a **review-and-propose** job. **Nothing is built and nothing you do here
> changes product code.** The mockups come back to a Claude session for a second review before the owner sees them.

## The job in one paragraph

Look at every public page a family, fan or stranger sees on a tournament site (`/{org}/{tournament}/...`), on a phone first,
and work out what is wrong with it and what it should become. Then propose a redesign, drawn as mockups. The owner walked one
on a phone and found it **extremely text-heavy in places and not easy on the eyes**. The club's public site has since been
redrawn and tournament pages are the one public surface that has not had a pass.

## The goals, in the owner's order

1. **Simplify and improve the visuals without sacrificing content.** "Simplify" does **not** mean "remove". Every piece of
   information a family uses today must still be reachable. The tools are hierarchy, grouping, collapsing, moving behind a
   tap, and the order things appear in. If you propose removing a piece of content, say so explicitly, say why, and list it
   in a separate "content that goes" table so the owner can veto it.
2. **Phone first.** Most readers are parents standing in a parking lot. The core jobs are: find my team's next game, find the
   field, see the score, see the standings, see what happens next. Judge every section by whether it helps or gets in the way
   of those jobs. Desktop must still work, but it follows the phone.
3. **Continuity with the club's public pages.** Many tournaments are run by clubs. A parent who moves from a club's page to
   its tournament, and back, should feel they are in the same place, and the product should feel like one product. The club
   site was redrawn in Club Tier Stage 4. Tie the tournament design to those decisions wherever they hold.
4. **The tournament-to-club link is an advertisement for the club**, not a back link (owner ask B, below).
5. **Sponsor sections**, as the club now has (Stage 4d). Same idea, or the tournament's own list? Whose sponsors when a club
   runs the tournament? That is open.

## Read these first, in this order

Form your own view of the real screens **before** you read the owner's plan's open questions. Then read the rest.

### A. The project record

- `docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` and `_PM_BRIEF.md`: what the owner asked for, the two club-link
  asks (A and B), the open questions, and a logged finding (the team pay page's header collision).
- `docs/projects/active/PUBLIC_FACE_WARM_PLAN.md`, **Q6** (around line 143) and the audit table near line 49: public sport pages
  are "OLD, wearing the org's brand", mono-heavy (the schedule has 38 uses of the typewriter face). Q6 was ruled A: **the
  public tournament pages' type is its own project.** This is that project.

### B. The club's public-page decisions (the continuity anchor)

- `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`, "Stage 4 — The club's public face" (around line 998; all 17
  asks ruled 2026-10-19; closed 2026-10-25).
- `docs/projects/active/CLUB_TIER_STAGE4_DRAWINGS.html`: the owner-ruled club drawings. **Open it in a browser.** This is the
  look you are being asked to tie to, and the best example of the mockup format the owner likes.
- `docs/projects/active/CLUB_TIER_STAGE4B1_BUILD_PROMPT.md`: the frame as built. Its rules table is the shortest statement of
  what a club page is (the bar, the footer, the colour roles, the type, the titles).
- `lib/club-colour-roles.ts` (header comment): how a club's colour becomes four safe roles on one light ground.
- `components/public/ClubFrame.tsx`, `ClubBar.tsx`, `ClubFooter.tsx`, `ClubSponsors.tsx`, `OrgSectionTabs.tsx` and their CSS
  modules: the shipped components. Draw from the shipped component, not from memory of it.
- Stage 4d (sponsors) and 4f (the Tournaments tab in the club's top row): `CLUB_TIER_STAGE4D_COPY.md`,
  `CLUB_TIER_STAGE4F_DRAWINGS.html`, `CLUB_TIER_STAGE4F_COPY.md`.
- `docs/projects/active/PUBLIC_SITE_BUILDER_PLAN.md` and `PUBLIC_SITE_BUILDER_DRAWINGS.html`: how a club shows, hides and
  orders the parts of its site.

**The club rules that matter most for continuity** (confirm each in the sources above; do not take this list on trust):

- Club pages sit on **one light ground for every club** (`#F6F5F2`, white cards, near-black ink `#1F1B16`). The club's colour
  becomes four roles: **fill** (bar, footer, buttons), **text on fill**, **ink** (4.5 : 1, for links and the selected tab) and
  **edge** (3 : 1). The **accent is decoration only**. **No tints anywhere.**
- The bar is the club's colour band, 72 px with a 44 px logo (initials when there is none), the name in the title face, a
  one-line tagline, and a white tab row on a phone. **No Discover and no Pricing at any width.**
- One footer on every club page, with the quiet "Built on FieldLogicHQ" credit under a hairline. A part with nothing to show is
  **absent**, not an empty box.
- Club pages avoid the typewriter face; the title face is for headings and the data face for numbers and game codes.
- Every club page is titled "page · club".

### C. The tournament pages today, and the rules that govern them

- The code: `app/[orgSlug]/[tournamentSlug]/` (layout, overview, news, schedule, game detail, standings, teams, team profile,
  playoffs, results, rules, register, `pay/[token]`, champions) and `components/public/` (`TournamentSideRail`,
  `TournamentTopTabs`, `ScoreTicker`, `MyTeamDock`, `TournamentHomeContent`, `ScheduleContent`, `StandingsContent`,
  `TeamsContent`, `NewsContent`, `RulesContent`, `RegisterContent`, `PayBlock`, `PlayoffPicture`, `ChampionsRecap` and the
  Follow components). Tokens: `app/globals.css` and `lib/public-tournament-theme.ts`.
- `memory/design_decisions.md` is a huge append-only log. Read these entries (search for the headings):
  - **2026-06-01 "Public tournament pages: mobile remediation direction"** (around line 10286): the home page is
    state-dependent (a hero before the event; **lead with data once the tournament is live**); **standings stays a table on a
    phone, never cards** (Team column frozen left, PTS frozen right); the schedule auto-scrolls to today; a contrast floor
    guards custom organization accents.
  - **2026-07-21 "Theming ratification" TH-1** (around line 9032): the organizer's brand wins on org-branded surfaces, and
    public tournament pages ignore personal themes.
  - **2026-07-14 G3 / G4 / G5** (around lines 9178 to 9189): one unified event header, the uppercase kicker, the bottom nav
    (Home, Schedule, Standings, Teams, More), and **2026-07-20 Tournament Nav Unification** (around line 9081).
  - **The Flip** (around lines 8692 and 8993): FlipPill and its public-tournament amendment.
- Prior tournament-page work that already decided things, so do not redo it blindly: `docs/projects/archive/`
  `PUBLIC_TOURNAMENT_MOBILE_POLISH_PLAN.md`, `PUBLIC_TOURNAMENT_WOW_PLAN.md` (live game day, follow-my-team, fan push),
  `codex_PUBLIC_TOURNAMENT_MOBILE_EXPERIENCE_PLAN.md` (registration flow, tournament day mode, schedule search and filter
  sheet, game detail pages), `PUBLIC_NAV_FRAME_PLAN.md`, `PUBLIC_TEAMS_REMODEL_PLAN.md`.
- Written design standards: `docs/agents/design/TABLE_AND_LIST_STANDARD.md`, `NAV_STANDARD.md`,
  `LAYOUT_INVARIANTS_REPORT.md`, `docs/agents/brand/VISUAL_IDENTITY.md` and `BRAND_FOUNDATIONS.md`. Build-time checks that
  encode some rules: `npm run check:contrast`, `check:text-contrast`, `check:tokens`, `check:public-type`.

## The tension you must resolve on merit

Two things the repo says pull against each other, and the owner wants your argued view, not an assumption.

1. **The carve-out.** In Club Tier Stage 4b-1 (Ask 8, and the build prompt's "tournament pages, admin, coaches ... must look
   exactly as they do today") tournament pages were deliberately left with their own look, and still carry the platform's
   phone bar. The plan says plainly: **"whether that holds is one of the asks, not an assumption."**
2. **The organizer's brand.** TH-1 says the organizer's brand wins on public tournament pages. Club pages put every club on
   one light ground with derived colour roles; tournament pages today use a different recipe (a dark ground by default,
   a colour lifted toward white). And a tournament is not always run by a club: it can be run by a standalone organizer
   on the Tournament or Tournament Plus plan, where **branding and logo are paid features** and a free event's public pages
   keep **no host logo** (`docs/agents/strategy/BUSINESS_DECISIONS.md`, around line 622, and `lib/tournament-branding.ts`).

Work out what continuity should mean given both. Possible answers include: tournament pages adopt the club frame's ground and
colour roles when a club runs them and keep a neutral version otherwise; they share the club's components but not its bar;
they stay dark and only borrow the club's type and spacing; or something else. Say which you recommend, what it costs, and
what the owner would lose. Also consider what a tournament page looks like when **the organizer is not a club at all**, and
make sure a proposal does not quietly depend on a club existing.

## The owner's specific asks (from the plan)

- **Phone first, text-heavy areas first.** Name the worst offenders from the real screens.
- **Ask B, the club as advertising.** Today a tournament page links the organization's name back to the club home, on the
  live site only. The owner wants attendees to **find the club**. Options to weigh: a band, a card at the foot, or the existing
  name link made louder. Where it sits depends on how you simplify the page. It must also degrade gracefully for an organizer
  with no public club page.
- **Sponsors.** Same strip and limits as the club's Stage 4d, or the tournament's own list? Whose sponsors when a club runs
  the tournament? Does a free event show sponsors?
- **The team pay page** (`/{org}/{tournament}/pay/{token}`): its header text collides (the date and countdown line prints over
  the page heading and the "Test payment" line), and the tournament sidebar sits beside a payment page where it has no job.
  Judge it as one of the tournament's public pages.
- **Ask A is out of scope.** The Tournaments tab in the club's top row is Club Tier Stage 4f and already drawn and walked.
  Treat it as existing when you design the way between the club and the tournament.

## Design rules you must honour

These come from owner rulings recorded in the repo and the owner's working memory. Confirm the ones you can in the sources
above; where a rule is only stated here, treat it as binding.

- **The public face is warm.** Palette: paper `#F8F4ED`, card `#FFFFFF`, ink `#241E15`, soft ink `#4A4235`, dim `#615A54`,
  olive `#57651E`. **Lime `#D9F99D` is a fill, never text on paper.** Faces: **Barlow Condensed 700** for headlines and
  **Inter** for text. **Google Fonts only.** No self-hosted or paid fonts. Whether the tournament pages wear the warm
  palette or the organizer's colours on a club-style ground is the tension above.
- **Sport-neutral.** No ball, stick, net, field markings or any symbol of one sport.
- **Never claim Canadian identity** in an identity piece. No maple leaf. (The product still uses Canadian spelling:
  "colour", "cheque".)
- **One spelling everywhere a customer can read it**: "installment" with two Ls; "fiscal year" for a club's period. **Clock
  times are "8:00 a.m."**, lowercase with periods, with no carve-out for a dense table. If a column is tight, fix the column.
  `npm run check:spelling` enforces this.
- **Standings stays a table on a phone.** Never cards. (Ruled 2026-06-01.)
- **Taps:** 44 px minimum targets. **A phone's secondary action is its symbol alone**, with no border, fill or word.
- **A waiting count is the amber pill**, never "· 1 to review" in a name. **Form selects are dropdowns.** **Every date and time
  field uses the shared themed fields.**
- **A name ending in "s" takes the apostrophe alone** ("Lynx' roster").
- **Contrast:** 4.5 : 1 for text, 3 : 1 for edges. The contrast floor on custom organization accents stays.
- **Player names are baseline** and the playing-time vocabulary is settled; do not rename them.
- **If a surface cannot honestly serve a thing, hide the entry point** rather than leaving a dead end.
- **Do not invent numbers in copy.** A figure in a sentence comes from data.
- **Ask for nothing the product cannot do.** If a proposal needs a new capability (a new field, a sponsor list that does not
  exist yet), mark it plainly as "needs new work".

## How to see the real thing

- **Run it:** `npm run dev` (it goes through `scripts/dev.mjs`; never start Next directly). It needs network access because
  every request reaches Supabase. Verify `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns 200
  before you trust anything. Do **not** restart the server for a routine edit, and do not run the full layout sweep on it.
- **The demo tournament** needs no login: slug `riverdale-minor-ball`, tournament `summer-classic`, landing at
  `/riverdale-minor-ball/summer-classic` (fictional club; seeded by `scripts/seed-demo-tournament.mjs`, wired in
  `lib/demo-org.ts`). It is public on production too, so you can read it there. The club's own site is at
  `/riverdale-minor-ball`. Look at the two side by side.
- **Capture screens at true phone size.** Use 390 px wide as the main phone width, with 360 px as the narrow check, and
  one desktop width. Capture **both states**: before the event (hero allowed) and live game day (lead with data). The scripts
  `scripts/capture-marketing-shots.mjs` and `scripts/layout-screens.mjs` show how this repo drives Playwright. Save
  screenshots under `.probe/` (it is gitignored) and do not commit them.
- Also look at: an organizer with a custom colour and logo, a free event with neither, a long team name, a long list of games,
  an empty state (no games yet), and a dark-ground accent that barely passes contrast. A review that only looks at the demo's
  happy path is not a deep review.

## What to return

Write the review and put the mockups in two files, and change nothing else.

### 1. `docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_FINDINGS.md`

Written for the owner, a non-engineer product owner. Plain language, outcome-first. No file paths in the body except in a final
appendix. It must contain:

1. **What a family does on a phone** and the order of those jobs, with the evidence (screens you captured).
2. **Page by page audit.** For each page: what is on it, what gets in the way, the specific text-heavy offenders, what is
   worth keeping, and a severity (blocks the job, slows the job, cosmetic). Include every page in the list above, plus the
   shell (header, rail, bottom nav, ticker, dock, nudges, flip pill).
3. **Where tournament pages disagree with the club pages today**, shown as a short table: ground, bar, type, colour roles,
   footer, tab row, cards, spacing, titles, sponsors, phone bar.
4. **Your answer to the tension** (carve-out versus organizer brand), with the options weighed and one recommendation.
5. **The proposals.** At most three whole-experience directions, and for each: the idea in one line, what it keeps, what it
   changes, what it costs, and the risk. Then your recommendation, argued from the goals and rules above, not from taste.
   Say plainly if the question is framed wrong, or if one of the owner's asks should be reshaped.
6. **A "content that goes" table** (anything you propose removing, and why), which should be short or empty.
7. **The club-as-advertising and sponsors answers**, each with options and a recommendation.
8. **Questions for the owner**, ranked by how much each changes the design.
9. **Needs new work**: anything the proposals depend on that the product cannot do today.
10. **Appendix for engineers:** file and component pointers, so a build can start from your findings.

### 2. `docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_DRAWINGS.html`

A single standalone HTML file (no build step, inline CSS and script, Google Fonts only) that the owner can open in a browser
and a Claude session can review. Follow the format of `CLUB_TIER_STAGE4_DRAWINGS.html`.

- **Tabs, each with a plain-language explanation beside the drawing.** Suggested tabs: Today (the real screens, annotated),
  The rules (what holds and what you changed), one tab per direction, a side-by-side of the directions, the club link and
  sponsors, the pay page, and the owner's questions.
- **Whole screens, not fragments, and before and after for each.** Draw at **true size**: a 390 px phone frame (and 360 px for
  the narrow check), and a desktop frame where it matters. Do not scale a drawing down to make it fit.
- **Both states** of the home page (before the event and live game day), and **the realistic worst cases** (long names, many
  games, empty, no logo, a low-contrast accent). Show a club-run tournament and a standalone one.
- **Draw each control from its shipped component**, not a lookalike. For example, the view switch is one white track, never
  pills; money figures are one joined band; a tag or flag that you draw must **open on click** in the drawing, because hover
  alone is not enough.
- **Use the real tokens and the real club colour roles** (derive them as `lib/club-colour-roles.ts` does) so the drawing
  shows what would ship. Include one club in a pale colour and one in a dark colour to prove the roles hold.
- **Annotate which rule each choice follows**, citing the decision (for example "club Ask 2", "TH-1", "2026-06-01 standings").
- If you cannot draw something faithfully, say so on the page rather than faking it.

## What not to do

- Do not edit product code, styles, tokens, the club files, the existing plans, `TODO.md`, or any other file. Do not commit or
  push. Do not change hooks, settings, scripts, or database checks.
- Do not rename customer-visible words, plan names or prices. Pricing and plan facts live in
  `docs/agents/strategy/PLAN_PRICING_FACTS.md`; point at it, never restate it.
- Do not reopen settled rulings (standings as a table, the warm public face, sport-neutral, the clock format) unless you can
  show from the real screens that one cannot work, and then say so loudly as a question for the owner.
- Do not agree with the plan by default. If you think a stated goal, an open question or a prior ruling is wrong, say so first
  and argue it from what the code does. Do not manufacture disagreement either: where the direction is right, say so plainly.
- Do not hide the hard cases. A proposal that only works for a club with a logo and a nicely coloured brand is not a proposal.
