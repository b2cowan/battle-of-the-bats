# Unified Home Phase 6 — Whole-Tournament & Organization Follows (Free-First) — Implementation Plan

**Status:** RATIFIED, BUILD NOT STARTED. All six mockup decisions (F1–F6) owner-ratified 2026-07-20; artifact `d6a7c08b-9058-4533-9a2e-7cf989260848` **rev 3** is the binding visual spec (design_decisions.md 2026-07-20 entry). Free-first follow access is a logged business decision (BUSINESS_DECISIONS.md 2026-07-20) that supersedes the parent plan's "account-only for v1" note.
**Parent plan:** `UNIFIED_HOME_IA_REDESIGN_PLAN.md` §4 Phase 6 (updated). **PM brief:** `UNIFIED_HOME_PHASE6_FOLLOWS_PM_BRIEF.md`.
**Branch:** shared `dev` only. **Migration:** NONE expected (see §2). **Promotion:** after the Phases 0–5 bundle (mig 193 first); Phase 6 can then promote independently or fold in — owner call at promotion time.
**Sequencing constraint (binding):** shares the public tournament pages + Home with the Tournament Nav Unification project — the two must NOT run simultaneously (sequence, or strictly disjoint file ownership).

## 1. Ratified decisions this plan implements

| # | Call |
|---|---|
| F1 | Follow affordances: strip under the event header on the tournament Home tab (never a header icon — G5 holds) + More-sheet row + org-hero button. **Instant free follow**; sign-in = dismissible nudge (sync + alerts); claim-on-sign-in extended to all 3 types (explicit); claim renders WARM, on-event affordances render branded-dark |
| F2 | Home gains **Following · Organizations** below Following·Tournaments; org context line priority live → next-event → count → quiet off-season (cards persist off-season). Whole-event follows reuse the tournament card (status line, no team line). All-following page stays; gains Organizations group + whole-event row type |
| F3 | Org landing page keeps its branded look/content on every branch; add ONLY the hero Follow button. Single-active-tournament orgs without a public site keep their redirect (fans follow the event there) |
| F4 | Scores: ONE rollup tile per followed org (round monogram, Following chip, one mono fragment; tap → org page), present only while live/upcoming/≤1wk-completed; whole-event follows add event tiles, NEVER My-Games rows; staff/admin orgs never get an org tile |
| F5 | Status vocabulary = current-state only, computed from public data (dates/starts-in → REG OPEN → FIRST PITCH → live/today counts → PLAYOFFS ARE SET → CHAMPIONS CROWNED → COMPLETED); NO activity feed, NO new push (2026-07-14 alerts decision unchanged) |
| F6 | Full independence: tournament/org follows never seed a my-team pin; org follow never auto-follows events; team + event follow in one tournament = one Home card (team wins); role/workspace outranks Following everywhere |

## 2. Data layer — no migration expected

- `fan_follows` was built for this: `entity_type` CHECK already allows `tournament|team|org` (Data Dictionary; **re-verify live** via `information_schema` at build start per the house rule — never from migrations), `UNIQUE(user_id, entity_type, entity_id)` index exists, `entity_id` is a bare uuid (polymorphic, app-validated).
- **Writers:** `entity_id` = `tournaments.id` for `'tournament'`, `organizations.id` for `'org'`. Validation before insert (mirrors `teamBelongsToTournament`):
  - tournament → the existing `resolvePublicTournament(orgSlug, tournamentSlug)` gate (live org + public tournament) resolved to its id;
  - org → the **org-follow eligibility predicate = the Phase 2 org-search predicate** (`is_discoverable AND is_public AND account_kind≠team_workspace AND plan_id≠team AND subscription_status≠canceled`) so a follow can never point at a dead `/{orgSlug}`.
- **Dictionary text (same unit of work as the first non-team writer):** `fan_follows.entity_type` gotcha #2 + column notes say "Slice 1 writes only `team`" — amend to Phase 6 writing all three, and document the two validators above on `entity_id`. No snapshot refresh needed (no schema change) — `check:dictionary` only gates schema drift, but the prose must not lie.
- **Reads:** new resolvers in `lib/fan-follows.ts`: `getFollowedTournamentsForUser`, `getFollowedOrgsForUser` (clean-drop rows whose entity vanished or whose org is canceled/ineligible — same posture as `getFollowedTeamsForUser`).

## 3. Device layer (free-first) — mirrors the team pattern, minus the pin machinery

- **Storage** (extend `lib/follow.ts`): `fl_follow_tourn_${orgSlug}_${tournamentSlug}` → `{ name, followedAt }`; `fl_follow_org_${orgSlug}` → `{ name, followedAt }` (names cached for instant render). `readAllFollowedTournaments()` / `readAllFollowedOrgs()` + `useAllFollowed*` hooks; reuse the existing `fl-follow-change` same-tab event + `storage` cross-tab sync.
- **No pin interaction (F6):** no `seeded` flags, no reconciliation, no sign-out clearing — these are plain device follows like an explicit team follow. The delicate N2 seeded-pin machinery is NOT extended.
- **Account mirror:** generalize `syncFollowToAccount` → POST `/api/consumer/follows` with `entityType: 'tournament' | 'org'` (+ slugs); fire-and-forget, keepalive, idempotent, anon no-op `{linked:false}` — the existing contract, widened. Team payload shape unchanged (backward compatible).
- **Signed-in display merge:** account list is the primary; device-only extras still render (client merges, deduped by entity key) so a follow made signed-out never vanishes after sign-in; the claim offer clears the divergence. (Teams already behave this way in spirit — pin + account merge.)
- **Claim flow:** the existing explicit device→account claim ("add your device follows?") extends to list all three types with per-type sublabels (`source: 'device_reconcile'`). Never silent (locked decision).

## 4. Status resolution — one vocabulary module, shared by Home / All-following / Scores

- New `lib/entity-follow-status.ts` (server) + a PURE client-safe contract file (pattern: `follow-feed.ts` ↔ `home-following.ts`):
  - `getTournamentFollowStatuses(refs[])` → `{ group: 'pre'|'reg_open'|'scheduled'|'live'|'today'|'playoffs_set'|'champions'|'completed', fragment, live: boolean }` per tournament. Inputs: one `getPublicTournamentPageData(org, slug, 'scores')` fetch per unique tournament (the Phase 3 narrow section — games+teams only), tournament fields (`status`, `startDate/endDate`, registration-open state, `playoffs_published_at`, `champions_crowned_at` + champion name via the shared champions helper). **Respect `pageEnabled`/hidden-schedule gates** (P3 review precedent — a hidden schedule must not leak counts; fall back to date-level status).
  - `getOrgFollowRollups(orgs[])` → `{ live: {count, eventName} | null, next: {eventName, dates} | null, upcomingCount, fragment }` across the org's public active/upcoming tournaments (bounded per org, cap + log like the Scores staff cap; reuse the per-tournament fetches above — one fetch per unique tournament across the whole payload).
  - All date math via `lib/timezone.ts` (`tournamentToday`, `daysBetweenDateStrings`) — never raw UTC.
  - `champions_crowned_at` (mig 176) is dev-only until the pending bundle promotes — code must treat null as "not crowned" (it rides the earlier bundle, which precedes Phase 6 on prod anyway).
- Explicitly NOT built: change-detection, activity history, push fan-out (F5 boundary).

## 5. API surface

- **`POST /api/consumer/follows`** — widened per §3 (validation per §2). GET gains entity state for public-page hydration (`?entity=tournament&…` / `?entity=org&…` → `{ following }`) or an equivalent additive shape — decide at build, keep the team contract byte-stable.
- **`/api/consumer/home`** — payload gains whole-event cards (merged into `following.current/past` as cards with a `wholeEvent` flag and status context line) + `organizations: OrgFollowCard[]`. Device mode: extend the existing device-feed resolution path (the endpoint `useFollowFeed` POSTs to) with `tournaments`/`orgs` arrays → resolved cards for signed-out clients. Anon-safe, `no-store`, public data only (statuses are public; the LIST comes from the client's own storage).
- **`/api/consumer/scores`** — GET (session): followed tournaments → `ScoresEvent` tiles (reason `'following'`, no game rows) + `orgTiles` (new additive payload field so the shipped `ScoresEvent` contract is untouched); POST (device): body gains `tournaments`/`orgs`. Org-tile lifecycle per F4 (live/upcoming/≤1wk grace only). Dedupe: an event already present via coach/staff/team-follow keeps its stronger reason; org tiles suppressed for orgs the user staffs.
- No new top-level routes ⇒ **no SW denylist / CACHE_VERSION change**. All APIs `Cache-Control: no-store` (house pattern).

## 6. UI (build to rev 3 frames; label NEW/RESTYLED/UNCHANGED)

- **Tournament pages (branded dark, ratchet-clean — no literal hex in public CSS):**
  - `components/public/FollowTournamentStrip.tsx` — client island under the unified event header on the tournament HOME tab only: ghost-star strip → saving beat → ink-on-lime "★ Following" (pillOn convention); device write first + account mirror; account hydration client-side (FP-2 — no per-user SSR).
  - Post-follow **nudge** (signed-out only): one quiet dismissible card under the strip ("Following on this device · Sign in and it goes with you — every device, plus score alerts"), one localStorage dismissal key, shown at most once per device until cleared; reuses the existing signup-nudge conventions.
  - `TournamentAccountSheet` "This event" section: "Follow this tournament — See it on your Home & Scores — no account needed" row above the follow-a-team door; label flips to the followed state.
- **Org page (`app/[orgSlug]/page.tsx`, both rendering branches):** hero Follow button as a small client island (`FollowOrgButton`); SSR stays anon-safe; existing content untouched (F3).
- **Home (`HomePersonalization` + warm CSS):** Following·Tournaments accepts whole-event cards (status line, no team line; dedupe: a team follow in the same tournament wins the card); NEW Following·Organizations section below (org monogram round, context-line priority per F2, off-season persistence); signed-out device merge for both.
- **All-following (`FollowingList`):** Organizations group + whole-event row type ("Whole event · {dates}"); star=unfollow (account and/or device — the generalized `unfollowEverywhere` rule per entity).
- **Scores (`ScoresClient`):** following-sourced event tiles + org tiles (round monogram) in the My Events grid; My Games untouched.
- **Metrics (§6 of the parent plan):** extend the Phase 5 pipeline with one client event `follow_tapped {entityType, on, signedIn}` (allowlisted, bounded) fired from the three affordances — the "follow conversions" success metric.
- **Copy:** route button/nudge/claim wording through `/marketing` at build (logged handoff; tournament-scoped follow language rider applies).

## 7. Build phases (each: focused verify → owner test → per-action commit OK, explicit pathspecs)

1. **6a Data + API core** — device lib + follows API generalization + eligibility validators + resolvers + claim extension + dictionary text. `typecheck` (shared modules). Restart before handoff (new files).
2. **6b Event + org affordances** — strip + nudge + sheet row + org hero button. Playwright probes: strip states, 44px floors, anon-safety (no per-user HTML), both color modes.
3. **6c Home + All-following** — sections, whole-event cards, device merge, dedupe.
4. **6d Scores** — following tiles + org rollups + device POST mode.
5. **6e Polish** — status vocabulary edge cases, metrics event, `/docs` sync (fan-experience guide: follow a tournament/organization; claim + nudge), final `/simplify` + `/review` (high-risk: public-data eligibility + API widening) sweep.

## 8. Risks / guards

| Risk | Guard |
|---|---|
| Eligibility leakage (unlisted org / draft or hidden tournament reachable via follow APIs) | Reuse the exact search predicate + `resolvePublicTournament`; status resolver honors `pageEnabled` (hidden-schedule precedent from the P3 review) |
| Payload fan-out cost (org rollups multiply tournament fetches) | One fetch per unique tournament across the whole payload (existing batching); per-org tournament cap + log |
| `champions_crowned_at` prod-pending (mig 176) | Null-tolerant status branch; Phase 6 promotes after that bundle regardless |
| Stale/malformed device entries | Tolerant parse + clean-drop (existing pattern); resolver drops dead entities server-side |
| Claim-flow regression | Existing claim path extended additively; team-only behavior byte-stable when no new-type entries exist |
| Contract drift for shipped consumers | `ScoresEvent`/home payload widened additively (`orgTiles`, `wholeEvent` flag); team API shapes unchanged |

## 9. Out of scope (binding)

Push/alerts for the new follow types; activity feeds; follower-count surfaces; org browse directory; persistent Teams layer (Phase 7, PIPEDA/CASL-gated); any nav-merge surface work; any plan-gating/tier change (none — logged).
