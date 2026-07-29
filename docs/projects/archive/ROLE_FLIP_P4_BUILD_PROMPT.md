# Build Prompt — The Flip, Phase 4: multi-hat lateral moves + edge sweep + close-out

Paste this into a fresh chat to build the FINAL phase of the ratified Role⇄Public navigation
project. P1–P3 are COMMITTED **and SHIPPED to prod** (promote `f064712d`, tag release/2026-07-23):
- P1: `cb52d118` + `c043736c` (admin loop + shared admin header)
- P2: `1d40816c` + `f0e5b03f` + `bfa55296` (public pill, sheet retire, mobile icon-only, help resync)
- P3: `31bba4c5` (contextual coach flip: record-page pill → event front page, overview
  CoachLiveEventCard + shared FanViewLink on all lists, record-aware public→coach landings via
  `tournament-viewer-hats`; scorekeeper header pill + 2-event chooser; push-hang fix)

P4 is deliberately LIGHT: no migration, no new visual language, no restyling of the shared pill.
Present a short **PM brief in chat before coding** (AGENCY_RULES blocking step). No mockup gate —
every surface reuses the shipped popover/pill; if any genuinely NEW visual emerges, stop and mockup
it first.

## Read first (in this order)

1. `docs/projects/active/ROLE_FLIP_NAVIGATION_PLAN.md` — §5 P4 (the scope), §1 (the ratified
   popover model: destination-labeled rows), §3 (staff scoping + hidden-tabs notes, the REVISED
   coach twins), §9 (owner QA script).
2. `memory/design_decisions.md` — the 2026-07-22 ratification + every P3 rev entry (2026-07-23):
   uniform "Public site" label, mobile icon-only, contextual coach model rev-3→rev-6 (coach lands
   on the event FRONT PAGE; official on Schedule; overview alerts row REMOVED — do not resurrect).
3. The shipped engine (build ON it, do NOT re-derive): `lib/flip-twins.ts` (resolver: staff
   nearest-permitted logic + tests ALREADY EXIST — `allowedAdminScreens`; `resolveScorekeeperFlip`;
   optional pathname), `components/shared/FlipPill.tsx` (multi popover with `label`/`sublabel`
   rows), `lib/use-admin-flip.ts`, `lib/use-public-flip.ts` (NB: it forwards coach/official hrefs
   from the viewer API and does NOT fetch staff scope — that's P4 work), `lib/tournament-viewer-hats.ts`
   (server hat resolver — hats now carry record-aware coach hrefs), `components/volunteer/ScorekeeperFlip.tsx`.
4. `git status` + `git log --oneline -5` — shared `dev` branch rules: explicit pathspecs, re-check
   HEAD, NEVER commit without an explicit owner OK. TODO.md + memory/design_decisions.md may carry
   other chats' uncommitted entries — leave them out of your commits.

## Scope (4 work items)

**WI-1 — Multi-hat lateral moves inside the shells.** Today the Roles chooser exists only on the
PUBLIC pill; inside a shell the pill only flips to public, so an admin-who-also-coaches goes
Admin → public → Coach. Add the other hats as rows in the SHELL pills' popover, per the ratified
model: one row per hat held on THIS event, destination-labeled, same-tab, return-memory stamped.
- Admin header pill (tournament screens): if the signed-in user also holds a coach/official hat on
  the tournament in context, the pill becomes `multi`: `Public site` row (page-matched, existing
  behavior) + lateral rows (e.g. "Coach — {team}" → the record page; "Scorekeeper" → the shell).
  Hat resolution is server-side (`getTournamentViewer` already computes exactly this, with
  record-aware hrefs) — decide the cheapest wiring (server-feed via the admin layout vs a small
  client fetch mirroring the public flow) and justify it in the PM brief. Do NOT add per-page
  fetch waterfalls; the admin header is on every screen.
- Coach record-page pill + scorekeeper pill: same treatment where the user holds other hats on
  that event (coach→admin is the valuable direction; keep it symmetric if cheap, but do not
  invent context the page doesn't have — the coach record knows its ONE event; the scorekeeper
  chooser composes: tournaments first, lateral rows appended only if unambiguous).
- Single-hat users see ZERO change (pill stays a plain link). That is the acceptance bar.

**WI-2 — Staff scoping on the public→admin flip (P2 leftover).** `resolveToRole` +
`nearestPermittedScreen` + tests already exist; the public pill never feeds them because the
viewer API doesn't carry the staffer's permitted screens. Extend the admin hat's context in
`tournament-viewer-hats.ts` (backward-compatible, like the P2 context extension) so a
capability-limited staffer flips to their nearest permitted screen instead of bouncing off a
redirect on arrival. Auth stance unchanged — the destination still re-auths; this only removes the
wrong-door hop.

**WI-3 — Hidden-tabs + finished-tournament edge sweep.** The organizer can hide public pages
(`public_hidden_pages`); the admin→public resolver page-matches without checking, so admin
Communication → public News can land on a hidden page. Thread the hidden set into the resolver ctx
(the admin tournament context already loads the tournament row) and fall back to the event front
page when the twin is hidden (never absent, never a wrong guess — the ratified fallback). Add
resolver tests. Then SWEEP (verify + fix only if broken, cite evidence): finished/archived
tournaments round-trip read-only; drafts still route to preview; offline/failed viewer fetch keeps
the public header clean (existing no-mount behavior); the scorekeeper pill's org-root fallback.

**WI-4 — Close-out.** (a) `/docs`: audit the ADMIN guide for the P1-era changes (bell → More row +
badge, View-Site retirement, the flip) — the tournament + coach guides were synced in P2/P3;
sync whatever the popover gains in WI-1. (b) Run the plan §9 owner QA script end-to-end and hand
the owner the device checklist, including the **return-memory PWA verification on PROD**
(installed app, Android + iOS): if "⇄ Back to …" proves flaky on-device, the ratified fallback is
stateless-only — flag, don't silently ship flaky. (c) Close the plan: move
`ROLE_FLIP_NAVIGATION_PLAN.md` + `_PM_BRIEF.md` (+ the P2/P3/P4 prompts) to
`docs/projects/archive/` once the owner accepts, update TODO.md + the auto-memory topic
(`project_role_flip_navigation`) to COMPLETE.

## Constraints

- NO migration. NO change to FlipPill's styling or the shared popover look — lateral rows reuse
  the existing row/sublabel styles. Fans and single-hat users byte-identical.
- The uniform-label rule stands: the pill face reads "Public site"/"Preview site" (or "Roles"-style
  chooser face when multi) — destinations live in rows/hrefs, not the pill face.
- Resource-aware checks: `npm run verify:changed` + `npm run typecheck` (flip-twins + viewer API +
  admin header are shared); `node --test lib/flip-twins.test.ts` (27 pass today — extend, keep green).
- Funnel after building: `/simplify`, then `/review` HIGH (viewer-API context extension +
  hat-resolution wiring are auth-adjacent), then `/docs`. Dev-server restart rule on shared-module
  changes. NOT committed without an explicit owner OK (pathspecs only).

## Definition of done

- A two-hat user opens the pill in ANY shell and laterally jumps to their other role on that event
  in one tap (destination-labeled); single-hat users see exactly today's behavior.
- A capability-limited staffer flipping from public lands on their nearest permitted admin screen.
- No flip can land on an organizer-hidden public page; finished/draft/offline edges verified with
  evidence.
- Admin help guide matches the shipped chrome; resolver tests green; owner QA script executed;
  device return-memory verdict recorded (keep or stateless-fallback).
- Plan + prompts archived, TODO + memory closed out — The Flip project COMPLETE.
