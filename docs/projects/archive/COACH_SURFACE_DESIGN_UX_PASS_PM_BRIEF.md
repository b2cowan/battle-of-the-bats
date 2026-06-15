# Combined Coach-Surface Design/UX Pass — PM Brief

**Status:** Scoped 2026-06-14 (owner-approved to scope; not started). Plan: [COACH_SURFACE_DESIGN_UX_PASS_PLAN.md](COACH_SURFACE_DESIGN_UX_PASS_PLAN.md).

## What we're doing

The coach experience was built in slices — the free standalone team home over several phases, then the tournament-coach experience on top of a shared shell. Each slice was code-reviewed on its own, but **no one has ever looked at the whole coach experience as one assembled thing.** This is that look: a design + UX review of the entire coach surface together, producing the design specs the surface is missing.

## Why it matters

The journey audit (rep head coach J2, tournament coach J5) found the same pattern from two angles: the coach product is **polished for a 2-player demo and strains for a real team**. The shell looks the same whether a coach is preparing, owes money, is mid-game, or just won — and the most important buttons are often the quietest. None of that is a bug; it's missing *design*. The functional build plans are ready to implement, but several are **blocked on a design spec that doesn't exist yet** (what should each game-phase hero look like? what's the empty-state pattern? where does the money go in the hero?).

## What changes for the coach

Nothing ships from this pass directly — it produces specs. Once those specs are implemented by the owning plans, a coach sees: a portal that **looks different when something is happening now** (a live game, a fee due, a championship) instead of one flat template; **buttons that match their importance** (claim your team is loud, not a footer link); a team home that **holds a real 14-player roster** without feeling like a database dump; their **team colours** on their own home, not just the public page; and **empty states that look intentional**, not like broken pages.

## How we avoided duplicating the other project

This was cross-referenced finding-by-finding against the J2 + J5 reports and the journey-audit synthesis. **~36 of ~103 coach findings are design-coherence work; the rest are already owned** — security/correctness by FP-1, functional build by the Phase-5 slices and the coaches plans, email by the 5e work, IA-routing by FP-7, marketing by the free-tier strategy. The rule we set: **the owning plan keeps the implementation; this pass only produces the visual/interaction spec it feeds.** No finding is re-homed.

## Priority & timing

Medium. **Gated** — a concurrent session is actively reshaping the coaches portal right now, so running a holistic design review would be reviewing a moving target. Let the surface settle and coordinate with that work first; this pass should run *before* the build slices finalize their visual layer, not after.

## Success criteria

- A coach-surface design-system addendum exists: per-phase hero spec, button/chip hierarchy, empty-state component, team-colour rule, density/responsive rules.
- Each owning build plan has a design comp to implement against instead of inventing one.
- The genuinely design-only residual (typography/spacing/polish) has a small, owned fix list.
- Zero overlap with FP-1, the Phase-5 slices, the coaches plans, FP-7, or the email work.
