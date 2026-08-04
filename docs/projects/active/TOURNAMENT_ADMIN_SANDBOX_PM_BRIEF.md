# Tournament Admin Sandbox — PM Brief

**Status:** Mockups approved and all four owner decisions ratified 2026-08-02 — cleared to build
Phase 1. Plan: `TOURNAMENT_ADMIN_SANDBOX_PLAN.md`. Approved visual spec:
`TOURNAMENT_SANDBOX_MOCKUPS.html` (artifact `118b8d75-1b83-4272-b9f2-bfe0ae9f7ddf`).

## What a prospect sees

A "See it live" button next to "Start Free" on the tournament-organizer marketing page. One tap —
no login, no email — and they're inside a real tournament on semifinal morning: pool play done,
the bracket seeded, two semis underway. Scores tick on their own while they watch. A banner says
"Live sandbox — nothing here is saved," and a few tour chips point at the beats: watch the
scores move, watch the bracket fill itself in, try to break the schedule and watch the health
score react, and flip to see exactly what parents in the bleachers see.

Crucially, they experience **both sides**: the operator's game-day dashboard and schedule tools,
and the public fan page those tools feed — the "you run this, they see that" loop that is the
actual product promise. Anything they try to change works on their screen but isn't saved; every
save attempt offers "Start your own — free."

## Why it matters

Our funnel today has zero "see it working" path — every button is a signup, another marketing
page, or a lead form. Competitors sell tournament software with feature lists and sales calls.
Letting a skeptical volunteer organizer *break a fake tournament with their own hands* in the
first 90 seconds, before we ask for an email, is the strongest sales asset we can ship — and
because it's the real product, it never goes stale and never over-promises. The link is also
shareable and QR-able at real events, which is our cheapest word-of-mouth channel.

## Tradeoffs made

- **Look and poke, don't keep.** All visitors share the demo tournament, so nothing anyone does
  is saved — that's what makes no-login safe with many simultaneous visitors, and it turns
  every save attempt into a signup moment.
- **One perfect moment, always today.** The demo is permanently semifinal morning; it quietly
  resets a few times a day and re-anchors its dates nightly so it never looks stale. A
  "moments" picker (registration week / game day / the morning after) is a possible follow-up.
- **Drag-and-drop is the delicate part.** Making the schedule and bracket editors feel alive
  while nothing saves needs careful handling; if it fights back, launch ships the rest and the
  drag beat fast-follows.

## Why we don't ask for an email first

The owner raised the obvious question before the build started: does letting anyone walk in hand
our functionality to competitors? The answer, settled 2026-08-02, is no — and the reason is our
own pricing. Tournament is free with no credit card, and Tournament Plus is free to anyone until
January 2027. A competitor who signs up gets *more* than the sandbox shows, including write access
and their own event. An email gate would not stop them; it would only stop the skeptical volunteer
organizer we are trying to reach. **The openness is the competitive asset, not the leak.**

What we *do* gate is the room, not the visitor: a handful of admin areas — billing, staff
invitations, exports, deep settings — are hidden inside the sandbox rather than allowed to
dead-end, because a screen made entirely of locked buttons reads as a broken product. Same
principle already ruled binding for archived coach seasons: hide the door rather than let it 404.

Accepted trade-off: **we will not know who used the demo unless they convert.** No attribution,
no retargeting list — only the signup itself. That is the price of zero friction, and at this
stage the conversion is worth more than the list. Revisit in January 2027, when Tournament Plus
stops being free.

## The demo tournament

**Riverdale Minor Ball Association** running the **Riverdale Summer Classic** — Rapids, Cyclones,
Marauders and Sharks — on a comped Tournament Plus account, replaying every two hours and
re-anchoring its dates nightly so it is always "today". Every person and contact in it is
invented.

## Phase 2 — the moments dock (built 2026-08-04, mockups approved same day)

An organizer's year is not one Saturday, so the demo stopped being one. The same association now
runs **three events in three moments of its life**, and a slim "The year" band in the demo's
banner moves a visitor between them in one press:

- **Registration week** — the *Riverdale Invitational*, always three weeks from first pitch: one
  division full with a waitlist forming, one still filling, fifteen registrations in the
  pipeline, money part-collected and one balance overdue — the week most organizers dread, with
  the product visibly doing the managing.
- **Game day** — the Summer Classic, exactly as before. Untouched.
- **The morning after** — the *Riverdale Season Opener*, always ended yesterday: champion
  crowned on the public page, the final record preserved, and the organizer's Post-Event Summary
  showing the paperwork already done, with "next year starts in one step."

The guided tour grew from four steps to six ("Go back three weeks" → "Skip to the morning
after"), so a stranger walks the whole year inside two minutes. Every jump is narrated in plain
words, and the banner's clock tells each moment's truth ("Replays in 38:12" / "First pitch in
3 weeks" / "Wrapped up yesterday"). Nothing about the safety story changed: same org, same
write-block, same outbound silence, and the two new moments never tick — the demo still repairs
itself with no stored state.

## Mockups came first — and they're approved

Per the owner's direction, no code was written until mockups were approved. Four screens were
produced and signed off 2026-08-02; they are now the binding visual spec. Copy in them is a
working draft — the final wording goes through the marketing pass before the door opens.

## How to test (owner QA at launch)

Open the door link in a private window: land on the demo with no login; watch a score change
without touching anything; follow all tour chips; drag a game and confirm the health score
reacts and the nudge appears; flip to the fan view; confirm nothing you did persists after
refresh; return hours later and confirm the demo reset itself and still says "today."

## Success criteria

A cold visitor sees a live score move and both sides of the product within two minutes, with no
signup; nothing a visitor does persists or sends anything; the demo is never stale; every dead
end offers "Start your own — free."
