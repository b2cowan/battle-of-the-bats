# Club Tier Readiness, Stage 4f: a Tournaments tab in the club's top row (build prompt)

> **Written 2026-10-25**, the day the drawings were ruled. **Paste this into a new chat on `dev` and re-verify every lead
> first**: the leads below come from the drawing session's code reading and measurements, so this prompt names **files, not
> lines**. Other sessions share this working copy (TODO, the Club plan, the PM brief, the ledger and the design log carry their
> edits): stage explicit paths only and commit only your own hunks (a private index when a shared file holds other edits).
>
> 4f is **one small stage**: one new public page, one tab, one editor change and three small fixes. Build it in **two parts**,
> each committed locally after its own checks. Nothing here needs a migration (see "No migration" below; confirm it).

## What 4f makes true

A family on any page of a club's site, a team page included, sees **Tournaments** in the club's tabs, taps it, and gets the
club's tournaments on one page: what is running and coming up, then what has finished, each one tap from its own site (or its
archive page). The separate **Past tournaments** tab retires; its list lives on the new page. On a phone, the tab you are on is
always scrolled into view. The club's admin shows or hides all of it with the **Tournaments** switch they already have in the
Public site editor; **Past tournaments** becomes a sub-option under it. A club whose plan does not carry tournaments sees no
change.

## The rulings (do not reopen; record nothing they did not rule)

Drawings: https://claude.ai/artifact/1nytYV7uYwY56eg6iM7h6K (source `CLUB_TIER_STAGE4F_DRAWINGS.html`; today's captures in
`club-tier-stage4f/`). Plan: `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 4, the "⚖ 4f RULED" line. Design log
2026-10-25 entry. Words: **`CLUB_TIER_STAGE4F_COPY.md`** (draft until the owner's yes; it wins over the drawing's words).

- **2026-10-24 (owner):** a Tournaments tab, only while the club has a tournament, switchable in the Public site editor.
- **2026-10-25, all seven asks option A:**
  1. **One Tournaments tab holds current, upcoming and past.** The Past tournaments tab retires (amends the 2026-10-19 Stage 4
     "Names" line); "Past tournaments" stays as the page's past heading and the editor's sub-option.
  2. **The home's Tournaments section is unchanged** (running + coming + 30 days finished, no cap, no "All tournaments" link).
  3. **No new switch.** The Tournaments switch covers the home section, the tab and the page. **Owner's change:** Past
     tournaments is a **sub-option under Tournaments, available only while Tournaments is on**; while Tournaments is off it is
     **absent** (not greyed), and it returns with its last setting.
  4. **A finished tournament nobody archived** is listed under Past tournaments, opening its own site, until it is archived.
  5. **The phone tab row scrolls the current tab into view** on opening a page (no motion when it is already in view).
  6. **`/tournaments`.** The old Past tournaments address forwards to the page's past part; each archived tournament keeps its own
     address; an archived tournament's page **lights the Tournaments tab and drops "← Past tournaments"**.
  7. **The tab sits where the editor's Tournaments row sits** (default after House league), like every other tab.
- **Not 4f:** the tournament-to-club link and the tournament's own pages (Public tournament site review); Stage 13's navigation
  check (it now lists 4f as a door; nothing to do here).

## Before any code (Part 0)

1. **Two read-only production counts**, reported to the owner before Part 2 ships (a count is a report, not a change):
   - tournaments whose slug is `tournaments` (any org). A club page at `/{org}/tournaments` would hide one. Dev has none.
   - `org_public_site_content` rows with `tournaments` in `home_sections_hidden` and `archives` **not** in it ("tournaments
     hidden, past shown"): the ruling removes that pairing. Dev has none. If prod has any, the owner decides what those clubs
     show before the change.
2. **Words:** get the owner's yes on `CLUB_TIER_STAGE4F_COPY.md` (or take his edits). No string is typed before that.
3. **Confirm "no migration":** the editor stores order and hidden keys in `home_section_order` / `home_sections_hidden`, whose
   CHECK already allows `tournaments` and `archives`. Keep both keys; `archives` simply means the sub-option. If anything needs a
   column, stop and say so (schema = dictionary + snapshots, same unit of work).

## Part 1 · The page, the tab and the row (public side)

Leads (re-verify):
- **Tab table** — `lib/org-public-sections.ts`: replace the `archives` tab with `{ key: 'tournaments', label: 'Tournaments' }`.
  `activeOrgSectionKey` must light Tournaments on `/tournaments` **and** on `/archives/{id}` (archive pages). Its tests:
  `lib/org-public-sections.test.ts`, `tests/unit/club-stage4b2a.test.ts`, `tests/unit/club-stage4c1.test.ts`.
- **When the tab shows** — `lib/org-section-availability.ts` (`resolveOrgSections`): the plan carries `module_tournaments`, the
  club has not hidden `tournaments`, and the page has something to show: a current/upcoming tournament, **or** (sub-option on)
  a finished-not-archived one or an archive. Yes/no questions only (`head: true` counts), failing quiet and closed, as the file
  already does. A draft never counts; status `archived` tournaments are represented by their archive row, never twice (confirm
  every `archived` tournament has a `tournament_archives` row).
- **The club's list of its own pages, twice:** `lib/consumer-routes.ts` (`ORG_PUBLIC_SECTIONS`) **and** `lib/club-host.ts`
  (`PUBLIC_SECTIONS`, the club's own web address). Add `tournaments` to both, or the router reads `/tournaments` as a tournament
  slug and the club's own address refuses it. Their tests: `lib/consumer-routes.test.ts`, `tests/unit/club-host.test.ts`.
  Also check `app/sitemap.ts` (the club's pages in the sitemap) and `lib/public-club-access.ts` (`PAGE_MODULE`: the new page
  needs the tournaments module, as `archives` does today).
- **The new page** — `app/[orgSlug]/tournaments/page.tsx`, in the Teams page's and today's archives page's shape:
  `forwardToOwnAddress`, `requirePublicClubPage(orgSlug, 'tournaments')`, `clubPageMetadata` ("Tournaments · {club}"), the
  club kit. Phone rows; at a desk **two tables** (current: Tournament · Dates · Status; past: today's six-column archives table).
  - **Current and upcoming:** running + coming, soonest first, with the home's chip rule (`tournamentHomeStatus`,
    `TOURNAMENT_STATUS_WORD` in `lib/club-site-home.ts`) and its date format. Reuse the home's tournament read
    (`lib/club-home-data.ts`) rather than writing a second one.
  - **Past tournaments** (only while the sub-option is on): finished, not archived (status `completed`, or `active` with its last
    day behind the club's today), **newest end date first**, opening the tournament's own site; then archives
    (`getArchivesByOrg`), **newest season first**, opening `/archives/{id}`. An archive keeps no event dates, so the two are
    not interleaved. A not-yet-archived row's division, champion and counts read "—".
  - A part with nothing in it is absent. With no parts at all the page is the club's "not found" page (the tab is absent too).
  - If the tournament read fails, show the club's error, never an empty page that says the club hosts nothing.
- **The old address** — `app/[orgSlug]/archives/page.tsx` becomes a forward to `/tournaments#past` (permanent; the own-address
  forward first, as every club page does). `app/[orgSlug]/archives/[archiveId]/page.tsx`: remove "← Past tournaments"; nothing
  else on it changes.
- **Current tab into view** — `components/public/OrgSectionTabs.tsx`: on mount, if the current tab is not wholly inside the
  phone row, scroll the row just enough to show it (instant under reduced motion; no motion when it is in view). Desk tabs sit in
  the band and do not need it.
- **Admin link that names the old address** — `components/admin/tournament/TournamentRecord.tsx` links `/archives/{id}` (still
  valid; leave it). Grep `archives` across `app lib components scripts tests` for any other list or test that names the tab.
- **Fixtures and sweeps:** `scripts/layout-screens.mjs` lists the archives page; add the Tournaments page. A fixture club with a
  current tournament, a finished-not-archived one and an archive is needed for the walk (`uat-rep-club` has one coming
  tournament and no archive): ask the owner before reseeding anything; a seed's password reset signs saved sign-ins out.

Checks: the touched unit tests red-first where a rule changes; `npm run verify:changed`; `npm run typecheck` (routing + shared
modules); `check:layout --changed` on the new page and the home at 390/1440. New files and a shared routing module: **restart
the dev server** before the owner's browser check. Commit Part 1 on its own.

## Part 2 · The editor

Leads (re-verify):
- `lib/club-site-sections.ts`: `editorSectionRows` — Past tournaments (`archives`) is no longer a draggable row; it is a
  **sub-option** emitted directly under Tournaments (no number, no handle), and **only while Tournaments is shown**. Its order
  slot is kept in storage but decides nothing. New state lines per the copy doc (Tournaments: has current / none current but
  past showing / nothing / hidden; Past tournaments: n past / none yet / hidden). `reorderedSections` must keep `archives` where
  it is. The card's opening line changes (copy doc §B).
- `app/[orgSlug]/admin/public-site/page.tsx` (Home page row; `ReorderList` and its `fixedInert`): render the sub-option
  indented under Tournaments, outside the drag order; hide it while Tournaments is off; switching Tournaments back on shows it
  with its stored setting. Phone: the same rows at full width.
- The home's preview (the admin preview page) follows the switches as today; nothing new there.
- Tests: `tests/unit/club-stage4c1.test.ts` and `tests/unit/club-stage4c1-guard.test.ts` (rows, order, hidden).

Checks as Part 1; commit Part 2 on its own.

## After the build

1. Offer `/simplify` (a new page beside an old one invites a second copy of the archive row) then `/review`.
2. **Write the owner's walk** as a checkable Artifact (one purpose, paste-back; check the QA ledger's last § right before taking
   a number): the tab on a team page at 390 and 1440 (and 1,024: five tabs fit); the page in its states (current only, one of
   each, past only, nothing → not found); a finished-not-archived tournament listed; an archive page with the tab lit and no back
   link; the old address forwarding; the club's own address (if a dev domain is connected); the editor's sub-option appearing and
   disappearing with Tournaments, keeping its setting; a plan without tournaments seeing nothing.
3. Offer `/docs` (copy doc §D: the public-site editor article and any article that says "Past tournaments tab").
4. Records, same unit of work: plan §6 Stage 4 (4f built, commits), TODO, PM brief, index `stages/s4f` + a log row, the
   auto-memory file. Demos follow the product: the build fails if a demo tour points at a destination that stopped existing,
   so a tour that opens `/archives` either still lands (it forwards) or is updated in the same commit.

## Do not

- Reopen a ruling, the tab row's look, the home section or the chips.
- Touch the tournament's own pages, the club-to-tournament link, or Stage 13's navigation.
- Add a migration, change shared automation or hooks, or write to production (the two Part 0 counts are read-only).
- Promise timing anywhere.
