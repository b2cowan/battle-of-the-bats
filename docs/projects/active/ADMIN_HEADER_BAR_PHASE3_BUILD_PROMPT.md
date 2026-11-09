# Build prompt — Admin header, Phase 3: the screens with no place of their own

> Written 2026-11-08, after walk §495 passed (22/22). Plan of record: `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`
> ("Phase 3" and asks A7–A10). One session for the DRAWING GATE + the build, pasted into a fresh chat (`/clear` first).
> If the build proves too big for one context, stop after a clean sub-group (see "Order") and say so; do not rush the rest.

---

Admin header: the bar names where you are — **Phase 3, the screens with no place of their own.** Product code. Both
widths: the screen names itself in the desktop strip (above 900px) and in the phone bar (900px and below), from the one
place model Phase 2D built.

## Read first, in this order

1. `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`: asks **A7–A10** (all ruled, 2026-11-07), "Round 4" D1–D5 (ruled
   2026-11-08), Phase 2's and 2D's as-built notes and lessons, **Phase 3's checklist**, "After this project" (not this
   session: it is the later navigation evaluation and the org-logo ask), the Architectural Decisions.
2. The drawings, for the three screen types already drawn: `docs/projects/active/ADMIN_HEADER_ROWS_DRAWINGS.html`
   (artifact https://claude.ai/artifact/DXmtj9E1SxcuyfyrcUnsuC, v4: Calendar, a child's page, a tournament-only org) and
   `docs/projects/active/ADMIN_HEADER_DESKTOP_STRIP_DRAWINGS.html` (round 4, B v2: the desktop strip). The phone bar's
   shape is walked and passed; the desktop strip's shape is walked and passed. Phase 3 fits more screens into BOTH.
3. The mechanism: `components/admin/useAdminPlace.tsx` (the one model; `onTournament`, `routePlace`, `isPageTitle`, the
   org-name fall-through at the bottom), `components/admin/AdminBarPlace.tsx` (`useClubPlaceAt`, `useHandBarPlace`, the
   `AdminBarPlace` type), `clubPlaceAt` + `ClubPlaceAt` + `ClubPlaceAccess` in `lib/admin-kit-nav.ts` (~650–770),
   `components/admin/kit/club/PlaceFrame.tsx` (`PlaceFrame` and `TabPageHeader`, the helper that drops the paper title
   and keeps the page's actions), `components/admin/AdminEventHeader.tsx`, `components/admin/AdminTopStrip.tsx`,
   `components/admin/AdminPageHeader.tsx` (props: eyebrow, crumbs, title, titleChips, actions, backTo, inlineActions).
4. `lib/tournament-context.tsx` ~121–130 (how a tournament is auto-picked) for the A10 fix.

Broad reading and censuses go to a helper agent (CLAUDE.md). A helper's claim is a lead, not evidence: open the cited lines.

## The census (done 2026-11-08, spot-checked; re-verify the lines you build on)

Today, every screen below returns `null` from `clubPlaceAt`, so the bar draws the **org's name in a `<span>`** (no back
link, no tabs) and the page's own paper `AdminPageHeader` is the only `<h1>`. None sits inside a place frame (frames never
use `AdminPageHeader`; a guard pins that).

| Screen | File | Paper heading today | Actions on it |
|---|---|---|---|
| Calendar | `app/[orgSlug]/admin/calendar/page.tsx` | title | phone-only **View** menu (A7: moves into the toolbar's first slot) |
| Schedules | `…/schedules/page.tsx` | title | none (its "New" button is in the body) |
| A schedule | `…/schedules/[scheduleId]/page.tsx` | backTo Schedules, state chip | none |
| Notifications | `components/notifications/NotificationsPageContent.tsx` | eyebrow "Organization", title | settings link, **Mark all read** (only when unread) |
| Rename team URLs | `…/rep-teams/rename-slugs/page.tsx` | crumbs (Rep teams is the only way back) | none (A9: gets "← Rep teams") |
| A team's History | `…/rep-teams/teams/[teamId]/history/page.tsx` | crumbs + backTo the team | none |
| One past season | `…/history/[yearId]/page.tsx` | crumbs, backTo History, status + year chips | "Read-only archive" note |
| A child's page | `components/admin/kit/club/families/ChildPage.tsx` | backTo household (`?from=`) or Families, born + season chips | **Split records** (2+ seasons only) |
| Tournaments list, tournament-only org | `…/org/tournaments/page.tsx` via `/admin/tournaments/manage` | title | New + help button |
| Tournament settings pages, tournament-only org | `…/tournaments/settings/**` (`page`, `payouts`, `notifications`, `event`; `members`, `pdf`, `registration-fields`, `subscription` NOT read) | title | help button on some |

**Found by the census, NOT in the plan's checklist. They need the owner's call at the gate (below):**

| Screen | File | Today |
|---|---|---|
| House league › Seasons list | `…/house-league/page.tsx` | eyebrow "House league", title "Seasons"; **Create season** (lime, icon-only on a phone, `canRun` only) |
| A club schedule inside a season | `…/house-league/seasons/[seasonId]/club-schedule/[scheduleId]/page.tsx` | eyebrow, schedule name, backTo the season. A record page |
| Public site | `…/public-site/page.tsx` | title + Online/Offline chip; address row with Copy/Open below it |
| Plan & billing | `components/admin/kit/club/BillingKit.tsx` | eyebrow, title (owner-only; "no tab" by ruling) |
| Club setup (onboarding) | `components/admin/kit/club/ClubSetupKit.tsx` | "Get {org} ready for the season" |

Not Phase 3: any `TabPageHeader` user (Org and Permits frames, MembersKit, SettingsKit, the venues/board/pdf pages: all
inside a frame), `accounting/teams/[teamId]` (ruled 2026-10-16: a view of Accounting › Teams), the tournament EVENT pages
(`TournamentAdminUI`; they already take the bar's shape) and the coaches portal.

## What this session changes

1. **Static-name screens become flat places by address.** Calendar, Schedules, Notifications, the Seasons list, the
   Public site (and, if ruled, Plan & billing / Setup) get an entry in `clubPlaceAt` with a title and no tabs. The bar's
   and strip's name is then the page's one `<h1>` (`isPageTitle`), and the paper `AdminPageHeader` goes, replaced by
   `TabPageHeader`-style handling so the page's actions stay at the page's top-right (A8). **Each entry carries the
   screen's own access gate in `ClubPlaceAccess`** (the lesson from Phase 2 session B: a client gate that mirrors a
   server layout must carry every server-only input, or the bar names a place over its refusal). Check how each page
   refuses today (`NotYoursScreen` on Calendar and Schedules is pinned by a guard) and keep the refusal's heading honest:
   a refused page should not show a bar naming a place it will not open.
2. **Record pages get a back link in the bar and a name that arrives from data.** A schedule, a child, a past season, a
   club schedule: the address gives a placeholder and the back link; the page hands over the live name through
   `useHandBarPlace` (same key rule as the frames: the bar takes a hand-off only for the address's key, so there is no
   first-paint flash). History and Rename team URLs have static names, so the address alone serves. A child's back link is
   dynamic (`?from=` household or Families): the hand-off carries it. Facts become words on the small line **on a phone**
   (A8: a date of birth becomes "Born Mar 3, 2014"); the desktop strip has no small line (D1, D3), so on desktop the chips
   (born, current season, status) go beside the name as a place's status chip does. Draw that, do not guess.
3. **The A9 back link.** Rename team URLs: "← Rep teams" in the bar. History: back to the team (the team's name, as today).
4. **A10, tournament-only orgs.** `/admin/tournaments/manage` and `/admin/tournaments/settings/*` name the **organization**,
   not the auto-picked event: change what counts as "on a tournament" in `useAdminPlace` (`onTournament` is currently any
   path under `/admin/tournaments` except preview, with a current tournament) so those two prefixes are org screens. ⚠
   Check that no EVENT page lives under those prefixes, and what the same prefixes do inside a CLUB org (the club's list
   is `/admin/org/tournaments`, a different path). The rule the owner gave: event pages name the event; org-wide screens
   (list, Settings & access, Members, Plan & billing) name the org. The sidebar picker keeps the event on screen.
5. **Actions.** Calendar's phone View menu goes to the first slot of the Calendar toolbar, keeping its shipped ghost-glyph
   look (A7). Every other action keeps its place at the page's top right, now on a row with no heading beside it. No
   action goes into the strip or the bar (neither has an actions slot; do not add one).
6. **One `<h1>` per width, always.** The bar/strip name is the `<h1>` for a place; the paper heading is removed on exactly
   the screens that became places. A screen that did not become a place keeps its paper `<h1>` and the org name stays a
   `<span>`. The layout sweep's `ready: 'h1'` waits keep working only while exactly one h1 shows at a time: re-check each
   entry (`scripts/layout-screens.mjs`: admin-notifications, admin-calendar, admin-schedules, admin-rep-rename-slugs,
   admin-rep-team-history, history-year, the child page, the tournament-only entries).

## Gate before building (blocking): what is not yet drawn

Drawn and ruled: Calendar's toolbar (A7), a child's page (A8), Rename team URLs (A9), a tournament-only org (A10). **Not
drawn on any round:** Schedules (list and a schedule), a team's History and one past season, Notifications, the Seasons
list, a club schedule, the Public site, Plan & billing, Setup. The project's own rule is that the owner sees a screen
type drawn before it is built.

1. Present the **product-manager UX summary** (CLAUDE.md/AGENCY_RULES; blocking): what an admin sees differently on each
   screen at both widths, what does not change, and the role differences (head coach vs club admin vs treasurer; owner-only
   billing).
2. Use `/design` to publish ONE short drawing round as a Claude Artifact (HTML page, never the canvas; house layout;
   true size; the shipped components, not redrawn controls) covering only the undrawn types, desktop + phone, with the
   Screen switch. Every highlight clickable, and `/design` run on it BEFORE hand-off. Questions for the owner, each with a
   recommendation:
   - **Q1 · Plan & billing and Club setup:** become named places (recommended for Billing: it is an org-wide screen the
     owner opens from the account menu, A10's rule names it) or keep their paper heading? Setup is a one-time onboarding
     page: recommend it keeps its own heading, and that it stays out of Phase 3.
   - **Q2 · The Seasons list:** a flat place named "Seasons" with the **Create season** button on the page's top right
     (recommended), the club's name not shown on desktop (D1).
   - **Q3 · The Public site:** the address row with Copy/Open is body content and stays; the Online/Offline chip moves
     beside the name. Confirm.
   - **Q4 · A record page's chips on desktop**, as in item 2.
   - **Q5 · A refused page:** show the bar's place name over a refusal, or the org name (recommended: the org name, since
     the place never opened).
3. Wait for the owner's rulings. Record them in the plan (a "Round 5" section, same shape as round 4). Then build.

## Order (if the session must stop, stop on a seam)

1. The mechanism: new `clubPlaceAt` entries (flat and record), the access inputs, the A10 change, tests in
   `tests/unit/admin-kit-nav.test.ts`. 2. Static-name screens (Calendar, Schedules, Notifications, Seasons list, Public
   site, History, Rename). 3. Data-named record pages (a schedule, a child, a past season, a club schedule). 4. A10.

## Gotchas

- **CSS split at 900/901px, never `matchMedia`** (a JS switch paints the wrong rendering on the server's first paint).
- **Shared stylesheets**: `CoachTopStrip.module.css` and `HubTabBar.module.css` serve the coaches portal. Opt-in classes
  only; measure the portal's strip and tab row before and after: identical. The coaches portal does not change.
- **No first-paint flash**: the address gives the place, the hand-off gives live parts for the SAME key only
  (the Phase 2 session A decision). A page that loads its record by data must show the placeholder and back link at once,
  then the name; never the org name then a swap. Decide the placeholder per screen ("Schedule", "Child", the program year).
- **The Families frame steps aside for the child page** (`isFamiliesChildPage`, `child-page.test.ts:240`, comment
  "Phase 3 gives it its own bar"). The child's page must not lose its access gate when it gets a bar: the bar must not
  name a child's page the viewer cannot open (group-limited members; `limitedToTeamGroups` rides the org context).
- **`?from=` back links** are data, not an address: the bar's back link must read the same query the paper's `backTo` read.
- **Guards to rewrite to the new rule, not delete**: `club-stage13i-places-guard` (the "record pages keep their own back
  arrow" lines require `backTo=` / `<AdminPageHeader` on history, rename-slugs and the club-schedule page: Phase 3 breaks
  all three), `child-page.test.ts` (the step-aside block), `admin-kit-nav.test.ts` (record pages are `null` at ~519, 548,
  557), `admin-header-bar-guard` (the frame loop, the exact `useClubPlaceAt` source), `club-stage1-screens-guard` (the
  `isPageTitle` lines, if that expression changes), `club-stage13a-doors-guard` (the `NotYoursScreen` returns on Schedules
  and Calendar), `toolbar-rules-guard` (the Calendar and Schedule toolbars: read it first for the View menu move),
  `plan-billing-*` (they mock or forbid `AdminPageHeader`), `notification-open-in-place-guard`. Add one: every screen that
  became a place has no paper `AdminPageHeader`, and every screen that did not still has exactly one.
- **Type check** (`scripts/check-admin-type.mjs`): do not raise the baseline or edit the script.
- **Layout checker**: `check:layout --changed` on the touched screens only, dev server; the whole-product sweep is a
  release step on staging. Phase 2's sticky census applies: a screen whose own sticky parts (Schedules' day bands, the
  Calendar's week jump) now sit under a different header height is a defect.
- **Demos**: `npm run check:demos` (a tour anchor on a removed paper heading fails the build; the census found none, but
  prove it).
- **Words**: no new customer words expected. A record's "Born Mar 3, 2014" must be built with `formatStoredDate`; clock
  times with `formatTime` only. `npm run check:spelling`. Plan names and prices are not touched.
- **Shared working tree**: other sessions have uncommitted hunks (`TODO.md`, the ledger, several club kits). Read the live
  file; change only your hunks. Stage explicit pathspecs; never `git add -A`.
- **Dev server**: new files / shared modules, so restart before hand-off (AGENTS.md); only `npm run dev`; stop it before
  deleting `.next` on Windows. `npm run typecheck` sits near the 4 GB heap (`NODE_OPTIONS=--max-old-space-size=8192`).
- **`.tsx` files can be CRLF in the working tree**: a Node edit script must normalize `\r\n` before matching; regex-bearing
  edits go through the Edit tool, not a heredoc.

## Steps

1. The gate above (UX summary, drawing round, rulings recorded in the plan).
2. Build in the order above. After each seam: `npm run verify:changed`.
3. `npm run typecheck`, `npm run check:spelling`, `npm run check:demos`, `npm run check:layout --changed` on each touched
   screen at 1440 and 390 (dev server). Do not launch a sweep against a server used for something else.
4. **Measure and report**: each touched screen's pinned height at 1440×760 and 390 before/after; one `<h1>` per width
   (accessibility tree); the strip at 901px with the longest name each screen can show; the coaches portal strip + tab row
   (identical); the phone bar on screens Phase 3 did not touch (identical); a first load with a throttled network on the
   data-named record pages (placeholder, then the name, no org-name flash).
5. `/design` on the built screens against the round-5 drawings; apply its fixes. Offer `/simplify` (a second kind of place
   is new abstraction risk) and then `/review`.
6. Check the help articles that describe these headers (`lib/help-content/*.tsx`: Calendar, Schedules, Notifications,
   History, Families); offer `/docs` where a line now reads wrong. (Phase 4 does the full help sweep.)
7. Write the owner walk as a checkable Artifact (QA ledger § next in line, never re-sort the §numbers; one purpose: the
   bar on the Phase 3 screens), desktop-first with a phone pass. Tick Phase 3's boxes in the plan with what was built and
   the measurements; update the TODO.md line and project memory with the positive fact ("built 2026-MM-DD").
8. **Do not commit without asking me.** On my yes, the commit takes only this session's files, built in a private index on
   the current HEAD (see the memory note on partial commits).

## Done when

- Calendar, Schedules, Notifications, History, Rename team URLs, the Seasons list and the Public site (and Plan & billing if
  ruled) name themselves in the strip on desktop and the bar on a phone; the paper heading is gone; their buttons sit at
  the page's top right; Calendar's phone View menu is the toolbar's first slot.
- A schedule, a child, a past season and a club schedule show a back link and their own name in the bar, with no org-name
  flash; Rename team URLs shows "← Rep teams".
- A tournament-only org's list and settings pages name the organization, never an auto-picked event; an event page still
  names the event.
- A refused page does not show a bar naming a place it did not open.
- No page has two `<h1>`s; every `ready: 'h1'` wait still holds. The coaches portal and the screens Phase 3 did not touch
  are unchanged (measured). Guards, typecheck, spelling, demos and the changed-screen layout check pass; `/design` and
  `/review` findings are applied or recorded.
