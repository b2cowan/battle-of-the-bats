# Tournament Chat — UX Refinement PM Brief

**Status:** Review complete (2026-06-22); refinement plan ready, pending owner sign-off on scope + 3 forks.
**Companion plan:** `TOURNAMENT_CHAT_UX_REVIEW.md` · **Feature reviewed:** `TOURNAMENT_CHAT_PM_BRIEF.md` (the built Tournament Chat).
**One-liner:** Make the already-built Tournament Chat *look and feel like a chat app people already know* — on phones and desktop — without touching how it actually works.

## What this is
Tournament Chat works, but it currently reads like a message **log**, not a messaging **app**: every line repeats the sender's name and time, the conversation doesn't fill the screen, and a few things are outright broken (it's invisible in light mode, the typing box can't grow, and on the league/club coach portal there's no way to even reach Chat from a phone). This is a focused **polish pass** — purely how it looks and behaves on screen. Nothing about who's in a room, what's private, or how messages are delivered changes.

## What the customer will see and do differently
- **It fills the screen like iMessage/WhatsApp.** The conversation goes edge-to-edge, the typing box grows as you type, and a "jump to latest" button appears when you've scrolled up.
- **It reads like a conversation.** Messages from the same person group together (name shown once), the time only shows when it's useful, and "Today / Yesterday / Sat" date markers separate the days. Each coach gets a coloured initial so you can tell who's talking at a glance.
- **Nothing is hidden or broken.** It works in light mode; the organizer's roster/moderation panel opens smoothly and the "Close room" button can no longer be hit by accident; coaches on the league/club portal finally get a Chat tab on their phone; the organizer sees an unread badge on their desktop menu so they know when a coach has written.
- **Clearer status messages.** "You're muted / the room is closed / slow down" each look distinct and on-brand, and tell you *when* a mute lifts.

## Who's affected
- **Organizers (Tournament Plus):** a noticeably more professional, trustworthy chat; a safer, clearer moderation panel; they stop missing messages thanks to the desktop unread badge.
- **Coaches (free and paid, both portals):** a real messaging experience on their phone; league/club coaches gain a Chat entry point they don't have today.

## Why it matters
Chat is a visible, sticky reason to be on Tournament Plus. If it feels like a clunky form instead of a chat app, it undercuts that pitch. This pass closes the gap to the apps coaches already use daily — at low risk, because it's surface-only.

## Scope, risk, effort
- **In scope:** appearance, layout, spacing, motion, accessibility, navigation entry points, and on-screen copy of the chat.
- **Out of scope (unchanged):** the chat engine, who can see/post, message delivery, and the database.
- **Risk:** low — no backend changes; static checks + owner browser testing per phase. Two small "nice-to-haves" that would need backend work are explicitly deferred.
- **Effort:** delivered in 3 phases — **Phase 1** (make it usable + feel like chat: the blockers and the grouping/identity/space/scroll core), **Phase 2** (high-value polish: identity, manage panel, room switching, status states), **Phase 3** (refinements).

## Decisions needed from the owner
1. **Look:** one shared dark style for both the admin and coach versions (recommended), or a slightly warmer/rounder variant for the coach side?
2. **Sender identity:** add coloured initials/avatars now (recommended), or keep it name-only for now?
3. **Read state:** keep the organizer's "last seen" + add a "new messages" marker, with **no** per-message "read by" receipts in v1 (recommended)?
4. **How much to build now:** Phase 1 only, Phase 1+2, or all three?

## Success criteria
- On both phone and desktop, across the organizer tab and both coach portals: the conversation fills the screen, groups messages with sensible time/date markers and clear sender identity, has a pinned auto-growing composer with smooth scrolling + jump-to-latest, every option is one obvious tap away, and empty/loading/closed/muted states are clear and on-brand — while the engine and access rules remain untouched.
