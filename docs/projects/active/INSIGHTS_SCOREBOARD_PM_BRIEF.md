# Insights scoreboard — PM brief

**Priority:** small, high-visibility polish on the portal's reports page · **State:** ruled and built
2026-09-25, §233 walked 10/10 PASS the same day · Plan: `INSIGHTS_SCOREBOARD_PLAN.md` · Hub: `INSIGHTS_SCOREBOARD_HUB.html`

## What changes for a coach

- **On a computer**, Insights' season figures (Record, Form, Run diff, Close games, Attendance) sit on
  the same white card as every other coach dashboard, instead of straight on the page. Same layout,
  same height.
- **On a phone**, those figures become the same rows the Overview shows: one white frame, one figure
  per row, each row opening its report. Record and Form share a row — the record on the right, the
  last five results and the streak underneath — exactly as the Overview's Record row does.
- **The Attendance tab's** four figures get the same white frame, two per line on a phone.

## Why it matters

- The strip was the only block on the page not on a card — it read as unfinished next to the chart
  and What stands out beneath it, and next to every other dashboard in the portal.
- On a phone the figures took **317px — more than half the first screen** — and the first thing
  What stands out had to say was cut off by the bottom bar. They now take **207px (−35%)**, and What
  stands out starts 110px higher, with two findings whole on the first screen.
- One way to show a dashboard's figures on a phone, not two: the Overview and Insights now share the
  rows, so they cannot drift apart.

## Trade-offs accepted

- On a computer the record's note is now "Scrimmages left out" — the Overview tile's own words —
  instead of "Games + tournaments · scrimmages left out" (owner, on the first look): Record is half as
  wide, so Attendance stays on the first line down to a 1,010px window (it wrapped below 1,150).
- On a phone the note does not show at all (the Overview's phone row and the page header show the
  record without it; the Results tab, one tap away, says "Scrimmages 0-1 (not counted)").
- On a phone, the small run bar goes; "24 scored · 18 allowed" says the same thing.

## Who sees it

Everyone who can open Insights, on every plan that has it — nothing about access changes. Nothing new
is stored; it is a change to the page's look only.

## Success criteria

- A coach on a phone sees their season figures and the first What stands out finding on one screen.
- The Insights dashboard reads as one family with the Overview, Money and Skills & Goals.
- The owner's walk (§233) passes.
