# Public Fan Experience — Implementation Plan

> **Status:** SCOPED 2026-06-13 — spun out of the User Journey Audit (Phase 5, FP-2). **Successor to the archived PUBLIC_VISUAL_REDESIGN** (its 32 J6-routed findings reopen here). Awaiting owner go-ahead.
> **Branch:** dev. **Companion:** [PUBLIC_FAN_EXPERIENCE_PM_BRIEF.md](PUBLIC_FAN_EXPERIENCE_PM_BRIEF.md)
> **Source of truth:** [journeys/JOURNEY_J6_TOURNAMENT_PARENT_FAN.md](journeys/JOURNEY_J6_TOURNAMENT_PARENT_FAN.md) + [USER_JOURNEY_AUDIT_SYNTHESIS.md](USER_JOURNEY_AUDIT_SYNTHESIS.md) §4 FP-2.

## Goal

The public tournament surface is the platform's best argument and most-shared face. PUBLIC_VISUAL_REDESIGN built the delight primitives (ticker, broadcast rows, RollingNumber, My Team dock) but is archived; J6 found the **truth layer broken under a real delight layer**. This project makes the fan experience honest: one definition of "live," a follow loop with a front door and its payoff, a finale that crowns the champion, and an alerts promise that delivers — while absorbing the 32 design findings PUBLIC_VISUAL_REDESIGN never shipped.

## Scope

Jess's three questions — *is it live & what's the score, when/where do we play next, did we make playoffs* — plus the finale and alerts. Fan-facing tournament public surface only. (The public PII leak J6-001 and the register-account minting are security; J6-001 → **FP-1**; J6-035 register-lifecycle bypass is carried here as a fix-now because it's the fan's accidental-view consequence.)

### Fix-now (carried here)
- **J6-035** — register page + `/api/register` ignore event lifecycle; mid-tournament submission mints a junk reg + coach account. Consume `getRegistrationState` on page + API.
- **J6-010** — team-profile Follow uses drifted `lib/follow.ts` copies that never fire `fl-follow-change`; the dock never appears. One-file fix.

### Workstreams (finding IDs)
- **One truth for "live":** J6-013 (shared `isGameLive` + live→unofficial→final precedence), J6-022 (profile renders in-progress as finished tie + never polls), J6-019 (badge vs facts panel vs share title), J6-039 (time-aware dock/scorebug), J6-016 (cross-pool double-render), J6-015 (never stamp PENDING on share/OG), J6-021 (freshness stamp), J6-049 ("Final:" push), J6-007/J6-030 (fan-language status vocab). Coordinate the day-boundary with the owned UTC family (J6-056 → J5-039).
- **Follow loop — front door + payoff:** J6-010 (fix-now), J6-011 (discoverable prompts + home empty-state picker), J6-028 (render the computed my-team strip), J6-029 (highlight followed team in bracket), J6-040 (alerts CTA + unfollow at high-intent moments), J6-012 (`?follow=` self-onboarding links), J6-042/J6-043 (desktop rail my-team slot).
- **Game-day home + arrival:** J6-002 (live-first ticker + LIVE rows), J6-003/J6-004 (re-sequence live-day home), J6-014 (venue/diamond + dated NEXT UP), J6-023 (dates on next-game callouts), J6-027 (playoff cut line), J6-005/J6-045 (install-prompt engagement gating + dock stacking), J6-006 (mobile Home tab), J6-008 (live OG variant), J6-009 (field shortcuts).
- **Finale:** J6-052 (champion banner + share on completed home), J6-025 (champion profile knows it won), J6-053 (retire leftover day panel), J6-054 (close the loop), J6-055 ("TBD — Final"), J6-031 (trophy-on-losing-record guard), J6-024 (add-to-calendar on profile), J6-026 (loading states).
- **Alerts (Plus):** J6-048 (iOS explainer state), J6-049 ("Final:" fires), J6-050 (ON-state truth), J6-046 (free-event copy), J6-051 (notification tap), J6-044 (offline shell — AP from PVR's own Phase D).
- **Polish:** J6-017, J6-018, J6-032 (three standings engines → canonical), J6-033 (rain-delay banner + announcement push), J6-034 (rules anchors), J6-036/J6-037/J6-038 (register loading/off-ramp/tokens), J6-041 (dock padding), J6-047 (iOS branded icon), J6-057 (all-hidden edge).

## Phases

- **Phase A — fix-now + the live-truth root:** J6-035, J6-010, then J6-013 and the surfaces that consume it (J6-022/019/039/015). The single biggest experience fix.
- **Phase B — follow loop:** discoverability + payoff (J6-011/028/029/040/012/042).
- **Phase C — game-day home + arrival:** re-sequencing + venue/dates + install gating.
- **Phase D — finale + alerts:** champion moment, loop-close, iOS alerts, offline shell.
- **Phase E — polish:** standings-engine consolidation + the remaining design backlog.

## Key decisions

- **Reopen vs rename:** this project IS the successor; PUBLIC_VISUAL_REDESIGN stays archived and is cited, not reopened.
- **`isGameLive` is one shared helper** consumed by ScheduleContent, MyTeamDock, game detail, OG, and team profile — land it with the day-boundary (J6-056/J5-039) so the definition and boundary ship together.
- **J6-001 (PII) is NOT here** — it's FP-1, and must ship before this project's public surfaces are promoted.

## Success criteria

1. One game renders one consistent state across schedule, dock, game detail, OG, and profile.
2. A coach-texted link lands on a page where Follow summons the dock and the bracket highlights the team.
3. The completed home crowns the champion and offers the share.
4. iOS fans can discover and enable score alerts; "Final:" fires correctly.
5. The 32 PVR-routed design items are shipped or explicitly deferred with rationale.
