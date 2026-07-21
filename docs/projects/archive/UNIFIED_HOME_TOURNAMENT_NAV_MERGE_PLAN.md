# Tournament Nav Unification — Implementation Plan (Unified Home IA · Phase 5)

**Status:** Direction + 3 decisions owner-ratified 2026-07-20. **PHASE 0 COMPLETE 2026-07-21** — all four Phase 0 decisions ratified at the recommendations (P0-1 venue-following bar skin, P0-2 chrome floor + collapse matrix + banner rider, P0-3 preview mirrors live, P0-4 champions pages keep the bar; mockup artifact `bba366b6`). Unified Home Phases 0–6 confirmed committed on dev 2026-07-21 → the sequencing precondition is met. **PHASES 1+2 BUILT ON DEV (UNCOMMITTED) 2026-07-21** — Playwright-verified against the §9 bar (chrome floor 28.5%/22.3%, ≥44px taps, one bottom bar, venue-following active tab); pending owner browser test + commit. Remaining: **Phase 3** (preview parity + desktop strip) + **Phase 4** (/simplify → /review), to start only after the owner tests this pass. Two in-spec execution calls (measured, not eyeballed): top tabs at the **44px** shipped tap floor (the mockup's 40px estimate would fail it) and a **56px** global bar (vs the mockup's 64px) — both hold the P0-2 floor.
**PM brief:** UNIFIED_HOME_TOURNAMENT_NAV_MERGE_PM_BRIEF.md
**Source analysis:** 12-agent deep review (both nav shells, branding/theming machinery, follow+chat model, prior ratified nav decisions), 2026-07-20.

---

## 1. Goal

Keep the global consumer nav (`Home · Scores · Chat · Account`) present on public tournament routes (`/{orgSlug}/{tournamentSlug}/*`), and move the tournament's own page navigation into a horizontally-scrolling **top tab row** under the branded event header. The tournament page stays fully brand-themed; the global bar renders platform-neutral (active tab borrows the tournament accent only).

This resolves the deliberately-deferred **UNIFIED_APP_CONSUMER_LAYER_PLAN §8** gap ("no in-app path back to the directory once a fan drills into a tournament").

## 2. Ratified decisions (do not re-litigate)

- **D-A · Direction:** recommended blend — branded top tabs + neutral global bar (Alternative "Recommended", not variants 1/2/3/4).
- **D-B · Bar skin — AMENDED by P0-1 (2026-07-21), the binding version:** on tournament routes the global bar wears the **venue-following token skin** — the default dark token skin, which the tournament's existing light-mode `:root` override flips automatically on `colorMode:'light'` events (dark event → dark bar, light event → light bar). Active tab tinted via the tournament's `--primary-light`. NEVER the `.warm` paper skin inside tournaments (V1 rejected), NEVER hard-held dark on light events (V2 rejected), never a full per-tournament reskin. Consumer routes keep the warm bar unchanged — skin-follows-the-surface is the established rule (`.warmVars` + `.topbarWarm`/`.bottomNavWarm` precedent).
- **D-C · Tier gating:** every plan tier, no dial-back. Cosmetic restraint only (thin/quiet), never plan-gated hiding.
- **Landing tab renamed** `Home` → **`Overview`** (matches TournamentSideRail language; avoids the two-Home collision).
- **News + Rules return as real tabs** (undoes the G5 space-driven demotion into the More sheet).
- **P0-2 · Chrome floor + collapse matrix (ratified 2026-07-21):** fixed chrome ≤ **39% at rest / 26% scrolled** on a 667px SE-class viewport — a hard build constraint, not advisory. Matrix: event header collapses 116→48 (G3, unchanged); TopTabs **40px pinned always**; ticker 40→24 (unchanged); Schedule day-label re-anchored under the tabs; MyTeamDock keeps G1 rules; global bar 64px pinned (takes the retired tournament bar's slot — net-zero new bottom chrome). **Rider:** the free-plan `TournamentAcquisitionBanner` folds into the `PoweredByBadge` corner chip while the ScoreTicker is live.
- **P0-3 · Admin preview MIRRORS the live layout** (top tabs; still no identity chrome — no account/chat state in preview). J6-057 is moot for the scrolling row.
- **P0-4 · Champions/celebration takeover pages KEEP the global bar** (quiet; the takeover art owns the hero).

## 3. Current-state facts (verified, load-bearing)

- `ConsumerNav` (Home/Scores/Chat/Account) mounts ONLY inside `app/(consumer)/layout.tsx` (route group: `/discover`, `/scores`, `/chat`, `/following`, `/account`). It is NOT a global self-gating mount.
- `Navbar` + `BottomNav` (tournament chrome) ARE global self-gating mounts in `app/layout.tsx`; `BottomNav` early-returns on `isConsumerShellPath` + admin + no-`tournamentSlug`. `SiteChrome` renders `Navbar` UNLESS `isConsumerShellPath`.
- `isConsumerShellPath` / `CONSUMER_SHELL_PREFIXES` (`lib/consumer-routes.ts`) is a single boolean feeding THREE behaviours: `SiteChrome` suppression, `BottomNav` self-exclude, `(consumer)` layout selection.
- Tournament BottomNav and ConsumerShell bottomNav are BOTH `position:fixed; bottom:0; z-index:200` → literal collision if both render. Moving tournament tabs to the top is what avoids it (not optional).
- Tournament branding = an UNSCOPED `:root{…}` `<style>` override (`--primary`, `--primary-light`, `--border`, `--glow`, `--on-primary`, + full light-mode palette when `colorMode:'light'`) injected in `app/[orgSlug]/[tournamentSlug]/layout.tsx`. It cascades document-wide → a root-mounted `ConsumerNav` would AUTOMATICALLY pick up the tournament accent for active-tab tint (this is the mechanism, lean on it).
- ⚠️ **SUPERSEDED by Unified Home Phase 5 (2026-07-20): the consumer nav chrome is NO LONGER dark-token-only.** Phase 5 warmed the top bar + bottom nav to the `--home-*` skin (`ConsumerShell.module.css` `.topbarWarm`/`.bottomNavWarm`) on the four consumer-shell routes (`/discover`,`/scores`,`/chat`,`/account`; `/account/notifications` + auth/select-org/suspended stay dark). The `--home-*` tokens reach the nav via the new token-only `warmTheme.module.css` `.warmVars` class (no ground), never by redefining a global dark token. The `.warm` cream tokens ARE now on the bar. → **RESOLVED 2026-07-21 (P0-1):** inside tournaments the bar does NOT carry the warm skin — it wears the venue-following token skin (see amended D-B in §2). Implementation note: on tournament routes render the bar in its default token skin (no `.warmVars`/`.topbarWarm`/`.bottomNavWarm`); the tournament's own `:root` overrides (brand accent + light-mode palette) then drive it with zero new CSS machinery — the same way the tournament's `BottomNav` themes today.
- Chrome-height vars (`app/globals.css`): `--chrome-top-h = --nav-visual-h + --ticker-h`; `--chrome-top-static-h = --nav-event-h + --ticker-h`; `--nav-height:72px`; `--bottom-nav-height:72px`. Consumed by the sticky Schedule day-label (`top:var(--chrome-top-h)`), the desktop schedule rail, MyTeamDock offset, and PoweredByBadge/AcquisitionBanner stacking math.
- KNOWN DRIFT to reconcile: `ConsumerShell.module.css` hardcodes bottom clearance as `4rem` (64px) while `--bottom-nav-height` is `72px` — an 8px mismatch. Reconcile to one canonical var.
- `useChatUnread(enabled)` fully no-ops when `enabled=false` (no fetch/poll/realtime) → logged-out visitors cost nothing IF the `signedIn` source is resolved correctly (see §5 privacy).
- `check-public-tokens.mjs` `PUBLIC_DIRS` = `['app/[orgSlug]','app/teams','components/public']` — does NOT cover `components/Navbar.module.css`, `components/BottomNav.module.css`, or `components/consumer/**`. Extend it as part of this work.
- Tournament chat is coach/organizer/official-only at the schema/resolver layer; fans have zero rooms. The global Chat tab already shows the correct thing (static preview for fans). No follow/chat semantics change — chrome only.

## 4. Where every "More"-sheet door goes (the 40% the sketch omitted)

| Door (today, in TournamentAccountSheet) | Destination |
|---|---|
| Following | RETIRE → global **Account** tab |
| Your FieldLogicHQ | RETIRE → global **Home** tab |
| Browse tournaments | RETIRE → global **Home** tab |
| Live scores | RETIRE → global **Scores** tab |
| News | PROMOTE → top tab |
| Rules | PROMOTE → top tab |
| Coach view / Open admin / Scorekeeper (hat rows) | KEEP → small header identity chip (hat-gated) |
| Fan alerts bell | KEEP → header chip / header action |
| Follow-a-team (signed-out) | KEEP → header chip |
| Sign in / Sign out | KEEP → header chip |

The header identity chip is the existing top-right `navActions` anchor pattern (bell/share/account chip already live there), slimmed.

## 5. Architecture approach

**Chosen:** promote `ConsumerNav` to a root-level self-gating global mount (same pattern as `Navbar`/`BottomNav`), NOT a route-tree move (moving `[orgSlug]` under `(consumer)` would drag admin/coaches/scorekeeper/league in — rejected).

- Split the single `isConsumerShellPath` gate into two named predicates: `showsConsumerNav(pathname)` and `showsTournamentChrome(pathname)` — they must be independently true on `/{orgSlug}/{tournamentSlug}/*`. Update `SiteChrome`, `BottomNav`, `Footer`, and layout selection together.
- **Privacy (HIGH):** do NOT reuse `ConsumerNav`'s current `signedIn`-as-SSR-prop contract on tournament routes. Tournament HTML is offline-cached by the service worker as anonymous content; baking identity in would replay to the next person on a shared device (the exact bug class already fixed for `/api/public/tournament-viewer`). Resolve identity CLIENT-SIDE after a local `getSession()` (reuse the `TournamentAccountSheet` pattern) when mounted on tournament routes. Bump SW `CACHE_VERSION` and re-verify the offline-replay scenario.
- New **TopTabs** component: reads `tournamentHiddenPages` from `OrgNavContext` (same source the current tabs filter on). Horizontally scrollable with partial-tab peek + edge-fade + scroll-snap + active-tab auto-center. Build fresh (no public-shell primitive exists; do NOT adapt the admin segmented control — wrong visual weight). Register stays CTA-only (never a tab).
- Retire the tournament `BottomNav` LIVE mode in the SAME change the top tabs ship (they cannot coexist without the z-200 collision).

## 6. Chrome / layout integration

- Fold the TopTabs height into `--chrome-top-h` / `--chrome-top-static-h` so the sticky Schedule day-label + desktop rail don't render underneath it.
- Have whichever bottom bar is actually mounted publish the canonical `--bottom-nav-height`, so MyTeamDock / PoweredByBadge / AcquisitionBanner / InstallAppPrompt offsets don't need per-bar special-casing. Reconcile the 64px/72px drift.
- **Mobile vertical budget — RATIFIED 2026-07-21 (P0-2, gate cleared):** the collapse matrix + 39%/26% chrome floor + banner-folds-while-ticker-live rider in §2 are the binding spec (mockup artifact `bba366b6`: 61% content at rest / 74% scrolled / ~53% free-plan worst case before the rider). Verify against the floor at 360/390 widths and the 667px SE height in the build's capture pass.
- Active-state rule: while inside a tournament, Home/Scores render in a NEUTRAL (not-active) state — signalling a nested context, not a false "you are on Discover/Scores".
- Desktop: do NOT build a new desktop top-tabs component. Add only a slim global strip above the existing Navbar/side-rail stack. Keep the 248px `TournamentSideRail`.

## 7. Preview + scope boundaries

- Admin PREVIEW (`…/admin/tournaments/preview/[tournamentSlug]`) — **DECIDED 2026-07-21 (P0-3): MIRRORS the live layout** (top tabs via the same TopTabs component with `basePath`; the tournament BottomNav preview mode retires with it). Preview keeps NO identity chrome (no account/chat/bell state — nothing personal to preview). J6-057 is moot for the scrolling row.
- Org-level public pages (`/{orgSlug}`, org schedule) = fast-follow, NOT this round. Flag the 3-state transition risk (org-home / preview / live) but don't solve it here.
- OUT OF SCOPE, hard boundary: coaches portal, admin, scorekeeper/gate/check-in volunteer shells. Add an explicit "volunteer shells stay untouched" guardrail to any route-agnostic mount so day-of ops never inherit consumer chrome.
- Champions/playoffs takeover recap pages — **DECIDED 2026-07-21 (P0-4): the global bar RENDERS on them** (quiet; the celebration art owns the hero). Recap pages are the most-shared links a tournament produces — never strand a first-time visitor without nav.

## 8. Phasing

- **Phase 0 — Design/decisions (no code): ✅ COMPLETE 2026-07-21.** Mockups + door map approved (proposal artifact 2026-07-20 + Phase 0 artifact `bba366b6`); P0-1…P0-4 ratified (see §2); supersessions logged via `/design` (design_decisions.md 2026-07-20 + 2026-07-21 entries) and `/strategy` (BUSINESS_DECISIONS.md 2026-07-20).
- **Phase 1 — Foundation:** split the routing gate; root-mount `ConsumerNav` with client-fetch identity on tournament routes; ship TopTabs from `OrgNavContext`; retire tournament BottomNav live mode in the same change; header identity chip carries the KEEP doors; rename landing tab → Overview; News/Rules become tabs.
- **Phase 2 — Chrome integration:** recompose `--chrome-top-h`/`--chrome-top-static-h`; canonical `--bottom-nav-height` (fix 64/72 drift); re-derive dock/badge/banner offsets; bump SW `CACHE_VERSION` + re-verify offline identity replay; extend `check-public-tokens.mjs` `PUBLIC_DIRS`.
- **Phase 3 — Preview parity + desktop strip** per Phase 0 decisions.
- **Phase 4 — /simplify then /review:** the PublicPageKey→label/icon tab list is currently duplicated across Navbar, BottomNav, TournamentSideRail; this adds a 4th consumer (TopTabs). Consolidate to one shared config first, then adversarial review.

## 9. Verification

- Playwright computed-style probes at 390/360/desktop/light, on default + Battle-Purple + light-mode tournaments, anon + followed, free + Plus plans.
- Confirm logged-out visitors trigger zero chat-unread network/realtime on tournament pages.
- Re-verify MyTeamDock exact-route minimize logic against any new URL/tab structure.
- Re-run the tournament-mobile capture harness (no overflow; every tap target ≥44px) — this must not regress the shipped Mobile Polish baseline.
- Manual shared-device offline-replay re-test after the SW bump.

## 10. Open items

**None — all owner calls resolved 2026-07-21** (P0-3 preview mirrors live, identity-chrome-free; P0-4 champions pages keep the bar). Build decisions from here are execution detail within the ratified spec.
