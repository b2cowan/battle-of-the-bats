# Build Prompt — The Flip, Phase 3: the coach (both tiers) + scorekeeper side

Paste this into a fresh chat to build Phase 3 of the ratified Role⇄Public navigation project.
Phase 1 (admin) + Phase 2 (public) are COMMITTED on `dev`:
- P1: `cb52d118` + `c043736` (admin loop + shared admin header)
- P2: `1d40816c` (public chip→pill, sheet retire, Overview share, coach alerts relocate, See-it-live highlight) + `f0e5b03f` (mobile compact-pill polish) + `bfa55296` (help-docs resync)

---

You are building **Phase 3 of "The Flip"** — the COACH pages (free + premium) and the SCOREKEEPER shell. A coach or official gets the SAME shared ⇄ flip pill to reach the public side of their event.

## ⚠ FIRST — the coach model is CONTEXTUAL, not shell-wide (owner correction 2026-07-24)

The coach flip is **NOT** a constant shell-level presence like the admin header. The coach portal is a **team-management** surface — most of it (roster, lineups, attendance, player development, documents, settings, accounting, tryouts, season history, announcements) has **no public-tournament counterpart**, so a "flip to the public event" toggle there is meaningless. The flip appears **only on coach pages that already have a tournament context**, and links to *that* event:

**GETS the flip:**
- The team's **tournament record** page (a specific registered event) → flips to that event's public page (the "check my fees ↔ see us live" loop).
- The team **Overview**, ONLY when the team is in a live/upcoming publicly-visible tournament (the overview already computes this) → flips to that event. No live event → no pill.
- The **Tournaments** list → each row's existing "Fan view" link becomes the flip to that specific event (no single shell pill — it's a list).

**DOES NOT get the flip:** Roster, Lineups, Attendance, Player Development, Documents, Settings, Accounting (all), Tryouts, Season History, Announcements. (Team Chat already has its own event chip — leave it.)

**Consequence (this makes P3 SIMPLER than the earlier scoping feared):** the flip lives on pages that **already know their tournament**, so there is **NO new premium mobile top bar** and **NO shell-wide context plumbing** — both were only needed for a constant presence, which is now rejected for coaches. Scorekeeper is the one shell that stays constant (below).

## ⚠ SECOND — STOP and validate before writing code (hard gate)

Before ANY implementation, present to the owner in chat and get approval:
1. A **PM UX brief** (plain-language) of the new coach + scorekeeper behavior.
2. A **page-by-page flip map** — the exact coach pages that get the pill vs. don't (confirm against the lists above; the owner may adjust).
3. **Mockups** (an HTML artifact, per the artifact-design skill) of: the coach **tournament record** page with the pill, the **Overview** live-tournament state with the pill, and the **scorekeeper** header with the pill (single + the multi chooser). Show a non-tournament coach page (e.g. Accounting) with **no** pill, to confirm the contextual logic reads right.
This is a blocking step — no code until the owner signs off on the map + mockups.

## Read first (in this order)
1. `docs/projects/active/ROLE_FLIP_NAVIGATION_PLAN.md` — §5 "P3", §3 (coach twins — ⚠ its "other coach pages → public Overview fallback" is SUPERSEDED by the contextual model above), §4 (constraints).
2. `memory/design_decisions.md` — the 2026-07-22 ratification + 2026-07-23 uniform-label/mobile-icon-only decisions + the 2026-07-24 coach-contextual + scorekeeper-chooser decisions. Binding.
3. The committed shared engine you build ON (do NOT re-derive):
   - `lib/flip-twins.ts` — the resolver. `resolveToPublic` branches `hat 'coach'/'official'` → public Schedule; ⚠ **no-tournament bug** (scope #1). `multi` chooser + `primaryTarget` already exist.
   - `components/shared/FlipPill.tsx` (+ `.module.css`) — the ONE shared control: `multi` popover chooser, ≤900px icon-only short pill, return-memory read (arrival-page-only), same-tab, `stampReturn`. Do NOT re-style per surface.
   - `lib/use-admin-flip.ts` — the adapter pattern.
   - `lib/coach-alert-registration.ts` — `pickAlertRegistration(history)` → `{ registrationId, orgSlug, tournamentSlug }` (already used by both coach overviews; reuse it).
4. `git status` + `git log --oneline -8` — `dev` has concurrent work; work on `dev`, explicit pathspecs only, **NEVER commit without an explicit owner OK**.

## Recon (already done — build on this)
- **Coach tournament-context pages already carry the data.** The premium Overview (`app/[orgSlug]/coaches/teams/[teamId]/page.tsx`) computes `alertRegistration` via `pickAlertRegistration`; the free Overview (`app/coaches/team/[basicTeamId]/page.tsx`) computes `fanViewEntry`. The shared **tournament record** component (`components/coaches/CoachTournamentRecord.tsx`, server, both tiers) resolves `org`/`tournament` per registration and already builds public deep-links (per-game `…/schedule/{gameId}` ~line 225, `standingsHref`/`shareUrl` ~375-376 rendered by `TeamHQ.tsx:498`). The **Tournaments** list pages (`…/tournaments/page.tsx` both tiers) already render per-event "Fan view" links. → **All the tournament context the flip needs is already on these pages** — no shell plumbing.
- **Fan-view links (all plain `next/link`, same-tab already):** free Overview `fanViewEntry` (`app/coaches/team/[basicTeamId]/page.tsx` ~291-300); free Tournaments list (`…/tournaments/page.tsx:82-91`); premium equivalent. Route each through `resolveFlip` so they can't drift from the pill; keep them as in-content links.
- **Scorekeeper** (`app/[orgSlug]/scorekeeper/layout.tsx:77-125`): inline sticky header, right cluster (conditional "Check-In →", `FeedbackLauncher`, `ShellSignOutButton`). No public link exists — the pill is **ADDED**. ⚠ The client gets only `tournamentIds: string[]` + `tournamentName` per game — **no slug**; the score API (`app/api/official/[orgSlug]/score/get-score.ts:210`) doesn't `.select` slug; and an unscoped volunteer pulls **every active org tournament** → can span 2+ live events.
- **Warm theme = ZERO pill work** — the FlipPill's neutral tokens already remap under the coach warm gate (`app/globals.css` `html[data-user-theme="warm"] [data-coach-warm-enabled]`), and both shells carry the marker.

## Scope

1. **`lib/flip-twins.ts` — no-tournament fallback (+ tests):** `resolveToPublic` for `hat 'coach'/'official'` with an empty `tournamentSlug` emits a broken `/{org}//schedule`. Add: no `tournamentSlug` → org public root `/{orgSlug}`. (Safety even though the contextual model rarely hits it.) Add the scorekeeper `multi` chooser resolution (one target per tournament) — reuse existing `multi`/`FlipTarget`/`primaryTarget`.

2. **Coach flip — page-level, on the tournament-context pages only:**
   - **Tournament record page** (`CoachTournamentRecord.tsx`, both tiers): add the `FlipPill` to its header, resolving to that event's public page via `resolveFlip` (the page already has org+tournament + game context). Single-source the existing hand-built public links through the resolver.
   - **Overview** (both tiers): when a live/upcoming publicly-visible tournament exists (the `alertRegistration`/`fanViewEntry` already computed), show the pill near that surface → flips to the live event's public page. No live event → no pill.
   - **Tournaments list** (both tiers): route the per-row "Fan view" links through `resolveFlip` (kept as in-content links).
   - Use `variant="inline"` (auto icon-only ≤900px). Warm-native (no work). NO shell chrome, NO new mobile top bar, NO shell-wide `useCoachFlip` context fetch.

3. **Scorekeeper (`app/[orgSlug]/scorekeeper/layout.tsx` + score API):** constant header pill (the whole shell is tournament-scoped, like admin). Add `slug` to the tournaments `.select(...)` and thread `{ id, name, slug }` to the client (**NO migration** — the column exists). Single tournament in view → direct public Schedule; 2+ → the `multi` **chooser** popover, one row per tournament (owner call 2026-07-24). Official scope re-auths on arrival (pill only reveals doors).

4. **Same-tab everywhere; no `target="_blank"` in the flip loop** (coach/scorekeeper chrome already has none to strip — verify).

## Binding decisions
- **Coach flip = CONTEXTUAL** (tournament-context pages only; NO shell chrome; NO new mobile top bar) — owner 2026-07-24.
- **Scorekeeper = constant header pill, WITH the chooser** for 2+ concurrent tournaments — owner 2026-07-24.
- **Brief + page-map + mockups approved by the owner BEFORE any code** (hard gate above).

## Constraints
- **NO schema migration** (scorekeeper slug is a SELECT/prop change; coach context already on-page).
- Do NOT re-style the pill per surface — the ONE shared `FlipPill` (icon-only mobile + chooser) is inherited as-is (constant look everywhere it appears).
- Sport-neutral; CSS modules; match surrounding style; token-first for warm-awareness.
- `npm run verify:changed` + `npm run typecheck` (shared modules: flip-twins, the score API, `CoachTournamentRecord`/`TeamHQ`). Dev-server restart rule if new files/shared modules change.
- After building: `/simplify`, then `/review` (HIGH — auth-adjacent flip targets + the scorekeeper data change + the resolver change), then `/docs` (coach guide gets the contextual flip; scorekeeper guide gets its pill).

## Definition of done
- A coach sees the ⇄ pill ONLY on tournament-context pages (record, live-tournament Overview, tournaments-list rows) — identical to the admin/public pill, same corner — and NOT on roster/accounting/tryouts/etc.
- One tap flips to that event's public page, same-tab, page-matched, with return-memory "⇄ Back to …" on arrival.
- A scorekeeper sees the pill in the header on every screen; one live tournament flips direct, 2+ opens the chooser.
- No broken `//schedule` href anywhere; typecheck + verify:changed green; NO migration; NOT committed (owner reviews first).

## Owner QA slice (phone, installed app, dev org)
1. Coach (both tiers): tournament **record** page → pill → that event's public page → "⇄ Back to …" returns exactly. Confirm the pill looks identical to admin/public + same corner.
2. Coach Overview: with a live tournament → pill present, flips to the live event; a team with NO live tournament → **no pill**.
3. Coach on **Accounting / Tryouts / Roster** → **no pill** (contextual logic holds).
4. Scorekeeper covering ONE tournament → pill goes direct; covering TWO → pill opens the chooser, each row lands on the right event.
5. Same-tab everywhere; signed-out/no-hat sees no pill.
