# Tournament Chat — Division Rooms ("Channels") — PM Brief

**Status:** Planned (2026-06-23). A small, additive wave after the current chat work ships. **No database migration.**
**Companion plan:** `TOURNAMENT_CHAT_DIVISION_ROOMS_PLAN.md`
**One-liner:** Let organizers split a big tournament's chat into division "channels" — without setup burden — while every coach always has one place everyone is.

## What this is
Right now each tournament has a single chat: "All coaches." For large, multi-division tournaments that's noisy — a U12 coach doesn't need the U18 chatter. This lets the organizer create extra rooms (like Slack channels) scoped to one or more divisions, on top of an always-present "All coaches" room.

## What the customer can do
- **Organizer:** from the tournament chat, create a room, name it ("U12 Coaches", "Championship"), and choose which division(s) it covers. They moderate every room (pin, polls, mute, remove) from the same admin chat screen. The "All coaches" room is always there and can't be deleted — only archived.
- **Coach:** nothing to set up. They simply see the rooms that apply to them — the All-coaches room plus any room covering their team's division — in the room list that already exists. They post/react/vote as usual.

## How it stays effortless
- **The default works out of the box.** Chat still opens with one "All coaches" room and zero configuration — division rooms are optional extra power, never a setup step.
- **Membership maintains itself.** Rooms are scoped to *divisions*, not hand-picked coaches — so when a new team registers into a covered division, its coach is added to that room automatically. No lists to keep updated.

## Who it's for
Tournament organizers (Tournament Plus) running multi-division events, and their coaches. Small single-division tournaments are unaffected — they just use the one room.

## Why it matters
It makes chat scale to big tournaments without becoming a firehose, and it's a visible "this platform runs a real event" capability — at low cost, because the engine was built for it.

## Effort & sequencing
**~1.5 weeks, no database migration.** Most of the plumbing already exists (the system already knows how to route coaches by division, and every chat feature already works per-room). The real work is the organizer's create-and-manage-rooms screen. Ships on its own behind the review gate, after the current reactions/polls/portal-fix work deploys.

## Trade-offs / scope
- **Flexible, not rigid:** organizers compose rooms and pick divisions (can group divisions or make a cross-cutting "Championship" room) rather than a forced one-room-per-division.
- **Division-scoped, not coach-by-coach** (V1): keeps membership self-maintaining; hand-adding individual coaches and cross-tournament rooms are deferred.
- **Coaches don't create rooms** (organizer-controlled), consistent with the rest of the chat's organizer/participant split.

## Decisions to confirm
1. Flexible admin-composed rooms (recommended) vs rigid one-per-division.
2. Membership auto-maintained from divisions (recommended) vs one-time invite.
3. "All coaches" room always present + undeletable (recommended).
4. Defer individual-coach adds + cross-tournament rooms (recommended).

## Success criteria
- A multi-division organizer runs clean, division-specific coordination without noise, set up in under a minute.
- Coaches land in the right rooms automatically and never manage membership.
- Small tournaments see no change; the engine and access rules stay intact.
