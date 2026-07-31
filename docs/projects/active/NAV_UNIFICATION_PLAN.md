# Navigation Unification — one app, four rooms

**Date:** 2026-07-31 · **Status:** APPROVED — mockups rev 2 owner-approved 2026-07-31 ("looks good,
go ahead"); grammar ratified; Stages A–E cleared to build. D1 still open; D2 signalled-yes, pending
explicit ratification before Stage H.
**Build status:** ✅ **Stages A + B + D COMMITTED dev `453c3df0` 2026-07-31** (owner QA passed;
/simplify + /review funnel complete — see below). ✅ **Stage C BUILT on dev 2026-07-31, uncommitted
— owner QA pending:** new `AdminTopStrip` (fixed 44px, desktop >900px only, z-60) mounted by
AdminChrome on all non-focused admin surfaces — wordmark→Home + bell (hoisted count, moved from the
sidebar) + account + WorkspacesPill (2+ places). **NO chat door (owner ruling 2026-07-31,
generalized from the coach strip): chat is a section of the work, not an exit — a /chat door
duplicated the shell's own Chat and ejected the operator into consumer chrome.** Sidebar opens with the org name (pure place chrome; lockup styles
retired); footer "All Workspaces" retired into the popover; orphaned `/api/me/workspaces` +
`use-has-multiple-workspaces` DELETED. Geometry via `--admin-topstrip-h` on `.adminShell` (44px;
0 on mobile + focused shells): sidebar top/height, event-header sticky top, and the three
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
Shell pads down by `--coach-topstrip-h` (44px; 0 ≤900px). **Mockup-faithful deviations from admin:
NO bell in the strip** (stays in the sidebar header — portal-scoped notifications; mockup shows
none) and **no sidebar edits at all** (CoachesSidebar/BottomNav are mid-edit by a concurrent
session; the portal's "COACHES PORTAL + org name" header already reads as pure place chrome).
Mobile portal untouched (still no Home/Account doors — the Stage H mobile pass stays gated on the
More-sheet overflow check). Gate green; typecheck clean.
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
**Supersedes:** `NAVIGATION_MODEL_PLAN.md` + `PUBLIC_NAV_FRAME_PLAN.md` (both retained as audit trail;
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
   `--operator-strip-h`; also the coach shell's missing dark-mode `--home-*` injection point
   (the consumer side's proven single-injection pattern — currently patched by fallbacks in the
   Workspaces popover only).
2. **One pill vocabulary**: ⇄ = SIDE, plain = ENTER, applied to all pill labels (consumer "Admin
   Area" pill stays plain; tournament "⇄ Admin" and admin "⇄ Public site" keep the glyph).
3. **Consistent door order** across strips: chat before account, role pill outermost, on every
   surface that shows them.

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
org pages. The six testable assertions in `NAVIGATION_MODEL_PLAN.md` §Q5 apply verbatim to every
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

- **D1 — Org public pages: connectivity vs full parity.** This plan ships connectivity (Discover
  link + breadcrumb + sections). Full parity (the app bar/bottom bar on org pages too) closes the
  house-league fan gap completely but wraps a paying org's branded page in platform chrome — a
  packaging call to make in the open. Not blocked on: Stages A–E ship either way.
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
