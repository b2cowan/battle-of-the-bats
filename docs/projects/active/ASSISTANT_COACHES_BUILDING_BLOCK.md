# Assistant Coaches — Building-Block Note

> **Superseded for scope/decisions by the full review:** `ASSISTANT_COACHES_PLAN.md` (+ `ASSISTANT_COACHES_PM_BRIEF.md`), 2026-06-24. That review is code-grounded and decision-ready; this note is retained as the origin concept. **Key correction from the review:** "chat-only first" is not a cheap safe default — today an assistant added to a team's staff inherits *full* head-coach access (roster PII, money, mass-email), so V1's real work is a least-privilege assistant role that closes that over-grant. Chat then picks assistants up for free.

**What this is:** a small, reusable platform concept — not a standalone project. It is **introduced inside Project 2 (In-Org Coach-to-Coach Chat)** but is written up separately because more than one feature will lean on it.

## The concept

Today a team's coaching is effectively organized around a **single head coach**. This building block makes a team's **coaching staff** first-class: a head coach plus one or more **assistant coaches**, each a real participant rather than an afterthought.

## Why it's needed

- **In-org coach chat (Project 2)** is only useful if the *whole* staff is reachable — head and assistants both.
- **Tournament chat (Project 1)** becomes richer once a team can bring its assistants into the tournament room.
- It opens the door to later **delegation** — e.g., an assistant helping manage a roster or schedule — without redesigning anything.

## Scope at first introduction (keep minimal)

- Add assistant coaches to a team's staff alongside the head coach.
- Assistants are **chat participants** to begin with; broader portal capabilities are added later, deliberately, rather than designing a full permissions system up front.
- A clear head-vs-assistant distinction so moderation/ownership stays unambiguous (the head coach remains the team's primary operator).

## Where it threads in

- Defines "who counts as a coach in this org" for the in-org coaches' room (Project 2).
- Feeds the tournament-room participant list (Project 1) once available — designed so Project 1 needs **no rework** to pick assistants up.

## Open decisions

1. What an assistant coach can do beyond chat at launch (chat-only recommended first).
2. Whether assistants are invited by the head coach, by the org admin, or either.
3. How assistant turnover interacts with chat history visibility.

## Related

- `IN_ORG_COACH_CHAT_PLAN.md` (owner of the first implementation)
- `TOURNAMENT_CHAT_PLAN.md` (second consumer)
- `COACH_CHAT_PLATFORM_PLAN.md` (program umbrella)
