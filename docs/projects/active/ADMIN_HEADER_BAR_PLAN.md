# Admin header: the bar names where you are — Implementation Plan

> **Status:** Phase 0 complete (option 4 + asks A2–A10 ruled 2026-11-07); **Phase 1 built 2026-11-07, walk §486 PASSED 12/12 2026-11-07, name clamped to one line per the owner's call** (commit on the owner's yes); Phase 2 next
> **Created:** 2026-11-07
> **Branch:** dev
> **PM brief:** [ADMIN_HEADER_BAR_PM_BRIEF.md](ADMIN_HEADER_BAR_PM_BRIEF.md)
> **Drawings:** [ADMIN_HEADER_ROWS_DRAWINGS.html](ADMIN_HEADER_ROWS_DRAWINGS.html) · artifact https://claude.ai/artifact/DXmtj9E1SxcuyfyrcUnsuC
> (v1 = round 1, four options; v2–v3 = round 2, option 4 on Overview, Rep teams, a season and a tournament;
> v4 = round 3, a team, Accounting, Calendar, a child's page, a tournament-only org)

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

## Asks A2–A10 — RULED 2026-11-07, all as recommended

Owner, after round 3 (and after asking why A10 is not the event; answered with the Members/billing reasoning):
*"ok got it, then yes that makes sense, proceed with your recommendations"*. Each ask below is ruled in its
recommended form; nothing added.

- [x] **A2 · A season's / tournament's status on a phone.** (a) a second line in the bar, "House league ·
  Registration open" / "Nov 28–29, 2026 · Open" — **recommended**; (b) one line, status beside the name (the
  name truncates); (c) status only on the season's Overview tab (scrolls away). Both drawn (phone-bar switch).
  Knowingly departs from the 2026-09-21 one-line phone masthead ruling (coaches portal) if (a).
- [x] **A3 · Overview's "Overview" heading on the paper goes** (the bar names the club). Recommended yes.
- [x] **A4 · Desktop: the club's name on the small line under every place.** Recommended yes. Phones leave it
  off, so on a phone the club's name shows only on Overview.

From Phase 0 round 3 (2026-11-07):

- [x] **A5 · Accounting on a phone keeps the sideways tab row, pinned.** Recommended yes (about five of nine tabs
  on screen; the open tab scrolls into view). The other way, a phone-only menu, would give one place a second
  kind of tab row.
- [x] **A6 · The bar does not say which fiscal year Accounting is reading.** Recommended: leave it in the Year pill.
  Only four of nine tabs read a year (Overview, Budget, Teams, Budget vs. Actual), so a year on the small line would
  come and go between tabs.
- [x] **A7 · Calendar on a phone: the view menu moves to the first slot of the toolbar** (where desktop's List · Week
  · Month switch sits), keeping its shipped ghost-glyph look. Recommended over putting it in the bar.
- [x] **A8 · Record pages: the bar names the record, with its back link; its buttons go to the top-right row of the
  page.** A child's page, a team's History, one past season. Facts (a date of birth) become words on the small
  line; the status stays a chip. On a phone "Families" comes off the line. Recommended yes. Not a team's account
  in Accounting (ruled 2026-10-16: a view of the Teams tab, tab row + Team pill, no back arrow).
- [x] **A9 · Rename team URLs gets "← Rep teams" in the bar.** Today it has no back link (its way back is the "Rep
  teams" link in its eyebrow, though `RepTeamsFrame.tsx`'s comment says it has its own). Recommended yes.
- [x] **A10 · A tournament-only org: its own screens' bar names the organization.** Recommended. The premise of
  Phase 0's question was wrong: such an org has no non-tournament screens to speak of. Its list, Settings & access,
  Members and Plan & billing all live under `/admin/tournaments/*`, and today the bar shows whichever event the
  tournament context auto-picked (`lib/tournament-context.tsx:129`). The org name appears only with zero
  tournaments or on Notifications. In a club the Tournaments list is a club place and follows the club rule
  ("Tournaments", club under it on desktop).

## Rulings this knowingly departs from (reference, decided on merit 2026-11-07)

- **2026-08-25, "the phone title band stays"** (`memory/design_decisions.md`): the coaches portal kept the page
  name out of its masthead because "an identity bar whose identity gives way to a page name has stopped being an
  identity bar". The owner chose a different model for the admin: the bar is a *where-you-are* bar, not an
  identity bar, and the club's identity is carried by Overview and the desktop small line. The portal is
  unchanged.
- **2026-09-21, one-line phone masthead** (portal): applies, A2 = (a) ruled.
- **2026-08-19, pinned tab bar reversed**: its reason (shared chrome behaving differently on one tab) holds, so
  pinned tabs are **every place or none**. Never per screen.

Found by the round 3 /design pass (not named in round 2; accepted with the asks 2026-11-07):

- **2026-10-01, "No club name above a page title"** (`club-stage1-screens-guard.test.ts` pins it). Its reason was
  that the bar already showed the club; option 4 removes that, so A4 restores the club on the line under the
  place (A4 ruled yes), so that guard changes in Phase 1.
- **2026-09-25 F3, admin page headers carry no subtitle line.** The small line is the old eyebrow moved under the
  name and into the bar: one line of facts.
- **2026-10-19, the typewriter face only for codes, eyebrows and chips (A14 build check).** The small line is set in
  it (the portal's masthead meta voice, normal weight). A14 must class it as the eyebrow.
- **2026-08-11 (coaches portal), actions sit right of the title.** With the title in the bar, a record page's
  buttons move to the top-right row of the page, the admin tabs' existing `TabActions` place.

## Phases

> Sequenced by dependency and rework risk. Each phase is one session-sized chunk with its own /review and walk.

### Phase 0 — Drawings for the screens not yet drawn (mockup gate, before Phase 2/3 code)

- [x] Draw, in the same artifact (new round), the whole screen before/after at true size, phone + desktop
      (round 3, artifact v4, 2026-11-07; round 2's four screens kept in the Screen switch):
  - [x] a **team** inside Rep teams (`TeamFrame`, its own back link and five tabs). Bar: "← Teams", the team,
        small line club · Rep teams · group · season chip; phone drops the group (measured 13px over)
  - [x] **Accounting** (nine tabs pinned in the bar; the phone row still serves, A5)
  - [x] **Calendar** (the bar says "Calendar"; the phone view menu goes first in the toolbar, A7)
  - [x] a **record page** one level down: a child's page in Families (A8); Rename team URLs has no back link today (A9)
  - [x] a **tournament-only org** (A10: its screens show the auto-picked event today; the bar should name the org)
- [x] /design pass on the round before hand-off (2026-11-07): fixed the Calendar toolbar order (filters right of
      the gap), the phone Filter and view-menu looks, a wrong record-page claim (a team's account), and named four
      departed rulings (above).
- [x] Owner rules A2–A10 (2026-11-07, all as recommended).

### Phase 1 — The bar's new shape (shared; tournaments land here)

> Build prompt: [ADMIN_HEADER_BAR_PHASE1_BUILD_PROMPT.md](ADMIN_HEADER_BAR_PHASE1_BUILD_PROMPT.md) (2026-11-07). In this
> phase the bar's name is the `<h1>` on Overview only; club places keep their paper heading until Phase 2.

- [x] `components/admin/AdminEventHeader.tsx` + `components/admin/kit/AdminKitEventHeader.module.css` (built 2026-11-07):
  - [x] the small line moves **under** the name, in the coaches portal's meta voice (`.teamHeaderMeta`:
        `--font-data`, `--type-label`, normal weight, no tracking, `--text-tertiary`, dot separators drawn
        between siblings); the status chip rides that line
  - [x] **remove the scroll collapse** (the `collapsed` state, `.collapsed` rules, the second chip copy
        `chipCollapsed`, `compact` on the FlipPill); the bar holds still at every width
  - [x] the portal masthead recipe for padding (0.5rem desktop / 0.45rem phone) with the 4px tap overhang
        on the 44px controls (globe, back, switcher) so the bar does not grow to the tap floor
  - [x] phone: a second line for the section/facts + status chip (A2 ruled (a)); the club only on desktop (A4)
  - [x] the tournament name keeps its link to the dashboard
- [x] Overview (`components/admin/kit/club/ClubHubKit.tsx`): A3 ruled yes, drop the paper `AdminPageHeader
      title="Overview"`; give the first content 1rem from the bar on a phone (the portal's masthead gap).
      ⚠ The "What's new" note (docs/projects/active/WHATS_NEW_HOME_PLAN.md, Stages A–C built 2026-11-07 by
      another session) sits directly under that heading today; it becomes the first thing under the bar. Read
      that plan's state before touching `ClubHubKit.tsx` and keep the note's placement as that plan rules it.
- [x] Heading semantics: on club screens the bar's name is the page's `<h1>`; inside a tournament the bar's name
      stays a link and the page's own title stays the `<h1>`. Write this rule in the component header.
- [x] `--admin-header-h` keeps publishing the bar's height (it now changes only on navigation, not on scroll)
- [x] Guards: update/extend the unit tests that pin the header's shape (`tests/unit/nav-standard-guard.test.ts`,
      `tests/unit/club-stage13i-places-guard.test.ts`, any AdminEventHeader collapse test)

**Phase 1 as built (2026-11-07):**
- The bar: name on top, small line under it (`.meta`: `--font-data` marked `type-ok: eyebrow`, `--type-label`, 400, line-height 1.3 as
  drawn, dots drawn between words, never before the chip); the club is `.metaClub`, hidden ≤900px with its following dot removed
  (the override must match the separator rule's weight — a weaker one left "· Nov 1–3" on a phone, caught in the browser). No
  collapse, no scroll listener; the route-change reset of the shell's inner scroller is kept. Padding 0.45rem / 0.5rem; the pill
  overhangs 4px on a phone; the name link's phone tap box sits above the small line (z-index) so all 44px answer a thumb.
- Measured (dev, UAT Rep Club): tournament 53px phone / 60px desk (today 61); Overview 51 / 44; identical at rest and scrolled;
  Overview's first content 16px / 22.4px under the bar (`.hubPage` in `ClubHub.module.css`).
- `<h1>`: the bar's name is the `<h1>` only on the club Overview (`onOverview`: exact `/{slug}/admin`, not tournament-only, not
  suspended); a `<span>` everywhere else in Phase 1. The layout sweep's three hub entries now wait for `[data-club-hub]`, not `h1`.
- **Owner call, walk §486 E — RULED 2026-11-07: one line, cut with "…", as drawn.** The build first kept today's 2-line clamp
  (a departure from the drawing); the walk passed 12/12 with the owner choosing the drawing, so the clamp is now 1. Phase 2's season
  switcher row inherits the one-line name.
- Guards: `tests/unit/admin-header-bar-guard.test.ts` (new); `club-stage1-screens-guard.test.ts` A3 assertion rewritten. The A14
  baseline for the bar's stylesheet was lowered (face 1 → 0, caps 2 → 1).
- Help: no article described the shrink, the eyebrow above the name or the Overview heading (checked 2026-11-07); no `/docs` change.
- Not re-run: the admin pixel-identity check — every admin screen's bar differs on purpose; its baselines need a deliberate re-capture.

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
- [ ] Record pages with their own back link (`rep-teams/rename-slugs` per A9, `rep-teams/teams/[teamId]/history` and
      `history/[yearId]`, `families/ChildPage.tsx`): per A8 and the Phase 0 drawing. NOT `accounting/teams/[teamId]`:
      it is a view of Accounting › Teams (ruled 2026-10-16) and keeps Accounting's bar and tab row
- [ ] Notifications and the other admin pages that call `AdminPageHeader` outside a frame (census from the grep of
      `AdminPageHeader` under `app/[orgSlug]/admin/**` minus the tournament tree)
- [ ] Tournament-only orgs, per A10: the bar names the org on `/admin/tournaments/manage` and `/settings/*` (not the
      auto-picked event); a club's Tournaments list follows the club rule

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
      dates, "View site" / "Public site"). Phase 0 round 3 added none: the tournament-only org's bar is the org's
      own name, record pages reuse their shipped back-link labels and chips, and A9's "← Rep teams" is the rail's word.

## Open Questions

- [x] ~~A2–A10~~ ruled 2026-11-07 as recommended
- [x] ~~Phase 0's screens raise their own asks~~ → A5–A10 (round 3, 2026-11-07)
- [x] ~~Accounting's nine tabs on a phone~~ → drawn: the sideways row still serves (A5)

## Found on the way (round 3, 2026-11-07; outside this project, report only)

- **Shipped phone Filter vs the 2026-10-12 ruling.** The Calendar's phone Filter (`components/coaches/FilterGroup.tsx`)
  is a pill with the word and a chevron; the 10-12 ruling says a phone's Filter is the sliders glyph alone. Drawn as
  shipped.
- **Team page: Start next season goes icon-only on a phone** (`.iconOnlyPhone`), against "the page's primary action
  keeps its words" (2026-10-20, 2026-08-11). Drawn as shipped.
- **Chat is paused**, so the round 2 drawing's Chat row and tab were wrong (fixed in v4: the phone tab reads Messages).
