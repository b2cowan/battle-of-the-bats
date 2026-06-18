# Public Fan Experience — Implementation Plan

> **Status:** **BUILD COMPLETE 2026-06-18 — all phases A–E built on `dev` (local, unpushed), pending a browser/on-device pass.** Spun out of the User Journey Audit (Phase 5, FP-2); **successor to the archived PUBLIC_VISUAL_REDESIGN** (its 32 J6-routed findings reopened + closed here). No DB migrations. Archive after the browser pass + sign-off.
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
**Phase C — game-day home + arrival — COMPLETE** (typecheck + focused lint clean; browser pass pending)
- [x] **J6-003 / J6-002 (home)** game-day home leads with game content (registration block + stat bar demoted off game day); Today's Games rows show a LIVE chip/score and deep-link to the game.
- [x] **J6-002 (ticker)** live games sort first in the ticker.
- [x] **J6-014** venue/diamond on schedule rows (desktop + mobile) + dated NEXT UP (Today/Tomorrow/date + venue) on the scorebug and desktop rail.
- [x] **J6-023** Today/Tomorrow/date qualifier on the team-profile + teams-list next-game callouts.
- [x] **J6-027** "are we making playoffs?" — a one-line **"Top X of Y advance to playoffs"** caption above the full standings tables, + a green check on every team currently **on track to advance** (additive marker, no clash with the gold 1st-place / followed-team accents). Advancing set computed combined for crossover/single-pool formats, per-pool otherwise — matching how the bracket seeds. *(Iterated twice on owner feedback: hand-rolled per-pool cut line → the existing RaceToPlayoffsView podium [too space-heavy] → this compact caption+marker on the full tables. RaceToPlayoffsView left unmounted.)*
- [x] **Schedule controls polish** (browser feedback): List/Bracket display toggle moved up beside Pool Play/Playoffs; team search hidden in the Bracket diagram view (it did nothing there), both mobile + desktop.
- [x] **J6-006** Home/Overview tab added as the first mobile bottom-nav tab.
- [x] **J6-005 / J6-045** install banner engagement-gated (30s on iOS) and suppressed entirely while a team is followed → never covers the dock.
- [x] **J6-008** live OG unfurl variant on game day (LIVE NOW / GAME DAY + game count / top score).
- [x] **J6-016 / J6-017 / J6-018** cross-pool game renders once (home-pool attribution); search datalist suppressed for unpublished/placeholder divisions; clear-search uses the proper icon.

> **Phase C COMPLETE.** Built via a 9-way parallel scout map → applied + corrected (keyed Fragment for the cut-line; per-pool/combined gate; dropped unused vars; typed tuple). Verified: typecheck + focused lint clean (0 errors); token ratchet clean for this project's CSS. The 3 owner-default decisions taken: 30s iOS install delay, champion-card wins over live on the OG, home-pool attribution for cross-pool dedup.
>
> **Adversarial review (Phase C, 3 lenses):** most candidates refuted (colSpan/cut-line placement/per-pool gate correct, DST tomorrow-math safe, OG runtime safe, BottomNav active-state clean). **2 confirmed Mediums fixed:** (1) cross-pool *placeholder*-seeded game double-rendered under both pools → now single-owner by home slot; (2) install banner's follow-suppression was mount-only on iOS AND the new 30s delay leaked into the member/admin/signup shells → now re-checks the follow key at fire time and the engagement delay applies only in the fan tournament context (member shells keep the immediate prompt). Re-verified typecheck + lint clean.
**Phase D — finale + alerts**
- **Finale — COMPLETE** (typecheck + lint clean; browser pass pending):
  - [x] **J6-052** champion banner per division in the completed-home hero (gold) + "Share results" (the link unfurls the existing champion OG card). New shared `lib/champions.ts` (`deriveChampions`/`decidedFinalFor`).
  - [x] **J6-025** champion's own team profile shows a gold "Division Champion" banner + a trophy RESULT tile (runner-up gets a "Runner-up" label) instead of "In playoff spot". API returns `isChampion`/`isRunnerUp`.
  - [x] **J6-053** leftover "Tournament Day" panel suppressed on completed events.
  - [x] **J6-054** completed-event close-the-loop: install prompt + alerts toggle gated off, hero swaps to a "thanks for following" line (registration/stats blocks suppressed). *(Next-event link deferred — tournament-only orgs have no public org page to point to.)*
  - [x] **J6-024** add-to-calendar button on the team profile.
  - [x] **J6-026** standings + teams loading guard (no more "coming soon" flash before data loads).
  - [x] **J6-031** trophy suppressed for a one-team pool / a losing-record leader.
  - [x] **J6-055** scored bracket games with an unresolved slot show the placeholder label (e.g. "Winner SF1") instead of a bare "TBD".
- **Polish (from finale browser test):**
  - [x] On the **Standings page**, the playoff bracket moves **above** the pool tables once the event is completed or the knockout stage is actually underway (stays below during pool play, where seeding is the story). The now-moot "Top X advance" line drops away in that state.
  - [x] **Plain-English round names** everywhere a fan sees a playoff game — "Final", "Semifinal", "Quarterfinal", "Round of 16", "3rd Place", "Grand Final" — replacing insider codes (FIN, SF1, QF1…). One shared helper drives the score cards, Today's-games rows, schedule list, public results page, the game-detail page + its share image, and archived events. Deliberately left as codes: the bracket **diagram** (its columns already read "SEMIFINALS/FINALS" and the slot id matters for the connectors), organizer/admin screens, and the legacy global `/schedule` page.
- **Alerts + offline shell — COMPLETE** (typecheck + focused lint clean; ✅ **browser/on-device verified 2026-06-18**):
  - [x] **J6-050** the alerts toggle now reflects the TRUE state — on load it re-checks the live push subscription + notification permission and drops "Alerts on" back to "Get score alerts" if the subscription was revoked/evicted (no more confident-but-dead button). New shared `lib/fan-alerts.ts` (single subscribe/verify path) + `lib/device.ts`.
  - [x] **J6-048** iOS alerts discoverability: on an iPhone/iPad browser tab the toggle shows an honest "add to home screen for alerts" explainer instead of vanishing (covers iOS <16.4, 16.4+ non-standalone, AND iPadOS desktop-mode); plus a one-time post-install **AlertsNudge** steering a follower to turn alerts on.
  - [x] **J6-049** the "Final:" push now fires on the score-finalization transition (orgs that require organizer approval previously only ever sent an ambiguous "Score update:"). Pending-forfeit "submitted" rows are suppressed so fans never get a misleading "Score update: 1–0" for a forfeit.
  - [x] **J6-046** the install banner no longer promises "alerts" on free-tier events (free → "Live scores & schedule"; Plus → "…& alerts").
  - [x] **J6-051** tapping a score notification focuses the existing app window instead of piling up duplicate tabs (pathname-normalized match), and the notification carries the tournament/org logo (uploaded raster logos only; the SW falls back to the platform icon otherwise).
  - [x] **J6-047** branded iPhone home-screen icon — a generated 180×180 `apple-icon` composites the tournament/org logo on Plus events (raster logos), clean platform default otherwise; hardened (canceled-org 404, proxy proto hop-list, empty-origin + SVG guards, no broken-icon 500s).
  - [x] **J6-044** offline shell — a branded "You're offline" fallback page plus last-good public tournament pages and last-good `/api/public/*` scores cached for offline viewing. Strict per-device **allowlist**: only anonymous public content is ever cached; all authed/operator routes (api, auth, home, my, platform-admin, coaches, team, start, and org admin/coaches/scorekeeper/check-in/official/league) are excluded. Network-first live data, cache-first hashed static, FIFO-capped page cache, no `skipWaiting` (avoids mid-session takeover). New `public/offline.html`.

> **Adversarial review (alerts + offline, 4 lenses → verify):** 29 candidate findings, 15 confirmed and fixed. **High (would have shipped a real leak):** the offline page cache lacked a `/coaches` / `/team` / `/start` / org-`league` guard, so authed portal HTML (incl. PII) could be cached and served offline to the next person on a shared device — denylist now enumerated against the full route tree. **Med:** pending-forfeit misleading push; iPadOS-desktop-mode dead push button; AlertsNudge permanently dismissing on a transient network error; the toggle still appearing on completed events (rail + schedule); push icon breaking on root-relative stock-logo paths; apple-icon proxy-proto hop-list. **Low:** offline SW now returns a real network error (not a fake JSON body) for uncached data, dropped `skipWaiting`, FIFO-capped the page cache, satori SVG guard, ref-mirror correctness. Re-verified: typecheck clean, focused lint clean, no new token violations.

> **Phase D — alerts + offline shell COMPLETE — ✅ browser/on-device verified 2026-06-18.** The four heavier-PWA decisions taken (owner sign-off): offline shell = fallback **+ last-known scores**; iOS alerts = explainer **+ post-install nudge**; branded iOS icon = **generated 180×180**. On-device checks confirmed: PWA install + enable-alerts flow (iPhone + Android), "Final:" push fires on the finalize transition (forfeit sends no misleading score push), notification tap focuses the app + carries the branded logo, permission-revoke flips the toggle back to "Get score alerts", airplane-mode shows last scores on a visited page + the branded offline screen on a fresh one (authed pages never served offline), and the branded iPhone home-screen icon on Plus / clean default on free.
**Phase E — polish + footer — BUILT** (typecheck + focused lint clean; ⚠ browser pass pending). Scope (owner sign-off): core polish + the game-day announcement banner; game-page enrichment (J6-020) deferred.
- [x] **J6-032** (trust) standings consistency — the Teams page cards and a team's own profile now rank from the **canonical** standings engine (head-to-head, run-diff cap, coin toss), the same one the standings table uses, so a card can no longer show a rank that contradicts the table. (Teams section computes standings server-side via a shared helper; team-profile API uses `computeTournamentStandings`.)
- [x] **J6-033** (game-day) pinned announcements (e.g. a rain delay) now surface as a dismissible banner at the top of the **schedule** on game day — no more hunting the News tab. *(News-tab unread badge deferred — it needs a new field threaded through the layout → nav-sync → context → nav plus a last-seen write; more surface area than its additive value, and the schedule banner already covers the urgent game-day case.)*
- [x] **J6-034** rules resources open **inline** in a new tab (PDFs view in the browser instead of force-downloading) + jump-link chips appear above long rule sets (>4 sections) with per-section anchors.
- [x] **J6-006 + nav rebalance** mobile bottom nav now leads with **Home/Overview**; **Rules** moves off the bottom bar (kept at five tabs) and stays reachable via a new "explore sections" row on the Overview + the desktop rail. *(Owner decision: Home replaces Rules on mobile; desktop rail unchanged.)*
- [x] **J6-057** all-pages-hidden edge — the bottom nav is never an empty frosted shell (Home is always present) and the "underway" copy no longer promises a schedule that may be hidden.
- [x] **J6-041** the standings legend / last team card (incl. its Follow button) no longer sit under the game-day dock — bottom clearance added on those two pages, only when the dock can actually appear.
- [x] **J6-031** standings polish — the eyebrow now carries the event name instead of repeating the H1; the stat legend only defines the columns the current breakpoint shows.
- [x] **J6-037 / J6-038** register page — an honest "just following? no account needed" off-ramp for curious parents (links to schedule/standings; hidden for signed-in coaches), and inline hardcoded colors swapped to theme tokens (brand-aware).
- [x] **Footer** (Marketing spec) — wordmark → **FIELDLOGICHQ** (dimmed HQ, matching the navbar), new tagline, dead **System** column removed (+ `status`/`docs`/`contact` dropped from the footer roots), **Start Free** added as the first Platform link, grid rebalanced, and the static **BUILD: STABLE · NODE: PRODUCTION** strip removed (owner decision). Self-referential footer links are filtered out on the page they point to.

> **Adversarial review (Phase E, 4 lenses → verify):** 37 candidate findings, 14 confirmed and fixed. **Med:** rules jump-chips scrolled the target behind the fixed nav (missing `--nav-height` in `scroll-margin-top`). **Low:** multi-pool "not-yet-started pool" sorted by registration order not alphabetically; rules React key/anchor used the title (collision risk) → now the section id; register off-ramp flashed for signed-in coaches before their session resolved → gated on a settled flag; announcement banner `role` upgraded to `alert`; dock clearance was unconditional (dead space when no dock) → gated to game-day-with-follow; legend `display: table-cell` on flex children corrected; footer showed self-referential CTAs on `/auth/*` → filtered; footer/navbar wordmark treatment unified. Refuted the rest (poolId null/undefined, live-poll wiping standings, XSS, grid mobile-safety, etc.). Re-verified: typecheck clean, 0 new lint errors, no new token violations.
>
> **Phase E COMPLETE (pending browser pass).** ⚠ Spot-check in a browser: (1) a team tied on points but separated by head-to-head shows the **same** rank on its card, its profile, and the standings table; (2) post a pinned announcement during a live event → banner appears on the schedule; (3) mobile bottom nav = Home·News·Schedule·Standings·Teams, and Rules is reachable from the Overview; (4) the footer reads FIELDLOGICHQ with Start Free, no System column, no build strip; (5) on a phone, the standings legend / last team card aren't hidden under the game-day dock. **Dev-server restart recommended** (new files + shared-module changes).

> **Gate note (2026-06-17):** `verify:changed` is red on a **pre-existing, foreign** token-debt violation (`app/[orgSlug]/check-in/check-in-volunteer.module.css`, from FP-3 gate work) — not from this project. Typecheck + focused lint on this project's changes are green.
