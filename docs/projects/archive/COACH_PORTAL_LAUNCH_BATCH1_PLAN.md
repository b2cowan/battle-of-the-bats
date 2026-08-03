# Coach Portal Launch Batch 1 — Mobile Overlay Safety + Tournaments Revival — Implementation Plan

> **Status:** ✅ **COMMITTED TO DEV 2026-07-28 — `934e5275` (41 files, owner-approved; foreign-file audit clean; TODO.md rides with the concurrent session's commit).** NOT on prod. Residual: owner phone QA on committed state (fresh restart recommended), /uat probe adoption. Earlier build record follows:
> **(build record)** BUILT ON DEV 2026-07-28 — mockups approved (artifact = binding spec) + D1–D4 ratified; 11-agent build complete (foundation + 10 sweeps, 0 failures); `npm run typecheck` + `npm run verify:changed` GREEN (0 errors; all ratchets/parity/dictionary/org-guard pass); clean dev-server restart done (Ready, login 200, no EACCES). **Remaining:** owner phone QA (checklist below) → commit (per-action OK) ; Playwright overlap probes NOT yet run (residual — candidate for /uat); /review + /simplify offered.
>
> **Build deviations & notes (2026-07-28):**
> - Overlay provider lives in `app/[orgSlug]/coaches/layout.tsx` — the build confirmed `CoachPortalShell.tsx` is the FREE portal's shell, not the premium one. Correct per this plan's 1.7 intent.
> - **Ground-truth correction:** `.daySheetOverlay` already had z-index 400 in the live file (the readiness review's "missed z-bump" claim was stale); the new default-sheet rule explicitly excludes it (`:not(.daySheetOverlay)`) so it keeps its 80vh partial-sheet layout.
> - `useOverlayOpen` is provider-TOLERANT (no-ops without `CoachesOverlayProvider`) because `AwardIconPicker` is also rendered from the admin shared-library page (`app/[orgSlug]/admin/rep-teams/shared-library/page.tsx`) — a throwing hook would have crashed that page. `useAnyOverlayOpen` still throws (single call site inside the provider).
> - **Budget modals' DESKTOP chrome changed slightly** (shared `--card-bg` panel vs the old local charcoal `--budget-panel-bg`; `.modalLg` replaced by inline `maxWidth: 620`) — unavoidable consequence of the ratified CSS migration; flag for owner eyeball.
> - Dues: the empty-state "Set dues schedule" CTA and nested Add-Credit mini-form buttons deliberately stay in the body (not `.modalFooter`) — the footer's bleed math targets the panel's own padding; moving nested buttons would break layout.
> - A `:has()` guard keeps the X-close visible on any sheet-mode modal that lacks a back button (defense for future modals).
> - Help sync landed in the tournaments help group; the plan's cited line ~506-510 "admin-link explanation" did not exist in the live file (stale pointer) — content was placed in the tournaments group (correct home).
> - Sheet default means ANY modal not on the centered opt-out list now renders as a full-height sheet on mobile — including future ones (intended D1 outcome).
> **Created:** 2026-07-28
> **Branch:** dev
> **Source:** `docs/agents/design/PREMIUM_COACH_PORTAL_UX_READINESS_REVIEW.md` — P0 #3 (Tournaments dead end), P0 #4 (mobile Save/Add buttons under the bottom nav), P0 #5 (More menu overflow), plus the bundled P1 items "sort the Tournaments list + in-context help".
> **Plan gating:** Premium Coaches Portal (per-team paid plan / standalone Coaches Portal workspace). No billing-plan changes in this batch.
> **Migrations:** NONE. All changes are UI/CSS/API-read-path only. (Phase 2 reads the existing mig-196 `rep_team_tournament_registrations` bridge — no schema change.)

## Goal

Make every mobile form in the premium coaches portal physically usable (no Save/Add button can ever sit under the fixed bottom nav again — safe **by construction**, not per-modal opt-in), cap the mobile More menu so it can never push rows off-screen, and turn the team Tournaments page from a dead end into an honest, state-aware surface that (a) actually populates for org-created rep teams via the existing admin "Link to rep team" bridge and (b) tells coaches exactly how tournaments reach this page when it's empty.

## PM Brief

**What it does:** Fixes the three worst "the product fights you on a phone" problems before go-to-market: taps aimed at Save can no longer hit the navigation bar instead; the overflow menu can no longer grow taller than the screen; and the Tournaments section now explains itself, shows real tournaments for org-owned teams (today it structurally never can), and lists them in a sensible order with in-context help.

**Why it matters:** These are P0s from the 2026-07-28 UX readiness review — a paying coach losing a tap on Save (silently hitting a nav tab) and a flagship page that renders as an unexplained blank are launch-credibility problems, and the overlay fix hardens the pattern every future form inherits.

**Who benefits:** All premium coaches (head + assistants) on phones; org-created rep-team coaches additionally gain a working Tournaments page for the first time. No plan-gating changes.

**Expected impact:** Every add/edit form on mobile opens as a full-height sheet with the Save button pinned above the home indicator and the nav bar out of the way; the More menu scrolls internally; the Tournaments page shows live/upcoming events first, explains "how do tournaments get here" when empty (different, honest guidance for standalone vs org teams), and carries the same "?" help affordance Tryouts already has.

**Priority:** High — P0 pre-go-to-market; interaction patterns calcify and get copied if not fixed now.

**Success criteria:** Playwright probes confirm zero overlap between any primary form button and the bottom nav across all inventoried modals at 390×844 and 360×667; More menu fits within a 667px-tall viewport with internal scroll; an org rep team with an admin-linked registration sees that tournament in its portal; empty states show the correct variant per linkage state; owner phone pass (iOS safe area + Android keyboard) is clean.

## Ground truth (2-agent investigation, 2026-07-28 — treat as verified)

### Overlay layering
- Bottom nav: `components/coaches/CoachesBottomNav.module.css:16` → `z-index: 300`, `position: fixed`.
- Shared modal overlay: `app/[orgSlug]/coaches/coaches.module.css:1642` → `.modalOverlay` `z-index: 200`.
- The `@media (max-width: 640px)` sheet treatment (`coaches.module.css:2687-2726`): `.modalOverlay.sheetOnMobile, .modalOverlay.slideOverScrim { align-items:stretch; padding:0; z-index:400 }`; panel becomes full-height `100dvh`, side padding 0.9rem, `.modalFooter` re-bleeds + gains `padding-bottom: calc(1rem + env(safe-area-inset-bottom))`; header swaps X-close → back-arrow via CSS visibility (`.modalBackBtn` / `.modalCloseBtn` both rendered in JSX unconditionally). Sticky footer scrolls with the panel's own `overflow-y:auto`.
- `sheetOnMobile` is a **drop-in modifier** already adopted by: schedule Add/Edit Event + slide-over, lineups template picker, `TagManagerModal`, `GiveAwardModal`, `AwardTypeManagerModal`.
- `ConfirmProvider`/`FeedbackModal` confirms render at inline `zIndex:1000` — already safe everywhere.
- Body-scroll-lock is only wired on schedule/page.tsx (`anyModalOpen` effect, lines 712-720) — pre-existing inconsistency.
- ⚠ **Blocker:** `accounting/budget/page.tsx` modals use a **local duplicated** `.modalOverlay` in `budget.module.css:305-327+` (page imports coaches.module.css only as `shared` for buttons). CSS-Modules scoping means any fix landed in coaches.module.css **cannot reach these three modals** — they must be migrated to the shared classes (or the @640 block duplicated locally; migration preferred).

### Modal inventory (the definitive checklist)

**Convert to bottom-sheet (long/medium CRUD forms, coverage risk confirmed):**
| Modal | File | Lines |
|---|---|---|
| Add Expense | `app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/page.tsx` | 600-646 |
| Add Tournament Payable | same file | 649-~715 |
| Player dues detail slide-over (incl. Add Credit / Edit Schedule) | `accounting/dues/page.tsx` | 929-1204 (`ScheduleForm` 1253-1331) |
| Apply dues schedule to all players | same file (reuses `ScheduleForm` — one fix covers both call sites) | 1206-1232 |
| Add/Edit Budget Line | `accounting/budget/page.tsx` | 690-893 (⚠ local CSS module) |
| Generate Player Installments wizard | same file | 922-1030+ (⚠ local CSS module) |
| New Payment Request | `accounting/payment-requests/page.tsx` | 312-435 |
| New Fundraiser | `accounting/fundraisers/page.tsx` | 210-290 |
| Fundraiser Settings | `accounting/fundraisers/[fundraiserId]/page.tsx` | 391-472 |
| Add Player | `roster/page.tsx` | 579-696 |

**Keep centered, but must sit above the nav (opt-out modifier; z400 via the default flip):** Delete Budget Line confirm (budget/page.tsx:896-919, ⚠ local CSS), Recategorize Expense (budget-vs-actual/page.tsx:676-716), Upload Team Template (documents/page.tsx:213-290), per-player Upload Document (`PlayerDocumentsSection.tsx:181-243`), Manage test types (`PlayerDevelopmentSection.tsx:893-912`), Start next season (`StartNextSeasonModal.tsx:76-127`), AwardIconPicker (`AwardIconPicker.tsx:29-75`, defense-in-depth).

**Already a sheet but missed the z-bump (live bug):** month-view day-list sheet — `.daySheetOverlay` (`schedule/page.tsx:1752`; CSS `coaches.module.css:2623-2630`) lays out as a bottom sheet but was never added to the z400 selector, so the nav renders on top of it.

**Already fine (no action):** schedule Add/Edit Event, event detail slide-over, lineups template picker, TagManagerModal, GiveAwardModal, AwardTypeManagerModal, all ConfirmProvider/FeedbackModal confirms. (`RosterEditor`/`FeeEditor`/`ScheduleEditor` components are free-portal only — out of scope.)

### More menu
- `components/coaches/CoachesBottomNav.module.css:94-105` `.dropdown`: `position:absolute; bottom:calc(100% + 0.75rem)`, **no max-height, no overflow-y** (`overflow:hidden` is corner clipping only). Worst case ~500-700px of rows grows past the top of short viewports; fixed-position ancestry means the clipped rows (team switcher, Squad — the FIRST items) are unreachable and invisible, no scrollbar cue.
- Minimal fix: `max-height: min(70vh, calc(100dvh - 5.5rem - env(safe-area-inset-bottom, 0px))); overflow-y:auto; overscroll-behavior:contain;` — verify rounded corners still clip scrolled content (modern browsers respect border-radius with overflow-y:auto; if not, wrap).

### Tournaments data reality (why the page is a dead end)
- **Public registration is the ONLY entry point** (`POST /api/register`, app/api/register/route.ts:357-372). No in-portal browse-and-register flow exists anywhere.
- Signed-in email match links every claim to the **free/basic system** (`linkTournamentRegistrationToBasicCoachTeam`, lib/basic-coach-teams.ts:561, 629-636) — never directly to a premium team.
- The premium page's API (`app/api/coaches/[orgSlug]/teams/[teamId]/tournament-history/route.ts:32-42`) resolves **only** via `team_workspaces.basic_coach_team_id` — set once at provisioning, and only when the standalone purchase upgraded from a free team with a claimed registration (`lib/team-workspace-provisioning.ts:256-258, 337-346`; lazy self-heal in `resolveBasicCoachTeamIdForWorkspace`, lib/basic-coach-teams.ts:1281-1302).
- **Org-created League/Club rep teams have NO `team_workspaces` row** (only `provisionStandaloneTeamWorkspace` ever inserts one) → the API short-circuits to `{ history: [], basicCoachTeamId: null }` **unconditionally**. The mig-196 `rep_team_tournament_registrations` bridge (written by the admin Registrations page "Link to rep team" control) is **never read** by this page/API — it currently only feeds public-page viewer recognition (The Flip).
- The API **already returns `basicCoachTeamId`** (route.ts:52); the page discards it (page.tsx:45-46) — so "never linked" vs "linked, zero tournaments" is distinguishable with zero new backend for the standalone case.
- Sort: `getBasicCoachTournamentHistoryForTeam` returns registration-time order (lib/basic-coach-teams.ts:995); premium page applies no sort (page.tsx:81). Free account hub already has the lifecycle-aware sort to mirror (`app/coaches/tournaments/page.tsx:154-161`; premium page already imports `deriveCoachLifecycleChip`).
- Nav-signal lag: `hasTournamentHistory` (lib/db.ts:3831-3884) reads `team_workspaces.basic_coach_team_id` directly, NOT the self-healing resolver — Tournaments stays demoted in "Explore" until the coach happens to visit the page once.
- Reuse for the redesign: `CoachEmptyState` (full-card variant — coach CAN act; lime primary + ghost secondary only; rounded-square medallion; lime accent never org color), `CoachRegistrationCard` (rows — used by both free surfaces; premium page hand-rolls its own today), `HelpButton` (Tryouts pattern, `tryouts/page.tsx:76-80`; tournaments help sections already exist in `lib/help-content/coaches.tsx` ~348+, incl. `faq-premium-tournaments-where` at 386-392), `PanelIntro` one-liner pattern (tryouts/page.tsx:15-22).
- `/discover` (public tournament directory) is **LIVE ON PROD since 2026-07-22** (status trued up 2026-07-28 — its plan/brief headers had gone stale at "Planning"): SSR + SEO, tournament-keyed, sitemap, Event Settings toggle, listing **opt-out by default** (mig 197). Cleared by owner 2026-07-28 as a legitimate CTA target.
- `link-org` is org-affiliation only — must NOT be used as a tournament CTA (would mislead).

## Phases

### Phase 1 — Mobile overlay safety (P0 #4 + #5) — ✅ BUILT 2026-07-28 (1.1–1.8 done; 1.9 Playwright probes NOT run — residual)

- [ ] 1.1 **Flip the polarity** in `app/[orgSlug]/coaches/coaches.module.css`: inside the existing `@media (max-width: 640px)` block, make the current `.sheetOnMobile` mechanics (z-index 400, full-height panel, back-arrow header, footer safe-area padding) the **default** behavior of `.modalOverlay`/`.modal`/`.modalFooter`. Add a new opt-out modifier `.centeredOnMobile` (keeps the small centered dialog look but still `z-index: 400`). Keep `.sheetOnMobile`/`.slideOverScrim` as no-op aliases so existing adopters don't churn. **Desktop rules untouched — zero desktop diff.**
- [ ] 1.2 **Sweep the sheet conversions** (each: overlay div gets default sheet behavior automatically after 1.1; ensure header renders both `.modalBackBtn` + `.modalCloseBtn`, primary actions live inside `.modalFooter`): Add Expense, Add Tournament Payable (`expenses/page.tsx`), dues `ScheduleForm` wrapper — one fix, two call sites (`dues/page.tsx`), New Payment Request (`payment-requests/page.tsx`), New Fundraiser (`fundraisers/page.tsx`), Fundraiser Settings (`fundraisers/[fundraiserId]/page.tsx`), Add Player (`roster/page.tsx:579-696`).
- [ ] 1.3 **Budget page CSS migration** (the blocker the default flip cannot reach): migrate the three modals in `accounting/budget/page.tsx` (Add/Edit Line 690-893, Delete confirm 896-919, Generate Installments 922-1030+) off the local `budget.module.css` modal classes onto the shared `coaches.module.css` `.modalOverlay`/`.modal`/`.modalFooter` (already imported as `shared`); delete the duplicated modal CSS block (`budget.module.css:305-327+`). Delete-confirm gets `.centeredOnMobile`.
- [ ] 1.4 **Apply `.centeredOnMobile`** to the short dialogs that should stay centered: Recategorize Expense, Upload Team Template, per-player Upload Document, Manage test types, Start next season, AwardIconPicker.
- [ ] 1.5 **Fix the missed day-sheet z-bump**: `.daySheetOverlay` joins the 400 layer (covered by the 1.1 default; verify explicitly since it has bespoke sheet CSS at `coaches.module.css:2623-2630`).
- [ ] 1.6 **More menu cap** (`components/coaches/CoachesBottomNav.module.css:94-105`): add `max-height: min(70vh, calc(100dvh - 5.5rem - env(safe-area-inset-bottom, 0px)))`, `overflow-y: auto`, `overscroll-behavior: contain`; visual check that border-radius still clips scrolled content (wrap if not).
- [ ] 1.7 **Safety net — hide the nav under any overlay** (recommended; Decision D3): new `CoachesOverlayContext` provided in the coaches layout; modal-owning pages/components toggle it via a small `useOverlayOpen(open)` hook effect; `CoachesBottomNav` applies `visibility: hidden` (not `display:none` — no layout shift) while any overlay is open. Wire it into the pages touched in 1.2/1.3 + the existing sheet adopters.
- [ ] 1.8 **Body-scroll-lock consistency**: extend schedule's `anyModalOpen` body-overflow lock to the pages gaining sheets (fold into the `useOverlayOpen` hook from 1.7 so lock + nav-hide travel together — one hook, both behaviors).
- [ ] 1.9 **Playwright verification** (per `memory/feedback_verify_with_playwright_not_screenshots.md` — computed styles, not screenshots): for every "yes-confirmed"/"likely" modal in the inventory, open it at 390×844 and 360×667 and assert the primary action button's bounding box does not intersect the bottom nav's (or that the nav is hidden); assert the More menu's rendered height ≤ viewport and its first row is at y ≥ 0 with a full-capability coach + multi-team switcher.

### Phase 2 — Tournaments page revival (P0 #3 + bundled P1 sort/help) — ✅ BUILT 2026-07-28 (2.1–2.7 all done)

- [ ] 2.1 **API — read the mig-196 bridge** (Decision D2, recommended Option B): in `app/api/coaches/[orgSlug]/teams/[teamId]/tournament-history/route.ts`, when the workspace bridge yields nothing (or in addition to it, deduped by registration id), also consult `rep_team_tournament_registrations` for this rep team (via `lib/rep-team-tournament-links.ts`) and build the same history-entry shape for those registrations. Keep the existing money-redaction gate applied to all entries. Return a `linkage` field: `'workspace' | 'admin-link' | 'none'` alongside the existing `basicCoachTeamId`.
- [ ] 2.2 **Page — state-aware empty states** (`tournaments/page.tsx`): stop discarding the linkage data; render per mockup:
  - **State A — standalone team, never bridged** (`basicCoachTeamId: null`, workspace team): full `CoachEmptyState` — explains that registering on any organization's public tournament page **with this account's email** makes the tournament appear here automatically; secondary CTA → in-context help; optional tertiary → `/discover` (Decision D4).
  - **State B — org-owned rep team, no linked registrations** (`linkage: 'none'`, no workspace): honest copy that tournament entries appear when the team is registered and the org admin links the registration to this team; CTA → help section explaining the admin link; no false self-serve promises.
  - **State C — bridged, zero entries** (`basicCoachTeamId` present, empty history): light "no tournaments yet this season" + same how-it-works help affordance.
- [ ] 2.3 **Sort**: lifecycle-aware client sort — live/game-day first, then upcoming (soonest first), then past — mirroring `app/coaches/tournaments/page.tsx:154-161` using the already-imported `deriveCoachLifecycleChip`; placed before the `.map()` at `page.tsx:81`. Scoped to this page (do not touch `lib/basic-coach-teams.ts:995` — two other callers).
- [ ] 2.4 **Adopt `CoachRegistrationCard`** for populated rows (replace the hand-rolled `tournamentHistoryEntry` markup, page.tsx:95-119) for visual parity with the two free surfaces; keep `FanViewLink` behavior.
- [ ] 2.5 **Help affordances**: `HelpButton` in the page header (Tryouts pattern) pointing at the existing tournaments help sections (`faq-premium-tournaments-where` + recipe group); one `PanelIntro`-style sentence above the list when populated.
- [ ] 2.6 **Nav-signal fix**: make `hasTournamentHistory` (lib/db.ts:3831-3884) reflect reality without requiring a page visit — route it through `resolveBasicCoachTeamIdForWorkspace` (self-heal) **and** count admin-linked registrations when D2/Option B lands, so Tournaments graduates out of "Explore" as soon as data exists.
- [ ] 2.7 **Help-content sync** (`/docs`): update `lib/help-content/coaches.tsx` tournament entries to match the new empty states + admin-link path (State B is a new user-facing explanation).

### Phase 3 — Verification + handoff

- [x] `npm run typecheck` + `npm run verify:changed` — GREEN 2026-07-28 (0 errors, 182 pre-existing `any` warnings; all ratchets/parity/dictionary/org-guard/observability pass).
- [x] Playwright probes — **RUN 2026-07-28** (owner screenshot follow-up): disposable coach + org rep team provisioned via service-role (rep_teams + rep_program_years + rep_team_coaches + **organization_members role='coach'** — the layout's getAuthContext requires the membership row; assignment alone bounces to /discover via the login-destination chain). Computed-style probes at 390×844 AND 620×806: Add Player sheet (full-screen, z-400, radius 0, nav hidden, body locked), Add Expense (modalScrollBody pattern, footer at viewport bottom), Documents upload (centeredOnMobile, centered card, z-400) — ALL CONFIRMED to spec. Probe spec deleted after use (it self-provisions DB rows; teardown verified clean). **Fix found via probe:** short-content sheets left the action bar mid-screen (sticky sits at flow position) — added flex-column + `margin-top:auto` on `.modalFooter` inside the @640 sheet rules (coaches.module.css), re-probed all three types green. Owner's misaligned screenshot could NOT be reproduced from current code at any viewport — attributed to a stale tab open across the mid-session server restart (hard refresh resolves).
- [x] **Second owner report (Edge InPrivate, responsive 361×611, their workspace team) — probed 2026-07-28 in REAL Edge (msedge channel) + Chromium on the owner's own team** (disposable probe coach added + removed; teardown verified): sheet geometry + full CSS-rule audit CONFIRMED correct in both browsers — every @640 rule parsed and applied; labels are 11.52px (smaller than input text). Root cause of the owner's actual complaint = the rigid two-column `.formGrid` at phone width (long uppercase labels wrap → adjacent inputs stagger → reads as "misaligned" + "labels too big"). **Fix: P1 "one-column reflow on phones" PULLED INTO Batch 1** — `.formGrid` goes single-column ≤640px (coaches.module.css, all portal forms using it). Re-probed on the owner's team: full-width aligned boxes, no label wrap, sticky footer pinned. The full-screen-sheet-not-applying render in both owner screenshots remains unreproducible fresh → stale-tab state; owner should retest in a NEW InPrivate window. (Owner's next screenshot confirmed a fresh window renders correctly.)
- [x] **Sticky-footer 24px content cutoff FOUND (owner QA) + FIXED 2026-07-28:** at max scroll the sheet's last field (Notes) sat 24px under the Save bar — probe-confirmed at 390/540/361 (overlapPx 24 everywhere). Cause: the desktop footer's -1.5rem bottom bleed shortens the scroll extent under a sticky footer. Fix in the @640 sheet rules: footers (`modalFooter`/`attendanceFooter`/`editScope`) get `margin-bottom: 0`; panels **with** a footer drop their own bottom padding via `:has()` (footer stays flush + safe-area padded); footer-less sheets keep their padding. Re-probed: overlap 0 at all three viewports, footer flush with the screen edge. Applies to every sheet-mode modal incl. the schedule slide-over's attendance footer (same latent bug, same fix).
- [x] **Roster initials avatars REMOVED (owner call 2026-07-28, during QA):** the per-player colored initials circle on roster rows (desktop + mobile card) deleted — name-hash color encoded nothing, ate card width, and was the portal's only circular monogram (violated the 2026-06-03 never-circles rule). Single call site verified; `.avatar` CSS deleted; roster page no longer imports `lib/teamBadge` (B29 cleanup note: teamBadge is now public-only). Logged as a binding entry in `memory/design_decisions.md` (2026-07-28).
- [x] Dev server stop → `.next` purge → restart 2026-07-28 — Ready, login 200, no Supabase EACCES.
- [ ] Owner device pass (the parts code review can't cover): iOS home-indicator clearance on the sheet footer, Android keyboard vs sticky footer on a full-height sheet (known `100dvh` variance), warm + dark themes, org-linked and standalone teams, budget modals' new desktop chrome.
- [x] **`/simplify` DONE 2026-07-28** (owner-requested): 4 cleanup lenses → 10 findings applied via 6-agent workflow — `isTeamWorkspaceOrg` reuse (7th inline copy removed), shared `sortByCoachLifecycle` in lib/coach-tournament-lifecycle.ts (premium + free hub both migrated, decorate-once + useMemo), `CoachModalHeader` extracted + swept 13 sites incl. the 4 stragglers (TagManager/GiveAward/AwardTypeManager/lineups picker gain their missing back buttons; dues slide-over + schedule detail slide-over deliberately left inline — identity headers), overlay context split (stable actions / volatile count), `useOverlayOpen` back to fail-fast + tolerant `useOverlayOpenIfAvailable` for AwardIconPicker, tournament-history route merge moved into lib (`getMergedTournamentHistoryForRepTeam`) + Promise.all, `getCoachingNavSignals` 4→2 query rounds, close-btn CSS pair → one positive `:has()` rule, 5 dead `.tournamentHistory*` blocks deleted, vestigial `.playerCell` gap removed, PlayerDevelopmentSection condition hoisted. Skipped (noted): PanelIntro hoisting (no 3rd consumer), narrow both-bridges double-batch edge.
- [x] **`/review` DONE 2026-07-28** (high-risk tier, 4 lenses, deterministic gate green): **4 confirmed findings, ALL FIXED** — (1) HIGH: overlay provider's body-scroll-lock had no unmount cleanup → leaving the portal via sidebar "Back to admin"/Logout with a sheet open froze scrolling app-wide until hard reload (cleanup added, lib/coaches-overlay.tsx); (2) MED: `sortByCoachLifecycle` sorted the Complete bucket oldest-first in the premium flat list (now most-recent-first for `complete` rank; free hub unaffected — it pre-filters to active); (3) MED: confirm/feedback dialogs never registered with the overlay signal despite the layout comment claiming coverage (FeedbackModal now calls the tolerant hook — no-ops outside the portal); (4) MED-latent: the `:has()` close-hide rule lacked the `:not(.centeredOnMobile)` guard its siblings have (guard added + CoachModalHeader doc warns against centered pairing). Security + blast-radius lenses: ZERO defects (auth chain, org scoping, money redaction, all 24 hook call sites, all 13 header sites, all deleted-class consumers, all 9 formGrid forms verified). Advisories recorded, no action: budget modals' desktop border now blue-tinted (shared chrome — owner eyeball), read-side bridge org-invariant relies on write-time guards (hardening idea), flex-column margin-collapse spot-check on stacked-sibling modals, pre-existing fetch-without-abort on tournaments page. Post-fix gate: typecheck 0 errors, focused lint clean.
- [ ] Owner phone QA of the final state + coordinated dev-server restart (shared modules `FeedbackModal`/`lib/*` changed post-restart; the currently-running server belongs to the concurrent session) → commit (per-action OK).

## Architectural Decisions (proposed — ratify before build)

- **Decision:** Sheet-on-mobile becomes the **default** for portal modals at ≤640px with an explicit `.centeredOnMobile` opt-out; every layer inside the mobile media query sits above the bottom nav. **Rationale:** today's polarity (opt-in safety) is exactly how 17 modals shipped unsafe; inverting it makes every future modal safe by construction. Desktop is untouched.
- **Decision:** The tournament-history API becomes the **single source for "what tournaments does this team have"** by also reading the admin-link bridge, and the nav signal derives from it. **Rationale:** the admin "Link to rep team" control already exists and writes this data; reading it here makes the org-admin workflow actually deliver value to the coach who was promised it, with no new schema.
- **Decision:** One shared `useOverlayOpen` hook carries nav-hide + body-scroll-lock together. **Rationale:** both behaviors have the same lifecycle; two separate opt-ins would recreate the drift this batch is fixing.

## Open Questions — ALL RATIFIED 2026-07-28 (owner, at the recommendations)

- [x] **D1 — Polarity flip: APPROVED.** Sheet default + `.centeredOnMobile` opt-out; every mobile modal layer sits above the bottom nav.
- [x] **D2 — Tournaments Option B: APPROVED.** API also reads the mig-196 admin-link bridge so org rep teams populate; nav signal follows.
- [x] **D3 — Nav-hide safety net: APPROVED** for this batch (one shared `useOverlayOpen` hook = nav-hide + body-scroll-lock).
- [x] **D4 — `/discover` secondary CTA: APPROVED.** Ship "Browse public tournaments" as the ghost secondary on State A. Dependency resolved 2026-07-28: directory confirmed LIVE on prod (stale "Planning" headers trued up); /strategy log entry records the coach-portal → directory funnel decision.

## Mockups

Visual spec artifact (owner approval = binding per `memory/feedback_build_to_approved_mockups.md`; elements labeled NEW / RESTYLED / UNCHANGED): **Coach Portal Batch 1 — Mockups** (link recorded in the PM brief + conversation).

## Out of scope (stays in the readiness review's P0 list, later batches)

Season-end lockout (P0 #1), tournament-game attendance/lineups (P0 #2), onboarding checklist coverage (P0 #6), roster bulk-add (P0 #7), progressive-disclosure form redesign (P0 #8). The P1 "Attendance nav home", "notification bell on mobile", and unsaved-changes-guard items are NOT in this batch.
