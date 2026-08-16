# PM brief — removing a coach actually removes them

**Status:** planned 2026-08-16, owner-ruled, not yet built.
**Plan:** `COACH_CURRENT_STAFF_ACCESS_PLAN.md`.

## The problem, in one line

**Removing a coach from your team doesn't remove them.**

## What actually happens today

The staff list belongs to a season. When a head coach removes an assistant, they remove them from
*this* season — and nothing else. Every past season that assistant worked still lists them, and that
listing is what lets them sign in.

So the assistant you dropped in January can still open last year: the roster, the schedule, who
turned up, what families paid, the results. Nothing warns the head coach. The only way to genuinely
remove someone is to switch into every past season one at a time and remove them again — which
nobody would think to do, and nothing tells them to.

The sharpest version of the problem is that **there's no way to say what you mean.** A head coach
replacing an assistant and a head coach getting rid of one look identical to the system, and it
quietly assumes the second one keeps their access.

## What changes

**Your current staff are your staff.** Whoever is head coach and assistants right now can open the
team and everything it has ever done. Anyone else can't — and removing someone takes effect
everywhere, immediately, in one action.

Two calls made with it:

- **A current coach sees the whole team history**, not just the seasons they personally worked. A new
  assistant added today can look back at 2022. The history belongs to the team, and the people
  running it now are the ones trusted with it.
- **Removing someone doesn't erase them from the record.** Last season's staff list still names
  everyone who actually coached it, because that's true and worth keeping. What changes is that the
  name no longer opens a door. Add them back next year and their access returns instantly — nothing
  was thrown away.

## Who is affected

| Person | Today | After |
| --- | --- | --- |
| Head coach | Sees everything | Unchanged |
| Current assistant | Sees seasons they personally worked | Sees the team's whole history |
| Assistant removed this year | **Still reads every past season they worked** | No access at all |
| Coach whose season just ended | Keeps access | Unchanged — season over is not off the team |

## ⚠ One consequence worth deciding on knowingly

Until now, opening a past season showed you that season **as you were allowed to see it at the
time** — an assistant with no money access last year couldn't see last year's money, even after being
given money access since.

That rule can't survive "a current coach sees the whole history", because a coach looking at a season
they never worked has no historical permission to fall back on. So permissions become **the ones you
hold now, in every season.**

In practice: **an assistant you give money access to will be able to read every past season's dues
and family payments**, and one you give guardian-contact access to will see historical guardian
details. That's a real widening. It's defensible — they're current staff and you trust them with this
season's families, who are largely the same families — but it should be a decision, not a surprise.

If that's too wide, the fix is small and doesn't touch this plan: keep money and guardian details to
head coaches only, and let assistants see the rest of the history.

## Why it matters

A head coach who removes someone expects them gone. Today they aren't, and the gap is invisible from
every screen. This is the kind of thing you only find out about when it has already gone wrong.

## Success criteria

1. Removing a coach ends their access to the team everywhere, in one action.
2. A coach whose season has ended but who is still on the team **keeps** access — this is the
   expensive thing to get wrong.
3. A current coach can open any of the team's seasons.
4. Past staff lists still name who really coached each season.

## Testing

Needs three sign-ins on one team: a head coach, a current assistant, and a coach who has been
removed. The removed coach is the one that matters — the test is that they can't get in, having been
able to before.
