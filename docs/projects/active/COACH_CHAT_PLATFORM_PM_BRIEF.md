# Coach Chat Platform — PM Brief

**Status:** Planned, not started. Design + LOE scoped 2026-06-18.
**Full plan:** `docs/projects/active/COACH_CHAT_PLATFORM_PLAN.md`

## What this is

Real-time chat inside FieldLogicHQ, built as ONE engine with three product surfaces stacked on it:

1. **Tournament Chat** *(the original ask)* — a tournament organizer gets a single group room with **all the coaches in their tournament**, like a team-wide group chat. Optional separate rooms per division. The organizer runs it (can remove/mute, close it). This is what a Tournament Plus subscriber offers *their* coaches — a real reason to be on Plus.
2. **Coach Peer Chat** — premium coaches in a club talk to each other (scrimmages, standings, the usual chatter). One club-wide room, optional per-team rooms.
3. **Coach↔Parent Chat** — a premium coach messages the parents of their players. This one is the big lift because **parents don't have logins today** — we'd be creating an entirely new kind of account.

## Why it matters

- It gives **Tournament Plus** a sticky, visible upgrade reason: "run your whole tournament's coach communication in one place," replacing today's one-way email blasts.
- It deepens the **Premium coach** value (peer + parent comms) — coaches are the primary operators, and chat is the kind of daily-use feature that drives retention.
- It behaves like a real chat app: in-app bell, unread counts, **phone-buzz push notifications** — and deliberately **no email spam**. We already own the push plumbing, so this costs us nothing extra to deliver.

## What the user sees and does differently

- **Tournament admin:** a Chat tab on their tournament; every registered coach is already in the room (coaches who haven't finished signing up show as "not yet joined" with a re-invite button, so nobody is silently left out).
- **Coaches:** a Chat entry in their portal sidebar with an unread badge; they read and reply in real time and get push notifications.
- **Parents (Phase 4 only):** an email invite to create a login, then a minimal inbox where they message their coach.

## Tradeoffs made

- **Seen receipts** are "last seen" per person, not a per-message "read by 12 of 20" tick — the simpler model scales fine for tournament/team volumes and avoids heavy plumbing. The richer per-message receipt can be added later.
- **No email notifications** — intentional; chat apps notify by push, and email digests of chat are noise.
- **Parents are scoped to a chat-only inbox** at launch — no parent dashboard. Kept deliberately minimal and walled off so it can't expose admin data.

## Effort & sequencing

- **Tournament Chat (the core ask): ~3–4 weeks.** Recommended first release — clear requirement, gated to an existing plan, reuses proven infrastructure.
- **Coach Peer Chat: ~1.5–2 weeks** after that (reuses the engine, no new account type).
- **Coach↔Parent Chat: ~3–4 weeks** and treated as its own project — it creates a brand-new parent-login population and carries a **legal step** (consent to email guardians an invite to create an account; PIPEDA/CASL). This needs a decision before that phase starts.
- **Full platform end-to-end: ~7–10 weeks.**

"Full functionality at launch" is achievable, but the honest recommendation is to ship the tournament chat first (it's the highest-value, lowest-risk piece) rather than hold everything for the parent-login workstream.

## Priority & success criteria

- **Priority:** medium-high for Phases 1–2 (Plus differentiation); Phase 4 is a separate, larger bet.
- **Success looks like:** Plus tournaments actively running their coach comms in-app instead of email; coaches replying same-day; measurable push-notification engagement; (Phase 4) a meaningful share of invited parents activating accounts.

## Open decisions for the owner

1. Does a tournament's chat stay readable after the event ends, or close at archive?
2. Division rooms: auto-created, or admin opt-in? (Opt-in recommended.)
3. Coach peer chat: one club room, per-team rooms, or both?
4. Coach↔parent at launch: rep teams only, or also free-tier teams?
5. Parent invites: expire-and-resend, or stay valid indefinitely?
6. When a coach is replaced mid-season, does the new coach see prior chat history?
