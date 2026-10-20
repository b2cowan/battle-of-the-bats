# Club Tier Stage 4b-2b: tryout season, preview cards and the sitemap (build prompt)

> **Written 2026-10-20** by the Stage 4b-1 session, together with `CLUB_TIER_STAGE4B2A_BUILD_PROMPT.md`. **Start it only after
> 4b-2a is committed and its walk has passed**, in a new chat on `dev`, and re-verify every lead below first: 4b-2a changes the
> home, the Teams page, the team page and the tab table this stage builds on. Two owner rulings of 2026-10-20 shape it:
> - **4b-2 is split by season.** 4b-2a built the club as it is all year. **4b-2b (this prompt) is tryout season:** the club
>   Tryouts page and its seasonal tab, tryout days on a tryout page, the "not open yet" and "finished" states, the days lines
>   4b-2a left on the home and the team page, then **preview cards and the sitemap**, built last because they describe every page.
> - **Born-in years and the Born in picker move to 4c** with the place they are entered. The drawings put "Born 2015–2016" on
>   tryout rows and a "Born in: any year" picker on the Tryouts page: **build neither**, and make every page look finished
>   without them.

## What 4b-2b makes true

In tryout season a family finds **every tryout the club runs on one page**, grouped the way the club groups its teams, each team
saying by itself whether it is **open, not open yet or finished**. A tryout page lists **the actual tryout days** (date, time,
venue, directions) that coaches already enter, so the flyer-and-stale-post problem goes away: it all expires by itself. A link
to the club, a team or a tryout shared in a chat shows **a card in the club's colours**, and search engines find the club's teams.

## Read first

- **The drawings and the rulings:** https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k (source
  `docs/projects/active/CLUB_TIER_STAGE4_DRAWINGS.html`, ruled 2026-10-19). For 4b-2b read: the club Tryouts page (round 2,
  ~L1840–1869), End state 4 (`#e-tryout`, ~L1272–1372) and the finished frame (~L1902–1914), the home's single tryouts row
  (~L1792, ~L1805), End state 8 (`#e-share`, ~L1625–1649), Asks 5, 7, 14; R-01, R-06, S4-02, S4-04. Round 2 (~L1786 on) is later
  than round 1 where they differ.
- `memory/design_decisions.md`: 2026-10-19 "A CLUB'S PUBLIC SITE…" (the status words, ranges written "9:00–11:00 a.m.") and the
  2026-10-20 entries.
- `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 4: the 4b-1 and 4b-2a as-built records.
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **CLAUDE.md binds you: broad reading goes to a helper agent, and a helper's summary
  is a lead, not evidence.** The leads below were gathered on 2026-10-20 at HEAD `ad9bf26d8`, before 4b-2a.
- Next.js 16: read `node_modules/next/dist/docs/` on metadata, `opengraph-image` and `sitemap` before that work.

## The ruled spec (from the drawings; quote them, don't re-derive)

| Part | Ruled | Where |
|---|---|---|
| The club Tryouts page | Title **"2027 tryouts"**, the sub "Rep and Select teams for the 2027 season"; bands by the club's team groups with each group's date range ("Rep · Sep 7–9", "Select · Sep 11–13"); one row per team: the team, its first day and venue, its state chip (**Tryouts open** green · **Not open yet** grey, `.chip.wait` ~L1770 · **Finished**); the foot line "Questions? Email the club at …"; titled "2027 tryouts · {club}". **No born-in text, no picker** (4c) | Ask 14A, ~L1840–1869 |
| The three states | **Open:** sign-ups open (today's rule: the live season's `tryout_open`, team not archived). **Not open yet:** tryout days scheduled, sign-ups closed. **Finished:** the last day has passed. Each team is in its own state. Define the edges precisely (open but the last day passed; days cancelled; no days at all), test them, and ask when the drawing does not settle one | ~L1842, R-01 |
| The Tryouts tab | Third, after Teams: **Home · Teams · Tryouts · House league**. Present while any tryout is open, scheduled, or finished in the last four weeks. **The address keeps working all year** and says when the club's last tryouts were: that off-season state is **not drawn**, so draw it small and ask the owner before building it (as 4b-1 did with the staff door). The address is not named in the sources: recommended `/{org}/tryouts` (no route or shortcut uses it today) | ~L1842, ~L1800 |
| Tryout days | On a team's tryout page, under the heading **"Tryout days"**, above "From the club": one row per day, **"Sun, Nov 2 · 9:00–11:00 a.m."**, the venue and field ("Lakeshore Dome · Field 2"), a **44 px Directions** button. A cancelled day is left out. From `rep_tryout_sessions`, which coaches already fill | End state 4 ~L1288–1314, S4-04 |
| A tryout page's states | **Open:** "15U AAA tryouts", "For the 2027 season", "Tryouts open", the days, "From the club", **"Sign up for tryouts"**, the contact. **Closed:** "Tryouts closed", "13U AAA isn't taking tryout sign-ups right now.", the contact with Copy, **"See the team"**. **Finished:** "Finished", "Tryouts for the 2027 season finished on Mon, Sep 7.", the contact with Copy, "See the team" | ~L1288–1343, ~L1908–1914 |
| The sign-up form | The same questions; fields grow to 44 px, required fields carry an asterisk, the date of birth uses the device's own picker, the button wears the club's colour, the email box stays **unchecked** (CASL). Check what 4b-1 already did before changing anything | ~L1346–1372 |
| The days lines 4b-2a left | The home's Open now tryout row and the team page's tryout door gain their days line ("Three days from Sun, Nov 2 · Lakeshore Dome"). When **more than one** team's tryouts are open or scheduled, Open now shows **one** row instead: "2027 tryouts / 7 teams · Rep Sep 7–9 · Select Sep 11–13", the door to the Tryouts page. Round 1's "All 6 open tryouts" row is superseded by round 2. Ask 3 says Open now lists open things while round 2 lets this row carry "not open yet" teams: follow round 2 and say so | ~L1792, ~L1805 |
| Preview cards | One generated **1200 × 630** card for the club home, each team and each tryout, in the club's colour with its logo or initials, **never a player**; titles are 4b-1's "page · club". Drawn: home "Lakeshore Lynx / Rep baseball · ages 9 to 16"; team "15U AAA / Lakeshore Lynx · 2026 season"; tryout "Tryouts open / 15U AAA tryouts / For the 2027 season · from Sun, Nov 2". The drawing and its note disagree twice: the tryout badge (drawn **"Tryouts open"**, the note says "Sign-ups open": recommended the drawing, the product's word) and the team description (drawn "The team's schedule and tryouts.", the note says the about text: settle with `/marketing`). The card's domain is today's; a club's own address is 4e | End state 8, Ask 7A, S4-02 |
| Sitemap | Teams and open tryouts join the sitemap; each team described to search engines as **a sports team of the club, never its players** (structured data). Recommended also: the Teams page, and the Tryouts page while it has a tryout to show. 4e moves it to the club's own domain later | ~L1648, F02 |

## Verified state (leads, before 4b-2a; re-check)

| What | Then | Where |
|---|---|---|
| Tryout pages | Two states only: open ("Tryouts open", "Register for tryouts", the blurb) and not open ("Tryouts are currently closed", optional Contact us). No "not open yet", no "finished"; tryout days are **not shown publicly** | `components/rep-teams/TryoutLandingView.tsx`, `lib/public-tryout.ts`, `lib/season-live.ts` |
| Tryout days | `rep_tryout_sessions`: `starts_at`, `ends_at`, `location`, `location_address`, `field_number`, `label`, `org_venue_id`, `status` (scheduled / cancelled). Read today only by coach-side code | `docs/agents/db/DATA_DICTIONARY.md` (Rep domain), `lib/db.ts` ~L4701 |
| Old season pages | `tryouts/[yearId]` 404s for another team's season, forwards the live season to `/tryouts`, otherwise renders closed | `app/[orgSlug]/teams/[teamSlug]/tryouts/[yearId]/page.tsx` |
| Open Graph | Only the org layout sets an image (the logo, when there is one); club pages set none; `opengraph-image` files exist only under tournament routes | `app/[orgSlug]/layout.tsx`, `lib/club-page-meta.ts` |
| Sitemap | `app/sitemap.ts` lists club homes only (`lib/directory.ts` `getOrgSitemapEntries`); `app/robots.ts` blocks admin, coaches and the desks, not club pages | |
| Fixture | `uat-rep-club`: only 15U AAA has tryouts open; **no tryout days seeded**; no team "not open yet" or "finished" | `scripts/seed-club-fixture.mjs` |

## What to build

1. **The three states as one pure rule**, tested first, used by the Tryouts page, the tab, the tryout page, the home and the
   team page, so no two surfaces can disagree.
2. **The club Tryouts page** and its seasonal tab, without born-in. Draw and ask the off-season state first.
3. **Tryout days** on the tryout page, and the closed and finished states.
4. **The days lines** on the home's Open now and the team page's tryout door, and the home's single tryouts row.
5. **The sign-up form's polish**, where 4b-1 has not already done it.
6. **Preview cards** for the home, a team and a tryout (generated images in the club's colours), then **the sitemap** with
   structured data for teams.
7. **Words:** every new or changed visible word (the Tryouts page title and sub, the state chips, "Tryout days", "Sign up for
   tryouts", "See the team", the finished sentence, the off-season sentence, the card wording) goes through `/marketing`
   **before** code. House rules: sentence case, "9:00–11:00 a.m.", the bare possessive, `npm run check:spelling`.
8. **The layout sweep:** anonymous screens for the Tryouts page, a closed tryout and a finished tryout.

## Fixtures

The walk needs a team **open** with days, one **not open yet** (days ahead, sign-ups closed), one **finished** (days past), and a
cancelled day. None exists. **Ask the owner** before changing the club fixture's seed; never seed mid-sweep.

## Before shipping: the demos

Run `npm run check:demos`; check the tournament demo's tour and dock lines for any step on the club's tryouts. Do not re-seed
production.

## Definition of done

- **Tests written first and run red** (record the red run): the three-state rule and its edges; the tab's four-week window; the
  home's one-row-versus-many rule; cancelled days left out; the card never carrying a player's name; the sitemap's entries.
- `npm run typecheck` (run `npx next typegen` first), `npm run verify:changed`, the full `npm test` before the commit.
- The dev server restarted once at hand-off, then `npm run check:layout --changed` on the club screens at 361, 390, 768 and 1440.
- `/design` before the walk (the Tryouts page, the three tryout states, a card in a light and a dark club colour); `/simplify`
  then `/review` (high-risk: a public route, a shared state rule, generated images and the sitemap).
- `/docs` for the public-site and tryout help.
- **An owner walk as a checkable Artifact, one purpose per walk**, including the pinned phone tab row with Tryouts in it and a
  shared link's card checked in a real chat app or a preview tool.
- Records: the Club plan's Stage 4 ladder (4b-2b as built, with the commit), the TODO Stage 4 line, the project index
  (https://claude.ai/artifact/MBKRySURVFu3V9cZJvmjVr, `stages/s4` + one `log` row, read first, `if_version` on every write), memory
  `project_club_tier_readiness`, the Owner QA Ledger for the walk.

## Before any code

Per `AGENCY_RULES.md`: a short task list, then the product-manager summary (what a family sees in tryout season and out of it,
what a coach's entered days now do in public, what a shared link looks like). Ask the off-season drawing and the fixture
questions. Then build.

## Do not

- Build 4c (born-in years and the Born in picker, the Coaches section, the club notice, the About page, "Contacts and
  documents", the editor, the tryout blurb's editor), 4d or 4e.
- Change the frame 4b-1 built or the year-round pages 4b-2a built, beyond the days lines and the single tryouts row named above.
- Touch tournament public pages, the admin, the coaches portal (the coach's tryout setup is read, not changed), the volunteer
  desks, or the 4a refusal.
- Change a price, a plan or a gate; write customer copy without `/marketing`; write to production.
- Change shared agent automation or the database checks (`AGENCY_RULES.md`).

## Git

As 4b-2a's prompt: `dev` only; read every staged file's diff and confirm every hunk is yours; a private index for shared files,
verified in an isolated worktree before `dev` moves; **commit only when the owner says**, locally; do not push.
