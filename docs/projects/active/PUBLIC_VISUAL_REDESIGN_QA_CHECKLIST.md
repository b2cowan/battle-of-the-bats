# Public Visual Redesign — QA & Sign-off Checklist (Phase E)

> Companion to `PUBLIC_VISUAL_REDESIGN_PLAN.md`. Walk every public surface in the
> matrix below, on **mobile and desktop**, and tick each cell. When you find an
> issue, note it inline (date + short description) and I'll fix it.

## How to use this — "fix once, applies everywhere"

- The **Shared / cross-cutting** section covers global components (nav, rail, dock,
  buttons, tokens, motion). These render on *every* page, so **if one is wrong on
  one page it's wrong on all** — log it **once** in that section and I'll fix it
  **systemically** so the same issue never shows up again on another page.
- The **Per-surface** sections are only for issues unique to that page's own
  content/layout. If something you find there is actually a shared component,
  move it up to Shared so the fix is applied globally.
- My commitment: every fix is applied across all affected surfaces in the same
  pass — you should never have to report the same issue twice.

## Test matrix (axes to cover)

| Axis | Values |
|---|---|
| Viewport | **Mobile** (~390px) · **Desktop** (≥1024px) · *spot-check tablet 900–1023px for the nav (links return, no rail)* |
| Theme | **Dark** · **Light** |
| Org branding | **Default** (FieldLogicHQ blue) · **Branded** (advanced-branding, custom `--primary`) |
| Card style | `glass` · `outlined` · `flat` (`data-card-style`) |
| Motion | one pass with **prefers-reduced-motion: reduce** on |

## Test data — four tournaments in `dev-test-org` (toggle by slug)

| Slug | Theme | Mode | Cards | Phase | Covers |
|---|---|---|---|---|---|
| `dev-tournament-2026` | Default (blue) | Dark | default | Upcoming (countdown) | default · dark · pre-event hero |
| `live-demo` | Default (blue) | Dark | default | **Live game day** | default · dark · live (broadcast/ticker/dock/bracket) |
| `branded-light` | **Crimson** | **Light** | **glass** | Upcoming | **branded · light** · glass · countdown hero |
| `branded-dark` | **Battle Purple** | Dark | **outlined** | **Live game day** | **branded · dark** · outlined · live elements |

> Seeded via `node --env-file=.env.local scripts/seed-theme-variants.mjs` (idempotent). **dev-test-org is already on `tournament_plus`** (verified 2026-06-04) so the script did **not** change the plan — advanced branding has always been active here.
> **Acquisition-banner caveat:** because dev-test-org is a paid plan, the **free-plan acquisition banner / PoweredBy badge never show here** — that checklist item must be tested on a **separate free-plan org** (or temporarily set `dev-test-org.plan_id='tournament'`).
> For more combos (e.g. branded+light+**live**, or the third `flat` card style), toggle `color_mode` / `theme_card_style` on any of these in admin → tournament settings.

---

## Shared / cross-cutting (fix once → applies to every page)

Walk these in **dark + light**, **mobile + desktop**, **branded + default**.

- [ ] **Top nav** — frosted on scroll (`--blur-bar` + `@supports` fallback, opaque where blur unsupported); logo/name; transparent over hero when not scrolled
- [ ] **Desktop left rail** (≥1024px) — full-height; header logo + name; active-section accent bar; **no dead band** at top; content offset aligns nav + page content; **light-mode** surface/border correct; **branded** `--primary` shows on the active item
- [ ] **Desktop top bar** — status pill/ticker **not clipped** by the rail; "Upcoming + countdown" / "LIVE ticker" / "Completed" by phase; **Share** + **Register** on the right; aligns with page content
- [ ] **Tablet (900–1023px)** — horizontal top links return; **no** rail / status / share
- [ ] **Mobile bottom nav** — frosted; active state; safe-area inset; tap targets ≥44px
- [ ] **My-Team dock** (mobile, game day) — appears for followers only; live score/countdown; expand panel; **share menu opens upward** (not clipped); no "NaN"; doesn't collide with the schedule scorebug
- [ ] **Broadcast LIVE card** (live games only) — rolling-digit odometer with **no width jitter**; leader emphasis; entrance animation does **not** re-fire on the 30s poll
- [ ] **Share** — game: compact button → popover (Share link / Share image), opens away from edges; home/team: Share button; **OG preview** unfurls when a link is pasted (game = score card, team = team card, tournament = event card); "Save image" produces a clean PNG
- [ ] **Empty states** (`PublicTournamentState`) — illustrated medallion; correct tokens in **dark + light** (no ghost `--lime`/hardcoded-dark bleed)
- [ ] **Skeletons** — schedule loading skeleton matches the real layout
- [ ] **Tabular numerals** — every score/stat run uses tabular nums (no horizontal jiggle when a live score changes)
- [ ] **`--on-primary` contrast** — text on every primary-filled control is readable on a **branded** (incl. light/low-contrast) `--primary`
- [ ] **Reduced motion** — entrance, score-flash, odometer, live-pulse all settle on their final frame; **nothing re-fires** on the 30s poll
- [ ] **Footer** — links, wordmark, layout (dark + light)
- [ ] **Acquisition banner** (free plan, non-owner) — interaction with the nav/rail; no overlap or double-offset
- [ ] **Per-org primary color** carries everywhere: rail active item, status pill, buttons, accents, score-flash

---

## Per-surface

For each: **M** = mobile, **D** = desktop. Note issues inline.

### Home — `/[org]/[tournament]`
- M: [ ] hero (pre-event countdown vs compact in-progress) · [ ] count-up stats · [ ] registration status · [ ] CTAs · [ ] Share event
- D: [ ] above + rail active = Overview · [ ] top-bar status/ticker

### Schedule — `/schedule`
- M: [ ] division picker · [ ] stage segmented control (Pool/Playoffs) · [ ] search · [ ] **sticky date headers** + done/total progress · [ ] dense rows · [ ] **broadcast LIVE card** · [ ] tap row → game detail
- D: [ ] flat VS rows · [ ] rail active = Schedule · [ ] above

### Standings — `/standings`
- M: [ ] view toggle · [ ] horizontal table scroll · [ ] column legend · [ ] rank-change ▲/▼ + cell flash
- D: [ ] **diverging RD bar** · [ ] legend · [ ] rail active

### Teams — `/teams`
- M/D: [ ] grid · [ ] monogram avatars + per-team colors · [ ] tap → profile

### Team profile — `/teams/[id]`
- M: [ ] hero themed by **team color** · [ ] Follow + Share actions (stack full-width) · [ ] stat tiles · [ ] form bubbles · [ ] **schedule rows tap → game detail** · [ ] OG = team card
- D: [ ] above + actions inline · [ ] rail

### Game detail — `/schedule/[id]`
- M/D: [ ] matchup + scores · [ ] status badge · [ ] **Share menu** in the rail · [ ] live auto-refresh · [ ] OG = score card · [ ] venue + Maps link

### Bracket (within Schedule → Playoffs / Standings bracket)
- M: [ ] swipe carousel; rounds peek · [ ] **champion spotlight**
- D: [ ] connectors + champion spotlight (`PublicBracketView` **and** the SVG `LogicSyncBracket`)

### News — `/news`
- M/D: [ ] list/cards · [ ] empty state

### Rules — `/rules`
- M/D: [ ] content formatting · [ ] empty state

---

## Token-debt (tracked, not a blocker — see plan below)

- [ ] Guardrail in place (lint flags new literal hex in public modules)
- [ ] Inventory produced (literals → token map, categorized)
- [ ] High-traffic surfaces swept + verified (home / schedule / standings) in **light** mode
- [ ] Remaining surfaces swept

**Why it's not a ship blocker:** the literals overwhelmingly render correctly in
**dark mode** (the default); the risk is **light-mode drift** only. Dark-mode users
see no issue today.

### Proposed approach (safe, staged)
1. **Stop the bleeding — guardrail first.** Add a lint check (stylelint
   `color-no-hex`, scoped to `app/[orgSlug]/**` + `components/public/**` `*.module.css`,
   with an allowlist for genuine exceptions). New code can't add literals; CI/`verify:changed` catches them.
2. **Inventory, don't guess.** Generate a read-only report mapping each literal to:
   (a) **exact token match** → safe candidate, (b) **near-match** → needs a decision,
   (c) **intentional/always-fixed** (e.g. a deliberately always-dark chrome) → leave + allowlist.
3. **Fix in verified tranches, light-mode-first.** Replace true violations file-by-file,
   highest-traffic surfaces first. A token swap is **identical in dark mode** when the
   literal equalled the dark value — so your verification focuses on **light mode +
   branded org**, where the fix actually changes (improves) rendering. One tranche →
   you spot-check → next tranche.
4. **Track in `TODO.md`** as its own line; it rides alongside Phase E but doesn't gate sign-off.

---

## Sign-off
- [ ] All **Shared / cross-cutting** items pass: dark + light, mobile + desktop, branded + default
- [ ] No console errors on any surface
- [ ] Token-debt guardrail merged (inventory + tranches can continue after)
- [ ] Move `PUBLIC_VISUAL_REDESIGN_PLAN.md` + `_PM_BRIEF.md` (+ this checklist) to `docs/projects/archive/`
