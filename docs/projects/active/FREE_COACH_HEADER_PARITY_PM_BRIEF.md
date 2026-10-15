# Free coach header — PM brief

Plan: `FREE_COACH_HEADER_PARITY_PLAN.md` · Hub: https://claude.ai/artifact/EA2D38WeFe9mk4Qji9535y (source `FREE_COACH_HEADER_PARITY_HUB.html`, built by `.probe/fchp/build.cjs`) ·
Status: **direction ruled 2026-10-13 (owner, plus three asks as recommended); drawn and `/design`-checked 2026-10-13; the eight drawing asks ruled the same day, every one as recommended. Build
prompt written: `FREE_COACH_HEADER_PARITY_BUILD_PROMPT.md`.** **Built 2026-10-13** (the computer strip, the left menu, Chat inside the portal, the bell and its notices; words by /marketing, help by /docs, /simplify and /review done) — what is owed before the commit, and the decisions the build made on the owner's behalf, are in the plan §8.

## What changes for the coach

On a computer, a coach whose team is on the free portal sees the **same top strip as a paid coach**: the logo,
"Coaches Portal", a **bell**, and the **account menu** in the top-right corner. The account menu holds who is signed in,
Warm or Dark, notification settings, send feedback, account settings and sign out. The fan app's Home · Scores · Chat ·
Account links leave that bar. **Chat** returns to the left menu with its unread count, opening inside the portal,
whenever the coach has a chat or one is coming (a coach whose tournaments have no chat never sees it). **Help** sits at
the foot of the left menu, as in the paid portal. The page below the strip does not change.

The bell is new for free coaches, and it arrives **with something in it**. The notices are what the coach is already
emailed (registered, accepted or declined, payment recorded, payment reminders, schedule published, announcements,
final results), plus game changes (moved, cancelled, back on), which today reach a coach only as a phone push and only
if they follow their own team, and a club's invitation to join it (today a red count on the Home link that leaves
the bar). The notices come from every club whose tournament the coach's teams are in, and every coach on the team gets
them, not only the one address the emails go to.

## Why it matters

One coach can run a free team and a paid team at the same time. Today the account door is a text link among the fan
app's tabs on one and an icon menu in the far corner on the other, and the free side has no bell at all. The same
control moving and changing shape depending on a team's plan is a product inconsistency the owner caught on sight.
For a one-team coach, the right end of the free bar is simply empty.

## Customer impact

Every free coach on a computer. Nothing about their tournament pages moves. They gain a record of what organizers did
(today scattered across email and, for game changes, phone pushes that most coaches never switched on), and they reach
Warm/Dark, settings and sign out where every other FieldLogicHQ screen puts them.

## Trade-offs said out loud

- **The phone waits.** This piece is the computer only. Notices written for a coach who lives on their phone wait in
  the bell until the phone step gives them a door. That step is next and gets its own drawing.
- **Emails don't change.** The bell adds a record and sends no second email. A host's email switches govern email; the
  recommendation is that the bell still records what happened, since the coach's page shows the status anyway (Ask 6).
- **The game-day reminder stays email-only in v1.** It is sent the evening before, and a bell row needs its own timer
  to arrive then rather than when the schedule is published.

## Priority

The direction is ruled. It sits beside the free tournament tier build, which redraws the same coaches' world (an
invite-only free event). The two touch different screens and can run in either order; this one is smaller.

## Success criteria

- A coach with a free team and a paid team finds the bell and the account menu in the same corner, in the same shape,
  on both.
- A free coach's bell lights for an acceptance, a schedule and a moved game within a minute of the organizer's action,
  and a person who is also that club's staff never sees those notices in the club's admin bell.
- No free-portal screen on a computer shows the fan-app links.
