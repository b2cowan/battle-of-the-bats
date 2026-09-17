# Coach shared style kit — PM brief

**Status:** mockup and decisions drawn 2026-09-16, nothing built; owner rulings A–H owed on the hub
https://claude.ai/artifact/PGjDZKq8X5RDksnHH3abiN. Plan: `COACH_SHARED_STYLE_KIT_PLAN.md`.

## What this is

The Skills & Goals dashboard was built to look exactly like the Money dashboard — on the owner's
instruction — by copying every value into a second stylesheet. The owner's response was the
brief: *"shared stylings are important for consistency across the app."* This project decides what
a shared coach dashboard-and-list kit holds and which screens adopt it. It is a consistency pass,
not a redesign.

## What changes for a coach

Almost nothing they would name, on purpose:

- **Money → Overview** looks as it does today, one hairline different (its card border loses a faint
  olive tint every table already lost on 6 Sept).
- **Skills & Goals → Overview** looks as it does today; the small chevron on its "Everything in"
  rail matches Money's.
- **The team Overview** (the coach's front page) is the one screen that visibly moves: its six
  at-a-glance tiles and the "Next up" card take the same card, the same small label and the same
  numeral as the money cards two clicks away, and the tiles' thin progress bar becomes the same bar
  the Dues card draws. Same six tiles, same order, same facts. The owner can rule the front card
  stays put (decision C).
- **Insights' scoreboard** keeps its borderless band; its labels stop being the smallest text in the
  portal.
- **The row of controls above every list** — Roster, Dues, Sessions, Playing Time, Practice plans —
  sits at one height with one gap below, and the count line above the Roster reads at the same
  size as the one above Sessions.
- **On a phone**, the one-line summary a card shows under its title reads in one ink on the drills
  list, the results list and the coverage report alike (today the drills line is a shade lighter).
- **In the dark skin**, one thing a coach may actually notice: the Overview's cards stop being a
  different grey from every other card in the portal.

## Why it matters

Each of these shapes was built well once and then copied by hand into the next screen. Copies
drift silently — the two dashboards had already diverged in three places three days after the copy.
A reader sees "slightly off" without being able to say why, and the product reads as several
products. A shared kit turns "keep these the same" from a discipline into a fact: the next
dashboard-shaped screen is built from the same parts or the build fails.

## Customer impact

Every head coach and assistant, on the four screens they open most (Overview, Money, Skills & Goals,
Insights) and on every list in the portal. Nothing functional changes; no data, no permissions, no
navigation.

## Priority

Now — the owner's own close-out condition on the Development project was "before anything else
styles a dashboard." A sibling project (F-17, the row lists) is planning beside it; this one owns the
card, the toolbar and the phone fold, that one owns the row, and the plan sets the order so neither
matches a moving target.

## Trade-offs made

- **Coach portal first.** The tournament-admin and public-site screens are listed as a door left
  open, not drawn — the evidence is all coach-side and the admin shell has its own ruled density.
- **Two card roles, not one.** A report card (flat, its doors in a foot band) and a door tile (the
  whole card opens, it lifts on hover) are a real difference a coach uses; everything else that
  differed between them was accident.
- **Money's values win where the copies disagree** — it is the newest owner-approved dashboard and
  the one the owner named as the model.

## How it gets verified once built

- The layout gate's screen baseline is re-run on both skins across a dozen screens. **The team
  Overview's baseline will move** (rounder → squarer cards, a taller bar) and those rows are
  re-accepted by measurement; every other screen must not move a row.
- A build guard fails when any coach stylesheet declares its own card, eyebrow, figure, toolbar or
  rail outside the kit — the same pattern that stops a thirtieth finished-season branch.
- An owner QA walk on the hub's QA tab, pinned to identities ("the Record tile opens the record"),
  never to figures.

## Success criteria

- Both Overviews render from one kit and the second stylesheet is gone; Money and Skills & Goals
  look as they do today.
- One toolbar behind every list; the five recipes deleted; the tap floor asserted once.
- One phone-line family; the two private pairs deleted.
- The guard is in the build and green.
