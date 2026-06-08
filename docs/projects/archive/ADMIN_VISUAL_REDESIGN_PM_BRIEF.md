# Tournament Admin — Visual + UX Redesign PM Brief

Started: 2026-06-02
Plan: `docs/projects/active/ADMIN_VISUAL_REDESIGN_PLAN.md`

## Proposed functionality

Elevate the tournament admin experience organizers use to *run* their events — making it feel like a purpose-built, broadcast-grade game-day command center rather than a dense desktop tool viewed on a phone. Mobile-first (organizers operate live from the bleachers: check-in, scoring oversight, fixing the schedule), desktop second. This is the premium "wow" layer on top of the already-in-flight functional mobile fixes (`codex_TOURNAMENT_OWNER_MOBILE`) and per-page consistency cleanup (`agent_TOURNAMENT_DESIGN_REVIEW`) — it does not redo them.

Highlights: a persistent mobile top bar (with the notifications bell that is currently invisible on phones) + quick tournament switch; a dashboard that reshapes itself by lifecycle (setup checklist → live operations board → wrap-up); glanceable "in-progress / next / overdue" game rows; thumb-friendly score entry and swipe-to-accept registrations; a real mobile bracket view plus broadcast-grade connector lines + champion spotlight on desktop; a fast gate check-in mode; and a system-wide foundation (comfortable/compact density, tabular numerals, unified bottom-sheets, skeletons, reduced-motion, subtle live presence) that keeps the dark terminal HUD intact.

## Why it matters

The public tournament pages are the best-selling surface and just got a premium pass. The admin is where organizers spend their highest-stakes minutes — on-site, on a phone, under time pressure. Today that experience is desktop-first and uniform across the whole event lifecycle. Closing that gap protects setup completion, builds tournament-day confidence, and strengthens the case for Tournament Plus (the operations upgrade). A polished, legible, fast game-day cockpit is a direct differentiator for the organizer persona.

## Expected customer impact

Tournament owners/admins will be able to:
- Run a live event from a phone with a cockpit that always shows which tournament they're on, whether it's live, and what needs them — including notifications, which are unreachable on mobile today.
- See at a glance what's in progress, next, and overdue, and score games with thumb-sized controls.
- Accept/triage registrations and check teams in at the gate quickly.
- Build and edit brackets on mobile (today desktop-only) and present a broadcast-grade bracket on desktop.
- Read the screen in sunlight (comfortable density + legibility floor) without power users losing the dense compact layout they rely on.

Entitlements are unchanged. Plus locks stay compact and explained. Some Phase D items (gate check-in, on-site payment capture) may surface product/gating decisions before build.

## Priority

High for the organizer persona and the "make the product feel premium end-to-end" goal; sequenced after the functional mobile floor and per-page cleanup land. Phases A–B are the highest leverage and lowest risk; C adds the marquee builder/bracket work; D holds the bigger bets (check-in, visual schedule timeline, offline resilience).

## Success criteria

- Mobile admin reads as a first-class operating mode, not a squeezed desktop layout (design principle updated to match).
- The terminal/HUD language is fully preserved — no consumer-app drift; desktop density is never regressed.
- On a live tournament at 390×844: no bottom-nav overlap or horizontal overflow, ≥44px game-day touch targets, reachable notifications, and a lifecycle-aware dashboard.
- Live/score/count animations are smooth, key-stable (no re-fire on poll), and fully disabled under reduced-motion.
- Each phase is independently shippable and browser-verified across dark/light, compact/comfortable, branded/default org, and draft/active/completed states.
