# PM Brief — Tournament Seam Fixes, Phase 1 ("Broken game-day loops")

**Status:** Planned (mockups approved 2026-07-21) · **Plan:** `TOURNAMENT_SEAM_P1_PLAN.md` · **Mockups:** claude.ai artifact "Tournament Seam Fixes — UX Mockups" (frames 1–4 + security note) · **Source review:** `TOURNAMENT_SEAM_UX_REVIEW.md`

## What this phase is

Five fixes that repair flows which today dead-end or silently fail **during a live tournament** — the moments where the "1 app" promise breaks hardest. No new surfaces are built; every fix repairs an existing screen.

## What users see and do differently

1. **Chat gets a way back.** Anyone who opens a tournament's chat room sees the event's name as a tappable chip that returns them to the tournament. Organizers additionally see an "Event admin" shortcut in rooms they moderate. If you have exactly one chat room, tapping Chat opens it directly instead of showing a one-item list. *Today: the only exit is "Back to your chats"; organizers must hunt for the admin chat screen separately.*

2. **Notifications land where they point.** Tapping a chat mention opens that conversation. Tapping "score submitted" (organizers) opens the Results screen with that game ready to review. The "score disputed" notification toggle disappears from settings (the product has no dispute feature behind it). *Today: a chat mention opens the marketing homepage; score alerts open a screen with no score tools.*

3. **A scorekeeper never loses a score.** If a volunteer's sign-in lapses mid-game, the score sheet itself says so — plainly, above the numbers they typed — and those numbers survive: after signing back in they land back on the same game with the score still filled in. Check-in volunteers get the same clear "sign back in" treatment. *Today: saving fails with no visible error, and the recovery path erases the typed score.*

4. **Finalized scores stop hiding on mobile.** The Results screen on a phone shows a muted "Completed N" chip (as desktop already does), so correcting an already-finalized wrong score — the most common bleachers fix — starts with one tap instead of a hunt. The default "needs action" view is unchanged.

5. **Security fix (invisible when working):** assistant coaches who have been explicitly denied money visibility can no longer see the team's tournament fee status anywhere in the Premium portal. No visual change for anyone else.

6. **Notifications follow the session (owner-added 2026-07-22).** Signing out stops the phone's notifications for that account — a shared family device no longer keeps showing a signed-out coach's chat messages. Signing back in resumes them silently: no new permission prompt, nothing to re-enable, and everything missed is waiting in the bell and chat badges (standard messaging-app behavior). A second account signing in on the same device takes the notifications over. Relatedly, tapping a chat notification while signed out now prompts sign-in and then opens the conversation — same as the score alert behavior.

## Why it matters

These five are the review's highest-impact confirmed findings: three are outright broken loops on game day (lost scores, stranded notifications, no chat exit), one hides the most common admin correction, and one is a permissions promise we're currently not keeping. They're also the foundation the P2 fixes (re-pointing coach "Schedule"/"Fees" doors, Premium parity) build on.

## Who's affected

- **Coaches (free + Premium), parents, fans** — chat chip, notification landing, single-room auto-open.
- **Org admins / staff** — event-admin chat shortcut, score-submitted landing, mobile Results chip.
- **Volunteer scorekeepers & check-in helpers** — session-expiry recovery.
- **Assistant coaches** — money-visibility gate now actually holds.

## Tradeoffs / deliberately not in this phase

- Still **no in-app payment** for tournament fees (existing deliberate decision; unchanged).
- The Chat *tab* itself still opens the general inbox — context-aware chat entry is P2 territory; this phase fixes the exits, the arrivals from pushes, and the lone-room case.
- Offline resilience for the signed-in shells is P3.

## Success criteria (owner tap-through)

1. From a tournament chat room, one tap on the event chip lands on that tournament; the chip is absent in no room.
2. As an org owner in your tournament's room, the Event admin shortcut appears and lands on moderation; a plain parent never sees it.
3. Tap a chat-mention push on your phone: it opens the conversation (signed in) or returns you there straight after sign-in.
4. Sign out in another tab mid-score-entry, then tap Finalize: the sheet shows the sign-in notice, and after signing back in your typed score is still there on the same game.
5. On a phone, Results shows "Completed N"; tapping it reveals finalized games; reload — the default view is back to needs-action.
6. As a money-off assistant coach, the tournament record shows schedule/roster but no fee amounts anywhere, including the Overview tile.
7. Turn on notifications, sign out, have someone mention you: no notification arrives. Sign back in (no prompt appears), get mentioned again: it arrives, and the missed messages are in your unread badge.
8. Tap a chat notification while signed out: after signing in you land in the conversation itself.
