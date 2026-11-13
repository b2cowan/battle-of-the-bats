# Build prompt — Navigation, Phase 6b: the "?" moves into the strip and the bar (tournament admin, club, and the Coaches Portal's off-team pages)

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-13 from the owner's rulings on the drawing
> (https://claude.ai/artifact/WqQZeay2h4xyCnTGzt7E8D v2, source `docs/projects/active/ADMIN_NAV_PHASE6_TOPROW_DRAWINGS.html`;
> owner: "I agree with your recommendations" = **T1–T6 all as recommended**, including T6·1 and T6·3). Plan of record:
> `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` §5 — the bullet "Owner review owed … the page's top row" (the drawing record
> and the rulings line), **Phase 4b** (R1–R6, the Coaches Portal's "?" in the strip), **Phase 5** (F3, the phone bar keeps its "?").
> Index: `ADMIN_NAV_BUILD_PROMPTS_INDEX.md` row 6b. **Model: Opus** (a help panel that must be lifted out of the page into the
> chrome, one rule across three portals, a content-matching pass for 44 club screens). Helpers read on Sonnet; **a helper's summary is
> a lead — open the cited lines yourself before building on a claim.** Where this prompt and the plan differ, the plan wins; where
> the plan and the CODE differ, the code wins — say so out loud and record it.
> **No gate: the drawing is ruled. Build to it.** Anything the drawing does not show gets drawn and ruled first, not invented here.

## The one-paragraph version
Help's place becomes the same in all three portals: **the page's "?" sits in the top strip between the bell and the account button
(computer) and is the last control in the phone bar**, and the page's own row stops carrying it. The Coaches Portal's team pages
already work this way (walked §517, §519). This phase brings over (1) the **tournament admin** (13 screens carry a "?" today; 8 do
not and get a topic), (2) the **club** (no page has a "?" today — this is an *addition*; every club place and tab gets a topic), and
(3) the **Coaches Portal's three off-team pages** (notifications, Plan & billing, Join a club). A row that held only a "?"
disappears (first content moves up ≈50 px on a computer, ≈52 px on a phone). A row that holds buttons stays and just loses the "?".

## Rulings, as specification (owner 2026-11-13, all as recommended)
- **T1 · Position.** Admin strip order becomes **View site · bell · "?" · account · Workspaces**; Coaches Portal order is already
  bell · "?" · account. On a phone the "?" is the bar's **last** control, after the admin's View site globe. Costs 40 px; nothing gives
  way at 1280 / 1366 / 1440 on any page measured. If a page runs short the shipped order holds: facts' quiet words first, then the
  dates; the page's name, the chip, the "?" and the doors never give way. **The demos show the "?"** (it opens in place, no exit).
  **A cancelled/suspended account's one page has none** (its help would bounce to billing; the account menu drops Help there too).
- **T2 · Buttons.** They stay in the page under the strip; **a page with no buttons draws no row**. The band holds tabs only (4b
  R1/R2). Nothing to build for the buttons themselves: the tournament row already hides itself when empty. A one-button page keeps its
  full row (Divisions, Communications, House league, a rep team's page) — that is the accepted price of one rule.
- **T3 · The club.** A "?" on every club page that has help to show; **the build gives every club place and tab a topic**, so in
  practice every page has one. No topic, no "?". The phone bar gets it too (last, after the globe). Matched in drawing tab 6: 44
  screens = 37 clear / 7 partial / 0 none. **The risk sits here:** a "?" that opens the wrong section is worse than today's program
  guide in the menu — the help pass is part of the build, not a later tidy-up.
- **T4 · Rows.** "?"-only rows go everywhere (five tournament screens; the Coaches Portal's off-team pages with T6·1). **The phone's
  lone "+" row stays** (Coaches Portal Money; the tournament's Divisions and Communications once the "?" leaves) — the page's own add on
  its own 44 px row. **Coaches Portal Roster's two rows join** into one on a computer (Add Player and Import beside Export on the
  List / Depth chart row, −50 px, fits at every computer width). Tournament Schedule and Teams keep their second row (they do not fit).
  This is a fix to one page, not a rule.
- **T5 · Order.** **One phase, two parts, one walk at the end.** Part 1 = the tournament admin + the Coaches Portal items. Part 2 = the
  club. **Do not ship or walk Part 1 alone**: the tournament's Settings & access tabs reuse three club screens (Members, Audit log, PDF
  settings), and until Part 2 gives them a topic that place's "?" comes and goes across its own tabs (the Web address tab has one,
  its neighbours do not) — the exact half-covered state the drawing flagged. Build Part 2 straight after Part 1 in the same session
  (or the next), and cover those three screens with their club topics, not a tournament stand-in.
- **T6·1.** The Coaches Portal's off-team pages (notifications, Plan & billing, Join a club) move their "?" into the strip too,
  **crossing the 4b "team pages only" line on purpose** (record why in the design log). The free Coaches Portal stays out (E13).
- **T6·2.** The help panel must be reachable from the admin's chrome (see "The one hard part"). This is a build step.
- **T6·3.** On the admin phone bar the **line's words give way** (cut with "…"); the **chip and the chevron stay whole**. Tightest bar
  measured: a club house-league season (back arrow, season name, "House league", stage chip) 258 → 214 px, so "House league" is cut
  and the chip stays; the season's name wraps to a second line when it must (5b's rule for record bars). For a tournament event the
  event's name is cut sooner.
- **T6·4.** Records to fix on the way (see the list below): the index's 4b row says the phone's help goes into the More sheet (Phase 5
  F3 replaced that); the design log has no entry giving the strip "?"'s reason.

## What already exists — stand on it, do not rebuild (verified 2026-11-13; line numbers drift, grep the names)
- **The Coaches Portal's channel (copy the idea, not the code):** `useCoachPageHelp(help, label)` (`components/coaches/CoachPageHelpSlot.tsx`)
  publishes a page's topic up in an effect and returns `hosted`, clearing only if the stored entry is still its own id (load-bearing);
  `CoachStripHelpProvider` holds one entry; `CoachPageHelpProvider` marks "hosted" and is mounted **only** in
  `app/[orgSlug]/coaches/teams/[teamId]/layout.tsx` — which is exactly why the off-team pages still draw their own "?";
  `CoachStripHelp({reserve})` is the strip end (`CoachTopStrip.tsx`, after the bell); `CoachPageHelpSlot({reserve})` is the phone end
  (last element in `CoachTeamHeader.tsx`). It holds the "?"'s width while a page loads (so the bell does not slide) and gives it back
  if the page has no topic. `CoachPageHeader` draws its own "?" only when unhosted (`helpOnRow = showHelp && !helpHosted`).
  ⚠ `recordSlot` / `barSlot` are **not** the help channel (they hand up the record's name).
- **The button both ends render:** `components/help/HelpButton.tsx` (props `help`, `label`, `iconOnly`; calls `useHelpDrawer().openHelp`).
  The panel: `components/help/HelpDrawer.tsx` (shared by Coaches and tournament; resolves via `getHelpSections`; `subtopicId` pre-expands
  and scrolls); request shape `HelpRequest {module, sectionIds[], subtopicId?, label?, fullGuideHref?}` in `help-drawer-context.ts`.
  **The panel itself does not change.**
- **The admin's panel is mounted too low:** `app/[orgSlug]/admin/layout.tsx` wraps `HelpDrawerProvider` around **page children only**
  inside `AdminChrome`. `AdminTopStrip` and `AdminEventHeader` sit outside it, so a "?" drawn there hits the no-op default context in
  `help-drawer-context.ts` and **opens nothing, with no error.** The Coaches layouts already mount the provider (`warm`) around the whole
  chrome.
- **The admin strip:** `components/admin/AdminTopStrip.tsx` doors block — `FlipPill` (View site; `flip && !suspended`) → `NotificationBell`
  → `AccountMenu` (with `helpHref={adminHelpHref(...)}`) → `WorkspacesPill`. **The admin phone bar** (event AND club — there is no
  separate club bar): `components/admin/AdminEventHeader.tsx`, row = back → identity (name, switcher, door, meta) → `FlipPill` globe
  (`!suspended`, last) → the tab band. The club's place reaches the bar through `AdminBarPlaceProvider`.
- **Where tournament pages pass a topic today** (all `<HelpButton iconOnly>` inside `actions`, module `tournaments`, paths under
  `app/[orgSlug]/admin/tournaments/` unless noted): org/tournaments list (`LIST_HELP`), branding/Public site (`SITE_HELP`), chat
  (`CHAT_HELP`), divisions, rules (`RulesAdmin.tsx`), settings/event, settings/web-address (`WebAddressTab.tsx`, uses
  `SETTINGS_ACCESS_HELP`), summary, venues; **dashboard** has four topics chosen by lifecycle stage (draft board / weeks before / game
  day / finished board — hand up the chosen one); and through `TournamentAdminHeader`'s `help` prop: registrations (Teams), results,
  schedule. **No topic today (8):** check-in, communication, staff-kit, settings/notifications ("Your notifications"), settings/payouts
  (`PayoutsTab.tsx`), plus the club's Members, Audit log and PDF settings reused here.
  `AdminPageHeader` has **no** help prop — pages put the button in `actions`.
- **Coaches off-team pages that still draw their own:** `app/[orgSlug]/coaches/billing/page.tsx`, `link-org/page.tsx`,
  `components/coaches/CoachNotificationsPage.tsx`. (Also `CoachTournamentRecord.tsx` `helpDoor` and `TeamSectionShell.tsx` — a
  section-level "?": read them and say whether they are in scope; the free portal's own team page stays as is.)
- **Guides and ids:** `lib/help-content/registry.ts` (`getHelpSections(moduleKey, ids)` maps ids, skips unknown with only a dev warning
  — **so a wrong id fails silently**: test every id you write), `resolveSectionId` in `lib/help-content/index.ts`
  (`section.id ?? slug(heading)-<n>`). Guide files: `org.tsx`, `house-league.tsx`, `accounting.tsx`, `rep-teams.tsx`, `families.tsx`,
  `tournaments.tsx`. Count a guide's top-level sections at the **6-space `id:` indent** (the drawing's counts: Org 21, HL 17, Accounting
  22, Rep 17, Families 8). `adminHelpHref` (`lib/admin-kit-nav.ts`) is the account menu's/More sheet's full-guide door — **unchanged**.

## The one hard part: lifting the panel and the channel into the admin's chrome
1. Mount `HelpDrawerProvider` **around the whole admin chrome** (strip, bar, sidebar, page), not just the page — keep one provider
   (a second would give two drawers). Mind its reset-on-pathname behaviour and the `warm` prop (the Coaches layouts pass it; check what
   the admin's look needs). `plan-billing-coach-host.test.ts` mocks the provider — update it in the open.
2. Build the admin's **hand-up channel** with the Coaches Portal's *behaviour*: a page publishes `{help, label}`; the strip and the phone
   bar each read it and draw one `HelpButton iconOnly`; the publisher clears only its own entry (route changes must not leave a stale
   "?"); **no topic → no "?"** with the width held during load so the bell does not slide. Prefer **one shared implementation both
   portals use** over a second copy — argue that from the code before writing it (the Coaches channel is pinned by
   `coach-band-phase4b.test.ts` text, so a lift means updating those pins deliberately; a copy means two things to keep identical —
   say which you chose and why). `/simplify` is expected here.
3. Both bars are in the DOM at every width in the Coaches Portal; check whether that holds for the admin, and make sure exactly one "?"
   is visible per width (computer strip above 900, phone bar at 900 and below — the chrome's split, `useIsPhoneNav`).
4. Pages stop drawing their own: remove each `<HelpButton>` from the 13 pages' `actions` and replace it with the hand-up call. Do it
   with one small helper/hook so a page cannot forget the clear. A page that has not been converted would draw two "?"s — **add a
   guard that no admin page renders `HelpButton` inside its header actions** (and the Coaches equivalent that
   `coach-page-actions-guard.test.ts` already pins by `helpHost`, which now becomes 'masthead' for the three off-team pages).

## What to build

### Part 1 — the tournament admin + the Coaches Portal items
1. The lift (above). Strip: View site · bell · "?" · account · Workspaces. Phone bar: "?" last after the globe. Suspended: neither draws it.
2. The 13 tournament screens hand up their topic (the dashboard its stage's). Their rows then disappear when nothing else is on them
   (Dashboard, Event settings, Rules, Public site, Web address). Measure first-content y before/after at 1440 and 390 (drawn: 130 → 80
   and 121 → 69). The five that keep buttons (Teams, Schedule, Divisions, Results/Venues/Chat as applicable — **read each**) lose only the
   "?" at the row's end.
3. **Point the 5 event screens with no topic** (Check-in, Communications, Staff kit, Your notifications, Payouts) at their
   tournaments-guide sections — run `/docs` for the matching; if no section fits, write a short one in the house format
   (`npm run measure:help`). Anchors of existing sections stay unchanged.
4. **Coaches Portal off-team pages** (T6·1): notifications, Plan & billing, Join a club publish to the strip/bar like team pages do —
   the shell gives them the same host (the "hosted" mark moves up to where those pages live, or the pages publish regardless; pick the
   smaller change and say why). Update the comments that state the old line (`CoachPageHelpSlot.tsx` "A PAGE WITHOUT A HOST…",
   `CoachTopStrip.tsx` "not off a team's pages…", `CoachPageHeader.tsx`, the team layout, `coach-nav-phase4.test.ts` "team pages only").
   The free portal still draws its own (E13) — check `CoachStripHelp` still never renders for it.
5. **Coaches Roster's two rows join** (T4): Add Player and Import move up beside Export on the List / Depth chart row at computer
   widths; check 1101–1440 and the tablet (it wears the phone chrome — do not break it). One page, not a rule.
6. **The admin phone bar's line gives way** (T6·3): measure the tightest bars (a club house-league season; a tournament event with a long
   name; the phase chip; the chevron) at 390 and 360. The "?" must never be cut or pushed off.

### Part 2 — the club
7. **Match every club place and tab to a topic** with the help agent (`/docs`), from the drawing's tab 6 table: Rep teams (6 tabs; the
   partial one is Assistant coaches), a rep team (5 tabs; partial: Team page, Schedule), a house-league season (7 tabs; partial:
   Overview), Accounting (9; all clear), Families (3; all clear), Organization (6 tabs; partial: The board, PDF settings), and the named
   screens (Overview, Calendar, Permits, Schedules, Public site, Plan & billing, Notifications, Seasons list; partial: the club Overview).
   For each partial: point at the nearest section or write a short one in the house format. **Two Organization sections have no address a
   screen can point at ("Your first 30 days", "Inviting and managing members"); the second is the best fit for Members — give it an id.**
   The drawing matched by section titles and a sample of text, **not by opening every screen: you confirm each one by reading the section
   against the screen.** Output a table (screen → section id → verdict) into the plan. **⚠ `lib/help-content/org.tsx` and
   `house-league.tsx` carry another session's uncommitted hunks** — `git diff` them first, edit around them, commit only yours.
8. **Every tab of a place gets a topic or none does** (a place's tabs never end up half covered) — including the tournament's Settings &
   access tabs (Members, Audit log, PDF settings reuse the club's topics; Payouts and Web address are tournament's).
9. The club's "?" at both widths through the same channel (computer strip; phone bar last after the globe). The club draws none today:
   verify there is no club-side "?" to remove. The club's pages publish via their place frames (`PlaceFrame.tsx`/`TabPageHeader`,
   `MembersKit`, `AuditLogKit`, …) — find the single seam per place rather than editing 44 pages; if a tab-level topic needs a table, make
   it one table (`place + tab → HelpRequest`) with a test that every row's section ids exist.
10. Demos: the sandbox shows the "?" (it opens in place). `npm run check:demos`. Do not rewrite tour copy.

## Words and records to change in the same unit of work
- `docs/agents/design/NAV_STANDARD.md`: the strip's and the bar's "?" rows (N-numbers as written there — read first), and **delete** the
  line "the tournament admin draws its own '?' in the page header, the club draws none"; add "a page with no buttons draws no row". Keep
  the guard names current. `nav-standard-guard.test.ts` reads `AdminTopStrip.tsx` (≈L132, L255) and pins `HubTabBar` in
  `AdminEventHeader` (≈L521) — run it.
- `memory/design_decisions.md`: one 2026-11-13 entry — the ruling (T1–T6), **the reason the strip "?" now rests on** (the 2026-07-31
  boundary "a '?' is not an exit" was reversed on purpose by the owner on 2026-11-12 for the Coaches Portal: read that entry first and
  cite its reason; the new reason is "help's place the same in all three portals, and a row for a lone '?' costs ≈50 px on every page"),
  and what it reverses (the 08-11 / 08-25 "top right of the page's top row, never the top strip" rule; 4b's "team pages only" host line).
- Guards, **updated in the open, each change named in the report:** `admin-header-bar-guard.test.ts` (≈L242–244 pins the exact `FlipPill`
  line and `<FlipPill` before `<NotificationBell`; ≈L136 the bar's row order; ≈L239 the unsplit strip's words/order — the "?" goes
  between the bell and the account, which these pins must still allow), `coach-band-phase4b.test.ts` (≈L115–138, the help channel's
  text shape and the exact `<CoachStripHelp reserve={split} />` line), `coach-nav-phase5.test.ts` (≈L126–136),
  `coach-nav-phase4.test.ts` (≈L20, L228), `coach-page-actions-guard.test.ts` (`helpHost`),
  `tournament-stage5-chat.test.ts` (≈L23 pins `<HelpButton help={CHAT_HELP}` in the page) and `tournament-stage5-settings.test.ts`
  (≈L162, the Web address tab's button), `plan-billing-coach-host.test.ts` (mocks the provider), `workspace-flip-guard.test.ts`
  (≈L548 inventory — new files need entries with a stated reason). **Add:** one "?" per width; the strip's order; no `HelpButton` in an
  admin header's actions; every table row's section ids exist; suspended draws none; the free portal never draws the strip "?".
- Help articles that say where the "?" is (`/docs`): anything saying "the ? at the top right of the page" in `tournaments.tsx`,
  `coaches.tsx`, `org.tsx`. Keep `keywords` / `searchText` in sync, anchors unchanged.
- Records: the plan's top-row bullet and Phase 6 record (what shipped, measurements, the section-matching table); **index row 6b** and
  fix the 4b row's "More sheet" sentence (T6·4); one TODO line; the ledger § (this phase's walk); project memory (positive facts, "built
  2026-MM-DD"). Stage the exact files.

## Gotchas
- **Shared working copy.** Other sessions have uncommitted files here (sign-in, club audit log, legal, **the help content files
  you will edit**). `git diff <file>` before editing any shared document; never `git add -A`. Commit through a private index on HEAD
  (`GIT_INDEX_FILE=.git/p6b.index git read-tree HEAD`, add exact paths, `git write-tree`, `git commit-tree -p <HEAD>`,
  `git update-ref refs/heads/dev <new> <old>`), then `git reset -q -- <paths>` to resync the shared index; confirm
  `git diff --name-only <parent> <new>` lists only your files. **No commit without the owner's yes.**
- **A silent no-op is the failure mode** (the drawer outside its provider; a wrong section id). Every "?" must be clicked and must open
  a non-empty panel — script it (`.probe/nav-phase6b/`, sign-in without a browser per memory: `.probe/nav-phase2b/signin.mjs`;
  UAT owners `uat-owner@uat-test-org.local` and `uat-club-owner@uat-rep-club.local` work; `club-owner@dev.local`'s password is dead).
- **Dev server:** this adds files — restart via `npm run dev` only, once, near hand-off. No full sweep on it;
  `npm run check:layout -- --changed` on the touched screens (1440 / 390 / 768).
- `npm run typecheck` needs `NODE_OPTIONS=--max-old-space-size=8192` (it OOMs silently with exit 0 otherwise). `npm test` fails in other
  sessions' areas — run the navigation and help guards by name and list any other new failure separately.
- **The free Coaches Portal (E13), the support console and the suspended page are out of scope** — verify each is unchanged.
- **Spelling gate** (`npm run check:spelling`): the clock is "8:00 a.m."; one spelling per word. **Product-owner voice** for anything he reads.
- **Do not edit the old walks** (history). The Phase 6 closing walk is written to **exclude** where the tournament "?" sits (this phase
  moves it) — do not change it; this phase has a walk of its own.

## Steps
1. Read the plan's top-row record and the drawing (all eight tabs; the notes and asks T1–T6 are the spec's annotations), the design-log
   entries of 2026-07-31 and 2026-11-11/12 on help. Verify the "What already exists" facts by opening the cited lines (the helper's
   survey is a lead). Present the **product-manager UX summary** (what each operator sees and does differently, both widths) and the
   task list; argue the "shared channel vs a copy" choice in a few lines. Then build.
2. Part 1 (items 1–6), then Part 2 (items 7–10), in order. After each part: the guards by name
   (`node --import ./tests/ts-resolver.mjs --test tests/unit/<name>.test.ts`), `npm run lint:focused -- <files>`.
3. `npm run verify:changed`, `npm run typecheck` (with the heap flag), `npm run check:spelling`, `npm run measure:help`,
   `npm run check:demos`, `npm run check:layout -- --changed`.
4. **Measure and report** (px, dev): every "?" opens a non-empty panel at 1440 and 390 for each portal (script, list the screens);
   strip free room with the "?" at 1280 / 1366 / 1440 (drawn: tournament 408, club 472, Coaches 362 at 1280); first-content y before/after
   for the drawn shapes (Dashboard 130 → 80 / 121 → 69; Divisions, Communications, House league unchanged at 131/130/128; Teams 208,
   Schedule 176 unchanged); Roster −50; the tightest phone bars; first paint with scripts off (does the strip's "?" hold its width
   without a jump? it should — the page's own "?" is gone, so a late-arriving "?" must not push the bell); a route change leaves no stale
   "?"; a suspended account; the sandbox; the tablet (641–900 wears the phone chrome); a page with no topic.
5. `/design` on the built screens against the drawing (delegate it to a helper — the skill loads big memory files); `/simplify` (the
   channel; expected); `/review`; `/docs`; **`/legal`** only if a help sentence changes what the product says it collects or sends
   (likely not — say so).
6. **Its own walk**, one purpose per walk, a checkable Artifact from `.probe/nav-phase5/build-walk.cjs`'s approach: where the "?" sits on
   a computer in all three portals; on a phone in all three; it opens the right section on each place's tabs (a sample per place, with
   the matching table's partial seven walked for sure); pages without buttons lose their row; Roster's joined row; the Coaches
   off-team pages; suspended / demo. Write the ledger §. Then update the records and **ask before committing**.

## Done when
- In all three portals the "?" is in the strip beside the bell and last in the phone bar; no page draws its own; no stale or empty "?".
- Rows that held only a "?" are gone (measured); rows with buttons keep them; Roster's two rows are one on a computer.
- Every tournament and club place and tab has a topic that opens the section it describes (table in the plan, each confirmed against the
  screen); no place's tabs are half covered; the Coaches Portal's three off-team pages moved.
- Suspended draws none; the sandbox shows it; the free portal, the console and the full guide's doors are unchanged.
- NAV_STANDARD, the design log, the guards, the code comments and the help articles say what the code does; checks pass;
  `/design`, `/simplify`, `/review`, `/docs` applied or recorded; the walk is published with its ledger §.
