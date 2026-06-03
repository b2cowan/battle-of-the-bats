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
2. **★ My-Team game-day dock** — new `components/public/MyTeamDock.tsx`: a now-playing-style bar docked above the bottom nav showing the followed team's live score / next-game countdown, tap-to-expand. Mount in the tournament layout (game-day only via `isTournamentInProgress`), offset against the 72px nav + safe area; reuse `lib/follow.ts` + the live data. *Signature piece.*
3. **★ Broadcast scorecards + odometer** — a bolder live/final game card (monograms, big `.score`, winner emphasis, result bar, LIVE chip) used for live/final while pool rows stay dense; digit-roll on score change. (`ScheduleContent.tsx` `renderGameCard`, `schedule.module.css`; small `components/public/RollingNumber.tsx`.)
4. **Standings glanceability** — inline form pips (last-5 W/L/T dots), diverging run-differential bar, animated rank change. (`StandingsContent.tsx`, `standings.module.css`.)
5. **Sticky frosted date chips** — "TODAY / SAT JUN 7" headers with done/remaining progress. (`schedule.module.css`.)

**Trade-offs:** taller broadcast cards add scroll — pair with the Phase A density toggle so power users keep compact rows; the dock consumes vertical space (needs collapse + safe-area math).
**Verify:** game-day dock on a live tournament across breakpoints; odometer + pips honor reduced-motion.

## Phase C — Screen depth + identity
1. **Broadcast hero + count-up** — bolder condensed title, count-up on teams/divisions stats, pre-event "first pitch in…" ticker, duotone org-color image overlay. (`Home.module.css`, `TournamentHomeContent.tsx`.)
2. **Bracket polish** — connected lines + team-color accents + champion spotlight (desktop); swipeable round-by-round carousel (mobile). (`PublicBracketView.tsx`, `LogicSyncBracket`.)
3. **Team-profile theming** — extend the per-team avatar hue into the profile hero/accents so each team page feels like theirs. (`team-profile.module.css`, `app/[orgSlug]/[tournamentSlug]/teams/[id]/page.tsx`.)
4. **Layout-matched skeletons + illustrated/anticipatory empty states.** (`PublicTournamentState`, per-screen skeletons.)

**Trade-offs:** two bracket layouts to maintain (already branch desktop/mobile); illustrations are a design-asset investment.

## Phase D — Bigger bets (optional, sequenced last)
1. **★ Auto-generated share cards** — branded final-score/standings image (client canvas first; OG-image route later for fidelity). New `components/public/ShareCard` + a share action. *Trade-off:* image-gen infra.
2. **Pull-to-refresh** with a branded field-lines loader on public pages. *Trade-off:* touch/scroll conflict engineering (data already live-polls).
3. **Offline shell** — installed app shows cached last scores + offline state. *Trade-off:* service-worker caching strategy + invalidation.
4. **Desktop left-rail app layout** + sticky context header. *Trade-off:* meaningful desktop layout shift.
5. **Per-tournament splash screens + themed status bar**; **opt-in haptics/sound** on score events. *Trade-offs:* iOS splash image tooling; haptics must be opt-in.

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
