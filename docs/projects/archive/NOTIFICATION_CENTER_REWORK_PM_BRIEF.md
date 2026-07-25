# Notification Center Rework — PM Brief

**Flagged:** 2026-07-06 (owner, via `/ux`) · **Status:** Planned, not started · **Priority:** Medium-high (visible daily to every admin/coach)

## What we're changing

Today the notification bell is one long list sorted only by time. On a busy tournament day it becomes a wall of clutter — six identical "New registration" rows, with the one thing that actually needs a decision buried in the middle. And the push icon on phones shows up as a plain square.

We're reorganizing the bell around **what the user is supposed to do**, not just when something happened:

- **Needs attention** — the few things that require a decision (a failed payment, a coach requesting access, a disputed score) get pinned to the top with a count, so they never hide.
- **Activity** — everything else (new registrations, scores, playoffs set) becomes a skimmable feed, grouped under Today / Yesterday / Earlier, with repeats **bundled** ("6 new registrations" instead of six rows).
- **Conversations move out** — chat messages leave the bell entirely and live on the **Chat tab** with its own unread badge, the way every messaging app works. The bell stops competing with chatter.
- **"See all" page** — a full notifications page for anyone who wants to scroll back or filter.
- **The phone icon gets fixed** — the square becomes the FieldLogicHQ mark.

## Why it matters

The bell is one of the most-seen surfaces on the platform — every admin and coach glances at it constantly during an event. Right now it actively works against them: the important item is the hardest to find, and the volume reads as noise they learn to ignore. When people ignore the bell, they miss the failed payment and the coach waiting on access. Fixing the organization turns the bell from "clutter I dismiss" into "my to-do list for the tournament."

The square push icon looks broken/unprofessional on the lock screen — the first impression of every push we send.

## What the user sees differently

| Before | After |
|---|---|
| One time-sorted list, up to 30 items | Needs-attention pinned on top, then a grouped activity feed |
| Six "New registration" rows | One "6 new registrations" row that expands |
| Chat messages mixed in with payments | Chat lives on the Chat tab with its own badge |
| No way to see older items | A "See all" page with filters |
| White/dark square push icon on phones | The FieldLogicHQ chevron |

## Role differences

- **Admins / staff:** highest volume — they benefit most from the needs-attention split and bundling.
- **Coaches:** lower volume, team-scoped, chat-heavy — the chat-to-its-own-tab move matters most here.
- **Public / fans:** unchanged for now (push-only, no bell). A future "follow a team, get score alerts" idea is noted but out of scope.

## Tradeoffs / decisions made

- **No new database work** — the whole rework is presentation, so it's lower-risk and faster than it sounds. The delivery engine (bell/push/email preferences, mute, opt-out) is already solid and untouched.
- **Bundling reflects what's on screen, not a hidden total** — if there are more items than the bell loads, we say "6 shown" honestly and send power users to the "See all" page rather than guessing a count.
- **Icon redraw is a design task** — the plan specifies the technical requirements (the phone badge must be a transparent silhouette, or Android paints it a solid square); `/design` produces the actual art.

## Phased delivery (each ships on its own)

1. **Quick wins** — fix the phone icons + give every notification type its own icon. Standalone, shippable first.
2. **Categorize + group** — needs-attention vs activity, date headers.
3. **Bundle** — roll up repeats.
4. **Chat off the bell** — Chat-tab badge.
5. **"See all" page** — overflow + filters.

## Success criteria

- On a busy tournament day, an admin can spot "what needs me" in under 2 seconds.
- The bell shows a handful of grouped rows, not dozens of identical ones.
- Chat no longer appears in the bell; the Chat tab badges instead.
- A real Android push shows the FieldLogicHQ mark, not a square.
