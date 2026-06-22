# In-Org Coach-to-Coach Chat — Implementation Plan (Coach Chat · Project 2)

**Status:** PLANNED (not started). Second project in the Coach Chat program. Reuses the shared engine built in Project 1 (Tournament Chat). **Introduces the assistant-coach concept.** No Coaches Portal dependency.
**Engine spec (canonical):** `docs/projects/active/COACH_CHAT_PLATFORM_PLAN.md` (umbrella) §2.
**Building block:** `docs/projects/active/ASSISTANT_COACHES_BUILDING_BLOCK.md`.
**PM brief:** `docs/projects/active/IN_ORG_COACH_CHAT_PM_BRIEF.md`

---

## 1. What this is

A coaches' channel **inside one organization** — the paid coaches of a league/club talking to each other (scrimmage planning, standings chatter, day-to-day coordination). One org-wide room, with optional per-team rooms.

## 2. Why it's second

- It **reuses the engine** from Project 1 — the surface is mostly "who's in the room + where's the entry point."
- It needs **no standalone Coaches Portal**: it serves **League/Club** organizations, whose rep-team coaches already exist as paid operators.
- It's the natural place to introduce **assistant coaches**, which in-org chat depends on to be useful (a team is rarely one coach).

## 3. Scope

- **One org-wide coaches' room**, auto-created for a qualifying org; optional **per-team rooms** on demand.
- Participants = the org's paid coaches on an active/draft program year, **including assistant coaches** (see §4).
- Org admin is auto-moderator on the org-wide room.
- **Gating:** League/Club tier (the tiers where paid coaches exist). No new account type.
- Reuses the shared chat panel, notifications, and read-watermark verbatim.

## 4. The assistant-coach concept (introduced here)

Today a team's coaching is effectively modeled around a single head coach. This project introduces **assistant coaches** as first-class members of a team's coaching staff, so the full staff is reachable in chat — and so the door is open to later delegation (e.g., an assistant managing a roster). See the building-block note for the model, the head-vs-assistant distinction, and how it threads into "who is a coach in this org." Designed so **Project 1 (Tournament Chat) can also pull a team's assistants into the tournament room** once this lands, with no rework.

**Decision needed:** what an assistant coach can and can't do (chat-only at first vs. broader portal access) — kept deliberately minimal at launch.

## 5. LOE

~**2–3 weeks** — chat surface reuse (~6–9 days) plus the assistant-coach concept (~0.5–1 week). One experienced engineer, including migration overhead and the `/review` gate.

## 6. Open decisions

1. Coach peer chat default: one org-wide room, per-team rooms, or both? (Room-list UX should be designed first.)
2. Assistant-coach scope at launch: chat participation only, or also some portal access?
3. Does a per-team room's history carry to a new coach when staff changes mid-season? (Privacy consideration.)

## 7. Dependencies

- Project 1 (the shared engine) must be built first.
- The assistant-coach building block lands within this project (it's not a separate prerequisite project, just the first net-new concept this one introduces).
