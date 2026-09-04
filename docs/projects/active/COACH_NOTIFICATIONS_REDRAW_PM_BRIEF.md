# Coach Notifications Redraw — PM brief

**Built on dev 2026-09-03 from the owner's six decisions on the mockups. Owner QA = ledger §138.**
Plan: `COACH_NOTIFICATIONS_REDRAW_PLAN.md`. Review: `COACH_NOTIFICATIONS_REVIEW.md`.

## What a coach sees and does differently

- **The Notifications page looks like every other coach page.** A bell tile, the title, the "?" for
  help, and the two actions (Notification settings, Mark all read) where the portal always puts
  them. On a phone the actions sit in their own finger-sized row under the title, icon-only. The
  page no longer scrolls sideways, and Mark all read is on the screen.
- **Times and day headers can be read.** "2h ago" and Today / Yesterday / Earlier use the portal's
  muted ink instead of a hairline. The bell panel got the same fix.
- **Notification settings has a pinned way home.** From the feed or the bell, the settings page
  carries a "Back to your Coaches Portal" bar that stays put under the top bar on every width, and
  arriving on the page cannot scroll it away.
- **Mark all read leaves Needs attention alone.** It clears Activity. Needs-attention items clear
  when opened, and the zone says so. The button only appears when there is Activity to clear.
- **The desktop bell panel is warm** like the account and Workspaces popovers beside it.
- **The sidebar keeps the team's navigation** on the notifications page instead of emptying.
- **"Game moved / cancelled / final" opens the coach's own Schedule.** Families still get theirs.
- **A failed load says so** with Try again. A brand-new coach sees "Nothing here yet" and what
  arrives here.

## How it affects other areas

- The admin shell's own Notifications page shares the feed body, so it gains readable tokens, the
  failed-load state and the wrapping header for free, and its bell inherits the Mark-all-read rule
  (Activity only). Its header keeps its own look.
- The account settings return bar is pinned for admins arriving from their strip too.

## Why it matters

On a phone this page is the coach's only notifications surface, and it was the broken one: an
unreachable control, invisible time, and a settings door with no way back. The rendered gate had
been green because the fixture held three rows and the offending control only renders when
something is unread.

## Trade-offs

- Row taps still reload the page and filters reset on Back (second pass, owner ruled).
- Coaches still receive organization-wide admin events with admin links; that is the recipient
  scoping project, not this screen.
- The demo coach's bell is still empty.

## How to test

Sign in as the UAT coach (`uat-coach@uat-test-org.local` / `UATPassword2026!`) with the seeded
feed. Phone width: More → Notifications. Read a timestamp; find Mark all read; press it and check
the three Needs-attention rows stay; tap Notification settings and use the pinned bar to come back.
Desktop: the sidebar shows the team; open the bell; tap "Game moved" and land on Schedule. The
checkable walkthrough is the QA artifact linked from the ledger entry.
