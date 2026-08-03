# Desktop Phase 2 — Account & Chat: PM Brief

**Status:** Planned 2026-07-31 — mockups pending owner approval
**Plan:** `DESKTOP_PHASE2_ACCOUNT_CHAT_PLAN.md`

## What this is

Phase 1 made the app's desktop screens use a desktop's width. Two screens were knowingly left phone-shaped, each with its reason recorded at the time. This phase finishes them. Both changes are desktop-only: on a phone, nothing looks or behaves differently.

## 1. Account becomes a real settings screen on desktop

**What changes for the user:** On a computer, Account stops being one narrow column of full-width tap bars floating in empty space. It becomes the settings screen every desktop app has: a short section list on the left — Profile, Notifications, Appearance, Get the app, Help — and the chosen section's content on the right. Each section is its own address, so refresh, bookmarks, the back button, and every existing "notification settings" link across the app land exactly where they should. Buttons shrink to button-sized — no more edge-to-edge bars designed for thumbs.

**Why it matters:** Account is where a signed-in person manages everything durable about their relationship with the platform. On desktop it currently reads as a stretched phone screen — the one screen Phase 1's widening pass explicitly deferred because stretching it would have made it worse.

**Phones:** unchanged, deliberately — the single stack is the right shape there.

## 2. Chat becomes a split pane on desktop

**What changes for the user:** On a computer, Chat works the way every desktop messaging product works: conversation list on the left, the open conversation on the right, both visible at once. Switching conversations is one click with the list always in view — no more replacing the whole screen and pressing Back to see your other chats. Until you pick a conversation, the right side shows a quiet "select a conversation" prompt; we don't auto-open one, because opening a conversation marks it read and that should be the reader's choice. The message area itself — the best-built responsive piece in the product — is reused exactly as-is.

**Why it matters:** Chat is the last screen shaped entirely like a phone on a desktop. It's also, for coaches at a computer during a tournament weekend, the screen where a second pane pays off most.

**Phones:** unchanged — one pane at a time remains correct there.

**One honest note:** the owner asked whether any cheap signal exists on desktop chat usage. Checked: our chat analytics record only "chat opened" and "inbox loaded", with no device or screen information — desktop usage can't be measured with what exists today. Building proceeds regardless, per the owner's ruling.

## Decisions surfaced for the owner (in the mockups)

1. **Chat keeps no footer.** The charter framed the split pane as "fixing the screen that opted out of the footer" — the split pane fixes the phone-shaped layout, but a footer below a full-height, non-scrolling chat pane would be unreachable. Recommendation: the opt-out stays, now for a reason that's true at every width.
2. **The lime button on signed-out Account is "Sign in", not "Create free account"** (the brief assumed the reverse). No colour change proposed — flagged so the record is accurate.
3. **Section list = real pages** (each section has its own address) rather than an in-page switcher — chosen for working deep links, back button, and refresh.

## Success criteria

- Desktop Account and Chat read as desktop software; no screen is a stretched phone layout.
- Every existing link, deep link, and notification pathway keeps working.
- Zero visual or behavioural change at phone and tablet widths — verified against recorded pre-change values, not by eye.
- Both themes (warm and dark) show clean edges everywhere a surface meets another — the recurring Phase 1 bug shape, checked explicitly this time.

## Sequencing

Account ships first, fully finished and verified; Chat second. Each is independently shippable. Mockup approval gates any code.
