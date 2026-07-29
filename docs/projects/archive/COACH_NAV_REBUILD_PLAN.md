# Coach Portal Nav Rebuild — Team-Scoped Shell — Implementation Plan

> **Status:** Planning (plan-only; build in a FOLLOW-UP session)
> **Created:** 2026-06-15
> **Branch:** `dev` (single shared branch — per AGENCY_RULES 2026-06-15; NO feature branch)
> **Companion to:** [COACH_EXPERIENCE_WALKTHROUGH_PLAN.md](COACH_EXPERIENCE_WALKTHROUGH_PLAN.md) (this is the staged "nav rebuild" spun out of the Step-3 pending-portal rethink)
> **PM brief:** [COACH_NAV_REBUILD_PM_BRIEF.md](COACH_NAV_REBUILD_PM_BRIEF.md)

## Goal

Rebuild the org-less Coaches Portal shell (`components/coaches/CoachPortalShell.tsx`) so it is **team-scoped**, exactly the way the tournament-admin shell is tournament-scoped. Today the rail shows generic destinations (Home / Tournaments / **My Teams**) **plus** a separate "MY TEAMS" team-list section — so "My Teams" appears twice, and the portal reads as a multi-team browser for coaches who (99% of the time) have exactly one team. The rebuild puts **the team** at the top of the rail (name + status chip when 1; a `<select>` dropdown **only** when >1), and turns the nav links into **the sections for that team**. A coach lands on their team and sees "here's my team and the things I do for it," mirroring how a tournament admin lands on their one tournament — not a list of teams or a wasted "My Teams" link.

## PM Brief

See [COACH_NAV_REBUILD_PM_BRIEF.md](COACH_NAV_REBUILD_PM_BRIEF.md). Summary: the free Coaches Portal stops feeling like a "pick one of your teams" directory and starts feeling like a focused home base for the one team a coach actually manages, with a clean switcher for the rare multi-team coach.

---

## Current state (what's being replaced)

`components/coaches/CoachPortalShell.tsx` (the org-less shell; renders on `/coaches`, `/coaches/tournaments/*`, `/coaches/team/*` per `isCoachPortalShellPath`):
- **Desktop left rail:** brand ("FL Coaches Portal", no subtitle) → `NAV` array (**Home**, **Tournaments**, **My Teams**) → a separate **"My Teams"** team-list (`railTeams`, the duplicate) → footer (Send feedback / All workspaces / Sign out).
- **Mobile:** top bar (brand + account chip → bottom sheet) + bottom nav (the same 3 `NAV` tabs).
- **Team source:** `GET /api/coaches/basic-teams` → `{ user, teams: BasicTeam[] }` (returns `basic_coach_teams` — id + name only), client-synced post-hydration.
- **"Back to Coaches Portal" breadcrumb:** lives on the record page, not the shell — already removed on the pending page in the walkthrough; this plan removes the pattern generally where it persists.

**Out of scope:** `components/coaches/CoachesSidebar.tsx` is the *premium* org-scoped (`/{orgSlug}/coaches`) shell — a different component for `team_workspace`/`team`-plan coaches. **Do not touch it.** Only the org-less `CoachPortalShell` is in scope.

---

## Architectural Decisions

### Decision 1 — The rail-top "team" unit = the durable **basic_coach_team** (Option A). ✅ RESOLVED (recommended; confirm at sign-off)

The owner deferred this to planning. Two models were on the table:

| | **Option A — basic_coach_team (RECOMMENDED)** | Option B — tournament registration |
|---|---|---|
| Rail-top switches between | The durable team ("toronto blue jays5") | Each tournament entry (a `teams` row) |
| Faithful to "this is MY team"? | ✅ Yes — one team, many tournament entries under it | ❌ No — 1 team in 3 tournaments = 3 "teams" in the switcher |
| Mirrors org→tournaments? | ✅ Exactly (team = org, tournament entries = tournaments) | ✗ Flattens the hierarchy |
| Wiring cost | **Low — the resolve already exists** | Lowest (pending page already has the registration) |
| Standalone-team surfaces (roster/schedule/fees) fit as sections? | ✅ They're keyed on `basicTeamId` already | ✗ A registration has no roster/fees of its own |

**Why A, decisively:** the main historical objection to A was "the record page (`/coaches/tournaments/{teamId}`) is keyed on a `teams` REGISTRATION, not a basic team, so you'd need a resolve step." **That resolve already exists and is in production use:** `getBasicCoachTournamentTeamsForUser` (`lib/basic-coach-teams.ts:513`) groups registrations under their parent basic team via the **`basic_coach_team_users`** link table + a `linkByRegistrationId` map (lines 544–547). So registration → parent basic team is a solved lookup. Option A is both the more faithful model **and** cheaply wireable. Option B is rejected: it violates the owner's core "this is my team" intent and leaves the standalone surfaces (which ARE keyed on the basic team) homeless.

**Consequence:** the shell needs a richer team source than today's `{id, name}`. See Decision 4.

### Decision 2 — Section list under the team (FREE tournament-coach)

All standalone surfaces below are **FREE** (the standalone team home IS the free floor; verified `app/coaches/team/[basicTeamId]/page.tsx` renders all four with no plan gate — `ScopeCeilingInterest` is the *upsell prompt*, not a gate). Proposed sections, in order:

**TWO TIERS — progressive disclosure (REVISED 2026-06-15 per owner reframing; see Decision 2b).** A first-time coach is a *tournament participant*, NOT someone who signed up to run team operations. Showing Roster/Schedule/Fees/Announcements (let alone a future Budget) in the nav on day one answers questions they never asked — it reads as bloat. So sections split into:

**Tier 1 — always on (tournament participant lens):**
1. **Overview** — the team's home (today `/coaches/team/{basicTeamId}` — TeamHQ stat strip). The landing section.
2. **Tournaments** — the team's tournament entries (active + past), i.e. today's `/coaches/tournaments` list **filtered to this team**. The list that genuinely belongs to a team. Each entry deep-links to the existing record page (`/coaches/tournaments/{registrationId}`).

**Tier 2 — hidden until ACTIVATED (team-operations lens):**
3. **Roster** — `RosterEditor` (free) — **the wedge feature** (see Decision 2c).
4. **Schedule** — `ScheduleEditor` (free).
5. **Fees** — `FeeEditor` (free).
6. **Announcements** — `AnnouncementEditor` (free).

Tier-2 sections do NOT appear in the nav until the coach turns them on. They activate through **tournament-adjacent moments** (e.g. after filling a tournament-required roster → "reuse this next time?") or a low-key "do more" invitation — never as pre-built empty sections. Once activated, the section appears in the nav because now it's relevant and theirs.

### Decision 2b — Progressive disclosure: opt-in invitations, tournament-first ✅ RESOLVED (owner, 2026-06-15)

**Rejected — "everything visible":** shows budget/fees/roster to a tournament-only participant. Bloat-first. **Rejected — "hidden behind a hard upgrade gate":** kills discovery of genuinely-free, useful capability (the persisted roster that saves re-typing 15 players). **Chosen — opt-in invitations, tournament-first:** default to the tournament lens; team-ops capabilities are latent and surface as **dismissible, benefit-framed invitations** tied to what the coach is already doing. Turn a "why is this here?" into a "huh, I could do that." The progression: Day 1 = tournament-only → during the event hits roster (organizer-required) → offered free persistence → later the persisted roster auto-fills the next registration (felt value) → a leaned-in coach ends up with the full team-scoped portal, but **chose** each piece.

**Requires:** a lightweight per-team notion of "which Tier-2 capabilities are activated" so activation persists and drives nav visibility. → **OQ-7** (storage mechanism — see Open Questions; likely a small flag set on the basic team or a per-team prefs row; NO new heavy schema — confirm at build).

### Decision 2c — Wedge feature = persisted roster ✅ RESOLVED (owner, 2026-06-15)

The first Tier-2 capability surfaced. Highest-value + most tournament-adjacent: a coach types their roster once for a tournament; we offer to **keep it free**; it **auto-fills the next registration**. Saves felt re-work, and roster is already a tournament concept so it never reads as off-topic. The activation moment lives at/after the tournament roster submit (`TournamentRosterSubmit` — `app/coaches/tournaments/[teamId]/page.tsx`). Other Tier-2 features follow the same pattern later.

### Decision 2d — Upsell tone: ⏳ DECIDE BY PREVIEW (owner wants to see options 1 vs 3 in practice)

Owner wants to **see two upsell treatments side-by-side in the browser** before choosing, not pick from a spec:
- **Treatment A — quiet & contextual, dismissible:** a single low-key invitation in-context (Overview footer line and/or right after a tournament-roster save). Errs toward "clean participant view."
- **Treatment B — persistent "Do more" section:** a small always-present "Do more with your team" area listing activatable features. Higher discovery; closest to the "showing things they may never want" risk.

Both activate the SAME persisted-roster capability — they differ only in presentation. → **Build a dev-only static preview** (`PREVIEW STEP` below) showing the whole tournament-first first-login experience with BOTH treatments, owner picks, then build only the winner. The opt-in plumbing is identical regardless.

> **Open question OQ-2:** Tier-1/2 sections currently all render on ONE page (`/coaches/team/{basicTeamId}`). Turning them into nav destinations means (a) anchor-scroll within the single page, or (b) real sub-routes (`/coaches/team/{id}/roster`, …). **Recommend (a) anchor links for v1**; revisit sub-routes later. Needs owner sign-off.

### Decision 3 — Single-team vs multi-team rail-top (mirror `AdminSidebar.tsx`)

Direct port of the `tournamentSwitcher` block (`components/admin/AdminSidebar.tsx:439–510`):
- **1 team:** team **name** + a **status/lifecycle chip** (reuse `deriveCoachLifecycleChip` / the coach lifecycle chip already used on the tournaments list — e.g. ● Live / Game Day / Upcoming / Pending). **No dropdown.**
- **>1 team:** a `<select>` of team names (mirrors the admin's `switcherSelect`). Selecting a team **navigates** (see OQ-1 for where).
- **No "My Teams" nav link. No separate team-list section.** Both are removed — the rail-top IS the team identity, the nav below IS the sections.

### Decision 4 — Team source upgrade

Today `/api/coaches/basic-teams` returns `{id, name}`. The rebuild needs, per team: `id`, `name`, a **status/lifecycle signal** (derive from the team's most-relevant tournament entry — live > game-day > upcoming > pending, reuse `deriveCoachLifecycleChip`), and a **team color** (already have `teamColor()` client-side). Options:
- **4a (recommend):** extend `/api/coaches/basic-teams` to also return each team's lifecycle chip (compute server-side from the team's registrations — the data is already joined in `getBasicCoachTournamentTeamsForUser`). One endpoint, one fetch.
- **4b:** a new `/api/coaches/team-context` endpoint. More surface, avoid unless 4a bloats.

> **Open question OQ-3:** confirm 4a (extend existing endpoint) vs 4b. Recommend 4a.

### Decision 5 — Brand subtitle

Add a one-line `--font-data` uppercase `--white-40` subtitle under the "Coaches Portal" brand: **"Your home base for teams & tournaments"** (final copy → optionally run by `/marketing`). Answers "what is this" persistently, at zero chrome cost. Mirrors `AdminSidebar`'s `.logoSub` (org name under the wordmark).

### Decision 6 — Mobile

The shell has a mobile top bar + bottom nav (not the admin's pattern). **Progressive disclosure helps mobile most:** a first-time coach's bottom nav is just **Overview / Tournaments** (Tier-1) — no tab-budget problem at all. Tabs only grow as Tier-2 sections are activated. Plan:
- **Mobile top bar:** show the **team name** (+ chip), keep the account chip. For >1 team, the team name becomes a tap target opening a team picker (reuse the existing bottom-sheet pattern, or a `<select>`).
- **Mobile bottom nav:** the *active* section tabs only. Day 1 = 2 tabs. As a coach activates Tier-2 features, cap at ~4 visible + a "More" sheet (admin precedent) if it ever exceeds the budget.

> **Open question OQ-4:** mobile bottom-nav tab budget once several Tier-2 sections are active — confirm ~4 + "More". Largely moot at first login (only 2 Tier-1 tabs) and fully moot if OQ-2 picks single-page anchor-scroll.

---

## Phases

### Phase 0 — Decisions FROZEN (2026-06-16) ✅
- [x] Decision 1 = Option A (basic_coach_team is the rail unit). Decision 2/2b/2c (progressive disclosure + persisted-roster wedge). Decision 2d = **Variant A** (quiet, dismissible) + the rediscovery system below.
- [x] **OQ-1 = team switch → the team's Overview** (`/coaches/team/{id}`).
- [x] **OQ-2 = REAL SUB-ROUTES per section** (not anchor-scroll). `/coaches/team/{id}/{roster|schedule|fees|announcements}`. ⬆ more build than the original anchor recommendation.
- [x] **OQ-7 = EXPLICIT `activated_features` field on `basic_coach_teams`** (a migration). ⬆ the plan is NO LONGER migration-free — migration is now the FIRST task + dictionary/snapshot in the same unit of work.
- [x] **OQ-5 = `/marketing` drafts the subtitle BEFORE the shell build** (blocking pre-step for Phase 2).
- [x] Lands on `dev` directly (single-branch policy); its own `/review` before commit.

### REDISCOVERY SYSTEM (owner-approved via preview, 2026-06-16)
Variant A's dismissible invite must never destroy discovery. The full system (mocked + approved in the now-deleted preview):
1. **Quiet contextual invite** (Variant A) — dismissible; appears at earned moments (e.g. after a tournament-roster save → "reuse this next time?").
2. **Dismiss degrades to a faint line** on the Overview ("Team tools available — explore →"), not removal — the on-page thread survives.
3. **Always-present rail "Explore" link** (tertiary, with Help/Feedback) — the permanent rediscovery door.
4. **"Explore" catalog page** — explains the coach-relevant free features in their language, each with a **"Turn on"** action (this is where Tier-2 activation permanently lives), + a **quiet premium nudge** at the bottom ("Running a full season or club? …").
5. **Re-surface on NEW earned moments** — dismissing one nudge stops THAT nudge, but a genuinely new trigger (e.g. registering a 2nd tournament → "reuse last time's roster?") may surface a fresh one (needs per-trigger dismiss tracking — likely a small set in `activated_features`/a dismissed-nudges field, OR localStorage for v1).

### PREVIEW STEP — ✅ DONE + to be deleted
- [x] Built `app/coaches/nav-preview/` (renamed from `_preview` — `_`-folders are non-routable in Next 16). Owner picked Variant A + designed the rediscovery system on it.
- [ ] **DELETE `app/coaches/nav-preview/`** before/at commit (carry the design into the real build below).

### Phase 0.5 — Migration FIRST (DB + dictionary, same unit of work)
- [ ] New migration: add `activated_features` to `basic_coach_teams` (JSONB array or text[], default `'[]'`) — drives Tier-2 nav visibility + persisted-roster opt-in; optionally a `dismissed_nudges` companion (or fold into the same JSON) for re-surface tracking (`supabase/migrations/NNN_*.sql`).
- [ ] Update `docs/agents/db/DATA_DICTIONARY.md` for the new column(s) (schema=dictionary rule; `check:dictionary` gates it).
- [ ] `npm run refresh:snapshots` (dev + prod) — and apply to dev DB (`apply-migration-api.mjs`); **prod apply stays manual/deferred** per release policy.
- [ ] `npm run check:migrations` green.

### Phase 0.6 — `/marketing` subtitle (blocking pre-step)
- [ ] `/marketing` drafts the brand subtitle (working draft: "Your home base for teams & tournaments"). Lock the final string before Phase 2 wires it.

### Phase 1 — Team-context data source (`/api/coaches/basic-teams`)
- [ ] Extend `app/api/coaches/basic-teams/route.ts` GET to return per-team: lifecycle chip (reuse `deriveCoachLifecycleChip`), color seed, **`activated_features`** (for nav visibility), and each team's **registration ids** (for path→team resolution on the record page) (`app/api/coaches/basic-teams/route.ts`, `lib/basic-coach-teams.ts`, `lib/coach-tournament-lifecycle.ts`).
- [ ] Keep the existing `{user, teams, pendingRegistration, alreadyLinked}` shape backward-compatible (callers: register prefill + join flow — verify they don't break).
- [ ] `npm run typecheck` (API/data contract touched).

### Phase 2 — Rail-top team context + section nav (desktop) — needs Phase 0.6 subtitle
- [ ] Rewrite `CoachPortalShell` rail: brand + **subtitle** → **team context** (1 team: name+chip; >1: `<select>` → navigates to that team's Overview, OQ-1) → **Tier-1 section nav** (Overview / Tournaments) → **Tier-2 sections shown only when in `activated_features`** → footer with the **"Explore" link** (`components/coaches/CoachPortalShell.tsx`, `CoachPortalShell.module.css`).
- [ ] Remove the `NAV` "My Teams" entry and the `railTeams` team-list block entirely.
- [ ] Resolve "current team" from the pathname: `/coaches/team/{basicTeamId}` direct; `/coaches/tournaments/{registrationId}` → parent basic team via the registration-ids map from Phase 1.

### Phase 3 — Section SUB-ROUTES (OQ-2 = real routes)
- [ ] Split the standalone team home into sub-routes: `/coaches/team/{id}` (Overview) + `/coaches/team/{id}/roster|schedule|fees|announcements`, each its own page reusing the existing editors (`RosterEditor`/`ScheduleEditor`/`FeeEditor`/`AnnouncementEditor`) (`app/coaches/team/[basicTeamId]/...`).
- [ ] A **Tournaments** route/section = the team-filtered registration list (reuse `RegistrationCard` from `app/coaches/tournaments/page.tsx`).
- [ ] Per-section active-state highlighting (mirror `railLinkActive`).

### Phase 4 — Discovery system (the rediscovery design)
- [x] **Activation write API** `POST /api/coaches/teams/{basicTeamId}/features` (owner-guarded via `requireBasicCoachTeamOwner`; body `{feature, active}`; writes `activated_features` via new `setBasicCoachTeamFeature`). **NEW WRITE PATH → flagged for the /review (higher-risk).**
- [x] **Explore catalog page** `/coaches/team/{id}/explore` — `CoachExploreCatalog` client component: feature explanations + per-feature **"Turn on"** (calls the API → router.refresh + navigates to the section) / "Open →" when already on + the quiet premium nudge (`/pricing?source=coach_explore`).
- [x] **Quiet invite** on the Overview (`CoachOverviewInvite`, Variant A) + its **dismissed→faint-line** degraded state; dismissal persisted in **localStorage** per-team-per-nudge (v1), read hydration-safely via `useSyncExternalStore`. Suppressed during first-run + once roster is activated.
- [x] **Re-surface rule:** the dismiss key is per-`nudge` (`fl_coach_nudge_dismissed:{teamId}:{nudge}`), so a NEW earned trigger uses a new nudge id → re-surfaces even after a prior dismiss.
- [ ] **⚠ KNOWN LIMITATION (accepted-risk, from /review): `setBasicCoachTeamFeature` is a non-atomic read-modify-write** of the `activated_features` JSONB array. Two truly-concurrent toggles of *different* features (e.g. two tabs within ms) could lost-update one. Accepted for v1 — the UX is sequential single-coach clicks that `router.push` away after each activation, so the window is near-zero. Fix recipe if it ever matters: an atomic Postgres RPC using `array_append`/`array_remove` (`UPDATE … SET activated_features = … WHERE id = $1 RETURNING …`). Logged not silently dropped.
- [ ] **⏳ DEFERRED (clean follow-up): the post-roster-save wedge surface** — the second instance of the persisted-roster nudge at/after `TournamentRosterSubmit` ("reuse this roster?") + carry-forward to the next registration prefill. Deferred because it's a registration-keyed surface (needs registration→basic-team resolve) that touches a working submit component, and the core discovery system (Explore + Overview invite) already delivers the wedge. Small isolated add. **TODO: build in a follow-up.**

### Phase 5 — Mobile
- [ ] Mobile top bar: team name + chip; team picker for >1. Bottom nav: active sections only (Day-1 = Overview/Tournaments; grows as Tier-2 activates; ~4 + "More" cap) + Explore reachable (`CoachPortalShell.tsx` mobile blocks, `CoachesBottomNav.tsx`).

### Phase 6 — Zero/empty state & edge cases
- [ ] **Zero teams:** rail = brand + subtitle + a single "Register / Start a team" CTA — no empty switcher, no orphaned sections.
- [ ] **Orphaned registration** (no linked basic team): graceful rail fallback, no crash.
- [ ] Signed-out / mid-hydration: rail still renders without the switcher (preserve today's behavior).

### Phase 7 — Verify & review
- [ ] `npm run typecheck` + `npm run lint:focused -- <changed files>` + `npm run verify:changed` (+ `check:migrations`, `check:dictionary`).
- [ ] **`/review`** — REQUIRED (touches `CoachPortalShell` = every org-less coach page; regression/blast-radius is the priority).
- [ ] **DELETE `app/coaches/nav-preview/`**.
- [ ] Owner browser-test on `dev`: 1-team, multi-team, zero-team, pending vs accepted record pages, Tier-2 activation, Explore page, mobile.

---

## File Map

| File | Change |
|---|---|
| `components/coaches/CoachPortalShell.tsx` | **Core rewrite** — rail team-context + section nav; drop "My Teams" link + team-list; subtitle; mobile |
| `components/coaches/CoachPortalShell.module.css` | New team-context + subtitle styles; remove `railTeams`/`railTeamsLabel` etc. |
| `app/api/coaches/basic-teams/route.ts` | Extend GET to return per-team lifecycle chip (Decision 4a) |
| `lib/basic-coach-teams.ts` | (Maybe) expose registration-ids per team for path→team resolution |
| `lib/coach-tournament-lifecycle.ts` | Reuse `deriveCoachLifecycleChip` (no change expected) |
| `components/coaches/CoachesBottomNav.tsx` | (If reused) mobile section tabs |
| `app/coaches/team/[basicTeamId]/page.tsx` | (If OQ-2 = sub-routes) split sections; else anchor ids only |
| `app/coaches/tournaments/page.tsx` | `RegistrationCard` reused by the team's "Tournaments" section (export if needed) |
| `components/coaches/CoachWelcomeBanner.tsx` / record page | Remove any lingering "Back to Coaches Portal" breadcrumb pattern |

**No DB migration** — no schema change (all data exists: `basic_coach_teams`, `basic_coach_team_users`, `teams`). No DATA_DICTIONARY / snapshot task required.

---

## Open Questions (need owner sign-off before/early in build)

- [ ] **OQ-1 — Where does selecting a team (>1) navigate?** To the team's **Overview** (`/coaches/team/{basicTeamId}`)? Or to its **most-relevant tournament entry** (live/pending record page)? Recommend **Overview** (stable, neutral home).
- [ ] **OQ-2 — Sections as anchor-scroll (single page) or real sub-routes?** Recommend **anchor-scroll for v1** (cheap; the standalone page already stacks them); sub-routes later if it grows.
- [ ] **OQ-3 — Team-context data: extend `/api/coaches/basic-teams` (4a) or new endpoint (4b)?** Recommend **4a**.
- [ ] **OQ-4 — Mobile bottom-nav tab budget** once Tier-2 sections activate. Recommend ~4 visible + "More". Day-1 is only Overview / Tournaments (2 tabs), so moot at first login; fully moot if OQ-2 = single-page anchor-scroll.
- [ ] **OQ-5 — Brand subtitle copy** — "Your home base for teams & tournaments" or a `/marketing` alternative?
- [ ] **OQ-6 — "Home" section:** today there's a top-level `/coaches` Home. In the team-scoped model, is "Home" = the team Overview (drop the separate `/coaches` hub from the rail), or does a portal-level Home survive for the zero/multi-team case? Recommend: rail leads with the team; `/coaches` hub stays reachable only as the zero/all-teams fallback, not a primary nav link.
- [ ] **OQ-7 — Tier-2 activation storage.** How do we persist "which team-ops capabilities this coach has turned on for this team"? Options: a JSON flag set on `basic_coach_teams` (e.g. `activated_features`), a small per-team prefs row, or infer-from-data (a section is "active" if it has content — e.g. roster exists). **Lean: infer-from-data where possible (no schema) + a tiny explicit flag only for the persisted-roster opt-in.** Resolve at build; **avoid heavy schema** (the plan is currently migration-free — keep it that way if feasible).
- [ ] **OQ-2d (preview outcome) — Upsell treatment A vs B** — decided by the PREVIEW STEP, not in advance.

---

## Notes carried from the walkthrough (do not lose)

- **Two "team" concepts** — a tournament registration (`teams` row, what `/coaches/tournaments/{id}` renders) is distinct from a `basic_coach_team`; registrations are grouped UNDER teams by `getBasicCoachTournamentTeamsForUser`. This plan's Decision 1 makes the basic team the rail unit.
- **Branch policy (2026-06-15):** single shared `dev` branch — build directly on `dev`, stage explicit pathspecs, `/review` before commit. (Supersedes the walkthrough's older cherry-pick-onto-dev note and the stale `feedback_branch_per_initiative` memory.)
- **Premium shell is separate** — `CoachesSidebar.tsx` (org-scoped) is untouched.
