# Availability & RSVP — PM Brief

**Status:** Proposed · rewritten 2026-11-08 to the app channel (this is Stage 4b of the signed-in family accounts) · **Plan:** `COACH_AVAILABILITY_RSVP_PLAN.md`

## What it is

The answer to the question that ruins a coach's Thursday night: **"who do I actually have on Saturday?"** Parents answer a simple In / Out / Maybe
for each event **inside the signed-in family page**, with an optional one-line note ("leaving early"). The coach sees a live headcount on every
event, can nudge the silent families with one button, and the answers flow into the attendance book and lineup builder instead of living in a
group-chat scroll.

**What changed from the first version:** families no longer answer from an emailed link. There is no link-only door at all (owner ruling
2026-10-31). A parent opens the app, which they already joined from their placement email, and answers there. An email can nudge them to open the
app; it never carries the answer.

## What people see and do differently

**A parent** opens their family page, and each upcoming event for their child's team shows In / Out / Maybe. One tap, change it any time before the
event starts. They see only their own children, never other families' answers.

**The coach** (not yet drawn: this needs its own drawing session) sees a headcount chip per event, each family's answer beside their own attendance
pills with one tap to accept (or **Accept all**) into the real attendance book, a **Nudge non-responders** button that reports honestly ("3 nudged,
1 unreachable"), and, in the lineup builder, a child whose family said Out lands in Not playing.

The coach's book stays the boss: family answers *suggest*, the coach's tap *decides*.

## Why it matters

- Weekly, universal pain, and a strong reason for a family to keep the app installed and signed in.
- Makes attendance and lineups better: pre-filled instead of typed.

## Role differences & privacy posture

- Needs a connected parent: the family app must be on for the club, and the parent must have joined. A parent who left, was removed, or stopped the
  emails has no control and any stale write is refused.
- No teammates: a family sees its own children's answers only. No chat.
- Premium coaches portal for rep teams; whether house-league teams get it is a drawing question.

## Tradeoffs made

- Family answers sit beside the attendance book, not inside it: one extra coach tap, bought on purpose so no family action can corrupt the coach's
  record or the stats built on it.
- Fewer people answer than with a one-tap emailed link, because the parent must have joined first. Accepted: it is the owner's ruling that everyone
  signs in and there are no no-login doors.

## Success criteria

- A majority of connected families answer at least once in a team's first month.
- Coaches' attendance books show accepted pre-filled entries replacing hand-typed ones.
- Zero family-initiated changes to attendance stats without a coach tap (by construction).

## How to test (owner QA)

After the 4b drawing and build: with a test team and a joined parent account, ask for availability on a game, answer Out with a note on the phone,
watch the schedule chip update, Accept-all in the drawer, find the child under Not playing in the lineup builder, nudge the one silent family, then
leave the team as that parent and confirm the control is gone.
