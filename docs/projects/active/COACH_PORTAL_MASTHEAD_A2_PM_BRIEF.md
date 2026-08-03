# PM brief — Masthead A2: the bar starts saying something true right now

**Date:** 2026-08-02 · **Plan:** `COACH_PORTAL_MASTHEAD_A2_PLAN.md` · **Priority:** small, high
visibility (it is on every premium team screen).

## What the coach sees change

Today the pinned bar at the top of every team page says who they are: club, team, season year.
After this it also says **how the season is going and what is happening next** — the two things a
coach checks a phone for.

- On a game day: *Blue Jays U13 · 2026 season · 12–4–1 · Game day — Lions, 6:30 p.m.*
- Otherwise: *… · 12–4–1 · Next: Thu 6:00 p.m. practice*
- A quiet week adds nothing — no filler, no "nothing scheduled" nag.
- Opening a finished season shows *2025 · Complete · final 18–6–2* and no "next" anything, because
  a finished season has no next.

It stays a **read-out, not a control** — nothing new to click, no second season switcher, and on a
phone the line still folds away when they scroll, exactly as it does now.

## Why it matters

The bar currently repeats what the sidebar already says. Admin's equivalent earns its space because
it carries live status; this is the same move for coaches. It also means the two answers a coach
opens the app for are visible from **every** screen — Dues, Documents, Roster — not just the
Overview.

## Access differences

An assistant coach who has not been given schedule access sees identity only, with no record and no
next event — matching what that same coach already sees one screen down. A past season shows what
that coach could see **at the time**, never today's grants.

## Tradeoffs made

- **One shared read, not a new fetch per screen.** The numbers come down with the page, so the line
  is there when the page paints and costs nothing on every screen after the first.
- **No new data is read for a finished season.** An archive shows its own frozen final record;
  nothing live is queried for it.
- **One thing needs your call:** the record on Insights respects a "count scrimmages" switch that
  Season's End does not. The bar can only agree with one of them — recommendation is to match
  Season's End (the official record), so the bar reads the same on every device.

## Success criteria

A coach can answer "what's my record" and "what's next" from any team screen without navigating,
the bar never shows `0–0` or a stale "Game day", and a finished season never shows a next event.

## How to test it

Open a team with games played and something on the schedule — check the line on the Overview, then
on Roster and Documents (screens that don't otherwise load games). Switch to a past season from the
title chip: the line should change to the Complete chip plus the final record. Shrink to a phone and
scroll: the line folds away with the rest of the meta.
