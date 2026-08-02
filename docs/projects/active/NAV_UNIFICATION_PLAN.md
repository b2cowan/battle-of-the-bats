# Navigation Unification — one app, four rooms

**Date:** 2026-07-31 · **Status:** APPROVED — mockups rev 2 owner-approved 2026-07-31 ("looks good,
go ahead"); grammar ratified; Stages A–E cleared to build. D1 still open; D2 signalled-yes, pending
explicit ratification before Stage H.
**Build status:** ✅ **Stages A + B + D COMMITTED dev `453c3df0` 2026-07-31** (owner QA passed;
/simplify + /review funnel complete — see below). ✅ **Stage C BUILT on dev 2026-07-31, uncommitted
— owner QA pending:** new `AdminTopStrip` (fixed at the shared `--chrome-bar-h`, desktop >900px
only, z-60) mounted by
AdminChrome on all non-focused admin surfaces — wordmark→Home + bell (hoisted count, moved from the
sidebar) + account + WorkspacesPill (2+ places). **NO chat door (owner ruling 2026-07-31,
generalized from the coach strip): chat is a section of the work, not an exit — a /chat door
duplicated the shell's own Chat and ejected the operator into consumer chrome.** Sidebar opens with the org name (pure place chrome; lockup styles
retired); footer "All Workspaces" retired into the popover; orphaned `/api/me/workspaces` +
`use-has-multiple-workspaces` DELETED. Geometry via `--admin-topstrip-h` on `.adminShell`
(= `--chrome-bar-h`, 48px since Stage G — this line read 44px, the pre-Stage-G value, until the
2026-08-01 top-nav audit; 0 on mobile + focused shells): sidebar top/height, event-header sticky top, and the three
`--admin-header-h` sticky-toolbar consumers now stack both offsets. Preview/onboarding/help shells
unchanged. Gate green; typecheck clean.
✅ **Stage H.1 BUILT on dev 2026-07-31, uncommitted — D2 ratified same day** (owner: admin hubs are
one product surface; branding applies). New `CoachTopStrip` (+css) mounted by the premium coach
layout inside the warm marker: wordmark→Home · account · WorkspacesPill (warm popover skin w/ new
dark fallbacks). **The chat door was REMOVED post-build (owner ruling 2026-07-31, another session):
the portal's own Chat is per-USER ("Your chats") — the strip's door was a duplicate that ejected
the coach into consumer chrome. Strips carry only genuine leave-this-place doors.**
Skin = portal tokens (`--card-bg`/`--home-line`/`--white`/`--logic-lime`), so it flips warm/dark
with the account theme like the sidebar; z-80 (above save bar 40 + dropdowns 60, below modals 200).
Shell pads down by `--coach-topstrip-h` (= `--chrome-bar-h`, 48px since Stage G; 0 ≤900px). **Mockup-faithful deviations from admin:
NO bell in the strip** (stays in the sidebar header — portal-scoped notifications; mockup shows
none) and **no sidebar edits at all** (CoachesSidebar/BottomNav are mid-edit by a concurrent
session; the portal's "COACHES PORTAL + org name" header already reads as pure place chrome).
Mobile portal untouched (still no Home/Account doors — the Stage H mobile pass stays gated on the
More-sheet overflow check). Gate green; typecheck clean.
✅ **D1 + Stages F + G BUILT on dev 2026-08-01, uncommitted — owner QA pending.** /design gate run
first (verdicts logged in memory/design_decisions.md; both stages approved WITH CHANGES).
**D1 (phone only):** new `showsOrgPublicChrome` gates the app bottom bar onto org public pages
≤900px; ConsumerNav returns the bar ALONE there (no strip), before any strip machinery is built.
`ORG_STATIC_SECTIONS` split by AUDIENCE (operator vs public) with the union derived, so the two
chrome predicates read different halves of ONE list — proven mutually exclusive by unit test.
role-summary stays gated to the tournament strip: the org navbar already resolves it for its own
door, so a second call would be a duplicate fetch.
**F (section tabs):** new `OrgSectionTabs` — a tab row at EVERY width (NOT the 248px rail: an org
root is a directory page, and a permanent quarter-viewport column for three words fights the hero).
Gated on `module_public_site` + 2 sections. Mounted by the org layout (which owns the server data)
but SELF-GATING on pathname, because that layout also wraps /admin, /coaches, /scorekeeper and every
tournament page. It declares its own geometry as SSR'd markup: `--nav-height` grows by
`--org-sections-h` so every org page's existing `calc(var(--nav-height) + …)` padding clears both
rows with ZERO per-page edits (new `--nav-height-base` = the identity row; `.nav` measures the base).
Same markup sets `--org-crumb-display: none` — ONE condition drives both the row and the crumb's
retirement, so they can never both paint. **`teams` is a crumb label but NOT a tab** — no rep-teams
index page exists (`/{org}/teams` is a redirect shim; the org home's "Tryouts Are Open" card
pointing at it is a known broken link), so the section table carries a `tabbable` flag rather than
splitting into two lists.
**G:** the coach dark-mode gap fixed AT SOURCE (new `html[data-user-theme="dark"]
[data-coach-warm-enabled]` block in globals beside the warm one; WorkspacesPill's per-property
fallbacks DELETED — they were patching a missing injection point one property at a time). Shared
`--chrome-bar-h` (48px, the ONE platform chrome-bar height — see below) / `--icon-door-size` / `--icon-door-radius`; both shells' local strip vars now
DERIVE from the shared one (deliberately NOT renamed — a dozen sticky headers read them with a
`, 0px` fallback, so a missed rename would silently tuck a toolbar under the strip). Door order
audited and ratified as already correct; no code change.
**Gate:** typecheck clean, lint clean, **745 unit tests pass** (+18: the two route predicates proven
mutually exclusive, the section table's crumb/tab split). Browser suites **33/33 green**, extended
with D1 (phone bar state-based + no new identity round-trip + desktop deliberately bare) and F
(row renders, crumb steps aside, active tab follows depth, tournament tiers get no row, row is
identity-free in SSR). All six token ratchets ZERO. Dev server restarted on a cleared cache,
login 200, no EACCES.
⚠ **NOT done, still open:** the org-page light/dark setting — every org page is dark on every tier,
so a club with a light tournament page still hard-flips to dark going up. F doesn't worsen the seam
but doesn't close it; it needs a settings screen + stored preference (product work, not navigation).
⚠ **A concurrent session's file broke the dev server mid-verification** (a practice-plan editor
importing `../../../../coaches.module.css`, one level too many → Module-not-found → 500 on EVERY
route). Corrected locally to unblock the run; that file is NOT part of this work and must be
excluded from the commit.

✅ **Stage E COMMITTED dev `db0db159` 2026-08-01** (owner QA passed; /simplify + /review funnel complete — see the funnel note at the end of this block). All five items.
**E.1** the Discover anchor was already shipped (Desktop Public UX WI-6) so the only delta is a
**click** handler → NEW `lib/nav-beacon.ts` (allowlist + `sendBeacon`/keepalive send in ONE module,
so client and endpoint can't drift) → NEW `POST /api/client/nav-beacon` logging
`[metric] nav_click event= from=` (mirrors Stage A's `multi_hat` CloudWatch line). Always 202 (a
beacon must not be probeable); allowlisted event names only (an open `event` field = an arbitrary
log sink); `from` passes a code-point printable filter (log-injection guard on a browser-supplied
value). ⚠ **The CTR DENOMINATOR is deliberately NOT collected** — a page-view beacon is a new
anonymous request, which §5 forbids; org-page view counts must come from server request logs when
the gate is read. Abuse control uses the EXISTING `lib/rate-limit.ts` (per-IP bucket + spoofing-proof
global ceiling, the same pairing as auth/signup); error-capture's inline throttle was repointed at it
too. Cross-origin posts are rejected via a NEW exported `isTrustedAppOrigin` extracted from
`lib/app-origin.ts`, and the log-value filter drops C0/C1 **and U+2028/U+2029** (both survive
JSON.parse and render as line breaks in log consoles — enough to forge a whole fake metric line).
**E.2** NEW `resolveOrgReturnFlip` in `lib/flip-twins.ts` (beside the event-level resolvers, not a
new module): fed the workspaces list the org-home nav ALREADY resolves — no new fetch, no second
readiness probe (the Stage-B review catch). Segment-exact slug match (`/${slug}/`) so `ravens-north`
can't borrow `ravens`'s pill; 1 door → direct pill labelled by `flipSurfaceLabel`, 2+ → the "Roles"
chooser with each row sublabelled by place. Renders through the shared FlipPill, so return-memory
works for free. **Precedence: the flip BEATS the Workspaces pill on this surface**, matching the
ratified tournament-strip rule — accepted trade: a multi-workspace operator standing on their own
org page gets the flip instead of the ENTER chooser (Home + Account still reach everything).
**E.3** NEW `lib/org-public-sections.ts` — **SECTION names (League/Teams/Archives), owner-ruled
2026-08-01 after a two-window mockup comparison**, NOT entity names: entity names needed four more
pages to publish into nav context (the plumbing the OrgNavSync restore fix already had to repair)
plus a truncation rule; section labels need neither and the page heading already names the entity.
Depth-insensitive (a season page still reads "League"); unnamed sections render nothing rather than
guess. Identity block split — `.logo` is now a row, `.logoLink` carries the self-link.
**E.4** NEW `getOrgSitemapEntries` reusing `isOrgHomeRealDestination` (never restated); the
followable-org predicate extracted to `scopeFollowableOrgs<T>` (the file's own
`scopeListedTournaments` convention) so ONE predicate serves two column sets. `hasModuleEntitlement`
/`isOrgHomeRealDestination` now take a narrowed `EntitlementOrg` (4 fields) so a partial scan row
can ask. Both sitemap scans fail independently + quietly. **Verified discriminating on dev: 2 real
destinations in, 7 eligible-but-redirecting/placeholder orgs correctly out.**
**E.5** BuiltOnCredit on the three named call sites (league index, rep team, archives index), same
`!isFreePlan` gate as org home.
**Gate:** typecheck clean; verify:changed **0 errors**, all six token ratchets ZERO, date + coverage
green (⚠ the ONE red is `check-schema-parity` — a CONCURRENT session's mig #213 practice-plan
columns; this stage touches no schema). Unit tests **727 pass / 0 fail** (+13 new: 6 for the org
return flip incl. the prefix-org leak, 7 for the crumb). **NEW Playwright `anonymous-public-
invariant.spec.ts` — 21/21 green** (written as a STANDING guard, not a one-off): Q5.1 zero identity
requests on marketing/consumer/org-home/org-league/tournament, Q5.2 no operator door for anonymous,
Q5.4 role-free SSR payload, plus beacon-fires-on-click-not-render and the sitemap gate. **NEW
`org-return-flip-smoke.spec.ts` — 7/7 green** (the signed-in half: the door appears on an owned
org, is per-page scoped across two owned orgs, and is absent on a foreign org — a control gated so
tightly it never renders fails silently, so both halves are tested). Dev server restarted on a
cleared cache, login 200, no EACCES, clean log.
⚠ **Deliberate reading of the superseded §Q5 item 3** ("no crumb may be added to org pages at all"):
that line is superseded by this plan's §5, which measures parity on **org home (root)** — where E.3
adds nothing by design — and by owner approval of Stage E's scope. The crumb is URL-derived, carries
no role/membership/hat state, and is asserted visible to ANONYMOUS visitors in the spec, so it
passes Q5.2 as written. Flagged rather than assumed.
**FUNNEL (2026-08-01).** /simplify applied 5 — **deleted a duplicate rate limiter this stage had
written (`lib/rate-limit.ts` already existed with the same eviction loop and IP parser; both client
endpoints now use it)**; nav door precedence flattened to one chain; the sitemap's fail-quiet contract
stated once; flip targets built once; and the sitemap now skips counts it doesn't need (a
module-owning org is a real destination at any count — `isOrgHomeRealDestination` is monotonic in
count, so the short-circuit is sound), which also keeps the `.in()` id list small. Skipped 5, notably
`composes: logo` on `.logoLink` (would have newly applied `flex: 1 1 0` to the inner link — a layout
change AFTER owner QA) and pushing the BuiltOnCredit plan gate into the component (edits 3
pre-existing call sites; a good platform-wide follow-up, not this stage's).
/review at high-risk, 5 lenses → **3 CONFIRMED + FIXED, all on the new public endpoint**: (1) any
third-party site could inflate the Discover metric cross-origin with one line of JS — it feeds a real
go/no-go gate, so an Origin check was added (an ABSENT Origin still passes: only browsers must send
one, so rejecting absence would drop legitimate clients — this blunts the drive-by vector, not a
scripted caller); (2) the U+2028/U+2029 log-forgery gap above; (3) one unrecognized plan_id would have
cost EVERY org its sitemap entry, since the fail-quiet wrapper can only drop the whole batch — bad
rows are now filtered once, up front. **REFUTED: "the direct FlipPill import adds anonymous-bundle
bytes" — `TournamentFlipPill` already imported it at HEAD, so it was in Navbar's module graph
transitively; zero new bytes.** Correctness, regression and multi-tenant lenses swept clean. All three
fixes verified by request against the running server (foreign origin dropped, same-origin logged, the
U+2028 payload rendered inert inside one line).

D (pulled forward at owner QA — "shouldn't this be all workspaces?"): role-summary now ships the
full places list (same resolver as Home's cards); new shared `WorkspacesPill` (ENTER chooser — no ⇄
glyph, host-styled trigger, HUD + warm popover skins) renders on all three pill sites (consumer/coach
top bar SSR'd through the layouts + CoachPortalShell, tournament strip, org-home nav) when 2+ places;
0–1 places keeps the exact old direct pill; popover footer "All workspaces" → Home. Flip still beats
the pill on event pages. The admin-sidebar "All Workspaces" retirement still waits for Stage C.
**/simplify + /review DONE 2026-07-31.** Simplify applied 7 (shared `lib/workspace-labels.ts`
vocabulary; `resolveOperatorDoor` + `WORKSPACES_POPOVER_THRESHOLD` = the one pill-vs-popover rule;
`getPrimaryOrgDestination` rechained through the doors list; single doors pass in role-summary;
`hasSupabaseSessionCookie` helper owns cookie naming in lib/supabase-server; `isOrgHomeRealDestination`
named predicate in lib/module-entitlements (Stage E sitemap must reuse); tournament-layout count
parallelized; HomePersonalization flattened) — skipped 3 (popover-CSS extraction ↔ FlipPill/StartMenu:
cross-module compose+override is order-dependent per the Turbopack gotcha, follow-up candidate;
useClientSignedIn migration: the hook can't express resolved-and-anonymous; adminHref prop/API
removal: derivable from doors but contract churn — drift closed by the rechain instead). Review
(high-risk funnel, 4 lenses) → 4 CONFIRMED + FIXED: (1) High — popover didn't close on Back/Forward
(StartMenu lastPath pattern added); (2) High — Dark-pref warm nav popovers were white-on-white
(`--home-card`/`--home-shadow` added to the ConsumerShell dark-gate — also fixes latent StartMenu);
(3) High — tournament→org-home nav blanked the org nav (nested OrgNavSync cleanup now RESTORES the
ancestor's identity via restore props); (4) Medium — rail crumb now truncates to one line (header
alignment budget). Accepted-as-designed: self-referential Coaches Portal row in the coach shell's
popover (constant-chooser ruling 2026-07-28); count-error → link omitted (fail-quiet). Pre-existing,
ticketed not fixed here: acquisition banner SSR's viewer-conditional HTML into SW-cached pages
(predates diff; behavior preserved); StartMenu→pill flash while role-summary in flight; FlipPill
shares the route-change-close gap. Gate green after all fixes.
A: both anonymous paper-cuts fixed (Home fetch session-gated; tournament layout auth check now
free-plan + auth-cookie gated), `/api/me/workspaces` repointed to the shared context resolver via
new `filterWorkspaceContexts` (old org-only count deleted), multi-hat metric line live in
role-summary. B: admin sidebar wordmark → Home link; conditional org link on event pages (phone
eyebrow + new desktop rail crumb, `module_public_site` OR 2+ active via new
`countActiveTournamentsByOrg`); Overview icon Home→PanelsTopLeft (rail + top tabs); rail
identity-block event-home link retired. Gate: typecheck clean, verify:changed green (0 errors, all
ratchets), dev server restarted + login 200. Next: owner QA → commit (explicit OK) → Stage C.
**Vocabulary (binding, per BUSINESS_DECISIONS 2026-07-31):** "Club" is a tier name only — never use
it generically for a paying org. A Tournament/Tournament-Plus customer is a *tournament
organization*; generic references below say "org".
**Mockups (before/after, all four surfaces):** https://claude.ai/code/artifact/e346068e-8a70-440c-b4a8-b1a8fef50e07
**PM brief:** `NAV_UNIFICATION_PM_BRIEF.md`
**Supersedes:** `NAVIGATION_MODEL_PLAN.md` + `PUBLIC_NAV_FRAME_PLAN.md` (both retained as audit trail — now in docs/projects/archive/;
their FINDINGS doc remains the evidence base). This document is the single execution plan for all
navigation work; do not execute from the superseded docs.

---

## 1. Problem statement (owner's words, 2026-07-31)

Moving between the consumer app (`/discover` and friends), a branded public tournament page, and the
admin shell "feels like jumping from app to app — navigations are in different places and look
different." Logged-out fans must also feel continuity between account/browsing pages and branded
public pages **without removing the branding orgs pay for.**

## 2. The ruling this plan is built on

The 2026-07-31 investigation (19-agent verification sweep + 27-agent adversarial panel) established:
**no unified navigation component survives review** (all five models scored 3.3–4.7/10). Cloning one
nav everywhere either buries fans under operator chrome or sandwiches a paid club's branded page
between two platform bars. The surviving answer has two halves:

1. **A shared navigation grammar** — the same three zones in the same three places on every surface;
   skins stay per-surface (brand precedence untouched).
2. **Finish the existing doors** — every gap is closed by reusing a control that already ships
   somewhere in the product. *One canonical list, many doors, never a duplicate.*

## 3. The grammar (binding design rules once approved)

| Zone | Rule | Concretely |
|---|---|---|
| **1 · Top-left** | Always up-and-out | Wordmark/identity block always exits toward Home/Discover. On branded pages it grows a breadcrumb (`Org › Event`, `Org › Season`) so "up" also works one level at a time. Never decorative, never dead. |
| **2 · Middle / left rail** | The place, in its own brand | Sections of *where you are*: top tabs on the consumer app, a left rail on tournament/club/admin surfaces. This zone wears the org's branding. Geometry constant, skin variable. |
| **3 · Top-right** | Always "who am I here" | Chat · Account · role pill, same corner, same order, everywhere. **⇄ glyph reserved for SIDE** (flipping views of the same place); **plain pill = ENTER** (going to a workspace). One corner, one meaning. |

Supporting vocabulary (from the superseded model, still binding): **ENTER** = Home's workspace list,
the only aggregator; **MOVE** = each place's own section nav/switchers; **SIDE** = the Flip. The
fourth question (*is this place still real?* — stale chrome after revocation) is named, NOT solved
here, and must never be reported as progress.

### The two chrome-growth mechanisms are COMPLEMENTARY, not competing (recorded 2026-08-01)

Reading the geometry cold, it looks like two rival systems for "how does chrome grow when a surface
adds a second fixed row":

- **Org public pages grow the token.** Stage F's section tab row makes `--nav-height` cover *both*
  rows while the bar element itself keeps measuring `--nav-height-base`. Every page already pads by
  `calc(var(--nav-height) + …)`, so the tabs are cleared with no per-page edit.
- **Tournament pages compose a new one.** `--chrome-top-h` / `--chrome-top-static-h` add the live
  nav height, the score ticker and the desktop strip together, because those parts appear and
  disappear independently (the mobile event header collapses on scroll; the ticker only exists on
  game day).

This was investigated as possible drift in the 2026-08-01 top-nav audit and **refuted**: they are one
fallback chain, and the D1 route split keeps them disjoint — an org public page never mounts the
tournament strip or the ticker, and a tournament page never mounts the org section tabs. Growing a
token suits a fixed second row; composing suits parts that come and go. Do not "unify" them; the
merge would make each surface pay for the other's variables.

## 4. Staged plan

Stages A–E ship ungated (defect fixes + symmetry in existing components). F–H each sit behind exactly
one decision or sign-off. Mapping to superseded plans given per stage so nothing is lost.

### Stage A — invisible foundation (absorbs: Nav Model Stage 0 + Q5 paper-cuts)
1. **First, separately committed:** the two anonymous paper-cuts — the ungated consumer-home fetch
   for anonymous visitors, and the tournament layout's per-render auth check for the acquisition
   banner — so the anonymous baseline is clean before any nav diffing.
2. **One shared "which places does this person hold" resolver** (union of admin-org + premium-coach +
   free-coach + official contexts, precedence-sorted, per-request truth). Repoint the operator pill's
   precedence logic and the "All Workspaces" gate at it; delete their separate ad-hoc counts. Fixes a
   real bug alone: today's gate counts org memberships only, so admin@A-who-coaches@B never crosses
   the 2+ threshold.
3. **Instrument the multi-hat number** in the same release: one log line at the existing signed-in
   call site counting hat-cardinality. This single number governs everything expensive (see §6).

### Stage B — wake the dead doors (absorbs: Nav Model Stages 1–2 + Public Frame "ship first")
1. **Admin sidebar wordmark becomes a real link to Home.** Zero visual change.
2. **The organization's name on every event page becomes a real link** — phone: the event header's
   existing inert org-name eyebrow becomes a link; desktop: a small `Org ›` breadcrumb segment in
   the tournament rail identity block. **CONDITIONAL — binding rule:** render only when the org owns
   the public-site module OR has 2+ active tournaments. (Otherwise `/{orgSlug}` is a redirect loop or the
   "hasn't set up their public site yet" platform-branded dead end — worse than the gap.) Keep the
   existing suppression when org and event share a name.
3. **Overview icon swap** — the tournament rail's Overview item stops using the house glyph the app's
   Home uses; house = app Home, platform-wide, one meaning.
4. **Retire the tournament rail logo's redundant event-home link** (breadcrumb covers it). Net chrome
   removal.

### Stage C — the operator frame strip (REV 2, owner-directed 2026-07-31 — replaces the sidebar-footer "You" group)
Owner call at mockup review: instead of tucking doors into the side nav, **mount the app's thin top
strip on the operator shells (desktop ≥1024 only)** so the frame never moves between surfaces and a
multi-org operator always finds "out" and "elsewhere" in the same two corners.
- **Anatomy (constant):** wordmark→Home · [spacer] · bell · chat · account · workspaces pill (pill
  renders only when the person holds 2+ places — see Stage D). **Skin follows the surface** (admin
  dark here; warm on the coach portal in Stage H) — the strip is shared anatomy, never a shared
  color bar.
- **Scope:** the whole admin chrome family (tournament admin, org admin, house league, rep teams,
  accounting). Premium coach portal joins under Stage H's owner gate. Scorekeeper and platform admin
  stay excluded (deliberate).
- **The admin sidebar wordmark retires** — identity lives exactly once, in the strip; the sidebar
  becomes pure place chrome (org name + switcher + sections). This absorbs Stage B.1 (the
  activate-the-dead-logo quick win still ships first as the interim fix if B lands before C).
- **The ⇄ pill stays in the event header** — strip = the frame's doors; the flip belongs to the
  place identity it flips (and is page-matched). Stage G's `/design` pass reviews the two-corner
  rhythm before polish freezes it.
- **Mobile operator shells unchanged** — bottom nav + the More sheet's "You" section already ship;
  verify against current `dev`, do NOT rebuild.
- **Naming watch-out for `/design`:** the strip's chat door (your conversations, app-side) vs the
  admin sidebar's "Chat" section (this event's chat) — same word, two meanings on one screen.
  Recommend icon-only chat door in the strip (matches the public tournament strip), label kept in
  the place nav.

### Stage D — the workspaces pill becomes honest everywhere (absorbs: Nav Model Stage 3 + owner-approved popover 2026-07-31)
1. **Gate fix:** swap the "All Workspaces" input to Stage A's resolver, threshold unchanged (2+).
   One-line change because Stage A made the data correct.
2. **Pill rule (owner-approved at mockup review — reuses the shipped ⇄ Roles-popover pattern):**
   everywhere the operator/workspaces pill appears (consumer strip Zone 3, operator strip Zone 3):
   **one place → direct labeled pill** ("Admin Area" / "Coaches Portal"), exactly today's behavior,
   zero change for single-role users; **2+ places → pill reads "Workspaces ▾"** and opens a compact
   popover listing every place (row = direct door), with an "All workspaces → Home" footer row.
   Rows are fed by Stage A's resolver — never a second count — so the popover can never disagree
   with Home's cards. The admin sidebar-footer "All Workspaces" link retires into it. Accepted
   trade (named by the panel): multi-role users go from one click to a possibly-wrong place to two
   clicks to the right one. This kills the pill defects previously listed in §10 item 3 (silent
   admin-over-coach precedence, first-org bias) at the UI layer.

### Stage E — the org's public page becomes a framed place (absorbs: Nav Model Stage 4 + Public Frame "next/then")
On the shared org navbar (org home + league + teams + archives render through one component, so each
change reaches all four):
1. **One plain-text "Discover" link** at Pricing's visual weight, grouped with the utility links, not
   the identity cluster. The one deliberate anonymous-facing addition in the whole plan (a static
   anchor — nothing fetched). Instrument a fire-and-forget click beacon (see §6).
2. **Return ⇄ FlipPill** on the org's public pages for signed-in operators **of that org** — closes
   the one-way org-level flip. Client-side, post-hydration, per the SW-cache invariant.
3. **Breadcrumb at depth** — `Org › Season`, `Org › Team`, `Org › Archives` in the same identity
   row; the org name self-links to the org root.
4. **Sitemap entry** — gated to orgs where the page actually renders (module or 2+ events).
5. **"Built on FieldLogicHQ" credit rollout** to league/team/archive pages — same ratified-subtle
   gate and component, three more call sites; no new decision.

### Stage F — section strip pilot (absorbs: Public Frame "gate this one") — `/design` GATE
The org-root section strip (Home / League / Teams / Archives), reusing the tournament rail/tab-row
responsive pair; renders only when the org has 2+ sections; inherits the event header's branding rule
(org-branded on tiers that can, platform navy fallback otherwise). **Pilot on the org root only,
Club tier first** (rep teams + archives); League-season depth follows — League Plus is paused, so
design it, don't rush it. This is the only genuinely new engineering in the plan.

### Stage G — grammar polish (NEW in this pass, 2026-07-31) — `/design` GATE
1. **Shared frame geometry tokens**: strip height, pill silhouette/radius, nav type scale — so
   crossing surfaces holds the layout still while the skin changes. Tokens only; zero color
   unification (brand precedence is ratified). **Scope additions from the C+H.1 /simplify pass:**
   the 30px icon-door primitive (now three variants: consumer circle+ring, admin/coach
   squircle+fill ×2) and whether the two per-shell strip-height vars unify into one
   one shared height (RESOLVED 2026-08-01 as `--chrome-bar-h: 48px`, unifying the 48px consumer strip with the 44px operator strips — owner spotted the mismatch crossing surfaces); also the coach shell's missing dark-mode `--home-*` injection point
   (the consumer side's proven single-injection pattern — currently patched by fallbacks in the
   Workspaces popover only).
2. **One pill vocabulary**: ⇄ = SIDE, plain = ENTER, applied to all pill labels (consumer "Admin
   Area" pill stays plain; tournament "⇄ Admin" and admin "⇄ Public site" keep the glyph).
3. **Consistent door order** across strips — RATIFIED 2026-08-01 as already built:
   **wordmark · … · bell (where the hub has one) · account · Workspaces, outermost.** Scope
   increases left to right. ⚠ The previous wording here said "chat before account" and was STALE:
   the chat door was removed from operator strips by binding ruling. The CONSUMER strip keeps its
   chat icon and must not be "fixed" to match — chat is a top-level destination for a fan and a
   section of the work for an operator.

### Stage H — coach portal doors (absorbs: Nav Model Stages 5–6) — OWNER + `/design` GATES

> **⚠ AMENDED 2026-07-31 (owner ruling, logged in `memory/design_decisions.md` — that entry, not the
> mockup, is now the authority on this element): the coach strip carries NO chat door.** It was
> justified as "your own conversations" vs the portal's "team chat", but the portal's Chat is
> **per-user, not per-team** — same membership, same staff + tournament rooms, headed "Your chats".
> Two doors, one room set. The strip's lost because it **ejected the coach into consumer chrome** —
> the trip that already needed a "Back to your Coaches Portal" rescue link at A3 QA.
> **Binding rule for the strip on any shell: only genuine leave-this-place doors (wordmark ·
> account · workspaces). A section of the work is not an exit**, however app-wide its content is.
> Do not re-add the icon from the earlier mockup.
1. **Premium coach exit — UPGRADED (owner direction 2026-07-31): the operator strip in the portal's
   warm skin** (Stage C's anatomy: wordmark→Home · chat · account · workspaces pill), replacing the
   earlier plain-text-"Home"-link idea. **Owner gate first (D2, §7):** the strip carries the
   wordmark, which reverses the ratified no-wordmark ruling outright — owner signalled "there's
   room" at mockup review; one explicit yes ratifies it (log in design_decisions when ruled).
   Desktop first; mobile only after a real-device overflow check (that More sheet already shipped an
   overflow bug). Route strip navigations through the unsaved-changes guard. The contextual ⇄ flip
   (tournament-record pages) is untouched.
2. **Free coach Flip parity** — the hat-count Roles popover premium already has. `/design` gate: it
   introduces a multi-hat operator concept into ratified consumer-family chrome.

## 5. The public line (unchanged from the superseded plan; binding)

An anonymous visitor's page must render, fetch, and weigh the same after this work as before —
zero new identity fetches, zero new role-tied DOM, zero new anonymous-bundle bytes, SW-cached
tournament HTML stays anonymous with identity resolved client-side post-hydration. **Acceptance is a
diff, not an assertion:** capture anonymous network/DOM/bundle on marketing, consumer app, org home,
and a tournament page before and after; identical except the one new anchor (Stage E.1) on qualifying
org pages. The six testable assertions in `NAVIGATION_MODEL_PLAN.md` §Q5 (archived) apply verbatim to every
stage here; any PR that can't go green on them does not ship.

## 6. Evidence gates (carried forward, unchanged)

- **Multi-hat share of signed-in sessions** (Stage A.3): below ~10% → any rail/badge/visible
  cross-hat switcher is **cancelled, not deferred**; above ~20–25% → a visible control becomes
  discussable.
- **Org-home Discover CTR** (Stage E.1 beacon): sustained <1–2% over 4 weeks → one link is the
  permanent answer; materially higher → escalate to a `/design` pass on the fan-door gap.
- **More-sheet capacity audits** (offline, before any coach-mobile work): org-count per admin,
  team-count per coach.
- **Admin tournament switcher URL migration**: gated on SEVERITY not traffic — one confirmed case of
  the shown tournament disagreeing with the Accounting ledger funds it immediately. Separate project.

## 7. Open decisions (owner-facing)

- **D1 — ✅ DECIDED 2026-08-01 (owner, from a two-device mockup): PHONE ONLY.** Org public pages
  take the app's bottom bar ≤900px and NO platform chrome above it at any width. Closes the
  inversion (a free-tier tournament family kept the app throughout; a League/Club family lost it
  leaving Home) without sandwiching a paying club's branded page between two FieldLogicHQ bars —
  the failure every design lens marked full parity down for. The club still owns the top of the
  screen. **Adding the desktop strip later re-opens this decision; it does not extend it.**
- **D2 — ✅ RATIFIED 2026-07-31 (owner):** *"the fieldlogichq branding applies to coaches portal just
  like tournament admin, those surfaces from a product perspective are the same, admin hubs."* The
  no-wordmark ruling is reversed (logged in memory/design_decisions.md); the two-FAMILY chrome split
  itself stands. Stage H.1 built the same day.
- **D3 — ✅ DECIDED 2026-07-31 (owner, logged in BUSINESS_DECISIONS.md):** org-level branding stays a
  **League/Club benefit** — Tournament + Tournament Plus do NOT get it; the platform-preset org page
  is correct-by-design on those tiers, which makes Stage B.2's conditional link rule MORE important,
  not less. Still routed onward: the "hasn't set up their public site yet" empty-state copy (now
  describes a permanent-by-design state on a paying tier → `/marketing`) and the missing org-page
  light/dark setting on League/Club (→ `/design`). Two cheap safe fixes whenever that page is open:
  tint event cards with their own event branding; the Stage E Discover link.

## 8. Explicitly do not do (carried forward)

- No new aggregator, rail, badge, or place-switcher; every new surface queries Stage A's resolver.
- Nothing list-shaped into either capped More sheet.
- Do not rebuild admin mobile's "You" section — verify against current `dev` and leave it.
- Do not migrate the admin tournament switcher off client-state in this pass.
- Do not claim any of this fixes mid-session revocation / stale chrome.
- Do not use Stage B.2 or E.1 to claim the org-home fan gap is "solved" — D1 owns that.
- Fix the `/platform-admin/login?next=` open redirect **independently and now** (security find from
  the investigation; not part of this plan's scope, must not wait on it).

## 9. Verification approach

- Per-stage: `npm run verify:changed` + focused lint; `npm run typecheck` on stages touching shared
  modules (A, C, E). Flip-twins tests extend for any resolver/flip changes.
- Anonymous-parity Playwright diff (network/DOM/bundle/SW-cache) per §5 on every stage touching a
  public surface (B, E, F).
- Owner browser QA per stage (per AGENCY_RULES, browser testing is the owner's).
- Dev-server restart rules apply (new files/shared modules → restart before handoff).

## 10. What this does not solve (honesty list, carried forward)

Mid-session revocation stale chrome; the fan gap beyond one link (D1); unifying the five MOVE
mechanisms; the chat Rooms switcher URL disagreement; the "Coaches" vs "Coach a team" naming
collision (→ `/marketing`); League Plus being paused. (The operator pill's silent-precedence
defects, previously on this list, are now solved by Stage D.2's popover rule.)
