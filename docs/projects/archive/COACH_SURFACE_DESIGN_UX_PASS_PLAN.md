# Combined Coach-Surface Design/UX Pass — Plan

> **Status:** ✅ SPECS COMPLETE + 4 owner decisions RESOLVED 2026-06-14 — eval pass run + both deliverables shipped; the open decisions (findings §7) are ruled (variants stay **distinct** · **18%** wash · join-button **migrate to btn-lime** · monogram **`--font-display`**). Ready for the owning build plans to implement against. NOT built (spec pass). Findings + comps + route-back + residual → [COACH_SURFACE_DESIGN_UX_PASS_FINDINGS.md](COACH_SURFACE_DESIGN_UX_PASS_FINDINGS.md); locked reusable rules → [docs/agents/design/COACH_SURFACE_DESIGN_ADDENDUM.md](../../agents/design/COACH_SURFACE_DESIGN_ADDENDUM.md). Method: 13-agent workflow (6 grounded theme/seam reviewers → 6 adversarial design-coherence critics → 1 synthesis); all 6 themes accept-with-fixes + **dedup-clean** (no owned finding re-homed). The gating concern (a concurrent session reshaping the portal) cleared — Phase 5 is COMPLETE + browser-verified; the committed surface was reviewed.
> **Type:** `/design` + `/ux` REVIEW (eval → specs), not a functional build. **Owner agents:** `/design` (visual system), `/ux` (flow/IA). **Branch:** `feat/free-tier-coaches`.
> **Origin:** owner-deferred 2026-06-09 — the standalone Basic floor (Phases 1–4) + the tournament-coach experience (Phase 5) each got per-slice adversarial *code* review but were **never reviewed as one assembled experience** on the shared `TeamHQ` shell. PM brief: [COACH_SURFACE_DESIGN_UX_PASS_PM_BRIEF.md](COACH_SURFACE_DESIGN_UX_PASS_PM_BRIEF.md).
> **Cross-referenced against:** `journeys/JOURNEY_J2_REP_HEAD_COACH.md` (38) + `journeys/JOURNEY_J5_TOURNAMENT_COACH.md` (65) + `USER_JOURNEY_AUDIT_SYNTHESIS.md`. **~36 design-coherence findings are in-scope; the rest are owned elsewhere (see §De-dup).**

## Goal

Review the **whole coach surface as one assembled experience** — the org-less Basic floor *and* the tournament-coach experience on the shared `TeamHQ` shell — and produce the **design system + per-state specs** the surface lacks: phase-adaptive hero treatments, a consistent button/chip hierarchy, real-team density, team-identity application, and a coherent empty/first-run pattern. The output is design comps/specs the owning build plans consume — not a re-implementation of their functional work.

## ⚠️ De-dup boundary — the most important section (this is a SPEC pass, not a re-build)

The journey audit already routed every coach finding. **This pass does NOT re-own any functional, security, correctness, IA-routing, email, or lifecycle finding.** Many in-scope design items share an ID with an owned plan — the split is:

> **The owning plan owns the IMPLEMENTATION. This pass owns the visual/interaction SPEC the plan needs as input.** (e.g., J5-032 "four phases, one template": Phase-5 owns building the hero; this pass owns *what each phase's hero looks like*.)

### Explicitly OUT of scope (owned elsewhere — do NOT touch)
- **Security / correctness / data integrity** → **FP-1** (J5-026 mark-paid precedence, J5-035 metadata gate, J5-012 orphan teams, J2-035 ledger write) and Phase-5 bug-fix slices.
- **Functional build / missing features** → Phase-5 slices `5a–5o` (J5-018/025/030/031/039/040/042/043 UTC+bridge bugs, J5-027 roster, J5-050/051/054/058/059 afterglow build), `COACHES_EXPERIENCE_EVAL` + `coaches-a-e` (J5-015/019/021, J2-013/016/017/020/022), `FREE_TIER_COACHES_UNIFIED` (J2-010/011/018/025, signup/verify).
- **Email voice / correctness** → owned `5e` (J5-056/057/060/062/063/064) + T5 thread (J2-026).
- **Marketing flip / acquisition routing** → `FREE_TIER_STRATEGY` Phase 8/9 (J2-001/002/003/024). *(Phase 9 item #1 already built 2026-06-13.)*
- **Org-context & multi-module IA** → **FP-7** / T7 (J5-019, J2-012).
- **Lifecycle notifications** → owned Phase-5 / T4 (J2-025, J5-058).

If a finding is in those buckets, it stays there. This pass references it, never re-homes it.

## Surfaces reviewed (the assembled whole)
- **Standalone Basic floor:** `/coaches/team/[basicTeamId]` (team home), the Roster / Schedule / manual-fee-ledger / Announcements editors, first-run/empty states, the `TeamHQ` standalone variant + stat strip.
- **Tournament-coach experience:** the shared `TeamHQ` shell, phase-adaptive hero, `TournamentStatusBlock`, `CoachLiveSchedule` (game-day bridge), `TournamentRosterSubmit`, `HeadCoachEditor`, the afterglow.
- **The shared shell + the seam** between standalone and tournament modes (the whole point of "review it as one").

## In-scope findings, by design theme (Bucket A — the design-coherence residual)

### Theme 1 — The phase-adaptive hero that doesn't adapt *(highest-value output)*
The `TeamHQ` hero surfaces four distinct emotional states (prep / fee-owed / game-day / complete) from one near-identical template. Produce a **per-phase hero spec**.
- **J5-032** (umbrella — four phases, one template), **J5-041** (game day is the flattest state; needs a persistent Today card countdown→scorebug→final), **J5-049** (champion gets a shrug — trophy/placement/W-L-T/share spec), **J5-028** (fee hidden under a "You're in!" hero — amber money-strip spec; ← this is the owner-flagged **"double fee display"** glance-vs-detail item), **J5-029** (pending/waitlist info design), **J5-052** (completed = collapsed final-summary vs permanent open-problem checklist), **J5-034** (past-due urgency vocabulary), **J2-037** (BvA empty state reads as a broken page).

### Theme 2 — Shell coherence & button/chip hierarchy
The same design-system vocabulary (btn-lime / btn-ghost / btn-outline, chips, hero weight) is applied inconsistently across the shell; the most journey-critical buttons are often the quietest.
- **J2-032** (upsell card louder than the coach's own team; H1/breadcrumb collision), **J5-013** (claim-wall inversion — claimed teams first, group by team, disclose the rest), **J5-014** (no LIVE signal, uniform ACCEPTED chips — define the chip system), **J5-023 / J5-006** ("Claim team" is the quietest button; admin-added coaches get the smallest CTA), **J5-022** (no active tab on the team home), **J2-019** ("Add" actions as text links; section order; no hero), **J2-007** (the `/start` Coach card has no recommended-door signal — *note: partially addressed by the Phase-9 #1 Coach-card flip; revisit visual differentiation*), **J5-009 / J5-024** (segmented-control + join-screen type/spacing polish).

### Theme 3 — Real-team density vs demo polish *(the J2 through-line)*
Surfaces were built for shallow fixtures and strain at realistic data volumes ("polished for a 2-player demo, breaks for a real 14-player team").
- **J2-019** (free team home at 14 players), **J2-031** (680px lineup grid in a 720px sheet — mobile-first lineup spec), **J5-037** (desktop checklist values vanish across a full-width card), **J5-013** (16,000px claim wall at scale).

### Theme 4 — Team identity & the colour-wash gap
Both coach portals have `--team-color` available, but the standalone/free path gets the flattest variant while the public page gets a gold wash + monogram.
- **J2-023** (standalone `TeamHQ`: no team-colour header/monogram) ⟂ **J5-038** (portal hero plain near-black vs public page's wash). One decision (port the public wash/watermark to both coach shells) closes both.

### Theme 5 — Empty & first-run states that read as broken pages
No consistent "nothing here yet" pattern; several empty states look like errors.
- **J2-037** (BvA full-height void + ghost icon), **J2-036** (premium schedule void looks like a load failure; off-accent button), **J5-029** (pending info dead-end), **J5-046** (static mode dead rows — "Live scores unlock when…" content), **J2-015** (new team lands cold). Define one empty-state component pattern (lime-bordered card + copy structure + on-accent CTA).

### Minor design-voice / ethical-default items (fold in)
- **J2-029** (two labels for one gated destination — verb consistency), **J5-033** (waitlist headline branching), **J5-047** (check-in chip explainer), **J5-046** (static-mode copy), **J5-055** (scope-ceiling pre-checks 4/5 boxes — unchecked-by-default ruling), **J5-048** (public pre-results stat display).

## Deliverables (the shape of the work)
1. **Holistic `/design`+`/ux` review** of the assembled surface against the five themes → a findings doc with **design specs/comps** per state (not a re-list of the journey IDs — the *visual answer* to them).
2. A **coach-surface design-system addendum**: the phase-hero spec, the chip/button-hierarchy rules, the empty-state component, the team-colour-wash rule, density/responsive rules.
3. **Route the specs back to the owning build plans** (Phase-5 slices, coaches-eval, coaches-a-e) so they implement against a comp instead of inventing one — plus a small **design-only fix list** for the genuinely-unowned residual (typography/spacing/polish: J5-009/024/037, J2-029, etc.) that no functional plan will otherwise pick up.

## Sequencing & dependencies
- **GATED:** a concurrent session is actively reshaping the coaches portal (`8564624 feat(coaches): free-tier coaches portal…`). Reviewing a moving target wastes the pass — **let the coach surface settle + coordinate with that session first.**
- **Coordinate, don't collide:** Phase-5 build slices, `COACHES_EXPERIENCE_EVAL`, `coaches-a-e`, and `FP-1` own the implementations the specs feed. This pass produces input for them; it must run *before* they finalize the visual layer, or it's retroactive.
- **Not blocking:** the genuinely design-only residual (Theme 5 empty-state pattern, Theme 4 colour wash, typography polish) can be specced + built independently.

## Out of scope (explicit)
- Any functional/security/correctness/email/IA-routing/lifecycle finding (owned per §De-dup).
- The League/house-league surface, the public fan surface (FP-2), the volunteer shells (FP-3).
- Net-new coach features not already planned.
