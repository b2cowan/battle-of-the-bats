# PM brief — a game can't start before the games it depends on

**Priority:** Normal. Parked until the weekly usage refreshes (weekend of 2026-11-01).

**What it is.** The tournament schedule editor refuses to save a schedule in which a game starts before a game it depends on — for example a Championship before the Semifinals that feed it.

**Why it matters.** Families read the public Schedule in time order. A Championship listed between two Semifinals reads as a mistake by the organizer, and it erodes trust in every other time on the page. Organizers should not be able to publish that by accident, and the product should not rely on them noticing.

**What the organizer sees.** A clear message naming the two games, for example "The Championship can't start before Semifinal 2 (3:12 p.m.)", wherever a time can be changed: editing a game, dragging on the grid, moving several games, and generating a schedule. The save is blocked until it is fixed.

**Who it affects.** Tournament organizers and admins. Families see nothing new, except that the public Schedule can no longer show a final before its semifinals. Round-robin-only tournaments are unaffected.

**Decided.** Block the save (owner, 2026-10-29).

**Still to decide before building.** Whether a same-start-time is allowed, whether a game needs a minimum gap after the one before it, whether playoffs must also follow the last pool game, and how already-saved out-of-order schedules are handled.

**Success.** No organizer can publish a schedule where a game precedes one it depends on, from any screen, and the message tells them exactly what to change.
