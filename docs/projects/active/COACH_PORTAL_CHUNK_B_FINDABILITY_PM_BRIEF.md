# Coach Portal — Chunk B: Findability & portal chrome — PM Brief

> **Companion to:** `COACH_PORTAL_CHUNK_B_FINDABILITY_PLAN.md` · **Date:** 2026-07-31
> **Status:** planned + awaiting mockup approval. **No code written.**
> **Priority:** medium. Nothing here is a launch blocker; one item is a real dead end for
> phone-only coaches.

---

## The problem in one sentence

The premium Coaches Portal is full of things a coach owns but cannot find: on a phone they cannot
reach their notifications **at all**, they cannot tell Chat from Announcements without opening both,
five screens promise a help "?" that isn't there, and a coach who signs up cold is never shown
around.

---

## What a coach experiences today

**On a phone, notifications simply do not exist.** The bell lives in the desktop sidebar, which is
hidden on phones. The notifications page it opens has **one link pointing at it in the entire
product** — inside that bell. So a coach who only ever uses their phone has no route to their
notification feed, and no route to their notification settings either. Not "hard to find". No route.

**Chat and Announcements sit side by side with nothing to tell them apart.** Both are one-word
labels under a heading called "Communication". A coach who wants to tell parents about Saturday's
game has to open one, guess, and back out.

**The help "?" is on most screens, but not the ones added most recently.** Attendance got its own
place in the menu but never got its help icon. Chat, Settings, and both screens a coach sees after
their season closes have none either.

**A coach who signs up cold is shown around only by accident.** There *is* a portal tour, and it's
good — but it's offered from inside one specific card on the Overview. If that card isn't the one
showing (because there's a game today, or the season's already running), the tour is never offered
and the coach never learns the portal has one.

---

## What changes

**1 · Notifications reach the phone.** A **Notifications** row appears at the top of the More menu,
opening the full notification feed — with the unread count shown on the row *and* on the More button
itself, so a coach sees there's something waiting without opening anything. The settings link lives
on that page, so both become reachable in one move.

This is not a new invention: **the admin side hit this exact problem and solved it this way in
July.** We're giving coaches the answer that already works next door.

**2 · The two communication doors say who they reach.** "Announcements" becomes **"Email families"**.
"Chat" is unchanged. A coach never has to guess again: one goes to families by email, the other is a
conversation with their own staff and, during an event, the organizer.

**3 · The help promise gets finished, and becomes a rule instead of a list.** The rule: **every door
in the menu carries a help icon; a screen you drilled into borrows its parent's guide.** That's
already how the portal behaves — five doors were just missed. They get icons. One of them (Settings)
has no written guide yet, so **we write it** rather than pointing the icon at a table of contents. A
"?" that opens a contents page instead of an answer is worse than no "?" at all.

**4 · A brand-new coach gets a welcome.** The first time a coach with a fresh team opens their
Overview, the single card at the top of the page is a welcome that offers the tour. Take it or skip
it once and it never returns — the card goes back to being whatever that coach's situation calls for.
The tour itself stays available from Help forever.

---

## Why it matters

- **The notification gap is a genuine dead end**, and it lands on the coaches most likely to be
  phone-only — volunteers running a team from a parking lot, not a desk. Everything the platform
  sends them today is invisible to them.
- **Two unlabelled doors cost trust, not just time.** A coach who sends a message to the wrong
  audience — or who can't work out which one reaches parents — stops using the feature.
- **A half-kept promise reads as a broken product.** Help appears on 12 screens and not on the next
  5; the coach can't tell which rule they're in, so they stop looking.
- **A cold signup is our least forgiving moment.** These are paying coaches with no free-tier
  history, and today whether they get shown around is decided by whether a game happens to be
  scheduled.

---

## Who sees what

| | Change |
|---|---|
| **Head coaches** | All four changes. |
| **Assistant coaches** | All four. The notification row and help icons appear regardless of capability — both are read-only. The welcome card's secondary "next step" keeps today's permission filter, so an assistant is never pointed at something they can't do. |
| **Phone users** | The notification change is theirs specifically; the others land everywhere. |
| **Desktop users** | Labels, help icons and the welcome card. The desktop bell is untouched. |
| **Free coaches** | **Nothing.** Separate portal, separate design family — deliberately out of scope. |

---

## Tradeoffs made

- **We did not add a 6th button to the bottom bar.** At phone width a sixth slot breaks the minimum
  touch target and would have evicted Roster or Chat. The More menu costs one extra tap; the badge
  on the More button is what makes the notification *discoverable*, which is the actual problem.
- **We did not merge Chat and Announcements.** They differ in audience, medium and direction — one
  is a two-way conversation, the other is a one-way email to families. Merging would have made the
  confusion permanent instead of fixing it.
- **We did not put a help icon on every screen.** 41 screens with 41 icons is noise. The rule ties
  help to *doors*, which is how coaches actually navigate, and it stays enforceable — a new menu item
  added without help will fail an automated check.
- **We did not add a welcome banner.** The Overview deliberately shows exactly one card; a banner
  beside it would have re-introduced the "two cards, one situation" defect fixed last week. The
  welcome *is* the card, for one visit.

---

## How to test it (owner QA — on a real phone)

1. **Notifications.** Open the portal on your phone → **More**. A **Notifications** row is at the
   top; the count appears on it and on the More button. Tap it — the feed opens, and "Notification
   settings" from that page reaches your account settings.
2. **The two doors.** In the sidebar (desktop) and under More (phone), confirm **Email families**
   replaced **Announcements**, and that it's obvious which door reaches parents.
3. **Help.** Open **Attendance**, **Chat**, **Settings**, and — on a team whose season is closed —
   **Season's End** and **Insights**. Each shows a "?"; tapping it opens a guide about *that screen*.
4. **The welcome.** On a team with no activity yet, the Overview's top card welcomes you and offers
   the tour. Skip it, reload — it's gone for good, and the card is back to normal. The tour is still
   in Help.
5. **As an assistant coach.** Confirm the notification row and help icons are there, and that nothing
   new offers an action the assistant can't perform.

---

## Success criteria

- A phone-only coach can reach their notification feed **and** their notification settings, and knows
  something is waiting without going looking.
- No coach has to open both communication doors to find out which one emails parents.
- Every door in the menu has help behind it, and every help icon opens a guide about the screen it's
  on — no exceptions, enforced by an automated check.
- A coach who signs up cold is offered the tour on their first visit regardless of what their team's
  schedule happens to look like, and is never nagged about it again.

---

## What this does *not* fix

- The **desktop** notification bell is unchanged. A separate navigation project is considering a new
  top strip for the coach portal that would carry its own bell — that plan owns the question of
  whether the portal ends up with two desktop doors to the same feed.
- **Free coach portal** — untouched.
- This does not change what notifications get sent, or when.
