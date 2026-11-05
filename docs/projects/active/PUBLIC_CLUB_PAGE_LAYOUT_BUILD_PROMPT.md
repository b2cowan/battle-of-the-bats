# Club public pages onto the layout standard — build prompt (five sessions)

> **Builds only after the tournament build's shared parts are committed: Parts 1, 2a and 2b of
> `PUBLIC_PAGE_LAYOUT_STANDARD_BUILD_PROMPT.md`** (the page wrapper, the game row, the link-row look, the heading row, the
> sweep, and C1's 72 px band, which that build's Part 2b step 6 makes). This build's **Part 4 (C6)** also waits for that
> build's **Part 4** (a tournament team page), so the two never restyle the same page twice. Check `git log` for them
> before Part 1; if they are not in, stop and tell the owner.
>
> Written 2026-11-05, the day the owner ruled **C1–C7 as recommended** ("i agree with your recommendations, go ahead and
> write the build prompt"). Plan: `PUBLIC_PAGE_LAYOUT_STANDARD_PLAN.md` **§5b** (the club census, findings, asks, the
> `/design` pass). The standard, amended with the club round the same day: `docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md`
> (R1, R2, R4, R7, R10 carry *Club round* lines; the Exceptions table has the club rows). Design log: in-repo
> `memory/design_decisions.md`, 2026-11-05 "THE CLUB'S PUBLIC PAGES JOIN THE LAYOUT STANDARD".
> **The drawings are the approved mockup and the spec:** https://claude.ai/artifact/96Jaq1JZNr8EgGaV3dxmLt (source
> `PUBLIC_CLUB_PAGE_LAYOUT_DRAWINGS.html`, same folder, v2 after `/design`). Tab 2 = R1–R11 read on a club page, tab 3 = the
> hop at 1,536 / 1,280 / 1,024 / 390, tab 4 = every page Today vs Proposed in every state with its change list (RESTYLED /
> NEW / UNCHANGED). The frames are rendered by the file's script: read `PAGES.<key>.body`, `CH.<key>` and the `.cf` CSS by
> slicing (a short node script that prints one function or block; the file is ~115 KB). Never re-derive a value the drawing
> states. **Drawing content is fixture-borrowed** (Lakeshore Lightning carries the club test fixture's teams, tryouts and
> house league); the words in a Today frame were taken from the shipped strings, but the shipped strings win if they differ.
> You are the build agent (Claude Code or Codex). Read `AGENTS.md` and `AGENCY_RULES.md` first: this repo's Next.js is not
> the one you know; one shared branch `dev`; stage explicit paths only; **commit only when the owner says**.

## What this is (one paragraph, so every part shares it)

A family clicks between a club's public pages and into the club's tournament and back. After this build **only the
navigation changes place** on that hop: the club keeps its tabs in its band, the tournament its menu on the left (ruled
on both sides; each lines up with its own page). Everything else matches the tournament standard. **The frame:** one
**72 px** band on both sites (C1, built by the tournament build); every club page is one content column, at most **960
px**, starting on the club's logo edge (`max(24px, (100% − 1200px)/2 + 24px)`), never centred, **28 px** below the band
(phone 16), **24 px** between sections (C5); **forms 640** (C2); the home and a team's page split the 960 like the
tournament's two-column pages (`minmax(0,1.35fr) minmax(0,1fr)`, gap 28) from a **1,024 px** window and stack below; prose
holds to **720 px** inside its box; phone sides **16** everywhere. **Titles:** none where a lit tab names the page (Teams,
Tryouts, House league, Tournaments: C3) — the line under it (Teams' count, Tryouts' season) stays under the toolbar; a page
about one thing keeps its name at **24 px** in the title face (C4). **The parts:** the tournament's heading row, link row,
type scale, 8 px corners. **The link:** the host club's own team's club page and its tournament team page link to each
other (C6). **Nothing here changes what data a page shows or who can see it** (privacy, coach names, players never on a
public page: unchanged); it changes layout, recipes, and the few words named below.

## How this runs: five sessions, a `/clear` between them

| Part | Covers | Ends with |
|---|---|---|
| **1** | The club page column on every club public page (R1–R3, C2, C5), the two-column split, the phone edge, the empty-column fix, the guard extended to club pages | Committed; every page's edges, top and gaps match tab 1's "proposed" bars |
| **2** | Titles (C3, C4), the heading row (R4), joined lists (R5: seasons, Your sign-up's children), About's rows (R7) | Committed |
| **3** | The sweep (R10/R11): type, weights, radii, buttons, Subscribe, the pay block (touches the tournament's pay page and Register), Tournaments' table ink | Committed; owner check on a desk |
| **4** | C6 (the two-way link), C7 (the house league's Schedule and Standings onto the standard), a past tournament's record and the in-club not-found on the column | Committed |
| **5** | `/simplify`, `/review`, layout check, the walk, records, `/docs` + `/demos` | Committed, walk published |

At the end of each part tell the owner in one line that it is a good place to `/clear`, and where the next part starts.

**Token discipline (owner, standing).** Read this prompt, plan §5b and the standard. Read the drawing only by slicing.
Delegate wide searches to a helper; a helper's summary is a lead, so open the cited lines before relying on them. The
census below was taken 2026-11-05 by helpers, spot-checked, and `/design`-checked; lines move. `npm run verify:changed`
for routine checks; `npm run typecheck` once per part; `check:layout --changed` on the screens a part touched. **No
whole-product sweep on the dev server** (AGENTS.md). New or deleted files mean a dev-server restart (stop it, clear
`.next`, `npm run dev` with network access) before handing the owner a check.

**Every part:** work on `dev`; stage explicit paths only (other sessions share this working copy and hold uncommitted files
in it: never stage theirs); present the product-owner summary **before** writing code (AGENCY_RULES); write to the owner
as to a product owner. For a partial commit out of a file another session also edited, build the blob from HEAD plus your
own lines and diff it against HEAD before committing. **The owner does the browser testing.**

### Rulings this build stands on (do not re-open them; cite them)
- **C1–C7 as ruled** (plan §5b; the standard). The ones most likely to be "corrected" by accident:
  - **C3:** a tab page loses its title but **keeps its line** (Teams' "8 teams" / the Born-in sentence; Tryouts' "Rep teams
    for the 2027 season", or nothing when the teams recruit for two seasons — `lib/tryout-season.ts:191-195`).
    **Tryouts out of season keeps a 24 px "Tryouts" title** (its tab is gone, so nothing else names the page). About has
    no tab, so it keeps "About the club" at 24.
  - **C2:** the 960 replaces the 08-01 per-page measures (744 / 760 / 1,152 / 560), but **not** the 08-01 rule's other
    half: content starts under the logo, never centred. Prose (a paragraph in a box) is held to 720.
  - **C5:** 24 reverses the 2026-10-20 team-page 20 px; its title block's own 8 px name-to-line gap stays.
- **Kept as ruled; registered exceptions in the standard (do not "fix" them):**
  - **Born in** stays the house pick-one pill (`components/public/BornInPill.tsx` → `SingleSelectDropdown`; owner
    2026-10-22, "NOT ViewPills"), faces "Born in: any year" / "Born in: 2015". Not the tournament's select.
  - **A phone's secondary action is its bare symbol** (Subscribe, Directions, Copy: no border, no fill, no word, 44 px
    target; 2026-10-20; guard `tests/unit/phone-secondary-actions-guard.test.ts`). The desk keeps the labelled button.
  - **A club team page's schedule** keeps its calendar rows (`RepTeamPublicSchedule`: date and time in a 96 px column, Up
    next by the club's edge, the folds "Earlier this season (n)" and "Show the rest of the season (n more)"; 10-19/10-20).
  - **The home's team grid** (DC-01, 10-19) and **a season row's links line** (Stage 9a frame E).
  - **The pay block's "clearing" heading** keeps the information blue (Stage 12c words).
- **2026-10-20:** a back link stays only when it goes somewhere the tab row does not: "← {team}" on a tryout page,
  "← Back to {season}" on the league form and Your sign-up, "← Back to {season or team}" on the tryout form all stay; the
  team page and About have none.
- **2026-10-19 (Club Tier Stage 4):** the light ground; the club's four colour roles; the club's chosen title face
  (Barlow Condensed / DM Serif / Inter) stays; one green chip at 12 px; no typewriter face on club pages; no player ever on
  a public page; coach names opt-in. **2026-10-20:** the desk banner strip (home only, 140–200 px, no scrim), Follow at the
  end of About the club. **2026-10-23:** sponsors' 160 × 72 tiles, the strip last on the home. **2026-10-25:** one
  Tournaments tab; Tournaments' six past columns. **2026-11-01:** Your sign-up says first names only, one "Your sign-up"
  button, the two ended screens. **2026-11-04 (§0k):** the season page's shapes and the owner's calls on it (the next
  season's card above the title, two standings cards a row, "Email me my link" in every state, no chip once finished).
- **One spelling; the clock is "8:00 a.m."** Times only through `formatTime()`; grep before writing a word with a variant.

## What the code does today (census 2026-11-05; re-check before you rely on a line)

**Frame:** `components/public/ClubFrame.tsx` (mounted by `app/[orgSlug]/layout.tsx:214`, drawn only when `wearsClubFrame`,
`lib/club-not-found-face.ts:24-26`; sections `lib/consumer-routes.ts:66-69`). `ClubFrame.module.css`: band `--club-band-h:
72px` :233 + 3 px rule :241; desk row `identity tabs actions` with padding `0 max(24px, calc((100% - 1200px)/2 + 24px))`
:515-520 (the footer :534 and the notice :548 use the same edge); phone ≤900: the tab row pins (:497-509), identity 16 px
in (:251). Tabs: `OrgSectionTabs.module.css` (desk in the band from 901, :47-74). Global `.container` (`app/globals.css`
:1662-1666: max 1,200, padding 0 1.5rem) gives the same desk edge but **24 px on a phone** — the league pages and the
archive record use it, so they sit at 24 on a phone.

**The club kit:** `components/public/ClubKit.module.css` — `.title` 32 px title face :31-39; `.sub` 14 :49-53; `.band` 12
caps :62-68; `.card` 20/24 r8 :70-75; `.chip` :78-102; `.btn` 44 r8 :112-151; `.section` gap 9.6 :168-173;
`.sectionTitle` 16/700 :174-178; `.list` :186-191; `.edge` :192-195; `.listBand` :196-205; `.row` 60 tall, drawn chevron
:207-253; `.door` :256-271; `.cardText` :281-290. ⚠ **The name `kit` is not always the club kit** — marketing pages
(`app/page.tsx`, `app/for-*`, `app/pricing`) and platform admin import other sheets as `kit` too. Before changing any
`ClubKit.module.css` rule, grep its **importers** (`ClubKit.module.css'`), not the class name; the admin's "How families see
it" previews render the public components and will move with them (intended).

**Page by page (desk at 1,536; left edge / width / band-to-first-line / section gap):**
| Page | Today | Where |
|---|---|---|
| Home | 192 / 1,152 (grid `minmax(0,1fr) 380px`, gap 20/28 from 901) / 28 / 20; banner strip above; sponsors below (32/40) | `components/public/ClubSiteHome.tsx` :92-215, `.module.css` :15-22, :77-86, :104-125 |
| Teams | 192 / 744 (box 792, `margin-left` calc) / 28 / 16; h1 "Teams" + `pluralize(count,'team')`; desk table Team · Tryouts | `app/[orgSlug]/teams/page.tsx` :95-150, `ClubTeams.module.css` :6-13, :23-123 |
| A team | 192 / 1,152 (same grid) / **20** / 20; h1 32 + colour dot; Subscribe own recipe (r9, 650) | `app/[orgSlug]/teams/[teamSlug]/page.tsx` :104-200, `TeamPage.module.css` :5-115; `TeamSubscribeButton.module.css` :7-32 |
| Tryouts | 192 / 1,152 (`.wide`) / 28 / 20; **off-season drops `.wide`: centred 640, top 16** | `app/[orgSlug]/tryouts/page.tsx` :88-129; `components/public/TryoutPage.module.css` :6-20 |
| A tryout | **centred 640 (464)** / 16 / 20 | `components/rep-teams/TryoutLandingView.tsx` :60-112; `TryoutPage.module.css` :6-13, :86-87, :171-179 |
| Tryout sign-up | **centred 640, inline styles (472)**, padding `2rem 1.5rem 5rem` (24 on a phone) | `components/rep-teams/TryoutRegisterView.tsx` :34-80, :142-148; form `TryoutRegisterForm.tsx`; `ClubForm.module.css` |
| House league | `.container` + `league-column.module.css` (760 left) / 32 / 40 between groups; `LeagueSeasonRows` = a card per season | `app/[orgSlug]/league/page.tsx`; `league-column.module.css` :1-40; `components/public/LeagueSeasonRows.tsx` + `.module.css` :4-45 |
| A season | same column, 760 / 32 / 32; sign-up shape (facts row Registration · Season dates · Price; Divisions band + cards with bar `--club-fill`, "{n} / {cap} spots filled", "Waitlist open"); season shape (next-season door, Standings / Final standings band, top-three cards, "Full table →", Schedule button) | `app/[orgSlug]/league/[seasonSlug]/page.tsx` :76-195 (season shape), :214-390 (sign-up shape) |
| League sign-up | 640 (`--league-measure`) / 32; org-name `kit.sub` line; h1 "Sign up — {season}"; four closed lines | `.../[seasonSlug]/register/page.tsx` :66-112; `components/league/RegisterForm.tsx`, `register.module.css` (`.fit` :150-151 r6, 14.4 px) |
| Your sign-up | 560 / 32 / 12; a `kit.card` per child; To pay 18.4/750; ask-to-withdraw card | `.../status/[token]/page.tsx` :118-154; `.../status/YourSignup.tsx` :160-277; `components/public/LeaguePayBlock` + `PayBlock.module.css` (h2 800 title face :9/:37, field r6 `--club-line` :21, buttons 48 :27/:39, clearing blue :25) — **PayBlock is shared with the tournament team pay page (`TeamPayContent.tsx`) and `RegisterForm`** |
| Tournaments | 192 / 960 / 28 / 24; h1 + "{n} tournaments"; Current table Tournament · Dates · Status; Past table Season · Tournament · Division · Champion · Teams · Games; cells `--club-soft` | `app/[orgSlug]/tournaments/page.tsx` :85-170, `ClubTournaments.module.css` :5-124 |
| About | **centred 760 (404)** / 16 / 20, no desk breakpoint; "Who to contact", "Documents and policies" (bands, ExternalLink rows 48 / 15 px), "Questions families ask" (h3 15/700), sponsors | `app/[orgSlug]/about/page.tsx` :50-105, `components/public/ClubAbout.module.css` :3-97, `ClubAboutContacts.tsx`, `ClubSponsors.module.css` |
| Archive record | `.container`, 1,000 inner, 24 on a phone | `app/[orgSlug]/archives/[archiveId]/page.tsx` :111-121 |
| League schedule / standings | `.container`, 800, 24 on a phone | `.../[seasonSlug]/schedule/page.tsx` :101, `.../standings/page.tsx` :70 |
| In-club not-found | `ClubNotFound.tsx` + `.module.css` | `app/[orgSlug]/not-found.tsx` |

**The hop (C6) today:** the tournament team page links only to its own Teams list (`components/public/PublicTeamPage.tsx`
:28, :70); the club team page links to no tournament. The data that ties them: `rep_team_tournament_registrations`
(read today for fees only, `lib/club-own-tournament-team.ts:33`). Club ↔ tournament links already stay on a club's own web
address (`lib/club-base.ts:44-48`, `lib/club-host.ts:166-197`) — use `useOrgHref` / `orgLinks`, never a hard-coded `/{slug}`.

**Defects found by the census (fix where named below):** a team with no games yet keeps the desk grid with an empty
column (`teams/[teamSlug]/page.tsx:104` `schedule: !!publicSchedule` while `RepTeamPublicSchedule` returns null on
`entries: []`, `RepTeamPublicSchedule.tsx:75`) → Part 1. A failed Tournaments read lands on the platform error page with no
club frame (no `app/[orgSlug]/error.tsx`) → Part 4, ask the owner first (it is not layout; one line). `PublicParts.module.css`
~:212's "which club forms share" note → the tournament build's Part 4 corrects it.

## Part 1 · The club page column

1. **One club page wrapper.** Reuse the tournament's `PublicPage` (`components/public/PublicPage.tsx` →
   `PublicParts.module.css` `.page`) with a club frame variant, or a sibling built from the same rules — one place states
   R1–R3 for both frames, so the guard can hold both. Club variant: left edge on the club's logo edge (the `.container`
   edge at a desk, **16 px on a phone**), content max **960** left-aligned, top **28** (phone 16), **24** between direct
   sections, bottom as the club pages ship (40 desk / 32 phone). A `form` width of **640**. Prose blocks (`kit.cardText`
   paragraphs, About's text, the season description) max **720**.
2. **Every club public page in the census table renders inside it**, every branch (empty, closed, not-found states
   included). Delete each page's own padding / width / gap: `ClubSiteHome .column`, `ClubTeams` box + `margin-left` calc,
   `TeamPage` padding + `.withSchedule` / body caps, `TryoutPage .page/.wide`, `TryoutRegisterView`'s inline shell,
   `league-column.module.css`'s column and measure (rewrite its header comment: the 08-01 repair rule's left edge stands,
   its per-page measures are replaced by C2 — cite plan §5b), `ClubTournaments` box, `ClubAbout .column`. The league
   pages, archive record and league schedule/standings leave `.container` for the wrapper (grep before deleting any global:
   other pages still use `.container`).
3. **Forms at 640:** the tryout sign-up, the league sign-up, Your sign-up, Email me my link (`status/page.tsx`).
4. **The two-column pages** (home, a team's page): `minmax(0,1.35fr) minmax(0,1fr)`, gap 28, from a **1,024 px** window;
   below that one column in DOM order (main, then side). The home's `--home-rows` row trick and "About alone takes the
   whole width" (`ClubSiteHome.tsx:192-193`) stay; check the tile grid gives three a row at ~540.
5. **No games yet:** a team page whose schedule renders nothing gets one column (the door and Coaches), never an empty
   left column — decide it from what renders (`entries.length`), not from `!!publicSchedule`. Test it.
6. **The banner strip** stays above the column (full-bleed, desk only); the column's 28 starts under it. The sponsor strip
   stays last on the home, inside the column's width.
7. **The guard:** extend `tests/unit/public-page-layout-guard.test.ts` to the club pages (every club page body in the
   wrapper; no club page sheet sets its own page padding, page width or section gap), with the club exceptions listed and
   reasoned like the tournament ones. Keep `club-frame-guard.test.ts` passing.
8. Checks: `verify:changed`, `typecheck`, `check:layout --changed` on every club page at 360 / 390 / 1,024 / 1,280 /
   1,536 (fixtures: the club test fixture `scripts/seed-club-fixture.mjs` has teams, tryouts, a house league and About).
   **Owner summary, then commit on his word.** Records: plan §6 log line, TODO line.

## Part 2 · Titles, headings, lists, rows

Build each page to `PAGES.<key>.body('next', …)` and `CH.<key>` in the drawing.
1. **C3:** Teams, Tryouts (in season), House league and Tournaments render no visible title. Keep an `h1` for screen
   readers (`kit.srOnly`, as the home already does) so every page still has one. Teams and Tryouts: the line that sat
   under the title becomes the first line under the Born-in pill (14 px soft); Tryouts with two seasons has no line, as
   today. Tournaments: the "{n} tournaments" line goes (each section's count pill says it). The tryout form's and league
   form's club-name line goes (the band says it); the tryout form's line keeps the team ("15U AAA").
2. **C4:** a team's name, "{team} tryouts", a season's name, the forms' titles ("Tryout application — {season}", "Sign up —
   {season}"), "Your sign-up", "This link no longer works", "About the club" and off-season "Tryouts": **24 px, title face**
   (the club's chosen face and weight). Add this as its own kit class rather than changing `.title` in place unless every
   importer is a public club page (see the census warning). The team page's dot and its 8 px name-to-line gap stay.
3. **R4, the heading row:** every club section heading takes the tournament's heading row (`PublicSectionHead`'s look:
   16/700 in a 44 px row, optional count pill, optional right link) — the same type as today's `sectionTitle`, now the same
   part. The team page's Schedule heading keeps Subscribe in its right slot. The season page's "Divisions", "Standings" and
   "Final standings" capitals labels become section headings (with the count pill on Divisions); the fact labels
   (Registration, Season dates, Price) stay 12 px labels. Your sign-up's "Pay online" becomes a section heading (it falls to
   the 800-weight title face today, `PayBlock.module.css:9`).
4. **R5:** `LeagueSeasonRows` becomes one framed list (rows on hairlines, the row's whole-row link and links line kept —
   the registered exception) on the home and the House league page. Your sign-up's children join one framed list of rows
   (name, line, chip; the per-child ask-to-withdraw state stays inside its row).
5. **R7:** About's documents become link rows (60 tall, 16/600) that keep the open-in-a-new-tab symbol where the chevron
   would be (the standard's R7 now says so) and keep their bands; the question becomes 16/600 with a 16 px answer.
6. Checks as Part 1, plus the help articles' and the demo tour's anchors on these pages (grep `data-sandbox-tour` under
   `app/[orgSlug]` and `components/public`). Commit on the owner's word; records.

## Part 3 · The sweep (R10, R11) and the pay block

1. **Type** in club page bodies onto 12 · 14 · 16 · 18 · 20 · 24: About 15 → 16 (`ClubAbout.module.css` :72, :92, :97);
   the early-bird price 15 → 16 (season page ~:304); `.fit` 14.4 → 14 (`components/league/register.module.css:151`); the
   status total 18.4/750 → **20 px title face** (`YourSignup.tsx:212`); weights 650/750 → 600/700 (`YourSignup.tsx:179,
   :190`; `LeagueSeasonRows .name`); the Subscribe popover's 11 / 13 / 15 / 19 (`TeamSubscribeButton.module.css` :60, :72,
   :136, :144) onto the scale. The frame (band, tabs, footer, notice) is exempt.
2. **Radii** onto 8: `.fit` `0 6 6 0` → `0 8 8 0`; Subscribe 9 → 8 (desk button = the kit's small outlined button; the
   phone bare symbol unchanged); its popover 12 → 8; the pay block's receipt field 6 → 8 with the **field** border (was
   `--club-line`). Pills stay round, logos 10, the house pill's own menu as shipped (shared component).
3. **R11:** the pay buttons 48 → **44**, full width on a phone at one breakpoint (today 480 vs 640 disagree:
   `EmailMyLinkForm.module.css:190`, `PayBlock.module.css:27,:39` — use the club frame's 640). "Sign up for tryouts" stays
   full width on a phone and takes its own width at a desk. The Follow button keeps its look; collapse its own recipe onto
   the kit's secondary small button (`FollowOrgButton.module.css:7-36` duplicates `btnSecondary` + `btnSm`).
4. **⚠ The pay block is shared** with the tournament's team pay page and Register (`TeamPayContent.tsx`, `RegisterForm`).
   The changes in 2–3 are the standard's on every site, so they move there too — say so in the owner summary, and check
   the tournament pay page at 390 and 1,536. Do not fork the block.
5. **Tournaments:** table cells in text ink (`ClubTournaments.module.css:58-59` soft → text), both tables; columns unchanged.
6. Checks; **owner check on a desk** (one line: click Home → Teams → a team → Tryouts → a tryout → House league → a season
   → Tournaments → About; does anything but the content move?), then commit on his word; records.

## Part 4 · The link (C6), the house league's pages (C7), the rest

1. **C6, a team's two pages** — the host club's own teams only (a tournament team registered from one of the host org's
   rep teams through `rep_team_tournament_registrations`). On the **tournament team page**: one link row under the record
   area, "{team} at {club}" with the line "The team’s page at the club" (grep the help content for an existing phrase
   first), to the club team page — **only when that page is public** (the club site is open, the plan carries the Teams
   page, the team has a public page: reuse the checks the club team page itself makes, never a weaker one). On the **club
   team page**: a schedule entry for that tournament opens the team's tournament page (whole row a link, as the calendar
   row's other links are). Teams from other clubs: nothing changes. Both directions through `orgHref` so a club's own web
   address keeps working. Unit-test the decision (registered + public → link; not public → none; other club → none).
   ⚠ This adds a read on a public page: confirm with `/review` that it exposes nothing a visitor could not already reach
   (a team name and a link, nothing about players).
2. **C7:** the house league's Schedule and Standings pages onto the column (16 px phone edge, 28 top, 24 gaps, the heading
   row, the type sweep). Their game lists use the standard's game row (R6; the house league is not the team calendar
   exception) — reuse `PublicGameRow`'s stacked / one-line forms from the tournament build. If converting the rows turns
   out larger than this part, stop and tell the owner rather than shipping half.
3. **A past tournament's record** (`archives/[archiveId]`) and the **in-club not-found** onto the column, titles per C3/C4
   (the archive record is a one-thing page: its name at 24).
4. **The Tournaments error page** (found, not layout): ask the owner in one line whether a failed read should show an
   in-club error inside the frame (an `app/[orgSlug]/error.tsx`) — build it only on a yes.
5. Checks; restart the dev server if files were added or deleted; commit on the owner's word; records.

## Part 5 · Review, layout check, the walk, the records

1. `/simplify` then `/review` (Claude Code) on the whole range of this build's commits; apply what holds; if you are Codex,
   do the adversarial read by hand and tell the owner to run the two commands. Lenses:
   - **Rulings reversed by accident:** the Born-in pill turned into a select; a bordered phone symbol; the team schedule
     turned into game rows; a back link removed (or added); the home's banner or sponsors moved; a title kept on a tab page
     or dropped on a one-thing page; a page centred.
   - **Every state** in tab 4's state picker: home (nothing open, banner, a long club name), Teams (Born in with no
     match), a team (tryouts open / closed, concluded, no games yet), Tryouts (two seasons, off-season), a tryout (open,
     not open yet, finished, closed), both forms (closed variants, sent), a season (open, full, closed, playing, finished),
     Your sign-up (owing, paid, link no longer works), Tournaments (past only).
   - **Shared CSS:** the club kit's importers outside the public pages; the pay block on the tournament pay page; the
     admin's "How families see it" previews.
   - **The hop:** at 1,536 / 1,280 / 1,024 / 390 the content's top and width match the tournament's; only the navigation
     moves (tab 3 of the drawing).
2. **Layout check:** every club page via `check:layout` against a local production build or staging (`UAT_BASE_URL`),
   never a whole-product sweep on the dev server.
3. **The walk:** one purpose — *"clicking through every club public page and into the club's tournament and back, on a
   desk and a phone, the content starts, stops and spaces itself the same way, and only the navigation changes place."*
   A checkable Artifact in the house style (parts, a fixture step, stop checks, a verdict control the owner must set on
   every part, Copy summary, Reset). **Grep `OWNER_QA_LEDGER.md` for the next free §** (§457 was the last seen 2026-11-05;
   other sessions add §s). Fixtures: `scripts/seed-club-fixture.mjs` (teams, tryouts, house league, About, sponsors, a
   hosted tournament) and the public-frame fixtures (`scripts/seed-public-frame-fixtures.mjs`: the long club and
   tournament names).
4. **Records:** plan header + §6 log, `TODO.md` line, the ledger §, the design log only if the owner rules something new,
   memory status. Offer `/docs` (help articles show these pages: grep `lib/help-content` for "Teams", "Tryouts", "About",
   "Your sign-up") and `/demos` (the shop window shows the club site) — run them if the owner says yes. Offer `/legal` only
   if C6's link changed what a public page shows about a team (it should not).

## Not in this build (say so if a step drifts toward one)
The tournament pages and the band height (the tournament build). Moving the tournament's menu into the band or the club's
tabs out of it (answered: each stays). Which club pages retire under the signed-in end state (an owner decision; C7 only
keeps two pages public for now). Any change to what a page shows (data, privacy, coach names), the Born-in pill's
behaviour, the team schedule's rows, the house-league standings maths, plan or pricing gates on club pages. The admin's own
screens. Copy rewrites beyond the few words named above.
