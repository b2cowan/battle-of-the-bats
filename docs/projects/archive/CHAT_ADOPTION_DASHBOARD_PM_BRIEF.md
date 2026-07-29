# PM Brief — Tournament Chat Adoption Module

**One-liner:** A dashboard card that turns "12/12 teams registered" into the next goal —
getting each team's coach signed up so Tournament Chat actually fills up — with a one-click
way to nudge the stragglers.

## Proposed functionality

A "Coach sign-ups & chat" card on the tournament dashboard (pre-event and post-event) shows:
- **X of Y coaches signed up** (progress bar) — how many registered teams have a coach who
  created their portal login.
- **N in the chat room · M not yet joined** — live participation and the remaining gap.
- A short line explaining what a coach unlocks by signing up (chat + live schedule, scores,
  and announcements).
- **"Remind teams to sign up"** — one click emails every not-yet-joined team's contact an
  access link to create their portal (reuses the existing, trusted access-link email).
- **"Open Chat →"** — jumps to the organizer's chat view.

If some teams have no coach email on file, the card flags it (those teams can't be invited).

## Tier behaviour

Tournament Chat is a **Tournament Plus** feature. On a free-tier event the card shows a
short "included with Tournament Plus" message and a link to learn more/upgrade — so it also
works as feature discovery, not just a metric.

## Why it matters

Organizers didn't know chat existed or why it was empty. The real reason is that coaches
hadn't signed up for their portals. This card makes the gap visible and gives the organizer
a single button to close it — driving both coach-portal adoption and chat usage, which are
retention and word-of-mouth levers.

## Customer impact

- **Organizers (Tournament Plus):** clear picture of coach onboarding + a fast nudge.
- **Organizers (free):** a tasteful nudge toward the upgrade that unlocks chat.
- **Coaches:** more likely to receive a clear "create your portal" prompt, unlocking their
  schedule, scores, announcements, and the coach group chat.

## Priority

Medium — small, additive, no migration; high-leverage on chat/portal adoption.

## Success criteria

- Organizers can see, at a glance, how many coaches have signed up and how many are in chat.
- The reminder reliably sends access links to not-yet-joined teams.
- Free-tier organizers see the upgrade path.
- No regression to the existing dashboard panels (drag/hide still works).
