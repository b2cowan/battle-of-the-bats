# Navigation Model Investigation — Verified Findings

**Date:** 2026-07-30 · **Status:** Investigation complete (no code changed)
**Method:** 19-agent verification sweep — 10 parallel readers mapped every shell and context-changing
mechanism against the working tree; 8 adversarial verifiers attacked the load-bearing claims; 1
completeness critic hunted for missed mechanisms. 97 mechanism claims collected; every claim below
survived verification or is stated as a correction. Companion docs: `NAVIGATION_MODEL_PLAN.md`
(recommended model + staged plan) and `NAVIGATION_MODEL_PM_BRIEF.md`.
**Source brief:** `NAVIGATION_MODEL_INVESTIGATION_PROMPT.md`. Prior artifacts absorbed: "One frame,
four hats" (9fdaec75), "Two axes" (bee72c5c), "Phase 2 proposals" (f2b33b25).

---

## 1. There are not four shells. There are nine.

The brief's table lists four. The working tree has nine distinct navigation surfaces, each with its
own chrome family:

| # | Shell | Chrome | Wordmark target |
|---|---|---|---|
| 1 | Marketing (`/`, `/for-*`, `/pricing`) | Navbar top bar + 5-link mobile bottom bar | `/` |
| 2 | Consumer app (`app/(consumer)`: Home/Scores/Chat/Account) | ConsumerNav top bar (desktop) / bottom tabs (phone), state-based per Phase 1 | `/discover` |
| 3 | Org public home + league/teams/archives (`/{orgSlug}`, `/league/**`, `/teams/**`, `/archives`) | Navbar org-home branch: logo + Pricing + operator pill + Sign In/Account. **No consumer tabs, no bottom bar, no hamburger** (`lib/consumer-routes.ts:75-81` deliberately excludes it) | `/{orgSlug}` (self) |
| 4 | Public tournament pages (`/{orgSlug}/{tournamentSlug}/**`) | THREE simultaneous layers: ConsumerNav tournament strip (platform) + branded Navbar/event header + TournamentSideRail ≥1024px / TournamentTopTabs ≤900px | Two wordmarks, two targets: event logo → tournament overview; platform wordmark → `/discover`. **Neither → org home** |
| 5 | Admin (`/{orgSlug}/admin/**`) | AdminSidebar (6 URL-keyed content modes) + AdminEventHeader + AdminBottomNav w/ More sheet | **Dead — sidebar logo is an unlinked `<div>`** (`AdminSidebar.tsx:252-262`) |
| 6 | Premium coach portal (`/{orgSlug}/coaches/**`) | CoachesSidebar + CoachesBottomNav w/ More sheet. Operator "HQ" family | **None — no wordmark anywhere** (deliberate owner call, `CoachesSidebar.tsx:148-151`) |
| 7 | Free coach portal (`app/coaches/**`) | Consumer "companion" family since A2: ConsumerNav variant='coach' + sticky team header + section tab row. **More sheet retired** | `/discover` (desktop only; no wordmark at all on phone) |
| 8 | Scorekeeper / Check-in (`/{orgSlug}/scorekeeper`, `/check-in`) | One minimal sticky header, identical on all viewports: wordmark + FlipPill + cross-tool link + sign out | Dead (plain text) |
| 9 | Platform admin (`/platform-admin/**`) | Own sidebar (7 role-filtered groups); phone = horizontally scrolling top strip | Dead (plain text) |

Token-based one-shot surfaces (tryout-score, tryout-response, unsubscribe) are deliberate chrome-less
dead ends — correct as designed; a nav model must simply leave them alone.

### The nine shells already have a ratified grouping — and it is not "four shells"

`design_decisions.md` [2026-07-25] carries an owner-ratified, still-binding **two-family chrome
ruling** (also logged in `BUSINESS_DECISIONS.md`) that any model here must complete rather than
replace:

- **Consumer family** — fans *and* the free/Basic coach portal: global consumer bottom nav
  (Home · Scores · Chat · Account) always present; identity in a persistent event/team header with
  the Flip top-right; sections in a horizontally-scrolling tab row.
- **Operator family** — org admin *and* the Premium coach portal: workspace shells (desktop sidebar +
  operator bottom nav), grouped sections, admin conventions, header-right Flip.
- **Standing rules:** the tournament-record surface is *shared* between tiers (tiers differ in season
  tools, never in tournament experience); **the Flip is always header-right at every width in both
  families**; and **any new surface must pick a family**.
- **Already-logged future direction:** "when [Premium's] sidebar is next touched, group ~14 sections
  into domains *and converge shell components with admin's*."

So the honest frame is not nine unrelated shells but **two families + deliberate exceptions**
(marketing, platform-admin, volunteer tools, token pages). The navigation problem is that the two
families are internally coherent but have **no shared answer for moving between places** — and the
exceptions were never given one either.

**Brief correction (free coach portal):** the brief's table shows "Coach portal: grouped sidebar +
More sheet" as one shell. That describes only PREMIUM. The free portal joined the consumer family in
A2 (committed 2026-07-26): global consumer tabs, team-switcher popover on the header name, scrolling
section tab row, no More sheet. Free vs premium are also two separate data models with a
migrate-on-upgrade architecture (decided 2026-06-19, don't re-litigate). Any place model must accept
that "a team you coach" can live in either chrome family.

---

## 2. The mechanism inventory

"Context-changing" = changes which org / tournament / team / season / side (operator-vs-public) the
user is operating in. In-place section navigation excluded.

### 2a. Place-changing controls (user-visible)

| # | Mechanism | Where | Who sees it | What it actually is |
|---|---|---|---|---|
| P1 | **Operator pill** (`resolveOperatorPill`, `lib/use-role-summary.ts:16-23`) | Desktop-only utility cluster: consumer shell, tournament strip, org-home navbar, free-coach top bar. **No phone equivalent anywhere** | Signed-in role-holders | ONE door: account's primary org Admin Area (first `organization` context by sort — `lib/user-contexts.ts:617-619`), else the flat `/coaches` hub. Admin always outranks Coaches. **Global, never scoped to the page's org** (deliberate, accepted in Chunk A review). `coachHref` is hard-coded `/coaches` — never the specific premium org (`app/api/me/role-summary/route.ts:28-30`) |
| P2 | **Home "Workspaces" cards** (`HomePersonalization.tsx:138-147,222-248`) | In-page content on Home (/discover), all viewports | Signed-in, ≥1 non-fan context | **The only complete list** of every operator surface an account holds (all contexts: multi-org admin, premium + free coach, official). Everything else collapses to one door |
| P3 | **"All Workspaces" link** (`AdminSidebar.tsx:612-616`) | Admin **desktop sidebar footer only** — NOT in the mobile More sheet (verified) | Admins with 2+ active `organization_members` rows only — **coach/official contexts don't count** (`lib/org-membership-policy.ts:60-67`) | A link to /discover (two-hop). **No dedicated workspace-switcher component exists anywhere in the repo** (grep: zero matches) |
| P4 | **Admin tournament switcher** (`AdminSidebar.tsx:458-533` + More-sheet twin) | Tournament-ops sidebar top / More sheet | Admins, 2+ tournaments | One mechanism, two surfaces (same `TournamentContext`). **Client-state only — the URL never changes**; selection is unbookmarkable, and Accounting's URL-addressed ledger scope can silently disagree with it |
| P5 | **House-league season switcher** (`AdminSidebar.tsx:366-386`) | Admin sidebar, HL season screens, **desktop only** (no mobile equivalent) | HL admins, 2+ non-archived seasons | Real navigation (`router.push` to a season-id URL) — the opposite mechanic of P4 for a parallel job |
| P6 | **Rep-teams program-year card grid** (`admin/rep-teams/teams/[teamId]/page.tsx:164-197`) | In-page, admin rep-teams team detail | Rep-teams admins | A third, URL-addressed season mechanism; not cross-linked with P5, the coach-side season doors, or the team History route |
| P7 | **Premium team switcher** (`CoachesSidebar.tsx:158-185` / `CoachesBottomNav.tsx:186-231`) | Premium sidebar select (desktop) / More-sheet row list (phone) | Premium coaches, 2+ assignments **in this org** | **Same-org only** (`getCoachingAssignmentsForUser(authCtx.org.id,…)`). Includes "Season complete" closed-team doorway (newest closed year per team only — older seasons have no nav path) |
| P8 | **Free team switcher** (`CoachPortalShell.tsx:319-385,464-473`) | Header-name popover (phone) / rail select (desktop) | Free coaches, 2+ basic teams | **Cross-org by data model** (org-less). Popover footer states the house rule: *"All your workspaces live on Home"* (`CoachPortalShell.tsx:383`) |
| P9 | **/coaches hub** (`app/coaches/page.tsx:55-70`) | Standalone page | Multi-context coaches | Aggregates ALL coach contexts (free × premium, cross-org). Auto-skips itself when total = 1. This is where the pill's flat `/coaches` door lands |
| P10 | **Coaches Portal door in admin** (`lib/use-current-org-coach-access.ts:20-25`) | Admin sidebar footer + mobile More "You" | Admins who also coach | Correctly org-scoped (this org's rep access, else global free hub) — the one door that IS page-scoped |
| P11 | **"Back to admin"** (`CoachesSidebar.tsx:245-250`) | Premium sidebar/More | Coaches who are owner/admin **of the same org** | Never renders for an admin-of-a-different-org |
| P12 | **StartMenu persona menu** (`StartMenu.tsx:21-81`) | Desktop utility cluster, everyone | All | Creates NEW places (organize/coach/join/league). Root-mounted strips use safe chooser defaults |
| P13 | **Chat "Rooms" switcher** (`CoachChatView.tsx:19-27,165-180`) | Premium Chat page | Coaches | In-place conversation switcher listing every room account-wide — can silently show a different team/tournament than the URL context |

Plus content-level doors: lapsed-workspace reactivate cards, footer "Coaches" link (→ premium
checkout — a *different product* than StartMenu's "Coach a team" → free flow; unreconciled), upgrade
doors (ScopeShelf/Explore/afterglow).

### 2b. Side-changing controls — the Flip family

One shared component (`components/shared/FlipPill.tsx`) with one shared multi-hat "Roles" popover;
per-surface resolvers:

| Surface | Behavior | Verified gaps |
|---|---|---|
| Admin, tournament screens | Page-matched twin to the tournament's public page; multi-hat lateral rows (coach/official on this event) | — |
| Admin, org-level screens (org admin, HL, rep teams, accounting, public-site) | **Flips to `/{orgSlug}` — the org public home — labeled "Public site"** (`lib/use-admin-flip.ts:92-104`) | **One-way**: the org home has no FlipPill, so there is no page-scoped return — only the *global* operator pill, which happens to be right in the 1:1 case |
| Public tournament page | Hat-resolved: coach → tournament record; admin → page-matched; official → scorekeeper; multi-hat → Roles popover | — |
| Premium coach | Record-page corner pill (with Roles popover) + per-row FanViewLinks | FanViewLink never writes return-memory |
| Free coach | Shell-header pill, tournament-record route only | **Always single-target — a free coach who also holds admin/official hats never gets the Roles popover** (premium does; `CoachPortalShell.tsx:392` vs `CoachTournamentRecord.tsx:626-648`) |
| Scorekeeper | 0 events → org root; 1 → public schedule; 2+ → chooser | **No lateral hats** — a multi-hat operator must flip to public first, then use the public pill's Roles popover |
| Draft preview | PreviewExitPill is the *only* way out of the stripped preview shell | Single point of failure, works today |

Return-memory ("⇄ Back to {origin}", 20-min sessionStorage) works only through FlipPill and only for
single-target resolutions — verified.

### 2c. Automatic dispatchers (no click)

- **Post-sign-in resolver** (`lib/auth-destination.ts:36-97`): solo-workspace users land *straight in
  their shell*, never seeing consumer chrome; platform admins bounce to /platform-admin; everyone
  else → /discover.
- **PWA start_url router** (`app/page.tsx:156-176`): every installed-app launch re-runs the same
  resolver — `/` is not a stable page for PWA users (relevant to every "wordmark → /" link).
- **Silent free→premium redirect** (`lib/coach-team-page.ts:95-100`): any team-scoped free route
  relocates into `/{premiumSlug}/coaches` when the linked workspace goes live — an automatic
  org-context switch.
- **Org home has three distinct states on the no-public-site tiers** (verified 2026-07-31, follow-up
  question): 1 active tournament → redirect into it; **2+ active → a genuine tournament selector**
  (org name + logo, "Select a tournament below," a card per event); **0 active → a
  FieldLogicHQ-branded placeholder reading "This organization hasn't set up their public site yet"**
  (reachable from a *completed* event's page, which stays live until sealed). Only the selector is a
  destination worth linking to. Note that placeholder is *platform*-branded while carrying the
  customer's name.
- **Org home self-destructs — but only on the tiers without a public site.** The
  single-active-tournament redirect (`app/[orgSlug]/page.tsx:259-261`) sits inside the **default
  branch, reached only when `module_public_site` is NOT entitled** — i.e. Tournament and Tournament
  Plus orgs, whose org home is a thin fallback anyway. League/Club orgs (which own the module) render
  a real org home with hero, events, League Play / Tryouts / Archives CTAs and **never redirect**.
  *This sharpens Q3 rather than softening it: the org public home is a genuine destination exactly on
  the paying tiers — and those are exactly the orgs whose tournament pages have no link back to it.*
- Legacy shims: `/my/*`, `/team/*`, `/home`, `/official/*`, free per-team chat →
  global `/chat` (drops the team's room scope — the one lossy shim).

**Honest count:** the brief said "at least seven ways to change context." Collapsing desktop/mobile
twins into one mechanism each, there are **13 distinct user-facing place-changing mechanisms, a
6-surface flip family, and 5 automatic dispatchers** — spread over 9 shells. The "workspace switcher"
in the prior notes does not exist as a control; the "roles chooser" is not a separate control (it's
the FlipPill's multi branch); and the "season switcher" is four unrelated mechanisms.

---

## 3. Corrections to the brief (what a prior session got wrong)

1. **"No clean path to an org's public page" — REFUTED as stated.** The admin flip already lands on
   `/{orgSlug}` from every org-level admin screen, labeled "Public site"; Discover's org search rows
   and the Following·Organizations cards also link straight there. The claim survives only narrowly:
   **from the premium coach portal, the free coach portal, tournament-scoped admin screens, and — most
   importantly — from a tournament's own public pages** (exhaustive grep: zero bare `/{orgSlug}` hrefs
   in tournament chrome; the only such link in the codebase is the org-home navbar's self-link).
2. **The sharper, previously-unnamed gap is the reverse:** on the org public home, a *fan* has no
   door into the consumer app at all — no Discover/Scores/Chat links, no bottom bar; it is the
   thinnest nav surface in the product. The org home is also absent from the sitemap
   (`app/sitemap.ts:23-45` emits only marketing + tournament URLs) — crawlers can't find it, and
   nothing in-app links up to it. Both halves of the gap land hardest on **League/Club orgs**, the
   only tiers whose org home is a real, paid-for page (verified: the auto-redirect that erases org
   home for single-tournament orgs applies only to tiers *without* `module_public_site`).
3. **"Workspace switcher" ≠ a switcher.** It's a desktop-only, 2+-org-membership-gated link to
   /discover; the real chooser is the Home Workspaces card list. Most admins never see any cross-org
   control (single-org-by-default policy).
4. **Free coach portal chrome** — see §1. The brief's four-shell table is stale on this row.
5. **YearSelector is dead code**: `SEASON_PICKER_ENABLED = false`, unconditionally `null`, yet still
   mounted on Schedule/Standings/Teams. **No season/year switcher exists anywhere on public pages, for
   anyone.**
6. **Check-in is not a public surface** (auth + capability walled); `/{orgSlug}/schedule|standings|
   results|news|rules|register` are one-line redirect shims into the active tournament, not pages.
7. **The seven-switcher list conflated levels.** See honest count above — the true picture is both
   worse (13 + 6 + 5 across 9 shells) and more tractable (several "switchers" are one shared
   component or don't exist).

---

## 4. The seams (verified, design-relevant)

### Islands and dead ends
- **The premium coach portal is an island** — no wordmark, and its only exits are Help (new tab,
  chrome-wrapped, contradicting the free portal's focused-help rule), same-org-only "Back to admin",
  and Sign out. A premium coach with any second place (another org's team, an admin role elsewhere,
  or just the fan app) has **no in-chrome way out**; the only generic consumer door renders in one
  empty-state branch. Cross-org premium coaches must hand-edit URLs (verified line-by-line).
- **Desktop single-org admins have no consumer doors** (mobile More's "You" section — Home/Chat/
  Account — has no desktop equivalent) and the admin wordmark is a dead `<div>`.
- **Org public home**: dead end inward (no consumer chrome), one-way flip target (no return pill),
  invisible to crawlers, and auto-skipped for single-tournament orgs *on the no-public-site tiers*.
  On League/Club — where the page is real and paid for — nothing in the org's own tournament pages
  links to it.
- Scorekeeper: a gate-only official landing on /scorekeeper hits "Access Denied" with **no forward
  link to /check-in** (the cross-link lives in the shell they can't reach); new gate-purpose invites
  land on /scorekeeper regardless.

### Multi-hat collapse (the owner's Q1 personas, traced)
- **Admin of org A + coach at org B:** the pill *always* says "Admin Area" (org A); the coaches portal
  never appears in persistent chrome. Inside B's premium portal there is no admin door (Back-to-admin
  is same-org). Both shells are simultaneously reachable **only** via Home's Workspaces cards.
- **Two premium teams in two orgs:** each portal's switcher is same-org; no in-portal cross door; the
  /coaches hub lists everything but nothing in the premium shell links to it.
- **Two-org admin:** pill shows whichever org sorts first; the second org exists only on Home.
- **Scorekeeper on 2+ events:** fine — the board is a flat day-list; the flip chooser handles the
  public side. No in-tool switcher needed (verified: none exists, none missed).
- **Platform admin:** zero bridge either direction (only a one-way login-time bounce). Deliberate
  separation; leave alone.
- **Multi-team coach with no admin role:** `hasMultipleWorkspaces` counts only org memberships, so
  no shell ever shows them a cross-place door; Home is their only aggregator.

### Role revoked mid-session (Q1's last persona)
Layouts don't re-run on soft navigation and no client context polls or subscribes; enforcement is
per-request at the data APIs (instant 403s). Experience: stale chrome keeps showing the revoked
team/org; pages fail with generic "Failed to load"; only a hard reload runs the layout guard; a
removed team then vanishes silently. Suspension gets an explanatory page; removal gets nothing.
Platform-wide pattern, not coach-specific.

### Phone reality (Q2, measured against code)
- Operator pill is desktop-only. **On a phone, the only route from consumer surfaces into any
  operator shell is the Home feed's Workspaces cards.**
- Admin More sheet: ~20+ rows across 5 labeled sections in realistic states, height-capped
  `min(74vh,620px)` + scroll. Coach More sheet likewise capped — after shipping a real bug where
  unbounded growth pushed the team switcher off-screen (`CoachesBottomNav.module.css:108-111`).
- Admin mobile More has **no** All-Workspaces row (desktop-only affordance) — a phone place-switcher
  would be a wholly new addition to an already-scrolling sheet, sitting directly above/beside the
  same-shell switchers ("Current tournament" / "Your teams") it would be confused with.
- The free coach shell has **no More sheet at all**, and the consumer shell has none either — "top of
  the More sheet" simply has nowhere to live in two of the four persona shells.
- In-code precedent already routes this job elsewhere: *"All your workspaces live on Home."*

### Plan-gating honesty (Q for constraints; verified clean with 3 exceptions)
The nav is honest tier-by-tier: module entitlements gate admin sidebar modes and org-home CTAs
server-side; Tournament/Tournament-Plus never see org-admin (enforced at proxy, layout, and sidebar);
public league pages 404 without the module; free-floor grants are respected. Exceptions worth fixing
(all low-exposure, direct-URL-only):
- `team`-plan orgs are NOT in `TOURNAMENT_TIERS`, so their owner can reach `/admin/org/*` where nav
  renders but APIs 403 (`lib/billing-urls.ts:3`; billing page alone branches gracefully).
- `role='coach'` members hitting `/admin` get the blank zero-tile hub — the exact J8-019 bug fixed
  for `official` but not its sibling.
- AdminHub shows the Coaches Portal tile on module entitlement alone; the sidebar gates the same door
  on personal coach access — two rules for one destination.

---

## 5. The anonymous baseline (Q5 — what must never change)

Verified: anonymous visitors get **zero role chrome and zero identity fetches** everywhere —
`role-summary` / `tournament-viewer` / chat hooks are all gated on a local signed-in check; the flip
pill renders nothing; SW caches tournament HTML as anonymous-only with identity resolved
client-side. The line to hold: *role machinery may not add one element, one fetch, or one byte to an
anonymous page.* Two existing paper-cuts (not regressions to protect):
- `/api/consumer/home` fires ungated on Home for anonymous visitors (server short-circuits; one
  wasted round trip) — the only ungated identity-shaped fetch in the shell.
- The tournament layout runs a server-side `getAuthContext` on every render purely to gate the
  free-plan acquisition banner (cheap for anon, but it is auth machinery in an anonymous render path).

---

## 6. Incidental defects found (report-only; not fixed — this was an investigation)

| Severity | Finding |
|---|---|
| **Security (HIGH)** | `/platform-admin/login` honors `?next=` with **no `safeNextPath` sanitization** (`app/platform-admin/login/page.tsx:45-46`) — open-redirect (CWE-601) on the most privileged login, while consumer auth pages are hardened. Fix independently of any nav work. |
| Bug | Admin House League "Past Seasons" nav item 404s — `${base}/house-league/past` has no page (rep-teams' sibling works) |
| Bug | Org-home "Tryouts Are Open" CTA hardcodes `/{orgSlug}/teams`, a legacy shim that redirects to the active tournament's bracket teams or loops back home — wrong/dead for rep-teams orgs (per-team slug data is already at the call site) |
| Bug | Platform-admin `next` also composes badly with consumer login: platform emails always have `hasWorkspace:true`, so a stray `next` can land them on an unrelated org route |
| Debt | `isLeagueOrClub` (`AdminSidebar.tsx:83`) omits `club_large` — unused today, the exact stale-list landmine the file's own comment warns about |
| Debt | Feature Matrix (platform-admin) publishes to a table the runtime gate never reads — a ghost control |
| Debt | Dead `/platform/*` pages (4) linked from nowhere; YearSelector dead-mounted in 3 components; three unreachable branches in `isMarketingPath` |
| UX | Legacy free-coach team-chat link redirects to the unscoped global /chat, losing the room |

---

## 7. Evidence question (Q6 — what to measure)

Nothing measured today can say how often people move between places. The instruments that would
decide the expensive parts, in increasing cost: (a) count multi-place accounts (one query over
contexts — establishes the *population* that any switcher serves); (b) log uses of the existing
doors (operator pill clicks, Workspaces-card clicks, All-Workspaces clicks, flip uses by surface) —
these are the direct demand signal; (c) session-level place-transition counts. The recommended model
in the plan doc is staged so that everything shipped before evidence exists is justified by a
verified defect (dead end, island, parity gap) rather than by assumed traffic.
