# Player Profile — Wave B (PM Brief)

**What this is:** A second pass on a Premium coach's player profile that adds the
details coaches actually use day-to-day and pulls money/attendance onto the player.

**What the coach sees that's new:**
- A **Safety** area with allergies/medical notes and an emergency contact — the
  things you want one tap away at a field.
- **Throws / Bats** handedness and **jersey size** — for setting lineups and
  ordering uniforms.
- An **attendance snapshot** for the player (how many sessions they've made).
- The **Dues** area shows the player's real payment status instead of a "coming
  soon" placeholder, with a link to manage it.

**Why it matters:** These are the reasons a coach opens a player. Safety info and
quick contact reduce game-day scramble; handedness/size feed real workflows;
attendance and dues turn the profile into a single source of truth for that player.

**Customer impact:** The profile feels complete and coach-grade rather than a bare
contact card — reinforcing that Premium is worth the per-team charge.

**Priority:** High — part of the Premium portal readiness pass.

**Tradeoffs / sequencing:** The new fields need a small database change, so this is
split from the no-database Wave A polish. The attendance and dues views reuse data
we already capture, so they add insight without new data entry.

**Success criteria:** A coach can record safety/contact/handedness/size, see how
often a player attends, and see what they owe — all from one screen.
