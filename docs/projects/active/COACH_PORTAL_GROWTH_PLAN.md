# Coach Portal Growth — Free→Paid Feature Education + Cross-Shell Continuity — Implementation Plan

> **Status:** ACTIVE — created 2026-06-17. Phase 1 (quick wins) BUILT this session; Phases 2+ planned.
> **Branch:** `dev` (single shared branch).
> **PM brief:** [COACH_PORTAL_GROWTH_PM_BRIEF.md](COACH_PORTAL_GROWTH_PM_BRIEF.md)
> **Spun out of:** [COACH_EXPERIENCE_WALKTHROUGH_PLAN.md](COACH_EXPERIENCE_WALKTHROUGH_PLAN.md) (the Fees-page walkthrough surfaced the two questions this plan answers).
> **Source analysis:** 9-agent strategic workflow (`coach-portal-strategy`, 2026-06-17) — 4 current-state readers + design/marketing/ux/product lenses + synthesis. Findings summarized below.

## The two questions this answers

1. **Feature education** — each free Coaches-Portal screen (Roster / Schedule / Fees / Announcements / Overview) is a *light version* of a paid one. How do we give non-intrusive, per-page information about what the paid (standalone Coaches Portal Premium / Club coach module) adds, with links to learn more + express interest — **without making the free tool feel crippled or naggy**?
2. **Cross-shell continuity** — the free coach portal looks/feels quite different from the tournament admin. Is the divergence intentional? When a coach upgrades / runs their own event, should it feel like the same product? How do we reconcile it?

## Strategic findings (from the analysis)

- **The free portal already has a solid upsell stack** — the Explore catalog (rediscovery hub + "turn on" + a soft org nudge), `ScopeCeilingInterest` (interest capture on Overview), `CoachOverviewInvite` (dismissible roster nudge), and `CoachStartInterest` at `/coaches/start` (the canonical express-interest lead form, because self-serve standalone checkout is **gated/not yet open**). **The gap is section-level**: once a coach is actively *working* in Roster/Schedule/Fees/Announcements, nothing on that page names what the paid version adds. → Question 1 is an *extend*, not a rebuild.
- **The visual divergence is partly intentional, partly drift.** Intentional + correct: the coach portal is a warm consumer surface (rounded, sans-serif, lime-on-surface); the tournament admin is a dense "broadcast cockpit" (2px radius, IBM Plex Mono, blueprint-grid, density toggle). That persona split is *right* and should be kept. The drift is in the **brand chrome** — two different logo lockups (admin = text-only "FieldLogicHQ" wordmark; coach = filled lime "FL" square), and enough other differences that the upgrade moment can read as "two different companies." Shared accent (`--logic-lime` = active) is the one continuity thread; it isn't enough alone.
- **There are THREE shells a coach can traverse** — (1) free org-less `/coaches/team/[id]/*` (`CoachPortalShell`), (2) the **already-built, live** paid portal `/{orgSlug}/coaches/*` (`CoachesSidebar`, the team-workspace org slug), (3) the org **admin** shell `/{orgSlug}/admin/*` if they run their own org/tournament. The **free→paid coach** jump (Seam A) must feel seamless; the **coach→admin** jump (Seam B) is a *legitimate* mode change (different job) — mitigate with an obvious "back to Coaches Portal" door, do **not** unify.
- **Recommended relationship: "one brand, two dialects."** Converge the brand wrapper (logo device, status chip, the lime-active rule, a back-link); keep the two personalities (density, radius, typography, the cockpit grid). A blended middle pleases no one.

## Cannibalization guardrail (carry into all upsell copy)

Standalone Coaches Portal Premium (~$29/mo) must not quietly undercut Club (~$179/mo). The honest differentiator is **org data-sharing**: a coach *inside* a Club org gets roster → org records, attendance → org dashboards, finances → org ledger — which the standalone cannot replicate. This must be the emphasis in Club-tier coach messaging, not price. (Currently under-stated in product copy.)

## Voice rules for every upsell string (non-negotiable)

Outcome before feature; validate the free surface every time ("…is included free forever"); full plan names; **"express interest"** not "sign up"/"waitlist" (self-serve coach checkout is gated); forbidden words: unlock / supercharge / level up / powerful / robust / seamlessly / etc. All user-facing strings get a `/marketing` sign-off before final.

---

## Phases

### Phase 1 — Quick wins (BUILT 2026-06-17 this session) ✅
1. **Per-page feature-education strip** (`ScopeShelf`) on the four Tier-2 section pages (Roster / Schedule / Fees / Announcements). A *quiet* card anchored at the **bottom** of the page, below the coach's working content; only renders once the section has real content; **dismissible → degrades to a faint "what this adds →" link** (mirrors `CoachOverviewInvite`'s `useSyncExternalStore` localStorage pattern). Each strip names 2–3 specific paid outcomes, validates the free surface, and offers an **Express interest** ghost CTA → `/coaches/start?source=scope_shelf_{section}` + a quiet pricing link. Per-section copy drafted to the voice rules (→ `/marketing` to bless).
2. **Brand-chrome convergence (start):** add the filled lime **"FL" logomark** to the admin sidebar (currently text-only) so both shells lead with the same mark; surface an always-visible **"Coaches Portal"** continuity link in the admin sidebar footer for users who have a coach assignment in the current org (`hasCurrentOrgCoachAccess`) — today that link only appears buried in the rep-teams nav.

### Phase 2 — Brand-chrome convergence (remainder) — ~1 sprint
- Normalize the **lifecycle/status chip** to one shared component with a `variant="coach"|"admin"` (radius is the only difference: 6px vs 2px). Today the coach pulsing-dot LIVE chip and the admin flat "● Live" pill are separate.
- Normalize the **sub-label token** (the small-caps contextual label under the brand lockup) to one shared class across both shells.
- **Audit the paid `/{orgSlug}/coaches` portal** to confirm `CoachesSidebar` is NOT inheriting the admin shell's `h1/h2` mono+lime cascade or the blueprint-grid / 2px-radius — the paid coach portal must read in the **coach** dialect (this is Seam A, the most important continuity moment). Fix any bleed.
- Document the **"two dialects" contract** in the design system reference so contributors don't cross-pollinate.

### Phase 3 — Upgrade-moment continuity — ~1 day, pairs with self-serve open
- One-time **welcome state** on the paid portal landing (`/{orgSlug}/coaches?success=1`): "Your Coaches Portal Premium is ready — your [team] tournament history is linked." The word *linked* closes the "did I leave my data behind?" loop (the brand's "carries over automatically" bridge message).

### Phase 4 — Funnel instrumentation — ~1 sprint
- Enrich the express-interest payloads (`ScopeShelf`, `ScopeCeilingInterest`) with which section/feature triggered, activated-features, and time-since-first-use — so we learn which capability to lead with when self-serve opens, and which strips convert.

### Phase 5 — Open self-serve Coaches Portal Premium checkout — gating + Stripe, ~1 sprint
- The upsell infrastructure is ready; flipping the gate turns the express-interest CTAs into real checkout (label change only). Lead the checkout copy with whatever Phase-4 data says converts. **Not blocked by** the brand-chrome work.

### Phase 6 — (Deferred, Large) Modal-layer admin inside the coach shell
- For team-workspace coaches who also run a tournament: render admin UI as a full-screen overlay that closes back to the coach shell instead of a hard shell swap. Architecturally significant; only worth it once real usage data shows coaches hit this flow.

---

## Risks
- **Free-feels-crippled / naggy** → strips stay *below* working content, only after content exists, always dismissible-to-faint, always validate the free surface. If a coach ever feels nagged, we've over-built.
- **Cannibalization** (standalone vs Club) → the org-data-sharing firewall is the messaging emphasis (see guardrail above).
- **Express-interest not checkout** → self-serve coach Premium is gated; all CTAs say "express interest" until Phase 5. Label-only change later.
- **Admin shell blast radius** → the Phase-1 admin changes touch a shared component used by every admin page; additive only, `/review` required.
- **Brand-voice traps** → every string reviewed against the forbidden list + `/marketing` before ship.
- **Naming inconsistency** → product uses both "Coaches Portal" (free) and "Coaches Portal Premium" (paid) and the brand doc says "Coach Portal" (singular). `/marketing` to reconcile the canonical name; Phase-1 copy matches shipped "Coaches Portal Premium".

## Recommended sequencing (effort)
1. Phase 1 quick wins — **S** (this session).
2. Phase 2 brand-chrome remainder + paid-portal cascade audit — **S–M**.
3. Phase 3 welcome state — **S** (with Phase 5).
4. Phase 4 instrumentation — **M**.
5. Phase 5 self-serve checkout — **M** (own initiative; not blocked by 2–4).
6. Phase 6 modal-layer admin — **L**, deferred.

## File map (Phase 1)
| File | Change |
|---|---|
| `components/coaches/ScopeShelf.tsx` (+ `.module.css`) | NEW — the per-page feature-education strip (quiet card + dismiss-to-faint) |
| `app/coaches/team/[basicTeamId]/{roster,schedule,fees,announcements}/page.tsx` | render `ScopeShelf` below the editor, gated on "has content" |
| `components/admin/AdminSidebar.tsx` (+ `.module.css`) | "FL" logomark in the logo block; coaches-portal continuity link in the footer for coach-admins |
