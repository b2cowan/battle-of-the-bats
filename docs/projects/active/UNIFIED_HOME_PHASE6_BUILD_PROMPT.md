# Build prompt — Unified Home Phase 6: Whole-Tournament & Organization Follows (free-first)

Paste everything below this line into a NEW chat to start the build.

---

You are building Phase 6 of the Unified Home IA Redesign: fans can follow a WHOLE TOURNAMENT and an ORGANIZATION, not just a team-inside-a-tournament. **The mockup gate is ALREADY SATISFIED** — all six decisions (F1–F6) were owner-ratified 2026-07-20 and this build implements them exactly. Do NOT re-open decisions or re-mock; build to the ratified spec.

## Ratified spec (binding — read in this order before any code)

1. `docs/projects/active/UNIFIED_HOME_PHASE6_FOLLOWS_PLAN.md` — THE implementation plan (decisions table, data/device/API/UI design, build phases 6a–6e, risks). Follow it.
2. `memory/design_decisions.md` — the 2026-07-20 "Phase 6 mockup round (F1–F6) RATIFIED" entry = the full visual/behavioral spec in text. The interactive mockups (binding rev 3, app-faithful colors): artifact `https://claude.ai/code/artifact/d6a7c08b-9058-4533-9a2e-7cf989260848` (WebFetch it if you want the frames; the design-log entry is authoritative if unreachable).
3. `docs/agents/strategy/BUSINESS_DECISIONS.md` — the 2026-07-20 "Free-first follows for ALL entity types" entry. Free-first is a LOGGED BUSINESS DECISION: following anything needs NO account; sign-in = cross-device sync + alerts only; explicit claim-on-sign-in; owner explicitly REJECTED account-gating. Never reintroduce a sign-in wall.
4. `docs/projects/active/UNIFIED_HOME_PHASE6_FOLLOWS_PM_BRIEF.md` — outcomes + the owner's 10-minute test script.
5. `memory/project_unified_home_redesign.md` — Phases 0–5 build status (ALL COMMITTED to dev; P5 = 05aac00f) + the Phase 6 block.
6. The system you're generalizing: `lib/follow.ts` (device layer + the N2 pin machinery you must NOT extend), `lib/fan-follows.ts` (already typed for `tournament|team|org`), `lib/follow-feed.ts` + `lib/home-following.ts` (server↔client split pattern to copy), `lib/scores-view.ts` + `lib/scores-feed.ts` (Scores contract), `lib/directory.ts` (`searchOrgsForDirectory` predicate = org-follow eligibility).
7. Surfaces you touch: `components/consumer/HomePersonalization.tsx`, `components/consumer/ScoresClient.tsx`, `app/(consumer)/following/` (All-following), `components/public/TournamentAccountSheet.tsx`, the tournament home content (strip goes under the unified event header), `app/[orgSlug]/page.tsx` (hero button, both branches).
8. House rules: `CLAUDE.md` / `AGENTS.md` / `AGENCY_RULES.md`.

## Decision recap (full text in the plan + design log)

- **F1:** follow strip under the event header (tournament Home tab only; header itself stays Share-only) + More-sheet row ("no account needed") + org-hero button. Instant free follow; states ghost-star → saving beat → ink-on-lime "★ Following". Signed-out: one quiet dismissible nudge after following (sync + alerts pitch). Claim-on-sign-in lists all three types, renders WARM (consumer shell); on-event affordances render in the event's branded dark.
- **F2:** Home "Following · Organizations" below Following·Tournaments; org context line live → "NEXT · {event} · {dates}" → count → quiet off-season (org cards PERSIST off-season). Whole-event follows reuse the tournament card (status line, no team line). All-following page stays; gains Organizations group + "Whole event · {dates}" rows.
- **F3:** org landing page unchanged except the hero Follow button (both rendering branches). Single-active-tournament orgs without a public site keep their redirect — no new org surface.
- **F4:** Scores = ONE rollup tile per followed org (round monogram, Following chip, one mono fragment, tap → org page), present only while live/upcoming/≤1-week-completed; whole-event follows add event tiles, NEVER My-Games rows; no org tile for orgs the user staffs.
- **F5:** status lines are CURRENT-STATE only, computed from public data; NO activity feed; NO new push (2026-07-14 account-scoped alerts unchanged).
- **F6:** full independence — tournament/org follows never seed a my-team pin; org follow never auto-follows events; team + event follow in one tournament = one Home card (team wins); role/workspace outranks Following.

Use the ratified mockup copy verbatim for buttons/nudge/claim; flag genuinely new copy needs to /marketing rather than inventing.

## Build order (from the plan §7 — each increment: focused verify → owner browser test → per-action commit OK)

6a data + API core → 6b event/org page affordances → 6c Home + All-following → 6d Scores → 6e polish + metrics + /docs + final /simplify + /review sweep.

## HARD CONSTRAINTS (binding)

- **NO migration expected — but VERIFY live at build start** that `fan_follows.entity_type`'s CHECK allows `tournament|org` (live information_schema / snapshots, NEVER migration files). If reality differs, STOP and confirm the next free migration number with the owner (193 is the latest on dev; never reuse). The Data Dictionary TEXT ("Slice 1 writes only team" notes on `fan_follows`) must be amended in the SAME unit of work as the first non-team writer.
- Eligibility gates: tournament follows validate through the existing public-tournament resolution; org follows validate through the exact `searchOrgsForDirectory` predicate. A follow must never resolve to a dead or non-public page. Status resolution honors hidden-page settings (hidden schedule must not leak counts — P3 review precedent).
- Additive contracts only: team follow API shapes, `ScoresEvent`, and home payload stay byte-stable for shipped consumers; widen with new optional fields (`orgTiles`, `wholeEvent`).
- Do NOT extend the seeded-pin/N2 reconciliation machinery — tournament/org device follows are plain storage entries (no `seeded` flags, no sign-out clearing, no account→device seeding).
- No new top-level routes → NO SW denylist / CACHE_VERSION change; org + tournament SSR stays anon-safe (follow state client-hydrated — FP-2 pattern; never per-user data in cacheable HTML).
- Warm tokens are consumer-shell-scoped (`--home-*` only; never override global dark tokens). Public tournament/org CSS: no new literal hex (token ratchet). Timezone-safe date math via `lib/timezone.ts` only.
- `champions_crowned_at` (mig 176) is prod-pending — status code must treat null as "not crowned".
- Alerts system untouched. No plan-gating/tier changes (any packaging question → /strategy).
- Metrics: one new allowlisted client event `follow_tapped {entityType, on, signedIn}` through the Phase 5 pipeline.

## HOUSE RULES

Planning-first is DONE (plan + PM brief exist — don't rewrite them; update them if reality diverges). Per increment: `npm run verify:changed` (+ `npm run typecheck` on shared-module increments 6a/6c/6d); dev-server restart before handoff when files are added or shared modules change (stop server → `rm -rf .next` → `npm run dev` → wait for Ready); offer /simplify (new abstractions) → /review (substantive) → /docs (fan-facing flows change: follow-a-tournament/org guidance in the fan-experience help). NO commit or push without explicit per-action owner OK. Owner-facing summaries in product-owner voice (UX outcomes, no file/function/schema detail unless asked). Build the whole increment per pass; label NEW / RESTYLED / UNCHANGED vs the ratified frames in summaries.

## CONCURRENCY / BRANCH

One shared `dev` branch — re-check `git rev-parse --abbrev-ref HEAD` before every commit. Stage EXPLICIT pathspecs only (never `git add -A`); `git show --stat HEAD` after every commit; if foreign files slipped in, soft-reset and re-commit. Known loose foreign files to NEVER stage: `.claude/settings*`, `pnpm-workspace.yaml`, concurrent `app/(consumer)/discover/` edits, `UNIFIED_HOME_TOURNAMENT_NAV_MERGE_*` docs. **Sequencing (owner-confirmed 2026-07-20): Phase 6 COMPLETES BEFORE the Tournament Nav Unification build starts** — if you find nav-merge work in flight, stop and flag it.

## PROD CONTEXT

Phases 0–5 are committed on dev, not yet owner-tested, and promote as ONE bundle (mig 193 applied to prod first). Phase 6 promotes AFTER that bundle — independently or folded in, owner's call at promotion time. Nothing in Phase 6 may assume prod state beyond that bundle.
