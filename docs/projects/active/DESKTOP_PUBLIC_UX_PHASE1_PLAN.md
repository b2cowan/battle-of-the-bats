# Desktop Public UX — Phase 1 Hybrid (Plan)

**Status:** Ratified 2026-07-30 — **Chunk A COMMITTED on dev 2026-07-30 (`9f1a605e`)**; **Chunk B BUILT 2026-07-30 (uncommitted)**; owner browser QA pending on both; Chunk C not started
**Chunk A build notes:** WI-1…WI-6 all landed. New pieces: `/api/me/role-summary` (global operator doors + chat membership, client-resolved chrome), `lib/use-role-summary.ts`, `lib/start-menu.ts` (persona-menu gating, mirrors /start's S1-1 gating; tournament strip + coach shell use safe chooser-routed defaults since the root layout must not call `getPlanGatingMap`), `components/consumer/StartMenu.tsx`, `userHasChatMembership()` in chat-service. Tournament strip is tab-less + state-based (anonymous / fan-with-chat-membership / operator); mobile bottom bars are state-based everywhere (anonymous = Home/Scores/Sign In). Operator pill: Admin Area (first org context's destination) outranks Coaches Portal. Org-home nav populated (Pricing / operator pill / Account-or-Sign In, client-resolved). typecheck + verify:changed green (only pre-existing warnings in unrelated coach accounting files); dev server restarted.
**/simplify PASS DONE 2026-07-30** (4 agents): extracted `getPrimaryOrgDestination()` (user-contexts) + `resolveOperatorPill()` (use-role-summary) as the single homes for the WI-3 door rules; shared wordmark block; StartMenu trigger wears `.utilLink` (one typography home); strip badge wears `.topBadge` + position-only `.stripBadge`; `getStartMenuConfig()` parallelized in all dynamic mounts. Skipped by design: org-navbar action-triad geometry stays local; role-summary endpoint stays separate from the event-scoped tournament-viewer/Flip mechanism (two different jobs, both affordances ratified).
**/review PASS DONE 2026-07-30** (high-risk tier, 5 lenses, deterministic gate green): security lens CLEAN (endpoint auth-scoped, SW-cache identity posture verified — consumer-shell SSR props never reach cached HTML per public/sw.js allowlist analysis). Fixed: coach-portal layout now wires adminHref+startMenu (dual-role admin kept their Admin Area door in the portal); useRoleSummary resets state on disable (shared-device: next user can never render the previous user's doors); strip chat door opens on `hasChat || unread>0` (fan added to a room mid-session); StartMenu closes on route change (Back/Forward); `userHasChatMembership` liveness filter aligned to `neq 'removed'` (inbox convention). Known-and-accepted: WI-5 amends design ruling S1-2's "nav never varies by auth state" (journey nav swaps Sign In → Chat/Account at mid-flow sign-up — flag to /design log); operator pill is deliberately GLOBAL (multi-org admin viewing another org's page gets their own home door — 1:1 org model makes this rare; event-scoped context stays The Flip's job); one plan-gating DB read per consumer-shell request incl. anonymous (pre-existing pattern on /, /pricing).
Remaining for Chunk A: owner browser QA.

**Chunk B build notes (2026-07-30, uncommitted on dev).** WI-7/8/9 landed; CSS-only apart from one render change in `ScoresClient.tsx`. Breakpoint is **`min-width: 1024px`** everywhere — these files' first breakpoints, so ≤1023px keeps every rule it shipped with.
- **One home for the measure:** `--app-col: 980px` in `globals.css` `:root` (read only inside ≥1024 blocks). Discover `.homeInner` + `.controls`, `ScoresClient .page`, `FollowingList .page` all take it. Discover's sticky `.filterBar` stays full-bleed with the centered column inside it — the ChatPanel chrome/column split, unchanged.
- **Browse grid** was already `auto-fill, minmax(300px)`, so the 948px inner width earns its third column for free (680px fitted exactly 2).
- **WI-8 cap moved from JS to CSS.** `EventsGrid` now renders *every* tile and marks the grid `.eventsGridCapped` when collapsed; `@media (max-width: 1023px) .eventsGridCapped .eventTile:nth-of-type(n+4) { display: none }` reproduces the old 3-tiles-plus-"+N more" 2×2 shape exactly, and ≥1024 the grid goes `auto-fill, minmax(280px)` (3 cols) with `.moreTile` hidden. One render path, no viewport state in JS, no hydration mismatch — and the phone behaviour is bit-for-bit what it was. Both tile kinds are `<a class=eventTile>`, so `nth-of-type` is unaffected by the trailing `<button>`.
- **Following** widens to 980 and its row list becomes `auto-fill, minmax(340px)` (resolves to exactly 2 columns, can never collapse to 1) — a follow row is a short card, so one 980px-wide row per action read worse than a pair. **Judgment call, not in the mockup — flag for owner.**
- **Account deliberately widens to 720px, not 980.** Every child is a single-action bar (label + chevron); at 980 the chevron ends up a screen from its label. The real desktop answer is the chartered Phase 2 two-column settings screen. **Deviation from "~980px" — flag for owner.**
- **WI-9:** `.heroSub` + `.recordHeader p` → 760px (prose measure), `.draftPublicNotice` / `.previewBanner` / `.registrationStatus` / `.championSingle` → 880px (mockup width). `.annGrid` left alone — already 900px, wider than the mockup's 880.
- **WI-7b — Browse LIST-row truncation (found in owner QA, fixed same pass).** The list row's facts strip is content-sized with `flex-shrink: 0`, so it took **593px of the 948px row** and the tournament name got the remainder — 227px, ellipsed on every row. Pre-existing and *worse* before this chunk: between 901–1023px the strip appeared but the column hadn't widened, so the name column measured **0px**. Two fixes, both owner-decided 2026-07-30: (1) `MetaRow` items carry `data-meta` (facts are conditionally rendered, so positional CSS targets the wrong ones) and the list row hides `region` + `divisions` — the grid card and the tournament page still show all five; (2) `.listMeta`'s hide breakpoint moves `900px → 1023px`, so the strip only appears once the column has widened to carry it. Result: name column **227 → 413px**, zero truncation at 900/1000/1023/1024/1440; ≤900px unchanged (strip was already hidden there).

**Owner QA pattern worth naming:** both defects found so far are the same shape — *the container was widened, but what it contained (or painted) was never rebalanced for the new width*. Worth an explicit sweep for the same shape on the surfaces not yet exercised with real data.
- **WI-7c — dark shell showing through as black gutters (found in owner QA, fixed same pass).** Scores and Following wore the warm wrapper on the *width-capped* `.page` element, so the paper ground was painted only under the column and the dark consumer-shell body showed either side. Invisible in dark mode, black bars in light — which is why it survived. **Pre-existing at every viewport wider than 640px**, not introduced here; the widening merely narrowed the bars. Fixed by applying the ChatPanel gutter pattern properly: `.page` is now full-bleed with `padding-inline: max(1rem, calc((100% - <col>) / 2))` instead of `max-width` + auto margins, so the ground reaches both edges while the column measure stays *identical at every width* (980 desktop / 640 tablet / 358 phone — all verified). Account already had this via its `.accountFill` wrapper and Discover's `.page` was already full-bleed; those two are unchanged. **Note:** this is the one place Chunk B deliberately changes rendering ≤900px — the gutters go from black to paper. The column, type and spacing are untouched; the alternative was shipping a screen fixed on desktop and still broken on tablet.
- **WI-7d — primary-CTA colour, RESOLVED by owner ruling 2026-07-30** (mockups: `claude.ai/code/artifact/387ba6a1-6e93-415f-b486-b1e8817e4a59`; full entry in `design_decisions.md`). Olive CTA fills on Scores + Following → **ink chip** (`--home-ink` / `--home-paper`); Account's lime chip unchanged. Binding three-role split: **ink** = main action in-context, **lime** = brand/conversion moment (reserved), **olive** = links/active tabs/followed star. The nudge + claim panels also lose their `--home-olive-soft` tint for a plain white card — the tint was the actual cause of the muddiness (button and panel shared a hue at 5.8:1). Hover moved off `filter: brightness()` (invisible on near-black) to `--home-ink-soft`. Verified both themes: 15.1:1 light / 19.8:1 dark, panel separation 16.5:1; Account lime untouched at 14.2:1.
- **Verification:** 35 Playwright computed-style checks (1440/900/390) + a 5-width synthetic-grid test of the cap rule (390/900/1023/1024/1440) — all green, including every ≤900px value asserted against its literal pre-change baseline. `verify:changed` clean for these files (the one repo-wide lint error is a concurrent session's `lib/coach-budget-months.ts`); `typecheck` clean; all six CSS token baselines still ZERO.
- Remaining for Chunk B: owner browser QA → `/review`.
**Owner decisions:** Hybrid direction approved (Option 1 Trim Pass + three cherry-picks + state-based fan chrome); CTA label stays "Run a Tournament" with a persona menu; paid-tier "Built on FieldLogicHQ" credit **DECIDED 2026-07-30** (logged in `BUSINESS_DECISIONS.md`) with binding constraint **subtle** — text-only, no banner/badge/CTA, org theme tokens, final wording via `/marketing`
**PM brief:** `DESKTOP_PUBLIC_UX_PHASE1_PM_BRIEF.md`
**Mockups (approved visual spec):** https://claude.ai/code/artifact/3d5f3540-6d91-4247-8745-348dcdb77d0a — sections: Option 1, Hybrid, and the "Fan chrome" addendum are the binding references for this phase
**Source investigation:** 12-agent desktop UX audit (2026-07-30); 37 findings, 11 high-severity claims independently verified, 0 refuted

---

## Background (verified findings this plan fixes)

1. **Phone-width app screens on desktop.** Discover/Home, Scores, Following, Account cap content at 560–680px and center it; 55–65% of a 1440px viewport is empty gutter. `ScoresClient.module.css`, `FollowingList.module.css`, `HomePersonalization.module.css`, and the Account page CSS contain **zero `@media` queries** — one layout from 375px to 4K. `ChatPanel`'s full-bleed-chrome + `max()` gutter pattern (capped ~820px) is the in-repo proof of the right approach.
2. **No footer, no marketing links anywhere in the app.** `Footer.tsx` suppresses itself on every `/{orgSlug}/...` route and the consumer shell. Zero links to `/pricing` or any `/for-*` page from any consumer or org surface. Only outward affordance is the "Run a tournament" text link (→ `/start`).
3. **Same four tabs for everyone.** ConsumerNav (shared by consumer shell + every public tournament page, `variant="tournament"`) shows Home/Scores/Chat/Account to anonymous visitors who can't use half of them; on tournament pages the strip's "Home" sits next to the rail's "Overview" (home icon) — two different destinations.
4. **Paid orgs' tournaments carry zero FieldLogicHQ presence.** `PoweredByBadge` + acquisition banner are gated to the free `tournament` plan only; the plain org home page renders neither at any plan, and its nav is a logo + empty actions slot.
5. **The PWA is invisible from desktop.** Install banner gates on coarse pointer, `beforeinstallprompt` suppressed site-wide, Account "Install app" row hides outside phone/tablet. No QR, no "get the app" copy anywhere.

## Ratified direction

Option 1 (Trim Pass) in full **plus**: persona menu under "Run a Tournament" (from Option 2), one persistent role pill for signed-in operators (Option 2, scoped down), Scores responsive grid (from Option 3), and the **state-based platform strip** for tournament pages (fan-chrome addendum). Deferred to Phase 2: companion rail, full desktop layout grammar, Chat split-pane, Account two-column.

---

## Work items

### Chunk A — Chrome & navigation (ConsumerNav + shell)

- **WI-1 — Standing Pricing link.** Add a `Pricing` text link (→ `/pricing`) to the utility cluster in all ConsumerNav variants, desktop widths, signed in or out.
- **WI-2 — Persona menu on "Run a Tournament".** Label unchanged. Desktop: opens a dropdown — primary item *Organize a tournament* (→ `/start/tournament`), then a quieter "More ways to start" group: *Coach a team*, *Join a team*, *Run a league season* (map to the existing `/start/*` chooser routes; confirm exact targets at build). Mobile behavior unchanged (plain link to `/start`).
- **WI-3 — Persistent role pill.** Signed-in users with an operator role get one pill — `Admin Area` or `Coaches Portal` — in the utility cluster across consumer shell, org pages, and tournament pages. Replaces the buried Home-feed WorkspaceCard as the primary door (card can stay). Visual register: consumer chrome (companion), per the logged free=companion/premium=HQ ruling. No pill for role-less accounts — empty state renders nothing.
- **WI-4 — State-based tournament strip** (binding mockup: "Fan chrome" addendum).
  - *Anonymous:* wordmark, `Discover`, `Sign In`, `Run a Tournament`. No tabs, no badges.
  - *Signed-in fan:* + chat **icon** with unread badge **only when the user has ≥1 conversation** (derive from the same source that powers today's unread count — confirm a conversations-exist signal is cheaply available in nav context), + compact avatar (→ Account). No labeled tab row.
  - *Operator:* fan strip + WI-3 pill.
  - Removing the tab row eliminates the Home/Overview collision (supersedes the earlier "relabel to Discover" idea).
- **WI-5 — Anonymous consumer-app chrome.** On the platform app screens (Discover/Home, Scores): anonymous visitors see browsable tabs (Home, Scores) with Chat + Account collapsed into a single `Sign In`. Full four-tab row returns once signed in. Mobile bottom-tab behavior: mirror the same rule.
- **WI-6 — Org public homepage nav.** Populate the empty actions slot on `app/[orgSlug]/page.tsx`'s nav: `Sign In`, `Pricing`, org's Coaches Portal link where applicable; WI-3 pill when signed in with a role.

### Chunk B — Desktop widening (CSS-only)

- **WI-7 — Widen the four app screens** at ≥1024px using the ChatPanel pattern (full-width chrome, centered content column ~980px): Discover/Home (search + browse + personalization), Following, Account. Card grids gain a third column before any "+N more". These files get their **first** media queries — QA at 900/1024/1280/1440px and verify ≤900px is pixel-unchanged.
- **WI-8 — Scores responsive grid.** Replace the fixed 2-column cap + "+N more" click-through with `repeat(auto-fill, minmax(...))` inside the widened column; a fan following 6+ teams sees all tiles at once.
- **WI-9 — Tournament-page text blocks.** Widen the capped blocks (hero subtext, registration banner, champion card, announcements grid) from 520–620px to sit proportionally in the wide content area (`app/[orgSlug]/Home.module.css` + tournament overview components).

### Chunk C — Footer, credit & app discoverability

- **WI-10 — Footer restoration + paid-tier credit.**
  - Turn the existing `Footer.tsx` on at desktop widths across the consumer shell and org/tournament pages (columns per Option 1 mockup: Explore / Get Started / Account + QR block). Chat screen: verify the fixed-height ChatPanel isn't compressed — footer may need to be excluded on the open-conversation view.
  - **Decision logged 2026-07-30 (`BUSINESS_DECISIONS.md`) — unblocked.** Paid-tier tournament pages + plain org home get a quiet **text-only** credit ("Built on FieldLogicHQ"; final wording + link ruling via `/marketing`). Binding constraint: **subtle** — no banner/badge/CTA block, small type, org theme tokens. Free-plan badge/banner behavior unchanged.
- **WI-11 — "Get the app" discoverability.** Footer QR block ("Also on your phone") + a desktop-visible Get the app card in Account settings (QR + short copy). Zero changes to install-prompt suppression logic. QR target: a stable URL (marketing root or a `/get-the-app` anchor) — decide at build; static asset, no tracking dependency.

## Sequencing

A (nav states — highest blast radius, restart required) → B (CSS widening) → C (footer/QR/credit). Each chunk: `npm run verify:changed` + focused visual QA before moving on. WI-10's credit sub-item last, after the `/strategy` decision.

## Risks & mitigations

- **ConsumerNav is the highest-blast-radius shared component** (consumer shell + every tournament page, both ≥901px and ≤900px). Regression-test both variants × both breakpoints × all three auth states. Restart dev server after Chunk A (shared component).
- **First media queries in zero-breakpoint files** (WI-7/8): risk of mobile regressions — diff rendered output at ≤900px before/after.
- **Footer under ChatPanel** (WI-10): fixed-height panel; exclude footer there if it compresses the composer.
- **WI-4 chat-membership signal:** if a cheap "has conversations" check isn't already available to the nav, fall back to showing the chat icon for all signed-in users (still no labeled tab) and note the follow-up.
- **Paid-tier credit** is a packaging change; `/strategy` logs it (and `/billing` implications) before build.
- **SW cache denylist rule** (FP-2): no new authed top-level routes are added by this plan — nothing to add; re-verify if WI-11 introduces a `/get-the-app` route.

## Verification

- `npm run verify:changed` per chunk; `npm run typecheck` after Chunk A (shared modules).
- Playwright computed-style checks for the widening claims (column widths at 1440px, grid column counts) rather than screenshot-eyeballing.
- Manual QA matrix: {anonymous, signed-in fan, coach, admin} × {Discover, Scores, Account, org home, tournament page} × {1440, 1024, 900, 390}.
- Post-build: offer `/simplify` (new persona-menu + state logic in shared nav) → `/review` → owner browser QA → `/docs` pass (fan-facing chrome + Get-the-app card are user-facing flow changes).

## Success criteria

- No consumer/org desktop surface is a marketing dead end (footer or nav path to Pricing from every screen).
- Anonymous tournament visitors see zero inert app chrome (no Chat/Account tabs, no badges).
- Desktop app screens use ≥65% of a 1440px viewport's width for content.
- Mobile app discoverable from desktop (QR in ≥2 places).
- Zero visual regressions ≤900px.
