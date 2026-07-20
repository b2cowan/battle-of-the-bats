# Unified Home Phase 6 — Follow Tournaments & Organizations · PM Brief

**Status:** Mockups F1–F6 owner-ratified 2026-07-20 (rev 3 of the mockup page is the binding spec). Build not started. Companion plan: `UNIFIED_HOME_PHASE6_FOLLOWS_PLAN.md`.

## What fans can do after this ships

Today a fan can only follow a *team inside one tournament*. After Phase 6 they can also, with one tap and **no account**:

- **Follow a whole tournament** — for the grandparent, scout, or local fan who cares about the event, not one roster. The event then shows up on their Home (with a live status line like "● 3 live now" or "Starts Saturday") and as a tile on their Scores tab until it wraps up.
- **Follow an organization** — the year-round relationship. The organizer's card sits on Home permanently ("Next: Summer Classic · Aug 8–10", or a quiet off-season line) so their next event finds the fan instead of the fan hunting for it.

Signing in is never required to follow — it's a quiet, dismissible nudge that adds real value: follows sync across devices, and score alerts (which already require an account) become available. When a fan does sign in, they get one explicit offer to bring this device's follows into their account — nothing ever moves silently.

## Why it matters

- **Completes the Home vision:** the new front door finally has all three followable things (teams, events, organizers) — the GameChanger-style "everything I care about, one screen" promise.
- **Frictionless where it counts:** the QR-code-in-the-bleachers moment stays two taps for everything, protecting the free-app acquisition funnel the platform bet on.
- **Gives organizers a durable audience:** an org follow is the first platform relationship that outlives a single event — the foundation for "your next tournament reaches your last tournament's fans."

## What deliberately does NOT change

- Team follows and the "my team" pinned experience on event pages — untouched.
- Score alerts stay account-only (existing decision) — the nudge says so honestly.
- No new push notifications of any kind in v1; cards show live *status*, not a notification stream.
- Tournament and org pages keep their own branded look — only the warm consumer app (Home/Scores) gets the new sections.
- No pricing, plan, or gating changes; no database change expected.

## Customer impact by role

- **Fans/parents:** new follow buttons on event pages (a strip under the event header + a row in the event's More sheet) and on organizer pages (hero button). Home gains a "Following · Organizations" section; Scores gains event/org tiles. Signed-out works everywhere.
- **Organizers:** nothing to configure. Their existing "findable in search" switch also governs whether their org can be followed, so there's one visibility rule. Anonymous follows aren't countable — a future follower-count feature would only see signed-in fans.
- **Coaches/staff/admins:** no change; your role always outranks a follow (no duplicate cards, no self-follow noise).

## Priority & sequencing

High-value fast-follow to the committed Unified Home phases; promotes only after that bundle reaches production. Must not run at the same time as the tournament-nav unification build (same screens) — one after the other.

## Success criteria

- Follow taps on the new buttons (tracked per type, signed-in vs out) trending up after launch, with search→follow conversion visible.
- Followed events/orgs actually revisited: Home card taps on the new card types.
- Zero support reports of "my follow disappeared" (device follows survive; claim offer works).
- No regression in the team-follow experience or in Home/Scores load feel.

## How the owner will test (10 minutes, phone)

1. Signed out: follow a tournament from its front page → see the nudge → check Home (event card with status) and Scores (tile).
2. Follow an org from its page → Home shows the Organizations section with the next-event line.
3. Sign in → accept the "add this device's follows" offer → confirm both appear signed-in; unfollow one from All following (star) and confirm the other survives.
4. Confirm: following the tournament did NOT pin a "my team" on the event's pages, and your own admin org shows as a workspace card, never a follow card.
