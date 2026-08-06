# Availability & RSVP — PM Brief

**Status:** Proposed · **Plan:** `COACH_AVAILABILITY_RSVP_PLAN.md` · **Date:** 2026-08-03

## What it is

The answer to the question that ruins a coach's Thursday night: **"who do I actually have on
Saturday?"** Families get a simple In / Out / Maybe ask for each event — answered from an email
link in two taps, no app install, no account needed. The coach sees a live headcount on every
event ("9 in · 2 out · 1 maybe · 3 haven't answered"), can nudge the silent families with one
button, and the answers flow into the attendance book and lineup builder instead of living in a
group-chat scroll.

This is the single most-loved feature of the big team-management apps, and the most common
reason a team runs a second app beside ours.

## What people see and do differently

**A parent** gets a short email: the event card (when, where, arrival time, uniform) and three
big buttons. Tap one, done. They can change their answer up until game time, and add a short
note ("leaving early", "there by 6:15"). One unsubscribe link stops all of it, org-wide.

**The coach** sees a headcount chip on every upcoming event in the schedule — it turns amber,
then red, if confirmed players drop below a usable roster as the event nears. Opening the event
shows each family's answer next to the coach's own attendance pills, with one tap to accept an
answer (or **Accept all**) into the real attendance book. A **Nudge non-responders** button
emails only the silent families — at most once a day per event — and reports honestly ("3
nudged, 1 unreachable — unsubscribed"). In the lineup builder, a kid whose family said Out
drops into the Not playing pool automatically, and a Maybe wears an amber dot.

The coach's book stays the boss: family answers *suggest*, the coach's tap *decides*. Nothing a
family does silently rewrites attendance, reliability stats, or fairness reports.

## Why it matters

- Weekly, universal pain — every team, every event, all season. Strongest possible retention
  hook for the premium portal, and the family-facing touchpoint is itself a growth channel
  (every RSVP email is a branded, useful contact with a household).
- It makes the features we already have better: attendance gets pre-filled instead of typed,
  lineups stop being built around kids who were never coming.

## Role differences & privacy posture

- Availability is a premium, per-team feature riding the existing family layer; it appears
  nowhere in past-season archives.
- The email link shows one event and the child's first name + last initial — no roster, no
  other children, and it grants no ongoing access. This deliberately does **not** open the
  per-child family portal tier that's awaiting the privacy-counsel ruling; when that tier
  switches on, families with accounts additionally get the same three buttons inside their
  team page, automatically.
- Assistants see and accept answers if they can take attendance today; contact addresses stay
  hidden from assistants who can't see family contact info now.
- Requests and nudges are service messages about the family's own team, honor every existing
  unsubscribe, and never depend on marketing consent.

## Tradeoffs made

- Family answers live beside the attendance book, not inside it — one extra coach tap
  (Accept), bought deliberately: no family action can ever corrupt the coach's record or the
  stats built on it.
- No push notifications to families yet (we won't promise a channel we can't prove delivers);
  email + in-app bell where an account exists.
- Automatic weekly "answer your week" digests come in a later phase — v1 sends only when the
  coach asks, so send volume stays in the owner's hands while trust is established.

## Success criteria

- ≥60% of requested families answer at least once in a team's first month.
- Coaches' attendance books show pre-filled (accepted) entries replacing hand-typed ones.
- Zero family-initiated changes to attendance stats without a coach tap (by construction).
- Unsubscribes stay rare (<2% of households) — the signal the cadence is respectful.

## How to test (owner QA)

With a test team and your own email as guardian: request availability on a game, answer Out
with a note from the email on your phone, watch the schedule chip update, Accept-all in the
drawer, open the lineup builder and find the child under Not playing, nudge the one silent
family, then unsubscribe and confirm the next send skips you and tells the coach so.
