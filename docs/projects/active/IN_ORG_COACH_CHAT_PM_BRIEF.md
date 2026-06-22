# In-Org Coach-to-Coach Chat — PM Brief (Coach Chat · Project 2)

**Status:** Planned, not started. Second project in the Coach Chat program.
**One-liner:** Give a club's or league's coaches a private channel to talk to each other — and introduce assistant coaches so the whole coaching staff is included.

## What it is

A coaches' chat that lives inside a single organization: the paid coaches of a league or club coordinating with each other — scrimmages, schedules, who's covering what. One organization-wide room, with optional per-team rooms.

## Who it's for

- **Paid coaches in League and Club organizations** (where coaching staff already exists).
- It does **not** require the standalone Coaches Portal to be open — so, like Tournament Chat, it can ship ahead of that launch.

## What the customer sees and does

- **Coaches:** a coaches' channel in their portal with an unread badge; real-time messages and push notifications.
- **Org admin:** automatically runs the org-wide room.
- **New in this project — assistant coaches:** clubs can add assistant coaches to a team, not just a single head coach, so the full staff is reachable in chat (and it sets up future "assistant can help manage the team" capability).

## Why it matters

- Coaches are the platform's daily-use operators; a private staff channel is exactly the kind of habitual feature that drives retention.
- The **assistant-coach concept** is overdue on its own — real teams have more than one coach — and this is the natural moment to add it.
- Reuses the chat foundation from Project 1, so it's a small, high-leverage add.

## Trade-offs made

- **Assistant coaches start chat-focused.** We deliberately keep what an assistant can *do* minimal at first (be in the conversation) and expand their capabilities later, rather than designing a full permissions system up front.
- Same "last seen" receipts and push-not-email model as the rest of the program.

## Effort & priority

- **~2–3 weeks** (chat reuse + the assistant-coach concept). **Priority: medium-high** — strong coach-retention value, and it unblocks the assistant-coach model the platform needs anyway.

## Success criteria

- Coaches in a club actively use the channel instead of texting/email.
- Clubs add assistant coaches and those assistants participate.
- Zero cross-organization leakage.

## Open decisions for the owner

1. One org-wide room, per-team rooms, or both?
2. How much can an assistant coach do at launch — chat only, or some portal access too?
3. When a coach is replaced mid-season, does the new coach see prior chat history?
