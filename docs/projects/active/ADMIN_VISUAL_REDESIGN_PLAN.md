# Tournament Admin — Visual + UX Redesign Plan

> Goal: turn the tournament admin (`app/[orgSlug]/admin/tournaments/*`) into a *standout, broadcast-grade game-day command center* — mobile-first (organizers run live events from their phone on-site), desktop second — without diluting the dense terminal/HUD aesthetic or sacrificing power-user density.
> Status: planned 2026-06-02. Phased so each phase is independently shippable + greenlightable.
> Scope: admin shell / sidebar / `AdminChrome` / bottom nav, the shared `TournamentAdminUI` kit, the tournament dashboard, the schedule generator + `PlayoffWizard` + `BracketBuilder` + `GameList` + `ScheduleHealthPanel`, the registrations command center, divisions, and event settings. CSS: `admin.module.css`, `admin-common.module.css`, `dashboard.module.css`, `schedule-admin.module.css`, `teams-admin.module.css`, `TournamentAdminUI.module.css`, `AdminSidebar.module.css`, `AdminBottomNav.module.css`, `BracketBuilder.module.css`, `divisions/admin-page.module.css`.
> Tier boundary: Tournament + Tournament Plus are standalone — everything stays under `/admin/tournaments/`, never `/admin/org/` (see `feedback_tournament_org_separation`).

## Context & relationship to existing efforts

This is the *premium "wow" layer*, built on top of two in-flight efforts (do not duplicate them):

- **`codex_TOURNAMENT_OWNER_MOBILE_*` + `MOBILE_REVIEW_TRACKER`** — the *functional* mobile floor (bottom-nav overlap, 44px targets, venue cards, safe activation, tappable Plus locks). This plan assumes that floor and adds signature patterns above it.
- **`agent_TOURNAMENT_DESIGN_REVIEW`** — per-page token/consistency cleanup (desktop). This plan assumes token-cleanliness and introduces *new* primitives, not re-sweeps.

This mirrors how `PUBLIC_VISUAL_REDESIGN_PLAN` sat on top of `PUBLIC_TOURNAMENT_WOW` + `PUBLIC_TOURNAMENT_MOBILE_POLISH` for the public side. Same model, applied to admin.

## Phase 0 — Principle update (blocking framing, no code)
`memory/design_principles.md` currently says *"Admin shell: designed for 1280px+ desktop; tablet (768px+) must be functional, not polished."* Update it to: **mobile admin is a first-class operating mode ("game-day cockpit"), not a squeezed desktop layout** — aligning with the shared design-review guidance (*"Mobile admin is an operating mode, not a squeezed desktop layout"*). Desktop keeps its dense terminal HUD; density becomes a *choice* (see Phase A‑1), never a regression for power users. Log the change in `design_decisions.md`.

## Hard constraints (every change must respect)
- **Preserve the terminal/HUD language** (2026-05-23 foundational decision): blueprint-blue = structural chrome; `--logic-lime` = active/interactive + CTA layer; `--font-data` mono for labels/controls/data; `border-radius: 2px`; `--hud-surface` main bg; no glow/lift theatrics. New "wow" must read as *operational*, not consumer-app.
- **Containers stay blueprint-blue; lime is the content/active layer** (2026-05-29). Don't add lime borders where lime already appears inside.
- Use design tokens — never literal hex. Any new token needs a `[data-color-mode="light"]` counterpart (dark-first, but light parity is a standing rule).
- Honor the mobile bottom nav (`z-index: 300`, 900px collapse point), `env(safe-area-inset-*)`, and the **900px sidebar/content breakpoint as the single mobile threshold** (2026-06-01) — fix the 768↔900 mismatch zone where it exists.
- Gate all motion behind `prefers-reduced-motion`.
- Keep live diff-merge keys stable so live/score/count animations don't re-fire on polling refresh.
- Don't regress power-user density: compact mode stays the desktop default.

## New / updated design tokens (add to `globals.css` `:root` + light block; admin scoping in `admin.module.css`)
- `[data-density="comfortable" | "compact"]` row/padding/type overrides (opt-in, persisted). Comfortable = mobile default; compact = desktop default.
- `.statNum` / `.tabular` helper with `font-variant-numeric: tabular-nums`.
- `--blur-bar` (single frosted-chrome source) + `@supports` solid fallback.
- `--hud-highlight: inset 0 1px 0 rgba(255,255,255,0.04)` (+ light counterpart) for whisper-thin panel depth.
- `--ease-spring` for the few playful micro-interactions (count-up, sheet).
- New status tone for **in-progress / overdue / conflict** game rows (extends the existing scheduled/cancelled/completed stripe set).

---

## Phase A — Foundation (system-wide, low-risk, highest leverage)
Mostly `globals.css` + `admin.module.css` + shared components. Ship first. **Detailed implementation spec: `ADMIN_VISUAL_REDESIGN_PHASE_A.md` (greenlit 2026-06-02).**

1. **Density modes** — `[data-density="comfortable"|"compact"]` overrides for shared row/control/chip primitives + touch-target floor; **a user choice available on both surfaces** (comfortable defaults on coarse-pointer/≤900px, compact on desktop) — never a forced regression for power users. *(globals.css, admin.module.css, admin-common.module.css, TournamentAdminUI.module.css.)*
2. **Reduced-motion global guard** — one `@media (prefers-reduced-motion: reduce)` block disabling transforms/slide/pulse/count-up across the admin shell. *(globals.css / admin.module.css.)* **None exists today.**
3. **Touch press states** — `:active` scale/opacity on game rows, registration rows, attention buckets, stat cards, sheet segments, filter chips. *(module CSS; reduced-motion gated.)*
4. **Tabular numerals** — `.statNum`/`.tabular` applied to gauges, stat cards, scores, counts, schedule-health KPIs, payment cells.
5. **Unified frosted chrome** — `--blur-bar` + `@supports` fallback across bottom nav, sticky toolbar, sheets. *(globals.css, AdminBottomNav, TournamentAdminUI, sheet CSS.)*
6. **Whisper-thin elevation** — `--hud-highlight` on analytics/setting panels + cards; verify it stays near-invisible and has a light-mode value.
7. **Blueprint-grid mobile tune** — smaller cell + lower opacity ≤900px in `.adminMain`.
8. **Shared `<BottomSheet>` primitive** — consolidate the duplicated sheet CSS (schedule + teams + generator) into one component: drag handle, safe-area, sticky footer, backdrop. Migrate existing sheets onto it.
9. **Layout-matched skeletons** — skeleton flat-rows + stat cards + panels, replacing bare/blank loads. *(new shared `AdminSkeleton`; per-surface mounts.)*

**Trade-offs:** density modes = two padding scales to maintain (mitigated by tokenizing); frosted bars cost GPU/battery on low-end Android (mitigated by `@supports`); `--hud-highlight` must be tuned per mode so it doesn't read as a consumer gradient.
**Verify:** every admin page under dark + light, compact + comfortable, on a branded org; reduced-motion off-switch works; no numeral jitter on live count change.

## Phase B — Game-day signature moments (the "wow")
1. **★ Mobile top app-bar** — slim sticky bar ≤900px: tournament name + Live/Draft pill + one-tap switcher + **`NotificationBell`** (today the bell only renders in the desktop sidebar — mobile admins get *no* notifications). Auto-hide on scroll-down / reveal on scroll-up. *(AdminChrome, AdminBottomNav or new `AdminMobileTopBar`, NotificationBell.)*
2. **★ Lifecycle-aware dashboard "command" hero** — reshape the dashboard top by status: Draft = launch checklist + progress (exists); **Active = live ops board** (games in progress / next up / unscored count / check-in progress / last result, big glanceable numbers); Completed = wrap-up (exists). Reframes existing pieces (checklist, schedule-health, attention). *(dashboard/page.tsx, dashboard.module.css.)*
3. **★ Live row states on schedule + results** — "in-progress / overdue / next-up" tone on `GameList` rows once start time passes without a score; reuses the status-stripe + one new tone. Turns the list into an operational timeline.
4. **Live presence in the shell** — when `status === 'active'`, a subtle lime top hairline / `.live-dot` pulse so the operator always knows they're on the live event. *(AdminChrome; reduced-motion aware.)*
5. **Nav as a live worklist** — small attention counts on nav items (Teams ▲pending, Results to-score) sourced from the dashboard attention data. *(admin-nav-config consumers: AdminSidebar + AdminBottomNav.)*
6. **Context-aware center action** in the bottom nav — fixed 4 tabs, but a prominent center affordance that changes by lifecycle (Draft → checklist; Live → "Score"/"Check-in"). *(AdminBottomNav.)*
7. **Thumb score entry** — mobile +/− steppers beside the existing inline score inputs (no keyboard). *(GameList scoring mode, schedule-admin.module.css.)*
8. **Count-up / odometer** on the big gauge/stat numbers as data changes. *(dashboard; reduced-motion gated; stable keys.)*

**Trade-offs:** the top app-bar adds chrome (mitigated by auto-hide); dynamic center action can disorient (mitigated by keeping the 4 tabs fixed); nav counts need attention data plumbed to nav config.
**Verify:** a *live* tournament across 375/390/430 widths + desktop; bell reachable on mobile; live states + count-up honor reduced-motion and don't re-fire on poll.

## Phase C — Builder & depth
> **Bracket slice SHIPPED (2026-06-03, awaiting browser verification)** — C1+C2+C3 below. Remaining C4–C9 still open.
> **Note — there are TWO bracket views on the schedule page** and the polish was applied to both: (a) `BracketBuilder.tsx` = the *editing* tool (Playoff Bracket Builder wizard, dropdowns + drag); (b) `PlayoffBracketView`/`BracketColumns` inline in `page.tsx` = the *read* view shown by the "Bracket" layout toggle (the one organizers look at during the event — `VIS`/`HOM` + pencil-edit). Both now share the reusable `BracketConnectors.tsx` overlay, the final-game lime spotlight, and the mobile round-carousel (≤768px scroll-snap, 86vw columns, connectors hidden on mobile). Team-color dots are on the editor only (the read view shows seed/winner placeholders, not real team names).

1. ✅ **★ Mobile bracket mode** — round-by-round swipeable carousel: on ≤768px the canvas becomes a scroll-snap track of full-width (86vw) round columns that peek the next round; the matchup card itself is the inline editor (kept inline rather than a `<BottomSheet>` since the card is already an editor). *(BracketBuilder.tsx, BracketBuilder.module.css.)*
2. ✅ **★ Bracket broadcast polish (desktop)** — new `BracketConnectors.tsx` SVG overlay parses each matchup's `Winner/Loser <code>` labels → maps target→source, measures live card rects (querying `[data-matchup-id]`) and draws bezier connectors; recomputes on data change + `ResizeObserver` + window resize. Final-round connectors render lime; final-round cards get a lime spotlight frame; assigned real teams get a deterministic `teamColor()` dot. *(Connectors are non-split-mode only for now — split per-pool canvases deferred.)*
3. ✅ **Bracket drag alignment** — added dnd-kit `TouchSensor` (delay 200 / tolerance 8) so drag works on touch; `touch-action: none` on `.dragHandle`; lifted-card drag language (`opacity:0.55` + lime outline + shadow, grip → lime while dragging). *(BracketBuilder.tsx, BracketBuilder.module.css.)*
4. ✅ **Schedule Health as a sticky glance (SHIPPED 2026-06-03, awaiting browser verification)** — `ScheduleHealthChip` lives in the sticky planning toolbar (tone dot + score `/100` + amber/red `⚠ N` warning segment, shown only when saved metrics exist). Tapping opens the full detail **without moving scroll**: a `BottomSheet` on mobile, an anchored popover on desktop. Both reuse a new exported `ScheduleHealthContent` (extracted from `ScheduleHealthPanel`); the inline `<details>` panel below stays as the home for the full breakdown incl. team table. *(schedule/page.tsx, new ScheduleHealthChip.tsx, ScheduleHealthPanel.tsx refactor, schedule-admin.module.css.)*
5. **Conflict visualization on the list** — stripe/clash-badge both games in a venue double-book via a new "conflict" tone (the modal already blocks/warns). *(GameList + status tone.)*
6. **Registrations / divisions card modes** — opt-in mobile card density (paired with Phase A density); divisions become a fill board with inline accepted/capacity gauges. *(teams-admin, divisions admin-page CSS.)*
7. **Team color avatars** on registration rows + division/teams lists (mirrors public teams remodel). *(teams-admin.)*
8. **Consolidate duplicated "attention" UI** — unify dashboard `.attentionItem` and teams `.attentionBucket` into one shared component. *(new `AttentionGrid`; dashboard + teams.)*
9. **Generator mobile flow** — thumb-size inputs (40–44px) + number steppers; consider a stepped mobile layout (sections are already conceptually stepped; advanced drawer already hides niche controls). *(Generator.tsx, PlayoffWizard.tsx, schedule-admin.module.css.)*

**Trade-offs:** two bracket layouts to maintain (desktop already branches); connector lines need layout math; card modes cost vertical space (mitigated by density toggle); avatar hues need a deterministic per-team mapping (reuse public).
**Verify:** bracket on a real playoff structure across breakpoints + drag on touch; generator end-to-end on a phone; division fill board + registration cards in compact + comfortable.

## Phase D — Bigger bets (optional, sequenced last)
1. **★ Game-day check-in mode** — fast "mark arrived/checked-in" view (big toggles, search-as-you-type, progress count) for the gate. *Trade-off: needs a check-in field/model — flag as a product + possible Plus-gating decision.*
2. **★ Venue × time visual schedule timeline** — venues-by-time grid of game blocks with drag-to-move between slots; clashes/gaps visible at a glance. *Trade-off: substantial new component (gantt/timeline).*
3. **Optimistic UI + offline/queue** for scoring & check-in over flaky field connectivity, with a sync indicator. *Trade-off: sync/queue + invalidation engineering.*
4. **On-site payment capture** — swipe/fast "mark paid" for cash collected at the gate. *Trade-off: overlaps the accounting module.*
5. **Pull-to-refresh** on live admin lists; **actionable/illustrated empty states** sweep; **resilient inline-error + retry** preserving entered data. *Trade-offs: scroll-gesture handling; content/illustration investment.*
6. **Desktop icon-rail toggle** — optional 64px collapsed sidebar to reclaim table width. *Trade-off: adds a shell mode.*

## Phase E — Full admin design QA pass (project close-out)
After Phases A–D land and are verified, run a systematic **page-by-page design QA across every tournament admin page + the shared shell** — to catch drift introduced during the redesign and pre-existing inconsistencies the new patterns expose. (The B3 QA alone surfaced a ghost `btn-success` class → white button, a status/action affordance clash, and flipped filter colours — assume more like these exist.) One checkpoint row per page (reviewed / issues logged / fixed / verified). Verify per page: density (compact unchanged, comfortable ≥44px), reduced-motion, dark + light, branded + default org, all four lifecycle phases; **token/class compliance** (no ghost classes; every status colour = its row's colour across chip/stripe/label/tally/legend; every action = a real button class); **status-vs-action affordance** (labels never look like buttons); frosted/elevation/press consistency; mobile top-bar + bottom-nav + sheets; empty/loading/error states. Fold into the existing `agent_TOURNAMENT_DESIGN_REVIEW` + `MOBILE_REVIEW_TRACKER` rather than duplicating.

## Critical files
- `app/globals.css` (density modes, tabular nums, `--blur-bar`, `--hud-highlight`, reduced-motion, light parity)
- `app/[orgSlug]/admin/admin.module.css` (admin-scoped token overrides, grid bg, density)
- `app/[orgSlug]/admin/AdminChrome.tsx` (mobile top app-bar mount, live presence)
- `components/admin/AdminBottomNav.tsx` + `.module.css` (center action, target height, More→sheet, nav counts)
- `components/admin/AdminSidebar.tsx` + `.module.css` (nav worklist counts, optional icon-rail)
- `components/admin/admin-nav-config.ts` (counts metadata)
- `components/admin/tournament/TournamentAdminUI.tsx` + `.module.css` (frosted toolbar, sticky health chip slot)
- `app/[orgSlug]/admin/admin-common.module.css` (rows, density, live/conflict tones, skeletons)
- `app/[orgSlug]/admin/tournaments/dashboard/page.tsx` + `dashboard.module.css` (lifecycle hero, count-up, sparklines, mobile reorder)
- `schedule/page.tsx`, `schedule/components/GameList.tsx`, `ScheduleHealthPanel.tsx`, `Generator.tsx`, `PlayoffWizard.tsx`, `BracketBuilder.tsx` (+ `BracketBuilder.module.css`, `schedule-admin.module.css`)
- `registrations/page.tsx` + `teams-admin.module.css` (card mode, avatars, check-in, attention consolidation)
- `divisions/page.tsx` + `divisions/admin-page.module.css` (fill board)
- `settings/event/page.tsx` (mobile stacking, sticky save footer)
- New: `components/admin/BottomSheet.tsx`, `AdminSkeleton.tsx`, `AdminMobileTopBar.tsx`, `AttentionGrid.tsx`
- `memory/design_principles.md` + `design_decisions.md` (Phase 0 principle update)

## Verification (per phase)
Run `npm run dev` (restart after new files / shared-module / `proxy.ts` / config changes). For each phase, walk dashboard → registrations → schedule (planning + scoring) → generator → bracket → divisions → event settings, on **mobile (375/390/430) + desktop**, in **dark + light**, **compact + comfortable**, on a **branded org + a default org**, across **draft + active + completed** lifecycle states. Confirm: no bottom-nav overlap or horizontal overflow; ≥44px game-day touch targets; reduced-motion disables transforms/count-up; live/score/count changes animate cleanly with stable keys (no re-fire on poll); the terminal/HUD language is preserved (no consumer-app drift).
