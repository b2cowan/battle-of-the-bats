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

**Built 2026-11-13 (on `dev`, switched off for everyone until the family tier goes on).** What changed for people:
a **parent** in the app answers In / Out / Maybe (and a short note) for each upcoming game, or game and practice, once the coach turns it
on, and sees the other parent's first name and answer but never their note; a **coach who marks attendance** sees "9 of 13 in · 1 out ·
1 maybe" on each schedule row, the families' answers in Attendance with **Use N family answers** (only into players they haven't
marked, with Undo), a **Remind** that reaches parents in the app (once per event per day for the whole staff, at most one reminder email
per parent per day), a bell when a family says Out or takes an Out back or changes inside the last two days, and Out / Maybe on the lineup
builder with a one-tap Take out; **everyone** on the staff who sees the schedule sees the counts; "No reply" is now "Not marked" for every
team. Success: coaches stop chasing families by text before games; the walk (§526) passes; real families only after the FieldLogicHQ
privacy page is published.

**Drawn 2026-11-12** (https://claude.ai/artifact/UkYTNt3NtTbKrKP1GZoAiJ; all 15 asks ruled A 2026-11-13). The drawing's recommended shape: one team switch
(no per-event ask), a "9 of 13 in" count on each schedule row, the family's answer as a grey line under each player in the attendance room, one
"Use family answers" button that fills only players the coach hasn't marked, Remind only to parents in the app, and house league as its own later
stage. The paragraph below is the earlier sketch.

**The coach** (earlier sketch) sees a headcount chip per event, each family's answer beside their own attendance
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
