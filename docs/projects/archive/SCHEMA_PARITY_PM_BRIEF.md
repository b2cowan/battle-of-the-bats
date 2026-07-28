# PM Brief — Schema Parity (dev↔prod)

**Plan:** [SCHEMA_PARITY_PLAN.md](SCHEMA_PARITY_PLAN.md) · **Priority:** High · **Status:** ✅ **COMPLETE
2026-07-27 — 51 → 0 divergences.** Stages 2–4 (migrations 201/202/203) are applied to dev AND prod and
`check:parity` runs against an empty baseline. (Header previously said "Stages 2–4 awaiting owner
decisions"; trued up 2026-07-28 during the `active/` archive sweep, matching the plan's own status.)

## The problem in one line

Our test environment and our live environment are not the same shape, so "it worked in testing"
has not been a reliable promise — and three admin actions that work in testing **fail outright for
live customers today**.

## Why it happened

The app's original nine tables were built by hand, twice — once in each environment — in the first
ten days of the project, before we had migrations. Those two hand-builds never quite matched. Every
table created since (200+ migrations) is identical across environments. This is a one-time debt
from the project's first fortnight, not an ongoing process failure.

## What customers get

**Three bugs disappear.** Right now, on the live site:

1. **Deleting a venue fails.** An organizer who removes a field or facility gets an error, because
   the system tries to blank out the location on affected games and the live database refuses.
2. **Adding a venue without an address fails.** Address is optional in the form; the live database
   treats it as mandatory.
3. **Importing a registration list with a blank coach column fails.** Same mismatch.

None of these can be reproduced in testing, because testing allows all three.

**Two silent wrongs get corrected.** A tournament created without an explicit status is currently
born *finished* on the live site, and new tournaments default to *hidden* from the public directory
— reversing a decision already made on 22 July that never reached production.

**One data-loss trap gets closed.** Deleting a division currently removes every game in it —
scores included — with no warning and no undo. We'll add the same "this division still has games,
are you sure?" confirmation we added for teams last week. Organizers who genuinely want to delete
can still proceed; they just have to mean it.

## What the user sees and does differently

Almost nothing, and that is the point. This is plumbing. The visible changes are:

- Three admin actions that used to error now succeed.
- Deleting a division with games in it now asks for confirmation instead of silently destroying
  them (matching how team deletion already behaves).
- New tournaments start as *draft* and *listed in the public directory*, as intended.

No screens move, no terminology changes, no plan gating changes. **No role-based access
differences** — every change is either invisible or affects org admins/owners in the tournament
admin area only.

## Trade-offs made

- **We are not blindly making live match testing.** For five fields, live is *stricter* than
  testing. In two of those cases (announcement body, tournament web address) live is *right*, so
  testing gets tightened instead. Copying testing over live wholesale would have loosened two rules
  that should stay.
- **We keep "delete a division deletes its games."** The alternative leaves behind games belonging
  to no division and no team — junk that would surface as broken rows in schedules. The safety comes
  from the confirmation prompt, not from weakening the rule.
- **Sequenced by risk, not by convenience.** The 25 zero-risk items go first as one batch; the 23
  that change behaviour are each an explicit decision.

## Success criteria

- The parity check reports **0 divergences** (from 48) and stays there — it now runs on every build,
  so this cannot silently regress.
- The three failing admin actions succeed against the live database.
- Deleting a division with games returns a confirmation rather than destroying data.
- No customer-visible regression in tournament admin, registration, or scheduling.

## Risks

- **Low.** The live-data audit found zero rows anywhere that block the change — no backfill, no
  data rewrite. Every change is to schema rules, not to content.
- The one item that needs care is the division-deletion guard, because it changes an admin action's
  behaviour. It ships together with the database change so the two can never be out of step.
