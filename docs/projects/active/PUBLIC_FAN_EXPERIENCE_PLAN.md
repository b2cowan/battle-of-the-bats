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

---

## Re-verification vs current code (2026-06-17)

All 57 findings re-checked against current code (7-group workflow + adversarial recheck of every "already fixed / changed" claim). The audit is from 2026-06-11; three fix-projects shipped since (FP-1 Trust & Integrity, FP-3 Volunteer Day-of, FP Tournament Organizer).

- **Already fixed — dropped from scope (2):** **J6-001** (public PII leak — closed by FP-1's `toPublicTeam` sanitizer at the single public chokepoint; confirmed end-to-end, the gate that had to clear). **J6-004** (live-day home dedup/empty-card/dead-tail — resolved).
- **Drop / not a code bug (2):** **J6-009** (field-shortcuts — not reproducible; data-dependent). **J6-055** (final-vs-"TBD" — looks like seed-data artifact; resolves via team lookup. Confirm against live fixture before any change).
- **Partially fixed — reduced scope (8):** J6-002 (LIVE chip now renders; ticker still time-sorts live to bottom + home rows link to schedule top), J6-003 (hero compacts but internal order unchanged), J6-011 (Teams page follow works; schedule prompt visible-but-inert; home/game-detail/standings still no CTA), J6-015 (label ordering fixed; PENDING still renders in a **green** chip on share-card AND OG), J6-026 (profile loading improved; standings/teams still flash empty-state — no initialData passed), J6-028 (followed row starred; "your-team" summary still dead code), J6-031 (pre-game trophy guard added; 1-team-pool-losing-record trophy + eyebrow/H1 dup + legend remain), J6-041 (schedule/home/news/rules dock-compensated; **standings + teams still not**).
- **Still fully open (~43):** the rest, as the audit describes.

## Scope decisions (owner sign-off 2026-06-17)

- **Start with Phase A** (fix-now pair + live-truth root).
- **All 3 heavier PWA "app-feel" items are IN scope** (offline shell J6-044, live OG variant J6-008, branded iOS icon J6-047).
- **Footer absorbed here, per Marketing spec.** Marketing re-reviewed and finalized (in scope, no new pages): (1) wordmark `LOGIC`→`LOGICHQ`; (2) tagline → **"From first registration to final standings — built for the people running community sport."** (rejected the "Canadian volunteers" version — geographic-positioning rule); (3) **remove the dead System column** entirely + drop `status/docs/contact` from `STATIC_ROOTS`; (4) add **"Start Free" → /auth/signup** as first Platform link; (5) rebalance the grid. **Out of scope (needs new pages first):** Legal column (`/privacy`,`/terms`), `/contact`, `/status`, `/docs`. **Owner decision pending:** whether to keep the footer "BUILD: STABLE · NODE: PRODUCTION" strip.

## Living checklist

**Phase A — fix-now + live-truth root**
- [x] **J6-010** team-profile Follow now uses shared `useFollowedTeam` (fires `fl-follow-change` + carries divisionId) → dock summons from shared-link landings.
- [x] **J6-035** register page + `/api/register` consume the lifecycle gate (closed once underway/completed; closed card gains schedule/standings/home links).
- [x] **J6-036** register loading state (no more false "Registration Not Open" flash before data resolves).
- [x] **J6-013** shared `isGameLive` + `publicGameStatus` (live→unofficial→final precedence) in `lib/game-status.ts`, threaded into **every** fan surface: team profile, game detail, OG, schedule rows + scorebug, dock, home My-Team card, teams list, ticker.
- [x] **J6-056** `tournamentToday()` in `lib/timezone.ts`, wired into all fan day-boundary sites: layout dock gate, home content, nav status, ticker, follow `isTournamentInProgress`, schedule, dock, home-card, teams list.
- [x] **J6-022** team profile renders live games as LIVE + polls every 30s (visible-gated).
- [x] **J6-019** game detail badge, status fact, and share/unfurl title now agree (one state, fan vocabulary).
- [x] **J6-039** time-aware NEXT/LIVE selection in dock/home-card/scorebug/teams (past-due unscored game no longer pins as NEXT; LIVE capped to the game window).
- [x] **J6-015** PENDING never emitted on share artifacts → "Unofficial"; green-chip colour bug fixed on OG image + canvas share-card.
- [x] **J6-007 / J6-030** fan-language vocabulary: home Event Snapshot ("Awaiting finals"→"No results yet", "Pending"→"Unofficial", "pending review"/"unscored games"→"unconfirmed"/"not played") and standings now use plain-language tie-breaker labels (Head-to-Head/Run Diff/…) + "Unofficial" everywhere instead of "Pending Review". *(Remaining minor: the bare "T" chip label + breakpoint-aware legend → Phase E polish.)*

> **Phase A COMPLETE** — fix-now pair, register lockdown, one-truth-for-"live" across every public surface, and fan-language status vocabulary. Verified: typecheck + focused lint clean. Browser-verified through fix-now + shared-link surfaces; schedule/dock/home/standings pending a browser pass.
>
> **Adversarial review (2026-06-17, 5 lenses):** 7 confirmed findings fixed — **High:** `forfeit` status now treated as terminal in `isGameLive`/`publicGameStatus` (was reading LIVE in-window / Upcoming after); **Med:** team-profile next-game made time-aware, TeamsContent live-window now uses per-game duration override, schedule scorebug matched to the dock (0–0 for no-score live), team-profile poll given an in-flight overlap guard; **Low:** registration lifecycle gate moved to tournament-tz (page via `registration-state` + API) so it no longer closes ~4–5h early; **Info:** dropped the unused `end_date` from the register query. Re-verified typecheck + lint clean. Out-of-scope/foreign on the shared branch: `FeeEditor.tsx` typecheck error + token-ratchet debt in check-in CSS (not this project).

**Phase B — follow loop — COMPLETE** (typecheck + focused lint clean; browser pass pending)
- [x] **J6-011** front door: tappable schedule team-picker + home empty-state picker (new `FollowTeamPicker`) + follow stars on game detail (new `TeamFollowStar`).
- [x] **J6-028** standings "Your Team" strip (new `MyTeamStandingsStrip`) renders the previously-dead rank/next/latest summary; day-boundary + time-aware fixes folded in.
- [x] **J6-029** followed team highlighted in the playoff bracket (standings + both schedule call sites).
- [x] **J6-040** alerts toggle + unfollow in the dock expanded panel (alerts flag + tournamentId threaded from layout). *(Deferred: the one-time post-follow alerts nudge — small follow-up; the picker exposes an `onFollowed` hook for it.)*
- [x] **J6-012** self-onboarding shared links: team-page share carries `?follow=`; new `FollowDeepLinkPrompt` (layout-mounted) offers a one-tap "Follow [team]?" and strips the param.
- [x] **J6-042** persistent desktop "my team" card in the global side rail across all pages (new `DesktopMyTeamRailCard`; live public rail only, not preview).
- [x] **J6-043** "My Team Games" filter added to the desktop schedule rail (parity with mobile).

> **Adversarial review (Phase B, 3 lenses):** all candidate regressions refuted (hooks order, scope, dock sole-caller, preview gate, null crashes). **1 confirmed Medium fixed:** desktop rail card's next-game fallback was treating a date-only (time-TBD) game as always-upcoming → could surface a past game; now date-guarded like the other surfaces. Browser-verified. Re-checked typecheck + lint clean.
**Phase C — game-day home + arrival** — J6-002, J6-003, J6-005, J6-006, J6-008, J6-014, J6-023, J6-027, J6-045, J6-016, J6-017, J6-018
**Phase D — finale + alerts** — J6-052, J6-025, J6-053, J6-054, J6-024, J6-026; J6-048, J6-049, J6-050, J6-046, J6-051, J6-044, J6-047
**Phase E — polish + footer** — J6-032, J6-033, J6-034, J6-041, J6-057, J6-037, J6-038, J6-031, J6-006, the footer (per Marketing spec), and the remaining PVR design backlog (incl. J6-020).

> **Gate note (2026-06-17):** `verify:changed` is red on a **pre-existing, foreign** token-debt violation (`app/[orgSlug]/check-in/check-in-volunteer.module.css`, from FP-3 gate work) — not from this project. Typecheck + focused lint on this project's changes are green.
