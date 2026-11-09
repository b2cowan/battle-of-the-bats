# Admin header: the bar names where you are — Implementation Plan

> **Status:** Phase 0 complete (option 4 + asks A2–A10 ruled 2026-11-07); **Phase 1 built 2026-11-07, walk §486 PASSED 12/12 2026-11-07, name clamped to one line per the owner's call**, committed `5451558f9` 2026-11-07; **Phase 2 session A built, simplified and re-reviewed, committed `860ae5b23` 2026-11-07** (the hand-off, `HubTabBar inBar`, Rep teams and a season); **Phase 2 session B built 2026-11-07** (a team, Accounting, Families, Organization; the paper mode deleted; the layout checker reads the locked phone shell), /design + /simplify + /review applied, committed `43ece64bf` 2026-11-08; **walk §492 PASSED 25/25 2026-11-07** (call G ruled: keep the full-width bar). **Round 4, the desktop strip, RULED 2026-11-08** (option B, club cell aligned with the tab band; D1–D5 below); **Phase 2D (the desktop strip) is next, then Phase 3** — build prompt `ADMIN_HEADER_BAR_PHASE2D_BUILD_PROMPT.md`
> **Created:** 2026-11-07
> **Branch:** dev
> **PM brief:** [ADMIN_HEADER_BAR_PM_BRIEF.md](ADMIN_HEADER_BAR_PM_BRIEF.md)
> **Drawings:** [ADMIN_HEADER_ROWS_DRAWINGS.html](ADMIN_HEADER_ROWS_DRAWINGS.html) · artifact https://claude.ai/artifact/DXmtj9E1SxcuyfyrcUnsuC
> (v1 = round 1, four options; v2–v3 = round 2, option 4 on Overview, Rep teams, a season and a tournament;
> v4 = round 3, a team, Accounting, Calendar, a child's page, a tournament-only org)
> **Round 4 drawings (desktop strip):** [ADMIN_HEADER_DESKTOP_STRIP_DRAWINGS.html](ADMIN_HEADER_DESKTOP_STRIP_DRAWINGS.html) ·
> artifact https://claude.ai/artifact/A1W443obR8aJd8PjUZEgUx (v1 = options A/B/C after the /design pass; v2 = B with the
> club cell lined up with the tab band, the owner's pick)

## Goal

The admin's pinned white bar (`AdminEventHeader`) stops naming the one thing that never changes for a club
admin, the club, and names **where you are**. On the club's Overview that is the club. In a club place with
tabs (Rep teams, a house-league season, a team, Accounting, Families, Organization) it is that place, and the
place's tab row pins **inside** the bar. Inside a tournament it is the event, as today. A small line under the
name carries the facts (the club on desktop, the section, dates, status). The bar never shrinks on scroll. The
place's heading on the paper goes, so each screen has one title instead of two.

**Round 4 (2026-11-08) changes the desktop half only.** On desktop the sidebar already names the place, so the white
bar's row was a third statement of it and kept ~151px of a 1440 × 760 window pinned. Above 900px the bar's row goes:
the place's name moves into the top strip over the page column, the club's name moves into a cell at the top of the
sidebar (the same height as the tab band, so the two rules meet in one line), View site moves beside the bell, and
the tab row is its own pinned band under the strip (measured in the drawing: 93px pinned). The phone bar is unchanged.

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
  off, so on a phone the club's name shows only on Overview. **→ Superseded on desktop by D1 (2026-11-08):** the
  desktop small line goes; the club lives in the sidebar's club cell. Phones are unchanged.

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

## Round 4 · the desktop strip — RULED 2026-11-08

Owner, after the walk passed, on desktop space: asked to think fresh about the bar's top row and offered two ways
(scroll it away, or move it into the top nav). Answered: move it into the strip, keeping "← Teams │ 14U AA" rather than a
trail of titles. Drawn as A (one strip), B (club on the sidebar), C (split at the sidebar line), /design pass applied.
Owner: *"I think I like B the best, but could you line up the border of the org name with the header border? then the
side nav also starts below the whole header which I also think looks cleaner"*; on v2: *"I like it"*. The four asks
below were answered by the owner in this session, each as recommended. Recorded as ruled; nothing added.

- [x] **D1 · Desktop (above 900px) is option B with the club cell aligned.** The top strip splits on the sidebar's
  edge. Over the sidebar: the wordmark and the portal word. Over the page: the place's name, starting at the page
  column's left edge, with its back link and status chip ("← Teams │ 14U AA · 2026 Season · Live"), then View site,
  the bell, the account menu and the Workspaces pill at the right. The club's name moves into a cell at the top of the
  sidebar, **exactly the tab band's height, so its bottom rule and the tab band's are one line**; the sidebar's
  navigation starts below the whole header. The place's tabs are their own pinned band under the strip. The white
  bar's desktop row and its small line are gone. Collapsed sidebar: the club cell shows the club's initials. Screens
  without tabs keep the club cell at the same height (its rule ends at the sidebar's edge), so the navigation never
  moves between screens. **The phone keeps today's bar exactly.**
- [x] **D2 · Overview's strip says "Overview"** (the club already has its cell). Desktop only; the phone's Overview bar
  still names the club (A3).
- [x] **D3 · A team's group is dropped on desktop.** "Rep teams · Senior" goes with the small line; the group stays in
  Team details. (Desktop now shows less than the phone here, knowingly.)
- [x] **D4 · The portal word in the strip is "Admin"** (today "Admin Area"), short enough for the sidebar-width cell.
- [x] **D5 · Clicking the club cell opens Overview.** Switching clubs stays in the Workspaces pill.

Carried from earlier rulings, not re-asked: a page's own buttons stay at the top right of the page (A8); a long name
is cut to one line with "…", its dates and chip never cut (walk §486 E).

**To settle at the Phase 2D gate (implementation, recommendation given):** "Admin" and the Workspaces list.
`WORKSPACE_KIND_LABEL.organization` ("Admin Area") is the one word the strip, the Workspaces list, the account return bar
and Home share, and `nav-standard-guard` pins the strip to it. Recommended: the strip gets the short form as a named
constant beside it in `lib/workspace-labels.ts` (one home, both words), the guard pins that constant, and the
Workspaces list keeps "Admin Area" (it has the room, and "Back to Admin" reads worse). The alternative, renaming the
kind everywhere to "Admin", keeps one word; ask the owner at the gate.

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

Round 4 (accepted with D1–D5, 2026-11-08; found by the round 4 /design pass):

- **2026-11-07 ruling 1 and A4, the club on the desktop small line.** Its reason was one orienting bar on phone and
  desktop. On desktop the sidebar already names the place and the club cell names the club, so the small line said
  things twice. Phone unchanged.
- **2026-10-17, one nav standard (N6/A6): the strip says "Admin Area"**, so someone who is also a coach can tell the
  two shells apart. D4 keeps a portal word, shortened to fit.
- **2026-08-17, the coach strip owns identity, the sidebar owns navigation.** The club's name now sits at the top of
  the admin sidebar. It is also navigation (D5 opens Overview), and the coaches portal is untouched.
- **2026-07-31 / 2026-10-17, one strip shared with the coaches portal.** The admin strip gains a split layout. It stays
  48px (`--chrome-bar-h`), so someone with both roles never sees the bar change height; the coaches portal must stay
  pixel-identical.
- **2026-10-12, the sidebar collapses to a 64px icon strip.** D1 covers it: the left cell and the club cell narrow with
  the sidebar (initials).

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

- [x] **The hand-off mechanism** (architectural decision below): a context provided by `app/[orgSlug]/admin/AdminChrome.tsx`
      that a place frame fills with {title, back link, switcher, small-line facts, status chip, tabs}; the bar
      renders it, falling back to the club's name. No flash of the club's name on a place screen: the bar
      knows the place from the route before the frame's data arrives, and shows the frame's placeholder name
      in the same line (as `PlaceFrame` already does), so nothing shifts. (built 2026-11-07, session A)
- [x] `components/admin/kit/club/PlaceFrame.tsx`: stop drawing `header` + `HubTabBar` on the paper; register them
      with the bar instead. `TabActions` / `TabPageHeader` unchanged (a tab's own actions stay on the tab).
      (built 2026-11-07: `place` mode; the `header` paper mode stays for Team and Organization until session B)
- [x] `components/shared/HubTabBar.tsx` + `.module.css`: an **in-bar variant** (no bottom border of its own; the
      overflow fade and chevron paint the card white, not paper). ⚠ Shared with the coaches portal: a new prop,
      the portal's look unchanged. (built 2026-11-07: `inBar`; portal measured identical, below)
- [x] Frames, each verified on its own screens:
  - [x] `RepTeamsFrame.tsx` — "Rep teams"; six tabs + waiting counts (built 2026-11-07)
  - [x] `SeasonFrame.tsx` — back "Seasons", the season's name, the switcher, the status chip; seven tabs (built 2026-11-07)
  - [x] `TeamFrame.tsx` — per the Phase 0 drawing (built 2026-11-07, session B)
  - [x] `money/AccountingFrame.tsx` — per the Phase 0 drawing (built 2026-11-07, session B)
  - [x] `families/FamiliesFrame.tsx`, `OrgFrame.tsx` (built 2026-11-07, session B)
- [x] (census 2026-11-07, session B: none of the sticky parts still slid under the bar; two jumps fixed, below) In-page sticky elements re-anchored below the taller bar (`top: var(--admin-header-h)`): census every
      `position: sticky` under the club admin (known: the draft pool bar and column head in
      `league/teams/Teams.module.css`, `LeagueSeason.module.css` `.groupHead`, Accounting's `MoneyMonthGrid`
      head, Schedules' day bands) and fix the ones that sit in the page scroller.

**Phase 2 session A as built (committed `860ae5b23` 2026-11-07):** (session B builds on these)
- **The mechanism:** `components/admin/AdminBarPlace.tsx` (two contexts: the frames only hand off, so they never re-render
  when the bar's copy changes; `useHandBarPlace` runs in a layout effect every render, withdrawn on unmount) mounted in
  `AdminChrome` inside `ClubBriefProvider`; `clubPlaceAt` in `lib/admin-kit-nav.ts` (see the decision below). To add a
  place in session B: give `clubPlaceAt` its branch (key, placeholder title, back, facts, tabs, `canUse` gate) and switch
  its frame to `<PlaceFrame place={{ ...place, … }}>`. `PlaceFrame`'s `header` paper mode (Team, Organization today) goes
  when the last caller moves.
- **The bar:** the back link (`.back` + `.backRule`: "← Seasons" on desktop, a 44px arrow square overhanging 4px on a
  phone), `.titleRow` + `.switcher` only when a switcher is handed (the name `nowrap` + ellipsis; the 44px chevron
  overhangs −12px desktop / −13px phone so the name's line never grows), the facts as spans between the club and the
  chip, the chip wrapped in `.metaChip` (snug, like the tournament chip), `.metaClubOnly` drops a club-only line on a
  phone (Rep teams), `.withTabs` gives up the bottom padding. The `<h1>` rule is `isPageTitle = onOverview || !!place`.
- **`HubTabBar inBar`:** every rule scoped under `.inBar` (margin 0.45rem −0.85rem 0, −0.6rem inline ≤640, so the first
  tab's label lines up with the name; no line of its own; the arrows paint `--card-bg` over `--pitch-black`, the bar's
  own two layers). **Portal measured identical** (dev, UAT Rep Club coach, 2026-11-07): Money, Insights, Development,
  Lineups and Practice plans at 390 and 1280, every tab's box, colour and underline and every arrow's box and gradient,
  with the committed `HubTabBar` swapped back in vs this build — 10 of 10 the same.
- **Measured (dev, UAT Rep Club owner):** Rep teams 95px phone / 103px desktop; a season 98 / 104 (its one season draws no
  switcher). One `<h1>` on every measured page (Rep teams, Assistant coaches, a season's Overview, Teams & draft,
  Schedule; Rename team URLs keeps its own and the bar's name is a `<span>`). First content 16px / 22px under the bar
  (`.underBar` in `PlaceFrame.module.css`, the Overview's numbers). No sideways scroll. The server's HTML already carries
  "Rep teams" / "Season" and the 6 / 7 tabs; a registrar on Rep teams and a coach on a season get the club's name (not
  theirs). **A long name** ("2026 Fall House League — Saturday Mornings at Riverside Park") with a 44px switcher built
  in: one line with "…" at 360 and 390, the switcher whole, the bar 98px before and after; it fits whole at 1280.
- **Sticky parts on these places:** the draft board's pool (`--pool-top` in `league/teams/Teams.module.css`) left the
  bar out and already slid under it; it now adds `--admin-header-h` (measured: sticks at 164px under a bar ending at
  152). The census's other hits on a season sit in their own scroller or a dialog (`.groupHead`, the day bands, the
  schedule scroller's band). Jumps: `.jumpTarget` (`ClubCalendar.module.css`, a season schedule's week) replaced its
  4.75rem guess with the measured bar; `ClubSection` (`RepKit.module.css` `.section`) gained a `scroll-margin-top` that
  clears the bar (the season checklist's "Set dates" → Registration landed under it). Session B's census still owes
  the rest (Accounting's month grid, Schedules, `--schedule-frame-top`, `CollapsibleCard`).
- **Layout sweep:** the six Rep teams tab entries, Bring in a coach's team and the nine season entries wait for
  `[data-place-frame]` (the bar's `<h1>` is drawn before the frame mounts); Rename team URLs and the team entries keep `h1`.
- **Guards:** `admin-header-bar-guard.test.ts` gained the Phase 2 block (no-flash order, the key check, the layout
  effect, the bar-mode frame drawing nothing, the in-bar rules all under `.inBar`); `club-stage1-screens-guard`,
  `club-stage13i-places-guard`, `house-league-season-frame` re-pointed at `clubPlaceAt` / `isPageTitle`.
- **Demos:** no tour anchors on these headings (`check:demos` runs the tournament and coach sandboxes only).
- **/design pass (2026-11-07), against the drawing's Rep teams and A season at 390 / 1280:** the bar matches (the back
  square and its rule, the name, the phone's second line "House league · REGISTRATION OPEN", the desk line with the club,
  the first tab's label under the back arrow, the hairline under the tabs, 16 / 22px to the first content). One defect
  found and fixed, **older than this phase but fatal to its promise**: on a phone the DOCUMENT scrolled past the locked
  shell — 72px on every admin screen (the generic `main { padding-bottom: var(--bottom-nav-height) }` reserve on the
  outer `#main-content`, which the admin does not need) and 721px on a season's Overview (visually-hidden labels with no
  positioned ancestor, placed against the window, escaping the shell's `overflow: hidden`) — so a swipe past a page's
  end carried the "pinned" bar off the top. Fixed: `data-admin-locked` on the shell + the same `#main-content:has(...)`
  stand-down the consumer shell got 2026-10-09 (`globals.css`), and `position: relative` on the phone shell
  (`admin.module.css`). Measured with a wheel gesture at 390: Overview, Rep teams, a season, a tournament's dashboard and
  Teams, Accounting all `scrollY 0` with the bar at the top; the help guide (a focused shell) still scrolls the document,
  as before. Phase 1's "identical at rest and scrolled" had scrolled the inner scroller only, which is why it missed this.
  Low: Assistant coaches' lede sits 12px under the bar (its own sheet's margin), left as is. The switcher could not be
  seen on the fixture (one season): built into the live bar, its geometry measured (above); the phase walk needs a club
  with two seasons.
- **/review (2026-11-07, high-risk tier, four lenses: hand-off state, gating + headings, stylesheet blast radius, guards
  + sweep):** applied — (1) a treasurer reads a season's Money through Accounting without holding House league; the
  first gate (the program's capability) dropped the season's name, its way back and the `<h1>` there. A season is now a
  place for whoever opens ANY of its pages (`seasonAccess.read || readMoney || email`; measured: the treasurer's Money
  page says "Season" → its name, one `<h1>`, no row because one tab). (2) A tab someone cannot open under a place (a
  season's Email families off the desk) drew the refusal's own `<h1>` under the bar's: `NotYours` now draws its title
  as an `<h2>` inside any place frame (`useInPlaceFrame`, `NotYoursScreen` `inPlace`) — the paper header had the same
  double `<h1>` before. (3) The phone's draft pool height (`--pool-room` ≤900) now subtracts the bar it sticks under
  (its last rows would have run under the bottom bar). (4) `admin-rep-documents-upload` (a Rep teams tab) waits for
  `[data-place-frame]` too. (5) `SeasonFrame` keys the place from the club's own slug (`currentOrg.slug`), as the bar
  does. (6) Guards tightened: the season gate line, the tabs line (no place at all before the member is known — it read `: []` until the
  /simplify below), `EVERY_SEASON_PAGE` used only to
  light a tab, the refusal's `<h2>`, and the `.inBar` scope check reading indented rules too. Accepted: each hand-off
  re-renders the bar once (no loop: the frames read only the setter); the `<h1>` remounts once when the switcher first
  appears (invisible); the demo-only `--sandbox-chrome-h` term in the phone scroll offsets (as before). Refuted: none
  needed — the Rep teams gate is exactly the layout's (`canOpenModule` = capability + entitlement).
- **/simplify + re-review (2026-11-07, session A close-out):** four cleanup lenses (reuse, simplification, efficiency,
  altitude) found the build clean apart from three small tidy-ups, applied: the dead `seasonAccess ? … : []` arm in
  `clubPlaceAt` is gone (the gate line above it already returns null before the member is known — so "none before the
  member is known" now means *no place*, not an empty row; the guard pins `tabs: seasonTabs(seasonPath, seasonAccess),`);
  `AdminEventHeader` derives "more than the club" once (`moreThanClub`, feeding `hasMeta` and `clubOnly`) and one
  `tabbed` value for the row and the `.withTabs` class; `AdminBarPlace` is `Omit<ClubPlaceAt,'tabs'> & {chip, switcher,
  tabs}` so the address's description and the bar's cannot drift. Left alone on purpose: a shared tab-decoration helper
  (two different 2-line maps; worth it only if session B adds sites), the duplicated back link / `.underBar` margin pair
  (session B / Phase 3), the `inBar` arrow-gradient and padding constants restating the header's (cosmetic), and
  `PlaceFrame`'s paper mode (until session B). Re-review: typecheck (only another session's renewals errors), focused
  lint, `check:spelling`, `check:demos`, 333/333 guard tests (one guard, `club-stage13i-places-guard`, pinned the old
  tab-row line and was updated).
- ⚠ **Open follow-up — the layout checker is blind to the locked phone shell (found 2026-11-07, measured).** Phase 2's
  `data-admin-locked` stops the *document* scrolling on a phone, but `check-layout-invariants.mjs`'s
  `hidden-behind-chrome` pass decides "the end of the page" from the document (`atEnd`) and scrolls the document to
  reach it. With the document locked it is "at the end" at rest, so any heading, row or button in the shell's scroller
  that sits in the bottom bar's band before the first scroll is reported as trapped. Measured at 390 as the club owner:
  the shell's own scroller reaches its end and every flagged item clears the bar (Rep teams' last row ends at 558 against
  a bar at 772; Assistant coaches' Remove at 666). Six NEW findings at 390 (Rep teams, Assistant coaches, a season's
  Overview, Past teams, Rename team URLs' input, a season's money ledger); the baseline holds ONE such admin entry, so a
  full sweep on staging will light up many more phone admin screens. **Fix (its own small change, owner's yes first —
  the checker is shared):** drive the shell's scroller (`.adminMain`, the nearest `overflow-y: auto` ancestor of the bar)
  to its end for the second pass, as the document is driven now. Do it before the next staging sweep (`/release` §1d-5);
  until then read those findings as this, not as a defect. Probe: `.probe/s2a-bottom-bar.mjs`.
  The sixteen NEW **tap-floor** findings in the same run are NOT this phase: page controls on screens whose files are
  unchanged (registration checkboxes 22px, Add Event 29px, standings select 33px, Tools / Review on Registrations 34px,
  "House league's time →" 18px, Save all renames 38px). The baseline names a control by its visible text, so a reseeded
  player name, a state-dependent control or a renamed label reads as NEW. They want a baseline refresh on the next
  fixture reseed and a separate pass on the genuinely undersized controls; the bar's own back square, switcher and tabs
  were never flagged.
- ⚠ **Between sessions A and B** two places pin their tabs and four still draw them on the paper — against "every place
  or none" (2026-08-19). The build prompt split it this way; session B closes it, and the walk covers the whole phase.
  **Closed by session B (below).** The layout-checker follow-up above is **fixed** in session B (owner's yes, its own commit).

**Phase 2 session B as built (2026-11-07):** walk §492 covers the whole phase.
- **The four places:** `clubPlaceAt` gained a team (asked before Rep teams; key `team:{id}`, "Team" until the frame's read,
  "← Teams", facts "Rep teams", the five tabs; History and a past season stay record pages), Accounting (key `accounting`,
  no facts — A6), Families (`familiesTabFor ?? 'families'` as the frame lit it; a child's page is no place) and Organization
  (the person's `orgTabs`; null in a one-team workspace; Plan & billing no tab). `AdminBarPlace` gained `deskFacts` (a
  team's group: the desk line only, `.metaDesk` — `.metaClub`/`.metaClubOnly` renamed `.metaDesk`/`.metaDeskOnly`, the
  phone's dot rule now `.metaDesk:first-child + span`). Each frame is `useClubPlaceAt()` → key check → `<PlaceFrame
  place={…}>`; `PlaceFrame`'s paper mode is **deleted** (no `header`, no `PaperPlaceFrame`).
- **One question, one access object:** `useClubPlaceAt` (AdminBarPlace.tsx) builds `ClubPlaceAccess` once — `canUse`,
  `seasonAccess`, `orgTabs` (`useOrgTabs`, moved to `useAdminKitNav.ts`), `runsRepTeams`, `hasPayouts`, `opensFamilies` —
  and the bar and every frame call it, so they cannot disagree. Two of those are SERVER facts the address cannot know, read
  once by the admin layout and carried in `OrgProvider`: `clubHasPayouts` (Accounting's Payouts tab; `canOpenModule`
  accounting-gated, `.catch(() => false)`; the Accounting layout no longer reads it) and `limitedToTeamGroups`
  (`!!authCtx.repGroupIds`: Families' `canOpenFamilies` refuses such a member, which `canOpen` alone could not see). So the
  server's first paint names the EXACT tab row (measured: Accounting's nine, Payouts last, with scripts off).
- **The treasurer's season name** (session A's open defect): the season list is House league's read, refused to a treasurer
  who opens a season's Money through Accounting, so the bar read "Season" for good. The Money page publishes the season's
  name from its own read (`usePublishSeasonName`, as a team's pages publish the head); SeasonFrame no longer asks for the
  list without House league's read. Measured: "2026 Fall House League". (`SeasonLockLine` on that page still asks and gets
  a 403 in the console — older, not this phase.)
- **Hand-off safety (/review):** a frame withdraws on unmount only if the bar still holds ITS key (`held?.key ===
  mine.current ? null : held`), so a frame leaving in a later commit than its successor can never wipe it. Latent today
  (no Suspense/Activity boundary under a place).
- **Shared bits (/simplify):** `markTabs` (Rep teams, a season, Families); `flatPlace` and `isAtOrUnder` in `clubPlaceAt`;
  each list built once; the season's Registrations count is `WaitingCount` (gained an optional spoken `label`); the
  Families name is one word in `clubPlaceAt` (the frame hands it on).
- **/design (session B, all six places, 390 / 1280, owner + treasurer + registrar + coach):** matches the drawings (bar
  95–98 / 103–104px; first content 16 / 22.4px; first tab label under the name/back square; A5: the lit tab in view after a
  tap, measured on Budget vs. Actual and Payouts; A6 holds; a 66-character team name cut with "…", bar height unchanged; a
  one-tab person — the treasurer on a season's Money — draws no row and keeps the bottom padding). One defect fixed: the
  in-bar edge arrows painted two fading layers and left a cream smudge on the white bar; now ONE `--card-bg` layer, as
  drawn (`HubTabBar.module.css`, under `.inBar` only — the portal untouched).
- **The census (session B):** no `position: sticky` under the club admin still slid under the bar: the draft pool reads
  `--admin-header-h` (session A); `.groupHead` and the Schedules day bands sit in dialogs; Accounting's money grids pin
  only sideways; a rep team's month band sits in its own scroller; `CollapsibleCard` is tournament-only. Two JUMPS missed
  the bar and are fixed: Plan & billing's "See invoices" (`.sectionTitle` scroll margin adds `--admin-header-h`) and a
  season schedule's rain-out "New dates" → Needs a date (the wrapper takes `cal.jumpTarget`). Left: public-site
  `BuilderRow`'s scroll-into-view guesses (`r.top < 0`, no margin; not a place); `.builderPreview` leaves out
  `--sandbox-chrome-h` (demo only); `useScheduleOpensOnToday` refits `--schedule-frame-top` only on resize.
- **The layout checker (owner's yes, its own commit):** `hidden-behind-chrome` now treats the locked shell's scroller as the
  page when the document cannot scroll (`[data-admin-locked]`): `atTop` / `atEnd` read it and the second pass drives it to
  its end. A/B on the six screens at 390: the committed checker reported 6 phantom "trapped" findings, the fixed one 0, and
  still caught the real undersized Save button.
- **Layout sweep:** the team, Accounting, Families and Organization entries wait for `[data-place-frame]`.
  `check:layout` on the places at 390 (in batches — free memory swung 1–10 GB with other sessions' work; two batches
  aborted on first compiles and were re-run, never read as passes) and 1440: no new findings of this phase. Two NEW at 390
  that are not: Families Duplicates' record card spills 2–17px and an 18px input (measured identical with this frame's
  change removed — reported to Families), and Rename team URLs' Save all renames 38px (baseline drift, session A).
- **/review (high-risk tier, four lenses):** applied — the Families gate (`opensFamilies`), the payouts read's `.catch`, the
  owner-checked withdrawal, the treasurer's name. Accepted: the payouts fact is read on a full load only (Stripe Connect's
  return is a full load); the team place answers a typed id outside a group-limited member's teams with "Team" and the five
  tab links (the data stays refused); the phone dot rule handles a desk word directly after the club only. Recorded, older
  than this phase: the season bar lags a rename/new season by the seasons store's debounce; a team's head can show its last
  read for a beat on return; a failed team-head read is not retried on the Coaches tab (the one tab that publishes no head);
  `HubTabBar`'s overflow arrows can stay stale when a waiting count widens the row after first paint;
  `tests/uat/scenarios/plan-gating.spec.ts` looks for an "Accounting Overview" `<h1>` that never existed.

### Phase 2D — The desktop strip (round 4, D1–D5, ruled 2026-11-08)

> Built before Phase 3 because every Phase 3 screen names itself; built after, each would land in the white bar's
> desktop row first and move again. One session. Build prompt: `ADMIN_HEADER_BAR_PHASE2D_BUILD_PROMPT.md`.
> Above 900px only (the sidebar's own breakpoint, CSS today: `AdminKitFrame.module.css`, `admin.module.css`). At 900px
> and below nothing changes: the strip is zeroed there and the bar is the phone bar.

> **Built 2026-11-08** (one session), committed `135f4652c` 2026-11-08. Gate answer the same day: the strip says the short form, `ADMIN_STRIP_LABEL =
> 'Admin'` beside `WORKSPACE_KIND_LABEL` in `lib/workspace-labels.ts`; the Workspaces list, Home, the account way back
> and the portal door keep "Admin Area". Owner walk §495 (https://claude.ai/artifact/8XSzVFVFnsbCDAiR5uszyo).

- [x] **The strip splits on the sidebar's edge** (`AdminTopStrip` + its own `AdminTopStrip.module.css`): left cell
      `width: var(--admin-rail-w)` (240 / 64), wordmark + divider + "Admin"; collapsed, the mark alone. Right cell
      `padding: 0 1rem 0 2rem`: the name at x=272 open (the bar's old spot), 96 collapsed. 48px. The shared sheet gained
      one opt-in class (`.stripSplit`, after `.strip`). **Measured:** the coaches portal's strip and tab row identical,
      node for node, at 1280 and 390 on three pages. **As built:** a cancelled account's one page keeps the unsplit strip
      and "Admin Area" (it has no sidebar to split on) and its white bar names the org (/review, 2026-11-08)
- [x] **The place in the strip:** one place model, `components/admin/useAdminPlace.tsx` (address first, then the
      frame's hand-off), read by both headers. Club place: back link + divider, name (16px bold, one line, "…"),
      switcher, chip; tournament: the name as a link to its dashboard, dates (`--type-support`, the drawing's 13px is
      off the ladder), chip; Overview says "Overview" (D2). Every other screen: the org's name, as the bar did
- [x] **One `<h1>` per width.** The bar's name row is `display: none` above 900px and the strip's place is
      `display: none` at 900 and below. **Measured:** one visible `<h1>` on every screen at 1440 and 390
- [x] **View site in the strip** beside the bell (`flip && !suspended && <FlipPill`); the phone keeps its globe
- [x] **The tab band:** `.deskBand` (height `var(--admin-band-h)`, the name row hidden) or `.deskNone` (no tabs: no
      bar). `--admin-header-h` publishes 45 / 0. **Measured** at 1440×760: Rep teams 93, a team 93, a season /
      Accounting 93, a tournament 48, Overview 48 (before 151 / 152 / 152 / 151 / 108 / 92; drawing 93 / 93 / 48).
      Sticky census on ten screens: the draft pool sticks at 105 (strip + band + 12); nothing under, no gap
- [x] **The club cell** (`AdminKitRail`, `.clubCell`): a link to Overview, the `stripTileText` initials tile + the
      club's name (`strip.rowLabel`, so the collapsed bubble names it), `height: var(--admin-band-h)` — ONE declaration in
      `admin.module.css` (45px) that the band reads too. A tournament-only org's cell names the org. **Measured:** the
      cell's rule and the band's rule both at y=92, at 1440 and 1280, open and collapsed; Overview's row at y=105 on
      every screen (the navigation never moves)
- [x] **The small line goes on desktop** (D1, D3): the desk-only words left the markup (`.metaDesk`, `deskFacts`, the
      team frame's `groupName`); the phone's visible bar is node-for-node identical on eight screens
- [x] Guards rewritten: `admin-header-bar-guard` (the model, the order, no desk-only words, plus a round-4 block: CSS
      split at 900/901, one `<h1>` per width, the opt-in split, View site by the bell, **the club cell and the band read
      one variable declared once**), `nav-standard-guard` (short form in the split strip, full word when cancelled),
      `club-stage1-screens-guard` (`isPageTitle` in the model, the strip's `<h1>`/span), `admin-kit-nav.test` (`tabbed` in
      the model), `admin-cancelled-one-page-guard` (View site in the strip, the model, the unsplit strip).
      `club-stage13i-places-guard`, `fee-overdue-banner`, `sidebar-strip-guard` pass unchanged (no new 240/64)
- [x] Layout: the entries already wait for body markers (the strip's `<h1>` appears exactly where the bar's did).
      `check:layout` on the six screens at 361/390/768/1440, collapsed at 1440, and at 901: no new findings from this
      change (9 phone tap-floor findings on Overview's "Needs someone" links belong to the in-flight hub work). 901px: a
      long tournament name keeps 97px and is cut; dates, chip and the four doors whole
- [x] Help: both lines still read true on desktop (View site is still top right; the tabs are still under the title).
      Optional `/docs`: mention that the club's name atop the sidebar opens Overview
- [x] /design (matches option B, no fixes; four nits → walk calls); /review (standard, 3 lenses): fixed the cancelled
      strip losing its word to a collapsed-sidebar preference and a stale `deskFacts` comment; recorded fractional widths
      900–901px (both copies show; the shell-wide 900/901 convention), a switcher left open across a resize, the
      overdue line above the band (walk G2). /simplify (2026-11-08): the place is drawn twice on purpose (the guards pin
      both renderings' markup, so one shared name/back component was left alone); dropped the unread `onTournament` from
      the model, the strip switcher's phone-only overhang margin and a stale comment; re-measured identical. /review
      re-review of those three hunks: no findings
- [x] Owner walk §495 published 2026-11-08, desktop-first with a phone spot-check; three calls (G1 look-alike tiles
      collapsed in a tournament, G2 the overdue line above the band, G3 a tournament name 18px left of its page title)

### Phase 3 — Screens with no place of their own

> **After Phase 2D:** every screen below names itself in the desktop strip and in the phone bar (one source, two
> renderings). Record pages put their name and back link in the strip on desktop; their buttons sit at the top right
> of the page (A8). Nothing in Phase 3 adds a desktop small line.

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
- **Decision (settled 2026-11-07, Phase 2 session A): BOTH, in that order — the address first, then the frame's
  hand-off.** `clubPlaceAt(pathname, base, access)` in `lib/admin-kit-nav.ts` (every gate in one `ClubPlaceAccess`, built once by `useClubPlaceAt` — session B) is the one statement of
  "is this address a place, which tab, and may this person open it"; the bar asks it on every render and the frame asks
  it too (it replaced each frame's own `placeTabFor` decision). The frame then hands its live parts (the season's name,
  switcher, chip, waiting counts) to the bar through `components/admin/AdminBarPlace.tsx` in a layout effect, and the
  bar takes a hand-off only when its `key` is the address's place. **Rationale:** the bar is drawn above the frame, so
  on the server's first paint it cannot have heard from the frame; registering on mount alone would paint the club's
  name and swap it (the defect the owner named). The address alone could not carry the season's name, switcher or
  counts, which need the frame's data. Asking one shared function means the bar's first paint and the frame's first
  hand-off are the same thing (measured: the server's HTML already says "Rep teams" / "Season" with its 6 / 7 tabs), and
  the gate is the rail's own (`useOrg().canOpen`), so a person refused the place (a registrar on Rep teams, a coach on
  a season) keeps the club's name and the refusal screen keeps its heading. The key check means a frame on its way out
  can never name the next screen, and the lit tab is always the address's. **Rejected:** a portal from the frame into
  the bar (no node on the server's first paint, so it flashes the same way), and reordering the tree so the page renders
  before the bar (it breaks reading and focus order).

- **Decision (round 4, 2026-11-08): one place, two renderings, split by CSS at the sidebar's breakpoint (900/901px).**
  The place model (`clubPlaceAt` + the frame's hand-off) stays the one source. The phone bar and the desktop strip
  render it; the width decides which is shown, in CSS, as the bar, strip and rail already do (no `matchMedia`).
  **Rationale:** a JS width switch would paint the wrong one on the server's first paint and swap (the flash Phase 2
  removed); the hidden copy is `display: none`, so the page still has one `<h1>` in the accessibility tree.
- **Decision (round 4): the club cell's height IS the tab band's height** (one variable both read). **Rationale:** the
  owner's ask is that the two rules form one line; two numbers that match today drift the first time the tab row's
  padding changes.

## Plan tier

No gate. The bar is chrome on every admin screen of every plan that has the admin (club places need the Club
plan's programs; tournament screens follow the Tournament / Tournament Plus plans as today).

## Words for /marketing

> Customer-visible wording written during the build, settled in ONE `/marketing` pass per stage, before the walk.

- [ ] None new expected: the bar reuses shipped words ("Rep teams", "House league", season names, status chips,
      dates, "View site" / "Public site"). Phase 0 round 3 added none: the tournament-only org's bar is the org's
      own name, record pages reuse their shipped back-link labels and chips, and A9's "← Rep teams" is the rail's word.
- [ ] Round 4: the strip's portal word "Admin" (D4), the short form of "Admin Area". No other new words: "Overview"
      is the rail's word, the club's name is the club's.

## Open Questions

- [x] ~~A2–A10~~ ruled 2026-11-07 as recommended
- [x] ~~Phase 0's screens raise their own asks~~ → A5–A10 (round 3, 2026-11-07)
- [x] ~~Accounting's nine tabs on a phone~~ → drawn: the sideways row still serves (A5)
- [x] ~~**Owner call (from the session A /design pass, 2026-11-07): a wide desktop**~~ — **RULED on walk §492 part G
      (2026-11-07): (a) keep it, the bar spans the full width as built.** Phase 2D keeps that: the strip's name starts
      at the same left edge. Original question, kept for the record: asked as walk §492 part G. The bar runs the full width of the
      page column with its name and tabs at the left edge (as Phase 1 built it and the walk passed on Overview); a place's
      content is a centred column capped at 1200px. At 1280 they line up exactly; at 1920 the name and the tab row start
      208px left of the content they navigate (measured: tabs at 272px, content at 480px; View site at 1888, content ends
      at 1680). Before Phase 2 the paper title and tabs sat inside that column. (a) leave it: the bar is the app's frame,
      its name never moves between Overview and a place — **recommended**, it is how Phase 1's walked bar already reads;
      (b) centre the bar's row and tab row on the place's 1200px column on place screens only — the tabs sit over their
      content, but the name jumps sideways between Overview and a place at wide widths. Ask it on the phase walk.

## Found on the way (round 3, 2026-11-07; outside this project, report only)

- **Shipped phone Filter vs the 2026-10-12 ruling.** The Calendar's phone Filter (`components/coaches/FilterGroup.tsx`)
  is a pill with the word and a chevron; the 10-12 ruling says a phone's Filter is the sliders glyph alone. Drawn as
  shipped.
- **Team page: Start next season goes icon-only on a phone** (`.iconOnlyPhone`), against "the page's primary action
  keeps its words" (2026-10-20, 2026-08-11). Drawn as shipped.
- **Chat is paused**, so the round 2 drawing's Chat row and tab were wrong (fixed in v4: the phone tab reads Messages).
