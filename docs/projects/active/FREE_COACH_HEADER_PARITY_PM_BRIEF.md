# Free coach header — PM brief

Plan: `FREE_COACH_HEADER_PARITY_PLAN.md` · Hub: https://claude.ai/artifact/EA2D38WeFe9mk4Qji9535y (source `FREE_COACH_HEADER_PARITY_HUB.html`, built by `.probe/fchp/build.cjs`) ·
Status: **direction ruled 2026-10-13 (owner, plus three asks as recommended); drawn and `/design`-checked 2026-10-13; the eight drawing asks ruled the same day, every one as recommended. Build
prompt written: `FREE_COACH_HEADER_PARITY_BUILD_PROMPT.md`.** **Built 2026-10-13** (the computer strip, the left menu, Chat inside the portal, the bell and its notices; words by /marketing, help by /docs, /simplify and /review done) — what is owed before the commit, and the decisions the build made on the owner's behalf, are in the plan §8. **Committed `ad0267e4` 2026-10-15. The phone step was drawn 2026-10-15 on the hub's Phone stage and redrawn the same day to the owner's team-bar direction and ruled (plan §9.4); phone build prompt written:
`FREE_COACH_HEADER_PARITY_PHONE_BUILD_PROMPT.md`.**

**The registration notice built 2026-10-15** — the one kind left out of the commit: when a coach registers the team through a tournament's public form, the team's other coaches hear "registered" or "on the waitlist" in the bell (plan §8; walk §313, the hub's W6).

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

## The phone (owner direction 2026-10-15 — redrawn and ruled the same day; BUILT and committed `02e0b080` 2026-10-16)

**The gap.** A free coach's bell exists only on a computer. On a phone, where coaches are at the field, the notices
pile up unseen: our test coach has four, two unread, and no way to open them. The phone is the larger half of the
bell's value.

**What is proposed (the owner's direction).** The free portal on a phone takes the paid portal's shape: a bar at the
bottom with **Overview · Tournaments · Chat · More**, in place of the section row across the top. The bar never
changes; when a coach turns on a free tool (Roster, Schedule, Fees, Announcements) it joins **More**, with Explore as
the last tile. More also holds **Notifications** (first, with the unread count riding the More tab, as on the paid
phone), the fan app's Home and Scores, Account, Help and Sign out. Notifications opens the same page a paid coach
reads, and Chat opens inside the portal, as it does on a computer.

**Why it is right.** Since 10-13 the free portal on a computer already wears the paid top strip and a left menu of the
team's sections. Keeping the fan app's bar on the phone would leave the free portal as the one product that changes
shape with the screen size. A coach who runs a free team and a paid team now finds Overview first, Chat, and More last
on both phones.

**What it costs.** The July business decision that the free portal is a "tournament companion" inside the fan app,
with the shell difference as the upgrade story, reverses; the upgrade story rests on the season tools alone (the
business decisions log is amended). Home and Scores become two taps, inside More. Explore is no longer always one tap
away. It is a larger build than round 1: the phone's section row retires.

**Ruled with it (2026-10-15, as recommended):** Chat hides for a coach whose tournaments have no chat, as on a
computer; Explore is the last tile in More; Notification settings gets no new card, but the Pause switch now shows to
every free coach (which also fixes the pending coach who found "Nothing to manage here yet"); the computer's left menu
and team header stay as built.

**Success criteria for the phone.** A free coach sees an unread count on More within a minute of an organizer's action
and opens it from More's first row; turning on Roster adds a Roster tile to More and leaves the bar unchanged; a coach
with a free team and a paid team finds Overview first and More last on both phones; no free-portal phone screen shows
the section row or the fan app's bar.

**Built (2026-10-15/16, committed `02e0b080` on the owner's word).** As drawn, with four calls the owner made at the
build's start: the free bar shares the paid bar's look through its stylesheet; a window you type into hides the bar, as
in the paid portal; **a page with no team keeps the app's own bar** (the front page of a coach with several teams or
none), while Notifications always keeps the team bar, pointed at the team the coach last opened; and measuring is by
probe now, with the layout sweep's free screens as a follow-up. More's middle group is called **"You"**, the admin's
label for the same doors. Two defects that every phone bar shared were fixed with it, on the owner's word: "More" sat a
little higher than the other tabs, and the unread count did not drop when a notice was read until the page reloaded.
**Checked against the success criteria on dev:** the count on More, Notifications first and the paid page (Casey); a
Roster tile with the bar unchanged (Avery, Roster turned on then off); no section row and no fan bar on a team's phone
screens; Pause for a coach who follows nothing. The owner's walk is ledger §315, the hub's W7–W9.

**Found on the way.** The computer's new bell sends a coach to Notification settings. A coach whose team is still
pending sees "Nothing to manage here yet" there, with no Pause switch. The recommended fix shows Pause to every
coach with a free team, with no database change.

## Priority

The direction is ruled. It sits beside the free tournament tier build, which redraws the same coaches' world (an
invite-only free event). The two touch different screens and can run in either order; this one is smaller.

## Success criteria

- A coach with a free team and a paid team finds the bell and the account menu in the same corner, in the same shape,
  on both.
- A free coach's bell lights for an acceptance, a schedule and a moved game within a minute of the organizer's action,
  and a person who is also that club's staff never sees those notices in the club's admin bell.
- No free-portal screen on a computer shows the fan-app links.
