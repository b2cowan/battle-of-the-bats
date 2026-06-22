# Tournament Chat — PM Brief (Coach Chat · Project 1)

**Status:** Engine BUILT + proven on dev; **surface (the actual screens) BUILT on dev 2026-06-20** — core single-room experience, both coach portals. Pending owner browser testing. No production database change yet (rides the engine migration at release). First and foundational project in the Coach Chat program.
**One-liner:** Give a tournament organizer a live group chat with every coach in their tournament — and build the chat foundation the rest of the program reuses.

## Build status (2026-06-20)
- **Organizer** gets a **Chat tab** on each tournament (Tournament Plus): the full coach roster is already in the room, with a "Not yet joined" list for coaches who haven't signed in (each with copy-link / email invite actions), and controls to **mute** (≤72h), **remove a message**, or **close** the room. Non–Tournament-Plus hosts see an upgrade prompt.
- **Coaches** get a **Chat** entry with an unread badge in **both** coach portals (the free/standalone portal and the league/club portal), opening a live conversation that loads history then streams new messages, with **push notifications** (no email).
- **Built once, reused everywhere:** the shared chat panel + engine are what the next two projects (in-org coach chat, cross-org messaging) layer onto cheaply.
- **Deferred to a follow-up:** opt-in division sub-rooms; smarter notification deep-links. Trade-offs unchanged from the locked decisions ("last seen" not per-message ticks; push+bell only; room stays readable after archive).

## What it is

A real-time group chat that belongs to a tournament. The organizer runs it; every participating coach is in it. Think of it as replacing today's one-way email blasts with an actual conversation.

## Who it's for

- **Tournament organizers on Tournament Plus** (the host).
- **All of their coaches — free and paid alike.** A coach doesn't need to pay anything to take part; being in the tournament is enough.

## What the customer sees and does

- **Organizer:** a Chat tab on their tournament. Every registered coach is already in the room. Coaches who haven't finished signing up show as "not yet joined" with a re-invite button, so nobody is silently left out. The organizer can mute someone, remove a message, or close the room. Optional separate rooms per division.
- **Coaches:** a chat with an unread badge; they read and reply in real time and get phone-buzz push notifications — no email noise.

## Why it matters

- It's a **visible, sticky reason to be on Tournament Plus**: "run all your coach communication in one place."
- It lets us **ship a live chat experience now**, to customers who already exist, without waiting on the Coaches Portal launch.
- It quietly builds the **shared foundation** that in-org coach chat and cross-org messaging are then layered onto cheaply.

## Trade-offs made

- **"Last seen" receipts**, not a per-message "read by 12 of 20" tick — simpler, scales fine, and the richer version can come later.
- **No email notifications** — chat notifies by in-app bell + push, on purpose.
- Built foundation-first: this project carries the cost of the shared engine, so the next two projects are much lighter.

## Effort & priority

- **~3–4 weeks.** **Priority: high** — it's the core ask, the lowest-risk piece, and the prerequisite for everything else in the program.

## Success criteria

- Tournament Plus organizers actively run their coach comms in-app instead of email.
- Coaches reply same-day; measurable push-notification engagement.
- Messages reliably arrive live for everyone in the room, with zero cross-tournament leakage.

## Open decisions for the owner

1. Does a tournament's chat stay readable after the event ends, or close at archive?
2. Division rooms: auto-created, or organizer opt-in? (Opt-in recommended.)
