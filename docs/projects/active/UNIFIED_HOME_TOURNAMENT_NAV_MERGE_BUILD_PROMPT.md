# Build Kickoff Prompt — Tournament Nav Merge (Unified Home IA · Phase 5)

Paste everything below the line into a NEW chat to start the build.

---

Build the **Tournament Nav Unification** feature (Unified Home IA · Phase 5). Phase 0 (design) is COMPLETE and owner-ratified — do not re-litigate any decision; build to the spec.

## Read these first (in order)

1. `docs/projects/active/UNIFIED_HOME_TOURNAMENT_NAV_MERGE_PLAN.md` — THE spec. §2 = ratified decisions incl. the amended D-B bar skin, the P0-2 chrome floor + collapse matrix, P0-3 preview parity, P0-4 champions pages. §4 = the door map (where every More-sheet item goes). §5–§7 = architecture, chrome integration, scope boundaries. §9 = verification bar.
2. `memory/design_decisions.md` — the 2026-07-21 "Nav Merge Phase 0 ratified" entry + the 2026-07-20 nav-merge entry it amends.
3. `docs/projects/active/UNIFIED_HOME_TOURNAMENT_NAV_MERGE_PM_BRIEF.md` — product framing.

## Scope of THIS build pass: plan Phases 1 + 2 together (they are coupled — do not split)

- **Phase 1 (foundation):** split the routing gate into `showsConsumerNav()` / `showsTournamentChrome()`; root-mount `ConsumerNav` (self-gating, like Navbar/BottomNav) so it renders on `/{orgSlug}/{tournamentSlug}/*`; new **TopTabs** component (reads `tournamentHiddenPages` from `OrgNavContext`; Overview·News·Schedule·Standings·Teams·Rules; horizontal scroll w/ partial-tab peek + edge fade + scroll-snap + active-tab auto-center; Register stays CTA-only); **retire the tournament BottomNav live mode in the same change** (z-200 collision otherwise); header identity chip carries the KEEP doors (hats, alerts bell, follow-a-team, sign in/out); More sheet + its 4 platform doors retire.
- **Phase 2 (chrome integration):** fold TopTabs height into `--chrome-top-h`/`--chrome-top-static-h`; the mounted bottom bar publishes canonical `--bottom-nav-height` (reconcile the 64/72px drift); re-derive MyTeamDock/PoweredByBadge/AcquisitionBanner/InstallAppPrompt offsets; implement the P0-2 rider (acquisition banner folds to the PoweredBy chip while ScoreTicker is live); bump SW `CACHE_VERSION` + re-verify the offline identity-replay scenario; extend `check-public-tokens.mjs` PUBLIC_DIRS to cover the touched nav CSS.
- Phases 3 (preview parity + desktop strip) and 4 (/simplify → /review) come AFTER the owner tests this pass — do not start them unprompted.

## Non-negotiables (ratified / house rules)

- **Bar skin (P0-1):** on tournament routes ConsumerNav renders in its **default token skin — NO `.warmVars`/`.topbarWarm`/`.bottomNavWarm`**. The tournament's `:root` overrides drive it (dark event → dark bar; light event → light bar; active tab = `--primary-light`). Consumer routes keep the warm bar byte-for-byte unchanged.
- **Privacy (HIGH):** never SSR `signedIn` into ConsumerNav on tournament routes — the SW caches that HTML anonymously (shared-device replay bug class). Resolve identity client-side after a local `getSession()`, per the `TournamentAccountSheet` pattern. `useChatUnread(false)` must stay a full no-op for logged-out visitors.
- **Chrome floor (P0-2):** fixed chrome ≤39% at rest / ≤26% scrolled on a 667px-tall viewport — verify, don't eyeball.
- **Naming:** tournament landing tab = **"Overview"**; while inside a tournament, global Home/Scores tabs render NEUTRAL (not active).
- **Hard scope boundary:** coaches portal, admin, scorekeeper/gate/check-in volunteer shells NEVER inherit consumer chrome — add an explicit guardrail in the new gate predicates. Org-level public pages (`/{orgSlug}`) are out of scope this round.
- Champions/celebration pages KEEP the global bar (P0-4).

## Verification bar (plan §9)

Playwright computed-style probes (not screenshots) at 390/360 + desktop, dark + Battle-Purple + light-mode events, anon + followed, free + Plus; zero chat-unread network/realtime for logged-out visitors on tournament pages; MyTeamDock route-minimize logic re-verified; the tournament-mobile capture harness re-run (no overflow, ≥44px taps — must not regress the shipped Mobile Polish baseline); manual offline replay re-test after the SW bump. `npm run typecheck` (shared modules change) + `verify:changed`.

## Repo rules that bite here

- Branch = `dev` only; re-check HEAD before committing; stage explicit pathspecs; `git show --stat HEAD` after any commit. **NEVER commit or push without an explicit per-action OK from the owner.**
- There is an untracked `pnpm-workspace.yaml` in the working copy — it must NEVER be committed (breaks the Amplify build).
- This work adds/deletes files + touches shared modules → stop the dev server, `rm -rf .next`, `npm run dev` before handing off for browser testing.
- Summaries to the owner in product-owner voice (UX behavior, not file paths).
- After the build: offer `/simplify` (new TopTabs abstraction + the 4th copy of the tab list — plan §8 Phase 4 consolidates to one shared config) and then `/review` (high-risk: routing gate + SW + auth-adjacent chrome). Offer `/docs` — the More sheet's retirement and the new tabs change documented fan/organizer flows.
