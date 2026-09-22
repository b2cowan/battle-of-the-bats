# PM brief — Call-ups

**Status:** Ruled 2026-09-22 (all six as recommended) · **Phase 1 built on dev 2026-09-22** · QA walk owed
**Plan:** `COACH_CALL_UPS_PLAN.md` · **Hub:** https://claude.ai/artifact/KmaWXBMTLHjoetMAfxtXdR
**Ships with:** one database change, no new screens, nothing for families, nothing a tournament sees.

> **Four things this build found that nobody asked about**, all now fixed — the bench console would
> have silently deleted a call-up from a saved lineup mid-game; player dues would have listed every
> call-up at $0 (the first screen the request named); re-opening a saved game would have dropped its
> call-up from the batting order; and the player profile would have offered to move a borrowed
> player onto the roster. Detail in the plan, §11.2.

---

## What this is

Teams run short. A player gets sick on Friday, two families are away, and Saturday's game needs nine.
So the coach borrows a player — from the club's other team, from the level below — for that one game.
Minor sport calls this a **call-up**.

Right now the product has no idea such a person exists. The only way to put one in a lineup is to add
them to the roster, and the moment you do that they are on your team: they turn up in player dues, in
skills & goals, in awards, in the season's playing-time report, in family emails, and they roll forward
into next season. So coaches either don't do it, or they do it and then live with the mess, or they
keep the real lineup on paper — which is the worst outcome, because then the printed card, the bench
console and the game notes are all working from a lineup that isn't the one being played.

## What a coach does differently

- **Call someone up from inside the game, every game.** In the lineup builder — and on game day, on
  the bench console — there is a *Call up a player* button. **Until you press it, the builder offers
  no call-ups at all**, however many you have saved. Press it and you get everyone you've called up
  this season, each with the games they've played, plus *Someone new*. One tap re-uses a name.
  Calling someone up is a deliberate act for each game, which is what keeps every other game's
  builder clean.
- **They are obviously not your player.** They sit under their own small **Call-ups** heading, and
  every row they appear on carries a mark. Nobody ever has to wonder whether the ninth name is a
  rostered kid.
- **They are in the game, completely.** Batting order, field grid, the lineup check, the pitching cap,
  the printed lineup card and game sheet, the bench console, game notes, and that game's attendance.
  Everything the game needs, they are in.
- **They are nowhere else.** Dues, skills & goals, awards, documents, tryouts, family emails, the
  family portal, your roster count, the season report, Season Wrapped, next season's rollover. Not in
  any of it, ever.
- **One game at a time.** A call-up shows up in the game you called them up for — not in every game
  for the rest of the season. That was the whole point of the exercise.
- **A short list you can manage.** A quiet section at the bottom of the roster page shows who you have
  called up and how many games each has played, so you can see it at a glance — several leagues cap
  that number — and remove anyone you're done with.

## The thing that isn't in the request, and matters most

The season playing-time report is the most trusted screen in the lineups area. It tells a coach who is
being short-changed on field time.

A call-up dropped into it naively would show **one game, four innings in the field** next to teammates
showing fourteen games — and would read as a child being badly treated. A coach acting on that row
would be acting on something that isn't true.

So the rule this feature is built on is: **a call-up counts inside a game and never across the
season.** The game's own checks — everyone bats, positions covered, the pitching cap — count them,
because they are really out there taking a slot. Every season-long figure ignores them.

The same rule answers the archive question. A closed season's roster does not list call-ups, because
they were never on the team — but a **saved lineup card from a game they played keeps their name**,
because that game happened and the archive must not rewrite it.

## Six decisions needed before anything is built

These are on the hub's **Rulings** tab with the full case for each. In short:

1. **The word** — I recommend **"Call-up"**. Sport-neutral, reads plainly, and it gets locked to one
   spelling everywhere and enforced by the build, so it's worth settling now rather than later.
2. **A call-up who pitches** — I recommend a **cap warning during that game, but no line in your
   season arm-care report.** You're responsible for their arm that day; their innings aren't your
   season's record.
3. **Per game or per season** — I recommend **per game**, for the reason above.
4. **Attendance** — I recommend they appear on **that game's** attendance sheet only.
5. **Who can add one** — I recommend **anyone who can build lineups**, including assistants. It's a
   decision made at a field, and it creates no money and no record.
6. **Contact details** — I recommend **a phone number only, never an email**, so a call-up can never
   end up in a family email audience.

## Who is affected

Head coaches and anyone with lineups access. Assistants with schedule-only access see call-ups on a
game the same way they see everyone else, read-only. **Families see nothing** — no email, no portal
entry, no notification. **Tournaments see nothing.** Nothing about money, evaluation or next season
changes anywhere.

## Why it matters

This is the gap between what the product models and what actually happens on a Saturday. A coach who
can't put the real nine into the builder stops using the builder, and once the lineup is on paper the
printed card, the bench console, the notes and the report all quietly stop being true. Closing this
keeps the game screens honest.

## Tradeoffs made

- **A call-up is a kind of roster entry, not a separate list.** Everything in the portal that asks
  "who's on this team?" already screens for rostered players — around sixty places. Making a call-up
  a *different kind* of entry means all sixty exclude them from day one, and so does anything built
  next year. The alternative — a tick-box on an otherwise-normal player — would have shown call-ups in
  dues and skills & goals until we went and fixed every screen, and would have failed the same way
  again on the next screen anyone builds. We chose the version that is safe when we forget something.
- **We didn't give call-ups their own everything.** No profile, no history, no development record, no
  money. If that's ever wanted it's a much bigger build, and for now a call-up is deliberately a thin
  thing: a name, a number, and the games they played.
- **Phase 3 is the one worth waiting for.** If the club runs both teams here, you should be able to
  pick a call-up off the other team's roster instead of typing the name again. That's real, and it's
  third, because the identity plumbing underneath it deserves its own pass.

## Success criteria

A coach who is short two players on Saturday builds the real lineup in the builder, prints the real
card, and runs the real bench — without a single call-up appearing in dues, skills & goals, awards, the
roster count, or the season's playing-time report.
