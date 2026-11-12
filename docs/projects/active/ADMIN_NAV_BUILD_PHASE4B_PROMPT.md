# Build prompt — Navigation, Phase 4b: the Coaches Portal's tabs pinned under the strip, and the "?" off its own row (computer)

> **⚖ GATE DONE 2026-11-11 — skip any "Gate" step; start at Step 0.** Drawings: https://claude.ai/artifact/VkSTdrAUv9Rbgbwu4gYiun
> (source `docs/projects/active/COACH_TABS_TOPROW_DRAWINGS.html`, six tabs, measured at 1440 × 900 on dev, /design applied). Owner ruled
> **R1–R6** (record: `ADMIN_NAV_EVALUATION_PLAN.md` §5, "Phase 4b"). Where this prompt and the plan differ, the plan wins.

> One session, pasted into a fresh chat (`/clear` first), after Phase 4 landed (committed `dcddf7c80`, walk §514 passed 33/33 on
> 2026-11-11). Written 2026-11-11 from the owner's rulings, from a helper's code survey and a Playwright measurement of the shipped
> screens the same day; the anchors below were spot-checked against the code unless marked *(helper, verify)*. Index:
> `ADMIN_NAV_BUILD_PROMPTS_INDEX.md`. **Model: Opus for this session** (a shared sticky-offset variable read in many places, one
> first-paint judgement, many pinned guards). Helpers read on Sonnet — delegate broad reading, keep the edits.

## What the owner ruled (R1–R6, all 2026-11-11)
1. **R1 = B, the club's own band.** On a computer, a coach page that has tabs keeps them pinned in a **45 px band directly under the 48 px
   strip**, full width from the sidebar's edge to the right edge, tabs alone. **The page's buttons (Record, Import, Add player …) stay in the
   page, below the band.** The drawn option A (buttons in the band) was NOT taken.
2. **R2 = nothing rides the band's right end** (follows from R1).
3. **R3 = option 2: the "?" sits at the right end of the page's first heading / first row, so a row that holds only a "?" disappears.**
   Where a page has real buttons in its top row (Money, Roster) the "?" stays last in that row, as today. The owner's words: location of help
   should be consistent across portals "if we can" — **start in the Coaches Portal; if he likes it after the walk, the tournament admin and the
   club come over later. That later move is NOT this session's.**
   ⚠ This does **not** reverse the 2026-07-31 ruling (`memory/design_decisions.md` ~5382; also the long note in
   `components/coaches/CoachPageHelpSlot.tsx`): help stays on the page, never in `CoachTopStrip`. Do not put a "?" in the strip. What changes is
   only that the "?" no longer owns a row. Say so in the code comment you leave.
4. **R4 = accept the Ledger pinning 230 px** (strip 48 + band 45 + register toolbar 104 + column heads 33) instead of 185. Check it at 768 px
   high and report the share of the screen.
5. **R5 = scope as written:** the tab bars on **Money (7), Insights (7; the `/history` route), Lineups (2), Practice plans (4) and Skills & goals
   (3, not yet measured — measure it first)**. The **player page's tabs** (`roster/[playerId]`) sit under a glance block of chips and tiles: they
   **stay there and dock under the strip once scrolled past** — that is the shared bar's existing `sticky` prop, not the band. **Not tab bars, left
   alone:** Tryouts' four stages (`TryoutFlowHeader`), the Lineup / Playing time switch, the practice-plan editors' view switches, the session
   page's chips, sheets.
6. **R6:** this lands **before Phase 5**; the phone follows with the same rule in Phase 5. **The phone is byte-identical after this phase.**

## What the drawings measured (1440 × 900, UAT Test Team, dev, 2026-11-11 — re-measure what you change)
| | before | after (R1 + R3) |
|---|---|---|
| strip | 48 (fixed, z 80) | 48 |
| first row (buttons / "?") | y 80, 34 tall, 16 gap | Money/Roster keep it; a "?"-only row is gone (5 of 7 pages measured) |
| tab bar | y 130, 45 tall, scrolls away | **y 48–93, pinned, full width** |
| first content, tabbed page | y 197 (149 under the strip) | Money: band 93 + 32 + 34 + 16 → **y 175**; lone-"?" tabbed pages (Insights, Lineups, Practice): 93 + 32 → **y 125** |
| first content, tab-less lone-"?" page (Documents) | y 130 | **y 80** |
| Ledger, scrolled | pins 185 (toolbar 104 at y 48, heads 33 at y 152) | pins 230 (band, then toolbar at 93, heads at 197) |
`.coachesMain` pads 2 rem (32) all round; the page column is 272–1408 at 1440 (Money wide: 1136; most pages `max-width: 960` centred).

## The code this stands on (verified 2026-11-11 unless marked)
- **The club's band** is *not* `HubTabBar`'s `sticky`: `AdminEventHeader` (`components/admin/AdminEventHeader.tsx`) is one `position: sticky` header at
  `top: var(--admin-topstrip-h)`, whose desktop form (`AdminKitEventHeader.module.css` ~L203–209, `.deskBand`) hides the name row and keeps the tab row
  alone; it renders `<HubTabBar inBar …/>` (L180). Frames hand it their tabs (`useHandBarPlace`, `AdminBarPlace`); it publishes `--admin-header-h`
  for in-page sticky toolbars to dock under. The band's height is one declaration, `--admin-band-h: 45px` (`admin.module.css`). `HubTabBar`'s `inBar`
  CSS block is guarded: **every selector between `.inBar {` and the phone `@media` must start with `.inBar`**
  (`tests/unit/admin-header-bar-guard.test.ts` ~L171–189), and the same test asserts `accounting/page.tsx` and `history/page.tsx` do **not** use `inBar`.
- **The coach side today:** every coach tab bar is `components/shared/HubTabBar.tsx`, none sets `sticky` or `inBar`, each is a child of the scrolling
  page, below `CoachPageHeader`. Call sites *(helper, verify)*: `accounting/page.tsx` ~L594 (carries the 2026-08-19 "NEVER STICKY" comment ~L600),
  `history/page.tsx` ~L584, `development/page.tsx` ~L281, `lineups/_LineupsTabs.tsx` (used at `lineups/page.tsx` ~L384 and
  `_LineupTemplatesView.tsx`), `practice/_PracticePlansTabs.tsx` (four views), `roster/[playerId]/page.tsx` ~L753.
- **`HubTabBar`'s existing `sticky`** (`HubTabBar.module.css` ~L49–56): `position: sticky; top: calc(var(--coach-topstrip-top) + var(--coach-header-h));
  z-index: 60; background: var(--bg)`, ~51 px, in the page column. Used by nobody now. The `#coach-tabbar-sticky` id it sets is read by **no** live
  code (the register no longer measures it). The 2026-08-19 reversal is **superseded by R1**: every coach bar pins, so the "one tab pinned, six not"
  inconsistency it ruled against cannot arise. Delete the stale comments with the change (accounting `page.tsx` ~L600, `expenses/panel.tsx`
  ~L1191, the `.sticky` CSS note) or rewrite them to the new rule.
- **`.page` is a plain block** (`coaches.module.css` ~L1217: `max-width: 960px; margin-inline: auto`) — **not** a flex column, and narrower than the
  area the band must span. A full-bleed band cannot be a simple in-page `position: sticky` element.
- **The coach strip and the pattern to copy:** `CoachTopStrip` draws an empty **slot** after its arrow and `CoachPageHeader` **portals** the record's
  title into it (`components/coaches/CoachDeskTitle.tsx` — `recordSlot`, `useCoachRecordSlotRef`; `CoachPageHeader.tsx` ~L213). The strip is 48 px
  (`--coach-topstrip-h`), docks at `--coach-topstrip-top` (adds the demo banner `--sandbox-chrome-h`); the team bar is hidden above 900 and
  `--coach-header-h` is 0 there.
- **The "?" today** (`CoachPageHeader.tsx` ~L261): above 900 the header keeps only its top row — actions, then the "?" last
  (`coaches.module.css` ~L1488–1512: `.pageHeaderStd[data-desk-named]`, `…='empty'` is `display:none`). On a phone the **team bar** draws the "?"
  (`CoachPageHelpSlot.tsx`, `useCoachPageHelp`, `helpHosted`); a page with no host draws its own — **never make the publisher unconditional**.
  44 files render `CoachPageHeader` *(helper, verify the count)*.
- **Everything that docks under the strip by the same formula** and so must also clear the band *(helper, verify each)*: the register
  (`accounting/expenses/panel.tsx` ~L1176 `registerStickyBase`, ~L7232 `CoachListToolbar stickyTop`, ~L7694 `--register-thead-top`, `coaches.module.css`
  `.registerTheadSticky`, `components/coaches/kit/CoachListToolbar.tsx`), `.collapseSection { scroll-margin-top }` (~L1275, the `?section=` deep links),
  `.ppLibraryHost` (~L11047) and `LineupInningList.module.css` `.pin` (neither is on a tabbed page, but both read the same formula).
  `tests/unit/coach-lineup-phone-guard.test.ts` ~L730 pins `.pin`'s top formula **verbatim** — *add* a variable, never redefine `--coach-header-h`.

## What to build
**Step 0 — read, then the product-manager summary (blocking).** Read the plan §5 "Phase 4b", the drawings (all six tabs), `design_decisions.md`
~5382, and the files above. Then give the owner the plain-language summary `AGENCY_RULES.md` requires (what a coach sees, how it differs by page,
who is affected — nobody's access changes). No code before it.

**Step 1 — spike the band's mechanism and decide (a short, measured decision, not a debate).** The band must be full-bleed, first-paint-stable and
leave the phone untouched. Two candidates; try the first, fall back only on evidence:
- **M1 (recommended): a shell-owned slot, the page portals its tabs in.** The coach shell draws an empty band slot under the strip on desktop (the way
  the strip draws `recordSlot`); each tabbed page renders its `HubTabBar` **once**, through `createPortal` into the slot when it exists and the viewport is
  desktop, otherwise in place (phone). The page keeps owning its tabs' state and closures; nothing is copied through state. Reserve the band's 45 px by
  the **address** (a pure function over the pathname, in `lib/coach-team-nav.ts` beside `coachDeskTitleAt`) so a tabbed route never shifts when its tabs
  arrive — the club's lesson (Phase 0: "no flash"). A width hook decides portal-or-in-place; it is only consulted once tabs exist (client data), so
  check whether any bar is in the *server's* HTML (Lineups/Practice may be) and, if so, say what the first paint does.
- **M2: restyle in place.** The in-page bar breaks out of the centred column by container-query units (`container-type: inline-size` on `.coachesMain`;
  `margin-inline: calc((100% - 100cqw) / 2 - 2rem)`) and sticks at the strip. No portal, no second render, no width hook — but it sits in DOM order
  *after* the page's header row (the band must visually precede it, so it needs a negative top margin and `order`-like tricks on a non-flex `.page`) and every
  page that puts a notice above its bar (Money's `dataNotice`) breaks the arithmetic. Reject it unless M1 shows a real defect.
Whichever wins: **the new look is a new prop on `HubTabBar`** (e.g. `band`), **not `inBar`** — `inBar` is the club's header-embedded look and its guard says
no coach page uses it; keep that guard true. Declare **one** variable, `--coach-band-h: 45px` (a single declaration; the band, the club-style bottom rule and
every sticky offset below read it, the way `--admin-band-h` is read), published as **0 on a page without tabs and on a phone**. Measure the first paint
before and after on Money, Insights, Lineups and Practice plans (the Phase 0 / Phase 4 probe pattern: JS off = the server's paint; `.probe/nav-phase4/` and
`.probe/nav-phase2b/signin.mjs` are the sign-in and measuring helpers; signed-in UAT states expire — re-run the sign-in script).

**Step 2 — wire the bars.** The five tabbed pages in R5, the band on a computer. The player page keeps its bar in the page and opts into the existing
`sticky`. Everything else in R5's "left alone" list is untouched. Write the new rule once in `HubTabBar`'s prop doc and delete the stale "never sticky" notes.

**Step 3 — make everything that docks under the strip clear the band.** One variable, read in the places listed above; the register's toolbar and column
heads add `--coach-band-h` to their base (Ledger: band → toolbar at y 93 → heads at y 197, pinned 230). Add the band to `scroll-margin-top` for `?section=`
deep links, and add a `scroll-padding-top` (or equivalent) so **keyboard focus never lands under the 93 px stack**. The demo banner shifts the band by its
own height (it is already inside `--coach-topstrip-top` — confirm). The drawing page's "narrower screens" card holds the arithmetic: nothing is added to the
band's right end (R2), so at 1100 the tabs simply scroll with their arrows; verify at 1280, 1366 and 1100.

**Step 4 — the "?" (R3), in two parts with a stop between them.**
*4a — the census and four drawings (gate).* Helper: list every page that renders `CoachPageHeader` with no actions, say what its first heading or first row is
(a section label, a card heading, a toolbar, nothing), and group them into the four or five shapes that exist. Then **publish drawings** (extend the Phase 4b
artifact — read the saved live copy first — or a new one) of one representative page per shape, true size, the "?" at the right end of that page's first heading,
with the measured heights. **Stop and wait for the owner's yes on the anchors** before wiring all of them. A page with no sensible first heading keeps its
own row — that fallback is part of the ruling's spirit and the safe default.
*4b — the mechanism.* A page **offers** an anchor at its first heading; the header **portals** its "?" there when the anchor exists on a computer, and otherwise
renders it in the row exactly as today (**an anchor-or-row fallback, so a page that has not adopted it never loses its help**). The "?" stays one per width; the
phone's team bar still draws it there (Phase 5's). A "?" is still last in a row that has buttons. When the "?" leaves, the row is `data-desk-named='empty'`
and draws nothing. Mind the `nested` and `embedded` shapes (a nested header owns no "?").

**Step 5 — guards.** Edit, deliberately, with the reason in the commit: the "in-bar tab row is opt-in" test and its assertion list (it must keep passing for
`inBar`); `tests/unit/coach-nav-phase4.test.ts` ~L178–239 (the `data-desk-named` / `data-desk-drill` attributes and their CSS — only where the "?" mechanism
changes them); `club-stage3a-screens-guard.test.ts` (~L28–33 wants `accounting/page.tsx` to keep importing `HubTabBar` — keep true);
`coach-reports-phone-guard.test.ts` (~L130 wants the `useActiveTabInView(barRef, 48, …)` call and no `scrollIntoView` — keep true; the 48 is the strip's height, check
whether the band changes what that scroll offset should be). Add: the band's height has one declaration; every coach tab bar named in R5 uses the band; no coach
page uses `inBar`; the page-help fallback still exists; the phone's CSS is unchanged (the Phase 4 guards pin this).

## Out of scope (say so if tempted)
The phone and its team bar (**Phase 5**); the free portal's own shell (`CoachPortalShell`, its "Team sections" row); the club and tournament admin's "?" placement
(a later cross-portal review, after the owner walks this); the page's **buttons** (R1/R2: they stay below the band); the register's toolbar (a separate piece of
work); moving any tab bar not listed in R5; a year parameter anywhere (`HISTORY_ENDPOINTS` guard) — nothing here reads one; a closed season is one page with no tabs.

## Verification and hand-off
- **Measure**, do not eyeball: 1440 × 900, 1366 × 768, 1280 × 800, 1100, and the phone at 390 (**must be unchanged** — compare to the Phase 4 numbers). Report before / after for
  every row in the table above, the Ledger's pinned share at 768 high, and the first paint of each tabbed page. `npm run check:layout --changed` on the touched screens only
  (**never a whole-product sweep on the dev server**).
- `npm run typecheck` needs `NODE_OPTIONS=--max-old-space-size=8192` (it OOMs silently with exit 0 otherwise); `npm run verify:changed` stops at `npm test` when other sessions' reds exist —
  run its later checks by hand and say so. New files ⇒ restart the dev server before the owner's browser test (`npm run dev` only; stop it before deleting `.next`).
- **Then, in this order:** `/design` (delegate it to a helper — the skill loads five big memory files; give it the drawings and the 2026-07-31 ruling), `/simplify` (a new
  prop, a shared variable and a slot = new abstraction), `/review`, `/docs` (the Premium-portal help sections that mention the tab bar, the top row or the "?"; `NAV_STANDARD` N-lines
  for the band and the help's place — the full rewrite is Phase 6), and the demo check (the demo tour's destinations/anchors must still exist — the build fails if one vanishes).
- **One walk:** a checkable Artifact (the house format: one purpose per walk, 33-style ticks, paste-back), registered as the next ledger section in `OWNER_QA_LEDGER.md` (read the
  tail first — never sort the § numbers) and linked from the plan, the TODO line and the prompts index. Walks to include: each tabbed page scrolled (band stays), the Ledger at
  768 high, a lone-"?" page on both sides of the change, a page with buttons (Money, Roster), the player page's docking tabs, a deep link (`?section=`), keyboard Tab through the
  band, the demo (`riverdale-ridge`), the phone **unchanged**, a closed season (one page, no band).
- **No commit without the owner's yes.** Stage explicit paths only (shared files carry other sessions' hunks — private index, exact edits, CAS update-ref; `git show --stat HEAD`
  after). Branch `dev`. Record the result in the plan's Phase 4b section (positive facts with anchors — "committed `<hash>` <date>", never "uncommitted"), the TODO line,
  the prompts index row and the auto-memory file `project_admin_nav_evaluation.md`.

## Gotchas carried from Phases 1–4
- Many repo files are **CRLF**; edit scripts must match `\r\n`. Write edit/probe scripts with the Write tool — a shell heredoc loses backslashes and a regex or `\b` is mangled. Use the Edit tool for anything with a backslash.
- `@next/env` `loadEnvConfig` without `true` reads **prod**; a helper's UAT fixture call can **write** (it re-anchored a probe game on dev on 2026-11-11) — tell helpers whether writes are allowed.
- A guard pins `<ClubBriefProvider …><AdminBarPlaceProvider>{frame}` literally — wrap any new provider **outside** it. An optional catch-all in a parallel route slot collides with the team page.
- A server-rendered coach page cannot know the viewport; anything that differs by width is CSS at 900/901 or a hook consulted after hydration — decide which, per piece, and say so.
- The Next dev badge covers the phone More button in probes (`nextjs-portal { display: none }` + a forced click).
- Do not describe the 2026-08-19 or 2026-07-31 rulings from memory — they are quoted above and in `design_decisions.md`; open them.
