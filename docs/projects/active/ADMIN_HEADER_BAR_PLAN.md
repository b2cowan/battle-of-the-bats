# Admin header: the bar names where you are — Implementation Plan

> **Status:** Planning (drawings ruled 2026-11-07; asks A2–A4 open)
> **Created:** 2026-11-07
> **Branch:** dev
> **PM brief:** [ADMIN_HEADER_BAR_PM_BRIEF.md](ADMIN_HEADER_BAR_PM_BRIEF.md)
> **Drawings:** [ADMIN_HEADER_ROWS_DRAWINGS.html](ADMIN_HEADER_ROWS_DRAWINGS.html) · artifact https://claude.ai/artifact/DXmtj9E1SxcuyfyrcUnsuC
> (v1 = round 1, four options; v2–v3 = round 2, option 4 on Overview, Rep teams, a season and a tournament)

## Goal

The admin's pinned white bar (`AdminEventHeader`) stops naming the one thing that never changes for a club
admin, the club, and names **where you are**. On the club's Overview that is the club. In a club place with
tabs (Rep teams, a house-league season, a team, Accounting, Families, Organization) it is that place, and the
place's tab row pins **inside** the bar. Inside a tournament it is the event, as today. A small line under the
name carries the facts (the club on desktop, the section, dates, status). The bar never shrinks on scroll. The
place's heading on the paper goes, so each screen has one title instead of two.

## PM Brief

See [ADMIN_HEADER_BAR_PM_BRIEF.md](ADMIN_HEADER_BAR_PM_BRIEF.md).

## Owner rulings (2026-11-07, from the drawings)

Recorded as ruled; nothing added.

1. **Option 4.** The pinned bar names where you are. Club Overview → the club's name is the title. Club places
   with tabs → the place's name, with the club on a small line under it on desktop, and the tab row pinned
   inside the bar on every place. The bar never collapses on scroll.
2. **Tournaments take the same shape** ("a very minor change for tournaments, looks good"). The small line
   moves from above the event's name to under it; no collapse. Tournament page titles (Teams, Schedule…) stay
   on the paper.
3. **The word "Overview" stays.** No rename to "Home"; the owner meant that Overview is effectively the home
   screen, which is why the club's name heads it.

## Open asks (recommendations, NOT ruled)

- [ ] **A2 · A season's / tournament's status on a phone.** (a) a second line in the bar, "House league ·
  Registration open" / "Nov 28–29, 2026 · Open" — **recommended**; (b) one line, status beside the name (the
  name truncates); (c) status only on the season's Overview tab (scrolls away). Both drawn (phone-bar switch).
  Knowingly departs from the 2026-09-21 one-line phone masthead ruling (coaches portal) if (a).
- [ ] **A3 · Overview's "Overview" heading on the paper goes** (the bar names the club). Recommended yes.
- [ ] **A4 · Desktop: the club's name on the small line under every place.** Recommended yes. Phones leave it
  off, so on a phone the club's name shows only on Overview.

## Rulings this knowingly departs from (reference, decided on merit 2026-11-07)

- **2026-08-25, "the phone title band stays"** (`memory/design_decisions.md`): the coaches portal kept the page
  name out of its masthead because "an identity bar whose identity gives way to a page name has stopped being an
  identity bar". The owner chose a different model for the admin: the bar is a *where-you-are* bar, not an
  identity bar, and the club's identity is carried by Overview and the desktop small line. The portal is
  unchanged.
- **2026-09-21, one-line phone masthead** (portal): applies only if A2 = (a).
- **2026-08-19, pinned tab bar reversed**: its reason (shared chrome behaving differently on one tab) holds, so
  pinned tabs are **every place or none**. Never per screen.

## Phases

> Sequenced by dependency and rework risk. Each phase is one session-sized chunk with its own /review and walk.

### Phase 0 — Drawings for the screens not yet drawn (mockup gate, before Phase 2/3 code)

- [ ] Draw, in the same artifact (new round), the whole screen before/after at true size, phone + desktop:
  - [ ] a **team** inside Rep teams (`TeamFrame`, its own back link and five tabs)
  - [ ] **Accounting** (up to nine tabs pinned in the bar, phone)
  - [ ] **Calendar** (no place; the bar says "Calendar"; where its view menu goes)
  - [ ] a **record page** one level down with its own back link (e.g. Rename team URLs, a child's page in Families)
  - [ ] a **tournament-only org** (no club hub; what the bar says on its non-tournament screens)
- [ ] /design pass on the round before hand-off; owner rules A2–A4 and any new asks.

### Phase 1 — The bar's new shape (shared; tournaments land here)

- [ ] `components/admin/AdminEventHeader.tsx` + `components/admin/kit/AdminKitEventHeader.module.css`:
  - [ ] the small line moves **under** the name, in the coaches portal's meta voice (`.teamHeaderMeta`:
        `--font-data`, `--type-label`, normal weight, no tracking, `--text-tertiary`, dot separators drawn
        between siblings); the status chip rides that line
  - [ ] **remove the scroll collapse** (the `collapsed` state, `.collapsed` rules, the second chip copy
        `chipCollapsed`, `compact` on the FlipPill); the bar holds still at every width
  - [ ] the portal masthead recipe for padding (0.5rem desktop / 0.45rem phone) with the 4px tap overhang
        on the 44px controls (globe, back, switcher) so the bar does not grow to the tap floor
  - [ ] phone: per A2 (second line / inline chip / none)
  - [ ] the tournament name keeps its link to the dashboard
- [ ] Overview (`components/admin/kit/club/ClubHubKit.tsx`): per A3, drop the paper `AdminPageHeader
      title="Overview"`; give the first content 1rem from the bar on a phone (the portal's masthead gap).
      ⚠ The "What's new" note (docs/projects/active/WHATS_NEW_HOME_PLAN.md, Stages A–C built 2026-11-07 by
      another session) sits directly under that heading today; it becomes the first thing under the bar. Read
      that plan's state before touching `ClubHubKit.tsx` and keep the note's placement as that plan rules it.
- [ ] Heading semantics: on club screens the bar's name is the page's `<h1>`; inside a tournament the bar's name
      stays a link and the page's own title stays the `<h1>`. Write this rule in the component header.
- [ ] `--admin-header-h` keeps publishing the bar's height (it now changes only on navigation, not on scroll)
- [ ] Guards: update/extend the unit tests that pin the header's shape (`tests/unit/nav-standard-guard.test.ts`,
      `tests/unit/club-stage13i-places-guard.test.ts`, any AdminEventHeader collapse test)

### Phase 2 — Places hand their name, facts and tabs to the bar

- [ ] **The hand-off mechanism** (architectural decision below): a context provided by `app/[orgSlug]/admin/AdminChrome.tsx`
      that a place frame fills with {title, back link, switcher, small-line facts, status chip, tabs}; the bar
      renders it, falling back to the club's name. No flash of the club's name on a place screen: the bar
      knows the place from the route before the frame's data arrives, and shows the frame's placeholder name
      in the same line (as `PlaceFrame` already does), so nothing shifts.
- [ ] `components/admin/kit/club/PlaceFrame.tsx`: stop drawing `header` + `HubTabBar` on the paper; register them
      with the bar instead. `TabActions` / `TabPageHeader` unchanged (a tab's own actions stay on the tab).
- [ ] `components/shared/HubTabBar.tsx` + `.module.css`: an **in-bar variant** (no bottom border of its own; the
      overflow fade and chevron paint the card white, not paper). ⚠ Shared with the coaches portal: a new prop,
      the portal's look unchanged.
- [ ] Frames, each verified on its own screens:
  - [ ] `RepTeamsFrame.tsx` — "Rep teams"; six tabs + waiting counts
  - [ ] `SeasonFrame.tsx` — back "Seasons", the season's name, the switcher, the status chip; seven tabs
  - [ ] `TeamFrame.tsx` — per the Phase 0 drawing
  - [ ] `money/AccountingFrame.tsx` — per the Phase 0 drawing
  - [ ] `families/FamiliesFrame.tsx`, `OrgFrame.tsx`
- [ ] In-page sticky elements re-anchored below the taller bar (`top: var(--admin-header-h)`): census every
      `position: sticky` under the club admin (known: the draft pool bar and column head in
      `league/teams/Teams.module.css`, `LeagueSeason.module.css` `.groupHead`, Accounting's `MoneyMonthGrid`
      head, Schedules' day bands) and fix the ones that sit in the page scroller.

### Phase 3 — Screens with no place of their own

- [ ] Calendar (`app/[orgSlug]/admin/calendar/page.tsx`), Schedules (`schedules/page.tsx`, `schedules/[scheduleId]/page.tsx`):
      the bar names the screen; the paper heading goes; the heading's actions (Calendar's phone view menu,
      Schedules' own) move to the page's toolbar per the Phase 0 drawing
- [ ] Record pages with their own back link (`rep-teams/rename-slugs`, `rep-teams/teams/[teamId]/history`,
      `families/ChildPage.tsx`, `accounting/teams/[teamId]`): per the Phase 0 drawing
- [ ] Notifications and the other admin pages that call `AdminPageHeader` outside a frame (census from the grep of
      `AdminPageHeader` under `app/[orgSlug]/admin/**` minus the tournament tree)
- [ ] Tournament-only orgs: what the bar says on their non-tournament screens (Phase 0)

### Phase 4 — Words, help, demos, verify

- [ ] `/docs`: help articles that describe the header, the Overview heading or "scroll back up to the tabs"
      (`lib/help-content/*.tsx`), incl. `keywords` / `searchText`
- [ ] Demo tours: `npm run check:demos` (a tour anchor on a removed paper heading fails the build; move the anchor)
- [ ] `npm run check:spelling`, `npm run verify:changed`, `npm run typecheck` (shared module + shell change)
- [ ] `npm run check:layout --changed` on the touched screens (dev server); the whole-product layout sweep runs as
      the release step on staging (`/release` §1d-5), not on the dev server
- [ ] /design pass on the built screens against the drawings; /review
- [ ] Owner walk as a checkable Artifact (QA ledger §), phone + desktop, one purpose: the bar on every screen type

## Architectural Decisions

- **Decision:** the bar stays ONE component (`AdminEventHeader`) mounted once by the shell; places fill it through
  context rather than each frame drawing its own sticky bar. **Rationale:** one sticky element per screen (two
  stacked sticky bars fight over `top`), one height to publish, and the tournament side keeps working unchanged
  through the same component.
- **Decision:** the tab row is pinned on every place or none. **Rationale:** the 2026-08-19 reversal (shared
  chrome must behave the same on every tab).
- **Decision:** no scroll collapse anywhere, tournaments included. **Rationale:** owner ruling 2026-11-07; the
  collapse made content jump under the thumb (the portal removed it 2026-09-21), and on a tournament it bought
  almost nothing (measured: 61px today vs 59px in the drawing).
- **Decision:** the coaches portal is untouched. **Rationale:** its bar names the team a coach lives in; the
  admin moves between places. `HubTabBar` changes only by an opt-in prop.
- **To settle in Phase 2:** how the bar knows the place before data arrives (route → place map from
  `lib/admin-kit-nav.ts`, which already resolves the place and its tabs from the path, vs the frame registering on
  mount). Requirement: no visible swap from the club's name to the place's.

## Plan tier

No gate. The bar is chrome on every admin screen of every plan that has the admin (club places need the Club
plan's programs; tournament screens follow the Tournament / Tournament Plus plans as today).

## Words for /marketing

> Customer-visible wording written during the build, settled in ONE `/marketing` pass per stage, before the walk.

- [ ] None new expected: the bar reuses shipped words ("Rep teams", "House league", season names, status chips,
      dates, "View site" / "Public site"). Any new words from Phase 0 (e.g. the bar's name on a tournament-only
      org's screens) are listed here when drawn.

## Open Questions

- [ ] A2, A3, A4 (above)
- [ ] Phase 0's screens raise their own asks (team, Accounting, Calendar, record pages, tournament-only orgs)
- [ ] On a phone, Accounting's nine tabs pinned in the bar: does the sideways-scrolling row still serve, or does
      that place need a different answer? (Phase 0 drawing)
