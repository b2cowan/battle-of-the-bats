# Free coach header — the phone — build prompt

> Paste into a fresh session on `dev`. Written 2026-10-15, after the owner ruled the phone step: the direction on the
> first round, then all five asks on the redraw, every one as recommended.
>
> **Where it comes from.** The 2026-10-13 ruling (*"the account dropdown and notifications bell should be the same for
> free tier coaches"*) was split: computer first (committed `ad0267e4`), phone next. On the phone's first drawing the
> owner set the direction: *"I'm kind of thinking we need to make it more like the premium portal with using the nav at
> the bottom and not the main page nav, so have overview, tournaments, chat and more. when they add the basic modules we
> just add them to more (i.e. roster or schedule)"*. On the redraw: *"looks good, want to write up the build prompt?"*.
>
> **The spec is the hub:** https://claude.ai/artifact/EA2D38WeFe9mk4Qji9535y, **version 12 or later**, Mockup tab →
> **Phone** stage (source `docs/projects/active/FREE_COACH_HEADER_PARITY_HUB.html`, rebuilt by `node .probe/fchp/build.cjs`
> from `.probe/fchp/hub.src.html` + `.probe/fchp/phone.cjs`; edit those, never the built file). Screens 2–6 are the
> visual spec at true size (390 × 844) in Warm and Dark; every NEW / RESTYLED / UNCHANGED tag's note says what changes
> and why; screen 1 holds real captures of today, free and paid; "Design check" holds both `/design` passes. Plan of
> record: `FREE_COACH_HEADER_PARITY_PLAN.md` §9 (§9.1 today's code, §9.4 the rulings). PM brief beside it. Design log:
> `memory/design_decisions.md` 2026-10-15.

## The rulings, in one place

**At 900px and below, the free coaches portal takes the paid portal's shape.**
1. **The bar:** **Overview · Tournaments · Chat · More**, in the paid bar's look, order and mixed case. It **never
   changes as tools are turned on.** Overview lights on the team's Overview; Tournaments on the team's tournament list,
   the account-wide list and every record page of that team (the shell's existing `sectionActive` rule); Chat on the
   portal's chat; More while open, and on every page More leads to (Notifications, a tool, Explore).
2. **The section row under the team header retires on a phone.** The header keeps the eyebrow, the team name (still the
   multi-team switcher), the chip and event line, and the Flip in a tournament. Drawn at 88px, from 133px.
3. **More** (a menu-layer sheet on the bar, the paid sheet's frame): **Notifications** first, with the unread count; then
   the team's **turned-on tools as tiles** in the tools' own order (Roster · Schedule · Fees · Announcements) with
   **Explore always the last tile** (P3); then a small-capitals "The app" group: **Home** (`/discover`), **Scores**
   (`/scores`), **Account** (`/account?back=<the page>`); then the paid foot, **Help** (the coaches guide, new tab) ·
   **Sign out**.
4. **The bell's count rides More**, in the paid bar's count style (olive in Warm, lime in Dark), hidden while the sheet
   is open; the Notifications row carries it too (the paid `dropCount`). The free bell's own scope (`TEAM_COACH_BELL`).
5. **Notifications** is the paid Notifications page inside the free portal: the bell tile and title, the settings gear
   and "?" in the title row, Unread / All, Mark all read, Needs attention with Done, the days, the shared reader. More
   lit, **no Back arrow** (the 2026-09-25 rule), and **no team header** on that page (design check RDC1: the list covers
   every team the coach has, as the paid page has no masthead).
6. **Chat** in the bar opens the portal's chat (`/coaches/team/{id}/chat`, the A1 screen, or its waiting screen); its
   unread count is the paid bar's chat count. **The tab hides while the coach has no chat and none is coming** (P2: the
   10-13 A1 rule, the same answer the left menu uses) — the bar is then Overview · Tournaments · More.
7. **Notification settings gets no new card. The Pause switch shows for every account that coaches a free team**, followed
   or not (P4). This fixes a defect shipped in `ad0267e4`: a coach whose team is still pending follows nothing and holds
   no club role, so the page showed *"Nothing to manage here yet … once you … coach a team"* and no Pause switch.
8. **The computer is unchanged** (P5): the paid strip, the 248px left menu, the team header band. Nothing in this build
   renders above 900px except the Notifications page (old links and help still land there) and the settings fix.

**Costs the owner accepted:** Home and Scores are two taps and open the fan app, whose bar replaces the team bar (the way
back is Home's Coaches Portal card, as for a paid coach); Explore is no longer one tap away (the 2026-07-27 B3
criterion); this is a larger build than a header change.

## Read first

- The hub's Phone stage, all screens and both design checks, and plan §9 (all of it: §9.2 has the verified facts, §9.4
  the rulings).
- **Code (verified 2026-10-15; if anything here disagrees with the code, the code wins and you say so before
  proceeding):**
  - `components/coaches/CoachPortalShell.tsx` (+ `.module.css`) — the free shell: mounts `ConsumerNav variant="coach"`
    as the phone bar; renders `.tabRow` (sections + Explore last, and a "Get started" pill for a zero-team coach) under
    the sticky header at ≤900; the rail at ≥901 with Chat via `useChatDoor` and Help at the foot; team context from
    `/api/coaches/basic-teams?context=1` (`activatedFeatures`, registrations), refetched on every route change; the
    keyboard rule `.shell:has(input:focus, textarea:focus) nav[aria-label='Primary'] { display: none }`; `.content`
    pads for a 72px bar ≤900; `--coach-mhead-h` is measured by a ResizeObserver (the record page's quick-jump row
    stacks under it).
  - `components/coaches/CoachesBottomNav.tsx` (+ `.module.css`) — the paid bar: z-index 300, 72px + safe area; tab
    counts (`.tabCount`), the More sheet (`sheetScrim`, `dropdown`, `sheetGrab`, `dropItem`, `dropCount`, `hotTiles`,
    `dropGrid`, `dropSection`), Notifications first, Help · Admin · Sign out at the foot. It reads `useOrg()`,
    `useCoaches()` and **`useAnyOverlayOpen()`, which THROWS without `CoachesOverlayProvider`** — it cannot be mounted
    in the free tree as it is. Its source is read by guard tests (`coach-nav-groups`, `coach-first-screen-guard`,
    `coach-people-phone-guard`, `install-banner-layer-guard`, `kit-dialog-floor-guard`, `sheet-frame-guard`,
    `coach-history-endpoint-guard`): a refactor keeps every one green and changes none of their assertions without
    saying why.
  - `lib/coaches-overlay.tsx` — the provider lives in `app/[orgSlug]/coaches/layout.tsx`; `useOverlayOpen` throws
    without it; `useOverlayOpenIfAvailable` is the tolerant variant (`SheetFrame` uses it for form-layer sheets).
  - `components/coaches/CoachNotificationsPage.tsx` + `app/[orgSlug]/coaches/notifications/page.tsx` — the paid page;
    it reads `useOrg()` for `orgBell(...)` and builds a `?focus=coach-{slug}` settings link and a Premium help pointer.
    `CoachPageHeader`, `NotificationFeedBody`, `NotificationReader` (a menu-layer `SheetFrame` ≤900) and
    `useNotificationFeed` do not read the org.
  - `lib/notification-bell-scope.ts` (`TEAM_COACH_BELL`), `lib/use-notification-unread.ts`, `lib/use-chat-door.ts`
    (`{ show, unread }`), `app/coaches/team/[basicTeamId]/chat/page.tsx`, `lib/coach-team-tools.ts` (`COACH_TEAM_TOOLS`,
    the order), `lib/coaches-portal-routes.ts` (`isCoachPortalShellPath` — `/coaches/notifications` is NOT in it today).
  - `components/consumer/ConsumerNav.tsx` — the `coach` variant is today's free phone bar and nothing else uses it.
  - `app/(consumer)/account/notifications/page.tsx` + `AccountNotificationsClient.tsx` — the empty state wins when
    there are no cards and no fan card (no Pause); `lib/user-contexts.ts` has `coaches_basic` contexts
    (`coaches-basic:teams`, `coaches-basic:tournament-records`, and `coaches-basic:claimable` for a coach with no team
    yet). `app/(consumer)/account/AccountReturnBar.tsx` already labels a `/coaches/…` `?back=` "Back to your Coaches
    Portal".
  - `lib/help-content/coaches.tsx` — the getting-around section's "On a phone" definition, `faq-coach-nav-moved` and
    `faq-coach-free-bell` describe the fan bar and a computer-only bell.
- **Memory:** `project_free_coach_header_parity`, `decision_drawer_layers_form_vs_menu` (a form covers the bar, a menu
  sits on it; covering is not taking away — keyboard and screen reader too), `feedback_build_to_approved_mockups`,
  `feedback_qa_walkthroughs_as_checkable_artifacts`, `reference_partial_commit_shared_tree`,
  `reference_code_gotchas_index`, `reference_hub_script_parse_trap`.

## Preconditions (check before code)

1. **The UX summary for the owner comes first** (AGENCY_RULES), short and in product words, then B1–B4 below.
2. **HEAD has `ad0267e4` (the computer strip and the free bell) and `c3ba568f` (the registration notice).** If not,
   stop and say so.
3. **The test world:** the FCHP world on dev (`.probe/fchp-build/seed-fixture.mjs`; "reset FCHP" rebuilds it): Avery
   (`fchp-coach-a`, FCHP Otters, FCHP Plus Cup — chat coming, notices in the bell), Blair (`fchp-coach-b`, second coach
   on Otters, also an admin of FCHP Plus Club), Casey (`fchp-coach-c`, FCHP Badgers, FCHP Free Cup — no chat). Password
   `devpass123`. Turning a tool on for Otters writes to dev; reset afterwards. Ask the owner before creating any other
   dev data.
4. **One browser tester at a time:** ask whether another session is using the dev server before any probe, sweep or
   auth setup. The dev server restart rule applies (new files, shared modules, the shell).

## Build-start questions (ask, with the recommendation)

- **B1 · One bar for both portals.** *Rec.:* extract the paid bar's **presentation** (the bar, a tab with its count, the
  More sheet's frame, its tiles, rows, groups and foot) into one shared component that both portals mount with their own
  items and counts, as the strip was shared on 10-13 (one component, a free mode, so the two cannot drift). The paid
  bar's behaviour (season gating, closed-season door, hot keys) stays in its own wrapper. *Alt.:* a `free` mode inside
  `CoachesBottomNav` (it reads org, season and overlay contexts unconditionally — more branching in a file seven guard
  tests read). *Rejected:* a second bar that copies the stylesheet.
- **B2 · The overlay safety net in the free portal.** *Rec.:* mount `CoachesOverlayProvider` in the free coaches layout,
  so a form-layer sheet takes the bar out of reach of thumb, keyboard and screen reader exactly as in the paid portal (the
  2026-09-23 ruling), and the free bar hides by the same counter. Then audit every free-portal sheet, window and popover
  against a bar at z-index 300 (they were built over the fan bar at 200). *Alt.:* the free bar ignores overlays —
  geometry only, the defect that ruling's `/simplify` pass named.
- **B3 · Which team the bar points at when the page has none** (a multi-team coach on `/coaches`, the account-wide
  Tournaments list, Notifications), **and a coach with no team yet** (not drawn). *Rec.:* the last team the coach opened
  on this device, else their first team (the paid fallback's shape); a zero-team coach's Overview opens Get started,
  Tournaments the account-wide list, Chat by its rule, and More has no tool tiles. *Alt.:* on a page with no team the
  team tabs go to the portal's home.
- **B4 · Measuring the re-chrome.** The layout sweep's screen list has no free-portal screen and no saved sign-in holds a
  free team, yet this changes every free phone page. *Rec.:* `/uat` makes a free-coach fixture and the free portal's
  phone screens (Overview, a record page, More open, Notifications, Chat) join the sweep's list, so they are measured
  like the paid portal from now on. *Alt.:* probe-only on the FCHP world, as the computer build did.

## The build, in parts (each part matches its drawing; a visual difference found mid-build is a question for the owner)

1. **The shared bar (B1) and the free bar.** Four tabs, fixed: Overview, Tournaments, Chat (hidden per rule 6),
   More. Labels and icons as drawn (the paid bar's Overview grid icon, the trophy, the chat bubble, the ellipsis). The
   paid bar's look and behaviour unchanged, pixel for pixel. Hidden at ≥901 by the same rule as the paid bar.
2. **The shell at ≤900.** Mount the free bar where `ConsumerNav variant="coach"` was; retire the `coach` variant and its
   `chatBackPath` plumbing if nothing else uses them (grep first; the fan Chat's `?back=` link may stay, it is harmless);
   stop rendering `.tabRow` (and its zero-team pill) on a phone; keep the header's other parts; keep the keyboard rule
   for the new bar (a focused field hides it); `.content` keeps clearing a 72px bar; `--coach-mhead-h` re-measures the
   shorter header (check the record page's quick-jump row sits flush under it). Hide the team header on the Notifications
   page (rule 5).
3. **More** (rule 3), as drawn on screen 3, in its three states (no tools; Roster and Schedule on; no chat). Tool tiles
   come from the team's `activatedFeatures` in `COACH_TEAM_TOOLS` order; turning a tool on in Explore or the Overview
   setup panel adds its tile on the next route change (the shell already refetches). Explore's tile wears the dashed edge
   drawn. "The app" is a new label: run it past `/marketing`. Account opens with `?back=` so the account pages pin "Back
   to your Coaches Portal". Sign out = the paid sheet's (`signOut`, then `/auth/login`).
4. **Notifications.** A free route `/coaches/notifications` (added to `isCoachPortalShellPath`) rendering the SAME page
   component as the paid route, given the bell (`TEAM_COACH_BELL` here, `orgBell` there), the settings link
   (`/account/notifications?back=/coaches/notifications`) and the help pointer (the free bell's FAQ,
   `faq-coach-free-bell`). Never a copy of the page.
5. **Chat in the bar** (rule 6): `useChatDoor` decides the tab and its count, the same hook the left menu uses; the tab
   opens the current team's `/coaches/team/{id}/chat`.
6. **Pause for every free coach** (rule 7): the settings page passes whether the account coaches a free team (a
   `coaches_basic` teams or tournament-records context; say whether a claim-only coach counts) and, when it does, renders
   the Pause card and the device card even with no workspace cards and no follows. The empty state stays for an account
   with nothing at all. Both portals' settings doors already land on this page.
7. **Help** (`/docs`): the getting-around section's phone definition, `faq-coach-nav-moved` (the bar is now the team
   bar; Home and Scores live in More; tools join More), `faq-coach-free-bell` (the bell on a phone: the count on More,
   Notifications first), and any article that says Chat leaves the portal on a phone. Keywords and `searchText` too, one
   spelling throughout.
8. **Stale words in code:** `CoachTeamSetupPanel.tsx`'s header says Explore stays "a permanent tab"; the shell's header
   comment describes the fan bar; fix comments that now describe something else.

## Not in this build

- The computer: the strip, the left menu, the team header band (P5 — leave them).
- The paid bar and paid More beyond the B1 extraction. **A follow-up to raise, not to do:** the paid More has no
  Account row and no Warm / Dark control on a phone; the free More now does.
- Push for a free coach's bell notices (bell-only by design; game changes already push through the auto-follow).
- The `/strategy` amendment of the 2026-07-25 "Two-family experience model" entry (owed; the design session offered it
  to the owner) and any change to the "tournament companion" words on `/for-coaches` that `/strategy` routes to
  `/marketing`.
- The fan app's own bar (Home's invitation count, its Chat) everywhere outside the free portal: unchanged.

## Running beside other work

- **Other sessions share this working copy.** Stage explicit pathspecs only; after every commit run `git show --stat
  HEAD`. Re-check the branch before committing.
- **The free tournament tier build** (`FREE_TOURNAMENT_TIER_BUILD_PROMPT.md`, queued) redraws the same coaches' world (an
  invite-only free event); it does not touch the shell or the bars as written. If it is in flight, coordinate before
  editing `CoachPortalShell` or the coaches help module.
- **The hub** may be edited by another session: targeted edits only, rebuild from the current source, parse the three
  scripts, and read the live copy before publishing.

## Verification

- **Unit:** every guard test that reads `CoachesBottomNav` stays green; add one guard for the free bar (four tabs and
  only four; tools and Explore only in More, Explore last; Notifications first in More; Chat hidden without a door; the
  free page and the paid page are one component) and a test for the settings branch (a free coach with no follows gets
  Pause). `npm run typecheck` (shared modules, routes), focused lint, `npm run verify:changed`.
- **Rendered:** at 390 × 844 and 360 wide, Warm and Dark, on the FCHP world: Avery (four tabs, count on More,
  Notifications page, the reader, Chat inside the portal), Casey (three tabs), Avery with Roster turned on (a Roster
  tile, the bar unchanged; reset after), a record page (Tournaments lit, the quick-jump row flush), a form-layer sheet
  open over the bar (B2), a focused field (the bar hides), Account from More (the way back pinned). Then `/design` at 390
  against hub screens 2–6. `check:layout --changed` on the screens it knows; B4 decides the rest.
- **Reviews:** offer `/simplify` (B1 is a new shared abstraction), then `/review`; `/docs` for Part 7.
- **The owner's walk:** a new ledger section and a walk on the hub's QA tab (`.probe/fchp/qa-data.cjs`), one purpose per
  walk, each naming the account, the URL and the password; every writing step names the row it leaves behind.
- **Commit only on the owner's word.** Record the hash in plan §9 and the brief, and the build on the hub's stage strip.
