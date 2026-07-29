# Build Prompt — Free Coach Portal: Phase B3 (Premium bridges)

Paste everything below this line into a fresh chat.

---

Run Phase B3 of the Free Coach Portal Experience project — the premium bridges.

Context to load first, in this order:
- `docs/projects/active/FREE_COACH_PORTAL_EXPERIENCE_PLAN.md` — read the **header
  (the PROCESS GATE is binding)**, then the **A3 + A4 + B1 BUILD RECORDS** (they
  describe the surface you're adding to, and several B3 premises are now stale —
  see "Re-base first" below), then the **B3** section itself.
- Auto-memory: `project_free_coach_portal_experience` (current state + the owner
  styling calls), `reference_coach_portal_arch_decision`,
  `project_founding_season_coaches_free`, `marketing_brand_voice`.
- `docs/agents/strategy/PLAN_PRICING_FACTS.md` — **canonical** for every plan
  name, price, gate and inclusion. Never restate a price from memory or from
  another doc; if anything disagrees with this file, that's drift → flag to
  `/strategy`, don't silently write a new number.
- `docs/projects/active/FREE_COACH_PORTAL_EXPERIENCE_PM_BRIEF.md` — product framing.

## State as of 2026-07-27

Tranche A + B1 are **COMMITTED on dev**: A1 `23492301`, A2 `6e76c6a5`,
A3 `d8f7850a`, A4 `fec03c9a`, B1 `31f49194`. A production release was in flight
at the time this prompt was written — **check whether these are on prod before
assuming anything about what customers can see.**

## Re-base first — three B3 premises are out of date

The plan's B3 section was written before A3/B1 shipped. Verify against the code,
not the plan text:

1. **B3.1 says "lead the *That's a wrap* block with the coach's real result".**
   A3 **dissolved** that block. The result now lives in the hero's result card
   (with the share button in it), and a separate afterglow strip sits under the
   hero carrying the thanks line + `ScopeCeilingInterest` + organizer line, free
   tier only. So B3.1 is really: *make the afterglow strip lead with the result
   and say what Premium preserves* — and fix the reliability problem noted in the
   plan (the strip silently vanishes when its linked-team lookup fails for a
   register-flow-only coach).
2. **B3.3 (multi-game-day lineup callout)** targets the live schedule, which B1
   restructured (rows are no longer a single anchor; venues are their own links).
   Read `CoachLiveSchedule.tsx` as it is now.
3. **B3.2 (second-tournament nudge)** targets the team tournaments list, which
   A3.3 replaced with the shared `CoachRegistrationCard` across three routes.

## The constraint that matters most

**The tournament record is a SHARED surface** (free + Premium call sites) by
standing rule: tiers differ in season tools, never in the tournament experience.
B3 adds **upsells**, which is exactly the thing that must NOT reach a paying
coach. Every B3 element on that surface has to be gated on `suppressUpsell`
(the Premium call site passes it) — verify each one, and make it a review lens.
The `moneyRedacted` seam must also still hold.

Also: all new copy reuses the **existing** `checkoutOpen` /
`isFoundingSeasonPromoActive('team')` gates in `lib/plan-config.ts`. Do not
create a new pricing surface, and do not hard-code a price or a date.

## Process (binding)

1. **Mockups FIRST.** B3 places visible upsell moments — the PROCESS GATE in the
   plan header applies. Present mockups during planning and get owner approval
   BEFORE any build code. Approved mockups ARE the visual spec, including
   existing elements (label NEW / RESTYLED / MOVED / UNCHANGED). Show each bridge
   in its real phase and in BOTH themes (warm + dark), and show the Premium
   (`suppressUpsell`) frame proving the ask is absent there.
2. Present the **plain-language PM/UX summary** before implementing (AGENCY_RULES) —
   written for a product manager: what a coach sees and does differently, who sees
   it (free vs paying), why it matters, and any tradeoff taken. Blocking: no code
   until it's been presented.
3. **Update `FREE_COACH_PORTAL_EXPERIENCE_PM_BRIEF.md` in the same unit of work.**
   B3 changes what customers are offered and at which moment, which is exactly what
   that brief exists to record — outcome-focused, plain language, incl. expected
   customer impact and success criteria. Add the B3 build record to the plan doc
   too (same pattern as the A3/A4/B1 records).
4. `npm run typecheck` (shared record component), focused lint, and the token +
   date guardrails. `npm run verify:changed` may fail on FOREIGN work from a
   concurrent session — attribute failures before chasing them.
5. Run `/review` before calling the phase done, with a lens explicitly on the
   tier seam (`suppressUpsell` / `moneyRedacted`).
6. Full dev-server restart before handing off for browser testing (stop the
   server BEFORE deleting `.next`).
7. Offer `/docs` if any user-facing flow or plan-gating changes, and `/strategy`
   if a durable pricing/packaging decision gets made.

## Rules

- **`dev` branch only.** This working copy is SHARED with concurrent agent
  sessions — during the last session another agent committed schema-parity work
  and coach theming mid-flight. Re-check `git rev-parse --abbrev-ref HEAD` before
  committing, stage **explicit pathspecs only** (`:(literal)` for `[bracketed]`
  route dirs), and verify `git show --stat HEAD` after every commit.
- **Never commit without the owner's explicit per-action OK** — approval never
  carries across changes or turns.
- Report to the owner in **product-owner voice**: UX outcomes, not file paths.

## Known open items (not B3, don't silently absorb them)

- **Celebration watermark** — the last auto-initials device in the portal (9rem
  @ 0.07 opacity on the "That's a wrap" hero). Owner was informed and left it as
  texture; remove only if asked.
- **Admin-side animation bug** — `schedule-admin.module.css` animates
  `adminSlideDown`, which is defined in `admin-common.module.css`. A CSS Module
  cannot see another module's keyframes, so that animation silently no-ops. Same
  class as the 13 public animations fixed in `fec03c9a`. One-line fix, different
  area — its own unit of work.
- **`getStandings` reads platform-wide** — it takes no tournament id, so it scans
  the games/teams tables and narrows client-side. Pre-existing, but B1.6 added a
  high-frequency caller (every coach's record page during an event). Scoping it
  is a shared `lib/db.ts` signature change touching many callers.

## After B3

**B2 (coach alerts) is the biggest remaining gap** and deliberately sits last: a
coach currently gets NO notification of any kind when a game moves — a parent
following the team publicly gets more than the coach does. It needs a design
decision before any code (bridge basic-coach ownership into the existing fan push
pipeline, vs. extend `notify()` with a `coaches_basic` recipient shape), and it
has a live dependency: Android PWA push is broken on prod (see
`memory/project_push_delivery_diagnosis.md`).
