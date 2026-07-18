# Build Kickoff — Unified Home IA Redesign, Phases 0+1 (nav restructure + warm Home)

Paste this prompt into a fresh chat to start the build. Owner authorized the Phase 0+1 build 2026-07-18; mockup phase is complete and all design decisions are ratified and logged.

---

## Mission

Build **Phases 0 and 1** of the Unified Home IA Redesign as ONE unit of work: the consumer nav becomes **Home / Scores / Chat / Account**, and the new warm-light Home (search + workspaces + tournament-first Following + browse) replaces the Discover/Following/`/home`-launchpad trio. This is the first user-visible moment of the redesign — it lands together, gets the full verification treatment, then goes to the owner for phone testing. **Do not start Phases 2+ (search expansion, Scores, Chat, Account trim) in this chat.**

## Read before writing any code

1. `docs/projects/active/UNIFIED_HOME_IA_REDESIGN_PLAN.md` — the plan. Phases 0+1 scope is §4; target IA §3a–§3c; URL/redirect architecture §3b (LOAD-BEARING); constraints §9; risk register §10.
2. `memory/design_decisions.md` — the four 2026-07-18 "Unified Home Round …" entries. These are the BINDING visual specs: Round 1 (warm-light theme tokens/values, Home composition, All-following page, tap→tournament-home), plus the theme-scope rules. Rounds 2–3 are later phases — do not build them, but do not contradict them.
3. `memory/project_unified_home_redesign.md` — project state + decided rounds.
4. `AGENTS.md` + `AGENCY_RULES.md` + `CLAUDE.md` — house rules (Next.js 16 `proxy.ts` convention, one shared `dev` branch, explicit pathspecs, NO commit/push without per-action owner OK, dev-server restart rule, verification workflow).
5. Visual reference artifacts (owner-approved; the design-log entries encode the same specs in text): Home rev 4 `claude.ai/code/artifact/de1c87a1-1b81-4026-b697-7406d63435c0`.

## Scope — Phase 0 (nav/shell + safe plumbing)

- `components/consumer/ConsumerNav.tsx` TABS → Home (`/discover`, Home icon) / Scores (`/scores`) / Chat (`/chat` — **placeholder page this phase**: the static logged-out/fan pitch state only, NO inbox; it must exist so the tab never 404s) / Account (`/account`). Nav shape identical signed-in/out.
- `/home` → permanent redirect to `/discover`. Retire `?pick=1`/`forcePicker` and the single-context auto-redirect **for page visits** (Home tab tap always renders Home). **KEEP the post-login fast-path** in `getAuthDestination` (solo-workspace users still land in their workspace at sign-in) — decided, do not re-litigate.
- `/following` stays alive as the "All following" page (Phase 1 restyles it). Delete the zero-context `redirect('/discover')` self-redirect case.
- Grep inventory: every hardcoded `next=/home`, `next=/discover`, `next=/following` across `app/`, email templates, push payload builders — repoint internal links; old URLs keep working via redirects FOREVER (sent-email deep links).
- Check `public/manifest.json` for `start_url`/`shortcuts` referencing changed routes.
- Desktop `.topUtil`: remove "Your workspaces"; keep "Run a tournament", coach pill, "Sign in".
- SW: `/chat` is a NEW authed-capable top-level route → add to `NEVER_CACHE_PREFIXES` in `public/sw.js` + bump `CACHE_VERSION` (binding FP-2 rule), even though this phase's placeholder is static.

## Scope — Phase 1 (warm Home consolidation)

- **Warm theme** per the Round 1 design-log entry (exact values there): consumer-shell-scoped tokens (new CSS custom props scoped to the consumer layout — NEVER override global dark tokens; tournament/coaches/admin shells untouched). Sans for names/labels, `--font-data` retained for scores/records/kickers; lime→olive `#57651E` for text accents on the warm ground; ink-filled active filter pills.
- **`/discover` page becomes Home** — SSR shell stays 100% anon-safe (no server-side branching on user identity in the page; SEO metadata/canonical/sitemap unchanged). Personalization is CLIENT-FETCHED from a new `/api/consumer/home` endpoint (contexts + follows + feed + pending invites batched; SW's blanket `/api/` no-cache covers it). This is the FP-2 PII-leak fix pattern — treat as non-negotiable.
- Sections (Round 1 spec): Search bar ("Find a Tournament, Team, or Organization" — search itself stays tournaments-only this phase) → PendingInvitationsCard → **Workspaces** (existing context cards, existing destinations resolution VERBATIM — tier-separation rule; full badgeLabel fidelity; warm restyle) → **Following · Tournaments** (tournament-first cards: tournament identity leads, "Your team · {name}" + live/next/last status line via the follow-feed resolver; multiple followed teams in one tournament → one card; Past events collapsed; tap → tournament HOME page) → **Browse** (existing directory grid/filters, warm rounded restyle — seam-grid retires here).
- **Dedupe rule** (§3c): one card per entity, role chip wins over "Following"; REQUIRED: normalize basic-coach contexts to real team/tournament IDs first (they currently carry constant synthetic IDs — see plan §3c caveat).
- **Lapsed-subscription workspace** → explicit degraded "reactivate" card, never silent omission.
- **All-following page** (`/following`): warm restyle per Round 1 rev 4 — header row = "← Home" back link left + "All following · N" right; Tournaments group + Past events; star = unfollow; quiet "Score alerts → Account · Notifications" pointer row.
- **What's-new intro**: one-time dismissible notice for returning users explaining the new tabs (nav shape changed; Discover/Following users need the bridge).
- Empty states per plan §3c table; absent sections omitted, never rendered empty.

## Verification & handoff

- `npm run verify:changed` per unit; `npm run typecheck` (shared modules + nav/routing touched). Sticky search bar: tap-triggered only (no scroll-triggered collapse — repeat-offender bug).
- Structural/shared-module changes ⇒ stop server → `rm -rf .next` → `npm run dev` → wait for Ready before browser checks (binding restart rule).
- Verify: anon `/discover` (SEO shell + browse), signed-in Home (all sections), `/home` redirect, solo-admin login fast-path, `/following` restyle, `/chat` placeholder, Account unchanged this phase.
- Offer `/simplify` (new theme layer + card components = new abstractions), then `/review` (high-risk: nav shell + auth redirects + new API endpoint), then `/docs` (IA + terminology change: Discover/Following tabs disappear).
- NO commits without explicit per-action owner OK. Report completion in product-owner voice (UX terms), then hand to owner for phone testing.

## After this lands (separate chats, not yours)

Phase 3 (Scores, spec = Round 2 entry) and Phase 4 (Chat inbox, spec = Round 3 entry) may run in PARALLEL chats; Phase 2 (search expansion) small, alongside either; Phase 5 (Account trim + badge policy + metrics) LAST. Sequencing rationale in the plan §4.
