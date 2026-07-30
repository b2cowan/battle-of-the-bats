# Desktop Public UX — Phase 1 Hybrid (PM Brief)

**Date:** 2026-07-30 · **Status:** Approved, build not started · **Plan:** `DESKTOP_PUBLIC_UX_PHASE1_PLAN.md`
**Visual spec:** https://claude.ai/code/artifact/3d5f3540-6d91-4247-8745-348dcdb77d0a (Option 1 + Hybrid + Fan chrome sections)

## What's changing, in plain terms

Today the desktop website feels like a phone app pasted into a browser: a narrow phone-width column floating in a wide empty screen, app tabs (Chat, Account) shown to visitors who can't use them, no footer, no path to Pricing or the marketing pages from anywhere inside the product, and no hint that a mobile app experience exists. After Phase 1:

1. **The app screens grow up.** Home, Scores, and Account use the width of a real monitor — wider content, three-column tournament grids, and Scores shows every followed event at once instead of hiding them behind "+N more."
2. **Every screen has a way onward.** The footer (Pricing, Discover, What's New, For Coaches, Sign In) appears across the app and org pages, and a standing **Pricing** link joins the top bar everywhere.
3. **The top bar matches who's looking at it.** Anonymous fans on a tournament page get a minimal strip — Discover, Sign In, Run a Tournament — with no dead tabs or badges. Signed-in fans get a chat icon (with unread badge) only if they're actually in a conversation, plus a compact account avatar. Coaches and admins additionally get a persistent **Coaches Portal / Admin Area** pill on every screen — no more hunting for a buried card to reach their dashboard.
4. **"Run a Tournament" keeps its name but opens doors.** On desktop it opens a menu: organizing leads, with a quieter "More ways to start" group for coaching a team, joining a team, or running a league.
5. **The mobile app stops being a secret.** A QR code in the footer and on the Account screen says "Also on your phone" — the first time desktop visitors can discover the app at all.
6. **Org front doors work.** An org's public homepage nav (today: just a logo) gains Sign In, Pricing, and the coaches link.

## Why it matters

Desktop web is currently the platform's only acquisition surface, and its busiest pages (public tournaments) are dead ends. This phase turns every public desktop screen into either a better fan experience, a working funnel entry, or both — without touching the mobile experience, the shipped navigation model, or any big rebuild.

## Audience impact

- **Fans (signed out):** cleaner, less confusing tournament pages; no fake app chrome; easy path to follow, sign in, or discover the platform.
- **Fans (signed in):** roomier screens, all scores visible at once, chat where it's relevant to them.
- **Coaches/admins:** a permanent one-click door to their workspace from anywhere.
- **Prospects:** Pricing and the persona paths reachable from every screen; the app discoverable via QR.

## One open decision (blocks one small piece only)

Should paid-tier tournaments carry a small "Built on FieldLogicHQ" credit line? Today only free-plan events show any FieldLogicHQ presence — paying orgs' pages show none, which may be a deliberate paid perk. This is a packaging call to log via `/strategy` before that one line ships. Everything else proceeds regardless.

## Deliberately unchanged

Mobile layouts and bottom tabs; the Home/Scores/Chat/Account model; the tournament page's desktop sidebar; "Run a Tournament" as the CTA label; install-prompt behavior; free-plan badge behavior. Phase 2 candidates (companion rail, full desktop redesign, split-pane chat) wait for signup data.

## Success looks like

No desktop dead ends (a marketing path from every screen), zero inert chrome for anonymous fans, content using the real width of the screen, the app discoverable from desktop, and no change at phone sizes.

## How you'll test it (at handoff)

One pass per hat: browse a tournament signed out (minimal strip, no badges), sign in as a coach (pill everywhere, chat icon only with conversations), check Home/Scores/Account at full width (wide grids, footer present, QR visible), open the Run a Tournament menu, and confirm your phone still looks identical.
