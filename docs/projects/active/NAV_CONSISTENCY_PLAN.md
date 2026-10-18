# Nav Consistency: one nav standard for every sidebar and phone More sheet

**Status:** ⚖ **RULED 2026-10-17**: all fourteen asks as recommended (owner, on hub v2: *"looks good, i agree with your
recommendations"*). Build prompt written 2026-10-17: `NAV_CONSISTENCY_BUILD_PROMPT.md`. **Built 2026-10-17**, stages A–D
plus the one-club-bar ruling made at the build (§10). **Walk §331 ✅ PASSED 2026-10-18, 12 of 12** (48 steps, no
notes; QA ledger §331 closed). on prod 2026-10-18 (master job 281): the owner shipped its non-Club parts to every portal at that promote; the club phone bar goes live with the Club release.
**Hub (mockups, walk, rulings, plan, brief, QA):** https://claude.ai/artifact/RtcrWCxpfuNMkTRQMK8pA3 (source
`docs/projects/active/NAV_CONSISTENCY_REVIEW_HUB.html`, generated: see §9).
**The standard (living, binding):** `docs/agents/design/NAV_STANDARD.md`, rules N1–N9, the icon dictionary and the
exceptions. This plan is how the product gets there.
**PM brief:** `NAV_CONSISTENCY_PM_BRIEF.md`. **Home in the programme:** Club Tier Stage 8's nav review
(`CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6); it also carries the tournament admin redesign's §12.6 shared-frame items.

---

## 1. What the review found

- **Type is already one design.** The club and tournament sidebar (`AdminKitRail` + `AdminKitFrame.module.css`) is a
  value copy of the Premium coach sidebar (`CoachesSidebar` + `coaches.module.css` ~1055–1150): 14px rows, 10px capital
  headings, 14px icons, one olive active state. The owner's three captures sample to the same ink (#615A54). Every
  phone bar shares one stylesheet (`CoachesBottomNav.module.css`).
- **The grammar differs:** heading spacing (club labels 13.6px above, folding headings 10.4px); a chevron on Public
  site, which opens one page; three different sidebar feet, the admin's duplicating Sign out and Send feedback with the
  account menu; icon collisions (the trophy is Tournaments, Results and Season's End; the clipboard is Schedules and
  Tryouts; Public site has three icons; `UserCheck` is Check-in and the admin sheet's Coaches Portal); four More-sheet
  orders; "← Back to club" against the 2026-07-31 destination rule; the free sidebar's own row style.
- **Doors missing on a phone:** the admin More sheet has no Help; the Premium coach has no Account, Home or Send
  feedback on a phone (the top strip that carries them is `display: none` ≤900px); the club sheet has no door to the
  Organization page; tournament Accounting has no phone door and never lights up on desktop.

## 2. The rulings (2026-10-17, all as recommended)

| Ask | Ruled |
|---|---|
| A1 | Group headings 11px, in the sidebar's face, in the sidebar and the More sheet |
| A2 | A chevron only on a row that can open pages under it (Public site loses its own) |
| A3 | The whole icon dictionary (twelve icons change; `NAV_STANDARD.md`) |
| A4 | "Rep Teams" → "Rep teams", with the one-spelling sweep (help articles, their search words, marketing pages) |
| A5 | "← Back to club" → "Club overview" |
| A6 | The admin top strip names its portal "Admin Area" |
| B1 | One sidebar foot: Help, the other portal, Collapse sidebar; Sign out and Send feedback in the account menu only; the foot's Public site only where the sidebar has no Public site row |
| B2 | One More-sheet order for every operator portal (N7); admin gains Help; Premium coach gains Account, Home, Send feedback, Download app; free coach gains Send feedback, Download app |
| B3 | The Organization page gets its phone door (first row of the Organization group) |
| B4 | Tournament Accounting joins the Admin group, and gets a phone door |
| C1 | Tiles in the club and the tournament More sheets |
| C2 | Tournament tiles on game day only: Check-in, Staff kit, Teams (they stay listed in Operations) |
| C3 | Club tiles: Calendar, Schedules, Families |
| D1 | The free coach sidebar takes the paid sidebar's rows only; its width and team header stay (P5, 2026-10-15) |

**Not ruled, and not to be built:** one sidebar width (considered, left: an exception); a tile set in every tournament
phase; the tournament bar's "Messages" label (one page, two names; open for `/marketing`); adding "Rep Teams" to the
spelling gate (a proposal: the gate widens only on an owner ruling, so ask at build start).

## 3. The stages, and where each change lands

Build order A → B → C → D. Each stage is its own commit and its own walks. Re-derive every line reference below from
today's code; they were read on 2026-10-17.

### Stage A · Same words, icons and headings (N1–N3, N5, N6)

1. **Headings (A1).** `AdminKitFrame.module.css` `.label` and `.groupHeader`, `coaches.module.css`
   `.sidebarGroupHeader`: `--type-label` (11px), padding `0.75rem 1.25rem 0.35rem`, no extra margin. The More sheet's
   `.dropSectionLabel` (`CoachesBottomNav.module.css`): `--type-label`, the sans face (drop its
   `font-family: var(--font-data)`), `0.1em` tracking. ⚠ The club rail's `.subLabel` (a rep team's or a season's block inside a
   program) is a heading too: bring it to 11px if the indent holds, and record the call. The free sidebar has no
   headings.
2. **Chevrons (A2).** The full rail's program chevron shows when a program can open pages under it: more than one page,
   or House league (a season's block). Public site (one page, the site editor) shows none. Coach heading chevrons take
   the admin's 55% (`.sidebarGroupChevron`).
3. **Icons (A3)**, where each lives today:
   - Overview → `LayoutGrid`: `CoachesSidebar` (Overview) and `CoachesBottomNav` (tab); the free shell's Overview
     (`CoachPortalShell`, `CoachFreeBottomNav` / `lib/coach-free-nav.ts`).
   - Tournament Dashboard → `Gauge`, Results → `Medal`, Public site → `Globe`, Tournaments list → `Trophy`:
     `components/admin/admin-nav-config.ts` (the bar and the strip read the same config; confirm).
   - Schedules → `ChartGantt` and Members → `IdCard`: `lib/admin-kit-nav.ts`.
   - The rail foot's Public site → `Globe` (`AdminKitRail` foot, `Home` today).
   - Season's End → `Archive`: `SEASON_END_ITEM` in `CoachesSidebar` and the bar's closed-season tab.
   - Email families → `Mail`: `CoachesSidebar` and `CoachesBottomNav` `MORE_SECTIONS`.
   - Free Schedule → `Calendar`, Fees → `DollarSign`: `lib/coach-team-tools.ts` (feeds the free rail and its tiles).
   - Coaches Portal (admin More, You) → `Users2` (`UserCheck` today).
   Page content icons (a dashboard card, a help illustration) are outside N5: list any collision found, don't change it.
4. **Words.** "Rep teams" (A4): every customer-visible string (labels, headings, page titles, toasts, help articles
   and their `keywords` / `searchText`, marketing pages, demo tour narration, email copy); never identifiers, routes,
   CSS or ids. About 250 hits across `lib/`, `app/`, `components/` include identifiers: classify before changing. If
   `PLAN_PRICING_FACTS.md` names the module "Rep Teams", stop and flag `/strategy` (the Facts doc is canonical).
   "Club overview" (A5): `AdminKitBottomNav` (the "Back to club" row, `LayoutGrid` icon). "Admin Area" (A6):
   `AdminTopStrip` gains the coach strip's divider and label (`CoachTopStrip.module.css` `.stripDivider`,
   `.stripLabel`, already its stylesheet); read the word from `lib/workspace-labels.ts`, never retype it.
5. **Small fixes (no ruling needed).**
   - Tournament groups show closed for a frame on first load (`TournamentRail` starts from an empty set): start from
     the status defaults, then apply the stored set, as `CoachesSidebar` does.
   - Tournament Accounting (`active={false}`) and the tournament-only "Tournaments" row (`active={false}`) never show
     as current: give both a real active test.
   - `CoachesBottomNav` tabs: `aria-current="page"` and `aria-hidden` icons, as the admin and free bars have.
   - `CoachesBottomNav` sheet rows and tiles close the sheet on tap (today they wait for the route change, so tapping
     the page you're on may leave it open; confirm).
   - The admin phone bar stays reachable behind an open form; the coach bar hides (`useOverlayOpen`,
     `lib/coaches-overlay.tsx`, the 2026-09-23 rule). ⚠ The admin shell doesn't mount the overlay provider and its
     windows don't enroll. Measure the scope first: if it means enrolling every admin window, report it to the owner as
     its own unit of work instead of building it here.
6. **Carried in from the tournament redesign's close-out (its §12.6).**
   - F39 (the free plan's phone bar gave a tab to Chat, a paywall): looks fixed by the 2026-10-16 phase bar (the slot
     opens Communications, labelled "Messages", where a plan has no Chat). Confirm and record; the label stays open.
   - The context strip's two count phrasings (`AdminContextStrip`: "N games to finalize", "N teams to review"): read
     that plan's §3 F39 for what was meant; if they already match, record that.
   - The "teams to review" link is 22px tall: the 44px tap floor on a phone.
   - The rail's "Editing tournament" picker spills 111px at a desk: keep it to the rail's width, the name shortening.
   - F90 (the header's Public site pill is computer-only): no change (N4: the Public site page's door covers it).

### Stage B · One foot, one More sheet (N4, N7; B1–B4)

1. **The sidebar foot (B1).** `AdminKitRail`: Help, Coaches Portal, Public site (only when no Public site program row
   is in the rail; today's other conditions stay), then Collapse sidebar. Send feedback and Sign out leave the rail;
   `AdminTopStrip`'s `AccountMenu` already holds both (⚠ it is hidden in the demo sandbox, where the rail's Sign out
   must not render either). `CoachesSidebar`: the foot rows go from 14px to 12px. The free foot already leads with Help.
2. **The admin sheet (`AdminKitBottomNav`), in N7's order.** Club: Notifications first; "More programs" → "Programs";
   the Organization group opens with the Organization page (B3; the rail's gates); You = Account, Home, Coaches Portal;
   foot = Help (new, the rail's help link, new tab), Send feedback, Download app (`!isStandalone`), Sign out; the
   Public site mirror only where no Public site row is in the sheet. Until Stage C, Calendar and Schedules stay full
   rows under Notifications. Tournament: Club overview and the picker, Notifications, Operations · Setup · Admin with an
   icon on every row (today's rows have none), Accounting in Admin (B4: move it into the tournament groups' config so
   the rail and the sheet read one list, and the rail's separate row goes), You, foot as above (the Public site mirror
   goes: Setup's Public site page opens with "See your public site").
3. **The Premium coach sheet (`CoachesBottomNav`).** A You group after Team: Account (`/account?back=…`, as the free
   bar does), Home (the admin sheet's href), Admin (owners and admins, moved from the foot). Foot: Help, Send feedback
   (`FeedbackWidget`; hidden in the demo sandbox, as the account menu's is), Download app (`!isStandalone`, the
   `flhq:show-install` event; confirm `InstallAppPrompt` listens on coach pages, it is mounted in the root layout),
   Sign out. ⚠ You is account chrome, not a nav group: it stays out of `MORE_SECTIONS`, which
   `coach-nav-groups.test.ts` pins to the sidebar. ⚠ The closed-season sheet (one door, CLAUDE.md) keeps only what it
   shows today plus You and the foot; never a live row.
4. **The free sheet (`CoachFreeBottomNav`):** the foot gains Send feedback and Download app. B2 leaves its Scores row
   alone.
5. **Measure the sheets' height.** The 2026-09-20 aim: every entry on screen at 844 for a one-team coach. You plus the
   foot add about 100px; measure at 844 and 780 and report what scrolls.

### Stage C · Tiles in the admin sheets (N8; C1–C3)

Reuse the coach sheet's `.hotTiles` / `.hotTile` (same stylesheet). Tile labels are the nav labels, one line at 360px.
- **Club:** Calendar · Schedules · Families, right after Notifications. Shown only when all three are available (their
  links' existing gates). Fixed tiles: Calendar and Schedules leave their full rows, Families leaves Programs. ⚠ If
  some plan puts Families on the bar, the ruling doesn't cover it: stop and ask (recommend no tiles then).
- **Tournament:** game day only (the bar's game-day test, so Completed and Archived show none): Check-in · Staff kit ·
  Teams, after the picker. They stay listed in Operations. None on a plan without Check-in or Staff kit.
- Extend `admin-kit-nav.test.ts`: the sets, game day only, the gates, the one-line rule.

### Stage D · The free coach's rows (N9; D1)

`CoachPortalShell.module.css` `.railLink` / `.railLinkActive` take the paid row: 14px, 400, the sans face, 14px icons
(`CoachPortalShell` passes 17 today), `0.5rem 1.25rem`, no radius, full-bleed (the rail's side padding moves to the
header block), the active row = the olive tint, `--blueprint-light` ink, 600, no `::before` bar. The width (248) and
the team header stay (P5). The folded strip keeps its own sizes (`sidebar-strip-guard.test.ts`).

## 4. Risks to check in the build

- **One stylesheet, four sheets:** the heading change lands on every phone sheet at once (intended); check each.
- **Tour anchors:** the demos' tours may point at nav rows that move or rename. `check:demos` fails on a lost anchor;
  fix the anchor, not the tour's story.
- **Help:** articles that say the admin signs out from the sidebar, "Back to club", "Rep Teams", what the More sheet
  holds, which icon means what. `/docs` after Stage B.
- **The account menu is hidden in the sandbox**, so the sandbox loses the admin rail's Sign out, which it must never
  show anyway. Check the sandbox's Send feedback the same way.
- **Coach layouts are tuned to the 220px sidebar.** Nothing here changes a width; if a change seems to need one, stop.

## 5. Gates

`npm run verify:changed`, `npm run typecheck` (shared shells), the nav guards (`admin-kit-nav.test.ts`,
`coach-nav-groups.test.ts`, `coach-free-bar-guard.test.ts`, `sidebar-strip-guard.test.ts`), `check:demos`,
`check:css-selectors`, `check:contrast` + `check:text-contrast`, `check:spelling`. A guard for this project
(`tests/unit/nav-standard-guard.test.ts`): every nav config row's icon matches the dictionary; no nav label starts
"Back to"; the admin and coach sheets render You and the foot in N7's order; the tile sets and their gates.
`check:layout --changed` on a few club, tournament and coach screens, Warm and Dark (never a whole-product sweep on the
dev server). Then `/simplify` (tiles become a shared pattern), `/review` at the high-risk tier, a `/design` pass on the
built result against the hub (1440 and 390, Warm and Dark), `/docs`, and `/marketing` for the marketing pages' "Rep
teams".

## 6. Walks

One Owner QA ledger section, walks one purpose each, on the hub's QA tab: the club and tournament sidebars (headings,
chevrons, icons, foot); the coach and free sidebars; the words (Rep teams, Admin Area, Club overview); signing out and
sending feedback from the account menu; the club More sheet; the tournament More sheet on game day and before it; the
coach More sheet (You, Send feedback, Download app); the small fixes. UAT fixtures, passwords from `.env.local`.

## 7. Rollout

No migration, no data change. One release; phones and computers change together. No demo reseed. The release's
whole-product layout sweep runs on staging (`/release` §1d-5).

## 8. Records

The standard (`NAV_STANDARD.md`) holds the rules; each stage's as-built note goes in §10 here. Design log entry
2026-10-17 ("ONE NAV STANDARD…"). TODO line under the Club Tier formatting standard.

## 9. The hub is generated

`.probe/nav-hub-build.cjs` + `nav-hub.css` + `nav-hub.js` + `nav-hub.src.html` build the hub's HTML (drawings are
data; lucide icons are read from `node_modules`; captures inlined). `.probe/` is gitignored and may be gone: then edit
the built HTML in place (read the live copy in full first) and keep its scripts parsing.

## 10. As built (2026-10-17, one session)

**Build-start calls (owner):** "Rep Teams" joins the spelling gate (yes); the admin phone bar hiding behind open forms
is its own unit of work (yes — measured: the admin's shared window doesn't enroll in the overlay signal and ~70 admin
screens open windows; the cheap route is teaching the shared window to enroll). Another session built Club Stage 5b
(Families) in the same working copy at the same time; owner: keep building, commit only this build's hunks.

**Stage A — words, icons, headings.** Committed `0ddccf89`. Headings 11px with one spacing in both rails and every
sheet (the club rail's `.subLabel` too: the indent holds); chevrons only where a row opens pages (`opensPages`: more
than one page, or House league); the twelve icons (plus the context strip's finalize link → Medal, the free bar's
Overview → LayoutGrid); "Rep teams" through 112 customer-visible lines in 60 files (help, plan lists, marketing pages;
comments and identifiers left), gated by `check:spelling` (`rep-teams-case`); "Club overview"; "Admin Area" from
`WORKSPACE_KIND_LABEL`. Small fixes: tournament groups seed from defaults; the Premium bar's `aria-current` and hidden
icons; its sheet rows and tiles close on tap. **Recorded, not built:** the "two rows that never light up" were not
defects (tournament-only plans never carry Accounting; a club's Accounting opens the club rail, which lights it; the
tournament-only Tournaments row's page wears the tournament rail, which lights it); the "teams to review" 44px link and
the picker's spill were fixed by `07c2af40` (2026-10-14) — the layout baseline still lists both until the next staging
sweep; F39 confirmed fixed by the phase bar (Messages stays an open wording call); the context strip's two count
phrasings already match ("N games to finalize" / "N teams to review"), recorded as-is. **Departure:** the More sheet's
heading keeps its compact spacing (0.5rem / 0.125rem) — the sheet is height-limited; the rails take N2's 12/6.
**Kept verbatim:** a retired campaign body (mig 284 is the live copy; `spelling-ok`). **Owed elsewhere:** campaign
templates seeded in the database (migs 179, 198, 284) still say "Rep Teams" — a new migration's call, not a nav one.

**Stage B — one foot, one More sheet.** Committed `3ea6f854`; help `07d25d32`. The admin rail's foot is Help ·
Coaches Portal · Public site (only where no Public site program row is drawn); Sign out and Send feedback left it; the
coach foot is 12px. The admin sheet in N7's order with Help, the Organization page's door, an icon on every tournament
row, Accounting in Admin (moved into the groups list, `accountingHref`); the Premium sheet gains You and the foot;
the free sheet gains Send feedback and Download app. **Owner call at the build:** the free layout never mounted the
install prompt, so the free shell now mounts it and the manifest on its signed-in portal pages only (never sign-up or
checkout). **Found and fixed:** the phone sheets showed Sign out in the demo sandbox (desktop hides the account menu
there) — now hidden with Send feedback. **Measured (390 wide):** at 844 every sheet fits; at 780 the club sheet scrolls
17px and the tournament sheet 54px (Download app and Sign out below the fold); the coach sheet fits at both; no free
fixture to measure.

**Stage C — tiles; then ONE club bar.** Committed `331c4019`, then re-ruled the same day. The owner, shown the
Families-tab drawing (hub artifact VpoKerYm88kbzaNL2etzR9): "put overview, calendar, rep teams, accounting, more in all
navs. the three at the top of more will be schedules, house league, and families in all instances." Two calls at the
build: a door the person or plan cannot open is **filled from Programs** (owner's choice over leaving it out), and
House league is a tile **only once the club runs it** (recommended, kept). Built as one pure rule, `lib/nav-tiles.ts`
(`clubPhoneNav`), recorded as N10 in the standard. Tournament tiles: game day only, all three or none, still listed in
Operations. One tile row for both sheets (`MoreSheetTiles`); a tile carries its waiting count.

**Stage D — the free coach's rows.** The paid row recipe (14px, 400, sans, 14px icons, full-bleed, olive tint, no
bar); the width, the team header and the folded strip's own look stay.

**`/simplify`:** one sheet foot for all three bars (`MoreSheetFoot`: order, sandbox rule, install eligibility via
`isInstallEligibleBrowser`, sign-out); tournament row addresses and "Public site in the nav" resolved once in
`useAdminKitNav`; a simpler `clubPhoneNav`; one install prompt per page (the record page's own copy removed — its
"…for live game updates" wording goes with it; this also ends a double banner the Premium record page already had).

**`/review` (high-risk):** four lenses. Fixed: Account, Home and Download app also lead out of the demo sandbox (hidden
there now, both sheets); waiting counts kept on tiles and Programs rows (Families' duplicates had fallen off the phone);
the tournament Accounting row lights on its page; feedback reports the page you're on (mounted on open); the feedback
window counts as an open window in the coaches portals; Help closes the sheet a beat after the tap; the free strip's
active tile keeps its lime look. Not changed (advisory): a filled tab appends rather than taking the gap; plan-only
programs share "Programs" on the phone; the coach's own tile row can show two tiles when an assistant lacks a tool;
tournament groups still settle a frame after load when the event is past draft. `check:layout` not run: the shared
bar puts all 271 screens in scope, and a whole-product sweep is the release's, on staging.
