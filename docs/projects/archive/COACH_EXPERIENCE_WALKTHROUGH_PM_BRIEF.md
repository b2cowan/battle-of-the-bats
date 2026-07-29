# PM Brief — Coach Experience Guided Walkthrough

**Status:** Active (started 2026-06-15). Pairs with [COACH_EXPERIENCE_WALKTHROUGH_PLAN.md](COACH_EXPERIENCE_WALKTHROUGH_PLAN.md).

## What we're doing (plain language)
We're walking through the entire coach journey the way a real coach would live it — from registering a team for a tournament, through their portal experience while waiting and after acceptance, the emails they get, signing up for the free coaches tier to run their own team, upgrading to premium, and using the premium tools. At each step the owner plays the coach (and, when needed, the tournament organizer), reacts to what they see, and we decide together what to fix.

## Why it matters
The free-tier coaches surface and the tournament-coach experience were built phase-by-phase but never reviewed **as one connected experience**. This walkthrough is the deferred holistic design/UX pass. It's how we make sure the coach's first impression is impressive, the next steps are always obvious, the emails drive low-friction action, and the free→premium story is clear and honest.

## Customer impact
- A coach who registers should feel "I'm in good hands" immediately — clear status, clear next step, no dead-ends.
- Emails should make required actions obvious and one-click.
- The free tier should feel genuinely useful for running a real team (not a 2-player demo), with an honest, motivating path to premium.

## Priority
High — this is the gate before the Coaches marketing flip (Phase 9 of the Free-Tier plan). Confusing or unpolished coach surfaces would undercut the launch.

## Success criteria
- All 8 steps walked with the owner; every friction/confusion point captured in the findings backlog.
- Each finding has a decision: fix-now, defer (with reason), or route to an existing journey-audit item.
- Fixes that change logic pass `/review`; design/copy changes reviewed against `/design` + `/marketing` canon.
- Net result: a coach experience the owner is confident enough to put in front of real customers.

## Notes / constraints
- Test coach account `b2cowan@outlook.com` was reset to a clean slate (seeded demo tournaments preserved).
- Email sending and premium-checkout are gated/unconfigured in dev; we resolve those per-step (see plan) so the walkthrough reflects real behavior without breaking demos.
