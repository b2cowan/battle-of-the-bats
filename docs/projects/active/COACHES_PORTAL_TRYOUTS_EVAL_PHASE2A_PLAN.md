# Coaches Portal — Tryouts & Evaluation · PHASE 2A — Implementation Plan

> **Status:** IN PROGRESS on `dev` (greenlit 2026-06-30). **Data foundation BUILT + verified**; UI slices next.
> **Created:** 2026-06-30
> **Branch:** dev
> **Parent plan:** `COACHES_PORTAL_TRYOUTS_EVAL_PLAN.md` (Phase 2A); model in DB_ARCHITECTURE_REVIEW Finding #30; UI direction in `memory/design_decisions.md` (2026-06-30 tryout-day entry).

## Goal
Build the "replace paper on tryout day" MVP: a dedicated tryout workspace (settings + scheduled date/time blocks that show on the calendar), mobile day-of check-in with auto bib numbers + walk-up add, blind-by-default display, a provincial tryout-window heads-up, and a printable candidate sheet. Coach-facing only; scoring/ranking is Phase 2B.

## Confirmed model (DBA Finding #30)
- **`rep_tryouts`** — the tryout workspace, 1:1 with a program year; holds blind-mode (`is_anonymous` default true) + reserved 2B score-lock; FK anchor for sessions + all 2B tables. Created lazily.
- **`rep_tryout_sessions`** — date/time/location blocks (multi-day). The schedule view **projects** these onto the calendar at read time — NO `rep_team_events` row (single source of truth; tryouts excluded from game W-L/next-event by construction).
- **`rep_tryout_registrations`** (existing candidate pool) gains `bib_number`, `is_checked_in`, `checked_in_at` (one per candidate per tryout, V1).
- All new tables **RLS-enabled, no policies** (service-role only). `tryout_open`/`tryout_description` stay on the program year for V1.

## Design map (approved 2026-06-30, `/design`)
Reuse only — no new tokens/primitives: CollapsibleCard/section (setup card) · EventChip idiom (session rows + the read-only "Tryout" schedule chip, distinct accent + clipboard badge, no score) · HelpCallout `warning` (provincial-window notice) · the Registration `[●ON]` toggle (blind toggle, its sibling) · `sheetOnMobile` bottom-sheet (walk-up add) · safe-area sticky action bar (print) · btn-lime/ghost · ConfirmProvider (reserved for 2B reveal) · existing branded PDF export (manifest, light theme). **Blind = an unmistakable mode:** persistent "Blind · names hidden" chip (neutral, not amber), bib-first identity, names absent (never faked). **Check-in control:** whole-row tap, ~56px row / ≥48px control (field-side exception to the 40px floor), three cues (fill/outline + icon + label + lime left-border — color never alone), brief Undo on mis-tap. Lime for fills/borders/CTAs only; `--success`/`--white-90` for the "Checked in" label (sunlight contrast).

## Phases / tasks

### 2A.0 — Foundation ✅ DONE (dev, verified)
- [x] **Safety pre-check** — confirmed `rep_tryout_registrations` RLS = ENABLED (dev+prod); no pre-existing leak.
- [x] **Migration 165** (applied dev): `rep_tryouts`, `rep_tryout_sessions` (RLS-enabled, indexed, FK), `rep_tryout_registrations` + bib/check-in. Snapshots #165, dictionary green.
- [x] **Types** (`RepTryout`, `RepTryoutSession`, `RepTryoutSessionStatus`; bib/check-in on `RepTryoutRegistration`).
- [x] **Data layer** (`lib/db.ts`): mappers; `getRepTryout`/`getOrCreateRepTryout` (idempotent, race-safe)/`updateRepTryout`; sessions `get`/`getForTeam`(calendar projection)/`create`/`update`/`delete`; `updateRepTryoutCheckin` (bib + check-in stamp).
- [x] **Verify** — lint 0-err, typecheck clean.

### 2A.1 — Tryout setup card + sessions ✅ BUILT + verified (dev) — **in the Premium Coaches Portal**
- [x] **SURFACE DECISION (owner, 2026-06-30):** tryout-day tooling lives in the **Premium Coaches Portal** (new `…/coaches/teams/[teamId]/tryouts` page + "Tryouts" nav in sidebar & mobile More), run by the **assigned coach** — and for **club-run teams the assigned coach manages tryouts** too (a new coach capability, consistent across standalone + club). *Corrected from an initial admin-Rep-Teams placement* (there was no coaches-portal tryouts surface; the owner chose the portal to match the project premise). The existing admin Rep Teams intake (registration toggle, applicant review) is untouched.
- [x] Coach-scoped API: `…/api/coaches/[orgSlug]/teams/[teamId]/tryout-sessions` GET/POST/PATCH + `[sessionId]` PATCH/DELETE — `getAuthContext` + assigned-coach gate (`getCoachingAssignmentsForUser`) + **active program year** + org/team ownership (mirrors the attendance route). Fail-closed (org-context guard ✓). Orphaned admin-scoped routes removed.
- [x] Self-contained `components/rep-teams/TryoutDayCard.tsx` (+ module CSS), now driven by an `apiBase` prop (surface-agnostic): session list (date·time·location, edit/remove), Add/Edit session modal (date-time + location/field/label) with the provincial-window HelpCallout, Blind toggle (default ON, design-spec'd), lazy tryout-workspace create. Rendered on the new coaches Tryouts page.
- [x] **Verify** — lint 0-err, typecheck clean, org-context guard clean.
- [ ] Deferred polish: pass the team's `sport` to the window check (defaults to softball today); "Open day-of check-in" CTA lands with 2A.3.

### 2A.2 — Provincial tryout-window date check ✅ BUILT (dev)
- [x] `lib/tryout-windows.ts` (sport-keyed, Ontario V1: OBA / Softball Ontario, Jul 1–Sep 14, app-config not DB) + non-blocking `HelpCallout warning` in the session form when the date is outside the window ("ignore if not affiliated" framing).

### 2A.3 — Day-of check-in (mobile hero) ✅ BUILT + verified (dev), reviewed
- [x] Coach-scoped API: `tryout-candidates` GET (active candidates + auto-assigned sequential bibs + blind flag) / POST (walk-up add → checked in) + `[registrationId]` PATCH (check-in toggle); assigned-coach + active-program-year + per-registration org/team ownership; fail-closed (org-context ✓).
- [x] `getRepTryoutCheckinList` — auto-assigns bibs to candidates missing one (sequential by submission, stable once set), returns active (non-declined/withdrawn) sorted by bib.
- [x] Mobile check-in view (`TryoutCheckIn` + module CSS) + route `…/tryouts/check-in`: sticky `X/Y checked in` + progress bar · blind "names hidden" chip (bib-first) · search (bib when blind, name+bib otherwise) · **big-tap three-cue rows** (lime left-border + filled check + "Checked in" label / outline circle + "Tap to check in") · **Undo** for ~3.5s after a check-in · walk-up bottom-sheet (player name + optional guardian email → added & checked in). "Open day-of check-in" CTA wired from the setup card.
- [x] **Verify** — lint 0-err, typecheck clean, org-context clean (202 routes).
- Note: walk-ups store **empty guardian fields** (player name is enough at the diamond; guardian details added later) — no migration needed; minor data-quality tradeoff, fine pre-offer (Phase 2B).
- [ ] Deferred to 2A.4: the sticky "Print roster sheet" action (needs the manifest PDF).

### 2A.4 — Printable manifest ✅ BUILT · Schedule projection ✅ BUILT
- [x] **Printable candidate sheet** — a "Print sheet" action on the check-in screen builds a branded PDF (Bib · [Player] · Age · In · Notes; **bib-only columns when blind**, blank In/Notes for pen) via the existing `downloadPDF` (FieldLogicHQ-branded default; org-branded settings = later polish).
- [x] **Schedule projection** (built once the foreign schedule rework was committed — clean baseline `206437dd`/`928f60e8`): the coach schedule (list/week/month) now reads the active tryout's sessions and renders each as a **distinct read-only "Tryout" chip** (dashed muted accent + clipboard, `TryoutChip`) that **links to the Tryouts tab** — never a game, never opens the event editor, and excluded from W-L/next-event by construction (separate table + read-time projection, no `rep_team_events` row). Non-fatal fetch (schedule still works if it fails). Lint 0-err, typecheck clean, token ratchet clean.
- Note: uses per-session wall-clock slicing (same TZ-safe approach as the review fix), no new tokens (dashed rgba accent).

**Phase 2A FUNCTIONALLY COMPLETE** — a coach can run tryouts end-to-end: set up sessions → mobile day-of check-in (bibs, walk-ups, blind) → print the sheet → see tryout dates on the team calendar.

### Closeout (2026-07-01)
- **Help docs:** ✅ new "How to run tryout day" recipe added to the Coaches Portal help ("Your team tools") + 2 FAQs (blind evaluation; where families register vs. coach runs the day). Flows to the support mirror; lint clean. **+ wired the in-context "?" HelpButton on the Tryouts page** (was missing — content existed but no on-screen drawer trigger), pointing at `recipe-run-tryouts` (provider already mounted in the coaches layout). (Optional follow-up: add a "?" to the day-of check-in screen too.)
- **Final `/review`:** ✅ done. Access control on the check-in + candidate API came back **clean** (mirrors the cleared session pattern; IDOR airtight). Schedule projection = **cleanly additive, no event regression**. Fixed: (1) [Med] list-view month grouping used a TZ-sensitive `new Date` for tryout sessions → now wall-clock `slice(0,7)` (consistent with week/month); (2) [Med] walk-up now rejects a typo'd guardian email (was stored unvalidated, could reach the roster on accept).
- **⚠ KNOWN LIMITATION → fix in Phase 2B:** `getRepTryoutCheckinList` auto-assigns bibs on load with **no DB uniqueness guard** — two coaches opening check-in simultaneously (before any bib exists) could assign **duplicate bibs**. Low-probability (tryout day = one coach/one device) + cosmetic; proper fix = `UNIQUE(program_year_id, bib_number)` + move bib assignment off the GET into an explicit step (fold into 2B when the evaluator/scoring infra lands). Also noted (advisory, no action): walk-up allows an empty last name (intentional — name-only at the diamond); `getRepTryoutRegistration` masks infra errors as 404 (pre-existing shared pattern).

## Guardrails (binding)
- New tables stay RLS-enabled-no-policies; all writes via service-role coaches-portal routes (team-entitlement auth).
- Sport-neutral: manifest position labels via the Sport Pack.
- Mobile field-side: the 56px/48px check-in exception; color-never-alone; sunlight contrast.
- Schema=dictionary same unit of work (already synced for the foundation).
- ⚠ **Before promote:** apply mig 165 to PROD (dev-only now). ⚠ **Before browser test:** dev-server restart (shared modules + new tables).

## Open items
- [ ] Bib type is `text` (alpha-capable; app sorts numerically) — confirm acceptable vs numeric-only.
- [ ] Gating: included in Premium Coaches Portal (logged) — confirm at build via `/billing`.
- [ ] Phase 2B (NOT now): rubric, multi-evaluator scoring (+REPLICA IDENTITY FULL), ranking board, one-click accept-to-roster (wrap the non-transactional accept), offer/release emails — all anchor on `rep_tryouts`.
