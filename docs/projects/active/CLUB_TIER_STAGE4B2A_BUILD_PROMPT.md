# Club Tier Stage 4b-2a: the year-round club (build prompt)

> **Written 2026-10-20** by the Stage 4b-1 session, after 4b-1 was committed (`6affb4e4e`, records `91bd4268c`) and its walk
> §350 passed 32/32. **Paste this into a new chat on `dev`.** Two owner rulings of 2026-10-20 shape it:
> - **4b-2 is split by season.** **4b-2a (this prompt) is the club as it is all year:** the home's two shapes, the Teams page
>   and tab, the team page's new recipe, the desk-only banner strip, and 4b-1's five leftovers. **4b-2b is tryout season:** the
>   club Tryouts page and its seasonal tab, tryout days, the "not open yet" and "finished" states, then preview cards and the
>   sitemap (`CLUB_TIER_STAGE4B2B_BUILD_PROMPT.md`). Do not build 4b-2b's parts here.
> - **Born-in years and the team page's Coaches section move to 4c**, each with the place it is entered (the birth years on
>   teams and divisions, and the coach's opt-in switch, are both 4c's). So 4b-2a draws **no "Born" line, no Born in picker and
>   no Coaches section**, and every page must look finished without them.

## What 4b-2a makes true

A family who opens a club's home sees **what is open now first**, then **the club's teams**, then its house league and
tournaments when it runs them, then a short "About the club". A program the club does not run is **absent**, never "check back
soon". A **Teams tab** lists every team the club fields, grouped the way the club groups them, and each team's page leads with
what a family came for: whether it is trying out, its schedule, and what the team is. The frame (bar, footer, colours, pinned
phone tabs) is 4b-1's and does not change.

## Read first

- **The drawings and the rulings:** https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k (source
  `docs/projects/active/CLUB_TIER_STAGE4_DRAWINGS.html`, ruled 2026-10-19, all 17 asks as recommended). For 4b-2a read: End
  state 1 (`#e-home`, the home's shapes, ~L863–1058), 2 (`#e-teams`, ~L1061–1127; ignore the Born in frames ~L1873–1896, now 4c),
  3 (`#e-team`, ~L1132–1266; ignore Coaches), Asks 3, 4, 7 (the banner strip, under "Also say"), 9; DC-01, DC-02, DC-07; F01–F03,
  S4-03, S4-07. Round 2 (~L1786 on) is later than round 1 where they differ.
- `memory/design_decisions.md`: 2026-10-19 "A CLUB'S PUBLIC SITE…" and the 2026-10-20 entries (the club bar's staff door, the
  side door's icon, **the phone tab row pins and the colour band scrolls away; no "← club" link back to the home**).
- `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 4: the 4b-1 as-built record and its **"For 4b-2"**
  list.
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **CLAUDE.md binds you: broad reading goes to a helper agent, and a helper's summary
  is a lead, not evidence.** The file:line leads below were gathered on 2026-10-20 at HEAD `ad9bf26d8`; re-read before you rely
  on one.
- Next.js 16: read the relevant guide in `node_modules/next/dist/docs/` before route or metadata work.

## The ruled spec (from the drawings; quote them, don't re-derive)

| Part | Ruled | Where |
|---|---|---|
| The home's order | Bar → **Open now** (absent when nothing is open) → **Teams** → **House league** (if the club runs one) → **Tournaments** (if it hosts one) → **About the club** → footer. A program the club does not run is absent. The editor's show/hide and reorder are **4c**: build the ruled order, fixed | Ask 3A, End state 1, F03 |
| Two shapes | **Rep only** (Lakeshore Lynx: "Home Teams" tabs; Open now with one tryout; Teams under bands AAA / AA; About; no Tournaments section) and the same club **with nothing open** (Open now absent, the teams move up). **Rep + house league** (Harbourview: Open now with a house-league row and a tryout row; Teams under Girls / Boys; House league "Schedule and standings from June"; Tournaments "Harbourview Cup 2027 Jun 13–15 · Harbour Park" with "Registration open") | End state 1, ~L874–1010 |
| Open now | A **white card with the club's edge** (DC-02: no tint), nearest deadline first, rows carry no chip, each row a door. In 4b-2a its rows are the open house-league registration and **one row per open tryout**. A tryout row's days line ("Three days from Sun, Nov 2 · Lakeshore Dome") and the single "2027 tryouts · 7 teams" row are **4b-2b** (they read tryout days): give the row the season line until then | End state 1 ~L876, ~L1792 |
| The home's team grid | The club's own team groups as bands (the admin's group on each team, `rep_team_groups`); a club that never set groups gets one list in its team-list order. A **two-column grid of doors**, no tile chevrons, the one green "Tryouts open" chip, **one column when any name in a group is too long for half the width**. **No "All teams" link** (the grid shows every team; the tab is one tap away) | DC-01, ~L877, ~L1024–1026 |
| Tournaments | The club's tournaments with a status that tells the truth: **Registration open · This weekend · Live now** (only while the dates include today) **· Finished**. Never "★ Live" on every card | S4-03, ~L967 |
| About the club | The club's description moves **out of the hero** into its own card near the foot. The hero's repeated contact goes: the footer carries it (4b-1 leftover) | ~L878, plan "For 4b-2" |
| Desktop | Centred at 1,200 px at 1440 | ~L1027–1058 |
| Banner strip | **Desktop only, home only:** a strip under the bar, **never repeating the name**. A phone does not show it, so Open now keeps screen one. Height, crop and the ground scrim are yours to settle with `/design` (the 90 % scrim 4b-1 left is untested) | Ask 7A "Also say", ~L1018, ~L1058 |
| Teams page | `/{org}/teams` **becomes the Teams page** (Ask 9; today a shortcut that forwards into a running tournament). Phone: "Teams" with a count ("8 teams"), rows under the club's group bands, hairlined, **the whole row the door**, the chevron last, "Tryouts open" only while sign-ups are open. Desktop: a table, **Team · Tryouts**, an empty cell "—". Not on a row: players, coaches, the division where it repeats the band. Archived teams are not listed, but their pages still open | Ask 4A, Ask 9A, End state 2, F02, S4-07 |
| The tab row | **Home · Teams · House league · Past tournaments** (Tryouts joins third in 4b-2b). A tab with nowhere to go is absent; the whole row hides below two tabs (today's rule). The sources do not say when **Teams** is absent: recommended, when the club lists no team (or its plan does not carry rep teams). Say what you chose and why | ~L885, ~L974, `lib/org-public-sections.ts` |
| Team page recipe | **"← Teams"** (one level up: allowed by the 2026-10-20 ruling) → the name, then **division and season** ("Provincial AAA · 2026 season") with the **team's colour as a dot** → the **tryout door** → **Schedule** → **About the team** → footer. A part with nothing to show is absent. **Desktop:** the schedule first, then the tryout door and About. **No "Past seasons" list** (DC-07). **No Coaches section** (4c, owner 2026-10-20) | End state 3, ~L1133–1259 |
| Tryout door | **Tryouts open:** a white card with the club's edge, "Tryouts for the 2027 season", the button **"Tryout details and sign-up"**; its days line is 4b-2b. **A quiet team:** a "Tryouts" heading and "13U AAA isn't taking tryout sign-ups right now. Questions? Email the club at …" | ~L1157–1160, ~L1199–1221 |
| Schedule | "Schedule" with **Subscribe** at 44 px. **"Earlier this season (3)"** above **"Up next"**. Each row leads with the date as plain text, a **44 px Directions** button, a cancelled event struck through with a "Cancelled" chip. Ends with **"Show the rest of the season (16 more)"**. Shown only when the coach chose Public link (today's rule, C3/C5/C7–C9) | ~L1162–1169 |
| In-club "not found" | Gains **"See all teams"** now that the Teams page exists (4b-1 kept the single home button) | 4b-1 prompt, End state 5 |

**4b-1 leftovers to close here** (plan §6 Stage 4 "For 4b-2"): the home hero repeating the footer's contact; section headings
centred over left-aligned cards; the team colour strip under the phone tab row (the recipe's colour dot replaces it); the
uploaded banner under a 90 % scrim (the strip above); the team's colour no longer tinting its division chip (DC-02 says no
tints; the dot carries the colour: confirm with `/design`).

## Verified state (leads; re-check)

| What | Today | Where |
|---|---|---|
| The home | One page, three branches by the public-site module and the tournament count; **not** by club type. Public-site branch order: hero (banner, logo, name, tagline, description, Follow, socials + "Contact us") → Upcoming events → House league card → one "Try out" card per open tryout → Past tournaments card. No teams, no About card | `app/[orgSlug]/page.tsx` ~L100–278, `ClubHome.module.css` |
| `/teams` | A shortcut: `clubShortcutPage('teams')` forwards into the running tournament, else the club's "not found" | `app/[orgSlug]/teams/page.tsx`, `lib/club-shortcut.ts` |
| Tabs | `teams` is in the table with `tabbable: false` ("no index page until 4b-2"); order Home, House league, Teams, Past tournaments; `ORG_SECTION_TABS_MIN = 2`; availability needs the public-site module | `lib/org-public-sections.ts:33-36`, `lib/org-section-availability.ts` |
| Team page | Colour as a 4 px strip, h1 + division chip + Alumni chip, description, alumni notice, "Tryouts open" callout, `RepTeamPublicSchedule` (Public link only), Past seasons | `app/[orgSlug]/teams/[teamSlug]/page.tsx`, `components/public/RepTeamPublicSchedule.tsx` |
| Team groups | `rep_team_groups` + a team's group (also used for member scopes) | `docs/agents/db/DATA_DICTIONARY.md` (Rep domain) |
| Banner | `organizations.hero_banner_url` (`Organization.heroBannerUrl`), uploaded in the admin's Settings (the upload route is gated Tournament Plus and up); **no fixture sets one** | `app/api/admin/org-hero-banner/route.ts` |
| Fixture | `uat-rep-club`: nine teams (only 15U AAA has tryouts open; 18U AA archived; 9U AA draft), a house-league season open for registration, a tournament starting in 10 days, **no archives, no banner, no logo, no groups checked**. There is **no rep-only club** fixture for the first shape | `scripts/seed-club-fixture.mjs` |
| Guards a rebuild trips | `tests/unit/club-stage4a-guard.test.ts` §4 pins the seven shortcut pages including `teams` (move `teams` out of that list, and keep a test for whatever `/teams` does for a club without rep teams); §1 every club page asks the club rule. `tests/unit/club-frame-guard.test.ts` §3 no mono / "Sign In" on club pages, §4 every club page but the home exports `generateMetadata` through `clubPageMetadata` | read both before you start |

## What to build

1. **The home's two shapes**, in the ruled order, from data the club already has. Open now, the team grid (DC-01), House league,
   Tournaments with truthful status (S4-03), About the club. Absent sections are absent. Close the hero's repeated contact.
2. **The banner strip** on the desktop home only (Ask 7A), with `/design` settling height, crop and scrim. It needs a banner to
   test: **ask the owner** before adding one to the club fixture's seed (a seed change); the fallback is to upload one in the
   admin's Settings during the walk and remove it after.
3. **The Teams page at `/{org}/teams`**, the Teams tab, and the tab order. Decide what `/teams` does for an org whose plan has no
   rep teams (today's printed links and QR codes may rely on its forward into a running tournament: recommended, keep that
   forward for such an org), say why in a comment, and pin it in the 4a guard.
4. **The team page's recipe** (End state 3, without Coaches): "← Teams", the division and season line with the colour dot, the
   tryout door or the quiet "Tryouts" heading, the Schedule rework, About the team; no Past seasons. Desktop puts the schedule
   first.
5. **"See all teams"** on the in-club "not found".
6. **The five 4b-1 leftovers** (above).
7. **Words:** every new or changed visible word (Open now, the section headings, "About the club", the Tournaments status words,
   "Teams" and its count, "Tryout details and sign-up", "Earlier this season (N)", "Up next", "Show the rest of the season (N
   more)", "See all teams", the quiet tryout sentence) goes through `/marketing` **before** code. House rules: sentence case,
   "8:00 a.m." and "9:00–11:00 a.m.", the bare possessive, `npm run check:spelling`.
8. **The layout sweep:** add an anonymous `club-teams` screen beside 4b-1's five club screens (`scripts/layout-screens.mjs`), and
   a second home if you build a rep-only fixture.

## Fixtures

The first shape (rep only, nothing open, no Tournaments section) has no club to show it on. Find one on dev, or **ask the owner**
for a seed change (a rep-only club, team groups on `uat-rep-club`, a banner). Never seed or reseed without the owner's yes, and
never mid-sweep (a seed's password reset signs every saved account out).

## Before shipping: the demos

The tournament demo's club (`riverdale-minor-ball`) is public, so its home changes shape. Run `npm run check:demos` and check the
tour and dock lines (`lib/sandbox-chrome.ts`, `lib/demo-org.ts`) for any step that points at the home's old sections. Do not
re-seed production; a broken tour step is fixed in the tour.

## Definition of done

- **Tests written first and run red** (record the red run): the home's section order and absence rules (rep only / nothing
  open / rep + house league) as a pure function; the tournament status words against dates (today inside, before, after); the
  team grid's one-column fallback rule; the Teams tab's presence rule; the team page recipe's absences (no tryout, no Public link,
  no about); the `/teams` rule for a club with and without rep teams.
- `npm run typecheck` (run `npx next typegen` first), `npm run verify:changed`, the full `npm test` before the commit.
- The dev server restarted once at hand-off (new route, shared modules), then `npm run check:layout --changed` on the club
  screens at 361, 390, 768 and 1440. A whole-product sweep does not run on dev.
- `/design` (phone and desktop; a navy club and a yellow club; both home shapes) **before** the walk; `/simplify` then `/review`
  (high-risk: a new public route replacing a shortcut, and shared section rules).
- `/docs` for the public-site help (`lib/help-content/org.tsx`: the home's sections, the Teams page and tab).
- **An owner walk as a checkable Artifact, one purpose per walk.** It must include, on a phone, **the tab row staying pinned
  while the colour band scrolls away, with the new Teams tab in it** (the 2026-10-20 phone ruling had no step of its own in
  §350), and that no club page has a "← club" link back to the home.
- Records: the Club plan's Stage 4 ladder (4b-2a as built, with the commit), the TODO Stage 4 line, the project index
  (https://claude.ai/artifact/MBKRySURVFu3V9cZJvmjVr, `stages/s4` + one `log` row, read first, `if_version` on every write), memory
  `project_club_tier_readiness`, the Owner QA Ledger for the walk.

## Before any code

Per `AGENCY_RULES.md`: a short task list, then the product-manager summary (what a family sees on a rep-only club and on a club
with a house league, what a coach sees on their team page, what an owner sees; that tournament pages do not change). Ask the
fixture questions. Then build.

## Do not

- Build 4b-2b (the club Tryouts page and its tab, tryout days on any page, the "not open yet" and "finished" states, the home's
  single tryouts row, preview cards, the sitemap) or 4c (born-in years and the Born in picker, the Coaches section and the coach's
  switch, the club notice, the About page, "Contacts and documents", the editor and its section show/hide and order, the tryout
  blurb's editor), 4d or 4e.
- Change the frame 4b-1 built (bar, footer, colour roles, pinned phone tabs) except where a leftover above names it.
- Touch tournament public pages, the admin, the coaches portal, the volunteer desks, or the 4a refusal.
- Change a price, a plan or a gate; write customer copy without `/marketing`; write to production.
- Change shared agent automation or the database checks (`AGENCY_RULES.md`).

## Git

`git rev-parse --abbrev-ref HEAD` is `dev`. The tree is shared: other sessions leave files modified, and **another session's
commit can sweep your uncommitted edits in with theirs** — check `git show HEAD:<file>` before assuming yours are uncommitted.
**Before staging, read each file's diff and confirm every hunk is yours**: on 2026-10-20 the 4b-1 commit nearly swept in another
session's edits to the coach-side tryout days card, caught only because that session's guard test failed. Stage explicit paths
only; for a file that also holds another session's edits, commit through a private index (`GIT_INDEX_FILE`) built from HEAD plus
only your changes, verify that commit in an isolated worktree (typecheck + unit suite against its parent's failures), then move
`dev` with `git update-ref` and `git reset` just your paths. Confirm with `git show --stat HEAD`. **Commit only when the owner
says**, locally; do not push.
