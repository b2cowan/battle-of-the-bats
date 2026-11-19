# PM brief — a game can't start before the games it depends on

**Priority:** Normal. Stage 9 of the public tournament pages project. Drawn and ruled 2026-11-18; nothing built.

**What it is.** The tournament schedule refuses to save a game that starts before a game it waits for has ended — a
Final before its Semifinals finish, a 3rd Place game before the Semifinal whose loser it takes, or a playoff game
before its division's pool play is over. The refusal is made by the server, so it holds from every screen, for a
second admin, and for a stale page.

**Why it matters.** Families read the public Schedule in time order. A Championship listed between two Semifinals reads
as a mistake by the organizer, and it erodes trust in every other time on the page. On the day, a game scheduled
before its teams are known simply cannot be played.

**What the organizer sees.**
- A red line under the field that is wrong, naming both games and the way out: "Semifinal 2 ends at 4:30 p.m. The
  Final waits for its winner: start it at 4:30 p.m. or later, or move Semifinal 2 earlier." The same sentence in the
  game window, the phone's move sheet, Add game, the bracket editor and the rain delay.
- On the timeline, a refused spot turns red while dragging, so nothing lands and snaps back.
- A schedule that is already out of order shows it on open: both games wear a red "Out of order" chip, the health
  score counts it, and the Filter can find them. The organizer is never locked out: only a save that makes a new
  problem is refused.

**Who it affects.** Tournament organizers and admins. Families see nothing new, except that the public Schedule can no
longer show a final before its semifinals. Round-robin-only tournaments are unaffected.

**Decided.** Block the save (owner, 2026-10-29). All twelve design asks as recommended (owner, 2026-11-18): "after"
means after the earlier game ends; pool play counts, division-wide; existing bad data is shown, not locked; a
changed default game length is refused the same way; scripts and the demo's refresh are not held, and a build check
keeps every new screen behind the rule.

**Success.** No organizer can save a schedule where a game starts before one it waits for has ended, from any screen,
and every refusal tells them exactly what to change.
