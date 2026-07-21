# PM Brief — Tournament Nav Unification (Unified Home IA · Phase 5)

**Date:** 2026-07-20 · **Status:** Direction + 3 decisions owner-ratified; scoped as a distinct phase, sequenced after current Unified Home phases commit · **Plan:** UNIFIED_HOME_TOURNAMENT_NAV_MERGE_PLAN.md · **Mockups:** interactive artifact (branded top tabs + neutral global bar), 2026-07-20

## What changes for users

Today the app has two faces that never share a screen. Out in the app you get the **Home · Scores · Chat · Account** bar. The moment you tap into a tournament, that bar vanishes and the tournament's own bar (Home · Schedule · Standings · Teams · More) takes over — and the only way back to the rest of the app is a link buried inside "More."

After this change, **the Home · Scores · Chat · Account bar stays on screen everywhere, including inside a tournament.** The tournament's own pages move up into a **horizontally-scrolling tab row** under its branded header — the same shape as the GameChanger team screen. So a fan browsing a tournament always has a one-tap way back to the app, and Chat (with its unread badge) is reachable from every page.

**What the fan sees inside a tournament:**
- The **branded event header** stays (org name, tournament title, dates, status) — the whole page keeps its custom colours/logo exactly as today.
- A **scrolling tab row** directly beneath it: **Overview · News · Schedule · Standings · Teams · Rules** (only the pages that tournament actually publishes; hidden pages simply don't appear). The tournament's landing tab is called **"Overview," not "Home"** — so there aren't two "Home"s on one screen meaning different things.
- The **global bar** persists at the bottom, in a **platform-neutral (dark) skin** — it does *not* recolour to each tournament's brand; only its active tab borrows the tournament's accent. It reads as "the app," not part of the venue.
- A small **identity chip** in the header keeps the doors that don't belong on a public tab: Coach view / Open admin / Scorekeeper (only if you hold that hat), the fan alerts bell, follow-a-team, and sign in/out.

**News and Rules come back as real tabs.** They were pushed into the "More" sheet only because the old bar ran out of slots; the scrolling row removes that limit. Four cross-app links in today's "More" sheet (Following, Your FieldLogicHQ, Browse tournaments, Live scores) **retire** — the always-visible global bar now covers them.

**Desktop barely changes.** It already puts tournament pages up top (a side rail on wide screens); it just gains a thin global strip above the existing chrome. The organizer keeps full ownership of the page.

## Why it matters

- **Closes a gap we parked on purpose.** When the consumer layer shipped, we knowingly deferred "there's no way back to the directory from inside a tournament" pending a dedicated design round. This is that round.
- **Makes it feel like one product.** The single always-present bar is the difference between "two apps stitched together" and one app — the core goal of the whole unification effort.
- **Strengthens the acquisition loop.** Every tournament page becomes a standing, passive doorway back into the platform (other live events, your follows, chat) instead of relying on a fan remembering a URL.
- **A net simplification.** Retiring four now-redundant menu doors and restoring News/Rules as tabs leaves the "More" sheet leaner, not fatter.

## Owner-ratified decisions (2026-07-20)

1. **Direction:** the recommended blend — branded top tabs + a platform-neutral global bar (active tab tinted to the tournament accent). Not the literal warm-bar version, not the do-less chip.
2. **Global-bar skin:** platform-neutral everywhere; only the active tab borrows the brand accent. (GameChanger precedent — the bar is the app's, not the venue's.)
3. **Tier gating:** every plan tier gets the global bar, no dial-back for paid/branded events. The biggest branded events draw the most one-time visitors — exactly who's worth keeping in the app. Restraint is cosmetic (thin, quiet), never "hide it for Plus."

## Deliberate supersession

This reverses a previously-logged rationale ("the tournament nav fully replaces the consumer nav on entry, so there are never two nav bars stacked"). That was parked *pending exactly this design round*, so this is a planned resolution, not a contradiction. It also touches the earlier "clean theme handoff" and "More-sheet bottom nav" (G5) decisions. All three get an explicit supersession entry in the design log once build begins, so a future agent doesn't revert it.

## Rollout shape

Sequenced as **Phase 5**, after the current Unified Home phases are committed and owner-tested (a clean checkpoint). Phase 0 is a **mobile vertical-space budget pass + these mockups approved** — no code until that's signed off. Then: routing + top-tabs component + retire the tournament's own bottom bar (they can't coexist) → chrome-height/offset re-derivation + shared-device identity safety + service-worker refresh → desktop strip + admin-preview parity. Org-level (League/Club) public pages adopt the same pattern as a fast follow, not in this round.

## Success criteria

Fans reach Home/Scores/Chat from inside a tournament without opening a menu; no measurable drop in tournament-page load/scroll performance; branded events still read as the organizer's own space (neutral bar reads as quiet app chrome, not competing brand); no regression to the just-shipped Tournament Mobile Polish baseline; the "More" sheet gets simpler, not more crowded.

## Risks accepted / managed

The hardest problem is **mobile vertical space on game day** (branded header + score ticker + top tabs up top; my-team dock + global bar down bottom) — mitigated by a dedicated space-budget pass on a small phone before any layout code. Shared-device privacy is carried forward from the existing fix pattern (no personal identity baked into cacheable tournament pages — resolve it client-side). The tournament's own bottom bar is fully retired the moment top tabs ship, so the two can never collide. Full risk register and the where-does-each-door-go map live in the plan.
