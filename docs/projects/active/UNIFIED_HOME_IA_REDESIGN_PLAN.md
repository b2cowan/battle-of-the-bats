# Unified Home IA Redesign — GameChanger-Style Front Door

**Status:** IN MOCKUPS — direction + 6 decisions ratified 2026-07-18; **Round 1 (Home) DECIDED 2026-07-18**: R1-4 = WARM-LIGHT consumer-shell theme (consumer app only — logged to design_decisions.md), R1-2 = tap lands on tournament home, R1-3 = composition approved, R1-1 superseded by the theme; artifact rev 4 (`de1c87a1`) is the binding Home spec. All-following sub-page: back link "← Home" with the "All following · N" title right-aligned on the same row. Browse section (incl. filter pills) identical in every auth state. **Round 2 (Scores) DECIDED 2026-07-18** (artifact `63ec5baa` rev 4 binding): two-lane composition; event cards never expand into game lists; My Events = 2-col grid capped at 2 rows, "+N more" expands in place, timeline sort with completed-last dimmed + one-week grace then All following → Past events; logged to design_decisions.md. **Round 3 (Chat) DECIDED 2026-07-18** (artifact `a8622786` binding): inbox composition, safety sheet same-release, consumer rooms render warm. **PHASE M COMPLETE — Account tab folds into the build spec (no Round 4, owner-accepted). Next: build Phase 0+1.**
**Owner decisions ratified:** 2026-07-18 (see §2)
**Parent program:** Unified App — Consumer Layer (docs/projects/active/UNIFIED_APP_CONSUMER_LAYER_PLAN.md). This plan is the "next design round" that program deferred (§8 return-to-directory), expanded into a full IA restructure.
**PM brief:** UNIFIED_HOME_IA_REDESIGN_PM_BRIEF.md
**Analysis provenance:** 12-agent workflow 2026-07-18 (6 code readers → 5 designers → adversarial critic). Key verdicts folded in below; risk register in §10.

---

## 1. Vision (owner, 2026-07-18)

Model the consumer app on GameChanger's home screen, adapted to FieldLogicHQ's data model:

1. **Home** = single front door: search (Tournaments / Teams / Organizations) + cards for everything the account follows or belongs to. Absorbs Discover's search, the Following tab, and the `/home` workspace launchpad.
2. **Scores** stays: aggregates across ALL followed/member items, concise at scale.
3. **Chat** joins the bottom nav, visible to everyone (logged-out included) so the nav never changes shape and the product's social layer is visible pre-signup.
4. **Account** stays but drops the workspaces list (now on Home).

### 1a. Two-tier follow model (owner refinement, 2026-07-18 — load-bearing)

- **Following a team IN a tournament** (what exists today) is a **tournament-scoped** relationship: it governs how the user experiences that tournament's pages (highlighted scores, my-team card, dock) and what notifications they get. On Home it does **not** get a standalone team card — it presents **under the Tournaments section as a tournament card** with the followed team as the context line. Tapping in lands on that tournament with the user's team front and center.
- **Following a Team** (future) is a **persistent** relationship with a durable team entity — schedules and scores across events, and eventually parent chat. It ships as its own future phase, **gated on the Phase 4 PIPEDA/CASL compliance review** for anything chat/family-facing. *(Plan recommendation, pending owner confirmation: build this on the existing rep-team structure — the persistent, year-round team entity already built for the coaches side, which already has cross-season continuity — rather than inventing a new entity.)*

This split resolves two of the analysis's hardest findings by product definition: (a) no season-continuity entity is needed for v1 (tournament entries are ephemeral by design); (b) no canonical cross-tournament team URL is needed for v1 (tournament-follow cards land on tournament pages, which exist).

## 2. Ratified decisions (owner, 2026-07-18)

| # | Decision | Call |
|---|---|---|
| 1 | Tab labels | **Scores** and **Chat** (not GameChanger's Events/Messages — "Messages" implies DMs we don't have; DMs remain compliance-gated) |
| 2 | v1 follow scope | **Team-in-tournament follows only** (existing), presented tournament-first per §1a. Whole-tournament + org follow = fast-follow phase. Persistent Team follow = future gated phase |
| 3 | Sign-in fast-path | **Keep**: solo-workspace users still land straight in their workspace at sign-in. Tapping the Home tab never auto-redirects |
| 4 | Logged-out Chat | **Static preview only** (fictional sample thread + value pitch). Never real messages; member-only read stays enforced at the DB layer |
| 5 | Search noun | **"Organization"**, not "League" (collides with the League plan tier). Quick /marketing confirmation optional |
| 6 | Report-a-message | Ships **in the same release** as the Chat tab |

Also ratified implicitly: Home grouping is relationship-first (Workspaces vs Following), not season-grouped (no season entity exists); Following subsections organize by entity type (Tournaments now; Teams + Organizations later).

## 3. Target IA

### 3a. Nav (mobile bottom tabs = desktop top links, one shared TABS array)

| Tab | Route | Icon (lucide) | Replaces |
|---|---|---|---|
| Home | `/discover` (URL unchanged — see §3b) | `Home` | Discover (Compass) + Following (Star) + `/home` launchpad |
| Scores | `/scores` | `Radio` | — (restructured) |
| Chat | `/chat` (new) | `MessageCircle` | — (new) |
| Account | `/account` | `User` | — (trimmed) |

Nav shape is identical signed-in vs signed-out (owner constraint). Desktop `.topUtil`: remove "Your workspaces"; keep "Run a tournament", coach pill, "Sign in".

### 3b. URL + redirect architecture (critic-adjudicated: HOME doc position wins)

- **`/discover` stays the canonical URL** behind the Home tab. It is the SEO-bearing, sitemap-fed, `force-dynamic` public directory; moving it breaks backlinks/crawl history for zero UX benefit. Only the label/icon changes.
- **`/home` → permanent redirect to `/discover`.** All existing `next=/home` references keep working. `?pick=1` / `forcePicker` retired (dead once the picker is dead). The zero-context `redirect('/discover')` becomes a self-redirect — delete, render Home's empty state in place.
- **`/following` survives** as the "All following" overflow page (linked from Home's Following section header), `noindex` unchanged.
- **SW-cache posture (BINDING):** the `/discover` SSR shell stays 100% anon-safe — no server-side branching on user identity in the page. All personalization (Workspaces, Following, pending invites) is **client-fetched** from a new `/api/consumer/home` endpoint (SW's blanket `/api/` no-cache covers it). This reuses the exact fix pattern from the FP-2 viewer-identity incident. No new authed top-level route is created for Home ⇒ no new denylist entry needed for it. `/chat` IS a new top-level route ⇒ **must** be added to `NEVER_CACHE_PREFIXES` + `CACHE_VERSION` bump.
- **Redirect aliases are permanent**, not transitional — already-sent emails/push deep links to `/discover`/`/following`/`/home` must never 404. Before build: full grep inventory of hardcoded `next=` params + email/push templates pointing at these routes; update internal links in the same change.
- Check `public/manifest.json` for `start_url`/`shortcuts` referencing changed routes before renaming anything (installed-PWA shortcuts don't hot-update).

### 3c. Home page composition (top → bottom)

1. **Search bar** — "Find a Tournament, Team, or Organization". Always visible; results replace the sections below in place while a query is active (existing DiscoverClient pattern). Sticky behavior must be tap-triggered only, never scroll-triggered (binding guardrail).
2. **Pending invitations** (signed-in, if any) — PendingInvitationsCard verbatim, above everything.
3. **Workspaces** — one card per non-fan access context (org admin / official / coach), current sortOrder preserved. Role chip = existing badgeLabel taxonomy (Owner/Admin/Staff/League Admin/Registrar/Treasurer/Official/Coach — full fidelity, no compression). Destinations reuse `UserAccessContext.destination` / `getDestinationForMembership` **verbatim** (preserves the Tournament-tier vs org-admin separation rule).
4. **Following — Tournaments** (per §1a) — one card per tournament where the account follows a team (or, in the fast-follow phase, the tournament itself). Card: tournament logo + name, "Following" chip (binding ink-on-lime pillOn convention), context line = "Your team: {team} · {live score | next game | last result}" via the existing follow-feed status; event date/stage pill. Multiple followed teams in one tournament → one card listing both. **Tap destination DECIDED (R1-2, 2026-07-18): the tournament HOME page** — it already leads with the followed-team card and pins the score dock; the warm-app→branded-event theme handoff is deliberate. Completed tournaments collapse into a "Past" group. Section scaffolding built so **Teams** and **Organizations** subsections slot in later without re-architecture.
5. **Browse** — the existing Discover grid (sport/province/timeframe filters, grid/list toggle) always renders beneath, keeping the SEO/acquisition funnel alive. Signed-out visitors see search + (device-local follows if any) + browse — effectively today's Discover with a relabeled tab.

**Dedupe rule:** an entity reachable via both an access context and a fan follow renders ONCE; role chip wins over "Following". Key = (entityType, entityId) with the team→tournament rollup applied first. **Caveat:** this key only works for context kinds that carry real entity IDs (`tournament_official`, `organization`, `coaches_premium`). `coaches_basic` contexts currently carry constant synthetic IDs (`"coaches-basic:teams"` / `"coaches-basic:tournament-records"`), which can never match a real tournament ID — Phase 1 must normalize basic-coach contexts down to resolved team/tournament IDs before dedupe can cover them. Named follow-up, not optional.

**Empty states:** signed-in with nothing → search + browse + one quiet line ("Nothing here yet — follow a team or tournament to see it here"). Sections with no content are omitted, never rendered empty. Lapsed-subscription workspace contexts get an explicit degraded "reactivate" card instead of silently vanishing (today they disappear from the context list — unacceptable on the primary front door).

**No family-member row** — omit entirely (no dead slot). Gated on Phase 4 PIPEDA/CASL clearance; revisit with the Teams phase.

### 3d. Search backend

| Entity | Today | Plan |
|---|---|---|
| Tournament | built (`getDirectoryListings`, `list_in_directory` opt-in) | reuse as-is |
| Organization | only as a secondary match field on tournament rows | new `searchOrgsForDirectory()`. **Reuses the existing `organizations.is_discoverable` flag** (opt-out, default true, already prod-live; ANDed with `is_public` + not-canceled + not a team-workspace shadow org so a match always resolves to a live `/{orgSlug}`). **Build-time reconciliation (2026-07-18, owner-settled):** the plan originally proposed a *new* `list_in_directory` column, but the DB-house-rule schema check found `is_discoverable` (bool, NOT NULL, default true) already exists and already carries "is this a real, publicly-findable org" (today it gates the coach→org link picker). Owner chose to **reuse it — no migration** — so fan-search visibility and the coach-link picker are one switch, not two. Derived-from-tournaments proxy still rejected (League/Club orgs with no one-off tournaments must stay findable) |
| Team | none | new `searchTeamsForDirectory()` scoped to teams inside directory-listed tournaments (no roster leakage from unlisted events). Result presents as "team in {tournament}" → deep-links to that tournament's team page. Ship behind a visible "Teams" chip only when ready — never silently return nothing |

One unified `/api/public/search?q=&types=` endpoint (single debounce/loading lifecycle). Keep user text out of SQL (existing JS-filter pattern); watch the documented scan ceiling as entity types multiply.

**Browse scope (owner-settled 2026-07-18): browse is TOURNAMENTS-ONLY and lives as the Home section — no dedicated Browse tab, visible or hidden.** Rationale on record: browse is a mode of Home, not a fifth nav job; a section scales gracefully with low content volume where a tab would showcase scarcity; a hidden tab = dead surface carried through every nav-sensitive change (SW/redirects/PWA). Organizations: search + landing pages carry findability; a browsable org directory is DEFERRED until volume justifies it (revisit when a "find a league near you" shelf would look alive — the existing `organizations.is_discoverable` flag, reused for Phase 2 search, makes it cheap to add later). Teams: search-only, NEVER browsable (privacy posture + no user job); results stay scoped to directory-listed events. If tournament volume grows large, promoting the Browse section to richer in-place rows ("Live now" / "This weekend" / "Near you") — or eventually its own destination — is a later, data-informed step, not pre-built.

### 3e. Scores tab (two lanes; union data source — critic-adjudicated)

Data source = **union** of access contexts (teams you coach/admin, tournaments you run/officiate) + fan follows, deduped, each entity carrying a reason chip (Staff/Coach/Official/Following; membership chip wins). A coach must see their team without following it.

1. **Filter row**: `[All]` `[Live •N]` pills only (tap-triggered).
2. **My Events strip** (horizontal scroll): one compact card per followed/member **tournament or org** — logo, name, chip, ONE status fragment ("● 3 live" / "12 today" / "Next: Sat 10 AM"). Taps deep-link to the event's own schedule. Scores never expands whole events into game rows — this is the concision mechanism. (Org rollups inert until org-follow ships.)
3. **My Games** (vertical): full rows for member/followed **teams'** games only. **Live pinned on top always**, then Today / Tomorrow / dated headers / Later, then Yesterday backward for results. Reuses the follow-feed live/upcoming/recent branches; new work = calendar-day bucketing in tournament-local time (timezone-gotcha compliant) + the union resolver + rollup aggregates (`liveCount`/`todayCount`/`nextGameAt` per event).
4. **Caps**: initial render = Live + Today + next 3 days + last 7 days; button-gated "Show later / older". No infinite scroll, no virtualization until telemetry justifies it.
5. **Anonymous/empty**: signed-out no-follows → platform-wide live directory + sign-in nudge (existing S1 copy pattern); device-local follows still populate lanes via client fetch (never SSR'd into cacheable HTML).
6. **Liveness**: MVP = 30–60s foreground poll scoped to the Live section; full Realtime = stretch, explicit decision later.

### 3f. Chat tab

- **Logged-out / signed-in fan (no coach/admin context):** static, zero-query preview — fictional sample thread (obviously fake names), value pitch, dual-audience CTAs (coach-framed + organizer-framed, existing acquisition-banner pattern). Fan copy must NOT imply fans get team chat (parent chat is future, gated). Personalized honest line for signed-in fans: "Chat opens up once you're on a team's staff."
- **Signed-in member:** new **cross-context inbox** — every active room across all tournaments/teams/orgs, grouped by event, last-message preview, unread counts, most-recent first. New aggregator (`getChatInboxForUser`) + `/api/consumer/chat/inbox`; membership self-heal runs on inbox load (today it only runs when visiting a tournament's chat surface — a coach must never see a false "no chats"). Every per-room primitive (send, react, polls, pin, mute, moderation) reused unchanged. Posting rules unchanged (member-only, enforced at RLS + grants).
- **Moderation (same release):** report-a-message (member → org-admin queue in the existing manage panel; new table + API) and self-mute-per-room. Member-to-member block deferred to the DM/parent-chat phase where it belongs, same compliance gate.
- **Unread badge:** reuse the existing ChatUnreadBadge pattern on the tab icon.
- **SW:** `/chat` added to denylist + `CACHE_VERSION` bump; inbox data client-fetched only.
- Existing plan gate (`tournament_chat` feature flag) unchanged — this is IA, not packaging. Any change to who *sees* chat by tier routes through /strategy first.

### 3g. Account tab (trimmed)

Identity block → Notification settings → **Install app** (manual trigger incl. iOS "Add to Home Screen" fallback) → **Help & support** → **Legal** (ToS/Privacy — currently absent from the whole consumer shell; installed-PWA users may never see the marketing footer, so this is the only home for them) → Sign out → quiet pinned "Run a tournament" note. Removed: "Your FieldLogicHQ →" workspaces button. Signed-out actions unchanged.

## 4. Phasing

- **Phase M — Mockup rounds (blocking, per standing convention):** Home + All-following sub-page (incl. tournament-first Following cards) → Scores → Chat states. Mockups label NEW vs RESTYLED vs UNCHANGED; owner decision per round before build. Resolve the seam-grid vs rounded-card visual question for search results explicitly in round 1 (this redesign is the natural moment to unify — flagged open in design_decisions.md). **R1-4 theme direction (owner-raised 2026-07-18):** evaluate a lighter/warmer consumer-shell theme for the parent/coach audience — three candidates mocked (A stay dark / B existing light palette / C warm-light redesign with softened type, mono retained for game data). Scope of any light option = the four consumer tabs + their sub-pages ONLY; tournament public pages (which already have a light mode), coaches portal, and admin shells are explicitly out of scope — separate later decisions. If C wins, R1-1 (card language) resolves to rounded automatically, and every subsequent mockup round renders in the chosen theme. Chosen direction gets logged to design_decisions.md at ratification; light-legibility conventions (olive-darkened lime on light grounds, `-strong` status tokens) follow the existing public light-mode rules.
- **Phase 0 — Nav/shell + redirects:** TABS array → Home/Scores/Chat/Account; `/home` → `/discover` redirect; retire `forcePicker`; repoint internal links; `next=` + email/push template inventory; manifest check; desktop topUtil trim.
- **Phase 1 — Home consolidation:** `/api/consumer/home` personalization endpoint (anon-safe SSR shell preserved); Workspaces + Following-Tournaments sections client-rendered into the Discover page; tournament-first card rollup + dedupe; empty states; lapsed-workspace reactivate card; what's-new one-time intro.
- **Phase 2 — Search expansion:** ~~org `list_in_directory` migration~~ → **reuses existing `organizations.is_discoverable` (no migration; owner-settled 2026-07-18)**, `searchOrgsForDirectory`, `searchTeamsForDirectory`, unified `/api/public/search`, Teams chip. **BUILT ON DEV 2026-07-19** (see memory `project_unified_home_redesign.md`).
- **Phase 3 — Scores restructure:** union resolver, day-bucketing, rollup aggregates, My Events strip, caps, poll-based liveness.
- **Phase 4 — Chat tab:** inbox aggregator + API + self-heal-on-load, preview/empty states, report-a-message + self-mute, badge, SW denylist + version bump.
- **Phase 5 — Account trim + polish:** Account restructure, install/help/legal rows, unified cross-tab badge policy (invites vs live-count vs unread), success-metrics instrumentation.
- **Phase 6 — Fast-follow: whole-tournament + org follows:** generalize the follows API beyond `entityType:'team'`, follow buttons on tournament/org surfaces, org landing page (prerequisite — confirm/scope `/{orgSlug}` public page), feed entries for tournaments ("bracket posted", next game day) and orgs ("{n} upcoming tournaments"), Organizations subsection on Home, org rollups in Scores. Account-only for v1 (no device-local path for non-team follows). Decide seeded-pin interaction: recommend fully independent (following a tournament/org never seeds a team pin).
- **Phase 7 — Future, gated: persistent Teams:** followable rep-team entities (fan/parent window onto the existing rep-team structure), team profile pages (schedule/scores across events), Teams subsection on Home, parent chat. **Hard-gated on the PIPEDA/CASL Phase 4 review.** Scope in its own plan when reached.

Per-phase: focused verification (`verify:changed`; `typecheck` on shared-module phases), dev-server restart before handoff on structural phases, `/simplify` where new abstractions appear, `/review` per phase, `/docs` sync at Phase 0/1 (IA + terminology change: Discover/Following tabs disappear) and again at Chat launch.

## 5. Performance

Home becomes the highest-traffic page. The anon-safe SSR shell keeps Discover's current cost; personalization rides one `/api/consumer/home` call (contexts + follows + feed batched server-side). Watch: the follow-feed's one-fetch-per-unique-tournament fan-out and the conditional claimable-registration email scan on zero-context accounts. Section-level loading (skeletons per section, no all-or-nothing) so one slow source never blanks the page. Search subtree keeps its own cache posture.

## 6. Success metrics (instrument in Phase 5)

Search usage rate; card tap-through from Home; Chat tab opens (by auth state) + inbox DAU among coaches; Home time-to-interactive; bounce from signed-out Home; follow conversions originating from Home search; sign-in→workspace landing time for single-workspace users (must not regress vs the pre-redesign fast-path); support/helpdesk volume watch for "where did my stuff go" reports in the 2 weeks post-launch.

## 7. Business decisions routed to /strategy

Logged 2026-07-18: (a) logged-out Chat = static preview, member-only read posture unchanged (visible-pre-signup surface decision); (b) two-tier follow model + Teams-phase direction (durable product structure; Teams phase = Proposed until scoped). Alert-tier gating, chat plan-gating, and free-floor legibility rules are unchanged by this plan; any drift discovered during build routes to /strategy, not silently decided.

## 8. Explicitly out of scope

DMs of any kind; parent/family chat; linked family-member row; public read access to real chat content; changing alert tier-gating; per-entity notification granularity beyond what exists; realtime subscriptions on Scores (poll MVP first); re-theming the tournament public pages, coaches portal, or admin shells (the R1-4 theme decision covers the consumer shell only).

## 9. Known constraints honored (binding)

- SW cache denylist for every new authed top-level route + `CACHE_VERSION` bump (`/chat`); no per-user data SSR'd into cacheable HTML anywhere.
- Tournament/Tournament-Plus orgs never route to `/admin/org/…` — card destinations reuse existing resolution verbatim.
- Sticky/collapsing chrome is tap-triggered only.
- `-webkit-backdrop-filter` before the standard property.
- Timezone-safe date math via lib/timezone.ts helpers for all day-bucketing.
- Schema changes update the Data Dictionary + snapshots in the same unit of work.
- One shared `dev` branch; explicit pathspecs; no commit without per-action owner OK.

## 10. Risk register (from the adversarial audit; severity roll-up)

| Risk | Sev | Mitigation in this plan |
|---|---|---|
| Events/Messages vs Scores/Chat ambiguity | Blocker | Resolved — decision #1 |
| Team = per-tournament entry, no season entity | Blocker | Resolved by §1a two-tier model |
| Tournament/org follow fully unbuilt downstream | Blocker | Sequenced to Phase 6; v1 ships without it |
| Logged-out chat has no data path (RLS) | Blocker | Static preview (decision #4) |
| Family/chat expansion vs PIPEDA/CASL gate | Blocker | Phase 7 hard-gated; no family row |
| SEO/crawl posture of merged Home | Serious | `/discover` stays canonical; anon-safe shell |
| SW-cache PII bug class | Serious | Client-fetch personalization; denylist + version bump |
| Single-context auto-redirect regression | Serious | Split behavior (decision #3) |
| Team/org search eligibility leakage | Serious | Listed-tournament scoping + org opt-out flag |
| No canonical team URL | Serious | v1 needs none (§1a); Teams phase owns it |
| Seeded-pin vs new follow types | Serious | Phase 6 decision; recommend independent |
| Tier-destination separation regression | Serious | Reuse existing destination resolution verbatim |
| Coach+fan duplicate cards | Serious | Partially resolved — dedupe rule §3c + required coaches_basic entity-ID normalization (Phase 1) |
| Lapsed workspace silently vanishes | Serious | Reactivate card, §3c |
| Home perf (highest-traffic page) | Serious | §5 |
| Hardcoded `next=` params + sent email deep links | Serious | Permanent redirects + grep inventory, Phase 0 |
| PWA manifest shortcuts | Minor–Serious | Manifest check, Phase 0 |
| Role-chip compression | Minor | Full badgeLabel fidelity kept |
| "League" noun collision | Minor | "Organization" (decision #5) |
| Seam-grid vs rounded-card drift | Minor | Resolved in mockup round 1 |
| Scroll-triggered sticky chrome regression | Minor | Tap-triggered only |
