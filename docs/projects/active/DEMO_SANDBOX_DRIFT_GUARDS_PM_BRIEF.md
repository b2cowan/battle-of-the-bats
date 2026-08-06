# PM Brief — Keeping the demo sandboxes honest as the product moves

**Status:** planned, not built. Owner-approved 2026-08-05.
Plan: `DEMO_SANDBOX_DRIFT_GUARDS_PLAN.md`.

## What this is about

We have two no-login demos — a tournament one and a coaches one — that prospects walk into from
marketing. They are not videos or screenshots: they are the real product, running on invented
clubs. That is their whole selling power, and it is also the risk. **When the product moves, the
demo moves with it automatically — but the story we tell over the top of it does not.**

## Why it matters now

Designing the coaches demo's guided tour turned up three live examples of exactly this, all of
which had already passed a build, a cleanup review and a correctness review:

- The demo told visitors there was "one split opinion to argue about tonight" on the tryout board.
  The disagreement is real in the data — and **no screen in the product shows it**. Visitors were
  being pointed at something that isn't there.
- A tryout feature the demo was written to show off — flagging an evaluator who scores
  consistently harder than the rest — **never actually appears** on the demo's data.
- The mid-season team showed a $9,400 budget with **$0.00 spent**, on a team eighteen games into
  its season. A prospect opening Money saw a report saying nothing had happened all year.

None of these broke anything. Every page loaded, nothing errored. That is the point: **drift in a
demo doesn't crash, it just quietly stops being true.**

## What changes for customers

Nothing, directly. This is about the shop window, not the shop. Indirectly it protects the thing
the demos exist to do — let a coach or an organizer believe what they are looking at.

## What we'd do, in order

1. **Run the two existing demo health checks automatically**, alongside every other check, instead
   of by hand when someone remembers. Cheap; they already exist and already pass.
2. **Add the demos to the same habit as the in-app help guides.** When a change alters a coach or
   organizer flow, the question "should a demo moment show this, and are its sentences still
   true?" gets asked at the same moment we ask whether the guides still match. One paragraph of
   standing instruction.
3. **Make the demo's destinations a list the build enforces**, so moving or deleting a screen the
   demo points at fails immediately rather than being discovered by a visitor. This is the one that
   would have caught "practice plans have no shareable link" before a tour step was written
   against it.
4. **Open the demo and look, on a schedule** — a machine walks every demo screen at phone and
   desktop width and checks it isn't empty and still carries the numbers the demo's own sentences
   quote. Run after each release, against production.

## The honest limit

Measures 1, 3 and 4 catch **breakage**. None of them can tell us the demo is *missing* something
the product gained last month — that is a judgement call, which is why measure 2 (the habit) is
second in the order despite being the least technical thing on the list.

## Success criteria

- A change that breaks either demo world fails on the machine that made it, not in front of a
  prospect.
- Moving or removing a screen the demo points at cannot ship silently.
- After each release we can say, with evidence rather than optimism, that both demos still show
  what they claim to show.

## Priority

Medium. Neither demo is publicly linked yet (the marketing doors are still behind a flag), so
there is a window to put this in before the demos start carrying real traffic. It should land
**before the doors open**, not after.
