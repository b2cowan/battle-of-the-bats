# PM Brief — Bracket Builder Free vs Paid UX Improvements

**Status:** Planned · 2026-06-12 · roadmap
**Plan:** [BRACKET_BUILDER_TIER_UX_PLAN.md](BRACKET_BUILDER_TIER_UX_PLAN.md)

## What this is
A prioritized polish pass on the two playoff-bracket experiences: the **free** hand-built bracket builder and the
**paid (Tournament Plus)** auto-generator. The split already shipped; this makes the free side feel *complete and
confident*, the paid side *clearly more powerful*, and the line between them *honest*.

## Why it matters
The free manual builder is now a real differentiator (most competitors paywall bracket building entirely). But a few
gaps make it feel unfinished — you can't reopen a saved bracket to edit it, venue is forced even when you want to
schedule later, and an out-of-order game isn't flagged once saved. Closing these makes free credible on its own, which
in turn makes the paid auto-generator an obvious time-saver rather than a paywall.

## Highest-impact changes (Phase 1)
- **Edit your saved bracket** without deleting it (reopen the builder loaded with the current bracket).
- **Leave venue/date blank (TBD)** so you can lay out the structure first and schedule later.
- **See a warning** on any game accidentally scheduled before the game that feeds it — right in the bracket view.
- **Clearer labels**: "Build Bracket Manually" (free) vs "Auto-Generate (Tournament Plus)" — so nobody's confused
  about what's free and what the upgrade buys.
- **Live bracket health** in the free builder (unscheduled count, ordering issues) as you edit.

## Customer impact
- Fewer dead-ends and "why won't it save?" moments for free organizers.
- A confident, professional bracket experience on the free tier.
- A crisp, well-signposted upgrade story (manual = free, automation = Plus) shown at the right moments.

## Priority
Medium-high for the Phase-1 P0 set (small/medium effort, no migration, high impact). The Plus post-generation
flexibility (edit/lock/regenerate-preview) and mobile polish are strong follow-ons.

## Success criteria
- A free organizer can build, edit, and reschedule a bracket end-to-end without clearing it.
- No bracket can be published with a game scheduled before its feeder without a visible warning.
- Free vs Plus is unambiguous in the UI, and the auto-generate upsell pre-announces its value.

## Open decisions for the owner
See the plan's "Open questions" — chiefly: build the Edit-Bracket reload now?; make venue fully optional vs
soft-warn?; how aggressive should upsell be?
