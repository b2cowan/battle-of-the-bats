# PM Brief — Coaches Experience End-to-End + "Wow" Pass

**Status:** Audit complete + plan written 2026-06-05 · awaiting sign-off to build
**Plan:** [COACHES_EXPERIENCE_EVAL_PLAN.md](COACHES_EXPERIENCE_EVAL_PLAN.md)

**One line:** Turn the tournament coach's journey — from registering a team to the final whistle —
into one coherent, premium experience, fix what's broken, let coaches submit their roster ahead of
game day, and tastefully show them what FieldLogicHQ can do for their team and their organization.

## What the audit found
The coach portal is the one major surface that never got the premium treatment the public site and
the admin cockpit received. It has **no consistent shell**, a **styling bug** that makes it look
broken, **no way for a coach to see what they owe or whether they're checked in**, and it is
**completely disconnected** from the live, broadcast-grade game-day experience that already exists on
the public pages. Its home screen also pushes "Basic vs Premium" tiers, which contradicts our rule
that a participating coach simply has "their Coaches Portal." And the roster-submission feature the
coach journey needs doesn't exist yet (though the data is ready).

## What changes for the coach (plain language)
- **A real home base.** A consistent, branded Coaches Portal with proper navigation on phone and
  desktop — not a set of disconnected pages.
- **They always know what's next.** Each team shows a living "Team HQ" that changes as the event
  approaches: pending → accepted (with a simple checklist: roster, fee, check-in) → "first pitch in
  N days" → a live scoreboard on game day → their final result and placing.
- **No more "what do I do now?"** They can see their fee status (owed / paid / due date) and their
  check-in status right in the portal.
- **They submit their roster ahead of time** (names, numbers, birthdates), so the gate on game day is
  just a quick confirmation.
- **The game-day magic comes to them.** Follow their team, get score alerts, install the app, and tap
  straight to their live game — all from the portal.
- **A proud finish.** After the event, their result and placing live in the portal with a share card.

## Continuity, multiple teams & helpers (decided 2026-06-05)
- **Their data follows them.** A coach builds their roster once on their team; it's reused across
  every tournament and is ready to carry into a paid Coaches Portal if they upgrade later — nothing is
  re-typed and nothing is stranded.
- **A coach can run several teams.** The portal is built so a coach with multiple teams switches
  between them cleanly; each team has its own HQ.
- **Assistant coaches: not yet, but planned for.** This project keeps one owner per team; we're
  building it so inviting assistant coaches can be added later without rework, once we set a clear
  privacy stance for player birthdates.

## Role-based access
Coaches are **not** org admins. Everything here is the standalone tournament coach portal at
`/coaches/*`, gated by the coach's own email matching their team registration — separate from the
org-scoped rep-teams portal. No admin surfaces change (the gate check-in board already reads roster
status).

## Why it matters (growth)
Every participating coach is a high-intent future customer — for their own team (Coaches Portal) and
as a champion who can bring their whole organization onboard. We deliver enough value that they want
FieldLogicHQ for themselves, then make **one tasteful ask at the afterglow** (never an upsell barrage):
keep this team going year-round, and/or "is your association looking at something like this?" Every
surface before the afterglow stays pitch-free.

## Priority, sequencing & success criteria
Closing phase of the Gate/Team Check-In project. **Foundation first, five phases A→E:**
A foundation/shell/correctness → B payment & status visibility → C roster submission → D phase-adaptive
Team HQ + game-day bridge → E afterglow.

**Success:**
- The portal has a consistent shell and no styling/brand-rule defects.
- A coach can see fee + check-in status and submit a roster that shows as "Submitted/Confirmed" at the
  gate.
- The Team HQ evolves through the lifecycle and bridges to the live game-day experience.
- The afterglow surfaces the result + a tasteful, value-first growth moment.

## Tiering
Tournament + Tournament Plus (the coach-facing tournament journey). Informs the future standalone
Coaches Portal ($19 org-billed / $29 standalone) but is not gated behind it. Score alerts remain the
Plus fan feature.
