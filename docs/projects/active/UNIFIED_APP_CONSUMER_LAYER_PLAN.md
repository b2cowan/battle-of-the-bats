# Unified App — Consumer Layer ("One Door, Many Rooms")

**Status:** **Phases 0 + 1 BUILT 2026-07-13 (uncommitted on dev, no migration; owner-approved per-phase briefs).** Phases 2–3 READY TO BUILD; Phase 4 additionally requires the PIPEDA/CASL review before build. **All five gates G1–G5 DECIDED 2026-07-11** and logged in `docs/agents/strategy/BUSINESS_DECISIONS.md` (owner ratified: G1 retire per-tournament installs, G2 push stays Plus w/ legible gate, G3 deferral narrowly reopened, G4 chat free / practice+extras Premium, G5 pre-agreed store triggers).
> **Phase 0 built:** unified `public/manifest.json` (`id/scope/start_url = /`); smart entry router in `app/page.tsx` (app-launch only); per-tournament + scorekeeper manifests 308-redirect to `/manifest.json`; layouts repointed; `apple-mobile-web-app-title` unified; `InstallAppPrompt` one identity + one dismissal key across all call sites; `components/LegacyInstallBanner.tsx` added; `sw.js` v3; G1 copy reframe in branding page + `lib/help-content/tournaments.tsx`; `icon-maskable` route kept. **Device coexistence spike still owed (owner, on dev deploy):** `UNIFIED_APP_PHASE0_SPIKE.md`.
> **Phase 1 built:** `/discover` moved into an `app/(consumer)/` route group (URL unchanged) under a shared shell (`components/consumer/ConsumerNav` + `ConsumerShell.module.css`); new `/scores` (live-now + followed-teams strip), `/following` (device follows via new `useAllFollowedTeams`), `/account` (auth entry) tabs; marketing chrome suppressed via `lib/consumer-routes`; `/scores` in sitemap; `/following`+`/account` noindex + `sw.js` denylist. Org/league listings (1b) deferred to Phase 5.
**Created:** 2026-07-11 · from the 2026-07-10 app-strategy investigation (16-agent workflow: codebase recon, market research, 4 candidate architectures, 3-judge adversarial panel).
**PM brief:** `UNIFIED_APP_CONSUMER_LAYER_PM_BRIEF.md` (same folder).
**Journey mockups:** https://claude.ai/code/artifact/c5bb7403-57fe-4b87-ac84-c17382fe60c7
**Supersedes/ratifies:** the 2026-06-28 *Proposed* decision in `docs/agents/strategy/BUSINESS_DECISIONS.md` (one role-routed app, web-first, store-wrap on trigger, directory as front door). This plan is the build-out of that decision, updated for the 2026-07-10 owner input that **there are no paying customers**, so the per-tournament branded-install feature can be retired without a customer-migration problem.

---

## 1. End state (what exists when this is done)

ONE installable FieldLogicHQ app identity serving every role through role-routed entry:

- **Consumer surfaces (broadcast register):** `/discover` directory (logged-out front door), public tournament spaces, league/rep org sites, follows + alerts, family chat.
- **Coach surfaces (mid register):** Basic (org-less `/coaches`) and Premium (`/{orgSlug}/coaches`) portals — unchanged backends, surfaced inside the same shell.
- **Ops surfaces (dark/dense register, unchanged):** `/{orgSlug}/admin`, scorekeeper, check-in, platform-admin. Never inherit consumer chrome.
- **One account, five rungs:** anonymous → fan (follows) → verified family (chat + practice schedules) → coach → org admin. Follow and role are independently composable relationships on one login.

Today's three manifests (platform `/home`, per-tournament, per-org scorekeeper) collapse to one install identity. Per-tournament branded **icons** are retired; per-tournament branded **spaces** (theming inside the app) and the QR/deep-link on-ramp remain the organizer-facing selling feature.

## 2. Decision gates (log via /strategy BEFORE the phase they gate)

| Gate | Decision | Gates | Notes |
|---|---|---|---|
| **G1** | Ratify one-app direction; retire per-tournament install identities (branded icon feature → branded space + QR on-ramp) | Phase 0 | Amends 2026-06-28 Proposed → Decided. Owner stated 2026-07-10 there are no paying customers → no grandfather needed. Reconcile `advanced_tournament_branding` copy in PLAN_PRICING_FACTS + `lib/plan-features.ts` copy (feature keeps theming/appName value, loses "own icon" framing). |
| **G2** | Reconfirm fan push stays Tournament Plus (2026-07-06 "signature halo feature") and that the follow UI makes the gate legible ("alerts not offered by this event") | Phase 2 | No pricing change; UI-legibility commitment. |
| **G3** | Reopen the 2026-06-30 parent/guardian deferral, **narrowed**: verified relationship + team chat + practice-schedule visibility only (RSVP/season-portfolio stay deferred) | Phase 4 | This IS the "dedicated decision" the deferral scheduled. Pulls PIPEDA/CASL review with it. |
| **G4** | Family-gate monetization: (a) practice + full family features ride Premium Coaches Portal, chat basics free (lean), (b) all free, (c) org-purchased "fan pass" | Phase 4 | GameChanger precedent: Team Pass $239–449/season. Log chosen shape as Decided; log fan-pass as Proposed only. |
| **G5** | Pre-agree store-wrap triggers (credibility ask / iOS push complaints / premium-coach daily-use) | Phase 6 | Matches 2026-06-28 "wrap on trigger, not date". |

## 3. IA spec — One door, many rooms

**Entry routing (the "door"):**
- Anonymous → `/discover` (directory = logged-out home; public tournament/org pages remain fully open, no walls).
- Signed-in, zero contexts → **Follows feed** (new). NOT `/start` (operator picker). `/start` remains reachable as "become an organizer" CTA.
- Signed-in, exactly one context → auto-redirect to it (existing `/home` behavior in `app/home/page.tsx` + `lib/user-contexts.ts`).
- Signed-in, multiple contexts → switcher ("Your FieldLogicHQ"): sections **Following / You coach / You manage** (extend the existing `/home` launchpad with the new fan section; consumer-friendly framing).

**Rooms and visual registers:**
- Consumer = broadcast style (existing public visual language). Ops = locked dark/dense doctrine (`memory/design_principles.md`). The boundary is absolute in both directions.
- Focused modes: scorekeeper + check-in stay stripped single-job surfaces, deep-linked, no consumer nav.
- **View toggle:** inside a tournament space, an account holding a coach context for that tournament gets `Fan view ⇄ Coach view` (jumps to check-in/lineup/organizer messages); org admins get an equivalent "Open admin" affordance. This closes the "coach/admin juggles two apps" pain.

**Non-negotiable guardrails (carried from recon):**
- Every new authed route ships with a `public/sw.js` `NEVER_CACHE_PREFIXES`/`PRIVATE_ORG_SECTIONS` entry **in the same change** (a real `/coaches` PII cache leak was already caught once — `memory/project_fp2_alerts_offline.md`).
- `getAuthDestination()` changes must preserve the fail-closed org-context guarantees (J3-012/J4-012 lineage) — the fan branch is org-agnostic and must not weaken org-scoped fallbacks.
- Tournament-only orgs are never routed into `/admin/org/` URLs (standing guardrail).
- Locked architecture unchanged: free `basic_coach_*` vs paid `rep_*`/team_workspaces split (2026-06-19); single-org-by-default for **operator** memberships. Follows/family links are NOT org memberships and cross orgs freely.

## 3b. Per-phase pre-build brief (REQUIRED — blocking)

Before writing ANY code for a phase, the building agent MUST present in-conversation a short product-owner brief covering: (1) what is about to be built in this phase, (2) exactly what changes in the user experience — per persona (fan/parent, coach, admin) — including anything that will look different or break (e.g. Phase 0: existing installed icons go stale and need a reinstall), (3) what will NOT change, and (4) how the owner should test it afterwards. **Wait for the owner's explicit OK before starting the build.** This applies per phase, every phase — it is the AGENCY_RULES "Product Manager UX Plan" requirement made phase-specific for this project.

## 4. Phases

### Phase 0 — Manifest & entry consolidation *(gate: G1; no new features)*
1. One install identity: platform manifest becomes THE app — `id: '/'`, `scope: '/'`, `start_url: '/'` → smart entry router per IA spec (rename from `/home`-anchored identity). Update `public/manifest.json`.
2. Per-tournament manifest route (`app/[orgSlug]/[tournamentSlug]/manifest.webmanifest/route.ts`): stop serving a distinct id/scope. Tournament layout `generateMetadata` points at the unified manifest. **Keep** `icon-maskable/route.tsx` — repurpose the composited branded icon for in-app hero/QR/share surfaces.
3. Merge scorekeeper manifest (`app/[orgSlug]/scorekeeper/manifest.webmanifest/route.ts`) into the unified identity; fix its hardcoded `apple-mobile-web-app-title` drift (says "FieldLogicHQ", manifest name is org-specific).
4. `InstallAppPrompt.tsx`: one identity everywhere; the per-tournament prompt now installs the one app deep-linked into that tournament (preserve engagement-gate/dismissal logic; dismissal keys can unify).
5. Old installs (per-tournament scopes) orphan — acceptable NOW (1 test account, zero paying customers; this is the argument for doing Phase 0 before growth). Add a soft "get the new app" banner rendered only inside legacy-scope standalone sessions if detectable (`?pwa=1` + scope heuristic); do not over-invest.
6. `sw.js` audit pass (no new authed routes expected this phase).
7. **Technical spike (before merging):** verify multi-install coexistence during transition (old tournament-scoped install + new root-scope install on one Android device; iOS A2HS behavior) — link-capture and push-routing sanity.

### Phase 1 — Directory as the front door
1. Promote `/discover` from marketing page to the app's logged-out home: consumer bottom-nav shell (Discover / Scores / Following / Account) wraps the public surfaces.
2. Keep server-rendering + sitemap (SEO is the point). Listing stays opt-in per tournament (`tournaments.list_in_directory`, default off — locked privacy posture).
3. (1b, optional/deferrable) Extend directory listings to orgs/leagues ("find a league near you") — new opt-in flag on organizations; feeds League/Club acquisition.

### Phase 2 — Fan accounts & follows *(gate: G2)*
1. New `fan_follows` table: `user_id`, `entity_type` (`tournament`|`team`|`org`), `entity_id`, `source` (`directory` | `qr` | `device_reconcile` | `registration`), timestamps. Membership-row-as-authorization idiom (mirrors `basic_coach_team_users`). RLS service-role-only like peers.
2. `UserAccessContextKind` gains `fan`; `getUserAccessContexts()` aggregates follows; `getAuthDestination()` zero-context branch → Follows feed (preserve fail-closed guarantees).
3. Follow CTA → deferred-auth sheet (email/password + magic link). No role questions. Browse never requires auth.
4. Device-state reconciliation on signup: localStorage follows (`lib/follow.ts` keys) + anonymous `fan_push_subscriptions` (endpoint match) offered for claim — explicit "add these?" UI, never silent (invite-reconciliation pattern, `lib/invite-reconciliation.ts`). Anonymous path keeps working forever for no-account users (two follow mechanisms coexist deliberately).
5. Push: account-linked follows dispatch through the member pipeline (mig-101 `notifications`/`push_subscriptions`/prefs via `lib/notify.ts`); anonymous fan push (`lib/fan-notify.ts`) remains for device-only follows. Plus gate (`fan_score_alerts`) enforced on BOTH paths; UI shows "alerts not offered by this event" for free-tier events (G2 legibility).
6. Fan alert prefs — **REVISED by owner 2026-07-14 (Slice 3 brief rev 3): score alerts require a signed-in account.** One "Followed teams" card on the unified Account → Notifications page (the Notification Settings project's planned fan card — one build closes both roadmap items), global toggles covering all followed teams + the honest "alerts not offered" line naming free-tier events (G2 legibility satisfied there). Signed out there are NO alert settings anywhere — following/live scores stay account-free; every alerts mention is one line, "Sign in to get score alerts" (opens the Slice 1 sheet). Retires anonymous device-only alert opt-ins (existing usage ≈ 0); account-routed delivery wiring is IN scope for Slice 3. Per-team overrides + "game-day only" explicitly deferred until league-season volume (Phase 5) demands them. See UNIFIED_APP_PHASE2_SLICE3_BRIEF.md.
7. New authed routes (`/following`, account pages) → `sw.js` denylist same-change.

### Phase 3 — One-home connective tissue *(shape SIGNED OFF rev 2, 2026-07-14 — see UNIFIED_APP_PHASE3_BRIEF.md)*
1. Switcher home ("Your FieldLogicHQ"): extend the `/home` launchpad with the Following section (compact rows: team · event · one live/next/recent status chip + "All following" hand-off — owner-ratified depth); stable consumer-friendly entry; single-context auto-skip preserved.
2. `Fan view ⇄ Coach view` — **rev 2 shape: NO persistent strip/banner on tournament pages** (owner direction). A small account chip in the tournament chrome (signed-in visitors only) opens a bottom sheet listing the hats the account owns on THIS event: per-team "Coach view" rows (claimed Basic teams registered here; upgraded teams route to the Premium workspace), "Open admin" for org admins (tournament-scoped staff only on assigned events), a "Scorekeeper" row for officials, plus Following and Your FieldLogicHQ for everyone signed in. Reverse direction: "Fan view" links on the coach portal's tournament entries.
3. Coach portal nav affordance inside the consumer shell (coaches at non-paying tournaments = one home; the org-less `/coaches` hub already aggregates cross-org — this surfaces it): Account-tab row + desktop-header link, coach accounts only; mobile bottom nav stays four tabs.
4. No backend changes to coach/admin worlds.

### Phase 4 — Verified family *(gates: G3 + G4; DO NOT BUILD before both are logged)*
1. `family_links` table: `user_id`, player/roster ref, team scope, `relationship`, `status` (`pending`|`approved`), `approved_by`, caps (max 5 family/player; no self-claim for young age groups — GameChanger safeguarding analog).
2. Two on-ramps, ONE resulting status:
   - **Coach-approved** (tournament teams): request → coach approval queue in their portal; email-match assist reuses the ILIKE claim-discovery pattern (`findUnlinkedEmailMatchedRegistrations` idiom — discovery only, never live authz).
   - **Registration-linked auto-verify** (league/club): registration contact email == account email → auto-approved family (the org already knows the parent; they registered and paid).
3. Unlocks per approved team: practice-schedule visibility (event data already exists in `basic_coach_team_events` + `rep_team_events` — visibility change, not data model) + team-chat membership (chat engine mig 141).
4. Safeguarding defaults (also the marketing pitch vs coaches' WhatsApp groups): team channels visible to all coaches + approved family; **no 1:1 adult–minor DMs**; staff delete-with-visible-notice moderation; SafeSport MAAPP used as directional reference, Canadian (PIPEDA/CASL) review is the binding one — consent capture at request/approval.
5. Packaging per G4 (lean: chat basics free with any coach portal; practice + richer family features ride Premium).
6. All new family/chat routes → `sw.js` denylist same-change.

### Phase 5 — League/Club season layer
1. Org/league spaces inside the app shell (League Plus public-site content); follow an org or division.
2. Registration = account moment: house-league/rep registration flows create/link the parent's account inline; registration-linked family auto-verification from Phase 4 makes day-one-of-season fully lit (schedules, chat).
3. Season-cadence notifications ride the Phase 2 prefs; rain-delay "shift the day" surfaces to followers as schedule-change alerts.

### Phase 6 — Store wrap *(gate: G5 triggers)*
- Android first: Bubblewrap/TWA (~800KB, delegates to existing web push; Play $25 one-time).
- iOS: Capacitor + APNs **only** on push-reliability/credibility trigger (Apple dev $99/yr + Mac build + cert maintenance). Never PWABuilder-iOS.
- ONE listing, aggregator model — Apple 4.2.6's own compliant example ("an event app with separate entries for each client event"); 4.3(a) forecloses per-tournament listings permanently.

## 5. Sequencing & effort shape

Phases 0–1 are small (manifest/routing/IA; no new tables). Phase 2 is the first real build (1 table + resolver/routing + reconciliation + prefs). Phase 3 is IA/navigation. Phase 4 is the largest net-new build and carries compliance work — it must not start on engineering momentum; it starts on G3+G4. Phase 5 mostly composes 2+4 onto existing league/club surfaces. Phase 6 is deliberately last and cheap-ish.

Each phase ships standalone user value; there is no big-bang cutover. Standard workflow rules apply: `npm run verify:changed`, typecheck on shared-module/auth/proxy changes, dictionary + snapshots in the same unit of work as any migration, dev-server restart after shared-module/file-add sessions, `/review` offer per substantive chunk, `/docs` when user-facing flows change (Phases 1–5 all qualify).

## 6. Risks (carried from the adversarial panel)

- **SW cache denylist trap** — recurring, every phase; one prior real PII leak. Checklist item per phase, not a one-time fix.
- **Fail-closed auth routing** — the zero-context fan branch touches a hardened path; review against J3-012/J4-012 expectations.
- **Manifest orphaning** — trivial now, painful later; do Phase 0 before growth. Spike multi-install coexistence first.
- **iOS web push ceiling** — silent subscription invalidation, no background guarantee; set copy expectations ("best on Android / installed app") until an iOS Capacitor wrap; don't let it masquerade as an account-layer bug. (Related live issue: Android prod push VAPID mismatch diagnosis — `memory/project_push_delivery_diagnosis.md` — resolve before Phase 2 leans on push.)
- **Two follow mechanisms coexist forever** (anonymous device + account) — deliberate; reconciliation UX must be explicit, never auto-merge on shared family devices.
- **Governance** — Phases 0 and 4 each require /strategy logging BEFORE build; silent building violates the decision log.

## 7. Success criteria

1. A family with kids in 3 tournaments: **one icon, one login, one follow list**; follows survive device changes.
2. A coach with 2 non-paying tournaments + 1 club team: one home; flips fan/coach view inside a tournament without re-auth or reinstall.
3. A zero-context signup lands on a Follows feed, never the operator picker.
4. A parent reaches team chat + practice schedule only via an approved family link; audit shows no authed HTML in the offline cache.
5. `/discover` is the app's logged-out start; directory SEO unchanged or improved.
6. Free-tier events show a legible "alerts not offered" state; Plus events deliver follow alerts — the gate reads as organizer value, not fan punishment.

## 8. Deferred — scope before project close (not a Phase 0/1 fix)

### Return-to-directory navigation (flagged 2026-07-13, owner testing Phase 0/1)
Once a fan drills into a tournament or team page from `/discover` or `/scores`, there is currently no in-app path back to the directory. The tournament's own nav (News/Schedule/Standings/Teams/Rules) fully replaces the consumer bottom nav on entry — by design, so there are never two nav bars stacked — but nothing in the tournament/team chrome points back to Discover. The only way back today is the browser/device back gesture, which won't be obvious once this is an installed app with no visible browser chrome around it.

**Deliberately not hacked in now** — owner flagged that a fix here touches the navigation of every pre-existing tournament/team page (today the top-bar wordmark always means "this tournament's home"; making it sometimes mean "back to the directory" depending on how the visitor arrived is a real navigation-model decision, not a one-line link). Wants dedicated design thought, not a quick patch riding on top of Phase 0/1 testing feedback.

**Revisit at the end of this project** — natural point is after Phase 3 ("One-home connective tissue," the view-flip + switcher-home navigation work), once the full picture of app-wide navigation (fan/coach/admin, directory ⇄ tournament ⇄ home) is in place and a return-path can be designed holistically rather than per-surface.

**2026-07-14 — owner RATIFIED keeping this deferred at Phase 3 sign-off (brief Q1).** Sequencing: run it as the immediate next design round after Phase 3 ships. Note for that round: Phase 3's signed-in account sheet in the tournament chrome is the obvious candidate home for a signed-in "Browse tournaments" row; the anonymous-visitor answer (wordmark meaning) still needs its own design decision.
