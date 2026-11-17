# One attendance record — PM brief

**Owner ruling 2026-11-13** (said mid-walk §526, before its section 4). Plan: `ONE_ATTENDANCE_RECORD_PLAN.md`.
Replaces Stage 4b's "two records, the coach copies the family's answer in" design (Signed-in Family Stage 4b,
`SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md`), which was built on dev and never reached production.

## What changes

**One answer per player per game or practice, and anyone can set it.** A connected parent or the coach picks
In · Late · Maybe · Out. Whoever changed it last is the answer. Both sides see who set it and when, plus the
answer before it ("Out · Coach, today · earlier: In (Adasmom, Nov 1)").

- **Before the event:** families and the coach both change it freely. A parent who answered In two weeks ago
  and then tells the coach in person "we can't make it" is covered — the coach switches it to Out; the parent
  can switch it back if plans change again.
- **Once the event starts:** families are locked out (as today). The coach can still correct it to what really
  happened — late, no-show.
- **Late before the game** is the coach's lineup signal: sit the first inning, bat lower.

**The coach's Attendance window gets simpler.** The "Family said" column and the "Use N family answers" button
go away — there is nothing to copy. One answer per player, with who set it. "All in" fills only players nobody
has answered for; it never overwrites a family's answer.

**What a parent sees:** their own child's current answer, including a change the coach made. Never a teammate,
never the coach's note. Attendance is not confidential (owner).

**Messages:** the coach still gets the bell when a family changes an answer. Families are NOT told when the
coach changes one — the parent already knows their own child isn't going. Remind skips any player who has an
answer, whoever set it.

**Notes:** one answer, two notes — the family's note (the coach reads it; deleted 30 days after the event) and the
coach's private note (staff only).

## Why

The two-record design made the coach re-enter what families had already said, and left two places that could
disagree. Every team app the owner's families use (TeamSnap, GameChanger, TeamLinkt) runs one shared answer.
The reason for two records — keeping the coach's attendance stats clean — is kept by the lock at the start:
after that, only the coach writes, so the record after the game is the coach's.

## Trade-offs accepted (owner, 2026-11-13)

- A family "In" the coach never corrects counts as attended in the stats (Season Wrapped, the player page, the
  family recap). Owner: fine.
- The parent sees the coach's change on their own child. Owner: fine — attendance isn't a secret.
- Who-said-what and family notes are purged on a clock; the attendance itself is kept forever. Owner: fine —
  the attendance is what matters historically.

## Priority and success

Before Stage 4b ships anywhere: none of the family-answers work is on production, so this is the cheapest
moment. Walk §526 is paused at section 4; sections 1–3 stand, with short re-checks for what changed for families.

**Success:** a coach never copies an answer; a parent and a coach looking at the same player see the same answer
and who set it; the coach's stats after a game match what the coach recorded; the rewritten walk is ~20–50 steps.
