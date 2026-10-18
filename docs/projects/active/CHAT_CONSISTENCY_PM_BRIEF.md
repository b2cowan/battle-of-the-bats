# Chat Consistency — PM brief

**Walked and drawn 2026-10-18; shelved the same day when the owner ruled the evaluation below (E1–E6 as recommended:
chat pauses).** Plan: `CHAT_CONSISTENCY_PLAN.md`.

## The bigger question first (evaluation, 2026-10-18)

The owner asked whether chat should stay at all, and ruled the evaluation's answer the same day (`CHAT_EVALUATION.md`,
the hub's first tab): **chat pauses now**, because it is staff-only, it reaches people only through phone notifications (an iPhone needs
the app installed; Android delivery is unconfirmed; nothing is emailed), and email tools already reach the same people.
No paying customer uses it and no plan card sells it, so pausing is cheap and reversible. Messaging would return later
as **announcements that reach everyone, with replies, for families in the Club tier**, on the safeguarding rules
Canadian sport requires. The consistency work below is shelved; it stays as the reference for the future Messages
screens.

**What the pause changes for people** (build prompt `CHAT_PAUSE_BUILD_PROMPT.md`): the Chat tab and every Chat item
disappear (home, public tournament pages, both coaches portals, the tournament admin), and the place Chat held in the
home, paid coaches portal and tournament admin bars goes to a replacement the owner picks from proposed candidates (or
stays empty if that is better);
an old chat address goes to that area's home; the dashboard's Coaches card tracks sign-ins instead of chat; nothing is
deleted, and the email tools are unchanged. Success: no surface shows or promises chat, and reversing the pause is one
change.

## What changes for people

Chat exists in four places: the home app, the paid coaches portal, the free coaches portal, and the tournament
organizer's admin. Today they are four slightly different apps. After this work they are one, and it behaves like the
messaging app everyone already knows.

- **Every door opens on a list of chats:** one row per room with its name, the last message, the time and an unread
  count, and the list updates as messages arrive. The organizer gets a list for the first time; today their phone
  drops them straight into one room.
- **Opening a chat fills the phone screen:** back on the left, the room's name and who it reaches, search, and the
  message box on the bottom edge. The app's bottom bar steps away while you are in a conversation and comes back with
  the list.
- **Press and hold a message, anywhere, for the same menu:** react, reply, copy, and (for whoever moderates) pin or
  remove; report someone else's message. On a computer, right-click does the same.
- **Tap a room's name for its details:** who is in it, mute, and for the organizer everything "Manage room" does today.
- **What you can do follows who you are, not where you opened it.** An organizer who taps a chat notification can
  moderate right there; a coach can report and mute from the coaches portal too.

## Why it matters

The owner's standard for chat has been "like WhatsApp" since June, but each surface drifted on its own. The walk found
an organizer's phone giving the conversation less room than any other surface (464 px of messages against 602 at
home), three different list designs, one
room called by two names, lists that never update while open, three meanings for press and hold, and a free-portal
defect that hides the room's back button behind the team banner whenever a room has unread messages.

## Customer impact

- **Organizers** (Tournament Plus and up) run game-day communication from a phone. They get a real inbox, more room to
  read, and moderation wherever a notification lands them.
- **Coaches** on both portals get the same chat as the home app, including report and mute, and a list that tells the
  truth about what is unread.
- **Free coaches** stop losing the room's header and back button on every unread room (the defect can ship first).

## Priority

High within the chat program: chat is a Tournament Plus selling point and the organizer's phone screen is what the
owner flagged. The work is front-end only: no data, permission or notification change.

## Success criteria

- The owner walks all four doors on a phone and a computer and finds the same list, the same open room, the same
  menu and the same details screen.
- An organizer can open a push, read, and moderate without leaving the room.
- A new message moves its room to the top of an open list and counts it, on every door.
- No room header hides behind a banner, and an iPhone does not zoom when the message box is tapped.

## Stages

A · one list → B · one open room → C · one message menu and room details → D · one computer split and the loose ends.
Each stage changes all four doors at once.
