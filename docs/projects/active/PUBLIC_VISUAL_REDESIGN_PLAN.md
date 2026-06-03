# Public Visual Redesign — Implementation Plan

> Goal: make the public tournament experience *stand out* — a premium, broadcast-grade, app-like feel, mobile-first, desktop second. Token-driven so per-org theming + light/dark parity stay automatic.
> Status: planned 2026-06-02. Phased so each phase is independently shippable + greenlightable.

## Context
The public pages are the best-selling feature and now have real-time data, personalization, fan alerts, and a per-tournament PWA. The remaining gap is *visual distinction*: the current design is clean and consistent but utilitarian. This plan elevates it to feel like a premium sports companion app without a ground-up rewrite — most of the leverage is at the token/shared-component layer.

## Hard constraints (every change must respect)
- Use `var(--primary*)` / `var(--glow*)` tokens — never literal hex (per-org theming + light mode flip the same tokens).
- Maintain light/dark parity: any new shadow/highlight/gradient token needs a `[data-color-mode="light"]` counterpart in `app/globals.css`.
- Honor the `data-card-style` org option (glass/outlined/flat) and the mobile bottom nav + `env(safe-area-inset-*)`.
- Gate all motion behind `prefers-reduced-motion`.
- Keep the live diff-merge keys stable so entrance/score animations don't re-fire on polling refresh.

## New/updated design tokens (add to `app/globals.css` `:root` + light-mode block)
- `--score-font` treatment helper class `.score` (mono, `font-variant-numeric: tabular-nums`, tight tracking).
- `--highlight-top: inset 0 1px 0 rgba(255,255,255,0.06)` (+ light-mode `rgba(15,17,35,0.04)`).
- `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)` for playful micro-interactions.
- `--blur-bar: 20px` (single source for frosted chrome) + `@supports` solid fallback.
- Density: `[data-density="compact"]` overrides for row paddings (opt-in).

---

## Phase A — Foundation (system-wide, low-risk, highest leverage)
> **Status: BUILT 2026-06-02 — awaiting browser verification + greenlight before Phase B.**
> Implemented across `app/globals.css`, `lib/themes.ts` (+ both `[orgSlug]` / `[tournamentSlug]` layouts + `lib/tournament-preview.ts`), `components/Navbar.module.css`, `components/BottomNav.module.css`, `app/[orgSlug]/schedule/schedule.module.css`, `app/[orgSlug]/standings/standings.module.css`, `app/teams/[id]/team-profile.module.css`, `app/[orgSlug]/Home.module.css`.
> Implementation notes:
> - **Tabular numerals:** global `.score`/`.tabular` utilities + `font-variant-numeric: tabular-nums` baked into `.data-mono` and each module's numeric classes (incl. `.standingsTable td`). MyTournamentCard inherits via Home.module.css.
> - **Card depth:** `--highlight-top` inner top-highlight token (light-mode counterpart added) on `.card` at rest + hover; `:active` press (neutralised for `data-card-style="flat"`).
> - **Frosted chrome:** single `--blur-bar` source + `-webkit-` prefix + `@supports not (...)` solid `var(--bg)` fallback on `.nav.scrolled`, marketing `.bottomNav`, tournament `.bottomNav` (also moved off a hardcoded rgba to `--nav-mobile-bg` for light parity).
> - **Press states:** `.card`, schedule `.gameRow`, segmented buttons, bottom-nav tabs.
> - **Animated segmented indicator:** inline-grid equal-width segments + sliding `::before` pill driven by `:has(.btn:nth-child(2).active)` + `--ease-spring`; active label flips to `--on-primary`. Applied to schedule `.segmentedControl`, `.mobileStageControl`, and standings `.viewToggle` (each is exactly 2 segments).
> - **Staggered entrance:** `fadeInUp`/`fadeIn` with `nth-child` delay steps on `.gamesList .gameRow`, `.standingsTable tbody tr`, `.scoreList .scoreCard`. Stable React keys (`game.id`/`team.id`) mean live polling reuses DOM nodes → no re-fire. The live score-flash was moved from the row `background` to a `.gameRow::before` overlay so it never collides with / re-triggers the row's entrance `animation`.
> - **Contrast guardrail:** `onPrimaryColor()` in `lib/themes.ts` picks white vs `#0F1123` by luminance → `--on-primary` token, set in all three theming paths; default `#FFFFFF` in `:root`.
> - **Reduced motion:** global `@media (prefers-reduced-motion: reduce)` near-instant snap (keeps `forwards`/`both` end states).
> - Verified: `tsc --noEmit` clean; `eslint` clean (one pre-existing unrelated warning); dev server restarted (rm -rf .next), platform-admin login 200, no Supabase EACCES.

Mostly `app/globals.css` + a few shared components. Ship first.

1. **Tabular numerals** — add `font-variant-numeric: tabular-nums` to a reusable `.score`/`.tabular` utility and apply to scores, records, standings cells, times, countdowns. (`globals.css`; then schedule/standings/team-profile/Home modules + `MyTournamentCard`.) *No `font-variant-numeric` exists today — this is the single highest payoff/effort change.*
2. **Card elevation polish** — add `--highlight-top` inner highlight + optional surface gradient to `.card`; verify across `data-card-style` variants and light mode. (`globals.css`.)
3. **Frosted chrome everywhere** — unify `backdrop-filter` (top nav scrolled, mobile scorebug, sticky date headers, bottom-sheet filters) via `--blur-bar` + `@supports` fallback. (`globals.css`, `SiteChrome`, `schedule.module.css`.)
4. **Tap/press states** — `:active` scale/opacity on `.card`, `.gameRow`, team cards, nav tabs. (module CSS.)
5. **Animated segmented-control indicator** — sliding pill on Pool/Playoff + Standard/Race toggles. (`schedule.module.css`, `standings.module.css`; small JS for indicator position or pure-CSS via `:has`/data-active.)
6. **Staggered list entrance** — `fadeInUp` with `animation-delay` steps on game/standings rows; guard against re-fire on live refresh. (module CSS.)
7. **Contrast guardrails** — derive an "on-primary" text token + a contrast floor so arbitrary org colors stay legible. (`lib/themes.ts` + `globals.css`.)
8. **Reduced-motion** — global `@media (prefers-reduced-motion: reduce)` that disables transforms/odometer/stagger. (`globals.css`.)

**Trade-offs:** frosted bars cost GPU/battery on low-end Android (mitigated by `@supports` fallback); inner highlight must be tuned per mode.
**Verify:** every public page under dark + light + a branded org; confirm no numeral jitter on live score change; reduced-motion off-switch works.

## Phase B — Signature mobile moments (the "wow")
> **Status: items 2–4 BUILT 2026-06-03 — awaiting browser verification + greenlight before Phase C. Item 5 (sticky frosted date chips) deferred to the next pass.**
> Implementation notes:
> - **★ My-Team dock (item 2):** `components/public/MyTeamDock.tsx` + `MyTeamDock.module.css`, mounted globally in `app/[orgSlug]/[tournamentSlug]/layout.tsx`. Self-gating client component — fetches/polls (reuses `usePublicTournamentLive`) and renders **only** when game-day (`inProgress` computed server-side inline, passed as a prop — no client-module import in the server layout) AND a team is followed. Mobile-only (≤900px), frosted (`--blur-bar` + `@supports` fallback), parked above the bottom nav via `calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))`, z-index 150 (below nav 200). Tap-to-expand panel (opponent/venue/start + schedule link). Live score uses `RollingNumber`; otherwise a live countdown.
> - **★ Broadcast card + odometer (item 3):** `components/public/RollingNumber.tsx` (+ CSS) is a stable, reduced-motion-safe digit-roll (tracks prev value in a ref; no roll when a poll returns the same score). `ScheduleContent.renderGameCard` branches to a bolder broadcast card **for LIVE games only** (monogram avatars, big rolling scores, leader emphasis, score-share bar, LIVE chip); final/scheduled stay dense rows so the live game is the single marquee. The card reuses the Phase A `.scoreFlip::before` overlay (own `::before`) so its entrance animation never re-fires. Odometer also wired into the schedule scorebug + desktop rail score. *Decision: broadcast treatment is LIVE-only (not every final) to avoid a wall of giant cards; odometer is for marquee scores, dense rows keep the Phase A score-pop.*
> - **Standings glanceability (item 4):** a desktop-only **diverging run-differential bar** in the RD cell (centre tick; green→right for +, red→left for −; scaled so the pool's largest |RD| fills half) + a **column legend** (`<dl>` REC/W/L/T/RF/RA/RD/PTS) beneath every table. `StandingsContent.tsx` + `standings.module.css`. *An `L5` last-5 form-pips column was built then removed per user feedback — round-robin teams play ≤5 games, so "last 5" duplicates the W-L-T record. Animated rank-change was also dropped (needs prev-rank tracking against live data; revisit).*
> - Verified: `tsc --noEmit` clean; `eslint` clean on new/changed files (2 pre-existing StandingsContent hydration warnings, not introduced here); dev server restarted (rm -rf .next), schedule/standings/news 200, no Supabase EACCES.

2. **★ My-Team game-day dock** — new `components/public/MyTeamDock.tsx`: a now-playing-style bar docked above the bottom nav showing the followed team's live score / next-game countdown, tap-to-expand. Mount in the tournament layout (game-day only via `isTournamentInProgress`), offset against the 72px nav + safe area; reuse `lib/follow.ts` + the live data. *Signature piece.*
3. **★ Broadcast scorecards + odometer** — a bolder live/final game card (monograms, big `.score`, winner emphasis, result bar, LIVE chip) used for live/final while pool rows stay dense; digit-roll on score change. (`ScheduleContent.tsx` `renderGameCard`, `schedule.module.css`; small `components/public/RollingNumber.tsx`.)
4. **Standings glanceability** — inline form pips (last-5 W/L/T dots), diverging run-differential bar, animated rank change. (`StandingsContent.tsx`, `standings.module.css`.)
5. **Sticky frosted date chips** — "TODAY / SAT JUN 7" headers with done/remaining progress. (`schedule.module.css`.) *[BUILT 2026-06-03 — `.dateLabel` sticky+frosted at `top: var(--nav-height)` with a `done/total` chip; `.dateGroup` `overflow:hidden` removed (rows clipped by `.gamesList` instead). Animated rank-change also built (▲/▼ + cell flash on the team cell). Schedule SVG-bracket champion spotlight built. Per-screen standings/teams skeletons skipped — SSR'd pages have no client loading state, so they'd be dead code.]*

**Trade-offs:** taller broadcast cards add scroll — pair with the Phase A density toggle so power users keep compact rows; the dock consumes vertical space (needs collapse + safe-area math).
**Verify:** game-day dock on a live tournament across breakpoints; odometer + pips honor reduced-motion.

## Phase C — Screen depth + identity
> **Status: BUILT 2026-06-03 — awaiting browser verification + greenlight. Two sub-items partially deferred (noted below).**
> Implementation notes:
> - **Broadcast home hero (item 1):** `components/public/CountUp.tsx` (eased 0→n, reduced-motion-safe, animates once) on the Divisions/Teams hero stats; `components/public/Countdown.tsx` (SSR-safe, ticks each minute) drives a pre-event **"First pitch in …"** ticker (targets the earliest scheduled game, falls back to the start date). `Home.module.css`: org-colour **duotone wash** layered over the banner's dark gradient, condensed title (tighter tracking/line-height), and a `:has(.heroBanner)` rule keeping hero text light on the photo even in light mode. `TournamentHomeContent` is a server component → these are client islands.
> - **Bracket polish (item 2):** `PublicBracketView` (standings bracket — clean DOM, already had CSS connectors + coloured badges) gains a **champion spotlight** (decided FIN → gold/warning card with trophy + team badge) and a **mobile swipe carousel** (`.bracketList` → horizontal scroll-snap, rounds peek at 85%). *Deferred: the schedule's `LogicSyncBracket` SVG (separate, finely-tuned, realtime) was left as-is this pass — it already has connectors + trophy + live glow; revisit for the desktop connector/champion parity there.*
> - **Team-profile theming (item 3):** centralized `lib/team-color.ts` (`teamAvatarHue`/`teamColor`/`teamInitials`) and pointed `ScheduleContent` + `MyTeamDock` + the team page at it (fixes the team page using a *different* palette than the schedule). Team color now flows through the whole profile via a `.profile` wrapper var `--team-color` + a colour-mix-derived `--team-accent` (lifts on dark, deepens on light) — hero stat accent, stat-tile accent, next-game row, playoff tag, upcoming badge, follow-active all use it. Fixed a `var(--bg-dark)` ghost token on the active follow button.
> - **Illustrated empty states + skeletons (item 4):** `PublicTournamentState` elevated to an illustrated state (org-colour medallion icon + soft glow, token-driven bg with light parity) — **fixed real ghost-token bugs** (`var(--lime)` undefined → `--primary-light`; hardcoded dark slate bg → `--surface`). This lifts every public empty state at once. Schedule loading skeleton reshaped to match the date-group + game-row layout (avatar/lines/score). *Deferred: full per-screen layout-matched skeletons for standings/teams/home — flagged for the Phase E QA pass.*
> - Verified: Phase C files `tsc` clean + `eslint` clean (one unrelated pre-existing error lives in `lib/import/tournament-schedule-commit.ts`, owned by the parallel importer work); dev server restarted; home (both pre-event + in-progress), schedule, standings, team-profile all 200.


1. **Broadcast hero + count-up** — bolder condensed title, count-up on teams/divisions stats, pre-event "first pitch in…" ticker, duotone org-color image overlay. (`Home.module.css`, `TournamentHomeContent.tsx`.)
2. **Bracket polish** — connected lines + team-color accents + champion spotlight (desktop); swipeable round-by-round carousel (mobile). (`PublicBracketView.tsx`, `LogicSyncBracket`.)
3. **Team-profile theming** — extend the per-team avatar hue into the profile hero/accents so each team page feels like theirs. (`team-profile.module.css`, `app/[orgSlug]/[tournamentSlug]/teams/[id]/page.tsx`.)
4. **Layout-matched skeletons + illustrated/anticipatory empty states.** (`PublicTournamentState`, per-screen skeletons.)

**Trade-offs:** two bracket layouts to maintain (already branch desktop/mobile); illustrations are a design-asset investment.

## Phase D — Bigger bets (optional, sequenced last)
1. **★ Auto-generated share cards** — branded final-score/standings image (client canvas first; OG-image route later for fidelity). New `components/public/ShareCard` + a share action. *Trade-off:* image-gen infra. **[BUILT 2026-06-03 — `lib/share-card.ts` (1080×1080 client-canvas PNG, org-coloured via the live `--primary` var, monogram avatars, FINAL/LIVE chip) + `components/public/ShareScoreButton.tsx` (Web Share API L2 → native sheet, download fallback) on the game-detail page rail when a game has a score. Standings share-image + OG-route = later.]**
2. **Pull-to-refresh** with a branded field-lines loader on public pages. *Trade-off:* touch/scroll conflict engineering (data already live-polls).
3. **Offline shell** — installed app shows cached last scores + offline state. *Trade-off:* service-worker caching strategy + invalidation.
4. **Desktop left-rail app layout** + sticky context header. *Trade-off:* meaningful desktop layout shift.
5. **Per-tournament splash screens + themed status bar**; **opt-in haptics/sound** on score events. *Trade-offs:* iOS splash image tooling; haptics must be opt-in.

## Phase E — Final QA & cleanup (dedicated end-of-project pass)
Even though formatting/consistency nits are fixed continuously ("as we go"), this is a dedicated pass at the end so the project lands in a genuinely shippable state. Runs after Phase C (and whatever of D ships).

1. **Cross-matrix consistency sweep** — every public surface (home, schedule, standings, teams, team-profile, news, rules, game-detail, bracket) walked in the full matrix: mobile + desktop × dark + light × a branded (advanced-branding) org + a default org × each `data-card-style` (glass / outlined / flat). Fix any drift.
2. **Token-compliance audit** — no literal hex / raw rgba in public modules (all `var(--*)`); tabular-nums on every numeric run; `--on-primary` on every `--primary` fill; every frosted bar routes through `--blur-bar` + the `@supports` fallback.
3. **Accessibility pass** — AA contrast on real org colours (incl. the low-contrast floor); visible focus rings; ≥44px tap targets; reduced-motion verified to still settle on final frames; SR labels on icon-only controls + the dock/odometer.
4. **Motion & live-data audit** — confirm no entrance/score animation re-fires on the 30s poll on any page; odometer width stays stable (no numeral jitter); dock never collides awkwardly with the schedule scorebug.
5. **Dead-code / leftover cleanup** — remove unused CSS classes/keyframes left from iterations (retired form-pip styles, old gradients, etc.); reconcile every deferred item (sticky date chips, animated rank-change, season/edition IA) — ship or formally backlog each.
6. **Performance check** — frosted bars + blur on low-end Android; hero overlay/image cost; bundle impact of the new client components (RollingNumber, MyTeamDock).
7. **Polish backlog burn-down** — the accumulated as-we-go list (avatar shape final call, name-truncation policy, monogram quality, empty-state copy, …).
8. **Sign-off** — produce the final per-surface verification checklist, update memory + design-decisions, and archive the plan + PM brief to `docs/projects/archive/`.

## Critical files
- `app/globals.css` (tokens, `.card`, `.btn`, `.badge`, `.display-*`, new `.score`/utilities, frosted, reduced-motion, light-mode parity)
- `components/BottomNav.tsx` + `.module.css`, `components/SiteChrome.tsx` (shell + frosted + active indicator + LIVE pulse)
- `components/public/ScheduleContent.tsx` + `app/[orgSlug]/schedule/schedule.module.css`
- `components/public/StandingsContent.tsx` + `app/[orgSlug]/standings/standings.module.css`
- `components/public/TournamentHomeContent.tsx` + `app/[orgSlug]/Home.module.css`
- `app/teams/[id]/team-profile.module.css`, `components/public/PublicBracketView.tsx`
- New: `components/public/MyTeamDock.tsx`, `RollingNumber.tsx`, (Phase D) `ShareCard`
- `lib/themes.ts` (contrast guardrails), `lib/follow.ts` (dock reuse)

## Verification (per phase)
Run `npm run dev` (restart after new files/shared-module changes). For each phase: walk schedule/standings/teams/profile/home on mobile + desktop, in dark + light, on a branded (advanced-branding) org and a default org; toggle `prefers-reduced-motion`; confirm live score changes animate cleanly with no numeral jitter and no re-fire of entrance animations on poll.
