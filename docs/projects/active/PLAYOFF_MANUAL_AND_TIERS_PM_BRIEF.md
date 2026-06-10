# PM Brief — Playoff Brackets: Manual (Free) + Tiered (Plus)

**Status:** Built on dev (`feat/free-tier-coaches`), awaiting browser sign-off — 2026-06-09.

## What we built & why it matters

**1. Free organizers can now build playoff brackets by hand.**
Until now, the only structured way to make a bracket was the Plus-only auto-builder,
so a free (Tournament-plan) organizer running a small event had no real playoff
path. Now any organizer can open the Playoff Bracket Builder, pick a format, and the
app lays out the matchups by seed (with byes/play-ins handled automatically). They
drag/edit matchups and enter each game's date, time, and field themselves, then save.
Winners still advance automatically as scores come in. This removes a hard wall for
the entry tier and makes the free plan genuinely usable for a real tournament.

**What stays Plus:** the *auto-schedule optimizer* — the one-click "fill in all the
dates, times, and fields for me" magic — and the new tiered split below. Free tier
sees that button locked with a clear upgrade prompt. This keeps a clean upgrade
ladder: *free = build it yourself; Plus = let the software schedule it.*

**2. Plus organizers can split one round robin into tiered brackets.**
A common request: after a single round robin, run a **championship tier** for the top
teams and a **consolation tier** for the rest, so everyone keeps playing meaningful
games. Example: a 9-team round robin splits into Tier 1 (seeds 1–5, with a play-in
between #4 and #5) and Tier 2 (seeds 6–9) — each its own bracket. Organizers can
create any number of tiers, move the cut lines, name them (Gold/Silver/Bronze), and
pick a format per tier. The app suggests a sensible default split to start.

## Customer impact
- **Entry-tier retention:** the free plan can now run a complete event end-to-end,
  reducing the "I can't even make a bracket" churn reason.
- **Upsell clarity:** auto-scheduling and tiered brackets are concrete, easily
  understood reasons to move to Tournament Plus.
- **Bigger events:** tiered brackets serve multi-division-feel events without
  forcing organizers into manual pool setup.

## Priority & success criteria
- **Priority:** High (unblocks free-tier usability + a frequently requested Plus
  capability), low risk (reuses the existing bracket + advancement engine; no DB
  migration).
- **Success:**
  - A free-tier organizer builds and saves a working bracket with no upgrade nag on
    the build path; advancement works on score entry.
  - A Plus organizer produces a tiered bracket from one round robin where lower
    seeds resolve to the correct standings and each tier crowns its own champion.
  - Invalid tier setups (gaps, overlaps, duplicate names, too many seeds) are
    blocked with a plain-language message before save.

## Access by plan
| Capability | Tournament (free) | Tournament Plus+ |
|---|---|---|
| Build playoff bracket by seed (all formats, manual times) | ✅ | ✅ |
| Auto-schedule the bracket (optimizer) | 🔒 | ✅ |
| Tiered auto-split from one round robin | 🔒 | ✅ |

Role access is unchanged — same schedule-management permission as today; only the
plan tier changes what's available.
